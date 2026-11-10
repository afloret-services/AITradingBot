"""PROTOTYPE, throwaway: dump MNQ 1-minute bars from IB Gateway to CSVs for strategy-lab.html.

Run on the machine where IB Gateway is logged in to the paper account (port 4002):

    pip install ib_async
    python fetch_ibkr.py --month 202612 --weeks 16                          # one contract month
    python fetch_ibkr.py --history 202503 202612 --out mnq_1m_2y.csv        # several quarterly contracts, rolled
    python fetch_ibkr.py --from-csv mnq_1m_2y.csv                           # no IBKR: only build 5m/15m/1h/4h

Writes the 1m bars to --out with columns ts (UTC, ISO, bar start), open, high, low, close, volume, then the
same bars built into larger timeframes (--tf, default 5m 15m 1h 4h), one file each, named after --out with
"1m" replaced (mnq_1m_2y.csv -> mnq_5m_2y.csv, ...; or "_5m" added if the name has no "1m").
- Built from the 1m bars, not asked from IBKR: every timeframe agrees exactly and costs no extra requests.
- 5m, 15m and 1h bars start on the clock (09:30, 09:45, 10:00 ...).
- 4h bars start at 18:00 New York, the CME session open: 18:00, 22:00, 02:00, 06:00, 10:00, 14:00 NY,
  the last one cut at the 17:00 close.
- A bar covers only the 1m bars that exist; there are no bars for the 17:00-18:00 break or weekends.

--history fetches every quarterly contract from the first month to the last (includeExpired) and keeps each one
only while it is the Active contract: from the previous contract's Roll to its own, the Roll being the Thursday
8 days before expiry (the third Friday of the month). Bars are raw per-contract prices, not back-adjusted, so a
lookback that spans a Roll sees the jump between contracts. IBKR serves expired futures for about 2 years after
expiry, so the history reaches back about 2 years.
"""
import argparse
import csv
import datetime as dt
import os
from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")
UTC = dt.timezone.utc

p = argparse.ArgumentParser()
p.add_argument("--month", default="202612", help="contract month, e.g. 202612 for MNQZ6")
p.add_argument("--weeks", type=int, default=16, help="how far back to go; the weeks before the first reviewed day give the Bias its daily history")
p.add_argument("--history", nargs=2, metavar=("FIRST", "LAST"), help="quarterly contract months to roll through, e.g. 202503 202612")
p.add_argument("--from-csv", help="skip IBKR: read these 1m bars and only build the larger timeframes")
p.add_argument("--tf", nargs="*", default=["5m", "15m", "1h", "4h"], help="larger timeframes to build (5m 15m 1h 4h); none: 1m only")
p.add_argument("--chunk", default="1 W", help="duration per request; try '2 D' if IBKR rejects '1 W'")
p.add_argument("--port", type=int, default=4002)
p.add_argument("--out", default="mnq_1m.csv")
a = p.parse_args()

TF_MIN = {"5m": 5, "15m": 15, "1h": 60, "4h": 240}
for tf in a.tf:
    if tf not in TF_MIN:
        p.error(f"--tf {tf}: use one of {' '.join(TF_MIN)}")

days_per_chunk = 7 if a.chunk.endswith("W") else int(a.chunk.split()[0])


def third_friday(y, m):
    d = dt.date(y, m, 15)
    return d + dt.timedelta(days=(4 - d.weekday()) % 7)


def roll_date(month):  # the Thursday 8 days before expiry
    y, m = int(month[:4]), int(month[4:])
    return third_friday(y, m) - dt.timedelta(days=8)


def quarter_months(first, last):
    y, m = int(first[:4]), int(first[4:])
    out = []
    while f"{y}{m:02d}" <= last:
        if m in (3, 6, 9, 12):
            out.append(f"{y}{m:02d}")
        m += 1
        if m > 12:
            y, m = y + 1, 1
    return out


def fetch(ib, month, start=None, stop=None, weeks=None):
    """1m bars of one contract as {utc datetime: (o, h, l, c, v)}, back to `start` (or `weeks` weeks), ending at `stop`."""
    from ib_async import Future
    c = Future("MNQ", lastTradeDateOrContractMonth=month, exchange="CME", currency="USD", includeExpired=True)
    if not ib.qualifyContracts(c):
        print(f"{month}: not found at IBKR (older than about 2 years?), skipped")
        return {}
    print("Contract:", c.localSymbol)
    bars = {}
    end = "" if stop is None or stop >= dt.datetime.now(UTC) else stop.strftime("%Y%m%d %H:%M:%S UTC")
    n = 0
    while True:
        chunk = ib.reqHistoricalData(c, endDateTime=end, durationStr=a.chunk, barSizeSetting="1 min",
                                     whatToShow="TRADES", useRTH=False, formatDate=2)
        if not chunk:
            print("No more data.")
            break
        for b in chunk:
            if (start is None or b.date >= start) and (stop is None or b.date < stop):
                bars[b.date] = (b.open, b.high, b.low, b.close, int(b.volume))
        first = chunk[0].date
        print(f"{c.localSymbol}: {len(chunk)} bars back to {first:%Y-%m-%d %H:%M} UTC")
        n += 1
        ib.sleep(11)  # stay inside IBKR's historical-data pacing limits
        if (start is not None and first <= start) or (weeks is not None and n * days_per_chunk >= weeks * 7):
            break
        end = first.strftime("%Y%m%d %H:%M:%S UTC")
    return bars


def bucket(t, minutes):
    """Start of the `minutes` bar holding the 1m bar starting at t (UTC). 4h bars are anchored at 18:00 NY."""
    if minutes < 240:
        return t.replace(second=0, microsecond=0) - dt.timedelta(minutes=(t.hour * 60 + t.minute) % minutes)
    ny = t.astimezone(NY)
    since_open = (ny.hour * 60 + ny.minute - 18 * 60) % (24 * 60)  # minutes since 18:00 NY
    start = ny.replace(second=0, microsecond=0) - dt.timedelta(minutes=since_open % minutes)
    return start.astimezone(UTC)


def build(bars, minutes):
    out = {}
    for t in sorted(bars):
        o, h, l, c, v = bars[t]
        k = bucket(t, minutes)
        if k not in out:
            out[k] = [o, h, l, c, v]
        else:
            b = out[k]
            b[1], b[2], b[3], b[4] = max(b[1], h), min(b[2], l), c, b[4] + v
    return out


def write(path, bars):
    with open(path, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["ts", "open", "high", "low", "close", "volume"])
        for t in sorted(bars):
            o, h, l, c, v = bars[t]
            w.writerow([t.strftime("%Y-%m-%dT%H:%M:%SZ"), o, h, l, c, v])
    print(f"Wrote {len(bars)} bars to {path}")


def tf_path(tf):
    d, name = os.path.split(a.from_csv or a.out)
    stem, ext = os.path.splitext(name)
    return os.path.join(d, stem.replace("1m", tf) if "1m" in stem else f"{stem}_{tf}") + ext


bars = {}
if a.from_csv:
    with open(a.from_csv, newline="") as f:
        for r in csv.DictReader(f):
            t = dt.datetime.strptime(r["ts"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC)
            bars[t] = (float(r["open"]), float(r["high"]), float(r["low"]), float(r["close"]), int(float(r.get("volume") or 0)))
    print(f"Read {len(bars)} 1m bars from {a.from_csv}")
else:
    from ib_async import IB
    ib = IB()
    ib.connect("127.0.0.1", a.port, clientId=71, readonly=True)
    if a.history:
        months = quarter_months(*a.history)
        for i, m in enumerate(months):
            # active from the previous contract's Roll (18:00 NY that Thursday, taken as 22:00 UTC) to its own
            start = None if i == 0 else dt.datetime.combine(roll_date(months[i - 1]), dt.time(22), UTC)
            stop = dt.datetime.combine(roll_date(m), dt.time(22), UTC)
            if i == 0:
                start = stop - dt.timedelta(days=91)
            bars.update(fetch(ib, m, start=start, stop=stop))
    else:
        bars = fetch(ib, a.month, weeks=a.weeks)
    ib.disconnect()
    write(a.out, bars)

for tf in a.tf:
    write(tf_path(tf), build(bars, TF_MIN[tf]))

"""PROTOTYPE, throwaway: dump MNQ 1-minute bars from IB Gateway to a CSV for strategy-lab.html.

Run on the machine where IB Gateway is logged in to the paper account (port 4002):

    pip install ib_async
    python fetch_ibkr.py --month 202612 --weeks 16          # one contract month
    python fetch_ibkr.py --history 202503 202612            # several quarterly contracts, rolled

Writes mnq_1m.csv with columns ts (UTC, ISO), open, high, low, close, volume.

--history fetches every quarterly contract from the first month to the last (includeExpired) and keeps each one
only while it is the Active contract: from the previous contract's Roll to its own, the Roll being the Thursday
8 days before expiry (the third Friday of the month). Bars are raw per-contract prices, not back-adjusted, so a
lookback that spans a Roll sees the jump between contracts. IBKR serves expired futures for about 2 years after
expiry, so the history reaches back about 2 years. 5m, 15m, 1h and 4h bars are built from these 1m bars by the page.
"""
import argparse
import csv
import datetime as dt

from ib_async import IB, Future

p = argparse.ArgumentParser()
p.add_argument("--month", default="202612", help="contract month, e.g. 202612 for MNQZ6")
p.add_argument("--weeks", type=int, default=16, help="how far back to go; the weeks before the first reviewed day give the Bias its daily history")
p.add_argument("--history", nargs=2, metavar=("FIRST", "LAST"), help="quarterly contract months to roll through, e.g. 202503 202612")
p.add_argument("--chunk", default="1 W", help="duration per request; try '2 D' if IBKR rejects '1 W'")
p.add_argument("--port", type=int, default=4002)
p.add_argument("--out", default="mnq_1m.csv")
a = p.parse_args()

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
    """1m bars of one contract, newest first back to `start` (or `weeks` weeks), ending at `stop`."""
    c = Future("MNQ", lastTradeDateOrContractMonth=month, exchange="CME", currency="USD", includeExpired=True)
    if not ib.qualifyContracts(c):
        print(f"{month}: not found at IBKR (older than about 2 years?), skipped")
        return {}
    print("Contract:", c.localSymbol)
    bars = {}
    end = "" if stop is None or stop >= dt.datetime.now(dt.timezone.utc) else stop.strftime("%Y%m%d %H:%M:%S UTC")
    n = 0
    while True:
        chunk = ib.reqHistoricalData(c, endDateTime=end, durationStr=a.chunk, barSizeSetting="1 min",
                                     whatToShow="TRADES", useRTH=False, formatDate=2)
        if not chunk:
            print("No more data.")
            break
        for b in chunk:
            if (start is None or b.date >= start) and (stop is None or b.date < stop):
                bars[b.date] = b
        first = chunk[0].date
        print(f"{c.localSymbol}: {len(chunk)} bars back to {first:%Y-%m-%d %H:%M} UTC")
        n += 1
        ib.sleep(11)  # stay inside IBKR's historical-data pacing limits
        if (start is not None and first <= start) or (weeks is not None and n * days_per_chunk >= weeks * 7):
            break
        end = first.strftime("%Y%m%d %H:%M:%S UTC")
    return bars


ib = IB()
ib.connect("127.0.0.1", a.port, clientId=71, readonly=True)
bars = {}
if a.history:
    months = quarter_months(*a.history)
    for i, m in enumerate(months):
        # active from the previous contract's Roll (18:00 NY that Thursday = 22:00/23:00 UTC; 22:00 used) to its own
        start = None if i == 0 else dt.datetime.combine(roll_date(months[i - 1]), dt.time(22), dt.timezone.utc)
        stop = dt.datetime.combine(roll_date(m), dt.time(22), dt.timezone.utc)
        if i == 0:
            start = stop - dt.timedelta(days=91)
        bars.update(fetch(ib, m, start=start, stop=stop))
else:
    bars = fetch(ib, a.month, weeks=a.weeks)
ib.disconnect()

with open(a.out, "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["ts", "open", "high", "low", "close", "volume"])
    for t in sorted(bars):
        b = bars[t]
        w.writerow([t.strftime("%Y-%m-%dT%H:%M:%SZ"), b.open, b.high, b.low, b.close, int(b.volume)])
print(f"Wrote {len(bars)} bars to {a.out}")

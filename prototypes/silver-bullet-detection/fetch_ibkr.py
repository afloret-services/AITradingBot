"""PROTOTYPE, throwaway: dump MNQ 1-minute bars from IB Gateway to a CSV for silver-bullet-review.html.

Run on the machine where IB Gateway is logged in to the paper account (port 4002):

    pip install ib_async
    python fetch_ibkr.py --month 202612 --weeks 7

Writes mnq_1m.csv with columns ts (UTC, ISO), open, high, low, close, volume.
One contract month only: stay after the last roll, or the series jumps at the roll.
"""
import argparse
import csv

from ib_async import IB, Future

p = argparse.ArgumentParser()
p.add_argument("--month", default="202612", help="contract month, e.g. 202612 for MNQZ6")
p.add_argument("--weeks", type=int, default=7, help="how far back to go (at least 3)")
p.add_argument("--chunk", default="1 W", help="duration per request; try '2 D' if IBKR rejects '1 W'")
p.add_argument("--port", type=int, default=4002)
p.add_argument("--out", default="mnq_1m.csv")
a = p.parse_args()

ib = IB()
ib.connect("127.0.0.1", a.port, clientId=71, readonly=True)
contract = Future("MNQ", lastTradeDateOrContractMonth=a.month, exchange="CME", currency="USD", includeExpired=True)
ib.qualifyContracts(contract)
print("Contract:", contract.localSymbol)

days_per_chunk = 7 if a.chunk.endswith("W") else int(a.chunk.split()[0])
bars, end = {}, ""
for n in range(max(1, (a.weeks * 7) // days_per_chunk)):
    chunk = ib.reqHistoricalData(contract, endDateTime=end, durationStr=a.chunk, barSizeSetting="1 min",
                                 whatToShow="TRADES", useRTH=False, formatDate=2)
    if not chunk:
        print("No more data.")
        break
    for b in chunk:
        bars[b.date] = b
    end = chunk[0].date
    print(f"{len(chunk)} bars back to {end:%Y-%m-%d %H:%M} UTC")
    ib.sleep(11)  # stay inside IBKR's historical-data pacing limits
ib.disconnect()

with open(a.out, "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["ts", "open", "high", "low", "close", "volume"])
    for t in sorted(bars):
        b = bars[t]
        w.writerow([t.strftime("%Y-%m-%dT%H:%M:%SZ"), b.open, b.high, b.low, b.close, int(b.volume)])
print(f"Wrote {len(bars)} bars to {a.out}")

"""PROTOTYPE, throwaway: download MNQ 1-minute bars from Databento to a CSV for silver-bullet-review.html.

    pip install databento
    DATABENTO_API_KEY=db-... python fetch_databento.py --symbol MNQZ6 --start 2026-09-01 --end 2026-10-28

Shows the cost and asks before downloading. Writes mnq_1m.csv with columns ts (UTC, ISO), open, high, low, close, volume.
One contract (raw symbol) only: stay after the last roll, or the series jumps at the roll.
"""
import argparse

import databento as db

p = argparse.ArgumentParser()
p.add_argument("--symbol", default="MNQZ6", help="raw contract symbol, e.g. MNQZ6 for December 2026")
p.add_argument("--start", required=True, help="YYYY-MM-DD; take at least 3 weeks")
p.add_argument("--end", required=True, help="YYYY-MM-DD (exclusive)")
p.add_argument("--out", default="mnq_1m.csv")
p.add_argument("--yes", action="store_true", help="skip the cost confirmation")
a = p.parse_args()

client = db.Historical()  # reads DATABENTO_API_KEY
params = dict(dataset="GLBX.MDP3", schema="ohlcv-1m", symbols=[a.symbol], stype_in="raw_symbol", start=a.start, end=a.end)
cost = client.metadata.get_cost(**params)
print(f"Estimated cost: ${cost:.4f}")
if not a.yes and input("Download? [y/N] ").strip().lower() != "y":
    raise SystemExit("Cancelled.")

df = client.timeseries.get_range(**params).to_df().reset_index()
df = df.rename(columns={"ts_event": "ts"})[["ts", "open", "high", "low", "close", "volume"]]
df["ts"] = df["ts"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
df.to_csv(a.out, index=False)
print(f"Wrote {len(df)} bars to {a.out}")

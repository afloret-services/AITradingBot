# Hosted Decision model as an optional Signal filter

The Silver Bullet rules produce every Signal. Optionally, a hosted Decision model (Jev, on a pinned version ID) is asked "will this Trade reach its target before its stop?", and Signals below a configured threshold (0.5, never tuned on the data used to judge the filter) become Filtered Signals. A filter was chosen rather than having the model make judgment calls such as "is this a displacement?", so every Trade can still be checked against the written rules on the chart. Jev was chosen over a self-hosted Laya because Laya's base checkpoints are near chance until fine-tuned. Jev was chosen over self-hosted Clef because Clef needs 41–85 GB of GPU memory.

Neither repeatability nor a training cutoff is guaranteed for Jev. Two rules keep the backtest honest:
- The backtest replays recorded answers: each historical Signal is asked once, and the probability is stored with the model version.
- The filter is judged only on bars after the pinned version's release date, against a rules-only run, which remains the proof that the Setup works as written.

## Consequences

- The model sees only the trading day's bars up to the Signal, with prices relative to entry, plus the Signal's direction, entry, stop and target. It is never shown dates, the symbol or absolute prices.
- The filter is a switch the user flips. When it is off, the model still runs in shadow and its probability is logged for every Signal.
- If the model can't load at start-up, the bot Halts. If a single call fails or takes longer than 5 seconds, that Signal becomes a Filtered Signal marked "filter unavailable".
- When a pinned version is announced for retirement, its answers are recorded again with the new version, and the post-release comparison is re-run before switching.

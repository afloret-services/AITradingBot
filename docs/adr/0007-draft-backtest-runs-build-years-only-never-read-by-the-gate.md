# A Draft may be backtested as a Run, on the build years only, and the gate never reads it

A backtest Run may bind one Draft (a snapshot of its bytes and hash, no version number) instead of frozen versions, so the builder can show how a Setup trades on each instrument before it is frozen. Such a Run covers only the build years, never the held-out last 12 months, and the Promotion gate never reads it, not even when a version is frozen from an unchanged Draft with the same hash: a Promotion verdict must rest only on backtests started for that version, so that nothing seen while editing can leak the held-out period into the rules or stand in for the gate's own runs.

## Considered Options

- **A trial that is not a Run** (results kept only beside the Draft): rejected because the user wanted these backtests as Runs, listed and reviewable like any other, with the same spec, engine command, result shape and instrument checks.
- **Let the gate reuse a matching Draft Run's in-sample result** (same hash, faster): rejected because the verdict would then depend on a run started while the rules were still being edited.
- **Enforce the held-out lock only in the app** (the Runs module never writes such a spec): rejected as the only guard; the engine also refuses any binding without a version that asks for held-out dates and logs the refusal, as it already refuses a hash mismatch.

## Consequences

- A Run that binds a Draft binds only that Draft (on one or more instruments) and is always a backtest Run; paper Runs bind versions only.
- Draft backtest Runs are listed with the Runs, marked Draft, and can never be promoted. The latest per (Draft, instrument) is kept, as is any the user pins; superseded unpinned ones are deleted after 30 days, with their log files.
- Draft backtest Runs go through an interactive queue lane ahead of the background lane that serves version Runs and the gate, so the host must fit two engine processes at once.

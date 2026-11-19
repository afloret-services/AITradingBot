# The engine talks only through files: Run spec in, event log out, command inbox

The Python engine has no network interface and never touches the database. It starts from an immutable Run spec file written by the Runs module, writes everything it sees and does to #42's append-only JSONL event log, and will take commands only from a per-Run command inbox file that it reads at safe points. The JSONL log stays the record of truth. Postgres holds a projection of it that the NestJS app can always rebuild. The paper engine runs as its own OS service, not as a child of NestJS. With this shape, a crash, deploy or database outage in the app can never touch a live Trade, a VPS reboot restarts the engine without the app, and every input that changes what the engine does is in the replayable record, so `check-paper` stays exact.

## Considered Options

- **The engine writes events straight to Postgres:** rejected because it puts the database on the live-trading path, and the Stand-down rebuild and replay would then depend on it.
- **An HTTP, gRPC or queue interface on the engine for start-up input and commands:** rejected because it opens an inbound port on the process that holds the broker connection, and a command not logged in the event log would break replay.

## Consequences

- Every event carries a sequence number per Run. The projection applies events idempotently and stops loudly on a gap or an unparseable line, never skipping.
- The Run spec, event and command types are defined once in Zod (`packages/contracts`), and the engine's Python models are generated from them.
- A command is applied only through the risk guard and is logged as `command_received` / `command_applied` / `command_rejected`. The contract is defined in v1, but no command types are enabled while the dashboard is view-only.
- Everything shown on a chart (indicators, captures, Candidates) is computed only by the engine: logged in paper, and replayed through `engine explain` for the chart review.

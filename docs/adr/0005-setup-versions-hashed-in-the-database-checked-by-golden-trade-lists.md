# Setup versions are hashed rows in the service database, checked by golden Trade lists

A Setup's Rule blocks and defaults live as JSON in the Setup service's database: one editable Draft plus immutable, numbered Setup versions, each identified by a SHA-256 hash of the canonical JSON of everything the engine reads. Nothing about a Setup is committed to the repo, because the repo is public and a Setup is the private edge being tested; a version can still be exported and imported as a JSON file, and an import is always a new Setup's Draft. This replaces #42's checked-in Promoted version files and its code hash, which no longer mean anything once Setups are data run by one evaluator ([ADR 0003](0003-setups-are-rule-blocks-not-code.md)).

## Consequences

- A Run binds `(setup_id, version, hash)` to an instrument; the engine recomputes the hash on the stored bytes and Halts on a mismatch.
- Stored versions are never rewritten. A newer schema is reached by TypeScript upgraders in the services, and the engine is given both the stored bytes (for the hash) and the upgraded current-schema JSON; the Python engine reads only the current schema.
- What the hash cannot cover, a change in evaluator code, is caught by each Promoted version's held-out Trade list per instrument: every engine release must reproduce all of them exactly before paper Runs may use it, or the version is deliberately marked "needs re-gate" and leaves paper. That check runs where the licensed history lives (the VPS), not in public CI.
- A version used by any Run is never deleted; Setups are archived instead.

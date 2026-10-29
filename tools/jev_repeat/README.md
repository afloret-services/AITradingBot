# Jev repeatability check

Checks whether a pinned Jev version returns the same probability for the same Signal input, for [Check whether pinned Jev repeats its probabilities](https://github.com/afloret-services/AITradingBot/issues/22). Throwaway: this is not bot code.

The script sends three fixed, synthetic Signal inputs shaped like the Signal filter's (1-minute bars since 09:30, prices relative to entry, time as minutes into the Window). It asks the filter's question: "Will this Trade reach its target before its stop?". Every call costs a few thousand input tokens, which is well under a cent at the reported price.

## Setup

1. Python 3.10 or later. No packages are needed.
2. Put your API key where the script can find it. Either:
   - add a line `TYPESAFE_API_KEY=...` to a `.env` file at the repo root. `.env` is gitignored, so it is never committed. Or
   - `export TYPESAFE_API_KEY=...` in your shell.

   The script never prints the key or writes it to the results.

Run every step from the repo root: `python tools/jev_repeat/jev_repeat.py <step>`. Results go to `tools/jev_repeat/jev-results/`.

## Steps

| # | Step | When | What to send back |
|---|------|------|-------------------|
| 1 | `models` | Once | The printed table: each model name and its `release_date`. On 2026-10-29 it listed only the moving aliases `jev-latest` and `jev-preview`. Versioned IDs such as `jev-1.14.0` and `jev-1.13.0` are accepted but not listed, so the version to pin is read from the `model` field of a response to `jev-latest`. |
| 2 | `repeat --model <ID>` | **Day 1** | Nothing yet. This makes 5 rounds of 3 calls, 60 s apart (about 4 minutes). |
| 3 | `repeat --model <ID>` | **Day 2**, a different calendar day, ideally a different time of day | Nothing yet. |
| 4 | `report` | After day 2 | The full printout, plus `jev-results/calls.jsonl` if anything looks odd. |

`report` shows, for each input, how many distinct probabilities came back and how far they spread, both overall and per day. It also shows which model actually answered, and latency against the bot's 5-second limit. `IDENTICAL` means every answer matched to the last digit.

## Also note down (from TypeSafe's site or your account dashboard)

- **Retirement terms:** how much notice TypeSafe gives before retiring a versioned ID, and where it announces this (a docs page, a changelog, email to account holders). Secondary sources reported 60 days for 1.13.0 and 30 days for 1.14.0, with a "fuller deprecation policy" to come. Is there now a written policy? Paste its link.
- **Release date** of the version you pinned, if the docs state it differently from `models`.
- Whether your account has rate limits or a spending cap that the bot would hit (one call per Signal, at most a few a day).

# Handoff: Setup builder prototype (ticket #76 on map #63)

Read this first in a new session. It replaces the long conversation history.

## Where things are

- Repo `afloret-services/aitradingbot`. Prototype: `prototypes/setup-builder` on branch **`prototype/setup-builder`** (throwaway, pushed, never PR'd, never merged).
- Develop branch **`ccr-2faecedc-9t16ly`** holds `GLOSSARY.md` and `docs/adr/` (ADRs 0001–0007). Edit it in a temporary worktree (`git worktree add /home/user/gl-wt origin/ccr-2faecedc-9t16ly`, then `git checkout -B ccr-2faecedc-9t16ly`), push, then remove the worktree.
- Published page: https://claude.ai/artifact/P39PAqgRC8qi5F965LLZAV (republish to that URL; the Artifact call often needs repeating once).
- Map: #63 "Wayfinder: Setup builder, trade dashboard and 5-year backtest". The ticket this prototype answers: #76 "Step-by-step builder: what building a Setup feels like" (HITL, stays open until the user answers its 5 questions).

## Run, check, publish

- Dev server: `npx vite --host 127.0.0.1 --port 5176 --strictPort` (MNQ bars in `public/data`, git-ignored: never commit them).
- Typecheck: `npx tsc -p .`. Engine sanity: a tsx script that runs the presets (Silver Bullet 2 Signals/1 filled/−1.00R, EMA 200 + MACD 10/2/−2.00R, Double bottom 35/11/−1.60R).
- Screenshots: Playwright (pre-installed), desktop 1300×900 and iPhone 13 (390 wide, `deviceScaleFactor: 1`); always check `document.documentElement.scrollWidth` equals the viewport width (no phone overflow). Hide the variant bar with `.fixed.bottom-4 {display:none!important}`; the "Hide descriptions" switch is `getByRole('switch').first()`.
- Publish: `npx vite build`, then a script that inlines `dist/assets/*.js` and `*.css` into one HTML file, then the Artifact tool on that file.
- Python heredocs piped to `python3 -` sometimes trip the shell safety check: write the script to the scratchpad with Write and run it.

## Variants (`?variant=` and `&setup=ema_macd | silver_bullet | double_bottom`)

- **A Wizard** and **B Inline**: `src/variants/VariantA.tsx` (B is A with `inline`). It exports `RunStage`, the one Create a Run screen that Lanes and Document reuse.
- **C Lanes**: `src/variants/VariantC.tsx` (library left, lane centre, inspector right; phone: inspector is a bottom sheet; `showPanel()` scrolls it to its top; in Create a Run mode the inspector shows `RunStage` with `hideCompare`, and `showRunRow(k)` scrolls to a section's override row).
- **D Document**: `src/variants/VariantB.tsx` (file name and letter differ on purpose since the 2026-11-23 reorder).
- Shared: `components/sections.tsx` (section editors, help texts, PatternList, SessionsEditor, InPositionRules), `RuleEditor.tsx` (condition lines, AND/OR, ALL OF/ANY OF, `flashNew` glow), `CondEditor.tsx`, `TokenPicker.tsx`, `InstrumentSelect.tsx` (`InstrumentMultiSelect`, the instrument search used by Create a Run and the Draft backtest, reading `src/instrumentManagement.ts`, the stand-in Instrument management module (made-up Instruments with history flags, five built-in Instrument lists; `instrumentManagement.instruments() / instrument(id) / lists() / categories()`); options `OPT:<code>:<expiry>:<strike>`), `TrialBacktest.tsx` (the "Backtest Run on this Draft" section: instruments and period; `useDraftBacktest` holds the request and last run, shared with `BacktestResults.tsx`, the "Backtest results" card that replaced "What it did on MNQ": per-instrument stats, the chart kept to the period, and the Trades list with drawdown), `runDraft.ts` (instrument warnings), `engine.ts`, `model.ts`.

## House style (keep consistent)

- Green accent: Tailwind `sky-*` is remapped to the coolors greens (#d8f3dc … #081c15). Cyan = AND / LONG / valid; amber = OR / warnings; red = errors / short; fuchsia = pattern icons.
- Standard button: `flex h-8 items-center gap-1 rounded-md border border-sky-500/50 bg-sky-500/10 px-3 text-xs font-bold uppercase tracking-wider text-sky-300 hover:bg-sky-500/20`. Section headings: `text-base font-bold tracking-tight`.
- Wizard/Inline and the Lanes inspector use the `.ctl-lg` CSS scope (bigger inputs/selects, `src/index.css`).
- Words: **Stop Loss** (never bare "stop"; "Stop Entry" is an order type), **Limit Entry**, **Stop Entry**, **Market Entry** (the three entry order types), **Take Profit** (TP1, TP2…), **Trading window**, **Market sessions**, **Trade overlap**, **Losing streak**, **Closing time**, **While in a Trade** (IF / THEN), "configure" (not "declare"), **backtest Run** (never "trial"), **Instrument** and **Instrument list** (not symbol, watchlist or saved list).

## Decided while building (also in README "Decided so far")

- Stop Loss "Measured from": a level, the entry price, or a fixed $ a contract.
- Losing streak: per Setup, stop for the day after N losers, resume next day at reduced risk (never below 1 contract).
- Stocks and options are in scope (map Notes). A Run binds the version once per picked instrument (glossary: Run, Instrument).
- **Instrument search** (settled 2026-11-27, map Notes): one search across every category (symbol matches first, then names); tabs All / Futures / Forex / Stocks / Options with counts; Recent picks and **Instrument lists** (glossary) before typing, a list adding all its instruments; All shows 5 matches per category with "Show all N", a tab pages 25 rows grouped by sub-group; instruments without 5 years of history are greyed out with the reason and cannot be picked; tags collapse after 8 ("+N more"), "Clear all"; options stay underlying first, then expiry and strike per picked option. The 158 symbols (16 futures, 20 forex, 61 stocks/ETFs, options on those 61) are made up; the real list comes from the Market data module. Recent picks live in memory only.
- Review & save has a **backtest Run on this Draft** (ADR 0007, ticket #88): build years only, listed with the Runs marked Draft, never promoted, never read by the gate. The prototype computes MNQ for real and NQ on MNQ bars at $20 a point; everything else shows "no numbers".
- Engine: Stop Entries fill on a break through the price; a bar opening past a resting price fills at its open; `run(data, setup, { pointValue })`.

## Still open (do not answer for the user)

#76's questions (also on the map and in the README; 4 is decided):
1. Which design wins: A Wizard, B Inline, C Lanes or D Document?
2. Steps in a fixed order, or edit them in any order?
3. Indicators configured up front (A, C) or on first use (B, D)?
4. ~~A Run's overrides~~: decided 2026-11-27, a per-section choice (Setup default / Override) in every design; Lanes and Document now show the Wizard's Create a Run.
5. Should a Candidate survive the 18:00 Trading-day start?

When answered: post a resolution comment on #76 and close it, add a line to the map's "Decisions so far", remove "Waiting on you", and include the decisions above.

Map tickets ready for the user (both grilling, open and unblocked):
- #91 "Stocks and options as Run instruments: sizing, hours, shorting and the gate" (#89 and #90 research are done).
- #92 "Instrument management: Instruments and Instrument lists" (filed 2026-11-27): where the module that owns Instruments and Instrument lists lives, what an Instrument holds and where each field comes from, how instruments are added and whether "has 5 years of history" is stored or computed, who makes Instrument lists (built-in, the user's, or both), what a list does with instruments lacking history, whether a list holds an option's expiry and strike rule, and what happens when a bound Instrument is edited or removed. The prototype's `src/instrumentManagement.ts` is its stand-in. It overlaps #91 on per-instrument specs.

## Rules carried over

- The user's email is private. GitHub comments end with `\n\n---\n_Generated by [Claude Code](https://claude.ai/code)_`. Commits end with the Co-Authored-By and Claude-Session lines; no model ids in commits. No PRs unless asked. Use the `mcp__github__*` tools (no `gh` CLI here).

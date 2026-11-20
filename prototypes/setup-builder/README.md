# PROTOTYPE: Step-by-step Setup builder

Throwaway, never merged. Answers [Step-by-step builder: what building a Setup feels like](https://github.com/afloret-services/AITradingBot/issues/76) on the map [Wayfinder: Setup builder, trade dashboard and 5-year backtest](https://github.com/afloret-services/AITradingBot/issues/63).

## Run it

```
cd prototypes/setup-builder
npm install
npm run dev          # http://127.0.0.1:5176/?variant=A&setup=silver_bullet
```

`npm run dev` first copies `mnq_1m.csv` (35 Trading days, 11 Sep – 29 Oct 2026, IBKR) from the `prototype/strategy-lab` branch into `public/data/`. The bars are git-ignored here and never committed (see [Remove the committed MNQ bar data from the public repo](https://github.com/afloret-services/AITradingBot/issues/82)).

## What's on the page

Three structurally different builders over one shared Setup model, switched with the floating bar at the bottom (or ← →):

- `?variant=A` **Wizard**: a fixed order of eight stages (basics → indicators → when to trade → Signal steps → entry & stop → Trade settings → review & save → create a Run), with the overview and the chart only in Review & save (your call on the ticket: the editing stages stay uncluttered). Indicators are declared in their own stage and then picked. Steps are an accordion; nesting is drawn as nested boxes. Run overrides use one row per section: Setup default / Override radio, then the same editor.
- `?variant=B` **Document**: the Setup is edited as its own Rule description, top to bottom, with every token a chip. Indicators are declared the first time a step reads them, and the sidebar lists them with labels and use counts. Nesting is an indented outline. Free text goes through a small phrase grammar ("15m close above EMA 200", "ADX(14) > 20", "MACD crosses above signal", "10:00-11:00"). Anything else gets a stubbed "Claude suggests" box to confirm. Run overrides are a diff table: default ↔ this Run, with Signal and In-position rules locked.
- `?variant=C` **Lanes**: each branch is a horizontal lane, Step → Step → Entry → Trade, with the Sequence limits written on the connectors. A block library on the left inserts into the selected card and an inspector on the right edits it. Nesting is AND/OR chips. Settings sit in a toolbar. "Create a Run" mode locks the Signal cards and lets you override Trade sections in place.

**Patterns, declared up front** (your answer on the ticket): FVG, Displacement, Order block, Leg and Market structure shift (MSS) are declared once per Setup, like indicators. Each has a name, a kind, a timeframe and its settings. A step then says "a bullish `fvg` forms" and reads what the pattern captured (`fvg.top`, `ob.bottom`, `mss.level`, `leg.start`…). The long and short branches share one declaration; only the side differs. Each pattern has two pictures: a schematic drawn from its kind and settings (it changes when you tick "middle candle is a Displacement" or "zone is the body"), and real occurrences found with those settings on the MNQ bars, which you can browse bullish or bearish. Renaming a pattern updates every step and token that reads it. Validation refuses an undeclared pattern, a duplicate name or a timeframe finer than the Base bar, and warns about an unused pattern. In A it is a section of stage 2, "Indicators & patterns"; in B a sidebar card; in C a library group plus the settings inspector. Silver Bullet now declares `fvg` (1m, gap ≥ 4 ticks, middle candle a Displacement) and gives the same Signals as before.

`?setup=silver_bullet | ema_macd | blank` picks the starting Setup. Both built Setups are the locked rules of #42, rebuilt from Rule blocks.

**Setup at a glance** (A: only in the Review & save step, with the chart under it; B: at the top): every branch as a flow, When → Step → Step → Entry → Trade. Each step card lists its conditions with a kind tag (pattern, compare, time, draw, preset), what it reads from earlier steps (`← fvg`) and what it captures (`→ draw`), and how often it completed on the bars. The connectors carry the Sequence limits ("same bar only", "within 3 bars", "until 11:00", "can be invalidated"). The Entry and Trade nodes summarise the order, stop, legs, Break-even, deadline, Flatten time and Signal guards, and each branch shows its Signals, Trades and total R. Hovering a declared indicator or pattern lights up the steps that read it; clicking a step opens it. C's lanes already are this view.

**The chart**: a legend with OHLC and every declared indicator's value under the crosshair; Trading hours shaded; only the focused step's completions as dots (all of them at once is noise). Clicking a Signal draws its pattern zones as boxes (FVG, Order block), an MSS as its broken level, a Leg as a line with its 50%, the Draw on liquidity, and the Trade as risk and reward areas with the legs. The Signal panel lists its events (each step's completion, the Signal, the fill, the exits) and replays them one at a time, hiding the bars that come after.

**Descriptions**: When to trade explains One at a time and the News rule, and every Trade-settings section (and In-position rules) explains what it does and then works it through with the Setup's own numbers (for example $5000 × 3% = $150, so a 20-point MNQ stop trades 3 contracts).

Common to all three: a live chart (TradingView Lightweight Charts) on the Base bar, with each step's completions as coloured dots, the focused step's "held alone" bars as grey squares, Signals with a rough Trade result, and the selected Signal's entry, stop, legs and draw. Also common: Draft save with warnings, Freeze → v1 (SHA-256 over what the engine reads, refused on errors or on an identical hash), Export file, a JSON view, and "duplicate as mirrored short".

## The evaluator in `src/engine.ts`

A rough evaluator, not the engine. It exists so each step shows its effect on real bars. On these bars it already reproduces `prototype/strategy-lab`:

- **Silver Bullet** (preset B): the long Signals exactly. With "duplicate as mirrored short", 2 of 3 short Signals; the extra one (10-19 10:44) wasn't chased.
- **EMA 200 + MACD** (all sessions to 16:00): 15 of 16 Signals with the same time, stop and refusal reason. The 16th (09-28 long, 20:00) is lost because Candidates end at the Trading day's end.

## What building them surfaced (for the spec and for "Evaluator on real bars")

1. **Mirroring needs to know magnitudes.** "Duplicate as mirrored short" first flipped `≥` to `≤` on range and body %, so the short Displacement asked for a small candle. Directional values (prices, levels, MACD against 0) flip. Magnitudes (range, body, body %, volume, ADX, ATR, average range, sizes, Trade R values) keep their operator. Upper and lower wick swap, and RSI mirrors around 50.
2. **In-position rules belong to a branch.** The long "close below the EMA 200" exit closed shorts too. Mirroring a branch must also mirror its In-position rules.
3. **A running capture must be able to start where a "For at least N bars" run began.** EMA 200 + MACD's pullback low covers the whole negative-histogram run, not just the bar where the step completed.
4. **A first step that keeps holding needs "ignore", not "replace".** Otherwise each bar restarts the Candidate and its running capture. Pair "ignore" with an invalidation (the histogram had turned last bar).
5. **Trading-day expiry of Candidates loses EMA 200 + MACD Signals** whose pullback spans 18:00. This needs a per-Setup (or per-step) "keeps across the Trading-day start" option.
6. **Guard order:** the stop-width Signal guard is checked before sizing, so the refusal reason matches the lab's.

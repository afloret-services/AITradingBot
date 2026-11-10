# PROTOTYPE: Strategy lab

Throwaway, never merged. One page runs several strategies over the same MNQ 1-minute bars, so their rules can be checked on the chart and their results compared. It started as the Silver Bullet detection prototype ([Prototype: Silver Bullet detection vs the chart](https://github.com/afloret-services/AITradingBot/issues/11)) on the branch `prototype/silver-bullet-detection`.

The strategies, picked in the Strategy selector:
- A–F: Silver Bullet presets;
- G: EMA 200 + MACD;
- H: OTE + OB;
- I–L: published intraday strategies ([Published intraday strategies on real bars: which become Setup candidates](https://github.com/afloret-services/AITradingBot/issues/37)).

The files:
- `strategy-lab.html`: open it in a browser (double-click) and load a CSV of MNQ 1-minute bars. Every trading day runs through the selected strategy. For each day you get:
  - a chart with its levels, entry, stop and targets;
  - a step-by-step trace;
  - review buttons.

  "Compare strategies" puts every strategy side by side on the same bars. **Export review notes** produces a Markdown table to paste into the issue. Rule settings can be changed live. "Load synthetic demo" uses made-up prices and only shows what the page draws.
- `fetch_ibkr.py`: pulls the bars from IB Gateway on the paper account. `--history 202503 202612` rolls through the quarterly contracts, giving about 2 years.
- `fetch_databento.py`: pulls the bars from Databento, showing the cost first.

The strategy logic is the `<script id="sb-logic">` block: a pure module with no DOM access. The page lists the places where it had to interpret each strategy's rules, under "The rules as this prototype implements them".

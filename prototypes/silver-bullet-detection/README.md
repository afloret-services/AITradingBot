# PROTOTYPE: Silver Bullet detection vs the chart

Throwaway. It answers one question from [Prototype: Silver Bullet detection vs the chart](https://github.com/afloret-services/AITradingBot/issues/11): **do the written Silver Bullet rules pick out the same Setups the user sees on the chart?** It is never merged.

- `silver-bullet-review.html`: open it in a browser (double-click) and load a CSV of MNQ 1-minute bars. Every trading day runs through the agreed rules. For each day you get a chart with the levels, sweep, MSS, FVGs, entry, stop and targets, a step-by-step trace, and buttons to mark the day as a match, a false hit or a missed Setup. **Export review notes** produces a Markdown table to paste into the issue. Rule settings can be changed live. "Load synthetic demo" uses made-up prices and only shows what the page draws.
- `fetch_ibkr.py`: pulls the bars from IB Gateway on the paper account.
- `fetch_databento.py`: pulls the bars from Databento, showing the cost first.

The detection logic is the `<script id="sb-logic">` block: a pure module with no DOM access. The page lists the places where it had to interpret the written rules, under "The rules as this prototype implements them".

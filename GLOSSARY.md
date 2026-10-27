# AITradingBot

An automated trading bot that spots ICT (Inner Circle Trader) setups on index futures and trades them through Interactive Brokers.

## Language

### Strategy

**Setup**:
One ICT entry pattern, written as exact rules that decide when a trade is valid, which way it goes, and where its entry, stop and target sit.
_Avoid_: Strategy (when meaning one pattern), model, play

**Signal**:
One occurrence of a Setup's rules being met on live or historical bars.
_Avoid_: Alert, trigger

**Window**:
A one-hour period of New York clock time (the Silver Bullet hour) inside which a Signal's fair value gap must form and its entry must fill.
_Avoid_: Killzone (a wider, separate ICT period), session

**Fair value gap (FVG)**:
A price range left untraded across three consecutive bars: in a bullish gap the third bar's low stays above the first bar's high, in a bearish gap the third bar's high stays below the first bar's low, and the middle bar closes in the gap's direction.
_Avoid_: Imbalance, inefficiency, gap (alone)

**Displacement**:
A middle bar of a fair value gap that is large against the bars before it and mostly body, showing price moved with force rather than drifting.
_Avoid_: Impulse, momentum candle

**Decision model**:
A pretrained model that returns a probability for a question about market bars.
_Avoid_: AI, LLM, predictor

**Signal filter**:
The step where a Decision model's probability decides whether a Signal becomes a Trade.
_Avoid_: Gate, confirmation

**Filtered Signal**:
A Signal the Signal filter declined, so no Trade was opened.
_Avoid_: Rejected, skipped trade

### Execution

**Bracket order**:
An entry order sent together with its stop-loss and take-profit orders, so the position is never open without both exits attached.
_Avoid_: OCO (that names only the two exit legs)

**Trade**:
The life of one position, from entry fill to final exit fill, opened in response to one Signal.
_Avoid_: Position (the current holding), order

**Halt**:
The bot stopping itself after something it cannot account for: it opens no new Trades, leaves existing stop and target orders in place, and waits for a human to restart it.
_Avoid_: Kill switch, pause

**Stand-down**:
The bot closing everything and opening no new Trades for the rest of the trading day, after a daily limit is hit; it resets on its own the next trading day.
_Avoid_: Halt (that needs a human), pause

**Trading capital**:
The account size the bot sizes its Trades against, set by the user rather than read from the broker's balance, and grown or shrunk only by the bot's own realised profit and loss.
_Avoid_: Balance, equity, net liquidation (the broker's figure)

**Paper account**:
The IBKR simulated account the bot trades in; no real money moves.
_Avoid_: Demo, sim

### Markets

**Micro contract**:
The 1/10-size index future (MES, MNQ) the first version trades; ES and NQ are the full-size versions of the same index.
_Avoid_: Mini (that is ES/NQ)

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

### Execution

**Bracket order**:
An entry order sent together with its stop-loss and take-profit orders, so the position is never open without both exits attached.
_Avoid_: OCO (that names only the two exit legs)

**Trade**:
The life of one position, from entry fill to final exit fill, opened in response to one Signal.
_Avoid_: Position (the current holding), order

**Paper account**:
The IBKR simulated account the bot trades in; no real money moves.
_Avoid_: Demo, sim

### Markets

**Micro contract**:
The 1/10-size index future (MES, MNQ) the first version trades; ES and NQ are the full-size versions of the same index.
_Avoid_: Mini (that is ES/NQ)

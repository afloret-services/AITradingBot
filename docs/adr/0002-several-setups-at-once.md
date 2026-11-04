# Several Setups at once, each promoted by a backtest gate and chart review

The bot is no longer built around one Setup (the Silver Bullet). After testing on the prototype, the user opened it to several Setups, ICT and indicator-based, and wants the first paper-trading version to run several of them on the same IBKR paper account at the same time. The Silver Bullet decisions already made become the rules of one Setup among others; the infrastructure decisions (IBKR, data, roll, calendars, backtest, Decision model) apply to all Setups.

A Setup reaches the Paper account only after its Promotion gate: a measurable result on the held-out last 12 months of the backtest, after costs, plus the user's review that its Trades match its written rules on the chart. This changes the backtest's role for promotion, which until now reported profit without gating on it.

## Consequences

- Running several Setups on one account and one instrument raises questions the single-Setup design did not have: how Trading capital and risk are split between Setups, whether their Trades may overlap, what happens when two Setups want opposite directions on MNQ (an account holds one net position per contract), and whether the daily Stand-down is shared. These are decided in their own tickets before the spec.
- Setups will be tuned over several sessions on the prototype before any is promoted, so the first paper version's starting set of Setups follows from the gate, not from this decision.

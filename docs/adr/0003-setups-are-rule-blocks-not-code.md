# Setups are made of Rule blocks, never code

Every Setup, including the Silver Bullet, OTE + OB and EMA 200 + MACD, is put together from Rule blocks in a step-by-step builder and stored as data; the bot engine holds no Setup-specific code and runs every Setup through one evaluator. This replaces the "one Python module per Setup" shape of [Module shape: one bot, several Setups](https://github.com/afloret-services/AITradingBot/issues/34) before any of it was built, so the user can create and change Setups without code, and a Promoted version is a frozen set of Rule blocks that can be compared line by line.

## Consequences

- Paper trading waits until the three existing Setups run as Rule blocks and pass the Promotion gate; each conversion is accepted when it reproduces the Trade list of its JavaScript backtest on `prototype/strategy-lab` on the same bars.
- Anything a Setup needs that no Rule block can express is a missing Rule block, added to the evaluator for every Setup, never a one-off module.
- Rule blocks are instrument-free: a Run binds each Setup to the instrument it trades, and the Promotion gate is passed per Setup version per instrument.

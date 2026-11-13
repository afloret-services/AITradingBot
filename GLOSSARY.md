# AITradingBot

An automated trading bot that runs several Setups at once (ICT patterns such as the Silver Bullet and OTE + OB, and indicator-based ones such as EMA 200 + MACD) on index futures and trades them through Interactive Brokers.

## Language

### Strategy

**Setup**:
One entry pattern, ICT or indicator-based, put together from Rule blocks that decide when a trade is valid, which way it goes, and where its entry, stop and target sit. The bot runs several Setups at once; each one reaches the Paper account only after passing the Promotion gate.
_Avoid_: Strategy (when meaning one pattern), model, play, built-in Setup

**Rule block**:
One configurable step of a Setup's rules, such as a price level, a candle close, an indicator value on a timeframe, a pattern, or a sequence of other Rule blocks.
_Avoid_: Step, node, condition (alone)

**Trading hours**:
A Setup's period of New York clock time (for example 08:00–16:00) inside which its Signals may form.
_Avoid_: Time window, Window (that is the one-hour Silver Bullet period), killzone

**Candidate**:
A partly formed pattern a Setup is tracking that may still become a Signal: one sequence of Rule blocks part-way done, holding the values its completed steps captured; a Setup may watch several at once, they stay inside the Setup, and each ends at its own limit or by the end of its Trading day.
_Avoid_: Setup (that is the whole set of rules), watch, pending setup

**Base bar**:
A bar of a Setup's finest timeframe; the Setup's rules are checked once at each Base bar's close, against that bar and the last closed bar of every higher timeframe.
_Avoid_: Tick, trigger bar, chart timeframe

**Promotion gate**:
The test a Setup must pass before it trades on the Paper account: a measurable result on the held-out backtest period, after costs, plus the user's review that its Trades match its written rules on the chart.
_Avoid_: Approval, sign-off

**Promoted version**:
The frozen Rule blocks and default settings of a Setup that passed its Promotion gate on one instrument, and the only rules the Paper account runs for that Setup on that instrument. Changing any Rule block or default makes a new version, which must pass the gate again; a Run's risk overrides do not.
_Avoid_: Live config, current settings

**R**:
The amount a Trade would lose if its stop were hit; every Trade is sized so that 1R is the day's risk amount, and results, expectancy and drawdowns are measured in multiples of it.
_Avoid_: Risk unit, units

**Signal**:
One occurrence of a Setup's rules being met on live or historical bars.
_Avoid_: Alert, trigger

**Window**:
A one-hour period of New York clock time (the Silver Bullet hour) inside which a Signal's fair value gap must form and its entry must fill.
_Avoid_: Killzone (a wider, separate ICT period), session, Trading hours (a Setup's wider period)

**Fair value gap (FVG)**:
A price range left untraded across three consecutive bars: in a bullish gap the third bar's low stays above the first bar's high, in a bearish gap the third bar's high stays below the first bar's low, and the middle bar closes in the gap's direction.
_Avoid_: Imbalance, inefficiency, gap (alone)

**Displacement**:
A middle bar of a fair value gap that is large against the bars before it and mostly body, showing price moved with force rather than drifting.
_Avoid_: Impulse, momentum candle

**Liquidity level**:
A named prior high or low where resting stops are expected: the previous trading day's, the Asia session's or the London session's high or low.
_Avoid_: Liquidity pool, key level, swing (that is a Swing point)

**Liquidity sweep**:
Price trading at least one tick through a Liquidity level, taking the stops resting there, on the side opposite the Trade it may lead to.
_Avoid_: Stop hunt, raid, grab

**Swing point**:
A bar whose high (or low) is beyond the highs (or lows) of a set number of bars on each side of it.
_Avoid_: Pivot, fractal

**Structure break**:
A bar of one timeframe closing beyond the most recent confirmed Swing point of that timeframe; above a swing high is bullish, below a swing low is bearish.
_Avoid_: BOS, break of structure (alone), MSS (that needs a Liquidity sweep first)

**Market structure shift (MSS)**:
After a Liquidity sweep, a bar closing beyond the most recent Swing point on the other side, showing price has turned toward the Trade's direction.
_Avoid_: Break of structure (BOS), CHoCH

**Bias**:
The one direction a trading day's Signals may take, set by the most recent daily bar closing beyond a daily Swing point: above a swing high is bullish, below a swing low is bearish. A day without one has no Signals.
_Avoid_: Daily bias (alone), trend, sentiment

**Trend**:
The direction of one timeframe's structure: up while its last two confirmed swing highs and lows are both higher than the ones before, down while both are lower, and none otherwise.
_Avoid_: Trend for price above a moving average or a strong ADX (those are indicator conditions), Bias (that is the daily direction)

**Draw on liquidity**:
The untaken Liquidity level on the Trade's side that a Signal aims at: the nearest one at least the Minimum framework away from the entry. A Liquidity level is untaken while no bar has reached it since its period ended.
_Avoid_: Target (that is an exit order's price), objective, magnet

**Minimum framework**:
The least room, in points from the entry price to the Draw on liquidity, a Signal must have; without it there is no Signal.
_Avoid_: Minimum target, room, range

**Decision model**:
A pretrained model that returns a probability for a question about market bars.
_Avoid_: AI, LLM, predictor

**Signal filter**:
The step where a Decision model's probability decides whether a Signal becomes a Trade.
_Avoid_: Gate, confirmation

**Filtered Signal**:
A Signal the Signal filter declined, so no Trade was opened.
_Avoid_: Rejected, skipped trade

**Verdict**:
One pipeline step's answer on a Signal (News-day check, Signal filter, risk guard, Trade manager): passed or declined, with the reason.
_Avoid_: Rejected, skipped, result

**Daily pick**:
A Decision model's probability, given before a Trading day's Signals, that a Setup's Trades that day will end net positive; it is only logged and decides nothing yet.
_Avoid_: Regime, Setup selection

### Execution

**Bracket order**:
An entry order sent together with its stop-loss and take-profit orders, so the position is never open without both exits attached. A Trade with several Take-profit legs sends one Bracket order per leg.
_Avoid_: OCO (that names only the two exit legs)

**Take-profit leg**:
One slice of a Trade's contracts with its own target, sent as its own Bracket order; a Trade's last leg aims at its Setup's final target (for the Silver Bullet, the Draw on liquidity).
_Avoid_: Partial (alone), scale-out, tranche

**Break-even**:
Moving the stops of a Trade's open legs to its entry price (plus a set offset) once a chosen leg has filled or price has gone a set number of R in its favour, so the rest of the Trade can no longer lose; it never loosens a stop already tighter than that.
_Avoid_: Scratch, risk-free

**In-position rule**:
A Rule block checked at each Base bar's close while a Trade or its resting entry is open, which may close the Trade, close one Take-profit leg, tighten the stop, or cancel the entry.
_Avoid_: Exit rule (alone), management rule, trailing stop

**Flatten time**:
The New York clock time by which a Setup's open Trades are closed for the Trading day, never later than its instrument allows.
_Avoid_: EOD close, cut-off

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

**Risk per Trade**:
The share of Trading capital one Trade may lose at its stop: a default on each Setup that a Run may override; applied to the Trading capital at the start of each Trading day, it gives that Setup's risk amount for the day, which is its 1R.
_Avoid_: Position size

**Peak capital**:
The highest Trading capital the bot has had at the start of any Trading day, the mark a Drawdown Halt is measured from; it moves down only when the user resets it.
_Avoid_: High-water mark, all-time high, equity peak

**Drawdown Halt**:
A Halt caused by Trading capital falling a set share below Peak capital; the bot restarts only after the user resets Peak capital, while a backtest logs it, resets Peak capital and carries on.
_Avoid_: Max drawdown (that is a backtest statistic), circuit breaker

**Paper account**:
The IBKR simulated account the bot trades in; no real money moves.
_Avoid_: Demo, sim

**Run**:
One execution of a chosen set of Setup versions, each bound to the instrument it trades, with its own risk settings: a backtest Run on history, or a paper Run on the Paper account.
_Avoid_: Trading run, deployment, job

**Paper session**:
One Trading day of a paper Run.
_Avoid_: Run (that is the whole execution), Session (that is Asia, London or New York)

**Clean session**:
A Paper session in which the bot covered every Setup's entry hours across the Trading day with no unexplained Halt (a disconnect inside the Daily reset is excused when the bot recovers cleanly), every Signal has a final Verdict, the day's replay matches what the bot did, every Trade was reviewed as matching its rules, no risk limit was breached and the net position always checked out.
_Avoid_: Good day, successful session

**Daily reset**:
IBKR's nightly maintenance window, inside the CME Trading day, during which the broker connection may drop; the bot opens nothing new until it has recovered.
_Avoid_: Daily restart (that is IB Gateway's own scheduled restart), maintenance, outage

**Drill**:
A deliberate exercise on the Paper account that forces one failure or limit (an unexpected position, a missing stop, a Stand-down, a Gateway restart) to show the bot reacts as its rules say; it trades only a built-in test Setup and never counts as a Paper session toward the Clean-session count.
_Avoid_: Test (that is the automated test suite), fire drill, chaos test

### Markets

**Trading day**:
One CME trade date: from 18:00 New York the evening before to 17:00, including any holiday-morning trading that CME counts toward it. Every daily rule (Bias, previous-day levels, daily loss, Stand-down) counts in Trading days.
_Avoid_: Session (that is Asia, London or New York), calendar day

**Session**:
One of the named periods of New York clock time a Setup can refer to: Asia (20:00–00:00), London (02:00–05:00) or New York (09:30–16:00).
_Avoid_: Cash session, killzone, Window (that is the Silver Bullet hour), Trading hours (a Setup's own period)

**Micro contract**:
The 1/10-size index future (MES, MNQ) the first version trades; ES and NQ are the full-size versions of the same index.
_Avoid_: Mini (that is ES/NQ)

**Active contract**:
The one MNQ contract month whose bars the bot analyses and whose orders it sends for a given trading day.
_Avoid_: Front month (in roll week that is still the expiring contract), continuous contract

**Roll**:
The change of Active contract from the expiring month to the next, taking effect from the first trading day on or after the Roll date.
_Avoid_: Rollover (suggests carrying a position across)

**Roll date**:
The Thursday eight days before a contract's expiry on the third Friday of its month.
_Avoid_: Expiry, roll week

**Economic release**:
One publication of a US economic report or an FOMC statement, on the date and at the New York time it actually came out; a release that was scheduled but cancelled never happened.
_Avoid_: News event, data print, red folder

**News day**:
A Trading day on which an Economic release of a type the user has switched on was published; each Setup's own news rule decides which of its Signals that day are suppressed (the whole day, only those shortly before the release, or none), and suppressed Signals are logged but open no Trade.
_Avoid_: Red-folder day, event day

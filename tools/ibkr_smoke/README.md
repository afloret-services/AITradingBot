# IBKR smoke test

Checks `ib_async` 2.1.0 against your IB Gateway on the Paper account, for [Smoke-test ib_async against IB Gateway on the paper account](https://github.com/afloret-services/AITradingBot/issues/16). Throwaway: this is not bot code.

The script only connects when every logged-in account is a Paper account (`DU...`). The `legs` step **buys 2 MNQ on paper**. Every order step ends by cancelling all open MNQ orders on the account and flattening any MNQ position.

## Setup

1. Python 3.10 or later, then `pip install ib_async==2.1.0`.
2. Start IB Gateway and log in with **Paper Trading**.
3. In Gateway, under Configure → Settings → API → Settings:
   - Enable ActiveX and Socket Clients: on
   - Read-Only API: **off**
   - Socket port: **4002**
   - Allow connections from localhost only: on
4. Write down the Gateway version from its login window or its Help/About screen.

Run every step from this folder: `python smoke_test.py <step>`. Each step writes a log to `smoke-results/`. Send me the log files, or paste their contents.

## Steps

The steps from `bars` on need the market open. Run them during New York hours (09:30–16:00) for a liquid book.

| # | Step | What it checks | What to watch |
|---|------|----------------|---------------|
| 1 | `connect` | `ib_async` 2.1.0 (protocol up to 178) connects | Prints the server version and your `DU` account. Any version or upgrade error ends the test: send it. |
| 2 | `contracts` | `reqContractDetails` for MNQ with no month | Are all listed expiries returned, or only some? |
| 3 | `bars` | `keepUpToDate` 1-minute bars and 5-second real-time bars arrive | Runs for 3 minutes (`--minutes N` to change it). Error 354 or 10167 means the Paper account doesn't share your market data. |
| 4 | `cancel-parent` | Cancelling an unfilled entry cancels both exits | The entry is 5% below the market, so it never fills. All three orders should end `Cancelled`. |
| 5 | `legs` | Two Bracket orders with the same entry and stop, sent together. A filled take-profit cancels only its own leg's stop. A working stop can be moved to Break-even. | Entry is marketable. Leg 1's take-profit is 8 ticks away (`--tp-ticks N`), and it waits up to 10 minutes for it. Expected: leg 1's stop `Cancelled`, leg 2's stop still working, then moved. Also check in the Gateway or TWS order window. |
| 6 | `reconnect` | The script disconnects and reconnects with the same client id: are its resting orders still there and still linked? | Compare the "before disconnect" and "after reconnect" order lists. |
| 7 | `watch` | Error codes and order survival when the connection breaks | Runs for 15 minutes with a resting bracket and live bars. While it runs, do **both**: (a) turn the network off for about 60 s, then back on; (b) close IB Gateway, restart it and log back in. The log records every error code (1100, 1101, 1102, 504...) and the order list after each reconnect. |

## Also note down

- Gateway version (from Setup step 4).
- Anything the Gateway window showed that the log didn't: pop-ups, warnings, order-precaution prompts.
- In step 7: whether Gateway asked you to log in again, and how long it took to come back.

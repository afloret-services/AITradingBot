# IBKR API for Python: library choice, live bars and bracket orders

Research for issue #4. Researched 2026-10-08.

**Question.** How does a Python bot drive Interactive Brokers (IBKR) to trade one Setup (Silver Bullet) on MNQ, a Micro contract, in the Paper account, through IB Gateway running on the user's own machine during trading windows? And which library should it use: `ib_async` or IBKR's official `ibapi`?

Words in **bold** follow the project glossary (Setup, Signal, Bracket order, Trade, Paper account, Micro contract). At the time of writing, `GLOSSARY.md` exists only on branch `ccr-2faecedc-9t16ly`. It is not on `main`.

## How the sources were checked

- **Library facts** come from the library source at known commits:
  - `ib_async` `main` at `ab629f3` (the 2.1.0 release, 2025-12-06)
  - `ib_async` `next` at `c9f4c14`
  - `ib_async` `next-protobuf` at `f90c33e`
  - IBC `master` at `fc6d917`
  - PyPI JSON metadata, read 2026-10-08

  These were read directly.
- **IBKR documentation facts** are less direct. The research sandbox's egress proxy refused connections to `www.interactivebrokers.com`, `ibkrcampus.com` and `interactivebrokers.github.io`. The IBKR pages are cited by their real URLs, but their content was read through search-engine extracts of those pages, not by opening them. Each claim below is something the extract attributed to that IBKR page. Re-read the page before relying on a number. Those claims are tagged **[IBKR via extract]**.
- Some claims could not be traced to a primary source at all. Those are tagged **[unverified]**.

---

## 1. Connecting to IB Gateway (Paper account)

### Ports and client ids

- **Default socket ports [IBKR via extract]:**
  - TWS live: 7496
  - TWS paper: 7497
  - IB Gateway live: 4001
  - IB Gateway paper: 4002

  The port the client connects to must match the "Socket Port" setting in Global Configuration. Source: https://www.interactivebrokers.com/docs/tws-api/doc/connectivity/introduction and https://www.interactivebrokers.com/campus/trading-lessons/installing-configuring-tws-for-the-api/
  - **The bot should therefore connect to `127.0.0.1:4002`.**
- **Port defaults differ in `ib_async`.** Its `IB.connect()` defaults to port 7497, the TWS paper port. Its README says Gateway uses 4001, which is the *live* Gateway port. Always pass the port explicitly. Source: `ib_async/ib.py` lines 329–339 and `README.md` line 109 at https://github.com/ib-api-reloaded/ib_async/blob/ab629f34c1823ea4c1542f32f07377208a86bdfd/ib_async/ib.py
- **Client ids [IBKR via extract]:**
  - Up to 32 clients can connect to one TWS/Gateway instance at the same time.
  - The client id tells API connections apart, so each connection needs its own id.
  - Client id 0 is special: it also sees orders placed by hand in TWS.

  Source: https://www.interactivebrokers.com/docs/tws-api/ref/e-client-socket-class-reference/introduction and https://www.interactivebrokers.com/docs/tws-api/doc/synchronous-api/connect-start-connection. The `ib_async` docstring makes the same point about id 0: "Setting clientId=0 will automatically merge manual TWS trading with this client" (`ib_async/ib.py` lines 349–351).
  - The bot should use one fixed, non-zero client id. Orders belong to the client id that placed them, so after a reconnect the bot must use the same id to manage its own open orders. **[unverified: the order ownership rule is widely documented but was not read on an IBKR page in this session]**
- **When the connection is ready [IBKR via extract].** With `ibapi`, the `nextValidId` callback signals that the connection is complete. "Function calls made prior to this time could be dropped by TWS." If the socket cannot be opened, the client receives error 502. Source: https://www.interactivebrokers.com/docs/tws-api/doc/connectivity/establishing-an-api-connection

### Daily and weekly restarts, and disconnects

- **Restarts [IBKR via extract]:**
  - TWS and IB Gateway are designed to restart daily, mainly to re-download contract definitions.
  - Since version 974, both have an *auto-restart* option that restarts the application daily without user action. With it, the application "can potentially run from Sunday to Sunday without re-authenticating".
  - After the Saturday-night server reset, credentials must be entered again. So expect **one manual login, with 2FA for live users, per week**.

  Source: https://www.interactivebrokers.com/docs/tws-api/doc/architecture/the-trader-workstation/the-ib-gateway and https://www.interactivebrokers.com/docs/third-party-integrations/tws-settings/best-practice-configure-tws-ib-gateway/daily-weekly-reauthentication
- **Server resets [IBKR via extract].**
  - "You are very likely to lose connectivity to our servers at least once a day due to our daily server maintenance downtime."
  - After the reset, TWS/Gateway reconnects to IBKR's servers by itself. Operating during the scheduled reset times is not recommended.

  Source: https://www.interactivebrokers.com/docs/tws-api/doc/error-handling/system-message-codes
- **Connectivity messages [IBKR via extract].** These describe the link between Gateway and IBKR's servers, not the socket between the bot and Gateway. Source: https://www.interactivebrokers.com/docs/tws-api/ref/system-message-codes

  | Code | Meaning | What the bot must do |
  |---|---|---|
  | 1100 | Connectivity between IB and TWS lost | Wait |
  | 1101 | Restored, data lost | **Resubscribe all market data** |
  | 1102 | Restored, data maintained | Nothing |

- **Real-time bars after a reset [IBKR via extract].** "It may be necessary to remake real time bars subscriptions after the IB server reset or between trading sessions." Source: https://www.interactivebrokers.com/docs/tws-api/doc/market-data-live/5-second-bars/introduction
- **Machine settings [IBKR via extract].** Sleep mode on the host causes API disconnects. IBKR recommends "Never lock Trader Workstation", "Auto restart" and a never-sleep power setting. Source: https://www.interactivebrokers.com/docs/third-party-integrations/tws-settings/best-practice-configure-tws-ib-gateway/daily-weekly-reauthentication
- **For this project.** The user starts Gateway by hand for each trading window, so the weekly re-login is not a blocker. The bot still has to survive:
  1. the daily auto-restart, if Gateway is left running overnight, which drops the API socket;
  2. 1100/1101 events during a session.

### How each library reconnects

- **`ibapi`.**
  - `EClient` sends requests. `EWrapper` receives callbacks. An `EReader` thread decodes the socket into a queue, which `app.run()` drains. In Python, `EClient` uses the `queue` module. Source: https://www.interactivebrokers.com/docs/tws-api/doc/architecture/introduction and https://www.interactivebrokers.com/campus/trading-lessons/essential-components-of-tws-api-programs/ **[IBKR via extract]**
  - The library does not reconnect by itself: the bot must detect `connectionClosed` or error 504/1100, reconnect, and replay its subscriptions. **[unverified: no IBKR page found stating "no auto-reconnect"; this is inferred from the absence of any such feature in the documented API]**
- **`ib_async`.**
  - `IB.connect()` / `connectAsync()` runs one connection and synchronises state: positions, open orders, account values and executions. Source: `ib_async/ib.py` lines 329–380, 2027–2100
  - On disconnect it emits `disconnectedEvent` and clears *all* internal state (`self.wrapper.reset()`, lines 382–408).
  - On error 1102 it resubscribes only the account summary (lines 414–418).
  - **No automatic reconnect** for a plain `IB` instance. The bot must handle `disconnectedEvent` itself, call `connectAsync` again with the same client id, and re-request bars.
- **`ib_async` Watchdog.** `Watchdog` (in `ib_async/ibcontroller.py` lines 195–300) restarts and reconnects the gateway. It needs an `IBC` controller (`IBC(974, gateway=True, tradingMode='paper')`), probes the gateway with a historical request when traffic goes idle, and restarts it on errors 100 and 1100.
  - The library itself warns: "Do not expect Watchdog to magically shield you from reality."
  - **IBC (https://github.com/IbcAlpha/IBC), which Watchdog depends on, was retired on 1 September 2026.** Its repository is archived, and it will get only bug-fix and final releases. Source: `README.md` at https://github.com/IbcAlpha/IBC/blob/fc6d917d56715ebf79a39a10b5d77fd7b701d992/README.md
  - Because the user runs Gateway by hand, the bot does not need IBC or Watchdog. **Plan for a small reconnect loop of our own.**

## 2. Live MNQ data

| API call | What arrives | Fit for an intraday bar-based Setup |
|---|---|---|
| `reqRealTimeBars` | 5-second OHLCV bars. The bar size is fixed at 5 s. `whatToShow` is `TRADES`, `MIDPOINT`, `BID` or `ASK`, and only `TRADES` has volume and VWAP. | Good. Build 1-minute (or other) bars locally. |
| `reqHistoricalData(..., keepUpToDate=True)` | A backfill of N bars, then updates of the still-forming last bar. `endDateTime` must be `''`. | Good. Gives backfill and live bars in one call. |
| `reqMktData` | Top of book and last price, as aggregated snapshots about every 250 ms for futures. Not every trade. | Fine for spread and last price. Not trade-accurate for building bars. |
| `reqTickByTickData` (`Last` / `AllLast` / `BidAsk` / `MidPoint`) | Every trade or quote. | Most precise. Tight subscription cap. Overkill unless the Setup needs tick precision. |

Sources:
- **`reqRealTimeBars`:** only 5-second bars; volume needs `TRADES`; "real time bars subscriptions combine the limitations of both top and historical market data"; "no more than 60 *new* requests for real time bars can be made in 10 minutes". https://www.interactivebrokers.com/docs/tws-api/doc/market-data-live/5-second-bars/introduction and https://www.interactivebrokers.com/docs/tws-api/doc/market-data-live/5-second-bars/request-real-time-bars **[IBKR via extract]**. The `ib_async` docstring agrees ("barSize: Must be 5"): `ib_async/ib.py` lines 1121–1155.
- **`keepUpToDate`:** "If True then a realtime subscription is started to keep the bars updated; `endDateTime` must be set empty". `ib_async/ib.py` lines 1214–1216. See also https://www.interactivebrokers.com/docs/tws-api/doc/market-data-historical/historical-bars/introduction
- **`reqMktData`:** the 250 ms figure for futures, and "not tick-by-tick but aggregated snapshots taken at intra-second intervals". https://interactivebrokers.github.io/tws-api/top_data.html (legacy page) **[IBKR via extract]**
- **Tick-by-tick [IBKR via extract]:** https://www.interactivebrokers.com/docs/tws-api/doc/market-data-live/tick-by-tick-data/introduction and https://www.interactivebrokers.com/docs/tws-api/doc/market-data-live/tick-by-tick-data/request-tick-by-tick-data
  - At most 5% of the user's market data lines can be tick-by-tick subscriptions. With the default 100 lines, that is 5.
  - At most 1 tick-by-tick request per instrument per 15 s.
  - `numberOfTicks` backfill is capped at 1000.
  - The tick type string is case-sensitive.

**Data recommendation.** Use `reqHistoricalData(MNQ future, '', '1 D', '1 min', 'TRADES', useRTH=False, keepUpToDate=True)`. Add `reqRealTimeBars(..., 5, 'TRADES', False)` if the Setup needs sub-minute timing. Either way, rebuild the subscription after a 1101 or a reconnect. Which bar size the Setup needs is a strategy decision (see open questions).

### Market data on a Paper account

- **A paper login has no market data subscriptions of its own [IBKR via extract].** It either shares the live user's subscriptions or receives delayed data. Source: https://ibkb.interactivebrokers.com/article/1719 and https://www.interactivebrokers.com/docs/general/market-data-subscriptions/market-data-users/market-data-sharing
  - Sharing is enabled from the live account, in Client Portal / Account Management settings. **[unverified: exact menu path]**
  - Each live user can share with one paper account.
- **The catch with sharing [IBKR via extract].** The live and paper sessions must be on the same device for the paper session to receive live data. If they are not, "the real trading session will be still afforded the real-time market data but the paper trading session will not receive any data". Source: https://ibkb.interactivebrokers.com/article/1719
  - In practice, logging into the live user elsewhere (a phone, or TWS on another PC) while the bot runs can starve the paper Gateway of data. **[unverified for the phone case]**
- **API market data permission [IBKR via extract].** Without the right subscription, the API returns "Requested market data requires additional subscription for API". Source: https://www.interactivebrokers.com/docs/tws-api/doc/tws-settings/tws-configuration-for-api-use/introduction
- **Still to confirm by hand:** that the user's CME subscription covers MNQ for API use. It is a CME Level 1 product, which is assumed to be covered. **[unverified]**

## 3. The MNQ contract and Bracket orders

### Defining MNQ

- **Specification:** symbol `MNQ`, `secType` `FUT`, exchange `CME`, currency `USD`. It is priced at $2 × the Nasdaq-100 index, with a minimum tick of 0.25 points ($0.50). Source: https://www.cmegroup.com/markets/equities/nasdaq/micro-e-mini-nasdaq-100.html
  - The contract months follow the March/June/September/December equity-index cycle. **[unverified at CME: the search extract came from a broker page]**
- **`lastTradeDateOrContractMonth` [IBKR via extract].** A 6-character value (`YYYYMM`) means a contract month. An 8-character value (`YYYYMMDD`) means the last trading day. Source: https://www.interactivebrokers.com/en/general/api-notes-beta.php
  - `Future('MNQ', '202612', 'CME')` names the December 2026 contract. `ib_async`'s `qualifyContracts` fills in `conId` and `localSymbol` (e.g. `MNQZ6`). Source: `ib_async/ib.py` line 680.
- **Choosing the front month.** Request contract details for `Future('MNQ', exchange='CME')` without a month. That returns every listed expiry. Sort by `lastTradeDateOrContractMonth` and pick the nearest one that is not past the bot's roll rule. The roll rule (for example, roll N days before expiry) is a spec decision. **[unverified: "returns all expiries when the month is blank" is standard API behaviour, not read on an IBKR page here]**
- **`CONTFUT` limits [IBKR via extract].** Continuous futures cannot be used for orders, live market data or historical data for a specific date. They are for historical bars only, and `endDateTime` must be empty (TWS/Gateway 10.30+). Source: https://www.interactivebrokers.com/docs/general/contracts/futures/continuous-futures and https://www.interactivebrokers.com/docs/general/changelog/2024/7/8
  - `ib_async` exposes them as `ContFuture` (`ib_async/contract.py` line 304).
  - **Do not trade or stream a `ContFuture`.**

### Bracket order mechanics

- **Mechanics [IBKR via extract].** A Bracket order is three orders:
  1. a parent (entry), sent with `transmit=False`;
  2. a take-profit limit, with `parentId = parent.orderId` and `transmit=False`;
  3. a stop-loss stop, with `parentId = parent.orderId` and `transmit=True`.

  TWS holds every order whose `transmit` is false. When the last child arrives with `transmit=True`, TWS sends the whole group. This removes the risk that the entry fills before its exits exist. Source: https://www.interactivebrokers.com/docs/general/order-types/complex-orders/bracket-orders and https://interactivebrokers.github.io/tws-api/bracket_order.html
- **IBKR's own Python sample** builds the orders the same way. Source: https://www.interactivebrokers.com/campus/ibkr-quant-news/how-to-code-a-bracket-order-in-python/
- **`ib_async.IB.bracketOrder(action, qty, limitPrice, takeProfitPrice, stopLossPrice)`** builds exactly that: a parent `LimitOrder` and take-profit `LimitOrder`, both `transmit=False`, then a `StopOrder` with `transmit=True` and the parent's `parentId`. Each gets an id from `client.getReqId()`. You then call `placeOrder` on each order in turn. Source: `ib_async/ib.py` lines 694–750.
  - The parent is always a limit order there. A market or stop entry means building the three orders yourself, which is easy.
- **OCA between the two exits.** Once the parent fills, IBKR links the child orders so that one exit filling cancels the other. **[unverified: the IBKR bracket page was not read directly; the extracts did not state this explicitly]**
  - `ib_async.bracketOrder` does not set an `ocaGroup`.
  - `IB.oneCancelsAll(orders, ocaGroup, ocaType)` exists for explicit OCA groups (lines 753–766). See also https://interactivebrokers.github.io/tws-api/oca.html
  - Confirm the OCA behaviour on the Paper account before relying on it.
- **Modify.** Call `placeOrder` again with the *same* `orderId` and changed fields, for example a new `auxPrice` on the stop to move it. `ib_async` treats this as a modify and emits `orderModifyEvent`. It asserts that the order is not already done. Source: `ib_async/ib.py` lines 780–814.
- **Cancel.** `cancelOrder(order)` (`ib_async/ib.py` lines 816–840). Cancelling an unfilled parent also cancels its children. **[unverified]**
- **Contract for orders.** Use the qualified `FUT` contract with an explicit expiry, never `CONTFUT` (see the `CONTFUT` limits above).

## 4. Pacing and other limits

| Limit | Value | Source |
|---|---|---|
| Messages from the client | Maximum requests per second = market data lines ÷ 2. With the default 100 lines, that is **50/s**. Only the request that *starts* a data stream counts. | https://www.interactivebrokers.com/docs/tws-api/doc/pacing-limitations/introduction, https://www.interactivebrokers.com/docs/tws-api/changelog/2025/1/16 **[IBKR via extract]** |
| Over-limit behaviour | A configurable "pacing behavior": either Gateway paces requests itself, or it returns error 100 and **ends the API session after 3 violations**. | https://www.interactivebrokers.com/docs/tws-api/doc/pacing-limitations/pacing-behavior **[IBKR via extract]** |
| `ib_async` throttle | Built in: by default it sends at most 45 requests per 1 s (`MaxRequests = 45`, `RequestsInterval = 1`). | `ib_async/client.py` lines 63–89 |
| Historical bars of 30 s or less | No identical request within 15 s. No 6+ requests for the same contract, exchange and tick type within 2 s. No more than 60 requests in any 10 minutes. `BID_ASK` requests count double. | https://www.interactivebrokers.com/docs/tws-api/doc/market-data-historical/historical-data-limitations/pacing-violations-for-small-bars-30-secs-or-less **[IBKR via extract]** |
| Real-time bars | At most 60 new requests per 10 minutes. Each subscription counts against market data lines. | 5-second bars introduction page above **[IBKR via extract]** |
| Market data lines | 100 by default. All active subscriptions together must fit within them. Quote Booster packs add 100 lines each. | Tick-by-tick and real-time bars pages above; https://www.interactivebrokers.com/campus/ibkr-quant-news/ibkr-market-data-from-real-time-bars-to-ticks/ **[IBKR via extract]** |
| Tick-by-tick | 5% of lines (5 by default). 1 request per instrument per 15 s. | Tick-by-tick pages above **[IBKR via extract]** |
| API connections | 32 per Gateway | Connectivity page above **[IBKR via extract]** |

One MNQ contract, one bar subscription and a handful of orders per day are far below every limit. The limits that can actually bite are:

- the 60-per-10-minute historical rule, if the bot re-requests backfill in a tight loop after reconnect failures;
- the "3 violations ends the session" rule.

## 5. Maintenance state

| | `ib_async` | `ibapi` (official) |
|---|---|---|
| Distribution | PyPI `ib_async`. **Latest release 2.1.0, uploaded 2025-12-08.** Earlier releases: 2.0.1 (2025-06-22), 1.0.3 (2024-07-06). Requires Python ≥ 3.10. BSD licence. | Downloaded from IBKR (https://interactivebrokers.github.io/), under the TWS API Non-Commercial License. You install the `source/pythonclient` folder yourself. IBKR's own PyPI package `ibapi` is **frozen at 9.81.1.post1 (2020-12-06)**. The PyPI packages `ibapi-latest` 10.51.1 and `ibapi-stable` 10.50.2 (both 2026-10-05) are an **unofficial** automated repackaging from `github.com/deepentropy/ibapi`, "NOT officially affiliated with … Interactive Brokers". |
| Activity | Release `main` last moved 2025-12-06. Branch `next` has commits through 2026-07-14 (logging, snapshot tickers, protobuf fixes). Branch `next-protobuf` has commits through 2026-08-18, and its `pyproject.toml` says version **3.0.0 (unreleased)**, built against TWS API "1046.01" and adding protobuf framing. | IBKR ships "Latest" releases often and "Stable" every few months. The changelog lists 10.45 (2026-03-25) and 10.49 (2026-08-03). Since 10.35.01 the API has used Google Protocol Buffers. Since 10.44, `Last_Size` ticks are `Decimal`. |
| Wire protocol | The 2.1.0 release negotiates server versions 157–178 (`MinClientVersion` / `MaxClientVersion`). `next-protobuf` raises the maximum to 225, with protobuf for message families 201–213. | Always current with Gateway. |
| Programming model | asyncio, event-driven. State objects (`Trade`, `Ticker`, `BarDataList`) update live. Built-in throttling and `bracketOrder` helper. Has both blocking and `async` methods. | Callback-based (`EWrapper`) plus a reader thread. You write your own request-id bookkeeping, state tracking and futures-to-callbacks glue. |
| Stewardship | A community fork of `ib_insync`, renamed after its author died in early 2024. Maintained by Matt Stancliff. `ib_insync` itself is frozen at 0.9.86 (2023-07-02). | Maintained by IBKR. |

Sources:
- PyPI JSON: https://pypi.org/pypi/ib_async/json, https://pypi.org/pypi/ibapi/json, https://pypi.org/pypi/ib_insync/json, https://pypi.org/pypi/ibapi-latest/json, https://pypi.org/pypi/ibapi-stable/json
- The unofficial disclaimer: https://pypi.org/project/ibapi-latest/
- Branch heads: `git ls-remote https://github.com/ib-api-reloaded/ib_async`
- `ib_async/client.py` line 85–89 (2.1.0); `next-protobuf` `ib_async/client.py` lines 194–196 and `pyproject.toml`
- `ib_async` `README.md` lines 551–553 (history and maintainer)
- IBKR changelog **[IBKR via extract]**: https://www.interactivebrokers.com/docs/tws-api/changelog, https://www.interactivebrokers.com/docs/tws-api/changelog/2026/8/3, https://www.interactivebrokers.com/docs/tws-api/protobuf/introduction
- Download notes: https://www.interactivebrokers.com/campus/trading-lessons/accessing-the-tws-python-api-source-code/
- IBKR warns that "clients using lower versions will likely experience prompts to upgrade … or will otherwise be restricted from access" (changelog above, **[IBKR via extract]**). It is not clear whether that applies to the *API protocol version* a client negotiates, which matters for `ib_async` 2.1.0 at max server version 178.

## 6. Recommendation

**Use `ib_async`, pinned to `ib_async==2.1.0`, and keep the IBKR-facing code behind one small module of our own** so that a switch to `ibapi` stays possible.

Reasons:

1. The bot's shape is event-driven: bars arrive, a Signal fires, a Bracket order goes out, then fills and order-status updates follow. That is exactly `ib_async`'s asyncio model. With `ibapi`, we would rebuild what `ib_async` already gives us:
   - request-id tracking;
   - live `Trade` and order state;
   - a `bracketOrder` helper whose transmit and `parentId` sequence matches IBKR's documented pattern;
   - built-in throttling under the 50/s limit;
   - state resync on connect.
2. `ibapi` is the more future-proof wire client, but it has no package on PyPI that IBKR maintains. It is installed from a licensed download, and it is callback- and thread-based.
3. The risks with `ib_async` are known and contained:
   - No release since December 2025, although the `next` and `next-protobuf` branches are active in 2026.
   - The release negotiates an older protocol version (≤178). Gateway still accepts this today **[unverified on the user's Gateway version: test this first]**.
   - No auto-reconnect without the now-retired IBC.

   Mitigations: a connect smoke test on the user's Gateway version, our own reconnect loop, and the thin module boundary.

**Fallback.** If `ib_async` 2.1.0 fails against the user's IB Gateway (protocol or version errors), first try `ib_async` from the `next` branch or a 3.x release if one has shipped. Only then fall back to `ibapi` from IBKR's download, behind the same module boundary.

## 7. Facts the spec needs

1. **Connection:** IB Gateway, Paper account login, `127.0.0.1:4002`. One fixed non-zero `clientId`, reused on every reconnect. In Gateway settings: API enabled, read-only API *off*, "Allow connections from localhost only" on.
2. **Gateway settings:** auto-restart on, never-lock on, host never sleeps. Avoid trading through IBKR's daily reset window.
3. **Reconnect behaviour the bot must implement:**
   - on `disconnectedEvent`, reconnect with backoff and the same client id;
   - after reconnect, rebuild bar subscriptions and reconcile open orders and positions;
   - on error 1101, resubscribe market data; on 1102, do nothing;
   - error 1100 means IBKR connectivity is down: do not send new entries.
4. **Market data:** the paper user shares the live user's CME subscription. **The live user must not be logged in on another device while the bot runs.** Confirm that MNQ shows live, not delayed, prices in the paper Gateway before go-live.
5. **Bars:** `reqHistoricalData(..., keepUpToDate=True)` with `TRADES`, `useRTH=False`, at the Setup's bar size. Optionally add `reqRealTimeBars` 5-second `TRADES` bars. Never use `CONTFUT` for live data or orders.
6. **Contract:** `FUT MNQ CME USD`, multiplier 2, tick 0.25 = $0.50. Pick the front month from contract details with a defined roll rule. Use a qualified `conId` for orders.
7. **Bracket order:** parent entry (`transmit=False`), take-profit `LMT` child and stop-loss `STP` child, both with `parentId = parent.orderId`. The stop goes last with `transmit=True`. Modify by re-placing with the same `orderId`. Cancel with `cancelOrder`. Verify the OCA behaviour of the children on paper.
8. **Pacing:** stay under 50 msgs/s (`ib_async` throttles at 45/s). At most 60 historical or real-time-bar requests per 10 minutes. No identical historical request within 15 s. Set pacing behaviour to "pace automatically" rather than error and disconnect.
9. **Library:** pin `ib_async==2.1.0`, Python ≥ 3.10. Record the IB Gateway version the bot was tested against.

## Open questions (candidate decision tickets)

- **Bar size and data source for the Setup:** 1-minute `keepUpToDate` bars, or 5-second real-time bars aggregated locally? This depends on how the Silver Bullet rules define the fair value gap and the entry.
- **Front-month roll rule for MNQ:** how many days before expiry the bot switches contracts. Also, should it refuse to open a Trade in the expiring contract during roll week?
- **Entry order type** for the Bracket order parent: limit (as in `ib_async.bracketOrder`), stop or market. This changes how the bracket is built.
- **What the bot does with an open Trade when the connection drops or the trading window ends:** leave the bracket working in IBKR, or flatten.
- **Gateway lifecycle:** keep a manual start per window, or automate it? IBC is retired, so automating the login is a separate decision.
- **Compatibility check:** does `ib_async` 2.1.0 (max server version 178) connect and trade cleanly against the user's current IB Gateway build? This needs a hands-on smoke test on the Paper account.

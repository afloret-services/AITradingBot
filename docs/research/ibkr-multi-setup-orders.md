# IBKR: several Setups' Bracket orders on one MNQ position

Research for issue #29. Researched 2026-11-04. Facts only. The design decision belongs to issue #30.

**Question.** Several **Setups** trade MNQ, a **Micro contract**, at the same time on one IBKR **Paper account**. Each **Trade** is one to three **Bracket orders** (one per **Take-profit leg**). What does IBKR do when these orders overlap on one net position? How can the bot keep each Setup's orders apart, map fills back to them after a reconnect, and stay inside IBKR's limits? The client is `ib_async` 2.1.0 against IB Gateway (paper port 4002).

## How the sources were checked

- **`ib_async` 2.1.0** was read directly from the wheel on PyPI (`ib_async-2.1.0-py3-none-any.whl`). Line numbers below are from that wheel. Tag: **[primary, read]**.
- **IBKR pages could not be opened.** The sandbox proxy refused `www.interactivebrokers.com`, `interactivebrokers.github.io`, `ibkrcampus.com`, `ibkb.interactivebrokers.com` and `www.ibkrguides.com` (HTTP 403 on CONNECT; WebFetch could not resolve the host). Their content was read through search-engine extracts that quote the page. Tag: **[primary, via extract]**. Re-read the page before relying on an exact number.
- Forum posts and third-party libraries are tagged **[secondary]**.
- A claim no source states, reasoned from the ones that do, is tagged **[inference]**. Things nobody answered are listed under **Unknowns**.

## Summary

| # | Question | Short answer | Strength |
|---|---|---|---|
| 1 | Can one account hold a long and a short in MNQ at once? | No. One net position per contract per account. | primary, via extract |
| 1 | Are bracket children tied to the position? | No source says they are. They are ordinary orders tied to their *parent order* by `parentId`. Each one still executes at its price whatever the net position is then. | inference from primary |
| 1 | Can one Setup's stop close (or flip) another Setup's contracts? | Yes, by the above. Nothing found says IBKR rejects or cancels it. | inference; forum reports agree |
| 2 | OCA groups | Exist on every account. Link orders only; isolate nothing. | primary |
| 2 | `orderRef` | Free text tag, kept for the order's life, returned on executions. Orders only. | primary |
| 2 | Client IDs | Up to 32 per Gateway. Orders belong to their client ID. Positions are shared. | primary, via extract |
| 2 | Models (Model Portfolios) | Described only for advisor / master accounts. Not confirmed on an individual Pro account. | primary, via extract; unknown for our account |
| 2 | Sub-accounts / second paper account | Individual account: one paper account (forum). Sub-accounts are business structures. A second *individual* account is possible and would hold its own positions. | secondary |
| 3 | What ties a fill to its order? | `permId` (stable), `clientId`+`orderId` (per client), `orderRef` (your tag), `execId` (per fill). | primary |
| 3 | Recovery after reconnect | `ib_async` clears all state on disconnect and re-syncs open orders, completed orders and executions on connect. IB Gateway returns executions only since midnight. | primary |
| 4 | Limits | 15 stacked orders per contract per side (KB) vs 20 (legacy API page): **conflict**. 10,000 active orders per account. ~50 API messages/s. `ib_async` throttles at 45 requests/s. | primary, via extract; primary, read |
| 5 | Paper account | Stops and complex orders are always simulated there. Fills may not match the exchange. | primary, via extract |

---

## 1. One net position, several Brackets

### What IBKR says

- **No long and short together.** "There is no account structure here where traders can be short and long the same underlying contract simultaneously." The article's own example of being long and short uses two separate accounts. Source: IBKR KB, "Can I be long and short the same underlying contract simultaneously?", https://ibkb.interactivebrokers.com/node/593 **[primary, via extract]**. The extract dates the example to 2009.
- **How a Bracket is built.** A Bracket uses the TWS API's attaching-orders mechanism. Children carry the parent's order id in `parentId`. The parent and early children are sent with `transmit=False`. The last child is sent with `transmit=True`, which releases the whole group. Source: https://www.interactivebrokers.com/docs/general/order-types/complex-orders/bracket-orders and https://interactivebrokers.github.io/tws-api/bracket_order.html **[primary, via extract]**.
- `ib_async` does exactly this. `IB.bracketOrder()` returns a limit parent, a limit take-profit and a stop-loss, all of the same quantity, with the two children set to `parentId=parent.orderId` and only the stop sent with `transmit=True`. It sets no `ocaGroup`. Source: `ib_async/ib.py` lines 694–750 **[primary, read]**.
- **Only one child fills.** "Only one of the two [children] … the profit taker or the stop loss, will fill." Source: IBKR guide, https://www.ibkrguides.com/iphone/attached.htm **[primary, via extract]**. No IBKR page found says *how* (an implicit OCA group, or the parent/child link). **[unknown]**

### What happens to two Setups' Brackets

No IBKR page found addresses this case directly. The facts above lead to the following. **[inference]**

- **(a) Same direction.** Setup A is long 1 MNQ. Setup B's buy bracket fills. The account is now long 2. Both brackets' children stay working: two sell limits and two sell stops, each for its own quantity. When A's stop fills, the account is long 1, and B's children are still working. Nothing found says IBKR touches B's orders.
- **(b) Opposite direction.** Setup A is long 1 MNQ with a sell stop and sell limit working. Setup B's sell bracket fills. The account is now flat. A's sell stop and sell limit are still working, and B's buy stop and buy limit are working too. If A's sell stop then triggers, it sells 1 into a flat account and the account is short 1. That short belongs to no Trade. Likewise, if B's buy stop triggers, it buys into a flat account.
- **Why this follows.** A bracket child states a side and a quantity. `ib_async`'s `Order` does have an `openClose` field (default `"O"`, `ib_async/order.py` line 61) **[primary, read]**, but `bracketOrder()` does not set it, and no IBKR source found says it limits a futures order to closing. **[unknown]** IBKR cannot hold a long and a short at once (KB 593). So the second fill nets against the first. No source found says IBKR cancels a working child when the net position goes flat.
- **Forum reports agree.** NinjaTrader users on IBKR describe a stop that stayed active after the position closed, and leftover stops filling after a reversal. Source: https://forum.ninjatrader.com/forum/ninjatrader-7/strategy-development-aa/57619-stop-orders-keep-hanging and https://forum.ninjatrader.com/forum/ninjatrader-8/strategy-development/1047438-reverse-position-close-position-stop-loss-conflicts **[secondary]**. These describe NinjaTrader's handling as well as IBKR's, so they do not isolate IBKR's behaviour.
- **Does IBKR reject or flip anything automatically?** Nothing found says it does for futures. The only automatic checks found are order precautions (size limit, error 201; price checks, error 202) and the stacking limit in section 4. Source: https://www.interactivebrokers.com/docs/tws-api/doc/orders/place-order/order-placement-considerations **[primary, via extract]**. A third-party guide says the TWS precaution "Bypass No Overfill Protection precaution for destinations where implied natively" must be ticked for OCA orders in TWS 10.25. It only suppresses a warning. Source: https://www.interactivebrokers.com/docs/tws-api/doc/tws-settings/order-precautions **[primary, via extract]** and Trade Automation Toolbox **[secondary]**.

## 2. Ways to keep Setups' orders apart

| Tool | On an individual Pro account and its paper twin? | Isolates orders? | Isolates positions? |
|---|---|---|---|
| OCA group (`ocaGroup`, `ocaType`) | Yes | It *links* orders. When one fills, the rest are cancelled or reduced. | No |
| `orderRef` | Yes | Tags them | No |
| Client ID | Yes, up to 32 connections | Yes: a client sees and changes only its own orders, unless it is the master client | No |
| Model (`modelCode`) | Not confirmed | Yes, orders carry a model code | Yes, per model, where available |
| Sub-account | No (business / advisor structures) | Yes | Yes |
| Second individual account | Yes, opened from the portal | Yes | Yes |

### OCA groups

- Orders sharing an `ocaGroup` string form one group. "The aim is to complete just one of the orders, which in turn will cause TWS to cancel the remaining orders." Source: https://interactivebrokers.github.io/tws-api/oca.html **[primary, via extract]**.
- `ocaType`: 1 = cancel all remaining orders with block; 2 = remaining orders are proportionately reduced in size with block; 3 = proportionately reduced with no block. Source: the field documentation as copied into the Rust `ibapi` crate, https://docs.rs/ibapi/latest/src/ibapi/orders.rs.html **[secondary]**. IBKR's own table was not reached. IBKR's samples use type 2. **[primary, via extract]**
- IBKR warns that, because OCA is automated, there is no guarantee a cancel or a size change reaches the exchange before another order in the group executes. Source: IBKR KB, https://ibkb.interactivebrokers.com/node/248 (as extracted) **[primary, via extract]**.
- `ib_async` has `IB.oneCancelsAll(orders, ocaGroup, ocaType)`, which only sets the two fields. Source: `ib_async/ib.py` lines 752–765 **[primary, read]**.
- An OCA group does nothing to the net position.

### `orderRef`

- Official field text: "The order reference. Intended for institutional customers only, although all customers may use it to identify the API client that sent the order when multiple API clients are running." Source: https://interactivebrokers.github.io/tws-api/classIBApi_1_1Order.html **[primary, via extract]**.
- The execution reference describes it as user-customizable, settable from the API or TWS, and associated with the order for its lifetime. It is not guaranteed unique. Source: https://www.interactivebrokers.com/docs/tws-api/ref/execution **[primary, via extract]**.
- In `ib_async`, `Order.orderRef` and `Execution.orderRef` both exist, and `openOrder` copies the broker's `orderRef` onto the cached order. Source: `ib_async/order.py` line 38, `ib_async/objects.py` line 68, `ib_async/wrapper.py` line 694 **[primary, read]**.

### Client IDs

- Up to 32 client applications per TWS / Gateway session. A duplicate client ID fails to connect. Source: https://www.interactivebrokers.com/docs/tws-api/doc/connectivity/introduction **[primary, via extract]**.
- `reqOpenOrders` returns only the orders of the calling client ID. `reqAllOpenOrders` returns open orders of all API clients, once, without a subscription. Source: https://www.interactivebrokers.com/docs/tws-api/doc/order-management/requesting-currently-active-orders/api-clients-orders and https://interactivebrokers.github.io/tws-api/open_orders.html **[primary, via extract]**.
- An order can be modified only by a client "connected to a session of TWS with the same username … and using the same API client ID". A client cannot cancel another client's single order; only `reqGlobalCancel` crosses clients, and it cancels everything. Source: https://www.interactivebrokers.com/docs/tws-api/doc/orders/modifying-orders and https://www.interactivebrokers.com/docs/tws-api/doc/orders/cancelling-an-order/cancel-individual-order **[primary, via extract]**. `ib_async`'s `reqGlobalCancel` docstring: "Cancel all active trades including those placed by other clients or TWS/IB gateway." (`ib_async/ib.py` lines 857–862) **[primary, read]**.
- **Master client ID.** Set in Global Configuration > API. That connection receives order and trade data from other API connections. Set to 0, it also sees TWS and FIX orders. Source: https://www.interactivebrokers.com/docs/tws-api/doc/order-management/master-client-id and .../client-id-0-and-the-master-client-id **[primary, via extract]**.
- **Client ID 0** can bind manual TWS orders. Since TWS 970, binding cancels and resubmits the working order, which may lose its queue place. Source: https://interactivebrokers.github.io/tws-api/modifying_orders.html **[primary, via extract]**. `ib_async` calls `reqAutoOpenOrders(True)` automatically when `clientId == 0` (`ib_async/ib.py` lines 2041–2043) **[primary, read]**.
- **Positions are not per client.** Positions come per account and contract (`wrapper.positions`: "account -> conId -> Position", `ib_async/wrapper.py` line 233–234) **[primary, read]**. No IBKR source found suggests a per-client position.

### Models (Model Portfolios)

- The TWS API "can access model portfolios in accounts where this functionality is available and a specific model has previously been setup in TWS." Orders go into a model by setting `Order.modelCode`; model positions come from `reqPositionsMulti`. Source: https://www.interactivebrokers.com/docs/tws-api/doc/financial-advisors/model-portfolios-and-the-api **[primary, via extract]**.
- The Web API docs say each account effectively has `account.Core` plus `account.<ModelName>` for each model it joins, so a model does carry its own positions. Source: https://www.interactivebrokers.com/docs/web-api/trading/financial-advisors/model-portfolios **[primary, via extract]**.
- Every IBKR page found files Models under **Financial Advisors**. None says whether an individual Pro account, or its paper twin, can create models. **[unknown]**
- `ib_async` carries `modelCode` on `Order`, `Execution` and position filters (`ib_async/order.py` line 118; `objects.py` line 71) **[primary, read]**.

### Sub-accounts and a second paper account

- "All IBKR clients have the ability to open a paper trading account", requested from the live account's portal, with its own login. Source: https://www.interactivebrokers.com/campus/trading-lessons/request-paper-trading-account/ **[primary, via extract]**.
- One paper account per individual account; multiple paper logins come with business structures such as a proprietary trading group's "Separate Trading Limit" sub-accounts. Source: QuantConnect forum, https://www.quantconnect.com/forum/discussion/11097/ib-multiple-paper-accounts/ and /discussion/1247 **[secondary]**.
- An individual client can open an additional account from the portal (Settings > Open an Additional Account). Whether it gets its own paper twin is not stated. Source: https://nomoneylah.com/2026/03/04/open-additional-account-ibkr/ **[secondary]**. **[unknown]**
- A separate account is the only tool above that, by KB 593, certainly holds its own position.

## 3. Mapping fills back to orders, and recovery

### Identifiers

| Field | Meaning | Scope | Source |
|---|---|---|---|
| `orderId` | The API client's own order number. "May not be unique to an account." | One client ID | Execution reference **[primary, via extract]** |
| `clientId` | The API client that placed the order | Account | same |
| `permId` | TWS's order id. 0 for trades from outside IB. | Account, survives reconnects | same; "permanent" is the name, not a stated guarantee |
| `orderRef` | Your tag | Order's lifetime | same |
| `execId` | One execution. Each partial fill has its own. | One fill | same |

Source: https://www.interactivebrokers.com/docs/tws-api/ref/execution and https://www.interactivebrokers.com/docs/tws-api/doc/order-management/execution-details/the-execution-object **[primary, via extract]**.

### How `ib_async` 2.1.0 keys them **[primary, read]**

- `wrapper.trades` is keyed by `(clientId, orderId)`, or by `permId` when `orderId <= 0` (a manual TWS order). `permId2Trade` maps `permId` to the same `Trade`. `fills` is keyed by `execId`. (`wrapper.py` lines 236–243, 431–437)
- `execDetails` looks the trade up by `permId` first, then by `(clientId, orderId)`. A fill with no matching trade is still stored in `fills` but attached to no `Trade`. (`wrapper.py` lines 800–845)
- `orderStatus` looks up by `(clientId, orderId)` and logs an error "No order found" otherwise. (`wrapper.py` lines 735–798)
- `openOrder` creates a `Trade` for any order it has not seen, which covers startup sync, master-client feeds and `reqAllOpenOrders`. It also bumps the next order id above any id seen, "even from other clients", to avoid "Duplicate order id". (`wrapper.py` lines 668–716)
- `completedOrder` adds completed orders keyed by `permId`. (`wrapper.py` lines 722–730)
- `Execution` carries `permId`, `clientId`, `orderId`, `orderRef`, `modelCode`, `acctNumber`. (`objects.py` lines 54–73)

### What `ib_async` exposes **[primary, read]**

- `ib.trades()`: all order trades "from this session". `ib.openTrades()`: those not in a done state. `ib.fills()` / `ib.executions()`: all fills "from this session". (`ib.py` lines 594–624)
- `ib.reqOpenOrders()`: docstring warns it "can give stale information" and recommends `openTrades()`. `ib.reqAllOpenOrders()`: "Note that the orders of other clients will not be kept in sync, use the master clientId mechanism instead." `ib.reqCompletedOrders(apiOnly)`. `ib.reqExecutions(filter)`. (`ib.py` lines 929–972)
- **On disconnect** `ib_async` "clear[s] ALL internal state", including trades, fills and positions (`ib.py` lines 382–407; `wrapper.reset()` lines 313–338).
- **On connect** it fetches positions, then open orders, then completed orders (server version ≥ 150), account updates, and last executions, "after all orders are in" (`ib.py` lines 2027–2100). So after a reconnect with the same client ID, `openTrades()` and `fills()` are rebuilt from the broker, not from memory.
- `ExecutionFilter` in `ib_async` 2.1.0 has `clientId`, `acctCode`, `time`, `symbol`, `secType`, `exchange`, `side`. It has no `lastNDays` or `specificDates` (`objects.py` lines 87–94; sent in `client.py` lines 726–738).

### What IBKR returns

- `reqExecutions` returns the current day's (since midnight) executions and commission reports. TWS can go back up to 7 days if its Trade Log "Show trades for…" setting allows; **"The IB Gateway is limited to only executions from the current trading day since midnight."** Newer protobuf filters add `lastNDays` (max 7). Source: https://www.interactivebrokers.com/docs/tws-api/doc/order-management/execution-details/request-execution-details and https://www.interactivebrokers.com/docs/tws-api/protobuf/execution-filter **[primary, via extract]**.
  - **Conflict.** One page says "since midnight"; the `execDetails` page says "the last 24 hours". Which midnight (local, New York, or the futures Trading day boundary at 18:00) is not stated. **[unknown]**
- Filtering executions by `clientId` returns only fills of orders placed by that client. Source: execution filter page **[primary, via extract]**.

## 4. Limits several Setups could hit

- **Stacked orders per contract per side.** "If the total number of stacked orders exceeds 15, new orders are rejected" (example: a 16th buy order for IBM). Source: IBKR KB "I'm receiving error messages regarding Active Order Limits", https://ibkb.interactivebrokers.com/node/518 **[primary, via extract]** (translated versions only).
  - **Conflict.** The deprecated legacy API page says "IB allows up to 20 active orders per contract per side per account." Source: https://interactivebrokers.github.io/tws-api/order_limitations.html **[primary, via extract]**. A 2009 IB notice quoted on Elite Trader set the limit to 15 **[secondary]**.
  - Neither source says whether untriggered bracket children (a sell stop and a sell limit) count as "stacked" on the sell side. **[unknown]**
  - **Count for this project [inference].** Each leg of a Trade adds one take-profit and one stop on the exit side. A long Trade with 3 legs puts 3 sell limits and 3 sell stops on MNQ, plus 3 buy entries while unfilled. Several Setups add up on the same side.
- **Active orders per account:** more than 10,000 are rejected. Same KB article **[primary, via extract]**.
- **API message rate.** Maximum requests per second = Maximum Market Data Lines ÷ 2; with the default 100 lines, 50 per second. TWS/Gateway can be set either to reject excess messages (error 100; three violations end the session) or to pace them. Source: https://www.interactivebrokers.com/docs/tws-api/doc/pacing-limitations **[primary, via extract]**. The legacy page: "50 messages per second implies a maximum of 50 orders per second". **[primary, via extract]**
- **`ib_async`'s own throttle:** `Client.MaxRequests = 45` per `RequestsInterval = 1` second; 0 disables it. (`ib_async/client.py` lines 65–86) **[primary, read]**. It is per connection. Several client IDs on one Gateway each have their own throttle. Whether IBKR's 50/s counts per client or per session is **[unknown]**.
- **Connections:** 32 clients per Gateway (section 2).
- **Order ids:** a new order id less than or equal to an earlier one is an error. Source: order placement considerations page **[primary, via extract]**.

## 5. Futures and the Paper account

- **Futures.** No "reduce only" or "close only" order option for futures was found in IBKR's docs or in `ib_async`'s `Order`. What `openClose` does for a futures order was not found **[unknown]**. KB 593 is written about futures. So for MNQ, every fill nets against the one position.
- **Paper account fills.** Paper trades use IBKR's simulator with real prices and sizes and never reach the exchange. "Stops and other complex order types are always simulated", which "may or may not" match a real exchange. Market orders with no opposite quote are held until a partial fill. Source: IBKR KB, https://ibkb.interactivebrokers.com/node/252, and https://www.ibkrguides.com/brokerportal/aboutpapertradingaccounts.htm **[primary, via extract]**.
  - So OCA and bracket-child timing on paper is IBKR's simulation, not CME's. How the simulator orders two stops at the same price is **[unknown]**.
- **Paper market data** is shared from the live user, on the same device (see `docs/research/ibkr-python-api.md` on branch `research/ibkr-python-api`) **[primary, via extract]**.
- **Accounts.** One paper account per individual account is the forum picture (section 2) **[secondary]**.
- Nothing found says the paper account changes the 15/20 stacking limit, the pacing limit or the 32-client limit. **[unknown]**

## Unknowns

1. Whether IBKR ever cancels a working bracket child when the net position goes flat. No source says it does; none says it does not.
2. How a Bracket's two children cancel each other (implicit OCA or parent/child link), and whether they show an `ocaGroup` when read back.
3. Whether an individual Pro account (and its paper twin) can create Model Portfolios.
4. Whether a second individual account comes with its own paper account.
5. Whether the stacking limit is 15 or 20, and whether untriggered stops and take-profits count toward it.
6. Whether the 50 messages/s limit is per client ID or per Gateway session.
7. Which "midnight" bounds IB Gateway's execution history, and whether it matches the CME Trading day.
8. How the paper simulator sequences several stops at one price.
9. Whether `Order.openClose` has any effect on a futures order.

All IBKR claims came through search extracts because the IBKR sites were blocked. A person with normal web access should re-read the cited pages, starting with KB 518, KB 593, the bracket-orders page and the master-client-id page.

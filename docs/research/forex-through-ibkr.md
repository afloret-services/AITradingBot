# Forex through IBKR: products, sizes, hours, brackets and market data

Resolves [Forex through IBKR: products, sizes, hours, brackets and market data](https://github.com/afloret-services/AITradingBot/issues/65), a ticket on the map [Wayfinder: Setup builder, trade dashboard and 5-year backtest](https://github.com/afloret-services/AITradingBot/issues/63). It compares forex with what [#42](https://github.com/afloret-services/AITradingBot/issues/42) assumes for MNQ. Researched on 2026-11-11 from a Claude Code cloud session.

## How the facts were checked

Read this before you rely on any number below.

- **IBKR and CME sites were blocked.** `www.interactivebrokers.com`, `ibkb.interactivebrokers.com`, the regional IBKR sites, `interactivebrokers.github.io` and `www.cmegroup.com` all failed to resolve from this session. Facts from them come from search-engine extracts of those pages. They are tagged **[IBKR via extract]** or **[CME via extract]**, with the page the extract came from. This is the same limit [#4](https://github.com/afloret-services/AITradingBot/issues/4) hit.
- **`ib_async` claims were checked first-hand** against the source at tag `v2.1.0` (commit `c9c633e3`), the version #4 pinned. They are tagged **[ib_async v2.1.0]** with file and line.
- **Inferences** drawn from several facts are tagged **[inference]**.
- **Not found** means no source said it, not that it is false. Each item marked "not found" belongs in the paper smoke test (see the end).

## Answer in short

1. **Two different products.** Spot FX (`CASH` on `IDEALPRO`) is a currency balance with no expiry, sized in base-currency units, priced as bid/ask quotes with no trades. CME FX futures (`6E`, `M6E`, ...) are futures like MNQ: whole contracts, a fixed tick value, an expiry and a Roll, and real trades with volume.
2. **M6E fits #42 almost unchanged.** It uses the same `FUT … CME` contract path, the same Bracket orders, the same Trading day (18:00–17:00 New York), very likely the same CME market data subscription as MNQ, and integer contracts at $1.25 per tick. Only the Roll dates and tick values differ.
3. **Spot FX breaks several of #42's assumptions.** There is no last price and no volume, so bars must be built from `MIDPOINT` (or `BID`/`ASK`). Orders under about USD 25,000 are odd lots with worse fills. Sizes are units, not contracts. The trading day turns at 17:00 New York, with a 17:00–17:15 break. Commission is a share of notional with a USD 2 minimum, and the spread is the main cost. Market data is free.
4. **Bracket orders on spot FX are the open risk.** `ib_async`'s `bracketOrder` builds the same parent/take-profit/stop orders for any contract. No source said whether IBKR handles stops on `IDEALPRO` natively or simulates them. Simulated stops on FX trigger on bid/ask by default. No source said whether odd-lot orders accept stops.

## 1. Products: spot FX on IDEALPRO vs CME FX futures

| | Spot FX (IDEALPRO) | CME FX futures |
| --- | --- | --- |
| API contract | `secType=CASH`, `exchange=IDEALPRO`, `symbol`=base, `currency`=quote. In `ib_async`: `Forex('EURUSD')` | `secType=FUT`, `exchange=CME`, explicit `lastTradeDateOrContractMonth`, as #42 does for MNQ |
| Size | Units of the base currency (e.g. 120,000 EUR) | Whole contracts: 6E = 125,000 EUR, M6E = 12,500 EUR |
| Tick | Half-pip by default (0.00005 on EUR.USD), 1/10 pip if enabled in Gateway | 6E 0.00005 = $6.25; M6E 0.0001 = $1.25 |
| Expiry | None; a position is just currency balances | Quarterly (Mar/Jun/Sep/Dec); a Roll rule is needed |
| Last price, volume | None | Yes, exchange trades |
| Data cost | Free | CME subscription |

Sources:
- **`Forex` contract:** `Forex(pair='EURUSD')` splits the pair into `symbol='EUR'` and `currency='USD'`, sets `secType='CASH'`, and defaults `exchange='IDEALPRO'`. It asserts `len(pair) == 6`. **[ib_async v2.1.0]** `ib_async/contract.py:336-379`.
- **6E and M6E:** M6E is 12,500 EUR with a tick of 0.0001 = $1.25. 6E is 125,000 EUR with a tick of 0.00005 = $6.25, so M6E is one tenth of 6E. Both are deliverable. M6E lists 2 consecutive quarterly months. Trading ends on the 2nd business day before the 3rd Wednesday of the contract month, at 09:16 CT. Globex codes are `6E` and `M6E`. **[CME via extract]** [Micro EUR/USD contract specs](https://cmegroup.com/trading/fx/e-micros/e-micro-euro_contractSpecs_futures.html), [Euro FX contract specs](https://cmegroup.com/content/cmegroup/en/trading/fx/g10/euro-fx_contract_specifications.html).
- **IBKR symbols for FX futures:** In TWS, Euro FX futures appear under the underlying `EUR`. A third-party forum gives `M6EH26` as an M6E local symbol. The exact `symbol`/`localSymbol` IBKR's API wants for 6E was **not found**. Resolve it with `reqContractDetails` before coding a Roll rule. (Captrader glossary; [Wealth-Lab forum](https://www.wealth-lab.com/Discussion/M6E-with-WL8-and-IB-12903), both secondary.)
- **CFDs are not an option for US residents.** IBKR offers forex CFDs to all clients except residents of the USA, Canada and Hong Kong. **[IBKR via extract]**, through a [Benzinga summary](https://www.benzinga.com/money/can-you-trade-forex-on-interactive-brokers), secondary. This doc does not cover CFDs.
- **Carry:** spot FX positions are currency balances, so a short EUR position is a negative EUR balance that is charged interest. IBKR states this for negative currency balances in general. **[IBKR via extract]** [ibkb forex tag p.3](https://ibkb.interactivebrokers.com/nl/tag/forex?page=3). No source described a separate daily rollover/swap for IDEALPRO spot (CFDs have one). That is **not found**. Because #42 flattens every Trade by 16:55, carry hardly matters intraday **[inference]**.

## 2. Minimum and odd-lot sizes, and how a 1R size rounds

- **IDEALPRO minimum:** "A minimum size of USD 25,000, or equivalent, is imposed on all IdealPro orders." Standard orders generally range from $25,000 to $7,000,000 equivalent and vary by currency, per IBKR's Forex Min/Max Order Sizes chart. **[IBKR via extract]** [Forex Basics, ibkb node 1460](https://ibkb.interactivebrokers.com/es/node/1460), [IdealPro Large-Size Order Facility, ibkb node 1708](https://ibkb.interactivebrokers.com/nl/node/1708). The per-currency chart itself was **not reached**.
- **Odd lots:** an order below the minimum is routed to the odd-lot book. Its limit price is not disclosed through IDEALPRO, even inside the spread. Odd-lot marketable orders "will generally be executed at prices only slightly inferior (1-3 ticks)", or in another IBKR article "1-2 basis points outside the IdealPro quote". IBKR re-routes an order sent to the wrong venue by size. **[IBKR via extract]** [Odd Lot FX Transactions](https://ibkb.interactivebrokers.com/tag/forex?page=2), [ibkb node 1459](https://ibkb.interactivebrokers.com/node/1459). One old forum post says the odd-lot book only works during the old "Ideal" hours. That is anecdotal ([EliteTrader](https://elitetrader.com/et/threads/ib-forex-ideal-is-gone-for-good-whats-up-what-effect.211462)).
- **Size increment:** `ContractDetails` carries `minSize`, `sizeIncrement` and `suggestedSizeIncrement`. **[ib_async v2.1.0]** `ib_async/contract.py:579-581`. Their values for a `CASH` contract were **not found**. Read them from `reqContractDetails` at start-up rather than hard-code a step.
- **Cash quantity:** the API supports `cashQty` (size in currency rather than units) for forex and crypto, and otherwise supports no fractional or cash-quantity trading. **[IBKR via extract]** [Order types: notes and limitations](https://www.interactivebrokers.com/docs/general/order-types/notes-limitations/introduction). `Order.cashQty` exists in `ib_async`. **[ib_async v2.1.0]** `ib_async/order.py:138`. Whether `cashQty` works on limit or bracket orders for `IDEALPRO` was **not found** (the crypto page limits it to IOC market orders). The bot should size in units anyway **[inference]**.

**How a 1R size rounds [inference]:**

- **Spot:** units = floor(1R ÷ (stop distance × quote-to-account rate)) to `sizeIncrement`. For EUR.USD in a USD account, 1R = $200 and a 15-pip stop (0.0015) give floor(200 ÷ 0.0015) = 133,333 EUR, about $155,000 notional. Rounding is nearly continuous, so a Trade loses at most a fraction of a dollar against its 1R. #42's "stop too wide" skip (`floor` gives 0) almost never fires. Instead there are two new limits:
  - **The odd-lot floor:** a Trade under about USD 25,000 notional is an odd lot with worse fills. The risk guard needs a rule here: skip it, or accept odd lots.
  - **A notional cap:** a tight stop asks for huge notional. #42's "max 5 MNQ" cap has no FX counterpart and should become a cap on notional or margin.
  - **Cross pairs (e.g. EUR.GBP):** the stop distance is in the quote currency, so sizing needs a live quote-to-USD rate.
- **M6E:** contracts = floor(1R ÷ (stop in ticks × $1.25)), the same formula as #42's MNQ (`× $2` per point becomes `× $1.25` per tick). The same example gives floor(200 ÷ (15 × $1.25)) = 10 contracts. Every 1R up to $18.75 for that stop rounds to 0 and gets "stop too wide". 6E is ten times as coarse.

## 3. Trading hours and the daily break

- **Spot (IDEALPRO):** "Sunday - Friday: 17:15 - 17:00 ET", so there is a 15-minute daily break, 17:00–17:15 New York. IDEALPRO metals are 18:00–17:00. **[IBKR via extract]** [Currency Trading (products-spot-currencies)](https://www.interactivebrokers.com/en/trading/products-spot-currencies.php). An IBKR PDF from 2006 gives 17:30 and is superseded. Forum posts say quotes often drop out around 17:00–17:15 and that trades after 17:00 count toward the next day. That is anecdotal ([EliteTrader](https://www.elitetrader.com/et/threads/ib-idealpro-fx-21-hours.42658/)).
- **CME FX futures:** Sunday–Friday 17:00–16:00 CT (18:00–17:00 New York), with a 60-minute daily break from 16:00 CT. **[CME via extract]** [CME Micro EUR/USD, Chinese-language page](https://www.cmegroup.com/cn-t/markets/fx/g10/e-micro-euro.html). These are the same hours as MNQ, so #42's Trading day, its Sunday-18:00 start and its 16:55 flatten carry over to M6E unchanged.
- **What changes for spot [inference]:**
  - A forex Trading day runs from 17:15 to 17:00 New York, not 18:00 to 17:00. A Run on spot could start at 17:15 on Sunday, and a 16:55 flatten still lands before the break.
  - Holidays differ. IDEALPRO has no exchange holiday calendar like CME's, and the bank-holiday schedule was **not found**. The Trading calendar needs a forex variant, or forex Runs reuse CME's calendar and accept missing a few quiet days.
  - #42's `useRTH` concept is moot for FX. Request bars with `useRTH=False`.

## 4. Bracket orders and attached stops on FX

- **The bracket shape in `ib_async` is contract-agnostic.** `IB.bracketOrder(action, quantity, limitPrice, takeProfitPrice, stopLossPrice)` makes a `LimitOrder` parent (`transmit=False`), a `LimitOrder` take-profit and a `StopOrder` stop, both with `parentId=parent.orderId`. Only the stop is sent with `transmit=True`. `quantity` is a float, so unit sizes like 133,000 pass through. **[ib_async v2.1.0]** `ib_async/ib.py:694-750`. Nothing in it is specific to futures, so #42's one-Bracket-order-per-Take-profit-leg design carries over.
- **IBKR's bracket page** describes parent plus two opposite-side children through the attached-orders mechanism, transmit `false` on all but the last. **[IBKR via extract]** [Bracket Orders](https://www.interactivebrokers.com/docs/general/order-types/complex-orders/bracket-orders). IBKR's per-product order-type matrix row for Forex (whether "Bracket"/"Attached" is marked for `CASH`) was **not reached**. A third-party guide shows a `CASH`/`IDEALPRO` bracket in Python and TWS bracket presets for Forex, which is secondary but consistent.
- **Stop triggering on FX:**
  - The API's `triggerMethod` (0 default, 1 double bid/ask, 2 last, ...) governs *simulated* stops only. If IBKR handles the stop natively, the trigger method is ignored. "If an incompatible triggerMethod and secType are used … the order may never trigger."
  - For forex, the default method is bid/ask: a buy stop triggers on the ask and a sell stop on the bid.
  - **[IBKR via extract]** [Trigger Methods](https://www.interactivebrokers.com/docs/tws-api/doc/orders/trigger-methods), [TWS stop trigger method](https://www.interactivebrokers.com.hk/php/webhelp/Making_Trades/trigger.htm).
  - Whether `STP` on `IDEALPRO` is native or simulated was **not found**.
  - **Consequence [inference]:** leave `triggerMethod` at 0 (never 2 = last, since FX has no last price). The simulated broker must trigger a long's stop on the **bid** and a short's stop on the **ask**, not on midpoint bars, or the backtest will under-count stop-outs by about half a spread.
- **Order rules:** limit orders on forex accept DAY, GTC and IOC time-in-force. Market orders: one extract says IOC only, but that statement may belong to the crypto section. **[IBKR via extract]** [IBKR API order types](https://www.interactivebrokers.com/campus/ibkr-api-page/order-types/). #42 already requires an explicit TIF. Use GTC or DAY on all bracket legs, and test what DAY means across the 17:00 turn.
- **Tick size:** forex prices default to half-pip increments, switchable to 1/10 pip under Global Configuration → Display → Ticker Row → "Allow Forex trading in 1/10 pips". A price off the increment is rejected as not conforming to the minimum price variation. IBKR's own pages are inconsistent (one says 1/5 pip, an ibkb article uses 0.0001 for EUR.USD). **[IBKR via extract]** [Minimum price increment](https://www.interactivebrokers.com/docs/tws-api/doc/orders/minimum-price-increment); NinjaTrader forum for the rejection text. Read `minTick` and `marketRuleIds` from `ContractDetails` **[ib_async v2.1.0]** `contract.py:555,574`, and use `reqMarketRule`. The Gateway's setting decides which rule applies, so pin it.
- **Stops on odd lots:** **not found**. If the bot may send odd lots, the smoke test must place a bracket under USD 25,000 on paper.

## 5. Commissions and spreads for the fill model

- **Spot commission (IBKR Pro):** 0.20 basis points × trade value, minimum **USD 2.00 per order**, for monthly volume up to USD 1bn. The rate falls to 0.08 bp in higher tiers. **[IBKR via extract]** [Commissions Spot Currencies (UK)](https://www.interactivebrokers.co.uk/en/pricing/commissions-spot-currencies.php), [(IE)](https://www.interactivebrokers.ie/en/pricing/commissions-spot-currencies.php). The US page was not reached. Rates also differ by entity (the AU page says 0.22 bp).
  - The example Trade above (~$155,000) costs 0.2 bp × 155,000 = $3.10 per side.
  - A $25,000 order hits the $2 minimum, an effective 0.8 bp per side.
  - Every Take-profit leg is its own order, so each leg pays its own minimum.
  - **[inference]** Model the cost as `max($2, 0.00002 × notional_usd)` per order per side.
- **Spread:**
  - IDEALPRO is an order book fed by banks and other clients **[IBKR via extract]**. Its typical spread for EUR.USD was **not found** in a primary source.
  - **[inference]** Don't model the spread from a constant. Record `BID` and `ASK` (or `BID_ASK`) bars beside `MIDPOINT` and fill from them: a long's limit entry fills when the **ask** trades to it, its stop triggers on the **bid**, and its take-profit fills when the **bid** reaches it. #42's "1-tick trade-through" rule has no meaning without trades. Replace it with "the quote crosses the limit".
  - Odd lots add 1–3 ticks or 1–2 bp (above).
- **M6E costs:** IBKR's CME fee page lists exchange-fee recovery for e-micro FX futures at USD 0.24 per contract, plus a regulatory fee of about USD 0.01–0.02. **[IBKR via extract]** [Fees charged to offset CME fees](https://interactivebrokers.com/en/accounts/fees/CME.php). IBKR's own execution commission for micro FX futures was **not found**. #42 already has "IBKR tiered per contract per side, to be checked", and M6E needs the same check. The spread is one tick ($1.25) or more, as for MNQ.

## 6. Margin

- **Spot:**
  - A US account (IBKR LLC) gets at most 50:1 leverage on major pairs (2%) and 20:1 on others (5%), the CFTC/NFA retail forex caps. IBKR LLC is an NFA Forex Dealer Member. Secondary sources ([CompareForexBrokers](https://www.compareforexbrokers.com/us/ibkr-review/), [Benzinga](https://benzinga.com/money/forex-margin-requirements-by-broker)); IBKR's US page was **not found**.
  - Non-US IBKR entities set margin per currency (e.g. 2.5% USD and EUR up to 10% NZD), applied to the net value held in each non-base currency. **[IBKR via extract]** [Forex Margin Requirements (IE)](https://interactivebrokers.ie/en/trading/margin-forex.php).
  - Which entity the user's account is under decides the rate.
- **M6E:** set by CME and IBKR per contract. No current number was found, so read it from `whatIfOrder` at start-up, as for MNQ **[inference]**.
- **What it means for the risk guard [inference]:** at 2% margin, the $155,000 example needs about $3,100 margin. With several Setups and tight stops, notional can pass what the account carries. Spot needs a margin or notional cap, and #42's 10-contract total cap has to be expressed per instrument.

## 7. Market data subscriptions and their cost

- **Spot is free.** "Forex and Cryptocurrencies do not require any additional market data subscriptions to receive market data." **[IBKR via extract]** [Market data subscriptions](https://www.interactivebrokers.com/docs/general/market-data-subscriptions). IBKR's third-party FAQ says the same about forex, bonds and index CFDs.
- **No trades, no last price, no volume:**
  - IBKR: there is "no official 'Last Price' for Forex" because OTC FX has no tape. TWS shows the last midpoint instead. **[IBKR via extract]** [Why is there no "Last" price for Forex pairs? (ibkb 1425)](https://ibkb.interactivebrokers.com/hu/node/1425).
  - Historical requests on `IDEALPRO` reject `whatToShow='TRADES'`. Use `MIDPOINT`, `BID`, `ASK` or `BID_ASK` ([IB-Matlab guide](https://undocumentedmatlab.com/files/IB-Matlab_User_Guide/IB-Matlab_User_Guide-20.html), secondary).
  - `reqHistoricalData` accepts these values **[ib_async v2.1.0]** `ib.py:1202-1206`. `reqRealTimeBars` accepts `MIDPOINT`, `BID` and `ASK` **[ib_async v2.1.0]** `ib.py:1137-1138`.
- **CME FX futures:** M6E is on CME like MNQ. IBKR's CME real-time subscription covers the CME exchange, so if the user already pays for MNQ's CME data, M6E and 6E come with it **[inference]**. The exact bundle the user has and its price is the map's separate "Live market data per instrument" question.
- **Paper:** paper accounts get data only through the live user's subscriptions shared to them (#4). Spot needs no subscription, so it should stream on paper without one **[inference, test it]**.
- **History for the 5-year backtest [inference]:**
  - IBKR's `MIDPOINT` history is bars of quotes, not trades. The map's planned Databento GLBX.MDP3 source ([#5](https://github.com/afloret-services/AITradingBot/issues/5)) covers CME FX futures (6E/M6E), not spot.
  - Spot history needs either IBKR `MIDPOINT`/`BID_ASK` bars (subject to #4's pacing limits) or another source.
  - Historical ticks are kept only for about 3 years **[IBKR via extract]** [historical ticks](https://www.interactivebrokers.com/docs/tws-api/doc/md/historical-ticks).
  - How far back IBKR's 1-minute FX bars go was **not found**.

## 8. `ib_async` quirks for forex

All **[ib_async v2.1.0]** unless tagged.

- **Price on a forex `Ticker`:** `ticker.last` stays `nan` for forex. `Ticker.midpoint()` returns (bid+ask)/2, or `nan` with no valid bid/ask (`ticker.py:274-279`). `Ticker.marketPrice()` returns last when it lies inside the spread, otherwise the midpoint (`ticker.py:281-296`). For forex, use `midpoint()` explicitly. The `nan`-last behaviour is from the ib_insync notebook ([tick_data.ipynb](https://nbviewer.org/github/erdewit/ib_insync/blob/master/notebooks/tick_data.ipynb), the parent project).
- **Tick-by-tick:** `reqTickByTickData` supports `'BidAsk'` and `'MidPoint'`, not `'Last'`/`'AllLast'`, for forex (`ib.py:1464`). The rejection of last ticks for `CASH` comes from a forum report ([EliteTrader](https://www.elitetrader.com/et/threads/tws-api-reqmktdata-doesnt-work-properly.341678)).
- **Volume:** bars from `MIDPOINT` carry no meaningful volume. Any Rule block that reads volume can't run on spot FX **[inference]**.
- **`Forex()` defaults:** the default exchange is `IDEALPRO`, and the pair string must be exactly 6 letters. Qualify the contract with `qualifyContracts` like any other.
- **Size fields:** `Order.totalQuantity` is a float and `Order.cashQty` exists (`order.py:29,138`).
- **Bracket orders:** the same `bracketOrder` as for futures (above). #4's protocol-178 cap and lack of a reconnect apply unchanged.

## What this means for the map

- **Pick M6E first if the goal is "forex" with the least new code [inference].** It reuses #42's futures path, Trading day, flatten, Roll machinery and probably the CME data subscription. Its sizing granularity at $1.25 per tick is fine for 1R in the hundreds of dollars. It also has real volume and trades, and Databento history.
- **Spot FX needs these changes to #42's design:**
  1. A quote-based bar source (`MIDPOINT` plus `BID`/`ASK`) and a fill model on bid/ask instead of trade-through.
  2. Unit sizing with `sizeIncrement`, an odd-lot rule and a notional/margin cap in place of contract caps.
  3. A 17:15–17:00 forex Trading day and a holiday calendar.
  4. A commission model of `max($2, 0.2 bp)` per order.
  5. Cross-rate conversion for non-USD pairs.
  6. Smoke tests for brackets and stops on `IDEALPRO`.

## To verify on the paper account

Add these to [Smoke-test ib_async against IB Gateway on the paper account](https://github.com/afloret-services/AITradingBot/issues/16), or to a forex follow-up:

1. **Contract details:** `reqContractDetails(Forex('EURUSD'))` returns `minTick`, `minSize`, `sizeIncrement` and `marketRuleIds`. Also check the IBKR symbol and local symbol for 6E and M6E.
2. **Bracket orders:** a full Bracket order on `EUR.USD` at about 30,000 EUR and at about 10,000 EUR (odd lot). Are both accepted? Is the stop native or simulated (TWS order status shows it)? Does a filled target cancel the stop? Does cancelling the parent cancel both children?
3. **Streaming without a subscription:** `reqMktData` and `reqHistoricalData(keepUpToDate=True, whatToShow='MIDPOINT')` on paper with no forex subscription.
4. **The 17:00–17:15 break:** what happens to resting GTC and DAY bracket legs across it, and whether the data stream pauses.
5. **Margin and commission:** `whatIfOrder` margin for spot and M6E, and the commission shown for a $30,000 spot order and 1 M6E.

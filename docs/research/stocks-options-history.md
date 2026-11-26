# 5-year history for US stocks and options: sources, cost and licence

Resolves [5-year history for US stocks and options: source, cost and licence](https://github.com/afloret-services/AITradingBot/issues/89). Researched on 2026-11-26 from a Claude Code cloud session. The futures and forex answer is in [#64](https://github.com/afloret-services/AITradingBot/issues/64#issuecomment-6805072066).

**How this was checked.** The session's network blocks the vendor sites (`databento.com`, `massive.com`, `www.thetadata.net` would not resolve), so no page was opened first-hand. Every fact below comes from **search extracts limited to the vendor's own domain** (its docs, price page, blog, knowledge base or legal pages). Search extracts are summaries, not the page text, so every price and licence clause here is **unverified until someone opens the cited page**. Nothing was downloaded and no `get_cost` quote was run. Estimates of my own are marked *(estimate)*.

The 5-year window as of today is **2021-12 to 2026-11**: 4 years to build and tune, the last 12 months (2025-12 to 2026-11) held out for the Promotion gate.

## Verdict

| Need | Recommended | Cost | Licence for a private bot on a VPS |
| --- | --- | --- | --- |
| Stock/ETF 1-minute bars, 5 years | **IBKR** first (free, same feed as live); verify depth with one request per symbol. Fallback: **Massive Stocks Starter** or **Databento Equities Standard** for one month | IBKR: market-data subscriptions only. Massive: $29/month. Databento: $199/month | IBKR: own account use. Massive individual plan: personal, non-business use; "display use only" clause is an open question. Databento: historical data needs no venue licence; internal use |
| Option chains, 1-minute NBBO, 5 years | **ThetaData Options Value** (from 2020-01-01, 1-minute quotes) or **Standard** (from 2016, tick quotes, first-order Greeks) | $40 or $80/month, **kept running for as long as the data is kept** | Personal use only; **data must be deleted within 30 days of cancelling** |
| Same, kept outright | **Databento OPRA.PILLAR `cbbo-1m`** (from 2013-04-01) | Usage-based; price per GB not found. Run `get_cost` first. Standard plan $199/month; whether it includes `cbbo-1m` history is unverified | Historical data needs no venue licence; internal use; no redistribution |
| End-of-day chains only | **Cboe DataShop Option EOD Summary** (15:45 snapshot, optional IV/Greeks), or ThetaData's EOD endpoint | DataShop price not found; ThetaData EOD is in every tier (free tier 1-day delayed) | DataShop terms not checked |

**Bottom line.** 1-minute option prices for 5 years are affordable: ThetaData Value at $40/month covers 2020-01-01 onward with 1-minute quotes, so the whole 2021-12 window. The catch is the licence, not the price: ThetaData's subscriber agreement makes you delete the data within 30 days of cancelling, so the backtest store costs $40–80 every month for as long as it exists. Databento is the "buy once, keep" alternative for options, at a price that must be quoted with `get_cost` before buying.

## Stocks and ETFs (SPY, QQQ, AAPL, NVDA, TSLA)

### IBKR historical data

- **1-minute depth.** The TWS API's historical-limitations page says the limits "for barSize = "1 mins" and greater have been lifted". Only bars of 30 seconds or less older than six months are unavailable. A soft throttle still applies to large requests. ([TWS API: Historical Data Limitations](https://interactivebrokers.github.io/tws-api/historical_limitations.html))
- **Request size.** A 1-minute request can span at most `86400 S` / `365 D` / `52 W` / `12 M`, so 5 years per symbol means at least 5 requests, more in practice with pacing. ([Max Duration Per Bar Size](https://www.interactivebrokers.com/docs/tws-api/doc/market-data-historical/historical-bars/max-duration-per-bar-size))
- **How far back.** An IBKR study note from 2018 says common stocks typically have "at least 5-10 years" at large bar sizes; it does not promise 5 years at 1 minute. **Unverified: run `reqHeadTimestamp` and one 2021-12 request per symbol.** ([IBKR webinar notes](https://cdcdyn.interactivebrokers.com/webinars/TA-2018-TWS-Python-Receiving-Market-Data-Study-Notes.pdf))
- **Expired options: none.** IBKR lists expired options as unavailable historical data, whatever the bar size. IBKR can never supply the option history. ([Unavailable Historical Data](https://www.interactivebrokers.com/docs/web-api/v1/endpoints/market-data/unavailable-historical-data), [IBKR Campus: Historical Options & Futures Data](https://www.interactivebrokers.com/campus/ibkr-quant-news/historical-options-futures-data-using-tws-api/))
- **Corporate actions, consolidated vs venue:** not checked in this session. From memory only, IBKR offers an `ADJUSTED_LAST` bar type and its `TRADES` bars follow the consolidated tape; **both unverified**.
- **Live:** yes, it is the bot's broker.

### Massive (formerly Polygon.io)

- **Plans (individual use):** Stocks Starter $29/month (aggregates, 15-minute delayed), Developer $79/month, Advanced $199/month (real-time). Business $2,499/month. One pricing snapshot gives Starter 5 years of history; the stocks page says 20+ years with trades and quotes back to 2003. **History per tier unverified.** ([Pricing](https://massive.com/pricing), [Stocks](https://massive.com/stocks))
- **Feed:** consolidated SIP. Stock quotes flat files total 1.66 TB for 2026 so far; **stock minute-aggregate flat files 5.8 GB for 2026 so far** (all US stocks). ([Quotes flat files](https://massive.com/docs/flat-files/stocks/quotes), [Minute aggregates flat files](https://massive.com/docs/flat-files/stocks/minute-aggregates))
- **Corporate actions:** aggregates are split-adjusted by default (`adjusted=false` gives raw); **dividends are never adjusted**; tick data and flat files are never adjusted. Massive's own advice for a permanent store is to keep `adjusted=false` and apply splits yourself from the splits endpoint (`historical_adjustment_factor`). ([KB: adjusted for splits or dividends?](https://massive.com/knowledge-base/article/is-massives-stock-data-adjusted-for-splits-or-dividends), [Splits](https://massive.com/docs/rest/stocks/corporate-actions/splits))
- **API:** REST (`/v2/aggs/...`), WebSocket, and S3 flat files.
- **Licence:** the individual terms grant use "solely for personal, non-commercial, and non-business purposes". A Massive FAQ says the individual plan covers your own research, scripts or trading and ends when the data reaches another person's screen. **But** the Market Data Terms say market data "is strictly for display use only unless a separate agreement says otherwise", and Section 8 (what happens to downloaded data when the plan ends) was not retrieved. Whether an automated backtest counts as display use is **an open question to put to Massive**. ([Individuals ToS](https://massive.com/legal/individuals-terms-of-service), [Market Data ToS](https://massive.com/legal/market-data-terms-of-service), [KB: show data in my own app](https://massive.com/knowledge-base/article/which-plan-do-i-need-to-show-massive-data-in-my-app))
- **Live:** yes (Advanced).

### Databento equities

- **Standard plan $199/month.** A January 2025 pricing post says Standard users get "unlimited access to the entire history of OHLCV-1s/-1m, definitions, statistics, and status data for US equities". The older launch post said 7 years of OHLCV. Either way, **one month buys all 5 years of 1-minute and 1-second bars.** ([Upcoming changes to pricing plans in January 2025](https://databento.com/blog/upcoming-changes-to-pricing-plans-in-january-2025), [Introducing Databento US Equities](https://databento.com/blog/introducing-databento-us-equities))
- **Single venue vs consolidated — the snag.** `XNAS.ITCH` (Nasdaq TotalView) starts 2018-05-01, so covers the window, but it is **Nasdaq-only**: its bars miss trades on NYSE, Cboe and off-exchange venues. The blended **`EQUS.MINI` starts only 2023-03-28**, so it misses the first ~15 months of the window. `EQUS.SUMMARY` is end-of-day consolidated; its start date was not found. Whether a consolidated 1-minute dataset (e.g. `EQUS.ALL`) reaches 2021 is **unverified: call `metadata.get_dataset_range`**. ([XNAS.ITCH](https://databento.com/datasets/XNAS.ITCH), [EQUS.MINI now available](https://databento.com/blog/databento-us-equities-mini-now-available), [Datasets](https://databento.com/docs/api-reference-historical/basics/datasets))
- **Corporate actions:** bars are raw; a separate **adjustment-factors** dataset (since 2018, one combined ratio per day, `Apply`/`Rescind`/`Pending` status) is applied by you. ([Adjustment factors](https://databento.com/docs/datasets/adjustment-factors), [multiple stocks example](https://databento.com/docs/examples/adjustment-factors/multiple-adjustment-factors))
- **Licence:** "you do NOT need a license to access historical (T+1) data"; internal use is any use "within the licensed company or individual user's private environment". No external redistribution. ([Introduction to market data licensing](https://databento.com/blog/introduction-market-data-licensing), [Live data guide](https://databento.com/docs/portal/live-data))
- **API:** same Python client and DBN/Parquet output as the futures data already chosen in #64. **Live:** yes, with Standard or above.

### ThetaData stocks

- Nasdaq-listed (UTP tape) names from 2012; NYSE-tape (CTA) names such as **SPY only from 2020-01-01**. Both cover the window. Stock plan prices and split handling were not found. ([Subscriptions](https://thetadata.net/docs/Articles/Getting-Started/Subscriptions.html))

### Stocks: recommendation

Try IBKR first: free, consolidated (unverified), and the same source the bot trades on. If `reqHeadTimestamp` or a 2021-12 request fails, buy **one month of Massive Stocks Starter ($29)** for consolidated SIP minute bars, or **one month of Databento Equities Standard ($199)** if a consolidated dataset reaches 2021 (otherwise its Nasdaq-only bars are a poor stand-in for SPY). Store **raw prices plus split and dividend records**, and adjust in the engine, so stored files never change.

## Options on the same names

### ThetaData

- **Plans:** Options Value $40/month, Standard $80/month, Pro $160/month. ([Pricing](https://www.thetadata.net/pricing))
- **History:** Value from 2020-01-01, Standard from 2016-01-01, Pro from 2012-06-01. **Value already covers the 5-year window.** ([Subscriptions](https://thetadata.net/docs/Articles/Getting-Started/Subscriptions.html))
- **Granularity:** Value has quote history at 1-minute; Standard and Pro at tick level. 1-minute OHLC (trade) bars from Value up. Multi-day requests are capped at one month; sub-minute intervals only for single days. Flat files offer per-day option EOD and 1-minute quote exports (last quote of each minute). ([option history OHLC](https://thetadata.net/docs/operations_excel/option_history_ohlc.html), [option EOD](https://thetadata.net/docs/operations/option_history_eod.html), [Flat Files](https://thetadata.net/docs/Flat-Files/Getting-Started))
- **Greeks/IV:** first-order Greeks from Standard; second/third-order and trade Greeks on Pro only. On Value they must be computed. For 0DTE Greeks the v3 API offers a fixed 0.15 DTE or real time-to-expiry down to 1 hour. ([Subscriptions](https://thetadata.net/docs/Articles/Getting-Started/Subscriptions.html), [greeks endpoint](https://thetadata.net/docs/operations/option_history_trade_greeks_all.html))
- **EOD:** ThetaData builds its own national EOD at 17:15 ET, because OPRA publishes none; the free tier gets it 1-day delayed.
- **API shape:** a local "Theta Terminal" process that the client calls over HTTP; requests are per expiration/strike/right, or `expiration=*` day by day. (Terminal is a Java process, from memory; **unverified**.)
- **Licence:** individual tier is "personal use only, no redistribution or business use"; licence is for one individual user; general terms restrict "archiving or downloading"; and the subscriber agreement requires that **data be expunged within 30 days of termination**, derived works included. A private bot on a VPS trading the owner's own account looks like personal use; **the archiving clause and the expunge clause mean the stored history is rented, not owned**. ([Subscriber agreement](https://www.thetadata.net/subscriber-agreement), [Terms](https://www.thetadata.net/terms-and-conditions), [Commercial use](https://www.thetadata.net/commercial-use))
- **Live:** yes, real-time OPRA streaming on paid tiers (per-tier details not checked).

### Databento OPRA.PILLAR

- **History:** since 2025-05-21 the dataset reaches **2013-04-01** for trades, OHLCV, statistics, definitions and **`cbbo-1m`** (consolidated NBBO and last sale at 1-minute intervals). Other schemas (tick quotes, `mbp-1`) start 2023-03-28. ([OPRA improvements](https://databento.com/blog/opra-improvements-coming-soon), [New OPRA pricing plans](https://databento.com/blog/introducing-new-opra-pricing-plans))
- **Price:** usage-based, quoted exactly by `metadata.get_cost` before any download; a **Standard OPRA plan at $199/month** started 2025-06-03. **Which OPRA history the Standard plan includes, and the per-GB rate for `cbbo-1m`, were not found.** ([Metered pricing](https://databento.com/docs/api-historical/basics/metered-pricing), [get_cost](https://databento.com/docs/api-historical/metadata/metadata-get-cost))
- **Greeks/IV:** not provided; compute them (needs a rate curve and dividends).
- **Licence:** as for equities: historical data needs no venue licence; internal use; no redistribution. **No expunge clause was found**, but the order form terms were not read.
- **API:** same client and symbology as #64; request by parent (`SPY.OPT`) with the `definition` schema, then filter strikes/expiries. **Live:** yes, Standard or above.

### Massive options

- **Plans:** Options Basic free (EOD, 2 years); Starter $29 (minute aggregates, 15-minute delayed, 2 years); Developer $79 (trades, 4 years); Advanced $199 (real-time, quotes, "5+ years" = all history). ([Pricing](https://massive.com/pricing?product=options))
- **History:** aggregates and trades from 2014-06-02, **quotes only from 2022-03-07**. Today that is 4 years 8 months, so **quotes miss the first ~3 months of the 5-year window** (they will cover it from 2027-03). Minute bars below Advanced are built from trades, so no bid/ask. ([KB: how much history](https://massive.com/knowledge-base/article/how-much-historical-stock-data-does-massive-have), [Options for business](https://massive.com/business-options))
- **Licence:** same individual terms and "display use only" question as for stocks.

### Cboe DataShop

- **Option EOD Summary:** per-symbol daily files for US-listed equity, ETF and index options from OPRA, with a **15:45 snapshot** of bid/ask (taken at 12:45 on half days) and optional **15:45 IV and Greeks ("Calcs")**. History from 2012 (product page) or 2010 (FAQ). Bought as a historical order or a subscription; one file per day or per month. ([Option EOD Summary](https://datashop.cboe.com/option-eod-summary), [layout PDF](https://datashop.cboe.com/documents/Option_EOD_Summary_Layout.pdf), [FAQ](https://datashop.cboe.com/faqs))
- **Price: not found.** DataShop also sells intraday option trades with calcs by monthly subscription; price not found. **Licence: not checked.**
- **Live:** no; it is a historical shop.

### Others

Not researched in this session: ORATS (EOD and 1-minute option snapshots with IV), Alpaca (option history only from 2024, from memory), IVolatility, Historical Option Data. Worth a look only if ThetaData's retention terms and Databento's quote both fail.

## 0DTE

All OPRA-derived sources above carry every listed expiration, so 0DTE is covered wherever the history covers the date. Which days have a 0DTE depends on the listing, not the vendor: SPY and QQQ list daily expirations; AAPL, NVDA and TSLA list weeklies, so 0DTE only on Fridays. When SPY and QQQ got Monday-to-Thursday expirations (2022 from memory) was **not verified**; it sets how much of the window has daily 0DTE.

## Storage estimate for 5 years of chains, five underlyings *(estimate)*

Assumptions: ~25,000 live contracts across the five names on a typical day (SPY and QQQ ~8,000 and ~6,000, the three stocks ~3,000–4,000 each); 1,255 trading days; ~64 bytes per 1-minute NBBO row (timestamp, instrument, bid, ask, two sizes); columnar Parquet with zstd at ~5x.

| What | Rows | Raw | Stored |
| --- | --- | --- | --- |
| Every contract, every minute | 25,000 × 390 × 1,255 ≈ 12 billion | ~780 GB | **~150 GB** |
| Strikes within ±15% of spot, expiry ≤ 45 days | ~1/6 of the above | ~130 GB | **~25 GB** |
| End-of-day, every contract | 25,000 × 1,255 ≈ 31 million | ~3 GB | **< 1 GB** |
| Underlying 1-minute bars (5 names) | 5 × 390 × 1,255 ≈ 2.4 million | ~0.2 GB | **< 0.1 GB** |

Illiquid contracts quote less than once a minute, which lowers the first row if the vendor prints only minutes with a change (not verified for either vendor). A filtered ~25 GB store fits a small VPS; the full one does not need to be kept. Check the estimate against one real day before sizing the disk.

## If 1-minute option data were not affordable

It is affordable (ThetaData Value $40/month), but the honest fallbacks, cheapest first, and what each costs the Promotion gate:

1. **Modelled option prices** (Black-Scholes or similar on the underlying's 1-minute bars, IV from VIX/VXN or a fixed surface). Free. **Costs the gate most:** the fills, the spread and the skew are invented, and 0DTE pricing is where models are worst. A gate passed on modelled prices proves only the underlying signal, not the option trade. Only acceptable to rank Setups, never to promote one.
2. **End-of-day chains** (Cboe 15:45 snapshot or ThetaData EOD). Cheap. Fine for Setups that enter and exit near the close or hold for days; **useless for intraday and 0DTE**, since the entry and exit minutes have no price. The gate must reject any intraday option Setup tested this way.
3. **Shorter history** (Massive Advanced quotes from 2022-03-07, or Databento tick quotes from 2023-03-28). Real bid/ask, but fewer years: today Massive misses ~3 months of the build period, Databento ~16 months. Holding out the last 12 months still works; tuning on 3–4 years instead of 4 weakens the robustness evidence, and earlier regimes (2022 bear market) may be missing.
4. **Trade-based 1-minute bars without quotes** (Massive Options Starter/Developer). Real prints, but no spread: fills would be modelled from last trade, optimistic for wide or thin strikes. Needs a spread penalty in the fill model.

## Open and unverified

- Every price and licence clause above: opened only as vendor-domain search extracts, not first-hand. Allow `databento.com`, `massive.com`, `www.thetadata.net`, `datashop.cboe.com` in the session's network, or read them from the user's machine.
- Databento: per-GB price for OPRA `cbbo-1m` and US equities OHLCV; what the OPRA and equities Standard plans include; whether a consolidated equities 1-minute dataset reaches 2021; whether the $199 OPRA price changed in the June 2026 update. Answer with `get_cost` and `get_dataset_range` (free calls with an API key).
- ThetaData: whether "restrict archiving or downloading" in the general terms conflicts with the subscriber agreement's internal trading/research use; real-time limits per tier; stock plan prices.
- Massive: whether the "display use only" clause covers an automated backtest; Section 8 retention after cancelling.
- IBKR: real 1-minute head timestamp for each of the five names; adjusted bar type; whether `TRADES` bars are consolidated.
- Cboe DataShop: prices and licence.
- 0DTE: when SPY and QQQ daily expirations began.
- The storage table is my estimate.

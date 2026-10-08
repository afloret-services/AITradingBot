# Historical MNQ intraday data for backtesting

Research for issue #5. Question: where does the backtest get historical intraday MNQ bars for the Silver Bullet Setup, and how much history can it have?

Researched 2026-10-08.

> **How this was researched, and its limits.** The sandbox could not open vendor or IBKR pages directly. Its network proxy refused `interactivebrokers.com`, `interactivebrokers.github.io`, `databento.com`, `firstratedata.com` and `kibot.com`. Every fact below comes from web-search results limited to the vendor's own domain, and each is cited to the page the search engine took it from. These are first-party pages, but I read search-engine extracts of them, not the full pages. Anything marked **(unverified)** I could not confirm at all. Check prices on the live pages before you pay for anything.

## Summary

- **IBKR alone is not enough for a multi-year backtest.** Expired futures data older than two years after the contract's expiry is unavailable, and bars of 30 seconds or less older than six months are unavailable. That leaves roughly 2 years of 1-minute MNQ history, with heavy pacing limits.
- **Databento (GLBX.MDP3)** has MNQ from its first day of trading, May 2019, at tick, 1-second and 1-minute granularity. It covers both individual contracts and continuous symbols, and charges per GB. New accounts get $125 of free credit, and a 1-minute MNQ history should cost well under that. This is my estimate; check it with `get_cost`.
- **FirstRate Data and Kibot** sell ready-made 1-minute MNQ CSVs from 2019-05-05. They are simple to use, but they are bar-only (no ticks unless you buy them separately), have no API, and you depend on their roll and timestamp conventions.
- **NQ is an acceptable stand-in for MNQ prices** (same index, same tick size, same quarterly expiries), so it can extend history before May 2019. It cannot stand in for MNQ volume, liquidity or fill behaviour.
- **Recommendation:** use Databento GLBX.MDP3 for MNQ per-contract `ohlcv-1m` (plus `ohlcv-1s` or `trades` if fill modelling needs it), stored locally. Use IBKR historical data only to check that Databento bars match what the live bot sees, and to fill the last few days.

## 1. IBKR historical data (TWS API)

The user has IBKR Pro with CME market data, so this source costs nothing extra.

### How far back

| Data | Limit | Source |
|---|---|---|
| Bars of 30 seconds or less (1 s, 5 s, 15 s, 30 s) | Unavailable if older than **six months** | [Unavailable Historical Data](https://www.interactivebrokers.com/docs/tws-api/doc/market-data-historical/historical-data-limitations/unavailable-historical-data) |
| Expired futures (any bar size) | Unavailable if older than **two years, counted from the contract's expiration date** | [Unavailable Historical Data](https://www.interactivebrokers.com/docs/tws-api/doc/market-data-historical/historical-data-limitations/unavailable-historical-data) |
| Expired futures spreads | Unavailable | [Unavailable Historical Data](https://www.interactivebrokers.com/docs/tws-api/doc/market-data-historical/historical-data-limitations/unavailable-historical-data) |
| 1-minute bars | No age limit is listed beyond the expired-futures rule. The legacy docs say the hard limits for bars of 1 minute or larger were lifted, but large requests can still be throttled and eventually disconnect the client. | [Historical Data Limitations (legacy)](https://interactivebrokers.github.io/tws-api/historical_limitations.html) |
| Max duration per request, 1-minute bars | The current page lists 86400 S / 365 D / 52 W / 12 M. The legacy step-size table gave 1 D. | [Max Duration Per Bar Size](https://www.interactivebrokers.com/docs/tws-api/doc/market-data-historical/historical-bars/max-duration-per-bar-size), [legacy limitations](https://interactivebrokers.github.io/tws-api/historical_limitations.html) |
| Max duration per request, 1-second bars | 2000 S | [Max Duration Per Bar Size](https://www.interactivebrokers.com/docs/tws-api/doc/market-data-historical/historical-bars/max-duration-per-bar-size) |
| Historical ticks (`reqHistoricalTicks`) | At most **1000 ticks per request**. One request cannot span several trading sessions. You set either a start time or an end time, not both. | [Historical Time and Sales](https://interactivebrokers.github.io/tws-api/historical_time_and_sales.html), [Requesting Time and Sales data](https://www.interactivebrokers.com/docs/tws-api/doc/market-data-historical/historical-time-sales/requesting-time-and-sales-data) |

**What that means for MNQ:** as of 2026-10-08, only contracts that expired after 2024-10-08 are still available, so the oldest would be MNQZ24 (expired December 2024). Together with the live contracts, that gives roughly 1.8–2 years of 1-minute history, and it shrinks one quarter at a time unless you save data yourself. Second bars and ticks only reach back 6 months. This is my arithmetic from the two-year rule, **not tested against the API**. IBKR suggests `reqHeadTimeStamp` to find a contract's earliest available data. That suggestion was in an IBKR support reply I saw only as a search summary, with no URL. Running it on each contract will give the real answer.

**Expired contracts** must be requested with `includeExpired=True` on the `Contract`, or TWS will not find them ([IBKR Campus: Historical Options & Futures Data using TWS API](https://www.interactivebrokers.com/campus/ibkr-quant-news/historical-options-futures-data-using-tws-api/)).

### Pacing

From [Pacing Violations for Small Bars (30 secs or less)](https://www.interactivebrokers.com/docs/tws-api/doc/market-data-historical/historical-data-limitations/pacing-violations-for-small-bars-30-secs-or-less) and the [legacy limitations page](https://interactivebrokers.github.io/tws-api/historical_limitations.html):

- No identical historical request within 15 seconds.
- No 6 or more requests for the same contract, exchange and tick type within 2 seconds.
- No more than 60 requests in any 10-minute period.
- A `BID_ASK` request counts as two.
- No more than 50 historical requests open at once.

Separately, the general API message rate is your market-data lines divided by 2, per second. The default 100 lines give 50 requests per second ([Pacing Limitations intro](https://www.interactivebrokers.com/docs/tws-api/doc/pacing-limitations/introduction), [TWS API changelog](https://www.interactivebrokers.com/campus/ibkr-api-page/tws-api-changelog-2/)). The small-bar rules above are titled as applying to bars of 30 seconds or less. For 1-minute bars the docs only warn about soft throttling. I don't know whether the 60-per-10-minute rule still applies to 1-minute bars **(unverified)**.

Rough cost in time: 6 months of 1-second bars at 2000 s per request is about 7,000 requests for 23-hour sessions. At 60 requests per 10 minutes, that is about 20 hours of downloading for one contract. Ticks at 1000 per request are worse. 1-minute bars are cheap: a few requests per contract.

### Continuous futures (CONTFUT)

- CONTFUT is for historical data only. It cannot be used for orders or live market data ([Continuous Futures](https://www.interactivebrokers.com/docs/general/contracts/futures/continuous-futures)).
- It "just present[s] the front future contract". For data older than the continuous series covers, request the specific dated contract ([Continuous Futures](https://www.interactivebrokers.com/docs/general/contracts/futures/continuous-futures)).
- `endDateTime` **must be an empty string** for CONTFUT ([Historical Bar Data](https://interactivebrokers.github.io/tws-api/historical_bars.html)). So you cannot page backwards through CONTFUT history; each request ends now. A forum report of error 10339 when setting an end time agrees with this. I saw the forum report only as a search summary and have no URL for it.
- IBKR describes ratio-adjusting a continuous series in the TWS user guide ([TWS Continuous Futures](https://guides.interactivebrokers.com/tws/usersguidebook/technicalanalytics/continuous.htm)). Whether the API returns adjusted or raw prices for CONTFUT is **unverified**.

**Conclusion for IBKR:** CONTFUT is no use for a backtest. Per-contract requests with `includeExpired` give about 2 years of 1-minute bars for free. That is enough to smoke-test the strategy code and check alignment with a paid source, but not enough for a backtest that covers several market regimes.

## 2. Databento — CME Globex MDP 3.0 (`GLBX.MDP3`)

### Coverage and granularity

- Schemas: MBO, MBP-1, MBP-10, TBBO, Trades, **OHLCV-1s, OHLCV-1m**, OHLCV-1h, OHLCV-1d, Definition, Statistics, plus newer BBO schemas. The OHLCV bars are built from trades ([GLBX.MDP3 dataset page](https://databento.com/datasets/GLBX.MDP3), [BBO schemas](https://databento.com/blog/bbo-schemas)).
- The dataset starts in 2010: an example in Databento's own issue tracker shows the range starting 2010-06-06 ([Databento issue tracker](https://issues.databento.com/b/6vrl98vl/feature-ideas/glbxmdp3-status-schema-unavilabile-for-extended-mdp2-history)). MNQ itself only exists from 2019-05-06, when CME launched Micro E-minis ([CME press release, 2019-05-07](https://www.cmegroup.com/media-room/press-releases/2019/5/07/micro_e-mini_futuresmakebigimpressiononfirstdayoftrading.html)). So MNQ history is about 7.4 years, and NQ history is about 16 years.
- Data before 2017 comes from the older MDP2 protocol. The status schema is missing before 2017-05-21, and some 2014 days are degraded ([issue tracker](https://issues.databento.com/b/6vrl98vl/feature-ideas/glbxmdp3-status-schema-unavilabile-for-extended-mdp2-history), [release notes](https://databento.com/docs/release-notes)). This only matters if the backtest uses NQ from before 2017.
- A change to CME normalization, applied retroactively to all history, was scheduled from 2026-07-07 ([CME normalization changes](https://databento.com/blog/cme-normalization-changes-2026-07)). Whether it has finished is **unverified**. Pin the download date in the backtest's data manifest.
- OHLCV bars appear to be sparse, with no bar for a minute without trades. This is **unverified** and comes from the trade-grouping method in Databento's tutorial ([downsampling blog](https://databento.com/blog/downsampling-pricing-data)). For MNQ during NY hours, minutes without trades should be rare, but the loader must handle missing minutes.

### Continuous vs per-contract

- Continuous symbols look like `ROOT.RULE.RANK`, for example `MNQ.c.0`, `MNQ.v.0` or `MNQ.n.0`, requested with `stype_in="continuous"`. `c` follows the calendar (front month), `v` follows the previous day's volume, and `n` follows the previous day's open interest ([Symbology](https://docs.databento.com/knowledge-base/new-users/smart-symbology), [live continuous symbology](https://databento.com/blog/live-continuous-contract-symbology)).
- Continuous prices are **not back-adjusted**: Databento returns the real contract prices and does not smooth the jump at a roll ([Symbology](https://docs.databento.com/knowledge-base/new-users/smart-symbology)). For Silver Bullet that is fine, because the Setup only looks back within one session. The symbology `resolve` endpoint returns which contract each continuous symbol pointed to on each date.
- You can also request individual contracts such as `MNQZ4`.
- A roll rule tied to CME's equity roll dates is only a roadmap item ([roadmap](https://roadmap.databento.com/roadmap/add-continuous-contract-symbology-for-cme-equity-roll-dates)). `v.0` is the closest match to where MNQ liquidity actually sits.

### Cost

- Historical data is pay-as-you-go, billed per byte of uncompressed binary data. CME historical is listed "from $0.50/GB" ([Futures page](https://databento.com/futures), [Usage-based pricing and credits](https://docs.databento.com/knowledge-base/new-users/usage-based-pricing-and-data-credits)). Rates differ by schema. I could not see the per-schema table **(unverified)**. `metadata.list_unit_prices` and `metadata.get_cost` give exact figures before you buy ([release notes](https://databento.com/docs/release-notes)).
- New users get **$125 of free credit**, which can be spent on historical data ([End of Early Access announcement](https://roadmap.databento.com/announcements/end-of-early-access-125-in-free-credits-for-all-users)). A 2023 notice said the credit expired after 6 months; whether that still applies is **unverified**.
- Plans: the CME Standard plan launched at $179/month ([Introducing new CME pricing plans](https://databento.com/blog/introducing-new-cme-pricing-plans)). A June 2026 update lists CME Globex MDP 3.0 at $199/month ([Updates to subscription pricing](https://databento.com/blog/updates-to-subscription-pricing)). A plan is only needed for **live** data. The backtest does not need one, because the bot's live data comes from IBKR.
- **Size estimate (mine, unverified):** MNQ front-month 1-minute bars over about 7.4 years × about 1,380 bars per session ≈ 2.6 M records. If an OHLCV record is about 56 bytes, that is about 0.15 GB, which costs cents to a few dollars at any plausible per-GB rate. Every MNQ expiry (front plus back months) is a few times larger and still small. `trades` or `mbp-1` for 7 years runs to tens of GB, so price it with `get_cost` first.

### Licence

- Databento says users "don't need a license to access historical data", which it defines as more than 24 hours old, for internal use. A licence is needed if you redistribute the data ([Intro to market data licensing](https://databento.com/blog/introduction-market-data-licensing)).
- CME charges a large fee to *distribute* historical data ([CME fee list, Databento-hosted](https://api.databento.com/static/licensing/cme/cme-market-data-fee-list.pdf)). It does not apply to a private backtest, but **do not commit downloaded bars to this repository if it is or becomes public.**
- I could not read the actual terms of service at [legal.databento.com](https://legal.databento.com/) **(unverified)**.

## 3. FirstRate Data

Source: [FirstRate MNQ page](https://firstratedata.com/i/futures/MNQ), [FAQ](https://firstratedata.com/about/FAQ).

- MNQ continuous series from **2019-05-05**. Individual contracts from MNQZ19 onwards (the June and September 2019 contracts appear to be missing). Updated daily.
- Bar sizes: 1 min, 5 min, 30 min, 1 hour and 1 day. The page also mentions tick data, but whether MNQ ticks are included is **unverified**.
- Three continuous versions: unadjusted, absolute-adjusted and ratio-adjusted. The roll rule is not stated **(unverified)**.
- Zipped CSV download, no API. The update links stay the same.
- Price: I could not see the one-off price for MNQ **(unverified)**. Updates cost $99.95 per year after the first free month. Without updates, the download links stop working after a month.
- Timezone of the timestamps: not stated in what I could see **(unverified)**. Check a sample file, because Silver Bullet's NY-time windows depend on it.
- Licence terms: not found **(unverified)**.

## 4. Kibot

Source: [All Futures Continuous 1-minute](https://www.kibot.com/historical-data/continuous-futures-contracts-1-minute-intraday-data.html), [Buy page](https://www.kibot.com/buy.html), [API](https://www.kibot.com/api/download_historical_data.aspx).

- MNQ is in the "All Futures Continuous Contracts" 1-minute package (83 symbols), starting **2019-05-05**. Listed prices: **$520** for continuous only, **$820** for continuous plus individual contracts. Kibot does not appear to sell MNQ on its own.
- Tick and bid/ask data are separate purchases, priced per symbol. I did not find a price for MNQ **(unverified)**.
- Download over an HTTP API or as CSV. There are no free futures samples to check quality before buying.

Kibot is worse value than Databento for this project: it costs more, offers less detail, and its roll rule is not documented.

Not investigated: Portara/CQG and Norgate. Portara is priced for institutions, and Norgate's futures data is mostly end-of-day, so neither looked like it would beat Databento for this need. **This is not checked against their pages.**

## 5. Can NQ stand in for MNQ history?

Facts:

- Both contracts track the Nasdaq-100 with a 0.25-point tick. MNQ is $2 per point and NQ is $20 per point. Micro E-minis are 1/10 the size of the E-mini ([CME MNQ page](https://www.cmegroup.com/markets/equities/nasdaq/micro-e-mini-nasdaq-100.html), [NQ contract specs](https://www.cmegroup.com/markets/equities/nasdaq/e-mini-nasdaq-100.contractSpecs.html), [Micro E-mini overview](https://www.cmegroup.com/education/courses/micro-e-mini-futures/micro-e-mini-futures-products-overview)).
- Both have quarterly expiries (March, June, September, December), settle in cash on the third Friday, and trade Sunday 5 p.m. to Friday 4 p.m. CT ([CME Micro E-mini FAQ](https://www.cmegroup.com/articles/faqs/frequently-asked-questions-micro-e-mini-equity-index-futures.html)).

Assessment (my reasoning, not from a source):

- **Price paths are effectively the same.** Arbitrage keeps MNQ within about a tick of NQ for the same expiry. The structures Silver Bullet uses (liquidity sweeps, fair value gaps, displacement) appear in both, so NQ 1-minute bars from 2010 to 2019 can test whether the Setup's rules hold up over more history.
- **Caveats:**
  1. **Volume and liquidity differ.** Any volume-based filter, and any slippage or queue-position model, must be calibrated on MNQ itself (2019 onwards). This matters most for 2019–2020, when MNQ had just launched and was thin.
  2. **Fair value gaps can differ by a tick.** On 1-second bars, or on thin minutes, the MNQ and NQ highs and lows can differ by one tick. A fair value gap can appear in one contract and not the other. Check how often Signals disagree by running both over 2019–2026.
  3. **Dollar P&L has to be rescaled** ($2 vs $20 per point) and use MNQ commissions. Results should be counted in points or R, not dollars.
  4. **Roll dates:** use the same roll rule for both, so the series switch contracts on the same day.
  5. **Regime:** NQ data from 2010–2019 covers different volatility levels. That is useful for robustness, but it shouldn't be pooled into one headline number without labelling it.

## Recommendation

1. **Primary source: Databento `GLBX.MDP3`.** Download MNQ **per-contract** `ohlcv-1m` for every expiry from 2019-05-06 to today, plus the `definition` schema for expiries and tick sizes. Build the continuous series yourself with an explicit roll rule (volume-based, or CME's roll date), so the backtest controls and records how it rolls. Check the cost with `get_cost` first; it should fit inside the $125 free credit. Add `ohlcv-1s` (or `trades`) later, only if the fill model needs to know what happened inside a minute.
2. **NQ for a robustness pass:** the same download for NQ from 2010 is also cheap at 1-minute granularity. Use it as a separate, labelled test, not mixed with MNQ results.
3. **IBKR:** don't use it as the backtest source. Use it (a) to check that IBKR 1-minute bars match Databento on overlapping days, because the live bot will see IBKR's bars, and (b) to save bars going forward from the live feed.
4. Store raw downloads outside git, or in a git-ignored data directory, because of licence limits on redistribution. Record the dataset, schema, date range and download date in a manifest.
5. FirstRate ($99.95/yr updates, one-off price unknown) is the fallback if you want flat CSVs with no API. Its adjusted continuous series is convenient, but its roll rule and timestamp timezone are undocumented in what I could see.

## Open questions (candidate decision tickets)

- **Roll rule** for the continuous MNQ series (volume crossover vs CME roll date vs fixed days before expiry), and whether to back-adjust prices at all.
- **Bar granularity for fill simulation:** are 1-minute bars enough to decide whether a stop or target was hit first inside a bar, or does the backtest need 1-second bars or trades?
- **NQ as an extension:** should 2010–2019 NQ be part of the official backtest, or only a robustness check?
- **Data storage and licence:** where downloaded data lives (not in git), and confirming Databento's terms of service for internal research use.
- **Timezone handling:** Databento timestamps are UTC nanoseconds. The NY-time Silver Bullet windows need a DST-aware conversion; this needs its own decision.

## Not verified

- Any figure from pages I could only see through search extracts, especially Databento's per-schema $/GB rates, whether the free credit expires, and its terms of service.
- FirstRate's one-off MNQ price, licence, tick-data coverage and timestamp timezone.
- Actual IBKR `reqHeadTimeStamp` results for MNQ, and whether the 60-requests-per-10-minutes rule applies to 1-minute bars.
- Whether Databento OHLCV bars skip minutes with no trades.

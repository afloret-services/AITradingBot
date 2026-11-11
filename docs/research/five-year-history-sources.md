# Five years of intraday history for MNQ, MES, NQ, ES and forex

Research for issue #64. Question: where do we get 5 years of intraday bars (1-minute bars, plus 1-second bars or trades for the fill model) for every instrument a Run may trade or read? That means MNQ, MES, NQ and ES per contract month (expired contracts included, no back-adjusted series, per the roll rule in #17), and the major forex pairs. For each source: coverage start, granularity, cost, licence (may we store it?), format, and whether ES and NQ bars line up minute for minute with MNQ.

This builds on #5, which picked Databento `GLBX.MDP3` for MNQ (findings on branch `research/mnq-historical-data`, `docs/research/mnq-historical-data.md`). Nothing has been bought yet.

Researched 2026-11-11. "Five years back" means from 2021-11-11.

> **How this was researched, and its limits.** The sandbox's network refused every vendor host (`databento.com`, `dukascopy.com`, `interactivebrokers.com`, `histdata.com`, `cmegroup.com`, `firstratedata.com`). Two kinds of evidence were possible:
>
> 1. **Read first-hand:** Databento's own client libraries from PyPI (`databento` 0.90.0 and `databento-dbn` 0.73.0). Their type stubs and compiled dataset table show which datasets, symbology types and record layouts exist. I read these files; I did not run them.
> 2. **Read through search extracts:** web-search results limited to each vendor's own domain. These are first-party pages, but I saw search-engine extracts of them, not the full pages. Each is cited to the page.
>
> Anything marked **(unverified)** I could not confirm either way. Prices especially must be checked on the live page, or with Databento's `metadata.get_cost`, before paying.

## Summary

| Instruments | Recommended source | Coverage start | Granularity | Cost (my estimate) | Storage allowed? |
|---|---|---|---|---|---|
| MNQ, MES | Databento `GLBX.MDP3`, per contract | 2019-05-06 (launch); 5 years fully covered | trades, `ohlcv-1s`, `ohlcv-1m`, order book | 1-minute: a few hundred MB for all four futures. Price per GB is unclear (see Cost) | Yes, for internal use. No redistribution |
| NQ, ES | Databento `GLBX.MDP3`, per contract | 2010-06-06 | same | same | same |
| Spot forex majors | IBKR IDEALPRO historical bars (free), with Dukascopy ticks as a second source | IBKR example: EUR.USD from 2005-03-09. Dukascopy start **(unverified)** | IBKR: 1-minute bars of bid, ask or midpoint (no trades); 1-second only for the last 6 months. Dukascopy: tick, bid and ask | Free, but costs hours of paced downloading | IBKR: own use **(terms unverified)**. Dukascopy: personal, non-commercial use only; the Swiss terms forbid building a database from the site **(applies to the export tool? unverified)** |

- **Databento covers all four futures, but has no spot forex.** Its dataset table lists no spot FX venue. It does carry CME FX futures (6E, M6E and so on) inside the same `GLBX.MDP3` dataset.
- **ES and NQ share MNQ's minute grid.** All four trade on CME Globex in the same session, and Databento stamps each bar with the UTC start of its minute. They join on `ts_event`. The differences are minutes with no trades (more common in the micros), the day each contract rolls, and prices up to a tick apart.
- **This repository is public.** Downloaded bars must not be committed. The `prototype/strategy-lab` branch already has about 870,000 lines of MNQ bars committed (see Follow-ups).

## 1. Futures: Databento `GLBX.MDP3`

### Coverage

- `GLBX.MDP3` is the first dataset in the `databento-dbn` 0.73.0 dataset table. Its schemas are MBO, MBP-1, MBP-10, TBBO, Trades, OHLCV-1s/1m/1h/1d, Definition, Statistics and Status ([GLBX.MDP3 dataset page](https://databento.com/datasets/GLBX.MDP3), [schemas](https://databento.com/docs/schemas-and-data-formats)).
- The dataset starts on **2010-06-06** ([Databento issue tracker](https://issues.databento.com/b/6vrl98vl/feature-ideas/glbxmdp3-status-schema-unavilabile-for-extended-mdp2-history)). Data before 2017-05-21 comes from the older MDP2 feed and has known gaps. Some whole days are empty: 2010-09-13, 2010-11-17, 2012-07-19 and 2017-03-13 ([empty days](https://issues.databento.com/b/6vrl98vl/feature-ideas/glbxmdp3-empty-data-for-2010-09-13-2010-11-17-2012-07-19-and-2017-03-13)). None of this touches the 5-year window from 2021-11.
- **MNQ and MES** launched together with the other Micro E-minis on 2019-05-06 ([CME press release](https://www.cmegroup.com/media-room/press-releases/2019/5/07/micro_e-mini_futuresmakebigimpressiononfirstdayoftrading.html), as cited in #5). So 5 years is fully covered, and about 7.5 years exist if wanted. **NQ and ES** go back to 2010.
- **Expired contracts, not back-adjusted:** request symbols per contract (`MNQZ4`, `ESH3`) with `stype_in="raw_symbol"`. Or use **parent** symbology: `stype_in="parent"` with `ES.FUT` means "all ES futures". The `SType.PARENT` docstring in `databento-dbn` 0.73.0 says exactly that. One parent request per root returns every expiry. Prices are exchange prices; nothing is adjusted. Get the `definition` schema too, for each contract's expiry, tick size and instrument class. Parent requests may also return calendar spreads; drop anything whose instrument class is `FUTURE_SPREAD` (that class exists in the library's `InstrumentClass` enum; whether `ES.FUT` includes spreads is **unverified**).
- **Bars exist only for minutes with trades.** If no trade happens in an interval, no record is printed, and `ts_event` is the start of the interval ([OHLCV schema docs](https://databento.com/docs/schemas-and-data-formats/ohlcv)). This answers an open question from #5.

### Granularity for the fill model

- `ohlcv-1s` and `trades` are both available for the whole 5 years. IBKR, by contrast, deletes bars of 30 seconds or less after 6 months.
- Record sizes, from the DBN record layouts in `databento-dbn` 0.73.0: an OHLCV record is a 16-byte header plus four 8-byte prices plus an 8-byte volume, **56 bytes**. A trade record (MBP-0) is **48 bytes**. This is my arithmetic from the field list. Billing is on this uncompressed size ([usage-based pricing](https://databento.com/docs/faqs/usage-pricing-and-data-credits)).

### Size (my estimates, not quotes)

The repo's own MNQ 1-minute file (`prototypes/strategy-lab/mnq_1m_2y.csv` on `prototype/strategy-lab`) has 674,274 front-month bars from 2024-12-12 to 2026-11, about 1,390 bars per session. Scaled to 5 years:

| Data | Per instrument, front month only | All four futures | Notes |
|---|---|---|---|
| `ohlcv-1m` | ~1.75 M bars ≈ **0.1 GB** | ≈ **0.4 GB** | All expiries (back months, roll weeks) adds an unknown amount, probably under double |
| `ohlcv-1s` | at most ~104 M bars ≈ **5.8 GB** (upper bound: every second of a 23-hour session trades) | at most ~23 GB | Real figure is lower, because many overnight seconds have no trade |
| `trades` | tens of GB **(guess)** | tens to 100+ GB | ES and MNQ print hundreds of thousands of trades a day |

### Cost

- Historical data is pay-as-you-go, billed per GB of uncompressed binary data, with no subscription needed. Delivery is free ([usage-based pricing](https://databento.com/docs/faqs/usage-pricing-and-data-credits)). New accounts get **$125 of free credit** ([announcement](https://roadmap.databento.com/announcements/end-of-early-access-125-in-free-credits-for-all-users)).
- **The per-GB rate for each schema is not settled.** The futures page says CME historical data is "from $0.50/GB" ([Futures page](https://databento.com/futures)). The `list_unit_prices` docs show an example response with `"ohlcv-1m": 280.0` dollars per GB ([list_unit_prices](https://databento.com/docs/api-historical/metadata/metadata-list-unit-prices)). That example doesn't name its dataset, so it may not be the CME rate **(unverified)**. Small bar schemas are plausibly priced much higher per GB than raw order-book data, so treat $0.50/GB as the floor, not the price.
- What that means:
  - **1-minute bars for all four futures (~0.4–0.8 GB):** from under $1 at $0.50/GB, up to roughly $110–$225 at $280/GB. Either way it is a one-off amount inside or near the free credit.
  - **1-second bars or trades for 5 years:** cheap at $0.50/GB, but thousands of dollars at $280/GB. Price them with `get_cost` before deciding. A cheaper option: fetch `ohlcv-1s` only for Trading hours (about a third of each session), or only for the minutes where a 1-minute bar touches both a Trade's stop and its target.
- **Plans:** the CME Standard plan was $179/month, renewing at $199/month from June 2026 ([new CME plans](https://databento.com/blog/introducing-new-cme-pricing-plans), [subscription pricing update](https://databento.com/blog/updates-to-subscription-pricing)). For US equities, the Standard plan includes the entire OHLCV-1s/1m history at no extra charge ([January 2025 plan changes](https://databento.com/blog/upcoming-changes-to-pricing-plans-in-january-2025)). Whether the CME plan includes OHLCV history the same way is **unverified**. If it does, one month of the plan ($199) would pay for all the 1-second bars, which could beat usage pricing.
- **The first step before buying:** call `metadata.list_unit_prices(dataset="GLBX.MDP3")` and `metadata.get_cost` per root and schema for 2021-11-11 to today. Both are free. The prototype script `prototypes/strategy-lab/fetch_databento.py` already calls `get_cost` before it downloads.

### Licence and storage

- Databento says historical data (over 24 hours old) needs no exchange licence for internal use. A licence is needed to redistribute it ([Intro to market data licensing](https://databento.com/blog/introduction-market-data-licensing)). Internal use means use within your own organisation, not shared with outside parties ([subscriber status](https://databento.com/blog/subscriber-status)). CME charges a fee to distribute historical data ([CME fee list](https://api.databento.com/static/licensing/cme/cme-market-data-fee-list.pdf)).
- So storing the downloads on our own disk for a private backtest is fine. **Committing them to this public repository would be redistribution.** Keep them in a git-ignored data directory or outside the repo.
- Databento's actual customer terms at legal.databento.com were not readable **(unverified)**.

### Format

DBN binary (Zstandard-compressed on download) or CSV/JSON. The Python client turns any of them into a pandas DataFrame. Prices are fixed-point integers (units of 1e-9), and timestamps are UTC nanoseconds ([schemas and conventions](https://databento.com/docs/api-reference-historical/basics/schemas-and-conventions)). The prototype already writes them as CSV with ISO UTC timestamps.

## 2. Do ES and NQ line up with MNQ minute for minute?

**Yes, on the same grid.** The differences that matter are listed below.

- **Same venue, session and clock.** All four are CME Globex equity-index futures with the same trading hours, and the same data feed carries them. Databento stamps each bar with its interval start in UTC nanoseconds, so MNQ's 14:31 bar and NQ's 14:31 bar have the same `ts_event` and join directly.
- **Missing minutes differ.** A bar exists only if a trade happened in that minute. MNQ and MES are thinner than NQ and ES, especially overnight and in their early years, so they have more missing minutes. Build a full minute grid per session and join every instrument to it. Don't zip bar lists together by position. Decide whether an empty minute is forward-filled or left empty (that changes FVG detection).
- **Rolls.** MNQ and NQ (and MES and ES) share the same quarterly expiries. But a volume-based roll can switch on different days for the micro and the E-mini. The roll rule from #17 should produce one roll calendar per index and apply it to both the micro and the E-mini, so that a cross-instrument comparison never mixes contract months.
- **Prices differ slightly.** Arbitrage keeps the micro and the E-mini of the same expiry within about a tick, but highs and lows within one minute can differ by a tick. A fair value gap can exist in one and not the other (as #5 noted).
- **Forex does not line up the same way.** Forex trades 24 hours from Sunday evening to Friday evening, and its bars are built from quotes (bid, ask or midpoint), not trades. Convert every source to UTC before joining. HistData, for example, uses fixed EST with no daylight saving ([HistData specification](http://www.histdata.com/f-a-q/data-files-detailed-specification/)).

## 3. Spot forex

### Databento: none

The dataset table compiled into `databento-dbn` 0.73.0 lists CME, US equities, Eurex, ICE, Cboe futures, Japanese and index datasets, and no spot FX venue (no EBS, no Cboe FX). EBS and Cboe FX ITCH appear only as roadmap requests ([EBS FX roadmap item](https://roadmap.databento.com/roadmap/ebs-fx-data), [Cboe FX ITCH request](https://roadmap.databento.com/b/n0o5prm6/feature-ideas/cboe-fx-itch-forex-foreign-exchange)). An older marketing page mentions "Spot FX, over 100 currency pairs" ([tick data page](https://databento.com/tick-data)), but no dataset in the current client backs it.

**CME FX futures** (6E for euro, 6B, 6J, M6E micro euro and so on) are in `GLBX.MDP3`, under the same licence and pipeline as the index futures. They are not spot: their price includes the forward points to expiry, and they are most liquid during US hours. They are a valid stand-in only if the bot trades forex through CME futures rather than IBKR spot (IDEALPRO). That choice belongs to the forex ticket, not this one.

### IBKR IDEALPRO historical bars

- **Coverage:** an IBKR example calling `reqHeadTimeStamp` on EUR.USD with `MIDPOINT` returned **2005-03-09** ([IBKR Campus: TWS API with Jupyter Notebooks](https://www.interactivebrokers.com/campus/ibkr-quant-news/an-introduction-to-tws-api-with-jupyter-notebooks/)). The article is several years old, so run `reqHeadTimeStamp` for each pair ([Finding the earliest data point](https://www.interactivebrokers.com/docs/tws-api/doc/market-data-historical/finding-the-earliest-available-data-point/introduction)). Spot pairs don't expire, so IBKR's two-year limit on expired futures does not apply.
- **What it returns:** `whatToShow` can be `MIDPOINT`, `BID`, `ASK` or `BID_ASK` for forex, but not `TRADES` ([Historical Bar Data](https://interactivebrokers.github.io/tws-api/historical_bars.html)). A `BID_ASK` request counts twice for pacing.
- **Granularity:** bars of 30 seconds or less are unavailable after **6 months** ([Unavailable Historical Data](https://www.interactivebrokers.com/docs/tws-api/doc/market-data-historical/historical-data-limitations/unavailable-historical-data)). So 5 years of 1-minute bars is possible; 5 years of 1-second bars is not. Historical ticks (`reqHistoricalTicks` with `BID_ASK` or `MIDPOINT`) come 1,000 per request ([Historical Time and Sales](https://interactivebrokers.github.io/tws-api/historical_time_and_sales.html)). How far back forex ticks go is **unverified**.
- **Cost:** free with the account; IBKR's FAQ says forex data is free ([General Third Party FAQ](https://www.interactivebrokers.com/docs/third-party-integrations/general-third-party-frequently-asked-questions)). Pacing (no more than 60 requests in 10 minutes, as #5 found) makes 5 years of 1-minute bars for 7 pairs a download of hours, not minutes.
- **Why it's first choice:** the bot will trade spot forex through IBKR, so IBKR's own quotes are what its live Signals and fills will see.
- **Licence:** IBKR's market data terms for storing historical bars for own use were not checked **(unverified)**. Storing for one's own backtest is normal practice, but don't commit the data.

### Dukascopy

- **What:** free export of Dukascopy's SWFX quotes, from tick-by-tick to monthly bars, bid and ask separately, as CSV ([Historical Data Export](https://www.dukascopy.com/swiss/english/marketwatch/historical/)). Raw ticks also come as daily LZMA-compressed binary files per instrument ([data export wiki](https://www.dukascopy.com/wiki/en/development/data-export/)). Historical data comes from the live environment ([Historical Data Service](https://www.dukascopy.com/wiki/en/development/strategy-api/historical-data/historical-data-service/)).
- **Coverage start:** commonly quoted as 2003 for EUR/USD, but I found no first-party statement **(unverified)**. The JForex API can report the first available tick per instrument ([Feed history](https://www.dukascopy.com/wiki/en/development/strategy-api/historical-data/feed-history/)).
- **Why it's useful:** it has 5 years of ticks, which IBKR does not (IBKR's sub-30-second bars stop at 6 months). That makes it the candidate for a forex fill model.
- **Licence (the catch):** the website terms allow downloading for personal, non-commercial use with notices kept. The Swiss bank's terms add that the site's information may not be used to construct a database of any kind ([Terms of Use, Dukascopy Bank SA](https://www.dukascopy.com/swiss/english/legal-pages/terms-of-use/), [Terms of Use, Dukascopy Europe](https://www.dukascopy.com/europe/english/legal-pages/terms-of-use/)). JForex API content is for personal, non-commercial use unless a separate agreement says otherwise ([JForex API Javadocs](https://www.dukascopy.com/swiss/docs/api/index.php)). A private backtest by one person is plausibly "personal, non-commercial", but storing years of ticks may count as "constructing a database". I found no licence written specifically for the historical data export **(unverified)**. Ask Dukascopy before relying on it.
- **Caveat:** these are one ECN's quotes. Their spreads and gaps differ from IBKR's IDEALPRO quotes, so spread- and fill-sensitive tests must be checked against IBKR data.

### HistData.com

Free M1 bars and ticks, organised by pair, year and month, as zipped files. Bar prices are built from the **bid** only. Timestamps are **EST without daylight saving** ([HistData FAQ](https://www.histdata.com/f-a-q/), [file specification](http://www.histdata.com/f-a-q/data-files-detailed-specification/)). The original price source and the licence terms are not stated in what I could see **(unverified)**. It's a fallback for a quick check, not a primary source.

## Recommendation

1. **Futures (MNQ, MES, NQ, ES): Databento `GLBX.MDP3`.** Download by parent symbol (`MNQ.FUT`, `MES.FUT`, `NQ.FUT`, `ES.FUT`) for 2021-11-11 to today: `definition` plus `ohlcv-1m`. Keep outright futures only and keep each contract separate. The roll rule in #17 builds the series. Run `list_unit_prices` and `get_cost` first. Decide on `ohlcv-1s` (all hours, Trading hours only, or ambiguous minutes only) once the price per GB is known, and check whether a month of the CME Standard plan includes OHLCV history.
2. **Spot forex majors: IBKR IDEALPRO** `BID_ASK` (or `MIDPOINT`) 1-minute bars for 5 years, downloaded once with paced requests and then recorded going forward. **Dukascopy ticks** only if the fill model needs sub-minute forex data and Dukascopy confirms that storing it for a private backtest is allowed. Use CME FX futures from Databento only if forex is traded as futures.
3. **Alignment:** join all instruments on a UTC minute grid per session, never by bar position. Use one roll calendar per index for both the micro and the E-mini.
4. **Storage:** all downloads in a git-ignored data directory or outside the repo, with a manifest (source, dataset, schema, symbols, range, download date, cost). The repository is public, so committing vendor data is redistribution.

## Follow-ups (candidate tickets)

- **Committed MNQ bars on a public branch.** `prototype/strategy-lab` has about 870,000 lines of MNQ 1-minute to 4-hour bars (commit `40eda7b`, "data for 2y", covering 2024-12-12 onwards) in a public repository. If they came from IBKR or Databento, that is probably redistribution. Find their source and decide whether to remove them (and from history).
- **Price the download:** run `list_unit_prices` and `get_cost` for the four roots and three schemas, and decide on 1-second bars versus Trading-hours-only bars versus ambiguous-minutes-only. This needs a Databento key, so it is a human step.
- **Forex instrument choice:** trade spot on IDEALPRO or CME FX futures? The answer decides the data source.
- **Dukascopy licence:** ask whether storing tick data for a private backtest is allowed.
- **Empty minutes:** forward-fill or leave empty? This affects FVG and Swing point detection on thin micro bars.

## Not verified

- Databento's per-schema price per GB for `GLBX.MDP3`, and whether the CME Standard plan includes OHLCV history.
- Whether parent symbols such as `ES.FUT` also return calendar spreads.
- Databento's customer terms (legal.databento.com).
- IBKR's current `reqHeadTimeStamp` result for each forex pair, how far back forex ticks go, and IBKR's terms for storing historical data.
- Dukascopy's first available date per pair, and a licence specific to the historical data export.
- HistData's price source and licence.
- Every size figure above is my estimate, not a vendor quote.

# High-win-rate intraday futures strategies: what is claimed, and what backs it

Research for issue #36. Researched 2026-11-09. Facts and their sources only. Which candidates become **Setups** is decided by the **Promotion gate** (issue #31), not here.

**Question.** Is there a publicly described intraday strategy for index futures (MNQ first) that reaches a take-profit of at least 1 **R** every Trading day, wins more than 80% of its **Trades**, and risks 2–5% of the account per Trade? For each candidate: its rules, the claim and who makes it, the kind of evidence, and any independent test. Also: what does the evidence say about the bar itself?

## How the sources were checked

- **Most sites could not be opened.** The sandbox refused WebFetch and direct requests to topstep.com, financemagnates.com, ssrn.com, concretumgroup.com, mql5.com, reddit.com, nexusfi.com / futures.io, cxoadvisory.com and arxiv.org. Their content was read through search-engine extracts that quote the page. Tag: **[primary, via extract]** when the extract quotes the owner's own page or paper, **[secondary]** when it quotes a third party's summary. Re-read the page before relying on an exact number.
- **YouTube** was reachable directly. Titles, channels, view counts, publish dates and descriptions below were read from YouTube itself on 2026-11-09. Tag: **[primary, read]**. **Transcripts were not read**: fetching caption tracks was blocked in this session. So what a video says beyond its title and description is not checked here.
- **Private paid Discord / Telegram / Whop groups** were not reachable and were not tried. Many of the claims below sell access to one.
- A claim no source states, worked out from the ones that do, is tagged **[inference]**. Arithmetic is shown so it can be checked.

## Summary

| # | Finding | Strength |
|---|---|---|
| 1 | **Nothing found credibly meets the bar.** No public strategy found has evidence (audited record, broker statements, or a published backtest with method) of >80% wins at ≥1R per Trade on index futures. | — |
| 2 | Every >80% claim found is a bare claim or an unpublished/self-run backtest by someone selling a course, indicator, Discord or prop-firm affiliate code. | primary, read (YouTube descriptions) |
| 3 | The one published high-win-rate scalping result with numbers (85%, 342 W / 60 L) gives no R multiple, no period and no rules in its description. | primary, read |
| 4 | The bar implies a per-Trade Sharpe of 0.75 (≈ 11.9 annualised at one Trade a day). The best published intraday futures / index results are Sharpe ≈ 0.9–2.8. | inference from primary |
| 5 | Prop firms: Topstep reports 16.8% of Combines passed and 33.3% of Funded-Level traders paid in 2025. An FPFX Tech dataset (300,000+ accounts, 10 firms) has about 7% of accounts reaching a payout. | primary, via extract; secondary |
| 6 | Academic intraday patterns with real evidence (opening-range breakout, intraday momentum) have **low** win rates (ORB on QQQ ≈ 24%) or small predictive power (R² ≈ 1.6%), and edges that shrink to about zero after costs in at least one replication. | primary, via extract; secondary |
| 7 | Codable "high-hit-rate" statistics exist (gap fill to half-gap ≈ 76%, IB single-break ≈ 72–80%, Market Profile "80% rule"), but they are touch probabilities, not Trades with a stop. Independent tests of the 80% rule found ≈ 62%. | secondary (vendor, forum) |

## 1. The bar itself

### What the bar implies **[inference, arithmetic]**

- **Expectancy.** 80% wins at +1R and 20% losses at −1R gives 0.8 × 1 − 0.2 × 1 = **+0.6R per Trade** before costs. Break-even at 1:1 is 50% (1 / (1 + reward:risk)).
- **Baseline.** For a price path with no drift, the chance of touching +kR before −1R is 1 / (1 + k). At k = 1 that is 50%. An 80% hit rate at 1:1 needs price to be strongly predictable over the life of the Trade.
- **Sharpe.** The per-Trade standard deviation of a ±1R bet won 80% of the time is 2 × √(0.8 × 0.2) = 0.8R, so the per-Trade Sharpe is 0.6 / 0.8 = 0.75. At one Trade a day over 252 days that is about **11.9 a year**. Compare section 4: the best published intraday results are about 0.9 to 2.8.
- **Growth.** One Trade a day, 250 days, compounding:

  | Risk per Trade | Mean log growth per Trade | Account multiple after 250 Trades |
  |---|---|---|
  | 2% | 0.0118 | ≈ 19× |
  | 3% | 0.0176 | ≈ 80× |
  | 5% | 0.0288 | ≈ 1,330× |

- **"1R every Trading day" and "80% wins" conflict** at one Trade a day. At 80% wins, the chance of at least one losing day in 20 Trading days is 1 − 0.8²⁰ ≈ 98.8%. Hitting 1R *every* day needs either a 100% win rate or several Trades a day with a daily stop-and-go rule. The bar should say which.
- **Comparison with individual traders.** 0.6R at 2% risk is +1.2% a day (120 bps). Barber, Lee, Liu & Odean's 500 *top-ranked* Taiwan day traders earned 37.9 bps a day after fees in the following period (section 3). The bar asks for about three times that.

### What prop firms publish

- **Topstep, 2025 (Jan–Dec).** "16.8% of all Trading Combines initiated were successfully completed and afforded the opportunity to advance to the Funded Level"; 51.8% of individuals who entered one or more Combines advanced to the Funded Level; **33.3% of all individual participants at the Funded Level received a payout**; 0.71% of individual participants in an Express Funded Account were called up to a Live Funded Account. Topstep states the figures mix simulated and live trading and are not indicative of future results. Source: Topstep disclosure as quoted on topstep.com pages (e.g. https://www.topstep.com/topics/funded-trading) and repeated by reviews (https://curvedtrading.com/articles/en/reviews/topstep-review/) **[primary, via extract]**. The disclosure page itself was not opened. No audit is mentioned.
- **FPFX Tech (prop-firm platform vendor), reported by Finance Magnates, 2024-09-18.** Over 300,000 accounts of about 100,000 traders at 10 prop firms. About **7% of accounts reached a payout**; CEO Justin Hertzberg: about 45% of funded traders achieved a payout; average payout ≈ 4% of the plan size. Source: https://www.financemagnates.com/forex/exclusive-only-7-of-300000-prop-trading-accounts-achieved-payouts/ **[secondary, via extract]**. A widely repeated "14% pass" figure from the same dataset was **not** found in the extracts.
- **Take Profit Trader.** 16.86% evaluation pass rate in 2024, "citing the firm", per Fortunly (https://fortunly.com/statistics/prop-firm-challenge-pass-rate-statistics/) **[secondary]**. Not found on the firm's own page.
- **Apex Trader Funding.** Press releases report cumulative dollars paid (e.g. "$100 million customer payout", https://prnewswire.com/news-releases/apex-trader-funding-announces-100-million-customer-payout-302069391.html) **[primary, via extract]**, not the share of traders paid. No Apex pass or payout *rate* from Apex was found.
- **FTMO.** No official pass rate found. Third-party figures (≈ 9–12%) are estimates **[secondary]**.
- **Tradeify 28.5% / My Funded Futures 39.2% of funded traders paid** appear in one review site's summary; neither firm's own disclosure was found. **[unverified]**

What this shows **[inference]**: a trader with +0.6R a Trade at 2–5% risk would pass a typical evaluation within days. Topstep's own numbers say about a third of the people who reach the Funded Level are ever paid once. The firms do not publish win rates, so their numbers bound the population's results, not any one strategy's.

## 2. Candidates

### Ranking (codability × evidence quality)

Codability: **High** = rules complete enough to code as written; **Medium** = core rules clear, some parameters to choose; **Low** = discretionary steps or rules not public. Evidence: **A** = audited or broker statements; **B** = published backtest with method (peer-reviewed or working paper); **C** = vendor statistics / forum test with stated rules; **D** = bare claim or creator's own unpublished backtest.

| Rank | Candidate | Codability | Evidence | Claimed win rate / R | Meets bar? |
|---|---|---|---|---|---|
| 1 | Intraday momentum, "noise area" breakout (Zarattini, Aziz & Barbon 2024) | High | B | Hit rate not found; Sharpe 1.33 net (SPY) | No: not a high-win-rate system |
| 2 | 5-minute opening-range breakout (Zarattini & Aziz 2023; Crabel 1990) | High | B (+ independent replication) | ≈ 24% wins, +0.13R gross (QQQ) | No: low win rate; ≈ 0 after costs in replication |
| 3 | First-half-hour → last-half-hour momentum (Gao et al. 2018; Baltussen et al. 2021) | High | B | Hit rate not found; Sharpe 0.87–1.73 per asset class | No |
| 4 | Gap fill / half-gap fill (Edgeful statistics) | High | C | 51–58% full fill, ≈ 76% half-gap fill (NQ, recent 3–6 mo.) | No: touch rate, no stop; short windows |
| 5 | Market Profile "80% rule" (Dalton) | Medium | C (forum tests) | Claimed 80%; tests ≈ 62% | No |
| 6 | Initial-balance single break / "IB by rejection" (Edgeful) | High | C | 72–80% single break; 77–78% directional | No: not a Trade with a stop |
| 7 | ICT Silver Bullet / iFVG / OTE models (YouTube) | Low–Medium | D | 63–90% | Unknown; no checkable evidence |
| 8 | "90%+ win rate" YouTube scalps (various) | Low | D | 80–95% | Unknown; typical ones use targets below 1R or give no R |

None ranks as **A**. Ranks 1–3 are the only ones whose rules and results were published with a method. None claims a high win rate.

### 2.1 Intraday momentum "noise area" (SPY)

- **Who / where.** Carlo Zarattini, Andrew Aziz, Andrea Barbon, "Beat the Market: An Effective Intraday Momentum Strategy for S&P500 ETF (SPY)", Swiss Finance Institute RP 24-97, version 2025-02-03. https://www.sfi.ch/de/publications/n-24-97-beat-the-market-an-effective-intraday-momentum-strategy-for-s-p500-etf-spy **[primary, via extract]**.
- **Rules.** A "Noise Area" around the open built from the average intraday move over the previous 14 days. Enter in the direction price leaves the area; exit on a VWAP-based trailing stop or at the close **[secondary, CXO summary]**. Codable on MNQ once the paper's exact band formula is read.
- **Claim.** 2007 to early 2024: 1,985% total return net of costs, 19.6% a year, Sharpe 1.33 **[primary, via extract]**. Max drawdown −25% **[secondary]**. **Hit rate not found.** Trend-following exits normally give a below-50% hit rate **[inference]**.
- **Independent test.** TradingView open-source scripts exist; no published independent result found.

### 2.2 Opening-range breakout (ORB)

- **Who / where.** Zarattini & Aziz, "Can Day Trading Really Be Profitable?", SSRN 4416622 (2023), https://papers.ssrn.com/abstract=4416622 **[primary, via extract]**. Book origin: Toby Crabel, *Day Trading with Short Term Price Patterns and Opening Range Breakout* (1990).
- **Rules (paper).** QQQ, 2016–2023. Direction of the first 5-minute bar; enter on the open of the next bar; stop at the opposite end of the opening range; target 10R; exit at the close if neither is hit; 1% risk per Trade, up to 4× leverage; $0.0005/share commission, **no spread or slippage** **[primary, via extract; rules partly secondary]**. Codable as written.
- **Claim.** 33.2% vs 14.9% CAGR for buy-and-hold QQQ, 1,795 Trades (CXO Advisory summary) **[secondary]**. About **24% wins at +0.13R per Trade** gross (as reported in a replication) **[secondary]**.
- **Independent test.** An MQL5 blog replicated it on NQ, S&P 500, Dow, DAX and FTSE CFDs, Jan 2015 – Jun 2026: NQ gross +0.131R and 23.2% wins (matching the paper); **net of CFD costs, +0.002R on NQ**, four of five markets negative. https://www.mql5.com/en/blogs/post/776235 **[secondary, via extract]**. CFD spreads are wider than MNQ's, so the cost result may not carry over to futures **[inference]**.
- **Crabel's percentages.** One learning site reproduces a table (via Kaufman) giving ORB 68% wins on the S&P without a filter, 61% with an inside-day filter **[secondary]**. Target, stop and period not given in the extract. **[unverified]**
- **Related.** Stocks-in-Play ORB (Zarattini, Barbon & Aziz, SFI RP 24-98): Sharpe 2.81 net for the top 20 stocks in play, 2016–2023 **[primary, via extract]**; a QuantConnect rebuild got Sharpe 2.40 **[secondary]**. Individual stocks, not index futures.
- **Academic ORB on futures.** Holmberg, Lönnbark & Lundström, *Finance Research Letters* 10(1) 2013, crude-oil futures: returns significantly above zero and an "increased success rate in relation to a fair game" **[primary, abstract only]**. The figures are behind a paywall.

### 2.3 Intraday momentum, first half-hour → last half-hour

- **Gao, Han, Li & Zhou**, "Market intraday momentum", *JFE* 129(2) 2018, 394–414. SPY 1993–2013: the first half-hour return (from the prior close) predicts the last half-hour return, R² 1.6% (≈ 1.2% out of sample) **[primary, via extract]**. Timing strategy gross 6.3% a year in an earlier draft **[secondary]**.
- **Baltussen, Da, Lammers & Martens**, "Hedging demand and market intraday momentum", *JFE* 142(1) 2021, 377–403. 60+ futures, 1974–2020: intraday momentum everywhere, Sharpe 0.87–1.73 per asset class, linked to gamma hedging **[primary, via extract]**.
- **Rules.** Fully codable: sign of first 30 minutes, hold the last 30 minutes. **Win rate not reported in extracts**; an R² of 1.6% implies a hit rate only modestly above 50% **[inference]**.

### 2.4 Gap fill

- **Who / where.** Edgeful (a statistics vendor) blog and docs. https://www.edgeful.com/blog/posts/trading-gap-fills, https://www.edgeful.com/blog/posts/half-gaps-vs-full-gaps **[primary vendor, via extract]**.
- **Rules.** Gap = RTH open vs previous session close. "Filled" = price touches the previous close the same day. Codable.
- **Claim.** NQ, last 6 months (at time of writing): gap up filled 51%, gap down 55%; half-gap target: gap down 76%. Another post, last 3 months: 52% / 58% **[primary vendor, via extract]**. Weekday splits range from 30% to 77%.
- **Why it is not the bar [inference].** These are touch rates without a stop. Whether a fade with a 1R stop reaches a half-gap target first is not reported. Samples are 3–6 months.

### 2.5 Market Profile "80% rule"

- **Source.** Attributed to Dalton Capital Management's *Profile Reports* (1987–1991) **[secondary]**. Rule: if the market opens outside the prior day's value area and spends two consecutive 30-minute periods back inside it, it has ~80% chance of reaching the other side of value.
- **Codability.** Medium: needs a value-area definition (70% of volume or TPOs) and an entry/stop the rule does not state.
- **Independent tests.** A NexusFi/futures.io post: 120 days, setup 12% of days, 75 of 120 occurrences reached the other side, "62.5% success rate"; another trader in TradeStation ≈ 62% **[secondary, via extract]** (https://nexusfi.com/showthread.php?p=910061). The Right Trader: "no reliable published success rate" **[secondary]**.

### 2.6 Initial balance breaks (Edgeful)

- NQ initial balance (first hour): one side only broken 72% (last 6 months) or 80% (another page); "IB by rejection" 77–78% directional **[primary vendor, via extract]** (https://www.edgeful.com/blog/posts/ib-by-rejection-deep-dive, https://www.edgeful.com/blog/posts/initial-balance-breakout-report). Touch statistics, not Trades; short windows; vendor sells the reports.

### 2.7 ICT models (Silver Bullet, iFVG, OTE)

- **Claims.** "The 80% Winrate Model That Turned Me Profitable (Backtesting iFVGs)", NQravi, 2026-09-19; "90% Win Rate IFVG Model (Full Breakdown)", ReeseTradesNQ, 2026-08-30; "I Revealed My OTE Model That Has a 90% Win Rate", aymantrades, 2026-05-23; "Simple ICT Silver Bullet Strategy | 70% Win Rate", JadeCap **[primary, read / via summary site]**. Descriptions contain Discord links and prop-firm discount codes; no rules, sample sizes, periods or R multiples.
- **Evidence.** Bare claims or the creator's own chart replay. A vendor (Awake Trader) reports 41% wins, profit factor 0.86, on 500 NQ sessions of ICT killzones (not Silver Bullet specifically) **[secondary]**. Another vendor claims 63.6% wins at 1:2.5 on 187 NAS100 setups without method **[secondary]**.
- **Relation to this repo.** The glossary already writes the Silver Bullet as exact rules (Window, FVG, Displacement, Liquidity sweep, MSS). That makes it codable here; none of the public win-rate claims for it are checkable.

### 2.8 "90%+ win rate" YouTube videos

Read from YouTube on 2026-11-09 **[primary, read]** (title | channel | publish date | views):

| Video | What the description offers | Evidence |
|---|---|---|
| "NQ 1 Min Scalping Strategy 85% Win Rate" (https://www.youtube.com/watch?v=6Ve20SIXURM) \| ZeffsTrading \| 2024-02-23 \| ~70k | "Tested Strategy Results: Wins: 342 Losses: 60 85.07%"; paid indicator on Whop. No R, period, costs. | D |
| "The Simple Futures Strategy with a 90%+ Win Rate — Backtested 10,000 Times" (https://www.youtube.com/watch?v=_V6L81731hI) \| SJC Trades Futures \| 2026-09-15 \| ~10k | Course link with code only. | D |
| "How I Achieved A 94% Win Rate (NEW STRATEGY)" (https://www.youtube.com/watch?v=4ft3bah5B4A) \| PB Trading \| 2026-07-27 \| ~224k | 1-1 mentorship, prop-firm codes. | D |
| "STEAL This INSANE Simple 90% Win Rate Trading Strategy (1:20+ RR)" (https://www.youtube.com/watch?v=ADnslyKOwFE) \| Chart Fanatics (guest TG Capital) \| 2025-07-20 \| ~755k | "six figures in verified profits", "record-breaking prop firm payouts"; Apex affiliate code. 90% at 1:20 is not checked by anything shown. | D |
| "My Trading Strategy is Boring, But it Broke The World Record Payout" (https://www.youtube.com/watch?v=dE4lPhAWke8) \| JadeCap \| 2025-09-10 | Course and Apex code; description states compensation via affiliate links. | D (a payout is not a win rate) |
| "Backtesting My 80%+ Win-Rate Trading Strategy To Prove Its Edge" (https://www.youtube.com/watch?v=DTQd_nN_epo) \| EzTrades \| 2026-10-20 | 75-minute manual backtest of liquidity + FVG; paid tools. | D |
| "I Tested This Guru's 80% Strategy for 150 Trades. Here's What Happened." (https://www.youtube.com/watch?v=c6FH4taiQb8) \| Day Trading & Jesus \| 2026-06-01 | A third-party test, but the result is only in the video; transcript not read. | **unread** |
| "This SIMPLE Trading Strategy Makes a 90% Win Rate Possible" (https://www.youtube.com/watch?v=j9bl9C7Sa4E) \| SMB Capital | Options workshop (covered calls), not futures. | n/a |

Pattern across the ~50 search results read: nearly every description carries a mentorship, course, paid indicator or prop-firm affiliate code. None links to broker statements, an audited record or a downloadable backtest. **[primary, read]**

Communities: an r/FuturesTrading commenter aiming at 80–90% wins described a 1:0.5 reward:risk, i.e. target half the stop **[secondary, via extract]**. At 1:0.5, break-even is 66.7%, so 80% would be +0.2R, not +0.6R **[inference]**. An r/RealDayTrading "Verified Trader" lesson (2021-11-21) argues a high win rate is essential for trading for a living, giving 80% at ~20 trades a day as its example **[secondary]**; no record attached.

## 3. Academic results on individual day traders

- **Brazil, mini-Ibovespa futures.** Chague, De-Losso & Giovannetti, "Day Trading for a Living?" (SSRN 3423101; FGV TD 525). All 19,646 individuals who began day trading the contract in 2013–2015. Of the 1,551 who persisted more than 300 sessions, **97% lost money**, 1.1% earned more than the minimum wage (US$16/day), 0.5% more than a bank teller's starting salary (US$54/day); no evidence of learning **[primary, via extract; Quantpedia summary for the counts]**. Abstract versions differ on 0.4% vs 0.5%.
- **Taiwan, all day traders 1992–2006.** Barber, Lee, Liu & Odean, "The Cross-Section of Speculator Skill: Evidence from Day Trading", *Journal of Financial Markets* 18 (2014) 1–24. Less than 1% of day traders predictably earn positive abnormal returns net of fees; the top 500 then earn 61.3 bps/day before fees, 37.9 after; aggregate day-trader performance net of fees negative in every one of the 15 years **[primary, via extract]**.
- **Overnight drift (not intraday, for context).** Boyarchenko, Larsen & Whelan, "The Overnight Drift", *RFS* 36(9) 2023: almost all of the U.S. equity premium in S&P 500 futures was earned 02:00–03:00 ET **[primary, via extract]**. A 2026 Liberty Street Economics post says that window's ≈ 3.7%/yr has averaged near zero since 2021 **[primary, via extract]**. It shows a well-documented intraday pattern can fade.

## Conclusion

- Nothing found credibly meets the user's bar. The candidates with real evidence (2.1–2.3) are codable, but they make money with **low or near-50% win rates** and Sharpe ratios of about 1–3, against the 11.9 the bar implies. The candidates with high hit rates (2.4–2.6) are touch statistics without a stop, and the one with independent tests (the 80% rule) tested at ≈ 62%. The candidates that claim 80–95% wins at ≥ 1R (2.7–2.8) have no checkable evidence.
- Published prop-firm and academic numbers put a sustained +0.6R a day at 2–5% risk far outside what traders achieve: Topstep pays about a third of Funded-Level traders once; about 7% of prop accounts in the FPFX data reached a payout; < 1% of Taiwan day traders and ≈ 3% of persistent Brazilian ones were profitable.
- For the Promotion gate, the strongest codable candidates to backtest on MNQ are 2.1 (noise-area momentum), 2.2 (5-minute ORB) and 2.3 (first/last half-hour momentum), plus the repo's own Silver Bullet rules. Each should be judged on expectancy in R after costs, not on win rate.

## Unknowns and unverified claims

1. The full Topstep 2025 disclosure page was not opened; figures come from extracts of topstep.com pages and reviews.
2. The FPFX "14% pass" figure was not found in any extract; only the 7% payout figure was.
3. Tradeify 28.5% and My Funded Futures 39.2% "funded traders paid": no first-party source found.
4. No Apex, FTMO or Take Profit Trader pass/payout *rate* from the firm itself was found.
5. The Zarattini & Aziz ORB hit rate (24%) and +0.13R come from the MQL5 replication's description of the paper, not from the paper's table.
6. The hit rates of the noise-area momentum and first/last half-hour strategies were not found.
7. Crabel's 68% / 61% S&P ORB win rates come from a secondary site citing Kaufman; the book was not read.
8. The Market Profile 80% rule's origin (Dalton's *Profile Reports*, 1987–1991) is from secondary sites.
9. Whether the MQL5 replication's "net zero" holds with MNQ's costs, rather than CFD spreads.
10. Every YouTube win rate in 2.7–2.8, including ZeffsTrading's 342 W / 60 L: no R, period, costs or rules published.
11. The result of the "I Tested This Guru's 80% Strategy for 150 Trades" video: transcript not read.
12. Edgeful's NQ statistics: windows of 3–6 months, vendor-published, no audit.
13. Whether "1R every Trading day" means one Trade a day (which conflicts with 80% wins) or several Trades with a daily stop-and-go rule.
14. Contents of private paid Discord / Telegram / Whop groups: out of reach.

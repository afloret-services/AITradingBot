# Economic calendar API for US high-impact releases, live and historical

Research for [#25](https://github.com/afloret-services/AITradingBot/issues/25), which comes from [#24](https://github.com/afloret-services/AITradingBot/issues/24) (whether high-impact releases suppress Signals). Researched 2026-10-28.

**Question.** Which API gives the bot US high-impact releases (FOMC statements, CPI, NFP, PPI, ISM, JOLTS, retail sales, GDP, PCE) for upcoming dates and back to 2019? It must give the dates the releases actually came out, not the dates first scheduled (the 2025 shutdown moved several), and their New York times. The live bot and the backtest must use the same calendar.

## How this was researched, and its limits

- **Network.** This session's network policy blocked every candidate host, both for shell requests (`curl` got `CONNECT tunnel failed, response 403` from the egress proxy) and for direct page fetches (`getaddrinfo ENOTFOUND`). The blocked hosts were api.stlouisfed.org, fred.stlouisfed.org, api.tradingeconomics.com, financialmodelingprep.com, docs.financialmodelingprep.com, finnhub.io, data.nasdaq.com, nfs.faireconomy.media, federalreserve.gov, bls.gov and bea.gov. **No live API request was made**, so no response below was observed first-hand.
- **What was used instead.** Every fact comes from web-search results that quote the owning site's page, with the search limited to that site's domain where possible. Each fact cites the page it came from. Search snippets can be stale or cut short. Anything marked **[secondary]** comes from a third party, not the owner. Anything marked **[unverified]** is from memory or inference and needs one live request to confirm.
- **Before the spec relies on this,** someone with network access should run the checks in [To verify with one live request each](#to-verify-with-one-live-request-each).

## Recommendation

**Primary: FRED API from the St. Louis Fed (release dates), plus the Federal Reserve Board's FOMC pages for FOMC days, plus the ISM release calendar for ISM.**

- It is free. It needs a free API key ([API key page](https://fred.stlouisfed.org/docs/api/api_key.html)).
- For past dates, `fred/release/dates` lists the dates data actually came out (ALFRED vintages), so releases moved by the shutdown appear on their real dates. ALFRED's Employment Situation release pages exist for [2025-11-20](https://alfred.stlouisfed.org/release?et=&ob=pv&od=desc&pageID=8&rd=2025-11-20&rid=50&t=establishment+survey) and [2025-12-16](https://alfred.stlouisfed.org/release?ob=pv&od=desc&rd=2025-12-16&rid=50&t=rate), which are the dates BLS moved them to. No vintage page was found for the original 2025-10-03 date.
- Upcoming dates come from the same endpoint with `include_release_dates_with_no_data=true`.
- History goes back decades, well before 2019.
- The gaps the spec has to fill:
  1. **No time of day in the API.** Each release has a fixed time (see the [time table](#release-times-new-york)), so a per-release time table in the bot covers it.
  2. **FOMC is not usable from FRED.** Its "FOMC Press Release" release (rid=101) carries daily series, so its dates are not meeting days.
  3. **ISM is not in FRED.** ISM had its data removed in 2016.
  4. **No impact rating.** That is fine, because the issue already fixes the list of releases that count as high-impact.
  5. **Terms on caching.** The FRED API terms forbid using the API to "store, cache, or archive" FRED content (see [FRED](#1-fred--alfred-release-dates-api-st-louis-fed)). A backtest that saves release dates to disk may conflict with that. Someone has to decide whether fetching the dates fresh on each backtest run is acceptable.

**Fallback: Trading Economics calendar API (paid).** It is the only candidate that covers every listed release in one feed, including FOMC and ISM. It gives:

- a release time in UTC,
- an importance rating from 1 to 3,
- a `DateSpan` flag for estimated (tentative) dates,
- a `LastUpdate` timestamp,
- and a **point-in-time** endpoint meant for backtests without look-ahead.

Against it: the price is not public, the plan that includes the calendar is unclear, and how far back its history goes is not stated. Choose it if one source for everything, or a ready-made impact rating, is worth a subscription.

The others don't fit:

- **Finnhub:** history is for Enterprise clients only (and its paid tier is listed at $3,500 a month), and its times carry no time zone.
- **Financial Modeling Prep:** has a cheap paid tier, but its history depth, its range per request and how it handles reschedules are all undocumented.
- **Nasdaq Data Link:** has no economic calendar product.
- **Forex Factory feed:** covers this week only, with no history, and its terms are unclear.

## The releases the bot needs, and their owners

| Release | Owner | Usual NY time | In FRED? | FRED release id |
|---|---|---|---|---|
| FOMC statement | Fed Board | 14:00 | Release exists but is daily (unusable) | 101 |
| CPI | BLS | 08:30 | Yes | 10 (confirmed: [FRED release 10](https://fred.stlouisfed.org/release?rid=10)) |
| Employment Situation (NFP) | BLS | 08:30 | Yes | 50 (confirmed: [FRED calendar rid=50](https://fred.stlouisfed.org/releases/calendar?od=asc&rid=50&ve=2025-12-31&view=year&vs=2025-01-01)) |
| PPI | BLS | 08:30 | Yes [unverified] | 46 [unverified] |
| JOLTS | BLS | 10:00 [unverified] | Yes ([JOLTS series in FRED](https://fred.stlouisfed.org/graph/?g=1czs8)) | 192 [unverified] |
| Advance retail sales | Census | 08:30 [unverified] | Yes ("Advance Monthly Sales for Retail and Food Services") | 9 [unverified] |
| GDP | BEA | 08:30 ([BEA GDP Q3 2025 release](https://www.bea.gov/sites/default/files/2026-01/gdp3q25-updated.pdf)) | Yes | 53 (confirmed: [FRED GDP calendar](https://fred.stlouisfed.org/releases/calendar?rid=53&y=2025)) |
| PCE (Personal Income and Outlays) | BEA | 08:30 | Yes | 54 [unverified] |
| ISM Manufacturing PMI | ISM | 10:00 | **No**, removed June 2016 ([FRED notice](https://news.research.stlouisfed.org/2016/06/institute-for-supply-management-data-to-be-removed-from-fred/)) | none |

The ids marked unverified should be looked up with `fred/releases` (it lists every release with its name) rather than hard-coded from this table.

### Release times (New York)

The window is 10:00–11:00 New York. **ISM Manufacturing and JOLTS come out at 10:00, the start of the window.** The 08:30 releases come out before the window opens, and FOMC comes out after it closes.

- **ISM Manufacturing PMI:** 10:00 a.m. ET on the first business day of the month, unless the NYSE is closed. The 2026 calendar moves the January release to the 5th for an ISM holiday. Sources: [ISM PMI reports](https://www.ismworld.org/supply-management-news-and-reports/reports/ism-pmi-reports/), [ISM release calendar](https://www.ismworld.org/supply-management-news-and-reports/reports/rob-report-calendar/).
- **FOMC statement:** 2:00 p.m., with the Chair's press conference at 2:30 p.m. ([Fed January 2026 calendar](https://www.federalreserve.gov/newsevents/2026-january.htm), [September 2026 meeting](https://www.federalreserve.gov/monetarypolicy/fomcpresconf20260916.htm)). There are exceptions: the unscheduled statement of **2020-03-03 came out at 10 a.m. EST** ([release PDF](https://www.federalreserve.gov/monetarypolicy/files/monetary20200303a1.pdf)), and the **2020-03-15** statement came out at 5 p.m. EDT on a Sunday ([release PDF](https://www.federalreserve.gov/monetarypolicy/files/monetary20200315a1.pdf)). A fixed 14:00 time would place both wrongly. 2020-03-03 is the only one inside the 10:00–11:00 window.
- **Employment Situation, CPI and Real Earnings:** 08:30 ET, including the dates moved by the shutdown ([BLS revised dates](https://www.bls.gov/bls/2025-lapse-revised-release-dates.htm)).
- **GDP and Personal Income and Outlays:** 08:30 ET ([BEA schedule updates](https://www.bea.gov/news/blog/2025-12-10/economic-release-schedule-updates)).
- **FRED's web calendar shows times in Central time.** For example, it shows Employment Situation at "7:30 am", which is 8:30 ET ([FRED calendar rid=50](https://fred.stlouisfed.org/releases/calendar?od=asc&rid=50&ve=2025-12-31&view=year&vs=2025-01-01)). The time zone is inferred from the one-hour offset.

### Test case: the 2025 and 2026 government shutdowns

The 2025 shutdown ran from Oct 1 to Nov 12, 2025, and a second one ran from Jan 31 to Feb 3, 2026 ([St. Louis Fed](https://www.stlouisfed.org/on-the-economy/2026/feb/do-government-shutdowns-affect-subsequent-data-revisions)). All moves below are from [BLS revised release dates](https://www.bls.gov/bls/2025-lapse-revised-release-dates.htm) unless another source is cited.

| Release (data month) | Originally scheduled | Actual |
|---|---|---|
| Employment Situation (Sep 2025) | 2025-10-03 | **2025-11-20** 08:30 |
| Employment Situation (Oct 2025) | n/a | **Never published.** Its payrolls data came out with November's report. |
| Employment Situation (Nov 2025) | 2025-12-05 | **2025-12-16** 08:30 |
| CPI (Sep 2025) | (on schedule) | **2025-10-24** (staff recalled to produce it) |
| CPI (Oct 2025) | n/a | No all-items or core figure was published |
| CPI (Nov 2025) | 2025-12-10 | **2025-12-18** 08:30 |
| PPI (Sep 2025) | n/a | **2025-11-25** |
| JOLTS (Sep 2025) | n/a | Cancelled; its data came out with October's |
| JOLTS (Oct 2025) | 2025-12-02 | **2025-12-09** |
| GDP Q3 2025 advance and second estimates, and Personal Income and Outlays for Jul–Sep | 2025-10-30 and 2025-11-26 | Combined into an "initial estimate" released **2025-12-23** 08:30 ([BEA](https://www.bea.gov/news/2025/gross-domestic-product-3rd-quarter-2025-initial-estimate-and-corporate-profits)) |
| GDP Q3 2025 third estimate | 2025-12-19 | **2026-01-22** 08:30 ([BEA](https://www.bea.gov/sites/default/files/2026-01/gdp3q25-updated.pdf)) |

Two of these matter for the spec. First, some releases were **cancelled outright** and never happened on any date. Second, the October 2026 Employment Situation date may have moved: BLS's per-release schedule shows Nov 6, 2026, and its November 2026 list shows Nov 10 ([BLS November 2026 schedule](https://www.bls.gov/schedule/2026/11_sched_list.htm)). That conflict comes from search snapshots and is unresolved here. Either way, upcoming dates can move after the bot first reads them.

## Candidates

### 1. FRED / ALFRED release dates API (St. Louis Fed)

- **Endpoints.**
  - `fred/release/dates` returns the dates of one release ([docs](https://fred.stlouisfed.org/docs/api/fred/release_dates.html)).
  - `fred/releases/dates` returns the dates of all releases and adds `release_name` ([docs](https://fred.stlouisfed.org/docs/api/fred/releases_dates.html)).
- **Parameters for `fred/release/dates`.**
  - `release_id`.
  - `realtime_start`, default `1776-07-04`, and `realtime_end`, default `9999-12-31`. So by default it returns every date ever, not only today's view. The all-releases endpoint differs: its `realtime_start` defaults to the first day of the current year.
  - `limit`, `offset` and `sort_order`.
  - `include_release_dates_with_no_data`, default `false`.
- **Actual vs scheduled dates.**
  - With the default `false`, dates with no data are left out. The docs say this "excludes future release dates which may be available in the FRED release calendar or the ALFRED release calendar." Set it to `true` to get **upcoming** dates. In XML, each date then gains a `release_last_updated` attribute.
  - Past dates are the dates data was posted. ALFRED's release-date list "contains the dates when any series from this release was revised. Note that all series from a release do not necessarily revise on every release date" ([ALFRED Employment Situation](https://alfred.stlouisfed.org/release?rid=50)). This has two consequences:
    1. **(a)** Past dates are actual dates, not originally scheduled ones. The shutdown-moved 2025-11-20 and 2025-12-16 Employment Situation dates both have ALFRED pages.
    2. **(b)** A release can have **extra dates** that are not market-moving release days, such as off-cycle revisions. The spec should check this against the official schedule for 2019 onward. **[unverified]**
- **Caveat on availability.** FRED says its release dates "are published by data sources and do not necessarily represent when data will be available on this website" ([releases_dates docs](https://fred.stlouisfed.org/docs/api/fred/releases_dates.html)).
- **Unknown: cancelled dates.** It is not known whether a scheduled date that was later cancelled (e.g. Employment Situation 2025-10-03) stays in the list when `include_release_dates_with_no_data=true`. **[unverified]** A safe query pattern: use `false` for dates up to today, and `true` only for dates after today.
- **Time of day.** None. The documented JSON gives only `release_id` and `date` per entry ([docs](https://fred.stlouisfed.org/docs/api/fred/release_dates.html)). The FRED *web* calendar does show times.
- **Coverage.**
  - Every listed release except ISM (removed 2016) and FOMC meeting days.
  - The FOMC release (rid=101) carries DFEDTARU and DFEDTARL, the Fed funds target range. These are "Daily, 7-Day" series ([DFEDTARU](https://fred.stlouisfed.org/series/DFEDTARU)), and FRED's 2026 calendar for rid=101 lists 365 dates ([2026 calendar rid=101](https://fred.stlouisfed.org/releases/calendar?rid=101&y=2026)). So its release dates are every day, not meeting days.
  - Since DFEDTARU's history in ALFRED starts in 2008, its vintages could in principle show the days the rate changed, but they would miss FOMC days with no change. **Use the Fed's own pages for FOMC.**
- **Impact rating.** None.
- **Cost.** Free. The terms describe FRED as offered for "non-commercial, educational, and personal uses", with commercial use subject to extra restrictions ([legal](https://fred.stlouisfed.org/legal/), [API terms](https://fred.stlouisfed.org/docs/api/terms_of_use.html)).
- **Terms that matter for this bot.**
  - The June 2024 terms update bars using the API "in connection with storing, caching, or archiving any portion of FRED Services or FRED Content", and for training machine-learning systems ([FRED news, June 2024](https://news.research.stlouisfed.org/2024/06/weve-updated-our-terms-of-use-action-requested/)).
  - Apps must show: "This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis."
  - Third-party copyright on data series is the user's concern. Release *dates* are not series data, but the caching clause still reads broadly.
  - **This is a decision for the user, not a technical gap.**
- **Auth.**
  - v1: an `api_key` query parameter. Requests with invalid keys are blocked ([API key](https://fred.stlouisfed.org/docs/api/api_key.html)).
  - API v2, launched 2025-11-04 ([announcement](https://news.research.stlouisfed.org/2025/11/fred-launches-new-version-of-api/)), puts the key in a `Bearer` header ([v2 key](https://fred.stlouisfed.org/docs/api/fred/v2/api_key.html)). The only v2 endpoint found is `fred/v2/release/observations`, so release dates stay on v1.
- **Rate limits.** FRED says it rate-limits and returns an error status when the limit is exceeded, but publishes no number ([errors](https://fred.stlouisfed.org/docs/api/fred/errors.html)). Third parties give **120 requests a minute per key**, with HTTP 429 when exceeded **[secondary]**. A whole calendar takes about 8 requests, so this is not a constraint.
- **How fast reschedules show up.** Not documented. For past dates this doesn't matter, because they are written when data posts. For future dates, FRED's calendar follows the source agencies' published schedules; how fast it changes after a reschedule is **[unverified]**. FRED warned that a shutdown "could delay some FRED data" ([FRED news, Sep 2025](https://news.research.stlouisfed.org/2025/09/a-u-s-government-shutdown-could-delay-some-fred-data-2/)).
- **Sample request and response.**

  ```
  GET https://api.stlouisfed.org/fred/release/dates?release_id=50&api_key=KEY&file_type=json&realtime_start=2019-01-01&sort_order=asc&include_release_dates_with_no_data=true
  ```

  ```json
  {"realtime_start":"2019-01-01","realtime_end":"9999-12-31","order_by":"release_date","sort_order":"asc",
   "count":0,"offset":0,"limit":10000,
   "release_dates":[{"release_id":50,"date":"2019-01-04"}, ...]}
  ```

  The field names are from the docs' example. The values shown are illustrative, and `limit` 10000 is from memory **[unverified]**.

### 2. Trading Economics calendar API

- **Endpoints.**
  - By country: `/calendar/country/{country}`, with a date-range form `/calendar/country/{country}/{d1}/{d2}` and an `importance=` filter ([by country](https://docs.tradingeconomics.com/economic_calendar/country/)).
  - Point-in-time: `/calendar/country/{countries}/indicator/{indicators}/{initDate}/{endDate}`. It returns events "exactly as they appeared on a specific date", and Trading Economics' MCP tool describes it as a view for backtesting without look-ahead bias ([point-in-time](https://docs.tradingeconomics.com/economic_calendar/point-in-time/), [MCP tools](https://docs.tradingeconomics.com/mcp/tools/)).
  - Also a snapshot of latest events with an "Updates" block, and streaming ([snapshot](https://docs.tradingeconomics.com/economic_calendar/snapshot/), [streaming](https://docs.tradingeconomics.com/economic_calendar/streaming/)).
- **Response fields** ([schema](https://docs.tradingeconomics.com/economic_calendar/schema/)).
  - `CalendarId`.
  - `Date`: the release date and time in **UTC**.
  - `Country`, `Category`, `Event`, `Reference` and `ReferenceDate`.
  - `Actual`, `Previous`, `Forecast` and `TEForecast`.
  - `Importance`: 1 is low, 2 is medium, 3 is high.
  - `DateSpan`: 0 means the date and time are known, 1 means they are estimated.
  - `LastUpdate`.
- **Coverage.** Global, about 1,600 events a month for 150+ countries **[secondary, attributed to TE docs]**. The docs' US examples include ISM Manufacturing PMI with Importance 3. Whether FOMC rate decisions are covered is **[unverified]**, though a general calendar would normally list them. **How far back the calendar goes is not stated**: the examples go back to 2016, and no earliest date is given.
- **Actual vs scheduled.** `Date` presumably holds the current (rescheduled) date and `LastUpdate` changes when a record changes. Neither is stated for reschedules, and how the 2025 shutdown was recorded is undocumented **[unverified]**. The point-in-time endpoint could show both what the calendar said beforehand and what happened.
- **Impact rating.** Yes, the 1–3 `Importance` scale, set by Trading Economics.
- **Cost and limits.**
  - Prices are behind an account login ([pricing](https://tradingeconomics.com/api/pricing.aspx)).
  - The free trial is capped at 100,000 data points and 100 requests, and becomes paid automatically.
  - Third parties disagree: Standard at $149 or $199 a month, Professional at $299 or $399 a month, Enterprise custom. They also disagree on whether the calendar is in Standard or Enterprise only **[secondary, conflicting]**.
  - The website membership ($199 a month) is separate from the API.
- **Rate limits.** About 2 requests a second by default, depending on plan. At most 1,000 rows per calendar call and 10,000 per historical call. URLs at most 260 characters. Throttling returns **409**, not 429, and 403 means the download limit was reached ([rate limits](https://docs.tradingeconomics.com/get_started/rate-limits/), [status codes](https://docs.tradingeconomics.com/get_started/response-status/)).
- **Auth.** A `c={api_key}` query parameter ([get started](https://docs.tradingeconomics.com/get_started/)). A public `guest:guest` key could not be confirmed.
- **Sample request.**

  ```
  GET https://api.tradingeconomics.com/calendar/country/united%20states/2019-01-01/2019-03-31?c=KEY&importance=3&f=json
  ```

  Each record has the fields above, e.g. `"Date":"2016-12-01T13:30:00"`, taken from the docs' point-in-time example.

### 3. Financial Modeling Prep (FMP) economic calendar

- **Endpoint.** `https://financialmodelingprep.com/stable/economic-calendar` ([docs](https://site.financialmodelingprep.com/developer/docs/stable/economics-calendar)). The legacy `api/v3/economic_calendar?from=YYYY-MM-DD&to=YYYY-MM-DD` route is documented with `from`/`to` parameters ([legacy docs](https://site.financialmodelingprep.com/developer/docs/economic-calendar-api/?direct=true)). The stable route probably takes the same parameters **[unverified]**.
- **Fields.** `event`, `date` (with a time), `country`, `actual`, `previous`, `change`, `estimate` and `impact`. `impact` was added per the [changelog](https://site.financialmodelingprep.com/developer/docs/changelog), and the example value is `"Medium"`. The time zone of `date` is not documented.
- **Range limit.** At most 90 days per request **[secondary, a third-party skill's validation]**.
- **Update cadence.** Every 10 minutes per [cycle times](https://site.financialmodelingprep.com/developer/docs/cycle-times), or every 15 minutes per the legacy docs. The two conflict.
- **Coverage, history depth, FOMC, reschedules.** Not documented. Which plan includes the calendar was not found.
- **Cost** ([pricing](https://site.financialmodelingprep.com/pricing-plans)).

  | Plan | Price | Rate | History |
  |---|---|---|---|
  | Basic (free) | free | 250 calls/day | not stated |
  | Starter | $29/mo ($19 annual) | 300/min | 5 years |
  | Premium | $69/mo ($49 annual) | 750/min | 30 years |
  | Ultimate | $139/mo ($99 annual) | 3,000/min | full |

  These history depths are for market data. That they apply to the calendar is **[unverified]**.
- **Auth.** An `apikey` query parameter.
- **Verdict.** Cheap, but nothing documented supports relying on its history back to 2019 or on how it handles reschedules.

### 4. Finnhub economic calendar

- **Endpoint.** `GET /calendar/economic?from=&to=&token=`. "Premium Access Required"; "Historical events and surprises are available for Enterprise clients" ([docs](https://finnhub.io/docs/api/market-news)).
- **Fields.** `economicCalendar[]` with `actual`, `country`, `estimate`, `event`, `impact` (lowercase, e.g. `"low"`), `prev`, `time` and `unit`.
- **Gaps.**
  - A user reports that `time` has **no time zone** and that records have no revision or last-update field ([GitHub issue #584](https://github.com/finnhubio/Finnhub-API/issues/584)) **[secondary]**. GitHub's API for that repo was blocked in this session, so the issue was not read directly.
- **Cost.** Free tier at 60 calls a minute, without the calendar. The All-In-One plan is $3,500 a month, billed annually ([pricing](https://api.finnhub.io/pricing)). The table cells for the calendar rows were empty in the snapshot.
- **Verdict.** History needs Enterprise, and times are ambiguous. Not suitable.

### 5. Nasdaq Data Link

No economic-calendar or release-date dataset was found ([Nasdaq Data Link](https://data.nasdaq.com/publishers/QDL)). Its old Quandl FRED mirror holds series values, not release dates, and users report it stopped updating in 2022 **[secondary]** ([QuantConnect forum](https://www.quantconnect.com/forum/discussion/15051/fred-data-in-research-jupyter-notebook/)). Nasdaq.com has an economic-calendar web page but no documented API ([Nasdaq calendar](https://www.nasdaq.com/market-activity/economic-calendar)). Not a candidate.

### 6. Forex Factory unofficial weekly feed

- **Endpoint.** `https://nfs.faireconomy.media/ff_calendar_thisweek.json` (also `.xml`). It has no official documentation.
- **Fields.** Event title, currency, date and time, impact, forecast and previous. **No actual value, and no earlier weeks** ([FF forum](https://www.forexfactory.com/thread/681293-where-to-find-ff-actual-calendar-data-within)) **[secondary]**.
- **Impact.** Red is high, orange medium, yellow low, set by Forex Factory ([FF news](https://www.forexfactory.com/news), [forum](https://www.forexfactory.com/thread/194536-reading-forex-factory-calendar)) **[secondary for the calendar]**.
- **Limits.** The file updates about once an hour. Fetching it too often returns a "Request Denied" page or Cloudflare error 1015 for about 5 minutes ([FF forum](https://www.forexfactory.com/thread/1311021-mql45-programmers-this-weekly-news-download-code-solves)) **[secondary]**.
- **Terms.** The calendar page points to [forexfactory.com/notices](https://www.forexfactory.com/notices), which was not readable here. Whether automated use is allowed is unknown.
- **Verdict.** Unsuitable. It has no history, so the backtest cannot share it with the live bot, and its terms are unclear.

### 7. Official schedules (fallback and cross-check)

- **Fed Board, FOMC.**
  - There is no API.
  - The per-year FOMC press-release lists (e.g. [2025](https://www.federalreserve.gov/newsevents/pressreleases/2025-press-fomc.htm), [2026](https://www.federalreserve.gov/newsevents/pressreleases/2026-press-fomc.htm)) give the actual statement days, unscheduled ones included.
  - The [FOMC calendars page](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm) gives upcoming meetings. It was not readable here.
  - An RSS feed of monetary-policy press releases is listed on the [feeds page](https://www.federalreserve.gov/feeds/feeds.htm); its exact URL was not confirmed.
  - The 2026 meetings are Jan 27–28, Apr 28–29, Jun 16–17, Jul 28–29, Sep 15–16, Oct 27–28 and Dec 8–9 (from the meeting pages above), with statements on the second day.
  - Unscheduled statements: 2020-03-03 at 10:00 ET and 2020-03-15 at 17:00 ET (both cited above).
- **BLS.**
  - Per-release schedule pages: [Employment Situation](https://www.bls.gov/schedule/news_release/empsit.htm), [CPI](https://www.bls.gov/schedule/news_release/cpi.htm), [PPI](https://www.bls.gov/schedule/news_release/ppi.htm).
  - An **iCalendar feed** at `https://www.bls.gov/schedule/news_release/bls.ics`. It is updated "as needed... usually at least a week before their scheduled publication date", on a tentative Friday 3:30 p.m. ET cycle ([BLS iCal help](https://www.bls.gov/help/hlpical.htm)). It is the most machine-readable official source for upcoming BLS dates.
  - The revised-dates page for the shutdowns ([BLS](https://www.bls.gov/bls/2025-lapse-revised-release-dates.htm)).
- **BEA.** A full release schedule ([BEA schedule](https://www.bea.gov/news/schedule/full)) and blog notices of reschedules ([2025-11-24](https://bea.gov/news/blog/2025-11-24/economic-release-schedule-updates-0), [2025-12-10](https://www.bea.gov/news/blog/2025-12-10/economic-release-schedule-updates)).
- **ISM.** A yearly release calendar page ([ISM](https://www.ismworld.org/supply-management-news-and-reports/reports/rob-report-calendar/)). There is no API.
- **Census (retail sales).** Not researched; it is in FRED.

## Summary table

| | FRED/ALFRED | Trading Economics | FMP | Finnhub | Nasdaq DL | Forex Factory feed | Official pages |
|---|---|---|---|---|---|---|---|
| Listed releases | All but ISM and FOMC | All (FOMC [unverified]) | Unknown | Unknown | None | All (this week) | All, across 4 sites |
| History from 2019 | Yes (decades) | Not stated | Not stated | Enterprise only | n/a | No | Yes (archives) |
| Actual (rescheduled) dates for past | Yes | Likely; point-in-time | Unknown | Unknown | n/a | n/a | Yes |
| Upcoming dates | Yes (`include_release_dates_with_no_data`) | Yes, `DateSpan` flags estimates | Yes | Yes | n/a | This week only | Yes; BLS has .ics |
| Time of day | No | Yes (UTC) | Yes (time zone unstated) | Yes (no time zone) | n/a | Yes | Yes |
| Impact rating | No | 1–3 | High/Medium/Low | low/medium/high | n/a | Red/orange/yellow | No |
| FOMC days | No (rid=101 is daily) | Likely | Unknown | Unknown | n/a | Yes | Yes |
| Cost | Free | Paid, price not public | $19–139/mo | $3,500/mo (Enterprise for history) | n/a | Free (unofficial) | Free |
| Auth | API key | API key | API key | Token | n/a | None | None |
| Automated-use terms | Allowed; bars caching and archiving | Contract | Contract | Contract | n/a | Unknown | Public pages |

## To verify with one live request each

1. `fred/release/dates?release_id=50&realtime_start=2025-09-01&include_release_dates_with_no_data=true`. Does it list 2025-10-03, the cancelled date? Does it list 2025-11-20 and 2025-12-16?
2. Same call with `false` for 2019–2025. Compare against BLS archive release dates for extra (revision-only) dates. Repeat for CPI (10), PPI, JOLTS, retail sales, GDP (53) and PCE.
3. `fred/releases` to confirm the release ids for PPI, JOLTS, retail sales and Personal Income and Outlays.
4. Read the current [FRED API terms](https://fred.stlouisfed.org/docs/api/terms_of_use.html) on storing and caching, and decide whether the backtest may keep a local copy.
5. If Trading Economics is considered: a trial call to `/calendar/country/united states/2019-01-01/2019-01-31?importance=3` to see how far back it goes, whether FOMC is present, and how the Sep 2025 Employment Situation appears (2025-11-20, and whether a 2025-10-03 entry remains).
6. Fetch `https://www.bls.gov/schedule/news_release/bls.ics` and check its fields (time zone, event names).

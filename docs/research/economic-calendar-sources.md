# Economic calendar sources that allow storage

Research for [#26](https://github.com/afloret-services/AITradingBot/issues/26), which follows [#25](https://github.com/afloret-services/AITradingBot/issues/25) ([findings](https://github.com/afloret-services/AITradingBot/blob/research/economic-calendar-api/docs/research/economic-calendar-api.md)). Researched 2026-10-28.

**Question.** Which sources give US release dates from 2019 onward and upcoming, with the dates releases actually came out, under terms that let the bot **store** what it fetches, so the live bot and a backtest from 2019 read the same stored calendar?

**Fixed by the user.** Storage is required. The releases are a fixed list with fixed New York times: CPI, NFP, PPI, retail sales, GDP and PCE at 08:30; ISM Manufacturing and JOLTS at 10:00; FOMC statements at 14:00 (unscheduled ones at their actual time). A cancelled release is not a News day.

## How this was researched, and its limits

- **No site could be fetched.** `curl` to bls.gov, bea.gov, federalreserve.gov, alphavantage.co, eodhd.com, polygon.io, econoday.com, query1.finance.yahoo.com and interactivebrokers.com all failed with `CONNECT tunnel failed, response 403` from the egress proxy. WebFetch of bls.gov failed with `getaddrinfo ENOTFOUND`. So, as in #25, **no page or API response was seen first-hand**.
- **Every fact below comes from web-search results** quoting the owner's page, restricted to the owner's domain where possible. Quotes are as the search tool returned them; they may be trimmed or stale.
- **[secondary]** marks a third-party claim. **[unverified]** marks inference or memory that needs one live check. **[legal]** marks a reading of terms that is not legal advice.
- This file does not repeat #25. FRED, Trading Economics, FMP, Finnhub, Nasdaq Data Link and the Forex Factory feed are covered there; only their storage terms are added here.

## Recommendation

**Primary: build the bot's own stored calendar from the agencies' own pages and feeds.** BLS (CPI, NFP, PPI, JOLTS), BEA (GDP, PCE), Census (retail sales) and the Federal Reserve Board (FOMC) all state that their web content is public domain. ISM's dates are derived from ISM's published rule rather than stored from ISM's pages.

- **Storage.** Allowed. Each agency says its material may be reproduced without permission and asks only for credit (quotes in [Storage terms of the agencies](#storage-terms-of-the-agencies)).
- **Cost.** Free. No key or account for the pages and feeds below.
- **History.** 2019 onward is covered by per-release archives (BLS), yearly published schedules plus release pages (BEA), historical release PDFs (Census) and per-year FOMC pages (Fed).
- **Actual dates.** The archives list releases that were *published*, on the day they came out, so a moved release shows on its new date and a cancelled one is simply absent. That is exactly the News-day rule.
- **Upcoming dates.** BLS `bls.ics`, BEA's ICS and JSON schedule, Census's release-schedule page, the Fed's FOMC calendar page.
- **Cost of choosing it.** Four sites, four formats, and HTML for history. It is a one-off backfill for 2019 to today plus a small fetch per agency for upcoming dates. The bot stores the result and both live and backtest read only the store.

**Fallback: EODHD Economic Events API**, on the Fundamentals Data Feed ($59.99 a month) or All-In-One ($99.99 a month).

- It is the only commercial candidate found whose own terms say storage is allowed: "Non-Professional Users are permitted to store, manipulate, and analyze the data for private, non-commercial purposes" ([EODHD terms](https://eodhd.com/financial-apis/terms-conditions)).
- That covers only a **Non-Professional User**, someone using the data for "their own personal investment activity", not for a business. A bot trading the user's own account looks like that. If it ever trades for anyone else, it needs a commercial licence **[legal]**.
- Against it: history starts in 2019 or 2020 (sources conflict), FOMC coverage and cancellation handling are undocumented, and the time zone of `date` is not stated. Use it only if the agency route proves too much work, and check it against the agency archives for the shutdown cases.

**If budget allows a contract instead:** Econoday licenses archives "dating back to 2001" through enterprise APIs, with price on request ([Econoday enterprise](https://www.econoday.com/enterprise/global-economic-data/)). Storage terms would be in the contract.

## Storage terms of the agencies

| Agency | What it says | Source |
|---|---|---|
| BLS | "everything that we publish, both in hard copy and electronically, is in the public domain, except for previously copyrighted photographs and illustrations." Also: "you are free to use our public domain material without specific permission, although we do ask that you cite the Bureau of Labor Statistics as the source." | [BLS copyright information](https://www.bls.gov/opub/copyright-information.htm), [linking and copyright](https://www.bls.gov/bls/linksite.htm) |
| BEA | "unless stated otherwise, the information posted on the BEA web site is in the public domain and may be used or reproduced without specific permission." A citation "Source: U.S. Bureau of Economic Analysis" "would be appreciated". | [BEA FAQ 147](https://www.bea.gov/help/faq/147), [FAQ 145](https://www.bea.gov/help/faq/145) |
| Census | "Data/works created by Census Bureau employees generally are not subject to copyright protection within the United States." | [Census data stewardship policy DS027](https://www2.census.gov/foia/ds_policies/ds027.pdf), [citation guidance](https://www.census.gov/about/policies/citation.html) |
| Federal Reserve Board | Unless marked otherwise, material on federalreserve.gov is public domain and may be copied and distributed without permission; credit to the Board is requested. Third-party material, seals and logos are excepted. (Paraphrase from search; the exact wording was not returned.) | [Fed Board disclaimer](https://www.federalreserve.gov/disclaimer.htm) |
| ISM (not an agency) | "ISM PMI® Content is protected by copyright, trademark, trade secret, and other laws". "Except as provided herein or as explicitly allowed in writing by ISM, you shall not copy, download... or otherwise use any ISM PMI® Content." | ISM PMI report pages, e.g. [September 2026 Manufacturing PMI](https://www.ismworld.org/supply-management-news-and-reports/reports/ism-pmi-reports/pmi/september/) |

Notes:

- **Why the agencies are public domain.** Works of US federal employees have no US copyright (17 U.S.C. 105). Census cites it directly ([X-13 licence](https://www.census.gov/data/software/x13as/disclaimer.html)). BLS, BEA, Census and the Fed Board each say so on their own pages above.
- **FRED is not in this group.** The St. Louis Fed is a Reserve Bank, not a federal agency, so FRED's content is under its own terms, which bar "storing, caching, or archiving" (see #25) **[legal, inference]**. The same applies to Alpha Vantage's economic series, which are pulled from FRED and bound by the FRED API terms (below).
- **ISM dates.** ISM's terms restrict its *PMI content*. A release date is a fact, and ISM states the rule publicly: Manufacturing PMI at 10:00 a.m. ET on the first business day of the month, "Unless the New York Stock Exchange is closed" (ISM report pages above; the 2026 calendar moved January to the 5th for an ISM holiday, per #25). The bot can compute the dates from that rule and an NYSE holiday list, and store its own computed table, without storing any ISM page **[legal, interpretation]**. The exceptions (such as January 2026) mean the computed table should be checked against ISM's yearly [release calendar](https://www.ismworld.org/supply-management-news-and-reports/reports/rob-report-calendar/) once a year, by a person if need be.

## The agency route in detail

### BLS: CPI, Employment Situation (NFP), PPI, JOLTS

- **Upcoming.** iCalendar feed `https://www.bls.gov/schedule/news_release/bls.ics`. It "contains publication dates for most news releases scheduled to be issued by the BLS national office in upcoming months" and is "updated as needed with additional news releases, usually at least a week before their scheduled publication date" ([BLS iCal help](https://www.bls.gov/help/hlpical.htm), [Employment Situation schedule](https://www.bls.gov/schedule/news_release/empsit.htm)). Per-release schedule pages exist for [CPI](https://www.bls.gov/schedule/news_release/cpi.htm), [PPI](https://www.bls.gov/schedule/news_release/ppi.htm) and [JOLTS](https://www.bls.gov/schedule/news_release/jolts.htm).
- **History (actual dates).** Per-release archives list every published release, e.g. [Employment Situation archive](https://www.bls.gov/bls/news-release/empsit.htm) and [CPI archive](https://www.bls.gov/bls/news-release/cpi.htm), with monthly 2019 entries. Archived release URLs carry the release date, e.g. `news.release/archives/jolts_12092025.htm` for the release of 2025-12-09 ([example](https://www.bls.gov/news.release/archives/jolts_12092025.htm)). Using the archive, not the schedule, is what gives actual dates **[unverified: that the archive lists every release with its date in a parseable form]**.
- **Scheduled dates, for comparison only.** Yearly schedules such as [2019](https://www.bls.gov/schedule/2019/home.htm) (last modified 2019-03-05, so a snapshot, not a record of what happened) and [prior years](https://www.bls.gov/bls/archived_sched.htm).
- **Times.** 08:30 ET for CPI, NFP and PPI (#25). JOLTS: "estimates are released at 10 a.m. eastern time on the publication dates" ([JOLTS home](https://www.bls.gov/jlt/)); the next one is 2026-11-03 at 10:00. This confirms the JOLTS time #25 left from memory.
- **Cancellations.** The [2025 lapse revised-dates page](https://www.bls.gov/bls/2025-lapse-revised-release-dates.htm) records moves and cancellations (table in #25). A cancelled release has no archive entry. Whether `bls.ics` *removes* a cancelled event or leaves the old date in place is **[unverified]**; the archive check after the fact handles it either way.
- **Format.** ICS for upcoming; HTML for history. No auth, no published rate limit.

### BEA: GDP, Personal Income and Outlays (PCE)

- **Upcoming.** The [release schedule](https://www.bea.gov/news/schedule) lists "Additional Formats": an online calendar subscription (ICS, [subscription page](https://www.bea.gov/news/schedule/icalendar)) and a machine-readable JSON file. The JSON's URL and fields were not returned by search **[unverified]**. A third-party project describes it as "one JSON file of every release into 2027" **[secondary]** ([GitHub PR](https://github.com/KrustyKronk/bedrok/pull/14)). BEA posts the next year's schedule "three months before the beginning of a new calendar year" ([BEA posting policy](https://www.bea.gov/about/policies-and-information/priorities-and-schedules-posting-content)).
- **History.** Yearly schedules in the Survey of Current Business, e.g. [2019 schedule](https://apps.bea.gov/scb/issues/2018/12-december/1218-news-releases-2019.htm), [2020](https://apps.bea.gov/scb/issues/2019/12-december/1219-news-releases-2020.htm), [2021](https://apps.bea.gov/scb/issues/2020/12-december/1220-news-releases-2021.htm), [2022](https://apps.bea.gov/scb/issues/2021/12-december/1221-news-releases-2022.htm). These are *scheduled* dates. Actual dates come from the release pages themselves (e.g. [Personal Income and Outlays, June 2019](https://www.bea.gov/news/2019/personal-income-and-outlays-june-2019)) and from blog notices of changes.
- **2019 is not clean.** The 2018–19 shutdown moved BEA releases: a combined "initial" Q4 2018 GDP report was set for 2019-02-28 ([BEA blog 2019-01-30](https://www.bea.gov/news/blog/2019-01-30/new-dates-set-some-delayed-releases), [2019-02-06](https://www.bea.gov/news/blog/2019-02-06/new-dates-set-gdp-personal-income-and-international-trade)), and the schedule was back to normal by April ([2019-04-02](https://www.bea.gov/news/blog/2019-04-02/national-statistics-return-normal-timetable-april)). The backfill must use release pages, not the yearly schedule, for early 2019.
- **Times.** 08:30 ET "unless otherwise noted". The 2019 schedule put Personal Income and Outlays for October and November 2019 at 10:00 a.m. instead ([2019 schedule](https://apps.bea.gov/scb/issues/2018/12-december/1218-news-releases-2019.htm)) **[unverified: exact dates; check the PDF]**. Those two PCE releases fall inside the 10:00–11:00 window, so the fixed 08:30 time in the issue is wrong for them.
- **Cancellations.** Recorded in blog notices ([2025-11-24](https://bea.gov/news/blog/2025-11-24/economic-release-schedule-updates-0), [2025-12-10](https://www.bea.gov/news/blog/2025-12-10/economic-release-schedule-updates), [2026-02-23](https://www.bea.gov/news/blog/2026-02-23/economic-release-schedule-update)). Whether a cancelled release leaves the ICS/JSON or stays is **[unverified]**.

### Census: Advance Monthly Retail Sales

- **Upcoming.** [Release schedule page](https://www.census.gov/retail/release_schedule.html) and a [scheduled-dates PDF](https://www.census.gov/retail/marts/www/martsdates.pdf). Next: October 2026 data on 2026-11-17 at 8:30 a.m.
- **History.** Each advance report is kept as a PDF under `www2.census.gov/retail/releases/historical/marts/advYYMM.pdf` (e.g. [adv2605.pdf](https://www2.census.gov/retail/releases/historical/marts/adv2605.pdf)). The release date is printed in each PDF's header, so a backfill reads 2019–2026 from these files **[unverified: that the folder covers 2019 and every header has the date]**.
- **Not in #25.** #25 left retail sales to FRED. With FRED ruled out by storage, Census is the source.

### Federal Reserve Board: FOMC statements

- **History.** One page per year, e.g. [2019](https://www.federalreserve.gov/monetarypolicy/fomchistorical2019.htm) and [2020](https://www.federalreserve.gov/monetarypolicy/fomchistorical2020.htm), listing each meeting with its statement, unscheduled ones included. 2019 lists an unscheduled October 4 meeting whose statement came out October 11, 2019. 2020 lists the unscheduled March 15 meeting and the March 23 notation-vote statement, and shows that **the scheduled March 17–18, 2020 meeting was cancelled**. Recent years are on the yearly FOMC press-release lists ([2025](https://www.federalreserve.gov/newsevents/pressreleases/2025-press-fomc.htm), [2026](https://www.federalreserve.gov/newsevents/pressreleases/2026-press-fomc.htm)) until they move to a historical page.
- **Upcoming.** [FOMC calendars page](https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm). 2026 meetings are listed in #25.
- **Times.** 14:00 ET for scheduled statements. Unscheduled: 2020-03-03 at 10:00 ET and 2020-03-15 at 17:00 ET (#25). The 2019-10-11 and 2020-03-23 statement times were not found **[unverified]**; the bot must store a time per statement, not assume 14:00.
- **FOMC coverage in commercial feeds** is generally undocumented (see the table); the Fed pages are the only source here that clearly lists unscheduled statements.

### OMB schedule of Principal Federal Economic Indicators (cross-check)

OMB publishes each year's scheduled dates for all Principal Federal Economic Indicators in one PDF, e.g. [2019](https://statspolicy.gov/assets/fcsm/files/docs/OMB_pfei_schedule_of_releasedates_2019.pdf), with schedules for 2017 through 2026 on [statspolicy.gov](https://statspolicy.gov/policies/). It covers BLS, BEA and Census releases (not FOMC, not ISM). It is a *scheduled* list, so it is useful to diff against the archives and spot moves, not as the record of News days. Public domain as a federal work.

## Commercial and other candidates

| Candidate | Covers the list? | History from 2019 | Actual vs scheduled; cancellations | Cost | Storage terms | Verdict |
|---|---|---|---|---|---|---|
| **EODHD Economic Events** | US events by `type`; FOMC unknown | 2019 per QuantConnect, 2020 per EODHD's own tutorial (conflict) | Unknown; no update/cancel field documented | $59.99/mo Fundamentals or $99.99/mo All-In-One | Non-Professional Users "permitted to store, manipulate, and analyze the data for private, non-commercial purposes"; no redistribution | **Fallback** |
| **Econoday** | Yes (US calendar incl. Fed) | Archives "dating back to 2001" | Shows actual and revisions; reschedule handling unknown | Price after a demo | By licence contract (not public) | Contract option |
| **IBKR: Wall Street Horizon** | **No.** Corporate events only | n/a | n/a | WSH subscription | n/a | Rejected |
| **IBKR: Econoday in TWS** | Yes, but in the app | n/a via API | n/a | Free | Display only; no API | Rejected |
| **Alpha Vantage** | No calendar; series values only | n/a | n/a | Free 25 req/day; premium paid | Series are from FRED and bound by FRED's terms | Rejected |
| **Massive (Polygon)** | No calendar found; Economy endpoints give values | n/a | n/a | Included in plans | n/a | Rejected |
| **Benzinga** | Economics calendar with `importance` 0–5 | Not stated | Has an `updated` field | Licence, price on request | Not public; website terms bar redistribution | Rejected (unknown terms) |
| **Tradier** | No. Only market clock and trading-day calendar | n/a | n/a | n/a | n/a | Rejected |
| **Yahoo Finance** | No official API since 2017; unofficial endpoints undocumented | Unknown | Unknown | Free | No grant; unofficial use | Rejected |
| **Investing.com** | Yes (website) | Yes (website) | Website | Free | Bars automated extraction and storage (quoted below) | Rejected |
| **MarketWatch** | Website only; no API found | n/a | n/a | n/a | Terms not found | Rejected |
| **Morningstar** | No macro calendar product found (company Key Events only) | n/a | n/a | Enterprise | n/a | Rejected |
| **LSEG Workspace / Bloomberg** | Yes | Yes (Bloomberg point-in-time back to 1997) | Yes | ~$22k/yr per LSEG seat **[secondary]**; Bloomberg Data License by contract | By contract; terminal data not for storing outside | Rejected on cost |
| **FRED** (#25) | All but ISM, FOMC | Decades | Actual past dates | Free | Bars "storing, caching, or archiving" | Rejected on storage |
| **Trading Economics** (#25) | All | Not stated | Point-in-time endpoint | Not public | "limited, personal, nontransferable, revocable license to analyse data"; storage not granted in what was found | Rejected unless contract allows |
| **FMP** (#25) | Unknown | Unknown | Unknown | $19–139/mo | Bars copying or downloading content "except with the prior written approval of FMP"; delete "including cached data" on termination | Rejected |

### EODHD Economic Events API (fallback)

- **Endpoint.** `GET https://eodhd.com/api/economic-events?api_token=…&from=YYYY-MM-DD&to=YYYY-MM-DD&country=US` ([docs](https://eodhd.com/financial-apis/economic-events-data-api)). Other parameters: `comparison` (mom, qoq, yoy), `type` (one event), `offset`, `limit` (0–1000, default 50).
- **Fields.** `type`, `comparison`, `period`, `country`, `date` as `YYYY-MM-DD HH:MM:SS`, `actual`, `previous`, `estimate`, `change`, `change_percentage` ([docs](https://eodhd.com/financial-apis/economic-events-data-api)). No importance, no time zone stated, no last-updated or status field. A cancelled release would presumably have `actual` null, but that cannot be told apart from an upcoming one **[unverified]**.
- **History.** "available historically starting with 2020" per EODHD's own tutorial ([EODHD academy](https://eodhd.com/financial-academy/stocks-data-analysis-examples/how-to-get-economic-events-data-with-python), an older page); QuantConnect's copy says the data starts January 2019 **[secondary]** ([QuantConnect](https://www.quantconnect.com/data/eodhd-economic-events)). If it starts in 2020, 2019 needs the agency route anyway.
- **Plan and cost.** The calendar "is part of the Fundamental API and is accessible under the Fundamental Data Feed subscription" (per search, from EODHD's pages). Fundamentals Data Feed $59.99/mo or $599.90/yr; All-In-One $99.99/mo or $999.90/yr ([pricing](https://eodhd.com/pricing)). Free plan: 20 calls a day.
- **Rate limits.** 100,000 API calls a day on paid plans **[secondary]**; Fundamentals-type calls cost 10 each, so about 10,000 requests a day **[secondary]**. Ample.
- **Storage terms** ([terms](https://eodhd.com/financial-apis/terms-conditions)):
  - Non-Professional User: uses the data only for personal investment activity and does not act "as principals, officers, partners, employees, contractors, or agents of any business, nor do they use the Information on behalf of any other individual or business."
  - "Non-Professional Users are permitted to store, manipulate, and analyze the data for private, non-commercial purposes."
  - Barred: "Sharing access to their account with others, including within groups" and "Selling, reselling, retransmitting, redistributing, displaying, or granting access to the Information or Services".
  - So a stored local calendar for the user's own bot is allowed; publishing it (for example committing the data to a public repo) is not **[legal]**.

### Econoday

- Enterprise calendar with "historical archives dating back to 2001 with consensus data and revisions", delivered by API, HTML or XML ([Econoday enterprise](https://www.econoday.com/enterprise/global-economic-data/), [partners](https://www.econoday.com/partners/)). Pricing is given after a demo **[secondary]** ([FXMacroData comparison](https://fxmacrodata.com/articles/fxmacrodata-vs-econoday)). TMX resells an Econoday-licensed calendar with 5 years of history ([TMX](https://www.tmxinfoservices.com/corporate-and-reference-data/global-corporate-events/economic-calendar)). Storage terms are whatever the licence says; none are public.

### Interactive Brokers

- **Wall Street Horizon via TWS API** (`reqWshMetaData`, then `reqWshEventData`) covers "earnings dates, dividend dates, options expiration dates, splits, spinoffs and a wide variety of investor-related conferences". No macro releases were found. It needs the "Wall Street Horizon Enchilada Pro research subscription" ([IBKR WSH introduction](https://www.interactivebrokers.com/docs/tws-api/doc/wall-street-horizon/event-data/introduction), [request event data](https://www.interactivebrokers.com/docs/tws-api/doc/wall-street-horizon/event-data/request-event-data)).
- **Econoday in TWS.** IBKR offers Econoday's calendar free, but "Econoday is available in TWS mobile only" ([IBKR Econoday](https://investors.interactivebrokers.com/en/index.php?f=28485), [providers](https://www.interactivebrokers.com/en/trading/providers/econoday.php)). An older article describes an Events Calendar in desktop TWS with Econoday events **[secondary]** ([FX News Group](https://fxnewsgroup.com/forex-news/platforms/interactive-brokers-enhances-events-calendar-in-tws-platform/)). No TWS API call for it was found.
- **Verdict.** The bot's existing IB connection gives no usable economic calendar.

### Alpha Vantage

- Has `CPI`, `NONFARM_PAYROLL`, `FEDERAL_FUNDS_RATE` and similar endpoints that return *values by reference period*, not release dates ([docs](https://www.alphavantage.co/documentation/)). The docs say the data "uses the FRED® API" and "By using this data feed, you agree to be bound by the FRED® API Terms of Use", which bar storage (#25).
- A `/calendar/economic` "Premium Access Required" endpoint is claimed by one third party **[secondary, likely confused with Finnhub's wording]**; Alpha Vantage's own docs as returned show none. Alpha Vantage's own terms on caching were not found.

### Massive (formerly Polygon.io)

- The Economy API has 5 endpoints (Treasury yields, inflation, inflation expectations, labor market, funding conditions) from "the Federal Reserve and other official government sources" ([overview](https://massive.com/docs/rest/economy/overview), [changelog](https://massive.com/changelog)). They give values, not a release calendar. No calendar endpoint was found.

### Benzinga

- Economics calendar under `https://api.benzinga.com/api/v2.1/calendar/…` with `parameters[date_from]`, `parameters[date_to]` and `importance` (0–5), returning `date`, `time`, `country`, `event_name`, `event_period`, `actual`, `consensus`, `prior`, `importance`, `updated` ([docs index](https://docs.benzinga.com/llms-full.txt), [Python client](https://github.com/Benzinga/benzinga-python-client)). History depth, price and storage terms are not public; access is via licensing@benzinga.com ([quickstart](https://docs.benzinga.com/introduction/introduction)).

### Tradier

- Only `GET /v1/markets/clock` and `GET /v1/markets/calendar` (trading days, by month and year 2000–2050) ([calendar](https://documentation.tradier.com/brokerage-api/markets/get-calendar), [clock](https://documentation.tradier.com/brokerage-api/markets/get-clock)). No economic events.

### Yahoo Finance, Investing.com, MarketWatch, Morningstar

- **Yahoo.** The official API was discontinued in 2017; yfinance's calendar methods are per ticker (earnings) ([yfinance reference](https://ranaroussi.github.io/yfinance/reference/index.html)). An unofficial economic-events endpoint exists in third-party code but is undocumented and unversioned **[secondary]**. No licence to store.
- **Investing.com.** Its terms forbid "automated systems or software to extract data or content from the website for any purpose, including scraping, data mining, and robot or spider programs", and say it "is prohibited to use, store, reproduce, display, modify, transmit or distribute the data without explicit prior written permission of Fusion Media and/or the data provider" ([terms](https://www.investing.com/about-us/terms-and-conditions), [PDF](https://cdn.investing.com/about-us/terms_and_conditions.pdf)) (search paraphrase plus quote). Its site also uses Cloudflare challenges **[secondary]**.
- **MarketWatch.** No API or calendar licence was found; terms not found.
- **Morningstar.** Its developer docs have a company "Key Events" package, not a macro calendar ([Direct Web Services](https://developer.morningstar.com/direct-web-services/documentation/data-and-research/equity-data)).

### LSEG and Bloomberg

- **LSEG Workspace** is quote-only; reported prices are about $22,000 a year per named seat, or from about $3,600 for a reduced configuration **[secondary]** ([Vendr](https://www.vendr.com/marketplace/refinitiv)). No retail plan with an economic calendar API was found.
- **Bloomberg.** Terminal users can pull release dates with the bulk field `ECO_RELEASE_DT_LIST` (as used via [Rblpapi](https://rdrr.io/cran/Rblpapi/man/bds.html)) **[secondary]**. Bloomberg sells an "Economic Releases and Surveys Point-in-Time" dataset back to 1997 via Data License ([FX News Group](https://fxnewsgroup.com/forex-news/institutional/bloomberg-launches-economic-releases-and-surveys-point-in-time-dataset/)). Both cost far more than the bot warrants.

## Facts the spec needs

1. **Store, don't fetch per run.** The bot keeps one table of News days (release, date, New York time), backfilled once for 2019 to today and topped up from upcoming feeds. Live and backtest read only that table.
2. **A News day is a date in an agency's archive of published releases**, not a date in a schedule. Schedules (BLS yearly pages, BEA SCB schedules, OMB PFEI PDFs, ICS feeds) only predict; after the date, the archive decides. This handles moved and cancelled releases the same way.
3. **Sources per release:** CPI, NFP, PPI, JOLTS from BLS; GDP, PCE from BEA; retail sales from Census; FOMC from the Fed Board; ISM computed from ISM's rule plus NYSE holidays, checked yearly against ISM's calendar.
4. **Times per entry, not per release type.** Exceptions found: FOMC 2020-03-03 at 10:00 and 2020-03-15 at 17:00; PCE for October and November 2019 at 10:00 per BEA's 2019 schedule **[unverified dates]**.
5. **Known cancellations to test:** FOMC 2020-03-17/18 meeting (cancelled); the 2025 shutdown cases in #25 (Oct 2025 NFP never published, Sep 2025 JOLTS cancelled, Q3 2025 GDP advance and second estimates combined into 2025-12-23); 2019 BEA shutdown moves (combined Q4 2018 GDP on 2019-02-28).
6. **Credit.** Agencies ask for a source citation; a note in the repo listing BLS, BEA, Census and the Federal Reserve Board as sources satisfies that.

## Not verified

- **Nothing was fetched first-hand.** All network access to the sites was blocked; facts are from search snippets.
- The exact wording of the Fed Board disclaimer (only a paraphrase came back).
- Whether BLS archive pages and Census `advYYMM.pdf` files cover every release from 2019 in a parseable form.
- BEA's JSON schedule URL and fields; whether BEA's and BLS's ICS feeds drop cancelled events.
- The dates and times of the 10:00 PCE releases in late 2019; the times of the 2019-10-11 and 2020-03-23 FOMC statements.
- EODHD: start year (2019 vs 2020), US event names, FOMC coverage, time zone of `date`, cancellation handling, and which plan includes the calendar.
- That computing ISM dates from ISM's rule is outside ISM's content terms **[legal]**.

## To verify with one request each (needs network access)

1. `https://www.bls.gov/schedule/news_release/bls.ics`: fields, time zone, how far ahead it reaches, and whether past events stay.
2. `https://www.bls.gov/bls/news-release/empsit.htm`: does it list each 2019–2026 release with its date, and no October 2025 entry?
3. BEA schedule page: follow the JSON link; record URL and fields.
4. `https://www2.census.gov/retail/releases/historical/marts/`: confirm files from `adv1901.pdf` onward.
5. `https://www.federalreserve.gov/monetarypolicy/fomchistorical2020.htm`: confirm statement dates and the cancelled March 17–18 meeting.
6. `https://www.federalreserve.gov/disclaimer.htm`: quote the public-domain sentence.
7. EODHD (free key): `economic-events?from=2019-01-01&to=2019-01-31&country=US`, then 2025-10-01 to 2025-12-31 to see how the shutdown appears.

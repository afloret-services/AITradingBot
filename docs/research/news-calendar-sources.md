# News calendar: agency sources checked first-hand

Resolves [Verify the agency sources for the News calendar](https://github.com/afloret-services/AITradingBot/issues/27). All requests made on 2026-10-28 from a Claude Code cloud session, with the User-Agent `AITradingBot research <contact email>`.

## Verdict

| Source | Live schedule | History 2019– | Usable |
| --- | --- | --- | --- |
| BLS (Employment Situation, CPI, PPI, JOLTS) | `bls.ics` | archive pages | Yes |
| BEA (GDP, Personal Income and Outlays) | `release_dates.json` | news archive | Yes |
| Census (Advance Retail Sales) | not checked (`www.census.gov` blocked here) | `www2` PDFs | History yes, live unverified |
| Fed (FOMC statements) | `fomccalendars.htm` | `fomchistorical2019/2020.htm` + calendars page | Yes |
| ISM (Manufacturing and Services PMI) | current-year calendar page | none found on ismworld.org | Live yes, history no |
| EODHD | — | — | Not checked (needs a key) |

## BLS

- **Bot rule:** `www.bls.gov` returns 403 to curl's default User-Agent and 200 to one that names a contact. The builder must send a User-Agent with a contact address.
- **`https://www.bls.gov/schedule/news_release/bls.ics`:** 313 `VEVENT`s, `DTSTART;TZID=US-Eastern:YYYYMMDDTHHMMSS`, `DURATION:PT0M`, `SUMMARY` = release name (e.g. `Employment Situation`, `Consumer Price Index`), `UID` a GUID, `SEQUENCE:1`, no `STATUS`. Events span 2025-01-03 to 2026-12-30 only: the previous year plus the current year. Past events stay for that span. Cancelled releases are absent, not marked: no October 2025 Employment Situation, CPI or PPI. Delayed ones appear on their actual date (September 2025 Employment Situation on 2025-11-20). The times are only 08:30 and 10:00.
- **Archive pages** (`/bls/news-release/{empsit,cpi,ppi,jolts}.htm`): rows are labelled by reference month. Each row links to `/news.release/archives/<code>_MMDDYYYY.{htm,pdf}`, and **the release date is in the file name**. Every year 2019–2024 has 12 for all four series. 2025 has 11 for Employment Situation, CPI and JOLTS and 10 for PPI. October 2025 Employment Situation reads "Not published because of 2025 lapse in federal government appropriations", with no link. For 2025–2026 the archive dates match the ICS exactly for all four series.
- **Trap:** `empsit.htm` carries links for 2026-11-06 and 2026-12-04 inside an HTML comment. Strip comments before parsing.
- **Times:** the archive gives none. Each release's own page states it, e.g. "embargoed until 8:30 a.m. (EST) Friday, January 4, 2019". Spot-checked: Employment Situation 2019-01-04 and 2020-03-06 at 8:30, CPI 2019-01-11 at 8:30, PPI 2019-01-15 at 8:30, JOLTS 2019-01-08 at 10:00.

## BEA

- **Schedule JSON:** `https://apps.bea.gov/API/signup/release_dates.json`, linked from `https://www.bea.gov/news/schedule`. Shape: `{"<release name>": {"release_dates": ["2025-01-30T13:30:00+00:00", …]}, …, "file_last_updated": "2026-10-22T12:48:27.656675"}`. Times are UTC. It spans 2025-01 to 2027-12 and holds some exact duplicate entries. It includes `Gross Domestic Product` and `Personal Income and Outlays`, 35 dates each. Also offered: an ICS at `/news/schedule/ics/online-calendar-subscription.ics` and RSS.
- **History:** `https://www.bea.gov/news/archive?field_related_product_target_id=<id>&page=<n>`, with id 451 for Gross Domestic Product and 476 for Personal Income. It lists title, date and link from 2004, with 12 per year for 2020–2024 and 11 in 2019 (the January 2019 shutdown merged releases: Personal Income and Outlays for December 2018 came out on 2019-02-19, GDP Q4 2018 on 2019-02-28). The archive gives dates only. Each release page states its time ("EMBARGOED UNTIL RELEASE AT …").
- **Late-2019 10:00 releases:** Personal Income and Outlays for October 2019 came out on 2019-11-27 and for November 2019 on 2019-12-20, both at **10:00 a.m. EST**, on the same days as GDP at 8:30. September 2019 (2019-10-31) and December 2019 (2020-01-31) were at 8:30. The JSON shows the same pattern recurring: 2025-12-05 Personal Income and Outlays at 15:00 UTC = 10:00 EST.

## Census

- **`https://www2.census.gov/retail/releases/historical/marts/`:** 848 files, including `adv1901.pdf` through `adv2608.pdf` with no gaps. The file name is the **reference month**. The directory's timestamps are file mtimes, not release times (`adv2509.pdf` shows 08:45).
- **Release date:** page 1 of every PDF opens with `FOR RELEASE AT 8:30 AM EST, THURSDAY, FEBRUARY 14, 2019`. All 93 files from `adv1812` to `adv2608` parsed with `pdftotext`, every one at 8:30. Shutdown delays show up (January 2019 data on 2019-03-11, September 2025 on 2025-11-25).
- **Lag:** the folder's newest file is August 2026 data (released 2026-09-16), so it is no live schedule. `www.census.gov` (economic-indicator calendar, `marts_current.pdf`) was refused by this session's network proxy, so Census's forward schedule is **unverified**.

## Federal Reserve

- **Pages:** `fomchistorical2019.htm` and `fomchistorical2020.htm` exist. **2021–2026 return 404**: historical pages lag about five years. `fomccalendars.htm` covers 2021–2027, so the two together cover 2019 onward.
- **Statement links:** every statement links to `/newsevents/pressreleases/monetaryYYYYMMDDa.htm`, which states "For release at 2:00 p.m. EDT". The date is in the URL.
- **Unscheduled 2019–2020:**
  - "October 4 (unscheduled) … Statement (Released October 11, 2019)": "Statement Regarding Monetary Policy Implementation" at 11:00 a.m. EDT.
  - 2020-03-03 at 10:00 a.m. EST.
  - "March 15 (unscheduled)" at 5:00 p.m. EDT.
  - "March 17-18 (cancelled) Meeting - 2020".
  - "March 23 (notation vote)" statement at 8:00 a.m. EDT.
- **Not FOMC statements:** the pages also link non-statement releases in the same URL pattern, so filter by title ("issues FOMC statement"). Seen: 2020-03-31 FIMA repo facility, 2020-08-27 and 2025-08-22 Longer-Run Goals strategy updates.
- **Count:** 68 links 2019–2026, all scheduled statements at 2:00 p.m. The 2026-10-28 statement was not out yet at the time of the check.
- **Public domain** (`https://www.federalreserve.gov/disclaimer.htm`): "Unless otherwise indicated, information on Board's website is in the public domain and may be copied and distributed without permission. Please cite to the Board as the source of the information."

## ISM

- **Calendar page:** `https://www.ismworld.org/supply-management-news-and-reports/reports/rob-report-calendar/` shows **2026 only**: "Manufacturing PMI … first business day of the month at 10:00 a.m. (EST)", "Services PMI … third business day". The 2026 Manufacturing days are Jan 5, Feb 2, Mar 2, Apr 1, May 1, Jun 1, Jul 1, Aug 3, Sep 1, Oct 1, Nov 2, Dec 1.
- **Rule check, 2026:** "first business day, 10:00 ET, unless the NYSE is closed" holds for 11 of 12 months. **January 2026 breaks it.** Friday 2026-01-02 was an NYSE trading day, but "The Manufacturing report will be released on January 5th due to ISM holiday."
- **2019–2025:** not on ismworld.org. The Wayback Machine (`web.archive.org`) and PR Newswire were refused by this session's proxy. **Unverified.**

## EODHD

`economic-events` with the public `demo` token returns 403 "Forbidden". It needs the user's own free key; not checked.

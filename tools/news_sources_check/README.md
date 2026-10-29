# News calendar source checks

Collects the evidence for [Check ISM's past release dates, Census's live schedule and EODHD from the user's machine](https://github.com/afloret-services/AITradingBot/issues/28). The cloud session's proxy blocks the Wayback Machine, PR Newswire and `www.census.gov`, so this runs on your machine. Throwaway: this is not bot code.

**Ran on 2026-10-29 from the cloud session**, after `www.census.gov` and `www.prnewswire.com` were allowed. `web.archive.org` still closes the connection from there, and `eodhd` wasn't needed. The results are in `results/`, and `python ism_dates.py` turns the PR Newswire pages into `results/ism/pmi-releases.csv`.

The script only **collects**: it saves the pages it fetched to `results/` and prints a short summary. The dates are read out of the saved files in the next session.

## Setup

- Python 3.10 or later. No packages are needed.
- Only for step 3: a free EODHD key (sign up at eodhd.com), as `EODHD_API_KEY=...` in the repo-root `.env` (gitignored), or exported in your shell. The key is never printed or saved.

Run from the repo root: `python tools/news_sources_check/check.py <step>`.

## Steps

| # | Step | What it checks | Takes |
|---|------|----------------|-------|
| 1 | `ism` | Past ISM release dates, 2019–2025: monthly Wayback captures of ISM's report calendar page, calendar pages on ISM's old site (`instituteforsupplymanagement.org`), and ISM's releases listed on PR Newswire | A few minutes. It pauses 1 s between Wayback fetches. |
| 2 | `census` | Whether `www.census.gov`'s economic-indicator calendar lists upcoming Advance Retail Sales dates, and in what format (HTML, PDF, ICS or other feed links) | Seconds |
| 3 | `eodhd` | Only needed if step 1 finds no ISM history. US economic events for January 2019 and October–December 2025: are ISM PMI dates right, and are the October 2025 BLS releases that were cancelled in the shutdown left out? | Seconds |

## Send back

1. The printed output of each step, pasted here or on the ticket.
2. The saved files, so the dates can be read out of them. Commit and push the folder (it holds no keys):

   ```
   git add tools/news_sources_check/results
   git commit -m "News calendar source checks: results"
   git push origin ccr-2faecedc-9t16ly
   ```

If a step prints `status 403` or `429`, wait a few minutes and run it again. Wayback rate-limits bursts.

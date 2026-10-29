"""Read ISM PMI release dates out of the saved PR Newswire listing pages.

    python ism_dates.py

Writes results/ism/pmi-releases.csv (one row per Manufacturing or Services PMI
release) and prints every month that breaks ISM's stated rule: Manufacturing on
the first business day at 10:00 ET, Services on the third.
"""

import csv
import datetime as dt
import html
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
PAGES = HERE / "results" / "ism" / "prnewswire"
OUT = HERE / "results" / "ism" / "pmi-releases.csv"

# NYSE full closures that can fall in the first few days of a month, 2017-2026
NYSE_CLOSED = {dt.date(*d) for d in [
    (2017, 1, 2), (2017, 7, 4), (2017, 9, 4), (2018, 1, 1), (2018, 7, 4), (2018, 9, 3),
    (2019, 1, 1), (2019, 7, 4), (2019, 9, 2), (2020, 1, 1), (2020, 7, 3), (2020, 9, 7),
    (2021, 1, 1), (2021, 4, 2), (2021, 7, 5), (2021, 9, 6), (2022, 7, 4), (2022, 9, 5),
    (2023, 1, 2), (2023, 4, 7), (2023, 7, 4), (2023, 9, 4), (2024, 1, 1), (2024, 7, 4),
    (2024, 9, 2), (2025, 1, 1), (2025, 7, 4), (2025, 9, 1), (2026, 1, 1), (2026, 4, 3),
    (2026, 7, 3), (2026, 9, 7),
]}


def business_day(year, month, n):
    day, count = dt.date(year, month, 1), 0
    while True:
        if day.weekday() < 5 and day not in NYSE_CLOSED:
            count += 1
            if count == n:
                return day
        day += dt.timedelta(days=1)


def releases():
    for page in sorted(PAGES.glob("page-*.html")):
        text = page.read_text(encoding="utf-8", errors="replace")
        for when, title in re.findall(r"<h3>\s*<small>([^<]+)</small>\s*([^<]+?)\s*</h3>", text):
            title = html.unescape(title)
            if "Hospital" in title or "Seasonal" in title:
                continue
            if re.search(r"Non-Manufacturing|NMI|Services PMI|Services ISM", title):
                report = "Services"
            elif re.search(r"Manufacturing (PMI® Report|ISM® Report On Business)", title):
                report = "Manufacturing"
            else:
                continue
            yield dt.datetime.strptime(when.strip(), "%b %d, %Y, %H:%M ET"), report, title


def main():
    rows = sorted(set(releases()))
    with OUT.open("w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["released_et", "report", "rule_date", "matches_rule", "title"])
        for released, report, title in rows:
            rule = business_day(released.year, released.month, 1 if report == "Manufacturing" else 3)
            writer.writerow([released.isoformat(sep=" ", timespec="minutes"), report, rule,
                             released.date() == rule and released.time() == dt.time(10), title])

    print(f"{len(rows)} releases, {rows[0][0]:%Y-%m} to {rows[-1][0]:%Y-%m}; saved to {OUT.relative_to(HERE)}")
    for report in ("Manufacturing", "Services"):
        months = {(r.year, r.month) for r, rep, _ in rows if rep == report}
        missing = [f"{y}-{m:02d}" for y in range(2019, 2027) for m in range(1, 13)
                   if (y, m) <= (2026, 10) and (y, m) not in months]
        print(f"\n{report}: {len(months)} months; missing 2019-01..2026-10: {missing or 'none'}")
        for released, rep, title in rows:
            if rep != report or released.year < 2019:
                continue
            rule = business_day(released.year, released.month, 1 if report == "Manufacturing" else 3)
            if released.date() != rule or released.time() != dt.time(10):
                print(f"  {released:%Y-%m-%d %H:%M} (rule {rule}, {released:%a})  {title[:70]}")


if __name__ == "__main__":
    main()

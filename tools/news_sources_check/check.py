"""Checks of the News calendar's remaining sources, run from the user's own machine.

Run one step at a time (see README.md in this folder for the checklist):

    python check.py ism
    python check.py census
    python check.py eodhd

Every step saves what it fetched to results/<step>/ and prints a summary.
Collection only: the dates are read out of the saved pages (full text in each .txt)
in a later session.

Standard library only. EODHD needs EODHD_API_KEY, from the shell or from the
repo's .env file (gitignored); the key is never printed or saved.
"""

import argparse
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
RESULTS = HERE / "results"
USER_AGENT = "AITradingBot-news-calendar-check/1.0 (+https://github.com/afloret-services/AITradingBot)"
MONTH = r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?"
DATE_LINE = re.compile(MONTH + r"\s+\d{1,2}", re.I)

ISM_CALENDAR = "ismworld.org/supply-management-news-and-reports/reports/rob-report-calendar/"
ISM_OLD_SITE = "instituteforsupplymanagement.org"
PRN_LISTING = "https://www.prnewswire.com/news/institute-for-supply-management/?page={page}&pagesize=100"
CENSUS_PAGES = [
    "https://www.census.gov/economic-indicators/calendar-listview.html",
    "https://www.census.gov/economic-indicators/",
    "https://www.census.gov/retail/index.html",
    "https://www.census.gov/retail/sales.html",
    "https://www.census.gov/retail/marts/www/marts_current.pdf",
]
EODHD = "https://eodhd.com/api/economic-events"
EODHD_SPANS = [("2019-01-01", "2019-01-31"), ("2025-10-01", "2025-12-31")]


def fetch(url, timeout=30):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.headers.get("Content-Type", ""), response.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("Content-Type", ""), e.read()
    except (urllib.error.URLError, TimeoutError) as e:
        return None, "", repr(e).encode()


class TextAndLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.lines, self.links, self._skip = [], [], 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self._skip += 1
        href = dict(attrs).get("href")
        if tag == "a" and href:
            self.links.append(href)

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self._skip:
            self._skip -= 1

    def handle_data(self, data):
        text = " ".join(data.split())
        if text and not self._skip:
            self.lines.append(text)


def parse(html_bytes):
    parser = TextAndLinks()
    parser.feed(html_bytes.decode("utf-8", errors="replace"))
    return parser


def save(folder, name, data):
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / name
    path.write_bytes(data)
    return path


def cdx(url, match="exact", start="2018", end="2025", extra=()):
    """Wayback Machine captures of a URL, at most one per month."""
    query = [("url", url), ("matchType", match), ("output", "json"), ("from", start), ("to", end),
             ("filter", "statuscode:200"), ("fl", "timestamp,original"), *extra]
    status, _, body = fetch("https://web.archive.org/cdx/search/cdx?" + urllib.parse.urlencode(query), timeout=90)
    if status != 200:
        print(f"  CDX {url}: status {status} {body[:200]!r}")
        return []
    rows = json.loads(body or b"[]")
    return rows[1:]  # first row is the header


def step_ism(args):
    out = RESULTS / "ism"
    summary = []

    print("1. Wayback captures of ISM's report calendar page")
    captures = cdx(ISM_CALENDAR, extra=[("collapse", "timestamp:6")])
    print(f"  {len(captures)} monthly captures")
    for timestamp, original in captures:
        status, _, body = fetch(f"https://web.archive.org/web/{timestamp}id_/{original}", timeout=60)
        if status != 200:
            print(f"  {timestamp}: status {status}")
            continue
        save(out / "calendar", f"{timestamp}.html", body)
        lines = parse(body).lines
        save(out / "calendar", f"{timestamp}.txt", "\n".join(lines).encode())
        dated = sum(bool(DATE_LINE.search(line)) for line in lines)
        print(f"  {timestamp}: {dated} lines with a date")
        summary.append({"source": "wayback-calendar", "timestamp": timestamp, "date_lines": dated})
        time.sleep(1)

    print("2. Calendar-like pages on ISM's old site (before ismworld.org)")
    old = cdx(ISM_OLD_SITE, match="domain", start="2018", end="2020",
              extra=[("filter", "original:.*(?i)(calendar|rob).*"), ("collapse", "urlkey"), ("limit", "300")])
    candidates = sorted({original for _, original in old})
    save(out, "old-site-candidates.txt", "\n".join(candidates).encode())
    print(f"  {len(candidates)} candidate URLs saved to old-site-candidates.txt")
    for timestamp, original in old:
        if "calendar" not in original.lower():
            continue
        status, _, body = fetch(f"https://web.archive.org/web/{timestamp}id_/{original}", timeout=60)
        if status == 200:
            safe = re.sub(r"[^A-Za-z0-9]+", "_", original)[-80:]
            save(out / "old-site", f"{timestamp}-{safe}.html", body)
            lines = parse(body).lines
            save(out / "old-site", f"{timestamp}-{safe}.txt", "\n".join(lines).encode())
            dated = sum(bool(DATE_LINE.search(line)) for line in lines)
            print(f"  {timestamp} {original}: {dated} lines with a date")
        time.sleep(1)

    print("3. ISM's releases on PR Newswire")
    for page in range(1, args.pages + 1):
        status, _, body = fetch(PRN_LISTING.format(page=page))
        if status != 200:
            print(f"  page {page}: status {status}")
            break
        save(out / "prnewswire", f"page-{page:02d}.html", body)
        parsed = parse(body)
        releases = sorted({link for link in parsed.links if "/news-releases/" in link
                           and re.search(r"pmi|report-on-business|manufacturing|services", link, re.I)})
        years = sorted(set(re.findall(r"\b20(1[89]|2[0-6])\b", " ".join(parsed.lines))))
        print(f"  page {page}: {len(releases)} PMI-looking release links, years mentioned {['20' + y for y in years]}")
        summary.append({"source": "prnewswire", "page": page, "releases": releases})
        if years and min(years) < "19":
            break  # reached 2018
        time.sleep(1)

    save(out, "summary.json", json.dumps(summary, indent=1).encode())
    print(f"\nSaved to {out.relative_to(REPO_ROOT)}")


def step_census(args):
    out = RESULTS / "census"
    for url in CENSUS_PAGES:
        status, content_type, body = fetch(url)
        name = re.sub(r"[^A-Za-z0-9]+", "_", url.split("census.gov/")[-1]).strip("_") or "index"
        ext = ".pdf" if "pdf" in content_type else ".html"
        save(out, name + ext, body)
        print(f"\n{url}\n  status {status}, {content_type}, {len(body)} bytes")
        if status != 200 or ext == ".pdf":
            continue
        parsed = parse(body)
        retail = [line for line in parsed.lines if re.search(r"retail", line, re.I)]
        feeds = sorted({link for link in parsed.links if re.search(r"\.(ics|json|xml|csv|xlsx?)(\?|$)", link, re.I)})
        for line in retail[:15]:
            print(f"  | {line[:160]}")
        if feeds:
            print("  feed-like links: " + ", ".join(feeds[:20]))
    print(f"\nSaved to {out.relative_to(REPO_ROOT)}")


def eodhd_key():
    key = os.environ.get("EODHD_API_KEY")
    env_file = REPO_ROOT / ".env"
    if not key and env_file.exists():
        for line in env_file.read_text().splitlines():
            name, _, value = line.partition("=")
            if name.strip() == "EODHD_API_KEY":
                key = value.strip().strip("'\"")
    if not key:
        sys.exit("No key: set EODHD_API_KEY, or put EODHD_API_KEY=... in the repo's .env file.")
    return key


def step_eodhd(args):
    out = RESULTS / "eodhd"
    key = eodhd_key()
    for start, end in EODHD_SPANS:
        query = urllib.parse.urlencode({"api_token": key, "country": "US", "from": start, "to": end,
                                        "limit": 1000, "fmt": "json"})
        status, _, body = fetch(f"{EODHD}?{query}")
        print(f"\n{start}..{end}: status {status}, {len(body)} bytes")
        if status != 200:
            print(f"  {body[:300]!r}")
            continue
        save(out, f"events-{start}-{end}.json", body)
        events = json.loads(body)
        print(f"  {len(events)} events")
        wanted = re.compile(r"ISM|PMI|Non.?Farm|Unemployment Rate|CPI|Consumer Price|PPI|Producer Price|Retail Sales", re.I)
        for event in sorted(events, key=lambda e: e.get("date", "")):
            if wanted.search(event.get("type", "")):
                print(f"  {event.get('date')}  {event.get('type')}  period={event.get('period')}  "
                      f"actual={event.get('actual')}")
    print(f"\nSaved to {out.relative_to(REPO_ROOT)}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    steps = parser.add_subparsers(dest="step", required=True)
    ism = steps.add_parser("ism", help="past ISM release dates: Wayback and PR Newswire")
    ism.add_argument("--pages", type=int, default=10, help="PR Newswire listing pages to read (default 10)")
    ism.set_defaults(run=step_ism)
    steps.add_parser("census", help="Census's live economic-indicator schedule").set_defaults(run=step_census)
    steps.add_parser("eodhd", help="EODHD economic events for 2019-01 and 2025-10..12").set_defaults(run=step_eodhd)
    args = parser.parse_args()
    print(f"{args.step} check, {dt.datetime.now().isoformat(timespec='seconds')}")
    args.run(args)


if __name__ == "__main__":
    main()

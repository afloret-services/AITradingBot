"""Repeatability check of a pinned Jev version, for the Signal filter.

Run one step at a time (see README.md in this folder for the checklist):

    python jev_repeat.py models
    python jev_repeat.py repeat --model <pinned version>
    python jev_repeat.py report

`repeat` sends the same fixed Signal inputs to the pinned version and appends every
answer to jev-results/calls.jsonl; `report` compares all answers recorded so far.

The API key is read from TYPESAFE_API_KEY, or from a .env file at the repo root
(gitignored). The key is never printed or written to the results.

Standard library only: no SDK, so there are no hidden retries and the raw response
is recorded exactly as it arrived.
"""

import argparse
import datetime as dt
import hashlib
import json
import os
import random
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE_URL = os.environ.get("TYPESAFE_BASE_URL", "https://api.typesafe.ai")
TIMEOUT = 5.0  # seconds; the bot treats a slower call as "filter unavailable"
REPO_ROOT = Path(__file__).resolve().parents[2]
RESULTS = Path(__file__).resolve().parent / "jev-results"
CALLS = RESULTS / "calls.jsonl"

QUESTION = {
    "target_first": {
        "type": "noul",
        "instructions": "Will this Trade reach its target before its stop?",
        "criteria": {
            "true": "Price trades at the target before it trades at the stop.",
            "false": "Price trades at the stop before it trades at the target.",
        },
    }
}


def api_key():
    key = os.environ.get("TYPESAFE_API_KEY")
    env_file = REPO_ROOT / ".env"
    if not key and env_file.exists():
        for line in env_file.read_text().splitlines():
            name, _, value = line.partition("=")
            if name.strip() == "TYPESAFE_API_KEY":
                key = value.strip().strip("'\"")
    if not key:
        sys.exit("No API key: set TYPESAFE_API_KEY, or put TYPESAFE_API_KEY=... in the repo's .env file.")
    return key


def call(method, path, body=None):
    request = urllib.request.Request(
        BASE_URL + path,
        method=method,
        data=None if body is None else json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {api_key()}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
    )
    started = time.monotonic()
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
            text = response.read().decode()
            return response.status, text, time.monotonic() - started, response.headers.get("x-typesafe-request-id")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace"), time.monotonic() - started, e.headers.get("x-typesafe-request-id")
    except (urllib.error.URLError, TimeoutError) as e:
        return None, repr(e), time.monotonic() - started, None


def signal_state(seed, direction):
    """A fixed Signal input shaped like the bot's (see ADR 0001).

    1-minute bars from 09:30 NY up to the Signal, prices relative to entry in points,
    time as minutes into the Window (negative before 10:00). The bars are synthetic but
    generated from a fixed seed, so every run sends byte-identical input.
    """
    rng = random.Random(seed)
    sign = 1 if direction == "long" else -1
    minutes = 47  # Signal at 10:17
    price = sign * 30.0  # starts 30 points on the far side of entry, drifts toward it
    bars = []
    for i in range(minutes):
        open_ = price
        close = open_ - sign * 30.0 / minutes + rng.gauss(0, 3)
        high = max(open_, close) + abs(rng.gauss(0, 1.5))
        low = min(open_, close) - abs(rng.gauss(0, 1.5))
        bars.append({
            "minute": i - 30,
            "open": round(open_ * 4) / 4,
            "high": round(high * 4) / 4,
            "low": round(low * 4) / 4,
            "close": round(close * 4) / 4,
            "volume": rng.randint(200, 2500),
        })
        price = close
    return {
        "direction": direction,
        "entry": 0.0,
        "stop": -sign * 14.5,
        "target": sign * 22.0,
        "price_units": "points relative to entry",
        "time_units": "minutes into the 60-minute Window; negative is before it opens",
        "bars": bars,
    }


FIXTURES = {
    "long-a": signal_state(1, "long"),
    "short-b": signal_state(2, "short"),
    "long-c": signal_state(3, "long"),
}


def step_models(args):
    status, text, seconds, _ = call("GET", "/v1/models")
    if status != 200:
        sys.exit(f"GET /v1/models failed: {status} {text[:300]}")
    models = json.loads(text)["models"]
    print(f"{'name':<28} {'release_date':<12} description")
    for m in models:
        print(f"{m['name']:<28} {m['release_date']:<12} {m['description']}")
    RESULTS.mkdir(exist_ok=True)
    out = RESULTS / f"models-{dt.date.today()}.json"
    out.write_text(text)
    print(f"\nSaved to {out.relative_to(REPO_ROOT)}")


def step_repeat(args):
    if args.model.endswith(("-latest", "-preview")):
        sys.exit(f"{args.model} is a moving alias. Pass a versioned ID from `models`.")
    RESULTS.mkdir(exist_ok=True)
    for n in range(args.calls):
        for name, state in FIXTURES.items():
            body = {"model": args.model, "state": state, "questions": QUESTION}
            status, text, seconds, request_id = call("POST", "/v1/systemone", body)
            record = {
                "at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
                "fixture": name,
                "requested_model": args.model,
                # the same hash in every record proves the input never changed
                "input_sha256": hashlib.sha256(json.dumps(body, sort_keys=True).encode()).hexdigest(),
                "status": status,
                "seconds": round(seconds, 3),
                "request_id": request_id,
            }
            if status == 200:
                answer = json.loads(text)
                record["answered_model"] = answer["model"]
                # repr keeps every digit, so tiny drift shows up
                record["noul"] = repr(answer["answers"]["target_first"]["noul"])
                record["usage"] = answer["usage"]
            else:
                record["error"] = text[:500]
            with CALLS.open("a") as f:
                f.write(json.dumps(record) + "\n")
            print(f"call {n + 1}/{args.calls} {name:<8} status={status} {record['seconds']:.3f}s "
                  f"model={record.get('answered_model')} noul={record.get('noul', record.get('error', '')[:80])}")
        if n + 1 < args.calls:
            time.sleep(args.gap)
    print(f"\nAppended to {CALLS.relative_to(REPO_ROOT)}")


def step_report(args):
    if not CALLS.exists():
        sys.exit("No calls recorded yet: run `repeat` first.")
    records = [json.loads(line) for line in CALLS.read_text().splitlines() if line.strip()]
    ok = [r for r in records if r["status"] == 200]
    failed = len(records) - len(ok)
    days = sorted({r["at"][:10] for r in ok})
    seconds = sorted(r["seconds"] for r in ok)
    print(f"{len(records)} calls, {failed} failed, over {len(days)} day(s): {', '.join(days)}")
    if seconds:
        print(f"latency p50 {seconds[len(seconds) // 2]:.3f}s, max {seconds[-1]:.3f}s, "
              f"over {TIMEOUT:.0f}s: {sum(s > TIMEOUT for s in seconds)}")
    print(f"models that answered: {sorted({r['answered_model'] for r in ok})}")
    for name in FIXTURES:
        values = [r["noul"] for r in ok if r["fixture"] == name]
        if not values:
            continue
        floats = [float(v) for v in values]
        spread = max(floats) - min(floats)
        hashes = {r["input_sha256"] for r in ok if r["fixture"] == name}
        print(f"\n{name}: {len(values)} answers, {len(set(values))} distinct, "
              f"min {min(floats):.6f} max {max(floats):.6f} spread {spread:.2e}"
              + ("  IDENTICAL" if len(set(values)) == 1 else ""))
        if len(hashes) > 1:
            print(f"  WARNING: the input itself differed between calls ({len(hashes)} hashes)")
        for day in days:
            per_day = [float(r["noul"]) for r in ok if r["fixture"] == name and r["at"].startswith(day)]
            if per_day:
                mean = sum(per_day) / len(per_day)
                print(f"  {day}: {len(per_day)} answers, mean {mean:.6f}, "
                      f"spread {max(per_day) - min(per_day):.2e}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    steps = parser.add_subparsers(dest="step", required=True)
    steps.add_parser("models", help="list model names and release dates").set_defaults(run=step_models)
    repeat = steps.add_parser("repeat", help="send the fixed Signal inputs to a pinned version")
    repeat.add_argument("--model", required=True, help="versioned model ID, e.g. jev-1.14.0")
    repeat.add_argument("--calls", type=int, default=5, help="calls per fixture (default 5)")
    repeat.add_argument("--gap", type=float, default=60, help="seconds between rounds (default 60)")
    repeat.set_defaults(run=step_repeat)
    steps.add_parser("report", help="compare every recorded answer").set_defaults(run=step_report)
    args = parser.parse_args()
    args.run(args)


if __name__ == "__main__":
    main()

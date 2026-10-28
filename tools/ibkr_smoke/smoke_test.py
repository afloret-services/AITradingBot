"""Smoke test of ib_async 2.1.0 against IB Gateway on the Paper account.

Run one step at a time (see README.md in this folder for the checklist):

    python smoke_test.py connect
    python smoke_test.py contracts
    python smoke_test.py bars
    python smoke_test.py cancel-parent
    python smoke_test.py legs
    python smoke_test.py reconnect
    python smoke_test.py watch

Every step prints to the screen and appends to smoke-results/<step>-<time>.log.
The script refuses to run unless the logged-in account is a Paper account (DU...).
"""

import argparse
import datetime as dt
import math
import sys
from pathlib import Path

import ib_async
from ib_async import IB, Future, MarketOrder

HOST = "127.0.0.1"
PORT = 4002  # IB Gateway, paper
CLIENT_ID = 17
TICK = 0.25  # MNQ minimum tick
ROLL_DAYS = 8  # Active contract: skip a month within 8 days of its expiry

LOG_FILE = None


def log(*parts):
    line = f"{dt.datetime.now().strftime('%H:%M:%S.%f')[:-3]}  " + " ".join(str(p) for p in parts)
    print(line, flush=True)
    if LOG_FILE:
        with LOG_FILE.open("a") as f:
            f.write(line + "\n")


def on_error(req_id, code, message, contract):
    log(f"[error {code}] reqId={req_id} {message}" + (f" ({contract.localSymbol})" if contract else ""))


def round_tick(price):
    return round(round(price / TICK) * TICK, 2)


def connect(ib):
    ib.connect(HOST, PORT, clientId=CLIENT_ID, timeout=10)
    accounts = ib.managedAccounts()
    if not accounts or not all(a.startswith("DU") for a in accounts):
        log(f"ABORT: accounts {accounts} are not all Paper accounts (DU...). Log Gateway into paper.")
        ib.disconnect()
        sys.exit(1)
    log(f"ib_async {ib_async.__version__}, server version {ib.client.serverVersion()}, "
        f"accounts {accounts}, Gateway time {ib.reqCurrentTime()}")


def mnq_details(ib):
    details = ib.reqContractDetails(Future("MNQ", exchange="CME"))
    return sorted(details, key=lambda d: d.contract.lastTradeDateOrContractMonth)


def active_contract(ib):
    cutoff = (dt.date.today() + dt.timedelta(days=ROLL_DAYS)).strftime("%Y%m%d")
    for d in mnq_details(ib):
        if d.contract.lastTradeDateOrContractMonth > cutoff:
            log(f"Using {d.contract.localSymbol} (conId {d.contract.conId}, "
                f"last trade {d.contract.lastTradeDateOrContractMonth})")
            return d.contract
    log("ABORT: no MNQ contract found")
    sys.exit(1)


def market_price(ib, contract):
    ib.reqMarketDataType(1)
    ticker = ib.reqMktData(contract)
    for _ in range(20):
        ib.sleep(0.5)
        price = ticker.marketPrice()
        if price == price and price > 0:  # not NaN
            log(f"Market {contract.localSymbol}: bid {ticker.bid} ask {ticker.ask} last {ticker.last}")
            return ticker
    log("ABORT: no market price after 10 s (market closed, or no market data on paper?)")
    sys.exit(1)


def show_orders(ib, label):
    log(f"--- open orders: {label}")
    for t in ib.openTrades():
        o = t.order
        price = o.lmtPrice if o.orderType == "LMT" else o.auxPrice
        log(f"    id {o.orderId} parent {o.parentId} {o.action} {o.totalQuantity:g} {o.orderType} "
            f"@ {price} -> {t.orderStatus.status}")
    for p in ib.positions():
        if p.contract.symbol == "MNQ":
            log(f"    position {p.contract.localSymbol} {p.position:g} avg {p.avgCost}")


def place_bracket(ib, contract, action, qty, entry, take_profit, stop):
    bracket = ib.bracketOrder(action, qty, entry, take_profit, stop)
    trades = [ib.placeOrder(contract, o) for o in bracket]
    log(f"Placed {action} bracket: entry {entry}, take-profit {take_profit}, stop {stop} "
        f"(ids {[o.orderId for o in bracket]})")
    return trades


def flatten(ib, contract):
    for t in ib.openTrades():
        if t.contract.conId == contract.conId:
            ib.cancelOrder(t.order)
    ib.sleep(2)
    for p in ib.positions():
        if p.contract.conId == contract.conId and p.position != 0:
            action = "SELL" if p.position > 0 else "BUY"
            log(f"Flattening {p.position:g} with a market order")
            ib.placeOrder(contract, MarketOrder(action, abs(p.position)))
    ib.sleep(3)
    show_orders(ib, "after flatten")


def step_connect(ib, args):
    connect(ib)


def step_contracts(ib, args):
    connect(ib)
    details = mnq_details(ib)
    log(f"reqContractDetails(MNQ, no month) returned {len(details)} contracts:")
    for d in details:
        c = d.contract
        log(f"    {c.localSymbol:8} conId {c.conId} last trade {c.lastTradeDateOrContractMonth} "
            f"multiplier {c.multiplier} minTick {d.minTick} tz {d.timeZoneId}")
    if details:
        log(f"Trading hours ({details[0].contract.localSymbol}): {details[0].tradingHours}")


def step_bars(ib, args):
    connect(ib)
    contract = active_contract(ib)
    bars = ib.reqHistoricalData(contract, "", "1 D", "1 min", "TRADES", useRTH=False,
                                formatDate=2, keepUpToDate=True)
    log(f"keepUpToDate 1-min backfill: {len(bars)} bars, first {bars[0].date if bars else '-'}, "
        f"last {bars[-1].date if bars else '-'}")
    rt_bars = ib.reqRealTimeBars(contract, 5, "TRADES", False)
    counts = {"1m new": 0, "1m update": 0, "5s": 0}

    def on_minute(bars, has_new_bar):
        counts["1m new" if has_new_bar else "1m update"] += 1
        if has_new_bar:
            b = bars[-2]
            log(f"    1m closed {b.date} O {b.open} H {b.high} L {b.low} C {b.close} V {b.volume}")

    def on_five(bars, has_new_bar):
        counts["5s"] += 1
        b = bars[-1]
        log(f"    5s {b.time} O {b.open_} H {b.high} L {b.low} C {b.close} V {b.volume}")

    bars.updateEvent += on_minute
    rt_bars.updateEvent += on_five
    log(f"Listening for {args.minutes} minutes...")
    ib.sleep(args.minutes * 60)
    log(f"Received: {counts}")
    ib.cancelHistoricalData(bars)
    ib.cancelRealTimeBars(rt_bars)


def step_cancel_parent(ib, args):
    """A bracket far below the market never fills; cancelling the parent must cancel both exits."""
    connect(ib)
    contract = active_contract(ib)
    price = market_price(ib, contract).marketPrice()
    entry = round_tick(price * 0.95)
    trades = place_bracket(ib, contract, "BUY", 1, entry, round_tick(entry + 50), round_tick(entry - 50))
    ib.sleep(3)
    show_orders(ib, "after placing")
    log("Cancelling the parent only")
    ib.cancelOrder(trades[0].order)
    ib.sleep(3)
    for t in trades:
        log(f"    id {t.order.orderId} {t.order.orderType} -> {t.orderStatus.status}")
    show_orders(ib, "after cancelling the parent")


def step_legs(ib, args):
    """Two Take-profit legs, one Bracket order each, same entry and stop, entry marketable.

    Checks: both brackets accepted at once; a filled take-profit cancels only its own
    leg's stop; the other leg's stop can be moved to Break-even.
    """
    connect(ib)
    contract = active_contract(ib)
    ticker = market_price(ib, contract)
    entry = round_tick(ticker.ask + 2 * TICK)  # marketable buy limit
    stop = round_tick(entry - 100)
    leg1 = place_bracket(ib, contract, "BUY", 1, entry, round_tick(entry + args.tp_ticks * TICK), stop)
    leg2 = place_bracket(ib, contract, "BUY", 1, entry, round_tick(entry + 200), stop)
    ib.sleep(5)
    show_orders(ib, "after placing both legs")

    log(f"Waiting up to {args.minutes} minutes for leg 1's take-profit to fill...")
    deadline = dt.datetime.now() + dt.timedelta(minutes=args.minutes)
    while leg1[1].orderStatus.status != "Filled" and dt.datetime.now() < deadline:
        ib.sleep(1)
    for name, leg in (("leg 1", leg1), ("leg 2", leg2)):
        for t in leg:
            fills = ", ".join(f"{f.execution.shares:g}@{f.execution.price}" for f in t.fills) or "none"
            log(f"    {name} id {t.order.orderId} {t.order.orderType} -> {t.orderStatus.status}, fills {fills}")
    if leg1[1].orderStatus.status != "Filled":
        log("Leg 1 take-profit did not fill in time; try again with a smaller --tp-ticks")
        flatten(ib, contract)
        return

    ib.sleep(2)
    fill_price = leg2[0].orderStatus.avgFillPrice or entry
    last = ticker.marketPrice()
    break_even = round_tick(fill_price)
    if break_even >= last:
        break_even = round_tick(last - 20 * TICK)
        log(f"Market {last} is at or below entry {fill_price}; moving the stop to {break_even} instead")
    log(f"Moving leg 2's stop from {leg2[2].order.auxPrice} to {break_even} (Break-even)")
    leg2[2].order.auxPrice = break_even
    ib.placeOrder(contract, leg2[2].order)
    ib.sleep(3)
    show_orders(ib, "after the Break-even move")
    flatten(ib, contract)


def step_reconnect(ib, args):
    """Disconnect from the API side and reconnect with the same client id: do resting orders survive?"""
    connect(ib)
    contract = active_contract(ib)
    price = market_price(ib, contract).marketPrice()
    entry = round_tick(price * 0.95)
    place_bracket(ib, contract, "BUY", 1, entry, round_tick(entry + 50), round_tick(entry - 50))
    ib.sleep(3)
    show_orders(ib, "before disconnect")
    ib.disconnect()
    log("Disconnected; waiting 10 s")
    ib.sleep(10)
    connect(ib)
    show_orders(ib, "after reconnect (same client id)")
    log(f"reqAllOpenOrders sees {len(ib.reqAllOpenOrders())} open orders")
    flatten(ib, contract)


def step_watch(ib, args):
    """Keep a resting bracket and live bars while you break the connection by hand; log every event."""
    connect(ib)
    contract = active_contract(ib)
    price = market_price(ib, contract).marketPrice()
    entry = round_tick(price * 0.95)
    place_bracket(ib, contract, "BUY", 1, entry, round_tick(entry + 50), round_tick(entry - 50))
    state = {"bars": None, "last_bar": None, "resubscribe": True}

    def on_bar(bars, has_new_bar):
        state["last_bar"] = dt.datetime.now()

    def on_error_watch(req_id, code, message, c):
        if code == 1101:
            log("    1101: will resubscribe the 1-min bars")
            state["resubscribe"] = True

    ib.errorEvent += on_error_watch
    log(f"Watching for {args.minutes} minutes. Now break the connection (see README), then restore it.")
    deadline = dt.datetime.now() + dt.timedelta(minutes=args.minutes)
    next_report = dt.datetime.now()
    while dt.datetime.now() < deadline:
        if not ib.isConnected():
            try:
                log("Not connected; trying to reconnect...")
                connect(ib)
                show_orders(ib, "after reconnect")
                state["resubscribe"] = True
            except (ConnectionError, OSError, TimeoutError) as e:
                log(f"    reconnect failed: {e!r}")
                ib.disconnect()
                ib.sleep(5)
                continue
        if state["resubscribe"]:
            if state["bars"] is not None and ib.isConnected():
                ib.cancelHistoricalData(state["bars"])
            state["bars"] = ib.reqHistoricalData(contract, "", "1800 S", "1 min", "TRADES", useRTH=False,
                                                 formatDate=2, keepUpToDate=True)
            state["bars"].updateEvent += on_bar
            state["resubscribe"] = False
            log(f"    subscribed to 1-min bars ({len(state['bars'])} backfilled)")
        if dt.datetime.now() >= next_report:
            log(f"    connected, last bar update {state['last_bar']}")
            next_report = dt.datetime.now() + dt.timedelta(seconds=30)
        ib.sleep(1)
    show_orders(ib, "end of watch")
    flatten(ib, contract)


STEPS = {
    "connect": step_connect,
    "contracts": step_contracts,
    "bars": step_bars,
    "cancel-parent": step_cancel_parent,
    "legs": step_legs,
    "reconnect": step_reconnect,
    "watch": step_watch,
}


def main():
    global LOG_FILE
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("step", choices=STEPS)
    parser.add_argument("--minutes", type=float, default=None, help="how long to listen or wait")
    parser.add_argument("--tp-ticks", type=int, default=8, help="legs: leg 1's take-profit distance in ticks")
    args = parser.parse_args()
    if args.minutes is None:
        args.minutes = {"bars": 3, "legs": 10, "watch": 15}.get(args.step, 0)

    results = Path(__file__).parent / "smoke-results"
    results.mkdir(exist_ok=True)
    LOG_FILE = results / f"{args.step}-{dt.datetime.now():%Y%m%d-%H%M%S}.log"

    ib = IB()
    ib.errorEvent += on_error
    ib.disconnectedEvent += lambda: log("[disconnected]")
    try:
        STEPS[args.step](ib, args)
    except KeyboardInterrupt:
        log("Interrupted")
        if ib.isConnected() and args.step in ("legs", "watch", "reconnect", "cancel-parent"):
            flatten(ib, active_contract(ib))
    finally:
        if ib.isConnected():
            ib.disconnect()
    log(f"Log written to {LOG_FILE}")


if __name__ == "__main__":
    main()

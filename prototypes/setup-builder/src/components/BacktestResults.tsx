// PROTOTYPE: the results of the Draft backtest Run, one instrument at a time (replaces "What it did on MNQ", 2026-11-27).
// Per instrument: Trades, average R, capital growth, and the drawdowns (average, largest, smallest); the chart kept to the
// backtest period, where each Signal shows its steps, entry, Stop Loss, Take Profits and exits; and the list of Trades with
// the drawdown after each one. A click on a Trade shows it on the chart.
// Drawdown: how far the account sits below its highest point so far, as a % of that high. A drawdown runs from a high until
// the account makes a new high; the average, largest and smallest are over those drawdowns.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Data, Signal } from '../engine';
import { Setup } from '../model';
import type { Focus } from './Chart';
import { Chart, fmtT } from './Chart';
import { DraftBacktest, Row } from './TrialBacktest';
import { instrumentLabel } from './InstrumentSelect';
import { instrumentManagement, InstrumentCosts } from '../instrumentManagement';
import { HelpBox } from './help';
import { cn } from './ui';

interface TradeRow { sig: Signal; n: number; day: number; usd: number; r: number; cost: number; equity: number; growth: number; dd: number; ddUsd: number;
  /** the Stop Loss moved to break-even during the Trade; kind: how it ended */ be?: string; kind: 'won' | 'lost' | 'break-even'; exit?: { price: number; why: string } }
const MIN_TRADES = 30;
function tradeCost(g: Signal, c: InstrumentCosts, entryOrder: string) {
  const contracts = g.legs.reduce((a, l) => a + l.contracts, 0);
  const atTp = g.legs.filter((l) => g.trade!.exits.some((x) => x.why === l.name)).reduce((a, l) => a + l.contracts, 0);
  const slip = c.slipTicks * c.tickValue;
  return contracts * 2 * c.commission + (entryOrder === 'limit' ? 0 : contracts * slip) + (contracts - atTp) * slip;
}
function analyse(row: Row, capital: number, setup: Setup, withCosts: boolean) {
  const sigs = row.res!.signals;
  const costs = instrumentManagement.costs(row.inst);
  const taken = sigs.filter((g) => !g.refused && g.trade?.fillI != null && g.trade?.r != null).sort((a, b) => a.trade!.fillI! - b.trade!.fillI!);
  let equity = capital, peak = capital, cur = 0, curUsd = 0;
  const episodes: { pct: number; usd: number }[] = [];
  const trades: TradeRow[] = taken.map((g, k) => {
    const contracts = g.legs.reduce((a, l) => a + l.contracts, 0);
    const risk$ = Math.abs(g.entry - g.stop) * row.pv! * contracts;
    const cost = costs ? tradeCost(g, costs, setup.branches[g.branch]?.entry.order || 'market') : 0;
    const r = g.trade!.r! - (withCosts && risk$ > 0 ? cost / risk$ : 0), usd = r * risk$;
    equity += usd;
    if (equity >= peak) { if (cur > 0) episodes.push({ pct: cur, usd: curUsd }); cur = 0; curUsd = 0; peak = equity; }
    const dd = peak > 0 ? (100 * (peak - equity)) / peak : 0;
    const ddUsd = peak - equity;
    if (dd > cur) { cur = dd; curUsd = ddUsd; }
    const ex = g.trade!.exits; const last = ex.length ? ex[ex.length - 1] : undefined;
    const be = g.trade!.stopMoves?.find((m) => /break-even/.test(m.why))?.why;
    // a Trade closed at its break-even stop with nothing banked is break-even; anything else is won or lost by its R
    const kind: TradeRow['kind'] = Math.abs(r) < 0.05 && last && /break-even/.test(last.why) ? 'break-even' : r > 0 ? 'won' : 'lost';
    return { sig: g, n: k + 1, day: 0, usd, r, cost, equity, growth: (100 * (equity - capital)) / capital, dd, ddUsd, be, kind, exit: last && { price: last.price, why: last.why } };
  });
  if (cur > 0) episodes.push({ pct: cur, usd: curUsd });
  const sumR = trades.reduce((a, t) => a + t.r, 0);
  const won = trades.filter((t) => t.usd > 0), lost = trades.filter((t) => t.usd < 0);
  const grossWin = won.reduce((a, t) => a + t.usd, 0), grossLoss = -lost.reduce((a, t) => a + t.usd, 0);
  return {
    trades, signals: sigs.length, refused: sigs.filter((g) => g.refused).length,
    avgR: trades.length ? sumR / trades.length : null, wins: trades.filter((t) => t.kind === 'won').length,
    losses: trades.filter((t) => t.kind === 'lost').length, evens: trades.filter((t) => t.kind === 'break-even').length, movedToBe: trades.filter((t) => t.be).length,
    growth: (100 * (equity - capital)) / capital, usd: equity - capital,
    ddAvg: episodes.length ? episodes.reduce((a, b) => a + b.pct, 0) / episodes.length : 0,
    ddAvgUsd: episodes.length ? episodes.reduce((a, b) => a + b.usd, 0) / episodes.length : 0,
    ddMax: episodes.reduce((m, e) => (e.pct > m.pct ? e : m), { pct: 0, usd: 0 }),
    ddMin: episodes.reduce<{ pct: number; usd: number } | null>((m, e) => (!m || e.pct < m.pct ? e : m), null) || { pct: 0, usd: 0 },
    ddCount: episodes.length, costs, totalCost: trades.reduce((a, t) => a + t.cost, 0),
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : null, grossWin, grossLoss,
    avgWinR: won.length ? won.reduce((a, t) => a + t.r, 0) / won.length : null, avgLossR: lost.length ? lost.reduce((a, t) => a + t.r, 0) / lost.length : null,
  };
}
const pct = (x: number, sign = true) => `${sign && x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(1)}%`;
const usd = (x: number) => `${x < 0 ? '−' : x > 0 ? '+' : ''}$${Math.abs(x).toFixed(0)}`;
const tone = (x: number) => (x > 0 ? 'text-cyan-300' : x < 0 ? 'text-red-300' : '');

export function BacktestResults({ setup, data, bt, focus }: { setup: Setup; data: Data; bt: DraftBacktest; focus?: Focus | null }) {
  const withNumbers = (bt.rows || []).filter((r) => r.res);
  const [inst, setInst] = useState<string | null>(null);
  const row = withNumbers.find((r) => r.inst === inst) || withNumbers[0];
  const [withCosts, setWithCosts] = useState(true);
  const a = useMemo(() => (row ? analyse(row, bt.capital, setup, withCosts) : null), [row, bt.capital, setup, withCosts]);
  const from = bt.ran?.from ?? 0, to = bt.ran?.to ?? data.days.length - 1;
  const [day, setDayRaw] = useState(from);
  const [selected, setSelected] = useState<Signal | null>(null);
  const setDay = (d: number) => setDayRaw(Math.min(to, Math.max(from, d)));
  const chartRef = useRef<HTMLDivElement>(null);
  // a new run or instrument starts on its first Trade (or the period's first day)
  useEffect(() => { const t = a?.trades[0]; setSelected(t ? t.sig : null); setDayRaw(t ? data.m1[t.sig.i].di : from); }, [a, from]);
  const show = (t: TradeRow) => { setSelected(t.sig); setDayRaw(data.m1[t.sig.i].di); chartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
  const dayLabel = (d: number) => new Date(data.days[d].td + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

  if (!bt.rows) return (
    <div className="space-y-2 text-sm text-muted-foreground">
      <div>No backtest Run on this Draft yet. Pick instruments and a period in "Backtest Run on this Draft", then create one: its results show here, one instrument at a time.</div>
      <button type="button" onClick={bt.go} className="flex h-9 items-center gap-1 rounded-md border border-sky-500/50 bg-sky-500/10 px-4 text-xs font-bold uppercase tracking-wider text-sky-300 hover:bg-sky-500/20">▶ Create a backtest Run</button>
    </div>
  );
  const tile = (label: string, value: React.ReactNode, cls = '', sub?: React.ReactNode) => (
    <div className="rounded-md border bg-card/40 px-3 py-2"><div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div><div className={cn('text-lg font-bold tabular-nums', cls)}>{value}</div>{sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}</div>
  );
  return (
    <div className="space-y-3 [container-type:inline-size]">
      <HelpBox id="review:results">
        <div><b className="text-foreground">BE</b> marks a Trade whose Stop Loss moved to break-even; one that then closed there with nothing banked counts as break-even, neither won nor lost.</div>
        <div>One instrument at a time: its Trades over the backtest period, what they did to the account, and each Trade on the chart. <b className="text-foreground">Capital</b> is this Setup's Risk per Trade account (${bt.capital}); growth and drawdowns are in % and in $ of it.</div>
        <div><b className="text-foreground">Costs</b>: each Instrument's commission (both sides, every contract) and slippage (on market and stop fills, never on a resting Limit Entry or a Take Profit). "After costs" takes them off every R and $. <b className="text-foreground">Profit factor</b>: $ won ÷ $ lost; above 1 the Setup made money. <b className="text-foreground">Average R</b> is the expectancy: what one Trade earns on average, in R.</div>
        <div><b className="text-foreground">Drawdown</b>: how far the account sits below its highest point so far. One drawdown runs from a high until the account makes a new high; the average, largest and smallest are over those drawdowns.</div>
      </HelpBox>
      <div className="flex flex-wrap items-center gap-1.5">
        {(bt.rows || []).map((r) => (
          <button key={r.inst} type="button" disabled={!r.res} onClick={() => setInst(r.inst)} title={r.res ? undefined : 'no numbers in this prototype'}
            className={cn('h-8 rounded-md border px-3 text-sm font-semibold', r.inst === row?.inst ? 'border-sky-500/60 bg-sky-500/15 text-sky-200' : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground', !r.res && 'cursor-not-allowed opacity-40 hover:bg-transparent')}>
            {instrumentLabel(r.inst).replace(/ · .*/, '')}
          </button>
        ))}
        <span className="text-xs text-muted-foreground">{dayLabel(from)} – {dayLabel(to)} · {to - from + 1} Trading days{bt.stale && <span className="text-amber-300"> · out of date: create a new backtest Run</span>}</span>
      </div>
      {!row || !a ? <div className="text-sm text-muted-foreground">None of the picked instruments has numbers in this prototype (only MNQ and NQ do).</div> : <>
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-card/40 px-3 py-2 text-xs">
          <div role="radiogroup" aria-label="Costs" className="flex overflow-hidden rounded-md border">
            {([[true, 'After costs'], [false, 'Before costs']] as const).map(([v, l]) => (
              <button key={l} type="button" role="radio" aria-checked={withCosts === v} onClick={() => setWithCosts(v)} className={cn('h-7 px-2.5 font-semibold', withCosts === v ? 'bg-sky-500/15 text-sky-200' : 'text-muted-foreground hover:bg-accent')}>{l}</button>
            ))}
          </div>
          {a.costs ? <span className="text-muted-foreground">Costs: <b className="text-foreground">${a.costs.commission.toFixed(2)}</b> a contract each side, plus <b className="text-foreground">{a.costs.slipTicks} tick (${(a.costs.slipTicks * a.costs.tickValue).toFixed(2)})</b> of slippage on market and stop fills · <b className="text-red-300">−${a.totalCost.toFixed(0)}</b> over {a.trades.length} Trade{a.trades.length === 1 ? '' : 's'} · from Instrument management (made up here)</span>
            : <span className="text-amber-300">No costs known for this instrument: results are before costs.</span>}
        </div>
        {a.trades.length < MIN_TRADES && <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200"><b>Only {a.trades.length} Trade{a.trades.length === 1 ? '' : 's'}</b>: too few to judge this Setup (at least {MIN_TRADES} are needed). Widen the period or add instruments before reading much into these numbers.</div>}
        <div className="grid grid-cols-2 gap-2 [@container(min-width:36rem)]:grid-cols-4">
          {tile('Trades', a.trades.length, '', `${a.signals} Signals · ${a.refused} refused`)}
          {tile('Win rate', a.trades.length ? `${Math.round((100 * a.wins) / a.trades.length)}%` : '–', '', a.trades.length ? `${a.wins} won · ${a.losses} lost${a.evens ? ` · ${a.evens} break-even` : ''}${a.movedToBe ? ` · ${a.movedToBe} went to break-even` : ''}` : undefined)}
          {tile('Average R', a.avgR == null ? '–' : `${a.avgR > 0 ? '+' : ''}${a.avgR.toFixed(2)}R`, tone(a.avgR || 0), 'per Trade')}
          {tile('Profit factor', a.profitFactor == null ? (a.grossWin > 0 ? 'no loss' : '–') : a.profitFactor.toFixed(2), a.profitFactor == null ? '' : a.profitFactor >= 1 ? 'text-cyan-300' : 'text-red-300', `avg win ${a.avgWinR == null ? '–' : `+${a.avgWinR.toFixed(2)}R`} · avg loss ${a.avgLossR == null ? '–' : `−${Math.abs(a.avgLossR).toFixed(2)}R`}`)}
          {tile('Capital growth', pct(a.growth), tone(a.growth), `${usd(a.usd)} on $${bt.capital}`)}
          {tile('Average drawdown', a.ddCount ? pct(-a.ddAvg, false) : '0%', a.ddCount ? 'text-red-300' : '', a.ddCount ? `${usd(-a.ddAvgUsd)} · ${a.ddCount} drawdown${a.ddCount === 1 ? '' : 's'}` : 'none')}
          {tile('Max drawdown', a.ddCount ? pct(-a.ddMax.pct, false) : '0%', a.ddCount ? 'text-red-300' : '', a.ddCount ? `${usd(-a.ddMax.usd)} · the deepest` : 'none')}
          {tile('Min drawdown', a.ddCount ? pct(-a.ddMin.pct, false) : '0%', a.ddCount ? 'text-red-300' : '', a.ddCount ? `${usd(-a.ddMin.usd)} · the shallowest` : 'none')}
        </div>
        <EquityCurve trades={a.trades} capital={bt.capital} label={(t) => `#${t.n} ${dayLabel(data.m1[t.sig.i].di)}`} selected={selected} onPick={show} />
        {(row.info || row.notes.length > 0) && <div className="text-xs">{row.info && <span className="text-muted-foreground">{row.info}. </span>}<span className="text-amber-300/90">{row.notes.join(' ')}</span></div>}
        <div ref={chartRef} className="scroll-mt-16">
          <Chart data={data} setup={setup} result={row.res!} day={day} setDay={setDay} focus={focus} selected={selected} setSelected={setSelected} height={380} />
        </div>
        <div className="space-y-1.5">
          <div className="text-base font-bold tracking-tight text-foreground">Trades <span className="text-sm font-normal text-muted-foreground">· {a.trades.length} · click one to see it on the chart</span></div>
          {a.trades.length === 0 && <div className="text-sm text-muted-foreground">No Trade in this period.</div>}
          {a.trades.length > 0 && <>
            <div className="hidden max-h-96 overflow-auto rounded-md border [@container(min-width:44rem)]:block">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-card text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>{['#', 'Date', 'Side', 'Contracts', 'Entry', 'Stop Loss', 'Take Profits', 'Exit', 'R', 'Result', 'Costs', 'Capital', 'Drawdown'].map((h) => <th key={h} className="whitespace-nowrap px-2 py-2 font-semibold">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {a.trades.map((t) => {
                    const g = t.sig, on = selected === g;
                    return (
                      <tr key={t.n} onClick={() => show(t)} className={cn('cursor-pointer border-t hover:bg-accent', on && 'bg-sky-500/10')}>
                        <td className="px-2 py-1.5 text-muted-foreground">{t.n}</td>
                        <td className="whitespace-nowrap px-2 py-1.5">{dayLabel(data.m1[g.i].di)} {fmtT(data, g.trade!.fillI!)}</td>
                        <td className={cn('px-2 py-1.5 font-semibold uppercase', g.side === 'long' ? 'text-cyan-300' : 'text-red-300')}>{g.side}</td>
                        <td className="px-2 py-1.5 tabular-nums">{g.legs.reduce((n, l) => n + l.contracts, 0)}</td>
                        <td className="px-2 py-1.5 tabular-nums">{g.entry.toFixed(2)}</td>
                        <td className="px-2 py-1.5 tabular-nums text-red-300">{g.stop.toFixed(2)}</td>
                        <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-emerald-300">{g.legs.map((l) => `${l.name} ${l.price.toFixed(2)}`).join(' · ')}</td>
                        <td className="px-2 py-1.5">{t.exit ? <span className="tabular-nums">{t.exit.price.toFixed(2)} <span className={cn('text-xs', /break-even/.test(t.exit.why) ? 'text-amber-300' : 'text-muted-foreground')}>{t.exit.why.replace('While in a Trade: ', '')}</span></span> : '–'}</td>
                        <td className={cn('whitespace-nowrap px-2 py-1.5 font-semibold tabular-nums', t.kind === 'break-even' ? 'text-amber-300' : tone(t.r))}>{t.r > 0 ? '+' : ''}{t.r.toFixed(2)}R{t.be && <span title={`Stop Loss moved: ${t.be}`} className="ml-1.5 rounded border border-amber-500/50 bg-amber-500/10 px-1 text-[10px] font-bold text-amber-300">BE</span>}</td>
                        <td className={cn('px-2 py-1.5 tabular-nums', tone(t.usd))}>{usd(t.usd)}</td>
                        <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{t.cost ? `−$${t.cost.toFixed(0)}` : '–'}</td>
                        <td className={cn('px-2 py-1.5 tabular-nums', tone(t.growth))}>{pct(t.growth)}</td>
                        <td className={cn('whitespace-nowrap px-2 py-1.5 tabular-nums', t.dd > 0 && 'text-red-300')}>{t.dd > 0 ? <>{pct(-t.dd, false)} <span className="text-xs opacity-80">{usd(-t.ddUsd)}</span></> : '0%'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="max-h-[28rem] space-y-1.5 overflow-auto [@container(min-width:44rem)]:hidden">
              {a.trades.map((t) => {
                const g = t.sig, on = selected === g;
                return (
                  <button key={t.n} type="button" onClick={() => show(t)} className={cn('block w-full rounded-md border p-2 text-left text-xs hover:bg-accent', on && 'border-sky-500/60 bg-sky-500/10')}>
                    <div className="flex items-baseline justify-between gap-2 text-sm"><span><span className="text-muted-foreground">#{t.n}</span> {dayLabel(data.m1[g.i].di)} {fmtT(data, g.trade!.fillI!)} <b className={g.side === 'long' ? 'text-cyan-300' : 'text-red-300'}>{g.side.toUpperCase()}</b> <span className="text-xs text-muted-foreground">× {g.legs.reduce((n, l) => n + l.contracts, 0)}</span></span><b className={t.kind === 'break-even' ? 'text-amber-300' : tone(t.r)}>{t.r > 0 ? '+' : ''}{t.r.toFixed(2)}R · {usd(t.usd)}{t.be && <span title={`Stop Loss moved: ${t.be}`} className="ml-1.5 rounded border border-amber-500/50 bg-amber-500/10 px-1 text-[10px] font-bold text-amber-300">BE</span>}</b></div>
                    <div className="mt-0.5 text-muted-foreground">Entry <span className="text-foreground">{g.entry.toFixed(2)}</span> · Stop Loss <span className="text-red-300">{g.stop.toFixed(2)}</span> · {g.legs.map((l) => `${l.name} ${l.price.toFixed(2)}`).join(' · ')}</div>
                    <div className="text-muted-foreground">Exit <span className="text-foreground">{t.exit ? `${t.exit.price.toFixed(2)} ${t.exit.why.replace('While in a Trade: ', '')}` : '–'}</span> · Capital <span className={tone(t.growth)}>{pct(t.growth)}</span> · Drawdown <span className={t.dd > 0 ? 'text-red-300' : 'text-foreground'}>{t.dd > 0 ? `${pct(-t.dd, false)} (${usd(-t.ddUsd)})` : '0%'}</span></div>
                  </button>
                );
              })}
            </div>
          </>}
        </div>
      </>}
    </div>
  );
}

/** the account after each Trade, its running high (dashed) and the drawdowns between them (shaded); a click on a point shows that Trade */
function EquityCurve({ trades, capital, label, selected, onPick }: { trades: TradeRow[]; capital: number; label: (t: TradeRow) => string; selected: Signal | null; onPick: (t: TradeRow) => void }) {
  if (!trades.length) return null;
  const W = 600, H = 150, P = { l: 52, r: 10, t: 10, b: 20 };
  const eq = [capital, ...trades.map((t) => t.equity)];
  const peaks = eq.map((_, i) => Math.max(...eq.slice(0, i + 1)));
  const lo = Math.min(...eq), hi = Math.max(...eq), pad = (hi - lo || capital * 0.01) * 0.12;
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / Math.max(1, eq.length - 1);
  const y = (v: number) => P.t + ((hi + pad - v) * (H - P.t - P.b)) / (hi - lo + 2 * pad);
  const line = (vs: number[]) => vs.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const dd = `${line(peaks)} ${eq.map((_, i) => `L${x(eq.length - 1 - i).toFixed(1)},${y(eq[eq.length - 1 - i]).toFixed(1)}`).join(' ')} Z`;
  const fmt = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`;
  const last = eq[eq.length - 1];
  return (
    <div className="rounded-md border bg-card/40 p-2">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 px-1 text-xs"><span className="font-semibold text-foreground">Equity curve</span><span className="text-muted-foreground">{fmt(capital)} → <b className={last >= capital ? 'text-cyan-300' : 'text-red-300'}>{fmt(last)}</b> · shaded: drawdowns from the running high</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Equity curve">
        {[hi, capital, lo].filter((v, i, s) => s.indexOf(v) === i).map((v) => <g key={v}><line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="currentColor" className="text-border" strokeDasharray={v === capital ? '3 3' : undefined} /><text x={P.l - 4} y={y(v) + 3} textAnchor="end" fontSize="9" className="fill-muted-foreground">{fmt(v)}</text></g>)}
        <path d={dd} fill="rgba(239,68,68,0.22)" />
        <path d={line(peaks)} fill="none" stroke="rgba(148,163,184,0.6)" strokeDasharray="4 3" strokeWidth="1" />
        <path d={line(eq)} fill="none" stroke="#5eead4" strokeWidth="1.8" />
        {trades.map((t, k) => (
          <circle key={t.n} cx={x(k + 1)} cy={y(t.equity)} r={selected === t.sig ? 4.5 : 3} fill={t.usd > 0 ? '#5eead4' : t.usd < 0 ? '#fca5a5' : '#f59e0b'} stroke={selected === t.sig ? '#fff' : 'none'} className="cursor-pointer" onClick={() => onPick(t)}><title>{`${label(t)} · ${t.r > 0 ? '+' : ''}${t.r.toFixed(2)}R · ${fmt(t.equity)}`}</title></circle>
        ))}
        <text x={x(0)} y={H - 5} fontSize="9" className="fill-muted-foreground">start</text>
        <text x={x(eq.length - 1)} y={H - 5} fontSize="9" textAnchor="end" className="fill-muted-foreground">{label(trades[trades.length - 1])}</text>
      </svg>
    </div>
  );
}

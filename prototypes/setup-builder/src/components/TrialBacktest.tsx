// PROTOTYPE: a Draft backtest Run from Review & save (ADR 0007). It shows how the Draft trades on each instrument before Freeze.
// It is a backtest Run that binds the Draft: build years only (the held-out last 12 months stay locked), listed with the
// Runs and marked Draft, never promoted and never read by the Promotion gate. Here only MNQ bars exist: NQ replays them at $20 a point (same Nasdaq-100 prices); every other
// instrument shows what it would change (hours, volume) but has no numbers.
import React, { useMemo, useState } from 'react';
import { Data, run, RunResult } from '../engine';
import { Setup } from '../model';
import { instrumentWarnings } from '../runDraft';
import { InstrumentMultiSelect, instrumentLabel, sortInstruments } from './InstrumentSelect';
import { HelpBox } from './help';
import { cn } from './ui';

const BTN = 'flex h-9 items-center gap-1 rounded-md border border-sky-500/50 bg-sky-500/10 px-4 text-xs font-bold uppercase tracking-wider text-sky-300 transition-colors hover:bg-sky-500/20 disabled:opacity-40';
/** instruments the prototype can replay: their $ a point on the loaded MNQ bars */
const REPLAY: Record<string, { pv: number; note?: string }> = { MNQ: { pv: 2 }, NQ: { pv: 20, note: 'same Nasdaq-100 prices as MNQ, at $20 a point' } };
export interface Row { inst: string; res?: RunResult; pv?: number; info?: string; notes: string[] }
/** the Signals of a result whose bar falls in the Trading days [from, to] */
export const inPeriod = (data: Data, r: RunResult, from: number, to: number): RunResult => ({ ...r, signals: r.signals.filter((g) => { const d = data.m1[g.i].di; return d >= from && d <= to; }) });

/** the Draft backtest Run: what to run (instruments, period) and what the last run gave, shared by its card and its results */
export function useDraftBacktest(setup: Setup, data: Data) {
  const [picked, setPicked] = useState<string[]>(['MNQ', 'MES', 'NQ', 'ES']);
  const [from, setFrom] = useState(0);
  const [to, setTo] = useState(Math.max(0, data.days.length - 1));
  const [rows, setRows] = useState<Row[] | null>(null);
  const [ran, setRan] = useState<{ key: string; from: number; to: number } | null>(null);
  const key = useMemo(() => JSON.stringify(setup), [setup]);
  const go = () => {
    setRows(sortInstruments(picked).map((inst) => {
      const notes = instrumentWarnings(setup, inst).filter((w) => !/^No .* bars in this prototype/.test(w));
      const rp = REPLAY[inst];
      if (!rp) return { inst, notes: [...notes, 'No bars for it in this prototype.'] };
      // the engine warms up on every bar; only Signals inside the period count
      return { inst, res: inPeriod(data, run(data, setup, { pointValue: rp.pv }), from, to), pv: rp.pv, info: rp.note, notes };
    }));
    setRan({ key, from, to });
  };
  const stale = !!rows && !!ran && (ran.key !== key || ran.from !== from || ran.to !== to);
  return { picked, setPicked, from, setFrom, to, setTo, rows, ran, go, stale, capital: setup.trade_settings.risk.capital };
}
export type DraftBacktest = ReturnType<typeof useDraftBacktest>;
function stats(r: RunResult, pv: number) {
  const refused = r.signals.filter((g) => g.refused);
  const why = Object.entries(refused.reduce<Record<string, number>>((a, g) => { const k = (g.refused || '').split(':')[0]; a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
  const trades = r.signals.filter((g) => !g.refused && g.trade?.fillI != null && g.trade?.r != null);
  let cum = 0, peak = 0, dd = 0, usd = 0, ctr = 0;
  for (const g of trades) {
    const R = g.trade!.r!, n = g.legs.reduce((a, l) => a + l.contracts, 0);
    cum += R; peak = Math.max(peak, cum); dd = Math.max(dd, peak - cum);
    usd += R * Math.abs(g.entry - g.stop) * pv * n; ctr += n;
  }
  return {
    signals: r.signals.length, refused: refused.length, why: why[0] ? `${why[0][1]}× ${why[0][0]}` : '',
    trades: trades.length, win: trades.length ? Math.round((100 * trades.filter((g) => g.trade!.r! > 0).length) / trades.length) : null,
    R: trades.reduce((a, g) => a + g.trade!.r!, 0), usd, dd, contracts: trades.length ? ctr / trades.length : null,
  };
}
const fmtR = (x: number) => `${x > 0 ? '+' : ''}${x.toFixed(2)}R`;
const fmtUsd = (x: number) => `${x < 0 ? '−' : x > 0 ? '+' : ''}$${Math.abs(x).toFixed(0)}`;

export function TrialBacktest({ setup, data, bt }: { setup: Setup; data: Data; bt: DraftBacktest }) {
  const { picked, setPicked, rows, go, stale } = bt;
  const days = data.days.length, from = data.m1[0]?.td, to = data.m1[data.m1.length - 1]?.td;
  return (
    <div className="space-y-3 [container-type:inline-size]">
      <HelpBox id="review:trial">
        <div>A backtest Run of this Draft shows how it trades on each instrument before you freeze it. The same Rule blocks give different results per instrument: the $ a point changes the contracts and which Signals are refused as too wide, and hours or missing volume refuse others.</div>
        <div><b className="text-foreground">Build years only:</b> it runs on the first 4 of the 5 years. The last 12 months stay locked for the Promotion gate, which judges a frozen version per instrument. It is a backtest Run, listed with the Runs and marked Draft: it can never be promoted, and the gate never reads it. The latest one per instrument is kept, plus any you pin.</div>
        <div><b className="text-foreground">In this prototype:</b> the loaded MNQ sample ({from} to {to}, {days} Trading days) stands in for the build years. NQ replays the same Nasdaq-100 prices at $20 a point; other instruments show only what they would change.</div>
      </HelpBox>
      <InstrumentMultiSelect value={picked} onChange={setPicked} />
      <PeriodPicker data={data} bt={bt} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={BTN} disabled={!picked.length} onClick={go}>▶ Create a backtest Run</button>
        <span className="text-xs text-muted-foreground">{picked.length} instrument{picked.length === 1 ? '' : 's'} picked</span>
        {stale && <span className="text-xs text-amber-300">The Setup or the period changed since this backtest Run: create a new one.</span>}
      </div>
      {rows && (
        <div className={cn('space-y-2', stale && 'opacity-60')}>
          {/* a table when there is room, cards in a narrow panel or on a phone */}
          <div className="hidden overflow-x-auto rounded-md border [@container(min-width:40rem)]:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>{['Instrument', 'Signals', 'Refused', 'Trades', 'Win rate', 'Total', 'Result', 'Max drawdown', 'Contracts a Trade'].map((h) => <th key={h} className="whitespace-nowrap px-2.5 py-2 font-semibold">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = r.res && stats(r.res, r.pv!);
                  return (
                    <React.Fragment key={r.inst}>
                      <tr className="border-t">
                        <td className="whitespace-nowrap px-2.5 py-2 font-semibold">{instrumentLabel(r.inst)}</td>
                        {s ? <>
                          <td className="px-2.5 py-2">{s.signals}</td>
                          <td className="px-2.5 py-2">{s.refused}{s.why && <div className="text-xs text-muted-foreground">{s.why}</div>}</td>
                          <td className="px-2.5 py-2">{s.trades}</td>
                          <td className="px-2.5 py-2">{s.win == null ? '–' : `${s.win}%`}</td>
                          <td className={cn('px-2.5 py-2 font-semibold', s.R > 0 ? 'text-cyan-300' : s.R < 0 ? 'text-red-300' : '')}>{fmtR(s.R)}</td>
                          <td className={cn('px-2.5 py-2', s.usd > 0 ? 'text-cyan-300' : s.usd < 0 ? 'text-red-300' : '')}>{fmtUsd(s.usd)}</td>
                          <td className="px-2.5 py-2">{s.dd ? `−${s.dd.toFixed(2)}R` : '0R'}</td>
                          <td className="px-2.5 py-2">{s.contracts == null ? '–' : s.contracts.toFixed(1)}</td>
                        </> : <td colSpan={8} className="px-2.5 py-2 text-muted-foreground">no numbers</td>}
                      </tr>
                      {(r.info || r.notes.length > 0) && <tr><td colSpan={9} className="px-2.5 pb-2 text-xs">{r.info && <span className="text-muted-foreground">{r.info}. </span>}<span className="text-amber-300/90">{r.notes.join(' ')}</span></td></tr>}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 [@container(min-width:40rem)]:hidden">
            {rows.map((r) => {
              const s = r.res && stats(r.res, r.pv!);
              return (
                <div key={r.inst} className="rounded-md border p-2.5 text-sm">
                  <div className="flex items-baseline justify-between gap-2"><span className="font-semibold">{instrumentLabel(r.inst)}</span>{s && <span className={cn('font-semibold', s.R > 0 ? 'text-cyan-300' : s.R < 0 ? 'text-red-300' : '')}>{fmtR(s.R)} · {fmtUsd(s.usd)}</span>}</div>
                  {s ? <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>Signals <b className="text-foreground">{s.signals}</b></span><span>Refused <b className="text-foreground">{s.refused}</b>{s.why && ` (${s.why})`}</span>
                    <span>Trades <b className="text-foreground">{s.trades}</b></span><span>Win rate <b className="text-foreground">{s.win == null ? '–' : `${s.win}%`}</b></span>
                    <span>Max drawdown <b className="text-foreground">{s.dd ? `−${s.dd.toFixed(2)}R` : '0R'}</b></span><span>Contracts a Trade <b className="text-foreground">{s.contracts == null ? '–' : s.contracts.toFixed(1)}</b></span>
                  </div> : <div className="mt-1 text-xs text-muted-foreground">no numbers</div>}
                  {r.info && <div className="mt-1 text-xs text-muted-foreground">{r.info}.</div>}{r.notes.length > 0 && <div className="mt-1 text-xs text-amber-300/90">{r.notes.join(' ')}</div>}
                </div>
              );
            })}
          </div>
          <div className="text-xs text-muted-foreground">R is what each Trade risked at its stop loss, so R totals compare across instruments; the $ result and the contracts show the sizing.</div>
        </div>
      )}
    </div>
  );
}

/** the backtest period: whole Trading days inside the build years (here: the loaded sample) */
function PeriodPicker({ data, bt }: { data: Data; bt: DraftBacktest }) {
  const n = data.days.length, last = n - 1;
  const label = (d: number) => new Date(data.days[d].td + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const presets: [string, number, number][] = [['Whole sample', 0, last], ['Last 20 days', Math.max(0, n - 20), last], ['Last 10 days', Math.max(0, n - 10), last]];
  const SELC = 'h-9 rounded-md border border-input bg-card px-2 text-sm';
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Period</div>
      <div className="flex flex-wrap items-center gap-1.5">
        {presets.map(([l, f, t]) => (
          <button key={l} type="button" onClick={() => { bt.setFrom(f); bt.setTo(t); }}
            className={cn('h-8 rounded-md border px-2.5 text-xs font-semibold', bt.from === f && bt.to === t ? 'border-sky-500/60 bg-sky-500/15 text-sky-200' : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground')}>{l}</button>
        ))}
        <span className="flex flex-wrap items-center gap-1.5 text-sm">
          <select aria-label="Period start" value={bt.from} onChange={(e) => { const f = Number(e.target.value); bt.setFrom(f); if (bt.to < f) bt.setTo(f); }} className={SELC}>
            {data.days.map((_, d) => <option key={d} value={d}>{label(d)}</option>)}
          </select>
          <span className="text-muted-foreground">to</span>
          <select aria-label="Period end" value={bt.to} onChange={(e) => { const t = Number(e.target.value); bt.setTo(t); if (bt.from > t) bt.setFrom(t); }} className={SELC}>
            {data.days.map((_, d) => <option key={d} value={d}>{label(d)}</option>)}
          </select>
          <span className="text-xs text-muted-foreground">· {bt.to - bt.from + 1} Trading days</span>
        </span>
      </div>
    </div>
  );
}

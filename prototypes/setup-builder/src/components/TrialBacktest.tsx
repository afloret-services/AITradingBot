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
  const [preset, setPreset] = useState<string>('3m');
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
  return { picked, setPicked, from, setFrom, to, setTo, preset, setPreset, rows, ran, go, stale, capital: setup.trade_settings.risk.capital };
}
export type DraftBacktest = ReturnType<typeof useDraftBacktest>;
function stats(r: RunResult, pv: number) {
  const refused = r.signals.filter((g) => g.refused);
  const why = Object.entries(refused.reduce<Record<string, number>>((a, g) => { const k = (g.refused || '').split(':')[0]; a[k] = (a[k] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]);
  const trades = r.signals.filter((g) => !g.refused && g.trade?.fillI != null && g.trade?.r != null);
  let cum = 0, peak = 0, dd = 0, usd = 0, ctr = 0, cMin = Infinity, cMax = 0;
  for (const g of trades) {
    const R = g.trade!.r!, n = g.legs.reduce((a, l) => a + l.contracts, 0);
    cum += R; peak = Math.max(peak, cum); dd = Math.max(dd, peak - cum);
    usd += R * Math.abs(g.entry - g.stop) * pv * n; ctr += n; cMin = Math.min(cMin, n); cMax = Math.max(cMax, n);
  }
  return {
    signals: r.signals.length, refused: refused.length, why: why[0] ? `${why[0][1]}× ${why[0][0]}` : '',
    trades: trades.length, win: trades.length ? Math.round((100 * trades.filter((g) => g.trade!.r! > 0).length) / trades.length) : null,
    R: trades.reduce((a, g) => a + g.trade!.r!, 0), usd, dd, contracts: trades.length ? ctr / trades.length : null, cMin, cMax,
  };
}
/** a Trade's number of contracts: "2" when every Trade had 2, else the range and the average */
const contractsText = (s: { contracts: number | null; cMin: number; cMax: number }) => (s.contracts == null ? '–' : s.cMin === s.cMax ? String(s.cMax) : `${s.cMin}–${s.cMax} (avg ${s.contracts.toFixed(1)})`);
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
                <tr>{['Instrument', 'Signals', 'Refused', 'Trades', 'Win rate', 'Total', 'Result', 'Max drawdown', 'Number of contracts'].map((h) => <th key={h} className="whitespace-nowrap px-2.5 py-2 font-semibold">{h}</th>)}</tr>
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
                          <td className="whitespace-nowrap px-2.5 py-2">{contractsText(s)}</td>
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
                    <span>Max drawdown <b className="text-foreground">{s.dd ? `−${s.dd.toFixed(2)}R` : '0R'}</b></span><span>Number of contracts <b className="text-foreground">{contractsText(s)}</b></span>
                  </div> : <div className="mt-1 text-xs text-muted-foreground">no numbers</div>}
                  {r.info && <div className="mt-1 text-xs text-muted-foreground">{r.info}.</div>}{r.notes.length > 0 && <div className="mt-1 text-xs text-amber-300/90">{r.notes.join(' ')}</div>}
                </div>
              );
            })}
          </div>
          <div className="text-xs text-muted-foreground">R is what each Trade risked at its stop loss, so R totals compare across instruments; the $ result and the number of contracts show the sizing.</div>
        </div>
      )}
    </div>
  );
}

/** the backtest period. Presets count back from the end of the build years (a Draft never sees the held-out last
 * 12 months, ADR 0007), so at most 4 years; "Custom" picks any start and end date inside the build years. */
const PRESETS: [key: string, label: string, back: { d?: number; m?: number; y?: number }][] = [
  ['30d', 'Last 30 days', { d: 30 }], ['3m', 'Last 3 months', { m: 3 }], ['6m', 'Last 6 months', { m: 6 }], ['1y', 'Last year', { y: 1 }],
  ['2y', '2 years', { y: 2 }], ['3y', '3 years', { y: 3 }], ['4y', '4 years', { y: 4 }], ['5y', '5 years', { y: 5 }],
];
const BUILD_YEARS = 4;
function PeriodPicker({ data, bt }: { data: Data; bt: DraftBacktest }) {
  const last = data.days.length - 1;
  const dayOf = (iso: string, side: 'from' | 'to') => {
    if (side === 'from') { const k = data.days.findIndex((d) => d.td >= iso); return k < 0 ? last : k; }
    let k = -1; data.days.forEach((d, j) => { if (d.td <= iso) k = j; }); return k < 0 ? 0 : k;
  };
  const end = data.days[last].td;
  const startOf = (b: { d?: number; m?: number; y?: number }) => {
    const t = new Date(end + 'T12:00:00Z');
    if (b.d) t.setUTCDate(t.getUTCDate() - b.d + 1);
    if (b.m) t.setUTCMonth(t.getUTCMonth() - b.m);
    if (b.y) t.setUTCFullYear(t.getUTCFullYear() - b.y);
    return t.toISOString().slice(0, 10);
  };
  const choose = (key: string, b: { d?: number; m?: number; y?: number }) => { bt.setPreset(key); bt.setFrom(dayOf(startOf(b), 'from')); bt.setTo(last); };
  // the default preset applies once the bars are known
  React.useEffect(() => { const p = PRESETS.find(([k]) => k === bt.preset); if (p) choose(p[0], p[2]); }, [data]);
  const fmt = (td: string) => new Date(td + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const preset = PRESETS.find(([k]) => k === bt.preset);
  const wanted = preset ? startOf(preset[2]) : null;
  const clipped = wanted && wanted < data.days[0].td;
  const DATE = 'h-9 rounded-md border border-input bg-card px-2 text-sm [color-scheme:dark]';
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Period</div>
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map(([k, l, b]) => {
          const locked = (b.y || 0) > BUILD_YEARS;
          return (
            <button key={k} type="button" disabled={locked} onClick={() => choose(k, b)}
              title={locked ? 'A Draft backtest covers at most the 4 build years: the last 12 months of the 5 are held out for the Promotion gate.' : undefined}
              className={cn('h-8 rounded-md border px-2.5 text-xs font-semibold', bt.preset === k ? 'border-sky-500/60 bg-sky-500/15 text-sky-200' : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground', locked && 'cursor-not-allowed opacity-40 hover:bg-transparent')}>
              {locked ? '🔒 ' : ''}{l}
            </button>
          );
        })}
        <button type="button" onClick={() => bt.setPreset('custom')}
          className={cn('h-8 rounded-md border px-2.5 text-xs font-semibold', bt.preset === 'custom' ? 'border-sky-500/60 bg-sky-500/15 text-sky-200' : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground')}>Custom dates</button>
      </div>
      {bt.preset === 'custom' && (
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <input type="date" aria-label="Period start" min={data.days[0].td} max={end} value={data.days[bt.from].td}
            onChange={(e) => { if (!e.target.value) return; const f = dayOf(e.target.value, 'from'); bt.setFrom(f); if (bt.to < f) bt.setTo(f); }} className={DATE} />
          <span className="text-muted-foreground">to</span>
          <input type="date" aria-label="Period end" min={data.days[0].td} max={end} value={data.days[bt.to].td}
            onChange={(e) => { if (!e.target.value) return; const t = dayOf(e.target.value, 'to'); bt.setTo(t); if (bt.from > t) bt.setFrom(t); }} className={DATE} />
        </div>
      )}
      <div className="text-xs text-muted-foreground">
        {fmt(data.days[bt.from].td)} – {fmt(data.days[bt.to].td)} · {bt.to - bt.from + 1} Trading days
        {clipped && <span className="text-amber-300"> · this prototype holds only {data.days.length} Trading days of MNQ, so "{preset![1]}" runs on all of them</span>}
      </div>
    </div>
  );
}

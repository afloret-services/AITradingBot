// PROTOTYPE: a trial backtest in Review & save. It checks how the Draft trades on each instrument before Freeze.
// It runs on the build years only (the held-out last 12 months stay locked for the Promotion gate), saves nothing
// and is not a Run. Here only MNQ bars exist: NQ replays them at $20 a point (same Nasdaq-100 prices); every other
// instrument shows what it would change (hours, volume) but has no numbers.
import React, { useMemo, useState } from 'react';
import { Data, run, RunResult } from '../engine';
import { Setup } from '../model';
import { instrumentWarnings } from '../runDraft';
import { INSTRUMENT_TYPES, instrumentLabel } from './InstrumentSelect';
import { HelpBox } from './help';
import { cn } from './ui';

const BTN = 'flex h-9 items-center gap-1 rounded-md border border-sky-500/50 bg-sky-500/10 px-4 text-xs font-bold uppercase tracking-wider text-sky-300 transition-colors hover:bg-sky-500/20 disabled:opacity-40';
/** instruments the prototype can replay: their $ a point on the loaded MNQ bars */
const REPLAY: Record<string, { pv: number; note?: string }> = { MNQ: { pv: 2 }, NQ: { pv: 20, note: 'same Nasdaq-100 prices as MNQ, at $20 a point' } };
const CHOICES: { type: string; items: [string, string][] }[] = INSTRUMENT_TYPES.map((t) => ({
  type: t.label,
  items: t.groups.flatMap((g) => g.items.map(([c]) => [t.key === 'option' ? `OPT:${c}:0dte:atm` : c, t.key === 'option' ? `${c} opt.` : c] as [string, string])),
}));

interface Row { inst: string; res?: RunResult; pv?: number; info?: string; notes: string[] }
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

export function TrialBacktest({ setup, data }: { setup: Setup; data: Data }) {
  const [picked, setPicked] = useState<string[]>(['MNQ', 'NQ', 'MES', 'ES']);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [ranOn, setRanOn] = useState('');
  const key = useMemo(() => JSON.stringify(setup), [setup]);
  const days = data.days.length, from = data.m1[0]?.td, to = data.m1[data.m1.length - 1]?.td;
  const toggle = (c: string) => setPicked((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
  const go = () => {
    setRows(picked.map((inst) => {
      const notes = instrumentWarnings(setup, inst).filter((w) => !/^No .* bars in this prototype/.test(w));
      const rp = REPLAY[inst];
      if (!rp) return { inst, notes: [...notes, 'No bars for it in this prototype.'] };
      return { inst, res: run(data, setup, { pointValue: rp.pv }), pv: rp.pv, info: rp.note, notes };
    }));
    setRanOn(key);
  };
  const stale = rows && ranOn !== key;
  return (
    <div className="space-y-3 [container-type:inline-size]">
      <HelpBox id="review:trial">
        <div>Checks how this Draft trades on each instrument before you freeze it. The same Rule blocks give different results per instrument: the $ a point changes the contracts and which Signals are refused as too wide, and hours or missing volume refuse others.</div>
        <div><b className="text-foreground">Build years only:</b> it runs on the first 4 of the 5 years. The last 12 months stay locked for the Promotion gate, which judges a frozen version per instrument. Nothing is saved, and this is not a Run.</div>
        <div><b className="text-foreground">In this prototype:</b> the loaded MNQ sample ({from} to {to}, {days} Trading days) stands in for the build years. NQ replays the same Nasdaq-100 prices at $20 a point; other instruments show only what they would change.</div>
      </HelpBox>
      <div className="space-y-1.5">
        {CHOICES.map((t) => (
          <div key={t.type} className="flex flex-wrap items-center gap-1.5">
            <span className="w-20 shrink-0 text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.type}</span>
            {t.items.map(([c, l]) => (
              <button key={c} type="button" aria-pressed={picked.includes(c)} onClick={() => toggle(c)}
                className={cn('h-8 rounded-md border px-2.5 text-sm font-medium transition-colors', picked.includes(c) ? 'border-sky-500/60 bg-sky-500/15 text-sky-200' : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground')}>{l}</button>
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={BTN} disabled={!picked.length} onClick={go}>▶ Run trial backtest</button>
        <span className="text-xs text-muted-foreground">{picked.length} instrument{picked.length === 1 ? '' : 's'} picked</span>
        {stale && <span className="text-xs text-amber-300">The Setup changed since this trial: run it again.</span>}
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

// PROTOTYPE: a Draft backtest Run from Review & save (ADR 0007). It shows how the Draft trades on each instrument before Freeze.
// It is a backtest Run that binds the Draft: build years only (the held-out last 12 months stay locked), listed with the
// Runs and marked Draft, never promoted and never read by the Promotion gate. Here only MNQ bars exist: NQ replays them at $20 a point (same Nasdaq-100 prices); every other
// instrument shows what it would change (hours, volume) but has no numbers.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Data, run, RunResult } from '../engine';
import { Setup } from '../model';
import { instrumentWarnings } from '../runDraft';
import { INSTRUMENT_TYPES, instrumentLabel } from './InstrumentSelect';
import { HelpBox } from './help';
import { cn } from './ui';

const BTN = 'flex h-9 items-center gap-1 rounded-md border border-sky-500/50 bg-sky-500/10 px-4 text-xs font-bold uppercase tracking-wider text-sky-300 transition-colors hover:bg-sky-500/20 disabled:opacity-40';
/** instruments the prototype can replay: their $ a point on the loaded MNQ bars */
const REPLAY: Record<string, { pv: number; note?: string }> = { MNQ: { pv: 2 }, NQ: { pv: 20, note: 'same Nasdaq-100 prices as MNQ, at $20 a point' } };
/** [value, tag, description], in category order */
const CHOICES: { type: string; items: [string, string, string][] }[] = INSTRUMENT_TYPES.map((t) => ({
  type: t.label,
  items: t.groups.flatMap((g) => g.items.map(([c, d]) => (t.key === 'option'
    ? [`OPT:${c}:0dte:atm`, `${c} opt.`, `${d} · 0DTE · at the money`]
    : [c, c, d.replace(/^[^·]*·\s*/, '') || d]) as [string, string, string])),
}));
const ORDER = CHOICES.flatMap((t) => t.items.map(([v]) => v));
const TAG = Object.fromEntries(CHOICES.flatMap((t) => t.items.map(([v, l]) => [v, l])));
const TYPE_OF = Object.fromEntries(CHOICES.flatMap((t) => t.items.map(([v]) => [v, t.type])));

/** multi-select: the picked instruments as tags, a dropdown listing them by category */
function InstrumentMulti({ picked, setPicked }: { picked: string[]; setPicked: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const sorted = ORDER.filter((v) => picked.includes(v));
  const toggle = (v: string) => setPicked(picked.includes(v) ? picked.filter((x) => x !== v) : ORDER.filter((x) => x === v || picked.includes(x)));
  const ql = q.trim().toLowerCase();
  const groups = CHOICES.map((t) => ({ ...t, items: t.items.filter(([, l, d]) => !ql || `${l} ${d} ${t.type}`.toLowerCase().includes(ql)) })).filter((t) => t.items.length);
  return (
    <div ref={ref} className="relative">
      <div role="combobox" aria-expanded={open} onClick={() => setOpen(true)}
        className={cn('flex min-h-11 cursor-text flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-2 py-1.5 text-sm', open ? 'border-sky-400 ring-2 ring-sky-500/30' : 'border-input')}>
        {sorted.map((v) => (
          <span key={v} className="inline-flex h-7 items-center gap-1 rounded-md border border-sky-500/50 bg-sky-500/15 pl-2 pr-1 text-sm font-medium text-sky-200">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300/70">{TYPE_OF[v].slice(0, 3)}</span>{TAG[v]}
            <button type="button" aria-label={`remove ${TAG[v]}`} onClick={(e) => { e.stopPropagation(); toggle(v); }} className="flex h-5 w-5 items-center justify-center rounded text-base leading-none text-sky-300 hover:bg-sky-500/30">×</button>
          </span>
        ))}
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); if (e.key === 'Backspace' && !q && sorted.length) toggle(sorted[sorted.length - 1]); }}
          placeholder={sorted.length ? 'Add…' : 'Pick instruments…'} className="h-7 min-w-[6rem] flex-1 bg-transparent px-1 outline-none placeholder:text-muted-foreground" />
        <button type="button" aria-label={open ? 'close the list' : 'open the list'} onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="ml-auto flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent">{open ? '▴' : '▾'}</button>
      </div>
      {open && (
        <div role="listbox" aria-multiselectable className="mt-1 max-h-80 overflow-auto rounded-md border bg-card p-1 shadow-lg">
          {groups.length === 0 && <div className="px-2 py-2 text-sm text-muted-foreground">No instrument matches “{q}”.</div>}
          {groups.map((t) => {
            const all = t.items.every(([v]) => picked.includes(v));
            return (
              <div key={t.type} className="py-1">
                <div className="sticky top-0 z-10 -mx-1 flex items-center justify-between bg-card px-3 py-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.type}</span>
                  <button type="button" className="text-xs font-semibold text-sky-300 hover:underline"
                    onClick={() => { const vs = t.items.map(([v]) => v); setPicked(all ? picked.filter((x) => !vs.includes(x)) : ORDER.filter((x) => vs.includes(x) || picked.includes(x))); }}>{all ? 'Clear' : 'Select all'}</button>
                </div>
                {t.items.map(([v, l, d]) => {
                  const on = picked.includes(v);
                  return (
                    <button key={v} type="button" role="option" aria-selected={on} onClick={() => toggle(v)}
                      className={cn('flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm hover:bg-accent', on && 'bg-sky-500/10')}>
                      <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-black', on ? 'border-sky-400 bg-sky-500 text-black' : 'border-input')}>{on ? '✓' : ''}</span>
                      <span className="w-20 shrink-0 font-semibold">{l}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{d}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
  const go = () => {
    setRows(ORDER.filter((v) => picked.includes(v)).map((inst) => {
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
        <div>A backtest Run of this Draft shows how it trades on each instrument before you freeze it. The same Rule blocks give different results per instrument: the $ a point changes the contracts and which Signals are refused as too wide, and hours or missing volume refuse others.</div>
        <div><b className="text-foreground">Build years only:</b> it runs on the first 4 of the 5 years. The last 12 months stay locked for the Promotion gate, which judges a frozen version per instrument. It is a backtest Run, listed with the Runs and marked Draft: it can never be promoted, and the gate never reads it. The latest one per instrument is kept, plus any you pin.</div>
        <div><b className="text-foreground">In this prototype:</b> the loaded MNQ sample ({from} to {to}, {days} Trading days) stands in for the build years. NQ replays the same Nasdaq-100 prices at $20 a point; other instruments show only what they would change.</div>
      </HelpBox>
      <InstrumentMulti picked={picked} setPicked={setPicked} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={BTN} disabled={!picked.length} onClick={go}>▶ Create a backtest Run</button>
        <span className="text-xs text-muted-foreground">{picked.length} instrument{picked.length === 1 ? '' : 's'} picked</span>
        {stale && <span className="text-xs text-amber-300">The Setup changed since this backtest Run: create a new one.</span>}
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

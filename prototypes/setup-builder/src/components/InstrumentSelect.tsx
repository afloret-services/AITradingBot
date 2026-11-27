// PROTOTYPE: the instrument a Run trades, picked by type first (Futures, Forex, Stocks, Options), then by name.
// Stocks and options joined the scope on 2026-11-26. An option instrument is one code, "OPT:<underlying>:<expiry>:<strike>";
// the branch decides calls or puts (a long branch buys calls, a short branch buys puts).
import React, { useEffect, useRef, useState } from 'react';
import { cn } from './ui';

export type InstrumentType = 'future' | 'forex' | 'stock' | 'option';
type Group = { label: string; items: [code: string, label: string][] };

export const INSTRUMENT_TYPES: { key: InstrumentType; label: string; groups: Group[]; note: string }[] = [
  { key: 'future', label: 'Futures', note: 'CME futures: sized in contracts, a fixed $ a point.', groups: [
    { label: 'Index futures (CME)', items: [
      ['MNQ', 'MNQ · Micro Nasdaq-100 · $2 a point (bars loaded)'],
      ['MES', 'MES · Micro S&P 500 · $5 a point'],
      ['NQ', 'NQ · E-mini Nasdaq-100 · $20 a point'],
      ['ES', 'ES · E-mini S&P 500 · $50 a point'],
    ] },
    { label: 'Currency futures (CME)', items: [['M6E', 'M6E · Micro EUR/USD · $1.25 a tick']] },
  ] },
  { key: 'forex', label: 'Forex', note: 'Spot currency pairs on IBKR IDEALPRO: sized in units, no volume, trades around the clock on weekdays.', groups: [
    { label: 'Spot forex (IBKR IDEALPRO)', items: [
      ['EURUSD', 'EUR/USD'], ['GBPUSD', 'GBP/USD'], ['USDJPY', 'USD/JPY'],
    ] },
  ] },
  { key: 'stock', label: 'Stocks', note: 'US shares and ETFs: sized in shares, $1 a point a share, regular hours 09:30–16:00 New York.', groups: [
    { label: 'Index ETFs', items: [['SPY', 'SPY · S&P 500 ETF'], ['QQQ', 'QQQ · Nasdaq-100 ETF']] },
    { label: 'Shares', items: [['AAPL', 'AAPL · Apple'], ['NVDA', 'NVDA · NVIDIA'], ['TSLA', 'TSLA · Tesla']] },
  ] },
  { key: 'option', label: 'Options', note: 'US equity and ETF options: ×100 a contract, regular hours. The Setup reads the underlying\'s chart; the order is for the option.', groups: [
    { label: 'Index ETF options', items: [['SPY', 'SPY options'], ['QQQ', 'QQQ options']] },
    { label: 'Share options', items: [['AAPL', 'AAPL options'], ['NVDA', 'NVDA options'], ['TSLA', 'TSLA options']] },
  ] },
];
export const OPTION_EXPIRIES: [string, string][] = [['0dte', 'Same day (0DTE)'], ['weekly', 'Nearest weekly'], ['monthly', 'Nearest monthly']];
export const OPTION_STRIKES: [string, string][] = [['atm', 'At the money'], ['otm1', '1 strike out of the money'], ['d30', 'Delta about 0.30']];

/** flat list for code that only needs the groups (kept for older callers) */
export const INSTRUMENT_GROUPS: Group[] = INSTRUMENT_TYPES.flatMap((t) => t.groups);

export function parseInstrument(v: string): { type: InstrumentType; code: string; expiry?: string; strike?: string } {
  if (v.startsWith('OPT:')) { const [, code, expiry, strike] = v.split(':'); return { type: 'option', code, expiry, strike }; }
  const t = INSTRUMENT_TYPES.find((x) => x.key !== 'option' && x.groups.some((g) => g.items.some(([c]) => c === v)));
  return { type: t?.key || 'future', code: v };
}
const optionCode = (code: string, expiry = '0dte', strike = 'atm') => `OPT:${code}:${expiry}:${strike}`;
/** the instrument in words, e.g. "SPY options · Same day (0DTE) · At the money" */
export function instrumentLabel(v: string): string {
  const p = parseInstrument(v);
  if (p.type !== 'option') return p.code;
  return `${p.code} options · ${OPTION_EXPIRIES.find(([k]) => k === p.expiry)?.[1] || p.expiry} · ${OPTION_STRIKES.find(([k]) => k === p.strike)?.[1] || p.strike}`;
}

const SEL = 'h-9 max-w-full rounded-md border border-input bg-card px-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30';

export function InstrumentSelect({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const p = parseInstrument(value);
  const type = INSTRUMENT_TYPES.find((t) => t.key === p.type)!;
  const pickType = (k: InstrumentType) => {
    if (k === p.type) return;
    const first = INSTRUMENT_TYPES.find((t) => t.key === k)!.groups[0].items[0][0];
    onChange(k === 'option' ? optionCode(first) : first);
  };
  const pickCode = (c: string) => onChange(p.type === 'option' ? optionCode(c, p.expiry, p.strike) : c);
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div role="radiogroup" aria-label="Instrument type" className="flex flex-wrap gap-1">
        {INSTRUMENT_TYPES.map((t) => (
          <button key={t.key} type="button" role="radio" aria-checked={t.key === p.type} onClick={() => pickType(t.key)}
            className={cn('h-8 rounded-md border px-3 text-xs font-bold uppercase tracking-wider transition-colors', t.key === p.type ? 'border-sky-500/60 bg-sky-500/15 text-sky-200' : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground')}>{t.label}</button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <select value={p.code} onChange={(e) => pickCode(e.target.value)} aria-label="Instrument" className={cn(SEL, 'w-full sm:w-auto')}>
          {type.groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.items.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </optgroup>
          ))}
        </select>
        {p.type === 'option' && <>
          <select value={p.expiry} onChange={(e) => onChange(optionCode(p.code, e.target.value, p.strike))} aria-label="Option expiry" className={SEL}>
            {OPTION_EXPIRIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <select value={p.strike} onChange={(e) => onChange(optionCode(p.code, p.expiry, e.target.value))} aria-label="Option strike" className={SEL}>
            {OPTION_STRIKES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </>}
      </div>
      <div className="text-xs text-muted-foreground">{type.note}{p.type === 'option' && ' A long branch buys calls, a short branch buys puts.'}</div>
    </div>
  );
}

// ---------- several instruments at once: tags in the box, a list by category ----------
/** "OPT:SPY:weekly:atm" -> "OPT:SPY"; anything else unchanged */
const baseOf = (v: string) => (v.startsWith('OPT:') ? v.split(':').slice(0, 2).join(':') : v);
/** [base value, tag, description], in category order */
const MULTI: { type: string; items: [string, string, string][] }[] = INSTRUMENT_TYPES.map((t) => ({
  type: t.label,
  items: t.groups.flatMap((g) => g.items.map(([c, d]) => (t.key === 'option'
    ? [`OPT:${c}`, `${c} opt.`, d]
    : [c, c, d.replace(/^[^·]*·\s*/, '') || d]) as [string, string, string])),
}));
const ORDER = MULTI.flatMap((t) => t.items.map(([v]) => v));
const TAG = Object.fromEntries(MULTI.flatMap((t) => t.items.map(([v, l]) => [v, l])));
const TYPE_OF = Object.fromEntries(MULTI.flatMap((t) => t.items.map(([v]) => [v, t.type])));
/** in category order: futures, forex, stocks, options */
export const sortInstruments = (vs: string[]) => [...vs].sort((a, b) => ORDER.indexOf(baseOf(a)) - ORDER.indexOf(baseOf(b)));

export function InstrumentMultiSelect({ value, onChange, className }: { value: string[]; onChange: (v: string[]) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const picked = sortInstruments(value);
  const has = (b: string) => picked.some((v) => baseOf(v) === b);
  const add = (bs: string[]) => onChange(sortInstruments([...picked, ...bs.filter((b) => !has(b)).map((b) => (b.startsWith('OPT:') ? optionCode(b.slice(4)) : b))]));
  const drop = (bs: string[]) => onChange(picked.filter((v) => !bs.includes(baseOf(v))));
  const toggle = (b: string) => (has(b) ? drop([b]) : add([b]));
  const ql = q.trim().toLowerCase();
  const groups = MULTI.map((t) => ({ ...t, items: t.items.filter(([, l, d]) => !ql || `${l} ${d} ${t.type}`.toLowerCase().includes(ql)) })).filter((t) => t.items.length);
  const options = picked.filter((v) => v.startsWith('OPT:'));
  return (
    <div ref={ref} className={cn('min-w-0 space-y-1.5', className)}>
      <div role="combobox" aria-expanded={open} aria-label="Instruments" onClick={() => setOpen(true)}
        className={cn('flex min-h-11 cursor-text flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-2 py-1.5 text-sm', open ? 'border-sky-400 ring-2 ring-sky-500/30' : 'border-input')}>
        {picked.map((v) => {
          const b = baseOf(v);
          return (
            <span key={b} title={instrumentLabel(v)} className="inline-flex h-7 items-center gap-1 rounded-md border border-sky-500/50 bg-sky-500/15 pl-2 pr-1 text-sm font-medium text-sky-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300/70">{TYPE_OF[b].slice(0, 3)}</span>{TAG[b]}
              <button type="button" aria-label={`remove ${TAG[b]}`} onClick={(e) => { e.stopPropagation(); drop([b]); }} className="flex h-5 w-5 items-center justify-center rounded text-base leading-none text-sky-300 hover:bg-sky-500/30">×</button>
            </span>
          );
        })}
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); if (e.key === 'Backspace' && !q && picked.length) drop([baseOf(picked[picked.length - 1])]); }}
          placeholder={picked.length ? 'Add…' : 'Pick instruments…'} className="h-7 min-w-[6rem] flex-1 bg-transparent px-1 outline-none placeholder:text-muted-foreground" />
        <button type="button" aria-label={open ? 'close the list' : 'open the list'} onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="ml-auto flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent">{open ? '▴' : '▾'}</button>
      </div>
      {open && (
        <div role="listbox" aria-multiselectable className="max-h-80 overflow-auto rounded-md border bg-card p-1 shadow-lg">
          {groups.length === 0 && <div className="px-2 py-2 text-sm text-muted-foreground">No instrument matches “{q}”.</div>}
          {groups.map((t) => {
            const vs = t.items.map(([v]) => v), all = vs.every(has);
            return (
              <div key={t.type} className="py-1">
                <div className="sticky top-0 z-10 -mx-1 flex items-center justify-between bg-card px-3 py-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t.type}</span>
                  <button type="button" className="text-xs font-semibold text-sky-300 hover:underline" onClick={() => (all ? drop(vs) : add(vs))}>{all ? 'Clear' : 'Select all'}</button>
                </div>
                {t.items.map(([v, l, d]) => {
                  const on = has(v);
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
      {options.length > 0 && (
        <div className="space-y-1.5 rounded-md border border-dashed p-2">
          {options.map((v) => {
            const p = parseInstrument(v);
            const set = (n: string) => onChange(picked.map((x) => (x === v ? n : x)));
            return (
              <div key={v} className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className="w-24 shrink-0 font-semibold">{p.code} options</span>
                <select value={p.expiry} onChange={(e) => set(optionCode(p.code, e.target.value, p.strike))} aria-label={`${p.code} option expiry`} className={SEL}>
                  {OPTION_EXPIRIES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <select value={p.strike} onChange={(e) => set(optionCode(p.code, p.expiry, e.target.value))} aria-label={`${p.code} option strike`} className={SEL}>
                  {OPTION_STRIKES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
            );
          })}
          <div className="text-xs text-muted-foreground">A long branch buys calls, a short branch buys puts.</div>
        </div>
      )}
    </div>
  );
}

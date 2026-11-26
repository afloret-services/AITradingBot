// PROTOTYPE: the instrument a Run trades, picked by type first (Futures, Forex, Stocks, Options), then by name.
// Stocks and options joined the scope on 2026-11-26. An option instrument is one code, "OPT:<underlying>:<expiry>:<strike>";
// the branch decides calls or puts (a long branch buys calls, a short branch buys puts).
import React from 'react';
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

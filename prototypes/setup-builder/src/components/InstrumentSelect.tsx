// PROTOTYPE: the instrument a Run trades, grouped by category. Stocks are out of this map's scope (an open question on the map).
import React from 'react';
import { cn } from './ui';

export const INSTRUMENT_GROUPS: { label: string; items: [code: string, label: string][] }[] = [
  { label: 'Index futures (CME)', items: [
    ['MNQ', 'MNQ · Micro Nasdaq-100 · $2 a point (bars loaded)'],
    ['MES', 'MES · Micro S&P 500 · $5 a point'],
    ['NQ', 'NQ · E-mini Nasdaq-100 · $20 a point'],
    ['ES', 'ES · E-mini S&P 500 · $50 a point'],
  ] },
  { label: 'Currency futures (CME)', items: [
    ['M6E', 'M6E · Micro EUR/USD · $1.25 a tick'],
  ] },
  { label: 'Spot forex (IBKR IDEALPRO)', items: [
    ['EURUSD', 'EUR/USD spot · sized in units, no volume'],
  ] },
];

export function InstrumentSelect({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="Instrument"
      className={cn('h-8 w-full max-w-full rounded-md border sm:w-auto border-input bg-card px-1.5 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30', className)}>
      {INSTRUMENT_GROUPS.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.items.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

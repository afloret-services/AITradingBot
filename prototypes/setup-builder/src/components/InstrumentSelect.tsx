// PROTOTYPE: the instruments a Run (or a Draft backtest Run) trades: one search across every category, category tabs,
// recent picks and Instrument lists, and each row saying whether 5 years of history exist for it.
// Stocks and options joined the scope on 2026-11-26. An option instrument is one code, "OPT:<underlying>:<expiry>:<strike>";
// the branch decides calls or puts (a long branch buys calls, a short branch buys puts).
// Instruments and Instrument lists come from the Instrument management module (src/instrumentManagement.ts); this file only picks.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from './ui';
import { instrumentManagement, InstrumentType, Instrument } from '../instrumentManagement';

export type { InstrumentType } from '../instrumentManagement';
const CATEGORIES = instrumentManagement.categories();
const ALL = instrumentManagement.instruments().map((i) => ({ ...i, v: i.id }));
const BY_V = Object.fromEntries(ALL.map((i) => [i.v, i]));
const ORDER = ALL.map((i) => i.v);
type Item = (typeof ALL)[number];
/** recent picks, kept for the page's life (in memory, like the rest of the prototype) */
let RECENT: string[] = ['MNQ', 'SPY', 'EURUSD', 'OPT:QQQ'];

export const OPTION_EXPIRIES: [string, string][] = [['0dte', 'Same day (0DTE)'], ['weekly', 'Nearest weekly'], ['monthly', 'Nearest monthly']];
export const OPTION_STRIKES: [string, string][] = [['atm', 'At the money'], ['otm1', '1 strike out of the money'], ['d30', 'Delta about 0.30']];

export function parseInstrument(v: string): { type: InstrumentType; code: string; expiry?: string; strike?: string } {
  if (v.startsWith('OPT:')) { const [, code, expiry, strike] = v.split(':'); return { type: 'option', code, expiry, strike }; }
  return { type: (BY_V[v]?.type as InstrumentType) || 'future', code: v };
}
const optionCode = (code: string, expiry = '0dte', strike = 'atm') => `OPT:${code}:${expiry}:${strike}`;
/** the instrument in words, e.g. "SPY options · Same day (0DTE) · At the money" */
export function instrumentLabel(v: string): string {
  const p = parseInstrument(v);
  if (p.type !== 'option') return p.code;
  return `${p.code} options · ${OPTION_EXPIRIES.find(([k]) => k === p.expiry)?.[1] || p.expiry} · ${OPTION_STRIKES.find(([k]) => k === p.strike)?.[1] || p.strike}`;
}
/** why there is no 5-year history for it, or undefined when there is */
export const instrumentNoHistory = (v: string) => BY_V[baseOf(v)]?.noHistory;

const SEL = 'h-9 max-w-full rounded-md border border-input bg-card px-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30';

/** "OPT:SPY:weekly:atm" -> "OPT:SPY"; anything else unchanged */
const baseOf = (v: string) => (v.startsWith('OPT:') ? v.split(':').slice(0, 2).join(':') : v);
/** in category order: futures, forex, stocks, options */
export const sortInstruments = (vs: string[]) => [...vs].sort((a, b) => ORDER.indexOf(baseOf(a)) - ORDER.indexOf(baseOf(b)));

const PAGE = 25, PER_CAT = 5, TAGS_SHOWN = 8;
type Tab = 'all' | InstrumentType;

export function InstrumentMultiSelect({ value, onChange, className }: { value: string[]; onChange: (v: string[]) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [shown, setShown] = useState(PAGE);
  const [allTags, setAllTags] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [open]);
  useEffect(() => setShown(PAGE), [tab, q]);
  const [recent, setRecent] = useState(RECENT);
  useEffect(() => { if (open) setRecent(RECENT); }, [open]);
  const picked = sortInstruments(value);
  const has = (b: string) => picked.some((v) => baseOf(v) === b);
  const add = (bs: string[]) => {
    const ok = bs.filter((b) => !has(b) && !BY_V[b]?.noHistory);
    RECENT = [...ok.slice().reverse(), ...RECENT.filter((r) => !ok.includes(r))].slice(0, 6);
    onChange(sortInstruments([...picked, ...ok.map((b) => (b.startsWith('OPT:') ? optionCode(b.slice(4)) : b))]));
  };
  const drop = (bs: string[]) => onChange(picked.filter((v) => !bs.includes(baseOf(v))));
  const toggle = (b: string) => (has(b) ? drop([b]) : add([b]));
  const ql = q.trim().toLowerCase();
  const match = (i: Item) => !ql || i.tag.toLowerCase().startsWith(ql) || i.v.toLowerCase().startsWith(ql) || i.name.toLowerCase().includes(ql) || i.group.toLowerCase().includes(ql);
  // symbol matches first, then names starting with it, then the rest; category order kept within each rank
  const rank = (i: Item) => (!ql ? 0 : i.tag.toLowerCase().startsWith(ql) ? 0 : i.name.toLowerCase().split(/[\s/·&]+/).some((w) => w.startsWith(ql)) ? 1 : 2);
  const hits = useMemo(() => ALL.filter(match).map((i, k) => ({ i, k, r: rank(i) })).sort((a, b) => a.r - b.r || a.k - b.k).map((x) => x.i), [ql]);
  const count = (k: Tab) => (k === 'all' ? hits.length : hits.filter((i) => i.type === k).length);
  const options = picked.filter((v) => v.startsWith('OPT:'));
  const tags = allTags ? picked : picked.slice(0, TAGS_SHOWN);

  const row = (i: (typeof ALL)[number]) => {
    const on = has(i.v), off = !!i.noHistory && !on;
    return (
      <button key={i.v} type="button" role="option" aria-selected={on} aria-disabled={off} onClick={() => !off && toggle(i.v)}
        className={cn('flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm', off ? 'cursor-not-allowed opacity-45' : 'hover:bg-accent', on && 'bg-sky-500/10')}>
        <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-black', on ? 'border-sky-400 bg-sky-500 text-black' : 'border-input')}>{on ? '✓' : ''}</span>
        <span className="w-20 shrink-0 font-semibold">{i.tag}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{i.name}</span>
        {i.noHistory && <span className="shrink-0 rounded border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300" title={`Refused: ${i.noHistory}`}>no 5-yr history</span>}
      </button>
    );
  };
  const head = (children: React.ReactNode, right?: React.ReactNode) => (
    <div className="flex items-center justify-between gap-2 px-2 pb-1 pt-2"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{children}</span>{right}</div>
  );
  const linkBtn = (onClick: () => void, children: React.ReactNode) => <button type="button" onClick={onClick} className="text-xs font-semibold text-sky-300 hover:underline">{children}</button>;

  let body: React.ReactNode;
  if (tab === 'all' && !ql) {
    body = <>
      {head('Recent')}
      {recent.map((v) => BY_V[v] && row(BY_V[v]))}
      {head('Instrument lists')}
      <div className="flex flex-wrap gap-1.5 px-2 pb-1">
        {instrumentManagement.lists().map(({ id, name, instruments: vs }) => {
          const ok = vs.filter((v) => !BY_V[v]?.noHistory), skipped = vs.filter((v) => BY_V[v]?.noHistory);
          const all = ok.every(has);
          return (
            <button key={id} type="button" onClick={() => (all ? drop(vs) : add(vs))} title={vs.join(', ') + (skipped.length ? `\nSkipped (no 5-year history): ${skipped.join(', ')}` : '')}
              className={cn('h-8 rounded-md border px-2.5 text-xs font-semibold', all ? 'border-sky-500/60 bg-sky-500/15 text-sky-200' : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground')}>
              {all ? '✓ ' : '+ '}{name} <span className="font-normal opacity-70">· {ok.length}{skipped.length > 0 && ` (${skipped.length} skipped)`}</span>
            </button>
          );
        })}
      </div>
      <div className="px-2 pb-2 pt-1 text-xs text-muted-foreground">Type a symbol or a name, or pick a tab to browse a whole category. Instruments and Instrument lists are managed in Instrument management.</div>
    </>;
  } else if (tab === 'all') {
    body = CATEGORIES.map((t) => {
      const list = hits.filter((i) => i.type === t.key);
      if (!list.length) return null;
      return (
        <div key={t.key}>
          {head(<>{t.label} <span className="font-normal normal-case tracking-normal">· {list.length}</span></>, list.length > PER_CAT && linkBtn(() => setTab(t.key), <>Show all {list.length} →</>))}
          {list.slice(0, PER_CAT).map((i) => row(i))}
        </div>
      );
    });
    if (!hits.length) body = <div className="px-2 py-3 text-sm text-muted-foreground">No instrument matches “{q}”.</div>;
  } else {
    const list = hits.filter((i) => i.type === tab);
    const groups = [...new Set(list.slice(0, shown).map((i) => i.group))];
    body = <>
      {groups.map((g) => {
        const gi = list.slice(0, shown).filter((i) => i.group === g);
        const avail = list.filter((i) => i.group === g && !i.noHistory).map((i) => i.v);
        const all = avail.length > 0 && avail.every(has);
        return (
          <div key={g}>
            {head(g, avail.length > 0 && avail.length <= 12 && linkBtn(() => (all ? drop(avail) : add(avail)), <>{all ? 'Clear' : 'Select all'}</>))}
            {gi.map((i) => row(i))}
          </div>
        );
      })}
      {!list.length && <div className="px-2 py-3 text-sm text-muted-foreground">No {CATEGORIES.find((t) => t.key === tab)!.label.toLowerCase()} match “{q}”.</div>}
      {list.length > shown && <div className="px-2 py-2">{linkBtn(() => setShown(shown + PAGE), <>Show {Math.min(PAGE, list.length - shown)} more ({list.length - shown} left)</>)}</div>}
    </>;
  }

  return (
    <div ref={ref} className={cn('min-w-0 space-y-1.5', className)}>
      <div role="combobox" aria-expanded={open} aria-label="Instruments" onClick={() => setOpen(true)}
        className={cn('flex min-h-11 cursor-text flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-2 py-1.5 text-sm', open ? 'border-sky-400 ring-2 ring-sky-500/30' : 'border-input')}>
        {tags.map((v) => {
          const b = baseOf(v), i = BY_V[b];
          return (
            <span key={b} title={instrumentLabel(v)} className="inline-flex h-7 items-center gap-1 rounded-md border border-sky-500/50 bg-sky-500/15 pl-2 pr-1 text-sm font-medium text-sky-200">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300/70">{i?.short}</span>{i?.tag || b}
              <button type="button" aria-label={`remove ${i?.tag || b}`} onClick={(e) => { e.stopPropagation(); drop([b]); }} className="flex h-5 w-5 items-center justify-center rounded text-base leading-none text-sky-300 hover:bg-sky-500/30">×</button>
            </span>
          );
        })}
        {picked.length > TAGS_SHOWN && (
          <button type="button" onClick={(e) => { e.stopPropagation(); setAllTags(!allTags); }} className="h-7 rounded-md border border-dashed border-sky-500/50 px-2 text-xs font-semibold text-sky-300 hover:bg-sky-500/10">
            {allTags ? 'Show fewer' : `+${picked.length - TAGS_SHOWN} more`}
          </button>
        )}
        {picked.length > 1 && <button type="button" onClick={(e) => { e.stopPropagation(); onChange([]); }} className="h-7 px-1.5 text-xs text-muted-foreground hover:text-foreground">Clear all</button>}
        <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
          placeholder={picked.length ? 'Search to add…' : 'Search symbols or names…'} aria-label="Search instruments" className="h-7 min-w-[8rem] flex-1 bg-transparent px-1 outline-none placeholder:text-muted-foreground" />
        <button type="button" aria-label={open ? 'close the list' : 'open the list'} onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="ml-auto flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent">{open ? '▴' : '▾'}</button>
      </div>
      {open && (
        <div className="rounded-md border bg-card shadow-lg">
          <div role="tablist" aria-label="Instrument category" className="flex flex-wrap gap-1 border-b p-1">
            {(['all', ...CATEGORIES.map((t) => t.key)] as Tab[]).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={cn('h-8 shrink-0 rounded px-2.5 text-xs font-semibold', tab === k ? 'bg-sky-500/15 text-sky-200' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
                {k === 'all' ? 'All' : CATEGORIES.find((t) => t.key === k)!.label} <span className="font-normal opacity-70">{count(k)}</span>
              </button>
            ))}
          </div>
          <div role="listbox" aria-multiselectable className="max-h-80 overflow-auto p-1">{body}</div>
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

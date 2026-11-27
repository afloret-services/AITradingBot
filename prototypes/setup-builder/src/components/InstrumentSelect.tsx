// PROTOTYPE: the instruments a Run (or a Draft backtest Run) trades: one search across every category, category tabs,
// recent picks and Instrument lists, and each row saying whether 5 years of history exist for it.
// Stocks and options joined the scope on 2026-11-26. An option instrument is one code, "OPT:<underlying>:<expiry>:<strike>";
// the branch decides calls or puts (a long branch buys calls, a short branch buys puts).
// The catalog below is a made-up stand-in for the Market data module's list (2026-11-27), sized to feel a bigger list.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from './ui';

export type InstrumentType = 'future' | 'forex' | 'stock' | 'option';
type Item = { v: string; tag: string; name: string; group: string; noHistory?: string };

const rows = (s: string) => s.trim().split('\n').map((l) => l.trim().split('|'));
const FUTURES = rows(`
MNQ|Micro Nasdaq-100 · $2 a point (bars loaded)|Index futures
MES|Micro S&P 500 · $5 a point|Index futures
NQ|E-mini Nasdaq-100 · $20 a point|Index futures
ES|E-mini S&P 500 · $50 a point|Index futures
M2K|Micro Russell 2000 · $5 a point|Index futures|-
RTY|E-mini Russell 2000 · $50 a point|Index futures|-
MYM|Micro Dow · $0.50 a point|Index futures|-
YM|E-mini Dow · $5 a point|Index futures|-
M6E|Micro EUR/USD · $1.25 a tick|Currency futures
6E|Euro FX · $6.25 a tick|Currency futures|-
6B|British pound · $6.25 a tick|Currency futures|-
6J|Japanese yen · $6.25 a tick|Currency futures|-
MGC|Micro gold · $1 a tick|Metals and energy|-
GC|Gold · $10 a tick|Metals and energy|-
MCL|Micro crude oil · $1 a tick|Metals and energy|-
CL|Crude oil · $10 a tick|Metals and energy|-`);
const FOREX = rows(`
EURUSD|Euro / US dollar|Majors
GBPUSD|British pound / US dollar|Majors
USDJPY|US dollar / Japanese yen|Majors
USDCHF|US dollar / Swiss franc|Majors
AUDUSD|Australian dollar / US dollar|Majors
USDCAD|US dollar / Canadian dollar|Majors
NZDUSD|New Zealand dollar / US dollar|Majors
EURGBP|Euro / British pound|Crosses
EURJPY|Euro / Japanese yen|Crosses
GBPJPY|British pound / Japanese yen|Crosses
EURCHF|Euro / Swiss franc|Crosses
AUDJPY|Australian dollar / Japanese yen|Crosses
EURAUD|Euro / Australian dollar|Crosses
GBPCHF|British pound / Swiss franc|Crosses
CADJPY|Canadian dollar / Japanese yen|Crosses
NZDJPY|New Zealand dollar / Japanese yen|Crosses
USDMXN|US dollar / Mexican peso|Exotics
USDZAR|US dollar / South African rand|Exotics
USDSEK|US dollar / Swedish krona|Exotics
USDTRY|US dollar / Turkish lira|Exotics|-`);
const STOCKS = rows(`
SPY|S&P 500 ETF|Index ETFs
QQQ|Nasdaq-100 ETF|Index ETFs
IWM|Russell 2000 ETF|Index ETFs
DIA|Dow Jones ETF|Index ETFs
XLK|Technology sector ETF|Sector ETFs
XLF|Financials sector ETF|Sector ETFs
XLE|Energy sector ETF|Sector ETFs
XLV|Health care sector ETF|Sector ETFs
SMH|Semiconductor ETF|Sector ETFs
AAPL|Apple|Shares
MSFT|Microsoft|Shares
NVDA|NVIDIA|Shares
AMZN|Amazon|Shares
GOOGL|Alphabet|Shares
META|Meta Platforms|Shares
TSLA|Tesla|Shares
AVGO|Broadcom|Shares
AMD|Advanced Micro Devices|Shares
NFLX|Netflix|Shares
ADBE|Adobe|Shares
CRM|Salesforce|Shares
ORCL|Oracle|Shares
INTC|Intel|Shares
QCOM|Qualcomm|Shares
MU|Micron|Shares
TXN|Texas Instruments|Shares
CSCO|Cisco|Shares
IBM|IBM|Shares
JPM|JPMorgan Chase|Shares
BAC|Bank of America|Shares
GS|Goldman Sachs|Shares
MS|Morgan Stanley|Shares
WFC|Wells Fargo|Shares
V|Visa|Shares
MA|Mastercard|Shares
PYPL|PayPal|Shares
XOM|Exxon Mobil|Shares
CVX|Chevron|Shares
COP|ConocoPhillips|Shares
UNH|UnitedHealth|Shares
JNJ|Johnson & Johnson|Shares
LLY|Eli Lilly|Shares
PFE|Pfizer|Shares
MRK|Merck|Shares
ABBV|AbbVie|Shares
KO|Coca-Cola|Shares
PEP|PepsiCo|Shares
MCD|McDonald's|Shares
WMT|Walmart|Shares
COST|Costco|Shares
HD|Home Depot|Shares
NKE|Nike|Shares
DIS|Disney|Shares
BA|Boeing|Shares
CAT|Caterpillar|Shares
GE|GE Aerospace|Shares
UBER|Uber|Shares
COIN|Coinbase|Shares
PLTR|Palantir|Shares
ARM|Arm Holdings · listed 2023|Shares|ipo
RDDT|Reddit · listed 2024|Shares|ipo`);

const toItems = (rs: string[][], opt = false): Item[] => rs.map(([c, name, group, nh]) => ({
  v: opt ? `OPT:${c}` : c, tag: opt ? `${c} opt.` : c, name: opt ? `${c} options · ${name.replace(/ · listed.*/, '')}` : name, group: opt ? `${group.replace(/s$/, '')} options` : group,
  noHistory: nh === 'ipo' ? 'listed less than 5 years ago' : nh === '-' ? 'no 5-year history bought yet' : undefined,
}));
export const CATALOG: { key: InstrumentType; label: string; short: string; items: Item[] }[] = [
  { key: 'future', label: 'Futures', short: 'Fut', items: toItems(FUTURES) },
  { key: 'forex', label: 'Forex', short: 'FX', items: toItems(FOREX) },
  { key: 'stock', label: 'Stocks', short: 'Stk', items: toItems(STOCKS) },
  { key: 'option', label: 'Options', short: 'Opt', items: toItems(STOCKS, true) },
];
const ALL = CATALOG.flatMap((t) => t.items.map((i) => ({ ...i, type: t.key, typeLabel: t.label, short: t.short })));
const BY_V = Object.fromEntries(ALL.map((i) => [i.v, i]));
const ORDER = ALL.map((i) => i.v);
/** Instrument lists: one click adds every instrument in it */
const SAVED: [string, string[]][] = [
  ['Index futures', ['MNQ', 'MES', 'NQ', 'ES']],
  ['Micro futures', ['MNQ', 'MES', 'M2K', 'MYM', 'M6E', 'MGC', 'MCL']],
  ['Forex majors', ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD']],
  ['Index ETFs', ['SPY', 'QQQ', 'IWM', 'DIA']],
  ['Mega-cap tech', ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA']],
];
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
  const match = (i: Item & { typeLabel: string }) => !ql || i.tag.toLowerCase().startsWith(ql) || i.v.toLowerCase().startsWith(ql) || i.name.toLowerCase().includes(ql) || i.group.toLowerCase().includes(ql);
  // symbol matches first, then names starting with it, then the rest; category order kept within each rank
  const rank = (i: Item) => (!ql ? 0 : i.tag.toLowerCase().startsWith(ql) ? 0 : i.name.toLowerCase().split(/[\s/·&]+/).some((w) => w.startsWith(ql)) ? 1 : 2);
  const hits = useMemo(() => ALL.filter(match).map((i, k) => ({ i, k, r: rank(i) })).sort((a, b) => a.r - b.r || a.k - b.k).map((x) => x.i), [ql]);
  const count = (k: Tab) => (k === 'all' ? hits.length : hits.filter((i) => i.type === k).length);
  const options = picked.filter((v) => v.startsWith('OPT:'));
  const tags = allTags ? picked : picked.slice(0, TAGS_SHOWN);

  const Row = ({ i }: { i: (typeof ALL)[number] }) => {
    const on = has(i.v), off = !!i.noHistory && !on;
    return (
      <button type="button" role="option" aria-selected={on} aria-disabled={off} onClick={() => !off && toggle(i.v)}
        className={cn('flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-sm', off ? 'cursor-not-allowed opacity-45' : 'hover:bg-accent', on && 'bg-sky-500/10')}>
        <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-black', on ? 'border-sky-400 bg-sky-500 text-black' : 'border-input')}>{on ? '✓' : ''}</span>
        <span className="w-20 shrink-0 font-semibold">{i.tag}</span>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{i.name}</span>
        {i.noHistory && <span className="shrink-0 rounded border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300" title={`Refused: ${i.noHistory}`}>no 5-yr history</span>}
      </button>
    );
  };
  const Head = ({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) => (
    <div className="sticky top-0 z-10 -mx-1 flex items-center justify-between gap-2 bg-card px-3 pb-1 pt-2"><span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{children}</span>{right}</div>
  );
  const LinkBtn = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => <button type="button" onClick={onClick} className="text-xs font-semibold text-sky-300 hover:underline">{children}</button>;

  let body: React.ReactNode;
  if (tab === 'all' && !ql) {
    body = <>
      <Head>Recent</Head>
      {RECENT.map((v) => BY_V[v] && <Row key={v} i={BY_V[v]} />)}
      <Head>Instrument lists</Head>
      <div className="flex flex-wrap gap-1.5 px-2 pb-1">
        {SAVED.map(([name, vs]) => {
          const all = vs.filter((v) => !BY_V[v]?.noHistory).every(has);
          return (
            <button key={name} type="button" onClick={() => (all ? drop(vs) : add(vs))} title={vs.join(', ')}
              className={cn('h-8 rounded-md border px-2.5 text-xs font-semibold', all ? 'border-sky-500/60 bg-sky-500/15 text-sky-200' : 'border-input text-muted-foreground hover:bg-accent hover:text-foreground')}>
              {all ? '✓ ' : '+ '}{name} <span className="font-normal opacity-70">· {vs.length}</span>
            </button>
          );
        })}
      </div>
      <div className="px-2 pb-2 pt-1 text-xs text-muted-foreground">Type a symbol or a name, or pick a tab to browse a whole category.</div>
    </>;
  } else if (tab === 'all') {
    body = CATALOG.map((t) => {
      const list = hits.filter((i) => i.type === t.key);
      if (!list.length) return null;
      return (
        <div key={t.key}>
          <Head right={list.length > PER_CAT && <LinkBtn onClick={() => setTab(t.key)}>Show all {list.length} →</LinkBtn>}>{t.label} <span className="font-normal normal-case tracking-normal">· {list.length}</span></Head>
          {list.slice(0, PER_CAT).map((i) => <Row key={i.v} i={i} />)}
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
            <Head right={avail.length > 0 && avail.length <= 12 && <LinkBtn onClick={() => (all ? drop(avail) : add(avail))}>{all ? 'Clear' : 'Select all'}</LinkBtn>}>{g}</Head>
            {gi.map((i) => <Row key={i.v} i={i} />)}
          </div>
        );
      })}
      {!list.length && <div className="px-2 py-3 text-sm text-muted-foreground">No {CATALOG.find((t) => t.key === tab)!.label.toLowerCase()} match “{q}”.</div>}
      {list.length > shown && <div className="px-2 py-2"><LinkBtn onClick={() => setShown(shown + PAGE)}>Show {Math.min(PAGE, list.length - shown)} more ({list.length - shown} left)</LinkBtn></div>}
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
          onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); if (e.key === 'Backspace' && !q && picked.length) drop([baseOf(picked[picked.length - 1])]); }}
          placeholder={picked.length ? 'Search to add…' : 'Search symbols or names…'} aria-label="Search instruments" className="h-7 min-w-[8rem] flex-1 bg-transparent px-1 outline-none placeholder:text-muted-foreground" />
        <button type="button" aria-label={open ? 'close the list' : 'open the list'} onClick={(e) => { e.stopPropagation(); setOpen(!open); }} className="ml-auto flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-accent">{open ? '▴' : '▾'}</button>
      </div>
      {open && (
        <div className="rounded-md border bg-card shadow-lg">
          <div role="tablist" aria-label="Instrument category" className="flex flex-wrap gap-1 border-b p-1">
            {(['all', ...CATALOG.map((t) => t.key)] as Tab[]).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={cn('h-8 shrink-0 rounded px-2.5 text-xs font-semibold', tab === k ? 'bg-sky-500/15 text-sky-200' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}>
                {k === 'all' ? 'All' : CATALOG.find((t) => t.key === k)!.label} <span className="font-normal opacity-70">{count(k)}</span>
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

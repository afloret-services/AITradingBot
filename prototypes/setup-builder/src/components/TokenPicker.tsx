// PROTOTYPE: pick one value token. Only the builder writes tokens, always in canonical form.
import React, { useEffect, useRef, useState } from 'react';
import { TFS, TF, isToken, parseToken, phrase, withPrev } from '../model';
import { Button, Input, NumInput, Select, cn } from './ui';

export interface TokenCtx {
  baseBar: TF;
  indicators: { token: string; label?: string }[];
  captures: { name: string; fields: string[] }[];
  labels: Record<string, string>;
  /** variant B: allow declaring a new indicator from the picker (declared on first use) */
  inlineDeclare?: boolean;
  onDeclare?: (token: string) => void;
  inPosition?: boolean;
  /** the Indicators stage: only indicators can be declared there */
  onlyIndicator?: boolean;
}

const KINDS = [['number', 'Number'], ['enum', 'Word (bullish, …)'], ['bar', 'Candle value'], ['indicator', 'Indicator'], ['level', 'Level'], ['capture', 'Captured value'], ['bias', 'Bias / Trend'], ['draw', 'Draw on liquidity'], ['entry', 'The entry'], ['trade', 'Trade value']] as const;
type Kind = (typeof KINDS)[number][0];
const BAR_FIELDS = ['close', 'open', 'high', 'low', 'volume', 'range', 'body', 'body_pct', 'upper_wick', 'lower_wick', 'dir'];
const IND = [['ema', 'EMA', '200'], ['sma', 'SMA', '20'], ['macd', 'MACD', '12,26,9'], ['atr', 'ATR', '14'], ['adx', 'ADX', '14'], ['rsi', 'RSI', '14'], ['avg_range', 'Average range', '20']] as const;
const TRADE = ['entry', 'stop', 'side', 'legs_filled', 'bars_open', 'open_r', 'max_favourable_r'];

function kindOf(v: string): Kind {
  if (!v) return 'number';
  if (!isToken(v)) return /^-?\d/.test(v) ? 'number' : 'enum';
  const k = parseToken(v).parts[0];
  if (k === 'trend') return 'bias';
  if (k === 'fib') return 'capture';
  return (k as Kind) || 'number';
}

export function TokenPicker({ value, onChange, ctx, placeholder = 'pick a value', className, compact }: { value: string; onChange: (v: string) => void; ctx: TokenCtx; placeholder?: string; className?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  const empty = !value;
  return (
    <span ref={ref} className={cn('relative inline-block', className)}>
      <button onClick={() => setOpen(!open)} title={value} className={cn('rounded border px-1.5 py-0.5 text-left text-[13px] hover:border-sky-400', empty ? 'border-dashed border-amber-400/70 text-amber-300' : isToken(value) ? 'border-sky-500/40 bg-sky-500/10 text-sky-200' : 'border-input bg-muted')}>
        {empty ? placeholder : compact ? shortName(value, ctx.labels) : phrase(value, ctx.labels)}
      </button>
      {open && <div className="absolute left-0 top-full z-50 mt-1 w-[340px] rounded-lg border bg-card p-3 shadow-2xl"><Editor value={value} onChange={onChange} ctx={ctx} /><div className="mt-2 flex justify-end"><Button size="sm" variant="secondary" onClick={() => setOpen(false)}>Done</Button></div></div>}
    </span>
  );
}

export function shortName(tok: string, labels: Record<string, string>) {
  if (!isToken(tok)) return tok;
  const p = parseToken(tok);
  const ago = p.prev ? `[-${p.prev}]` : '';
  const [k, a, b, c, d] = p.parts;
  if (k === 'bar') return `${b} ${a}${ago}`;
  if (k === 'indicator') return `${c} ${a.toUpperCase()}${a === 'macd' ? (d ? ' ' + d : '') : a === 'avg_range' ? `(${b}) range` : ' ' + b}${ago}`;
  if (k === 'capture') return a;
  if (k === 'level') return `${a === 'session' ? b : a} ${a === 'session' ? c : b}`;
  return phrase(tok, labels);
}

function Editor({ value, onChange, ctx }: { value: string; onChange: (v: string) => void; ctx: TokenCtx }) {
  const kind = kindOf(value);
  const p = parseToken(value);
  const prev = p.prev;
  const setKind = (k: Kind) => {
    const tf = ctx.baseBar;
    const def: Record<Kind, string> = {
      number: '0', enum: 'bullish', bar: `{{bar:close:${tf}}}`, indicator: ctx.indicators[0]?.token || `{{indicator:ema:200:${tf}}}`, level: '{{level:prev_day:high}}',
      capture: ctx.captures[0] ? `{{capture:${ctx.captures[0].name}.${ctx.captures[0].fields[0]}}}` : '{{capture:fvg.top}}', bias: '{{bias:1d}}', draw: '{{draw}}', entry: '{{entry}}', trade: '{{trade:open_r}}',
    };
    onChange(def[k]);
  };
  const kinds = KINDS.filter(([k]) => (ctx.onlyIndicator ? k === 'indicator' : ctx.inPosition || k !== 'trade'));
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2"><span className="w-14 text-xs text-muted-foreground">Kind</span><Select value={kind} onChange={setKind} options={kinds.map(([k, l]) => [k, l] as [Kind, string])} /></div>
      {kind === 'number' && <div className="flex items-center gap-2"><span className="w-14 text-xs text-muted-foreground">Value</span><Input value={value} onChange={(e) => onChange(e.target.value)} className="w-28" /></div>}
      {kind === 'enum' && <div className="flex items-center gap-2"><span className="w-14 text-xs text-muted-foreground">Word</span><Select value={value} onChange={onChange} options={['bullish', 'bearish', 'doji', 'long', 'short']} /></div>}
      {kind === 'bar' && (
        <div className="flex flex-wrap items-center gap-2"><span className="w-14 text-xs text-muted-foreground">Candle</span>
          <Select value={p.parts[1]} onChange={(f) => onChange(withPrev(`{{bar:${f}:${p.parts[2]}}}`, prev))} options={BAR_FIELDS} />
          <TfSelect value={p.parts[2] as TF} base={ctx.baseBar} onChange={(tf) => onChange(withPrev(`{{bar:${p.parts[1]}:${tf}}}`, prev))} />
        </div>
      )}
      {kind === 'indicator' && <IndicatorEditor value={value} onChange={onChange} ctx={ctx} />}
      {kind === 'level' && <LevelEditor value={value} onChange={onChange} />}
      {kind === 'capture' && (
        ctx.captures.length === 0 ? <div className="text-xs text-amber-300">No earlier step captures anything yet.</div> :
        <div className="flex flex-wrap items-center gap-2"><span className="w-14 text-xs text-muted-foreground">From</span>
          <Select value={p.parts[1]?.split('.')[0] || ''} onChange={(n) => { const c = ctx.captures.find((x) => x.name === n)!; onChange(`{{capture:${n}.${c.fields[0]}}}`); }} options={ctx.captures.map((c) => c.name)} />
          <Select value={p.parts[1]?.split('.').slice(1).join('.') || ''} onChange={(f) => onChange(`{{capture:${p.parts[1].split('.')[0]}.${f}}}`)} options={ctx.captures.find((c) => c.name === p.parts[1]?.split('.')[0])?.fields || []} />
        </div>
      )}
      {kind === 'bias' && (
        <div className="flex flex-wrap items-center gap-2"><span className="w-14 text-xs text-muted-foreground">Which</span>
          <Select value={p.parts[0]} onChange={(k) => onChange(`{{${k}:${p.parts[1]}}}`)} options={[['bias', 'Bias (Structure break)'], ['trend', 'Trend (HH/HL)']]} />
          <TfSelect value={p.parts[1] as TF} base={ctx.baseBar} onChange={(tf) => onChange(`{{${p.parts[0]}:${tf}}}`)} />
        </div>
      )}
      {kind === 'trade' && <div className="flex items-center gap-2"><span className="w-14 text-xs text-muted-foreground">Field</span><Select value={p.parts[1]} onChange={(f) => onChange(`{{trade:${f}}}`)} options={TRADE} /></div>}
      {['bar', 'indicator', 'bias'].includes(kind) && (
        <div className="flex items-center gap-2"><span className="w-14 text-xs text-muted-foreground">Bars back</span><NumInput value={prev} onChange={(n) => onChange(withPrev(value, Math.max(0, n)))} className="w-16" /><span className="text-[11px] text-muted-foreground">0 = the last closed bar</span></div>
      )}
      <div className="rounded bg-muted px-2 py-1.5"><div className="text-xs">{phrase(value, ctx.labels) || '—'}</div><div className="mono mt-0.5 break-all text-[11px] text-muted-foreground">{value || '(empty)'}</div></div>
    </div>
  );
}

export function TfSelect({ value, onChange, base }: { value: TF; onChange: (t: TF) => void; base: TF }) {
  const bi = TFS.indexOf(base);
  return <Select value={value} onChange={onChange} options={TFS.map((t, k) => [t, k < bi ? `${t} (finer than Base bar)` : t] as [TF, string])} />;
}

function IndicatorEditor({ value, onChange, ctx }: { value: string; onChange: (v: string) => void; ctx: TokenCtx }) {
  const p = parseToken(value);
  const [draft, setDraft] = useState(false);
  const base = value.replace(/\.prev\[\d+\]$/, '');
  const declared = ctx.indicators.some((i) => i.token === base);
  const [name, params, tf, out] = [p.parts[1], p.parts[2], p.parts[3] as TF, p.parts[4]];
  const set = (n: string, pa: string, t: TF, o?: string) => { const tok = withPrev(`{{indicator:${n}:${pa}:${t}${o ? ':' + o : ''}}}`, p.prev); onChange(tok); if (ctx.inlineDeclare) ctx.onDeclare?.(tok.replace(/\.prev\[\d+\]$/, '')); };
  if (!ctx.inlineDeclare && !draft) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2"><span className="w-14 text-xs text-muted-foreground">Declared</span>
          <Select value={declared ? base : ''} onChange={(t) => onChange(withPrev(t, p.prev))} options={[['', '— pick —'] as [string, string], ...ctx.indicators.map((i) => [i.token, i.label || shortName(i.token, {})] as [string, string])]} />
        </div>
        {!declared && <div className="text-[11px] text-amber-300">Not in the Setup's indicator list. Declare it there first.</div>}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2"><span className="w-14 text-xs text-muted-foreground">Indicator</span>
        <Select value={name} onChange={(n) => set(n, IND.find((x) => x[0] === n)![2], tf)} options={IND.map(([k, l]) => [k, l] as [string, string])} />
        <Input value={params} onChange={(e) => set(name, e.target.value, tf, out)} className="w-24" />
        <TfSelect value={tf} base={ctx.baseBar} onChange={(t) => set(name, params, t, out)} />
        {name === 'macd' && <Select value={out || 'line'} onChange={(o) => set(name, params, tf, o === 'line' ? undefined : o)} options={['line', 'signal', 'hist']} />}
      </div>
      {ctx.inlineDeclare && <div className="text-[11px] text-muted-foreground">Declared in the Setup on first use; the token is its identity.</div>}
      {ctx.indicators.length > 0 && ctx.inlineDeclare && <div className="flex flex-wrap gap-1">{ctx.indicators.map((i) => <button key={i.token} onClick={() => onChange(withPrev(i.token, p.prev))} className="rounded border px-1 text-[11px] hover:bg-accent">{i.label || shortName(i.token, {})}</button>)}</div>}
    </div>
  );
}

function LevelEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const p = parseToken(value);
  const which = p.parts[1] === 'session' ? `session:${p.parts[2]}` : p.parts[1];
  const field = p.parts[p.parts.length - 1];
  const mk = (w: string, f: string) => `{{level:${w}:${f}}}`;
  return (
    <div className="flex flex-wrap items-center gap-2"><span className="w-14 text-xs text-muted-foreground">Level</span>
      <Select value={which} onChange={(w) => onChange(mk(w, field))} options={[['prev_day', 'Previous Trading day'], ['day', 'Today so far'], ['session:asia', 'Asia session'], ['session:london', 'London session'], ['session:new_york', 'New York session']]} />
      <Select value={field} onChange={(f) => onChange(mk(which, f))} options={['high', 'low', 'open', 'close']} />
    </div>
  );
}

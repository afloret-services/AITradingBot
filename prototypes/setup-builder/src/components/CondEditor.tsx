// PROTOTYPE: the recursive condition editor. Three looks (boxes / outline / chips) so each variant can show nesting its own way.
import React, { useState } from 'react';
import { Cond, OPS, Op, PRESETS, Setup, condPhrase, opWord, uid, captureNames } from '../model';
import { TokenPicker, TokenCtx } from './TokenPicker';
import { Badge, Button, Input, NumInput, Select, cn } from './ui';

export type Look = 'boxes' | 'outline' | 'chips';
const markEdited = (c: Cond): Cond => (c.origin ? { ...c, origin: { ...c.origin, edited: true } } : c);

export function newCmp(ctx: TokenCtx): Cond { return { id: uid(), t: 'cmp', a: `{{bar:close:${ctx.baseBar}}}`, op: '>', b: '' }; }

export function AddMenu({ onAdd, ctx, side, small }: { onAdd: (c: Cond) => void; ctx: TokenCtx; side: 'long' | 'short'; small?: boolean }) {
  const [open, setOpen] = useState(false);
  const tf = ctx.baseBar;
  const items: [string, () => Cond, string][] = [
    ['Compare', () => newCmp(ctx), 'value  operator  value'],
    ['All of', () => ({ id: uid(), t: 'all', items: [] }), 'every condition inside holds'],
    ['Any of', () => ({ id: uid(), t: 'any', items: [] }), 'at least one holds'],
    ['Not', () => ({ id: uid(), t: 'not', item: newCmp(ctx) }), ''],
    ['For at least N bars', () => ({ id: uid(), t: 'for_n', n: 3, item: newCmp(ctx) }), ''],
    ['Time range (NY)', () => ({ id: uid(), t: 'time', start: '10:00', end: '11:00', tf }), 'bar open time in [start, end)'],
    ['FVG (detector)', () => ({ id: uid(), t: 'fvg', side, tf, min_gap_ticks: 4, middle_closes_gap_way: true, capture: 'fvg' }), 'captures fvg.top, .bottom, .bar1…'],
    ['Preset: FVG with Displacement', () => PRESETS.fvgWithDisplacement(tf, side), 'expands into editable blocks'],
    ['Preset: Displacement', () => PRESETS.displacement(tf, side), ''],
    ['Preset: Bias', () => PRESETS.bias(side), '1d Structure break, 2 bars'],
    ['Preset: Draw on liquidity', () => PRESETS.draw(side), 'Choose: nearest untaken level'],
    ['Preset: MACD crosses signal', () => PRESETS.macdCross(tf, side), ''],
  ];
  return (
    <span className="relative inline-block">
      <Button size="sm" variant="ghost" className={cn('text-sky-300', small && 'h-6 px-1.5')} onClick={() => setOpen(!open)}>+ add</Button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-72 rounded-lg border bg-card p-1 shadow-2xl" onMouseLeave={() => setOpen(false)}>
          {items.map(([l, f, h]) => (
            <button key={l} className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-accent" onClick={() => { onAdd(f()); setOpen(false); }}>
              {l}{h && <span className="ml-1 text-[11px] text-muted-foreground">{h}</span>}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

export function CondEditor({ cond, onChange, onRemove, ctx, side, look, depth = 0, highlight }: { cond: Cond; onChange: (c: Cond) => void; onRemove?: () => void; ctx: TokenCtx; side: 'long' | 'short'; look: Look; depth?: number; highlight?: boolean }) {
  const [collapsed, setCollapsed] = useState(!!cond.origin && cond.t === 'all');
  const rm = onRemove && <button title="remove" onClick={onRemove} className="ml-1 text-muted-foreground hover:text-red-400">×</button>;
  const originBadge = cond.origin && <Badge tone="info" className="mr-1">{cond.origin.preset}{cond.origin.edited ? ' (edited)' : ''}</Badge>;

  if (cond.t === 'all' || cond.t === 'any') {
    const word = cond.t === 'all' ? 'All of' : 'Any of';
    const setItems = (items: Cond[]) => onChange(markEdited({ ...cond, items }));
    if (collapsed) {
      return (
        <div className={cn('flex items-start gap-1 rounded-md py-1', look === 'boxes' && 'border border-sky-500/30 bg-sky-500/5 px-2')}>
          <button onClick={() => setCollapsed(false)} className="text-muted-foreground">▸</button>
          <div className="text-sm">{originBadge}<span className="text-muted-foreground">{condPhrase(cond, ctx.labels)}</span></div>{rm}
        </div>
      );
    }
    const header = (
      <div className="flex items-center gap-1 text-xs">
        {cond.origin && <button onClick={() => setCollapsed(true)} className="text-muted-foreground">▾</button>}
        {originBadge}
        <button onClick={() => onChange({ ...cond, t: cond.t === 'all' ? 'any' : 'all' })} className={cn('rounded px-1.5 py-0.5 font-semibold uppercase tracking-wide', cond.t === 'all' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300')} title="switch All / Any">{look === 'chips' ? (cond.t === 'all' ? 'AND' : 'OR') : word}</button>
        <AddMenu ctx={ctx} side={side} small onAdd={(c) => setItems([...cond.items, c])} />
        {rm}
      </div>
    );
    const children = cond.items.map((it, k) => (
      <CondEditor key={it.id} cond={it} ctx={ctx} side={side} look={look} depth={depth + 1}
        onChange={(c) => setItems(cond.items.map((x, j) => (j === k ? c : x)))} onRemove={() => setItems(cond.items.filter((_, j) => j !== k))} />
    ));
    if (look === 'boxes') return <div className={cn('space-y-1.5 rounded-md border p-2', depth % 2 ? 'bg-background/40' : 'bg-muted/30', highlight && 'ring-1 ring-sky-400')}>{header}{children.length ? children : <Empty />}</div>;
    if (look === 'outline') return <div>{depth > 0 && header}<ul className={cn('space-y-1', depth > 0 && 'ml-3 border-l pl-3')}>{children.map((ch, k) => <li key={k} className="flex gap-1.5"><span className="mt-1.5 text-muted-foreground">{depth === 0 ? '•' : '◦'}</span><div className="flex-1">{ch}</div></li>)}{!children.length && <Empty />}</ul></div>;
    return (
      <div className={cn('rounded-md border-l-2 py-1 pl-2', cond.t === 'all' ? 'border-emerald-500/60' : 'border-amber-500/60')}>
        {header}
        <div className="mt-1 flex flex-wrap items-start gap-1.5">{children.length ? children.map((ch, k) => <React.Fragment key={k}>{k > 0 && <span className="mt-1 text-[10px] font-semibold text-muted-foreground">{cond.t === 'all' ? 'AND' : 'OR'}</span>}<div className="rounded-md bg-muted/50 px-1.5 py-1">{ch}</div></React.Fragment>) : <Empty />}</div>
      </div>
    );
  }
  if (cond.t === 'not' || cond.t === 'for_n') {
    return (
      <div className={cn('rounded-md', look === 'boxes' && 'border p-2')}>
        <div className="flex items-center gap-1 text-xs">
          <span className="rounded bg-violet-500/15 px-1.5 py-0.5 font-semibold uppercase text-violet-300">{cond.t === 'not' ? 'Not' : 'For at least'}</span>
          {cond.t === 'for_n' && <><NumInput value={cond.n} onChange={(n) => onChange(markEdited({ ...cond, n }))} className="h-6 w-12" /><span className="text-muted-foreground">{ctx.baseBar} bars in a row</span></>}
          {rm}
        </div>
        <div className="ml-3 mt-1"><CondEditor cond={cond.item} ctx={ctx} side={side} look={look} depth={depth + 1} onChange={(c) => onChange(markEdited({ ...cond, item: c }))} /></div>
      </div>
    );
  }
  if (cond.t === 'cmp') {
    return (
      <div className="flex flex-wrap items-center gap-1 text-sm">
        {originBadge}
        <TokenPicker value={cond.a} onChange={(a) => onChange(markEdited({ ...cond, a }))} ctx={ctx} compact={look === 'chips'} />
        <Select value={cond.op} onChange={(op: Op) => onChange(markEdited({ ...cond, op }))} options={OPS.map((o) => [o, opWord(o)] as [Op, string])} className="h-7 text-xs" />
        {cond.op === 'within' && <><NumInput value={cond.n} onChange={(n) => onChange({ ...cond, n })} className="h-7 w-14" /><span className="text-xs text-muted-foreground">points of</span></>}
        {(cond.mult ?? 1) !== 1 && <><NumInput step={0.1} value={cond.mult} onChange={(mult) => onChange(markEdited({ ...cond, mult }))} className="h-7 w-14" /><span>×</span></>}
        <TokenPicker value={cond.b} onChange={(b) => onChange(markEdited({ ...cond, b }))} ctx={ctx} compact={look === 'chips'} />
        {(cond.mult ?? 1) === 1 && <button title="multiply the right side" onClick={() => onChange({ ...cond, mult: 1.5 })} className="text-[11px] text-muted-foreground hover:text-foreground">×k</button>}
        {rm}
      </div>
    );
  }
  if (cond.t === 'time') {
    return (
      <div className="flex flex-wrap items-center gap-1 text-sm">
        <span className="text-muted-foreground">the {cond.tf || ctx.baseBar} bar opens between</span>
        <Input value={cond.start} onChange={(e) => onChange({ ...cond, start: e.target.value })} className="h-7 w-16" />
        <span className="text-muted-foreground">and</span>
        <Input value={cond.end} onChange={(e) => onChange({ ...cond, end: e.target.value })} className="h-7 w-16" />
        <span className="text-muted-foreground">NY</span>{rm}
      </div>
    );
  }
  if (cond.t === 'fvg') {
    return (
      <div className="flex flex-wrap items-center gap-1 text-sm">
        <Badge tone="info">FVG</Badge>
        <span className="text-muted-foreground">{cond.side === 'long' ? 'bullish' : 'bearish'} on</span>
        <Select value={cond.tf} onChange={(tf) => onChange(markEdited({ ...cond, tf }))} options={['1m', '3m', '5m', '15m']} className="h-7" />
        <span className="text-muted-foreground">gap ≥</span><NumInput value={cond.min_gap_ticks} onChange={(n) => onChange(markEdited({ ...cond, min_gap_ticks: n }))} className="h-7 w-14" /><span className="text-muted-foreground">ticks</span>
        <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={cond.middle_closes_gap_way} onChange={(e) => onChange(markEdited({ ...cond, middle_closes_gap_way: e.target.checked }))} />middle closes the gap's way</label>
        <span className="text-muted-foreground">as</span><Input value={cond.capture} onChange={(e) => onChange({ ...cond, capture: e.target.value })} className="mono h-7 w-20" />{rm}
      </div>
    );
  }
  if (cond.t === 'draw') {
    return (
      <div className="space-y-1 text-sm">
        <div className="flex flex-wrap items-center gap-1">
          {originBadge}<span className="text-muted-foreground">nearest untaken level {cond.side === 'long' ? 'above' : 'below'}</span>
          <TokenPicker value={cond.from} onChange={(from) => onChange(markEdited({ ...cond, from }))} ctx={ctx} compact={look === 'chips'} />
          <span className="text-muted-foreground">by ≥</span><NumInput value={cond.min_framework_points} onChange={(n) => onChange(markEdited({ ...cond, min_framework_points: n }))} className="h-7 w-14" /><span className="text-muted-foreground">points (Minimum framework)</span>{rm}
        </div>
        <div className="flex flex-wrap items-center gap-1 pl-2 text-xs text-muted-foreground">from: {cond.levels.map((l, k) => <TokenPicker key={k} value={l} ctx={ctx} compact onChange={(v) => onChange(markEdited({ ...cond, levels: cond.levels.map((x, j) => (j === k ? v : x)) }))} />)}
          <button className="hover:text-foreground" onClick={() => onChange({ ...cond, levels: [...cond.levels, '{{level:session:new_york:high}}'] })}>+ level</button></div>
      </div>
    );
  }
  return null;
}
const Empty = () => <div className="text-xs italic text-muted-foreground">empty: add a condition</div>;

/** captures readable at step k of a branch (from earlier steps, plus the step's own detectors) */
export function capturesAt(setup: Setup, bi: number, k: number, includeOwn = true) {
  const br = setup.branches[bi];
  const out: { name: string; fields: string[] }[] = [];
  const FVG = ['top', 'bottom', 'mid', 'size', 'bar1.low', 'bar1.high', 'bar2.low', 'bar2.high', 'bar3.low', 'bar3.high'];
  br?.steps.forEach((st, j) => {
    if (j > k || (j === k && !includeOwn)) return;
    for (const n of captureNames(st.cond)) if (n !== 'draw') out.push({ name: n, fields: FVG });
    if (st.capture_running) out.push({ name: st.capture_running.name, fields: ['low', 'high'] });
  });
  return out;
}
export function tokenCtx(setup: Setup, bi: number, k: number, extra: Partial<TokenCtx> = {}): TokenCtx {
  return {
    baseBar: setup.settings.base_bar, indicators: setup.indicators, captures: capturesAt(setup, bi, k),
    labels: Object.fromEntries(setup.indicators.filter((i) => i.label).map((i) => [i.token, i.label!])), ...extra,
  };
}

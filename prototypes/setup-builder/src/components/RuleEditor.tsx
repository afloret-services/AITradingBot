// PROTOTYPE: a step's conditions as a rule: IF a AND b OR c … Each line has its own AND / OR. AND binds tighter than
// OR (like "a and b, or c"), so each run of ANDs is drawn as one box and the boxes are joined by OR. Brackets ( … )
// group explicitly and nest. Underneath it is still the same Cond tree: an OR of ANDs.
import React from 'react';
import { Cond, uid, condPhrase } from '../model';
import { CondEditor, AddMenu } from './CondEditor';
import { TokenCtx } from './TokenPicker';
import { cn } from './ui';

type Join = 'and' | 'or';
interface Line { cond: Cond; join: Join }

const isPlainGroup = (c: Cond): c is Extract<Cond, { t: 'all' | 'any' }> => (c.t === 'all' || c.t === 'any') && !c.origin;

/** tree → lines: an OR of ANDs (or a single AND) becomes a flat list with a join per line */
export function toLines(c: Cond): Line[] {
  if (c.t === 'any' && !c.origin) {
    const out: Line[] = [];
    c.items.forEach((g, gi) => {
      const parts = g.t === 'all' && !g.origin ? g.items : [g];
      parts.forEach((x, k) => out.push({ cond: x, join: k === 0 && gi > 0 ? 'or' : 'and' }));
    });
    return out;
  }
  if (c.t === 'all' && !c.origin) return c.items.map((x) => ({ cond: x, join: 'and' as Join }));
  return [{ cond: c, join: 'and' }];
}
/** lines → tree: split at each OR; one run is an "all of", several are an "any of" of "all of"s */
export function fromLines(lines: Line[], keepId?: string, label?: string): Cond {
  const groups: Cond[][] = [];
  lines.forEach((l, k) => { if (k === 0 || l.join === 'or') groups.push([]); groups[groups.length - 1].push(l.cond); });
  if (groups.length <= 1) return { id: keepId || uid(), t: 'all', items: groups[0] || [], ...(label ? { label } : {}) };
  return { id: keepId || uid(), t: 'any', items: groups.map((g) => (g.length === 1 ? g[0] : { id: uid(), t: 'all', items: g })), ...(label ? { label } : {}) };
}
function runs(lines: Line[]) {
  const out: { line: Line; idx: number }[][] = [];
  lines.forEach((l, idx) => { if (idx === 0 || l.join === 'or') out.push([]); out[out.length - 1].push({ line: l, idx }); });
  return out;
}

const JoinSelect = ({ value, onChange }: { value: Join; onChange: (j: Join) => void }) => (
  <select value={value} onChange={(e) => onChange(e.target.value as Join)}
    className={cn('h-6 rounded-md border px-1 text-[11px] font-bold uppercase tracking-wide outline-none', value === 'and' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/40 bg-amber-500/10 text-amber-300')}>
    <option value="and">AND</option><option value="or">OR</option>
  </select>
);

export function RuleEditor({ cond, onChange, ctx, side, keyword, nested }: { cond: Cond; onChange: (c: Cond) => void; ctx: TokenCtx; side: 'long' | 'short'; keyword?: string; nested?: boolean }) {
  const lines = toLines(cond);
  const label = (cond as any).label;
  const set = (ls: Line[]) => onChange(fromLines(ls, cond.id, label));
  const setLine = (i: number, c: Cond) => set(lines.map((l, k) => (k === i ? { ...l, cond: c } : l)));
  const setJoin = (i: number, j: Join) => set(lines.map((l, k) => (k === i ? { ...l, join: j } : l)));
  const remove = (i: number) => set(lines.filter((_, k) => k !== i).map((l, k) => (k === 0 ? { ...l, join: 'and' as Join } : l)));
  const add = (c: Cond, join: Join = 'and') => set([...lines, { cond: c, join }]);
  // insert before line i, joined with AND; the AND/OR layout stays where it is and the conditions move through it
  const insert = (i: number, c: Cond) => set([...lines.slice(0, i), { cond: c, join: 'and' as Join }, ...lines.slice(i).map((l, k) => (k === 0 && i === 0 ? { ...l, join: 'and' as Join } : l))]);
  const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= lines.length) return; const ls = lines.map((l) => ({ ...l })); [ls[i].cond, ls[j].cond] = [ls[j].cond, ls[i].cond]; set(ls); };
  const [drag, setDrag] = React.useState<number | null>(null);
  const [over, setOver] = React.useState<number | null>(null);
  const drop = (to: number) => { if (drag == null || drag === to) return; const conds = lines.map((l) => l.cond); const [c] = conds.splice(drag, 1); conds.splice(to, 0, c); set(lines.map((l, k) => ({ ...l, cond: conds[k] }))); };
  const groups = runs(lines);
  const mixed = groups.length > 1 && groups.some((g) => g.length > 1);

  const lineView = (l: Line, i: number) => {
    const c = l.cond;
    const lead = i === 0 ? (keyword ? <span className="w-14 shrink-0 pt-1 text-xs font-black tracking-wider text-sky-300">{keyword}</span> : <span className="w-14 shrink-0" />)
      : <span className="w-14 shrink-0 pt-0.5">{l.join === 'and' ? <JoinSelect value="and" onChange={(j) => setJoin(i, j)} /> : null}</span>;
    return (
      <div key={c.id} className={cn('group/line flex flex-wrap items-start gap-2 rounded-md sm:flex-nowrap', drag === i && 'opacity-40', over === i && drag != null && drag !== i && 'ring-1 ring-sky-400/60')}
        onDragOver={(e) => { if (drag != null) { e.preventDefault(); setOver(i); } }} onDragLeave={() => setOver((o) => (o === i ? null : o))}
        onDrop={(e) => { e.preventDefault(); drop(i); setDrag(null); setOver(null); }}>
        {lead}
        <span className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5">
          <span draggable onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { setDrag(null); setOver(null); }} title="drag to reorder" className="flex h-7 w-5 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing">⠿</span>
        </span>
        <div className="min-w-0 flex-1 basis-[calc(100%-6rem)] sm:basis-0">
          {isPlainGroup(c)
            ? <div className="flex items-start gap-1">
                <span className="pt-0.5 text-lg leading-none text-sky-400/70">(</span>
                <div className="min-w-0 flex-1 rounded-md border border-dashed border-sky-500/30 p-2"><RuleEditor cond={c} onChange={(x) => setLine(i, x)} ctx={ctx} side={side} nested /></div>
                <span className="pt-0.5 text-lg leading-none text-sky-400/70">)</span>
                <button title="remove the bracket" aria-label="remove the bracket" onClick={() => remove(i)} className="ml-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-input text-lg leading-none text-muted-foreground transition-colors hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-400">×</button>
              </div>
            : <CondEditor cond={c} ctx={ctx} side={side} look="boxes" depth={1} onChange={(x) => setLine(i, x)} />}
        </div>
        <span className="flex w-full shrink-0 items-center justify-end gap-0.5 sm:w-auto sm:pt-0.5">
          <button aria-label="move up" title="move up" disabled={i === 0} onClick={() => move(i, -1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-input text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30">↑</button>
          <button aria-label="move down" title="move down" disabled={i === lines.length - 1} onClick={() => move(i, 1)} className="flex h-7 w-7 items-center justify-center rounded-md border border-input text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30">↓</button>
          <AddMenu ctx={ctx} side={side} onAdd={(x) => insert(i, x)} small label="+ above" />
          {!isPlainGroup(c) && <button title="remove this condition" aria-label="remove this condition" onClick={() => remove(i)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-input text-lg leading-none text-muted-foreground transition-colors hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-400">×</button>}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-1.5">
      {lines.length === 0 && <div className="flex items-center gap-2">{keyword && <span className="w-14 text-xs font-black tracking-wider text-sky-300">{keyword}</span>}<span className="text-xs italic text-muted-foreground">no condition yet: add one</span></div>}
      {groups.map((g, gi) => (
        <React.Fragment key={g[0].line.cond.id}>
          {gi > 0 && (
            <div className="flex items-center gap-2 py-0.5">
              <span className="w-14 shrink-0"><JoinSelect value="or" onChange={(j) => setJoin(g[0].idx, j)} /></span>
              <div className="h-px flex-1 bg-amber-500/25" />
            </div>
          )}
          <div className={cn('space-y-1.5', groups.length > 1 && 'rounded-md border border-emerald-500/20 bg-emerald-500/[0.03] p-1.5')}>
            {g.map(({ line, idx }) => lineView(line, idx))}
          </div>
        </React.Fragment>
      ))}
      <div className="flex flex-wrap items-center gap-1 pl-16">
        <AddMenu ctx={ctx} side={side} onAdd={(c) => add(c, 'and')} small />
        {lines.length > 0 && <AddMenu ctx={ctx} side={side} onAdd={(c) => add(c, 'or')} small label="+ or" />}
        <button className="h-6 rounded px-1.5 text-xs text-sky-300 hover:bg-accent" onClick={() => add({ id: uid(), t: 'all', items: [] })} title="a bracket groups conditions explicitly">+ ( … )</button>
      </div>
      {!nested && mixed && <div className="pl-16 text-[11px] text-muted-foreground">AND is checked before OR: each green box must hold as a whole, and any one of the boxes is enough. Reads as: {condPhrase(cond, ctx.labels)}.</div>}
    </div>
  );
}

/** add a condition to a step with AND, whatever shape its tree has */
export function appendAnd(c: Cond, add: Cond): Cond {
  const ls = toLines(c);
  return fromLines([...ls, { cond: add, join: 'and' }], c.id, (c as any).label);
}

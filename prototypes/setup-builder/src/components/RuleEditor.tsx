// PROTOTYPE: a step's conditions as a rule: IF a AND b OR c … Each line has its own AND / OR. AND binds tighter than
// OR (like "a and b, or c"), so each run of ANDs is drawn as one box and the boxes are joined by OR. ALL OF / ANY OF
// groups (any number of conditions, switchable) group explicitly and nest. Underneath it is still the same Cond tree: an OR of ANDs.
import React from 'react';
import { createPortal } from 'react-dom';
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

/** AND / OR as a button: tap to switch */
const JoinSelect = ({ value, onChange }: { value: Join; onChange: (j: Join) => void }) => (
  <button type="button" onClick={() => onChange(value === 'and' ? 'or' : 'and')} title={value === 'and' ? 'switch to OR' : 'switch to AND'}
    className={cn('flex h-8 items-center gap-1 rounded-md border px-3 text-xs font-black uppercase tracking-wider transition-colors', value === 'and' ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25' : 'border-amber-500/50 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25')}>
    {value === 'and' ? 'And' : 'Or'} <span aria-hidden="true">⇄</span>
  </button>
);

export function RuleEditor({ cond, onChange, ctx, side, keyword, nested, group, addTo }: { cond: Cond; onChange: (c: Cond) => void; ctx: TokenCtx; side: 'long' | 'short'; keyword?: string; nested?: boolean; group?: 'all' | 'any'; addTo?: HTMLElement | null }) {
  // group: the inside of an ALL OF / ANY OF box; every line has the group's join, so no AND/OR dropdowns
  const gj: Join = group === 'any' ? 'or' : 'and';
  const lines: Line[] = group ? (cond as any).items.map((x: Cond) => ({ cond: x, join: gj })) : toLines(cond);
  const label = (cond as any).label;
  const set = (ls: Line[]) => onChange(group ? { ...(cond as any), t: group, items: ls.map((l) => l.cond) } : fromLines(ls, cond.id, label));
  const setLine = (i: number, c: Cond) => set(lines.map((l, k) => (k === i ? { ...l, cond: c } : l)));
  const setJoin = (i: number, j: Join) => set(lines.map((l, k) => (k === i ? { ...l, join: j } : l)));
  const remove = (i: number) => set(lines.filter((_, k) => k !== i).map((l, k) => (k === 0 ? { ...l, join: 'and' as Join } : l)));
  const add = (c: Cond, join: Join = 'and') => set([...lines, { cond: c, join: group ? gj : join }]);
  const newGroup = (t: 'all' | 'any'): Cond => ({ id: uid(), t, items: [] });
  // insert before line i, joined with AND; the AND/OR layout stays where it is and the conditions move through it
  const insert = (i: number, c: Cond) => set([...lines.slice(0, i), { cond: c, join: 'and' as Join }, ...lines.slice(i).map((l, k) => (k === 0 && i === 0 ? { ...l, join: 'and' as Join } : l))]);
  const move = (i: number, d: -1 | 1) => { const j = i + d; if (j < 0 || j >= lines.length) return; const ls = lines.map((l) => ({ ...l })); [ls[i].cond, ls[j].cond] = [ls[j].cond, ls[i].cond]; set(ls); };
  const [drag, setDrag] = React.useState<number | null>(null);
  const [over, setOver] = React.useState<number | null>(null);
  const drop = (to: number) => { if (drag == null || drag === to) return; const conds = lines.map((l) => l.cond); const [c] = conds.splice(drag, 1); conds.splice(to, 0, c); set(lines.map((l, k) => ({ ...l, cond: conds[k] }))); };
  const groups = group ? (lines.length ? [lines.map((line, idx) => ({ line, idx }))] : []) : runs(lines);
  const mixed = groups.length > 1 && groups.some((g) => g.length > 1);

  const lineView = (l: Line, i: number) => {
    const c = l.cond;
    const lead = group ? <span className={cn('w-7 shrink-0 pt-1.5 text-[10px] font-bold uppercase tracking-wide', group === 'all' ? 'text-cyan-300/70' : 'text-amber-300/70')}>{i === 0 ? '' : group === 'all' ? 'and' : 'or'}</span>
      : i === 0 ? (keyword ? <span className="flex h-8 w-[4.5rem] shrink-0 items-center text-base font-black tracking-wider text-sky-300">{keyword}</span> : <span className="w-[4.5rem] shrink-0" />)
      : <span className="w-[4.5rem] shrink-0 pt-0.5">{l.join === 'and' ? <JoinSelect value="and" onChange={(j) => setJoin(i, j)} /> : null}</span>;
    return (
      <div key={c.id} className={cn('group/line flex flex-wrap items-start gap-2 rounded-md [@container(min-width:38rem)]:flex-nowrap', drag === i && 'opacity-40', over === i && drag != null && drag !== i && 'ring-1 ring-sky-400/60')}
        onDragOver={(e) => { if (drag != null) { e.preventDefault(); setOver(i); } }} onDragLeave={() => setOver((o) => (o === i ? null : o))}
        onDrop={(e) => { e.preventDefault(); drop(i); setDrag(null); setOver(null); }}>
        {lead}
        <span className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5">
          <span draggable onDragStart={(e) => { setDrag(i); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { setDrag(null); setOver(null); }} title="drag to reorder" className="flex h-7 w-5 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing">⠿</span>
        </span>
        <div className="min-w-0 flex-1 basis-[calc(100%-7.5rem)] [@container(min-width:38rem)]:basis-0">
          {isPlainGroup(c)
            ? (() => { const gt = (c as any).t as 'all' | 'any'; const all = gt === 'all'; return (
              <div className={cn('rounded-md border', all ? 'border-cyan-500/40 bg-cyan-500/[0.04]' : 'border-amber-500/40 bg-amber-500/[0.04]')}>
                <div className={cn('flex flex-wrap items-center gap-2 border-b px-2 py-1 text-[11px]', all ? 'border-cyan-500/25' : 'border-amber-500/25')}>
                  <button onClick={() => setLine(i, { ...(c as any), t: all ? 'any' : 'all' })} title="switch between ALL OF and ANY OF" className={cn('h-8 rounded-md border px-3 text-sm font-black uppercase tracking-wider', all ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300' : 'border-amber-500/50 bg-amber-500/15 text-amber-300')}>{all ? 'All of' : 'Any of'} ⇄</button>
                  <span className="text-muted-foreground">{all ? 'every condition below must hold' : 'at least one condition below must hold'}</span>
                  <button title="remove this group" aria-label="remove this group" onClick={() => remove(i)} className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-input text-lg leading-none text-muted-foreground transition-colors hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-400">×</button>
                </div>
                <div className="p-2"><RuleEditor cond={c} onChange={(x) => setLine(i, x)} ctx={ctx} side={side} nested group={gt} /></div>
              </div>); })()
            : <CondEditor cond={c} ctx={ctx} side={side} look="boxes" depth={1} onChange={(x) => setLine(i, x)} />}
        </div>
        <span className="flex w-full shrink-0 items-center justify-end gap-1 [@container(min-width:38rem)]:w-auto [@container(min-width:38rem)]:pt-0.5">
          <button aria-label="move up" title="move up" disabled={i === 0} onClick={() => move(i, -1)} className="flex h-8 w-8 items-center justify-center rounded-md border border-input text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30">↑</button>
          <button aria-label="move down" title="move down" disabled={i === lines.length - 1} onClick={() => move(i, 1)} className="flex h-8 w-8 items-center justify-center rounded-md border border-input text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30">↓</button>
          <AddMenu ctx={ctx} side={side} onAdd={(x) => insert(i, x)} label="+ Insert" title="insert a condition above this one" buttonClass="flex h-8 items-center rounded-md border border-sky-500/50 bg-sky-500/10 px-3 text-xs font-bold uppercase tracking-wider text-sky-300 transition-colors hover:bg-sky-500/20" />
          {!isPlainGroup(c) && <button title="remove this condition" aria-label="remove this condition" onClick={() => remove(i)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-input text-lg leading-none text-muted-foreground transition-colors hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-400">×</button>}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-1.5 [container-type:inline-size]">
      {lines.length === 0 && <div className={cn('flex items-center gap-2', group && 'pl-9')}>{keyword && <span className="w-[4.5rem] text-base font-black tracking-wider text-sky-300">{keyword}</span>}<span className="text-xs italic text-muted-foreground">no condition yet: add one</span></div>}
      {groups.map((g, gi) => (
        <React.Fragment key={g[0].line.cond.id}>
          {gi > 0 && (
            <div className="flex items-center gap-2 py-0.5">
              <span className="w-[4.5rem] shrink-0"><JoinSelect value="or" onChange={(j) => setJoin(g[0].idx, j)} /></span>
              <div className="h-px flex-1 bg-amber-500/25" />
            </div>
          )}
          <div className={cn('space-y-1.5', groups.length > 1 && 'rounded-md border border-cyan-500/20 bg-cyan-500/[0.03] p-1.5')}>
            {g.map(({ line, idx }) => lineView(line, idx))}
          </div>
        </React.Fragment>
      ))}
      {(() => { const btns = <>
        <AddMenu ctx={ctx} side={side} onAdd={(c) => add(c, 'and')} label="+ Add" title={group ? 'add a condition to this group' : 'add a condition, joined with AND'} buttonClass="flex h-8 items-center rounded-md border border-sky-500/50 bg-sky-500/10 px-3 text-xs font-bold uppercase tracking-wider text-sky-300 transition-colors hover:bg-sky-500/20" />
        {!group && lines.length > 0 && <AddMenu ctx={ctx} side={side} onAdd={(c) => add(c, 'or')} label="+ Or" title="add a condition joined with OR (starts a new box)" buttonClass="flex h-8 items-center rounded-md border border-amber-500/40 px-3 text-xs font-bold uppercase tracking-wider text-amber-300 transition-colors hover:bg-amber-500/15" />}
        <button className="flex h-8 items-center gap-1 rounded-md border border-cyan-500/50 bg-cyan-500/10 px-3 text-xs font-bold uppercase tracking-wider text-cyan-300 transition-colors hover:bg-cyan-500/20" onClick={() => add(newGroup('all'))} title="a group where every condition must hold"><span aria-hidden="true" className="text-sm leading-none">+</span>All of</button>
        <button className="flex h-8 items-center gap-1 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 text-xs font-bold uppercase tracking-wider text-amber-300 transition-colors hover:bg-amber-500/20" onClick={() => add(newGroup('any'))} title="a group where at least one condition must hold"><span aria-hidden="true" className="text-sm leading-none">+</span>Any of</button>
      </>; return addTo && !group ? createPortal(btns, addTo) : <div className={cn('flex flex-wrap items-center gap-1.5', group ? 'pl-9' : 'pl-[5.5rem]')}>{btns}</div>; })()}
      {!nested && mixed && <div className="pl-[5.5rem] text-[11px] text-muted-foreground">AND is checked before OR: each box must hold as a whole, and any one of the boxes is enough. Reads as: {condPhrase(cond, ctx.labels)}.</div>}
    </div>
  );
}

/** add a condition to a step with AND, whatever shape its tree has */
export function appendAnd(c: Cond, add: Cond): Cond {
  const ls = toLines(c);
  return fromLines([...ls, { cond: add, join: 'and' }], c.id, (c as any).label);
}

/** a step's "Configure" box: the buttons that add to the step's conditions, then whatever else configures it (the Sequence limits) */
export function StepConfigure({ rule, children }: { rule: (addTo: HTMLElement | null) => React.ReactNode; children?: React.ReactNode }) {
  const [el, setEl] = React.useState<HTMLElement | null>(null);
  return (
    <>
      {rule(el)}
      <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
        <div className="text-sm font-bold tracking-tight">Configure this step</div>
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Add to the conditions</div>
          <div ref={setEl} className="flex flex-wrap items-center gap-1.5" />
        </div>
        {children}
      </div>
    </>
  );
}

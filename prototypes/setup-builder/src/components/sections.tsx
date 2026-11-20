// PROTOTYPE: editors for Setup settings and the Run-overridable Trade-settings sections, shared by the variants.
import React from 'react';
import { Setup, Step, TF, TFS, Leg, Guard, InPositionRule, Cond, uid, SECTION_NAMES, condPhrase, Pattern, PatternKind, PATTERN_KINDS, newPattern, patternUsage, patternSettingsPhrase, tfMinutes } from '../model';
import { TokenPicker, TokenCtx, shortName } from './TokenPicker';
import { CondEditor, Look } from './CondEditor';
import { PatternSchematic, PatternExample } from './PatternDiagram';
import type { Data } from '../engine';
import { Button, Field, Input, NumInput, Select, Switch, Badge, cn } from './ui';

export type Mutate = (fn: (s: Setup) => void) => void;

// ---------- Setup settings ----------
export function BaseBarEditor({ setup, mutate }: { setup: Setup; mutate: Mutate }) {
  return (
    <Field label="Base bar" hint="The evaluator runs once per Base-bar close. Tokens finer than it are refused.">
      <Select value={setup.settings.base_bar} onChange={(v: TF) => mutate((s) => { s.settings.base_bar = v; })} options={TFS.filter((t) => t !== '1d')} />
    </Field>
  );
}
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export function TradingHoursEditor({ setup, mutate }: { setup: Setup; mutate: Mutate }) {
  const th = setup.settings.trading_hours;
  return (
    <Field label="Trading hours (NY, checked on the Signal's bar)" hint="Ranges may cross midnight, e.g. 18:00–16:00 for every session.">
      {th.ranges.map((r, k) => (
        <span key={k} className="flex items-center gap-1">
          <Input value={r.start} onChange={(e) => mutate((s) => { s.settings.trading_hours.ranges[k].start = e.target.value; })} className="w-16" />–
          <Input value={r.end} onChange={(e) => mutate((s) => { s.settings.trading_hours.ranges[k].end = e.target.value; })} className="w-16" />
          <button className="text-muted-foreground hover:text-red-400" onClick={() => mutate((s) => { s.settings.trading_hours.ranges.splice(k, 1); })}>×</button>
        </span>
      ))}
      <Button size="sm" variant="ghost" onClick={() => mutate((s) => { s.settings.trading_hours.ranges.push({ start: '09:30', end: '16:00' }); })}>+ range</Button>
      <span className="flex gap-0.5">{WD.map((d, k) => <button key={d} onClick={() => mutate((s) => { const w = s.settings.trading_hours.weekdays; s.settings.trading_hours.weekdays = w.includes(k) ? w.filter((x) => x !== k) : [...w, k].sort(); })} className={cn('rounded px-1 text-[11px]', th.weekdays.includes(k) ? 'bg-sky-500/20 text-sky-200' : 'text-muted-foreground')}>{d}</button>)}</span>
    </Field>
  );
}
export function SessionsEditor({ setup, mutate }: { setup: Setup; mutate: Mutate }) {
  return (
    <Field label="Sessions (copied into the Setup, editable)" hint="Session levels (Asia high, …) read these times.">
      {Object.entries(setup.settings.sessions).map(([n, r]) => (
        <span key={n} className="flex items-center gap-1 text-xs"><span className="w-14 capitalize">{n.replace('_', ' ')}</span>
          <Input value={r.start} onChange={(e) => mutate((s) => { s.settings.sessions[n].start = e.target.value; })} className="h-7 w-14" />–
          <Input value={r.end} onChange={(e) => mutate((s) => { s.settings.sessions[n].end = e.target.value; })} className="h-7 w-14" /></span>
      ))}
    </Field>
  );
}
const ONE_AT_A_TIME: Record<string, [string, string]> = {
  off: ['Off: several Trades at once', 'Every Candidate that completes gives a Signal, even while another Trade of this Setup is open, so Trades can overlap.'],
  ignore_new_starts: ['Ignore new starts', 'While a Trade is live (from its Signal until its last exit), a first step that holds starts no new Candidate, and a Candidate already running cannot complete into a Signal. Once the Trade is over, the Setup looks for fresh starts.'],
  skip_completions: ['Skip completions', 'While a Trade is live, Candidates keep starting and moving through their steps, but one that completes is dropped (no Signal). After the Trade ends, a Candidate still running can complete normally, so a setup that formed during the Trade can still be taken.'],
};
const NEWS: Record<string, [string, string]> = {
  off: ['Off', 'Economic releases change nothing: Signals are taken on News days like any other day.'],
  whole_day: ['Whole Trading day', 'On a News day (a release of a type you switched on), every Signal of this Setup is suppressed: logged with the reason, but no Trade opens.'],
  span: ['A span around the release', 'Only Signals inside the window around each release are suppressed: from N minutes before to M minutes after its New York time. Signals outside the window trade normally.'],
};
export function BehaviourEditor({ setup, mutate }: { setup: Setup; mutate: Mutate }) {
  const n = setup.settings.news_rule;
  const oat = setup.settings.one_at_a_time;
  const desc = (title: string, text: string, extra?: React.ReactNode) => (
    <div className="mt-1.5 rounded-md border-l-2 border-sky-500/50 bg-sky-500/5 px-2.5 py-1.5 text-xs leading-relaxed text-muted-foreground"><span className="font-medium text-foreground">{title}.</span> {text}{extra}</div>
  );
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div>
        <Field label="One at a time" hint="What happens to new setups while a Trade of this Setup is live.">
          <Select value={oat} onChange={(v) => mutate((s) => { s.settings.one_at_a_time = v as any; })} options={Object.entries(ONE_AT_A_TIME).map(([k, [l]]) => [k, l] as [string, string])} />
        </Field>
        {desc(...ONE_AT_A_TIME[oat])}
        <details className="mt-1.5 text-[11px] text-muted-foreground"><summary className="cursor-pointer hover:text-foreground">compare the three</summary>
          <ul className="mt-1 space-y-1 pl-3">{Object.entries(ONE_AT_A_TIME).map(([k, [l, t]]) => <li key={k} className={cn(k === oat && 'text-foreground')}><b>{l}</b>: {t}</li>)}</ul>
        </details>
      </div>
      <div>
        <Field label="News rule" hint="Which Signals an Economic release suppresses on a News day.">
          <Select value={n.mode} onChange={(v) => mutate((s) => { s.settings.news_rule.mode = v as any; })} options={Object.entries(NEWS).map(([k, [l]]) => [k, l] as [string, string])} />
          {n.mode === 'span' && <><NumInput value={n.before} onChange={(x) => mutate((s) => { s.settings.news_rule.before = x; })} className="w-14" /><span className="text-xs">min before</span><NumInput value={n.after} onChange={(x) => mutate((s) => { s.settings.news_rule.after = x; })} className="w-14" /><span className="text-xs">min after</span></>}
        </Field>
        {desc(...NEWS[n.mode], n.mode === 'span' ? <> Here: from <b className="text-foreground">{n.before ?? 0} min</b> before to <b className="text-foreground">{n.after ?? 0} min</b> after; a 08:30 release blocks {spanText(n.before ?? 0, n.after ?? 0)}.</> : undefined)}
        <div className="mt-1.5 text-[11px] text-muted-foreground">Which release types count (CPI, NFP, FOMC…) is chosen once for the whole bot, not per Setup. The prototype's chart does not apply the news rule.</div>
      </div>
    </div>
  );
}
function spanText(before: number, after: number) {
  const f = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return `Signals from ${f(8 * 60 + 30 - before)} to ${f(8 * 60 + 30 + after)}`;
}

// ---------- indicators declared once ----------
export function IndicatorList({ setup, mutate, ctx, usage }: { setup: Setup; mutate: Mutate; ctx: TokenCtx; usage?: Record<string, number> }) {
  return (
    <div className="space-y-1.5">
      {setup.indicators.map((ind, k) => (
        <div key={k} className="flex flex-wrap items-center gap-2">
          <TokenPicker value={ind.token} ctx={{ ...ctx, inlineDeclare: true, onDeclare: undefined, onlyIndicator: true }} compact onChange={(t) => mutate((s) => { const old = s.indicators[k].token; s.indicators[k].token = t.replace(/\.prev\[\d+\]$/, ''); renameToken(s, old, s.indicators[k].token); })} />
          <Input placeholder="display label (optional)" value={ind.label || ''} onChange={(e) => mutate((s) => { s.indicators[k].label = e.target.value || undefined; })} className="h-7 w-48" />
          {usage && <span className="text-[11px] text-muted-foreground">used {usage[ind.token] || 0}×</span>}
          <button className="text-muted-foreground hover:text-red-400" onClick={() => mutate((s) => { s.indicators.splice(k, 1); })}>×</button>
        </div>
      ))}
      <Button size="sm" variant="ghost" onClick={() => mutate((s) => { s.indicators.push({ token: `{{indicator:ema:200:${s.settings.base_bar}}}` }); })}>+ declare an indicator</Button>
    </div>
  );
}
// ---------- Patterns, declared once ----------
const PKINDS = Object.keys(PATTERN_KINDS) as PatternKind[];
const DISP_KEYS = ['disp_mult', 'disp_body_pct', 'avg_len'];
export function PatternList({ setup, mutate, compact, data }: { setup: Setup; mutate: Mutate; compact?: boolean; data?: Data }) {
  const usage = patternUsage(setup);
  const pats = setup.patterns || [];
  const set = (k: number, fn: (p: Pattern) => void) => mutate((s) => { fn(s.patterns[k]); });
  const tfs = TFS.filter((t) => tfMinutes(t) >= tfMinutes(setup.settings.base_bar));
  return (
    <div className="space-y-2">
      {pats.length === 0 && <div className="text-xs italic text-muted-foreground">No patterns yet.</div>}
      {pats.map((p, k) => {
        const d = PATTERN_KINDS[p.kind];
        const dispOn = p.kind === 'displacement' || p.kind === 'order_block' || !!p.params.displacement;
        return (
          <div key={k} className="rounded-md border p-2">
            <div className="flex flex-wrap items-center gap-2">
              <Input value={p.name} onChange={(e) => { const v = e.target.value.trim(); mutate((s) => { renamePattern(s, s.patterns[k].name, v); s.patterns[k].name = v; }); }} className="mono h-7 w-24" title="its name: steps read it as {{capture:name.field}}" />
              <Select value={p.kind} onChange={(kind: PatternKind) => set(k, (q) => { Object.assign(q, { ...newPattern(kind, q.tf, []), name: q.name, label: q.label }); })} options={PKINDS.map((x) => [x, PATTERN_KINDS[x].title] as [PatternKind, string])} className="h-7" />
              <span className="text-xs text-muted-foreground">on</span>
              <Select value={p.tf} onChange={(tf: TF) => set(k, (q) => { q.tf = tf; })} options={tfs.includes(p.tf) ? tfs : [p.tf, ...tfs]} className="h-7" />
              <span className={cn('text-[11px]', usage[p.name] ? 'text-muted-foreground' : 'text-amber-300')}>{usage[p.name] ? `used ${usage[p.name]}×` : 'unused'}</span>
              <button className="ml-auto text-muted-foreground hover:text-red-400" title="remove" onClick={() => mutate((s) => { s.patterns.splice(k, 1); })}>×</button>
            </div>
            {!compact && <div className="mt-1 text-[11px] text-muted-foreground">{d.help}</div>}
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {d.params.filter(([key]) => dispOn || !DISP_KEYS.includes(key)).map(([key, label, def]) =>
                typeof def === 'boolean'
                  ? <label key={key} className="flex items-center gap-1 text-muted-foreground"><input type="checkbox" checked={!!p.params[key]} onChange={(e) => set(k, (q) => { q.params[key] = e.target.checked; })} />{label}</label>
                  : <span key={key} className="flex items-center gap-1 text-muted-foreground">{label}<NumInput step={key === 'disp_mult' ? 0.1 : 1} value={p.params[key] as number} onChange={(n) => set(k, (q) => { q.params[key] = n; })} className="h-6 w-14" /></span>)}
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">captures <span className="mono">{p.name}.</span>{d.fields.filter((f) => !/^bar[123]\./.test(f)).join(', ')}{p.kind === 'fvg' ? ', bar1…bar3 (open, high, low, close)' : ''} · steps choose bullish or bearish</div>
            {compact
              ? <details className="mt-1.5"><summary className="cursor-pointer text-[11px] text-sky-300">what it looks like</summary><div className="mt-1.5 flex flex-wrap gap-2"><PatternSchematic p={p} />{data && <PatternExample p={p} data={data} />}</div></details>
              : <div className="mt-2 flex flex-wrap items-start gap-3">
                  <div className="space-y-1"><PatternSchematic p={p} /><div className="text-[11px] text-muted-foreground">the idea, drawn from these settings (bullish; bearish is its mirror)</div></div>
                  {data && <div><PatternExample p={p} data={data} /><div className="text-[11px] text-muted-foreground">real ones on MNQ with these settings (the white box is the bar where it forms)</div></div>}
                </div>}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-1">
        <span className="text-xs text-muted-foreground">+ declare</span>
        {PKINDS.map((kind) => <Button key={kind} size="sm" variant="outline" className="h-7" onClick={() => mutate((s) => { s.patterns = s.patterns || []; s.patterns.push(newPattern(kind, s.settings.base_bar, s.patterns.map((q) => q.name))); })}>{PATTERN_KINDS[kind].title.replace(/ \(.*\)$/, '').replace('Fair value gap', 'FVG')}</Button>)}
      </div>
    </div>
  );
}
/** renaming a pattern updates the steps that reference it and every {{capture:name.…}} token */
export function renamePattern(s: Setup, from: string, to: string) {
  if (from === to || !from) return;
  const re = (x: string) => (x ? x.split(`{{capture:${from}.`).join(`{{capture:${to}.`) : x);
  const walk = (c?: Cond) => {
    if (!c) return;
    if (c.t === 'pattern' && c.ref === from) c.ref = to;
    if (c.t === 'cmp') { c.a = re(c.a); c.b = re(c.b); }
    if (c.t === 'draw') c.from = re(c.from);
    if (c.t === 'all' || c.t === 'any') c.items.forEach(walk);
    if (c.t === 'not' || c.t === 'for_n') walk(c.item);
  };
  s.branches.forEach((b) => {
    b.steps.forEach((st) => { walk(st.cond); walk(st.hold); walk(st.invalidate); });
    b.entry.price = b.entry.price && re(b.entry.price); b.entry.stop.token = re(b.entry.stop.token);
  });
  s.in_position_rules.forEach((r) => walk(r.when));
  s.trade_settings.legs.forEach((l) => { if (l.level) l.level = re(l.level); });
}

/** changing a declared indicator updates every place that reads it (a new Setup version on Freeze) */
export function renameToken(s: Setup, from: string, to: string) {
  if (from === to) return;
  const re = (x: string) => (x && x.replace(/\.prev\[\d+\]$/, '') === from ? to + (x.match(/\.prev\[\d+\]$/)?.[0] || '') : x);
  const walk = (c?: Cond) => {
    if (!c) return;
    if (c.t === 'cmp') { c.a = re(c.a); c.b = re(c.b); }
    if (c.t === 'all' || c.t === 'any') c.items.forEach(walk);
    if (c.t === 'not' || c.t === 'for_n') walk(c.item);
  };
  s.branches.forEach((b) => { b.steps.forEach((st) => { walk(st.cond); walk(st.hold); walk(st.invalidate); }); if (b.entry.stop.atr) b.entry.stop.atr = re(b.entry.stop.atr); });
  s.in_position_rules.forEach((r) => walk(r.when));
  s.trade_settings.signal_guards.forEach((g) => { if (g.atr) g.atr = re(g.atr); });
}
export function indicatorUsage(s: Setup) {
  const out: Record<string, number> = {};
  const json = JSON.stringify({ b: s.branches, r: s.in_position_rules, g: s.trade_settings.signal_guards });
  for (const i of s.indicators) out[i.token] = json.split(i.token.replace(/[{}]/g, (m) => m)).length - 1;
  return out;
}

// ---------- step limits ----------
export function StepLimits({ step, onChange, isFirst, ctx, side, look }: { step: Step; onChange: (s: Step) => void; isFirst: boolean; ctx: TokenCtx; side: 'long' | 'short'; look: Look }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {!isFirst && <Switch checked={!!step.same_bar} onChange={(b) => onChange({ ...step, same_bar: b })} label="may complete on the same bar" />}
      {!isFirst && <span className="flex items-center gap-1">within <NumInput value={step.within_bars} onChange={(n) => onChange({ ...step, within_bars: isNaN(n) ? undefined : n })} className="h-6 w-14" placeholder="∞" /> bars</span>}
      {!isFirst && <span className="flex items-center gap-1">until <Input value={step.until || ''} placeholder="hh:mm" onChange={(e) => onChange({ ...step, until: e.target.value || undefined })} className="h-6 w-16" /> NY</span>}
      <span className="flex items-center gap-1">capture running
        <Input value={step.capture_running?.name || ''} placeholder="name" onChange={(e) => onChange({ ...step, capture_running: e.target.value ? { name: e.target.value, field: step.capture_running?.field || 'low' } : undefined })} className="mono h-6 w-20" />
        {step.capture_running && <Select value={step.capture_running.field} onChange={(f) => onChange({ ...step, capture_running: { ...step.capture_running!, field: f } })} options={['low', 'high']} className="h-6" />}
      </span>
      {!isFirst && !step.invalidate && <button className="hover:text-foreground" onClick={() => onChange({ ...step, invalidate: { id: uid(), t: 'all', items: [] } })}>+ invalidation</button>}
      {step.invalidate && (
        <div className="w-full"><span className="mr-1">ends the Candidate when:</span>
          <CondEditor cond={step.invalidate} ctx={ctx} side={side} look={look} onChange={(c) => onChange({ ...step, invalidate: c })} onRemove={() => onChange({ ...step, invalidate: undefined })} />
        </div>
      )}
    </div>
  );
}

// ---------- Entry block ----------
export function EntryEditor({ setup, mutate, bi, ctx }: { setup: Setup; mutate: Mutate; bi: number; ctx: TokenCtx }) {
  const e = setup.branches[bi].entry;
  const set = (fn: (e: Setup['branches'][0]['entry']) => void) => mutate((s) => fn(s.branches[bi].entry));
  return (
    <div className="space-y-2">
      <Field label="Order">
        <Select value={e.order} onChange={(v) => set((x) => { x.order = v; })} options={[['market', "market (next Base bar's open)"], ['limit', 'limit'], ['stop', 'stop entry']]} />
        {e.order !== 'market' && <><span className="text-xs text-muted-foreground">at</span><TokenPicker value={e.price || ''} ctx={ctx} onChange={(v) => set((x) => { x.price = v; })} /></>}
      </Field>
      <StopEditor value={e.stop} onChange={(v) => set((x) => { x.stop = v; })} ctx={ctx} />
    </div>
  );
}
export function StopEditor({ value, onChange, ctx }: { value: Setup['branches'][0]['entry']['stop']; onChange: (v: Setup['branches'][0]['entry']['stop']) => void; ctx: TokenCtx }) {
  return (
    <Field label={<>Stop <Badge tone={value.token ? 'outline' : 'error'}>mandatory</Badge></>}>
      <NumInput step={0.05} value={value.offset} onChange={(n) => onChange({ ...value, offset: n })} className="w-16" />
      <Select value={value.unit} onChange={(u) => onChange({ ...value, unit: u })} options={[['ticks', 'ticks'], ['atr', '× ATR']]} />
      {value.unit === 'atr' && <TokenPicker value={value.atr || ''} ctx={ctx} compact onChange={(a) => onChange({ ...value, atr: a })} placeholder="which ATR" />}
      <span className="text-xs text-muted-foreground">beyond</span>
      <TokenPicker value={value.token} ctx={ctx} onChange={(t) => onChange({ ...value, token: t })} placeholder="pick the stop level" />
    </Field>
  );
}

// ---------- Trade-settings sections (the Run-overridable ones) ----------
export type SectionKey = 'risk' | 'stop' | 'legs' | 'break_even' | 'entry_deadline' | 'expiry_and_flatten' | 'signal_guards';
export const SECTIONS: SectionKey[] = ['risk', 'stop', 'legs', 'break_even', 'entry_deadline', 'expiry_and_flatten', 'signal_guards'];
export function getSection(s: Setup, k: SectionKey): any {
  const ts = s.trade_settings;
  switch (k) {
    case 'risk': return ts.risk;
    case 'stop': return s.branches.map((b) => b.entry.stop);
    case 'legs': return { legs: ts.legs, leftover: ts.leftover };
    case 'break_even': return ts.break_even;
    case 'entry_deadline': return { entry_deadline: ts.entry_deadline, cancel_if: ts.cancel_if };
    case 'expiry_and_flatten': return { expiry: ts.expiry, flatten_time: ts.flatten_time };
    case 'signal_guards': return ts.signal_guards;
  }
}
export function setSection(s: Setup, k: SectionKey, v: any) {
  const ts = s.trade_settings;
  switch (k) {
    case 'risk': ts.risk = v; break;
    case 'stop': s.branches.forEach((b, i) => { if (v[i]) b.entry.stop = v[i]; }); break;
    case 'legs': ts.legs = v.legs; ts.leftover = v.leftover; break;
    case 'break_even': ts.break_even = v; break;
    case 'entry_deadline': ts.entry_deadline = v.entry_deadline; ts.cancel_if = v.cancel_if; break;
    case 'expiry_and_flatten': ts.expiry = v.expiry; ts.flatten_time = v.flatten_time; break;
    case 'signal_guards': ts.signal_guards = v; break;
  }
}
export function sectionSummary(s: Setup, k: SectionKey): string {
  const v = getSection(s, k);
  switch (k) {
    case 'risk': return `${v.pct}% of $${v.capital}, max ${v.max_contracts} contracts`;
    case 'stop': return v.map((x: any) => `${x.offset} ${x.unit === 'atr' ? '× ATR' : 'ticks'} beyond ${shortName(x.token, {}) || '?'}`).join(' / ');
    case 'legs': return v.legs.map((l: Leg) => `${l.name} ${l.rule === 'r' ? l.r + 'R' : l.rule === 'fraction' ? (l.fraction ?? 0) * 100 + '% to ' + shortName(l.level || '', {}) : shortName(l.level || '', {}) + (l.offset_ticks ? ` −${l.offset_ticks}t` : '')} ${Math.round(l.share * 100)}%`).join(', ') + `; leftover to ${v.leftover}`;
    case 'break_even': return v.trigger === 'off' ? 'off' : v.trigger === 'after_leg' ? `after leg ${v.k}, +${v.offset_ticks} ticks` : `at +${v.r}R, +${v.offset_ticks} ticks`;
    case 'entry_deadline': return `${v.entry_deadline.kind === 'clock' ? 'at ' + v.entry_deadline.value : v.entry_deadline.kind === 'bars' ? v.entry_deadline.value + ' Base bars' : v.entry_deadline.kind.replace(/_/g, ' ')}; cancel if ${v.cancel_if.join(', ') || 'nothing'} reached first`;
    case 'expiry_and_flatten': return `${v.expiry ? 'exit at ' + v.expiry + ', ' : ''}flatten ${v.flatten_time}`;
    case 'signal_guards': return v.map((g: Guard) => (g.kind === 'max_stop' ? `stop ≤ ${g.n} ${g.unit === 'atr' ? '× ATR' : 'ticks'}` : `reward:risk ≥ ${g.n}`)).join(', ') || 'none';
  }
}

export function SectionEditor({ k, value, onChange, setup, ctx }: { k: SectionKey; value: any; onChange: (v: any) => void; setup: Setup; ctx: TokenCtx }) {
  switch (k) {
    case 'risk': return (
      <div className="flex flex-wrap gap-4">
        <Field label="Capital $"><NumInput value={value.capital} onChange={(n) => onChange({ ...value, capital: n })} className="w-24" /></Field>
        <Field label="Risk per Trade %"><NumInput step={0.25} value={value.pct} onChange={(n) => onChange({ ...value, pct: n })} /></Field>
        <Field label="Max contracts"><NumInput value={value.max_contracts} onChange={(n) => onChange({ ...value, max_contracts: n })} /></Field>
      </div>
    );
    case 'stop': return <div className="space-y-2">{value.map((st: any, i: number) => <div key={i}><Badge>{setup.branches[i]?.side}</Badge><StopEditor value={st} ctx={{ ...ctx, captures: ctxCaps(setup, i, ctx) }} onChange={(v) => onChange(value.map((x: any, j: number) => (j === i ? v : x)))} /></div>)}</div>;
    case 'legs': return (
      <div className="space-y-1.5">
        {value.legs.map((l: Leg, i: number) => (
          <div key={i} className="flex flex-wrap items-center gap-1.5 text-sm">
            <Input value={l.name} onChange={(e) => onChange({ ...value, legs: value.legs.map((x: Leg, j: number) => (j === i ? { ...x, name: e.target.value } : x)) })} className="h-7 w-14" />
            <Select value={l.rule} onChange={(r) => onChange({ ...value, legs: value.legs.map((x: Leg, j: number) => (j === i ? { ...x, rule: r, r: x.r ?? 2, level: x.level ?? '{{draw}}', fraction: x.fraction ?? 0.5 } : x)) })} options={[['r', 'R multiple'], ['level', 'Level ± ticks'], ['fraction', 'fraction of the way to a Level']]} className="h-7" />
            {l.rule === 'r' && <><NumInput step={0.25} value={l.r} onChange={(n) => onChange({ ...value, legs: value.legs.map((x: Leg, j: number) => (j === i ? { ...x, r: n } : x)) })} className="h-7 w-16" />R</>}
            {l.rule === 'fraction' && <><NumInput step={0.05} value={l.fraction} onChange={(n) => onChange({ ...value, legs: value.legs.map((x: Leg, j: number) => (j === i ? { ...x, fraction: n } : x)) })} className="h-7 w-16" /> of the way to</>}
            {l.rule === 'level' && <><NumInput value={l.offset_ticks} onChange={(n) => onChange({ ...value, legs: value.legs.map((x: Leg, j: number) => (j === i ? { ...x, offset_ticks: n } : x)) })} className="h-7 w-14" /> ticks before</>}
            {l.rule !== 'r' && <TokenPicker value={l.level || ''} ctx={ctx} compact onChange={(v) => onChange({ ...value, legs: value.legs.map((x: Leg, j: number) => (j === i ? { ...x, level: v } : x)) })} />}
            <span className="text-xs text-muted-foreground">share</span>
            <NumInput step={0.05} value={l.share} onChange={(n) => onChange({ ...value, legs: value.legs.map((x: Leg, j: number) => (j === i ? { ...x, share: n } : x)) })} className="h-7 w-16" />
            <button className="text-muted-foreground hover:text-red-400" onClick={() => onChange({ ...value, legs: value.legs.filter((_: Leg, j: number) => j !== i) })}>×</button>
          </div>
        ))}
        <div className="flex items-center gap-2"><Button size="sm" variant="ghost" onClick={() => onChange({ ...value, legs: [...value.legs, { name: `TP${value.legs.length + 1}`, rule: 'r', r: 3, share: 0 }] })}>+ leg</Button>
          <span className="text-xs text-muted-foreground">leftover contracts to the</span><Select value={value.leftover} onChange={(v) => onChange({ ...value, leftover: v })} options={[['first', 'first legs'], ['last', 'last legs']]} className="h-7" /></div>
      </div>
    );
    case 'break_even': return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Select value={value.trigger} onChange={(t) => onChange({ ...value, trigger: t, k: value.k ?? 1, r: value.r ?? 1 })} options={[['off', 'off'], ['after_leg', 'after leg k fills'], ['at_r', 'once price reaches +X R']]} />
        {value.trigger === 'after_leg' && <>k <NumInput value={value.k} onChange={(n) => onChange({ ...value, k: n })} className="w-14" /></>}
        {value.trigger === 'at_r' && <>X <NumInput step={0.25} value={value.r} onChange={(n) => onChange({ ...value, r: n })} className="w-14" />R</>}
        {value.trigger !== 'off' && <>offset <NumInput value={value.offset_ticks} onChange={(n) => onChange({ ...value, offset_ticks: n })} className="w-14" /> ticks</>}
      </div>
    );
    case 'entry_deadline': return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone="outline">mandatory</Badge>
        <Select value={value.entry_deadline.kind} onChange={(kk) => onChange({ ...value, entry_deadline: { kind: kk, value: kk === 'clock' ? '11:00' : kk === 'bars' ? '3' : '' } })} options={[['clock', 'a NY clock time'], ['bars', 'N Base bars after the Signal'], ['end_of_hours', 'end of Trading hours'], ['end_of_day', 'end of the Trading day']]} />
        {(value.entry_deadline.kind === 'clock' || value.entry_deadline.kind === 'bars') && <Input value={value.entry_deadline.value} onChange={(e) => onChange({ ...value, entry_deadline: { ...value.entry_deadline, value: e.target.value } })} className="w-16" />}
        <span className="text-xs text-muted-foreground">cancel if reached first:</span>
        {(['stop', 'first_leg', 'draw'] as const).map((c) => <label key={c} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={value.cancel_if.includes(c)} onChange={(e) => onChange({ ...value, cancel_if: e.target.checked ? [...value.cancel_if, c] : value.cancel_if.filter((x: string) => x !== c) })} />{c.replace('_', ' ')}</label>)}
      </div>
    );
    case 'expiry_and_flatten': return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        exit open Trades at <Input value={value.expiry || ''} placeholder="off" onChange={(e) => onChange({ ...value, expiry: e.target.value || undefined })} className="w-16" />
        Flatten time <Input value={value.flatten_time} onChange={(e) => onChange({ ...value, flatten_time: e.target.value })} className="w-16" /><Badge tone="outline">mandatory</Badge>
      </div>
    );
    case 'signal_guards': return (
      <div className="space-y-1.5 text-sm">
        {value.map((g: Guard, i: number) => (
          <div key={i} className="flex flex-wrap items-center gap-1.5">refuse the Signal if{' '}
            {g.kind === 'max_stop' ? <>the stop is wider than <NumInput step={0.5} value={g.n} onChange={(n) => onChange(value.map((x: Guard, j: number) => (j === i ? { ...x, n } : x)))} className="h-7 w-14" />
              <Select value={g.unit || 'ticks'} onChange={(u) => onChange(value.map((x: Guard, j: number) => (j === i ? { ...x, unit: u } : x)))} options={[['ticks', 'ticks'], ['atr', '× ATR']]} className="h-7" />
              {g.unit === 'atr' && <TokenPicker value={g.atr || ''} ctx={ctx} compact onChange={(a) => onChange(value.map((x: Guard, j: number) => (j === i ? { ...x, atr: a } : x)))} />}</>
              : <>reward:risk is below <NumInput step={0.1} value={g.n} onChange={(n) => onChange(value.map((x: Guard, j: number) => (j === i ? { ...x, n } : x)))} className="h-7 w-14" /></>}
            <button className="text-muted-foreground hover:text-red-400" onClick={() => onChange(value.filter((_: Guard, j: number) => j !== i))}>×</button>
          </div>
        ))}
        <div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => onChange([...value, { kind: 'max_stop', n: 40, unit: 'ticks' }])}>+ max stop</Button><Button size="sm" variant="ghost" onClick={() => onChange([...value, { kind: 'min_rr', n: 1 }])}>+ min reward:risk</Button></div>
      </div>
    );
  }
}
// ---------- what each Trade-settings section does, with this Setup's numbers worked through ----------
const PV = 2; // MNQ $ per point: the preview instrument (the real one is chosen per Run)
const SECTION_HELP: Record<SectionKey | 'in_position', string> = {
  risk: "How many contracts a Signal trades. Contracts = Capital × Risk per Trade % ÷ (stop distance × the instrument's $ per point), rounded down and capped at Max contracts. If even 1 contract would risk more than that, the Signal is refused (\"stop too wide\").",
  stop: 'Where the protective stop sits: a value the Setup reads (a captured low, a pattern edge…) plus an offset in ticks or in × ATR, on the far side from the entry. Every Entry must have one.',
  legs: "The Trade is split into legs, each with its own take-profit. R multiple: entry ± k × the stop distance. Level ± ticks: a price the Setup reads, e.g. the Draw on liquidity, stopping N ticks short so it fills before the level. Fraction: that part of the way from the entry to a level. Share: the part of the contracts each leg closes; contracts that don't divide evenly go to the first or the last legs.",
  break_even: 'Moves the stop to the entry (plus an offset in ticks, toward profit) so the rest of the Trade can no longer lose. After leg k: once leg k has filled. At +X R: once price first reaches X times the stop distance in profit. The stop only ever moves toward profit.',
  entry_deadline: "How long a limit or stop entry may wait for its fill; after that it is cancelled. A market entry fills at the next bar's open and ignores the deadline. \"Cancel if reached first\": if price touches the stop, the first leg or the Draw on liquidity before filling, the entry is cancelled, because the move already happened without you.",
  expiry_and_flatten: 'Exit open Trades at (optional): any Trade still open at this New York time is closed at market. Flatten time (mandatory): the hard end of the day for this Setup; every position still open is closed at market, whatever its legs and stop.',
  signal_guards: "Last checks on a Signal before any order. A refused Signal is logged with its reason and opens no Trade. Max stop: refuse when the stop is wider than N ticks or N × ATR (checked before sizing). Min reward:risk: refuse when the legs' average reward, weighted by contracts, divided by the risk is below N.",
  in_position: "Checked at every Base-bar close while a Trade is open. When a rule holds, its action runs at the next bar's open: close the whole Trade, close one leg, move the stop, or cancel an entry still waiting. Each rule belongs to a branch, and a Run cannot override them.",
};
function splitN(n: number, legs: Leg[], leftover: 'first' | 'last') {
  const out = legs.map((l) => Math.floor(n * l.share));
  let rest = n - out.reduce((a, b) => a + b, 0);
  const order = legs.map((_, i) => i); if (leftover === 'last') order.reverse();
  for (let k = 0; rest > 0 && legs.length; k = (k + 1) % legs.length, rest--) out[order[k]]++;
  return out;
}
function sectionExample(setup: Setup, k: SectionKey | 'in_position'): React.ReactNode {
  const ts = setup.trade_settings, stopPts = 20;
  const budget = (ts.risk.capital * ts.risk.pct) / 100;
  const raw = Math.floor(budget / (stopPts * PV));
  const contracts = Math.min(ts.risk.max_contracts, raw);
  const B = (x: React.ReactNode) => <b className="text-foreground">{x}</b>;
  switch (k) {
    case 'risk': return <>Here: {B(`$${ts.risk.capital} × ${ts.risk.pct}% = $${budget.toFixed(0)}`)} per Trade. With a 20-point stop on MNQ ($2 a point), 1 contract risks $40, so the Signal trades {B(`${contracts} contract${contracts === 1 ? '' : 's'}`)}{raw > ts.risk.max_contracts ? ' (capped by Max contracts)' : ''}. A stop wider than {B(`${(budget / PV).toFixed(0)} points`)} is refused.</>;
    case 'legs': {
      const n = contracts || 1, sp = splitN(n, ts.legs, ts.leftover);
      return <>Here, with {B(n)} contract{n === 1 ? '' : 's'} (a 20-point stop): {ts.legs.map((l, i) => <span key={i}>{i > 0 && ', '}{B(`${l.name} ×${sp[i]}`)} {l.rule === 'r' ? `at ${l.r}R, ${((l.r || 0) * stopPts).toFixed(0)} points away` : l.rule === 'fraction' ? `${Math.round((l.fraction || 0) * 100)}% of the way to the level` : `${l.offset_ticks || 0} tick${(l.offset_ticks || 0) === 1 ? '' : 's'} before the level`}</span>)}.{sp.some((x) => x === 0) ? ' A leg with 0 contracts is skipped.' : ''}</>;
    }
    case 'break_even': {
      const be = ts.break_even, off = be.offset_ticks ? ` + ${be.offset_ticks} ticks` : '';
      if (be.trigger === 'off') return <>Here: {B('off')}; the stop stays where it was placed.</>;
      if (be.trigger === 'after_leg') return <>Here: when {B(ts.legs[(be.k || 1) - 1]?.name || `leg ${be.k}`)} fills, the stop moves to the entry{off}.</>;
      return <>Here: once price is {B(`+${be.r}R`)} ({((be.r || 1) * stopPts).toFixed(0)} points with a 20-point stop), the stop moves to the entry{off}.</>;
    }
    case 'entry_deadline': {
      const d = ts.entry_deadline;
      const wait = d.kind === 'clock' ? `until ${d.value} NY` : d.kind === 'bars' ? `${d.value} Base bars (${Number(d.value) * tfMinutes(setup.settings.base_bar)} minutes)` : d.kind === 'end_of_hours' ? 'until the Trading hours end' : 'until the Trading day ends';
      return <>Here: the entry waits {B(wait)}{ts.cancel_if.length ? <>, and is cancelled earlier if the {B(ts.cancel_if.map((c) => c.replace('_', ' ')).join(' or '))} is reached first</> : ''}.{setup.branches.every((b) => b.entry.order === 'market') ? ' This Setup enters at market, so the deadline never comes into play.' : ''}</>;
    }
    case 'expiry_and_flatten': return <>Here: {ts.expiry ? <>Trades still open at {B(ts.expiry)} are closed, and </> : ''}everything is flat by {B(ts.flatten_time)} NY.</>;
    case 'signal_guards': return ts.signal_guards.length
      ? <>Here: {ts.signal_guards.map((g, i) => <span key={i}>{i > 0 && '; '}{B(g.kind === 'max_stop' ? `stop ≤ ${g.n} ${g.unit === 'atr' ? '× ATR' : 'ticks'}` : `reward:risk ≥ ${g.n}`)}{g.kind === 'max_stop' && g.unit !== 'atr' ? ` (${(g.n * 0.25).toFixed(2)} points)` : g.kind === 'min_rr' ? ` (a 20-point stop needs ${(g.n * stopPts).toFixed(0)} points of average reward)` : ''}</span>)}.</>
      : <>Here: {B('no guards')}; every Signal that can be sized is traded.</>;
    case 'in_position': return <>Here: {B(`${setup.in_position_rules.length} rule${setup.in_position_rules.length === 1 ? '' : 's'}`)}.</>;
    default: return null;
  }
}
export function SectionHelp({ setup, k }: { setup: Setup; k: SectionKey | 'in_position' }) {
  return (
    <div className="mb-2 rounded-md border-l-2 border-sky-500/50 bg-sky-500/5 px-2.5 py-1.5 text-xs leading-relaxed text-muted-foreground">
      {SECTION_HELP[k]} <span className="mt-1 block">{sectionExample(setup, k)}</span>
    </div>
  );
}

function ctxCaps(setup: Setup, bi: number, ctx: TokenCtx) {
  const out: { name: string; fields: string[] }[] = [];
  setup.branches[bi]?.steps.forEach((st) => {
    const walk = (c: Cond) => { if (c.t === 'pattern') { const pt = (setup.patterns || []).find((q) => q.name === c.ref); if (pt && !out.some((o) => o.name === c.ref)) out.push({ name: c.ref, fields: PATTERN_KINDS[pt.kind].fields }); } if (c.t === 'fvg') out.push({ name: c.capture, fields: ['top', 'bottom', 'mid', 'bar1.low', 'bar1.high', 'bar3.low', 'bar3.high'] }); if (c.t === 'all' || c.t === 'any') c.items.forEach(walk); };
    walk(st.cond);
    if (st.capture_running) out.push({ name: st.capture_running.name, fields: ['low', 'high'] });
  });
  return out.length ? out : ctx.captures;
}

// ---------- In-position rules (not Run-overridable) ----------
export function InPositionRules({ setup, mutate, ctx, look }: { setup: Setup; mutate: Mutate; ctx: TokenCtx; look: Look }) {
  return (
    <div className="space-y-2">
      {setup.in_position_rules.map((r, i) => (
        <div key={r.id} className="space-y-1 rounded-md border p-2">
          <div className="flex flex-wrap items-center gap-1.5 text-sm"><span className="text-muted-foreground">At each Base-bar close while in a Trade, when</span>
            <span className="ml-auto flex items-center gap-1"><span className="text-muted-foreground">then</span>
              <Select value={r.action} onChange={(a) => mutate((s) => { s.in_position_rules[i].action = a; })} options={[['close_trade', 'close the Trade'], ['close_leg', 'close leg k'], ['move_stop', 'move stop (tighten only)'], ['cancel_entry', 'cancel the resting entry']]} className="h-7" />
              {r.action === 'close_leg' && <NumInput value={r.leg} onChange={(n) => mutate((s) => { s.in_position_rules[i].leg = n; })} className="h-7 w-12" />}
              <button className="text-muted-foreground hover:text-red-400" onClick={() => mutate((s) => { s.in_position_rules.splice(i, 1); })}>×</button></span>
          </div>
          <CondEditor cond={r.when} ctx={{ ...ctx, inPosition: true }} side="long" look={look} onChange={(c) => mutate((s) => { s.in_position_rules[i].when = c; })} />
        </div>
      ))}
      <Button size="sm" variant="ghost" onClick={() => mutate((s) => { s.in_position_rules.push({ id: uid('ip'), action: 'close_trade', when: { id: uid(), t: 'all', items: [] } }); })}>+ In-position rule</Button>
    </div>
  );
}
export const ipPhrase = (r: InPositionRule, labels: Record<string, string>) => `${condPhrase(r.when, labels)} → ${r.action.replace('_', ' ')}`;
export { SECTION_NAMES };

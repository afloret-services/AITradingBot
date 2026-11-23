// PROTOTYPE: editors for Setup settings and the Run-overridable Trade-settings sections, shared by the variants.
import React from 'react';
import { labelsOf, phrase, parseToken } from '../model';
import { Setup, Step, TF, TFS, Leg, Guard, InPositionRule, Cond, uid, SECTION_NAMES, condPhrase, Pattern, PatternKind, PATTERN_KINDS, newPattern, patternUsage, patternSettingsPhrase, tfMinutes, patternPhrase } from '../model';
import { TokenPicker, TokenCtx, shortName } from './TokenPicker';
import { CondEditor, Look } from './CondEditor';
import { PatternIcon, IndicatorIcon } from './PatternIcon';
import { HelpBox, Hideable, withHelpId, useHelp } from './help';
import { PatternSchematic, PatternExample } from './PatternDiagram';
import type { Data, RunResult } from '../engine';
import { chartTime } from '../engine';
import { Button, Field, Input, NumInput, Select, Switch, Badge, Label, cn } from './ui';

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
    <div className="space-y-1">
      <Label>Trading window (NY, checked on the Signal's bar)</Label>
      <div className="space-y-1.5">
        {th.ranges.length === 0 && <div className="text-xs italic text-muted-foreground">No range: all day.</div>}
        {th.ranges.map((r, k) => (
          <div key={k} className="flex items-center gap-1 text-xs">
            <span className="w-16 text-muted-foreground">Range {k + 1}</span>
            <Input value={r.start} onChange={(e) => mutate((s) => { s.settings.trading_hours.ranges[k].start = e.target.value; })} className="h-7 w-14" />–
            <Input value={r.end} onChange={(e) => mutate((s) => { s.settings.trading_hours.ranges[k].end = e.target.value; })} className="h-7 w-14" />
            <button className="ml-1.5 flex h-7 w-7 items-center justify-center rounded-md border border-input text-lg leading-none text-muted-foreground transition-colors hover:border-red-400/60 hover:bg-red-500/10 hover:text-red-400" title="remove this range" aria-label={`remove range ${k + 1}`} onClick={() => mutate((s) => { s.settings.trading_hours.ranges.splice(k, 1); })}>×</button>
          </div>
        ))}
        <Button size="sm" variant="outline" className="h-8 gap-1.5 px-3" onClick={() => mutate((s) => { s.settings.trading_hours.ranges.push({ start: '09:30', end: '16:00' }); })}><span aria-hidden="true" className="text-base leading-none">+</span>Add range</Button>
      </div>
      <div className="flex items-center gap-1 pt-1 text-xs"><span className="w-16 text-muted-foreground">Days</span>
        <span className="flex flex-wrap gap-1">{WD.map((d, k) => <button key={d} aria-pressed={th.weekdays.includes(k)} onClick={() => mutate((s) => { const w = s.settings.trading_hours.weekdays; s.settings.trading_hours.weekdays = w.includes(k) ? w.filter((x) => x !== k) : [...w, k].sort(); })} className={cn('h-8 min-w-[2.75rem] rounded-md border px-2 text-xs font-medium transition-colors', th.weekdays.includes(k) ? 'border-sky-400/50 bg-sky-500/20 text-sky-100' : 'border-input text-muted-foreground hover:bg-accent')}>{d}</button>)}</span>
      </div>
      <div className="text-[11px] text-muted-foreground">Ranges may cross midnight, e.g. 18:00–16:00 for every session.</div>
    </div>
  );
}
export function SessionsEditor({ setup, mutate }: { setup: Setup; mutate: Mutate }) {
  return (
    <div className="space-y-1">
      <Label>Market sessions (copied into the Setup, editable)</Label>
      <div className="space-y-1.5">
        {Object.entries(setup.settings.sessions).map(([n, r]) => (
          <div key={n} className="flex items-center gap-1 text-xs"><span className="w-16 capitalize text-muted-foreground">{n.replace('_', ' ')}</span>
            <Input value={r.start} onChange={(e) => mutate((s) => { s.settings.sessions[n].start = e.target.value; })} className="h-7 w-14" />–
            <Input value={r.end} onChange={(e) => mutate((s) => { s.settings.sessions[n].end = e.target.value; })} className="h-7 w-14" /></div>
        ))}
      </div>
      <div className="text-[11px] text-muted-foreground">Session levels (Asia high, …) read these times.</div>
    </div>
  );
}
export const ONE_AT_A_TIME: Record<string, [string, string]> = {
  off: ['Allow overlap', 'Every Candidate that completes gives a Signal, even while another Trade of this Setup is open, so Trades can overlap.'],
  ignore_new_starts: ['Wait for the Trade to end', 'While a Trade is live (from its Signal until its last exit), a first step that holds starts no new Candidate, and a Candidate already running cannot complete into a Signal. Once the Trade is over, the Setup looks for fresh starts.'],
  skip_completions: ['Skip Signals during the Trade', 'While a Trade is live, Candidates keep starting and moving through their steps, but one that completes is dropped (no Signal). After the Trade ends, a Candidate still running can complete normally, so a setup that formed during the Trade can still be taken.'],
};
export const NEWS: Record<string, [string, string]> = {
  off: ['Trade through the news', 'Economic releases change nothing: Signals are taken on News days like any other day.'],
  whole_day: ['Skip the whole News day', 'On a News day (a release of a type you switched on), every Signal of this Setup is suppressed: logged with the reason, but no Trade opens.'],
  span: ['Skip around each release', 'Only Signals inside the window around each release are suppressed: from N minutes before to M minutes after its New York time. Signals outside the window trade normally.'],
};
export function BehaviourEditor({ setup, mutate, stacked }: { setup: Setup; mutate: Mutate; stacked?: boolean }) {
  const n = setup.settings.news_rule;
  const oat = setup.settings.one_at_a_time;
  const desc = (title: string, text: string, extra?: React.ReactNode, id = 'when:behaviour') => (
    <HelpBox id={id} className="mt-1.5"><div><span className="font-medium text-foreground">{title}.</span> {text}{extra}</div></HelpBox>
  );
  return (
    <div className={cn('grid gap-5', !stacked && 'md:grid-cols-2')}>
      <div>
        <Field label="Trade overlap" hint="What happens to new setups while a Trade of this Setup is live.">
          <Select value={oat} onChange={(v) => mutate((s) => { s.settings.one_at_a_time = v as any; })} options={Object.entries(ONE_AT_A_TIME).map(([k, [l]]) => [k, l] as [string, string])} />
        </Field>
        {desc(...ONE_AT_A_TIME[oat], undefined, 'when:oat')}
        <details className="mt-1.5 text-[11px] text-muted-foreground"><summary className="cursor-pointer hover:text-foreground">compare the three</summary>
          <ul className="mt-1 space-y-1 pl-3">{Object.entries(ONE_AT_A_TIME).map(([k, [l, t]]) => <li key={k} className={cn(k === oat && 'text-foreground')}><b>{l}</b>: {t}</li>)}</ul>
        </details>
      </div>
      <div>
        <Field label="News filter" hint="Which Signals an Economic release suppresses on a News day.">
          <Select value={n.mode} onChange={(v) => mutate((s) => { s.settings.news_rule.mode = v as any; })} options={Object.entries(NEWS).map(([k, [l]]) => [k, l] as [string, string])} />
          {n.mode === 'span' && <><NumInput value={n.before} onChange={(x) => mutate((s) => { s.settings.news_rule.before = x; })} className="w-14" /><span className="text-xs">min before</span><NumInput value={n.after} onChange={(x) => mutate((s) => { s.settings.news_rule.after = x; })} className="w-14" /><span className="text-xs">min after</span></>}
        </Field>
        {desc(NEWS[n.mode][0], NEWS[n.mode][1], n.mode === 'span' ? <> Here: from <b className="text-foreground">{n.before ?? 0} min</b> before to <b className="text-foreground">{n.after ?? 0} min</b> after; a 08:30 release blocks {spanText(n.before ?? 0, n.after ?? 0)}.</> : undefined, 'when:news')}
        <div className="mt-1.5 text-[11px] text-muted-foreground">Which release types count (CPI, NFP, FOMC…) is chosen once for the whole bot, not per Setup. The prototype's chart does not apply the news filter.</div>
      </div>
    </div>
  );
}
function spanText(before: number, after: number) {
  const f = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return `Signals from ${f(8 * 60 + 30 - before)} to ${f(8 * 60 + 30 + after)}`;
}

// ---------- indicators declared once ----------
// ---------- Indicators & patterns: what each one is ----------
export function indHelp(token: string): string {
  const pt = parseToken(token);
  const [, name, params = '', tf = '', out] = pt.parts;
  const n = params.split(',')[0];
  switch (name) {
    case 'ema': return `Exponential moving average of the last ${n} ${tf} closes: recent closes weigh more, so it turns sooner than an SMA. Read as a price (close above it, it rising over N bars…).`;
    case 'sma': return `Simple moving average: the plain average of the last ${n} ${tf} closes. Read as a price.`;
    case 'macd': { const [f = '12', sl = '26', sg = '9'] = params.split(','); return `MACD ${f} / ${sl} / ${sg} on ${tf}: the ${out === 'signal' ? `signal line, a ${sg}-bar EMA of the MACD line` : out === 'hist' ? 'histogram, the MACD line minus its signal line (above 0: momentum up)' : `MACD line, the ${f}-bar EMA minus the ${sl}-bar EMA of the close (above 0: the fast average is above the slow one)`}. Read as a number around 0.`; }
    case 'atr': return `Average true range over ${n} ${tf} bars: how far price typically moves in one bar, gaps included. Used to size stops and guards in × ATR.`;
    case 'adx': return `ADX over ${n} ${tf} bars: trend strength from 0 to 100, whatever the direction. Above 20–25 is usually read as trending.`;
    case 'rsi': return `RSI over ${n} ${tf} bars: momentum from 0 to 100. Above 70 is usually read as overbought, below 30 as oversold; it mirrors around 50.`;
    case 'avg_range': return `The average high-to-low range of the last ${n} ${tf} bars. Used as a yardstick, e.g. "this candle's range is at least 1.5 × the average".`;
    case 'avg_body': return `The average body (open to close) of the last ${n} ${tf} bars. A yardstick for "a big body".`;
    default: return '';
  }
}
function IndicatorsHelp_({ setup }: { setup: Setup }) {
  const used = indicatorUsage(setup);
  const unused = setup.indicators.filter((i) => !used[i.token]).length;
  const B = (x: React.ReactNode) => <b className="text-foreground">{x}</b>;
  return (
    <HelpBox>
      <div>An indicator is declared once by what it is: its kind, its settings and its timeframe (e.g. EMA 200 on 15m, MACD 12/26/9 on 15m, its signal line). Steps, the stop and the guards pick it from this list, and the same declaration serves both branches; change it here and every place that reads it changes. On a timeframe coarser than the Base bar, it is read from its last closed bar; finer ones are refused.</div>
      <div>A <T>display label</T> ("the EMA 200") replaces the token in the Rule description and on the chart legend. Available: EMA, SMA, MACD (line, signal, histogram), ATR, ADX, RSI, average range and average body.</div>
      <div>Here: {B(`${setup.indicators.length} declared`)}{unused ? <>, {B(`${unused} unused`)}</> : ''}.{!setup.indicators.length ? ' This Setup reads no indicator; patterns and candle values need none.' : ''}</div>
    </HelpBox>
  );
}
function PatternsHelp_({ setup }: { setup: Setup }) {
  const pats = setup.patterns || [];
  const B = (x: React.ReactNode) => <b className="text-foreground">{x}</b>;
  return (
    <HelpBox>
      <div>A pattern is declared once with a <T>name</T>, a <T>kind</T>, a <T>timeframe</T> and its settings. A step then says "a bullish <span className="mono">fvg</span> forms", and later steps, the Entry and the stop read what it captured: <span className="mono">fvg.top</span>, <span className="mono">dbl.neckline</span>, <span className="mono">eng.low</span>… The declaration has no side: the step picks bullish or bearish, so both branches share it, and "duplicate as mirrored" just flips the side.</div>
      <div>Three families. <T>ICT</T>: FVG, Displacement, Order block, Swing, MSS. <T>Chart patterns</T>, all of The Chart Guys' cheat sheet: doubles (and Adam & Eve), triples, head and shoulders (and complex), triangles, wedges, flags, pennants, rectangles, channels, broadening formations and wedges, cup and handle, diamonds, rounding tops and bottoms, island and bump-and-run reversals, measured moves, parabolic turns and the Wyckoff schematics; they form on their breakout and most capture a measured-move target. <T>Candlesticks</T>: engulfing, hammer, stars, harami, piercing, soldiers, tweezers, inside bar, doji, marubozu; they form on the close of their last candle. Each one below shows its idea and real examples on MNQ with your settings.</div>
      <div>Here: {pats.length ? <>{pats.map((q, i) => <span key={q.name}>{i > 0 && ', '}{B(q.name)} ({q.tf} {PATTERN_KINDS[q.kind].title.replace(/ \(.*\)$/, '')})</span>)}.</> : B('none declared yet.')}</div>
    </HelpBox>
  );
}
function IndicatorsPatternsIntro_() {
  return (
    <HelpBox>
      <div><T>Declare first, use later.</T> Everything a step will read that needs computing (an indicator, a pattern) is declared here once, with its timeframe and settings. The Signal steps then pick from these lists, so a setting lives in one place and the Rule description lists each one once. Plain candle values (a 15m close, a candle's range), levels (the previous day's high, a session high) and the Bias need no declaration.</div>
    </HelpBox>
  );
}

export function IndicatorList({ setup, mutate, ctx, usage }: { setup: Setup; mutate: Mutate; ctx: TokenCtx; usage?: Record<string, number> }) {
  return (
    <div className="space-y-1.5">
      {setup.indicators.map((ind, k) => (
        <React.Fragment key={k}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-[hsl(var(--chart))]"><IndicatorIcon token={ind.token} size={22} /></span>
          <TokenPicker value={ind.token} ctx={{ ...ctx, inlineDeclare: true, onDeclare: undefined, onlyIndicator: true }} compact onChange={(t) => mutate((s) => { const old = s.indicators[k].token; s.indicators[k].token = t.replace(/\.prev\[\d+\]$/, ''); renameToken(s, old, s.indicators[k].token); })} />
          <Input placeholder="display label (optional)" value={ind.label || ''} onChange={(e) => mutate((s) => { s.indicators[k].label = e.target.value || undefined; })} className="h-7 w-48" />
          {usage && <span className="text-[11px] text-muted-foreground">used {usage[ind.token] || 0}×</span>}
          <button className="text-muted-foreground hover:text-red-400" onClick={() => mutate((s) => { s.indicators.splice(k, 1); })}>×</button>
        </div>
          {indHelp(ind.token) && <Hideable id="indicators:each" className="-mt-0.5 mb-1 pl-1 text-[11px] text-muted-foreground">{indHelp(ind.token)}</Hideable>}
        </React.Fragment>
      ))}
      <Button size="sm" variant="ghost" onClick={() => mutate((s) => { s.indicators.push({ token: `{{indicator:ema:200:${s.settings.base_bar}}}` }); })}>+ declare an indicator</Button>
    </div>
  );
}
// ---------- Patterns, declared once ----------
const PField = ({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) => (
  <label className="flex flex-col gap-0.5"><span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground" title={hint}>{label}</span>{children}</label>
);
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
            <div className="flex flex-wrap items-end gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-[hsl(var(--chart))]" title={d.title}><PatternIcon kind={p.kind} size={26} /></span>
              <PField label="Name" hint="steps read it as name.field"><Input value={p.name} onChange={(e) => { const v = e.target.value.trim(); mutate((s) => { renamePattern(s, s.patterns[k].name, v); s.patterns[k].name = v; }); }} className="mono h-7 w-24" /></PField>
              <PField label="Pattern"><Select value={p.kind} onChange={(kind: PatternKind) => set(k, (q) => { Object.assign(q, { ...newPattern(kind, q.tf, []), name: q.name, label: q.label }); })} options={PKINDS.map((x) => [x, PATTERN_KINDS[x].title] as [PatternKind, string])} className="h-7" /></PField>
              <PField label="Timeframe"><Select value={p.tf} onChange={(tf: TF) => set(k, (q) => { q.tf = tf; })} options={tfs.includes(p.tf) ? tfs : [p.tf, ...tfs]} className="h-7" /></PField>
              <PField label="Display label (optional)" hint="replaces the kind in descriptions"><Input value={p.label || ''} placeholder={d.title.replace(/ \(.*\)$/, '')} onChange={(e) => set(k, (q) => { q.label = e.target.value || undefined; })} className="h-7 w-48" /></PField>
              <span className={cn('pb-1.5 text-[11px]', usage[p.name] ? 'text-muted-foreground' : 'text-amber-300')}>{usage[p.name] ? `used ${usage[p.name]}×` : 'unused'}</span>
              <button className="mb-1.5 ml-auto text-muted-foreground hover:text-red-400" title="remove" onClick={() => mutate((s) => { s.patterns.splice(k, 1); })}>×</button>
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">Reads in a step as: <span className="text-foreground">"{patternPhrase(p, 'long')}"</span></div>
            {d.cat && <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]"><PatternCatChips kind={p.kind} full />{d.cat.note && <span className="text-muted-foreground">{d.cat.note}</span>}</div>}
            <Hideable id="patterns:each" className="mt-1 text-[11px] text-muted-foreground">{d.help}</Hideable>
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
        <PatternPalette onPick={(kind) => mutate((s) => { s.patterns = s.patterns || []; s.patterns.push(newPattern(kind, s.settings.base_bar, s.patterns.map((q) => q.name))); })} />
      </div>
    </div>
  );
}
const TYPE_TONE: Record<string, string> = { reversal: 'bg-violet-500/15 text-violet-300', continuation: 'bg-sky-500/15 text-sky-300', indeterminate: 'bg-slate-500/20 text-slate-300' };
const BIAS_TONE: Record<string, string> = { bullish: 'bg-emerald-500/15 text-emerald-300', bearish: 'bg-red-500/15 text-red-300', neutral: 'bg-slate-500/20 text-slate-300' };
const cap = (x: string) => x[0].toUpperCase() + x.slice(1);
export function PatternCatChips({ kind, full }: { kind: PatternKind; full?: boolean }) {
  const c = PATTERN_KINDS[kind].cat;
  if (!c) return null;
  const biases = [...new Set([c.bull, c.bear])];
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-[10px] font-medium">
      {c.types.map((t) => <span key={t} className={cn('rounded px-1 py-px', TYPE_TONE[t])}>{cap(t)}</span>)}
      {biases.map((b) => <span key={b} className={cn('rounded px-1 py-px', BIAS_TONE[b])}>{cap(b)}</span>)}
      {full && <span className="rounded bg-muted px-1 py-px text-muted-foreground">{c.classical ? 'Classical' : 'Lesser-Known'}</span>}
      {full && c.consolidation && <span className="text-muted-foreground">consolidation: {c.consolidation}</span>}
      {full && c.breaks && <span className="text-muted-foreground">· typically breaks: {c.breaks}</span>}
    </span>
  );
}
/** the "+ declare" palette, with the cheat sheet's filters: Type, Bias, Classical / Lesser-Known */
function PatternPalette({ onPick }: { onPick: (k: PatternKind) => void }) {
  const [type, setType] = React.useState<string>('all');
  const [bias, setBias] = React.useState<string>('all');
  const [pop, setPop] = React.useState<string>('all');
  const keep = (k: PatternKind) => {
    const c = PATTERN_KINDS[k].cat;
    if (!c) return type === 'all' && bias === 'all' && pop === 'all';
    if (type !== 'all' && !c.types.includes(type as any)) return false;
    if (bias !== 'all' && c.bull !== bias && c.bear !== bias) return false;
    if (pop !== 'all' && (pop === 'classical') !== c.classical) return false;
    return true;
  };
  const Seg = ({ value, set, opts }: { value: string; set: (v: string) => void; opts: [string, string][] }) => (
    <div className="inline-flex rounded-md border p-0.5">{opts.map(([v, l]) => <button key={v} onClick={() => set(v)} className={cn('rounded px-2 py-0.5 text-[11px]', value === v ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground')}>{l}</button>)}</div>
  );
  const groups = [['ict', 'ICT'], ['chart', 'Chart patterns'], ['candle', 'Candlesticks']] as const;
  return (
    <div className="w-full space-y-2 pt-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">+ declare</span>
        <Seg value={type} set={setType} opts={[['all', 'All'], ['continuation', 'Continuation'], ['reversal', 'Reversal'], ['indeterminate', 'Indeterminate']]} />
        <Seg value={bias} set={setBias} opts={[['all', 'All'], ['bullish', 'Bullish'], ['bearish', 'Bearish'], ['neutral', 'Neutral']]} />
        <Seg value={pop} set={setPop} opts={[['all', 'All'], ['classical', 'Classical'], ['lesser', 'Lesser-Known']]} />
      </div>
      {groups.map(([g, title]) => {
        const ks = PKINDS.filter((k) => (PATTERN_KINDS[k].group || 'ict') === g && keep(k));
        if (!ks.length) return null;
        return (
          <div key={g}>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
            <div className="flex flex-wrap gap-1.5">
              {ks.map((kind) => (
                <button key={kind} onClick={() => onPick(kind)} title={PATTERN_KINDS[kind].help}
                  className="flex items-center gap-2 rounded-md border border-input bg-card/40 py-1 pl-1.5 pr-2.5 text-left text-xs font-medium transition-colors hover:border-sky-400/60 hover:bg-accent">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-[hsl(var(--chart))]"><PatternIcon kind={kind} size={22} /></span>
                  <span className="flex flex-col gap-0.5"><span>{PATTERN_KINDS[kind].title.replace(/ \(.*\)$/, '').replace('Fair value gap', 'FVG')}</span><PatternCatChips kind={kind} /></span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
      {groups.every(([g]) => !PKINDS.some((k) => (PATTERN_KINDS[k].group || 'ict') === g && keep(k))) && <div className="text-xs italic text-muted-foreground">No pattern matches these filters.</div>}
      <div className="text-[10px] text-muted-foreground">Chart-pattern categories follow The Chart Guys' chart-pattern cheat sheet; candlesticks, which it does not cover, use the usual reading. ICT patterns have no category and show only under "All".</div>
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
// ---------- When to trade ----------
function WhenHelp_({ setup, what }: { setup: Setup; what: 'intro' | 'hours' | 'sessions' }) {
  const B = (x: React.ReactNode) => <b className="text-foreground">{x}</b>;
  const th = setup.settings.trading_hours;
  const WDN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  if (what === 'intro') return (
    <HelpBox>
      <div><T>When this Setup may trade.</T> The Trading window says when a Signal may be taken; the Market sessions are the named windows that session levels (the Asia high, the London low…) are measured over; Trade overlap and the News filter say what happens while a Trade is live and around economic releases. Times are New York time throughout.</div>
    </HelpBox>
  );
  if (what === 'hours') {
    // minutes covered by the ranges, each counted once (ranges may overlap or cross midnight)
    const covered = new Set<number>();
    for (const r of th.ranges) { const [h1, m1] = r.start.split(':').map(Number), [h2, m2] = r.end.split(':').map(Number); const a0 = h1 * 60 + (m1 || 0); let d = h2 * 60 + (m2 || 0) - a0; if (d <= 0) d += 1440; if (isFinite(d)) for (let m = 0; m < d; m++) covered.add((a0 + m) % 1440); }
    const mins = covered.size;
    const days = th.weekdays.length === 5 && [1, 2, 3, 4, 5].every((d) => th.weekdays.includes(d)) ? 'Monday to Friday' : th.weekdays.map((d) => WDN[d]).join(', ') || 'every day';
    return (
      <HelpBox>
        <div>A Signal is only taken when the bar its last step completes on opens inside one of these ranges, on a ticked weekday. The steps before it may complete earlier (a pullback can start before the window opens); only the Signal is checked. A range may cross midnight (18:00–16:00 covers the whole futures day), you can add several, and no range means all day. "End of Trading window" in the Entry deadline means the end of these ranges.</div>
        <div>Here: {th.ranges.length ? B(th.ranges.map((r) => `${r.start}–${r.end}`).join(' and ')) : B('all day')} NY{th.ranges.length ? <> ({B(`${Math.floor(mins / 60)}h${mins % 60 ? String(mins % 60).padStart(2, '0') : ''}`)} a day)</> : ''}, {B(days)}.</div>
      </HelpBox>
    );
  }
  const ss = Object.entries(setup.settings.sessions);
  return (
    <HelpBox>
      <div><T>Market sessions</T>: the Asia, London and New York windows, used by session levels: "the Asia high" is the highest price of that window on the current Trading day once it has ended, and of the previous Trading day while it is still running. The Draw on liquidity and any step that compares with a session high or low read these. The times are copied into the Setup, so changing the bot's defaults later never changes a frozen version.</div>
      <div>Here: {ss.map(([n, r], i) => <span key={n}>{i > 0 && ', '}{B(`${n.replace('_', ' ')} ${r.start}–${r.end}`)}</span>)}. Change a time and the chart and Signals follow at once.</div>
    </HelpBox>
  );
}

/** a description behind a "what this means" toggle, for the denser layouts */
export function Explain({ children, label = 'what this means' }: { children: React.ReactNode; label?: string }) {
  const h = useHelp();
  if (!h.all) return null;
  return <details className="text-[11px]"><summary className="cursor-pointer select-none text-sky-300/80 hover:text-sky-300">{label}</summary><div className="mt-1.5 space-y-1.5">{children}</div></details>;
}
/** the One-at-a-time and News-rule descriptions for the current choices */
function BehaviourHelp_({ setup }: { setup: Setup }) {
  const oat = setup.settings.one_at_a_time, nr = setup.settings.news_rule;
  const o = ONE_AT_A_TIME[oat], n = NEWS[nr.mode];
  const list = (d: Record<string, [string, string]>, cur: string) => <ul className="mt-1 space-y-1 pl-3">{Object.entries(d).map(([k, [l, t]]) => <li key={k} className={cn(k === cur && 'text-foreground')}><b>{l}</b>: {t}</li>)}</ul>;
  return (
    <HelpBox>
      <div><T>Trade overlap: {o[0]}.</T> {o[1]}</div>
      <details className="text-[11px]"><summary className="cursor-pointer hover:text-foreground">compare the three</summary>{list(ONE_AT_A_TIME, oat)}</details>
      <div><T>News filter: {n[0]}.</T> {n[1]}{nr.mode === 'span' && <> Here: from <b className="text-foreground">{nr.before ?? 0} min</b> before to <b className="text-foreground">{nr.after ?? 0} min</b> after; a 08:30 release blocks {spanText(nr.before ?? 0, nr.after ?? 0)}.</>}</div>
      <details className="text-[11px]"><summary className="cursor-pointer hover:text-foreground">compare the three</summary>{list(NEWS, nr.mode)}</details>
      <div className="text-[11px]">Which release types count (CPI, NFP, FOMC…) is chosen once for the whole bot, not per Setup. The prototype's chart does not apply the news filter.</div>
    </HelpBox>
  );
}

// ---------- Basics ----------
const T = ({ children }: { children: React.ReactNode }) => <span className="font-medium text-foreground">{children}</span>;
function BasicsHelp_({ setup, what }: { setup: Setup; what: 'intro' | 'name' | 'base_bar' | 'notes' }) {
  const bb = setup.settings.base_bar, m = tfMinutes(bb);
  const perDay = Math.round(1380 / m); // CME futures trade 23 hours a day
  const finer = TFS.filter((t) => tfMinutes(t) < m);
  const B = (x: React.ReactNode) => <b className="text-foreground">{x}</b>;
  if (what === 'intro') return (
    <HelpBox>
      <div><T>A Setup</T> is one trading strategy written as Rule blocks: when to look (Trading window), what must happen in order (Signal steps), how to get in (Entry and stop) and how to manage the Trade (Trade settings). It names no instrument: the same Setup can run on MNQ, NQ, ES or MES, chosen when a <T>Run</T> is created.</div>
      <div>While you build, it is a <T>Draft</T>: it saves with warnings and you can keep changing it. <T>Freeze</T> makes a numbered, unchangeable version (v1, v2…) that Runs and backtests point to; it is refused while there are errors. You build it, check what it did on the MNQ bars, freeze it, then create a Run.</div>
    </HelpBox>
  );
  if (what === 'name') return <HelpBox><div>How the Setup is shown in lists, Runs and the Rule description. Renaming it does not make a new version: the version only changes when something the engine reads changes.</div></HelpBox>;
  if (what === 'notes') return <HelpBox><div>Free text for you: where the idea comes from, what you are testing, links. The engine never reads it, it is not part of the Rule description, and editing it does not make a new version.</div></HelpBox>;
  return (
    <HelpBox>
      <div>The bar the Setup is checked on: at every close of a {B(bb)} bar the Signal steps are evaluated once. Values on a coarser timeframe (a 15m close, a 1d Bias) are read from their last closed bar; values on a finer one are refused{finer.length ? <> (here {B(finer.join(', '))})</> : ''}, because the Setup never looks inside its own bar.</div>
      <div>Here: {B(bb)} means about {B(`${perDay.toLocaleString('en-US')} checks`)} per Trading day, and a Signal can come at the earliest {m === 1 ? 'one minute' : `${m} minutes`} after a move starts. A finer Base bar reacts sooner but sees more noise; a coarser one is calmer but enters later.{setup.patterns?.some((p) => tfMinutes(p.tf) < m) ? ' Some declared patterns are finer than this Base bar and will be refused.' : ''}</div>
    </HelpBox>
  );
}

// ---------- Create a Run ----------
const SPECS: Record<string, { pt: number; tick: number; unit: string } | undefined> = {
  MNQ: { pt: 2, tick: 0.25, unit: 'points' }, NQ: { pt: 20, tick: 0.25, unit: 'points' }, MES: { pt: 5, tick: 0.25, unit: 'points' }, ES: { pt: 50, tick: 0.25, unit: 'points' },
};
function RunHelp_({ setup, what, instrument, overrides }: { setup: Setup; what: 'intro' | 'instrument' | 'overrides'; instrument?: string; overrides?: number }) {
  const B = (x: React.ReactNode) => <b className="text-foreground">{x}</b>;
  if (what === 'intro') return (
    <HelpBox>
      <div><T>A Run</T> executes Setup versions, each bound to the instrument it trades, with its own risk settings. A <T>backtest Run</T> replays history; a <T>paper Run</T> trades on the Paper account (IBKR's simulated account, no real money).</div>
      <div>A paper Run only takes a <T>Promoted version</T>: a frozen version that passed its Promotion gate on that instrument (a measurable result on the held-out backtest period after costs, plus your review that its Trades match its rules on the chart). This Setup is still a Draft, so here the Run is only a preview on the MNQ bars.</div>
    </HelpBox>
  );
  if (what === 'instrument') {
    const sp = SPECS[instrument || 'MNQ'];
    const budget = (setup.trade_settings.risk.capital * setup.trade_settings.risk.pct) / 100;
    return (
      <HelpBox>
        <div>The Rule blocks name no instrument, so the same Setup can trade several. The instrument sets the tick size and the dollars per point, so the same stop in points risks a different amount, and changes the number of contracts.</div>
        {sp ? <div>Here: {B(instrument)} is {B(`$${sp.pt} a point`)}, tick {sp.tick}. With this Setup's {B(`$${budget.toFixed(0)}`)} Risk per Trade, a 20-point stop risks ${(20 * sp.pt).toFixed(0)} per contract, so {Math.floor(budget / (20 * sp.pt)) >= 1 ? <>it trades {B(`${Math.min(setup.trade_settings.risk.max_contracts, Math.floor(budget / (20 * sp.pt)))} contract(s)`)}</> : <>{B('every such Signal is refused')} ("stop too wide"): raise Risk per Trade in an override or pick the micro contract</>}.</div>
          : <div>Here: {B(instrument)} is not a CME equity future; its tick and point value differ, and the prototype has no bars for it.</div>}
      </HelpBox>
    );
  }
  return (
    <HelpBox>
      <div>A Run may replace <T>whole Trade-settings sections</T> (Risk per Trade, Stop, Take profits, Break-even, Entry deadline, Expiry and Flatten time, Signal guards): pick Override and the section's full editor opens, starting from the Setup default. It cannot change part of a section, and it cannot touch the Signal steps, the Entry order or the In-position rules: those are the Setup version itself.</div>
      <div>Overrides make <T>no new version</T>, so a Promoted version stays promoted. When a section is overridden, the line below it shows the Run's value, and the comparison at the bottom re-runs the Setup on the MNQ bars with and without the overrides.{overrides ? <> Here: {B(`${overrides} section${overrides === 1 ? '' : 's'}`)} overridden.</> : <> Here: {B('no override')}; the Run trades the Setup defaults.</>}</div>
    </HelpBox>
  );
}

// ---------- Review & save ----------
function ReviewHelp_({ setup, what, issues, result, versions }: { setup: Setup; what: 'intro' | 'map' | 'rule' | 'checks' | 'save' | 'chart'; issues?: { level: string }[]; result?: RunResult; versions?: number }) {
  const B = (x: React.ReactNode) => <b className="text-foreground">{x}</b>;
  if (what === 'intro') return (
    <HelpBox>
      <div><T>Read the whole Setup once before you freeze it:</T> the Setup at a glance, the checks, the save buttons, the Rule description it will be stored with, and what it did on the MNQ bars. Anything wrong: click it to go back and edit it.</div>
    </HelpBox>
  );
  if (what === 'map') return (
    <HelpBox>
      <div>Each branch as a flow, left to right: <T>When</T> (Base bar, Trading window), its <T>steps</T>, the <T>Entry</T> and the <T>Trade</T> settings. A step card lists its conditions with a tag (pattern, compare, time…), what it reads from earlier steps (<span className="mono">← name</span>) and what it captures for later ones (<span className="mono">→ name</span>), and how often it completed on the bars. The arrows between steps carry the Sequence limits. Hover a declared indicator or pattern at the top to light up the steps that read it.</div>
    </HelpBox>
  );
  if (what === 'rule') return (
    <HelpBox>
      <div>Written from the Rule blocks, never by hand, so it always says exactly what the engine will do. It is stored with the version at Freeze, and it is what you check the Trades against on the chart for the Promotion gate. Notes are never part of it.</div>
    </HelpBox>
  );
  if (what === 'checks') {
    const e = (issues || []).filter((i) => i.level === 'error').length, w = (issues || []).length - e;
    return (
      <HelpBox>
        <div><span className="text-red-300">✕ Errors</span> block Freeze: something the engine cannot run (no stop, a value read before a step captures it, a timeframe finer than the Base bar…). <span className="text-amber-300">! Warnings</span> do not: the Draft still saves and freezes, but have a look (an unused pattern, take-profit shares that do not add up to 100%…).</div>
        <div>Here: {e || w ? <>{B(`${e} error${e === 1 ? '' : 's'}`)} and {B(`${w} warning${w === 1 ? '' : 's'}`)}.</> : B('nothing to fix, ready to freeze.')}</div>
      </HelpBox>
    );
  }
  if (what === 'save') return (
    <HelpBox>
      <div><T>Save Draft</T> keeps your working copy, warnings and all; it is refused if someone else saved this Draft in the meantime, so nobody overwrites anyone. <T>Freeze → v{(versions || 0) + 1}</T> makes a numbered version that never changes, identified by a SHA-256 hash of what the engine reads; Runs and backtests point to versions, never to the Draft. It is refused while there are errors, and when nothing the engine reads has changed since the last version (renaming, notes and labels do not count). <T>Export file</T> downloads the Setup file with its Rule description; <T>Show file</T> shows it here.</div>
      <div className="text-[11px]">In this prototype nothing is kept: a reload starts over.</div>
    </HelpBox>
  );
  const sigs = result?.signals || [];
  const taken = sigs.filter((x) => !x.refused && x.trade?.r != null);
  const r = taken.reduce((a, x) => a + (x.trade!.r || 0), 0);
  const wins = taken.filter((x) => (x.trade!.r || 0) > 0).length;
  return (
    <HelpBox>
      <div><T>Signals</T>: every time the last step completed inside the Trading window. <T>Refused</T>: Signals a guard or the sizing turned down (the reason is in the Signal's panel). <T>Trades</T>: Signals that filled; a cancelled entry is not a Trade. <T>Win rate</T>: Trades that ended in profit. <T>Total</T>: the sum of the Trades' results in R, where 1R is what each Trade risked at its stop.</div>
      <div>Here: {B(`${sigs.length} Signal${sigs.length === 1 ? "" : "s"}`)}, {B(`${taken.length} Trade${taken.length === 1 ? "" : "s"}`)}, {taken.length ? <>{B(`${Math.round((wins / taken.length) * 100)}%`)} winners and </> : ''}{B(`${r >= 0 ? '+' : ''}${r.toFixed(2)}R`)} on 35 Trading days. Use the day arrows or "next Signal day", click a Signal to see its zones and its risk and reward, and ▶ Replay to step through it. This is a rough simulation on 1-minute bars; a backtest Run is the real measure.</div>
    </HelpBox>
  );
}

// ---------- what Signal steps do ----------
const NEW_START: Record<string, [string, string]> = {
  start_another: ['Start another', 'Each time step 1 holds, a new Candidate starts next to the ones already running, so several can be in progress at once and each can become a Signal.'],
  replace: ['Replace', 'Each time step 1 holds, the running Candidates are dropped and a fresh one starts. Only the most recent start can become a Signal.'],
  ignore: ['Ignore', 'While a Candidate is running, step 1 holding again starts nothing; the first start is kept until it completes or ends. Use it when step 1 keeps holding bar after bar, so the Candidate and its running capture are not restarted every bar.'],
};
/** the top of the Signal steps stage: how a branch turns into Signals */
function SignalStepsHelp_({ setup, bi }: { setup: Setup; bi: number }) {
  const br = setup.branches[bi];
  const [title, text] = NEW_START[br?.on_new_start || 'start_another'];
  return (
    <HelpBox>
      <div><T>How steps work.</T> A branch is a Sequence: step 1, then step 2, and so on. At every close of the {setup.settings.base_bar} Base bar the conditions are checked. When step 1 holds, a <T>Candidate</T> starts and waits for step 2; when the last step completes, the Candidate becomes a <T>Signal</T> and goes to the Entry. All the conditions inside a step must hold on the same bar. What a step captures (a pattern's top, the Draw on liquidity, a running low) can be read by the steps after it and by the Entry and stop.</div>
      <div><T>When a Candidate ends without a Signal:</T> a limit on the next step runs out (too many bars, past its clock time), its invalidation happens, or the Trading day ends at 18:00 NY. A Candidate that completes outside the Trading window gives no Signal.</div>
      <div><T>On a new first step while one is running: {title}.</T> {text}</div>
      <details className="text-[11px]"><summary className="cursor-pointer hover:text-foreground">compare the three, and how to read the counts</summary>
        <ul className="mt-1 space-y-1 pl-3">{Object.entries(NEW_START).map(([k, [l, t]]) => <li key={k} className={cn(k === br?.on_new_start && 'text-foreground')}><b>{l}</b>: {t}</li>)}</ul>
        <div className="mt-1.5">Each step shows two counts on the MNQ bars: <T>held alone</T> is how many bars its conditions were true on their own, ignoring the steps before it; <T>completed</T> is how many times it actually completed inside a Candidate. A step that holds often but rarely completes is waiting on the step before it.</div>
      </details>
    </HelpBox>
  );
}
/** one step's Sequence limits, in words */
export function limitsSentence(step: Step, isFirst: boolean, labels: Record<string, string>) {
  const parts: string[] = [];
  if (isFirst) parts.push('This step starts a Candidate whenever its conditions hold.');
  else {
    const when = step.same_bar ? (step.within_bars === 0 ? 'on the same bar as the step before, and only then' : 'on the same bar as the step before or on any later bar') : 'on a later bar than the step before (never the same one)';
    parts.push(`This step can complete ${when}${step.within_bars ? `, at most ${step.within_bars} Base bars after it` : ''}${step.until ? `, and no later than ${step.until} NY` : ''}.`);
    if (step.within_bars || step.until) parts.push('If that limit passes first, the Candidate ends.');
  }
  if (step.invalidate) parts.push(`While it waits, the Candidate ends as soon as ${condPhrase(step.invalidate, labels) || '(the invalidation is still empty)'}.`);
  if (step.capture_running) parts.push(`From the bar it completes, it keeps the running ${step.capture_running.field === 'low' ? 'lowest low' : 'highest high'} until the next step completes, readable as ${step.capture_running.name}.${step.capture_running.field}${isFirst ? ' (on a "For at least N bars" step it starts from the first bar of the run)' : ''}.`);
  return parts.join(' ');
}
export function StepLimits({ step, onChange, isFirst, ctx, side, look }: { step: Step; onChange: (s: Step) => void; isFirst: boolean; ctx: TokenCtx; side: 'long' | 'short'; look: Look }) {
  return (
    <div className="space-y-1.5">
    <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Sequence limits</div>
    <HelpBox id="steps:limits">
      <div>{limitsSentence(step, isFirst, ctx.labels)}</div>
      <details className="text-[11px]"><summary className="cursor-pointer hover:text-foreground">what each control means</summary>
        <ul className="mt-1 space-y-1 pl-3">
          <li><b>may complete on the same bar</b>: off, the step waits at least one Base bar after the step before; on, both can happen on one bar (with "within 0 bars", only on that bar).</li>
          <li><b>within N bars</b>: the step must complete at most N Base bars after the step before, or the Candidate ends. Empty means no limit.</li>
          <li><b>until hh:mm</b>: the step must complete before this New York time, or the Candidate ends.</li>
          <li><b>capture running</b>: keeps the lowest low (or highest high) from this step until the next one completes, under a name later steps and the stop can read, e.g. a pullback low.</li>
          <li><b>invalidation</b>: a condition that, if it holds while the Candidate waits for this step, ends the Candidate.</li>
        </ul>
      </details>
    </HelpBox>
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
    </div>
  );
}

// ---------- Entry block ----------
export function EntryEditor({ setup, mutate, bi, ctx, result, data }: { setup: Setup; mutate: Mutate; bi: number; ctx: TokenCtx; result?: RunResult; data?: Data }) {
  const e = setup.branches[bi].entry;
  const set = (fn: (e: Setup['branches'][0]['entry']) => void) => mutate((s) => fn(s.branches[bi].entry));
  return (
    <div className="space-y-2">
      {data && <EntryHelp setup={setup} bi={bi} result={result} data={data} />}
      <Field label="Order">
        <Select value={e.order} onChange={(v) => set((x) => { x.order = v; })} options={[['market', "market (next Base bar's open)"], ['limit', 'limit'], ['stop', 'stop entry']]} />
        {e.order !== 'market' && <><span className="text-xs text-muted-foreground">at</span><TokenPicker value={e.price || ''} ctx={ctx} onChange={(v) => set((x) => { x.price = v; })} /></>}
      </Field>
      <StopEditor value={e.stop} onChange={(v) => set((x) => { x.stop = v; })} ctx={ctx} />
    </div>
  );
}
const ORDER_HELP: Record<string, (long: boolean) => string> = {
  market: () => "Market: fills at the open of the next Base bar after the Signal. You are always in, at whatever price the market gives.",
  limit: (long) => `Limit: rests at the price and fills only if price comes back to it (${long ? 'trades at or below it' : 'trades at or above it'}). A better price, but it may never fill; the Entry deadline in Trade settings decides how long it waits.`,
  stop: (long) => `Stop entry: fills once price trades through the price in the Trade's direction (${long ? 'at or above it' : 'at or below it'}). It waits for the move to confirm, at a worse price than a limit.`,
};
/** what the Entry block does, then this branch's numbers on its latest Signal */
function EntryHelp_({ setup, bi, result, data }: { setup: Setup; bi: number; result?: RunResult; data?: Data }) {
  const br = setup.branches[bi], e = br.entry, long = br.side === 'long';
  const labels = labelsOf(setup);
  const sig = result?.signals.filter((x) => x.branch === bi && !x.refused).slice(-1)[0];
  const B = (x: React.ReactNode) => <b className="text-foreground">{x}</b>;
  const when = sig && data ? new Date((chartTime(data.m1[sig.i].t) + 60) * 1000).toISOString() : '';
  const contracts = sig ? sig.legs.reduce((a, l) => a + l.contracts, 0) : 0;
  return (
    <HelpBox>
      <div><span className="font-medium text-foreground">Order.</span> {ORDER_HELP[e.order](long)}</div>
      <div><span className="font-medium text-foreground">Stop.</span> Placed {long ? 'below' : 'above'} a level the Setup reads (a captured low or high, a pattern edge…) by an offset: in ticks (on MNQ a tick is 0.25 points) or in × ATR, so it widens when the market is more volatile. The distance from the entry to the stop is the risk, 1R: it sizes the contracts and sets R-multiple take profits. An Entry cannot be saved without a stop.</div>
      <div>Here: {e.order === 'market' ? B('at market') : <>a {B(e.order === 'limit' ? 'limit' : 'stop entry')} at {B(phrase(e.price || '?', labels))}</>}, stop {B(`${e.stop.offset} ${e.stop.unit === 'atr' ? '× ' + phrase(e.stop.atr || 'the ATR', labels) : e.stop.offset === 1 ? 'tick' : 'ticks'}`)} {long ? 'below' : 'above'} {B(phrase(e.stop.token || '?', labels))}{e.stop.unit === 'ticks' ? ` (${(e.stop.offset * 0.25).toFixed(2)} points)` : ''}.
        {sig && data && <> On its latest Signal ({when.slice(5, 10)} {when.slice(11, 16)} NY): entry {B(sig.entry.toFixed(2))}, stop {B(sig.stop.toFixed(2))}, so {B(`${Math.abs(sig.entry - sig.stop).toFixed(2)} points`)} of risk and {B(`${contracts} contract${contracts === 1 ? '' : 's'}`)}.</>}
        {!sig && result && <> No Signal of this branch was traded on these bars yet.</>}
      </div>
    </HelpBox>
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
    case 'break_even': return v.trigger === 'off' ? 'off' : v.trigger === 'after_leg' ? `after TP${v.k}, +${v.offset_ticks} ticks` : `at +${v.r}R, +${v.offset_ticks} ticks`;
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
        <div className="flex items-center gap-2"><Button size="sm" variant="ghost" onClick={() => onChange({ ...value, legs: [...value.legs, { name: `TP${value.legs.length + 1}`, rule: 'r', r: 3, share: 0 }] })}>+ take profit</Button>
          <span className="text-xs text-muted-foreground">leftover contracts to the</span><Select value={value.leftover} onChange={(v) => onChange({ ...value, leftover: v })} options={[['first', 'first take profits'], ['last', 'last take profits']]} className="h-7" /></div>
      </div>
    );
    case 'break_even': return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Select value={value.trigger} onChange={(t) => onChange({ ...value, trigger: t, k: value.k ?? 1, r: value.r ?? 1 })} options={[['off', 'off'], ['after_leg', 'after take profit k fills'], ['at_r', 'once price reaches +X R']]} />
        {value.trigger === 'after_leg' && <>k <NumInput value={value.k} onChange={(n) => onChange({ ...value, k: n })} className="w-14" /></>}
        {value.trigger === 'at_r' && <>X <NumInput step={0.25} value={value.r} onChange={(n) => onChange({ ...value, r: n })} className="w-14" />R</>}
        {value.trigger !== 'off' && <>offset <NumInput value={value.offset_ticks} onChange={(n) => onChange({ ...value, offset_ticks: n })} className="w-14" /> ticks</>}
      </div>
    );
    case 'entry_deadline': return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone="outline">mandatory</Badge>
        <Select value={value.entry_deadline.kind} onChange={(kk) => onChange({ ...value, entry_deadline: { kind: kk, value: kk === 'clock' ? '11:00' : kk === 'bars' ? '3' : '' } })} options={[['clock', 'a NY clock time'], ['bars', 'N Base bars after the Signal'], ['end_of_hours', 'end of Trading window'], ['end_of_day', 'end of the Trading day']]} />
        {(value.entry_deadline.kind === 'clock' || value.entry_deadline.kind === 'bars') && <Input value={value.entry_deadline.value} onChange={(e) => onChange({ ...value, entry_deadline: { ...value.entry_deadline, value: e.target.value } })} className="w-16" />}
        <span className="text-xs text-muted-foreground">cancel if reached first:</span>
        {(['stop', 'first_leg', 'draw'] as const).map((c) => <label key={c} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={value.cancel_if.includes(c)} onChange={(e) => onChange({ ...value, cancel_if: e.target.checked ? [...value.cancel_if, c] : value.cancel_if.filter((x: string) => x !== c) })} />{(c === 'first_leg' ? 'first take profit' : c)}</label>)}
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
  legs: "The Trade can be closed in parts, each part with its own take profit (TP1, TP2…). R multiple: entry ± k × the stop distance. Level ± ticks: a price the Setup reads, e.g. the Draw on liquidity, stopping N ticks short so it fills before the level. Fraction: that part of the way from the entry to a level. Share: the part of the contracts each take profit closes; contracts that don't divide evenly go to the first or the last take profits.",
  break_even: 'Moves the stop to the entry (plus an offset in ticks, toward profit) so the rest of the Trade can no longer lose. After take profit k: once TP k has filled. At +X R: once price first reaches X times the stop distance in profit. The stop only ever moves toward profit.',
  entry_deadline: "How long a limit or stop entry may wait for its fill; after that it is cancelled. A market entry fills at the next bar's open and ignores the deadline. \"Cancel if reached first\": if price touches the stop, the first take profit or the Draw on liquidity before filling, the entry is cancelled, because the move already happened without you.",
  expiry_and_flatten: 'Exit open Trades at (optional): any Trade still open at this New York time is closed at market. Flatten time (mandatory): the hard end of the day for this Setup; every position still open is closed at market, whatever its take profits and stop.',
  signal_guards: "Last checks on a Signal before any order. A refused Signal is logged with its reason and opens no Trade. Max stop: refuse when the stop is wider than N ticks or N × ATR (checked before sizing). Min reward:risk: refuse when the take profits' average reward, weighted by contracts, divided by the risk is below N.",
  in_position: "Checked at every Base-bar close while a Trade is open. When a rule holds, its action runs at the next bar's open: close the whole Trade, close one take profit, move the stop, or cancel an entry still waiting. Each rule belongs to a branch, and a Run cannot override them.",
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
      return <>Here, with {B(n)} contract{n === 1 ? '' : 's'} (a 20-point stop): {ts.legs.map((l, i) => <span key={i}>{i > 0 && ', '}{B(`${l.name} ×${sp[i]}`)} {l.rule === 'r' ? `at ${l.r}R, ${((l.r || 0) * stopPts).toFixed(0)} points away` : l.rule === 'fraction' ? `${Math.round((l.fraction || 0) * 100)}% of the way to the level` : `${l.offset_ticks || 0} tick${(l.offset_ticks || 0) === 1 ? '' : 's'} before the level`}</span>)}.{sp.some((x) => x === 0) ? ' A take profit with 0 contracts is skipped.' : ''}</>;
    }
    case 'break_even': {
      const be = ts.break_even, off = be.offset_ticks ? ` + ${be.offset_ticks} ticks` : '';
      if (be.trigger === 'off') return <>Here: {B('off')}; the stop stays where it was placed.</>;
      if (be.trigger === 'after_leg') return <>Here: when {B(ts.legs[(be.k || 1) - 1]?.name || `TP${be.k}`)} fills, the stop moves to the entry{off}.</>;
      return <>Here: once price is {B(`+${be.r}R`)} ({((be.r || 1) * stopPts).toFixed(0)} points with a 20-point stop), the stop moves to the entry{off}.</>;
    }
    case 'entry_deadline': {
      const d = ts.entry_deadline;
      const wait = d.kind === 'clock' ? `until ${d.value} NY` : d.kind === 'bars' ? `${d.value} Base bars (${Number(d.value) * tfMinutes(setup.settings.base_bar)} minutes)` : d.kind === 'end_of_hours' ? 'until the Trading window ends' : 'until the Trading day ends';
      return <>Here: the entry waits {B(wait)}{ts.cancel_if.length ? <>, and is cancelled earlier if the {B(ts.cancel_if.map((c) => (c === 'first_leg' ? 'first take profit' : c)).join(' or '))} is reached first</> : ''}.{setup.branches.every((b) => b.entry.order === 'market') ? ' This Setup enters at market, so the deadline never comes into play.' : ''}</>;
    }
    case 'expiry_and_flatten': return <>Here: {ts.expiry ? <>Trades still open at {B(ts.expiry)} are closed, and </> : ''}everything is flat by {B(ts.flatten_time)} NY.</>;
    case 'signal_guards': return ts.signal_guards.length
      ? <>Here: {ts.signal_guards.map((g, i) => <span key={i}>{i > 0 && '; '}{B(g.kind === 'max_stop' ? `stop ≤ ${g.n} ${g.unit === 'atr' ? '× ATR' : 'ticks'}` : `reward:risk ≥ ${g.n}`)}{g.kind === 'max_stop' && g.unit !== 'atr' ? ` (${(g.n * 0.25).toFixed(2)} points)` : g.kind === 'min_rr' ? ` (a 20-point stop needs ${(g.n * stopPts).toFixed(0)} points of average reward)` : ''}</span>)}.</>
      : <>Here: {B('no guards')}; every Signal that can be sized is traded.</>;
    case 'in_position': return <>Here: {B(`${setup.in_position_rules.length} rule${setup.in_position_rules.length === 1 ? '' : 's'}`)}.</>;
    default: return null;
  }
}
function SectionHelp_({ setup, k }: { setup: Setup; k: SectionKey | 'in_position' }) {
  return (
    <HelpBox className="mb-2">
      <div>{SECTION_HELP[k]}</div><div>{sectionExample(setup, k)}</div>
    </HelpBox>
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
              <Select value={r.action} onChange={(a) => mutate((s) => { s.in_position_rules[i].action = a; })} options={[['close_trade', 'close the Trade'], ['close_leg', 'close take profit k'], ['move_stop', 'move stop (tighten only)'], ['cancel_entry', 'cancel the resting entry']]} className="h-7" />
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

export const BasicsHelp = withHelpId(BasicsHelp_, (p: any) => 'general:' + p.what);
export const WhenHelp = withHelpId(WhenHelp_, (p: any) => 'when:' + p.what);
export const BehaviourHelp = withHelpId(BehaviourHelp_, () => 'when:behaviour');
export const SignalStepsHelp = withHelpId(SignalStepsHelp_, () => 'steps:how');
export const ReviewHelp = withHelpId(ReviewHelp_, (p: any) => 'review:' + p.what);
export const RunHelp = withHelpId(RunHelp_, (p: any) => 'run:' + p.what);
export const IndicatorsHelp = withHelpId(IndicatorsHelp_, () => 'indicators');
export const PatternsHelp = withHelpId(PatternsHelp_, () => 'patterns');
export const IndicatorsPatternsIntro = withHelpId(IndicatorsPatternsIntro_, () => 'indpat:intro');
export const EntryHelp = withHelpId(EntryHelp_, () => 'entry');
export const SectionHelp = withHelpId(SectionHelp_, (p: any) => 'trade:' + p.k);
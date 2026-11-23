// PROTOTYPE variant B, "Document": the Setup is edited as its own Rule description. One scrolling page, top to bottom,
// every token a chip you click to change. Indicators are declared on first use. Free text goes through the phrase grammar
// (and a stubbed "Claude suggests" for the rest). The chart is pinned on the right and follows the line you point at.
import React, { useState } from 'react';
import { VariantProps } from '../types';
import { SetupMap } from '../components/SetupMap';
import { Hideable } from '../components/help';
import { IndicatorIcon, SectionIcon } from '../components/PatternIcon';
import { Chart, StepStats, RunSummary } from '../components/Chart';
import { CondEditor, tokenCtx } from '../components/CondEditor';
import { StepLimits, EntryEditor, SECTIONS, SectionEditor, getSection, setSection, sectionSummary, InPositionRules, indicatorUsage, SectionKey, PatternList, Explain, BehaviourHelp, BasicsHelp, WhenHelp, SessionsEditor, SignalStepsHelp, limitsSentence, SectionHelp, IndicatorsHelp, PatternsHelp, ReviewHelp, RunHelp, IndicatorsPatternsIntro, indHelp } from '../components/sections';
import { RuleEditor, appendAnd } from '../components/RuleEditor';
import { TokenCtx, shortName } from '../components/TokenPicker';
import { Badge, Button, Card, Input, Select, STEP_COLORS, cn, NumInput } from '../components/ui';
import { Cond, Setup, TFS, TF, uid, SECTION_NAMES, validate, Step, labelsOf, ruleDescription } from '../model';
import { useRunDraft, INSTRUMENTS, instrumentWarnings } from '../runDraft';

export function VariantB(p: VariantProps) {
  const { setup, mutate, data, result } = p;
  const [runMode, setRunMode] = useState(false);
  const runD = useRunDraft(data, setup);
  const declare = (tok: string) => mutate((s) => { if (!s.indicators.some((i) => i.token === tok)) s.indicators.push({ token: tok }); });
  const ctxFor = (bi: number, k: number): TokenCtx => tokenCtx(setup, bi, k, { inlineDeclare: true, onDeclare: declare });
  const th = setup.settings.trading_hours;
  const issues = validate(setup);
  const usage = indicatorUsage(setup);

  return (
    <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-6 p-3 lg:grid-cols-[minmax(0,1fr)_560px] lg:p-6">
      <Card className="min-w-0 p-4 lg:col-span-2">
        <div className="mb-3"><div className="text-[15px] font-semibold tracking-tight">Setup at a glance</div><div className="text-xs text-muted-foreground">The document below, as a flow. Click a step to jump to its sentence.</div></div>
        <div className="mb-2"><ReviewHelp setup={setup} what="map" /></div>
        <SetupMap setup={setup} result={result} data={data} focus={p.focus} compact onStep={(f) => { p.setFocus(f); document.getElementById(`step-${setup.branches[f.bi].steps[f.si].id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} />
      </Card>
      <article className="min-w-0 space-y-6 leading-relaxed">
        <header className="space-y-2">
          <Input value={setup.name} onChange={(e) => mutate((s) => { s.name = e.target.value; })} className="h-auto border-transparent bg-transparent px-0 text-3xl font-bold" />
          <p className="text-[15px]">
            Evaluated at every close of the{' '}
            <InlineSelect value={setup.settings.base_bar} onChange={(v: TF) => mutate((s) => { s.settings.base_bar = v; })} options={TFS.filter((t) => t !== '1d')} />{' '}
            bar. Signals are taken {th.ranges.map((r, k) => (
              <span key={k}>{k > 0 && ' or '}between <InlineInput value={r.start} onChange={(v) => mutate((s) => { s.settings.trading_hours.ranges[k].start = v; })} /> and <InlineInput value={r.end} onChange={(v) => mutate((s) => { s.settings.trading_hours.ranges[k].end = v; })} /></span>
            ))} New York time <button className="mx-1 inline-flex h-6 items-center gap-1 rounded-md border border-input px-2 align-middle text-xs font-medium text-sky-200 hover:bg-accent" onClick={() => mutate((s) => { s.settings.trading_hours.ranges.push({ start: '14:00', end: '15:00' }); })}><span aria-hidden="true">+</span>Add range</button>, on {th.weekdays.length === 7 ? 'every day' : th.weekdays.length === 5 && !th.weekdays.includes(0) && !th.weekdays.includes(6) ? 'weekdays' : th.weekdays.map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}.
            {Object.entries(th.overrides || {}).map(([d, rs]) => (
              <span key={d}>{' '}On {['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][Number(d)]}, {rs.length ? rs.map((r, k) => (
                <span key={k}>{k > 0 && ' or '}between <InlineInput value={r.start} onChange={(v) => mutate((s) => { s.settings.trading_hours.overrides![d][k].start = v; })} /> and <InlineInput value={r.end} onChange={(v) => mutate((s) => { s.settings.trading_hours.overrides![d][k].end = v; })} /></span>
              )) : 'all day'} instead <button className="mx-1 inline-flex h-6 items-center rounded-full border border-input px-2 align-middle text-xs text-muted-foreground hover:bg-accent" onClick={() => mutate((s) => { delete s.settings.trading_hours.overrides![d]; })}>use the usual hours</button>.</span>
            ))}
            {[0, 1, 2, 3, 4, 5, 6].some((d) => !(String(d) in (th.overrides || {}))) && (
              <select value="" onChange={(e) => { const d = e.target.value; if (d) mutate((s) => { s.settings.trading_hours.overrides = { ...(s.settings.trading_hours.overrides || {}), [d]: structuredClone(s.settings.trading_hours.ranges) }; if (!s.settings.trading_hours.weekdays.includes(Number(d))) s.settings.trading_hours.weekdays = [...s.settings.trading_hours.weekdays, Number(d)].sort(); }); }} className="mx-1 rounded border-b border-dashed border-sky-400 bg-transparent px-0.5 align-middle text-xs text-sky-200 outline-none">
                <option value="" className="bg-card">+ different hours on a day…</option>
                {[0, 1, 2, 3, 4, 5, 6].filter((d) => !(String(d) in (th.overrides || {}))).map((d) => <option key={d} value={String(d)} className="bg-card">{['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][d]}</option>)}
              </select>
            )}
            {' '}While a Signal is live,{' '}
            <InlineSelect value={setup.settings.one_at_a_time} onChange={(v) => mutate((s) => { s.settings.one_at_a_time = v; })} options={[['off', 'overlap is allowed'], ['ignore_new_starts', 'the Setup waits for the Trade to end'], ['skip_completions', 'Signals during the Trade are skipped']]} />.
            {' '}Around news:{' '}
            <InlineSelect value={setup.settings.news_rule.mode} onChange={(v) => mutate((s) => { s.settings.news_rule.mode = v; if (v === 'span') { s.settings.news_rule.before ??= 30; s.settings.news_rule.after ??= 30; } })} options={[['off', 'trade through the news'], ['whole_day', 'skip the whole News day'], ['span', `skip ${setup.settings.news_rule.before ?? 30} min before a release`]]} />.
          </p>
          <p className="text-xs text-muted-foreground">Market sessions used by levels: {Object.entries(setup.settings.sessions).map(([n, r]) => `${n.replace('_', ' ')} ${r.start}–${r.end}`).join(' · ')} (copied into the Setup).</p>
          <Explain>
            <BasicsHelp setup={setup} what="intro" />
            <BasicsHelp setup={setup} what="name" />
            <BasicsHelp setup={setup} what="base_bar" />
            <div className="pt-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">When to trade</div>
            <WhenHelp setup={setup} what="intro" />
            <WhenHelp setup={setup} what="hours" />
            <BehaviourHelp setup={setup} />
            <SessionsEditor setup={setup} mutate={mutate} />
            <WhenHelp setup={setup} what="sessions" />
          </Explain>
        </header>

        {setup.branches.map((br, bi) => (
          <section key={br.id} className="space-y-3">
            <h2 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xl font-semibold"><span className="whitespace-nowrap">{br.side === 'long' ? 'Going long' : 'Going short'}</span>
              <span className="flex w-full flex-wrap items-center gap-x-2 sm:w-auto"><span className="text-xs font-normal text-muted-foreground">a new first step while one runs:</span>
              <InlineSelect value={br.on_new_start} onChange={(v) => mutate((s) => { s.branches[bi].on_new_start = v; })} options={[['start_another', 'starts another'], ['replace', 'replaces it'], ['ignore', 'is ignored']]} /></span>
              {setup.branches.length > 1 && <button className="ml-auto text-xs text-muted-foreground hover:text-red-400" onClick={() => mutate((s) => { s.branches.splice(bi, 1); })}>remove branch</button>}
            </h2>
            {bi === 0 ? <SignalStepsHelp setup={setup} bi={bi} /> : <Explain label="how steps work"><SignalStepsHelp setup={setup} bi={bi} /></Explain>}
            {br.steps.map((st, k) => (
              <div key={st.id} id={`step-${st.id}`} onMouseEnter={() => p.setFocus({ bi, si: k })} className={cn('group relative rounded-md border-l-4 py-1 pl-4', p.focus?.bi === bi && p.focus?.si === k ? 'bg-accent/40' : '')} style={{ borderColor: STEP_COLORS[k % 6] }}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[15px] font-semibold">{k === 0 ? 'First,' : st.same_bar ? 'Then, on the same bar or later,' : 'Then, on a later bar,'}</span>
                  <Input value={st.name} onChange={(e) => mutate((s) => { s.branches[bi].steps[k].name = e.target.value; })} className="h-6 min-w-0 flex-1 basis-[12rem] border-transparent bg-transparent px-0 text-[15px] italic text-muted-foreground sm:w-auto sm:min-w-[200px] sm:flex-none sm:basis-auto" />
                  <span className="w-full sm:w-auto"><StepStats result={result} bi={bi} si={k} data={data} /></span>
                </div>
                <div className="text-[15px]">
                  <RuleEditor cond={st.cond} keyword={k === 0 ? 'IF' : 'THEN'} ctx={ctxFor(bi, k)} side={br.side} onChange={(c) => mutate((s) => { s.branches[bi].steps[k].cond = c; })} />
                  <PhraseInput ctx={ctxFor(bi, k)} onAdd={(c, toks) => mutate((s) => { s.branches[bi].steps[k].cond = appendAnd(s.branches[bi].steps[k].cond, c); for (const t of toks) if (!s.indicators.some((i) => i.token === t)) s.indicators.push({ token: t }); })} />
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{limitsSentence(st, k === 0, labelsOf(setup))}</div>
                <details className="mt-1 text-xs"><summary className="cursor-pointer text-muted-foreground">limits, captures and invalidation</summary>
                  <div className="mt-1"><StepLimits step={st} isFirst={k === 0} ctx={ctxFor(bi, k)} side={br.side} look="outline" onChange={(n: Step) => mutate((s) => { s.branches[bi].steps[k] = n; })} /></div></details>
                <button className="absolute right-0 top-1 hidden text-xs text-muted-foreground hover:text-red-400 group-hover:block" onClick={() => mutate((s) => { s.branches[bi].steps.splice(k, 1); })}>delete step</button>
              </div>
            ))}
            <button className="text-sm text-sky-300" onClick={() => mutate((s) => { s.branches[bi].steps.push({ id: uid('st'), name: 'what this step is', cond: { id: uid(), t: 'all', items: [] } }); })}>+ Then…</button>
            <div className="rounded-md border-l-4 border-slate-400 py-1 pl-4">
              <div className="text-lg font-bold text-emerald-300">→ Then enter.</div>
              <EntryEditor result={result} data={data} setup={setup} mutate={mutate} bi={bi} ctx={ctxFor(bi, br.steps.length)} />
            </div>
          </section>
        ))}

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Managing the Trade</h2>
          {SECTIONS.filter((k) => k !== 'stop').map((k) => (
            <div key={k} className="grid grid-cols-1 items-start gap-1 sm:grid-cols-[150px_1fr] sm:gap-3">
              <div className="flex items-center gap-1.5 pt-1 text-sm font-medium text-muted-foreground"><SectionIcon k={k} size={18} />{SECTION_NAMES[k]}</div>
              <div className="space-y-1"><SectionHelp setup={setup} k={k} /><SectionEditor k={k} value={getSection(setup, k)} setup={setup} ctx={ctxFor(0, 99)} onChange={(v) => mutate((s) => { setSection(s, k, v); })} /></div>
            </div>
          ))}
          <div className="grid grid-cols-1 items-start gap-1 sm:grid-cols-[150px_1fr] sm:gap-3"><div className="flex items-center gap-1.5 pt-1 text-sm font-medium text-muted-foreground"><SectionIcon k="in_position" size={18} />While in a Trade</div><div className="space-y-1"><SectionHelp setup={setup} k="in_position" /><InPositionRules setup={setup} mutate={mutate} ctx={ctxFor(0, 99)} look="outline" /></div></div>
        </section>
        <section className="space-y-1">
          <h2 className="text-xl font-semibold">Notes</h2>
          <textarea value={setup.notes} onChange={(e) => mutate((s) => { s.notes = e.target.value; })} placeholder="Free text. Never part of the Rule description or the hash." className="h-20 w-full rounded-md border border-input bg-transparent p-2 text-sm" />
          <Explain><BasicsHelp setup={setup} what="notes" /></Explain>
        </section>
      </article>

      <aside className="min-w-0 space-y-3 lg:sticky lg:top-16 lg:h-[calc(100vh-6rem)] lg:overflow-auto">
        <Card className="p-3">
          <div className="mb-2 flex items-center justify-between"><RunSummary result={runMode && runD.result ? runD.result : result} data={data} /></div>
          <Chart data={data} setup={setup} result={runMode && runD.result ? runD.result : result} day={p.day} setDay={p.setDay} focus={p.focus} selected={p.selected} setSelected={p.setSelected} height={300} />
          <div className="mt-1 text-[11px] text-muted-foreground">Point at a step to see it on the chart: coloured dots = it completed, grey squares = it held on its own.</div>
          <div className="mt-1"><ReviewHelp setup={setup} what="chart" result={runMode && runD.result ? runD.result : result} /></div>
        </Card>
        <Card className="p-3">
          <div className="mb-1 text-sm font-semibold">Indicators in this Setup</div>
          <div className="mb-1 text-[11px] text-muted-foreground">Declared the first time a step reads them. Give one a label and the description uses it.</div>
          <div className="mb-2 space-y-2"><IndicatorsPatternsIntro /><IndicatorsHelp setup={setup} /></div>
          {setup.indicators.length === 0 && <div className="text-xs italic text-muted-foreground">none yet</div>}
          {setup.indicators.map((ind, k) => (
            <div key={ind.token} className="mb-1.5 rounded-md border border-border/60 p-2 sm:mb-0 sm:border-0 sm:p-0">
            <div className="flex flex-wrap items-center gap-2 py-0.5 text-xs sm:flex-nowrap">
              <IndicatorIcon token={ind.token} size={18} /><span className="mono min-w-0 flex-1 sm:w-36 sm:flex-none sm:truncate" title={ind.token}>{shortName(ind.token, {})}</span>
              <Input value={ind.label || ''} placeholder="label" onChange={(e) => mutate((s) => { s.indicators[k].label = e.target.value || undefined; })} className="order-last h-7 min-w-0 basis-full sm:order-none sm:h-6 sm:flex-1 sm:basis-0" />
              <span className={cn('whitespace-nowrap text-right sm:w-14', usage[ind.token] ? 'text-muted-foreground' : 'text-amber-300')}>{usage[ind.token] ? `used ${usage[ind.token]}×` : 'unused'}</span>
            </div>
            {indHelp(ind.token) && <Hideable id="indicators:each" className="mt-1 text-[11px] text-muted-foreground sm:-mt-0.5 sm:mb-1 sm:pl-6">{indHelp(ind.token)}</Hideable>}
            </div>
          ))}
        </Card>
        <Card className="p-3">
          <div className="mb-1 text-sm font-semibold">Patterns in this Setup</div>
          <div className="mb-1 text-[11px] text-muted-foreground">Declared up front, then used by name in a sentence ("a bullish fvg forms").</div>
          <div className="mb-2"><PatternsHelp setup={setup} /></div>
          <PatternList setup={setup} mutate={mutate} compact data={data} />
        </Card>
        <Card className="p-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="text-sm font-semibold">Review & save</div>{p.saveBar}</div>
          {issues.map((i, k) => <div key={k} className={cn('mt-1 text-xs', i.level === 'error' ? 'text-red-300' : 'text-amber-300')}>{i.where}: {i.text}</div>)}
          <div className="mt-2 space-y-2"><ReviewHelp setup={setup} what="checks" issues={issues} /><ReviewHelp setup={setup} what="save" />
            <details className="text-xs"><summary className="cursor-pointer font-medium text-foreground">Rule description (stored at Freeze)</summary>
              <div className="mt-1 space-y-1.5"><ReviewHelp setup={setup} what="rule" /><pre className="mono whitespace-pre-wrap rounded-md bg-muted p-2 text-[11px]">{ruleDescription(setup)}</pre></div></details></div>
        </Card>
        <Card className="p-3">
          <div className="flex items-center justify-between"><div className="text-sm font-semibold">Try it as a Run</div><Button size="sm" variant={runMode ? 'default' : 'outline'} onClick={() => setRunMode(!runMode)}>{runMode ? 'Close Run' : 'Create a Run…'}</Button></div>
          {runMode && <div className="mt-2 space-y-2"><RunHelp setup={setup} what="intro" /><RunHelp setup={setup} what="instrument" instrument={runD.draft.instrument} /><RunHelp setup={setup} what="overrides" overrides={Object.keys(runD.draft.overrides).length} /></div>}
          {runMode && <RunDiff setup={setup} runD={runD} ctx={ctxFor(0, 99)} base={result} data={data} />}
        </Card>
      </aside>
    </div>
  );
}

function RunDiff({ setup, runD, ctx, base, data }: { setup: Setup; runD: ReturnType<typeof useRunDraft>; ctx: TokenCtx; base: any; data: any }) {
  const [editing, setEditing] = useState<SectionKey | null>(null);
  return (
    <div className="mt-2 space-y-2 text-xs">
      <div className="flex items-center gap-2">on <Select value={runD.draft.instrument} onChange={(v) => runD.setDraft({ ...runD.draft, instrument: v })} options={INSTRUMENTS} className="h-7" /></div>
      {instrumentWarnings(setup, runD.draft.instrument).map((w) => <div key={w} className="text-amber-300">{w}</div>)}
      <div className="space-y-1.5 sm:hidden">
        {SECTIONS.map((k) => {
          const on = k in runD.draft.overrides;
          return (
            <div key={k} className={cn('rounded-md border p-2', on && 'border-sky-500/40 bg-sky-500/5')}>
              <div className="flex items-center gap-2 font-medium"><SectionIcon k={k} size={16} />{SECTION_NAMES[k]}
                <span className="ml-auto flex gap-1.5">{on && <button className="h-7 rounded-md border border-input px-2 font-normal text-muted-foreground" onClick={() => { runD.override(k, false); setEditing(null); }}>reset</button>}<button className="h-7 rounded-md border border-sky-500/40 px-2 font-normal text-sky-300" onClick={() => { if (!on) runD.override(k, true); setEditing(editing === k ? null : k); }}>{on ? (editing === k ? 'done' : 'edit') : 'override'}</button></span></div>
              <div className={cn('mt-1', on ? 'text-red-300/80 line-through' : 'text-muted-foreground')}>{sectionSummary(setup, k)}</div>
              {on && <div className="mt-0.5 text-emerald-300">→ {sectionSummary(runD.effective, k)}</div>}
              {editing === k && on && <div className="mt-2 rounded-md border p-2"><SectionEditor k={k} value={runD.draft.overrides[k]} setup={setup} ctx={ctx} onChange={(v) => runD.setOverride(k, v)} /></div>}
            </div>
          );
        })}
        <div className="rounded-md border p-2 text-muted-foreground">🔒 Signal steps and While in a Trade are part of the Setup version.</div>
      </div>
      <table className="hidden w-full sm:table">
        <thead><tr className="text-left text-muted-foreground"><th className="py-1">Section</th><th>Setup default</th><th>This Run</th></tr></thead>
        <tbody>
          {SECTIONS.map((k) => {
            const on = k in runD.draft.overrides;
            return (
              <React.Fragment key={k}>
                <tr className={cn('border-t align-top', on && 'bg-sky-500/5')}>
                  <td className="py-1 pr-2 font-medium"><span className="inline-flex items-center gap-1.5"><SectionIcon k={k} size={16} />{SECTION_NAMES[k]}</span></td>
                  <td className={cn('pr-2', on && 'text-red-300/80 line-through')}>{sectionSummary(setup, k)}</td>
                  <td>{on ? <span className="text-emerald-300">{sectionSummary(runD.effective, k)}</span> : <span className="text-muted-foreground">same</span>}
                    <div className="flex gap-2"><button className="text-sky-300" onClick={() => { if (!on) runD.override(k, true); setEditing(editing === k ? null : k); }}>{on ? 'edit' : 'override'}</button>{on && <button className="text-muted-foreground" onClick={() => { runD.override(k, false); setEditing(null); }}>reset</button>}</div></td>
                </tr>
                {editing === k && on && <tr><td colSpan={3} className="pb-2"><div className="rounded-md border p-2"><SectionEditor k={k} value={runD.draft.overrides[k]} setup={setup} ctx={ctx} onChange={(v) => runD.setOverride(k, v)} /></div></td></tr>}
              </React.Fragment>
            );
          })}
          <tr className="border-t text-muted-foreground"><td className="py-1">Signal steps</td><td colSpan={2}>🔒 part of the Setup version</td></tr>
          <tr className="border-t text-muted-foreground"><td className="py-1">While in a Trade</td><td colSpan={2}>🔒 part of the Setup version</td></tr>
        </tbody>
      </table>
      {runD.result && <div className="grid gap-2 sm:grid-cols-2"><div className="rounded-md border p-2"><div className="mb-1 font-medium text-muted-foreground">Setup defaults</div><RunSummary result={base} data={data} /></div><div className="rounded-md border border-sky-500/40 bg-sky-500/5 p-2"><div className="mb-1 font-medium text-sky-300">With this Run's overrides</div><RunSummary result={runD.result} data={data} /></div></div>}
      <div className="text-muted-foreground">Overrides make no new version; the gate judges the defaults.</div>
    </div>
  );
}

function InlineSelect<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: (T | [T, string])[] }) {
  return <select value={value} onChange={(e) => onChange(e.target.value as T)} className="rounded border-b border-dashed border-sky-400 bg-transparent px-0.5 text-sky-200 outline-none">{options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return <option key={v} value={v} className="bg-card">{l}</option>; })}</select>;
}
function InlineInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} className="w-12 border-b border-dashed border-sky-400 bg-transparent text-center text-sky-200 outline-none" />;
}

// ---------- the phrase grammar (a few standard phrases) and a stubbed Claude suggestion ----------
const IND_RE = '(ema|sma|rsi|adx|atr)\\s*\\(?(\\d+)\\)?';
export function parsePhrase(text: string, base: TF): { cond: Cond; tokens: string[] } | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, ' ');
  const tf = (s?: string) => (s && TFS.includes(s as TF) ? s : base) as TF;
  const op = (w: string) => ({ above: '>', over: '>', '>': '>', below: '<', under: '<', '<': '<', 'at or above': '>=', '>=': '>=', 'at or below': '<=', '<=': '<=' } as any)[w];
  let m = new RegExp(`^(?:the )?(?:(\\d+[mhd]) )?(close|open|high|low) (?:is )?(above|below|over|under|>|<) (?:the )?(?:(\\d+[mhd]) )?${IND_RE}$`).exec(t);
  if (m) { const ind = `{{indicator:${m[5]}:${m[6]}:${tf(m[4] || m[1])}}}`; return { cond: { id: uid(), t: 'cmp', a: `{{bar:${m[2]}:${tf(m[1])}}}`, op: op(m[3]), b: ind }, tokens: [ind] }; }
  m = new RegExp(`^(?:the )?(?:(\\d+[mhd]) )?${IND_RE} (?:is )?(above|below|over|under|>|<|>=|<=) (-?\\d+(?:\\.\\d+)?)$`).exec(t);
  if (m) { const ind = `{{indicator:${m[2]}:${m[3]}:${tf(m[1])}}}`; return { cond: { id: uid(), t: 'cmp', a: ind, op: op(m[4]), b: m[5] }, tokens: [ind] }; }
  m = /^(?:the )?(?:(\d+[mhd]) )?macd crosses (above|below) (?:its |the )?signal(?: line)?$/.exec(t);
  if (m) { const a = `{{indicator:macd:12,26,9:${tf(m[1])}}}`, b = `{{indicator:macd:12,26,9:${tf(m[1])}:signal}}`; return { cond: { id: uid(), t: 'cmp', a, op: m[2] === 'above' ? 'crosses_above' : 'crosses_below', b }, tokens: [a, b] }; }
  m = /^(?:the )?(?:(\d+[mhd]) )?(?:candle|bar) (?:is |closes )?(bullish|bearish)$/.exec(t);
  if (m) return { cond: { id: uid(), t: 'cmp', a: `{{bar:dir:${tf(m[1])}}}`, op: '=', b: m[2] }, tokens: [] };
  m = /^(?:between )?(\d{1,2}:\d{2}) ?(?:-|–|to|and) ?(\d{1,2}:\d{2})(?: ny)?$/.exec(t);
  if (m) return { cond: { id: uid(), t: 'time', start: m[1].padStart(5, '0'), end: m[2].padStart(5, '0'), tf: base }, tokens: [] };
  return null;
}
function PhraseInput({ ctx, onAdd }: { ctx: TokenCtx; onAdd: (c: Cond, tokens: string[]) => void }) {
  const [text, setText] = useState('');
  const [suggest, setSuggest] = useState<null | { cond: Cond; tokens: string[] }>(null);
  const parsed = text ? parsePhrase(text, ctx.baseBar) : null;
  const submit = () => {
    if (parsed) { onAdd(parsed.cond, parsed.tokens); setText(''); return; }
    // stub: in the product, Claude proposes tokens and the user confirms before saving
    setSuggest({ cond: { id: uid(), t: 'cmp', a: `{{bar:close:${ctx.baseBar}}}`, op: '>', b: '{{level:prev_day:high}}' }, tokens: [] });
  };
  return (
    <div className="mt-1">
      <div className="flex items-center gap-2">
        <Input value={text} onChange={(e) => { setText(e.target.value); setSuggest(null); }} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder='type a condition, e.g. "15m close above EMA 200", "ADX(14) > 20", "MACD crosses above signal", "10:00-11:00"' className="h-7 flex-1 border-dashed text-xs" />
        {text && (parsed ? <Badge tone="ok">grammar: {parsed.cond.t === 'cmp' ? `${shortName(parsed.cond.a, {})} ${parsed.cond.op} ${shortName(parsed.cond.b, {})}` : 'time range'}</Badge> : <Badge tone="warn">not a standard phrase</Badge>)}
      </div>
      {suggest && (
        <div className="mt-1 rounded-md border border-violet-400/40 bg-violet-500/5 p-2 text-xs">
          <div className="mb-1 text-violet-300">Claude suggests (stub, the real one reads your text):</div>
          <CondEditor cond={suggest.cond} ctx={ctx} side="long" look="outline" onChange={(c) => setSuggest({ ...suggest, cond: c })} />
          <div className="mt-1 flex gap-1"><Button size="sm" onClick={() => { onAdd(suggest.cond, suggest.tokens); setSuggest(null); setText(''); }}>Confirm these tokens</Button><Button size="sm" variant="ghost" onClick={() => setSuggest(null)}>Discard</Button></div>
          <div className="mt-1 text-muted-foreground">A Setup never stores text that hasn't been turned into tokens.</div>
        </div>
      )}
    </div>
  );
}
void NumInput;

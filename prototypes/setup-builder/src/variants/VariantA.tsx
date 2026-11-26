// PROTOTYPE variant A, "Wizard": a fixed order of stages, one thing at a time, the chart always under the stage.
// Order: basics → indicators → when to trade → Signal steps → entry & stop → Trade settings → review → create a Run.
import React, { useState, useEffect, useRef } from 'react';
import { VariantProps } from '../types';
import { SetupMap } from '../components/SetupMap';
import { RuleEditor, StepConfigure } from '../components/RuleEditor';
import { SectionIcon } from '../components/PatternIcon';
import { Chart, StepStats, RunSummary } from '../components/Chart';
import { CondEditor, tokenCtx } from '../components/CondEditor';
import { BaseBarEditor, TradingHoursEditor, SessionsEditor, BehaviourEditor, IndicatorList, PatternList, StepLimits, EntryEditor, SECTIONS, SectionEditor, getSection, sectionSummary, InPositionRules, indicatorUsage, SectionKey, setSection, SectionHelp, SignalStepsHelp, BasicsHelp, RunHelp, ReviewHelp, IndicatorsHelp, PatternsHelp, IndicatorsPatternsIntro, WhenHelp, MirrorNote } from '../components/sections';
import { Badge, Button, Card, CardHeader, Input, Select, Tabs, STEP_COLORS, cn, Field } from '../components/ui';
import { ruleDescription, validate, uid, addMirror, SECTION_NAMES, Step, phrase, labelsOf, patternUsage, stopPhrase } from '../model';
import { useRunDraft, instrumentWarnings } from '../runDraft';
import { InstrumentSelect } from '../components/InstrumentSelect';

const STAGES = ['General', 'Indicators & patterns', 'When to trade', 'Signal steps', 'Entry & stop', 'Trade settings', 'Review & save', 'Create a Run'] as const;

export function VariantA(p: VariantProps & { inline?: boolean }) {
  const { setup, mutate, data, result } = p;
  const inline = !!p.inline;
  const [stage, setStage] = useState(0);
  // phone: the step row scrolls sideways so the current step is in view (never the page)
  const navRow = useRef<HTMLDivElement>(null);
  useEffect(() => { const r = navRow.current, el = r?.querySelector('[data-current]') as HTMLElement | null; if (r && el && r.scrollWidth > r.clientWidth) r.scrollLeft = el.offsetLeft - r.offsetLeft - (r.clientWidth - el.clientWidth) / 2; }, [stage]);
  // B (Inline): no declaring step. Indicators and patterns are created where a step uses them; the ones no step uses any more are removed.
  const declare = (tok: string) => mutate((s) => { if (!s.indicators.some((i) => i.token === tok)) s.indicators.push({ token: tok }); });
  const ctxOf = (b: number, k: number) => (inline ? tokenCtx(setup, b, k, { inlineDeclare: true, onDeclare: declare, inlinePatterns: { setup, mutate, data } }) : tokenCtx(setup, b, k));
  useEffect(() => {
    if (!inline) return;
    const pu = patternUsage(setup), iu = indicatorUsage(setup);
    const deadP = (setup.patterns || []).filter((q) => !pu[q.name]).map((q) => q.name);
    const deadI = setup.indicators.filter((i) => !iu[i.token]).map((i) => i.token);
    if (deadP.length || deadI.length) mutate((s) => { s.patterns = (s.patterns || []).filter((q) => !deadP.includes(q.name)); s.indicators = s.indicators.filter((i) => !deadI.includes(i.token)); });
  }, [inline, setup]);
  const shown = STAGES.map((s, k) => k).filter((k) => !(inline && k === 1));
  const pos = shown.indexOf(stage), prevS = shown[pos - 1], nextS = shown[pos + 1];
  const [bi, setBi] = useState(0);
  const [open, setOpen] = useState(0);
  const issues = validate(setup);
  const stageIssues = (k: number) => issues.filter((i) => (k === 3 ? /step|branch$|Signals/.test(i.where) : k === 4 ? /Entry/.test(i.where) : k === 5 ? /legs|take profit|Flatten|deadline|Trade settings/i.test(i.where) : false));
  const br = setup.branches[bi] || setup.branches[0];
  const runD = useRunDraft(data, setup);
  const chartResult = stage === 7 && runD.result ? runD.result : result;

  return (
    <div className="ctl-lg mx-auto grid max-w-[1400px] grid-cols-1 gap-4 p-3 md:grid-cols-[220px_1fr] md:p-4">
      <nav className="h-fit md:sticky md:top-16">
        <div className="mb-2 px-2 md:mb-3"><div className="text-lg font-semibold">{setup.name}</div><div className="text-xs text-muted-foreground">Draft · Base bar {setup.settings.base_bar}</div></div>
        <div ref={navRow} className="flex gap-1 overflow-x-auto pb-1 md:block md:space-y-0.5 md:overflow-visible md:pb-0">
        {STAGES.map((s, k) => {
          if (!shown.includes(k)) return null;
          const n = stageIssues(k).filter((i) => i.level === 'error').length;
          return (
            <button key={s} onClick={() => setStage(k)} title={s} aria-label={s} data-current={stage === k || undefined} className={cn('flex shrink-0 items-center gap-2 rounded-md py-1.5 text-left text-sm md:w-full md:px-2', stage === k ? 'bg-accent px-2 font-medium' : 'px-1 text-muted-foreground hover:bg-accent/50')}>
              <span className={cn('flex aspect-square h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] leading-none', k < stage && 'border-emerald-500 text-emerald-400', stage === k && 'border-sky-400 text-sky-300')}>{k < stage ? '✓' : shown.indexOf(k) + 1}</span>
              <span className={cn('whitespace-nowrap', stage !== k && 'hidden md:inline')}>{s}</span>{n > 0 && <Badge tone="error" className="md:ml-auto">{n}</Badge>}
            </button>
          );
        })}
        </div>
      </nav>
      <main className="min-w-0 space-y-4">
        <Card>
          <CardHeader title={`${pos + 1}. ${STAGES[stage]}`} sub={inline && stage === 3 ? 'First A, then B: each step is one Sequence link. Add an indicator or a pattern right where you use it, and set it up there.' : SUBS[stage]} right={<div className="flex gap-1"><Button size="sm" variant="outline" disabled={prevS == null} onClick={() => setStage(prevS)}>Back</Button><Button size="sm" disabled={nextS == null} onClick={() => setStage(nextS)}>{nextS != null ? `Next: ${STAGES[nextS]}` : 'Last step'}</Button></div>} />
          <div className="space-y-4 p-4">
            {stage === 0 && (
              <div className="space-y-4">
                <BasicsHelp setup={setup} what="intro" />
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-1.5"><Field label={<><span className="text-base font-bold tracking-tight text-foreground">Name</span></>}><Input value={setup.name} onChange={(e) => mutate((s) => { s.name = e.target.value; })} className="w-full sm:w-64" /></Field><BasicsHelp setup={setup} what="name" /></div>
                  <div className="space-y-1.5"><BaseBarEditor setup={setup} mutate={mutate} /><BasicsHelp setup={setup} what="base_bar" /></div>
                  <div className="space-y-1.5"><Field label={<><span className="text-base font-bold tracking-tight text-foreground">Notes</span></>}><textarea value={setup.notes} onChange={(e) => mutate((s) => { s.notes = e.target.value; })} className="h-16 w-full rounded-md border border-input bg-transparent p-2 text-sm" /></Field><BasicsHelp setup={setup} what="notes" /></div>
                </div>
              </div>
            )}
            {stage === 1 && <div className="space-y-5">
              <IndicatorsPatternsIntro />
              <div><div className="mb-1 text-sm font-semibold">Indicators</div><div className="mb-2"><IndicatorsHelp setup={setup} /></div><IndicatorList setup={setup} mutate={mutate} ctx={ctxOf(0, 0)} usage={indicatorUsage(setup)} /></div>
              <div><div className="mb-1 text-sm font-semibold">Patterns</div><div className="mb-2"><PatternsHelp setup={setup} /></div><PatternList setup={setup} mutate={mutate} data={data} /></div>
            </div>}
            {stage === 2 && <div className="space-y-5">
              <WhenHelp setup={setup} what="intro" />
              <div className="space-y-1.5"><TradingHoursEditor setup={setup} mutate={mutate} /><WhenHelp setup={setup} what="hours" /></div>
              <div className="space-y-1.5"><SessionsEditor setup={setup} mutate={mutate} /><WhenHelp setup={setup} what="sessions" /></div>
              <BehaviourEditor setup={setup} mutate={mutate} />
            </div>}
            {stage === 3 && (
              <div className="space-y-3">
                <SignalStepsHelp setup={setup} bi={bi} />
                {inline && <div className="rounded-md border border-dashed border-sky-500/40 px-2.5 py-1.5 text-xs text-muted-foreground"><span className="font-medium text-foreground">No configuring step here.</span> In a step, <b className="text-foreground">+ add</b> lists every pattern kind: pick one and it's created with default settings, then open its <b className="text-foreground">settings</b> to change them. Click any value to pick an indicator and set its length and timeframe on the spot. One that no step uses any more is removed.</div>}
                <div className="flex flex-wrap items-center gap-2">
                  <Tabs value={String(bi)} onChange={(v) => { setBi(Number(v)); setOpen(0); }} tabs={setup.branches.map((b, k) => [String(k), `${b.side === 'long' ? 'Long' : 'Short'} branch`] as [string, string])} />
                  {setup.branches.length === 1 && <button type="button" className="flex min-h-8 flex-col items-start justify-center py-1 leading-tight rounded-md border border-sky-500/50 bg-sky-500/10 px-3 text-xs font-bold uppercase tracking-wider text-sky-300 transition-colors hover:bg-sky-500/20" onClick={() => mutate((s) => { addMirror(s); })}><span>+ Add a {br.side === 'long' ? 'short' : 'long'} branch</span><span className="text-[10px] font-medium normal-case tracking-normal opacity-80">(mirrored copy of {br.side})</span></button>}
                  <span className="flex w-full items-center justify-between gap-2 sm:ml-auto sm:w-auto sm:justify-end"><span className="text-xs text-muted-foreground">When a new setup appears before the last one finished:</span>
                  <Select value={br.on_new_start} onChange={(v) => mutate((s) => { s.branches[bi].on_new_start = v; })} options={[['start_another', 'Follow both'], ['replace', 'Switch to the new one'], ['ignore', 'Stay with the first one']]} className="h-8 shrink-0" /></span>
                </div>
                {br.mirrored && <MirrorNote side={br.side} onHide={() => mutate((s) => { s.branches[bi].mirrored = false; })} />}
                <ol className="space-y-0">
                  {br.steps.map((st, k) => (
                    <li key={st.id}>
                      {k > 0 && <div aria-hidden="true" className="ml-[1.6rem] h-4 border-l-2 border-dashed" />}
                      <div className={cn('rounded-lg border', open === k && 'border-sky-500/50')}>
                        <div role="button" tabIndex={0} className="flex w-full cursor-pointer flex-wrap items-center gap-x-2 gap-y-0.5 px-3 py-2 text-left" onClick={() => { setOpen(open === k ? -1 : k); p.setFocus({ bi, si: k }); }}>
                          <span className="flex aspect-square h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold leading-none text-black" style={{ background: STEP_COLORS[k % 6] }}>{k + 1}</span>
                          <span className="shrink-0 text-sm font-black tracking-wider text-sky-300 sm:w-14">{k === 0 ? 'IF' : 'THEN'}</span>
                          <Input value={st.name} onClick={(e) => e.stopPropagation()} onChange={(e) => mutate((s) => { s.branches[bi].steps[k].name = e.target.value; })} className="h-9 min-w-0 flex-1 border-transparent bg-transparent text-base font-bold tracking-tight sm:w-80 sm:flex-none" />
                          <span className="order-last w-full pl-9 text-xs text-muted-foreground sm:pl-[5.75rem]">{k === 0 ? 'Starts a Candidate when its conditions hold' : `${st.same_bar && st.within_bars === 0 ? 'On the same bar as the step before only' : st.same_bar ? 'On the same bar as the step before, or later' : 'On a later bar than the step before'}${st.within_bars ? `, within ${st.within_bars} bars` : ''}${st.until ? `, until ${st.until}` : ''}`} · <StepStats result={result} bi={bi} si={k} data={data} /></span>
                          <span aria-hidden="true" className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-input text-muted-foreground transition-transform sm:ml-auto', open === k && 'rotate-90 text-foreground')}><svg width="20" height="20" viewBox="0 0 14 14"><path d="M5 2.5 L9.5 7 L5 11.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                        </div>
                        {open === k && (
                          <div className="space-y-2 border-t p-3">
                            <StepConfigure rule={(addTo) => <RuleEditor cond={st.cond} ctx={ctxOf(bi, k)} side={br.side} addTo={addTo} onChange={(c) => mutate((s) => { s.branches[bi].steps[k].cond = c; })} />}>
                              <StepLimits step={st} isFirst={k === 0} ctx={ctxOf(bi, k)} side={br.side} look="boxes" onChange={(n: Step) => mutate((s) => { s.branches[bi].steps[k] = n; })} />
                            </StepConfigure>
                            
                          </div>
                        )}
                        {open === k && <div className="flex flex-wrap items-center gap-1.5 border-t px-3 py-2">{k > 0 && <button type="button" className="flex h-10 items-center gap-1.5 rounded-md border border-input px-4 text-sm font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" onClick={() => { mutate((s) => { const a = s.branches[bi].steps; [a[k - 1], a[k]] = [a[k], a[k - 1]]; }); setOpen(k - 1); }}>↑ Move up</button>}{k < br.steps.length - 1 && <button type="button" className="flex h-10 items-center gap-1.5 rounded-md border border-input px-4 text-sm font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" onClick={() => { mutate((s) => { const a = s.branches[bi].steps; [a[k + 1], a[k]] = [a[k], a[k + 1]]; }); setOpen(k + 1); }}>↓ Move down</button>}<button type="button" className="ml-auto flex h-10 items-center gap-1.5 rounded-md border border-red-500/40 px-4 text-sm font-bold uppercase tracking-wider text-red-300 transition-colors hover:bg-red-500/10" onClick={() => { mutate((s) => { s.branches[bi].steps.splice(k, 1); }); setOpen(-1); }}>× Delete step</button></div>}
                      </div>
                    </li>
                  ))}
                  <li className="pt-1"><button type="button" className="flex min-h-11 w-full items-center justify-center gap-1 rounded-lg border border-dashed border-sky-500/50 bg-sky-500/10 px-4 text-sm font-bold uppercase tracking-wider text-sky-300 transition-colors hover:bg-sky-500/20" onClick={() => { mutate((s) => { s.branches[bi].steps.push({ id: uid('st'), name: `Step ${s.branches[bi].steps.length + 1}`, cond: { id: uid(), t: 'all', items: [] } }); }); setOpen(br.steps.length); }}>+ Add another step</button></li>
                  {br.steps.length > 0 && (
                    <li>
                      <div aria-hidden="true" className="ml-[1.6rem] h-4 border-l-2 border-dashed" />
                      <button onClick={() => setStage(4)} className="group/sig flex w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-left hover:bg-emerald-500/10">
                        <span className="flex aspect-square h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-sm font-black leading-none text-black">→</span>
                        <span className="shrink-0 text-sm font-black tracking-wider text-emerald-300 sm:w-14">SIGNAL</span>
                        <span className="min-w-0 flex-1 text-base font-bold tracking-tight">Enter the Trade</span>
                        <span className="w-full pl-9 text-xs text-muted-foreground">When the last step completes · {br.side} entry: {br.entry.order === 'market' ? 'at market' : `${br.entry.order} at ${phrase(br.entry.price || '?', labelsOf(setup))}`}, stop {stopPhrase(br.entry.stop, br.side, (t) => phrase(t, labelsOf(setup)))}</span>
                        <span className="w-full pl-9"><span className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-md border border-sky-500/50 bg-sky-500/10 px-3 text-xs font-bold uppercase tracking-wider text-sky-300 transition-colors group-hover/sig:bg-sky-500/20">Edit in Entry &amp; stop →</span></span>
                      </button>
                    </li>
                  )}
                </ol>
              </div>
            )}
            {stage === 4 && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
                <span className="flex aspect-square h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-sm font-black leading-none text-black">→</span>
                <span className="shrink-0 text-sm font-black tracking-wider text-emerald-300 sm:w-14">SIGNAL</span>
                <span className="min-w-0 flex-1 text-base font-bold tracking-tight">Enter the Trade</span>
                <span className="w-full pl-9 text-xs text-muted-foreground">When the last step completes, the Signal places this order with its stop.</span>
              </div>
            )}
            {stage === 4 && setup.branches.map((b, k) => <div key={b.id} className={cn('space-y-3 rounded-lg border p-3', b.side === 'long' ? 'border-cyan-500/40 bg-cyan-500/[0.04]' : 'border-red-500/40 bg-red-500/[0.04]')}><div className="flex items-center gap-2"><Badge tone={b.side === 'long' ? 'go' : 'error'} className="shrink-0 whitespace-nowrap px-2.5 py-1 text-base font-black tracking-wider">{b.side === 'long' ? '▲ LONG' : '▼ SHORT'}</Badge><span className="text-sm text-muted-foreground">{b.side === 'long' ? 'buy: entry, then the stop below it' : 'sell: entry, then the stop above it'}</span></div><EntryEditor result={result} data={data} setup={setup} mutate={mutate} bi={k} ctx={ctxOf(k, b.steps.length)} /></div>)}
            {stage === 5 && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border border-slate-400/30 bg-slate-400/5 px-3 py-2">
                  <span className="flex aspect-square h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-300 text-sm font-black leading-none text-black">→</span>
                  <span className="shrink-0 text-sm font-black tracking-wider text-slate-300 sm:w-14">FILLED</span>
                  <span className="min-w-0 flex-1 text-base font-bold tracking-tight">Manage the Trade</span>
                  <span className="w-full pl-9 text-xs text-muted-foreground">Once the entry fills, these settings size, protect and close the Trade.</span>
                </div>
                {SECTIONS.filter((k) => k !== 'stop').map((k) => (
                  <div key={k} className="rounded-lg border bg-card/40 p-3 sm:p-4"><div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-base font-bold tracking-tight"><span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-[hsl(var(--chart))] align-middle"><SectionIcon k={k} size={18} /></span>{SECTION_NAMES[k]}</div>
                    <SectionHelp setup={setup} k={k} />
                    <SectionEditor k={k} value={getSection(setup, k)} setup={setup} ctx={ctxOf(0, 99)} onChange={(v) => mutate((s) => { setSection(s, k, v); })} /></div>
                ))}
                <div className="rounded-lg border border-dashed bg-card/40 p-3 sm:p-4"><div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-base font-bold tracking-tight"><span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-[hsl(var(--chart))] align-middle"><SectionIcon k={'in_position'} size={18} /></span>While in a Trade <span className="basis-full text-xs font-normal text-muted-foreground sm:basis-auto">(part of the Setup version; a Run cannot override them)</span></div>
                  <SectionHelp setup={setup} k="in_position" /><InPositionRules setup={setup} mutate={mutate} ctx={ctxOf(0, 99)} look="boxes" /></div>
              </div>
            )}
            {stage === 6 && (
              <div className="space-y-5">
              <ReviewHelp setup={setup} what="intro" />
              <div>
                <div className="mb-2 space-y-1.5"><div className="text-base font-bold tracking-tight text-foreground">Setup at a glance</div><ReviewHelp setup={setup} what="map" /></div>
                <SetupMap setup={setup} result={result} data={data} focus={p.focus} onStep={(f) => { setStage(3); setBi(f.bi); setOpen(f.si); p.setFocus(f); }} onDeclared={() => setStage(1)} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div><div className="mb-1 text-base font-bold tracking-tight text-foreground">Rule description (generated, stored at Freeze)</div><div className="mb-2"><ReviewHelp setup={setup} what="rule" /></div><pre className="mono whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{ruleDescription(setup)}</pre></div>
                <div className="space-y-2"><div className="text-base font-bold tracking-tight text-foreground">Checks</div>
                  <ReviewHelp setup={setup} what="checks" issues={issues} />
                  {issues.length === 0 && <Badge tone="go">Ready to freeze</Badge>}
                  {issues.map((i, k) => <div key={k} className={cn('text-xs', i.level === 'error' ? 'text-red-300' : 'text-amber-300')}>{i.level === 'error' ? '✕' : '!'} {i.where}: {i.text}</div>)}
                  <div className="pt-2 text-base font-bold tracking-tight text-foreground">Save</div>
                  <ReviewHelp setup={setup} what="save" />
                  {p.saveBar}
                </div>
              </div>
              </div>
            )}
            {stage === 7 && <RunStage {...p} runD={runD} />}
          </div>
        </Card>
        {stage === 6 && (
          <Card className="p-4">
            <div className="mb-2 text-base font-bold tracking-tight text-foreground">What it did on MNQ</div>
            <div className="mb-3"><ReviewHelp setup={setup} what="chart" result={chartResult} /></div>
            <div className="mb-3 flex items-center justify-between"><RunSummary result={chartResult} data={data} /></div>
            <Chart data={data} setup={setup} result={chartResult} day={p.day} setDay={p.setDay} focus={p.focus} selected={p.selected} setSelected={p.setSelected} />
          </Card>
        )}
      </main>
    </div>
  );
}


const SUBS = [
  'Name the Setup and set its Base bar, the bar the evaluator runs on.',
  'Every indicator and pattern the Setup reads, configured once. Steps pick from these lists.',
  'Trading window, Market sessions, Trade overlap and the News filter.',
  'First A, then B: each step is one Sequence link. The counts show how often each step held and completed on MNQ.',
  'The Entry block: order type, price and the mandatory stop.',
  'The Setup defaults a Run may override section by section, plus the While-in-a-Trade rules.',
  'The whole Setup at a glance, what it did on MNQ, what the engine will read, and what still blocks a Freeze.',
  'Bind this Setup to an instrument and override whole sections. Overrides make no new version.',
];

function RunStage(p: VariantProps & { runD: ReturnType<typeof useRunDraft> }) {
  const { setup, runD } = p;
  const ctx = tokenCtx(setup, 0, 99);
  return (
    <div className="space-y-3">
      <RunHelp setup={setup} what="intro" />
      <div className="flex flex-wrap items-start gap-3"><div className="min-w-0 basis-full sm:basis-auto"><Field label={<span className="text-base font-bold tracking-tight text-foreground">Instrument</span>}><InstrumentSelect value={runD.draft.instrument} onChange={(v) => runD.setDraft({ ...runD.draft, instrument: v })} /></Field></div>
        <Field label={<span className="text-base font-bold tracking-tight text-foreground">Binds</span>}><span className="mono break-words text-xs">{setup.setup_id} · Draft (a paper Run needs a frozen version that passed the gate)</span></Field></div>
      {instrumentWarnings(setup, runD.draft.instrument).map((w) => <div key={w} className="text-xs text-amber-300">{w}</div>)}
      <RunHelp setup={setup} what="instrument" instrument={runD.draft.instrument} />
      <div className="pt-2 text-base font-bold tracking-tight text-foreground">Risk overrides</div>
      <RunHelp setup={setup} what="overrides" overrides={Object.keys(runD.draft.overrides).length} />
      <div className="divide-y rounded-md border">
        {SECTIONS.map((k) => {
          const on = k in runD.draft.overrides;
          return (
            <div key={k} className="p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:flex-nowrap">
                <div className="flex basis-full items-center gap-2 text-sm font-medium sm:w-52 sm:basis-auto sm:shrink-0"><SectionIcon k={k} size={18} />{SECTION_NAMES[k]}</div>
                <label className="flex items-center gap-1 text-xs"><input type="radio" checked={!on} onChange={() => runD.override(k, false)} />Setup default</label>
                <label className="flex items-center gap-1 text-xs"><input type="radio" checked={on} onChange={() => runD.override(k, true)} />Override</label>
                <span className={cn('basis-full text-xs sm:basis-auto', on ? 'text-muted-foreground line-through' : 'text-muted-foreground')}>{sectionSummary(setup, k)}</span>
              </div>
              {on && <div className="mt-2 rounded-md bg-sky-500/5 p-2"><SectionEditor k={k} value={runD.draft.overrides[k]} setup={setup} ctx={ctx} onChange={(v) => runD.setOverride(k, v)} /><div className="mt-1 text-xs text-sky-300">→ {sectionSummary(runD.effective, k)}</div></div>}
            </div>
          );
        })}
        <div className="p-3 text-xs text-muted-foreground">Signal rules and While-in-a-Trade rules are part of the Setup version and cannot be overridden here.</div>
      </div>
      {runD.result && <div className="grid gap-2 text-xs sm:grid-cols-2"><div className="rounded-md border p-2"><div className="mb-1 font-medium text-muted-foreground">Setup defaults</div><RunSummary result={p.result} data={p.data} /></div><div className="rounded-md border border-sky-500/40 bg-sky-500/5 p-2"><div className="mb-1 font-medium text-sky-300">With this Run's overrides</div><RunSummary result={runD.result} data={p.data} /></div></div>}
    </div>
  );
}

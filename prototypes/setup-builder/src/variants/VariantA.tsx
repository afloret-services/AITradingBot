// PROTOTYPE variant A, "Wizard": a fixed order of stages, one thing at a time, the chart always under the stage.
// Order: basics → indicators → when to trade → Signal steps → entry & stop → Trade settings → review → create a Run.
import React, { useState } from 'react';
import { VariantProps } from '../types';
import { SetupMap } from '../components/SetupMap';
import { RuleEditor } from '../components/RuleEditor';
import { SectionIcon } from '../components/PatternIcon';
import { Chart, StepStats, RunSummary } from '../components/Chart';
import { CondEditor, tokenCtx } from '../components/CondEditor';
import { BaseBarEditor, TradingHoursEditor, SessionsEditor, BehaviourEditor, IndicatorList, PatternList, StepLimits, EntryEditor, SECTIONS, SectionEditor, getSection, sectionSummary, InPositionRules, indicatorUsage, SectionKey, setSection, SectionHelp, SignalStepsHelp, BasicsHelp, RunHelp, ReviewHelp, IndicatorsHelp, PatternsHelp, IndicatorsPatternsIntro, WhenHelp } from '../components/sections';
import { Badge, Button, Card, CardHeader, Input, Select, Tabs, STEP_COLORS, cn, Field } from '../components/ui';
import { ruleDescription, validate, uid, addMirror, SECTION_NAMES, Step, phrase, labelsOf } from '../model';
import { useRunDraft, INSTRUMENTS, instrumentWarnings } from '../runDraft';

const STAGES = ['General', 'Indicators & patterns', 'When to trade', 'Signal steps', 'Entry & stop', 'Trade settings', 'Review & save', 'Create a Run'] as const;

export function VariantA(p: VariantProps) {
  const { setup, mutate, data, result } = p;
  const [stage, setStage] = useState(0);
  const [bi, setBi] = useState(0);
  const [open, setOpen] = useState(0);
  const issues = validate(setup);
  const stageIssues = (k: number) => issues.filter((i) => (k === 3 ? /step|branch$|Signals/.test(i.where) : k === 4 ? /Entry/.test(i.where) : k === 5 ? /legs|take profit|Flatten|deadline|Trade settings/i.test(i.where) : false));
  const br = setup.branches[bi] || setup.branches[0];
  const runD = useRunDraft(data, setup);
  const chartResult = stage === 7 && runD.result ? runD.result : result;

  return (
    <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-4 p-3 md:grid-cols-[220px_1fr] md:p-4">
      <nav className="h-fit space-y-0.5 md:sticky md:top-16">
        <div className="mb-3 px-2"><div className="text-lg font-semibold">{setup.name}</div><div className="text-xs text-muted-foreground">Draft · Base bar {setup.settings.base_bar}</div></div>
        {STAGES.map((s, k) => {
          const n = stageIssues(k).filter((i) => i.level === 'error').length;
          return (
            <button key={s} onClick={() => setStage(k)} className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm', stage === k ? 'bg-accent font-medium' : 'text-muted-foreground hover:bg-accent/50')}>
              <span className={cn('flex h-5 w-5 items-center justify-center rounded-full border text-[11px]', k < stage && 'border-emerald-500 text-emerald-400', stage === k && 'border-sky-400 text-sky-300')}>{k < stage ? '✓' : k + 1}</span>
              {s}{n > 0 && <Badge tone="error" className="ml-auto">{n}</Badge>}
            </button>
          );
        })}
      </nav>
      <main className="min-w-0 space-y-4">
        <Card>
          <CardHeader title={`${stage + 1}. ${STAGES[stage]}`} sub={SUBS[stage]} right={<div className="flex gap-1"><Button size="sm" variant="outline" disabled={stage === 0} onClick={() => setStage(stage - 1)}>Back</Button><Button size="sm" disabled={stage === STAGES.length - 1} onClick={() => setStage(stage + 1)}>{stage < STAGES.length - 1 ? `Next: ${STAGES[stage + 1]}` : 'Last step'}</Button></div>} />
          <div className="space-y-4 p-4">
            {stage === 0 && (
              <div className="space-y-4">
                <BasicsHelp setup={setup} what="intro" />
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-1.5"><Field label="Name"><Input value={setup.name} onChange={(e) => mutate((s) => { s.name = e.target.value; })} className="w-64" /></Field><BasicsHelp setup={setup} what="name" /></div>
                  <div className="space-y-1.5"><BaseBarEditor setup={setup} mutate={mutate} /><BasicsHelp setup={setup} what="base_bar" /></div>
                  <div className="space-y-1.5"><Field label="Notes"><textarea value={setup.notes} onChange={(e) => mutate((s) => { s.notes = e.target.value; })} className="h-16 w-full rounded-md border border-input bg-transparent p-2 text-sm" /></Field><BasicsHelp setup={setup} what="notes" /></div>
                </div>
              </div>
            )}
            {stage === 1 && <div className="space-y-5">
              <IndicatorsPatternsIntro />
              <div><div className="mb-1 text-sm font-semibold">Indicators</div><div className="mb-2"><IndicatorsHelp setup={setup} /></div><IndicatorList setup={setup} mutate={mutate} ctx={tokenCtx(setup, 0, 0)} usage={indicatorUsage(setup)} /></div>
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
                <div className="flex items-center gap-2">
                  <Tabs value={String(bi)} onChange={(v) => { setBi(Number(v)); setOpen(0); }} tabs={setup.branches.map((b, k) => [String(k), `${b.side === 'long' ? 'Long' : 'Short'} branch`] as [string, string])} />
                  {setup.branches.length === 1 && <Button size="sm" variant="ghost" onClick={() => mutate((s) => { addMirror(s); })}>Duplicate as mirrored {br.side === 'long' ? 'short' : 'long'}</Button>}
                  <span className="ml-auto text-xs text-muted-foreground">On a new first step while one is running:</span>
                  <Select value={br.on_new_start} onChange={(v) => mutate((s) => { s.branches[bi].on_new_start = v; })} options={[['start_another', 'start another'], ['replace', 'replace'], ['ignore', 'ignore']]} className="h-7" />
                </div>
                <ol className="space-y-0">
                  {br.steps.map((st, k) => (
                    <li key={st.id}>
                      {k > 0 && <div className="ml-4 border-l-2 border-dashed py-1 pl-4 text-xs text-muted-foreground"><b className="text-sky-300">THEN</b>, {st.same_bar && st.within_bars === 0 ? 'on the same bar only' : st.same_bar ? 'possibly on the same bar' : 'on a later bar'}{st.within_bars ? `, within ${st.within_bars} bars` : ''}{st.until ? `, until ${st.until}` : ''}</div>}
                      <div className={cn('rounded-lg border', open === k && 'border-sky-500/50')}>
                        <button className="flex w-full items-center gap-2 px-3 py-2 text-left" onClick={() => { setOpen(open === k ? -1 : k); p.setFocus({ bi, si: k }); }}>
                          <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-black" style={{ background: STEP_COLORS[k % 6] }}>{k + 1}</span>
                          <span className="w-11 text-xs font-black tracking-wider text-sky-300">{open === k ? '' : k === 0 ? 'IF' : 'THEN'}</span>
                          <Input value={st.name} onClick={(e) => e.stopPropagation()} onChange={(e) => mutate((s) => { s.branches[bi].steps[k].name = e.target.value; })} className="h-7 w-72 border-transparent bg-transparent font-medium" />
                          <StepStats result={result} bi={bi} si={k} data={data} />
                          <span className="ml-auto text-muted-foreground">{open === k ? '▾' : '▸'}</span>
                        </button>
                        {open === k && (
                          <div className="space-y-2 border-t p-3">
                            <RuleEditor cond={st.cond} keyword={k === 0 ? 'IF' : 'THEN'} ctx={tokenCtx(setup, bi, k)} side={br.side} onChange={(c) => mutate((s) => { s.branches[bi].steps[k].cond = c; })} />
                            <StepLimits step={st} isFirst={k === 0} ctx={tokenCtx(setup, bi, k)} side={br.side} look="boxes" onChange={(n: Step) => mutate((s) => { s.branches[bi].steps[k] = n; })} />
                            <div className="flex gap-1"><Button size="sm" variant="ghost" disabled={k === 0} onClick={() => mutate((s) => { const a = s.branches[bi].steps; [a[k - 1], a[k]] = [a[k], a[k - 1]]; })}>↑ move up</Button><Button size="sm" variant="ghost" onClick={() => mutate((s) => { s.branches[bi].steps.splice(k, 1); })}>delete step</Button></div>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                  {br.steps.length > 0 && (
                    <li>
                      <div className="ml-4 border-l-2 border-dashed py-1 pl-4 text-xs text-muted-foreground">when the last step completes</div>
                      <button onClick={() => setStage(4)} className="flex w-full items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-left text-sm hover:bg-emerald-500/10">
                        <span className="text-xs font-black tracking-wider text-emerald-300">→ SIGNAL</span>
                        <span className="text-muted-foreground">{br.side} entry: {br.entry.order === 'market' ? 'at market' : `${br.entry.order} at ${phrase(br.entry.price || '?', labelsOf(setup))}`}, stop {br.entry.stop.offset} {br.entry.stop.unit === 'atr' ? '× ATR' : 'ticks'} {br.side === 'long' ? 'below' : 'above'} {phrase(br.entry.stop.token || '?', labelsOf(setup))}</span>
                        <span className="ml-auto text-xs text-sky-300">edit in Entry & stop →</span>
                      </button>
                    </li>
                  )}
                </ol>
                <Button size="sm" variant="outline" onClick={() => { mutate((s) => { s.branches[bi].steps.push({ id: uid('st'), name: `Step ${s.branches[bi].steps.length + 1}`, cond: { id: uid(), t: 'all', items: [] } }); }); setOpen(br.steps.length); }}>+ then another step</Button>
              </div>
            )}
            {stage === 4 && setup.branches.map((b, k) => <div key={b.id} className="space-y-2"><Badge>{b.side} branch</Badge><EntryEditor result={result} data={data} setup={setup} mutate={mutate} bi={k} ctx={tokenCtx(setup, k, b.steps.length)} /></div>)}
            {stage === 5 && (
              <div className="space-y-4">
                {SECTIONS.filter((k) => k !== 'stop').map((k) => (
                  <div key={k}><div className="mb-1.5 flex items-center gap-2 text-sm font-medium"><span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-[hsl(var(--chart))] align-middle"><SectionIcon k={k} size={18} /></span>{SECTION_NAMES[k]}</div>
                    <SectionHelp setup={setup} k={k} />
                    <SectionEditor k={k} value={getSection(setup, k)} setup={setup} ctx={tokenCtx(setup, 0, 99)} onChange={(v) => mutate((s) => { setSection(s, k, v); })} /></div>
                ))}
                <div><div className="mb-1.5 flex items-center gap-2 text-sm font-medium"><span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-[hsl(var(--chart))] align-middle"><SectionIcon k={'in_position'} size={18} /></span>While in a Trade <span className="text-xs font-normal text-muted-foreground">(part of the Setup version; a Run cannot override them)</span></div>
                  <SectionHelp setup={setup} k="in_position" /><InPositionRules setup={setup} mutate={mutate} ctx={tokenCtx(setup, 0, 99)} look="boxes" /></div>
              </div>
            )}
            {stage === 6 && (
              <div className="space-y-5">
              <ReviewHelp setup={setup} what="intro" />
              <div>
                <div className="mb-2 space-y-1.5"><div className="text-sm font-semibold">Setup at a glance</div><ReviewHelp setup={setup} what="map" /></div>
                <SetupMap setup={setup} result={result} data={data} focus={p.focus} onStep={(f) => { setStage(3); setBi(f.bi); setOpen(f.si); p.setFocus(f); }} onDeclared={() => setStage(1)} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div><div className="mb-1 text-sm font-medium">Rule description (generated, stored at Freeze)</div><div className="mb-2"><ReviewHelp setup={setup} what="rule" /></div><pre className="mono whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{ruleDescription(setup)}</pre></div>
                <div className="space-y-2"><div className="text-sm font-medium">Checks</div>
                  <ReviewHelp setup={setup} what="checks" issues={issues} />
                  {issues.length === 0 && <Badge tone="ok">Ready to freeze</Badge>}
                  {issues.map((i, k) => <div key={k} className={cn('text-xs', i.level === 'error' ? 'text-red-300' : 'text-amber-300')}>{i.level === 'error' ? '✕' : '!'} {i.where}: {i.text}</div>)}
                  <div className="pt-2 text-sm font-medium">Save</div>
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
            <div className="mb-2 text-sm font-semibold">What it did on MNQ</div>
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
  'Name the Setup and declare its Base bar, the bar the evaluator runs on.',
  'Every indicator and pattern the Setup reads, declared once. Steps pick from these lists.',
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
      <div className="flex items-center gap-3"><Field label="Instrument"><Select value={runD.draft.instrument} onChange={(v) => runD.setDraft({ ...runD.draft, instrument: v })} options={INSTRUMENTS} /></Field>
        <Field label="Binds"><span className="mono text-xs">{setup.setup_id} · Draft (a paper Run needs a frozen version that passed the gate)</span></Field></div>
      {instrumentWarnings(setup, runD.draft.instrument).map((w) => <div key={w} className="text-xs text-amber-300">{w}</div>)}
      <RunHelp setup={setup} what="instrument" instrument={runD.draft.instrument} />
      <div className="pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Risk overrides</div>
      <RunHelp setup={setup} what="overrides" overrides={Object.keys(runD.draft.overrides).length} />
      <div className="divide-y rounded-md border">
        {SECTIONS.map((k) => {
          const on = k in runD.draft.overrides;
          return (
            <div key={k} className="p-3">
              <div className="flex items-center gap-3">
                <div className="flex w-52 items-center gap-2 text-sm font-medium"><SectionIcon k={k} size={18} />{SECTION_NAMES[k]}</div>
                <label className="flex items-center gap-1 text-xs"><input type="radio" checked={!on} onChange={() => runD.override(k, false)} />Setup default</label>
                <label className="flex items-center gap-1 text-xs"><input type="radio" checked={on} onChange={() => runD.override(k, true)} />Override</label>
                <span className={cn('text-xs', on ? 'text-muted-foreground line-through' : 'text-muted-foreground')}>{sectionSummary(setup, k)}</span>
              </div>
              {on && <div className="mt-2 rounded-md bg-sky-500/5 p-2"><SectionEditor k={k} value={runD.draft.overrides[k]} setup={setup} ctx={ctx} onChange={(v) => runD.setOverride(k, v)} /><div className="mt-1 text-xs text-sky-300">→ {sectionSummary(runD.effective, k)}</div></div>}
            </div>
          );
        })}
        <div className="p-3 text-xs text-muted-foreground">Signal rules and While-in-a-Trade rules are part of the Setup version and cannot be overridden here.</div>
      </div>
      {runD.result && <div className="flex items-center gap-2 text-xs"><span>Defaults:</span><RunSummary result={p.result} data={p.data} /><span>With this Run's overrides:</span><RunSummary result={runD.result} data={p.data} /></div>}
    </div>
  );
}

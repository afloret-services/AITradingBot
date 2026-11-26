// PROTOTYPE variant C, "Lanes": each branch is a horizontal lane of cards, Step → Step → Entry → Trade, with the
// Sequence limits written on the connectors. A block library on the left inserts into the selected card; an inspector
// on the right edits it. Settings sit in a toolbar. "Run" mode locks the Signal cards and lets Trade sections be overridden in place.
import React, { useEffect, useRef, useState } from 'react';
import { VariantProps } from '../types';
import { Chart, StepStats, RunSummary } from '../components/Chart';
import { CondEditor, tokenCtx, AddMenu, newCmp } from '../components/CondEditor';
import { PatternIcon, IndicatorIcon, SectionIcon } from '../components/PatternIcon';
import { BaseBarEditor, TradingHoursEditor, BehaviourEditor, SessionsEditor, IndicatorList, StepLimits, EntryEditor, SECTIONS, SectionEditor, getSection, setSection, sectionSummary, InPositionRules, indicatorUsage, SectionKey, PatternList, SectionHelp, Explain, BasicsHelp, WhenHelp, IndicatorsHelp, PatternsHelp, SignalStepsHelp, ReviewHelp, RunHelp, IndicatorsPatternsIntro, ONE_AT_A_TIME, NEWS, MirrorNote } from '../components/sections';
import { RuleEditor, appendAnd, StepConfigure } from '../components/RuleEditor';
import { shortName } from '../components/TokenPicker';
import { Badge, Button, Card, Input, Select, STEP_COLORS, cn, Tabs, Field, usePhone, Sheet } from '../components/ui';
import { Cond, PRESETS, uid, SECTION_NAMES, condPhrase, Step, addMirror, PATTERN_KINDS, patternUsage, labelsOf, validate, ruleDescription , tradingWindowText, stopPhrase } from '../model';
import { useRunDraft, instrumentWarnings } from '../runDraft';
import { InstrumentSelect } from '../components/InstrumentSelect';

type Sel = { kind: 'step'; bi: number; si: number } | { kind: 'entry'; bi: number } | { kind: 'trade' } | { kind: 'settings' } | { kind: 'section'; k: SectionKey } | { kind: 'review' };

export function VariantC(p: VariantProps) {
  const { setup, mutate, data, result } = p;
  const [sel, setSel] = useState<Sel>({ kind: 'step', bi: 0, si: 0 });
  // phone: the inspector is a bottom sheet that opens when a card (or Review & save, a section…) is picked
  const phone = usePhone();
  const [sheetOpen, setSheetOpen] = useState(false);
  const inspRef = useRef<HTMLDivElement>(null);
  const firstSel = useRef(true);
  useEffect(() => { if (firstSel.current) { firstSel.current = false; return; } setSheetOpen(true); }, [sel]);
  const [mode, setMode] = useState<'build' | 'run'>('build');
  const runD = useRunDraft(data, setup);
  const labels = labelsOf(setup);
  const insert = (c: Cond) => {
    if (sel.kind !== 'step') return;
    mutate((s) => { s.branches[sel.bi].steps[sel.si].cond = appendAnd(s.branches[sel.bi].steps[sel.si].cond, c); });
    if (phone) { setSheetOpen(true); setTimeout(() => { const el = inspRef.current?.querySelectorAll('[aria-label="move up"]'); el?.[el.length - 1]?.scrollIntoView({ block: 'center' }); }, 50); } // phone: show the new condition in its step
  };
  const run = mode === 'run';
  const shown = run && runD.result ? runD.result : result;
  const usage = indicatorUsage(setup);
  const selStep = sel.kind === 'step' ? setup.branches[sel.bi]?.steps[sel.si] : null;
  const issues = validate(setup);

  return (
    <div className="flex flex-col lg:h-[calc(100vh-50px)]">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b px-3 py-2 text-xs">
        <Input value={setup.name} onChange={(e) => mutate((s) => { s.name = e.target.value; })} className="h-9 w-64 max-w-full text-lg font-bold tracking-tight" />
        <button onClick={() => setSel({ kind: 'settings' })} className="min-h-9 rounded-md border border-sky-500/40 bg-sky-500/[0.06] px-3 py-1.5 text-left text-sm hover:bg-accent">Base bar <b>{setup.settings.base_bar}</b> · Trading window <b>{tradingWindowText(setup.settings.trading_hours)}</b> · Trade overlap <b>{(ONE_AT_A_TIME[setup.settings.one_at_a_time]?.[0] || '').replace(/:.*$/, '').replace(/^./, (c) => c.toLowerCase())}</b> · News filter <b>{NEWS[setup.settings.news_rule.mode]?.[0].replace(/^./, (c) => c.toLowerCase())}</b> ✎</button>
        <Tabs value={mode} onChange={(v) => { setMode(v as 'build' | 'run'); if (v === 'run') setSel({ kind: 'trade' }); }} tabs={[['build', 'Build the Setup'], ['run', 'Create a Run']]} />
        {run && <><InstrumentSelect value={runD.draft.instrument} onChange={(v) => runD.setDraft({ ...runD.draft, instrument: v })} className="h-8" />{instrumentWarnings(setup, runD.draft.instrument).map((w) => <span key={w} className="text-amber-300">{w}</span>)}</>}
        <button onClick={() => setSel({ kind: 'review' })} className={cn('ml-auto h-9 rounded-md border px-3 text-sm font-medium hover:bg-accent', sel.kind === 'review' && 'border-sky-400 bg-sky-500/10')}>Review & save {issues.some((i) => i.level === 'error') ? <span className="text-red-300">· {issues.filter((i) => i.level === 'error').length} errors</span> : issues.length ? <span className="text-amber-300">· {issues.length} warnings</span> : <span className="text-cyan-300">· ready</span>}</button>
        <div>{p.saveBar}</div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)_380px]">
        {/* library */}
        <div className={cn('order-last space-y-3 overflow-auto border-t p-3 text-sm lg:order-none lg:border-r lg:border-t-0', run && 'pointer-events-none opacity-40')}>
          <div className="lg:hidden"><div className="text-lg font-bold tracking-tight">Block library</div><div className="text-xs text-muted-foreground">{sel.kind === 'step' ? <>Tap a block to add it to <b className="text-foreground">step {sel.si + 1}</b> ({setup.branches[sel.bi]?.side}); tap another step card above to change.</> : 'Tap a step card above first, then a block to add it there.'}</div></div>
          <Lib title="Indicators (configured once)">
            {setup.indicators.map((i) => (
              <LibItem key={i.token} onClick={() => insert({ id: uid(), t: 'cmp', a: i.token, op: '>', b: '' })} disabled={sel.kind !== 'step'} large><span className="flex items-center gap-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-[hsl(var(--chart))]"><IndicatorIcon token={i.token} size={26} /></span><span className="flex flex-col leading-tight">{i.label || shortName(i.token, {})}<span className="text-xs font-normal text-muted-foreground">used {usage[i.token] || 0}×</span></span></span></LibItem>
            ))}
            <button className="col-span-2 py-1 text-left text-xs text-sky-300" onClick={() => setSel({ kind: 'settings' })}>manage / configure…</button>
          </Lib>
          <Lib title="Patterns (configured once)">
            {(setup.patterns || []).map((pt) => (
              <LibItem key={pt.name} onClick={() => insert({ id: uid(), t: 'pattern', ref: pt.name, side: side() })} disabled={sel.kind !== 'step'} large><span className="flex items-center gap-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-[hsl(var(--chart))]"><PatternIcon kind={pt.kind} size={26} /></span><span className="flex flex-col leading-tight">{pt.name}: {PATTERN_KINDS[pt.kind].title.replace(/ \(.*\)$/, '')}<span className="text-xs font-normal text-muted-foreground">{pt.tf} · used {patternUsage(setup)[pt.name] || 0}×</span></span></span></LibItem>
            ))}
            <button className="col-span-2 py-1 text-left text-xs text-sky-300" onClick={() => setSel({ kind: 'settings' })}>manage / configure…</button>
          </Lib>
          <Lib title="ICT presets">
            {[['Bias', () => PRESETS.bias(side())], ['Draw on liquidity', () => PRESETS.draw(side())]].map(([l, f]: any) => <LibItem key={l} onClick={() => insert(f())} disabled={sel.kind !== 'step'}>{l}</LibItem>)}
          </Lib>
          <Lib title="Indicator presets">
            <LibItem onClick={() => insert(PRESETS.macdCross(setup.settings.base_bar, side()))} disabled={sel.kind !== 'step'}>MACD crosses signal</LibItem>
          </Lib>
          <Lib title="Logic">
            {[['Compare', () => newCmp(tokenCtx(setup, 0, 0))], ['All of', () => ({ id: uid(), t: 'all', items: [] })], ['Any of', () => ({ id: uid(), t: 'any', items: [] })], ['Not', () => ({ id: uid(), t: 'not', item: newCmp(tokenCtx(setup, 0, 0)) })], ['For at least N bars', () => ({ id: uid(), t: 'for_n', n: 3, item: newCmp(tokenCtx(setup, 0, 0)) })], ['Time range', () => ({ id: uid(), t: 'time', start: '10:00', end: '11:00' })]].map(([l, f]: any) => <LibItem key={l} onClick={() => insert(f())} disabled={sel.kind !== 'step'}>{l}</LibItem>)}
          </Lib>
          <div className="hidden text-[11px] text-muted-foreground lg:block">Click to add to the selected step card.</div>
        </div>
        {/* lanes + chart */}
        <div className="min-w-0 overflow-auto">
          <div className="space-y-4 p-3">
            {setup.branches.map((br, bi) => (
              <div key={br.id}>
                <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"><Badge tone={br.side === 'long' ? 'go' : 'error'} className="px-2.5 py-1 text-base font-black tracking-wider">{br.side === 'long' ? '▲ ' : '▼ '}{br.side.toUpperCase()}</Badge><span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">when a new setup appears before the last one finished:<select value={br.on_new_start} disabled={!!run} onClick={(e) => e.stopPropagation()} onChange={(e) => { const v = e.target.value as any; mutate((s) => { s.branches[bi].on_new_start = v; }); }} className="h-9 rounded-md border border-sky-500/50 bg-sky-500/10 px-2 text-base font-medium text-sky-200 outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-400 disabled:opacity-60">{([['start_another', 'follow both'], ['replace', 'switch to the new one'], ['ignore', 'stay with the first one']] as const).map(([v, l]) => <option key={v} value={v} className="bg-card">{l}</option>)}</select></span>
                  {setup.branches.length === 1 && !run && <button type="button" className="sm:ml-auto flex min-h-8 flex-col items-start justify-center py-1 leading-tight rounded-md border border-sky-500/50 bg-sky-500/10 px-3 text-xs font-bold uppercase tracking-wider text-sky-300 transition-colors hover:bg-sky-500/20" onClick={() => mutate((s) => { addMirror(s); })}><span>+ Add a {br.side === 'long' ? 'short' : 'long'} branch</span><span className="text-[10px] font-medium normal-case tracking-normal opacity-80">(mirrored copy of {br.side})</span></button>}</div>
                {br.mirrored && <div className="mb-1.5"><MirrorNote side={br.side} onHide={() => mutate((s) => { s.branches[bi].mirrored = false; })} /></div>}
                <div className="flex flex-col items-stretch gap-0 pb-2 sm:flex-row sm:overflow-x-auto">
                  {br.steps.map((st, si) => (
                    <React.Fragment key={st.id}>
                      {si > 0 && <Connector st={st} />}
                      <LaneCard color={STEP_COLORS[si % 6]} selected={sel.kind === 'step' && sel.bi === bi && sel.si === si} locked={run} onClick={() => { setSel({ kind: 'step', bi, si }); p.setFocus({ bi, si }); }}
                        title={<span className="flex items-start gap-1.5"><span className="mt-0.5 inline-flex aspect-square h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold leading-none text-black" style={{ background: STEP_COLORS[si % 6] }}>{si + 1}</span><span className="mt-0.5 shrink-0 text-sm font-black tracking-wider text-sky-300">{si === 0 ? 'IF' : 'THEN'}</span><span className="text-base font-bold leading-snug tracking-tight">{st.name}</span></span>}
                        foot={<StepStats result={result} bi={bi} si={si} data={data} />}>
                        <MiniCond c={st.cond} labels={labels} />
                        {st.capture_running && <div className="mt-1 text-[11px] text-muted-foreground">captures <span className="mono">{st.capture_running.name}</span> (running {st.capture_running.field})</div>}
                      </LaneCard>
                    </React.Fragment>
                  ))}
                  {!run && <button className="mt-1.5 self-stretch rounded-md border border-dashed px-2 py-2 text-xs text-muted-foreground hover:text-foreground sm:mx-2 sm:mt-0 sm:self-center sm:rounded-full sm:py-6" onClick={() => { mutate((s) => { s.branches[bi].steps.push({ id: uid('st'), name: 'New step', cond: { id: uid(), t: 'all', items: [] } }); }); setSel({ kind: 'step', bi, si: br.steps.length }); }}><span className="sm:block sm:max-w-[5.5rem] sm:text-center">+ Add another step</span></button>}
                  <Connector label="" />
                  <LaneCard color="#34d399" selected={sel.kind === 'entry' && sel.bi === bi} onClick={() => setSel({ kind: 'entry', bi })} title={<span className="flex items-start gap-1.5"><span className="mt-0.5 inline-flex aspect-square h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-xs font-black leading-none text-black">→</span><span className="mt-0.5 shrink-0 text-sm font-black tracking-wider text-emerald-300">SIGNAL</span><span className="text-base font-bold leading-snug tracking-tight">Enter the Trade</span></span>} overridable={run} overridden={run && 'stop' in runD.draft.overrides}>
                    <div className="text-xs">{br.entry.order}{br.entry.order !== 'market' && <> at <Chip>{shortName(br.entry.price || '?', labels)}</Chip></>}</div>
                    <div className="mt-1 text-xs">stop {(br.entry.stop.from || 'level') === 'level' ? <>{br.entry.stop.offset} {br.entry.stop.unit === 'atr' ? '× ATR' : 'ticks'} {br.side === 'long' ? 'below' : 'above'} <Chip>{shortName(br.entry.stop.token || '?', labels)}</Chip></> : stopPhrase(br.entry.stop, br.side, (t) => shortName(t, labels))}</div>
                    <div className="mt-1.5 border-t pt-1 text-[11px] leading-snug text-muted-foreground">{br.entry.order === 'market' ? 'Fills at the next bar\'s open: always in, at the market\'s price.' : br.entry.order === 'limit' ? 'Fills only if price comes back to it: a better price, but it may never fill.' : 'Fills once price breaks through it: waits for confirmation, at a worse price.'} The entry-to-stop distance is 1R.
                      {(() => { const sg = shown.signals.filter((x) => x.branch === bi && !x.refused).slice(-1)[0]; return sg ? <> Latest Signal: <b className="text-foreground">{Math.abs(sg.entry - sg.stop).toFixed(2)} pts</b> of risk, <b className="text-foreground">{sg.legs.reduce((a, l) => a + l.contracts, 0)}</b> contract(s).</> : null; })()}
                      <span className="text-sky-300/80"> Click for the full description.</span></div>
                  </LaneCard>
                  {bi === 0 && <>
                    <Connector label="" />
                    <LaneCard color="#94a3b8" selected={sel.kind === 'trade' || sel.kind === 'section'} onClick={() => setSel({ kind: 'trade' })} title={<span className="flex items-start gap-1.5"><span className="mt-0.5 inline-flex aspect-square h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-300 text-xs font-black leading-none text-black">→</span><span className="mt-0.5 shrink-0 text-sm font-black tracking-wider text-slate-300">FILLED</span><span className="text-base font-bold leading-snug tracking-tight">Manage the Trade</span></span>} wide overridable={run}>
                      {SECTIONS.filter((k) => k !== 'stop').map((k) => {
                        const ov = run && k in runD.draft.overrides;
                        return (
                          <button key={k} onClick={(e) => { e.stopPropagation(); setSel({ kind: 'section', k }); }} className={cn('block w-full rounded px-1 py-0.5 text-left text-[11px] hover:bg-accent', sel.kind === 'section' && sel.k === k && 'bg-accent', ov && 'bg-sky-500/10')}>
                            <SectionIcon k={k} size={14} className="-mt-0.5 mr-1 inline-block align-middle" /><span className="font-medium">{SECTION_NAMES[k]}</span> <span className="text-muted-foreground">{sectionSummary(ov ? runD.effective : setup, k)}</span>{ov && <Badge tone="info" className="ml-1">override</Badge>}
                          </button>
                        );
                      })}
                      <div className={cn('mt-1 border-t pt-1 text-[11px] text-muted-foreground', run && 'opacity-50')}>{run && '🔒 '}While in a Trade: {setup.in_position_rules.length} rule(s)</div>
                    </LaneCard>
                  </>}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t p-3">
            <div className="mb-2">{run && runD.result ? <RunCompare base={result} over={runD.result} data={data} /> : <RunSummary result={shown} data={data} />}</div>
            <div className="mb-2"><ReviewHelp setup={setup} what="chart" result={shown} /></div>
            <Chart data={data} setup={setup} result={shown} day={p.day} setDay={p.setDay} focus={p.focus} selected={p.selected} setSelected={p.setSelected} height={420} compactBar />
          </div>
        </div>
        {/* inspector */}
        {(!phone || sheetOpen) && <Sheet phone={phone}>
        {phone && <div className="fixed inset-0 z-[60] bg-black/50" onClick={() => setSheetOpen(false)} />}
        <div ref={inspRef} className={cn('ctl-lg', phone ? 'fixed inset-x-0 bottom-0 z-[61] max-h-[85vh] overflow-auto rounded-t-xl border-t bg-card px-3 pb-6 shadow-2xl' : 'overflow-auto border-l p-3')}>
          {phone && <div className="sticky top-0 z-10 -mx-3 mb-2 flex items-center gap-2 border-b bg-card px-3 py-2"><span className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/40" /><button aria-label="close" onClick={() => setSheetOpen(false)} className="absolute right-3 flex h-7 w-7 items-center justify-center rounded-md border border-input text-lg leading-none text-muted-foreground">×</button></div>}
          {sel.kind === 'review' && <div className="space-y-3"><H>Review & save</H><ReviewHelp setup={setup} what="intro" /><ReviewHelp setup={setup} what="map" />
            <H2>Checks</H2><ReviewHelp setup={setup} what="checks" issues={issues} />
            {issues.length === 0 && <Badge tone="go">Ready to freeze</Badge>}
            {issues.map((i, k) => <div key={k} className={cn('text-xs', i.level === 'error' ? 'text-red-300' : 'text-amber-300')}>{i.level === 'error' ? '✕' : '!'} {i.where}: {i.text}</div>)}
            <H2>Save</H2><ReviewHelp setup={setup} what="save" /><div>{p.saveBar}</div>
            <H2>Rule description (stored at Freeze)</H2><ReviewHelp setup={setup} what="rule" /><pre className="mono whitespace-pre-wrap rounded-md bg-muted p-2 text-[11px]">{ruleDescription(setup)}</pre>
          </div>}
          {sel.kind === 'settings' && <div className="space-y-4"><H>General</H><Explain><BasicsHelp setup={setup} what="intro" /></Explain>
            <Field label="Name"><Input value={setup.name} onChange={(e) => mutate((s) => { s.name = e.target.value; })} className="w-full" /></Field><Explain><BasicsHelp setup={setup} what="name" /></Explain>
            <BaseBarEditor setup={setup} mutate={mutate} /><Explain><BasicsHelp setup={setup} what="base_bar" /></Explain>
            <Field label="Notes"><textarea value={setup.notes} onChange={(e) => mutate((s) => { s.notes = e.target.value; })} placeholder="Free text. Never part of the Rule description or the hash." className="h-16 w-full rounded-md border border-input bg-transparent p-2 text-sm" /></Field><Explain><BasicsHelp setup={setup} what="notes" /></Explain>
            <H>When to trade</H><Explain><WhenHelp setup={setup} what="intro" /></Explain>
            <TradingHoursEditor setup={setup} mutate={mutate} /><Explain><WhenHelp setup={setup} what="hours" /></Explain>
            <SessionsEditor setup={setup} mutate={mutate} /><Explain><WhenHelp setup={setup} what="sessions" /></Explain>
            <BehaviourEditor setup={setup} mutate={mutate} stacked />
            <H>Indicators & patterns</H><IndicatorsPatternsIntro /><H2>Indicators</H2><IndicatorsHelp setup={setup} /><IndicatorList setup={setup} mutate={mutate} ctx={tokenCtx(setup, 0, 0)} usage={usage} />
            <H2>Patterns</H2><PatternsHelp setup={setup} /><PatternList setup={setup} mutate={mutate} compact data={data} /></div>}
          {sel.kind === 'step' && selStep && (
            run ? <Locked what="Signal steps" /> :
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border bg-card/40 px-3 py-2">
                <span className="flex aspect-square h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black leading-none text-black" style={{ background: STEP_COLORS[sel.si % 6] }}>{sel.si + 1}</span>
                <span className="shrink-0 text-sm font-black tracking-wider text-sky-300">{sel.si === 0 ? 'IF' : 'THEN'}</span>
                <Input value={selStep.name} onChange={(e) => mutate((s) => { s.branches[sel.bi].steps[sel.si].name = e.target.value; })} className="h-8 min-w-0 flex-1 basis-[10rem] border-transparent bg-transparent px-1 text-base font-bold tracking-tight text-foreground" />
                <span className="w-full pl-9 text-xs text-muted-foreground">{setup.branches[sel.bi].side} branch · {sel.si === 0 ? 'Starts a Candidate when its conditions hold.' : selStep.same_bar ? 'On the same bar as the step before, or later.' : 'On a later bar than the step before.'} · <StepStats result={result} bi={sel.bi} si={sel.si} data={data} /></span>
              </div>
              <SignalStepsHelp setup={setup} bi={sel.bi} />
              <StepConfigure rule={(addTo) => <RuleEditor cond={selStep.cond} ctx={tokenCtx(setup, sel.bi, sel.si)} side={setup.branches[sel.bi].side} addTo={addTo} onChange={(c) => mutate((s) => { s.branches[sel.bi].steps[sel.si].cond = c; })} />}>
                <StepLimits step={selStep} isFirst={sel.si === 0} ctx={tokenCtx(setup, sel.bi, sel.si)} side={setup.branches[sel.bi].side} look="chips" onChange={(n: Step) => mutate((s) => { s.branches[sel.bi].steps[sel.si] = n; })} />
              </StepConfigure>
              {sel.si === 0 && <div className="flex flex-wrap items-center gap-2 text-xs">When a new setup appears before the last one finished: <Select value={setup.branches[sel.bi].on_new_start} onChange={(v) => mutate((s) => { s.branches[sel.bi].on_new_start = v; })} options={[['start_another', 'Follow both'], ['replace', 'Switch to the new one'], ['ignore', 'Stay with the first one']]} className="h-8" /></div>}
              <div className="rounded bg-muted p-2 text-[11px] text-muted-foreground">{condPhrase(selStep.cond, labels)}</div>
              <div className="flex flex-wrap items-center gap-1.5 border-t pt-3">
                {sel.si > 0 && <button type="button" className="flex h-10 items-center gap-1.5 rounded-md border border-input px-4 text-sm font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" onClick={() => { mutate((s) => { const a = s.branches[sel.bi].steps; [a[sel.si - 1], a[sel.si]] = [a[sel.si], a[sel.si - 1]]; }); setSel({ ...sel, si: sel.si - 1 }); }}>← Move earlier</button>}
                {sel.si < setup.branches[sel.bi].steps.length - 1 && <button type="button" className="flex h-10 items-center gap-1.5 rounded-md border border-input px-4 text-sm font-bold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" onClick={() => { mutate((s) => { const a = s.branches[sel.bi].steps; [a[sel.si + 1], a[sel.si]] = [a[sel.si], a[sel.si + 1]]; }); setSel({ ...sel, si: sel.si + 1 }); }}>Move later →</button>}
                <button type="button" className="ml-auto flex h-10 items-center gap-1.5 rounded-md border border-red-500/40 px-4 text-sm font-bold uppercase tracking-wider text-red-300 transition-colors hover:bg-red-500/10" onClick={() => { mutate((s) => { s.branches[sel.bi].steps.splice(sel.si, 1); }); setSel({ kind: 'trade' }); }}>× Delete step</button>
              </div>
            </div>
          )}
          {sel.kind === 'entry' && (
            run ? <div className="space-y-2"><H>Stop · Run override</H><SectionHelp setup={setup} k="stop" /><RunHelp setup={setup} what="overrides" overrides={Object.keys(runD.draft.overrides).length} /><OverrideBox k="stop" setup={setup} runD={runD} />{phone && runD.result && <RunCompare base={result} over={runD.result} data={data} />}</div> :
            <div className="space-y-2"><H>Entry · {setup.branches[sel.bi].side}</H><EntryEditor result={result} data={data} setup={setup} mutate={mutate} bi={sel.bi} ctx={tokenCtx(setup, sel.bi, 99)} /></div>
          )}
          {sel.kind === 'trade' && (
            run ? <div className="space-y-2"><H>Create a Run</H><div className="text-xs text-muted-foreground">Pick a section on the Trade card to override it for this Run. Signal steps and While-in-a-Trade rules are locked: changing them makes a new Setup version.</div><RunHelp setup={setup} what="intro" /><RunHelp setup={setup} what="instrument" instrument={runD.draft.instrument} /><RunHelp setup={setup} what="overrides" overrides={Object.keys(runD.draft.overrides).length} /></div> :
            <div className="space-y-3"><H>Trade settings</H><div className="text-xs text-muted-foreground">The Setup's defaults; a Run may override each section. Click a section to edit it.</div>
              {SECTIONS.filter((k) => k !== 'stop').map((k) => (
                <button key={k} onClick={() => setSel({ kind: 'section', k })} className="block w-full space-y-1 rounded-md border p-2 text-left hover:border-sky-400/60">
                  <div className="flex items-center gap-1.5 text-xs font-medium"><SectionIcon k={k} size={16} className="shrink-0" /><span className="shrink-0 whitespace-nowrap">{SECTION_NAMES[k]}</span><span className="ml-auto min-w-0 truncate text-[11px] font-normal text-muted-foreground">{sectionSummary(setup, k)}</span></div>
                  <SectionHelp setup={setup} k={k} />
                </button>
              ))}<H><span className="inline-flex items-center gap-1.5"><SectionIcon k="in_position" size={16} />While in a Trade</span></H><SectionHelp setup={setup} k="in_position" /><InPositionRules setup={setup} mutate={mutate} ctx={tokenCtx(setup, 0, 99)} look="chips" /></div>
          )}
          {sel.kind === 'section' && (
            run ? <div className="space-y-2"><H>{SECTION_NAMES[sel.k]} · Run override</H><SectionHelp setup={setup} k={sel.k} /><RunHelp setup={setup} what="overrides" overrides={Object.keys(runD.draft.overrides).length} /><OverrideBox k={sel.k} setup={setup} runD={runD} />{phone && runD.result && <RunCompare base={result} over={runD.result} data={data} />}</div> :
            <div className="space-y-2"><H>{SECTION_NAMES[sel.k]} · Setup default</H><SectionHelp setup={setup} k={sel.k} /><SectionEditor k={sel.k} value={getSection(setup, sel.k)} setup={setup} ctx={tokenCtx(setup, 0, 99)} onChange={(v) => mutate((s) => { setSection(s, sel.k, v); })} /></div>
          )}
        </div>
        </Sheet>}
      </div>
    </div>
  );
  function side() { return sel.kind === 'step' || sel.kind === 'entry' ? setup.branches[sel.bi]?.side || 'long' : 'long'; }
}

function OverrideBox({ k, setup, runD }: { k: SectionKey; setup: any; runD: ReturnType<typeof useRunDraft> }) {
  const on = k in runD.draft.overrides;
  return (
    <div className="space-y-2">
      <div className="rounded-md bg-muted p-2 text-xs"><span className="text-muted-foreground">Setup default: </span><span className={cn(on && 'line-through')}>{sectionSummary(setup, k)}</span></div>
      {!on ? <Button size="sm" onClick={() => runD.override(k, true)}>Override for this Run</Button> : (
        <>
          <SectionEditor k={k} value={runD.draft.overrides[k]} setup={setup} ctx={tokenCtx(setup, 0, 99)} onChange={(v) => runD.setOverride(k, v)} />
          <div className="text-xs text-sky-300">This Run: {sectionSummary(runD.effective, k)}</div>
          <Button size="sm" variant="ghost" onClick={() => runD.override(k, false)}>Back to the default</Button>
        </>
      )}
    </div>
  );
}
const H = ({ children }: { children: React.ReactNode }) => <div className="text-lg font-bold tracking-tight">{children}</div>;
/** a section heading inside an inspector panel, one size under its title */
const H2 = ({ children }: { children: React.ReactNode }) => <div className="text-base font-semibold tracking-tight">{children}</div>;
const Locked = ({ what }: { what: string }) => <div className="space-y-1"><H>🔒 {what}</H><div className="text-xs text-muted-foreground">Part of the Setup version. A Run cannot change them; switch to "Build the Setup" and Freeze a new version.</div></div>;
const Chip = ({ children }: { children: React.ReactNode }) => <span className="inline-block rounded border border-sky-500/40 bg-sky-500/10 px-1.5 py-0.5 leading-tight text-sky-200">{children}</span>;
function Lib({ title, children }: { title: string; children: React.ReactNode }) { return <div><div className="mb-1.5 flex flex-wrap items-baseline gap-x-1.5 text-sm font-bold uppercase tracking-wider text-muted-foreground">{title.replace(/ \(.*\)$/, '')}{/\(.*\)$/.test(title) && <span className="text-[11px] font-medium normal-case tracking-normal">{title.match(/\((.*)\)$/)![1]}</span>}</div><div className="grid grid-cols-2 gap-1.5 lg:block lg:space-y-1">{children}</div></div>; }
function LibItem({ children, onClick, disabled, hint, large }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; hint?: string; large?: boolean }) {
  return <button disabled={disabled} onClick={onClick} className={cn('flex w-full flex-wrap items-center justify-between gap-x-1.5 rounded-md border border-input text-left font-medium hover:border-sky-400/50 hover:bg-accent disabled:opacity-40 lg:flex-nowrap', large ? 'min-h-12 py-1.5 pl-1.5 pr-3 text-base' : 'min-h-9 px-2.5 py-2 text-sm')}><span>{children}</span>{hint && <span className={cn('font-normal text-muted-foreground', large ? 'text-xs' : 'text-[11px]')}>{hint}</span>}</button>;
}
function LaneCard({ title, children, foot, color, selected, onClick, locked, wide, overridable, overridden }: { title: React.ReactNode; children: React.ReactNode; foot?: React.ReactNode; color: string; selected?: boolean; onClick: () => void; locked?: boolean; wide?: boolean; overridable?: boolean; overridden?: boolean }) {
  return (
    <div onClick={onClick} className={cn('flex shrink-0 cursor-pointer flex-col rounded-lg border bg-card p-2 transition', wide ? 'w-full sm:w-80' : 'w-full sm:w-64', selected && 'ring-2 ring-sky-400', locked && 'opacity-50', overridable && 'border-sky-500/50 border-dashed', overridden && 'bg-sky-500/10')} style={{ borderTop: `3px solid ${color}` }}>
      <div className="mb-1 flex items-center text-sm font-medium">{title}{locked && <span className="ml-auto text-xs">🔒</span>}{overridable && <span className="ml-auto text-[10px] text-sky-300">overridable</span>}</div>
      <div className="flex-1">{children}</div>
      {foot && <div className="mt-1 border-t pt-1">{foot}</div>}
    </div>
  );
}
function Connector({ st, label }: { st?: Step; label?: string }) {
  const t = label || [st?.same_bar && st?.within_bars === 0 ? 'same bar only' : st?.same_bar ? 'same bar ok' : 'later bar', st?.within_bars ? `≤ ${st.within_bars} bars` : '', st?.until ? `until ${st.until}` : '', st?.invalidate ? 'invalidation' : ''].filter(Boolean).join(' · ');
  const arrow = <span className="text-xl leading-none"><span className="sm:hidden">↓</span><span className="hidden sm:inline">→</span></span>;
  // the step → Entry link reads like the Wizard's "→ SIGNAL"
  // the step → Entry link: just the arrow (the Entry card says SIGNAL)
  if (label === '') return <div className="flex w-full shrink-0 items-center justify-center px-1 py-1 text-muted-foreground sm:w-16 sm:py-0">{arrow}</div>;
  return <div className="flex w-full shrink-0 flex-row items-center justify-center gap-1.5 px-1 py-1 text-center text-xs text-muted-foreground sm:w-24 sm:flex-col sm:gap-0.5 sm:py-0">{arrow}<span>{t}</span></div>;
}
function MiniCond({ c, labels, depth = 0 }: { c: Cond; labels: Record<string, string>; depth?: number }) {
  if (c.t === 'all' || c.t === 'any') {
    if (c.origin) return <div className="text-sm"><Badge tone="info">{c.origin.preset}{c.origin.edited ? ' (edited)' : ''}</Badge></div>;
    const J = c.t === 'all' ? 'AND' : 'OR';
    return <div className={cn('space-y-1', depth > 0 && 'ml-1 border-l-2 pl-1.5', c.t === 'any' ? 'border-amber-500/60' : 'border-cyan-500/60')}>{c.items.map((x, k) => <React.Fragment key={x.id}>{k > 0 && <div><span className={cn('inline-block rounded border px-1.5 py-0.5 text-xs font-black leading-none tracking-wider', c.t === 'all' ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300' : 'border-amber-500/50 bg-amber-500/15 text-amber-300')}>{J}</span></div>}<MiniCond c={x} labels={labels} depth={depth + 1} /></React.Fragment>)}{!c.items.length && <div className="text-sm italic text-muted-foreground">empty</div>}</div>;
  }
  if (c.t === 'cmp') return <div className="text-sm">{c.origin && <Badge tone="info" className="mr-1">{c.origin.preset}</Badge>}<Chip>{shortName(c.a, labels)}</Chip> {c.op} {c.mult && c.mult !== 1 ? `${c.mult}×` : ''}<Chip>{shortName(c.b || '?', labels)}</Chip></div>;
  if (c.t === 'pattern') return <div className="text-sm"><Badge tone="info">{c.side === 'long' ? '▲' : '▼'} {c.ref} forms</Badge></div>;
  if (c.t === 'fvg') return <div className="text-sm"><Badge tone="info">FVG {c.tf} ≥{c.min_gap_ticks}t → {c.capture}</Badge></div>;
  if (c.t === 'draw') return <div className="text-sm"><Badge tone="info">Draw on liquidity ≥ {c.min_framework_points} pts</Badge></div>;
  if (c.t === 'time') return <div className="text-sm">🕒 {c.start}–{c.end}</div>;
  if (c.t === 'for_n') return <div className="text-sm">for ≥ {c.n} bars: <MiniCond c={c.item} labels={labels} depth={depth + 1} /></div>;
  if (c.t === 'not') return <div className="text-sm">NOT <MiniCond c={c.item} labels={labels} depth={depth + 1} /></div>;
  return null;
}
void AddMenu;

/** a Run's result next to the Setup defaults' result (stacked on a phone) */
function RunCompare({ base, over, data }: { base: any; over: any; data: any }) {
  return (
    <div className="grid gap-2 text-xs sm:grid-cols-2">
      <div className="rounded-md border p-2"><div className="mb-1 font-medium text-muted-foreground">Setup defaults</div><RunSummary result={base} data={data} /></div>
      <div className="rounded-md border border-sky-500/40 bg-sky-500/5 p-2"><div className="mb-1 font-medium text-sky-300">With this Run's overrides</div><RunSummary result={over} data={data} /></div>
    </div>
  );
}

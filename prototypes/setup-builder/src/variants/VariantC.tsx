// PROTOTYPE variant C, "Lanes": each branch is a horizontal lane of cards, Step → Step → Entry → Trade, with the
// Sequence limits written on the connectors. A block library on the left inserts into the selected card; an inspector
// on the right edits it. Settings sit in a toolbar. "Run" mode locks the Signal cards and lets Trade sections be overridden in place.
import React, { useState } from 'react';
import { VariantProps } from '../types';
import { Chart, StepStats, RunSummary } from '../components/Chart';
import { CondEditor, tokenCtx, AddMenu, newCmp } from '../components/CondEditor';
import { BaseBarEditor, TradingHoursEditor, BehaviourEditor, SessionsEditor, IndicatorList, StepLimits, EntryEditor, SECTIONS, SectionEditor, getSection, setSection, sectionSummary, InPositionRules, indicatorUsage, SectionKey } from '../components/sections';
import { shortName } from '../components/TokenPicker';
import { Badge, Button, Card, Input, Select, STEP_COLORS, cn, Tabs } from '../components/ui';
import { Cond, PRESETS, uid, SECTION_NAMES, condPhrase, Step, addMirror } from '../model';
import { useRunDraft, INSTRUMENTS, instrumentWarnings } from '../runDraft';

type Sel = { kind: 'step'; bi: number; si: number } | { kind: 'entry'; bi: number } | { kind: 'trade' } | { kind: 'settings' } | { kind: 'section'; k: SectionKey };

export function VariantC(p: VariantProps) {
  const { setup, mutate, data, result } = p;
  const [sel, setSel] = useState<Sel>({ kind: 'step', bi: 0, si: 0 });
  const [mode, setMode] = useState<'build' | 'run'>('build');
  const runD = useRunDraft(data, setup);
  const labels = Object.fromEntries(setup.indicators.filter((i) => i.label).map((i) => [i.token, i.label!]));
  const insert = (c: Cond) => {
    if (sel.kind !== 'step') return;
    mutate((s) => { (s.branches[sel.bi].steps[sel.si].cond as any).items.push(c); });
  };
  const run = mode === 'run';
  const shown = run && runD.result ? runD.result : result;
  const usage = indicatorUsage(setup);
  const selStep = sel.kind === 'step' ? setup.branches[sel.bi]?.steps[sel.si] : null;

  return (
    <div className="flex h-[calc(100vh-40px)] flex-col">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-3 border-b px-3 py-2 text-xs">
        <Input value={setup.name} onChange={(e) => mutate((s) => { s.name = e.target.value; })} className="h-7 w-48 font-semibold" />
        <button onClick={() => setSel({ kind: 'settings' })} className="rounded border px-2 py-1 hover:bg-accent">Base bar <b>{setup.settings.base_bar}</b> · Trading hours <b>{setup.settings.trading_hours.ranges.map((r) => `${r.start}–${r.end}`).join(', ')}</b> · one at a time <b>{setup.settings.one_at_a_time.replace(/_/g, ' ')}</b> · news <b>{setup.settings.news_rule.mode}</b> ✎</button>
        <Tabs value={mode} onChange={(v) => setMode(v as 'build' | 'run')} tabs={[['build', 'Build the Setup'], ['run', 'Create a Run']]} />
        {run && <><Select value={runD.draft.instrument} onChange={(v) => runD.setDraft({ ...runD.draft, instrument: v })} options={INSTRUMENTS} className="h-7" />{instrumentWarnings(setup, runD.draft.instrument).map((w) => <span key={w} className="text-amber-300">{w}</span>)}</>}
        <div className="ml-auto">{p.saveBar}</div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[230px_minmax(0,1fr)_380px]">
        {/* library */}
        <div className={cn('space-y-3 overflow-auto border-r p-3 text-sm', run && 'pointer-events-none opacity-40')}>
          <Lib title="Indicators (declared once)">
            {setup.indicators.map((i) => (
              <LibItem key={i.token} onClick={() => insert({ id: uid(), t: 'cmp', a: i.token, op: '>', b: '' })} disabled={sel.kind !== 'step'} hint={`used ${usage[i.token] || 0}×`}>{i.label || shortName(i.token, {})}</LibItem>
            ))}
            <button className="text-xs text-sky-300" onClick={() => setSel({ kind: 'settings' })}>manage / declare…</button>
          </Lib>
          <Lib title="ICT presets">
            {[['FVG with Displacement', () => PRESETS.fvgWithDisplacement(setup.settings.base_bar, side())], ['Bias', () => PRESETS.bias(side())], ['Displacement', () => PRESETS.displacement(setup.settings.base_bar, side())], ['Draw on liquidity', () => PRESETS.draw(side())]].map(([l, f]: any) => <LibItem key={l} onClick={() => insert(f())} disabled={sel.kind !== 'step'}>{l}</LibItem>)}
          </Lib>
          <Lib title="Indicator presets">
            <LibItem onClick={() => insert(PRESETS.macdCross(setup.settings.base_bar, side()))} disabled={sel.kind !== 'step'}>MACD crosses signal</LibItem>
          </Lib>
          <Lib title="Logic">
            {[['Compare', () => newCmp(tokenCtx(setup, 0, 0))], ['All of', () => ({ id: uid(), t: 'all', items: [] })], ['Any of', () => ({ id: uid(), t: 'any', items: [] })], ['Not', () => ({ id: uid(), t: 'not', item: newCmp(tokenCtx(setup, 0, 0)) })], ['For at least N bars', () => ({ id: uid(), t: 'for_n', n: 3, item: newCmp(tokenCtx(setup, 0, 0)) })], ['Time range', () => ({ id: uid(), t: 'time', start: '10:00', end: '11:00' })], ['FVG detector', () => ({ id: uid(), t: 'fvg', side: side(), tf: setup.settings.base_bar, min_gap_ticks: 4, middle_closes_gap_way: true, capture: 'fvg' })]].map(([l, f]: any) => <LibItem key={l} onClick={() => insert(f())} disabled={sel.kind !== 'step'}>{l}</LibItem>)}
          </Lib>
          <div className="text-[11px] text-muted-foreground">Click to add to the selected step card.</div>
        </div>
        {/* lanes + chart */}
        <div className="flex min-w-0 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-auto p-3">
            {setup.branches.map((br, bi) => (
              <div key={br.id}>
                <div className="mb-1 flex items-center gap-2 text-xs"><Badge tone={br.side === 'long' ? 'ok' : 'error'}>{br.side.toUpperCase()}</Badge><span className="text-muted-foreground">a new first step while one runs: {br.on_new_start.replace('_', ' ')}</span>
                  {setup.branches.length === 1 && !run && <button className="text-sky-300" onClick={() => mutate((s) => { addMirror(s); })}>duplicate as mirrored {br.side === 'long' ? 'short' : 'long'}</button>}</div>
                <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
                  {br.steps.map((st, si) => (
                    <React.Fragment key={st.id}>
                      {si > 0 && <Connector st={st} />}
                      <LaneCard color={STEP_COLORS[si % 6]} selected={sel.kind === 'step' && sel.bi === bi && sel.si === si} locked={run} onClick={() => { setSel({ kind: 'step', bi, si }); p.setFocus({ bi, si }); }}
                        title={<><span className="mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-black" style={{ background: STEP_COLORS[si % 6] }}>{si + 1}</span>{st.name}</>}
                        foot={<StepStats result={result} bi={bi} si={si} data={data} />}>
                        <MiniCond c={st.cond} labels={labels} />
                        {st.capture_running && <div className="mt-1 text-[11px] text-muted-foreground">captures <span className="mono">{st.capture_running.name}</span> (running {st.capture_running.field})</div>}
                      </LaneCard>
                    </React.Fragment>
                  ))}
                  {!run && <button className="mx-2 self-center rounded-full border border-dashed px-2 py-6 text-xs text-muted-foreground hover:text-foreground" onClick={() => { mutate((s) => { s.branches[bi].steps.push({ id: uid('st'), name: 'New step', cond: { id: uid(), t: 'all', items: [] } }); }); setSel({ kind: 'step', bi, si: br.steps.length }); }}>+ step</button>}
                  <Connector label="Signal" />
                  <LaneCard color="#e2e8f0" selected={sel.kind === 'entry' && sel.bi === bi} onClick={() => setSel({ kind: 'entry', bi })} title="Entry" overridable={run} overridden={run && 'stop' in runD.draft.overrides}>
                    <div className="text-xs">{br.entry.order}{br.entry.order !== 'market' && <> at <Chip>{shortName(br.entry.price || '?', labels)}</Chip></>}</div>
                    <div className="mt-1 text-xs">stop {br.entry.stop.offset} {br.entry.stop.unit === 'atr' ? '× ATR' : 'ticks'} beyond <Chip>{shortName(br.entry.stop.token || '?', labels)}</Chip></div>
                  </LaneCard>
                  {bi === 0 && <>
                    <Connector label="fill" />
                    <LaneCard color="#94a3b8" selected={sel.kind === 'trade' || sel.kind === 'section'} onClick={() => setSel({ kind: 'trade' })} title="Trade" wide overridable={run}>
                      {SECTIONS.filter((k) => k !== 'stop').map((k) => {
                        const ov = run && k in runD.draft.overrides;
                        return (
                          <button key={k} onClick={(e) => { e.stopPropagation(); setSel({ kind: 'section', k }); }} className={cn('block w-full rounded px-1 py-0.5 text-left text-[11px] hover:bg-accent', sel.kind === 'section' && sel.k === k && 'bg-accent', ov && 'bg-sky-500/10')}>
                            <span className="font-medium">{SECTION_NAMES[k]}</span> <span className="text-muted-foreground">{sectionSummary(ov ? runD.effective : setup, k)}</span>{ov && <Badge tone="info" className="ml-1">override</Badge>}
                          </button>
                        );
                      })}
                      <div className={cn('mt-1 border-t pt-1 text-[11px] text-muted-foreground', run && 'opacity-50')}>{run && '🔒 '}{setup.in_position_rules.length} In-position rule(s)</div>
                    </LaneCard>
                  </>}
                </div>
              </div>
            ))}
          </div>
          <div className="border-t p-2">
            <div className="mb-1"><RunSummary result={shown} data={data} /></div>
            <Chart data={data} setup={setup} result={shown} day={p.day} setDay={p.setDay} focus={p.focus} selected={p.selected} setSelected={p.setSelected} height={260} compactBar />
          </div>
        </div>
        {/* inspector */}
        <div className="overflow-auto border-l p-3">
          {sel.kind === 'settings' && <div className="space-y-4"><H>Setup settings</H><BaseBarEditor setup={setup} mutate={mutate} /><TradingHoursEditor setup={setup} mutate={mutate} /><SessionsEditor setup={setup} mutate={mutate} /><BehaviourEditor setup={setup} mutate={mutate} /><H>Indicators</H><IndicatorList setup={setup} mutate={mutate} ctx={tokenCtx(setup, 0, 0)} usage={usage} /></div>}
          {sel.kind === 'step' && selStep && (
            run ? <Locked what="Signal steps" /> :
            <div className="space-y-3">
              <H>Step {sel.si + 1} · {setup.branches[sel.bi].side}</H>
              <Input value={selStep.name} onChange={(e) => mutate((s) => { s.branches[sel.bi].steps[sel.si].name = e.target.value; })} className="w-full" />
              <CondEditor cond={selStep.cond} ctx={tokenCtx(setup, sel.bi, sel.si)} side={setup.branches[sel.bi].side} look="chips" onChange={(c) => mutate((s) => { s.branches[sel.bi].steps[sel.si].cond = c; })} />
              <div className="rounded-md border p-2"><div className="mb-1 text-xs font-medium">Sequence limits</div><StepLimits step={selStep} isFirst={sel.si === 0} ctx={tokenCtx(setup, sel.bi, sel.si)} side={setup.branches[sel.bi].side} look="chips" onChange={(n: Step) => mutate((s) => { s.branches[sel.bi].steps[sel.si] = n; })} /></div>
              {sel.si === 0 && <div className="flex items-center gap-2 text-xs">a new first step while one runs <Select value={setup.branches[sel.bi].on_new_start} onChange={(v) => mutate((s) => { s.branches[sel.bi].on_new_start = v; })} options={[['start_another', 'start another'], ['replace', 'replace'], ['ignore', 'ignore']]} className="h-7" /></div>}
              <div className="flex gap-1"><Button size="sm" variant="ghost" disabled={sel.si === 0} onClick={() => { mutate((s) => { const a = s.branches[sel.bi].steps; [a[sel.si - 1], a[sel.si]] = [a[sel.si], a[sel.si - 1]]; }); setSel({ ...sel, si: sel.si - 1 }); }}>← move earlier</Button><Button size="sm" variant="ghost" onClick={() => { mutate((s) => { s.branches[sel.bi].steps.splice(sel.si, 1); }); setSel({ kind: 'trade' }); }}>delete</Button></div>
              <div className="rounded bg-muted p-2 text-[11px] text-muted-foreground">{condPhrase(selStep.cond, labels)}</div>
            </div>
          )}
          {sel.kind === 'entry' && (
            run ? <div className="space-y-2"><H>Stop · Run override</H><OverrideBox k="stop" setup={setup} runD={runD} /></div> :
            <div className="space-y-2"><H>Entry · {setup.branches[sel.bi].side}</H><EntryEditor setup={setup} mutate={mutate} bi={sel.bi} ctx={tokenCtx(setup, sel.bi, 99)} /></div>
          )}
          {sel.kind === 'trade' && (
            run ? <div className="space-y-2"><H>Create a Run</H><div className="text-xs text-muted-foreground">Pick a section on the Trade card to override it for this Run. Signal steps and In-position rules are locked: changing them makes a new Setup version.</div></div> :
            <div className="space-y-3"><H>Trade</H><div className="text-xs text-muted-foreground">Pick a section on the card, or edit In-position rules here.</div><H>In-position rules</H><InPositionRules setup={setup} mutate={mutate} ctx={tokenCtx(setup, 0, 99)} look="chips" /></div>
          )}
          {sel.kind === 'section' && (
            run ? <div className="space-y-2"><H>{SECTION_NAMES[sel.k]} · Run override</H><OverrideBox k={sel.k} setup={setup} runD={runD} /></div> :
            <div className="space-y-2"><H>{SECTION_NAMES[sel.k]} · Setup default</H><SectionEditor k={sel.k} value={getSection(setup, sel.k)} setup={setup} ctx={tokenCtx(setup, 0, 99)} onChange={(v) => mutate((s) => { setSection(s, sel.k, v); })} /></div>
          )}
        </div>
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
const H = ({ children }: { children: React.ReactNode }) => <div className="text-sm font-semibold">{children}</div>;
const Locked = ({ what }: { what: string }) => <div className="space-y-1"><H>🔒 {what}</H><div className="text-xs text-muted-foreground">Part of the Setup version. A Run cannot change them; switch to "Build the Setup" and Freeze a new version.</div></div>;
const Chip = ({ children }: { children: React.ReactNode }) => <span className="rounded border border-sky-500/40 bg-sky-500/10 px-1 text-sky-200">{children}</span>;
function Lib({ title, children }: { title: string; children: React.ReactNode }) { return <div><div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</div><div className="space-y-0.5">{children}</div></div>; }
function LibItem({ children, onClick, disabled, hint }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; hint?: string }) {
  return <button disabled={disabled} onClick={onClick} className="flex w-full items-center justify-between rounded px-1.5 py-1 text-left text-xs hover:bg-accent disabled:opacity-40"><span>{children}</span>{hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}</button>;
}
function LaneCard({ title, children, foot, color, selected, onClick, locked, wide, overridable, overridden }: { title: React.ReactNode; children: React.ReactNode; foot?: React.ReactNode; color: string; selected?: boolean; onClick: () => void; locked?: boolean; wide?: boolean; overridable?: boolean; overridden?: boolean }) {
  return (
    <div onClick={onClick} className={cn('flex shrink-0 cursor-pointer flex-col rounded-lg border bg-card p-2 transition', wide ? 'w-80' : 'w-64', selected && 'ring-2 ring-sky-400', locked && 'opacity-50', overridable && 'border-sky-500/50 border-dashed', overridden && 'bg-sky-500/10')} style={{ borderTop: `3px solid ${color}` }}>
      <div className="mb-1 flex items-center text-sm font-medium">{title}{locked && <span className="ml-auto text-xs">🔒</span>}{overridable && <span className="ml-auto text-[10px] text-sky-300">overridable</span>}</div>
      <div className="flex-1">{children}</div>
      {foot && <div className="mt-1 border-t pt-1">{foot}</div>}
    </div>
  );
}
function Connector({ st, label }: { st?: Step; label?: string }) {
  const t = label || [st?.same_bar && st?.within_bars === 0 ? 'same bar only' : st?.same_bar ? 'same bar ok' : 'later bar', st?.within_bars ? `≤ ${st.within_bars} bars` : '', st?.until ? `until ${st.until}` : '', st?.invalidate ? 'invalidation' : ''].filter(Boolean).join(' · ');
  return <div className="flex w-20 shrink-0 flex-col items-center justify-center px-1 text-center text-[10px] text-muted-foreground"><span>then</span><span className="text-lg leading-none">→</span><span>{t}</span></div>;
}
function MiniCond({ c, labels, depth = 0 }: { c: Cond; labels: Record<string, string>; depth?: number }) {
  if (c.t === 'all' || c.t === 'any') {
    if (c.origin) return <div className="text-xs"><Badge tone="info">{c.origin.preset}{c.origin.edited ? ' (edited)' : ''}</Badge></div>;
    return <div className={cn('space-y-0.5', depth > 0 && 'ml-1 border-l-2 pl-1.5', c.t === 'any' ? 'border-amber-500/60' : 'border-emerald-500/60')}>{depth > 0 && <div className="text-[10px] font-semibold text-muted-foreground">{c.t === 'all' ? 'AND' : 'OR'}</div>}{c.items.map((x) => <MiniCond key={x.id} c={x} labels={labels} depth={depth + 1} />)}{!c.items.length && <div className="text-xs italic text-muted-foreground">empty</div>}</div>;
  }
  if (c.t === 'cmp') return <div className="text-xs">{c.origin && <Badge tone="info" className="mr-1">{c.origin.preset}</Badge>}<Chip>{shortName(c.a, labels)}</Chip> {c.op} {c.mult && c.mult !== 1 ? `${c.mult}×` : ''}<Chip>{shortName(c.b || '?', labels)}</Chip></div>;
  if (c.t === 'fvg') return <div className="text-xs"><Badge tone="info">FVG {c.tf} ≥{c.min_gap_ticks}t → {c.capture}</Badge></div>;
  if (c.t === 'draw') return <div className="text-xs"><Badge tone="info">Draw on liquidity ≥ {c.min_framework_points} pts</Badge></div>;
  if (c.t === 'time') return <div className="text-xs">🕒 {c.start}–{c.end}</div>;
  if (c.t === 'for_n') return <div className="text-xs">for ≥ {c.n} bars: <MiniCond c={c.item} labels={labels} depth={depth + 1} /></div>;
  if (c.t === 'not') return <div className="text-xs">NOT <MiniCond c={c.item} labels={labels} depth={depth + 1} /></div>;
  return null;
}
void AddMenu;

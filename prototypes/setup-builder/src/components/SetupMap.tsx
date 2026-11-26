// PROTOTYPE: "the Setup at a glance". Each branch as a flow: When → Step → Step → Entry → Trade, with what each step
// reads and captures, the Sequence limits on the connectors, and what the branch did on the bars. Hovering a declared
// indicator or pattern lights up the steps that read it; clicking a step focuses it on the chart.
import React, { useState } from 'react';
import { Cond, Setup, Step, captureNames, condPhrase, labelsOf, patternRefs, tokensOf, PATTERN_KINDS, parseToken, patternUsage , tradingWindowText, stopPhrase } from '../model';
import { Data, RunResult } from '../engine';
import { shortName } from './TokenPicker';
import { PatternIcon, IndicatorIcon, SectionIcon } from './PatternIcon';
import { sectionSummary, indicatorUsage, ONE_AT_A_TIME } from './sections';
import { Focus } from './Chart';
import { STEP_COLORS, cn } from './ui';

type Hover = { kind: 'ind' | 'pat'; key: string } | null;

function topItems(c: Cond): Cond[] { return c.t === 'all' && !c.origin ? c.items : [c]; }
const KIND_TAG: Record<string, [string, string]> = {
  pattern: ['pattern', 'text-sky-300 bg-sky-500/10'], cmp: ['compare', 'text-slate-300 bg-slate-500/15'], time: ['time', 'text-amber-300 bg-amber-500/10'],
  draw: ['draw', 'text-violet-300 bg-violet-500/10'], any: ['any of', 'text-orange-300 bg-orange-500/10'], all: ['all of', 'text-cyan-300 bg-cyan-500/10'],
  not: ['not', 'text-red-300 bg-red-500/10'], for_n: ['for N bars', 'text-teal-300 bg-teal-500/10'], fvg: ['FVG', 'text-sky-300 bg-sky-500/10'],
};
function connectorText(st: Step) {
  const parts = [st.same_bar ? (st.within_bars === 0 ? 'same bar only' : 'same bar or later') : 'a later bar'];
  if (st.within_bars != null && st.within_bars > 0) parts.push(`within ${st.within_bars} bars`);
  if (st.until) parts.push(`until ${st.until}`);
  return parts;
}
const indKey = (t: string) => t.replace(/\.prev\[\d+\]$/, '');

export function SetupMap({ setup, result, data, focus, onStep, onDeclared, compact }: {
  setup: Setup; result: RunResult; data: Data; focus?: Focus | null; onStep?: (f: Focus) => void; onDeclared?: () => void; compact?: boolean;
}) {
  const [hover, setHover] = useState<Hover>(null);
  const labels = labelsOf(setup);
  const iu = indicatorUsage(setup), pu = patternUsage(setup);
  const uses = (st: Step) => {
    if (!hover) return false;
    const conds = [st.cond, st.hold, st.invalidate];
    if (hover.kind === 'pat') return conds.some((c) => patternRefs(c).includes(hover.key));
    return conds.some((c) => tokensOf(c).some((t) => indKey(t) === hover.key));
  };
  const ts = setup.trade_settings;
  const th = tradingWindowText(setup.settings.trading_hours);

  return (
    <div className="space-y-3">
      {/* declared once */}
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Configured</span>
        {setup.indicators.map((i) => (
          <button key={i.token} onMouseEnter={() => setHover({ kind: 'ind', key: i.token })} onMouseLeave={() => setHover(null)} onClick={onDeclared}
            className={cn('flex items-center gap-1 rounded-full border px-2 py-0.5 transition', hover?.key === i.token ? 'border-amber-400 bg-amber-500/10' : 'hover:bg-accent')}>
            <IndicatorIcon token={i.token} size={16} />{i.label?.replace(/^the /, '') || shortName(i.token, {})}<span className="text-muted-foreground">·{iu[i.token] || 0}</span>
          </button>
        ))}
        {(setup.patterns || []).map((p) => (
          <button key={p.name} onMouseEnter={() => setHover({ kind: 'pat', key: p.name })} onMouseLeave={() => setHover(null)} onClick={onDeclared}
            className={cn('flex items-center gap-1 rounded-full border px-2 py-0.5 transition', hover?.key === p.name ? 'border-sky-400 bg-sky-500/10' : 'hover:bg-accent')}>
            <PatternIcon kind={p.kind} size={16} /><span className="mono">{p.name}</span><span className="text-muted-foreground">{p.tf} {PATTERN_KINDS[p.kind].title.replace(/ \(.*\)$/, '')} ·{pu[p.name] || 0}</span>
          </button>
        ))}
        {!setup.indicators.length && !(setup.patterns || []).length && <span className="italic text-muted-foreground">no indicators or patterns configured yet</span>}
        {hover && <span className="text-[11px] text-muted-foreground">lights up the steps that read it</span>}
      </div>

      {setup.branches.map((br, bi) => {
        const sigs = result.signals.filter((s) => s.branch === bi);
        const taken = sigs.filter((s) => !s.refused && s.trade?.r != null);
        const r = taken.reduce((a, s) => a + (s.trade!.r || 0), 0);
        const long = br.side === 'long';
        const caps: string[] = [];
        return (
          <div key={br.id} className="rounded-xl border bg-background/40 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
              <span className={cn('rounded-md px-1.5 py-0.5 font-semibold uppercase tracking-wide', long ? 'bg-cyan-500/15 text-cyan-300' : 'bg-red-500/15 text-red-300')}>{long ? '▲ long' : '▼ short'}</span>
              <span className="text-muted-foreground">when a new setup appears before the last one finished: <span className="text-foreground">{({ start_another: 'follow both', replace: 'switch to the new one', ignore: 'stay with the first one' } as Record<string, string>)[br.on_new_start]}</span></span>
              <span className="flex-1" />
              <span className="tabular-nums"><b>{sigs.length}</b> <span className="text-muted-foreground">Signals</span></span>
              <span className="tabular-nums"><b>{taken.length}</b> <span className="text-muted-foreground">Trades</span></span>
              <span className={cn('font-semibold tabular-nums', r >= 0 ? 'text-emerald-400' : 'text-red-400')}>{r >= 0 ? '+' : ''}{r.toFixed(2)}R</span>
            </div>
            <div className="flex flex-col items-stretch gap-0 pb-1 sm:flex-row sm:overflow-x-auto">
              <Node title="When" tone="muted" compact={compact}>
                <Line k="Base bar" v={setup.settings.base_bar} />
                <Line k="hours" v={`${th} NY`} />
                {!compact && <Line k="trade overlap" v={(ONE_AT_A_TIME[setup.settings.one_at_a_time]?.[0] || '').replace(/:.*$/, '').replace(/^./, (c) => c.toLowerCase())} />}
              </Node>
              {br.steps.map((st, si) => {
                const own = [...captureNames(st.cond), ...(st.capture_running ? [st.capture_running.name] : [])];
                const before = [...caps];
                caps.push(...own);
                const done = result.stepDone[bi]?.[si]?.length || 0;
                const isFocus = focus?.bi === bi && focus?.si === si;
                const lit = uses(st);
                const reads = [...new Set(tokensOf(st.cond).map((t) => parseToken(t).parts[0] === 'capture' ? parseToken(t).parts[1].split('.')[0] : null).filter((x): x is string => !!x && before.includes(x)))];
                return (
                  <React.Fragment key={st.id}>
                    <Arrow lines={si === 0 ? ['starts a Candidate'] : connectorText(st)} warn={!!st.invalidate} />
                    <button onClick={() => onStep?.({ bi, si })}
                      className={cn('flex flex-col sm:min-w-[170px] sm:flex-1 sm:basis-0 justify-start rounded-lg border bg-card p-2.5 text-left transition hover:border-foreground/30', isFocus && 'ring-2 ring-sky-400/60', lit && 'border-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.15)]', hover && !lit && 'opacity-50')}
                      style={{ borderTopColor: STEP_COLORS[si % 6], borderTopWidth: 3 }}>
                      <div className="flex items-center gap-1.5">
                        <span className="flex aspect-square h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] leading-none font-bold text-black" style={{ background: STEP_COLORS[si % 6] }}>{si + 1}</span>
                        <span className="truncate text-sm font-medium">{st.name}</span>
                      </div>
                      <ul className="mt-1.5 space-y-1">
                        {topItems(st.cond).slice(0, compact ? 3 : 6).map((c) => {
                          const [tag, cls] = c.origin ? [c.origin.preset + (c.origin.edited ? '*' : ''), 'text-sky-200 bg-sky-500/10'] : KIND_TAG[c.t] || [c.t, ''];
                          return (
                            <li key={c.id} className="flex items-start gap-1.5 text-[11px] leading-snug">
                              <span className={cn('shrink-0 rounded px-1 py-px text-[10px] font-medium', cls)}>{tag}</span>
                              <span className="line-clamp-2 text-muted-foreground">{condPhrase(c, labels)}</span>
                            </li>
                          );
                        })}
                        {topItems(st.cond).length > (compact ? 3 : 6) && <li className="text-[10px] text-muted-foreground">+{topItems(st.cond).length - (compact ? 3 : 6)} more</li>}
                        {!topItems(st.cond).length && <li className="text-[11px] italic text-muted-foreground">empty</li>}
                      </ul>
                      <span className="min-h-2 flex-1" />
                      {st.invalidate && <div className="mt-1 text-[10px] text-red-300/80">✕ unless {condPhrase(st.invalidate, labels)}</div>}
                      <div className="mt-auto flex flex-wrap items-center gap-1 border-t pt-1.5 text-[10px]" style={{ marginTop: 'auto' }}>
                        {reads.map((n) => <span key={n} className="mono rounded bg-muted px-1 text-muted-foreground">← {n}</span>)}
                        {own.map((n) => <span key={n} className="mono rounded bg-emerald-500/10 px-1 text-emerald-300">→ {n}</span>)}
                        <span className="ml-auto tabular-nums text-muted-foreground"><b className="text-foreground">{done}</b> completions</span>
                      </div>
                    </button>
                  </React.Fragment>
                );
              })}
              <Arrow lines={['Signal']} />
              <Node title="Entry" tone={long ? 'long' : 'short'} compact={compact}>
                <Line k="order" v={br.entry.order === 'market' ? 'market, next bar' : `${br.entry.order} at ${shortName(br.entry.price || '?', labels)}`} />
                <Line k="stop loss" icon="stop" v={stopPhrase(br.entry.stop, br.side, (t) => shortName(t || '?', labels))} bad={(br.entry.stop.from || 'level') === 'level' && !br.entry.stop.token} />
              </Node>
              <Arrow lines={['fill']} />
              <Node title="Trade" tone="muted" compact={compact} wide>
                <Line k="risk" icon="risk" v={sectionSummary(setup, 'risk')} />
                <Line k="take profits" icon="legs" v={sectionSummary(setup, 'legs')} />
                <Line k="break-even" icon="break_even" v={sectionSummary(setup, 'break_even')} />
                {!compact && <Line k="deadline" icon="entry_deadline" v={sectionSummary(setup, 'entry_deadline')} />}
                <Line k="flat by" icon="expiry_and_flatten" v={ts.flatten_time} />
                {!compact && ts.signal_guards.length > 0 && <Line k="guards" icon="signal_guards" v={sectionSummary(setup, 'signal_guards')} />}
                {setup.in_position_rules.filter((x) => x.branch === undefined || x.branch === bi).length > 0 && <Line k="while in a Trade" icon="in_position" v={`${setup.in_position_rules.filter((x) => x.branch === undefined || x.branch === bi).length} rule(s)`} />}
              </Node>
            </div>
          </div>
        );
      })}
      {void data}
    </div>
  );
}

function Node({ title, tone, children, compact, wide }: { title: string; tone: 'muted' | 'long' | 'short'; children: React.ReactNode; compact?: boolean; wide?: boolean }) {
  return (
    <div className={cn('shrink-0 rounded-lg border p-2.5', wide ? 'w-full sm:w-[215px]' : 'w-full sm:w-[150px]', tone === 'muted' ? 'bg-muted/40' : tone === 'long' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5', compact && 'p-2')}>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}
function Line({ k, v, bad, icon }: { k: string; v: string; bad?: boolean; icon?: string }) {
  return <div className="flex items-start gap-1 text-[11px] leading-snug">{icon && <SectionIcon k={icon} size={13} className="mt-px shrink-0" />}<span><span className="text-muted-foreground">{k} </span><span className={cn(bad && 'text-red-300')}>{v}</span></span></div>;
}
function Arrow({ lines, warn }: { lines: string[]; warn?: boolean }) {
  return (
    <div className="flex w-full shrink-0 flex-row flex-wrap items-center justify-center gap-x-1.5 px-1 py-1 text-center text-[10px] leading-tight text-muted-foreground sm:w-[50px] sm:flex-col sm:flex-nowrap sm:gap-0 sm:py-0">
      {lines.map((l) => <span key={l}>{l}</span>)}
      <svg width="10" height="16" className="order-first sm:hidden"><line x1="5" y1="0" x2="5" y2="10" stroke="currentColor" strokeWidth="1.2" /><path d="M1 10 L5 16 L9 10 Z" fill="currentColor" /></svg>
      <svg width="44" height="10" className="my-0.5 hidden sm:block"><line x1="0" y1="5" x2="41" y2="5" stroke="currentColor" strokeWidth="1.2" /><path d="M41 1 L48 5 L41 9 Z" fill="currentColor" /></svg>
      {warn && <span className="text-red-300/80">can be invalidated</span>}
    </div>
  );
}

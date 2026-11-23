// PROTOTYPE, throwaway: Step-by-step builder (issue #76). Three variants on one page, switched by ?variant=A|B|C.
import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Data, parseCsv, run, Signal } from './engine';
import { Setup, STARTERS, validate, hashSetup, ruleDescription, addMirror } from './model';
import { Focus } from './components/Chart';
import { Switcher } from './components/Switcher';
import { HelpProvider, HelpToggle } from './components/help';
import { Badge, Button, Select, cn } from './components/ui';
import { VariantA } from './variants/VariantA';
import { VariantB } from './variants/VariantB';
import { VariantC } from './variants/VariantC';

// letters as shown in the switcher: B is the Wizard without its declaring step (VariantA inline), D the Document (VariantB.tsx)
const VARIANTS: [string, string][] = [['A', 'Wizard'], ['B', 'Inline'], ['C', 'Lanes'], ['D', 'Document']];
const qs = () => new URLSearchParams(location.search);

export default function App() {
  const [data, setData] = useState<Data | null>(null);
  const [variant, setVariant] = useState(qs().get('variant') || 'A');
  const [starter, setStarter] = useState(qs().get('setup') || 'silver_bullet');
  const [setup, setSetup] = useState<Setup>(() => STARTERS[qs().get('setup') || 'silver_bullet']());
  const [day, setDay] = useState(0);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [selected, setSelected] = useState<Signal | null>(null);
  const [versions, setVersions] = useState<{ v: number; hash: string; at: string }[]>([]);
  const [saved, setSaved] = useState<string>('');
  const [showJson, setShowJson] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => { fetch('./data/mnq_1m.csv').then((r) => r.text()).then((t) => setData(parseCsv(t))); }, []);
  const mutate = (fn: (s: Setup) => void) => setSetup((s) => { const c = structuredClone(s); fn(c); return c; });
  const deferred = useDeferredValue(setup);
  const result = useMemo(() => (data ? run(data, deferred) : null), [data, deferred]);
  useEffect(() => { if (result && data && day === 0 && result.signals.length) setDay(data.m1[result.signals[0].i].di); }, [result, data]);
  useEffect(() => { setSelected(null); }, [day]);
  const setV = (v: string) => { setVariant(v); const q = qs(); q.set('variant', v); try { history.replaceState(null, '', '?' + q); } catch { /* a published page has no address bar to update */ } };
  const loadStarter = (k: string) => { setStarter(k); setSetup(STARTERS[k]()); setVersions([]); setSaved(''); setFocus(null); setDay(0); const q = qs(); q.set('setup', k); try { history.replaceState(null, '', '?' + q); } catch { /* a published page has no address bar to update */ } };
  const issues = validate(setup);
  const errors = issues.filter((i) => i.level === 'error');
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(''), 3500); };
  const json = JSON.stringify(setup, null, 2);

  const saveDraft = () => { setSaved(json); flash(`Draft saved${issues.length ? ` with ${issues.length} warning(s)` : ''} (in memory only).`); };
  const freeze = async () => {
    if (errors.length) { flash(`Freeze refused: ${errors.length} error(s). ${errors[0].text}`); return; }
    const hash = await hashSetup(setup);
    const same = versions.find((v) => v.hash === hash);
    if (same) { flash(`Freeze refused: this is v${same.v} (same hash).`); return; }
    setVersions([...versions, { v: versions.length + 1, hash, at: new Date().toLocaleTimeString() }]);
    flash(`Frozen as v${versions.length + 1} · ${hash.slice(0, 12)}…`);
  };
  const exportFile = () => {
    const blob = new Blob([JSON.stringify({ ...setup, rule_description: ruleDescription(setup) }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${setup.setup_id}.draft.json`; a.click();
  };
  const dirty = saved !== json;
  const saveBar = (
    <div className="flex flex-wrap items-center gap-1.5">
      {issues.length > 0 && <Badge tone={errors.length ? 'error' : 'warn'} title={issues.map((i) => `${i.where}: ${i.text}`).join('\n')}>{errors.length} errors · {issues.length - errors.length} warnings</Badge>}
      {!issues.length && <Badge tone="go">valid</Badge>}
      <Button size="sm" variant="outline" onClick={saveDraft}>{dirty ? 'Save Draft' : 'Draft saved'}</Button>
      <Button size="sm" variant={errors.length ? 'outline' : 'default'} onClick={freeze} title="Freeze makes an immutable numbered Setup version">Freeze → v{versions.length + 1}</Button>
      <Button size="sm" variant="ghost" onClick={exportFile}>Export file</Button>
      <Button size="sm" variant="ghost" onClick={() => setShowJson(!showJson)}>{showJson ? 'Hide' : 'Show'} file</Button>
    </div>
  );

  if (!data || !result) return <div className="p-8 text-muted-foreground">Loading 35 Trading days of MNQ 1m bars…</div>;
  const props = { data, setup, mutate, result, day, setDay, focus, setFocus, selected, setSelected, saveBar };
  return (
    <HelpProvider>
    <div className="min-h-screen pb-20">
      <div className="z-40 flex flex-wrap items-center gap-2 border-b bg-background/80 px-4 py-2 text-xs backdrop-blur md:sticky md:top-0">
        <span className="flex items-center gap-2 pr-2 text-sm font-semibold tracking-tight"><span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-sky-400 to-indigo-500 text-[11px] font-bold text-white">S</span>Setup builder</span>
        <Badge tone="warn">PROTOTYPE · throwaway</Badge>
        <span className="text-muted-foreground">Select Setup</span>
        <Select value={starter} onChange={loadStarter} options={[['silver_bullet', 'Silver Bullet (built)'], ['ema_macd', 'EMA 200 + MACD (built)'], ['double_bottom', 'Double bottom (chart-pattern demo)'], ['blank', 'a blank Setup']]} className="h-7 text-xs" />
        {setup.branches.length === 1 && <Button size="sm" variant="ghost" onClick={() => mutate((s) => { addMirror(s); })}>Duplicate as mirrored {setup.branches[0].side === 'long' ? 'short' : 'long'}</Button>}
        {versions.length > 0 && <span className="text-muted-foreground">versions: {versions.map((v) => <span key={v.v} className="mono mr-1">v{v.v}·{v.hash.slice(0, 8)}</span>)}</span>}
        <span className="ml-auto flex flex-wrap items-center gap-3"><HelpToggle /><span className="text-muted-foreground">nothing is persisted · reload to reset</span></span>
      </div>
      {variant === 'A' && <VariantA {...props} />}
      {variant === 'B' && <VariantA {...props} inline />}
      {variant === 'C' && <VariantC {...props} />}
      {variant === 'D' && <VariantB {...props} />}
      {showJson && (
        <div className="fixed inset-x-3 top-12 z-[70] max-h-[80vh] overflow-auto rounded-lg border bg-card p-3 shadow-2xl sm:inset-x-auto sm:right-3 sm:h-[75vh] sm:max-h-none sm:w-[460px]">
          <div className="sticky -top-3 -mx-3 -mt-3 mb-2 flex items-center justify-between border-b bg-card px-3 py-2"><b>The Setup file (Draft)</b><button aria-label="close" onClick={() => setShowJson(false)} className="flex h-7 w-7 items-center justify-center rounded-md border border-input text-lg leading-none text-muted-foreground hover:bg-accent">×</button></div>
          <pre className="mono whitespace-pre-wrap text-[11px] text-muted-foreground">{ruleDescription(setup)}</pre>
          <hr className="my-2" />
          {issues.map((i, k) => <div key={k} className={cn('text-xs', i.level === 'error' ? 'text-red-300' : 'text-amber-300')}>{i.where}: {i.text}</div>)}
          <pre className="mono mt-2 text-[11px]">{json}</pre>
        </div>
      )}
      {toast && <div className="fixed left-1/2 top-14 z-[90] -translate-x-1/2 rounded-md border bg-card px-3 py-2 text-sm shadow-xl">{toast}</div>}
      <Switcher variants={VARIANTS} current={variant} onChange={setV} />
    </div>
    </HelpProvider>
  );
}

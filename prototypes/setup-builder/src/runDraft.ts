// PROTOTYPE: a Run binds a Setup version to an instrument and may override whole Trade-settings sections.
import { useMemo, useState } from 'react';
import { Data, run } from './engine';
import { Setup, tradingWindowText } from './model';
import { parseInstrument } from './components/InstrumentSelect';
import { SectionKey, getSection, setSection } from './components/sections';
export interface RunDraft { instrument: string; overrides: Partial<Record<SectionKey, any>> }
export function applyOverrides(s: Setup, r: RunDraft): Setup {
  const c = structuredClone(s);
  for (const [k, v] of Object.entries(r.overrides)) setSection(c, k as SectionKey, structuredClone(v));
  return c;
}
export function useRunDraft(data: Data, setup: Setup) {
  const [draft, setDraft] = useState<RunDraft>({ instrument: 'MNQ', overrides: {} });
  const effective = useMemo(() => applyOverrides(setup, draft), [setup, draft]);
  const result = useMemo(() => (Object.keys(draft.overrides).length ? run(data, effective) : null), [data, effective, draft]);
  const override = (k: SectionKey, on: boolean) => setDraft((d) => { const o = { ...d.overrides }; if (on) o[k] = structuredClone(getSection(setup, k)); else delete o[k]; return { ...d, overrides: o }; });
  const setOverride = (k: SectionKey, v: any) => setDraft((d) => ({ ...d, overrides: { ...d.overrides, [k]: v } }));
  return { draft, setDraft, effective, result, override, setOverride };
}
export function instrumentWarnings(s: Setup, inst: string) {
  const out: string[] = [];
  const p = parseInstrument(inst);
  if (p.type === 'forex' && JSON.stringify(s).includes(':volume:')) out.push('This Setup reads volume, which spot FX lacks: the Run would be refused.');
  if (p.type === 'stock' || p.type === 'option') {
    const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
    const outside = s.settings.trading_hours.ranges.some((r) => mins(r.start) > mins(r.end) || mins(r.start) < 570 || mins(r.end) > 960);
    if (outside) out.push(`${p.type === 'stock' ? 'Stocks' : 'Options'} trade 09:30–16:00 New York; this Setup's Trading window (${tradingWindowText(s.settings.trading_hours)}) reaches outside it, so Signals then would be refused.`);
  }
  if (p.type === 'option') out.push('This prototype does not price options: the preview shows the underlying\'s moves, not the option\'s.');
  if (inst !== 'MNQ') out.push(`No ${p.type === 'option' ? p.code : inst} bars in this prototype: the preview stays on MNQ.`);
  return out;
}

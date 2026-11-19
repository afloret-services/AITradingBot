// PROTOTYPE: a Run binds a Setup version to an instrument and may override whole Trade-settings sections.
import { useMemo, useState } from 'react';
import { Data, run } from './engine';
import { Setup } from './model';
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
export const INSTRUMENTS = [['MNQ', 'MNQ (bars loaded)'], ['MES', 'MES'], ['NQ', 'NQ'], ['ES', 'ES'], ['M6E', 'M6E (EUR/USD micro future)'], ['EURUSD', 'EUR/USD spot (no volume)']] as [string, string][];
export function instrumentWarnings(s: Setup, inst: string) {
  const out: string[] = [];
  if (inst === 'EURUSD' && JSON.stringify(s).includes(':volume:')) out.push('This Setup reads volume, which spot FX lacks: the Run would be refused.');
  if (inst !== 'MNQ') out.push(`No ${inst} bars in this prototype: the preview stays on MNQ.`);
  return out;
}

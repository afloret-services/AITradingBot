// PROTOTYPE: descriptions can be turned off everywhere, or hidden one by one. A hidden description hides every copy of
// the same kind (e.g. all the Sequence-limit sentences), and leaves a small link to bring it back. Remembered per browser.
import React, { createContext, useContext, useEffect, useState } from 'react';

interface HelpState { all: boolean; hidden: string[]; setAll: (b: boolean) => void; hide: (id: string) => void; show: (id: string) => void; showAllHidden: () => void }
const Ctx = createContext<HelpState>({ all: true, hidden: [], setAll: () => {}, hide: () => {}, show: () => {}, showAllHidden: () => {} });
const read = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage blocked: keep it for this visit only */ } };

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [all, setAll] = useState<boolean>(() => read('setupBuilder.help.all', true));
  const [hidden, setHidden] = useState<string[]>(() => read('setupBuilder.help.hidden', []));
  useEffect(() => write('setupBuilder.help.all', all), [all]);
  useEffect(() => write('setupBuilder.help.hidden', hidden), [hidden]);
  return (
    <Ctx.Provider value={{ all, hidden, setAll, hide: (id) => setHidden((h) => (h.includes(id) ? h : [...h, id])), show: (id) => setHidden((h) => h.filter((x) => x !== id)), showAllHidden: () => setHidden([]) }}>
      {children}
    </Ctx.Provider>
  );
}
export const useHelp = () => useContext(Ctx);

/** the id a description box takes when its caller does not name one */
export const HelpIdCtx = createContext<string>('');
/** give every description a help component renders the same id */
export function withHelpId<P extends object>(C: (p: P) => React.ReactElement | null, id: (p: P) => string) {
  const W = (p: P) => <HelpIdCtx.Provider value={id(p)}><C {...p} /></HelpIdCtx.Provider>;
  return W;
}

/** a description box, with its own "hide" */
export function HelpBox({ id, children, className }: { id?: string; children: React.ReactNode; className?: string }) {
  const h = useHelp();
  const ctxId = useContext(HelpIdCtx);
  const key = id || ctxId || 'description';
  if (!h.all) return null;
  if (h.hidden.includes(key)) return <ShowLink onClick={() => h.show(key)} />;
  return (
    <div className={'group/help relative space-y-1 rounded-md border-l-2 border-sky-500/50 bg-sky-500/5 py-1.5 pl-2.5 pr-12 text-xs leading-relaxed text-muted-foreground ' + (className || '')}>
      {children}
      <button onClick={() => h.hide(key)} title="Hide this description (it comes back with “show description”)" className="absolute right-1.5 top-1 rounded px-1 text-[10px] text-muted-foreground/70 hover:bg-accent hover:text-foreground">hide ✕</button>
    </div>
  );
}
/** any other description element (a one-line note), hidden the same way */
export function Hideable({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const h = useHelp();
  if (!h.all) return null;
  if (h.hidden.includes(id)) return <ShowLink onClick={() => h.show(id)} />;
  return (
    <div className={'group/help relative pr-12 ' + (className || '')}>
      {children}
      <button onClick={() => h.hide(id)} title="Hide this description" className="absolute right-0 top-0 rounded px-1 text-[10px] text-muted-foreground/70 opacity-0 hover:bg-accent hover:text-foreground group-hover/help:opacity-100 focus:opacity-100">hide ✕</button>
    </div>
  );
}
function ShowLink({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="text-[10px] text-sky-300/70 hover:text-sky-300">ⓘ show description</button>;
}

/** the top-bar control: all descriptions on or off, and bring back the hidden ones */
export function HelpToggle() {
  const h = useHelp();
  return (
    <span className="flex items-center gap-1.5">
      <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground">
        <span onClick={() => h.setAll(!h.all)} role="switch" aria-checked={h.all} className={'relative h-4 w-7 rounded-full transition ' + (h.all ? 'bg-sky-500' : 'bg-input')}>
          <span className={'absolute top-0.5 h-3 w-3 rounded-full bg-white transition ' + (h.all ? 'left-[14px]' : 'left-0.5')} />
        </span>
        <span onClick={() => h.setAll(!h.all)}>Descriptions</span>
      </label>
      {h.all && h.hidden.length > 0 && <button onClick={h.showAllHidden} className="rounded px-1 text-sky-300 hover:bg-accent">show {h.hidden.length} hidden</button>}
    </span>
  );
}

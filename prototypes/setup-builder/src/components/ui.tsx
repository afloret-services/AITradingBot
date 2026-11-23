// PROTOTYPE: shadcn/ui-styled primitives, hand-written so the prototype needs no generator.
import React from 'react';
export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function Button({ variant = 'default', size = 'md', className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive'; size?: 'sm' | 'md' | 'icon' }) {
  const v = { default: 'bg-primary text-primary-foreground shadow-sm hover:brightness-110', outline: 'border border-input bg-card/40 hover:bg-accent', ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground', secondary: 'bg-secondary text-secondary-foreground hover:bg-accent', destructive: 'bg-destructive text-white hover:opacity-90' }[variant];
  const s = { sm: 'h-7 px-2 text-xs', md: 'h-9 px-3 text-sm', icon: 'h-7 w-7 text-sm' }[size];
  return <button {...p} className={cn('inline-flex items-center justify-center gap-1 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap', v, s, className)} />;
}
export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) { return <div {...p} className={cn('rounded-xl border bg-card/90 text-card-foreground shadow-card backdrop-blur', className)} />; }
export function CardHeader({ title, sub, right }: { title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode }) {
  return <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b px-4 py-4 sm:flex-nowrap sm:px-5"><div className="min-w-0 basis-full sm:basis-auto"><div className="text-[15px] font-semibold leading-tight tracking-tight">{title}</div>{sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}</div>{right}</div>;
}
export function Badge({ className, tone = 'default', ...p }: React.HTMLAttributes<HTMLSpanElement> & { tone?: 'default' | 'outline' | 'warn' | 'error' | 'ok' | 'info' }) {
  const t = { default: 'bg-secondary text-secondary-foreground', outline: 'border text-muted-foreground', warn: 'bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-500/20', error: 'bg-red-500/10 text-red-300 ring-1 ring-inset ring-red-500/20', ok: 'bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-500/20', info: 'bg-sky-500/10 text-sky-300 ring-1 ring-inset ring-sky-500/20' }[tone];
  return <span {...p} className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium', t, className)} />;
}
export function Input({ className, ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cn('h-8 rounded-md border border-input bg-background/40 px-2 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30', className)} />;
}
export function NumInput({ value, onChange, className, step = 1, ...p }: { value: number | undefined; onChange: (n: number) => void; className?: string; step?: number } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'>) {
  return <Input {...p} type="number" step={step} value={value ?? ''} onChange={(e) => onChange(Number(e.target.value))} className={cn('w-20', className)} />;
}
export function Select<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: (T | [T, string])[]; className?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as T)} className={cn('h-8 rounded-md border border-input bg-card px-1.5 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30', className)}>
      {options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return <option key={v} value={v}>{l}</option>; })}
    </select>
  );
}
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (b: boolean) => void; label?: React.ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
      <span onClick={() => onChange(!checked)} className={cn('relative h-5 w-9 rounded-full transition', checked ? 'bg-sky-500' : 'bg-input')}>
        <span className={cn('absolute top-0.5 h-4 w-4 rounded-full bg-white transition', checked ? 'left-[18px]' : 'left-0.5')} />
      </span>
      {label}
    </label>
  );
}
export function Tabs<T extends string>({ value, onChange, tabs, className }: { value: T; onChange: (v: T) => void; tabs: [T, React.ReactNode][]; className?: string }) {
  return (
    <div className={cn('inline-flex rounded-md bg-muted p-0.5', className)}>
      {tabs.map(([v, l]) => <button key={v} onClick={() => onChange(v)} className={cn('rounded px-2.5 py-1 text-xs font-medium', value === v ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}>{l}</button>)}
    </div>
  );
}
export const Label = ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={cn('text-xs font-medium text-muted-foreground', className)}>{children}</div>;
export const Field = ({ label, children, hint }: { label: React.ReactNode; children: React.ReactNode; hint?: React.ReactNode }) => (
  <div className="space-y-1"><Label>{label}</Label><div className="flex flex-wrap items-center gap-2">{children}</div>{hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}</div>
);
export const STEP_COLORS = ['#38bdf8', '#a78bfa', '#f472b6', '#fbbf24', '#34d399', '#fb923c'];
export const SectionTitle = ({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) => <div className="mb-2 flex items-center justify-between"><div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</div>{right}</div>;

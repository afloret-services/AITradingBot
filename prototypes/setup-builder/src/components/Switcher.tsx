// PROTOTYPE: floating variant switcher (← → keys too). Hidden in production builds.
import React, { useEffect } from 'react';
export function Switcher({ variants, current, onChange }: { variants: [string, string][]; current: string; onChange: (v: string) => void }) {
  const idx = Math.max(0, variants.findIndex((v) => v[0] === current));
  const go = (d: number) => onChange(variants[(idx + d + variants.length) % variants.length][0]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full border-2 border-fuchsia-400 bg-black px-2 py-1 text-sm text-white shadow-[0_8px_30px_rgba(217,70,239,0.35)]">
      <button onClick={() => go(-1)} className="rounded-full px-2 hover:bg-white/10">←</button>
      <span className="px-2 font-medium">PROTOTYPE · {variants[idx][0]} ({variants[idx][1]})</span>
      <button onClick={() => go(1)} className="rounded-full px-2 hover:bg-white/10">→</button>
    </div>
  );
}

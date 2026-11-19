import type { Data, RunResult, Signal } from './engine';
import type { Setup } from './model';
import type { Focus } from './components/Chart';
import type { Mutate } from './components/sections';
export interface VariantProps {
  data: Data; setup: Setup; mutate: Mutate; result: RunResult;
  day: number; setDay: (d: number) => void; focus: Focus | null; setFocus: (f: Focus | null) => void;
  selected: Signal | null; setSelected: (s: Signal | null) => void;
  saveBar: React.ReactNode;
}

// PROTOTYPE: a small glyph per pattern kind (24×24, bullish version), drawn in currentColor, shown next to its label.
import React from 'react';
import type { PatternKind } from '../model';

const UP = '#26a69a', DN = '#ef5350', ZN = '#38bdf8', LV = '#fbbf24';
/** a candle: x, open, high, low, close in a 0–24 grid (y grows down, so a smaller number is higher) */
const K = ({ x, o, h, l, c, w = 4 }: { x: number; o: number; h: number; l: number; c: number; w?: number }) => {
  const col = c < o ? UP : DN;
  return <g><line x1={x} x2={x} y1={h} y2={l} stroke={col} strokeWidth={1.2} /><rect x={x - w / 2} y={Math.min(o, c)} width={w} height={Math.max(1, Math.abs(o - c))} fill={col} rx={0.6} /></g>;
};
const L = ({ d, color = 'currentColor', w = 1.6, dash }: { d: string; color?: string; w?: number; dash?: boolean }) => <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash ? '2 1.6' : undefined} />;

const GLYPHS: Record<PatternKind, React.ReactNode> = {
  fvg: <><rect x={4} y={9} width={17} height={4} fill={ZN} opacity={0.3} /><K x={6} o={17} h={13} l={19} c={14} /><K x={12} o={15} h={5} l={16} c={6} /><K x={18} o={7} h={4} l={9} c={5} /></>,
  displacement: <><K x={5} o={14} h={12} l={16} c={13} w={3} /><K x={10} o={13} h={11} l={15} c={14} w={3} /><K x={17} o={19} h={3} l={20} c={4} w={6} /></>,
  order_block: <><rect x={3} y={11} width={19} height={6} fill={ZN} opacity={0.3} /><K x={8} o={11} h={10} l={17} c={16} /><K x={15} o={16} h={3} l={17} c={4} w={5} /></>,
  leg: <><L d="M3 15 L7 18 L19 5 L22 8" color="#94a3b8" w={1.2} /><L d="M7 18 L19 5" color={LV} w={2.2} /><circle cx={7} cy={18} r={1.6} fill={LV} /><circle cx={19} cy={5} r={1.6} fill={LV} /></>,
  mss: <><L d="M2 18 L6 9 L10 15 L14 19 L22 4" /><L d="M5 9 H22" color={LV} dash /></>,
  double: <><L d="M2 20 L7 5 L12 13 L17 5 L22 20" /><L d="M3 13 H22" color={LV} dash /></>,
  triple: <><L d="M1 20 L5 5 L8 13 L12 5 L15 13 L19 5 L23 20" /><L d="M2 13 H23" color={LV} dash /></>,
  head_shoulders: <><L d="M1 20 L5 9 L8 14 L12 3 L16 14 L19 9 L23 20" /><L d="M2 14 H23" color={LV} dash /></>,
  triangle: <><L d="M2 19 L5 6 L8 16 L12 8 L15 14 L18 10 L22 3" /><L d="M3 5 L20 11" color={LV} w={1.2} /><L d="M3 19 L20 12" color={LV} w={1.2} /></>,
  wedge: <><L d="M2 4 L6 15 L9 8 L13 17 L16 12 L18 18 L22 6" /><L d="M2 3 L20 14" color={LV} w={1.2} /><L d="M5 15 L20 19" color={LV} w={1.2} /></>,
  flag: <><L d="M3 21 L10 5" color={ZN} w={2.2} /><L d="M10 5 L12 9 L14 7 L16 11 L18 9 L22 3" /><L d="M10 4 L19 8" color={LV} w={1.2} /><L d="M11 9 L19 12" color={LV} w={1.2} /></>,
  pennant: <><L d="M3 21 L10 5" color={ZN} w={2.2} /><L d="M10 5 L12 10 L14 6 L16 9 L18 7 L22 2" /><L d="M10 4 L19 7.5" color={LV} w={1.2} /><L d="M11 11 L19 8" color={LV} w={1.2} /></>,
  rectangle: <><L d="M2 18 L6 7 L10 17 L14 7 L18 17 L22 3" /><L d="M3 7 H20" color={LV} w={1.2} /><L d="M3 17 H20" color={LV} w={1.2} /></>,
  channel: <><L d="M2 21 L6 12 L9 17 L13 8 L16 13 L20 4 L22 1" /><L d="M3 14 L21 2" color={LV} w={1.2} /><L d="M5 20 L22 9" color={LV} w={1.2} /></>,
  engulfing: <><K x={8} o={9} h={7} l={15} c={14} /><K x={16} o={16} h={3} l={17} c={5} w={6} /></>,
  hammer: <><K x={12} o={7} h={5} l={21} c={5} w={6} /></>,
  star: <><K x={5} o={4} h={3} l={15} c={14} /><K x={12} o={17} h={16} l={20} c={18} w={3} /><K x={19} o={15} h={5} l={16} c={7} /></>,
  harami: <><K x={8} o={4} h={3} l={20} c={19} w={6} /><K x={16} o={14} h={10} l={15} c={10} w={3} /></>,
  piercing: <><K x={8} o={4} h={3} l={15} c={14} /><K x={16} o={18} h={7} l={19} c={8} /></>,
  soldiers: <><K x={5} o={19} h={14} l={20} c={15} /><K x={12} o={15} h={9} l={16} c={10} /><K x={19} o={10} h={3} l={11} c={4} /></>,
  tweezer: <><K x={8} o={5} h={4} l={20} c={17} /><K x={16} o={17} h={6} l={20} c={7} /><L d="M4 20 H20" color={LV} dash w={1} /></>,
  inside_bar: <><K x={6} o={18} h={3} l={21} c={6} w={5} /><K x={12} o={10} h={8} l={15} c={13} w={3} /><K x={18} o={12} h={1} l={13} c={2} /><L d="M3 3 H22" color={LV} dash w={1} /></>,
  doji: <><L d="M12 3 V21" color="#cbd5e1" w={1.3} /><L d="M8 12 H16" color="#cbd5e1" w={2} /></>,
  marubozu: <><rect x={8} y={3} width={8} height={18} fill={UP} rx={0.8} /></>,
};

export function PatternIcon({ kind, size = 18, className }: { kind: PatternKind; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      {GLYPHS[kind] ?? <circle cx={12} cy={12} r={4} fill="currentColor" />}
    </svg>
  );
}

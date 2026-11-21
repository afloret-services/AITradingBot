// PROTOTYPE: a small glyph per pattern kind (24×24, bullish version), drawn in currentColor, shown next to its label.
import React from 'react';
import type { PatternKind } from '../model';

const UP = '#26a69a', DN = '#ef5350', ZN = '#38bdf8', LV = '#fbbf24';
/** a candle: x, open, high, low, close in a 0–24 grid (y grows down, so a smaller number is higher) */
const K = ({ x, o, h, l, c, w = 4 }: { x: number; o: number; h: number; l: number; c: number; w?: number }) => {
  const col = c < o ? UP : DN;
  return <g><line x1={x} x2={x} y1={h} y2={l} stroke={col} strokeWidth={1.2} /><rect x={x - w / 2} y={Math.min(o, c)} width={w} height={Math.max(1, Math.abs(o - c))} fill={col} rx={0.6} /></g>;
};
/** a bold candle for the candlestick glyphs */
const KB = ({ x, o, h, l, c, w = 6 }: { x: number; o: number; h: number; l: number; c: number; w?: number }) => {
  const col = c < o ? UP : c > o ? DN : '#cbd5e1';
  return <g><line x1={x} x2={x} y1={h} y2={l} stroke={col} strokeWidth={1.7} strokeLinecap="round" /><rect x={x - w / 2} y={Math.min(o, c)} width={w} height={Math.max(1.6, Math.abs(o - c))} fill={col} rx={0.8} /></g>;
};
const L = ({ d, color = 'currentColor', w = 1.6, dash }: { d: string; color?: string; w?: number; dash?: boolean }) => <path d={d} fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash ? '2 1.6' : undefined} />;

const GLYPHS: Record<PatternKind, React.ReactNode> = {
  fvg: <><rect x={2} y={9.5} width={21} height={5} fill={ZN} opacity={0.35} rx={0.6} /><KB x={5} o={19} h={14.5} l={22} c={16} w={5} /><KB x={12} o={17} h={3} l={18} c={5} w={6} /><KB x={19} o={6} h={1.5} l={9.5} c={3} w={5} /></>,
  displacement: <><KB x={3.5} o={15} h={13} l={18} c={16} w={3.5} /><KB x={8.5} o={16} h={14} l={18.5} c={14.5} w={3.5} /><KB x={17} o={21} h={1.5} l={22} c={3} w={9} /></>,
  order_block: <><rect x={3} y={11} width={20} height={9} fill={ZN} opacity={0.35} rx={0.6} /><KB x={7} o={11.5} h={11} l={20} c={19} w={6} /><KB x={16} o={19} h={1.5} l={20} c={3} w={7} /></>,
  leg: <><L d="M2 13 L5 17 L7 20.5 L19 4 L22 7" color="#94a3b8" w={1.4} /><L d="M7 20.5 L19 4" color={LV} w={2.6} /><circle cx={7} cy={20.5} r={2.2} fill={LV} /><circle cx={19} cy={4} r={2.2} fill={LV} /></>,
  mss: <><L d="M2 20 L6 9 L10 15 L14 21 L22 2" w={2} /><L d="M4 9 H23" color={LV} dash w={1.2} /><circle cx={6} cy={9} r={1.8} fill={LV} /><circle cx={17.3} cy={9} r={2.2} fill="none" stroke="#26a69a" strokeWidth={1.5} /></>,
  double: <><L d="M2 20 L7 5 L12 13 L17 5 L22 20" /><L d="M3 13 H22" color={LV} dash /></>,
  triple: <><L d="M1 20 L5 5 L8 13 L12 5 L15 13 L19 5 L23 20" /><L d="M2 13 H23" color={LV} dash /></>,
  head_shoulders: <><L d="M1 20 L5 9 L8 14 L12 3 L16 14 L19 9 L23 20" /><L d="M2 14 H23" color={LV} dash /></>,
  triangle: <><L d="M2 19 L5 6 L8 16 L12 8 L15 14 L18 10 L22 3" /><L d="M3 5 L20 11" color={LV} w={1.2} /><L d="M3 19 L20 12" color={LV} w={1.2} /></>,
  wedge: <><L d="M2 4 L6 15 L9 8 L13 17 L16 12 L18 18 L22 6" /><L d="M2 3 L20 14" color={LV} w={1.2} /><L d="M5 15 L20 19" color={LV} w={1.2} /></>,
  flag: <><L d="M3 21 L10 5" color={ZN} w={2.2} /><L d="M10 5 L12 9 L14 7 L16 11 L18 9 L22 3" /><L d="M10 4 L19 8" color={LV} w={1.2} /><L d="M11 9 L19 12" color={LV} w={1.2} /></>,
  pennant: <><L d="M3 21 L10 5" color={ZN} w={2.2} /><L d="M10 5 L12 10 L14 6 L16 9 L18 7 L22 2" /><L d="M10 4 L19 7.5" color={LV} w={1.2} /><L d="M11 11 L19 8" color={LV} w={1.2} /></>,
  rectangle: <><L d="M2 18 L6 7 L10 17 L14 7 L18 17 L22 3" /><L d="M3 7 H20" color={LV} w={1.2} /><L d="M3 17 H20" color={LV} w={1.2} /></>,
  channel: <><L d="M2 21 L6 12 L9 17 L13 8 L16 13 L20 4 L22 1" /><L d="M3 14 L21 2" color={LV} w={1.2} /><L d="M5 20 L22 9" color={LV} w={1.2} /></>,
  engulfing: <><KB x={7} o={9} h={7} l={16} c={14} w={5} /><KB x={16} o={17} h={2} l={20} c={4} w={8} /></>,
  hammer: <><KB x={12} o={8} h={3} l={22} c={4} w={9} /></>,
  star: <><KB x={4.5} o={2} h={1} l={14} c={13} w={5} /><KB x={12} o={18} h={16} l={21} c={19} w={4} /><KB x={19.5} o={13} h={3} l={14} c={4} w={5} /></>,
  harami: <><KB x={8} o={2} h={1} l={23} c={22} w={8} /><KB x={18} o={15} h={8} l={16} c={9} w={4} /></>,
  piercing: <><KB x={7.5} o={2} h={1} l={14} c={13} w={7} /><KB x={16.5} o={19} h={6} l={21} c={7} w={7} /><L d="M3 7.5 H21" color={LV} dash w={0.9} /></>,
  soldiers: <><KB x={4.5} o={21} h={15} l={22} c={16} w={5} /><KB x={12} o={16} h={9} l={17} c={10} w={5} /><KB x={19.5} o={10} h={2} l={11} c={3} w={5} /></>,
  tweezer: <><KB x={8} o={4} h={2} l={21} c={17} w={7} /><KB x={16} o={17} h={4} l={21} c={6} w={7} /><L d="M2 21.5 H22" color={LV} dash w={1} /></>,
  inside_bar: <><KB x={5} o={20} h={2} l={22} c={6} w={6} /><KB x={12} o={11} h={9} l={16} c={14} w={4} /><KB x={19} o={13} h={0.8} l={14} c={1.5} w={5} /><L d="M2 2 H23" color={LV} dash w={0.9} /></>,
  doji: <><line x1={12} x2={12} y1={2} y2={22} stroke="#cbd5e1" strokeWidth={1.8} strokeLinecap="round" /><rect x={5} y={11} width={14} height={2} fill="#cbd5e1" rx={0.6} /></>,
  marubozu: <><rect x={7} y={2} width={10} height={20} fill={UP} rx={1} /></>,
  broadening: <><L d="M2 12 L5 9 L8 15 L12 6 L16 18 L19 4 L22 1" /><L d="M3 10 L20 3" color={LV} w={1.2} /><L d="M3 14 L20 19" color={LV} w={1.2} /></>,
  broadening_wedge: <><L d="M2 6 L5 9 L8 5 L12 14 L15 7 L18 20 L22 3" /><L d="M3 5 L20 6" color={LV} w={1.2} /><L d="M3 9 L20 21" color={LV} w={1.2} /></>,
  cup_handle: <><L d="M2 6 Q4 18 12 18 Q19 18 19 6 L21 9 L23 3" /><L d="M2 6 H23" color={LV} dash w={1} /></>,
  diamond: <><L d="M2 4 L6 12 L9 7 L12 19 L15 8 L18 15 L22 3" /><L d="M4 11 L12 4 L20 10" color={LV} w={1.2} /><L d="M4 13 L12 20 L20 14" color={LV} w={1.2} /></>,
  rounding: <><L d="M2 5 Q12 25 22 5" /><L d="M2 5 H22" color={LV} dash w={1} /></>,
  island: <><K x={4} o={5} h={4} l={8} c={7} w={3} /><K x={10} o={15} h={13} l={20} c={17} w={3} /><K x={14} o={17} h={14} l={20} c={15} w={3} /><K x={20} o={7} h={3} l={8} c={4} w={3} /><L d="M2 11 H22" color={LV} dash w={1} /></>,
  bump_run: <><L d="M2 4 L10 9 Q14 22 17 16 L22 4" /><L d="M2 3 L22 15" color={LV} w={1.2} /></>,
  measured_move: <><L d="M2 21 L9 9 L13 14 L21 2" /><L d="M9 9 H22" color={LV} dash w={1} /><circle cx={2.5} cy={20.5} r={1.4} fill={ZN} /><circle cx={9} cy={9} r={1.4} fill={ZN} /><circle cx={13} cy={14} r={1.4} fill={ZN} /></>,
  parabolic: <><L d="M2 3 Q12 4 16 20 L19 13 L22 15" /></>,
  wyckoff: <><L d="M2 2 L6 12 L9 8 L12 13 L14 18 L16 10 L19 12 L22 3" /><L d="M5 7 H21" color={LV} w={1.1} /><L d="M5 15 H21" color={LV} w={1.1} /></>,
  adam_eve: <><L d="M2 4 L6 19 L9 6 L12 11 Q16 22 20 11 L22 3" /><L d="M3 6 H22" color={LV} dash w={1} /></>,
  hs_complex: <><L d="M1 20 L3 12 L5 16 L7 11 L9 15 L12 3 L15 15 L17 11 L19 16 L21 12 L23 20" /><L d="M2 15 H23" color={LV} dash w={1} /></>,
  wyckoff_re: <><L d="M2 21 L6 9 L9 13 L12 9 L14 16 L16 10 L19 12 L22 2" /><L d="M5 8 H21" color={LV} w={1.1} /><L d="M5 15 H21" color={LV} w={1.1} /></>,
};

export function PatternIcon({ kind, size = 18, className }: { kind: PatternKind; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      {GLYPHS[kind] ?? <circle cx={12} cy={12} r={4} fill="currentColor" />}
    </svg>
  );
}

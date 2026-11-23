// PROTOTYPE: what a declared pattern looks like. A schematic drawn from its kind and settings (always the bullish
// side; the bearish one is its mirror), and real examples found with those settings on the MNQ bars.
import React, { useMemo, useState } from 'react';
import { Pattern, PATTERN_KINDS } from '../model';
import { Data, bars, patternSeries, chartTime } from '../engine';
import { cn } from './ui';

const W = 260, H = 150;
const UP = '#26a69a', DOWN = '#ef5350', ZONE = '#cbd5e1', LVL = '#fbbf24';
/** a chart pattern's own shape (the W, a flag's pole, wedge sides) */
const SHAPE = '#f0abfc';
type C = [o: number, h: number, l: number, c: number];

function Candle({ x, k, y, w = 14, hi }: { x: number; k: C; y: (v: number) => number; w?: number; hi?: string }) {
  const [o, h, l, c] = k, up = c >= o, col = up ? UP : DOWN;
  return (
    <g>
      {hi && <rect x={x - w / 2 - 3} y={y(h) - 3} width={w + 6} height={y(l) - y(h) + 6} rx={3} fill="none" stroke={hi} strokeDasharray="2 2" />}
      <line x1={x} x2={x} y1={y(h)} y2={y(l)} stroke={col} strokeWidth={1.5} />
      <rect x={x - w / 2} y={y(Math.max(o, c))} width={w} height={Math.max(1.5, Math.abs(y(o) - y(c)))} fill={col} rx={1} />
    </g>
  );
}
const Label = ({ x, y, children, color = '#94a3b8', anchor = 'start' }: { x: number; y: number; children: React.ReactNode; color?: string; anchor?: 'start' | 'end' | 'middle' }) => <text x={x} y={y} fontSize={9.5} fill={color} textAnchor={anchor} fontFamily="Inter, sans-serif">{children}</text>;

/** the schematic: values are on a 0–100 price scale */
export function PatternSchematic({ p }: { p: Pattern }) {
  const y = (v: number) => H - 14 - (v / 100) * (H - 28);
  const P = p.params as Record<string, any>;
  const disp = p.kind === 'displacement' || p.kind === 'order_block' || !!P.displacement;
  const big = disp ? 1 : 0.55; // a Displacement candle is drawn tall
  let body: React.ReactNode = null;
  if (p.kind === 'fvg') {
    const c1: C = [30, 42, 26, 40], c2: C = [40, 40 + 45 * big, 38, 38 + 43 * big], c3: C = [c2[3] - 4, c2[3] + 10, 50 + 14 * big, c2[3] + 6];
    const top = c3[2], bot = c1[1];
    body = <>
      <rect x={70} y={y(top)} width={170} height={y(bot) - y(top)} fill={ZONE} opacity={0.15} stroke={ZONE} strokeDasharray="3 3" />
      <Candle x={80} k={c1} y={y} /><Candle x={110} k={c2} y={y} hi={disp ? LVL : undefined} /><Candle x={140} k={c3} y={y} />
      <Label x={80} y={y(c1[2]) + 11} anchor="middle">1</Label><Label x={110} y={y(c2[2]) + 11} anchor="middle">2</Label><Label x={140} y={y(c3[2]) + 11} anchor="middle">3</Label>
      <Label x={244} y={y(top) - 3} color={ZONE} anchor="end">{p.name}.top</Label><Label x={244} y={y(bot) + 10} color={ZONE} anchor="end">{p.name}.bottom</Label>
      <Label x={158} y={(y(top) + y(bot)) / 2 + 3} color="#cbd5e1">gap ≥ {P.min_gap_ticks} ticks</Label>
      {disp && <Label x={6} y={14} color={LVL}>candle 2 is a Displacement</Label>}
      {P.middle_closes_gap_way && !disp && <Label x={6} y={14}>candle 2 closes up</Label>}
    </>;
  } else if (p.kind === 'displacement') {
    const small: C[] = [[40, 46, 37, 43], [43, 47, 39, 41], [41, 46, 38, 44], [44, 48, 40, 42]];
    body = <>
      {small.map((k, i) => <Candle key={i} x={30 + i * 26} k={k} y={y} />)}
      <line x1={18} x2={128} y1={y(49)} y2={y(49)} stroke="#64748b" strokeDasharray="2 3" /><line x1={18} x2={128} y1={y(37)} y2={y(37)} stroke="#64748b" strokeDasharray="2 3" />
      <Label x={20} y={y(52)}>average range of {P.avg_len} bars</Label>
      <Candle x={160} k={[42, 92, 40, 89]} y={y} w={18} hi={LVL} />
      <line x1={182} x2={182} y1={y(92)} y2={y(40)} stroke={LVL} /><Label x={186} y={y(70)} color={LVL}>range ≥ {P.disp_mult}×</Label><Label x={186} y={y(70) + 11} color={LVL}>body ≥ {P.disp_body_pct}%</Label>
    </>;
  } else if (p.kind === 'order_block') {
    const ob: C = [50, 53, 40, 43];
    const top = P.use_body ? 50 : 53, bot = P.use_body ? 43 : 40;
    body = <>
      <rect x={92} y={y(top)} width={150} height={y(bot) - y(top)} fill={ZONE} opacity={0.15} stroke={ZONE} strokeDasharray="3 3" />
      <Candle x={40} k={[58, 62, 52, 55]} y={y} /><Candle x={70} k={[55, 57, 47, 50]} y={y} /><Candle x={100} k={ob} y={y} />
      <Candle x={130} k={[44, 90, 42, 88]} y={y} w={16} hi={LVL} />
      <Label x={100} y={y(40) + 12} anchor="middle" color={ZONE}>last down candle</Label>
      <Label x={150} y={y(80)} color={LVL}>Displacement</Label><Label x={150} y={y(80) + 11} color={LVL}>closes above it</Label>
      <Label x={244} y={y(top) - 3} color={ZONE} anchor="end">{p.name}.top</Label><Label x={244} y={y(bot) + 10} color={ZONE} anchor="end">{p.name}.bottom</Label>
      <Label x={6} y={14}>zone = {P.use_body ? 'the body' : 'high to low'} · within {P.lookback} bars</Label>
    </>;
  } else if (p.kind === 'leg') {
    const pts = [[20, 60], [50, 40], [80, 52], [110, 18], [150, 55], [185, 45], [215, 85], [245, 70]];
    const s = pts[3], e = pts[6];
    body = <>
      <polyline points={pts.map(([px, v]) => `${px},${y(v)}`).join(' ')} fill="none" stroke="#64748b" strokeWidth={1.5} />
      <line x1={s[0]} y1={y(s[1])} x2={e[0]} y2={y(e[1])} stroke={LVL} strokeWidth={2.5} />
      <line x1={e[0]} x2={250} y1={y((s[1] + e[1]) / 2)} y2={y((s[1] + e[1]) / 2)} stroke={LVL} strokeDasharray="3 3" opacity={0.7} />
      <circle cx={s[0]} cy={y(s[1])} r={3.5} fill={LVL} /><circle cx={e[0]} cy={y(e[1])} r={3.5} fill={LVL} />
      <Label x={s[0]} y={y(s[1]) + 13} anchor="middle" color={LVL}>{p.name}.start (swing low)</Label>
      <Label x={e[0] - 4} y={y(e[1]) - 6} anchor="end" color={LVL}>{p.name}.end (swing high)</Label>
      <Label x={250} y={y((s[1] + e[1]) / 2) - 3} anchor="end" color={LVL}>50%</Label>
      <Label x={6} y={14}>swings: {P.strength} bars each side · size ≥ {P.min_size_points} pts</Label>
    </>;
  } else if (p.kind === 'mss') {
    const ks: C[] = [[40, 50, 38, 48], [48, 62, 46, 58], [58, 60, 50, 52], [52, 54, 42, 45], [45, 49, 34, 37], [37, 46, 35, 44], [44, 52, 42, 50]];
    const lvl = 62;
    body = <>
      <line x1={66} x2={250} y1={y(lvl)} y2={y(lvl)} stroke={LVL} strokeDasharray="4 3" />
      {ks.map((k, i) => <Candle key={i} x={24 + i * 24} k={k} y={y} w={11} />)}
      <Candle x={24 + 7 * 24 + 4} k={[50, 82, 48, 79]} y={y} w={14} hi={P.displacement ? LVL : '#64748b'} />
      <circle cx={48} cy={y(62)} r={3} fill={LVL} /><circle cx={120} cy={y(34)} r={3} fill="#94a3b8" />
      <Label x={6} y={y(lvl) - 5} color={LVL}>{p.name}.level (last swing high)</Label>
      <Label x={120} y={y(34) + 13} anchor="middle">{p.name}.swing_low</Label>
      <Label x={6} y={14}>{P.displacement ? 'a Displacement closes above the level' : 'a close above the level'}</Label>
    </>;
  }
  const MORE: Partial<Record<string, { pts: [number, number][]; lines: [number, number, number, number][]; bx: number; by: number; tgt?: number; note: string; marks?: [number, number, string][] }>> = {
    broadening: { pts: [[15, 50], [40, 62], [65, 40], [95, 72], [125, 30], [160, 82], [195, 22], [225, 92]], lines: [[40, 62, 225, 90], [65, 40, 225, 18]], bx: 216, by: 88, tgt: 98, note: 'higher highs, lower lows' },
    broadening_wedge: { pts: [[15, 75], [40, 68], [65, 72], [95, 52], [125, 66], [160, 32], [190, 62], [222, 80]], lines: [[15, 76, 210, 62], [40, 68, 210, 22]], bx: 205, by: 64, tgt: 98, note: 'descending broadening wedge' },
    cup_handle: { pts: [[15, 82], [40, 52], [70, 32], [105, 30], [140, 48], [170, 80], [188, 70], [205, 76], [228, 92]], lines: [[15, 82, 235, 82]], bx: 214, by: 82, tgt: 98, note: 'cup, then a shallow handle', marks: [[15, 82, 'rim'], [105, 30, 'depth']] },
    diamond: { pts: [[12, 85], [40, 55], [70, 70], [100, 40], [130, 82], [160, 50], [185, 68], [210, 60], [232, 88]], lines: [[40, 55, 100, 40], [100, 40, 215, 66], [70, 70, 130, 82], [130, 82, 185, 68]], bx: 204, by: 68, tgt: 98, note: 'widens, then narrows' },
    rounding: { pts: [[12, 80], [40, 52], [70, 36], [100, 30], [130, 33], [160, 46], [190, 70], [210, 82], [232, 92]], lines: [[12, 80, 235, 80]], bx: 206, by: 80, tgt: 98, note: 'a slow U-turn', marks: [[12, 80, 'rim']] },
    island: { pts: [], lines: [], bx: 0, by: 0, note: 'gap down, a few bars alone, gap up' },
    bump_run: { pts: [[12, 88], [45, 78], [80, 68], [105, 50], [125, 25], [145, 20], [165, 40], [190, 64], [225, 85]], lines: [[12, 92, 235, 50]], bx: 186, by: 59, note: 'lead-in, bump, run back through the line' },
    measured_move: { pts: [[15, 15], [75, 60], [110, 40], [180, 88]], lines: [[75, 60, 235, 60]], bx: 128, by: 60, tgt: 98, note: 'second swing ≈ first swing', marks: [[15, 15, 'A'], [75, 60, 'B'], [110, 40, 'C']] },
    parabolic: { pts: [[12, 90], [70, 84], [110, 72], [140, 52], [158, 28], [168, 10], [178, 26], [200, 34], [225, 45]], lines: [], bx: 178, by: 26, note: 'a fall that speeds up, then a sharp turn' },
    adam_eve: { pts: [[12, 92], [45, 70], [62, 28], [79, 72], [105, 62], [125, 40], [150, 30], [175, 40], [195, 70], [220, 90]], lines: [[30, 70, 230, 70]], bx: 196, by: 70, tgt: 98, note: 'sharp Adam, rounded Eve', marks: [[62, 28, 'Adam'], [150, 30, 'Eve']] },
    hs_complex: { pts: [[8, 90], [28, 42], [45, 58], [62, 40], [80, 58], [110, 15], [140, 58], [158, 41], [175, 58], [192, 43], [208, 58], [232, 88]], lines: [[30, 58, 235, 58]], bx: 214, by: 58, tgt: 98, note: 'two shoulders each side', marks: [[110, 15, 'head']] },
    wyckoff: { pts: [[10, 95], [30, 55], [50, 72], [70, 52], [95, 70], [120, 55], [140, 72], [158, 44], [175, 66], [198, 74], [222, 90]], lines: [[25, 74, 205, 74], [25, 52, 205, 52]], bx: 196, by: 74, tgt: 96, note: 'fall, range, spring, sign of strength', marks: [[158, 44, 'spring']] },
    wyckoff_re: { pts: [[10, 15], [30, 55], [50, 72], [70, 52], [95, 70], [120, 55], [140, 72], [158, 44], [175, 66], [198, 74], [222, 90]], lines: [[25, 74, 205, 74], [25, 52, 205, 52]], bx: 196, by: 74, tgt: 96, note: 'rise, range, spring, rise resumes', marks: [[158, 44, 'spring']] },
  };
  const mo = MORE[p.kind];
  if (mo) {
    if (p.kind === 'island') {
      body = <>
        {([[30, 82, 74, 78], [55, 80, 70, 72], [80, 72, 76, 70], [115, 40, 30, 32], [140, 36, 28, 34], [165, 38, 32, 30], [200, 70, 80, 76], [225, 78, 88, 84]] as number[][]).map(([x, o, h, c], i) => <Candle key={i} x={x} k={[o > c ? o : o, Math.max(o, h, c) + 2, Math.min(o, c) - 3, c] as any} y={y} w={14} />)}
        <line x1={20} x2={240} y1={y(56)} y2={y(56)} stroke={LVL} strokeDasharray="3 3" />
        <Label x={95} y={y(60)} color={LVL}>gap</Label><Label x={180} y={y(60)} color={LVL}>gap</Label>
        <Label x={6} y={12}>{mo.note}</Label>
      </>;
    } else {
      body = <>
        <polyline points={mo.pts.map(([x, v]) => `${x},${y(v)}`).join(' ')} fill="none" stroke={SHAPE} strokeWidth={1.6} strokeLinejoin="round" />
        {mo.lines.map(([x1, v1, x2, v2], i) => <line key={i} x1={x1} y1={y(v1)} x2={x2} y2={y(v2)} stroke={LVL} strokeWidth={1.4} strokeDasharray={p.kind === 'cup_handle' || p.kind === 'rounding' || p.kind === 'measured_move' ? '3 3' : undefined} />)}
        {(mo.marks || []).map(([x, v, t], i) => <g key={i}><circle cx={x} cy={y(v)} r={2.5} fill={ZONE} /><Label x={x + 4} y={y(v) + (v > 50 ? -5 : 12)} color={ZONE}>{t}</Label></g>)}
        <circle cx={mo.bx} cy={y(mo.by)} r={4} fill="none" stroke="#26a69a" strokeWidth={1.5} />
        <Label x={mo.bx - 6} y={y(mo.by) + 14} anchor="end" color="#86efac">forms here</Label>
        {mo.tgt != null && <><line x1={mo.bx} x2={252} y1={y(mo.tgt)} y2={y(mo.tgt)} stroke="#26a69a" strokeDasharray="2 3" /><Label x={252} y={y(mo.tgt) + 11} anchor="end" color="#86efac">{p.name}.target</Label></>}
        <Label x={6} y={12}>{PATTERN_KINDS[p.kind].bull}: {mo.note}</Label>
      </>;
    }
  }
  if (PATTERN_KINDS[p.kind].group === 'candle') {
    // the bullish version; the bearish one is its mirror. Two down candles before it show "after a move against it".
    const lead: C[] = P.trend_bars ? [[82, 84, 74, 76], [76, 78, 66, 68]] : [];
    const sets: Record<string, C[]> = {
      engulfing: [[64, 65, 56, 58], [56, 70, 55, 68]],
      hammer: [[60, 62, 38, 61]],
      star: [[68, 69, 48, 50], [47, 49, 43, 46], [49, 66, 48, 64]],
      harami: [[70, 71, 46, 48], [52, 60, 51, 59]],
      piercing: [[66, 67, 50, 52], [48, 62, 46, 61]],
      soldiers: [[44, 52, 43, 51], [50, 60, 49, 59], [58, 69, 57, 68]],
      tweezer: [[62, 64, 44, 47], [47, 60, 44, 58]],
      inside_bar: [[52, 72, 42, 64], [62, 68, 50, 56], [57, 64, 52, 60], [60, 82, 59, 80]],
      doji: P.dragonfly ? [[60, 60.6, 40, 60.3]] : [[55, 64, 46, 55.4]],
      marubozu: [[48, 72.3, 47.8, 72]],
    };
    const ks = [...lead, ...sets[p.kind]];
    const vmin = Math.min(...ks.map((k) => k[2])) - 3, vmax = Math.max(...ks.map((k) => k[1])) + 3;
    const y2 = (v: number) => 22 + ((vmax - v) / (vmax - vmin)) * (H - 46);
    const x0 = 128 - (ks.length - 1) * 16;
    const first = lead.length, last = ks.length - 1;
    const hi = Math.max(...ks.slice(first).map((k) => k[1])), lo = Math.min(...ks.slice(first).map((k) => k[2]));
    body = <>
      <rect x={x0 + first * 32 - 12} y={y2(hi) - 4} width={(last - first) * 32 + 24} height={y2(lo) - y2(hi) + 8} rx={3} fill={ZONE} opacity={0.12} stroke={ZONE} strokeDasharray="3 3" />
      {ks.map((k, i) => <Candle key={i} x={x0 + i * 32} k={k} y={y2} w={18} />)}
      <Label x={x0 + last * 32 + 14} y={y2(hi) + 3} color={ZONE}>{p.name}.high</Label>
      <Label x={x0 + last * 32 + 14} y={y2(lo) + 3} color={ZONE}>{p.name}.low</Label>
      {p.kind === 'inside_bar' && <><line x1={x0 - 10} x2={x0 + last * 32 + 10} y1={y2(72)} y2={y2(72)} stroke={LVL} strokeDasharray="3 3" /><Label x={x0 - 10} y={y2(72) - 4} color={LVL}>mother bar's high</Label></>}
      <Label x={6} y={12}>{PATTERN_KINDS[p.kind].bull} · the bearish one is its mirror</Label>
      {P.trend_bars ? <Label x={6} y={H - 4}>after a move down over {P.trend_bars} bars</Label> : null}
    </>;
  }
  if (p.kind === 'triangle' || p.kind === 'wedge' || p.kind === 'flag' || p.kind === 'pennant' || p.kind === 'rectangle' || p.kind === 'channel') {
    // drawn as the bullish breakout (the bearish one is its mirror)
    const P2 = p.params as Record<string, any>;
    let pts: [number, number][], up: [number, number, number, number], lo: [number, number, number, number], bx: number, by: number, tgt: number, note: string, pole: [number, number, number, number] | null = null;
    if (p.kind === 'pennant') {
      pole = [20, 20, 90, 78];
      pts = [[20, 20], [90, 78], [105, 62], [120, 74], [135, 65], [150, 71], [165, 67], [185, 86]];
      up = [90, 80, 180, 69]; lo = [100, 60, 180, 66]; bx = 182; by = 70; tgt = 70 + 58; note = 'pole, then a small narrowing pause';
    } else if (p.kind === 'rectangle') {
      pts = [[15, 30], [45, 75], [75, 40], [105, 76], [135, 39], [165, 75], [190, 55], [212, 85], [235, 95]];
      up = [45, 76, 205, 76]; lo = [75, 39, 205, 39]; bx = 205; by = 76; tgt = 76 + 37; note = 'flat top and flat bottom';
    } else if (p.kind === 'channel') {
      pts = [[15, 12], [40, 40], [62, 22], [92, 55], [115, 36], [145, 70], [170, 50], [200, 88], [225, 97]];
      up = [40, 40, 205, 82]; lo = [62, 22, 205, 58]; bx = 196; by = 81; tgt = 98; note = 'rising channel shown · falling is its mirror';
    } else if (p.kind === 'flag') {
      pole = [20, 20, 90, 75];
      pts = [[20, 20], [90, 75], [105, 66], [118, 72], [133, 62], [148, 68], [163, 58], [178, 63], [195, 82]];
      up = [90, 76, 185, 66]; lo = [100, 64, 185, 54]; bx = 190; by = 68; tgt = 66 + 55; note = 'pole, then a pause drifting against it';
    } else if (p.kind === 'wedge') {
      pts = [[15, 90], [45, 55], [70, 78], [100, 45], [125, 62], [150, 38], [170, 50], [195, 70], [215, 85]];
      up = [15, 92, 190, 52]; lo = [45, 55, 190, 30]; bx = 190; by = 55; tgt = 55 + 40; note = 'falling wedge · the rising wedge is its mirror';
    } else {
      const asc = P2.allow_ascending && !P2.allow_symmetrical && !P2.allow_descending;
      pts = asc ? [[15, 25], [45, 80], [75, 40], [105, 80], [135, 55], [160, 80], [180, 66], [205, 92], [225, 100]]
        : [[15, 15], [45, 85], [75, 30], [105, 75], [135, 42], [160, 66], [180, 52], [205, 80], [225, 92]];
      up = asc ? [45, 80, 200, 80] : [45, 85, 200, 60]; lo = asc ? [75, 40, 200, 70] : [75, 30, 200, 55];
      bx = 200; by = asc ? 80 : 61; tgt = by + (up[1] - (asc ? 40 : 30)); note = asc ? 'ascending: flat top, rising bottom' : 'symmetrical · ascending/descending: one flat line';
    }
    body = <>
      {pole && <line x1={pole[0]} y1={y(pole[1])} x2={pole[2]} y2={y(pole[3])} stroke={ZONE} strokeWidth={2.5} />}
      <polyline points={pts.map(([x, v]) => `${x},${y(v)}`).join(' ')} fill="none" stroke={SHAPE} strokeWidth={1.6} strokeLinejoin="round" />
      <line x1={up[0]} y1={y(up[1])} x2={up[2]} y2={y(up[3])} stroke={LVL} strokeWidth={1.5} />
      <line x1={lo[0]} y1={y(lo[1])} x2={lo[2]} y2={y(lo[3])} stroke={LVL} strokeWidth={1.5} />
      <circle cx={bx} cy={y(by)} r={4} fill="none" stroke="#26a69a" strokeWidth={1.5} />
      <Label x={bx - 6} y={y(by) + 14} anchor="end" color="#86efac">forms here</Label>
      <line x1={bx} x2={252} y1={y(Math.min(98, tgt))} y2={y(Math.min(98, tgt))} stroke="#26a69a" strokeDasharray="2 3" />
      <Label x={252} y={y(Math.min(98, tgt)) + 11} anchor="end" color="#86efac">{p.name}.target</Label>
      {pole && <Label x={24} y={y(30)} color={ZONE}>{p.name}.pole</Label>}
      <Label x={6} y={12}>{note}</Label>
    </>;
  }
  if (p.kind === 'double' || p.kind === 'triple' || p.kind === 'head_shoulders') {
    // drawn as the bearish top: bullish is the same upside down
    const pts: [number, number][] = p.kind === 'double'
      ? [[10, 30], [60, 80], [100, 50], [140, 79], [175, 50], [200, 35], [230, 20]]
      : p.kind === 'triple' ? [[10, 30], [45, 80], [75, 52], [105, 79], [135, 52], [165, 80], [195, 45], [225, 25]]
      : [[10, 30], [45, 68], [75, 50], [110, 88], [145, 48], [175, 67], [200, 42], [230, 22]];
    const neck = p.kind === 'head_shoulders' ? [[75, 50], [200, 44]] : [[40, 50], [235, 50]];
    const breakX = p.kind === 'double' ? 175 : p.kind === 'triple' ? 195 : 200;
    const peaks = p.kind === 'double' ? [1, 3] : p.kind === 'triple' ? [1, 3, 5] : [1, 3, 5];
    const names = p.kind === 'head_shoulders' ? ['left shoulder', 'head', 'right shoulder'] : ['1', '2', '3'];
    const top = p.kind === 'head_shoulders' ? 88 : 80, nk = 50, target = nk - (top - nk);
    body = <>
      <polyline points={pts.map(([x, v]) => `${x},${y(v)}`).join(' ')} fill="none" stroke={SHAPE} strokeWidth={1.8} strokeLinejoin="round" />
      <line x1={neck[0][0]} y1={y(neck[0][1])} x2={neck[1][0]} y2={y(neck[1][1])} stroke={LVL} strokeDasharray="4 3" />
      <Label x={neck[1][0] - 2} y={y(neck[1][1]) - 4} anchor="end" color={LVL}>{p.name}.neckline</Label>
      {peaks.map((k, i) => <g key={k}><circle cx={pts[k][0]} cy={y(pts[k][1])} r={3} fill={ZONE} /><Label x={pts[k][0]} y={y(pts[k][1]) - 6} anchor="middle" color={ZONE}>{names[i]}</Label></g>)}
      <circle cx={breakX} cy={y(p.kind === 'head_shoulders' ? 43 : 50)} r={4} fill="none" stroke="#ef5350" strokeWidth={1.5} />
      <Label x={breakX - 4} y={y(28)} anchor="end" color="#fca5a5">forms here</Label>
      <line x1={breakX} x2={250} y1={y(target)} y2={y(target)} stroke="#ef5350" strokeDasharray="2 3" opacity={0.8} />
      <Label x={250} y={y(target) - 3} anchor="end" color="#fca5a5">{p.name}.target</Label>
      <line x1={18} x2={18} y1={y(top)} y2={y(nk)} stroke="#64748b" /><Label x={22} y={y((top + nk) / 2)}>height</Label>
      <Label x={6} y={12}>{PATTERN_KINDS[p.kind].bear} shown · {PATTERN_KINDS[p.kind].bull} is its mirror</Label>
    </>;
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[150px] w-[260px] shrink-0 rounded-md border bg-[hsl(var(--chart))]">
      {body}
    </svg>
  );
}

/** real occurrences with these settings on the MNQ bars, one at a time */
export function PatternExample({ p, data }: { p: Pattern; data: Data }) {
  const [side, setSide] = useState<'long' | 'short'>('long');
  const series = useMemo(() => patternSeries(data, p, side), [data, p, side]);
  const hits = useMemo(() => series.map((c, j) => (c ? j : -1)).filter((j) => j >= 0), [series]);
  const [k, setK] = useState(-1);
  const idx = hits.length ? hits[(k < 0 ? hits.length - 1 : k) % hits.length] : -1;
  const kk = k < 0 ? hits.length - 1 : k % Math.max(1, hits.length);
  const B = bars(data, p.tf);
  const d = PATTERN_KINDS[p.kind];
  if (idx < 0) return <div className="flex h-[150px] w-[300px] items-center justify-center rounded-md border text-xs text-muted-foreground">no {side === 'long' ? d.bull : d.bear} {d.title} with these settings on these bars</div>;
  const caps = series[idx]!;
  const startT: number = caps.path?.[0]?.[0] ?? caps.lines?.[0]?.[0] ?? caps.bar1?.time ?? caps.start_time ?? caps.swing_time ?? caps.time ?? B[idx].t;
  let j0 = idx; while (j0 > 0 && B[j0].t > startT) j0--;
  const from = Math.max(0, Math.min(j0 - 3, idx - 10)), to = Math.min(B.length - 1, idx + (caps.path ? 4 : 6));
  const win = B.slice(from, to + 1);
  const extra = caps.target != null ? [caps.target] : [];
  const lo = Math.min(...win.map((b) => b.l), ...extra), hi = Math.max(...win.map((b) => b.h), ...extra);
  const w = 300, h = 150, padY = 12;
  const y = (v: number) => padY + ((hi - v) / (hi - lo || 1)) * (h - 2 * padY);
  const step = (w - 50) / win.length, x = (j: number) => 8 + (j - from + 0.5) * step;
  const xt = (t: number) => { let j = from; while (j < to && B[j + 1].t <= t) j++; return x(j); };
  const day = new Date((chartTime(B[idx].t)) * 1000).toISOString();
  return (
    <div className="space-y-1">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[150px] w-[300px] rounded-md border bg-[hsl(var(--chart))]">
        {caps.path && <polyline points={caps.path.map(([t, v]: [number, number]) => `${xt(t)},${y(v)}`).join(' ')} fill="none" stroke={SHAPE} strokeWidth={1.6} opacity={0.9} />}
        {caps.neck_t0 != null && <line x1={xt(caps.neck_t0)} y1={y(caps.neck_p0)} x2={xt(caps.time)} y2={y(caps.neckline)} stroke={LVL} strokeDasharray="4 3" />}
        {caps.lines && caps.lines.map(([t1, p1, t2, p2]: number[], q: number) => <line key={q} x1={xt(t1)} y1={y(p1)} x2={xt(t2)} y2={y(p2)} stroke={LVL} strokeWidth={1.5} />)}
        {caps.target != null && <line x1={xt(caps.time)} x2={w - 42} y1={y(caps.target)} y2={y(caps.target)} stroke="#ef5350" strokeDasharray="2 3" />}
        {typeof caps.top === 'number' && <rect x={xt(startT) - step / 2} y={y(caps.top)} width={(caps.end_time != null ? xt(caps.end_time) + step / 2 : w - 42) - xt(startT) + step / 2} height={Math.max(1, y(caps.bottom) - y(caps.top))} fill={ZONE} opacity={0.18} stroke={ZONE} strokeDasharray="3 3" />}
        {typeof caps.level === 'number' && <line x1={xt(caps.swing_time)} x2={w - 42} y1={y(caps.level)} y2={y(caps.level)} stroke={LVL} strokeDasharray="4 3" />}
        {typeof caps.start === 'number' && caps.start_time != null && <line x1={xt(caps.start_time)} y1={y(caps.start)} x2={xt(caps.end_time)} y2={y(caps.end)} stroke={LVL} strokeWidth={2} />}
        {win.map((b, i) => <Candle key={i} x={x(from + i)} k={[b.o, b.h, b.l, b.c]} y={y} w={Math.max(3, step * 0.6)} hi={from + i === idx ? '#e2e8f0' : undefined} />)}
        <text x={w - 4} y={y(hi) + 4} fontSize={9} fill="#64748b" textAnchor="end">{hi.toFixed(2)}</text>
        <text x={w - 4} y={y(lo)} fontSize={9} fill="#64748b" textAnchor="end">{lo.toFixed(2)}</text>
      </svg>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <div className="flex rounded border">{(['long', 'short'] as const).map((s) => <button key={s} onClick={() => { setSide(s); setK(-1); }} className={cn('px-1.5', side === s && 'bg-accent text-foreground')}>{s === 'long' ? d.bull : d.bear}</button>)}</div>
        <button className="rounded border px-1.5 hover:bg-accent" onClick={() => setK((kk - 1 + hits.length) % hits.length)}>‹</button>
        <span className="tabular-nums">{kk + 1} / {hits.length}</span>
        <button className="rounded border px-1.5 hover:bg-accent" onClick={() => setK((kk + 1) % hits.length)}>›</button>
        <span className="mono">{day.slice(5, 10)} {day.slice(11, 16)} NY</span>
      </div>
    </div>
  );
}

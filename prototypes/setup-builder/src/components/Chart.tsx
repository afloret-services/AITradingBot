// PROTOTYPE: TradingView Lightweight Charts on the real MNQ bars, with each step's effect drawn on it.
// An SVG overlay draws what price lines can't: pattern zones as boxes, Legs as lines, the Trade's risk and reward
// areas, and the Trading window as shaded bands. A Signal can be replayed event by event (steps → Signal → fill → exits).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createChart, IChartApi, ISeriesApi, LineStyle, SeriesMarker, Time, CrosshairMode } from 'lightweight-charts';
import { Data, RunResult, bars, closedAt, chartTime, indicatorSeries, Signal, inTradingHours } from '../engine';
import { Setup, TF, parseToken, tfMinutes, PATTERN_KINDS } from '../model';
import { STEP_COLORS, Button, Badge, cn } from './ui';

const hmN = (x: string) => { const [h, m] = x.split(':').map(Number); return h * 60 + (m || 0); };
const inR = (m: number, s: number, e: number) => (s <= e ? m >= s && m < e : m >= s || m < e);
export interface Focus { bi: number; si: number }
export function dayOfSignal(data: Data, s: Signal) { return data.m1[s.i].di; }

const LINE_COLORS = ['#fbbf24', '#f472b6', '#b7e4c7', '#34d399'];
const C = { up: '#26a69a', down: '#ef5350', zone: '#74c69d', draw: '#a78bfa', risk: '#ef4444', reward: '#22c55e', entry: '#e2e8f0' };

type Shape =
  | { k: 'rect'; t1: number; t2: number; p1: number; p2: number; fill: string; stroke?: string; dash?: boolean; label?: string; labelColor?: string; right?: boolean }
  | { k: 'line'; t1: number; t2: number; p1: number; p2: number; stroke: string; dash?: boolean; label?: string; width?: number }
  | { k: 'band'; t1: number; t2: number; fill: string };

interface LegendRow { label: string; color: string; value: string; onPrice?: boolean }
interface ReplayEvent { i: number; label: string; tone: 'step' | 'signal' | 'fill' | 'exit' | 'cancel'; color: string }

export function signalEvents(data: Data, setup: Setup, s: Signal): ReplayEvent[] {
  const br = setup.branches[s.branch];
  const ev: ReplayEvent[] = s.stepBars.map((i, k) => ({ i, label: `Step ${k + 1} completes · ${br?.steps[k]?.name || ''}`, tone: 'step', color: STEP_COLORS[k % STEP_COLORS.length] }));
  ev.push({ i: s.i, label: s.refused ? `Signal refused: ${s.refused}` : `Signal · ${br?.entry.order} entry ${s.entry.toFixed(2)}, stop ${s.stop.toFixed(2)}`, tone: 'signal', color: s.side === 'long' ? C.reward : C.risk });
  const t = s.trade;
  if (t?.fillI != null) ev.push({ i: t.fillI, label: `Filled at ${s.entry.toFixed(2)}`, tone: 'fill', color: C.entry });
  if (t?.cancelI != null) ev.push({ i: t.cancelI, label: t.outcome, tone: 'cancel', color: '#94a3b8' });
  for (const x of dedupeExits(t?.exits || [])) ev.push({ i: x.i, label: `${x.why}${x.n > 1 ? ` (${x.n} take profits)` : ''} · ${x.price.toFixed(2)}`, tone: 'exit', color: /stop/.test(x.why) ? C.risk : /TP|leg/i.test(x.why) ? C.reward : '#fbbf24' });
  return ev;
}

export function Chart({ data, setup, result, day, setDay, focus, selected, setSelected, height = 360, showHeld = true, compactBar }: {
  data: Data; setup: Setup; result: RunResult; day: number; setDay: (d: number) => void; focus?: Focus | null; selected?: Signal | null; setSelected?: (s: Signal | null) => void; height?: number; showHeld?: boolean; compactBar?: boolean;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const el = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candle = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const extra = useRef<{ s: ISeriesApi<any>; label: string; color: string; vals: Map<number, number>; onPrice?: boolean }[]>([]);
  const shapes = useRef<Shape[]>([]);
  const [legend, setLegend] = useState<{ ohlc: string; rows: LegendRow[] }>({ ohlc: '', rows: [] });
  const [replay, setReplay] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const tf: TF = setup.settings.base_bar === '1d' ? '1h' : setup.settings.base_bar;
  const ctxDays = tfMinutes(tf) >= 15 ? 2 : 0;
  const events = useMemo(() => (selected ? signalEvents(data, setup, selected) : []), [selected, data, setup]);
  useEffect(() => { setReplay(null); setPlaying(false); }, [selected]);
  useEffect(() => {
    if (!playing || replay == null) return;
    if (replay >= events.length - 1) { setPlaying(false); return; }
    const t = setTimeout(() => setReplay(replay + 1), 1100);
    return () => clearTimeout(t);
  }, [playing, replay, events.length]);

  useEffect(() => {
    if (!el.current) return;
    const c = createChart(el.current, {
      height, layout: { background: { color: 'transparent' }, textColor: '#8b93a7', fontSize: 11, fontFamily: 'Inter, ui-sans-serif, system-ui' },
      grid: { vertLines: { color: 'rgba(148,163,184,0.05)' }, horzLines: { color: 'rgba(148,163,184,0.05)' } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.08, bottom: 0.28 } },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false, rightOffset: 6 },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: 'rgba(148,163,184,0.35)', labelBackgroundColor: '#334155' }, horzLine: { color: 'rgba(148,163,184,0.35)', labelBackgroundColor: '#334155' } },
      autoSize: true,
    });
    chart.current = c;
    candle.current = c.addCandlestickSeries({ upColor: C.up, downColor: C.down, borderVisible: false, wickUpColor: C.up, wickDownColor: C.down, priceLineVisible: false });
    // overlay: redraw every frame (a handful of shapes), only touching the DOM when something moved
    let raf = 0, lastKey = '';
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const s = svg.current, cs = candle.current;
      if (!s || !cs) return;
      const ts = c.timeScale();
      const W = el.current?.clientWidth || 0, plotW = W - (c.priceScale('right').width() || 0);
      const x = (t: number) => ts.timeToCoordinate(t as Time);
      const y = (p: number) => cs.priceToCoordinate(p);
      const parts: string[] = [];
      for (const sh of shapes.current) {
        const x1 = x(sh.t1), x2 = x(sh.t2);
        if (x1 == null || x2 == null) continue;
        const a = Math.max(0, Math.min(x1, x2)), b = Math.min(plotW, Math.max(x1, x2));
        if (b < 0 || a > plotW) continue;
        if (sh.k === 'band') { parts.push(`<rect x="${a}" y="0" width="${Math.max(1, b - a)}" height="${height}" fill="${sh.fill}"/>`); continue; }
        const y1 = y(sh.p1), y2 = y(sh.p2);
        if (y1 == null || y2 == null) continue;
        if (sh.k === 'rect') {
          const top = Math.min(y1, y2), h = Math.max(1, Math.abs(y2 - y1));
          parts.push(`<rect x="${a}" y="${top}" width="${Math.max(2, b - a)}" height="${h}" fill="${sh.fill}" ${sh.stroke ? `stroke="${sh.stroke}" stroke-width="1" ${sh.dash ? 'stroke-dasharray="3 3"' : ''}` : ''} rx="1"/>`);
          if (sh.label) parts.push(sh.right ? `<text x="${b - 4}" y="${top + 11}" text-anchor="end" font-size="10" font-weight="600" fill="${sh.labelColor || '#cbd5e1'}">${sh.label}</text>` : `<text x="${a + 3}" y="${top + h + 11}" font-size="10" font-weight="600" fill="${sh.labelColor || sh.stroke || '#cbd5e1'}">${sh.label}</text>`);
        } else {
          parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${sh.stroke}" stroke-width="${sh.width || 1.5}" ${sh.dash ? 'stroke-dasharray="4 3"' : ''}/>`);
          if (sh.label) parts.push(`<text x="${Math.max(x1, x2) + 4}" y="${(sh.p2 >= sh.p1 ? Math.min(y1, y2) : Math.max(y1, y2)) + 3}" font-size="10" font-weight="600" fill="${sh.stroke}">${sh.label}</text>`);
        }
      }
      const key = parts.join('');
      if (key !== lastKey) { s.innerHTML = key; lastKey = key; }
    };
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); c.remove(); chart.current = null; };
  }, [height]);

  const B = useMemo(() => bars(data, tf), [data, tf]);
  const span = useMemo(() => {
    const d0 = Math.max(0, day - ctxDays);
    let from = B.findIndex((b) => b.di >= d0), to = B.length - 1;
    for (let k = from; k < B.length; k++) if (B[k].di > day) { to = k - 1; break; }
    return [Math.max(0, from), to] as const;
  }, [B, day, ctxDays]);

  useEffect(() => {
    const c = chart.current, cs = candle.current;
    if (!c || !cs) return;
    extra.current.forEach((e) => c.removeSeries(e.s));
    extra.current = [];
    const [from, toFull] = span;
    const T = (k: number) => chartTime(B[k].t) as number;
    // the tf bar that contains a 1m index
    const ca = closedAt(data, tf);
    const barOf = (i: number) => { const t = data.m1[i].t; let lo = from, hi = toFull; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (B[m].t <= t) lo = m; else hi = m - 1; } return lo; };
    const sel = selected && data.m1[selected.i].di === day ? selected : null;
    const cutI = sel && replay != null ? events[replay]?.i : undefined; // replay: nothing after this 1m bar
    const to = cutI != null ? Math.min(toFull, barOf(cutI)) : toFull;
    const visible = (i: number) => cutI == null || i <= cutI;
    const keep = sel && !sel.refused ? [sel.entry, sel.stop, ...sel.legs.map((l) => l.price), ...(sel.caps.draw ? [sel.caps.draw.price] : [])] : [];
    cs.applyOptions({ autoscaleInfoProvider: (orig: () => any) => { const r = orig(); if (!r || !keep.length) return r; return { ...r, priceRange: { minValue: Math.min(r.priceRange.minValue, ...keep), maxValue: Math.max(r.priceRange.maxValue, ...keep) } }; } } as any);
    cs.setData(B.slice(from, to + 1).map((b, k) => ({ time: T(from + k) as Time, open: b.o, high: b.h, low: b.l, close: b.c })));

    // declared indicators on the chart timeframe
    let lineN = 0;
    for (const ind of setup.indicators) {
      const p = parseToken(ind.token);
      if (p.parts[3] !== tf) continue;
      const name = p.parts[1], out = p.parts[4];
      const vals = indicatorSeries(data, name, p.parts[2], tf, out);
      const pts = [] as { time: Time; value: number; color?: string }[];
      const vm = new Map<number, number>();
      for (let k = from; k <= to; k++) if (vals[k] != null) { pts.push({ time: T(k) as Time, value: vals[k]!, color: name === 'macd' && out === 'hist' ? (vals[k]! >= 0 ? 'rgba(38,166,154,0.55)' : 'rgba(239,83,80,0.55)') : undefined }); vm.set(T(k), vals[k]!); }
      const label = ind.label?.replace(/^the /, '') || `${name.toUpperCase()} ${p.parts[2]}${out ? ' ' + out : ''}`;
      let s: ISeriesApi<any> | null = null, color = '#94a3b8';
      if (name === 'ema' || name === 'sma') {
        color = LINE_COLORS[lineN++ % LINE_COLORS.length];
        s = c.addLineSeries({ color, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
      } else if (name === 'macd') {
        color = out === 'hist' ? '#64748b' : out === 'signal' ? '#f97316' : '#74c69d';
        s = out === 'hist' ? c.addHistogramSeries({ priceScaleId: 'osc', priceLineVisible: false, lastValueVisible: false }) : c.addLineSeries({ priceScaleId: 'osc', color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
        c.priceScale('osc').applyOptions({ scaleMargins: { top: 0.78, bottom: 0.02 }, visible: false });
      } else if (name === 'adx' || name === 'rsi') {
        color = '#c084fc';
        s = c.addLineSeries({ priceScaleId: name, color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
        c.priceScale(name).applyOptions({ scaleMargins: { top: 0.78, bottom: 0.02 }, visible: false });
      } else continue; // ATR, average range…: listed in the legend only
      s.setData(pts);
      extra.current.push({ s, label, color, vals: vm, onPrice: name === 'ema' || name === 'sma' });
    }
    // indicators not drawn (ATR, average range) still show their value in the legend
    const legendOnly = setup.indicators.filter((ind) => { const p = parseToken(ind.token); return p.parts[3] === tf && !['ema', 'sma', 'macd', 'adx', 'rsi'].includes(p.parts[1]); }).map((ind) => {
      const p = parseToken(ind.token), vals = indicatorSeries(data, p.parts[1], p.parts[2], tf, p.parts[4]), vm = new Map<number, number>();
      for (let k = from; k <= to; k++) if (vals[k] != null) vm.set(T(k), vals[k]!);
      return { label: ind.label?.replace(/^the /, '') || `${p.parts[1]} ${p.parts[2]}`, color: '#64748b', vals: vm };
    });
    const allLegend = [...extra.current, ...legendOnly];
    const setLegendAt = (t: number | null) => {
      const k = t == null ? to : B.findIndex((b, j) => j >= from && T(j) === t);
      const b = B[k >= 0 ? k : to];
      if (!b) return;
      const tt = T(k >= 0 ? k : to);
      setLegend({ ohlc: `O ${b.o.toFixed(2)}  H ${b.h.toFixed(2)}  L ${b.l.toFixed(2)}  C ${b.c.toFixed(2)}`, rows: allLegend.map((e: any) => ({ label: e.label, color: e.color, onPrice: e.onPrice, value: e.vals.get(tt)?.toFixed(2) ?? '–' })) });
    };
    setLegendAt(null);
    const onMove = (p: any) => setLegendAt(p?.time != null ? (p.time as number) : null);
    c.subscribeCrosshairMove(onMove);

    // markers
    const inSpan = (i: number) => { const j = ca[i]; return j >= from && j <= to && visible(i) ? j : -1; };
    const marks: SeriesMarker<Time>[] = [];
    if (!sel) result.stepDone.forEach((steps, bi) => steps.forEach((idx, si) => {
      const isFocus = focus && focus.bi === bi && focus.si === si;
      if (!isFocus) return; // only the focused step's completions: all of them at once is noise
      const short = setup.branches[bi]?.side === 'short';
      for (const i of idx) { const j = inSpan(i); if (j >= 0) marks.push({ time: T(j) as Time, position: short ? 'aboveBar' : 'belowBar', color: STEP_COLORS[si % STEP_COLORS.length], shape: 'circle', size: isFocus ? 1 : 0.6, text: isFocus ? `${si + 1}` : '' }); }
    }));
    if (focus && showHeld && !sel) {
      const held = new Set(result.stepDone[focus.bi]?.[focus.si] || []);
      for (const i of result.stepHeld[focus.bi]?.[focus.si] || []) { if (held.has(i)) continue; const j = inSpan(i); if (j >= 0) marks.push({ time: T(j) as Time, position: 'inBar', color: 'rgba(148,163,184,0.5)', shape: 'square', size: 0.3 }); }
    }
    for (const s of result.signals) {
      const j = inSpan(s.i);
      if (j < 0) continue;
      const long = s.side === 'long';
      if (sel && s !== sel) continue;
      marks.push({ time: T(j) as Time, position: long ? 'belowBar' : 'aboveBar', color: s.refused ? '#94a3b8' : long ? C.reward : C.risk, shape: long ? 'arrowUp' : 'arrowDown', text: s.refused ? 'refused' : sel ? '' : `${long ? 'L' : 'S'} ${s.trade?.r != null ? (s.trade.r >= 0 ? '+' : '') + s.trade.r.toFixed(1) + 'R' : 'cxl'}` });
    }
    if (sel) {
      // the selected Signal: numbered step completions, fill and exits
      sel.stepBars.forEach((i, k) => { const j = inSpan(i); if (j >= 0) marks.push({ time: T(j) as Time, position: sel.side === 'long' ? 'belowBar' : 'aboveBar', color: STEP_COLORS[k % STEP_COLORS.length], shape: 'circle', text: `${k + 1}` }); });
      const t = sel.trade;
      if (t?.fillI != null) { const j = inSpan(t.fillI); if (j >= 0) marks.push({ time: T(j) as Time, position: 'inBar', color: C.entry, shape: 'square', size: 0.6, text: 'fill' }); }
      for (const x of dedupeExits(t?.exits || [])) { const j = inSpan(x.i); if (j >= 0) marks.push({ time: T(j) as Time, position: sel.side === 'long' ? 'aboveBar' : 'belowBar', color: /stop/.test(x.why) ? C.risk : C.reward, shape: 'circle', size: 0.6, text: x.why.replace('While in a Trade: ', '') }); }
    }
    marks.sort((a, b) => (a.time as number) - (b.time as number));
    cs.setMarkers(marks);

    // overlay shapes
    const sh: Shape[] = [];
    // Trading window as shaded bands
    let run0 = -1;
    for (let k = from; k <= to + 1; k++) {
      const inH = k <= to && inTradingHours(setup, B[k].min, B[k].t);
      if (inH && run0 < 0) run0 = k;
      if (!inH && run0 >= 0) { sh.push({ k: 'band', t1: T(run0), t2: T(k - 1), fill: 'rgba(116,198,157,0.045)' }); run0 = -1; }
    }
    const tOf1m = (i: number) => T(barOf(Math.min(i, cutI ?? i)));
    const tOfMs = (ms: number) => { let k = from; while (k < to && B[k + 1].t <= ms) k++; return T(k); };
    if (sel) {
      const t = sel.trade;
      const end1m = Math.min(t?.exitI ?? t?.cancelI ?? sel.i + 30 * tfMinutes(tf), cutI ?? Infinity, data.m1.length - 1);
      const tEnd = tOf1m(end1m), tSig = tOf1m(sel.i);
      for (const [name, v] of Object.entries(sel.caps) as [string, any][]) {
        if (!v || typeof v !== 'object' || name === 'draw') continue;
        const title = v.kind ? PATTERN_KINDS[v.kind as keyof typeof PATTERN_KINDS]?.title.replace(/ \(.*\)$/, '') : name;
        const startMs = v.path?.[0]?.[0] ?? v.bar1?.time ?? v.time ?? v.start_time ?? v.swing_time ?? v.formed;
        if (startMs != null && startMs > data.m1[cutI ?? data.m1.length - 1].t) continue;
        const t0 = startMs != null ? tOfMs(startMs) : tSig;
        if (Array.isArray(v.path) || Array.isArray(v.lines)) {
          const ps = (v.path || []) as [number, number][];
          for (let q = 1; q < ps.length; q++) sh.push({ k: 'line', t1: tOfMs(ps[q - 1][0]), t2: tOfMs(ps[q][0]), p1: ps[q - 1][1], p2: ps[q][1], stroke: 'rgba(116,198,157,0.85)', width: 1.5, label: q === 1 && v.pole ? `${name} · pole` : undefined });
          for (const [t1, p1, t2, p2] of (v.lines || []) as [number, number, number, number][]) sh.push({ k: 'line', t1: tOfMs(t1), t2: tOfMs(t2), p1, p2, stroke: '#fbbf24', width: 1.5 });
          if (v.neck_t0 != null) sh.push({ k: 'line', t1: tOfMs(v.neck_t0), t2: tOfMs(v.time), p1: v.neck_p0, p2: v.neckline, stroke: '#fbbf24', dash: true, label: `${name} · neckline` });
          if (v.lines && !v.neck_t0) sh.push({ k: 'line', t1: tOfMs(v.time), t2: tOfMs(v.time), p1: v.line, p2: v.line, stroke: '#fbbf24', label: `${name} · ${v.shape && v.shape !== 'flat' ? v.shape + ' ' : ''}breakout` });
          if (v.target != null) sh.push({ k: 'line', t1: tOfMs(v.time), t2: tEnd, p1: v.target, p2: v.target, stroke: 'rgba(248,113,113,0.8)', dash: true, label: `${name} · target` });
          continue;
        }
        if (typeof v.top === 'number') sh.push({ k: 'rect', t1: t0, t2: v.end_time != null ? tOfMs(v.end_time) : tEnd, p1: v.top, p2: v.bottom, fill: 'rgba(116,198,157,0.12)', stroke: 'rgba(116,198,157,0.7)', dash: true, label: `${name} · ${title}` });
        else if (typeof v.level === 'number') sh.push({ k: 'line', t1: tOfMs(v.swing_time ?? startMs), t2: tOfMs(v.time ?? v.formed), p1: v.level, p2: v.level, stroke: '#fbbf24', dash: true, label: `${name} · MSS` });
        else if (typeof v.start === 'number' && v.start_time != null) { sh.push({ k: 'line', t1: tOfMs(v.start_time), t2: tOfMs(v.end_time), p1: v.start, p2: v.end, stroke: '#fbbf24', width: 2, label: `${name} · Swing` }); sh.push({ k: 'line', t1: tOfMs(v.end_time), t2: tEnd, p1: v.mid, p2: v.mid, stroke: 'rgba(251,191,36,0.5)', dash: true, label: '50%' }); }
        else if (typeof v.high === 'number' && v.time != null) sh.push({ k: 'rect', t1: tOfMs(v.time), t2: tOfMs(v.time), p1: v.high, p2: v.low, fill: 'rgba(251,191,36,0.15)', stroke: '#fbbf24', label: name });
        else if (typeof v.low === 'number' || typeof v.high === 'number') { const pv = v.low ?? v.high; sh.push({ k: 'line', t1: tOf1m(sel.stepBars[0] ?? sel.i), t2: tSig, p1: pv, p2: pv, stroke: '#94a3b8', dash: true, label: name }); }
      }
      if (sel.caps.draw && (cutI == null || cutI >= sel.i)) sh.push({ k: 'line', t1: tSig, t2: tEnd, p1: sel.caps.draw.price, p2: sel.caps.draw.price, stroke: C.draw, dash: true, label: 'Draw on liquidity' });
      const showTrade = !sel.refused && (cutI == null || cutI >= sel.i);
      if (showTrade && t?.fillI != null && (cutI == null || cutI >= t.fillI)) {
        const tf0 = tOf1m(t.fillI), far = sel.legs.length ? sel.legs[sel.legs.length - 1].price : sel.entry;
        sh.push({ k: 'rect', t1: tf0, t2: tEnd, p1: sel.entry, p2: sel.stop, fill: 'rgba(239,68,68,0.16)', label: 'risk', labelColor: '#fca5a5', right: true });
        sh.push({ k: 'rect', t1: tf0, t2: tEnd, p1: sel.entry, p2: far, fill: 'rgba(34,197,94,0.14)', label: 'reward', labelColor: '#86efac', right: true });
        for (const l of sel.legs) sh.push({ k: 'line', t1: tf0, t2: tEnd, p1: l.price, p2: l.price, stroke: 'rgba(134,239,172,0.8)', label: `${l.name} ×${l.contracts}` });
      } else if (showTrade) {
        sh.push({ k: 'line', t1: tSig, t2: tEnd, p1: sel.entry, p2: sel.entry, stroke: C.entry, dash: true, label: `${sel.side} entry` });
        sh.push({ k: 'line', t1: tSig, t2: tEnd, p1: sel.stop, p2: sel.stop, stroke: C.risk, dash: true, label: 'stop' });
      }
    }
    shapes.current = sh;
    // price-axis labels for the selected Signal (lines are drawn by the overlay)
    (cs as any)._lines?.forEach((l: any) => cs.removePriceLine(l));
    const lines: any[] = [];
    if (sel && !sel.refused) {
      const add = (price: number, color: string, title: string) => lines.push(cs.createPriceLine({ price, color, title, lineVisible: false, axisLabelVisible: true }));
      add(sel.entry, '#64748b', 'entry'); add(sel.stop, C.risk, 'stop');
      sel.legs.forEach((l) => add(l.price, '#16a34a', l.name));
    }
    (cs as any)._lines = lines;

    c.timeScale().fitContent();
    if (sel) {
      const j = Math.min(to, ca[sel.i]), w = tfMinutes(tf) === 1 ? 45 : 25;
      const endJ = sel.trade?.exitI != null ? ca[sel.trade.exitI] : j + 20;
      c.timeScale().setVisibleRange({ from: T(Math.max(from, (ca[sel.stepBars[0] ?? sel.i] || j) - w)) as Time, to: T(Math.min(toFull, Math.max(endJ, j) + 15)) as Time });
    } else if (tfMinutes(tf) <= 5 && setup.settings.trading_hours.ranges.length === 1) {
      const r = setup.settings.trading_hours.ranges[0], s0 = (hmN(r.start) - 60 + 1440) % 1440, e0 = (hmN(r.end) + 60) % 1440;
      const ks = []; for (let k = from; k <= to; k++) if (B[k].di === day && inR(B[k].min, s0, e0)) ks.push(k);
      if (ks.length > 10) c.timeScale().setVisibleRange({ from: T(ks[0]) as Time, to: T(ks[ks.length - 1]) as Time });
    }
    return () => c.unsubscribeCrosshairMove(onMove);
  }, [span, result, focus, selected, setup.indicators, setup.settings.trading_hours, data, tf, showHeld, compactBar, replay, events]);

  const daySignals = result.signals.filter((s) => data.m1[s.i].di === day);
  const daysWithSignals = [...new Set(result.signals.map((s) => data.m1[s.i].di))];
  const nextSigDay = (dir: 1 | -1) => { const c = daysWithSignals.filter((d) => (dir > 0 ? d > day : d < day)); return c.length ? (dir > 0 ? c[0] : c[c.length - 1]) : day; };
  const dt = data.days[day]?.td ? new Date(data.days[day].td + 'T12:00:00Z') : null;
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 pb-2 text-xs">
        <div className="flex items-center rounded-md border">
          <button className="px-2 py-1 hover:bg-accent" onClick={() => setDay(Math.max(0, day - 1))} title="previous Trading day">‹</button>
          <span className="px-2 font-medium">{dt ? dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) : ''}</span>
          <button className="px-2 py-1 hover:bg-accent" onClick={() => setDay(Math.min(data.days.length - 1, day + 1))} title="next Trading day">›</button>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setDay(nextSigDay(-1))}>‹ prev Signal day</Button>
        <Button size="sm" variant="ghost" onClick={() => setDay(nextSigDay(1))}>next Signal day ›</Button>
        <span className="flex-1" />
        {daySignals.length === 0 && <span className="text-muted-foreground">no Signal this day</span>}
        {daySignals.map((s, k) => (
          <button key={k} onClick={() => setSelected?.(selected === s ? null : s)} className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 transition', selected === s ? 'border-sky-400 bg-sky-500/15' : 'hover:bg-accent')}>
            <span className={cn('h-1.5 w-1.5 rounded-full', s.side === 'long' ? 'bg-emerald-400' : 'bg-red-400')} />
            {s.side} {fmtT(data, s.i)}
            {s.refused ? <span className="text-muted-foreground">refused</span> : s.trade?.r != null ? <span className={cn('font-semibold', s.trade.r >= 0 ? 'text-emerald-400' : 'text-red-400')}>{s.trade.r >= 0 ? '+' : ''}{s.trade.r.toFixed(2)}R</span> : <span className="text-muted-foreground">cancelled</span>}
          </button>
        ))}
      </div>
      <div ref={wrap} className="relative overflow-hidden rounded-lg border bg-[hsl(var(--chart))]">
        <div ref={el} style={{ height }} className="w-full" />
        <svg ref={svg} className="pointer-events-none absolute left-0 top-0" width="100%" height={height} />
        <div className="pointer-events-none absolute left-2 top-1.5 z-10 max-w-[70%] space-y-0.5 rounded-md bg-[hsl(var(--chart))]/50 px-1.5 py-1 text-[11px] leading-tight">
          <div><span className="font-semibold text-foreground">MNQ · {tf}</span> <span className="mono text-muted-foreground">{legend.ohlc}</span></div>
          {legend.rows.filter((r) => r.onPrice).map((r) => <div key={r.label} className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded" style={{ background: r.color }} /><span className="text-muted-foreground">{r.label}</span><span className="mono">{r.value}</span></div>)}
          {legend.rows.some((r) => !r.onPrice) && <div className="flex flex-wrap items-center gap-x-2.5">{legend.rows.filter((r) => !r.onPrice).map((r) => <span key={r.label} className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: r.color }} /><span className="text-muted-foreground">{r.label}</span><span className="mono">{r.value}</span></span>)}</div>}
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-3 px-1 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-sky-400/25" />Trading window</span>
        {focus && !selected && <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: STEP_COLORS[focus.si % 6] }} />step {focus.si + 1} completed<span className="ml-1 h-1.5 w-1.5 bg-slate-400/60" />held alone</span>}
        {selected && <><span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm border border-dashed border-sky-400 bg-sky-400/20" />pattern zone</span><span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-red-500/40" />risk</span><span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-emerald-500/40" />reward</span><span className="flex items-center gap-1"><span className="h-0.5 w-3 bg-violet-400" />Draw on liquidity</span></>}
        {!selected && <span>{focus ? '' : 'Pick a step to see where it completes. '}Click a Signal above to see its zones and replay it.</span>}
      </div>
      {selected && <SignalPanel data={data} s={selected} events={events} replay={replay} setReplay={(r) => { setPlaying(false); setReplay(r); }} playing={playing} play={() => { if (replay == null || replay >= events.length - 1) setReplay(0); setPlaying(true); }} onClose={() => setSelected?.(null)} />}
    </div>
  );
}

function dedupeExits(xs: { i: number; price: number; why: string }[]) {
  const out: { i: number; price: number; why: string; n: number }[] = [];
  for (const x of xs) { const o = out.find((y) => y.i === x.i && y.why === x.why && y.price === x.price); if (o) o.n++; else out.push({ ...x, n: 1 }); }
  return out;
}
export function fmtT(data: Data, i: number) { const d = new Date((chartTime(data.m1[i].t) + 60) * 1000); return d.toISOString().slice(11, 16); }

function SignalPanel({ data, s, events, replay, setReplay, playing, play, onClose }: { data: Data; s: Signal; events: ReplayEvent[]; replay: number | null; setReplay: (r: number | null) => void; playing: boolean; play: () => void; onClose: () => void }) {
  const risk = Math.abs(s.entry - s.stop);
  const r = s.trade?.r;
  const stat = (label: string, value: React.ReactNode, cls = '') => <div key={label}><div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div><div className={cn('mono text-sm', cls)}>{value}</div></div>;
  return (
    <div className="mt-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('rounded px-1.5 py-0.5 text-xs font-semibold uppercase', s.side === 'long' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300')}>{s.side}</span>
        <span className="text-sm font-semibold">Signal at {fmtT(data, s.i)} NY</span>
        {s.refused ? <Badge tone="warn">refused: {s.refused}</Badge> : <Badge tone={r != null ? (r >= 0 ? 'ok' : 'error') : 'default'}>{s.trade?.outcome}{r != null ? ` · ${r >= 0 ? '+' : ''}${r.toFixed(2)}R` : ''}</Badge>}
        <span className="flex-1" />
        <Button size="sm" variant="outline" onClick={() => setReplay(replay == null ? 0 : Math.max(0, replay - 1))} title="previous event">‹</Button>
        <Button size="sm" onClick={play}>{playing ? 'Playing…' : replay == null ? '▶ Replay' : '▶ Play'}</Button>
        <Button size="sm" variant="outline" onClick={() => setReplay(replay == null ? 0 : Math.min(events.length - 1, replay + 1))} title="next event">›</Button>
        {replay != null && <Button size="sm" variant="ghost" onClick={() => setReplay(null)}>show all</Button>}
        <Button size="sm" variant="ghost" onClick={onClose}>×</Button>
      </div>
      {!s.refused && (
        <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {stat('Entry', s.entry.toFixed(2))}
          {stat('Stop', s.stop.toFixed(2), 'text-red-300')}
          {stat('Risk', `${risk.toFixed(2)} pts`)}
          {s.legs.slice(0, 2).map((l) => stat(`${l.name} ×${l.contracts}`, l.price.toFixed(2), 'text-emerald-300'))}
          {s.caps.draw && stat('Draw', s.caps.draw.price.toFixed(2), 'text-violet-300')}
        </div>
      )}
      <ol className="mt-3 space-y-0.5 border-l pl-3">
        {events.map((e, k) => (
          <li key={k}>
            <button onClick={() => setReplay(k)} className={cn('relative flex w-full items-center gap-2 rounded px-1.5 py-0.5 text-left text-xs transition', replay === k ? 'bg-sky-500/15' : 'hover:bg-accent', replay != null && k > replay && 'opacity-40')}>
              <span className="absolute -left-[17px] h-2 w-2 rounded-full ring-2 ring-background" style={{ background: e.color }} />
              <span className="mono w-11 text-muted-foreground">{fmtT(data, e.i)}</span>
              <span>{e.label}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="mt-2 text-[10px] text-muted-foreground">Rough simulation for the prototype; the engine's is the real one.</div>
    </div>
  );
}

export function StepStats({ result, bi, si, data }: { result: RunResult; bi: number; si: number; data: Data }) {
  const held = result.stepHeld[bi]?.[si] || [], done = result.stepDone[bi]?.[si] || [];
  const days = new Set(done.map((i) => data.m1[i].di)).size;
  return (
    <span className="text-[11px] text-muted-foreground">
      held alone on <b className="text-foreground">{held.length}</b> bars · completed <b className="text-foreground">{done.length}</b>× on {days} days
    </span>
  );
}

export function runStats(result: RunResult) {
  const taken = result.signals.filter((s) => !s.refused && s.trade?.r != null);
  const r = taken.reduce((a, s) => a + (s.trade!.r || 0), 0);
  const wins = taken.filter((s) => (s.trade!.r || 0) > 0).length;
  return { signals: result.signals.length, refused: result.signals.filter((s) => s.refused).length, trades: taken.length, r, wins, winRate: taken.length ? wins / taken.length : 0 };
}

export function RunSummary({ result, data }: { result: RunResult; data: Data }) {
  const st = runStats(result);
  const tile = (label: string, value: React.ReactNode, cls = '') => <div className="flex items-baseline gap-1.5"><span className={cn('text-sm font-semibold tabular-nums', cls)}>{value}</span><span className="text-[11px] text-muted-foreground">{label}</span></div>;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {tile('Signals', st.signals)}
      {tile('refused', st.refused, st.refused ? 'text-amber-300' : '')}
      {tile('Trades', st.trades)}
      {tile('win rate', st.trades ? `${Math.round(st.winRate * 100)}%` : '–')}
      {tile('total', `${st.r >= 0 ? '+' : ''}${st.r.toFixed(2)}R`, st.r >= 0 ? 'text-emerald-400' : 'text-red-400')}
      <span className="text-[11px] text-muted-foreground">on {data.days.length} Trading days of MNQ · {result.ms.toFixed(0)} ms</span>
      {result.errors.map((e) => <Badge key={e} tone="error">{e}</Badge>)}
    </div>
  );
}

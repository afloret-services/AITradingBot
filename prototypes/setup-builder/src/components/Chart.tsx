// PROTOTYPE: TradingView Lightweight Charts on the real MNQ bars, with each step's effect drawn on it.
import React, { useEffect, useMemo, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, LineStyle, SeriesMarker, Time, CrosshairMode } from 'lightweight-charts';
import { Data, RunResult, bars, closedAt, chartTime, indicatorSeries, Signal } from '../engine';
import { Setup, TF, parseToken, tfMinutes } from '../model';
import { STEP_COLORS, Button, Badge, cn } from './ui';

const hmN = (x: string) => { const [h, m] = x.split(':').map(Number); return h * 60 + (m || 0); };
const inR = (m: number, s: number, e: number) => (s <= e ? m >= s && m < e : m >= s || m < e);
export interface Focus { bi: number; si: number }

export function dayOfSignal(data: Data, s: Signal) { return data.m1[s.i].di; }

export function Chart({ data, setup, result, day, setDay, focus, selected, setSelected, height = 340, showHeld = true, compactBar }: {
  data: Data; setup: Setup; result: RunResult; day: number; setDay: (d: number) => void; focus?: Focus | null; selected?: Signal | null; setSelected?: (s: Signal | null) => void; height?: number; showHeld?: boolean; compactBar?: boolean;
}) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candle = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const extra = useRef<ISeriesApi<any>[]>([]);
  const tf: TF = setup.settings.base_bar === '1d' ? '1h' : setup.settings.base_bar;
  const ctxDays = tfMinutes(tf) >= 15 ? 2 : 0; // a little history on coarse Base bars

  useEffect(() => {
    if (!el.current) return;
    const c = createChart(el.current, {
      height, layout: { background: { color: 'transparent' }, textColor: '#9aa4b2', fontSize: 11 },
      grid: { vertLines: { color: 'rgba(148,163,184,0.06)' }, horzLines: { color: 'rgba(148,163,184,0.06)' } },
      rightPriceScale: { borderColor: 'rgba(148,163,184,0.2)', scaleMargins: { top: 0.05, bottom: 0.3 } },
      timeScale: { borderColor: 'rgba(148,163,184,0.2)', timeVisible: true, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Normal }, autoSize: true,
    });
    chart.current = c;
    candle.current = c.addCandlestickSeries({ upColor: '#22c55e', downColor: '#ef4444', borderVisible: false, wickUpColor: '#22c55e', wickDownColor: '#ef4444' });
    return () => { c.remove(); chart.current = null; };
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
    extra.current.forEach((s) => c.removeSeries(s));
    extra.current = [];
    const [from, to] = span;
    const T = (k: number) => chartTime(B[k].t) as Time;
    cs.setData(B.slice(from, to + 1).map((b, k) => ({ time: T(from + k), open: b.o, high: b.h, low: b.l, close: b.c })));
    // declared indicators on the chart timeframe
    let oscN = 0;
    for (const ind of setup.indicators) {
      const p = parseToken(ind.token);
      if (p.parts[3] !== tf) continue;
      const name = p.parts[1];
      const vals = indicatorSeries(data, name, p.parts[2], tf, p.parts[4]);
      const pts = [] as { time: Time; value: number; color?: string }[];
      for (let k = from; k <= to; k++) if (vals[k] != null) pts.push({ time: T(k), value: vals[k]!, color: name === 'macd' && p.parts[4] === 'hist' ? (vals[k]! >= 0 ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)') : undefined });
      if (name === 'ema' || name === 'sma') {
        const s = c.addLineSeries({ color: '#fbbf24', lineWidth: 2, priceLineVisible: false, lastValueVisible: false, title: ind.label || `${name.toUpperCase()} ${p.parts[2]}` });
        s.setData(pts); extra.current.push(s);
      } else if (name === 'macd') {
        const id = 'macd';
        const s = p.parts[4] === 'hist'
          ? c.addHistogramSeries({ priceScaleId: id, priceLineVisible: false, lastValueVisible: false })
          : c.addLineSeries({ priceScaleId: id, color: p.parts[4] === 'signal' ? '#f97316' : '#38bdf8', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
        c.priceScale(id).applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } });
        s.setData(pts); extra.current.push(s);
      } else if (name === 'adx' || name === 'rsi') {
        const id = name;
        const s = c.addLineSeries({ priceScaleId: id, color: '#c084fc', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, title: name.toUpperCase() });
        c.priceScale(id).applyOptions({ scaleMargins: { top: 0.75, bottom: 0 }, visible: false });
        s.setData(pts); extra.current.push(s); oscN++;
      }
    }
    // markers: step completions, the focused step's "held" bars, Signals
    const ca = closedAt(data, tf);
    const inSpan = (i: number) => { const j = ca[i]; return j >= from && j <= to ? j : -1; };
    const marks: SeriesMarker<Time>[] = [];
    result.stepDone.forEach((steps, bi) => steps.forEach((idx, si) => {
      const isFocus = focus && focus.bi === bi && focus.si === si;
      if (focus && !isFocus && !compactBar) return;
      const short = setup.branches[bi]?.side === 'short';
      for (const i of idx) { const j = inSpan(i); if (j >= 0) marks.push({ time: T(j), position: short ? 'aboveBar' : 'belowBar', color: STEP_COLORS[si % STEP_COLORS.length], shape: 'circle', size: isFocus ? 1 : 0.5, text: isFocus ? `${si + 1}` : '' }); }
    }));
    if (focus && showHeld) {
      const held = new Set(result.stepDone[focus.bi]?.[focus.si] || []);
      for (const i of result.stepHeld[focus.bi]?.[focus.si] || []) { if (held.has(i)) continue; const j = inSpan(i); if (j >= 0) marks.push({ time: T(j), position: 'inBar', color: 'rgba(148,163,184,0.55)', shape: 'square', size: 0.3 }); }
    }
    for (const s of result.signals) {
      const j = inSpan(s.i);
      if (j < 0) continue;
      const long = s.side === 'long';
      marks.push({ time: T(j), position: long ? 'belowBar' : 'aboveBar', color: s.refused ? '#94a3b8' : long ? '#22c55e' : '#ef4444', shape: long ? 'arrowUp' : 'arrowDown', text: s.refused ? 'refused' : `${long ? 'L' : 'S'} ${s.trade?.r != null ? (s.trade.r >= 0 ? '+' : '') + s.trade.r.toFixed(2) + 'R' : s.trade?.outcome?.startsWith('entry') ? 'cxl' : ''}` });
    }
    marks.sort((a, b) => (a.time as number) - (b.time as number));
    cs.setMarkers(marks);
    // the selected Signal's levels
    (cs as any)._lines?.forEach((l: any) => cs.removePriceLine(l));
    const lines: any[] = [];
    const sel = selected && inSpan(selected.i) >= 0 ? selected : null;
    if (sel) {
      const add = (price: number, color: string, title: string, style = LineStyle.Solid) => lines.push(cs.createPriceLine({ price, color, title, lineWidth: 1, lineStyle: style, axisLabelVisible: true }));
      add(sel.entry, '#e2e8f0', 'entry');
      add(sel.stop, '#ef4444', 'stop');
      sel.legs.forEach((l) => add(l.price, '#22c55e', `${l.name} ×${l.contracts}`, LineStyle.Dashed));
      if (sel.caps.draw) add(sel.caps.draw.price, '#a78bfa', 'draw', LineStyle.Dotted);
      // every captured pattern: zones (FVG, Order block) as top/bottom, MSS as its broken level, Leg as its two ends
      for (const [name, v] of Object.entries(sel.caps) as [string, any][]) {
        if (!v || typeof v !== 'object' || name === 'draw') continue;
        const col = 'rgba(56,189,248,0.6)';
        if (typeof v.top === 'number') { add(v.top, col, `${name} top`, LineStyle.Dotted); add(v.bottom, col, `${name} bottom`, LineStyle.Dotted); }
        else if (typeof v.level === 'number') add(v.level, col, `${name} level`, LineStyle.Dotted);
        else if (typeof v.start === 'number') { add(v.start, col, `${name} start`, LineStyle.Dotted); add(v.end, col, `${name} end`, LineStyle.Dotted); }
      }
    }
    (cs as any)._lines = lines;
    c.timeScale().fitContent();
    if (sel) {
      const j = inSpan(sel.i), w = tfMinutes(tf) === 1 ? 90 : 40;
      c.timeScale().setVisibleRange({ from: T(Math.max(from, j - w)), to: T(Math.min(to, j + w)) });
    } else if (tfMinutes(tf) <= 5 && setup.settings.trading_hours.ranges.length === 1) {
      // open on the Trading hours, with an hour either side
      const r = setup.settings.trading_hours.ranges[0], s0 = (hmN(r.start) - 60 + 1440) % 1440, e0 = (hmN(r.end) + 60) % 1440;
      const ks = []; for (let k = from; k <= to; k++) if (B[k].di === day && inR(B[k].min, s0, e0)) ks.push(k);
      if (ks.length > 10) c.timeScale().setVisibleRange({ from: T(ks[0]), to: T(ks[ks.length - 1]) });
    }
    void oscN;
  }, [span, result, focus, selected, setup.indicators, data, tf, showHeld, compactBar]);

  const daySignals = result.signals.filter((s) => data.m1[s.i].di === day);
  const daysWithSignals = [...new Set(result.signals.map((s) => data.m1[s.i].di))];
  const nextSigDay = (dir: 1 | -1) => { const c = daysWithSignals.filter((d) => (dir > 0 ? d > day : d < day)); return c.length ? (dir > 0 ? c[0] : c[c.length - 1]) : day; };
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 px-1 pb-1.5 text-xs">
        <Button size="sm" variant="outline" onClick={() => setDay(Math.max(0, day - 1))}>‹ day</Button>
        <span className="mono w-24 text-center">{data.days[day]?.td}</span>
        <Button size="sm" variant="outline" onClick={() => setDay(Math.min(data.days.length - 1, day + 1))}>day ›</Button>
        <Button size="sm" variant="ghost" onClick={() => setDay(nextSigDay(-1))}>‹ Signal day</Button>
        <Button size="sm" variant="ghost" onClick={() => setDay(nextSigDay(1))}>Signal day ›</Button>
        <span className="text-muted-foreground">{tf} bars · NY time</span>
        <span className="ml-auto flex flex-wrap gap-1">
          {daySignals.map((s, k) => (
            <button key={k} onClick={() => setSelected?.(selected === s ? null : s)} className={cn('rounded border px-1.5 py-0.5', selected === s ? 'border-sky-400 bg-sky-500/10' : 'border-input')}>
              {s.side} {fmtT(data, s.i)} {s.refused ? <span className="text-muted-foreground">refused</span> : s.trade?.r != null ? <span className={s.trade.r >= 0 ? 'text-emerald-400' : 'text-red-400'}>{s.trade.r.toFixed(2)}R</span> : <span className="text-muted-foreground">cancelled</span>}
            </button>
          ))}
        </span>
      </div>
      <div ref={el} style={{ height }} className="w-full" />
      {selected && <SignalDetail data={data} s={selected} />}
    </div>
  );
}

export function fmtT(data: Data, i: number) { const d = new Date((chartTime(data.m1[i].t) + 60) * 1000); return d.toISOString().slice(11, 16); }

function SignalDetail({ data, s }: { data: Data; s: Signal }) {
  return (
    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 rounded-md bg-muted/50 px-2 py-1.5 text-xs">
      <span><b>{s.side}</b> Signal at {fmtT(data, s.i)} NY</span>
      <span>entry <span className="mono">{s.entry.toFixed(2)}</span></span>
      <span>stop <span className="mono">{s.stop.toFixed(2)}</span></span>
      {s.legs.map((l) => <span key={l.name}>{l.name} <span className="mono">{l.price.toFixed(2)}</span> ×{l.contracts}</span>)}
      {s.caps.draw && <span>draw <span className="mono">{s.caps.draw.price.toFixed(2)}</span></span>}
      {s.refused ? <Badge tone="warn">refused: {s.refused}</Badge> : <Badge tone={s.trade?.r != null ? (s.trade.r >= 0 ? 'ok' : 'error') : 'default'}>{s.trade?.outcome}{s.trade?.r != null ? ` · ${s.trade.r.toFixed(2)}R` : ''}</Badge>}
      <span className="text-muted-foreground">(rough simulation: the real one is the engine's)</span>
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

export function RunSummary({ result, data }: { result: RunResult; data: Data }) {
  const taken = result.signals.filter((s) => !s.refused && s.trade?.r != null);
  const r = taken.reduce((a, s) => a + (s.trade!.r || 0), 0);
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <Badge>{data.days.length} Trading days of MNQ</Badge>
      <Badge>{result.signals.length} Signals</Badge>
      <Badge>{taken.length} Trades</Badge>
      <Badge tone={r >= 0 ? 'ok' : 'error'}>{r >= 0 ? '+' : ''}{r.toFixed(2)}R</Badge>
      <span className="text-muted-foreground">evaluated in {result.ms.toFixed(0)} ms</span>
      {result.errors.map((e) => <Badge key={e} tone="error">{e}</Badge>)}
    </div>
  );
}

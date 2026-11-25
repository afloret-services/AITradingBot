// PROTOTYPE, throwaway. A rough Rule-block evaluator over the strategy-lab MNQ 1m bars, so each builder step
// shows its effect on real bars. It is NOT the engine (#78 rebuilds the three Setups and matches Trade lists).
import type { Setup, Cond, Step, Branch, TF, Leg, Pattern } from './model';
import { tfMinutes, parseToken, mirrorFieldSide, PATTERN_KINDS } from './model';

export const TICK = 0.25;
export const MIN = 60000;
export const POINT_VALUE = 2; // MNQ $ per point

// ---------- New York time (as in strategy-lab) ----------
const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
const offCache = new Map<number, number>();
function nyOffset(t: number) {
  const h = Math.floor(t / 3600000);
  let o = offCache.get(h);
  if (o === undefined) {
    const p: any = {};
    for (const x of fmt.formatToParts(new Date(h * 3600000))) p[x.type] = x.value;
    o = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - h * 3600000;
    offCache.set(h, o);
  }
  return o;
}
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
export const nyMin = (t: number) => { const d = new Date(t + nyOffset(t)); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
export const tradingDate = (t: number) => isoDate(new Date(t + nyOffset(t) + 6 * 3600000));
/** chart time: NY wall clock as if UTC, so the chart axis reads New York */
export const chartTime = (t: number) => Math.floor((t + nyOffset(t)) / 1000);
export const hm = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + (m || 0); };
export const fmtMin = (m: number) => String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

export interface Bar { t: number; o: number; h: number; l: number; c: number; v: number; first: number; last: number; td: string; di: number; min: number }
export interface Day { td: string; from: number; to: number; o: number; h: number; l: number; c: number }
export interface Data {
  m1: Bar[];
  days: Day[];
  tfBars: Partial<Record<TF, Bar[]>>;
  /** for each tf, for each 1m index: index of the last tf bar closed at that 1m bar's close (-1 if none) */
  closedAt: Partial<Record<TF, Int32Array>>;
  sessions: SessionStats[];
}
interface SessionStats { [name: string]: { h: number; l: number; o: number; c: number; endI: number; startI: number } | undefined }

export function parseCsv(text: string): Data {
  const lines = text.trim().split(/\r?\n/);
  const rows: { t: number; o: number; h: number; l: number; c: number; v: number }[] = [];
  for (let k = 1; k < lines.length; k++) {
    const [ts, o, h, l, c, v] = lines[k].split(',');
    rows.push({ t: Date.parse(ts), o: +o, h: +h, l: +l, c: +c, v: +v || 0 });
  }
  rows.sort((a, b) => a.t - b.t);
  const m1: Bar[] = [];
  const days: Day[] = [];
  for (const r of rows) {
    if (m1.length && m1[m1.length - 1].t === r.t) continue;
    const i = m1.length, td = tradingDate(r.t);
    let d = days[days.length - 1];
    if (!d || d.td !== td) { d = { td, from: i, to: i, o: r.o, h: r.h, l: r.l, c: r.c }; days.push(d); }
    else { d.to = i; d.h = Math.max(d.h, r.h); d.l = Math.min(d.l, r.l); d.c = r.c; }
    m1.push({ ...r, first: i, last: i, td, di: days.length - 1, min: nyMin(r.t) });
  }
  const data: Data = { m1, days, tfBars: { '1m': m1 }, closedAt: {}, sessions: [] };
  data.sessions = days.map((d) => sessionStats(data, d, SESSION_DEFS));
  return data;
}

const SESSION_DEFS: Record<string, [string, string]> = { asia: ['20:00', '00:00'], london: ['02:00', '05:00'], new_york: ['09:30', '16:00'] };
export function inRange(min: number, start: string, end: string) {
  const s = hm(start), e = hm(end);
  return s <= e ? min >= s && min < e : min >= s || min < e; // may cross midnight
}
// the session windows of the Setup being run (set by run()); session levels are computed per set of windows and cached
let SESS: Record<string, [string, string]> = SESSION_DEFS;
const sessCache = new Map<string, SessionStats[]>();
function sess(data: Data): SessionStats[] {
  const key = JSON.stringify(SESS);
  if (key === JSON.stringify(SESSION_DEFS)) return data.sessions;
  if (!sessCache.has(key)) sessCache.set(key, data.days.map((d) => sessionStats(data, d, SESS)));
  return sessCache.get(key)!;
}
function sessionStats(data: Data, d: Day, defs: Record<string, [string, string]>): SessionStats {
  const out: SessionStats = {};
  for (const [name, [s, e]] of Object.entries(defs)) {
    let st: any;
    for (let i = d.from; i <= d.to; i++) {
      const b = data.m1[i];
      if (!inRange(b.min, s, e)) continue;
      if (!st) st = { h: b.h, l: b.l, o: b.o, c: b.c, startI: i, endI: i };
      else { st.h = Math.max(st.h, b.h); st.l = Math.min(st.l, b.l); st.c = b.c; st.endI = i; }
    }
    out[name] = st;
  }
  return out;
}

export function bars(data: Data, tf: TF): Bar[] {
  if (data.tfBars[tf]) return data.tfBars[tf]!;
  const out: Bar[] = [];
  if (tf === '1d') {
    data.days.forEach((d, di) => out.push({ t: data.m1[d.from].t, o: d.o, h: d.h, l: d.l, c: d.c, v: 0, first: d.from, last: d.to, td: d.td, di, min: data.m1[d.from].min }));
  } else {
    const mins = tfMinutes(tf);
    let cur: Bar | null = null;
    for (const b of data.m1) {
      // intraday bars align to the NY clock; 4h bars start at the Trading-day start (18:00)
      const since = tf === '4h' ? (b.min - 1080 + 1440) % 1440 : b.min;
      const k = b.t - (since % mins) * MIN;
      if (!cur || cur.t !== k) { cur = { t: k, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v, first: b.first, last: b.last, td: b.td, di: b.di, min: nyMin(k) }; out.push(cur); }
      else { cur.h = Math.max(cur.h, b.h); cur.l = Math.min(cur.l, b.l); cur.c = b.c; cur.v += b.v; cur.last = b.last; }
    }
  }
  data.tfBars[tf] = out;
  return out;
}

export function closedAt(data: Data, tf: TF): Int32Array {
  if (data.closedAt[tf]) return data.closedAt[tf]!;
  const B = bars(data, tf), arr = new Int32Array(data.m1.length).fill(-1);
  if (tf === '1d') {
    for (let i = 0; i < data.m1.length; i++) arr[i] = data.m1[i].di - 1 + (i === data.days[data.m1[i].di].to ? 1 : 0);
  } else {
    const mins = tfMinutes(tf);
    let j = -1;
    for (let i = 0; i < data.m1.length; i++) {
      const closeT = data.m1[i].t + MIN;
      while (j + 1 < B.length && B[j + 1].t + mins * MIN <= closeT) j++;
      // a bar also closes early when the next 1m bar belongs to another tf bar (data gap or session end)
      let jj = j;
      if (jj + 1 < B.length && B[jj + 1].last === i && (i + 1 >= data.m1.length || data.m1[i + 1].t >= B[jj + 1].t + mins * MIN)) jj++;
      arr[i] = jj;
      j = jj;
    }
  }
  data.closedAt[tf] = arr;
  return arr;
}

// ---------- indicators ----------
const indCache = new Map<string, (number | null)[]>();
export function clearIndicatorCache() { indCache.clear(); }
function emaArr(xs: number[], n: number) { const k = 2 / (n + 1), out: number[] = []; let e: number | null = null; for (const x of xs) { e = e == null ? x : x * k + e * (1 - k); out.push(e); } return out; }
function srcOf(b: Bar, src: string) { return src === 'open' ? b.o : src === 'high' ? b.h : src === 'low' ? b.l : src === 'hl2' ? (b.h + b.l) / 2 : src === 'hlc3' ? (b.h + b.l + b.c) / 3 : b.c; }
export function indicatorSeries(data: Data, name: string, params: string, tf: TF, output?: string): (number | null)[] {
  const key = `${name}:${params}:${tf}:${output || ''}`;
  if (indCache.has(key)) return indCache.get(key)!;
  const B = bars(data, tf);
  const pos = params.split(',').filter((p) => !p.includes('=')).map(Number);
  const kv = Object.fromEntries(params.split(',').filter((p) => p.includes('=')).map((p) => p.split('=')));
  const src = B.map((b) => srcOf(b, kv.src || 'close'));
  let out: (number | null)[] = [];
  if (name === 'ema') out = emaArr(src, pos[0]);
  else if (name === 'sma' || name === 'avg_range' || name === 'avg_body') {
    const n = pos[0], xs = name === 'sma' ? src : B.map((b) => (name === 'avg_range' ? b.h - b.l : Math.abs(b.c - b.o)));
    let s = 0;
    out = xs.map((x, i) => { s += x; if (i >= n) s -= xs[i - n]; return i >= n - 1 ? s / n : null; });
  } else if (name === 'macd') {
    const [f = 12, sl = 26, sg = 9] = pos;
    const slow = emaArr(src, sl), fast = emaArr(src, f);
    const l2 = fast.map((x, i) => x - slow[i]);
    const sig = emaArr(l2, sg);
    out = output === 'signal' ? sig : output === 'hist' ? l2.map((x, i) => x - sig[i]) : l2;
  } else if (name === 'atr' || name === 'adx' || name === 'plus_di' || name === 'minus_di') {
    const n = pos[0] || 14, L = B.length;
    const atr: (number | null)[] = new Array(L).fill(null), adx: (number | null)[] = new Array(L).fill(null);
    let trS = 0, pS = 0, mS = 0, dxS = 0, dxN = 0, adxV: number | null = null;
    for (let i = 1; i < L; i++) {
      const b = B[i], p = B[i - 1];
      const tr = Math.max(b.h - b.l, Math.abs(b.h - p.c), Math.abs(b.l - p.c));
      const up = b.h - p.h, dn = p.l - b.l;
      const pdm = up > dn && up > 0 ? up : 0, mdm = dn > up && dn > 0 ? dn : 0;
      if (i <= n) { trS += tr; pS += pdm; mS += mdm; } else { trS += tr - trS / n; pS += pdm - pS / n; mS += mdm - mS / n; }
      if (i < n) continue;
      atr[i] = trS / n;
      const pdi = trS ? (100 * pS) / trS : 0, mdi = trS ? (100 * mS) / trS : 0;
      const dx = pdi + mdi ? (100 * Math.abs(pdi - mdi)) / (pdi + mdi) : 0;
      if (adxV == null) { dxS += dx; dxN++; if (dxN === n) adxV = dxS / n; } else adxV = (adxV * (n - 1) + dx) / n;
      adx[i] = adxV;
    }
    out = name === 'atr' ? atr : adx;
  } else if (name === 'rsi') {
    const n = pos[0] || 14; let g = 0, l = 0;
    out = src.map((x, i) => {
      if (i === 0) return null;
      const d = x - src[i - 1], up = Math.max(d, 0), dn = Math.max(-d, 0);
      if (i <= n) { g += up / n; l += dn / n; return i === n ? 100 - 100 / (1 + g / (l || 1e-9)) : null; }
      g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n;
      return 100 - 100 / (1 + g / (l || 1e-9));
    });
  }
  indCache.set(key, out);
  return out;
}

// ---------- structure ----------
function isSwing(B: Bar[], j: number, n: number, side: 'high' | 'low') {
  if (j - n < 0 || j + n >= B.length) return false;
  for (let k = 1; k <= n; k++) {
    if (side === 'high' ? !(B[j - k].h < B[j].h && B[j + k].h < B[j].h) : !(B[j - k].l > B[j].l && B[j + k].l > B[j].l)) return false;
  }
  return true;
}
const biasCache = new Map<string, (string | null)[]>();
/** Bias on a tf: direction of the last close beyond the last confirmed Swing point (2 bars each side). Indexed by tf bar. */
function biasSeries(data: Data, tf: TF, n = 2) {
  const key = tf + n;
  if (biasCache.has(key)) return biasCache.get(key)!;
  const B = bars(data, tf), out: (string | null)[] = [];
  let sh: Bar | null = null, sl: Bar | null = null, bias: string | null = null;
  for (let i = 0; i < B.length; i++) {
    const j = i - n;
    if (j >= 0 && isSwing(B, j, n, 'high')) sh = B[j];
    if (j >= 0 && isSwing(B, j, n, 'low')) sl = B[j];
    if (sh && B[i].c > sh.h) bias = 'bullish';
    if (sl && B[i].c < sl.l) bias = 'bearish';
    out.push(bias);
  }
  biasCache.set(key, out);
  return out;
}

// ---------- evaluation ----------
export interface Ctx { data: Data; i: number; caps: Record<string, any>; trade?: any }

function levelValue(data: Data, parts: string[], i: number): number | null {
  // level:prev_day:high | level:day:open | level:session:asia:high[:current]
  const di = data.m1[i].di;
  const field = parts[parts.length - 1] === 'current' || parts[parts.length - 1] === 'last' ? parts[parts.length - 2] : parts[parts.length - 1];
  const f = (o: any) => (o ? o[field[0]] ?? null : null);
  if (parts[1] === 'prev_day') return di > 0 ? f({ h: data.days[di - 1].h, l: data.days[di - 1].l, o: data.days[di - 1].o, c: data.days[di - 1].c }) : null;
  if (parts[1] === 'day') {
    const d = data.days[di];
    let h = -Infinity, l = Infinity;
    for (let k = d.from; k <= i; k++) { h = Math.max(h, data.m1[k].h); l = Math.min(l, data.m1[k].l); }
    return f({ h, l, o: d.o, c: data.m1[i].c });
  }
  if (parts[1] === 'session') {
    const name = parts[2];
    const S = sess(data), win = SESS[name];
    if (!win) return null;
    const cur = S[di]?.[name];
    if (cur && cur.endI < i && !inRange(data.m1[i].min, ...win)) return f(cur);
    const prev = di > 0 ? S[di - 1]?.[name] : undefined;
    return f(prev);
  }
  return null;
}
function levelFormedAt(data: Data, tok: string, i: number): number {
  const p = parseToken(tok);
  const di = data.m1[i].di;
  if (p.parts[1] === 'prev_day') return data.days[di].from;
  if (p.parts[1] === 'session') {
    const S = sess(data), win = SESS[p.parts[2]];
    const cur = S[di]?.[p.parts[2]];
    if (cur && win && cur.endI < i && !inRange(data.m1[i].min, ...win)) return cur.endI + 1;
    return di > 0 ? (S[di - 1]?.[p.parts[2]]?.endI ?? 0) + 1 : 0;
  }
  return i;
}
export function untaken(data: Data, tok: string, price: number, i: number) {
  const high = tok.includes(':high');
  for (let k = levelFormedAt(data, tok, i); k <= i; k++) if (high ? data.m1[k].h >= price : data.m1[k].l <= price) return false;
  return true;
}

/** value of a token at 1m index i (the close of the current Base bar) */
export function value(ctx: Ctx, tok: string, extraPrev = 0): number | string | null {
  tok = tok.trim();
  if (/^-?\d+(\.\d+)?$/.test(tok)) return Number(tok);
  if (/^[a-z_]+$/.test(tok)) return tok; // enum literal: bullish, bearish, doji, long, short
  const p = parseToken(tok);
  const prev = p.prev + extraPrev;
  const { data, i } = ctx;
  const k = p.parts[0];
  if (k === 'bar' || k === 'indicator' || k === 'bias' || k === 'trend') {
    const tf = (k === 'bar' ? p.parts[2] : k === 'indicator' ? p.parts[3] : p.parts[1]) as TF;
    const j = closedAt(data, tf)[i] - prev;
    if (j < 0) return null;
    const B = bars(data, tf), b = B[j];
    if (k === 'bias') return biasSeries(data, tf)[j];
    if (k === 'trend') return null;
    if (k === 'indicator') return indicatorSeries(data, p.parts[1], p.parts[2], tf, p.parts[4])[j] ?? null;
    switch (p.parts[1]) {
      case 'open': return b.o; case 'high': return b.h; case 'low': return b.l; case 'close': return b.c; case 'volume': return b.v;
      case 'range': return b.h - b.l; case 'body': return Math.abs(b.c - b.o);
      case 'body_pct': return b.h > b.l ? (100 * Math.abs(b.c - b.o)) / (b.h - b.l) : 0;
      case 'upper_wick': return b.h - Math.max(b.o, b.c); case 'lower_wick': return Math.min(b.o, b.c) - b.l;
      case 'dir': return b.c > b.o ? 'bullish' : b.c < b.o ? 'bearish' : 'doji';
    }
    return null;
  }
  if (k === 'level') return levelValue(data, p.parts, i);
  if (k === 'capture') {
    let o: any = ctx.caps;
    for (const f of p.parts[1].split('.')) o = o?.[f];
    return typeof o === 'number' || typeof o === 'string' ? o : null;
  }
  if (k === 'fib') {
    const leg = ctx.caps[p.parts[1]];
    if (!leg) return null;
    return leg.end + (leg.start - leg.end) * Number(p.parts[2]);
  }
  if (k === 'draw') return ctx.caps.draw?.price ?? null;
  if (k === 'entry') return ctx.caps.entry ?? null;
  if (k === 'trade') return ctx.trade?.[p.parts[1]] ?? null;
  return null;
}

export interface Hit { ok: boolean; caps?: Record<string, any> }

/** evaluate a condition at 1m index i (a Base-bar close) */
export function evalCond(ctx: Ctx, c: Cond, base: Int32Array, p: number): Hit {
  switch (c.t) {
    case 'cmp': {
      const a = value(ctx, c.a), b0 = value(ctx, c.b);
      if (a == null || b0 == null) return { ok: false };
      const mult = c.mult ?? 1;
      if (typeof a === 'string' || typeof b0 === 'string') return { ok: c.op === '=' ? a === b0 : c.op === '!=' ? a !== b0 : false };
      const b = b0 * mult;
      switch (c.op) {
        case '>': return { ok: a > b }; case '>=': return { ok: a >= b - 1e-9 }; case '<': return { ok: a < b }; case '<=': return { ok: a <= b + 1e-9 };
        case '=': return { ok: Math.abs(a - b) < 1e-9 }; case '!=': return { ok: Math.abs(a - b) >= 1e-9 };
        case 'within': return { ok: Math.abs(a - b) <= (c.n ?? 0) };
        case 'crosses_above': case 'crosses_below': {
          const a1 = value(ctx, c.a, 1), b1 = value(ctx, c.b, 1);
          if (typeof a1 !== 'number' || typeof b1 !== 'number') return { ok: false };
          return { ok: c.op === 'crosses_above' ? a1 <= b1 * mult && a > b : a1 >= b1 * mult && a < b };
        }
        case 'rising': case 'falling': return { ok: false };
      }
      return { ok: false };
    }
    case 'all': {
      let caps: any = {};
      for (const it of c.items) { const h = evalCond(ctx, it, base, p); if (!h.ok) return { ok: false }; Object.assign(caps, h.caps); ctx = { ...ctx, caps: { ...ctx.caps, ...h.caps } }; }
      return { ok: true, caps };
    }
    case 'any': {
      for (const it of c.items) { const h = evalCond(ctx, it, base, p); if (h.ok) return h; }
      return { ok: c.items.length === 0 };
    }
    case 'not': return { ok: !evalCond(ctx, c.item, base, p).ok };
    case 'for_n': {
      for (let k = 0; k < c.n; k++) { if (p - k < 0) return { ok: false }; if (!evalCond({ ...ctx, i: base[p - k] }, c.item, base, p - k).ok) return { ok: false }; }
      return { ok: true };
    }
    case 'time': {
      const tfB = bars(ctx.data, c.tf || '1m'), j = closedAt(ctx.data, c.tf || '1m')[ctx.i];
      return { ok: j >= 0 && inRange(tfB[j].min, c.start, c.end) };
    }
    case 'fvg': return fvgAt(ctx, c);
    case 'draw': return drawAt(ctx, c);
    case 'pattern': return patternAt(ctx, c);
  }
  return { ok: false };
}

// ---------- declared Patterns: one series per (pattern settings, side), indexed by tf bar; non-null where it forms ----------
let PATS: Record<string, Pattern> = {}; // set by run(): the Setup's declared patterns
const patCache = new Map<string, (Record<string, any> | null)[]>();
function patternAt(ctx: Ctx, c: Extract<Cond, { t: 'pattern' }>): Hit {
  const p = PATS[c.ref];
  if (!p) return { ok: false };
  const j = closedAt(ctx.data, p.tf)[ctx.i];
  if (j < 0) return { ok: false };
  const caps = patternSeries(ctx.data, p, c.side)[j];
  return caps ? { ok: true, caps: { [p.name]: { ...caps, kind: p.kind, formed: bars(ctx.data, p.tf)[j].t } } } : { ok: false };
}
export function patternSeries(data: Data, p: Pattern, side: 'long' | 'short') {
  const key = JSON.stringify([p.kind, p.tf, p.params, side]);
  if (patCache.has(key)) return patCache.get(key)!;
  const B = bars(data, p.tf), P = p.params as Record<string, any>, long = side === 'long';
  const out: (Record<string, any> | null)[] = new Array(B.length).fill(null);
  const avg = indicatorSeries(data, 'avg_range', String(P.avg_len ?? 20), p.tf);
  const dirOk = (b: Bar) => (long ? b.c > b.o : b.c < b.o);
  // Displacement: range ≥ k × the average range of the bars before it, body % ≥ x, closing the side's way
  const isDisp = (k: number) => {
    if (k < 1) return false;
    const b = B[k], a = avg[k - 1], r = b.h - b.l;
    if (a == null) return false;
    return r >= P.disp_mult * a - 1e-9 && (r > 0 ? (100 * Math.abs(b.c - b.o)) / r : 0) >= P.disp_body_pct - 1e-9 && dirOk(b);
  };
  const bar = (b: Bar) => ({ open: b.o, high: b.h, low: b.l, close: b.c, time: b.t });
  const mins = tfMinutes(p.tf) * MIN;
  if (p.kind === 'fvg') {
    for (let j = 2; j < B.length; j++) {
      const c1 = B[j - 2], c2 = B[j - 1], c3 = B[j];
      if (c3.t - c1.t !== 2 * mins) continue;
      const bottom = long ? c1.h : c3.h, top = long ? c3.l : c1.l;
      if (top - bottom < P.min_gap_ticks * TICK - 1e-9) continue;
      if (P.middle_closes_gap_way && !dirOk(c2)) continue;
      if (P.displacement && !isDisp(j - 1)) continue;
      out[j] = { top, bottom, mid: (top + bottom) / 2, size: top - bottom, bar1: bar(c1), bar2: bar(c2), bar3: bar(c3) };
    }
  } else if (p.kind === 'displacement') {
    for (let j = 1; j < B.length; j++) if (isDisp(j)) { const b = B[j]; out[j] = { open: b.o, high: b.h, low: b.l, close: b.c, range: b.h - b.l, mid: (b.h + b.l) / 2, time: b.t }; }
  } else if (p.kind === 'order_block') {
    for (let j = 1; j < B.length; j++) {
      if (!isDisp(j)) continue;
      for (let k = j - 1; k >= Math.max(0, j - P.lookback); k--) {
        const b = B[k];
        if (long ? !(b.c < b.o) : !(b.c > b.o)) continue; // the last opposite candle
        const top = P.use_body ? Math.max(b.o, b.c) : b.h, bottom = P.use_body ? Math.min(b.o, b.c) : b.l;
        if (long ? B[j].c > top : B[j].c < bottom) out[j] = { top, bottom, mid: (top + bottom) / 2, size: top - bottom, open: b.o, close: b.c, time: b.t };
        break;
      }
    }
  } else if (p.kind === 'leg' || p.kind === 'mss') {
    const n = Number(P.strength) || 2;
    let sh: number | null = null, sl: number | null = null, broken = false;
    for (let j = 0; j < B.length; j++) {
      const s0 = j - n; // the bar confirmed as a swing at this close
      const newHigh = s0 >= 0 && isSwing(B, s0, n, 'high'), newLow = s0 >= 0 && isSwing(B, s0, n, 'low');
      if (p.kind === 'leg') {
        // up leg: the last swing low, then this newly confirmed swing high (down leg: the reverse)
        if (long && newHigh && sl != null && sl < s0 && B[s0].h - B[sl].l >= P.min_size_points - 1e-9) out[j] = { start: B[sl].l, end: B[s0].h, low: B[sl].l, high: B[s0].h, size: B[s0].h - B[sl].l, mid: (B[s0].h + B[sl].l) / 2, start_time: B[sl].t, end_time: B[s0].t };
        if (!long && newLow && sh != null && sh < s0 && B[sh].h - B[s0].l >= P.min_size_points - 1e-9) out[j] = { start: B[sh].h, end: B[s0].l, low: B[s0].l, high: B[sh].h, size: B[sh].h - B[s0].l, mid: (B[sh].h + B[s0].l) / 2, start_time: B[sh].t, end_time: B[s0].t };
      }
      if (newHigh) { sh = s0; if (long) broken = false; }
      if (newLow) { sl = s0; if (!long) broken = false; }
      if (p.kind === 'mss') {
        const ref = long ? sh : sl;
        if (ref == null || broken) continue;
        const lvl = long ? B[ref].h : B[ref].l;
        if (long ? B[j].c > lvl : B[j].c < lvl) {
          broken = true; // a level is shifted once; a break without Displacement still uses it up
          if (P.displacement && !isDisp(j)) continue;
          let lo = Infinity, hi = -Infinity;
          for (let k = ref; k <= j; k++) { lo = Math.min(lo, B[k].l); hi = Math.max(hi, B[k].h); }
          out[j] = { level: lvl, swing_low: long ? lo : B[sl ?? ref].l, swing_high: long ? B[ref].h : hi, high: B[j].h, low: B[j].l, close: B[j].c, swing_time: B[ref].t, time: B[j].t };
        }
      }
    }
  } else if (p.kind === 'double' || p.kind === 'triple' || p.kind === 'head_shoulders') {
    // detect the "top" version on (for bullish, upside-down) bars, then map prices back: real = sg × flipped
    const sg = long ? -1 : 1;
    const F = long ? B.map((b) => ({ ...b, o: -b.o, h: -b.l, l: -b.h, c: -b.c })) : B;
    const n = Number(P.strength) || 3, K = p.kind === 'double' ? 2 : 3;
    const highs: { i: number; p: number; used?: boolean }[] = [];
    const lowBetween = (a: number, b: number) => { let m = Infinity, mi = a; for (let k = a + 1; k < b; k++) if (F[k].l < m) { m = F[k].l; mi = k; } return { p: m, i: mi }; };
    const back = (x: number) => sg * x;
    for (let j = 0; j < B.length; j++) {
      const s0 = j - n;
      if (s0 >= 0 && isSwing(F, s0, n, 'high')) highs.push({ i: s0, p: F[s0].h });
      if (highs.length < K || j < 1) continue;
      const hs = highs.slice(-K), last = hs[K - 1];
      if (last.used || j <= last.i || j - last.i > P.break_within) continue;
      if (last.i - hs[0].i > P.max_bars || hs.some((h, k) => k > 0 && h.i - hs[k - 1].i < P.min_sep)) continue;
      let neckAt: (k: number) => number, top: number, height: number, troughs: { p: number; i: number }[];
      if (p.kind === 'head_shoulders') {
        const [a, b, c] = hs, t1 = lowBetween(a.i, b.i), t2 = lowBetween(b.i, c.i);
        troughs = [t1, t2];
        neckAt = (k) => t1.p + ((t2.p - t1.p) * (k - t1.i)) / Math.max(1, t2.i - t1.i);
        top = b.p; height = b.p - neckAt(b.i);
        if (height < P.min_height_points - 1e-9) continue;
        if (b.p - Math.max(a.p, c.p) < (P.head_margin_pct / 100) * height - 1e-9) continue;
        if (Math.abs(a.p - c.p) > (P.tolerance_pct / 100) * height + 1e-9) continue;
      } else {
        const nk = lowBetween(hs[0].i, last.i);
        troughs = K === 2 ? [nk] : [lowBetween(hs[0].i, hs[1].i), lowBetween(hs[1].i, hs[2].i)];
        neckAt = () => nk.p;
        top = Math.max(...hs.map((h) => h.p)); height = top - nk.p;
        if (height < P.min_height_points - 1e-9) continue;
        if (top - Math.min(...hs.map((h) => h.p)) > (P.tolerance_pct / 100) * height + 1e-9) continue;
      }
      // nothing above the pattern after its last peak, and this close is the first one through the neckline
      let broke = false;
      for (let k = last.i + 1; k < j; k++) if (F[k].h > top + 1e-9 || F[k].c < neckAt(k)) { broke = true; break; }
      if (broke) { last.used = true; continue; }
      if (!(F[j].c < neckAt(j))) continue;
      last.used = true;
      const neck = neckAt(j);
      const pts: [number, number][] = [];
      hs.forEach((h, k) => { pts.push([B[h.i].t, back(h.p)]); if (k < troughs.length) pts.push([B[troughs[k].i].t, back(troughs[k].p)]); });
      pts.sort((x, y) => x[0] - y[0]);
      pts.push([B[j].t, B[j].c]);
      const n0 = p.kind === 'head_shoulders' ? troughs[0] : { i: hs[0].i, p: neckAt(hs[0].i) };
      const caps: Record<string, any> = { neckline: back(neck), height, target: back(neck - height), extreme: back(top), path: pts, neck_t0: B[n0.i].t, neck_p0: back(neckAt(n0.i)), time: B[j].t };
      if (p.kind === 'head_shoulders') Object.assign(caps, { left_shoulder: back(hs[0].p), head: back(hs[1].p), right_shoulder: back(hs[2].p) });
      else hs.forEach((h, k) => (caps[['first', 'second', 'third'][k]] = back(h.p)));
      out[j] = caps;
    }
  } else if (p.kind === 'triangle' || p.kind === 'wedge' || p.kind === 'flag' || p.kind === 'pennant' || p.kind === 'rectangle' || p.kind === 'channel') {
    // written for the bearish side (a break down); the bullish side runs it on upside-down bars, real = sg × flipped
    const sg = long ? -1 : 1;
    const F = long ? B.map((b) => ({ ...b, o: -b.o, h: -b.l, l: -b.h, c: -b.c })) : B;
    const back = (x: number) => sg * x;
    const T = (i: number) => B[Math.max(0, Math.min(B.length - 1, i))].t;
    if (p.kind === 'flag' || p.kind === 'pennant') {
      // bear flag on F: pole down (high → low), then a pause drifting up or sideways, then a close below its bottom line
      let lastPoleEnd = -1;
      for (let j = P.flag_min + 1; j < B.length; j++) {
        let e = -1;
        for (let k = Math.max(1, j - P.flag_max); k <= j - P.flag_min; k++) if (e < 0 || F[k].l < F[e].l) e = k;
        if (e < 0 || e === lastPoleEnd) continue;
        let st = -1;
        for (let k = Math.max(0, e - P.pole_bars); k < e; k++) if (st < 0 || F[k].h > F[st].h) st = k;
        if (st < 0) continue;
        const pole = F[st].h - F[e].l;
        if (pole < P.pole_points - 1e-9) continue;
        let hi = -Infinity; for (let k = e + 1; k < j; k++) hi = Math.max(hi, F[k].h);
        if (hi - F[e].l > (P.max_retrace_pct / 100) * pole + 1e-9) continue;
        // the flag's bottom line: least squares through the lows from the pole's end
        const fit = (from: number, get: (b: Bar) => number) => {
          const xs: number[] = [], ys: number[] = [];
          for (let k = from; k < j; k++) { xs.push(k); ys.push(get(F[k])); }
          const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
          const sl0 = xs.reduce((a, x, q) => a + (x - mx) * (ys[q] - my), 0) / (xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1);
          return { at: (k: number) => my + sl0 * (k - mx), slope: sl0 };
        };
        if (p.kind === 'pennant') {
          if (j - e - 1 < P.flag_min) continue;
          const lw = fit(e + 1, (b) => b.l), hg = fit(e + 1, (b) => b.h);
          if (!(lw.slope >= 0 && hg.slope <= 0)) continue; // highs falling, lows rising
          const w0p = hg.at(e + 1) - lw.at(e + 1), w1p = hg.at(j - 1) - lw.at(j - 1);
          if (w0p <= 0 || w1p <= 0 || w1p > w0p * (1 - P.converge_pct / 100)) continue;
          let early = false; for (let k = e + 1; k < j; k++) if (F[k].c < lw.at(k)) { early = true; break; }
          if (early || !(F[j].c < lw.at(j))) continue;
          lastPoleEnd = e;
          out[j] = { line: back(lw.at(j)), pole, pole_start: back(F[st].h), pole_end: back(F[e].l), target: back(F[j].c - pole), breakout: B[j].c, time: B[j].t,
            path: [[T(st), back(F[st].h)], [T(e), back(F[e].l)]], lines: [[T(e + 1), back(lw.at(e + 1)), T(j), back(lw.at(j))], [T(e + 1), back(hg.at(e + 1)), T(j), back(hg.at(j))]] };
          continue;
        }
        const xs: number[] = [], ys: number[] = [];
        for (let k = e; k < j; k++) { xs.push(k); ys.push(F[k].l); }
        const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
        const slope = xs.reduce((a, x, q) => a + (x - mx) * (ys[q] - my), 0) / (xs.reduce((a, x) => a + (x - mx) ** 2, 0) || 1);
        const lineAt = (k: number) => my + slope * (k - mx);
        if (slope < -0.05 * pole / Math.max(1, j - e)) continue; // must drift against the pole, or sideways
        let early = false; for (let k = e + 1; k < j; k++) if (F[k].c < lineAt(k)) { early = true; break; }
        if (early || !(F[j].c < lineAt(j))) continue;
        lastPoleEnd = e;
        let topAt = -Infinity; for (let k = e + 1; k < j; k++) topAt = Math.max(topAt, F[k].h);
        out[j] = { line: back(lineAt(j)), pole, pole_start: back(F[st].h), pole_end: back(F[e].l), target: back(F[j].c - pole), breakout: B[j].c, time: B[j].t,
          path: [[T(st), back(F[st].h)], [T(e), back(F[e].l)]], lines: [[T(e), back(lineAt(e)), T(j), back(lineAt(j))], [T(e + 1), back(topAt), T(j), back(topAt + slope * (j - e - 1))]] };
      }
    } else {
      const n = Number(P.strength) || 3;
      const H: { i: number; p: number }[] = [], L: { i: number; p: number }[] = [];
      const used = new Set<string>();
      for (let j = 0; j < B.length; j++) {
        const s0 = j - n;
        if (s0 >= 0 && isSwing(F, s0, n, 'high')) H.push({ i: s0, p: F[s0].h });
        if (s0 >= 0 && isSwing(F, s0, n, 'low')) L.push({ i: s0, p: F[s0].l });
        if (H.length < 2 || L.length < 2) continue;
        const [hA, hB] = H.slice(-2), [lA, lB] = L.slice(-2);
        const start = Math.min(hA.i, lA.i), end = Math.max(hB.i, lB.i);
        if (j - start > P.max_bars || j <= end || j - end > P.break_within) continue;
        const key = `${hB.i}:${lB.i}`;
        if (used.has(key)) continue;
        const su = (hB.p - hA.p) / (hB.i - hA.i), sl = (lB.p - lA.p) / (lB.i - lA.i);
        const up = (k: number) => hA.p + su * (k - hA.i), lo = (k: number) => lA.p + sl * (k - lA.i);
        const w0 = up(start) - lo(start), w1 = up(end) - lo(end);
        if (w0 < P.min_height_points - 1e-9 || w1 <= 0) continue;
        if ((p.kind === 'triangle' || p.kind === 'wedge') && w1 > w0 * (1 - P.converge_pct / 100)) continue;
        const flat = (sl0: number) => Math.abs(sl0 * (end - start)) <= (P.flat_pct / 100) * w0;
        const uF = flat(su), lF = flat(sl);
        let shape = '';
        if (p.kind === 'triangle') {
          if (uF && !lF && sl > 0) shape = 'ascending'; else if (!uF && su < 0 && lF) shape = 'descending'; else if (!uF && !lF && su < 0 && sl > 0) shape = 'symmetrical';
          if (long && shape !== 'symmetrical') shape = shape === 'ascending' ? 'descending' : shape === 'descending' ? 'ascending' : shape; // names are for the real chart
          if (!shape || !P[`allow_${shape}`]) continue;
        } else if (p.kind === 'wedge') { if (!(su > 0 && sl > 0 && !uF && !lF)) continue; } // a rising wedge on F (a falling one for bullish)
        else if (p.kind === 'rectangle') { if (!(uF && lF)) continue; shape = 'flat'; }
        else {
          // channel: both lines slope the same way and stay parallel
          if (uF || lF || Math.sign(su) !== Math.sign(sl) || Math.abs(su - sl) * (end - start) > (P.flat_pct / 100) * w0) continue;
          shape = (su > 0) !== long ? 'rising' : 'falling'; // names are for the real chart
          if (!P[`allow_${shape}`]) continue;
        }
        // inside until now, first close below the bottom line now
        let out0 = false; for (let k = end + 1; k < j; k++) if (F[k].c < lo(k) || F[k].c > up(k)) { out0 = true; break; }
        if (out0) { used.add(key); continue; }
        if (!(F[j].c < lo(j))) continue;
        used.add(key);
        out[j] = { line: back(lo(j)), opposite: back(up(j)), height: w0, target: back(lo(j) - w0), breakout: B[j].c, shape: p.kind === 'wedge' ? (long ? 'falling' : 'rising') : shape, time: B[j].t,
          lines: [[T(hA.i), back(hA.p), T(j), back(up(j))], [T(lA.i), back(lA.p), T(j), back(lo(j))]], path: [] };
      }
    }
  } else if (['broadening', 'broadening_wedge', 'cup_handle', 'diamond', 'rounding', 'island', 'bump_run', 'measured_move', 'parabolic', 'wyckoff', 'wyckoff_re', 'adam_eve', 'hs_complex'].includes(p.kind)) {
    // written for the bullish side on G; the bearish side runs on upside-down bars. Real price = sg × G price.
    const sg = long ? 1 : -1;
    const G = long ? B : B.map((b) => ({ ...b, o: -b.o, h: -b.l, l: -b.h, c: -b.c }));
    const R = (x: number) => sg * x;
    const T = (i: number) => B[Math.max(0, Math.min(B.length - 1, i))].t;
    const n = Number(P.strength) || 3;
    const H: { i: number; p: number }[] = [], L: { i: number; p: number }[] = [];
    const used = new Set<string>();
    let cooldown = -1;
    const lowMin = (a: number, b: number) => { let m = Infinity, mi = a; for (let k = a; k <= b; k++) if (G[k].l < m) { m = G[k].l; mi = k; } return { p: m, i: mi }; };
    const highMax = (a: number, b: number) => { let m = -Infinity, mi = a; for (let k = a; k <= b; k++) if (G[k].h > m) { m = G[k].h; mi = k; } return { p: m, i: mi }; };
    const firstUp = (j: number, lvl: (k: number) => number, from: number) => { for (let k = from; k < j; k++) if (G[k].c > lvl(k)) return false; return G[j].c > lvl(j); };
    for (let j = 2; j < B.length; j++) {
      const s0 = j - n;
      if (s0 >= 0 && isSwing(G, s0, n, 'high')) H.push({ i: s0, p: G[s0].h });
      if (s0 >= 0 && isSwing(G, s0, n, 'low')) L.push({ i: s0, p: G[s0].l });
      if (j <= cooldown) continue;
      const k = p.kind;
      if (k === 'broadening' || k === 'broadening_wedge') {
        if (H.length < 2 || L.length < 2) continue;
        const [hA, hB] = H.slice(-2), [lA, lB] = L.slice(-2);
        const start = Math.min(hA.i, lA.i), end = Math.max(hB.i, lB.i), key = `${hB.i}:${lB.i}`;
        if (used.has(key) || j - start > P.max_bars || j <= end || j - end > P.break_within) continue;
        const su = (hB.p - hA.p) / (hB.i - hA.i), sl = (lB.p - lA.p) / (lB.i - lA.i);
        const up = (q: number) => hA.p + su * (q - hA.i), lo = (q: number) => lA.p + sl * (q - lA.i);
        const w0 = up(start) - lo(start), w1 = up(end) - lo(end);
        if (w1 < P.min_height_points - 1e-9 || w0 <= 0 || w1 < w0 * (1 + P.diverge_pct / 100)) continue;
        if (k === 'broadening' ? !(su > 0 && sl < 0) : !(su < 0 && sl < 0)) continue;
        if (!firstUp(j, up, end + 1)) continue;
        used.add(key);
        const wj = up(j) - lo(j);
        out[j] = { line: R(up(j)), opposite: R(lo(j)), height: wj, target: R(up(j) + wj), breakout: B[j].c, time: B[j].t, path: [],
          lines: [[T(hA.i), R(hA.p), T(j), R(up(j))], [T(lA.i), R(lA.p), T(j), R(lo(j))]] };
      } else if (k === 'cup_handle') {
        const Rr = H[H.length - 1];
        if (!Rr || j - Rr.i < 2 || j - Rr.i > P.handle_bars || used.has(String(Rr.i))) continue;
        const hl = lowMin(Rr.i + 1, j - 1);
        for (let q = H.length - 2; q >= 0; q--) {
          const Lr = H[q], w = Rr.i - Lr.i;
          if (w < P.min_bars) continue;
          if (w > P.max_bars) break;
          const bot = lowMin(Lr.i, Rr.i), depth = Math.min(Lr.p, Rr.p) - bot.p, rim = Math.max(Lr.p, Rr.p);
          if (depth < P.min_depth_points - 1e-9 || Math.abs(Lr.p - Rr.p) > (P.rim_tolerance_pct / 100) * depth + 1e-9) continue;
          const pos = (bot.i - Lr.i) / w;
          if (pos < 0.25 || pos > 0.75) continue;
          if (Rr.p - hl.p <= 0 || Rr.p - hl.p > (P.handle_max_pct / 100) * depth + 1e-9 || hl.p < bot.p + depth / 2) continue;
          if (!(G[j].c > rim && G[j - 1].c <= rim)) continue;
          used.add(String(Rr.i));
          out[j] = { rim: R(rim), extreme: R(bot.p), depth, handle: R(hl.p), line: R(rim), target: R(rim + depth), breakout: B[j].c, time: B[j].t,
            path: [[T(Lr.i), R(Lr.p)], [T(bot.i), R(bot.p)], [T(Rr.i), R(Rr.p)], [T(hl.i), R(hl.p)], [T(j), B[j].c]], lines: [[T(Lr.i), R(rim), T(j), R(rim)]] };
          break;
        }
      } else if (k === 'diamond') {
        if (H.length < 3 || L.length < 3) continue;
        const h = H.slice(-3), l = L.slice(-3);
        const start = Math.min(h[0].i, l[0].i), end = Math.max(h[2].i, l[2].i), key = `${h[2].i}:${l[2].i}`;
        if (used.has(key) || j - start > P.max_bars || j <= end || j - end > P.break_within) continue;
        if (!(h[1].p > h[0].p && l[1].p < l[0].p && h[2].p < h[1].p && l[2].p > l[1].p)) continue;
        const height = h[1].p - l[1].p;
        if (height < P.min_height_points - 1e-9) continue;
        const up = (q: number) => h[1].p + ((h[2].p - h[1].p) * (q - h[1].i)) / Math.max(1, h[2].i - h[1].i);
        if (!firstUp(j, up, end + 1)) continue;
        used.add(key);
        out[j] = { line: R(up(j)), height, target: R(up(j) + height), breakout: B[j].c, time: B[j].t, path: [],
          lines: [[T(h[0].i), R(h[0].p), T(h[1].i), R(h[1].p)], [T(h[1].i), R(h[1].p), T(j), R(up(j))], [T(l[0].i), R(l[0].p), T(l[1].i), R(l[1].p)], [T(l[1].i), R(l[1].p), T(l[2].i), R(l[2].p)]] };
      } else if (k === 'rounding') {
        const W = Math.max(10, Number(P.bars) || 40), a0 = j - W;
        if (a0 < 1) continue;
        // least squares y = a x² + b x + c over the window's closes, x in [0, 1]
        let S0 = 0, S1 = 0, S2 = 0, S3 = 0, S4 = 0, Y0 = 0, Y1 = 0, Y2 = 0;
        for (let q = a0; q < j; q++) { const x = (q - a0) / (W - 1), y = G[q].c; S0++; S1 += x; S2 += x * x; S3 += x ** 3; S4 += x ** 4; Y0 += y; Y1 += x * y; Y2 += x * x * y; }
        const det = (m: number[][]) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
        const M = [[S4, S3, S2], [S3, S2, S1], [S2, S1, S0]], D = det(M);
        if (!D) continue;
        const a = det([[Y2, S3, S2], [Y1, S2, S1], [Y0, S1, S0]]) / D, b = det([[S4, Y2, S2], [S3, Y1, S1], [S2, Y0, S0]]) / D, c = det([[S4, S3, Y2], [S3, S2, Y1], [S2, S1, Y0]]) / D;
        if (a <= 0) continue;
        const xv = -b / (2 * a);
        if (xv < 0.3 || xv > 0.7) continue;
        const f = (x: number) => a * x * x + b * x + c, mean = Y0 / S0;
        let ssr = 0, sst = 0; for (let q = a0; q < j; q++) { const x = (q - a0) / (W - 1); ssr += (G[q].c - f(x)) ** 2; sst += (G[q].c - mean) ** 2; }
        if (!sst || 1 - ssr / sst < P.min_fit_pct / 100) continue;
        const rim = Math.max(f(0), G[a0].c), depth = rim - f(xv);
        if (depth < P.min_depth_points - 1e-9 || !(G[j].c > rim && G[j - 1].c <= rim)) continue;
        cooldown = j + W;
        const pts: [number, number][] = []; for (let t = 0; t <= 8; t++) pts.push([T(a0 + Math.round((t / 8) * (W - 1))), R(f(t / 8))]);
        pts.push([T(j), B[j].c]);
        out[j] = { rim: R(rim), extreme: R(f(xv)), depth, line: R(rim), target: R(rim + depth), breakout: B[j].c, time: B[j].t, path: pts, lines: [[T(a0), R(rim), T(j), R(rim)]] };
      } else if (k === 'island') {
        const gap = P.gap_ticks * TICK;
        for (let st = j - 1; st >= Math.max(1, j - P.max_bars); st--) {
          const top = highMax(st, j - 1);
          if (G[j].l - top.p >= gap - 1e-9 && G[st - 1].l - top.p >= gap - 1e-9) {
            const bot = lowMin(st, j - 1);
            out[j] = { line: R(top.p), extreme: R(bot.p), breakout: B[j].c, time: B[j].t, path: [],
              lines: [[T(st - 1), R(G[st - 1].l), T(st), R(G[st - 1].l)], [T(j - 1), R(G[j].l), T(j), R(G[j].l)], [T(st), R(top.p), T(j - 1), R(top.p)]] };
            break;
          }
        }
      } else if (k === 'bump_run') {
        const LB = Number(P.lead_bars) || 30, BB = Number(P.bump_bars) || 15, a0 = j - LB - BB;
        if (a0 < 0) continue;
        let mx = 0, my = 0; for (let q = a0; q < a0 + LB; q++) { mx += q; my += G[q].c; } mx /= LB; my /= LB;
        let num = 0, den = 0; for (let q = a0; q < a0 + LB; q++) { num += (q - mx) * (G[q].c - my); den += (q - mx) ** 2; }
        const sl = den ? num / den : 0, line = (q: number) => my + sl * (q - mx);
        if (sl >= 0) continue; // a falling lead-in for the bullish side
        let dev = 0; for (let q = a0; q < a0 + LB; q++) dev += Math.abs(G[q].c - line(q)); dev /= LB;
        const bump = lowMin(a0 + LB, j - 1), dist = line(bump.i) - bump.p;
        if (dist < Math.max(P.min_bump_points, P.bump_mult * dev) - 1e-9) continue;
        if (!(G[j].c > line(j) && G[j - 1].c <= line(j - 1))) continue;
        cooldown = j + BB;
        out[j] = { line: R(line(j)), extreme: R(bump.p), breakout: B[j].c, time: B[j].t, path: [], lines: [[T(a0), R(line(a0)), T(j), R(line(j))]] };
      } else if (k === 'measured_move') {
        const C = L[L.length - 1];
        if (!C || j - C.i > P.break_within || used.has(String(C.i))) continue;
        const Bq = [...H].reverse().find((h) => h.i < C.i);
        if (!Bq) continue;
        const A = [...L].reverse().find((l) => l.i < Bq.i);
        if (!A) continue;
        const leg = Bq.p - A.p, r = leg > 0 ? (Bq.p - C.p) / leg : 0;
        if (leg < P.min_leg_points - 1e-9 || r < P.min_retrace_pct / 100 - 1e-9 || r > P.max_retrace_pct / 100 + 1e-9) continue;
        if (!(G[j].c > Bq.p && G[j - 1].c <= Bq.p)) continue;
        used.add(String(C.i));
        out[j] = { line: R(Bq.p), swing: leg, a: R(A.p), b: R(Bq.p), c: R(C.p), target: R(C.p + leg), breakout: B[j].c, time: B[j].t,
          path: [[T(A.i), R(A.p)], [T(Bq.i), R(Bq.p)], [T(C.i), R(C.p)], [T(j), B[j].c]], lines: [[T(Bq.i), R(Bq.p), T(j), R(Bq.p)]] };
      } else if (k === 'parabolic') {
        const N = Math.max(6, Number(P.run_bars) || 15), st = j - 1 - N, av = avg[j - 1];
        if (st < 0 || av == null) continue;
        const ext = lowMin(st, j - 1), move = G[st].c - ext.p;
        if (move < P.move_mult * av - 1e-9) continue;
        const third = Math.floor(N / 3), d1 = G[st].c - G[st + third].c, d3 = G[j - 1 - third].c - G[j - 1].c;
        if (d1 <= 0 || d3 < P.accel * d1 - 1e-9) continue;
        if (!(G[j].c > G[j - 1].h)) continue;
        cooldown = j + N;
        out[j] = { line: R(G[j - 1].h), extreme: R(ext.p), move, target: R(ext.p + move / 2), breakout: B[j].c, time: B[j].t,
          path: [[T(st), R(G[st].c)], [T(st + third), R(G[st + third].c)], [T(ext.i), R(ext.p)], [T(j), B[j].c]], lines: [] };
      } else if (k === 'adam_eve') {
        // on G, the bottom version: Adam (sharp) then Eve (rounded); the top version runs upside down
        if (L.length < 2) continue;
        const [A, E] = L.slice(-2), key = `${A.i}:${E.i}`;
        if (used.has(key) || E.i - A.i < P.min_sep || j - A.i > P.max_bars || j <= E.i || j - E.i > P.break_within) continue;
        const nk = highMax(A.i, E.i), height = nk.p - Math.min(A.p, E.p);
        if (height < P.min_height_points - 1e-9 || Math.abs(A.p - E.p) > (P.tolerance_pct / 100) * height + 1e-9) continue;
        const width = (lw: { i: number; p: number }) => {
          const lim = lw.p + (P.width_pct / 100) * height;
          let a = lw.i, b = lw.i;
          while (a - 1 >= 0 && G[a - 1].l <= lim) a--;
          while (b + 1 < j && G[b + 1].l <= lim) b++;
          return b - a + 1;
        };
        if (width(A) > P.adam_max_bars || width(E) < P.eve_min_bars) continue;
        if (!firstUp(j, () => nk.p, E.i + 1)) continue;
        used.add(key);
        out[j] = { neckline: R(nk.p), height, target: R(nk.p + height), adam: R(A.p), eve: R(E.p), extreme: R(Math.min(A.p, E.p)), breakout: B[j].c, time: B[j].t,
          path: [[T(A.i), R(A.p)], [T(nk.i), R(nk.p)], [T(E.i), R(E.p)], [T(j), B[j].c]], neck_t0: T(A.i), neck_p0: R(nk.p), neckline_at: R(nk.p) };
      } else if (k === 'hs_complex') {
        // on G, the inverse version: five swing lows, the middle one the head
        if (L.length < 5) continue;
        const lw = L.slice(-5), head = lw[2], sh = [lw[0], lw[1], lw[3], lw[4]], key = String(lw[4].i);
        if (used.has(key) || j - lw[0].i > P.max_bars || j <= lw[4].i || j - lw[4].i > P.break_within) continue;
        const p1 = highMax(lw[1].i, head.i), p2 = highMax(head.i, lw[3].i);
        const neck = (q: number) => p1.p + ((p2.p - p1.p) * (q - p1.i)) / Math.max(1, p2.i - p1.i);
        const height = neck(head.i) - head.p;
        if (height < P.min_height_points - 1e-9) continue;
        const shP = sh.map((x) => x.p);
        if (Math.min(...shP) - head.p < (P.head_margin_pct / 100) * height - 1e-9) continue;
        if (Math.max(...shP) - Math.min(...shP) > (P.tolerance_pct / 100) * height + 1e-9) continue;
        if (Math.max(...shP) >= Math.min(p1.p, p2.p)) continue; // shoulders stay below the neckline
        if (!firstUp(j, neck, lw[4].i + 1)) continue;
        used.add(key);
        out[j] = { neckline: R(neck(j)), height, target: R(neck(j) + height), head: R(head.p), extreme: R(head.p), breakout: B[j].c, time: B[j].t,
          path: [...lw.map((x) => [T(x.i), R(x.p)] as [number, number]), [T(j), B[j].c]].sort((x, y) => x[0] - y[0]), neck_t0: T(p1.i), neck_p0: R(p1.p) };
      } else if (k === 'wyckoff' || k === 'wyckoff_re') {
        const W = Math.max(15, Number(P.range_bars) || 60), r0 = j - W, tb = Number(P.trend_bars) || 40;
        if (r0 - tb < 0) continue;
        const top = highMax(r0, j - 1), sup = lowMin(r0, r0 + Math.floor((2 * W) / 3)), height = top.p - sup.p;
        if (height < P.min_height_points - 1e-9 || !(G[j].c > top.p && G[j - 1].c <= top.p)) continue;
        let spring = -1; for (let q = r0 + Math.floor((2 * W) / 3); q < j; q++) if (G[q].l < sup.p - P.spring_ticks * TICK && G[q].c > sup.p) { spring = q; break; }
        if (spring < 0) continue;
        const into = G[r0].c - G[r0 - tb].c; // rose into the range (> 0) or fell into it (< 0)
        if (k === 'wyckoff' ? into > -height : into < height) continue;
        cooldown = j + W;
        out[j] = { line: R(top.p), opposite: R(sup.p), spring: R(G[spring].l), height, target: R(top.p + height), breakout: B[j].c, time: B[j].t,
          path: [[T(r0 - tb), R(G[r0 - tb].c)], [T(r0), R(G[r0].c)], [T(spring), R(G[spring].l)], [T(j), B[j].c]], lines: [[T(r0), R(top.p), T(j), R(top.p)], [T(r0), R(sup.p), T(j), R(sup.p)]] };
      }
    }
  } else if (PATTERN_KINDS[p.kind]?.group === 'candle') {
    // written for the bullish version; the bearish one runs it on upside-down bars. Captured prices come from the real bars.
    const F = long ? B : B.map((b) => ({ ...b, o: -b.o, h: -b.l, l: -b.h, c: -b.c }));
    const body = (b: Bar) => Math.abs(b.c - b.o), isUp = (b: Bar) => b.c > b.o, isDn = (b: Bar) => b.c < b.o, rng = (b: Bar) => b.h - b.l;
    const tb = Number(P.trend_bars) || 0;
    const trendOk = (i0: number) => !tb || (i0 - 1 - tb >= 0 && F[i0 - 1].c < F[i0 - 1 - tb].c);
    for (let j = 3; j < B.length; j++) {
      let i0 = -1, extra: Record<string, number> = {};
      const a = F[j - 1], b = F[j];
      switch (p.kind) {
        case 'engulfing':
          if (isDn(a) && isUp(b) && b.o <= a.c && b.c >= a.o && body(b) >= P.min_ratio * body(a) - 1e-9 && (!P.include_wicks || (b.h >= a.h && b.l <= a.l)) && trendOk(j - 1)) i0 = j - 1;
          break;
        case 'hammer': {
          const lower = Math.min(b.o, b.c) - b.l, upper = b.h - Math.max(b.o, b.c);
          if (rng(b) > 0 && lower >= P.wick_mult * Math.max(body(b), TICK) - 1e-9 && upper <= (P.other_wick_pct / 100) * rng(b) + 1e-9 && trendOk(j)) { i0 = j; extra = { wick: lower }; }
          break;
        }
        case 'star': {
          const c1 = F[j - 2], m = F[j - 1];
          if (isDn(c1) && body(c1) >= 0.5 * rng(c1) && body(m) <= (P.small_body_pct / 100) * body(c1) + 1e-9 && isUp(b) && b.c >= c1.c + (c1.o - c1.c) * (P.close_into_pct / 100) - 1e-9 && trendOk(j - 2)) i0 = j - 2;
          break;
        }
        case 'harami':
          if (isDn(a) && isUp(b) && b.o >= a.c && b.c <= a.o && body(b) <= (P.max_body_pct / 100) * body(a) + 1e-9 && trendOk(j - 1)) i0 = j - 1;
          break;
        case 'piercing':
          if (isDn(a) && isUp(b) && b.o < a.c && b.c >= a.c + (a.o - a.c) * (P.close_into_pct / 100) - 1e-9 && b.c < a.o && trendOk(j - 1)) i0 = j - 1;
          break;
        case 'soldiers': {
          const t = [F[j - 2], F[j - 1], F[j]];
          if (t.every((x) => isUp(x) && rng(x) > 0 && body(x) >= (P.min_body_pct / 100) * rng(x) - 1e-9) && t[1].c > t[0].c && t[2].c > t[1].c && trendOk(j - 2)) i0 = j - 2;
          break;
        }
        case 'tweezer':
          if (isDn(a) && isUp(b) && Math.abs(a.l - b.l) <= P.tolerance_ticks * TICK + 1e-9 && trendOk(j - 1)) i0 = j - 1;
          break;
        case 'doji': {
          const r = rng(b), upper = b.h - Math.max(b.o, b.c);
          if (r > 0 && body(b) <= (P.max_body_pct / 100) * r + 1e-9 && (!P.dragonfly || upper <= (P.other_wick_pct / 100) * r + 1e-9) && trendOk(j)) i0 = j;
          break;
        }
        case 'marubozu': {
          const r = rng(b), av = avg[j - 1];
          if (isUp(b) && r > 0 && body(b) >= (P.min_body_pct / 100) * r - 1e-9 && (!P.range_mult || (av != null && r >= P.range_mult * av - 1e-9)) && trendOk(j)) i0 = j;
          break;
        }
        case 'inside_bar':
          for (let k = 1; k <= P.max_inside; k++) {
            const m = j - 1 - k;
            if (m < 0) break;
            let inside = true;
            for (let q = m + 1; q < j; q++) if (F[q].h > F[m].h || F[q].l < F[m].l) { inside = false; break; }
            if (!inside) break;
            if (F[j].c > F[m].h && F[j - 1].c <= F[m].h) { i0 = m; extra = { mother_high: B[m].h, mother_low: B[m].l }; break; }
          }
          break;
      }
      if (i0 < 0) continue;
      let hi = -Infinity, lo = Infinity;
      for (let k = i0; k <= j; k++) { hi = Math.max(hi, B[k].h); lo = Math.min(lo, B[k].l); }
      out[j] = { high: hi, low: lo, open: B[i0].o, close: B[j].c, mid: (hi + lo) / 2, ...extra, top: hi, bottom: lo, time: B[i0].t, end_time: B[j].t };
    }
  }
  patCache.set(key, out);
  return out;
}

function fvgAt(ctx: Ctx, c: Extract<Cond, { t: 'fvg' }>): Hit {
  const B = bars(ctx.data, c.tf), j = closedAt(ctx.data, c.tf)[ctx.i];
  if (j < 2) return { ok: false };
  const c1 = B[j - 2], c2 = B[j - 1], c3 = B[j];
  if (c3.t - c1.t !== 2 * tfMinutes(c.tf) * MIN) return { ok: false }; // contiguous on the minute grid
  const long = c.side === 'long';
  const bottom = long ? c1.h : c3.h, top = long ? c3.l : c1.l;
  if (top - bottom < c.min_gap_ticks * TICK - 1e-9) return { ok: false };
  if (c.middle_closes_gap_way && !(long ? c2.c > c2.o : c2.c < c2.o)) return { ok: false };
  const bar = (b: Bar) => ({ open: b.o, high: b.h, low: b.l, close: b.c, time: b.t });
  return { ok: true, caps: { [c.capture || 'fvg']: { top, bottom, mid: (top + bottom) / 2, size: top - bottom, bar1: bar(c1), bar2: bar(c2), bar3: bar(c3) } } };
}

function drawAt(ctx: Ctx, c: Extract<Cond, { t: 'draw' }>): Hit {
  const from = value(ctx, c.from);
  if (typeof from !== 'number') return { ok: false };
  const long = c.side === 'long';
  let best: { price: number; token: string } | null = null;
  for (const tok of c.levels) {
    const v = value(ctx, tok);
    if (typeof v !== 'number') continue;
    if (long ? v - from < c.min_framework_points - 1e-9 : from - v < c.min_framework_points - 1e-9) continue;
    if (!untaken(ctx.data, tok, v, ctx.i)) continue;
    if (!best || (long ? v < best.price : v > best.price)) best = { price: v, token: tok };
  }
  return best ? { ok: true, caps: { draw: best } } : { ok: false };
}

// ---------- the Sequence runner ----------
export interface StepHit { step: number; i: number }
export interface Signal { branch: number; side: 'long' | 'short'; i: number; caps: Record<string, any>; entry: number; stop: number; legs: { name: string; price: number; contracts: number }[]; refused?: string; trade?: TradeResult; stepBars: number[] }
export interface TradeResult { fillI?: number; exitI?: number; cancelI?: number; r?: number; outcome: string; exits: { i: number; price: number; why: string }[] }
export interface RunResult {
  base: Int32Array;
  stepHeld: number[][][]; // [branch][step] -> 1m indices where the step's condition held on its own
  stepDone: number[][][]; // [branch][step] -> 1m indices where a Candidate completed the step
  signals: Signal[];
  ms: number;
  errors: string[];
}

export function baseCloses(data: Data, tf: TF): Int32Array {
  const ca = closedAt(data, tf), out: number[] = [];
  for (let i = 0; i < data.m1.length; i++) if (ca[i] >= 0 && (i === 0 || ca[i] !== ca[i - 1])) out.push(i);
  return Int32Array.from(out);
}

function roundTick(x: number, dir: 'up' | 'down') { return dir === 'up' ? Math.ceil(x / TICK - 1e-9) * TICK : Math.floor(x / TICK + 1e-9) * TICK; }

export function run(data: Data, setup: Setup): RunResult {
  const t0 = performance.now();
  const errors: string[] = [];
  const base = baseCloses(data, setup.settings.base_bar);
  const res: RunResult = { base, stepHeld: [], stepDone: [], signals: [], ms: 0, errors };
  PATS = Object.fromEntries((setup.patterns || []).map((p) => [p.name, p]));
  const okT = (x: string) => /^\d{1,2}:\d{2}$/.test(x);
  SESS = Object.fromEntries(Object.entries({ ...Object.fromEntries(Object.entries(SESSION_DEFS).map(([n, [a, b]]) => [n, { start: a, end: b }])), ...(setup.settings.sessions || {}) })
    .map(([n, r]: [string, any]) => [n, (okT(r.start) && okT(r.end) ? [r.start, r.end] : SESSION_DEFS[n] || [r.start, r.end]) as [string, string]]));
  setup.branches.forEach((br, bi) => {
    res.stepHeld[bi] = br.steps.map(() => []);
    res.stepDone[bi] = br.steps.map(() => []);
    try { runBranch(data, setup, br, bi, base, res); } catch (e: any) { errors.push(`${br.side} branch: ${e.message}`); }
  });
  res.signals.sort((a, b) => a.i - b.i);
  applyLosingStreak(data, setup, res.signals);
  res.ms = performance.now() - t0;
  return res;
}

interface Cand { step: number; startP: number; lastP: number; caps: Record<string, any>; key?: string; stepBars: number[]; running?: { name: string; field: 'low' | 'high' } }

function runBranch(data: Data, setup: Setup, br: Branch, bi: number, base: Int32Array, res: RunResult) {
  let cands: Cand[] = [];
  let liveUntil = -1; // 1m index until which a Signal of this branch is live (one at a time)
  const S = setup.settings;
  for (let p = 0; p < base.length; p++) {
    const i = base[p], bar = data.m1[i];
    // Trading-day expiry
    cands = cands.filter((c) => data.m1[base[c.startP]].di === bar.di);
    // running captures move until the next step completes
    for (const c of cands) if (c.running) {
      const r = c.caps[c.running.name];
      if (r) { for (let k = base[c.lastP] + 1; k <= i; k++) r[c.running.field] = c.running.field === 'low' ? Math.min(r[c.running.field], data.m1[k].l) : Math.max(r[c.running.field], data.m1[k].h); }
    }
    // standalone "held" marks
    br.steps.forEach((st, si) => { if (evalCond({ data, i, caps: {} }, st.cond, base, p).ok) res.stepHeld[bi][si].push(i); });
    // advance existing Candidates (from the bar after their last step unless same-bar is allowed)
    const next: Cand[] = [];
    for (const c of cands) {
      const st = br.steps[c.step];
      if (!st) continue;
      // limits
      if (st.within_bars != null && p - c.lastP > st.within_bars) continue;
      if (st.until && bar.min >= hm(st.until) && data.m1[base[c.lastP]].min < hm(st.until)) continue;
      if (st.invalidate && evalCond({ data, i, caps: c.caps }, st.invalidate, base, p).ok) continue;
      if (st.hold && !evalCond({ data, i, caps: c.caps }, st.hold, base, p).ok) continue;
      if (p === c.lastP && !st.same_bar) { next.push(c); continue; }
      const h = evalCond({ data, i, caps: c.caps }, st.cond, base, p);
      if (h.ok) {
        const caps = { ...c.caps, ...h.caps };
        if (st.capture_running) caps[st.capture_running.name] = { low: bar.l, high: bar.h, ...(caps[st.capture_running.name] || {}) };
        res.stepDone[bi][c.step].push(i);
        next.push({ ...c, step: c.step + 1, lastP: p, caps, stepBars: [...c.stepBars, i], running: st.capture_running });
      } else next.push(c);
    }
    cands = next;
    // first step: start new Candidates
    const s0 = br.steps[0];
    if (s0) {
      const h = evalCond({ data, i, caps: {} }, s0.cond, base, p);
      const live = i <= liveUntil;
      if (h.ok && !(live && S.one_at_a_time === 'ignore_new_starts')) {
        const caps: any = { ...h.caps };
        if (s0.capture_running) {
          // a running capture on a "For at least N bars" step starts at the run's first bar
          const fn = (s0.cond as any).items?.find((x: Cond) => x.t === 'for_n');
          const from = fn && p - fn.n + 1 >= 0 ? base[p - fn.n + 1 - (setup.settings.base_bar === '1m' ? 0 : 0)] - (base[p] - base[Math.max(0, p - 1)]) + 1 : i;
          let lo = Infinity, hi = -Infinity;
          for (let k = Math.max(0, from); k <= i; k++) { lo = Math.min(lo, data.m1[k].l); hi = Math.max(hi, data.m1[k].h); }
          caps[s0.capture_running.name] = { low: lo, high: hi };
        }
        const c: Cand = { step: 1, startP: p, lastP: p, caps, stepBars: [i], running: s0.capture_running };
        res.stepDone[bi][0].push(i);
        if (br.on_new_start === 'replace') cands = cands.filter(() => false);
        if (br.on_new_start !== 'ignore' || cands.length === 0) cands.push(c);
        // a 1-step branch completes at once; later steps may complete on the same bar if allowed
        const st1 = br.steps[1];
        if (st1?.same_bar) {
          const h1 = evalCond({ data, i, caps: c.caps }, st1.cond, base, p);
          if (h1.ok) { c.caps = { ...c.caps, ...h1.caps }; c.step = 2; c.stepBars.push(i); res.stepDone[bi][1].push(i); }
        }
      }
    }
    // completed Candidates become Signals
    const done = cands.filter((c) => c.step >= br.steps.length);
    cands = cands.filter((c) => c.step < br.steps.length);
    for (const c of done) {
      if (!inTradingHours(setup, bar.min, bar.t)) continue;
      if (i <= liveUntil && S.one_at_a_time !== 'off') continue; // skipped: a Trade is already live
      const sig = makeSignal(data, setup, br, bi, i, p, base, c);
      if (!sig) continue;
      res.signals.push(sig);
      if (!sig.refused) liveUntil = sig.trade?.exitI ?? i;
    }
  }
}

export function inTradingHours(setup: Setup, min: number, t: number) {
  const wd = new Date(t + nyOffset(t)).getUTCDay();
  const okDay = setup.settings.trading_hours.weekdays.includes(wd) || setup.settings.trading_hours.weekdays.length === 0;
  const ranges = setup.settings.trading_hours.overrides?.[String(wd)] ?? setup.settings.trading_hours.ranges;
  return okDay && (ranges.length === 0 || ranges.some((r) => inRange(min, r.start, r.end)));
}

function makeSignal(data: Data, setup: Setup, br: Branch, bi: number, i: number, p: number, base: Int32Array, c: Cand): Signal | null {
  const ctx: Ctx = { data, i, caps: c.caps };
  const e = br.entry, long = br.side === 'long';
  const entry0 = e.order === 'market' ? data.m1[i + 1]?.o : (value(ctx, e.price || '') as number);
  const from = e.stop.from || 'level';
  if (typeof entry0 !== 'number' || (from === 'level' && !e.stop.token)) return null;
  const entry = e.order === 'market' ? entry0 : roundTick(entry0, long ? 'down' : 'up');
  const stopBase = from === 'level' ? value(ctx, e.stop.token) : entry;
  if (typeof stopBase !== 'number') return null;
  let off = e.stop.offset;
  if (from === 'usd') off = off / POINT_VALUE; // $ a contract → points
  else if (e.stop.unit === 'atr') { const a = value(ctx, e.stop.atr || ''); off = typeof a === 'number' ? off * a : 0; } else off = off * TICK;
  const stop = roundTick(long ? stopBase - off : stopBase + off, long ? 'down' : 'up');
  const risk = Math.abs(entry - stop);
  const caps = { ...c.caps, entry };
  const sig: Signal = { branch: bi, side: br.side, i, caps, entry, stop, legs: [], stepBars: c.stepBars };
  if (risk <= 0) { sig.refused = 'stop on the wrong side of the entry'; return sig; }
  const ts = setup.trade_settings;
  const stopGuard = ts.signal_guards.find((g) => g.kind === 'max_stop');
  if (stopGuard) {
    let lim = stopGuard.n * TICK;
    if (stopGuard.unit === 'atr') { const a = value(ctx, stopGuard.atr || ''); lim = typeof a === 'number' ? stopGuard.n * a : Infinity; }
    if (risk > lim + 1e-9) { sig.refused = `stop ${risk.toFixed(2)} pts wider than ${stopGuard.n} ${stopGuard.unit === 'atr' ? '× ATR' : 'ticks'}`; return sig; }
  }
  // contracts from Risk per Trade
  const contracts = Math.max(0, Math.min(ts.risk.max_contracts, Math.floor((ts.risk.capital * ts.risk.pct) / 100 / (risk * POINT_VALUE))));
  if (contracts < 1) { sig.refused = `stop too wide: 1 contract risks $${(risk * POINT_VALUE).toFixed(0)}, more than Risk per Trade`; return sig; }
  const shares = splitContracts(contracts, ts.legs, ts.leftover);
  sig.legs = ts.legs.map((L, k) => ({ name: L.name, price: legPrice(ctx, L, entry, stop, long), contracts: shares[k] })).filter((l) => l.contracts > 0 && isFinite(l.price));
  const rrGuard = ts.signal_guards.find((g) => g.kind === 'min_rr');
  if (rrGuard) {
    const tot = sig.legs.reduce((s, l) => s + l.contracts, 0);
    const rr = sig.legs.reduce((s, l) => s + (l.contracts * Math.abs(l.price - entry)) / risk, 0) / (tot || 1);
    if (rr < rrGuard.n - 1e-9) { sig.refused = `reward only ${rr.toFixed(2)} × the risk, under ${rrGuard.n}`; return sig; }
  }
  sig.trade = simulate(data, setup, br, sig, base, p);
  return sig;
}

function splitContracts(n: number, legs: Leg[], leftover: 'first' | 'last') {
  const out = legs.map((L) => Math.floor(n * L.share));
  let left = n - out.reduce((a, b) => a + b, 0);
  const order = legs.map((_, k) => k);
  if (leftover === 'last') order.reverse();
  for (let k = 0; left > 0; k = (k + 1) % legs.length, left--) out[order[k]]++;
  return out;
}

function legPrice(ctx: Ctx, L: Leg, entry: number, stop: number, long: boolean) {
  const risk = Math.abs(entry - stop), dir = long ? 1 : -1;
  let px = NaN;
  if (L.rule === 'r') px = entry + dir * L.r! * risk;
  else {
    const lv = value(ctx, L.level || '');
    if (typeof lv !== 'number') return NaN;
    if (L.rule === 'level') px = lv - dir * (L.offset_ticks || 0) * TICK;
    else px = entry + (lv - entry) * (L.fraction ?? 0.5);
  }
  return roundTick(px, long ? 'down' : 'up'); // targets rounded toward the entry
}

/** rough Trade simulation on 1m bars: stop first on a bar that touches both */
function simulate(data: Data, setup: Setup, br: Branch, sig: Signal, base: Int32Array, p0: number): TradeResult {
  const ts = setup.trade_settings, long = sig.side === 'long', M = data.m1;
  const day = M[sig.i].di;
  const flat = hm(ts.flatten_time);
  const deadline = (i: number) => {
    const d = ts.entry_deadline;
    if (d.kind === 'clock') return M[i].min >= hm(d.value) && M[sig.i].min < hm(d.value);
    if (d.kind === 'bars') return i - sig.i > Number(d.value) * tfMinutes(setup.settings.base_bar);
    if (d.kind === 'end_of_hours') return !inTradingHours(setup, M[i].min, M[i].t);
    return M[i].di !== day;
  };
  const res: TradeResult = { outcome: '', exits: [] };
  let i = sig.i + 1, fill = -1;
  const firstLeg = sig.legs[0]?.price;
  // the entry rests (limit) or fills at the next bar's open (market)
  if (br.entry.order === 'market') fill = i;
  else for (; i < M.length; i++) {
    if (deadline(i) || M[i].di !== day) { res.outcome = 'entry cancelled at the deadline'; res.cancelI = i; return res; }
    const b = M[i];
    if (long ? b.l <= sig.entry : b.h >= sig.entry) { fill = i; break; }
    for (const cx of ts.cancel_if) {
      const lv = cx === 'stop' ? sig.stop : cx === 'first_leg' ? firstLeg : cx === 'draw' ? sig.caps.draw?.price : undefined;
      if (lv != null && (long ? (cx === 'stop' ? b.l <= lv : b.h >= lv) : cx === 'stop' ? b.h >= lv : b.l <= lv)) { res.outcome = `entry cancelled: ${cx.replace('_', ' ')} reached first`; res.cancelI = i; return res; }
    }
  }
  if (fill < 0) { res.outcome = 'no fill'; return res; }
  res.fillI = fill;
  const entry = br.entry.order === 'market' ? M[fill].o : sig.entry;
  const risk = Math.abs(entry - sig.stop);
  let stop = sig.stop;
  const open = sig.legs.map((l) => ({ ...l, done: false }));
  const total = open.reduce((s, l) => s + l.contracts, 0);
  let r = 0, legsFilled = 0;
  const exitLeg = (l: any, price: number, k: number, why: string) => { l.done = true; r += ((long ? price - entry : entry - price) / risk) * (l.contracts / total); res.exits.push({ i: k, price, why }); };
  let pBase = p0;
  for (let k = fill; k < M.length; k++) {
    const b = M[k];
    if (b.di !== day || b.min >= flat && M[fill].min < flat) { open.filter((l) => !l.done).forEach((l) => exitLeg(l, b.o, k, 'Flat by time')); break; }
    if (long ? b.l <= stop : b.h >= stop) { open.filter((l) => !l.done).forEach((l) => exitLeg(l, stop, k, stop === sig.stop ? 'stop' : 'moved stop')); break; }
    open.forEach((l, li) => {
      if (!l.done && (long ? b.h >= l.price : b.l <= l.price)) {
        exitLeg(l, l.price, k, l.name); legsFilled++;
        const be = ts.break_even;
        if (be.trigger === 'after_leg' && legsFilled === be.k) { const ns = entry + (long ? 1 : -1) * be.offset_ticks * TICK; stop = long ? Math.max(stop, ns) : Math.min(stop, ns); }
        void li;
      }
    });
    if (ts.break_even.trigger === 'at_r' && (long ? b.h - entry : entry - b.l) >= (ts.break_even.r || 1) * risk) { const ns = entry + (long ? 1 : -1) * ts.break_even.offset_ticks * TICK; stop = long ? Math.max(stop, ns) : Math.min(stop, ns); }
    if (open.every((l) => l.done)) break;
    // In-position rules at Base-bar closes
    while (pBase + 1 < base.length && base[pBase + 1] <= k) pBase++;
    if (base[pBase] === k && k > fill) {
      const trade = { entry, stop, side: sig.side, legs_filled: legsFilled, bars_open: pBase - p0, open_r: (long ? b.c - entry : entry - b.c) / risk };
      for (const rule of setup.in_position_rules.filter((x) => x.branch === undefined || x.branch === sig.branch)) {
        const h = evalCond({ data, i: k, caps: sig.caps, trade }, rule.when, base, pBase);
        if (!h.ok) continue;
        const px = M[k + 1]?.o ?? b.c;
        if (rule.action === 'close_trade') { open.filter((l) => !l.done).forEach((l) => exitLeg(l, px, k + 1, 'While in a Trade: close the Trade')); break; }
        if (rule.action === 'close_leg') { const l = open[(rule.leg || 1) - 1]; if (l && !l.done) exitLeg(l, px, k + 1, `While in a Trade: close ${l.name}`); }
      }
      if (open.every((l) => l.done)) break;
    }
  }
  res.exitI = res.exits.length ? res.exits[res.exits.length - 1].i : undefined;
  res.r = r;
  res.outcome = res.exits.map((x) => x.why).filter((v, k, a) => a.indexOf(v) === k).join(', ') || 'open at end of data';
  return res;
}

export { mirrorFieldSide };

/** Losing streak (per Setup, across its branches): after N losing Trades in a row on one Trading day, later Signals that day are refused;
 *  the next Trading day starts at cut % of the contracts until a winning Trade. PROTOTYPE: applied after the fact, so a refused Signal
 *  does not free Trade overlap for a later one. */
function applyLosingStreak(data: Data, setup: Setup, sigs: Signal[]) {
  const ls = setup.trade_settings.losing_streak;
  if (!ls || !ls.n) return;
  let day = -1, streak = 0, stopped = false, reduced = false, stoppedDay = -1;
  for (const s of sigs) {
    if (s.refused) continue;
    const d = data.m1[s.i].di;
    if (d !== day) { if (stoppedDay === day && day >= 0) reduced = true; day = d; streak = 0; stopped = false; }
    if (stopped) { s.refused = `losing streak: ${ls.n} losing Trades in a row today, the Setup stopped for the day`; s.trade = undefined; continue; }
    if (reduced) {
      // cut the total, never below 1 contract, taken from the first Take profits
      const tot = s.legs.reduce((a, l) => a + l.contracts, 0);
      let left = Math.max(1, Math.floor((tot * ls.cut) / 100));
      s.legs = s.legs.map((l) => { const c = Math.min(l.contracts, left); left -= c; return { ...l, contracts: c }; }).filter((l) => l.contracts > 0);
    }
    const r = s.trade?.r;
    if (r == null) continue;
    if (r > 0) { streak = 0; reduced = false; } else if (r < 0) { streak++; if (streak >= ls.n) { stopped = true; stoppedDay = d; } }
  }
}

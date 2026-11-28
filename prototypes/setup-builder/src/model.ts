// PROTOTYPE, throwaway. The Setup file shape from "Setup file format, versions and the rule description" (#71),
// simplified to what the builder prototype needs.

export type TF = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d';
export const TFS: TF[] = ['1m', '3m', '5m', '15m', '30m', '1h', '4h', '1d'];
export const tfMinutes = (tf: TF) => ({ '1m': 1, '3m': 3, '5m': 5, '15m': 15, '30m': 30, '1h': 60, '4h': 240, '1d': 1440 })[tf];

export type Op = '>' | '>=' | '<' | '<=' | '=' | '!=' | 'crosses_above' | 'crosses_below' | 'within' | 'rising' | 'falling';
export const OPS: Op[] = ['>', '>=', '<', '<=', '=', '!=', 'crosses_above', 'crosses_below', 'within'];

export interface Origin { preset: string; preset_version: number; edited: boolean }
export type Cond =
  | { id: string; t: 'cmp'; a: string; op: Op; b: string; mult?: number; n?: number; origin?: Origin }
  | { id: string; t: 'all' | 'any'; items: Cond[]; origin?: Origin; label?: string }
  | { id: string; t: 'not'; item: Cond; origin?: Origin }
  | { id: string; t: 'for_n'; n: number; item: Cond; origin?: Origin }
  | { id: string; t: 'time'; start: string; end: string; tf?: TF; origin?: Origin }
  | { id: string; t: 'fvg'; side: 'long' | 'short'; tf: TF; min_gap_ticks: number; middle_closes_gap_way: boolean; capture: string; origin?: Origin }
  | { id: string; t: 'draw'; side: 'long' | 'short'; from: string; min_framework_points: number; levels: string[]; origin?: Origin }
  /** a reference to a Pattern declared up front in the Setup; the step only adds the side. Captured under the pattern's name. */
  | { id: string; t: 'pattern'; ref: string; side: 'long' | 'short'; origin?: Origin };

// ---------- Patterns: declared once per Setup (kind, timeframe, settings), then referenced by name in steps ----------
export type PatternKind = 'fvg' | 'displacement' | 'order_block' | 'leg' | 'mss' | 'double' | 'triple' | 'head_shoulders' | 'triangle' | 'wedge' | 'flag' | 'pennant' | 'rectangle' | 'channel'
  | 'engulfing' | 'hammer' | 'star' | 'harami' | 'piercing' | 'soldiers' | 'tweezer' | 'inside_bar' | 'doji' | 'marubozu'
  | 'broadening' | 'broadening_wedge' | 'cup_handle' | 'diamond' | 'rounding' | 'island' | 'bump_run' | 'measured_move' | 'parabolic' | 'wyckoff' | 'wyckoff_re' | 'adam_eve' | 'hs_complex';
export interface Pattern { name: string; kind: PatternKind; tf: TF; params: Record<string, number | boolean>; label?: string }
type PDef = { title: string; help: string; params: [key: string, label: string, def: number | boolean][]; fields: string[]; bull: string; bear: string; named?: boolean; group?: 'ict' | 'chart' | 'candle'; cat?: PatternCat };
/** chart-pattern categories (Type, Bias, Classical / Lesser-Known, Consolidation, Typically breaks);
 *  candlesticks use the usual reading. `bull` / `bear` give the bias of each side. */
export interface PatternCat { types: ('reversal' | 'continuation' | 'indeterminate')[]; bull: 'bullish' | 'neutral'; bear: 'bearish' | 'neutral'; classical: boolean; consolidation?: string; breaks?: string; source: 'chart' | 'usual'; note?: string }
const DISP: PDef['params'] = [['disp_mult', 'range at least × the average range', 1.5], ['disp_body_pct', 'body % at least', 60], ['avg_len', 'average range over bars', 20]];
const CHART_PARAMS: PDef['params'] = [['strength', 'swing: bars each side', 3], ['tolerance_pct', 'peaks equal within % of the height', 20], ['min_height_points', 'height ≥ points', 10], ['min_sep', 'peaks at least N bars apart', 5], ['max_bars', 'whole pattern within N bars', 80], ['break_within', 'neckline break within N bars of the last peak', 30]];
const LINE_PARAMS: PDef['params'] = [['strength', 'swing: bars each side', 3], ['min_height_points', 'opening height ≥ points', 10], ['max_bars', 'whole pattern within N bars', 80], ['break_within', 'breakout within N bars of the last swing', 20], ['converge_pct', 'narrows by ≥ % of its height', 30], ['flat_pct', 'a line counts as flat within % of the height', 15]];
const TREND: PDef['params'][number] = ['trend_bars', 'after a move against it over N bars (0 = any)', 3];
const CANDLE_FIELDS = ['high', 'low', 'open', 'close', 'mid'];
const BAR3 = ['bar1', 'bar2', 'bar3'].flatMap((b) => ['open', 'high', 'low', 'close'].map((f) => `${b}.${f}`));
export const PATTERN_KINDS: Record<PatternKind, PDef> = {
  fvg: { title: 'Fair value gap (FVG)', bull: 'bullish', bear: 'bearish', help: 'Three candles; candle 1 and candle 3 leave a gap. Forms when candle 3 closes.',
    params: [['min_gap_ticks', 'gap ≥ ticks', 4], ['middle_closes_gap_way', "middle candle closes the gap's way", true], ['displacement', 'middle candle is a Displacement', false], ...DISP],
    fields: ['top', 'bottom', 'mid', 'size', ...BAR3] },
  displacement: { title: 'Displacement', bull: 'bullish', bear: 'bearish', help: 'One large-bodied candle in the direction. Forms when it closes.',
    params: [['disp_mult', 'range at least × the average range', 1.5], ['disp_body_pct', 'body % at least', 60], ['avg_len', 'average range over bars', 20]],
    fields: ['open', 'high', 'low', 'close', 'range', 'mid'] },
  order_block: { title: 'Order block', bull: 'bullish', bear: 'bearish', help: 'The last opposite candle before a Displacement that closes beyond it. Forms when the Displacement closes.',
    params: [['lookback', 'opposite candle within N bars', 3], ['use_body', 'zone is the body (not the wicks)', false], ...DISP],
    fields: ['top', 'bottom', 'mid', 'size', 'open', 'close', 'time'] },
  leg: { title: 'Swing', bull: 'up', bear: 'down', help: 'The move from a confirmed Swing low to the next confirmed Swing high (an up swing), or the reverse (a down swing). Forms when its end swing point is confirmed. Fib tokens read it.',
    params: [['strength', 'swing: bars each side', 2], ['min_size_points', 'size ≥ points', 10]],
    fields: ['start', 'end', 'high', 'low', 'size', 'mid'] },
  mss: { title: 'Market structure shift (MSS)', bull: 'bullish', bear: 'bearish', help: 'A close beyond the last confirmed Swing high (bullish) or Swing low (bearish). Forms on the breaking candle.',
    params: [['strength', 'swing: bars each side', 2], ['displacement', 'breaking candle is a Displacement', true], ...DISP],
    fields: ['level', 'swing_low', 'swing_high', 'high', 'low', 'close'] },
  // classic chart patterns: the side picks which one (bullish = the bottom, bearish = the top); all form on the neckline break
  double: { title: 'Double top / bottom', bull: 'double bottom', bear: 'double top', named: true, group: 'chart', cat: { types: ['reversal'], bull: 'bullish', bear: 'bearish', classical: true, consolidation: 'Yes', breaks: 'Up (bottom) / Down (top)', source: 'chart', note: 'Double Bottom (W) and Double Top (M). For the sharp-then-rounded variant, configure Adam & Eve double top / bottom.' },
    help: 'Two swing highs at about the same price with a low between them (double top, bearish), or two swing lows with a high between them (double bottom, bullish). The neckline is the extreme between the two; the pattern forms on the first close through it. Target: the height measured from the neckline.',
    params: CHART_PARAMS, fields: ['neckline', 'height', 'target', 'first', 'second', 'extreme'] },
  triple: { title: 'Triple top / bottom', bull: 'triple bottom', bear: 'triple top', named: true, group: 'chart', cat: { types: ['reversal'], bull: 'bullish', bear: 'bearish', classical: true, consolidation: 'Yes', breaks: 'Up (bottom) / Down (top)', source: 'chart' },
    help: 'Three swing highs (triple top, bearish) or three swing lows (triple bottom, bullish) at about the same price. The neckline is the extreme between the first and the third; the pattern forms on the first close through it.',
    params: CHART_PARAMS, fields: ['neckline', 'height', 'target', 'first', 'second', 'third', 'extreme'] },
  head_shoulders: { title: 'Head and shoulders', bull: 'inverse head and shoulders', bear: 'head and shoulders', named: true, group: 'chart', cat: { types: ['reversal'], bull: 'bullish', bear: 'bearish', classical: true, consolidation: 'Yes', breaks: 'Up (inverse) / Down', source: 'chart', note: 'For two shoulders on each side, configure Complex head and shoulders.' },
    help: 'Three swing highs where the middle one (the head) is clearly higher than the two shoulders, which are at about the same price (bearish); the inverse, with lows, is bullish. The neckline joins the two lows between them and may slope; the pattern forms on the first close through it.',
    params: [...CHART_PARAMS, ['head_margin_pct', 'head beyond the shoulders by ≥ % of the height', 15]], fields: ['neckline', 'height', 'target', 'left_shoulder', 'head', 'right_shoulder'] },
  triangle: { title: 'Triangle', bull: 'triangle breaking up', bear: 'triangle breaking down', named: true, group: 'chart', cat: { types: ['continuation', 'indeterminate'], bull: 'bullish', bear: 'bearish', classical: true, consolidation: 'Yes', breaks: 'Ascending up, descending down, symmetrical either way', source: 'chart', note: 'Ascending: Bullish Continuation. Descending: Bearish Continuation. Symmetrical (equilibrium): Neutral, Indeterminate.' },
    help: 'Price narrows between two lines through the recent swing highs and swing lows. Ascending: flat top, rising bottom. Descending: falling top, flat bottom. Symmetrical: falling top, rising bottom. The pattern forms on the first close through the line in the side\'s direction (above the top line for bullish, below the bottom line for bearish). Target: the triangle\'s opening height from the breakout.',
    params: [...LINE_PARAMS, ['allow_ascending', 'ascending', true], ['allow_descending', 'descending', true], ['allow_symmetrical', 'symmetrical', true]],
    fields: ['line', 'opposite', 'height', 'target', 'breakout'] },
  wedge: { title: 'Wedge', bull: 'falling wedge', bear: 'rising wedge', named: true, group: 'chart', cat: { types: ['reversal', 'continuation'], bull: 'bullish', bear: 'bearish', classical: true, consolidation: 'Yes', breaks: 'Falling wedge up, rising wedge down', source: 'chart', note: 'A Reversal after a trend the other way (falling wedge after a downtrend), a Continuation inside one (falling wedge in an uptrend).' },
    help: 'Both lines slope the same way and converge. A falling wedge (both down) is bullish and forms on the first close above its top line; a rising wedge (both up) is bearish and forms on the first close below its bottom line. Target: the wedge\'s opening height from the breakout.',
    params: LINE_PARAMS, fields: ['line', 'opposite', 'height', 'target', 'breakout'] },
  flag: { title: 'Flag', bull: 'bull flag', bear: 'bear flag', named: true, group: 'chart', cat: { types: ['continuation'], bull: 'bullish', bear: 'bearish', classical: true, consolidation: 'Yes', breaks: 'With the pole', source: 'chart' },
    help: 'A strong move (the pole) followed by a short, shallow pause that drifts against it or sideways (the flag). Bull flag: pole up, forms on the first close above the flag\'s top line; bear flag: the mirror. Target: the pole\'s length projected from the breakout.',
    params: [['pole_points', 'pole ≥ points', 30], ['pole_bars', 'pole within N bars', 10], ['flag_min', 'flag at least N bars', 3], ['flag_max', 'flag at most N bars', 20], ['max_retrace_pct', 'flag gives back ≤ % of the pole', 50]],
    fields: ['line', 'pole', 'pole_start', 'pole_end', 'target', 'breakout'] },
  pennant: { title: 'Pennant', bull: 'bull pennant', bear: 'bear pennant', named: true, group: 'chart', cat: { types: ['continuation'], bull: 'bullish', bear: 'bearish', classical: true, consolidation: 'Yes', breaks: 'With the pole', source: 'chart' },
    help: 'Like a flag, but the pause after the pole narrows into a small symmetrical triangle (highs falling, lows rising). Bull pennant: pole up, forms on the first close above its top line; bear pennant: the mirror. Target: the pole\'s length projected from the breakout.',
    params: [['pole_points', 'pole ≥ points', 30], ['pole_bars', 'pole within N bars', 10], ['flag_min', 'pennant at least N bars', 4], ['flag_max', 'pennant at most N bars', 20], ['max_retrace_pct', 'pennant gives back ≤ % of the pole', 50], ['converge_pct', 'narrows by ≥ % of its height', 30]],
    fields: ['line', 'pole', 'pole_start', 'pole_end', 'target', 'breakout'] },
  rectangle: { title: 'Rectangle', bull: 'rectangle breaking up', bear: 'rectangle breaking down', named: true, group: 'chart', cat: { types: ['indeterminate'], bull: 'neutral', bear: 'neutral', classical: true, consolidation: 'Yes', breaks: 'Up or down', source: 'chart', note: 'Rectangle / Trading Range.' },
    help: 'Price moves sideways between a flat top (the last two swing highs at about the same price) and a flat bottom (the last two swing lows). The pattern forms on the first close outside it in the side\'s direction. Target: the rectangle\'s height from the breakout.',
    params: [['strength', 'swing: bars each side', 3], ['min_height_points', 'height ≥ points', 10], ['max_bars', 'whole pattern within N bars', 80], ['break_within', 'breakout within N bars of the last swing', 20], ['flat_pct', 'a line counts as flat within % of the height', 15]],
    fields: ['line', 'opposite', 'height', 'target', 'breakout'] },
  channel: { title: 'Channel', bull: 'channel breaking up', bear: 'channel breaking down', named: true, group: 'chart', cat: { types: ['continuation'], bull: 'bullish', bear: 'bearish', classical: true, consolidation: 'No', breaks: 'Up or down', source: 'chart', note: 'Ascending channel: Bullish Continuation. Descending channel: Bearish Continuation.' },
    help: 'Price moves between two parallel sloping lines, through the last two swing highs and the last two swing lows. The pattern forms on the first close outside it in the side\'s direction: above the top line for bullish, below the bottom line for bearish (with the trend or against it, depending on which way the channel slopes). Target: the channel\'s height from the breakout.',
    params: [['strength', 'swing: bars each side', 3], ['min_height_points', 'height ≥ points', 10], ['max_bars', 'whole pattern within N bars', 80], ['break_within', 'breakout within N bars of the last swing', 20], ['flat_pct', 'lines count as parallel within % of the height', 15], ['allow_rising', 'rising', true], ['allow_falling', 'falling', true]],
    fields: ['line', 'opposite', 'height', 'target', 'breakout'] },
  // candlestick patterns: the side picks the bullish or the bearish one; they form on the close of their last candle
  engulfing: { title: 'Engulfing', bull: 'bullish engulfing', bear: 'bearish engulfing', named: true, group: 'candle', cat: { types: ['reversal'], bull: 'bullish', bear: 'bearish', classical: true, source: 'usual' },
    help: 'Two candles: a down candle, then an up candle whose body covers the whole body of the first (bullish); the mirror is bearish. Forms on the close of the second candle.',
    params: [['min_ratio', 'second body ≥ × the first body', 1], ['include_wicks', 'must also cover the first candle\'s wicks', false], TREND], fields: CANDLE_FIELDS },
  hammer: { title: 'Hammer / shooting star', bull: 'hammer', bear: 'shooting star', named: true, group: 'candle', cat: { types: ['reversal'], bull: 'bullish', bear: 'bearish', classical: true, source: 'usual' },
    help: 'One candle with a long wick on one side and a small body at the other end. Hammer (bullish): long lower wick, body near the high. Shooting star (bearish): long upper wick, body near the low. Forms on its close.',
    params: [['wick_mult', 'long wick ≥ × the body', 2], ['other_wick_pct', 'other wick ≤ % of the range', 25], TREND], fields: [...CANDLE_FIELDS, 'wick'] },
  star: { title: 'Morning / evening star', bull: 'morning star', bear: 'evening star', named: true, group: 'candle', cat: { types: ['reversal'], bull: 'bullish', bear: 'bearish', classical: true, source: 'usual' },
    help: 'Three candles: a large down candle, a small-bodied candle, then a large up candle that closes well into the first one\'s body (morning star, bullish); the mirror is the evening star. Forms on the close of the third candle.',
    params: [['small_body_pct', 'middle body ≤ % of the first body', 30], ['close_into_pct', 'third closes ≥ % into the first body', 50], TREND], fields: CANDLE_FIELDS },
  harami: { title: 'Harami', bull: 'bullish harami', bear: 'bearish harami', named: true, group: 'candle', cat: { types: ['reversal'], bull: 'bullish', bear: 'bearish', classical: true, source: 'usual' },
    help: 'Two candles: a large down candle, then a small up candle whose body sits inside the first body (bullish); the mirror is bearish. Forms on the close of the second candle.',
    params: [['max_body_pct', 'second body ≤ % of the first body', 60], TREND], fields: CANDLE_FIELDS },
  piercing: { title: 'Piercing line / dark cloud cover', bull: 'piercing line', bear: 'dark cloud cover', named: true, group: 'candle', cat: { types: ['reversal'], bull: 'bullish', bear: 'bearish', classical: true, source: 'usual' },
    help: 'Two candles: a down candle, then an up candle that opens below its close and closes past the middle of its body, but not above its open (piercing line, bullish); the mirror is dark cloud cover. Forms on the close of the second candle.',
    params: [['close_into_pct', 'second closes ≥ % into the first body', 50], TREND], fields: CANDLE_FIELDS },
  soldiers: { title: 'Three soldiers / three crows', bull: 'three white soldiers', bear: 'three black crows', named: true, group: 'candle', cat: { types: ['reversal'], bull: 'bullish', bear: 'bearish', classical: true, source: 'usual' },
    help: 'Three up candles in a row, each closing higher than the one before, with solid bodies (three white soldiers, bullish); the mirror is three black crows. Forms on the close of the third candle.',
    params: [['min_body_pct', 'each body ≥ % of its range', 50], TREND], fields: CANDLE_FIELDS },
  tweezer: { title: 'Tweezer bottom / top', bull: 'tweezer bottom', bear: 'tweezer top', named: true, group: 'candle', cat: { types: ['reversal'], bull: 'bullish', bear: 'bearish', classical: false, source: 'usual' },
    help: 'Two candles with lows at about the same price, the first down and the second up (tweezer bottom, bullish); the mirror, with highs, is the tweezer top. Forms on the close of the second candle.',
    params: [['tolerance_ticks', 'lows equal within N ticks', 2], TREND], fields: CANDLE_FIELDS },
  inside_bar: { title: 'Inside bar breakout', bull: 'inside bar breaking up', bear: 'inside bar breaking down', named: true, group: 'candle', cat: { types: ['indeterminate'], bull: 'bullish', bear: 'bearish', classical: false, breaks: 'Up or down', source: 'usual' },
    help: 'A candle (the mother bar) followed by one or more candles entirely inside its range, then a close beyond its high (bullish) or its low (bearish). Forms on the breaking close.',
    params: [['max_inside', 'up to N inside candles', 3]], fields: [...CANDLE_FIELDS, 'mother_high', 'mother_low'] },
  doji: { title: 'Doji', bull: 'doji after a drop', bear: 'doji after a rise', named: true, group: 'candle', cat: { types: ['indeterminate'], bull: 'neutral', bear: 'neutral', classical: true, source: 'usual' },
    help: 'A candle that opens and closes at about the same price: a body that is a small part of its range, showing indecision. On its own it has no direction, so the side means where it appears: after a move down (bullish) or after a move up (bearish). Tick "dragonfly / gravestone only" to require the long wick on the side of the move: a dragonfly (long lower wick) after a drop, a gravestone (long upper wick) after a rise. Forms on its close.',
    params: [['max_body_pct', 'body ≤ % of the range', 10], ['dragonfly', 'dragonfly / gravestone only', false], ['other_wick_pct', 'short wick ≤ % of the range (dragonfly / gravestone)', 15], ['trend_bars', 'after a move over N bars (0 = any)', 3]], fields: CANDLE_FIELDS },
  marubozu: { title: 'Marubozu', bull: 'bullish marubozu', bear: 'bearish marubozu', named: true, group: 'candle', cat: { types: ['continuation'], bull: 'bullish', bear: 'bearish', classical: false, source: 'usual' },
    help: 'A candle that is almost all body, with little or no wick: it opened near one end and closed near the other, showing one side in control. Bullish: up candle; bearish: down candle. Forms on its close.',
    params: [['min_body_pct', 'body ≥ % of the range', 90], ['range_mult', 'range ≥ × the average range (0 = any)', 1], ['avg_len', 'average range over bars', 20], ['trend_bars', 'after a move against it over N bars (0 = any)', 0]], fields: CANDLE_FIELDS },
  // the remaining chart patterns
  broadening: { title: 'Broadening formation / megaphone', bull: 'megaphone breaking up', bear: 'megaphone breaking down', named: true, group: 'chart',
    cat: { types: ['indeterminate'], bull: 'neutral', bear: 'neutral', classical: true, consolidation: 'No', breaks: 'Up or down', source: 'chart' },
    help: 'Swings get wider: higher highs and lower lows, between a rising top line and a falling bottom line. Control keeps changing hands. The pattern forms on the first close outside the lines in the side\'s direction. Target: the megaphone\'s width at the breakout.',
    params: [['strength', 'swing: bars each side', 3], ['min_height_points', 'width ≥ points', 10], ['max_bars', 'whole pattern within N bars', 80], ['break_within', 'breakout within N bars of the last swing', 20], ['diverge_pct', 'widens by ≥ % of its width', 30]],
    fields: ['line', 'opposite', 'height', 'target', 'breakout'] },
  broadening_wedge: { title: 'Broadening wedge', bull: 'descending broadening wedge', bear: 'ascending broadening wedge', named: true, group: 'chart',
    cat: { types: ['reversal'], bull: 'bullish', bear: 'bearish', classical: false, consolidation: 'No', breaks: 'Up or down', source: 'chart', note: 'Ascending broadening wedge: Bearish Reversal. Descending broadening wedge: Bullish Reversal. Both are whippy; the cheat sheet asks for several touches per side.' },
    help: 'Both lines slope the same way and spread apart. A descending broadening wedge (bullish) forms on the first close above its top line; an ascending broadening wedge (bearish) on the first close below its bottom line. Target: its width at the breakout.',
    params: [['strength', 'swing: bars each side', 3], ['min_height_points', 'width ≥ points', 10], ['max_bars', 'whole pattern within N bars', 80], ['break_within', 'breakout within N bars of the last swing', 20], ['diverge_pct', 'widens by ≥ % of its width', 30]],
    fields: ['line', 'opposite', 'height', 'target', 'breakout'] },
  cup_handle: { title: 'Cup and handle', bull: 'cup and handle', bear: 'inverse cup and handle', named: true, group: 'chart',
    cat: { types: ['continuation'], bull: 'bullish', bear: 'bearish', classical: true, consolidation: 'Prolonged', breaks: 'Up (cup) / Down (inverse)', source: 'chart' },
    help: 'A rounded dip between two swing highs at about the same price (the cup), then a small shallow pullback (the handle), then a close above the rim. The inverse, upside down, is bearish. Target: the cup\'s depth from the rim.',
    params: [['strength', 'swing: bars each side', 3], ['min_depth_points', 'cup depth ≥ points', 15], ['min_bars', 'cup at least N bars wide', 15], ['max_bars', 'cup at most N bars wide', 120], ['rim_tolerance_pct', 'rims equal within % of the depth', 25], ['handle_bars', 'handle at most N bars', 20], ['handle_max_pct', 'handle gives back ≤ % of the depth', 50]],
    fields: ['rim', 'extreme', 'depth', 'handle', 'target', 'breakout'] },
  diamond: { title: 'Diamond top / bottom', bull: 'diamond bottom', bear: 'diamond top', named: true, group: 'chart',
    cat: { types: ['reversal'], bull: 'bullish', bear: 'bearish', classical: true, consolidation: 'Yes', breaks: 'Up (bottom) / Down (top)', source: 'chart' },
    help: 'Swings first widen (a higher high and a lower low), then narrow (a lower high and a higher low), drawing a diamond. A diamond bottom forms on the first close above its upper-right line, a diamond top on the first close below its lower-right line. Target: the diamond\'s widest height.',
    params: [['strength', 'swing: bars each side', 3], ['min_height_points', 'widest height ≥ points', 15], ['max_bars', 'whole pattern within N bars', 100], ['break_within', 'breakout within N bars of the last swing', 20]],
    fields: ['line', 'height', 'target', 'breakout'] },
  rounding: { title: 'Rounding bottom / top', bull: 'rounding bottom (saucer)', bear: 'rounding top', named: true, group: 'chart',
    cat: { types: ['reversal'], bull: 'bullish', bear: 'bearish', classical: false, consolidation: 'Prolonged', breaks: 'Up (bottom) / Down (top)', source: 'chart' },
    help: 'A slow, smooth turn: over a long stretch, the closes follow a U (bottom) or an upside-down U (top), with the turn near the middle. Forms on the first close beyond the level where the curve started (the rim). Target: the curve\'s depth from the rim.',
    params: [['bars', 'curve over N bars', 40], ['min_depth_points', 'depth ≥ points', 15], ['min_fit_pct', 'closes fit the curve ≥ % (R²)', 70]],
    fields: ['rim', 'extreme', 'depth', 'target', 'breakout'] },
  island: { title: 'Island reversal', bull: 'bullish island reversal', bear: 'bearish island reversal', named: true, group: 'chart',
    cat: { types: ['reversal'], bull: 'bullish', bear: 'bearish', classical: false, consolidation: 'Brief', breaks: 'Up (bullish) / Down (bearish)', source: 'chart' },
    help: 'A small cluster of bars cut off by a gap on each side: price gaps down, trades a few bars, then gaps back up, leaving the cluster alone below (bullish); the mirror is bearish. Forms on the bar that opens the second gap. On futures, gaps mostly come at the session reopen.',
    params: [['max_bars', 'island at most N bars', 10], ['gap_ticks', 'each gap ≥ N ticks', 1]],
    fields: ['line', 'extreme', 'breakout'] },
  bump_run: { title: 'Bump-and-run reversal', bull: 'bullish bump-and-run', bear: 'bearish bump-and-run', named: true, group: 'chart',
    cat: { types: ['reversal'], bull: 'bullish', bear: 'bearish', classical: false, consolidation: 'No', breaks: 'Up (bullish) / Down (bearish)', source: 'chart' },
    help: 'A steady trend (the lead-in), then a sudden, steeper move the same way that pulls far away from its trend line (the bump), then a run back the other way through that line. Bullish: after a falling lead-in and a bump down, a close above the trend line; the mirror is bearish.',
    params: [['lead_bars', 'lead-in over N bars', 30], ['bump_bars', 'bump over N bars', 15], ['bump_mult', 'bump ≥ × the lead-in\'s usual distance from its line', 2], ['min_bump_points', 'bump ≥ points from the line', 10]],
    fields: ['line', 'extreme', 'breakout'] },
  measured_move: { title: 'Measured move', bull: 'measured move up', bear: 'measured move down', named: true, group: 'chart',
    cat: { types: ['continuation'], bull: 'bullish', bear: 'bearish', classical: true, consolidation: 'Sometimes', breaks: 'Up / Down', source: 'chart' },
    help: 'A first swing (A to B), a pullback (B to C) that gives back part of it, then a second swing expected to match the first. Forms on the first close beyond B. Target: C plus the length of the first swing.',
    params: [['strength', 'swing: bars each side', 3], ['min_leg_points', 'first swing ≥ points', 15], ['min_retrace_pct', 'pullback ≥ % of the first swing', 30], ['max_retrace_pct', 'pullback ≤ % of the first swing', 70], ['break_within', 'break of B within N bars of C', 30]],
    fields: ['line', 'swing', 'a', 'b', 'c', 'target', 'breakout'] },
  parabolic: { title: 'Parabolic blow-off / capitulation', bull: 'parabolic capitulation bottom', bear: 'parabolic blow-off top', named: true, group: 'chart',
    cat: { types: ['reversal'], bull: 'bullish', bear: 'bearish', classical: false, consolidation: 'No', breaks: 'Up (capitulation) / Down (blow-off)', source: 'chart' },
    help: 'A run that keeps speeding up (each part steeper than the one before) and covers a long way fast, then a sharp turn: a close beyond the previous bar\'s extreme the other way. Capitulation bottom (bullish) after a fall; blow-off top (bearish) after a rise. Target here: half of the run back.',
    params: [['run_bars', 'run over N bars', 15], ['move_mult', 'run ≥ × the average range', 6], ['accel', 'last third ≥ × as steep as the first', 1.5], ['avg_len', 'average range over bars', 20]],
    fields: ['line', 'extreme', 'move', 'target', 'breakout'] },
  wyckoff: { title: 'Wyckoff accumulation / distribution', bull: 'Wyckoff accumulation', bear: 'Wyckoff distribution', named: true, group: 'chart',
    cat: { types: ['reversal'], bull: 'bullish', bear: 'bearish', classical: false, consolidation: 'Prolonged', breaks: 'Up (accumulation) / Down (distribution)', source: 'chart' },
    help: 'After a fall, a long sideways range; near its end a false break below support that closes back inside (the spring); then a close above the range (sign of strength). Distribution is the mirror after a rise, with an upthrust above resistance. Target: the range height from the breakout.',
    params: [['range_bars', 'range over N bars', 60], ['min_height_points', 'range height ≥ points', 15], ['spring_ticks', 'spring goes ≥ N ticks beyond the range', 2], ['trend_bars', 'trend into the range over N bars', 40]],
    fields: ['line', 'opposite', 'spring', 'height', 'target', 'breakout'] },
  wyckoff_re: { title: 'Wyckoff re-accumulation / re-distribution', bull: 'Wyckoff re-accumulation', bear: 'Wyckoff re-distribution', named: true, group: 'chart',
    cat: { types: ['continuation'], bull: 'bullish', bear: 'bearish', classical: false, consolidation: 'Prolonged', breaks: 'Up (re-accumulation) / Down (re-distribution)', source: 'chart' },
    help: 'The same range, spring and breakout as accumulation, but in the middle of a rise (re-accumulation, bullish) or of a fall (re-distribution, bearish): a pause before the trend resumes. Target: the range height from the breakout.',
    params: [['range_bars', 'range over N bars', 60], ['min_height_points', 'range height ≥ points', 15], ['spring_ticks', 'spring goes ≥ N ticks beyond the range', 2], ['trend_bars', 'trend into the range over N bars', 40]],
    fields: ['line', 'opposite', 'spring', 'height', 'target', 'breakout'] },

  adam_eve: { title: 'Adam & Eve double top / bottom', bull: 'Adam & Eve double bottom', bear: 'Adam & Eve double top', named: true, group: 'chart',
    cat: { types: ['reversal'], bull: 'bullish', bear: 'bearish', classical: false, consolidation: 'Yes', breaks: 'Up (bottom) / Down (top)', source: 'chart' },
    help: 'A double bottom whose two lows look different: the first (Adam) is a sharp, narrow V; the second (Eve) is a wider, rounded U at about the same price. The mirror, with highs, is the Adam & Eve double top. Forms on the first close through the neckline (the high between them). Target: the height from the neckline.',
    params: [['strength', 'swing: bars each side', 3], ['tolerance_pct', 'lows equal within % of the height', 20], ['min_height_points', 'height ≥ points', 10], ['min_sep', 'lows at least N bars apart', 8], ['max_bars', 'whole pattern within N bars', 100], ['break_within', 'neckline break within N bars of Eve', 30], ['width_pct', 'a low\'s width: bars within % of the height of it', 25], ['adam_max_bars', 'Adam at most N bars wide', 3], ['eve_min_bars', 'Eve at least N bars wide', 6]],
    fields: ['neckline', 'height', 'target', 'adam', 'eve', 'extreme'] },
  hs_complex: { title: 'Complex head and shoulders', bull: 'complex inverse head and shoulders', bear: 'complex head and shoulders', named: true, group: 'chart',
    cat: { types: ['reversal'], bull: 'bullish', bear: 'bearish', classical: false, consolidation: 'Prolonged', breaks: 'Up (inverse) / Down', source: 'chart' },
    help: 'A head and shoulders with two shoulders on each side: five swing highs, the middle one (the head) clearly above the other four, which are at about the same price. The inverse, with lows, is bullish. The neckline joins the two lows next to the head and may slope; the pattern forms on the first close through it. Target: the height from the neckline.',
    params: [['strength', 'swing: bars each side', 3], ['tolerance_pct', 'shoulders equal within % of the height', 30], ['min_height_points', 'height ≥ points', 10], ['max_bars', 'whole pattern within N bars', 150], ['break_within', 'neckline break within N bars of the last shoulder', 30], ['head_margin_pct', 'head beyond the shoulders by ≥ % of the height', 15]],
    fields: ['neckline', 'height', 'target', 'head', 'extreme'] },
};
export function newPattern(kind: PatternKind, tf: TF, taken: string[]): Pattern {
  const base = { fvg: 'fvg', displacement: 'disp', order_block: 'ob', leg: 'swing', mss: 'mss', double: 'dbl', triple: 'tpl', head_shoulders: 'hs', triangle: 'tri', wedge: 'wdg', flag: 'flag', pennant: 'pen', rectangle: 'rect', channel: 'chan', engulfing: 'eng', hammer: 'pin', star: 'star', harami: 'har', piercing: 'pierce', soldiers: 'three', tweezer: 'tw', inside_bar: 'ib', doji: 'doji', marubozu: 'maru', broadening: 'mega', broadening_wedge: 'bwdg', cup_handle: 'cup', diamond: 'dia', rounding: 'rnd', island: 'isl', bump_run: 'barr', measured_move: 'mm', parabolic: 'para', wyckoff: 'wyk', wyckoff_re: 'wykre', adam_eve: 'ae', hs_complex: 'hsc' }[kind];
  let name = base, n = 2;
  while (taken.includes(name)) name = base + n++;
  return { name, kind, tf, params: Object.fromEntries(PATTERN_KINDS[kind].params.map(([k, , d]) => [k, d])) };
}
export function patternPhrase(p: Pattern | undefined, side: 'long' | 'short') {
  if (!p) return 'an unconfigured pattern';
  const d = PATTERN_KINDS[p.kind];
  if (d.group === 'candle') return `a ${p.tf} ${side === 'long' ? d.bull : d.bear}${p.label ? ` (${p.label})` : ''} forms (captured as "${p.name}")`;
  if (d.named) return `a ${p.tf} ${side === 'long' ? d.bull : d.bear}${p.label ? ` (${p.label})` : ''} completes on its ${['double', 'triple', 'head_shoulders'].includes(p.kind) ? 'neckline break' : 'breakout'} (captured as "${p.name}")`;
  return `a ${p.tf} ${side === 'long' ? d.bull : d.bear} ${p.label || d.title.replace(/ \(.*\)$/, '')} forms (captured as "${p.name}")`;
}

export interface Step {
  id: string;
  name: string;
  cond: Cond; // always an 'all' group at the top
  same_bar?: boolean; // may complete on the same bar as the previous step
  within_bars?: number;
  until?: string; // NY clock
  invalidate?: Cond;
  hold?: Cond;
  capture_running?: { name: string; field: 'low' | 'high' };
}
/** the entry order type in words: "Limit Entry" (the term), "Stop Entry", "Market Entry" */
export const orderName = (o: string) => (o === 'limit' ? 'Limit Entry' : o === 'stop' ? 'Stop Entry' : 'Market Entry');
export interface Entry { order: 'market' | 'limit' | 'stop'; price?: string; stop: { token: string; offset: number; unit: 'ticks' | 'atr'; atr?: string; /** what the distance is measured from: a level (default), the entry price, or a fixed $ per contract from the entry */ from?: 'level' | 'entry' | 'usd' } }
export interface Branch { id: string; side: 'long' | 'short'; steps: Step[]; entry: Entry; on_new_start: 'start_another' | 'replace' | 'ignore'; /** builder only: written by "Add a short branch", until the user dismisses the check note */ mirrored?: boolean }
export interface Leg { name: string; rule: 'r' | 'level' | 'fraction'; r?: number; level?: string; fraction?: number; offset_ticks?: number; share: number }
export interface Guard { kind: 'max_stop' | 'min_rr'; n: number; unit?: 'ticks' | 'atr'; atr?: string }
export interface TradeSettings {
  risk: { capital: number; pct: number; max_contracts: number };
  /** after `n` losing Trades in a row on one Trading day the Setup stops for that day; it resumes the next day at `cut` % of Risk per Trade until a winner (n 0 = off) */
  losing_streak?: { n: number; cut: number };
  legs: Leg[];
  leftover: 'first' | 'last';
  break_even: { trigger: 'off' | 'after_leg' | 'at_r'; k?: number; r?: number; offset_ticks: number };
  entry_deadline: { kind: 'clock' | 'bars' | 'end_of_hours' | 'end_of_day'; value: string };
  cancel_if: ('stop' | 'first_leg' | 'draw')[];
  expiry?: string;
  flatten_time: string;
  signal_guards: Guard[];
}
export interface InPositionRule { id: string; when: Cond; action: 'close_trade' | 'close_leg' | 'move_stop' | 'cancel_entry'; leg?: number; branch?: number }
export interface Setup {
  schema: 1;
  setup_id: string;
  name: string;
  notes: string;
  settings: {
    base_bar: TF;
    /** ranges apply to every ticked weekday, unless that weekday has its own ranges in overrides (0 = Sunday … 6 = Saturday) */
    trading_hours: { ranges: { start: string; end: string }[]; weekdays: number[]; overrides?: Record<string, { start: string; end: string }[]> };
    sessions: Record<string, { start: string; end: string }>;
    news_rule: { mode: 'off' | 'whole_day' | 'span'; before?: number; after?: number };
    one_at_a_time: 'off' | 'ignore_new_starts' | 'skip_completions';
  };
  indicators: { token: string; label?: string }[];
  patterns: Pattern[];
  branches: Branch[];
  trade_settings: TradeSettings;
  in_position_rules: InPositionRule[];
}
export const SECTION_NAMES: Record<string, string> = {
  risk: 'Risk per Trade', losing_streak: 'Losing streak', stop: 'Stop Loss', legs: 'Take Profits', break_even: 'Break-even', entry_deadline: 'Entry deadline', expiry_and_flatten: 'Closing time', signal_guards: 'Signal guards',
};

let seq = 1;
export const uid = (p = 'b') => `${p}${seq++}`;

// ---------- tokens ----------
export function parseToken(tok: string): { parts: string[]; prev: number; symbol?: string } {
  const m = /^\{\{(.+?)\}\}(?:\.prev\[(\d+)\])?$/.exec(tok.trim());
  if (!m) return { parts: [], prev: 0 };
  let inner = m[1], symbol: string | undefined;
  const at = inner.indexOf(':@');
  if (at >= 0) { symbol = inner.slice(at + 2); inner = inner.slice(0, at); }
  return { parts: inner.split(':'), prev: m[2] ? Number(m[2]) : 0, symbol };
}
export const isToken = (s: string) => /^\{\{.+\}\}(\.prev\[\d+\])?$/.test(s.trim());
export const withPrev = (tok: string, n: number) => tok.replace(/\.prev\[\d+\]$/, '') + (n > 0 ? `.prev[${n}]` : '');
export function tokenTf(tok: string): TF | null {
  const p = parseToken(tok);
  if (p.parts[0] === 'bar') return p.parts[2] as TF;
  if (p.parts[0] === 'indicator') return p.parts[3] as TF;
  if (p.parts[0] === 'bias' || p.parts[0] === 'trend') return p.parts[1] as TF;
  return null;
}
const IND_NAMES: Record<string, string> = { ema: 'EMA', sma: 'SMA', macd: 'MACD', atr: 'ATR', adx: 'ADX', rsi: 'RSI', avg_range: 'average range', avg_body: 'average body', vwap: 'VWAP' };
const BAR_NAMES: Record<string, string> = { close: 'close', open: 'open', high: 'high', low: 'low', volume: 'volume', range: 'range', body: 'body', body_pct: 'body %', upper_wick: 'upper wick', lower_wick: 'lower wick', dir: 'candle direction' };
const CAP_FIELDS: Record<string, string> = { top: 'top', bottom: 'bottom', mid: 'middle', size: 'size', bar1: 'candle 1', bar2: 'candle 2', bar3: 'candle 3', low: 'low', high: 'high', price: 'price', level: 'level', extreme: 'extreme', start: 'start', end: 'end' };

/** the fixed English phrase of a token */
export function phrase(tok: string, labels: Record<string, string> = {}): string {
  tok = tok.trim();
  if (!isToken(tok)) return tok;
  const p = parseToken(tok);
  const ago = p.prev ? ` ${p.prev} bar${p.prev > 1 ? 's' : ''} earlier` : '';
  const sym = p.symbol ? ` of ${p.symbol}` : '';
  const base = tok.replace(/\.prev\[\d+\]$/, '');
  const [k, a, b, c, d] = p.parts;
  switch (k) {
    case 'bar': return `the ${b} ${BAR_NAMES[a] || a}${sym}${ago}`;
    case 'indicator': {
      const lab = labels[base];
      if (lab) return `${lab}${ago}`;
      const out = d ? ` ${d === 'hist' ? 'histogram' : d === 'signal' ? 'signal line' : d}` : '';
      return `the ${c} ${IND_NAMES[a] || a}${a === 'macd' || a === 'avg_range' || a === 'avg_body' || !b ? '' : ' ' + b.replace(/,/g, ', ')}${a === 'macd' ? (out || ' line') : out}${a === 'avg_range' || a === 'avg_body' ? ` of ${b} bars` : ''}${sym}${ago}`;
    }
    case 'level': {
      if (a === 'prev_day') return `the previous Trading day's ${b}`;
      if (a === 'day') return `today's ${b}${b === 'open' ? '' : ' so far'}`;
      if (a === 'session') return `the ${b === 'new_york' ? 'New York' : b[0].toUpperCase() + b.slice(1)} session ${c}`;
      return `the ${a} ${b}`;
    }
    case 'capture': return `the ${a.split('.').map((f, i) => (i === 0 ? (f === 'fvg' ? 'FVG' : f.replace(/_/g, ' ')) + "'s" : CAP_FIELDS[f] || f)).join(' ')}`.replace("'s ", "'s ");
    case 'fib': return `the ${a}'s ${Number(b) * 100}% Fib level`;
    case 'bias': return `the ${a} Bias`;
    case 'trend': return `the ${a} Trend`;
    case 'draw': return 'the Draw on liquidity';
    case 'entry': return 'the entry';
    case 'trade': return `the Trade's ${({ legs_filled: 'Take Profits filled', open_r: 'open profit in R', max_favourable_r: 'best open profit in R', bars_open: 'bars open' } as Record<string, string>)[a] || a.replace(/_/g, ' ')}`;
  }
  return tok;
}
const OP_WORDS: Record<Op, string> = { '>': 'is above', '>=': 'is at or above', '<': 'is below', '<=': 'is at or below', '=': 'is', '!=': 'is not', crosses_above: 'crosses above', crosses_below: 'crosses below', within: 'is within', rising: 'is rising over', falling: 'is falling over' };
export const opWord = (op: Op) => OP_WORDS[op];
export function condPhrase(c: Cond, labels: Record<string, string> = {}): string {
  switch (c.t) {
    case 'cmp': return `${phrase(c.a, labels)} ${OP_WORDS[c.op]}${c.op === 'within' ? ` ${c.n} points of` : ''} ${c.mult && c.mult !== 1 ? `${c.mult} × ` : ''}${phrase(c.b, labels)}`;
    case 'all': return c.items.map((x) => condPhrase(x, labels)).join(', and ');
    case 'any': return 'either ' + c.items.map((x) => (x.t === 'all' && x.items.length > 1 && !x.origin ? '(' + condPhrase(x, labels) + ')' : condPhrase(x, labels))).join(', or ');
    case 'not': return `not (${condPhrase(c.item, labels)})`;
    case 'for_n': return `${condPhrase(c.item, labels)} for at least ${c.n} bars`;
    case 'time': return `the ${c.tf || 'Base'} bar opens between ${c.start} and ${c.end} NY`;
    case 'fvg': return `a ${c.tf} ${c.side === 'long' ? 'bullish' : 'bearish'} FVG of at least ${c.min_gap_ticks} ticks forms${c.middle_closes_gap_way ? ', its middle candle closing the gap\'s way' : ''} (captured as "${c.capture}")`;
    case 'pattern': return labels[`pattern:${c.ref}:${c.side}`] || `the pattern "${c.ref}" forms (not configured)`;
    case 'draw': return `a Draw on liquidity exists: the nearest untaken ${c.levels.map((l) => phrase(l)).join(' / ')} ${c.side === 'long' ? 'above' : 'below'} ${phrase(c.from)} by at least ${c.min_framework_points} points`;
  }
}
/** display labels: indicator labels, plus a phrase per declared pattern and side (key "pattern:<name>:<side>") */
export function labelsOf(s: Setup): Record<string, string> {
  const out: Record<string, string> = Object.fromEntries(s.indicators.filter((i) => i.label).map((i) => [i.token, i.label!]));
  for (const p of s.patterns || []) for (const side of ['long', 'short'] as const) out[`pattern:${p.name}:${side}`] = patternPhrase(p, side);
  return out;
}
export function patternSettingsPhrase(p: Pattern) {
  const d = PATTERN_KINDS[p.kind];
  const dispOn = p.kind === 'displacement' || p.kind === 'order_block' || !!p.params.displacement;
  return d.params.filter(([k]) => dispOn || !['disp_mult', 'disp_body_pct', 'avg_len'].includes(k)).map(([k, l]) => (typeof p.params[k] === 'boolean' ? (p.params[k] ? l : '') : `${l} ${p.params[k]}`)).filter(Boolean).join(', ');
}
export function ruleDescription(s: Setup): string {
  const labels = labelsOf(s);
  const lines: string[] = [];
  lines.push(`${s.name}. Base bar ${s.settings.base_bar}. Trading window ${s.settings.trading_hours.ranges.map((r) => `${r.start}–${r.end}`).join(', ') || 'all day'} NY.`);
  for (const [d, rs] of Object.entries(s.settings.trading_hours.overrides || {})) lines.push(`On ${['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][Number(d)]}: ${rs.map((r) => `${r.start}–${r.end}`).join(', ') || 'all day'} NY instead.`);
  for (const p of s.patterns || []) lines.push(`Pattern "${p.name}": ${p.tf} ${PATTERN_KINDS[p.kind].title} (${patternSettingsPhrase(p)}).`);
  for (const br of s.branches) {
    lines.push(`${br.side === 'long' ? 'Long' : 'Short'}:`);
    br.steps.forEach((st, k) => {
      const lim = [st.within_bars ? `within ${st.within_bars} bars` : '', st.until ? `until ${st.until}` : '', st.same_bar ? 'possibly on the same bar' : ''].filter(Boolean).join(', ');
      lines.push(`  ${k === 0 ? 'First' : 'Then'}${lim ? ` (${lim})` : ''}: ${condPhrase(st.cond, labels)}.`);
    });
    const e = br.entry;
    lines.push(`  Enter ${e.order === 'market' ? "at market at the next bar's open" : `with a ${orderName(e.order)} at ${phrase(e.price || '?', labels)}`}; Stop Loss ${stopPhrase(e.stop, br.side, (t) => phrase(t, labels))}.`);
  }
  const ts = s.trade_settings;
  lines.push(`Take Profits: ${ts.legs.map((l) => `${l.name} ${l.rule === 'r' ? `at ${l.r}R` : l.rule === 'fraction' ? `${(l.fraction ?? 0) * 100}% of the way to ${phrase(l.level || '?')}` : `${l.offset_ticks ? `${l.offset_ticks} tick${l.offset_ticks === 1 ? "" : "s"} before ` : 'at '}${phrase(l.level || '?')}`} (${Math.round(l.share * 100)}%)`).join('; ')}.`);
  for (const r of s.in_position_rules) lines.push(`While in a Trade: if ${condPhrase(r.when, labels)}, ${r.action === 'close_trade' ? 'close the whole Trade' : r.action === 'close_leg' ? `close TP${r.leg} now` : r.action.replace('_', ' ')}.`);
  return lines.join('\n');
}

// ---------- mirror ----------
const SWAP: [string, string][] = [[':high', ':low'], ['.high', '.low'], ['.top', '.bottom'], ['crosses_above', 'crosses_below'], ['bullish', 'bearish'], ['long', 'short']];
export function mirrorFieldSide(s: string): string {
  let out = s;
  SWAP.forEach(([a, b], k) => { out = out.split(a).join(`\u0000${k}A`).split(b).join(a).split(`\u0000${k}A`).join(b); });
  return out;
}
export function isMagnitude(tok: string) {
  const p = parseToken(tok);
  if (p.parts[0] === 'bar') return ['range', 'body', 'body_pct', 'volume', 'upper_wick', 'lower_wick'].includes(p.parts[1]);
  if (p.parts[0] === 'indicator') return ['adx', 'atr', 'avg_range', 'avg_body'].includes(p.parts[1]);
  if (p.parts[0] === 'capture') return /\.size$/.test(p.parts[1]);
  if (p.parts[0] === 'trade') return ['legs_filled', 'bars_open', 'open_r', 'max_favourable_r'].includes(p.parts[1]);
  return false;
}
const OP_MIRROR: Record<string, Op> ={ '>': '<', '<': '>', '>=': '<=', '<=': '>=', crosses_above: 'crosses_below', crosses_below: 'crosses_above' };
export function mirrorBranch(br: Branch): Branch {
  const m = (c: Cond): Cond => {
    const id = uid();
    switch (c.t) {
      case 'cmp': {
        // Directional values (prices, levels, MACD against 0) flip the operator; magnitudes (range, body, body %,
        // volume, ADX, ATR, average range) keep it; upper and lower wick swap; RSI mirrors around 50.
        const a = mirrorFieldSide(c.a).replace('upper_wick', '\u0000').replace('lower_wick', 'upper_wick').replace('\u0000', 'lower_wick');
        const b = mirrorFieldSide(c.b);
        if (isMagnitude(c.a)) return { ...c, id, a, b };
        if (/\{\{indicator:rsi:/.test(c.a) && /^\d+(\.\d+)?$/.test(c.b)) return { ...c, id, a, b: String(100 - Number(c.b)), op: OP_MIRROR[c.op] || c.op };
        return { ...c, id, a, b, op: OP_MIRROR[c.op] || c.op };
      }
      case 'all': case 'any': return { ...c, id, items: c.items.map(m) };
      case 'not': return { ...c, id, item: m(c.item) };
      case 'for_n': return { ...c, id, item: m(c.item) };
      case 'fvg': case 'pattern': return { ...c, id, side: c.side === 'long' ? 'short' : 'long' };
      case 'draw': return { ...c, id, side: c.side === 'long' ? 'short' : 'long', from: mirrorFieldSide(c.from), levels: c.levels.map(mirrorFieldSide) };
      default: return { ...c, id };
    }
  };
  return {
    ...br, id: uid('br'), side: br.side === 'long' ? 'short' : 'long',
    steps: br.steps.map((s) => ({ ...s, id: uid('st'), cond: m(s.cond), hold: s.hold && m(s.hold), invalidate: s.invalidate && m(s.invalidate), capture_running: s.capture_running && { ...s.capture_running, field: s.capture_running.field === 'low' ? 'high' : 'low' } })),
    entry: { ...br.entry, price: br.entry.price && mirrorFieldSide(br.entry.price), stop: { ...br.entry.stop, token: mirrorFieldSide(br.entry.stop.token) } },
  };
}

/** "Duplicate as mirrored": writes out the other side once, In-position rules included; then the two are independent */
export function addMirror(s: Setup) {
  const src = s.branches[0];
  s.branches.push(mirrorBranch(src));
  const nb = s.branches.length - 1;
  s.branches[nb].mirrored = true;
  const rules = s.in_position_rules.filter((r) => r.branch === undefined || r.branch === 0);
  s.in_position_rules.forEach((r) => { if (r.branch === undefined) r.branch = 0; });
  for (const r of rules) s.in_position_rules.push({ ...r, id: uid('ip'), branch: nb, when: mirrorBranch({ ...src, steps: [{ id: 'x', name: '', cond: r.when }] }).steps[0].cond });
}

// ---------- validation (Freeze refuses on errors; a Draft saves with warnings) ----------
export interface Issue { level: 'error' | 'warning'; where: string; text: string }
export function captureNames(c: Cond | undefined, out: string[] = []): string[] {
  if (!c) return out;
  if (c.t === 'fvg') out.push(c.capture);
  if (c.t === 'pattern') out.push(c.ref);
  if (c.t === 'draw') out.push('draw');
  if (c.t === 'all' || c.t === 'any') c.items.forEach((x) => captureNames(x, out));
  if (c.t === 'not' || c.t === 'for_n') captureNames(c.item, out);
  return out;
}
export function tokensOf(c: Cond | undefined, out: string[] = []): string[] {
  if (!c) return out;
  if (c.t === 'cmp') { if (isToken(c.a)) out.push(c.a); if (isToken(c.b)) out.push(c.b); }
  if (c.t === 'draw') out.push(c.from, ...c.levels);
  if (c.t === 'all' || c.t === 'any') c.items.forEach((x) => tokensOf(x, out));
  if (c.t === 'not' || c.t === 'for_n') tokensOf(c.item, out);
  return out;
}
export function patternRefs(c: Cond | undefined, out: string[] = []): string[] {
  if (!c) return out;
  if (c.t === 'pattern') out.push(c.ref);
  if (c.t === 'all' || c.t === 'any') c.items.forEach((x) => patternRefs(x, out));
  if (c.t === 'not' || c.t === 'for_n') patternRefs(c.item, out);
  return out;
}
export function patternUsage(s: Setup): Record<string, number> {
  const out: Record<string, number> = {};
  const add = (c?: Cond) => patternRefs(c).forEach((n) => (out[n] = (out[n] || 0) + 1));
  s.branches.forEach((b) => b.steps.forEach((st) => { add(st.cond); add(st.hold); add(st.invalidate); }));
  s.in_position_rules.forEach((r) => add(r.when));
  return out;
}
export function validate(s: Setup): Issue[] {
  const out: Issue[] = [];
  const bm = tfMinutes(s.settings.base_bar);
  const pats = s.patterns || [];
  const pu = patternUsage(s);
  pats.forEach((p, k) => {
    if (!/^[a-z][a-z0-9_]*$/.test(p.name)) out.push({ level: 'error', where: 'Patterns', text: `"${p.name}" is not a valid name (lower case letters, digits, _).` });
    if (pats.findIndex((q) => q.name === p.name) !== k) out.push({ level: 'error', where: 'Patterns', text: `Two patterns are named "${p.name}".` });
    if (tfMinutes(p.tf) < bm) out.push({ level: 'error', where: 'Patterns', text: `"${p.name}" is on ${p.tf}, finer than the Base bar (${s.settings.base_bar}).` });
    if (!pu[p.name]) out.push({ level: 'warning', where: 'Patterns', text: `"${p.name}" is configured but no step uses it.` });
  });
  for (const n of Object.keys(pu)) if (!pats.some((p) => p.name === n)) out.push({ level: 'error', where: 'Signals', text: `A step reads the pattern "${n}", which is not configured.` });
  const declared = new Set(s.indicators.map((i) => i.token));
  if (!s.branches.length) out.push({ level: 'error', where: 'Signals', text: 'No entry branch yet: add a long or a short branch.' });
  s.branches.forEach((br) => {
    const where = `${br.side === 'long' ? 'Long' : 'Short'} branch`;
    const caps: string[] = [];
    br.steps.forEach((st, k) => {
      for (const t of [...tokensOf(st.cond), ...tokensOf(st.hold), ...tokensOf(st.invalidate)]) {
        const tf = tokenTf(t);
        if (tf && tfMinutes(tf) < bm) out.push({ level: 'error', where: `${where}, step ${k + 1}`, text: `${t} is finer than the Base bar (${s.settings.base_bar}).` });
        const p = parseToken(t);
        if (p.parts[0] === 'indicator' && !declared.has(t.replace(/\.prev\[\d+\]$/, ''))) out.push({ level: 'warning', where: `${where}, step ${k + 1}`, text: `${t} is not in the Setup's indicator list (it will be configured on save).` });
        if (p.parts[0] === 'capture') { const n = p.parts[1].split('.')[0]; if (!caps.includes(n) && !captureNames(st.cond).includes(n)) out.push({ level: 'error', where: `${where}, step ${k + 1}`, text: `"${n}" is read before any step captures it.` }); }
        if (p.parts[0] === 'draw' && !caps.includes('draw') && !captureNames(st.cond).includes('draw')) out.push({ level: 'error', where: `${where}, step ${k + 1}`, text: 'The Draw on liquidity is read before a step chooses it.' });
      }
      caps.push(...captureNames(st.cond));
      if (st.capture_running) caps.push(st.capture_running.name);
    });
    if (!br.steps.length) out.push({ level: 'warning', where, text: 'No steps yet.' });
    if ((br.entry.stop.from || 'level') === 'level' && !br.entry.stop.token) out.push({ level: 'error', where: `${where}, Entry`, text: 'An Entry needs a Stop Loss.' });
    if (br.entry.order !== 'market' && !br.entry.price) out.push({ level: 'error', where: `${where}, Entry`, text: 'A Limit Entry or Stop Entry needs a price.' });
    const readCap = (t?: string) => { if (!t) return; const p = parseToken(t); if (p.parts[0] === 'capture' && !caps.includes(p.parts[1].split('.')[0])) out.push({ level: 'error', where: `${where}, Entry`, text: `${t} is never captured by this branch.` }); };
    readCap(br.entry.price); readCap(br.entry.stop.token);
  });
  const ts = s.trade_settings;
  if (!ts.legs.length) out.push({ level: 'error', where: 'Trade settings', text: 'At least one Take Profit is needed.' });
  const share = ts.legs.reduce((a, l) => a + l.share, 0);
  if (ts.legs.length && Math.abs(share - 1) > 0.001) out.push({ level: 'warning', where: 'Take Profits', text: `Take Profit shares add up to ${Math.round(share * 100)}%; extra contracts go to ${ts.leftover === 'first' ? (ts.legs[0]?.name || 'TP1') : (ts.legs[ts.legs.length - 1]?.name || 'the last TP')} first.` });
  if (!ts.flatten_time) out.push({ level: 'error', where: 'Closing time', text: 'A "Be flat by" time is required.' });
  if (!ts.entry_deadline.value && ts.entry_deadline.kind !== 'end_of_day' && ts.entry_deadline.kind !== 'end_of_hours') out.push({ level: 'error', where: 'Entry deadline', text: 'The entry deadline is mandatory.' });
  return out;
}

// ---------- hash (over what the engine reads) ----------
export function canonical(s: Setup): string {
  const strip = (x: any): any => {
    if (Array.isArray(x)) return x.map(strip);
    if (x && typeof x === 'object') {
      const o: any = {};
      for (const k of Object.keys(x).sort()) { if (['name', 'notes', 'label', 'origin', 'id'].includes(k)) continue; o[k] = strip(x[k]); }
      return o;
    }
    return x;
  };
  return JSON.stringify(strip(s));
}
export async function hashSetup(s: Setup) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(s)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ---------- presets (expand into editable tokens, keep an origin) ----------
const O = (preset: string): Origin => ({ preset, preset_version: 1, edited: false });
export const PRESETS = {
  bias(side: 'long' | 'short'): Cond { return { id: uid(), t: 'cmp', a: '{{bias:1d}}', op: '=', b: side === 'long' ? 'bullish' : 'bearish', origin: O('Bias') }; },
  displacement(tf: TF, side: 'long' | 'short', prev = 0): Cond {
    const P = (t: string) => withPrev(t, prev);
    return { id: uid(), t: 'all', label: 'Displacement', origin: O('Displacement'), items: [
      { id: uid(), t: 'cmp', a: P(`{{bar:range:${tf}}}`), op: '>=', mult: 1.5, b: withPrev(`{{indicator:avg_range:20:${tf}}}`, prev + 1) },
      { id: uid(), t: 'cmp', a: P(`{{bar:body_pct:${tf}}}`), op: '>=', b: '60' },
      { id: uid(), t: 'cmp', a: P(`{{bar:dir:${tf}}}`), op: '=', b: side === 'long' ? 'bullish' : 'bearish' },
    ] };
  },
  fvgWithDisplacement(tf: TF, side: 'long' | 'short'): Cond {
    return { id: uid(), t: 'all', label: 'FVG with Displacement', origin: O('FVG with Displacement'), items: [
      { id: uid(), t: 'fvg', side, tf, min_gap_ticks: 4, middle_closes_gap_way: true, capture: 'fvg' },
      PRESETS.displacement(tf, side, 1),
    ] };
  },
  draw(side: 'long' | 'short', from = '{{capture:fvg.top}}'): Cond {
    const hl = side === 'long' ? 'high' : 'low';
    return { id: uid(), t: 'draw', side, from, min_framework_points: 10, levels: [`{{level:prev_day:${hl}}}`, `{{level:session:asia:${hl}}}`, `{{level:session:london:${hl}}}`], origin: O('Draw on liquidity') };
  },
  macdCross(tf: TF, side: 'long' | 'short'): Cond {
    return { id: uid(), t: 'cmp', a: `{{indicator:macd:12,26,9:${tf}}}`, op: side === 'long' ? 'crosses_above' : 'crosses_below', b: `{{indicator:macd:12,26,9:${tf}:signal}}`, origin: O('MACD crosses signal') };
  },
};

export const DEFAULT_SESSIONS = { asia: { start: '20:00', end: '00:00' }, london: { start: '02:00', end: '05:00' }, new_york: { start: '09:30', end: '16:00' } };

export function blankSetup(): Setup {
  return {
    schema: 1, setup_id: 'stp_new', name: 'New Setup', notes: '',
    settings: { base_bar: '1m', trading_hours: { ranges: [{ start: '09:30', end: '16:00' }], weekdays: [1, 2, 3, 4, 5] }, sessions: structuredClone(DEFAULT_SESSIONS), news_rule: { mode: 'off' }, one_at_a_time: 'ignore_new_starts' },
    indicators: [],
    patterns: [],
    branches: [{ id: uid('br'), side: 'long', on_new_start: 'start_another', steps: [{ id: uid('st'), name: 'Step 1', cond: { id: uid(), t: 'all', items: [] } }], entry: { order: 'limit', price: '', stop: { token: '', offset: 2, unit: 'ticks' } } }],
    trade_settings: { risk: { capital: 5000, pct: 3, max_contracts: 5 }, legs: [{ name: 'TP1', rule: 'r', r: 2, share: 1 }], leftover: 'last', break_even: { trigger: 'off', offset_ticks: 0 }, entry_deadline: { kind: 'end_of_hours', value: '' }, cancel_if: ['stop'], flatten_time: '16:55', signal_guards: [] },
    in_position_rules: [],
  };
}

export function silverBullet(): Setup {
  const s = blankSetup();
  s.setup_id = 'stp_silver_bullet'; s.name = 'Silver Bullet';
  s.notes = 'ICT AM Silver Bullet, preset B as locked in #42.';
  s.settings.trading_hours.ranges = [{ start: '10:00', end: '11:00' }];
  s.patterns = [{ name: 'fvg', kind: 'fvg', tf: '1m', params: { min_gap_ticks: 4, middle_closes_gap_way: true, displacement: true, disp_mult: 1.5, disp_body_pct: 60, avg_len: 20 }, label: '' }];
  delete s.patterns[0].label;
  s.branches = [{
    id: uid('br'), side: 'long', on_new_start: 'start_another',
    steps: [
      { id: uid('st'), name: 'FVG with Displacement, with the Bias', cond: { id: uid(), t: 'all', items: [
        PRESETS.bias('long'),
        { id: uid(), t: 'pattern', ref: 'fvg', side: 'long' },
        { id: uid(), t: 'cmp', a: '{{bar:dir:15m}}', op: '!=', b: 'bearish' },
        { id: uid(), t: 'time', start: '10:00', end: '11:00', tf: '1m' },
      ] } },
      { id: uid('st'), name: 'Draw on liquidity', same_bar: true, within_bars: 0, cond: { id: uid(), t: 'all', items: [PRESETS.draw('long')] } },
    ],
    entry: { order: 'limit', price: '{{capture:fvg.top}}', stop: { token: '{{capture:fvg.bar1.low}}', offset: 2, unit: 'ticks' } },
  }];
  s.trade_settings = {
    risk: { capital: 5000, pct: 3, max_contracts: 5 },
    legs: [{ name: 'TP1', rule: 'fraction', level: '{{draw}}', fraction: 0.5, share: 0.5 }, { name: 'TP2', rule: 'level', level: '{{draw}}', offset_ticks: 1, share: 0.5 }],
    leftover: 'last', break_even: { trigger: 'after_leg', k: 1, offset_ticks: 0 },
    entry_deadline: { kind: 'clock', value: '11:00' }, cancel_if: ['stop', 'draw'], flatten_time: '16:55',
    signal_guards: [{ kind: 'min_rr', n: 1 }],
  };
  return s;
}

export function emaMacd(): Setup {
  const s = blankSetup();
  s.setup_id = 'stp_ema_macd'; s.name = 'EMA 200 + MACD';
  s.notes = 'DAFT Trade documentation, as locked in #42.';
  s.settings.base_bar = '15m';
  s.settings.trading_hours.ranges = [{ start: '18:00', end: '16:00' }];
  s.settings.one_at_a_time = 'skip_completions';
  s.settings.news_rule = { mode: 'span', before: 30, after: 0 };
  s.indicators = [
    { token: '{{indicator:ema:200:15m}}', label: 'the EMA 200' },
    { token: '{{indicator:macd:12,26,9:15m}}', label: 'the MACD line' },
    { token: '{{indicator:macd:12,26,9:15m:signal}}', label: 'the MACD signal line' },
    { token: '{{indicator:macd:12,26,9:15m:hist}}', label: 'the MACD histogram' },
    { token: '{{indicator:adx:14:15m}}', label: 'the ADX' },
    { token: '{{indicator:atr:14:15m}}', label: 'the ATR' },
  ];
  s.branches = [{
    id: uid('br'), side: 'long', on_new_start: 'ignore',
    steps: [
      { id: uid('st'), name: 'Pullback: histogram negative for 3 bars', capture_running: { name: 'pullback', field: 'low' }, cond: { id: uid(), t: 'all', items: [
        { id: uid(), t: 'for_n', n: 3, item: { id: uid(), t: 'cmp', a: '{{indicator:macd:12,26,9:15m:hist}}', op: '<', b: '0' } },
      ] } },
      { id: uid('st'), name: 'MACD crosses up below zero, with the trend', invalidate: { id: uid(), t: 'cmp', a: '{{indicator:macd:12,26,9:15m:hist}}.prev[1]', op: '>', b: '0' }, cond: { id: uid(), t: 'all', items: [
        PRESETS.macdCross('15m', 'long'),
        { id: uid(), t: 'cmp', a: '{{indicator:macd:12,26,9:15m}}', op: '<', b: '0' },
        { id: uid(), t: 'cmp', a: '{{indicator:macd:12,26,9:15m:signal}}', op: '<', b: '0' },
        { id: uid(), t: 'cmp', a: '{{bar:close:15m}}', op: '>', b: '{{indicator:ema:200:15m}}' },
        { id: uid(), t: 'cmp', a: '{{indicator:ema:200:15m}}', op: '>', b: '{{indicator:ema:200:15m}}.prev[10]' },
        { id: uid(), t: 'cmp', a: '{{indicator:adx:14:15m}}', op: '>', b: '20' },
      ] } },
    ],
    entry: { order: 'market', stop: { token: '{{capture:pullback.low}}', offset: 0.25, unit: 'atr', atr: '{{indicator:atr:14:15m}}' } },
  }];
  s.trade_settings = {
    risk: { capital: 5000, pct: 3, max_contracts: 5 },
    legs: [{ name: 'TP1', rule: 'r', r: 1.5, share: 0.5 }, { name: 'TP2', rule: 'r', r: 3, share: 0.5 }],
    leftover: 'first', break_even: { trigger: 'after_leg', k: 1, offset_ticks: 0 },
    entry_deadline: { kind: 'bars', value: '1' }, cancel_if: [], flatten_time: '16:55',
    signal_guards: [{ kind: 'max_stop', n: 3, unit: 'atr', atr: '{{indicator:atr:14:15m}}' }],
  };
  s.in_position_rules = [
    { id: uid('ip'), action: 'close_trade', when: { id: uid(), t: 'cmp', a: '{{bar:close:15m}}', op: '<', b: '{{indicator:ema:200:15m}}' } },
    { id: uid('ip'), action: 'close_leg', leg: 2, when: { id: uid(), t: 'all', items: [
      { id: uid(), t: 'cmp', a: '{{trade:legs_filled}}', op: '>=', b: '1' },
      { id: uid(), t: 'cmp', a: '{{indicator:macd:12,26,9:15m}}', op: 'crosses_below', b: '{{indicator:macd:12,26,9:15m:signal}}' },
    ] } },
  ];
  return s;
}

/** a demo of the chart patterns: a 5m double bottom, entered with a Limit Entry on the neckline retest after the break, target the measured move; mirrored for the double top */
export function doubleBottom(): Setup {
  const s = blankSetup();
  s.setup_id = 'stp_double_bottom'; s.name = 'Double bottom breakout';
  s.notes = 'Prototype demo of a chart pattern, not a locked Setup.';
  s.settings.base_bar = '5m';
  s.settings.trading_hours.ranges = [{ start: '09:30', end: '15:30' }];
  s.patterns = [{ name: 'dbl', kind: 'double', tf: '5m', params: { strength: 3, tolerance_pct: 20, min_height_points: 15, min_sep: 5, max_bars: 80, break_within: 30 } }];
  s.branches = [{
    id: uid('br'), side: 'long', on_new_start: 'start_another',
    steps: [{ id: uid('st'), name: 'Double bottom breaks its neckline', cond: { id: uid(), t: 'all', items: [{ id: uid(), t: 'pattern', ref: 'dbl', side: 'long' }] } }],
    entry: { order: 'limit', price: '{{capture:dbl.neckline}}', stop: { token: '{{capture:dbl.extreme}}', offset: 4, unit: 'ticks' } },
  }];
  s.trade_settings.legs = [{ name: 'TP1', rule: 'level', level: '{{capture:dbl.target}}', offset_ticks: 2, share: 1 }];
  s.trade_settings.entry_deadline = { kind: 'bars', value: '6' };
  s.trade_settings.cancel_if = ['stop', 'first_leg'];
  s.trade_settings.signal_guards = [];
  addMirror(s);
  return s;
}
/** PROTOTYPE demo: EMA 200 + MACD sized on a bigger account, with two Take Profits and break-even after TP1, so a backtest
 *  shows a Trade through every step (TP1 reached, break-even, then TP2 or the break-even stop, then the exit): Sep 18 and Oct 5. */
export function fullTradeDemo(): Setup {
  const s = emaMacd();
  s.setup_id = 'stp_full_trade_demo'; s.name = 'Full Trade demo (EMA 200 + MACD, 2 TPs, break-even)';
  s.trade_settings.risk = { capital: 50000, pct: 1, max_contracts: 10 };
  s.trade_settings.legs = [{ name: 'TP1', rule: 'r', r: 0.5, share: 0.5 }, { name: 'TP2', rule: 'r', r: 2, share: 0.5 }];
  s.trade_settings.break_even = { trigger: 'after_leg', k: 1, offset_ticks: 0 };
  return s;
}
export const STARTERS: Record<string, () => Setup> = { blank: blankSetup, silver_bullet: silverBullet, ema_macd: emaMacd, double_bottom: doubleBottom, full_trade_demo: fullTradeDemo };

/** "09:30–16:00 (Fri 09:30–12:00)": the usual ranges, then each weekday that has its own */
export function tradingWindowText(th: Setup['settings']['trading_hours']) {
  const r = (rs: { start: string; end: string }[]) => rs.map((x) => `${x.start}–${x.end}`).join(', ') || 'all day';
  const ov = Object.entries(th.overrides || {}).map(([d, rs]) => `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][Number(d)]} ${r(rs)}`);
  return r(th.ranges) + (ov.length ? ` (${ov.join('; ')})` : '');
}

/** the stop in words, e.g. "2 ticks below the FVG's candle 1 low", "20 ticks below the entry", "$40 a contract below the entry" */
export function stopPhrase(st: Entry['stop'], side: 'long' | 'short', name: (t: string) => string): string {
  const dir = side === 'long' ? 'below' : 'above';
  if (st.from === 'usd') return `$${st.offset} a contract ${dir} the entry`;
  const dist = `${st.offset} ${st.unit === 'atr' ? `× ${st.atr ? name(st.atr) : 'ATR'}` : st.offset === 1 ? 'tick' : 'ticks'}`;
  return `${dist} ${dir} ${st.from === 'entry' ? 'the entry' : name(st.token || '?')}`;
}

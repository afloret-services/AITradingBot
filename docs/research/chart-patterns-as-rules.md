# Chart patterns as exact rules

Resolves [Chart patterns as exact rules: double top, wedges and the rest](https://github.com/afloret-services/AITradingBot/issues/66). Researched on 2026-11-11 from a Claude Code cloud session.

**What was read first-hand, and what was not.** The session's network reached GitHub and a web search engine, but not nber.org, mit.edu, upenn.edu, the MPRA archive, thepatternsite.com or TradingView. So:

- **Read first-hand (source code, pinned commits):** the five open-source detectors in [Sources](#sources), and TA-Lib's ADX.
- **Search-result snippets only:** Bulkowski's own pages on thepatternsite.com. The figures quoted from them below come from search-engine extracts of those pages, not a full read.
- **From memory of the paper, not reopened here:** the exact Lo, Mamaysky & Wang (2000) definitions. Two of them (rectangle 0.75 %, bandwidth 0.3 × the cross-validated one) were confirmed by search snippets of the paper; the rest should be checked against the free NBER copy (w7613) before they are written into a Rule block's defaults.

## Verdict

1. **Every classical pattern reduces to the same parts:** an ordered run of alternating Swing points, price relations between them with a tolerance, sometimes a time span, sometimes trend lines through two of them, and a **breakout close** beyond a level or line. The builder therefore needs only a few generic Rule blocks (Swing sequence, Level/line, Tolerance, Close beyond), with each named pattern a preset of those.
2. **No standard numbers exist.** Lo, Mamaysky & Wang, Bulkowski and every detector pick different tolerances and spans, and say so (LMW call their bandwidth choice "ad hoc"). Each threshold must be a setting with a default, not a constant.
3. **Percent tolerances from daily stock studies don't carry over to intraday NQ/ES.** 1.5 % of NQ at 20 000 is 300 points, more than most intraday ranges. Express tolerances and slopes in **ATR or median bar range** on the pattern's own timeframe (as stock-pattern does), not percent of price or raw price per bar.
4. **Repainting is avoidable, but only by construction.** A Swing point with *N* bars on each side is knowable only *N* bars later; a pattern is knowable only when its last Swing point is confirmed and, for a traded Signal, when the breakout bar closes. If every Rule block is evaluated at bar *t* with only Swing points confirmed by *t*, nothing repaints: patterns are merely late. Kernel-smoothed extrema (LMW) and zigzag-style "last leg" pivots do repaint and should not be used for Signals.
5. **"Trend" has three common testable definitions** (Swing-point structure, moving-average slope or position, ADX strength); they measure different things and should be separate Rule blocks. The one consistent with GLOSSARY.md's Swing point and Bias is the structural one.

## Repaintability: three different problems

| Kind | What happens | Where seen | Fix |
| --- | --- | --- | --- |
| **Confirmation lag** | A Swing point with *N* right-hand bars is only known *N* bars after it prints. Not repainting if the point is stamped with its confirmation bar. | neurotrader888 `rw_top`/`rw_bottom` return both the "confirmation index" `i` and the extremum's index `i - order`. precise-patterns emits a `pivot.confirm` event once the rolling buffer is full. | Stamp every Swing point with `confirmed_at`; Rule blocks may only see points with `confirmed_at <= t`. |
| **Look-ahead in a backtest** | The detector labels a bar using bars after it, so a backtest "knows" a pivot before it could have. | smartmoneyconcepts `swing_highs_lows` compares each high with `high.shift(-(swing_length//2)).rolling(swing_length).max()`, a centred window, and writes the label on the swing bar itself. zeta-zetra's pattern scans count pivots inside `[candle_idx - lookback, candle_idx]`, but those pivots need `right_count` (default 3) later bars, so pivots in the last 3 bars of the window use future data. | Same as above: index by confirmation bar. |
| **True repaint** | A pattern or pivot already shown changes or disappears as more bars arrive. | smartmoneyconcepts then deletes one of any two consecutive same-side swings, using the later one, so an earlier swing can vanish. LMW's kernel regression is fitted over the whole window, so extrema shift as the window moves. Zigzag pivots (TradingView-style) move their last leg until reversed. | Don't use these for Signals; at most for charting. |

A separate, legitimate state change is **Candidate → Signal**: a double top whose second peak is confirmed is a Candidate; it becomes a Signal only on the breakout close. A Candidate that is invalidated (price closes above the higher peak first) should be logged as dropped, not erased.

## Building blocks every definition uses

- **Swing point** (GLOSSARY): a high above the highs of *N* bars on each side. Detectors' defaults: stock-pattern 6/6, zeta-zetra 3/3, neurotrader888 `order` (one value both sides), smartmoneyconcepts 50. Ties differ: zeta-zetra and neurotrader888 accept equal highs (`<`/`>` comparisons), stock-pattern takes `idxmax`, which keeps only the first of equal highs.
  - **Bug to avoid:** stock-pattern `get_max_min` (commit `85c710d`) builds a window of `barsLeft + 1 + barsRight` bars but tests `win.index[barsLeft + 1]`, one past the centre, so 6/6 really means 7 left and 5 right.
- **Alternation:** most definitions need highs and lows to alternate. LMW require "consecutive extrema" from the smoothed curve, which alternate by construction; stock-pattern searches for the max/min between points, so its points may skip intermediate swings.
- **Tolerance ("equal" prices):** LMW use percent of the two points' average (1.5 % or 0.75 %); zeta-zetra a ratio (`top1/top2 <= 1.01`, bottoms `>= 0.98`); stock-pattern a multiple of the median bar range (`median(High - Low)` over the pattern, called `avgBarLength`) or of ATR(15).
- **Trend line:** through two Swing points (stock-pattern, neurotrader888 pips) or least-squares through all pivot highs / lows in a lookback with a minimum fit (zeta-zetra: `linregress`, `|r| >= 0.9`, at least 3 points). Slopes are raw price per bar in all of them, so their thresholds (stock-pattern: ascending triangle rejected if upper slope `> 0.1`) are instrument-specific. Normalise by ATR per bar.
- **Breakout:** the textbook confirmation, used by Bulkowski and neurotrader888, is a **close** beyond the neckline / valley / trend line. stock-pattern instead reports a pattern while it is still unbroken (and rejects triangles once any close breaches a line), so it finds Candidates, not confirmed patterns.

## Pattern by pattern

Notation: `P1, P2, …` are consecutive alternating Swing points, oldest first; `tol(x, y)` means |x − y| within the tolerance.

### Double top / double bottom

| Source | Rule (top; bottom is the mirror) | Parameters |
| --- | --- | --- |
| LMW 2000 (memory, unverified here) | `E1` a maximum; `Ea` the highest price after `E1`; `E1` and `Ea` within 1.5 % of their average; `t_a − t_1 > 22` trading days. | 1.5 %, 22 days, inside a 35+3-day window |
| Bulkowski (snippets) | Two peaks, price variation "usually less than 3 %" (5 % seen); valley between them at least about 10 % below the peaks, with exceptions (Adam & Eve page); **confirmed when price closes below the valley low**; unconfirmed twin peaks are not a double top. | ~3 %, ~10 % valley, close-below confirmation |
| stock-pattern `is_double_top` | Points A (peak), B (valley), C (peak), D (last close): `abs(A − C) <= 0.5 × median bar range`, `C − B < 4 × ATR(15)`, volume at C < volume at A, `B < min(A, C)`, `B < D < C` (not yet broken). Rejects the pattern if any later close exceeds C or undercuts B. | 0.5 × bar range, 4 ATR, volume falling |
| zeta-zetra `find_doubles_pattern` | Exactly 5 pivots in the last 25 bars, P2 and P4 the two highest, P2 > P4, `P2 / P4 <= 1.01`. | 25 bars, 1 % |

Repaint: lagged by the right-hand bars of the second peak; confirmed only at the valley-break close. No source agrees on the minimum gap between peaks (LMW 22 days; others none).

### Head and shoulders (and inverse)

| Source | Rule (top) | Parameters |
| --- | --- | --- |
| LMW 2000 (memory) | Five consecutive extrema, `E1` a maximum: `E3 > E1`, `E3 > E5`; `E1` and `E5` within 1.5 % of their average; `E2` and `E4` within 1.5 % of their average. | 1.5 % shoulders, 1.5 % neckline |
| stock-pattern `is_hns` | Points A–F: head `C > max(A, E)`; `max(B, D) < min(A, E)`; `F < E`; `abs(B − D) < median bar range` (flat-ish neckline); `abs(C − E) > 0.6 × median bar range`. | 1 and 0.6 bar ranges |
| neurotrader888 `check_hs_pattern` | Head above both shoulders; **balance**: each shoulder above the midpoint of the other shoulder and its armpit; **symmetry**: shoulder-to-head time on one side ≤ 2.5 × the other; neckline through both armpits (may slope); **confirmed when close < neckline value at bar i** (optional early find at the right shoulder's midpoint). | 2.5 time ratio, `order` |
| zeta-zetra | Head/shoulder ratios `> 1.0002` from 60-bar lookback. | 60 bars |

Repaint: the right shoulder is only fixed once it is confirmed; neurotrader888 sets it to "max price since r_armpit", which keeps moving until the neckline break. Use the break close as the Signal.

### Triangles (symmetrical, ascending, descending)

| Source | Rule | Parameters |
| --- | --- | --- |
| LMW 2000 (memory) | Five extrema, `E1` a maximum, `E1 > E3 > E5` and `E2 < E4` (TTOP; TBOT mirrored). Shape only, no ascending/descending split. | — |
| stock-pattern `is_triangle` + `find_triangles` | Points A–F. Ascending: `abs(A − C)` and `abs(C − E)` ≤ 1 bar range and `B < D < F < E`. Descending: `abs(B − D)` ≤ 1 bar range, `A > C > E > F ≥ D`. Symmetric: `A > C > E` and `B < D < F`, `E > F`. Then: start-time ratio of upper vs lower line ≤ 1.8; lines through A–C and B–D must not have crossed; raw slope limits; no close outside either line yet. | 1 bar range, 1.8, raw slopes 0.1/0.2 |
| zeta-zetra `find_triangle_pattern` | Least-squares lines through pivot highs and lows in 25 bars, at least 3 points, `|r| >= 0.9`; symmetric = lows' slope up and highs' slope down; ascending = highs' slope ≈ 0; descending = lows' slope ≈ 0. | 25 bars, 3 points, r 0.9 |
| Bulkowski (snippets) | Converging trend lines with several touches; breakout is a close outside a line. | touch counts |

### Wedges (rising, falling)

No detector read here implements wedges. LMW define none. The definition reduces to a triangle with **both lines sloping the same way and converging**: rising wedge = upper slope > 0, lower slope > upper slope; falling wedge mirrored.

Bulkowski (snippets, contradictory): the rising-wedge page asks for "at least three distinct minor high or minor low touches" per line; the falling-wedge page asks for five touches in total, 3 on one line and 2 on the other, and gives **3 weeks as the minimum duration, otherwise it is a pennant**. Both pages need checking first-hand before choosing defaults.

### Rectangles and channels

- **LMW rectangle (RTOP/RBOT)**, confirmed by snippet: five consecutive extrema, tops within 0.75 % of their average, bottoms within 0.75 % of their average, lowest top above highest bottom.
- **Channel:** two parallel lines. zeta-zetra's `find_flag_pattern` is really this: lines fitted through ≥ 3 pivot highs and lows in 25 bars, `|r| >= 0.9`, both slopes the same sign, slope ratio between 0.9 and 1.05.

### Flags and pennants

| Source | Rule (bull) | Parameters |
| --- | --- | --- |
| neurotrader888 `check_bull_pattern_trendline` | Pole from a confirmed low to the pole tip; flag = bars since the tip, all below the tip; **flag width ≤ 0.5 × pole width; flag height ≤ 0.75 × pole height** (0.5 in the PIPs variant); support and resistance fitted to the flag; flag lines must not slope up (support slope ≤ 0); **confirmed when close > resistance line**. Flag vs pennant: parallel vs converging lines (PIPs variant checks where the lines intersect). | 0.5 width, 0.75 height, `order ≥ 3` |
| stock-pattern `find_bullish_flag` | New high in the last 7 bars that is also the 30- and 90-bar high, at least 5 bars ago; SMA20 ≥ 1.08 × SMA50; flag low stays above 50 % of the pole. | 7/30/90 bars, SMA20/50, 50 % retrace |
| Bulkowski / common (snippets, unverified) | Short: under about 3 weeks on daily charts, or it becomes a triangle/wedge. | ~3 weeks |

### Summary of parameters a Rule block needs

| Pattern | Swing points | Tolerance | Time | Lines | Confirmation |
| --- | --- | --- | --- | --- | --- |
| Double top/bottom | 3 (+ breakout) | peaks equal; valley depth | min/max gap between peaks | — | close beyond valley |
| Head and shoulders | 5 | shoulders equal; neckline flat or any | shoulder symmetry ratio | neckline (2 points) | close beyond neckline |
| Triangle | 5 | flat side equal (asc/desc) | max length | 2, converging | close outside line |
| Wedge | ≥ 5 | — | min length (3 weeks per Bulkowski on daily) | 2, same sign, converging | close outside line |
| Rectangle/channel | ≥ 4–5 | tops equal, bottoms equal / slopes parallel | — | 2, parallel | close outside |
| Flag/pennant | pole + flag | flag/pole height ratio | flag/pole width ratio | 2, parallel or converging | close outside, in pole direction |

## "Trend"

GLOSSARY.md has no "trend"; Bias deliberately avoids it. Three testable families:

1. **Structure (Dow-style):** uptrend while the last two confirmed swing highs and the last two confirmed swing lows are each higher than the one before (HH + HL); downtrend mirrored; otherwise none. Parameters: Swing point *N*, how many swings (2 is usual), whether a close below the last swing low ends it (that is the MSS/Bias logic already in GLOSSARY.md). Lag: confirmation lag of the Swing points; no repaint if built as above.
2. **Moving average:** close above/below an EMA (e.g. the "EMA 200" Setup already in GLOSSARY.md), or the EMA's slope over *k* bars greater than a threshold. Parameters: length, *k*, threshold (normalise by ATR). Causal, never repaints; depends on enough history for the EMA to settle.
3. **ADX (Wilder, *New Concepts in Technical Trading Systems*, 1978):** strength, not direction. TA-Lib `ta_ADX.c` documents it: +DM/−DM per bar, Wilder smoothing (`today = prev − prev/14 + today_DM1`), DI = DM14/TR14, DX = 100·|−DI − +DI|/(−DI + +DI), ADX = Wilder average of DX. Direction comes from +DI > −DI. The usual "ADX > 25 means trending" threshold is convention; no primary source for 25 was read here. TA-Lib marks ADX as having an **unstable period** (its value depends on where the series starts): its lookback is `2 × period − 1` plus a configurable unstable allowance. Causal, no repaint, but the backtest must warm it up on the same history the live bot sees.

## Recommendations for the Rule blocks

- Make **Swing point** the single source of points for every pattern, with `confirmed_at` stored, and forbid any block from seeing a point before it is confirmed. Don't use centred-window code such as smartmoneyconcepts' `swing_highs_lows` as is.
- Offer generic blocks (Swing sequence with relations, Equal-within-tolerance, Trend line through two Swing points, Close beyond level/line) and ship the named patterns as **presets** over them, so double top, H&S, triangles, wedges, channels and flags share one engine and one set of tests.
- Default tolerances in **ATR of the pattern's timeframe**, with percent as an option for daily charts.
- A pattern Rule block's output is a **Candidate** until its breakout close, then part of a Signal; never earlier.
- Treat trend as three separate blocks (Structure, EMA, ADX); define "Trend" in GLOSSARY.md only if the Structure one is adopted.
- Licences: stock-pattern and precise-patterns are **GPL-3.0**, zeta-zetra has **no licence** (all rights reserved). Reimplement from the definitions above; don't copy code. neurotrader888 and smartmoneyconcepts are MIT.

## Sources

Code read first-hand (shallow clones on 2026-11-11):

- [BennyThadikaran/stock-pattern](https://github.com/BennyThadikaran/stock-pattern) @ `85c710d`, `src/utils.py` (`get_max_min`, `is_double_top`, `is_hns`, `is_triangle`, `find_triangles`, `find_bullish_flag`). GPL-3.0.
- [BennyThadikaran/precise-patterns](https://github.com/BennyThadikaran/precise-patterns) @ `e92e10c`, `precise_patterns/pivots.py` (streaming pivot confirmation; pattern detection still "work in progress"). GPL-3.0.
- [zeta-zetra/chart_patterns](https://github.com/zeta-zetra/chart_patterns) @ `44f8baa`, `chart_patterns/{pivot_points,doubles,triangles,flag,head_and_shoulders}.py`. No licence file.
- [neurotrader888/TechnicalAnalysisAutomation](https://github.com/neurotrader888/TechnicalAnalysisAutomation) @ `da99c20`, `rolling_window.py`, `head_shoulders.py`, `flags_pennants.py`. MIT.
- [joshyattridge/smart-money-concepts](https://github.com/joshyattridge/smart-money-concepts) @ `1b62fd6`, `smartmoneyconcepts/smc.py` `swing_highs_lows`. MIT.
- [TA-Lib `src/ta_func/ta_ADX.c`](https://github.com/TA-Lib/ta-lib/blob/main/src/ta_func/ta_ADX.c), header comment and `TA_ADX_Lookback`.

Not opened in this session (host blocked); cited from search snippets or memory as marked above:

- Lo, A. W., Mamaysky, H., Wang, J. (2000). "Foundations of Technical Analysis: Computational Algorithms, Statistical Inference, and Empirical Implementation." *Journal of Finance* 55(4), 1705–1765. Free copy: [NBER w7613](https://www.nber.org/system/files/working_papers/w7613/w7613.pdf).
- Bulkowski, T. N., [thepatternsite.com](https://www.thepatternsite.com/): [double tops (Eve & Eve)](https://www.thepatternsite.com/eedt.html), [Adam & Eve](https://www.thepatternsite.com/aedt.html), [rising wedge](https://www.thepatternsite.com/risewedge.html), [falling wedge](https://www.thepatternsite.com/fallwedge.html), [pennants](https://www.thepatternsite.com/pennants.html); and his *Encyclopedia of Chart Patterns* (book not consulted).
- Wilder, J. W. (1978). *New Concepts in Technical Trading Systems* (via TA-Lib's description only).

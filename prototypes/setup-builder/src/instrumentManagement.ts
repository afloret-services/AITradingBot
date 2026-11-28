// PROTOTYPE stand-in for the Instrument management module (2026-11-27): the one place that manages
// Instruments (what each is, its category and sub-group, whether 5 years of history exist) and
// Instrument lists (named sets of Instruments). The builder's instrument search only reads it, through
// the interface at the bottom. Its real shape (who creates lists, where it lives, how instruments are
// added) is the map ticket "Instrument management: Instruments and Instrument lists".
// The 158 instruments and the five built-in lists are made up.

export type InstrumentType = 'future' | 'forex' | 'stock' | 'option';
type Item = { v: string; tag: string; name: string; group: string; noHistory?: string };

const rows = (s: string) => s.trim().split('\n').map((l) => l.trim().split('|'));
const FUTURES = rows(`
MNQ|Micro Nasdaq-100 · $2 a point (bars loaded)|Index futures
MES|Micro S&P 500 · $5 a point|Index futures
NQ|E-mini Nasdaq-100 · $20 a point|Index futures
ES|E-mini S&P 500 · $50 a point|Index futures
M2K|Micro Russell 2000 · $5 a point|Index futures|-
RTY|E-mini Russell 2000 · $50 a point|Index futures|-
MYM|Micro Dow · $0.50 a point|Index futures|-
YM|E-mini Dow · $5 a point|Index futures|-
M6E|Micro EUR/USD · $1.25 a tick|Currency futures
6E|Euro FX · $6.25 a tick|Currency futures|-
6B|British pound · $6.25 a tick|Currency futures|-
6J|Japanese yen · $6.25 a tick|Currency futures|-
MGC|Micro gold · $1 a tick|Metals and energy|-
GC|Gold · $10 a tick|Metals and energy|-
MCL|Micro crude oil · $1 a tick|Metals and energy|-
CL|Crude oil · $10 a tick|Metals and energy|-`);
const FOREX = rows(`
EURUSD|Euro / US dollar|Majors
GBPUSD|British pound / US dollar|Majors
USDJPY|US dollar / Japanese yen|Majors
USDCHF|US dollar / Swiss franc|Majors
AUDUSD|Australian dollar / US dollar|Majors
USDCAD|US dollar / Canadian dollar|Majors
NZDUSD|New Zealand dollar / US dollar|Majors
EURGBP|Euro / British pound|Crosses
EURJPY|Euro / Japanese yen|Crosses
GBPJPY|British pound / Japanese yen|Crosses
EURCHF|Euro / Swiss franc|Crosses
AUDJPY|Australian dollar / Japanese yen|Crosses
EURAUD|Euro / Australian dollar|Crosses
GBPCHF|British pound / Swiss franc|Crosses
CADJPY|Canadian dollar / Japanese yen|Crosses
NZDJPY|New Zealand dollar / Japanese yen|Crosses
USDMXN|US dollar / Mexican peso|Exotics
USDZAR|US dollar / South African rand|Exotics
USDSEK|US dollar / Swedish krona|Exotics
USDTRY|US dollar / Turkish lira|Exotics|-`);
const STOCKS = rows(`
SPY|S&P 500 ETF|Index ETFs
QQQ|Nasdaq-100 ETF|Index ETFs
IWM|Russell 2000 ETF|Index ETFs
DIA|Dow Jones ETF|Index ETFs
XLK|Technology sector ETF|Sector ETFs
XLF|Financials sector ETF|Sector ETFs
XLE|Energy sector ETF|Sector ETFs
XLV|Health care sector ETF|Sector ETFs
SMH|Semiconductor ETF|Sector ETFs
AAPL|Apple|Shares
MSFT|Microsoft|Shares
NVDA|NVIDIA|Shares
AMZN|Amazon|Shares
GOOGL|Alphabet|Shares
META|Meta Platforms|Shares
TSLA|Tesla|Shares
AVGO|Broadcom|Shares
AMD|Advanced Micro Devices|Shares
NFLX|Netflix|Shares
ADBE|Adobe|Shares
CRM|Salesforce|Shares
ORCL|Oracle|Shares
INTC|Intel|Shares
QCOM|Qualcomm|Shares
MU|Micron|Shares
TXN|Texas Instruments|Shares
CSCO|Cisco|Shares
IBM|IBM|Shares
JPM|JPMorgan Chase|Shares
BAC|Bank of America|Shares
GS|Goldman Sachs|Shares
MS|Morgan Stanley|Shares
WFC|Wells Fargo|Shares
V|Visa|Shares
MA|Mastercard|Shares
PYPL|PayPal|Shares
XOM|Exxon Mobil|Shares
CVX|Chevron|Shares
COP|ConocoPhillips|Shares
UNH|UnitedHealth|Shares
JNJ|Johnson & Johnson|Shares
LLY|Eli Lilly|Shares
PFE|Pfizer|Shares
MRK|Merck|Shares
ABBV|AbbVie|Shares
KO|Coca-Cola|Shares
PEP|PepsiCo|Shares
MCD|McDonald's|Shares
WMT|Walmart|Shares
COST|Costco|Shares
HD|Home Depot|Shares
NKE|Nike|Shares
DIS|Disney|Shares
BA|Boeing|Shares
CAT|Caterpillar|Shares
GE|GE Aerospace|Shares
UBER|Uber|Shares
COIN|Coinbase|Shares
PLTR|Palantir|Shares
ARM|Arm Holdings · listed 2023|Shares|ipo
RDDT|Reddit · listed 2024|Shares|ipo`);

const toItems = (rs: string[][], opt = false): Item[] => rs.map(([c, name, group, nh]) => ({
  v: opt ? `OPT:${c}` : c, tag: opt ? `${c} opt.` : c, name: opt ? `${c} options · ${name.replace(/ · listed.*/, '')}` : name, group: opt ? `${group.replace(/s$/, '')} options` : group,
  noHistory: nh === 'ipo' ? 'listed less than 5 years ago' : nh === '-' ? 'no 5-year history bought yet' : undefined,
}));
const CATALOG: { key: InstrumentType; label: string; short: string; items: Item[] }[] = [
  { key: 'future', label: 'Futures', short: 'Fut', items: toItems(FUTURES) },
  { key: 'forex', label: 'Forex', short: 'FX', items: toItems(FOREX) },
  { key: 'stock', label: 'Stocks', short: 'Stk', items: toItems(STOCKS) },
  { key: 'option', label: 'Options', short: 'Opt', items: toItems(STOCKS, true) },
];
const LISTS: InstrumentList[] = [
  { id: 'index-futures', name: 'Index futures', owner: 'built-in', instruments: ['MNQ', 'MES', 'NQ', 'ES'] },
  { id: 'micro-futures', name: 'Micro futures', owner: 'built-in', instruments: ['MNQ', 'MES', 'M2K', 'MYM', 'M6E', 'MGC', 'MCL'] },
  { id: 'forex-majors', name: 'Forex majors', owner: 'built-in', instruments: ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD'] },
  { id: 'index-etfs', name: 'Index ETFs', owner: 'built-in', instruments: ['SPY', 'QQQ', 'IWM', 'DIA'] },
  { id: 'mega-cap-tech', name: 'Mega-cap tech', owner: 'built-in', instruments: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA'] },
];

// ---------- the interface the rest of the app uses ----------
export interface Instrument { id: string; type: InstrumentType; typeLabel: string; short: string; tag: string; name: string; group: string; noHistory?: string }
export interface InstrumentList { id: string; name: string; owner: 'built-in' | 'mine'; instruments: string[] }
const INSTRUMENTS: Instrument[] = CATALOG.flatMap((t) => t.items.map(({ v, ...i }) => ({ ...i, id: v, type: t.key, typeLabel: t.label, short: t.short })));
const BY_ID = Object.fromEntries(INSTRUMENTS.map((i) => [i.id, i]));
export const instrumentManagement = {
  /** the categories, in display order */
  categories: () => CATALOG.map(({ key, label, short }) => ({ key, label, short })),
  /** every Instrument, in category then sub-group order (option instruments are their underlying: "OPT:SPY") */
  instruments: (): Instrument[] => INSTRUMENTS,
  instrument: (id: string): Instrument | undefined => BY_ID[id],
  /** the Instrument lists this user can pick from */
  lists: (): InstrumentList[] => LISTS,
  /** what one contract costs to trade (made up for the prototype; who sets them is an open question on the map) */
  costs: (id: string): InstrumentCosts | undefined => COSTS[id],
};
/** commission per contract per side, the tick and its $ value, and the slippage in ticks on fills that are not resting limits */
export interface InstrumentCosts { commission: number; tick: number; tickValue: number; slipTicks: number }
const COSTS: Record<string, InstrumentCosts> = {
  MNQ: { commission: 0.62, tick: 0.25, tickValue: 0.5, slipTicks: 1 },
  MES: { commission: 0.62, tick: 0.25, tickValue: 1.25, slipTicks: 1 },
  NQ: { commission: 2.25, tick: 0.25, tickValue: 5, slipTicks: 1 },
  ES: { commission: 2.25, tick: 0.25, tickValue: 12.5, slipTicks: 1 },
};

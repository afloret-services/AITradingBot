// PROTOTYPE, throwaway. Usage: extract the <script id="sb-logic"> block of strategy-lab.html to logic.js, then
//   node --max-old-space-size=4096 backtest_ema_macd.js ./logic.js mnq_1m_2y.csv 2025-11-10 '[["5m, lunch ok",{"tf":5,"noLunch":false}]]'
// Row G variants over the IN-SAMPLE part of the 2-year file only (the held-out year stays unseen while tuning).
const SB = require(process.argv[2]), fs = require('fs');
const all = SB.parseCsv(fs.readFileSync(process.argv[3], 'utf8')).rows;
const SPLIT = Date.parse((process.argv[4] || '2025-11-10') + 'T00:00:00Z');
const ctx = SB.prepare(all.filter(r => r.t < SPLIT));
const nDays = ctx.days.length;
const sum = a => a.reduce((x, y) => x + y, 0);
console.log(`in-sample: ${nDays} days ${ctx.days[0].td} → ${ctx.days.at(-1).td}`);
const cfgs = JSON.parse(process.argv[5]);
for (const [name, em, extra] of cfgs) {
  for (const view of ['3%', 'every']) {
    const r = SB.runEmaMacd({ ...ctx }, { riskPct: 3, anySize: view === 'every', em, ...(extra || {}) });
    const sigs = r.flatMap(d => d.signals), tr = sigs.filter(s => s.status === 'closed'), Rn = tr.map(s => s.Rnet);
    let cum = 0, pk = 0, dd = 0; for (const x of Rn) { cum += x; pk = Math.max(pk, cum); dd = Math.min(dd, cum - pk); }
    const gp = sum(Rn.filter(x => x > 0)), gl = -sum(Rn.filter(x => x < 0));
    const skip = {}; sigs.filter(s => s.status === 'skipped').forEach(s => skip[s.reason] = (skip[s.reason] || 0) + 1);
    const how = {}; tr.forEach(s => { const k = s.legs.map(l => l.how).join('/'); how[k] = (how[k] || 0) + 1; });
    const risk = tr.map(s => Math.abs(s.entry - s.stop)).sort((a, b) => a - b);
    console.log(`${name.padEnd(28)} ${view.padEnd(5)} Trades ${String(tr.length).padStart(3)} (${Math.round(tr.length * 252 / nDays)}/yr) win ${tr.length ? Math.round(100 * Rn.filter(x => x > 0).length / tr.length) : '-'}% exp ${tr.length ? (sum(Rn) / tr.length).toFixed(2) : '-'}R PF ${gl ? (gp / gl).toFixed(2) : '-'} tot ${sum(Rn).toFixed(1)}R DD ${dd.toFixed(1)}R medStop ${risk.length ? risk[risk.length >> 1] : '-'}pts skipped ${JSON.stringify(skip)}`);
    if (process.env.HOW && view === 'every') console.log('   exits', JSON.stringify(how));
  }
}

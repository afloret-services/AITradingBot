// PROTOTYPE, throwaway. Usage: extract the <script id="sb-logic"> block of strategy-lab.html to logic.js, then
//   node --max-old-space-size=6144 backtest_silver_bullet.js ./logic.js mnq_1m_2y.csv 2025-11-10
// Silver Bullet presets A-F x Bias rules over the IN-SAMPLE part of the 2-year file (held-out year unseen).
const SB = require(process.argv[2]), fs = require('fs');
const all = SB.parseCsv(fs.readFileSync(process.argv[3], 'utf8')).rows;
const SPLIT = Date.parse((process.argv[4] || '2025-11-10') + 'T00:00:00Z');
const ctx = SB.prepare(all.filter(r => r.t < SPLIT));
const nDays = ctx.days.length, sum = a => a.reduce((x, y) => x + y, 0);
const extra = JSON.parse(process.argv[5] || '{}');
console.log(`in-sample: ${nDays} days ${ctx.days[0].td} → ${ctx.days.at(-1).td}; extra ${JSON.stringify(extra)}`);
for (const rule of ['swingLeg', 'swing', 'prevDay']) {
  for (const p of SB.PRESETS) {
    const S = { ...SB.DEFAULTS, riskPct: 3, flatten: '16:55', biasRule: rule, ...p.set, ...extra };
    const rs = SB.run(ctx, S);
    const tr = rs.flatMap(r => r.signals.filter(s => s.status === 'closed'));
    // costs: $0.62 per contract per side, in R of each Trade's own planned risk
    const Rn = tr.map(s => s.R - (2 * 0.62 * s.contracts) / (Math.abs(s.entry - s.stop) * s.contracts * 2));
    let cum = 0, pk = 0, dd = 0; for (const x of Rn) { cum += x; pk = Math.max(pk, cum); dd = Math.min(dd, cum - pk); }
    const gp = sum(Rn.filter(x => x > 0)), gl = -sum(Rn.filter(x => x < 0));
    const days = rs.filter(r => r.signals.some(s => s.status === "closed")).length, bias = rs.filter(r => r.bias).length;
    console.log(`${rule.padEnd(8)} ${p.name.slice(0, 38).padEnd(38)} Bias days ${String(Math.round(100 * bias / nDays)).padStart(3)}% | Trades ${String(tr.length).padStart(3)} (${Math.round(tr.length * 252 / nDays)}/yr, ${Math.round(100 * days / nDays)}% of days) win ${tr.length ? Math.round(100 * Rn.filter(x => x > 0).length / tr.length) : '-'}% exp ${tr.length ? (sum(Rn) / tr.length).toFixed(2) : '-'}R PF ${gl ? (gp / gl).toFixed(2) : '-'} tot ${sum(Rn).toFixed(1)}R DD ${dd.toFixed(1)}R`);
  }
}

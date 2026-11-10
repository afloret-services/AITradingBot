// PROTOTYPE, throwaway. Usage: extract the <script id="sb-logic"> block of strategy-lab.html to logic.js, then
//   node --max-old-space-size=4096 backtest_published.js ./logic.js mnq_1m_2y.csv 2025-11-10 results.json
// Rows I, J, L over the 2-year IBKR file: in-sample vs held-out, both views, risk 2-5%, 1 and 2 ticks of slippage.
const SB = require(process.argv[2]), fs = require('fs');
const ctx = SB.prepare(SB.parseCsv(fs.readFileSync(process.argv[3], 'utf8')).rows);
const SPLIT = process.argv[4] || '2025-11-10'; // held-out = the last 12 months
const sum = a => a.reduce((x, y) => x + y, 0);
const days = ctx.days.map(d => d.td);
const nIn = days.filter(d => d < SPLIT).length, nOut = days.filter(d => d >= SPLIT).length;
console.log(`days ${days.length} (${days[0]} → ${days.at(-1)}); in-sample ${nIn} days < ${SPLIT}, held-out ${nOut} days`);

function stats(trades, nDays) {
  const Rn = trades.map(s => s.Rnet);
  let cum = 0, peak = 0, ddR = 0; for (const r of Rn) { cum += r; peak = Math.max(peak, cum); ddR = Math.min(ddR, cum - peak); }
  let eq = 0, pk = 0, ddU = 0; for (const s of trades) { eq += s.usdNet; pk = Math.max(pk, eq); ddU = Math.min(ddU, eq - pk); }
  const gp = sum(Rn.filter(x => x > 0)), gl = -sum(Rn.filter(x => x < 0));
  const tradeDays = new Set(trades.map(s => s.td)).size;
  return {
    n: trades.length, perYear: Math.round(trades.length * 252 / nDays),
    win: trades.length ? Math.round(100 * Rn.filter(x => x > 0).length / trades.length) : null,
    exp: trades.length ? sum(Rn) / trades.length : null, pf: gl ? gp / gl : null, totR: sum(Rn), ddR,
    usd: sum(trades.map(s => s.usdNet)), ddUsd: ddU, dayPct: Math.round(100 * tradeDays / nDays),
  };
}
const f = (x, d = 2) => x == null ? '–' : (x >= 0 ? '+' : '') + x.toFixed(d);
const out = [];
for (const id of ['orb', 'noise', 'gap']) {
  for (const view of ['account', 'every']) {
    for (const rp of view === 'every' ? [2] : [2, 3, 4, 5]) {
      for (const slip of [1, 2]) {
        const r = SB.runPublished(ctx, id, { riskPct: rp, anySize: view === 'every', slipTicks: slip });
        const sigs = r.flatMap(d => d.signals), tr = sigs.filter(s => s.status === 'closed');
        const A = stats(tr.filter(s => s.td < SPLIT), nIn), O = stats(tr.filter(s => s.td >= SPLIT), nOut);
        out.push({ id, view, rp, slip, A, O, signals: sigs.length, skipped: sigs.filter(s => s.status === 'skipped').length });
        console.log([id.padEnd(5), view === 'every' ? '1 MNQ every Signal' : `$5,000 at ${rp}%`, `slip ${slip}`,
          `| IN  n ${A.n} (${A.perYear}/yr) win ${A.win}% exp ${f(A.exp)}R PF ${f(A.pf)} tot ${f(A.totR, 1)}R ddR ${f(A.ddR, 1)} $${A.usd.toFixed(0)} dd$ ${A.ddUsd.toFixed(0)}`,
          `| OUT n ${O.n} (${O.perYear}/yr) win ${O.win}% exp ${f(O.exp)}R PF ${f(O.pf)} tot ${f(O.totR, 1)}R ddR ${f(O.ddR, 1)} $${O.usd.toFixed(0)} dd$ ${O.ddUsd.toFixed(0)}`,
          `| skipped ${sigs.filter(s => s.status === 'skipped').length}/${sigs.length}`].join(' '));
      }
    }
  }
}
fs.writeFileSync(process.argv[5] || 'full_run.json', JSON.stringify(out, null, 1));

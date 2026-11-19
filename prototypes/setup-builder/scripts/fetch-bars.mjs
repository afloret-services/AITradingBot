// PROTOTYPE: copies the MNQ 1m bars from the prototype/strategy-lab branch into public/data.
// The bars are never committed on this branch (see "Remove the committed MNQ bar data from the public repo").
import { execSync } from 'node:child_process';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
const out = new URL('../public/data/mnq_1m.csv', import.meta.url);
if (existsSync(out)) process.exit(0);
mkdirSync(new URL('../public/data/', import.meta.url), { recursive: true });
try { execSync('git fetch -q origin prototype/strategy-lab', { stdio: 'ignore' }); } catch {}
const csv = execSync('git show origin/prototype/strategy-lab:prototypes/strategy-lab/mnq_1m.csv', { maxBuffer: 1 << 28 });
writeFileSync(out, csv);
console.log('bars: wrote public/data/mnq_1m.csv');

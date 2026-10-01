// Compare change counts per bill between two git revisions of data/: node test/cmp.mjs <revA> <revB>
import { execFileSync } from 'node:child_process';
const [a, b] = process.argv.slice(2);
const load = rev => Object.fromEntries(execFileSync('git', ['ls-tree', '--name-only', rev, 'data/bills/']).toString().trim().split('\n')
  .map(f => [f, JSON.parse(execFileSync('git', ['show', `${rev}:${f}`]).toString())]));
const A = load(a), B = load(b);
for (const f of Object.keys(A)) {
  const x = A[f].changes.map(c => c.art).join(','), y = B[f]?.changes.map(c => c.art).join(',');
  if (x !== y) console.log(A[f].siglaTipo, A[f].numero, A[f].id, '\n  ', x, '\n  ', y);
}

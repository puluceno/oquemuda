// Quality report over data/bills: how much did the comparison actually find?
import { readdirSync, readFileSync } from 'node:fs';
const bs = readdirSync('data/bills').map(f => JSON.parse(readFileSync(`data/bills/${f}`, 'utf8')));
const st = {}, missing = new Set(), none = [];
for (const b of bs) {
  if (!b.changes.length) none.push(`${b.siglaTipo} ${b.numero} ${b.id} | ${b.ementa.slice(0, 90)}`);
  for (const c of b.changes) st[c.status] = (st[c.status] || 0) + 1;
  for (const l of b.laws) if (!l.url) missing.add(l.key);
}
console.log('bills', bs.length, 'without changes', none.length, 'statuses', st);
console.log('laws not found on Planalto', [...missing]);
console.log(none.join('\n'));

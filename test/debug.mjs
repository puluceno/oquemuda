// Debug one bill: node test/debug.mjs <camara id>
import { billDetail, pdfText } from '../src/sources.js';
import { cleanBill, parseBill } from '../src/parse.js';
const d = await billDetail(process.argv[2]);
const raw = await pdfText(d.urlInteiroTeor);
const t = cleanBill(raw);
console.log(d.siglaTipo, d.numero, d.ementa, '\n---\n' + t.slice(0, +(process.argv[3] || 1500)));
const p = parseBill(raw);
console.log('---\nlaws', p.laws.map(l => l.key), 'blocks', p.blocks.map(b => `${b.law}:${b.art}`));

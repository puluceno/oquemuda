// Daily job: fetch new amending bills, compare with current law, write data/ and site/.
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, rmSync, cpSync } from 'node:fs';
import { listBills, billDetail, pdfText, lawHtml } from './src/sources.js';
import { parseBill, parseLaw, compare } from './src/parse.js';
import { billPage, indexPage, lawPage, aboutPage, proPage, privacyPage, feed, NICKS, lawName, billTitle } from './src/render.js';

const DAYS = +(process.env.DAYS || 3);
const BASE = process.env.BASE_URL || 'https://puluceno.github.io/oquemuda/';
const AMENDS = /\b(altera|acrescenta|acresce|modifica|revoga|d[áa] nova reda|inclui)/i;
mkdirSync('data/bills', { recursive: true });
mkdirSync('.cache/bills', { recursive: true });

const lawCache = new Map();
async function law(ref) {
  if (!lawCache.has(ref.key)) {
    const h = await lawHtml(ref);
    lawCache.set(ref.key, h && { url: h.url, arts: parseLaw(h.html) });
  }
  return lawCache.get(ref.key);
}

async function processBill(p) {
  const d = await billDetail(p.id);
  if (!d.urlInteiroTeor) return null;
  const cached = `.cache/bills/${p.id}.txt`;
  const text = existsSync(cached) ? readFileSync(cached, 'utf8') : await pdfText(d.urlInteiroTeor);
  writeFileSync(cached, text);
  const parsed = parseBill(text);
  const changes = [];
  const laws = [];
  for (const ref of parsed.laws) {
    const blocks = parsed.blocks.filter(b => b.law === ref.key);
    if (!blocks.length) continue;
    const l = await law(ref);
    laws.push({ ...ref, url: l?.url || null });
    for (const b of blocks) changes.push({ law: ref.key, ...compare(l?.arts || null, b) });
  }
  return {
    id: d.id, siglaTipo: d.siglaTipo, numero: d.numero, ano: d.ano, data: d.dataApresentacao,
    ementa: d.ementa, autores: d.autores, url: d.urlInteiroTeor,
    laws, changes, revocations: parsed.revocations,
  };
}

const since = new Date(Date.now() - DAYS * 864e5).toISOString().slice(0, 10);
const list = (await listBills(since)).filter(p => AMENDS.test(p.ementa));
// REPARSE=1: recompute every stored bill with the current parser
if (process.env.REPARSE) for (const f of readdirSync('data/bills')) {
  const old = JSON.parse(readFileSync(`data/bills/${f}`, 'utf8'));
  if (!list.some(p => p.id === old.id)) list.push(old);
}
let added = 0, failed = 0;
const newUrls = [], newBills = [];
for (const p of list) {
  const f = `data/bills/${p.id}.json`;
  if (existsSync(f) && !process.env.REPARSE) continue;
  try {
    const rec = await processBill(p);
    if (rec) {
      writeFileSync(f, JSON.stringify(rec)); added++;
      if (rec.changes.length) {
        newUrls.push(`pl/${rec.id}.html`, ...rec.laws.map(l => `lei/${l.key}.html`));
        newBills.push(rec);
      }
    }
  } catch (e) {
    failed++;
    console.error(`bill ${p.id} (${p.siglaTipo} ${p.numero}/${p.ano}): ${e.message}`);
  }
}
console.log(`since ${since}: ${list.length} amending bills, ${added} new, ${failed} failed`);

// render everything from data/
const bills = readdirSync('data/bills').map(f => JSON.parse(readFileSync(`data/bills/${f}`, 'utf8')))
  .sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id);
const laws = {};
const count = {};
for (const b of bills) for (const l of b.laws) {
  laws[l.key] = { ...laws[l.key], ...l, nick: NICKS[l.key] || l.nick || laws[l.key]?.nick || null, url: l.url || laws[l.key]?.url || null };
  count[l.key] = (count[l.key] || 0) + 1;
}
const top = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 15);

rmSync('site', { recursive: true, force: true });
mkdirSync('site/pl', { recursive: true });
mkdirSync('site/lei', { recursive: true });
for (const b of bills) writeFileSync(`site/pl/${b.id}.html`, billPage(b, laws));
for (const k of Object.keys(laws)) writeFileSync(`site/lei/${k}.html`, lawPage(laws[k], bills.filter(b => b.laws.some(l => l.key === k)), laws));
writeFileSync('site/index.html', indexPage(bills.filter(b => b.changes.length), laws, top));
writeFileSync('site/sobre.html', aboutPage());
writeFileSync('site/pro.html', proPage());
writeFileSync('site/privacidade.html', privacyPage());
writeFileSync('site/leis.json', JSON.stringify(Object.fromEntries(Object.entries(laws).map(([k, l]) => [k, lawName(l)]))));
writeFileSync('site/feed.xml', feed(bills.filter(b => b.changes.length), BASE));
writeFileSync('site/robots.txt', `User-agent: *\nAllow: /\nSitemap: ${BASE}sitemap.xml\n`);
writeFileSync('site/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['', 'sobre.html', 'tributos.html', 'energia.html', ...bills.map(b => `pl/${b.id}.html`), ...Object.keys(laws).map(k => `lei/${k}.html`)].map(u => `<url><loc>${BASE}${u}</loc></url>`).join('')}</urlset>`);
if (existsSync('static')) cpSync('static', 'site', { recursive: true });
writeFileSync('.cache/new-urls.json', JSON.stringify(process.env.REPARSE ? [] : [...new Set(['', ...newUrls])].map(u => BASE + u)));
writeFileSync('.cache/new-bills.json', JSON.stringify(process.env.REPARSE ? [] : newBills.map(b => ({
  id: b.id, title: billTitle(b), ementa: b.ementa,
  laws: b.laws.filter(l => b.changes.some(c => c.law === l.key)).map(l => ({ key: l.key, name: lawName(laws[l.key] || l) })),
})))); 
console.log(`site: ${bills.length} bills, ${Object.keys(laws).length} laws`);
if (failed > list.length / 2 && list.length > 4) process.exit(1);

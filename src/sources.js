// Network: Câmara open-data API (bills), bill PDFs, Planalto (current law text).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const UA = 'Mozilla/5.0 (compatible; oquemuda/1.0; +https://github.com/puluceno/oquemuda)';
const API = 'https://dadosabertos.camara.leg.br/api/v2';
const CACHE = '.cache/laws';
const WEEK = 7 * 864e5;

async function get(url, accept = 'application/json', tries = 3) {
  for (let i = 1; ; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, accept }, signal: AbortSignal.timeout(60_000) });
      if (r.status >= 500 && i < tries) throw new Error(`HTTP ${r.status}`);
      return r;
    } catch (e) {
      if (i >= tries) throw e;
      await new Promise(res => setTimeout(res, 2000 * i));
    }
  }
}

/** Bills (PL, PLP) presented since `since` (YYYY-MM-DD). */
export async function listBills(since) {
  const out = [];
  let url = `${API}/proposicoes?siglaTipo=PL,PLP&dataApresentacaoInicio=${since}&itens=100&ordem=ASC&ordenarPor=id`;
  while (url) {
    const j = await (await get(url)).json();
    out.push(...j.dados);
    url = j.links.find(l => l.rel === 'next')?.href;
  }
  return out;
}

export async function billDetail(id) {
  const d = (await (await get(`${API}/proposicoes/${id}`)).json()).dados;
  const a = (await (await get(`${API}/proposicoes/${id}/autores`)).json()).dados;
  return { ...d, autores: a.map(x => x.nome) };
}

export async function pdfText(url) {
  const r = await get(url, 'application/pdf');
  if (!r.ok) throw new Error(`PDF HTTP ${r.status}`);
  const f = join(tmpdir(), `oquemuda-${process.pid}.pdf`);
  writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  try { return execFileSync('pdftotext', ['-enc', 'UTF-8', f, '-'], { maxBuffer: 64 << 20 }).toString('utf8'); }
  finally { rmSync(f, { force: true }); }
}

const PERIODS = [[2023, 2026], [2019, 2022], [2015, 2018], [2011, 2014], [2007, 2010], [2004, 2006]];

export function planaltoCandidates({ kind, num, year }) {
  const n = num, dotted = Number(num).toLocaleString('de-DE'), pad = num.padStart(4, '0');
  if (kind === 'lcp') return [`leis/lcp/lcp${n}compilado.htm`, `leis/lcp/lcp${n}.htm`];
  if (kind === 'del') return [`decreto-lei/del${n}compilado.htm`, `decreto-lei/del${n}.htm`, `decreto-lei/del${n}compilada.htm`, `decreto-lei/del${pad}.htm`,
    ...planaltoCandidates({ kind: 'lei', num, year })];
  const p = PERIODS.find(([a, b]) => year >= a && year <= b);
  if (p) return [`_ato${p[0]}-${p[1]}/${year}/lei/l${n}.htm`, `_ato${p[0]}-${p[1]}/${year}/lei/l${dotted}.htm`, `_ato${p[0]}-${p[1]}/${year}/lei/l${n}compilado.htm`];
  const decade = year <= 1969 ? '1950-1969' : year <= 1979 ? '1970-1979' : year <= 1988 ? '1980-1988' : null;
  return [`leis/l${n}compilado.htm`, `leis/l${n}compilada.htm`, `leis/l${n}.htm`,
    ...(decade ? [`leis/${decade}/l${n}.htm`, `leis/${decade}/l${n}compilado.htm`] : []),
    ...(year >= 2001 ? [`leis/${year}/l${n}compilada.htm`, `leis/${year}/l${n}compilado.htm`, `leis/${year}/l${n}.htm`, `leis/${year}/l${dotted}.htm`, `leis/leis_${year}/l${n}.htm`] : [])];
}

function decode(buf, type) {
  if (buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder('utf-16le').decode(buf);
  if (buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder('utf-16be').decode(buf);
  if (/utf-?8/i.test(type)) return new TextDecoder('utf-8').decode(buf);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch { return new TextDecoder('windows-1252').decode(buf); }
}

/** Current law text from Planalto (cached a week). Returns { url, html } or null. */
export async function lawHtml(ref) {
  mkdirSync(CACHE, { recursive: true });
  const f = join(CACHE, `${ref.key}.json`);
  if (existsSync(f) && Date.now() - statSync(f).mtimeMs < WEEK) return JSON.parse(readFileSync(f, 'utf8'));
  for (const c of planaltoCandidates(ref)) {
    const url = `https://www.planalto.gov.br/ccivil_03/${c}`;
    const r = await get(url, 'text/html');
    if (!r.ok) continue;
    const html = decode(Buffer.from(await r.arrayBuffer()), r.headers.get('content-type') || '');
    if (/Art\.?(\s|&nbsp;|<[^>]+>)*1/.test(html)) {
      const found = { url: r.url, html };
      writeFileSync(f, JSON.stringify(found));
      return found;
    }
  }
  return null;
}

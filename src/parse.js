// Pure text logic: bill text -> amendment blocks, law HTML -> articles, merge, word diff.

const ROMAN = { I: 1, V: 5, X: 10, L: 50, C: 100 };
const roman = s => [...s].reduce((n, c, i, a) => (ROMAN[c] < (ROMAN[a[i + 1]] || 0) ? n - ROMAN[c] : n + ROMAN[c]), 0);
const MONTHS = 'janeiro fevereiro março abril maio junho julho agosto setembro outubro novembro dezembro'.split(' ');

export const norm = s => s
  .replace(/[\u00a0\t\r\n]+/g, ' ')
  .replace(/[“”"]/g, '"').replace(/[‘’]/g, "'")
  .replace(/\s*[—–]\s*|\s+-\s+/g, ' – ')
  .replace(/(\d)\s*[°o](?=[\s.,;:)-]|$)/g, '$1º')
  .replace(/\s+([.,;:])/g, '$1')
  .replace(/\s{2,}/g, ' ').trim();

/** Bill PDF text -> clean operative text (from "decreta:" to the justification). */
export function cleanBill(raw) {
  const lines = raw.replace(/\f/g, '\n').split('\n')
    .map(l => l.replace(/\s*C[âa]mara dos Deputados\s*[|,–-]\s*Anexo.*$/i, ''))
    .filter(l => !/^\s*(Apresenta..o:|PL n\.|PLP n\.|\*CD\d+\*|Para verificar as? assinaturas?|Assinado eletronicamente|CÂMARA DOS DEPUTADOS|Gabinete d[oa]|Deputad[oa] Federal|\d+\s*$)/i.test(l));
  const s = lines.join('\n');
  const a = s.search(/decreta\s*:/i);
  const b = s.search(/\n\s*JUSTIFICA[ÇC][ÃA]O/i);
  return s.slice(a < 0 ? 0 : a, b > a ? b : undefined);
}

const LAW_RE = /(Lei Complementar|Decreto-?\s?Lei|Lei)\s+n[º°o.]*\s*([\d.]+)\s*,?\s*de\s+(\d{1,2})[º°o]?\s+de\s+([a-zç]+)\s+de\s+(\d{4})(\s*\(([^)]{3,80})\))?/gi;

export function lawRefs(text) {
  return [...text.matchAll(LAW_RE)].map(m => {
    const kind = /complementar/i.test(m[1]) ? 'lcp' : /decreto/i.test(m[1]) ? 'del' : 'lei';
    const num = m[2].replace(/\./g, '');
    const month = MONTHS.indexOf(m[4].toLowerCase()) + 1;
    return { key: `${kind}-${num}-${m[5]}`, kind, num, year: +m[5], month, nick: m[7]?.trim() || null };
  });
}

/**
 * Find quoted article blocks (“Art. N ... ”(NR)) and attach the law they amend.
 * Returns { blocks: [{law, art, text}], revocations: [text], laws: [ref] }
 */
export function parseBill(raw) {
  const t = cleanBill(raw);
  const blocks = [];
  // a quote may open on a heading line ("“Roubo", "“CAPÍTULO IX") before the article itself
  const startRe = /["“]\s*(?:[^"“”\n]{1,160}\n\s*){0,4}(Art\.?\s*(\d{1,3}(?:\.\d{3})+|\d+)\s*[º°o]?\s*(-\s*[A-Z]{1,2})?)/g;
  const starts = [...t.matchAll(startRe)].filter(s => !/\bArt\./.test(s[0].slice(0, s[0].length - s[1].length)));
  let law = null;
  let prevEnd = 0;
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i];
    if (s.index < prevEnd) continue;
    const instr = t.slice(prevEnd, s.index);
    const refs = lawRefs(instr);
    if (refs.length) law = refs[0];
    const limit = i + 1 < starts.length ? starts[i + 1].index : t.length;
    const artAt = s.index + s[0].length - s[1].length;
    let body = t.slice(artAt, limit);
    // a bill article after the block ends it: closing quote + optional (NR), then "Art. N" unquoted
    const close = body.search(/["”]\s*(\(\s*(NR|AC)\s*\))?\s*(?=$|[.…]{3,}|Art\.\s*\d+\s*[º°o]?\.?\s+[A-ZÉÁ]|["“]?\s*$)/);
    const tail = body.search(/(?:["”]\s*)?\(\s*NR\s*\)|["”]\s*(?=Art\.\s*\d+\s*[º°o]?\.?\s+[A-ZÉÁ])/);
    const cut = [close, tail].filter(x => x >= 0);
    if (cut.length) body = body.slice(0, Math.min(...cut));
    prevEnd = artAt + body.length;
    const art = s[2].replace(/\./g, '') + (s[3] ? '-' + s[3].replace(/[-\s]/g, '') : '');
    if (law) blocks.push({ law: law.key, art, text: body.trim() });
  }
  const revocations = [...t.matchAll(/(?:^|\n|\.\s)(Art\.\s*\d+\s*[º°o]?\.?\s+(?:Fica(?:m)? revogad|Revoga)[^\n]*?(?:\.\s*(?=Art\.)|$))/gim)]
    .map(m => norm(m[1]));
  const laws = [...new Map(lawRefs(t).map(r => [r.key, r])).values()];
  return { blocks, revocations, laws };
}

/** Split one article's text into labelled devices. Labels: "caput", "I", "I a", "§1", "§1 I", "pu". */
export function devices(text) {
  const s = norm(text);
  const B = '(?<=^|[.;:…"]\\s*|[;,]\\s*(?:e|ou)\\s+)';
  const re = new RegExp(
    `${B}(?:(Parágrafo único)\\.?|§\\s*(\\d+)\\s*º?(?:\\s*-\\s*([A-Z]))?\\.?|([IVXLC]+)(?:\\s*-\\s*([A-Z]))?\\s*–|([a-z])(?:\\s*-\\s*([A-Z]))?\\))(?:\\s|(?=[.…]))`,
    'g');
  const out = [];
  let para = '', inc = '';
  let last = 0, label = 'caput';
  const push = (end) => out.push({ label, text: s.slice(last, end).trim().replace(/(\S)\s*[.…]{4,}[\s.…"]*$/, '$1') });
  for (const m of s.matchAll(re)) {
    push(m.index);
    if (m[1]) { para = 'pu'; inc = ''; label = 'pu'; }
    else if (m[2]) { para = '§' + m[2] + (m[3] ? '-' + m[3] : ''); inc = ''; label = para; }
    else if (m[4]) { inc = m[4] + (m[5] ? '-' + m[5] : ''); label = (para ? para + ' ' : '') + inc; }
    else { label = [para, inc, m[6] + (m[7] ? '-' + m[7] : '')].filter(Boolean).join(' '); }
    last = m.index;
  }
  push(s.length);
  return out.filter(d => d.text || d.label === 'caput')
    .map(d => ({ ...d, keep: /^[\s.…_"]*$/.test(d.text.replace(/^(Art\.?\s*[\d.]+\s*º?(-[A-Z]+)?\.?|Parágrafo único\.?|§\s*\d+\s*º?(-[A-Z])?\.?|[IVXLC]+(-[A-Z])?\s*–|[a-z]\))/, '')) }));
}

const ord = part => {
  const [base, suf] = part.replace('§', '').split('-');
  const n = base === 'pu' ? 1 : /^[IVXLC]+$/.test(base) ? roman(base) : /^\d+$/.test(base) ? +base : base.charCodeAt(0);
  return n + (suf ? (suf.charCodeAt(0) - 64) / 100 : 0);
};
const parentOf = l => l.split(' ').slice(0, -1).join(' ');
const kindOf = l => { const p = l.split(' ').pop(); return p.startsWith('§') || p === 'pu' ? 'p' : /^[IVXLC]/.test(p) ? 'i' : 'a'; };

/** Apply a proposed article (with "....." placeholders) onto the current one. Returns ops per device. */
export function merge(current, proposed) {
  const res = current.map(d => ({ label: d.label, old: d.text, text: d.text }));
  for (const d of proposed) {
    if (d.keep) continue;
    const at = res.findIndex(r => r.label === d.label);
    if (at >= 0) { res[at].text = d.text; continue; }
    const par = d.label === 'caput' ? null : parentOf(d.label);
    const k = kindOf(d.label);
    let pos = -1;
    res.forEach((r, i) => {
      if (r.label === 'caput') { if (pos < 0) pos = i; return; }
      const sameLevel = parentOf(r.label) === par && kindOf(r.label) === k;
      const isParent = par && r.label === par;
      const childOfLower = res.slice(0, i).some(x => parentOf(x.label) === par && kindOf(x.label) === k && ord(x.label.split(' ').pop()) < ord(d.label.split(' ').pop()) && r.label.startsWith(x.label + ' '));
      const lowerSib = sameLevel && ord(r.label.split(' ').pop()) < ord(d.label.split(' ').pop());
      const caputChild = !par && k === 'p' && kindOf(r.label) !== 'p' && !r.label.startsWith('§') && !r.label.startsWith('pu');
      if (isParent || lowerSib || childOfLower || caputChild) pos = i;
    });
    res.splice(pos + 1, 0, { label: d.label, old: null, text: d.text });
  }
  return res;
}

const tok = s => s.match(/\s+|[\p{L}\p{N}º]+|[^\s\p{L}\p{N}]/gu) || [];

/** Word-level diff -> [[op, text]] with op in '=', '-', '+'. */
export function wordDiff(a, b) {
  const x = tok(a), y = tok(b);
  if (x.length * y.length > 4e6) return [['-', a], ['+', b]];
  const n = x.length, m = y.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  const add = (op, t) => (out.length && out.at(-1)[0] === op ? (out.at(-1)[1] += t) : out.push([op, t]));
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) { add('=', x[i]); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) add('-', x[i++]);
    else add('+', y[j++]);
  }
  while (i < n) add('-', x[i++]);
  while (j < m) add('+', y[j++]);
  return readable(out);
}

/** Merge edits separated by tiny unchanged bits ("de", " ") into one removed block + one added block. */
function readable(ops) {
  const out = [];
  let del = '', ins = '';
  const flush = () => { if (del) out.push(['-', del]); if (ins) out.push(['+', ins]); del = ins = ''; };
  ops.forEach(([op, t], k) => {
    const between = k > 0 && k < ops.length - 1 && (del || ins);
    if (op === '=' && between && t.replace(/\s+/g, ' ').length <= 4) { del += t; ins += t; return; }
    if (op === '=') { flush(); out.push([op, t]); return; }
    if (op === '-') del += t; else ins += t;
  });
  flush();
  return out;
}

const ENT = { nbsp: ' ', amp: '&', quot: '"', lt: '<', gt: '>', ordm: 'º', ordf: 'ª', sect: '§', deg: '°', ndash: '–', mdash: '—' };

/** Planalto law HTML (already decoded to a string) -> Map(articleKey -> text). */
export function parseLaw(html) {
  const text = html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(strike|del)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<s>([\s\S]*?)<\/s>/gi, (m, c) => (c.replace(/<[^>]+>/g, '').trim().length <= 2 ? c : ''))
    .replace(/<\/?(p|br|div|tr|h\d)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m)
    .replace(/\((?:Redação dad|Incluíd|Incluid|Acrescid|Renumerad|Revogad|Vide|Vigência|Regulamento|Produção de efeito|Promulgação|Expressão)[^)]*\)/gi, '')
    .replace(/^\s*(Vigência|Regulamento|Vide [^\n]*|Mensagem de veto)\s*$/gim, '')
    .replace(/[ \t\u00a0]+/g, ' ');
  const arts = new Map();
  const re = /(?:^|\n)\s*Art\.\s*(\d{1,3}(?:\.\d{3})+|\d+)\s*[º°o]?\s*(?:-\s*([A-Z]{1,2}))?\s*[.–-]?\s/g;
  const ms = [...text.matchAll(re)];
  ms.forEach((m, i) => {
    const key = m[1].replace(/\./g, '') + (m[2] ? '-' + m[2] : '');
    let body = text.slice(m.index, i + 1 < ms.length ? ms[i + 1].index : undefined);
    body = body.split(/\n\s*(?:TÍTULO|CAPÍTULO|Seção|SEÇÃO|Subseção|LIVRO|PARTE)\b/)[0];
    body = body.split(/\n\s*(?:Brasília|Rio de Janeiro),\s*\d/)[0];
    if (!arts.has(key)) arts.set(key, body.replace(/\s*\n\s*/g, '\n').trim());
  });
  return arts;
}

/** Compare one amendment block against the current law. */
export function compare(lawArts, block) {
  const proposed = devices('Art. ' + block.text.replace(/^Art\.?\s*/i, ''));
  const cur = lawArts?.get(block.art);
  if (!cur) return { art: block.art, status: lawArts ? 'new' : 'nolaw', devices: proposed.filter(d => !d.keep).map(d => ({ label: d.label, op: '+', diff: [['+', d.text]] })) };
  const merged = merge(devices(cur), proposed);
  return {
    art: block.art, status: 'changed',
    devices: merged.map(d => {
      if (d.old === null) return { label: d.label, op: '+', diff: [['+', d.text]] };
      if (norm(d.old) === norm(d.text)) return { label: d.label, op: '=', diff: [['=', d.old]] };
      return { label: d.label, op: '~', diff: wordDiff(norm(d.old), norm(d.text)) };
    }),
  };
}

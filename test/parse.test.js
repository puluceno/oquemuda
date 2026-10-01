import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseBill, parseLaw, compare, devices, merge, wordDiff, lawRefs } from '../src/parse.js';
import { billPage, esc } from '../src/render.js';
import { planaltoCandidates } from '../src/sources.js';

const fx = f => readFileSync(new URL(`fixtures/${f}`, import.meta.url));
const law = f => parseLaw(new TextDecoder('windows-1252').decode(fx(f)));

test('law references, including nicknames, DecretoLei without hyphen and dotted years', () => {
  const r = lawRefs('altera o DecretoLei nº 2.848, de 7 de dezembro de 1940 (Código Penal), e a Lei nº 7210, de 11 de julho de 1984');
  assert.deepEqual(r.map(x => [x.key, x.nick]), [['del-2848-1940', 'Código Penal'], ['lei-7210-1984', null]]);
});

test('inserted inciso lands between XII and the parágrafo único (Lei Geral de Telecomunicações)', () => {
  const b = parseBill(fx('5463.txt').toString());
  assert.deepEqual(b.blocks.map(x => `${x.law}:${x.art}`), ['lei-9472-1997:3', 'lei-9472-1997:62-A']);
  const c = compare(law('l9472.htm'), b.blocks[0]);
  assert.equal(c.status, 'changed');
  const ops = c.devices.map(d => d.op + d.label);
  assert.deepEqual(ops.slice(-3), ['=XII', '+XIII', '=pu']);
  assert.equal(compare(law('l9472.htm'), b.blocks[1]).status, 'new');
});

test('thousand-separated article numbers and dotted placeholders (CPC bill)', () => {
  const b = parseBill(fx('5476.txt').toString());
  assert.deepEqual(b.blocks.map(x => x.art), ['300-A', '489', '496', '950-A', '1019-A']);
  assert.ok(b.blocks.every(x => x.law === 'lei-13105-2015'));
});

test('several laws in one bill; "; e" splits incisos; dots mean keep', () => {
  const b = parseBill(fx('5489.txt').toString());
  assert.deepEqual([...new Set(b.blocks.map(x => x.law))], ['lei-8383-1991', 'lei-8989-1995', 'lei-14947-2024']);
  const pu = devices(b.blocks.find(x => x.art === '2').text).map(d => d.label);
  assert.deepEqual(pu, ['caput', 'pu', 'pu I', 'pu II']);
  assert.ok(devices(b.blocks.find(x => x.art === '4').text).find(d => d.label === 'caput').keep);
});

test('full rewrite of an existing article is a word diff (Lei 14.852)', () => {
  const b = parseBill(fx('5501.txt').toString());
  const c = compare(law('l14852.htm'), b.blocks[0]);
  const caput = c.devices.find(d => d.label === 'caput');
  assert.equal(caput.op, '~');
  assert.ok(caput.diff.some(([o, t]) => o === '-' && /espaços formativos/.test(t)));
  assert.ok(caput.diff.some(([o, t]) => o === '+' && /capacitação/.test(t)));
});

test('merge keeps order: new § goes after the caput incisos', () => {
  const cur = devices('Art. 5º Texto: I – um; II – dois. § 1º Primeiro.');
  const m = merge(cur, devices('Art. 5º ........ III – três; ........ § 2º Segundo.'));
  assert.deepEqual(m.map(d => d.label), ['caput', 'I', 'II', 'III', '§1', '§2']);
});

test('wordDiff groups scattered edits into readable blocks', () => {
  const d = wordDiff('Incumbe aos prestadores de serviços', 'O prestador de serviço');
  assert.ok(d.length <= 3, JSON.stringify(d));
});

test('rendered pages escape source text', () => {
  assert.equal(esc('<img src=x onerror=alert(1)>"\''), '&lt;img src=x onerror=alert(1)&gt;&quot;&#39;');
  const html = billPage({
    id: 1, siglaTipo: 'PL', numero: 1, ano: 2026, data: '2026-10-01T10:00', ementa: '<script>alert(1)</script>',
    autores: ['<b>x</b>'], url: 'javascript:alert(1)" x="', laws: [], changes: [], revocations: [],
  }, {});
  assert.ok(!html.includes('<script>alert'));
  assert.ok(!html.includes('<b>x</b>'));
  assert.ok(!html.includes('" x="'));
  assert.ok(!html.includes('javascript:'));
});

test('Planalto candidates cover the folder layouts seen in the wild', () => {
  assert.ok(planaltoCandidates({ kind: 'lei', num: '10883', year: 2004 }).includes('_ato2004-2006/2004/lei/l10.883.htm'));
  assert.ok(planaltoCandidates({ kind: 'lei', num: '6681', year: 1979 }).includes('leis/1970-1979/l6681.htm'));
  assert.ok(planaltoCandidates({ kind: 'del', num: '509', year: 1969 }).includes('decreto-lei/del0509.htm'));
  assert.ok(planaltoCandidates({ kind: 'lei', num: '10257', year: 2001 }).includes('leis/leis_2001/l10257.htm'));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { DatabaseSync } from 'node:sqlite';
import { handle } from '../worker/alertas.js';
import { smtp, billMails, confirmMail } from '../alert.js';

// D1-shaped wrapper over node:sqlite
const d1 = () => {
  const s = new DatabaseSync(':memory:');
  return {
    exec: async sql => s.exec(sql),
    prepare(sql) {
      const st = s.prepare(sql); let a = [];
      const q = { bind: (...x) => ((a = x), q), first: async () => st.get(...a) ?? null, all: async () => ({ results: st.all(...a) }), run: async () => st.run(...a) };
      return q;
    },
  };
};
const W = 'https://w.test';
const post = (env, path, fields, ip = '1.1.1.1') => handle(new Request(W + path, { method: 'POST', body: new URLSearchParams(fields), headers: { 'cf-connecting-ip': ip } }), env);
const get = (env, path, hdr = {}) => handle(new Request(W + path, { headers: hdr }), env);
const queue = async env => (await get(env, '/fila', { authorization: 'Bearer k' })).json();

test('sign-up -> pending -> confirm -> active; unsubscribe deletes everything', async () => {
  const env = { DB: d1(), ALERTS_KEY: 'k' };
  assert.equal((await post(env, '/assinar', { email: 'A@x.com', lei: 'lei-8078-1990' })).status, 200);
  await post(env, '/assinar', { email: 'a@x.com', lei: 'lei-8078-1990' }); // duplicate is ignored
  let q = await queue(env);
  assert.equal(q.length, 1);
  assert.deepEqual([q[0].email, q[0].status], ['a@x.com', 'pending']);
  assert.equal((await get(env, `/confirmar?t=${q[0].token}`)).status, 200);
  assert.equal((await queue(env))[0].status, 'active');
  assert.equal((await get(env, `/sair?t=${q[0].token}`)).status, 200);
  assert.equal((await queue(env)).length, 0);
  assert.equal((await get(env, `/sair?t=${q[0].token}`)).status, 404);
});

test('rejects bad input, honeypot bots, a 4th free law, and floods', async () => {
  const env = { DB: d1(), ALERTS_KEY: 'k' };
  assert.equal((await post(env, '/assinar', { email: 'nope', lei: 'lei-1-2000' })).status, 400);
  assert.equal((await post(env, '/assinar', { email: 'a@x.com', lei: "x'); DROP TABLE subs;--" })).status, 400);
  await post(env, '/assinar', { email: 'bot@x.com', lei: 'lei-1-2000', site: 'http://spam' });
  for (const n of [1, 2, 3, 4]) await post(env, '/assinar', { email: 'a@x.com', lei: `lei-${n}-2000` });
  assert.deepEqual((await queue(env)).map(r => r.law).sort(), ['lei-1-2000', 'lei-2-2000', 'lei-3-2000']);
  let last;
  for (let i = 0; i < 12; i++) last = await post(env, '/assinar', { email: `f${i}@x.com`, lei: 'lei-9-2000' }, '9.9.9.9');
  assert.equal(last.status, 429);
});

test('queue needs the key; mailed flag sticks', async () => {
  const env = { DB: d1(), ALERTS_KEY: 'k' };
  assert.equal((await get(env, '/fila')).status, 401);
  assert.equal((await get(env, '/fila', { authorization: 'Bearer wrong' })).status, 401);
  assert.equal((await get(env, '/fila', { authorization: 'Bearer ' })).status, 401);
  assert.equal((await handle(new Request(W + '/fila'), { DB: d1() })).status, 401); // no key configured = closed
  await post(env, '/pro', { email: 'p@x.com' });
  const [r] = await queue(env);
  assert.equal(r.law, 'pro');
  for (const n of [1, 2, 3]) await post(env, '/assinar', { email: 'p@x.com', lei: `lei-${n}-2000` });
  await post(env, '/energia', { email: 'p@x.com' }); // waitlists do not use up the 3 free laws
  await post(env, '/tributos', { email: 'p@x.com' });
  const e = (await queue(env)).find(x => x.law === 'energia');
  assert.ok(e);
  assert.match(confirmMail(e, W, {}).subject, /Energia em dia/);
  assert.match(confirmMail((await queue(env)).find(x => x.law === 'tributos'), W, {}).subject, /Tributos em dia/);
  await handle(new Request(W + '/fila', { method: 'POST', headers: { authorization: 'Bearer k' }, body: JSON.stringify({ mailed: [r.token] }) }), env);
  assert.equal((await queue(env)).find(x => x.token === r.token).mailed, 1);
});

test('view counter: counts only known pages, per day, no personal data', async () => {
  const env = { DB: d1(), ALERTS_KEY: 'k' };
  for (const p of ['energia', 'energia', 'tributos', 'evil', '']) assert.equal((await get(env, `/v?p=${p}`)).status, 204);
  const rows = (await env.DB.prepare('SELECT page, n FROM views ORDER BY page').all()).results;
  assert.deepEqual(rows.map(r => [r.page, r.n]), [['energia', 2], ['tributos', 1]]);
});

test('worker pages escape nothing user-controlled (no reflection)', async () => {
  const env = { DB: d1(), ALERTS_KEY: 'k' };
  const html = await (await get(env, '/confirmar?t=<script>alert(1)</script>')).text();
  assert.ok(!html.includes('<script>alert'));
});

test('bill alerts: one mail per subscriber, only matching laws, with unsubscribe', () => {
  const rows = [
    { token: 't1', email: 'a@x.com', law: 'lei-8078-1990', status: 'active' },
    { token: 't2', email: 'a@x.com', law: 'del-2848-1940', status: 'active' },
    { token: 't3', email: 'b@x.com', law: 'lei-9999-2000', status: 'active' },
    { token: 't4', email: 'c@x.com', law: 'lei-8078-1990', status: 'pending' },
  ];
  const bills = [
    { id: 1, title: 'PL 1/2026', ementa: 'Altera o CDC <b>', laws: [{ key: 'lei-8078-1990', name: 'Código de Defesa do Consumidor' }] },
    { id: 2, title: 'PL 2/2026', ementa: 'Altera o CP', laws: [{ key: 'del-2848-1940', name: 'Código Penal' }] },
  ];
  const m = billMails(rows, bills, W);
  assert.equal(m.length, 1);
  assert.equal(m[0].to, 'a@x.com');
  assert.match(m[0].subject, /2 novos projetos/);
  assert.ok(m[0].html.includes('&lt;b&gt;') && !m[0].html.includes('<b>&lt;'));
  assert.equal(m[0].unsubscribe, `${W}/sair?t=t1`);
});

test('SMTP client speaks the protocol and sends UTF-8 subject + unsubscribe header', async () => {
  const got = [];
  const server = net.createServer(c => {
    c.write('220 fake\r\n');
    let data = false, buf = '';
    c.on('data', d => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 2);
        if (data) { if (line === '.') { data = false; c.write('250 ok\r\n'); } else got.push(line); continue; }
        if (line.startsWith('EHLO')) c.write('250-fake\r\n250 AUTH PLAIN\r\n');
        else if (line.startsWith('AUTH PLAIN')) c.write(Buffer.from(line.slice(11), 'base64').toString() === '\0u\0p' ? '235 ok\r\n' : '535 no\r\n');
        else if (line === 'DATA') { data = true; c.write('354 go\r\n'); }
        else if (line === 'QUIT') { c.write('221 bye\r\n'); c.end(); }
        else c.write('250 ok\r\n');
      }
    });
  });
  await new Promise(r => server.listen(0, r));
  const s = await smtp({ host: '127.0.0.1', port: server.address().port, secure: false, user: 'u', pass: 'p' });
  const msg = confirmMail({ token: 'tok', law: 'del-2848-1940' }, W, { 'del-2848-1940': 'Código Penal' });
  await s.send({ from: 'me@x.com', to: 'a@x.com', ...msg });
  await s.quit();
  server.close();
  const subj = got.find(l => l.startsWith('Subject:')).match(/B\?(.*)\?=/)[1];
  assert.equal(Buffer.from(subj, 'base64').toString(), 'Confirme o alerta: Código Penal');
  assert.ok(got.includes(`List-Unsubscribe: <${W}/sair?t=tok>`));
  const body = Buffer.from(got.filter(l => /^[A-Za-z0-9+/=]+$/.test(l) && l.length > 20).join(''), 'base64').toString();
  assert.ok(body.includes(`${W}/confirmar?t=tok`));
});

test('Portuguese article agrees with the law name', async () => {
  const { art } = await import('../src/render.js');
  assert.equal(art('Código Penal (Decreto-Lei nº 2.848/1940)'), 'o');
  assert.equal(art('Lei Maria da Penha (Lei nº 11.340/2006)', 'em'), 'na');
  assert.equal(art('Estatuto da Criança e do Adolescente', 'em'), 'no');
  const m = confirmMail({ token: 't', law: 'del-2848-1940' }, W, { 'del-2848-1940': 'Código Penal (Decreto-Lei nº 2.848/1940)' });
  assert.match(m.text, /mudar o Código Penal/);
});

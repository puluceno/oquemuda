// Mailer, run by GitHub Actions. Reads the Worker's queue and sends through Gmail SMTP.
//   node alert.js confirm   -> confirmation e-mails for new sign-ups
//   node alert.js bills     -> alerts for bills in .cache/new-bills.json
import tls from 'node:tls';
import net from 'node:net';
import { readFileSync, existsSync } from 'node:fs';
import { art } from './src/render.js';

const SITE = 'https://puluceno.github.io/oquemuda/';
const b64 = s => Buffer.from(s, 'utf8').toString('base64');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Minimal SMTP client: implicit TLS (465) or plain for local tests. */
export async function smtp({ host, port, secure = true, user, pass }) {
  const sock = secure ? tls.connect({ host, port, servername: host }) : net.connect({ host, port });
  sock.setEncoding('utf8');
  let buf = '', fail = null;
  const waiters = [];
  sock.on('error', e => fail?.(e));
  sock.on('data', d => {
    buf += d;
    let m;
    while ((m = buf.match(/^(\d{3}) .*\r?\n/m))) { // last line of a reply: "250 ..." (multi-line uses "250-")
      const end = m.index + m[0].length;
      const reply = buf.slice(0, end);
      buf = buf.slice(end);
      waiters.shift()?.(reply);
    }
  });
  const next = () => new Promise((res, rej) => { waiters.push(res); fail = rej; });
  const cmd = async (line, ok) => {
    const p = next();
    if (line !== null) sock.write(line + '\r\n');
    const r = await p;
    if (!r.startsWith(ok)) throw new Error(`SMTP ${line?.split(' ')[0] || 'greeting'}: ${r.trim().split('\n').pop()}`);
    return r;
  };
  await cmd(null, '220');
  await cmd('EHLO oquemuda', '250');
  if (user) await cmd(`AUTH PLAIN ${b64(`\0${user}\0${pass}`)}`, '235');
  return {
    async send({ from, to, subject, text, html, unsubscribe }) {
      const bd = 'b' + Math.random().toString(36).slice(2);
      const head = [`From: =?UTF-8?B?${b64('O que muda')}?= <${from}>`, `To: <${to}>`, `Subject: =?UTF-8?B?${b64(subject)}?=`,
        `Date: ${new Date().toUTCString()}`, 'MIME-Version: 1.0', `Content-Type: multipart/alternative; boundary="${bd}"`,
        ...(unsubscribe ? [`List-Unsubscribe: <${unsubscribe}>`, 'List-Unsubscribe-Post: List-Unsubscribe=One-Click'] : [])];
      const part = (type, body) => `--${bd}\r\nContent-Type: ${type}; charset=utf-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${b64(body).replace(/.{76}/g, '$&\r\n')}\r\n`;
      await cmd(`MAIL FROM:<${from}>`, '250');
      await cmd(`RCPT TO:<${to}>`, '250');
      await cmd('DATA', '354');
      await cmd(`${head.join('\r\n')}\r\n\r\n${part('text/plain', text)}${part('text/html', html)}--${bd}--\r\n.`, '250');
    },
    quit: async () => { await cmd('QUIT', '221').catch(() => {}); sock.end(); },
  };
}

const lawLabel = (key, names) => names?.[key] || key.replace(/^lei-(\d+)-(\d+)$/, 'Lei $1/$2').replace(/^lcp-(\d+)-(\d+)$/, 'Lei Complementar $1/$2').replace(/^del-(\d+)-(\d+)$/, 'Decreto-Lei $1/$2');
const shell = (inner, unsub) => `<div style="font:16px/1.5 system-ui,sans-serif;max-width:600px">${inner}
<p style="color:#666;font-size:13px">Comparação automática; confira sempre o texto oficial.${unsub ? ` <a href="${esc(unsub)}">Parar de receber e apagar meu e-mail</a>.` : ''}</p></div>`;

export function confirmMail(row, api, names) {
  const link = `${api}/confirmar?t=${row.token}`;
  if (row.law === 'pro') return {
    subject: 'Confirme: lista de espera do plano Pro', unsubscribe: `${api}/sair?t=${row.token}`,
    text: `Confirme seu lugar na lista de espera do plano Pro do O que muda:\n${link}\n\nSe não foi você, ignore este e-mail.`,
    html: shell(`<p>Confirme seu lugar na lista de espera do plano Pro do <b>O que muda</b>:</p><p><a href="${esc(link)}">Confirmar</a></p><p>Se não foi você, ignore este e-mail.</p>`),
  };
  const law = lawLabel(row.law, names);
  return {
    subject: `Confirme o alerta: ${law}`, unsubscribe: `${api}/sair?t=${row.token}`,
    text: `Confirme para receber um e-mail quando um novo projeto de lei mudar ${art(law)} ${law}:\n${link}\n\nSe não foi você, ignore este e-mail.`,
    html: shell(`<p>Confirme para receber um e-mail quando um novo projeto de lei mudar ${art(law)} <b>${esc(law)}</b>:</p><p><a href="${esc(link)}">Confirmar alerta</a></p><p>Se não foi você, ignore este e-mail.</p>`),
  };
}

/** One e-mail per subscriber with every new bill touching the laws they follow. */
export function billMails(rows, bills, api) {
  const byEmail = new Map();
  for (const r of rows) if (r.status === 'active' && r.law !== 'pro') {
    const e = byEmail.get(r.email) || { token: r.token, laws: new Set() };
    e.laws.add(r.law);
    byEmail.set(r.email, e);
  }
  const out = [];
  for (const [email, { token, laws }] of byEmail) {
    const hits = bills.filter(b => b.laws.some(l => laws.has(l.key)));
    if (!hits.length) continue;
    const unsub = `${api}/sair?t=${token}`;
    const lines = hits.map(b => ({ b, url: `${SITE}pl/${b.id}.html`, which: b.laws.filter(l => laws.has(l.key)).map(l => l.name).join(', ') }));
    out.push({
      to: email, unsubscribe: unsub,
      subject: hits.length === 1 ? `${hits[0].title} quer mudar ${art(lines[0].which)} ${lines[0].which}` : `${hits.length} novos projetos mudam leis que você acompanha`,
      text: lines.map(({ b, url, which }) => `${b.title} (${which})\n${b.ementa}\nVeja o que muda: ${url}`).join('\n\n') + `\n\nParar de receber: ${unsub}`,
      html: shell(lines.map(({ b, url, which }) => `<p><b><a href="${esc(url)}">${esc(b.title)}</a></b> · ${esc(which)}<br>${esc(b.ementa)}</p>`).join(''), unsub),
    });
  }
  return out;
}

async function main(mode) {
  const { ALERTS_URL: api, ALERTS_KEY: key, GMAIL_USER: user, GMAIL_APP_PASSWORD: pass } = process.env;
  if (!api || !key || !user || !pass) { console.log('alert: not configured (ALERTS_URL/ALERTS_KEY/GMAIL_USER/GMAIL_APP_PASSWORD), skipping'); return; }
  const auth = { authorization: `Bearer ${key}` };
  const r = await fetch(`${api}/fila`, { headers: auth });
  if (!r.ok) throw new Error(`queue HTTP ${r.status}`);
  const rows = await r.json();
  const names = existsSync('site/leis.json') ? JSON.parse(readFileSync('site/leis.json', 'utf8'))
    : await fetch(`${SITE}leis.json`).then(x => x.ok ? x.json() : {}).catch(() => ({}));
  let mails = [];
  if (mode === 'confirm') mails = rows.filter(x => x.status === 'pending' && !x.mailed).map(x => ({ to: x.email, token: x.token, ...confirmMail(x, api, names) }));
  if (mode === 'bills' && existsSync('.cache/new-bills.json')) mails = billMails(rows, JSON.parse(readFileSync('.cache/new-bills.json', 'utf8')), api);
  if (!mails.length) { console.log(`alert ${mode}: nothing to send`); return; }
  const s = await smtp({ host: 'smtp.gmail.com', port: 465, user, pass });
  const sent = [];
  try {
    for (const m of mails) { await s.send({ from: user, ...m }); if (m.token) sent.push(m.token); }
  } finally {
    await s.quit();
    if (sent.length) await fetch(`${api}/fila`, { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ mailed: sent }) });
  }
  console.log(`alert ${mode}: sent ${mails.length}`);
}

if (process.argv[1]?.endsWith('alert.js')) await main(process.argv[2]);

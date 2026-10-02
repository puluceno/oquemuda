// Cloudflare Worker: e-mail alert sign-ups (double opt-in), unsubscribe, Pro waitlist, and a
// key-protected queue the GitHub Actions mailer reads. Sending happens in Actions (Gmail SMTP).
const SCHEMA = `CREATE TABLE IF NOT EXISTS subs (
  token TEXT PRIMARY KEY, email TEXT NOT NULL, law TEXT NOT NULL, status TEXT NOT NULL,
  mailed INTEGER NOT NULL DEFAULT 0, created TEXT NOT NULL, UNIQUE(email, law));
CREATE TABLE IF NOT EXISTS hits (ip TEXT NOT NULL, at INTEGER NOT NULL);`;
const SITE = 'https://puluceno.github.io/oquemuda/';
const FREE_LAWS = 3;
const WAITLISTS = new Map([['/pro', 'pro'], ['/energia', 'energia'], ['/tributos', 'tributos']]);
const WAIT_SQL = [...WAITLISTS.values()].map(v => `'${v}'`).join(', ');
const DIGEST = { energia: 'Energia em dia', tributos: 'Tributos em dia' };
const LAW = /^(lei|lcp|del)-\d{1,6}-\d{4}$/;
const EMAIL = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,}$/i;
const ready = new WeakSet();

const page = (title, msg, status = 200) => new Response(`<!doctype html><html lang="pt-BR"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<body style="font:17px/1.5 system-ui,sans-serif;max-width:560px;margin:40px auto;padding:0 16px">
<h1 style="font-size:1.3rem">${title}</h1><p>${msg}</p><p><a href="${SITE}">Voltar para O que muda</a></p></body></html>`,
  { status, headers: { 'content-type': 'text/html; charset=utf-8' } });

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const token = () => hex(crypto.getRandomValues(new Uint8Array(16)));
const sha = async s => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));

async function limited(db, ip, max) {
  const now = Date.now(), id = await sha('oquemuda' + ip);
  await db.prepare('DELETE FROM hits WHERE at < ?').bind(now - 36e5).run();
  const { n } = await db.prepare('SELECT count(*) n FROM hits WHERE ip = ?').bind(id).first();
  if (n >= max) return true;
  await db.prepare('INSERT INTO hits (ip, at) VALUES (?, ?)').bind(id, now).run();
  return false;
}

export async function handle(req, env) {
  const db = env.DB;
  if (!ready.has(db)) { await db.exec(SCHEMA.replace(/\n/g, ' ')); ready.add(db); }
  const url = new URL(req.url);
  const ip = req.headers.get('cf-connecting-ip') || 'local';

  if (req.method === 'POST' && (url.pathname === '/assinar' || WAITLISTS.has(url.pathname))) {
    const f = await req.formData();
    if (f.get('site')) return page('Pronto', 'Recebido.'); // honeypot: bots fill every field
    const email = String(f.get('email') || '').trim().toLowerCase();
    const wait = WAITLISTS.get(url.pathname);
    const law = wait || String(f.get('lei') || '');
    if (!EMAIL.test(email) || (!wait && !LAW.test(law))) return page('Dados inválidos', 'Confira o e-mail e tente de novo.', 400);
    if (await limited(db, ip, 10)) return page('Muitas tentativas', 'Tente de novo em uma hora.', 429);
    const { n } = await db.prepare(`SELECT count(*) n FROM subs WHERE email = ? AND law NOT IN (${WAIT_SQL})`).bind(email).first();
    if (!wait && n >= FREE_LAWS) {
      return page('Limite do plano gratuito', `O plano gratuito acompanha até ${FREE_LAWS} leis por e-mail. O plano Pro (leis ilimitadas) está chegando: <a href="${SITE}pro.html">entre na lista de espera</a>.`);
    }
    await db.prepare('INSERT OR IGNORE INTO subs (token, email, law, status, created) VALUES (?, ?, ?, ?, ?)')
      .bind(token(), email, law, 'pending', new Date().toISOString()).run();
    return page('Confira seu e-mail', law === 'pro'
      ? 'Você está na lista de espera do plano Pro. Enviaremos um e-mail para confirmar.'
      : DIGEST[law]
      ? `Você está na lista do boletim ${DIGEST[law]}. Enviaremos um e-mail para confirmar.`
      : 'Enviamos um link de confirmação. Os alertas começam depois que você confirmar (veja também a pasta de spam).');
  }

  if ((req.method === 'GET' || req.method === 'POST') && (url.pathname === '/confirmar' || url.pathname === '/sair')) {
    const row = await db.prepare('SELECT email, status FROM subs WHERE token = ?').bind(url.searchParams.get('t') || '').first();
    if (!row) return page('Link inválido', 'Este link não existe ou já foi usado para sair.', 404);
    if (url.pathname === '/sair') {
      await db.prepare('DELETE FROM subs WHERE email = ?').bind(row.email).run();
      return page('Pronto', 'Seu e-mail foi apagado. Você não receberá mais nenhum alerta.');
    }
    await db.prepare("UPDATE subs SET status = 'active' WHERE token = ?").bind(url.searchParams.get('t')).run();
    return page('Alerta confirmado', 'Você receberá um e-mail quando um novo projeto de lei mudar a lei que escolheu.');
  }

  // mailer API (GitHub Actions); constant key in a Worker secret
  if (url.pathname.startsWith('/fila')) {
    if (!env.ALERTS_KEY || req.headers.get('authorization') !== `Bearer ${env.ALERTS_KEY}`) return new Response('no', { status: 401 });
    if (req.method === 'GET') {
      const { results } = await db.prepare('SELECT token, email, law, status, mailed FROM subs').all();
      return Response.json(results);
    }
    if (req.method === 'POST') {
      const { mailed = [] } = await req.json();
      for (const t of mailed.slice(0, 500)) await db.prepare('UPDATE subs SET mailed = 1 WHERE token = ?').bind(String(t)).run();
      return Response.json({ ok: true });
    }
  }
  return page('Não encontrado', 'Página não encontrada.', 404);
}

export default { fetch: (req, env) => handle(req, env) };

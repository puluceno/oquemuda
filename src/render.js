// Static HTML. Every piece of source text goes through esc().
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const href = u => esc(/^https:\/\//i.test(u || '') ? u : '#');

const fmtNum = n => Number(n).toLocaleString('pt-BR');
const KIND = { lei: 'Lei', lcp: 'Lei Complementar', del: 'Decreto-Lei' };
export const NICKS = {
  'del-2848-1940': 'Código Penal', 'del-3689-1941': 'Código de Processo Penal', 'del-5452-1943': 'CLT',
  'del-4657-1942': 'Lei de Introdução às Normas do Direito Brasileiro', 'lei-10406-2002': 'Código Civil',
  'lei-13105-2015': 'Código de Processo Civil', 'lei-8078-1990': 'Código de Defesa do Consumidor',
  'lei-8069-1990': 'Estatuto da Criança e do Adolescente', 'lei-9503-1997': 'Código de Trânsito Brasileiro',
  'lei-7210-1984': 'Lei de Execução Penal', 'lei-11340-2006': 'Lei Maria da Penha', 'lei-13709-2018': 'LGPD',
  'lei-10741-2003': 'Estatuto da Pessoa Idosa', 'lei-9394-1996': 'Lei de Diretrizes e Bases da Educação',
  'lei-8080-1990': 'Lei Orgânica da Saúde', 'lei-8213-1991': 'Lei de Benefícios da Previdência',
  'lei-8212-1991': 'Lei Orgânica da Seguridade Social', 'lei-9656-1998': 'Lei dos Planos de Saúde',
  'lei-8429-1992': 'Lei de Improbidade Administrativa', 'lei-14133-2021': 'Lei de Licitações',
  'lei-10826-2003': 'Estatuto do Desarmamento', 'lei-11343-2006': 'Lei de Drogas', 'lei-12965-2014': 'Marco Civil da Internet',
  'lei-9472-1997': 'Lei Geral de Telecomunicações', 'lei-13146-2015': 'Estatuto da Pessoa com Deficiência',
  'lei-8072-1990': 'Lei dos Crimes Hediondos', 'lei-9605-1998': 'Lei de Crimes Ambientais', 'lei-4737-1965': 'Código Eleitoral',
  'lei-9504-1997': 'Lei das Eleições', 'lei-5172-1966': 'Código Tributário Nacional', 'lcp-101-2000': 'Lei de Responsabilidade Fiscal',
  'lei-8112-1990': 'Estatuto dos Servidores Públicos Federais', 'lei-6015-1973': 'Lei de Registros Públicos',
  'lei-9099-1995': 'Lei dos Juizados Especiais', 'lei-12651-2012': 'Código Florestal', 'lei-1079-1950': 'Lei do Impeachment',
  'lei-15211-2025': 'Estatuto Digital da Criança e do Adolescente', 'lei-12587-2012': 'Política Nacional de Mobilidade Urbana',
  'lei-8742-1993': 'Lei Orgânica da Assistência Social (LOAS)', 'lcp-214-2025': 'Lei do IBS e da CBS (Reforma Tributária)',
  'lei-13675-2018': 'Lei do Sistema Único de Segurança Pública', 'lei-13756-2018': 'Lei do Fundo Nacional de Segurança Pública e das Loterias',
  'lei-8906-1994': 'Estatuto da Advocacia e da OAB', 'lei-7713-1988': 'Lei do Imposto de Renda', 'lei-9250-1995': 'Lei do Imposto de Renda da Pessoa Física',
  'lei-10098-2000': 'Lei de Acessibilidade', 'lei-7565-1986': 'Código Brasileiro de Aeronáutica', 
  'lei-14457-2022': 'Programa Emprega + Mulheres', 'lei-11101-2005': 'Lei de Falências', 'lei-6404-1976': 'Lei das Sociedades Anônimas',
};
export const lawTitle = (l) => `${KIND[l.kind]} nº ${fmtNum(l.num)}/${l.year}`;
// Portuguese article for a law name: "o Código Penal" but "a Lei Maria da Penha"; prep 'em' -> no/na, 'de' -> do/da
export const art = (name, prep = '') => {
  const m = /^(Código|Estatuto|Marco|Programa|Decreto|Sistema|Fundo)\b/.test(name);
  return { '': m ? 'o' : 'a', em: m ? 'no' : 'na', de: m ? 'do' : 'da' }[prep];
};
export const lawName = (l) => l.nick ? `${l.nick} (${lawTitle(l)})` : lawTitle(l);
const date = iso => iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '';
export const billTitle = b => `${b.siglaTipo} ${b.numero}/${b.ano}`;

const CSS = `
:root{--fg:#1d2329;--mut:#5d6b78;--bg:#fff;--line:#e3e8ee;--add:#e6ffec;--addf:#116329;--del:#ffebe9;--delf:#a40e26;--acc:#0b5cad}
*{box-sizing:border-box}body{margin:0;font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--fg);background:var(--bg)}
main{max-width:860px;margin:0 auto;padding:16px}a{color:var(--acc)}header.top{border-bottom:1px solid var(--line);padding:10px 16px}
header.top a{font-weight:700;text-decoration:none;color:var(--fg)}header.top span{color:var(--mut);font-size:14px;margin-left:8px}
h1{font-size:1.45rem;line-height:1.3;margin:.6em 0 .3em}h2{font-size:1.1rem;margin:1.6em 0 .5em}.mut{color:var(--mut);font-size:.92rem}
.card{border:1px solid var(--line);border-radius:8px;padding:12px 14px;margin:10px 0}.card h3{margin:0 0 4px;font-size:1rem}
.tag{display:inline-block;font-size:.78rem;padding:1px 8px;border-radius:99px;background:#eef2f6;color:var(--mut);margin-right:4px}
.art{border:1px solid var(--line);border-radius:8px;margin:14px 0;overflow:hidden}.art>h3{margin:0;padding:8px 12px;background:#f6f8fa;font-size:.95rem;border-bottom:1px solid var(--line)}
.d{padding:6px 12px;border-top:1px solid #f0f2f4;white-space:pre-wrap}.d:first-of-type{border-top:0}
.d.eq{color:var(--mut);font-size:.9rem}.d.add{background:var(--add)}.d.add ins{background:none}
ins{background:#abf2bc;color:var(--addf);text-decoration:none}del{background:#ffcecb;color:var(--delf)}
.skip{padding:4px 12px;color:var(--mut);font-size:.85rem;background:#fafbfc;border-top:1px solid #f0f2f4}
.warn{background:#fff8c5;border:1px solid #eedc82;border-radius:8px;padding:8px 12px;font-size:.9rem}
footer{color:var(--mut);font-size:.85rem;border-top:1px solid var(--line);margin-top:40px;padding:16px 0}
table{border-collapse:collapse;width:100%}td{padding:4px 6px;border-bottom:1px solid var(--line)}td.n{text-align:right;font-variant-numeric:tabular-nums}
.alert{background:#f1f6fd;border:1px solid #cfe0f5;border-radius:8px;padding:12px 14px;margin:14px 0}.alert b{display:block;margin-bottom:6px}
.alert form{display:flex;gap:8px;flex-wrap:wrap}.alert input[type=email]{flex:1;min-width:200px;padding:8px;border:1px solid #b9c7d6;border-radius:6px;font:inherit}
.alert button{padding:8px 14px;border:0;border-radius:6px;background:var(--acc);color:#fff;font:inherit;cursor:pointer}.hp{position:absolute;left:-9999px}`;

export const ALERTS = 'https://oquemuda-alertas.agentready.workers.dev';

/** E-mail alert sign-up for one law (posts to the alerts Worker). */
export function alertForm(law, root) {
  const name = law.nick || lawTitle(law);
  return `<div class="alert"><b>Receba um e-mail quando um novo projeto mudar ${art(name)} ${esc(name)}</b>
<form method="post" action="${ALERTS}/assinar"><input type="hidden" name="lei" value="${esc(law.key)}">
<input class="hp" name="site" tabindex="-1" autocomplete="off" aria-hidden="true">
<input type="email" name="email" required placeholder="seu@email.com" aria-label="Seu e-mail"><button>Receber alertas</button></form>
<div class="mut">Grátis para até 3 leis. Confirmação por e-mail; sair é um clique. <a href="${root}privacidade.html">Privacidade</a> · <a href="${root}pro.html">Plano Pro</a></div></div>`;
}

export function page({ title, desc, root, body }) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<link rel="alternate" type="application/atom+xml" href="${root}feed.xml"><style>${CSS}</style></head><body>
<header class="top"><a href="${root}index.html">O que muda</a><span>cada projeto de lei, comparado com a lei atual</span></header>
<main>${body}
<footer>Comparação automática a partir dos textos oficiais da <a href="https://dadosabertos.camara.leg.br">Câmara dos Deputados</a> e do <a href="https://www.planalto.gov.br/ccivil_03/">Planalto</a>. Pode conter erros: confira sempre o texto oficial.
<a href="${root}sobre.html">Como funciona</a> · <a href="${root}feed.xml">RSS</a> · <a href="https://github.com/puluceno/oquemuda">código aberto</a></footer>
</main></body></html>`;
}

const LABEL = l => l === 'caput' ? 'caput' : l.replace(/^pu/, 'parágrafo único').replace(/§(\d+)/, '§ $1');

function deviceHtml(d) {
  if (d.op === '+') return `<div class="d add"><ins>${esc(d.diff.map(x => x[1]).join(''))}</ins></div>`;
  if (d.op === '=') return `<div class="d eq">${esc(d.diff[0][1])}</div>`;
  return `<div class="d">${d.diff.map(([o, t]) => o === '=' ? esc(t) : o === '-' ? `<del>${esc(t)}</del>` : `<ins>${esc(t)}</ins>`).join('')}</div>`;
}

/** Show changed devices with 1 unchanged neighbour of context; fold the rest. */
function articleHtml(c, law) {
  const changed = i => c.devices[i] && c.devices[i].op !== '=';
  const keep = c.devices.map((d, i) => changed(i) || d.label === 'caput' || changed(i - 1) || changed(i + 1));
  let out = '', skipped = 0;
  c.devices.forEach((d, i) => {
    if (keep[i]) { if (skipped) out += `<div class="skip">… ${skipped} ${skipped > 1 ? 'dispositivos sem mudança' : 'dispositivo sem mudança'}</div>`; skipped = 0; out += deviceHtml(d); }
    else skipped++;
  });
  if (skipped) out += `<div class="skip">… ${skipped} ${skipped > 1 ? 'dispositivos sem mudança' : 'dispositivo sem mudança'}</div>`;
  const what = { changed: 'artigo alterado', new: 'artigo novo', nolaw: 'texto atual indisponível' }[c.status];
  return `<section class="art"><h3>Art. ${esc(c.art.replace(/^(\d+)(\d{3})/, '$1.$2'))} · ${esc(lawTitle(law))} <span class="tag">${what}</span></h3>${out}</section>`;
}

export function billPage(b, laws) {
  const byLaw = b.laws.map(l => ({ l, cs: b.changes.filter(c => c.law === l.key) })).filter(x => x.cs.length);
  const body = `
<p class="mut">${esc(date(b.data))} · ${esc(b.autores.join(', '))}</p>
<h1>${esc(billTitle(b))}: o que muda</h1>
<p>${esc(b.ementa)}</p>
<p class="mut"><a href="${href(b.url)}">Texto oficial do projeto</a> · <a href="https://www.camara.leg.br/propostas-legislativas/${b.id}">tramitação</a></p>
${b.changes.length ? '' : '<p class="warn">Não conseguimos identificar automaticamente as alterações deste projeto. Leia o texto oficial.</p>'}
${byLaw.map(({ l, cs }) => `<h2>${esc(lawName(laws[l.key] || l))}</h2>
${laws[l.key]?.url ? `<p class="mut"><a href="${href(laws[l.key].url)}">Texto atual no Planalto</a> · <a href="../lei/${l.key}.html">outros projetos que mudam esta lei</a></p>` : '<p class="warn">Não encontramos o texto atual desta lei no Planalto; mostramos só o texto proposto.</p>'}
${cs.map(c => articleHtml(c, l)).join('')}
${alertForm(laws[l.key] || l, '../')}`).join('')}
${b.revocations.length ? `<h2>Revogações</h2>${b.revocations.map(r => `<p>${esc(r)}</p>`).join('')}` : ''}`;
  return page({ title: `${billTitle(b)}: o que muda na lei`, desc: b.ementa, root: '../', body });
}

const billCard = (b, root, laws) => `<div class="card"><h3><a href="${root}pl/${b.id}.html">${esc(billTitle(b))}</a></h3>
<div>${esc(b.ementa.length > 260 ? b.ementa.slice(0, 257) + '…' : b.ementa)}</div>
<div class="mut">${esc(date(b.data))} · ${esc(b.autores.slice(0, 2).join(', '))}${b.autores.length > 2 ? ' e outros' : ''}</div>
<div>${b.laws.filter(l => b.changes.some(c => c.law === l.key)).map(l => `<a class="tag" href="${root}lei/${l.key}.html">${esc((laws[l.key] || l).nick || lawTitle(l))}</a>`).join('')}
<span class="tag">${b.changes.length} ${b.changes.length === 1 ? 'artigo' : 'artigos'}</span></div></div>`;

export function indexPage(bills, laws, top) {
  const body = `<h1>Veja o que os projetos em votação querem mudar na lei — antes de virar lei</h1>
<p>O site do Planalto mostra o que já mudou. Aqui você vê o que <b>pode</b> mudar: cada projeto de lei apresentado na Câmara, comparado palavra por palavra com o texto em vigor. <del>Riscado</del> sai, <ins>verde</ins> entra, se o projeto for aprovado.</p>
<p class="mut">${fmtNum(bills.length)} projetos comparados · atualizado em ${esc(date(new Date().toISOString()))}</p>
<h2>Leis com mais propostas de mudança</h2><table>${top.map(([k, n]) => `<tr><td><a href="lei/${k}.html">${esc(lawName(laws[k]))}</a></td><td class="n">${n}</td></tr>`).join('')}</table>
<p class="alert"><b>Alertas por e-mail</b>Abra a página de uma lei e receba um e-mail no dia em que um novo projeto tentar mudá-la. Grátis para até 3 leis. Para equipes jurídicas e de compliance: <a href="pro.html">plano Pro</a>.</p>
<h2>Projetos mais recentes</h2>${bills.slice(0, 150).map(b => billCard(b, '', laws)).join('')}
<img src="${ALERTS}/v?p=home" alt="" width="1" height="1" style="position:absolute;opacity:0">`;
  return page({ title: 'O que muda: cada projeto de lei comparado com a lei atual', desc: 'Veja exatamente o que cada projeto de lei apresentado na Câmara muda no texto da lei em vigor.', root: '', body });
}

export function lawPage(law, bills, laws) {
  const body = `<h1>${esc(lawName(law))}</h1>
<p>${bills.length} ${bills.length === 1 ? 'projeto quer' : 'projetos querem'} mudar esta lei.${law.url ? ` <a href="${href(law.url)}">Texto atual no Planalto</a>.` : ''}</p>
${alertForm(law, '../')}
${bills.map(b => billCard(b, '../', laws)).join('')}`;
  return page({ title: `Projetos que mudam ${art(lawName(law))} ${lawName(law)}`, desc: `${bills.length} projetos de lei propõem mudanças ${art(lawName(law), 'em')} ${lawName(law)}. Veja o que cada um muda.`, root: '../', body });
}

export function aboutPage() {
  const body = `<h1>Como funciona</h1>
<p>Todo dia, buscamos na <a href="https://dadosabertos.camara.leg.br">API de dados abertos da Câmara</a> os projetos de lei (PL e PLP) que alteram leis federais. Lemos o texto oficial do projeto e, seguindo as regras de redação da Lei Complementar nº 95/1998, identificamos cada artigo com nova redação ou acrescentado.</p>
<p>Depois, buscamos o texto em vigor da lei no <a href="https://www.planalto.gov.br/ccivil_03/">Portal da Legislação do Planalto</a> e comparamos dispositivo por dispositivo: caput, incisos, parágrafos e alíneas. Linhas pontilhadas do projeto (“......”) significam “mantém o texto atual”.</p>
<p>A comparação é automática e pode errar, principalmente quando o PDF do projeto tem formatação incomum. Sempre confira o texto oficial antes de usar.</p>
<p>O código é aberto: <a href="https://github.com/puluceno/oquemuda">github.com/puluceno/oquemuda</a>. Contato: agentready.team@gmail.com</p>`;
  return page({ title: 'Como funciona · O que muda', desc: 'Como comparamos projetos de lei com o texto da lei em vigor.', root: '', body });
}

export function proPage() {
  const body = `<h1>Plano Pro</h1>
<p>Para escritórios de advocacia, equipes de compliance, associações e relações governamentais.</p>
<ul><li>Alertas para <b>leis ilimitadas</b>, no mesmo dia em que o projeto é apresentado</li>
<li><b>Resumo semanal por tema</b> (saúde, tributário, telecom, penal, trabalhista…)</li>
<li>Exportação das comparações em CSV e acesso por API</li></ul>
<p><b>R$ 49/mês</b> por usuário. Sem contrato, cancele quando quiser.</p>
<div class="alert"><b>Entre na lista de espera</b><form method="post" action="${ALERTS}/pro">
<input class="hp" name="site" tabindex="-1" autocomplete="off" aria-hidden="true">
<input type="email" name="email" required placeholder="seu@email.com" aria-label="Seu e-mail"><button>Quero o Pro</button></form>
<div class="mut">Avisaremos quando abrir. <a href="privacidade.html">Privacidade</a></div></div>
<p>O plano gratuito continua: todas as comparações no site e alertas para até 3 leis.</p>`;
  return page({ title: 'Plano Pro · O que muda', desc: 'Alertas ilimitados de projetos de lei que mudam as leis do seu setor.', root: '', body });
}

export function privacyPage() {
  const body = `<h1>Privacidade</h1>
<p>Para enviar alertas, guardamos apenas: seu e-mail, as leis que você escolheu e a data do cadastro. Usamos esses dados só para enviar os alertas que você pediu. Não vendemos nem compartilhamos com ninguém.</p>
<p>Os dados ficam em um banco de dados na Cloudflare, e os e-mails são enviados pelo Gmail. Para registrar tentativas de abuso, guardamos por uma hora um código irreversível (hash) do seu endereço IP.</p>
<p>Todo e-mail tem um link “Parar de receber”: ao clicar, apagamos o seu e-mail e todas as suas inscrições. Você também pode pedir a exclusão ou uma cópia dos seus dados (LGPD) em agentready.team@gmail.com.</p>
<p>O site não usa cookies nem ferramentas de rastreamento.</p>`;
  return page({ title: 'Privacidade · O que muda', desc: 'Quais dados guardamos para enviar alertas e como apagá-los.', root: '', body });
}

export function feed(bills, base) {
  const items = bills.slice(0, 50).map(b => `<entry><title>${esc(billTitle(b))}: ${esc(b.ementa.slice(0, 120))}</title>
<link href="${base}pl/${b.id}.html"/><id>${base}pl/${b.id}.html</id><updated>${new Date(b.data).toISOString()}</updated>
<summary>${esc(b.ementa)}</summary></entry>`).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>O que muda</title>
<link href="${base}"/><id>${base}</id><updated>${new Date().toISOString()}</updated>${items}</feed>`;
}

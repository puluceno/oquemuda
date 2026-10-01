# O que muda

Cada projeto de lei apresentado na Câmara dos Deputados, comparado palavra por palavra com o texto da lei em vigor.

**Site:** https://puluceno.github.io/oquemuda/

## Como funciona

1. Busca na [API de dados abertos da Câmara](https://dadosabertos.camara.leg.br) os PL e PLP que alteram leis.
2. Extrai o texto do PDF oficial (`pdftotext`) e encontra os artigos entre aspas com nova redação ou acrescentados (regras da LC 95/1998: linhas pontilhadas = texto mantido, `(NR)` = nova redação).
3. Busca o texto em vigor no [Planalto](https://www.planalto.gov.br/ccivil_03/), separa artigos e dispositivos (caput, incisos, parágrafos, alíneas) e compara.
4. Gera um site estático (GitHub Pages), atualizado duas vezes por dia pelo GitHub Actions.

Sem dependências além do Node.js 22+ e do `pdftotext` (poppler).

```sh
npm test
DAYS=7 npm run build     # gera data/ e site/
npm run stats            # quantos projetos tiveram comparação
DAYS=30 REPARSE=1 npm run build   # recalcula tudo com o parser atual
```

A comparação é automática e pode errar. Sempre confira o texto oficial.

// After deploy: tell IndexNow engines (Bing, Yandex, Seznam, Naver...) about new pages.
import { readFileSync, readdirSync } from 'node:fs';
const urls = JSON.parse(readFileSync('.cache/new-urls.json', 'utf8'));
if (urls.length < 2) { console.log('indexnow: nothing new'); process.exit(0); }
const key = readdirSync('static').find(f => /^[0-9a-f]{32}\.txt$/.test(f)).slice(0, -4);
const { host, pathname } = new URL(urls[0]);
const r = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key, keyLocation: `https://${host}${pathname}${key}.txt`, urlList: urls.slice(0, 10000) }),
});
console.log(`indexnow: ${urls.length} urls -> HTTP ${r.status}`);

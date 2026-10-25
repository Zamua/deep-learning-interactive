// Lists the lookup terms in each lecture's code that have no note: calls without a glossary entry,
// symbols without `about`. Exits 1 if any are missing. Needs the dev server.
// Usage: node tools/lecture/lookup.mjs [lecture-id | atlas-<concept-id> ...]
// Env: BASE=url
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const dir = join(import.meta.dirname, '../../src/lectures');
const all = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
const ids = process.argv.slice(2).length ? process.argv.slice(2) : all;
const base = process.env.BASE ?? 'http://127.0.0.1:5340/';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
let missing = 0;
for (const id of ids) {
  await page.goto(`${base}#/${id.startsWith('atlas-') ? `atlas/${id.slice(6)}/watch` : `watch/${id}`}`);
  await page.waitForFunction((id) => window.__lec && location.hash.includes(id.replace(/^atlas-/, '')), id);
  const scenes = await page.evaluate(() => window.__lec.lookup());
  const gaps = new Map();
  for (const s of scenes) for (const t of s.terms) if (!t.note) gaps.set(`${t.kind === 'sym' ? 'symbol' : 'call'} ${t.key}`, s.scene);
  missing += gaps.size;
  console.log(`${id}: ${gaps.size ? [...gaps].map(([k, s]) => `${k} (${s})`).join(', ') : 'ok'}`);
  await page.goto('about:blank');
}
await browser.close();
process.exit(missing ? 1 : 0);

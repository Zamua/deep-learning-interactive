// Lists the lookup terms in each explainer's code that have no note: calls without a glossary entry,
// symbols without `about`. Exits 1 if any are missing. Needs the dev server.
// Usage: node tools/lecture/lookup.mjs [atlas-<concept-id> ...]
// Env: BASE=url
import { chromium } from 'playwright';
import { explainers, findExplainer } from './find.mjs';

const ids = process.argv.slice(2).length ? process.argv.slice(2) : explainers().map((e) => e.id);
const base = process.env.BASE ?? 'http://127.0.0.1:5340/';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
let missing = 0;
for (const id of ids) {
  const found = findExplainer(id);
  if (!found) {
    console.log(`${id}: no explainer script`);
    missing++;
    continue;
  }
  await page.goto(`${base}#/${found.watch}`);
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

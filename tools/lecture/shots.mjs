// Screenshots a lecture near the end of every beat (or of the named beats), for review.
// Usage: node tools/lecture/shots.mjs <lecture-id> <out-dir> [width=402] [height=874] [mobile=1] [scene/beat ...]
// Env: BASE=url, THEME=dark, FRAC=0.85 (how far into each beat)
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const [id, out, w = '402', h = '874', mobile = '1', ...only] = process.argv.slice(2);
if (!id || !out) {
  console.error('usage: node tools/lecture/shots.mjs <lecture-id> <out-dir> [w h mobile] [scene/beat ...]');
  process.exit(2);
}
mkdirSync(out, { recursive: true });
const base = process.env.BASE ?? 'http://127.0.0.1:5340/';
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({
  viewport: { width: +w, height: +h },
  deviceScaleFactor: mobile === '1' ? 2 : 1,
  isMobile: mobile === '1',
  hasTouch: mobile === '1',
  colorScheme: process.env.THEME === 'dark' ? 'dark' : 'light',
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
page.on('console', (m) => m.type() === 'error' && console.log('console.error', m.text().slice(0, 300)));
// Dev-server reloads (other edits landing mid-run) reset the page; re-arm it whenever that happens.
async function arm() {
  for (let i = 0; ; i++) {
    try {
      await page.waitForFunction(() => window.__lec, null, { timeout: 20000 });
      break;
    } catch (e) {
      if (i >= 5) throw e;
      await page.goto(`${base}#/watch/${id}`).catch(() => {});
    }
  }
  await page.waitForTimeout(800);
  // The paused-state play button (and the dev "out of date" notice) would cover every frame.
  await page.addStyleTag({ content: '.lec-center, .lec-notice { display: none !important }' });
  await page.evaluate(() => (window.__armed = 1));
}
const armed = () => page.evaluate(() => window.__armed === 1).catch(() => false);

await page.goto(`${base}#/watch/${id}`);
await page.waitForFunction(() => window.__lec, null, { timeout: 30000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/000-poster.png` });
await arm();
const scenes = await page.evaluate(() => window.__lec.scenes);
const frac = Number(process.env.FRAC ?? 0.85);
let n = 1;
for (const s of scenes) {
  for (const b of s.beats) {
    const key = `${s.id}/${b.id}`;
    if (only.length && !only.includes(key) && !only.includes(s.id)) continue;
    for (let tries = 0; tries < 3; tries++) {
      if (!(await armed())) await arm();
      await page.evaluate((t) => window.__lec.seek(t), b.start + frac * (b.end - b.start));
      await page.waitForTimeout(450);
      if (await armed()) break;
    }
    await page.screenshot({ path: `${out}/${String(n++).padStart(3, '0')}-${s.id}-${b.id}.png` });
  }
}
console.log(`${n - 1} shots -> ${out}`);
await browser.close();

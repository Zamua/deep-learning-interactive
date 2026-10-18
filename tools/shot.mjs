// Screenshot a route with Playwright + system Chrome, printing page errors and console errors.
// Usage: node tools/shot.mjs <route> <name> [width=1280] [height=900] [mobile=0] [full=0]
//   route: chapter id or "" for home, e.g. "linear-classification" or "linear-classification/softmax"
//   output: shots/<name>.png
// Env: SCROLL='.fig:2' (scroll to 3rd figure), THEME=dark, DELAY=ms, BASE=url
import { chromium } from 'playwright';
const base = process.env.BASE ?? 'http://127.0.0.1:5340/';
const [route = '', name = 'shot', w = '1280', h = '900', mobile = '0', full = '0'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({
  viewport: { width: +w, height: +h },
  deviceScaleFactor: mobile === '1' ? 2 : 1,
  isMobile: mobile === '1',
  hasTouch: mobile === '1',
  colorScheme: process.env.THEME === 'dark' ? 'dark' : 'light',
});
const page = await ctx.newPage();
let errors = 0;
page.on('pageerror', (e) => { errors++; console.log('pageerror', e.message); });
page.on('console', (m) => { if (m.type() === 'error') { errors++; console.log('console.error', m.text().slice(0, 400)); } });
await page.goto(`${base}#/${route}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
await page.waitForTimeout(+(process.env.DELAY ?? 1200));
if (process.env.SCROLL) {
  // SCROLL=".fig:2" scrolls to the third match; a plain selector scrolls to the first
  await page.evaluate((spec) => {
    const m = spec.match(/^(.*):(\d+)$/);
    const el = m ? document.querySelectorAll(m[1])[+m[2]] : document.querySelector(spec);
    el?.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -70);
  }, process.env.SCROLL);
  await page.waitForTimeout(600);
}
await page.screenshot({ path: `shots/${name}.png`, fullPage: full === '1' });
console.log(`shots/${name}.png`, errors ? `${errors} error(s)` : 'no errors');
await browser.close();

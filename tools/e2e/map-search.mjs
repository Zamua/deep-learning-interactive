// End to end on a phone: open the part map's search, pick a match, land on that concept.
// node tools/e2e/map-search.mjs [base] [screenshot.png]   (Playwright with the system Chrome; a dev or preview server)
import { chromium } from 'playwright';

const base = process.argv[2] ?? 'http://127.0.0.1:5340/';
const shot = process.argv[3];
const fail = (msg) => {
  console.error(`FAIL ${msg}`);
  process.exitCode = 1;
};

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: 'dark' });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const PART = `${base}#/atlas/graph/scale`;
await page.goto(PART);
const toggle = page.getByRole('button', { name: 'Find a concept' });
await toggle.tap();
const field = page.getByRole('combobox', { name: 'Find a concept' });
await field.tap();
const size = await field.evaluate((el) => getComputedStyle(el).fontSize);
if (parseFloat(size) < 16) fail(`the field's font is ${size}; iOS zooms in under 16px`);
await field.pressSequentially('gated m', { delay: 40 });
const options = page.getByRole('option');
await options.first().waitFor();
const first = (await options.first().innerText()).split('\n')[0];
if (first !== 'Gated MLPs') fail(`first match is "${first}", not "Gated MLPs"`);
if (!(await page.locator('.pm-n.lit[data-id="swiglu"]').count())) fail('the match is not lit on the map');
if (shot) await page.screenshot({ path: shot });
await options.first().tap();
await page.waitForURL(/#\/atlas\/swiglu$/, { timeout: 4000 }).catch(() => fail(`picking did not open the concept: ${page.url()}`));
// The address changes a moment before the page is drawn.
await page.locator('h1', { hasText: 'Gated MLPs' }).waitFor({ timeout: 4000 }).catch(() => fail('the concept page did not draw'));
// A tap outside puts the list away.
await page.goto(PART);
await toggle.tap();
await field.tap();
await field.fill('attention');
await options.first().waitFor();
// The list covers what is just below the field, so the bottom corner of the map, where no concept is drawn.
const svg = page.locator('.pm-map svg');
const box = await svg.boundingBox();
await svg.tap({ position: { x: 3, y: box.height - 3 } });
if (await page.getByRole('listbox').isVisible()) fail('a tap outside left the list open');
if (errors.length) fail(`page errors: ${errors.join('; ')}`);
await browser.close();
if (!process.exitCode) console.log('map search e2e: ok');

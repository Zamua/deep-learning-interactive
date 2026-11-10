// Opens every page with no connection after an update, in system Chrome against two builds served from this machine.
// Usage: node tools/e2e/offline-update.mjs <old dist> <new dist>
//
// A learner on the old build launches once after the new one is published, then loses the connection:
//   cut      the connection goes while the new build is still arriving; whichever build then opens must open whole
//   settled  the connection goes after the new build has arrived; it is the new build that must open whole, and the
//            next explainer must play with its narration, which was saved ahead
// Exits 1 when any page fails to draw.
import { createServer } from 'node:http';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { chromium } from 'playwright';

const [oldDist, newDist] = process.argv.slice(2).map((d) => d && resolve(d));
if (!oldDist || !newDist || !existsSync(join(oldDist, 'sw.js')) || !existsSync(join(newDist, 'sw.js'))) {
  console.error('usage: node tools/e2e/offline-update.mjs <old dist> <new dist>   (two production builds)');
  process.exit(2);
}

const ROUTES = ['', 'atlas', 'atlas/graph', 'atlas/list', 'atlas/history', 'atlas/next', 'atlas/softmax', 'atlas/softmax/watch',
  'atlas/learn/softmax', 'atlas/place', 'atlas/new-track', 'c/nix', 'c/nix/nix.derivations', 'account'];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.woff2': 'font/woff2', '.m4a': 'audio/mp4', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm' };

/** The site: one build at a time, optionally slow, and able to drop off the network. */
const site = { root: oldDist, delay: 0, down: false };
const server = createServer((req, res) => {
  if (site.down) return void req.socket.destroy();
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  const file = join(site.root, path.endsWith('/') ? `${path}index.html` : path);
  if (!file.startsWith(site.root) || !existsSync(file) || !statSync(file).isFile()) return void res.writeHead(404).end('missing');
  setTimeout(() => {
    if (site.down) return void req.socket.destroy();
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    createReadStream(file).pipe(res);
  }, path.startsWith('/assets/') ? site.delay : 0);
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}/`;

const entryOf = (dist) => readFileSync(join(dist, 'index.html'), 'utf8').match(/index-[\w-]+\.js/)[0];
const [oldEntry, newEntry] = [entryOf(oldDist), entryOf(newDist)];
const newVersion = readFileSync(join(newDist, 'sw.js'), 'utf8').match(/"version":"(\w+)"/)[1];

const browser = await chromium.launch({ channel: 'chrome' });
const failures = [];

/** What the active worker says it holds. */
const held = (page) => page.evaluate(async () => {
  const sw = (await navigator.serviceWorker.getRegistration())?.active;
  if (!sw) return null;
  return new Promise((done) => {
    const ch = new MessageChannel();
    setTimeout(() => done(null), 2000);
    ch.port1.onmessage = (m) => done(m.data);
    sw.postMessage({ type: 'offline-status' }, [ch.port2]);
  });
}).catch(() => null);

const entryOn = (page) => page.evaluate(() => document.querySelector('script[src*="assets/index-"]')?.getAttribute('src')?.split('/').pop() ?? '');

async function until(what, test, ms = 60000) {
  const end = Date.now() + ms;
  for (;;) {
    if (await test()) return;
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 250));
  }
}

/** Opens every route as a launch would, and reports the ones that did not draw. */
async function everyPageOpens(ctx, label) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let build = '';
  for (const route of ROUTES) {
    errors.length = 0;
    let why = '';
    try {
      await page.goto('about:blank');
      await page.goto(`${base}#/${route}`, { timeout: 15000 });
      await page.waitForFunction(() => document.querySelector('#main, main')?.children.length > 0, null, { timeout: 15000 });
      await page.waitForTimeout(400);
      build ||= await entryOn(page);
      why = await page.evaluate(() => document.querySelector('.fig-error, .load-failed')?.textContent ?? '');
    } catch (e) {
      why = e.message.split('\n')[0];
    }
    why ||= errors[0] ?? '';
    if (why) failures.push(`${label}  #/${route}  ${why.slice(0, 160)}`);
  }
  await page.close();
  return build;
}

/** Plays the first concept's explainer with no connection; returns what went wrong, or '' when its narration is heard. */
async function nextExplainerPlays(ctx) {
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    const made = (window.__audio = []);
    window.Audio = new Proxy(window.Audio, { construct: (T, args) => (made.push(new T(...args)), made.at(-1)) });
  });
  try {
    await page.goto(`${base}#/atlas/vector/watch`, { timeout: 15000 });
    await page.click('.lec-poster-play', { timeout: 15000 });
    await page.waitForFunction(() => window.__audio.some((a) => !a.paused && !a.error && a.currentTime > 0.5), null, { timeout: 15000 });
    return '';
  } catch (e) {
    const state = await page.evaluate(() => window.__audio?.map((a) => `paused=${a.paused} t=${a.currentTime} error=${a.error?.code ?? 'none'}`).join('; ') ?? 'no page').catch(() => '');
    return `${e.message.split('\n')[0]} (${state || 'no audio element'})`;
  } finally {
    await page.close();
  }
}

/** A learner whose device holds all of the old build. */
async function learnerOnOld() {
  Object.assign(site, { root: oldDist, delay: 0, down: false });
  const ctx = await browser.newContext({ viewport: { width: 402, height: 874 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(base);
  await until('the old build to be saved', async () => (await held(page))?.ready === true);
  await page.close();
  return ctx;
}

const name = (entry) => (entry === newEntry ? 'new' : entry === oldEntry ? 'old' : `unknown (${entry})`);

// The connection goes while the new build is still arriving.
for (const after of [300, 1500, 4000, 7000]) {
  const ctx = await learnerOnOld();
  Object.assign(site, { root: newDist, delay: 40 });
  const page = await ctx.newPage();
  await page.goto(base).catch(() => {});
  await page.waitForTimeout(after);
  site.down = true;
  await page.close();
  const label = `cut at ${after} ms`;
  console.log(`${label}: opened the ${name(await everyPageOpens(ctx, label))} build`);
  await ctx.close();
}

// The connection goes after the new build has arrived.
{
  const ctx = await learnerOnOld();
  Object.assign(site, { root: newDist, delay: 0 });
  const page = await ctx.newPage();
  await page.goto(base);
  await until('the new build to take over', async () => {
    if ((await entryOn(page).catch(() => '')) !== newEntry) return false;
    const st = await held(page);
    return st?.ready === true && st.version === newVersion;
  }, 120000);
  // A new learner's next explainer is the first concept's: its narration is saved ahead, unasked.
  await until('the next explainer\'s narration to be saved', () => page.evaluate(async () => (await (await caches.open('atlas-audio-ahead')).keys()).length > 0));
  site.down = true;
  await page.close();
  const sound = await nextExplainerPlays(ctx);
  console.log(`settled: the next explainer ${sound ? 'did not play with sound: ' + sound : 'played with sound'}`);
  if (sound) failures.push(`settled  #/atlas/vector/watch  ${sound}`);
  const got = await everyPageOpens(ctx, 'settled');
  console.log(`settled: opened the ${name(got)} build`);
  if (got !== newEntry) failures.push(`settled  the ${name(got)} build opened, not the new one`);
  await ctx.close();
}

await browser.close();
server.close();
if (failures.length) {
  console.error(`\n${failures.length} page(s) failed offline:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log('every page opened offline');

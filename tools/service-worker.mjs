// Emits sw.js from src/offline/sw.js, prefixed with the names it shares with the page (src/offline/wire.json) and
// what it keeps offline: every file the build writes except the narration (cached as it plays) and font formats
// only browsers without service workers fall back to. The dev server serves it with nothing to keep, so dev
// requests always reach Vite.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const SOURCE = resolve(import.meta.dirname, '../src/offline/sw.js');
const WIRE = resolve(import.meta.dirname, '../src/offline/wire.json');
const NOT_APP = /(^|\/)\.|\.(m4a|map|woff|ttf|eot)$/;

/** Splits the built files into the app (cached at install) and the narration (cached when played). */
export function offlineLists(files) {
  return {
    files: files.filter((f) => f !== 'sw.js' && !NOT_APP.test(f)).sort(),
    audio: files.filter((f) => f.endsWith('.m4a')).sort(),
  };
}

/** sw.js with what it keeps offline and the names it shares with the page. */
const worker = (offline) => `self.__ATLAS_OFFLINE = ${JSON.stringify(offline)};\nself.__ATLAS_WIRE = ${JSON.stringify(JSON.parse(readFileSync(WIRE, 'utf8')))};\n${readFileSync(SOURCE, 'utf8')}`;

const walk = (dir, root = dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(join(dir, d.name), root) : [relative(root, join(dir, d.name))]));

export function serviceWorker() {
  let outDir = '';
  return {
    name: 'service-worker',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (new URL(req.url ?? '/', 'http://dev').pathname !== '/sw.js') return next();
        res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-store' });
        res.end(worker(null));
      });
    },
    writeBundle() {
      const lists = offlineLists(walk(outDir));
      // The worker's bytes must change whenever a kept file does (index.html keeps its name), or browsers keep the old one.
      const h = createHash('sha256');
      for (const f of lists.files) h.update(f).update(readFileSync(join(outDir, f)));
      for (const f of lists.audio) h.update(f);
      const offline = { version: h.digest('hex').slice(0, 16), ...lists };
      writeFileSync(join(outDir, 'sw.js'), worker(offline));
    },
  };
}

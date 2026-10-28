// `timing.json?duration` imports only a narration's length, so a page can total explainers without loading them.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const QUERY = /\/timing\.json\?duration$/;
// The resolved id must not end in .json, or Vite's JSON plugin parses the module this one writes.
const PREFIX = '\0timing-duration:';
const SUFFIX = '.js';

export function timingDuration() {
  return {
    name: 'timing-duration',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!QUERY.test(source) || !importer) return null;
      return PREFIX + resolve(dirname(importer), source.replace(/\?duration$/, '')) + SUFFIX;
    },
    load(id) {
      if (!id.startsWith(PREFIX)) return null;
      const file = id.slice(PREFIX.length, -SUFFIX.length);
      this.addWatchFile(file);
      const d = Number(JSON.parse(readFileSync(file, 'utf8')).duration);
      return `export default ${Number.isFinite(d) ? d : 0};`;
    },
  };
}

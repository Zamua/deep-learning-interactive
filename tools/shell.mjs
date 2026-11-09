// A Vite plugin: puts into the page what its first paint needs, so that paint waits on no other request: copies of the
// shared styles (the originals still load, in their usual order, so the cascade is unchanged), the placeholders' styles,
// the books and icons they draw. And it keeps the stylesheet from holding back the paint.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const courses = join(root, 'src/courses');
const subdirs = (dir) => readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

export function books() {
  const first = readFileSync(join(root, 'src/routes.ts'), 'utf8').match(/FIRST_COURSE = '([^']+)'/)[1];
  return subdirs(courses).filter((c) => existsSync(join(courses, c, 'course.ts'))).map((c) => {
    const def = readFileSync(join(courses, c, 'course.ts'), 'utf8');
    const field = (name) => def.match(new RegExp(`${name}:\\s*'((?:[^'\\\\]|\\\\.)*)'`))[1].replace(/\\'/g, "'");
    const n = subdirs(join(courses, c)).flatMap((d) => subdirs(join(courses, c, d)).filter((x) => existsSync(join(courses, c, d, x, 'meta.ts')))).length;
    const parts = [...def.matchAll(/\{ id: '/g)].length;
    return { id: c, title: field('title'), blurb: field('blurb'), cover: field('cover'), prefix: field('idPrefix'), n, parts, home: c === first ? '#/atlas' : `#/c/${c}` };
  });
}

const ICONS = { caret: 'caret-down', graph: 'graph', gear: 'gear-six' };
const iconOf = (name) => readFileSync(join(root, 'node_modules/@phosphor-icons/core/assets/light', `${name}-light.svg`), 'utf8').replace('<svg ', '<svg class="ico" aria-hidden="true" ');

/** Safe inside a <script>: nothing in it can end the element. */
const json = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

export function shell() {
  return {
    name: 'atlas-shell',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const css = ['base', 'library', 'shell'].map((f) => readFileSync(join(root, `src/styles/${f}.css`), 'utf8')).join('\n');
        // Loaded as print, the stylesheet keeps its place in the cascade without holding back the paint.
        const out = html.replace(/<link rel="stylesheet"([^>]*)>/g, `<link rel="stylesheet"$1 media="print" onload="this.media='all'">`);
        return out
          .replace('<!-- shell-styles -->', () => `<style>${css}</style>`)
          .replace('/*atlas-books*/[]', () => json(books()))
          .replace('/*atlas-icons*/{}', () => json(Object.fromEntries(Object.entries(ICONS).map(([k, v]) => [k, iconOf(v)]))));
      },
    },
  };
}

import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/fraunces/opsz-italic.css';
import '@fontsource-variable/source-serif-4/opsz.css';
import '@fontsource-variable/source-serif-4/opsz-italic.css';
import '@fontsource-variable/jetbrains-mono';
import 'katex/dist/katex.min.css';
import './styles/base.css';
import './styles/components.css';

import { CHAPTERS, PARTS, type ChapterMeta, hasChapter, loadChapter } from './chapters/index';
import { icon } from './core/controls';
import { disposeAll, h } from './core/dom';
import { Page } from './core/page';
import { renderHome } from './home';

const store = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string): void {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode: preference just isn't kept */
    }
  },
};

export function visited(): Set<string> {
  return new Set((store.get('cs231n.visited') ?? '').split(',').filter(Boolean));
}

function markVisited(id: string): void {
  const v = visited();
  v.add(id);
  store.set('cs231n.visited', [...v].join(','));
}

function applyTheme(t: string | null): void {
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
applyTheme(store.get('cs231n.theme'));

function currentTheme(): 'light' | 'dark' {
  const t = document.documentElement.dataset.theme;
  if (t === 'light' || t === 'dark') return t;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const app = document.getElementById('app')!;
const main = h('main', { class: 'main', id: 'main' });
const nav = h('nav', { class: 'side', 'aria-label': 'Chapters' });
const scrim = h('div', { class: 'scrim' });
const themeBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Toggle dark mode' });
const menuBtn = h('button', { class: 'icon-btn menu-btn', type: 'button', 'aria-label': 'Chapters', html: icon('menu') });
const progress = h('div', { class: 'read-progress' });

function syncThemeBtn(): void {
  themeBtn.innerHTML = icon(currentTheme() === 'dark' ? 'sun' : 'moon');
}
themeBtn.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  store.set('cs231n.theme', next);
  applyTheme(next);
  syncThemeBtn();
});
syncThemeBtn();

const setNav = (open: boolean) => document.body.classList.toggle('nav-open', open);
menuBtn.addEventListener('click', () => setNav(!document.body.classList.contains('nav-open')));
scrim.addEventListener('click', () => setNav(false));

const top = h('header', { class: 'topbar' },
  menuBtn,
  h('a', { class: 'brand', href: '#/' }, h('span', { class: 'brand-mark', 'aria-hidden': 'true' }), h('span', { class: 'brand-name' }, 'cs231n'), h('span', { class: 'brand-sub' }, 'interactive')),
  h('div', { class: 'topbar-spacer' }),
  themeBtn,
  progress);

app.append(top, nav, scrim, main);

function buildNav(active: string): void {
  nav.innerHTML = '';
  const seen = visited();
  for (const part of PARTS) {
    const items = CHAPTERS.filter((c) => c.part === part);
    nav.append(h('div', { class: 'side-part' }, part));
    const ul = h('ul', { class: 'side-list' });
    for (const c of items) {
      const a = h('a', { href: `#/${c.id}`, class: `side-link${c.id === active ? ' on' : ''}${hasChapter(c.id) ? '' : ' soon'}` },
        h('span', { class: 'side-num' }, c.num),
        h('span', { class: 'side-title' }, c.title.replace(/^Assignment \d: /, '')),
        seen.has(c.id) ? h('span', { class: 'side-seen', html: icon('check') }) : '');
      a.addEventListener('click', () => setNav(false));
      ul.append(h('li', {}, a));
    }
    nav.append(ul);
  }
  nav.append(h('div', { class: 'side-foot', html: 'An unofficial companion to Stanford CS231n (Winter 2016).' }));
}

function chapterHeader(meta: ChapterMeta): HTMLElement {
  const metaRow = h('div', { class: 'ch-meta' });
  if (meta.lectures) metaRow.append(h('span', { class: 'tag' }, meta.lectures));
  for (const n of meta.notes ?? []) metaRow.append(h('a', { class: 'tag tag-link', href: n.url, target: '_blank', rel: 'noopener', html: `${icon('book')}${n.title}` }));
  return h('header', { class: 'ch-head' },
    h('div', { class: 'ch-part' }, meta.part),
    h('div', { class: 'ch-num', 'aria-hidden': 'true' }, meta.num),
    h('h1', { class: 'ch-title' }, meta.title),
    h('p', { class: 'ch-blurb' }, meta.blurb),
    metaRow);
}

function chapterFooter(meta: ChapterMeta): HTMLElement {
  const i = CHAPTERS.indexOf(meta);
  const prev = CHAPTERS[i - 1];
  const next = CHAPTERS[i + 1];
  const link = (c: ChapterMeta | undefined, dir: 'prev' | 'next') =>
    c
      ? h('a', { class: `pn pn-${dir}`, href: `#/${c.id}` },
          h('span', { class: 'pn-dir', html: dir === 'prev' ? `${icon('arrowLeft')} Previous` : `Next ${icon('arrowRight')}` }),
          h('span', { class: 'pn-title' }, `${c.num}. ${c.title}`))
      : h('span', {});
  return h('footer', { class: 'ch-foot' }, link(prev, 'prev'), link(next, 'next'));
}

let currentId = '';
let renderToken = 0;

async function route(): Promise<void> {
  const [, id = '', section = ''] = location.hash.replace(/^#\/?/, '#').split(/[#/]/);
  if (id === currentId && currentId) {
    if (section) document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const token = ++renderToken;
  disposeAll();
  currentId = id;
  main.innerHTML = '';
  buildNav(id);
  const meta = CHAPTERS.find((c) => c.id === id);
  if (!meta) {
    document.title = 'cs231n, interactive';
    renderHome(main, visited());
    window.scrollTo(0, 0);
    return;
  }
  document.title = `${meta.num}. ${meta.title} · cs231n interactive`;
  const article = h('article', { class: 'chapter', 'data-page': meta.id });
  article.append(chapterHeader(meta));
  const body = h('div', { class: 'ch-body', 'data-page': meta.id });
  article.append(body);
  main.append(article);
  const pending = loadChapter(meta.id);
  if (!pending) {
    body.append(h('div', { class: 'prose' }, h('p', {}, 'This chapter is still being written.')));
    article.append(chapterFooter(meta));
    return;
  }
  body.append(h('div', { class: 'loading' }, 'Loading…'));
  try {
    const def = await pending;
    if (token !== renderToken) return;
    body.innerHTML = '';
    const page = new Page(body, meta.id, meta.num, def.symbols);
    const keys = Object.keys(def.symbols);
    if (keys.length) {
      const legend = h('div', { class: 'ch-legend' }, h('span', { class: 'ch-legend-head' }, 'Symbols'));
      for (const k of keys) {
        const name = def.symbols[k]!.name.replace(/^[^:]{1,12}:\s*/, '');
        legend.append(h('span', { class: 'ch-legend-item', html: `${page.tex(`\\sym{${k}}{${def.symbols[k]!.tex ?? k}}`)}<span>${name}</span>` }));
      }
      body.append(legend);
    }
    def.render(page);
    if (page.toc.length > 2) {
      const toc = h('nav', { class: 'ch-toc', 'aria-label': 'On this page' }, h('div', { class: 'ch-toc-head' }, 'On this page'));
      const ol = h('ol', {});
      for (const t of page.toc) ol.append(h('li', {}, h('a', { href: `#/${meta.id}/${t.id}` }, t.title)));
      toc.append(ol);
      article.insertBefore(toc, body);
    }
  } catch (e) {
    console.error(e);
    body.innerHTML = '';
    body.append(h('div', { class: 'fig-error' }, `This chapter failed to load: ${(e as Error).message}`));
  }
  article.append(chapterFooter(meta));
  markVisited(meta.id);
  if (section) requestAnimationFrame(() => document.getElementById(section)?.scrollIntoView({ block: 'start' }));
  else window.scrollTo(0, 0);
}

window.addEventListener('hashchange', () => void route());
window.addEventListener('scroll', () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
}, { passive: true });
void route().then(() => {
  (window as unknown as { __ready: boolean }).__ready = true;
});

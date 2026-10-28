import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/fraunces/opsz-italic.css';
import '@fontsource-variable/source-serif-4/opsz.css';
import '@fontsource-variable/source-serif-4/opsz-italic.css';
import '@fontsource-variable/jetbrains-mono';
import 'katex/dist/katex.min.css';
import './styles/base.css';
import './styles/components.css';

import { ATLAS_COURSE, DOMAINS, GRAPH } from './atlas/index';
import { icon } from './core/controls';
import { disposeAll, h } from './core/dom';
import { Learner } from './mastery/learner';
import { applyTheme, settingsButton } from './settings';
import { progressStore, startSync } from './sync/cloud';

applyTheme();
startSync();

const app = document.getElementById('app')!;
const main = h('main', { class: 'main', id: 'main' });
const nav = h('nav', { class: 'side', 'aria-label': 'Concepts' });
const scrim = h('div', { class: 'scrim' });
const menuBtn = h('button', { class: 'icon-btn menu-btn', type: 'button', 'aria-label': 'Concepts', html: icon('menu') });

const setNav = (open: boolean) => document.body.classList.toggle('nav-open', open);
menuBtn.addEventListener('click', () => setNav(!document.body.classList.contains('nav-open')));
scrim.addEventListener('click', () => setNav(false));

/** The site icon's mark: a causal attention pattern in the symbol colors, drawn with theme variables. */
const BRAND_MARK = (() => {
  const w = [[1, 0, 0], [0.4, 0.6, 0], [0.2, 0.3, 0.5]];
  const col = ['--c-blue', '--c-orange', '--c-green'];
  let cells = '';
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++)
      cells += `<rect x="${j * 7}" y="${i * 7}" width="6" height="6" rx="1.6" style="fill:var(${j > i ? '--rule' : col[j]});fill-opacity:${j > i ? 1 : (0.3 + 0.7 * w[i]![j]!).toFixed(2)}"/>`;
  return `<svg viewBox="0 0 20 20" aria-hidden="true">${cells}</svg>`;
})();
const brand = h('a', { class: 'brand', href: '#/atlas' },
  h('span', { class: 'brand-mark', html: BRAND_MARK }),
  h('span', { class: 'brand-name' }, ATLAS_COURSE.code.toLowerCase()),
  h('span', { class: 'brand-sub' }, 'interactive'));

const top = h('header', { class: 'topbar' }, menuBtn, brand, h('div', { class: 'topbar-spacer' }), settingsButton());

app.append(top, nav, scrim, main);

let currentId = '';
let renderToken = 0;

/** Atlas is the whole site: `#/atlas/...` and the account page; any other address lands on the Atlas home. */
async function route(): Promise<void> {
  const [, id = '', section = ''] = location.hash.replace(/^#\/?/, '#').split(/[#/]/);
  if (id === 'atlas') return routeAtlas();
  if (id === 'account' || id === 'link') return routeAccount(id === 'link' ? section : undefined);
  history.replaceState(null, '', '#/atlas');
  return routeAtlas();
}

async function routeAtlas(): Promise<void> {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).slice(1);
  const key = ['atlas', ...parts].join('/');
  if (key === currentId) return;
  const token = ++renderToken;
  disposeAll();
  currentId = key;
  main.innerHTML = '';
  buildNav(parts[0] ?? '');
  const c = parts[0] ? GRAPH.get(parts[0]) : undefined;
  document.title = c ? `${c.title} · atlas interactive` : `${ATLAS_COURSE.code}: ${ATLAS_COURSE.title} · interactive`;
  window.scrollTo(0, 0);
  try {
    const { renderAtlas } = await import('./mastery/ui/index');
    if (token !== renderToken) return;
    await renderAtlas(main, parts, () => token === renderToken);
  } catch (e) {
    console.error(e);
    if (await reloadIfStale()) return;
    main.innerHTML = '';
    main.append(h('div', { class: 'fig-error' }, `This page failed to load: ${(e as Error).message}`));
  }
}

async function routeAccount(code?: string): Promise<void> {
  const token = ++renderToken;
  disposeAll();
  currentId = code ? `link/${code}` : 'account';
  main.innerHTML = '';
  buildNav('');
  document.title = 'Sync across devices · atlas interactive';
  window.scrollTo(0, 0);
  // The code has done its job once read: keep it out of the history and of anything that shares this page.
  if (code) history.replaceState(null, '', '#/account');
  try {
    const { renderAccount } = await import('./sync/ui');
    if (token !== renderToken) return;
    renderAccount(main, code);
  } catch (e) {
    console.error(e);
    if (await reloadIfStale()) return;
    main.append(h('div', { class: 'fig-error' }, `This page failed to load: ${(e as Error).message}`));
  }
}

/**
 * Another device's progress arrived (or another tab's, or a link brought an account's): pages that only show progress
 * draw again where they were. Sessions, explainers, the track picker and the account page keep running as they are.
 */
function redrawOnRemoteProgress(): void {
  let due = 0;
  progressStore().on((next, prev, source) => {
    if (source === 'app' || next.records === prev.records) return;
    window.clearTimeout(due);
    due = window.setTimeout(() => {
      const [, a = '', b = '', c = ''] = location.hash.replace(/^#\/?/, '#').split(/[#/]/);
      const busy = a !== 'atlas' || b === 'learn' || b === 'place' || b === 'new-track' || c === 'watch';
      if (busy) return;
      const y = scrollY;
      currentId = '';
      void route().then(() => window.scrollTo(0, y));
    }, 150);
  });
}

/** The side menu: every concept by domain, marked mastered or locked. */
function buildNav(active: string): void {
  nav.innerHTML = '';
  const st = new Learner(GRAPH).statuses();
  nav.append(h('a', { class: 'side-course', href: '#/atlas' }, h('span', { class: 'side-course-code' }, ATLAS_COURSE.code), h('span', { class: 'side-course-title' }, ATLAS_COURSE.title)));
  for (const d of DOMAINS) {
    nav.append(h('div', { class: 'side-part' }, d.title));
    const ul = h('ul', { class: 'side-list' });
    for (const c of GRAPH.order.filter((x) => x.domain === d.id)) {
      const s = st.get(c.id)!;
      const mark = s === 'mastered' || s === 'due' ? h('span', { class: 'side-mark done', html: icon('check') }) : s === 'locked' ? h('span', { class: 'side-mark at-side-lock', html: icon('lock') }) : '';
      const a = h('a', { href: `#/atlas/${c.id}`, class: `side-link${c.id === active ? ' on' : ''}${s === 'locked' ? ' soon' : ''}` },
        h('span', { class: 'side-num', style: `color:var(--c-${d.color})` }, '●'),
        h('span', { class: 'side-title' }, c.title),
        mark);
      a.addEventListener('click', () => setNav(false));
      ul.append(h('li', {}, a));
    }
    nav.append(ul);
  }
  nav.append(h('div', { class: 'side-foot' }, `${GRAPH.order.length} concepts, and growing.`));
}

/**
 * A tab opened before a redeploy runs the old build, whose lazy chunks no longer exist. When the
 * served page names a different entry script, reloads into it (once per build) and returns true.
 */
async function reloadIfStale(): Promise<boolean> {
  const entry = new URL(import.meta.url).pathname.split('/').pop();
  let served: string | undefined;
  try {
    const res = await fetch(location.pathname, { cache: 'no-store' });
    if (res.ok) served = (await res.text()).match(/index-[\w-]+\.js/)?.[0];
  } catch {
    return false;
  }
  if (!served || served === entry) return false;
  try {
    if (sessionStorage.getItem('cs231n.reloadedFor') === served) return false;
    sessionStorage.setItem('cs231n.reloadedFor', served);
  } catch {
    return false;
  }
  location.reload();
  return true;
}

window.addEventListener('hashchange', () => void route());
redrawOnRemoteProgress();
void route().then(() => {
  (window as unknown as { __ready: boolean }).__ready = true;
});

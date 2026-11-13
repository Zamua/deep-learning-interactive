import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/fraunces/opsz-italic.css';
import '@fontsource-variable/source-serif-4/opsz.css';
import '@fontsource-variable/source-serif-4/opsz-italic.css';
import '@fontsource-variable/jetbrains-mono';
import 'katex/dist/katex.min.css';
import './styles/base.css';
import './styles/components.css';

import type { Course } from './courses/course';
import { COURSES, courseById, FIRST } from './courses/index';
import { icon } from './core/controls';
import { disposeAll, h } from './core/dom';
import { Learner } from './mastery/learner';
import { saveAhead } from './offline/ahead';
import { keepCoursesSaved } from './offline/save-courses';
import { checkForNewWorker, startOffline } from './offline/register';
import { getItem, setItem } from './core/storage';
import { applyTheme, settingsButton } from './settings';
import { progressStore, startSync } from './sync/cloud';
import { parseRoute, routes, type CourseRoute, type Route } from './routes';

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
const brand = h('a', { class: 'brand', href: routes.topics, 'aria-label': 'Atlas: all topics' },
  h('span', { class: 'brand-mark', html: BRAND_MARK }),
  h('span', { class: 'brand-name' }, 'atlas'));

/** The course opened last on this device, whose concepts the menu lists on the account page. */
const LAST_COURSE = 'atlas.course';
const lastCourse = (): Course => courseById(getItem(LAST_COURSE) ?? '') ?? FIRST;

const top = h('header', { class: 'topbar' }, menuBtn, brand, h('div', { class: 'topbar-spacer' }), settingsButton());

app.append(top, nav, scrim, main);

let currentId = '';
let renderToken = 0;

/** A course's pages, the account page and the topics page, which any other address or an unknown course lands on. */
/** Draws the page for the address, then has the narration that comes next saved, since an answer may have moved it. */
async function route(): Promise<void> {
  await show();
  const page = parseRoute(location.hash)?.page;
  if (page && !BUSY.has(page)) saveAhead();
}

async function show(): Promise<void> {
  setNav(false);
  const r = parseRoute(location.hash);
  if (r?.page === 'account') return routeAccount(r.code);
  if (r && r.page !== 'topics') {
    const course = courseById(r.course);
    if (course) return routeCourse(r, course);
  }
  if (r?.page !== 'topics') history.replaceState(null, '', routes.topics);
  return routeTopics();
}

async function routeCourse(r: CourseRoute, course: Course): Promise<void> {
  const key = location.hash.replace(/\/+$/, '');
  if (key === currentId) return;
  const token = ++renderToken;
  disposeAll();
  currentId = key;
  main.innerHTML = '';
  setItem(LAST_COURSE, course.id);
  const shown = r.page === 'concept' || r.page === 'watch' ? r.concept : undefined;
  buildNav(course, r.page === 'history' ? 'history' : shown ?? '');
  const c = shown ? course.graph.get(shown) : undefined;
  document.title = c ? `${c.title} · Atlas` : `${course.title} · Atlas`;
  window.scrollTo(0, 0);
  try {
    const { renderAtlas } = await import('./mastery/ui/index');
    if (token !== renderToken) return;
    await renderAtlas(main, r, () => token === renderToken);
  } catch (e) {
    console.error(e);
    if (await reloadIfStale()) return;
    loadFailed(e);
  }
}

async function routeTopics(): Promise<void> {
  if (currentId === 'topics') return;
  const token = ++renderToken;
  disposeAll();
  currentId = 'topics';
  main.innerHTML = '';
  buildNav(null, '');
  document.title = 'Atlas';
  window.scrollTo(0, 0);
  try {
    const { renderTopics } = await import('./mastery/ui/index');
    if (token !== renderToken) return;
    renderTopics(main);
  } catch (e) {
    console.error(e);
    if (await reloadIfStale()) return;
    loadFailed(e);
  }
}

async function routeAccount(code?: string): Promise<void> {
  const token = ++renderToken;
  disposeAll();
  currentId = code ? `link/${code}` : 'account';
  main.innerHTML = '';
  buildNav(lastCourse(), '');
  document.title = 'Sync across devices · Atlas';
  window.scrollTo(0, 0);
  // The code has done its job once read: keep it out of the history and of anything that shares this page.
  if (code) history.replaceState(null, '', routes.account);
  try {
    const [{ renderAccount }, { progressFile }] = await Promise.all([import('./sync/ui'), import('./mastery/ui/progress-file')]);
    if (token !== renderToken) return;
    renderAccount(main, code, progressFile());
  } catch (e) {
    console.error(e);
    if (await reloadIfStale()) return;
    loadFailed(e);
  }
}

/**
 * Another device's progress arrived (or another tab's, or a link brought an account's): pages that only show progress
 * draw again where they were. Sessions, explainers, the track picker and the account page keep running as they are.
 */
/** Pages that are under way, which synced progress never redraws. */
const BUSY = new Set<Route['page']>(['account', 'learn', 'place', 'new-track', 'watch']);

function redrawOnRemoteProgress(): void {
  let due = 0;
  progressStore().on((next, prev, source) => {
    if (source === 'app' || next.records === prev.records) return;
    window.clearTimeout(due);
    due = window.setTimeout(() => {
      const page = parseRoute(location.hash)?.page;
      if (!page || BUSY.has(page)) return;
      const y = scrollY;
      currentId = '';
      void route().then(() => window.scrollTo(0, y));
    }, 150);
  });
}

/** The side menu: the way to every topic, then the open course's concepts by domain, marked mastered or locked. */
function buildNav(course: Course | null, active: string): void {
  nav.innerHTML = '';
  const link = (href: string, cls: string, ...kids: (HTMLElement | string)[]) => {
    const a = h('a', { class: cls, href }, ...kids);
    a.addEventListener('click', () => setNav(false));
    return a;
  };
  if (!course) {
    nav.append(h('div', { class: 'side-part' }, 'Topics'), ...COURSES.map((c) => link(c.routes.home, 'side-course other', h('span', { class: 'side-course-title' }, c.title))));
    return;
  }
  const { graph, routes: pages } = course;
  const st = new Learner(course).statuses();
  nav.append(link(pages.home, 'side-course', h('span', { class: 'side-course-code' }, 'Topic'), h('span', { class: 'side-course-title' }, course.title)));
  const hist = h('a', { class: `side-link${active === 'history' ? ' on' : ''}`, href: pages.history }, h('span', { class: 'side-num', html: icon('clock') }), h('span', { class: 'side-title' }, 'History'));
  hist.addEventListener('click', () => setNav(false));
  nav.append(h('ul', { class: 'side-list' }, h('li', {}, hist)));
  for (const d of course.domains) {
    nav.append(h('div', { class: 'side-part' }, d.title));
    const ul = h('ul', { class: 'side-list' });
    for (const c of graph.order.filter((x) => x.domain === d.id)) {
      const s = st.get(c.id)!;
      const mark = s === 'mastered' || s === 'due' ? h('span', { class: 'side-mark done', html: icon('check') }) : s === 'locked' ? h('span', { class: 'side-mark at-side-lock', html: icon('lock') }) : '';
      const a = h('a', { href: pages.concept(c.id), class: `side-link${c.id === active ? ' on' : ''}${s === 'locked' ? ' soon' : ''}` },
        h('span', { class: 'side-num', style: `color:var(--c-${d.color})` }, '●'),
        h('span', { class: 'side-title' }, c.title),
        mark);
      a.addEventListener('click', () => setNav(false));
      ul.append(h('li', {}, a));
    }
    nav.append(ul);
  }
  nav.append(h('div', { class: 'side-foot' }, `${graph.order.length} concepts`));
}

/**
 * A page could not be drawn. With no connection that means a file Atlas has not saved yet, so say that and offer
 * another try, not the loader's own words.
 */
function loadFailed(e: unknown): void {
  const offline = !navigator.onLine || /preload|dynamically imported|module script|Failed to fetch|Load failed/i.test((e as Error)?.message ?? '');
  const again = h('button', { class: 'btn', type: 'button' }, 'Try again');
  again.addEventListener('click', () => location.reload());
  main.innerHTML = '';
  main.append(
    h('div', { class: 'load-failed' },
      h('h1', { class: 'home-title' }, offline ? 'This page is not saved yet.' : 'This page did not load.'),
      h('p', {}, offline
        ? 'Open Atlas once with a connection and leave it open for a minute. The gear menu says "Works offline" when it has saved the rest.'
        : `Something went wrong while drawing it: ${(e as Error)?.message ?? 'unknown error'}`),
      again));
}

/**
 * A tab opened before a redeploy runs the old build, whose lazy chunks no longer exist. When the served page names a
 * different entry script, reloads into it (once per build) and returns true. Under a service worker the page never
 * asks: the worker brings the next build in whole, and `followNewBuilds` reloads then.
 */
async function reloadIfStale(): Promise<boolean> {
  if (navigator.serviceWorker?.controller) return false;
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

/** Time away after which coming back looks for a new build. */
const AWAY = 60_000;

/**
 * iOS resumes an installed app without loading anything, so without this it keeps its old build until it is force
 * closed. Looks for a new build at launch and on coming back, and moves to it unless something is under way.
 */
function followNewBuilds(): void {
  const busy = () => {
    const page = parseRoute(location.hash)?.page;
    return !page || BUSY.has(page);
  };
  const check = () => {
    checkForNewWorker();
    if (!busy()) void reloadIfStale();
  };
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt >= AWAY) check();
  });
  // A new worker took over, with all of its build saved: move onto it, but never out of a session or an explainer.
  const sw = navigator.serviceWorker;
  if (sw) {
    let had = !!sw.controller;
    let waiting = false;
    const move = () => {
      if (busy()) return void (waiting = true);
      location.reload();
    };
    sw.addEventListener('controllerchange', () => {
      if (had) move();
      had = true;
    });
    window.addEventListener('hashchange', () => {
      if (waiting) move();
    });
  }
  check();
}

window.addEventListener('hashchange', () => void route());
redrawOnRemoteProgress();
void route().then(() => {
  (window as unknown as { __ready: boolean }).__ready = true;
  startOffline();
  followNewBuilds();
  // A save that the connection cut short picks up when it returns.
  window.addEventListener('online', saveAhead);
  keepCoursesSaved();
});

import '@fontsource-variable/jetbrains-mono';
import 'katex/dist/katex.min.css';
import './styles/base.css';
import './styles/components.css';

import type { Course } from './courses/course';
import { courseById } from './courses/index';
import { icon } from './core/controls';
import { disposeAll, h } from './core/dom';
import { loadNote, patiently, stylesReady } from './core/waiting';
import { renderShelf } from './mastery/ui/shelf';
import { checkForNewWorker, startOffline } from './offline/register';
import { applyTheme } from './theme';
import { progressStore, startSync } from './sync/cloud';
import { parseRoute, routes, type CourseRoute, type Route, type SitePage } from './routes';

applyTheme();
startSync();

type Tab = 'shelf' | 'review' | 'path' | 'settings';
const TABS: [Tab, string, string, string][] = [
  ['shelf', 'books', 'Shelf', routes.shelf],
  ['review', 'stack', 'Review', routes.review],
  ['path', 'compass', 'Path', routes.path],
  ['settings', 'gear', 'Settings', routes.settings],
];

const app = document.getElementById('app')!;
const main = h('main', { class: 'main', id: 'main' });
const links = TABS.map(([id, glyph, label, href]) => h('a', { class: 'tab', href, 'data-tab': id, html: `${icon(glyph)}<span>${label}</span>` }));
app.replaceChildren(h('nav', { class: 'tabs', 'aria-label': 'Sections' }, ...links), main);

function setTab(tab: Tab): void {
  for (const a of links) {
    const on = a.dataset.tab === tab;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

let currentId = '';
let renderToken = 0;

/** Draws a page, once what it needs has loaded. */
type Render = () => void | Promise<void>;

/**
 * Shows the page `load` brings, unless the address already shows it. A placeholder stands in at the page's size until
 * the page has everything it waits for, and a load that stalls or fails says so and offers a retry.
 */
async function show(key: string, title: string, tab: Tab, load: () => Promise<Render>): Promise<void> {
  if (key === currentId) return;
  const token = ++renderToken;
  disposeAll();
  currentId = key;
  const stand = h('div', { class: 'sk-wrap', html: window.atlasBoot.placeholder(window.atlasBoot.kindOf(location.hash)) });
  main.replaceChildren(stand);
  setTab(tab);
  document.title = `${title} · Atlas`;
  window.scrollTo(0, 0);
  try {
    const render = await patiently(load());
    if (token !== renderToken) return;
    await render();
    if (token === renderToken) stand.remove();
  } catch (e) {
    console.error(e);
    if (await reloadIfStale()) return;
    if (token === renderToken) loadNote('This page could not load. Check your connection.');
  }
}

/** A course's pages, the site's, and the account's; any other address, or an unknown course, lands on the shelf. */
async function route(): Promise<void> {
  const r = parseRoute(location.hash);
  if (r?.page === 'account') return routeAccount(r.code);
  if (r && !('course' in r)) return routeSite(r.page);
  const course = r && courseById(r.course);
  if (r && course) return routeCourse(r, course);
  history.replaceState(null, '', routes.shelf);
  return routeSite('shelf');
}

const SITE_TITLE: Record<SitePage, string> = { shelf: 'Library', review: 'Review', path: 'Your path', settings: 'Settings' };

function routeSite(page: SitePage): Promise<void> {
  return show(page, SITE_TITLE[page], page, async () => {
    if (page === 'shelf') return () => renderShelf(main);
    const [{ renderSite }] = await Promise.all([import('./mastery/ui/index'), stylesReady()]);
    return () => renderSite(main, page);
  });
}

/** The tab a course's page sits under. */
function tabOf(r: CourseRoute): Tab {
  if (r.page === 'track' || r.page === 'new-track' || r.page === 'place') return 'path';
  return r.page === 'history' ? 'review' : 'shelf';
}

function routeCourse(r: CourseRoute, course: Course): Promise<void> {
  const shown = r.page === 'concept' || r.page === 'watch' ? r.concept : undefined;
  const c = shown ? course.graph.get(shown) : undefined;
  return show(location.hash.replace(/\/+$/, ''), c ? c.title : course.title, tabOf(r), async () => {
    const [{ renderAtlas }] = await Promise.all([import('./mastery/ui/index'), stylesReady()]);
    const token = renderToken;
    return () => renderAtlas(main, r, () => token === renderToken);
  });
}

function routeAccount(code?: string): Promise<void> {
  return show(code ? `link/${code}` : 'account', 'Sync across devices', 'settings', async () => {
    // The code has done its job once read: keep it out of the history and of anything that shares this page.
    if (code) history.replaceState(null, '', routes.account);
    const [{ renderAccount }, { progressFile }] = await Promise.all([import('./sync/ui'), import('./mastery/ui/progress-file'), stylesReady()]);
    return () => renderAccount(main, code, progressFile());
  });
}

/**
 * Another device's progress arrived (or another tab's, or a link brought an account's): pages that only show progress
 * draw again where they were. Sessions, explainers, the track picker, settings and the account page keep running as they are.
 */
/** Pages that are under way, which synced progress never redraws. */
const BUSY = new Set<Route['page']>(['account', 'settings', 'learn', 'place', 'new-track', 'watch']);

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

/** Time away after which coming back looks for a new build. */
const AWAY = 60_000;

/**
 * iOS resumes an installed app without loading anything, so without this it keeps its old build until it is force
 * closed. Looks for a new build at launch and on coming back, and moves to it unless something is under way.
 */
function followNewBuilds(): void {
  const check = () => {
    checkForNewWorker();
    const page = parseRoute(location.hash)?.page;
    if (page && !BUSY.has(page)) void reloadIfStale();
  };
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') hiddenAt = Date.now();
    else if (hiddenAt && Date.now() - hiddenAt >= AWAY) check();
  });
  check();
}

window.addEventListener('hashchange', () => void route());
redrawOnRemoteProgress();
void route().then(() => {
  (window as unknown as { __ready: boolean }).__ready = true;
  startOffline();
  followNewBuilds();
  // The other pages' code, while nothing is waiting on it.
  void import('./mastery/ui/index').catch(() => {});
});

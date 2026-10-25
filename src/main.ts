import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/fraunces/opsz-italic.css';
import '@fontsource-variable/source-serif-4/opsz.css';
import '@fontsource-variable/source-serif-4/opsz-italic.css';
import '@fontsource-variable/jetbrains-mono';
import 'katex/dist/katex.min.css';
import './styles/base.css';
import './styles/components.css';

import { CHAPTERS, COURSES, type ChapterMeta, type CourseMeta, hasChapter, loadChapter } from './chapters/index';
import { icon } from './core/controls';
import { disposeAll, h, onDispose } from './core/dom';
import { Page } from './core/page';
import { DONE, lectureState, readState, saveRead } from './core/progress';
import { progressMark, renderCourse, renderIndex } from './home';
import { hasLecture, loadLecture } from './lectures/index';
import { ATLAS_COURSE, DOMAINS, GRAPH } from './atlas/index';
import { Learner } from './mastery/learner';
import { applyTheme, settingsButton } from './settings';

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

applyTheme();

const app = document.getElementById('app')!;
const main = h('main', { class: 'main', id: 'main' });
const nav = h('nav', { class: 'side', 'aria-label': 'Chapters' });
const scrim = h('div', { class: 'scrim' });
const menuBtn = h('button', { class: 'icon-btn menu-btn', type: 'button', 'aria-label': 'Chapters', html: icon('menu') });
const progress = h('div', { class: 'read-progress' });

const setNav = (open: boolean) => document.body.classList.toggle('nav-open', open);
menuBtn.addEventListener('click', () => setNav(!document.body.classList.contains('nav-open')));
scrim.addEventListener('click', () => setNav(false));

const brandName = h('span', { class: 'brand-name' });
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
const brand = h('a', { class: 'brand' }, h('span', { class: 'brand-mark', html: BRAND_MARK }), brandName, h('span', { class: 'brand-sub' }, 'interactive'));
/** The top bar names the course being read, and leads back to its contents; outside a course, the index. */
function setBrand(course: Pick<CourseMeta, 'id' | 'code'> | null): void {
  brandName.textContent = course ? course.code.toLowerCase() : 'deep learning';
  brand.setAttribute('href', course ? `#/${course.id}` : '#/');
  document.body.classList.toggle('in-course', !!course);
}

const top = h('header', { class: 'topbar' },
  menuBtn,
  brand,
  h('div', { class: 'topbar-spacer' }),
  settingsButton(),
  progress);

app.append(top, nav, scrim, main);

const courseOf = (c: ChapterMeta): CourseMeta => COURSES.find((k) => k.id === c.course)!;

function buildNav(course: CourseMeta | null, active: string): void {
  nav.innerHTML = '';
  if (!course) {
    nav.append(h('div', { class: 'side-part' }, 'Courses'));
    const ul = h('ul', { class: 'side-list' });
    for (const k of [...COURSES, ATLAS_COURSE]) {
      const a = h('a', { href: `#/${k.id}`, class: 'side-link' }, h('span', { class: 'side-num' }, k.code), h('span', { class: 'side-title' }, k.title));
      a.addEventListener('click', () => setNav(false));
      ul.append(h('li', {}, a));
    }
    nav.append(ul);
    return;
  }
  const all = h('a', { class: 'side-all', href: '#/', html: `${icon('arrowLeft')} All courses` });
  all.addEventListener('click', () => setNav(false));
  nav.append(all, h('a', { class: 'side-course', href: `#/${course.id}` }, h('span', { class: 'side-course-code' }, course.code), h('span', { class: 'side-course-title' }, course.title)));
  for (const part of course.parts) {
    const items = CHAPTERS.filter((c) => c.course === course.id && c.part === part);
    nav.append(h('div', { class: 'side-part' }, part));
    const ul = h('ul', { class: 'side-list' });
    for (const c of items) {
      const a = h('a', { href: `#/${c.id}`, class: `side-link${c.id === active ? ' on' : ''}${hasChapter(c.id) ? '' : ' soon'}` },
        h('span', { class: 'side-num' }, c.num),
        h('span', { class: 'side-title' }, c.title.replace(/^Assignment \d: /, '')),
        progressMark(c, 'side-mark'));
      a.addEventListener('click', () => setNav(false));
      ul.append(h('li', {}, a));
    }
    nav.append(ul);
  }
  nav.append(h('div', { class: 'side-foot' }, course.id === 'cs231n' ? 'An unofficial companion to Stanford CS231n (Winter 2016).' : `${course.code}: ${course.era}.`));
}

function chapterHeader(meta: ChapterMeta): HTMLElement {
  const metaRow = h('div', { class: 'ch-meta' });
  if (meta.lectures) metaRow.append(h('span', { class: 'tag' }, meta.lectures));
  for (const n of meta.notes ?? []) metaRow.append(h('a', { class: 'tag tag-link', href: n.url, target: '_blank', rel: 'noopener', html: `${icon('book')}${n.title}` }));
  return h('header', { class: 'ch-head' },
    h('div', { class: 'ch-part' }, `${courseOf(meta).code} · ${meta.part}`),
    h('div', { class: 'ch-num', 'aria-hidden': 'true' }, meta.num),
    h('h1', { class: 'ch-title' }, meta.title),
    h('p', { class: 'ch-blurb' }, meta.blurb),
    metaRow);
}

/** The chapter's three layers: watch the lecture, explore the interactive chapter, practice. */
function layers(meta: ChapterMeta, body: HTMLElement): HTMLElement {
  const watchK = h('div', { class: 'layer-k' }, 'Watch');
  const ls = lectureState(meta.id);
  const heard = ls ? `${Math.round(ls.heard * 100)}% heard` : '';
  const status = !ls ? '' : ls.pos > 0 ? `Resume at ${mmss(ls.pos)} · ${heard}` : ls.heard >= DONE ? 'Watched' : ls.heard >= 0.02 ? heard : '';
  const explore = h('button', { class: 'layer', type: 'button' },
    h('span', { class: 'layer-n' }, '2'),
    h('span', { class: 'layer-body' }, h('div', { class: 'layer-k' }, 'Explore')));
  explore.addEventListener('click', () => body.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  const pr = meta.practice;
  const practiceBody = h('span', { class: 'layer-body' }, h('div', { class: 'layer-k' }, 'Practice'), h('div', { class: 'layer-t' }, pr?.text ?? 'Coming soon.'));
  const practice = pr?.id
    ? h('a', { class: 'layer', href: `#/${pr.id}` }, h('span', { class: 'layer-n' }, '3'), practiceBody)
    : h('div', { class: 'layer layer-muted' }, h('span', { class: 'layer-n' }, '3'), practiceBody);
  const el = h('div', { class: 'layers' },
    h('a', { class: 'layer layer-watch', href: `#/watch/${meta.id}` },
      h('span', { class: 'layer-n', html: icon('playFill') }),
      h('span', { class: 'layer-body' }, watchK, status ? h('div', { class: 'layer-s' }, status) : ''),
      h('span', { class: 'layer-go', html: icon('arrowRight') })),
    explore,
    practice);
  void loadLecture(meta.id)?.then((d) => {
    if (d.timing) watchK.textContent = `Watch · ${Math.round(d.timing.duration / 60)} min`;
  });
  return el;
}

function chapterFooter(meta: ChapterMeta): HTMLElement {
  const list = CHAPTERS.filter((c) => c.course === meta.course);
  const i = list.indexOf(meta);
  const prev = list[i - 1];
  const next = list[i + 1];
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
  // The reading bar is for chapters, the only long pages; elsewhere it would track nothing.
  progress.hidden = !CHAPTERS.some((c) => c.id === id);
  if (id === 'atlas') {
    await routeAtlas();
    return;
  }
  const key = id === 'watch' ? `watch/${section}` : id;
  if (key === currentId && currentId) {
    if (section && id !== 'watch') document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const token = ++renderToken;
  disposeAll();
  currentId = key;
  main.innerHTML = '';
  if (id === 'watch') {
    await renderWatch(section, token);
    return;
  }
  const meta = CHAPTERS.find((c) => c.id === id);
  const course = meta ? courseOf(meta) : (COURSES.find((k) => k.id === id) ?? null);
  setBrand(course);
  buildNav(course, id);
  if (!meta) {
    if (course) {
      document.title = `${course.code}: ${course.title} · interactive`;
      renderCourse(main, course);
    } else {
      document.title = 'Deep learning, interactive';
      renderIndex(main);
    }
    window.scrollTo(0, 0);
    return;
  }
  document.title = `${meta.num}. ${meta.title} · ${courseOf(meta).code.toLowerCase()} interactive`;
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
  let toc: { id: string; title: string }[] = [];
  try {
    const def = await pending;
    if (token !== renderToken) return;
    body.innerHTML = '';
    if (hasLecture(meta.id)) article.insertBefore(layers(meta, body), body);
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
    toc = page.toc;
    if (page.toc.length > 2) {
      const toc = h('nav', { class: 'ch-toc', 'aria-label': 'On this page' }, h('div', { class: 'ch-toc-head' }, 'On this page'));
      const ol = h('ol', {});
      for (const t of page.toc) ol.append(h('li', {}, h('a', { href: `#/${meta.id}/${t.id}` }, t.title)));
      toc.append(ol);
      article.insertBefore(toc, body);
    }
  } catch (e) {
    console.error(e);
    if (await reloadIfStale()) return;
    body.innerHTML = '';
    body.append(h('div', { class: 'fig-error' }, `This chapter failed to load: ${(e as Error).message}`));
  }
  article.append(chapterFooter(meta));
  if (section) requestAnimationFrame(() => document.getElementById(section)?.scrollIntoView({ block: 'start' }));
  else window.scrollTo(0, 0);
  trackReading(meta, article, toc, !section);
}

async function routeAtlas(): Promise<void> {
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).slice(1);
  const key = ['atlas', ...parts].join('/');
  if (key === currentId) return;
  const token = ++renderToken;
  disposeAll();
  currentId = key;
  main.innerHTML = '';
  setBrand(ATLAS_COURSE);
  buildAtlasNav(parts[0] ?? '');
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

function buildAtlasNav(active: string): void {
  nav.innerHTML = '';
  const st = new Learner(GRAPH).statuses();
  const all = h('a', { class: 'side-all', href: '#/', html: `${icon('arrowLeft')} All courses` });
  all.addEventListener('click', () => setNav(false));
  nav.append(all, h('a', { class: 'side-course', href: '#/atlas' }, h('span', { class: 'side-course-code' }, ATLAS_COURSE.code), h('span', { class: 'side-course-title' }, ATLAS_COURSE.title)));
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
 * Records how far down the chapter the viewer has read and the section they are in, and offers to
 * jump back to where they left off. Only the viewer's own scrolling counts, not the jump to the top.
 */
function trackReading(meta: ChapterMeta, article: HTMLElement, toc: { id: string; title: string }[], offer: boolean): void {
  const prev = readState(meta.id);
  const resumeAt = offer && toc.find((t) => t.id === prev.at && t !== toc[0]);
  const chip = resumeAt
    ? h('button', { class: 'resume-chip', type: 'button', html: `${icon('arrowRight')}<span>Continue at <b></b></span>` })
    : null;
  if (chip && resumeAt) {
    chip.querySelector('b')!.textContent = resumeAt.title;
    chip.addEventListener('click', () => {
      chip.remove();
      document.getElementById(resumeAt.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.body.append(chip);
  }
  const save = () => {
    const r = article.getBoundingClientRect();
    let at = '';
    for (const t of toc) if ((document.getElementById(t.id)?.getBoundingClientRect().top ?? Infinity) < 120) at = t.id;
    saveRead(meta.id, Math.min(1, Math.max(0, (innerHeight - r.top) / r.height)), at);
  };
  let due = 0;
  let armed = false;
  let moved = false;
  const arm = window.setTimeout(() => (armed = true), 600);
  const onScroll = () => {
    if (!armed) return;
    moved = true;
    if (chip && scrollY > 600) chip.remove();
    window.clearTimeout(due);
    due = window.setTimeout(save, 300);
  };
  const onHide = () => moved && save();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('pagehide', onHide);
  onDispose(() => {
    onHide();
    window.clearTimeout(arm);
    window.clearTimeout(due);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('pagehide', onHide);
    chip?.remove();
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

async function renderWatch(id: string, token: number): Promise<void> {
  const meta = CHAPTERS.find((c) => c.id === id);
  const pending = meta ? loadLecture(meta.id) : null;
  if (!meta || !pending) {
    location.replace(meta ? `#/${meta.id}` : '#/');
    return;
  }
  document.title = `Lecture: ${meta.title} · ${courseOf(meta).code.toLowerCase()} interactive`;
  main.append(h('div', { class: 'loading' }, 'Loading the lecture…'));
  try {
    const [def, { mountLecture }] = await Promise.all([pending, import('./lecture/player')]);
    if (token !== renderToken) return;
    main.innerHTML = '';
    mountLecture(main, def, {
      back: `#/${meta.id}`,
      kicker: `Chapter ${meta.num} · Lecture`,
      poster: [`Chapter ${meta.num}`, 'Lecture'],
      artist: `Chapter ${meta.num}: ${meta.title}`,
      noun: 'lecture',
      end: { kicker: 'That was the lecture', title: 'Now explore it yourself', action: 'Open the chapter', href: `#/${meta.id}` },
    });
  } catch (e) {
    console.error(e);
    if (await reloadIfStale()) return;
    main.innerHTML = '';
    main.append(h('div', { class: 'fig-error' }, `The lecture failed to load: ${(e as Error).message}`));
  }
}

window.addEventListener('hashchange', () => void route());
window.addEventListener('scroll', () => {
  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
}, { passive: true });
void route().then(() => {
  (window as unknown as { __ready: boolean }).__ready = true;
});

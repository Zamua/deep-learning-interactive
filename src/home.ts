import { CHAPTERS, COURSES, type ChapterMeta, type CourseMeta, hasChapter } from './chapters/index';
import { icon } from './core/controls';
import { h } from './core/dom';
import { md } from './core/math';
import { DONE, last, lectureState, readState } from './core/progress';
import { hasLecture, loadLecture } from './lectures/index';
import { ATLAS_COURSE, GRAPH } from './atlas/index';
import { Learner, type Today } from './mastery/learner';

const pct = (f: number) => `${Math.round(f * 100)}%`;
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/** Reading below this share is just the first screen of a chapter, not progress. */
const STARTED = 0.1;

/** How far a chapter has got on this device: share read, share of its lecture heard, and overall. */
export function chapterProgress(c: ChapterMeta): { read: number; heard: number | null; frac: number; done: boolean } {
  const read = readState(c.id).max;
  const heard = hasLecture(c.id) ? (lectureState(c.id)?.heard ?? 0) : null;
  const parts = heard === null ? [read] : [read, heard];
  const frac = parts.reduce((a, p) => a + Math.min(1, p / DONE), 0) / parts.length;
  return { read, heard, frac, done: parts.every((p) => p >= DONE) };
}

/** A check for a finished chapter, a ring filled to its share for a started one, else nothing. */
export function progressMark(c: ChapterMeta, cls: string): HTMLElement | '' {
  const p = chapterProgress(c);
  if (p.done) return h('span', { class: `${cls} done`, title: 'Done', html: icon('check') });
  if (p.read < STARTED && !p.heard) return '';
  const r = 5;
  const len = 2 * Math.PI * r;
  return h('span', {
    class: cls,
    title: `${pct(p.frac)} done`,
    html: `<svg viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="${r}"/><circle class="arc" cx="7" cy="7" r="${r}" stroke-dasharray="${(p.frac * len).toFixed(2)} ${len.toFixed(2)}"/></svg>`,
  });
}

/** A small progress ring, filled to `f`. */
function ring(f: number): string {
  const r = 12;
  const len = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="${r}"/><circle class="arc" cx="15" cy="15" r="${r}" stroke-dasharray="${(Math.min(1, f) * len).toFixed(2)} ${len.toFixed(2)}"/></svg>`;
}

interface Lead {
  kicker: string;
  title: string;
  sub: string;
  href: string;
  action: string;
  icon: string;
  second?: { href: string; action: string; icon: string };
  /** Epoch ms of the activity it continues; 0 for a suggestion. */
  t: number;
}

const chapterLabel = (c: ChapterMeta) => (c.num.startsWith('A') ? c.title : `${c.num}. ${c.title}`);
const courseCode = (c: ChapterMeta) => COURSES.find((k) => k.id === c.course)!.code;

/** The chapter to do next in a course: the first one not yet done, in course order. */
function nextChapter(course: CourseMeta): ChapterMeta | undefined {
  return CHAPTERS.filter((c) => c.course === course.id && hasChapter(c.id)).find((c) => !chapterProgress(c).done);
}

/** Picks up the latest chapter or lecture, or offers what comes after it. */
function chapterLead(course: CourseMeta | null): Lead | null {
  const l = last();
  const c = l && CHAPTERS.find((x) => x.id === l.id);
  if (!l || !c || (course && c.course !== course.id)) return null;
  const lec = lectureState(c.id);
  if (l.kind === 'lecture' && lec && lec.pos > 0) {
    return { kicker: 'Pick up where you left off', title: chapterLabel(c), sub: `${courseCode(c)} · lecture at ${mmss(lec.pos)}`, href: `#/watch/${c.id}`, action: 'Resume', icon: 'playFill', t: l.t };
  }
  const read = readState(c.id);
  if (read.max < DONE && (l.kind === 'chapter' || hasChapter(c.id))) {
    return { kicker: 'Pick up where you left off', title: chapterLabel(c), sub: `${courseCode(c)} · ${read.max >= STARTED ? `${pct(read.max)} read` : 'the chapter'}`, href: `#/${c.id}${read.at ? `/${read.at}` : ''}`, action: 'Continue reading', icon: 'book', t: l.t };
  }
  const next = nextChapter(COURSES.find((k) => k.id === c.course)!);
  return next ? watchOrRead(next, 'Up next', l.t) : null;
}

/** A chapter to start: its lecture first when it has one. */
function watchOrRead(c: ChapterMeta, kicker: string, t: number): Lead {
  return hasLecture(c.id)
    ? { kicker, title: chapterLabel(c), sub: `${courseCode(c)} · lecture, then the chapter`, href: `#/watch/${c.id}`, action: 'Watch', icon: 'playFill', second: { href: `#/${c.id}`, action: 'Read', icon: 'book' }, t }
    : { kicker, title: chapterLabel(c), sub: courseCode(c), href: `#/${c.id}`, action: 'Read', icon: 'book', t };
}

/** Atlas's next step, as a lead. */
export function atlasLead(d: Today): Lead | null {
  const title = (id: string) => GRAPH.get(id)!.title;
  switch (d.kind) {
    case 'start':
      return null;
    case 'learning':
      if (d.slipping) return { kicker: 'Atlas · win it back', title: title(d.concept!), sub: `Slipped on a review: ${d.need} right in a row win it back`, href: '#/atlas/learn', action: 'Practice', icon: 'playFill', t: d.t };
      return { kicker: 'Atlas · in progress', title: title(d.concept!), sub: `${d.streak} of ${d.need} right in a row${d.opens?.length ? ` · then ${d.opens.map(title).join(', ')} opens` : ''}`, href: '#/atlas/learn', action: 'Practice', icon: 'playFill', t: d.t };
    case 'new':
      return { kicker: 'Atlas · up next', title: title(d.concept!), sub: 'A new concept: explainer, then practice', href: '#/atlas/learn', action: 'Start', icon: 'playFill', t: d.t };
    case 'review':
      return { kicker: 'Atlas · review', title: `${d.due} ${d.due === 1 ? 'review' : 'reviews'} due`, sub: `One problem each, before anything new${d.after ? `; then ${title(d.after)}` : ''}`, href: '#/atlas/learn', action: 'Start reviews', icon: 'playFill', t: d.t };
    case 'done':
      return null;
  }
}

function leadCard(l: Lead): HTMLElement {
  return h('div', { class: 'lead' },
    h('div', { class: 'lead-k' }, l.kicker),
    h('div', { class: 'lead-t' }, l.title),
    h('div', { class: 'lead-s' }, l.sub),
    h('div', { class: 'lead-actions' },
      h('a', { class: 'lead-go', href: l.href, html: `${icon(l.icon)} ${l.action}` }),
      l.second ? h('a', { class: 'lead-alt', href: l.second.href, html: `${icon(l.second.icon)} ${l.second.action}` }) : ''));
}

/** The index: whatever was last in progress, then the courses as tiles. */
export function renderIndex(main: HTMLElement): void {
  const root = h('div', { class: 'home home-b', 'data-page': 'index' });
  main.append(root);
  const learner = new Learner(GRAPH);
  const leads = [chapterLead(null), atlasLead(learner.today())].filter((x): x is Lead => !!x).sort((a, b) => b.t - a.t);
  root.append(leadCard(leads[0] ?? {
    kicker: 'New here?',
    title: 'Start with CS231n',
    sub: 'Images as numbers, all the way to ConvNets. Or learn concept by concept in Atlas.',
    href: '#/welcome',
    action: 'Start the course',
    icon: 'arrowRight',
    second: { href: '#/atlas', action: 'Atlas', icon: 'graph' },
    t: 0,
  }));

  root.append(h('div', { class: 'home-lbl' }, 'Courses'));
  const tiles = h('div', { class: 'tiles' });
  for (const k of COURSES) {
    const list = CHAPTERS.filter((c) => c.course === k.id && !c.num.startsWith('A'));
    const done = list.filter((c) => chapterProgress(c).done).length;
    const frac = list.reduce((a, c) => a + chapterProgress(c).frac, 0) / list.length;
    tiles.append(tile(k.id, k.code, k.tagline, frac, `${done} of ${list.length}`));
  }
  const st = [...learner.statuses().values()];
  const mastered = st.filter((s) => s === 'mastered' || s === 'due' || s === 'slipping').length;
  tiles.append(tile(ATLAS_COURSE.id, ATLAS_COURSE.code, ATLAS_COURSE.title, mastered / st.length, `${mastered} of ${st.length}`, 'atlas'));
  root.append(tiles);
  root.append(h('footer', { class: 'home-foot', html: md('An independent study companion. CS231n was created at Stanford by Fei-Fei Li, Andrej Karpathy and Justin Johnson; DL26 and Atlas are this site\'s own.') }));
}

function tile(id: string, code: string, tagline: string, frac: number, count: string, kind = ''): HTMLElement {
  return h('a', { class: `tile${kind ? ` tile-${kind}` : ''}`, href: `#/${id}` },
    h('span', { class: 'tile-code' }, code),
    h('span', { class: 'tile-t' }, tagline),
    h('span', { class: 'tile-p', html: `${ring(frac)}<span>${count}</span>` }));
}

/** A course's front page: what to do next, then the chapters, with only the current part open. */
export function renderCourse(main: HTMLElement, course: CourseMeta): void {
  const root = h('div', { class: 'home home-b', 'data-page': `course-${course.id}` });
  main.append(root);
  root.append(
    h('div', { class: 'home-kicker' }, `${course.code} · ${course.era}`),
    h('h1', { class: 'home-title', html: course.headline }));

  const next = nextChapter(course);
  const lead = chapterLead(course) ?? (next ? watchOrRead(next, CHAPTERS.indexOf(next) === CHAPTERS.findIndex((c) => c.course === course.id) ? 'Start here' : 'Up next', 0) : null);
  if (lead) {
    const card = leadCard(lead);
    const ch = CHAPTERS.find((c) => lead.href.endsWith(`/${c.id}`) || lead.href.includes(`/${c.id}/`));
    // Starting a chapter, its blurb says what it is; resuming, the line says where.
    if (ch && lead.t === 0) card.querySelector('.lead-s')!.replaceWith(h('p', { class: 'lead-blurb' }, ch.blurb));
    const go = card.querySelector('.lead-go')!;
    if (ch && go.textContent?.includes('Watch')) {
      void loadLecture(ch.id)?.then((d) => {
        if (d.timing) go.innerHTML = `${icon('playFill')} Watch · ${Math.round(d.timing.duration / 60)} min`;
      });
    }
    root.append(card);
  }

  // The chapter the lead card is about is the current one; its part is the one left open.
  const leadCh = lead ? CHAPTERS.find((c) => c.course === course.id && (lead.href.endsWith(`/${c.id}`) || lead.href.includes(`/${c.id}/`))) : undefined;
  const current = leadCh ?? next;
  const openPart = (current ?? CHAPTERS.find((c) => c.course === course.id))!.part;
  for (const part of course.parts) {
    const list = CHAPTERS.filter((c) => c.course === course.id && c.part === part);
    const done = list.filter((c) => chapterProgress(c).done).length;
    const det = h('details', { class: 'part-b' });
    det.open = part === openPart;
    det.append(h('summary', {},
      h('span', { class: 'part-chev', html: icon('caret-right') }),
      h('span', { class: 'part-name' }, part),
      h('span', { class: 'part-count', html: done === list.length ? `${done} of ${list.length} ${icon('check')}` : `${done} of ${list.length}` })));
    for (const c of list) {
      const cur = c === current;
      det.append(h('a', { class: `ch-row${cur ? ' cur' : ''}${hasChapter(c.id) ? '' : ' soon'}`, href: `#/${c.id}` },
        h('span', { class: 'ch-row-n' }, c.num),
        h('span', { class: 'ch-row-t' }, c.title.replace(/^Assignment \d: /, '')),
        progressMark(c, 'ch-row-m')));
    }
    root.append(det);
  }
  root.append(h('footer', { class: 'home-foot', html: md(FOOT[course.id] ?? '') }));
}

const FOOT: Record<string, string> = {
  cs231n: 'An unofficial, independent study companion. CS231n was created at Stanford by Fei-Fei Li, Andrej Karpathy and Justin Johnson; the [original course notes](https://cs231n.github.io/) remain the canonical reference. Figures here are original re-implementations, and the images are a small sample of [CIFAR-10](https://www.cs.toronto.edu/~kriz/cifar.html) (Krizhevsky, 2009).',
  dl26: 'An independent course that continues CS231n. Each chapter links the papers it follows; the figures are original re-implementations at toy scale, small enough to run in your browser.',
};

// The shelf, and the first thing the app opens on: every course as a book lying flat, spine out. A tap stands one up
// beside what it holds, with the way into it.
//
// Scrolling runs no script. The scroller is the camera (CSS perspective), and the books are scrolled content with
// fixed transforms, so the compositor moves them. Script runs only when a book opens or closes.
import '../styles/landing.css';
import { icon } from '../core/controls';
import { h, onDispose } from '../core/dom';
import type { Course } from '../courses/course';
import { COURSES } from '../courses/index';
import { Learner } from '../mastery/learner';
import { paintCover } from './art';

/** How a standing book faces the reader. The list of functions matches the lying one in landing.css, so the two blend. */
const STAND = 'scale(.35) rotateZ(-5deg) rotateY(24deg) rotateX(12deg)';
/** The page's unit: the screen's width, held at 520px on wider screens. landing.css has the same. */
const unit = (width: number): number => Math.min(width, 520);
/** As long as the stand-up move in landing.css, and a little more. */
const MOVE_MS = 820;

/** The move that stands a book up in the reading place, from where it lies `y` px down the screen. */
export function standing(width: number, y: number): string {
  const u = unit(width);
  return `translate3d(${(0.035 * u).toFixed(1)}px,${(0.87 * u - y).toFixed(1)}px,0px) ${STAND}`;
}

/** A book's thickness as a share of its height: more concepts, a thicker book. */
export const thickness = (concepts: number): number => Number((0.058 + 0.022 * Math.min(1, concepts / 170)).toFixed(4));

const SPINE_FONTS = ["600 27px var(--font-display)", "500 25px var(--font-mono)", "italic 500 28px var(--font-body)"];

/** The book the history entry holds open, so Back closes it and coming back from a course finds it open. */
const heldBook = (): string | undefined => (history.state as { atlasBook?: string } | null)?.atlasBook;

function book(course: Course, i: number): { el: HTMLElement; canvas: HTMLCanvasElement } {
  const canvas = h('canvas', { class: 'ld-cv' });
  const el = h('div', { class: 'ld-bk', style: `--c:${course.cover};--i:${i};--T:calc(${thickness(course.concepts.length)}*var(--H))` },
    canvas,
    h('div', { class: 'ld-sn' }, h('span', { style: `font:${SPINE_FONTS[i % SPINE_FONTS.length]}` }, course.title)),
    h('div', { class: 'ld-tl' }));
  paintCover(canvas, course);
  return { el, canvas };
}

function about(course: Course): HTMLElement[] {
  const learner = new Learner(course);
  const done = learner.masteredCount();
  const total = course.graph.order.length;
  return [
    h('h1', {}, course.title),
    h('div', { class: 'ld-by' }, course.blurb),
    h('hr', {}),
    ...(course.about ?? []).map((p) => h('p', {}, p)),
    h('a', { class: 'ld-go', href: course.routes.home }, done ? 'Continue' : 'Start'),
    h('div', { class: 'ld-note' }, done ? `${done} of ${total} concepts mastered` : `${total} concepts`),
    h('h2', {}, 'Chapters'),
    h('ol', {}, ...course.domains.map((d, n) => h('li', {}, h('b', {}, n + 1), d.title))),
  ];
}

export function renderLanding(main: HTMLElement): void {
  const books = COURSES.map(book);
  const shelf = h('div', { class: 'ld-bks', 'aria-hidden': 'true' }, ...books.map((b) => b.el));
  const detail = h('div', { class: 'ld-dt' });
  const scroller = h('div', { class: 'ld-sc', style: `--n:${COURSES.length}` },
    h('div', { class: 'ld-hd' }, 'Atlas', h('i', {}, 'Courses you can hold')), shelf, h('div', { class: 'ld-sp' }), detail);
  const tint = h('div', { class: 'ld-tint' });
  const back = h('button', { type: 'button', class: 'ld-back', 'aria-label': 'All books', html: icon('arrowLeft') });
  // The books themselves are pictures; these are the same doors for a keyboard or a screen reader.
  const doors = h('nav', { class: 'ld-doors', 'aria-label': 'Books' }, ...COURSES.map((c, i) => h('button', { type: 'button', onclick: () => show(i, true) }, c.title)));
  const root = h('div', { class: 'ld' }, tint, scroller, back, doors);
  main.append(root);

  const page = document.documentElement;
  let open = -1;
  let saved = 0;
  let timer = 0;

  const place = () => books.forEach((b, i) => {
    b.el.classList.toggle('off', open >= 0 && i !== open);
    b.el.style.transform = i === open ? standing(root.clientWidth, b.el.offsetTop - saved) : '';
  });
  const move = () => {
    root.classList.add('moving');
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      root.classList.remove('moving');
      root.classList.toggle('settled', open >= 0);
    }, MOVE_MS);
  };
  function show(i: number, push: boolean): void {
    if (i === open) return;
    const course = COURSES[i]!;
    if (open < 0) saved = scroller.scrollTop;
    open = i;
    move();
    detail.replaceChildren(...about(course));
    tint.style.setProperty('--c', course.cover);
    root.classList.add('detail');
    // The browser's own bars show the page behind this one: give it the book's tint too.
    page.style.backgroundColor = getComputedStyle(tint).backgroundColor;
    // The shelf keeps its place on the screen while the scroller becomes the book's page.
    shelf.style.top = `${-saved}px`;
    scroller.scrollTop = 0;
    place();
    requestAnimationFrame(() => root.classList.add('shown'));
    if (push) history.pushState({ ...(history.state as object | null), atlasBook: course.id }, '');
  }
  function close(): void {
    if (open < 0) return;
    open = -1;
    root.classList.remove('detail', 'shown', 'settled');
    page.style.backgroundColor = '';
    move();
    shelf.style.top = '0px';
    scroller.scrollTop = saved;
    place();
  }
  const follow = () => {
    const i = COURSES.findIndex((c) => c.id === heldBook());
    if (i < 0) close();
    else show(i, false);
  };

  books.forEach((b, i) => b.el.addEventListener('click', () => open < 0 && show(i, true)));
  back.addEventListener('click', () => (heldBook() ? history.back() : close()));
  window.addEventListener('popstate', follow);
  onDispose(() => {
    window.removeEventListener('popstate', follow);
    window.clearTimeout(timer);
    page.style.backgroundColor = '';
  });
  // Cover titles wait for their face; the rest of a cover does not.
  void document.fonts?.load("600 24px 'Fraunces Variable'").then(() => root.isConnected && books.forEach((b, i) => paintCover(b.canvas, COURSES[i]!))).catch(() => {});
  follow();
}

// The shelf, and the first thing the app opens on: every course a cloth-bound book in a pile, spine out. A tap stands
// one up beside what it holds, with the way into it; standing, it can be turned in the hand.
//
// Scrolling the shelf runs no script: `lit.ts` has the scene take each lying book's picture once, and the page moves
// the pictures. `flat.ts` is the shelf for a browser without WebGL.
import '../styles/landing.css';
import { icon } from '../core/controls';
import { h, onDispose } from '../core/dom';
import type { Course } from '../courses/course';
import { COURSES } from '../courses/index';
import { Learner } from '../mastery/learner';
import type { Fonts } from './art';
import { flatShelf } from './flat';
import { litShelf, type ShelfParts } from './lit';
import { thickness } from './pile';
import { mountShelf, type SceneBook } from './scene';

const FONTS: Fonts = { display: "'Fraunces Variable', Georgia, serif", body: "'Source Serif 4 Variable', Georgia, serif" };
/** As long as the stand-up move, and a little more. */
const MOVE_MS = 820;

/** The book the history entry holds open, so Back closes it and coming back from a course finds it open. */
const heldBook = (): string | undefined => (history.state as { atlasBook?: string } | null)?.atlasBook;

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
  const books: SceneBook[] = COURSES.map((c) => ({ id: c.id, title: c.title, cover: c.cover, th: thickness(c.concepts.length) }));
  const canvas = h('canvas', { class: 'ld-gl', 'aria-hidden': 'true' });
  const tint = h('div', { class: 'ld-tint' });
  const grab = h('div', { class: 'ld-grab', 'aria-hidden': 'true' });
  const told = h('div', { class: 'ld-told' });
  const detail = h('div', { class: 'ld-dt' }, grab, told);
  const spacer = h('div', { class: 'ld-sp' });
  const scroller = h('div', { class: 'ld-sc' }, h('div', { class: 'ld-hd' }, 'Atlas'), spacer, detail);
  const back = h('button', { type: 'button', class: 'ld-back', 'aria-label': 'All books', html: icon('arrowLeft') });
  // The books themselves are pictures; these are the same doors for a keyboard or a screen reader.
  const doors = h('nav', { class: 'ld-doors', 'aria-label': 'Books' }, ...COURSES.map((c, i) => h('button', { type: 'button', onclick: () => show(i, true) }, c.title)));
  const root = h('div', { class: 'ld' }, tint, canvas, scroller, back, doors);
  main.append(root);

  const fontsIn = Promise.all([document.fonts.load(`600 24px ${FONTS.display}`), document.fonts.load(`italic 400 22px ${FONTS.body}`)]).catch(() => {});
  const parts: ShelfParts = { root, scroller, spacer, grab, calm: matchMedia('(prefers-reduced-motion: reduce)').matches, onPick: (i) => show(i, true) };
  const scene = mountShelf(canvas, books, FONTS);
  root.classList.add(scene ? 'lit' : 'flat');
  const shelf = scene ? litShelf(scene, books, fontsIn, parts) : flatShelf(books, FONTS, fontsIn, parts);

  const page = document.documentElement;
  let open = -1;
  let saved = 0;
  let timer = 0;

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
    told.replaceChildren(...about(course));
    tint.style.setProperty('--c', course.cover);
    root.classList.add('detail');
    // The browser's own bars show the page behind this one: give it the book's tint too.
    page.style.backgroundColor = getComputedStyle(tint).backgroundColor;
    // The scroller becomes the book's page.
    scroller.scrollTop = 0;
    shelf.open(i, saved);
    requestAnimationFrame(() => root.classList.add('shown'));
    if (push) history.pushState({ ...(history.state as object | null), atlasBook: course.id }, '');
  }
  function close(): void {
    if (open < 0) return;
    const leftAt = scroller.scrollTop;
    open = -1;
    root.classList.remove('detail', 'shown', 'settled');
    page.style.backgroundColor = '';
    move();
    shelf.close(leftAt);
    scroller.scrollTop = saved;
  }
  const follow = () => {
    const i = COURSES.findIndex((c) => c.id === heldBook());
    if (i < 0) close();
    else show(i, false);
  };

  back.addEventListener('click', () => (heldBook() ? history.back() : close()));
  window.addEventListener('popstate', follow);
  onDispose(() => {
    window.removeEventListener('popstate', follow);
    window.clearTimeout(timer);
    page.style.backgroundColor = '';
    shelf.dispose();
  });
  follow();
}

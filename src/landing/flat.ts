// The shelf where WebGL cannot be had: the same books as CSS boxes with painted faces, under a CSS camera.
import { h } from '../core/dom';
import { paintFace, type Fonts } from './art';
import type { ShelfParts, ShelfView } from './lit';
import { sizes, STANDING } from './pile';
import type { SceneBook } from './scene';

export function flatShelf(books: SceneBook[], fonts: Fonts, fontsIn: Promise<unknown>, parts: ShelfParts): ShelfView {
  const { root, scroller, spacer } = parts;
  const made = books.map((b, i) => {
    const cover = h('canvas', { class: 'ld-cv' });
    const spine = h('canvas', { class: 'ld-sn' });
    const el = h('div', { class: 'ld-bk', style: `--c:${b.cover};--i:${i};--T:calc(${b.th}*var(--H))` }, cover, spine, h('div', { class: 'ld-tl' }));
    el.addEventListener('click', () => !root.classList.contains('detail') && parts.onPick(i));
    return { el, cover, spine };
  });
  const shelf = h('div', { class: 'ld-bks', 'aria-hidden': 'true' }, ...made.map((m) => m.el));
  scroller.prepend(shelf);
  spacer.style.setProperty('--n', String(books.length));
  const paint = () => made.forEach((m, i) => {
    paintFace(m.cover, books[i]!, 'up', [720, 1074], fonts);
    paintFace(m.spine, books[i]!, 'spine', [Math.round(books[i]!.th * 1074), 2148], fonts, books[i]!.th * 895);
  });
  paint();
  void fontsIn.then(() => root.isConnected && paint());

  const place = (open: number, saved: number) => made.forEach((m, i) => {
    const { u } = sizes(root.clientWidth);
    m.el.classList.toggle('off', open >= 0 && i !== open);
    // The same list of functions as the lying transform in landing.css, so the two blend.
    m.el.style.transform = i === open ? `translate3d(${(0.035 * u).toFixed(1)}px,${(0.87 * u - (m.el.offsetTop - saved)).toFixed(1)}px,0px) scale(${STANDING.scale}) rotateZ(${STANDING.rz}deg) rotateY(${STANDING.ry}deg) rotateX(${STANDING.rx}deg)` : '';
  });
  return {
    open(i, saved) {
      shelf.style.top = `${-saved}px`;
      place(i, saved);
    },
    close() {
      shelf.style.top = '0px';
      place(-1, 0);
    },
    dispose() {},
  };
}

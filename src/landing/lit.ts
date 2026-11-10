// The lit shelf. Each lying book is a picture the scene takes once, and the page scrolls the pictures by itself: no
// script runs while they move. Only an open book is drawn live: standing up, turned in the hand, lying back down.
import { h } from '../core/dom';
import { bezier, pileOf, shortWay, SHEAR, sizes, STANDING, type Lying } from './pile';
import type { Pose, SceneBook, Shelf, View } from './scene';

const STAND_MS = 780;
/** After the hand lets go, how long a turned book waits before it turns back, and how long that takes. */
const REST_AFTER_MS = 700;
const HOME_MS = 800;
const ease = bezier(0.32, 0.72, 0.12, 1);

export interface ShelfParts {
  /** The landing's root, which holds the scene's canvas. */
  root: HTMLElement;
  scroller: HTMLElement;
  spacer: HTMLElement;
  /** Laid over the standing book: where it can be taken hold of. */
  grab: HTMLElement;
  /** Whether motion should be kept to what is needed. */
  calm: boolean;
  onPick(i: number): void;
}

/** A shelf the landing can open a book on and close it again. */
export interface ShelfView {
  /** Book `i` opens; the shelf was scrolled to `saved`. */
  open(i: number, saved: number): void;
  /** The open book closes; its page was scrolled to `leftAt`. */
  close(leftAt: number): void;
  dispose(): void;
}

export function litShelf(scene: Shelf, books: SceneBook[], fontsIn: Promise<unknown>, parts: ShelfParts): ShelfView {
  const { root, scroller, spacer, grab, calm } = parts;
  const heap = h('div', { class: 'ld-pile', 'aria-hidden': 'true' });
  scroller.prepend(heap);
  const pics: (HTMLImageElement | undefined)[] = [];
  const turns = books.map(() => 0);
  let open = -1;
  let saved = 0;
  let disposed = false;

  const pile = (): Lying[] => pileOf(books.map((b) => b.th), root.clientWidth, scroller.clientHeight);
  const lying = (at: Lying, scroll: number): Pose => ({ x: root.clientWidth / 2, y: at.y - scroll, z: at.z, scale: 1, rz: -90, ry: 90, rx: 0, alpha: 1, lie: 1, covered: at.covered });
  const view = (height: number, top: number, ground?: View['ground']): View => {
    const { w, h: bookH } = sizes(root.clientWidth);
    return { width: root.clientWidth, height, top, shear: SHEAR, book: { w, h: bookH }, ground };
  };

  function takePictures(): void {
    if (disposed) return;
    const heapOf = pile();
    const ground = (getComputedStyle(root).backgroundColor.match(/[\d.]+/g) ?? ['0', '0', '0']).slice(0, 3).map((v) => Number(v) / 255) as [number, number, number];
    spacer.style.height = `${heapOf.at(-1)!.bottom + 0.45 * scroller.clientHeight}px`;
    books.forEach((_, i) => {
      const at = heapOf[i]!;
      const poses: Pose[] = [];
      poses[i] = lying(at, 0);
      const url = scene.draw(view(at.bottom - at.top, at.top, ground), poses).toDataURL('image/jpeg', 0.93);
      const next = h('img', { class: 'ld-pb', alt: '', draggable: 'false', style: `top:${at.top}px;height:${at.bottom - at.top}px;z-index:${books.length - i}` });
      next.addEventListener('click', () => open < 0 && parts.onPick(i));
      next.src = url;
      const turn = ++turns[i]!;
      // A picture joins the page once it is decoded, so a book never blinks empty when its picture is taken again.
      void next.decode().catch(() => {}).then(() => {
        if (disposed || turns[i] !== turn) return;
        const old = pics[i];
        if (old) {
          next.className = old.className;
          old.replaceWith(next);
        } else heap.append(next);
        pics[i] = next;
      });
    });
  }

  // The one book the scene is drawing: how far it has stood up (0 lying, 1 standing) and where that is heading.
  const live = { i: -1, p: 0, from: 0, to: 0, t0: 0, leftAt: 0 };
  // The open book turned in the hand: degrees about the screen's axes, and how fast it is still turning.
  const spin = { yaw: 0, pitch: 0, vy: 0, vp: 0, held: false, x: 0, y: 0, t: 0, letGo: 0, home: null as { t: number; yaw: number; pitch: number } | null, last: 0 };
  let raf = 0;
  let wake = 0;
  const kick = () => {
    if (!raf && live.i >= 0 && !disposed) raf = requestAnimationFrame(frame);
  };
  const stillSpin = () => Object.assign(spin, { vy: 0, vp: 0, home: null, held: false });

  /** Moves the turn in the hand on by one frame. True while it is still moving. */
  function turnInHand(now: number): boolean {
    const dt = Math.min(50, now - (spin.last || now));
    spin.last = now;
    if (spin.held) return true;
    if (spin.vy || spin.vp) {
      spin.yaw += spin.vy * dt;
      spin.pitch = Math.max(-75, Math.min(75, spin.pitch + spin.vp * dt));
      const drag = Math.exp(-dt / 260);
      spin.vy *= drag;
      spin.vp *= drag;
      if (Math.abs(spin.vy) + Math.abs(spin.vp) < 0.01) spin.vy = spin.vp = 0;
      return true;
    }
    if (!spin.yaw && !spin.pitch) return false;
    // Let go, it soon turns back the short way to how it stood.
    if (!spin.home) {
      if (now - spin.letGo < REST_AFTER_MS) {
        window.clearTimeout(wake);
        wake = window.setTimeout(kick, REST_AFTER_MS - (now - spin.letGo) + 20);
        return false;
      }
      spin.yaw = shortWay(spin.yaw);
      spin.home = { t: now, yaw: spin.yaw, pitch: spin.pitch };
    }
    const t = calm ? 1 : Math.min(1, (now - spin.home.t) / HOME_MS);
    const left = 1 - (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    spin.yaw = spin.home.yaw * left;
    spin.pitch = spin.home.pitch * left;
    if (t < 1) return true;
    spin.yaw = spin.pitch = 0;
    spin.home = null;
    return false;
  }

  function frame(now: number): void {
    raf = 0;
    if (live.i < 0 || disposed) return;
    const { u } = sizes(root.clientWidth);
    const screen = view(scroller.clientHeight, 0);
    let busy = turnInHand(now);
    const t = calm ? 1 : Math.min(1, (now - live.t0) / STAND_MS);
    if (t < 1 && live.from !== live.to) busy = true;
    const e = (live.p = live.from + (live.to - live.from) * ease(t));
    const mid = (a: number, b: number) => a + (b - a) * e;
    const top = scroller.scrollTop;
    // Lying, it is where its picture is; standing, it rides the page that tells of it.
    const down = lying(pile()[live.i]!, open >= 0 ? saved : top);
    const poses: Pose[] = [];
    poses[live.i] = {
      ...down,
      x: mid(down.x, root.clientWidth / 2 + 0.035 * u),
      y: mid(down.y, 0.87 * u - (open >= 0 ? top : live.leftAt)),
      z: mid(down.z, 0),
      scale: mid(1, STANDING.scale),
      rz: mid(-90, STANDING.rz),
      ry: mid(90, STANDING.ry),
      rx: mid(0, STANDING.rx),
      yaw: spin.yaw * e,
      pitch: spin.pitch * e,
      lie: 1 - e,
    };
    scene.draw(screen, poses);
    // Lying again and still: its picture takes over, and the scene leaves the page.
    if (open < 0 && !busy && live.p === 0) {
      pics[live.i]?.classList.remove('live');
      live.i = -1;
      root.classList.remove('live');
      scene.draw(screen, []);
      return;
    }
    if (busy) kick();
  }

  const onResize = (() => {
    let width = root.clientWidth;
    return () => {
      if (root.clientWidth !== width) {
        width = root.clientWidth;
        if (open < 0) takePictures();
      }
      kick();
    };
  })();
  const scheme = matchMedia('(prefers-color-scheme: dark)');
  const onScheme = () => open < 0 && takePictures();
  const onDown = (e: PointerEvent) => {
    if (open < 0) return;
    grab.setPointerCapture(e.pointerId);
    Object.assign(spin, { held: true, home: null, vy: 0, vp: 0, x: e.clientX, y: e.clientY, t: e.timeStamp });
    kick();
  };
  const onMove = (e: PointerEvent) => {
    if (!spin.held) return;
    const dx = e.clientX - spin.x;
    const dy = e.clientY - spin.y;
    const dt = Math.max(1, e.timeStamp - spin.t);
    spin.yaw += dx * 0.5;
    spin.pitch = Math.max(-75, Math.min(75, spin.pitch - dy * 0.4));
    spin.vy = 0.6 * spin.vy + 0.4 * ((dx * 0.5) / dt);
    spin.vp = 0.6 * spin.vp + 0.4 * ((-dy * 0.4) / dt);
    Object.assign(spin, { x: e.clientX, y: e.clientY, t: e.timeStamp });
    kick();
  };
  const onDrop = (e: PointerEvent) => {
    if (!spin.held) return;
    spin.held = false;
    spin.letGo = performance.now();
    // Held still before letting go: it stays where it was put.
    if (e.timeStamp - spin.t > 90) spin.vy = spin.vp = 0;
    kick();
  };

  takePictures();
  void fontsIn.then(() => {
    if (disposed) return;
    scene.repaint();
    if (open < 0) takePictures();
  });
  scroller.addEventListener('scroll', kick, { passive: true });
  window.addEventListener('resize', onResize);
  scheme.addEventListener('change', onScheme);
  grab.addEventListener('pointerdown', onDown);
  grab.addEventListener('pointermove', onMove);
  grab.addEventListener('pointerup', onDrop);
  grab.addEventListener('pointercancel', onDrop);

  return {
    open(i, at) {
      if (live.i >= 0 && live.i !== i) {
        pics[live.i]?.classList.remove('live');
        live.p = 0;
      }
      open = i;
      saved = at;
      // The pile keeps its place on the screen while the scroller becomes the book's page.
      heap.style.top = `${-at}px`;
      Object.assign(stillSpin(), { yaw: 0, pitch: 0 });
      Object.assign(live, { i, from: live.p, to: 1, t0: performance.now() });
      pics[i]?.classList.add('live');
      root.classList.add('live');
      kick();
    },
    close(leftAt) {
      open = -1;
      heap.style.top = '0px';
      stillSpin().yaw = shortWay(spin.yaw);
      Object.assign(live, { leftAt, from: live.p, to: 0, t0: performance.now() });
      kick();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(wake);
      window.removeEventListener('resize', onResize);
      scheme.removeEventListener('change', onScheme);
    },
  };
}

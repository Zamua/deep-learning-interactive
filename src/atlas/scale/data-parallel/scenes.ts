import type { Scene, SceneDef } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { cite } from '../../draw';
import { box, gpu, mono } from '../draw';

const KS = ['blue', 'orange', 'green', 'purple'] as const;
const G0 = [2, -1, 3, 0];
const G1 = [1, 3, 0, 4];
const SUB = '₀₁₂₃';
const f = (v: number) => String(v).replace('-', '−');

/** A caption along the bottom of the stage. */
function caption(s: Scene, text: string, a: number, k: Ink = '--ink-2') {
  s.alpha(a, () => mono(s, text, s.w / 2, s.h - 7 * s.u, { size: s.tall ? 3.2 : 3.5, k, halo: true }));
}

/** Four GPU cards: a row on a wide stage, two by two on a tall one. */
function cards(s: Scene): { x: number; y: number; w: number; h: number }[] {
  if (s.tall) return [0, 1, 2, 3].map((i) => ({ x: s.w / 2 + (i % 2 ? 25 : -25) * s.u, y: s.h * (i < 2 ? 0.42 : 0.72), w: 46, h: 27 }));
  const gap = Math.min(34, (s.w / s.u - 12) / 4);
  return [0, 1, 2, 3].map((i) => ({ x: s.w / 2 + (i - 1.5) * gap * s.u, y: s.h * 0.58, w: gap - 4, h: 42 }));
}

/** Where a card puts its copy of w, its slice of examples, its gradient and its progress bar. */
function spots(s: Scene, c: { x: number; y: number; w: number; h: number }) {
  return s.tall
    ? { w: [c.x - 12 * s.u, c.y - 2 * s.u], dots: [c.x + 10 * s.u, c.y - 2 * s.u], g: [c.x, c.y + 8 * s.u], bar: c.y + 8 * s.u }
    : { w: [c.x, c.y - 11 * s.u], dots: [c.x, c.y + 2 * s.u], g: [c.x, c.y + 13.5 * s.u], bar: c.y + 13.5 * s.u };
}

/** A slice of 32 examples as a 4 by 8 block of dots. */
function dots(s: Scene, cx: number, cy: number, k: (typeof KS)[number], a: number): void {
  s.alpha(a, () => {
    for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) s.circle(cx + (c - 3.5) * 2.2 * s.u, cy + (r - 1.5) * 2.2 * s.u, 0.7 * s.u, { fill: s.tint(k, 0.85) });
  });
}

/** A step's work as a bar that fills and restarts every `period` seconds: pure in time. */
function work(s: Scene, cx: number, y: number, w: number, since: number, period: number, k: Ink) {
  const W = w * s.u;
  const frac = since <= 0 ? 0 : (since % period) / period;
  s.rrect(cx - W / 2, y - 1 * s.u, W, 2 * s.u, 1, { fill: s.tint(k, 0.12), stroke: s.tint(k, 0.5), lw: 0.25 });
  if (frac > 0) s.rrect(cx - W / 2, y - 1 * s.u, W * frac, 2 * s.u, 1, { fill: s.tint(k, 0.6) });
}

/** The batch as one strip of 128 examples, colored by slice once it is split. */
function strip(s: Scene, y: number, split: number, a: number): void {
  s.alpha(a, () => {
    const half = Math.min(64, s.w / s.u / 2 - 6);
    const l = s.w / 2 - half * s.u;
    const step = (2 * half * s.u) / 128;
    for (let j = 0; j < 128; j++) {
      const x = l + (j + 0.5) * step;
      s.line(x, y - 2.4 * s.u, x, y + 2.4 * s.u, s.tint('--ink-3', 0.7 * (1 - split)), 0.32);
      s.line(x, y - 2.4 * s.u, x, y + 2.4 * s.u, s.tint(KS[Math.floor(j / 32)]!, 0.85 * split), 0.32);
    }
  });
}

const why: SceneDef = {
  draw(s) {
    const top = s.h * 0.13;
    const hist = s.ease('goyal', 0.8);
    const split = s.ease('slice', 0.8);
    strip(s, top, split, 1 - hist);
    s.alpha((1 - s.ease('G', 0.5)) * (1 - hist), () => mono(s, split > 0.5 ? 'B = 128 = 4 slices of 32' : 'one batch: B = 128 examples', s.w / 2, top - 6 * s.u, { size: 3.4, k: '--ink-2' }));
    s.alpha(s.ease('G', 0.6) * (1 - hist), () => mono(s, 'B = G × 32 = 4 × 32 = 128', s.w / 2, top - 6 * s.u, { size: 3.4, weight: 650 }));

    // One chip alone: the whole batch, one slow step after another.
    const four = s.ease('copies', 0.8);
    s.alpha(1 - four, () => {
      const cw = s.tall ? 72 : 84;
      const ch = s.tall ? 46 : 50;
      const cx = s.w / 2;
      const cy = s.h * 0.56;
      gpu(s, cx, cy, cw, ch, '', { on: 0.3 });
      s.alpha(1 - s.ease('gpu', 0.6), () => mono(s, 'one chip', cx, cy - ch / 2 * s.u + 3.5 * s.u, { size: 3.2, k: '--ink-2', weight: 650 }));
      s.alpha(s.ease('gpu', 0.6), () => mono(s, 'GPU', cx, cy - ch / 2 * s.u + 3.5 * s.u, { size: 3.2, k: '--ink-2', weight: 650 }));
      box(s, cx - (s.tall ? 22 : 26) * s.u, cy - 2 * s.u, 14, 8, 'blue', { label: 'w', size: 3.6 });
      for (let r = 0; r < 8; r++) for (let c = 0; c < 16; c++) s.circle(cx + (s.tall ? 10 : 12) * s.u + (c - 7.5) * 2.2 * s.u, cy - 2 * s.u + (r - 3.5) * 2.2 * s.u, 0.7 * s.u, { fill: s.tint('slate', 0.75) });
      mono(s, 'one step', cx - (cw / 2 - 4) * s.u, cy + (ch / 2 - 8) * s.u, { size: 2.9, k: '--ink-3', align: 'left' });
      work(s, cx + 6 * s.u, cy + (ch / 2 - 4) * s.u, cw - 20, s.since('slow') - 0.8, 7, 'slate');
    });
    caption(s, 'GPU: graphics processing unit', s.win('gpu', 'copies'));

    // Four GPUs: the same w on each, a slice each, a quarter of the work each.
    s.alpha(four * (1 - hist), () => {
      const fast = s.since('name') - 0.6;
      cards(s).forEach((c, i) => {
        gpu(s, c.x, c.y, c.w, c.h, `GPU ${i}`);
        const p = spots(s, c);
        box(s, p.w[0]!, p.w[1]!, 13, 7, 'blue', { label: 'w', size: 3.4, on: s.win('copies', 'slice') });
        dots(s, p.dots[0]!, p.dots[1]!, KS[i]!, split);
        s.alpha(s.ease('name', 0.6), () => work(s, c.x, p.bar, c.w - 8, fast, 7 / 4, KS[i]!));
      });
    });
    caption(s, 'the same full copy of w on every GPU', s.win('copies', 'slice'), 'blue');
    caption(s, '128 / 4 = 32 examples each', s.win('slice', 'G'));
    caption(s, 'data split · w copied · all at once', s.win('name', 'goyal'));

    // The 2017 run: 32 times the GPUs, the same 32 images on each.
    s.alpha(hist, () => {
      const l = 6 * s.u;
      const r = s.w - 6 * s.u;
      const sq = (x: number, y: number) => s.rrect(x, y, 1.9 * s.u, 1.9 * s.u, 0.3, { fill: s.tint('slate', 0.45), stroke: s.tint('slate', 0.8), lw: 0.15 });
      const timeBar = (y: number, frac: number, label: string, k: 'red' | 'green') => {
        s.rrect(l, y - 2 * s.u, Math.max(1.2 * s.u, (r - l) * frac), 4 * s.u, 0.8, { fill: s.tint(k, 0.35), stroke: s.c(k), lw: 0.3 });
        mono(s, label, frac > 0.5 ? r - 2 * s.u : l + (r - l) * frac + 2 * s.u, y, { size: 3.3, k: frac > 0.5 ? '--ink' : k, align: frac > 0.5 ? 'right' : 'left', weight: 650 });
      };
      // The voice names the 256 GPUs first, then the 29 hours on 8, then the 1 hour.
      const y1 = s.h * 0.17;
      s.alpha(s.ease('goyal', 0.6, 10), () => {
        mono(s, 'before: 8 GPUs × 32 = 256 per step', l, y1, { size: 3.2, k: '--ink-2', align: 'left' });
        for (let i = 0; i < 8; i++) sq(l + i * 2.6 * s.u, y1 + 3.5 * s.u);
        timeBar(y1 + 10 * s.u, 1, '29 hours', 'red');
      });
      const y2 = s.h * 0.45;
      s.alpha(s.ease('goyal', 0.6, 5.5), () => {
        mono(s, '256 GPUs × 32 = 8,192 per step', l, y2, { size: 3.2, k: '--ink-2', align: 'left' });
        for (let i = 0; i < 256; i++) sq(l + (i % 32) * 2.6 * s.u, y2 + 3.5 * s.u + Math.floor(i / 32) * 2.6 * s.u);
      });
      s.alpha(s.ease('goyal', 0.6, 13.9), () => timeBar(y2 + 28 * s.u, 1 / 29, '1 hour', 'green'));
    });
    caption(s, 'over a million images, 32 per GPU', s.ease('goyal', 0.6, 1.5));
    cite(s, 'Goyal et al., 2017', hist);
  },
};

const average: SceneDef = {
  draw(s) {
    const top = s.h * 0.12;
    const vec = s.ease('vec', 0.6);
    const back = s.ease('step', 0.6);
    const send = s.ease('send', 0.6);
    const cs = cards(s);
    cs.forEach((c, i) => {
      gpu(s, c.x, c.y, c.w, c.h, `GPU ${i}`);
      const p = spots(s, c);
      box(s, p.w[0]!, p.w[1]!, 13, 7, 'blue', { label: 'w', size: 3.4, on: s.win('step', 'send') });
      dots(s, p.dots[0]!, p.dots[1]!, KS[i]!, 1 - 0.5 * send);
      const name = `g${SUB[i]}`;
      const own = vec > 0.5 ? `${name} = [${f(G0[i]!)}, ${f(G1[i]!)}]` : s.ease('per', 0.5) > 0.5 ? `${name} = ${f(G0[i]!)}` : name;
      s.alpha(s.ease('grad', 0.6), () => mono(s, back > 0.5 ? 'g = [1, 2]' : own, p.g[0]!, p.g[1]!, { size: 3.2, k: 'red', weight: 650 }));
    });
    // Each GPU's gradient flows up into the one average.
    s.alpha(s.win('mean', 'step'), () => {
      const ink = s.tint('red', 0.55);
      const end = (x: number) => [s.w / 2 + Math.sign(x - s.w / 2) * 12 * s.u, top + 5 * s.u] as const;
      cs.forEach((c, i) => {
        const [ex, ey] = end(c.x);
        if (!s.tall || i < 2) {
          s.arrow(c.x, c.y - (c.h / 2) * s.u - 0.5 * s.u, ex, ey, ink, 0.3, 1.8);
          return;
        }
        // A bottom card's arrow runs up the outside of the card above it.
        const side = Math.sign(c.x - s.w / 2);
        const ox = c.x + side * (c.w / 2 + 2.5) * s.u;
        const oy = cs[i - 2]!.y - (c.h / 2) * s.u - 3 * s.u;
        s.line(c.x + side * (c.w / 2) * s.u, c.y, ox, c.y, ink, 0.3);
        s.line(ox, c.y, ox, oy, ink, 0.3);
        s.arrow(ox, oy, ex + side * 6 * s.u, ey, ink, 0.3, 1.8);
      });
    });
    s.alpha(s.win('loss', 'grad'), () => mono(s, 'f, the loss: how badly w does', s.w / 2, top, { size: s.tall ? 3.3 : 3.6, k: '--ink-2' }));
    s.alpha(s.win('mean', 'vec'), () => box(s, s.w / 2, top, 60, 8, 'red', { label: '(2 − 1 + 3 + 0) / 4 = 1', size: 3.2, on: s.ease('mean', 0.6, 1.5) }));
    s.alpha(s.win('whole', 'vec'), () => mono(s, '= the gradient of all 128', s.w / 2, top + 8.5 * s.u, { size: 3.2, k: 'red', halo: true }));
    s.alpha(s.win('vec', 'send'), () => box(s, s.w / 2, top, 60, 8, 'red', { label: 'entry by entry: [1, 2]', size: 3.2, on: 0.6 }));
    s.alpha(s.win('step', 'send'), () => mono(s, 'every copy: w − η · [1, 2]', s.w / 2, top + 8.5 * s.u, { size: 3.2, k: 'blue', halo: true }));
    // What travels: one gradient from every GPU to every other.
    s.alpha(send, () => {
      for (const c of cs) {
        const p = spots(s, c);
        const bw = Math.min(26, c.w - 4);
        s.rrect(p.g[0]! - (bw / 2) * s.u, p.g[1]! - 3 * s.u, bw * s.u, 6 * s.u, 1.2, { stroke: s.c('red'), lw: 0.35 });
      }
      mono(s, 'sent each step: the gradients,', s.w / 2, top - 2.4 * s.u, { size: s.tall ? 3.2 : 3.6, k: '--ink' });
      mono(s, 'one number per parameter', s.w / 2, top + 2.8 * s.u, { size: s.tall ? 3.2 : 3.6, k: 'red', weight: 650 });
    });
    caption(s, 'the examples stay where they are', s.ease('send', 0.6, 2));
  },
};

/** A row of `n` small GPU cards centered at y. */
function smallCards(s: Scene, n: number, y: number, a: number): number[] {
  const pitch = Math.min(12, (s.w / s.u - 12) / n);
  const xs = Array.from({ length: n }, (_, i) => s.w / 2 + (i - (n - 1) / 2) * pitch * s.u);
  s.alpha(a, () => xs.forEach((x, i) => {
    s.rrect(x - ((pitch - 1.6) / 2) * s.u, y - 3.5 * s.u, (pitch - 1.6) * s.u, 7 * s.u, 1, { fill: s.tint(KS[i % 4]!, 0.14), stroke: s.tint(KS[i % 4]!, 0.7), lw: 0.3 });
    mono(s, `GPU ${i}`, x, y, { size: 2.5, k: '--ink-2', weight: 650 });
  }));
  return xs;
}

const epoch: SceneDef = {
  draw(s) {
    const l = 8 * s.u;
    const r = s.w - 8 * s.u;
    const bar = (y: number, n: number, k: 'blue' | 'green', grow: number) => {
      s.rrect(l, y - 3 * s.u, r - l, 6 * s.u, 0.8, { fill: s.tint(k, 0.1), stroke: s.tint(k, 0.5), lw: 0.3 });
      const filled = Math.floor(n * grow);
      if (filled > 0) s.rrect(l, y - 3 * s.u, ((r - l) * filled) / n, 6 * s.u, 0.8, { fill: s.tint(k, 0.35) });
      for (let j = 1; j < n; j++) s.line(l + ((r - l) * j) / n, y - 3 * s.u, l + ((r - l) * j) / n, y + 3 * s.u, s.tint(k, 0.55), 0.12);
    };
    const size = s.tall ? 3.2 : 3.5;
    mono(s, 'one epoch: N = 12,800 examples', s.w / 2, s.h * 0.07, { size: s.tall ? 3.4 : 3.8, weight: 650 });

    // Four GPUs: one step takes all four slices at once.
    const yA = s.h * 0.27;
    const barA = s.h * 0.39;
    s.alpha(s.ease('step', 0.6), () => mono(s, '4 GPUs × 32 = 128 per step', l, s.h * 0.17, { size, k: 'blue', align: 'left' }));
    const xa = smallCards(s, 4, yA, s.ease('epoch', 0.6, 0.6));
    s.alpha(s.ease('epoch', 0.6, 0.6), () => bar(barA, 100, 'blue', s.ease('steps', 3, 1)));
    s.alpha(s.win('step', 'steps'), () => {
      const x0 = l + (r - l) / 200;
      for (const x of xa) s.arrow(x, yA + 4 * s.u, x0 + (x - x0) * 0.1, barA - 3.4 * s.u, s.tint('blue', 0.8), 0.3, 1.6);
      s.rrect(l, barA - 3 * s.u, (r - l) / 100, 6 * s.u, 0.4, { fill: s.c('blue') });
    });
    s.alpha(s.ease('steps', 0.6, 1.5), () => mono(s, '12,800 / 128 = 100 steps', r, s.h * 0.47, { size, k: 'blue', align: 'right', weight: 650 }));
    s.alpha(s.win('not', 'more'), () => mono(s, 'not 12,800 / 32 = 400: four slices, one step', s.w / 2, s.h * 0.54, { size: s.tall ? 2.9 : 3.3, k: 'red', weight: 600 }));

    // Eight GPUs: twice the batch, half the steps.
    const yB = s.h * 0.71;
    const barB = s.h * 0.82;
    s.alpha(s.ease('more', 0.6), () => mono(s, '8 GPUs × 32 = 256 per step', l, s.h * 0.61, { size, k: 'green', align: 'left' }));
    smallCards(s, 8, yB, s.ease('more', 0.6, 0.3));
    s.alpha(s.ease('more', 0.6, 0.6), () => bar(barB, 50, 'green', s.ease('more', 2, 1.5)));
    s.alpha(s.ease('more', 0.6, 3), () => mono(s, '12,800 / 256 = 50 steps', r, s.h * 0.9, { size, k: 'green', align: 'right', weight: 650 }));
  },
};

export const scenes: Record<string, SceneDef> = { why, average, epoch };

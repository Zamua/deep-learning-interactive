import type { Scene, SceneDef } from '../../../lecture/scene';
import { Rng } from '../../../core/rand';
import { cells, columns } from '../../draw';

// Per-example gradients for the dataset grid: 2-D, scattered around one direction.
const DOTS = 60;
const rng = new Rng(7);
const GRADS = Array.from({ length: DOTS }, () => {
  const a = -0.45 + rng.randn() * 0.9;
  const r = 0.55 + rng.next() * 0.6;
  return [Math.cos(a) * r, Math.sin(a) * r] as const;
});
const mean = (idx: number[]) => [0, 1].map((k) => idx.reduce((a, i) => a + GRADS[i]![k]!, 0) / idx.length);
const ALL = mean(GRADS.map((_, i) => i));
const BATCH = rng.shuffle(GRADS.map((_, i) => i)).slice(0, 8);
const EST = mean(BATCH);

/** The dataset grid's cell centers. */
function grid(s: Scene) {
  const cols = s.tall ? 10 : 12;
  const step = Math.min((s.w - 16 * s.u) / cols, (s.h * 0.48) / (DOTS / cols));
  const x0 = s.w / 2 - ((cols - 1) / 2) * step;
  const y0 = s.h * 0.14;
  return { cols, step, at: (i: number) => [x0 + (i % cols) * step, y0 + Math.floor(i / cols) * step] as const };
}

/** An arrow of gradient `g`, scaled by `len` px per unit, centered on (x, y). */
function gradArrow(s: Scene, x: number, y: number, g: readonly number[], len: number, col: string, w = 0.35, head = 1.4): void {
  const dx = g[0]! * len;
  const dy = -g[1]! * len;
  s.arrow(x - dx / 2, y - dy / 2, x + dx / 2, y + dy / 2, col, w, head);
}

const full: SceneDef = {
  draw(s) {
    const G = grid(s);
    const n = DOTS;
    const b = s.ease('batch', 0.8, 0.5);
    s.text(`N examples, one gradient each`, s.w / 2, s.h * 0.05, { size: 3.4, color: s.c('--ink-3') });
    for (let i = 0; i < n; i++) {
      const [x, y] = G.at(i);
      const inB = BATCH.includes(i);
      const a = s.ease('full', 0.4, (i / n) * 1.5) * (inB ? 1 : 1 - 0.75 * b);
      s.alpha(a, () => gradArrow(s, x, y, GRADS[i]!, G.step * 0.55, s.c(inB && b > 0 ? 'gold' : 'red')));
    }
    const oy = s.h * 0.8;
    const L = 30 * s.u;
    const mean = (g: number[], ox: number, k: 'red' | 'gold', label: string) => {
      s.arrow(ox - (g[0]! * L) / 2, oy + (g[1]! * L) / 2, ox + (g[0]! * L) / 2, oy - (g[1]! * L) / 2, s.c(k), 0.8, 2.6);
      s.text(label, ox, oy + 9 * s.u, { size: 3.2, color: s.c(k) });
    };
    s.alpha(s.ease('full', 0.6, 2), () => mean(ALL, s.w / 2 - (s.tall ? 22 : 26) * s.u, 'red', 'all N: exact'));
    s.alpha(s.win('cost', 'batch'), () => {
      s.text('50,000 gradients per step', s.w / 2 + (s.tall ? 22 : 26) * s.u, oy, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
    });
    s.alpha(s.ease('batch', 0.6, 1.5), () => {
      mean(EST, s.w / 2 + (s.tall ? 22 : 26) * s.u, 'gold', 'B = 8: close');
      s.text('8 gradients', s.w / 2 + (s.tall ? 22 : 26) * s.u, oy + 14 * s.u, { size: 3.2, font: 'mono', color: s.c('--ink-2') });
    });
  },
};

const TRUE = 0.8;
const nrng = new Rng(11);
const SMALL = [1, ...Array.from({ length: 13 }, () => TRUE + nrng.randn() * 0.8)];
const LARGE = Array.from({ length: 14 }, () => TRUE + nrng.randn() * 0.2);

const average: SceneDef = {
  draw(s) {
    const xs = columns(s, 4, s.tall ? 20 : 17);
    const y1 = s.h * 0.12;
    const y2 = s.h * 0.34;
    const vals = [2, -1, 3, 0];
    s.text('per-example g', xs[0]! - 9 * s.u, y1 - 8 * s.u, { size: 3, align: 'left', color: s.c('--ink-3') });
    cells(s, xs, y1, vals.map(String), 'red', { w: 12, h: 8, on: vals.map(() => s.win('mean', 'noise')) });
    s.alpha(s.ease('mean', 0.6), () => {
      s.text('(2 − 1 + 3 + 0) / 4 =', s.w / 2 - 4 * s.u, y2, { size: 3.6, font: 'mono', align: 'right', color: s.c('--ink-2') });
      cells(s, [s.w / 2 + 6 * s.u], y2, ['1'], 'red', { w: 12, h: 8, on: [1] });
    });
    const l = s.w * 0.17;
    const r = s.w * 0.93;
    const X = (v: number) => l + ((v + 1.4) / 4.4) * (r - l);
    const ya = s.h * 0.62;
    const yb = s.h * 0.8;
    const ax = s.h * 0.9;
    s.alpha(s.ease('mean', 0.6, 1), () => {
      s.line(l, ax, r, ax, s.c('--axis'), 0.35);
      [-1, 0, 1, 2, 3].forEach((v) => s.text(String(v).replace('-', '−'), X(v), ax + 3.6 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
      s.line(X(TRUE), ya - 6 * s.u, X(TRUE), ax, s.tint('green', 0.8), 0.4, [1, 0.8]);
      s.text('true', X(TRUE), ya - 8.5 * s.u, { size: 3, color: s.c('green') });
      s.text('B = 4', l - 1 * s.u, ya, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-2') });
      s.circle(X(SMALL[0]!), ya, 1.1 * s.u, { fill: s.c('red') });
    });
    SMALL.slice(1).forEach((v, i) => {
      s.alpha(s.ease('noise', 0.3, 0.8 + i * 0.35), () => s.circle(X(Math.max(-1.4, Math.min(3, v))), ya + ((i % 3) - 1) * 1.6 * s.u, 1.1 * s.u, { fill: s.tint('red', 0.6) }));
    });
    s.alpha(s.ease('size', 0.6), () => s.text('B = 64', l - 1 * s.u, yb, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-2') }));
    LARGE.forEach((v, i) => {
      s.alpha(s.ease('size', 0.3, 0.6 + i * 0.2), () => s.circle(X(v), yb + ((i % 3) - 1) * 1.6 * s.u, 1.1 * s.u, { fill: s.tint('blue', 0.7) }));
    });
  },
};

const epoch: SceneDef = {
  draw(s) {
    const l = s.w * 0.1;
    const r = s.w * 0.9;
    const y = s.h * 0.36;
    const h = 10 * s.u;
    const seg = (r - l) / 12;
    s.text('N = 1,200 examples', s.w / 2, y - h / 2 - 12 * s.u, { size: 3.6, font: 'mono', weight: 600, color: s.c('orange') });
    const cut = s.ease('count', 0.6);
    for (let i = 0; i < 12; i++) {
      const on = Math.min(1, Math.max(0, (s.since('count') - 0.6 - i * 0.3) / 0.3)) * (1 - s.ease('seen', 0.4));
      const seenOn = i < 5 ? s.ease('seen', 0.4, 0.8 + i * 0.3) : 0;
      s.rrect(l + i * seg, y - h / 2, seg, h, 0.6, { fill: s.tint('orange', 0.12 + 0.3 * Math.max(on, seenOn)), stroke: s.tint('orange', 0.3 + 0.6 * cut), lw: 0.3 });
      s.alpha(cut, () => s.text(String(i + 1), l + (i + 0.5) * seg, y + h / 2 + 3.4 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
    }
    s.alpha(s.ease('epoch', 0.6, 0.6), () => {
      s.line(l, y + h / 2 + 7.5 * s.u, r, y + h / 2 + 7.5 * s.u, s.c('slate'), 0.4);
      s.text('one epoch', s.w / 2, y + h / 2 + 11 * s.u, { size: 3.2, color: s.c('slate') });
    });
    s.alpha(cut, () => {
      s.line(l, y - h / 2 - 2 * s.u, l + seg, y - h / 2 - 2 * s.u, s.c('slate'), 0.4);
      s.text('B = 100', l, y - h / 2 - 5 * s.u, { size: 3, font: 'mono', align: 'left', color: s.c('slate') });
    });
    s.alpha(s.ease('count', 0.6, 4), () => s.text('N / B = 1,200 / 100 = 12 steps', s.w / 2, s.h * 0.7, { size: 3.8, font: 'mono', weight: 600, color: s.c('--ink-2') }));
    s.alpha(s.ease('seen', 0.6, 2.5), () => s.text('k = 5 steps: 5 × 100 = 500 seen', s.w / 2, s.h * 0.84, { size: 3.8, font: 'mono', weight: 600, color: s.c('orange') }));
  },
};

export const scenes: Record<string, SceneDef> = { full, average, epoch };

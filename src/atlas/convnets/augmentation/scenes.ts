import { type Ink, type Scene, type SceneDef } from '../../../lecture/scene';
import { after, cite, columns, verdict } from '../../draw';
import { axes, curve, frame } from '../../optimization/draw';
import { key, xTicks } from '../../training/draw';

const ARROW = [
  '.......',
  '....#..',
  '.....#.',
  '#######',
  '.....#.',
  '....#..',
  '.......',
].map((r) => [...r].map((c) => c === '#'));

const mirror = (g: boolean[][]) => g.map((r) => [...r].reverse());
const shift = (g: boolean[][], dx: number, dy: number) => g.map((r, i) => r.map((_, j) => g[i - dy]?.[j - dx] ?? false));
const crop = (g: boolean[][]) => g.slice(1, 6).map((r) => r.slice(1, 7));

/** A pixel image: `g` drawn as a grid of squares filling a `size` box centered on (cx, cy). */
function pixels(s: Scene, cx: number, cy: number, size: number, g: boolean[][], k: Ink, light = 1): void {
  const n = Math.max(g.length, g[0]!.length);
  const p = size / n;
  const x0 = cx - (g[0]!.length * p) / 2;
  const y0 = cy - (g.length * p) / 2;
  s.rrect(cx - size / 2 - 0.8 * s.u, cy - size / 2 - 0.8 * s.u, size + 1.6 * s.u, size + 1.6 * s.u, 1, { fill: s.tint('--ink', 0.04), stroke: s.tint('--ink-3', 0.6), lw: 0.3 });
  g.forEach((r, i) => r.forEach((on, j) => {
    if (on) s.rrect(x0 + j * p + 0.15 * s.u, y0 + i * p + 0.15 * s.u, p - 0.3 * s.u, p - 0.3 * s.u, 0.3, { fill: s.tint(k, 0.45 * light + 0.15) });
  }));
}

const THUMBS: { name: string; g: boolean[][]; light: number; ok: boolean; label: string }[] = [
  { name: 'shift', g: shift(ARROW, -1, 1), light: 1, ok: true, label: 'right' },
  { name: 'darker', g: ARROW, light: 0.45, ok: true, label: 'right' },
  { name: 'crop', g: crop(ARROW), light: 1, ok: true, label: 'right' },
  { name: 'flip', g: mirror(ARROW), light: 1, ok: false, label: 'left' },
];

const variety: SceneDef = {
  draw(s) {
    const big = (s.tall ? 28 : 30) * s.u;
    const cy = s.h * 0.24;
    pixels(s, s.w / 2, cy, big, ARROW, 'orange');
    // The label: the answer stored with the image, lit while it is introduced.
    const lit = s.ease('label', 0.6, 0.8) * (1 - s.ease('change', 0.6));
    s.alpha(s.ease('label', 0.6, 0.8), () => {
      const ly = cy + big / 2 + 5 * s.u;
      const w = s.measure('label: right', { size: 3.4, font: 'mono', weight: 600 }) + 4 * s.u;
      s.rrect(s.w / 2 - w / 2, ly - 3 * s.u, w, 6 * s.u, 1, { fill: s.tint('gold', 0.08 + 0.2 * lit), stroke: s.tint('gold', 0.4 + 0.6 * lit), lw: 0.3 });
      s.text('label: right', s.w / 2, ly, { size: 3.4, font: 'mono', weight: 600, color: s.c('--ink') });
    });
    const xs = columns(s, 4, s.tall ? 22 : 26);
    const ty = s.h * 0.62;
    const ts = (s.tall ? 14 : 15) * s.u;
    THUMBS.forEach((t, i) => {
      const a = i < 3 ? s.ease('change', 0.5, 1.2 + i * 1.6) : s.ease('flip', 0.6, 1.4);
      s.alpha(a, () => {
        pixels(s, xs[i]!, ty, ts, t.g, 'orange', t.light);
        s.text(t.name, xs[i]!, ty + ts / 2 + 4 * s.u, { size: 3.1, font: 'mono', color: s.c('--ink-2') });
        const vx = xs[i]! - 5.5 * s.u;
        s.alpha(i < 3 ? 1 : s.ease('flip', 0.5, 3.4), () => verdict(s, t.ok, t.label, vx, ty + ts / 2 + 10 * s.u, 3.1));
      });
    });
    s.alpha(s.win('memo', 'label'), () => s.text('never the exact same image twice', s.w / 2, s.h * 0.62, { size: 3.4, color: s.c('--ink-2') }));
    s.alpha(s.win('which', 'name'), () => {
      s.text('6 upside down: a 9', s.w / 2, s.h * 0.87, { size: 3.3, font: 'mono', color: s.c('red') });
      s.text('red light, colors shifted: green', s.w / 2, s.h * 0.94, { size: 3.3, font: 'mono', color: s.c('red') });
    });
    s.alpha(s.ease('name', 0.6, 0.4), () => {
      s.text('augment: to make bigger', s.w / 2, s.h * 0.87, { size: 3.5, font: 'mono', weight: 600, color: s.c('green') });
      s.text('more training images, no new photos', s.w / 2, s.h * 0.94, { size: 3.2, color: s.c('--ink-2') });
    });
  },
};

/** Index into `n` items, stepping through them as `f` runs from 0 to 1. */
const step = (f: number, n: number): number => Math.min(n - 1, Math.max(0, Math.floor(f * n)));
const span01 = (v: number): number => Math.min(1, Math.max(0, v));

/** A dot per crop start position, `cols` by `rows` around (gx, cy), `gp` px apart. */
function starts(s: Scene, gx: number, cy: number, cols: number, rows: number, gp: number, lit: (i: number, j: number) => boolean, r = 1.5): void {
  for (let a = 0; a < rows; a++) for (let b = 0; b < cols; b++) {
    s.circle(gx + (b - (cols - 1) / 2) * gp, cy + (a - (rows - 1) / 2) * gp, r * s.u, { fill: lit(a, b) ? s.c('blue') : s.tint('blue', 0.15), stroke: s.tint('blue', 0.7), lw: 0.25 });
  }
}

/** The start index labels: 0.. across the top of the dot grid, and 0.. down its left. */
function edgeLabels(s: Scene, gx: number, cy: number, cols: number, rows: number, gp: number, a: { top: number; left: number }, hot: { col: number; row: number }, size = 2.8): void {
  const x0 = gx - ((cols - 1) / 2) * gp;
  const y0 = cy - ((rows - 1) / 2) * gp;
  s.alpha(a.top, () => {
    for (let b = 0; b < cols; b++) s.text(String(b), x0 + b * gp, y0 - gp * 0.6 - 2 * s.u, { size, font: 'mono', weight: b === hot.col ? 700 : 500, color: s.c(b === hot.col ? 'blue' : '--ink-3') });
    s.text('left edge', gx, y0 - gp * 0.6 - 6.5 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-2') });
  });
  s.alpha(a.left, () => {
    for (let i = 0; i < rows; i++) s.text(String(i), x0 - gp * 0.6 - 2 * s.u, y0 + i * gp, { size, font: 'mono', weight: i === hot.row ? 700 : 500, color: s.c(i === hot.row ? 'blue' : '--ink-3') });
  });
}

/** A fixed pseudo-random number in [0, 1) for draw `n`, so a "fresh random crop" is the same on every seek. */
const rnd = (n: number): number => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const crops: SceneDef = {
  draw(s) {
    const size = (s.tall ? 34 : 36) * s.u;
    const cx = s.w * (s.tall ? 0.3 : 0.32);
    const cy = s.h * 0.32;
    const px = size / 32;
    // The crop's start: (0, 0), then along row 0, then through every row; random once choices are fresh.
    const inDown = s.since('down') >= 0;
    let k = inDown ? 5 + step(span01((s.prog('down') - 0.05) / 0.45), 20) : s.since('across') >= 0 ? step(span01((s.prog('across') - 0.15) / 0.5), 5) : 0;
    const draw = Math.floor(s.since('fresh') / 0.7);
    const fresh = s.since('fresh') >= 0;
    if (fresh) k = Math.floor(rnd(draw) * 25);
    const [i, j] = [Math.floor(k / 5), k % 5];
    const flipOn = s.ease('flips', 0.6);
    const flipped = fresh ? rnd(draw + 0.5) < 0.5 : flipOn > 0.5 && s.since('alex') < 0 && Math.floor(s.since('flips') / 0.8) % 2 === 1;
    s.rrect(cx - size / 2, cy - size / 2, size, size, 0.8, { fill: s.tint('orange', 0.12), stroke: s.tint('orange', 0.7), lw: 0.3 });
    pixels(s, cx, cy, size * 0.6, flipped ? mirror(ARROW) : ARROW, 'orange');
    const w = 28 * px;
    s.rrect(cx - size / 2 + j * px, cy - size / 2 + i * px, w, w, 0.6, { stroke: s.c('blue'), lw: 0.5 });
    // The same picture at the scale of the 2012 photos: 224 / 256 is 28 / 32.
    const big = s.win('alex', 'fresh');
    s.alpha(1 - big, () => s.text('32 × 32 image, 28 × 28 crop', cx, cy + size / 2 + 4.5 * s.u, { size: 3, font: 'mono', color: s.c('--ink-2') }));
    s.alpha(big, () => s.text('256 × 256 photo, 224 × 224 crop', cx, cy + size / 2 + 4.5 * s.u, { size: 3, font: 'mono', color: s.c('--ink-2') }));
    const gx = s.w * (s.tall ? 0.76 : 0.72);
    const gp = 5.6 * s.u;
    const grid = 1 - s.ease('alex', 0.6);
    s.alpha(grid, () => {
      starts(s, gx, cy, 5, 5, gp, (a, b) => a * 5 + b <= k);
      edgeLabels(s, gx, cy, 5, 5, gp, { top: s.ease('across', 0.6), left: s.ease('down', 0.6) }, { col: s.since('across') >= 0 ? j : -1, row: inDown ? i : -1 });
      s.text('start positions', gx, cy + 2.5 * gp + 4.5 * s.u, { size: 3, font: 'mono', color: s.c('--ink-2') });
    });
    const facts: [string, Ink, number][] = [
      ['60 million', 'blue', s.ease('alex', 0.6, 1)],
      ['adjustable numbers', '--ink-2', s.ease('alex', 0.6, 1)],
      ['1.2 million photos', 'orange', after(s, 'alex', 0.5)],
      ['over 2,000 versions', 'green', after(s, 'alex2', 0.75)],
      ['of every photo', '--ink-2', after(s, 'alex2', 0.75)],
    ];
    s.alpha(big, () => facts.forEach(([t, ink, a], n) => s.alpha(a, () => s.text(t, gx, cy - 12 * s.u + n * 6 * s.u + (n > 2 ? 3 * s.u : 0), { size: 3.4, font: 'mono', weight: n % 3 === 0 || n === 3 ? 650 : 500, color: s.c(ink) }))));
    cite(s, 'Krizhevsky, Sutskever & Hinton, 2012', s.win('alex', 'fresh'));
    const ly = s.h * 0.64;
    const done = 1 - s.ease('alex', 0.6);
    s.alpha(done * after(s, 'plus', 0.3), () => s.text('32 − 28 + 1 = 5 places across', s.w / 2, ly, { size: 3.6, font: 'mono', weight: 600, color: s.c('--ink-2') }));
    s.alpha(done * after(s, 'down', 0.55), () => s.text('5 × 5 = 25 crops', s.w / 2, ly + 6.5 * s.u, { size: 3.8, font: 'mono', weight: 650, color: s.c('blue') }));
    s.alpha(done * after(s, 'flips', 0.4), () => s.text('25 × 2 = 50 versions', s.w / 2, ly + 13 * s.u, { size: 3.6, font: 'mono', weight: 600, color: s.c('--ink-2') }));
    s.alpha(big * after(s, 'alex2', 0.5), () => s.text('label-preserving transformations', s.w / 2, ly + 6.5 * s.u, { size: 3.5, italic: true, color: s.c('--ink-2') }));
    // Each epoch, the same image comes out differently.
    s.alpha(s.ease('fresh', 0.6, 0.6), () => [0, 1, 2].forEach((n) => {
      const y = cy + (n - 1) * 13 * s.u;
      const r = rnd(n + 7.3);
      const g = shift(ARROW, Math.round(2 * r - 1), Math.round(2 * rnd(n + 3.1) - 1));
      s.alpha(s.ease('fresh', 0.4, 1 + 0.5 * n), () => {
        pixels(s, gx + 7 * s.u, y, 10 * s.u, rnd(n + 1.9) < 0.5 ? mirror(g) : g, 'orange');
        s.text(`epoch ${n + 1}`, gx - 0.5 * s.u, y, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-2') });
      });
    }));
    s.alpha(s.ease('fresh', 0.6), () => s.text('training: a fresh random crop and flip, every time', s.w / 2, s.h * 0.78, { size: 3.1, font: 'mono', color: s.c('green') }));
    s.alpha(s.ease('test', 0.6), () => s.text('validation, test: the middle crop, always', s.w / 2, s.h * 0.86, { size: 3.1, font: 'mono', color: s.c('--ink-2') }));
  },
};

// Loss curves as the overfitting explainer draws them, and the same run trained with augmentation.
const T = (e: number) => 2.3 * 0.84 ** e;
const V = (e: number) => T(e) + 0.05 + 0.007 * e * e;
const TA = (e: number) => 0.3 + 2 * 0.82 ** e;
const VA = (e: number) => TA(e) + 0.05 + 0.0015 * e * e;

/** The band between two curves from e0 to e1, filled. */
function band(s: Scene, F: ReturnType<typeof frame>, lo: (e: number) => number, hi: (e: number) => number, e0: number, e1: number, k: Ink, a: number) {
  const c = s.ctx;
  c.beginPath();
  for (let e = e0; e <= e1 + 1e-9; e += 0.25) c.lineTo(F.X(e), F.Y(hi(e)));
  for (let e = e1; e >= e0 - 1e-9; e -= 0.25) c.lineTo(F.X(e), F.Y(lo(e)));
  c.closePath();
  c.fillStyle = s.tint(k, a);
  c.fill();
}

const gap: SceneDef = {
  draw(s) {
    const F = frame(12 * s.u, s.h * 0.1, s.w - 8 * s.u, s.h - 10 * s.u, [0, 16], [0, 2.5]);
    axes(s, F, 'epoch', 'L', { x: '--ink-3', y: 'red' });
    xTicks(s, F, [4, 8, 12]);
    let kx = F.X(4.2);
    kx = key(s, kx, F.t + 2 * s.u, 'blue', 'train');
    key(s, kx, F.t + 2 * s.u, 'gold', 'val');
    const again = s.ease('with', 0.8);
    s.alpha(again, () => {
      const x = F.X(4.2);
      const y = F.t + 7.5 * s.u;
      s.line(x, y, x + 4 * s.u, y, s.c('--ink-3'), 0.6, [1, 0.8]);
      s.text('without augmentation', x + 5.2 * s.u, y, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-3') });
    });
    const grow = s.ease('before', 2.4, 0.3);
    const dash = again > 0.5 ? [1.2, 1] : undefined;
    s.alpha(1 - 0.55 * again, () => {
      s.alpha(after(s, 'lower', 0.45), () => band(s, F, T, V, 7.6, 16, 'red', 0.08));
      curve(s, F, T, 0, 16, 'blue', { upto: grow, dash });
      curve(s, F, V, 0, 16, 'gold', { upto: grow, dash });
    });
    // With augmentation: the training curve on its beat, the validation curve on the next.
    s.alpha(after(s, 'lower', 0.45), () => band(s, F, TA, VA, 7.6, 16, 'green', 0.14));
    curve(s, F, TA, 0, 16, 'blue', { upto: s.ease('with', 3, 0.6), width: 0.75 });
    curve(s, F, VA, 0, 16, 'gold', { upto: s.ease('lower', 3, 0.3), width: 0.75 });
    s.alpha(after(s, 'with', 0.7), () => s.text('a little higher', F.X(16) - 1 * s.u, F.Y(TA(16)) + 4 * s.u, { size: 3.1, font: 'mono', align: 'right', color: s.c('blue'), halo: true }));
    s.alpha(s.ease('lower', 0.6, 3.3), () => s.text('lower', F.X(16) - 1 * s.u, F.Y(VA(16)) - 4 * s.u, { size: 3.1, font: 'mono', align: 'right', color: s.c('gold'), halo: true }));
    s.alpha(after(s, 'lower', 0.5), () => s.text('smaller gap', F.X(12), F.Y((TA(12) + VA(12)) / 2), { size: 3.4, weight: 600, color: s.c('green'), halo: true }));
  },
};

export const scenes: Record<string, SceneDef> = { variety, crops, gap };

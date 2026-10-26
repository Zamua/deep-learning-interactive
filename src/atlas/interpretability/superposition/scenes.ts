import type { Scene, SceneDef } from '../../../lecture/scene';
import { Rng } from '../../../core/rand';
import type { Ink } from '../../linear-algebra/draw';
import { cells, columns, frame, type Frame, rich } from '../draw';

const DIRS: [number, number][] = [
  [1, 0],
  [-0.5, Math.sqrt(3) / 2],
  [-0.5, -Math.sqrt(3) / 2],
];
const KS = ['purple', 'teal', 'gold'] as const;

/** A square plot of the 2-D stream, in the top part of the stage. */
function plot(s: Scene, frac = 0.62): Frame {
  const side = Math.min(s.h * frac, s.w * 0.8);
  const cx = s.w / 2;
  const top = s.h * 0.05;
  return frame(cx - side / 2, top, cx + side / 2, top + side, [-1.35, 1.35], [-1.35, 1.35]);
}

function ring(s: Scene, F: Frame): void {
  s.line(F.X(-1.3), F.Y(0), F.X(1.3), F.Y(0), s.c('--axis'), 0.25);
  s.line(F.X(0), F.Y(-1.3), F.X(0), F.Y(1.3), s.c('--axis'), 0.25);
  s.circle(F.X(0), F.Y(0), F.X(1) - F.X(0), { stroke: s.tint('--ink-3', 0.5), lw: 0.25 });
}

/** Feature directions as arrows from the origin, each labelled W[i] past its tip. */
function features(s: Scene, F: Frame, a: number, grow = 1, labels = true): void {
  s.alpha(a, () => {
    DIRS.forEach(([x, y], i) => {
      s.arrow(F.X(0), F.Y(0), F.X(x * grow), F.Y(y * grow), s.c(KS[i]!), 0.5, 2.4);
      if (labels) s.text(`W[${i}]`, F.X(x * 1.25), F.Y(y * 1.22), { size: 3.4, font: 'mono', weight: 650, color: s.c(KS[i]!), halo: true });
    });
  });
}

const room: SceneDef = {
  draw(s) {
    const F = plot(s);
    ring(s, F);
    const three = s.ease('three', 0.8);
    const size = s.tall ? 3.4 : 3.8;
    s.alpha(s.ease('perp', 0.6) * (1 - three), () => {
      s.arrow(F.X(0), F.Y(0), F.X(1), F.Y(0), s.c('purple'), 0.5, 2.4);
      s.arrow(F.X(0), F.Y(0), F.X(0), F.Y(1), s.c('teal'), 0.5, 2.4);
      const q = 0.14;
      s.line(F.X(q), F.Y(0), F.X(q), F.Y(q), s.c('--ink-3'), 0.25);
      s.line(F.X(q), F.Y(q), F.X(0), F.Y(q), s.c('--ink-3'), 0.25);
      s.text('2 features, exactly perpendicular', s.w / 2, s.h * 0.78, { size: 3.4, color: s.c('--ink-2') });
    });
    features(s, F, three, three);
    s.alpha(s.ease('three', 0.6, 1.5), () => {
      const c = s.ctx;
      c.beginPath();
      c.arc(F.X(0), F.Y(0), F.X(0.3) - F.X(0), -(2 * Math.PI) / 3, 0);
      c.strokeStyle = s.c('--ink-2');
      c.lineWidth = 0.3 * s.u;
      c.stroke();
      s.text('120°', F.X(0.32), F.Y(0.32), { size: 3, font: 'mono', align: 'left', color: s.c('--ink-2'), halo: true });
    });
    s.alpha(s.ease('three', 0.6, 1.5) * (1 - s.ease('rows', 0.6)), () => s.text('3 features, 120° apart', s.w / 2, s.h * 0.78, { size: 3.4, color: s.c('--ink-2') }));
    s.alpha(s.win('rows', 'self'), () => {
      const rows = ['[1, 0]', '[−0.5, 0.87]', '[−0.5, −0.87]'];
      rows.forEach((r, i) => s.alpha(s.ease('rows', 0.5, 0.6 + i * 1.6), () => rich(s, [[`W[${i}] = `, KS[i]!], [r, '--ink']], s.w / 2, s.h * (0.74 + i * 0.08), { size })));
    });
    s.alpha(s.ease('self', 0.6), () => rich(s, [['W[0] · W[0]', 'purple'], [' = 1 × 1 + 0 × 0 = ', '--ink-2'], ['1', 'green']], s.w / 2, s.h * 0.76, { size }));
    s.alpha(s.ease('pair', 0.6), () => rich(s, [['W[0] · W[1]', 'purple'], [' = 1 × (−0.5) + 0 × 0.87 = ', '--ink-2'], ['−0.5', 'red']], s.w / 2, s.h * 0.87, { size }));
  },
};

/** The stored values f = [3, 0, 2] and the stream they make, 3 W[0] + 2 W[2]. */
const X = [2, -1.74];

/** A plot wide enough for the stream [2, -1.74], in the top part of the stage. */
function wide(s: Scene): Frame {
  const xr: [number, number] = [-1.2, 3.6];
  const yr: [number, number] = [-2.3, 1.3];
  const hgt = Math.min(s.h * 0.45, (s.w * 0.8 * (yr[1] - yr[0])) / (xr[1] - xr[0]));
  const wid = (hgt * (xr[1] - xr[0])) / (yr[1] - yr[0]);
  const top = s.h * 0.03;
  return frame(s.w / 2 - wid / 2, top, s.w / 2 + wid / 2, top + hgt, xr, yr);
}

const read: SceneDef = {
  draw(s) {
    const F = wide(s);
    s.line(F.X(-1.2), F.Y(0), F.X(3.6), F.Y(0), s.c('--axis'), 0.25);
    s.line(F.X(0), F.Y(-2.3), F.X(0), F.Y(1.3), s.c('--axis'), 0.25);
    s.circle(F.X(0), F.Y(0), F.X(1) - F.X(0), { stroke: s.tint('--ink-3', 0.5), lw: 0.25 });
    features(s, F, 0.4, 1, false);
    const rd = s.ease('read', 0.6);
    const o = { size: 3.2, font: 'mono', weight: 650, halo: true } as const;
    // 3 W[0], then 2 W[2] from its tip, then their sum.
    const a3 = s.ease('scale', 0.8);
    s.alpha(a3, () => {
      s.arrow(F.X(0), F.Y(0), F.X(3 * a3), F.Y(0), s.c('purple'), 0.6, 2.6);
      s.alpha(1 - rd, () => s.text('3 × W[0]', F.X(1.5), F.Y(0.3), { ...o, color: s.c('purple') }));
    });
    const a2 = s.ease('scale', 0.8, 1.6);
    s.alpha(a2 * (1 - 0.6 * rd), () => {
      s.arrow(F.X(3), F.Y(0), F.X(3 - 1 * a2), F.Y(-1.74 * a2), s.c('gold'), 0.6, 2.6);
      s.text('2 × W[2]', F.X(2.75), F.Y(-0.85), { ...o, align: 'left', color: s.c('gold') });
    });
    s.alpha(s.ease('sum', 0.6), () => {
      s.arrow(F.X(0), F.Y(0), F.X(X[0]!), F.Y(X[1]!), s.c('orange'), 0.8, 2.8);
      s.text('x', F.X(0.8), F.Y(-1.0), { ...o, size: 3.6, color: s.c('orange') });
    });
    s.alpha(rd, () => {
      s.line(F.X(X[0]!), F.Y(X[1]!), F.X(X[0]!), F.Y(0), s.c('green'), 0.35, [1, 0.8]);
      s.circle(F.X(X[0]!), F.Y(0), 1.1 * s.u, { fill: s.c('green') });
      s.text('reads 2', F.X(X[0]!), F.Y(0.32), { ...o, color: s.c('green') });
    });

    const size = s.tall ? 3.2 : 3.6;
    const Y = [0.56, 0.645, 0.73, 0.815, 0.9].map((f) => s.h * f);
    const line = (a: number, runs: [string, Ink][], y: number) => s.alpha(a, () => rich(s, runs, s.w / 2, y, { size }));
    line(s.ease('store', 0.6), [['f = ', '--ink-2'], ['[3, 0, 2]', 'blue']], Y[0]!);
    line(s.win('scale', 'read'), [['3 × [1, 0] = ', '--ink-2'], ['[3, 0]', 'purple']], Y[1]!);
    line(s.ease('scale', 0.6, 1.6) * (1 - rd), [['2 × [−0.5, −0.87] = ', '--ink-2'], ['[−1, −1.74]', 'gold']], Y[2]!);
    line(s.win('sum', 'read'), [['x = [3 − 1, 0 − 1.74] = ', '--ink-2'], ['[2, −1.74]', 'orange']], Y[3]!);
    const rule = s.ease('rule', 0.6);
    line(rd, [['x = ', '--ink-2'], ['[2, −1.74]', 'orange']], Y[1]!);
    line(rd * (1 - rule), [['x · W[0] = 2 × 1 + (−1.74) × 0 = ', '--ink-2'], ['2', 'green']], Y[2]!);
    line(s.ease('split', 0.6) * (1 - rule), [['= 3 × (W[0] · W[0]) + 2 × (W[2] · W[0])', '--ink-2']], Y[3]!);
    line(s.ease('split', 0.6, 2.5) * (1 - rule), [['= 3 × 1 + 2 × (−0.5) = 3 − 1 = ', '--ink-2'], ['2', 'green']], Y[4]!);
    line(rule, [['reading = own value + (−0.5) × each other', '--ink']], Y[2]!);
    line(s.ease('rule', 0.6, 1.2), [['feature 0: 3 + (−0.5) × 2 = ', '--ink-2'], ['2', 'green']], Y[3]!);
    line(s.ease('rule', 0.6, 3.5), [['the leak, ', '--ink-2'], ['−1', 'red'], [', is interference', '--ink-2']], Y[4]!);
  },
};

// Which of five features are on for each of twelve tokens: rare, with one collision.
const rng = new Rng(3);
const ON: boolean[][] = Array.from({ length: 5 }, () => Array.from({ length: 12 }, () => rng.next() < 0.12));
for (let t = 0; t < 12; t++) for (let f = 1; f < 5; f++) if (ON[0]![t] && ON[f]![t]) ON[f]![t] = false;
ON[1]![7] = true;
ON[3]![7] = true;

const sparse: SceneDef = {
  draw(s) {
    const xs = columns(s, 12, s.tall ? 7.6 : 8.4);
    const ys = [0, 1, 2, 3, 4].map((i) => s.h * (0.14 + i * 0.075));
    const grid = 1 - s.ease('more', 0.6);
    s.alpha(grid, () => {
      s.text('tokens →', xs[11]! + 3 * s.u, ys[0]! - 6 * s.u, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
      ys.forEach((y, f) => {
        s.text(`f${f}`, xs[0]! - 5 * s.u, y, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-2') });
        xs.forEach((x, t) => {
          const on = ON[f]![t];
          s.circle(x, y, (on ? 1.6 : 0.6) * s.u, { fill: on ? s.c(t === 7 ? 'red' : 'green') : s.tint('--ink-3', 0.4) });
        });
      });
      s.alpha(s.ease('rare', 0.6, 3), () => {
        s.rrect(xs[7]! - 3 * s.u, ys[0]! - 3.5 * s.u, 6 * s.u, ys[4]! - ys[0]! + 7 * s.u, 1.5, { stroke: s.c('red'), lw: 0.35 });
        s.text('two at once: rare', xs[7]!, ys[4]! + 7 * s.u, { size: 3, font: 'mono', color: s.c('red') });
      });
    });
    s.alpha(s.ease('clip', 0.6) * grid, () => {
      rich(s, [['alone, f1 reads ', '--ink-2'], ['−0.5', 'red'], ['  → ReLU →  ', '--ink-3'], ['0', 'green']], s.w / 2, s.h * 0.82, { size: s.tall ? 3.4 : 3.8, font: 'mono' });
    });
    s.alpha(s.ease('more', 0.6), () => {
      const l = s.w / 2 - (s.tall ? 40 : 48) * s.u;
      const full = (s.tall ? 80 : 96) * s.u;
      const bar = (y: number, w: number, k: 'slate' | 'green', label: string, grow: number) => {
        s.text(label, l, y - 6 * s.u, { size: 3.4, align: 'left', color: s.c(k) });
        s.rrect(l, y - 3 * s.u, Math.max(1, w * grow), 6 * s.u, 1, { fill: s.tint(k, 0.35), stroke: s.c(k), lw: 0.3 });
      };
      bar(s.h * 0.3, full * 0.12, 'slate', 'exactly perpendicular: d directions', s.ease('more', 0.8));
      bar(s.h * 0.5, full, 'green', 'nearly perpendicular: far more than d', s.ease('more', 2, 1.5));
      s.text('room for many sparse features', s.w / 2, s.h * 0.72, { size: 3.6, weight: 600, color: s.c('green') });
    });
  },
};

/** Two worked readings: f = [2, 1, 3] read at feature 1, then f = [0.5, 2, 1] at feature 0 through a ReLU. */
const tryIt: SceneDef = {
  draw(s) {
    const size = s.tall ? 3.4 : 3.8;
    const two = s.ease('p2', 0.8);
    const xs = columns(s, 3, s.tall ? 20 : 22);
    const vals = two < 0.5 ? ['2', '1', '3'] : ['0.5', '2', '1'];
    const k = two < 0.5 ? 1 : 0;
    const flip = Math.abs(two - 0.5) * 2;
    const y = s.h * 0.2;
    s.alpha(s.ease('p1', 0.6), () => {
      xs.forEach((x, i) => s.text(`f${i}`, x, y - 8 * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c(KS[i]!) }));
      s.alpha(flip, () => {
        cells(s, xs, y, vals, 'slate', { w: 14, h: 9, on: xs.map((_, i) => (i === k ? 1 : 0)) });
        s.text(k === 1 ? 'read feature 1' : 'read feature 0, then a ReLU', s.w / 2, s.h * 0.35, { size, color: s.c('--ink-2') });
      });
    });
    const L = [0.5, 0.6, 0.7].map((f) => s.h * f);
    const one = 1 - two;
    s.alpha(s.ease('own', 0.6) * one, () => rich(s, [['own value: ', '--ink-2'], ['1', 'teal']], s.w / 2, L[0]!, { size }));
    s.alpha(s.ease('own', 0.6, 2.2) * one, () => rich(s, [['leaks: ', '--ink-2'], ['(−0.5) × 2 = −1', 'red'], [',  ', '--ink-2'], ['(−0.5) × 3 = −1.5', 'red']], s.w / 2, L[1]!, { size }));
    s.alpha(s.ease('a1', 0.6) * one, () => rich(s, [['1 − 1 − 1.5 = ', '--ink-2'], ['−1.5', 'green']], s.w / 2, L[2]!, { size: size + 0.4, weight: 650 }));
    s.alpha(s.ease('a2', 0.6), () => rich(s, [['0.5 + (−0.5) × 2 + (−0.5) × 1 = ', '--ink-2'], ['−1', 'red']], s.w / 2, L[0]!, { size }));
    s.alpha(s.ease('a2', 0.6, 2.5), () => rich(s, [['ReLU(−1) = ', '--ink-2'], ['0', 'green']], s.w / 2, L[1]!, { size: size + 0.4, weight: 650 }));
  },
};

export const scenes: Record<string, SceneDef> = { room, read, sparse, try: tryIt };

import type { Scene, SceneDef } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { Rng } from '../../../core/rand';
import type { Ink } from '../../linear-algebra/draw';
import { after, caption, Frame, reluGlyph } from '../../networks/draw';
import { cells, columns, rich } from '../draw';

/** Feature 0, 1 and 2, in the order the script names them. */
const FK: Color[] = ['teal', 'gold', 'green'];
const R3 = Math.sqrt(3) / 2;
const DIRS: [number, number][] = [
  [1, 0],
  [-0.5, R3],
  [-0.5, -R3],
];

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** A plot beside its text lines on a wide stage, above them otherwise. */
const stacked = (s: Scene) => s.tall || s.w / s.h < 1.45;

/** A plot of the window `xr` by `yr`, scaled to fit, and the center and rows of its text lines. */
function plot(s: Scene, xr: [number, number], yr: [number, number], frac: number) {
  const u = s.u;
  const ratio = (xr[1] - xr[0]) / (yr[1] - yr[0]);
  const st = stacked(s);
  const hh = st ? Math.min(s.h * frac, (s.w - 16 * u) / ratio) : Math.min(s.h * 0.86, (s.w * 0.5) / ratio);
  const ww = hh * ratio;
  const l = st ? s.w / 2 - ww / 2 : s.w * 0.04;
  const t = st ? 4 * u : (s.h - hh) / 2;
  const F = new Frame(s, l, t, l + ww, t + hh, xr, yr);
  const cx = st ? s.w / 2 : (F.r + s.w) / 2;
  const y0 = st ? F.b + 7.5 * u : s.h * 0.35;
  return { F, cx, y: (i: number) => y0 + i * 7.5 * u };
}

/** An arrow in data coordinates. */
const arrow = (s: Scene, F: Frame, x0: number, y0: number, x1: number, y1: number, k: Ink, width = 0.6) => s.arrow(F.X(x0), F.Y(y0), F.X(x1), F.Y(y1), s.c(k), width, 2.6);

/** A label in a feature's color, with a halo. */
const label = (s: Scene, text: string, x: number, y: number, k: Ink, align: CanvasTextAlign = 'center', size = 3.2) => s.text(text, x, y, { size, font: 'mono', weight: 650, align, color: s.c(k), halo: true });

/** A property the model might track, in a pill. */
function pill(s: Scene, x: number, y: number, text: string) {
  const size = 3.2;
  const w = s.measure(text, { size, font: 'mono' }) + 4 * s.u;
  const h = 6.4 * s.u;
  s.rrect(x - w / 2, y - h / 2, w, h, 3, { fill: s.tint('slate', 0.1), stroke: s.tint('slate', 0.5), lw: 0.3 });
  s.text(text, x, y + 0.2 * s.u, { size, font: 'mono', color: s.c('--ink-2') });
}

/** A small right-angle mark at the origin between the two axes. */
function rightAngle(s: Scene, F: Frame, q: number) {
  s.line(F.X(q), F.Y(0), F.X(q), F.Y(q), s.c('--ink-3'), 0.25);
  s.line(F.X(q), F.Y(q), F.X(0), F.Y(q), s.c('--ink-3'), 0.25);
}

// ---- more to track than room: two features at right angles, stored and read back

const PROPS = ['French?', 'in a quote?', 'a name?', 'a number?', 'plural?', 'past tense?', 'a date?', 'in code?'];

const room: SceneDef = {
  draw(s) {
    const u = s.u;
    const pl = s.ease('feature', 0.8);
    // A stream of d = 2 numbers, and far more than two things to track.
    s.alpha(1 - pl, () => {
      const xs = columns(s, 2, 14);
      const y0 = s.h * 0.15;
      s.text('x', xs[0]! - 11 * u, y0, { size: 4.2, font: 'mono', weight: 650, align: 'right', color: s.c('orange') });
      cells(s, xs, y0, ['', ''], 'orange');
      s.text('d = 2 numbers per token', s.w / 2, y0 + 9 * u, { size: 3.2, font: 'mono', color: s.c('--ink-2') });
      const per = s.tall ? 3 : 4;
      const gap = (s.tall ? 30 : 28) * u;
      PROPS.forEach((p, i) => {
        const r = Math.floor(i / per);
        const n = Math.min(per, PROPS.length - r * per);
        const x = s.w / 2 + ((i % per) - (n - 1) / 2) * gap;
        s.alpha(after(s, 'want', 0.35 + 0.06 * i), () => pill(s, x, s.h * 0.42 + r * 10 * u, p));
      });
      s.alpha(after(s, 'want', 0.8), () => caption(s, 'far more to track than d', s.h * 0.86));
    });
    const { F, cx, y } = plot(s, [-1.3, 3.9], [-1.3, 2.9], 0.62);
    const store = s.ease('store', 0.6);
    const lim = s.ease('limit', 0.6);
    s.alpha(pl, () => {
      F.axes();
      s.circle(F.X(0), F.Y(0), F.X(1) - F.X(0), { stroke: s.tint('--ink-3', 0.45), lw: 0.25 });
      // The unit arrows: feature 0, then feature 1 at a right angle.
      arrow(s, F, 0, 0, 1, 0, FK[0]!, 0.7);
      const named = s.ease('perp', 0.6);
      s.alpha((1 - named) * (1 - store), () => label(s, 'feature 0', F.X(0.5), F.Y(0) + 4 * u, FK[0]!));
      s.alpha(named * (1 - store), () => label(s, 'W[0]', F.X(0.5), F.Y(0) + 4 * u, FK[0]!));
      s.alpha(named, () => {
        arrow(s, F, 0, 0, 0, 1, FK[1]!, 0.7);
        s.alpha(1 - store, () => label(s, 'W[1]', F.X(0) - 2 * u, F.Y(0.9), FK[1]!, 'right'));
        rightAngle(s, F, 0.16);
      });
    });
    // Three of feature 0's arrow, then two of feature 1's, and the stream they make.
    const a3 = after(s, 'store', 0.35, 0.8);
    const a2 = after(s, 'store', 0.5, 0.8);
    s.alpha(Math.min(1, a3 * 3) * (1 - 0.7 * lim), () => {
      arrow(s, F, 0, 0, 3 * a3, 0, FK[0]!, 0.6);
      label(s, '3 × W[0]', F.X(1.9), F.Y(0) + 4 * u, FK[0]!);
    });
    s.alpha(Math.min(1, a2 * 3) * (1 - 0.7 * lim), () => {
      arrow(s, F, 3, 0, 3, 2 * a2, FK[1]!, 0.6);
      label(s, '2 × W[1]', F.X(3) + 2 * u, F.Y(1), FK[1]!, 'left');
    });
    s.alpha(after(s, 'store', 0.7) * (1 - 0.7 * lim), () => {
      arrow(s, F, 0, 0, 3, 2, 'orange', 0.8);
      label(s, 'x', F.X(1.35), F.Y(1.25), 'orange', 'center', 3.8);
    });
    // Read back: the stream's shadow on feature 0's direction.
    s.alpha(s.ease('read', 0.6) * (1 - lim), () => {
      F.seg(3, 2, 3, 0, '--ink-3', 0.3, [0.8, 0.8]);
      s.circle(F.X(3), F.Y(0), 1.2 * u, { fill: s.c('purple') });
      label(s, 'reads 3', F.X(3), F.Y(-0.62), 'purple');
    });
    // No third right angle.
    s.alpha(lim, () => {
      const c = -Math.SQRT1_2;
      F.seg(0, 0, c, -c, 'red', 0.5, [1, 0.8]);
      label(s, '?', F.X(c) - 2 * u, F.Y(-c) - 2 * u, 'red', 'center', 4);
    });
    const size = 3.5;
    s.alpha(s.ease('perp', 0.6, 1.5) * (1 - store), () => rich(s, [['W = ', 'blue'], ['[[1, 0], [0, 1]]', '--ink']], cx, y(0), { size }));
    s.alpha(store * (1 - lim), () => rich(s, [['f = ', 'purple'], ['[3, 2]', '--ink']], cx, y(0), { size }));
    s.alpha(after(s, 'store', 0.6) * (1 - lim), () => rich(s, [['x = 3 × [1, 0] + 2 × [0, 1] = ', '--ink-2'], ['[3, 2]', 'orange']], cx, y(1), { size }));
    s.alpha(s.ease('read', 0.6, 0.8) * (1 - lim), () => rich(s, [['x · W[0] = 3 × 1 + 2 × 0 = ', '--ink-2'], ['3', 'purple']], cx, y(2), { size }));
    s.alpha(lim, () => {
      rich(s, [['in 2-D: no third right angle', 'red']], cx, y(0), { size });
      s.alpha(after(s, 'limit', 0.5), () => rich(s, [['width d: at most d at right angles', '--ink-2']], cx, y(1), { size }));
    });
  },
};

// ---- three arrows, 120 degrees apart, and how much each pair overlaps

const three: SceneDef = {
  draw(s) {
    const u = s.u;
    const { F, cx, y } = plot(s, [-1.55, 1.55], [-1.32, 1.32], 0.62);
    const r1 = F.X(1) - F.X(0);
    F.axes();
    const un = s.ease('unit', 0.6);
    s.circle(F.X(0), F.Y(0), r1, { stroke: s.tint(un > 0.5 ? 'slate' : '--ink-3', 0.45 + 0.4 * un), lw: 0.25 + 0.15 * un });
    // Feature 1 turns from 90 to 120 degrees; feature 2 grows in at 240.
    const e = after(s, 'three', 0.35, 1.4);
    const ang = [0, (Math.PI / 2) * (1 + e / 3), (4 * Math.PI) / 3];
    const len = [1, 1, e];
    const hiSelf = s.win('self', 'pair');
    const hiPair = s.ease('pair', 0.6);
    ang.forEach((a, i) => {
      if (len[i]! < 0.02) return;
      const w = 0.7 + 0.3 * (i === 0 ? Math.max(hiSelf, hiPair) : i === 1 ? hiPair : 0);
      arrow(s, F, 0, 0, Math.cos(a) * len[i]!, Math.sin(a) * len[i]!, FK[i]!, w);
    });
    // The three equal angles between them.
    s.alpha(after(s, 'three', 0.7) * (1 - un), () => {
      const g = s.ctx;
      [0, 1, 2].forEach((k) => {
        g.beginPath();
        g.arc(F.X(0), F.Y(0), 0.3 * r1, -(k * 2 * Math.PI) / 3 - 0.16, -((k + 1) * 2 * Math.PI) / 3 + 0.16, true);
        g.strokeStyle = s.c('--ink-2');
        g.lineWidth = 0.3 * u;
        g.stroke();
        const m = ((2 * k + 1) * Math.PI) / 3;
        s.text('120°', F.X(0.52 * Math.cos(m)), F.Y(0.52 * Math.sin(m)), { size: 3, font: 'mono', color: s.c('--ink-2'), halo: true });
      });
    });
    // Each arrow's tip: its row of W.
    const tips: [string, number, number, CanvasTextAlign][] = [
      ['[1, 0]', 1.06, 0.13, 'left'],
      ['[−0.5, 0.87]', -0.5, 1.12, 'center'],
      ['[−0.5, −0.87]', -0.5, -1.12, 'center'],
    ];
    tips.forEach(([t, x, yy, al], i) => s.alpha(un * after(s, 'unit', i === 0 ? 0.55 : 0.75), () => label(s, t, F.X(x), F.Y(yy), FK[i]!, al, 3.1)));
    s.alpha(un * (1 - s.ease('self', 0.6)), () => label(s, 'length 1', F.X(0.5), F.Y(0) + 4 * u, '--ink-2', 'center', 3));
    const size = 3.4;
    s.alpha(s.win('three', 'unit'), () => rich(s, [['3 features, 120° apart', '--ink-2']], cx, y(0), { size }));
    s.alpha(s.win('unit', 'pair'), () => rich(s, [['each arrow: length 1', '--ink-2']], cx, y(0), { size }));
    s.alpha(s.ease('self', 0.6), () => rich(s, [['W[0] · W[0]', FK[0]!], [' = 1 × 1 + 0 × 0 = ', '--ink-2'], ['1', 'purple']], cx, y(1), { size }));
    s.alpha(hiPair, () => rich(s, [['W[0] · W[1]', FK[0]!], [' = 1 × (−0.5) + 0 × 0.87 = ', '--ink-2'], ['−0.5', 'red']], cx, y(2), { size }));
    s.alpha(after(s, 'pair', 0.55), () => rich(s, [['every pair overlaps by ', '--ink-2'], ['−0.5', 'red']], cx, y(0), { size }));
  },
};

// ---- store three values in two numbers, then read one back

/** The stored values f = [3, 0, 2] and the stream they make, 3 W[0] + 2 W[2]. */
const X = [2, -2 * R3];

const read: SceneDef = {
  draw(s) {
    const u = s.u;
    const { F, cx } = plot(s, [-1.2, 3.6], [-2.3, 1.3], 0.46);
    F.axes();
    s.circle(F.X(0), F.Y(0), F.X(1) - F.X(0), { stroke: s.tint('--ink-3', 0.45), lw: 0.25 });
    s.alpha(0.45, () => DIRS.forEach(([x, yy], i) => arrow(s, F, 0, 0, x, yy, FK[i]!, 0.5)));
    const rd = s.ease('read', 0.6);
    // 3 W[0], then 2 W[2] from its tip, then their sum.
    const a3 = s.ease('scale', 0.8);
    s.alpha(Math.min(1, a3 * 3) * (1 - 0.6 * rd), () => {
      arrow(s, F, 0, 0, 3 * a3, 0, FK[0]!, 0.6);
      s.alpha(1 - rd, () => label(s, '3 × W[0]', F.X(1.5), F.Y(0) - 3.4 * u, FK[0]!));
    });
    const a2 = s.ease('scale', 0.8, 1.6);
    s.alpha(Math.min(1, a2 * 3) * (1 - 0.6 * rd), () => {
      arrow(s, F, 3, 0, 3 - a2, -2 * R3 * a2, FK[2]!, 0.6);
      s.alpha(1 - rd, () => label(s, '2 × W[2]', F.X(2.75) + 2 * u, F.Y(-0.85), FK[2]!, 'left'));
    });
    s.alpha(s.ease('sum', 0.6), () => {
      arrow(s, F, 0, 0, X[0]!, X[1]!, 'orange', 0.8);
      label(s, 'x', F.X(0.75), F.Y(-1.0), 'orange', 'center', 3.6);
    });
    s.alpha(rd, () => {
      F.seg(X[0]!, X[1]!, X[0]!, 0, '--ink-3', 0.3, [0.8, 0.8]);
      s.circle(F.X(X[0]!), F.Y(0), 1.1 * u, { fill: s.c('purple') });
      label(s, 'reads 2', F.X(X[0]!), F.Y(0) - 3.4 * u, 'purple');
    });

    const size = s.tall ? 3.3 : 3.6;
    const Y = [0.57, 0.65, 0.73, 0.81, 0.89].map((f) => s.h * f);
    const line = (a: number, runs: [string, Ink][], yy: number) => s.alpha(a, () => rich(s, runs, cx, yy, { size }));
    const rule = s.ease('rule', 0.6);
    line(s.ease('store', 0.6) * (1 - rd), [['f = ', 'purple'], ['[3, 0, 2]', '--ink'], [': 0 and 2 on', '--ink-2']], Y[0]!);
    line(s.win('scale', 'read'), [['3 × [1, 0] = ', '--ink-2'], ['[3, 0]', FK[0]!]], Y[1]!);
    line(s.ease('scale', 0.6, 1.6) * (1 - rd), [['2 × [−0.5, −0.87] = ', '--ink-2'], ['[−1, −1.74]', FK[2]!]], Y[2]!);
    line(s.win('sum', 'read'), [['x = [3 − 1, 0 − 1.74] = ', '--ink-2'], ['[2, −1.74]', 'orange']], Y[3]!);
    line(s.win('sum', 'read') * after(s, 'sum', 0.55), [['3 values on top of each other: ', '--ink-2'], ['superposition', 'orange']], Y[4]!);
    line(rd, [['x = ', 'orange'], ['[2, −1.74]', '--ink']], Y[0]!);
    line(rd * (1 - rule), [['x · W[0] = 2 × 1 + (−1.74) × 0 = ', '--ink-2'], ['2', 'purple']], Y[1]!);
    line(s.ease('split', 0.6) * (1 - rule), [['= 3 × (W[0] · W[0]) + 2 × (W[2] · W[0])', '--ink-2']], Y[2]!);
    line(after(s, 'split', 0.55) * (1 - rule), [['= 3 × 1 + 2 × (−0.5) = 3 − 1 = ', '--ink-2'], ['2', 'purple']], Y[3]!);
    line(rule, [['reading = own value − 0.5 × each other on', '--ink']], Y[1]!);
    line(s.ease('rule', 0.6, 1.2), [['feature 0: 3 − 0.5 × 2 = ', '--ink-2'], ['2', 'purple']], Y[2]!);
    line(after(s, 'rule', 0.6), [['the leak, ', '--ink-2'], ['−1', 'red'], [', is interference', '--ink-2']], Y[3]!);
  },
};

// ---- sparse features rarely meet; a ReLU filters small leaks; more dimensions, more room

// Which of five features are on for each of twelve tokens: rare, with one collision.
const rng = new Rng(3);
const ON: boolean[][] = Array.from({ length: 5 }, () => Array.from({ length: 12 }, () => rng.next() < 0.12));
for (let t = 0; t < 12; t++) for (let f = 1; f < 5; f++) if (ON[0]![t] && ON[f]![t]) ON[f]![t] = false;
ON[1]![7] = true;
ON[3]![7] = true;

/** Five unit arrows 72 degrees apart, the first pointing up. */
const PENTA = [0, 1, 2, 3, 4].map((i) => Math.PI / 2 + (i * 2 * Math.PI) / 5);
const PK: Color[] = ['teal', 'gold', 'green', 'purple', 'blue'];

const sparse: SceneDef = {
  draw(s) {
    const u = s.u;
    // The tokens, and which features each turns on.
    const grid = 1 - s.ease('alone', 0.6);
    s.alpha(grid, () => {
      const xs = columns(s, 12, s.tall ? 7.6 : 8.4);
      const ys = [0, 1, 2, 3, 4].map((i) => s.h * (0.14 + i * 0.075));
      s.text('tokens →', xs[11]! + 3 * u, ys[0]! - 6 * u, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
      ys.forEach((yy, f) => {
        s.text(`f${f}`, xs[0]! - 5 * u, yy, { size: 3, font: 'mono', align: 'right', color: s.c('purple') });
        xs.forEach((x, t) => {
          const on = ON[f]![t];
          s.circle(x, yy, (on ? 1.6 : 0.6) * u, { fill: on ? s.c(t === 7 ? 'red' : 'purple') : s.tint('--ink-3', 0.4) });
        });
      });
      s.alpha(after(s, 'sparse', 0.55), () => {
        s.rrect(xs[7]! - 3 * u, ys[0]! - 3.5 * u, 6 * u, ys[4]! - ys[0]! + 7 * u, 1.5, { stroke: s.c('red'), lw: 0.35 });
        s.text('two at once: rare', xs[7]!, ys[4]! + 7 * u, { size: 3, font: 'mono', color: s.c('red'), halo: true });
      });
      caption(s, 'sparse: on for few tokens', s.h * 0.68);
      s.alpha(after(s, 'sparse', 0.7), () => caption(s, '1/100 × 1/100 = 1/10,000', s.h * 0.78, '--ink-2', 3.6));
    });
    // One feature on alone: feature 0 reads a leak, and the ReLU filters it.
    const leak = s.win('alone', 'many');
    s.alpha(leak, () => {
      const size = s.tall ? 3.4 : 3.8;
      rich(s, [['f = ', 'purple'], ['[0, 0, 2]', '--ink'], [': only feature 2 on', '--ink-2']], s.w / 2, s.h * 0.16, { size });
      s.alpha(after(s, 'alone', 0.45), () => rich(s, [['feature 0 reads 0 − 0.5 × 2 = ', '--ink-2'], ['−1', 'red']], s.w / 2, s.h * 0.26, { size }));
      const xs = columns(s, 3, s.tall ? 28 : 30);
      const yy = s.h * 0.48;
      s.alpha(after(s, 'alone', 0.6), () => cells(s, [xs[0]!], yy, ['−1'], 'red', { w: 13, h: 9, on: [0.6] }));
      const r = s.ease('relu', 0.6);
      s.alpha(r, () => {
        s.arrow(xs[0]! + 7.5 * u, yy, xs[1]! - 9.5 * u, yy, s.c('--ink-3'), 0.35, 2);
        reluGlyph(s, xs[1]!, yy, 16, 11, 'slate', { z: -1, dot: 'red', on: 0.4 });
        s.text('ReLU', xs[1]!, yy + 8.5 * u, { size: 3, font: 'mono', color: s.c('--ink-2') });
      });
      s.alpha(s.ease('relu', 0.6, 0.8), () => {
        s.arrow(xs[1]! + 9.5 * u, yy, xs[2]! - 7.5 * u, yy, s.c('--ink-3'), 0.35, 2);
        cells(s, [xs[2]!], yy, ['0'], 'purple', { w: 13, h: 9, on: [0.6] });
      });
      s.alpha(s.ease('relu', 0.6, 1.6), () => caption(s, 'feature 0 reads off: the leak is filtered', s.h * 0.7, '--ink-2', s.tall ? 3.3 : 3.6));
    });
    // Exactly perpendicular: d of them. Nearly perpendicular: far more.
    s.alpha(s.win('many', 'toy'), () => {
      const half = Math.min(s.tall ? 40 : 48, s.w / s.u / 2 - 8) * u;
      const l = s.w / 2 - half;
      const bar = (yy: number, w: number, k: 'slate' | 'green', text: string, grow: number) => {
        s.text(text, l, yy - 6 * u, { size: 3.4, align: 'left', color: s.c(k) });
        s.rrect(l, yy - 3 * u, Math.max(1, w * grow), 6 * u, 1, { fill: s.tint(k, 0.35), stroke: s.c(k), lw: 0.3 });
      };
      bar(s.h * 0.3, 2 * half * 0.12, 'slate', 'exactly at right angles: d arrows', s.ease('many', 0.8));
      bar(s.h * 0.5, 2 * half, 'green', 'nearly at right angles: far more', s.ease('many', 2, 1.5));
      s.alpha(after(s, 'many', 0.6), () => caption(s, 'room for many sparse features', s.h * 0.72, 'green', 3.6, { weight: 600 }));
    });
    // The toy models: five features squeezed into two numbers, dense and then sparse.
    const toy = s.ease('toy', 0.6);
    s.alpha(toy, () => {
      const pw = Math.min(46 * u, (s.w - 14 * u) / 2);
      const top = s.h * 0.16;
      const ph = Math.min(s.h * 0.5, pw);
      const rad = Math.min(pw, ph) * 0.3;
      caption(s, '5 features → 2 numbers → ReLU', s.h * 0.1, '--ink-2', 3.4);
      [0, 1].forEach((k) => {
        const x0 = s.w / 2 + (k === 0 ? -pw - 2 * u : 2 * u);
        s.rrect(x0, top, pw, ph, 1.5, { fill: s.tint('slate', 0.05), stroke: s.tint('slate', 0.4), lw: 0.3 });
        const ox = x0 + pw / 2;
        const oy = top + ph / 2 + 2 * u;
        s.text(k === 0 ? 'dense' : 'sparse', ox, top + 4.5 * u, { size: 3.3, font: 'mono', weight: 650, color: s.c('--ink-2') });
        s.line(ox - rad * 1.25, oy, ox + rad * 1.25, oy, s.c('--axis'), 0.25);
        s.line(ox, oy - rad * 1.25, ox, oy + rad * 1.25, s.c('--axis'), 0.25);
        const dense = k === 0 ? after(s, 'found', 0.05, 0.8) : 0;
        const sp = k === 1 ? after(s, 'found', 0.5, 0.8) : 0;
        if (k === 0) s.alpha(dense, () => [0, 1].forEach((i) => s.arrow(ox, oy, ox + Math.cos(i * Math.PI / 2) * rad, oy - Math.sin(i * Math.PI / 2) * rad, s.c(PK[i]!), 0.55, 2.2)));
        if (k === 1) s.alpha(sp, () => {
          const g = s.ctx;
          g.beginPath();
          PENTA.forEach((a, i) => (i ? g.lineTo(ox + Math.cos(a) * rad, oy - Math.sin(a) * rad) : g.moveTo(ox + Math.cos(a) * rad, oy - Math.sin(a) * rad)));
          g.closePath();
          g.strokeStyle = s.tint('--ink-3', 0.6);
          g.lineWidth = 0.25 * u;
          g.setLineDash([0.8 * u, 0.8 * u]);
          g.stroke();
          g.setLineDash([]);
          PENTA.forEach((a, i) => s.arrow(ox, oy, ox + Math.cos(a) * rad, oy - Math.sin(a) * rad, s.c(PK[i]!), 0.55, 2.2));
        });
        s.alpha(k === 0 ? dense : sp, () => s.text(k === 0 ? 'top 2 kept' : 'all 5: a pentagon', ox, top + ph - 4 * u, { size: 3.1, font: 'mono', color: s.c('--ink-2') }));
      });
      s.alpha(after(s, 'found', 0.5), () => caption(s, 'sparse features: more fit, overlapping', top + ph + 8 * u, 'green', 3.5));
    });
    cite(s, 'Elhage, Olah et al., 2022', toy);
  },
};

export const scenes: Record<string, SceneDef> = { room, three, read, sparse };

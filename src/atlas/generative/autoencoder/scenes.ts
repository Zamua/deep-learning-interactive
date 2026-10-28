import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { cells, columns, rowLabel, verdict } from '../../draw';
import { after } from '../../networks/draw';
import { caption, fmt, funnel, rich, shades, stroke } from '../draw';

/** The pen path of the handwritten 7, in grid units (column, row) of a 28 by 28 image. */
const PEN: [number, number][] = [[7, 7], [21, 6.5], [13, 23]];
const DIGIT = stroke(28, PEN, 1.1);
/** What a 16-number code gives back: the same 7, blurred. */
const REBUILT = DIGIT.map((r, i) =>
  r.map((_, j) => {
    let acc = 0;
    let wsum = 0;
    for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
      const v = DIGIT[i + a]?.[j + b];
      if (v === undefined) continue;
      const w = Math.exp(-(a * a + b * b) / 2.5);
      acc += w * v;
      wsum += w;
    }
    return (0.85 * acc) / wsum;
  }),
);

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** A check or a cross with its text, centered on the stage. */
function centered(s: Scene, ok: boolean, text: string, y: number, size = 3.4) {
  const w = s.measure(text, { size }) + size * 1.4 * s.u;
  verdict(s, ok, text, s.w / 2 - w / 2, y, size);
}

/** The digit's pixels as a grid of squares `px` stage units wide, centered on (cx, cy). */
const digit = (s: Scene, cx: number, cy: number, px: number, img: number[][] = DIGIT) => shades(s, cx, cy, px, img, '--ink', { lo: 0, hi: 1 });

/** Where the pipeline's parts sit, as fractions of the stage width. */
const PIPE = { inp: 0.14, e0: 0.27, code: 0.5, d1: 0.73, out: 0.86 };
/** Heights in stage units: a full layer, and the 16-number code. */
const FULL = 36;
const CODE = 5;
/** The narrow ends of the encoder and decoder: as tall as the 16 code cells. */
const NECK = 18;
const SMALL = 0.7;

const lab = { size: 3.3, font: 'mono', weight: 650, halo: true } as const;

// ---- the problem: 784 numbers for two strokes; ask for a copy, then squeeze the middle

const squeeze: SceneDef = {
  draw(s) {
    const u = s.u;
    const X = (f: number) => s.w * f;
    const y = s.h * 0.42;
    // The digit starts large in the middle, then moves left to become the network's input.
    const mv = s.ease('copy', 1.1);
    const big = s.tall ? 1.25 : 1.15;
    const px = lerp(big, SMALL, mv);
    const cx = lerp(s.w / 2, X(PIPE.inp), mv);
    const cy = lerp(s.h * 0.38, y, mv);
    digit(s, cx, cy, px);
    const half = 14 * px * u;
    s.text(mv < 0.5 ? 'x: 784 numbers' : 'x: 784', cx, cy + half + 4 * u, { ...lab, color: s.c('orange') });

    // The two strokes that pin down most of the pixels.
    s.alpha(s.win('strokes', 'copy'), () => {
      const P = PEN.map(([j, i]) => [cx - half + (j + 0.5) * px * u, cy - half + (i + 0.5) * px * u] as const);
      for (let k = 1; k < P.length; k++) s.line(P[k - 1]![0], P[k - 1]![1], P[k]![0], P[k]![1], s.c('orange'), 0.6);
      for (const [a, b] of P) s.circle(a, b, 0.9 * u, { fill: s.c('orange') });
    });
    const cap = s.h * 0.8;
    s.alpha(s.win('strokes', 'goal'), () => caption(s, 'two strokes: where, slant, thickness', cap, '--ink-2', 3.4));

    // No labels: nobody writes "7" on the image.
    s.alpha(s.win('goal', 'copy'), () => {
      const tx = cx + half + 3 * u;
      const ty = cy - half + 4 * u;
      const t = 'label: 7';
      const w = s.measure(t, { size: 3.3, font: 'mono' });
      s.text(t, tx, ty, { size: 3.3, font: 'mono', align: 'left', color: s.c('--ink-2') });
      s.alpha(after(s, 'goal', 0.55), () => s.line(tx - 1 * u, ty, tx + w + 1 * u, ty, s.c('red'), 0.45));
      caption(s, 'from images alone: no labels', cap, '--ink-2', 3.4);
    });

    // The network between the input and its copy: a band whose middle narrows.
    const band = s.ease('copy', 0.8, 0.7);
    const sq = s.ease('narrow', 2.2, 0.4);
    const mid = lerp(FULL, CODE, sq);
    const x0 = X(PIPE.e0);
    const x1 = X(PIPE.d1);
    const xm = X(PIPE.code);
    s.alpha(band, () => {
      const g = s.ctx;
      g.beginPath();
      g.moveTo(x0, y - (FULL / 2) * u);
      g.lineTo(xm, y - (mid / 2) * u);
      g.lineTo(x1, y - (FULL / 2) * u);
      g.lineTo(x1, y + (FULL / 2) * u);
      g.lineTo(xm, y + (mid / 2) * u);
      g.lineTo(x0, y + (FULL / 2) * u);
      g.closePath();
      g.fillStyle = s.tint('slate', 0.12);
      g.fill();
      g.strokeStyle = s.tint('slate', 0.7);
      g.lineWidth = 0.35 * u;
      g.stroke();
      const neck = s.ease('neck', 0.6);
      s.rrect(xm - 2.2 * u, y - (mid / 2) * u, 4.4 * u, mid * u, 0.5, { fill: s.tint('green', 0.3 + 0.4 * neck), stroke: s.c('green'), lw: 0.25 + 0.2 * neck });
      s.arrow(cx + 14 * SMALL * u + 1.5 * u, y, x0 - 1.2 * u, y, s.c('--ink-3'), 0.3, 1.8);
      s.arrow(x1 + 1.2 * u, y, X(PIPE.out) - 14 * SMALL * u - 1.5 * u, y, s.c('--ink-3'), 0.3, 1.8);
      s.alpha(1 - s.ease('wide', 0.5), () => s.text('network', (x0 + xm) / 2, y, { ...lab, color: s.c('slate') }));
      const n = Math.round(lerp(784, 16, sq));
      s.alpha(s.ease('wide', 0.6), () => s.text(`middle: ${n}`, xm, y - (FULL / 2 + 4) * u, { ...lab, color: s.c('green') }));
      s.alpha(s.ease('neck', 0.6, 0.3), () => s.text('the bottleneck', xm, y + (FULL / 2 + 4.5) * u, { ...lab, color: s.c('green') }));
      // The copy: exact while the middle is wide, blurred once it is squeezed.
      s.alpha(1 - sq, () => digit(s, X(PIPE.out), y, SMALL));
      s.alpha(sq, () => digit(s, X(PIPE.out), y, SMALL, REBUILT));
      s.text('out: 784', X(PIPE.out), y + 14 * SMALL * u + 4 * u, { ...lab, color: s.c('purple') });
    });
    s.alpha(s.win('copy', 'wide'), () => caption(s, 'aim: out = x', cap, '--ink-2', 3.6));
    s.alpha(s.win('wide', 'narrow'), () => centered(s, false, 'a perfect copy: nothing learned', cap));
    s.alpha(s.ease('narrow', 0.6, 2.4), () => centered(s, true, '16 numbers: keep what matters', cap));
  },
};

// ---- the two halves, named, with their sizes and weight shapes

const halves: SceneDef = {
  draw(s) {
    const u = s.u;
    const X = (f: number) => s.w * f;
    const y = s.h * 0.38;
    const e1 = X(0.43);
    const d0 = X(0.57);
    digit(s, X(PIPE.inp), y, SMALL);
    s.text('x: 784', X(PIPE.inp), y + 14 * SMALL * u + 4 * u, { ...lab, color: s.c('orange') });
    const encOn = s.win('enc', 'z') + s.win('shape', 'mirror');
    funnel(s, X(PIPE.e0), e1, y, FULL, NECK, 'blue', 'encoder', Math.min(1, encOn + s.win('name', 'ratio')));
    s.alpha(s.ease('enc', 0.6, 1.5), () => s.text('784 → 256 → 16', (X(PIPE.e0) + e1) / 2, y - (FULL / 2 + 4) * u, { ...lab, size: 3, color: s.c('blue') }));
    // The code: 16 numbers.
    const zOn = s.win('z', 'dec') + s.win('ratio', 'shape') + s.win('hinton');
    const ys = Array.from({ length: 16 }, (_, k) => y + (k - 7.5) * 1.05 * u);
    for (const yy of ys) s.rrect(X(PIPE.code) - 2 * u, yy - 0.42 * u, 4 * u, 0.84 * u, 0.2, { fill: s.tint('green', 0.35 + 0.5 * Math.min(1, zOn)), stroke: s.c('green'), lw: 0.15 });
    s.alpha(s.ease('z', 0.6), () => s.text('z: 16', X(PIPE.code), y + 13 * u, { ...lab, color: s.c('green') }));
    const decOn = s.win('dec', 'name') + s.win('mirror', 'deep');
    funnel(s, d0, X(PIPE.d1), y, NECK, FULL, 'purple', 'decoder', Math.min(1, decOn + s.win('name', 'ratio')));
    s.alpha(s.ease('dec', 0.6, 1.5), () => s.text('16 → 256 → 784', (d0 + X(PIPE.d1)) / 2, y - (FULL / 2 + 4) * u, { ...lab, size: 3, color: s.c('purple') }));
    digit(s, X(PIPE.out), y, SMALL, REBUILT);
    s.text(s.since('dec') > 2 ? 'x̂: 784' : 'out: 784', X(PIPE.out), y + 14 * SMALL * u + 4 * u, { ...lab, color: s.c('purple') });

    // The weight shapes, under each half: (outputs, inputs).
    const wy = y + (FULL / 2 + 7) * u;
    const shp = { size: 3.1, font: 'mono' } as const;
    const ex = (X(PIPE.e0) + e1) / 2;
    const dx = (d0 + X(PIPE.d1)) / 2;
    const sh = s.ease('shape', 0.6, 2);
    const mi = s.ease('mirror', 0.6, 1);
    const fadeW = 1 - s.ease('deep', 0.6);
    s.alpha(sh * fadeW, () => {
      s.text('W₁ (256, 784)', ex, wy, { ...shp, weight: 650, color: s.c('blue') });
      s.alpha(mi, () => s.text('W₂ (16, 256)', ex, wy + 4.5 * u, { ...shp, color: s.c('--ink-2') }));
    });
    s.alpha(mi * fadeW, () => {
      s.text('W₃ (256, 16)', dx, wy, { ...shp, color: s.c('--ink-2') });
      s.alpha(after(s, 'mirror', 0.35), () => s.text('W₄ (784, 256)', dx, wy + 4.5 * u, { ...shp, weight: 650, color: s.c('purple') }));
    });

    const c1 = s.h * 0.82;
    const c2 = s.h * 0.9;
    s.alpha(s.win('name', 'ratio'), () => rich(s, [['auto', 'green'], ['encoder: encodes its own input', '--ink-2']], s.w / 2, c1, { size: 3.4, halo: true }));
    s.alpha(s.win('ratio', 'shape'), () => {
      caption(s, '784 / 16 = 49', c1, 'green', 3.8);
      caption(s, 'input numbers per code number', c2, '--ink-2', 3.2);
    });
    s.alpha(s.win('shape', 'deep'), () => caption(s, 'each W: (outputs, inputs)', c1 + 2 * u, '--ink-2', 3.4));
    s.alpha(s.win('deep', 'hinton'), () => caption(s, 'deep: little gradient reached the first layers', c1, '--ink-2', 3.1));
    s.alpha(s.ease('hinton', 0.6), () => {
      caption(s, 'a better start: 784 pixels → 30 numbers', c1, '--ink-2', 3.1);
      cite(s, 'Hinton & Salakhutdinov, Science, 2006', 1);
    });
  },
};

// ---- the loss: the squared error between x and its rebuild

const X3 = [1, 0, 2];
const XH = [0.5, 0, 3];
const D = X3.map((v, i) => v - XH[i]!);
const SQ = D.map((v) => v * v);

const loss: SceneDef = {
  marks: {
    L: { tex: String.raw`\symL = \lVert \symx - \hat{\symx} \rVert^{2}`, x: 0.5, y: 0.13, size: 5 },
  },
  draw(s) {
    const u = s.u;
    const cap = s.h * 0.88;

    // Before the numbers: the digit and its rebuild, side by side.
    s.alpha(1 - s.ease('diff', 0.6), () => {
      const y = s.h * 0.34;
      const xs = [s.w / 2 - 22 * u, s.w / 2 + 22 * u];
      digit(s, xs[0]!, y, 0.85);
      digit(s, xs[1]!, y, 0.85, REBUILT);
      s.text('x', xs[0]!, y + 16.5 * u, { ...lab, size: 3.8, color: s.c('orange') });
      s.text('x̂', xs[1]!, y + 16.5 * u, { ...lab, size: 3.8, color: s.c('purple') });
      s.text('vs', s.w / 2, y, { size: 3.4, font: 'mono', color: s.c('--ink-3') });
      s.alpha(s.win('loss', 'target'), () => caption(s, 'L: how far x̂ lands from x', s.h * 0.66, 'red', 3.5));
      s.alpha(s.ease('target', 0.6), () => caption(s, 'the target is x itself: no labels', s.h * 0.66, 'green', 3.5));
    });

    // The worked example, row by row.
    const tab = s.ease('diff', 0.6) * (1 - s.ease('norm', 0.6));
    s.alpha(tab, () => {
      const xs = columns(s, 3, 16);
      const lx = xs[0]! - 11.5 * u;
      const ys = [0.17, 0.3, 0.43, 0.56].map((f) => s.h * f);
      rowLabel(s, 'x', lx, ys[0]!, 'orange', 3.8);
      cells(s, xs, ys[0]!, X3.map((v) => fmt(v)), 'orange', { w: 12, h: 8 });
      s.alpha(after(s, 'diff', 0.3), () => {
        rowLabel(s, 'x̂', lx, ys[1]!, 'purple', 3.8);
        cells(s, xs, ys[1]!, XH.map((v) => fmt(v)), 'purple', { w: 12, h: 8 });
      });
      s.alpha(after(s, 'diff', 0.65), () => {
        rowLabel(s, 'x − x̂', lx, ys[2]!, '--ink-2', 3.4);
        cells(s, xs, ys[2]!, D.map((v) => fmt(v)), 'slate', { w: 12, h: 8 });
      });
      s.alpha(s.ease('square', 0.6), () => {
        rowLabel(s, 'squared', lx, ys[3]!, 'red', 3.4);
        cells(s, xs, ys[3]!, SQ.map((v) => fmt(v)), 'red', { w: 12, h: 8, on: [1, 1, 1].map(() => s.ease('square', 0.6, 1.5)) });
      });
      s.alpha(after(s, 'square', 0.4), () => rich(s, [['0.25 + 0 + 1 = ', '--ink-2'], ['1.25', 'red']], s.w / 2, s.h * 0.69, { size: 3.8, weight: 650, halo: true }));
      s.alpha(after(s, 'square', 0.8), () => caption(s, 'the squared error', s.h * 0.77, 'red', 3.4));
    });

    // The norm: the difference as an arrow, whose squared size is that same sum.
    const nm = s.ease('norm', 0.7, 0.3);
    s.show('L', nm);
    s.alpha(nm, () => {
      const k = Math.min(32 * u, s.h * 0.34);
      const ox = s.w / 2 - k * 0.25;
      const oy = s.h * 0.27;
      const tx = ox + 0.5 * k;
      const ty = oy + k;
      s.circle(ox, oy, 0.8 * u, { fill: s.c('--ink-3') });
      s.line(ox, oy, tx, oy, s.tint('--ink-3', 0.9), 0.3, [1, 0.8]);
      s.line(tx, oy, tx, ty, s.tint('--ink-3', 0.9), 0.3, [1, 0.8]);
      s.text('0.5', (ox + tx) / 2, oy - 3 * u, { size: 3.2, font: 'mono', color: s.c('--ink-2') });
      s.text('−1', tx + 2 * u, (oy + ty) / 2, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-2') });
      s.arrow(ox, oy, tx, ty, s.c('slate'), 0.5, 2.2);
      s.text('x − x̂', (ox + tx) / 2 - 2.5 * u, (oy + ty) / 2, { size: 3.3, font: 'mono', weight: 650, align: 'right', color: s.c('slate'), halo: true });
      s.alpha(after(s, 'norm', 0.55), () => {
        rich(s, [['size² = 0.5² + 0² + (−1)² = ', '--ink-2'], ['1.25', 'red']], s.w / 2, s.h * 0.74, { size: 3.4, weight: 600, halo: true });
      });
    });
    s.alpha(s.ease('train', 0.6), () => caption(s, 'every image is its own target', cap, 'green', 3.4));
  },
};

export const scenes: Record<string, SceneDef> = { squeeze, halves, loss };

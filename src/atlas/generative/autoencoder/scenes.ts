import type { Scene, SceneDef } from '../../../lecture/scene';
import { cells, columns, rowLabel, verdict } from '../../draw';
import { caption, fmt, funnel, rich, shades, stroke } from '../draw';

/** A handwritten 7, 28 by 28, and a blurrier rebuild of it. */
const DIGIT = stroke(28, [[7, 7], [21, 6.5], [13, 23]], 1.1);
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

/** Where the pipeline's parts sit, as fractions of the stage width. */
const PIPE = { inp: 0.14, e0: 0.25, e1: 0.43, code: 0.5, d0: 0.57, d1: 0.75, out: 0.86 };

const squeeze: SceneDef = {
  draw(s) {
    const u = s.u;
    const y = s.h * 0.4;
    const X = (f: number) => s.w * f;
    const px = 0.7;
    shades(s, X(PIPE.inp), y, px, DIGIT, '--ink', { lo: 0, hi: 1 });
    const lab = { size: 3.4, font: 'mono', weight: 650, halo: true } as const;
    s.text('x: 784', X(PIPE.inp), y + 15 * u, { ...lab, color: s.c('orange') });
    const enc = s.ease('encode', 0.8);
    s.alpha(enc, () => {
      funnel(s, X(PIPE.e0), X(PIPE.e1), y, 52, 36, 'blue', 'encoder', s.win('encode', 'decode'));
      s.text('784 → 256 → 16', (X(PIPE.e0) + X(PIPE.e1)) / 2, y - 31 * u, { ...lab, size: 3, color: s.c('blue') });
    });
    const codeA = s.ease('encode', 0.6, 2.5);
    s.alpha(codeA, () => {
      const ys = Array.from({ length: 16 }, (_, k) => y + (k - 7.5) * 2.2 * u);
      for (const yy of ys) s.rrect(X(PIPE.code) - 2.4 * u, yy - 0.9 * u, 4.8 * u, 1.8 * u, 0.4, { fill: s.tint('green', 0.35 + 0.5 * s.win('ratio')), stroke: s.c('green'), lw: 0.2 });
      s.text('z: 16', X(PIPE.code), y + 22 * u, { ...lab, color: s.c('green') });
    });
    const dec = s.ease('decode', 0.8);
    s.alpha(dec, () => {
      funnel(s, X(PIPE.d0), X(PIPE.d1), y, 36, 52, 'purple', 'decoder', s.win('decode', 'ratio'));
      s.text('16 → 256 → 784', (X(PIPE.d0) + X(PIPE.d1)) / 2, y - 31 * u, { ...lab, size: 3, color: s.c('purple') });
    });
    s.alpha(s.ease('decode', 0.6, 2), () => {
      shades(s, X(PIPE.out), y, px, REBUILT, '--ink', { lo: 0, hi: 1 });
      s.text('x̂: 784', X(PIPE.out), y + 15 * u, { ...lab, color: s.c('purple') });
    });
    s.alpha(s.ease('ratio', 0.6), () => {
      caption(s, 'the bottleneck: 16 numbers', s.h * 0.8, 'green', 3.6);
      caption(s, '784 / 16 = 49 inputs per code number', s.h * 0.89, '--ink-2', 3.4);
    });
  },
};

const X3 = [1, 0, 2];
const XH = [0.5, 0, 3];
const D = X3.map((v, i) => v - XH[i]!);
const SQ = D.map((v) => v * v);

const loss: SceneDef = {
  marks: {
    L: { tex: String.raw`\symL = \lVert \symx - \hat{\symx} \rVert^{2}`, x: 0.5, y: 0.1, size: 5 },
  },
  draw(s) {
    const u = s.u;
    const xs = columns(s, 3, 17);
    const lx = xs[0]! - 12 * u;
    const ys = [0.26, 0.4, 0.56, 0.72].map((f) => s.h * f);
    s.show('L', s.ease('target', 0.6));
    rowLabel(s, 'x', lx, ys[0]!, 'orange', 3.8);
    cells(s, xs, ys[0]!, X3.map((v) => fmt(v)), 'orange', { w: 13, h: 8.5 });
    rowLabel(s, 'x̂', lx, ys[1]!, 'purple', 3.8);
    cells(s, xs, ys[1]!, XH.map((v) => fmt(v)), 'purple', { w: 13, h: 8.5 });
    s.alpha(s.ease('target', 0.6, 1), () => caption(s, 'the target is the input itself', s.h * 0.17, '--ink-3', 3.2));
    s.alpha(s.ease('diff', 0.6, 1.2), () => {
      rowLabel(s, 'x − x̂', lx, ys[2]!, '--ink-2', 3.6);
      cells(s, xs, ys[2]!, D.map((v) => fmt(v)), 'slate', { w: 13, h: 8.5 });
    });
    s.alpha(s.ease('square', 0.6), () => {
      rowLabel(s, 'squared', lx, ys[3]!, 'red', 3.6);
      cells(s, xs, ys[3]!, SQ.map((v) => fmt(v)), 'red', { w: 13, h: 8.5, on: [1, 1, 1].map(() => s.ease('square', 0.6, 1.5)) });
    });
    s.alpha(s.ease('square', 0.6, 2), () => rich(s, [['0.25 + 0 + 1 = ', '--ink-2'], ['1.25', 'red']], s.w / 2, s.h * 0.86, { size: 3.8, weight: 650, halo: true }));
    s.alpha(s.ease('train', 0.6), () => caption(s, 'no labels: every image is its own target', s.h * 0.94, 'green', 3.3));
  },
};

/** A pipeline in miniature: input, middle and output bars, `mid` stage units tall in the middle. */
function mini(s: Scene, cx: number, cy: number, mid: number, k: 'red' | 'green'): void {
  const u = s.u;
  const bar = (x: number, h: number, ink: 'orange' | 'green' | 'red' | 'purple') => s.rrect(x - 1.6 * u, cy - (h * u) / 2, 3.2 * u, h * u, 0.5, { fill: s.tint(ink, 0.35), stroke: s.c(ink), lw: 0.25 });
  bar(cx - 16 * u, 20, 'orange');
  bar(cx, mid, k);
  bar(cx + 16 * u, 20, 'purple');
  for (const sign of [-1, 1]) {
    const x0 = cx + sign * 14 * u;
    const x1 = cx + sign * 2 * u;
    s.line(x0, cy - 10 * u, x1, cy - (mid / 2) * u, s.tint(k, 0.6), 0.3);
    s.line(x0, cy + 10 * u, x1, cy + (mid / 2) * u, s.tint(k, 0.6), 0.3);
  }
}

const why: SceneDef = {
  draw(s) {
    const u = s.u;
    const shA = 1 - 0.65 * s.ease('wide', 0.6);
    s.alpha(shA, () => {
      const cx = [s.w / 2 - 22 * u, s.w / 2 + 22 * u];
      const o = { size: 3.4, font: 'mono', weight: 650 } as const;
      s.text('encoder', cx[0]!, s.h * 0.08, { ...o, color: s.c('blue') });
      s.text('decoder', cx[1]!, s.h * 0.08, { ...o, color: s.c('purple') });
      const rows: [string, string, number][] = [
        ['W1: (256, 784)', 'W3: (256, 16)', 0.17],
        ['W2: (16, 256)', 'W4: (784, 256)', 0.27],
      ];
      rows.forEach(([a, b, f], i) => {
        const on = s.ease('shapes', 0.6, 1 + i * 1.5);
        s.alpha(on, () => {
          s.text(a, cx[0]!, s.h * f, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
          s.text(b, cx[1]!, s.h * f, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
        });
      });
      s.alpha(s.ease('shapes', 0.6, 4), () => caption(s, 'each one: (outputs, inputs)', s.h * 0.36, '--ink-3', 3.2));
    });
    const left = s.w / 2 - 25 * u;
    const right = s.w / 2 + 25 * u;
    const cy = s.h * 0.62;
    s.alpha(s.ease('wide', 0.6), () => {
      mini(s, left, cy, 20, 'red');
      s.text('middle: 784', left, cy - 15 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('red') });
      verdict(s, false, 'copies x', left - 10 * u, cy + 16 * u, 3.4);
      s.text('loss 0, learns nothing', left, cy + 23 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
    });
    s.alpha(s.ease('narrow', 0.6), () => {
      mini(s, right, cy, 3, 'green');
      s.text('middle: 16', right, cy - 15 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('green') });
      verdict(s, true, 'summarizes', right - 10 * u, cy + 16 * u, 3.4);
      s.text('keeps what matters', right, cy + 23 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
    });
  },
};

export const scenes: Record<string, SceneDef> = { squeeze, loss, why };

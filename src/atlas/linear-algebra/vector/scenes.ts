import type { SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { cells, columns, rowLabel } from '../../draw';
import { brace, ghost } from '../draw';

const X = [3, -1, 4, 2];

const list: SceneDef = {
  marks: {
    r4: { tex: String.raw`\symx \in \mathbb{R}^{4}`, x: 0.5, y: 0.62, size: 5.6 },
  },
  draw(s) {
    const xs = columns(s, 4, 16);
    const y = s.h * 0.26;
    rowLabel(s, 'x', xs[0]! - 11 * s.u, y, 'orange');
    cells(s, xs, y, X.map(String), 'orange', { on: [s.win('index', 'last'), 0, 0, s.ease('last', 0.6)] });
    s.alpha(s.ease('index', 0.6), () => xs.forEach((x, i) => s.text(`[${i}]`, x, y + 8.5 * s.u, { size: 3.2, font: 'mono', color: s.c('--ink-3') })));
    s.alpha(s.ease('dim', 0.6), () => brace(s, 'bottom', xs[0]! - 7 * s.u, xs[3]! + 7 * s.u, y + 13 * s.u, '4 entries', 'orange'));
    s.show('r4', s.ease('dim', 0.6, 1.2));
    s.alpha(s.ease('index', 0.6, 0.4), () => s.text('x[0] = 3, the first', s.w / 2, s.h * 0.76, { size: 3.8, font: 'mono', color: s.c('--ink-2') }));
    s.alpha(s.ease('last', 0.6), () => {
      s.text('x[3] = 2, the last', s.w / 2, s.h * 0.87, { size: 3.8, font: 'mono', color: s.c('--ink-2') });
      const gx = xs[3]! + 16 * s.u;
      ghost(s, gx, y, '?', 'red');
      s.text('[4] ✗', gx, y + 8.5 * s.u, { size: 3.2, font: 'mono', color: s.c('red') });
    });
  },
};

/** A tiny 4 by 4 image: a vertical gradient from blue sky to warm ground. */
const PIX = Array.from({ length: 16 }, (_, k) => {
  const i = Math.floor(k / 4);
  const j = k % 4;
  return [40 + 60 * i + 6 * j, 110 + 25 * j - 10 * i, 230 - 60 * i];
});
const RGB = ['red', 'green', 'blue'] as const;
const rgb = (p: number[]) => `rgb(${p[0]}, ${p[1]}, ${p[2]})`;

const image: SceneDef = {
  draw(s) {
    const P = 7 * s.u;
    const gl = s.w / 2 - 2 * P;
    const gt = s.h * 0.08;
    // The flattened strip: 48 bars, three per pixel.
    const bw = Math.min(2 * s.u, (s.w - 16 * s.u) / 48);
    const sl = s.w / 2 - 24 * bw;
    const base = s.h * 0.66;
    const bh = 14 * s.u;
    const g = s.ease('flat', 1.6);
    const bars = s.ease('flat', 0.6, 1.3);
    // The image stays behind, faint, as the numbers leave it.
    s.alpha(0.22 * g, () => PIX.forEach((p, k) => s.rrect(gl + (k % 4) * P + 0.15 * s.u, gt + Math.floor(k / 4) * P + 0.15 * s.u, P - 0.3 * s.u, P - 0.3 * s.u, 0.4, { fill: rgb(p) })));
    PIX.forEach((p, k) => {
      const i = Math.floor(k / 4);
      const j = k % 4;
      const gk = Math.min(1, Math.max(0, g * 1.4 - (k / 15) * 0.4));
      const x = lerp(gl + j * P, sl + k * 3 * bw, gk);
      const w = lerp(P, 3 * bw, gk);
      const h = lerp(P, bh * 0.6, gk);
      const y = lerp(gt + i * P, base - h, gk);
      s.alpha(1 - bars, () => s.rrect(x + 0.15 * s.u, y + 0.15 * s.u, w - 0.3 * s.u, h - 0.3 * s.u, 0.4, { fill: rgb(p) }));
    });
    s.alpha(bars, () => {
      s.line(sl - 2 * s.u, base, sl + 48 * bw + 2 * s.u, base, s.c('--axis'), 0.3);
      PIX.forEach((p, k) => p.forEach((v, c) => {
        const hh = (v / 255) * bh;
        s.rrect(sl + (3 * k + c) * bw + 0.1 * s.u, base - hh, bw - 0.2 * s.u, hh, 0.2, { fill: s.tint(RGB[c]!, 0.75) });
      }));
      s.text('x: 48 entries', sl, base - bh - 4 * s.u, { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c('orange') });
    });
    // One pixel, opened up into its three numbers.
    s.alpha(s.win('rgb', 'flat', 0.5), () => {
      const p = PIX[3]!;
      s.rrect(gl + 3 * P, gt, P, P, 0.4, { stroke: s.c('--ink'), lw: 0.5 });
      const cx = gl + 4 * P + 14 * s.u;
      s.arrow(gl + 4 * P + 0.8 * s.u, gt + 0.5 * P, cx - 7 * s.u, gt + 1.6 * P, s.c('--ink-3'), 0.3, 2);
      p.forEach((v, c) => s.cell(cx - 6 * s.u, gt + (c + 0.6) * P - 3.2 * s.u, 12 * s.u, 6.4 * s.u, String(v), RGB[c]!, { on: 0.5, size: 3.2 }));
    });
    s.alpha(s.ease('flat', 0.6, 1.6), () => s.text('4 × 4 × 3 = 48 numbers', s.w / 2, s.h * 0.78, { size: 3.8, font: 'mono', color: s.c('--ink-2') }));
    s.alpha(s.ease('big', 0.6), () => s.text('32 × 32 × 3 = 3,072 numbers', s.w / 2, s.h * 0.89, { size: 3.8, font: 'mono', weight: 600, color: s.c('orange') }));
  },
};

const U = [1, 2, 0];
const V = [3, -1, 2];

const ops: SceneDef = {
  draw(s) {
    const xs = columns(s, 3, 16);
    const lx = xs[0]! - 10 * s.u;
    const [yu, yv, ys, y2] = [0.14, 0.31, 0.53, 0.8].map((f) => s.h * f);
    const bad = s.ease('same', 0.6);
    rowLabel(s, 'u', lx, yu, '--ink-2');
    cells(s, xs, yu, U.map(String), '--ink-2');
    rowLabel(s, 'v', lx, yv, '--ink-2');
    cells(s, xs, yv, V.map(String), '--ink-2');
    s.text('+', lx - 8 * s.u, yv, { size: 4.2, font: 'mono', color: s.c('--ink-3') });
    s.line(xs[0]! - 8 * s.u, s.h * 0.42, xs[2]! + 8 * s.u, s.h * 0.42, s.c('--ink-3'), 0.3);
    const a = s.ease('add', 0.8, 0.6);
    s.alpha(a, () => {
      rowLabel(s, 'u + v', lx, ys, 'gold');
      cells(s, xs, ys, U.map((x, i) => String(x + V[i]!)), 'gold', { on: [0, 1, 2].map(() => s.win('add', 'scale')) });
    });
    s.alpha(s.ease('scale', 0.6), () => {
      rowLabel(s, '2u', lx, y2, 'teal');
      cells(s, xs, y2, U.map((x) => String(2 * x)), 'teal', { on: [0, 1, 2].map(() => s.win('scale', 'same')) });
    });
    s.alpha(bad, () => {
      const x4 = xs[2]! + 16 * s.u;
      ghost(s, x4, yu, '?', 'red');
      s.cell(x4 - 6 * s.u, yv - 4.25 * s.u, 12 * s.u, 8.5 * s.u, '4', 'red', { on: 0.6 });
      s.text('✗', x4, ys, { size: 5, font: 'ui', weight: 700, color: s.c('red') });
    });
  },
};

export const scenes: Record<string, SceneDef> = { list, image, ops };

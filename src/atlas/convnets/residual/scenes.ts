import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { cells } from '../../draw';
import { type Ink, fmt } from '../draw';

/** The block diagram: x, the box F, the sum and y on one row, with the shortcut arching above. */
function diagram(s: Scene, o: { yD: number; cut: number; dim?: number; red?: { cut: number; box: number } }) {
  const xN = s.w * 0.1;
  const b0 = s.w * 0.26;
  const b1 = s.w * 0.56;
  const pN = s.w * 0.7;
  const yN = s.w * 0.87;
  const r = 4 * s.u;
  const top = o.yD - 15 * s.u;
  const ink = s.c('--ink-3');
  s.alpha(1 - (o.dim ?? 0) * 0.5, () => {
    s.circle(xN, o.yD, r, { fill: s.tint('orange', 0.2), stroke: s.c('orange'), lw: 0.4 });
    s.text('x', xN, o.yD, { size: 4.2, font: 'mono', weight: 650, color: s.c('orange') });
    s.arrow(xN + r, o.yD, b0 - 0.6 * s.u, o.yD, ink, 0.35, 2);
    s.rrect(b0, o.yD - 7 * s.u, b1 - b0, 14 * s.u, 1.6, { fill: s.tint('blue', 0.12), stroke: s.c('blue'), lw: 0.4 });
    s.text('F(x)', (b0 + b1) / 2, o.yD - 1.8 * s.u, { size: 4.2, font: 'mono', weight: 650, color: s.c('blue') });
    s.text('conv, ReLU, conv', (b0 + b1) / 2, o.yD + 3.6 * s.u, { size: 2.6, font: 'mono', color: s.c('--ink-2') });
    s.alpha(1 - o.cut, () => s.arrow(b1, o.yD, yN - r, o.yD, ink, 0.35, 2));
    s.alpha(o.cut, () => {
      s.arrow(b1, o.yD, pN - r, o.yD, ink, 0.35, 2);
      s.arrow(pN + r, o.yD, yN - r, o.yD, ink, 0.35, 2);
      s.line(xN, o.yD - r, xN, top, s.c('orange'), 0.4);
      s.line(xN, top, pN, top, s.c('orange'), 0.4);
      s.arrow(pN, top, pN, o.yD - r, s.c('orange'), 0.4, 2);
      s.text('shortcut', (xN + pN) / 2, top - 3 * s.u, { size: 3, font: 'mono', color: s.c('orange') });
      s.circle(pN, o.yD, r, { fill: s.tint('--ink', 0.06), stroke: s.c('--ink-2'), lw: 0.4 });
      s.text('+', pN, o.yD, { size: 5, font: 'mono', weight: 650, color: s.c('--ink') });
    });
    s.circle(yN, o.yD, r, { fill: s.tint('green', 0.2), stroke: s.c('green'), lw: 0.4 });
    s.text('y', yN, o.yD, { size: 4.2, font: 'mono', weight: 650, color: s.c('green') });
  });
  if (o.red) {
    const red = s.c('red');
    s.alpha(o.red.cut, () => {
      s.line(pN - 1.4 * s.u, o.yD - r, pN - 1.4 * s.u, top + 1.4 * s.u, red, 0.5);
      s.line(pN - 1.4 * s.u, top + 1.4 * s.u, xN + 1.4 * s.u, top + 1.4 * s.u, red, 0.5);
      s.arrow(xN + 1.4 * s.u, top + 1.4 * s.u, xN + 1.4 * s.u, o.yD - r, red, 0.5, 2);
    });
    s.alpha(o.red.box, () => s.arrow(pN - r, o.yD + 9 * s.u, xN + r, o.yD + 9 * s.u, s.tint('red', 0.8), 0.5, 2));
  }
  return { xN, b0, b1, pN, yN, top, r };
}

const X = [2, -1, 3];
const FX = [0.5, 0.5, -1];
const Y = X.map((v, i) => v + FX[i]!);

/** A labelled column of three cells. */
function column(s: Scene, x: number, y: number, label: string, vals: string[], k: Ink, on = 0) {
  s.text(label, x, y - 13 * s.u, { size: 3.6, font: 'mono', weight: 650, color: s.c(k) });
  [0, 1, 2].forEach((i) => cells(s, [x], y - 6.8 * s.u + i * 6.8 * s.u, [vals[i]!], k, { w: 11, h: 6, size: 3.2, on: [on] }));
}

const block: SceneDef = {
  draw(s) {
    const yD = s.h * 0.34;
    diagram(s, { yD, cut: s.ease('add', 0.8, 1.6) });
    const ex = s.ease('example', 0.6) * (1 - s.ease('match', 0.6));
    const zero = s.ease('zero', 0.8, 0.6);
    s.alpha(ex, () => {
      const y = s.h * 0.74;
      const [c1, c2, c3] = [0.18, 0.47, 0.8].map((f) => s.w * f);
      column(s, c1!, y, 'x', X.map(fmt), 'orange');
      s.text('+', (c1! + c2!) / 2, y, { size: 5, font: 'mono', color: s.c('--ink-2') });
      s.alpha(1 - zero, () => column(s, c2!, y, 'F(x)', FX.map(fmt), 'blue'));
      s.alpha(zero, () => column(s, c2!, y, 'F(x)', ['0', '0', '0'], 'blue', 1));
      s.text('=', (c2! + c3!) / 2, y, { size: 5, font: 'mono', color: s.c('--ink-2') });
      s.alpha(1 - zero, () => column(s, c3!, y, 'y', Y.map(fmt), 'green', s.ease('example', 0.6, 3)));
      s.alpha(zero, () => column(s, c3!, y, 'y = x', X.map(fmt), 'green', 1));
    });
    s.alpha(s.ease('match', 0.6, 0.4), () => {
      const o = { size: 3.4, font: 'mono', weight: 600 } as const;
      const y = s.h * 0.62;
      s.text('x: (64, 56, 56)', s.w / 2, y, { ...o, color: s.c('orange') });
      s.text('F(x): (128, 28, 28)   ✗ cannot add', s.w / 2, y + 6.5 * s.u, { ...o, color: s.c('red') });
      s.alpha(s.ease('match', 0.6, 3.5), () => {
        s.text('shortcut: 1 × 1 conv, 128 filters, stride 2', s.w / 2, y + 15 * s.u, { ...o, size: 3.1, color: s.c('--ink-2') });
        s.text('(64, 56, 56) to (128, 28, 28)   ✓', s.w / 2, y + 21.5 * s.u, { ...o, color: s.c('green') });
      });
    });
  },
};

const gradient: SceneDef = {
  draw(s) {
    const yD = s.h * 0.3;
    const split = s.ease('split', 0.6, 0.6);
    const d = diagram(s, { yD, cut: 1, dim: 1, red: { cut: split, box: split } });
    const red = (t: string, x: number, y: number, size = 3.3) => s.text(t, x, y, { size, font: 'mono', weight: 650, color: s.c('red'), halo: true });
    s.alpha(s.ease('split', 0.6), () => red('g = 2', d.yN, yD - 7.5 * s.u));
    s.alpha(s.ease('paths', 0.6, 0.3), () => red('g = 2', (d.xN + d.pN) / 2, d.top + 5 * s.u));
    s.alpha(s.ease('paths', 0.6, 2.4), () => red('g · F′ = 2 × 0.5 = 1', (d.b0 + d.b1) / 2, yD + 13.5 * s.u, 3.1));
    s.alpha(s.ease('formula', 0.6, 0.4), () => {
      red('2 + 1 = 3', d.xN + 6 * s.u, yD + 21 * s.u);
      s.text('g (1 + F′)', s.w / 2, yD + 21 * s.u, { size: 3.6, font: 'mono', weight: 650, color: s.c('--ink-2') });
    });
    const deep = s.ease('deep', 0.6);
    s.alpha(deep, () => {
      const n = 10;
      const x0 = s.w * 0.3;
      const pitch = (s.w * 0.62) / n;
      const rows: [string, (k: number) => number, Ink, number][] = [
        ['plain', (k) => 0.5 ** k, 'red', s.h * 0.72],
        ['residual', (k) => 1 - 0.01 * k, 'green', s.h * 0.92],
      ];
      rows.forEach(([name, f, k, base], r) => {
        const a = r === 0 ? s.ease('deep', 0.6, 0.6) : s.ease('deep', 0.6, 4.5);
        s.alpha(a, () => {
          s.text(name, x0 - 3 * s.u, base - 3 * s.u, { size: 3.2, font: 'mono', weight: 600, align: 'right', color: s.c(k) });
          for (let i = 0; i < n; i++) {
            const h = Math.max(0.3, 11 * f(i)) * s.u * lerp(0, 1, a);
            s.rrect(x0 + i * pitch, base - h, pitch * 0.62, h, 0.4, { fill: s.tint(k, 0.5), stroke: s.c(k), lw: 0.2 });
          }
        });
      });
    });
  },
};

export const scenes: Record<string, SceneDef> = { block, gradient };

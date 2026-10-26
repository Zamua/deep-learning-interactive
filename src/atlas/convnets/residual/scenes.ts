import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { cells } from '../../draw';
import { after } from '../../networks/draw';
import { type Ink, fmt, rich } from '../draw';

/** The block diagram: x, the box F, the sum and y on one row, with the shortcut arching above. */
function diagram(s: Scene, o: { yD: number; cut: number; dim?: number; red?: { cut: number; box: number }; proj?: number }) {
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
      const lab = { size: 3, font: 'mono', color: s.c('orange') } as const;
      s.alpha(1 - (o.proj ?? 0), () => s.text('shortcut', (xN + pN) / 2, top - 3 * s.u, lab));
      s.alpha(o.proj ?? 0, () => s.text('shortcut: 1 × 1 conv', (xN + pN) / 2, top - 3 * s.u, { ...lab, weight: 650 }));
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
    const ex = s.ease('example', 0.6);
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
  },
};

/** One line of working under the diagram, `row` lines down. */
function work(s: Scene, y0: number, row: number, runs: [string, Ink][], a: number): void {
  s.alpha(a, () => rich(s, runs, s.w / 2, y0 + row * 6.6 * s.u, { size: 3.2, weight: 600 }));
}

const match: SceneDef = {
  draw(s) {
    const yD = s.h * 0.27;
    diagram(s, { yD, cut: 1, proj: s.ease('cut', 0.6, 0.3) });
    const y0 = yD + 16 * s.u;
    const k2 = '--ink-2';
    const k3 = '--ink-3';
    // Earlier lines dim once the shortcut's own working starts.
    const fPath = 1 - 0.45 * s.ease('cut', 0.6);
    work(s, y0, 0, [['x: ', k2], ['(64, 8, 8)', 'orange']], s.ease('need', 0.6, 0.6));
    work(s, y0, 1, [['64 filters, stride 1: F(x) is ', k2], ['(64, 8, 8)', 'blue']], after(s, 'keep', 0.2) * (1 - s.ease('first', 0.4)));
    work(s, y0, 2, [['shortcut = x', 'orange'], ['   ✓', 'green']], after(s, 'keep', 0.7) * (1 - s.ease('first', 0.4)));
    work(s, y0, 1, [['conv 1: ', k2], ['128', 'blue'], [' filters, stride ', k2], ['2', 'blue']], after(s, 'first', 0.1) * fPath);
    work(s, y0, 2, [['(8 − 3 + 2) / 2 + 1 = 4.5', k2], [', down to ', k3], ['4', 'blue']], after(s, 'round', 0.15) * fPath);
    work(s, y0, 3, [['conv 2: stride 1, padding 1, keeps ', k2], ['4 × 4', 'blue']], after(s, 'second', 0.1) * fPath);
    work(s, y0, 4, [['F(x): ', k2], ['(128, 4, 4)', 'blue'], ['   ✗ cannot add x', 'red']], after(s, 'second', 0.55));
    work(s, y0, 5, [['shortcut: 1 × 1 conv, ', k2], ['128', 'orange'], [' filters, stride ', k2], ['2', 'orange']], after(s, 'cut', 0.3));
    work(s, y0, 6, [['(8 − 1) / 2 + 1 = 4.5', k2], [', down to ', k3], ['4', 'orange']], after(s, 'check', 0.2));
    work(s, y0, 7, [['shortcut(x): ', k2], ['(128, 4, 4)', 'orange'], ['   ✓ adds to F(x)', 'green']], after(s, 'check', 0.65));
  },
};

/** Two blocks in a chain, x to h to y, with the gradient walked back through each factor. */
function stack(s: Scene, yS: number): void {
  const a = s.ease('stack', 0.6) * (1 - s.ease('deep', 0.5));
  if (a <= 0.003) return;
  const [xN, b1, hN, b2, yN] = [0.1, 0.3, 0.5, 0.7, 0.9].map((f) => s.w * f) as [number, number, number, number, number];
  const r = 3.5 * s.u;
  const bw = s.w * 0.2;
  const ink = s.c('--ink-3');
  const big = { size: 3.8, font: 'mono', weight: 650 } as const;
  s.alpha(a, () => {
    const node = (x: number, t: string, k: Ink) => {
      s.circle(x, yS, r, { fill: s.tint(k, 0.2), stroke: s.c(k), lw: 0.4 });
      s.text(t, x, yS, { ...big, color: s.c(k) });
    };
    const box = (x: number, t: string) => {
      s.rrect(x - bw / 2, yS - 5 * s.u, bw, 10 * s.u, 1.4, { fill: s.tint('blue', 0.12), stroke: s.c('blue'), lw: 0.4 });
      s.text(t, x, yS, { ...big, size: 3.1, color: s.c('blue') });
    };
    s.arrow(xN + r, yS, b1 - bw / 2 - 0.5 * s.u, yS, ink, 0.35, 2);
    s.arrow(b1 + bw / 2, yS, hN - r - 0.5 * s.u, yS, ink, 0.35, 2);
    s.arrow(hN + r, yS, b2 - bw / 2 - 0.5 * s.u, yS, ink, 0.35, 2);
    s.arrow(b2 + bw / 2, yS, yN - r - 0.5 * s.u, yS, ink, 0.35, 2);
    node(xN, 'x', 'orange');
    box(b1, 'x + F₁(x)');
    node(hN, 'h', 'purple');
    box(b2, 'h + F₂(h)');
    node(yN, 'y', 'green');
  });
  const yG = yS + 9 * s.u;
  const red = (t: string, x: number, v: number) => s.alpha(a * v, () => s.text(t, x, yG, { size: 3.3, font: 'mono', weight: 650, color: s.c('red'), halo: true }));
  red('g = 1', yN, after(s, 'back2', 0.15));
  red('× (1 + 1)', b2, after(s, 'back2', 0.5));
  red('2', hN, after(s, 'back2', 0.8));
  red('× (1 − 0.5)', b1, after(s, 'back1', 0.2));
  red('1', xN, after(s, 'back1', 0.45));
  s.alpha(a * after(s, 'back1', 0.7), () =>
    rich(s, [['g (1 + F₂′)(1 + F₁′) = 1 × 2 × 0.5 = ', '--ink-2'], ['1', 'red']], s.w / 2, yG + 8 * s.u, { size: 3.2, weight: 650 }),
  );
}

const gradient: SceneDef = {
  draw(s) {
    const yD = s.h * 0.3;
    const split = s.ease('split', 0.6, 0.6);
    // The one-block example steps back while two stacked blocks use other numbers.
    s.alpha(1 - 0.6 * s.ease('stack', 0.6), () => {
      const d = diagram(s, { yD, cut: 1, dim: 1, red: { cut: split, box: split } });
      const red = (t: string, x: number, y: number, size = 3.3) => s.text(t, x, y, { size, font: 'mono', weight: 650, color: s.c('red'), halo: true });
      s.alpha(s.ease('split', 0.6), () => red('g = 2', d.yN, yD - 7.5 * s.u));
      s.alpha(s.ease('paths', 0.6, 0.3), () => red('g = 2', (d.xN + d.pN) / 2, d.top + 5 * s.u));
      s.alpha(s.ease('paths', 0.6, 2.4), () => red('g · F′ = 2 × 0.5 = 1', (d.b0 + d.b1) / 2, yD + 13.5 * s.u, 3.1));
      s.alpha(s.ease('formula', 0.6, 0.4), () => {
        red('2 + 1 = 3', d.xN + 6 * s.u, yD + 21 * s.u);
        s.text('g (1 + F′)', s.w / 2, yD + 21 * s.u, { size: 3.6, font: 'mono', weight: 650, color: s.c('--ink-2') });
      });
    });
    stack(s, s.h * 0.67);
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

export const scenes: Record<string, SceneDef> = { block, match, gradient };

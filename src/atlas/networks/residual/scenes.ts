import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { after } from '../../networks/draw';
import { type Ink, rich } from '../draw';

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

type Spot = 'x' | 'b1' | 'h' | 'b2' | 'y';

/** Two blocks in a chain, x to h to y, with the gradient's steps written under the spots they reach. */
function stack(s: Scene, yS: number, a: number, steps: [string, Spot, number][], total: [string, string, number]): void {
  if (a <= 0.003) return;
  const at = { x: 0.1, b1: 0.3, h: 0.5, b2: 0.7, y: 0.9 };
  const [xN, b1, hN, b2, yN] = [at.x, at.b1, at.h, at.b2, at.y].map((f) => s.w * f) as [number, number, number, number, number];
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
  for (const [t, spot, v] of steps) s.alpha(a * v, () => s.text(t, s.w * at[spot], yG, { size: 3.3, font: 'mono', weight: 650, color: s.c('red'), halo: true }));
  s.alpha(a * total[2], () => rich(s, [[total[0], '--ink-2'], [total[1], 'red']], s.w / 2, yG + 8 * s.u, { size: 3.2, weight: 650 }));
}

/** The one-block walk back: g at y, g along the shortcut, g F′ through F, and the sum at x. */
function oneBlock(s: Scene, yD: number, o: { dim: number; split: number; g: string; through: string; sum: string; formula: string; at: [number, number, number, number] }): void {
  const d = diagram(s, { yD, cut: 1, dim: o.dim, red: { cut: o.split, box: o.split } });
  const red = (t: string, x: number, y: number, size = 3.3) => s.text(t, x, y, { size, font: 'mono', weight: 650, color: s.c('red'), halo: true });
  const [gA, cutA, fA, sumA] = o.at;
  s.alpha(gA, () => red(o.g, d.yN, yD - 7.5 * s.u));
  s.alpha(cutA, () => red(o.g, (d.xN + d.pN) / 2, d.top + 5 * s.u));
  s.alpha(fA, () => red(o.through, (d.b0 + d.b1) / 2, yD + 13.5 * s.u, 3.1));
  s.alpha(sumA, () => {
    red(o.sum, d.xN + 6 * s.u, yD + 21 * s.u);
    s.text(o.formula, s.w / 2 + 6 * s.u, yD + 21 * s.u, { size: 3.6, font: 'mono', weight: 650, color: s.c('--ink-2') });
  });
}

const gradient: SceneDef = {
  draw(s) {
    const yD = s.h * 0.3;
    const split = s.ease('split', 0.6, 0.6);
    // The forward pass, in numbers, until the walk back starts.
    s.alpha(s.ease('recap', 0.6, 1.2) * (1 - s.ease('split', 0.4)), () => {
      const lab = (t: string, f: number, k: Ink) => s.text(t, s.w * f, yD + 11 * s.u, { size: 3.4, font: 'mono', weight: 650, color: s.c(k), halo: true });
      lab('x = 2', 0.1, 'orange');
      lab('F(x) = 0.5', 0.41, 'blue');
      lab('y = 2.5', 0.87, 'green');
    });
    // The one-block example steps back while two stacked blocks use other numbers.
    s.alpha(1 - 0.6 * s.ease('stack', 0.6), () =>
      oneBlock(s, yD, {
        dim: s.ease('split', 0.6),
        split,
        g: 'g = 2',
        through: 'g · F′ = 2 × 0.5 = 1',
        sum: '2 + 1 = 3',
        formula: 'g (1 + F′)',
        at: [s.ease('split', 0.6), s.ease('paths', 0.6, 0.3), s.ease('paths', 0.6, 2.4), s.ease('formula', 0.6, 0.4)],
      }),
    );
    stack(
      s,
      s.h * 0.67,
      s.ease('stack', 0.6) * (1 - s.ease('deep', 0.5)),
      [
        ['g = 1', 'y', after(s, 'back2', 0.15)],
        ['× (1 + 1)', 'b2', after(s, 'back2', 0.5)],
        ['2', 'h', after(s, 'back2', 0.8)],
        ['× (1 − 0.5)', 'b1', after(s, 'back1', 0.2)],
        ['1', 'x', after(s, 'back1', 0.45)],
      ],
      ['g (1 + F₂′)(1 + F₁′) = 1 × 2 × 0.5 = ', '1', after(s, 'back1', 0.7)],
    );
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

// ---- the worked problems, in the practice's format

const tryIt: SceneDef = {
  marks: {
    p1: { tex: String.raw`F'(\symx) = 3,\quad \symg = 2`, x: 0.5, y: 0.1, size: 4.8 },
    q1: { tex: String.raw`\text{gradient at } \symx\,?`, x: 0.5, y: 0.21, size: 4.6 },
    p2a: { tex: String.raw`h = \symx + F_1(\symx),\quad y = h + F_2(h)`, x: 0.5, y: 0.09, size: 4.4 },
    p2b: { tex: String.raw`F_1' = 1,\quad F_2' = -0.5,\quad \symg = 4`, x: 0.5, y: 0.2, size: 4.4 },
    q2: { tex: String.raw`\text{gradient at } \symx\,?`, x: 0.5, y: 0.31, size: 4.4 },
  },
  draw(s) {
    const one = s.ease('p1', 0.6, 0.2) * (1 - s.ease('p2', 0.5));
    s.show('p1', one);
    s.show('q1', one * after(s, 'p1', 0.7));
    const two = s.ease('p2', 0.6, 0.3);
    s.show('p2a', two);
    s.show('p2b', two * after(s, 'p2', 0.3));
    s.show('q2', two * after(s, 'p2', 0.8));
    s.alpha(one, () =>
      oneBlock(s, s.h * 0.6, {
        dim: 0.6,
        split: after(s, 'a1', 0.05),
        g: 'g = 2',
        through: 'g · F′ = 2 × 3 = 6',
        sum: '2 + 6 = 8',
        formula: 'g (1 + F′) = 2 × 4 = 8',
        at: [after(s, 'p1', 0.7), after(s, 'a1', 0.1), after(s, 'a1', 0.45), after(s, 'a1', 0.8)],
      }),
    );
    stack(
      s,
      s.h * 0.56,
      two,
      [
        ['g = 4', 'y', after(s, 'p2', 0.85)],
        ['× (1 − 0.5)', 'b2', after(s, 'a2', 0.05)],
        ['2', 'h', after(s, 'a2', 0.35)],
        ['× (1 + 1)', 'b1', after(s, 'a2', 0.55)],
        ['4', 'x', after(s, 'a2', 0.85)],
      ],
      ['g (1 + F₂′)(1 + F₁′) = 4 × 0.5 × 2 = ', '4', after(s, 'a2', 0.9)],
    );
  },
};

export const scenes: Record<string, SceneDef> = { gradient, try: tryIt };

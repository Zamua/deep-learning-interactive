import type { Scene, SceneDef } from '../../../lecture/scene';
import { cells } from '../../draw';
import { after } from '../../networks/draw';
import { mono } from '../draw';

const sup = (n: number) => String(n).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]!);

const LOSS = [3.98, 3.16, 2.51, 2.0];

const tenfold: SceneDef = {
  marks: {
    line: { tex: String.raw`\log \symL = \log a - \sym{alpha}{\alpha} \log \sym{Cflops}{C}`, x: 0.5, y: 0.12, size: 5 },
    f: { tex: String.raw`10^{-\sym{alpha}{\alpha}} = 10^{-0.1} \approx 0.79`, x: 0.5, y: 0.12, size: 5.2 },
    two: { tex: String.raw`10^{-0.1} \times 10^{-0.1} = 10^{-0.2} \approx 0.63`, x: 0.5, y: 0.22, size: 4.6 },
    k: { tex: String.raw`k = 3: \; 10^{-k\sym{alpha}{\alpha}} = 10^{-0.3} \approx 0.5`, x: 0.5, y: 0.22, size: 4.6 },
  },
  draw(s) {
    const back = s.ease('back', 0.6);
    s.show('line', s.win('line', 'step'));
    s.show('f', s.ease('step', 0.6, 2) * (1 - back));
    s.show('two', s.win('hundred', 'k'));
    s.show('k', s.win('k', 'cost'));
    s.alpha(1 - back, () => table(s));
    // Backwards: from the loss's factor to the compute.
    const o = { size: s.tall ? 3.4 : 3.8 } as const;
    s.alpha(back, () => {
      mono(s, 'each 10× compute: loss × 0.8', s.w / 2, s.h * 0.14, { ...o, k: '--ink-2' });
      mono(s, 'loss 4 → 2.56: how much more compute?', s.w / 2, s.h * 0.24, { ...o, k: '--ink' });
    });
    s.alpha(after(s, 'back', 0.5), () => mono(s, '2.56 / 4 = 0.64', s.w / 2, s.h * 0.38, { ...o, k: 'red', weight: 650 }));
    s.alpha(after(s, 'back', 0.75), () => mono(s, '0.64 = 0.8 × 0.8: two factors', s.w / 2, s.h * 0.48, { ...o, k: 'red', weight: 650 }));
    s.alpha(s.ease('factors', 0.6), () => {
      const xs = [-1, 0, 1].map((i) => s.w / 2 + i * (s.tall ? 26 : 30) * s.u);
      const yL = s.h * 0.7;
      ['×1', '×10', '×100'].forEach((t, i) => mono(s, t, xs[i]!, s.h * 0.61, { size: 3.4, k: 'purple', weight: 650 }));
      cells(s, xs, yL, ['4', '3.2', '2.56'], 'red', { w: 14, h: 8, size: 3.4, on: [0, 0, 1] });
      for (let i = 0; i < 2; i++) {
        s.arrow(xs[i]! + 8 * s.u, yL, xs[i + 1]! - 8 * s.u, yL, s.c('--ink-3'), 0.35, 2);
        mono(s, '× 0.8', (xs[i]! + xs[i + 1]!) / 2, yL + 4 * s.u, { size: 3, k: '--ink-2' });
      }
      mono(s, '10 × 10 = 100× the compute', s.w / 2, s.h * 0.86, { ...o, size: o.size + 0.4, k: 'purple', weight: 650 });
    });
  },
};

/** Loss at each power of ten in compute, with the hops between them. */
function table(s: Scene): void {
  const gap = s.tall ? 23 : 30;
  const xs = [-1.5, -0.5, 0.5, 1.5].map((i) => s.w / 2 + i * gap * s.u);
  const yC = s.h * 0.34;
  const yL = s.h * 0.48;
  xs.forEach((x, i) => {
    mono(s, `10${sup(18 + i)}`, x, yC, { size: 3.6, k: 'purple', weight: 650 });
  });
  mono(s, 'C', xs[0]! - 12 * s.u, yC, { size: 3.6, k: 'purple', weight: 650, align: 'right' });
  mono(s, 'L', xs[0]! - 12 * s.u, yL, { size: 3.6, k: 'red', weight: 650, align: 'right' });
  const on = [0, s.win('ex', 'cost'), s.win('ex', 'hundred'), s.win('hundred', 'cost')];
  cells(s, xs, yL, LOSS.map((v) => v.toFixed(2)), 'red', { w: s.tall ? 16 : 17, h: 8, size: 3.4, on });
  // A ×0.79 hop between neighbors.
  for (let i = 0; i < 3; i++) {
    s.alpha(s.ease('step', 0.6, 2.5 + i * 0.4), () => {
      const x0 = xs[i]! + 6 * s.u;
      const x1 = xs[i + 1]! - 6 * s.u;
      const y = yL + 9 * s.u;
      s.arrow(x0, y, x1, y, s.c('--ink-3'), 0.35, 2);
      mono(s, '× 0.79', (x0 + x1) / 2, y + 3.6 * s.u, { size: 3, k: '--ink-2' });
    });
  }
  s.alpha(s.ease('hundred', 0.6, 1) * (1 - s.ease('cost', 0.5)), () => {
    const y = yL + 20 * s.u;
    s.arrow(xs[1]! + 2 * s.u, y, xs[3]! - 2 * s.u, y, s.c('green'), 0.45, 2.4);
    mono(s, '× 0.79 × 0.79 ≈ 0.63', (xs[1]! + xs[3]!) / 2, y + 4 * s.u, { size: 3.4, k: 'green', weight: 650 });
  });
  // The same fraction off a smaller loss: the drops shrink.
  ['−0.82', '−0.65', '−0.51'].forEach((t, i) =>
    s.alpha(s.ease('cost', 0.6, 1 + i * 0.6), () => mono(s, t, (xs[i]! + xs[i + 1]!) / 2, yL + 20 * s.u, { size: 3.4, k: 'red', weight: 650 })),
  );
  s.alpha(s.ease('cost', 0.6, 3), () => mono(s, 'same fraction off: 10× the compute each time', s.w / 2, s.h * 0.88, { size: s.tall ? 3 : 3.4, k: '--ink-2' }));
}

const tryIt: SceneDef = {
  marks: {
    w0: { tex: String.raw`\sym{alpha}{\alpha} = 0.3,\ \symL = 3.6\!:\quad 100\times\ \text{the compute?}`, x: 0.5, y: 0.1, size: 4.6 },
    w1: { tex: String.raw`10^{-0.3} \approx 0.50,\quad 10^{-0.6} \approx 0.25`, x: 0.5, y: 0.21, size: 4.2 },
    w2: { tex: String.raw`100 = 10 \times 10\!:\ \text{two factors of ten}`, x: 0.5, y: 0.36, size: 4.2 },
    w3: { tex: String.raw`10^{-0.3} \times 10^{-0.3} = 10^{-0.6} \approx 0.25`, x: 0.5, y: 0.47, size: 4.2 },
    w4: { tex: String.raw`\symL = 3.6 \times 0.25 = 0.90`, x: 0.5, y: 0.58, size: 4.6 },
  },
  draw(s) {
    s.show('w0', s.ease('p', 0.6));
    s.show('w1', s.ease('p', 0.6, 7));
    s.show('w2', s.ease('two', 0.6));
    s.show('w3', s.ease('f', 0.6));
    s.show('w4', s.ease('ans', 0.6));
    // The two tenfold hops, each × 0.50.
    const xs = [-1, 0, 1].map((i) => s.w / 2 + i * (s.tall ? 26 : 30) * s.u);
    const y = s.h * 0.76;
    s.alpha(s.ease('two', 0.6, 0.6), () => {
      ['×1', '×10', '×100'].forEach((t, i) => mono(s, t, xs[i]!, y - 8 * s.u, { size: 3.4, k: 'purple', weight: 650 }));
      cells(s, xs, y, ['3.6', '', ''], 'red', { w: 14, h: 8, size: 3.4 });
      for (let i = 0; i < 2; i++) {
        s.arrow(xs[i]! + 8 * s.u, y, xs[i + 1]! - 8 * s.u, y, s.c('--ink-3'), 0.35, 2);
        s.alpha(s.ease('f', 0.6, 0.5), () => mono(s, '× 0.50', (xs[i]! + xs[i + 1]!) / 2, y + 4.4 * s.u, { size: 3, k: '--ink-2' }));
      }
    });
    s.alpha(s.ease('f', 0.6, 1.5), () => cells(s, [xs[1]!], y, ['1.8'], 'red', { w: 14, h: 8, size: 3.4 }));
    s.alpha(s.ease('ans', 0.6, 1), () => cells(s, [xs[2]!], y, ['0.90'], 'green', { w: 14, h: 8, size: 3.4, on: [1] }));
  },
};

export const scenes: Record<string, SceneDef> = { tenfold, try: tryIt };

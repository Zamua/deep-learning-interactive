import type { SceneDef } from '../../../lecture/scene';
import { cells } from '../../draw';
import { rich } from '../../linear-algebra/draw';
import { mono } from '../draw';

const solve: SceneDef = {
  marks: {
    d: { tex: String.raw`\sym{Dtokens}{D} = 20\,\sym{Nparams}{N}`, x: 0.5, y: 0.1, size: 5 },
    c: { tex: String.raw`\sym{Cflops}{C} = 6\,\sym{Nparams}{N} \cdot 20\,\sym{Nparams}{N} = 120\,\sym{Nparams}{N}^2`, x: 0.5, y: 0.22, size: 5 },
    n: { tex: String.raw`\sym{Nparams}{N} = \sqrt{\sym{Cflops}{C} / 120}`, x: 0.5, y: 0.36, size: 5.6 },
    l0: { tex: String.raw`\sym{Cflops}{C} = 1.2 \times 10^{22}\!:\quad 1.2 / 1.2 = 1,\quad 10^{22} / 10^{2} = 10^{20}`, x: 0.5, y: 0.49, size: 4.2 },
    l1: { tex: String.raw`\text{a billion squared: } 10^{9} \times 10^{9} = 10^{18}`, x: 0.5, y: 0.58, size: 4.2 },
    l2: { tex: String.raw`\sym{Nparams}{N}^2 = 10^{20} = 100 \times 10^{18}`, x: 0.5, y: 0.67, size: 4.2 },
    l3: { tex: String.raw`\sym{Nparams}{N} = \sqrt{100} \times \sqrt{10^{18}} = 10 \times 10^{9}`, x: 0.5, y: 0.77, size: 4.2 },
  },
  draw(s) {
    s.show('d', 1);
    s.alpha(s.win('opt', 'sub'), () => rich(s, [['70 billion parameters, ', 'blue'], ['1.4 trillion tokens', 'orange']], s.w / 2, s.h * 0.22, { size: s.tall ? 3.3 : 3.7 }));
    s.show('c', s.ease('sub', 0.6, 1.5));
    s.show('n', s.ease('root', 0.6));
    const out = 1 - s.ease('grow', 0.5);
    s.show('l0', s.ease('divide', 0.6) * out);
    s.show('l1', s.ease('billion', 0.6) * out);
    s.show('l2', s.ease('billion', 0.6, 4.5) * out);
    s.show('l3', s.ease('ex', 0.6) * out);
    s.alpha(s.ease('ex', 0.6, 4) * out, () => rich(s, [['10 billion parameters, ', 'blue'], ['200 billion tokens', 'orange']], s.w / 2, s.h * 0.87, { size: s.tall ? 3.3 : 3.7 }));
    s.alpha(s.ease('grow', 0.6), () => {
      const xs = [s.w / 2 - (s.tall ? 22 : 28) * s.u, s.w / 2, s.w / 2 + (s.tall ? 22 : 28) * s.u];
      const y0 = s.h * 0.56;
      const y1 = s.h * 0.74;
      ['C', 'N', 'D'].forEach((n, i) => mono(s, n, xs[i]!, y0 - 8 * s.u, { size: 3.8, k: (['purple', 'blue', 'orange'] as const)[i]!, weight: 650 }));
      cells(s, xs, y0, ['×1', '×1', '×1'], '--ink-3', { w: 14, h: 7.4, size: 3.4 });
      s.alpha(s.ease('grow', 0.6, 1.2), () => {
        xs.forEach((x) => s.arrow(x, y0 + 4.6 * s.u, x, y1 - 4.6 * s.u, s.c('--ink-3'), 0.35, 2));
        cells(s, xs, y1, ['×4', '×2', '×2'], 'green', { w: 14, h: 7.4, size: 3.4, on: [1, 1, 1] });
      });
    });
  },
};

/** The two worked budgets: 4.8 × 10²² for parameters, 1.92 × 10²³ for tokens, one line per step. */
const WORKED: { p: string; lines: [string, number][]; tex: string[] }[] = [
  {
    p: 'p1',
    lines: [['p1', 0], ['d1', 0], ['d1', 3.5], ['e1', 0], ['r1', 0]],
    tex: [
      String.raw`\sym{Cflops}{C} = 4.8 \times 10^{22}\ \text{FLOPs}\!:\quad \sym{Nparams}{N} = \,?`,
      String.raw`4.8 / 1.2 = 4,\quad 10^{22} / 10^{2} = 10^{20}`,
      String.raw`\sym{Nparams}{N}^2 = 4 \times 10^{20}`,
      String.raw`= 4 \times 100 \times 10^{18} = 400 \times 10^{18}`,
      String.raw`\sym{Nparams}{N} = \sqrt{400} \times \sqrt{10^{18}} = 20 \times 10^{9}\!:\ \text{20 billion}`,
    ],
  },
  {
    p: 'p2',
    lines: [['p2', 0], ['d2', 0], ['d2', 3], ['e2', 0], ['r2', 0], ['r2', 3.2]],
    tex: [
      String.raw`\sym{Cflops}{C} = 1.92 \times 10^{23}\ \text{FLOPs}\!:\quad \sym{Dtokens}{D} = \,?`,
      String.raw`1.92 / 1.2 = 1.6,\quad 10^{23} / 10^{2} = 10^{21}`,
      String.raw`\sym{Nparams}{N}^2 = 1.6 \times 10^{21}`,
      String.raw`= 1.6 \times 1000 \times 10^{18} = 1600 \times 10^{18}`,
      String.raw`\sym{Nparams}{N} = \sqrt{1600} \times \sqrt{10^{18}} = 40 \times 10^{9}`,
      String.raw`\sym{Dtokens}{D} = 20 \times 40\ \text{billion} = 800\ \text{billion}`,
    ],
  },
];
const YS = [0.1, 0.25, 0.37, 0.49, 0.62, 0.75];

const tryIt: SceneDef = {
  marks: Object.fromEntries(WORKED.flatMap((w, i) => w.tex.map((tex, j) => [`w${i}${j}`, { tex, x: 0.5, y: YS[j]!, size: j === 0 ? 4.6 : 4.2 }]))),
  draw(s) {
    const second = s.ease('p2', 0.6);
    WORKED.forEach((w, i) => {
      const a = i === 0 ? 1 - second : second;
      w.lines.forEach(([beat, delay], j) => s.show(`w${i}${j}`, a * s.ease(beat, 0.6, delay)));
    });
  },
};

export const scenes: Record<string, SceneDef> = { solve, try: tryIt };

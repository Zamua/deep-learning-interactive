import type { Scene, SceneDef } from '../../../lecture/scene';
import { cells } from '../../draw';
import { mono, stack } from '../draw';

const W = [
  [1, 0, 2, -1],
  [3, 1, 0, 2],
  [0, -2, 1, 1],
];
const X = [2, 1, 3, 1];
const Z = W.map((r) => r.reduce((a, w, j) => a + w * X[j]!, 0));
const f = (v: number) => String(v).replace('-', '−');

/** W, x and z = W x as cells, laid out for either stage shape; `hi` lights row `row` and x. */
function product(s: Scene, cy: number, row: number, hi: number, zOn: number[]): void {
  const cw = s.tall ? 9.6 : 10.4;
  const gap = s.tall ? 10.4 : 11.2;
  const left = s.w / 2 - (s.tall ? 33 : 36) * s.u;
  const xs = Array.from({ length: 4 }, (_, j) => left + j * gap * s.u);
  const ys = [-1, 0, 1].map((i) => cy + i * 9.6 * s.u);
  W.forEach((r, i) => cells(s, xs, ys[i]!, r.map(f), 'blue', { w: cw, h: 8, size: 3.4, on: r.map(() => (i === row ? hi : 0)) }));
  const xx = xs[3]! + (s.tall ? 15 : 17) * s.u;
  const xz = xx + (s.tall ? 17 : 20) * s.u;
  const xY = [-1.5, -0.5, 0.5, 1.5].map((i) => cy + i * 8 * s.u);
  X.forEach((v, j) => cells(s, [xx], xY[j]!, [f(v)], 'orange', { w: 8.4, h: 7.2, size: 3.4, on: [hi] }));
  s.text('=', (xx + xz) / 2, cy, { size: 4.6, font: 'mono', color: s.c('--ink-3') });
  Z.forEach((v, i) => cells(s, [xz], ys[i]!, [String(v)], '--ink-2', { w: 8.4, h: 8, size: 3.4, on: [zOn[i] ?? 0] }));
  mono(s, 'W', xs[0]! - 9 * s.u, cy, { size: 4.2, k: 'blue', weight: 650 });
  mono(s, 'x', xx, xY[0]! - 7 * s.u, { size: 4.2, k: 'orange', weight: 650 });
  mono(s, 'z', xz, ys[0]! - 7.4 * s.u, { size: 4.2, k: '--ink-2', weight: 650 });
}

const forward: SceneDef = {
  draw(s) {
    const cy = s.h * (s.tall ? 0.36 : 0.32);
    const hi = s.win('mult', 'model');
    product(s, cy, 1, hi, [0, s.ease('mult', 0.6, 3.5), 0]);
    const t1 = s.h * 0.7;
    const t2 = s.h * 0.81;
    s.alpha(s.ease('mult', 0.6, 1) * (1 - s.ease('two', 0.5)), () => mono(s, '3·2 + 1·1 + 0·3 + 2·1 = 9', s.w / 2, t1, { size: 3.8, k: '--ink-2' }));
    s.alpha(s.ease('two', 0.6) * (1 - s.ease('model', 0.5)), () => {
      mono(s, 'per weight: × then +', s.w / 2, t1, { size: 3.8, k: '--ink-2' });
      mono(s, '= 2 FLOPs', s.w / 2, t2, { size: 4.4, k: 'blue', weight: 650 });
    });
    s.alpha(s.ease('model', 0.6), () => {
      mono(s, '12 weights × 2 = 24 FLOPs per token', s.w / 2, t1, { size: 3.6, k: '--ink-2' });
      mono(s, 'N parameters: 2N FLOPs per token', s.w / 2, t2, { size: 4, k: 'blue', weight: 650 });
    });
  },
};

const ROWS: { name: string; code: string; beat: string }[] = [
  { name: 'forward', code: 'W x', beat: 'back' },
  { name: 'backward', code: 'Wᵀ dz', beat: 'dx' },
  { name: 'backward', code: 'dz xᵀ', beat: 'dW' },
];
const KS = ['blue', 'red', 'red'] as const;

const backward: SceneDef = {
  marks: {
    c: { tex: String.raw`\sym{Cflops}{C} \approx 6\,\sym{Nparams}{N}\,\sym{Dtokens}{D}`, x: 0.5, y: 0.87, size: 6.4 },
  },
  draw(s) {
    const unit = s.tall ? 8 : 9;
    const bx = s.w / 2 - (s.tall ? 14 : 18) * s.u;
    const lx = bx - 4 * s.u;
    ROWS.forEach((r, i) => {
      const y = s.h * (0.13 + i * 0.14);
      const a = i === 0 ? 1 : s.ease(r.beat, 0.6);
      s.alpha(a, () => {
        mono(s, r.name, lx, y - 2.4 * s.u, { size: 3.2, k: '--ink-3', align: 'right' });
        mono(s, r.code, lx, y + 2.4 * s.u, { size: 3.8, k: KS[i]!, align: 'right', weight: 650 });
        // The outer product's two FLOPs arrive one beat each: the multiply, then the add across tokens.
        const parts = i === 2 ? [{ n: 1, k: KS[i]!, label: '×' }, { n: 1, k: KS[i]!, label: '+' }] : [{ n: 2, k: KS[i]!, label: '2' }];
        const grow = i === 0 ? 1 : i === 2 ? 0.5 * s.ease('dW', 0.8, 0.3) + 0.5 * s.ease('acc', 0.8, 0.3) : s.ease(r.beat, 0.8, 0.3);
        stack(s, bx + 2 * i * unit * s.u, y, unit, 7.4, parts, { grow, size: 3.4 });
      });
    });
    const ya = s.h * 0.5;
    s.alpha(s.win('dW', 'acc'), () => mono(s, 'dW[i, j] = dz[i] × x[j]: one ×', s.w / 2, ya, { size: 3.2, k: '--ink-2' }));
    s.alpha(s.win('acc', 'six'), () => mono(s, 'dW[i, j] += dz[i] × x[j]: × then +', s.w / 2, ya, { size: 3.2, k: '--ink-2' }));
    const ty = s.h * 0.6;
    s.alpha(s.ease('six', 0.6), () => {
      mono(s, 'per parameter,', lx, ty - 2.4 * s.u, { size: 3.2, k: '--ink-3', align: 'right' });
      mono(s, 'per token', lx, ty + 2.4 * s.u, { size: 3.2, k: '--ink-3', align: 'right' });
      const mids = stack(s, bx, ty, unit, 8, [{ n: 2, k: 'blue', label: '2' }, { n: 4, k: 'red', label: '4' }], { grow: s.ease('six', 1, 0.3), size: 3.4 });
      s.alpha(s.ease('six', 0.6, 1.2), () => mono(s, '= 6', bx + 6 * unit * s.u + 3 * s.u, ty, { size: 4.4, weight: 700, align: 'left' }));
      s.alpha(s.ease('six', 0.6, 1), () => {
        mono(s, 'forward', mids[0]!, ty + 7 * s.u, { size: 3, k: 'blue' });
        mono(s, 'backward', mids[1]!, ty + 7 * s.u, { size: 3, k: 'red' });
      });
    });
    s.show('c', s.ease('nd', 0.6));
  },
};

/** The worked run, one line per beat: a label and its value. */
const LINES: { beat: string; label: string; value: string; k: 'blue' | 'orange' | 'purple' | 'slate' | 'green' | 'teal' }[] = [
  { beat: 'model', label: 'N', value: '3 × 10⁹ parameters', k: 'blue' },
  { beat: 'model', label: 'D', value: '4 × 10¹⁰ tokens', k: 'orange' },
  { beat: 'mult', label: 'C = 6ND', value: '7.2 × 10²⁰ FLOPs', k: 'purple' },
  { beat: 'rate', label: '100 GPUs', value: '2 × 10¹⁶ FLOPs per second', k: 'slate' },
  { beat: 'time', label: 'time', value: '3.6 × 10⁴ s', k: 'green' },
  { beat: 'fwd', label: 'forward', value: '2N = 6 × 10⁹ per token', k: 'teal' },
];

const run: SceneDef = {
  draw(s) {
    const lx = s.w / 2 - (s.tall ? 14 : 22) * s.u;
    LINES.forEach((l, i) => {
      const y = s.h * (0.12 + i * 0.14);
      const a = s.ease(l.beat, 0.6, l.beat === 'model' && i === 1 ? 1.2 : 0);
      s.alpha(a, () => {
        mono(s, l.label, lx - 2 * s.u, y, { size: 4, k: l.k, align: 'right', weight: 650 });
        const hrs = l.beat === 'time' ? s.ease('hours', 0.6) : 0;
        s.alpha(1 - hrs, () => mono(s, l.value, lx + 2 * s.u, y, { size: s.tall ? 3.6 : 4, align: 'left' }));
        s.alpha(hrs, () => mono(s, '3.6 × 10⁴ s = 10 hours', lx + 2 * s.u, y, { size: s.tall ? 3.6 : 4, align: 'left' }));
      });
    });
    s.alpha(s.ease('mult', 0.6, 0.8) * (1 - s.ease('rate', 0.5)), () => mono(s, '6 × 3 × 4 = 72,  10⁹ × 10¹⁰ = 10¹⁹', s.w / 2, s.h * 0.4 + 5.5 * s.u, { size: 3, k: '--ink-3' }));
    s.alpha(s.ease('time', 0.6, 0.4) * (1 - s.ease('hours', 0.5)), () => mono(s, '7.2 / 2 = 3.6,  10²⁰ / 10¹⁶ = 10⁴', s.w / 2, s.h * 0.68 + 5.5 * s.u, { size: 3, k: '--ink-3' }));
    s.alpha(s.ease('hours', 0.6, 0.4) * (1 - s.ease('fwd', 0.5)), () => mono(s, '36,000 s / 3,600 = 10 hours', s.w / 2, s.h * 0.68 + 5.5 * s.u, { size: 3, k: '--ink-3' }));
  },
};

export const scenes: Record<string, SceneDef> = { forward, backward, run };

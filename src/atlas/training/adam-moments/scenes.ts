import type { Scene, SceneDef } from '../../../lecture/scene';
import { smooth } from '../../../lecture/scene';
import { bars, cells, columns } from '../../draw';
import { axes, frame, series, xTicks, yTicks } from '../draw';

/** Eased 0 -> 1 from a fraction `f` of the way through beat `id`, so it tracks the voice at any pace. */
const after = (s: Scene, id: string, f: number, dur = 0.5) => smooth((s.t - s.at(id) - f * (s.end(id) - s.at(id))) / dur);
const line = (s: Scene, t: string, y: number, k: Parameters<Scene['c']>[0] = '--ink-2', size = 3.6) => s.text(t, s.w / 2, y, { size, font: 'mono', color: s.c(k) });

const M_RULE = String.raw`\sym{m}{m} \leftarrow \sym{beta1}{\beta_1} \sym{m}{m} + (1 - \sym{beta1}{\beta_1})\,\symg`;
const V_RULE = String.raw`\sym{v}{v} \leftarrow \sym{beta2}{\beta_2} \sym{v}{v} + (1 - \sym{beta2}{\beta_2})\,\symg^2`;

/** One update's mix as a bar: the share `keep` of the old average, and the rest from the new gradient. */
function split(s: Scene, y: number, keep: number, k: 'gold' | 'purple', kept: string, taken: string): void {
  const x0 = s.w / 2 - 40 * s.u;
  const w = 80 * s.u;
  const h = 6 * s.u;
  const cut = x0 + w * keep;
  s.rrect(x0, y - h / 2, cut - x0, h, 0.8, { fill: s.tint(k, 0.55) });
  s.rrect(cut, y - h / 2, Math.max(0.7 * s.u, x0 + w - cut), h, 0.8, { fill: s.tint('red', 0.75) });
  s.text(kept, x0, y - h / 2 - 3 * s.u, { size: 3.4, font: 'mono', align: 'left', color: s.c(k) });
  s.text(taken, x0 + w, y - h / 2 - 3 * s.u, { size: 3.4, font: 'mono', align: 'right', color: s.c('red') });
}

const moments: SceneDef = {
  marks: {
    m: { tex: M_RULE, x: 0.5, y: 0.09, size: 4.6 },
    mom: { tex: String.raw`\text{momentum: } v \leftarrow \mu v - \symeta\,\symg`, x: 0.5, y: 0.2, size: 4.6 },
    v: { tex: V_RULE, x: 0.5, y: 0.2, size: 4.6 },
  },
  draw(s) {
    s.show('m', s.ease('m', 0.6));
    s.show('mom', s.win('mom', 'v'));
    s.show('v', s.ease('v', 0.6));
    s.alpha(s.win('mnum', 'mom'), () => line(s, 'β₁ = 0.9', s.h * 0.31, '--ink-2', 3.8));
    s.alpha(s.win('mom', 'v'), () => line(s, 'm: no η, and g weighted by 1 − β₁', s.h * 0.31, 'gold'));
    s.alpha(s.win('v', 'vnum'), () => line(s, 'β₁ = 0.9', s.h * 0.31, '--ink-2', 3.8));
    s.alpha(s.ease('vnum', 0.6), () => line(s, 'β₁ = 0.9    β₂ = 0.999', s.h * 0.31, '--ink-2', 3.8));
    s.alpha(s.ease('mnum', 0.6), () => split(s, s.h * 0.52, 0.9, 'gold', '0.9 of m', '0.1 of g'));
    s.alpha(s.ease('vnum', 0.6), () => split(s, s.h * 0.72, 0.999, 'purple', '0.999 of v', '0.001 of g²'));
  },
};

/** The running example after steps 1 and 2: gradients 2 then -4. */
const TABLE: [string, string, string, string][] = [
  ['t = 1', '2', '0.2', '0.004'],
  ['t = 2', '−4', '−0.22', '0.02'],
];

/** m over 40 steps from zero, for a gradient held at 3 and one flipping between 3 and -3. */
const track = (flip: boolean): [number, number][] => {
  const pts: [number, number][] = [[0, 0]];
  let m = 0;
  for (let t = 1; t <= 40; t++) {
    m = 0.9 * m + 0.1 * (flip && t % 2 === 0 ? -3 : 3);
    pts.push([t, m]);
  }
  return pts;
};
const STEADY = track(false);
const FLIP = track(true);

const start: SceneDef = {
  marks: {
    m: { tex: M_RULE, x: 0.5, y: 0.08, size: 4.2 },
    v: { tex: V_RULE, x: 0.5, y: 0.17, size: 4.2 },
    m2: { tex: String.raw`\sym{m}{m} = 0.9 \times 0.2 + 0.1 \times (-4) = 0.18 - 0.4 = -0.22`, x: 0.5, y: 0.75, size: 4 },
    v2: { tex: String.raw`\sym{v}{v} = 0.999 \times 0.004 + 0.001 \times 16 \approx 0.02`, x: 0.5, y: 0.85, size: 4 },
  },
  draw(s) {
    s.show('m', s.ease('zero', 0.6));
    s.show('v', s.ease('zero', 0.6));
    s.alpha(s.ease('zero', 0.6), () => line(s, 'β₁ = 0.9    β₂ = 0.999', s.h * 0.26, '--ink-2', 3.6));
    const two = s.win('two', 'steady');
    s.show('m2', after(s, 'two', 0.15) * two);
    s.show('v2', after(s, 'two', 0.6) * two);
    s.alpha(two, () => {
      const xs = columns(s, 4, s.tall ? 22 : 24);
      const hy = s.h * 0.4;
      (['', 'g', 'm', 'v'] as const).forEach((t, j) => s.text(t, xs[j]!, hy, { size: 3.8, font: 'mono', weight: 650, color: s.c((['--ink-2', 'red', 'gold', 'purple'] as const)[j]) }));
      TABLE.forEach(([t, g, m, v], i) => {
        const y = hy + (i + 1) * 10 * s.u;
        const on = i === 1 ? 1 : 0;
        s.text(t, xs[0]!, y, { size: 3.4, font: 'mono', color: s.c('--ink-3') });
        cells(s, [xs[1]!], y, [g], 'red', { w: 14, h: 7.5, size: 3.4 });
        s.alpha(i === 0 ? 1 : after(s, 'two', 0.15), () => cells(s, [xs[2]!], y, [m], 'gold', { w: 16, h: 7.5, size: 3.4, on: [on] }));
        s.alpha(i === 0 ? 1 : after(s, 'two', 0.6), () => cells(s, [xs[3]!], y, [v], 'purple', { w: 16, h: 7.5, size: 3.4, on: [on] }));
      });
    });
    s.alpha(1 - s.ease('two', 0.6), () => {
      const grow = s.ease('zero', 1, 1.5);
      const gap = s.tall ? 13 : 15;
      const base = s.h * 0.86;
      const height = (s.h * 0.36) / s.u;
      const left = s.w / 2 - (s.tall ? 22 : 26) * s.u;
      const right = s.w / 2 + (s.tall ? 22 : 26) * s.u;
      const group = (cx: number, target: number, tName: string, val: number, name: string, k: 'gold' | 'purple', label: string) => {
        const xs = [cx - (gap / 2) * s.u, cx + (gap / 2) * s.u];
        bars(s, [xs[0]!], base, [target], 'red', { max: target, height, fmt: (v) => String(v) });
        bars(s, [xs[1]!], base, [val * grow], k, { max: target, height, fmt: () => label, grow: grow > 0.01 ? 1 : 0 });
        s.text(tName, xs[0]!, base + 4 * s.u, { size: 3.6, font: 'mono', weight: 650, color: s.c('red') });
        s.text(name, xs[1]!, base + 4 * s.u, { size: 3.6, font: 'mono', weight: 650, color: s.c(k) });
      };
      s.alpha(s.ease('zero', 0.6, 1), () => {
        group(left, 2, 'g', 0.2, 'm', 'gold', '0.2');
        group(right, 4, 'g²', 0.004, 'v', 'purple', '0.004');
      });
      s.alpha(s.ease('zero', 0.6, 3), () => s.text('far too small', s.w / 2, s.h * 0.4, { size: 3.6, weight: 600, color: s.c('red') }));
    });
    const plot = s.ease('steady', 0.6);
    s.alpha(plot, () => {
      const F = frame(14 * s.u, s.h * 0.33, s.w - 8 * s.u, s.h * 0.74, [0, 40], [-1, 3.6]);
      axes(s, F, 'step', 'm', { x: '--ink-3', y: 'gold' });
      xTicks(s, F, [10, 20, 30]);
      yTicks(s, F, [0, 3]);
      s.line(F.l, F.Y(3), F.r, F.Y(3), s.tint('gold', 0.6), 0.3, [1.2, 1]);
      s.line(F.l, F.Y(0), F.r, F.Y(0), s.c('--axis'), 0.3);
      const lab = { size: 3.2, font: 'mono', halo: true } as const;
      series(s, F, STEADY, 'gold', { upto: Math.max(0, Math.min(1, (s.since('steady') - 0.3) / 3)), width: 0.7 });
      s.alpha(after(s, 'steady', 0.3), () => s.text('g = 3, 3, 3, …:  m → 3', F.r - 1 * s.u, F.Y(1.8), { ...lab, align: 'right', color: s.c('gold') }));
      series(s, F, FLIP, 'red', { upto: Math.max(0, Math.min(1, (s.since('flip') - 0.3) / 3)), width: 0.6 });
      s.alpha(after(s, 'flip', 0.2), () => s.text('g = 3, −3, 3, …:  m near 0', F.r - 1 * s.u, F.Y(0) + 5 * s.u, { ...lab, align: 'right', color: s.c('red') }));
    });
    const cap = { size: 3.6, weight: 600, halo: true } as const;
    s.alpha(after(s, 'steady', 0.6) * (1 - s.ease('flip', 0.5)), () => s.text('v → 9, the square of 3', s.w / 2, s.h * 0.85, { ...cap, color: s.c('purple') }));
    s.alpha(after(s, 'flip', 0.45), () => s.text('every g² is 9: v → 9 either way', s.w / 2, s.h * 0.85, { ...cap, color: s.c('purple') }));
    s.alpha(after(s, 'flip', 0.8), () => s.text('m: the direction    v: the size', s.w / 2, s.h * 0.92, { ...cap, color: s.c('--ink') }));
  },
};

const tryIt: SceneDef = {
  marks: {
    q1: { tex: String.raw`\sym{m}{m} = 0.5,\quad \sym{beta1}{\beta_1} = 0.9,\quad \symg = 3`, x: 0.5, y: 0.1, size: 4.6 },
    a1a: { tex: String.raw`\sym{m}{m} \leftarrow 0.9 \times 0.5 + 0.1 \times 3`, x: 0.5, y: 0.62, size: 4.6 },
    a1b: { tex: String.raw`= 0.45 + 0.3 = 0.75`, x: 0.5, y: 0.74, size: 4.6 },
  },
  draw(s) {
    s.show('q1', s.ease('p1', 0.6));
    s.show('a1a', after(s, 'a1', 0.05));
    s.show('a1b', after(s, 'a1', 0.4));
    s.alpha(s.ease('p1', 0.6, 0.5), () => {
      const y = s.h * 0.34;
      const l = s.w / 2 - 38 * s.u;
      const X = (v: number) => l + (v / 3.2) * 76 * s.u;
      s.line(l, y, X(3.2), y, s.c('--axis'), 0.4);
      const dot = (v: number, k: 'gold' | 'red', r = 1.4) => s.circle(X(v), y, r * s.u, { fill: s.c(k), stroke: s.c('--card'), lw: 0.4 });
      const lab = (t: string, v: number, dy: number, k: 'gold' | 'red' | '--ink-2', a: CanvasTextAlign = 'center') => s.text(t, X(v), y + dy * s.u, { size: 3.4, font: 'mono', align: a, color: s.c(k), halo: true });
      dot(0.5, 'gold');
      lab('m = 0.5', 0.5, -4.5, 'gold');
      dot(3, 'red');
      lab('g = 3', 3, -4.5, 'red');
      s.alpha(after(s, 'a1', 0.4), () => {
        s.arrow(X(0.5), y + 3 * s.u, X(0.75), y + 3 * s.u, s.c('gold'), 0.4, 1.6);
        dot(0.75, 'gold', 1.8);
        lab('0.75: a tenth of the way to g', 0.5, 8, '--ink-2', 'left');
      });
    });
  },
};

export const scenes: Record<string, SceneDef> = { moments, start, try: tryIt };

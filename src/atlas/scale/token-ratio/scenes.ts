import type { Scene, SceneDef } from '../../../lecture/scene';
import { cells } from '../../draw';
import { mono } from '../draw';

const BUDGET = 1.2e22;
/** An illustrative final loss for n parameters on the fixed budget: a floor plus a size and a data penalty. */
const loss = (logN: number) => {
  const n = 10 ** logN;
  const d = BUDGET / (6 * n);
  return 1.7 + 400 / n ** 0.3 + 980 / d ** 0.3;
};
const SIZES = [8.5, 9, 9.5, 10, 10.5, 11, 11.5];
const sup = (n: number) => String(n).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]!);

function plot(s: Scene) {
  const l = (s.tall ? 12 : 16) * s.u;
  const r = s.w - 8 * s.u;
  const t = s.h * 0.16;
  const b = s.h - 17 * s.u;
  return { l, r, t, b, X: (x: number) => l + ((x - 8.3) / 3.4) * (r - l), Y: (y: number) => b - ((y - 2.4) / 0.75) * (b - t) };
}

const valley: SceneDef = {
  draw(s) {
    const F = plot(s);
    mono(s, 'C = 1.2 × 10²² FLOPs', s.w / 2, s.h * 0.07, { size: 3.6, k: 'purple', weight: 650 });
    s.line(F.l, F.b, F.r, F.b, s.c('--axis'), 0.35);
    s.line(F.l, F.b, F.l, F.t, s.c('--axis'), 0.35);
    mono(s, 'loss', F.l + 2 * s.u, F.t, { size: 3.2, k: 'red', align: 'left', weight: 650 });
    [9, 10, 11].forEach((e) => {
      mono(s, `N 10${sup(e)}`, F.X(e), F.b + 3.6 * s.u, { size: 3, k: 'blue' });
      s.alpha(s.ease('budget', 0.6, 2), () => mono(s, `D 2×10${sup(21 - e)}`, F.X(e), F.b + 7.6 * s.u, { size: 3, k: 'orange' }));
    });
    // The curve and the runs on it.
    const reveal = s.ease('sizes', 2.4, 0.8);
    s.alpha(s.ease('sizes', 0.6), () => {
      const c = s.ctx;
      c.beginPath();
      const n = 80;
      for (let i = 0; i <= n * reveal; i++) {
        const x = 8.4 + (3.2 * i) / n;
        if (i) c.lineTo(F.X(x), F.Y(loss(x)));
        else c.moveTo(F.X(x), F.Y(loss(x)));
      }
      c.strokeStyle = s.tint('red', 0.75);
      c.lineWidth = 0.5 * s.u;
      c.stroke();
      for (const x of SIZES) if ((x - 8.4) / 3.2 <= reveal + 0.01) s.circle(F.X(x), F.Y(loss(x)), 1.3 * s.u, { fill: s.c('red'), stroke: s.c('--card'), lw: 0.35 });
    });
    s.alpha(s.win('trade', 'small'), () => mono(s, 'N × 10, D ÷ 10', s.w / 2, s.h * 0.12, { size: 3.4, k: 'orange', weight: 650, halo: true }));
    s.alpha(s.ease('trade', 0.6, 1), () => [9, 10].forEach((e) => s.rrect(F.X(e) - 9 * s.u, F.b + 1.2 * s.u, 18 * s.u, 8.6 * s.u, 1, { stroke: s.tint('orange', 0.6 * (1 - s.ease('small', 0.6))), lw: 0.3 })));
    s.alpha(s.ease('small', 0.6), () => mono(s, 'too small', F.X(8.75), F.Y(loss(8.6)) + 1 * s.u, { size: 3.4, k: '--ink-2', align: 'left', halo: true }));
    s.alpha(s.ease('big', 0.6), () => {
      mono(s, 'too big:', F.X(11.25), F.Y(loss(11.4)) - 1 * s.u, { size: 3.4, k: '--ink-2', align: 'right', halo: true });
      mono(s, 'too few tokens', F.X(11.25), F.Y(loss(11.4)) + 3.4 * s.u, { size: 3.4, k: '--ink-2', align: 'right', halo: true });
    });
    s.alpha(s.ease('best', 0.6), () => {
      const x = F.X(10);
      const y = F.Y(loss(10));
      const ty = F.t + 8 * s.u;
      s.circle(x, y, 2.6 * s.u, { stroke: s.c('green'), lw: 0.6 });
      s.line(x, ty + 6 * s.u, x, y - 3.2 * s.u, s.tint('green', 0.7), 0.35, [1, 0.8]);
      mono(s, '10¹⁰ parameters', x, ty - 2 * s.u, { size: 3.4, k: 'green', weight: 650, halo: true });
      mono(s, '2 × 10¹¹ tokens: 20 each', x, ty + 2.4 * s.u, { size: 3.4, k: 'green', weight: 650, halo: true });
    });
  },
};

const MODELS: { beat: string; ratio: number; label: string; note: string; k: 'red' | 'green' | 'blue' }[] = [
  { beat: 'under', ratio: 300 / 175, label: '175B on 300B', note: '1.7', k: 'red' },
  { beat: 'opt', ratio: 20, label: '70B on 1.4T', note: '20', k: 'green' },
  { beat: 'over', ratio: 1875, label: '8B on 15T', note: '1,875', k: 'blue' },
];

const ratio: SceneDef = {
  draw(s) {
    const l = (s.tall ? 10 : 16) * s.u;
    const r = s.w - (s.tall ? 10 : 16) * s.u;
    const X = (v: number) => l + (Math.log10(v) / 4) * (r - l);
    const y = s.h * 0.62;
    s.line(l, y, r, y, s.c('--axis'), 0.4);
    [1, 10, 100, 1000, 10000].forEach((v) => {
      s.line(X(v), y - 1.2 * s.u, X(v), y + 1.2 * s.u, s.c('--axis'), 0.35);
      mono(s, v.toLocaleString('en-US'), X(v), y + 4.6 * s.u, { size: 3, k: '--ink-3' });
    });
    mono(s, 'tokens per parameter', s.w / 2, y + 10 * s.u, { size: 3.2, k: '--ink-2' });
    s.rrect(X(14), y - 3 * s.u, X(28) - X(14), 6 * s.u, 1, { fill: s.tint('green', 0.25) });
    s.alpha(s.ease('ratio', 0.6), () => mono(s, 'D / N vs 20', s.w / 2, s.h * 0.14, { size: 4, k: '--ink', weight: 650 }));
    MODELS.forEach((m, i) => {
      s.alpha(s.ease(m.beat, 0.6), () => {
        const x = X(m.ratio);
        const ty = s.h * (0.3 + (i % 2) * 0.1);
        s.line(x, ty + 4.8 * s.u, x, y - 2 * s.u, s.tint(m.k, 0.7), 0.35, [1, 0.8]);
        s.circle(x, y, 1.6 * s.u, { fill: s.c(m.k), stroke: s.c('--card'), lw: 0.4 });
        const align = i === 0 ? 'left' : i === 2 ? 'right' : 'center';
        const tx = i === 0 ? x - 3 * s.u : i === 2 ? x + 3 * s.u : x;
        mono(s, m.label, tx, ty - 1.6 * s.u, { size: 3.3, k: m.k, weight: 650, align });
        mono(s, `${m.note} per parameter`, tx, ty + 2 * s.u, { size: 3, k: '--ink-2', align });
      });
    });
    s.alpha(s.ease('under', 0.6, 2), () => mono(s, 'under-trained', X(1.7), y + 15 * s.u, { size: 3.2, k: 'red', align: 'left' }));
    s.alpha(s.ease('over', 0.6, 2), () => mono(s, 'past optimal', X(1875), y + 15 * s.u, { size: 3.2, k: 'blue', align: 'right' }));
  },
};

const ratioAxis = (s: Scene, y: number) => {
  const l = (s.tall ? 10 : 16) * s.u;
  const r = s.w - (s.tall ? 10 : 16) * s.u;
  const X = (v: number) => l + (Math.log10(v) / 4) * (r - l);
  s.line(l, y, r, y, s.c('--axis'), 0.4);
  [1, 10, 100, 1000, 10000].forEach((v) => {
    s.line(X(v), y - 1.2 * s.u, X(v), y + 1.2 * s.u, s.c('--axis'), 0.35);
    mono(s, v.toLocaleString('en-US'), X(v), y + 4.6 * s.u, { size: 3, k: '--ink-3' });
  });
  s.rrect(X(14), y - 3 * s.u, X(28) - X(14), 6 * s.u, 1, { fill: s.tint('green', 0.25) });
  return X;
};

/** Two worked models: 8B on 1.6T judged by its ratio, then the tokens for a compute-optimal 30B. */
const tryIt: SceneDef = {
  marks: {
    a0: { tex: String.raw`\sym{Nparams}{N} = 8\ \text{billion},\quad \sym{Dtokens}{D} = 1.6\ \text{trillion}`, x: 0.5, y: 0.1, size: 4.6 },
    a1: { tex: String.raw`1.6\ \text{trillion} = 1{,}600\ \text{billion}`, x: 0.5, y: 0.24, size: 4.2 },
    a2: { tex: String.raw`\sym{Dtokens}{D} / \sym{Nparams}{N} = 1{,}600 / 8 = 200\ \text{per parameter}`, x: 0.5, y: 0.35, size: 4.2 },
    a3: { tex: String.raw`\text{far above 20: well past compute-optimal}`, x: 0.5, y: 0.46, size: 4.2 },
    b0: { tex: String.raw`\sym{Nparams}{N} = 30\ \text{billion, compute-optimal:}\ \ \sym{Dtokens}{D} = \,?`, x: 0.5, y: 0.1, size: 4.6 },
    b1: { tex: String.raw`\sym{Dtokens}{D} = 20\,\sym{Nparams}{N} = 20 \times 30\ \text{billion}`, x: 0.5, y: 0.24, size: 4.2 },
    b2: { tex: String.raw`= 600\ \text{billion tokens}`, x: 0.5, y: 0.35, size: 4.6 },
  },
  draw(s) {
    const second = s.ease('p2', 0.6);
    const a = 1 - second;
    s.show('a0', a);
    s.show('a1', a * s.ease('r1', 0.6));
    s.show('a2', a * s.ease('r1', 0.6, 3));
    s.show('a3', a * s.ease('v1', 0.6));
    s.show('b0', second);
    s.show('b1', s.ease('r2', 0.6));
    s.show('b2', s.ease('r2', 0.6, 3));
    const y = s.h * 0.72;
    s.alpha(a * s.ease('p1', 0.6, 1), () => {
      const X = ratioAxis(s, y);
      mono(s, 'tokens per parameter', s.w / 2, y + 10 * s.u, { size: 3.2, k: '--ink-2' });
      s.alpha(s.ease('r1', 0.6, 4), () => {
        const x = X(1600 / 8);
        s.line(x, y - 9 * s.u, x, y - 2 * s.u, s.tint('blue', 0.7), 0.35, [1, 0.8]);
        s.circle(x, y, 1.6 * s.u, { fill: s.c('blue'), stroke: s.c('--card'), lw: 0.4 });
        mono(s, '8B on 1.6T: 200', x, y - 11.5 * s.u, { size: 3.3, k: 'blue', weight: 650 });
      });
      s.alpha(s.ease('v1', 0.6, 1), () => mono(s, 'past optimal', X(200), y + 15 * s.u, { size: 3.2, k: 'blue' }));
    });
    // 30 billion parameters, 20 tokens each.
    s.alpha(second, () => {
      const xs = [s.w / 2 - (s.tall ? 24 : 30) * s.u, s.w / 2 + (s.tall ? 24 : 30) * s.u];
      mono(s, 'N', xs[0]!, y - 9 * s.u, { size: 3.6, k: 'blue', weight: 650 });
      mono(s, 'D', xs[1]!, y - 9 * s.u, { size: 3.6, k: 'orange', weight: 650 });
      cells(s, [xs[0]!], y, ['30B'], 'blue', { w: 16, h: 8, size: 3.4 });
      s.arrow(xs[0]! + 9 * s.u, y, xs[1]! - 9 * s.u, y, s.c('--ink-3'), 0.35, 2);
      s.alpha(s.ease('r2', 0.6), () => mono(s, '× 20', s.w / 2, y + 4.4 * s.u, { size: 3.2, k: '--ink-2' }));
      const got = s.ease('r2', 0.6, 3);
      cells(s, [xs[1]!], y, [got > 0.5 ? '600B' : '?'], 'orange', { w: 16, h: 8, size: 3.4, on: [got] });
    });
  },
};

export const scenes: Record<string, SceneDef> = { valley, ratio, try: tryIt };

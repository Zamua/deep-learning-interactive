import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { cells } from '../../draw';
import { mono } from '../draw';

const ALPHA = 0.1;
/** log10 of the loss at log10 compute c: 0.6 at 10^18, falling 0.1 per power of ten. */
const logL = (c: number) => 0.6 - ALPHA * (c - 18);
const RUNS = [18, 18.5, 19, 19.5, 20, 20.5, 21];
const CURVE = Array.from({ length: 121 }, (_, i) => 17.9 + (i / 120) * 3.2);
const sup = (n: number) => String(n).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]!);

/** The plot box: left, top, right, bottom in px. */
function box(s: Scene, top: number) {
  return { l: (s.tall ? 14 : 16) * s.u, t: s.h * top, r: s.w - 8 * s.u, b: s.h - 12 * s.u };
}

/** Where (log10 C, log10 L) lands, between ordinary axes (t = 0) and log-log axes (t = 1). */
function place(s: Scene, top: number, c: number, l: number, t: number): [number, number] {
  const B = box(s, top);
  const xLin = B.l + (10 ** c / 1e21) * (B.r - B.l) * 0.92 + 2 * s.u;
  const xLog = B.l + ((c - 17.8) / 3.4) * (B.r - B.l);
  const yLin = B.b - ((10 ** l - 1.6) / (4.4 - 1.6)) * (B.b - B.t);
  const yLog = B.b - ((l - 0.22) / (0.66 - 0.22)) * (B.b - B.t);
  return [lerp(xLin, xLog, t), lerp(yLin, yLog, t)];
}

function axesBox(s: Scene, top: number, a = 1): void {
  const B = box(s, top);
  s.alpha(a, () => {
    s.line(B.l, B.b, B.r, B.b, s.c('--axis'), 0.35);
    s.line(B.l, B.b, B.l, B.t, s.c('--axis'), 0.35);
  });
}

function curve(s: Scene, top: number, t: number, upto = 1, k: 'purple' | 'red' = 'purple'): void {
  const c = s.ctx;
  const B = box(s, top);
  c.save();
  c.beginPath();
  c.rect(B.l, B.t - 2 * s.u, B.r - B.l, B.b - B.t + 2 * s.u);
  c.clip();
  c.beginPath();
  const n = Math.max(1, Math.round(CURVE.length * upto));
  CURVE.slice(0, n).forEach((x, i) => {
    const [px, py] = place(s, top, x, logL(x), t);
    if (i) c.lineTo(px, py);
    else c.moveTo(px, py);
  });
  c.strokeStyle = s.c(k);
  c.lineWidth = 0.6 * s.u;
  c.lineJoin = 'round';
  c.stroke();
  c.restore();
}

const runs: SceneDef = {
  draw(s) {
    const top = 0.1;
    const t = s.ease('log', 1.6, 0.6);
    const B = box(s, top);
    axesBox(s, top);
    s.alpha(s.ease('flat', 0.8), () => curve(s, top, t, s.ease('flat', 1.4)));
    RUNS.forEach((c, i) => {
      s.alpha(s.ease('runs', 0.5, 1 + i * 0.35), () => {
        const [x, y] = place(s, top, c, logL(c), t);
        s.circle(x, y, 1.4 * s.u, { fill: s.c('purple'), stroke: s.c('--card'), lw: 0.35 });
      });
    });
    // Ticks: ordinary ones fade out as the log ones fade in.
    s.alpha(1 - t, () => {
      mono(s, '0', place(s, top, 0, 0, 0)[0], B.b + 3.6 * s.u, { size: 3, k: '--ink-3' });
      mono(s, '5×10²⁰', place(s, top, Math.log10(5e20), 0, 0)[0], B.b + 3.6 * s.u, { size: 3, k: '--ink-3' });
      mono(s, '10²¹', place(s, top, 21, 0, 0)[0], B.b + 3.6 * s.u, { size: 3, k: '--ink-3' });
    });
    s.alpha(t, () => [18, 19, 20, 21].forEach((c) => mono(s, `10${sup(c)}`, place(s, top, c, 0, 1)[0], B.b + 3.6 * s.u, { size: 3, k: '--ink-3' })));
    [2, 3, 4].forEach((L) => mono(s, String(L), B.l - 2 * s.u, place(s, top, 18, Math.log10(L), t)[1], { size: 3, k: '--ink-3', align: 'right' }));
    mono(s, 'compute C, FLOPs', B.r, B.b + 8 * s.u, { size: 3.2, k: 'purple', align: 'right', weight: 650 });
    mono(s, 'loss L', B.l + 2 * s.u, B.t, { size: 3.2, k: 'red', align: 'left', weight: 650 });
    s.alpha(s.win('flat', 'log'), () => mono(s, 'steep, then flat', B.l + (B.r - B.l) * 0.55, B.t + (B.b - B.t) * 0.3, { size: 3.4, k: '--ink-2', halo: true }));
    s.alpha(s.ease('line', 0.6), () => mono(s, 'a straight line', B.l + (B.r - B.l) * 0.62, B.t + (B.b - B.t) * 0.22, { size: 3.6, k: 'green', weight: 650, halo: true }));
  },
};

const why: SceneDef = {
  marks: {
    law: { tex: String.raw`\symL = a\,\sym{Cflops}{C}^{-\sym{alpha}{\alpha}}`, x: 0.5, y: 0.08, size: 5.4 },
    line: { tex: String.raw`\log \symL = \log a - \sym{alpha}{\alpha} \log \sym{Cflops}{C}`, x: 0.5, y: 0.19, size: 5 },
  },
  draw(s) {
    const top = 0.32;
    const B = box(s, top);
    s.show('law', s.ease('law', 0.6));
    s.show('line', s.ease('power', 0.6, 1.5));
    axesBox(s, top);
    curve(s, top, 1, 1, 'purple');
    RUNS.filter((c) => Number.isInteger(c)).forEach((c) => {
      const [x, y] = place(s, top, c, logL(c), 1);
      s.circle(x, y, 1.3 * s.u, { fill: s.c('purple'), stroke: s.c('--card'), lw: 0.35 });
    });
    [18, 19, 20, 21].forEach((c) => mono(s, String(c), place(s, top, c, 0, 1)[0], B.b + 3.6 * s.u, { size: 3, k: '--ink-3' }));
    [0.3, 0.4, 0.5, 0.6].forEach((l) => mono(s, l.toFixed(1), B.l - 2 * s.u, place(s, top, 18, l, 1)[1], { size: 3, k: '--ink-3', align: 'right' }));
    mono(s, 'log₁₀ C', B.r, B.b + 8 * s.u, { size: 3.2, k: 'purple', align: 'right', weight: 650 });
    mono(s, 'log₁₀ L', B.l + 2 * s.u, B.t - 1 * s.u, { size: 3.2, k: 'red', align: 'left', weight: 650 });
    s.alpha(s.win('logs', 'line'), () => mono(s, 'log₁₀ 10²⁰ = 20', B.l + (B.r - B.l) * 0.62, B.t + (B.b - B.t) * 0.3, { size: 3.6, k: '--ink-2', halo: true }));
    s.alpha(s.ease('line', 0.6) * (1 - s.ease('slope', 0.5)), () => mono(s, 'slope −α', B.l + (B.r - B.l) * 0.62, B.t + (B.b - B.t) * 0.3, { size: 3.8, k: 'green', weight: 650, halo: true }));
    // The slope triangle between the runs at 10^18 and 10^20.
    const k = s.ease('slope', 0.8, 0.8);
    s.alpha(k, () => {
      const [x0, y0] = place(s, top, 18, logL(18), 1);
      const [x1, y1] = place(s, top, 20, logL(20), 1);
      s.line(x0, y0, x1, y0, s.c('slate'), 0.4, [1.2, 0.8]);
      s.line(x1, y0, x1, y1, s.c('slate'), 0.4, [1.2, 0.8]);
      mono(s, 'run 2', (x0 + x1) / 2, y0 - 3 * s.u, { size: 3.2, k: 'slate', halo: true });
      mono(s, 'rise −0.2', x1 + 2 * s.u, (y0 + y1) / 2, { size: 3.2, k: 'slate', align: 'left', halo: true });
      s.circle(x0, y0, 1.6 * s.u, { stroke: s.c('green'), lw: 0.5 });
      s.circle(x1, y1, 1.6 * s.u, { stroke: s.c('green'), lw: 0.5 });
    });
    s.alpha(s.ease('slope', 0.6, 4), () => mono(s, 'slope = −0.2 / 2 = −0.1', B.l + (B.r - B.l) * 0.6, B.b - 6 * s.u, { size: 3.6, k: 'green', weight: 650, halo: true }));
  },
};

const LOSS = [3.98, 3.16, 2.51, 2.0];

const tenfold: SceneDef = {
  marks: {
    f: { tex: String.raw`10^{-\sym{alpha}{\alpha}} = 10^{-0.1} \approx 0.79`, x: 0.5, y: 0.12, size: 5.2 },
  },
  draw(s) {
    s.show('f', s.ease('step', 0.6, 2));
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
    s.alpha(s.ease('hundred', 0.6, 1), () => {
      const y = yL + 20 * s.u;
      s.arrow(xs[1]! + 2 * s.u, y, xs[3]! - 2 * s.u, y, s.c('green'), 0.45, 2.4);
      mono(s, '× 0.79² ≈ 0.63', (xs[1]! + xs[3]!) / 2, y + 4 * s.u, { size: 3.4, k: 'green', weight: 650 });
    });
    s.alpha(s.ease('cost', 0.6), () => mono(s, 'same fraction off: 10× the compute each time', s.w / 2, s.h * 0.88, { size: s.tall ? 3 : 3.4, k: '--ink-2' }));
  },
};

export const scenes: Record<string, SceneDef> = { runs, why, tenfold };

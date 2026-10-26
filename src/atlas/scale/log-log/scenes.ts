import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
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

/** Log-log axes with whole-power ticks, the fitted line and the runs at whole powers. */
function logAxes(s: Scene, top: number, dots = true): void {
  const B = box(s, top);
  axesBox(s, top);
  curve(s, top, 1, 1, 'purple');
  if (dots)
    RUNS.filter((c) => Number.isInteger(c)).forEach((c) => {
      const [x, y] = place(s, top, c, logL(c), 1);
      s.circle(x, y, 1.3 * s.u, { fill: s.c('purple'), stroke: s.c('--card'), lw: 0.35 });
    });
  [18, 19, 20, 21].forEach((c) => mono(s, String(c), place(s, top, c, 0, 1)[0], B.b + 3.6 * s.u, { size: 3, k: '--ink-3' }));
  [0.3, 0.4, 0.5, 0.6].forEach((l) => mono(s, l.toFixed(1), B.l - 2 * s.u, place(s, top, 18, l, 1)[1], { size: 3, k: '--ink-3', align: 'right' }));
  mono(s, 'log₁₀ C', B.r, B.b + 8 * s.u, { size: 3.2, k: 'purple', align: 'right', weight: 650 });
  mono(s, 'log₁₀ L', B.l + 2 * s.u, B.t - 1 * s.u, { size: 3.2, k: 'red', align: 'left', weight: 650 });
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
    pow: { tex: String.raw`\log \sym{Cflops}{C}^{-\sym{alpha}{\alpha}} = -\sym{alpha}{\alpha} \log \sym{Cflops}{C}`, x: 0.5, y: 0.19, size: 5 },
    line: { tex: String.raw`\log \symL = \log a - \sym{alpha}{\alpha} \log \sym{Cflops}{C}`, x: 0.5, y: 0.19, size: 5 },
  },
  draw(s) {
    const top = 0.32;
    const B = box(s, top);
    s.show('law', s.ease('law', 0.6));
    s.show('pow', s.win('minus', 'line'));
    s.show('line', s.ease('line', 0.6));
    logAxes(s, top);
    s.alpha(s.win('logs', 'power'), () => mono(s, 'log₁₀ 10²⁰ = 20', B.l + (B.r - B.l) * 0.62, B.t + (B.b - B.t) * 0.3, { size: 3.6, k: '--ink-2', halo: true }));
    // A power becomes a multiple, first on whole numbers, then on the law's own power.
    const note = (a: number, l1: string, l2: string) =>
      s.alpha(a, () => {
        mono(s, l1, B.l + (B.r - B.l) * 0.62, B.t + (B.b - B.t) * 0.12, { size: 3.4, k: '--ink-2', halo: true });
        mono(s, l2, B.l + (B.r - B.l) * 0.62, B.t + (B.b - B.t) * 0.26, { size: 3.4, k: 'green', weight: 650, halo: true });
      });
    note(s.win('power', 'minus'), '(10³)² = 10³ × 10³', 'log: 3 + 3 = 6 = 2 × 3');
    note(s.win('minus', 'line'), 'C = 10²⁰, α = 0.1', 'log: −0.1 × 20 = −2');
    s.alpha(s.win('line', 'height'), () => mono(s, 'slope −α', B.l + (B.r - B.l) * 0.62, B.t + (B.b - B.t) * 0.3, { size: 3.8, k: 'green', weight: 650, halo: true }));
    // The height: log a = 2.4 puts the run at 10^20 at 0.4.
    note(s.ease('height', 0.6), 'log a = 2.4', 'at 10²⁰: 2.4 − 2 = 0.4');
    s.alpha(s.ease('height', 0.6, 2.5), () => {
      const [x, y] = place(s, top, 20, logL(20), 1);
      s.circle(x, y, 2.2 * s.u, { stroke: s.c('green'), lw: 0.5 });
      s.line(x, y + 2.4 * s.u, x, B.b, s.tint('green', 0.6), 0.3, [1, 0.8]);
    });
  },
};

const tryIt: SceneDef = {
  draw(s) {
    const top = 0.36;
    const B = box(s, top);
    const o = { size: s.tall ? 3.3 : 3.7 } as const;
    mono(s, 'C = 10¹⁸: L = 3.98    C = 10²¹: L = 2.00', s.w / 2, s.h * 0.07, { ...o, k: '--ink', weight: 650 });
    s.alpha(s.ease('p', 0.6, 4), () => mono(s, 'log 3.98 ≈ 0.6    log 2 ≈ 0.3', s.w / 2, s.h * 0.14, { ...o, k: '--ink-2' }));
    s.alpha(s.ease('pts', 0.6, 1), () => mono(s, 'points (18, 0.6) and (21, 0.3)', s.w / 2, s.h * 0.22, { ...o, k: 'purple', weight: 650 }));
    s.alpha(s.ease('slope', 0.6), () => mono(s, 'slope = −0.3 / 3 = −0.1', s.w / 2, s.h * 0.29, { ...o, size: o.size + 0.3, k: 'green', weight: 650 }));
    s.alpha(s.ease('p', 0.6, 1), () => logAxes(s, top, false));
    const [x0, y0] = place(s, top, 18, logL(18), 1);
    const [x1, y1] = place(s, top, 21, logL(21), 1);
    s.alpha(s.ease('pts', 0.6, 1), () => {
      s.circle(x0, y0, 1.7 * s.u, { fill: s.c('purple'), stroke: s.c('--card'), lw: 0.35 });
      s.circle(x1, y1, 1.7 * s.u, { fill: s.c('purple'), stroke: s.c('--card'), lw: 0.35 });
    });
    // The slope triangle: run along the bottom, rise down the right.
    s.alpha(s.ease('rise', 0.7), () => {
      s.line(x0, y0, x1, y0, s.c('slate'), 0.4, [1.2, 0.8]);
      mono(s, 'run 21 − 18 = 3', (x0 + x1) / 2, y0 - 3 * s.u, { size: 3.2, k: 'slate', halo: true });
    });
    s.alpha(s.ease('rise', 0.7, 2.5), () => {
      s.line(x1, y0, x1, y1, s.c('slate'), 0.4, [1.2, 0.8]);
      mono(s, 'rise', x1 - 2 * s.u, y0 + 5 * s.u, { size: 3.2, k: 'slate', align: 'right', halo: true });
      mono(s, '0.3 − 0.6 = −0.3', x1 - 2 * s.u, y0 + 9 * s.u, { size: 3.2, k: 'slate', align: 'right', halo: true });
    });
  },
};

export const scenes: Record<string, SceneDef> = { runs, why, try: tryIt };

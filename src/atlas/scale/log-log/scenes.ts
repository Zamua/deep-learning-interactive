import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { mono } from '../draw';

const ALPHA = 0.1;
const LOG_A = 2.4;
/** log10 of the loss at log10 compute c: 0.6 at 10^18, falling 0.1 per power of ten. */
const logL = (c: number) => LOG_A - ALPHA * c;
/** The small runs, then the big one at 10^21. */
const SMALL = [18, 18.5, 19, 19.5, 20];
const BIG = 21;
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

function axesBox(s: Scene, top: number): void {
  const B = box(s, top);
  s.line(B.l, B.b, B.r, B.b, s.c('--axis'), 0.35);
  s.line(B.l, B.b, B.l, B.t, s.c('--axis'), 0.35);
}

/** A polyline through (c, f(c)) for c in [c0, c1], clipped to the plot box. */
function path(s: Scene, top: number, f: (c: number) => number, c0: number, c1: number, t: number, k: Ink, dash?: number[]): void {
  if (c1 <= c0) return;
  const g = s.ctx;
  const B = box(s, top);
  g.save();
  g.beginPath();
  g.rect(B.l, B.t, B.r - B.l, B.b - B.t);
  g.clip();
  g.beginPath();
  for (let i = 0; i <= 120; i++) {
    const c = c0 + ((c1 - c0) * i) / 120;
    const [x, y] = place(s, top, c, f(c), t);
    if (i) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.strokeStyle = s.c(k);
  g.lineWidth = 0.6 * s.u;
  g.lineJoin = 'round';
  g.setLineDash(dash ? dash.map((d) => d * s.u) : []);
  g.stroke();
  g.restore();
}

function run(s: Scene, x: number, y: number, r = 1.4, k: Ink = 'purple'): void {
  s.circle(x, y, r * s.u, { fill: s.c(k), stroke: s.c('--card'), lw: 0.35 });
}

/** A centered caption line at the top of the stage. */
function cap(s: Scene, text: string, y: number, a: number, k: Ink = '--ink-2', size = 3.5): void {
  s.alpha(a, () => mono(s, text, s.w / 2, y, { size, k, weight: 600, halo: true }));
}

/** Who found it, and when: small, at the top right of the plot. */
function cite(s: Scene, text: string, a: number, x: number, y: number) {
  s.alpha(a, () => s.text(text, x, y, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

const P_TOP = 0.17;

const predict: SceneDef = {
  draw(s) {
    const top = P_TOP;
    const t = s.ease('log', 1.6, 0.6);
    const B = box(s, top);
    const r1 = s.h * 0.05;
    const r2 = s.h * 0.105;
    axesBox(s, top);
    // The big run: a slot at 10^21 whose loss is unknown until the line reaches it.
    const [bx] = place(s, top, BIG, 0, t);
    const known = s.ease('read', 0.6, 2.4);
    s.alpha(1 - known, () => {
      s.line(bx, B.b, bx, B.t + 6 * s.u, s.tint('slate', 0.7), 0.35, [1, 0.8]);
      mono(s, '?', bx, B.t + 3.5 * s.u, { size: 4.4, k: 'slate', weight: 700 });
      mono(s, 'big run', bx - 3 * s.u, B.t + 3.5 * s.u, { size: 3.2, k: 'slate', align: 'right', halo: true });
    });
    // The small runs and the curve through them.
    s.alpha(s.ease('flat', 0.8), () => path(s, top, logL, 17.9, 20, t, 'purple'));
    SMALL.forEach((c, i) => {
      s.alpha(s.ease('dots', 0.5, 1 + i * 0.3), () => {
        const [x, y] = place(s, top, c, logL(c), t);
        run(s, x, y);
      });
    });
    // The ruler: the line carried on to ten times the compute.
    const ext = s.ease('read', 1.6, 0.4);
    s.alpha(s.ease('read', 0.4, 0.4), () => path(s, top, logL, 20, 20 + 1.25 * ext, t, 'purple', [1.4, 1]));
    s.alpha(known, () => {
      const [x, y] = place(s, top, BIG, logL(BIG), t);
      run(s, x, y, 1.8, 'green');
      mono(s, 'L ≈ 2', x - 2 * s.u, y + 5 * s.u, { size: 3.4, k: 'green', align: 'right', weight: 650, halo: true });
    });
    // Ticks: ordinary ones fade out as the log ones fade in.
    s.alpha(1 - t, () => {
      mono(s, '0', place(s, top, 0, 0, 0)[0], B.b + 3.6 * s.u, { size: 3, k: '--ink-3' });
      mono(s, '5×10²⁰', place(s, top, Math.log10(5e20), 0, 0)[0], B.b + 3.6 * s.u, { size: 3, k: '--ink-3' });
      mono(s, '10²¹', place(s, top, 21, 0, 0)[0], B.b + 3.6 * s.u, { size: 3, k: '--ink-3' });
    });
    s.alpha(t, () => [18, 19, 20, 21].forEach((c) => mono(s, `10${sup(c)}`, place(s, top, c, 0, 1)[0], B.b + 3.6 * s.u, { size: 3, k: '--ink-3' })));
    s.alpha(s.ease('dots', 0.6), () => {
      [2, 3, 4].forEach((L) => mono(s, String(L), B.l - 2 * s.u, place(s, top, 18, Math.log10(L), t)[1], { size: 3, k: '--ink-3', align: 'right' }));
      mono(s, 'loss L', B.l + 2 * s.u, B.t - 2 * s.u, { size: 3.2, k: 'red', align: 'left', weight: 650 });
    });
    const xl = s.ease('flops', 0.6) > 0.5 ? 'compute C, FLOPs' : 'compute C';
    s.alpha(s.ease('compute', 0.6), () => mono(s, xl, B.r, B.b + 8 * s.u, { size: 3.2, k: 'purple', align: 'right', weight: 650 }));
    // One caption at a time across the top.
    cap(s, 'the big run: what loss will it reach?', r1, s.win('cost', 'compute'));
    cap(s, 'C: all the arithmetic of training', r1, s.win('compute', 'flops'), 'purple');
    cap(s, '1 FLOP: one multiply or one add', r1, s.win('flops', 'dots'), 'purple');
    cap(s, 'small runs first: final loss L', r1, s.win('dots', 'flat'), 'red');
    cap(s, 'steep, then flat', r1, s.win('flat', 'log'));
    cap(s, 'each step right: 10 × the compute', r1, s.win('log', 'line'));
    cap(s, 'a straight line: a scaling law', r1, s.win('line', 'read'), 'purple');
    cap(s, 'read off the big run: L ≈ 2', r1, s.win('read', 'found'), 'green');
    s.alpha(s.ease('found', 0.6), () => {
      s.text('Deep Learning Scaling is Predictable, Empirically', s.w / 2, r1, { size: s.tall ? 3.3 : 3.6, italic: true, color: s.c('--ink'), halo: true });
      cite(s, 'Hestness et al., 2017', 1, s.w / 2 + s.measure('Hestness et al., 2017', { size: 3.1, italic: true }) / 2, r2);
    });
  },
};

const W_TOP = 0.31;

/** The line's slope and height at time t: steady, except while a beat turns or slides it. */
function knobs(s: Scene): { alpha: number; la: number; moving: number } {
  const turn = s.since('alpha') >= 0 && s.since('height') < 0 ? Math.sin(s.prog('alpha') * Math.PI * 2) : 0;
  const slide = s.since('height') >= 0 && s.since('shift') < 0 ? Math.sin(s.prog('height') * Math.PI * 2) : 0;
  const alpha = ALPHA + 0.05 * turn;
  // Turning pivots on the middle of the runs, at 10^19.5.
  const la = logL(19.5) + alpha * 19.5 + 0.1 * slide;
  return { alpha, la, moving: s.win('alpha', 'shift') };
}

/** The two rows, y = m x + b over its log-log reading, set in shared columns so each term sits under its match. */
function rows(s: Scene, y1: number, y2: number, a1: number, a2: number, toAlpha: number, toLogA: number): void {
  const size = s.tall ? 4.2 : 4.6;
  const o = { size, font: 'mono' as const, weight: 650 };
  const cols: { top: [string, Ink]; bot: [string, Ink][] }[] = [
    { top: ['y', '--ink-2'], bot: [['log L', 'red']] },
    { top: [' = ', '--ink-3'], bot: [[' = ', '--ink-3']] },
    { top: ['m', 'teal'], bot: [['m', 'teal'], ['−α', 'teal']] },
    { top: [' x', '--ink-2'], bot: [[' log C', 'purple']] },
    { top: [' + ', '--ink-3'], bot: [[' + ', '--ink-3']] },
    { top: ['b', 'green'], bot: [['b', 'green'], ['log a', 'green']] },
  ];
  const widths = cols.map((c) => Math.max(s.measure(c.top[0], o), ...c.bot.map(([t]) => s.measure(t, o))));
  let x = s.w / 2 - widths.reduce((p, q) => p + q, 0) / 2;
  cols.forEach((c, i) => {
    const cx = x + widths[i]! / 2;
    s.alpha(a1, () => s.text(c.top[0], cx, y1, { ...o, color: s.c(c.top[1]) }));
    const swap = i === 2 ? toAlpha : i === 5 ? toLogA : 0;
    c.bot.forEach(([t, k], j) => {
      const a = c.bot.length === 1 ? 1 : j === 0 ? 1 - swap : swap;
      s.alpha(a2 * a, () => s.text(t, cx, y2, { ...o, color: s.c(k) }));
    });
    x += widths[i]!;
  });
}

const why: SceneDef = {
  marks: {
    law: { tex: String.raw`\symL = a\,\sym{Cflops}{C}^{-\sym{alpha}{\alpha}}`, x: 0.5, y: 0.06, size: 5.2 },
    undo: { tex: String.raw`\log a - \sym{alpha}{\alpha} \log \sym{Cflops}{C} = \log\,(a\,\sym{Cflops}{C}^{-\sym{alpha}{\alpha}})`, x: 0.5, y: 0.215, size: 4.3 },
  },
  draw(s) {
    const top = W_TOP;
    const B = box(s, top);
    const r1 = s.h * 0.06;
    const r2 = s.h * 0.135;
    const r3 = s.h * 0.215;
    const K = knobs(s);
    const line = (c: number) => K.la - K.alpha * c;

    // Axes, with the tick labels turning into their logs.
    axesBox(s, top);
    const xt = s.ease('base', 0.8, 2.5);
    const yt = s.ease('ticks', 0.8, 1);
    [18, 19, 20, 21].forEach((c) => {
      const x = place(s, top, c, 0, 1)[0];
      s.alpha(1 - xt, () => mono(s, `10${sup(c)}`, x, B.b + 3.6 * s.u, { size: 3, k: '--ink-3' }));
      s.alpha(xt, () => mono(s, String(c), x, B.b + 3.6 * s.u, { size: 3, k: '--ink-3' }));
    });
    s.alpha(1 - xt, () => mono(s, 'compute C, FLOPs', B.r, B.b + 8 * s.u, { size: 3.2, k: 'purple', align: 'right', weight: 650 }));
    s.alpha(xt, () => mono(s, 'log₁₀ C', B.r, B.b + 8 * s.u, { size: 3.2, k: 'purple', align: 'right', weight: 650 }));
    [2, 3, 4].forEach((L) => s.alpha(1 - yt, () => mono(s, String(L), B.l - 2 * s.u, place(s, top, 18, Math.log10(L), 1)[1], { size: 3, k: '--ink-3', align: 'right' })));
    [0.3, 0.4, 0.5, 0.6].forEach((l) => s.alpha(yt, () => mono(s, l.toFixed(1), B.l - 2 * s.u, place(s, top, 18, l, 1)[1], { size: 3, k: '--ink-3', align: 'right' })));
    s.alpha(1 - yt, () => mono(s, 'loss L', B.l + 2 * s.u, B.t - 2 * s.u, { size: 3.2, k: 'red', align: 'left', weight: 650 }));
    s.alpha(yt, () => mono(s, 'log₁₀ L', B.l + 2 * s.u, B.t - 2 * s.u, { size: 3.2, k: 'red', align: 'left', weight: 650 }));

    // The runs, dimmed while the line is turned and slid away from them.
    s.alpha(1 - 0.65 * K.moving, () => [...SMALL, BIG].forEach((c) => {
      const [x, y] = place(s, top, c, logL(c), 1);
      run(s, x, y, 1.3);
    }));
    path(s, top, line, 17.9, 21.2, 1, 'purple');
    // A better model: the same slope, a lower line.
    s.alpha(s.win('shift', 'eq'), () => {
      const d = 0.07 * s.ease('shift', 1.2, 0.8);
      path(s, top, (c) => logL(c) - d, 17.9, 21.2, 1, 'green', [1.4, 1]);
      const [x, y] = place(s, top, 19.4, logL(19.4) - d, 1);
      mono(s, 'better model', x - 1 * s.u, y + 4.5 * s.u, { size: 3.2, k: 'green', align: 'right', weight: 650, halo: true });
    });

    // One power of ten across, a tenth down.
    s.alpha(s.win('slope', 'alpha'), () => {
      const [x0, y0] = place(s, top, 19, logL(19), 1);
      const [x1, y1] = place(s, top, 20, logL(20), 1);
      s.line(x0, y0, x1, y0, s.c('slate'), 0.4, [1.2, 0.8]);
      s.line(x1, y0, x1, y1, s.c('slate'), 0.4, [1.2, 0.8]);
      mono(s, '+1', (x0 + x1) / 2, y0 - 3 * s.u, { size: 3.2, k: 'slate', weight: 650, halo: true });
      mono(s, '−0.1', x1 + 2 * s.u, (y0 + y1) / 2, { size: 3.2, k: 'slate', align: 'left', weight: 650, halo: true });
    });

    // Read the run at 10^20: across to 20, up to the line, over to 0.4.
    s.alpha(s.ease('drop', 0.6), () => {
      const [x, y] = place(s, top, 20, logL(20), 1);
      s.line(x, B.b, x, y + 2 * s.u, s.c('purple'), 0.35, [1, 0.8]);
      s.circle(x, B.b + 3.6 * s.u, 2.6 * s.u, { stroke: s.c('purple'), lw: 0.4 });
      s.alpha(s.ease('read', 0.6, 1.5), () => {
        s.line(B.l, y, x - 2 * s.u, y, s.c('red'), 0.35, [1, 0.8]);
        s.circle(x, y, 2.2 * s.u, { stroke: s.c('green'), lw: 0.5 });
        s.circle(B.l - 4.6 * s.u, y, 3.8 * s.u, { stroke: s.c('red'), lw: 0.4 });
      });
    });

    // The equations above the plot.
    rows(s, r1, r2, s.win('school', 'undo'), s.win('school', 'eq'), s.ease('alpha', 0.6), s.ease('height', 0.6));
    s.alpha(s.ease('eq', 0.6), () => {
      const o = { size: s.tall ? 4.2 : 4.6, font: 'mono' as const, weight: 650 };
      const runs: [string, Ink][] = [['log L', 'red'], [' = ', '--ink-3'], ['log a', 'green'], [' − ', '--ink-3'], ['α', 'teal'], [' log C', 'purple']];
      const total = runs.reduce((p, [t]) => p + s.measure(t, o), 0);
      let x = s.w / 2 - total / 2;
      runs.forEach(([t, k]) => {
        s.text(t, x, r2, { ...o, align: 'left', color: s.c(k) });
        x += s.measure(t, o);
      });
    });
    s.show('law', s.ease('undo', 0.6, 4));

    // The caption row just above the plot.
    cap(s, 'log₁₀ 10²⁰ = 20', r3, s.win('base', 'ticks'), 'purple', 3.8);
    cap(s, 'log₁₀ 4 ≈ 0.6    log₁₀ 2 ≈ 0.3', r3, s.win('ticks', 'school'), 'red', 3.6);
    cap(s, 'm = −0.1', r3, s.win('slope', 'alpha'), 'teal', 3.8);
    cap(s, `α = ${K.alpha.toFixed(2)}`, r3, s.win('alpha', 'height'), 'teal', 3.8);
    cap(s, `log a = ${K.la.toFixed(2)}`, r3, s.win('height', 'shift'), 'green', 3.8);
    cap(s, 'better models: lower line, same slope', r3, s.win('shift', 'eq'), 'green', 3.4);
    s.show('undo', s.win('undo', 'power'));
    cap(s, 'C raised to a power: a power law', r3, s.win('power', 'drop'), 'purple', 3.6);
    cap(s, 'α × log C = 0.1 × 20 = 2', r3, s.win('drop', 'read'), 'teal', 3.8);
    cap(s, 'log L = 2.4 − 2 = 0.4', r3, s.ease('read', 0.6), 'red', 3.8);
    const cx = B.r - 1 * s.u;
    cite(s, 'Hestness et al., 2017', s.win('shift', 'eq'), cx, B.t + 2 * s.u);
    cite(s, 'Kaplan et al., 2020', s.win('kaplan', 'drop'), cx, B.t + 2 * s.u);
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
    s.alpha(s.ease('p', 0.6, 1), () => {
      axesBox(s, top);
      path(s, top, logL, 17.9, 21.2, 1, 'purple');
      [18, 19, 20, 21].forEach((c) => mono(s, String(c), place(s, top, c, 0, 1)[0], B.b + 3.6 * s.u, { size: 3, k: '--ink-3' }));
      [0.3, 0.4, 0.5, 0.6].forEach((l) => mono(s, l.toFixed(1), B.l - 2 * s.u, place(s, top, 18, l, 1)[1], { size: 3, k: '--ink-3', align: 'right' }));
      mono(s, 'log₁₀ C', B.r, B.b + 8 * s.u, { size: 3.2, k: 'purple', align: 'right', weight: 650 });
      mono(s, 'log₁₀ L', B.l + 2 * s.u, B.t - 1 * s.u, { size: 3.2, k: 'red', align: 'left', weight: 650 });
    });
    const [x0, y0] = place(s, top, 18, logL(18), 1);
    const [x1, y1] = place(s, top, 21, logL(21), 1);
    s.alpha(s.ease('pts', 0.6, 1), () => {
      run(s, x0, y0, 1.7);
      run(s, x1, y1, 1.7);
    });
    // The slope triangle: the rise down the right, then the run along the top.
    s.alpha(s.ease('rise', 0.7), () => {
      s.line(x1, y0, x1, y1, s.c('slate'), 0.4, [1.2, 0.8]);
      mono(s, 'rise', x1 - 2 * s.u, y0 + 5 * s.u, { size: 3.2, k: 'slate', align: 'right', halo: true });
      mono(s, '0.3 − 0.6 = −0.3', x1 - 2 * s.u, y0 + 9 * s.u, { size: 3.2, k: 'slate', align: 'right', halo: true });
    });
    s.alpha(s.ease('run', 0.7), () => {
      s.line(x0, y0, x1, y0, s.c('slate'), 0.4, [1.2, 0.8]);
      mono(s, 'run 21 − 18 = 3', (x0 + x1) / 2, y0 - 3 * s.u, { size: 3.2, k: 'slate', halo: true });
    });
  },
};

export const scenes: Record<string, SceneDef> = { predict, why, try: tryIt };

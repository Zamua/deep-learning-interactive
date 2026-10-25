import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../../lecture/scene';
import { Frame, inset, note } from '../draw';

const f = (x: number) => x * x;
const f2 = (v: number) => v.toFixed(2);

/** The frame for scenes on f(x) = x² near x = 1. */
const nearOne = (s: Scene) => new Frame(s, inset(s, 0.06, 0.07, 0.07), [-0.6, 2.7, -0.6, 6.3]);

/** A run then rise triangle under a secant from (x0, f(x0)) to (x1, f(x1)). */
function stepTriangle(s: Scene, F: Frame, x0: number, x1: number, run: string, rise: string, a: number) {
  s.alpha(a, () => {
    F.seg(x0, f(x0), x1, f(x0), '--ink-3', 0.4, [1.2, 1]);
    F.seg(x1, f(x0), x1, f(x1), '--ink-3', 0.4, [1.2, 1]);
    s.text(run, (F.X(x0) + F.X(x1)) / 2, F.Y(f(x0)) + 3.6 * s.u, { size: 3.4, font: 'mono', color: s.c('--ink-2'), halo: true });
    s.text(rise, F.X(x1) + 2 * s.u, (F.Y(f(x0)) + F.Y(f(x1))) / 2, { size: 3.4, font: 'mono', align: 'left', color: s.c('--ink-2'), halo: true });
  });
}

const slope: SceneDef = {
  draw(s) {
    const F = nearOne(s);
    F.axes();
    // A line first: one slope everywhere.
    const lA = s.win('line', 'curve');
    s.alpha(lA, () => {
      F.fn((x) => 2 * x + 1, '--ink-2', 0.7);
      F.seg(0.5, 2, 1.5, 2, '--ink-3', 0.4, [1.2, 1]);
      F.seg(1.5, 2, 1.5, 4, '--ink-3', 0.4, [1.2, 1]);
      s.text('1', F.X(1), F.Y(2) + 3.6 * s.u, { size: 3.6, font: 'mono', color: s.c('--ink-2'), halo: true });
      s.text('2', F.X(1.5) + 2 * s.u, F.Y(3), { size: 3.6, font: 'mono', align: 'left', color: s.c('--ink-2'), halo: true });
      note(s, F, 'slope 2, everywhere', 0);
    });
    const cA = s.ease('curve', 0.7);
    s.alpha(cA, () => {
      F.fn(f, 'purple', 0.8);
      F.dot(1, 1, 'purple');
      s.text('f(x) = x²', F.X(Math.sqrt(5.4)) - 3 * s.u, F.Y(5.4), { size: 3.8, font: 'mono', weight: 600, align: 'right', color: s.c('purple'), halo: true });
    });
    const tick = (x: number, a: number) => s.alpha(a, () => s.text(String(x), F.X(x), F.Y(0) + 3.4 * s.u, { size: 3.2, font: 'mono', color: s.c('--ink-3'), halo: true }));
    tick(1, cA);
    tick(2, s.ease('two', 0.6));
    const tA = s.ease('two', 0.7);
    s.alpha(tA, () => {
      F.tangent(1, 1, 3, 'gold', -0.6, 2.7);
      F.dot(2, 4, 'purple');
    });
    stepTriangle(s, F, 1, 2, 'h = 1', 'rise 3', s.ease('two', 0.6, 0.6));
    s.alpha(s.ease('rise', 0.6), () => note(s, F, 'slope = 3 / 1 = 3', 0, 'gold'));
  },
};

/** h on a log scale: 1, then 0.5 and 0.1 during "shrink", then toward 0 during "limit". */
function hAt(s: Scene): number {
  const p = s.prog('shrink');
  const q = s.prog('limit');
  const l = (a: number, b: number, t: number) => Math.exp(lerp(Math.log(a), Math.log(b), smooth(t)));
  if (q > 0) return l(0.1, 0.002, clamp01(q / 0.6));
  if (p < 0.5) return l(1, 0.5, clamp01((p - 0.1) / 0.3));
  return l(0.5, 0.1, clamp01((p - 0.6) / 0.3));
}

const shrink: SceneDef = {
  draw(s) {
    const F = nearOne(s);
    F.axes();
    F.fn(f, 'purple', 0.8);
    const h = hAt(s);
    const m = (f(1 + h) - f(1)) / h;
    const tan = s.ease('tangent', 0.8);
    s.alpha(1 - tan, () => F.tangent(1, 1, m, 'gold', -0.6, 2.7));
    s.alpha(tan, () => F.tangent(1, 1, 2, 'teal', -0.6, 2.7, 0.75));
    F.dot(1, 1, 'purple');
    s.alpha(clamp01((h - 0.03) / 0.05), () => F.dot(1 + h, f(1 + h), 'purple', 1.1));
    stepTriangle(s, F, 1, 1 + h, 'h', '', clamp01((h - 0.25) / 0.2));
    const lim = s.ease('limit', 0.6, 1.2);
    s.alpha(1 - lim, () => note(s, F, `h = ${f2(h)}   slope = ${f2(m)}`, 0, 'gold'));
    s.alpha(lim, () => note(s, F, "f′(1) = 2", 0, 'teal', 4.6));
    s.alpha(s.ease('nudge', 0.6), () => {
      note(s, F, 'x: 1 → 1.01', 1, '--ink-2', 3.6);
      note(s, F, 'f: 1 → 1.0201', 2, '--ink-2', 3.6);
    });
  },
};

const wide = (s: Scene) => new Frame(s, inset(s, 0.07, 0.07, 0.06), [-2.3, 2.3, -0.8, 5.4]);

const sign: SceneDef = {
  draw(s) {
    const F = wide(s);
    F.axes();
    F.fn(f, 'purple', 0.8);
    const p = lerp(lerp(lerp(-2, -1.5, s.ease('slide', 1.2, 0.6)), 0, s.ease('zero', 1.4)), 1.5, s.ease('pos', 1.4));
    const m = 2 * p;
    const k = m < -0.3 ? 'red' : m > 0.3 ? 'green' : 'teal';
    F.tangent(p, f(p), m, k, p - 0.95, p + 0.95, 0.7);
    F.dot(p, f(p), 'purple');
    const word = m < -0.3 ? 'going down' : m > 0.3 ? 'going up' : 'flat';
    s.text(`slope ${m < -0.05 ? '−' : ''}${Math.abs(m).toFixed(1)}: ${word}`, s.w / 2, F.Y(4.9), { size: 3.9, font: 'mono', weight: 650, color: s.c(k), halo: true });
  },
};

// Worked example: f(x) = x² between x = 3 and x = 3.5; the plot over the working on a phone, beside it on a desktop.
const ex = (s: Scene) => new Frame(s, s.tall ? inset(s, 0.06, 0.08, 0.42) : [s.w * 0.04, s.h * 0.08, s.w * 0.44, s.h * 0.84], [0.5, 4.2, 0, 17]);

const example: SceneDef = {
  draw(s) {
    const F = ex(s);
    F.axes();
    F.fn(f, 'purple', 0.8);
    s.alpha(s.ease('ask', 0.6), () => {
      F.dot(3, 9, 'purple');
      F.dot(3.5, 12.25, 'purple');
      const o = { size: 3.6, font: 'mono', weight: 600, align: 'right', color: s.c('purple'), halo: true } as const;
      s.text('f(3) = 9', F.X(3) - 3 * s.u, F.Y(9) - 2.5 * s.u, o);
      s.text('f(3.5) = 12.25', F.X(3.5) - 3 * s.u, F.Y(12.25) - 2.5 * s.u, o);
    });
    s.alpha(s.ease('ask', 0.6, 1), () => F.tangent(3, 9, 6.5, 'gold', 2.3, 4.2));
    s.alpha(s.ease('rise', 0.6), () => {
      F.seg(3, 9, 3.5, 9, '--ink-3', 0.4, [1.2, 1]);
      F.seg(3.5, 9, 3.5, 12.25, '--ink-3', 0.4, [1.2, 1]);
      s.text('3.25', F.X(3.5) + 2 * s.u, F.Y(10.6), { size: 3.4, font: 'mono', align: 'left', color: s.c('--ink-2'), halo: true });
    });
    s.alpha(s.ease('run', 0.6), () => s.text('0.5', F.X(3.25), F.Y(9) + 3.4 * s.u, { size: 3.4, font: 'mono', color: s.c('--ink-2'), halo: true }));
    const [x0, y0, dy] = s.tall ? [s.w / 2 - 30 * s.u, s.h * 0.7, 0.1] : [s.w * 0.52, s.h * 0.38, 0.12];
    const line = (t: string, row: number, a: number, k: Parameters<Scene['c']>[0] = '--ink-2') =>
      s.alpha(a, () => s.text(t, x0, y0 + row * dy * s.h, { size: s.tall ? 4.2 : 3.8, font: 'mono', weight: 600, align: 'left', color: s.c(k) }));
    line('rise  = 12.25 − 9 = 3.25', 0, s.ease('rise', 0.6, 0.4));
    line('run   = h = 0.5', 1, s.ease('run', 0.6));
    line('slope = 3.25 / 0.5 = 6.5', 2, s.ease('run', 0.6, 1), 'gold');
    s.alpha(s.ease('close', 0.6), () => F.tangent(3, 9, 6, 'teal', 2.4, 3.9, 0.5));
  },
};

export const scenes: Record<string, SceneDef> = { slope, shrink, sign, example };

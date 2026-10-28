import type { Scene, SceneDef } from '../../../lecture/scene';
import { Rng } from '../../../core/rand';
import { cells, columns } from '../../draw';
import { ball, curve, frame, hop, type Frame } from '../draw';

const SUP: Record<string, string> = { '-': '⁻', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵' };
const pow10 = (k: number) => `10${String(k).split('').map((c) => SUP[c] ?? c).join('')}`;

/** Who did it, and when: small, in a corner of the stage (a negative y counts up from the bottom). */
function cite(s: Scene, text: string, a: number, y = 5) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, y < 0 ? s.h + y * s.u : y * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

function caption(s: Scene, text: string, y: number, k: Parameters<Scene['c']>[0] = '--ink-2', size = 3.4) {
  s.text(text, s.w / 2, y, { size, font: 'mono', color: s.c(k), halo: true });
}

// ---- knobs: the weights are learned, the learning rate and batch size are chosen

const bowl = (w: number) => w * w;
/** Gradient steps down the bowl from w = 1.6, each keeping 60% of w. */
const STEPS: [number, number][] = Array.from({ length: 7 }, (_, i) => {
  const w = 1.6 * 0.6 ** i;
  return [w, bowl(w)];
});
const TRIES: [string, string][] = [['10⁻²', '0.92'], ['10⁻³', '0.58'], ['10⁻⁴', '1.02']];

const knobs: SceneDef = {
  draw(s) {
    const fw = Math.min(70, s.w / s.u - 24) * s.u;
    const F = frame(s.w / 2 - fw / 2, s.h * 0.36, s.w / 2 + fw / 2, s.h * 0.68, [-1.8, 1.8], [0, 3.2]);
    s.line(F.l, F.b, F.r, F.b, s.c('--axis'), 0.35);
    s.text('w', F.r, F.b + 4 * s.u, { size: 3.6, font: 'mono', weight: 650, align: 'right', color: s.c('blue') });
    s.text('loss', F.l - 1.5 * s.u, F.t + 2 * s.u, { size: 3.2, font: 'mono', weight: 600, align: 'right', color: s.c('red') });
    curve(s, F, bowl, -1.8, 1.8, '--ink-3', { width: 0.5 });
    const p = hop(STEPS, s.t - s.at('learned') - 1, 0.9);
    ball(s, F.X(p.x), F.Y(p.y), 'blue', 1.7);
    s.alpha(s.win('learned', 'chosen'), () => caption(s, 'w: set by training, step by step', s.h * 0.78, 'blue'));

    // The settings training never touches.
    const xs = columns(s, 2, s.tall ? 34 : 40);
    const cy = s.h * 0.17;
    s.alpha(s.ease('chosen', 0.5, 0.8), () => cells(s, [xs[0]!], cy, ['η = 0.001'], 'slate', { w: 26, h: 9, size: 3.6 }));
    s.alpha(s.ease('chosen', 0.5, 3.5), () => cells(s, [xs[1]!], cy, ['B = 64'], 'slate', { w: 26, h: 9, size: 3.6 }));
    s.alpha(s.ease('chosen', 0.5, 5) * (1 - s.ease('name', 0.5)), () => caption(s, 'chosen before training, then fixed', s.h * 0.27, '--ink-2', 3.2));
    s.alpha(s.ease('name', 0.6), () => {
      s.text('hyperparameters', s.w / 2, s.h * 0.07, { size: 3.6, font: 'mono', weight: 650, color: s.c('slate') });
      caption(s, 'hyper: over the weights', s.h * 0.27, 'slate', 3.2);
      s.arrow(s.w / 2, s.h * 0.3, s.w / 2, F.t - 1 * s.u, s.c('--ink-3'), 0.35, 1.8);
    });

    // Each try is a whole training run, judged by its validation loss.
    s.alpha(s.ease('cost', 0.6), () => {
      caption(s, 'each try: a whole training, then its val loss', s.h * 0.78, '--ink-2', 3.1);
      const bx = columns(s, 3, s.tall ? 28 : 32);
      TRIES.forEach(([eta, val], i) => {
        s.alpha(s.ease('cost', 0.5, 2 + 0.6 * i), () => {
          const y = s.h * 0.89;
          s.rrect(bx[i]! - 12.5 * s.u, y - 4 * s.u, 25 * s.u, 8 * s.u, 1, { fill: s.tint('gold', 0.1), stroke: s.tint('gold', 0.6), lw: 0.3 });
          s.text(`η ${eta} → ${val}`, bx[i]!, y, { size: 2.9, font: 'mono', color: s.c('--ink') });
        });
      });
    });
  },
};

// ---- log: drawing the rate uniformly crowds the top decade; drawing its exponent spreads it

const rng = new Rng(3);
const N = 36;
const UNIFORM = Array.from({ length: N }, () => [Math.log10(1e-5 + (0.1 - 1e-5) * rng.next()), rng.next()] as const);
const LOGU = Array.from({ length: N }, () => [-5 + 4 * rng.next(), rng.next()] as const);

/** The log axis from 10^-5 to 10^-1 across the stage. */
function logAxis(s: Scene) {
  const l = 10 * s.u;
  const r = s.w - 8 * s.u;
  return { l, r, X: (lg: number) => l + ((lg + 5) / 4) * (r - l) };
}

/** The range on a plain scale, 0 to 0.1 across `l..r`: the stretch from 0.01 up is nine tenths of it. */
function ruler(s: Scene, l: number, r: number, y: number): void {
  const X = (v: number) => l + (v / 0.1) * (r - l);
  const h = 3.2 * s.u;
  s.text('plain ruler', l, y - h / 2 - 7.5 * s.u, { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c('--ink-2') });
  s.rrect(l, y - h / 2, X(0.01) - l, h, 0.5, { fill: s.tint('--ink-3', 0.45) });
  s.rrect(X(0.01), y - h / 2, r - X(0.01), h, 0.5, { fill: s.tint('red', 0.55) });
  s.text('top decade: 9/10 of the length', (X(0.01) + r) / 2, y - h / 2 - 3 * s.u, { size: 3, font: 'mono', color: s.c('red'), halo: true });
  for (const [v, t] of [[0, '0'], [0.01, '0.01'], [0.1, '0.1']] as const) s.text(t, X(v), y + h / 2 + 3 * s.u, { size: 3, font: 'mono', color: s.c('--ink-3'), halo: true });
}

const log: SceneDef = {
  marks: {
    split: { tex: String.raw`10^{-2.5} = 10^{0.5} \times 10^{-3} \approx 3.16 \times 0.001`, x: 0.5, y: 0.14, size: 3.8 },
  },
  draw(s) {
    const A = logAxis(s);
    const ay = s.h * 0.82;
    const y1 = s.h * 0.3;
    const y2 = s.h * 0.58;
    s.alpha(s.ease('range', 0.6), () => {
      s.line(A.l, ay, A.r, ay, s.c('--axis'), 0.4);
      for (let k = -5; k <= -1; k++) {
        s.alpha(s.ease('range', 0.4, 3 + 0.4 * (k + 5)), () => {
          s.line(A.X(k), ay - 1.2 * s.u, A.X(k), ay + 1.2 * s.u, s.c('--axis'), 0.4);
          s.line(A.X(k), s.h * 0.2, A.X(k), ay, s.tint('--ink-3', 0.25), 0.25, [0.8, 1]);
          s.text(pow10(k), A.X(k), ay + 4.5 * s.u, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
        });
      }
      s.text('learning rate η', s.w / 2, s.h * 0.94, { size: 3.2, color: s.c('--ink-3') });
    });
    // Each step along the axis multiplies by ten: one decade.
    s.alpha(s.win('decade', 'uniform'), () => {
      for (let k = -5; k < -1; k++) s.text('×10', (A.X(k) + A.X(k + 1)) / 2, ay - 3.5 * s.u, { size: 3, font: 'mono', weight: 600, color: s.c('slate'), halo: true });
      s.line(A.X(-3), ay - 7 * s.u, A.X(-2), ay - 7 * s.u, s.c('slate'), 0.4);
      s.text('a decade', (A.X(-3) + A.X(-2)) / 2, ay - 10 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c('slate'), halo: true });
    });
    s.alpha(s.win('decade', 'why'), () => caption(s, 'log scale: place = power of ten', s.h * 0.4, 'slate', 3.4));
    // Why the range is so wide: the safe rate scales with one over the steepness.
    s.alpha(s.win('why', 'uniform'), () => {
      caption(s, 'largest safe rate: η = 1/a', s.h * 0.26, '--ink-2', 3.4);
      caption(s, 'a × 100  →  η ÷ 100', s.h * 0.34, '--ink-2', 3.4);
    });
    const dots = (pts: readonly (readonly [number, number])[], y: number, beat: string, k: 'red' | 'green') => {
      pts.forEach(([lg, j], i) => {
        s.alpha(s.ease(beat, 0.3, 0.4 + i * 0.07), () => s.circle(A.X(lg), y + (j - 0.5) * 7 * s.u, 0.9 * s.u, { fill: s.tint(k, 0.85) }));
      });
    };
    s.alpha(s.ease('uniform', 0.6), () => s.text('η uniform', A.l, y1 - 7.5 * s.u, { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c('red') }));
    dots(UNIFORM, y1, 'uniform', 'red');
    s.alpha(s.ease('uniform', 0.6, 4), () => {
      s.line(A.X(-2), y1 + 5.5 * s.u, A.X(-1), y1 + 5.5 * s.u, s.c('red'), 0.35);
      s.text('9 in 10 here', (A.X(-2) + A.X(-1)) / 2, y1 + 9 * s.u, { size: 3, font: 'mono', color: s.c('red'), halo: true });
    });
    s.alpha(s.win('ruler', 'log'), () => ruler(s, A.l, A.r, y2));
    s.alpha(s.ease('log', 0.6), () => s.text('η = 10ᵘ, u uniform', A.l, y2 - 7.5 * s.u, { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c('green') }));
    dots(LOGU, y2, 'log', 'green');
    s.alpha(s.ease('even', 0.6), () => {
      for (let k = -5; k < -1; k++) s.text('¼', (A.X(k) + A.X(k + 1)) / 2, y2 + 7.5 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c('green'), halo: true });
    });
    // Reading a range's ends as exponents.
    s.alpha(s.win('ends', 'ex'), () => {
      s.line(A.X(-3), ay, A.X(-1), ay, s.c('teal'), 1.1);
      s.text('0.001 to 0.1: u from −3 to −1', s.w / 2, s.h * 0.73, { size: 3.1, font: 'mono', weight: 600, color: s.c('teal'), halo: true });
    });
    const pin = (lg: number, text: string, beat: string, right: boolean) => {
      s.alpha(s.ease(beat, 0.6, 0.3), () => {
        const ty = s.h * 0.72;
        s.line(A.X(lg), ty + 2 * s.u, A.X(lg), ay, s.c('slate'), 0.35);
        s.circle(A.X(lg), ay, 1.1 * s.u, { fill: s.c('slate') });
        s.text(text, A.X(lg) + (right ? 1 : -1) * s.u, ty, { size: 3.1, font: 'mono', align: right ? 'left' : 'right', color: s.c('--ink'), halo: true });
      });
    };
    pin(-3, 'u = −3: 0.001', 'ex', false);
    pin(-2.5, '−2.5: 0.0032', 'ex2', true);
    s.show('split', s.ease('ex2', 0.6, 1));
  },
};

// ---- random: a grid repeats the rates it tries; random trials spread them

const GRID = [-4.3, -3, -1.7].flatMap((x) => [0.2, 0.5, 0.8].map((y) => [x, y] as const));
const rr = new Rng(11);
const RAND = Array.from({ length: 9 }, (_, i) => [-4.8 + (3.6 * (i + rr.next())) / 9, 0.1 + 0.8 * rr.next()] as const);
const score = (lg: number) => 1 - 0.85 * Math.exp(-((lg + 2.6) ** 2) / 0.18);

function panel(s: Scene, F: Frame, pts: readonly (readonly [number, number])[], k: 'blue' | 'orange', a: number, proj: number, title: string): void {
  s.alpha(a, () => {
    s.rrect(F.l, F.t, F.r - F.l, F.b - F.t, 1, { stroke: s.c('--axis'), lw: 0.3 });
    s.text(title, (F.l + F.r) / 2, F.t - 4 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c(k) });
    s.text('learning rate', (F.l + F.r) / 2, F.b + 3.4 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3'), halo: true });
    for (const [x, y] of pts) s.circle(F.X(x), F.Y(y), 1.1 * s.u, { fill: s.c(k) });
    const S = frame(F.l, F.b + 8 * s.u, F.r, F.b + 22 * s.u, [-5, -1], [0, 1.1]);
    s.alpha(proj, () => {
      curve(s, S, score, -5, -1, '--ink-3', { width: 0.4 });
      s.text('val loss', S.l + 1 * s.u, S.b - 2.2 * s.u, { size: 2.6, font: 'mono', align: 'left', color: s.c('gold'), halo: true });
      s.line(S.l, S.b, S.r, S.b, s.c('--axis'), 0.3);
      for (const [x] of pts) {
        s.line(F.X(x), F.b, S.X(x), S.Y(score(x)), s.tint(k, 0.35), 0.25, [0.8, 0.8]);
        s.circle(S.X(x), S.Y(score(x)), 0.9 * s.u, { fill: s.c(k) });
      }
    });
  });
}

const random: SceneDef = {
  draw(s) {
    const pw = s.tall ? 44 : 50;
    const gap = s.tall ? 8 : 12;
    const top = s.h * 0.12;
    const L = frame(s.w / 2 - (gap / 2) * s.u - pw * s.u, top, s.w / 2 - (gap / 2) * s.u, top + pw * s.u * (s.tall ? 1 : 0.85), [-5, -1], [0, 1]);
    const R = frame(s.w / 2 + (gap / 2) * s.u, top, s.w / 2 + (gap / 2) * s.u + pw * s.u, L.b, [-5, -1], [0, 1]);
    s.alpha(s.ease('grid', 0.6), () => s.text('↑ batch size', L.l + 1.5 * s.u, L.t + 3 * s.u, { size: 2.6, font: 'mono', align: 'left', color: s.c('--ink-3') }));
    panel(s, L, GRID, 'blue', s.ease('grid', 0.6), s.ease('waste', 0.8), '3 × 3 grid');
    panel(s, R, RAND, 'orange', s.ease('random', 0.6), s.ease('random', 0.8, 1.5), '9 random');
    s.alpha(s.ease('waste', 0.6, 1), () => s.text('3 rates, ×3 each', (L.l + L.r) / 2, L.b + 26 * s.u, { size: 3.2, font: 'mono', color: s.c('blue') }));
    s.alpha(s.ease('random', 0.6, 2.5), () => s.text('9 rates', (R.l + R.r) / 2, R.b + 26 * s.u, { size: 3.2, font: 'mono', color: s.c('orange') }));
    cite(s, 'Bergstra & Bengio, 2012', s.ease('bergstra', 0.6), -4.5);
  },
};

// ---- judge: pick by validation loss, report the test loss once

const RUNS: [string, string, string, string][] = [
  ['A', '10⁻¹', '1.20', '1.31'],
  ['B', '10⁻²', '0.21', '0.92'],
  ['C', '10⁻³', '0.45', '0.58'],
  ['D', '10⁻⁴', '0.95', '1.02'],
];

const judge: SceneDef = {
  draw(s) {
    const xs = columns(s, 4, s.tall ? 22 : 24);
    const hy = s.h * 0.12;
    (['run', 'η', 'train', 'val'] as const).forEach((t, j) => s.text(t, xs[j]!, hy, { size: 3.6, font: 'mono', weight: 650, color: s.c((['--ink-2', 'slate', 'blue', 'gold'] as const)[j]) }));
    RUNS.forEach((r, i) => {
      const y = hy + (i + 1) * 11 * s.u;
      const best = i === 2 ? s.ease('pick', 0.6) : 0;
      s.alpha(s.ease('train', 0.4, 0.3 + i * 0.3), () => {
        s.text(r[0], xs[0]!, y, { size: 3.8, font: 'mono', weight: 650, color: s.c(best ? 'green' : '--ink-2') });
        cells(s, [xs[1]!], y, [r[1]], 'slate', { w: 14, h: 8, size: 3.4 });
        cells(s, [xs[2]!], y, [r[2]], 'blue', { w: 14, h: 8, size: 3.4 });
        cells(s, [xs[3]!], y, [r[3]], 'gold', { w: 14, h: 8, size: 3.4, on: [best] });
      });
    });
    s.alpha(s.ease('pick', 0.6, 0.6), () => {
      s.text('C: lowest val, keep it', s.w / 2, hy + 5 * 11 * s.u + 1 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c('green') });
    });
    s.alpha(s.ease('pick', 0.6, 3), () => {
      const y = hy + 2 * 11 * s.u;
      s.line(xs[2]! - 8 * s.u, y, xs[2]! + 8 * s.u, y, s.c('red'), 0.4);
      s.text('B: lowest train, not the pick', s.w / 2, hy + 5 * 11 * s.u + 9 * s.u, { size: 3.4, font: 'mono', color: s.c('red') });
    });
    s.alpha(s.ease('test', 0.6), () => {
      const y = s.h * 0.89;
      s.rrect(s.w / 2 - 30 * s.u, y - 4.5 * s.u, 60 * s.u, 9 * s.u, 1.2, { fill: s.tint('teal', 0.15), stroke: s.c('teal'), lw: 0.35 });
      s.text('test split: once, at the end', s.w / 2, y, { size: 3.4, font: 'mono', color: s.c('teal') });
    });
  },
};

export const scenes: Record<string, SceneDef> = { knobs, log, random, judge };

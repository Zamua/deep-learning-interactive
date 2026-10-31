import { clamp01, type Ink, type Scene, type SceneDef } from '../../../lecture/scene';
import { after, cite } from '../../draw';
import { caption } from '../../networks/draw';
import { axes, ball, clipped, curve, frame, type Frame, hop } from '../../optimization/draw';
import { series, xTicks, yTicks } from '../draw';
import type { Color } from '../../../core/symbols';

const mono = (s: Scene, t: string, x: number, y: number, k: Ink, align: CanvasTextAlign = 'center', size = 3.2, weight = 600) =>
  s.text(t, x, y, { size, font: 'mono', weight, align, color: s.c(k), halo: true });

/** Dashed guides from a point down to the floor and across to the wall, with a dot on it. */
function pin(s: Scene, F: Frame, x: number, y: number, a: number, k: Color = 'slate'): void {
  s.alpha(a, () => {
    s.line(F.X(x), F.Y(y), F.X(x), F.b, s.tint(k, 0.7), 0.3, [1, 0.8]);
    s.line(F.l, F.Y(y), F.X(x), F.Y(y), s.tint(k, 0.7), 0.3, [1, 0.8]);
    ball(s, F.X(x), F.Y(y), k, 1.4);
  });
}

// ---- the valley: an even slope to a narrow bottom, with steep walls farther out

const SLOPE = 0.5;
const ROUND = 0.25;
const EDGE = 6;
const WALL = 1.44;
const valley = (x: number) => SLOPE * Math.hypot(x, ROUND) + (Math.abs(x) > EDGE ? WALL * (Math.abs(x) - EDGE) ** 3 : 0);
const dvalley = (x: number) => (SLOPE * x) / Math.hypot(x, ROUND) + (Math.abs(x) > EDGE ? 3 * WALL * (Math.abs(x) - EDGE) ** 2 * Math.sign(x) : 0);

/** Gradient descent on the valley from x0, the rate at each step from `lr`. */
function descend(x0: number, lr: (t: number) => number, n: number): [number, number][] {
  const pts: [number, number][] = [[x0, valley(x0)]];
  let x = x0;
  for (let t = 0; t < n && Math.abs(x) < 50; t++) {
    x -= lr(t) * dvalley(x);
    pts.push([x, valley(x)]);
  }
  return pts;
}

const BIG = 3;
const LOW = 0.2;
/** Held at BIG, then straight down to a small rate. */
const decayed = (t: number) => (t < 6 ? BIG : Math.max(0.15, BIG - ((BIG - 0.15) * (t - 6)) / 10));
const SMALL_RUN = descend(5.5, () => LOW, 30);
const BIG_RUN = descend(5.5, () => BIG, 16);
const DECAY_RUN = descend(5.5, decayed, 20);
/** Warm up over K steps, hold, then decay. */
const K = 16;
const warmed = (t: number) => (t < K ? (BIG * t) / K : t < 30 ? BIG : Math.max(0.15, BIG - ((BIG - 0.15) * (t - 30)) / 6));
const START = 7;
const FULL_RUN = descend(START, () => BIG, 2);
const WARM_RUN = descend(START, warmed, 38);

/** The valley at the top of the stage, the schedule η over steps under it. */
function panes(s: Scene, steps: number) {
  const u = s.u;
  const V = frame(8 * u, s.h * 0.08, s.w - 8 * u, s.h * 0.48, [-8, 8], [0, 9.2]);
  const P = frame(14 * u, s.h * 0.6, s.w - 8 * u, s.h * 0.88, [0, steps], [0, 3.6]);
  return { V, P };
}

function drawValley(s: Scene, V: Frame, a = 1): void {
  s.alpha(a, () => {
    s.line(V.l, V.b, V.r, V.b, s.c('--axis'), 0.3);
    curve(s, V, valley, -8, 8, '--ink-3', { width: 0.6 });
  });
}

/** A ball walking `pts` down the valley, with its chords and landings. */
function walk(s: Scene, F: Frame, pts: [number, number][], t: number, every: number, k: Color): ReturnType<typeof hop> {
  const h = hop(pts, t, every);
  clipped(s, F, () => {
    for (let i = 0; i < h.done; i++) s.line(F.X(pts[i]![0]), F.Y(pts[i]![1]), F.X(pts[i + 1]![0]), F.Y(pts[i + 1]![1]), s.tint('slate', 0.55), 0.35);
    if (h.done < pts.length - 1) s.line(F.X(pts[h.done]![0]), F.Y(pts[h.done]![1]), F.X(h.x), F.Y(h.y), s.tint('slate', 0.55), 0.35);
    for (let i = 0; i <= h.done; i++) s.circle(F.X(pts[i]![0]), F.Y(pts[i]![1]), 0.6 * s.u, { fill: s.tint(k, 0.4) });
    ball(s, F.X(h.x), F.Y(h.y), k, 1.7);
  });
  return h;
}

/** A schedule drawn up to step `upto`, with a dot at step `at` (default: the end of the line). */
function schedule(s: Scene, P: Frame, lr: (t: number) => number, n: number, upto: number, k: Color, a = 1, at = upto): void {
  if (upto <= 0) return;
  const pts = Array.from({ length: n }, (_, t) => [t, lr(t)] as [number, number]);
  s.alpha(a, () => {
    series(s, P, pts, k, { upto: Math.min(1, upto / (n - 1)), width: 0.7 });
    const t = Math.max(0, Math.min(n - 1, at));
    const i = Math.floor(t);
    const y = lr(i) + (i + 1 < n ? (lr(i + 1) - lr(i)) * (t - i) : 0);
    s.circle(P.X(t), P.Y(y), 1.1 * s.u, { fill: s.c(k) });
  });
}

/** Seconds per hop so `n` hops fit in the time from beat `id` to beat `until`. */
const pace = (s: Scene, id: string, until: string, n: number) => Math.min(0.6, Math.max(0.16, (s.at(until) - s.at(id) - 1.2) / n));

const settle: SceneDef = {
  draw(s) {
    const u = s.u;
    const { V, P } = panes(s, 30);
    drawValley(s, V);
    s.alpha(s.ease('valley', 0.6, 1), () => {
      axes(s, P, 'step', 'η', { x: '--ink-3', y: 'slate' });
      xTicks(s, P, [10, 20]);
      yTicks(s, P, [LOW, BIG]);
    });
    const runs: { beat: string; until: string; pts: [number, number][]; lr: (t: number) => number; k: Color; steps: number }[] = [
      { beat: 'small', until: 'big', pts: SMALL_RUN, lr: () => LOW, k: 'blue', steps: 30 },
      { beat: 'big', until: 'both', pts: BIG_RUN, lr: () => BIG, k: 'red', steps: 16 },
      { beat: 'both', until: 'name', pts: DECAY_RUN, lr: decayed, k: 'green', steps: 20 },
    ];
    const cur = runs.reduce((k, r, i) => (s.since(r.beat) >= 0 ? i : k), -1);
    if (cur < 0) ball(s, V.X(5.5), V.Y(valley(5.5)), 'slate', 1.7);
    s.alpha(s.win('valley', 'small') * after(s, 'valley', 0.35), () => {
      s.arrow(V.X(5.5) - 2 * u, V.Y(valley(5.5)) + 5 * u, V.X(4.2) - 2 * u, V.Y(valley(4.2)) + 5 * u, s.c('--ink-2'), 0.5, 2);
      mono(s, 'step: η × slope', V.X(5.2), V.Y(valley(5.2)) + 10 * u, '--ink-2', 'center', 3.1, 500);
    });
    runs.forEach((r, i) => {
      if (s.since(r.beat) < 0) return;
      const every = pace(s, r.beat, r.until, r.steps);
      const t = s.since(r.beat) - 0.5;
      const live = i === cur;
      if (live) walk(s, V, r.pts, t, every, r.k);
      schedule(s, P, r.lr, r.steps + 1, Math.max(0.001, t / every), r.k, live ? 1 : 0.35);
    });
    const ty = V.t + 1 * u;
    s.alpha(s.win('small', 'big') * after(s, 'small', 0.5), () => mono(s, '30 steps: still far', V.X(5.5), ty, 'blue'));
    s.alpha(s.win('big', 'both') * after(s, 'big', 0.45), () => mono(s, 'bounces at the bottom, forever', V.X(0), ty, 'red'));
    s.alpha(s.ease('both', 0.6, 2), () => mono(s, 'fast, then it settles', V.X(0), ty, 'green'));
    const cy = (V.b + P.t) / 2 + 1 * u;
    s.alpha(s.win('name', 'schedule'), () => caption(s, 'decay: lowering η over a run', cy, 'green', 3.3));
    s.alpha(s.ease('schedule', 0.6), () => caption(s, 'the schedule: η planned for every step', cy, 'green', 3.3));
    s.alpha(s.ease('schedule', 0.6, 0.6), () => {
      mono(s, 'held high', P.X(3.5), P.Y(BIG) + 3.5 * u, 'green', 'center', 3);
      mono(s, 'then down', P.X(14), P.Y(1.4), 'green', 'left', 3);
    });
  },
};

// ---- steps: hold, then multiply by 0.1, on a log scale

const lg = (v: number) => Math.log10(v);
/** A staircase from 0.1, ×0.1 at each drop, out to `end`. */
const stairs = (drops: number[], end: number): [number, number][] => {
  const pts: [number, number][] = [[0, -1]];
  drops.forEach((d, i) => pts.push([d, -1 - i], [d, -2 - i]));
  pts.push([end, -1 - drops.length]);
  return pts;
};
const HE = stairs([32, 48], 64);
const OURS = stairs([10, 20], 30);

const steps: SceneDef = {
  draw(s) {
    const u = s.u;
    const ours = s.ease('one', 0.6);
    const axesFor = (F: Frame, ticks: number[]) => {
      axes(s, F, 'step', 'η', { x: '--ink-3', y: 'slate' });
      xTicks(s, F, ticks, (x) => `${x}k`);
      yTicks(s, F, [-1, -2, -3], (y) => String(10 ** y));
      s.text('log scale', F.l + 7 * u, F.t + 2 * u, { size: 2.8, font: 'mono', align: 'left', color: s.c('--ink-3') });
    };
    s.alpha(1 - ours, () => {
      const F = frame(17 * u, s.h * 0.12, s.w - 7 * u, s.h * 0.84, [0, 64], [-3.4, -0.6]);
      axesFor(F, [32, 48]);
      series(s, F, HE, 'slate', { upto: clamp01((s.since('rule') - 0.3) / 3), width: 0.7 });
      s.alpha(s.ease('rule', 0.6, 2.5), () => {
        for (const [i, x] of [32, 48].entries()) mono(s, '× 0.1', F.X(x) + 1.5 * u, F.Y(-1.5 - i), 'gold', 'left');
      });
      s.alpha(after(s, 'he', 0.5), () => mono(s, 'stop at 64k', F.r - 1 * u, F.Y(-3) - 4 * u, '--ink-2', 'right', 3, 500));
    });
    cite(s, 'He, Zhang, Ren & Sun, 2015', s.win('he', 'one'));
    s.alpha(ours, () => {
      const F = frame(17 * u, s.h * 0.12, s.w - 7 * u, s.h * 0.84, [0, 30], [-3.4, -0.6]);
      axesFor(F, [10, 20]);
      series(s, F, OURS, 'slate', { upto: clamp01((s.since('one') - 0.3) / 2), width: 0.7 });
      s.alpha(s.ease('one', 0.6, 1.5), () => {
        for (const [i, x] of [10, 20].entries()) mono(s, `drop ${i + 1}`, F.X(x) + 1.5 * u, F.Y(-1.5 - i), 'gold', 'left');
      });
      const edge = s.ease('edge', 0.6, 1);
      pin(s, F, 15, -2, after(s, 'one', 0.5) * (1 - 0.6 * edge));
      s.alpha(after(s, 'one', 0.6) * (1 - 0.6 * edge), () => mono(s, '15k: 0.1 × 0.1 = 0.01', F.X(15), F.Y(-2) - 4.5 * u, '--ink', 'center'));
      pin(s, F, 25, -3, after(s, 'two', 0.5) * (1 - 0.6 * edge));
      s.alpha(after(s, 'two', 0.6) * (1 - 0.6 * edge), () => mono(s, '25k: 0.1 × 0.1² = 0.001', F.X(29), F.Y(-3) - 4.5 * u, '--ink', 'right'));
      pin(s, F, 20, -3, edge, 'gold');
      s.alpha(edge, () => mono(s, '20k: 20,000 // 10,000 = 2', F.X(20), F.Y(-3) + 5 * u, 'gold', 'center'));
    });
  },
};

// ---- linear: a straight line from the top rate to the bottom one over T steps

const HI = 0.1;
const LO = 0.01;
const TT = 1000;
const lin = (t: number) => HI - ((HI - LO) * t) / TT;

const linear: SceneDef = {
  draw(s) {
    const u = s.u;
    const F = frame(17 * u, s.h * 0.1, s.w - 14 * u, s.h * 0.84, [0, TT], [0, 0.122]);
    axes(s, F, '', 'η', { x: '--ink-3', y: 'slate' });
    yTicks(s, F, [0.05]);
    const T = s.ease('T', 0.6);
    curve(s, F, lin, 0, TT, 'slate', { width: 0.7, upto: s.ease('top', 1.6, 0.6) * (0.4 + 0.6 * T) });
    ball(s, F.X(0), F.Y(HI), 'slate', 1.3);
    mono(s, 'ηₘₐₓ = 0.1', F.X(0) + 3 * u, F.Y(HI) - 3.5 * u, 'slate', 'left');
    s.alpha(s.ease('bottom', 0.6), () => {
      s.line(F.l, F.Y(LO), F.r, F.Y(LO), s.tint('slate', 0.6), 0.3, [1, 0.8]);
      mono(s, 'ηₘᵢₙ = 0.01', F.r - 1 * u, F.Y(LO) + 3.5 * u, 'slate', 'right');
    });
    s.alpha(T, () => {
      ball(s, F.X(TT), F.Y(LO), 'slate', 1.3);
      xTicks(s, F, [400], (x) => `t = ${x}`);
      s.text('T = 1,000', F.X(TT), F.b + 3.4 * u, { size: 3, font: 'mono', color: s.c('slate') });
    });
    s.alpha(s.win('T', 'gap'), () => mono(s, 'the same drop every step', F.X(560), F.Y(lin(560)) - 5 * u, '--ink-2', 'left', 3.1, 500));
    // The gap, at the right; then the share of it used by step 400.
    s.alpha(s.ease('gap', 0.6), () => {
      const x = F.r + 4 * u;
      s.line(x, F.Y(HI), x, F.Y(LO), s.c('gold'), 0.45);
      for (const y of [HI, LO]) s.line(x - 1.2 * u, F.Y(y), x + 1.2 * u, F.Y(y), s.c('gold'), 0.45);
      s.line(F.X(0), F.Y(HI), x, F.Y(HI), s.tint('gold', 0.5), 0.3, [1, 0.8]);
      mono(s, 'gap 0.09', x - 2 * u, (F.Y(HI) + F.Y(LO)) / 2, 'gold', 'right');
    });
    const fr = s.ease('frac', 0.6);
    s.alpha(fr, () => {
      const x = F.X(400);
      s.line(x, F.Y(HI), x, F.Y(lin(400)), s.c('red'), 0.5);
      for (const y of [HI, lin(400)]) s.line(x - 1.2 * u, F.Y(y), x + 1.2 * u, F.Y(y), s.c('red'), 0.5);
      s.line(F.X(0), F.Y(HI), x, F.Y(HI), s.tint('red', 0.5), 0.3, [1, 0.8]);
      mono(s, '0.4 × 0.09 = 0.036', x + 2 * u, F.Y((HI + lin(400)) / 2), 'red', 'left');
    });
    pin(s, F, 400, lin(400), after(s, 'lr', 0.4), 'slate');
    s.alpha(after(s, 'lr', 0.5), () => mono(s, '0.1 − 0.036 = 0.064', F.X(400) - 3 * u, F.Y(lin(400)) + 4.5 * u, '--ink', 'right'));
    s.alpha(after(s, 'frac', 0.2), () => caption(s, 'step 400 of 1,000: 0.4 of the way', s.h * 0.93, '--ink-2', 3.3));
  },
};

// ---- warmup: the start sits on a steep wall

const warmup: SceneDef = {
  draw(s) {
    const u = s.u;
    const { V, P } = panes(s, 38);
    drawValley(s, V);
    const fly = s.ease('fly', 0.4);
    const grow = s.since('grow') >= 0;
    if (!grow) {
      s.alpha(Math.max(1 - fly, s.ease('ramp', 0.6)), () => ball(s, V.X(START), V.Y(valley(START)), 'slate', 1.7));
      s.alpha(after(s, 'wall', 0.45) * (1 - fly), () => {
        const g = dvalley(START);
        curve(s, V, (x) => valley(START) + g * (x - START), START - 0.5, START + 0.4, 'red', { width: 0.4, dash: [1, 0.7] });
        mono(s, 'steep: a large gradient', V.X(START) - 4 * u, V.Y(valley(START)) - 1 * u, 'red', 'right', 3.1);
      });
      s.alpha(fly * (1 - s.ease('ramp', 0.5)), () => {
        walk(s, V, FULL_RUN, s.since('fly') - 0.6, 0.9, 'red');
        mono(s, 'full rate at once: blows up', V.X(0), V.t + 1 * u, 'red');
      });
    } else {
      walk(s, V, WARM_RUN, s.since('grow') - 0.3, pace(s, 'grow', 'goyal', 38), 'green');
    }
    s.alpha(s.ease('wall', 0.6), () => {
      axes(s, P, 'step', 'η', { x: '--ink-3', y: 'slate' });
      s.text('ηₘₐₓ', P.l - 1.6 * u, P.Y(BIG), { size: 3, font: 'mono', align: 'right', color: s.c('slate') });
      s.text('k', P.X(K), P.b + 3.4 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c('slate') });
    });
    // Full rate from step 0, then the ramp that replaces it.
    s.alpha(fly * (1 - s.ease('ramp', 0.5)), () => schedule(s, P, () => BIG, 3, clamp01(s.since('fly') / 1.5) * 2, 'red'));
    const ramp = s.ease('ramp', 0.6);
    s.alpha(ramp, () => {
      const step = grow ? Math.min(37, Math.max(0, (s.since('grow') - 0.3) / pace(s, 'grow', 'goyal', 38))) : clamp01((s.since('ramp') - 0.5) / 2) * K;
      schedule(s, P, warmed, 38, Math.max(0.001, grow ? Math.max(K, step) : step), 'green', 1, step);
      s.line(P.X(K), P.t, P.X(K), P.b, s.tint('gold', 0.6), 0.3, [1.2, 1]);
      mono(s, 'warmup', P.X(K / 2), P.Y(BIG) - 3.5 * u, 'gold', 'center', 3.1);
    });
    s.alpha(s.ease('hold', 0.6), () => mono(s, 'holds', P.X(23), P.Y(BIG) - 3.5 * u, 'slate', 'center', 3.1));
    s.alpha(after(s, 'grow', 0.3) * (1 - s.ease('goyal', 0.5)), () => mono(s, 'small steps on the wall, then bigger', V.X(0), V.t + 1 * u, 'green'));
    // The worked numbers, on the ramp.
    const ex = s.win('formula', 'hold');
    s.alpha(ex * after(s, 'formula', 0.5), () => {
      pin(s, P, K / 4, BIG / 4, 1, 'gold');
      mono(s, 't = 250: 0.025', P.X(K / 4) + 2.5 * u, P.Y(BIG / 4) + 3 * u, 'gold', 'left', 3.1);
    });
    s.alpha(after(s, 'hold', 0.4) * (1 - s.ease('goyal', 0.5)), () => {
      s.line(P.l, P.Y(BIG), P.X(1.5 * K), P.Y(BIG), s.tint('gold', 0.7), 0.3, [1, 0.8]);
      ball(s, P.X(1.5 * K), P.Y(BIG), 'gold', 1.4);
      mono(s, 't = 1,500: 0.1', P.X(1.5 * K), P.Y(BIG) + 4.5 * u, 'gold', 'center', 3.1);
    });
    const cy = (V.b + P.t) / 2 + 1 * u;
    s.alpha(s.win('ramp', 'grow'), () => caption(s, 'warmup: ramp η from 0 to ηₘₐₓ over k steps', cy, 'gold', 3.2));
    s.alpha(s.win('formula', 'hold'), () => caption(s, 'η = ηₘₐₓ × t / k, while t < k', cy, 'gold', 3.2));
    s.alpha(s.win('goyal', undefined), () => caption(s, 'gradual warmup: 0.1 up to 3.2, in a straight line', cy, '--ink-2', 3.2));
    cite(s, 'Goyal et al., 2017', s.ease('goyal', 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { settle, steps, linear, warmup };

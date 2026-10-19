import { fmt } from '../../core/code';
import { Rng } from '../../core/rand';
import { type Scene, type SceneDef, type TextOpts, clamp01, lerp, smooth } from '../../lecture/scene';
import {
  ANSWERS,
  ANSWERS_KL,
  CHUNKS,
  CREDIT_ER,
  CREDIT_LIMIT,
  EXPLORE_LR,
  EXPLORE_SEEDS,
  EXPLORE_STEPS,
  P_RIGHT,
  PI0,
  PI0_EXPLORE,
  PROMPT,
  REF_KL,
  REWARD,
  RM_KL,
  TRUE_KL,
  VAR_LR,
  VAR_SEEDS,
  VAR_STEPS,
  Pg,
  creditStats,
  curves,
  dot,
  entropy,
  expectedReward,
  optimalPolicy,
  sampleFrom,
  sampleResponse,
  trajectories,
} from '../../lib/policy-gradients-toy';
import { type K, type Rect, area, bars, box, chart, check, chip, poly, split, stacked, tree } from './kit';

// ---------------------------------------------------------------- precomputed data

/** One REINFORCE run whose first sample is wrong and second is the best answer. */
const RUN_SEED = 99;
const RUN_STEPS = 200;
const RUN = (() => {
  const pg = new Pg(PI0, { lr: 0.3 }, RUN_SEED);
  const pis = [pg.pi];
  const ys: number[] = [];
  for (let t = 0; t < RUN_STEPS; t++) {
    ys.push(pg.step().ys[0]!);
    pis.push(pg.pi);
  }
  return { pis, ys, er: pis.map((p) => expectedReward(p)) };
})();
const RUN_OTHERS = curves(PI0, { lr: 0.3 }, [3, 7, 12, 31], RUN_STEPS);

const VAR_C = 2;
const VAR_PLAIN = curves(PI0, { lr: VAR_LR }, VAR_SEEDS, VAR_STEPS);
const VAR_SHIFT = curves(PI0, { lr: VAR_LR, offset: VAR_C }, VAR_SEEDS, VAR_STEPS);
const VAR_BASE = curves(PI0, { lr: VAR_LR, offset: VAR_C, baseline: true }, VAR_SEEDS, VAR_STEPS);

/** Sampled grades for the expected-reward scene, and their running average. */
const SAMPLES = (() => {
  const rng = new Rng(14);
  const ys: number[] = [];
  const avg: number[] = [];
  let sum = 0;
  for (let i = 0; i < 1000; i++) {
    const y = sampleFrom(PI0, rng);
    ys.push(y);
    sum += REWARD[y]!;
    avg.push(sum / (i + 1));
  }
  return { ys, avg };
})();

/** Answers for the credit scene; chunk averages computed for growing prefixes. */
const CREDIT_N = 256;
const CREDIT = (() => {
  const rng = new Rng(8);
  return Array.from({ length: CREDIT_N }, () => sampleResponse(rng));
})();
const CREDIT_STEPS = [8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256];
const CREDIT_STATS = CREDIT_STEPS.map((n) => creditStats(CREDIT.slice(0, n)));

const KL_BETAS = Array.from({ length: 81 }, (_, i) => 10 ** (-2 + (i / 80) * Math.log10(300)));
const KL_SWEEP = KL_BETAS.map((b) => {
  const o = optimalPolicy(REF_KL, RM_KL, b);
  return { rm: dot(o, RM_KL), tq: dot(o, TRUE_KL) };
});

const EXP_T0 = trajectories(PI0_EXPLORE, { lr: EXPLORE_LR, baseline: true, ent: 0 }, EXPLORE_SEEDS, EXPLORE_STEPS);
const EXP_T1 = trajectories(PI0_EXPLORE, { lr: EXPLORE_LR, baseline: true, ent: 0.1 }, EXPLORE_SEEDS, EXPLORE_STEPS);
const EXP_T4 = trajectories(PI0_EXPLORE, { lr: EXPLORE_LR, baseline: true, ent: 0.4 }, EXPLORE_SEEDS, EXPLORE_STEPS);
/** The first run that never finds the best answer. */
const EXP_STUCK = Math.max(0, EXP_T0.findIndex((t) => t[t.length - 1]![3]! < 0.5));

// ---------------------------------------------------------------- helpers

/** Text shrunk (never grown) to fit `maxW`. */
function fitText(s: Scene, str: string, x: number, y: number, maxW: number, o: TextOpts): void {
  const size = o.size ?? 5;
  const w = s.measure(str, { ...o, size });
  s.text(str, x, y, { ...o, size: w > maxW ? (size * maxW) / w : size });
}

/** Seconds into the scene at fraction `f` of beat `id`. */
const at = (s: Scene, id: string, f = 0): number => lerp(s.at(id), s.end(id), f);

/** 0 -> 1 between fractions `a` and `b` of beat `id`. */
const within = (s: Scene, id: string, a: number, b: number): number => clamp01((s.t - at(s, id, a)) / Math.max(0.01, at(s, id, b) - at(s, id, a)));

const runColor = (ok: boolean): K => (ok ? 'purple' : 'red');

// ---------------------------------------------------------------- intro

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const tA = s.win('hello', 'imitate');
    s.alpha(tA, () => {
      fitText(s, 'Reinforcement learning', w / 2, h * 0.42, w * 0.86, { size: 9, font: 'display', weight: 600 });
      s.text('for language models', w / 2, h * 0.42 + u * 10, { size: 5, italic: true, color: s.c('--ink-2') });
    });
    // Imitation: copy a target.
    const iA = s.win('imitate', 'judge');
    s.alpha(iA, () => {
      s.text('imitation', w / 2, h * 0.16, { size: 5.2, font: 'display', weight: 600, color: s.c('--ink-2') });
      chip(s, w / 2, h * 0.3, PROMPT, 'slate', { size: 4 });
      s.arrow(w / 2, h * 0.36, w / 2, h * 0.45, s.c('--ink-3'), 0.4, 2);
      s.rrect(w / 2 - u * 11, h * 0.46, u * 22, u * 9, 2, { fill: s.tint('blue', 0.1), stroke: s.c('blue'), lw: 0.4 });
      s.text('model', w / 2, h * 0.46 + u * 4.6, { size: 4.2, font: 'display', weight: 600, color: s.c('blue') });
      const oy = h * 0.46 + u * 18;
      const ox = w * 0.3;
      const tx = w * 0.7;
      s.arrow(w / 2 - u * 4, h * 0.46 + u * 9.5, ox + u * 4, oy - u * 4, s.c('--ink-3'), 0.4, 2);
      chip(s, ox, oy, 'No, 7×13.', 'purple', { size: 4, on: s.ease('imitate', 0.6, 1) });
      s.text('output', ox, oy + u * 6, { size: 3.4, italic: true, color: s.c('--ink-2') });
      const tOn = s.since('target') >= 0 ? 0.5 + 0.5 * Math.sin(s.since('target') * 4) : 0;
      chip(s, tx, oy, 'No, 7×13.', 'gold', { size: 4, on: tOn });
      s.text('target, written by a person', tx, oy + u * 6, { size: 3.4, italic: true, color: s.c('--ink-2') });
      s.text('copy', w / 2, oy - u * 0.2, { size: 3.4, font: 'mono', color: s.c('--ink-3') });
      s.alpha(s.ease('imitate', 0.6, 1.5), () => s.text('loss = -log probs[target]', w / 2, h * 0.88, { size: 3.8, font: 'mono', weight: 600 }));
    });
    // Judgment: try, then get scored.
    const jA = s.win('judge', 'next');
    if (jA > 0) {
      s.alpha(jA, () => {
        s.text('judgment', w / 2, h * 0.16, { size: 5.2, font: 'display', weight: 600, color: s.c('--ink-2') });
        chip(s, w / 2, h * 0.28, PROMPT, 'slate', { size: 4 });
        const cols = s.tall ? 2 : 4;
        const cw = s.tall ? w * 0.4 : w * 0.21;
        const ch = u * 15;
        const gx = (w - cols * cw - (cols - 1) * u * 3) / 2;
        ANSWERS.forEach((a, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = gx + col * (cw + u * 3);
          const y = h * (s.tall ? 0.38 : 0.44) + row * (ch + u * 4);
          const appear = s.ease('judge', 0.5, 0.25 * i);
          s.alpha(appear, () => {
            s.rrect(x, y, cw, ch, 2, { fill: s.c('--card'), stroke: s.tint('purple', 0.6), lw: 0.3 });
            s.text(`"${a}"`, x + cw / 2, y + ch * 0.32, { size: 3.6, font: 'mono' });
            const sc = s.ease('rl', 0.5, 1.2 + 0.4 * i);
            const pulse = s.since('number') >= 0 && s.since('next') < 0 ? 0.5 + 0.5 * Math.sin(s.since('number') * 5) : 0;
            s.alpha(sc, () => chip(s, x + cw / 2, y + ch * 0.72, `R = ${REWARD[i]}`, 'gold', { size: 3.4, on: pulse }));
            const up = s.ease('rl', 0.7, 3.4) * REWARD[i]!;
            if (up > 0.02) s.arrow(x + cw - u * 3, y + ch * 0.95, x + cw - u * 3, y + ch * 0.95 - up * u * 5.5, s.c('green'), 0.55, 1.8);
          });
        });
        s.alpha(s.ease('rl', 0.6, 4), () => s.text('high-R answers become more likely', w / 2, h * 0.9, { size: 3.6, italic: true, color: s.c('green') }));
      });
    }
    // Roadmap: three chapters on one foundation.
    const rA = s.ease('next', 0.7);
    s.alpha(rA, () => {
      const [x, y, aw, ah] = area(s, 0.14);
      const baseH = u * 11;
      const by = y + ah - baseH;
      s.rrect(x, by, aw, baseH, 2, { fill: s.tint('teal', 0.12), stroke: s.c('teal'), lw: 0.4 });
      fitText(s, 'this chapter: the policy gradient', x + aw / 2, by + baseH / 2, aw - u * 4, { size: 4.2, font: 'display', weight: 600, color: s.c('teal') });
      const items: [string, string, K][] = [
        ['RLHF + PPO', 'chapter 15', 'purple'],
        ['DPO', 'chapter 16', 'orange'],
        ['GRPO', 'chapter 17', 'green'],
      ];
      const gap = u * 3;
      const pw = (aw - 2 * gap) / 3;
      items.forEach(([a, b, k], i) => {
        const g = s.ease('next', 0.6, 1.2 + 0.7 * i);
        const ph = (by - y - u * 3) * 0.8 * g;
        s.alpha(g, () => box(s, x + i * (pw + gap), by - u * 2 - ph, pw, ph, a, b, k, 0, Math.min(4.6, (pw / u) * 0.15)));
      });
    });
  },
};

// ---------------------------------------------------------------- policy

const DEFS: [string, string][] = [
  ['words', 'state · policy · action · reward'],
  ['state', 'state: the prompt plus the tokens so far'],
  ['policy', 'policy: the model\'s softmax over next tokens'],
  ['action', 'action: the token it picks'],
  ['tree', 'every answer is a path down the tree'],
  ['walk', 'sampling: choose a branch at each step'],
  ['episode', 'episode: one complete answer'],
  ['reward', 'reward: one score, at the very end'],
  ['grades', '1: right with a reason · 0.5: right · 0: wrong'],
  ['trap', 'π(Yes) = 0.5: wrong half the time'],
];

const policy: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const [x, y, aw, ah] = area(s, 0.13);
    const tr: Rect = [x, y, aw, ah - u * 10];
    const walk = s.since('walk') >= 0;
    const a1 = s.since('action') >= 0 && s.since('tree') < 0 ? 1 : walk ? within(s, 'walk', 0.1, 0.45) : 0;
    const a2 = walk ? within(s, 'walk', 0.55, 0.9) : 0;
    const pulse = (id: string, until: string) => (s.since(id) >= 0 && s.since(until) < 0 ? 0.5 + 0.5 * Math.sin(s.since(id) * 4) : 0);
    tree(s, tr, {
      lit1: [0, a1],
      lit2: [0, 0, 0, a2],
      probs: s.ease('policy', 0.6),
      rewards: s.ease('reward', 0.6),
      rootOn: pulse('state', 'policy'),
      branchOn: pulse('policy', 'action'),
      wrong: s.win('trap', undefined, 0.6),
    });
    // The current definition, one line at the bottom.
    DEFS.forEach(([id], i) => {
      const next = DEFS[i + 1]?.[0];
      const a = s.win(id, next, 0.4);
      s.alpha(a, () => fitText(s, DEFS[i]![1], w / 2, h - u * 7, w - u * 8, { size: 4, font: 'ui', weight: 600, color: s.c(id === 'trap' ? 'red' : id === 'reward' || id === 'grades' ? 'gold' : 'purple') }));
    });
  },
};

// ---------------------------------------------------------------- logprob

const logprob: SceneDef = {
  marks: {
    id: { tex: String.raw`\log(ab) = \log a + \log b`, x: 0.5, y: 0.2, size: 5 },
    star: { tex: String.raw`\log \sympi(y) = \sum_t \log \sympi(y_t \mid x, y_{<t})`, x: 0.5, y: 0.2, size: 4.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    // A: two token probabilities multiply.
    const aA = s.win('chain', 'long');
    s.alpha(aA, () => {
      const cy = h * 0.42;
      const xs = [w * 0.24, w * 0.5];
      chip(s, xs[0]!, cy, 'No', 'purple', { size: 4.6 });
      chip(s, xs[1]!, cy, ', 7×13.', 'purple', { size: 4.6, on: s.ease('chain', 0.5, 1.5) });
      s.text('0.5', xs[0]!, cy + u * 9, { size: 5, font: 'mono', weight: 600, color: s.c('purple') });
      s.alpha(s.ease('chain', 0.5, 1.5), () => s.text('0.4', xs[1]!, cy + u * 9, { size: 5, font: 'mono', weight: 600, color: s.c('purple') }));
      s.alpha(s.ease('prod', 0.5), () => {
        s.text('×', (xs[0]! + xs[1]!) / 2, cy + u * 9, { size: 5, font: 'mono' });
        s.text('= 0.2', w * 0.74, cy + u * 9, { size: 5.6, font: 'mono', weight: 700, color: s.c('purple') });
        s.text('π(y)', w * 0.74, cy, { size: 4.4, font: 'serif', italic: true, color: s.c('purple') });
      });
      s.text('the probability of an answer is a product', w / 2, h * 0.2, { size: 3.8, italic: true, color: s.c('--ink-2') });
    });
    // B: a long answer underflows.
    const bA = s.win('long', 'logs');
    if (bA > 0) {
      const n = s.since('under') >= 0 ? Math.round(lerp(200, 1100, smooth(s.prog('under') * 1.4))) : Math.round(2 * 100 ** smooth(s.prog('long') * 1.15));
      s.slot('n', n);
      s.alpha(bA, () => {
        const cols = 50;
        const rows = 22;
        const cs = Math.min((w * 0.82) / cols, (h * 0.42) / rows);
        const gx = (w - cs * cols) / 2;
        const gy = h * 0.16;
        for (let i = 0; i < Math.min(n, cols * rows); i++) {
          const r = Math.floor(i / cols);
          const c = i % cols;
          s.ctx.fillStyle = s.tint('purple', 0.55);
          s.ctx.fillRect(gx + c * cs + 0.5, gy + r * cs + 0.5, cs - 1, cs - 1);
        }
        const ty = gy + rows * cs + u * 7;
        s.text(`${n} tokens, each with probability 0.5`, w / 2, ty, { size: 3.8, font: 'ui', color: s.c('--ink-2') });
        const e = n * Math.log10(0.5);
        const under = n > 1074;
        const shown = under ? '0.0' : `${(10 ** (e - Math.floor(e))).toFixed(1)}e${Math.floor(e)}`;
        s.text(`np.prod(p) = ${shown}`, w / 2, ty + u * 8, { size: 4.6, font: 'mono', weight: 650, color: s.c(under ? 'red' : '--ink') });
        s.alpha(under ? 1 : 0, () => s.text('underflow', w / 2, ty + u * 15, { size: 4.2, italic: true, weight: 600, color: s.c('red') }));
      });
    }
    // C: the log curve.
    const cA = s.win('logs', 'sum');
    if (cA > 0) {
      s.show('id', cA * s.ease('logs', 0.6, 0.8));
      s.alpha(cA, () => {
        const r = area(s, 0.3, 0.06);
        const { X, Y } = chart(s, r, [0, 1, -5, 0.4], { xTicks: [0, 0.5, 1], yTicks: [-4, -2, 0], xLabel: 'probability p', size: 3.1 });
        const xs: number[] = [];
        const ys: number[] = [];
        for (let i = 0; i <= 120; i++) {
          const p = 0.0067 + (i / 120) * (1 - 0.0067);
          xs.push(X(p));
          ys.push(Y(Math.log(p)));
        }
        poly(s, xs, ys, xs.length, s.c('purple'), 0.6);
        const pts: [number, string][] = [
          [1, 'log 1 = 0'],
          [0.5, 'log 0.5 = -0.69'],
          [0.01, 'log 0.01 = -4.6'],
        ];
        const off: [number, number, CanvasTextAlign][] = [
          [-2, -3.6, 'right'],
          [2, 4.2, 'left'],
          [2.6, 0, 'left'],
        ];
        pts.forEach(([p, lab], i) => {
          const a = s.since('scale') >= 0 ? within(s, 'scale', 0.08 + 0.3 * i, 0.2 + 0.3 * i) : 0;
          const [dx, dy, al] = off[i]!;
          s.alpha(a, () => {
            s.circle(X(p), Y(Math.log(p)), u * 1.3, { fill: s.c('purple') });
            s.text(lab, X(p) + dx * u, Y(Math.log(p)) + dy * u, { size: 3.4, font: 'mono', align: al, halo: true, weight: 600 });
          });
        });
      });
    }
    // D: sums stay healthy.
    const dA = s.ease('sum', 0.6);
    s.alpha(dA, () => {
      const cy = h * 0.5;
      const lx = s.tall ? w * 0.5 : w * 0.3;
      const rx = s.tall ? w * 0.5 : w * 0.7;
      const ly = s.tall ? h * 0.4 : cy;
      const ry = s.tall ? h * 0.62 : cy;
      s.text('multiply 1100 probabilities', lx, ly - u * 6, { size: 3.6, font: 'ui', color: s.c('--ink-2') });
      s.text('0.0', lx, ly + u * 2, { size: 7, font: 'mono', weight: 700, color: s.c('red') });
      s.text('add 1100 log-probabilities', rx, ry - u * 6, { size: 3.6, font: 'ui', color: s.c('--ink-2') });
      s.text('-762.5', rx, ry + u * 2, { size: 7, font: 'mono', weight: 700, color: s.c('green') });
      s.alpha(s.ease('star', 0.6), () => s.text('our path: log 0.5 + log 0.4 = -1.61', w / 2, h * 0.86, { size: 3.8, font: 'mono', weight: 600, color: s.c('purple') }));
      s.show('star', s.ease('star', 0.6));
    });
  },
};

// ---------------------------------------------------------------- expected

const expected: SceneDef = {
  draw(s) {
    const { u } = s;
    const [L, R] = split(s, area(s, 0.13), 0.5);
    const n = s.since('sample') < 0 ? 0 : Math.max(1, Math.round(1000 ** smooth(s.span('sample', 'recipe') * 1.05)));
    const nn = Math.min(1000, n);
    s.slot('N', nn);
    s.slot('est', nn ? fmt(SAMPLES.avg[nn - 1]!, 3) : '…');
    // The bandit, and the share of samples each answer gets.
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < nn; i++) counts[SAMPLES.ys[i]!]!++;
    bars(s, L, {
      labels: ANSWERS,
      pi: PI0,
      ghost: nn ? counts.map((c) => c / nn) : undefined,
      ghostK: 'slate',
      sub: REWARD.map((r) => `R ${r}`),
      show: (i) => `${Math.round(PI0[i]! * 100)}%`,
      max: 0.6,
      title: ' ',
    });
    const head = (str: string, a: number, k: K) => s.alpha(a, () => fitText(s, str, L[0] + L[2] / 2, L[1] + u * 2.2, L[2], { size: 3.8, font: 'mono', weight: 650, color: s.c(k), halo: true }));
    head('a four-armed bandit', s.win('name', 'random'), '--ink-2');
    head('E[R] = 0.35', s.win('calc', 'recipe'), 'gold');
    head('sample → score → average', s.ease('recipe', 0.6), 'teal');
    const cx = R[0] + R[2] / 2;
    // A few draws: a different reward each time.
    s.alpha(s.win('random', 'average'), () => {
      s.text('six samples', cx, R[1] + u * 2.5, { size: 3.6, font: 'ui', weight: 600, color: s.c('--ink-2') });
      const k = Math.min(6, Math.floor(s.since('random') * 1.8));
      const colW = R[2] / 3;
      const rowH = Math.min(u * 13, (R[3] - u * 8) / 2);
      for (let i = 0; i < k; i++) {
        const y = SAMPLES.ys[i]!;
        const x = R[0] + colW * ((i % 3) + 0.5);
        const yy = R[1] + u * 8 + rowH * Math.floor(i / 3);
        fitText(s, `"${ANSWERS[y]}"`, x, yy + u * 1.5, colW - u, { size: 3.4, font: 'mono' });
        chip(s, x, yy + u * 7, `R ${REWARD[y]}`, 'gold', { size: 3.3, on: i === k - 1 ? 1 : 0.2 });
      }
    });
    // The mean grade.
    s.alpha(s.win('average', 'weighted'), () => {
      s.text('E[R]', cx, R[1] + R[3] * 0.38, { size: 8, font: 'serif', italic: true, weight: 600, color: s.c('gold') });
      fitText(s, 'the mean grade over many samples', cx, R[1] + R[3] * 0.38 + u * 10, R[2], { size: 3.8, italic: true, color: s.c('--ink-2') });
    });
    // The weighted sum, term by term.
    s.alpha(s.win('weighted', 'huge'), () => {
      const terms = PI0.map((p, i) => [`${p} × ${REWARD[i]}`, fmt(p * REWARD[i]!, 2)] as const);
      terms.forEach(([t, v], i) => {
        const yy = R[1] + u * (5 + 7 * i);
        const a = s.ease('weighted', 0.4, 0.5 + 0.35 * i);
        s.alpha(a, () => {
          s.text(t, cx + u * 2, yy, { size: 4, font: 'mono', align: 'right' });
          s.text(`= ${v}`, cx + u * 4, yy, { size: 4, font: 'mono', align: 'left', color: s.c(Number(v) > 0 ? 'gold' : '--ink-3') });
        });
      });
      s.alpha(s.ease('calc', 0.6), () => {
        const yy = R[1] + u * 33;
        s.line(cx - u * 16, yy - u * 3.5, cx + u * 16, yy - u * 3.5, s.c('--ink-3'), 0.3);
        s.text('sum = 0.35', cx, yy, { size: 4.4, font: 'mono', weight: 700, color: s.c('gold') });
      });
    });
    // Too many answers to sum.
    s.alpha(s.win('huge', 'sample'), () => {
      const cy = R[1] + R[3] / 2;
      fitText(s, '50,000-token vocabulary, 100 tokens:', cx, cy - u * 8, R[2] - u * 2, { size: 3.6, font: 'ui', color: s.c('--ink-2') });
      s.text('~10^470 answers', cx, cy, { size: 5, font: 'mono', weight: 650 });
      s.text('atoms in the universe: ~10^80', cx, cy + u * 8, { size: 3.4, font: 'ui', italic: true, color: s.c('--ink-3') });
    });
    // The running average.
    s.alpha(s.ease('sample', 0.6), () => {
      const { X, Y } = chart(s, R, [1, 1000, 0, 1], { logX: true, xTicks: [1, 10, 100, 1000], yTicks: [0, 0.5, 1], xLabel: 'samples N', title: 'running average of R', titleK: 'purple', xFmt: (v) => (v >= 1000 ? '1k' : String(v)) });
      s.line(X(1), Y(0.35), X(1000), Y(0.35), s.c('gold'), 0.4, [1.5, 1]);
      s.text('0.35', X(1000), Y(0.35) - u * 2.5, { size: 3.2, font: 'mono', align: 'right', color: s.c('gold'), halo: true });
      const xs = Array.from({ length: nn }, (_, i) => X(i + 1));
      const ys = SAMPLES.avg.slice(0, nn).map((v) => Y(v));
      poly(s, xs, ys, nn, s.c('purple'), 0.5);
      if (nn) s.circle(xs[nn - 1]!, ys[nn - 1]!, u * 1, { fill: s.c('purple') });
    });
  },
};

// ---------------------------------------------------------------- trick

const trick: SceneDef = {
  marks: {
    J: { tex: String.raw`J(\symtheta) = \sum_y \sympi(y)\,\symR(y)`, x: 0.5, y: 0.3, size: 5.2 },
    dJ: { tex: String.raw`\nabla_\theta J = \sum_y \nabla_\theta\sympi(y)\,\symR(y)`, x: 0.5, y: 0.5, size: 5.2 },
    trick: { tex: String.raw`\nabla_\theta\sympi(y) = \sympi(y)\;\symg(y)`, x: 0.5, y: 0.36, size: 5.6 },
    chain: { tex: String.raw`\dfrac{d}{d\theta}\log u = \dfrac{1}{u}\,\dfrac{du}{d\theta}`, x: 0.5, y: 0.6, size: 4.8 },
    back: { tex: String.raw`\nabla_\theta J = \sum_y \sympi(y)\,\symR(y)\,\symg(y)`, x: 0.5, y: 0.36, size: 5 },
    pg: { tex: String.raw`\nabla_\theta J = \mathbb{E}_{y\sim\sympi}\big[\symR(y)\,\symg(y)\big]`, x: 0.5, y: 0.58, size: 5.2 },
  },
  draw(s) {
    const { w, h, u } = s;
    const p1 = s.win('goal', 'trick');
    s.show('J', p1 * s.ease('goal', 0.6));
    s.show('dJ', p1 * s.ease('diff', 0.6, 1));
    s.alpha(p1 * s.ease('snag', 0.6), () => {
      s.text('no π(y) weight in front:', w / 2, h * 0.66, { size: 3.8, font: 'ui', weight: 600, color: s.c('red') });
      s.text('not an average, so no sampling', w / 2, h * 0.66 + u * 6, { size: 3.8, font: 'ui', color: s.c('red') });
    });
    const p2 = s.win('trick', 'back');
    s.alpha(p2, () => {
      const bw = Math.min(w * 0.86, u * 80);
      s.rrect(w / 2 - bw / 2, h * 0.36 - u * 8, bw, u * 16, 2.5, { fill: s.tint('teal', 0.08), stroke: s.c('teal'), lw: 0.4 });
      s.text('the log-derivative trick', w / 2, h * 0.2, { size: 4, font: 'display', weight: 600, color: s.c('teal') });
      s.alpha(s.ease('chain', 0.5), () => s.text('the chain rule, nothing more', w / 2, h * 0.74, { size: 3.6, italic: true, color: s.c('--ink-2') }));
    });
    s.show('trick', p2);
    s.show('chain', p2 * s.ease('chain', 0.6));
    const p3 = s.win('back', 'recipe');
    s.show('back', p3);
    s.show('pg', s.ease('pg', 0.6) * (1 - s.ease('recipe', 0.6)) + s.ease('recipe', 0.6), { y: lerp(0.58, 0.24, s.ease('recipe', 0.8)) });
    s.alpha(p3 * s.ease('back', 0.5, 0.8), () => s.text('the weight π(y) is back', w / 2, h * 0.47, { size: 3.6, italic: true, color: s.c('purple') }));
    // The recipe as a pipeline.
    const p4 = s.ease('recipe', 0.6);
    s.alpha(p4, () => {
      const steps: [string, K][] = [
        ['sample y', 'purple'],
        ['∇ log π(y)', 'teal'],
        ['× R(y)', 'gold'],
        ['average', '--ink'],
      ];
      const cols = s.tall ? 2 : 4;
      const gap = u * 4;
      const bw = (w * 0.9 - gap * (cols - 1)) / cols;
      const bh = u * 10;
      const x0 = w * 0.05;
      const y0 = h * 0.42;
      steps.forEach(([t, k], i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const x = x0 + c * (bw + gap);
        const y = y0 + r * (bh + u * 5);
        const a = s.ease('recipe', 0.4, 0.5 + 0.6 * i);
        s.alpha(a, () => {
          s.rrect(x, y, bw, bh, 2, { fill: s.tint(k, 0.1), stroke: s.c(k), lw: 0.35 });
          s.text(t, x + bw / 2, y + bh / 2, { size: 3.8, font: 'mono', weight: 600 });
          if (c > 0) s.arrow(x - gap + u * 0.6, y + bh / 2, x - u * 0.6, y + bh / 2, s.c('--ink-3'), 0.35, 1.6);
        });
      });
      // The grader is a black box.
      const gA = s.ease('black', 0.6);
      s.alpha(gA, () => {
        const gy = s.tall ? y0 + 2 * (bh + u * 5) + u * 2 : y0 + bh + u * 9;
        const gw = u * 22;
        const gx = w / 2 - u * 34;
        s.rrect(gx, gy, gw, u * 10, 2, { fill: s.c('--ink'), stroke: s.c('--ink') });
        s.text('grader', gx + gw / 2, gy + u * 5, { size: 3.8, font: 'mono', weight: 650, color: s.c('--card') });
        s.arrow(gx + gw + u, gy + u * 5, gx + gw + u * 7, gy + u * 5, s.c('--ink-3'), 0.4, 1.8);
        chip(s, gx + gw + u * 15, gy + u * 5, 'R = 1', 'gold', { size: 3.8, on: 1 });
        s.text('no gradient needed', gx + gw + u * 25, gy + u * 5, { size: 3.4, italic: true, align: 'left', color: s.c('--ink-2') });
      });
    });
    s.alpha(s.ease('heart', 0.5) * (0.5 + 0.5 * Math.sin(s.since('heart') * 3)), () => {
      const bw = Math.min(w * 0.9, u * 86);
      s.rrect(w / 2 - bw / 2, h * 0.24 - u * 7, bw, u * 14, 2.5, { stroke: s.c('teal'), lw: 0.5 });
    });
  },
};

// ---------------------------------------------------------------- softmax

const THETA0 = PI0.map(Math.log);
const GRAD3 = PI0.map((p, i) => (i === 3 ? 1 : 0) - p);

const softmaxScene: SceneDef = {
  marks: {
    g: { tex: String.raw`\symg(y) = \mathbf{e}_y - \sympi`, x: 0.5, y: 0.2, size: 5.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    // Logits through a softmax.
    const p1 = s.win('logits', 'formula');
    s.alpha(s.win('left', 'logits'), () => s.text('∇ log π(y), for a softmax policy', w / 2, h * 0.45, { size: 4.6, font: 'display', weight: 600, color: s.c('teal') }));
    s.alpha(p1, () => {
      const cw = Math.min(u * 16, w * 0.18);
      const ch = u * 8.5;
      const lx = w * 0.5 - cw * 1.9;
      const rx = w * 0.5 + cw * 1.4;
      const y0 = h * 0.24;
      s.text('θ  logits', lx + cw / 2, y0 - u * 4, { size: 3.8, font: 'mono', weight: 650, color: s.c('blue') });
      s.text('π  probs', rx + cw / 2, y0 - u * 4, { size: 3.8, font: 'mono', weight: 650, color: s.c('purple') });
      ANSWERS.forEach((a, i) => {
        const y = y0 + i * (ch + u * 1.6);
        s.text(a, lx - u * 2, y + ch / 2, { size: 3.4, font: 'mono', align: 'right', color: s.c('--ink-2') });
        s.cell(lx, y, cw, ch, fmt(THETA0[i]!, 2), 'blue', { size: 3.6 });
        s.alpha(s.ease('logits', 0.5, 1.5 + 0.2 * i), () => s.cell(rx, y, cw, ch, fmt(PI0[i]!, 2), 'purple', { size: 3.6 }));
      });
      const my = y0 + 2 * (ch + u * 1.6) - u;
      s.arrow(lx + cw + u * 2, my, rx - u * 2, my, s.c('--ink-3'), 0.4, 2);
      s.text('softmax', (lx + cw + rx) / 2, my - u * 3, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
    });
    // One-hot minus probabilities.
    const p2 = s.win('formula', 'ce');
    s.show('g', p2);
    s.alpha(p2, () => {
      const cw = s.tall ? Math.min(u * 15, w * 0.2) : Math.min(u * 12, w * 0.15);
      const ch = s.tall ? u * 8.5 : u * 7.5;
      const gap = u * 6;
      const total = 3 * cw + 2 * gap;
      const x0 = (w - total) / 2;
      const y0 = h * 0.36;
      const cols: [string, string[], K][] = [
        ['e_y', ['0', '0', '0', '1'], 'gold'],
        ['π', PI0.map((p) => fmt(p, 2)), 'purple'],
        ['∇ log π(y)', GRAD3.map((v) => fmt(v, 2)), 'teal'],
      ];
      cols.forEach(([head, vals, k], c) => {
        const x = x0 + c * (cw + gap);
        const a = c < 2 ? 1 : s.ease('read', 0.6, 0.6);
        s.alpha(a, () => {
          s.text(head, x + cw / 2, y0 - u * 3.6, { size: 3.6, font: 'mono', weight: 650, color: s.c(k) });
          vals.forEach((v, i) => s.cell(x, y0 + i * (ch + u * 1.2), cw, ch, v, k, { size: 3.8, on: s.since('example') >= 0 && s.since('ce') < 0 && i === 3 ? 0.8 : 0 }));
        });
      });
      s.text('−', x0 + cw + gap / 2, y0 + 2 * (ch + u * 1.2), { size: 6, font: 'mono' });
      s.alpha(s.ease('read', 0.6, 0.6), () => s.text('=', x0 + 2 * cw + gap * 1.5, y0 + 2 * (ch + u * 1.2), { size: 6, font: 'mono' }));
      s.alpha(s.ease('example', 0.6), () => s.text('sampled: "No, 7×13."  up 0.8, the rest down', w / 2, y0 + 4 * (ch + u * 1.2) + u * 4, { size: 3.4, font: 'ui', color: s.c('--ink-2') }));
      s.alpha(s.ease('zero', 0.6), () => s.text('-0.4 - 0.1 - 0.3 + 0.8 = 0', w / 2, y0 + 4 * (ch + u * 1.2) + u * 10, { size: 3.8, font: 'mono', weight: 650, color: s.c('teal') }));
    });
    // The same as a classifier's gradient, sign flipped.
    const p3 = s.win('ce', 'scaled');
    s.alpha(p3, () => {
      const y0 = h * 0.3;
      fitText(s, 'softmax classifier:  probs − onehot(label)', w / 2, y0, w - u * 8, { size: 4, font: 'mono', weight: 600, color: s.c('--ink-2') });
      fitText(s, 'policy gradient:  onehot(sample) − probs', w / 2, y0 + u * 11, w - u * 8, { size: 4, font: 'mono', weight: 650, color: s.c('teal') });
      s.alpha(s.ease('supervised', 0.6), () => {
        s.text('the model\'s own sample plays the label', w / 2, y0 + u * 25, { size: 4, italic: true, color: s.c('purple') });
      });
    });
    // Scaled by the reward.
    const p4 = s.win('scaled', 'tokens');
    s.alpha(p4, () => {
      const rows: [string, number][] = [
        ['"No, 7×13."  R = 1', 1],
        ['"No."  R = 0.5', 0.5],
        ['"Yes."  R = 0', 0],
      ];
      rows.forEach(([lab, r], i) => {
        const y = h * 0.3 + i * u * 14;
        s.text(lab, w * 0.46, y, { size: 3.8, font: 'mono', align: 'right' });
        const len = r * w * 0.36;
        if (len > 1) s.arrow(w * 0.5, y, w * 0.5 + len * s.ease('scaled', 0.8, 0.4 * i), y, s.c('teal'), 0.9, 2.5);
        else s.text('no step', w * 0.5, y, { size: 3.6, italic: true, align: 'left', color: s.c('--ink-3') });
      });
      s.text('step size = R × (onehot − probs)', w / 2, h * 0.3 + u * 44, { size: 3.6, font: 'mono', color: s.c('--ink-2') });
    });
    // Every token is a softmax too.
    const p5 = s.ease('tokens', 0.6);
    s.alpha(p5, () => {
      const toks = ['No', ',', ' 7', '×', '13', '.'];
      const tw = Math.min(u * 14, (w * 0.9) / toks.length);
      const x0 = (w - tw * toks.length) / 2;
      const by = h * 0.62;
      const rng = new Rng(5);
      toks.forEach((t, i) => {
        const x = x0 + i * tw;
        const a = s.ease('tokens', 0.4, 0.25 * i);
        s.alpha(a, () => {
          for (let k = 0; k < 5; k++) {
            const v = k === 0 ? 0.55 + 0.4 * rng.next() : 0.15 * rng.next();
            const bh = v * u * 22;
            s.rrect(x + tw * 0.15 + k * tw * 0.14, by - bh, tw * 0.11, bh, 0.3, { fill: s.tint(k === 0 ? 'teal' : 'purple', k === 0 ? 0.7 : 0.4) });
          }
          chip(s, x + tw / 2, by + u * 5, t.trim(), 'purple', { size: 3.6 });
        });
      });
      s.text('one softmax per token: the same formula at each', w / 2, h * 0.25, { size: 3.8, italic: true, color: s.c('--ink-2') });
    });
  },
};

// ---------------------------------------------------------------- reinforce

const reinforce: SceneDef = {
  marks: {
    loss: { tex: String.raw`\mathcal{L}(\symtheta) = -\frac{1}{N}\sum_i \symR(y_i)\,\log\sympi(y_i)`, x: 0.5, y: 0.5, size: 5 },
  },
  draw(s) {
    const { w, h, u } = s;
    const [L, R] = split(s, area(s, 0.13), stacked(s) ? 0.55 : 0.5);
    let step = 0;
    let ring = -1;
    if (s.since('steps') >= 0) {
      step = 0;
      ring = s.prog('steps') > 0.35 ? RUN.ys[0]! : -1;
    }
    if (s.since('wrong') >= 0) {
      step = 1;
      ring = RUN.ys[0]!;
    }
    if (s.since('right') >= 0) {
      step = within(s, 'right', 0.25, 0.4) > 0 ? 2 : 1;
      ring = RUN.ys[1]!;
    }
    if (s.since('drift') >= 0) {
      step = Math.round(lerp(2, RUN_STEPS, smooth(s.span('drift', 'noisy') * 1.05)));
      ring = RUN.ys[step - 1]!;
    }
    if (s.since('noisy') >= 0) {
      step = RUN_STEPS;
      ring = -1;
    }
    s.slot('step', step);
    s.slot('y', step ? `${RUN.ys[step - 1]} "${ANSWERS[RUN.ys[step - 1]!]}"` : '…');
    const dim = 1 - 0.88 * s.ease('loss', 0.6);
    const pi = RUN.pis[step]!;
    const prev = RUN.pis[Math.max(0, step - 1)]!;
    s.alpha(dim, () => {
      const b = bars(s, L, { labels: ANSWERS, pi, hi: ring >= 0 ? ring : undefined, sub: REWARD.map((r) => `R ${r}`), show: (i) => `${Math.round(pi[i]! * 100)}%`, title: ' ' });
      if (s.since('right') >= 0 && s.since('drift') < 0 && step === 2)
        b.xs.forEach((x, i) => {
          const d = pi[i]! - prev[i]!;
          if (Math.abs(d) < 0.003) return;
          const ax = x + b.bw / 2 + u * 2.2;
          const y1 = b.sy(pi[i]!);
          const y0 = d > 0 ? Math.max(b.sy(prev[i]!), y1 + u * 3) : Math.min(b.sy(prev[i]!), y1 - u * 3);
          s.arrow(ax, y0, ax, y1, s.c(d > 0 ? 'green' : 'red'), 0.55, 1.6);
          s.text(`${d > 0 ? '+' : '−'}${Math.round(Math.abs(d) * 100)}`, ax, Math.min(y0, y1) - u * 2.4, { size: 3, font: 'mono', weight: 650, color: s.c(d > 0 ? 'green' : 'red'), halo: true });
        });
      const note = s.since('wrong') >= 0 && s.since('right') < 0 ? 'R = 0: nothing moves' : s.since('right') >= 0 && s.since('drift') < 0 && step === 2 ? 'R = 1: up, the rest down' : '';
      if (note) s.text(note, L[0] + L[2] / 2, L[1] + u * 2.2, { size: 3.8, font: 'mono', weight: 650, color: s.c(note.startsWith('R = 0') ? '--ink-2' : 'green'), halo: true });
      s.alpha(s.win('name', 'start'), () => fitText(s, 'REINFORCE · Williams, 1992', L[0] + L[2] / 2, L[1] + u * 2.2, L[2], { size: 3.8, font: 'mono', weight: 650, color: s.c('purple'), halo: true }));
      // E[R] along the run.
      const { X, Y } = chart(s, R, [0, RUN_STEPS, 0, 1], { xTicks: [0, 100, 200], yTicks: [0, 0.5, 1], xLabel: 'step', title: 'E[R] of the policy', titleK: 'gold' });
      const n = step + 1;
      poly(s, RUN.er.map((_, i) => X(i)), RUN.er.map((v) => Y(v)), n, s.c('gold'), 0.55);
      const oa = s.ease('noisy', 0.8);
      s.alpha(oa, () => RUN_OTHERS.forEach((c) => poly(s, Array.from(c, (_, i) => X(i)), Array.from(c, (v) => Y(v)), c.length, s.tint('gold', 0.45), 0.35)));
      s.alpha(oa, () => s.text('other seeds', X(RUN_STEPS) - u, Y(0.25), { size: 3.2, align: 'right', italic: true, color: s.c('--ink-3'), halo: true }));
    });
    s.show('loss', s.ease('loss', 0.6), { y: stacked(s) ? 0.36 : 0.45 });
    s.alpha(s.ease('weighted', 0.6), () => fitText(s, 'cross-entropy on its own samples, weighted by R', w / 2, h * (stacked(s) ? 0.52 : 0.62), w - u * 8, { size: 4, italic: true, color: s.c('purple'), halo: true }));
  },
};

// ---------------------------------------------------------------- baselines

const STUCK_SHIFT = VAR_SHIFT.map((c) => c[VAR_STEPS]! < 0.6);

const baselines: SceneDef = {
  marks: {
    zero: { tex: String.raw`\mathbb{E}[\symg] = \textstyle\sum_y \nabla_\theta\sympi(y) = \nabla_\theta 1 = 0`, x: 0.5, y: 0.35, size: 4.4 },
    adv: { tex: String.raw`\symA = \symR - \symb`, x: 0.5, y: 0.35, size: 5 },
  },
  draw(s) {
    const { w, h, u } = s;
    const [P, C] = split(s, area(s, 0.13), stacked(s) ? 0.45 : 0.46);
    const fam = s.ease('family', 0.6);
    const shift = VAR_C * s.ease('shift', 1.2, 0.5);
    // Pushes proportional to the reward.
    const pA = s.win('noise', 'fix') * (1 - fam);
    s.alpha(pA, () => {
      const scale = (r: number) => (0.9 * (r + shift)) / (1 + shift);
      const b = bars(s, P, { labels: ANSWERS, pi: REWARD.map(scale), k: 'gold', sub: REWARD.map((r) => `R ${fmt(r + shift, 2)}`), size: 3.4, title: shift > 0.05 ? `every reward + ${fmt(shift, 2)}` : 'push on each answer ∝ R' });
      s.alpha(s.ease('all', 0.6), () =>
        b.xs.forEach((x, i) => {
          const r = REWARD[i]! + shift;
          if (r < 0.02) return;
          s.arrow(x, b.y0 - u * 0.6, x, b.sy(scale(REWARD[i]!)) + u * 0.8, s.c('green'), 0.7, 2);
        }),
      );
    });
    // Advantages around the baseline, on a zoomed scale.
    const aA = s.win('fix', 'why') * (1 - fam);
    s.alpha(aA, () => {
      const base = 0.35 + VAR_C;
      const [x, y, pw, ph] = P;
      const lo = 1.8;
      const hi = 3.2;
      const top = y + u * 9;
      const bot = y + ph - u * 8;
      const Yv = (v: number) => bot - ((v - lo) / (hi - lo)) * (bot - top);
      const slot = pw / 4;
      const fs = Math.min(3.4, (pw / u) * 0.034);
      s.text('A = R − b: better or worse than usual', x + pw / 2, y + u * 2.2, { size: 3.6, font: 'mono', weight: 650, color: s.c('red'), halo: true });
      s.alpha(s.ease('fix', 0.6, 0.6), () => {
        s.line(x, Yv(base), x + pw, Yv(base), s.c('green'), 0.5, [1.5, 1]);
        s.text(`b = ${fmt(base, 3)}`, x + pw, Yv(base) + u * 3, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('green'), halo: true });
      });
      ANSWERS.forEach((ans, i) => {
        const cx = x + slot * (i + 0.5);
        const r = REWARD[i]! + VAR_C;
        const A = r - base;
        s.text(ans, cx, y + ph - u * 3, { size: fs, font: 'mono' });
        s.alpha(s.ease('adv', 0.6), () => {
          s.arrow(cx, Yv(base), cx, Yv(r) + (A > 0 ? u * 1.2 : -u * 1.2), s.c(A > 0 ? 'green' : 'red'), 0.7, 1.8);
          s.text(`${A > 0 ? '+' : ''}${fmt(A, 2)}`, cx + u * 1.6, (Yv(base) + Yv(r)) / 2, { size: 3.2, font: 'mono', align: 'left', weight: 650, color: s.c(A > 0 ? 'green' : 'red'), halo: true });
        });
        s.circle(cx, Yv(r), u * 1.4, { fill: s.c('gold') });
        s.text(`R ${fmt(r, 2)}`, cx, Yv(r) + (A > 0 ? -u * 3.2 : u * 3.4), { size: 3.1, font: 'mono', color: s.c('gold'), halo: true });
      });
    });
    // Why a baseline is free.
    const zA = s.win('why', 'tight') * (1 - fam);
    s.show('zero', zA, { x: (P[0] + P[2] / 2) / w, y: (P[1] + P[3] * 0.35) / h });
    s.alpha(zA * s.ease('free', 0.6), () => {
      fitText(s, 'so  E[(R − b) ∇log π] = E[R ∇log π]', P[0] + P[2] / 2, P[1] + P[3] * 0.62, P[2] - u * 2, { size: 3.8, font: 'mono', weight: 600, color: s.c('teal') });
      s.text('same average, less noise', P[0] + P[2] / 2, P[1] + P[3] * 0.62 + u * 7, { size: 3.6, italic: true, color: s.c('--ink-2') });
    });
    s.alpha(s.win('tight', 'family') * (1 - fam), () => {
      s.text('b: a running mean of R', P[0] + P[2] / 2, P[1] + P[3] * 0.35, { size: 4, font: 'mono', weight: 650, color: s.c('green') });
      s.alpha(s.ease('teach', 0.6), () => s.text('worse than usual: pushed down', P[0] + P[2] / 2, P[1] + P[3] * 0.35 + u * 8, { size: 3.6, italic: true, color: s.c('red') }));
    });
    // Eight runs.
    const cA = s.ease('runs', 0.6) * (1 - fam);
    s.alpha(cA, () => {
      const mode = s.since('tight') >= 0 ? 2 : s.since('fan') >= 0 ? 1 : 0;
      const data = mode === 2 ? VAR_BASE : mode === 1 ? VAR_SHIFT : VAR_PLAIN;
      const from = mode === 2 ? 'tight' : mode === 1 ? 'fan' : 'runs';
      const rev = s.ease(from, 1.6, 0.3);
      const title = mode === 2 ? `8 runs, R + ${VAR_C}, with a baseline` : mode === 1 ? `8 runs, R + ${VAR_C}, no baseline` : '8 runs, no baseline';
      const { X, Y } = chart(s, C, [0, VAR_STEPS, 0, 1], { xTicks: [0, 50, 100, 150], yTicks: [0, 0.5, 1], xLabel: 'step', title, titleK: mode === 2 ? 'green' : 'gold' });
      const n = Math.max(2, Math.round(rev * VAR_STEPS) + 1);
      const xs = Array.from({ length: VAR_STEPS + 1 }, (_, i) => X(i));
      const red = mode === 1 ? s.ease('stuck', 0.6) : 0;
      data.forEach((c, j) => {
        const col = mode === 2 ? s.tint('green', 0.85) : red > 0.5 && STUCK_SHIFT[j] ? s.c('red') : s.tint('gold', 0.85);
        poly(s, xs, Array.from(c, (v) => Y(v)), n, col, 0.4);
      });
    });
    // What a baseline can be.
    s.alpha(fam, () => {
      const items: [string, string, K][] = [
        ['running mean', 'this chapter', 'green'],
        ['group mean', 'GRPO', 'teal'],
        ['value function', 'PPO', 'purple'],
      ];
      const r = area(s, 0.2);
      const gap = u * 3;
      const cols = s.tall ? 1 : 3;
      const bw = (r[2] - gap * (cols - 1)) / cols;
      const bh = s.tall ? u * 14 : u * 22;
      items.forEach(([a, b, k], i) => {
        const x = r[0] + (i % cols) * (bw + gap);
        const y = r[1] + u * 6 + Math.floor(i / cols) * (bh + gap);
        s.alpha(s.ease('family', 0.5, 0.4 + 0.5 * i), () => box(s, x, y, bw, bh, a, b, k, 0, 4.4));
      });
      s.text('all estimate the average reward', w / 2, h * 0.9, { size: 3.8, italic: true, color: s.c('--ink-2') });
    });
  },
};

// ---------------------------------------------------------------- credit

const tintA = (s: Scene, a: number): string => s.tint(a >= 0 ? 'green' : 'red', 0.12 + 0.5 * Math.min(1, Math.abs(a)));

const credit: SceneDef = {
  marks: {
    seq: { tex: String.raw`\nabla_\theta J = \mathbb{E}\big[\textstyle\sum_t \symA_t\,\nabla_\theta\log\sympi(y_t \mid \cdot)\big]`, x: 0.5, y: 0.62, size: 4.4 },
    same: { tex: String.raw`\symA_t = \symR - \symb \;\text{ for every } t`, x: 0.5, y: 0.76, size: 4.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    const r = area(s, 0.13);
    const [P, C] = split(s, r, 0.5);
    const val = s.ease('value', 0.6);
    // One long answer and one reward.
    const oneA = s.win('tokens', 'rows');
    s.alpha(oneA, () => {
      const toks = ['Let', ' me', ' think', '.', ' 91', ' =', ' 7', '×', '13', '.', ' Not', ' prime', '.'];
      const fs = 3.4;
      let x = r[0];
      let y = h * 0.3;
      toks.forEach((t, i) => {
        const tw = s.measure(t.trim(), { font: 'mono', size: fs, weight: 600 }) + u * 3;
        if (x + tw > r[0] + r[2]) {
          x = r[0];
          y += u * 8;
        }
        const tint = s.ease('same', 0.6, 0.6) > 0 ? tintA(s, 0.46 * s.ease('same', 0.6, 0.6)) : s.tint('purple', 0.1);
        s.alpha(s.ease('tokens', 0.3, 0.12 * i), () => {
          s.rrect(x, y - u * 3, tw, u * 6, 1.2, { fill: tint, stroke: s.tint('purple', 0.5), lw: 0.25 });
          s.text(t.trim(), x + tw / 2, y, { size: fs, font: 'mono', weight: 600 });
        });
        x += tw + u * 1.2;
      });
      const wrapR = x + u * 14 > r[0] + r[2];
      s.alpha(s.ease('tokens', 0.5, 2), () => chip(s, wrapR ? r[0] + u * 7 : x + u * 7, wrapR ? y + u * 8 : y, 'R = 1', 'gold', { size: 3.6, on: 1 }));
      s.alpha(s.win('which', 'sum'), () => s.text('which tokens earned it?', w / 2, h * 0.5, { size: 4.4, italic: true, color: s.c('--ink-2') }));
    });
    s.show('seq', oneA * s.ease('sum', 0.6));
    s.show('same', oneA * s.ease('same', 0.6));
    // Many answers, tinted by advantage.
    const rowsA = s.ease('rows', 0.6) * (1 - val);
    const k = s.since('average') >= 0 ? Math.min(CREDIT_STEPS.length - 1, Math.floor(s.span('average', 'stats') * CREDIT_STEPS.length)) : 0;
    const st = CREDIT_STATS[k]!;
    s.slot('N', CREDIT_STEPS[k]!);
    s.alpha(rowsA, () => {
      const rows = stacked(s) ? 5 : 8;
      const fs = stacked(s) ? 3.3 : Math.min(3.1, (P[2] / u) * 0.031);
      const rh = Math.min(u * 7, (P[3] - u * 6) / rows);
      s.text(`${rows} of ${CREDIT_STEPS[k]} answers, tinted by A`, P[0], P[1] + u * 2, { size: 3.4, font: 'ui', weight: 600, align: 'left', color: s.c('--ink-2') });
      for (let i = 0; i < rows; i++) {
        const resp = CREDIT[i]!;
        const a = CREDIT_STATS[0]!.A[i]!;
        let x = P[0];
        const y = P[1] + u * 6 + i * rh;
        const tint = s.ease('tint', 0.6) > 0.01 ? tintA(s, a * s.ease('tint', 0.6)) : s.tint('slate', 0.1);
        s.alpha(s.ease('rows', 0.3, 0.15 * i), () =>
          resp.parts.forEach((c) => {
            const txt = CHUNKS[c]!;
            const tw = s.measure(txt, { font: 'mono', size: fs, weight: 600 }) + u * 2;
            const hl = c < 2 && s.since('filler') >= 0 && s.since('average') < 0;
            s.rrect(x, y + u * 0.4, tw, rh - u * 1.2, 1, { fill: tint, stroke: hl ? s.c('gold') : s.tint('slate', 0.5), lw: hl ? 0.5 : 0.2 });
            s.text(txt, x + tw / 2, y + rh / 2, { size: fs, font: 'mono', weight: 600 });
            x += tw + u * 0.8;
          }),
        );
      }
    });
    // Each chunk's average push.
    const bA = s.ease('rows', 0.6, 1) * (1 - val);
    s.alpha(bA, () => {
      const fs = Math.min(3.2, (C[2] / u) * 0.034);
      const labW = Math.max(...CHUNKS.map((t) => s.measure(t, { font: 'mono', size: fs }))) + u * 2;
      const x0 = C[0] + labW + (C[2] - labW - u * 9) / 2;
      const half = (C[2] - labW - u * 9) / 2;
      const top = C[1] + u * 6;
      const bh = (C[3] - u * 6) / CHUNKS.length;
      s.text('average push per chunk', C[0], C[1] + u * 2, { size: 3.4, font: 'ui', weight: 600, align: 'left', color: s.c('--ink-2') });
      s.line(x0, top, x0, top + bh * CHUNKS.length, s.c('--axis'), 0.3);
      CHUNKS.forEach((t, c) => {
        const y = top + c * bh;
        const hl = c < 2 && s.since('filler') >= 0 && s.since('average') < 0;
        s.text(t, C[0], y + bh / 2, { size: fs, font: 'mono', align: 'left', color: s.c(hl ? 'gold' : '--ink'), weight: hl ? 700 : 500 });
        const v = st.avg[c] ?? 0;
        const ww = Math.max(-1, Math.min(1, v / 0.6)) * half;
        s.rrect(ww >= 0 ? x0 : x0 + ww, y + bh * 0.2, Math.abs(ww), bh * 0.6, 0.6, { fill: tintA(s, v * 1.6), stroke: s.c(v >= 0 ? 'green' : 'red'), lw: 0.2 });
        s.text(`${v >= 0 ? '+' : ''}${fmt(v, 2)}`, C[0] + C[2], y + bh / 2, { size: fs * 0.95, font: 'mono', align: 'right', color: s.c(v >= 0 ? 'green' : 'red') });
        s.alpha(s.ease('average', 0.6), () => {
          const tx = x0 + (CREDIT_LIMIT[c]! / 0.6) * half;
          s.line(tx, y + bh * 0.08, tx, y + bh * 0.92, s.c('--ink'), 0.5);
        });
      });
    });
    // A value function sees the jump.
    s.alpha(val, () => {
      const V = [CREDIT_ER, CREDIT_ER, P_RIGHT[0]!, 1];
      const labs = ['prompt', 'Let me think.', '91 = 7×13.', 'Not prime.'];
      const { X, Y } = chart(s, area(s, 0.16, 0.06), [-0.3, 3.3, 0, 1.05], { yTicks: [0, 0.5, 1], title: 'V: the predicted grade so far', titleK: 'teal' });
      const xs = [0, 1, 2, 3].map((i) => X(i));
      const ys = V.map((v) => Y(v));
      poly(s, xs, ys, 4, s.c('teal'), 0.6);
      V.forEach((v, i) => {
        s.circle(xs[i]!, ys[i]!, u * 1.4, { fill: s.c('teal') });
        s.text(fmt(v, 2), xs[i]!, ys[i]! - u * 3.4, { size: 3.4, font: 'mono', weight: 600, halo: true });
        fitText(s, labs[i]!, xs[i]!, Y(0) + u * 3, (X(1) - X(0)) * 0.95, { size: 3.2, font: 'mono', color: s.c('--ink-2') });
      });
      s.alpha(s.ease('jump', 0.6), () => {
        s.arrow(xs[2]! + u * 4, ys[1]!, xs[2]! + u * 4, ys[2]! + u * 1, s.c('green'), 0.6, 2);
        s.text('+0.36: the credit', (xs[1]! + xs[2]!) / 2, ys[1]! + u * 6, { size: 3.6, font: 'mono', weight: 650, color: s.c('green'), halo: true });
      });
    });
  },
};

// ---------------------------------------------------------------- KL

const LABELS_KL = ['Yes.', 'Yes, odd.', 'No.', 'No, 7×13.', 'No!! 7×13!!'];

const kl: SceneDef = {
  marks: {
    kl: { tex: String.raw`\mathrm{KL}(\sympi\,\|\,\sympiref) = \mathbb{E}\Big[\log\frac{\sympi(y)}{\sympiref(y)}\Big]`, x: 0.5, y: 0.7, size: 4.4 },
    pen: { tex: String.raw`r = \symR(y) - \symbeta\,\log\frac{\sympi(y)}{\sympiref(y)}`, x: 0.5, y: 0.7, size: 4.4 },
    opt: { tex: String.raw`\pi^*(y) \propto \sympiref(y)\,e^{\symR(y)/\symbeta}`, x: 0.5, y: 0.7, size: 4.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    const [P, C] = split(s, area(s, 0.13), 0.52);
    // beta over time: reference, slack, tight, then the sweet spot.
    let lb = Math.log10(3);
    let fromRef = 1;
    if (s.since('loose') >= 0) {
      fromRef = 0;
      lb = lerp(Math.log10(3), -2, smooth(s.prog('loose') * 1.3));
    }
    if (s.since('tight') >= 0) lb = lerp(-2, Math.log10(3), smooth(s.prog('tight') * 1.3));
    if (s.since('sweet') >= 0) lb = lerp(Math.log10(3), Math.log10(0.2), smooth(s.prog('sweet') * 1.3));
    const beta = 10 ** lb;
    s.slot('beta', fmt(beta, 2));
    const opt = optimalPolicy(REF_KL, RM_KL, beta);
    const showOpt = s.ease('loose', 0.5);
    const pi = REF_KL.map((r, i) => lerp(r, opt[i]!, showOpt * (1 - fromRef) + 0));
    const exploitOn = s.since('rm') >= 0 && s.since('leash') < 0 ? 0.5 + 0.5 * Math.sin(s.since('rm') * 4) : 0;
    const b = bars(s, P, {
      labels: LABELS_KL,
      pi,
      ghost: s.ease('leash', 0.6) > 0.01 ? REF_KL : undefined,
      ghostK: 'orange',
      hi: exploitOn > 0.5 ? 4 : undefined,
      sub: RM_KL.map((v) => `RM ${v}`),
      show: (i) => `${Math.round(pi[i]! * 100)}%`,
      size: 3.2,
      title: ' ',
    });
    void b;
    s.alpha(s.win('hack', 'leash') * (1 - showOpt), () => s.text('the reference policy', P[0] + P[2] / 2, P[1] + u * 2.2, { size: 3.6, font: 'mono', weight: 650, color: s.c('--ink-2'), halo: true }));
    s.alpha(s.ease('leash', 0.6) * (1 - showOpt), () => s.text('dashed: the frozen reference', P[0] + P[2] / 2, P[1] + u * 2.2, { size: 3.6, font: 'mono', weight: 650, color: s.c('orange'), halo: true }));
    s.alpha(showOpt, () => s.text(`best policy at β = ${fmt(beta, 2)}`, P[0] + P[2] / 2, P[1] + u * 2.2, { size: 3.6, font: 'mono', weight: 650, color: s.c('purple'), halo: true }));
    // Notes in the second panel until the marks take over.
    const ncx = C[0] + C[2] / 2;
    const ncy = C[1] + C[3] * 0.4;
    s.alpha(s.win('hack', 'rm'), () => {
      fitText(s, 'optimize R hard enough, and the policy', ncx, ncy - u * 3.5, C[2], { size: 3.8, italic: true, color: s.c('--ink-2') });
      fitText(s, 'finds whatever R likes most', ncx, ncy + u * 3.5, C[2], { size: 3.8, italic: true, color: s.c('--ink-2') });
    });
    s.alpha(s.win('rm', 'leash'), () => {
      s.text('a reward model with a blind spot', ncx, ncy - u * 7, { size: 3.6, font: 'ui', weight: 600, color: s.c('--ink-2') });
      s.text('"No!! 7×13!!"  RM 1.2', ncx, ncy, { size: 4, font: 'mono', weight: 650, color: s.c('gold') });
      s.alpha(s.ease('rare', 0.6), () => s.text('true quality 0 · reference: 3%', ncx, ncy + u * 7, { size: 3.6, font: 'mono', weight: 650, color: s.c('red') }));
    });
    s.alpha(s.win('leash', 'kl'), () => fitText(s, 'keep π near a frozen copy: π_ref', ncx, ncy, C[2], { size: 4, font: 'mono', weight: 650, color: s.c('orange') }));
    // The marks take turns in the second panel before the chart arrives.
    const mx = (C[0] + C[2] / 2) / w;
    const my = (C[1] + C[3] * 0.45) / h;
    s.show('kl', s.win('kl', 'penalty'), { x: mx, y: my });
    s.show('pen', s.win('penalty', 'opt'), { x: mx, y: my });
    const optTop = s.ease('loose', 0.8);
    s.show('opt', s.ease('opt', 0.6), { x: mx, y: lerp(my, (C[1] + u * 3.5) / h, optTop) });
    s.alpha(s.win('kl', 'penalty'), () => s.text('0 when π = π_ref', C[0] + C[2] / 2, C[1] + C[3] * 0.45 + u * 11, { size: 3.4, italic: true, color: s.c('--ink-2') }));
    // Reward-model score and true quality of the best policy, across beta.
    s.alpha(optTop, () => {
      const cr: Rect = [C[0], C[1] + u * 8, C[2], C[3] - u * 8];
      const { X, Y } = chart(s, cr, [0.01, 3, 0, 1.3], { logX: true, xTicks: [0.01, 0.1, 1, 3], yTicks: [0, 0.5, 1], xLabel: 'β', xFmt: (v) => String(v) });
      const xs = KL_BETAS.map((bb) => X(bb));
      poly(s, xs, KL_SWEEP.map((q) => Y(q.rm)), xs.length, s.c('gold'), 0.55);
      poly(s, xs, KL_SWEEP.map((q) => Y(q.tq)), xs.length, s.c('--ink'), 0.55, [1.4, 0.9]);
      s.line(X(beta), Y(0), X(beta), Y(1.3), s.tint('slate', 0.9), 0.35);
      s.circle(X(beta), Y(dot(opt, RM_KL)), u * 1.2, { fill: s.c('gold') });
      s.circle(X(beta), Y(dot(opt, TRUE_KL)), u * 1.2, { fill: s.c('--ink') });
      s.text('RM score', X(0.012), Y(1.2) + u * 3.2, { size: 3.2, align: 'left', color: s.c('gold'), halo: true });
      s.text('true quality', X(0.012), Y(0.06) - u * 3, { size: 3.2, align: 'left', color: s.c('--ink'), halo: true });
    });
    s.alpha(s.ease('dpo', 0.5) * (0.5 + 0.5 * Math.sin(s.since('dpo') * 3)), () => {
      const bw = Math.min(C[2], u * 52);
      s.rrect(C[0] + C[2] / 2 - bw / 2, C[1] + u * 3.5 - u * 5, bw, u * 10, 2, { stroke: s.c('orange'), lw: 0.5 });
    });
    void w;
  },
};

// ---------------------------------------------------------------- entropy

const UNIFORM = [0.25, 0.25, 0.25, 0.25];
const CERTAIN = [0, 0, 1, 0];

const entropyScene: SceneDef = {
  marks: {
    H: { tex: String.raw`H(\sympi) = -\sum_y \sympi(y)\log\sympi(y)`, x: 0.5, y: 0.2, size: 4.8 },
  },
  draw(s) {
    const { w, h, u } = s;
    const [P, C] = split(s, area(s, 0.13), stacked(s) ? 0.42 : 0.44);
    const tau = s.since('much') >= 0 ? 0.4 : s.since('found') >= 0 || s.since('bonus') >= 0 ? 0.1 : 0;
    s.slot('tau', tau);
    // The starting policy, then one run being squeezed.
    const bA = s.win('only', 'entropy');
    s.alpha(bA, () => {
      const t = s.since('squeeze') >= 0 ? Math.round(60 * smooth(s.prog('squeeze'))) : 0;
      const pi = EXP_T0[EXP_STUCK]![t]!;
      bars(s, P, { labels: ANSWERS, pi, sub: REWARD.map((r) => `R ${r}`), show: (i) => `${Math.round(pi[i]! * 100)}%`, hi: s.since('start') >= 0 ? 3 : undefined, size: 3.4, title: ' ' });
      s.alpha(s.ease('start', 0.6), () => s.text(t ? `one run, step ${t}` : 'the best answer: 5%', P[0] + P[2] / 2, P[1] + u * 2.2, { size: 3.6, font: 'mono', weight: 650, color: s.c(t ? '--ink-2' : 'gold'), halo: true }));
    });
    // Entropy, with two extremes.
    const eA = s.ease('entropy', 0.6);
    s.show('H', eA, { x: (P[0] + P[2] / 2) / w, y: (P[1] + u * 4) / h });
    s.alpha(eA * s.ease('range', 0.6) * (1 - s.ease('bonus', 0.6)), () => {
      const half = (P[2] - u * 4) / 2;
      const mini = (x0: number, pi: number[], label: string) => {
        const bw = half / 6;
        const base = P[1] + P[3] - u * 9;
        const top = P[1] + u * 14;
        pi.forEach((p, i) => {
          const bh = (base - top) * p;
          s.rrect(x0 + bw * (0.8 + i * 1.2), base - bh, bw, Math.max(0.5, bh), 0.4, { fill: s.tint('purple', 0.6) });
        });
        s.line(x0, base, x0 + half, base, s.c('--axis'), 0.3);
        s.text(label, x0 + half / 2, base + u * 4.5, { size: 3.6, font: 'mono', weight: 650 });
      };
      mini(P[0], UNIFORM, `H = ${fmt(entropy(UNIFORM), 3)}`);
      mini(P[0] + half + u * 4, CERTAIN, 'H = 0');
    });
    // Runs: the best answer's probability, then entropy.
    const cA = s.ease('runs', 0.6);
    s.alpha(cA, () => {
      const showH = s.since('crash') >= 0 && s.since('bonus') < 0;
      const data = s.since('much') >= 0 ? EXP_T4 : s.since('bonus') >= 0 ? EXP_T1 : EXP_T0;
      const from = s.since('much') >= 0 ? 'much' : s.since('bonus') >= 0 ? 'bonus' : showH ? 'crash' : 'runs';
      const rev = s.ease(from, 1.6, 0.3);
      const found = data.filter((t) => t[t.length - 1]![3]! > 0.5).length;
      const title = showH ? 'entropy of each run (τ = 0)' : `π(best), 12 runs, τ = ${tau}: ${found} find it`;
      const { X, Y } = chart(s, C, [0, EXPLORE_STEPS, 0, showH ? 1.4 : 1], { xTicks: [0, 100, 200, 300], yTicks: [0, 0.5, 1], xLabel: 'step', title, titleK: showH ? 'slate' : 'purple' });
      const n = Math.max(2, Math.round(rev * EXPLORE_STEPS) + 1);
      const xs = Array.from({ length: EXPLORE_STEPS + 1 }, (_, i) => X(i));
      const neverA = s.win('never', 'entropy');
      data.forEach((t, j) => {
        const ok = t[t.length - 1]![3]! > 0.5;
        const ys = t.map((p) => Y(showH ? entropy(p) : p[3]!));
        const emph = !ok && neverA > 0.5;
        poly(s, xs, ys, n, showH ? s.tint(ok ? 'slate' : 'red', 0.7) : s.tint(runColor(ok), emph ? 1 : 0.8), emph ? 0.6 : 0.35);
        void j;
      });
    });
    s.alpha(s.win('only', 'runs'), () => {
      const cx = C[0] + C[2] / 2;
      const cy = C[1] + C[3] * 0.4;
      fitText(s, 'no sample, no credit', cx, cy, C[2], { size: 4.4, font: 'display', weight: 600, color: s.c('--ink-2') });
      s.alpha(s.ease('squeeze', 0.6), () => fitText(s, 'a rare answer is rarely tried, so it rarely gets pushed up', cx, cy + u * 8, C[2], { size: 3.4, italic: true, color: s.c('--ink-2') }));
    });
    s.alpha(s.ease('bonus', 0.6) * (1 - s.ease('much', 0.6)), () =>
      s.text('+ τ × entropy: stay a little uncertain', P[0] + P[2] / 2, P[1] + P[3] * 0.5, { size: 3.8, italic: true, color: s.c('teal') }),
    );
    s.alpha(s.ease('much', 0.6), () => s.text('too much: never commits', P[0] + P[2] / 2, P[1] + P[3] * 0.5, { size: 3.8, italic: true, color: s.c('red') }));
    void h;
  },
};

// ---------------------------------------------------------------- outro

const outro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const steps: [string, string, K][] = [
      ['sample', 'answers from π', 'purple'],
      ['grade', 'any score R', 'gold'],
      ['KL penalty', 'stay near π_ref', 'orange'],
      ['baseline', 'A = r − b', 'red'],
      ['step', 'along A ∇log π', 'teal'],
    ];
    const ids = ['sample', 'grade', 'kl', 'adv', 'loss'];
    const pA = 1 - s.ease('rlhf', 0.6);
    s.alpha(pA, () => {
      const r = area(s, 0.14);
      s.alpha(s.ease('recap', 0.5), () => s.text('the recipe', w / 2, r[1] + u * 4, { size: 4.6, font: 'display', weight: 600, color: s.c('--ink-2') }));
      steps.forEach(([a, b, k], i) => {
        const on = s.since(ids[i]!) >= 0 ? (s.since(ids[i + 1] ?? 'rlhf') < 0 ? 1 : 0.35) : 0;
        const appear = s.ease('recap', 0.5, 0.25 * i);
        let x: number;
        let y: number;
        let bw: number;
        let bh: number;
        if (stacked(s)) {
          bw = r[2] * 0.8;
          bh = (r[3] - u * 12) / 5 - u * 2.4;
          x = r[0] + (r[2] - bw) / 2;
          y = r[1] + u * 10 + i * (bh + u * 2.4);
        } else {
          bw = (r[2] - u * 4 * 4) / 5;
          bh = u * 20;
          x = r[0] + i * (bw + u * 4);
          y = r[1] + r[3] * 0.4;
        }
        s.alpha(appear, () => {
          box(s, x, y, bw, bh, a, b, k, on, stacked(s) ? Math.min(4.4, (bh / u) * 0.36) : Math.min(4.2, (bw / u) * 0.14));
          if (i > 0) {
            if (stacked(s)) s.arrow(x + bw / 2, y - u * 2.2, x + bw / 2, y - u * 0.4, s.c('--ink-3'), 0.35, 1.2);
            else s.arrow(x - u * 3.4, y + bh / 2, x - u * 0.6, y + bh / 2, s.c('--ink-3'), 0.35, 1.4);
          }
        });
      });
    });
    // What the next chapters change.
    const cards: [string, string, string, K][] = [
      ['rlhf', 'RLHF + PPO', 'learned reward · critic · clipping', 'purple'],
      ['dpo', 'DPO', 'no sampling loop', 'orange'],
      ['grpo', 'GRPO', 'verifier · group baseline', 'green'],
    ];
    const rA = s.ease('rlhf', 0.6);
    s.alpha(rA, () => {
      const r = area(s, 0.16);
      const gap = u * 3;
      const cols = stacked(s) ? 1 : 3;
      const bw = (r[2] - gap * (cols - 1)) / cols;
      const bh = stacked(s) ? (r[3] - u * 24) / 3 : u * 26;
      cards.forEach(([id, a, b, k], i) => {
        const x = r[0] + (i % cols) * (bw + gap);
        const y = r[1] + u * 2 + Math.floor(i / cols) * (bh + gap);
        s.alpha(s.ease(id, 0.6), () => box(s, x, y, bw, bh, a, b, k, s.since(id) >= 0 && s.since(cards[i + 1]?.[0] ?? 'explore') < 0 ? 1 : 0.3, stacked(s) ? 4.4 : Math.min(4.6, (bw / u) * 0.12)));
      });
      s.alpha(s.ease('explore', 0.6), () => {
        const y = stacked(s) ? h * 0.86 : h * 0.8;
        const t = 'same core: sample, grade, push up';
        const o: TextOpts = { font: 'display', weight: 600, color: s.c('teal') };
        const tw = Math.min(s.measure(t, { ...o, size: 4.4 }), w - u * 20);
        check(s, w / 2 - tw / 2 - u * 1.5, y, u * 2.2);
        fitText(s, t, w / 2 + u * 2.5, y, tw, { ...o, size: 4.4 });
      });
    });
  },
};

export const scenes: Record<string, SceneDef> = {
  intro,
  policy,
  logprob,
  expected,
  trick,
  softmax: softmaxScene,
  reinforce,
  baselines,
  credit,
  kl,
  entropy: entropyScene,
  outro,
};

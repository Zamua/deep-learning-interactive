import { Rng } from '../../core/rand';
import { ANSWER, CHECK, DEFAULTS, type Problem, type Rollout, ToyGrpo, WORK, baseLogits, makeProblem, rollout } from '../../lib/grpo-toy';

/** Everything the lecture shows from the toy world, computed once with fixed seeds. */

export const PROB: Problem = { a: 437, b: 285, d: 3 };
const BASE = baseLogits();

/** First seeded group of `n` outputs that passes `ok`. */
function findGroup(th: Float64Array, prob: Problem, n: number, ok: (g: Rollout[]) => boolean, from = 1): Rollout[] {
  for (let seed = from; seed < from + 4000; seed++) {
    const rng = new Rng(seed);
    const g = Array.from({ length: n }, () => rollout(th, BASE, prob, rng));
    if (ok(g)) return g;
  }
  throw new Error('no group found');
}

const right = (g: Rollout[]) => g.filter((r) => r.reward === 1).length;

/** A base-model group on 437 + 285 with two of eight right, short enough to draw, with a check in it. */
export const GROUP: Rollout[] = findGroup(BASE, PROB, 8, (g) => right(g) === 2 && g[0]!.reward === 0 && g.every((r) => r.acts.length <= 7) && g.some((r) => r.acts.includes(CHECK)));

/** The training run the toy scene replays: 400 GRPO steps, default settings. */
const run = new ToyGrpo({ ...DEFAULTS }, 7);
const START = Float64Array.from(run.th);
for (let i = 0; i < 400; i++) run.step();
export const TRAINED = Float64Array.from(run.th);

const smooth = (xs: number[], win = 12) => xs.map((_, i) => {
  let s = 0;
  let n = 0;
  for (let j = Math.max(0, i - win + 1); j <= i; j++) {
    s += xs[j]!;
    n++;
  }
  return s / n;
});
export const HIST = {
  acc: smooth(run.history.map((h) => h.acc)),
  len: smooth(run.history.map((h) => h.len)),
  zeroVar: smooth(run.history.map((h) => h.zeroVar)),
  entropy: smooth(run.history.map((h) => h.entropy)),
};

/** Mean tokens per output by kind, over 2000 fresh problems. */
function composition(th: Float64Array): { work: number; filler: number; check: number; answer: number; acc: number } {
  const rng = new Rng(5);
  const c = { work: 0, filler: 0, check: 0, answer: 0, acc: 0 };
  const n = 2000;
  for (let i = 0; i < n; i++) {
    const r = rollout(th, BASE, makeProblem(rng), rng);
    c.acc += r.reward;
    r.acts.forEach((a, t) => {
      if (a === WORK) {
        if (r.shown[t] === '…') c.filler++;
        else c.work++;
      } else if (a === CHECK) c.check++;
      else if (a === ANSWER) c.answer++;
    });
  }
  return { work: c.work / n, filler: c.filler / n, check: c.check / n, answer: c.answer / n, acc: c.acc / n };
}
export const BEFORE = composition(START);
export const AFTER = composition(TRAINED);

/** Four outputs on 437 + 285 from the base model, and four from the trained one. */
export const BASE_ROWS: Rollout[] = findGroup(BASE, PROB, 4, (g) => right(g) === 1 && g.every((r) => r.acts.length <= 6), 40);
export const TRAINED_ROWS: Rollout[] = findGroup(TRAINED, PROB, 4, (g) => right(g) === 4 && g.filter((r) => r.acts.includes(CHECK)).length >= 3 && g.every((r) => r.acts.length <= 9), 40);

/** No-signal groups: every output right (trained model, 1 digit) and every output wrong (base model, 4 digits). */
export const ALL_RIGHT: Rollout[] = findGroup(TRAINED, { a: 7, b: 5, d: 1 }, 8, (g) => right(g) === 8 && g.every((r) => r.acts.length <= 6));
export const ALL_WRONG: Rollout[] = findGroup(BASE, { a: 4371, b: 2856, d: 4 }, 8, (g) => right(g) === 0 && g.every((r) => r.acts.length <= 7));

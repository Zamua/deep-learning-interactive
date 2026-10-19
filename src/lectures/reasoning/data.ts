import { Rng } from '../../core/rand';
import {
  BestOfN,
  applySwap,
  betaWeights,
  budgetCurve,
  coverage,
  drawCandidates,
  makeSwaps,
  meanP,
  passAt,
  runCups,
  voteAccuracy,
  voteCeiling,
  workSteps,
} from '../../lib/reasoning-math';

// ---------------------------------------------------------------- cups (the chapter's first figure)

export const SWAPS = makeSwaps(5).slice(0, 8);
export const CUPS_NO = runCups(SWAPS, 3, false);
export const CUPS_COT = runCups(SWAPS, 3, true);
/** Ball position after the first k swaps, k = 0..8. */
export const BALL_AT: number[] = SWAPS.reduce((acc, sw) => [...acc, applySwap(acc[acc.length - 1]!, sw)], [0]);

// ---------------------------------------------------------------- voting, n = 1..64

export const VOTE_N = Array.from({ length: 64 }, (_, i) => i + 1);
export const VOTE_GOOD = VOTE_N.map((n) => voteAccuracy(0.6, 0.4, n));
export const VOTE_BAD = VOTE_N.map((n) => voteAccuracy(0.4, 0.6, n));
export const VOTE_SCATTER = VOTE_N.map((n) => voteAccuracy(0.3, 0.1, n));
export const VOTE_COMMON = VOTE_N.map((n) => voteAccuracy(0.3, 0.4, n));

// ---------------------------------------------------------------- coverage

/** log10 of the sample count, 0..3, for one problem with p = 0.015. */
export const COV1_X = Array.from({ length: 61 }, (_, i) => (3 * i) / 60);
export const COV1_Y = COV1_X.map((lx) => passAt(0.015, 10 ** lx));
const W = betaWeights(0.25, 1);
export const BENCH_X = Array.from({ length: 81 }, (_, i) => (4 * i) / 80);
export const BENCH_Y = BENCH_X.map((lx) => coverage(W, 10 ** lx));
export const BENCH_MEAN = meanP(W);
export const BENCH_CEIL = voteCeiling(W, 0.5);
/** Share of problems in 20 bins of per-sample accuracy (square root, scaled to a max of 1). */
export const BENCH_HIST: number[] = (() => {
  const bins = new Array(20).fill(0) as number[];
  W.forEach((w, i) => (bins[Math.min(19, Math.floor(((i + 0.5) / W.length) * 20))]! += w));
  const m = Math.sqrt(Math.max(...bins));
  return bins.map((b) => Math.sqrt(b) / m);
})();

// ---------------------------------------------------------------- best-of-n

const bon = new BestOfN(0.3, 2, 0.02);
const bon0 = new BestOfN(0.3, 2, 0);
/** Whole sample counts from 1 to 1,024, spaced evenly on a log axis. */
export const BON_NS = [...new Set(Array.from({ length: 201 }, (_, i) => Math.round(2 ** (i / 20))))];
export const BON_X = BON_NS.map((n) => Math.log2(n));
export const BON_Y = BON_NS.map((n) => bon.at(n).acc);
export const BON0_Y = BON_NS.map((n) => bon0.at(n).acc);
export const PASS_Y = BON_NS.map((n) => passAt(0.3, n));
const TOPS = BON_NS.map((n) => bon.at(n).top);
/** The verifier's expected score of the pick, divided by its largest value on the plot. */
export const BON_PROXY = TOPS.map((t) => t / Math.max(...TOPS));
export const DRAW16 = drawCandidates(new Rng(2), 0.3, 2, 0.02, 16);
export const DRAW256 = drawCandidates(new Rng(1002), 0.3, 2, 0.02, 256);
/** Vertical jitter for the candidate dots, fixed so frames do not flicker. */
export const JITTER = Array.from({ length: 256 }, (_, i) => new Rng(77 + i).next());

// ---------------------------------------------------------------- process versus outcome

export const WORK_CLEAN = workSteps([false, false, false, false]);
export const WORK_SLIP = workSteps([false, true, false, false]);
export const WORK_CANCEL = workSteps([false, true, true, false]);

// ---------------------------------------------------------------- beam search over steps

export interface Node {
  score: number;
  parent: number;
  kept: boolean;
}
/** Three levels of beam search: 3 beams, 3 sampled steps each, keep the top 3 by PRM score. */
export const BEAM: Node[][] = (() => {
  const r = new Rng(9);
  const levels: Node[][] = [[{ score: 1, parent: -1, kept: true }]];
  for (let l = 1; l <= 3; l++) {
    const prev = levels[l - 1]!;
    const parents = prev.map((n, i) => ({ n, i })).filter((x) => x.n.kept);
    const kids: Node[] = [];
    for (const { n, i } of parents) {
      const k = l === 1 ? 6 : 3;
      for (let c = 0; c < k; c++) kids.push({ score: n.score * (0.55 + 0.45 * r.next()), parent: i, kept: false });
    }
    [...kids].sort((a, b) => b.score - a.score).slice(0, 3).forEach((k) => (k.kept = true));
    levels.push(kids);
  }
  return levels;
})();

export const SOMETIMES = VOTE_N.map((n) => passAt(0.2, n));
export const NEVER = VOTE_N.map((n) => passAt(0.002, n));

// ---------------------------------------------------------------- thinking budget

export const BUDGET_T = 48;
export const EASY = budgetCurve(2, BUDGET_T, 0.3, 0.03);
export const HARD = budgetCurve(12, BUDGET_T, 0.3, 0.03);
export const EASY_BRK = budgetCurve(2, BUDGET_T, 0.3, 0.08);
export const HARD_BRK = budgetCurve(12, BUDGET_T, 0.3, 0.08);

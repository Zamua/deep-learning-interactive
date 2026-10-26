import type { Scene, SceneDef } from '../../../lecture/scene';
import { columns, verdict } from '../../draw';
import { word, type Ink } from '../draw';

/** Five sampled paths for 17 × 24: two intermediate results, then the final answer. */
const RUNS: [string, string, number][] = [
  ['340', '68', 408],
  ['240', '168', 408],
  ['340', '58', 398],
  ['425', '−17', 408],
  ['340', '78', 418],
];
const TALLY: [number, number][] = [
  [408, 3],
  [398, 1],
  [418, 1],
];

/** One path: two step cells, then its answer. */
function path(s: Scene, x: number, y: number, a: string, b: string, ans: number, o: { on: number; dim: number }): void {
  const k = ans === 408 ? 'green' : 'red';
  s.alpha(1 - 0.6 * o.dim, () => {
    word(s, x, y, a, 'slate', { size: 2.9, h: 6 });
    s.arrow(x + 5.5 * s.u, y, x + 8.5 * s.u, y, s.c('--ink-3'), 0.3, 1.4);
    word(s, x + 14 * s.u, y, b, 'slate', { size: 2.9, h: 6 });
    s.arrow(x + 19.5 * s.u, y, x + 23 * s.u, y, s.c('--ink-3'), 0.3, 1.4);
    word(s, x + 29 * s.u, y, String(ans), k, { size: 3.2, h: 6.5, on: o.on });
  });
}

/** Each distinct answer as a chip with one dot per vote below it, the winner first and lit. */
function tally(s: Scene, y: number, rows: [string, number][], a: (j: number) => number): void {
  const xs = columns(s, rows.length, 26);
  rows.forEach(([v, c], j) =>
    s.alpha(a(j), () => {
      const win = j === 0;
      word(s, xs[j]!, y, v, win ? 'green' : 'red', { size: 3.4, h: 7, on: win ? 1 : 0 });
      for (let k = 0; k < c; k++) s.circle(xs[j]! + (k - (c - 1) / 2) * 3.4 * s.u, y + 7.5 * s.u, 1.2 * s.u, { fill: s.c(win ? 'green' : 'red') });
    }),
  );
}

const vote: SceneDef = {
  draw(s) {
    const cmp = s.ease('compare', 0.7);
    s.alpha(1 - cmp, () => {
      const x0 = s.tall ? s.w / 2 - 15 * s.u : Math.max(s.w / 2 - 44 * s.u, 18 * s.u);
      const gr = s.ease('greedy', 0.8);
      RUNS.forEach(([a, b, ans], i) => {
        const y = s.h * (s.tall ? 0.1 + i * 0.085 : 0.16 + i * 0.13);
        s.alpha(s.ease('paths', 0.5, 0.6 + 0.35 * i), () => {
          s.text(`run ${i}`, x0 - 6 * s.u, y, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
          s.alpha(1 - gr, () => path(s, x0, y, a, b, ans, { on: ans === 408 ? s.win('vote', 'greedy') : 0, dim: ans !== 408 ? s.ease('vote', 0.6) : 0 }));
          s.alpha(gr, () => path(s, x0, y, '340', '68', 408, { on: 0, dim: 0.4 }));
        });
      });
      // The tally: one dot per vote.
      const tx = s.tall ? columns(s, 3, 26) : [0, 1, 2].map(() => s.w / 2 + 28 * s.u);
      const ty = (j: number) => (s.tall ? s.h * 0.66 : s.h * (0.3 + j * 0.16));
      s.alpha(s.ease('vote', 0.6) * (1 - gr), () => {
        TALLY.forEach(([v, c], j) => {
          const win = j === 0;
          const x = tx[j]!;
          const y = ty(j);
          word(s, x, y, String(v), win ? 'green' : 'red', { size: 3.4, h: 7, on: win ? 1 : 0 });
          for (let k = 0; k < c; k++) {
            const dx = s.tall ? (k - (c - 1) / 2) * 3.4 * s.u : 9 * s.u + k * 3.4 * s.u;
            const dy = s.tall ? 7.5 * s.u : 0;
            s.circle(x + dx, y + dy, 1.2 * s.u, { fill: s.c(win ? 'green' : 'red') });
          }
        });
        s.text('votes', s.tall ? s.w / 2 : tx[0]! + 4 * s.u, s.tall ? s.h * 0.83 : s.h * 0.17, { size: 3, font: 'mono', color: s.c('--ink-3') });
      });
      s.alpha(s.ease('vote', 0.6, 1.6) * (1 - gr), () => s.text('self-consistency returns 408', s.w / 2, s.h * 0.92, { size: 3.4, font: 'mono', weight: 650, color: s.c('green') }));
      s.alpha(gr, () => {
        s.text('T → 0: the same path five times', s.w / 2, s.tall ? s.h * 0.66 : s.h * 0.86, { size: 3.4, font: 'mono', weight: 650, color: s.c('slate') });
        s.text('one answer, five copies: nothing to vote on', s.w / 2, s.tall ? s.h * 0.74 : s.h * 0.93, { size: 3, color: s.c('--ink-3') });
      });
    });
    s.alpha(cmp, () => {
      const vx = s.w / 2 - (s.tall ? 38 : 36) * s.u;
      s.text('408, 408, 398, 408, 418', vx + 5 * s.u, s.h * 0.28, { size: 3.6, font: 'mono', weight: 650, align: 'left', color: s.c('orange') });
      verdict(s, true, 'equal answers can be counted', vx, s.h * 0.38, 3.4);
      s.alpha(s.ease('compare', 0.6, 3), () => {
        s.text('five stories about a lighthouse', vx + 5 * s.u, s.h * 0.6, { size: 3.6, font: 'mono', weight: 650, align: 'left', color: s.c('orange') });
        verdict(s, false, 'no two match: nothing to count', vx, s.h * 0.7, 3.4);
      });
    });
  },
};

// ---- scene 2: two worked problems, as the practice asks them

const ANS = [15, 12, 12, 8, 12, 15, 12];
const LETTERS = ['B', 'B', 'C', 'B', 'D'];
const kOf = (v: number): Ink => (v === 12 ? 'green' : 'red');

const tryIt: SceneDef = {
  draw(s) {
    const one = s.ease('p1', 0.6) * (1 - s.ease('p2', 0.5));
    s.alpha(one, () => {
      s.text('What is 15% of 80?', s.w / 2, s.h * 0.08, { size: 3.6, font: 'mono', weight: 650, color: s.c('--ink-2') });
      const xs = columns(s, 7, 11);
      const lit = s.ease('a1', 0.6);
      ANS.forEach((v, i) =>
        s.alpha(s.ease('p1', 0.4, 1.2 + 0.3 * i), () => {
          s.text(`run ${i}`, xs[i]!, s.h * 0.17, { size: 2.4, font: 'mono', color: s.c('--ink-3') });
          word(s, xs[i]!, s.h * 0.25, String(v), lit > 0.5 ? kOf(v) : 'slate', { size: 3.2, h: 6.5, on: v === 12 ? s.win('a1', 'not') : 0 });
        }),
      );
      tally(s, s.h * 0.42, [['12', 4], ['15', 2], ['8', 1]], (j) => s.ease('a1', 0.5, 0.6 + 0.8 * j));
      s.alpha(s.ease('a1', 0.6, 3.4), () => s.text('self-consistency returns 12', s.w / 2, s.h * 0.92, { size: 3.4, font: 'mono', weight: 650, color: s.c('green') }));
      const vx = s.w / 2 - (s.tall ? 36 : 32) * s.u;
      s.alpha(s.ease('not', 0.6), () => verdict(s, false, 'run 0 alone: 15, one path', vx, s.h * 0.64, 3.2));
      s.alpha(s.ease('not', 0.6, 2.2), () => verdict(s, false, 'the mean: 12.29, no path reached it', vx, s.h * 0.76, 3.2));
    });
    const two = s.ease('p2', 0.6, 0.3);
    s.alpha(two, () => {
      s.text('multiple choice: each reply ends in A to D', s.w / 2, s.h * 0.08, { size: 3.2, font: 'mono', weight: 650, color: s.c('--ink-2') });
      const xs = columns(s, 5, 16);
      const lit = s.ease('a2', 0.6);
      LETTERS.forEach((t, i) =>
        s.alpha(s.ease('p2', 0.4, 1.4 + 0.3 * i), () => {
          s.text(`reply ${i}`, xs[i]!, s.h * 0.17, { size: 2.4, font: 'mono', color: s.c('--ink-3') });
          word(s, xs[i]!, s.h * 0.25, `… ${t}`, lit > 0.5 ? (t === 'B' ? 'green' : 'red') : 'slate', { size: 3.2, h: 6.5, on: t === 'B' ? lit : 0 });
        }),
      );
      tally(s, s.h * 0.42, [['B', 3], ['C', 1], ['D', 1]], (j) => s.ease('a2', 0.5, 1 + 0.5 * j));
      s.alpha(s.ease('a2', 0.6, 0.4), () => verdict(s, true, 'letters can be counted', s.w / 2 - (s.tall ? 24 : 20) * s.u, s.h * 0.66, 3.4));
      s.alpha(s.ease('a2', 0.6, 3), () => s.text('B wins, with 3 votes of 5', s.w / 2, s.h * 0.86, { size: 3.4, font: 'mono', weight: 650, color: s.c('green') }));
    });
  },
};

export const scenes: Record<string, SceneDef> = { vote, try: tryIt };

import type { Scene, SceneDef } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { cite, columns, verdict } from '../../draw';
import { hbar, word } from '../draw';

/** Five sampled paths for 17 × 24: two step results, the final answer, and whether a step slipped. */
type Run = [string, string, number, boolean];
const RUNS: Run[] = [
  ['340', '68', 408, false],
  ['340', '58', 398, true],
  ['240', '168', 408, false],
  ['425', '−17', 408, false],
  ['340', '78', 418, true],
];
const ANSWERS = RUNS.map((r) => r[2]);
const GREEDY: Run = ['340', '68', 408, false];

/** 0 -> 1 once beat `id` is fraction `f` of the way through its narration. */
const cue = (s: Scene, id: string, f: number): number => Math.min(1, Math.max(0, (s.prog(id) - f) * 8));

/** Rows on the left (desktop) or on top (phone); the pile of answers beside or below them. */
function layout(s: Scene, tight = false) {
  const x0 = s.tall ? s.w / 2 - 15 * s.u : 22 * s.u;
  // A pile of five dots stands taller, so on a phone the rows close up to make room.
  const dy = tight ? 0.08 : 0.095;
  const rowY = (i: number) => s.h * (s.tall ? 0.17 + i * dy : 0.19 + i * 0.125);
  // Desktop: the pile spans the room right of the rows, which end about 39u past x0.
  const l = x0 + 42 * s.u;
  const r = s.w - 6 * s.u;
  const pile = s.tall ? { cx: s.w / 2, y: s.h * (tight ? 0.82 : 0.8), half: 36 * s.u } : { cx: (l + r) / 2, y: s.h * 0.62, half: Math.min(34 * s.u, (r - l) / 2) };
  /** Under the rows, centered on them. */
  const below = s.tall ? { x: s.w / 2, y: s.h * 0.66 } : { x: x0 + 10 * s.u, y: s.h * 0.84 };
  return { x0, rowY, pile, below };
}

/** One path: two step chips, then its answer. `show` fades in each chip. */
function path(s: Scene, x: number, y: number, r: Run, o: { on?: number; dim?: number; show?: [number, number, number] } = {}): void {
  const [a, b, ans, slip] = r;
  const [sa, sb, sc] = o.show ?? [1, 1, 1];
  const k: Ink = ans === 408 ? 'green' : 'red';
  s.alpha(1 - 0.6 * (o.dim ?? 0), () => {
    s.alpha(sa, () => word(s, x, y, a, 'slate', { size: 2.9, h: 6 }));
    s.alpha(sb, () => {
      s.arrow(x + 5.5 * s.u, y, x + 8.5 * s.u, y, s.c('--ink-3'), 0.3, 1.4);
      word(s, x + 14 * s.u, y, b, slip ? 'red' : 'slate', { size: 2.9, h: 6 });
    });
    s.alpha(sc, () => {
      s.arrow(x + 19.5 * s.u, y, x + 23 * s.u, y, s.c('--ink-3'), 0.3, 1.4);
      word(s, x + 29 * s.u, y, String(ans), k, { size: 3.2, h: 6.5, on: o.on ?? 0 });
    });
  });
}

const runLabel = (s: Scene, i: number, x0: number, y: number) =>
  s.text(`run ${i}`, x0 - 6 * s.u, y, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });

/**
 * Final answers on a number line, one dot per run stacked over its answer. `a(i)` fades in run
 * i's dot; `on` rings the winning stack; `counts` labels each stack with its votes.
 */
function pile(s: Scene, p: { cx: number; y: number; half: number }, answers: number[], o: { a?: (i: number) => number; on?: number; counts?: number } = {}): void {
  const X = (v: number) => p.cx + (((v - 393) / 30) * 2 - 1) * p.half;
  s.line(p.cx - p.half, p.y, p.cx + p.half, p.y, s.c('--axis'), 0.35);
  for (const v of [398, 408, 418]) {
    s.line(X(v), p.y, X(v), p.y + 1.4 * s.u, s.c('--axis'), 0.35);
    s.text(String(v), X(v), p.y + 4.4 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
  }
  const seen = new Map<number, number>();
  answers.forEach((v, i) => {
    const k = seen.get(v) ?? 0;
    seen.set(v, k + 1);
    s.alpha(o.a ? o.a(i) : 1, () => s.circle(X(v), p.y - (2.4 + 3.6 * k) * s.u, 1.4 * s.u, { fill: s.c(v === 408 ? 'green' : 'red') }));
  });
  const on = o.on ?? 0;
  if (on > 0) {
    const n = seen.get(408) ?? 0;
    s.alpha(on, () => s.rrect(X(408) - 3.2 * s.u, p.y - (2.4 + 3.6 * (n - 1) + 3.2) * s.u, 6.4 * s.u, (3.6 * (n - 1) + 6.4) * s.u, 2, { stroke: s.c('green'), lw: 0.4 }));
  }
  s.alpha(o.counts ?? 0, () =>
    [...seen].forEach(([v, n]) =>
      s.text(n === 1 ? '1 vote' : `${n} votes`, X(v), p.y - (2.4 + 3.6 * n + 2.2) * s.u, { size: 2.7, font: 'mono', weight: 600, color: s.c(v === 408 ? 'green' : 'red'), halo: true }),
    ),
  );
}

// ---- scene 1: one chain of thought can slip; sampled paths scatter at the slips

const slip: SceneDef = {
  draw(s) {
    const { x0, rowY, pile: P, below } = layout(s);
    s.text('What is 17 × 24?', s.w / 2, s.h * 0.07, { size: 3.6, font: 'mono', weight: 650, color: s.c('--ink-2') });
    const many = s.ease('sample', 0.6);
    const lit = s.ease('scatter', 0.6);
    RUNS.forEach((r, i) => {
      const y = rowY(i);
      // Run 0 builds on the first beat, run 1 slips on the second, the rest arrive when sampled.
      const show: [number, number, number] =
        i === 0 ? [cue(s, 'path', 0.5), cue(s, 'path', 0.68), cue(s, 'path', 0.86)]
        : i === 1 ? [s.ease('slip', 0.5, 0.4), cue(s, 'slip', 0.42), cue(s, 'slip', 0.8)]
        : [1, 1, 1];
      const a = i < 2 ? 1 : s.ease('sample', 0.5, 1 + 0.5 * (i - 2));
      s.alpha(a, () => {
        s.alpha(many, () => runLabel(s, i, x0, y));
        path(s, x0, y, r, { show, on: r[2] === 408 ? lit : 0 });
      });
      if (r[3]) s.alpha(i === 1 ? s.win('slip', 'sample') : 0, () => s.text('a slip', x0 + 14 * s.u, y + 6 * s.u, { size: 2.7, font: 'mono', weight: 600, color: s.c('red'), halo: true }));
    });
    s.alpha(s.win('sample', 'scatter'), () => s.text('T = 0.7: each run its own route', below.x, below.y, { size: 3.1, font: 'mono', color: s.c('--ink-2') }));
    const ag = s.ease('agree', 0.6);
    s.alpha(ag, () => {
      pile(s, P, ANSWERS, { a: (i) => s.ease('agree', 0.4, 0.4 + 0.35 * i) });
      s.alpha(s.ease('agree', 0.6, 2.6), () => s.text('right paths pile up', P.cx, P.y - 17 * s.u, { size: 3, font: 'mono', weight: 600, color: s.c('green'), halo: true }));
      s.alpha(s.ease('agree', 0.6, 5), () => s.text('slips land apart', P.cx, P.y + 10 * s.u, { size: 3, font: 'mono', weight: 600, color: s.c('red') }));
    });
  },
};

// ---- scene 2: count the final answers; the name; where it came from

const vote: SceneDef = {
  draw(s) {
    const gain = s.ease('gain', 0.7);
    const P = { cx: s.w / 2, y: s.h * (s.tall ? 0.42 : 0.4), half: s.tall ? 36 * s.u : 40 * s.u };
    s.alpha(1 - gain, () => {
      s.alpha(1 - s.ease('wang', 0.5), () => s.text('408, 398, 408, 408, 418', s.w / 2, s.h * 0.08, { size: 3.6, font: 'mono', weight: 650, color: s.c('--ink-2') }));
      pile(s, P, ANSWERS, { on: s.ease('win', 0.6), counts: s.ease('count', 0.6, 1.2) });
      const lx = s.w / 2;
      s.alpha(s.ease('win', 0.6, 0.6), () => s.text('self-consistency returns 408', lx, s.h * 0.58, { size: 3.4, font: 'mono', weight: 650, color: s.c('green') }));
      s.alpha(s.ease('name', 0.6, 1.2), () => s.text('the answer its samples are consistent about', lx, s.h * 0.66, { size: 3, italic: true, color: s.c('--ink-2') }));
      s.alpha(s.ease('wang', 0.6, 4), () => {
        s.text('before: one greedy path', lx, s.h * 0.78, { size: 3.1, font: 'mono', color: s.c('slate') });
        s.text('self-consistency: sample many, vote', lx, s.h * 0.86, { size: 3.1, font: 'mono', weight: 600, color: s.c('green') });
      });
    });
    cite(s, 'Wang et al., 2022 · Google', s.ease('wang', 0.6));
    s.alpha(gain, () => {
      const L = (s.tall ? 62 : 80) * s.u;
      const x0 = s.w / 2 - L / 2 - 6 * s.u;
      s.text('grade-school math word problems', s.w / 2, s.h * 0.2, { size: 3.3, font: 'mono', weight: 650, color: s.c('--ink-2') });
      const rows: [string, number, Ink, number][] = [
        ['one greedy path', 0.565, 'slate', s.ease('gain', 0.6, 0.6)],
        ['a vote of 40 sampled paths', 0.744, 'green', s.ease('gain', 0.6, 4.5)],
      ];
      rows.forEach(([t, v, k, a], j) =>
        s.alpha(a, () => {
          const y = s.h * (0.42 + 0.24 * j);
          s.text(t, x0, y - 6.5 * s.u, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-2') });
          // The whole track is 100% solved.
          s.rrect(x0, y - 2.5 * s.u, L, 5 * s.u, 1, { stroke: s.tint('--ink-3', 0.5), lw: 0.25 });
          hbar(s, x0, y, L * v * Math.min(1, a * 1.2), k, `${(v * 100).toFixed(1)}%`, { h: 5 });
        }),
      );
    });
  },
};

// ---- scene 3: what the vote needs: real sampling, and answers that can be compared

const needs: SceneDef = {
  draw(s) {
    const cmp = s.ease('compare', 0.7);
    const { x0, rowY, pile: P } = layout(s, true);
    s.alpha(1 - cmp, () => {
      s.text('T → 0: greedy', s.w / 2, s.h * 0.07, { size: 3.6, font: 'mono', weight: 650, color: s.c('slate') });
      const same = s.ease('greedy', 0.8, 2.4);
      RUNS.forEach((r, i) => {
        const y = rowY(i);
        runLabel(s, i, x0, y);
        s.alpha(1 - same, () => path(s, x0, y, r));
        s.alpha(same, () => path(s, x0, y, GREEDY, { dim: i === 0 ? 0 : 0.35 }));
      });
      const cp = s.ease('copies', 0.6);
      s.alpha(cp, () => {
        pile(s, P, [408, 408, 408, 408, 408], { a: (i) => s.ease('copies', 0.4, 0.3 + 0.25 * i), counts: s.ease('copies', 0.6, 2) });
        s.alpha(s.ease('copies', 0.6, 3.5), () => s.text('one answer: nothing to choose', P.cx, P.y + 10 * s.u, { size: 3, font: 'mono', weight: 600, color: s.c('slate') }));
      });
    });
    s.alpha(cmp, () => {
      const vx = s.w / 2 - (s.tall ? 38 : 36) * s.u;
      s.text('408, 398, 408, 408, 418', vx + 5 * s.u, s.h * 0.24, { size: 3.6, font: 'mono', weight: 650, align: 'left', color: s.c('orange') });
      verdict(s, true, 'a number, a letter, yes or no', vx, s.h * 0.34, 3.4);
      s.alpha(s.ease('compare', 0.6, 3), () => s.text('from a fixed set: counted', vx + 5 * s.u, s.h * 0.42, { size: 3, font: 'mono', color: s.c('--ink-3'), align: 'left' }));
      s.alpha(s.ease('stories', 0.6), () => {
        s.text('five stories about a lighthouse', vx + 5 * s.u, s.h * 0.6, { size: 3.6, font: 'mono', weight: 650, align: 'left', color: s.c('orange') });
        verdict(s, false, 'no two match: one vote each', vx, s.h * 0.7, 3.4);
      });
    });
  },
};

// ---- scene 4: two worked problems, as the practice asks them

const ANS = [15, 12, 12, 8, 12, 15, 12];
const LETTERS = ['B', 'B', 'C', 'B', 'D'];
const kOf = (v: number): Ink => (v === 12 ? 'green' : 'red');

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

export const scenes: Record<string, SceneDef> = { slip, vote, needs, try: tryIt };

import type { Scene, SceneDef } from '../../../lecture/scene';
import { columns, verdict } from '../../draw';
import { mark, word } from '../draw';

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

const vote: SceneDef = {
  draw(s) {
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
  },
};

/** What each block of the grid is worth, one line per row of text. */
const WORTH: [string, number, 'green' | 'gold' | 'teal' | '--ink-2', number, string, number][] = [
  ['both right: 7 × 7 = 49 of 100', 0, 'green', 600, 'both', 2.4],
  ['0.7 × 0.7 = 0.49', 1, 'green', 700, 'both', 4],
  ['right, then wrong: 7 × 3 = 21', 2, 'gold', 600, 'mixed', 4],
  ['0.7 × 0.3 = 0.21', 3, 'gold', 700, 'mixed', 5.5],
  ['independent: multiply the chances', 4, 'teal', 650, 'rule', 0.5],
  ['all three right: 0.49 × 0.7 = 0.343', 5, '--ink-2', 650, 'third', 1],
];

/** Two samples at p = 0.7 as 100 equally likely pairs: the first across, the second down. */
const both: SceneDef = {
  draw(s) {
    const c = (s.tall ? 4.2 : 4.4) * s.u;
    const strip = 1.5 * c;
    const side = 5.5 * s.u;
    const size = s.tall ? 3.1 : 2.9;
    const textW = Math.max(...WORTH.map(([t]) => s.measure(t, { size, font: 'mono', weight: 700 })));
    const gap = 6 * s.u;
    const x0 = s.tall ? s.w / 2 - (side + strip + 10 * c) / 2 : s.w / 2 - (side + strip + 10 * c + gap + textW) / 2;
    const gx = x0 + side + strip;
    const gy = s.h * (s.tall ? 0.17 : 0.24);
    const two = s.ease('two', 0.8);
    const cell = (x: number, y: number, ok: boolean, a = 1) =>
      s.alpha(a, () => s.rrect(x + 0.35 * s.u, y + 0.35 * s.u, c - 0.7 * s.u, c - 0.7 * s.u, 0.6, { fill: s.tint(ok ? 'green' : 'red', 0.5), stroke: s.c(ok ? 'green' : 'red'), lw: 0.2 }));
    // The first sample: one strip of ten runs, seven right.
    s.alpha(s.ease('one', 0.6), () => {
      for (let j = 0; j < 10; j++) cell(gx + j * c, gy - strip, j < 7, s.ease('one', 0.4, 0.6 + 0.12 * j));
      s.alpha(1 - two, () => s.text('one sample, 10 runs: 7 right, 3 wrong', s.tall ? s.w / 2 : gx + 5 * c, gy + 2 * c, { size: 3, font: 'mono', color: s.c('--ink-2') }));
      s.alpha(two, () => s.text('first sample', gx + 5 * c, gy - strip - 4 * s.u, { size: 3, font: 'mono', weight: 600, color: s.c('--ink-2') }));
    });
    // The second sample down the side, and the grid of pairs.
    s.alpha(two, () => {
      for (let i = 0; i < 10; i++) cell(gx - strip, gy + i * c, i < 7, s.ease('two', 0.4, 0.6 + 0.1 * i));
      const ctx = s.ctx;
      ctx.save();
      ctx.translate(gx - strip - 2.6 * s.u, gy + 5 * c);
      ctx.rotate(-Math.PI / 2);
      s.text('second sample', 0, 0, { size: 3, font: 'mono', weight: 600, color: s.c('--ink-2') });
      ctx.restore();
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 10; j++) {
          const x = gx + j * c + 0.35 * s.u;
          const y = gy + i * c + 0.35 * s.u;
          const hit = j < 7 && i < 7 ? s.ease('both', 0.5, 1 + 0.15 * j) : 0;
          const mix = j < 7 && i >= 7 ? s.ease('mixed', 0.5, 2.5 + 0.15 * j) : 0;
          s.rrect(x, y, c - 0.7 * s.u, c - 0.7 * s.u, 0.6, { fill: s.tint('--ink-3', 0.12), stroke: s.tint('--ink-3', 0.3), lw: 0.15 });
          s.alpha(hit, () => s.rrect(x, y, c - 0.7 * s.u, c - 0.7 * s.u, 0.6, { fill: s.tint('green', 0.42) }));
          s.alpha(mix, () => s.rrect(x, y, c - 0.7 * s.u, c - 0.7 * s.u, 0.6, { fill: s.tint('gold', 0.5) }));
        }
      }
    });
    const tx = s.tall ? s.w / 2 : gx + 10 * c + gap;
    const ty = (k: number) => (s.tall ? gy + 10 * c + (6 + 5.4 * k) * s.u : gy + [0.6, 1.3, 2.8, 3.5, 5, 6.5][k]! * 1.5 * c);
    WORTH.forEach(([t, k, col, w, beat, delay]) =>
      s.alpha(s.ease(beat, 0.6, delay), () => s.text(t, tx, ty(k), { size, font: 'mono', weight: w, align: s.tall ? 'center' : 'left', color: s.c(col) })),
    );
  },
};

/** The winning outcomes of three samples at p = 0.7, and what each is worth. */
const WINS: [boolean[], string][] = [
  [[true, true, true], '0.7 × 0.7 × 0.7 = 0.343'],
  [[true, true, false], '0.7 × 0.7 × 0.3 = 0.147'],
  [[true, false, true], '0.147'],
  [[false, true, true], '0.147'],
];

const odds: SceneDef = {
  marks: {
    f: { tex: String.raw`p^3 + 3\,p^2(1 - p)`, x: 0.5, y: 0.08, size: 5 },
  },
  draw(s) {
    const cmp = s.ease('compare', 0.7);
    s.show('f', s.ease('sum', 0.6, 1) * (1 - cmp));
    const mx = s.tall ? s.w / 2 - 36 * s.u : 5 * s.u;
    const rowY = (i: number) => s.h * (s.tall ? 0.25 + i * 0.07 : 0.3 + i * 0.1);
    s.alpha(1 - cmp, () => {
      s.alpha(s.ease('p', 0.6), () => {
        s.text('each sample right with p = 0.7', s.tall ? s.w / 2 : mx, s.h * 0.17, { size: 3.2, font: 'mono', align: s.tall ? 'center' : 'left', color: s.c('--ink-2') });
        s.alpha(1 - s.ease('three', 0.5), () => s.text('vote of 3: right if at least 2 are', s.tall ? s.w / 2 : mx, rowY(1), { size: 3.2, font: 'mono', align: s.tall ? 'center' : 'left', color: s.c('teal') }));
      });
      WINS.forEach(([ms, val], i) => {
        const y = rowY(i);
        const a = i === 0 ? s.ease('three', 0.6) : i === 1 ? s.ease('two', 0.5, 0.4) : s.ease('ways', 0.5, 0.8 + 0.5 * (i - 2));
        s.alpha(a, () => {
          ms.forEach((ok, j) => mark(s, ok, mx + j * 5 * s.u, y, 3.6));
          s.text(val, mx + 15 * s.u, y, { size: 3.1, font: 'mono', align: 'left', color: s.c(i === 0 ? 'green' : 'teal') });
        });
      });
      s.alpha(s.ease('ways', 0.6, 2.4), () => s.text('3 ways: 3 × 0.147 = 0.441', mx + 15 * s.u, rowY(4) - (s.tall ? 0.01 : 0.02) * s.h, { size: 3.1, font: 'mono', weight: 650, align: 'left', color: s.c('teal') }));
      // One sample against the vote of three, for p = 0.7 and then p = 0.4.
      const base = s.h * (s.tall ? 0.93 : 0.84);
      const hgt = s.h * (s.tall ? 0.2 : 0.5);
      const bw = 9 * s.u;
      const groups: [string, number, number, number][] = [
        ['p = 0.7', 0.7, 0.784, s.ease('sum', 0.6)],
        ['p = 0.4', 0.4, 0.352, s.ease('below', 0.6)],
      ];
      const gx = s.tall ? columns(s, 2, 42) : [s.w * 0.64, s.w * 0.86];
      s.alpha(s.ease('sum', 0.6), () => s.line(gx[0]! - 12 * s.u, base, gx[1]! + 12 * s.u, base, s.c('--axis'), 0.35));
      groups.forEach(([name, one, three, a], g) => {
        s.alpha(a, () => {
          [one, three].forEach((v, j) => {
            const x = gx[g]! + (j - 0.5) * 13 * s.u;
            const h = v * hgt;
            const k = j === 0 ? 'slate' : v > one ? 'green' : 'red';
            s.rrect(x - bw / 2, base - h, bw, h, 1, { fill: s.tint(k, 0.4), stroke: s.c(k), lw: 0.3 });
            s.text(v.toFixed(3).replace(/0$/, ''), x, base - h - 3 * s.u, { size: 3, font: 'mono', weight: 600, color: s.c(k), halo: true });
            s.text(j === 0 ? 'one' : 'vote', x, base + 3 * s.u, { size: 2.7, font: 'mono', color: s.c('--ink-3') });
          });
          s.text(name, gx[g]!, base - hgt - 6 * s.u, { size: 3.1, font: 'mono', weight: 650, color: s.c('--ink-2') });
        });
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

export const scenes: Record<string, SceneDef> = { vote, both, odds };

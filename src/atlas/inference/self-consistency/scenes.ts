import type { Scene, SceneDef } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { cite, columns } from '../../draw';
import { mark } from '../draw';

/** One vote: each sample's check or cross, an arrow, and the majority's verdict. */
function ballot(s: Scene, cx: number, y: number, oks: boolean[], gap: number, a: number[]): void {
  const n = oks.length;
  // The samples, then 23u more for the arrow, the word and the verdict.
  const x0 = cx - ((n - 1) * gap + 23 * s.u) / 2;
  oks.forEach((ok, j) => s.alpha(a[j] ?? 1, () => mark(s, ok, x0 + j * gap, y, 4.4)));
  const win = oks.filter(Boolean).length * 2 > n;
  const xe = x0 + (n - 1) * gap;
  s.alpha(a[n] ?? 1, () => {
    s.arrow(xe + 3.5 * s.u, y, xe + 8.5 * s.u, y, s.c('--ink-3'), 0.3, 1.4);
    s.text('vote', xe + 14 * s.u, y, { size: 3, font: 'mono', color: s.c('--ink-3') });
    mark(s, win, xe + 23 * s.u, y, 5);
  });
}

// ---- scene 1: a vote of three survives one slip; Condorcet's jury theorem

const claim: SceneDef = {
  draw(s) {
    const cx = s.w / 2;
    const top = s.win('one', 'condorcet', 0.7);
    const g = 8 * s.u;
    s.alpha(top, () => {
      s.text('three samples, then a vote', cx, s.h * 0.1, { size: 3.3, font: 'mono', weight: 650, color: s.c('--ink-2') });
      const y1 = s.h * 0.3;
      ballot(s, cx, y1, [true, true, false], g, [s.ease('one', 0.4, 1.4), s.ease('one', 0.4, 1.7), s.ease('one', 0.4, 2), s.ease('one', 0.5, 4)]);
      s.alpha(s.ease('one', 0.5, 5), () => s.text('one wrong: outvoted', cx, y1 + 8 * s.u, { size: 3, font: 'mono', weight: 600, color: s.c('green') }));
      const y2 = s.h * 0.56;
      ballot(s, cx, y2, [true, false, false], g, [s.ease('two', 0.4, 0.6), s.ease('two', 0.4, 0.9), s.ease('two', 0.4, 1.2), s.ease('two', 0.5, 2)]);
      s.alpha(s.ease('two', 0.5, 2.6), () => s.text('two wrong at once: the vote is wrong', cx, y2 + 8 * s.u, { size: 3, font: 'mono', weight: 600, color: s.c('red') }));
      s.alpha(s.ease('two', 0.6, 5.5), () => s.text('when each is usually right, rarer than one wrong', cx, s.h * 0.82, { size: 3, italic: true, color: s.c('--ink-2') }));
    });
    // A larger jury: seven independent voters, five of them right.
    s.alpha(s.ease('condorcet', 0.7, 0.4), () => {
      const y = s.h * 0.3;
      const oks = [true, true, false, true, true, false, true];
      ballot(s, cx, y, oks, (s.tall ? 7 : 7.5) * s.u, oks.map((_, j) => s.ease('condorcet', 0.4, 1 + 0.25 * j)).concat([s.ease('condorcet', 0.5, 3)]));
      s.alpha(s.ease('condorcet', 0.5, 3.4), () => s.text('5 of 7 right: the majority is right', cx, y + 8 * s.u, { size: 3, font: 'mono', weight: 600, color: s.c('green') }));
    });
    cite(s, 'Condorcet, 1785 · the jury theorem', s.ease('condorcet', 0.6));
    const lines: [string, Ink, number][] = [
      ['voters decide independently', '--ink-2', 0.8],
      ['each right more often than not', '--ink-2', 3.2],
      ['→ the majority, more often still', 'green', 5.6],
      ['→ more so, the more voters', 'green', 8.4],
    ];
    lines.forEach(([t, k, d], i) =>
      s.alpha(s.ease('jury', 0.6, d), () => s.text(t, cx, s.h * (0.56 + 0.09 * i), { size: 3.2, font: 'mono', weight: i >= 2 ? 650 : 500, color: s.c(k) })),
    );
  },
};

// ---- scene 2: two samples at p = 0.7 as 100 equally likely pairs, the first across, the second down

/** What each block of the grid is worth, one line each: text, color, weight, beat, delay. */
const WORTH: [string, 'green' | 'gold' | 'red' | 'teal' | '--ink-2', number, string, number][] = [
  ['both right: 7 × 7 = 49 squares', 'green', 600, 'both', 4.5],
  ['0.7 × 0.7 = 0.49', 'green', 700, 'mult', 1.5],
  ['independent: multiply the chances', 'teal', 650, 'mult', 5],
  ['right, wrong: 7 × 3 = 21 → 0.21', 'gold', 650, 'mixed', 5.5],
  ['both wrong: 3 × 3 = 9 → 0.09', 'red', 650, 'wrong', 2],
  ['one wrong: 30 in 100; two: 9', '--ink-2', 650, 'wrong', 5.5],
];

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
    const two = s.ease('indep', 0.8);
    const cell = (x: number, y: number, ok: boolean, a = 1) =>
      s.alpha(a, () => s.rrect(x + 0.35 * s.u, y + 0.35 * s.u, c - 0.7 * s.u, c - 0.7 * s.u, 0.6, { fill: s.tint(ok ? 'green' : 'red', 0.5), stroke: s.c(ok ? 'green' : 'red'), lw: 0.2 }));
    // The first sample: one strip of ten runs, seven right.
    s.alpha(s.ease('p', 0.6), () => {
      for (let j = 0; j < 10; j++) cell(gx + j * c, gy - strip, j < 7, s.ease('p', 0.4, 0.6 + 0.12 * j));
      s.alpha(1 - two, () => s.text('one sample, 10 runs: 7 right, 3 wrong', s.tall ? s.w / 2 : gx + 5 * c, gy + 2 * c, { size: 3, font: 'mono', color: s.c('--ink-2') }));
      s.alpha(two, () => s.text('first sample', gx + 5 * c, gy - strip - 4 * s.u, { size: 3, font: 'mono', weight: 600, color: s.c('--ink-2') }));
    });
    // The second sample down the side, and the grid of pairs.
    s.alpha(two, () => {
      for (let i = 0; i < 10; i++) cell(gx - strip, gy + i * c, i < 7, s.ease('indep', 0.4, 0.6 + 0.1 * i));
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
          const bad = j >= 7 && i >= 7 ? s.ease('wrong', 0.5, 0.6 + 0.15 * (j - 7)) : 0;
          s.rrect(x, y, c - 0.7 * s.u, c - 0.7 * s.u, 0.6, { fill: s.tint('--ink-3', 0.12), stroke: s.tint('--ink-3', 0.3), lw: 0.15 });
          s.alpha(hit, () => s.rrect(x, y, c - 0.7 * s.u, c - 0.7 * s.u, 0.6, { fill: s.tint('green', 0.42) }));
          s.alpha(mix, () => s.rrect(x, y, c - 0.7 * s.u, c - 0.7 * s.u, 0.6, { fill: s.tint('gold', 0.5) }));
          s.alpha(bad, () => s.rrect(x, y, c - 0.7 * s.u, c - 0.7 * s.u, 0.6, { fill: s.tint('red', 0.45) }));
        }
      }
    });
    const tx = s.tall ? s.w / 2 : gx + 10 * c + gap;
    const ty = (k: number) => (s.tall ? gy + 10 * c + (6 + 5.4 * k) * s.u : gy + (0.6 + 1.15 * k) * 1.5 * c);
    WORTH.forEach(([t, col, w, beat, delay], k) =>
      s.alpha(s.ease(beat, 0.6, delay), () => s.text(t, tx, ty(k), { size, font: 'mono', weight: w, align: s.tall ? 'center' : 'left', color: s.c(col) })),
    );
  },
};

// ---- scene 3: the vote of three at p = 0.7, its formula, and p = 0.4

/** The winning outcomes of three samples at p = 0.7, and what each is worth. */
const WINS: [boolean[], string][] = [
  [[true, true, true], '0.49 × 0.7 = 0.343'],
  [[true, true, false], '0.7 × 0.7 × 0.3 = 0.147'],
  [[true, false, true], '0.147'],
  [[false, true, true], '0.147'],
];

const odds: SceneDef = {
  marks: {
    f: { tex: String.raw`p^3 + 3\,p^2(1 - p)`, x: 0.5, y: 0.08, size: 5 },
  },
  draw(s) {
    s.show('f', s.win('formula', 'half'));
    s.alpha(s.ease('half', 0.6, 0.4), () => s.text('the vote helps only if p > 0.5', s.w / 2, s.h * 0.08, { size: 3.4, font: 'mono', weight: 650, color: s.c('teal') }));
    const mx = s.tall ? s.w / 2 - 36 * s.u : 5 * s.u;
    const rowY = (i: number) => s.h * (s.tall ? 0.25 + i * 0.07 : 0.3 + i * 0.1);
    s.alpha(s.ease('p', 0.6), () => {
      s.text('each sample right with p = 0.7', s.tall ? s.w / 2 : mx, s.h * 0.17, { size: 3.2, font: 'mono', align: s.tall ? 'center' : 'left', color: s.c('--ink-2') });
      s.alpha(1 - s.ease('three', 0.5), () => {
        s.text('vote of 3: right if at least 2 are', s.tall ? s.w / 2 : mx, rowY(1), { size: 3.2, font: 'mono', align: s.tall ? 'center' : 'left', color: s.c('teal') });
        s.alpha(s.ease('p', 0.6, 2.4), () => s.text('chance the vote is right?', s.tall ? s.w / 2 : mx, rowY(2), { size: 3.2, font: 'mono', weight: 650, align: s.tall ? 'center' : 'left', color: s.c('--ink-2') }));
      });
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
    s.alpha(s.ease('sum', 0.6, 0.2), () => s.text('0.343 + 0.441 = 0.784', mx + 15 * s.u, rowY(4) + (s.tall ? 0.055 : 0.07) * s.h, { size: 3.1, font: 'mono', weight: 650, align: 'left', color: s.c('green') }));
    // One sample against the vote of three, for p = 0.7 and then p = 0.4.
    const base = s.h * (s.tall ? 0.93 : 0.84);
    const hgt = s.h * (s.tall ? 0.2 : 0.5);
    const bw = 9 * s.u;
    const groups: [string, number, number, number][] = [
      ['p = 0.7', 0.7, 0.784, s.ease('sum', 0.6, 1.5)],
      ['p = 0.4', 0.4, 0.352, s.ease('below', 0.6, 1)],
    ];
    const gx = s.tall ? columns(s, 2, 42) : [s.w * 0.64, s.w * 0.86];
    s.alpha(s.ease('sum', 0.6, 1.5), () => s.line(gx[0]! - 12 * s.u, base, gx[1]! + 12 * s.u, base, s.c('--axis'), 0.35));
    groups.forEach(([name, one, three, a], g) => {
      s.alpha(a, () => {
        [one, three].forEach((v, j) => {
          const x = gx[g]! + (j - 0.5) * 13 * s.u;
          const h = v * hgt * (j === 0 ? 1 : Math.min(1, a * 1.1));
          const k = j === 0 ? 'slate' : v > one ? 'green' : 'red';
          s.rrect(x - bw / 2, base - h, bw, h, 1, { fill: s.tint(k, 0.4), stroke: s.c(k), lw: 0.3 });
          s.text(String(v), x, base - h - 3 * s.u, { size: 3, font: 'mono', weight: 600, color: s.c(k), halo: true });
          s.text(j === 0 ? 'one' : 'vote', x, base + 3 * s.u, { size: 2.7, font: 'mono', color: s.c('--ink-3') });
        });
        s.text(name, gx[g]!, base - hgt - 6 * s.u, { size: 3.1, font: 'mono', weight: 650, color: s.c('--ink-2') });
      });
    });
  },
};

export const scenes: Record<string, SceneDef> = { claim, both, odds };

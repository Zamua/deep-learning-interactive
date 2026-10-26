import type { SceneDef } from '../../../lecture/scene';
import { Rng } from '../../../core/rand';
import { cells, columns, frame, num, rich, rowLabel, verdict } from '../draw';

// Two clouds of 2-D activations, nouns and the rest, and a probe direction that separates them.
const rng = new Rng(7);
const PTS: [number, number, number][] = [];
while (PTS.length < 24) {
  const noun = PTS.length % 2;
  const x = noun ? 1.2 + rng.randn() * 0.5 : -1 + rng.randn() * 0.5;
  const y = noun ? 0.9 + rng.randn() * 0.45 : -0.7 + rng.randn() * 0.45;
  if (Math.abs(x) < 2.2 && Math.abs(y) < 2.1) PTS.push([x, y, noun]);
}
const W = [1, 0.8];
const B = -0.2;

const probe: SceneDef = {
  draw(s) {
    const dim = 1 - 0.75 * s.ease('example', 0.6);
    const size = Math.min(s.h * 0.5, s.w * 0.62);
    const F = frame(s.w / 2 - size / 2, s.h * 0.06, s.w / 2 + size / 2, s.h * 0.06 + size, [-2.6, 2.6], [-2.4, 2.4]);
    s.alpha(dim, () => {
      s.rrect(F.l, F.t, F.r - F.l, F.b - F.t, 1.5, { stroke: s.c('--axis'), lw: 0.3 });
      for (const [x, y, noun] of PTS) s.circle(F.X(x), F.Y(y), 1.1 * s.u, { fill: s.tint(noun ? 'teal' : 'slate', 0.85) });
      s.text('h for each word', s.w / 2, F.b + 3.5 * s.u, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
      s.alpha(s.ease('fit', 0.6), () => {
        // The boundary w·h + b = 0, and w pointing to the positive side.
        const at = (x: number) => (-B - W[0]! * x) / W[1]!;
        const c = s.ctx;
        c.save();
        c.beginPath();
        c.rect(F.l, F.t, F.r - F.l, F.b - F.t);
        c.clip();
        s.line(F.X(-2.6), F.Y(at(-2.6)), F.X(2.6), F.Y(at(2.6)), s.c('gold'), 0.5, [1.4, 1]);
        c.restore();
        s.arrow(F.X(0.1), F.Y(at(0.1)), F.X(0.1 + 0.9), F.Y(at(0.1) + 0.72), s.c('blue'), 0.5, 2);
        s.text('w', F.X(1.1), F.Y(at(0.1) + 0.9), { size: 3.4, font: 'mono', weight: 650, color: s.c('blue'), halo: true });
        s.text('noun', F.r - 1.5 * s.u, F.t + 3 * s.u, { size: 3, font: 'mono', align: 'right', color: s.c('teal'), halo: true });
        s.text('not', F.l + 1.5 * s.u, F.b - 3 * s.u, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-2'), halo: true });
      });
    });
    s.alpha(s.ease('freeze', 0.6, 1.5) * (1 - s.ease('example', 0.6)), () => {
      s.text('model frozen: only w and b are fit', s.w / 2, s.h * 0.68, { size: 3.4, color: s.c('--ink-2') });
    });
    s.alpha(s.ease('example', 0.6), () => {
      const xs = columns(s, 3, s.tall ? 17 : 19);
      const lx = xs[0]! - 12 * s.u;
      rowLabel(s, 'h', lx, s.h * 0.66, 'gold');
      cells(s, xs, s.h * 0.66, ['2', '−1', '0.5'], 'gold', { w: 13, h: 8 });
      rowLabel(s, 'w', lx, s.h * 0.77, 'blue');
      cells(s, xs, s.h * 0.77, ['1', '2', '−2'], 'blue', { w: 13, h: 8 });
    });
    s.alpha(s.ease('example', 0.6, 3), () => {
      rich(s, [['2 − 2 − 1 + 0.5 = ', '--ink-2'], ['−0.5', 'red'], [': not a noun', '--ink-2']], s.w / 2, s.h * 0.9, { size: s.tall ? 3.4 : 3.8 });
    });
  },
};

/** A three-class probe for tense on h = [1, 2]: one weight row and one bias per class. */
const TENSE: [string, string, string, string, number][] = [
  ['past', '[1, 0]', '0', '1 × 1 + 0 × 2 + 0', 1],
  ['present', '[−1, 2]', '−1', '(−1) × 1 + 2 × 2 − 1', 2],
  ['future', '[2, −1]', '1', '2 × 1 + (−1) × 2 + 1', 1],
];

const classes: SceneDef = {
  draw(s) {
    const size = s.tall ? 3.3 : 3.7;
    const o = { size, font: 'mono' } as const;
    const left = (lines: string[]) => s.w / 2 - Math.max(...lines.map((l) => s.measure(l, o))) / 2;
    s.alpha(s.ease('rows', 0.6), () => rich(s, [['h = ', '--ink-2'], ['[1, 2]', 'gold']], s.w / 2, s.h * 0.1, { size: size + 0.3 }));
    const defs = TENSE.map(([name, w, b], c) => [`${name.padEnd(9)}w${'₀₁₂'[c]} = ${w.padEnd(9)}b${'₀₁₂'[c]} = ${b}`, c] as const);
    const dx = left(defs.map(([t]) => t));
    defs.forEach(([t, c]) => {
      s.alpha(s.ease('rows', 0.5, 2.5 + c * 1.8), () => s.text(t, dx, s.h * (0.24 + c * 0.09), { ...o, align: 'left', color: s.c('--ink-2') }));
    });
    const sums = TENSE.map(([name, , , work, v]) => `${name.padEnd(9)}${work} = ${v}`);
    const sx = left(sums);
    const win = s.ease('wins', 0.6);
    TENSE.forEach(([name, , , work, v], c) => {
      const y = s.h * (0.56 + c * 0.09);
      const hi = c === 1 ? win : 0;
      s.alpha(s.ease('scores', 0.5, 2.6 + c * 3.4), () => {
        if (hi > 0) s.alpha(hi, () => s.rrect(sx - 2 * s.u, y - 3.6 * s.u, s.measure(sums[c]!, o) + 4 * s.u, 7.2 * s.u, 1.2, { fill: s.tint('green', 0.14), stroke: s.c('green'), lw: 0.3 }));
        rich(s, [[`${name.padEnd(9)}${work} = `, '--ink-2'], [String(v), c === 1 ? 'green' : '--ink']], sx, y, { ...o, align: 'left' });
      });
    });
    s.alpha(win, () => s.text('highest score: present', s.w / 2, s.h * 0.88, { size, weight: 600, color: s.c('green') }));
  },
};

const SCORES = [1.8, -0.6, 0.4, 2.1, -1.5, 0.7, -0.2, -1.1];
const LABELS = [1, 0, 0, 1, 0, 1, 1, 0];
const PREDS = SCORES.map((v) => (v > 0 ? 1 : 0));

const test: SceneDef = {
  draw(s) {
    const xs = columns(s, 8, s.tall ? 12.4 : 13);
    const rows: [string, string[], 'purple' | 'teal' | 'gold', number, number][] = [
      ['score', SCORES.map((v) => num(v)), 'purple', s.h * 0.16, 1],
      ['prediction: score > 0', PREDS.map(String), 'teal', s.h * 0.38, s.ease('held', 0.6, 1.5)],
      ['true label', LABELS.map(String), 'gold', s.h * 0.6, s.ease('count', 0.6)],
    ];
    rows.forEach(([name, vals, k, y, a]) => {
      s.alpha(a, () => {
        s.text(name, s.w / 2, y - 7.5 * s.u, { size: 3.1, color: s.c(k) });
        cells(s, xs, y, vals, k, { w: 11, h: 7.5, size: 3 });
      });
    });
    s.alpha(s.ease('count', 0.6, 1.5), () => {
      xs.forEach((x, i) => {
        const ok = PREDS[i] === LABELS[i];
        s.text(ok ? '✓' : '✗', x, s.h * 0.72, { size: 4, font: 'ui', weight: 700, color: s.c(ok ? 'green' : 'red') });
      });
    });
    s.alpha(s.ease('count', 0.6, 3.5), () => {
      rich(s, [['accuracy  6 / 8 = ', '--ink-2'], ['0.75', 'green'], ['   coin flip 0.5', '--ink-3']], s.w / 2, s.h * 0.86, { size: s.tall ? 3.4 : 3.8 });
    });
  },
};

const meaning: SceneDef = {
  draw(s) {
    const x = s.w / 2 - (s.tall ? 42 : 48) * s.u;
    const size = s.tall ? 3.4 : 3.8;
    s.alpha(s.ease('there', 0.6), () => verdict(s, true, 'the stream holds it, linearly readable', x, s.h * 0.2, size));
    s.alpha(s.ease('use', 0.6), () => verdict(s, false, 'the model uses it: not shown', x, s.h * 0.36, size));
    s.alpha(s.ease('use', 0.6, 3), () => s.text('use needs an experiment on the model', x + size * 1.4 * s.u, s.h * 0.44, { size: 3, align: 'left', color: s.c('--ink-3') }));
    s.alpha(s.ease('linear', 0.6), () => {
      s.text('linear probe: reads what is there', s.w / 2, s.h * 0.62, { size, color: s.c('green') });
      s.text('big probe: may compute it itself', s.w / 2, s.h * 0.74, { size, color: s.c('red') });
    });
  },
};

export const scenes: Record<string, SceneDef> = { probe, classes, test, meaning };

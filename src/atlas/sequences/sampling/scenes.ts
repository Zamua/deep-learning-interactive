import type { Scene, SceneDef } from '../../../lecture/scene';
import { bars, cells, columns, rowLabel } from '../../draw';
import { chip, fmt } from '../draw';

const TOK = ['cat', 'dog', 'fish'];
const S = [2, 1, 0];
const soft = (z: number[]) => {
  const e = z.map(Math.exp);
  const t = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / t);
};
const P = soft(S);
const f2 = (v: number) => v.toFixed(2);
/** What a run of draws looks like: greedy repeats itself, sampling mixes. */
const GREEDY = ['cat', 'cat', 'cat', 'cat', 'cat', 'cat'];
const SAMPLED = ['cat', 'dog', 'cat', 'cat', 'fish', 'cat'];

/** Bars over the three tokens, with the tokens named under them. */
function tokenBars(s: Scene, xs: number[], base: number, p: number[], o: { height: number; hi?: number[]; size?: number }): void {
  bars(s, xs, base, p, 'teal', { max: 1, height: o.height, w: 9, fmt: f2, hi: o.hi });
  TOK.forEach((t, j) => s.text(t, xs[j]!, base + 3.6 * s.u, { size: o.size ?? 3, font: 'mono', weight: 600, color: s.c('--ink-2') }));
}

function strip(s: Scene, y: number, toks: string[], k: 'gold' | 'teal', label: string, a: number): void {
  s.alpha(a, () => {
    const xs = columns(s, toks.length, 14);
    s.text(label, s.w / 2, y - 7.5 * s.u, { size: 3, color: s.c('--ink-3') });
    toks.forEach((t, i) => s.alpha(Math.min(1, Math.max(0, a * 7 - i)), () => chip(s, xs[i]!, y, t, k, { w: 12, h: 6.5, size: 2.9 })));
  });
}

const pick: SceneDef = {
  draw(s) {
    const xs = columns(s, 3, 18);
    const ys = s.h * 0.17;
    rowLabel(s, 's', xs[0]! - 11 * s.u, ys, 'purple');
    cells(s, xs, ys, S.map(String), 'purple', { w: 12, h: 8 });
    TOK.forEach((t, j) => s.text(t, xs[j]!, ys - 7.5 * s.u, { size: 3, font: 'mono', color: s.c('--ink-3') }));
    const base = s.h * 0.62;
    const g = s.ease('probs', 0.9, 0.6);
    s.alpha(s.ease('probs', 0.6), () => {
      s.arrow(s.w / 2, ys + 6 * s.u, s.w / 2, ys + 13 * s.u, s.c('--ink-3'), 0.35, 1.8);
      s.text('softmax', s.w / 2 + 3 * s.u, ys + 9.5 * s.u, { size: 2.8, font: 'mono', align: 'left', color: s.c('--ink-3') });
      bars(s, xs, base, P, 'teal', { max: 1, height: 22, w: 10, fmt: f2, grow: g, hi: [s.win('greedy', 'sample'), 0, 0] });
      TOK.forEach((t, j) => s.text(t, xs[j]!, base + 3.6 * s.u, { size: 3, font: 'mono', weight: 600, color: s.c('--ink-2') }));
    });
    strip(s, s.h * 0.85, GREEDY, 'gold', 'greedy: the top token every time', s.ease('greedy', 1.4, 1) * (1 - s.ease('sample', 0.5)));
    strip(s, s.h * 0.85, SAMPLED, 'teal', 'sampled: one possible run', s.ease('sample', 1.4, 1.2));
  },
};

const ROWS: [string, number][] = [
  ['T = 0.5', 0.5],
  ['T = 1', 1],
  ['T = 2', 2],
];

const temp: SceneDef = {
  marks: {
    f: { tex: String.raw`\symp = \mathrm{softmax}(\syms / \symT)`, x: 0.5, y: 0.07, size: 5 },
  },
  draw(s) {
    s.show('f', s.ease('formula', 0.6));
    const xs = columns(s, 3, 16).map((x) => x + 10 * s.u);
    const lim = s.ease('limits', 0.7);
    const beat = ['low', 'formula', 'high'];
    s.alpha(1 - lim, () => {
      ROWS.forEach(([name, T], r) => {
        const base = s.h * (0.34 + 0.26 * r);
        const a = r === 1 ? 1 : s.ease(beat[r]!, 0.6);
        s.alpha(a, () => {
          rowLabel(s, name, xs[0]! - 11 * s.u, base - 7 * s.u, 'slate', 3.4);
          s.text(`s/T = [${S.map((v) => fmt(v / T)).join(', ')}]`, xs[0]! - 11 * s.u, base - 1.5 * s.u, { size: 2.6, font: 'mono', align: 'right', color: s.c('--ink-3') });
          tokenBars(s, xs, base, soft(S.map((v) => v / T)), { height: 13, size: 2.6, hi: [r === 1 ? 0 : s.win('order', 'limits'), 0, 0] });
        });
      });
      s.alpha(s.ease('low', 0.6, 2.5), () => s.text('sharper', xs[2]! + 9 * s.u, s.h * 0.27, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('orange'), halo: true }));
      s.alpha(s.ease('high', 0.6, 2.5), () => s.text('flatter', xs[2]! + 9 * s.u, s.h * 0.79, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('blue'), halo: true }));
    });
    s.alpha(lim, () => {
      const lx = xs[0]! - 11 * s.u;
      rowLabel(s, 'T → 0', lx, s.h * 0.36 - 7 * s.u, 'slate', 3.4);
      tokenBars(s, xs, s.h * 0.4, [1, 0, 0], { height: 15, size: 2.6 });
      s.text('greedy', lx, s.h * 0.36 - 1 * s.u, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
      s.alpha(s.ease('limits', 0.6, 2.5), () => {
        rowLabel(s, 'T → ∞', lx, s.h * 0.74 - 7 * s.u, 'slate', 3.4);
        tokenBars(s, xs, s.h * 0.78, [1 / 3, 1 / 3, 1 / 3], { height: 15, size: 2.6 });
        s.text('uniform', lx, s.h * 0.74 - 1 * s.u, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
      });
    });
  },
};

export const scenes: Record<string, SceneDef> = { pick, temp };

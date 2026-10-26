import type { SceneDef } from '../../../lecture/scene';
import { bars, cells, columns, rowLabel } from '../../draw';
import { rich, stack } from '../draw';

const SRC = ['je', 'suis', 'étudiant'];
const ENC = [
  [2, 0],
  [0, 1],
  [1, 0],
];
const E = [2, 0, 1];
const A = (() => {
  const x = E.map(Math.exp);
  const t = x.reduce((a, b) => a + b, 0);
  return x.map((v) => v / t);
})();
const CTX = [0, 1].map((k) => ENC.reduce((a, h, j) => a + A[j]! * h[k]!, 0));
const f2 = (v: number) => v.toFixed(2);

/** Weights for each output word over the input words: each row adds up to 1. */
const OUT = ['I', 'am', 'a', 'student'];
const GRID = [
  [0.67, 0.09, 0.24],
  [0.1, 0.8, 0.1],
  [0.15, 0.6, 0.25],
  [0.05, 0.1, 0.85],
];

const look: SceneDef = {
  draw(s) {
    const xs = columns(s, 3, 28);
    const sc = s.ease('score', 0.6);
    const w = s.ease('weights', 0.6);
    rowLabel(s, 'h', xs[0]! - 9 * s.u, s.h * 0.2, 'gold', 3.6);
    SRC.forEach((t, j) => {
      s.text(t, xs[j]!, s.h * 0.07, { size: 3.4, font: 'mono', weight: 600, color: s.c('orange') });
      stack(s, xs[j]!, s.h * 0.2, ENC[j]!.map(String), 'gold', { gap: 8, w: 10, h: 6.5 });
    });
    s.alpha(s.ease('keep', 0.6, 2.5) * (1 - sc), () => s.text('one encoder state per input word', s.w / 2, s.h * 0.34, { size: 3.2, color: s.c('--ink-3') }));
    s.alpha(sc, () => {
      rich(s, [['q = [1, 0]', 'teal'], ['    score: q · hⱼ', '--ink-2']], s.w / 2, s.h * 0.32, { size: 3.2 });
      rowLabel(s, 's', xs[0]! - 9 * s.u, s.h * 0.41, 'purple', 3.6);
      cells(s, xs, s.h * 0.41, E.map(String), 'purple', { w: 10, h: 7, on: E.map(() => s.win('score', 'weights')) });
    });
    s.alpha(w, () => {
      const base = s.h * 0.68;
      rowLabel(s, 'α', xs[0]! - 9 * s.u, base - 4 * s.u, 'teal', 3.8);
      bars(s, xs, base, A, 'teal', { max: 1, height: 20, w: 9, fmt: f2, grow: s.ease('weights', 1, 0.3) });
    });
  },
};

const A2 = [0.67, 0.09, 0.24];
const SCALED = ENC.map((h, j) => h.map((v) => Math.round(A2[j]! * v * 100) / 100));
const fv = (v: number) => (v === 0 ? '0' : f2(v));

const mix: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 3, 28);
    const seq = (j: number) => s.ease('scale', 0.6, 0.4 + 2.6 * j);
    rowLabel(s, 'h', xs[0]! - 11 * u, s.h * 0.19, 'gold', 3.6);
    SRC.forEach((t, j) => {
      s.text(t, xs[j]!, s.h * 0.06, { size: 3.4, font: 'mono', weight: 600, color: s.c('orange') });
      stack(s, xs[j]!, s.h * 0.19, ENC[j]!.map(String), 'gold', { gap: 8, w: 10, h: 6.5, on: [s.win('scale', 'add') * seq(j), s.win('scale', 'add') * seq(j)] });
      s.alpha(s.ease('context', 0.6, 0.8 + 0.3 * j), () => s.text(`× ${f2(A2[j]!)}`, xs[j]!, s.h * 0.315, { size: 3.3, font: 'mono', weight: 650, color: s.c('teal'), halo: true }));
      s.alpha(seq(j), () => {
        s.arrow(xs[j]!, s.h * 0.345, xs[j]!, s.h * 0.37, s.c('--ink-3'), 0.35, 1.6);
        stack(s, xs[j]!, s.h * 0.45, SCALED[j]!.map(fv), 'slate', { gap: 8, w: 11, h: 6.5, on: [s.win('add', 'use'), s.win('add', 'use')] });
      });
    });
    s.alpha(s.ease('context', 0.6, 0.8), () => rowLabel(s, 'α', xs[0]! - 11 * u, s.h * 0.315, 'teal', 3.6));
    s.alpha(seq(0), () => rowLabel(s, 'αh', xs[0]! - 11 * u, s.h * 0.45, 'slate', 3.4));
    s.alpha(s.ease('add', 0.6), () => [0, 1].forEach((j) => s.text('+', (xs[j]! + xs[j + 1]!) / 2, s.h * 0.45, { size: 4, font: 'mono', weight: 600, color: s.c('--ink-2') })));
    const o = { size: 3.2, weight: 600 };
    s.alpha(s.ease('add', 0.6, 1), () => rich(s, [[`${fv(SCALED[0]![0]!)} + ${fv(SCALED[1]![0]!)} + ${fv(SCALED[2]![0]!)} = `, '--ink-2'], [f2(CTX[0]!), 'gold']], s.w / 2, s.h * 0.6, o));
    s.alpha(s.ease('add', 0.6, 3.5), () => rich(s, [[`${fv(SCALED[0]![1]!)} + ${fv(SCALED[1]![1]!)} + ${fv(SCALED[2]![1]!)} = `, '--ink-2'], [f2(CTX[1]!), 'gold']], s.w / 2, s.h * 0.67, o));
    s.alpha(s.ease('context', 0.6), () => {
      const v = s.ease('add', 0.8, 5);
      s.alpha(1 - v, () => rich(s, [['context = Σ αⱼ hⱼ', '--ink-2']], s.w / 2, s.h * 0.78, { size: 3.4, weight: 600 }));
      s.alpha(v, () => rich(s, [['context = Σ αⱼ hⱼ = ', '--ink-2'], [`[${CTX.map(f2).join(', ')}]`, 'gold']], s.w / 2, s.h * 0.78, { size: 3.4, weight: 600 }));
    });
    s.alpha(s.ease('use', 0.6), () => {
      rich(s, [['decoder state + context  →  ', '--ink-3'], ['I', 'gold']], s.w / 2, s.h * 0.88, { size: 3.2, weight: 600 });
    });
  },
};

const every: SceneDef = {
  draw(s) {
    const xs = columns(s, 3, 17).map((x) => x + 6 * s.u);
    const y0 = s.h * 0.22;
    const pitch = 11 * s.u;
    SRC.forEach((t, j) => s.text(t, xs[j]!, y0 - 9 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c('orange') }));
    const row = (i: number) => (i === 0 ? 1 : s.ease('again', 0.5, 0.8 + 1.2 * (i - 1)));
    GRID.forEach((r, i) =>
      s.alpha(row(i), () => {
        const y = y0 + i * pitch;
        s.text(OUT[i]!, xs[0]! - 10 * s.u, y, { size: 3.2, font: 'mono', weight: 600, align: 'right', color: s.c('gold') });
        r.forEach((v, j) => {
          const x = xs[j]! - 7.5 * s.u;
          s.rrect(x, y - 4.5 * s.u, 15 * s.u, 9 * s.u, 1.2, { fill: s.tint('teal', 0.08 + 0.75 * v), stroke: s.tint('teal', 0.5), lw: 0.3 });
          s.text(v.toFixed(2), xs[j]!, y + 0.2 * s.u, { size: 3, font: 'mono', weight: 600, color: s.c(v > 0.5 ? '--card' : '--ink-2') });
        });
      }),
    );
    s.alpha(s.ease('grid', 0.6, 1), () => s.text('each row: one output word, adding up to 1', s.w / 2, s.h * 0.74, { size: 3.2, color: s.c('--ink-2') }));
    s.alpha(s.ease('free', 0.6), () => s.text('every step reads every input state', s.w / 2, s.h * 0.84, { size: 3.4, weight: 600, color: s.c('teal') }));
  },
};

export const scenes: Record<string, SceneDef> = { look, mix, every };

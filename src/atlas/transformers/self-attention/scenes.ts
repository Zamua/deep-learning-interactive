import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { after, cite, columns } from '../../draw';
import { rich } from '../../linear-algebra/draw';
import { heat, mini } from '../draw';

const WORDS = ['cats', 'like', 'fish'];
/** The weights: row i is how token i splits its attention. Rows add up to 1; columns do not. */
const A = [
  [0.6, 0.2, 0.2],
  [0.3, 0.4, 0.3],
  [0.5, 0.25, 0.25],
];
const V = [
  [2, 0],
  [0, 4],
  [4, 4],
];
const OUT = A.map((r) => [0, 1].map((c) => r.reduce((a, w, j) => a + w * V[j]![c]!, 0)));
const COLS = [0, 1, 2].map((j) => A.reduce((a, r) => a + r[j]!, 0));
const g = (v: number) => String(Math.round(v * 100) / 100);
const blank = (m: number, n: number): string[][] => Array.from({ length: m }, () => Array.from({ length: n }, () => ''));

/** A row of word boxes centered on `xs`. */
function sentence(s: Scene, xs: number[], y: number, words: string[], k: Ink, on: number[] = [], w = 17) {
  xs.forEach((x, i) => s.cell(x - (w * s.u) / 2, y - 4 * s.u, w * s.u, 8 * s.u, words[i]!, k, { on: on[i] ?? 0, size: 3.3 }));
}

// ---- every token asks: the same sentence twice, askers above and answerers below

const ask: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 3, s.tall ? 28 : 32);
    const yTop = s.h * 0.3;
    const yBot = s.h * 0.66;
    const contrast = after(s, 'self', 0.16) * (1 - after(s, 'self', 0.6));
    const par = s.ease('parallel', 0.6, 0.3);
    const main = (1 - contrast) * (1 - par);
    // Fish asks first; cats and like join on the next beat.
    const fan = [after(s, 'all', 0.35), after(s, 'all', 0.5), s.ease('one', 0.8, 0.8)];
    s.alpha(main, () => {
      A.forEach((row, i) => s.alpha(fan[i]!, () => row.forEach((w, j) => s.line(xs[i]!, yTop + 4 * u, xs[j]!, yBot - 4 * u, s.tint('teal', 0.35 + 0.6 * w), 0.25 + 2.4 * w))));
      s.alpha(fan[2]! * (1 - s.ease('all', 0.5, 0.8)), () => A[2]!.forEach((w, j) => {
        // Above and left of a slanted line, right of the vertical one, so no label sits on its line.
        const f = j === 2 ? 0.55 : 0.72;
        const [dx, dy] = j === 2 ? [3 * u, 0] : [-2.5 * u, -2.5 * u];
        s.text(g(w), lerp(xs[2]!, xs[j]!, f) + dx, lerp(yTop, yBot, f) + dy, { size: 3.1, font: 'mono', weight: 650, align: j === 2 ? 'left' : 'right', color: s.c('teal'), halo: true });
      }));
      const asking = [fan[0]!, fan[1]!, 1];
      sentence(s, xs, yTop, WORDS, 'teal', asking);
      sentence(s, xs, yBot, WORDS, 'purple');
      const lab = { size: 3.2, font: 'mono' as const, weight: 600, halo: true };
      s.text('asking: queries', s.w / 2, yTop - 8.5 * u, { ...lab, color: s.c('teal') });
      s.text('answering: keys, values', s.w / 2, yBot + 8.5 * u, { ...lab, color: s.c('purple') });
    });
    // The contrast: a decoder word asking a different sentence.
    s.alpha(contrast * (1 - par), () => {
      const dx = columns(s, 4, s.tall ? 22 : 25);
      const DEC = ['I', 'am', 'a', 'student'];
      [1, 0.4, 0.3].forEach((w, j) => s.line(dx[1]!, yTop + 4 * u, xs[j]!, yBot - 4 * u, s.tint('teal', 0.35 + 0.6 * w), 0.25 + 2.4 * w * 0.6));
      sentence(s, dx, yTop, DEC, 'slate', [0, 1, 0, 0], 15);
      sentence(s, xs, yBot, ['je', 'suis', 'étudiant'], 'slate');
      const lab = { size: 3.2, font: 'mono' as const, weight: 600, halo: true, color: s.c('--ink-2') };
      s.text('decoder asks', s.w / 2, yTop - 8.5 * u, lab);
      s.text('encoder answers', s.w / 2, yBot + 8.5 * u, lab);
    });
    const cy = s.h * 0.88;
    const cap = { size: 3.4, font: 'mono' as const, halo: true, color: s.c('--ink-2') };
    s.alpha(s.win('one', 'all'), () => s.text('fish asks every token, itself included', s.w / 2, cy, cap));
    s.alpha(s.win('all', 'self') * after(s, 'all', 0.5), () => s.text('T = 3: every token asks all 3', s.w / 2, cy, cap));
    s.alpha(contrast * (1 - par), () => s.text('two sequences', s.w / 2, cy, cap));
    s.alpha(after(s, 'self', 0.62) * (1 - s.ease('paper', 0.5)), () => s.text('one sequence, attending to itself', s.w / 2, cy, { ...cap, color: s.c('teal') }));
    s.alpha(s.win('paper', 'parallel'), () => {
      const q = { size: 3.4, italic: true, halo: true, color: s.c('--ink-2') };
      s.text('“attention relating different positions', s.w / 2, cy - 2.6 * u, q);
      s.text('of a single sequence”', s.w / 2, cy + 2.6 * u, q);
    });
    cite(s, 'Vaswani et al., 2017 · Attention Is All You Need', s.ease('paper', 0.6));
    // One step at a time, against all at once.
    s.alpha(par, () => {
      const y1 = s.h * 0.36;
      const y2 = s.h * 0.72;
      const lab = { size: 3.3, font: 'mono' as const, weight: 600, halo: true };
      s.text('recurrent: one step at a time', s.w / 2, y1 - 9 * u, { ...lab, color: s.c('--ink-2') });
      const step = [0, 1, 2].map((k) => after(s, 'parallel', 0.3 + 0.13 * k, 0.3));
      for (let k = 0; k < 2; k++) s.arrow(xs[k]! + 9 * u, y1, xs[k + 1]! - 9 * u, y1, s.c('--ink-3'), 0.35, 2);
      sentence(s, xs, y1, WORDS, 'slate', step);
      s.text('self-attention: all at once', s.w / 2, y2 - 9 * u, { ...lab, color: s.c('teal') });
      const all = after(s, 'parallel', 0.72, 0.3);
      sentence(s, xs, y2, WORDS, 'teal', [all, all, all]);
    });
  },
};

// ---- stack the tokens: X, then Q, K and V, then every score at once

const stack: SceneDef = {
  draw(s) {
    const cx = s.w / 2;
    const u = s.u;
    const p = 5.5;
    const y = s.h * 0.2;
    const same = s.win('same', 'scores');
    const rowOn = (i: number) => (i === 2 ? same : 0);
    const X = mini(s, cx - 26 * u, y, blank(3, 4), 'orange', { pitch: p, vpitch: p, w: 4.8, h: 4.8, on: (i) => rowOn(i) });
    WORDS.forEach((w, i) => s.text(w, X.l - 2 * u, y + (i - 1) * p * u, { size: 3, font: 'mono', weight: 600, align: 'right', color: s.c(i === 2 && same > 0.5 ? 'orange' : '--ink-2') }));
    s.text('X', cx - 26 * u, X.t - 3 * u, { size: 3.6, font: 'mono', weight: 650, color: s.c('orange') });
    s.text('(T, d)', cx - 26 * u, X.b + 3.4 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
    const mats: [string, number, 'teal' | 'purple' | 'gold', string, string][] = [
      ['Q', 4, 'teal', '(T, dₖ)', 'Q'],
      ['K', 19, 'purple', '(T, dₖ)', 'K'],
      ['V', 34, 'gold', '(T, dᵥ)', 'V'],
    ];
    s.alpha(s.ease('Q', 0.6), () => s.arrow(X.r + 1.5 * u, y, cx - 4 * u, y, s.c('--ink-3'), 0.35, 2));
    mats.forEach(([name, dx, k, shape, beat]) => {
      s.alpha(s.ease(beat, 0.5, 0.4), () => {
        const b = mini(s, cx + dx * u, y, blank(3, 2), k, { pitch: p, vpitch: p, w: 4.8, h: 4.8, on: (i) => rowOn(i) });
        s.text(name, cx + dx * u, b.t - 3 * u, { size: 3.6, font: 'mono', weight: 650, color: s.c(k) });
        const hi = name === 'V' ? same : 0;
        s.text(shape, cx + dx * u, b.b + 3.4 * u, { size: 2.8, font: 'mono', weight: 500 + 200 * hi, color: s.c(hi > 0.5 ? 'gold' : '--ink-3') });
      });
    });
    s.alpha(same, () => s.text('row 2 is fish in every one', cx, s.h * 0.48, { size: 3.3, font: 'mono', color: s.c('orange'), halo: true }));

    // Q @ K.T in the classic layout: K.T above the result, Q to its left.
    s.alpha(s.ease('scores', 0.6), () => {
      const c = 8;
      const cw = c - 0.8;
      const top = s.h * 0.62;
      const rx = cx - 2 * u;
      const colX = (j: number) => rx + (3.5 + c * j) * u;
      const rowY = (i: number) => top + (3.5 + c * i) * u;
      const ent = s.ease('grid', 0.6, 0.4);
      const e = s.ease('scores', 0.6, 2.5);
      const kt = mini(s, colX(1), top - 3 * u - c * u, blank(2, 3), 'purple', { pitch: c, vpitch: c, w: cw, h: cw, on: (_, j) => (j === 0 ? ent : 0) });
      const q = mini(s, rx - 4 * u - c * u, rowY(1), blank(3, 2), 'teal', { pitch: c, vpitch: c, w: cw, h: cw, on: (i) => (i === 2 ? ent : 0) });
      const wo = { size: 2.6, font: 'mono' as const, weight: 600 };
      WORDS.forEach((w, i) => s.text(w, q.l - 1.8 * u, rowY(i), { ...wo, align: 'right', color: s.c(i === 2 && ent > 0.5 ? 'teal' : '--ink-2') }));
      WORDS.forEach((w, j) => s.text(w, colX(j), kt.t - 2.6 * u, { ...wo, color: s.c(j === 0 && ent > 0.5 ? 'purple' : '--ink-2') }));
      s.text('Kᵀ', kt.r + 2 * u, kt.t + 3 * u, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c('purple') });
      s.text('(dₖ, T)', kt.r + 2 * u, kt.b - 2.5 * u, { size: 2.8, font: 'mono', align: 'left', color: s.c('--ink-3') });
      s.text('Q', q.l + (q.r - q.l) / 2, q.t - 2.6 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('teal') });
      s.text('(T, dₖ)', q.l + (q.r - q.l) / 2, q.b + 2.8 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
      s.alpha(e, () => {
        heat(s, colX(0), rowY(0), 3, c, (i, j) => A[i]![j]!, 'slate');
        s.alpha(ent, () => {
          s.rrect(colX(0) - (c / 2) * u, rowY(2) - (c / 2) * u, 3 * c * u, c * u, 1, { stroke: s.c('teal'), lw: 0.45 });
          s.rrect(colX(0) - (c / 2 - 0.4) * u, rowY(2) - (c / 2 - 0.4) * u, (c - 0.8) * u, (c - 0.8) * u, 0.8, { stroke: s.c('purple'), lw: 0.55 });
        });
        s.text('(T, T)', colX(3) - 1 * u, rowY(0), { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c('slate') });
        s.alpha(s.ease('scale', 0.6), () => s.text('÷ √dₖ', colX(3) - 1 * u, rowY(1) + 1 * u, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('slate') }));
      });
      const cy = s.h * 0.95;
      s.alpha(s.win('scores', 'grid'), () => rich(s, [['(T, dₖ) × (dₖ, T) = ', '--ink-2'], ['(T, T)', 'slate']], cx, cy, { size: 3.2 }));
      s.alpha(s.win('grid', 'scale'), () => rich(s, [['row 2, column 0: ', '--ink-3'], ['fish', 'teal'], ["'s query · ", '--ink-2'], ['cats', 'purple'], ["' key", '--ink-2']], cx, cy, { size: 3.2 }));
      s.alpha(s.ease('scale', 0.6), () => rich(s, [['scores: ', '--ink-3'], ['QKᵀ / √dₖ', '--ink-2'], [', one per pair', '--ink-3']], cx, cy, { size: 3.2 }));
    });
  },
};

// ---- the weights times the values

const mix: SceneDef = {
  marks: {
    f: { tex: String.raw`\text{out} = \mathrm{softmax}\!\left(\frac{\sym{Q}{Q}\,\sym{K}{K}^{\top}}{\sqrt{\sym{dk}{d_k}}}\right)\sym{V}{V}`, x: 0.5, y: 0.86, size: 5 },
  },
  draw(s) {
    const cx = s.w / 2;
    const u = s.u;
    const c = 9;
    const y0 = s.h * 0.22;
    const ax = cx - 29.5 * u;
    const fish = Math.max(s.win('fish', 'cols'), s.ease('row', 0.6));
    const cols = s.win('cols', 'out');
    const row = s.ease('row', 0.6);
    WORDS.forEach((w, i) => s.text(w, ax - 6 * u, y0 + i * c * u, { size: 3.2, font: 'mono', weight: 600, align: 'right', color: s.c(i === 2 && fish > 0.5 ? 'teal' : '--ink-2') }));
    s.text('A', ax + c * u, y0 - 8.5 * u, { size: 3.8, font: 'mono', weight: 650, color: s.c('green') });
    heat(s, ax, y0, 3, c, (i, j) => A[i]![j]!, 'green', { text: (i, j) => g(A[i]![j]!), size: 2.8, alpha: (i, j) => (i === 2 ? 1 : 1 - 0.6 * fish) * (j === 0 ? 1 : 1 - 0.6 * cols) });
    // Each row adds up to 1, beside the rows; the columns' totals, under them.
    s.alpha(s.ease('softmax', 0.6, 1.5) * (1 - s.ease('out', 0.5)), () => {
      const x = ax + (2 * c + 7.5) * u;
      s.text('Σ', x, y0 - 8.5 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('green') });
      [0, 1, 2].forEach((i) => s.text('1', x, y0 + i * c * u, { size: 3.2, font: 'mono', weight: 650, color: s.c('green') }));
    });
    s.alpha(cols, () => COLS.forEach((v, j) => s.text(g(v), ax + j * c * u, y0 + (2 * c + 7) * u, { size: 3.1, font: 'mono', weight: 650, color: s.c(j === 0 ? 'green' : '--ink-3') })));
    const cap = { size: 3.3, font: 'mono' as const, color: s.c('--ink-2'), halo: true };
    s.alpha(s.ease('softmax', 0.6, 1.5) * (1 - s.ease('cols', 0.5)), () => s.text('each row adds up to 1', cx, s.h * 0.66, cap));
    s.alpha(cols, () => s.text('column 0: the attention cats gets', cx, s.h * 0.66, cap));
    const out = s.ease('out', 0.6);
    s.alpha(out, () => {
      s.text('@', cx - 2.5 * u, y0 + c * u, { size: 4, font: 'mono', color: s.c('--ink-3') });
      const vb = mini(s, cx + 9.5 * u, y0 + c * u, V.map((r) => r.map(String)), 'gold', { pitch: c, vpitch: c, w: 8, h: 8, on: (i) => row * [1, 0.5, 0.5][i]! });
      s.text('V', cx + 9.5 * u, vb.t - 4.5 * u, { size: 3.8, font: 'mono', weight: 650, color: s.c('gold') });
      s.text('=', cx + 22 * u, y0 + c * u, { size: 4, font: 'mono', color: s.c('--ink-3') });
      s.alpha(s.ease('out', 0.6, 1.5), () => {
        const ob = mini(s, cx + 34.5 * u, y0 + c * u, OUT.map((r) => r.map(g)), 'teal', { pitch: c, vpitch: c, w: 8, h: 8, on: (i) => (i === 2 ? row : 0) });
        s.text('out', cx + 34.5 * u, ob.t - 4.5 * u, { size: 3.8, font: 'mono', weight: 650, color: s.c('teal') });
      });
      const sy = y0 + 3 * c * u;
      const sh = { size: 2.8, font: 'mono' as const, color: s.c('--ink-3') };
      s.text('(T, T)', ax + c * u, sy, sh);
      s.text('(T, dᵥ)', cx + 9.5 * u, sy, sh);
      s.text('(T, dᵥ)', cx + 34.5 * u, sy, sh);
    });
    s.alpha(row, () => rich(s, [['0.5·[2, 0] + 0.25·[0, 4] + 0.25·[4, 4] = ', '--ink-2'], ['[2, 2]', 'teal']], cx, s.h * 0.66, { size: 3.1 }));
    s.show('f', s.ease('formula', 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { ask, stack, mix };

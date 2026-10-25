import type { Scene, SceneDef } from '../../../lecture/scene';
import { heat, mini, rich } from '../draw';

const WORDS = ['cats', 'like', 'fish'];
const blank = (m: number, n: number): string[][] => Array.from({ length: m }, () => Array.from({ length: n }, () => ''));

/** Words beside the rows of a small grid, right-aligned at x. */
function words(s: Scene, x: number, y0: number, pitch: number, lit: number[] = [], size = 3): void {
  WORDS.forEach((w, i) => s.text(w, x, y0 + i * pitch, { size, font: 'mono', weight: 600, align: 'right', color: s.c(lit[i] ? 'orange' : '--ink-2') }));
}

const stack: SceneDef = {
  draw(s) {
    const cx = s.w / 2;
    const u = s.u;
    const p = 5.5;
    const y = s.h * 0.2;
    const fish = s.win('qkv', 'scores');
    const rowOn = (i: number) => (i === 2 ? fish : 0);
    const X = mini(s, cx - 26 * u, y, blank(3, 4), 'orange', { pitch: p, vpitch: p, w: 4.8, h: 4.8, on: (i) => rowOn(i) });
    words(s, X.l - 2 * u, y - p * u, p * u, [0, 0, fish > 0.5 ? 1 : 0]);
    s.text('X', cx - 26 * u, X.t - 3 * u, { size: 3.6, font: 'mono', weight: 650, color: s.c('orange') });
    s.text('(T, d)', cx - 26 * u, X.b + 3.4 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
    const mats: [string, number, 'teal' | 'purple' | 'gold', string][] = [
      ['Q', 4, 'teal', '(T, dₖ)'],
      ['K', 19, 'purple', '(T, dₖ)'],
      ['V', 34, 'gold', '(T, dᵥ)'],
    ];
    s.alpha(s.ease('qkv', 0.6), () => {
      s.arrow(X.r + 1.5 * u, y, cx - 4 * u, y, s.c('--ink-3'), 0.35, 2);
      mats.forEach(([name, dx, k, shape], m) => {
        s.alpha(s.ease('qkv', 0.5, 0.6 + 0.9 * m), () => {
          const b = mini(s, cx + dx * u, y, blank(3, 2), k, { pitch: p, vpitch: p, w: 4.8, h: 4.8, on: (i) => rowOn(i) });
          s.text(name, cx + dx * u, b.t - 3 * u, { size: 3.6, font: 'mono', weight: 650, color: s.c(k) });
          s.text(shape, cx + dx * u, b.b + 3.4 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
        });
      });
    });

    // Q @ K.T in the classic layout: K.T above the result, Q to its left.
    s.alpha(s.ease('scores', 0.6), () => {
      const c = 7;
      const top = s.h * 0.66;
      const rx = cx - 2 * u;
      const colX = (j: number) => rx + (3.5 + c * j) * u;
      const rowY = (i: number) => top + (3.5 + c * i) * u;
      const ent = s.ease('entry', 0.6);
      const e = s.ease('scores', 0.6, 2.5);
      const kt = mini(s, colX(1), top - 3 * u - c * u, blank(2, 3), 'purple', { pitch: c, vpitch: c, w: 6.2, h: 6.2, on: (_, j) => (j === 0 ? ent : 0) });
      const q = mini(s, rx - 4 * u - c * u, rowY(1), blank(3, 2), 'teal', { pitch: c, vpitch: c, w: 6.2, h: 6.2, on: (i) => (i === 2 ? ent : 0) });
      s.text('Kᵀ', kt.r + 2 * u, kt.t + 3 * u, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c('purple') });
      s.text('(dₖ, T)', kt.r + 2 * u, kt.b - 2.5 * u, { size: 2.8, font: 'mono', align: 'left', color: s.c('--ink-3') });
      s.text('Q', q.l - 2 * u, q.t + 2.5 * u, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('teal') });
      s.text('(T, dₖ)', q.l - 2 * u, q.b - 2.5 * u, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
      s.alpha(e, () => {
        mini(s, colX(1), rowY(1), blank(3, 3), 'slate', { pitch: c, vpitch: c, w: 6.2, h: 6.2, on: (i, j) => (i === 2 && j === 0 ? ent : 0) });
        s.text('(T, T)', colX(3) + 1 * u, rowY(1), { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c('slate') });
      });
      s.alpha(ent, () => rich(s, [['row 2, column 0: ', '--ink-3'], ['fish', 'teal'], ["'s query · ", '--ink-2'], ['cats', 'purple'], ["' key", '--ink-2']], cx, s.h * 0.95, { size: 3.2 }));
    });
  },
};

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
const g = (v: number) => String(Math.round(v * 100) / 100);

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
    const fish = s.win('fish', undefined);
    const row = s.ease('row', 0.6);
    words(s, ax - 6 * u, y0, c * u, [0, 0, fish > 0.5 ? 1 : 0], 3.2);
    s.text('A', ax + c * u, y0 - 8.5 * u, { size: 3.8, font: 'mono', weight: 650, color: s.c('green') });
    heat(s, ax, y0, 3, c, (i, j) => A[i]![j]!, 'green', { text: (i, j) => g(A[i]![j]!), size: 2.8, alpha: (i) => (i === 2 ? 1 : 1 - 0.6 * fish) });
    s.alpha(s.ease('softmax', 0.6, 1.5) * (1 - s.ease('out', 0.6)), () => s.text('each row adds up to 1', ax + c * u, y0 + 3 * c * u, { size: 3.2, color: s.c('--ink-2') }));
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
    s.alpha(row, () => {
      rich(s, [['0.5·[2, 0] + 0.25·[0, 4] + 0.25·[4, 4] = ', '--ink-2'], ['[2, 2]', 'teal']], cx, s.h * 0.66, { size: 3.1 });
    });
    s.show('f', s.ease('formula', 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { stack, mix };

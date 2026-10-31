import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01, lerp, smooth } from '../../../lecture/scene';
import { Rng } from '../../../core/rand';
import type { Ink } from '../../../lecture/scene';
import { after, cite, rowLabel } from '../../draw';
import { caption } from '../../networks/draw';
import { band, brace, ghost, grid, matrix, rich } from '../draw';

const W = [[1, 4, 2], [0, 3, 5]];
const ROW = 'teal';
const COL = 'gold';
const RGB = ['red', 'green', 'blue'] as const;

const shapeRuns = (m: number, n: number | string): [string, Ink][] => [['(', '--ink-2'], [String(m), ROW], [', ', '--ink-2'], [String(n), COL], [')', '--ink-2']];

// ---- many photos: each flattened into a row of 48, the rows stacked into a grid

/** Ten tiny 4 by 4 color photos, each a sky-to-ground gradient with its own tint. */
const PHOTOS: number[][][] = (() => {
  const rng = new Rng(7);
  return Array.from({ length: 10 }, (_, n) => {
    const tint = [rng.uniform(-40, 40), rng.uniform(-40, 40), rng.uniform(-40, 40)];
    return Array.from({ length: 16 }, (_, k) => {
      const i = Math.floor(k / 4);
      const j = k % 4;
      const base = n === 0 ? [40 + 60 * i + 6 * j, 110 + 25 * j - 10 * i, 230 - 60 * i] : [60 + 50 * i + 8 * j, 120 + 18 * j - 12 * i, 220 - 55 * i];
      return base.map((v, c) => Math.round(Math.max(10, Math.min(245, v + (n === 0 ? 0 : tint[c]!) + rng.uniform(-12, 12)))));
    });
  });
})();
const rgb = (p: number[]) => `rgb(${p[0]}, ${p[1]}, ${p[2]})`;

/** Where the thumbnails and the stacked grid sit. */
function stackLayout(s: Scene, rows: number) {
  const u = s.u;
  const cw = Math.min(2.3 * u, (s.w - 46 * u) / 48);
  const gl = s.w / 2 - 24 * cw;
  const gt = 37 * u;
  const gh = 22 * u;
  const rh = gh / rows;
  const P = 3.4 * u;
  const tx = (n: number) => s.w / 2 + (n - 1.5) * 20 * u - 2 * P;
  return { cw, gl, gt, gh, rh, P, tx, ty: 13 * u, gr: gl + 48 * cw, gb: gt + gh };
}
type SL = ReturnType<typeof stackLayout>;

/** One photo's strip of 48 cells, each shaded by how much of its color it holds. */
function strip(s: Scene, L: SL, n: number, y: number, h: number, on = 0) {
  PHOTOS[n]!.forEach((p, k) => p.forEach((v, c) => {
    const x = L.gl + (3 * k + c) * L.cw;
    s.rrect(x + 0.08 * s.u, y + 0.08 * s.u, L.cw - 0.16 * s.u, h - 0.16 * s.u, 0.2, { fill: s.tint(RGB[c]!, 0.15 + 0.7 * (v / 255) + 0.15 * on) });
  }));
}

/** A thumbnail whose pixels fly down into row `row` of the grid as `g` goes 0 to 1; `keep` fades the thumbnail left behind. */
function flatten(s: Scene, L: SL, n: number, row: number, g: number, a: number, keep: number) {
  const u = s.u;
  const x0 = L.tx(n);
  const y0 = L.ty;
  const y1 = L.gt + row * L.rh;
  const split = clamp01((g - 0.75) / 0.25);
  s.alpha(a, () => {
    // The thumbnail stays behind, faint, as its numbers leave it.
    s.alpha(keep * (0.35 + 0.65 * (1 - smooth(g * 3))), () => PHOTOS[n]!.forEach((p, k) => s.rrect(x0 + (k % 4) * L.P + 0.1 * u, y0 + Math.floor(k / 4) * L.P + 0.1 * u, L.P - 0.2 * u, L.P - 0.2 * u, 0.3, { fill: rgb(p) })));
    if (g <= 0) return;
    s.alpha(1 - split, () => PHOTOS[n]!.forEach((p, k) => {
      const gk = smooth(clamp01(g * 1.4 - (k / 15) * 0.4));
      const x = lerp(x0 + (k % 4) * L.P, L.gl + 3 * k * L.cw, gk);
      const y = lerp(y0 + Math.floor(k / 4) * L.P, y1, gk);
      const w = lerp(L.P, 3 * L.cw, gk);
      const h = lerp(L.P, L.rh, gk);
      s.rrect(x + 0.1 * u, y + 0.1 * u, w - 0.2 * u, h - 0.2 * u, 0.3, { fill: rgb(p) });
    }));
    s.alpha(split, () => strip(s, L, n, y1, L.rh));
  });
}

const stack: SceneDef = {
  draw(s) {
    const u = s.u;
    const big = s.ease('big', 0.9);
    const L = stackLayout(s, 4);
    const thumbs = 1 - s.ease('matrix', 0.8);
    // Four photos, flattened one by one into the rows of a grid.
    s.alpha(1 - big, () => {
      flatten(s, L, 0, 0, after(s, 'one', 0.3, 2.6), 1, thumbs);
      for (let n = 1; n < 4; n++) flatten(s, L, n, n, s.ease('many', 2, 1.4 + 0.5 * n), s.ease('many', 0.6, 0.3 + 0.5 * n), thumbs);
    });
    // Ten photos once the stack grows.
    s.alpha(big, () => {
      const B = stackLayout(s, 10);
      for (let n = 0; n < 10; n++) strip(s, B, n, B.gt + n * B.rh, B.rh);
    });
    // A row is one photo; a column is one number from every photo.
    const rowA = s.win('line', 'matrix') * (1 - after(s, 'line', 0.45));
    const colA = after(s, 'line', 0.45) * (1 - s.ease('matrix', 0.6));
    s.alpha(rowA, () => {
      s.rrect(L.gl - 0.8 * u, L.gt + 2 * L.rh, L.gr - L.gl + 1.6 * u, L.rh, 1, { stroke: s.c(ROW), lw: 0.5 });
      s.rrect(L.tx(2) - 0.6 * u, L.ty - 0.6 * u, 4 * L.P + 1.2 * u, 4 * L.P + 1.2 * u, 1, { stroke: s.c(ROW), lw: 0.5 });
    });
    s.alpha(colA, () => {
      s.rrect(L.gl - 0.4 * u, L.gt - 0.8 * u, L.cw + 0.8 * u, L.gh + 1.6 * u, 0.8, { stroke: s.c(COL), lw: 0.5 });
      for (let n = 0; n < 4; n++) s.rrect(L.tx(n) - 0.3 * u, L.ty - 0.3 * u, L.P + 0.6 * u, L.P + 0.6 * u, 0.6, { stroke: s.c(COL), lw: 0.45 });
    });
    // A smaller grid picked out: two rows and two columns, and the four entries where they cross.
    const pick = s.win('name', 'W');
    const PR = [0, 2];
    const PC = [9, 30];
    s.alpha(pick * after(s, 'name', 0.45), () => {
      for (const r of PR) s.rrect(L.gl - 0.6 * u, L.gt + r * L.rh + 0.15 * u, L.gr - L.gl + 1.2 * u, L.rh - 0.3 * u, 0.8, { stroke: s.tint('purple', 0.6), lw: 0.3 });
      for (const c of PC) s.rrect(L.gl + c * L.cw, L.gt - 0.6 * u, L.cw, L.gh + 1.2 * u, 0.6, { stroke: s.tint('purple', 0.6), lw: 0.3 });
      for (const r of PR) for (const c of PC) s.rrect(L.gl + c * L.cw - 0.3 * u, L.gt + r * L.rh - 0.3 * u, L.cw + 0.6 * u, L.rh + 0.6 * u, 0.5, { stroke: s.c('purple'), lw: 0.6 });
      // The four crossings, drawn out below as a small grid of their own.
      const S = 6 * u;
      const x0 = s.w / 2 - S;
      const y0 = L.gb + 6 * u;
      PR.forEach((r, i) => PC.forEach((c, j) => {
        const ch = c % 3;
        const v = PHOTOS[r]![Math.floor(c / 3)]![ch]!;
        s.rrect(x0 + j * S + 0.3 * u, y0 + i * S + 0.3 * u, S - 0.6 * u, S - 0.6 * u, 0.6, { fill: s.tint(RGB[ch]!, 0.15 + 0.7 * (v / 255)), stroke: s.c('purple'), lw: 0.4 });
      }));
    });
    // Its name, its size, and the bigger stack.
    const G = big > 0.5 ? stackLayout(s, 10) : L;
    s.alpha(s.ease('W', 0.6), () => rowLabel(s, 'W', G.gl - 2.5 * u, G.gt + G.gh / 2, 'blue', 4.6));
    const sh = s.ease('shape', 0.6);
    s.alpha(sh * (1 - big), () => {
      brace(s, 'right', L.gt, L.gb, L.gr + 2.5 * u, '4 rows', ROW, 3.2);
      brace(s, 'top', L.gl, L.gr, L.gt - 2.5 * u, '48 columns', COL, 3.2);
    });
    s.alpha(big, () => {
      const B = stackLayout(s, 10);
      brace(s, 'right', B.gt, B.gb, B.gr + 2.5 * u, '10 rows', ROW, 3.2);
      brace(s, 'top', B.gl, B.gr, B.gt - 2.5 * u, '3,072 columns', COL, 3.2);
    });
    const sy = L.gb + 11 * u;
    s.alpha(sh * (1 - big), () => rich(s, [['W.shape = ', '--ink-2'], ...shapeRuns(4, 48)], s.w / 2, sy, { size: 4.4, weight: 650 }));
    s.alpha(big, () => rich(s, [['W.shape = ', '--ink-2'], ...shapeRuns(10, 3072)], s.w / 2, sy, { size: 4.4, weight: 650 }));
    cite(s, 'Sylvester, 1850', s.win('name', 'W'));
    const cy = s.h * 0.88;
    s.alpha(s.win('one', 'many'), () => caption(s, 'flatten: 4 × 4 pixels × 3 colors = 48', cy, '--ink-2', 3.4));
    s.alpha(s.win('many', 'line'), () => caption(s, 'one flattened photo per row', cy, '--ink-2', 3.4));
    s.alpha(rowA, () => caption(s, 'across a row: one photo', cy, ROW, 3.6));
    s.alpha(colA, () => caption(s, 'down a column: every top-left red', cy, COL, 3.6));
    s.alpha(s.win('matrix', 'name'), () => caption(s, 'a matrix: numbers in rows and columns', cy, '--ink-2', 3.4));
    s.alpha(pick, () => caption(s, 'matrix: Latin for womb, a source', cy, 'purple', 3.4));
    s.alpha(s.win('W', 'shape'), () => caption(s, 'capital letters for matrices', cy, 'blue', 3.4));
    s.alpha(s.win('shape', 'big') * after(s, 'shape', 0.5), () => caption(s, 'rows first, then columns', cy, '--ink-2', 3.6));
    s.alpha(big, () => caption(s, '10 photos × 3,072 numbers each', cy, '--ink-2', 3.4));
  },
};

// ---- a small matrix: count its rows and columns, and multiply

const gridScene: SceneDef = {
  draw(s) {
    const g = grid(s, s.w / 2, s.h * 0.3, 2, 3, 16, 12);
    rowLabel(s, 'W', g.l - 5 * s.u, (g.t + g.b) / 2, 'blue', 4.6);
    const r = s.win('rows', 'cols');
    const c = s.win('cols', 'shape');
    [0, 1].forEach((i) => band(s, g, 'row', i, ROW, r));
    [0, 1, 2].forEach((j) => band(s, g, 'col', j, COL, c));
    // Counting the six, row by row.
    const lit = (i: number, j: number) => after(s, 'size', 0.25 + (i * 3 + j) * 0.07, 0.3) * (1 - s.ease('back', 0.5));
    const back = s.win('back');
    [0, 1].forEach((i) => band(s, g, 'row', i, ROW, back * after(s, 'back', 0.2 + 0.25 * i)));
    matrix(s, g, W, 'blue', { on: lit });
    s.alpha(s.ease('rows', 0.6, 1), () => brace(s, 'right', g.t, g.b, g.r + 3 * s.u, '2 rows', ROW));
    s.alpha(s.ease('cols', 0.6), () => brace(s, 'top', g.l, g.r, g.t - 3 * s.u, '3 columns', COL));
    s.alpha(s.ease('shape', 0.6), () => rich(s, [['W.shape = ', '--ink-2'], ...shapeRuns(2, 3)], s.w / 2, s.h * 0.56, { size: 4.6, weight: 650 }));
    s.alpha(s.ease('size', 0.6), () => s.text('2 × 3 = 6 numbers', s.w / 2, s.h * 0.68, { size: 3.8, font: 'mono', color: s.c('--ink-2') }));
    s.alpha(after(s, 'size', 0.7), () => s.text('rows × columns, not rows + columns', s.w / 2, s.h * 0.77, { size: 3.3, font: 'mono', color: s.c('--ink-3') }));
    s.alpha(s.ease('back', 0.6), () => s.text('6 numbers ÷ 2 rows = 3 columns', s.w / 2, s.h * 0.88, { size: 3.6, font: 'mono', weight: 600, color: s.c(COL) }));
  },
};

// ---- an entry by its row and its column, both from zero

const index: SceneDef = {
  draw(s) {
    const g = grid(s, s.w / 2 + 3 * s.u, s.h * 0.27, 2, 3, 16, 12);
    rowLabel(s, 'W', g.l - 10 * s.u, (g.t + g.b) / 2, 'blue', 4.6);
    const e1 = s.win('eg', 'eg2');
    const e2 = s.win('eg2', 'last');
    const e3 = s.win('last', 'out');
    band(s, g, 'row', 0, ROW, e1);
    band(s, g, 'col', 2, COL, e1);
    band(s, g, 'row', 1, ROW, e2);
    band(s, g, 'col', 0, COL, e2);
    band(s, g, 'row', 1, ROW, e3);
    band(s, g, 'col', 2, COL, e3);
    matrix(s, g, W, 'blue', { on: (i, j) => (i === 0 && j === 2 ? e1 : i === 1 && j === 0 ? e2 : i === 1 && j === 2 ? e3 : 0) });
    s.alpha(s.ease('ij', 0.6, 1), () => {
      [0, 1].forEach((i) => s.text(String(i), g.l - 3.5 * s.u, g.y(i), { size: 3.4, font: 'mono', weight: 600, color: s.c(ROW) }));
      [0, 1, 2].forEach((j) => s.text(String(j), g.x(j), g.t - 3.5 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c(COL) }));
    });
    const ty = s.h * 0.58;
    s.alpha(s.win('ij', 'photo'), () => rich(s, [['W[', '--ink-2'], ['row', ROW], [', ', '--ink-2'], ['column', COL], [']', '--ink-2']], s.w / 2, ty, { size: 4.2, weight: 600 }));
    s.alpha(s.win('photo', 'eg'), () => {
      rich(s, [['row: ', ROW], ['which photo', '--ink-2']], s.w / 2, ty, { size: 3.6 });
      rich(s, [['column: ', COL], ['which of its numbers', '--ink-2']], s.w / 2, ty + 7 * s.u, { size: 3.6 });
    });
    const eq = (i: number, j: number, v: number): [string, Ink][] => [['W[', '--ink-2'], [String(i), ROW], [', ', '--ink-2'], [String(j), COL], [`] = ${v}`, '--ink-2']];
    s.alpha(e1, () => rich(s, eq(0, 2, 2), s.w / 2, ty, { size: 4.2, weight: 600 }));
    s.alpha(e2, () => {
      rich(s, eq(1, 0, 0), s.w / 2, ty, { size: 4.2, weight: 600 });
      s.alpha(after(s, 'eg2', 0.55), () => {
        s.rrect(g.x(1) - 7 * s.u, g.y(0) - 5.25 * s.u, 14 * s.u, 10.5 * s.u, 1.6, { stroke: s.c('--ink-3'), lw: 0.4 });
        s.text('W[0, 1] = 4: another entry', s.w / 2, ty + 8 * s.u, { size: 3.4, font: 'mono', color: s.c('--ink-3') });
      });
    });
    s.alpha(e3, () => {
      rich(s, eq(1, 2, 5), s.w / 2, ty, { size: 4.2, weight: 600 });
      s.text('last row: 1,  last column: 2', s.w / 2, ty + 8 * s.u, { size: 3.1, font: 'mono', color: s.c('--ink-3') });
    });
    s.alpha(s.ease('out', 0.6), () => {
      const y = g.y(1) + 12 * s.u;
      [0, 1, 2].forEach((j) => ghost(s, g.x(j), y, j === 0 ? '?' : '', 'red'));
      s.text('2', g.l - 3.5 * s.u, y, { size: 3.4, font: 'mono', weight: 600, color: s.c('red') });
      s.text('W[2, 0]: no row 2  ✗', s.w / 2, ty + 8 * s.u, { size: 3.8, font: 'mono', color: s.c('red') });
    });
  },
};

// ---- the transpose: each entry flies from (i, j) to (j, i)

const transpose: SceneDef = {
  draw(s) {
    const a = grid(s, s.w * 0.3, s.h * 0.36, 2, 3, 14, 11);
    const b = grid(s, s.w * 0.72, s.h * 0.36, 3, 2, 14, 11);
    const kOf = (i: number) => (i === 0 ? ROW : COL);
    const hi = s.ease('ij', 0.6);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) {
      s.cell(a.x(j) - 6 * s.u, a.y(i) - 4.25 * s.u, 12 * s.u, 8.5 * s.u, String(W[i]![j]), kOf(i), { on: i === 1 && j === 2 ? hi : 0 });
    }
    rich(s, [['W ', 'blue'], ...shapeRuns(2, 3)], a.x(1), a.t - 5 * s.u, { size: 3.8, weight: 600 });
    // Each entry flies from (i, j) in W to (j, i) in the transpose, row by row.
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) {
      const t = smooth(clamp01((s.since('flip') - 0.6 - (i * 3 + j) * 0.25) / 0.9));
      if (t <= 0) continue;
      const x = lerp(a.x(j), b.x(i), t);
      const y = lerp(a.y(i), b.y(j), t);
      s.cell(x - 6 * s.u, y - 4.25 * s.u, 12 * s.u, 8.5 * s.u, String(W[i]![j]), kOf(i), { on: i === 1 && j === 2 ? hi : 0 });
    }
    const top = b.t - 5 * s.u;
    s.alpha(s.win('sym', 'shape'), () => rich(s, [['Wᵀ', 'blue'], [' or W.T', '--ink-3']], b.x(0.5), top, { size: 3.8, weight: 600 }));
    s.alpha(s.ease('shape', 0.6), () => rich(s, [['Wᵀ ', 'blue'], ...shapeRuns(3, 2).map(([t, k], i): [string, Ink] => [t, i === 1 ? COL : i === 3 ? ROW : k])], b.x(0.5), top, { size: 3.8, weight: 600 }));
    const cap = { size: 3.2, font: 'mono', italic: true, color: s.c('--ink-3') } as const;
    s.alpha(s.win('cayley', 'sym'), () => {
      s.text('broad', a.x(1), a.b + 5 * s.u, cap);
      s.text('deep', b.x(0.5), b.b + 5 * s.u, cap);
    });
    cite(s, 'Cayley, 1858', s.win('cayley', 'sym'));
    const cy = s.h * 0.8;
    s.alpha(s.win('flip', 'name'), () => caption(s, 'each row stands up as a column', cy, '--ink-2', 3.6));
    s.alpha(s.win('name', 'cayley'), () => caption(s, 'transpose: rows and columns trade places', cy, '--ink-2', 3.4));
    s.alpha(s.win('cayley', 'sym'), () => caption(s, 'a broad matrix into a deep one', cy, '--ink-2', 3.6));
    s.alpha(s.win('sym', 'shape'), () => caption(s, 'the transpose of W: Wᵀ, or W.T', cy, 'blue', 3.6));
    s.alpha(s.win('shape', 'ij'), () => caption(s, '(2, 3) becomes (3, 2)', cy, '--ink-2', 4));
    s.alpha(hi, () => caption(s, 'W[1, 2] = W.T[2, 1] = 5', cy, '--ink-2', 4, { weight: 600 }));
  },
};

export const scenes: Record<string, SceneDef> = { stack, grid: gridScene, index, transpose };

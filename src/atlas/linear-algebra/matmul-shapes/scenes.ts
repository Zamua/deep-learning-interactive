import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01 } from '../../../lecture/scene';
import { type Ink, rich } from '../draw';

const INNER = 'green';
const OUTER = 'gold';

/**
 * A @ B in the classic layout: B above the result, A to its left, so A's rows and B's columns
 * meet in the result. `inner` and `outer` light the dimension labels; `col` is how many result
 * columns are filled, with B's column `col` lit while it is computed.
 */
function classic(s: Scene, m: number, n: number, k: number, o: { p: number; top: number; inner: number; outer: number; col?: number }) {
  const p = o.p * s.u;
  const gap = 4 * s.u;
  const left = s.w / 2 - (n * p + gap + k * p) / 2;
  const top = o.top;
  const A = { x: left, y: top + n * p + gap, w: n * p, h: m * p };
  const B = { x: left + n * p + gap, y: top, w: k * p, h: n * p };
  const C = { x: B.x, y: A.y, w: k * p, h: m * p };
  const col = o.col ?? k;
  const cellsIn = (r: typeof A, rows: number, cols: number, k: Ink, on: (i: number, j: number) => number) => {
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const a = on(i, j);
      s.rrect(r.x + j * p + 0.4 * s.u, r.y + i * p + 0.4 * s.u, p - 0.8 * s.u, p - 0.8 * s.u, 0.8, { fill: s.tint(k, 0.12 + 0.3 * a), stroke: s.tint(k, 0.45 + 0.5 * a), lw: 0.25 });
    }
  };
  const live = o.col !== undefined && col < k ? Math.floor(col) : -1;
  cellsIn(A, m, n, 'blue', () => (live >= 0 ? 0.6 : 0));
  cellsIn(B, n, k, 'orange', (_, j) => (j === live ? 1 : 0));
  cellsIn(C, m, k, 'gold', (_, j) => (j < col ? (j === live ? 1 : 0.5) : -0.4));
  const lab = (t: string, x: number, y: number, k: Ink, a: number, align: CanvasTextAlign = 'center') =>
    s.text(t, x, y, { size: 3.4 + 0.6 * a, font: 'mono', weight: 600 + 100 * a, align, color: a > 0.01 ? s.c(k) : s.c('--ink-3'), halo: true });
  lab(String(m), A.x - 2.5 * s.u, A.y + A.h / 2, OUTER, o.outer, 'right');
  lab(String(n), A.x + A.w / 2, A.y - 3 * s.u, INNER, o.inner);
  lab(String(n), B.x - 2.5 * s.u, B.y + B.h / 2, INNER, o.inner, 'right');
  lab(String(k), B.x + B.w / 2, B.y - 3 * s.u, OUTER, o.outer);
  s.text('A', A.x + A.w / 2, A.y + A.h + 4 * s.u, { size: 3.8, font: 'mono', weight: 650, color: s.c('blue') });
  s.text('B', B.x + B.w + 3 * s.u, B.y + B.h / 2, { size: 3.8, font: 'mono', weight: 650, align: 'left', color: s.c('orange') });
  s.text('AB', C.x + C.w / 2, C.y + C.h + 4 * s.u, { size: 3.8, font: 'mono', weight: 650, color: s.c('gold') });
  return { bottom: A.y + A.h };
}

/** `(m, n) @ (n, k) -> (m, k)` with the inner pair and the result lit. */
function shapes(m: number | string, n: number | string, n2: number | string, k: number | string, inner: Ink, out: string | null): [string, Ink][] {
  const runs: [string, Ink][] = [['(', '--ink-2'], [String(m), '--ink-2'], [', ', '--ink-2'], [String(n), inner], [') @ (', '--ink-2'], [String(n2), inner], [', ', '--ink-2'], [String(k), '--ink-2'], [')', '--ink-2']];
  if (out) runs.push([' → ', '--ink-3'], [out, OUTER]);
  return runs;
}

const columns: SceneDef = {
  marks: {
    rule: { tex: String.raw`(m, n) \times (n, k) \to (m, k)`, x: 0.5, y: 0.9, size: 4.8 },
  },
  draw(s) {
    const inner = s.ease('inner', 0.6) * (1 - 0.6 * s.ease('outer', 0.6));
    const outer = s.ease('outer', 0.6);
    classic(s, 2, 3, 4, { p: 8, top: s.h * 0.12, inner, outer, col: s.since('many') < 0 ? 0 : clamp01((s.t - s.at('many') - 0.8) / Math.max(1, s.end('many') - s.at('many') - 1)) * 4 });
    s.alpha(s.ease('inner', 0.6), () => rich(s, [["A's columns = B's rows: ", '--ink-2'], ['3 = 3', INNER]], s.w / 2, s.h * 0.68, { size: 3.6 }));
    s.alpha(s.ease('outer', 0.6), () => rich(s, shapes(2, 3, 3, 4, INNER, '(2, 4)'), s.w / 2, s.h * 0.78, { size: 3.8, weight: 600 }));
    s.show('rule', s.ease('rule', 0.6));
  },
};

/** A block standing for a matrix: a tinted rectangle with its name inside and its sizes on two sides. */
function block(s: Scene, x: number, y: number, w: number, h: number, k: Ink, name: string, rows: [string, Ink], cols: [string, Ink]) {
  s.rrect(x, y, w, h, 1.2, { fill: s.tint(k, 0.16), stroke: s.tint(k, 0.7), lw: 0.35 });
  s.text(name, x + w / 2, y + h / 2, { size: 4.2, font: 'mono', weight: 650, color: s.c(k) });
  s.text(rows[0], x - 2.2 * s.u, y + h / 2, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c(rows[1]) });
  s.text(cols[0], x + w / 2, y - 3 * s.u, { size: 3.4, font: 'mono', weight: 650, color: s.c(cols[1]) });
}

const order: SceneDef = {
  draw(s) {
    const u = s.u;
    const top = s.h * 0.13;
    const sw = s.win('swap', 'pair');
    s.alpha(sw, () => {
      const q = 6 * u;
      const x0 = s.w / 2 - (4 * q + 16 * u + 3 * q) / 2;
      block(s, x0, top, 4 * q, 3 * q, 'orange', 'B', ['3', '--ink-3'], ['4', 'red']);
      s.text('@', x0 + 4 * q + 6 * u, top + 1.5 * q, { size: 4, font: 'mono', color: s.c('--ink-3') });
      block(s, x0 + 4 * q + 16 * u, top, 3 * q, 2 * q, 'blue', 'A', ['2', 'red'], ['3', '--ink-3']);
      rich(s, shapes(3, 4, 2, 3, 'red', null), s.w / 2, s.h * 0.48, { size: 3.8, weight: 600 });
      s.text('inner 4 ≠ 2: no product  ✗', s.w / 2, s.h * 0.58, { size: 3.6, font: 'mono', color: s.c('red') });
    });
    s.alpha(s.ease('pair', 0.6, 0.3), () => {
      const q = 6 * u;
      const x0 = s.w / 2 - (3 * q + 16 * u + 4 * q) / 2;
      block(s, x0, top, 3 * q, 2 * q, 'blue', 'A', ['2', '--ink-3'], ['3', 'slate']);
      block(s, x0 + 3 * q + 16 * u, top, 4 * q, 2 * q, 'orange', 'M', ['2', 'slate'], ['4', '--ink-3']);
    });
    // Left-aligned so the three products line up.
    const lx = s.w / 2 - 36 * u;
    const line = (a: [string, Ink], b: [string, Ink], runs: [string, Ink][], y: number) =>
      rich(s, [a, [' @ ', '--ink-3'], b, ...runs], lx, y, { size: 3.5, weight: 600, align: 'left' });
    s.alpha(s.ease('pair', 0.6, 1.2), () => {
      line(['A', 'blue'], ['M    ', 'orange'], [['(2, ', '--ink-2'], ['3', 'red'], [') @ (', '--ink-2'], ['2', 'red'], [', 4)  ✗', '--ink-2']], s.h * 0.5);
    });
    s.alpha(s.ease('fix', 0.6, 1.2), () => {
      line(['A.T', 'blue'], ['M  ', 'orange'], [['(3, ', '--ink-2'], ['2', INNER], [') @ (', '--ink-2'], ['2', INNER], [', 4) → ', '--ink-2'], ['(3, 4)', OUTER]], s.h * 0.61);
    });
    s.alpha(s.ease('flip', 0.6), () => {
      line(['M.T', 'orange'], ['A  ', 'blue'], [['(4, ', '--ink-2'], ['2', INNER], [') @ (', '--ink-2'], ['2', INNER], [', 3) → ', '--ink-2'], ['(4, 3)', OUTER]], s.h * 0.72);
    });
  },
};

export const scenes: Record<string, SceneDef> = { columns, order };

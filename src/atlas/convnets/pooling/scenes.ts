import type { Scene, SceneDef } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { after, cite } from '../../draw';
import { grid, type Grid, gridCells, rich, volume, windowBox } from '../draw';

/** A filter's 4 x 4 map, built so that a shift of one pixel right keeps every window's max in its window. */
const X = [
  [1, 0, 2, 1],
  [9, 1, 0, 0],
  [0, 1, 1, 0],
  [3, 0, 4, 1],
];
/** X shifted one pixel right, zeros coming in on the left. */
const X2 = X.map((r) => [0, ...r.slice(0, 3)]);
const WIN: Ink[] = ['blue', 'green', 'purple', 'teal'];
const winOf = (i: number, j: number) => Math.floor(i / 2) * 2 + Math.floor(j / 2);
const cellsOf = (w: number) => [0, 1, 2, 3].map((k) => [2 * Math.floor(w / 2) + Math.floor(k / 2), 2 * (w % 2) + (k % 2)] as const);
const maxOf = (m: number[][]) => [0, 1, 2, 3].map((w) => Math.max(...cellsOf(w).map(([i, j]) => m[i]![j]!)));
const MAX = maxOf(X);
const AVG = [0, 1, 2, 3].map((w) => cellsOf(w).reduce((a, [i, j]) => a + X[i]![j]!, 0) / 4);
const isMax = (i: number, j: number) => X[i]![j]! === MAX[winOf(i, j)];
const CHANGED = X2.flatMap((r, i) => r.map((v, j) => [i, j, v !== X[i]![j]] as const)).filter(([, , c]) => c);

const label = (s: Scene, t: string, x: number, y: number, k: Ink, size = 3.6) => s.text(t, x, y, { size, font: 'mono', weight: 650, color: s.c(k), halo: true });

function caption(s: Scene, text: string, y: number, k: Ink = '--ink-2', a = 1, size = 3.4) {
  s.alpha(a, () => s.text(text, s.w / 2, y, { size, font: 'mono', color: s.c(k), halo: true }));
}

/** Dashed lines between the four 2 x 2 windows of a 4 x 4 grid. */
function split(s: Scene, g: Grid, a: number) {
  s.alpha(a, () => {
    const p = g.pitch * s.u;
    s.line(g.l + 2 * p, g.t + 0.3 * s.u, g.l + 2 * p, g.b - 0.3 * s.u, s.c('--ink-2'), 0.4, [1, 0.8]);
    s.line(g.l + 0.3 * s.u, g.t + 2 * p, g.r - 0.3 * s.u, g.t + 2 * p, s.c('--ink-2'), 0.4, [1, 0.8]);
  });
}

/** The 2 x 2 pooled output, each cell in its window's color; `a(w)` fades cell w in. */
function pooled(s: Scene, o: Grid, vals: number[], a: (w: number) => number, on = 0, size = 4) {
  const cw = (o.pitch - 1) * s.u;
  vals.forEach((v, w) => s.alpha(a(w), () => s.cell(o.x(w % 2) - cw / 2, o.y(Math.floor(w / 2)) - cw / 2, cw, cw, String(v), WIN[w]!, { on, size })));
}

// ---- a small shift: the map moves a pixel, the pooled output stays

const shift: SceneDef = {
  draw(s) {
    const u = s.u;
    const cyG = s.h * 0.42;
    const g = grid(s, s.w / 2 - 18 * u, cyG, 4, 4, 11);
    const o = grid(s, s.w / 2 + 30 * u, cyG, 2, 2, 11);
    const cw = (g.pitch - 1) * u;
    const [cy, cy2] = [s.h * 0.78, s.h * 0.87];

    // How far the map has slid right: out and back during `move`, out again for `same`.
    const sh = s.ease('move', 1.2, 1.2) * (1 - s.ease('pool', 0.9, 0.2)) + s.ease('same', 1.2, 1.6);
    const splitA = s.ease('pool', 0.6, 1.2);
    const maxA = s.ease('pool', 0.6, 2.4);
    label(s, 'a filter\'s map', (g.l + g.r) / 2, g.t - 4 * u, '--ink-2', 3.4);
    split(s, g, splitA);
    X.forEach((row, i) => row.forEach((v, j) => {
      const col = j + sh;
      const ink = splitA > 0.5 && col < 3.5 ? WIN[winOf(i, Math.round(col))]! : 'orange';
      const on = Math.max(i === 1 && j === 0 ? s.win('map', 'move') : 0, isMax(i, j) ? maxA : 0);
      s.alpha(j === 3 ? 1 - sh : 1, () => s.cell(g.x(col) - cw / 2, g.y(i) - cw / 2, cw, cw, String(v), ink, { on, size: 4 }));
    }));
    // Zeros slide in on the left as the map moves right.
    s.alpha(sh, () => X.forEach((_, i) => {
      const ink = splitA > 0.5 ? WIN[winOf(i, 0)]! : 'orange';
      s.cell(g.x(sh - 1) - cw / 2, g.y(i) - cw / 2, cw, cw, '0', ink, { size: 4 });
    }));
    // The numbers that changed, once the first shift lands.
    const ch = s.ease('move', 0.5, 2.6) * (1 - s.ease('pool', 0.4));
    s.alpha(ch, () => CHANGED.forEach(([i, j]) => s.rrect(g.x(j) - cw / 2 - 0.4 * u, g.y(i) - cw / 2 - 0.4 * u, cw + 0.8 * u, cw + 0.8 * u, 1.4, { stroke: s.c('red'), lw: 0.5 })));
    caption(s, 'one strong match: the 9', cy, 'orange', s.win('map', 'move'));
    caption(s, 'shifted one pixel right', cy, '--ink-2', s.ease('move', 0.6, 1.2) * (1 - s.ease('pool', 0.5)));
    caption(s, `${CHANGED.length} of 16 numbers changed`, cy2, 'red', ch);

    // The pooled output, and the check that it survives the shift.
    s.alpha(s.ease('pool', 0.6, 2), () => {
      label(s, 'max pooled', (o.l + o.r) / 2, o.t - 4 * u, '--ink-2', 3.4);
      s.arrow(g.r + 4.5 * u, cyG, o.l - 3 * u, cyG, s.c('--ink-3'), 0.4, 2.2);
    });
    const same = s.ease('same', 0.6, 3.2);
    pooled(s, o, MAX, (w) => s.ease('pool', 0.4, 2.6 + w * 0.5), same);
    caption(s, 'the largest of each 2 × 2 window', cy, '--ink-2', s.win('pool', 'same'));
    caption(s, '✓ the pooled output is unchanged', cy, 'green', same * (1 - s.ease('keeps', 0.5)));
    caption(s, 'keeps how strong a match, not exactly where', cy, '--ink-2', s.win('keeps', 'cells'));
    caption(s, 'each window pooled into one value', cy2, '--ink-2', s.ease('keeps', 0.6, 2.5) * (1 - s.ease('cells', 0.5)));

    const cA = s.win('cells', 'later');
    cite(s, 'Hubel & Wiesel, 1962', cA);
    caption(s, 'complex cells: an edge anywhere in a patch', cy, '--ink-2', cA);
    const late = s.ease('later', 0.6);
    const rp = after(s, 'later', 0.45);
    cite(s, 'the neocognitron · Fukushima, 1980', late * (1 - rp));
    cite(s, 'Riesenhuber & Poggio, 1999', rp);
    caption(s, 'it still answers when the pattern moves', cy, '--ink-2', late * (1 - rp));
    caption(s, 'the max still signals the best match', cy, '--ink-2', rp);
  },
};

// ---- max and average on the same map, with 0-based indices

const maxScene: SceneDef = {
  draw(s) {
    const tall = s.tall;
    const u = s.u;
    const g = grid(s, tall ? s.w / 2 : s.w * 0.27, tall ? s.h * 0.3 : s.h * 0.48, 4, 4, 11);
    const mo = grid(s, tall ? s.w * 0.3 : s.w * 0.62, tall ? s.h * 0.78 : s.h * 0.48, 2, 2, 11);
    const ao = grid(s, tall ? s.w * 0.72 : s.w * 0.86, tall ? s.h * 0.78 : s.h * 0.48, 2, 2, 11);
    const splitA = s.ease('grid', 0.6, 2);
    const maxA = s.ease('max', 0.6, 0.4);
    label(s, 'x', (g.l + g.r) / 2, g.t - 3.6 * u, 'orange', 4);
    gridCells(s, g, X, (i, j) => (splitA > 0.5 ? WIN[winOf(i, j)]! : 'orange'), { on: (i, j) => (isMax(i, j) ? maxA * (1 - s.ease('avg', 0.6)) : 0) });
    split(s, g, splitA);
    s.alpha(s.ease('max', 0.4), () => label(s, 'max', (mo.l + mo.r) / 2, mo.t - 3.6 * u, '--ink-2'));
    pooled(s, mo, MAX, (w) => s.ease('max', 0.4, 0.8 + w * 0.5), s.win('out', 'avg'));
    s.alpha(s.ease('out', 0.6, 0.8) * (1 - s.ease('map', 0.5)), () => {
      const y = tall ? mo.b + 4.5 * u : mo.b + 5 * u;
      s.text('4 × 4 to 2 × 2', (mo.l + mo.r) / 2, y, { size: 3.2, font: 'mono', color: s.c('--ink-2') });
    });
    // Output (1, 0) and the input window it reads, with 0-based indices; then the rule for any row.
    const idxA = s.win('map', 'avg');
    s.alpha(idxA, () => {
      const idx = (t: string | number, x: number, y: number) => s.text(String(t), x, y, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
      for (let k = 0; k < 4; k++) {
        idx(k, g.l - 2.6 * u, g.y(k));
        idx(k, g.x(k), g.b + 2.8 * u);
      }
      for (let k = 0; k < 2; k++) {
        idx(k, mo.l - 2.6 * u, mo.y(k));
        idx(k, mo.x(k), mo.b + 2.8 * u);
      }
    });
    const ax = (ao.l + ao.r) / 2;
    const ay = (ao.t + ao.b) / 2;
    const lines = (a: number, t: [string, string, string]) => s.alpha(a, () => {
      label(s, t[0], ax, ay - 5 * u, 'purple', 3.2);
      label(s, t[1], ax, ay, '--ink-2', 3.2);
      label(s, t[2], ax, ay + 5 * u, '--ink-2', 3.2);
    });
    lines(s.win('map', 'rule'), ['output (1, 0)', 'input rows 2, 3', 'columns 0, 1']);
    lines(s.win('rule', 'avg'), ['output row i', 'input rows', '2i and 2i + 1']);
    const mapA = s.ease('map', 0.6, 1.5) * (1 - s.ease('rule', 0.6));
    windowBox(s, g, 2, 0, 2, 2, 'purple', mapA);
    windowBox(s, mo, 1, 0, 1, 1, 'purple', s.ease('map', 0.6, 0.6) * (1 - s.ease('rule', 0.6)));
    s.alpha(s.ease('avg', 0.6), () => {
      label(s, 'average', ax, ao.t - 3.6 * u, '--ink-2');
      pooled(s, ao, AVG, (w) => s.ease('avg', 0.5, 1 + w * 0.9), 0, 3);
    });
    windowBox(s, g, 0, 0, 2, 2, 'blue', s.ease('avg', 0.6, 2) * 0.8);
  },
};

// ---- the shape it leaves, and no parameters

const IN_SIDE = 26;
const shape: SceneDef = {
  draw(s) {
    const tall = s.tall;
    const u = s.u;
    const big = (tall ? 24 : IN_SIDE) * u;
    const small = big / 2;
    const top = s.h * 0.1 + 8 * u;
    const ix = s.w * (tall ? 0.1 : 0.18);
    const ox = s.w * (tall ? 0.62 : 0.6);
    volume(s, ix, top, big, 16, () => 'orange', { step: 0.55 });
    s.text('(16, 32, 32)', ix + big / 2 + 4 * u, top + big + 5 * u, { size: 3.4, font: 'mono', weight: 600, color: s.c('--ink-2') });
    const a = s.ease('channels', 0.8, 1.5);
    s.alpha(a, () => {
      s.arrow(ix + big + 11 * u, top + big / 2, ox - 3 * u, top + big / 2, s.c('--ink-3'), 0.4, 2.4);
      volume(s, ox, top + big / 4, small, 16, () => 'gold', { step: 0.55 });
      s.text('(16, 16, 16)', ox + small / 2 + 4 * u, top + big + 5 * u, { size: 3.4, font: 'mono', weight: 600, color: s.c('gold') });
    });
    const y1 = s.h * 0.58;
    s.alpha(s.ease('formula', 0.6, 0.4), () => rich(s, [['(32 − 2) / 2 + 1 = ', '--ink-2'], ['16', 'gold']], s.w / 2, y1, { size: 4, weight: 600 }));
    s.alpha(s.ease('none', 0.6), () => rich(s, [['parameters: ', '--ink-2'], ['0', 'gold']], s.w / 2, y1 + 7 * u, { size: 4, weight: 650 }));
    s.alpha(s.ease('none', 0.6, 2), () => caption(s, 'a filter has weights; a max has none', s.h * 0.8));

    // 3 x 3 windows at stride 2: neighbors share a column (cells 2 and 4).
    s.alpha(s.win('overlap', 'none'), () => {
      const g = grid(s, s.w / 2, s.h * 0.76, 1, 7, s.tall ? 7 : 6.5);
      const shared = (j: number) => (j === 2 || j === 4 ? s.ease('overlap', 0.6, 2) : 0);
      gridCells(s, g, [Array(7).fill('')], 'orange', { on: (_, j) => shared(j) });
      const p = g.pitch * u;
      const bracket = (j0: number, up: boolean, k: Ink, a: number) => s.alpha(a, () => {
        const x0 = g.x(j0) - p / 2 + 0.6 * u;
        const x1 = g.x(j0 + 2) + p / 2 - 0.6 * u;
        const y = up ? g.t - 1.8 * u : g.b + 1.8 * u;
        const tip = up ? 1.2 * u : -1.2 * u;
        s.line(x0, y + tip, x0, y, s.c(k), 0.4);
        s.line(x0, y, x1, y, s.c(k), 0.4);
        s.line(x1, y, x1, y + tip, s.c(k), 0.4);
      });
      bracket(0, true, 'blue', s.ease('overlap', 0.5, 0.6));
      bracket(2, false, 'green', s.ease('overlap', 0.5, 1.2));
      bracket(4, true, 'purple', s.ease('overlap', 0.5, 1.8));
      s.alpha(s.ease('overlap', 0.6, 3.5), () => rich(s, [['3 × 3, stride 2:  (27 − 3) / 2 + 1 = ', '--ink-2'], ['13', 'gold']], s.w / 2, s.h * 0.88, { size: 3.6, weight: 600 }));
    });
  },
};

export const scenes: Record<string, SceneDef> = { shift, max: maxScene, shape };

import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { after } from '../../networks/draw';
import { type Ink, rich } from '../draw';

type Box = [number, number, number, number];

/** A grid of whole-number coordinates, y down, and where the text goes: under it, or beside it on a wide stage. */
interface Plane {
  X(x: number): number;
  Y(y: number): number;
  c: number;
  l: number;
  t: number;
  r: number;
  b: number;
  side: boolean;
  /** Text column: center x, first line y, line gap. */
  tx: number;
  ty: number;
  gap: number;
}

/** `cell` caps the cell size and `tall` the grid's height, both in stage units. */
function plane(s: Scene, nx: number, ny: number, cell: number, tall: number): Plane {
  const side = s.w / s.u >= 150;
  if (!side) {
    const c = Math.min(cell * s.u, (s.w - 14 * s.u) / nx, (tall * s.u) / ny);
    const l = (s.w - nx * c) / 2 + 1.5 * s.u;
    const t = 11 * s.u;
    return { X: (x) => l + x * c, Y: (y) => t + y * c, c, l, t, r: l + nx * c, b: t + ny * c, side, tx: s.w / 2, ty: t + ny * c + 8 * s.u, gap: 7 * s.u };
  }
  const c = Math.min(cell * s.u, (70 * s.u) / nx, (60 * s.u) / ny);
  const l = 10 * s.u;
  const t = (s.h - ny * c) / 2 + 2 * s.u;
  const r = l + nx * c;
  return { X: (x) => l + x * c, Y: (y) => t + y * c, c, l, t, r, b: t + ny * c, side, tx: (r + s.w) / 2, ty: s.h * 0.26, gap: 8 * s.u };
}

/** Faint unit grid with its coordinates along the top and the left; `hi` lights some of them. */
function gridLines(s: Scene, P: Plane, nx: number, ny: number, hi: { x?: number[]; y?: number[]; a?: number } = {}): void {
  for (let i = 0; i <= nx; i++) s.line(P.X(i), P.t, P.X(i), P.b, s.tint('--ink-3', 0.22), 0.2);
  for (let j = 0; j <= ny; j++) s.line(P.l, P.Y(j), P.r, P.Y(j), s.tint('--ink-3', 0.22), 0.2);
  const lit = (v: number, xs?: number[]) => (xs?.includes(v) ? (hi.a ?? 1) : 0);
  const num = (v: number, x: number, y: number, a: number) =>
    s.text(String(v), x, y, { size: 2.8 + 0.6 * a, font: 'mono', weight: 500 + 150 * a, color: a > 0.5 ? s.c('gold') : s.c('--ink-3') });
  for (let i = 0; i <= nx; i++) num(i, P.X(i), P.t - 3 * s.u, lit(i, hi.x));
  for (let j = 0; j <= ny; j++) num(j, P.l - 3 * s.u, P.Y(j), lit(j, hi.y));
}

function rect(s: Scene, P: Plane, b: Box, k: Ink, o: { fill?: number; lw?: number; dash?: boolean } = {}): void {
  const [x1, y1, x2, y2] = b;
  const c = s.ctx;
  if (o.dash) c.setLineDash([1.2 * s.u, 0.9 * s.u]);
  s.rrect(P.X(x1), P.Y(y1), P.X(x2) - P.X(x1), P.Y(y2) - P.Y(y1), 0.4, { fill: s.tint(k, o.fill ?? 0.1), stroke: s.c(k), lw: o.lw ?? 0.55 });
  c.setLineDash([]);
}

const TRUTH: Box = [1, 1, 5, 4];
const GUESS: Box = [2, 2, 6, 5];
const AWAY: Box = [6, 2, 10, 5];

/** One line of working in the text column, `row` lines down. */
function work(s: Scene, P: Plane, row: number, runs: [string, Ink][], a: number, size = 3.3): void {
  s.alpha(a, () => rich(s, runs, P.tx, P.ty + row * P.gap, { size, weight: 600 }));
}

const boxes: SceneDef = {
  draw(s) {
    const P = plane(s, 10, 6, 8, 42);
    gridLines(s, P, 10, 6);
    const tA = s.ease('box', 0.8, 0.3);
    s.alpha(tA, () => rect(s, P, TRUTH, 'green'));
    s.alpha(s.ease('corners', 0.5, 0.6), () => {
      s.circle(P.X(1), P.Y(1), 1.1 * s.u, { fill: s.c('green') });
      s.circle(P.X(5), P.Y(4), 1.1 * s.u, { fill: s.c('green') });
    });
    s.alpha(after(s, 'corners', 0.15) * (1 - s.ease('area', 0.5)), () => {
      s.text('(1, 1)', P.X(1) + 1.5 * s.u, P.Y(1) - 2.8 * s.u, { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c('green'), halo: true });
      s.text('(5, 4)', P.X(5) + 1.2 * s.u, P.Y(4) + 3.2 * s.u, { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c('green'), halo: true });
    });
    const wA = after(s, 'area', 0.15);
    const hA = after(s, 'area', 0.5);
    const gone = 1 - s.ease('guess', 0.6);
    s.alpha(wA * gone, () => {
      const y = P.Y(1) - 1.6 * s.u;
      s.line(P.X(1), y, P.X(5), y, s.c('green'), 0.35);
      s.text('4', P.X(3), y - 2.4 * s.u, { size: 3.4, font: 'mono', weight: 650, color: s.c('green'), halo: true });
    });
    s.alpha(hA * gone, () => {
      const x = P.X(1) - 1.6 * s.u;
      s.line(x, P.Y(1), x, P.Y(4), s.c('green'), 0.35);
      s.text('3', x - 2.2 * s.u, P.Y(2.5), { size: 3.4, font: 'mono', weight: 650, color: s.c('green'), halo: true });
    });
    const gA = after(s, 'guess', 0.1, 0.8);
    s.alpha(gA, () => rect(s, P, GUESS, 'blue'));
    work(s, P, 0, [['truth ', 'green'], ['(x1, y1, x2, y2)', '--ink-3']], tA * (1 - s.ease('corners', 0.4)));
    work(s, P, 0, [['truth = (1, 1, 5, 4)', 'green']], s.ease('corners', 0.5, 0.4));
    work(s, P, 1, [['area = 4 × 3 = ', '--ink-2'], ['12', 'green']], after(s, 'area', 0.75));
    work(s, P, 2, [['guess = (2, 2, 6, 5)', 'blue']], gA);
    work(s, P, 3, [['area = 4 × 3 = ', '--ink-2'], ['12', 'blue']], after(s, 'guess', 0.55));
  },
};

const overlap: SceneDef = {
  draw(s) {
    const P = plane(s, 10, 6, 8, 42);
    const xLit = after(s, 'inter', 0.35);
    const yLit = after(s, 'tall', 0.15);
    const tallOn = s.since('tall') >= 0;
    gridLines(s, P, 10, 6, { x: tallOn ? [] : [2, 5], y: [2, 4], a: tallOn ? yLit * (1 - s.ease('union', 0.5)) : xLit });
    const away = after(s, 'apart', 0.1, 0.9) * (1 - s.ease('union', 0.9));
    const g = GUESS.map((v, i) => lerp(v, AWAY[i]!, away)) as Box;
    const uA = s.ease('union', 0.6) * (1 - s.ease('range', 0.6));
    rect(s, P, TRUTH, 'green', { fill: 0.08 });
    rect(s, P, g, 'blue', { fill: 0.08 });
    s.alpha(uA, () => {
      const c = s.ctx;
      c.beginPath();
      const pts: [number, number][] = [[1, 1], [5, 1], [5, 2], [6, 2], [6, 5], [2, 5], [2, 4], [1, 4]];
      pts.forEach(([x, y], i) => (i ? c.lineTo(P.X(x), P.Y(y)) : c.moveTo(P.X(x), P.Y(y))));
      c.closePath();
      c.fillStyle = s.tint('purple', 0.14);
      c.fill();
      c.strokeStyle = s.c('purple');
      c.lineWidth = 0.8 * s.u;
      c.stroke();
    });
    // The overlap: edges as dashed guides, then the gold rectangle once both sides are known.
    s.alpha(xLit * (1 - s.ease('tall', 0.5)), () => {
      for (const x of [2, 5]) s.line(P.X(x), P.t, P.X(x), P.b, s.c('gold'), 0.45, [1.2, 0.9]);
    });
    s.alpha(yLit * (1 - s.ease('apart', 0.4)), () => {
      for (const y of [2, 4]) s.line(P.l, P.Y(y), P.r, P.Y(y), s.c('gold'), 0.45, [1.2, 0.9]);
    });
    s.alpha(after(s, 'tall', 0.7) * (1 - away), () => rect(s, P, [2, 2, 5, 4], 'gold', { fill: 0.45, lw: 0.6 }));
    s.alpha(away, () => {
      const y = P.Y(3.5);
      s.line(P.X(5), y, P.X(g[0]), y, s.c('red'), 0.6);
      s.text('5 − 6 = −1', (P.X(5) + P.X(g[0])) / 2, P.Y(5) + 3.4 * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c('red'), halo: true });
    });
    const done = 1 - s.ease('range', 0.6);
    s.alpha((1 - away) * done, () => work(s, P, 0, [['width = min(5, 6) − max(1, 2) = ', '--ink-2'], ['3', 'gold']], after(s, 'inter', 0.8)));
    s.alpha(away, () => work(s, P, 0, [['width = max(0, 5 − 6) = ', '--ink-2'], ['0', 'red']], 1));
    s.alpha((1 - 0.75 * away) * done, () => {
      work(s, P, 1, [['height = min(4, 5) − max(1, 2) = ', '--ink-2'], ['2', 'gold']], after(s, 'tall', 0.45));
      work(s, P, 2, [['inter = 3 × 2 = ', '--ink-2'], ['6', 'gold']], after(s, 'tall', 0.75));
    });
    work(s, P, 3, [['union = 12 + 12 − 6 = ', '--ink-2'], ['18', 'purple']], after(s, 'union', 0.75) * done);
    const fy = lerp(4, 0, s.ease('range', 0.8));
    s.alpha(s.ease('iou', 0.6), () => rich(s, [['IoU = 6 / 18 ≈ ', '--ink'], ['0.33', 'gold']], P.tx, P.ty + fy * P.gap, { size: 4, weight: 650 }));

    // A scale from 0 to 1 with this guess marked on it.
    s.alpha(s.ease('range', 0.6, 0.6), () => {
      const half = (P.side ? 26 : 34) * s.u;
      const x0 = P.tx - half;
      const x1 = P.tx + half;
      const y = P.ty + 2.2 * P.gap;
      const X = (v: number) => lerp(x0, x1, v);
      s.line(x0, y, x1, y, s.c('--ink-3'), 0.45);
      const ticks: [number, string, string][] = [[0, '0', 'apart'], [0.5, '0.5', 'hit'], [1, '1', 'same']];
      for (const [v, n, w] of ticks) {
        s.line(X(v), y - 1.4 * s.u, X(v), y + 1.4 * s.u, s.c('--ink-3'), 0.4);
        s.text(n, X(v), y - 4 * s.u, { size: 3, font: 'mono', color: s.c('--ink-2') });
        s.text(w, X(v), y + 4.2 * s.u, { size: 3, color: s.c('--ink-3') });
      }
      s.alpha(after(s, 'range', 0.6), () => s.rrect(X(0.5), y - 0.9 * s.u, X(1) - X(0.5), 1.8 * s.u, 0.9, { fill: s.tint('green', 0.35) }));
      s.circle(X(1 / 3), y, 1.4 * s.u, { fill: s.c('gold'), stroke: s.c('--card'), lw: 0.4 });
    });
  },
};

// Two objects, two boxes each: A and B on the left one, C and D on the right one.
const NB: { name: string; box: Box; score: number; k: Ink }[] = [
  { name: 'A', box: [1, 2, 8, 9], score: 0.9, k: 'blue' },
  { name: 'B', box: [2, 3, 9, 10], score: 0.7, k: 'teal' },
  { name: 'C', box: [11, 1, 18, 7], score: 0.8, k: 'purple' },
  { name: 'D', box: [12, 2, 18, 8], score: 0.6, k: 'orange' },
];
const ORDER = [0, 2, 1, 3];

const nms: SceneDef = {
  draw(s) {
    const P = plane(s, 20, 12, 4.4, 50);
    // 1 kept, -1 dropped, eased in as the narration reaches each box.
    const fate = [after(s, 'keep', 0.12), -after(s, 'keep', 0.8), after(s, 'stay', 0.55), -after(s, 'stay', 0.85)];
    s.circle(P.X(5), P.Y(6.5), 2.9 * P.c, { fill: s.tint('--ink-3', 0.14) });
    s.circle(P.X(14.8), P.Y(4.8), 2.6 * P.c, { fill: s.tint('--ink-3', 0.14) });
    s.rrect(P.l, P.t, P.r - P.l, P.b - P.t, 1, { stroke: s.tint('--ink-3', 0.5), lw: 0.3 });
    NB.forEach((n, i) => {
      const f = fate[i]!;
      const a = s.ease('many', 0.6, 0.6 + 0.5 * ORDER.indexOf(i)) * (f < 0 ? 1 - 0.75 * -f : 1);
      s.alpha(a, () => {
        rect(s, P, n.box, n.k, { fill: 0.06 + 0.12 * Math.max(0, f), lw: 0.45 + 0.35 * Math.max(0, f), dash: f < -0.5 });
        const [x1, y1, x2, y2] = n.box;
        const top = i % 2 === 0;
        s.text(`${n.name} ${n.score.toFixed(1)}`, top ? P.X(x1) : P.X(x2), top ? P.Y(y1) - 2.4 * s.u : P.Y(y2) + 2.6 * s.u, { size: 3, font: 'mono', weight: 650, align: top ? 'left' : 'right', color: s.c(n.k), halo: true });
      });
    });
    // The boxes sorted by confidence, each marked kept or dropped as the passes reach it.
    const step = P.side ? 10 * s.u : 22 * s.u;
    ORDER.forEach((i, r) => {
      const n = NB[i]!;
      const x = P.side ? P.tx - 5 * s.u : s.w / 2 + (r - 1.5) * step;
      const y = P.side ? s.h * 0.22 + r * step : P.b + 8 * s.u;
      const f = fate[i]!;
      const mx = P.side ? x + 12 * s.u : x;
      const my = P.side ? y : y + 6.4 * s.u;
      s.alpha(s.ease('sort', 0.4, 0.3 + 0.35 * r), () => {
        s.cell(x - 7 * s.u, y - 3.3 * s.u, 14 * s.u, 6.6 * s.u, `${n.name} ${n.score.toFixed(1)}`, n.k, { on: Math.max(0, f), size: 3 });
        s.alpha(Math.abs(f), () => s.text(f > 0 ? '✓' : '✗', mx, my, { size: 4, font: 'ui', weight: 700, color: s.c(f > 0 ? 'green' : 'red') }));
      });
    });
    const lx = P.side ? P.tx : s.w / 2;
    const ly = P.side ? s.h * 0.22 + 4.2 * step : P.b + 21 * s.u;
    const line = (runs: [string, Ink][], a: number) => s.alpha(a, () => rich(s, runs, lx, ly, { size: 3.2, weight: 600 }));
    line([['IoU(A, B) = 0.58 > 0.5: ', '--ink-2'], ['drop B', 'red']], after(s, 'keep', 0.75) * (1 - s.ease('stay', 0.4)));
    line([['IoU(A, C) = 0: ', '--ink-2'], ['C stays', 'green']], after(s, 'stay', 0.05) * (1 - after(s, 'stay', 0.75, 0.4)));
    line([['IoU(C, D) = 0.63 > 0.5: ', '--ink-2'], ['drop D', 'red']], after(s, 'stay', 0.8) * (1 - s.ease('done', 0.4)));
    line([['kept: ', '--ink-2'], ['A', 'blue'], [' and ', '--ink-2'], ['C', 'purple']], s.ease('done', 0.6, 0.3));
  },
};

export const scenes: Record<string, SceneDef> = { boxes, overlap, nms };

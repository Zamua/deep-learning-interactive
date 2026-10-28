import type { Scene, SceneDef } from '../../../lecture/scene';
import { smooth } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { cells, rowLabel, verdict } from '../../draw';
import { after, Frame, rich } from '../../networks/draw';

interface Spec {
  x: number[];
  W: number[][];
  b: number[];
  names: string[];
}

const dot = (a: number[], b: number[]) => a.reduce((t, v, i) => t + v * b[i]!, 0);
/** Each class's weights are its center and its bias is minus half the center's squared length, so the highest score is the nearest center. */
const A: Spec = { x: [2, 1], W: [[1, 1], [4, 2], [2, 4]], b: [-1, -10, -10], names: ['cat', 'plane', 'ship'] };
const AWX = A.W.map((r) => dot(r, A.x));
const AS = AWX.map((v, k) => v + A.b[k]!);
const str = (v: number) => String(v);

const CW = 11;
const CH = 8.5;

/** Where the x row, the rows of W and the Wx, b and s columns sit, centered with the row labels. */
function layout(s: Scene, spec: Spec, labW: number) {
  const D = spec.x.length;
  const C = spec.W.length;
  const g = s.tall ? 13 : 14;
  const wxOff = (D - 1) * g + 19;
  const left = -(CW / 2 + 3 + labW);
  const right = wxOff + 30 + CW / 2;
  const w0 = s.w / 2 - ((left + right) / 2) * s.u;
  const at = (off: number) => w0 + off * s.u;
  const ys = (C === 3 ? [0.4, 0.56, 0.72] : [0.42, 0.6]).map((f) => s.h * f);
  return {
    W: Array.from({ length: D }, (_, i) => at(i * g)),
    wx: at(wxOff),
    b: at(wxOff + 15),
    s: at(wxOff + 30),
    lx: at(-(CW / 2 + 3)),
    hy: s.h * 0.19,
    ys,
  };
}
type L = ReturnType<typeof layout>;

function xRow(s: Scene, L: L, labels: string[], on = 0) {
  rowLabel(s, 'x', L.lx, L.hy, 'orange');
  cells(s, L.W, L.hy, labels, 'orange', { w: CW, h: CH, on: labels.map(() => on) });
}

function wRows(s: Scene, L: L, spec: Spec, o: { band?: number[]; hiName?: number[]; nameSize?: number } = {}) {
  spec.W.forEach((r, k) => {
    const y = L.ys[k]!;
    const band = o.band?.[k] ?? 0;
    if (band > 0.003) {
      const x0 = L.W[0]! - (CW / 2 + 1.6) * s.u;
      const x1 = L.W[L.W.length - 1]! + (CW / 2 + 1.6) * s.u;
      s.rrect(x0, y - (CH / 2 + 1.6) * s.u, x1 - x0, (CH + 3.2) * s.u, 1.6, { fill: s.tint('blue', 0.1 * band), stroke: s.tint('blue', 0.7 * band), lw: 0.4 });
    }
    const hi = o.hiName?.[k] ?? 0;
    s.text(spec.names[k]!, L.lx, y, { size: o.nameSize ?? 3.6, font: 'mono', align: 'right', weight: 500 + 150 * hi, color: hi > 0.5 ? s.c('purple') : s.c('--ink-2') });
    cells(s, L.W, y, r.map(str), 'blue', { w: CW, h: CH, on: r.map(() => band) });
  });
}

/** One of the right-hand columns with its header and the operator before it. */
function column(s: Scene, L: L, x: number, head: string, k: Color | '--ink-2', labels: string[], o: { a?: number[]; on?: number[]; op?: string; opX?: number } = {}) {
  const a = o.a ?? labels.map(() => 1);
  if (Math.max(...a) > 0.003) s.alpha(Math.max(...a), () => s.text(head, x, L.hy, { size: 3.8, font: 'mono', weight: 650, color: s.c(k) }));
  labels.forEach((lab, i) => {
    s.alpha(a[i]!, () => {
      if (o.op && o.opX !== undefined) s.text(o.op, o.opX, L.ys[i]!, { size: 3.8, font: 'mono', color: s.c('--ink-3') });
      cells(s, [x], L.ys[i]!, [lab], k, { w: CW, h: CH, on: [o.on?.[i] ?? 0] });
    });
  });
}

const mid = (a: number, b: number) => (a + b) / 2;
const arrowX = (L: L) => mid(L.W[L.W.length - 1]!, L.wx) + 0.5;

function caption(s: Scene, text: string, y: number, k: Color | '--ink-2' = '--ink-2', size = 3.6) {
  s.text(text, s.w / 2, y, { size, font: 'mono', color: s.c(k), halo: true });
}

/** A verdict line centered on the stage. */
function centered(s: Scene, ok: boolean, text: string, y: number, size = 3.6) {
  const w = s.measure(text, { size }) + size * 1.4 * s.u;
  verdict(s, ok, text, s.w / 2 - w / 2, y, size);
}

const rows: SceneDef = {
  draw(s) {
    const L = layout(s, A, 9);
    const cy = s.h * 0.88;
    xRow(s, L, A.x.map(str), s.win('row', 'all'));
    const band = [s.win('row', 'all'), 0, 0];
    s.alpha(s.ease('W', 0.6), () => {
      wRows(s, L, A, { band });
      s.alpha(1 - s.ease('row', 0.5), () => caption(s, 'W: 3 rows (classes) × 2 columns (features)', cy, '--ink-2', 3.4));
    });
    const wxA = [s.ease('row', 0.6, 2.2), s.ease('all', 0.6), s.ease('all', 0.6, 1.2)];
    column(s, L, L.wx, 'Wx', '--ink-2', AWX.map(str), { a: wxA, on: [s.win('row', 'all'), 0, 0], op: '→', opX: arrowX(L) });
    s.alpha(s.win('row', 'all'), () => caption(s, '1·2 + 1·1 = 3', cy, 'blue', 3.8));
    s.alpha(s.win('all', 'col'), () => caption(s, 'one dot product per row', cy));
    const c = s.ease('col', 0.6);
    s.alpha(c, () => {
      const x0 = L.W[0]! - (CW / 2 + 1.6) * s.u;
      const y0 = L.ys[0]! - (CH / 2 + 1.6) * s.u;
      const y1 = L.ys[L.ys.length - 1]! + (CH / 2 + 1.6) * s.u;
      s.rrect(x0, y0, (CW + 3.2) * s.u, y1 - y0, 1.6, { stroke: s.c('red'), lw: 0.5 });
      centered(s, false, 'a column: 3 numbers, x has 2', cy);
    });
  },
};

const bias: SceneDef = {
  draw(s) {
    const L = layout(s, A, 9);
    const cy = s.h * 0.88;
    const z = s.ease('zero', 0.8);
    const xl = A.x.map(str);
    s.alpha(1 - z, () => xRow(s, L, xl));
    s.alpha(z, () => xRow(s, L, ['0', '0'], 1));
    const pred = s.win('s', 'forget');
    wRows(s, L, A, { hiName: [pred, 0, 0] });
    const nob = s.win('forget', 'zero');
    const dimBS = 1 - 0.75 * nob;
    s.alpha(1 - z, () => column(s, L, L.wx, 'Wx', '--ink-2', AWX.map(str), { on: [0, 0, nob], op: '→', opX: arrowX(L) }));
    s.alpha(z, () => column(s, L, L.wx, 'Wx', '--ink-2', ['0', '0', '0'], { on: [1, 1, 1], op: '→', opX: arrowX(L) }));
    const bA = A.b.map((_, i) => s.ease('b', 0.6, 0.4 * i) * dimBS);
    column(s, L, L.b, 'b', 'green', A.b.map(str), { a: bA, op: '+', opX: mid(L.wx, L.b), on: A.b.map(() => z) });
    const sA = AS.map(() => s.ease('s', 0.6) * dimBS);
    s.alpha(1 - z, () => column(s, L, L.s, 's', 'purple', AS.map(str), { a: sA, op: '=', opX: mid(L.b, L.s), on: [pred, 0, 0] }));
    s.alpha(z, () => column(s, L, L.s, 's', 'purple', A.b.map(str), { op: '=', opX: mid(L.b, L.s), on: [1, 1, 1] }));
    s.alpha(pred, () => caption(s, 'top score 2: cat', cy, 'purple', 3.8));
    s.alpha(nob, () => centered(s, false, 'without b: plane wins with 10', cy));
    s.alpha(z * (1 - s.ease('name', 0.5)), () => caption(s, 'x = 0  →  s = b', cy, 'green', 4));
    s.alpha(s.win('name', 'why'), () => caption(s, 'b: each class\'s lean, before any evidence', cy, 'green', 3.6));
    s.alpha(s.ease('why', 0.5), () => caption(s, 'without b, every class starts at 0', cy, '--ink-2', 3.6));
  },
};

// ---- the line: two features, cats and ships, and the line w · x + b = 0 between them

const CATS: [number, number][] = [[0.8, 1.6], [1.4, 0.9], [1.1, 1.3], [1.7, 1.4], [0.7, 0.9], [1.4, 1.9], [1, 1]];
const SHIPS: [number, number][] = [[1.8, 3.3], [2.5, 3.9], [2.3, 3.6], [2.7, 3.4], [1.6, 3.8], [2.4, 3.1], [2, 4]];
const PLANES: [number, number][] = [[3.6, 1.7], [4.2, 2.3], [3.9, 1.4], [4.3, 1.8], [3.7, 2.4], [4.1, 2.7], [3.4, 2.1]];
/** The final line: w = (1, 1), b = -4, so x₀ + x₁ = 4. */
const WB = { w: [1, 1], b: -4 };

/** The equation goes under the plane unless the stage is wide enough to hold it beside. */
const stacked = (s: Scene) => s.tall || s.w / s.h < 1.45;

/** The feature plane, square: at the top of a narrow stage, at the left of a wide one. */
function plane(s: Scene): Frame {
  const side = stacked(s) ? Math.min(s.w - 20 * s.u, s.h * 0.64) : Math.min(s.h * 0.84, s.w * 0.5);
  const l = stacked(s) ? s.w / 2 - side / 2 : s.w * 0.05;
  const t = stacked(s) ? s.h * 0.04 : (s.h - side) / 2;
  return new Frame(s, l, t, l + side, t + side, [-0.5, 4.5], [-0.5, 4.5]);
}

/** The line n · x = c, across the window. */
function lineAt(F: Frame, n: [number, number], c: number, k: Color, width = 0.7) {
  const len = Math.hypot(n[0], n[1]);
  const [nx, ny] = [n[0] / len, n[1] / len];
  const p0 = [nx * (c / len), ny * (c / len)];
  F.clip(() => F.seg(p0[0]! - ny * 12, p0[1]! + nx * 12, p0[0]! + ny * 12, p0[1]! - nx * 12, k, width));
}

const line: SceneDef = {
  draw(s) {
    const F = plane(s);
    const u = s.u;
    const side = s.ease('side', 0.8);
    // The two sides, once the score has a sign.
    s.alpha(side, () => F.clip(() => {
      const g = s.ctx;
      g.fillStyle = s.tint('teal', 0.12);
      g.beginPath();
      g.moveTo(F.X(4.5), F.Y(-0.5));
      g.lineTo(F.X(4.5), F.Y(4.5));
      g.lineTo(F.X(-0.5), F.Y(4.5));
      g.closePath();
      g.fill();
      g.fillStyle = s.tint('gold', 0.12);
      g.beginPath();
      g.moveTo(F.X(-0.5), F.Y(4.5));
      g.lineTo(F.X(-0.5), F.Y(-0.5));
      g.lineTo(F.X(4.5), F.Y(-0.5));
      g.closePath();
      g.fill();
    }));
    s.rrect(F.l, F.t, F.r - F.l, F.b - F.t, 1, { stroke: s.c('--axis'), lw: 0.3 });
    F.axes();
    const ax = { size: 3.2, font: 'mono', weight: 600, color: s.c('orange'), halo: true } as const;
    s.text('x₀: blue →', F.X(0) + 2 * u, F.Y(0) + 3.2 * u, { ...ax, align: 'left' });
    s.text('x₁: edges ↑', F.X(0) + 2 * u, F.t + 3.5 * u, { ...ax, align: 'left' });

    const pts = s.ease('points', 0.8);
    CATS.forEach(([a, b], i) => s.alpha(pts * after(s, 'points', 0.35 + i * 0.04), () => F.dot(a, b, 'gold', 1.3)));
    SHIPS.forEach(([a, b], i) => s.alpha(pts * after(s, 'points', 0.6 + i * 0.04), () => F.dot(a, b, 'teal', 1.3)));
    s.alpha(s.win('points', 'line'), () => {
      s.text('cats', F.X(0.55), F.Y(2.4), { size: 3.4, font: 'mono', weight: 650, color: s.c('gold'), halo: true });
      s.text('ships', F.X(3.4), F.Y(3.7), { size: 3.4, font: 'mono', weight: 650, color: s.c('teal'), halo: true });
    });

    // The line: in place, then turned, then slid back to the corner and out again.
    const rot = s.since('rotate') >= 0 && s.since('slide') < 0 ? Math.sin(s.prog('rotate') * Math.PI * 2) * 0.5 : 0;
    const sp = s.prog('slide');
    const toZero = smooth((sp - 0.32) / 0.14);
    const outAgain = smooth((sp - 0.8) / 0.14);
    const wiggle = sp < 0.3 ? Math.sin((sp / 0.3) * Math.PI) * 0.9 : 0;
    const bNow = s.since('slide') >= 0 && s.since('side') < 0 ? WB.b + wiggle + 4 * toZero * (1 - outAgain) : WB.b;
    const th = Math.PI / 4 + rot;
    const n: [number, number] = [Math.cos(th), Math.sin(th)];
    // Turning keeps the line through (2, 2); sliding keeps w = (1, 1).
    s.alpha(s.ease('line', 0.8, 0.6), () => (rot ? lineAt(F, n, n[0] * 2 + n[1] * 2, 'purple', 0.8) : lineAt(F, [1, 1], -bNow, 'purple', 0.8)));
    const pinned = s.since('slide') >= 0 && s.since('side') < 0 ? toZero * (1 - outAgain) : 0;
    s.alpha(pinned, () => {
      F.dot(0, 0, 'green', 1.2);
      s.text('b = 0', F.X(0) + 7 * u, F.Y(0) - 3.5 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c('green'), halo: true });
    });

    // The scores of one ship and one cat.
    s.alpha(side, () => {
      F.dot(2, 4, 'teal', 1.9);
      F.dot(1, 1, 'gold', 1.9);
    });
    const lab = { size: 3.2, font: 'mono', weight: 650, halo: true } as const;
    s.alpha(after(s, 'side', 0.2), () => s.text('2 + 4 − 4 = 2', F.r - 2 * u, F.Y(4.25), { ...lab, align: 'right', color: s.c('purple') }));
    s.alpha(after(s, 'side', 0.45), () => s.text('1 + 1 − 4 = −2', F.X(1.2), F.Y(0.3), { ...lab, color: s.c('purple') }));

    // The equation, beside the plane on a wide stage and under it on a phone.
    const st = stacked(s);
    const ex = st ? s.w / 2 : (F.r + s.w) / 2;
    const ey = st ? F.b + 9 * u : s.h * 0.4;
    const eq = { size: st ? 4.6 : 5, weight: 650 } as const;
    const school = s.win('line', 'rewrite');
    s.alpha(school, () => rich(s, [['y = mx + ', '--ink-2'], ['b', 'green']], ex, ey, eq));
    s.alpha(s.ease('rewrite', 0.6, 0.4), () => rich(s, [['w', 'blue'], [' · ', '--ink-2'], ['x', 'orange'], [' + ', '--ink-2'], ['b', 'green'], [' = 0', '--ink-2']], ex, ey, eq));
    const cy = ey + (st ? 7.5 : 9) * u;
    const cap = { size: st ? 3.4 : 3.6, font: 'mono', color: s.c('--ink-2'), halo: true } as const;
    s.alpha(s.win('line', 'rewrite') * after(s, 'line', 0.6), () => s.text('m tilts it, b slides it', ex, cy, cap));
    s.alpha(s.win('rotate', 'slide'), () => s.text('change w: the line turns', ex, cy, { ...cap, color: s.c('blue') }));
    s.alpha(s.win('slide', 'side'), () => s.text('change b: it slides', ex, cy, { ...cap, color: s.c('green') }));
    s.alpha(s.win('side', 'linear'), () => s.text('score = w · x + b', ex, cy, { ...cap, color: s.c('purple') }));
    s.alpha(s.ease('linear', 0.6), () => s.text('a weighted sum: a straight line', ex, cy, cap));
  },
};

// ---- three classes: each scores with its own line, and the highest score claims its region

const CLASSES: { name: string; k: Color; pts: [number, number][]; at: [number, number] }[] = [
  { name: 'cats', k: 'gold', pts: CATS, at: [0.5, 2.2] },
  { name: 'planes', k: 'red', pts: PLANES, at: [3.9, 0.7] },
  { name: 'ships', k: 'teal', pts: SHIPS, at: [3.5, 4.1] },
];
const score = (k: number, p: readonly number[]) => A.W[k]![0]! * p[0]! + A.W[k]![1]! * p[1]! + A.b[k]!;

/** The window, cut down to where class `k` scores at least as high as every other: a convex polygon. */
function region(k: number): [number, number][] {
  let poly: [number, number][] = [[-0.5, -0.5], [4.5, -0.5], [4.5, 4.5], [-0.5, 4.5]];
  for (let j = 0; j < A.W.length; j++) {
    if (j === k) continue;
    const f = (p: [number, number]) => score(k, p) - score(j, p);
    const out: [number, number][] = [];
    poly.forEach((p, i) => {
      const q = poly[(i + 1) % poly.length]!;
      const [fp, fq] = [f(p), f(q)];
      if (fp >= 0) out.push(p);
      if (fp >= 0 !== fq >= 0) {
        const t = fp / (fp - fq);
        out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
      }
    });
    poly = out;
  }
  return poly;
}
const REGIONS = A.W.map((_, k) => region(k));

const classes: SceneDef = {
  draw(s) {
    const F = plane(s);
    const u = s.u;
    const reg = s.ease('regions', 0.8, 1.5);
    REGIONS.forEach((poly, k) => {
      const c = CLASSES[k]!;
      s.alpha(reg, () => {
        const g = s.ctx;
        g.beginPath();
        poly.forEach(([a, b], i) => (i ? g.lineTo(F.X(a), F.Y(b)) : g.moveTo(F.X(a), F.Y(b))));
        g.closePath();
        g.fillStyle = s.tint(c.k, 0.14);
        g.fill();
        g.strokeStyle = s.c('--ink-2');
        g.lineWidth = 0.5 * u;
        g.stroke();
      });
    });
    s.rrect(F.l, F.t, F.r - F.l, F.b - F.t, 1, { stroke: s.c('--axis'), lw: 0.3 });
    F.axes();
    const ax = { size: 3.2, font: 'mono', weight: 600, color: s.c('orange'), halo: true } as const;
    s.text('x₀: blue →', F.X(0) + 2 * u, F.Y(0) + 3.2 * u, { ...ax, align: 'left' });
    s.text('x₁: edges ↑', F.X(0) + 2 * u, F.t + 3.5 * u, { ...ax, align: 'left' });
    CLASSES.forEach((c, k) => {
      const a = k === 1 ? s.ease('three', 0.8, 1.2) : 1;
      s.alpha(a, () => {
        c.pts.forEach(([x0, x1]) => F.dot(x0, x1, c.k, 1.3));
        s.text(c.name, F.X(c.at[0]), F.Y(c.at[1]), { size: 3.4, font: 'mono', weight: 650, color: s.c(c.k), halo: true });
      });
    });
    // The input, which lands in the cats' region.
    s.alpha(s.ease('x', 0.6, 0.6), () => {
      F.dot(A.x[0]!, A.x[1]!, 'orange', 2);
      s.text('x', F.X(A.x[0]!) + 3 * u, F.Y(A.x[1]!) - 2.6 * u, { size: 3.8, font: 'mono', weight: 700, color: s.c('orange'), halo: true });
    });
    const st = stacked(s);
    const ex = st ? s.w / 2 : (F.r + s.w) / 2;
    const ey = st ? F.b + 9 * u : s.h * 0.4;
    const cap = { size: st ? 3.6 : 3.8, font: 'mono', color: s.c('--ink-2'), halo: true } as const;
    s.alpha(s.win('three', 'regions'), () => s.text('three classes, three scores', ex, ey, cap));
    s.alpha(s.win('regions', 'x'), () => s.text('the highest score claims each spot', ex, ey, cap));
    s.alpha(s.ease('x', 0.6), () => s.text('x lands where cat scores highest', ex, ey, { ...cap, color: s.c('gold') }));
  },
};

export const scenes: Record<string, SceneDef> = { line, classes, rows, bias };

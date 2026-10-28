import type { Scene, SceneDef } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { cells, columns } from '../../draw';
import { after, caption, Frame, rich } from '../../networks/draw';

const X = [2, 1];
const DS = [-0.7, 0.7];
const f = (v: number) => String(Math.round(v * 100) / 100);
const fm = (v: number) => (v < 0 ? `−${f(-v)}` : f(v));

type Ink = Color | `--${string}`;

/** Eased in `frac` of the way through beat `id`, so a value lands as the voice says it. */
const lateIn = (s: Scene, id: string, frac: number) => s.ease(id, 0.6, frac * (s.end(id) - s.at(id)));

const mono = (s: Scene, t: string, x: number, y: number, k: Ink, size = 3.6, align: CanvasTextAlign = 'center', weight = 600) =>
  s.text(t, x, y, { size, font: 'mono', weight, align, color: s.c(k), halo: true });

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

// ---- linear scores' picture: two features, cats low and ships high, and the border where their scores tie

const CATS: [number, number][] = [[0.8, 1.6], [1.4, 0.9], [1.1, 1.3], [1.15, 1.45], [0.7, 0.9], [0.6, 1.95], [1, 1]];
const SHIPS: [number, number][] = [[1.8, 3.3], [2.5, 3.9], [2.3, 3.6], [2.7, 3.4], [1.6, 3.8], [2.4, 3.1], [2, 4]];
/** Cat's row and ship's row, and their biases: at x = (2, 1) the scores are 1.0 and 1.85, so p = (0.3, 0.7). */
const W = [
  [-2, -1],
  [0.5, 1],
];
const B = [6, -0.15];
const NUDGE = 0.5;

/** The feature plane, square, at the top of the stage with room for a panel under it. */
function plane(s: Scene): Frame {
  const side = Math.min(s.w - 20 * s.u, s.h * 0.62);
  const l = s.w / 2 - side / 2;
  const t = s.h * 0.04;
  return new Frame(s, l, t, l + side, t + side, [-0.5, 4.5], [-0.5, 4.5]);
}

/** Cat's score minus ship's as a·x₀ + c·x₁ + e, with cat's row and bias nudged. */
function gap(n: { w00?: number; w01?: number; b0?: number } = {}) {
  return { a: W[0]![0]! + (n.w00 ?? 0) - W[1]![0]!, c: W[0]![1]! + (n.w01 ?? 0) - W[1]![1]!, e: B[0]! + (n.b0 ?? 0) - B[1]! };
}
type Gap = ReturnType<typeof gap>;

/** The window, cut down to where a·x₀ + c·x₁ + e has the sign `sgn`: a convex polygon. */
function side(g: Gap, sgn: 1 | -1): [number, number][] {
  const sq: [number, number][] = [[-0.5, -0.5], [4.5, -0.5], [4.5, 4.5], [-0.5, 4.5]];
  const v = (p: [number, number]) => sgn * (g.a * p[0] + g.c * p[1] + g.e);
  const out: [number, number][] = [];
  sq.forEach((p, i) => {
    const q = sq[(i + 1) % 4]!;
    const [vp, vq] = [v(p), v(q)];
    if (vp >= 0) out.push(p);
    if (vp >= 0 !== vq >= 0) {
      const t = vp / (vp - vq);
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  });
  return out;
}

function fillPoly(s: Scene, F: Frame, poly: [number, number][], k: Color, a: number) {
  if (poly.length < 3) return;
  const g = s.ctx;
  g.beginPath();
  poly.forEach(([x0, x1], i) => (i ? g.lineTo(F.X(x0), F.Y(x1)) : g.moveTo(F.X(x0), F.Y(x1))));
  g.closePath();
  g.fillStyle = s.tint(k, a);
  g.fill();
}

/** The border a·x₀ + c·x₁ + e = 0 across the window. */
function border(F: Frame, g: Gap, k: Ink, width = 0.7, dash?: number[]) {
  const len = Math.hypot(g.a, g.c);
  const [nx, ny] = [g.a / len, g.c / len];
  const d = -g.e / len;
  const p0 = [nx * d, ny * d];
  F.clip(() => F.seg(p0[0]! - ny * 12, p0[1]! + nx * 12, p0[0]! + ny * 12, p0[1]! - nx * 12, k, width, dash));
}

/** The plane with its points, the two regions and the border for nudged weights `n`. */
function scene(s: Scene, F: Frame, o: { regions: number; n?: { w00?: number; w01?: number; b0?: number }; ghost?: number; pts?: number; x?: number; ring?: number; ringK?: Color }) {
  const u = s.u;
  const g = gap(o.n);
  s.alpha(o.regions, () => F.clip(() => {
    fillPoly(s, F, side(g, 1), 'gold', 0.14);
    fillPoly(s, F, side(g, -1), 'teal', 0.12);
  }));
  s.rrect(F.l, F.t, F.r - F.l, F.b - F.t, 1, { stroke: s.c('--axis'), lw: 0.3 });
  F.axes();
  const ax = { size: 3.2, font: 'mono', weight: 600, color: s.c('orange'), halo: true } as const;
  s.text('x₀: blue →', F.X(0) + 2 * u, F.Y(0) + 3.2 * u, { ...ax, align: 'left' });
  s.text('x₁: edges ↑', F.X(0) + 2 * u, F.t + 3.5 * u, { ...ax, align: 'left' });
  s.alpha(o.ghost ?? 0, () => border(F, gap(), '--ink-3', 0.45, [1.2, 1.2]));
  s.alpha(o.regions, () => border(F, g, 'purple', 0.7));
  const pts = o.pts ?? 1;
  CATS.forEach(([a, b], i) => s.alpha(Math.min(1, pts * 2 - i * 0.12), () => F.dot(a, b, 'gold', 1.25)));
  SHIPS.forEach(([a, b], i) => s.alpha(Math.min(1, pts * 2 - 0.8 - i * 0.12), () => F.dot(a, b, 'teal', 1.25)));
  s.alpha(pts, () => {
    s.text('cats', F.X(0.25), F.Y(0.4), { size: 3.4, font: 'mono', weight: 650, color: s.c('gold'), halo: true });
    s.text('ships', F.X(3.45), F.Y(3.6), { size: 3.4, font: 'mono', weight: 650, color: s.c('teal'), halo: true });
  });
  s.alpha(o.x ?? 1, () => {
    if (o.ring) s.alpha(o.ring, () => s.circle(F.X(X[0]!), F.Y(X[1]!), 3.4 * u, { stroke: s.c(o.ringK ?? 'red'), lw: 0.45 }));
    F.dot(X[0]!, X[1]!, 'orange', 1.9);
    s.text('x', F.X(X[0]!) + 3.2 * u, F.Y(X[1]!) + 2.8 * u, { size: 3.8, font: 'mono', weight: 700, color: s.c('orange'), halo: true });
  });
}

// ---- scene 1: the question

const S = [1.0, 1.85];
const P = [0.3, 0.7];

const ask: SceneDef = {
  draw(s) {
    const F = plane(s);
    const u = s.u;
    scene(s, F, { regions: s.ease('border', 0.8, 1), pts: s.ease('plane', 1.2), x: s.ease('plane', 0.6, 3), ring: s.win('wrong', 'label') });
    s.alpha(s.ease('ask', 0.6, 2.2), () => {
      mono(s, 'dW = ?', F.X(3.6), F.Y(0.9), 'blue', 3.8);
      mono(s, 'db = ?', F.X(3.6), F.Y(0.2), 'green', 3.8);
    });
    // The table under the plane: one column per class.
    const xs = columns(s, 2, 24);
    const lx = xs[0]! - 13 * u;
    const top = F.b + 4 * u;
    const ry = [F.b + 11 * u, F.b + 18.5 * u, F.b + 26 * u];
    const o = { w: 13, h: 6.6, size: 3.4 };
    s.alpha(s.ease('border', 0.6, 1), () => {
      mono(s, 'cat', xs[0]!, top, 'gold', 3.4);
      mono(s, 'ship', xs[1]!, top, 'teal', 3.4);
      mono(s, 's', lx, ry[0]!, 'purple', 3.8, 'right', 650);
      cells(s, xs, ry[0]!, S.map((v) => v.toFixed(2).replace(/0$/, '')), 'purple', o);
    });
    s.alpha(s.ease('label', 0.6, 0.8), () => {
      s.rrect(xs[0]! - 4.5 * u, top - 2.4 * u, 9 * u, 4.8 * u, 1.2, { stroke: s.c('gold'), lw: 0.35 });
      mono(s, 'y', xs[0]! - 7 * u, top, 'gold', 3.6, 'right', 700);
    });
    s.alpha(s.ease('wrong', 0.6, 2.4), () => {
      mono(s, 'p', lx, ry[1]!, 'teal', 3.8, 'right', 650);
      cells(s, xs, ry[1]!, P.map(String), 'teal', { ...o, on: [s.win('wrong', 'label'), s.win('wrong', 'label')] });
    });
    s.alpha(s.ease('ds', 0.6, 1.5), () => {
      mono(s, 'ds', lx, ry[2]!, 'red', 3.8, 'right', 650);
      cells(s, xs, ry[2]!, DS.map(fm), 'red', { ...o, on: [s.win('ds', 'ask'), s.win('ds', 'ask')] });
    });
    // Which way each score should go: against its entry of ds.
    s.alpha(s.win('error', 'ask') * after(s, 'error', 0.55), () => {
      const ax = (x: number, up: boolean, k: Color) => s.arrow(x + 8.6 * u, ry[0]! + (up ? 2.6 : -2.6) * u, x + 8.6 * u, ry[0]! + (up ? -2.6 : 2.6) * u, s.c(k), 0.55, 2);
      ax(xs[0]!, true, 'green');
      ax(xs[1]!, false, 'red');
    });
  },
};

// ---- scene 2: nudge one weight of cat's row

/** The size of each nudge on screen: one weight at a time, each undone before the next. */
function nudges(s: Scene) {
  return {
    w00: NUDGE * after(s, 'w00', 0.6, 0.9) * (1 - s.ease('w01', 0.6)),
    w01: NUDGE * after(s, 'w01', 0.35, 0.9) * (1 - s.ease('b0', 0.6)),
    b0: NUDGE * after(s, 'b0', 0.35, 0.9),
  };
}

const nudge: SceneDef = {
  marks: {
    row: { tex: String.raw`\syms_0 = \symW_{0,0}\,\symx_0 + \symW_{0,1}\,\symx_1 + \symb_0`, x: 0.5, y: 0.72, size: 4.2 },
    g00: { tex: String.raw`\partial \symL / \partial \symW_{0,0} = d\syms_0\,\symx_0 = -0.7 \times 2 = -1.4`, x: 0.5, y: 0.9, size: 4 },
    g01: { tex: String.raw`\partial \symL / \partial \symW_{0,1} = d\syms_0\,\symx_1 = -0.7 \times 1 = -0.7`, x: 0.5, y: 0.9, size: 4 },
    b0: { tex: String.raw`\partial \symL / \partial \symb_0 = d\syms_0 = -0.7`, x: 0.5, y: 0.9, size: 4 },
  },
  draw(s) {
    const F = plane(s);
    const n = nudges(s);
    const moved = Math.max(n.w00, n.w01, n.b0) / NUDGE;
    scene(s, F, { regions: 1, n, ghost: moved, ring: s.win('twice', 'g00'), ringK: 'green' });
    s.show('row', 1);
    // What the nudge did to cat's score.
    const ry = s.h * 0.81;
    const s0 = S[0]! + n.w00 * X[0]! + n.w01 * X[1]! + n.b0;
    const line = (knob: string, k: Color, a: number) =>
      s.alpha(a, () => rich(s, [[`${knob} + 0.5`, k], ['  →  ', '--ink-3'], [`s₀: 1.0 → ${s0.toFixed(1)}`, 'purple']], s.w / 2, ry, { size: 3.6, weight: 600 }));
    line('W₀₀', 'blue', s.win('w00', 'w01'));
    line('W₀₁', 'blue', s.win('w01', 'b0'));
    line('b₀', 'green', s.ease('b0', 0.6));
    s.alpha(s.win('row', 'w00'), () => caption(s, 'cat\'s row, cat\'s bias: cat\'s score', ry, 'purple', 3.4));
    s.show('g00', s.win('g00', 'w01') * after(s, 'g00', 0.45));
    s.show('g01', s.win('g01', 'b0'));
    s.show('b0', lateIn(s, 'b0', 0.6));
  },
};

// ---- scene 3: every weight at once

/** x across the top, ds down the side, the dW grid between them and db at the right. */
function table(s: Scene) {
  const xs = columns(s, 2, s.tall ? 22 : 20).map((x) => x + (s.tall ? 3 : 0) * s.u);
  return { xs, left: xs[0]! - (s.tall ? 24 : 22) * s.u, right: xs[1]! + (s.tall ? 24 : 22) * s.u, top: s.h * 0.14, ry: [s.h * 0.38, s.h * 0.57] };
}

const grid: SceneDef = {
  marks: {
    rule: { tex: String.raw`\dfrac{\partial \symL}{\partial \symW_{i,j}} = d\syms_i\,\symx_j`, x: 0.5, y: 0.77, size: 4.8 },
  },
  draw(s) {
    const { xs, left, right, top, ry } = table(s);
    const fill = [
      [s.ease('row0', 0.6, 1.2), s.ease('row0', 0.6, 1.5)],
      [lateIn(s, 'row1', 0.55), lateIn(s, 'row1', 0.7)],
    ];
    const rowOn = (i: number) => (i === 0 ? s.win('row0', 'row1') : s.win('row1', 'rule'));
    mono(s, 'x', left, top, 'orange', 4, 'center', 650);
    cells(s, xs, top, X.map(String), 'orange', { on: xs.map(() => Math.max(rowOn(0), rowOn(1))) });
    ['blue', 'edges'].forEach((t, j) => s.text(t, xs[j]!, top - 6.4 * s.u, { size: 2.9, font: 'mono', color: s.c('--ink-3') }));
    mono(s, 'ds', left, ry[0]! - 9 * s.u, 'red', 3.6, 'center', 650);
    ry.forEach((y, i) => {
      cells(s, [left], y, [fm(DS[i]!)], 'red', { w: 13, on: [rowOn(i)] });
      s.text(['cat', 'ship'][i]!, left - 8.5 * s.u, y, { size: 2.9, font: 'mono', align: 'right', color: s.c(i ? 'teal' : 'gold') });
    });
    mono(s, '∂L/∂W', (xs[0]! + xs[1]!) / 2, ry[0]! - 9 * s.u, 'red', 3.4, 'center', 650);
    ry.forEach((y, i) =>
      xs.forEach((x, j) => {
        const a = fill[i]![j]!;
        cells(s, [x], y, [a > 0.4 ? fm(DS[i]! * X[j]!) : ''], 'red', { on: [Math.max(rowOn(i), 0.3 * a)] });
      }),
    );
    s.show('rule', s.ease('rule', 0.6));
    s.alpha(s.ease('db', 0.6), () => {
      mono(s, 'db', right, ry[0]! - 9 * s.u, 'green', 3.6, 'center', 650);
      ry.forEach((y, i) => cells(s, [right], y, [fm(DS[i]!)], 'green', { w: 13, on: [s.win('db', 'widrow')] }));
    });
    const [ya, yb] = [s.h * 0.875, s.h * 0.94];
    s.alpha(s.win('outer', 'db'), () => {
      caption(s, 'inner (dot): matched pairs → one number', ya, '--ink-2', 3.3);
      caption(s, 'outer: every pair, kept → a grid', yb, 'red', 3.3);
    });
    s.alpha(s.win('db', 'widrow'), () => caption(s, 'a bias\'s input is always 1: db = ds', ya, 'green', 3.3));
    s.alpha(s.ease('widrow', 0.6), () => caption(s, 'Adaline: adaptive linear, 1960', ya, '--ink-2', 3.3));
    s.alpha(s.ease('measure', 0.6), () => caption(s, 'each weight: error × its input', yb, 'red', 3.3));
    cite(s, 'Widrow & Hoff, 1960', s.ease('widrow', 0.6));
  },
};

// ---- scene 4: the worked problem, the givens of the practice's dW-entry question

const TW = [
  [2, 0],
  [-1, 1],
];
const TX = [1, 3];
const TP = [0.2, 0.8];
const TY = 0;
const TDS = TP.map((p, i) => Math.round((p - (i === TY ? 1 : 0)) * 100) / 100);

const tryIt: SceneDef = {
  marks: {
    g1: { tex: String.raw`\symW = \begin{bmatrix} 2 & 0 \\ -1 & 1 \end{bmatrix},\quad \symx = [1,\ 3],\quad \symy = 0`, x: 0.5, y: 0.1, size: 4.4 },
    g2: { tex: String.raw`\symp = [0.2,\ 0.8]`, x: 0.5, y: 0.22, size: 4.4 },
    q1: { tex: String.raw`\partial \symL / \partial \symW_{0,1} = \,?`, x: 0.5, y: 0.31, size: 4.4 },
    ds: { tex: String.raw`d\syms = \symp - \mathrm{onehot}(\symy) = [0.2,\ 0.8] - [1,\ 0] = [-0.8,\ 0.8]`, x: 0.5, y: 0.75, size: 4 },
    dw: { tex: String.raw`\dfrac{\partial \symL}{\partial \symW_{0,1}} = d\syms_0\,\symx_1 = (-0.8) \times 3 = -2.4`, x: 0.5, y: 0.86, size: 4.2 },
  },
  draw(s) {
    s.show('g1', s.ease('p1', 0.6));
    s.show('g2', s.ease('p1', 0.6, 0.3));
    s.show('q1', lateIn(s, 'p1', 0.8));
    s.show('ds', lateIn(s, 'ds', 0.6));
    s.show('dw', lateIn(s, 'dw', 0.75));
    const xs = columns(s, 2, s.tall ? 20 : 18).map((x) => x + (s.tall ? 4 : 0) * s.u);
    const left = xs[0]! - (s.tall ? 22 : 20) * s.u;
    const ry = [s.h * 0.53, s.h * 0.64];
    const top = s.h * 0.42;
    // ds down the side, filled once the score gradient is worked.
    const dsA = lateIn(s, 'ds', 0.7);
    s.alpha(s.ease('ds', 0.6), () => {
      ry.forEach((y, i) => cells(s, [left], y, [dsA > 0.4 ? fm(TDS[i]!) : '?'], 'red', { w: 13, h: 8, on: [i === 0 ? s.win('dw', 'own') : 0] }));
      mono(s, 'ds', left - 10 * s.u, (ry[0]! + ry[1]!) / 2, 'red', 3.6, 'right', 650);
    });
    // W with x across the top; W[0,1] is the asked weight.
    s.alpha(lateIn(s, 'p1', 0.8), () => {
      const hit = s.win('dw', 'own');
      cells(s, xs, top, TX.map(String), 'orange', { w: 12, h: 7, on: [0, hit] });
      mono(s, 'x', xs[1]! + 9 * s.u, top, 'orange', 3.8, 'left', 650);
      ry.forEach((y, i) =>
        xs.forEach((x, j) => {
          const it = i === 0 && j === 1;
          cells(s, [x], y, [fm(TW[i]![j]!)], 'blue', { w: 12, h: 8, on: [it ? 0.4 + 0.6 * s.ease('dw', 0.6) : 0] });
        }),
      );
      mono(s, 'W', xs[1]! + 9 * s.u, (ry[0]! + ry[1]!) / 2, 'blue', 3.8, 'left', 650);
    });
    // The weight's own value never enters its gradient.
    s.alpha(s.ease('own', 0.6), () => {
      const w = 12 * s.u;
      const h = 8 * s.u;
      s.line(xs[1]! - w / 2, ry[0]! + h / 2, xs[1]! + w / 2, ry[0]! - h / 2, s.c('red'), 0.45);
      caption(s, 'W₀₁ itself never enters', s.h * 0.95, 'red', 3.4);
    });
  },
};

export const scenes: Record<string, SceneDef> = { ask, nudge, grid, try: tryIt };

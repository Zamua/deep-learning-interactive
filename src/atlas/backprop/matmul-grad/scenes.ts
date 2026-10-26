import type { Scene, SceneDef } from '../../../lecture/scene';
import { after, beside, gate, type Ink, mono, pulse, runAfter, wire } from '../draw';

// The running example: z = W x, with the gradient dz arriving from above.
const W = [
  [1, 2, -1],
  [3, 1, 2],
];
const X = [3, 4, 1];
const Z = W.map((r) => r.reduce((a, w, j) => a + w * X[j]!, 0));
const DZ = [2, -1];
const DW = DZ.map((g) => X.map((x) => g * x));
const DX = X.map((_, j) => W.reduce((a, r, i) => a + r[j]! * DZ[i]!, 0));
// The worked problems at the end.
const DZ2 = [3, -1];
const W2 = [
  [1, 4],
  [2, -3],
];
const DX2 = [0, 1].map((j) => W2.reduce((a, r, i) => a + r[j]! * DZ2[i]!, 0));

const fmt = (v: number) => (v < 0 ? `−${-v}` : String(v));
const par = (v: number) => (v < 0 ? `(${fmt(v)})` : fmt(v));

const CW = 9;
const CH = 7.6;

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  cx: (j: number) => number;
  cy: (i: number) => number;
}

/** A rows by cols grid of cells centered on (cx, cy); `on(i, j)` lights a cell, `a(i, j)` fades its label. */
function grid(s: Scene, cx: number, cy: number, rows: number, cols: number, labels: (i: number, j: number) => string, k: Ink, on: (i: number, j: number) => number = () => 0, scale = 1): Box {
  const cw = CW * scale * s.u;
  const ch = CH * scale * s.u;
  const x0 = cx - (cols * cw) / 2;
  const y0 = cy - (rows * ch) / 2;
  const pad = 0.5 * s.u;
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) s.cell(x0 + j * cw + pad, y0 + i * ch + pad, cw - 2 * pad, ch - 2 * pad, labels(i, j), k, { on: on(i, j), size: 3.6 * scale });
  return { x0, y0, x1: x0 + cols * cw, y1: y0 + rows * ch, cx: (j) => x0 + (j + 0.5) * cw, cy: (i) => y0 + (i + 0.5) * ch };
}

const label = (s: Scene, t: string, x: number, y: number, k: Ink, align: CanvasTextAlign = 'center', size = 3.6) => s.text(t, x, y, { size, font: 'mono', weight: 650, align, color: s.c(k), halo: true });
const red = (s: Scene, t: string, at: [number, number], size = 3.8, align: CanvasTextAlign = 'center') => s.text(t, at[0], at[1], { size, font: 'mono', weight: 700, align, color: s.c('red'), halo: true });
const Y = (s: Scene, v: number) => (v / 100) * s.h;

/** Text whose `_digits` are drawn as subscripts, since the mono font has no good subscript glyphs: `W_01 = 2`. */
function rich(s: Scene, t: string, x: number, y: number, k: Ink, align: CanvasTextAlign = 'center', size = 3.6, italic = false): void {
  const parts = t.split(/_(\w+)/);
  const opt = (small: boolean) => ({ size: small ? size * 0.68 : size, font: italic ? ('serif' as const) : ('mono' as const), weight: italic ? 550 : 650, italic, align: 'left' as const, color: s.c(k), halo: true });
  const ws = parts.map((p, i) => s.measure(p, opt(i % 2 === 1)));
  const total = ws.reduce((a, b) => a + b, 0);
  let at = align === 'left' ? x : align === 'right' ? x - total : x - total / 2;
  parts.forEach((p, i) => {
    s.text(p, at, y + (i % 2 ? size * 0.32 * s.u : 0), opt(i % 2 === 1));
    at += ws[i]!;
  });
}

const R = 4.2;
const K = 1.15;

// ---- scene 1: the gradient on x

/** W x = z and the gradient on z across the top; the weights' gradient, dz xᵀ, below. */
function node(s: Scene): void {
  const cx = s.w / 2;
  const y = Y(s, 22);
  const sc = 0.86;
  const bW = grid(s, cx - 23 * s.u, y, 2, 3, (i, j) => fmt(W[i]![j]!), 'blue', () => 0, sc);
  const bx = grid(s, cx - 5 * s.u, y, 3, 1, (i) => fmt(X[i]!), 'orange', () => 0.2, sc);
  label(s, '=', cx + 3 * s.u, y, '--ink-2', 'center', 4);
  const bz = grid(s, cx + 11 * s.u, y, 2, 1, (i) => fmt(Z[i]!), '--ink-2', () => 0, sc);
  const b = grid(s, cx + 26 * s.u, y, 2, 1, (i) => fmt(DZ[i]!), 'red', () => 0.25, sc);
  const ly = bx.y0 - 3 * s.u;
  label(s, 'W', (bW.x0 + bW.x1) / 2, ly, 'blue');
  label(s, 'x', bx.cx(0), ly, 'orange');
  label(s, 'z', bz.cx(0), ly, '--ink-2');
  label(s, '∂f/∂z', b.cx(0), ly, 'red', 'center', 3.2);
  label(s, 'dz', b.x1 + 1.6 * s.u, (b.y0 + b.y1) / 2, 'red', 'left', 3.2);
  s.alpha(after(s, 'node', 0.55), () => {
    const g = grid(s, cx, Y(s, 68), 2, 3, (i, j) => fmt(DW[i]![j]!), 'red', () => 0.35, sc);
    label(s, '∂f/∂W', (g.x0 + g.x1) / 2, g.y1 + 3.6 * s.u, 'red', 'center', 3.4);
  });
}

/** Where x1's two multiplies sit, one on the way to each entry of z. */
function at3(s: Scene) {
  const cx = s.w / 2;
  const k = s.tall ? 1 : 1.3;
  return {
    xi: cx - 30 * k * s.u,
    xm: cx - 4 * k * s.u,
    xa: cx + 17 * k * s.u,
    xo: cx + 35 * k * s.u,
    yx: Y(s, 32),
    yw: [Y(s, 8), Y(s, 56)],
    ym: [Y(s, 19), Y(s, 45)],
  };
}

function fork(s: Scene): void {
  const g = at3(s);
  const xg = (i: number, side: 1 | -1): [number, number] => beside(s, g.xi, g.yx, g.xm, g.ym[i]!, 0.7, side, 3.8, 0, R);
  rich(s, `x_1 = ${fmt(X[1]!)}`, g.xi - 1.6 * s.u, g.yx, 'orange', 'right', 3.6);
  for (const i of [0, 1]) {
    const hot = s.win('sum', 'col') * (i === 0 ? after(s, 'sum', 0.05) : after(s, 'sum', 0.3));
    wire(s, g.xi, g.yx, g.xm, g.ym[i]!, { r1: R, hot });
    wire(s, g.xi, g.yw[i]!, g.xm, g.ym[i]!, { r1: R });
    rich(s, `W_${i}1 = ${fmt(W[i]![1]!)}`, g.xi - 1.6 * s.u, g.yw[i]!, 'blue', 'right', 3.6);
    wire(s, g.xm, g.ym[i]!, g.xa, g.ym[i]!, { r0: R, r1: 4, grad: fmt(DZ[i]!), ga: 1, size: 3.8, t: 0.4 });
    // The add's other inputs: the rest of row i's products.
    for (const dy of [-1, 1]) s.line(g.xa - 4 * s.u, g.ym[i]! + dy * 9.5 * s.u, g.xa - 1.6 * s.u, g.ym[i]! + dy * 4.6 * s.u, s.tint('--ink-3', 0.6), 0.3, [0.8, 0.8]);
    wire(s, g.xa, g.ym[i]!, g.xo, g.ym[i]!, { r0: 4, grad: fmt(DZ[i]!), ga: 1, size: 3.8 });
    gate(s, g.xa, g.ym[i]!, '+', '--ink-2', 0, 4);
    gate(s, g.xm, g.ym[i]!, '×', '--ink-2', hot, R);
    rich(s, `z_${i}`, g.xo + 1.6 * s.u, g.ym[i]!, '--ink-2', 'left', 4.8, true);
    // The swap: x1 gets W_i1 times the gradient on z_i.
    const t = runAfter(s, 'sum', i === 0 ? 0.05 : 0.3, 0.9);
    pulse(s, g.xm, g.ym[i]!, g.xi, g.yx, t, 'red');
    s.alpha(after(s, 'sum', i === 0 ? 0.2 : 0.42), () => red(s, `${fmt(W[i]![1]!)}·${par(DZ[i]!)}`, xg(i, i === 0 ? 1 : -1), 3.8, 'right'));
  }
  s.alpha(after(s, 'sum', 0.62), () => rich(s, `∂f/∂x_1 = ${fmt(W[0]![1]! * DZ[0]!)} + ${par(W[1]![1]! * DZ[1]!)} = ${fmt(DX[1]!)}`, s.w / 2, Y(s, 70), 'red', 'center', 3.8));
}

const input: SceneDef = {
  marks: {
    dw: { tex: String.raw`\frac{\partial f}{\partial \symW} = \frac{\partial f}{\partial z}\,\symx^{\top}`, x: 0.5, y: 0.48, size: 5 },
    col: { tex: String.raw`\frac{\partial f}{\partial \symx_j} = \sum_i \frac{\partial f}{\partial z_i}\,\symW_{ij}`, x: 0.5, y: 0.13, size: 5.2 },
    wt: { tex: String.raw`\frac{\partial f}{\partial \symx} = \symW^{\top} \frac{\partial f}{\partial z}`, x: 0.5, y: 0.13, size: 5.4 },
  },
  draw(s) {
    const was = 1 - s.ease('feeds', 0.5);
    s.alpha(s.ease('node', 0.6) * was, () => node(s));
    s.show('dw', after(s, 'node', 0.5) * was);
    const gone = s.ease('col', 0.6);
    s.alpha((1 - gone) * s.ease('feeds', 0.6, 0.3), () => fork(s));
    s.show('col', s.ease('col', 0.6, 0.3) * (1 - s.ease('wt', 0.5)));
    s.show('wt', s.ease('wt', 0.6, 0.4));
    const cx = s.w / 2 + 4 * s.u;
    // Column j of W, dotted with dz, lands in dx_j.
    s.alpha(s.ease('col', 0.6, 0.3) * (1 - s.ease('wt', 0.6)), () => {
      const order = [1, 0, 2];
      const shown = (j: number) => after(s, 'col', [0.05, 0.6, 0.85][order.indexOf(j)]!, 0.4);
      const hot = (j: number) => shown(j) * (1 - after(s, 'col', [0.55, 0.82, 1.2][order.indexOf(j)]!, 0.4));
      const w = grid(s, cx, Y(s, 40), 2, 3, (i, j) => fmt(W[i]![j]!), 'blue', (_, j) => hot(j) * 0.9);
      const c = grid(s, w.x0 - 7.5 * s.u, Y(s, 40), 2, 1, (i) => fmt(DZ[i]!), 'red', () => 0.3);
      label(s, '∂f/∂z', c.x0 - 1.6 * s.u, c.cy(0), 'red', 'right', 3.2);
      label(s, 'W', w.x1 + 1.6 * s.u, w.cy(0), 'blue', 'left', 3.6);
      const dy = Y(s, 62);
      for (let j = 0; j < 3; j++) {
        s.alpha(shown(j), () => {
          s.arrow(w.cx(j), w.y1 + 0.6 * s.u, w.cx(j), dy - 4.4 * s.u, s.c('--ink-3'), 0.3, 1.6);
          s.cell(w.cx(j) - (CW / 2 - 0.5) * s.u, dy - (CH / 2 - 0.5) * s.u, (CW - 1) * s.u, (CH - 1) * s.u, fmt(DX[j]!), 'red', { on: 0.35 + 0.6 * hot(j), size: 3.6 });
          const terms = W.map((r, i) => `${par(r[j]!)}·${par(DZ[i]!)}`).join(' + ');
          rich(s, `∂f/∂x_${j} = ${terms} = ${fmt(DX[j]!)}`, s.w / 2, Y(s, 74 + 7 * j), j === 1 ? '--ink-2' : 'red', 'center', 3.4);
        });
      }
      s.alpha(shown(1), () => label(s, '∂f/∂x', w.x1 + 1.6 * s.u, dy, 'red', 'left', 3.4));
    });
    // The same numbers as W transpose times dz.
    s.alpha(s.ease('wt', 0.6, 0.4), () => {
      const y = Y(s, 46);
      const t = grid(s, cx - 20 * s.u, y, 3, 2, (i, j) => fmt(W[j]![i]!), 'blue', (i) => (i === 1 ? after(s, 'wt', 0.15) : 0) * 0.8, K);
      const d = grid(s, cx + 1 * s.u, y, 2, 1, (i) => fmt(DZ[i]!), 'red', () => 0.3, K);
      label(s, '=', cx + 10 * s.u, y, '--ink-2', 'center', 4.4);
      const o = grid(s, cx + 19 * s.u, y, 3, 1, (i) => fmt(DX[i]!), 'red', (i) => 0.35 + (i === 1 ? 0.6 * after(s, 'wt', 0.15) : 0), K);
      label(s, 'Wᵀ', (t.x0 + t.x1) / 2, t.y0 - 3.4 * s.u, 'blue', 'center', 3.6);
      label(s, '∂f/∂z', d.cx(0), t.y0 - 3.4 * s.u, 'red', 'center', 3.2);
      label(s, '∂f/∂x', o.cx(0), t.y0 - 3.4 * s.u, 'red', 'center', 3.2);
      s.alpha(after(s, 'wt', 0.6), () => {
        mono(s, '(3, 2)', (t.x0 + t.x1) / 2, t.y1 + 3.6 * s.u, '--ink-2', 3.2);
        mono(s, '(2,)', d.cx(0), t.y1 + 3.6 * s.u, '--ink-2', 3.2);
        mono(s, '(3,)', o.cx(0), t.y1 + 3.6 * s.u, '--ink-2', 3.2);
      });
      s.alpha(after(s, 'wt', 0.8), () => mono(s, '(3, 2) @ (2,) → (3,), like x', s.w / 2, Y(s, 84), '--ink', 3.6, 'center', 600));
    });
  },
};

// ---- scene 2: the shape check, then two worked problems on one W

const tryIt: SceneDef = {
  marks: {
    aidW: { tex: String.raw`\frac{\partial f}{\partial \symW} = \frac{\partial f}{\partial z}\,\symx^{\top}\!:\ (2, 1)(1, 3) \to (2, 3)`, x: 0.5, y: 0.36, size: 4.6 },
    aidX: { tex: String.raw`\frac{\partial f}{\partial \symx} = \symW^{\top} \frac{\partial f}{\partial z}\!:\ (3, 2)(2,) \to (3,)`, x: 0.5, y: 0.6, size: 4.6 },
    p: { tex: String.raw`\symW = \begin{bmatrix} 1 & 4 \\ 2 & -3 \end{bmatrix},\quad \frac{\partial f}{\partial z} = [3,\ -1]`, x: 0.5, y: 0.13, size: 4.6 },
    q1: { tex: String.raw`\text{entry } 1 \text{ of } \frac{\partial f}{\partial \symx}\,?`, x: 0.5, y: 0.27, size: 4.6 },
    q2: { tex: String.raw`\frac{\partial f}{\partial \symx}\,?`, x: 0.5, y: 0.27, size: 4.6 },
  },
  draw(s) {
    const aid = 1 - s.ease('p1', 0.5);
    s.show('aidW', s.ease('aid', 0.6) * aid);
    s.show('aidX', s.ease('aid', 0.6, 0.6) * aid);
    const on = s.ease('p1', 0.6, 0.3);
    s.show('p', on);
    s.show('q1', on * after(s, 'p1', 0.7) * (1 - s.ease('p2', 0.4)));
    s.show('q2', s.ease('p2', 0.5, 0.3));
    const cx = s.w / 2 + 3 * s.u;
    const ix = (t: string, x: number, y: number, hot = 0) => s.text(t, x, y, { size: 2.8, font: 'mono', weight: hot > 0.5 ? 650 : 400, color: hot > 0.5 ? s.c('--ink') : s.c('--ink-3') });
    // Each column of W dotted with dz: column 1 first, then column 0.
    s.alpha(on, () => {
      const cy = Y(s, 50);
      const colA = (j: number) => (j === 1 ? after(s, 'a1', 0.3) : after(s, 'a2', 0.35));
      const colHot = (j: number) => colA(j) * (1 - (j === 1 ? after(s, 'p2', 0.1) : 0));
      const w = grid(s, cx, cy, 2, 2, (i, j) => fmt(W2[i]![j]!), 'blue', (_, j) => colHot(j) * 0.9, K);
      const c = grid(s, w.x0 - 8.2 * s.u, cy, 2, 1, (i) => fmt(DZ2[i]!), 'red', () => 0.25, K);
      label(s, '∂f/∂z', c.x0 - 1.6 * s.u, c.cy(0), 'red', 'right', 3.2);
      label(s, 'W', w.x1 + 1.8 * s.u, w.cy(0), 'blue', 'left', 3.8);
      for (let j = 0; j < 2; j++) ix(`col ${j}`, w.cx(j), w.y0 - 2.6 * s.u, colHot(j));
      const dy = w.y1 + 9 * s.u;
      s.alpha(after(s, 'p1', 0.7), () => {
        for (let j = 0; j < 2; j++) {
          const a = colA(j);
          s.arrow(w.cx(j), w.y1 + 0.6 * s.u, w.cx(j), dy - 5 * s.u, s.tint('--ink-3', 0.4 + 0.6 * a), 0.3, 1.6);
          s.cell(w.cx(j) - ((CW * K) / 2 - 0.5) * s.u, dy - ((CH * K) / 2 - 0.5) * s.u, (CW * K - 1) * s.u, (CH * K - 1) * s.u, a > 0.5 ? fmt(DX2[j]!) : '?', 'red', { on: 0.2 + 0.7 * colHot(j), size: 3.6 * K });
          s.alpha(a, () => mono(s, `${W2.map((r, i) => `${par(r[j]!)}·${par(DZ2[i]!)}`).join(' + ')} = ${fmt(DX2[j]!)}`, s.w / 2, Y(s, 84 + 7 * j), 'red', 3.6, 'center', 600));
        }
        label(s, '∂f/∂x', w.x1 + 1.8 * s.u, dy, 'red', 'left', 3.4);
      });
    });
  },
};

export const scenes: Record<string, SceneDef> = { input, try: tryIt };

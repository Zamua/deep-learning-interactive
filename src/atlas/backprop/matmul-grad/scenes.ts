import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { lerp, smooth } from '../../../lecture/scene';
import { after } from '../../draw';
import { beside, gate, mono, name, pulse, runAfter, wire } from '../draw';

// The running example: z = W x, with the gradient dz arriving from above.
const W = [
  [1, 2, -1],
  [3, 1, 2],
];
const X = [3, 4, 1];
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

/** A rows by cols grid of cells centered on (cx, cy); `on(i, j)` lights a cell. */
function grid(s: Scene, cx: number, cy: number, rows: number, cols: number, labels: (i: number, j: number) => string, k: Ink, on: (i: number, j: number) => number = () => 0, scale = 1): Box {
  const cw = CW * scale * s.u;
  const ch = CH * scale * s.u;
  const x0 = cx - (cols * cw) / 2;
  const y0 = cy - (rows * ch) / 2;
  const pad = 0.5 * s.u;
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) s.cell(x0 + j * cw + pad, y0 + i * ch + pad, cw - 2 * pad, ch - 2 * pad, labels(i, j), k, { on: on(i, j), size: 3.6 * scale });
  return { x0, y0, x1: x0 + cols * cw, y1: y0 + rows * ch, cx: (j) => x0 + (j + 0.5) * cw, cy: (i) => y0 + (i + 0.5) * ch };
}

/** One cell of a grid of the given scale, centered on (x, y). */
function cellAt(s: Scene, x: number, y: number, t: string, k: Ink, on = 0, scale = 1): void {
  const pad = 0.5 * s.u;
  const cw = CW * scale * s.u;
  const ch = CH * scale * s.u;
  s.cell(x - cw / 2 + pad, y - ch / 2 + pad, cw - 2 * pad, ch - 2 * pad, t, k, { on, size: 3.6 * scale });
}

const label = (s: Scene, t: string, x: number, y: number, k: Ink, align: CanvasTextAlign = 'center', size = 3.6) => s.text(t, x, y, { size, font: 'mono', weight: 650, align, color: s.c(k), halo: true });
const red = (s: Scene, t: string, at: [number, number], size = 3.8, align: CanvasTextAlign = 'center') => s.text(t, at[0], at[1], { size, font: 'mono', weight: 700, align, color: s.c('red'), halo: true });
const quiet = (s: Scene, t: string, x: number, y: number) => s.text(t, x, y, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
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

// ---- scene 1: the walk back reaches the node, and must go on past it to x

/** Where the chain sits: the earlier node, the node, the rest of the graph, f. */
function chainAt(s: Scene) {
  const k = s.tall ? 1 : 1.12;
  const cx = s.w / 2;
  return { k, cx, y: Y(s, 28), bx: cx - 40 * k * s.u, gx: cx - 12 * k * s.u, rx: cx + 16 * k * s.u, fx: cx + 38 * k * s.u };
}

function chain(s: Scene): void {
  const c = chainAt(s);
  const { y } = c;
  const hb = 6 * s.u;
  const R = 5;
  // The earlier node, which made x.
  const early = s.ease('x0', 0.6, 0.2);
  s.alpha(early, () => {
    s.rrect(c.bx - hb, y - 8 * s.u, 2 * hb, 16 * s.u, 2.5, { fill: s.tint('--ink-3', 0.08), stroke: s.tint('--ink-3', 0.7), lw: 0.3 });
    s.text('⋯', c.bx, y, { size: 5, weight: 600, color: s.c('--ink-3') });
    quiet(s, 'made x', c.bx, y + 11 * s.u);
  });
  const xHot = s.win('x0', 'dx') * after(s, 'x0', 0.5);
  wire(s, c.bx + hb, y, c.gx, y, { r1: R, hot: xHot, grad: '?', ga: after(s, 'x0', 0.75) * (1 - s.ease('name', 0.4, 2.2)) });
  s.text('x', (c.bx + hb + c.gx - R * s.u) / 2, y - 4.4 * s.u, { size: 4.6, italic: true, weight: 550, color: s.c('orange'), halo: true });
  const rx0 = c.rx - 7 * s.u;
  const rx1 = c.rx + 7 * s.u;
  wire(s, c.gx, y, rx0, y, { r0: R, grad: `[${DZ.map(fmt).join(', ')}]`, ga: after(s, 'dz', 0.45), size: 3.4 });
  s.text('z', (c.gx + R * s.u + rx0) / 2, y - 4.4 * s.u, { size: 4.6, italic: true, weight: 550, color: s.c('--ink-2'), halo: true });
  s.rrect(rx0, y - 9 * s.u, 14 * s.u, 18 * s.u, 2.5, { fill: s.tint('--ink-3', 0.08), stroke: s.tint('--ink-3', 0.7), lw: 0.3 });
  s.text('⋯', c.rx, y, { size: 5, weight: 600, color: s.c('--ink-3') });
  quiet(s, 'the rest', c.rx, y + 12 * s.u);
  quiet(s, 'of the graph', c.rx, y + 15.4 * s.u);
  wire(s, rx1, y, c.fx, y, {});
  name(s, c.fx, y, 'f', 'purple', 'out');
  gate(s, c.gx, y, 'Wx', '--ink-2', s.win('W', 'x0') + 0.6 * s.win('dx', 'name'), R);
  // The forward flow, then the gradient walking back from f to z.
  pulse(s, c.bx + hb, y, c.gx - R * s.u, y, runAfter(s, 'node', 0.15, 0.6), 'orange');
  pulse(s, c.gx + R * s.u, y, rx0, y, runAfter(s, 'node', 0.4, 0.6), 'orange');
  pulse(s, rx1, y, c.fx, y, runAfter(s, 'node', 0.65, 0.5), 'orange');
  pulse(s, c.fx, y, rx1, y, runAfter(s, 'dz', 0.1, 0.5), 'red');
  pulse(s, rx0, y, c.gx + R * s.u, y, runAfter(s, 'dz', 0.3, 0.6), 'red');
  // The walk reaches for x, and stops: nothing to hand back yet.
  pulse(s, c.gx - R * s.u, y, c.bx + hb + 6 * s.u, y, runAfter(s, 'x0', 0.55, 0.9), 'red');
  // Handed back, the walk goes on to the earlier node.
  pulse(s, c.gx - R * s.u, y, c.bx + hb, y, runAfter(s, 'name', 0.72, 0.8), 'red');
}

/** What the node has and owes, in a row: the gradient on x (owed), on W (found), on z (arrived). */
function ledger(s: Scene): void {
  const c = chainAt(s);
  const y = Y(s, 67);
  const sc = 0.8;
  const owe = s.ease('dx', 0.6, 0.3);
  s.alpha(owe, () => {
    const b = grid(s, c.cx - 30 * c.k * s.u, y, 3, 1, () => '?', 'red', () => 0.25 + 0.5 * s.win('dx', 'name'), sc);
    label(s, '∂f/∂x', b.cx(0), b.y0 - 3 * s.u, 'red', 'center', 3.2);
    quiet(s, 'owed', b.cx(0), b.y1 + 3.4 * s.u);
    s.alpha(after(s, 'name', 0.35), () => label(s, 'dx', b.x1 + 1.6 * s.u, y, 'red', 'left', 3.2));
  });
  s.alpha(s.ease('W', 0.6, 0.3), () => {
    const b = grid(s, c.cx - 4 * c.k * s.u, y, 2, 3, (i, j) => fmt(DW[i]![j]!), 'red', () => 0.3, sc);
    label(s, '∂f/∂W', (b.x0 + b.x1) / 2, b.y0 - 3 * s.u, 'red', 'center', 3.2);
    quiet(s, 'found', (b.x0 + b.x1) / 2, b.y1 + 3.4 * s.u);
  });
  s.alpha(after(s, 'dz', 0.55), () => {
    const b = grid(s, c.cx + 22 * c.k * s.u, y, 2, 1, (i) => fmt(DZ[i]!), 'red', () => 0.3, sc);
    label(s, '∂f/∂z', b.cx(0), b.y0 - 3 * s.u, 'red', 'center', 3.2);
    quiet(s, 'arrived', b.cx(0), b.y1 + 3.4 * s.u);
    s.alpha(after(s, 'dz', 0.7), () => label(s, 'dz', b.x1 + 1.6 * s.u, y, 'red', 'left', 3.2));
  });
}

const walk: SceneDef = {
  draw(s) {
    chain(s);
    ledger(s);
    s.alpha(after(s, 'name', 0.3), () => mono(s, 'the input gradient', s.w / 2, Y(s, 91), 'red', 3.4, 'center', 650));
  },
};

// ---- scene 2: one entry of x feeds both outputs, so its gradients add

const SC = 0.86;

/** W x = z with x1 lit, and the row being read lit with its weight in column 1. */
function strip(s: Scene): void {
  const cx = s.w / 2;
  const y = Y(s, 24);
  const r0 = s.win('rows', 'row1');
  const r1 = s.ease('row1', 0.6);
  const rowOn = (i: number) => (i === 0 ? r0 : r1);
  const bW = grid(s, cx - 24 * s.u, y, 2, 3, (i, j) => fmt(W[i]![j]!), 'blue', (i, j) => rowOn(i) * (j === 1 ? 0.95 : 0.3), SC);
  const bx = grid(s, cx - 4 * s.u, y, 3, 1, (i) => fmt(X[i]!), 'orange', (i) => (i === 1 ? s.ease('one', 0.5, 0.3) : 0), SC);
  label(s, '=', cx + 8.5 * s.u, y, '--ink-2', 'center', 4);
  const bz = grid(s, cx + 17 * s.u, y, 2, 1, (i) => String(W[i]!.reduce((a, w, j) => a + w * X[j]!, 0)), '--ink-2', (i) => rowOn(i) * 0.7, SC);
  const ly = bx.y0 - 3 * s.u;
  label(s, 'W', (bW.x0 + bW.x1) / 2, ly, 'blue');
  label(s, 'x', bx.cx(0), ly, 'orange');
  label(s, 'z', bz.cx(0), ly, '--ink-2');
  s.alpha(s.ease('one', 0.5, 0.4), () => rich(s, 'x_1', bx.x1 + 1.4 * s.u, bx.cy(1), 'orange', 'left', 3.4));
  s.alpha(s.ease('rows', 0.5, 0.6), () => mono(s, 'col 1', bW.cx(1), bW.y1 + 2.8 * s.u, '--ink', 2.9, 'center', 650));
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

const R = 4.2;

function fork(s: Scene): void {
  const g = at3(s);
  const xg = (i: number): [number, number] => beside(s, g.xi, g.yx, g.xm, g.ym[i]!, 0.62, i === 0 ? 1 : -1, 3.8, 0, R);
  rich(s, `x_1 = ${fmt(X[1]!)}`, g.xi - 1.6 * s.u, g.yx, 'orange', 'right', 3.6);
  // x1's own value, which its gradient never uses.
  s.alpha(after(s, 'own', 0.2), () => {
    s.rrect(g.xi - 14.6 * s.u, g.yx - 3 * s.u, 13.8 * s.u, 6 * s.u, 1.2, { fill: s.tint('gold', 0.12), stroke: s.c('gold'), lw: 0.35 });
  });
  for (const i of [0, 1]) {
    const beat = i === 0 ? 'p0' : 'p1';
    const hot = Math.max(s.win('twice', 'p0') * after(s, 'twice', 0.2 + 0.3 * i), s.win(beat, i === 0 ? 'p1' : 'sum'));
    wire(s, g.xi, g.yx, g.xm, g.ym[i]!, { r1: R, hot });
    wire(s, g.xi, g.yw[i]!, g.xm, g.ym[i]!, { r1: R });
    rich(s, `W_${i}1 = ${fmt(W[i]![1]!)}`, g.xi - 1.6 * s.u, g.yw[i]!, 'blue', 'right', 3.6);
    wire(s, g.xm, g.ym[i]!, g.xa, g.ym[i]!, { r0: R, r1: 4, grad: fmt(DZ[i]!), ga: 1, size: 3.8, t: 0.4 });
    // The add's other inputs: the rest of row i's products.
    for (const dy of [-1, 1]) s.line(g.xa - 4 * s.u, g.ym[i]! + dy * 9.5 * s.u, g.xa - 1.6 * s.u, g.ym[i]! + dy * 4.6 * s.u, s.tint('--ink-3', 0.6), 0.3, [0.8, 0.8]);
    wire(s, g.xa, g.ym[i]!, g.xo, g.ym[i]!, { r0: 4, grad: fmt(DZ[i]!), ga: 1, size: 3.8 });
    gate(s, g.xa, g.ym[i]!, '+', '--ink-2', 0, 4);
    gate(s, g.xm, g.ym[i]!, '×', '--ink-2', s.win(beat, i === 0 ? 'p1' : 'sum'), R);
    rich(s, `z_${i}`, g.xo + 1.6 * s.u, g.ym[i]!, '--ink-2', 'left', 4.8, true);
    // The swap: x1 gets W_i1 times the gradient on z_i.
    pulse(s, g.xm, g.ym[i]!, g.xi, g.yx, runAfter(s, beat, 0.45, 0.9), 'red');
    const prod = W[i]![1]! * DZ[i]!;
    s.alpha(after(s, beat, 0.6), () => red(s, `${fmt(W[i]![1]!)}·${par(DZ[i]!)} = ${fmt(prod)}`, xg(i), 3.6, 'right'));
  }
  const y1 = Y(s, 69);
  s.alpha(s.win('twice', 'sum') * after(s, 'twice', 0.2), () => mono(s, 'used twice: its gradients add', s.w / 2, y1, '--ink-2', 3.4, 'center', 600));
  s.alpha(after(s, 'sum', 0.35), () => rich(s, `∂f/∂x_1 = ${fmt(W[0]![1]! * DZ[0]!)} + ${par(W[1]![1]! * DZ[1]!)} = ${fmt(DX[1]!)}`, s.w / 2, y1, 'red', 'center', 3.8));
  s.alpha(after(s, 'own', 0.35), () => rich(s, `x_1's own value, ${X[1]}, never enters`, s.w / 2, Y(s, 79), 'gold', 'center', 3.4));
}

const forkScene: SceneDef = {
  marks: {
    z0: { tex: String.raw`z_0 = \symW_{00}\symx_0 + \boxed{\symW_{01}\symx_1} + \symW_{02}\symx_2`, x: 0.5, y: 0.53, size: 4.6 },
    z1: { tex: String.raw`z_1 = \symW_{10}\symx_0 + \boxed{\symW_{11}\symx_1} + \symW_{12}\symx_2`, x: 0.5, y: 0.67, size: 4.6 },
  },
  draw(s) {
    const gone = s.ease('fork', 0.5);
    s.alpha(1 - gone, () => strip(s));
    s.show('z0', s.ease('rows', 0.5, 0.4) * (1 - gone));
    s.show('z1', s.ease('row1', 0.5, 0.3) * (1 - gone));
    s.alpha(s.ease('fork', 0.6, 0.4), () => fork(s));
  },
};

// ---- scene 3: column j of W dotted with dz, which is W transpose times dz

/** Where the transposed picture sits: W transpose, dz, the result, and x to compare. */
function tAt(s: Scene) {
  const k = s.tall ? 1 : 1.15;
  const cx = s.w / 2;
  return { y: Y(s, 46), tx: cx - 26 * k * s.u, dzx: cx - 5 * k * s.u, eq: cx + 5 * k * s.u, ox: cx + 14 * k * s.u, xx: cx + 32 * k * s.u };
}

/** Column j's beat, the fraction into it when its entry appears, and the beat that dims it. */
const COLS: [string, number, string][] = [
  ['c0', 0.55, 'c2'],
  ['c1', 0.45, 'c0'],
  ['c2', 0.25, 'T'],
];

function cols(s: Scene): void {
  const cx = s.w / 2 + 4 * s.u;
  const y = Y(s, 34);
  const cw = CW * s.u;
  const ch = CH * s.u;
  const flip = s.ease('T', 1.2, 0.3);
  const a = 1 - s.ease('T', 0.5);
  const shown = (j: number) => after(s, COLS[j]![0], COLS[j]![1]);
  const hot = (j: number) => shown(j) * (1 - s.ease(COLS[j]![2], 0.5));
  // W itself, whose cells fly to their transposed places on 'T'.
  const T = tAt(s);
  const wx0 = cx - 1.5 * cw;
  const wy0 = y - ch;
  const tx0 = T.tx - cw;
  const ty0 = T.y - 1.5 * ch;
  const fitRow = (r: number) => after(s, 'fit', 0.05 + 0.18 * r, 0.3) * (1 - after(s, 'fit', 0.23 + 0.18 * r, 0.3));
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 3; j++) {
      const e = smooth(flip);
      const px = lerp(wx0 + (j + 0.5) * cw, tx0 + (i + 0.5) * cw, e);
      const py = lerp(wy0 + (i + 0.5) * ch, ty0 + (j + 0.5) * ch, e);
      const on = hot(j) * 0.9 * a + 0.9 * fitRow(j);
      cellAt(s, px, py, fmt(W[i]![j]!), 'blue', on);
    }
  }
  s.alpha(a, () => {
    label(s, 'W', wx0 + 3 * cw + 1.6 * s.u, y, 'blue', 'left', 3.8);
    const c = grid(s, wx0 - 7.5 * s.u, y, 2, 1, (i) => fmt(DZ[i]!), 'red', () => 0.3);
    label(s, '∂f/∂z', c.x0 - 1.6 * s.u, c.cy(0), 'red', 'right', 3.2);
    const dy = Y(s, 58);
    for (let j = 0; j < 3; j++) {
      s.alpha(shown(j), () => {
        const x = wx0 + (j + 0.5) * cw;
        s.arrow(x, wy0 + 2 * ch + 0.6 * s.u, x, dy - 4.4 * s.u, s.c('--ink-3'), 0.3, 1.6);
        cellAt(s, x, dy, fmt(DX[j]!), 'red', 0.35 + 0.6 * hot(j));
        const terms = W.map((r, i) => `${par(r[j]!)}·${par(DZ[i]!)}`).join(' + ');
        rich(s, `∂f/∂x_${j} = ${terms} = ${fmt(DX[j]!)}`, s.w / 2, Y(s, 72 + 7 * j), 'red', 'center', 3.4);
      });
    }
    s.alpha(shown(1), () => label(s, '∂f/∂x', wx0 + 3 * cw + 1.6 * s.u, dy, 'red', 'left', 3.4));
  });
  s.alpha(after(s, 'T', 0.4), () => {
    label(s, 'Wᵀ', T.tx, ty0 - 3.4 * s.u, 'blue', 'center', 3.8);
    mono(s, '(3, 2)', T.tx, ty0 + 3 * ch + 3.4 * s.u, '--ink-2', 3.2);
  });
}

/** dz: written across on 'row', stood up as a column on 'stand', then the product and its shape. */
function product(s: Scene): void {
  const T = tAt(s);
  const cw = CW * s.u;
  const ch = CH * s.u;
  const up = s.ease('stand', 1.1, 0.3);
  const on = s.ease('Tdz', 0.6, 0.3);
  // Turning clockwise about its center: entry 0 from the left to the top, entry 1 from the right to the bottom.
  s.alpha(on, () => {
    for (let i = 0; i < 2; i++) {
      const th = (i === 0 ? Math.PI : 0) + (Math.PI / 2) * up;
      const r = lerp(cw / 2, ch / 2, up);
      cellAt(s, T.dzx + Math.cos(th) * r, T.y + Math.sin(th) * r, fmt(DZ[i]!), 'red', 0.3 + 0.5 * s.win('stand', 'fit'));
    }
    label(s, '∂f/∂z', T.dzx, T.y - 1.5 * ch - 3.4 * s.u, 'red', 'center', 3.2);
  });
  const sy = T.y + 1.5 * ch + 3.4 * s.u;
  s.alpha(s.ease('row', 0.5, 0.4) * (1 - s.ease('stand', 0.4, 0.2)), () => {
    mono(s, '(1, 2)', T.dzx, sy, 'red', 3.2, 'center', 650);
    mono(s, '(3, 2) times (1, 2): no fit', s.w / 2, Y(s, 82), 'red', 3.4, 'center', 650);
  });
  s.alpha(after(s, 'stand', 0.55), () => mono(s, '(2, 1)', T.dzx, sy, '--ink-2', 3.2));
  // Each row of W transpose lies across the column, and fills one entry.
  s.alpha(s.ease('fit', 0.5), () => {
    label(s, '=', T.eq, T.y, '--ink-2', 'center', 4.4);
    for (let r = 0; r < 3; r++) {
      const f = after(s, 'fit', 0.12 + 0.18 * r, 0.3);
      cellAt(s, T.ox, T.y + (r - 1) * ch, f > 0.5 ? fmt(DX[r]!) : '', 'red', 0.3 + 0.6 * f * (1 - after(s, 'fit', 0.3 + 0.18 * r, 0.3)));
    }
    label(s, '∂f/∂x', T.ox, T.y - 1.5 * ch - 3.4 * s.u, 'red', 'center', 3.2);
  });
  s.alpha(after(s, 'fit', 0.6), () => {
    mono(s, '(3, 1)', T.ox, sy, '--ink-2', 3.2);
    for (let r = 0; r < 3; r++) cellAt(s, T.xx, T.y + (r - 1) * ch, fmt(X[r]!), 'orange', 0.1);
    label(s, 'x', T.xx, T.y - 1.5 * ch - 3.4 * s.u, 'orange', 'center', 3.8);
    mono(s, '(3, 1)', T.xx, sy, '--ink-2', 3.2);
  });
  s.alpha(after(s, 'fit', 0.75), () => mono(s, '(3, 2) @ (2, 1) → (3, 1), like x', s.w / 2, Y(s, 82), '--ink', 3.4, 'center', 600));
}

const colsScene: SceneDef = {
  marks: {
    col: { tex: String.raw`\frac{\partial f}{\partial \symx_j} = (\text{column } j \text{ of } \symW) \cdot \frac{\partial f}{\partial z}`, x: 0.5, y: 0.1, size: 4.4 },
    wt: { tex: String.raw`\frac{\partial f}{\partial \symx} = \symW^{\top} \frac{\partial f}{\partial z}`, x: 0.5, y: 0.11, size: 5.2 },
  },
  draw(s) {
    s.show('col', s.ease('c1', 0.6, 0.6) * (1 - s.ease('T', 0.5)));
    s.show('wt', s.ease('Tdz', 0.6, 0.2));
    cols(s);
    product(s);
  },
};

// ---- scene 4: the shape check, then two worked problems on one W

const K = 1.15;

const tryIt: SceneDef = {
  marks: {
    aidW: { tex: String.raw`\frac{\partial f}{\partial z}\,\symx^{\top}\!:\ (2, 1)(1, 3) \to (2, 3),\ \text{like } \symW`, x: 0.5, y: 0.26, size: 4.4 },
    aidX: { tex: String.raw`\symW^{\top} \frac{\partial f}{\partial z}\!:\ (3, 2)(2,) \to (3,),\ \text{like } \symx`, x: 0.5, y: 0.48, size: 4.4 },
    bad: { tex: String.raw`\symW \frac{\partial f}{\partial z}\!:\ (2, 3)(2,)\ \text{does not fit}`, x: 0.5, y: 0.7, size: 4.4 },
    p: { tex: String.raw`\symW = \begin{bmatrix} 1 & 4 \\ 2 & -3 \end{bmatrix},\quad \frac{\partial f}{\partial z} = [3,\ -1]`, x: 0.5, y: 0.13, size: 4.6 },
    q: { tex: String.raw`\frac{\partial f}{\partial \symx}\,?`, x: 0.5, y: 0.27, size: 4.6 },
  },
  draw(s) {
    const aid = 1 - s.ease('p1', 0.5);
    s.show('aidW', s.ease('aid', 0.6, 0.5) * aid);
    s.show('aidX', s.ease('aid2', 0.6, 0.2) * aid);
    s.show('bad', after(s, 'aid2', 0.45) * aid);
    const on = s.ease('p1', 0.6, 0.3);
    s.show('p', on);
    s.show('q', on * after(s, 'p1', 0.7));
    const cx = s.w / 2 + 3 * s.u;
    const ix = (t: string, x: number, y: number, hot = 0) => s.text(t, x, y, { size: 2.8, font: 'mono', weight: hot > 0.5 ? 650 : 400, color: hot > 0.5 ? s.c('--ink') : s.c('--ink-3') });
    // Each column of W dotted with dz: column 1 first, then column 0.
    s.alpha(on, () => {
      const cy = Y(s, 50);
      const colA = (j: number) => (j === 1 ? after(s, 'a1', 0.3) : after(s, 'a2', 0.35));
      const colHot = (j: number) => colA(j) * (1 - (j === 1 ? after(s, 'a2', 0.1) : 0));
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
          cellAt(s, w.cx(j), dy, a > 0.5 ? fmt(DX2[j]!) : '?', 'red', 0.2 + 0.7 * colHot(j), K);
          s.alpha(a, () => mono(s, `${W2.map((r, i) => `${par(r[j]!)}·${par(DZ2[i]!)}`).join(' + ')} = ${fmt(DX2[j]!)}`, s.w / 2, Y(s, 84 + 7 * j), 'red', 3.6, 'center', 600));
        }
        label(s, '∂f/∂x', w.x1 + 1.8 * s.u, dy, 'red', 'left', 3.4);
      });
    });
  },
};

export const scenes: Record<string, SceneDef> = { walk, fork: forkScene, cols: colsScene, try: tryIt };

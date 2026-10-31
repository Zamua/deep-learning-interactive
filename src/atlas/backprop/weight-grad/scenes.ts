import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp, smooth } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { after } from '../../draw';
import { beside, gate, mono, name, pulse, runAfter, wire } from '../draw';

// The running example: z = W x, with the gradient dz arriving from above.
const W = [
  [1, 2, -1],
  [3, 1, 2],
];
const X = [3, 4, 1];
const Z = W.map((r) => r.reduce((a, w, j) => a + w * X[j]!, 0));
const DZ = [2, -1];
const DW = DZ.map((g) => X.map((x) => g * x));

const fmt = (v: number) => (v < 0 ? `−${-v}` : String(v));

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

const label = (s: Scene, t: string, x: number, y: number, k: Ink, align: CanvasTextAlign = 'center', size = 3.6) => s.text(t, x, y, { size, font: 'mono', weight: 650, align, color: s.c(k), halo: true });
const red = (s: Scene, t: string, at: [number, number], size = 3.8, align: CanvasTextAlign = 'center') => s.text(t, at[0], at[1], { size, font: 'mono', weight: 700, align, color: s.c('red'), halo: true });
const gold = (s: Scene, t: string, at: [number, number], size = 3.8) => s.text(t, at[0], at[1], { size, font: 'mono', weight: 650, color: s.c('gold'), halo: true });
/** A label gliding from one point to another as `t` goes 0 to 1, then staying. */
function fly(s: Scene, t: number, from: [number, number], to: [number, number], draw: (at: [number, number]) => void): void {
  if (t <= 0) return;
  const e = smooth(t);
  draw([lerp(from[0], to[0], e), lerp(from[1], to[1], e)]);
}
const Y = (s: Scene, v: number) => (v / 100) * s.h;
/** A bump 0 -> 1 -> 0 centered on `c`, `w` wide, for things that light in turn. */
const bump = (v: number, c: number, w: number) => Math.max(0, 1 - Math.abs(v - c) / w);

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

// ---- scene 1: the node, f, and the grid of slopes it needs

const SC = 0.86;

function why1(s: Scene): void {
  const k = s.tall ? 1 : 1.25;
  const at = (v: number) => s.w / 2 + v * k * s.u;
  const y = Y(s, 30);
  const yb = Y(s, 68);
  const nudge = s.win('nudge', 'grid');
  const sweep = s.prog('weights') * 6;
  const wOn = (i: number, j: number) => (s.win('weights', 'nudge') > 0 ? bump(sweep, i * 3 + j + 0.5, 1) * s.win('weights', 'nudge') : 0) + (i === 0 && j === 1 ? nudge + 0.3 * after(s, 'grid', 0) : 0);
  // W x = z, then the rest of the graph, then f.
  s.alpha(s.ease('node', 0.6), () => {
    const bW = grid(s, at(-36), y, 2, 3, (i, j) => fmt(W[i]![j]!), 'blue', wOn, SC);
    const bx = grid(s, at(-19), y, 3, 1, (i) => fmt(X[i]!), 'orange', () => 0, SC);
    label(s, 'W', (bW.x0 + bW.x1) / 2, bx.y0 - 3 * s.u, 'blue');
    label(s, 'x', bx.cx(0), bx.y0 - 3 * s.u, 'orange');
  });
  const out = s.ease('out', 0.6);
  const zx = at(-6);
  const bx0 = at(16) - 8 * s.u;
  const bx1 = at(16) + 8 * s.u;
  const fx = at(34);
  const cw = CW * SC * s.u;
  const ch = CH * SC * s.u;
  s.alpha(out, () => {
    label(s, '=', at(-12.5), y, '--ink-2', 'center', 4);
    const bz = grid(s, zx, y, 2, 1, (i) => fmt(Z[i]!), '--ink-2', (i) => (i === 0 ? nudge * 0.6 : 0), SC);
    label(s, 'z', bz.cx(0), y - 1.5 * ch - 3 * s.u, '--ink-2');
    for (let i = 0; i < 2; i++) wire(s, bz.x1 + 0.6 * s.u, bz.cy(i), bx0, y + (i - 0.5) * 6 * s.u, {});
    s.rrect(bx0, y - 9 * s.u, bx1 - bx0, 18 * s.u, 2.5, { fill: s.tint('--ink-3', 0.08), stroke: s.tint('--ink-3', 0.7), lw: 0.3 });
    s.text('⋯', at(16), y, { size: 5, weight: 600, color: s.c('--ink-3') });
    s.text('the rest', at(16), y + 12 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
    s.text('of the graph', at(16), y + 15.4 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
    wire(s, bx1, y, fx, y, {});
    // f stirs while W01 is nudged.
    const wob = Math.sin((s.t - s.at('nudge')) * 9) * 1.1 * s.u * after(s, 'nudge', 0.55) * (1 - s.ease('name', 0.8, 1));
    name(s, fx, y + wob, 'f', 'purple', 'out');
    // The forward flow, z to f, and the nudge travelling the same way.
    const fw = runAfter(s, 'out', 0.25, 0.8);
    pulse(s, bz.x1, bz.cy(0), bx0, y, fw, 'orange');
    pulse(s, bx1, y, fx, y, runAfter(s, 'out', 0.5, 0.6), 'orange');
    pulse(s, bz.x1, bz.cy(0), bx0, y, runAfter(s, 'nudge', 0.3, 0.6), 'orange');
    pulse(s, bx1, y, fx, y, runAfter(s, 'nudge', 0.45, 0.5), 'orange');
    // The gradient arriving back at z.
    pulse(s, fx, y, bx1, y, runAfter(s, 'dz', 0.1, 0.6), 'red');
    for (let i = 0; i < 2; i++) pulse(s, bx0, y + (i - 0.5) * 6 * s.u, bz.x1, bz.cy(i), runAfter(s, 'dz', 0.25, 0.6), 'red');
  });
  // The grid of slopes to find, under W, and the gradient that has arrived, under z.
  s.alpha(s.ease('grid', 0.6, 0.8), () => {
    const g = grid(s, at(-36), yb, 2, 3, () => '?', 'red', (i, j) => 0.2 + (i === 0 && j === 1 ? 0.3 : 0) + 0.4 * s.win('ask', undefined), SC);
    label(s, '∂f/∂W', (g.x0 + g.x1) / 2, g.y0 - 3 * s.u, 'red', 'center', 3.2);
  });
  s.alpha(after(s, 'dz', 0.45), () => {
    const d = grid(s, zx, yb, 2, 1, (i) => fmt(DZ[i]!), 'red', () => 0.3, SC);
    label(s, '∂f/∂z', d.cx(0), d.y0 - 3 * s.u, 'red', 'center', 3.2);
    s.alpha(after(s, 'ask', 0.1), () => label(s, 'dz', d.x1 + 1.6 * s.u, (d.y0 + d.y1) / 2, 'red', 'left', 3.2));
  });
  // From dz and x, the node owes dW.
  s.alpha(after(s, 'ask', 0.6), () => {
    const gx1 = at(-36) + 1.5 * cw + 1.2 * s.u;
    s.arrow(zx - 0.5 * cw - 1.2 * s.u, yb, gx1, yb, s.c('gold'), 0.45, 2);
  });
}

const why: SceneDef = {
  marks: {
    name: { tex: String.raw`\symW_{01} \text{ is } \texttt{W[0, 1]}\text{: row 0, column 1}`, x: 0.5, y: 0.54, size: 4.6 },
  },
  draw(s) {
    s.show('name', s.ease('name', 0.5, 0.2) * (1 - s.ease('grid', 0.5)));
    why1(s);
  },
};

// ---- scene 2: one weight's own multiply gate

/** W x = z across the top, row 0 lit, and the gradient on z beside it. */
function strip(s: Scene): void {
  const cx = s.w / 2;
  const y = Y(s, 19);
  const row0 = s.win('row', 'gates');
  const z1 = s.win('z1', 'rule');
  const bW = grid(s, cx - 23 * s.u, y, 2, 3, (i, j) => fmt(W[i]![j]!), 'blue', (i, j) => (i === 0 && j === 1 ? 0.7 : 0) + (i === 0 ? row0 * 0.5 : 0), SC);
  const bx = grid(s, cx - 5 * s.u, y, 3, 1, (i) => fmt(X[i]!), 'orange', (i) => (i === 1 ? s.win('x1', 'copy') : 0) + row0 * 0.5, SC);
  label(s, '=', cx + 3 * s.u, y, '--ink-2', 'center', 4);
  const bz = grid(s, cx + 11 * s.u, y, 2, 1, (i) => fmt(Z[i]!), '--ink-2', (i) => (i === 0 ? row0 : z1), SC);
  const ly = bx.y0 - 3 * s.u;
  label(s, 'W', (bW.x0 + bW.x1) / 2, ly, 'blue');
  label(s, 'x', bx.cx(0), ly, 'orange');
  label(s, 'z', bz.cx(0), ly, '--ink-2');
  const b = grid(s, cx + 26 * s.u, y, 2, 1, (i) => fmt(DZ[i]!), 'red', (i) => 0.25 + (i === 0 ? s.win('copy', 'row0') : z1), SC);
  label(s, '∂f/∂z', b.cx(0), ly, 'red', 'center', 3.2);
  s.alpha(z1 * after(s, 'z1', 0.45), () => rich(s, 'never reaches W_01', b.x1, b.y1 + 3.6 * s.u, 'red', 'right', 3));
}

const RG = 4.2;

/** Where the graph of z0 sits: inputs, multiplies, the add and the output. */
function at1(s: Scene) {
  const cx = s.w / 2;
  const k = s.tall ? 1 : 1.3;
  return {
    xi: cx - 30 * k * s.u,
    xm: cx - 5 * k * s.u,
    xa: cx + 18 * k * s.u,
    xo: cx + 40 * k * s.u,
    yw: (j: number) => Y(s, 38 + 20 * j),
    yx: (j: number) => Y(s, 46 + 20 * j),
    ym: (j: number) => Y(s, 42 + 20 * j),
    ya: Y(s, 62),
  };
}

function graph0(s: Scene): void {
  const g = at1(s);
  const copyT = runAfter(s, 'copy', 0.45, 0.9);
  const copyA = after(s, 'copy', 0.7);
  for (let j = 0; j < 3; j++) {
    // Each product arrives with its own gate.
    s.alpha(s.ease('gates', 0.5, 0.6 + 0.5 * j), () => {
      const hot = j === 1 ? s.win('x1', 'row0') : 0;
      wire(s, g.xi, g.yw(j), g.xm, g.ym(j), { r1: RG, hot });
      wire(s, g.xi, g.yx(j), g.xm, g.ym(j), { r1: RG, hot });
      rich(s, `W_0${j} = ${fmt(W[0]![j]!)}`, g.xi - 1.6 * s.u, g.yw(j), 'blue', 'right', 3.6);
      rich(s, `x_${j} = ${fmt(X[j]!)}`, g.xi - 1.6 * s.u, g.yx(j), 'orange', 'right', 3.6);
      wire(s, g.xm, g.ym(j), g.xa, g.ya, { r0: RG, r1: 5, grad: fmt(DZ[0]!), ga: copyA, size: 3.8 });
      pulse(s, g.xa, g.ya, g.xm, g.ym(j), copyT, 'red');
      gate(s, g.xm, g.ym(j), '×', '--ink-2', hot, RG);
    });
  }
  s.alpha(s.ease('gates', 0.5, 0.3), () => {
    wire(s, g.xa, g.ya, g.xo, g.ya, { r0: 5, val: String(Z[0]), grad: fmt(DZ[0]!), ga: after(s, 'copy', 0.3), size: 3.8 });
    gate(s, g.xa, g.ya, '+', '--ink-2', s.win('copy', 'swap'), 5);
    rich(s, 'z_0', g.xo + 1.6 * s.u, g.ya, '--ink-2', 'left', 4.8, true);
  });
  pulse(s, g.xo, g.ya, g.xa, g.ya, runAfter(s, 'copy', 0.15, 0.7), 'red');
  // x1's partner ring.
  s.alpha(s.win('x1', 'copy'), () => s.rrect(g.xi - 15 * s.u, g.yx(1) - 3 * s.u, 14.2 * s.u, 6 * s.u, 1.2, { fill: s.tint('orange', 0.12), stroke: s.c('orange'), lw: 0.35 }));
  // The swap: x1's value crosses to W01's wire, and W01 gets 4 times 2.
  const wAt = (j: number, t: number): [number, number] => beside(s, g.xi, g.yw(j), g.xm, g.ym(j), t, 1, 3.8, 0, RG);
  const xs = runAfter(s, 'swap', 0.3, 1.1);
  fly(s, xs, [g.xi - 6 * s.u, g.yx(1)], wAt(1, 0.78), (p) => gold(s, '×4', p));
  pulse(s, g.xm, g.ym(1), g.xi, g.yw(1), runAfter(s, 'swap', 0.72, 0.9), 'red');
  s.alpha(after(s, 'swap', 0.88), () => red(s, fmt(DW[0]![1]!), wAt(1, 0.3)));
  // The same for the other two weights of row 0.
  for (const j of [0, 2]) {
    s.alpha(after(s, 'row0', 0.3 + 0.2 * (j / 2)), () => {
      gold(s, `×${X[j]}`, wAt(j, 0.78));
      red(s, fmt(DW[0]![j]!), wAt(j, 0.3));
    });
  }
}

const gate1: SceneDef = {
  marks: {
    z0: { tex: String.raw`z_0 = \symW_{00}\symx_0 + \symW_{01}\symx_1 + \symW_{02}\symx_2`, x: 0.5, y: 0.52, size: 5 },
    rule: { tex: String.raw`\frac{\partial f}{\partial \symW_{ij}} = \frac{\partial f}{\partial z_i}\,\symx_j`, x: 0.5, y: 0.15, size: 5.4 },
  },
  draw(s) {
    const out = s.ease('rule', 0.6);
    s.alpha(1 - out, () => strip(s));
    s.show('z0', after(s, 'row', 0.55) * (1 - s.ease('gates', 0.5)));
    s.show('rule', after(s, 'rule', 0.05));
    graph0(s);
  },
};

// ---- scene 3: every weight, the outer product

const K = 1.15;

const grid3: SceneDef = {
  marks: {
    rule: { tex: String.raw`\frac{\partial f}{\partial \symW_{ij}} = \frac{\partial f}{\partial z_i}\,\symx_j`, x: 0.5, y: 0.13, size: 5.4 },
    outer: { tex: String.raw`\frac{\partial f}{\partial \symW} = \frac{\partial f}{\partial z}\,\symx^{\top}`, x: 0.5, y: 0.13, size: 5.4 },
  },
  draw(s) {
    s.show('rule', 1 - s.ease('T', 0.5));
    s.show('outer', s.ease('T', 0.6, 0.3));
    const cx = s.w / 2 + (s.tall ? 2 : 0) * s.u;
    const cy = Y(s, 50);
    // When each entry fills in, as the voice reads its row.
    const fill = (i: number, j: number) => (i === 0 ? after(s, 'fill', 0.62 + 0.12 * j, 0.35) : after(s, 'row1', 0.62 + 0.11 * j, 0.35));
    const cur = (i: number, j: number) => fill(i, j) * (1 - (i === 0 ? after(s, 'fill', 0.72 + 0.12 * j, 0.35) : after(s, 'row1', 0.72 + 0.11 * j, 0.35)));
    const e10 = s.win('e10', 'table');
    const side = s.win('table', 'outer') * after(s, 'table', 0.4);
    const spread = s.win('outer', 'T') * after(s, 'outer', 0.55);
    const g = grid(s, cx, cy, 2, 3, (i, j) => (fill(i, j) > 0.5 ? fmt(DW[i]![j]!) : ''), 'red', (i, j) => Math.max(cur(i, j), fill(i, j) * 0.35, i === 1 && j === 0 ? e10 : 0, spread * 0.6), K);
    const rowOn = (j: number) => Math.max(...[0, 1].map((i) => cur(i, j))) + side * 0.5 + (j === 0 ? e10 : 0) + spread * 0.4;
    const r = grid(s, (g.x0 + g.x1) / 2, g.y0 - 6.2 * s.u, 1, 3, (_, j) => fmt(X[j]!), 'orange', (_, j) => rowOn(j), K);
    const colOn = (i: number) => Math.max(...[0, 1, 2].map((j) => cur(i, j))) + side * 0.5 + (i === 1 ? e10 : 0) + spread * 0.4;
    const c = grid(s, g.x0 - 8.2 * s.u, cy, 2, 1, (i) => fmt(DZ[i]!), 'red', (i) => colOn(i) + 0.2, K);
    label(s, '∂f/∂z', c.cx(0), r.cy(0), 'red', 'center', 3.2);
    const xT = after(s, 'T', 0.55);
    s.alpha(1 - xT, () => label(s, 'x', r.x1 + 1.8 * s.u, r.cy(0), 'orange', 'left', 3.8));
    s.alpha(xT, () => label(s, 'xᵀ', r.x1 + 1.8 * s.u, r.cy(0), 'orange', 'left', 3.8));
    label(s, '∂f/∂W', (g.x0 + g.x1) / 2, g.y1 + 3.6 * s.u, 'red', 'center', 3.4);
    // Row i is x scaled by dz_i.
    const ends = 1 - s.ease('outer', 0.5);
    s.alpha(after(s, 'fill', 0.45) * ends * (1 - e10 * 0.7), () => mono(s, `= ${fmt(DZ[0]!)} · x`, g.x1 + 2 * s.u, g.cy(0), 'red', 3.4, 'left', 600));
    s.alpha(after(s, 'row1', 0.35) * ends * (1 - e10 * 0.7), () => mono(s, `= ${fmt(DZ[1]!)} · x`, g.x1 + 2 * s.u, g.cy(1), 'red', 3.4, 'left', 600));
    // Entry (1, 0): row 1 picks the gradient, column 0 picks the input.
    s.alpha(e10, () => {
      mono(s, 'row 1', c.x0 - 1.5 * s.u, c.cy(1), '--ink', 2.9, 'right', 650);
      mono(s, 'col 0', r.cx(0), r.y0 - 2.6 * s.u, '--ink', 2.9, 'center', 650);
      s.alpha(after(s, 'e10', 0.3), () => rich(s, `∂f/∂W_10 = ${fmt(DZ[1]!)} × ${X[0]} = ${fmt(DW[1]![0]!)}`, s.w / 2, Y(s, 84), 'red', 'center', 3.8));
    });
    // Inward to one number, or outward to a table.
    s.alpha(s.win('outer', 'T') * after(s, 'outer', 0.3), () => {
      mono(s, 'dot product: two vectors → one number', s.w / 2, Y(s, 80), '--ink-2', 3.3, 'center', 600);
      s.alpha(after(s, 'outer', 0.55), () => mono(s, 'outer product: two vectors → a table', s.w / 2, Y(s, 87), 'red', 3.3, 'center', 650));
    });
    // The shapes: (2, 1) times (1, 3) gives (2, 3).
    s.alpha(after(s, 'T', 0.5) * (1 - s.ease('flip', 0.5)), () => {
      mono(s, '(2, 1)', c.cx(0), c.y1 + 3.6 * s.u, '--ink-2', 3.2);
      mono(s, '(1, 3)', r.x1 + 1.8 * s.u + s.measure('xᵀ', { size: 3.8, font: 'mono', weight: 650 }) + 1.6 * s.u, r.cy(0), '--ink-2', 3.2, 'left');
    });
    s.alpha(after(s, 'shapes', 0.5), () => mono(s, '(2, 3)', g.x1 + 2 * s.u, (g.y0 + g.y1) / 2, '--ink-2', 3.2, 'left'));
    s.alpha(s.win('shapes', 'flip') * after(s, 'shapes', 0.3), () => mono(s, '(2, 1) @ (1, 3) → (2, 3), like W', s.w / 2, Y(s, 86), '--ink', 3.5, 'center', 600));
    s.alpha(s.win('flip', 'big') * after(s, 'flip', 0.3), () => {
      mono(s, 'x dzᵀ: (3, 1) @ (1, 2) → (3, 2)', s.w / 2, Y(s, 80), '--ink-2', 3.4, 'center', 600);
      s.alpha(after(s, 'flip', 0.7), () => mono(s, 'not W\'s shape', s.w / 2, Y(s, 87), 'red', 3.4, 'center', 650));
    });
    s.alpha(after(s, 'big', 0.3), () => {
      mono(s, 'W: (10, 3072)', s.w / 2, Y(s, 80), 'blue', 3.4, 'center', 600);
      s.alpha(after(s, 'big', 0.75), () => mono(s, '∂f/∂W: (10, 3072)', s.w / 2, Y(s, 87), 'red', 3.4, 'center', 650));
    });
  },
};

export const scenes: Record<string, SceneDef> = { why, gate: gate1, grid: grid3 };

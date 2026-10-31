import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { clamp01 } from '../../../lecture/scene';
import { after, cells, cite } from '../../draw';
import { caption, reluGlyph, unit, vcells } from '../draw';
import { pulse } from '../../backprop/draw';

// One example runs through every scene: x -> z = W1 x + b1 -> h = ReLU(z) -> s = W2 h + b2 -> L.
const X = [1, 2];
const Z = [2, -1];
const H = [2, 0];
const S = [3, 3];
const DS = [-0.5, 0.5];
const W2 = [[1, -1], [2, 1]];
const DW2 = DS.map((g) => H.map((v) => g * v));
const DH = [0.5, 1];
const DZ = [0.5, 0];
const DW1 = DZ.map((g) => X.map((v) => g * v));
const str = (v: number) => (Object.is(v, -0) ? '0' : String(v).replace('-', '−'));
const SUB = '₀₁';

// ---- the network as a graph: x, z, h, s in two rows of units, the loss on the right

/** Where the graph's columns (x, z, h, s, L) and its two rows sit; `big` fills the stage. */
function geo(s: Scene, big = false) {
  const u = s.u;
  const bw = Math.min(s.w / u - 24, big ? 118 : 110) * u;
  const l = (s.w - bw) / 2 + 1.5 * u;
  const xs = [0, 0.29, 0.52, 0.77, 1].map((f) => l + f * bw);
  const yA = (big ? 30 : 20) * u;
  const yB = (big ? 54 : 40) * u;
  return { xs, yA, yB, ym: (yA + yB) / 2, r: big ? 4.2 : 3.6, big };
}
type G = ReturnType<typeof geo>;
const ys = (g: G) => [g.yA, g.yB];

interface NetOpts {
  /** Alpha of the forward values, above each unit. */
  vals?: number;
  /** How far unit 1 reads as off: its h dims. */
  off?: number;
  /** Lights a W1 edge (into z_i from x_j) or a W2 edge (into s_i from h_j), 0 to 1. */
  w1?: (i: number, j: number) => number;
  w2?: (i: number, j: number) => number;
  /** Darkens a W1 or W2 edge: no gradient along it. */
  w1Dark?: (i: number, j: number) => number;
  w2Dark?: (i: number, j: number) => number;
  /** Lights the loss edges and the ReLU wires. */
  lEdge?: number;
  relu?: number[];
  /** Darkens unit 1's ReLU wire going back. */
  dark?: number;
  /** Gradients in red under the units: labels and alphas per row. */
  gs?: [string[], number[]];
  gh?: [string[], number[]];
  gz?: [string[], number[]];
  /** Question marks: on every weight, and under the hidden units. */
  qW1?: number;
  qW2?: number;
  qH?: number;
}

/** An edge between two units of radius r, trimmed to their rims. */
function edge(s: Scene, x0: number, y0: number, x1: number, y1: number, r: number, k: Ink, a: number, width: number, dash?: number[]) {
  if (a <= 0.003) return;
  const d = Math.hypot(x1 - x0, y1 - y0);
  const [ux, uy] = [(x1 - x0) / d, (y1 - y0) / d];
  s.alpha(a, () => s.line(x0 + ux * r * s.u, y0 + uy * r * s.u, x1 - ux * r * s.u, y1 - uy * r * s.u, k.startsWith('--') ? s.c(k) : s.tint(k, 0.75), width, dash));
}

/** A point `t` of the way along the edge from (x0, y0) to (x1, y1). */
const along = (x0: number, y0: number, x1: number, y1: number, t: number): [number, number] => [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];

function net(s: Scene, g: G, o: NetOpts = {}) {
  const u = s.u;
  const [cx, cz, ch, cs, cl] = g.xs as [number, number, number, number, number];
  const Y = ys(g);
  const r = g.r;
  const zero = () => 0;
  const w1 = o.w1 ?? zero;
  const w2 = o.w2 ?? zero;
  const w1d = o.w1Dark ?? zero;
  const w2d = o.w2Dark ?? zero;
  const off = o.off ?? 0;
  // Weights: W1 from x_j into z_i, W2 from h_j into s_i, each lit or darkened.
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    const a1 = w1(i, j);
    const d1 = w1d(i, j);
    edge(s, cx, Y[j]!, cz, Y[i]!, r, 'blue', 1 - d1 * 0.6, 0.3 + 0.35 * a1, d1 > 0.5 ? [0.8, 0.8] : undefined);
    edge(s, cx, Y[j]!, cz, Y[i]!, r, 'red', a1 * (1 - d1), 0.6);
    const a2 = w2(i, j);
    const d2 = w2d(i, j);
    edge(s, ch, Y[j]!, cs, Y[i]!, r, 'blue', 1 - d2 * 0.6, 0.3 + 0.35 * a2, d2 > 0.5 ? [0.8, 0.8] : undefined);
    edge(s, ch, Y[j]!, cs, Y[i]!, r, 'red', a2 * (1 - d2), 0.6);
  }
  // The loss edges, and each unit's ReLU between its z and its h.
  Y.forEach((y, i) => {
    edge(s, cs, y, cl, g.ym, r, '--ink-3', 1, 0.3);
    edge(s, cs, y, cl, g.ym, r, 'red', o.lEdge ?? 0, 0.6);
    const dk = i === 1 ? o.dark ?? 0 : 0;
    edge(s, cz, y, ch, y, r, '--ink-3', 1, 0.3, dk > 0.5 ? [0.8, 0.8] : undefined);
    reluGlyph(s, (cz + ch) / 2, y, 6.4, 5, dk > 0.5 ? '--ink-3' : 'gold', { z: Z[i]!, dot: i === 1 && off > 0.5 ? 'red' : 'green', on: o.relu?.[i] ?? 0 });
  });
  // The units: names inside, forward values above.
  const lab = { size: 3, font: 'mono', weight: 600, halo: true } as const;
  const vals = o.vals ?? 1;
  Y.forEach((y, i) => {
    unit(s, cx, y, r, `x${SUB[i]}`, 'orange', 0, 2.9);
    unit(s, cz, y, r, `z${SUB[i]}`, '--ink-3', 0, 2.9);
    unit(s, ch, y, r, `h${SUB[i]}`, i === 1 && off > 0.5 ? '--ink-3' : 'gold', 0, 2.9);
    unit(s, cs, y, r, `s${SUB[i]}`, 'purple', 0, 2.9);
    s.alpha(vals, () => {
      const vy = y - (r + 2.6) * u;
      s.text(str(X[i]!), cx, vy, { ...lab, color: s.c('--ink-2') });
      s.text(str(Z[i]!), cz, vy, { ...lab, color: s.c(i === 1 && off > 0.5 ? 'red' : '--ink-2') });
      s.text(str(H[i]!), ch, vy, { ...lab, color: s.c('--ink-2') });
      s.text(str(S[i]!), cs, vy, { ...lab, color: s.c('--ink-2') });
    });
  });
  unit(s, cl, g.ym, r, 'L', 'red', 0, 3.2);
  s.alpha(vals, () => s.text('0.69', cl, g.ym - (r + 2.6) * u, { ...lab, color: s.c('--ink-2') }));
  // Gradients in red, under the units.
  const grad = (x: number, G?: [string[], number[]]) => G && Y.forEach((y, i) => s.alpha(G[1][i] ?? 0, () => s.text(G[0][i]!, x, y + (r + 2.8) * u, { ...lab, weight: 650, color: s.c('red') })));
  grad(cs, o.gs);
  grad(ch, o.gh);
  grad(cz, o.gz);
  // Question marks: a gradient not known yet.
  const q = { size: 3.4, font: 'mono', weight: 700, color: s.c('red'), halo: true } as const;
  /** Where a mark sits on edge j -> i, clear of the crossing in the middle. */
  const spot = (x0: number, x1: number, i: number, j: number): [number, number] => (i === j ? [(x0 + x1) / 2, Y[i]! + (i ? 2.6 : -2.6) * u] : along(x0, Y[j]!, x1, Y[i]!, j === 0 ? 0.28 : 0.72));
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
    s.alpha(o.qW1 ?? 0, () => s.text('?', ...spot(cx, cz, i, j), q));
    s.alpha(o.qW2 ?? 0, () => s.text('?', ...spot(ch, cs, i, j), q));
  }
  s.alpha(o.qH ?? 0, () => Y.forEach((y) => s.text('?', ch, y + (r + 2.8) * u, q)));
}

/** The layers named under the graph. */
function layers(s: Scene, g: G, a: number) {
  const [cx, cz, ch, cs, cl] = g.xs as [number, number, number, number, number];
  const y = g.yB + (g.r + 9) * s.u;
  const o = { size: 3.2, font: 'mono', weight: 600, halo: true } as const;
  s.alpha(a, () => {
    s.text('W₁', (cx + cz) / 2, y, { ...o, color: s.c('blue') });
    s.text('ReLU', (cz + ch) / 2, y, { ...o, color: s.c('gold') });
    s.text('W₂', (ch + cs) / 2, y, { ...o, color: s.c('blue') });
    s.text('loss', cl, y, { ...o, color: s.c('red') });
  });
}

/** A red dot running back along each edge in `paths` as `t` goes 0 to 1. */
function runBack(s: Scene, paths: [number, number, number, number][], t: number) {
  for (const [x0, y0, x1, y1] of paths) pulse(s, x0, y0, x1, y1, t, 'red');
}

// ---- 1. Why the walk: the loss speaks to the scores, never to h

const why: SceneDef = {
  draw(s) {
    const g = geo(s, true);
    const [cx, cz, ch, cs, cl] = g.xs as [number, number, number, number, number];
    const Y = ys(g);
    const top = s.win('top', 'hidden');
    const walk = s.prog('walk');
    const ph = (k: number) => clamp01(walk * 4 - k);
    const lit = s.ease('walk', 0.6) * (1 - s.ease('paper', 0.8));
    net(s, g, {
      vals: s.ease('net', 0.6, 1.2),
      off: s.ease('off', 0.4),
      relu: [0, s.win('off', 'need')],
      lEdge: Math.max(top, lit),
      w2: () => Math.max(top, ph(0.6) * lit),
      w1: (i) => (i === 0 ? ph(2.4) * lit : 0),
      gs: [DS.map(str), [top, top]],
      qW1: s.win('need', 'paper') * (1 - ph(2.6)),
      qW2: s.win('need', 'top'),
      qH: s.win('hidden', 'paper') * (1 - ph(1.6)),
    });
    layers(s, g, s.ease('net', 0.6, 2));
    // The gradient's walk back: loss to scores, scores to h, h through the ReLU, then into W1.
    if (walk > 0 && walk < 1) {
      runBack(s, Y.map((y): [number, number, number, number] => [cl, g.ym, cs, y]), ph(0));
      runBack(s, [0, 1].flatMap((i) => [0, 1].map((j): [number, number, number, number] => [cs, Y[i]!, ch, Y[j]!])), ph(1));
      runBack(s, [[ch, Y[0]!, cz, Y[0]!]], ph(2));
      runBack(s, [0, 1].map((j): [number, number, number, number] => [cz, Y[0]!, cx, Y[j]!]), ph(3));
    }
    cite(s, 'Rumelhart, Hinton & Williams, 1986', s.ease('paper', 0.6));
    const cy = s.h * 0.86;
    s.alpha(s.win('net', 'off') * after(s, 'net', 0.4), () => caption(s, 'x → W₁ → ReLU → h → W₂ → s → loss', cy, '--ink-2', 3.4));
    s.alpha(s.win('off', 'need'), () => caption(s, 'z₁ = −1 → h₁ = 0: unit 1 is off', cy, '--ink-2', 3.4));
    s.alpha(s.win('need', 'top'), () => caption(s, 'every weight: which way to nudge it?', cy, 'red', 3.4));
    s.alpha(top, () => caption(s, 'the loss tells each score how to move', cy, 'red', 3.4));
    s.alpha(s.win('hidden', 'walk'), () => caption(s, 'the data shows x and the answer, never h', cy, '--ink-2', 3.4));
    s.alpha(s.win('walk', 'paper'), () => caption(s, 'to W₁ only through W₂ and the ReLU', cy, 'red', 3.4));
    s.alpha(s.ease('paper', 0.6), () => caption(s, 'hidden units learn features of their own', cy, '--ink-2', 3.4));
  },
};

// ---- 2. At the top: dW2 = ds h^T, db2 = ds

/** The lower half's rows: a caption under the graph, a header row, two rows of cells, a footer. */
const low = (s: Scene) => ({ cap: 53 * s.u, head: 61.5 * s.u, rows: [70.5 * s.u, 80.5 * s.u], foot: 91 * s.u });
const at = (s: Scene, v: number) => s.w / 2 + v * s.u;
const CW = 10.5;
const head = (s: Scene, t: string, x: number, y: number, k: Ink, align: CanvasTextAlign = 'center') => s.text(t, x, y, { size: 3.6, font: 'mono', weight: 650, align, color: s.c(k) });

const top: SceneDef = {
  draw(s) {
    const g = geo(s);
    const L = low(s);
    const dsA = s.ease('ds', 0.6, 1);
    const e00 = s.win('w00', 'w10');
    const e10 = s.win('w10', 'silent');
    const sil = s.ease('silent', 0.6);
    net(s, g, {
      off: 1,
      lEdge: s.win('ds', 'w00'),
      gs: [DS.map(str), [dsA, dsA]],
      w2: (i, j) => (i === 0 && j === 0 ? e00 : i === 1 && j === 0 ? e10 : 0),
      w2Dark: (_, j) => (j === 1 ? sil * (1 - s.ease('db2', 0.6)) : 0),
    });
    // The table: ds down the side, h across the top, dW2 in the cells.
    const gx = [at(s, -1), at(s, 13)];
    const dsx = at(s, -19);
    const dbx = at(s, 33);
    const shown = [[after(s, 'w00', 0.6), after(s, 'silent', 0.25)], [after(s, 'w10', 0.4), after(s, 'silent', 0.25)]];
    s.alpha(dsA, () => {
      head(s, 'ds', dsx, L.head, 'red');
      vcells(s, dsx, L.rows, DS.map(str), 'red', { w: CW, on: [e00, e10] });
    });
    s.alpha(s.ease('w00', 0.6), () => {
      head(s, 'h', gx[0]! - 8 * s.u, L.head, 'gold', 'right');
      cells(s, gx, L.head, H.map(str), 'gold', { w: CW, h: 7.5, on: [Math.max(e00, e10), s.win('silent', 'table')] });
      L.rows.forEach((y, i) => cells(s, gx, y, DW2[i]!.map((v, j) => (shown[i]![j]! > 0.5 ? str(v) : '')), 'red', { w: CW, on: [i === 0 ? e00 : e10, s.win('silent', 'table')] }));
      s.text('×', (dsx + gx[0]!) / 2 - 1.5 * s.u, (L.rows[0]! + L.rows[1]!) / 2, { size: 3.4, font: 'mono', color: s.c('--ink-3') });
    });
    s.alpha(s.ease('table', 0.6), () => s.text('dW₂', (gx[0]! + gx[1]!) / 2, L.foot, { size: 3.6, font: 'mono', weight: 650, color: s.c('red') }));
    s.alpha(s.ease('db2', 0.6), () => {
      head(s, 'db₂', dbx, L.head, 'red');
      vcells(s, dbx, L.rows, DS.map(str), 'red', { w: CW, on: [1, 1] });
    });
    const cy = L.cap;
    s.alpha(s.win('ds', 'w00'), () => caption(s, 'ds = p − onehot(y) = [−0.5, 0.5]', cy, 'red', 3.3));
    s.alpha(e00, () => caption(s, 'h₀ → s₀:  −0.5 × 2 = −1', cy, 'red', 3.5));
    s.alpha(e10, () => caption(s, 'h₀ → s₁:  0.5 × 2 = 1', cy, 'red', 3.5));
    s.alpha(s.win('silent', 'table'), () => caption(s, 'reading h₁ = 0:  × 0 = 0', cy, '--ink-2', 3.5));
    s.alpha(s.win('table', 'db2'), () => caption(s, 'dW₂[i, j] = ds[i] · h[j]', cy, 'red', 3.5));
    s.alpha(s.ease('db2', 0.6), () => caption(s, 'db₂ = ds: each bias adds onto its score', cy, 'red', 3.3));
  },
};

// ---- 3. Back through W2: each hidden unit collects from every score it fed

const down: SceneDef = {
  draw(s) {
    const g = geo(s);
    const L = low(s);
    const [, , ch, cs] = g.xs as [number, number, number, number];
    const Y = ys(g);
    const u0 = s.win('u0', 'u1');
    const u1 = s.win('u1', 'T');
    const unitOn = [Math.max(u0, s.win('fork', 'u0') * after(s, 'fork', 0.4)), u1];
    const shownH = [after(s, 'u0', 0.75), after(s, 'u1', 0.6)];
    net(s, g, {
      off: 1,
      gs: [DS.map(str), [1, 1]],
      gh: [DH.map(str), shownH],
      qH: s.win('fork', 'u0'),
      w2: (_, j) => unitOn[j]!,
    });
    // The gradients running back from both scores into the unit being collected.
    [0, 1].forEach((j) => {
      const t = clamp01((s.since(j ? 'u1' : 'u0') - 0.3) / 1.6);
      if (t > 0 && t < 1) runBack(s, Y.map((y): [number, number, number, number] => [cs, y, ch, Y[j]!]), t);
    });
    // The weights each unit went out on, beside its edges.
    const wl = { size: 3, font: 'mono', weight: 650, halo: true, color: s.c('blue') } as const;
    [0, 1].forEach((j) => s.alpha(unitOn[j]!, () => Y.forEach((y, i) => {
      const [px, py] = along(ch, Y[j]!, cs, y, i === j ? 0.62 : 0.5);
      s.text(`×${str(W2[i]![j]!)}`, px, py + (i === j ? (j ? 2.6 : -2.6) : i ? 3 : -3) * s.u, wl);
    })));
    // ds, W2 with a band down the column being read, and dh under it.
    const gx = [at(s, 3), at(s, 17)];
    const dsx = at(s, -17);
    vcells(s, dsx, L.rows, DS.map(str), 'red', { w: CW, on: [Math.max(u0, u1), Math.max(u0, u1)] });
    head(s, 'ds', dsx, L.head, 'red');
    head(s, 'W₂', (gx[0]! + gx[1]!) / 2, L.head, 'blue');
    const col = [u0, u1];
    col.forEach((a, j) => {
      if (a > 0.003) s.rrect(gx[j]! - (CW / 2 + 1.4) * s.u, L.rows[0]! - 5.6 * s.u, (CW + 2.8) * s.u, L.rows[1]! - L.rows[0]! + 11.2 * s.u, 1.4, { fill: s.tint('blue', 0.1 * a), stroke: s.tint('blue', 0.7 * a), lw: 0.4 });
    });
    L.rows.forEach((y, i) => cells(s, gx, y, W2[i]!.map(str), 'blue', { w: CW, on: col }));
    s.alpha(s.ease('fork', 0.6, 1), () => {
      head(s, 'dh', dsx, L.foot, 'red');
      cells(s, gx, L.foot, DH.map((v, j) => (shownH[j]! > 0.5 ? str(v) : '')), 'red', { w: CW, h: 7.5, on: [u0, u1] });
    });
    const cy = L.cap;
    s.alpha(s.win('fork', 'u0') * (1 - after(s, 'fork', 0.4)), () => caption(s, 'h₀ fed s₀ and s₁: it collects from both', cy, '--ink-2', 3.3));
    s.alpha(s.win('fork', 'u0') * after(s, 'fork', 0.4), () => caption(s, 'back along each edge: ds × weight, summed', cy, 'red', 3.3));
    s.alpha(u0, () => caption(s, '1·(−0.5) + 2·0.5 = 0.5', cy, 'red', 3.6));
    s.alpha(u1, () => caption(s, '(−1)·(−0.5) + 1·0.5 = 1', cy, 'red', 3.6));
    s.alpha(s.ease('T', 0.6), () => caption(s, 'column j of W₂ · ds:  dh = W₂ᵀ ds', cy, 'red', 3.4));
  },
};

// ---- 4. Through the ReLU's mask, then dW1 = dz x^T

const mask: SceneDef = {
  draw(s) {
    const g = geo(s);
    const L = low(s);
    const [cx, cz, ch] = g.xs as [number, number, number];
    const Y = ys(g);
    const on = s.ease('on', 0.6);
    const offA = s.ease('off', 0.6);
    const w = s.ease('dW1', 0.6);
    const dead = s.ease('dead', 0.6);
    net(s, g, {
      off: 1,
      gh: [DH.map(str), [1, 1]],
      gz: [DZ.map(str), [after(s, 'on', 0.5), after(s, 'off', 0.45)]],
      relu: [Math.max(s.win('slope', 'mask'), s.win('on', 'off')), Math.max(s.win('slope', 'on'), s.win('off', 'mask'))],
      dark: offA,
      w1: (i) => (i === 0 ? w : 0),
      w1Dark: (i) => (i === 1 ? dead : 0),
    });
    // The gradient through each ReLU: passed where the unit was on, stopped where it was off.
    const t0 = clamp01((s.since('on') - 0.4) / 1.4);
    if (t0 > 0 && t0 < 1) runBack(s, [[ch, Y[0]!, cz, Y[0]!]], t0);
    const t1 = clamp01((s.since('off') - 0.4) / 1.4) * 0.5;
    if (t1 > 0 && t1 < 0.5) runBack(s, [[ch, Y[1]!, cz, Y[1]!]], t1);
    const tw = clamp01((s.since('dW1') - 0.4) / 1.6);
    if (tw > 0 && tw < 1) runBack(s, Y.map((y): [number, number, number, number] => [cz, Y[0]!, cx, y]), tw);
    const ml = { size: 3, font: 'mono', weight: 700, halo: true } as const;
    s.alpha(s.win('mask', 'dW1'), () => Y.forEach((y, i) => s.text(i ? '×0' : '×1', (cz + ch) / 2, y - 4.6 * s.u, { ...ml, color: s.c(i ? 'red' : 'green') })));
    // z, dh, the mask between them, dz; then x across the top of dW1.
    const zx = at(s, -42);
    const dhx = at(s, -27);
    const dzx = at(s, -9);
    const gx = [at(s, 14), at(s, 28)];
    const mk = s.ease('mask', 0.6);
    const sg = s.win('sign', 'dW1');
    head(s, 'z', zx, L.head, '--ink-2');
    L.rows.forEach((y, i) => s.cell(zx - (CW / 2) * s.u, y - 4.25 * s.u, CW * s.u, 8.5 * s.u, str(Z[i]!), Z[i]! > 0 ? 'green' : 'red', { on: Math.max(mk, sg) }));
    head(s, 'dh', dhx, L.head, 'red');
    vcells(s, dhx, L.rows, DH.map(str), 'red', { w: CW });
    s.alpha(Math.max(mk, offA), () => L.rows.forEach((y, i) => {
      s.arrow(dhx + 6 * s.u, y, dzx - 6 * s.u, y, s.c('--ink-3'), 0.35, 2);
      s.alpha(mk, () => s.text(Z[i]! > 0 ? '×1' : '×0', (dhx + dzx) / 2, y - 3.4 * s.u, { size: 3, font: 'mono', weight: 650, color: s.c(Z[i]! > 0 ? 'green' : 'red'), halo: true }));
    }));
    s.alpha(after(s, 'on', 0.5), () => {
      head(s, 'dz', dzx, L.head, 'red');
      vcells(s, dzx, L.rows, DZ.map((v, i) => (i === 0 || offA > 0.5 ? str(v) : '')), 'red', { w: CW, on: [0, s.win('off', 'mask')] });
    });
    s.alpha(w, () => {
      head(s, 'x', gx[0]! - 7.5 * s.u, L.head, 'orange', 'right');
      cells(s, gx, L.head, X.map(str), 'orange', { w: CW, h: 7.5 });
      L.rows.forEach((y, i) => cells(s, gx, y, DW1[i]!.map((v) => (i === 0 || dead > 0.5 ? str(v) : '')), 'red', { w: CW, on: i === 1 ? [dead, dead] : [s.win('dW1', 'dead'), s.win('dW1', 'dead')] }));
      s.text('dW₁', (gx[0]! + gx[1]!) / 2, L.foot, { size: 3.6, font: 'mono', weight: 650, color: s.c('red') });
    });
    const cy = L.cap;
    s.alpha(s.win('slope', 'on'), () => caption(s, 'ReLU slope: 1 where z > 0, 0 where z < 0', cy, '--ink-2', 3.3));
    s.alpha(s.win('on', 'off'), () => caption(s, 'z₀ = 2: on, 0.5 passes', cy, 'green', 3.5));
    s.alpha(s.win('off', 'mask'), () => caption(s, 'z₁ = −1: off, 1 × 0 = 0', cy, 'red', 3.5));
    s.alpha(s.win('mask', 'sign'), () => caption(s, 'dz = dh * (z > 0): the mask', cy, '--ink-2', 3.5));
    s.alpha(sg, () => caption(s, 'the mask reads z, not the gradient', cy, '--ink-2', 3.4));
    s.alpha(s.win('dW1', 'dead'), () => caption(s, 'row 0: 0.5 × [1, 2] = [0.5, 1]', cy, 'red', 3.4));
    s.alpha(dead, () => caption(s, 'row 1: 0 × [1, 2]: all zeros', cy, '--ink-2', 3.4));
  },
};

export const scenes: Record<string, SceneDef> = { why, top, down, mask };

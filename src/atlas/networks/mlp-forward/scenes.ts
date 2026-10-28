import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { Rng } from '../../../core/rand';
import { cells } from '../../draw';
import { after, caption, Frame, type Ink, rich, unit, vcells } from '../draw';

// One network runs through every scene: x -> h = ReLU(W1 x + b1) -> s = W2 h + b2.
const W1 = [[1, -1], [-1, -1]];
const B1 = [1, 1];
const W2 = [[1, 1], [-1, -1]];
const B2 = [0, 1];
const X = [2, 1];
const Z = [2, -2];
const H = [2, 0];
const S = [2, -1];
const S_NO_RELU = [0, 1];
const str = (v: number) => String(v).replace('-', '−');

/** A jittered grid of points: class 1 fills the V above both hidden units' lines, class 0 wraps around it, a gap between. */
const [C0, C1] = (() => {
  const rng = new Rng(11);
  const c0: [number, number][] = [];
  const c1: [number, number][] = [];
  // Keep clear of the axis names, the units' labels and the point x.
  const clear: [number, number, number][] = [[2.72, 0.3, 0.4], [0.3, 3.7, 0.45], [2.65, -1.7, 0.5], [-2.65, -1.7, 0.5], [2, 1, 0.5]];
  for (let i = 0; i < 9; i++) {
    for (let j = 0; j < 9; j++) {
      const p: [number, number] = [-2.76 + i * 0.69 + rng.uniform(-0.16, 0.16), -1.76 + j * 0.69 + rng.uniform(-0.16, 0.16)];
      if (clear.some(([x, y, r]) => Math.hypot(p[0] - x, p[1] - y) < r)) continue;
      const m = p[1] - Math.abs(p[0]);
      if (m > 1.15) c1.push(p);
      else if (m < 0.25) c0.push(p);
    }
  }
  return [c0, c1];
})();
const K0: Ink = 'purple';
const K1: Ink = 'teal';

/** Where class 0's score h0 + h1 ties class 1's 1 - h0 - h1: h0 + h1 = 1/2, a V with a short flat bottom. */
const BENT: [number, number][] = [[-3, 3.5], [-0.25, 0.75], [0.25, 0.75], [3, 3.5]];
/** The same weights without the ReLU: (W2 W1) x + W2 b1 + b2 ties at x1 = 3/4. */
const FLAT = 0.75;

/** A caption centered under the plane. */
function cap(s: Scene, L: St, text: string, k: Ink = '--ink-2') {
  s.text(text, L.mid, L.cy, { size: 3.3, font: 'mono', color: s.c(k), halo: true });
}

/** Who introduced an idea, and when: small and italic, at (x, y). */
function cite(s: Scene, text: string, a: number, x: number, y: number) {
  s.alpha(a, () => s.text(text, x, y, { size: 3.1, italic: true, color: s.c('--ink-2'), halo: true }));
}

/** The feature plane at the left and a column for the network diagram at the right. */
function stage(s: Scene) {
  const u = s.u;
  const side = Math.min(s.h * 0.76, s.w - 46 * u);
  const l = Math.max(4 * u, (s.w - side - 42 * u) / 2);
  const t = Math.max(3 * u, (s.h - side) / 2 - 7 * u);
  const F = new Frame(s, l, t, l + side, t + side, [-3, 3], [-2, 4]);
  return { F, cx: l + side + 21 * u, mid: l + side / 2, cy: F.b + 6.5 * u };
}
type St = ReturnType<typeof stage>;

function poly(s: Scene, F: Frame, pts: [number, number][], fill: string) {
  const g = s.ctx;
  g.beginPath();
  pts.forEach(([a, b], i) => (i ? g.lineTo(F.X(a), F.Y(b)) : g.moveTo(F.X(a), F.Y(b))));
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}

function path(s: Scene, F: Frame, pts: [number, number][], k: Ink, width: number) {
  const g = s.ctx;
  F.clip(() => {
    g.beginPath();
    pts.forEach(([a, b], i) => (i ? g.lineTo(F.X(a), F.Y(b)) : g.moveTo(F.X(a), F.Y(b))));
    g.strokeStyle = s.c(k);
    g.lineWidth = width * s.u;
    g.lineJoin = 'round';
    g.stroke();
  });
}

/** The plane's frame, axes and axis names. */
function axes(s: Scene, F: Frame) {
  const u = s.u;
  s.rrect(F.l, F.t, F.r - F.l, F.b - F.t, 1, { stroke: s.c('--axis'), lw: 0.3 });
  F.axes();
  const ax = { size: 3.2, font: 'mono', weight: 600, color: s.c('orange'), halo: true } as const;
  s.text('x₀', F.r - 3 * u, F.Y(0) - 3 * u, ax);
  s.text('x₁', F.X(0) + 3.2 * u, F.t + 3.2 * u, ax);
}

/** The two classes; `a0` and `a1` fade each in point by point. */
function points(s: Scene, F: Frame, a0 = 1, a1 = 1) {
  C0.forEach(([a, b], i) => s.alpha(Math.min(1, Math.max(0, a0 * C0.length * 0.4 - i * 0.2)), () => F.dot(a, b, K0, 1)));
  C1.forEach(([a, b], i) => s.alpha(Math.min(1, Math.max(0, a1 * C1.length * 0.4 - i * 0.2)), () => F.dot(a, b, K1, 1)));
}

/** A red ring around each point on the wrong side of `side(p) > 0` (class 1's side). */
function wrong(s: Scene, F: Frame, side: (p: [number, number]) => number, a: number): number {
  const bad: [number, number][] = [...C0.filter((p) => side(p) > 0), ...C1.filter((p) => side(p) < 0)];
  s.alpha(a, () => bad.forEach(([x, y]) => s.circle(F.X(x), F.Y(y), 2.6 * s.u, { stroke: s.c('red'), lw: 0.45 })));
  return bad.length;
}

/** Hidden unit k's output over the plane: clear on its silent side, gold growing on the other. */
function ramp(s: Scene, F: Frame, k: number, a: number) {
  if (a <= 0.003) return;
  const w = W1[k]!;
  const n2 = w[0]! ** 2 + w[1]! ** 2;
  // (0, 1) is on both units' lines; z reaches 6 at the far corner.
  const far = [(w[0]! * 6) / n2, 1 + (w[1]! * 6) / n2];
  const g = s.ctx.createLinearGradient(F.X(0), F.Y(1), F.X(far[0]!), F.Y(far[1]!));
  g.addColorStop(0, s.tint('gold', 0));
  g.addColorStop(1, s.tint('gold', 0.5 * a));
  F.clip(() => {
    s.ctx.fillStyle = g;
    s.ctx.fillRect(F.l, F.t, F.r - F.l, F.b - F.t);
  });
}

/** Hidden unit k's line, where its z is 0. */
function unitLine(s: Scene, F: Frame, k: number, a: number) {
  s.alpha(a, () => F.clip(() => (k === 0 ? F.seg(-3, -2, 3, 4, 'gold', 0.5, [1.4, 1]) : F.seg(-3, 4, 3, -2, 'gold', 0.5, [1.4, 1]))));
}

interface NetOpts {
  /** 0: inputs wired straight to the scores; 1: a hidden row in between. */
  mid: number;
  /** Each hidden unit, 0..1. */
  h?: [number, number];
  /** The hidden units' labels, 0..1 (an empty circle at 0). */
  hl?: number;
  /** The scores and the edges into them, 0..1. */
  out?: number;
  /** The box that names the hidden row a layer. */
  box?: number;
  a?: number;
}

/** The network as circles: inputs at the bottom, scores at the top, the hidden layer between. */
function net(s: Scene, L: St, o: NetOpts) {
  const u = s.u;
  const top = L.F.t;
  const span = L.F.b - L.F.t;
  const yOut = top + span * lerp(0.3, 0.12, o.mid);
  const yIn = top + span * lerp(0.7, 0.88, o.mid);
  const yHid = top + span * 0.5;
  const xs = [L.cx - 8 * u, L.cx + 8 * u];
  const r = 4.3;
  const out = o.out ?? 1;
  const hA = o.h ?? [1, 1];
  const edge = (x0: number, y0: number, x1: number, y1: number, a: number) => {
    if (a <= 0.003) return;
    const d = Math.hypot(x1 - x0, y1 - y0);
    const [ux, uy] = [(x1 - x0) / d, (y1 - y0) / d];
    s.alpha(a, () => s.line(x0 + ux * r * u, y0 + uy * r * u, x1 - ux * r * u, y1 - uy * r * u, s.tint('blue', 0.7), 0.35));
  };
  s.alpha(o.a ?? 1, () => {
    for (const xi of xs) for (const xo of xs) edge(xi, yIn, xo, yOut, (1 - o.mid) * out);
    xs.forEach((xh, k) => {
      for (const xi of xs) edge(xi, yIn, xh, yHid, o.mid * hA[k]!);
      for (const xo of xs) edge(xh, yHid, xo, yOut, o.mid * hA[k]! * out);
    });
    s.alpha(o.box ?? 0, () => {
      s.rrect(xs[0]! - 7 * u, yHid - 6.5 * u, 30 * u, 13 * u, 2, { stroke: s.tint('gold', 0.8), lw: 0.35 });
      s.text('h', xs[1]! + 10.5 * u, yHid, { size: 3.8, font: 'mono', weight: 650, color: s.c('gold') });
    });
    xs.forEach((x, k) => unit(s, x, yIn, r, `x${'₀₁'[k]}`, 'orange', 0, 3.2));
    s.text('x', xs[1]! + 9 * u, yIn, { size: 3.8, font: 'mono', weight: 650, color: s.c('orange') });
    xs.forEach((x, k) => s.alpha(o.mid * hA[k]!, () => unit(s, x, yHid, r, (o.hl ?? 1) > 0.5 ? `h${'₀₁'[k]}` : '', 'gold', 0, 3.2)));
    s.alpha(out, () => {
      xs.forEach((x, k) => unit(s, x, yOut, r, `s${'₀₁'[k]}`, 'purple', 0, 3.2));
      s.text('s', xs[1]! + 9 * u, yOut, { size: 3.8, font: 'mono', weight: 650, color: s.c('purple') });
    });
  });
}

// ---- 1. The V: no straight line splits it

const straight: SceneDef = {
  draw(s) {
    const L = stage(s);
    const F = L.F;
    axes(s, F);
    points(s, F, s.ease('data', 1.2, 0.3), s.ease('data', 1.2, 2.2));
    // A line swings and slides across the beat, then rests where it does best: 2 wrong.
    const p = s.since('line') >= 0 && s.since('book') < 0 ? s.prog('line') : s.since('line') < 0 ? 0 : 1;
    const th = -0.06 + 0.5 * Math.sin(2 * Math.PI * p);
    const y0 = 2.35 + 0.8 * Math.sin(4 * Math.PI * p);
    const [dx, dy] = [Math.cos(th), Math.sin(th)];
    const side = (q: [number, number]) => -dy * q[0] + dx * (q[1] - y0);
    const lineA = s.ease('line', 0.6) * (1 - s.ease('fix', 0.8, 1.5) * 0.6);
    s.alpha(lineA, () => F.clip(() => F.seg(-12 * dx, y0 - 12 * dy, 12 * dx, y0 + 12 * dy, '--ink-2', 0.7)));
    const n = wrong(s, F, side, lineA * after(s, 'line', 0.15));
    net(s, L, { mid: s.ease('fix', 1.2, 1), hl: 0, out: s.ease('line', 0.6), a: s.ease('line', 0.6) });
    const o = { size: 3.3, align: 'center' as const };
    s.alpha(s.win('data', 'line'), () => rich(s, [['class 1', K1], [' inside, ', '--ink-2'], ['class 0', K0], [' around', '--ink-2']], L.mid, L.cy, o));
    s.alpha(after(s, 'line', 0.15) * (1 - s.ease('fix', 0.6)), () => cap(s, L, `one straight line: ${n} wrong`, 'red'));
    cite(s, 'Perceptrons · Minsky & Papert, 1969', s.win('book', 'fix'), L.mid, L.cy + 6.5 * s.u);
    s.alpha(s.ease('fix', 0.6), () => cap(s, L, 'a layer in between', 'gold'));
  },
};

// ---- 2. Each hidden unit draws a line; the scores add them up and the border bends

const lines: SceneDef = {
  draw(s) {
    const L = stage(s);
    const F = L.F;
    const bent = s.ease('bent', 1);
    // The regions each class claims, once the border is in.
    s.alpha(bent, () => F.clip(() => {
      poly(s, F, [...BENT, [3, 4], [-3, 4]], s.tint(K1, 0.12));
      poly(s, F, [...BENT, [3, -2], [-3, -2]], s.tint(K0, 0.1));
    }));
    const r0 = s.ease('n0', 1, 1);
    const r1 = s.ease('n1', 1, 0.6);
    const fade = 1 - 0.85 * bent;
    ramp(s, F, 0, r0 * fade);
    ramp(s, F, 1, r1 * fade);
    axes(s, F);
    unitLine(s, F, 0, r0 * fade);
    unitLine(s, F, 1, r1 * fade);
    const lab = { size: 3.4, font: 'mono', weight: 650, color: s.c('gold'), halo: true } as const;
    s.alpha(r0 * (1 - bent), () => s.text('h₀', F.X(2.65), F.Y(-1.7), lab));
    s.alpha(r1 * (1 - bent), () => s.text('h₁', F.X(-2.65), F.Y(-1.7), lab));
    points(s, F);
    s.alpha(bent, () => path(s, F, BENT, '--ink', 0.8));
    net(s, L, { mid: 1, h: [s.ease('n0', 0.6), s.ease('n1', 0.6)], out: s.ease('score', 0.6), box: s.win('layer', 'score') });
    const cy = L.cy;
    const o = { size: 3.3, align: 'center' as const };
    s.alpha(s.win('n0', 'n1'), () => cap(s, L, 'unit 0: 0 above its line', 'gold'));
    s.alpha(s.win('n1', 'layer'), () => cap(s, L, 'unit 1: its own line', 'gold'));
    s.alpha(s.win('layer', 'hidden'), () => rich(s, [['a layer: ', '--ink-2'], ['h', 'gold'], [' = [h₀, h₁]', '--ink-2']], L.mid, cy, o));
    s.alpha(s.win('hidden', 'score'), () => cap(s, L, 'hidden: not input, not output'));
    cite(s, 'Rumelhart, Hinton & Williams, 1986', s.win('hidden', 'score'), L.mid, cy + 6.5 * s.u);
    s.alpha(s.win('score', 'one'), () => rich(s, [['class 0', K0], [' scores h₀ + h₁', '--ink-2']], L.mid, cy, o));
    s.alpha(s.win('one', 'bent'), () => rich(s, [['class 1', K1], [' scores 1 − h₀ − h₁', '--ink-2']], L.mid, cy, o));
    s.alpha(bent, () => cap(s, L, 'border: where the scores tie', '--ink'));
  },
};

// ---- 3. The same network in numbers

/**
 * Columns of one layer's arithmetic: the input as a row over the weight columns, the weight
 * rows, the bias column, the result column, and an optional column after a ReLU. `dx` shifts the
 * whole figure so a layer without the ReLU column stays centered.
 */
function layout(s: Scene, dx = 0) {
  const at = (v: number) => s.w / 2 + (v + dx) * s.u;
  return { w: [at(-41), at(-28)], b: at(-9), z: at(9), h: at(35), lx: at(-52), yh: s.h * 0.2, ys: [s.h * 0.44, s.h * 0.61] };
}
type L = ReturnType<typeof layout>;

const CW = 11;
const head = (s: Scene, t: string, x: number, y: number, k: Ink) => s.text(t, x, y, { size: 3.8, font: 'mono', weight: 650, color: s.c(k) });
const op = (s: Scene, t: string, x: number, y: number) => s.text(t, x, y, { size: 3.8, font: 'mono', color: s.c('--ink-3') });

/** The input row and the weight rows, with an optional band lighting one row. */
function inputs(s: Scene, L: L, inp: string[], inName: string, inK: Ink, Wm: number[][], wName: string, o: { inA?: number; wA?: number; band?: number[]; inOn?: number } = {}) {
  s.alpha(o.inA ?? 1, () => {
    head(s, inName, L.lx, L.yh, inK);
    cells(s, L.w, L.yh, inp, inK, { w: CW, on: inp.map(() => o.inOn ?? 0) });
  });
  s.alpha(o.wA ?? 1, () => {
    head(s, wName, L.lx, (L.ys[0]! + L.ys[1]!) / 2, 'blue');
    Wm.forEach((r, i) => {
      const band = o.band?.[i] ?? 0;
      if (band > 0.003) {
        const x0 = L.w[0]! - (CW / 2 + 1.6) * s.u;
        const x1 = L.w[1]! + (CW / 2 + 1.6) * s.u;
        s.rrect(x0, L.ys[i]! - 5.9 * s.u, x1 - x0, 11.8 * s.u, 1.6, { fill: s.tint('blue', 0.1 * band), stroke: s.tint('blue', 0.7 * band), lw: 0.4 });
      }
      cells(s, L.w, L.ys[i]!, r.map(str), 'blue', { w: CW, on: r.map(() => band) });
    });
  });
}

/** A column with its header, and the operator in front of each entry. */
function column(s: Scene, L: L, x: number, name: string, k: Ink, vals: string[], a: number[], o: { op?: string; opX?: number; on?: number[] } = {}) {
  if (Math.max(...a) > 0.003) s.alpha(Math.max(...a), () => head(s, name, x, L.yh, k));
  vals.forEach((v, i) => {
    s.alpha(a[i]!, () => {
      if (o.op && o.opX !== undefined) op(s, o.op, o.opX, L.ys[i]!);
      vcells(s, x, [L.ys[i]!], [v], k, { w: CW, on: [o.on?.[i] ?? 0] });
    });
  });
}

/** Layer one: x through W1 and b1 to z, then the ReLU to h. */
function layerOne(s: Scene) {
  const L = layout(s, 3);
  const r0 = s.ease('z0', 0.6);
  const r1 = s.ease('z1', 0.6);
  const band = [r0 * (1 - r1), r1 * (1 - s.ease('h', 0.5))];
  inputs(s, L, X.map(str), 'x', 'orange', W1, 'W₁', { wA: s.ease('W1', 0.6), band, inOn: Math.max(...band) });
  column(s, L, L.b, 'b₁', 'green', B1.map(str), [r0, r1], { op: '+', opX: (L.w[1]! + L.b) / 2 + 0.5 * s.u });
  column(s, L, L.z, 'z', '--ink-2', Z.map(str), [s.ease('z0', 0.6, 1.2), s.ease('z1', 0.6, 1)], { op: '=', opX: (L.b + L.z) / 2, on: band });
  const hA = s.ease('h', 0.6);
  s.alpha(hA, () => {
    L.ys.forEach((y) => s.arrow(L.z + 7 * s.u, y, L.h - 7 * s.u, y, s.c('--ink-3'), 0.4, 2));
    s.text('ReLU', (L.z + L.h) / 2, L.yh, { size: 3.4, font: 'mono', weight: 600, color: s.c('--ink-2') });
  });
  column(s, L, L.h, 'h', 'gold', H.map(str), [s.ease('h', 0.6, 0.6), s.ease('h', 0.6, 1.2)], { on: [0, s.ease('h', 0.6, 1.2)] });
  const cy = s.h * 0.84;
  s.alpha(s.win('z0', 'z1'), () => caption(s, '1·2 + (−1)·1 + 1 = 2', cy, 'blue', 3.8));
  s.alpha(s.win('z1', 'h'), () => caption(s, '(−1)·2 + (−1)·1 + 1 = −2', cy, 'blue', 3.8));
  s.alpha(hA, () => caption(s, 'h = ReLU([2, −2]) = [2, 0]', cy, 'gold', 3.8));
}

/** Layer two: h through W2 and b2 to s; without the ReLU it reads z instead. */
function layerTwo(s: Scene) {
  const L = layout(s, 17);
  const ng = s.ease('forget', 0.6);
  s.alpha(1 - ng, () => inputs(s, L, H.map(str), 'h', 'gold', W2, 'W₂'));
  s.alpha(ng, () => inputs(s, L, Z.map(str), 'z', 'red', W2, 'W₂', { inOn: 1 }));
  const s0 = s.ease('s0', 0.6);
  const s1 = s.ease('s1', 0.6);
  column(s, L, L.b, 'b₂', 'green', B2.map(str), [s0, s1], { op: '+', opX: (L.w[1]! + L.b) / 2 + 0.5 * s.u });
  s.alpha(1 - ng, () => column(s, L, L.z, 's', 'purple', S.map(str), [s.ease('s0', 0.6, 1.4), s.ease('s1', 0.6, 1.2)], { op: '=', opX: (L.b + L.z) / 2, on: [s0 * (1 - s1) + after(s, 's1', 0.55), s1 * (1 - after(s, 's1', 0.55))] }));
  s.alpha(ng, () => column(s, L, L.z, 's', 'red', S_NO_RELU.map(str), [1, 1], { op: '=', opX: (L.b + L.z) / 2, on: [0, 1] }));
  const cy = s.h * 0.84;
  s.alpha(s.win('s0', 's1'), () => caption(s, '1·2 + 1·0 + 0 = 2', cy, 'purple', 3.8));
  s.alpha(s.win('s1', 'forget') * (1 - after(s, 's1', 0.55)), () => caption(s, '(−1)·2 + (−1)·0 + 1 = −1', cy, 'purple', 3.8));
  s.alpha(after(s, 's1', 0.55) * (1 - ng), () => caption(s, 'class 0 wins: x is outside the V', cy, 'purple', 3.6));
  s.alpha(ng, () => caption(s, 'no ReLU: class 1 wins instead', cy, 'red', 3.8));
}

const numbers: SceneDef = {
  draw(s) {
    // The point x on the plane first, then the arithmetic.
    const pA = 1 - s.ease('W1', 0.6);
    s.alpha(pA, () => {
      const L = stage(s);
      const F = L.F;
      F.clip(() => {
        poly(s, F, [...BENT, [3, 4], [-3, 4]], s.tint('teal', 0.12));
        poly(s, F, [...BENT, [3, -2], [-3, -2]], s.tint('purple', 0.1));
      });
      axes(s, F);
      points(s, F);
      path(s, F, BENT, '--ink', 0.8);
      net(s, L, { mid: 1 });
      const xa = s.ease('x', 0.6, 0.8);
      s.alpha(xa, () => {
        F.dot(X[0]!, X[1]!, 'orange', 2);
        s.text('x = [2, 1]', F.X(X[0]!) - 3 * s.u, F.Y(X[1]!) - 4.5 * s.u, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('orange'), halo: true });
      });
      s.alpha(xa, () => cap(s, L, 'x lands on class 0\'s side', 'purple'));
    });
    const two = s.ease('W2', 0.7);
    s.alpha((1 - pA) * (1 - two), () => layerOne(s));
    s.alpha(two, () => layerTwo(s));
  },
};

// ---- 4. Sizes, then what happens without the bend

/** x, h and s as bars of D, H and C numbers, with the weights between; `fold` merges the two maps into one. */
function sizes(s: Scene, cy: number, o: { d: number; h: number; c: number; fold: number }) {
  const u = s.u;
  const xs = [s.w / 2 - 38 * u, s.w / 2, s.w / 2 + 38 * u];
  const len = [40, 20, 8];
  const ks: Ink[] = ['orange', 'gold', 'purple'];
  const names = ['x: D', 'h: H', 's: C'];
  const lab = { size: 3.4, font: 'mono', weight: 650 } as const;
  const bar = (i: number, a: number) =>
    s.alpha(a, () => {
      const hh = len[i]! * u;
      s.rrect(xs[i]! - 2.5 * u, cy - hh / 2, 5 * u, hh, 1, { fill: s.tint(ks[i]!, 0.3), stroke: s.c(ks[i]!), lw: 0.35 });
      s.text(names[i]!, xs[i]!, cy + 25 * u, { ...lab, color: s.c(ks[i]!) });
    });
  const map = (i: number, a: number, w: string, b: string) =>
    s.alpha(a, () => {
      const [x0, x1] = [xs[i]! + 5 * u, xs[i + 1]! - 5 * u];
      s.arrow(x0, cy, x1, cy, s.c('--ink-3'), 0.4, 2);
      s.text(w, (x0 + x1) / 2, cy - 5 * u, { ...lab, color: s.c('blue') });
      s.text(b, (x0 + x1) / 2, cy + 5 * u, { ...lab, size: 3.1, color: s.c('green') });
    });
  bar(0, o.d);
  s.alpha(o.d * (1 - o.fold), () => s.text('3,072', xs[0]!, cy - 25 * u, { ...lab, size: 3.2, color: s.c('orange') }));
  const keep = 1 - o.fold;
  map(0, o.h * keep, 'W₁ (H, D)', 'b₁ (H,)');
  bar(1, o.h * keep);
  map(1, o.c * keep, 'W₂ (C, H)', 'b₂ (C,)');
  bar(2, o.c);
  s.alpha(o.fold, () => {
    const [x0, x1] = [xs[0]! + 5 * u, xs[2]! - 5 * u];
    s.arrow(x0, cy, x1, cy, s.c('blue'), 0.5, 2.4);
    s.text('W₂W₁ (C, D)', s.w / 2, cy - 5 * u, { ...lab, color: s.c('blue') });
  });
}

const collapse: SceneDef = {
  marks: {
    sub1: { tex: String.raw`\syms = \sym{W2}{W_2}(\sym{W1}{W_1}\symx + \sym{b1}{b_1}) + \sym{b2}{b_2}`, x: 0.5, y: 0.1, size: 4.4 },
    sub2: { tex: String.raw`= (\sym{W2}{W_2}\sym{W1}{W_1})\,\symx + (\sym{W2}{W_2}\sym{b1}{b_1} + \sym{b2}{b_2})`, x: 0.5, y: 0.22, size: 4.4 },
  },
  draw(s) {
    const toPlane = after(s, 'one', 0.45, 0.8);
    s.show('sub1', s.ease('sub', 0.6) * (1 - toPlane));
    s.show('sub2', s.ease('mult', 0.6) * (1 - toPlane));
    const cy = s.h * lerp(0.48, 0.6, s.ease('sub', 0.8));
    s.alpha(1 - toPlane, () => {
      sizes(s, cy, { d: s.ease('D', 0.6), h: s.ease('H', 0.6), c: s.ease('C', 0.6), fold: after(s, 'mult', 0.45, 0.8) });
      s.alpha(s.ease('one', 0.6), () => caption(s, 'two linear layers = one linear classifier', s.h * 0.94, 'blue', 3.4));
    });
    s.alpha(toPlane, () => {
      const L = stage(s);
      const F = L.F;
      const bend = s.ease('bend', 1);
      F.clip(() => {
        s.alpha(1 - bend, () => {
          poly(s, F, [[-3, FLAT], [3, FLAT], [3, 4], [-3, 4]], s.tint('teal', 0.12));
          poly(s, F, [[-3, FLAT], [3, FLAT], [3, -2], [-3, -2]], s.tint('purple', 0.1));
        });
        s.alpha(bend, () => {
          poly(s, F, [...BENT, [3, 4], [-3, 4]], s.tint('teal', 0.12));
          poly(s, F, [...BENT, [3, -2], [-3, -2]], s.tint('purple', 0.1));
        });
      });
      axes(s, F);
      points(s, F);
      s.alpha(1 - bend, () => F.clip(() => F.seg(-3, FLAT, 3, FLAT, 'red', 0.8)));
      const n = wrong(s, F, (p) => p[1] - FLAT, 1 - bend);
      s.alpha(bend, () => path(s, F, BENT, '--ink', 0.8));
      net(s, L, { mid: bend });
      s.alpha(1 - bend, () => cap(s, L, `no ReLU: flat, ${n} wrong`, 'red'));
      s.alpha(bend, () => cap(s, L, 'with the ReLU: it bends', '--ink'));
    });
  },
};

export const scenes: Record<string, SceneDef> = { straight, lines, numbers, collapse };

import type { Scene, SceneDef } from '../../../lecture/scene';
import { Rng } from '../../../core/rand';
import { cells } from '../../draw';
import { after, caption, type Ink, matrix, rich, vcells } from '../draw';

const X = [1, 2];
const W1 = [[2, -1], [1, -2]];
const B1 = [1, 0];
const Z = [1, -3];
const H = [1, 0];
const W2 = [[3, 1], [-1, 2]];
const B2 = [0, 1];
const S = [3, 0];
const S_NO_RELU = [0, -6];
const W = [[7, -5], [0, -3]];
const str = (v: number) => String(v).replace('-', '−');

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

const hidden: SceneDef = {
  draw(s) {
    const L = layout(s, 3);
    const r0 = s.ease('z', 0.6);
    const r1 = after(s, 'z', 0.5, 0.6);
    const band = [r0 * (1 - r1), r1 * (1 - s.ease('h', 0.5))];
    inputs(s, L, X.map(str), 'x', 'orange', W1, 'W₁', { inA: s.ease('x', 0.6), wA: s.ease('W1', 0.6), band, inOn: Math.max(...band) });
    column(s, L, L.b, 'b₁', 'green', B1.map(str), [r0, r1], { op: '+', opX: (L.w[1]! + L.b) / 2 + 0.5 * s.u });
    column(s, L, L.z, 'z', '--ink-2', Z.map(str), [s.ease('z', 0.6, 0.8), after(s, 'z', 0.5, 0.6)], { op: '=', opX: (L.b + L.z) / 2, on: band });
    const hA = s.ease('h', 0.6);
    s.alpha(hA, () => {
      L.ys.forEach((y) => s.arrow(L.z + 7 * s.u, y, L.h - 7 * s.u, y, s.c('--ink-3'), 0.4, 2));
      s.text('ReLU', (L.z + L.h) / 2, L.yh, { size: 3.4, font: 'mono', weight: 600, color: s.c('--ink-2') });
    });
    column(s, L, L.h, 'h', 'gold', H.map(str), [s.ease('h', 0.6, 0.6), s.ease('h', 0.6, 1.2)], { on: [0, s.ease('h', 0.6, 1.2)] });
    const cy = s.h * 0.84;
    s.alpha(r0 * (1 - r1), () => caption(s, '2·1 + (−1)·2 + 1 = 1', cy, 'blue', 3.8));
    s.alpha(r1 * (1 - hA), () => caption(s, '1·1 + (−2)·2 + 0 = −3', cy, 'blue', 3.8));
    s.alpha(hA, () => caption(s, 'h = ReLU([1, −3]) = [1, 0]', cy, 'gold', 3.8));
  },
};

const scores: SceneDef = {
  draw(s) {
    const L = layout(s, 17);
    const ng = s.win('forget', 'shapes');
    s.alpha(1 - ng, () => inputs(s, L, H.map(str), 'h', 'gold', W2, 'W₂', { wA: s.ease('W2', 0.6) }));
    s.alpha(ng, () => inputs(s, L, Z.map(str), 'z', '--ink-2', W2, 'W₂', { inOn: 1 }));
    const sA = s.ease('s', 0.6);
    const s1 = after(s, 's', 0.5, 0.6);
    column(s, L, L.b, 'b₂', 'green', B2.map(str), [s.ease('W2', 0.6, 1), s.ease('W2', 0.6, 1)], { op: '+', opX: (L.w[1]! + L.b) / 2 + 0.5 * s.u });
    s.alpha(1 - ng, () => column(s, L, L.z, 's', 'purple', S.map(str), [sA, s1], { op: '=', opX: (L.b + L.z) / 2, on: [sA * (1 - s1), s1 * (1 - s.ease('forget', 0.5))] }));
    s.alpha(ng, () => column(s, L, L.z, 's', 'red', S_NO_RELU.map(str), [1, 1], { op: '=', opX: (L.b + L.z) / 2, on: [1, 0] }));
    const cy = s.h * 0.84;
    s.alpha(sA * (1 - s1), () => caption(s, '3·1 + 1·0 + 0 = 3', cy, 'purple', 3.8));
    s.alpha(s1 * (1 - s.ease('forget', 0.5)), () => caption(s, '(−1)·1 + 2·0 + 1 = 0', cy, 'purple', 3.8));
    s.alpha(ng, () => caption(s, 'no ReLU: class 0 scores 0, not 3', cy, 'red', 3.8));
    s.alpha(s.ease('shapes', 0.6), () => {
      const o = { size: 3.6, weight: 600 };
      rich(s, [['x', 'orange'], [' (D,) → ', '--ink-3'], ['W₁', 'blue'], [' (H, D) → ', '--ink-2'], ['h', 'gold'], [' (H,)', '--ink-3']], s.w / 2, s.h * 0.8, o);
      rich(s, [['h', 'gold'], [' (H,) → ', '--ink-3'], ['W₂', 'blue'], [' (C, H) → ', '--ink-2'], ['s', 'purple'], [' (C,)', '--ink-3']], s.w / 2, s.h * 0.89, o);
    });
  },
};

/** Points of two classes split by a bent boundary, x1 > |x0| - 0.25, fixed at load. */
const PTS = (() => {
  const rng = new Rng(7);
  const out: { x: number; y: number; c: number }[] = [];
  while (out.length < 26) {
    const x = rng.uniform(-0.92, 0.92);
    const y = rng.uniform(-0.92, 0.92);
    const m = y - (Math.abs(x) - 0.25);
    if (Math.abs(m) > 0.12) out.push({ x, y, c: m > 0 ? 1 : 0 });
  }
  return out;
})();

/** A square panel of the two classes, with a straight or a bent boundary. */
function panel(s: Scene, cx: number, cy: number, side: number, title: string, k: Ink, bent: boolean) {
  const half = (side / 2) * s.u;
  const X = (x: number) => cx + x * half;
  const Y = (y: number) => cy - y * half;
  s.rrect(cx - half, cy - half, 2 * half, 2 * half, 1.4, { stroke: s.c('--axis'), lw: 0.3 });
  const c = s.ctx;
  c.save();
  c.beginPath();
  c.rect(cx - half, cy - half, 2 * half, 2 * half);
  c.clip();
  if (bent) {
    s.line(X(-1), Y(0.75), X(0), Y(-0.25), s.c(k), 0.6);
    s.line(X(0), Y(-0.25), X(1), Y(0.75), s.c(k), 0.6);
  } else s.line(X(-1), Y(-0.05), X(1), Y(0.35), s.c(k), 0.6);
  c.restore();
  for (const p of PTS) s.circle(X(p.x), Y(p.y), 0.9 * s.u, { fill: s.tint(p.c ? 'teal' : 'purple', 0.85) });
  s.text(title, cx, cy + half + 4 * s.u, { size: 3.3, font: 'mono', weight: 600, color: s.c(k) });
}

const collapse: SceneDef = {
  marks: {
    sub1: { tex: String.raw`\syms = \sym{W2}{W_2}(\sym{W1}{W_1}\symx + \sym{b1}{b_1}) + \sym{b2}{b_2}`, x: 0.5, y: 0.1, size: 4.6 },
    sub2: { tex: String.raw`= (\sym{W2}{W_2}\sym{W1}{W_1})\,\symx + (\sym{W2}{W_2}\sym{b1}{b_1} + \sym{b2}{b_2})`, x: 0.5, y: 0.22, size: 4.6 },
  },
  draw(s) {
    s.show('sub1', s.ease('sub', 0.6));
    s.show('sub2', after(s, 'sub', 0.55, 0.6));
    const bend = s.ease('bend', 0.8);
    s.alpha(s.ease('sub', 0.6, 0.6) * (1 - bend), () => {
      const cy = s.h * 0.5;
      const gap = 30 * s.u;
      const xs = [s.w / 2 - gap, s.w / 2, s.w / 2 + gap];
      const o = { pw: 10.5, ph: 9.5, w: 9.5, h: 8 };
      matrix(s, xs[0]!, cy, W2.map((r) => r.map(str)), 'blue', o);
      matrix(s, xs[1]!, cy, W1.map((r) => r.map(str)), 'blue', o);
      op(s, '·', (xs[0]! + xs[1]!) / 2, cy);
      const one = s.ease('one', 0.6);
      s.alpha(one, () => {
        op(s, '=', (xs[1]! + xs[2]!) / 2, cy);
        matrix(s, xs[2]!, cy, W.map((r) => r.map(str)), 'blue', { ...o, on: () => s.win('one', 'bend') });
        s.text('W (C, D)', xs[2]!, cy + 14 * s.u, { size: 3.3, font: 'mono', weight: 600, color: s.c('blue') });
      });
      s.text('W₂ (C, H)', xs[0]!, cy + 14 * s.u, { size: 3.3, font: 'mono', weight: 600, color: s.c('blue') });
      s.text('W₁ (H, D)', xs[1]!, cy + 14 * s.u, { size: 3.3, font: 'mono', weight: 600, color: s.c('blue') });
      s.alpha(one, () => caption(s, 'two linear layers = one linear classifier', s.h * 0.84, 'blue', 3.6));
    });
    s.alpha(bend, () => {
      const side = Math.min(40, (s.w / s.u - 26) / 2);
      const cy = s.h * 0.58;
      panel(s, s.w / 2 - (side / 2 + 4) * s.u, cy, side, 'no ReLU: straight', 'red', false);
      panel(s, s.w / 2 + (side / 2 + 4) * s.u, cy, side, 'with ReLU: bent', 'green', true);
    });
  },
};

export const scenes: Record<string, SceneDef> = { hidden, scores, collapse };

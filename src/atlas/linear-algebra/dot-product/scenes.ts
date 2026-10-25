import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { cells, columns, downArrows, rowLabel } from '../../draw';
import { rich } from '../draw';

const fmt = (v: number) => String(v).replace('-', '−');
const sumText = (ps: number[]) => ps.map((p, i) => (i === 0 ? fmt(p) : p < 0 ? ` − ${-p}` : ` + ${p}`)).join('');

/** Rows of a dot product: w, x, their products, and the sum, with beats lighting each step. */
function rows(s: Scene, w: number[], x: number[], b: { mult: string; add: string; hi?: number[] }) {
  const xs = columns(s, w.length, 17);
  const lx = xs[0]! - 11 * s.u;
  const [yw, yx, yp, ys] = [0.12, 0.29, 0.5, 0.67].map((f) => s.h * f);
  const ps = w.map((v, i) => v * x[i]!);
  rowLabel(s, 'w', lx, yw, 'blue');
  cells(s, xs, yw, w.map(fmt), 'blue', { on: b.hi });
  s.alpha(s.ease(b.mult, 0.5), () => xs.forEach((cx) => s.text('×', cx, (yw + yx) / 2, { size: 3.6, font: 'mono', color: s.c('--ink-3') })));
  rowLabel(s, 'x', lx, yx, 'orange');
  cells(s, xs, yx, x.map(fmt), 'orange');
  const m = s.ease(b.mult, 0.8, 0.3);
  s.alpha(m, () => {
    downArrows(s, xs, yx + 6 * s.u, yp - 6 * s.u);
    rowLabel(s, 'w * x', lx, yp, '--ink-2', 3.6);
    cells(s, xs, yp, ps.map(fmt), 'gold', { on: b.hi ?? ps.map(() => s.win(b.mult, b.add)) });
  });
  s.alpha(s.ease(b.add, 0.6), () => {
    const total = ps.reduce((p, q) => p + q, 0);
    rich(s, [['w', 'blue'], [' · ', '--ink-2'], ['x', 'orange'], [` = ${sumText(ps)} = `, '--ink-2'], [fmt(total), 'gold']], s.w / 2, ys, { size: 4.4, weight: 600 });
  });
  return { xs, yp };
}

const W = [2, -1, 3];
const X = [1, 4, 2];

const multiply: SceneDef = {
  marks: {
    f: { tex: String.raw`\symw \cdot \symx = \sum_i \symw_i\, \symx_i`, x: 0.5, y: 0.85, size: 5.4 },
  },
  draw(s) {
    const weigh = s.ease('weigh', 0.6);
    const { xs, yp } = rows(s, W, X, { mult: 'mult', add: 'add', hi: weigh > 0 ? [0, weigh, 0] : undefined });
    s.show('f', s.ease('formula', 0.6));
    s.alpha(weigh, () => {
      s.rrect(xs[1]! - 7.6 * s.u, yp - 5.8 * s.u, 15.2 * s.u, 11.6 * s.u, 2, { stroke: s.c('red'), lw: 0.4 });
      s.text('counts against', xs[1]!, yp + 8.6 * s.u, { size: 3, font: 'mono', color: s.c('red'), halo: true });
    });
  },
};

const W2 = [2, 1];
const XS = [[3, 1], [-1, 2], [-2, -1]];
// Angles unwrapped so x keeps turning the same way.
const polar = XS.map(([a, b]) => ({ r: Math.hypot(a!, b!), t: Math.atan2(b!, a!) }));
polar[2]!.t += 2 * Math.PI;
/** Plane box in plane units: the region the arrows live in. */
const BOX = { x0: -3.2, x1: 3.6, y0: -2.4, y1: 2.6 };

/** The plane box clipped to w · p >= 0 (`side` 1) or <= 0 (`side` -1), as a polygon in plane units. */
function halfBox(side: number): [number, number][] {
  const box: [number, number][] = [[BOX.x0, BOX.y0], [BOX.x1, BOX.y0], [BOX.x1, BOX.y1], [BOX.x0, BOX.y1]];
  const f = (p: [number, number]) => side * (W2[0]! * p[0] + W2[1]! * p[1]);
  const out: [number, number][] = [];
  box.forEach((p, i) => {
    const q = box[(i + 1) % box.length]!;
    if (f(p) >= 0) out.push(p);
    if (f(p) * f(q) < 0) {
      const t = f(p) / (f(p) - f(q));
      out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
    }
  });
  return out;
}
const POS = halfBox(1);
const NEG = halfBox(-1);

const sign: SceneDef = {
  draw(s) {
    const k = (s.tall ? 12 : 11.5) * s.u;
    const ox = s.w / 2 - ((BOX.x0 + BOX.x1) / 2) * k;
    const oy = 6 * s.u + BOX.y1 * k;
    const P = (x: number, y: number): [number, number] => [ox + x * k, oy - y * k];
    const agree = s.ease('agree', 0.8);
    s.alpha(agree, () => {
      const c = s.ctx;
      for (const [poly, col] of [[POS, 'green'], [NEG, 'red']] as const) {
        c.beginPath();
        poly.forEach(([x, y], i) => (i ? c.lineTo(...P(x, y)) : c.moveTo(...P(x, y))));
        c.closePath();
        c.fillStyle = s.tint(col, 0.09);
        c.fill();
      }
      s.line(...P(-1.2, 2.4), ...P(1.2, -2.4), s.c('--ink-3'), 0.35, [1.4, 1.2]);
      s.text('w · x > 0', ...P(2.35, -1.75), { size: 3.2, font: 'mono', weight: 600, color: s.c('green'), halo: true });
      s.text('w · x < 0', ...P(-2.2, 1.95), { size: 3.2, font: 'mono', weight: 600, color: s.c('red'), halo: true });
    });
    s.line(...P(BOX.x0, 0), ...P(BOX.x1, 0), s.c('--axis'), 0.3);
    s.line(...P(0, BOX.y0), ...P(0, BOX.y1), s.c('--axis'), 0.3);
    // x turns: angle and length move from one target to the next.
    const a1 = s.ease('perp', 1.4);
    const a2 = s.ease('opp', 1.4);
    const r = lerp(lerp(polar[0]!.r, polar[1]!.r, a1), polar[2]!.r, a2);
    const t = lerp(lerp(polar[0]!.t, polar[1]!.t, a1), polar[2]!.t, a2);
    const x = [r * Math.cos(t), r * Math.sin(t)];
    const tip = (v: number[], d: number) => P(v[0]! * (1 + d / Math.hypot(v[0]!, v[1]!)), v[1]! * (1 + d / Math.hypot(v[0]!, v[1]!)));
    s.alpha(s.ease('arrows', 0.6), () => {
      s.arrow(...P(0, 0), ...P(W2[0]!, W2[1]!), s.c('blue'), 0.7, 3);
      s.text('w', ...tip(W2, 0.45), { size: 4.2, font: 'mono', weight: 650, color: s.c('blue'), halo: true });
    });
    const xa = s.ease('same', 0.6);
    s.alpha(xa, () => {
      s.arrow(...P(0, 0), ...P(x[0]!, x[1]!), s.c('orange'), 0.7, 3);
      s.text('x', ...tip(x, 0.45), { size: 4.2, font: 'mono', weight: 650, color: s.c('orange'), halo: true });
    });
    // Right-angle mark while x is perpendicular to w.
    s.alpha(s.ease('perp', 0.4, 1.3) * (1 - s.ease('opp', 0.3)), () => {
      const q = 0.35;
      const u1 = W2.map((v) => (v / Math.hypot(...W2)) * q);
      const u2 = XS[1]!.map((v) => (v / Math.hypot(...XS[1]!)) * q);
      const a = P(u1[0]!, u1[1]!);
      const b = P(u1[0]! + u2[0]!, u1[1]! + u2[1]!);
      const c = P(u2[0]!, u2[1]!);
      s.line(...a, ...b, s.c('--ink-2'), 0.3);
      s.line(...b, ...c, s.c('--ink-2'), 0.3);
    });
    s.alpha(xa, () => {
      const v = Math.round(W2[0]! * x[0]! + W2[1]! * x[1]!);
      const col = v > 0 ? 'green' : v < 0 ? 'red' : '--ink';
      const yr = oy + -BOX.y0 * k + 10 * s.u;
      rich(s, [['w', 'blue'], [' · ', '--ink-2'], ['x', 'orange'], [' = ', '--ink-2'], [fmt(v), col]], s.w / 2, yr, { size: 5, weight: 650 });
      XS.forEach((xv, i) => {
        const beat = ['same', 'perp', 'opp'][i]!;
        const next = ['perp', 'opp', undefined][i];
        const a = s.ease(beat, 0.5, i ? 1.4 : 0.2) * (next ? 1 - s.ease(next, 0.3) : 1);
        s.alpha(a, () => s.text(`2×${xv[0]! < 0 ? `(${fmt(xv[0]!)})` : xv[0]} + 1×${xv[1]! < 0 ? `(${fmt(xv[1]!)})` : xv[1]}`, s.w / 2, yr + 9 * s.u, { size: 3.8, font: 'mono', color: s.c('--ink-3') }));
      });
    });
  },
};

export const scenes: Record<string, SceneDef> = { multiply, sign };

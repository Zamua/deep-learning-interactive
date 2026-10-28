import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { cells, columns, downArrows, rowLabel } from '../../draw';
import { after, Frame } from '../../networks/draw';
import { type Ink, rich } from '../draw';

const fmt = (v: number) => String(v).replace('-', '−');
const par = (v: number) => (v < 0 ? `(${fmt(v)})` : fmt(v));
const sumText = (ps: number[]) => ps.map((p, i) => (i === 0 ? fmt(p) : p < 0 ? ` − ${-p}` : ` + ${p}`)).join('');
const signInk = (v: number): Ink => (v > 0 ? 'green' : v < 0 ? 'red' : '--ink');

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

// ---- two arrows from the origin: agreement along each direction, added up

const W2 = [2, 1];
/** x at rest: the same way, a right angle, then pointing apart. */
const XS = [[3, 1], [-1, 2], [-2, -1]];
// Angles unwrapped so x keeps turning the same way.
const polar = XS.map(([a, b]) => ({ r: Math.hypot(a!, b!), t: Math.atan2(b!, a!) }));
polar[2]!.t += 2 * Math.PI;
const XR: [number, number] = [-3, 4];
const YR: [number, number] = [-2, 2.8];

/** The plane box clipped to w · p >= 0 (`side` 1) or <= 0 (`side` -1), as a polygon in plane units. */
function halfBox(side: number): [number, number][] {
  const box: [number, number][] = [[XR[0], YR[0]], [XR[1], YR[0]], [XR[1], YR[1]], [XR[0], YR[1]]];
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

/** The plane beside its working on a wide stage, above it on a phone. */
const stacked = (s: Scene) => s.tall || s.w / s.h < 1.45;

function plane(s: Scene) {
  const u = s.u;
  const ratio = (XR[1] - XR[0]) / (YR[1] - YR[0]);
  const st = stacked(s);
  const hh = st ? Math.min(s.h * 0.56, (s.w - 16 * u) / ratio) : Math.min(s.h * 0.84, (s.w * 0.56) / ratio);
  const ww = hh * ratio;
  const l = st ? s.w / 2 - ww / 2 : s.w * 0.04;
  const t = st ? 7 * u : (s.h - hh) / 2;
  const F = new Frame(s, l, t, l + ww, t + hh, XR, YR);
  const cx = st ? s.w / 2 : (F.r + s.w) / 2;
  const y0 = st ? F.b + 7 * u : s.h * 0.34;
  return { F, cx, y: (i: number) => y0 + i * 7.5 * u };
}

/** Which resting x the working shows: 0 until x has turned, then 1, then 2. */
function stateAt(s: Scene): { k: number; a: number } {
  const a1 = s.ease('perp', 0.5);
  const b1 = s.ease('perp', 0.5, 1.4);
  const a2 = s.ease('opp', 0.5);
  const b2 = s.ease('opp', 0.5, 1.4);
  if (s.since('opp') >= 0) return b2 > 0 ? { k: 2, a: b2 } : { k: 1, a: 1 - a2 };
  if (s.since('perp') >= 0) return b1 > 0 ? { k: 1, a: b1 } : { k: 0, a: 1 - a1 };
  return { k: 0, a: 1 };
}

const agree: SceneDef = {
  draw(s) {
    const u = s.u;
    const { F, cx, y } = plane(s);
    const P = (x: number, yy: number): [number, number] => [F.X(x), F.Y(yy)];

    // The two sides of w, once the sign has a meaning.
    const sign = s.ease('sign', 0.8);
    s.alpha(sign, () => {
      const c = s.ctx;
      for (const [poly, col] of [[POS, 'green'], [NEG, 'red']] as const) {
        c.beginPath();
        poly.forEach(([a, b], i) => (i ? c.lineTo(...P(a, b)) : c.moveTo(...P(a, b))));
        c.closePath();
        c.fillStyle = s.tint(col, 0.09);
        c.fill();
      }
      F.clip(() => s.line(...P(-1.4, 2.8), ...P(1, -2), s.c('--ink-3'), 0.35, [1.4, 1.2]));
      const lab = { size: 3.2, font: 'mono', weight: 600, halo: true } as const;
      s.text('w · x > 0', ...P(2.9, -1.4), { ...lab, color: s.c('green') });
      s.text('w · x < 0', ...P(-2, 1.9), { ...lab, color: s.c('red') });
    });

    F.axes();
    const tk = { size: 2.6, font: 'mono', color: s.c('--ink-3'), halo: true } as const;
    // Clear of the bars that run along the axes.
    for (const v of [-2, -1, 1, 2, 3]) s.text(fmt(v), F.X(v), F.Y(0) + 4.4 * u, tk);
    for (const v of [-1, 1, 2]) s.text(fmt(v), F.X(0) - 3.4 * u, F.Y(v), { ...tk, align: 'right' });
    s.alpha(s.win('question', 'x'), () => {
      F.dot(0, 0, '--ink-2', 1);
      s.text('origin', F.X(0) - 2 * u, F.Y(0) - 3 * u, { size: 3, font: 'mono', weight: 600, align: 'right', color: s.c('--ink-2'), halo: true });
    });

    // x turns: its angle and length move from one resting place to the next.
    const a1 = s.ease('perp', 1.4);
    const a2 = s.ease('opp', 1.4);
    const r = lerp(lerp(polar[0]!.r, polar[1]!.r, a1), polar[2]!.r, a2);
    const t = lerp(lerp(polar[0]!.t, polar[1]!.t, a1), polar[2]!.t, a2);
    const x = [r * Math.cos(t), r * Math.sin(t)];

    // Each arrow's part along a direction, as a bar beside that axis: w on one side, x on the other.
    const bar = (from: [number, number], to: [number, number], k: Ink) => s.line(from[0], from[1], to[0], to[1], s.c(k), 1.1);
    const off = 1.4 * u;
    s.alpha(0.85 * s.ease('across', 0.6), () => {
      bar([F.X(0), F.Y(0) - off], [F.X(W2[0]!), F.Y(0) - off], 'blue');
      bar([F.X(0), F.Y(0) + off], [F.X(x[0]!), F.Y(0) + off], 'orange');
    });
    s.alpha(0.85 * s.ease('up', 0.6), () => {
      bar([F.X(0) - off, F.Y(0)], [F.X(0) - off, F.Y(W2[1]!)], 'blue');
      bar([F.X(0) + off, F.Y(0)], [F.X(0) + off, F.Y(x[1]!)], 'orange');
    });

    const tip = (v: number[], d: number) => {
      const n = Math.hypot(v[0]!, v[1]!);
      return P(v[0]! * (1 + d / n), v[1]! * (1 + d / n));
    };
    const name = { size: 4.2, font: 'mono', weight: 650, halo: true } as const;
    s.alpha(s.ease('question', 0.6), () => s.arrow(...P(0, 0), ...P(W2[0]!, W2[1]!), s.c('blue'), 0.7, 3));
    s.alpha(s.ease('w', 0.6), () => s.text('w', ...tip(W2, 0.42), { ...name, color: s.c('blue') }));
    s.alpha(s.ease('question', 0.6, 0.6), () => s.arrow(...P(0, 0), ...P(x[0]!, x[1]!), s.c('orange'), 0.7, 3));
    s.alpha(s.ease('x', 0.6), () => s.text('x', ...tip(x, 0.42), { ...name, color: s.c('orange') }));

    // Right-angle mark while x is perpendicular to w.
    s.alpha(s.ease('perp', 0.4, 1.3) * (1 - s.ease('opp', 0.3)), () => {
      const q = 0.32;
      const u1 = W2.map((v) => (v / Math.hypot(...W2)) * q);
      const u2 = XS[1]!.map((v) => (v / Math.hypot(...XS[1]!)) * q);
      const a = P(u1[0]!, u1[1]!);
      const b = P(u1[0]! + u2[0]!, u1[1]! + u2[1]!);
      const c = P(u2[0]!, u2[1]!);
      s.line(...a, ...b, s.c('--ink-2'), 0.3);
      s.line(...b, ...c, s.c('--ink-2'), 0.3);
    });

    cite(s, 'Josiah Willard Gibbs, 1881', s.win('gibbs', 'perp'));

    // The working: the two vectors, then each direction's product, then the sum.
    const o = { size: stacked(s) ? 3.6 : 3.8, weight: 600 } as const;
    s.alpha(s.win('w', 'across'), () => rich(s, [['w', 'blue'], [` = [${W2.join(', ')}]`, '--ink-2']], cx, y(0), o));
    s.alpha(s.win('x', 'across'), () => rich(s, [['x', 'orange'], [` = [${XS[0]!.join(', ')}]`, '--ink-2']], cx, y(1), o));
    const st = stateAt(s);
    const xv = XS[st.k]!;
    const ps = W2.map((wv, i) => wv * xv[i]!);
    const total = ps[0]! + ps[1]!;
    const shown = [
      st.k === 0 ? s.ease('across', 0.6) : 1,
      st.k === 0 ? s.ease('up', 0.6) : st.k === 1 ? s.ease('cancel', 0.6) : after(s, 'opp', 0.45),
      st.k === 0 ? s.ease('sum', 0.6) : st.k === 1 ? after(s, 'cancel', 0.5) : after(s, 'opp', 0.7),
    ];
    const lead = (t: string): [string, Ink] => [t.padEnd(8), '--ink-3'];
    s.alpha(st.a, () => {
      // Left-aligned so the two directions line up.
      ['across', 'up'].forEach((dir, i) => s.alpha(shown[i]!, () => rich(s, [lead(dir), [fmt(W2[i]!), 'blue'], [' × ', '--ink-2'], [par(xv[i]!), 'orange'], [' = ', '--ink-2'], [fmt(ps[i]!), signInk(ps[i]!)]], cx - 22 * u, y(i), { ...o, align: 'left' })));
      const named = s.ease('dot', 0.6);
      s.alpha(shown[2]!, () => {
        s.alpha(1 - named, () => rich(s, [[`${sumText(ps)} = `, '--ink-2'], [fmt(total), signInk(total)]], cx, y(2), { ...o, size: o.size + 0.4 }));
        s.alpha(named, () => rich(s, [['w', 'blue'], [' · ', '--ink-2'], ['x', 'orange'], [` = ${sumText(ps)} = `, '--ink-2'], [fmt(total), signInk(total)]], cx, y(2), { ...o, size: o.size + 0.4 }));
      });
    });
    const cap = { size: 3.4, font: 'mono', color: s.c('--ink-2'), halo: true } as const;
    s.alpha(s.win('question', 'w'), () => s.text('how much do they agree?', cx, y(1), cap));
    s.alpha(s.win('across', 'sum'), () => s.text('same way along it: positive', cx, y(3), { ...cap, color: s.c('green') }));
    s.alpha(s.win('sum', 'gibbs'), () => s.text('the dot product', cx, y(3), cap));
    s.alpha(s.win('right', 'opp'), () => s.text('at 90°: perpendicular', cx, y(3), cap));
    s.alpha(s.ease('sign', 0.6), () => s.text('under 90° > 0, past 90° < 0', cx, y(3), cap));
  },
};

// ---- longer vectors: the same pairs, multiplied and added, then Σ

/** Rows of a dot product: w, x, their products, and the sum, with beats lighting each step. */
function rows(s: Scene, w: number[], x: number[], b: { mult: string; add: string; hi?: number[] }) {
  const xs = columns(s, w.length, 17);
  const lx = xs[0]! - 11 * s.u;
  const [yw, yx, yp, ys] = [0.14, 0.31, 0.52, 0.69].map((f) => s.h * f);
  const ps = w.map((v, i) => v * x[i]!);
  rowLabel(s, 'w', lx, yw, 'blue');
  cells(s, xs, yw, w.map(fmt), 'blue', { on: b.hi });
  s.alpha(s.ease(b.mult, 0.5), () => xs.forEach((cx) => s.text('×', cx, (yw + yx) / 2, { size: 3.6, font: 'mono', color: s.c('--ink-3') })));
  rowLabel(s, 'x', lx, yx, 'orange');
  cells(s, xs, yx, x.map(fmt), 'orange', { on: b.hi });
  s.alpha(s.ease(b.mult, 0.8, 0.3), () => {
    downArrows(s, xs, yx + 6 * s.u, yp - 6 * s.u);
    rowLabel(s, 'w * x', lx, yp, '--ink-2', 3.6);
    xs.forEach((cx, i) => s.alpha(after(s, b.mult, 0.3 + 0.15 * i), () => cells(s, [cx], yp, [fmt(ps[i]!)], 'gold', { on: [b.hi?.[i] ?? s.win(b.mult, b.add)] })));
  });
  s.alpha(s.ease(b.add, 0.6), () => {
    const total = ps.reduce((p, q) => p + q, 0);
    rich(s, [['w', 'blue'], [' · ', '--ink-2'], ['x', 'orange'], [` = ${sumText(ps)} = `, '--ink-2'], [fmt(total), 'gold']], s.w / 2, ys, { size: 4.4, weight: 600 });
  });
  return { xs, yw, yp };
}

const W = [2, -1, 3];
const X = [1, 4, 2];

const multiply: SceneDef = {
  marks: {
    f: { tex: String.raw`\symw \cdot \symx = \sum_i \symw_i\, \symx_i`, x: 0.5, y: 0.86, size: 5.4 },
  },
  draw(s) {
    const u = s.u;
    // Σ visits every position in turn; then one position stands for them all.
    const sp = s.prog('sigma');
    const sweep = s.since('sigma') >= 0 && s.since('wi') < 0 && sp > 0.6 ? Math.min(2, Math.floor((sp - 0.6) / 0.12)) : -1;
    const at = s.since('wi') >= 0 && s.since('weigh') < 0 ? 2 : sweep;
    const weigh = s.ease('weigh', 0.6);
    const hi = at >= 0 ? W.map((_, i) => (i === at ? 1 : 0)) : weigh > 0 ? [0, weigh, 0] : undefined;
    const { xs, yw, yp } = rows(s, W, X, { mult: 'mult', add: 'add', hi });
    s.show('f', s.ease('sigma', 0.6));
    s.alpha(at >= 0 ? s.ease('sigma', 0.4, 0.4) * (1 - s.ease('weigh', 0.4)) : 0, () => {
      const lab = s.since('wi') >= 0 ? 'i' : `i = ${at}`;
      s.text(lab, xs[at]!, yw - 7.2 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('--ink-2'), halo: true });
    });
    s.alpha(weigh, () => {
      s.rrect(xs[1]! - 7.6 * u, yp - 5.8 * u, 15.2 * u, 11.6 * u, 2, { stroke: s.c('red'), lw: 0.4 });
      s.text('counts against', xs[1]!, yp + 8.6 * u, { size: 3, font: 'mono', color: s.c('red'), halo: true });
    });
  },
};

// ---- one entry unknown: the known pairs, then the rest

interface Missing {
  w: number[];
  x: number[];
  /** Index of the unknown entry, shown as `a`. */
  k: number;
  /** Beats: the givens, the known products, then each line of the solve. */
  given: string;
  known: string;
  lines: [string, string][];
}

const M1: Missing = { w: [2, 1, 3], x: [1, 2, 2], k: 1, given: 'p1', known: 'known', lines: [['known', '2 + 6 = 8'], ['a1', 'a = 10 − 8 = 2']] };
const M2: Missing = { w: [3, 2, 1], x: [1, 3, 4], k: 1, given: 'p2', known: 'k2', lines: [['k2', '3 + 4 = 7'], ['rest', '2a = 13 − 7 = 6'], ['a2', 'a = 6 / 2 = 3']] };

/** A dot product with one entry of x unknown, solved line by line under its rows. */
function missing(s: Scene, m: Missing, a: number) {
  s.alpha(a, () => {
    const xs = columns(s, m.w.length, 17);
    const lx = xs[0]! - 11 * s.u;
    const [yw, yx, yp] = [0.12, 0.28, 0.45].map((f) => s.h * f);
    const v = m.w.reduce((t, wi, i) => t + wi * m.x[i]!, 0);
    const last = m.lines[m.lines.length - 1]![0];
    const solved = s.ease(last, 0.6, 1.4);
    rowLabel(s, 'w', lx, yw, 'blue');
    cells(s, xs, yw, m.w.map(fmt), 'blue', { on: m.w.map((_, i) => (i === m.k ? s.ease(last, 0.6) * (m.w[m.k] === 1 ? 0 : 1) : 0)) });
    xs.forEach((cx) => s.text('×', cx, (yw + yx) / 2, { size: 3.6, font: 'mono', color: s.c('--ink-3') }));
    rowLabel(s, 'x', lx, yx, 'orange');
    cells(s, xs, yx, m.x.map((xi, i) => (i === m.k ? (solved > 0.5 ? fmt(xi) : 'a') : fmt(xi))), 'orange', { on: m.x.map((_, i) => (i === m.k ? 1 : 0)) });
    s.alpha(s.ease(m.known, 0.6), () => {
      downArrows(s, xs, yx + 6 * s.u, yp - 6 * s.u);
      rowLabel(s, 'w * x', lx, yp, '--ink-2', 3.6);
      const ps = m.w.map((wi, i) => (i === m.k ? (wi === 1 ? 'a' : `${wi}a`) : fmt(wi * m.x[i]!)));
      cells(s, xs, yp, ps, 'gold', { on: ps.map((_, i) => (i === m.k ? 0 : 1)) });
    });
    s.alpha(s.ease(m.given, 0.6, 1), () => rich(s, [['w', 'blue'], [' · ', '--ink-2'], ['x', 'orange'], [` = ${v}`, '--ink-2']], s.w / 2, s.h * 0.6, { size: 4.2, weight: 600 }));
    m.lines.forEach(([beat, t], i) => {
      const end = i === m.lines.length - 1;
      s.alpha(s.ease(beat, 0.6, 0.8), () => s.text(t, s.w / 2, s.h * (0.71 + 0.1 * i), { size: 4, font: 'mono', weight: end ? 650 : 500, color: s.c(end ? 'gold' : '--ink-2') }));
    });
  });
}

const solve: SceneDef = {
  draw(s) {
    const swap = s.ease('p2', 0.6);
    missing(s, M1, 1 - swap);
    missing(s, M2, swap);
  },
};

export const scenes: Record<string, SceneDef> = { agree, multiply, solve };

import { type Scene, type SceneDef, lerp } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { after, Frame } from '../../networks/draw';
import { cells, columns, downArrows, rowLabel } from '../modern-draw';

type Ink = Color | `--${string}`;

const sig = (z: number) => 1 / (1 + Math.exp(-z));
const swish = (z: number) => z * sig(z);
const relu = (z: number) => Math.max(0, z);

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** Mono text, faded in by `a`. */
function label(s: Scene, text: string, x: number, y: number, a: number, k: Ink = '--ink-2', o: { size?: number; align?: CanvasTextAlign; weight?: number } = {}) {
  s.alpha(a, () => s.text(text, x, y, { size: o.size ?? 3.3, font: 'mono', weight: o.weight ?? 550, align: o.align ?? 'center', color: s.c(k), halo: true }));
}

/** A labelled bar standing for a vector, `w` stage units wide, centered on (x, y). */
function slab(s: Scene, x: number, y: number, w: number, text: string, k: Ink, on = 0): void {
  s.rrect(x - (w / 2) * s.u, y - 4 * s.u, w * s.u, 8 * s.u, 1.4, { fill: s.tint(k, 0.14 + 0.2 * on), stroke: s.tint(k, 0.6 + 0.4 * on), lw: 0.35 });
  if (text) s.text(text, x, y + 0.2 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c(k) });
}

const down = (s: Scene, x0: number, y0: number, x1: number, y1: number) => s.arrow(x0, y0, x1, y1, s.c('--ink-3'), 0.35, 2);

// ---- one number, two jobs: a ReLU unit, the LSTM's gate, and the gated linear unit

const why: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const cy = s.h * 0.93;

    // The block's MLP, and one of its hidden units.
    s.alpha(1 - s.ease('one', 0.6), () => {
      const [y0, y1, y2] = [0.16, 0.42, 0.68].map((f) => s.h * f);
      slab(s, cx, y0, 16, 'x: d', 'orange');
      down(s, cx, y0 + 4.5 * u, cx, y1 - 4.5 * u);
      slab(s, cx, y1, 64, '4d, then ReLU', 'slate');
      down(s, cx, y1 + 4.5 * u, cx, y2 - 4.5 * u);
      slab(s, cx, y2, 16, 'd', 'slate');
      s.alpha(after(s, 'old', 0.6), () => {
        const ux = cx + 20 * u;
        s.rrect(ux - 3 * u, y1 - 4 * u, 6 * u, 8 * u, 1, { fill: s.tint('gold', 0.45), stroke: s.c('gold'), lw: 0.4 });
        s.text('one unit', ux, y1 + 7.5 * u, { size: 3.1, font: 'mono', weight: 650, color: s.c('gold') });
      });
    });

    // The unit's ReLU: the same z says whether it is on and how much it passes.
    s.alpha(s.win('one', 'lstm'), () => {
      const F = new Frame(s, cx - 34 * u, s.h * 0.1, cx + 34 * u, s.h * 0.8, [-3, 3], [-0.8, 3.2]);
      s.rrect(F.X(-3), F.t, F.X(0) - F.X(-3), F.b - F.t, 0, { fill: s.tint('slate', 0.08) });
      s.rrect(F.X(0), F.t, F.X(3) - F.X(0), F.b - F.t, 0, { fill: s.tint('gold', 0.08) });
      F.axes();
      s.text('off', F.X(-1.5), F.Y(2.4), { size: 3.4, font: 'mono', weight: 650, color: s.c('slate') });
      s.text('on', F.X(1.5), F.Y(2.9), { size: 3.4, font: 'mono', weight: 650, color: s.c('gold') });
      F.fn(relu, 'gold', 0.7);
      const z = lerp(-2.4, 1.8, Math.min(1, s.prog('one') * 1.25));
      F.seg(z, 0, z, relu(z), 'gold', 0.3, [1, 0.8]);
      F.dot(z, relu(z), 'gold', 1.4);
      F.dot(z, 0, 'purple', 1);
      s.text('z', F.X(z), F.Y(0) + 4 * u, { size: 3.6, font: 'mono', weight: 700, color: s.c('purple'), halo: true });
      s.alpha(s.ease('jobs', 0.6), () => {
        s.text('how much: z', F.X(z) + 2 * u, F.Y(z / 2), { size: 3.1, font: 'mono', weight: 600, align: 'left', color: s.c('gold'), halo: true });
        s.text('on, since z > 0', F.X(z), F.Y(0) + 9 * u, { size: 3.1, font: 'mono', weight: 600, color: s.c('purple'), halo: true });
      });
    });

    // The LSTM's gate: a dial from 0 to 1 that multiplies a signal.
    s.alpha(s.win('lstm', 'glu'), () => {
      const g = 0.5 + 0.5 * Math.cos(2 * Math.PI * 0.75 * s.prog('lstm'));
      const base = s.h * 0.74;
      const full = s.h * 0.48;
      const xs = [cx - 30 * u, cx, cx + 30 * u];
      const bw = 10 * u;
      const bar = (x: number, hgt: number, k: Ink) => s.rrect(x - bw / 2, base - hgt, bw, Math.max(hgt, 0.4 * u), 1, { fill: s.tint(k, 0.4), stroke: s.c(k), lw: 0.35 });
      bar(xs[0]!, full, 'blue');
      s.rrect(xs[1]! - 1 * u, base - full, 2 * u, full, 1, { fill: s.tint('purple', 0.15), stroke: s.tint('purple', 0.6), lw: 0.3 });
      s.circle(xs[1]!, base - g * full, 2.6 * u, { fill: s.c('purple'), stroke: s.c('--card'), lw: 0.4 });
      bar(xs[2]!, g * full, 'green');
      const mid = base - full / 2;
      s.text('×', (xs[0]! + xs[1]!) / 2, mid, { size: 4.4, font: 'mono', color: s.c('--ink-3') });
      s.text('=', (xs[1]! + xs[2]!) / 2, mid, { size: 4.4, font: 'mono', color: s.c('--ink-3') });
      const lo = { size: 3.2, font: 'mono' as const, weight: 600 };
      s.text('signal', xs[0]!, base + 4.5 * u, { ...lo, color: s.c('blue') });
      s.text('gate', xs[1]!, base + 4.5 * u, { ...lo, color: s.c('purple') });
      s.text('out', xs[2]!, base + 4.5 * u, { ...lo, color: s.c('green') });
      s.text('3', xs[0]!, base - full - 3.5 * u, { ...lo, color: s.c('blue') });
      s.text(g.toFixed(2), xs[1]! + 4 * u, base - g * full, { ...lo, align: 'left', color: s.c('purple'), halo: true });
      s.text((3 * g).toFixed(2), xs[2]!, base - g * full - 3.5 * u, { ...lo, color: s.c('green'), halo: true });
    });

    // The gated linear unit: one sum through a sigmoid gates a second, linear one.
    s.alpha(s.ease('glu', 0.6, 0.4), () => {
      const gx = cx - (s.tall ? 26 : 34) * u;
      const ux = cx + (s.tall ? 26 : 34) * u;
      const [y0, y1, y2, y3, y4] = [0.12, 0.31, 0.5, 0.68, 0.83].map((f) => s.h * f);
      slab(s, cx, y0, 12, 'x', 'orange');
      down(s, cx - 3 * u, y0 + 4.5 * u, gx, y1 - 4.5 * u);
      down(s, cx + 3 * u, y0 + 4.5 * u, ux, y1 - 4.5 * u);
      slab(s, gx, y1, 30, 'x @ W_gate', 'purple');
      slab(s, ux, y1, 30, 'x @ W_up', 'blue');
      down(s, gx, y1 + 4.5 * u, gx, y2 - 4.5 * u);
      slab(s, gx, y2, 22, 'σ: 0 to 1', 'teal', s.win('name', undefined));
      const line = s.c('--ink-3');
      s.line(gx, y2 + 4.5 * u, cx - 3.4 * u, y3, line, 0.35);
      s.line(ux, y1 + 4.5 * u, ux, y3, line, 0.35);
      s.line(ux, y3, cx + 3.4 * u, y3, line, 0.35);
      s.circle(cx, y3, 3.4 * u, { fill: s.c('--card'), stroke: s.c('--ink-2'), lw: 0.35 });
      s.text('×', cx, y3 + 0.2 * u, { size: 4.2, font: 'mono', weight: 700, color: s.c('--ink-2') });
      down(s, cx, y3 + 3.6 * u, cx, y4 - 4.5 * u);
      slab(s, cx, y4, 14, 'out', 'green');
      label(s, 'linear, no bend', ux - 2 * u, (y1 + y3) / 2 + 2 * u, s.ease('name', 0.6), 'blue', { size: 3, weight: 650, align: 'right' });
    });

    cite(s, 'Dauphin et al., 2016', s.ease('glu', 0.6));
    label(s, 'one number, two jobs', cx, cy, s.ease('jobs', 0.6) * (1 - s.ease('lstm', 0.6)), 'gold');
    label(s, 'an LSTM gate: a dial from 0 to 1', cx, cy, s.win('lstm', 'glu'), 'purple');
    label(s, 'one sum gates the other', cx, cy, s.win('glu', 'name'));
    label(s, 'GLU: gated linear unit', cx, cy, s.ease('name', 0.6), 'teal');
  },
};

// ---- two projections, swish on the gate, then multiply

/** Where the token lands on a direction: the shadow a projection measures. */
const ROW = [Math.cos(0.26), Math.sin(0.26)];
const TOK = [2.2, 1.7];
const LEN = TOK[0]! * ROW[0]! + TOK[1]! * ROW[1]!;
const FOOT = [LEN * ROW[0]!, LEN * ROW[1]!];

const gate: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const D = 16;
    const H = (8 / 3) * D;
    const y0 = s.h * 0.08;
    const y1 = s.h * 0.26;
    const y2 = s.h * 0.5;
    const y3 = s.h * 0.7;
    const gx = cx - (H / 2 + 3) * u;
    const ux = cx + (H / 2 + 3) * u;
    slab(s, cx, y0, D, 'x: d', 'orange');
    s.alpha(s.ease('two', 0.6), () => {
      down(s, cx - 3 * u, y0 + 4.5 * u, gx, y1 - 4.5 * u);
      down(s, cx + 3 * u, y0 + 4.5 * u, ux, y1 - 4.5 * u);
      slab(s, gx, y1, H, s.ease('swish', 0.4, 1) > 0.5 ? 'swish(gate): h' : 'gate: h', 'purple', s.win('swish', 'mul'));
      slab(s, ux, y1, H, 'up: h', 'blue');
    });

    // A projection: each number is how far the token reaches along one row.
    s.alpha(s.win('proj', 'shazeer'), () => {
      const F = new Frame(s, cx - 30 * u, y1 + 10 * u, cx + 30 * u, s.h - 13 * u, [-0.4, 3.4], [-0.5, 2.4]);
      F.axes(0.6);
      F.seg(-0.3 * ROW[0]!, -0.3 * ROW[1]!, 3.3 * ROW[0]!, 3.3 * ROW[1]!, 'blue', 0.35);
      s.text('a row of W', F.X(3.3 * ROW[0]!) + 1.5 * u, F.Y(3.3 * ROW[1]!) - 2.5 * u, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c('blue'), halo: true });
      s.arrow(F.X(0), F.Y(0), F.X(TOK[0]!), F.Y(TOK[1]!), s.c('orange'), 0.55, 2.2);
      s.text('x', F.X(TOK[0]! / 2) - 2 * u, F.Y(TOK[1]! / 2) - 2.5 * u, { size: 3.6, font: 'mono', weight: 700, color: s.c('orange'), halo: true });
      const sh = after(s, 'proj', 0.3, 0.8);
      s.alpha(sh, () => {
        F.seg(TOK[0]!, TOK[1]!, FOOT[0]!, FOOT[1]!, '--ink-3', 0.3, [1, 0.8]);
        F.seg(0, 0, FOOT[0]! * sh, FOOT[1]! * sh, 'purple', 1.1);
        s.text('one number', F.X(FOOT[0]! / 2) + 2 * u, F.Y(FOOT[1]! / 2) + 4.5 * u, { size: 3.1, font: 'mono', weight: 650, color: s.c('purple'), halo: true });
      });
      label(s, 'x · row: how far x reaches along it', cx, s.h * 0.93, after(s, 'proj', 0.3), 'purple', { size: 3.1 });
    });

    // Swish: z times its own sigmoid. The sigmoid and the ReLU for comparison.
    s.alpha(s.win('shazeer', 'mul'), () => {
      const F = new Frame(s, cx - 34 * u, y1 + 10 * u, cx + 34 * u, s.h - 8 * u, [-6.5, 6.5], [-1.2, 6.5]);
      F.axes();
      F.fn(sig, 'teal', 0.45, -6.5, 6.5, [1.2, 1]);
      s.alpha(s.ease('swish', 0.6), () => F.fn(relu, '--ink-3', 0.4, -6.5, 6.5, [1, 1]));
      F.fn(swish, 'purple', 0.75, -6.5, -6.5 + 13 * s.ease('swish', 1.5, 0.6));
      const lx = F.l + 2 * u;
      const row = (y: number, k: Ink, text: string, a: number, dash?: number[]) => s.alpha(a, () => {
        s.line(lx, y, lx + 5 * u, y, s.c(k), 0.5, dash);
        s.text(text, lx + 6.5 * u, y, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c(k) });
      });
      row(F.t + 3 * u, 'teal', 'σ(z)', 1, [1.2, 1]);
      row(F.t + 8 * u, 'purple', 'swish: z σ(z)', s.ease('swish', 0.6));
      row(F.t + 13 * u, '--ink-3', 'ReLU', s.ease('swish', 0.6), [1, 1]);
      s.alpha(s.ease('ends', 0.6), () => {
        F.dot(-6, swish(-6), 'purple', 1.3);
        s.text('swish(−6) ≈ 0', F.X(-6.3), F.Y(0) - 5 * u, { size: 3.1, font: 'mono', weight: 650, align: 'left', color: s.c('purple'), halo: true });
      });
      s.alpha(after(s, 'ends', 0.4), () => {
        F.dot(6, swish(6), 'purple', 1.3);
        s.text('swish(6) ≈ 6', F.X(6) - 2.5 * u, F.Y(swish(6)), { size: 3.1, font: 'mono', weight: 650, align: 'right', color: s.c('purple'), halo: true });
      });
    });

    // Multiply, entry by entry, then back down to d.
    s.alpha(s.ease('mul', 0.6), () => {
      s.line(gx, y1 + 4.5 * u, cx - 2 * u, y2 - 4.5 * u, s.c('--ink-3'), 0.35);
      s.line(ux, y1 + 4.5 * u, cx + 2 * u, y2 - 4.5 * u, s.c('--ink-3'), 0.35);
      slab(s, cx, y2, H, 'swish(gate) × up', 'gold', 1);
    });
    s.alpha(s.ease('mul', 0.6, 2.5), () => {
      down(s, cx, y2 + 4.5 * u, cx, y3 - 4.5 * u);
      slab(s, cx, y3, D, 'out: d', 'green');
    });
    label(s, 'SwiGLU: a GLU with swish for its gate', cx, s.h * 0.88, after(s, 'mul', 0.6), 'gold', { size: 3.2 });
    cite(s, 'Shazeer, 2020', s.win('shazeer', 'mul'));
  },
};

// ---- one token, three units: the gate sets how much of each up value gets through

const G = [2, -1, 0];
const U = [1, 3, -2];
const SIG = ['≈ 0.88', '≈ 0.27', '= 0.5'];
const SW = ['1.76', '−0.27', '0'];
const M = ['1.76', '−0.81', '0'];

const example: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 3, s.tall ? 22 : 24);
    const lx = xs[0]! - 14 * u;
    const ys = [s.h * 0.12, s.h * 0.32, s.h * 0.58, s.h * 0.8];
    const str = (v: number) => String(v).replace('-', '−');
    const off = after(s, 'off', 0.45, 0.6);
    const flip = off > 0.5;
    const flash = s.win('off', undefined) * (after(s, 'off', 0.4) - after(s, 'off', 0.9));
    const last = s.win('off', undefined) * (1 - after(s, 'off', 0.45));

    rowLabel(s, 'gate', lx, ys[0]!, 'purple', 3.8);
    cells(s, xs, ys[0]!, G.map((v, i) => (i === 1 && flip ? '−6' : str(v))), 'purple', { w: 16, on: [0, flash, last] });
    s.alpha(s.ease('in', 0.6, 1.5), () => {
      rowLabel(s, 'up', lx, ys[1]!, 'blue', 3.8);
      cells(s, xs, ys[1]!, U.map(str), 'blue', { w: 16, on: [0, 0, last] });
    });

    const a = [s.ease('sw', 0.6, 1.2), s.ease('sw2', 0.6, 0.6), after(s, 'sw2', 0.7)];
    s.alpha(s.ease('sw', 0.6), () => rowLabel(s, 'swish', lx, ys[2]!, 'purple', 3.6));
    xs.forEach((x, i) => {
      s.alpha(a[i]!, () => {
        const sigma = i === 1 && flip ? '≈ 0.002' : SIG[i]!;
        s.text(`σ ${sigma}`, x, ys[2]! - 8 * u, { size: 2.9, font: 'mono', weight: 600, color: s.c('teal') });
        cells(s, [x], ys[2]!, [i === 1 && flip ? '−0.015' : SW[i]!], 'purple', { w: 16, on: [i === 1 ? flash : s.win(i === 0 ? 'sw' : 'sw2', 'mul')] });
      });
    });

    s.alpha(s.ease('mul', 0.6), () => {
      downArrows(s, xs, ys[2]! + 5.5 * u, ys[3]! - 5.5 * u);
      s.text('× up', xs[2]! + 9 * u, (ys[2]! + ys[3]!) / 2, { size: 3.2, font: 'mono', align: 'left', color: s.c('blue'), halo: true });
      rowLabel(s, 'out', lx, ys[3]!, 'gold', 3.8);
      cells(s, xs, ys[3]!, M.map((m, i) => (i === 1 && flip ? '−0.04' : m)), 'gold', { w: 16, on: [0, 1, 2].map((i) => (i === 1 ? flash : i === 2 ? last : 0) + s.win('mul', 'off', 0.6) * s.ease('mul', 0.6, 1)) });
    });
    label(s, 'off', xs[2]!, ys[3]! + 8 * u, after(s, 'off', 0.05), 'slate', { size: 3.1, weight: 650 });
    label(s, 'nearly off', xs[1]!, ys[3]! + 8 * u, after(s, 'off', 0.6), 'slate', { size: 3.1, weight: 650 });
  },
};

// ---- three matrices of d × h hold what two of d × 4d did when h = 8d / 3

const width: SceneDef = {
  draw(s) {
    const cx = s.w / 2;
    const u = s.u;
    const unit = s.tall ? 28 : 32;
    const gap = 3;
    const row = (y: number, n: number, w: number, labels: string[], k: 'slate' | 'purple', a: number) => {
      s.alpha(a, () => {
        const total = n * w + (n - 1) * gap;
        for (let i = 0; i < n; i++) {
          const x = cx - (total / 2) * u + (i * (w + gap) + w / 2) * u;
          s.rrect(x - (w / 2) * u, y - 5 * u, w * u, 10 * u, 1.2, { fill: s.tint(k, 0.2), stroke: s.c(k), lw: 0.35 });
          s.text(labels[i]!, x, y + 0.2 * u, { size: 3.2, font: 'mono', weight: 600, color: s.c(k) });
        }
      });
    };
    const y1 = s.h * 0.2;
    const y2 = s.h * 0.5;
    s.text('ReLU MLP', cx, y1 - 9 * u, { size: 3.4, color: s.c('--ink-2') });
    row(y1, 2, unit, ['d × 4d', '4d × d'], 'slate', s.ease('count', 0.6));
    s.alpha(s.ease('count', 0.6, 1.5), () => s.text('2 · d · 4d = 8d²', cx, y1 + 9 * u, { size: 3.6, font: 'mono', color: s.c('slate') }));
    const shrink = s.ease('match', 1.4, 0.5);
    const w = lerp(unit, (unit * 2) / 3, shrink);
    s.alpha(s.ease('three', 0.6), () => s.text('gated MLP', cx, y2 - 9 * u, { size: 3.4, color: s.c('--ink-2') }));
    row(y2, 3, w, shrink > 0.5 ? ['d × h', 'd × h', 'h × d'] : ['d × 4d', 'd × 4d', '4d × d'], 'purple', s.ease('three', 0.6));
    s.alpha(s.ease('three', 0.6, 1.5) * (1 - shrink), () => s.text('3dh: at h = 4d, 12d²', cx, y2 + 9 * u, { size: 3.6, font: 'mono', color: s.c('purple') }));
    s.alpha(shrink, () => s.text('3dh = 8d²  →  h = 8d/3', cx, y2 + 9 * u, { size: 3.6, font: 'mono', weight: 650, color: s.c('purple') }));
    s.alpha(s.ease('eg', 0.6), () => s.text('d = 768:  h = 2,048, not 3,072', cx, s.h * 0.74, { size: s.tall ? 3.4 : 3.8, font: 'mono', color: s.c('--ink-2') }));
    s.alpha(s.ease('divine', 0.6), () => s.text('“as all else, to divine benevolence”', cx, s.h * 0.87, { size: 3.4, italic: true, color: s.c('--ink-2') }));
    cite(s, 'Shazeer, 2020', s.ease('eg', 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { why, gate, example, width };

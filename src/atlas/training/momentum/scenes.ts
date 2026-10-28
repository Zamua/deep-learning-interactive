import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp, smooth } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { cells, columns } from '../../draw';
import { after, caption } from '../../networks/draw';
import { axes, ball, clipped, curve, frame, key, series, xTicks, yTicks, type Frame } from '../draw';

// The valley f = A0 w0² + A1 w1²: gentle along w0, steep across w1.
const A0 = 0.05;
const A1 = 1;
const ETA = 0.9;
const START: [number, number] = [-4.5, 1.6];
const STEPS = 16;

/** Gradient descent with momentum mu from START; mu = 0 is plain descent. */
function walk(mu: number): [number, number][] {
  let [x, y] = START;
  let vx = 0;
  let vy = 0;
  const out: [number, number][] = [[x, y]];
  for (let i = 0; i < STEPS; i++) {
    vx = mu * vx - ETA * 2 * A0 * x;
    vy = mu * vy - ETA * 2 * A1 * y;
    x += vx;
    y += vy;
    out.push([x, y]);
  }
  return out;
}

const PLAIN = walk(0);
const MOM = walk(0.5);
const [P0, P1, P2] = [MOM[0]!, MOM[1]!, MOM[2]!];
/** Where the plain push alone would take P1: each coordinate times its step factor. */
const Q: [number, number] = [P1[0] * (1 - 2 * A0 * ETA), P1[1] * (1 - 2 * A1 * ETA)];
/** The half of the first move that the second step keeps. */
const KEPT: [number, number] = [0.5 * (P1[0] - P0[0]), 0.5 * (P1[1] - P0[1])];

/** A point `r` steps along a path, between landings when `r` is fractional. */
function along(pts: [number, number][], r: number): [number, number] {
  const n = pts.length - 1;
  if (r >= n) return pts[n]!;
  const i = Math.max(0, Math.floor(r));
  const f = smooth(Math.min(1, (Math.max(0, r) - i) * 1.4));
  const [a, b] = [pts[i]!, pts[i + 1]!];
  return [lerp(a[0], b[0], f), lerp(a[1], b[1], f)];
}

const vframe = (s: Scene): Frame => frame(6 * s.u, s.h * 0.13, s.w - 6 * s.u, s.h * 0.84, [-5.2, 1.3], [-2, 2]);

/** The valley's rings, its lowest point and the two axes' names. */
function ground(s: Scene, F: Frame, a: number, low = 1): void {
  clipped(s, F, () => {
    const c = s.ctx;
    for (const lv of [0.05, 0.2, 0.5, 1, 1.8, 2.8, 4]) {
      c.beginPath();
      c.ellipse(F.X(0), F.Y(0), F.X(Math.sqrt(lv / A0)) - F.X(0), F.Y(0) - F.Y(Math.sqrt(lv / A1)), 0, 0, Math.PI * 2);
      c.strokeStyle = s.tint('red', 0.12 + 0.28 * a);
      c.lineWidth = 0.35 * s.u;
      c.stroke();
    }
  });
  s.rrect(F.l, F.t, F.r - F.l, F.b - F.t, 1, { stroke: s.c('--axis'), lw: 0.3 });
  const ax = { size: 3.2, font: 'mono', weight: 600, color: s.c('blue'), halo: true } as const;
  s.alpha(a, () => {
    s.text('w₀ →', F.r - 2 * s.u, F.b - 3 * s.u, { ...ax, align: 'right' });
    s.text('w₁ ↑', F.l + 2 * s.u, F.t + 3.5 * s.u, { ...ax, align: 'left' });
  });
  if (F.X(0) < F.r) s.alpha(low, () => s.circle(F.X(0), F.Y(0), 1 * s.u, { fill: s.c('red') }));
}

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number): void {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

const cy = (s: Scene) => s.h * 0.925;

const valley: SceneDef = {
  draw(s) {
    const F = vframe(s);
    const u = s.u;
    ground(s, F, s.ease('map', 1.2), s.ease('map', 0.6, 1));
    s.alpha(s.ease('map', 0.6, 1.6) * (1 - s.ease('descent', 0.6)), () => s.text('lowest: w₀ = w₁ = 0', F.X(0) - 2 * u, F.Y(0) + 4.5 * u, { size: 3.1, font: 'mono', align: 'right', color: s.c('red'), halo: true }));
    // Steep from wall to wall, nearly flat along the floor.
    s.alpha(s.win('valley', 'descent'), () => {
      const lab = { size: 3.2, font: 'mono', weight: 600, color: s.c('--ink-2'), halo: true } as const;
      s.arrow(F.X(-3), F.Y(0), F.X(-3), F.Y(1.6), s.c('--ink-2'), 0.4, 2);
      s.arrow(F.X(-3), F.Y(0), F.X(-3), F.Y(-1.6), s.c('--ink-2'), 0.4, 2);
      s.text('steep', F.X(-3) + 2 * u, F.Y(1.2), { ...lab, align: 'left' });
      s.arrow(F.X(-4.8), F.Y(-0.5), F.X(-0.6), F.Y(-0.5), s.c('--ink-2'), 0.4, 2);
      s.text('nearly flat', F.X(-1.8), F.Y(-0.5) + 3.5 * u, lab);
    });
    // The plain walk: one hop every 0.7 s, from late in 'descent'.
    const r = Math.max(0, (s.t - s.at('descent') - 0.55 * (s.end('descent') - s.at('descent'))) / 0.7);
    s.alpha(s.ease('descent', 0.6), () => {
      series(s, F, PLAIN, 'slate', { upto: r / STEPS, width: 0.5, dots: 0.7 });
      const [x, y] = along(PLAIN, r);
      ball(s, F.X(x), F.Y(y), 'blue', 1.6);
    });
    const c = cy(s);
    s.alpha(s.win('map', 'valley'), () => caption(s, 'each ring: points of equal f', c, '--ink-2', 3.4));
    s.alpha(s.win('descent', 'zig'), () => caption(s, 'w ← w − ηg, again and again', c, 'slate', 3.4));
    s.alpha(s.win('zig', 'crawl'), () => caption(s, 'across: overshoots to the far wall', c, 'slate', 3.4));
    s.alpha(s.ease('crawl', 0.6), () => caption(s, 'along: short steps, slow progress', c, 'slate', 3.4));
  },
};

// ---- each direction alone: two bowls and their step factors on one line

const BANDS: [number, number, Color, string][] = [
  [-1.6, -1, 'red', 'blows up'],
  [-1, 0, 'gold', 'zigzags in'],
  [0, 1, 'green', 'slides in'],
];

/** A small bowl a·x² in a fixed window, so a gentle one looks nearly flat beside a steep one. */
function bowl(s: Scene, cx: number, top: number, w: number, h: number, a: number, title: string, ka: string, on: number): void {
  const F = frame(cx - w / 2, top, cx + w / 2, top + h, [-1.6, 1.6], [0, 2.8]);
  s.line(F.l, F.b, F.r, F.b, s.c('--axis'), 0.35);
  curve(s, F, (x) => a * x * x, -1.6, 1.6, 'red', { width: 0.6 + 0.3 * on });
  s.text(title, cx, top - 3 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c('--ink-2') });
  s.text(ka, cx, F.b - 4 * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c('--ink'), halo: true });
}

const trap: SceneDef = {
  draw(s) {
    const u = s.u;
    const bw = Math.min(40 * u, (s.w - 22 * u) / 2);
    const top = s.h * 0.1;
    const bh = s.h * 0.24;
    s.alpha(s.ease('split', 0.6), () => bowl(s, s.w / 2 - bw / 2 - 4 * u, top, bw, bh, A1, 'across: w₁²', 'a = 1', s.win('across', 'along')));
    s.alpha(s.ease('split', 0.6, 1.2), () => bowl(s, s.w / 2 + bw / 2 + 4 * u, top, bw, bh, A0, 'along: 0.05 w₀²', 'a = 0.05', s.win('along', 'cap')));

    // The step size: 0.9, pushed up to 1.1 while 'cap' plays, then back.
    const eta = ETA + 0.2 * smooth((s.t - s.at('cap') - 0.25 * (s.end('cap') - s.at('cap'))) / 1.6);
    const L = s.h * 0.64;
    const X = (r: number) => 8 * u + ((r + 1.6) / 2.7) * (s.w - 16 * u);
    s.alpha(s.ease('across', 0.6), () => {
      for (const [a, b, k, name] of BANDS) {
        s.rrect(X(a), L - 2.5 * u, X(b) - X(a), 5 * u, 0, { fill: s.tint(k, 0.16), stroke: s.tint(k, 0.45), lw: 0.25 });
        s.text(name, (X(a) + X(b)) / 2, L + 6 * u, { size: 3, font: 'mono', color: s.c(k) });
      }
      for (const r of [-1, 0, 1]) s.text(String(r).replace('-', '−'), X(r), L + 11 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
      s.text(`η = ${eta.toFixed(2)}`, s.w / 2, s.h * 0.45, { size: 3.6, font: 'mono', weight: 650, color: s.c('slate') });
    });
    const dot = (r: number, k: Color, label: string, a: number, dy: number) => s.alpha(a, () => {
      s.circle(X(r), L, 1.6 * u, { fill: s.c(k), stroke: s.c('--card'), lw: 0.4 });
      s.text(label, X(r), L - dy * u, { size: 3.2, font: 'mono', weight: 650, color: s.c(k), halo: true });
    });
    const rAcross = 1 - 2 * A1 * eta;
    const rAlong = 1 - 2 * A0 * eta;
    dot(rAcross, 'purple', `across ${rAcross.toFixed(2).replace('-', '−')}`, s.ease('across', 0.6, 1.5), 6);
    dot(rAlong, 'blue', `along ${rAlong.toFixed(2)}`, s.ease('along', 0.6, 0.5), 6);
    s.alpha(smooth((eta - 1) / 0.05), () => s.text('✗', X(rAcross), L - 11 * u, { size: 4.4, font: 'ui', weight: 700, color: s.c('red') }));

    const c = cy(s);
    s.alpha(s.win('split', 'across'), () => caption(s, 'each direction: a bowl of its own', c, '--ink-2', 3.4));
    s.alpha(s.win('across', 'along'), () => caption(s, 'factor = 1 − 2aη = 1 − 1.8 = −0.8', c, 'purple', 3.4));
    s.alpha(s.win('along', 'cap'), () => caption(s, '1 − 2 × 0.05 × 0.9 = 0.91', c, 'blue', 3.4));
    s.alpha(s.ease('cap', 0.6), () => caption(s, 'η past 1/a = 1: across blows up', c, 'red', 3.4));
  },
};

// ---- the heavy ball: keep a share of the last move

/** An arrow between two valley points, in data coordinates. */
function varrow(s: Scene, F: Frame, a: [number, number], b: [number, number], k: Color, width = 0.6): void {
  s.arrow(F.X(a[0]), F.Y(a[1]), F.X(b[0]), F.Y(b[1]), s.c(k), width, 2.2);
}

const ballScene: SceneDef = {
  draw(s) {
    const u = s.u;
    // The rolling picture first, then a close-up of one step, then the two paths compared.
    const close = s.ease('velocity', 0.9) * (1 - s.ease('zero', 0.9));
    const F = frame(6 * u, s.h * 0.13, s.w - 6 * u, s.h * 0.84, [lerp(-5.2, -5, close), lerp(1.3, -2.4, close)], [-2, 2]);
    ground(s, F, 0.5, 1 - close);
    const zero = s.win('zero', 'half');
    const half = s.ease('half', 0.6);
    const roll = 1 - s.ease('velocity', 0.6);
    const r = Math.max(0, (s.t - s.at('heavy') - 1) / 0.55);
    clipped(s, F, () => {
      s.alpha(0.3 + 0.7 * zero, () => series(s, F, PLAIN, 'slate', { width: 0.45 + 0.15 * zero, dots: 0.55 }));
      s.alpha(roll, () => {
        series(s, F, MOM, 'orange', { upto: r / STEPS, width: 0.6, dots: 0.6 });
        const [x, y] = along(MOM, r);
        ball(s, F.X(x), F.Y(y), 'orange', 2.2);
      });
      s.alpha(half, () => {
        series(s, F, MOM, 'orange', { width: 0.7, dots: 0.7 });
        const [x, y] = MOM[STEPS]!;
        ball(s, F.X(x), F.Y(y), 'orange', 1.8);
      });
      s.alpha(zero, () => {
        const [x, y] = PLAIN[STEPS]!;
        ball(s, F.X(x), F.Y(y), 'blue', 1.8);
      });
    });

    s.alpha(s.ease('velocity', 0.6) * (1 - s.ease('zero', 0.6)), () => {
      const lab = { size: 3.2, font: 'mono', weight: 650, halo: true } as const;
      const fade = 1 - s.ease('rule', 0.6);
      ball(s, F.X(P0[0]), F.Y(P0[1]), '--ink-3', 1.1);
      const keep = s.ease('keep', 0.6);
      // The first move, v; once 'keep' plays only its first half stays bright.
      s.alpha(1 - 0.7 * keep, () => varrow(s, F, P0, P1, 'orange'));
      s.alpha(s.win('velocity', 'keep'), () => s.text('v', F.X((P0[0] + P1[0]) / 2) - 3 * u, F.Y((P0[1] + P1[1]) / 2), { ...lab, color: s.c('orange') }));
      // The push alone, then the kept half carried to its tip.
      s.alpha(after(s, 'push', 0.05, 0.6), () => {
        varrow(s, F, P1, Q, 'red', 0.55);
        s.alpha(fade, () => s.text('−ηg', F.X(Q[0]) - 2 * u, F.Y(Q[1]) - 1.5 * u, { ...lab, align: 'right', color: s.c('red') }));
      });
      s.alpha(after(s, 'push', 0.35, 0.6) * fade, () => s.text('alone: lands here', F.X(Q[0]) + 2.5 * u, F.Y(Q[1]) - 2.5 * u, { ...lab, size: 3, align: 'left', color: s.c('red') }));
      const slide = smooth((s.t - s.at('push') - 0.6 * (s.end('push') - s.at('push'))) / 1.2);
      const base: [number, number] = [lerp(P0[0], Q[0], slide), lerp(P0[1], Q[1], slide)];
      s.alpha(keep, () => {
        varrow(s, F, base, [base[0] + KEPT[0], base[1] + KEPT[1]], 'orange', 0.75);
        const side = slide < 0.5 ? -1 : 1;
        s.alpha(fade, () => s.text('μv', F.X(base[0] + KEPT[0] / 2) + side * 2.5 * u, F.Y(base[1] + KEPT[1] / 2), { ...lab, align: side < 0 ? 'right' : 'left', color: s.c('orange') }));
      });
      // The new velocity, and the weights moving by it.
      s.alpha(s.ease('rule', 0.6), () => varrow(s, F, P1, P2, 'orange', 0.9));
      const mv = smooth((s.t - s.at('rule') - 0.55 * (s.end('rule') - s.at('rule'))) / 1);
      ball(s, F.X(lerp(P1[0], P2[0], mv)), F.Y(lerp(P1[1], P2[1], mv)), 'blue', 1.6);
    });

    const c = cy(s);
    s.alpha(s.win('heavy', 'velocity'), () => caption(s, 'a heavy ball keeps its motion', c, 'orange', 3.4));
    s.alpha(s.win('velocity', 'keep'), () => caption(s, 'v: the last move', c, 'orange', 3.4));
    s.alpha(s.win('keep', 'push'), () => caption(s, 'keep μv: here, half of v', c, 'orange', 3.4));
    s.alpha(s.win('push', 'rule'), () => caption(s, 'add −ηg, the plain push', c, 'red', 3.4));
    s.alpha(s.win('rule', 'zero'), () => caption(s, 'v ← μv − ηg, then w ← w + v', c, 'orange', 3.4));
    s.alpha(zero, () => caption(s, 'μ = 0: plain gradient descent', c, 'slate', 3.4));
    s.alpha(half, () => caption(s, 'μ = 0.5, same η = 0.9: far ahead', c, 'orange', 3.4));
    cite(s, 'the heavy ball method · Polyak, 1964', s.win('heavy', 'velocity'));
  },
};

// ---- the numbers: a steady gradient builds v up, a flipping one cancels

const ROWS: { name: string; g: string; v: string; w: string; vb: string; wb: string }[] = [
  { name: 'start', g: '', v: '0', w: '1', vb: 'one', wb: 'one' },
  { name: 'step 1', g: '2', v: '−0.2', w: '0.8', vb: 'v1', wb: 'w1' },
  { name: 'step 2', g: '2', v: '−0.38', w: '0.42', vb: 'v2', wb: 'w2' },
];

const STEADY: [number, number][] = Array.from({ length: 26 }, (_, t) => [t, -2 * (1 - 0.9 ** t)]);
const FLIP_PLAIN: [number, number][] = [[0, 0]];
const FLIP_MOM: [number, number][] = [[0, 0]];
{
  let v = 0;
  for (let t = 1; t <= 14; t++) {
    const g = t % 2 ? 2 : -2;
    v = 0.9 * v - 0.1 * g;
    FLIP_PLAIN.push([t, -0.1 * g]);
    FLIP_MOM.push([t, v]);
  }
}
const CLIMB = ['−0.2', '−0.38', '−0.54', '−0.69', '…'];

/** The table of steps and w on a line below it, hopping 1 → 0.8 → 0.42. */
function steps(s: Scene): void {
  const u = s.u;
  const xs = columns(s, 4, s.tall ? 20 : 22);
  const hy = s.h * 0.1;
  s.alpha(s.ease('one', 0.6), () => (['', 'g', 'v', 'w'] as const).forEach((t, j) => s.text(t, xs[j]!, hy, { size: 3.8, font: 'mono', weight: 650, color: s.c((['--ink-2', 'red', 'orange', 'blue'] as const)[j]) })));
  ROWS.forEach((row, i) => {
    const y = hy + (i + 1) * 10 * u;
    const vOn = i ? s.win(row.vb, row.wb) : 0;
    const wOn = i ? s.win(row.wb, i === 1 ? 'v2' : 'steady') : 0;
    s.alpha(s.ease(row.vb, 0.6, i ? 1.2 : 0.8), () => {
      s.text(row.name, xs[0]!, y, { size: 3.3, font: 'mono', color: s.c('--ink-3') });
      if (row.g) cells(s, [xs[1]!], y, [row.g], 'red', { w: 13, h: 7.5, size: 3.3 });
      cells(s, [xs[2]!], y, [row.v], 'orange', { w: 15, h: 7.5, size: 3.3, on: [vOn] });
    });
    s.alpha(s.ease(row.wb, 0.6, i ? 0.3 : 0.8), () => cells(s, [xs[3]!], y, [row.w], 'blue', { w: 14, h: 7.5, size: 3.3, on: [wOn] }));
  });
  // w on a line: the second hop is almost twice the first.
  const L = s.h * 0.72;
  const X = (w: number) => s.w / 2 + (w - 0.55) * Math.min(70 * u, s.w - 24 * u);
  s.alpha(s.ease('one', 0.6, 1), () => {
    s.line(X(-0.05), L, X(1.1), L, s.c('--axis'), 0.35);
    for (const w of [0, 1]) s.text(String(w), X(w), L + 4 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
    s.text('w', X(1.1) + 2 * u, L, { size: 3.6, font: 'mono', weight: 650, align: 'left', color: s.c('blue') });
  });
  const h1 = smooth((s.t - s.at('w1') - 0.3) / 0.9);
  const h2 = smooth((s.t - s.at('w2') - 0.3) / 0.9);
  const hop = (a: number, b: number, f: number, text: string) => s.alpha(f, () => {
    s.arrow(X(a), L - 4 * u, X(lerp(a, b, f)), L - 4 * u, s.c('orange'), 0.5, 2);
    s.text(text, X((a + b) / 2), L - 8 * u, { size: 3.1, font: 'mono', weight: 600, color: s.c('orange'), halo: true });
  });
  hop(1, 0.8, h1, '−0.2');
  hop(0.8, 0.42, h2, '−0.38');
  const w = 1 - 0.2 * h1 - 0.38 * h2;
  s.alpha(s.ease('one', 0.6, 1), () => ball(s, X(w), L, 'blue', 1.5));
}

const build: SceneDef = {
  marks: {
    eq: { tex: String.raw`\symv = 0.9\,\symv - 0.2`, x: 0.5, y: 0.1, size: 5 },
    sol: { tex: String.raw`0.1\,\symv = -0.2,\qquad \symv = -2`, x: 0.5, y: 0.21, size: 5 },
    lim: { tex: String.raw`\symv \to \dfrac{-\symeta\,\symg}{1 - \symmu}`, x: 0.5, y: 0.15, size: 5.4 },
  },
  draw(s) {
    const u = s.u;
    const plot = s.ease('steady', 0.6);
    const flip = s.ease('flip', 0.8);
    s.alpha(1 - plot, () => steps(s));
    s.alpha(s.win('one', 'v1'), () => caption(s, 'μ = 0.9, η = 0.1, g = 2', cy(s), '--ink-2', 3.4));
    cite(s, 'Rumelhart, Hinton & Williams, 1986', s.win('one', 'v1'));
    s.alpha(s.win('v1', 'w1'), () => caption(s, '0.9 × 0 − 0.1 × 2 = −0.2', cy(s), 'orange', 3.4));
    s.alpha(s.win('v2', 'w2'), () => caption(s, '0.9 × (−0.2) − 0.2 = −0.38', cy(s), 'orange', 3.4));
    s.alpha(s.win('w2', 'steady'), () => caption(s, 'the second step is almost twice as long', cy(s), 'blue', 3.4));

    s.alpha(plot * (1 - s.ease('settle', 0.5)), () => {
      const xs = columns(s, 5, s.tall ? 19 : 20);
      CLIMB.forEach((t, i) => s.alpha(after(s, 'steady', 0.3 + 0.12 * i), () => cells(s, [xs[i]!], s.h * 0.14, [t], 'orange', { w: 15, h: 8, size: 3.4 })));
    });
    s.show('eq', s.win('settle', 'limit'));
    s.show('sol', after(s, 'solve', 0.3) * (1 - s.ease('limit', 0.5)));
    s.show('lim', s.ease('limit', 0.6) * (1 - flip));
    s.alpha(plot * (1 - flip), () => {
      const F = frame(14 * u, s.h * 0.32, s.w - 6 * u, s.h - 9 * u, [0, 25], [-2.3, 0.3]);
      axes(s, F, 'step', '', { x: '--ink-3', y: 'orange' });
      s.line(F.l, F.Y(0), F.r, F.Y(0), s.c('--axis'), 0.3);
      yTicks(s, F, [0, -1, -2], (y) => String(y).replace('-', '−'));
      xTicks(s, F, [5, 10, 15, 20]);
      s.text('v', F.l + 2 * u, F.t + 2 * u, { size: 3.6, font: 'mono', weight: 650, align: 'left', color: s.c('orange') });
      s.line(F.l, F.Y(-0.2), F.r, F.Y(-0.2), s.tint('slate', 0.8), 0.3, [1.2, 1]);
      s.text('plain step −ηg = −0.2', F.r, F.Y(-0.2) - 3 * u, { size: 3, font: 'mono', align: 'right', color: s.c('slate'), halo: true });
      const up = Math.max(0, Math.min(1, (s.since('steady') - 0.3) / 5));
      series(s, F, STEADY, 'orange', { upto: up, dots: 0.6 });
      s.alpha(after(s, 'solve', 0.6), () => {
        s.line(F.l, F.Y(-2), F.r, F.Y(-2), s.tint('orange', 0.8), 0.3, [1.2, 1]);
        s.text('−2: ten plain steps', F.r, F.Y(-2) + 3.6 * u, { size: 3, font: 'mono', align: 'right', color: s.c('orange'), halo: true });
      });
    });
    s.alpha(flip, () => {
      const F = frame(14 * u, s.h * 0.16, s.w - 6 * u, s.h - 9 * u, [0, 14], [-0.3, 0.3]);
      axes(s, F, 'step', '', { x: '--ink-3', y: 'orange' });
      s.line(F.l, F.Y(0), F.r, F.Y(0), s.c('--axis'), 0.3);
      yTicks(s, F, [0.2, 0, -0.2], (y) => String(y).replace('-', '−'));
      let kx = s.w / 2 - 28 * u;
      kx = key(s, kx, s.h * 0.07, 'slate', 'plain step');
      key(s, kx, s.h * 0.07, 'orange', 'momentum v');
      const up = Math.max(0, Math.min(1, (s.since('flip') - 0.6) / 5));
      series(s, F, FLIP_PLAIN, 'slate', { upto: up, width: 0.45, dash: [1.2, 0.8], dots: 0.6 });
      series(s, F, FLIP_MOM, 'orange', { upto: up, dots: 0.6 });
    });
  },
};

export const scenes: Record<string, SceneDef> = { valley, trap, ball: ballScene, build };

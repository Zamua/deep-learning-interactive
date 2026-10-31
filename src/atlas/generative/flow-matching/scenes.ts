import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { cells, cite, columns, rowLabel } from '../../draw';
import { block, caption, fmt, Frame, rich } from '../draw';

type P = [number, number];

const X0: P = [1, 0];
const EPS: P = [-1, 2];
const V: P = [EPS[0] - X0[0], EPS[1] - X0[1]];
const on = (t: number): P => [(1 - t) * X0[0] + t * EPS[0], (1 - t) * X0[1] + t * EPS[1]];
/** a·x₀ + b·ε: the diffusion blend has a = √ᾱ and b = √(1 − ᾱ), so a² + b² = 1, a quarter circle in (a, b). */
const blend = (a: number, b: number): P => [a * X0[0] + b * EPS[0], a * X0[1] + b * EPS[1]];
const ARC = Array.from({ length: 61 }, (_, i) => blend(Math.cos((i / 60) * (Math.PI / 2)), Math.sin((i / 60) * (Math.PI / 2))));

/** Euler steps back along the arc, from the noise: each moves along the arc's direction where the step starts. */
function eulerArc(h: number, n: number): P[] {
  let [a, b] = [0, 1];
  const pts = [blend(a, b)];
  for (let i = 0; i < n; i++) {
    [a, b] = [a + h * b, b - h * a];
    pts.push(blend(a, b));
  }
  return pts;
}
const BIG = eulerArc(Math.PI / 4, 2);
const SMALL = eulerArc(Math.PI / 48, 24);

/** The plane of two-pixel images, with equal scales on both axes. */
function plane(s: Scene): Frame {
  const u = s.u;
  const H = s.h * 0.64;
  const W = Math.min(H * (3.4 / 2.9), s.w - 16 * u);
  const F = new Frame(s, s.w / 2 - W / 2, s.h * 0.08, s.w / 2 + W / 2, s.h * 0.08 + H, [-1.7, 1.7], [-0.5, 2.4]);
  F.axes(0.6);
  s.text('pixel 0', F.r, F.Y(0) - 2.5 * u, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
  s.text('pixel 1', F.X(0) + 1.5 * u, F.t + 1.5 * u, { size: 2.8, font: 'mono', align: 'left', color: s.c('--ink-3') });
  return F;
}

function path(s: Scene, F: Frame, pts: P[], k: Ink, width = 0.5, dash?: number[]): void {
  const c = s.ctx;
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(F.X(x), F.Y(y)) : c.moveTo(F.X(x), F.Y(y))));
  c.strokeStyle = s.c(k);
  c.lineWidth = width * s.u;
  c.lineJoin = 'round';
  c.setLineDash(dash ? dash.map((d) => d * s.u) : []);
  c.stroke();
  c.setLineDash([]);
}

/** An arrow in data coordinates, drawn `grow` of the way. */
function arrow(s: Scene, F: Frame, a: P, b: P, k: Ink, grow = 1, width = 0.45, head = 2): void {
  if (grow <= 0.003) return;
  const e: P = [a[0] + (b[0] - a[0]) * grow, a[1] + (b[1] - a[1]) * grow];
  s.arrow(F.X(a[0]), F.Y(a[1]), F.X(e[0]), F.Y(e[1]), s.c(k), width, head);
}

/** A chain of arrows through `pts`, each appearing `gap` seconds after the last, from `delay` into beat `id`. */
function steps(s: Scene, F: Frame, pts: P[], k: Ink, id: string, delay: number, gap: number, dur: number, o: { width?: number; head?: number; dot?: number } = {}): void {
  for (let i = 1; i < pts.length; i++) {
    const g = s.ease(id, dur, delay + (i - 1) * gap);
    arrow(s, F, pts[i - 1]!, pts[i]!, k, g, o.width ?? 0.45, o.head ?? 2);
    if (o.dot && g > 0.98) F.dot(pts[i]![0], pts[i]![1], k, o.dot);
  }
}

/** The clean image and the noise, labeled. */
function ends(s: Scene, F: Frame, o: { noise?: string; a?: number } = {}): void {
  const u = s.u;
  const t = { size: 3.2, font: 'mono', weight: 650, halo: true } as const;
  s.alpha(o.a ?? 1, () => {
    F.dot(X0[0], X0[1], 'orange', 1.4);
    s.text('x₀ = [1, 0]', F.X(X0[0]), F.Y(X0[1]) + 4 * u, { ...t, color: s.c('orange') });
    F.dot(EPS[0], EPS[1], 'slate', 1.4);
    s.text(o.noise ?? 'ε = [−1, 2]', F.X(EPS[0]), F.Y(EPS[1]) - 4 * u, { ...t, color: s.c('slate') });
  });
}

/** Eased in from `f` of the way through beat `id`, so a picture lands when the voice reaches it. */
const late = (s: Scene, id: string, f: number, dur = 0.6) => s.ease(id, dur, f * (s.end(id) - s.at(id)));

const label = (s: Scene, text: string, x: number, y: number, k: Ink, align: CanvasTextAlign = 'left') =>
  s.text(text, x, y, { size: 3, font: 'mono', weight: 650, align, color: s.c(k), halo: true });

// ---- the road back: a curve walked in big steps drifts off it; a straight line does not

const road: SceneDef = {
  draw(s) {
    const u = s.u;
    const F = plane(s);
    const cy = s.h * 0.92;
    const st = s.ease('straight', 0.8);
    const dim = 1 - 0.7 * st;
    const ar = s.ease('arc', 1.6, 0.6);
    const many = s.ease('many', 0.6);
    s.alpha(dim * (1 - 0.6 * many), () => {
      path(s, F, ARC.slice(0, Math.max(2, Math.round(60 * ar) + 1)), 'purple', 0.45, [1, 0.8]);
      s.alpha(s.ease('arc', 0.6, 2), () => label(s, 'diffusion path', F.X(0.75), F.Y(1.55), 'purple'));
    });
    // A short arrow the way the path points at the noise; the big steps then grow from it.
    s.alpha(s.win('back', 'drift', 0.4), () => arrow(s, F, EPS, [EPS[0] + 0.55, EPS[1]], 'red', s.ease('back', 0.8, 1.5), 0.5, 2.2));
    s.alpha((1 - 0.6 * many) * dim, () => {
      steps(s, F, BIG, 'red', 'drift', 1.2, 1.4, 1, { width: 0.5, head: 2.2, dot: 0.8 });
      s.alpha(s.ease('drift', 0.6, 4.6), () => {
        path(s, F, [BIG[2]!, X0], 'red', 0.3, [0.6, 0.6]);
        label(s, 'missed', F.X((BIG[2]![0] + X0[0]) / 2) + 2 * u, F.Y((BIG[2]![1] + X0[1]) / 2), 'red');
      });
    });
    s.alpha(dim, () => steps(s, F, SMALL, 'gold', 'many', 0.3, 0.12, 0.25, { width: 0.35, head: 1.3, dot: 0.7 }));
    s.alpha(st, () => {
      path(s, F, [X0, EPS], 'blue', 0.3, [1, 0.8]);
      arrow(s, F, EPS, X0, 'blue', s.ease('straight', 1.2, 1), 0.6, 2.6);
    });
    ends(s, F, { a: s.ease('pair', 0.6) });
    s.alpha(s.win('pair', 'arc'), () => caption(s, 'a 2-pixel image is one point', cy, '--ink-2', 3.2));
    s.alpha(s.win('back', 'drift'), () => caption(s, 'walk back: step the way the path points', cy, 'red', 3.2));
    s.alpha(s.win('drift', 'many'), () => caption(s, '2 big steps: far from the image', cy, 'red', 3.2));
    s.alpha(s.win('many', 'straight'), () => caption(s, '24 small steps: close, but many', cy, 'gold', 3.2));
    s.alpha(s.win('straight', 'liu'), () => caption(s, 'a straight path: 1 step lands', cy, 'blue', 3.2));
    s.alpha(s.win('liu', 'lipman'), () => caption(s, 'rectified: made straight', cy, 'blue', 3.2));
    s.alpha(s.ease('lipman', 0.6), () => caption(s, 'flow matching: straight paths', cy, 'blue', 3.2));
    cite(s, 'rectified flow · Liu, Gong & Liu, 2022', s.win('liu', 'lipman'));
    cite(s, 'Lipman, Chen, Ben-Hamu, Nickel & Le, 2022', s.ease('lipman', 0.6));
  },
};

// ---- the straight line and its velocity

/** The arc's direction at θ, going from the image toward the noise. */
const arcDir = (th: number): P => {
  const d = blend(-Math.sin(th), Math.cos(th));
  const n = Math.hypot(d[0], d[1]);
  return [d[0] / n, d[1] / n];
};

const line: SceneDef = {
  marks: {
    f: { tex: String.raw`\sym{xt}{x_t} = (1 - t)\,\sym{x0}{x_0} + t\,\sym{eps}{\epsilon}`, x: 0.5, y: 0.82, size: 4.6 },
  },
  draw(s) {
    const u = s.u;
    const F = plane(s);
    const cy = s.h * 0.92;
    const steady = s.ease('steady', 0.8);
    s.alpha(0.25 + 0.5 * steady, () => path(s, F, ARC, 'purple', 0.4, [1, 0.8]));
    path(s, F, [X0, on(s.ease('line', 1.2, 0.3))], 'blue', 0.55);
    s.show('f', s.ease('line', 0.6, 1.2));
    ends(s, F);
    s.alpha(s.ease('t', 0.6), () => {
      label(s, 't = 0', F.X(X0[0]), F.Y(X0[1]) + 8 * u, 'blue', 'center');
      label(s, 't = 1', F.X(EPS[0]) - 2.5 * u, F.Y(EPS[1]) + 3 * u, 'blue', 'right');
    });
    const pt = s.win('point', 'v');
    const q = on(0.25);
    s.alpha(pt, () => {
      F.dot(q[0], q[1], 'purple', 1.3);
      label(s, 't = 0.25', F.X(q[0]) - 2.5 * u, F.Y(q[1]) + 3 * u, 'purple', 'right');
      rich(s, [['0.75·[1, 0] + 0.25·[−1, 2] = ', '--ink-2'], ['[0.5, 0.5]', 'purple']], s.w / 2, cy, { size: 3.1, weight: 650, halo: true });
    });
    // A point sliding along the line at a steady pace, carrying its velocity.
    s.alpha(s.win('v', 'steady'), () => {
      const p = on(0.1 + 0.6 * s.prog('v'));
      F.dot(p[0], p[1], 'purple', 1.3);
      arrow(s, F, p, [p[0] + 0.22 * V[0], p[1] + 0.22 * V[1]], 'green', 1, 0.5, 2);
      s.alpha(late(s, 'v', 0.75), () => rich(s, [['v = ε − x₀', 'green'], ['  per unit of t', '--ink-3']], s.w / 2, cy, { size: 3.2, weight: 650, halo: true }));
    });
    s.alpha(steady, () => {
      for (const t of [0.25, 0.5, 0.75]) {
        const p = on(t);
        arrow(s, F, p, [p[0] + 0.2 * V[0], p[1] + 0.2 * V[1]], 'green', 1, 0.45, 1.8);
      }
      for (const th of [0.2, 0.65, 1.1]) {
        const p = blend(Math.cos(th), Math.sin(th));
        const d = arcDir(th);
        arrow(s, F, p, [p[0] + 0.45 * d[0], p[1] + 0.45 * d[1]], 'purple', 1, 0.4, 1.7);
      }
      rich(s, [['v = ', '--ink-2'], ['[−2, 2]', 'green'], [' at every t', '--ink-3']], s.w / 2, cy, { size: 3.2, weight: 650, halo: true });
    });
  },
};

// ---- training: the velocity as the target, and the average where lines cross

const TARGET = [-2, 2];
const GUESS = [-1.5, 2];
const MISS = GUESS.map((g, i) => g - TARGET[i]!);

/** A few images; lines from them to noise draws criss-cross the plane. */
const DATA: P[] = [X0, [0.1, -0.35], [-1.2, 0.1]];
const NOISES: P[] = [[-1.5, 1.6], [1.3, 1.9], [0.6, 2.2], [-0.4, 2.3], [1.5, 0.8], [-1.6, 0.6], [0.2, 1.6]];
/** Kept clear of M, so only the two highlighted lines pass through it. */
const LINES: [P, P][] = [[0, 2], [0, 6], [0, 3], [1, 1], [1, 5], [2, 0], [2, 4], [1, 0]].map(([i, j]) => [DATA[i]!, NOISES[j]!]);
/** Two lines through M at t = 0.5: their noise is 2M minus their image. */
const M: P = [-0.4, 1.0];
const CROSS: [P, P][] = [DATA[1]!, DATA[2]!].map((a) => [a, [2 * M[0] - a[0], 2 * M[1] - a[1]]]);
const VEL = CROSS.map(([a, e]) => [e[0] - a[0], e[1] - a[1]] as P);
const AVG: P = [(VEL[0]![0] + VEL[1]![0]) / 2, (VEL[0]![1] + VEL[1]![1]) / 2];

/** The best guess of the velocity at x and t with standard normal noise: the average of (x − a) / t over the images a, each weighted by how likely it is to have led to x. */
function field(x: P, t: number): P {
  const w = DATA.map((a) => -((x[0] - (1 - t) * a[0]) ** 2 + (x[1] - (1 - t) * a[1]) ** 2) / (2 * t * t));
  const top = Math.max(...w);
  const e = w.map((v) => Math.exp(v - top));
  const sum = e.reduce((p, q) => p + q, 0);
  return [0, 1].map((k) => DATA.reduce((acc, a, i) => acc + (e[i]! / sum) * (x[k]! - a[k]!) / t, 0)) as P;
}
const GRID: { p: P; v: P }[] = [];
for (let i = 0; i < 8; i++) for (let j = 0; j < 7; j++) {
  const p: P = [-1.4 + (2.8 * i) / 7, -0.2 + (2.2 * j) / 6];
  GRID.push({ p, v: field(p, 0.5) });
}

const train: SceneDef = {
  marks: {
    L: { tex: String.raw`\text{loss} = \text{mean}\big((\sym{vhat}{\hat{v}} - (\sym{eps}{\epsilon} - \sym{x0}{x_0}))^2\big)`, x: 0.5, y: 0.9, size: 4.4 },
  },
  draw(s) {
    const u = s.u;
    const cy = s.h * 0.92;
    const two = s.ease('cross', 0.8);
    s.alpha(1 - two, () => {
      const o = { size: 3.4, weight: 650, halo: true } as const;
      rich(s, [['x₀ = [1, 0]', 'orange'], ['    ε = [−1, 2]', 'slate']], s.w / 2, s.h * 0.1, o);
      const y = s.h * 0.27;
      s.text('xₜ, t', s.w / 2 - 25 * u, y, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('purple') });
      s.arrow(s.w / 2 - 23 * u, y, s.w / 2 - 14 * u, y, s.c('--ink-3'), 0.35, 2);
      block(s, s.w / 2, y, 24, 10, 'network', 'blue', { size: 3.6, on: s.win('net', 'loss') });
      s.arrow(s.w / 2 + 14 * u, y, s.w / 2 + 23 * u, y, s.c('--ink-3'), 0.35, 2);
      s.text('v̂', s.w / 2 + 25 * u, y, { size: 3.8, font: 'mono', weight: 650, align: 'left', color: s.c('red') });
      const xs = columns(s, 2, 16);
      const lx = xs[0]! - 11 * u;
      const ys = [0.45, 0.57, 0.69].map((f) => s.h * f);
      s.alpha(s.ease('net', 0.6, 1), () => {
        rowLabel(s, 'v̂', lx, ys[0]!, 'red', 3.6);
        cells(s, xs, ys[0]!, GUESS.map((v) => fmt(v)), 'red', { w: 13, h: 7.5 });
      });
      s.alpha(s.ease('loss', 0.6), () => {
        rowLabel(s, 'ε − x₀', lx, ys[1]!, 'green', 3.4);
        cells(s, xs, ys[1]!, TARGET.map((v) => fmt(v)), 'green', { w: 13, h: 7.5 });
      });
      s.alpha(s.ease('loss', 0.6, 3), () => {
        rowLabel(s, 'miss', lx, ys[2]!, '--ink-2', 3.4);
        cells(s, xs, ys[2]!, MISS.map((v) => fmt(v)), 'gold', { w: 13, h: 7.5, on: [1, 1] });
        rich(s, [['(0.5² + 0²) / 2 = ', '--ink-2'], ['0.125', 'gold']], s.w / 2, s.h * 0.79, { size: 3.2, weight: 650, halo: true });
      });
    });
    s.show('L', s.ease('loss', 0.6, 1) * (1 - two));
    s.alpha(two, () => {
      const F = plane(s);
      const fl = s.ease('flow', 0.8);
      s.alpha(1 - fl, () => {
        for (const [a, e] of LINES) {
          path(s, F, [a, e], '--ink-3', 0.25);
          F.dot(e[0], e[1], 'slate', 0.9);
        }
        s.alpha(late(s, 'cross', 0.45), () => {
          for (const [a, e] of CROSS) {
            path(s, F, [a, e], 'blue', 0.45);
            F.dot(e[0], e[1], 'slate', 1.1);
          }
          F.dot(M[0], M[1], 'purple', 1.2);
          label(s, 't = 0.5', F.X(M[0]) + 2.5 * u, F.Y(M[1]) + 0.6 * u, 'purple');
        });
        VEL.forEach((v) => arrow(s, F, M, [M[0] + 0.3 * v[0], M[1] + 0.3 * v[1]], 'green', late(s, 'cross', 0.7), 0.45, 1.9));
        s.alpha(s.ease('average', 0.6, 0.8), () => {
          arrow(s, F, M, [M[0] + 0.3 * AVG[0], M[1] + 0.3 * AVG[1]], 'red', 1, 0.6, 2.3);
          label(s, 'average', F.X(M[0] + 0.3 * AVG[0]), F.Y(M[1] + 0.3 * AVG[1]) - 3.5 * u, 'red', 'center');
        });
      });
      for (const p of DATA) F.dot(p[0], p[1], 'orange', 1.2);
      s.alpha(fl, () => {
        for (const { p, v } of GRID) {
          const n = Math.hypot(v[0], v[1]);
          const len = Math.min(0.24, 0.07 * n) / Math.max(n, 1e-6);
          arrow(s, F, p, [p[0] + len * v[0], p[1] + len * v[1]], 'red', 1, 0.3, 1.2);
        }
      });
      s.alpha(1 - late(s, 'cross', 0.45), () => caption(s, 'many images, each with its own noise', cy, '--ink-2', 3.2));
      s.alpha(late(s, 'cross', 0.45) * (1 - s.ease('average', 0.6)), () => caption(s, 'two lines, one point, one t', cy, 'blue', 3.2));
      s.alpha(s.win('average', 'flow'), () => caption(s, 'the best guess: their average', cy, 'red', 3.2));
      s.alpha(fl, () => caption(s, 'a flow: an arrow at every point (t = 0.5)', cy, 'red', 3.2));
    });
  },
};

// ---- sampling: Euler steps from the noise back to the image

/** Paths that follow the averaged arrows from t = 1 to t = 0, in fine steps: they bend. */
const BENT: P[][] = [[-1.5, 1.5], [0.4, 2.2], [1.4, 1.6], [-0.5, 2.3]].map((start) => {
  let x = start as P;
  const pts: P[] = [x];
  const n = 300;
  for (let i = 0; i < n - 1; i++) {
    const v = field(x, 1 - i / n);
    x = [x[0] - v[0] / n, x[1] - v[1] / n];
    if (i % 10 === 9) pts.push(x);
  }
  return pts;
});

const sample: SceneDef = {
  marks: {
    e: { tex: String.raw`\sym{xt}{x_t} \leftarrow \sym{xt}{x_t} - \Delta t\,\sym{vhat}{\hat{v}}`, x: 0.5, y: 0.82, size: 4.6 },
  },
  draw(s) {
    const u = s.u;
    const F = plane(s);
    const cy = s.h * 0.92;
    const bend = s.ease('bend', 0.8);
    const keep = 1 - bend;
    s.alpha(keep, () => path(s, F, [X0, EPS], '--ink-3', 0.3, [1, 0.8]));
    ends(s, F, { noise: 't = 1: noise', a: keep });
    s.show('e', s.ease('rule', 0.6));
    const o = { size: 3.1, weight: 650, halo: true } as const;
    s.alpha(s.win('start', 'dt'), () => caption(s, 'start from fresh noise at t = 1', cy, 'slate', 3.2));
    const mid = on(0.5);
    s.alpha(s.win('dt', 'ex') * keep, () => {
      F.dot(mid[0], mid[1], '--ink-3', 0.8);
      label(s, 't = 0.5', F.X(mid[0]) + 2.5 * u, F.Y(mid[1]) - 1 * u, '--ink-2');
      label(s, 't = 0', F.X(X0[0]), F.Y(X0[1]) + 8 * u, '--ink-2', 'center');
    });
    s.alpha(s.win('dt', 'rule'), () => caption(s, 'Δt = 0.5: t goes 1 → 0.5 → 0', cy, '--ink-2', 3.2));
    const s1 = late(s, 'ex', 0.55, 1.2);
    s.alpha(s.ease('ex', 0.6) * keep, () => {
      arrow(s, F, EPS, mid, 'red', s1, 0.5, 2.2);
      s.alpha(s1, () => {
        F.dot(mid[0], mid[1], 'purple', 1.3);
        label(s, 't = 0.5', F.X(mid[0]) + 2.5 * u, F.Y(mid[1]) - 1 * u, 'purple');
      });
    });
    s.alpha(late(s, 'ex', 0.3) * (1 - s.ease('exact', 0.6)), () => rich(s, [['[−1, 2] − 0.5·[−2, 2] = ', '--ink-2'], ['[0, 1]', 'purple']], s.w / 2, cy, o));
    s.alpha(s.ease('exact', 0.6) * keep, () => arrow(s, F, mid, X0, 'red', s.ease('exact', 1, 0.5), 0.5, 2.2));
    s.alpha(s.win('exact', 'euler'), () => rich(s, [['[0, 1] − 0.5·[−2, 2] = ', '--ink-2'], ['[1, 0] = x₀', 'orange']], s.w / 2, cy, o));
    s.alpha(s.win('euler', 'bend'), () => rich(s, [['gradient descent: ', '--ink-2'], ['w ← w − ηg', 'blue']], s.w / 2, cy, { ...o, size: 3.3 }));
    cite(s, 'Leonhard Euler, 1768', s.win('euler', 'bend'));
    s.alpha(bend, () => {
      for (const p of DATA) F.dot(p[0], p[1], 'orange', 1.1);
      BENT.forEach((pts, i) => {
        const g = s.ease('bend', 1.4, 0.4 + 0.3 * i);
        path(s, F, pts.slice(0, Math.max(2, Math.round(pts.length * g))), 'blue', 0.4);
        F.dot(pts[0]![0], pts[0]![1], 'slate', 1);
      });
      caption(s, 'averaged arrows: the paths bend', cy, 'blue', 3.2);
    });
  },
};

export const scenes: Record<string, SceneDef> = { road, line, train, sample };

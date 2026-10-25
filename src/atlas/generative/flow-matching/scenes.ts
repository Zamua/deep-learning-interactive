import type { Scene, SceneDef } from '../../../lecture/scene';
import { cells, columns, rowLabel } from '../../draw';
import { block, caption, Frame, fmt, rich, type Ink } from '../draw';

const X0: [number, number] = [1, 0];
const EPS: [number, number] = [-1, 2];
const V: [number, number] = [EPS[0] - X0[0], EPS[1] - X0[1]];
const on = (t: number): [number, number] => [(1 - t) * X0[0] + t * EPS[0], (1 - t) * X0[1] + t * EPS[1]];
/** The diffusion blend for alpha-bar = cos² θ: a quarter circle's worth of curve. */
const arcAt = (th: number): [number, number] => [Math.cos(th) * X0[0] + Math.sin(th) * EPS[0], Math.cos(th) * X0[1] + Math.sin(th) * EPS[1]];

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

function path(s: Scene, F: Frame, pts: [number, number][], k: Ink, width = 0.5, dash?: number[]): void {
  const c = s.ctx;
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(F.X(x), F.Y(y)) : c.moveTo(F.X(x), F.Y(y))));
  c.strokeStyle = s.c(k);
  c.lineWidth = width * s.u;
  c.setLineDash(dash ? dash.map((d) => d * s.u) : []);
  c.stroke();
  c.setLineDash([]);
}

/** The clean image and the noise, labeled. */
function ends(s: Scene, F: Frame, noiseLabel = 'ε = [−1, 2]'): void {
  const u = s.u;
  const o = { size: 3.2, font: 'mono', weight: 650, halo: true } as const;
  F.dot(X0[0], X0[1], 'orange', 1.4);
  s.text('x₀ = [1, 0]', F.X(X0[0]), F.Y(X0[1]) + 4 * u, { ...o, color: s.c('orange') });
  F.dot(EPS[0], EPS[1], 'slate', 1.4);
  s.text(noiseLabel, F.X(EPS[0]) + 2.5 * u, F.Y(EPS[1]) - 2.5 * u, { ...o, align: 'left', color: s.c('slate') });
}

const ARC = Array.from({ length: 61 }, (_, i) => arcAt(((i / 60) * Math.PI) / 2));

const line: SceneDef = {
  marks: {
    f: { tex: String.raw`\sym{xt}{x_t} = (1 - t)\,\sym{x0}{x_0} + t\,\sym{eps}{\epsilon}`, x: 0.5, y: 0.82, size: 4.6 },
  },
  draw(s) {
    const u = s.u;
    const F = plane(s);
    const ar = s.ease('arc', 1.4, 0.8);
    const ln = s.ease('line', 1);
    s.alpha(1 - 0.6 * ln, () => {
      path(s, F, ARC.slice(0, Math.max(2, Math.round(60 * ar) + 1)), 'purple', 0.45, [1, 0.8]);
      s.alpha(s.ease('arc', 0.6, 2), () => s.text('diffusion: a curve', F.X(0.15), F.Y(1.75), { size: 3, font: 'mono', weight: 650, align: 'left', color: s.c('purple'), halo: true }));
    });
    s.alpha(ln, () => {
      const p = on(ln);
      s.line(F.X(X0[0]), F.Y(X0[1]), F.X(p[0]), F.Y(p[1]), s.c('blue'), 0.55);
      s.text('flow: straight', F.X(-0.15), F.Y(0.7), { size: 3, font: 'mono', weight: 650, align: 'right', color: s.c('blue'), halo: true });
    });
    s.show('f', s.ease('line', 0.6, 0.6));
    ends(s, F);
    const pt = s.ease('point', 0.6);
    const q = on(0.25);
    s.alpha(pt, () => {
      F.dot(q[0], q[1], 'purple', 1.3);
      s.text('t = 0.25', F.X(q[0]) + 2.5 * u, F.Y(q[1]) + 0.5 * u, { size: 3, font: 'mono', weight: 650, align: 'left', color: s.c('purple'), halo: true });
    });
    const o = { size: 3.2, weight: 650, halo: true } as const;
    s.alpha(pt * (1 - s.ease('v', 0.6)), () => rich(s, [['0.75 · [1, 0] + 0.25 · [−1, 2] = ', '--ink-2'], ['[0.5, 0.5]', 'purple']], s.w / 2, s.h * 0.92, o));
    s.alpha(s.ease('v', 0.6), () => {
      for (const t of [0.45, 0.65, 0.85]) {
        const p = on(t);
        const L = 7 * u;
        const n = Math.hypot(V[0], V[1]);
        const x = F.X(p[0]) - 2.2 * u;
        const y = F.Y(p[1]) - 2.2 * u;
        s.arrow(x, y, x + (L * V[0]) / n, y - (L * V[1]) / n, s.c('green'), 0.4, 1.8);
      }
      rich(s, [['v = ε − x₀ = ', '--ink-2'], ['[−2, 2]', 'green'], [' at every t', '--ink-3']], s.w / 2, s.h * 0.92, o);
    });
  },
};

const TARGET = [-2, 2];
const GUESS = [-1.5, 2];
const MISS = GUESS.map((g, i) => g - TARGET[i]!);

const train: SceneDef = {
  marks: {
    L: { tex: String.raw`\text{loss} = \text{mean}\big((\sym{vhat}{\hat{v}} - (\sym{eps}{\epsilon} - \sym{x0}{x_0}))^2\big)`, x: 0.5, y: 0.9, size: 4.4 },
  },
  draw(s) {
    const u = s.u;
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
    s.show('L', s.ease('loss', 0.6, 1));
  },
};

/** Paths a trained model might follow: nearly straight, bending a little. */
const BENT: [number, number, number, number, number][] = [
  [-1.5, 1.5, 0.3, -0.35, 0.15],
  [0.4, 2.2, 1.6, 0.7, -0.15],
  [-1.6, 0.7, -0.5, -0.35, 0.2],
];
const bentPts = ([ax, ay, bx, by, k]: [number, number, number, number, number]): [number, number][] =>
  Array.from({ length: 31 }, (_, i) => {
    const t = i / 30;
    const bow = k * 4 * t * (1 - t);
    return [ax + (bx - ax) * t + bow * (by - ay) * 0.5, ay + (by - ay) * t - bow * (bx - ax) * 0.5];
  });

const sample: SceneDef = {
  marks: {
    e: { tex: String.raw`\sym{xt}{x_t} \leftarrow \sym{xt}{x_t} - \Delta t\,\sym{vhat}{\hat{v}}`, x: 0.5, y: 0.82, size: 4.6 },
  },
  draw(s) {
    const u = s.u;
    const F = plane(s);
    path(s, F, [X0, EPS], '--ink-3', 0.3, [1, 0.8]);
    ends(s, F, 't = 1: noise');
    s.show('e', s.ease('euler', 0.6));
    const o = { size: 3.2, weight: 650, halo: true } as const;
    s.alpha(s.win('start', 'euler'), () => caption(s, 'start from pure noise at t = 1', s.h * 0.92, 'slate', 3.2));
    const mid = on(0.5);
    const s1 = s.ease('ex', 1, 1);
    s.alpha(s.ease('ex', 0.6), () => {
      const p = [EPS[0] + (mid[0] - EPS[0]) * s1, EPS[1] + (mid[1] - EPS[1]) * s1];
      s.arrow(F.X(EPS[0]), F.Y(EPS[1]), F.X(p[0]!), F.Y(p[1]!), s.c('red'), 0.5, 2.2);
      F.dot(p[0]!, p[1]!, 'purple', 1.3);
      s.alpha(s1, () => s.text('t = 0.5', F.X(mid[0]) + 2.5 * u, F.Y(mid[1]) - 1 * u, { size: 3, font: 'mono', weight: 650, align: 'left', color: s.c('purple'), halo: true }));
    });
    s.alpha(s.win('ex', 'exact'), () => rich(s, [['[−1, 2] − 0.5 · [−2, 2] = ', '--ink-2'], ['[0, 1]', 'purple']], s.w / 2, s.h * 0.92, o));
    const s2 = s.ease('exact', 1, 0.5);
    s.alpha(s.ease('exact', 0.6), () => {
      const p = [mid[0] + (X0[0] - mid[0]) * s2, mid[1] + (X0[1] - mid[1]) * s2];
      s.arrow(F.X(mid[0]), F.Y(mid[1]), F.X(p[0]!), F.Y(p[1]!), s.c('red'), 0.5, 2.2);
    });
    s.alpha(s.win('exact', 'bend'), () => rich(s, [['[0, 1] − 0.5 · [−2, 2] = ', '--ink-2'], ['[1, 0] = x₀', 'orange']], s.w / 2, s.h * 0.92, o));
    s.alpha(s.ease('bend', 0.8), () => {
      for (const b of BENT) path(s, F, bentPts(b), 'blue', 0.35, [0.9, 0.7]);
      caption(s, 'learned paths bend a little', s.h * 0.92, 'blue', 3.2);
    });
  },
};

export const scenes: Record<string, SceneDef> = { line, train, sample };

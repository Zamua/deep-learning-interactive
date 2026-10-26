import type { Scene, SceneDef } from '../../../lecture/scene';
import { smooth } from '../../../lecture/scene';
import { cells, columns } from '../../draw';
import { axes, ball, clipped, curve, frame, hop, type Frame } from '../draw';

const sq = (x: number) => x * x;
const fmt = (v: number) => String(Math.round(v * 1000) / 1000).replace('-', '−');
/** Eased 0 -> 1 from a fraction `f` of the way through beat `id`, so it tracks the voice at any pace. */
const after = (s: Scene, id: string, f: number, dur = 0.5) => smooth((s.t - s.at(id) - f * (s.end(id) - s.at(id))) / dur);

/** The bowl f(x) = x², filling the stage between two heights (fractions of the stage). */
function bowl(s: Scene, top: number, bottom: number, xr = 1.6): Frame {
  return frame(10 * s.u, s.h * top, s.w - 8 * s.u, s.h * bottom, [-xr, xr], [0, xr * xr]);
}

/** Gradient descent on x² from 1: every point it visits. */
const path = (lr: number, n: number): [number, number][] =>
  Array.from({ length: n + 1 }, (_, k) => {
    const x = (1 - 2 * lr) ** k;
    return [x, x * x];
  });

/** A ball hopping along `pts`, with the chords and dots it leaves behind. */
function descent(s: Scene, F: Frame, pts: [number, number][], t: number, every: number, k: 'blue' | 'red' = 'blue'): void {
  const h = hop(pts, t, every);
  clipped(s, F, () => {
    for (let i = 0; i < h.done; i++) s.line(F.X(pts[i]![0]), F.Y(pts[i]![1]), F.X(pts[i + 1]![0]), F.Y(pts[i + 1]![1]), s.tint('slate', 0.75), 0.4);
    if (h.done < pts.length - 1) s.line(F.X(pts[h.done]![0]), F.Y(pts[h.done]![1]), F.X(h.x), F.Y(h.y), s.tint('slate', 0.75), 0.4);
    for (let i = 0; i <= h.done; i++) s.circle(F.X(pts[i]![0]), F.Y(pts[i]![1]), 0.8 * s.u, { fill: s.tint(k, 0.45) });
    ball(s, F.X(h.x), F.Y(h.y), k);
  });
}

/** A row of x values with a label at its left; `n` is how many have landed, and `by` labels the hops. */
function row(s: Scene, xs: number[], y: number, vals: string[], n: number, name: string, by?: string): void {
  s.text(name, xs[0]! - 9.5 * s.u, y, { size: 3.2, font: 'mono', weight: 650, align: 'right', color: s.c('orange') });
  vals.forEach((v, i) => {
    s.alpha(i <= n ? 1 : 0.15, () => cells(s, [xs[i]!], y, [v], 'orange', { w: 14, h: 8, size: 3.4, on: [i === n ? 1 : 0] }));
    if (i && by) s.alpha(i <= n ? 1 : 0, () => s.text(by, (xs[i - 1]! + xs[i]!) / 2, y - 7 * s.u, { size: 3, font: 'mono', color: s.c('slate') }));
  });
}

const slide: SceneDef = {
  marks: {
    fs: { tex: String.raw`\symf(\symx) = a(\symx - 3)^2,\quad a = 1`, x: 0.5, y: 0.09, size: 5.2 },
    rs: { tex: String.raw`\symx - 3 \leftarrow (1 - 2a\symeta)(\symx - 3)`, x: 0.5, y: 0.09, size: 5.2 },
  },
  draw(s) {
    const moved = s.ease('shift', 0.6, 0.6);
    s.show('fs', s.win('shift', 'dist'));
    s.show('rs', s.ease('dist', 0.6));
    const F = bowl(s, 0.19, 0.6);
    axes(s, F, 'x', 'f', { x: 'orange', y: 'purple' });
    const tick = (x: number, t: string) => {
      s.line(F.X(x), F.b - 1.2 * s.u, F.X(x), F.b + 1.2 * s.u, s.c('--axis'), 0.35);
      s.text(t, F.X(x), F.b + 4 * s.u, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
    };
    s.alpha(1 - moved, () => tick(0, '0'));
    s.alpha(moved, () => {
      tick(0, '3');
      tick(1, '4');
    });
    curve(s, F, sq, -1.6, 1.6, 'purple');
    s.alpha(s.win('shift', 'dist') * moved, () => {
      curve(s, F, (x) => 1 + 2 * (x - 1), 0.55, 1.45, '--ink-3', { width: 0.4, dash: [1.4, 1] });
      s.text('slope 2a(x − 3) = 2', F.X(0.85), F.Y(1.25), { size: 3.4, font: 'mono', weight: 600, align: 'right', color: s.c('red'), halo: true });
    });
    const P = path(0.3, 3);
    descent(s, F, P, s.since('dist') - 0.5, 1.2);
    const xs = columns(s, 4, s.tall ? 21 : 20);
    s.alpha(s.ease('dist', 0.6, 0.3), () => {
      const n = Math.min(3, Math.floor((s.since('dist') - 0.5) / 1.2) + 1);
      row(s, xs, s.h * 0.72, P.map(([x]) => fmt(x + 3)), n, 'x');
      row(s, xs, s.h * 0.86, P.map(([x]) => fmt(x)), n, 'x − 3', '×0.4');
    });
  },
};

const RUNS = [
  { lr: 0.05, r: 0.9 },
  { lr: 0.3, r: 0.4 },
  { lr: 0.8, r: -0.6 },
  { lr: 1.1, r: -1.2 },
] as const;

/** The factor 1 - 2a eta against eta, over green, gold and red bands for slides in, zigzags in, blows up. */
function bands(s: Scene, F: Frame): void {
  const band = (y0: number, y1: number, k: 'green' | 'gold' | 'red') => s.rrect(F.l, F.Y(y1), F.r - F.l, F.Y(y0) - F.Y(y1), 0, { fill: s.tint(k, 0.1) });
  band(0, 1, 'green');
  band(-1, 0, 'gold');
  band(-1.8, -1, 'red');
  s.line(F.l, F.Y(0), F.r, F.Y(0), s.c('--axis'), 0.35);
  s.line(F.l, F.t, F.l, F.b, s.c('--axis'), 0.35);
  s.text('η', F.r, F.Y(0) + 4 * s.u, { size: 3.6, font: 'mono', weight: 650, align: 'right', color: s.c('slate') });
  const tick = (v: number) => s.text(String(v).replace('-', '−'), F.l - 2 * s.u, F.Y(v), { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
  [1, 0, -1].forEach(tick);
}

const limit: SceneDef = {
  marks: {
    r: { tex: String.raw`\text{factor} = 1 - 2a\symeta`, x: 0.5, y: 0.08, size: 5 },
    max: { tex: String.raw`\symeta_{\max} = 1/a`, x: 0.5, y: 0.08, size: 5.6 },
    s1: { tex: String.raw`1 - 2a\symeta = -1`, x: 0.5, y: 0.36, size: 5.6 },
    s2: { tex: String.raw`2a\symeta = 2`, x: 0.5, y: 0.5, size: 5.6 },
    s3: { tex: String.raw`\symeta = 1/a`, x: 0.5, y: 0.64, size: 5.6 },
  },
  draw(s) {
    s.show('r', 1 - s.ease('steep', 0.5));
    s.show('max', s.ease('steep', 0.6, 2));
    const solving = s.win('solve', 'steep');
    s.show('s1', after(s, 'solve', 0.15) * (1 - s.ease('steep', 0.5)));
    s.show('s2', after(s, 'solve', 0.6) * (1 - s.ease('steep', 0.5)));
    s.show('s3', after(s, 'solve', 0.8) * (1 - s.ease('steep', 0.5)));
    const F = frame(12 * s.u, s.h * 0.17, s.w - 8 * s.u, s.h - 9 * s.u, [0, 1.3], [-1.8, 1.2]);
    s.alpha(1 - 0.85 * solving, () => {
      bands(s, F);
      const lab = { size: 3.4, align: 'right' as const, halo: true };
      s.text('slides in', F.r - 2 * s.u, F.Y(0.75), { ...lab, color: s.c('green') });
      s.text('zigzags in', F.r - 2 * s.u, F.Y(-0.5), { ...lab, color: s.c('gold') });
      s.text('blows up', F.l + 3 * s.u, F.Y(-1.4), { ...lab, align: 'left', color: s.c('red') });
      curve(s, F, (e) => 1 - 2 * e, 0, 1.3, 'orange', { width: 0.7, upto: s.ease('line', 1.4) });
      s.alpha(s.ease('line', 0.6, 1.4), () => {
        RUNS.forEach((r) => s.circle(F.X(r.lr), F.Y(r.r), 1.1 * s.u, { fill: s.tint('orange', 0.6) }));
      });
      s.alpha(after(s, 'recap', 0.6) * (1 - s.ease('line', 0.6, 1.4)), () => {
        s.circle(F.X(0.8), F.Y(-0.6), 1.3 * s.u, { fill: s.c('orange') });
        s.text('η = 0.8: factor −0.6', F.X(0.8) - 3 * s.u, F.Y(-0.6) + 4 * s.u, { size: 3.4, font: 'mono', align: 'right', color: s.c('--ink'), halo: true });
      });
      s.alpha(s.ease('half', 0.6), () => ball(s, F.X(0.5), F.Y(0), 'green', 1.6));
      s.alpha(s.win('half', 'solve'), () => {
        s.text('1/(2a): one step', F.X(0.55), F.Y(0.2), { size: 3.4, font: 'mono', align: 'left', color: s.c('--ink'), halo: true });
      });
      s.alpha(s.ease('edge', 0.6), () => {
        ball(s, F.X(1), F.Y(-1), 'red', 1.6);
        s.text('1/a: bounces', F.X(0.96), F.Y(-1.22), { size: 3.4, font: 'mono', align: 'right', color: s.c('--ink'), halo: true });
      });
      s.alpha(s.ease('steep', 0.6), () => {
        curve(s, F, (e) => 1 - 4 * e, 0, 0.7, 'orange', { width: 0.6, dash: [1.6, 1], upto: s.ease('steep', 1.2) });
        s.alpha(s.ease('steep', 0.6, 1.2), () => {
          ball(s, F.X(0.5), F.Y(-1), 'red', 1.3);
          s.text('a = 2', F.X(0.71), F.Y(-1.62), { size: 3.4, font: 'mono', align: 'left', color: s.c('orange'), halo: true });
        });
      });
    });
  },
};

const tryIt: SceneDef = {
  marks: {
    q1: { tex: String.raw`\symf(\symx) = 4(\symx - 3)^2,\quad \symeta_{\max} = \,?`, x: 0.5, y: 0.08, size: 4.8 },
    e1: { tex: String.raw`a = 4{:}\quad 1 - 8\symeta = -1`, x: 0.5, y: 0.69, size: 4.6 },
    e2: { tex: String.raw`8\symeta = 2`, x: 0.5, y: 0.78, size: 4.6 },
    e3: { tex: String.raw`\symeta_{\max} = 2/8 = 0.25`, x: 0.5, y: 0.87, size: 4.6 },
    q2: { tex: String.raw`\symf(\symx) = 4(\symx - 3)^2,\quad \text{one step: } \symeta = \,?`, x: 0.5, y: 0.08, size: 4.8 },
    o1: { tex: String.raw`1 - 8\symeta = 0`, x: 0.5, y: 0.69, size: 4.6 },
    o2: { tex: String.raw`8\symeta = 1`, x: 0.5, y: 0.78, size: 4.6 },
    o3: { tex: String.raw`\symeta = 1/8 = 0.125`, x: 0.5, y: 0.87, size: 4.6 },
    q3: { tex: String.raw`\symf(\symx) = 4(\symx - 3)^2,\quad \symeta = 0.2`, x: 0.5, y: 0.08, size: 4.8 },
    z1: { tex: String.raw`1 - 8 \times 0.2 = -0.6`, x: 0.5, y: 0.69, size: 4.6 },
    z2: { tex: String.raw`-1 < -0.6 < 0{:}\ \ \text{zigzags in}`, x: 0.5, y: 0.78, size: 4.6 },
  },
  draw(s) {
    const one = 1 - s.ease('p2', 0.5);
    const two = s.ease('p2', 0.5) * (1 - s.ease('p3', 0.5));
    const three = s.ease('p3', 0.5);
    s.show('q1', s.ease('p1', 0.6) * one);
    s.show('e1', after(s, 'a1', 0.3) * one);
    s.show('e2', after(s, 'a1', 0.62) * one);
    s.show('e3', after(s, 'a1', 0.8) * one);
    s.show('q2', two);
    s.show('o1', after(s, 'a2', 0.15) * two);
    s.show('o2', after(s, 'a2', 0.45) * two);
    s.show('o3', after(s, 'a2', 0.7) * two);
    s.show('q3', three);
    s.show('z1', after(s, 'p3', 0.4));
    s.show('z2', after(s, 'p3', 0.7));
    const F = frame(12 * s.u, s.h * 0.17, s.w - 8 * s.u, s.h * 0.6, [0, 0.35], [-1.8, 1.2]);
    bands(s, F);
    curve(s, F, (e) => 1 - 8 * e, 0, 0.35, 'orange', { width: 0.7, upto: s.ease('p1', 1.4, 0.6) });
    const label = (t: string, x: number, y: number) => s.text(t, x, y, { size: 3.4, font: 'mono', align: 'left', color: s.c('--ink'), halo: true });
    s.alpha(after(s, 'a1', 0.8), () => {
      ball(s, F.X(0.25), F.Y(-1), 'red', 1.6);
      label('0.25', F.X(0.25) + 2.6 * s.u, F.Y(-1) - 3 * s.u);
    });
    s.alpha(after(s, 'a2', 0.7), () => {
      ball(s, F.X(0.125), F.Y(0), 'green', 1.6);
      label('0.125', F.X(0.125) + 2.6 * s.u, F.Y(0) - 3 * s.u);
    });
    s.alpha(after(s, 'p3', 0.4), () => {
      ball(s, F.X(0.2), F.Y(-0.6), 'gold', 1.6);
      label('0.2', F.X(0.2) + 2.6 * s.u, F.Y(-0.6) - 3 * s.u);
    });
  },
};

export const scenes: Record<string, SceneDef> = { limit, slide, try: tryIt };

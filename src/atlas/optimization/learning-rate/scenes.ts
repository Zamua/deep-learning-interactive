import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01 } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { after, cells, cite, columns } from '../../draw';
import { axes, ball, clipped, curve, frame, hop, type Frame } from '../draw';

const fmt = (v: number) => String(Math.round(v * 1000) / 1000).replace('-', '−');
/** Linear 0 -> 1 over `dur` seconds from a fraction `f` of the way through beat `id`. */
const from = (s: Scene, id: string, f: number, dur = 1.2) => clamp01((s.t - s.at(id) - f * (s.end(id) - s.at(id))) / dur);

/** A bowl's frame, filling the stage between two heights (fractions of the stage); y runs to xr². */
function bowl(s: Scene, top: number, bottom: number, xr: number): Frame {
  return frame(10 * s.u, s.h * top, s.w - 8 * s.u, s.h * bottom, [-xr, xr], [0, xr * xr]);
}

/** A tick on the x axis with its label. */
function tick(s: Scene, F: Frame, x: number, label: string): void {
  s.line(F.X(x), F.b - 1.2 * s.u, F.X(x), F.b + 1.2 * s.u, s.c('--axis'), 0.35);
  s.text(label, F.X(x), F.b + 4 * s.u, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
}

/** Gradient descent on x² from x0: every point it visits, each step multiplying x by 1 - 2 eta. */
const path = (eta: number, n: number, x0 = 1): [number, number][] =>
  Array.from({ length: n + 1 }, (_, k) => {
    const x = x0 * (1 - 2 * eta) ** k;
    return [x, x * x];
  });

/** A ball hopping along `pts`, with the dots it leaves behind; chords older than the last two fade, so a zigzag stays readable. */
function descent(s: Scene, F: Frame, pts: [number, number][], t: number, every: number, k: Color): void {
  const h = hop(pts, t, every);
  clipped(s, F, () => {
    for (let i = 0; i < h.done; i++) s.line(F.X(pts[i]![0]), F.Y(pts[i]![1]), F.X(pts[i + 1]![0]), F.Y(pts[i + 1]![1]), s.tint(k, i >= h.done - 2 ? 0.55 : 0.14), 0.4);
    if (h.done < pts.length - 1) s.line(F.X(pts[h.done]![0]), F.Y(pts[h.done]![1]), F.X(h.x), F.Y(h.y), s.tint(k, 0.55), 0.4);
    for (let i = 0; i <= h.done; i++) s.circle(F.X(pts[i]![0]), F.Y(pts[i]![1]), 0.8 * s.u, { fill: s.tint(k, 0.45) });
    ball(s, F.X(h.x), F.Y(h.y), k);
  });
}

/** Seconds per hop so a walk of `n` hops fits inside beat `id`, starting `lead` seconds in. */
const pace = (s: Scene, id: string, n: number, lead: number) => Math.min(0.9, Math.max(0.3, (s.end(id) - s.at(id) - lead - 0.3) / n));

/** Two walks side by side: a step size, where it starts, its color and its legend. */
const FAST = [
  { eta: 0.1, x0: -1.6, n: 10, k: 'blue', label: 'η 0.1: crawls' },
  { eta: 0.4, x0: 1.6, n: 3, k: 'green', label: 'η 0.4: a few hops' },
] as const;
const EDGE = [
  { eta: 0.95, x0: -1, n: 10, k: 'blue', label: 'η 0.95: settles' },
  { eta: 1.05, x0: 1, n: 10, k: 'red', label: 'η 1.05: runs away' },
] as const;
const FAST_P = FAST.map((r) => path(r.eta, r.n, r.x0));
const EDGE_P = EDGE.map((r) => path(r.eta, r.n, r.x0));

const ask: SceneDef = {
  draw(s) {
    const F = bowl(s, 0.17, 0.66, 2.3);
    axes(s, F, 'x', 'f', { x: 'orange', y: 'purple' });
    tick(s, F, 0, '0');
    curve(s, F, (x) => x * x, -2.3, 2.3, 'purple');
    const legend = (text: string, i: number, k: Color) =>
      s.text(text, s.w * (i ? 0.72 : 0.3), s.h * 0.08, { size: 3.5, font: 'mono', weight: 650, color: s.c(k) });
    s.alpha(1 - s.ease('edge', 0.4), () =>
      FAST.forEach((r, i) => {
        descent(s, F, FAST_P[i]!, s.since('fast') - 0.6, pace(s, 'fast', 10, 0.6), r.k);
        legend(r.label, i, r.k);
      }),
    );
    const dim = 1 - 0.7 * s.ease('name', 0.6);
    s.alpha(s.ease('edge', 0.4) * dim, () =>
      EDGE.forEach((r, i) => {
        descent(s, F, EDGE_P[i]!, s.since('edge') - 0.6, pace(s, 'edge', 10, 0.6), r.k);
        const label = i && s.since('diverge') >= 0 ? 'η 1.05: diverges' : r.label;
        s.alpha(1 - s.ease('name', 0.4), () => legend(label, i, r.k));
      }),
    );
    cite(s, 'Rumelhart, Hinton & Williams, 1986', s.ease('name', 0.6));
    const cy = s.h * 0.82;
    s.alpha(s.win('name', 'advice'), () =>
      s.text('η, the step size: the learning rate', s.w / 2, cy, { size: 3.8, color: s.c('--ink'), halo: true }),
    );
    s.alpha(s.ease('advice', 0.6), () => {
      const q = { size: 3.6, italic: true, color: s.c('--ink-2'), halo: true } as const;
      s.text('“a learning rate that is as large as possible', s.w / 2, cy - 2.6 * s.u, q);
      s.text('without leading to oscillation”', s.w / 2, cy + 2.6 * s.u, q);
    });
  },
};

/** The factor 1 - 2a eta against eta, over green, gold and red bands for slides in, zigzags in, blows up. */
function bands(s: Scene, F: Frame, named: number): void {
  const band = (y0: number, y1: number, k: Color) => s.rrect(F.l, F.Y(y1), F.r - F.l, F.Y(y0) - F.Y(y1), 0, { fill: s.tint(k, 0.03 + 0.07 * named) });
  band(0, 1, 'green');
  band(-1, 0, 'gold');
  band(-1.8, -1, 'red');
  s.line(F.l, F.Y(0), F.r, F.Y(0), s.c('--axis'), 0.35);
  s.line(F.l, F.t, F.l, F.b, s.c('--axis'), 0.35);
  s.text('η', F.r, F.Y(0) + 4 * s.u, { size: 3.6, font: 'mono', weight: 650, align: 'right', color: s.c('slate') });
  const lab = (v: number) => s.text(String(v).replace('-', '−'), F.l - 2 * s.u, F.Y(v), { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
  [1, 0, -1].forEach(lab);
  s.alpha(named, () => {
    const o = { size: 3.4, align: 'right' as const, halo: true };
    s.text('slides in', F.r - 2 * s.u, F.Y(0.75), { ...o, color: s.c('green') });
    s.text('zigzags in', F.r - 2 * s.u, F.Y(-0.45), { ...o, color: s.c('gold') });
    s.text('blows up', F.l + 3 * s.u, F.Y(-1.4), { ...o, align: 'left', color: s.c('red') });
  });
}

const line: SceneDef = {
  marks: {
    r: { tex: String.raw`\text{factor} = 1 - 2a\symeta,\quad a = 1`, x: 0.5, y: 0.08, size: 5 },
    s1: { tex: String.raw`1 - 2a\symeta = -1`, x: 0.5, y: 0.36, size: 5.6 },
    s2: { tex: String.raw`2a\symeta = 2`, x: 0.5, y: 0.5, size: 5.6 },
    s3: { tex: String.raw`\symeta = 1/a`, x: 0.5, y: 0.64, size: 5.6 },
    max: { tex: String.raw`\symeta_{\max} = 1/a`, x: 0.5, y: 0.08, size: 5.6 },
  },
  draw(s) {
    const solving = s.win('solve', 'widrow');
    s.show('r', 1 - s.ease('max', 0.5, 1.5));
    s.show('max', s.ease('max', 0.6, 1.5), { x: s.tall ? 0.38 : 0.5 });
    s.show('s1', after(s, 'solve', 0.45) * (1 - s.ease('widrow', 0.5)));
    s.show('s2', after(s, 'solve2', 0.2) * (1 - s.ease('widrow', 0.5)));
    s.show('s3', after(s, 'max', 0.1) * (1 - s.ease('widrow', 0.5)));
    cite(s, 'Widrow & colleagues, 1976', s.win('widrow', 'steep'));
    const F = frame(12 * s.u, s.h * 0.17, s.w - 8 * s.u, s.h - 9 * s.u, [0, 1.3], [-1.8, 1.2]);
    s.alpha(1 - 0.85 * solving, () => {
      bands(s, F, s.ease('bands', 0.8));
      curve(s, F, (e) => 1 - 2 * e, 0, 1.3, 'orange', { width: 0.7, upto: s.ease('line', 1.4, 1) });
      s.alpha(s.ease('half', 0.6), () => ball(s, F.X(0.5), F.Y(0), 'green', 1.6));
      s.alpha(s.win('half', 'solve'), () => {
        s.text('1/(2a): one step', F.X(0.55), F.Y(0.2), { size: 3.4, font: 'mono', align: 'left', color: s.c('--ink'), halo: true });
      });
      s.alpha(s.ease('edge', 0.6), () => {
        ball(s, F.X(1), F.Y(-1), 'red', 1.6);
        s.text('1/a: bounces', F.X(0.95), F.Y(-1.24), { size: 3.4, font: 'mono', align: 'right', color: s.c('--ink'), halo: true });
      });
      s.alpha(s.ease('steep', 0.6), () => {
        curve(s, F, (e) => 1 - 4 * e, 0, 0.7, 'orange', { width: 0.6, dash: [1.6, 1], upto: s.ease('steep', 1.2) });
        s.alpha(s.ease('steep', 0.6, 1.2), () => {
          ball(s, F.X(0.5), F.Y(-1), 'red', 1.3);
          s.text('a = 2', F.X(0.34), F.Y(-0.55), { size: 3.4, font: 'mono', weight: 600, align: 'right', color: s.c('orange'), halo: true });
          s.text('1/2', F.X(0.47), F.Y(-1.16), { size: 3.4, font: 'mono', align: 'right', color: s.c('--ink'), halo: true });
        });
      });
    });
  },
};

const slide: SceneDef = {
  marks: {
    fs: { tex: String.raw`\symf(\symx) = a(\symx - 3)^2,\quad a = 1`, x: 0.5, y: 0.09, size: 5.2 },
    gs: { tex: String.raw`\symg = 2a(\symx - 3)`, x: 0.5, y: 0.09, size: 5.2 },
    rs: { tex: String.raw`\symx - 3 \leftarrow (1 - 2a\symeta)(\symx - 3)`, x: 0.5, y: 0.09, size: 5.2 },
  },
  draw(s) {
    const moved = after(s, 'shift', 0.35, 0.8);
    s.show('fs', s.win('shift', 'grad'));
    s.show('gs', s.win('grad', 'dist'));
    s.show('rs', s.ease('dist', 0.6));
    // The frame slides under a fixed curve: data x is the distance from the bottom, the labels move.
    const F = bowl(s, 0.19, 0.6, 1.6);
    axes(s, F, 'x', 'f', { x: 'orange', y: 'purple' });
    s.alpha(1 - moved, () => tick(s, F, 0, '0'));
    s.alpha(moved, () => {
      tick(s, F, 0, '3');
      tick(s, F, 1, '4');
    });
    curve(s, F, (x) => x * x, -1.6, 1.6, 'purple');
    s.alpha(s.win('grad', 'dist'), () => {
      curve(s, F, (x) => 1 + 2 * (x - 1), 0.55, 1.45, '--ink-3', { width: 0.4, dash: [1.4, 1] });
      s.text('slope 2a(x − 3)', F.X(0.82), F.Y(1.25), { size: 3.4, font: 'mono', weight: 600, align: 'right', color: s.c('red'), halo: true });
    });
    const P = path(0.3, 3);
    const t = s.since('same') < 0 ? 1.2 * from(s, 'dist', 0.62) : 1.2 + 1.2 * from(s, 'same', 0.2) + 1.2 * from(s, 'same', 0.5);
    s.alpha(moved, () => descent(s, F, P, t, 1.2, 'blue'));
    const xs = columns(s, 4, s.tall ? 21 : 20);
    const done = hop(P, t, 1.2).done;
    s.alpha(s.ease('dist', 0.6, 0.3), () => {
      const rowAt = (y: number, name: string, vals: string[], by?: string) => {
        s.text(name, xs[0]! - 9.5 * s.u, y, { size: 3.2, font: 'mono', weight: 650, align: 'right', color: s.c('orange') });
        vals.forEach((v, i) => {
          s.alpha(i <= done ? 1 : 0.15, () => cells(s, [xs[i]!], y, [v], 'orange', { w: 14, h: 8, size: 3.4, on: [i === done ? 1 : 0] }));
          if (i && by) s.alpha(i <= done ? 1 : 0, () => s.text(by, (xs[i - 1]! + xs[i]!) / 2, y - 7 * s.u, { size: 3, font: 'mono', color: s.c('slate') }));
        });
      };
      rowAt(s.h * 0.72, 'x', P.map(([x]) => fmt(x + 3)));
      rowAt(s.h * 0.86, 'x − 3', P.map(([x]) => fmt(x)), '×0.4');
    });
  },
};

const tryIt: SceneDef = {
  marks: {
    q1: { tex: String.raw`\symf(\symx) = 4(\symx - 3)^2,\quad \symeta_{\max} = \,?`, x: 0.5, y: 0.08, size: 4.8 },
    e1: { tex: String.raw`a = 4{:}\quad \symeta_{\max} = 1/4 = 0.25`, x: 0.5, y: 0.75, size: 4.6 },
    q2: { tex: String.raw`\symf(\symx) = 4(\symx - 3)^2,\quad \text{one step: } \symeta = \,?`, x: 0.5, y: 0.08, size: 4.8 },
    o1: { tex: String.raw`1/(2 \times 4) = 1/8 = 0.125`, x: 0.5, y: 0.75, size: 4.6 },
    q3: { tex: String.raw`\symf(\symx) = 4(\symx - 3)^2,\quad \symeta = 0.2`, x: 0.5, y: 0.08, size: 4.8 },
    z1: { tex: String.raw`1 - 8 \times 0.2 = -0.6`, x: 0.5, y: 0.75, size: 4.6 },
    z2: { tex: String.raw`-1 < -0.6 < 0{:}\ \ \text{zigzags in}`, x: 0.5, y: 0.85, size: 4.6 },
  },
  draw(s) {
    const one = 1 - s.ease('p2', 0.5);
    const two = s.ease('p2', 0.5) * (1 - s.ease('p3', 0.5));
    const three = s.ease('p3', 0.5);
    s.show('q1', s.ease('p1', 0.6) * one);
    s.show('e1', after(s, 'a1', 0.5) * one);
    s.show('q2', two);
    s.show('o1', after(s, 'a2', 0.5) * two);
    s.show('q3', three);
    s.show('z1', after(s, 'z1', 0.3));
    s.show('z2', after(s, 'z1', 0.6));
    const F = frame(12 * s.u, s.h * 0.17, s.w - 8 * s.u, s.h * 0.64, [0, 0.35], [-1.8, 1.2]);
    bands(s, F, 1);
    curve(s, F, (e) => 1 - 8 * e, 0, 0.35, 'orange', { width: 0.7, upto: s.ease('p1', 1.4, 0.6) });
    s.alpha(s.ease('p1', 0.6, 1.2), () =>
      s.text('factor 1 − 8η', F.X(0.03), F.Y(1.0), { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c('orange'), halo: true }),
    );
    const label = (t: string, x: number, y: number) => s.text(t, x, y, { size: 3.4, font: 'mono', align: 'left', color: s.c('--ink'), halo: true });
    s.alpha(after(s, 'a1', 0.5), () => {
      ball(s, F.X(0.25), F.Y(-1), 'red', 1.6);
      label('0.25', F.X(0.25) + 2.6 * s.u, F.Y(-1) - 3 * s.u);
    });
    s.alpha(after(s, 'a2', 0.5), () => {
      ball(s, F.X(0.125), F.Y(0), 'green', 1.6);
      label('0.125', F.X(0.125) + 2.6 * s.u, F.Y(0) - 3 * s.u);
    });
    s.alpha(after(s, 'z1', 0.3), () => {
      ball(s, F.X(0.2), F.Y(-0.6), 'gold', 1.6);
      label('0.2', F.X(0.2) + 2.6 * s.u, F.Y(-0.6) - 3 * s.u);
    });
  },
};

export const scenes: Record<string, SceneDef> = { ask, line, slide, try: tryIt };

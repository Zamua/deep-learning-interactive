import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01, smooth } from '../../../lecture/scene';
import { cells, columns } from '../../draw';
import { axes, ball, clipped, curve, frame, hop, type Frame } from '../draw';

const sq = (x: number) => x * x;
const fmt = (v: number) => String(Math.round(v * 1000) / 1000).replace('-', '−');
/** Eased 0 -> 1 from a fraction `f` of the way through beat `id`, so it tracks the voice at any pace. */
const after = (s: Scene, id: string, f: number, dur = 0.5) => smooth((s.t - s.at(id) - f * (s.end(id) - s.at(id))) / dur);
/** Linear 0 -> 1 over `dur` seconds from a fraction `f` of the way through beat `id`. */
const from = (s: Scene, id: string, f: number, dur = 1.2) => clamp01((s.t - s.at(id) - f * (s.end(id) - s.at(id))) / dur);

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

const factor: SceneDef = {
  marks: {
    f: { tex: String.raw`\symf(\symx) = a\,\symx^2`, x: 0.5, y: 0.09, size: 5.6 },
    step: { tex: String.raw`\symx \leftarrow \symx - \symeta \cdot 2a\symx`, x: 0.5, y: 0.09, size: 5.6 },
    r: { tex: String.raw`\symx \leftarrow (1 - 2a\symeta)\,\symx`, x: 0.5, y: 0.09, size: 5.6 },
  },
  draw(s) {
    s.show('f', s.win('bowl', 'grad'));
    s.show('step', s.win('grad', 'factor'));
    s.show('r', s.ease('factor', 0.6));
    const F = bowl(s, 0.19, 0.6);
    axes(s, F, 'x', 'f', { x: 'orange', y: 'purple' });
    s.line(F.X(0), F.b - 1.2 * s.u, F.X(0), F.b + 1.2 * s.u, s.c('--axis'), 0.35);
    s.text('0', F.X(0), F.b + 4 * s.u, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
    curve(s, F, sq, -1.6, 1.6, 'purple', { upto: s.ease('bowl', 1.2) });
    s.alpha(s.win('grad', 'factor'), () => {
      curve(s, F, (x) => 1 + 2 * (x - 1), 0.55, 1.45, '--ink-3', { width: 0.4, dash: [1.4, 1] });
      s.text('slope 2ax = 2', F.X(0.85), F.Y(1.25), { size: 3.4, font: 'mono', weight: 600, align: 'right', color: s.c('red'), halo: true });
    });
    const P = path(0.3, 3);
    // One hop in `factor`; the next two land as `repeat` names them.
    const t = s.since('repeat') < 0 ? Math.min(1.2, s.since('factor') - 1.5) : 1.2 + 1.2 * from(s, 'repeat', 0.42) + 1.2 * from(s, 'repeat', 0.68);
    s.alpha(s.ease('bowl', 0.6, 0.8), () => {
      if (s.since('factor') < 0) ball(s, F.X(1), F.Y(1), 'blue');
      else descent(s, F, P, t, 1.2);
    });
    const xs = columns(s, 4, s.tall ? 21 : 20);
    s.alpha(s.ease('factor', 0.6, 1.5), () => row(s, xs, s.h * 0.82, P.map(([x]) => fmt(x)), hop(P, t, 1.2).done, 'x', '×0.4'));
  },
};

const RUNS = [
  { beat: 'small', lr: 0.05, r: 0.9, n: 14, name: 'creeps' },
  { beat: 'good', lr: 0.3, r: 0.4, n: 6, name: 'slides in' },
  { beat: 'zig', lr: 0.8, r: -0.6, n: 10, name: 'zigzags in' },
  { beat: 'big', lr: 1.1, r: -1.2, n: 6, name: 'blows up' },
] as const;
const PATHS = RUNS.map((r) => path(r.lr, r.n));

const race: SceneDef = {
  draw(s) {
    const F = bowl(s, 0.15, 0.68, 1.9);
    axes(s, F, 'x', 'f', { x: 'orange', y: 'purple' });
    curve(s, F, sq, -1.9, 1.9, 'purple');
    const cur = RUNS.reduce((k, r, i) => (s.since(r.beat) >= 0 ? i : k), 0);
    s.slot('lr', String(RUNS[cur]!.lr));
    s.slot('r', String(RUNS[cur]!.r));
    RUNS.forEach((r, i) => {
      const next = RUNS[i + 1];
      s.alpha(s.ease(r.beat, 0.4) * (next ? 1 - s.ease(next.beat, 0.4) : 1), () => {
        descent(s, F, PATHS[i]!, s.since(r.beat) - 0.5, r.lr < 0.1 ? 0.6 : 0.8, i === 3 ? 'red' : 'blue');
        s.text(`η = ${r.lr}   factor ${fmt(r.r)}`, s.w / 2, s.h * 0.07, { size: 3.8, font: 'mono', weight: 600, color: s.c('--ink-2') });
      });
    });
    const xs = columns(s, 4, s.tall ? 25 : 22);
    const y = s.h * 0.8;
    const colors = ['blue', 'green', 'gold', 'red'] as const;
    RUNS.forEach((r, i) => {
      const on = s.since(r.beat) >= 0 ? (i === cur ? 1 : 0.35) : 0.12;
      s.alpha(on, () => {
        cells(s, [xs[i]!], y, [`×${fmt(r.r)}`], colors[i], { w: 15, h: 8, size: 3.4, on: [i === cur ? 1 : 0] });
        s.text(r.name, xs[i]!, y + 8 * s.u, { size: 3.2, color: s.c(colors[i]) });
      });
    });
  },
};

/** The worked problem's path on 4x² from 3 with η = 0.1: each step multiplies x by 0.2. */
const TRY: [number, number][] = [
  [3, 36],
  [0.6, 1.44],
  [0.12, 0.0576],
];

const tryIt: SceneDef = {
  marks: {
    q1: { tex: String.raw`\symf(\symx) = 4\symx^2,\quad \symx = 3,\quad \symeta = 0.1`, x: 0.5, y: 0.08, size: 4.8 },
    g1: { tex: String.raw`\symg = 2 \times 4 \times 3 = 24`, x: 0.5, y: 0.69, size: 4.6 },
    st1: { tex: String.raw`\symeta\,\symg = 0.1 \times 24 = 2.4`, x: 0.5, y: 0.78, size: 4.6 },
    c1: { tex: String.raw`1 - 2 \times 4 \times 0.1 = 0.2`, x: 0.5, y: 0.69, size: 4.6 },
    c2: { tex: String.raw`0.2 \times 3 = 0.6`, x: 0.5, y: 0.78, size: 4.6 },
    x1: { tex: String.raw`\symx \leftarrow 3 - 2.4 = 0.6`, x: 0.5, y: 0.87, size: 4.6 },
    x2: { tex: String.raw`\symx \leftarrow 0.2 \times 0.6 = 0.12`, x: 0.5, y: 0.78, size: 4.6 },
    wh: { tex: String.raw`0 < 0.2 < 1{:}\ \ \text{slides straight in}`, x: 0.5, y: 0.87, size: 4.6 },
  },
  draw(s) {
    const two = s.ease('two', 0.5);
    s.show('q1', s.ease('p1', 0.6));
    s.show('g1', after(s, 'a1', 0.05) * (1 - s.ease('check', 0.4)));
    s.show('st1', after(s, 'a1', 0.35) * (1 - s.ease('check', 0.4)));
    s.show('x1', after(s, 'a1', 0.7), { y: 0.87 - 0.18 * two });
    s.show('c1', after(s, 'check', 0.1) * (1 - two));
    s.show('c2', after(s, 'check', 0.6) * (1 - two));
    s.show('x2', after(s, 'two', 0.55));
    s.show('wh', after(s, 'where', 0.5));
    s.alpha(s.ease('p1', 0.6), () => {
      const F = frame(10 * s.u, s.h * 0.17, s.w - 8 * s.u, s.h * 0.6, [-3.6, 3.6], [0, 52]);
      axes(s, F, 'x', 'f', { x: 'orange', y: 'purple' });
      curve(s, F, (x) => 4 * x * x, -3.6, 3.6, 'purple');
      const at = (x: number, t: string) => {
        s.line(F.X(x), F.b - 1.2 * s.u, F.X(x), F.b + 1.2 * s.u, s.c('--axis'), 0.35);
        s.text(t, F.X(x), F.b + 4 * s.u, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
      };
      at(3, '3');
      s.alpha(after(s, 'a1', 0.75), () => at(0.6, '0.6'));
      s.alpha(after(s, 'a1', 0.05) * (1 - after(s, 'a1', 0.7)), () => {
        curve(s, F, (x) => 36 + 24 * (x - 3), 2.4, 3.5, '--ink-3', { width: 0.4, dash: [1.4, 1] });
        s.text('slope 24', F.X(2.75), F.Y(42), { size: 3.4, font: 'mono', weight: 600, align: 'right', color: s.c('red'), halo: true });
      });
      const t = s.since('two') < 0 ? Math.min(1.2, s.t - s.at('a1') - 0.72 * (s.end('a1') - s.at('a1'))) : 1.2 + 1.2 * from(s, 'two', 0.5);
      descent(s, F, TRY, t, 1.2);
    });
  },
};

export const scenes: Record<string, SceneDef> = { factor, race, try: tryIt };

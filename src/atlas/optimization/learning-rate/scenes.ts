import type { Scene, SceneDef } from '../../../lecture/scene';
import { cells, columns } from '../../draw';
import { axes, ball, clipped, curve, frame, hop, type Frame } from '../draw';

const sq = (x: number) => x * x;
const fmt = (v: number) => String(Math.round(v * 1000) / 1000).replace('-', '−');

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
    const F = bowl(s, 0.2, 0.7);
    axes(s, F, 'x', 'f', { x: 'orange', y: 'purple' });
    s.line(F.X(0), F.b - 1.2 * s.u, F.X(0), F.b + 1.2 * s.u, s.c('--axis'), 0.35);
    s.text('0', F.X(0), F.b + 4 * s.u, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
    curve(s, F, sq, -1.6, 1.6, 'purple', { upto: s.ease('bowl', 1.2) });
    s.alpha(s.win('grad', 'factor'), () => {
      curve(s, F, (x) => 1 + 2 * (x - 1), 0.55, 1.45, '--ink-3', { width: 0.4, dash: [1.4, 1] });
      s.text('slope 2ax = 2', F.X(0.85), F.Y(1.25), { size: 3.4, font: 'mono', weight: 600, align: 'right', color: s.c('red'), halo: true });
    });
    const P = path(0.3, 3);
    s.alpha(s.ease('bowl', 0.6, 0.8), () => {
      if (s.since('factor') < 0) ball(s, F.X(1), F.Y(1), 'blue');
      else descent(s, F, P, s.since('factor') - 1.5, 1.2);
    });
    s.alpha(s.ease('factor', 0.6, 1.5), () => {
      const xs = columns(s, 4, s.tall ? 24 : 20);
      const y = s.h * 0.85;
      const n = Math.min(3, Math.floor((s.since('factor') - 1.5) / 1.2) + 1);
      P.forEach(([x], i) => {
        s.alpha(i <= n ? 1 : 0.15, () => cells(s, [xs[i]!], y, [fmt(x)], 'orange', { w: 14, h: 8, size: 3.4, on: [i === n ? 1 : 0] }));
        if (i) s.alpha(i <= n ? 1 : 0, () => s.text('×0.4', (xs[i - 1]! + xs[i]!) / 2, y - 7 * s.u, { size: 3, font: 'mono', color: s.c('slate') }));
      });
    });
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

const limit: SceneDef = {
  marks: {
    r: { tex: String.raw`\text{factor} = 1 - 2a\symeta`, x: 0.5, y: 0.08, size: 5 },
    max: { tex: String.raw`\symeta_{\max} = 1/a`, x: 0.5, y: 0.08, size: 5.6 },
  },
  draw(s) {
    s.show('r', 1 - s.ease('steep', 0.5));
    s.show('max', s.ease('steep', 0.6, 2));
    const F = frame(12 * s.u, s.h * 0.17, s.w - 8 * s.u, s.h - 9 * s.u, [0, 1.3], [-1.8, 1.2]);
    const band = (y0: number, y1: number, k: 'green' | 'gold' | 'red') => s.rrect(F.l, F.Y(y1), F.r - F.l, F.Y(y0) - F.Y(y1), 0, { fill: s.tint(k, 0.1) });
    band(0, 1, 'green');
    band(-1, 0, 'gold');
    band(-1.8, -1, 'red');
    s.line(F.l, F.Y(0), F.r, F.Y(0), s.c('--axis'), 0.35);
    s.line(F.l, F.t, F.l, F.b, s.c('--axis'), 0.35);
    s.text('η', F.r, F.Y(0) + 4 * s.u, { size: 3.6, font: 'mono', weight: 650, align: 'right', color: s.c('slate') });
    const tick = (v: number) => s.text(String(v).replace('-', '−'), F.l - 2 * s.u, F.Y(v), { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
    [1, 0, -1].forEach(tick);
    const lab = { size: 3.4, align: 'right' as const, halo: true };
    s.text('slides in', F.r - 2 * s.u, F.Y(0.75), { ...lab, color: s.c('green') });
    s.text('zigzags in', F.r - 2 * s.u, F.Y(-0.5), { ...lab, color: s.c('gold') });
    s.text('blows up', F.l + 3 * s.u, F.Y(-1.4), { ...lab, align: 'left', color: s.c('red') });
    curve(s, F, (e) => 1 - 2 * e, 0, 1.3, 'orange', { width: 0.7, upto: s.ease('line', 1.4) });
    s.alpha(s.ease('line', 0.6, 1.4), () => {
      RUNS.forEach((r) => s.circle(F.X(r.lr), F.Y(r.r), 1.1 * s.u, { fill: s.tint('orange', 0.6) }));
    });
    s.alpha(s.ease('half', 0.6), () => ball(s, F.X(0.5), F.Y(0), 'green', 1.6));
    s.alpha(s.win('half', 'steep'), () => {
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
  },
};

const example: SceneDef = {
  draw(s) {
    const xs = columns(s, 3, s.tall ? 26 : 22);
    const y = s.h * 0.18;
    const given: [string, string, 'purple' | 'orange' | 'slate'][] = [
      ['a', '2', 'purple'],
      ['x', '3', 'orange'],
      ['η', '0.1', 'slate'],
    ];
    given.forEach(([name, v, k], i) => {
      s.text(name, xs[i]!, y - 9 * s.u, { size: 3.8, font: 'mono', weight: 650, color: s.c(k) });
      cells(s, [xs[i]!], y, [v], k, { on: [s.win('grad', 'step') * (i < 2 ? 1 : 0) + s.win('step', 'check') * (i === 2 ? 1 : 0)] });
    });
    const line = (beat: string, text: string, at: number, o: { k?: 'orange' | '--ink-2'; size?: number } = {}) =>
      s.alpha(s.ease(beat, 0.6), () => s.text(text, s.w / 2, s.h * at, { size: o.size ?? 4, font: 'mono', weight: o.k === 'orange' ? 650 : 500, color: s.c(o.k ?? '--ink-2') }));
    s.alpha(s.win('ask', 'grad', 0.3), () => s.text('f(x) = 2x²,  x after one step = ?', s.w / 2, s.h * 0.42, { size: 3.8, font: 'mono', color: s.c('--ink-3') }));
    line('grad', 'g = 2ax = 2 × 2 × 3 = 12', 0.38);
    line('step', 'x − ηg = 3 − 0.1 × 12 = 1.8', 0.54, { k: 'orange', size: 4.4 });
    line('check', 'factor 1 − 2aη = 0.6', 0.72);
    line('check', '0.6 × 3 = 1.8', 0.83);
  },
};

export const scenes: Record<string, SceneDef> = { factor, race, limit, example };

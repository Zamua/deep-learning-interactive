import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01 } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { after, cells, columns } from '../../draw';
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

/** Gradient descent on a x² from x0: every point it visits, each step multiplying x by 1 - 2a eta. */
const path = (eta: number, n: number, a = 1, x0 = 1): [number, number][] =>
  Array.from({ length: n + 1 }, (_, k) => {
    const x = x0 * (1 - 2 * a * eta) ** k;
    return [x, a * x * x];
  });

/** A ball hopping along `pts`, with the chords and dots it leaves behind. */
function descent(s: Scene, F: Frame, pts: [number, number][], t: number, every: number, k: Color): void {
  const h = hop(pts, t, every);
  clipped(s, F, () => {
    for (let i = 0; i < h.done; i++) s.line(F.X(pts[i]![0]), F.Y(pts[i]![1]), F.X(pts[i + 1]![0]), F.Y(pts[i + 1]![1]), s.tint('slate', 0.75), 0.4);
    if (h.done < pts.length - 1) s.line(F.X(pts[h.done]![0]), F.Y(pts[h.done]![1]), F.X(h.x), F.Y(h.y), s.tint('slate', 0.75), 0.4);
    for (let i = 0; i <= h.done; i++) s.circle(F.X(pts[i]![0]), F.Y(pts[i]![1]), 0.8 * s.u, { fill: s.tint(k, 0.45) });
    ball(s, F.X(h.x), F.Y(h.y), k);
  });
}

/** Seconds per hop so a walk of `n` hops fits inside beat `id`, starting `lead` seconds in. */
const pace = (s: Scene, id: string, n: number, lead: number) => Math.min(0.9, Math.max(0.28, (s.end(id) - s.at(id) - lead - 0.3) / n));

/** The four walks: each step size, its factor, how many hops to draw, and what the walk does. */
const RUNS = [
  { beat: 'creep', eta: 0.05, r: 0.9, n: 14, name: 'creeps', k: 'blue' },
  { beat: 'slide', eta: 0.3, r: 0.4, n: 5, name: 'slides in', k: 'green' },
  { beat: 'zig', eta: 0.8, r: -0.6, n: 8, name: 'zigzags in', k: 'gold' },
  { beat: 'blow', eta: 1.1, r: -1.2, n: 5, name: 'blows up', k: 'red' },
] as const;
const PATHS = RUNS.map((r) => path(r.eta, r.n));

/** One walk per beat, the last one fading as the next begins; returns the index of the current one. */
function walks(s: Scene, F: Frame, beats: readonly string[], keepLast: number): number {
  const cur = beats.reduce((k, b, i) => (s.since(b) >= 0 ? i : k), 0);
  RUNS.forEach((r, i) => {
    const b = beats[i]!;
    const next = beats[i + 1];
    const out = next ? 1 - s.ease(next, 0.4) : keepLast;
    s.alpha(s.ease(b, 0.4) * out, () => descent(s, F, PATHS[i]!, s.since(b) - 0.5, pace(s, b, r.n, 0.5), r.k));
  });
  return cur;
}

const race: SceneDef = {
  marks: {
    f: { tex: String.raw`\symf(\symx) = \symx^2`, x: 0.5, y: 0.08, size: 5.6 },
  },
  draw(s) {
    s.show('f', s.win('bowl', 'creep'));
    const F = bowl(s, 0.17, 0.64, 1.9);
    axes(s, F, 'x', 'f', { x: 'orange', y: 'purple' });
    tick(s, F, 0, '0');
    tick(s, F, 1, '1');
    curve(s, F, (x) => x * x, -1.9, 1.9, 'purple', { upto: s.ease('bowl', 1.2) });
    s.alpha(s.ease('bowl', 0.6, 0.8) * (1 - s.ease('creep', 0.4)), () => ball(s, F.X(1), F.Y(1), 'blue'));
    s.alpha(after(s, 'bowl', 0.55) * (1 - s.ease('creep', 0.4)), () => {
      curve(s, F, (x) => 1 + 2 * (x - 1), 0.55, 1.45, '--ink-3', { width: 0.4, dash: [1.4, 1] });
      s.text('slope 2', F.X(0.82), F.Y(1.25), { size: 3.4, font: 'mono', weight: 600, align: 'right', color: s.c('red'), halo: true });
      s.arrow(F.X(1), F.b - 4 * s.u, F.X(0.6), F.b - 4 * s.u, s.c('--ink-2'), 0.5, 2);
    });
    const cur = walks(s, F, RUNS.map((r) => r.beat), 1 - 0.7 * s.ease('why', 0.6));
    const live = s.since('creep') >= 0;
    s.slot('eta', live ? String(RUNS[cur]!.eta) : '0.05');
    s.alpha(s.ease('creep', 0.4) * (1 - s.ease('why', 0.5)), () =>
      s.text(`η = ${RUNS[cur]!.eta}`, s.w / 2, s.h * 0.08, { size: 4.2, font: 'mono', weight: 650, color: s.c(RUNS[cur]!.k) }),
    );
    s.alpha(s.ease('why', 0.6), () => s.text('same bowl, same rule', s.w / 2, s.h * 0.08, { size: 4, italic: true, color: s.c('--ink-2') }));
    const xs = columns(s, 4, s.tall ? 25 : 24);
    const y = s.h * 0.8;
    RUNS.forEach((r, i) => {
      const on = s.since(r.beat) < 0 ? 0 : s.since('why') >= 0 ? 0.9 : i === cur ? 1 : 0.4;
      s.alpha(on, () => {
        cells(s, [xs[i]!], y, [`η ${r.eta}`], r.k, { w: 17, h: 8, size: 3.3, on: [i === cur && s.since('why') < 0 ? 1 : 0] });
        s.text(r.name, xs[i]!, y + 8 * s.u, { size: 3.3, color: s.c(r.k) });
      });
    });
  },
};

const factor: SceneDef = {
  marks: {
    f: { tex: String.raw`\symf(\symx) = a\,\symx^2`, x: 0.5, y: 0.09, size: 5.6 },
    g: { tex: String.raw`\symg = 2a\symx`, x: 0.5, y: 0.71, size: 5 },
    step: { tex: String.raw`\symx \leftarrow \symx - \symeta \cdot 2a\symx`, x: 0.5, y: 0.8, size: 5 },
    r: { tex: String.raw`\symx \leftarrow (1 - 2a\symeta)\,\symx`, x: 0.5, y: 0.89, size: 5 },
    name: { tex: String.raw`\text{step factor} = 1 - 2a\symeta`, x: 0.5, y: 0.73, size: 4.6 },
    n: { tex: String.raw`1 - 2 \cdot 1 \cdot 0.3 = 0.4`, x: 0.5, y: 0.73, size: 4.6 },
  },
  draw(s) {
    // The derivation builds below the bowl; its result then rises to replace f at the top.
    const up = s.ease('name', 0.8);
    s.show('f', 1 - up);
    s.show('g', s.ease('grad', 0.6) * (1 - s.ease('name', 0.4)));
    s.show('step', s.ease('step', 0.6) * (1 - s.ease('name', 0.4)));
    s.show('r', s.ease('pull', 0.6), { y: 0.89 - 0.8 * up });
    s.show('name', after(s, 'name', 0.3) * (1 - s.ease('num', 0.4)));
    s.show('n', after(s, 'num', 0.5));
    // Raise a and bring it back while the voice says what it does.
    const steep = after(s, 'a', 0.55, 0.9) * (1 - after(s, 'a', 0.85, 0.9));
    const a = 1 + 1.5 * steep;
    const F = bowl(s, 0.21, 0.62, 1.6);
    axes(s, F, 'x', 'f', { x: 'orange', y: 'purple' });
    tick(s, F, 0, '0');
    curve(s, F, (x) => a * x * x, -1.6, 1.6, 'purple');
    s.alpha(s.win('a', 'grad'), () =>
      s.text(`a = ${a.toFixed(1)}`, s.w / 2, F.t + 4 * s.u, { size: 3.8, font: 'mono', weight: 600, color: s.c('purple'), halo: true }),
    );
    s.alpha(s.win('grad', 'pull'), () => {
      curve(s, F, (x) => 1 + 2 * (x - 1), 0.55, 1.45, '--ink-3', { width: 0.4, dash: [1.4, 1] });
      s.text('slope 2ax', F.X(0.82), F.Y(1.25), { size: 3.4, font: 'mono', weight: 600, align: 'right', color: s.c('red'), halo: true });
    });
    const P = path(0.3, 3);
    // One hop as `x1` names it; the next two as `x2` reads them.
    const t = s.since('x2') < 0 ? 1.2 * from(s, 'x1', 0.3) : 1.2 + 1.2 * from(s, 'x2', 0.35) + 1.2 * from(s, 'x2', 0.8);
    s.alpha(s.ease('a', 0.6, 0.6), () => {
      if (s.since('x1') < 0) ball(s, F.X(1), F.Y(a), 'blue');
      else descent(s, F, P, t, 1.2, 'blue');
    });
    const xs = columns(s, 4, s.tall ? 21 : 20);
    const done = hop(P, t, 1.2).done;
    s.alpha(s.ease('x1', 0.5), () => {
      const y = s.h * 0.86;
      s.text('x', xs[0]! - 9.5 * s.u, y, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('orange') });
      P.forEach(([x], i) => {
        s.alpha(i <= done ? 1 : 0.15, () => cells(s, [xs[i]!], y, [fmt(x)], 'orange', { w: 14, h: 8, size: 3.4, on: [i === done ? 1 : 0] }));
        if (i) s.alpha(i <= done ? 1 : 0, () => s.text('×0.4', (xs[i - 1]! + xs[i]!) / 2, y - 7 * s.u, { size: 3, font: 'mono', color: s.c('slate') }));
      });
    });
  },
};

/** The factor's number line: bands for blows up, zigzags in and slides in, with ticks at -1, 0 and 1. */
function factorLine(s: Scene, l: number, r: number, y: number, lit: number[]): (v: number) => number {
  const X = (v: number) => l + ((v + 1.6) / 2.8) * (r - l);
  const bands: [number, number, Color, string][] = [
    [-1.6, -1, 'red', 'blows up'],
    [-1, 0, 'gold', 'zigzags in'],
    [0, 1, 'green', 'slides in'],
  ];
  bands.forEach(([a, b, k, name], i) => {
    const on = lit[i] ?? 0;
    s.rrect(X(a), y - 7 * s.u, X(b) - X(a), 7 * s.u, 0, { fill: s.tint(k, 0.06 + 0.12 * on) });
    s.alpha(on, () => s.text(name, (X(a) + X(b)) / 2, y - 11 * s.u, { size: 3.3, color: s.c(k) }));
  });
  s.line(l, y, r, y, s.c('--axis'), 0.35);
  for (const v of [-1, 0, 1]) {
    s.line(X(v), y - 1.2 * s.u, X(v), y + 1.2 * s.u, s.c('--axis'), 0.35);
    s.text(String(v).replace('-', '−'), X(v), y + 4 * s.u, { size: 3.1, font: 'mono', color: s.c('--ink-3') });
  }
  s.text('factor', r, y + 9 * s.u, { size: 3.2, font: 'mono', weight: 600, align: 'right', color: s.c('slate') });
  return X;
}

/** Which band each walk's factor sits in: red, gold, green. */
const BAND = [2, 2, 1, 0];

const read: SceneDef = {
  draw(s) {
    const beats = ['creep', 'slide', 'zig', 'blow'];
    const F = bowl(s, 0.14, 0.5, 1.9);
    axes(s, F, 'x', 'f', { x: 'orange', y: 'purple' });
    tick(s, F, 0, '0');
    curve(s, F, (x) => x * x, -1.9, 1.9, 'purple');
    const cur = walks(s, F, beats, 1 - 0.8 * s.ease('map', 0.6));
    const run = RUNS[cur]!;
    s.slot('eta', String(run.eta));
    s.slot('r', fmt(run.r).replace('−', '-'));
    s.alpha(1 - s.ease('map', 0.5), () =>
      s.text(`η = ${run.eta}   factor ${fmt(run.r)}`, s.w / 2, s.h * 0.06, { size: 3.9, font: 'mono', weight: 650, color: s.c(run.k) }),
    );
    const mapOn = s.ease('map', 0.6);
    const lit = [0, 1, 2].map((b) => Math.max(mapOn, ...RUNS.map((r, i) => (BAND[i] === b && s.since(r.beat) >= 0 ? (i === cur ? 1 : 0.5) : 0))));
    const y = s.h * 0.8;
    const X = factorLine(s, 12 * s.u, s.w - 8 * s.u, y, lit);
    RUNS.forEach((r, i) => {
      const on = s.ease(r.beat, 0.5, 0.4);
      s.alpha(on * (i === cur || mapOn > 0 ? 1 : 0.45), () => {
        s.circle(X(r.r), y, 1.3 * s.u, { fill: s.c(r.k), stroke: s.c('--card'), lw: 0.4 });
        s.text(fmt(r.r), X(r.r), y - 3.6 * s.u, { size: 3, font: 'mono', weight: 600, color: s.c(r.k), halo: true });
      });
    });
    // The zigzag's size: the distance from 0 to the factor, which is under 1.
    s.alpha(s.win('zig2', 'blow'), () => {
      s.line(X(-0.6), y + 8.5 * s.u, X(0), y + 8.5 * s.u, s.c('gold'), 0.6);
      s.text('size 0.6 < 1', X(-0.3), y + 12 * s.u, { size: 3.1, font: 'mono', color: s.c('gold'), halo: true });
    });
  },
};

/** The worked problem's path on 4x² from 3 with η = 0.1: each step multiplies x by 0.2. */
const TRY = path(0.1, 2, 4, 3);

const tryIt: SceneDef = {
  marks: {
    q1: { tex: String.raw`\symf(\symx) = 4\symx^2,\quad \symx = 3,\quad \symeta = 0.1`, x: 0.5, y: 0.08, size: 4.8 },
    g1: { tex: String.raw`\symg = 2 \times 4 \times 3 = 24`, x: 0.5, y: 0.69, size: 4.6 },
    st1: { tex: String.raw`\symeta\,\symg = 0.1 \times 24 = 2.4`, x: 0.5, y: 0.78, size: 4.6 },
    x1: { tex: String.raw`\symx \leftarrow 3 - 2.4 = 0.6`, x: 0.5, y: 0.87, size: 4.6 },
    c1: { tex: String.raw`1 - 2 \times 4 \times 0.1 = 0.2`, x: 0.5, y: 0.78, size: 4.6 },
    x2: { tex: String.raw`\symx \leftarrow 0.2 \times 0.6 = 0.12`, x: 0.5, y: 0.87, size: 4.6 },
    wh: { tex: String.raw`0 < 0.2 < 1{:}\ \ \text{slides straight in}`, x: 0.5, y: 0.87, size: 4.6 },
  },
  draw(s) {
    const chk = s.ease('check', 0.5);
    const wh = s.ease('where', 0.5);
    s.show('q1', s.ease('p1', 0.6));
    s.show('g1', after(s, 'g', 0.1) * (1 - chk));
    s.show('st1', after(s, 'stp', 0.2) * (1 - chk));
    s.show('x1', after(s, 'x1', 0.5) * (1 - wh), { y: 0.87 - 0.18 * chk });
    s.show('c1', after(s, 'check', 0.45));
    s.show('x2', after(s, 'two', 0.6) * (1 - wh));
    s.show('wh', after(s, 'where', 0.4));
    s.alpha(s.ease('p1', 0.6), () => {
      const F = frame(10 * s.u, s.h * 0.17, s.w - 8 * s.u, s.h * 0.6, [-3.6, 3.6], [0, 52]);
      axes(s, F, 'x', 'f', { x: 'orange', y: 'purple' });
      curve(s, F, (x) => 4 * x * x, -3.6, 3.6, 'purple');
      tick(s, F, 3, '3');
      s.alpha(after(s, 'x1', 0.5), () => tick(s, F, 0.6, '0.6'));
      s.alpha(after(s, 'g', 0.1) * (1 - s.ease('x1', 0.4)), () => {
        curve(s, F, (x) => 36 + 24 * (x - 3), 2.4, 3.5, '--ink-3', { width: 0.4, dash: [1.4, 1] });
        s.text('slope 24', F.X(2.75), F.Y(42), { size: 3.4, font: 'mono', weight: 600, align: 'right', color: s.c('red'), halo: true });
      });
      const t = s.since('two') < 0 ? 1.2 * from(s, 'x1', 0.3) : 1.2 + 1.2 * from(s, 'two', 0.55);
      descent(s, F, TRY, t, 1.2, 'blue');
    });
  },
};

export const scenes: Record<string, SceneDef> = { race, factor, read, try: tryIt };

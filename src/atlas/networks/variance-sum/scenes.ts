import type { Scene, SceneDef } from '../../../lecture/scene';
import { Rng } from '../../../core/rand';
import { cells, columns, rowLabel } from '../../draw';
import { after, caption, Frame, rich, type Ink } from '../draw';

const fmt = (v: number): string => String(v).replace('-', '−');

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

// ---- swing: z as a sum of n terms of -1 or 1, over many examples

const NS = [1, 4, 100] as const;
const rng = new Rng(11);
/** 80 examples for each n: the n terms, each -1 or 1. */
const EXAMPLES = NS.map((n) => Array.from({ length: 80 }, () => Array.from({ length: n }, () => (rng.next() < 0.5 ? -1 : 1))));

/** The exact chance of each sum of n terms of -1 or 1, as [sum, chance] pairs. */
function dist(n: number): [number, number][] {
  const out: [number, number][] = [];
  let logC = 0;
  for (let k = 0; k <= n; k++) {
    if (k > 0) logC += Math.log((n - k + 1) / k);
    out.push([2 * k - n, Math.exp(logC - n * Math.LN2)]);
  }
  return out;
}
const DISTS = NS.map(dist);
const PEAK = DISTS.map((d) => Math.max(...d.map(([, p]) => p)));

/** The plot of z's sums, wide enough for a hundred terms. */
const zFrame = (s: Scene, top: number, bottom: number) => new Frame(s, 8 * s.u, top, s.w - 8 * s.u, bottom, [-30, 30], [0, 1.05]);

function zAxis(s: Scene, F: Frame) {
  F.axes();
  s.text('z', F.r, F.Y(0) + 4 * s.u, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('purple') });
  for (const t of [-20, -10, 0, 10, 20]) s.text(fmt(t), F.X(t), F.Y(0) + 4 * s.u, { size: 3, font: 'mono', color: s.c('--ink-3') });
}

/** How often each sum comes up, scaled so the tallest bar is 0.9 high; `hi` lights one sum. */
function sumBars(s: Scene, F: Frame, i: number, hi?: number) {
  const bw = F.X(i === 2 ? 1.5 : 1.3) - F.X(0);
  for (const [z, p] of DISTS[i]!) {
    if (z < -30 || z > 30 || p < 1e-4) continue;
    const h = F.Y(0) - F.Y((0.9 * p) / PEAK[i]!);
    const on = z === hi ? 1 : 0;
    s.rrect(F.X(z) - bw / 2, F.Y(0) - h, bw, Math.max(h, 0.3 * s.u), 0.3, { fill: s.tint('gold', 0.3 + 0.4 * on), stroke: s.tint('gold', 0.7 + 0.3 * on), lw: 0.25 });
  }
}

/** The terms of one example: cells for a few, a grid of small squares for a hundred. */
function terms(s: Scene, ts: number[], y: number) {
  const u = s.u;
  if (ts.length <= 4) {
    const xs = columns(s, ts.length, 12);
    xs.forEach((x, j) => {
      const k: Ink = ts[j]! > 0 ? 'blue' : 'red';
      s.cell(x - 4.5 * u, y - 3.5 * u, 9 * u, 7 * u, fmt(ts[j]!), k, { on: 0.4, size: 3.4 });
    });
    return;
  }
  const cols = 25;
  const pitch = 2.8 * u;
  const x0 = s.w / 2 - ((cols - 1) / 2) * pitch;
  const y0 = y - 1.5 * pitch;
  ts.forEach((t, j) => {
    const x = x0 + (j % cols) * pitch;
    const yy = y0 + Math.floor(j / cols) * pitch;
    s.rrect(x - 1.1 * u, yy - 1.1 * u, 2.2 * u, 2.2 * u, 0.3, { fill: s.tint(t > 0 ? 'blue' : 'red', 0.55) });
  });
}

const swing: SceneDef = {
  draw(s) {
    const u = s.u;
    const o = { size: s.tall ? 3.4 : 3.8, weight: 600 };
    rich(s, [['z', 'purple'], [' = ', '--ink-2'], ['w₁', 'blue'], ['x₁', 'orange'], [' + ', '--ink-2'], ['w₂', 'blue'], ['x₂', 'orange'], [' + … + ', '--ink-2'], ['wₙ', 'blue'], ['xₙ', 'orange']], s.w / 2, s.h * 0.07, o);
    const F = zFrame(s, s.h * 0.44, s.h * 0.83);
    zAxis(s, F);
    const ty = s.h * 0.22;
    const zy = s.h * 0.34;
    const beats = ['one', 'four', 'many'] as const;
    const until = ['four', 'many', undefined] as const;
    beats.forEach((b, i) => {
      const a = s.win(b, until[i]);
      if (a <= 0.003) return;
      const k = Math.floor(Math.max(0, s.since(b) - 0.4) * 2.5) % 80;
      const ts = EXAMPLES[i]![k]!;
      const z = ts.reduce((p, q) => p + q, 0);
      s.alpha(a, () => {
        terms(s, ts, ty);
        s.text(`z = ${fmt(z)}`, s.w / 2, zy, { size: 3.8, font: 'mono', weight: 650, color: s.c('purple') });
        sumBars(s, F, i, z);
        F.dot(z, (0.9 * DISTS[i]!.find(([v]) => v === z)![1]) / PEAK[i]! + 0.06, 'purple', 1.2);
      });
    });
    s.alpha(s.win('unit', 'one'), () => {
      const xs = columns(s, 4, 12);
      xs.forEach((x) => s.cell(x - 4.5 * u, ty - 3.5 * u, 9 * u, 7 * u, '?', '--ink-3', { size: 3.4 }));
      s.text('z = ?', s.w / 2, zy, { size: 3.8, font: 'mono', weight: 650, color: s.c('purple') });
    });
    // A hundred terms: the swing past ten, then the tanh's flat ends.
    s.alpha(s.win('many', 'flat'), () => {
      for (const t of [-10, 10]) F.seg(t, 0, t, 1.02, '--ink-3', 0.3, [1, 0.8]);
    });
    const flat = s.ease('flat', 0.6);
    s.alpha(flat, () => {
      for (const [a, b] of [[-30, -3], [3, 30]] as const) s.rrect(F.X(a), F.t, F.X(b) - F.X(a), F.b - F.t, 0, { fill: s.tint('red', 0.08) });
      F.fn((z) => 0.5 + 0.45 * Math.tanh(z), 'purple', 0.7);
      s.text('tanh(z)', F.X(4), F.Y(0.95) - 3.5 * u, { size: 3.3, font: 'mono', weight: 650, align: 'left', color: s.c('purple'), halo: true });
      s.text('flat', F.X(-24), F.Y(0.22), { size: 3.3, font: 'mono', weight: 600, color: s.c('red'), halo: true });
      s.text('flat', F.X(24), F.Y(0.8), { size: 3.3, font: 'mono', weight: 600, color: s.c('red'), halo: true });
    });
    const cy = s.h * 0.93;
    s.alpha(s.win('unit', 'one'), () => caption(s, 'a new example: new inputs, a new z', cy));
    s.alpha(s.win('one', 'four'), () => caption(s, '1 term: z is −1 or 1', cy, 'gold'));
    s.alpha(s.win('four', 'many'), () => caption(s, '4 terms: z anywhere from −4 to 4', cy, 'gold'));
    s.alpha(s.win('many', 'flat'), () => caption(s, '100 terms: often 10 or more from 0', cy, 'gold'));
    s.alpha(flat, () => caption(s, 'far from 0 the tanh is flat: saturated', cy, 'red', 3.4));
  },
};

// ---- spread: one value of -2 or 2, its mean, deviations, variance and std

const spread: SceneDef = {
  draw(s) {
    const u = s.u;
    const ty = s.h * 0.13;
    const xs = columns(s, 2, 16);
    rowLabel(s, 'value', xs[0]! - 10 * u, ty, 'blue', 3.6);
    cells(s, xs, ty, ['−2', '2'], 'blue', { w: 12, h: 8.5, on: [s.win('dev', 'var'), s.win('dev', 'var')] });
    const iy = ty + 11 * u;
    const info = { size: 3.4, font: 'mono', weight: 600, halo: true } as const;
    s.alpha(s.win('mean', 'dev'), () => s.text('equally often: mean 0', s.w / 2, iy, { ...info, color: s.c('--ink-2') }));
    s.alpha(s.win('dev', 'var'), () => s.text('deviations: −2 and 2', s.w / 2, iy, { ...info, color: s.c('blue') }));
    s.alpha(s.win('var', 'std'), () => s.text('squared: 4 and 4, average 4', s.w / 2, iy, { ...info, color: s.c('red') }));
    s.alpha(s.ease('std', 0.6), () => s.text('variance 4,  std = √4 = 2', s.w / 2, iy, { ...info, color: s.c('gold') }));
    const ly = s.h * 0.64;
    const step = (s.tall ? 12 : 13) * u;
    const X = (v: number) => s.w / 2 + v * step;
    s.alpha(s.ease('mean', 0.6, 0.3), () => {
      s.line(X(-3.2), ly, X(3.2), ly, s.c('--axis'), 0.4);
      for (let v = -3; v <= 3; v++) {
        s.line(X(v), ly - 0.8 * u, X(v), ly + 0.8 * u, s.c('--axis'), 0.3);
        s.text(fmt(v), X(v), ly + 4 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
      }
    });
    // Each deviation as an arrow from the mean, then its square drawn on the line.
    s.alpha(s.win('dev', 'var'), () => {
      for (const v of [-2, 2]) {
        s.arrow(X(0), ly - 5 * u, X(v), ly - 5 * u, s.c('blue'), 0.4, 1.5);
        s.text(fmt(v), (X(0) + X(v)) / 2, ly - 9 * u, { size: 3.3, font: 'mono', weight: 600, color: s.c('blue'), halo: true });
      }
    });
    const sq = s.ease('var', 0.6, 0.6) * (1 - 0.6 * s.ease('std', 0.6));
    s.alpha(sq, () => {
      for (const v of [-2, 2]) {
        const x0 = Math.min(X(0), X(v));
        s.rrect(x0, ly - 2 * step, 2 * step, 2 * step, 0.4, { fill: s.tint('red', 0.18), stroke: s.tint('red', 0.6), lw: 0.3 });
        s.text('2² = 4', (X(0) + X(v)) / 2, ly - step, { size: 3.2, font: 'mono', weight: 600, color: s.c('red'), halo: true });
      }
    });
    s.alpha(s.ease('mean', 0.6, 1), () => {
      for (const v of [-2, 2]) s.circle(X(v), ly, 1.6 * u, { fill: s.c('blue'), stroke: s.c('--card'), lw: 0.4 });
      s.circle(X(0), ly, 1.1 * u, { fill: s.c('--ink-2'), stroke: s.c('--card'), lw: 0.3 });
    });
    s.alpha(s.ease('mean', 0.6, 2) * (1 - s.ease('dev', 0.5)), () => s.text('mean', X(0), ly - 4 * u, { size: 3.2, font: 'mono', color: s.c('--ink-2'), halo: true }));
    s.alpha(after(s, 'std', 0.3), () => {
      const y = ly + 9 * u;
      s.arrow(X(0), y, X(2), y, s.c('gold'), 0.4, 1.5);
      s.arrow(X(0), y, X(-2), y, s.c('gold'), 0.4, 1.5);
      s.text('std 2: a typical deviation', s.w / 2, y + 5 * u, { size: 3.4, font: 'mono', weight: 600, color: s.c('gold'), halo: true });
    });
    cite(s, 'Pearson, 1894', s.ease('name', 0.6));
    s.alpha(s.ease('name', 0.6), () => caption(s, 'std: the standard deviation', s.h * 0.93, '--ink-2', 3.4));
  },
};

// ---- adds: two independent values, their sum, the squares that add, then a product

/** Two equally likely values each for a row and a column, and what every pair gives. */
interface Table {
  rows: [string, number[]];
  cols: [string, number[]];
  cell: (r: number, c: number) => string;
}
const SUMS: Table = { rows: ['t1', [-1, 1]], cols: ['t2', [-1, 1]], cell: (r, c) => fmt(r + c) };
const SQUARES: Table = { ...SUMS, cell: (r, c) => fmt((r + c) ** 2) };
const PRODS: Table = { rows: ['weight', [-2, 2]], cols: ['input', [-1, 1]], cell: (r, c) => fmt(r * c) };

/** A 2 by 2 table of outcomes centered on (cx, cy), its row and column values outside; `fill` fades the cells in. */
function outcomes(s: Scene, cx: number, cy: number, t: Table, k: Ink, fill = 1, on = 0): void {
  const u = s.u;
  const xs = [cx - 8 * u, cx + 8 * u];
  const ys = [cy - 5.5 * u, cy + 5.5 * u];
  const head = { size: 3.2, font: 'mono', color: s.c('--ink-2') } as const;
  t.cols[1].forEach((v, j) => s.text(fmt(v), xs[j]!, ys[0]! - 9.5 * u, { ...head, weight: 600 }));
  s.text(t.cols[0], cx, ys[0]! - 15.5 * u, head);
  t.rows[1].forEach((v, i) => s.text(fmt(v), xs[0]! - 13 * u, ys[i]!, { ...head, weight: 600 }));
  s.text(t.rows[0], xs[0]! - 19 * u, cy, { ...head, align: 'right' });
  s.alpha(1 - fill, () => ys.forEach((y) => cells(s, xs, y, ['', ''], '--ink-3', { w: 13, h: 9 })));
  s.alpha(fill, () => ys.forEach((y, i) => cells(s, xs, y, xs.map((_, j) => t.cell(t.rows[1][i]!, t.cols[1][j]!)), k, { w: 13, h: 9, on: [on, on] })));
}

/** A square whose side is a standard deviation and whose area is the variance. */
function square(s: Scene, x: number, base: number, side: number, k: Ink, area: string, edge: string) {
  const u = s.u;
  s.rrect(x, base - side, side, side, 0.4, { fill: s.tint(k, 0.16), stroke: s.tint(k, 0.75), lw: 0.35 });
  s.text(area, x + side / 2, base - side / 2, { size: 3.2, font: 'mono', weight: 600, color: s.c(k), halo: true });
  s.text(edge, x + side / 2, base + 3.5 * u, { size: 3.1, font: 'mono', color: s.c(k) });
}

const adds: SceneDef = {
  draw(s) {
    const u = s.u;
    const cy = s.h * 0.5;
    const cx = s.w / 2 + 7 * u;
    const area = s.win('std', 'prod');
    const pr = s.ease('prod', 0.6);
    const sq = s.ease('adds', 0.6) * (1 - area);
    s.alpha(s.ease('pair', 0.6) * (1 - s.ease('adds', 0.6)), () => outcomes(s, cx, cy, SUMS, 'gold', s.ease('indep', 0.6, 1.2)));
    s.alpha(sq * (1 - pr), () => outcomes(s, cx, cy, SQUARES, 'red'));
    s.alpha(pr, () => outcomes(s, cx, cy, PRODS, 'gold', s.ease('prod', 0.6, 2.5), 0.3));
    // Sides are standard deviations, areas are variances: 1 + 1 = 2, so the new side is √2.
    s.alpha(area, () => {
      const S = (s.tall ? 16 : 18) * u;
      const S2 = S * Math.SQRT2;
      const gap = 7 * u;
      const total = S + gap + S + gap + S2;
      const x0 = s.w / 2 - total / 2;
      const base = s.h * 0.6;
      square(s, x0, base, S, 'teal', 'var 1', 'std 1');
      s.text('+', x0 + S + gap / 2, base - S / 2, { size: 4, font: 'mono', color: s.c('--ink-2') });
      square(s, x0 + S + gap, base, S, 'blue', 'var 1', 'std 1');
      s.text('=', x0 + 2 * S + 1.5 * gap, base - S / 2, { size: 4, font: 'mono', color: s.c('--ink-2') });
      s.alpha(after(s, 'std', 0.45), () => square(s, x0 + 2 * S + 2 * gap, base, S2, 'gold', 'var 2', 'std √2 ≈ 1.41'));
    });
    const cyc = s.h * 0.88;
    s.alpha(s.win('pair', 'indep'), () => caption(s, 'each: −1 or 1, variance 1', cyc));
    s.alpha(s.win('indep', 'adds'), () => caption(s, 'independent: sums −2, 0, 0, 2', cyc, 'gold', 3.4));
    s.alpha(s.win('adds', 'std'), () => caption(s, '(4 + 0 + 0 + 4) / 4 = 2 = 1 + 1', cyc, 'red', 3.4));
    s.alpha(s.win('std', 'fisher'), () => caption(s, 'areas add; sides do not: √2, not 2', cyc, 'gold', 3.4));
    s.alpha(s.win('fisher', 'prod'), () => caption(s, 'variance: the std squared, the part that adds', cyc, '--ink-2', s.tall ? 3 : 3.4));
    cite(s, 'Fisher, 1918', s.win('fisher', 'prod'));
    s.alpha(s.win('prod', 'mult'), () => caption(s, 'every product: −2 or 2', cyc, 'gold', 3.4));
    s.alpha(s.ease('mult', 0.6), () => caption(s, 'variance 4 = 4 × 1: variances multiply', cyc, 'gold', 3.4));
  },
};

// ---- grow: Var(z) = n v, the square root of n, then a unit's numbers

const bell = (sd: number) => (z: number) => 0.9 * Math.exp(-(z * z) / (2 * sd * sd));

/** Arrows from 0 out to one standard deviation either side, at height y, with a label below. */
function stdArrows(s: Scene, F: Frame, sd: number, y: number, k: Ink, label: string) {
  s.arrow(F.X(0), F.Y(y), F.X(sd), F.Y(y), s.c(k), 0.4, 1.5);
  s.arrow(F.X(0), F.Y(y), F.X(-sd), F.Y(y), s.c(k), 0.4, 1.5);
  s.text(label, F.X(sd) + 1.5 * s.u, F.Y(y), { size: 3.3, font: 'mono', weight: 650, align: 'left', color: s.c(k), halo: true });
}

const grow: SceneDef = {
  marks: {
    v: { tex: String.raw`\mathrm{Var}(z) = n\,\sym{v}{v}`, x: 0.5, y: 0.09, size: 5.4 },
  },
  draw(s) {
    const u = s.u;
    const plot = 1 - s.ease('unit', 0.6);
    s.show('v', s.ease('var', 0.6) * plot);
    s.alpha(plot, () => {
      const F = zFrame(s, s.h * 0.2, s.h * 0.8);
      zAxis(s, F);
      const root = s.ease('root', 0.6);
      s.alpha(1 - 0.55 * root, () => sumBars(s, F, 2));
      s.alpha(root, () => F.fn(bell(10), 'gold', 0.6));
      s.alpha(root, () => F.fn(bell(5), 'orange', 0.7));
      s.alpha(s.ease('ten', 0.6, 0.4), () => stdArrows(s, F, 10, 0.55, 'gold', 'std 10'));
      s.alpha(after(s, 'root', 0.2), () => stdArrows(s, F, 5, 0.75, 'orange', 'std 5'));
      s.alpha(s.win('n', 'var'), () => s.text('100 terms of −1 or 1', F.X(0), F.Y(1.02) - 2 * u, { size: 3.3, font: 'mono', weight: 600, color: s.c('gold'), halo: true }));
      const cy = s.h * 0.91;
      s.alpha(s.win('n', 'v'), () => caption(s, 'z: a sum of n terms', cy));
      s.alpha(s.win('v', 'var'), () => rich(s, [['each term: variance ', '--ink-2'], ['v', 'orange']], s.w / 2, cy, { size: 3.6 }));
      s.alpha(s.win('var', 'big'), () => caption(s, 'n variances add', cy));
      s.alpha(s.win('big', 'ten'), () => caption(s, 'n = 100, v = 1: 100 × 1 = 100', cy, 'gold', 3.6));
      s.alpha(s.win('ten', 'root'), () => caption(s, 'std = √100 = 10', cy, 'gold', 3.8));
      s.alpha(root, () => caption(s, '25 terms: std 5.  100 terms: std 10', cy, '--ink-2', s.tall ? 3.2 : 3.6));
    });
    // A unit's numbers, one line per beat.
    const q = { size: s.tall ? 3.6 : 3.8, font: 'mono', color: s.c('--ink') } as const;
    const line = { size: s.tall ? 3.8 : 4.2, font: 'mono', weight: 600, halo: true } as const;
    s.alpha(s.ease('unit', 0.6, 0.3), () => {
      s.text('z = w · x over n = 400 inputs', s.w / 2, s.h * 0.12, q);
      s.text('inputs: variance 1', s.w / 2, s.h * 0.12 + 6.5 * u, q);
      s.text('weights: std 0.1', s.w / 2, s.h * 0.12 + 13 * u, q);
    });
    const ly = s.h * 0.46;
    s.alpha(after(s, 'term', 0.1), () => s.text('weight variance: 0.1² = 0.01', s.w / 2, ly, { ...line, color: s.c('blue') }));
    s.alpha(after(s, 'term', 0.6), () => rich(s, [['each term: ', '--ink-2'], ['v', 'orange'], [' = 0.01 × 1 = 0.01', '--ink-2']], s.w / 2, ly + 8 * u, line));
    s.alpha(after(s, 'sum', 0.1), () => s.text('Var(z) = 400 × 0.01 = 4', s.w / 2, ly + 19 * u, { ...line, color: s.c('--ink-2') }));
    s.alpha(after(s, 'sd', 0.1), () => s.text('std of z = √4 = 2', s.w / 2, ly + 27 * u, { ...line, size: s.tall ? 4.2 : 4.6, weight: 650, color: s.c('gold') }));
  },
};

export const scenes: Record<string, SceneDef> = { swing, spread, adds, grow };

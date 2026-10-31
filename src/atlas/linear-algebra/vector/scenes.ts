import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { after, cells, cite, columns, rowLabel, stacked } from '../../draw';
import { caption, Frame } from '../../networks/draw';
import { brace, ghost, rich } from '../draw';

/** A plot of the window `xr` by `yr`, scaled to fit, and where its captions go. */
function plot(s: Scene, xr: [number, number], yr: [number, number], frac: number) {
  const u = s.u;
  const ratio = (xr[1] - xr[0]) / (yr[1] - yr[0]);
  const st = stacked(s);
  const hh = st ? Math.min(s.h * frac, (s.w - 16 * u) / ratio) : Math.min(s.h * 0.86, (s.w * 0.55) / ratio);
  const ww = hh * ratio;
  const l = st ? s.w / 2 - ww / 2 : s.w * 0.04;
  const t = st ? 4 * u : (s.h - hh) / 2;
  const F = new Frame(s, l, t, l + ww, t + hh, xr, yr);
  const cx = st ? s.w / 2 : (F.r + s.w) / 2;
  const y0 = st ? F.b + 8 * u : s.h * 0.4;
  return { F, cx, y: (i: number) => y0 + i * 7.5 * u };
}

/** Light tick labels at whole numbers along both axes. */
function ticks(s: Scene, F: Frame, xs: number[], ys: number[]) {
  const o = { size: 2.6, font: 'mono', color: s.c('--ink-3'), halo: true } as const;
  for (const x of xs) s.text(String(x).replace('-', '−'), F.X(x), F.Y(0) + 3 * s.u, o);
  for (const y of ys) s.text(String(y).replace('-', '−'), F.X(0) - 2.4 * s.u, F.Y(y), { ...o, align: 'right' });
}

/** An arrow in data coordinates. */
const arrow = (s: Scene, F: Frame, x0: number, y0: number, x1: number, y1: number, k: Ink, width = 0.7) => s.arrow(F.X(x0), F.Y(y0), F.X(x1), F.Y(y1), s.c(k), width, 2.8);

// ---- a picture as numbers: a 4 by 4 color image laid out as one row of 48

/** A tiny 4 by 4 image: a vertical gradient from blue sky to warm ground. */
const PIX = Array.from({ length: 16 }, (_, k) => {
  const i = Math.floor(k / 4);
  const j = k % 4;
  return [40 + 60 * i + 6 * j, 110 + 25 * j - 10 * i, 230 - 60 * i];
});
const RGB = ['red', 'green', 'blue'] as const;
const rgb = (p: number[]) => `rgb(${p[0]}, ${p[1]}, ${p[2]})`;

const image: SceneDef = {
  draw(s) {
    const u = s.u;
    const P = 9 * u;
    const gl = s.w / 2 - 2 * P;
    const gt = s.h * 0.05;
    // The flattened strip: 48 bars, three per pixel.
    const bw = Math.min(2 * u, (s.w - 16 * u) / 48);
    const sl = s.w / 2 - 24 * bw;
    const base = s.h * 0.68;
    const bh = 16 * u;
    const g = s.ease('flat', 1.6);
    const bars = s.ease('flat', 0.6, 1.3);
    // The image stays behind, faint, as the numbers leave it.
    s.alpha(0.22 * g, () => PIX.forEach((p, k) => s.rrect(gl + (k % 4) * P + 0.15 * u, gt + Math.floor(k / 4) * P + 0.15 * u, P - 0.3 * u, P - 0.3 * u, 0.4, { fill: rgb(p) })));
    PIX.forEach((p, k) => {
      const i = Math.floor(k / 4);
      const j = k % 4;
      const gk = Math.min(1, Math.max(0, g * 1.4 - (k / 15) * 0.4));
      const x = lerp(gl + j * P, sl + k * 3 * bw, gk);
      const w = lerp(P, 3 * bw, gk);
      const h = lerp(P, bh * 0.6, gk);
      const y = lerp(gt + i * P, base - h, gk);
      s.alpha(1 - bars, () => s.rrect(x + 0.15 * u, y + 0.15 * u, w - 0.3 * u, h - 0.3 * u, 0.4, { fill: rgb(p) }));
    });
    s.alpha(bars, () => {
      s.line(sl - 2 * u, base, sl + 48 * bw + 2 * u, base, s.c('--axis'), 0.3);
      PIX.forEach((p, k) => p.forEach((v, c) => {
        const hh = (v / 255) * bh;
        s.rrect(sl + (3 * k + c) * bw + 0.1 * u, base - hh, bw - 0.2 * u, hh, 0.2, { fill: s.tint(RGB[c]!, 0.75) });
      }));
    });
    // The top-left pixel, opened up into its three numbers.
    s.alpha(s.win('rgb', 'flat', 0.5), () => {
      const p = PIX[0]!;
      s.rrect(gl, gt, P, P, 0.4, { stroke: s.c('--ink'), lw: 0.5 });
      const cx = gl - 18 * u;
      s.arrow(gl - 0.8 * u, gt + 0.5 * P, cx + 7 * u, gt + 1.4 * P, s.c('--ink-3'), 0.3, 2);
      p.forEach((v, c) => s.cell(cx - 6.5 * u, gt + (c + 0.6) * P - 3.6 * u, 13 * u, 7.2 * u, String(v), RGB[c]!, { on: 0.5, size: 3.4 }));
    });
    // The vector, named, and its first entry.
    s.alpha(s.ease('vector', 0.6), () => {
      s.text('x: one vector, 48 numbers', sl, base - bh - 4 * u, { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c('orange') });
      s.arrow(sl + 6 * u, base + 5.5 * u, sl + 0.5 * bw, base + 1 * u, s.c('red'), 0.3, 1.8);
      s.text('first: the top-left red', sl + 7 * u, base + 6 * u, { size: 3.1, font: 'mono', align: 'left', color: s.c('--ink-2') });
    });
    const cy = s.h * 0.83;
    s.alpha(s.win('numbers', 'rgb'), () => caption(s, 'to a program: only numbers', cy));
    s.alpha(s.win('rgb', 'flat'), () => caption(s, '(4, 4, 3): rows, columns, colors', cy));
    s.alpha(s.ease('flat', 0.6, 1.6), () => caption(s, '4 × 4 × 3 = 48 numbers', cy, '--ink-2', 3.8));
    s.alpha(s.ease('big', 0.6), () => caption(s, '32 × 32 × 3 = 3,072 numbers', s.h * 0.92, 'orange', 3.8, { weight: 600 }));
  },
};

// ---- two numbers as a point, then an arrow; one direction per number

/** One step out of the page, drawn slanting down to the left. */
const Z: [number, number] = [-0.6, -0.9];
const P3: [number, number] = [3 + Z[0], 2 + Z[1]];

const arrowScene: SceneDef = {
  draw(s) {
    const { F, cx, y } = plot(s, [-1.7, 4.4], [-1.6, 3.3], 0.7);
    const u = s.u;
    F.axes();
    ticks(s, F, [1, 2, 3, 4], [1, 2, 3]);
    const three = s.ease('three', 0.8);
    const dim = s.ease('dim', 0.6);
    const lab = { size: 3.2, font: 'mono', weight: 600, halo: true } as const;
    // Three across, then two up: in ink, then colored as the two directions.
    const g1 = after(s, 'point', 0.3, 0.8);
    const g2 = after(s, 'point', 0.5, 0.8);
    const kx: Ink = dim > 0.5 ? 'teal' : '--ink-3';
    const ky: Ink = dim > 0.5 ? 'gold' : '--ink-3';
    s.alpha(1 - three, () => {
      if (g1 > 0) F.seg(0, 0, 3 * g1, 0, kx, 0.5 + 0.3 * dim, dim > 0.5 ? undefined : [1, 0.8]);
      if (g2 > 0) F.seg(3, 0, 3, 2 * g2, ky, 0.5 + 0.3 * dim, dim > 0.5 ? undefined : [1, 0.8]);
      s.alpha(g1, () => s.text(dim > 0.5 ? '1st: across' : '3 across', F.X(1.5), F.Y(0) - 3.4 * u, { ...lab, color: s.c(kx === '--ink-3' ? '--ink-2' : kx) }));
      s.alpha(g2, () => s.text(dim > 0.5 ? '2nd: up' : '2 up', F.X(3) + 2 * u, F.Y(1), { ...lab, align: 'left', color: s.c(ky === '--ink-3' ? '--ink-2' : ky) }));
    });
    // The point, then the arrow out to it.
    const ar = s.ease('arrow', 0.9, 0.4);
    s.alpha(after(s, 'point', 0.7) * (1 - three), () => {
      if (ar < 1) F.dot(3, 2, 'orange', 1.4);
      s.text('[3, 2]', F.X(3) + 2 * u, F.Y(2) - 3.4 * u, { ...lab, align: 'left', color: s.c('orange') });
    });
    s.alpha((1 - three) * (ar > 0 ? 1 : 0), () => arrow(s, F, 0, 0, 3 * ar, 2 * ar, 'orange', 0.8));
    s.alpha(s.ease('arrow', 0.6) * (1 - s.ease('dim', 0.6)), () => {
      F.dot(0, 0, '--ink-2', 1);
      s.text('origin', F.X(0) - 2 * u, F.Y(0) + 4 * u, { ...lab, align: 'right', color: s.c('--ink-2') });
    });
    // A third number: a third direction, out of the page; the walk is across, out, then up.
    s.alpha(three, () => {
      F.seg(0, 0, Z[0] * 1.6, Z[1] * 1.6, 'purple', 0.5, [1, 0.8]);
      s.text('3rd: toward you', F.X(Z[0] * 1.6) + 2 * u, F.Y(Z[1] * 1.6) + 1.5 * u, { ...lab, align: 'left', color: s.c('purple') });
      const w1 = after(s, 'three', 0.2, 0.6);
      const w2 = after(s, 'three', 0.35, 0.6);
      const w3 = after(s, 'three', 0.5, 0.6);
      if (w1 > 0) F.seg(0, 0, 3 * w1, 0, 'teal', 0.7);
      if (w2 > 0) F.seg(3, 0, 3 + Z[0] * w2, Z[1] * w2, 'purple', 0.7);
      // The floor the walk crosses, for depth.
      s.alpha(0.6 * w2, () => F.seg(Z[0], Z[1], P3[0], Z[1], '--ink-3', 0.3, [0.8, 0.8]));
      if (w3 > 0) F.seg(P3[0], Z[1], P3[0], Z[1] + 2 * w3, 'gold', 0.7);
      s.alpha(after(s, 'three', 0.65), () => {
        arrow(s, F, 0, 0, P3[0], P3[1], 'orange', 0.8);
        s.text('[3, 2, 1]', F.X(P3[0]) + 2 * u, F.Y(P3[1]) - 3 * u, { ...lab, align: 'left', color: s.c('orange') });
      });
    });
    cite(s, 'William Rowan Hamilton, 1846', s.win('name', 'dim'));
    const cap = { size: 3.6, font: 'mono', color: s.c('--ink-2'), halo: true } as const;
    s.alpha(s.win('point', 'arrow'), () => s.text('x = [3, 2]: a point', cx, y(0), cap));
    s.alpha(s.win('arrow', 'name'), () => s.text('an arrow from the origin', cx, y(0), cap));
    s.alpha(s.win('name', 'dim'), () => s.text('vector: Latin for carrier', cx, y(0), { ...cap, color: s.c('orange') }));
    s.alpha(s.win('dim', 'three'), () => s.text('2 numbers: 2 dimensions', cx, y(0), cap));
    s.alpha(s.win('three', 'more'), () => s.text('3 numbers: 3 dimensions', cx, y(0), cap));
    s.alpha(s.ease('more', 0.6), () => {
      s.text('48 numbers: 48 dimensions', cx, y(0), { ...cap, color: s.c('orange') });
      s.text('one direction per number', cx, y(1), cap);
    });
  },
};

// ---- a list: its count, its shape, ℝ⁴, and indexes from zero

const X = [3, -1, 4, 2];

const list: SceneDef = {
  marks: {
    R: { tex: String.raw`\mathbb{R}`, x: 0.5, y: 0.43, size: 6.4 },
    r4: { tex: String.raw`\symx \in \mathbb{R}^{4}`, x: 0.5, y: 0.47, size: 5.6 },
  },
  draw(s) {
    const u = s.u;
    const xs = columns(s, 4, 16);
    const y = s.h * 0.17;
    rowLabel(s, 'x', xs[0]! - 11 * u, y, 'orange');
    cells(s, xs, y, X.map((v) => String(v).replace('-', '−')), 'orange', { on: [s.win('index', 'last'), 0, 0, s.ease('last', 0.6)] });
    s.alpha(s.ease('index', 0.6), () => xs.forEach((x, i) => s.text(`[${i}]`, x, y + 8.5 * u, { size: 3.2, font: 'mono', color: s.c('--ink-3') })));
    s.alpha(s.ease('len', 0.6), () => brace(s, 'bottom', xs[0]! - 7 * u, xs[3]! + 7 * u, y + 13 * u, '4 numbers: 4-dimensional', 'orange'));
    // len and shape, then the real numbers on their line, then x ∈ ℝ⁴.
    s.alpha(s.win('len', 'reals'), () => {
      rich(s, [['len(x) = ', '--ink-2'], ['4', 'orange']], s.w / 2, s.h * 0.43, { size: 3.6 });
      s.alpha(after(s, 'len', 0.55), () => rich(s, [['x.shape = ', '--ink-2'], ['(4,)', 'orange'], [': one row of 4', '--ink-2']], s.w / 2, s.h * 0.51, { size: 3.6 }));
    });
    const reals = s.win('reals', 'in');
    s.show('R', reals);
    s.alpha(reals, () => {
      const half = Math.min(42 * u, s.w / 2 - 8 * u);
      const X0 = s.w / 2 - half;
      const at = (v: number) => X0 + ((v + 2.5) / 7) * 2 * half;
      const ly = s.h * 0.55;
      s.line(X0, ly, X0 + 2 * half, ly, s.c('--ink-3'), 0.35);
      for (let v = -2; v <= 4; v++) {
        s.line(at(v), ly - 1 * u, at(v), ly + 1 * u, s.c('--ink-3'), 0.3);
        s.text(String(v).replace('-', '−'), at(v), ly + 3.6 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
      }
      [-1.5, 0.5, Math.PI].forEach((v, i) => s.alpha(after(s, 'reals', 0.25 + 0.12 * i), () => {
        s.circle(at(v), ly, 1.1 * u, { fill: s.c('orange') });
        s.text(['−1.5', '0.5', '3.14…'][i]!, at(v), ly - 3.6 * u, { size: 3, font: 'mono', weight: 600, color: s.c('orange'), halo: true });
      }));
    });
    s.show('r4', s.ease('in', 0.6));
    s.alpha(s.ease('in', 0.6, 0.6), () => caption(s, 'x: a list of 4 real numbers', s.h * 0.56));
    s.alpha(s.ease('index', 0.6, 0.4), () => caption(s, 'x[0] = 3, the first', s.h * 0.7, '--ink-2', 3.8));
    s.alpha(s.ease('last', 0.6), () => {
      caption(s, 'x[3] = 2, the last', s.h * 0.79, '--ink-2', 3.8);
      const gx = xs[3]! + 16 * u;
      ghost(s, gx, y, '?', 'red');
      s.text('[4] ✗', gx, y + 8.5 * u, { size: 3.2, font: 'mono', color: s.c('red') });
    });
    s.alpha(after(s, 'last', 0.6), () => caption(s, 'indexes 0 to 3: 4 entries', s.h * 0.88, 'orange', 3.6));
  },
};

// ---- adding is one arrow after another; scaling stretches an arrow

const U: [number, number] = [1, 2];
const V: [number, number] = [3, -1];
const KU: Color = 'teal';
const KV: Color = 'orange';
const KS: Color = 'purple';

const ops: SceneDef = {
  draw(s) {
    const { F, cx, y } = plot(s, [-1.6, 4.6], [-2.5, 4.5], 0.62);
    const u = s.u;
    const bad = s.ease('same', 0.6);
    s.alpha(1 - 0.75 * bad, () => {
      F.axes();
      ticks(s, F, [-1, 1, 2, 3, 4], [-2, -1, 1, 2, 3, 4]);
      const lab = { size: 3.4, font: 'mono', weight: 650, halo: true } as const;
      const sc = s.ease('scale', 0.6);
      const back = 1 - 0.8 * sc;
      // u and v, then their sum, then v moved to start at u's tip.
      s.alpha(s.ease('two', 0.6), () => {
        arrow(s, F, 0, 0, U[0], U[1], KU, 0.8);
        s.text('u', F.X(0.2), F.Y(1.3), { ...lab, align: 'right', color: s.c(KU) });
      });
      s.alpha(s.ease('two', 0.6, 0.8) * back, () => {
        arrow(s, F, 0, 0, V[0], V[1], KV, 0.8);
        s.text('v', F.X(1.7), F.Y(-0.95), { ...lab, color: s.c(KV) });
      });
      const sum = s.ease('add', 0.8, 0.8);
      s.alpha(sum * back, () => {
        arrow(s, F, 0, 0, (U[0] + V[0]) * sum, (U[1] + V[1]) * sum, KS, 0.9);
        s.text('u + v', F.X(3.2), F.Y(0.3), { ...lab, align: 'left', color: s.c(KS) });
      });
      const m = s.ease('tail', 1.4, 0.3);
      s.alpha(Math.min(1, m * 4) * back, () => {
        arrow(s, F, U[0] * m, U[1] * m, U[0] * m + V[0], U[1] * m + V[1], KV, 0.6);
        s.alpha(m, () => s.text('v', F.X(2.7), F.Y(2), { ...lab, color: s.c(KV) }));
      });
      // Scaled: twice as long, then turned around.
      s.alpha(sc, () => {
        const k = 1 + sc;
        arrow(s, F, 0, 0, U[0] * k, U[1] * k, KU, 0.9);
        s.text('2u', F.X(2) + 2 * u, F.Y(4), { ...lab, align: 'left', color: s.c(KU) });
      });
      const ng = s.ease('neg', 0.8);
      s.alpha(ng, () => {
        arrow(s, F, 0, 0, -U[0] * ng, -U[1] * ng, KU, 0.7);
        s.text('−u', F.X(-1) - 1.5 * u, F.Y(-1.4), { ...lab, align: 'right', color: s.c(KU) });
      });
    });
    // The arithmetic, entry by entry.
    const size = 3.5;
    s.alpha(s.ease('two', 0.6), () => rich(s, [['u = ', KU], ['[1, 2]', '--ink']], cx, y(0), { size }));
    s.alpha(s.ease('two', 0.6, 0.8) * (1 - s.ease('scale', 0.6)), () => rich(s, [['v = ', KV], ['[3, −1]', '--ink']], cx, y(1), { size }));
    s.alpha(s.win('add', 'scale') * after(s, 'add', 0.35), () => rich(s, [['u + v = [1 + 3, 2 + (−1)] = ', '--ink-2'], ['[4, 1]', KS]], cx, y(2), { size }));
    s.alpha(s.win('scale', 'same'), () => rich(s, [['2u = [2 × 1, 2 × 2] = ', '--ink-2'], ['[2, 4]', KU]], cx, y(1), { size }));
    s.alpha(s.win('neg', 'same'), () => rich(s, [['−1 × u = ', '--ink-2'], ['[−1, −2]', KU], [': turned around', '--ink-2']], cx, y(2), { size }));
    s.alpha(bad, () => {
      rich(s, [['v3 = ', KV], ['[3, −1, 2]', '--ink']], cx, y(1), { size });
      rich(s, [['✗ ', 'red'], ['2 entries + 3 entries', '--ink-2']], cx, y(2), { size });
    });
  },
};

export const scenes: Record<string, SceneDef> = { image, arrow: arrowScene, list, ops };

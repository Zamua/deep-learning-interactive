import { fmt } from '../../core/code';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { blit, cifarPca, colorImage, eigenImage, kept, original, rebuilt } from './cifar';
import { CLOUD, rotated, whitened } from './data';
import { type K, type Rect, Frame, area, badge, covEllipse, meanCross, mix, network, pill, split, stats } from './draw';

// ---------------------------------------------------------------- intro

const TOPICS: [string, string, string, K][] = [
  ['data', 'the data', 'X -= mu', 'orange'],
  ['init', 'the starting weights', 'W = randn(n, H) * ...', 'blue'],
  ['bn', 'the scale inside', 'batchnorm(h, gamma, beta)', 'purple'],
  ['reg', 'not memorizing', 'L2 penalty, dropout', 'gold'],
  ['loss', 'the loss', 'softmax, sigmoid, L2', 'red'],
];

/** A tiny picture for each topic row, drawn in a size x size box. */
function glyph(s: Scene, i: number, x: number, y: number, size: number, k: K): void {
  const u = s.u;
  s.rrect(x, y, size, size, 1.4, { fill: s.tint(k, 0.06), stroke: s.tint(k, 0.35), lw: 0.25 });
  const cx = x + size / 2;
  const cy = y + size / 2;
  const r = size * 0.36;
  if (i === 0) {
    const pts = [[-0.6, -0.3], [-0.3, -0.1], [0.1, 0.05], [0.4, 0.3], [0.55, 0.15], [-0.1, -0.25], [0.2, 0.35], [-0.45, 0.05]];
    for (const [a, b] of pts) s.circle(cx + a! * r, cy - b! * r, Math.max(1.2, size * 0.045), { fill: s.tint('orange', 0.8) });
    s.line(cx - u, cy - u, cx + u, cy + u, s.c('teal'), 0.4);
    s.line(cx + u, cy - u, cx - u, cy + u, s.c('teal'), 0.4);
  } else if (i === 1) {
    s.ctx.beginPath();
    for (let j = 0; j <= 40; j++) {
      const t = -2.6 + (5.2 * j) / 40;
      const px = cx + (t / 2.6) * r;
      const py = cy + r * 0.6 - Math.exp(-t * t / 2) * r * 1.2;
      if (j) s.ctx.lineTo(px, py);
      else s.ctx.moveTo(px, py);
    }
    s.ctx.strokeStyle = s.c('blue');
    s.ctx.lineWidth = 0.45 * u;
    s.ctx.stroke();
  } else if (i === 2) {
    for (let j = 0; j < 5; j++) {
      const bh = r * (0.95 + 0.08 * Math.sin(j * 2.1));
      s.rrect(cx - r + j * r * 0.42, cy + r * 0.6 - bh, r * 0.3, bh, 0.3, { fill: s.tint('purple', 0.55) });
    }
  } else if (i === 3) {
    const xs = [cx - r * 0.7, cx, cx + r * 0.7];
    const ys = [[-0.5, 0.5], [-0.7, 0, 0.7], [0]];
    ys.forEach((col, l) => col.forEach((v) => {
      if (l < 2) (l === 0 ? ys[1]! : ys[2]!).forEach((w) => s.line(xs[l]!, cy + v * r, xs[l + 1]!, cy + w * r, s.tint('--ink-3', 0.5), 0.2));
    }));
    ys.forEach((col, l) => col.forEach((v, j) => {
      const off = l === 1 && j === 1;
      s.circle(xs[l]!, cy + v * r, size * 0.07, { fill: off ? s.c('--card') : s.tint('gold', 0.8), stroke: s.c('--ink-3'), lw: 0.2 });
      if (off) {
        const d = size * 0.05;
        s.line(xs[l]! - d, cy + v * r - d, xs[l]! + d, cy + v * r + d, s.c('--ink-3'), 0.25);
      }
    }));
  } else {
    s.ctx.beginPath();
    for (let j = 0; j <= 30; j++) {
      const t = j / 30;
      const px = cx - r + 2 * r * t;
      const py = cy - r * 0.7 + r * 1.4 * (1 - Math.exp(-4 * t)) + Math.sin(t * 40) * r * 0.04 * (1 - t);
      if (j) s.ctx.lineTo(px, py);
      else s.ctx.moveTo(px, py);
    }
    s.ctx.strokeStyle = s.c('red');
    s.ctx.lineWidth = 0.45 * u;
    s.ctx.stroke();
  }
}

/** The five decisions as stacked rows; `appear` and `lit` are per row. */
export function topicRows(s: Scene, rect: Rect, appear: (i: number) => number, lit: (i: number) => number, check = 0): void {
  const [x, y, w, h] = rect;
  const n = TOPICS.length;
  const gap = s.u * 1.6;
  const rh = Math.min((h - gap * (n - 1)) / n, s.u * 17);
  const rw = Math.min(w, rh * 7.5);
  const x0 = x + (w - rw) / 2;
  const y0 = y + (h - (rh * n + gap * (n - 1))) / 2;
  TOPICS.forEach(([, title, sub, k], i) => {
    const a = appear(i);
    if (a <= 0) return;
    const on = lit(i);
    const ry = y0 + i * (rh + gap) + (1 - a) * s.u * 2;
    s.alpha(a, () => {
      s.rrect(x0, ry, rw, rh, 2, { fill: s.tint(k, 0.05 + 0.13 * on), stroke: s.tint(k, 0.3 + 0.6 * on), lw: 0.3 + 0.3 * on });
      const g = rh * 0.74;
      s.text(String(i + 1), x0 + rh * 0.42, ry + rh / 2, { size: Math.min(5.2, (rh / s.u) * 0.34), font: 'display', weight: 650, color: s.c(k) });
      glyph(s, i, x0 + rh * 0.82, ry + (rh - g) / 2, g, k);
      const tx = x0 + rh * 0.82 + g + s.u * 3;
      const fs = Math.min(5, (rh / s.u) * 0.3);
      s.text(title, tx, ry + rh * 0.38, { size: fs, font: 'display', weight: 560, align: 'left' });
      s.text(sub, tx, ry + rh * 0.7, { size: fs * 0.66, font: 'mono', align: 'left', color: s.c(k) });
      if (check > 0) {
        const ca = clamp01(check * n - i);
        s.alpha(ca, () => badge(s, x0 + rw - rh * 0.45, ry + rh / 2, Math.min(rh * 0.22, s.u * 3), true));
      }
    });
  });
}

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const aA = 1 - s.ease('data', 0.6);
    if (aA > 0) {
      s.alpha(aA, () => {
        const g = s.ease('gap', 1.2);
        s.alpha(1 - g, () => {
          s.text('Data, initialization', w / 2, h * 0.2, { size: 7, font: 'display', weight: 600 });
          s.text('and regularization', w / 2, h * 0.2 + u * 8.5, { size: 7, font: 'display', weight: 600 });
        });
        const nw = lerp(Math.min(w * 0.5, u * 60), Math.min(w * 0.3, u * 36), g);
        const nh = lerp(h * 0.42, h * 0.36, g);
        const ncx = lerp(w / 2, w * 0.22, g);
        const ncy = lerp(h * 0.62, h * 0.5, g);
        const grow = s.ease('hello', 1.4, 0.2);
        network(s, [ncx - nw / 2, ncy - nh / 2, nw, nh], [3, 5, 5, 2], {
          node: (l) => ({ fill: s.tint(l === 0 ? 'orange' : l === 3 ? 'purple' : 'green', 0.8), on: true }),
          edge: (l) => (grow * 3 > l ? { col: s.tint('--ink-3', 0.4 * clamp01(grow * 3 - l)), w: 0.22 } : null),
        });
        s.alpha(g, () => {
          s.text('on paper', ncx, ncy + nh / 2 + u * 5, { size: 3.8, italic: true, color: s.c('--ink-2') });
          const ax0 = w * 0.4;
          const ax1 = w * 0.6;
          s.arrow(ax0, h * 0.5, ax1, h * 0.5, s.c('--ink-3'), 0.6, 3);
          s.text('?', (ax0 + ax1) / 2, h * 0.5 - u * 7, { size: 9, font: 'display', weight: 600, color: s.c('--accent') });
          const fr = new Frame(s, [w * 0.66, h * 0.32, w * 0.28, h * 0.36], [0, 1, 0, 1]);
          s.line(fr.X(0), fr.Y(0), fr.X(1), fr.Y(0), s.c('--axis'), 0.35);
          s.line(fr.X(0), fr.Y(0), fr.X(0), fr.Y(1), s.c('--axis'), 0.35);
          const p = s.ease('gap', 2, 0.8);
          fr.fn((t) => 0.12 + 0.82 * Math.exp(-4.5 * t) + 0.02 * Math.sin(t * 50) * (1 - t), s.c('red'), 0.6, 0, Math.max(0.01, p));
          s.text('a model that trains', fr.X(0.5), fr.Y(0) + u * 5, { size: 3.8, italic: true, color: s.c('--ink-2') });
          s.text('loss', fr.X(0) + u, fr.Y(1) + u * 1.5, { size: 3.2, font: 'mono', color: s.c('red'), align: 'left' });
        });
      });
    }
    const keys = ['data', 'init', 'bn', 'reg', 'loss'];
    const bA = s.ease('data', 0.6);
    if (bA > 0) {
      const cur = keys.findIndex((k, i) => s.since(k) >= 0 && (i === keys.length - 1 ? s.since('why') < 0 : s.since(keys[i + 1]!) < 0));
      s.alpha(bA, () =>
        topicRows(s, area(s, 0.1, 0.05), (i) => s.ease(keys[i]!, 0.6), (i) => (i === cur ? 1 : s.since('why') >= 0 ? 0.35 + 0.3 * Math.sin(s.since('why') * 2 - i * 0.7) ** 2 : 0)),
      );
    }
  },
};

// ---------------------------------------------------------------- preprocess

/** Two decimals, without a "-0.00". */
const f2 = (v: number): string => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2);

/** Short-tick rug of values along one edge of a frame. */
function rug(fr: Frame, P: ArrayLike<number>, axis: 0 | 1, at: number, col: string): void {
  const s = fr.s;
  for (let i = 0; i < P.length / 2; i++) {
    const v = P[2 * i + axis]!;
    if (axis === 0) s.line(fr.X(v), fr.Y(at) - s.u * 0.9, fr.X(v), fr.Y(at) + s.u * 0.9, col, 0.18);
    else s.line(fr.X(at) - s.u * 0.9, fr.Y(v), fr.X(at) + s.u * 0.9, fr.Y(v), col, 0.18);
  }
}

/** A bracket from a to b along an axis, with a label. */
function bracket(fr: Frame, a: number, b: number, axis: 0 | 1, at: number, label: string, col: string): void {
  const s = fr.s;
  const u = s.u;
  if (axis === 0) {
    const y = fr.Y(at);
    s.line(fr.X(a), y, fr.X(b), y, col, 0.5);
    s.line(fr.X(a), y - u, fr.X(a), y + u, col, 0.5);
    s.line(fr.X(b), y - u, fr.X(b), y + u, col, 0.5);
    s.text(label, fr.X(b) + u * 1.2, y, { size: 3.3, font: 'mono', weight: 600, color: col, align: 'left', halo: true });
  } else {
    const x = fr.X(at);
    s.line(x, fr.Y(a), x, fr.Y(b), col, 0.5);
    s.line(x - u, fr.Y(a), x + u, fr.Y(a), col, 0.5);
    s.line(x - u, fr.Y(b), x + u, fr.Y(b), col, 0.5);
    s.text(label, x + u * 1.6, fr.Y(b) - u * 2.4, { size: 3.3, font: 'mono', weight: 600, color: col, align: 'left', halo: true });
  }
}

const preprocess: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const X = CLOUD.X;
    // the data matrix
    const tA = s.win('matrix', 'cloud', 0.7);
    if (tA > 0) {
      s.alpha(tA, () => {
        const cw = Math.min(w * 0.26, u * 26);
        const ch = Math.min(h * 0.085, u * 8);
        const x0 = w / 2 - cw;
        const y0 = h * 0.26;
        s.text('X', x0 - u * 7, y0 + ch * 3, { size: 8, italic: true, weight: 600, color: s.c('orange') });
        s.text('feature 1', x0 + cw / 2, y0 - u * 3, { size: 3.4, font: 'ui', color: s.c('--ink-2') });
        s.text('feature 2', x0 + cw * 1.5, y0 - u * 3, { size: 3.4, font: 'ui', color: s.c('--ink-2') });
        for (let i = 0; i < 5; i++)
          for (let j = 0; j < 2; j++) {
            const a = s.ease('matrix', 0.4, 0.3 + i * 0.25);
            s.alpha(a, () => s.cell(x0 + j * cw, y0 + i * ch, cw, ch, fmt(X[2 * i + j]!, 3), 'orange', { size: 3.6 }));
          }
        s.text('⋮', x0 + cw, y0 + 5 * ch + u * 3.5, { size: 5, color: s.c('--ink-3') });
        s.text('220 rows: one per example', x0 + cw, y0 + 5 * ch + u * 10, { size: 3.4, italic: true, color: s.c('--ink-2') });
        s.text('one column per feature', x0 + cw, y0 + 5 * ch + u * 15, { size: 3.4, italic: true, color: s.c('--ink-2') });
      });
    }
    const pA = s.ease('cloud', 0.8);
    if (pA <= 0) return;
    const fr = new Frame(s, area(s, 0.12, 0.05), [-3.9, 6.1, -3.5, 3.9], true);
    const c1 = s.ease('center', 1.6, 0.3);
    const c2 = s.ease('norm', 1.6, 0.3);
    const P = c2 > 0 ? mix(CLOUD.X0, CLOUD.Xn, c2) : mix(X, CLOUD.X0, c1);
    const st = stats(P);
    const sdx = Math.sqrt(st.cxx);
    const sdy = Math.sqrt(st.cyy);
    s.slot('m0', s.since('mu') >= 0 ? fmt(CLOUD.st.mx, 3) : '…');
    s.slot('m1', s.since('mu') >= 0 ? fmt(CLOUD.st.my, 3) : '…');
    s.slot('s0', s.since('sd') >= 0 ? fmt(CLOUD.sx, 3) : '…');
    s.slot('s1', s.since('sd') >= 0 ? fmt(CLOUD.sy, 3) : '…');
    s.alpha(pA, () => {
      fr.grid(1, 1);
      s.text('feature 1 →', fr.X(6.0), fr.Y(0) - u * 2.2, { size: 3.1, font: 'ui', color: s.c('--ink-3'), align: 'right' });
      s.text('feature 2 ↑', fr.X(0) + u * 1.4, fr.Y(3.75), { size: 3.1, font: 'ui', color: s.c('--ink-3'), align: 'left', halo: true });
      // distances from the mean, for the variance
      const dA = s.win('var', 'norm');
      s.alpha(dA * 0.8, () => {
        for (let i = 0; i < 220; i += 4) s.line(fr.X(st.mx), fr.Y(P[2 * i + 1]!), fr.X(P[2 * i]!), fr.Y(P[2 * i + 1]!), s.tint('orange', 0.45), 0.22);
      });
      const hot = s.win('cloud', 'mean');
      for (let i = 0; i < 220; i++) fr.dot(P[2 * i]!, P[2 * i + 1]!, 0.85, s.tint('orange', 0.6));
      s.alpha(hot, () => {
        for (let i = 0; i < 5; i++) s.circle(fr.X(P[2 * i]!), fr.Y(P[2 * i + 1]!), u * 1.7, { stroke: s.c('orange'), lw: 0.45 });
      });
      // rugs: each column's values along its axis
      const rA = s.win('mean', 'units');
      s.alpha(rA, () => {
        rug(fr, P, 0, -3.3, s.tint('orange', 0.45));
        rug(fr, P, 1, -3.7, s.tint('orange', 0.45));
        const ma = s.ease('mean', 0.6, 1.2);
        s.alpha(ma, () => {
          s.line(fr.X(st.mx), fr.Y(-3.3) - u * 1.8, fr.X(st.mx), fr.Y(-3.3) + u * 1.8, s.c('teal'), 0.6);
          s.line(fr.X(-3.7) - u * 1.8, fr.Y(st.my), fr.X(-3.7) + u * 1.8, fr.Y(st.my), s.c('teal'), 0.6);
          const sa = s.ease('sd', 0.6);
          s.alpha(1 - sa, () => {
            s.text(`μ₁ = ${f2(st.mx)}`, fr.X(st.mx) + u * 1.5, fr.Y(-3.3) - u * 3, { size: 3.3, font: 'mono', weight: 600, color: s.c('teal'), align: 'left', halo: true });
            s.text(`μ₂ = ${f2(st.my)}`, fr.X(-3.7) + u * 2, fr.Y(st.my) - u * 2.6, { size: 3.3, font: 'mono', weight: 600, color: s.c('teal'), align: 'left', halo: true });
          });
        });
        s.alpha(s.ease('sd', 0.6), () => {
          bracket(fr, st.mx - sdx, st.mx + sdx, 0, -3.3, `σ₁ = ${sdx.toFixed(2)}`, s.c('--ink'));
          bracket(fr, st.my - sdy, st.my + sdy, 1, -3.7, `σ₂ = ${sdy.toFixed(2)}`, s.c('--ink'));
        });
      });
      s.alpha(s.win('var', 'sd'), () => s.text('distance from the mean', fr.X(-3.3), fr.Y(2.9), { size: 3.4, italic: true, color: s.c('orange'), align: 'left', halo: true }));
      // the mean
      const mA = s.ease('mu', 0.6);
      s.alpha(mA, () => {
        if (s.since('center') < 0) {
          s.line(fr.X(st.mx), fr.Y(st.my), fr.X(st.mx), fr.Y(-3.3), s.tint('teal', 0.55), 0.3, [1, 0.8]);
          s.line(fr.X(st.mx), fr.Y(st.my), fr.X(-3.7), fr.Y(st.my), s.tint('teal', 0.55), 0.3, [1, 0.8]);
        }
        meanCross(fr, st.mx, st.my, 2);
        s.alpha(s.win('mu', 'var'), () => s.text('μ', fr.X(st.mx) + u * 3, fr.Y(st.my) + u * 3.6, { size: 5, italic: true, weight: 600, color: s.c('teal'), halo: true }));
      });
      s.alpha(s.win('center', 'var'), () => s.text('zero-centered', fr.X(2.6), fr.Y(3.2), { size: 4, font: 'display', weight: 560, align: 'left', halo: true }));
      s.alpha(s.win('norm', 'units'), () => s.text('spread 1 per feature', fr.X(2.0), fr.Y(3.2), { size: 4, font: 'display', weight: 560, align: 'left', halo: true }));
      // units inset
      const iA = s.win('units', 'tilt');
      s.alpha(iA, () => {
        const bx = fr.X(2.7);
        const by = fr.Y(3.6);
        const bw = fr.X(6.0) - bx;
        s.rrect(bx, by, bw, u * 15, 1.5, { fill: s.c('--card'), stroke: s.c('--rule'), lw: 0.3 });
        s.text('height (m)', bx + u * 1.5, by + u * 4, { size: 3, font: 'ui', align: 'left', color: s.c('--ink-2') });
        s.rrect(bx + u * 1.5, by + u * 6, u * 1.2, u * 1.6, 0.3, { fill: s.c('slate') });
        s.text('income ($)', bx + u * 1.5, by + u * 10.6, { size: 3, font: 'ui', align: 'left', color: s.c('--ink-2') });
        s.rrect(bx + u * 1.5, by + u * 12.4, (bw - u * 3) * smooth(s.prog('units') * 2.5), u * 1.6, 0.3, { fill: s.c('slate') });
      });
      // the tilt
      const tlt = s.ease('tilt', 0.7);
      s.alpha(tlt, () => {
        covEllipse(fr, P, { axes: 0, ring: 1 });
        const E = CLOUD.E;
        const nx = E.u1[0] / CLOUD.sx;
        const ny = E.u1[1] / CLOUD.sy;
        const nn = Math.hypot(nx, ny);
        const L = 2.3 * s.ease('tilt', 1, 0.5);
        fr.arrow(-(nx / nn) * L, -(ny / nn) * L, (nx / nn) * L, (ny / nn) * L, s.c('purple'), 0.7);
        s.text('still tilted', fr.X((nx / nn) * 2.4) + u * 1.5, fr.Y((ny / nn) * 2.4), { size: 4, font: 'display', weight: 600, color: s.c('purple'), align: 'left', halo: true });
      });
    });
  },
};

// ---------------------------------------------------------------- PCA

const pca: SceneDef = {
  draw(s) {
    const { u } = s;
    const [ax, ay, aw, ah] = area(s, 0.12, 0.04);
    const mw = aw * (s.tall ? 0.66 : 0.64);
    const mainR: Rect = [ax, ay, mw, ah];
    const sideR: Rect = [ax + mw + u * 2, ay, aw - mw - u * 2, ah];
    const fr = new Frame(s, mainR, [-3.4, 3.4, -3.1, 3.1], true);
    const rotT = s.ease('rot', 1.8, 0.3);
    const redT = s.win('reduce', 'white', 1.0) * s.ease('reduce', 1.2, 0.6);
    const whiteT = s.ease('white', 1.6, 0.9);
    const epsP = s.since('eps') >= 0 ? smooth(s.prog('eps') * 1.25) : 0;
    const eps = 10 ** lerp(-5, -0.4, epsP);
    let P = whiteT > 0 ? whitened(whiteT, eps) : rotated(rotT);
    if (redT > 0) P = P.map((v, i) => (i % 2 ? v * (1 - redT) : v));
    const st = stats(P);
    const zero = (v: number) => (Math.abs(v) < 5e-3 ? 0 : v);
    s.slot('c00', fmt(st.cxx, 2));
    s.slot('c01', fmt(zero(st.cxy), 2));
    s.slot('c01b', fmt(zero(st.cxy), 2));
    s.slot('c11', fmt(zero(st.cyy), 2));
    s.slot('s0', s.since('eig2') >= 0 ? fmt(CLOUD.E.l1, 3) : '…');
    s.slot('s1', s.since('eig2') >= 0 ? fmt(CLOUD.E.l2, 3) : '…');
    s.slot('eps', eps < 1e-4 ? '1e-5' : fmt(eps, 2));

    // quadrant signs, for the off-diagonal
    const qA = s.win('off', 'eig');
    s.alpha(qA, () => {
      const [x0, x1, y0, y1] = fr.dom;
      const q = (ax: number, bx: number, ay: number, by: number, k: K) => s.rrect(fr.X(ax), fr.Y(by), fr.X(bx) - fr.X(ax), fr.Y(ay) - fr.Y(by), 0, { fill: s.tint(k, 0.09) });
      q(0, x1, 0, y1, 'green');
      q(x0, 0, y0, 0, 'green');
      q(x0, 0, 0, y1, 'red');
      q(0, x1, y0, 0, 'red');
      const lab = (x: number, y: number, t: string, k: K) => s.text(t, fr.X(x), fr.Y(y), { size: 6, font: 'display', weight: 600, color: s.c(k) });
      lab(2.8, 2.15, '+', 'green');
      lab(-2.8, -2.15, '+', 'green');
      lab(-2.8, 2.15, '−', 'red');
      lab(2.8, -2.15, '−', 'red');
    });
    fr.grid(1, 1);
    if (redT > 0.02) s.alpha(redT * 0.25, () => {
      const R = rotated(1);
      for (let i = 0; i < R.length; i += 2) fr.dot(R[i]!, R[i + 1]!, 0.7, s.tint('orange', 0.5));
    });
    fr.clip(() => {
      for (let i = 0; i < P.length; i += 2) fr.dot(P[i]!, P[i + 1]!, 0.85, s.tint('orange', 0.62));
    });
    const eigA = s.ease('eig', 0.7) * (1 - redT);
    covEllipse(fr, P, { axes: eigA, ring: 1 - redT, mean: 1 });
    // eigenvector labels before the rotation lines them up
    s.alpha(s.win('eig', 'rot'), () => {
      const E = CLOUD.E;
      const a = Math.sqrt(E.l1) * 1.05 + 0.2;
      const b = Math.sqrt(E.l2) * 1.05 + 0.35;
      s.text('u₁', fr.X(E.u1[0] * a), fr.Y(E.u1[1] * a) - u * 1.5, { size: 4.4, italic: true, weight: 600, color: s.c('purple'), halo: true });
      s.text('u₂', fr.X(E.u2[0] * b) - u, fr.Y(E.u2[1] * b) - u, { size: 4.4, italic: true, weight: 600, color: s.c('purple'), halo: true });
    });
    const tag = (t: string, a: number) => s.alpha(a, () => s.text(t, fr.box[0] + u, fr.box[1] + u * 3, { size: 4, font: 'display', weight: 560, align: 'left', halo: true }));
    tag('centered', 1 - s.ease('rot', 0.5));
    tag('decorrelated', s.win('rot', 'reduce', 0.5));
    tag('reduced to 1-D', s.win('reduce', 'white', 0.5));
    tag('whitened', s.ease('white', 0.5) * (1 - s.ease('eps', 0.5)));
    tag(`ε = ${eps < 1e-4 ? '1e-5' : fmt(eps, 2)}`, s.ease('eps', 0.5));

    // the covariance matrix and eigenvalues
    const [sx, sy, sw, sh] = sideR;
    const cell = Math.min(sw * 0.46, sh * 0.17, u * 16);
    const mx = sx + (sw - 2 * cell) / 2;
    const my = sy + u * 7;
    const cA = s.ease('cov', 0.6);
    s.alpha(cA, () => {
      s.text('cov', mx + cell, my - u * 3.2, { size: 3.6, font: 'mono', weight: 600, color: s.c('--ink-2') });
      const vals = [st.cxx, st.cxy, st.cxy, st.cyy];
      const dg = s.win('diag', 'off');
      const of = s.win('off', 'eig');
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          const on = i === j ? dg : of;
          s.cell(mx + j * cell, my + i * cell, cell, cell, fmt(zero(vals[i * 2 + j]!), 2), i === j ? 'orange' : 'purple', { on, size: Math.min(3.8, (cell / u) * 0.3) });
        }
      s.alpha(s.win('diag', 'off'), () => s.text('variances', mx + cell, my + 2 * cell + u * 3.4, { size: 3.2, italic: true, color: s.c('orange') }));
      s.alpha(s.win('off', 'eig'), () => s.text('together', mx + cell, my + 2 * cell + u * 3.4, { size: 3.2, italic: true, color: s.c('purple') }));
    });
    const sA = s.ease('eig2', 0.6);
    s.alpha(sA, () => {
      const bw = Math.min(u * 9, sw * 0.3);
      const gap = Math.min(u * 13, sw * 0.42);
      const bx = sx + (sw - gap - bw) / 2 + u * 2;
      const by = my + 2 * cell + u * 13;
      const bh = Math.max(u * 10, Math.min(u * 26, sy + sh - by - u * 8));
      s.text('S', bx - u * 3.5, by + bh / 2, { size: 4.6, italic: true, weight: 600, color: s.c('purple') });
      const S = [CLOUD.E.l1, CLOUD.E.l2];
      const wA = s.win('white', 'round');
      S.forEach((v, i) => {
        const hh = (bh * v) / S[0]!;
        s.rrect(bx + i * gap, by + bh - hh, bw, Math.max(u * 0.4, hh), 0.6, { fill: s.tint('purple', 0.5) });
        s.text(v.toFixed(2), bx + i * gap + bw / 2, by + bh + u * 3.4, { size: 3.2, font: 'mono', color: s.c('--ink-2') });
        // the whitening stretch for this direction
        s.alpha(wA, () => s.text(`× ${(1 / Math.sqrt(v + 1e-5)).toFixed(1)}`, bx + i * gap + bw / 2, by - u * 3, { size: 3.4, font: 'mono', weight: 600, color: s.c('purple') }));
      });
    });
  },
};

// ---------------------------------------------------------------- eigen-images

const eigen: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const p = cifarPca(s);
    const tA = 1 - s.ease('twist', 0.6);
    if (tA > 0) {
      s.alpha(tA, () => {
        if (!p) {
          s.text('loading CIFAR-10…', w / 2, h / 2, { size: 4, italic: true, color: s.c('--ink-3') });
          return;
        }
        const [rx, ry, rw, rh] = area(s, 0.11, 0.04);
        const head = u * 5;
        const gap = u * 1.2;
        const tile = Math.min((rw - 7 * gap) / 8, (rh - 4 * head - 3 * gap) / 4);
        const x0 = rx + (rw - (8 * tile + 7 * gap)) / 2;
        let y = ry + (rh - (4 * head + 4 * tile + 3 * gap)) / 2;
        const heading = (t: string, a: number) => s.alpha(a, () => s.text(t, x0, y + head * 0.45, { size: 3.3, font: 'ui', weight: 600, align: 'left', color: s.c('--ink-2') }));
        heading('originals, 16 × 16 gray', s.ease('real', 0.5));
        y += head;
        for (let i = 0; i < 8; i++) s.alpha(s.ease('real', 0.4, 0.8 + i * 0.12), () => blit(s, original(p, i), x0 + i * (tile + gap), y, tile));
        y += tile + gap;
        heading('top 16 eigen-images', s.ease('cov', 0.5, 0.6));
        y += head;
        for (let r = 0; r < 2; r++) {
          for (let i = 0; i < 8; i++) {
            const j = r * 8 + i;
            s.alpha(s.ease('cov', 0.4, 1 + j * 0.12), () => blit(s, eigenImage(p, j), x0 + i * (tile + gap), y, tile));
          }
          y += tile + gap;
        }
        s.alpha(s.win('blobs', 'keep'), () => s.rrect(x0 - u * 0.6, y - 2 * (tile + gap) - u * 0.6, 4 * tile + 3 * gap + u * 1.2, tile + u * 1.2, 1, { stroke: s.c('gold'), lw: 0.6 }));
        let k = 24;
        if (s.since('sweep') >= 0) {
          const q = s.prog('sweep');
          const lg = q < 0.4 ? lerp(Math.log2(24), 0, smooth(q / 0.35)) : lerp(0, 8, smooth((q - 0.4) / 0.5));
          k = Math.max(1, Math.min(256, Math.round(2 ** lg)));
        }
        s.slot('k', s.since('keep') >= 0 ? k : 24);
        s.slot('kept', s.since('keep') >= 0 ? `${(100 * kept(p, k)).toFixed(1)}%` : '…');
        const kA = s.ease('keep', 0.6);
        s.alpha(kA, () => {
          s.text(`rebuilt from k = ${k} of 256`, x0, y + head * 0.45, { size: 3.3, font: 'ui', weight: 600, align: 'left', color: s.c('--ink-2') });
          s.text(`${(100 * kept(p, k)).toFixed(0)}% of variance`, x0 + 8 * tile + 7 * gap, y + head * 0.45, { size: 3.3, font: 'mono', weight: 600, align: 'right', color: s.c('purple') });
        });
        y += head;
        for (let i = 0; i < 8; i++) s.alpha(s.ease('keep', 0.4, 0.4 + i * 0.1), () => blit(s, rebuilt(p, i, k), x0 + i * (tile + gap), y, tile));
      });
    }
    const bA = s.ease('twist', 0.6);
    if (bA <= 0) return;
    s.alpha(bA, () => {
      // what ConvNets use
      const py = h * 0.17;
      const items: [string, boolean, string][] = [
        ['PCA', false, 'twist'],
        ['whitening', false, 'twist'],
        ['zero-centering', true, 'recipe'],
      ];
      const widths = items.map(([t]) => s.measure(t, { font: 'ui', size: 3.6, weight: 600 }) + u * 9);
      const gapX = u * 2.5;
      let x = (w - widths.reduce((a, b) => a + b, 0) - gapX * 2) / 2;
      items.forEach(([t, ok, beat], i) => {
        const a = s.ease(beat, 0.5, i === 1 ? 0.3 : 0);
        s.alpha(a, () => {
          const pw = pill(s, t, x + u * 4.6, py, ok ? 'green' : 'red', { size: 3.6, align: 'left' });
          badge(s, x + u * 2, py, u * 2, ok);
          x += pw + u * 4.6 + gapX;
        });
        if (a <= 0) x += widths[i]! + gapX;
      });
      s.alpha(s.ease('twist', 0.5, 0.4), () => s.text('with ConvNets', w / 2, py + u * 6.5, { size: 3.4, italic: true, color: s.c('--ink-3') }));
      // image minus the mean image
      const rA = s.win('recipe', 'bug');
      if (rA > 0 && p) {
        s.alpha(rA, () => {
          const sz = Math.min(w * 0.22, h * 0.36);
          const cy = h * 0.6;
          const xs = [w / 2 - sz * 1.45, w / 2, w / 2 + sz * 1.45];
          blit(s, colorImage('img', p.color[0]!), xs[0]! - sz / 2, cy - sz / 2, sz);
          s.alpha(s.ease('recipe', 0.5, 0.8), () => blit(s, colorImage('mean', p.meanImg), xs[1]! - sz / 2, cy - sz / 2, sz));
          s.alpha(s.ease('recipe', 0.5, 1.6), () => {
            const c = p.color[0]!.map((v, q) => v - p.meanImg[q]!);
            blit(s, colorImage('centered', c, 128), xs[2]! - sz / 2, cy - sz / 2, sz);
          });
          s.text('−', (xs[0]! + xs[1]!) / 2, cy, { size: 7, color: s.c('--ink-2') });
          s.text('=', (xs[1]! + xs[2]!) / 2, cy, { size: 7, color: s.c('--ink-2') });
          ['an image', 'the mean image', 'centered'].forEach((t, i) => s.text(t, xs[i]!, cy + sz / 2 + u * 4, { size: 3.4, italic: true, color: s.c(i === 1 ? 'teal' : '--ink-2') }));
        });
      }
      // where the mean comes from
      const rows: [string, number, boolean][] = [
        ['bug', h * 0.44, true],
        ['leak', h * 0.76, false],
      ];
      for (const [beat, cy, ok] of rows) {
        const a = s.ease(beat, 0.6);
        if (a <= 0) continue;
        s.alpha(a, () => {
          const bw = Math.min(w * 0.78, u * 110);
          const bx = (w - bw) / 2;
          const bh = u * 7;
          const parts: [string, number, K][] = [
            ['train', 0.7, 'orange'],
            ['val', 0.15, 'slate'],
            ['test', 0.15, 'purple'],
          ];
          let xx = bx;
          const mids: number[] = [];
          for (const [t, f, k] of parts) {
            s.rrect(xx + u * 0.3, cy, bw * f - u * 0.6, bh, 1, { fill: s.tint(k, 0.16), stroke: s.tint(k, 0.7), lw: 0.3 });
            s.text(t, xx + (bw * f) / 2, cy + bh / 2 + u * 0.2, { size: 3.4, font: 'ui', weight: 600, color: s.c(k) });
            mids.push(xx + (bw * f) / 2);
            xx += bw * f;
          }
          const muX = bx + bw * 0.16;
          const muY = cy - u * 11;
          s.rrect(muX - u * 4.5, muY - u * 3.2, u * 9, u * 6.4, 1.4, { fill: s.tint('teal', 0.14), stroke: s.c('teal'), lw: 0.4 });
          s.text('μ', muX, muY + u * 0.2, { size: 4.4, italic: true, weight: 600, color: s.c('teal') });
          const src = ok ? [mids[0]!] : mids;
          for (const m of src) s.arrow(m, cy - u * 0.5, muX + (m - muX) * 0.12, muY + u * 3.6, s.tint(ok ? 'teal' : 'red', 0.8), 0.4, 2);
          if (ok) for (const m of mids.slice(1)) s.arrow(muX + u * 4.6, muY + u * 3.2, m, cy - u * 0.6, s.tint('teal', 0.6), 0.35, 2);
          const label = ok ? 'mean from train only' : 'mean from everything';
          s.text(label, muX + u * 7, muY, { size: 3.4, italic: true, color: s.c('--ink-2'), align: 'left' });
          badge(s, muX + u * 11 + s.measure(label, { size: 3.4, italic: true }), muY, u * 2.2, ok);
        });
      }
    });
  },
};

export const scenesA: Record<string, SceneDef> = { intro, preprocess, pca, eigen };

import { fmt } from '../../core/code';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import { eig2 } from '../../lib/nn-data-loss-linalg';
import { BARS, BARS_N, DROP, DROP_SIZES, PEN_A, PEN_WS, POLY, POLY_D, REG, fitL1, fitL2, penAt, PEN_PATH, polyAt, polyCoef, truth } from './data';
import { type K, type Rect, Frame, area, badge, network, pill, split } from './draw';
import { topicRows } from './scenes-a';

// ---------------------------------------------------------------- penalties

/** The curve-fit sweep position for the current beat: 0 is unregularized, 1 is lambda = 0.1. */
function sweep(s: Scene): number {
  if (s.since('smooth') < 0) return 0;
  return lerp(0, 0.86, smooth(clamp01(s.prog('smooth') * 1.2)));
}

/** Weight bars on a log scale: height ~ log10(1 + |w|), so 250 and 1.7 both read. */
function weightBars(s: Scene, r: Rect, ws: ArrayLike<number>, k: K, title: string): void {
  const { u } = s;
  const [x, y, w, h] = r;
  const mid = y + h / 2 + u * 1.5;
  const half = h / 2 - u * 3;
  s.text(title, x, y + u * 1, { size: 3, font: 'ui', weight: 600, color: s.c('--ink-3'), align: 'left' });
  s.line(x, mid, x + w, mid, s.c('--axis'), 0.3);
  const n = ws.length;
  const bw = w / n;
  for (let i = 0; i < n; i++) {
    const v = ws[i]!;
    const hh = (Math.sign(v) * half * Math.log10(1 + Math.abs(v))) / Math.log10(251);
    s.rrect(x + i * bw + bw * 0.18, Math.min(mid, mid - hh), bw * 0.64, Math.max(u * 0.3, Math.abs(hh)), 0.3, { fill: s.tint(k, 0.7) });
  }
}

/** Contours of the two-weight data loss, 0.5 (w - w*)^T A (w - w*), at the given levels. */
function ellipses(fr: Frame, levels: number[], col: string, width = 0.25): void {
  const E = eig2(PEN_A[0]!, PEN_A[1]!, PEN_A[3]!);
  for (const lev of levels) {
    const a = Math.sqrt((2 * lev) / E.l1);
    const b = Math.sqrt((2 * lev) / E.l2);
    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i <= 90; i++) {
      const t = (i / 90) * Math.PI * 2;
      xs.push(PEN_WS[0]! + E.u1[0] * a * Math.cos(t) + E.u2[0] * b * Math.sin(t));
      ys.push(PEN_WS[1]! + E.u1[1] * a * Math.cos(t) + E.u2[1] * b * Math.sin(t));
    }
    fr.path(xs, ys, col, width);
  }
}

const levelAt = (w: number[]): number => {
  const d0 = w[0]! - PEN_WS[0]!;
  const d1 = w[1]! - PEN_WS[1]!;
  return 0.5 * (PEN_A[0]! * d0 * d0 + 2 * PEN_A[1]! * d0 * d1 + PEN_A[3]! * d1 * d1);
};

const penalties: SceneDef = {
  marks: {
    loss: { tex: String.raw`\symL = \text{data loss} + \symlam\, R(\symW)`, x: 0.5, y: 0.5, size: 4.4 },
    l2: { tex: String.raw`R_{L2} = \tfrac{1}{2}\textstyle\sum_k \symW_k^2`, x: 0.5, y: 0.5, size: 4.4 },
    decay: { tex: String.raw`\symW \leftarrow \symW - \eta\,\symlam\,\symW`, x: 0.5, y: 0.5, size: 4.4 },
    l1: { tex: String.raw`R_{L1} = \textstyle\sum_k |\symW_k|`, x: 0.5, y: 0.5, size: 4.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    const [mainR, sideR] = split(s, area(s, 0.12, 0.05), s.tall ? 0.66 : 0.62);
    const [geoR, geoSide] = split(s, area(s, 0.12, 0.05), s.tall ? 0.7 : 0.7);
    // phase A: a curve that memorizes, then calms down
    const aA = 1 - s.ease('picture', 0.6);
    if (aA > 0) {
      const t = sweep(s);
      s.alpha(aA, () => {
        const fr = new Frame(s, mainR, [-1.05, 1.05, -1.5, 1.5]);
        fr.grid(0.5, 1);
        s.alpha(0.5, () => fr.fn(truth, s.tint('--ink-3', 0.6), 0.35, -1, 1));
        fr.fn(polyAt(t), s.c('blue'), 0.6, -0.99, 0.99, 300);
        POLY.xs.forEach((x, i) => fr.dot(x, POLY.ys[i]!, 1.2, s.c('orange'), true));
        s.alpha(s.ease('overfit', 0.6, 2.2), () => {
          POLY.test.forEach(([x, y]) => s.circle(fr.X(x), fr.Y(y), u * 1.2, { stroke: s.c('purple'), lw: 0.45, fill: s.c('--card') }));
          s.text('○ new data', fr.box[0] + fr.box[2] - u, fr.box[1] + fr.box[3] - u * 2.4, { size: 3.1, font: 'ui', color: s.c('purple'), align: 'right', halo: true });
        });
        s.text(t < 0.3 ? 'memorized: through every point' : 'regularized: smooth', fr.box[0] + u, fr.box[1] + u * 2.6, { size: 3.6, font: 'display', weight: 560, align: 'left', halo: true });
        const lam = 10 ** (-8 + 7 * t);
        s.slot('regline', `reg = ${lam < 1e-4 ? lam.toExponential(0) : fmt(lam, 2)}`);
        const c = polyCoef(t);
        let dec = c;
        if (s.since('decay') >= 0) {
          const steps = Math.floor(clamp01(s.prog('decay') * 1.2) * 6);
          dec = c.map((v) => v * 0.7 ** steps);
        }
        const [bx, by, bw, bh] = sideR;
        const markY = s.tall ? by + bh * 0.2 : by + bh * 0.16;
        const barsR: Rect = s.tall ? [bx + bw * 0.52, by, bw * 0.48, bh] : [bx, by + bh * 0.35, bw, bh * 0.5];
        weightBars(s, barsR, dec, 'blue', `${POLY_D} weights, size (log)`);
        const mx = s.tall ? (bx + bw * 0.25) / w : (bx + bw / 2) / w;
        s.show('loss', aA * s.win('reg', 'l2'), { x: mx, y: markY / h });
        s.show('l2', aA * s.win('l2', 'decay'), { x: mx, y: markY / h });
        s.show('decay', aA * s.ease('decay', 0.6), { x: mx, y: markY / h });
        s.alpha(s.ease('decay', 0.6, 1), () => s.text('every step: a little smaller', mx * w, markY + u * 7, { size: 3.1, italic: true, color: s.c('--ink-2') }));
      });
    }
    // phase B: the geometry with two weights
    const gA = s.ease('picture', 0.6) * (1 - s.ease('sparse', 0.6)) + s.win('maxnorm', 'bias');
    if (gA > 0) {
      s.alpha(gA, () => {
        const fr = new Frame(s, geoR, [-0.55, 1.95, -0.5, 1.25], true);
        const c0 = s.ctx;
        c0.save();
        c0.beginPath();
        c0.rect(...fr.box);
        c0.clip();
        fr.grid(0.5, 1);
        s.text('w₀ →', fr.box[0] + fr.box[2] - u, fr.Y(0) - u * 2, { size: 3, font: 'ui', color: s.c('--ink-3'), align: 'right' });
        s.text('w₁', fr.X(0) + u * 1.2, fr.box[1] + u * 2.2, { size: 3, font: 'ui', color: s.c('--ink-3'), align: 'left' });
        ellipses(fr, [0.04, 0.16, 0.36, 0.64, 1.0], s.tint('red', 0.28));
        const mn = s.since('maxnorm') >= 0;
        const l1 = !mn && s.since('l1') >= 0;
        const kind = mn ? 'mn' : l1 ? 'l1' : 'l2';
        let t = 0;
        if (mn) t = 0.25 + 0.25 * smooth(clamp01(s.prog('maxnorm') * 1.3));
        else if (s.since('corner') >= 0) t = lerp(0.25, 0.8, smooth(clamp01(s.prog('corner') * 1.3)));
        else if (l1) t = 0.25;
        else if (s.since('circle') >= 0) t = lerp(0, 0.72, smooth(clamp01(s.prog('circle') * 1.2)));
        const sol = penAt(kind, t);
        const shapeA = s.since('circle') >= 0 ? 1 : 0;
        if (shapeA > 0 && !(sol[0] === PEN_WS[0] && sol[1] === PEN_WS[1])) {
          const xs: number[] = [];
          const ys: number[] = [];
          if (kind === 'mn') {
            const c = 1.7 - 1.6 * t;
            for (let i = 0; i <= 90; i++) {
              const a = (i / 90) * Math.PI * 2;
              xs.push(c * Math.cos(a));
              ys.push(c * Math.sin(a));
            }
            s.ctx.beginPath();
            xs.forEach((x, i) => (i ? s.ctx.lineTo(fr.X(x), fr.Y(ys[i]!)) : s.ctx.moveTo(fr.X(x), fr.Y(ys[i]!))));
            s.ctx.fillStyle = s.tint('blue', 0.08);
            s.ctx.fill();
          } else if (kind === 'l2') {
            const rr = Math.hypot(sol[0]!, sol[1]!);
            for (let i = 0; i <= 90; i++) {
              const a = (i / 90) * Math.PI * 2;
              xs.push(rr * Math.cos(a));
              ys.push(rr * Math.sin(a));
            }
          } else {
            const rr = Math.abs(sol[0]!) + Math.abs(sol[1]!);
            xs.push(rr, 0, -rr, 0, rr);
            ys.push(0, rr, 0, -rr, 0);
          }
          fr.path(xs, ys, s.c('blue'), 0.5);
        }
        const lev = levelAt(sol);
        if (lev > 1e-4) ellipses(fr, [lev], s.c('red'), 0.45);
        if (s.since('circle') >= 0) {
          const p = PEN_PATH[kind];
          fr.path(p.map((q) => q[0]!), p.map((q) => q[1]!), s.tint('--ink-2', 0.6), 0.3, [1, 1]);
        }
        fr.dot(PEN_WS[0]!, PEN_WS[1]!, 1.3, s.c('red'));
        if (s.since('circle') >= 0) fr.dot(sol[0]!, sol[1]!, 1.5, s.c('blue'), true);
        c0.restore();
        s.rrect(...fr.box, 0.4, { stroke: s.c('--rule'), lw: 0.25 });
        s.text('w*', fr.X(PEN_WS[0]!) + u * 1.6, fr.Y(PEN_WS[1]!) - u * 1.8, { size: 3.6, font: 'mono', weight: 600, color: s.c('red'), align: 'left', halo: true });
        s.text('best fit', fr.X(PEN_WS[0]!) + u * 1.6, fr.Y(PEN_WS[1]!) + u * 2.4, { size: 3, italic: true, color: s.c('red'), align: 'left', halo: true });
        s.text('to the data', fr.X(PEN_WS[0]!) + u * 1.6, fr.Y(PEN_WS[1]!) + u * 5.6, { size: 3, italic: true, color: s.c('red'), align: 'left', halo: true });
        const tag = kind === 'l2' ? 'L2: a circle' : kind === 'l1' ? 'L1: a diamond' : 'max-norm: a hard cap';
        s.slot('regline', kind === 'mn' ? `c = ${(1.7 - 1.6 * t).toFixed(2)}` : `w = [${fmt(Math.abs(sol[0]!) < 5e-3 ? 0 : sol[0]!, 2)}, ${fmt(Math.abs(sol[1]!) < 5e-3 ? 0 : sol[1]!, 2)}]`);
        const [bx, by, bw, bh] = geoSide;
        const mx = (bx + bw / 2) / w;
        const my = s.tall ? (by + bh * 0.62) / h : (by + bh * 0.3) / h;
        if (s.since('circle') >= 0) pill(s, tag, mx * w, my * h - u * 8, 'blue', { size: 3.3 });
        if (kind === 'mn') s.text(`c = ${(1.7 - 1.6 * t).toFixed(2)}`, mx * w, my * h, { size: 4, font: 'mono', weight: 600, color: s.c('blue') });
        s.show('l2', gA * s.win('circle', 'l1'), { x: mx, y: my });
        s.show('l1', gA * s.win('l1', 'sparse'), { x: mx, y: my });
        s.alpha(s.win('corner', 'sparse'), () => {
          if (Math.abs(sol[1]!) < 5e-3) s.text('w₁ = 0 exactly', mx * w, my * h + u * 8, { size: 3.6, font: 'mono', weight: 600, color: s.c('blue') });
        });
      });
    }
    // phase C: sixteen weights
    const bA = s.win('sparse', 'maxnorm');
    if (bA > 0) {
      s.alpha(bA, () => {
        const [rx, ry, rw, rh] = area(s, 0.14, 0.06);
        const rows: [string, Float64Array, K][] = [
          ['L2: small, never zero', BARS.l2, 'blue'],
          ['L1: the useless ones exactly zero', BARS.l1, 'green'],
        ];
        rows.forEach(([title, ws, k], ri) => {
          const y0 = ry + ri * rh * 0.5;
          const hh = rh * 0.42;
          const mid = y0 + hh * 0.6;
          const bw = rw / BARS_N;
          s.alpha(s.ease('sparse', 0.5, ri * 1.4), () => {
            s.text(title, rx, y0 + u * 1.5, { size: 3.6, font: 'display', weight: 560, color: s.c(k), align: 'left' });
            s.line(rx, mid, rx + rw, mid, s.c('--axis'), 0.3);
            for (let j = 0; j < BARS_N; j++) {
              const scale = (hh * 0.36) / 1.6;
              const tv = BARS.wtrue[j]!;
              if (tv !== 0) {
                s.ctx.save();
                s.ctx.setLineDash([u * 0.6, u * 0.5]);
                s.rrect(rx + j * bw + bw * 0.12, Math.min(mid, mid - tv * scale), bw * 0.76, Math.abs(tv * scale), 0.2, { stroke: s.tint('red', 0.7), lw: 0.25 });
                s.ctx.restore();
              }
              const v = ws[j]!;
              if (Math.abs(v) < 1e-9) s.circle(rx + (j + 0.5) * bw, mid, u * 0.7, { fill: s.c('--ink-3') });
              else s.rrect(rx + j * bw + bw * 0.2, Math.min(mid, mid - v * scale), bw * 0.6, Math.max(u * 0.3, Math.abs(v * scale)), 0.2, { fill: s.tint(k, 0.75) });
            }
          });
        });
        s.text('dashed: the 3 inputs that matter', w / 2, ry + rh + u * 0.5, { size: 3.1, italic: true, color: s.c('red') });
      });
    }
    // phase D: the practice
    const dA = s.ease('bias', 0.6);
    if (dA > 0) {
      s.alpha(dA, () => {
        const cw = Math.min(w * 0.84, u * 100);
        const x0 = (w - cw) / 2;
        const cards: [string, string, K][] = [
          ['biases: not regularized', 'they multiply no input', 'green'],
          ['one global λ', 'tuned on validation data', 'slate'],
        ];
        cards.forEach(([a, b, k], i) => {
          const y = h * (0.3 + i * 0.3);
          s.alpha(s.ease('bias', 0.5, i * 1.6), () => {
            s.rrect(x0, y - h * 0.1, cw, h * 0.2, 2, { fill: s.tint(k, 0.07), stroke: s.tint(k, 0.5), lw: 0.35 });
            s.text(a, w / 2, y - u * 2.4, { size: 4.4, font: 'display', weight: 600, color: s.c(k) });
            s.text(b, w / 2, y + u * 3.6, { size: 3.6, italic: true, color: s.c('--ink-2') });
          });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- dropout

const PASS_S = 0.8;

const dropout: SceneDef = {
  marks: {
    expect: { tex: String.raw`\mathbb{E}\Big[\frac{m}{\symp}\,h\Big] = \symp\cdot\frac{1}{\symp}\,h + (1-\symp)\cdot 0 = h`, x: 0.5, y: 0.82, size: 4.6 },
    count: { tex: String.raw`2^{n}\ \text{sub-networks}`, x: 0.74, y: 0.115, size: 4.2 },
  },
  draw(s) {
    const { w, h, u } = s;
    const famA = s.ease('family', 0.6);
    const pass = s.since('how') >= 0 ? DROP.shown[Math.floor(s.since('how') / PASS_S) % DROP.shown.length]! : -1;
    const fresh = s.since('fresh') >= 0 && s.since('coadapt') < 0;
    const testing = pass < 0 || (fresh && s.prog('fresh') > 0.55) || (s.since('count') >= 0 && s.since('scale') < 0) || s.since('practice') >= 0;
    const inverted = s.since('inverted') >= 0;
    const m1 = pass >= 0 ? DROP.m1[pass]! : [1, 1, 1, 1, 1, 1];
    const m2 = pass >= 0 ? DROP.m2[pass]! : [1, 1, 1, 1, 1, 1];
    s.slot('keep', testing ? 'all, at test' : `[${m1.join(', ')}]`);
    const bottom = s.since('ensemble') >= 0 && s.since('family') < 0;
    const netH = bottom ? h * 0.48 : h * 0.68;
    const netR: Rect = [w * 0.08, h * 0.15, w * 0.84, netH];
    s.alpha(1 - famA, () => {
      const alive = (l: number, i: number) => testing || l === 0 || l === 3 || (l === 1 ? m1[i] === 1 : m2[i] === 1);
      const pos = network(s, netR, DROP_SIZES, {
        node: (l, i) => ({
          fill: s.tint(l === 0 ? 'orange' : l === 3 ? 'purple' : 'green', 0.8),
          on: alive(l, i),
          ring: (s.win('coadapt', 'ensemble') > 0.5 && l === 1 && i === 2) || (s.since('watch') >= 0 && l === 2 && i === DROP.track) ? s.c('gold') : undefined,
        }),
        edge: (l, i, j) => {
          const v = DROP.Ws[l]![j]![i]!;
          return { col: s.tint(v > 0 ? 'blue' : 'red', 0.18 + Math.min(0.45, Math.abs(v) * 0.3)), w: 0.15 + Math.min(0.5, Math.abs(v) * 0.35) };
        },
      });
      const status = pass < 0 ? 'a small network' : testing ? 'test time: every unit' : `train: ${m1.filter(Boolean).length + m2.filter(Boolean).length} of 12 hidden units kept`;
      s.text(status, netR[0], h * 0.13, { size: 3.4, font: 'ui', weight: 600, color: s.c(testing ? 'purple' : '--ink-2'), align: 'left' });
      ['x', 'h1', 'h2', 'out'].forEach((t, l) => s.text(t, pos[l]![0]![0], netR[1] + netR[3] + u * 1.5, { size: 3, font: 'mono', color: s.c('--ink-3') }));
      if (s.win('coadapt', 'ensemble') > 0) s.alpha(s.win('coadapt', 'ensemble'), () => {
        const [x, y] = pos[1]![2]!;
        s.text('whiskers', x - u * 4.6, y, { size: 2.9, font: 'mono', weight: 600, color: s.c('gold'), align: 'right', halo: true });
      });
      // kept units carry twice their value
      if (inverted && !testing && s.since('watch') < 0) {
        pos[1]!.forEach(([x, y], i) => {
          if (m1[i]) s.text('×2', x + u * 4.2, y - u * 2.6, { size: 2.9, font: 'mono', weight: 600, color: s.c('gold'), halo: true });
        });
        pos[2]!.forEach(([x, y], i) => {
          if (m2[i]) s.text('×2', x + u * 4.2, y - u * 2.6, { size: 2.9, font: 'mono', weight: 600, color: s.c('gold'), halo: true });
        });
      }
      // the ensemble of thinned networks
      const bandY = h * 0.69;
      const bandH = h * 0.24;
      const eA = s.win('ensemble', 'scale');
      if (eA > 0) {
        s.alpha(eA, () => {
          const many = s.since('count') >= 0;
          const n = many ? 12 : 4;
          const cols = many ? 6 : 4;
          const rows = many ? 2 : 1;
          const tw = Math.min((w * 0.84) / cols, (bandH / rows) * 1.3);
          const th = bandH / rows;
          const x0 = (w - tw * cols) / 2;
          for (let k = 0; k < n; k++) {
            const a = s.ease(many ? 'count' : 'ensemble', 0.4, 0.3 + k * 0.15);
            const mk1 = DROP.m1[(k * 7 + 3) % DROP.PASSES]!;
            const mk2 = DROP.m2[(k * 7 + 3) % DROP.PASSES]!;
            s.alpha(a, () =>
              network(s, [x0 + (k % cols) * tw + tw * 0.08, bandY + Math.floor(k / cols) * th + th * 0.08, tw * 0.84, th * 0.84], [4, 6, 6, 2], {
                rad: Math.min(u * 1.1, th * 0.06),
                node: (l, i) => ({ fill: s.tint(l === 0 ? 'orange' : l === 3 ? 'purple' : 'green', 0.8), on: l === 0 || l === 3 || (l === 1 ? mk1[i] === 1 : mk2[i] === 1) }),
                edge: () => ({ col: s.tint('--ink-3', 0.35), w: 0.12 }),
              }),
            );
          }
        });
      }
      s.show('count', s.win('count', 'scale'), { x: 0.74, y: 0.115 });
      // half the input during training, all of it at test
      const scA = s.win('scale', 'inverted');
      if (scA > 0) {
        s.alpha(scA, () => {
          const bx = w * 0.18;
          const bw = w * 0.46;
          const y1 = h * 0.76;
          const y2 = h * 0.87;
          const bar = (y: number, f: number, t: string, k: K, a: number) =>
            s.alpha(a, () => {
              s.text(t, bx - u * 1.5, y, { size: 3.2, font: 'ui', weight: 600, color: s.c(k), align: 'right' });
              s.rrect(bx, y - u * 2.2, bw * f, u * 4.4, 1, { fill: s.tint(k, 0.55) });
            });
          bar(y1, 0.5, 'train', 'green', s.ease('scale', 0.5, 0.6));
          bar(y2, 1, 'test', 'purple', s.ease('scale', 0.5, 3));
          s.alpha(s.ease('scale', 0.5, 4), () => s.text('twice as much', bx + bw + u * 1.5, y2, { size: 3.2, italic: true, color: s.c('red'), align: 'left' }));
        });
      }
      s.show('expect', (1 - famA) * s.win('expect', 'watch'), { y: 0.83 });
      // one unit's input, pass after pass
      const wA = s.win('watch', 'family');
      if (wA > 0) {
        s.alpha(wA, () => {
          const r: Rect = [w * 0.1, h * 0.7, w * 0.8, h * 0.24];
          const n = Math.max(1, Math.round(DROP.PASSES * smooth(clamp01(s.prog('watch') * 1.15))));
          const ys = DROP.zInv;
          const lo = Math.min(...ys) - 0.3;
          const hi = Math.max(...ys) + 0.3;
          const fr = new Frame(s, r, [0, DROP.PASSES, lo, hi]);
          s.line(r[0], fr.Y(DROP.zTest), r[0] + r[2], fr.Y(DROP.zTest), s.c('--ink'), 0.35, [1.2, 0.9]);
          let acc = 0;
          const avg: number[] = [];
          for (let i = 0; i < n; i++) {
            acc += ys[i]!;
            avg.push(acc / (i + 1));
            fr.dot(i + 0.5, ys[i]!, 0.45, s.tint('green', 0.32));
          }
          fr.path(avg.map((_, i) => i + 0.5), avg, s.c('gold'), 0.55);
          s.text('test-time value', r[0] + r[2], fr.Y(DROP.zTest) + u * 2.4, { size: 3, font: 'ui', weight: 600, color: s.c('--ink'), align: 'right', halo: true });
          s.text('running average', r[0] + r[2], r[1] - u * 0.5, { size: 3, font: 'ui', weight: 600, color: s.c('gold'), align: 'right' });
          s.text(`${n} passes`, r[0], r[1] - u * 0.5, { size: 3, font: 'mono', color: s.c('--ink-3'), align: 'left' });
        });
      }
    });
    if (famA > 0) {
      s.alpha(famA, () => {
        const pA = s.ease('practice', 0.6);
        s.alpha(1 - pA, () => {
          s.text('noise in training,', w / 2, h * 0.4, { size: 5, font: 'display', weight: 600 });
          s.text('averaged away at test time', w / 2, h * 0.4 + u * 7, { size: 5, font: 'display', weight: 600 });
          const chips: [string, K][] = [
            ['dropout', 'gold'],
            ['DropConnect', 'blue'],
            ['data augmentation', 'orange'],
            ['BatchNorm batches', 'purple'],
          ];
          chips.forEach(([t, k], i) => {
            const x = i % 2 ? w * 0.72 : w * 0.28;
            const y = i < 2 ? h * 0.2 : h * 0.72;
            s.alpha(s.ease('family', 0.5, 0.6 + i * 0.5), () => pill(s, t, x, y + (i < 2 ? 0 : u * 6), k, { size: 3.6 }));
          });
        });
        s.alpha(pA, () => {
          s.text('in practice', w / 2, h * 0.3, { size: 4.4, font: 'display', weight: 600, color: s.c('--ink-2') });
          s.text('one global L2 penalty', w / 2, h * 0.46, { size: 4.6, font: 'display', weight: 560, color: s.c('slate') });
          s.text('+ dropout, p ≈ 0.5', w / 2, h * 0.58, { size: 4.6, font: 'display', weight: 560, color: s.c('gold') });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- losses for labels

const sig = (z: number): number => 1 / (1 + Math.exp(-z));

const losses: SceneDef = {
  marks: {
    total: { tex: String.raw`\symL = \underbrace{\tfrac{1}{N}\textstyle\sum_i \symL_i}_{\text{data loss}} + \underbrace{\symlam\, R(\symW)}_{\text{penalty}}`, x: 0.5, y: 0.45, size: 5.2 },
    soft: { tex: String.raw`\symL_i = -\log \frac{e^{f_{y_i}}}{\sum_j e^{f_j}}`, x: 0.5, y: 0.2, size: 4.2 },
    logl: { tex: String.raw`\symL_i = -\textstyle\sum_j \big[\,y_{ij} \log \sigma(f_j) + (1-y_{ij}) \log(1-\sigma(f_j))\big]`, x: 0.5, y: 0.2, size: 3.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    s.show('total', s.win('parts', 'one'));
    // one correct class
    const oA = s.win('one', 'huge');
    if (oA > 0) {
      s.alpha(oA, () => {
        const names = ['cat', 'dog', 'ship', 'frog'];
        const f = [3.2, 1.3, -0.6, 0.6];
        const e = f.map(Math.exp);
        const sum = e.reduce((a, b) => a + b, 0);
        const pr = e.map((v) => v / sum);
        const [mainR, sideR] = split(s, area(s, s.tall ? 0.3 : 0.34, 0.06), 0.5, 6);
        const bars = (r: Rect, vals: number[], lo: number, hi: number, k: K, title: string, label: (v: number) => string) => {
          const fr = new Frame(s, [r[0], r[1] + u * 4, r[2], r[3] - u * 9], [-0.5, 3.5, lo, hi]);
          s.text(title, r[0], r[1], { size: 3.3, font: 'ui', weight: 600, color: s.c(k), align: 'left' });
          s.line(r[0], fr.Y(0), r[0] + r[2], fr.Y(0), s.c('--axis'), 0.3);
          vals.forEach((v, i) => {
            const bw = fr.kx * 0.6;
            s.rrect(fr.X(i) - bw / 2, Math.min(fr.Y(0), fr.Y(v)), bw, Math.abs(fr.Y(v) - fr.Y(0)), 0.4, { fill: s.tint(k, i === 0 ? 0.8 : 0.4) });
            s.text(label(v), fr.X(i), (v >= 0 ? fr.Y(v) : fr.Y(0)) - u * 2, { size: 3, font: 'mono', color: s.c('--ink-2') });
            s.text(names[i]!, fr.X(i), r[1] + r[3] - u * 1.5, { size: 3.1, font: 'ui', weight: i === 0 ? 700 : 400, color: s.c(i === 0 ? 'gold' : '--ink-3') });
          });
        };
        s.show('soft', oA * (1 - s.ease('sq', 0.5)));
        bars(mainR, f, -1, 4, 'purple', 'scores f', (v) => v.toFixed(1));
        const sq = s.ease('sq', 0.6);
        s.alpha(1 - sq, () => bars(sideR, pr, 0, 1.15, 'red', 'softmax probabilities', (v) => v.toFixed(2)));
        s.alpha(sq, () => {
          const fr = new Frame(s, [sideR[0], sideR[1] + u * 4, sideR[2], sideR[3] - u * 9], [-2, 2, -0.3, 4]);
          s.text('hinge vs squared hinge', sideR[0], sideR[1], { size: 3.3, font: 'ui', weight: 600, color: s.c('red'), align: 'left' });
          fr.grid(1, 0.6);
          fr.fn((m) => Math.max(0, m), s.c('red'), 0.55);
          fr.fn((m) => Math.max(0, m) ** 2, s.c('purple'), 0.55);
          s.text('max(0, m)', fr.X(1.95), fr.Y(1.0), { size: 3, font: 'mono', color: s.c('red'), align: 'right', halo: true });
          s.text('max(0, m)²', fr.X(1.5), fr.Y(3.4), { size: 3, font: 'mono', color: s.c('purple'), align: 'right', halo: true });
          s.text('margin m', fr.X(2), fr.Y(-0.3) + u * 2.6, { size: 2.9, font: 'ui', color: s.c('--ink-3'), align: 'right' });
        });
        s.text('correct class: cat', w / 2, h * (s.tall ? 0.265 : 0.285), { size: 3.3, italic: true, color: s.c('gold') });
      });
    }
    // too many classes: a tree
    const tA = s.win('huge', 'attr');
    if (tA > 0) {
      s.alpha(tA, () => {
        const hA = 1 - s.ease('tree', 0.6);
        s.alpha(hA, () => {
          const n = 160;
          const bw = (w * 0.84) / n;
          for (let i = 0; i < n; i++) {
            const v = 0.15 + 0.85 * Math.abs(Math.sin(i * 12.9898) * 0.5 + Math.sin(i * 3.1) * 0.3);
            s.rrect(w * 0.08 + i * bw, h * 0.72 - v * h * 0.3, Math.max(1, bw * 0.7), v * h * 0.3, 0, { fill: s.tint('purple', 0.45) });
          }
          s.text('a softmax over 22,000 classes, for every example', w / 2, h * 0.3, { size: 3.8, font: 'display', weight: 560 });
          s.text('every word? every ImageNet category?', w / 2, h * 0.8, { size: 3.4, italic: true, color: s.c('--ink-3') });
        });
        const trA = s.ease('tree', 0.6);
        s.alpha(trA, () => {
          const depth = 4;
          const top = h * 0.27;
          const bot = h * 0.8;
          const leafPath = 11;
          const nodeXY = (d: number, i: number): [number, number] => [w * 0.06 + ((i + 0.5) / 2 ** d) * w * 0.88, top + ((bot - top) * d) / depth];
          const onPath = (d: number, i: number) => i === leafPath >> (depth - d);
          const lit = s.since('cost') >= 0 ? 1 : smooth(s.prog('tree') * 1.4);
          for (let d = 0; d < depth; d++)
            for (let i = 0; i < 2 ** d; i++) {
              const [x, y] = nodeXY(d, i);
              for (const c of [0, 1]) {
                const [x2, y2] = nodeXY(d + 1, 2 * i + c);
                const hot = onPath(d, i) && onPath(d + 1, 2 * i + c) && lit > d / depth;
                s.line(x, y, x2, y2, hot ? s.c('red') : s.tint('--ink-3', 0.4), hot ? 0.6 : 0.25);
              }
            }
          for (let d = 0; d <= depth; d++)
            for (let i = 0; i < 2 ** d; i++) {
              const [x, y] = nodeXY(d, i);
              const hot = onPath(d, i) && lit > (d - 0.5) / depth;
              s.circle(x, y, d === depth ? u * 1.3 : u * 2, { fill: hot ? s.tint('red', d === depth ? 0.9 : 0.3) : s.c('--card'), stroke: hot ? s.c('red') : s.tint('--ink-3', 0.7), lw: 0.3 });
            }
          s.text('16 classes at the leaves', w / 2, bot + u * 6, { size: 3.4, italic: true, color: s.c('--ink-2') });
          s.alpha(s.ease('cost', 0.5, 0.4), () => pill(s, '4 left-or-right steps, not 16 scores', w / 2, h * 0.16, 'red', { size: 3.4 }));
        });
      });
    }
    // several labels at once
    const aA = s.ease('attr', 0.6);
    if (aA > 0) {
      s.alpha(aA, () => {
        const names = ['dog', 'beach', 'sunset', 'cat'];
        const y = [1, 1, 0, 0];
        const f = [2.4, 1.9, -1.2, -2.0];
        const e = f.map(Math.exp);
        const sum = e.reduce((a, b) => a + b, 0);
        const soft = e.map((v) => v / sum);
        const sg = f.map(sig);
        const [left, right] = split(s, area(s, s.tall ? 0.3 : 0.34, 0.06), 0.5, 6);
        const bars = (r: Rect, vals: number[], k: K, title: string, a: number) =>
          s.alpha(a, () => {
            const fr = new Frame(s, [r[0], r[1] + u * 4, r[2], r[3] - u * 9], [-0.5, 3.5, 0, 1.15]);
            s.text(title, r[0], r[1], { size: 3.3, font: 'ui', weight: 600, color: s.c(k), align: 'left' });
            s.line(r[0], fr.Y(0), r[0] + r[2], fr.Y(0), s.c('--axis'), 0.3);
            s.line(r[0], fr.Y(1), r[0] + r[2], fr.Y(1), s.tint('--ink-3', 0.5), 0.2, [0.8, 0.8]);
            vals.forEach((v, i) => {
              const bw = fr.kx * 0.6;
              s.rrect(fr.X(i) - bw / 2, fr.Y(v), bw, fr.Y(0) - fr.Y(v), 0.4, { fill: s.tint(k, 0.6) });
              const inside = fr.Y(0) - fr.Y(v) > u * 6;
              s.text(v.toFixed(2), fr.X(i), inside ? fr.Y(v) + u * 2.4 : fr.Y(v) - u * 2, { size: 3, font: 'mono', weight: 600, color: inside ? '#fff' : s.c('--ink-2') });
              s.text(names[i]!, fr.X(i), r[1] + r[3] - u * 1.5, { size: 3.1, font: 'ui', weight: y[i] ? 700 : 400, color: s.c(y[i] ? 'gold' : '--ink-3') });
            });
          });
        bars(left, soft, 'red', 'softmax: must sum to 1', 1);
        bars(right, sg, 'green', 'sigmoids: independent', s.ease('sigmoid', 0.6));
        const lA = s.ease('logloss', 0.6);
        s.show('logl', aA * lA * (1 - s.ease('grad', 0.5)));
        s.alpha(s.win('attr', 'logloss'), () => s.text('labels: dog and beach', w / 2, h * (s.tall ? 0.24 : 0.27), { size: 3.4, italic: true, color: s.c('gold') }));
        // which term is on, and the gradient
        s.alpha(lA, () => {
          const fr = new Frame(s, [right[0], right[1] + u * 4, right[2], right[3] - u * 9], [-0.5, 3.5, 0, 1.15]);
          const gA = s.ease('grad', 0.6);
          const ts = Math.min(2.8, fr.kx / u / 5.8);
          sg.forEach((p, i) => {
            const t = y[i] ? '−log p' : '−log(1−p)';
            s.alpha(1 - gA, () => s.text(t, fr.X(i), fr.Y(1.08), { size: ts, font: 'mono', weight: 600, color: s.c('red'), halo: true }));
            s.alpha(gA, () => {
              const d = p - y[i]!;
              fr.arrow(i + 0.32, p, i + 0.32, p - d * 0.9, s.c('--accent'), 0.45);
              s.text(`${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(2)}`, fr.X(i), fr.Y(1.08), { size: 2.8, font: 'mono', weight: 600, color: s.c('--accent'), halo: true });
            });
          });
          s.alpha(gA, () => s.text('gradient = p − y', w / 2, h * 0.2, { size: 4.2, font: 'mono', weight: 600, color: s.c('--accent') }));
        });
      });
    }
  },
};

// ---------------------------------------------------------------- regression

const regression: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const binA = s.ease('bins', 0.6);
    const outT = s.since('outlier') >= 0 ? smooth(clamp01(s.prog('outlier') * 1.3)) : 0;
    const out: [number, number] = [0.72, lerp(0.55 * 0.72 + 0.12, -0.95, outT)];
    const X = [...REG.xs, out[0]];
    const Y = [...REG.ys, out[1]];
    const f2 = fitL2(X, Y);
    const f1 = fitL1(X, Y);
    const d2 = f2[0] * out[0] + f2[1] - out[1];
    const d1 = f1[0] * out[0] + f1[1] - out[1];
    s.slot('g2', s.since('outlier') >= 0 ? fmt(2 * d2, 2) : '…');
    s.slot('g1', s.since('outlier') >= 0 ? fmt(Math.sign(d1) || 1, 1) : '…');
    if (binA < 1) {
      s.alpha(1 - binA, () => {
        const fr = new Frame(s, area(s, 0.12, 0.05), [-1.25, 1.25, -1.15, 1.05], true);
        fr.grid(0.5, 1);
        const l1On = s.since('l1fit') >= 0;
        const resA = s.win('l2l1', 'outlier');
        s.alpha(resA, () => X.forEach((x, i) => s.line(fr.X(x), fr.Y(Y[i]!), fr.X(x), fr.Y(f2[0] * x + f2[1]), s.tint('blue', 0.5), 0.3)));
        // the pull of each point on the line
        const pA = s.win('grads', 'l1fit') + s.win('fragile', 'bins');
        s.alpha(pA, () =>
          X.forEach((x, i) => {
            const r2 = Y[i]! - (f2[0] * x + f2[1]);
            const big = i === X.length - 1;
            if (s.since('fragile') >= 0 && !big) return;
            fr.arrow(x - 0.025, f2[0] * x + f2[1], x - 0.025, f2[0] * x + f2[1] + r2 * 0.9, s.c('blue'), 0.4);
            fr.arrow(x + 0.025, f1[0] * x + f1[1], x + 0.025, f1[0] * x + f1[1] + Math.sign(Y[i]! - (f1[0] * x + f1[1])) * 0.12, s.c('green'), 0.4);
          }),
        );
        fr.fn((x) => f2[0] * x + f2[1], s.c('blue'), l1On ? 0.4 : 0.65);
        s.alpha(s.ease('l2l1', 0.6), () => fr.fn((x) => f1[0] * x + f1[1], s.c('green'), l1On ? 0.7 : 0.35));
        REG.xs.forEach((x, i) => fr.dot(x, REG.ys[i]!, 1.1, s.c('orange'), true));
        fr.dot(out[0], out[1], 1.6, s.c('red'), true);
        s.alpha(s.ease('outlier', 0.5), () => s.text('outlier', fr.X(out[0]) + u * 3, fr.Y(out[1]), { size: 3.4, font: 'mono', weight: 600, color: s.c('red'), align: 'left', halo: true }));
        // legend
        const lx = fr.box[0] + u;
        const ly = fr.box[1] + u * 2.6;
        s.text('L2 fit: Σ diff²', lx, ly, { size: 3.4, font: 'mono', weight: 600, color: s.c('blue'), align: 'left', halo: true });
        s.alpha(s.ease('l2l1', 0.6), () => s.text('L1 fit: Σ |diff|', lx, ly + u * 5, { size: 3.4, font: 'mono', weight: 600, color: s.c('green'), align: 'left', halo: true }));
        s.alpha(s.win('grads', 'outlier'), () => s.text('arrows: how hard each point pulls', fr.box[0] + fr.box[2] - u, fr.box[1] + fr.box[3] - u * 2.4, { size: 3.1, italic: true, color: s.c('--ink-2'), align: 'right', halo: true }));
      });
    }
    if (binA > 0) {
      s.alpha(binA, () => {
        const sA = s.ease('struct', 0.6);
        s.alpha(1 - sA, () => {
          const pr = [0.04, 0.08, 0.22, 0.46, 0.2];
          const fr = new Frame(s, [w * 0.14, h * 0.3, w * 0.72, h * 0.46], [0.4, 5.6, 0, 0.55]);
          s.text('a star rating, as five classes', w / 2, h * 0.2, { size: 4.2, font: 'display', weight: 560 });
          s.line(fr.X(0.4), fr.Y(0), fr.X(5.6), fr.Y(0), s.c('--axis'), 0.3);
          pr.forEach((p, i) => {
            const a = s.ease('bins', 0.4, 0.8 + i * 0.25);
            s.alpha(a, () => {
              const bw = fr.kx * 0.62;
              s.rrect(fr.X(i + 1) - bw / 2, fr.Y(p), bw, fr.Y(0) - fr.Y(p), 0.5, { fill: s.tint('purple', i === 3 ? 0.75 : 0.4) });
              s.text(p.toFixed(2), fr.X(i + 1), fr.Y(p) - u * 2.2, { size: 3, font: 'mono', color: s.c('--ink-2') });
              s.text(`${'★'.repeat(i + 1)}`, fr.X(i + 1), fr.Y(0) + u * 3.4, { size: 2.8, color: s.c('gold') });
            });
          });
          s.alpha(s.ease('bins', 0.6, 3.2), () => s.text('and a confidence for free', w / 2, h * 0.88, { size: 3.6, italic: true, color: s.c('purple') }));
        });
        s.alpha(sA, () => {
          const cx = w / 2;
          const cy = h * 0.46;
          const pts: [number, number][] = [[0, -1], [-1.2, 0], [1.2, 0], [-1.8, 1], [-0.6, 1], [0.6, 1], [1.8, 1]];
          const edges = [[0, 1], [0, 2], [1, 3], [1, 4], [2, 5], [2, 6]];
          const sc = Math.min(w * 0.14, h * 0.15);
          for (const [a, b] of edges) s.line(cx + pts[a!]![0] * sc, cy + pts[a!]![1] * sc, cx + pts[b!]![0] * sc, cy + pts[b!]![1] * sc, s.tint('slate', 0.7), 0.4);
          pts.forEach(([x, y]) => s.circle(cx + x * sc, cy + y * sc, u * 2.2, { fill: s.tint('slate', 0.3), stroke: s.c('slate'), lw: 0.35 }));
          s.text('a whole structure as the label', cx, h * 0.18, { size: 4.2, font: 'display', weight: 560 });
          s.text('structured SVM, special solvers', cx, h * 0.82, { size: 3.6, italic: true, color: s.c('slate') });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- outro

const outro: SceneDef = {
  draw(s) {
    const { w, h } = s;
    const keys = ['pre', 'init', 'bn', 'reg', 'loss'];
    const rA = 1 - s.ease('theme', 0.6);
    if (rA > 0) {
      const cur = keys.findIndex((k, i) => s.since(k) >= 0 && (i === keys.length - 1 ? s.since('theme') < 0 : s.since(keys[i + 1]!) < 0));
      const done = keys.reduce((a, k) => a + (s.since(k) >= 0 ? 1 : 0), 0);
      s.alpha(rA, () => topicRows(s, area(s, 0.13, 0.05), () => s.ease('recap', 0.6), (i) => (i === cur ? 1 : 0), (done - 0.001) / keys.length));
    }
    const tA = s.ease('theme', 0.6);
    if (tA > 0) {
      s.alpha(tA, () => {
        const nA = s.ease('next', 0.7);
        s.alpha(1 - nA, () => {
          pill(s, 'keep signals at a healthy scale', w / 2, h * 0.38, 'purple', { size: 4.4 });
          s.alpha(s.ease('theme', 0.5, 1.6), () => pill(s, 'do not let the network memorize', w / 2, h * 0.58, 'gold', { size: 4.4 }));
        });
        s.alpha(nA, () => {
          s.text('next: the interactive chapter', w / 2, h * 0.42, { size: 6, font: 'display', weight: 600 });
          s.text('every figure, yours to drag, with its code beside it', w / 2, h * 0.55, { size: 3.8, italic: true, color: s.c('--ink-2') });
          s.alpha(s.ease('next', 0.6, 3), () => s.text('then chapter 9: the training run itself', w / 2, h * 0.7, { size: 3.8, font: 'display', italic: true, color: s.c('--accent') }));
        });
      });
    }
  },
};

export const scenesC: Record<string, SceneDef> = { penalties, dropout, losses, regression, outro };

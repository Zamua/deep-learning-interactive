import { fmt } from '../../core/code';
import { Rng } from '../../core/rand';
import { type Scene, type SceneDef, clamp01, lerp } from '../../lecture/scene';
import { decades } from '../../lib/scaling-laws-chart';
import { MODELS, SURF, count, logspace, lossND, optimum, tokensFor } from '../../lib/scaling-laws-math';
import { type K, area, axes, bar, card, chart, curve, current, dot, fitSize, loglerp, poly, split, sup } from './kit';

const pow10 = (v: number): string => `10^${Math.round(Math.log10(v))}`;

// ---------------------------------------------------------------- chinchilla

const CH_RUNS = (() => {
  const r = new Rng(22);
  return Array.from({ length: 400 }, () => [10 ** r.uniform(Math.log10(7e7), Math.log10(1.6e10)), 10 ** r.uniform(Math.log10(5e9), Math.log10(5e11))] as [number, number]);
})();

const chinchilla: SceneDef = {
  marks: { formula: { tex: String.raw`\symL(\symN,\symD) = \symE + \frac{A}{\symN^{\symalpha}} + \frac{B}{\symD^{\symbeta}}`, x: 0.5, y: 0.25, size: 6 } },
  draw(s) {
    const { w, h, u } = s;
    const R = area(s);
    const pA = s.win('paper', 'formula');
    if (pA > 0)
      s.alpha(pA, () => {
        const t = 'Hoffmann et al., 2022 (DeepMind)';
        s.text(t, w / 2, R[1] + 3 * u, { size: fitSize(s, t, 5, w * 0.9, 'display', 600), font: 'display', weight: 600 });
        const sub = 1 - 0.75 * s.ease('sched', 0.6);
        const ra = s.ease('runs', 0.5) * (1 - s.ease('three', 0.6));
        if (ra > 0)
          s.alpha(ra * sub, () => {
            const fr = chart(s, [R[0], R[1] + 8 * u, R[2], R[3] - 8 * u], { lo: 5e7, hi: 3e10, log: true }, { lo: 3e9, hi: 1e12, log: true });
            axes(s, fr, { xTicks: decades(1e8, 1e10), yTicks: decades(1e10, 1e12), xFmt: count, yFmt: count, xLabel: 'parameters N', xCol: 'blue', yLabel: 'tokens D', yCol: 'orange' });
            const n = Math.round(clamp01(s.prog('runs') * 1.15) * CH_RUNS.length);
            for (let i = 0; i < n; i++) s.circle(fr.X(CH_RUNS[i]![0]), fr.Y(CH_RUNS[i]![1]), 0.55 * u, { fill: s.tint('red', 0.55) });
            s.text(`${n} training runs`, fr.right - 1 * u, fr.top + 3 * u, { size: 3.4, font: 'mono', align: 'right', weight: 600, color: s.c('red'), halo: true });
          });
        s.alpha(s.win('sched', 'three'), () => {
          const bw = Math.min(w * 0.8, 90 * u);
          const bh = Math.min(h * 0.4, 42 * u);
          const x0 = (w - bw) / 2;
          const y0 = h * 0.32;
          card(s, x0, y0, bw, bh, 'slate', 0.3);
          s.text('learning rate', x0 + 3 * u, y0 + 4 * u, { size: 3, font: 'ui', align: 'left', color: s.c('--ink-2') });
          s.text('tokens', x0 + bw - 3 * u, y0 + bh - 3 * u, { size: 3, font: 'ui', align: 'right', color: s.c('--ink-2') });
          [0.33, 0.62, 1].forEach((len, i) => {
            const c = s.ctx;
            c.beginPath();
            for (let k = 0; k <= 60; k++) {
              const f = k / 60;
              const x = x0 + 6 * u + f * len * (bw - 12 * u);
              const y = y0 + 8 * u + (1 - 0.5 * (1 + Math.cos(Math.PI * f))) * (bh - 16 * u);
              if (k) c.lineTo(x, y);
              else c.moveTo(x, y);
            }
            c.strokeStyle = s.tint('teal', 0.45 + 0.25 * i);
            c.lineWidth = 0.55 * u;
            c.stroke();
          });
          const t = 'each schedule ends when its run ends';
          s.text(t, w / 2, y0 + bh + 5 * u, { size: fitSize(s, t, 3.6, w * 0.9, 'ui'), font: 'ui', color: s.c('teal') });
        });
        s.alpha(s.ease('three', 0.6), () => {
          const items = ['the frontier', 'isoFLOP valleys', 'a fitted formula'];
          const tall = s.tall;
          const cw = tall ? Math.min(R[2] * 0.8, 70 * u) : (R[2] - 6 * u) / 3;
          const ch = 10 * u;
          items.forEach((it, i) => {
            const a = s.ease('three', 0.5, 0.3 + i * 0.5);
            const x = tall ? (w - cw) / 2 : R[0] + i * (cw + 3 * u);
            const y = tall ? h * 0.3 + i * (ch + 3 * u) : h * 0.38;
            s.alpha(a, () => {
              card(s, x, y, cw, ch, 'teal', 0.4);
              s.text(`${i + 1}. ${it}`, x + cw / 2, y + ch / 2, { size: fitSize(s, `${i + 1}. ${it}`, 3.6, cw * 0.9, 'ui'), font: 'ui' });
            });
          });
          s.alpha(s.ease('three', 0.6, 2.2), () => {
            const yb = tall ? h * 0.3 + 3 * (ch + 3 * u) + 4 * u : h * 0.62;
            const bw = Math.min(R[2], 90 * u);
            card(s, (w - bw) / 2, yb, bw, 11 * u, 'green', 0.8);
            const t = 'all agree: N and D grow together';
            s.text(t, w / 2, yb + 5.5 * u, { size: fitSize(s, t, 4, bw * 0.9), weight: 600, color: s.c('--ink') });
          });
        });
      });
    const fA = s.ease('formula', 0.7);
    s.show('formula', fA);
    if (fA > 0)
      s.alpha(fA, () => {
        const grow = (from: number, to: number, a: number) => loglerp(from, to, a);
        const N = s.since('neither') >= 0 ? grow(1e11, 1e12, s.ease('neither', 3)) : grow(1e8, 1e11, s.ease('a', 2.5));
        const D = s.since('neither') >= 0 ? grow(2e12, 2e13, s.ease('neither', 3)) : grow(2e9, 2e12, s.ease('b', 2.5));
        const tE = SURF.E;
        const tN = SURF.A / N ** SURF.alpha;
        const tD = SURF.B / D ** SURF.beta;
        const W = Math.min(w * 0.86, 120 * u);
        const x0 = (w - W) / 2;
        const sc = W / 5.2;
        const y = h * 0.52;
        const bh = 9 * u;
        const segs: [number, K, string, string][] = [
          [tE, 'green', 'E', 'e'],
          [tN, 'blue', 'A/N^α', 'a'],
          [tD, 'orange', 'B/D^β', 'b'],
        ];
        let x = x0;
        const live = current(s, ['formula', 'e', 'a', 'b', 'exps']);
        s.text('loss L, in nats', x0, y - bh / 2 - 7 * u, { size: 3.2, font: 'ui', align: 'left', color: s.c('red') });
        segs.forEach(([v, k, name, beat]) => {
          const on = live === beat ? 1 : 0;
          const len = v * sc;
          s.rrect(x, y - bh / 2, len, bh, 0.8, { fill: s.tint(k, 0.3 + 0.35 * on), stroke: s.tint(k, 0.9), lw: 0.3 });
          if (len > 9 * u) sup(s, name, x + len / 2, y, s.c('--ink'), 3.2, 'center', 600);
          if (len > 9 * u) s.text(fmt(v, 2), x + len / 2, y + bh / 2 + 3.5 * u, { size: 3, font: 'mono', color: s.c(k) });
          x += len;
        });
        s.text(`= ${fmt(tE + tN + tD, 3)}`, Math.min(x + 1.5 * u, x0 + W - 1 * u), y - bh / 2 - 3 * u, { size: 3.4, font: 'mono', align: x + 18 * u > x0 + W ? 'right' : 'left', weight: 600, color: s.c('red') });
        const ry = y + bh / 2 + 11 * u;
        s.text(`N = ${count(N, 2)}`, w / 2 - 3 * u, ry, { size: 3.8, font: 'mono', align: 'right', weight: 600, color: s.c('blue') });
        s.text(`D = ${count(D, 2)}`, w / 2 + 3 * u, ry, { size: 3.8, font: 'mono', align: 'left', weight: 600, color: s.c('orange') });
        s.alpha(s.win('exps', 'approx'), () => s.text('fit: α ≈ 0.34, β ≈ 0.28, both near 0.3', w / 2, ry + 8 * u, { size: fitSize(s, 'fit: α ≈ 0.34, β ≈ 0.28, both near 0.3', 3.6, w * 0.9, 'mono'), font: 'mono', color: s.c('teal') }));
        s.alpha(s.ease('approx', 0.6), () => {
          const t = 'from here: illustrative E = 1.7, A = 400, B = 980, α = β = 0.3';
          s.text(t, w / 2, ry + 8 * u, { size: fitSize(s, t, 3.4, w * 0.92, 'mono'), font: 'mono', color: s.c('--ink-2') });
        });
      });
  },
};

// ---------------------------------------------------------------- budget

const C0 = 5.8e23;
const LEVELS = [2.0, 2.2, 2.5, 3.0, 3.5, 4.0, 5.0];
const LABELED = [2.0, 2.5, 3.0, 4.0];

function budgetC(s: Scene): number {
  if (s.since('diag') >= 0) return loglerp(1e19, 3e25, s.ease('diag', Math.max(1, s.end('diag') - s.at('diag'))));
  if (s.since('grow') >= 0) return loglerp(C0, 3e25, s.ease('grow', 3));
  return C0;
}

const budget: SceneDef = {
  draw(s) {
    const { u } = s;
    const R = area(s);
    const vIn = s.ease('valley', 1.2);
    const [P, V] = split(s, R, lerp(0.999, s.tall ? 0.6 : 0.56, vIn), 3);
    const C = budgetC(s);
    const o = optimum(SURF, C);
    const along = (n: number) => lossND(SURF, n, C / (6 * n));
    const fr = chart(s, P, { lo: 1e7, hi: 1e13, log: true }, { lo: 1e8, hi: 1e14, log: true }, { r: 7 });
    // heat map: darker red is lower loss
    s.alpha(s.ease('contours', 1), () => {
      const cell = 7;
      const cols = Math.ceil((fr.right - fr.left) / cell);
      const rows = Math.ceil((fr.bottom - fr.top) / cell);
      const img = new ImageData(cols, rows);
      const hex = s.c('red');
      const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      for (let j = 0; j < rows; j++)
        for (let i = 0; i < cols; i++) {
          const L = lossND(SURF, fr.ix(fr.left + (i + 0.5) * cell), fr.iy(fr.top + (j + 0.5) * cell));
          const a = Math.max(0, Math.min(1, (5.5 - L) / 3.6)) ** 1.4;
          const q = (j * cols + i) * 4;
          img.data[q] = rgb[0]!;
          img.data[q + 1] = rgb[1]!;
          img.data[q + 2] = rgb[2]!;
          img.data[q + 3] = Math.round(34 * a);
        }
      const tmp = document.createElement('canvas');
      tmp.width = cols;
      tmp.height = rows;
      tmp.getContext('2d')!.putImageData(img, 0, 0);
      fr.clip(s.ctx, () => {
        s.ctx.imageSmoothingEnabled = true;
        s.ctx.drawImage(tmp, fr.left, fr.top, cols * cell, rows * cell);
      });
    });
    axes(s, fr, { xTicks: decades(1e7, 1e13, s.tall ? 2 : 1), yTicks: decades(1e8, 1e14, 2), xFmt: count, yFmt: count, xLabel: 'parameters N', xCol: 'blue', yLabel: 'tokens D', yCol: 'orange' });
    const Ns = logspace(7, 13, 160);
    s.alpha(s.ease('contours', 1), () => {
      for (const L of LEVELS) {
        poly(s, fr, Ns, Ns.map((n) => tokensFor(SURF, n, L)), s.tint('red', 0.45), 0.25);
        const y = tokensFor(SURF, 1e13, L);
        if (LABELED.includes(L) && y > 1e8 && y < 1e14 && (fr.bottom - fr.top) / 6 > 3.2 * u * 0.9) s.text(String(L), fr.right + 1 * u, fr.Y(y), { size: 2.8, font: 'mono', align: 'left', color: s.tint('red', 0.85) });
      }
    });
    const diagA = s.ease('diag', 0.8);
    s.alpha(diagA, () => {
      poly(s, fr, [1e7, 5e12], [2e8, 1e14], s.c('--ink-3'), 0.35, [1, 0.8]);
      s.text('D = 20 N', fr.X(4e8) - 1 * u, fr.Y(8e9) - 1 * u, { size: 3, font: 'ui', align: 'right', base: 'bottom', color: s.c('--ink-2'), halo: true });
    });
    const lp = s.ease('line', 1.4);
    if (lp > 0) {
      poly(s, fr, [loglerp(1e7, 1e13, 0), loglerp(1e7, 1e13, lp)], [C / 6e7, C / (6 * loglerp(1e7, 1e13, lp))], s.c('purple'), 0.6);
      s.alpha(s.ease('line', 0.5, 1.2) * (1 - s.ease('walk', 0.5)), () => {
        const nx = Math.max(1.4e9, C / 6e14 * 1.5);
        s.text('C = 6ND', fr.X(nx) + 1 * u, fr.Y(C / (6 * nx)), { size: 3.3, font: 'ui', align: 'left', weight: 600, color: s.c('purple'), halo: true });
      });
    }
    // the walker, along the line
    const wp = s.since('valley') >= 0 && s.since('touch') < 0 ? s.prog('valley') : s.prog('walk');
    const walkOn = s.since('walk') >= 0 && s.since('touch') < 0;
    const Nw = loglerp(1.2e9, 8e12, wp);
    if (walkOn) dot(s, fr.X(Nw), fr.Y(C / (6 * Nw)), 1.6, s.c('blue'));
    s.alpha(s.win('walk', 'valley'), () => {
      const nTop = C / (6 * 6e13);
      s.text('tiny model', fr.X(nTop) + 3 * u, fr.Y(6e13) - 0.5 * u, { size: 3.1, font: 'ui', align: 'left', color: s.c('--ink'), halo: true });
      s.text('starved for data', fr.right - 1 * u, fr.Y(C / 6e13) + 4.5 * u, { size: 3.1, font: 'ui', align: 'right', color: s.c('--ink'), halo: true });
    });
    const tA = s.ease('touch', 0.6);
    s.alpha(tA, () => {
      poly(s, fr, Ns, Ns.map((n) => tokensFor(SURF, n, o.L)), s.c('red'), 0.55);
      dot(s, fr.X(o.N), fr.Y(o.D), 1.6, s.c('red'));
    });
    if (s.since('diag') >= 0)
      for (let e = 19; e <= Math.log10(C); e += 0.5) {
        const q = optimum(SURF, 10 ** e);
        dot(s, fr.X(q.N), fr.Y(q.D), 0.9, s.tint('red', 0.7));
      }
    s.alpha(s.win('answer', 'grow'), () => s.text('best: 70B params, 1.4T tokens', fr.left + 2 * u, fr.bottom - 3 * u, { size: fitSize(s, 'best: 70B params, 1.4T tokens', 3.3, fr.rect[2] * 0.92, 'mono', 600), font: 'mono', align: 'left', weight: 600, color: s.c('red'), halo: true }));
    const gN = Math.sqrt(C / 6 / 1.7);
    s.alpha(s.win('gpt3', 'grow'), () => dot(s, fr.X(gN), fr.Y(C / (6 * gN)), 1.4, s.c('--ink-2')));
    // the valley
    const vA = s.ease('valley', 0.6);
    if (vA > 0)
      s.alpha(vA, () => {
        const lo = o.L - 0.25;
        const hi = o.L + 1.1;
        const fv = chart(s, V, { lo: 1e8, hi: 1e13, log: true }, { lo, hi }, { r: 2 });
        const st = 0.5;
        const yt: number[] = [];
        for (let v = Math.ceil(lo / st) * st; v <= hi; v += st) yt.push(Number(v.toFixed(1)));
        axes(s, fv, { xTicks: decades(1e8, 1e13, s.tall ? 2 : 1), yTicks: yt, xFmt: count, yFmt: (v) => fmt(v, 2), yLabel: 'loss along the line', yCol: 'red' });
        const to = s.since('touch') >= 0 ? 1e13 : loglerp(1.2e9, 8e12, s.prog('valley'));
        curve(s, fv, along, s.c('red'), 0.65, { from: 1e8, to, n: 160 });
        if (walkOn && s.since('valley') >= 0) dot(s, fv.X(Nw), fv.Y(along(Nw)), 1.5, s.c('blue'));
        s.alpha(tA, () => dot(s, fv.X(o.N), fv.Y(o.L), 1.6, s.c('red')));
        s.alpha(s.win('gpt3', 'grow'), () => {
          dot(s, fv.X(gN), fv.Y(along(gN)), 1.4, s.c('--ink-2'));
          s.text("GPT-3's split", fv.X(gN) - 2 * u, fv.Y(along(gN)) - 3.5 * u, { size: 3.1, font: 'ui', align: 'right', color: s.c('--ink-2'), halo: true });
        });
      });
    s.alpha(s.ease('grow', 0.5), () => sup(s, `C = ${fmtC(C)}`, fr.left + 2 * u, fr.top + 3 * u, s.c('purple'), 3.4, 'left', 600));
  },
};

function fmtC(C: number): string {
  const e = Math.floor(Math.log10(C));
  const m = C / 10 ** e;
  return `${fmt(m, 2)} × 10^${e}`;
}

// ---------------------------------------------------------------- twenty

const twenty: SceneDef = {
  marks: {
    nexp: { tex: String.raw`\sym{N}{N_{\text{opt}}} \propto \symC^{\frac{\symbeta}{\symalpha+\symbeta}}`, x: 0.3, y: 0.27, size: 5.6 },
    dexp: { tex: String.raw`\sym{D}{D_{\text{opt}}} \propto \symC^{\frac{\symalpha}{\symalpha+\symbeta}}`, x: 0.72, y: 0.27, size: 5.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    const R = area(s);
    const aA = s.win('why', 'under');
    s.show('nexp', aA * s.ease('why', 0.6));
    s.show('dexp', aA * s.ease('data', 0.6));
    if (aA > 0)
      s.alpha(aA, () => {
        const W = Math.min(w * 0.86, 120 * u);
        const x0 = (w - W) / 2;
        const rows: [string, number, string, string, string][] = [
          ['equal', 0.5, 'α = β: shares 0.5 and 0.5', '× 3.2 N', '× 3.2 D'],
          ['kaplan', 0.73, 'Kaplan: 0.73 and 0.27', '× 5.4 N', '× 1.9 D'],
        ];
        s.alpha(s.ease('equal', 0.6), () => s.text('each 10× of compute splits into', w / 2, h * 0.4, { size: fitSize(s, 'each 10× of compute splits into', 3.6, w * 0.9, 'ui'), font: 'ui', color: s.c('--ink-2') }));
        rows.forEach(([beat, share, name, nl, dl], i) => {
          const a = s.ease(beat, 0.6);
          const y = h * (0.54 + i * 0.2);
          s.alpha(a, () => {
            s.text(name, x0, y - 6.5 * u, { size: 3.4, font: 'ui', align: 'left', weight: 600, color: s.c(i ? 'slate' : 'red') });
            s.rrect(x0, y - 4 * u, W * share, 8 * u, 1, { fill: s.tint('blue', 0.45) });
            s.rrect(x0 + W * share, y - 4 * u, W * (1 - share), 8 * u, 1, { fill: s.tint('orange', 0.45) });
            const lb = s.ease(i ? 'kaplan' : 'tenx', 0.6);
            s.alpha(i ? 1 : lb, () => {
              s.text(nl, x0 + (W * share) / 2, y, { size: 3.6, font: 'mono', weight: 600 });
              s.text(dl, x0 + W * share + (W * (1 - share)) / 2, y, { size: 3.6, font: 'mono', weight: 600 });
            });
          });
        });
      });
    // Gopher and Chinchilla: same area, different shape
    const gA = s.win('under', 'whyk');
    if (gA > 0)
      s.alpha(gA, () => {
        const labH = 14 * u;
        const availH = R[3] - labH - 6 * u;
        const availW = R[2] - 16 * u;
        const k = Math.min(availH / 1400, availW / (280 + 70 + 60));
        const base = R[1] + R[3] - labH;
        const gx = R[0] + 10 * u;
        const cx = gx + 280 * k + 26 * u;
        const ghost = s.win('under', 'test');
        s.line(R[0] + 6 * u, base, R[0] + R[2], base, s.c('--axis'), 0.3);
        s.line(R[0] + 6 * u, base, R[0] + 6 * u, R[1] + 2 * u, s.c('--axis'), 0.3);
        s.text('tokens D', R[0] + 7 * u, R[1] + 2 * u, { size: 3, font: 'ui', align: 'left', base: 'top', color: s.c('orange') });
        s.text('parameters N', R[0] + R[2], base + 3 * u, { size: 3, font: 'ui', align: 'right', color: s.c('blue') });
        s.rrect(gx, base - 300 * k, 280 * k, 300 * k, 0.6, { fill: s.tint('slate', 0.35), stroke: s.c('slate'), lw: 0.4 });
        s.text('Gopher', gx + 140 * k, base - 300 * k - 9 * u, { size: 3.8, font: 'display', weight: 600 });
        s.text('280B × 300B', gx + 140 * k, base - 300 * k - 4 * u, { size: 3, font: 'mono', color: s.c('--ink-2') });
        s.alpha(ghost * 0.9, () => {
          s.ctx.save();
          s.ctx.setLineDash([1.2 * u, 0.9 * u]);
          s.rrect(cx, base - 1400 * k, 70 * k, 1400 * k, 0.6, { stroke: s.c('red'), lw: 0.35 });
          s.ctx.restore();
          s.text('optimal shape?', cx + 70 * k + 2 * u, base - 1400 * k + 3 * u, { size: 3.1, font: 'ui', align: 'left', color: s.c('red') });
        });
        s.alpha(s.ease('test', 0.8), () => {
          const grow = s.ease('test', 1.6);
          s.rrect(cx, base - 1400 * k * grow, 70 * k, 1400 * k * grow, 0.6, { fill: s.tint('red', 0.35), stroke: s.c('red'), lw: 0.4 });
          s.text('Chinchilla', cx + 70 * k + 2.5 * u, base - 1400 * k + 3 * u, { size: 3.8, font: 'display', weight: 600, align: 'left' });
          s.text('70B × 1.4T', cx + 70 * k + 2.5 * u, base - 1400 * k + 8 * u, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-2') });
        });
        s.alpha(s.ease('gopher', 0.6), () => {
          const t = 'same area (compute), different shape';
          s.text(t, w / 2, base + 8.5 * u, { size: fitSize(s, t, 3.8, w * 0.9), italic: true, color: s.c('--ink') });
        });
        s.alpha(s.ease('won', 0.6), () => {
          const tx = cx + 70 * k + 2.5 * u;
          s.text('wins most tasks', tx, base - 1400 * k + 15 * u, { size: 3.2, font: 'ui', align: 'left', weight: 600, color: s.c('green') });
          s.text('¼ the size to run', tx, base - 1400 * k + 20 * u, { size: 3.2, font: 'ui', align: 'left', weight: 600, color: s.c('green') });
        });
      });
    // learning-rate schedules: measured early versus matched
    const lA = s.ease('whyk', 0.7);
    if (lA > 0)
      s.alpha(lA, () => {
        const fr = chart(s, [R[0], R[1] + 2 * u, R[2], R[3] - 14 * u], { lo: 0, hi: 1 }, { lo: 0, hi: 1.08 }, { l: -6 });
        s.line(fr.left, fr.bottom, fr.right, fr.bottom, s.c('--axis'), 0.3);
        s.line(fr.left, fr.top, fr.left, fr.bottom, s.c('--axis'), 0.3);
        s.text('learning rate', fr.left + 1 * u, fr.top - 1 * u, { size: 3, font: 'ui', align: 'left', base: 'bottom', color: s.c('--ink-2') });
        s.text('tokens trained', fr.right, fr.bottom + 3.5 * u, { size: 3, font: 'ui', align: 'right', color: s.c('--ink-2') });
        const stop = 0.38;
        const long = (x: number) => 0.5 * (1 + Math.cos(Math.PI * x));
        const short = (x: number) => (x <= stop ? 0.5 * (1 + Math.cos((Math.PI * x) / stop)) : NaN);
        curve(s, fr, long, s.c('slate'), 0.45, { from: stop, to: 1, dash: [1.2, 0.9] });
        curve(s, fr, long, s.c('slate'), 0.65, { from: 0, to: stop });
        s.line(fr.X(stop), fr.top, fr.X(stop), fr.bottom, s.c('--ink-3'), 0.3, [0.8, 0.8]);
        dot(s, fr.X(stop), fr.Y(long(stop)), 1.5, s.c('slate'));
        s.text('measured here, rate still high', fr.X(stop) + 2 * u, fr.Y(long(stop)) - 3 * u, { size: 3.1, font: 'ui', align: 'left', color: s.c('slate'), halo: true });
        s.alpha(s.ease('sched', 0.6, 1.5), () => {
          curve(s, fr, short, s.c('teal'), 0.7, { from: 0, to: stop, n: 120 });
          dot(s, fr.X(stop), fr.Y(0.001), 1.5, s.c('teal'));
          s.text('matched: fully decayed', fr.X(stop) + 2 * u, fr.Y(0.04) - 3 * u, { size: 3.1, font: 'ui', align: 'left', color: s.c('teal'), halo: true });
        });
        s.alpha(s.ease('lesson', 0.6), () => {
          const t = 'a scaling law is a fact about a recipe';
          s.text(t, w / 2, R[1] + R[3] - 4 * u, { size: fitSize(s, t, 4.2, w * 0.9, 'display', 600), font: 'display', weight: 600, color: s.c('--accent') });
        });
      });
  },
};

// ---------------------------------------------------------------- beyond

const N0 = 7e9;
const TARGET = lossND(SURF, N0, 20 * N0);
const LIFE_N = logspace(8, 12, 260);
const LIFE_TRAIN = LIFE_N.map((n) => 6 * n * tokensFor(SURF, n, TARGET));

function dinfAt(s: Scene): number {
  if (s.since('more') >= 0) return loglerp(1e11, 1e14, s.ease('more', Math.max(1, s.end('more') - s.at('more'))));
  return 1e11;
}

const RATIOS = MODELS.filter((m) => ['GPT-3', 'Gopher', 'Chinchilla', 'LLaMA 7B', 'Llama 3 8B'].includes(m.name));

const beyond: SceneDef = {
  draw(s) {
    const { w, u } = s;
    const R = area(s);
    const rA = s.ease('llama', 0.8);
    s.alpha(1 - rA, () => {
      const fr = chart(s, R, { lo: 1e8, hi: 1e12, log: true }, { lo: 1e19, hi: 1e27, log: true }, { t: 4 });
      axes(s, fr, { xTicks: decades(1e8, 1e12), yTicks: decades(1e19, 1e27, 2), xFmt: count, yFmt: pow10, xLabel: 'parameters N', xCol: 'blue', yLabel: 'compute (FLOPs) for the same loss', yCol: 'purple' });
      const Dinf = dinfAt(s);
      const serve = LIFE_N.map((n) => 2 * n * Dinf);
      const tot = LIFE_TRAIN.map((t, i) => t + serve[i]!);
      const t0 = 6 * N0 * 20 * N0;
      dot(s, fr.X(N0), fr.Y(t0), 1.8, s.c('--ink'), true);
      s.alpha(s.ease('once', 0.6) * (1 - s.ease('serve', 0.5)), () => s.text('20 tokens per parameter: cheapest to train', fr.X(N0), fr.Y(t0) - 4.5 * u, { size: fitSize(s, '20 tokens per parameter: cheapest to train', 3.1, fr.rect[2] * 0.9, 'ui'), font: 'ui', align: 'center', color: s.c('--ink'), halo: true }));
      const sA = s.ease('serve', 0.8);
      s.alpha(sA, () => {
        poly(s, fr, LIFE_N, serve, s.c('slate'), 0.45, [1.4, 1]);
        s.alpha(1 - s.ease('best', 0.5), () => s.text('serving: 2 N per token', fr.X(4e11), fr.Y(2 * 4e11 * Dinf) + 3.5 * u, { size: 3.1, font: 'ui', align: 'right', color: s.c('slate'), halo: true }));
      });
      s.alpha(s.win('trade', 'curve'), () => {
        const t = 'smaller model + more tokens = same loss';
        s.text(t, w / 2, fr.top + 3 * u, { size: fitSize(s, t, 3.6, w * 0.85, 'ui'), font: 'ui', weight: 600, color: s.c('blue'), halo: true });
      });
      const cp = s.ease('curve', 2.2);
      if (cp > 0) {
        const i0 = LIFE_N.findIndex((n) => n >= N0);
        const k = Math.round(i0 * (1 - cp));
        const xs = LIFE_N.slice(k, i0 + 1);
        const ys = LIFE_TRAIN.slice(k, i0 + 1);
        poly(s, fr, xs, ys, s.c('purple'), 0.6);
        s.alpha(s.ease('best', 0.6), () => poly(s, fr, LIFE_N.slice(i0), LIFE_TRAIN.slice(i0), s.c('purple'), 0.6));
        s.alpha(s.ease('curve', 0.6, 1.6), () => s.text('training', fr.X(3e8), fr.Y(6 * 3e8 * tokensFor(SURF, 3e8, TARGET)), { size: 3.1, font: 'ui', align: 'left', color: s.c('purple'), halo: true }));
      }
      const bA = s.ease('best', 0.7);
      if (bA > 0)
        s.alpha(bA, () => {
          poly(s, fr, LIFE_N, tot, s.c('red'), 0.75);
          let bi = 0;
          tot.forEach((v, i) => {
            if (v < tot[bi]!) bi = i;
          });
          const Nb = LIFE_N[bi]!;
          dot(s, fr.X(Nb), fr.Y(tot[bi]!), 1.7, s.c('red'));
          const ratio = tokensFor(SURF, Nb, TARGET) / Nb;
          s.text(`best: ${count(Nb, 2)}, ${Math.round(ratio)} tokens per parameter`, fr.right, fr.bottom - 4 * u, { size: fitSize(s, `best: ${count(Nb, 2)}, ${Math.round(ratio)} tokens per parameter`, 3.5, fr.rect[2] * 0.95, 'mono', 600), font: 'mono', align: 'right', weight: 600, color: s.c('red'), halo: true });
          s.text(`serving ${count(Dinf, 2)} tokens`, fr.right, fr.bottom - 9 * u, { size: 3.2, font: 'mono', align: 'right', color: s.c('slate'), halo: true });
        });
    });
    if (rA > 0)
      s.alpha(rA, () => {
        const nameW = Math.min(R[2] * 0.34, 36 * u);
        const x0 = R[0] + nameW;
        const x1 = R[0] + R[2] - 12 * u;
        const X = (r: number) => x0 + ((Math.log10(r) - -0.2) / (3.6 - -0.2)) * (x1 - x0);
        const rowH = Math.min(11 * u, (R[3] - 14 * u) / RATIOS.length);
        const top = R[1] + 6 * u;
        s.text('training tokens per parameter (log scale)', s.w / 2, R[1] + 1 * u, { size: fitSize(s, 'training tokens per parameter (log scale)', 3.3, s.w * 0.9, 'ui'), font: 'ui', color: s.c('--ink-2') });
        RATIOS.forEach((m, i) => {
          const y = top + i * rowH + rowH / 2;
          const r = m.D / m.N;
          const hl = (m.name === 'LLaMA 7B' && s.since('llama3') < 0) || (m.name === 'Llama 3 8B' && s.since('llama3') >= 0);
          s.text(`${m.name}`, R[0], y - 1.5 * u, { size: 3.4, font: 'ui', align: 'left', weight: 600 });
          s.text(String(m.year), R[0], y + 2.4 * u, { size: 2.8, font: 'mono', align: 'left', color: s.c('--ink-3') });
          bar(s, x0, y, X(r) - x0, rowH * 0.55, 'orange', hl ? 0.8 : 0.4);
          s.text(r >= 100 ? String(Math.round(r)) : fmt(r, 2), X(r) + 1.5 * u, y, { size: 3.2, font: 'mono', align: 'left', weight: 600 });
        });
        s.alpha(s.ease('least', 0.6), () => {
          s.line(X(20), top - 2 * u, X(20), top + rowH * RATIOS.length, s.c('red'), 0.4, [1, 0.8]);
          const t = 'Chinchilla-optimal: a floor, not a target';
          s.text(t, w / 2, top + rowH * RATIOS.length + 5 * u, { size: fitSize(s, t, 3.6, w * 0.9, 'ui'), font: 'ui', weight: 600, color: s.c('red') });
        });
      });
  },
};

// ---------------------------------------------------------------- limits

const pTok = (x: number): number => 0.5 + 0.495 / (1 + Math.exp(-(x - 0.5) * 8));

const limits: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const R = area(s);
    const cA = s.win('one', 'data');
    if (cA > 0)
      s.alpha(cA, () => {
        s.alpha(s.win('one', 'ability'), () => {
          const t = 'one number, the average loss, for one recipe';
          s.text(t, w / 2, h * 0.5, { size: fitSize(s, t, 4.6, w * 0.88, 'display', 600), font: 'display', weight: 600 });
        });
        const pa = s.ease('ability', 0.7);
        if (pa <= 0) return;
        s.alpha(pa, () => {
          const fr = chart(s, R, { lo: 0, hi: 1 }, { lo: 0, hi: 1.02 }, { t: 4 });
          axes(s, fr, { xTicks: [], yTicks: [0, 0.25, 0.5, 0.75, 1], xFmt: String, yFmt: (v) => fmt(v, 2), xLabel: 'scale (log compute)', yLabel: 'probability', xCol: 'purple' });
          curve(s, fr, pTok, s.c('teal'), 0.65, { to: s.ease('ability', 1.8) });
          s.text('per-token accuracy p', fr.X(0.12), fr.Y(pTok(0.12)) - 3.5 * u, { size: 3.2, font: 'ui', align: 'left', color: s.c('teal'), halo: true });
          const ex = s.ease('exact', 1.8);
          if (ex > 0) {
            curve(s, fr, (x) => pTok(x) ** 20, s.c('red'), 0.75, { to: ex, n: 240 });
            s.alpha(s.ease('exact', 0.6, 1.6), () => sup(s, 'whole answer right: p^20', fr.X(0.95), fr.Y(pTok(0.95) ** 20) + 4 * u, s.c('red'), 3.2, 'right', 500, false));
          }
          s.alpha(s.ease('jump', 0.6), () => {
            const x1 = 0.79;
            dot(s, fr.X(0), fr.Y(pTok(0) ** 20), 1.4, s.c('red'));
            s.text('p ≈ 0.5: one in a million', fr.X(0.02), fr.Y(0) - 3.5 * u, { size: 3.1, font: 'mono', align: 'left', color: s.c('red'), halo: true });
            dot(s, fr.X(x1), fr.Y(pTok(x1) ** 20), 1.4, s.c('red'));
            dot(s, fr.X(x1), fr.Y(pTok(x1)), 1.4, s.c('teal'));
            s.text('p = 0.95: 0.36', fr.X(x1) - 2 * u, fr.Y(pTok(x1) ** 20) - 1 * u, { size: 3.1, font: 'mono', align: 'right', color: s.c('red'), halo: true });
          });
          s.alpha(s.ease('emerge', 0.6), () => s.text('looks "emergent"', fr.right - 1 * u, fr.Y(0.06), { size: 3.6, font: 'serif', italic: true, align: 'right', color: s.c('--ink'), halo: true }));
        });
      });
    const items: [string, string, string, K][] = [
      ['data', 'data is finite', 'about 4 epochs of repeats ≈ fresh data', 'orange'],
      ['recipe', 'constants belong to a recipe', 'better recipes shift the whole line down', 'blue'],
      ['other', 'other axes scale too', 'inference compute: thinking longer', 'purple'],
    ];
    const cw = Math.min(w * 0.88, 110 * u);
    items.forEach(([beat, head, sub, k], i) => {
      const a = s.ease(beat, 0.6);
      if (a <= 0) return;
      const y = R[1] + 3 * u + i * 19 * u;
      s.alpha(a, () => {
        card(s, (w - cw) / 2, y, cw, 15 * u, k, current(s, ['data', 'recipe', 'other']) === beat ? 0.8 : 0.2);
        s.text(head, w / 2, y + 5 * u, { size: fitSize(s, head, 4.2, cw * 0.9, 'display', 600), font: 'display', weight: 600 });
        s.text(sub, w / 2, y + 10.5 * u, { size: fitSize(s, sub, 3.4, cw * 0.9, 'ui'), font: 'ui', color: s.c('--ink-2') });
      });
    });
  },
};

// ---------------------------------------------------------------- outro

const outro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const R = area(s);
    const items: [string, string, K][] = [
      ['line', 'power law = straight line on log-log; mind the floor', 'red'],
      ['laws', 'loss falls with N, D and C, until one bottlenecks', 'purple'],
      ['six', 'train ≈ 6ND FLOPs, run ≈ 2N per token', 'teal'],
      ['twenty', 'fixed budget: about 20 tokens per parameter', 'orange'],
      ['longer', 'used a lot: smaller, trained much longer', 'blue'],
    ];
    const fade = 1 - s.ease('next', 0.7);
    const cw = Math.min(w * 0.9, 120 * u);
    const ch = Math.min(10 * u, (R[3] - 4 * 2.5 * u) / 5);
    s.alpha(fade, () =>
      items.forEach(([beat, t, k], i) => {
        const a = s.ease(beat, 0.6);
        if (a <= 0) return;
        const y = R[1] + 2 * u + i * (ch + 2.5 * u);
        s.alpha(a, () => {
          card(s, (w - cw) / 2, y, cw, ch, k, current(s, items.map((x) => x[0])) === beat ? 0.8 : 0.2);
          s.text(t, w / 2, y + ch / 2, { size: fitSize(s, t, 3.8, cw * 0.92, 'ui'), font: 'ui', color: s.c('--ink') });
        });
      }),
    );
    s.alpha(s.ease('next', 0.7, 0.3), () => {
      const t = 'next: the interactive chapter';
      s.text(t, w / 2, h * 0.45, { size: fitSize(s, t, 6.4, w * 0.9, 'display', 600), font: 'display', weight: 600 });
      const sub = 'fit the lines, slide a budget, size a model';
      s.text(sub, w / 2, h * 0.57, { size: fitSize(s, sub, 3.9, w * 0.9), italic: true, color: s.c('--ink-2') });
      s.alpha(s.ease('bye', 0.6), () => s.text('see you there', w / 2, h * 0.7, { size: 4.6, font: 'display', italic: true, color: s.c('--accent') }));
    });
  },
};

export const scenesB: Record<string, SceneDef> = { chinchilla, budget, twenty, beyond, limits, outro };

import { fmt } from '../../core/code';
import { Rng } from '../../core/rand';
import { type Scene, type SceneDef, clamp01, lerp } from '../../lecture/scene';
import { Frame, decades } from '../../lib/scaling-laws-chart';
import { KAPLAN, MODELS, SURF, count, fitPower, kaplanN, kaplanND, logspace, lossND, optimum, sci, syntheticRuns, TRUE_RUNS } from '../../lib/scaling-laws-math';
import { type K, area, axes, bar, card, chart, curve, dot, fitSize, loglerp, poly, sup, tickPx } from './kit';

const pow10 = (v: number): string => `10^${Math.round(Math.log10(v))}`;

// ---------------------------------------------------------------- intro

const INTRO_N = logspace(6, 9, 8);
const introLine = (n: number): number => 6 * (n / 1e6) ** -0.09;
const INTRO_NOISE = (() => {
  const r = new Rng(7);
  return INTRO_N.map(() => r.uniform(-1, 1));
})();

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const R = area(s);
    const tA = s.win('hello', 'y2016');
    s.alpha(tA, () => {
      const t = 'Scaling laws and compute';
      s.text(t, w / 2, h * 0.45, { size: fitSize(s, t, 9, w * 0.86, 'display', 600), font: 'display', weight: 600 });
      s.text('why bigger models get predictably better', w / 2, h * 0.58, { size: fitSize(s, 'why bigger models get predictably better', 4.2, w * 0.86), italic: true, color: s.c('--ink-2') });
    });

    const cA = s.win('y2016', 'question');
    if (cA > 0)
      s.alpha(cA, () => {
        const fr = chart(s, R, { lo: 5e5, hi: 2e11, log: true }, { lo: 1.6, hi: 14, log: true }, { t: 5 });
        axes(s, fr, { xTicks: decades(1e6, 1e11), yTicks: [2, 3, 4, 6], xFmt: count, yFmt: String, xLabel: 'model size N', xCol: 'blue', yLabel: 'loss L', yCol: 'red' });
        const m = s.ease('y2020', 1.4);
        s.alpha(m, () => curve(s, fr, introLine, s.c('red'), 0.5, { from: 1e6, to: 1e9 }));
        INTRO_N.forEach((n, i) => dot(s, fr.X(n), fr.Y(introLine(n) * 10 ** (0.2 * INTRO_NOISE[i]! * (1 - m))), 1.5, s.c('red')));
        const e = s.ease('extend', 1.4);
        if (e > 0) {
          const end = loglerp(1e9, 1e11, e);
          curve(s, fr, introLine, s.c('red'), 0.5, { from: 1e9, to: end, dash: [1.4, 1.1] });
          s.alpha(s.ease('extend', 0.5, 1.2), () => {
            dot(s, fr.X(1e11), fr.Y(introLine(1e11)), 2.2, s.c('purple'), true);
            s.text('predicted before training', fr.X(1e11), fr.Y(introLine(1e11)) - 5 * u, { size: 3.4, align: 'right', color: s.c('purple'), halo: true, font: 'ui' });
          });
        }
        s.alpha(1 - m, () => s.text('2016: bigger is a gamble', fr.left + 2 * u, fr.top + 2 * u, { size: 4.4, align: 'left', base: 'top', font: 'display', weight: 600, halo: true }));
        s.alpha(m, () => s.text('2020: a straight line', fr.left + 2 * u, fr.top + 2 * u, { size: 4.4, align: 'left', base: 'top', font: 'display', weight: 600, halo: true }));
      });

    const bA = s.ease('question', 0.7);
    if (bA > 0)
      s.alpha(bA, () => {
        const sym = s.ease('symbols', 0.6);
        const cy = h * 0.22;
        const bw = Math.min(w * 0.62, 70 * u);
        card(s, w / 2 - bw / 2, cy - 5 * u, bw, 10 * u, 'purple', 1);
        sup(s, 'budget C = 5.8 × 10^23 FLOPs', w / 2, cy, s.c('purple'), fitSize(s, 'budget C = 5.8 × 10^23 FLOPs', 3.8, bw * 0.9, 'mono'), 'center', 600);
        const kids: [number, K, string, string][] = [
          [0.28, 'blue', 'N', 'parameters'],
          [0.72, 'orange', 'D', 'training tokens'],
        ];
        const ky = h * 0.42;
        const kw = Math.min(w * 0.36, 44 * u);
        for (const [fx, k, sy, name] of kids) {
          const x = w * fx;
          s.arrow(w / 2 + (fx - 0.5) * bw * 0.4, cy + 5.5 * u, x, ky - 6.5 * u, s.tint(k, 0.8), 0.45, 2.4);
          card(s, x - kw / 2, ky - 6 * u, kw, 12 * u, k, sym);
          s.alpha(1 - sym, () => s.text('?', x, ky, { size: 7, font: 'display', weight: 600, color: s.c(k) }));
          s.alpha(sym, () => {
            s.text(sy, x, ky - 1.4 * u, { size: 6.4, italic: true, weight: 600, color: s.c(k) });
            s.text(name, x, ky + 3.6 * u, { size: 3.1, font: 'ui', color: s.c('--ink-2') });
          });
        }
        s.alpha(s.ease('loss', 0.6), () => {
          const lw = Math.min(w * 0.7, 76 * u);
          card(s, w / 2 - lw / 2, h * 0.555 - 4.5 * u, lw, 9 * u, 'red', 0.6);
          const t = 'loss L, predicted before training';
          s.text(t, w / 2, h * 0.555, { size: fitSize(s, t, 3.6, lw * 0.9, 'ui'), font: 'ui', color: s.c('red') });
        });
        const chips = ['power laws', 'fitting them', 'C ≈ 6ND', 'Kaplan vs Chinchilla'];
        const two = s.tall;
        chips.forEach((c, i) => {
          const a = s.ease('plan', 0.5, 0.5 + i * 0.7);
          if (a <= 0) return;
          const cols = two ? 2 : 4;
          const gw = R[2];
          const cw = (gw - (cols - 1) * 2.5 * u) / cols;
          const ch = 8.5 * u;
          const x = R[0] + (i % cols) * (cw + 2.5 * u);
          const y = h * (two ? 0.67 : 0.74) + Math.floor(i / cols) * (ch + 2.5 * u);
          const on = s.since('go') >= 0 && i === 0 ? 0.6 + 0.4 * Math.sin(s.since('go') * 5) : 0;
          s.alpha(a, () => {
            card(s, x, y, cw, ch, 'teal', on);
            s.text(c, x + cw / 2, y + ch / 2, { size: fitSize(s, c, 3.4, cw * 0.88, 'ui'), font: 'ui', color: s.c('--ink') });
          });
        });
      });
  },
};

// ---------------------------------------------------------------- power

const powerMarks = {
  law: { tex: String.raw`y = a\,x^{-k}`, x: 0.68, y: 0.24, size: 6 },
  logs: { tex: String.raw`\log y = \log a - k \log x`, x: 0.42, y: 0.74, size: 5 },
};

const power: SceneDef = {
  marks: powerMarks,
  draw(s) {
    const { u } = s;
    const R = area(s);
    const F = tickPx(s);
    const [rx, ry, rw, rh] = [R[0] + F * 3.2, R[1] + F * 0.6, R[2] - F * 3.6, R[3] - F * 3];
    const m = s.ease('log', 1.8);
    const PX = (x: number) => rx + rw * lerp(x / 1000, Math.log10(x) / 3, m);
    const PY = (y: number) => ry + rh * (1 - lerp(y / 11, (Math.log10(Math.max(y, 1e-6)) + 3) / (Math.log10(20) + 3), m));
    const ctx = s.ctx;
    // grid: linear ticks fade out, decades fade in
    const grid = (xs: number[], ys: number[], a: number, xl: (v: number) => string, yl: (v: number) => string) =>
      s.alpha(a, () => {
        for (const x of xs) s.line(PX(x), ry, PX(x), ry + rh, s.c('--grid'), 0.25);
        for (const y of ys) s.line(rx, PY(y), rx + rw, PY(y), s.c('--grid'), 0.25);
        for (const x of xs) sup(s, xl(x), PX(x), ry + rh + F * 1.05, s.c('--ink-3'), F / u, 'center');
        for (const y of ys) sup(s, yl(y), rx - F * 0.45, PY(y), s.c('--ink-3'), F / u, 'right');
      });
    grid([1, 250, 500, 750, 1000], [0.0001, 2, 4, 6, 8, 10], 1 - m, (v) => String(v === 1 ? 0 : v), (v) => (v < 1 ? '0' : String(v)));
    grid([1, 10, 100, 1000], [0.001, 0.01, 0.1, 1, 10], m, String, (v) => (v >= 1 ? String(v) : pow10(v)));
    s.line(rx, ry, rx, ry + rh, s.c('--axis'), 0.3);
    s.line(rx, ry + rh, rx + rw, ry + rh, s.c('--axis'), 0.3);
    s.text('x', rx + rw, ry + rh + F * 2.6, { size: 3, font: 'ui', align: 'right', color: s.c('--ink-2') });
    // curves
    const xs = logspace(0, 3, 300);
    const path = (f: (x: number) => number, col: string, wd: number, dash?: number[]) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(rx, ry - 2, rw + 2, rh + 4);
      ctx.clip();
      ctx.beginPath();
      xs.forEach((x, i) => (i ? ctx.lineTo(PX(x), PY(f(x))) : ctx.moveTo(PX(x), PY(f(x)))));
      ctx.strokeStyle = col;
      ctx.lineWidth = wd * u;
      ctx.setLineDash(dash ? dash.map((d) => d * u) : []);
      ctx.stroke();
      ctx.restore();
    };
    const pw = (x: number) => 10 * x ** -0.5;
    const ex = (x: number) => 10 * Math.exp(-x / 150);
    const eA = s.ease('expo', 0.8);
    s.alpha(eA, () => {
      path(ex, s.c('slate'), 0.55, [1.6, 1.1]);
      s.text('exponential', PX(260), PY(ex(260)) - 3 * u, { size: 3.3, align: 'left', font: 'ui', color: s.c('slate'), halo: true });
    });
    path(pw, s.c('red'), s.since('straight') >= 0 && s.since('why') < 0 ? 0.9 : 0.65);
    s.alpha(s.ease('def', 0.6), () => s.text('power law', PX(1.6) + 1 * u, PY(pw(1.6)) + 4 * u, { size: 3.3, align: 'left', font: 'ui', color: s.c('red'), halo: true }));
    const dA = s.ease('prop', 0.6);
    for (const x of [1, 10, 100, 1000]) s.alpha(dA, () => dot(s, PX(x), PY(pw(x)), 1.4, s.c('red')));
    // the ratio table
    s.alpha(s.win('ex', 'log'), () => {
      const rows: [string, string][] = [['1 → 10', '10 → 3.2'], ['10 → 100', '3.2 → 1'], ['100 → 1000', '1 → 0.32']];
      const tx = rx + rw * 0.36;
      const ty = ry + rh * 0.36;
      s.text('x', tx, ty, { size: 3.4, font: 'mono', align: 'left', color: s.c('--ink-2') });
      s.text('y', tx + 24 * u, ty, { size: 3.4, font: 'mono', align: 'left', color: s.c('red') });
      rows.forEach(([a, b], i) => {
        const yy = ty + (i + 1) * 5.5 * u;
        s.text(a, tx, yy, { size: 3.4, font: 'mono', align: 'left' });
        s.text(b, tx + 24 * u, yy, { size: 3.4, font: 'mono', align: 'left', color: s.c('red') });
        s.text('× 0.32', tx + 46 * u, yy, { size: 3.4, font: 'mono', align: 'left', weight: 600, color: s.c('purple') });
      });
    });
    // slope triangle
    s.alpha(s.win('slope', 'expo'), () => {
      const x0 = PX(10);
      const x1 = PX(100);
      const y0 = PY(pw(10));
      const y1 = PY(pw(100));
      s.line(x0, y0, x1, y0, s.c('--ink-2'), 0.35);
      s.line(x1, y0, x1, y1, s.c('--ink-2'), 0.35);
      s.text('1 decade', (x0 + x1) / 2, y0 - 3 * u, { size: 3.2, font: 'ui', color: s.c('--ink-2'), halo: true });
      s.text('down k = 0.5', x1 + 2 * u, (y0 + y1) / 2, { size: 3.2, font: 'ui', align: 'left', color: s.c('--ink-2'), halo: true });
    });
    s.show('law', s.win('def', 'why'));
    s.show('logs', s.win('why', 'expo'));
  },
};

// ---------------------------------------------------------------- fit

const RUNS = syntheticRuns(3);
const PURE = fitPower(RUNS.N, RUNS.L, false);
const FLOORED = fitPower(RUNS.N, RUNS.L, true);
const TRUTH = TRUE_RUNS.E + TRUE_RUNS.a * 1e11 ** -TRUE_RUNS.k;

const fit: SceneDef = {
  marks: { form: { tex: String.raw`\symL = \symE + a\,\symN^{-k}`, x: 0.66, y: 0.24, size: 5.6 } },
  draw(s) {
    const { u } = s;
    const R = area(s);
    const dim = 1 - 0.75 * s.ease('gpt4', 0.8);
    const fr = chart(s, R, { lo: 5e5, hi: 3e11, log: true }, { lo: 1.4, hi: 4.6, log: true }, { t: 4 });
    s.alpha(dim, () => {
      const ext = s.ease('good', 0.8);
      s.alpha(ext, () => s.rrect(fr.X(1.6e9), fr.top, fr.right - fr.X(1.6e9), fr.bottom - fr.top, 0.5, { fill: s.tint('purple', 0.07) }));
      axes(s, fr, { xTicks: decades(1e6, 1e11), yTicks: [1.5, 2, 3, 4], xFmt: count, yFmt: String, xLabel: 'parameters N', xCol: 'blue', yLabel: 'final loss L', yCol: 'red' });
      s.alpha(s.win('logs', 'fit'), () => {
        s.text('log scale', fr.right - 1 * u, fr.bottom - 3 * u, { size: 3.2, font: 'ui', align: 'right', color: s.c('--accent'), halo: true });
        s.text('log scale', fr.left + 2 * u, fr.top + 3 * u, { size: 3.2, font: 'ui', align: 'left', color: s.c('--accent'), halo: true });
      });
      const pr = s.prog('runs');
      RUNS.N.forEach((n, i) => {
        const a = clamp01((pr * 1.2 - i / 10) * 6);
        s.alpha(a, () => dot(s, fr.X(n), fr.Y(RUNS.L[i]!), 1.4, s.c('red')));
      });
      // the straight line, then its extension
      const fp = s.ease('fit', 1.2);
      const straightA = 1 - 0.65 * s.ease('refit', 0.8);
      if (fp > 0) s.alpha(straightA, () => curve(s, fr, PURE.at, s.c('purple'), 0.55, { from: 7e5, to: loglerp(7e5, 1.6e9, fp) }));
      if (ext > 0) s.alpha(straightA, () => curve(s, fr, PURE.at, s.c('purple'), 0.55, { from: 1.6e9, to: loglerp(1.6e9, 3e11, s.ease('good', 1.4)), dash: [1.4, 1] }));
      s.alpha(s.ease('good', 0.6, 1.2) * (1 - s.ease('refit', 0.6)), () => {
        dot(s, fr.X(1e11), fr.Y(PURE.at(1e11)), 1.6, s.c('purple'));
        s.text(`prediction ${fmt(PURE.at(1e11), 3)}`, fr.X(1e11) - 3 * u, fr.Y(PURE.at(1e11)) + 4 * u, { size: 3.3, font: 'ui', align: 'right', weight: 600, color: s.c('purple'), halo: true });
      });
      s.alpha(s.ease('miss', 0.6), () => {
        dot(s, fr.X(1e11), fr.Y(TRUTH), 2, s.c('--ink'), true);
        s.text(`truth ${fmt(TRUTH, 3)}`, fr.X(1e11) - 3 * u, fr.Y(TRUTH) - 3.5 * u, { size: 3.3, font: 'ui', align: 'right', weight: 600, halo: true });
        s.alpha(1 - s.ease('refit', 0.6), () => s.arrow(fr.X(1e11) + 2.5 * u, fr.Y(PURE.at(1e11)), fr.X(1e11) + 2.5 * u, fr.Y(TRUTH) + 1.5 * u, s.c('red'), 0.4, 2));
      });
      // the floor
      s.alpha(s.ease('floor', 0.8), () => {
        poly(s, fr, [5e5, 3e11], [TRUE_RUNS.E, TRUE_RUNS.E], s.c('green'), 0.4, [1.2, 1]);
        s.text('floor E', fr.left + 2 * u, fr.Y(TRUE_RUNS.E) - 2.5 * u, { size: 3.3, font: 'ui', align: 'left', color: s.c('green'), halo: true });
      });
      const nA = s.win('narrow', 'refit');
      if (nA > 0) {
        let lo = 1e9;
        let hi = 3e11;
        for (let i = 0; i < 40; i++) {
          const mid = Math.sqrt(lo * hi);
          if (PURE.at(mid) > TRUE_RUNS.E) lo = mid;
          else hi = mid;
        }
        const pulse = 0.5 + 0.5 * Math.sin(s.since('narrow') * 6);
        s.alpha(nA, () => s.circle(fr.X(lo), fr.Y(TRUE_RUNS.E), (3 + pulse) * u, { stroke: s.c('red'), lw: 0.45 }));
      }
      const rp = s.ease('refit', 1.4);
      if (rp > 0) {
        curve(s, fr, FLOORED.at, s.c('teal'), 0.65, { from: 7e5, to: loglerp(7e5, 3e11, rp) });
        s.alpha(s.ease('refit', 0.6, 1.3), () => {
          dot(s, fr.X(1e11), fr.Y(FLOORED.at(1e11)), 1.5, s.c('teal'));
          s.text('with a floor: near the truth', fr.right - 1 * u, fr.bottom - 3 * u, { size: 3.3, font: 'ui', align: 'right', weight: 600, color: s.c('teal'), halo: true });
        });
      }
      s.text('synthetic runs', fr.left + 2 * u, fr.bottom - 3 * u, { size: 3, font: 'ui', align: 'left', color: s.c('--ink-3'), halo: true });
    });
    s.show('form', s.win('form', 'gpt4'));
    const gA = s.ease('gpt4', 0.8, 0.3);
    if (gA > 0)
      s.alpha(gA, () => {
        const cw = Math.min(s.w * 0.84, 92 * u);
        const ch = 26 * u;
        const x = (s.w - cw) / 2;
        const y = s.h * 0.55 - ch / 2;
        card(s, x, y, cw, ch, 'purple', 0.5);
        s.text('GPT-4 (2023)', s.w / 2, y + 6.5 * u, { size: 4.4, font: 'display', weight: 600 });
        const t1 = 'final loss predicted before training,';
        const t2 = 'from runs with up to 10,000× less compute';
        const fs = fitSize(s, t2, 3.6, cw * 0.9, 'ui');
        s.text(t1, s.w / 2, y + 14 * u, { size: fs, font: 'ui', color: s.c('--ink-2') });
        s.text(t2, s.w / 2, y + 19.5 * u, { size: fs, font: 'ui', color: s.c('--ink-2') });
      });
  },
};

// ---------------------------------------------------------------- kaplan

const kaplanC = (c: number): number => (1e26 / c) ** 0.05 * 1.6;

const kaplan: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const R = area(s);
    // three laws
    const pA = s.win('paper', 'shape');
    if (pA > 0)
      s.alpha(pA, () => {
        const head = s.ease('paper', 0.6);
        s.alpha(head * (1 - s.ease('three', 0.6)), () => {
          s.text('Kaplan et al., 2020', w / 2, h * 0.42, { size: 6.5, font: 'display', weight: 600 });
          const t = 'transformer language models, up to 1.5B parameters';
          s.text(t, w / 2, h * 0.54, { size: fitSize(s, t, 3.8, w * 0.85), italic: true, color: s.c('--ink-2') });
        });
        const panels: [string, K, number, number, (x: number) => number, string, string][] = [
          ['parameters N', 'blue', 1e5, 1e10, kaplanN, '−0.076', 'n'],
          ['tokens D', 'orange', 1e7, 1e11, (d) => (KAPLAN.Dc / d) ** KAPLAN.aD, '−0.095', 'd'],
          ['compute C', 'purple', 1e15, 1e22, kaplanC, '−0.050', 'd'],
        ];
        const textH = 13 * u;
        const tall = s.tall;
        const gap = 3 * u;
        panels.forEach(([name, k, lo, hi, f, slope, beat], i) => {
          const a = s.ease('three', 0.6, 0.5 + i * 0.6);
          if (a <= 0) return;
          const pw = (R[2] - 2 * gap) / 3;
          const ph = Math.min(R[3] - textH - 4 * u, pw * 0.9);
          const pr: [number, number, number, number] = tall
            ? [R[0], R[1] + i * ((R[3] - textH - 2 * gap) / 3 + gap), R[2], (R[3] - textH - 2 * gap) / 3]
            : [R[0] + i * (pw + gap), R[1] + (R[3] - textH - ph) / 2, pw, ph];
          const on = s.since(beat) >= 0 && s.since('small') < 0 && (beat === 'n' ? s.since('d') < 0 : true) ? 1 : 0;
          s.alpha(a, () => {
            card(s, pr[0], pr[1], pr[2], pr[3], k, on * 0.7);
            const fr = new Frame([pr[0] + 4 * u, pr[1] + 6 * u, pr[2] - 8 * u, Math.max(4 * u, pr[3] - 13 * u)], { lo, hi, log: true }, { lo: 1.3, hi: 9, log: true });
            s.line(fr.left, fr.bottom, fr.right, fr.bottom, s.c('--axis'), 0.25);
            s.line(fr.left, fr.top, fr.left, fr.bottom, s.c('--axis'), 0.25);
            curve(s, fr, f, s.c('red'), 0.6);
            s.text(name, pr[0] + pr[2] - 3 * u, pr[1] + 3.5 * u, { size: 3.2, font: 'ui', align: 'right', color: s.c(k) });
            s.text(`slope ${slope}`, pr[0] + 3 * u, pr[1] + pr[3] - 3.5 * u, { size: 3.3, font: 'mono', align: 'left', weight: 600, color: s.c(k) });
          });
        });
        s.alpha(s.ease('small', 0.6), () => {
          const t = '2× N: loss × 0.95     10× N: loss × 0.84';
          const ch = 11 * u;
          const y = R[1] + R[3] - ch;
          card(s, R[0], y, R[2], ch, 'blue', 0.6);
          s.text(t, w / 2, y + ch / 2, { size: fitSize(s, t, 3.8, R[2] * 0.92, 'mono'), font: 'mono', weight: 600, color: s.c('blue') });
        });
      });
    // three findings
    const fA = s.win('shape', 'bend');
    if (fA > 0)
      s.alpha(fA, () => {
        const items: [string, string, K][] = [
          ['shape', 'shape barely matters: depth vs width', 'slate'],
          ['sample', 'bigger models need fewer tokens per unit of loss', 'blue'],
          ['together', 'N and D must grow together', 'orange'],
        ];
        const cw = Math.min(w * 0.86, 100 * u);
        items.forEach(([b, t, k], i) => {
          const a = s.ease(b, 0.6);
          const y = h * 0.24 + i * 17 * u;
          s.alpha(a, () => {
            card(s, (w - cw) / 2, y, cw, 12 * u, k, s.since(b) >= 0 && (i === 2 || s.since(items[i + 1]![0]) < 0) ? 0.8 : 0.2);
            s.text(t, w / 2, y + 6 * u, { size: fitSize(s, t, 4, cw * 0.9), color: s.c('--ink') });
          });
        });
      });
    // the bend
    const bA = s.ease('bend', 0.8);
    if (bA > 0)
      s.alpha(bA, () => {
        const fr = chart(s, R, { lo: 1e5, hi: 1e11, log: true }, { lo: 1.5, hi: 5.4, log: true }, { t: 4, r: 12 });
        axes(s, fr, { xTicks: decades(1e5, 1e11), yTicks: [2, 3, 4, 5], xFmt: count, yFmt: String, xLabel: 'parameters N', xCol: 'blue', yLabel: 'loss L', yCol: 'red' });
        curve(s, fr, kaplanN, s.c('--ink-2'), 0.45, { dash: [1.4, 1] });
        s.text('unlimited data', fr.X(3e9), fr.Y(kaplanN(3e9)) + 4.5 * u, { size: 3.2, font: 'ui', align: 'center', color: s.c('--ink-2'), halo: true });
        const D = loglerp(1e8, 1e11, s.ease('slide', 2.4));
        curve(s, fr, (n) => kaplanND(n, D), s.c('orange'), 0.75, { to: loglerp(1e5, 1e11, s.ease('bend', 2.2)) });
        s.text(`D = ${count(D, 2)} tokens`, fr.right, fr.top + 2.5 * u, { size: 3.6, font: 'mono', align: 'right', weight: 600, color: s.c('orange'), halo: true });
      });
  },
};

// ---------------------------------------------------------------- flops

const FLOP_MODELS = MODELS.filter((m) => ['GPT-3', 'Gopher', 'Chinchilla', 'Llama 3 8B', 'Llama 3.1 405B'].includes(m.name));

/** One matrix product A @ B = R drawn as tinted cell grids. */
function product(s: Scene, cx: number, cy: number, cs: number, blocks: [number, number, K, string][], lit: number): void {
  const gap = cs * 1.2;
  const widths = blocks.map((b) => b[1] * cs);
  const total = widths.reduce((a, b) => a + b, 0) + 2 * gap;
  let x = cx - total / 2;
  blocks.forEach(([rows, cols, k, name], i) => {
    const y = cy - (rows * cs) / 2;
    const on = i === 2 ? lit : 0.15;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) s.rrect(x + c * cs + 1, y + r * cs + 1, cs - 2, cs - 2, 0.8, { fill: s.tint(k, 0.1 + 0.3 * on), stroke: s.tint(k, 0.5 + 0.5 * on), lw: 0.25 });
    s.text(name, x + (cols * cs) / 2, y - 3 * s.u, { size: 4, italic: true, weight: 600, color: s.c(k) });
    x += widths[i]!;
    if (i < 2) s.text(i === 0 ? '@' : '=', x + gap / 2, cy, { size: 4.2, font: 'mono', color: s.c('--ink-2') });
    x += gap;
  });
}

const flops: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const R = area(s);
    const dA = s.win('flop', 'gpt');
    if (dA > 0)
      s.alpha(dA, () => {
        const step = s.since('bw') >= 0 ? 2 : s.since('bx') >= 0 ? 1 : 0;
        const lit = s.since('fwd') >= 0 ? 1 : 0;
        const cs = Math.min(7.5 * u, R[2] / 15);
        const layouts: [number, number, K, string][][] = [
          [[1, 4, 'orange', 'x'], [4, 3, 'blue', 'W'], [1, 3, 'purple', 'y']],
          [[1, 3, 'teal', 'dy'], [3, 4, 'blue', 'W.T'], [1, 4, 'teal', 'dx']],
          [[4, 1, 'orange', 'x.T'], [1, 3, 'teal', 'dy'], [4, 3, 'teal', 'dW']],
        ];
        const titles = ['forward', 'backward, to the input', 'backward, to the weights'];
        const cy = h * 0.4;
        s.alpha(s.since('fwd') >= 0 ? 1 : 0.35, () => product(s, w / 2, cy, cs, layouts[step]!, lit));
        s.alpha(s.ease('fwd', 0.5), () => s.text(titles[step]!, w / 2, R[1] + 2 * u, { size: 4.2, font: 'display', weight: 600 }));
        s.alpha(1 - s.ease('fwd', 0.5), () => {
          s.text('1 FLOP = one multiply, or one add', w / 2, R[1] + 2 * u, { size: fitSize(s, '1 FLOP = one multiply, or one add', 4.4, w * 0.9, 'display', 600), font: 'display', weight: 600 });
        });
        // tally of six cells
        const tw = Math.min(w * 0.8, 90 * u);
        const tx = (w - tw) / 2;
        const ty = h * 0.7;
        const filled = s.since('bw') >= 0 ? 6 : s.since('bx') >= 0 ? 4 : s.since('fwd') >= 0 ? 2 : 0;
        const infer = s.since('infer') >= 0;
        s.text('FLOPs per weight, per token', w / 2, ty - 5 * u, { size: 3.4, font: 'ui', color: s.c('--ink-2') });
        for (let i = 0; i < 6; i++) {
          const x = tx + (i * tw) / 6;
          const k: K = i < 2 ? 'purple' : 'teal';
          const on = i < filled ? (infer && i >= 2 ? 0.25 : 1) : 0;
          s.rrect(x + 0.6 * u, ty, tw / 6 - 1.2 * u, 8 * u, 1.2, { fill: s.tint(k, 0.06 + 0.4 * on), stroke: s.tint(k, 0.3 + 0.6 * on), lw: 0.3 });
          s.text(['×', '+'][i % 2]!, x + tw / 12, ty + 4 * u, { size: 4, font: 'mono', color: on ? s.c('--ink') : s.c('--ink-3') });
        }
        s.alpha(s.ease('six', 0.6) * (1 - s.ease('infer', 0.5)), () => sup(s, 'training: C ≈ 6 N D', w / 2, ty + 14 * u, s.c('purple'), 5, 'center', 600));
        s.alpha(s.ease('infer', 0.6), () => sup(s, 'inference: ≈ 2 N per token', w / 2, ty + 14 * u, s.c('purple'), fitSize(s, 'inference: ≈ 2 N per token', 4.6, w * 0.9, 'mono', 600), 'center', 600));
      });
    const bA = s.ease('gpt', 0.7);
    if (bA > 0)
      s.alpha(bA, () => {
        const rowH = Math.min(11 * u, (R[3] - 16 * u) / FLOP_MODELS.length);
        const nameW = Math.min(R[2] * 0.36, 40 * u);
        const x0 = R[0] + nameW;
        const x1 = R[0] + R[2] - 3 * u;
        const lo = 21;
        const hi = 26;
        const X = (c: number) => x0 + ((Math.log10(c) - lo) / (hi - lo)) * (x1 - x0);
        const top = R[1] + 7 * u;
        for (let e = lo; e <= hi; e++) {
          s.line(X(10 ** e), top - 1 * u, X(10 ** e), top + rowH * FLOP_MODELS.length, s.c('--grid'), 0.25);
          sup(s, `10^${e}`, X(10 ** e), top - 3.5 * u, s.c('--ink-3'), 2.9);
        }
        const split = s.ease('split', 0.6);
        FLOP_MODELS.forEach((m, i) => {
          const y = top + i * rowH + rowH / 2;
          const C = 6 * m.N * m.D;
          const on = (i === 0 && s.since('same') < 0) || (s.since('same') >= 0 && i < 4) ? 1 : 0.35;
          s.alpha(on, () => {
            s.text(m.name, R[0], y - (split > 0 ? 1.6 * u : 0), { size: 3.4, font: 'ui', align: 'left', weight: 600 });
            s.alpha(split, () => {
              s.text(count(m.N), R[0], y + 2.6 * u, { size: 3, font: 'mono', align: 'left', color: s.c('blue') });
              const nw = s.measure(count(m.N), { size: 3, font: 'mono' });
              s.text(`× ${count(m.D)}`, R[0] + nw + 1 * u, y + 2.6 * u, { size: 3, font: 'mono', align: 'left', color: s.c('orange') });
            });
            bar(s, x0, y, X(C) - x0, rowH * 0.55, 'purple', i === 0 && s.since('same') < 0 ? 0.75 : 0.45);
            const lab = sci(C, 2, true);
            const lw = sup(s, lab, -1e4, -1e4, s.c('--ink'), 3.1, 'left', 600);
            const inside = X(C) + 1.5 * u + lw > R[0] + R[2];
            sup(s, lab, inside ? X(C) - 1.5 * u : X(C) + 1.5 * u, y, s.c('--ink'), 3.1, inside ? 'right' : 'left', 600);
          });
        });
        s.alpha(s.win('days', 'same'), () => {
          const t = '≈ 9,100 GPU-days at 400 TFLOP/s';
          s.text(t, s.w / 2, top + rowH * FLOP_MODELS.length + 5 * u, { size: fitSize(s, t, 3.8, s.w * 0.9, 'ui'), font: 'ui', weight: 600, color: s.c('purple') });
        });
        s.alpha(s.ease('same', 0.6), () => {
          const xa = X(3e23);
          const xb = X(7.5e23);
          const yb = top + rowH * 4 + 1 * u;
          s.line(xa, yb, xb, yb, s.c('red'), 0.4);
          s.line(xa, yb, xa, yb - 1.5 * u, s.c('red'), 0.4);
          s.line(xb, yb, xb, yb - 1.5 * u, s.c('red'), 0.4);
          const t = 'GPT-3 to Llama 3 8B: within 2.5×';
          s.text(t, s.w / 2, top + rowH * FLOP_MODELS.length + 5 * u, { size: fitSize(s, t, 3.6, s.w * 0.9, 'ui'), font: 'ui', weight: 600, color: s.c('red') });
        });
      });
  },
};

// ---------------------------------------------------------------- frontier

const SIZES = logspace(7, 11, 9);

const frontier: SceneDef = {
  marks: { kap: { tex: String.raw`\sym{N}{N_{\text{opt}}} \propto \symC^{\,0.73} \qquad \sym{D}{D_{\text{opt}}} \propto \symC^{\,0.27}`, x: 0.42, y: 0.66, size: 4.8 } },
  draw(s) {
    const { w, u } = s;
    const R = area(s);
    const cardsA = s.ease('race', 0.8);
    const m = s.ease('straight', 1.6);
    const off = SURF.E * m;
    const lo = 10 ** lerp(Math.log10(1.8), Math.log10(0.1), m);
    const hi = 10 ** lerp(Math.log10(8), Math.log10(7), m);
    s.alpha(1 - 0.94 * cardsA, () => {
      const fr = chart(s, R, { lo: 1e16, hi: 1e24, log: true }, { lo, hi, log: true }, { t: 4 });
      axes(s, fr, { xTicks: decades(1e16, 1e24, 2), yTicks: [], xFmt: pow10, yFmt: String, xLabel: 'training compute C (FLOPs)', xCol: 'purple', yLabel: m > 0.5 ? 'L − E' : 'loss L', yCol: 'red' });
      const tick = (vals: number[], a: number) =>
        s.alpha(a, () => {
          for (const v of vals) if (v >= lo && v <= hi) sup(s, String(v), fr.left - tickPx(s) * 0.45, fr.Y(v), s.c('--ink-3'), tickPx(s) / u, 'right');
        });
      tick([2, 3, 4, 6, 8], clamp01(1 - m * 3));
      tick([0.1, 0.2, 0.5, 1, 2, 5], clamp01(m * 3 - 2));
      const Cb = s.since('move') >= 0 ? loglerp(1e18, 1e23, s.ease('move', 3.5)) : 0;
      let bi = -1;
      if (Cb) {
        bi = 0;
        SIZES.forEach((N, i) => {
          if (lossND(SURF, N, Cb / (6 * N)) < lossND(SURF, SIZES[bi]!, Cb / (6 * SIZES[bi]!))) bi = i;
        });
      }
      const Ds = logspace(8, 13, 100);
      const one = s.ease('one', 2);
      const many = s.ease('many', 1.2);
      SIZES.forEach((N, i) => {
        const first = i === 4;
        const a = first ? 1 : many;
        if (a <= 0) return;
        const n = first ? Math.max(2, Math.round(one * 100)) : 100;
        const hl = i === bi || (first && s.since('many') < 0) || (s.since('cross') >= 0 && s.since('env') < 0 && (i === 0 || i === 8));
        s.alpha(a, () => poly(s, fr, Ds.slice(0, n).map((d) => 6 * N * d), Ds.slice(0, n).map((d) => lossND(SURF, N, d) - off), s.tint('blue', hl ? 1 : 0.35), hl ? 0.6 : 0.3));
        if (Math.abs(Math.log10(N) % 1) < 1e-6 && N < 1e11 && (first || many > 0.5)) s.alpha(first ? one : many, () => s.text(count(N), fr.X(Math.min(6 * N * 1e13, 6e23)) + 1 * u, fr.Y(lossND(SURF, N, Math.min(1e13, 1e23 / N)) - off) - 2.4 * u, { size: 2.9, font: 'mono', align: 'left', color: s.c('blue'), halo: true }));
      });
      s.alpha(s.win('flat', 'many'), () => {
        const floor = SURF.E + SURF.A / 1e9 ** SURF.alpha - off;
        poly(s, fr, [1e19, 1e24], [floor, floor], s.c('--ink-2'), 0.35, [1, 0.8]);
        s.text('limited by its size', fr.X(3e21), fr.Y(floor) - 3 * u, { size: 3.3, font: 'ui', color: s.c('--ink-2'), halo: true });
      });
      s.alpha(s.win('cross', 'env'), () => {
        s.text('small wins here', fr.X(2e16), fr.Y(lossND(SURF, 1e7, 2e16 / 6e7) - off) + 5 * u, { size: 3.2, font: 'ui', align: 'left', color: s.c('blue'), halo: true });
        s.text('big wins here', fr.X(2e23), fr.Y(lossND(SURF, 1e11, 2e23 / 6e11) - off) + 5 * u, { size: 3.2, font: 'ui', align: 'right', color: s.c('blue'), halo: true });
      });
      const ep = s.ease('env', 2);
      if (ep > 0) curve(s, fr, (C) => optimum(SURF, C).L - off, s.c('red'), 0.75, { to: loglerp(1e16, 1e24, ep) });
      s.alpha(s.ease('env', 0.6, 1.6) * (1 - s.ease('move', 0.5)), () => s.text('the frontier', fr.X(1e18), fr.Y(optimum(SURF, 1e18).L - off) + 4.5 * u, { size: 3.4, font: 'ui', align: 'center', weight: 600, color: s.c('red'), halo: true }));
      if (Cb) {
        s.line(fr.X(Cb), fr.top, fr.X(Cb), fr.bottom, s.c('purple'), 0.35, [1, 0.8]);
        dot(s, fr.X(Cb), fr.Y(optimum(SURF, Cb).L - off), 1.4, s.c('red'));
        const right = fr.X(Cb) > fr.left + fr.rect[2] * 0.6;
        s.text(`best: ${count(SIZES[bi]!, 2)}`, fr.X(Cb) + (right ? -1.5 : 1.5) * u, fr.top + 3 * u, { size: 3.3, font: 'mono', align: right ? 'right' : 'left', weight: 600, color: s.c('blue'), halo: true });
      }
      s.alpha(s.win('tenx', 'race'), () => {
        const t = '10× C  →  5.4× N,  1.9× D';
        s.text(t, w / 2, fr.bottom - 4 * u, { size: fitSize(s, t, 4.4, w * 0.8, 'mono', 600), font: 'mono', weight: 600, color: s.c('purple'), halo: true });
      });
    });
    s.show('kap', s.win('kaplan', 'race'));
    if (cardsA > 0)
      s.alpha(cardsA, () => {
        const ms = MODELS.filter((mm) => ['GPT-3', 'Gopher', 'MT-NLG'].includes(mm.name));
        const lo2 = 8;
        const hi2 = 13;
        const cw = Math.min(R[2], 110 * u);
        const x0 = (w - cw) / 2;
        const nameW = cw * 0.3;
        const bx = x0 + nameW;
        const bw = cw - nameW - 2 * u;
        const L = (v: number) => ((Math.log10(v) - lo2) / (hi2 - lo2)) * bw;
        const rowH = Math.min(18 * u, (R[3] - 8 * u) / 3);
        ms.forEach((mm, i) => {
          const a = i < 2 ? s.ease('race', 0.6, 0.4 + i * 1.4) : s.ease('params', 0.6);
          const y = R[1] + 6 * u + i * rowH;
          s.alpha(a, () => {
            s.text(mm.name, x0, y + rowH * 0.32, { size: 4, font: 'display', weight: 600, align: 'left' });
            s.text(String(mm.year), x0, y + rowH * 0.62, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3') });
            bar(s, bx, y + rowH * 0.28, L(mm.N), rowH * 0.24, 'blue', 0.6);
            bar(s, bx, y + rowH * 0.6, L(mm.D), rowH * 0.24, 'orange', 0.6);
            s.text(`${count(mm.N)} params`, bx + L(mm.N) + 1.5 * u, y + rowH * 0.28, { size: 3.1, font: 'mono', align: 'left', color: s.c('blue') });
            s.text(`${count(mm.D)} tokens`, bx + L(mm.D) + 1.5 * u, y + rowH * 0.6, { size: 3.1, font: 'mono', align: 'left', color: s.c('orange') });
          });
        });
        s.alpha(s.ease('params', 0.6, 1.5), () => s.text('log scale: parameters grew, tokens did not', w / 2, R[1] + R[3] - 2 * u, { size: fitSize(s, 'log scale: parameters grew, tokens did not', 3.4, w * 0.9, 'ui'), font: 'ui', color: s.c('--ink-2') }));
      });
  },
};

export const scenesA: Record<string, SceneDef> = { intro, power, fit, kaplan, flops, frontier };

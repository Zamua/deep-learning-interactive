import { Rng } from '../../core/rand';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import {
  AX_D,
  AX_T,
  GPUS,
  P_TARGET,
  QW_COLS,
  QW_ROWS,
  VOCAB,
  activations,
  alphaOf,
  decodeStep,
  draftDist,
  expectedTokens,
  fmtCount,
  int8Errors,
  quantMatrix,
  specPass,
  speedup,
  weightsWith,
} from '../../lib/inference-math';
import { Frame, type K, card, check, cross, current, fit, hatch, pill, rect } from './kit';

// ---------------------------------------------------------------- quantization

/** A few weights on a number line, the largest at 0.035. */
const QV = [-0.031, -0.022, -0.017, -0.009, -0.004, 0.003, 0.011, 0.016, 0.024, 0.035];
const OUTLIER = 0.12;

const quant: SceneDef = {
  marks: {
    abs: { tex: String.raw`\syms = \frac{\max |\symW|}{7}`, x: 0.5, y: 0.2, size: 5.2 },
  },
  draw(s) {
    const { w, h, u } = s;
    // Bytes per format.
    const bA = s.win('bytes', 'grid');
    if (bA > 0)
      s.alpha(bA, () => {
        const rows: [string, number, string, K, number][] = [
          ['bf16', 16, '4.8 ms', 'blue', s.ease('bytes', 0.6)],
          ['int8', 8, '2.4 ms', 'teal', s.ease('idea', 0.6, 0.6)],
          ['int4', 4.5, '1.3 ms', 'green', s.ease('idea', 0.6, 1.6)],
        ];
        const x0 = u * 18;
        const bw = w - x0 - u * 36;
        s.text('Llama 3 8B weights, and a batch-1 decode step', w / 2, h * 0.22, { size: fit(s, 'Llama 3 8B weights, and a batch-1 decode step', w - u * 10, 4, { weight: 600 }), weight: 600 });
        rows.forEach(([name, gb, ms, k, a], i) => {
          const y = h * 0.36 + i * u * 15;
          s.alpha(a, () => {
            s.text(name, x0 - u * 2, y, { size: 4, font: 'mono', weight: 650, align: 'right', color: s.c(k) });
            s.rrect(x0, y - u * 3.2, (bw * gb) / 16, u * 6.4, 1.2, { fill: s.tint(k, 0.5), stroke: s.c(k), lw: 0.3 });
            s.text(`${gb} GB`, x0 + (bw * gb) / 16 + u * 2, y, { size: 3.6, font: 'mono', align: 'left', color: s.c('--ink-2') });
            s.text(ms, w - u * 5, y, { size: 3.8, font: 'mono', weight: 650, align: 'right', color: s.c(k) });
          });
        });
      });
    // The absmax number line.
    const nA = s.win('grid', 'relu');
    if (nA > 0)
      s.alpha(nA, () => {
        const catchE = s.ease('catch', 1.2);
        const D = lerp(0.04, 0.13, catchE);
        const sc = lerp(0.005, OUTLIER / 7, catchE);
        const x0 = u * 6;
        const x1 = w - u * 6;
        const X = (v: number) => x0 + ((v + D) / (2 * D)) * (x1 - x0);
        const y = h * 0.55;
        s.line(x0, y, x1, y, s.c('--axis'), 0.3);
        // the integer grid
        const gA = s.ease('grid', 0.6, 1);
        s.alpha(gA, () => {
          for (let k = -7; k <= 7; k++) {
            const x = X(k * sc);
            s.line(x, y - u * 2.5, x, y + u * 2.5, s.c('teal'), k === 0 ? 0.45 : 0.3);
            if (k % 7 === 0 || (catchE < 0.5 && (k === -1 || k === 1)))
              s.text(k > 0 ? `+${k}` : String(k), x, y + u * 5.5, { size: 3, font: 'mono', color: s.c('teal') });
          }
          s.text('integer steps of size s', (x0 + x1) / 2, h * 0.78, { size: 3.6, italic: true, color: s.c('teal') });
        });
        s.show('abs', s.ease('absmax', 0.6));
        const rE = s.ease('round', 1);
        const vals = catchE > 0 ? [...QV, OUTLIER] : QV;
        vals.forEach((v, i) => {
          const isOut = v === OUTLIER;
          const q = Math.max(-7, Math.min(7, Math.round(v / sc))) * sc;
          const pos = lerp(v, q, rE);
          const a = isOut ? catchE : 1;
          s.alpha(a, () => {
            if (rE > 0 && rE < 1 && Math.abs(q - v) > 1e-9) s.arrow(X(v), y - u * 6, X(q), y - u * 3.2, s.tint('--ink-3', 0.7), 0.2, 1.2);
            s.circle(X(pos), y - u * 6, u * 1.3, { fill: s.c(isOut ? 'red' : 'blue'), stroke: s.c('--card'), lw: 0.3 });
            if (rE > 0 && !isOut) s.alpha(0.35 * (1 - rE), () => s.circle(X(v), y - u * 6, u * 1.3, { stroke: s.c('blue'), lw: 0.2 }));
          });
          void i;
        });
        s.alpha(s.ease('absmax', 0.6, 2.5) * (1 - catchE), () => s.text('largest weight → +7', X(0.035), y - u * 12, { size: 3.4, font: 'mono', weight: 600, align: 'right', color: s.c('blue') }));
        s.alpha(s.win('back', 'catch'), () => s.text('each weight now off by at most s / 2', (x0 + x1) / 2, h * 0.86, { size: 3.6, weight: 600, color: s.c('--ink') }));
        s.alpha(catchE, () => {
          s.text('one outlier: s grows, the rest share 5 values', (x0 + x1) / 2, h * 0.86, { size: fit(s, 'one outlier: s grows, the rest share 5 values', x1 - x0, 3.6, { weight: 600 }), weight: 600, color: s.c('red') });
        });
      });
    // Zero point on lopsided values.
    const zA = s.ease('relu', 0.6);
    if (zA > 0)
      s.alpha(zA, () => {
        const x0 = u * 8;
        const x1 = w - u * 6;
        const X = (v: number) => x0 + ((v + 0.06) / 0.12) * (x1 - x0);
        const ys = [h * 0.38, h * 0.68];
        const relu = [0.002, 0.006, 0.011, 0.015, 0.019, 0.026, 0.033, 0.041, 0.05, 0.06];
        s.text('ReLU outputs: never negative', w / 2, h * 0.2, { size: 4, weight: 600 });
        // absmax: half the codes unused
        s.text('absmax', x0, ys[0]! - u * 9, { size: 3.6, weight: 650, align: 'left', color: s.c('--ink-2') });
        s.line(x0, ys[0]!, x1, ys[0]!, s.c('--axis'), 0.3);
        hatch(s, X(-0.06), ys[0]! - u * 3, X(0) - X(-0.06), u * 6, s.tint('red', 0.35), 1.2);
        s.text('codes never used', (X(-0.06) + X(0)) / 2, ys[0]! + u * 6, { size: 3.2, italic: true, color: s.c('red') });
        for (let k = -7; k <= 7; k++) s.line(X((k * 0.06) / 7), ys[0]! - u * 2.5, X((k * 0.06) / 7), ys[0]! + u * 2.5, s.c('teal'), 0.3);
        relu.forEach((v) => s.circle(X(v), ys[0]! - u * 5.5, u * 1.1, { fill: s.c('blue') }));
        // zero point: every code on the real range
        const pA = s.ease('zp', 0.6);
        s.alpha(pA, () => {
          s.text('zero point', x0, ys[1]! - u * 9, { size: 3.6, weight: 650, align: 'left', color: s.c('--ink-2') });
          s.line(x0, ys[1]!, x1, ys[1]!, s.c('--axis'), 0.3);
          for (let k = 0; k <= 15; k++) s.line(X((k * 0.06) / 15), ys[1]! - u * 2.5, X((k * 0.06) / 15), ys[1]! + u * 2.5, s.c('teal'), 0.3);
          relu.forEach((v) => s.circle(X(v), ys[1]! - u * 5.5, u * 1.1, { fill: s.c('blue') }));
          s.text('all 16 codes on [min, max]: half the step', (X(0) + x1) / 2, ys[1]! + u * 7, { size: fit(s, 'all 16 codes on [min, max]: half the step', x1 - X(0), 3.2, { italic: true }), italic: true, color: s.c('teal') });
        });
        s.alpha(s.ease('z', 0.6), () => {
          s.circle(X(0), ys[1]!, u * 1.6, { stroke: s.c('green'), lw: 0.5 });
          s.text('z: the code for 0.0', X(0) - u * 2.5, ys[1]! + u * 5.5, { size: 3.6, font: 'mono', weight: 650, align: 'right', color: s.c('green') });
        });
        s.alpha(s.ease('bits', 0.6), () => pill(s, 'one more bit: half the step, about +6 dB', w / 2, h * 0.88, 'teal', fit(s, 'one more bit: half the step, about +6 dB', w - u * 14, 3.4, { font: 'mono', weight: 600 })));
      });
  },
};

// ---------------------------------------------------------------- scales and outliers

const QW = weightsWith(false);
const QRES = {
  tensor: quantMatrix(QW, QW_ROWS, QW_COLS, 4, 'absmax', 'tensor'),
  channel: quantMatrix(QW, QW_ROWS, QW_COLS, 4, 'absmax', 'channel'),
  group: quantMatrix(QW, QW_ROWS, QW_COLS, 4, 'absmax', 'group'),
};
const ACT = activations(20);
const ACT_ERR = int8Errors(activations(40));
const ACT_MAX = Math.max(...Array.from(ACT, Math.abs));

function rowHist(s: Scene, row: number, x: number, y: number, w: number, hh: number, deq: Float64Array, title: string): void {
  const { u } = s;
  const vals = QW.subarray(row * QW_COLS, (row + 1) * QW_COLS);
  const dq = deq.subarray(row * QW_COLS, (row + 1) * QW_COLS);
  let m = 0;
  for (const v of vals) m = Math.max(m, Math.abs(v));
  for (const v of dq) m = Math.max(m, Math.abs(v));
  const R = m * 1.08;
  const bins = 41;
  const hist = new Array<number>(bins).fill(0);
  for (const v of vals) hist[Math.min(bins - 1, Math.max(0, Math.floor(((v + R) / (2 * R)) * bins)))]!++;
  const lv = new Map<number, number>();
  for (const v of dq) lv.set(v, (lv.get(v) ?? 0) + 1);
  const top = Math.max(...hist, ...lv.values());
  s.rrect(x, y, w, hh, 1, { fill: s.c('--paper'), stroke: s.c('--rule'), lw: 0.2 });
  const by = y + hh - u * 1.5;
  const H = hh - u * 8;
  for (let i = 0; i < bins; i++) {
    const bh = (H * hist[i]!) / top;
    rect(s, x + (w * i) / bins + 0.5, by - bh, w / bins - 1, bh, s.tint('blue', 0.3));
  }
  for (const [v, n] of lv) {
    const px = x + ((v + R) / (2 * R)) * w;
    s.line(px, by, px, by - Math.max(u * 0.8, (H * n) / top), s.c('teal'), 0.45);
  }
  s.text(title, x + u * 2, y + u * 3.2, { size: 3.2, weight: 600, align: 'left', color: s.c('--ink-2') });
  s.text(`${lv.size} value${lv.size === 1 ? '' : 's'}`, x + w - u * 2, y + u * 3.2, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('teal') });
}

const outliers: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // Weight rows under three granularities.
    const wA = s.win('share', 'acts');
    if (wA > 0)
      s.alpha(wA, () => {
        const g = current(s, ['tensor', 'chan', 'group']);
        const res = g === 'group' ? QRES.group : g === 'chan' ? QRES.channel : QRES.tensor;
        const lab = g === 'group' ? 'one scale per 32 weights' : g === 'chan' ? 'one scale per row' : g === 'tensor' ? 'one scale for the matrix' : '4 bits: 15 integer values';
        s.text(lab, w / 2, h * 0.17, { size: 4, weight: 650, color: s.c(g ? 'teal' : '--ink') });
        const x = u * 5;
        const pw = w - u * 10;
        const ph = h * 0.3;
        const show = g ? 1 : s.ease('share', 0.6, 1);
        s.alpha(show, () => {
          rowHist(s, 0, x, h * 0.23, pw, ph, res.What, 'row 0: small weights');
          rowHist(s, QW_ROWS - 1, x, h * 0.23 + ph + u * 4, pw, ph, res.What, 'row 7: large weights');
        });
        const sq = res.sqnr;
        if (g) s.text(`SQNR ${sq.toFixed(1)} dB`, w / 2, h * 0.23 + 2 * ph + u * 10, { size: 3.6, font: 'mono', weight: 600, color: s.c('--ink-2') });
      });
    // Activations with outlier features.
    const aA = s.win('acts', 'int4');
    if (aA > 0)
      s.alpha(aA, () => {
        const x = u * 5;
        const gw = w - u * 10;
        const hy = h * 0.2;
        const hh = Math.min(h * 0.32, gw * 0.4);
        const cw = gw / AX_D;
        const ch = hh / AX_T;
        s.text('activations: 16 tokens × 64 features', x, hy - u * 3, { size: 3.6, weight: 600, align: 'left', color: s.c('--ink-2') });
        for (let t = 0; t < AX_T; t++)
          for (let d = 0; d < AX_D; d++) {
            const v = Math.abs(ACT[t * AX_D + d]!) / ACT_MAX;
            const out = d === 9 || d === 44;
            rect(s, x + d * cw, hy + t * ch, cw - 0.6, ch - 0.6, s.tint(out ? 'red' : 'orange', 0.08 + 0.92 * Math.sqrt(v)));
          }
        s.alpha(s.ease('acts', 0.6, 2), () => s.text('two outlier features, 20× larger', x + gw / 2, hy + hh + u * 5, { size: 3.6, weight: 600, color: s.c('red') }));
        // error bars
        const bA = s.ease('break', 0.6);
        const by = hy + hh + u * 12;
        const rows: [string, number, K, number][] = [
          ['one scale', ACT_ERR.tensor, 'red', bA],
          ['per token', ACT_ERR.row, 'red', bA],
          ['LLM.int8()', ACT_ERR.mixed, 'green', s.ease('int8', 0.6, 2)],
        ];
        const lw = u * 22;
        const bw = gw - lw - u * 14;
        rows.forEach(([name, e, k, a], i) => {
          const y = by + i * u * 7.5;
          s.alpha(a, () => {
            s.text(name, x, y, { size: 3.4, weight: i === 2 ? 650 : 500, align: 'left', color: s.c(i === 2 ? 'green' : '--ink-2') });
            rect(s, x + lw, y - u * 2, bw, u * 4, s.tint('--ink-3', 0.07));
            rect(s, x + lw, y - u * 2, Math.max(u * 0.6, (bw * e) / 0.1), u * 4, s.tint(k, 0.6));
            s.text(`${(e * 100).toFixed(1)}%`, x + lw + bw + u * 2, y, { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c('--ink') });
          });
        });
        s.alpha(bA * (1 - s.ease('rest', 0.5)), () => s.text('error on the ordinary features, int8, outliers 40×', x, by + 3 * u * 7.5, { size: fit(s, 'error on the ordinary features, int8, outliers 40×', gw, 3.1, { italic: true }), italic: true, align: 'left', color: s.c('--ink-3') }));
        s.alpha(s.ease('rest', 0.6), () => pill(s, '> 99.9% of multiplies stay int8', w / 2, by + 3 * u * 7.5, 'green', 3.2));
      });
    // Four-bit weights and fp8.
    const cA = s.ease('int4', 0.6);
    if (cA > 0)
      s.alpha(cA, () => {
        const cw = w - u * 10;
        const ch = u * 15;
        card(s, u * 5, h * 0.2, cw, ch, 'GPTQ (2022)', "fixes each column's rounding with the columns still to come", 'blue', 0.3, s.ease('int4', 0.6, 1));
        card(s, u * 5, h * 0.2 + ch + u * 4, cw, ch, 'AWQ (2023)', 'scales up the channels that meet large activations', 'blue', 0.3, s.ease('int4', 0.6, 4));
        card(s, u * 5, h * 0.2 + 2 * (ch + u * 4), cw, ch, 'fp8 (E4M3)', 'weights and activations in 8 bits: 2× bf16 speed', 'teal', 0.3, s.ease('fp8', 0.6));
      });
  },
};

// ---------------------------------------------------------------- speculative decoding: the idea

const GUESS = ['stairs', 'to', 'a', 'lamp'];

const specidea: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // One user, one token per pass.
    const oA = s.win('single', 'roof');
    s.alpha(oA, () => {
      const n = 10;
      const cw = (w - u * 12) / n;
      const y = h * 0.42;
      const shown = Math.min(n, Math.floor(s.t / 0.7) + 1);
      for (let i = 0; i < n; i++)
        s.rrect(u * 6 + i * cw + u * 0.4, y, cw - u * 0.8, u * 7, 1, { fill: i < shown ? s.tint('purple', 0.4) : undefined, stroke: s.tint('purple', i < shown ? 0.9 : 0.3), lw: 0.3 });
      s.text('one user: one token per pass of the big model', w / 2, y - u * 7, { size: fit(s, 'one user: one token per pass of the big model', w - u * 10, 3.8, { weight: 600 }), weight: 600 });
      s.alpha(s.ease('spec', 0.6), () => s.text('same output distribution, fewer passes', w / 2, y + u * 17, { size: 3.8, italic: true, color: s.c('green') }));
    });
    // A pass costs the same for 1 or 5 tokens.
    const rA = s.win('roof', 'draft');
    s.alpha(rA, () => {
      const x0 = u * 30;
      const bw = w - x0 - u * 20;
      const t1 = decodeStep(1, 1024, GPUS.H100).t;
      [1, 5].forEach((n, i) => {
        const y = h * 0.4 + i * u * 14;
        const t = Math.max(t1, (n * 2 * 8.03e9) / GPUS.H100.flops);
        s.text(`${n} token${n > 1 ? 's' : ''}`, x0 - u * 2, y, { size: 3.8, font: 'mono', weight: 600, align: 'right' });
        s.rrect(x0, y - u * 3, bw * 0.95, u * 6, 1.2, { fill: s.tint('blue', 0.45), stroke: s.c('blue'), lw: 0.3 });
        s.text(`${(t * 1000).toFixed(1)} ms`, x0 + bw * 0.95 + u * 2, y, { size: 3.6, font: 'mono', align: 'left', color: s.c('--ink-2') });
      });
      s.text('a pass of the big model: reading the weights dominates', w / 2, h * 0.24, { size: fit(s, 'a pass of the big model: reading the weights dominates', w - u * 10, 3.8, { weight: 600 }), weight: 600 });
    });
    // Draft, then verify.
    const dA = s.ease('draft', 0.6);
    if (dA <= 0) return;
    s.alpha(dA, () => {
      const k = 4;
      const n = k + 1;
      const cw = Math.min(u * 16, (w - u * 16) / n - u);
      const gap = u * 1.5;
      const x0 = (w - n * cw - (n - 1) * gap) / 2;
      const cx = (i: number) => x0 + i * (cw + gap);
      const gy = h * 0.42;
      const ch = u * 7;
      // the draft
      s.rrect(x0, h * 0.17, u * 26, u * 9, 1.5, { fill: s.tint('gold', 0.2), stroke: s.c('gold'), lw: 0.4 });
      s.text('draft  q', x0 + u * 13, h * 0.17 + u * 4.5, { size: 3.8, font: 'display', weight: 620, color: s.c('gold') });
      const dp = s.prog('draft');
      const nGuess = s.since('verify') >= 0 ? k : Math.min(k, Math.floor(dp * 5));
      const tokSize = fit(s, 'stairs', cw - u * 1.5, 3.4, { font: 'mono', weight: 600 });
      const row2 = s.since('bonus') >= 0;
      // verdicts
      const walk = s.since('walk') >= 0 ? Math.min(3, Math.floor(clamp01(s.prog('walk') * 1.3) * 3) + 1) : 0;
      const verdict = [true, true, false, false];
      for (let i = 0; i < k; i++) {
        if (i >= nGuess) {
          s.rrect(cx(i), gy, cw, ch, 1, { stroke: s.tint('gold', 0.3), lw: 0.25 });
          continue;
        }
        const thrown = s.since('reject') >= 0 && i === 3;
        s.alpha(thrown ? 0.3 : 1, () => {
          s.cell(cx(i), gy, cw, ch, '', 'gold', { on: 0.4 });
          s.text(GUESS[i]!, cx(i) + cw / 2, gy + ch / 2, { font: 'mono', size: tokSize, weight: 600 });
        });
        if (i < walk && i < 3) (verdict[i] ? check : cross)(s, cx(i) + cw - u * 0.5, gy - u * 0.5, u * 2);
      }
      // the target and its pass
      const tA = s.ease('verify', 0.6);
      s.alpha(tA, () => {
        const ty = gy + ch + u * 10;
        s.rrect(x0, ty, n * cw + (n - 1) * gap, u * 9, 1.5, { fill: s.tint('purple', 0.15), stroke: s.c('purple'), lw: 0.45 });
        s.text('target  p: one pass over all of them', w / 2, ty + u * 4.5, { size: fit(s, 'target  p: one pass over all of them', n * cw, 3.8, { font: 'display', weight: 620 }), font: 'display', weight: 620, color: s.c('purple') });
        for (let i = 0; i < n; i++) s.arrow(cx(i) + cw / 2, ty - u * 0.5, cx(i) + cw / 2, gy + ch + u * 1, s.tint('purple', 0.7), 0.3, 1.6);
      });
      // p at every position
      s.alpha(s.ease('positions', 0.6), () => {
        for (let i = 0; i < n; i++) {
          const bars = [0.5, 0.3, 0.15, 0.05];
          const bx = cx(i) + cw * 0.15;
          bars.forEach((b, j) => rect(s, bx + (j * cw * 0.7) / 4, gy - u * 3 - b * u * 10, (cw * 0.7) / 4 - 1, b * u * 10, s.tint('purple', 0.55)));
        }
        s.text('p', cx(n - 1) + cw + u * 2.5, gy - u * 5, { size: 4, italic: true, weight: 650, color: s.c('purple') });
      });
      // the correction
      s.alpha(s.ease('reject', 0.6, 0.8) * (row2 ? 0.35 : 1), () => {
        s.cell(cx(2), gy + ch + u * 1.5, cw, ch * 0.9, '', 'purple', { on: 0.6 });
        s.text('the', cx(2) + cw / 2, gy + ch * 1.45 + u * 1.5, { font: 'mono', size: tokSize, weight: 650 });
      });
      s.alpha(s.since('reject') >= 0 && !row2 ? s.ease('reject', 0.6, 1.5) : 0, () =>
        s.text('3 tokens from one pass', w / 2, h * 0.9, { size: 3.8, weight: 600, color: s.c('green') }),
      );
      // all kept: the bonus
      s.alpha(s.ease('bonus', 0.6), () => {
        const by = h * 0.84;
        for (let i = 0; i < n; i++) {
          const bonus = i === k;
          s.cell(cx(i), by, cw, ch, '', bonus ? 'purple' : 'gold', { on: bonus ? 0.7 : 0.4 });
          s.text(bonus ? 'bonus' : GUESS[i]!, cx(i) + cw / 2, by + ch / 2, { font: 'mono', size: tokSize, weight: 600 });
          if (!bonus) check(s, cx(i) + cw - u * 0.5, by - u * 0.5, u * 1.8);
        }
      });
      s.alpha(s.ease('range', 0.6), () => pill(s, 'each pass: 1 to k + 1 tokens', w / 2, h * 0.13, 'slate', 3.4));
    });
  },
};

// ---------------------------------------------------------------- the accept rule

const Q_RULE = draftDist(0.5);
const ALPHA = alphaOf(P_TARGET, Q_RULE);
const CHECKPOINTS = [10, 30, 100, 300, 1000, 3000, 10000, 20000];
const EMP: number[][] = (() => {
  const rng = new Rng(91);
  const counts = P_TARGET.map(() => 0);
  let tokens = 0;
  let passes = 0;
  const out: number[][] = [];
  for (const cp of CHECKPOINTS) {
    while (passes < cp) {
      const r = specPass(P_TARGET, Q_RULE, 4, rng);
      passes++;
      tokens += r.out.length;
      for (const x of r.out) counts[x]!++;
    }
    out.push(counts.map((c) => c / tokens));
  }
  return out;
})();

const specrule: SceneDef = {
  marks: {
    rule: { tex: String.raw`\text{keep } x \text{ with probability } \min\!\Big(1, \frac{\symp(x)}{\symq(x)}\Big)`, x: 0.5, y: 0.14, size: 4.6 },
    resid: { tex: String.raw`r(x) \propto \max\big(0,\ \symp(x) - \symq(x)\big)`, x: 0.5, y: 0.14, size: 4.6 },
    proof: { tex: String.raw`\min(\symp, \symq) + (1 - \symalpha)\, r = \symp`, x: 0.5, y: 0.14, size: 5 },
  },
  draw(s) {
    const { w, h, u } = s;
    const n = VOCAB.length;
    const x0 = u * 6;
    const gw = w - u * 12;
    const gcw = gw / n;
    const top = h * 0.26;
    const bh = h * 0.42;
    const base = top + bh;
    const Y = (v: number) => base - (bh * v) / 0.34;
    const cur = current(s, ['rule', 'like', 'over', 'resid', 'under', 'proof', 'alpha', 'left', 'sum', 'check']);
    s.show('rule', s.win('rule', 'resid'));
    s.show('resid', s.win('resid', 'proof'));
    s.show('proof', s.ease('sum', 0.6) * (1 - s.ease('check', 0.6)));
    const stack = s.ease('sum', 1);
    const checkA = s.ease('check', 0.6);
    const empIdx = Math.min(CHECKPOINTS.length - 1, Math.floor(clamp01(s.prog('check') * 1.15) * CHECKPOINTS.length));
    for (let i = 0; i < n; i++) {
      const p = P_TARGET[i]!;
      const q = Q_RULE[i]!;
      const m = Math.min(p, q);
      const cx = x0 + i * gcw;
      const bw = gcw * 0.34;
      const px = cx + gcw * 0.12;
      const qx = px + bw + u * 0.6;
      const keepAll = p >= q;
      const hl = (cur === 'like' && keepAll) || (cur === 'over' && !keepAll);
      if (hl) s.rrect(cx + u * 0.4, Y(0.33), gcw - u * 0.8, base - Y(0.33) + u * 1, 1, { fill: s.tint(keepAll ? 'green' : 'red', 0.08), stroke: s.tint(keepAll ? 'green' : 'red', 0.6), lw: 0.25 });
      // p bar, or in the proof, its two parts
      s.alpha(1 - stack, () => s.rrect(px, Y(p), bw, base - Y(p), 0.6, { fill: s.tint('purple', 0.55), stroke: s.c('purple'), lw: 0.25 }));
      s.alpha(1 - stack, () => s.rrect(qx, Y(q), bw, base - Y(q), 0.6, { fill: s.tint('gold', 0.55), stroke: s.c('gold'), lw: 0.25 }));
      const kA = s.ease('proof', 0.6) * (1 - stack);
      s.alpha(kA, () => s.rrect(qx, Y(m), bw, base - Y(m), 0.6, { fill: s.tint('green', 0.55), stroke: s.c('green'), lw: 0.3 }));
      const rA = s.ease('resid', 0.6) * (1 - stack);
      if (p > q) s.alpha(rA, () => {
        s.ctx.setLineDash([u * 0.8, u * 0.6]);
        s.rrect(qx, Y(p), bw, Y(q) - Y(p), 0.6, { fill: s.tint('purple', 0.12), stroke: s.c('purple'), lw: 0.3 });
        s.ctx.setLineDash([]);
      });
      // the stacked check: kept part plus residual part equals p
      s.alpha(stack, () => {
        const sx = cx + gcw * 0.2;
        const sw = gcw * 0.6;
        rect(s, sx, Y(m), sw, base - Y(m), s.tint('green', 0.6));
        if (p > m) rect(s, sx, Y(p), sw, Y(m) - Y(p), s.tint('purple', 0.35));
        s.line(sx - u * 0.6, Y(p), sx + sw + u * 0.6, Y(p), s.c('purple'), 0.45);
      });
      if (checkA > 0) {
        const e = EMP[empIdx]![i]!;
        s.alpha(checkA, () => s.line(cx + gcw * 0.15, Y(e), cx + gcw * 0.85, Y(e), s.c('--ink'), 0.55));
      }
      s.text(VOCAB[i]!, cx + gcw / 2, base + u * 4, { size: 3.4, font: 'mono', weight: 600, color: s.c('--ink-2') });
    }
    // legend and running notes
    const ly = base + u * 11;
    const note = (t: string, k: K) => s.text(t, w / 2, ly, { size: fit(s, t, gw, 3.6, { weight: 600 }), weight: 600, color: s.c(k) });
    if (stack < 0.5 && checkA <= 0) {
      s.text('p', x0 + gcw * 0.12 + gcw * 0.17, Y(P_TARGET[0]!) - u * 3, { size: 4, italic: true, weight: 650, color: s.c('purple') });
      s.text('q', x0 + gcw * 0.12 + gcw * 0.34 + u * 0.6 + gcw * 0.17, Y(Q_RULE[0]!) - u * 3, { size: 4, italic: true, weight: 650, color: s.c('gold') });
    }
    if (cur === 'like') note('p ≥ q: always keep', 'green');
    else if (cur === 'over') note('q > p: keep it p/q of the time', 'red');
    else if (cur === 'resid' || cur === 'under') note('dashed: the residual, where p sticks out above q', 'purple');
    else if (cur === 'proof') note('green: proposed and kept, min(p, q)', 'green');
    else if (cur === 'alpha') note(`α = Σ min(p, q) = ${ALPHA.toFixed(3)}`, 'orange');
    else if (cur === 'left') note(`rejected: 1 − α = ${(1 - ALPHA).toFixed(3)} = the residual's total`, 'purple');
    else if (cur === 'sum') note('kept + resampled = p, for every token', 'green');
    else if (cur === 'check') note(`after ${fmtCount(CHECKPOINTS[empIdx]!)} passes: output frequencies (lines) vs p`, '--ink');
  },
};

// ---------------------------------------------------------------- how much it buys

const specspeed: SceneDef = {
  marks: {
    sum: { tex: String.raw`1 + \symalpha + \symalpha^2 + \dots + \symalpha^{\symk} = \frac{1 - \symalpha^{\symk+1}}{1 - \symalpha}`, x: 0.5, y: 0.15, size: 5 },
  },
  draw(s) {
    const { w, h, u } = s;
    const a = 0.8;
    // The series, one survival at a time.
    const sA = s.win('one', 'eg');
    s.alpha(sA, () => {
      const n = 5;
      const cw = (w - u * 14) / n;
      const by = h * 0.62;
      const H = h * 0.3;
      const shown = s.since('three') >= 0 ? 5 : s.since('two') >= 0 ? 2 : 1;
      for (let j = 0; j < n; j++) {
        const x = u * 7 + j * cw;
        const v = a ** j;
        const vis = j < shown ? 1 : s.since('three') >= 0 ? s.ease('three', 0.5, 0.3 * j) : 0;
        s.alpha(Math.max(vis, j < shown ? 1 : 0), () => {
          rect(s, x + cw * 0.15, by - H * v, cw * 0.7, H * v, s.tint(j === 0 ? 'purple' : 'orange', 0.55));
          s.text(['1', 'α', 'α²', 'α³', 'α⁴'][j]!, x + cw / 2, by - H * v - u * 3, { size: 4, italic: true, weight: 650, color: s.c(j === 0 ? 'purple' : 'orange') });
          s.text(`token ${j + 1}`, x + cw / 2, by + u * 4, { size: 3.2, font: 'mono', color: s.c('--ink-2') });
          s.text(v.toFixed(2), x + cw / 2, by + u * 9, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
        });
      }
      s.alpha(1 - s.ease('sum', 0.4), () => s.text('chance the pass yields this token, α = 0.8', w / 2, h * 0.2, { size: fit(s, 'chance the pass yields this token, α = 0.8', w - u * 10, 3.8, { weight: 600 }), weight: 600 }));
    });
    s.show('sum', s.win('sum', 'cost'));
    // The curves.
    const pA = s.ease('eg', 0.6);
    if (pA <= 0) return;
    s.alpha(pA, () => {
      const left = u * 12;
      const top = h * 0.24;
      const F = new Frame(s, [left, top, w - left - u * 5, h - top - u * 11], [0.5, 12.5, 0, 5.6]);
      F.grid('y', [1, 2, 3, 4, 5], (v) => `${v}`);
      F.grid('x', [1, 4, 8, 12], (v) => `k=${v}`);
      const ks = Array.from({ length: 12 }, (_, i) => i + 1);
      F.hline(5, s.tint('orange', 0.5), 0.25, [1, 1]);
      F.poly(ks, ks.map((k) => expectedTokens(a, k)), s.c('orange'), 0.55, [1.6, 0.9]);
      s.text('tokens per pass (cap 5)', F.X(12.3), F.Y(5) - u * 3, { size: 3.4, align: 'right', color: s.c('orange'), halo: true });
      F.dot(4, expectedTokens(a, 4), 1.2, s.c('orange'));
      s.text('3.36', F.X(4), F.Y(expectedTokens(a, 4)) + u * 3.5, { size: 3.4, font: 'mono', weight: 600, color: s.c('orange'), halo: true });
      const cA = s.ease('cost', 0.8);
      s.alpha(cA, () => {
        F.poly(ks, ks.map((k) => speedup(a, k, 0.05)), s.c('purple'), 0.7);
        s.text('speedup, draft cost c = 0.05', F.X(12.3), F.Y(speedup(a, 12, 0.05)) + u * 4, { size: 3.4, weight: 600, align: 'right', color: s.c('purple'), halo: true });
      });
      s.alpha(s.ease('best', 0.6), () => {
        F.dot(8, speedup(a, 8, 0.05), 1.6, s.c('purple'));
        s.text('best: 3.1× at k = 8', F.X(8), F.Y(speedup(a, 8, 0.05)) - u * 4.5, { size: 3.6, font: 'mono', weight: 650, color: s.c('purple'), halo: true });
      });
      s.alpha(s.ease('fit', 0.6), () => pill(s, 'agreement (α) beats speed (c)', w / 2, h * 0.16, 'orange', 3.4));
    });
  },
};

// ---------------------------------------------------------------- distillation and the tradeoff

const WORDS = ['the', 'a', 'his', 'this', 'one', 'banana'];
const T_LOGITS = [3, 2.4, 1.3, 0.9, 0.3, -3];
const S_LOGITS = [2.6, 2.6, 0.7, 1.3, 0.6, -1.5];
const soft = (z: number[], tau: number): number[] => {
  const e = z.map((v) => Math.exp(v / tau));
  const t = e.reduce((x, y) => x + y, 0);
  return e.map((v) => v / t);
};
const TRADE = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((lb) => decodeStep(2 ** lb, 1024, GPUS.H100));

const distill: SceneDef = {
  marks: {
    kl: { tex: String.raw`\mathrm{KL}(\symp_\tau \Vert \symq_\tau) = \sum_x \symp_\tau(x) \log \frac{\symp_\tau(x)}{\symq_\tau(x)}`, x: 0.5, y: 0.86, size: 4.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    const dA = s.win('change', 'tradeoff');
    if (dA > 0)
      s.alpha(dA, () => {
        // teacher and student
        const by = h * 0.17;
        const tw = w * 0.42;
        s.rrect(u * 5, by, tw, u * 9, 1.5, { fill: s.tint('purple', 0.15), stroke: s.c('purple'), lw: 0.45 });
        s.text('teacher p: big', u * 5 + tw / 2, by + u * 4.5, { size: fit(s, 'teacher p: big', tw - u * 3, 3.8, { font: 'display', weight: 620 }), font: 'display', weight: 620, color: s.c('purple') });
        s.alpha(s.ease('student', 0.6), () => {
          const sw = w * 0.3;
          s.rrect(w - u * 5 - sw, by, sw, u * 9, 1.5, { fill: s.tint('gold', 0.15), stroke: s.c('gold'), lw: 0.45 });
          s.text('student q', w - u * 5 - sw / 2, by + u * 4.5, { size: fit(s, 'student q', sw - u * 3, 3.8, { font: 'display', weight: 620 }), font: 'display', weight: 620, color: s.c('gold') });
          s.arrow(u * 6 + tw, by + u * 4.5, w - u * 6 - sw, by + u * 4.5, s.c('--ink-3'), 0.4, 2);
        });
        // soft targets
        const fA = s.ease('soft', 0.6);
        s.alpha(fA * (1 - s.ease('llm', 0.6)), () => {
          const tau = lerp(1, 2, s.ease('soft', 1.4, 1.2));
          const P = soft(T_LOGITS, tau);
          const Q = soft(S_LOGITS, tau);
          const n = WORDS.length;
          const gcw = (w - u * 12) / n;
          const base = h * 0.66;
          const H = h * 0.36;
          for (let i = 0; i < n; i++) {
            const cx = u * 6 + i * gcw;
            const bw = gcw * 0.34;
            rect(s, cx + gcw * 0.12, base - (H * P[i]!) / 0.6, bw, (H * P[i]!) / 0.6, s.tint('purple', 0.6));
            rect(s, cx + gcw * 0.12 + bw + u * 0.6, base - (H * Q[i]!) / 0.6, bw, (H * Q[i]!) / 0.6, s.tint('gold', 0.6));
            s.text(WORDS[i]!, cx + gcw / 2, base + u * 4, { size: fit(s, 'banana', gcw - u, 3.3, { font: 'mono' }), font: 'mono', color: s.c('--ink-2') });
          }
          s.text(`τ = ${tau.toFixed(1)}`, w - u * 6, h * 0.32, { size: 4, font: 'mono', weight: 650, align: 'right', color: s.c('slate') });
          s.show('kl', s.ease('kl', 0.6));
        });
        s.alpha(s.ease('llm', 0.6), () => {
          card(s, u * 5, h * 0.36, w - u * 10, u * 16, 'teacher writes, student learns', 'sequence-level distillation: no logits needed', 'purple', 0.3);
          card(s, u * 5, h * 0.36 + u * 20, w - u * 10, u * 16, 'DeepSeek-R1 → small Qwen and Llama', 'about 800,000 samples curated with R1', 'orange', 0.3);
        });
      });
    // Latency against throughput.
    const tA = s.ease('tradeoff', 0.6);
    if (tA <= 0) return;
    s.alpha(tA, () => {
      const items: [string, string, K, string][] = [
        ['first token', 'queue + prefill', 'orange', 'ttft'],
        ['per token', 'one decode step', 'purple', 'tpot'],
        ['throughput', 'tokens/s per GPU', 'blue', 'thr'],
      ];
      const cw = (w - u * 14) / 3;
      items.forEach(([head, note, k, id], i) => card(s, u * 5 + i * (cw + u * 2), h * 0.15, cw, u * 13, head, note, k, s.since(id) >= 0 && s.since('pick') < 0 ? 0.8 : 0.2, s.ease(id, 0.5)));
      const left = u * 13;
      const top = h * 0.15 + u * 22;
      const F = new Frame(s, [left, top, w - left - u * 5, h - top - u * 11], [2.2, 4.9, 0, 230]);
      F.grid('x', [3, 4], (v) => (v === 3 ? '1k' : '10k'));
      F.grid('y', [0, 100, 200], (v) => String(v));
      s.text('tokens/s per user', F.rect[0] - u, F.rect[1] - u * 3, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3') });
      s.text('total tokens/s →', F.X(4.85), F.rect[1] + F.rect[3] + u * 7, { size: 3.2, align: 'right', color: s.c('--ink-3') });
      const xs = TRADE.map((c) => Math.log10(c.tokS));
      const ys = TRADE.map((c) => c.userS);
      F.poly(xs, ys, s.c('purple'), 0.6);
      TRADE.forEach((c, i) => {
        if (i % 2) return;
        F.dot(xs[i]!, ys[i]!, 1, s.c('purple'));
        s.text(`B=${2 ** i}`, F.X(xs[i]!) + u * 1.5, F.Y(ys[i]!) - u * 3, { size: 3, font: 'mono', align: 'left', color: s.c('purple'), halo: true });
      });
      s.alpha(s.ease('pick', 0.6), () => {
        F.hline(100, s.c('red'), 0.35, [1.2, 0.9]);
        s.text('target: 100 tokens/s each', F.X(2.25), F.Y(100) + u * 3.5, { size: 3.2, align: 'left', color: s.c('red'), halo: true });
        const best = TRADE.reduce((b, c, i) => (c.userS >= 100 ? i : b), 0);
        F.dot(xs[best]!, ys[best]!, 1.8, s.c('red'));
      });
    });
  },
};

// ---------------------------------------------------------------- recap

const outro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const items: [string, string, K, string][] = [
      ['memory-bound decode', 'every weight read per token', 'blue', 'mem'],
      ['batching', 'share each read among B users', 'purple', 'batch'],
      ['continuous batching', 'refill a slot every step', 'purple', 'cont'],
      ['paged attention', '16-token blocks, a block table', 'green', 'paged'],
      ['quantization', 'int8, int4, fp8; scales; outliers', 'teal', 'quant'],
      ['speculative decoding', 'draft k, verify once, exactly p', 'gold', 'spec'],
      ['distillation', 'a smaller model to serve', 'orange', 'distill'],
    ];
    const cols = s.tall ? 1 : 2;
    const gap = u * 2.4;
    const cw = (w - u * 10 - gap * (cols - 1)) / cols;
    const rows = Math.ceil(items.length / cols);
    const top = h * 0.14;
    const ch = Math.min(u * 14, (h * 0.8 - (rows - 1) * gap) / rows);
    items.forEach(([head, note, k, id], i) => {
      const col = cols === 1 ? 0 : i % cols;
      const row = cols === 1 ? i : Math.floor(i / cols);
      card(s, u * 5 + col * (cw + gap), top + row * (ch + gap), cw, ch, head, note, k, s.since(id) >= 0 && s.since('next') < 0 && current(s, items.map((x) => x[3])) === id ? 0.8 : 0.25, s.ease(id, 0.5));
    });
    s.alpha(s.ease('next', 0.6), () => {
      if (cols === 2) card(s, u * 5 + cw + gap, top + 3 * (ch + gap), cw, ch, 'a token costs bytes', 'move fewer, or get more from each', 'red', 0.8);
      else {
        s.rrect(0, 0, w, h, 0, { fill: s.tint('--card', 0.75) });
        s.rrect(u * 8, h * 0.4, w - u * 16, u * 18, 2, { fill: s.c('--card') });
        card(s, u * 8, h * 0.4, w - u * 16, u * 18, 'a token costs bytes, not arithmetic', 'move fewer, or get more from each one', 'red', 0.8);
      }
    });
    void smooth;
  },
};

export const scenesB: Record<string, SceneDef> = { quant, outliers, specidea, specrule, specspeed, distill, outro };

import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01 } from '../../../lecture/scene';
import { cells } from '../../draw';
import type { Ink } from '../draw';
import { gpu, mono } from '../draw';

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** Mono text where `_1` is drawn as a lowered small index: the mono face has no subscript glyphs. */
function lab(s: Scene, text: string, x: number, y: number, o: { size?: number; k?: Ink; align?: CanvasTextAlign; weight?: number; halo?: boolean } = {}) {
  const size = o.size ?? 3.4;
  const parts = text.split(/(_\d)/).filter(Boolean).map((p) => (p.startsWith('_') ? { t: p.slice(1), sub: true } : { t: p, sub: false }));
  const opt = (sub: boolean) => ({ size: sub ? size * 0.65 : size, font: 'mono' as const, weight: o.weight ?? 550 });
  const ws = parts.map((p) => s.measure(p.t, opt(p.sub)));
  const total = ws.reduce((a, b) => a + b, 0);
  let cur = o.align === 'left' ? x : o.align === 'right' ? x - total : x - total / 2;
  parts.forEach((p, i) => {
    s.text(p.t, cur, p.sub ? y + size * 0.28 * s.u : y, { ...opt(p.sub), align: 'left', color: s.c(o.k ?? '--ink'), halo: o.halo });
    cur += ws[i]!;
  });
}

const X = [1, 2];
const W1 = [
  [1, 0, 2, -1],
  [1, 1, 0, 1],
];
const H = [0, 1, 2, 3].map((j) => X[0]! * W1[0]![j]! + X[1]! * W1[1]![j]!);
const W2 = [
  [1, 0],
  [0, 1],
  [1, 1],
  [-1, 0],
];
const f = (v: number) => String(v).replace('-', '−');
const GK = ['blue', 'green'] as const;
const CK = ['blue', 'green', 'orange', 'purple'] as const;

const problem: SceneDef = {
  draw(s) {
    const n = 4;
    const gap = 3;
    const cw = Math.min(30, (s.w / s.u - 10 - gap * (n - 1)) / n);
    const ch = 44;
    const cy = s.h * 0.58;
    const xs = Array.from({ length: n }, (_, i) => s.w / 2 + (i - (n - 1) / 2) * (cw + gap) * s.u);
    // Each card's memory, bottom-anchored, with the weights it has to hold.
    const top = cy - (ch / 2 - 7) * s.u;
    const bot = cy + (ch / 2 - 3) * s.u;
    const mh = bot - top;
    const grow = s.ease('big', 1.4, 0.5);
    const cut = s.ease('cut', 0.9, 0.4);
    xs.forEach((x, i) => {
      s.alpha(s.ease('gpu', 0.6, i === 0 ? 0 : 2 + 0.3 * i), () => {
        gpu(s, x, cy, cw, ch, `GPU ${i}`, { size: 3 });
        s.rrect(x - (cw / 2 - 2.5) * s.u, top, (cw - 5) * s.u, mh, 0.8, { stroke: s.tint('slate', 0.5), lw: 0.2 });
        s.alpha(s.ease('gpu', 0.6, 4) * (1 - s.ease('copy', 0.4)), () => mono(s, 'memory', x, (top + bot) / 2, { size: 2.7, k: '--ink-3' }));
      });
      // A full copy of w, which grows past the card, then a quarter of it.
      const full = 0.55 + 0.95 * grow;
      const hgt = mh * (full + (0.375 - full) * cut);
      const over = hgt > mh + 0.01;
      s.alpha(s.ease('copy', 0.6, 0.3 * i), () => {
        const k = cut > 0.5 ? CK[i]! : over ? 'red' : 'blue';
        const w = (cw - 7) * s.u;
        s.rrect(x - w / 2, bot - 1 * s.u - hgt + 2 * s.u, w, hgt - 2 * s.u, 0.8, { fill: s.tint(k, 0.3), stroke: s.tint(k, 0.9), lw: 0.3 });
        mono(s, cut > 0.5 ? `w${i}` : 'w', x, bot - hgt / 2, { size: 3.6, k, weight: 700, halo: true });
      });
    });
    const cap = (text: string, a: number, k: 'red' | '--ink-2' = '--ink-2') => s.alpha(a, () => mono(s, text, s.w / 2, s.h * 0.1, { size: s.tall ? 3.1 : 3.5, k, weight: 650 }));
    cap('data parallel: a full copy of w on each GPU', s.win('copy', 'big'));
    cap('w too big for one GPU', s.win('big', 'cut'), 'red');
    cap('cut w: one piece per GPU', s.ease('cut', 0.6));
  },
};

const columns: SceneDef = {
  draw(s) {
    const sp = s.ease('split', 0.8);
    const gap = s.tall ? 12 : 13;
    const cx = s.w / 2 + 6 * s.u;
    const xs = [0, 1, 2, 3].map((j) => cx + (j - 1.5) * gap * s.u + (j < 2 ? -1 : 1) * 4 * sp * s.u);
    const ys = [s.h * 0.3, s.h * 0.42];
    const yh = s.h * 0.59;
    const cardY = s.h * 0.47;
    const lit = (j: number) => (j === 0 ? s.win('cols', 'split') : 0);
    // GPU cards around each half once the columns are split.
    s.alpha(sp, () => {
      [0, 1].forEach((g) => {
        const mid = (xs[2 * g]! + xs[2 * g + 1]!) / 2;
        gpu(s, mid, cardY, 2 * gap - 1, 58, `GPU ${g}`, { k: GK[g], on: s.win('own', 'shape') });
      });
    });
    // x's entries sit by the rows they multiply.
    const xx = xs[0]! - (s.tall ? 17 : 19) * s.u;
    X.forEach((v, i) => cells(s, [xx], ys[i]!, [String(v)], 'orange', { w: 8, h: 8, size: 3.4, on: [lit(0)] }));
    mono(s, 'x', xx, ys[0]! - 7.4 * s.u, { size: 3.8, k: 'orange', weight: 650 });
    s.alpha(s.ease('x', 0.6, 2.5) * (1 - s.ease('W', 0.5)), () => mono(s, 'd = 2', xx, ys[1]! + 7.6 * s.u, { size: 3, k: '--ink-2' }));
    s.alpha(s.ease('W', 0.6), () => {
      W1.forEach((r, i) => cells(s, xs, ys[i]!, r.map(f), 'blue', { w: 10, h: 8, size: 3.4, on: r.map((_, j) => lit(j)) }));
      lab(s, 'W_1', xs[3]! + 9 * s.u, (ys[0]! + ys[1]!) / 2, { size: 3.8, k: 'blue', weight: 650, align: 'left' });
      s.alpha(s.ease('W', 0.6, 2) * (1 - sp), () => mono(s, 'one row per input, one column per output', cx, ys[1]! + 7.6 * s.u, { size: 2.9, k: '--ink-3' }));
    });
    s.alpha(s.win('wide', 'shape'), () => lab(s, 'W_1: (d, 4d) = (2, 4)', s.w / 2, s.h * 0.1, { size: 3.6, weight: 650 }));
    // Each output under its own column.
    s.alpha(s.ease('cols', 0.6), () => {
      [0, 1, 2, 3].forEach((j) => s.alpha(j === 0 ? 1 : s.ease('cols', 0.6, 3), () => cells(s, [xs[j]!], yh, [String(H[j])], '--ink-2', { w: 10, h: 8, size: 3.4, on: [j === 0 ? lit(0) : 0] })));
      mono(s, 'h', xx, yh, { size: 3.8, k: 'gold', weight: 650 });
      s.alpha(s.win('cols', 'split'), () => mono(s, '1·1 + 2·1 = 3', xs[0]!, yh + 8 * s.u, { size: 3.2, k: '--ink-2' }));
    });
    s.alpha(s.ease('own', 0.6, 1), () => {
      mono(s, 'own outputs', (xs[0]! + xs[1]!) / 2, yh + 8.5 * s.u, { size: 2.9, k: GK[0] });
      mono(s, 'own outputs', (xs[2]! + xs[3]!) / 2, yh + 8.5 * s.u, { size: 2.9, k: GK[1] });
    });
    s.alpha(s.ease('shape', 0.6), () => mono(s, 'k GPUs, each piece: (d, 4d / k)', s.w / 2, s.h * 0.1, { size: 3.6, weight: 650 }));
  },
};

const rows: SceneDef = {
  draw(s) {
    const cy = s.h * 0.44;
    const half = s.tall ? 26 : 30;
    const parts = [
      [3, 2],
      [1, 2],
    ];
    const tensor = s.win('tensor', undefined);
    [0, 1].forEach((g) => {
      const cx = s.w / 2 + (g ? half : -half) * s.u;
      gpu(s, cx, cy + 2 * s.u, 2 * half - 4, 50, `GPU ${g}`, { k: GK[g] });
      const hx = cx - 14 * s.u;
      const wx = [cx + 1 * s.u, cx + 12 * s.u];
      const ry = [cy - 6 * s.u, cy + 4 * s.u];
      mono(s, 'h', hx, ry[0]! - 7 * s.u, { size: 3.4, k: 'gold', weight: 650 });
      H.slice(2 * g, 2 * g + 2).forEach((v, i) => cells(s, [hx], ry[i]!, [String(v)], 'gold', { w: 8, h: 8, size: 3.4 }));
      s.alpha(s.ease('w2', 0.6, 1), () => {
        lab(s, 'W_2 rows', (wx[0]! + wx[1]!) / 2, ry[0]! - 7 * s.u, { size: 3.2, k: 'blue', weight: 650 });
        W2.slice(2 * g, 2 * g + 2).forEach((r, i) => cells(s, wx, ry[i]!, r.map(f), 'blue', { w: 10, h: 8, size: 3.4, on: [tensor, tensor] }));
      });
      s.alpha(s.ease('part', 0.6, g * 2.5), () => {
        mono(s, 'partial', cx - 9 * s.u, cy + 17 * s.u, { size: 3, k: '--ink-3', align: 'right' });
        cells(s, [cx - 2 * s.u, cx + 9 * s.u], cy + 17 * s.u, parts[g]!.map(String), GK[g], { w: 10, h: 8, size: 3.4, on: [1, 1] });
      });
    });
    s.alpha(s.ease('sum', 0.6), () => {
      const y = s.h * 0.9;
      const yp = cy + 17 * s.u;
      [-1, 1].forEach((side) => s.arrow(s.w / 2 + side * (half - 6.5) * s.u, yp + 5 * s.u, s.w / 2 + side * 7 * s.u, y - 5.5 * s.u, s.c('--ink-3'), 0.3, 1.8));
      mono(s, '+', s.w / 2, (yp + y) / 2, { size: 5, k: '--ink-2', weight: 700 });
      cells(s, [s.w / 2 - 6 * s.u, s.w / 2 + 6 * s.u], y, ['4', '4'], 'purple', { w: 10, h: 8, size: 3.6, on: [1, 1] });
      mono(s, 'output', s.w / 2 - 13 * s.u, y, { size: 3.2, k: 'purple', align: 'right', weight: 650 });
      mono(s, 'summed across GPUs', s.w / 2 + 13 * s.u, y, { size: 3, k: '--ink-2', align: 'left' });
    });
    const cap = (text: string, a: number) => s.alpha(a, () => lab(s, text, s.w / 2, s.h * 0.11, { size: s.tall ? 3.2 : 3.6, weight: 650 }));
    cap('W_2: (4d, d), cut by rows', s.win('w2', 'rshape'));
    cap('k GPUs, each piece: (4d / k, d)', s.win('rshape', 'megatron'));
    cap('columns, then rows: one exchange', s.win('megatron', 'tensor'));
    cap('tensor: any array of numbers', tensor);
    cite(s, 'Megatron-LM · Shoeybi et al., 2019', s.ease('megatron', 0.6));
  },
};

const SK = ['blue', 'orange', 'green', 'purple'] as const;

const pipeline: SceneDef = {
  draw(s) {
    const gapStage = s.tall ? 3.2 : 5;
    const lw = Math.min(4.4, (s.w / s.u - 18 - 3 * gapStage) / 24);
    const total = 24 * lw + 3 * gapStage;
    const x0 = s.w / 2 - (total / 2) * s.u;
    const lx = (i: number) => x0 + (i * lw + Math.floor(i / 6) * gapStage + lw / 2) * s.u;
    const y = s.h * 0.42;
    const hh = 22;
    // Work moving through the stages: one whole batch, then a stream of micro-batches.
    // Positions are in stage widths, 0 at stage 0's left edge.
    const tg = s.at('gpipe');
    const durG = s.end('gpipe') - tg;
    const one = clamp01((s.t - tg) / (0.32 * durG)) * 4;
    const tm = s.t - (tg + 0.5 * durG);
    const stream = Array.from({ length: 8 }, (_, i) => 0.5 * tm - i);
    const showOne = s.win('gpipe', undefined) * (1 - smoothStep(tm, 0, 0.6));
    const showStream = smoothStep(tm, 0, 0.6) * (1 - s.ease('compare', 0.6));
    const busy = [0, 1, 2, 3].map((st) => {
      const a = showOne > 0.01 && one >= st && one < st + 1 ? showOne : 0;
      const b = stream.some((q) => q >= st && q < st + 1) ? showStream : 0;
      return Math.max(a, b);
    });
    for (let i = 0; i < 24; i++) {
      const st = Math.floor(i / 6);
      const hi = Math.max(i === 13 ? s.win('which', 'send') : 0, busy[st]!);
      s.rrect(lx(i) - (lw / 2 - 0.4) * s.u, y - (hh / 2) * s.u, (lw - 0.8) * s.u, hh * s.u, 0.6, { fill: s.tint(SK[st]!, 0.25 + 0.45 * hi), stroke: s.tint(SK[st]!, 0.7 + 0.3 * hi), lw: 0.25 + 0.3 * hi });
    }
    s.alpha(s.ease('layers', 0.6, 1.5), () => {
      for (let st = 0; st < 4; st++) {
        const mid = (lx(6 * st) + lx(6 * st + 5)) / 2;
        mono(s, `stage ${st}`, mid, y + (hh / 2 + 4) * s.u, { size: s.tall ? 2.8 : 3.2, k: SK[st], weight: 650 });
        mono(s, `${6 * st}–${6 * st + 5}`, mid, y + (hh / 2 + 8) * s.u, { size: s.tall ? 2.7 : 3, k: '--ink-3' });
      }
    });
    mono(s, '24 layers, 4 GPUs: 6 each', s.w / 2, s.h * 0.1, { size: 3.6, weight: 650 });
    s.alpha(s.win('which', 'send'), () => {
      mono(s, 'layer 13', lx(13), y - (hh / 2 + 4) * s.u, { size: 3.2, k: 'green', weight: 650 });
      mono(s, '13 // 6 = 2', s.w / 2, s.h * 0.82, { size: 3.6, k: 'green', weight: 650 });
    });
    s.alpha(s.win('send', 'gpipe'), () => {
      for (let st = 0; st < 3; st++) {
        const a = lx(6 * st + 5);
        const b = lx(6 * st + 6);
        const top = y - (hh / 2 + 3) * s.u;
        s.arrow(a - 1 * s.u, top, b + 1 * s.u, top, s.c('--ink-2'), 0.35, 1.8);
        s.alpha(s.ease('send', 0.6, 2.5), () => s.arrow(b + 1 * s.u, top - 3.5 * s.u, a - 1 * s.u, top - 3.5 * s.u, s.c('red'), 0.35, 1.8));
      }
      mono(s, 'output forward, its gradient back', s.w / 2, s.h * 0.82, { size: s.tall ? 3.2 : 3.6, k: '--ink-2' });
    });
    // The work itself, as boxes riding along the stages.
    const left = lx(0) - (lw / 2) * s.u;
    const right = lx(23) + (lw / 2) * s.u;
    const at = (q: number) => left + (q / 4) * (right - left);
    // A box rides with its position but stays inside the row at the ends.
    const mid = (q: number) => Math.min(3.5, Math.max(0.5, q));
    s.alpha(showOne, () => {
      if (one < 4) box(s, at(mid(one)), y, 11, 'batch', '--ink');
    });
    s.alpha(showStream, () => stream.forEach((q, i) => {
      if (q > -0.3 && q < 4) s.alpha(clamp01((q + 0.3) / 0.3) * clamp01((4 - q) / 0.3), () => box(s, at(mid(q)), y, 6, String(i + 1), '--ink'));
    }));
    const cap = (text: string, a: number, k: 'red' | 'green') => s.alpha(a, () => mono(s, text, s.w / 2, s.h * 0.82, { size: s.tall ? 3.2 : 3.6, k, weight: 650 }));
    cap('one batch: one stage busy', s.win('gpipe', undefined) * (1 - smoothStep(tm, 0, 0.6)), 'red');
    cap('micro-batches: every stage busy', showStream, 'green');
    cite(s, 'GPipe · Huang et al., 2018', s.win('gpipe', 'compare'));
    s.alpha(s.ease('compare', 0.6), () => {
      const o = { size: s.tall ? 3 : 3.3, k: '--ink-2' as const };
      mono(s, 'tensor (columns): inside every layer', s.w / 2, s.h * 0.77, o);
      mono(s, 'pipeline (layers): only at its cuts', s.w / 2, s.h * 0.84, o);
      mono(s, 'data: once per step', s.w / 2, s.h * 0.91, o);
    });
  },
};

/** 0 -> 1 as v goes from a to a + d, smoothed. */
function smoothStep(v: number, a: number, d: number): number {
  const t = clamp01((v - a) / d);
  return t * t * (3 - 2 * t);
}

/** A unit of work riding on the layer row: a labelled card-colored box. */
function box(s: Scene, x: number, y: number, w: number, label: string, k: Ink) {
  s.rrect(x - (w / 2) * s.u, y - 3.2 * s.u, w * s.u, 6.4 * s.u, 1, { fill: s.c('--card'), stroke: s.c(k), lw: 0.45 });
  mono(s, label, x, y + 0.2 * s.u, { size: 3, k, weight: 700 });
}

export const scenes: Record<string, SceneDef> = { problem, columns, rows, pipeline };

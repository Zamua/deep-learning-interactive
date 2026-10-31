import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01, lerp } from '../../../lecture/scene';
import { columns } from '../../draw';
import type { Ink } from '../../../lecture/scene';
import { after } from '../../draw';
import { brace, rich } from '../../linear-algebra/draw';
import { hbar, mark, word } from '../draw';
import { gpu } from '../../scale/draw';

/** The model: 32 layers, d = 4,000, 2 bytes per number, 8 billion parameters, on an 80 GB GPU. */
const PER_TOKEN = 2 * 32 * 4000 * 2;
const GPU_GB = 80;
const WEIGHTS_GB = 16;
const gbOf = (tokens: number) => (tokens * PER_TOKEN) / 1e9;

const mono = (s: Scene, t: string, x: number, y: number, k: Ink, size = 3.2, o: { weight?: number; align?: CanvasTextAlign; halo?: boolean } = {}) =>
  s.text(t, x, y, { size, font: 'mono', weight: o.weight ?? 600, align: o.align ?? 'center', color: s.c(k), halo: o.halo });

/** A centered caption line. */
const cap = (s: Scene, t: string, y: number, a: number, k: Ink = '--ink-2', size = 3.4) => s.alpha(a, () => mono(s, t, s.w / 2, y, k, s.tall ? size - 0.2 : size, { halo: true }));

/** Who found it, and when: small and italic. */
function cite(s: Scene, text: string, y: number, a: number): void {
  s.alpha(a, () => s.text(text, s.w / 2, y, { size: 3.2, italic: true, color: s.c('--ink-2'), halo: true }));
}

// ---- fill: one GPU's memory, the fixed weights, and the caches that grow until it is full

const SEQ = ['The', 'cat', 'sat', 'on', 'the', 'mat', 'and'];
/** Sixteen sequences arrive, then sixteen more until 64 GB of caches fill the GPU. */
const FIRST = 16;
const ALL = (GPU_GB - WEIGHTS_GB) / gbOf(4000);

/** A chip seen from above: a square die with pins along every side. */
function chip(s: Scene, x: number, y: number, side: number): void {
  const u = s.u;
  const pins = 6;
  for (let i = 0; i < pins; i++) {
    const o = -side / 2 + ((i + 0.5) * side) / pins;
    s.line(x + o, y - side / 2 - 2.4 * u, x + o, y - side / 2, s.c('slate'), 0.5);
    s.line(x + o, y + side / 2, x + o, y + side / 2 + 2.4 * u, s.c('slate'), 0.5);
    s.line(x - side / 2 - 2.4 * u, y + o, x - side / 2, y + o, s.c('slate'), 0.5);
    s.line(x + side / 2, y + o, x + side / 2 + 2.4 * u, y + o, s.c('slate'), 0.5);
  }
  s.rrect(x - side / 2, y - side / 2, side, side, 1.6, { fill: s.tint('slate', 0.25), stroke: s.c('slate'), lw: 0.4 });
  mono(s, 'GPU', x, y, 'slate', 4.4, { weight: 700 });
}

const fill: SceneDef = {
  draw(s) {
    const u = s.u;
    const cardW = Math.min(s.w / u - 10, 112);
    const cardH = (s.h * 0.5) / u;
    const cy = s.h * 0.62;
    const top = cy - (cardH / 2) * u;
    const W = (cardW - 10) * u;
    const x0 = s.w / 2 - W / 2;
    const yBar = cy - 1 * u;
    const hBar = 12 * u;
    const px = (gb: number) => (gb / GPU_GB) * W;

    // The sequence being written, and its context.
    const xs = columns(s, SEQ.length, s.tall ? 11.5 : 12.5);
    const yT = s.h * 0.17;
    SEQ.forEach((t, j) => {
      const a = j < 5 ? s.ease('serve', 0.5, 0.8 + 0.25 * j) : s.ease('cache', 0.5, 0.8 + 1.4 * (j - 5));
      s.alpha(a, () => word(s, xs[j]!, yT, t, 'orange', { size: 3, on: j >= 5 ? 1 - s.ease('full', 0.6) : 0 }));
    });
    const grown = s.ease('cache', 0.5, 0.8) + s.ease('cache', 0.5, 2.2);
    const right = xs[4 + Math.min(2, Math.round(grown))]! + 5 * u;
    s.alpha(s.win('serve', 'full') * after(s, 'serve', 0.55), () => brace(s, 'bottom', xs[0]! - 5 * u, right, yT + 5 * u, 'context: the tokens read so far', 'orange', 3.2));

    // The GPU and its memory.
    s.alpha(s.ease('gpu', 0.6), () => gpu(s, s.w / 2, cy, cardW, cardH, 'GPU: graphics processing unit', { size: 3.3 }));
    s.alpha(s.win('gpu', 'mem') * s.ease('gpu', 0.6, 0.6), () => chip(s, s.w / 2, cy + 2 * u, 22 * u));
    s.alpha(s.ease('mem', 0.6), () => {
      mono(s, `memory: ${GPU_GB} GB`, x0, yBar - hBar / 2 - 4 * u, '--ink-2', 3.3, { align: 'left' });
      s.rrect(x0, yBar - hBar / 2, W, hBar, 1, { stroke: s.c('--ink-3'), lw: 0.3 });
    });
    const wGrow = s.ease('weights', 1);
    s.alpha(wGrow, () => {
      s.rrect(x0, yBar - hBar / 2, px(WEIGHTS_GB) * wGrow, hBar, 1, { fill: s.tint('slate', 0.35), stroke: s.c('slate'), lw: 0.3 });
      mono(s, 'weights', x0 + px(WEIGHTS_GB) / 2, yBar + hBar / 2 + 4 * u, 'slate', 3.2, { weight: 650 });
      mono(s, `${WEIGHTS_GB} GB`, x0 + px(WEIGHTS_GB) / 2, yBar + hBar / 2 + 8.5 * u, 'slate', 3.2);
    });

    // The caches: sixteen sequences appear and grow token by token, then more until it is full.
    const born = s.ease('serve', 1.6, 1);
    const toks = lerp(300, 4000, s.ease('cache', 2.4, 0.6));
    const more = s.ease('full', 2.2, 0.4);
    const n = Math.min(ALL, FIRST * born + (ALL - FIRST) * more);
    let at = x0 + px(WEIGHTS_GB);
    let total = 0;
    for (let i = 0; i < Math.ceil(n); i++) {
      const part = Math.min(1, n - i);
      const t = i < FIRST ? toks : 4000;
      const w = px(gbOf(t)) * part;
      total += gbOf(t) * part;
      if (w > 0.2) s.rrect(at + 0.1 * u, yBar - hBar / 2 + 0.8 * u, Math.max(0.2, w - 0.2 * u), hBar - 1.6 * u, 0.3, { fill: s.tint('gold', i === 0 ? 0.85 : 0.5) });
      at += w;
    }
    const cx = x0 + px(WEIGHTS_GB) + Math.max(px(total) / 2, 12 * u);
    s.alpha(born, () => {
      mono(s, 'KV caches', cx, yBar + hBar / 2 + 4 * u, 'gold', 3.2, { weight: 650 });
      mono(s, `${Math.round(total)} GB`, cx, yBar + hBar / 2 + 8.5 * u, 'gold', 3.2);
    });
    const freeX = (at + x0 + W) / 2;
    s.alpha(s.ease('mem', 0.6) * (1 - more) * clamp01((x0 + W - at) / (14 * u)), () => mono(s, 'free', freeX, yBar, '--ink-3', 3));
    s.alpha(after(s, 'full', 0.55), () => {
      s.rrect(x0 - 0.6 * u, yBar - hBar / 2 - 0.6 * u, W + 1.2 * u, hBar + 1.2 * u, 1.4, { stroke: s.c('red'), lw: 0.5 });
      mono(s, 'full', x0 + W - 1 * u, yBar - hBar / 2 - 4 * u, 'red', 3.2, { weight: 700, align: 'right' });
    });
    const yNote = top + cardH * u - 5.5 * u;
    s.alpha(s.win('cache', 'full'), () => mono(s, '16 sequences, growing', s.w / 2, yNote, 'gold', 3.2));
    s.alpha(s.ease('full', 0.6, 1.5) * (1 - s.ease('kwon', 0.6, 2)), () => mono(s, 'about 31 sequences of 4,000 tokens', s.w / 2, yNote, 'gold', 3.2));
    s.alpha(s.ease('kwon', 0.6, 2), () => mono(s, 'the cache caps how many fit', s.w / 2, yNote, 'red', 3.2, { weight: 650 }));

    const r1 = s.h * 0.065;
    cap(s, 'a chip built for graphics, used for networks', r1, s.win('gpu', 'mem'));
    cap(s, 'everything must fit in its memory', r1, s.win('mem', 'weights'));
    cap(s, '8 billion parameters × 2 bytes = 16 GB', r1, s.win('weights', 'serve'), 'slate');
    cap(s, 'one sequence per person', r1, s.win('serve', 'cache'), 'orange');
    cap(s, 'each sequence: its own KV cache', r1, s.win('cache', 'full'), 'gold');
    cap(s, 'the cache, not the weights, fills it', r1, s.win('full', 'kwon'), 'red');
    cite(s, 'Kwon et al., 2023 · vLLM', r1, s.ease('kwon', 0.6));
  },
};

// ---- token: one token's slice of the cache, built one factor at a time

const TOKENS = ['The', 'cat', 'sat', 'on', 'the'];
const LAYERS = ['layer 1', 'layer 2', 'layer 3', 'layer 32'];

/** One cache slot: a key bar over a value bar. */
function slot(s: Scene, x: number, y: number, w: number, on: number): void {
  const h = 2 * s.u;
  s.rrect(x - w / 2, y - h - 0.3 * s.u, w, h, 0.6, { fill: s.tint('gold', 0.3 + 0.5 * on), stroke: s.tint('gold', 0.7 + 0.3 * on), lw: 0.25 + 0.2 * on });
  s.rrect(x - w / 2, y + 0.3 * s.u, w, h, 0.6, { fill: s.tint('teal', 0.3 + 0.5 * on), stroke: s.tint('teal', 0.7 + 0.3 * on), lw: 0.25 + 0.2 * on });
}

const X3 = '--ink-3';
const PRODUCTS: [string, Ink][][] = [
  [['2', 'gold'], [' vectors: a key and a value', '--ink-2']],
  [['2', 'gold'], [' × ', X3], ['4,000', 'slate'], [' = 8,000 numbers', '--ink-2']],
  [['2', 'gold'], [' × ', X3], ['4,000', 'slate'], [' × ', X3], ['32', 'purple'], [' = 256,000 numbers', '--ink-2']],
  [['2', 'gold'], [' × ', X3], ['4,000', 'slate'], [' × ', X3], ['32', 'purple'], [' × ', X3], ['2', 'green'], [' = 512,000 bytes', '--ink-2']],
];

const token: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 5, s.tall ? 14 : 16).map((x) => x + 6 * u);
    const yT = s.h * 0.08;
    const ys = [0.2, 0.28, 0.36, 0.49].map((f) => s.h * f);
    const lx = xs[0]! - 8 * u;
    const one = s.ease('two', 0.6);
    const col = s.ease('layers', 0.8, 0.4);
    TOKENS.forEach((t, j) => word(s, xs[j]!, yT, t, 'orange', { size: 3, on: j === 2 ? one : 0 }));
    LAYERS.forEach((name, i) => {
      s.alpha(s.ease('grid', 0.5, 0.4 + 0.3 * i), () => {
        s.text(name, lx, ys[i]!, { size: 3, font: 'mono', align: 'right', color: s.c(i && col > 0.5 ? 'purple' : '--ink-3') });
        xs.forEach((x, j) => slot(s, x, ys[i]!, 9 * u, j === 2 ? (i === 0 ? one : col) : 0));
      });
    });
    s.alpha(s.ease('grid', 0.5, 1.4), () => {
      xs.forEach((x) => s.text('⋮', x, (ys[2]! + ys[3]!) / 2, { size: 3, color: s.c('--ink-3') }));
      s.text('key', xs[4]! + 6 * u, ys[0]! - 1.3 * u, { size: 2.6, font: 'mono', align: 'left', color: s.c('gold') });
      s.text('value', xs[4]! + 6 * u, ys[0]! + 1.3 * u, { size: 2.6, font: 'mono', align: 'left', color: s.c('teal') });
    });
    // The column of one token, down every layer.
    s.alpha(col, () => {
      const x = xs[2]!;
      s.rrect(x - 6 * u, ys[0]! - 4 * u, 12 * u, ys[3]! - ys[0]! + 8 * u, 1.4, { stroke: s.c('purple'), lw: 0.4 });
    });

    // One slot opened up: d numbers in each vector.
    const yv = s.h * 0.66;
    s.alpha(s.win('d', 'layers'), () => {
      const n = 40;
      const L = s.w / 2 - 32 * u;
      const W = 64 * u;
      ([['key', 'gold', yv - 2.8 * u], ['value', 'teal', yv + 2.8 * u]] as const).forEach(([name, k, y]) => {
        for (let i = 0; i < n; i++) s.rrect(L + (i * W) / n, y - 2 * u, W / n - 0.4 * u, 4 * u, 0.3, { fill: s.tint(k, 0.45) });
        s.text(name, L - 1.5 * u, y, { size: 2.7, font: 'mono', align: 'right', color: s.c(k) });
      });
      mono(s, 'd = 4,000 numbers in each', s.w / 2, yv - 8.5 * u, 'slate', 3.1, { weight: 650 });
    });
    cite(s, 'Kwon et al., 2023: a 13 billion parameter model', yv, s.ease('opt', 0.6));

    // The product, one factor per beat.
    const y1 = s.h * 0.79;
    const y2 = s.h * 0.88;
    const o = { size: s.tall ? 3.2 : 3.5, weight: 650 } as const;
    const beats = ['two', 'd', 'layers', 'bytes'];
    s.alpha(s.win('grid', 'two') * after(s, 'grid', 0.55), () => mono(s, 'blocks, also called layers', s.w / 2, y1, 'purple', s.tall ? 3.2 : 3.5, { weight: 650 }));
    beats.forEach((b, i) => s.alpha(s.win(b, beats[i + 1] ?? 'opt'), () => rich(s, PRODUCTS[i]!, s.w / 2, y1, o)));
    s.alpha(s.ease('opt', 0.6), () => rich(s, [['2', 'gold'], [' × ', X3], ['5,120', 'slate'], [' × ', X3], ['40', 'purple'], [' × ', X3], ['2', 'green'], [' = 819,200 bytes', '--ink-2']], s.w / 2, y1, o));
    s.alpha(s.win('mb', 'opt'), () => mono(s, '≈ 0.5 MB, a megabyte: a million bytes', s.w / 2, y2, 'gold', s.tall ? 3.1 : 3.4, { weight: 650 }));
    s.alpha(s.ease('opt', 0.6, 1), () => mono(s, 'over 800,000 bytes per token', s.w / 2, y2, 'gold', s.tall ? 3.1 : 3.4, { weight: 650 }));
  },
};

// ---- grow: the cache scales with every factor, and with nothing outside them

const ROWS: [string, number, string, Ink, string][] = [
  ['4,000 tokens', gbOf(4000), '2 GB', 'gold', 'ctx'],
  ['8,000 tokens', gbOf(8000), '4 GB', 'orange', 'double'],
  ['16 × 4,000 tokens', gbOf(4000) * 16, '33 GB', 'red', 'batch'],
  ['the weights', WEIGHTS_GB, '16 GB', 'slate', 'batch'],
];
const FACTORS: [string, Ink][] = [['2', 'gold'], ['layers', 'purple'], ['tokens', 'orange'], ['d', 'slate'], ['bytes', 'green']];

const grow: SceneDef = {
  marks: {
    f: { tex: String.raw`2 \times \text{layers} \times \text{tokens} \times d \times \text{bytes}`, x: 0.5, y: 0.09, size: 4.4 },
  },
  draw(s) {
    const u = s.u;
    s.show('f', s.ease('formula', 0.6));
    const bars = 1 - s.ease('not', 0.6);
    const x0 = s.w / 2 - (s.tall ? 38 : 42) * u;
    const full = (s.tall ? 60 : 68) * u;
    s.alpha(bars, () => {
      ROWS.forEach(([name, gb, label, k, beat], i) => {
        const y = s.h * (0.3 + i * 0.17);
        const delay = i === 3 ? 2.4 : 0;
        const a = s.ease(beat, 0.6, delay);
        s.alpha(a, () => {
          mono(s, name, x0, y - 5.2 * u, '--ink-3', 2.9, { align: 'left', weight: 500 });
          hbar(s, x0, y, (full * gb * s.ease(beat, 1, 0.3 + delay)) / gbOf(4000 * 16), k, label, { h: 5.4 });
        });
      });
      s.alpha(s.ease('ctx', 0.6, 1.6) * (1 - s.ease('formula', 0.5)), () => mono(s, '512,000 bytes × 4,000 tokens', s.w / 2, s.h * 0.1, '--ink-2', 3.2));
      s.alpha(after(s, 'batch', 0.6), () => mono(s, '33 GB: twice the weights', s.w / 2, s.h * 0.9, 'red', 3.3, { weight: 650 }));
    });

    // What is in the product, and what is not.
    const yF = s.h * 0.3;
    const fx = columns(s, FACTORS.length, s.tall ? 19 : 21);
    s.alpha(s.ease('not', 0.6, 0.3), () => {
      mono(s, 'in the product', s.w / 2, yF - 7.5 * u, '--ink-2', 3, { weight: 650 });
      FACTORS.forEach(([t, k], i) => word(s, fx[i]!, yF, t, k, { size: 3, on: 1 }));
    });
    const yN = s.h * 0.47;
    s.alpha(after(s, 'not', 0.35) * (1 - 0.6 * s.ease('heads', 0.6)), () => {
      mono(s, 'not in it: no keys or values', s.w / 2, yN - 7.5 * u, '--ink-2', 3, { weight: 650 });
      const nx = columns(s, 2, s.tall ? 42 : 46);
      ['vocabulary', 'MLP width'].forEach((t, i) => {
        word(s, nx[i]!, yN, t, '--ink-3', { size: 3 });
        mark(s, false, nx[i]! + s.measure(t, { size: 3, font: 'mono' }) / 2 + 5 * u, yN, 3.4);
      });
    });
    // More heads split the same d numbers: the total per key stays d.
    const yH = s.h * 0.68;
    s.alpha(s.ease('heads', 0.6), () => {
      const W = (s.tall ? 72 : 80) * u;
      const L = s.w / 2 - W / 2;
      const cells = 16;
      for (let i = 0; i < cells; i++) s.rrect(L + (i * W) / cells + 0.15 * u, yH - 2.2 * u, W / cells - 0.3 * u, 4.4 * u, 0.3, { fill: s.tint('gold', 0.45) });
      const four = s.ease('heads', 0.8, 3);
      const cut = (i: number, a: number) => s.alpha(a, () => s.line(L + (i * W) / cells, yH - 4 * u, L + (i * W) / cells, yH + 4 * u, s.c('--ink'), 0.5));
      cut(8, 1);
      cut(4, four);
      cut(12, four);
      mono(s, 'one key: d numbers', s.w / 2, yH - 7.5 * u, 'slate', 3, { weight: 650 });
      s.alpha(1 - four, () => mono(s, '2 heads of d/2', s.w / 2, yH + 7.5 * u, '--ink-2', 3));
      s.alpha(four, () => mono(s, '4 heads of d/4: still d', s.w / 2, yH + 7.5 * u, '--ink-2', 3));
    });
    cap(s, 'outside the product: the cache stays the same', s.h * 0.88, s.win('not', 'heads'), '--ink-2', 3.2);
    cap(s, 'per token, per layer: still 2 × d numbers', s.h * 0.88, s.ease('heads', 0.6, 3), '--ink-2', 3.2);
  },
};

// ---- fit: the memory left after the weights, divided into token slots

const FREE_GB = GPU_GB - WEIGHTS_GB;
const FIT = (FREE_GB * 1e9) / PER_TOKEN;

const fit: SceneDef = {
  draw(s) {
    const u = s.u;
    const W = (s.tall ? 84 : 104) * u;
    const x0 = s.w / 2 - W / 2;
    const y = s.h * 0.2;
    const h = 10 * u;
    const ww = (W * WEIGHTS_GB) / GPU_GB;
    const fx = x0 + ww + 0.8 * u;
    const fw = W - ww - 0.8 * u;
    s.rrect(x0, y - h / 2, ww, h, 1, { fill: s.tint('slate', 0.3), stroke: s.c('slate'), lw: 0.3 });
    mono(s, 'weights', x0 + ww / 2, y + h / 2 + 4 * u, 'slate', 2.9);
    mono(s, `${GPU_GB} GB of memory`, x0, y - h / 2 - 3.5 * u, '--ink-3', 2.9, { align: 'left' });
    s.alpha(s.ease('free', 0.6), () => {
      s.rrect(fx, y - h / 2, fw, h, 1, { fill: s.tint('green', 0.12), stroke: s.c('green'), lw: 0.3 });
      mono(s, `${FREE_GB} GB left`, x0 + W, y - h / 2 - 3.5 * u, 'green', 3.1, { weight: 650, align: 'right' });
    });
    s.alpha(s.ease('free', 0.6, 2.5), () => mono(s, '= 64,000,000,000 bytes', fx + fw / 2, y + h / 2 + 4 * u, 'green', 2.8));
    // The free part fills with token slots, drawn a thousand tokens to a sliver.
    const n = Math.round(FIT / 1000);
    const g = s.ease('per', 1.8, 1.4);
    for (let i = 0; i < n * g; i++) s.rrect(fx + (i * fw) / n, y - h / 2 + 1 * u, Math.max(0.5, fw / n - 0.25 * u), h - 2 * u, 0.2, { fill: s.tint('gold', 0.55) });
    s.alpha(s.ease('per', 0.6), () => {
      const cy = s.h * 0.38;
      s.rrect(s.w / 2 - 22 * u, cy - 3 * u, 1.6 * u, 6 * u, 0.3, { fill: s.tint('gold', 0.55) });
      mono(s, 'one token = 512,000 bytes', s.w / 2 - 18 * u, cy, 'gold', 3.4, { align: 'left' });
    });
    s.alpha(s.ease('fit', 0.6), () => mono(s, '64,000,000,000 ÷ 512,000', s.w / 2, s.h * 0.52, '--ink-2', 3.6));
    s.alpha(s.ease('fit', 0.6, 2.5), () => mono(s, '= 64,000,000 ÷ 512', s.w / 2, s.h * 0.61, '--ink-2', 3.6));
    s.alpha(s.ease('fit', 0.6, 5), () => mono(s, '= 125,000 tokens', s.w / 2, s.h * 0.71, 'gold', 4.2, { weight: 700 }));
    // Sequences of 4,000 tokens splitting the same slots.
    const cuts = s.ease('share', 1.4, 3);
    s.alpha(cuts, () => {
      for (let j = 1; j * 4000 < FIT; j++) {
        const x = fx + ((j * 4000) / FIT) * fw;
        s.line(x, y - h / 2 - 0.8 * u, x, y + h / 2 + 0.8 * u, s.c('--ink-2'), 0.3);
      }
    });
    s.alpha(s.ease('share', 0.6), () => mono(s, 'shared: 1 sequence of 125,000 tokens', s.w / 2, s.h * 0.83, '--ink-2', 3.3));
    s.alpha(s.ease('share', 0.6, 3), () => mono(s, 'or about 31 of 4,000 each', s.w / 2, s.h * 0.9, '--ink-2', 3.3));
  },
};

export const scenes: Record<string, SceneDef> = { fill, token, grow, fit };

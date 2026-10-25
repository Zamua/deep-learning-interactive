import type { Scene, SceneDef } from '../../../lecture/scene';
import { columns } from '../../draw';
import { hbar, word } from '../draw';

const TOKENS = ['The', 'cat', 'sat', 'on', 'the'];
const LAYERS = ['layer 1', 'layer 2', 'layer 3', 'layer 32'];

/** One cache slot: a key bar over a value bar. */
function slot(s: Scene, x: number, y: number, w: number, on: number): void {
  const h = 2 * s.u;
  s.rrect(x - w / 2, y - h - 0.3 * s.u, w, h, 0.6, { fill: s.tint('gold', 0.3 + 0.4 * on), stroke: s.tint('gold', 0.7 + 0.3 * on), lw: 0.25 });
  s.rrect(x - w / 2, y + 0.3 * s.u, w, h, 0.6, { fill: s.tint('teal', 0.3 + 0.4 * on), stroke: s.tint('teal', 0.7 + 0.3 * on), lw: 0.25 });
}

const token: SceneDef = {
  draw(s) {
    const xs = columns(s, 5, s.tall ? 14 : 16).map((x) => x + 6 * s.u);
    const yT = s.h * 0.1;
    const ys = [0.22, 0.31, 0.4, 0.54].map((f) => s.h * f);
    const lx = xs[0]! - 8 * s.u;
    const col = s.ease('per', 0.6);
    TOKENS.forEach((t, j) => word(s, xs[j]!, yT, t, 'orange', { size: 3, on: j === 2 ? col : 0 }));
    LAYERS.forEach((name, i) => {
      s.alpha(s.ease('grid', 0.5, 0.4 + 0.3 * i), () => {
        s.text(name, lx, ys[i]!, { size: 2.7, font: 'mono', align: 'right', color: s.c('--ink-3') });
        xs.forEach((x, j) => slot(s, x, ys[i]!, 9 * s.u, j === 2 ? col : 0));
      });
    });
    s.alpha(s.ease('grid', 0.5, 1.4), () => {
      xs.forEach((x) => s.text('⋮', x, (ys[2]! + ys[3]!) / 2, { size: 3, color: s.c('--ink-3') }));
      s.text('key', xs[4]! + 6.5 * s.u, ys[0]! - 1.3 * s.u, { size: 2.6, font: 'mono', align: 'left', color: s.c('gold') });
      s.text('value', xs[4]! + 6.5 * s.u, ys[0]! + 1.3 * s.u, { size: 2.6, font: 'mono', align: 'left', color: s.c('teal') });
    });
    // One slot opened up: d numbers in each vector.
    const yv = s.h * 0.7;
    s.alpha(s.ease('vec', 0.6) * (1 - s.ease('per', 0.5)), () => {
      const n = 40;
      const L = s.w / 2 - 34 * s.u;
      const W = 68 * s.u;
      [['key', 'gold', yv - 3 * s.u], ['value', 'teal', yv + 3 * s.u]].forEach(([name, k, y]) => {
        for (let i = 0; i < n; i++) s.rrect(L + (i * W) / n, (y as number) - 2 * s.u, W / n - 0.4 * s.u, 4 * s.u, 0.3, { fill: s.tint(k as 'gold', 0.45) });
        s.text(name as string, L - 1.5 * s.u, y as number, { size: 2.7, font: 'mono', align: 'right', color: s.c(k as 'gold') });
      });
      s.text('d = 4,000 numbers each', s.w / 2, yv + 10 * s.u, { size: 3, font: 'mono', weight: 650, color: s.c('--ink-2') });
    });
    s.alpha(s.ease('per', 0.6, 0.4), () => {
      s.text('one token: 2 × 32 layers × 4,000 × 2 bytes', s.w / 2, s.h * 0.72, { size: 3.1, font: 'mono', color: s.c('--ink-2') });
      s.text('= 512,000 bytes ≈ half a MB', s.w / 2, s.h * 0.8, { size: 3.6, font: 'mono', weight: 650, color: s.c('gold') });
    });
  },
};

/** Cache sizes in GB for the grow scene, against the 14 GB of weights. */
const ROWS: [string, number, string, 'gold' | 'orange' | 'red' | 'slate'][] = [
  ['4,000 tokens', 2.048, '2 GB', 'gold'],
  ['8,000 tokens', 4.096, '4 GB', 'orange'],
  ['16 × 4,000 tokens', 32.768, '33 GB', 'red'],
  ['the weights', 14, '14 GB', 'slate'],
];
const BEAT = ['ctx', 'double', 'batch', 'weights'];

const grow: SceneDef = {
  marks: {
    f: { tex: String.raw`2 \times \text{layers} \times \text{tokens} \times d \times \text{bytes}`, x: 0.5, y: 0.1, size: 4.4 },
  },
  draw(s) {
    s.show('f', s.ease('formula', 0.6));
    const x0 = s.w / 2 - (s.tall ? 36 : 40) * s.u;
    const full = (s.tall ? 62 : 70) * s.u;
    ROWS.forEach(([name, gb, label, k], i) => {
      const y = s.h * (0.3 + i * 0.18);
      const a = s.ease(BEAT[i]!, 0.6);
      s.alpha(a, () => {
        s.text(name, x0, y - 5.2 * s.u, { size: 2.9, font: 'mono', align: 'left', color: s.c('--ink-3') });
        hbar(s, x0, y, (full * gb * s.ease(BEAT[i]!, 1, 0.3)) / 32.768, k, label, { h: 5.4 });
      });
    });
    s.alpha(s.ease('ctx', 0.6, 1.6) * (1 - s.ease('formula', 0.5)), () => s.text('512,000 bytes × 4,000 tokens', s.w / 2, s.h * 0.1, { size: 3.2, font: 'mono', color: s.c('--ink-2') }));
  },
};

export const scenes: Record<string, SceneDef> = { token, grow };

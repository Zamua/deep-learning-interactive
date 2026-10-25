import type { Scene, SceneDef } from '../../../lecture/scene';
import { box, gpu, mono } from '../draw';

const KS = ['blue', 'orange', 'green', 'purple'] as const;
const G0 = [2, -1, 3, 0];
const f = (v: number) => String(v).replace('-', '−');

/** Four GPU cards: a row on a wide stage, two by two on a tall one. */
function cards(s: Scene): { x: number; y: number; w: number; h: number }[] {
  if (s.tall) return [0, 1, 2, 3].map((i) => ({ x: s.w / 2 + (i % 2 ? 25 : -25) * s.u, y: s.h * (i < 2 ? 0.42 : 0.75), w: 46, h: 28 }));
  const gap = Math.min(34, (s.w / s.u - 12) / 4);
  return [0, 1, 2, 3].map((i) => ({ x: s.w / 2 + (i - 1.5) * gap * s.u, y: s.h * 0.6, w: gap - 4, h: 42 }));
}

/** Where a card puts its copy of w, its slice of examples and its gradient. */
function spots(s: Scene, c: { x: number; y: number }) {
  return s.tall
    ? { w: [c.x - 12 * s.u, c.y - 1 * s.u], dots: [c.x + 10 * s.u, c.y - 1 * s.u], g: [c.x, c.y + 9.5 * s.u] }
    : { w: [c.x, c.y - 10 * s.u], dots: [c.x, c.y + 4 * s.u], g: [c.x, c.y + 15 * s.u] };
}

/** A slice of 32 examples as a 4 by 8 block of dots. */
function dots(s: Scene, cx: number, cy: number, k: (typeof KS)[number], a: number): void {
  s.alpha(a, () => {
    for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) s.circle(cx + (c - 3.5) * 2.2 * s.u, cy + (r - 1.5) * 2.2 * s.u, 0.7 * s.u, { fill: s.tint(k, 0.85) });
  });
}

function base(s: Scene, slices: number, label: (i: number) => string | null, wOn = 0): void {
  cards(s).forEach((c, i) => {
    gpu(s, c.x, c.y, c.w, c.h, `GPU ${i}`);
    const p = spots(s, c);
    box(s, p.w[0]!, p.w[1]!, 13, 7, 'blue', { label: 'w', size: 3.4, on: wOn });
    dots(s, p.dots[0]!, p.dots[1]!, KS[i]!, slices);
    const t = label(i);
    if (t) mono(s, t, p.g[0]!, p.g[1]!, { size: 3.2, k: 'red', weight: 650 });
  });
}

const split: SceneDef = {
  draw(s) {
    base(s, s.ease('slice', 0.8, 2.2), (i) => (s.ease('grad', 0.6) > 0.5 ? `g${'₀₁₂₃'[i]} = ${f(G0[i]!)}` : null), s.ease('copies', 0.6, 0.8) * (1 - s.ease('slice', 0.5)));
    s.alpha(s.ease('copies', 0.6, 1.5) * (1 - s.ease('slice', 0.5)), () => mono(s, 'the same full copy of w on every GPU', s.w / 2, s.h * 0.13, { size: s.tall ? 3.2 : 3.6, k: 'blue' }));
    // The batch as one strip of 128 examples, cut into four slices.
    s.alpha(s.ease('slice', 0.6), () => {
      const half = Math.min(64, s.w / s.u / 2 - 6);
      const l = s.w / 2 - half * s.u;
      const r = s.w / 2 + half * s.u;
      const y = s.h * 0.13;
      const step = (r - l) / 128;
      for (let j = 0; j < 128; j++) s.line(l + (j + 0.5) * step, y - 2.4 * s.u, l + (j + 0.5) * step, y + 2.4 * s.u, s.tint(KS[Math.floor(j / 32)]!, 0.85), 0.32);
      mono(s, 'batch: B = 4 × 32 = 128', s.w / 2, y - 6 * s.u, { size: 3.4, k: '--ink-2' });
    });
  },
};

const average: SceneDef = {
  draw(s) {
    const back = s.ease('step', 0.6);
    base(s, 1, (i) => (back > 0.5 ? 'g = 1' : `g${'₀₁₂₃'[i]} = ${f(G0[i]!)}`), s.win('step', 'send'));
    const top = s.h * 0.13;
    s.alpha(s.ease('mean', 0.8) * (1 - s.ease('send', 0.5)), () => {
      box(s, s.w / 2, top, 60, 8, 'red', { label: '(2 − 1 + 3 + 0) / 4 = 1', size: 3.2, on: s.ease('mean', 0.6, 1.5) });
    });
    s.alpha(s.ease('step', 0.6, 1.2) * (1 - s.ease('send', 0.5)), () => mono(s, 'every copy: w − η · 1', s.w / 2, top + 9 * s.u, { size: 3.2, k: 'blue', halo: true }));
    s.alpha(s.ease('send', 0.6), () => {
      mono(s, 'sent each step: the gradients,', s.w / 2, top - 2.2 * s.u, { size: s.tall ? 3.2 : 3.6, k: '--ink' });
      mono(s, 'one number per parameter', s.w / 2, top + 2.8 * s.u, { size: s.tall ? 3.2 : 3.6, k: 'red', weight: 650 });
    });
  },
};

const epoch: SceneDef = {
  draw(s) {
    const l = 10 * s.u;
    const r = s.w - 10 * s.u;
    const bar = (y: number, n: number, k: 'blue' | 'green', grow: number) => {
      s.rrect(l, y - 3 * s.u, r - l, 6 * s.u, 0.8, { fill: s.tint(k, 0.12), stroke: s.tint(k, 0.5), lw: 0.3 });
      const filled = Math.floor(n * grow);
      if (filled > 0) s.rrect(l, y - 3 * s.u, ((r - l) * filled) / n, 6 * s.u, 0.8, { fill: s.tint(k, 0.35) });
      for (let j = 1; j < n; j++) s.line(l + ((r - l) * j) / n, y - 3 * s.u, l + ((r - l) * j) / n, y + 3 * s.u, s.tint(k, 0.55), 0.12);
    };
    s.alpha(s.ease('epoch', 0.6), () => {
      mono(s, 'one epoch: N = 12,800 examples', s.w / 2, s.h * 0.12, { size: s.tall ? 3.4 : 3.8, weight: 650 });
    });
    s.alpha(s.ease('steps', 0.6), () => {
      const y = s.h * 0.38;
      mono(s, '4 GPUs × 32 = 128 per step', l, y - 7 * s.u, { size: 3.3, k: 'blue', align: 'left' });
      bar(y, 100, 'blue', s.ease('steps', 3, 1));
      mono(s, '12,800 / 128 = 100 steps', r, y + 7.4 * s.u, { size: 3.4, k: 'blue', align: 'right', weight: 650 });
    });
    s.alpha(s.ease('more', 0.6), () => {
      const y = s.h * 0.68;
      mono(s, '8 GPUs × 32 = 256 per step', l, y - 7 * s.u, { size: 3.3, k: 'green', align: 'left' });
      bar(y, 50, 'green', s.ease('more', 2, 1));
      mono(s, '12,800 / 256 = 50 steps', r, y + 7.4 * s.u, { size: 3.4, k: 'green', align: 'right', weight: 650 });
    });
  },
};

export const scenes: Record<string, SceneDef> = { split, average, epoch };

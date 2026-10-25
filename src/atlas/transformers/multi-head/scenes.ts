import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { heat, rich, sub } from '../draw';

const N = 8;
const PITCH = 12;
const hx = (s: Scene, i: number) => s.w / 2 + (i - (N - 1) / 2) * PITCH * s.u;

/** Each head's 3 by 3 pattern of weights: every head looks somewhere else. */
const PATTERNS: number[][][] = [
  [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  [[1, 0, 0], [1, 0, 0], [0, 1, 0]],
  [[1, 0, 0], [1, 0, 0], [1, 0, 0]],
  [[0.4, 0.3, 0.3], [0.3, 0.4, 0.3], [0.3, 0.3, 0.4]],
  [[0, 0, 1], [0, 0, 1], [0, 0, 1]],
  [[0, 1, 0], [0, 0, 1], [0, 0, 1]],
  [[0.5, 0.5, 0], [0, 0.5, 0.5], [0.5, 0, 0.5]],
  [[0, 1, 0], [0, 1, 0], [0, 1, 0]],
];
const ONE = [
  [0.4, 0.3, 0.2, 0.1],
  [0.3, 0.3, 0.2, 0.2],
  [0.2, 0.3, 0.3, 0.2],
  [0.1, 0.2, 0.3, 0.4],
];

/** The token vector x as one long bar of d = 512 numbers. */
function xbar(s: Scene, y: number, w: number): void {
  const u = s.u;
  s.rrect(s.w / 2 - (w / 2) * u, y - 3 * u, w * u, 6 * u, 1.2, { fill: s.tint('orange', 0.18), stroke: s.tint('orange', 0.7), lw: 0.3 });
  s.text('x: d = 512 numbers', s.w / 2, y + 0.2 * u, { size: 3.2, font: 'mono', weight: 600, color: s.c('orange') });
}

const split: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    xbar(s, s.h * 0.08, 92);
    const heads = s.ease('heads', 0.8);
    s.alpha(1 - heads, () => {
      const c = 7;
      heat(s, cx - 1.5 * c * u, s.h * 0.4, 4, c, (i, j) => ONE[i]![j]!, 'green');
      s.text('one attention: one blend per token', cx, s.h * 0.4 + 4 * c * u, { size: 3.2, color: s.c('--ink-2') });
      s.line(cx, s.h * 0.08 + 3 * u, cx, s.h * 0.4 - 6 * u, s.c('--ink-3'), 0.3);
    });
    s.alpha(heads, () => {
      const y = s.h * 0.42;
      for (let i = 0; i < N; i++) {
        s.alpha(s.ease('heads', 0.5, 0.6 + 0.25 * i), () => {
          s.line(cx, s.h * 0.08 + 3 * u, hx(s, i), y - 8 * u, s.tint('--ink-3', 0.6), 0.25);
          s.text(String(i), hx(s, i), y - 6.5 * u, { size: 2.8, font: 'mono', weight: 600, color: s.c('--ink-3'), halo: true });
          heat(s, hx(s, i) - 3.5 * u, y - 3.5 * u, 3, 3.5, (a, b) => PATTERNS[i]![a]![b]!, 'green');
        });
      }
      s.alpha(s.ease('heads', 0.6, 3), () => s.text('8 heads, each with its own Wq, Wk, Wv', cx, s.h * 0.26, { size: 3.1, font: 'mono', color: s.c('--ink-2'), halo: true }));
    });
    const width = s.ease('width', 0.6);
    s.alpha(width, () => {
      const y = s.h * 0.58;
      for (let i = 0; i < N; i++) {
        s.rrect(hx(s, i) - 4.5 * u, y - 2.5 * u, 9 * u, 5 * u, 1, { fill: s.tint('teal', 0.25), stroke: s.tint('teal', 0.7), lw: 0.3 });
        s.text('64', hx(s, i), y + 0.2 * u, { size: 2.6, font: 'mono', weight: 600, color: s.c('teal') });
      }
      s.alpha(s.ease('width', 0.6, 2.5), () => rich(s, [['d / h = 512 / 8 = ', '--ink-2'], ['64', 'teal'], [' per head', '--ink-2']], cx, s.h * 0.69, { size: 3.4, weight: 600 }));
    });
    s.alpha(s.ease('shapes', 0.6), () => {
      const o = { size: 3.1, font: 'mono' as const, color: s.c('--ink-2') };
      const y1 = s.h * 0.81;
      const w = sub(s, 'W', 'Q', cx - 34 * u, y1, { k: 'blue', align: 'left', size: 3.1, weight: 600 });
      s.text(' (64, 512)    Q (T, 64)', cx - 34 * u + w, y1, { ...o, align: 'left' });
      s.alpha(s.ease('shapes', 0.6, 2.5), () => s.text('weights (T, T)    output (T, 64)', cx - 34 * u, s.h * 0.9, { ...o, align: 'left' }));
    });
  },
};

const join: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const cat = s.ease('concat', 1.2, 0.8);
    const y = lerp(s.h * 0.1, s.h * 0.22, cat);
    for (let i = 0; i < N; i++) {
      const x = lerp(hx(s, i), cx + (i - (N - 1) / 2) * 9 * u, cat);
      s.rrect(x - 4.5 * u, y - 2.5 * u, 9 * u, 5 * u, cat > 0.95 ? 0.2 : 1, { fill: s.tint('teal', 0.25), stroke: s.tint('teal', 0.7), lw: 0.3 });
      s.text('64', x, y + 0.2 * u, { size: 2.6, font: 'mono', weight: 600, color: s.c('teal') });
    }
    s.alpha(1 - cat, () => s.text('each head: (T, 64)', cx, s.h * 0.18, { size: 3, font: 'mono', color: s.c('--ink-3') }));
    s.alpha(s.ease('concat', 0.6, 2), () => s.text('joined: (T, 512)', cx, s.h * 0.29, { size: 3.2, font: 'mono', weight: 600, color: s.c('teal') }));
    s.alpha(s.ease('wo', 0.6), () => {
      s.arrow(cx, s.h * 0.32, cx, s.h * 0.36, s.c('--ink-3'), 0.35, 2);
      s.rrect(cx - 16 * u, s.h * 0.41 - 4 * u, 32 * u, 8 * u, 1.4, { fill: s.tint('blue', 0.14), stroke: s.tint('blue', 0.7), lw: 0.35 });
      const w = sub(s, 'W', 'O', cx - 13 * u, s.h * 0.41, { k: 'blue', align: 'left', size: 3.4 });
      s.text(' (512, 512)', cx - 13 * u + w, s.h * 0.41, { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c('blue') });
      s.arrow(cx, s.h * 0.41 + 4.5 * u, cx, s.h * 0.5 - 3.5 * u, s.c('--ink-3'), 0.35, 2);
      s.rrect(cx - 36 * u, s.h * 0.5 - 2.5 * u, 72 * u, 5 * u, 1, { fill: s.tint('green', 0.2), stroke: s.tint('green', 0.7), lw: 0.3 });
      s.text('out: (T, 512)', cx, s.h * 0.5 + 0.2 * u, { size: 2.9, font: 'mono', weight: 600, color: s.c('green') });
    });
    s.alpha(s.ease('count', 0.6), () => {
      const o = { size: 3.2, font: 'mono' as const };
      rich(s, [['Wq', 'blue'], [': 8 × 64 × 512 = 512 × 512 = d²', '--ink-2']], cx, s.h * 0.63, o);
      s.alpha(s.ease('count', 0.6, 3.5), () => rich(s, [['Wq, Wk, Wv, Wo', 'blue'], [': 4d²', '--ink']], cx, s.h * 0.72, { ...o, weight: 600 }));
      s.alpha(s.ease('count', 0.6, 6), () => s.text('4 × 512² = 1,048,576', cx, s.h * 0.8, { ...o, weight: 600, color: s.c('--ink') }));
    });
    s.alpha(s.ease('same', 0.6), () => s.text('a single head of width 512 holds 4d² too', cx, s.h * 0.91, { size: 3.3, color: s.c('green') }));
  },
};

export const scenes: Record<string, SceneDef> = { split, join };

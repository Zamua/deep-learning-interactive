import type { Scene, SceneDef } from '../../../lecture/scene';
import { bars, columns } from '../../draw';
import { rich } from '../draw';

/** An n by n grid of score cells with its top-left corner at (x, y), filling in over `grow`. */
function squares(s: Scene, x: number, y: number, n: number, c: number, k: 'slate' | 'teal', grow: number, on = 0): void {
  const u = s.u;
  const shown = Math.round(grow * n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i * n + j >= shown) continue;
      s.rrect(x + j * c * u + 0.25 * u, y + i * c * u + 0.25 * u, (c - 0.5) * u, (c - 0.5) * u, 0.5, { fill: s.tint(k, 0.2 + 0.25 * on), stroke: s.tint(k, 0.6), lw: 0.2 });
    }
  }
}

const square: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const c = 5;
    const y = s.h * 0.12;
    const lx = cx - 36 * u;
    squares(s, lx, y, 4, c, 'slate', s.ease('pairs', 1.6, 2), s.win('pairs', 'double'));
    s.alpha(s.ease('pairs', 0.6, 3.5), () => rich(s, [['T = 4: ', '--ink-2'], ['16', '--ink']], lx + 2 * c * u, y + 4 * c * u + 5 * u, { size: 3.4, weight: 600 }));
    const rx = cx - 2 * u;
    s.alpha(s.ease('double', 0.6), () => {
      squares(s, rx, y, 8, c, 'teal', s.ease('double', 2.2, 0.4), s.win('double', 'linear'));
      s.alpha(s.ease('double', 0.6, 2.6), () => rich(s, [['T = 8: ', '--ink-2'], ['64', '--ink'], ['  (4×)', 'red']], rx + 4 * c * u, y + 8 * c * u + 5 * u, { size: 3.4, weight: 600 }));
    });
    s.alpha(s.ease('linear', 0.6), () => {
      const o = { size: 3.3, align: 'left' as const };
      const tx = cx - 36 * u;
      rich(s, [['scores', 'teal'], ['   T²: 2× tokens → 4×', '--ink-2']], tx, s.h * 0.7, o);
      rich(s, [['Q, K, V', 'purple'], ['  T: 2× tokens → 2×', '--ink-2']], tx, s.h * 0.79, o);
      rich(s, [['weights', 'blue'], ['  fixed: never grow', '--ink-2']], tx, s.h * 0.88, o);
    });
  },
};

const TS = [1000, 2000, 4000, 8000];
const MB = TS.map((t) => (2 * t * t) / 1e6);

const memory: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const xs = columns(s, 4, 22);
    const base = s.h * 0.66;
    const long = s.ease('long', 1.2, 0.3);
    const vals = MB.map((v, i) => (i === 0 ? v : v * long));
    s.alpha(s.ease('bytes', 0.6), () => {
      const fmt = (v: number) => `${Math.round(v)} MB`;
      s.line(xs[0]! - 12 * u, base, xs[3]! + 12 * u, base, s.c('--axis'), 0.35);
      bars(s, xs.slice(0, 1), base, vals.slice(0, 1), 'teal', { max: 128, height: 44, w: 12, fmt, hi: [s.win('bytes', 'long')] });
      s.alpha(long, () => bars(s, xs.slice(1), base, vals.slice(1), 'teal', { max: 128, height: 44, w: 12, fmt, hi: [0, 0, long] }));
      TS.forEach((t, i) => s.alpha(i === 0 ? 1 : long, () => s.text(`T = ${t.toLocaleString('en-US')}`, xs[i]!, base + 4.5 * u, { size: 3, font: 'mono', color: s.c('--ink-3') })));
      s.alpha(1 - long, () => rich(s, [['1,000² × 2 bytes = ', '--ink-2'], ['2 MB', 'teal']], cx, s.h * 0.15, { size: 3.4, weight: 600 }));
    });
    s.alpha(s.ease('heads', 0.6), () => rich(s, [['16 heads × 128 MB ≈ ', '--ink-2'], ['2 GB', 'red'], [' per layer', '--ink-2']], cx, s.h * 0.8, { size: 3.4, weight: 600 }));
    s.alpha(s.ease('why', 0.6), () => s.text('twice the context: four times the work and memory', cx, s.h * 0.9, { size: 3.3, color: s.c('--ink') }));
  },
};

export const scenes: Record<string, SceneDef> = { square, memory };

import type { Scene, SceneDef } from '../../../lecture/scene';
import { note, rich } from '../draw';

const N = 10;

/**
 * Rows are generation steps, columns are token positions: step t (row t - 1) holds t tokens.
 * `shown(t)` fades rows in; `fresh(t, j)` says whether that key is computed at that step.
 */
function steps(s: Scene, shown: (t: number) => number, fresh: (t: number, j: number) => boolean, labels = true): { x0: number; y0: number; c: number } {
  const c = (s.tall ? 5 : 4.8) * s.u;
  const x0 = s.w / 2 - (N * c) / 2 + 4 * s.u;
  const y0 = s.h * 0.1;
  if (labels) s.text('position', x0 + (N * c) / 2, y0 - 3 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
  for (let t = 1; t <= N; t++) {
    s.alpha(shown(t), () => {
      if (labels) s.text(`step ${t}`, x0 - 2 * s.u, y0 + (t - 0.5) * c, { size: 2.4, font: 'mono', align: 'right', color: s.c('--ink-3') });
      for (let j = 0; j < t; j++) {
        const f = fresh(t, j);
        const k = j === t - 1 ? 'gold' : f ? 'red' : 'teal';
        s.rrect(x0 + j * c + 0.35 * s.u, y0 + (t - 1) * c + 0.35 * s.u, c - 0.7 * s.u, c - 0.7 * s.u, 0.5, { fill: s.tint(k, f ? 0.55 : 0.12), stroke: s.tint(k, f ? 0.9 : 0.5), lw: 0.22 });
      }
    });
  }
  return { x0, y0, c };
}

const again: SceneDef = {
  draw(s) {
    const rows = Math.max(1, s.ease('loop', 0.6) + s.prog('redo') * (N - 1));
    const g = steps(s, (t) => Math.max(0, Math.min(1, rows - (t - 1))), () => true);
    const yb = g.y0 + N * g.c;
    s.alpha(s.ease('redo', 0.6, 1), () => {
      rich(s, [['■ ', 'gold'], ['new token   ', '--ink-3'], ['■ ', 'red'], ['computed again', '--ink-3']], s.w / 2, yb + 5 * s.u, { size: 3, weight: 600 });
    });
    s.alpha(s.win('same', 'count'), () => {
      const t = 7;
      s.rrect(g.x0 - 0.2 * s.u, g.y0 + (t - 2) * g.c - 0.2 * s.u, (t - 1) * g.c + 0.4 * s.u, 2 * g.c + 0.4 * s.u, 1, { stroke: s.c('green'), lw: 0.45 });
      note(s, 'same keys as the step before', s.w / 2, yb + 12 * s.u, 'green', 3.2);
    });
    s.alpha(s.win('count', 'pair'), () => rich(s, [['1 + 2 + … + 10', '--ink-2'], [' keys per block', '--ink-3']], s.w / 2, yb + 12 * s.u, { size: 3.4, weight: 600 }));
    // Rows t and 11 - t together make one row of 11, lit a pair at a time.
    s.alpha(s.win('pair', 'formula'), () => {
      const k = Math.min(4, Math.floor(s.prog('pair') * 6));
      [k + 1, N - k].forEach((t) => s.rrect(g.x0 - 0.2 * s.u, g.y0 + (t - 1) * g.c - 0.2 * s.u, t * g.c + 0.4 * s.u, g.c + 0.4 * s.u, 0.8, { stroke: s.c('gold'), lw: 0.45 }));
    });
    s.alpha(s.ease('pair', 0.6), () => {
      rich(s, [['(1 + 10) + (2 + 9) + … + (5 + 6)', '--ink-2']], s.w / 2, yb + 12 * s.u, { size: 3.4, weight: 600 });
      rich(s, [['5 pairs of 11 = ', '--ink-2'], ['55', 'red'], [' keys per block', '--ink-3']], s.w / 2, yb + 19 * s.u, { size: 3.4, weight: 600 });
    });
    s.alpha(s.ease('formula', 0.6), () => {
      rich(s, [['T steps: T/2 pairs of T + 1 = ', '--ink-3'], ['T(T + 1) / 2', 'red']], s.w / 2, yb + 26 * s.u, { size: s.tall ? 3 : 3.4, weight: 600 });
      rich(s, [['T = 1,000: 500 × 1,001 = ', '--ink-3'], ['500,500', 'red']], s.w / 2, yb + 33 * s.u, { size: s.tall ? 3 : 3.4, weight: 600 });
    });
  },
};

const cache: SceneDef = {
  draw(s) {
    const mem = s.ease('shape', 0.6);
    s.alpha(1 - mem, () => {
      const rows = Math.min(N, 1 + s.prog('step') * (N - 1) + (s.at('work') <= s.t ? N : 0));
      const on = (t: number) => Math.max(0, Math.min(1, rows - (t - 1)));
      steps(s, (t) => 0.22 * (1 - on(t)), () => true, false);
      const g = steps(s, on, (t, j) => j === t - 1);
      const yb = g.y0 + N * g.c;
      s.alpha(s.ease('keep', 0.6, 0.6), () => {
        rich(s, [['■ ', 'gold'], ['new token   ', '--ink-3'], ['■ ', 'teal'], ['read from the cache', '--ink-3']], s.w / 2, yb + 5 * s.u, { size: 3, weight: 600 });
      });
      s.alpha(s.ease('work', 0.6), () => {
        rich(s, [['10 keys', 'gold'], [' instead of ', '--ink-3'], ['55', 'red']], s.w / 2, yb + 12 * s.u, { size: 3.4, weight: 600 });
        rich(s, [['T = 1,000: ', '--ink-3'], ['1,000', 'gold'], [' instead of ', '--ink-3'], ['500,500', 'red']], s.w / 2, yb + 19 * s.u, { size: 3.2, weight: 600 });
      });
    });
    s.alpha(mem, () => {
      // One block's cache: a row of keys and a row of values per token.
      const rows = 5 + Math.floor(s.ease('shape', 2.4, 1) * 2);
      const c = 4.6 * s.u;
      const d = 6;
      const gap = 7 * s.u;
      const x0 = s.w / 2 - d * c - gap / 2;
      const y0 = s.h * 0.16;
      const yb = y0 + 7 * c;
      const st = s.ease('stack', 0.8);
      ['keys', 'values'].forEach((lab, m) => {
        const xx = x0 + m * (d * c + gap);
        const k = m ? 'green' : 'blue';
        s.text(`${lab}: (t, d)`, xx + (d * c) / 2, y0 - 4 * s.u, { size: 3, font: 'mono', weight: 650, color: s.c(k) });
        // The other three blocks' caches, behind this one.
        s.alpha(st, () => {
          for (let b = 3; b >= 1; b--) s.rrect(xx + b * 1.2 * s.u, y0 + b * 1.2 * s.u, d * c, rows * c, 0.8, { fill: s.c('--card'), stroke: s.tint(k, 0.55), lw: 0.25 });
          s.rrect(xx, y0, d * c, rows * c, 0.8, { fill: s.c('--card') });
        });
        for (let i = 0; i < rows; i++) {
          const fresh = i === rows - 1;
          for (let j = 0; j < d; j++) s.rrect(xx + j * c + 0.3 * s.u, y0 + i * c + 0.3 * s.u, c - 0.6 * s.u, c - 0.6 * s.u, 0.5, { fill: s.tint(fresh ? 'gold' : k, fresh ? 0.6 : 0.3) });
        }
        s.alpha(s.ease('memory', 0.6, 1.5), () => note(s, '7 × 6 = 42', xx + (d * c) / 2, yb + 6.5 * s.u, k, 3));
      });
      s.alpha(1 - st, () => note(s, 'one row per token, in every block', s.w / 2, yb + 13 * s.u, '--ink-2', 3.2));
      s.alpha(s.win('stack', 'memory'), () => note(s, '4 blocks stacked: (4, t, d)', s.w / 2, yb + 13 * s.u, '--ink-2', 3.2));
      s.alpha(s.ease('memory', 0.6, 3), () => rich(s, [['one block: 2 × 7 × 6 = ', '--ink-3'], ['84', '--ink-2'], [' numbers', '--ink-3']], s.w / 2, yb + 13 * s.u, { size: 3.2, weight: 600 }));
      s.alpha(s.ease('total', 0.6), () => rich(s, [['4 blocks: 4 × 84 = ', '--ink-3'], ['336', '--ink-2'], [' numbers', '--ink-3']], s.w / 2, s.h * 0.78, { size: 3.4, weight: 650 }));
      s.alpha(s.ease('total', 0.6, 2.5), () => {
        rich(s, [['2', '--ink-2'], [' × blocks × ', '--ink-3'], ['T', '--ink-2'], [' × ', '--ink-3'], ['d', '--ink-2'], [' numbers', '--ink-3']], s.w / 2, s.h * 0.86, { size: 3.6, weight: 650 });
      });
    });
  },
};

export const scenes: Record<string, SceneDef> = { again, cache };

import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01, lerp, smooth } from '../../../lecture/scene';
import { type Ink, grid, gridCells, rich, volume } from '../draw';

const X = [
  [1, 3, 2, 0],
  [5, 2, 1, 4],
  [0, 1, 6, 2],
  [2, 3, 1, 1],
];
const WIN: Ink[] = ['blue', 'green', 'purple', 'teal'];
const winOf = (i: number, j: number) => Math.floor(i / 2) * 2 + Math.floor(j / 2);
const cellsOf = (w: number) => [0, 1, 2, 3].map((k) => [2 * Math.floor(w / 2) + Math.floor(k / 2), 2 * (w % 2) + (k % 2)] as const);
const MAX = [0, 1, 2, 3].map((w) => Math.max(...cellsOf(w).map(([i, j]) => X[i]![j]!)));
const AVG = [0, 1, 2, 3].map((w) => cellsOf(w).reduce((a, [i, j]) => a + X[i]![j]!, 0) / 4);
const isMax = (i: number, j: number) => X[i]![j]! === MAX[winOf(i, j)];

const label = (s: Scene, t: string, x: number, y: number, k: Ink, size = 3.6) => s.text(t, x, y, { size, font: 'mono', weight: 650, color: s.c(k) });

const maxScene: SceneDef = {
  draw(s) {
    const tall = s.tall;
    const g = grid(s, tall ? s.w / 2 : s.w * 0.27, tall ? s.h * 0.3 : s.h * 0.48, 4, 4, 11);
    const mo = grid(s, tall ? s.w * 0.3 : s.w * 0.62, tall ? s.h * 0.78 : s.h * 0.48, 2, 2, 11);
    const ao = grid(s, tall ? s.w * 0.72 : s.w * 0.86, tall ? s.h * 0.78 : s.h * 0.48, 2, 2, 11);
    const split = s.ease('grid', 0.6, 2);
    const maxA = s.ease('max', 0.6, 0.4);
    label(s, 'x', (g.l + g.r) / 2, g.t - 3.6 * s.u, 'orange', 4);
    gridCells(s, g, X, (i, j) => (split > 0.5 ? WIN[winOf(i, j)]! : 'orange'), { on: (i, j) => (isMax(i, j) ? maxA * (1 - s.ease('avg', 0.6)) : 0) });
    s.alpha(split, () => {
      const p = g.pitch * s.u;
      s.line(g.l + 2 * p, g.t - 1 * s.u, g.l + 2 * p, g.b + 1 * s.u, s.c('--ink-2'), 0.4, [1, 0.8]);
      s.line(g.l - 1 * s.u, g.t + 2 * p, g.r + 1 * s.u, g.t + 2 * p, s.c('--ink-2'), 0.4, [1, 0.8]);
    });
    const out = (o: ReturnType<typeof grid>, vals: number[], a: number, on: number, size: number) => {
      const cw = (o.pitch - 1) * s.u;
      for (let w = 0; w < 4; w++) {
        const i = Math.floor(w / 2);
        const j = w % 2;
        const aw = a * s.ease('max', 0.4, 0.8 + w * 0.5);
        s.alpha(aw, () => s.cell(o.x(j) - cw / 2, o.y(i) - cw / 2, cw, cw, String(vals[w]), WIN[w]!, { on, size }));
      }
    };
    s.alpha(s.ease('max', 0.4), () => label(s, 'max', (mo.l + mo.r) / 2, mo.t - 3.6 * s.u, '--ink-2'));
    out(mo, MAX, 1, s.win('out', 'avg'), 4);
    s.alpha(s.ease('out', 0.6, 0.8), () => {
      const y = tall ? mo.b + 4.5 * s.u : mo.b + 5 * s.u;
      s.text('4 × 4 to 2 × 2', (mo.l + mo.r) / 2, y, { size: 3.2, font: 'mono', color: s.c('--ink-2') });
    });
    s.alpha(s.ease('avg', 0.6), () => {
      label(s, 'average', (ao.l + ao.r) / 2, ao.t - 3.6 * s.u, '--ink-2');
      const cw = (ao.pitch - 1) * s.u;
      AVG.forEach((v, w) => {
        const a = s.ease('avg', 0.5, 1 + w * 0.9);
        s.alpha(a, () => s.cell(ao.x(w % 2) - cw / 2, ao.y(Math.floor(w / 2)) - cw / 2, cw, cw, String(v), WIN[w]!, { size: 3 }));
      });
    });
  },
};

const IN_SIDE = 26;
const shape: SceneDef = {
  draw(s) {
    const tall = s.tall;
    const big = (tall ? 24 : IN_SIDE) * s.u;
    const small = big / 2;
    const top = s.h * 0.1 + 8 * s.u;
    const ix = s.w * (tall ? 0.1 : 0.18);
    const ox = s.w * (tall ? 0.62 : 0.6);
    volume(s, ix, top, big, 16, () => 'orange', { step: 0.55 });
    s.text('(16, 32, 32)', ix + big / 2 + 4 * s.u, top + big + 5 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c('--ink-2') });
    const a = s.ease('channels', 0.8, 1.5);
    s.alpha(a, () => {
      s.arrow(ix + big + 11 * s.u, top + big / 2, ox - 3 * s.u, top + big / 2, s.c('--ink-3'), 0.4, 2.4);
      volume(s, ox, top + big / 4, small, 16, () => 'gold', { step: 0.55 });
      s.text('(16, 16, 16)', ox + small / 2 + 4 * s.u, top + big + 5 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c('gold') });
    });
    const y1 = s.h * 0.58;
    s.alpha(s.ease('formula', 0.6, 0.4), () => rich(s, [['(32 − 2) / 2 + 1 = ', '--ink-2'], ['16', 'gold']], s.w / 2, y1, { size: 4, weight: 600 }));
    s.alpha(s.ease('none', 0.6), () => rich(s, [['parameters: ', '--ink-2'], ['0', 'gold']], s.w / 2, y1 + 7 * s.u, { size: 4, weight: 650 }));

    // A window whose 5 hops to another cell while its max stays 5.
    s.alpha(s.ease('shift', 0.6), () => {
      const g = grid(s, s.w * 0.4, s.h * 0.84, 2, 2, 8);
      const hop = smooth(clamp01((s.since('shift') - 2.5) / 0.8));
      const from: [number, number] = [1, 0];
      const to: [number, number] = [0, 1];
      const rest = [[1, 3], [5, 2]];
      const cw = (g.pitch - 1) * s.u;
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const isFrom = i === from[0] && j === from[1];
        const isTo = i === to[0] && j === to[1];
        const v = isFrom ? rest[to[0]]![to[1]]! : rest[i]![j]!;
        s.alpha(isTo ? 1 - hop : 1, () => s.cell(g.x(j) - cw / 2, g.y(i) - cw / 2, cw, cw, isFrom ? '' : String(v), 'blue', { size: 3.2 }));
        if (isFrom) s.alpha(hop, () => s.cell(g.x(j) - cw / 2, g.y(i) - cw / 2, cw, cw, String(rest[to[0]]![to[1]]), 'blue', { size: 3.2 }));
      }
      const px = lerp(g.x(from[1]), g.x(to[1]), hop);
      const py = lerp(g.y(from[0]), g.y(to[0]), hop);
      s.cell(px - cw / 2, py - cw / 2, cw, cw, '5', 'blue', { on: 1, size: 3.2 });
      s.arrow(g.r + 3 * s.u, (g.t + g.b) / 2, g.r + 12 * s.u, (g.t + g.b) / 2, s.c('--ink-3'), 0.4, 2.2);
      s.cell(g.r + 14 * s.u, (g.t + g.b) / 2 - cw / 2, cw, cw, '5', 'gold', { on: 1, size: 3.2 });
      s.text('max', g.r + 7.5 * s.u, (g.t + g.b) / 2 - 3.5 * s.u, { size: 3, font: 'mono', color: s.c('--ink-3') });
    });
  },
};

export const scenes: Record<string, SceneDef> = { max: maxScene, shape };

import type { Scene, SceneDef } from '../../../lecture/scene';
import { rich, stage, vrow } from '../draw';

/** A circled plus on the main path. */
function plus(s: Scene, x: number, y: number, on: number): void {
  s.circle(x, y, 3 * s.u, { fill: s.c('--card') });
  s.circle(x, y, 3 * s.u, { fill: s.tint('green', 0.15 + 0.25 * on), stroke: s.tint('green', 0.6 + 0.4 * on), lw: 0.35 });
  s.text('+', x, y + 0.2 * s.u, { size: 4, font: 'mono', weight: 700, color: s.c('green') });
}

/** One branch: leave the main path at y0, run through two boxes, rejoin at the plus at y1. */
function branch(s: Scene, mx: number, bx: number, y0: number, y1: number, labels: [string, string], k: 'teal' | 'gold', on: number, w2 = 28): void {
  const u = s.u;
  const line = s.tint('--ink-3', 0.8);
  const ya = y0 + 0.25 * (y1 - y0);
  const yb = y0 + 0.62 * (y1 - y0);
  s.line(mx, y0, bx, y0, line, 0.35);
  s.line(bx, y0, bx, ya - 3.5 * u, line, 0.35);
  stage(s, bx, ya, 26, 7, labels[0], 'slate', { on: on * 0.6 });
  s.arrow(bx, ya + 3.5 * u, bx, yb - 3.5 * u, line, 0.35, 1.6);
  stage(s, bx, yb, w2, 7, labels[1], k, { on });
  s.line(bx, yb + 3.5 * u, bx, y1, line, 0.35);
  s.arrow(bx, y1, mx + 3.2 * u, y1, line, 0.35, 1.8);
}

const parts: SceneDef = {
  draw(s) {
    const u = s.u;
    const mx = s.w / 2 - 24 * u;
    const bx = s.w / 2 + 12 * u;
    const top = s.h * 0.08;
    const p1 = s.h * 0.45;
    const p2 = s.h * 0.8;
    const bot = s.h * 0.94;
    const attn = s.ease('attn', 0.6);
    const mlp = s.ease('mlp', 0.6);
    rich(s, [['x', 'orange'], ['  (T, d)', '--ink-3']], mx, top, { size: 3.4, weight: 600 });
    s.line(mx, top + 3 * u, mx, bot - 3 * u, s.c('--ink-2'), 0.5);
    s.alpha(attn, () => {
      branch(s, mx, bx, s.h * 0.15, p1, ['layer norm', 'attention'], 'teal', s.win('attn', 'mlp'));
      plus(s, mx, p1, s.win('attn', 'mlp'));
    });
    s.alpha(mlp, () => {
      const wide = s.ease('width', 0.6);
      branch(s, mx, bx, s.h * 0.52, p2, ['layer norm', wide > 0.5 ? 'MLP: 768 → 3,072 → 768' : 'MLP'], 'gold', s.win('mlp', 'width') + s.ease('width', 0.6), wide > 0.5 ? 46 : 28);
      plus(s, mx, p2, s.win('mlp', 'width'));
    });
    rich(s, [['out', 'teal'], ['  (T, d)', '--ink-3']], mx, bot, { size: 3.4, weight: 600 });
    s.alpha(s.win('io', 'attn'), () => s.text('same shape in and out', s.w / 2 + 12 * u, s.h * 0.5, { size: 3.2, color: s.c('--ink-2') }));
  },
};

const ROWS: [string, number[], 'orange' | 'teal' | 'gold' | 'green', string][] = [
  ['x', [1, 2], 'orange', 'x'],
  ['attention(LN(x))', [0.5, -1], 'teal', 'a'],
  ['x + attention', [1.5, 1], 'green', 'a'],
  ['MLP(LN(sum))', [-0.5, 2], 'gold', 'm'],
  ['output', [1, 3], 'green', 'm'],
];
const fmt = (v: number) => String(v).replace('-', '−');

const flow: SceneDef = {
  draw(s) {
    const u = s.u;
    const lx = s.w / 2 - 42 * u;
    const vx = s.w / 2 + 22 * u;
    const ys = [0.1, 0.27, 0.41, 0.58, 0.72].map((f) => s.h * f);
    const path = s.ease('path', 0.6);
    ROWS.forEach(([label, v, k, beat], i) => {
      const a = i === 0 ? 1 : s.ease(beat, 0.6, i === 2 || i === 4 ? 2.6 : 0.4);
      s.alpha(a, () => {
        s.text(label, lx, ys[i]!, { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c(k) });
        vrow(s, vx, ys[i]!, v.map(fmt), k, { w: 10, pitch: 11, on: i === 0 || i === 2 || i === 4 ? [path, path] : [0, 0] });
        if (i === 2 || i === 4) s.text('+', vx - 14 * u, (ys[i - 1]! + ys[i]!) / 2, { size: 4, font: 'mono', weight: 700, color: s.c('green') });
      });
    });
    s.alpha(path, () => {
      [0, 2].forEach((i) => s.line(vx + 13 * u, ys[i]!, vx + 13 * u, ys[i + 2]!, s.c('green'), 0.6));
      s.line(vx + 11 * u, ys[0]!, vx + 13 * u, ys[0]!, s.c('green'), 0.6);
      s.line(vx + 11 * u, ys[2]!, vx + 13 * u, ys[2]!, s.c('green'), 0.6);
      s.arrow(vx + 13 * u, ys[4]! - 0.1 * u, vx + 11 * u, ys[4]!, s.c('green'), 0.6, 1.6);
      s.text('the input runs straight through the adds', s.w / 2, s.h * 0.84, { size: 3.2, color: s.c('green') });
      s.alpha(s.ease('path', 0.6, 4), () => s.text('norms only at the start of each branch: pre-norm', s.w / 2, s.h * 0.92, { size: 3.2, color: s.c('--ink-2') }));
    });
  },
};

export const scenes: Record<string, SceneDef> = { parts, flow };

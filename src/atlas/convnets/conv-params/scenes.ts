import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { cells } from '../../draw';
import { type Ink, grid, gridCells, rich, volume } from '../draw';

const RGB: Ink[] = ['red', 'green', 'blue'];
const W3 = [['w', 'w', 'w'], ['w', 'w', 'w'], ['w', 'w', 'w']];

const count: SceneDef = {
  marks: {
    f: { tex: String.raw`\symK\,(\symF \cdot \symF \cdot C + 1)`, x: 0.5, y: 0.88, size: 5.4 },
  },
  draw(s) {
    const pitch = s.tall ? 5 : 5.4;
    const gap = 3 * pitch + 5;
    const y = s.h * 0.24;
    const xs = [-1, 0, 1].map((k) => s.w / 2 - 6 * s.u + k * gap * s.u);
    const hi = s.win('filter', 'bias');
    xs.forEach((x, c) => {
      const g = grid(s, x, y, 3, 3, pitch);
      gridCells(s, g, W3, RGB[c]!, { on: () => hi, size: 2.4 });
      s.text(['R', 'G', 'B'][c]!, x, g.t - 3 * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c(RGB[c]!) });
    });
    const bx = xs[2]! + (1.5 * pitch + 7) * s.u;
    s.alpha(s.ease('bias', 0.6), () => {
      s.text('+', (xs[2]! + 1.5 * pitch * s.u + bx - 4 * s.u) / 2, y, { size: 4, font: 'mono', color: s.c('--ink-3') });
      cells(s, [bx], y, ['b'], 'green', { w: 7, h: 7, on: [s.win('bias', 'k')] });
    });
    const ty = s.h * 0.42;
    s.alpha(s.ease('filter', 0.6, 2), () => {
      rich(s, [['3 × 3 × 3 = ', '--ink-2'], ['27', 'blue'], [' weights', '--ink-2']], s.w / 2, ty, { size: 3.8, weight: 600 });
    });
    s.alpha(s.ease('bias', 0.6, 1), () => {
      rich(s, [['27 + ', '--ink-2'], ['1', 'green'], [' = 28 per filter', '--ink-2']], s.w / 2, ty + 6.5 * s.u, { size: 3.8, weight: 600 });
    });
    const k = s.ease('k', 0.6);
    s.alpha(k, () => {
      const fy = s.h * 0.64;
      const fp = (s.tall ? 10 : 11) * s.u;
      for (let i = 0; i < 8; i++) {
        const a = s.ease('k', 0.4, 0.2 + i * 0.15);
        s.alpha(a, () => volume(s, s.w / 2 + (i - 3.5) * fp - 3.5 * s.u, fy - 3.5 * s.u, 6 * s.u, 3, (l) => RGB[l]!, { step: 0.7 }));
      }
      s.alpha(s.ease('k', 0.6, 2), () => rich(s, [['8 × 28 = ', '--ink-2'], ['224', 'gold']], s.w / 2, fy + 9 * s.u, { size: 4.2, weight: 650 }));
    });
    s.show('f', s.ease('formula', 0.6));
  },
};

/** Window position at time t, sweeping row by row over a 4 x 4 grid of stops. */
function sweep(t: number): [number, number] {
  const k = Math.floor(t / 0.35) % 16;
  return [k % 4, Math.floor(k / 4)];
}

const shared: SceneDef = {
  draw(s) {
    const grow = s.ease('reuse', 1, 4);
    const side = lerp(s.tall ? 22 : 24, s.tall ? 36 : 38, grow) * s.u;
    const cx = s.w / 2;
    const top = s.h * 0.08;
    const fcOn = s.ease('fc', 0.6);
    s.rrect(cx - side / 2, top, side, side, 0.8, { fill: s.tint('orange', 0.12), stroke: s.tint('orange', 0.7), lw: 0.35 });
    const ws = 8 * s.u;
    const [i, j] = sweep(s.t);
    s.rrect(cx - side / 2 + (i / 3) * (side - ws), top + (j / 3) * (side - ws), ws, ws, 0.6, { stroke: s.c('blue'), lw: 0.5, fill: s.tint('blue', 0.12) });
    const ly = top + side + 4.5 * s.u;
    s.text(grow > 0.5 ? '64 × 64 image' : '32 × 32 image', cx, ly, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
    rich(s, [['parameters: ', '--ink-2'], ['224', 'gold']], cx, ly + 5.5 * s.u, { size: 3.8, weight: 650 });

    s.alpha(fcOn, () => {
      const x0 = s.w * 0.08;
      const x1 = s.w * 0.92;
      const y1 = s.h * 0.72;
      const y2 = s.h * 0.82;
      s.text('conv', x0, y1 - 4 * s.u, { size: 3.2, font: 'mono', align: 'left', color: s.c('gold') });
      s.rrect(x0, y1 - 1.2 * s.u, 0.8 * s.u, 2.4 * s.u, 0.3, { fill: s.c('gold') });
      s.text('224', x0 + 2.2 * s.u, y1, { size: 3.2, font: 'mono', align: 'left', color: s.c('gold') });
      const g = s.ease('fc', 1.2, 2);
      s.text('fully connected', x0, y2 - 4 * s.u, { size: 3.2, font: 'mono', align: 'left', color: s.c('red') });
      s.rrect(x0, y2 - 1.2 * s.u, (x1 - x0) * g, 2.4 * s.u, 0.3, { fill: s.tint('red', 0.7) });
      s.alpha(s.ease('fc', 0.6, 3), () => s.text('22,125,600', x1, y2 - 4 * s.u, { size: 3.2, font: 'mono', align: 'right', color: s.c('red') }));
    });
    s.alpha(s.ease('why', 0.6, 0.5), () => s.text('one small filter, shared everywhere', cx, s.h * 0.92, { size: 3.6, color: s.c('--ink-2') }));
  },
};

export const scenes: Record<string, SceneDef> = { count, shared };

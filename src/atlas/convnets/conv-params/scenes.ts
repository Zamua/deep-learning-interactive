import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { after, cells, cite, columns } from '../../draw';
import { caption } from '../../networks/draw';
import { grid, gridCells, rich, volume } from '../draw';

const RGB: Ink[] = ['red', 'green', 'blue'];
const W3 = [['w', 'w', 'w'], ['w', 'w', 'w'], ['w', 'w', 'w']];
/** One color per filter weight, so a line shows which of the three it uses. */
const KW: Ink[] = ['blue', 'teal', 'purple'];
const X = [1, 1, 1, 6, 6, 6, 2];
const FILTER = ['−1', '0', '1'];
const CH = 8.5;

/** Fades in once a fraction `f` of beat `id` has been spoken. */
const at = (s: Scene, id: string, f: number) => after(s, id, f, 0.6);

// ---- seven inputs, five outputs: 35 lines fully connected, 15 lines but 3 weights as a convolution

const wires: SceneDef = {
  draw(s) {
    const pitch = s.tall ? 12 : 12.5;
    const xs = columns(s, 7, pitch);
    const cw = Math.min(pitch - 1.6, 11);
    const [yi, yo] = [0.16, 0.5].map((f) => s.h * f);
    const y0 = yi + (CH / 2 + 0.6) * s.u;
    const y1 = yo - (CH / 2 + 0.6) * s.u;
    const conv = s.ease('conv', 0.8);
    const shared = s.ease('share', 0.8);

    // Fully connected: a line from every input to every output, drawn output by output.
    s.alpha(1 - conv, () => {
      for (let j = 0; j < 5; j++) {
        const a = s.ease('fc', 0.5, 2.2 + 0.35 * j);
        for (let i = 0; i < 7; i++) s.alpha(a, () => s.line(xs[i]!, y0, xs[j + 1]!, y1, s.tint('red', 0.55), 0.22));
      }
    });
    // Convolution: each output sees the three inputs above it; the line's color is the weight it uses.
    const lit = Math.floor(Math.max(0, s.since('share') - 1.5) / 0.6) % 5;
    s.alpha(conv, () => {
      for (let j = 0; j < 5; j++) {
        for (let k = 0; k < 3; k++) {
          const x0 = xs[j + k]!;
          const x1 = xs[j + 1]!;
          const hi = s.win('share', 'sharing') * (j === lit ? 1 : 0);
          s.alpha(1 - shared, () => s.line(x0, y0, x1, y1, s.tint('--ink-2', 0.7), 0.3));
          s.alpha(shared, () => s.line(x0, y0, x1, y1, s.c(KW[k]!), 0.32 + 0.3 * hi));
        }
      }
    });

    cells(s, xs, yi, X.map(String), 'orange', { w: cw, h: CH });
    cells(s, xs.slice(1, 6), yo, ['', '', '', '', ''], 'gold', { w: cw, h: CH });
    s.text('x', xs[0]! - (pitch / 2 + 3) * s.u, yi, { size: 4, font: 'mono', weight: 650, color: s.c('orange') });

    const [yc, yd] = [0.66, 0.76].map((f) => s.h * f);
    s.alpha(at(s, 'fc', 0.75) * (1 - conv), () => rich(s, [['7 × 5 = ', '--ink-2'], ['35', 'red'], [' lines', '--ink-2']], s.w / 2, yc, { size: 4, weight: 600 }));
    s.alpha(at(s, 'name', 0.6) * (1 - conv), () => rich(s, [['35 + 5 biases = ', '--ink-2'], ['40', 'red'], [' numbers', '--ink-2']], s.w / 2, yd, { size: 3.8, weight: 600 }));
    s.alpha(s.win('name', 'conv'), () => caption(s, 'fully connected: every input to every output', s.h * 0.9, '--ink-2', 3.4));

    // The filter: three weights, each in the color of its lines.
    s.alpha(shared, () => {
      const fx = columns(s, 3, pitch);
      FILTER.forEach((l, k) => cells(s, [fx[k]!], yc, [l], KW[k]!, { w: cw, h: CH, on: [0.6] }));
      s.text('w', fx[0]! - (pitch / 2 + 3) * s.u, yc, { size: 4, font: 'mono', weight: 650, color: s.c('blue') });
    });
    s.alpha(at(s, 'conv', 0.5) * (1 - shared), () => rich(s, [['5 × 3 = ', '--ink-2'], ['15', '--ink'], [' lines', '--ink-2']], s.w / 2, yc, { size: 4, weight: 600 }));
    s.alpha(at(s, 'share', 0.6), () => rich(s, [['15 lines, ', '--ink-2'], ['3', 'blue'], [' weights', '--ink-2']], s.w / 2, yd + 1.5 * s.u, { size: 3.8, weight: 600 }));
    s.alpha(at(s, 'sharing', 0.55) * (1 - s.ease('lecun', 0.5)), () => rich(s, [['3 weights + 1 bias = ', '--ink-2'], ['4', 'gold'], [', any length', '--ink-2']], s.w / 2, s.h * 0.9, { size: 3.6, weight: 600 }));
    s.alpha(s.win('lecun', 'belief'), () => caption(s, '64,660 connections · 9,760 parameters', s.h * 0.9, '--ink-2', 3.4));
    s.alpha(s.ease('belief', 0.6), () => caption(s, 'what matters here matters there too', s.h * 0.9, '--ink-2', 3.4));
    cite(s, 'LeCun et al., 1989 · zip codes', s.ease('lecun', 0.6));
  },
};

// ---- one filter, its bias, K filters

const count: SceneDef = {
  marks: {
    f: { tex: String.raw`\symK\,(\symF \cdot \symF \cdot C + 1)`, x: 0.5, y: 0.89, size: 5.4 },
  },
  draw(s) {
    const pitch = s.tall ? 5 : 5.4;
    const gap = 3 * pitch + 5;
    const y = s.h * 0.2;
    const xs = [-1, 0, 1].map((k) => s.w / 2 - 6 * s.u + k * gap * s.u);
    const hi = s.win('C', 'bias');
    let g0 = grid(s, xs[0]!, y, 3, 3, pitch);
    xs.forEach((x, c) => {
      const g = grid(s, x, y, 3, 3, pitch);
      if (c === 0) g0 = g;
      gridCells(s, g, W3, RGB[c]!, { on: () => hi, size: 2.4 });
      s.text(['R', 'G', 'B'][c]!, x, g.t - 3 * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c(RGB[c]!) });
    });
    // F: the side of one filter, under the red sheet.
    const lab = { size: 3.3, font: 'mono', weight: 600, color: s.c('slate') } as const;
    s.alpha(s.ease('F', 0.6), () => {
      const yb = g0.b + 2 * s.u;
      s.line(g0.l, yb, g0.r, yb, s.c('slate'), 0.3);
      s.text('F = 3', (g0.l + g0.r) / 2, yb + 3.4 * s.u, lab);
    });
    // C: the channels, under all three sheets.
    s.alpha(s.ease('C', 0.6, 0.6), () => {
      const gr = grid(s, xs[2]!, y, 3, 3, pitch);
      const yb = g0.b + 9.5 * s.u;
      s.line(g0.l, yb, gr.r, yb, s.c('slate'), 0.3);
      s.text('C = 3 channels', s.w / 2 - 6 * s.u, yb + 3.4 * s.u, lab);
    });
    const bx = xs[2]! + (1.5 * pitch + 9) * s.u;
    s.alpha(s.ease('bias', 0.6), () => {
      s.text('+', (xs[2]! + 1.5 * pitch * s.u + bx - 4 * s.u) / 2, y, { size: 4, font: 'mono', color: s.c('--ink-3') });
      cells(s, [bx], y, ['b'], 'green', { w: 7, h: 7, on: [s.win('bias', 'K')] });
    });
    const ty = s.h * 0.49;
    s.alpha(after(s, 'layer', 0.45) * (1 - s.ease('C', 0.5)), () => caption(s, '3 channels in · 8 filters · each 3 × 3', ty, '--ink-2', 3.4));
    s.alpha(at(s, 'C', 0.7), () => rich(s, [['F × F × C = 3 × 3 × 3 = ', '--ink-2'], ['27', 'blue']], s.w / 2, ty, { size: 3.6, weight: 600 }));
    s.alpha(s.ease('bias', 0.6, 1), () => rich(s, [['27 + ', '--ink-2'], ['1', 'green'], [' = 28 per filter', '--ink-2']], s.w / 2, ty + 6.5 * s.u, { size: 3.6, weight: 600 }));
    const dials = s.ease('dials', 0.6);
    s.alpha(s.ease('K', 0.6) * (1 - dials), () => {
      const fy = s.h * 0.68;
      const fp = (s.tall ? 10 : 11) * s.u;
      for (let i = 0; i < 8; i++) {
        s.alpha(s.ease('K', 0.4, 0.2 + i * 0.15), () => volume(s, s.w / 2 + (i - 3.5) * fp - 3.5 * s.u, fy - 3.5 * s.u, 6 * s.u, 3, (l) => RGB[l]!, { step: 0.7 }));
      }
      s.alpha(at(s, 'K', 0.6), () => rich(s, [['K = 8:  8 × 28 = ', '--ink-2'], ['224', 'gold']], s.w / 2, fy + 8.5 * s.u, { size: 3.8, weight: 650 }));
    });
    // What doubling each letter does to the count.
    const rows: [string, string, number][] = [['2K', 'exactly 2×', 0.02], ['2C', 'a little under 2×', 0.3], ['2F', 'about 4×', 0.62]];
    rows.forEach(([k, v, f], i) => {
      s.alpha(at(s, 'dials', f), () => rich(s, [[`${k}  →  `, 'slate'], [v, '--ink-2']], s.w / 2, s.h * (0.64 + 0.075 * i), { size: 3.6, weight: 600 }));
    });
    s.show('f', s.ease('formula', 0.6));
  },
};

// ---- the image size never enters; a fully connected layer pays for every pair

/** Window position at time t, sweeping row by row over a 4 x 4 grid of stops. */
function sweep(t: number): [number, number] {
  const k = Math.floor(t / 0.35) % 16;
  return [k % 4, Math.floor(k / 4)];
}

const size: SceneDef = {
  draw(s) {
    const grow = s.ease('missing', 1, 3.5) * (1 - s.ease('sizes', 0.8));
    const side = lerp(20, 30, grow) * s.u;
    const cx = s.w / 2;
    const top = s.h * 0.06;
    s.rrect(cx - side / 2, top, side, side, 0.8, { fill: s.tint('orange', 0.12), stroke: s.tint('orange', 0.7), lw: 0.35 });
    const ws = 6 * s.u;
    const [i, j] = sweep(s.t);
    s.rrect(cx - side / 2 + (i / 3) * (side - ws), top + (j / 3) * (side - ws), ws, ws, 0.6, { stroke: s.c('blue'), lw: 0.5, fill: s.tint('blue', 0.12) });
    const ly = top + side + 4 * s.u;
    s.text(grow > 0.5 ? '64 × 64 image' : '32 × 32 image', cx, ly, { size: 3.3, font: 'mono', color: s.c('--ink-2') });
    rich(s, [['conv parameters: ', '--ink-2'], ['224', 'gold']], cx, ly + 5.5 * s.u, { size: 3.6, weight: 650 });

    const [y1, y2] = [0.55, 0.62].map((f) => s.h * f);
    s.alpha(at(s, 'sizes', 0.35), () => rich(s, [['in:  3 × 32 × 32 = ', '--ink-2'], ['3,072', 'orange']], cx, y1, { size: 3.4, weight: 600 }));
    s.alpha(at(s, 'sizes', 0.7), () => rich(s, [['out: 8 × 30 × 30 = ', '--ink-2'], ['7,200', 'gold']], cx, y2, { size: 3.4, weight: 600 }));

    s.alpha(s.ease('fc', 0.6), () => {
      const x0 = s.w * 0.08;
      const x1 = s.w * 0.92;
      const yb1 = s.h * 0.72;
      const yb2 = s.h * 0.82;
      s.text('conv', x0, yb1 - 3.8 * s.u, { size: 3.1, font: 'mono', align: 'left', color: s.c('gold') });
      s.rrect(x0, yb1 - 1.2 * s.u, 0.8 * s.u, 2.4 * s.u, 0.3, { fill: s.c('gold') });
      s.text('224', x0 + 2.2 * s.u, yb1, { size: 3.1, font: 'mono', align: 'left', color: s.c('gold') });
      const g = s.ease('fc', 1.2, 0.8);
      s.text('fully connected', x0, yb2 - 3.8 * s.u, { size: 3.1, font: 'mono', align: 'left', color: s.c('red') });
      s.rrect(x0, yb2 - 1.2 * s.u, (x1 - x0) * g, 2.4 * s.u, 0.3, { fill: s.tint('red', 0.7) });
      s.alpha(s.ease('fc', 0.6, 1.6), () => s.text('3,072 × 7,200 + 7,200 = 22,125,600', x1, yb2 + 4.4 * s.u, { size: 3.1, font: 'mono', align: 'right', color: s.c('red') }));
    });
    s.alpha(s.ease('why', 0.6, 0.5), () => caption(s, 'one small filter, shared everywhere', s.h * 0.93, '--ink-2', 3.4));
  },
};

export const scenes: Record<string, SceneDef> = { wires, count, size };

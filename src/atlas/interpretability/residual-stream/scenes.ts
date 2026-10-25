import type { Scene, SceneDef } from '../../../lecture/scene';
import { box, cells, columns, num, rowLabel } from '../draw';

const X0 = [1, 0, 2];
const ATT = [0, 1, -1];
const MLP = [2, 0, 1];
const SUM = X0.map((v, i) => v + ATT[i]! + MLP[i]!);

/** The block as a stream line with two adds, each fed by a box that reads the line below it. */
function schematic(s: Scene, a: number, named: number): void {
  s.alpha(a, () => {
    const lx = s.w / 2 - (s.tall ? 16 : 20) * s.u;
    const bx = s.w / 2 + (s.tall ? 18 : 22) * s.u;
    const y0 = s.h * 0.88;
    const y1 = s.h * 0.14;
    const adds: [number, string][] = [
      [s.h * 0.62, 'attention'],
      [s.h * 0.36, 'MLP'],
    ];
    s.arrow(lx, y0, lx, y1, s.c('orange'), 0.6, 2.6);
    for (const [y, name] of adds) {
      const tap = y + 9 * s.u;
      s.line(lx, tap, bx - 13 * s.u, tap, s.c('--ink-3'), 0.3);
      s.arrow(bx - 13 * s.u, tap, bx - 13 * s.u, y + 4.5 * s.u, s.c('--ink-3'), 0.3, 1.6);
      box(s, bx, y, name, 'blue', { w: 26, h: 9, size: 3.2 });
      s.arrow(bx - 13 * s.u, y, lx + 3 * s.u, y, s.c('blue'), 0.4, 2);
      s.circle(lx, y, 2.6 * s.u, { fill: s.c('--card'), stroke: s.c('orange'), lw: 0.5 });
      s.text('+', lx, y + 0.2 * s.u, { size: 4, font: 'mono', weight: 700, color: s.c('orange') });
      s.text('read', (lx + bx - 13 * s.u) / 2, tap + 2.6 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
    }
    s.text('x', lx - 4 * s.u, y0 - 2 * s.u, { size: 3.8, font: 'mono', weight: 650, align: 'right', color: s.c('orange') });
    s.alpha(named, () => {
      s.text('x₀ = embedding', lx, y0 + 4.5 * s.u, { size: 3.2, font: 'mono', color: s.c('orange') });
      s.text('residual stream', lx, y1 - 4 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c('orange') });
    });
  });
}

const sum: SceneDef = {
  draw(s) {
    schematic(s, 1 - s.ease('writes', 0.6), s.ease('stream', 0.6));
    const xs = columns(s, 3, s.tall ? 18 : 20);
    const lx = xs[0]! - 13 * s.u;
    const rows: [string, number[], 'orange' | 'blue' | 'teal', number][] = [
      ['x₀', X0, 'orange', s.h * 0.16],
      ['+ attn', ATT, 'blue', s.h * 0.34],
      ['+ MLP', MLP, 'blue', s.h * 0.52],
    ];
    rows.forEach(([name, v, k, y], i) => {
      s.alpha(s.ease('writes', 0.6, 0.6 + i * 2.2), () => {
        rowLabel(s, name, lx, y, k, 3.6);
        cells(s, xs, y, v.map((x) => num(x)), k);
      });
    });
    s.alpha(s.ease('total', 0.6), () => {
      const y = s.h * 0.64;
      s.line(xs[0]! - 8 * s.u, y, xs[2]! + 8 * s.u, y, s.c('--ink-3'), 0.35);
      rowLabel(s, 'x', lx, s.h * 0.76, 'orange');
      cells(s, xs, s.h * 0.76, SUM.map((x) => num(x)), 'orange', { on: [1, 1, 1] });
    });
    s.alpha(s.ease('total', 0.6, 2), () => {
      s.text('x₀ + every write', s.w / 2, s.h * 0.9, { size: 3.6, font: 'mono', weight: 600, color: s.c('orange') });
    });
  },
};

/** A bar standing for one token's vector, `w` stage units wide. */
function slab(s: Scene, x: number, y: number, w: number, label: string, k: 'orange' | 'blue' | 'slate', on = 0): void {
  s.rrect(x - (w / 2) * s.u, y - 3.8 * s.u, w * s.u, 7.6 * s.u, 1.2, { fill: s.tint(k, 0.15 + 0.2 * on), stroke: s.tint(k, 0.6 + 0.4 * on), lw: 0.35 });
  s.text(label, x, y + 0.2 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c(k) });
}

const width: SceneDef = {
  draw(s) {
    const cx = s.w / 2;
    const D = 20;
    const ys = [s.h * 0.1, s.h * 0.26, s.h * 0.42];
    s.text('inside one MLP', cx, ys[0]! - 0 * s.u, { size: 3.2, color: s.c('--ink-3') });
    slab(s, cx, ys[0]! + 7 * s.u, D, 'd', 'orange');
    s.arrow(cx, ys[0]! + 11 * s.u, cx, ys[1]! + 2.5 * s.u, s.c('--ink-3'), 0.3, 1.6);
    slab(s, cx, ys[1]! + 7 * s.u, 4 * D, '4d', 'slate');
    s.arrow(cx, ys[1]! + 11 * s.u, cx, ys[2]! + 2.5 * s.u, s.c('--ink-3'), 0.3, 1.6);
    slab(s, cx, ys[2]! + 7 * s.u, D, 'd', 'blue', s.ease('same', 0.6, 2.5));
    s.alpha(s.ease('same', 0.6, 2.5), () => s.text('back to d, then added', cx + (D / 2 + 3) * s.u, ys[2]! + 7 * s.u, { size: 3, font: 'mono', align: 'left', color: s.c('blue') }));
    s.alpha(s.ease('never', 0.6), () => {
      const labels = ['x₀', 'block 0', 'block 1', 'top'];
      const xs = columns(s, 4, s.tall ? 25 : 28);
      const y = s.h * 0.76;
      s.text('the stream after each block', cx, y - 9 * s.u, { size: 3.2, color: s.c('--ink-3') });
      xs.forEach((x, i) => {
        s.alpha(s.ease('never', 0.5, 0.5 + i * 0.5), () => {
          slab(s, x, y, D, 'd', 'orange', 1);
          s.text(labels[i]!, x, y + 7 * s.u, { size: 3, font: 'mono', color: s.c('--ink-2') });
          if (i) s.arrow(xs[i - 1]! + (D / 2 + 0.8) * s.u, y, x - (D / 2 + 0.8) * s.u, y, s.c('--ink-3'), 0.3, 1.4);
        });
      });
    });
  },
};

const SEG = 11;

const read: SceneDef = {
  draw(s) {
    const pitch = s.tall ? 8.6 : 9.4;
    const xs = columns(s, SEG, pitch);
    const y = s.h * 0.56;
    const hit = s.ease('direct', 0.6);
    s.text('the stream: x₀ + one write per block', s.w / 2, s.h * 0.08, { size: 3, font: 'mono', color: s.c('--ink-3') });
    xs.forEach((x, i) => {
      const k = i === 0 ? 'orange' : i % 2 ? 'blue' : 'teal';
      s.alpha(s.ease('keep', 0.4, 0.2 + i * 0.3), () => {
        s.rrect(x - (pitch / 2) * s.u, y - 4 * s.u, pitch * s.u, 8 * s.u, 0.6, { fill: s.tint(i === 2 ? 'gold' : k, i === 2 ? 0.2 + 0.4 * hit : 0.22), stroke: s.c(i === 2 ? 'gold' : k), lw: 0.3 });
        s.text(i === 0 ? 'x₀' : String(i - 1), x, y + 7.5 * s.u, { size: 2.9, font: 'mono', color: s.c('--ink-2') });
      });
    });
    s.alpha(s.ease('keep', 0.6, 4), () => s.text('block 1 wrote here', xs[2]! - 4 * s.u, y + 13 * s.u, { size: 3, font: 'mono', align: 'left', color: s.c('gold') }));
    s.alpha(hit, () => {
      const bx = xs[SEG - 1]! - 4 * s.u;
      const by = s.h * 0.2;
      box(s, bx, by, 'block 9', 'purple', { w: 20, h: 8, size: 3.2 });
      s.arrow(bx - 10 * s.u, by + 2 * s.u, xs[2]!, y - 5 * s.u, s.c('purple'), 0.45, 2.2);
      s.text('reads it directly', s.w / 2, s.h * 0.82, { size: 3.6, weight: 600, color: s.c('purple') });
    });
  },
};

export const scenes: Record<string, SceneDef> = { sum, width, read };

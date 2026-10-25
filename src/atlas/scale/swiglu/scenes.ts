import { type Scene, type SceneDef, lerp } from '../../../lecture/scene';
import { cells, columns, curve, downArrows, frame, rowLabel } from '../modern-draw';

const sig = (z: number) => 1 / (1 + Math.exp(-z));
const swish = (z: number) => z * sig(z);

/** A labelled bar standing for a vector, `w` stage units wide, centered on (x, y). */
function slab(s: Scene, x: number, y: number, w: number, label: string, k: 'orange' | 'purple' | 'blue' | 'gold' | 'slate' | 'green', on = 0): void {
  s.rrect(x - (w / 2) * s.u, y - 4 * s.u, w * s.u, 8 * s.u, 1.4, { fill: s.tint(k, 0.14 + 0.2 * on), stroke: s.tint(k, 0.6 + 0.4 * on), lw: 0.35 });
  s.text(label, x, y + 0.2 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c(k) });
}

const gate: SceneDef = {
  draw(s) {
    const cx = s.w / 2;
    const D = 16;
    const H = (8 / 3) * D;
    const y0 = s.h * 0.1;
    const y1 = s.h * 0.32;
    const y2 = s.h * 0.52;
    const y3 = s.h * 0.7;
    slab(s, cx, y0, D, 'x: d', 'orange');
    const old = 1 - s.ease('two', 0.6);
    s.alpha(old, () => {
      s.arrow(cx, y0 + 4.5 * s.u, cx, y1 - 4.5 * s.u, s.c('--ink-3'), 0.35, 2);
      slab(s, cx, y1, 4 * D, '4d, then ReLU', 'slate');
      s.arrow(cx, y1 + 4.5 * s.u, cx, y2 - 4.5 * s.u, s.c('--ink-3'), 0.35, 2);
      slab(s, cx, y2, D, 'd', 'slate');
    });
    const gx = cx - (H / 2 + 3) * s.u;
    const ux = cx + (H / 2 + 3) * s.u;
    s.alpha(s.ease('two', 0.6), () => {
      s.arrow(cx - 3 * s.u, y0 + 4.5 * s.u, gx, y1 - 4.5 * s.u, s.c('--ink-3'), 0.35, 2);
      s.arrow(cx + 3 * s.u, y0 + 4.5 * s.u, ux, y1 - 4.5 * s.u, s.c('--ink-3'), 0.35, 2);
      slab(s, gx, y1, H, s.ease('swish', 0.4, 1) > 0.5 ? 'swish(gate): h' : 'gate: h', 'purple', s.win('swish', 'mul'));
      slab(s, ux, y1, H, 'up: h', 'blue');
    });
    s.alpha(s.win('swish', 'mul'), () => {
      const F = frame(cx - 26 * s.u, y1 + 9 * s.u, cx + 26 * s.u, s.h - 7 * s.u, [-4, 4], [-1, 4]);
      s.line(F.X(-4), F.Y(0), F.X(4), F.Y(0), s.c('--axis'), 0.3);
      s.line(F.X(0), F.Y(-1), F.X(0), F.Y(4), s.c('--axis'), 0.3);
      curve(s, F, (z) => Math.max(0, z), -4, 4, '--ink-3', { width: 0.4, dash: [1.2, 1] });
      curve(s, F, swish, -4, 4, 'purple', { width: 0.7, upto: s.ease('swish', 1.5, 0.6) });
      s.text('z σ(z)', F.X(1.4), F.Y(3), { size: 3.2, font: 'mono', align: 'right', color: s.c('purple'), halo: true });
      s.text('ReLU', F.X(-3.8), F.Y(0.8), { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3') });
    });
    s.alpha(s.ease('mul', 0.6), () => {
      s.line(gx, y1 + 4.5 * s.u, cx - 2 * s.u, y2 - 4.5 * s.u, s.c('--ink-3'), 0.35);
      s.line(ux, y1 + 4.5 * s.u, cx + 2 * s.u, y2 - 4.5 * s.u, s.c('--ink-3'), 0.35);
      slab(s, cx, y2, H, 'swish(gate) × up', 'gold', 1);
    });
    s.alpha(s.ease('mul', 0.6, 2.5), () => {
      s.arrow(cx, y2 + 4.5 * s.u, cx, y3 - 4.5 * s.u, s.c('--ink-3'), 0.35, 2);
      slab(s, cx, y3, D, 'out: d', 'green');
    });
  },
};

const G = [2, -1, 0];
const U = [1, 3, -2];
const SW = ['1.76', '−0.27', '0'];
const M = ['1.76', '−0.81', '0'];

const example: SceneDef = {
  draw(s) {
    const xs = columns(s, 3, s.tall ? 22 : 24);
    const lx = xs[0]! - 14 * s.u;
    const ys = [s.h * 0.14, s.h * 0.32, s.h * 0.56, s.h * 0.8];
    const str = (v: number) => String(v).replace('-', '−');
    rowLabel(s, 'gate', lx, ys[0]!, 'purple', 3.8);
    cells(s, xs, ys[0]!, G.map(str), 'purple');
    s.alpha(s.ease('in', 0.6, 1.5), () => {
      rowLabel(s, 'up', lx, ys[1]!, 'blue', 3.8);
      cells(s, xs, ys[1]!, U.map(str), 'blue');
    });
    s.alpha(s.ease('sw', 0.6), () => {
      rowLabel(s, 'swish', lx, ys[2]!, 'purple', 3.6);
      cells(s, xs, ys[2]!, SW, 'purple', { on: [s.win('sw', 'mul'), 0, 0] });
      s.text('σ(2) ≈ 0.88,  σ(−1) ≈ 0.27,  σ(0) = 0.5', s.w / 2, (ys[1]! + ys[2]!) / 2, { size: 3, font: 'mono', color: s.c('--ink-3') });
    });
    s.alpha(s.ease('mul', 0.6), () => {
      downArrows(s, xs, ys[2]! + 5.5 * s.u, ys[3]! - 5.5 * s.u);
      s.text('× up', xs[2]! + 9 * s.u, (ys[2]! + ys[3]!) / 2, { size: 3.2, font: 'mono', align: 'left', color: s.c('blue'), halo: true });
      rowLabel(s, 'out', lx, ys[3]!, 'gold', 3.8);
      cells(s, xs, ys[3]!, M, 'gold', { on: [1, 1, 1].map(() => s.ease('mul', 0.6, 1)) });
    });
  },
};

const width: SceneDef = {
  draw(s) {
    const cx = s.w / 2;
    const unit = s.tall ? 28 : 32;
    const gap = 3;
    const row = (y: number, n: number, w: number, labels: string[], k: 'slate' | 'purple', a: number) => {
      s.alpha(a, () => {
        const total = n * w + (n - 1) * gap;
        for (let i = 0; i < n; i++) {
          const x = cx - (total / 2) * s.u + (i * (w + gap) + w / 2) * s.u;
          s.rrect(x - (w / 2) * s.u, y - 5 * s.u, w * s.u, 10 * s.u, 1.2, { fill: s.tint(k, 0.2), stroke: s.c(k), lw: 0.35 });
          s.text(labels[i]!, x, y + 0.2 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c(k) });
        }
      });
    };
    const y1 = s.h * 0.2;
    const y2 = s.h * 0.5;
    s.text('ReLU MLP', cx, y1 - 9 * s.u, { size: 3.4, color: s.c('--ink-2') });
    row(y1, 2, unit, ['d × 4d', '4d × d'], 'slate', s.ease('count', 0.6));
    s.alpha(s.ease('count', 0.6, 1.5), () => s.text('2 · d · 4d = 8d²', cx, y1 + 9 * s.u, { size: 3.6, font: 'mono', color: s.c('slate') }));
    const shrink = s.ease('match', 1.4, 0.5);
    const w = lerp(unit, (unit * 2) / 3, shrink);
    s.alpha(s.ease('three', 0.6), () => s.text('gated MLP', cx, y2 - 9 * s.u, { size: 3.4, color: s.c('--ink-2') }));
    row(y2, 3, w, shrink > 0.5 ? ['d × h', 'd × h', 'h × d'] : ['d × 4d', 'd × 4d', '4d × d'], 'purple', s.ease('three', 0.6));
    s.alpha(s.ease('three', 0.6, 1.5) * (1 - shrink), () => s.text('3dh: at h = 4d, 12d²', cx, y2 + 9 * s.u, { size: 3.6, font: 'mono', color: s.c('purple') }));
    s.alpha(shrink, () => {
      s.text('3dh = 8d²  →  h = 8d/3', cx, y2 + 9 * s.u, { size: 3.6, font: 'mono', weight: 650, color: s.c('purple') });
      s.text('d = 768:  h = 2,048, not 3,072', cx, s.h * 0.78, { size: s.tall ? 3.4 : 3.8, font: 'mono', color: s.c('--ink-2') });
    });
  },
};

export const scenes: Record<string, SceneDef> = { gate, example, width };

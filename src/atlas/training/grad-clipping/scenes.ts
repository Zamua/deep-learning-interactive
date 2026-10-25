import type { Color } from '../../../core/symbols';
import type { Scene, SceneDef } from '../../../lecture/scene';
import { cells, columns, rowLabel } from '../../draw';
import { clipped, frame, type Frame } from '../draw';

type Ink = Color | `--${string}`;

/** The gradient plane, and where its text goes: a column on the right on a wide stage, else rows on top. */
function layout(s: Scene): { F: Frame; px: number; ys: number[] } {
  if (s.w < 155 * s.u) {
    const L = 64 * s.u;
    const b = s.h - 5 * s.u;
    const l = (s.w - L) / 2;
    return { F: frame(l, b - L, l + L, b, [-1, 9], [-1, 9]), px: s.w / 2, ys: [6, 14.5, 23].map((y) => y * s.u) };
  }
  const l = 12 * s.u;
  const F = frame(l, 8 * s.u, l + 84 * s.u, 92 * s.u, [-1, 9], [-1, 9]);
  return { F, px: (F.r + s.w - 4 * s.u) / 2, ys: [30, 46, 62].map((y) => y * s.u) };
}

/** Grid lines at whole numbers and the two axes, named by the entry each one measures. */
function plane(s: Scene, F: Frame): void {
  clipped(s, F, () => {
    for (let i = 0; i <= 9; i++) {
      s.line(F.X(i), F.t, F.X(i), F.b, s.tint('slate', 0.14), 0.2);
      s.line(F.l, F.Y(i), F.r, F.Y(i), s.tint('slate', 0.14), 0.2);
    }
  });
  s.line(F.l, F.Y(0), F.r, F.Y(0), s.c('--axis'), 0.35);
  s.line(F.X(0), F.b, F.X(0), F.t, s.c('--axis'), 0.35);
  const o = { size: 2.8, font: 'mono', color: s.c('--ink-3'), halo: true } as const;
  s.text('g[0]', F.r - 1 * s.u, F.Y(0) + 3.2 * s.u, { ...o, align: 'right' });
  s.text('g[1]', F.X(0) + 1.5 * s.u, F.t + 2.5 * s.u, { ...o, align: 'left' });
}

/** An arrow from the origin to (x, y). */
function vector(s: Scene, F: Frame, x: number, y: number, k: Ink, width = 0.7): void {
  s.arrow(F.X(0), F.Y(0), F.X(x), F.Y(y), s.c(k), width, 3);
}

/** One line of the side text, centered on the column. */
function say(s: Scene, text: string, x: number, y: number, k: Ink, a: number): void {
  s.alpha(a, () => s.text(text, x, y, { size: 3.4, font: 'mono', color: s.c(k), halo: true }));
}

/** A check or a cross and its caption, centered as one line on x. */
function mark(s: Scene, ok: boolean, text: string, x: number, y: number, a: number): void {
  s.alpha(a, () => {
    const w = s.measure(text, { size: 3.4 }) + 5 * s.u;
    const x0 = x - w / 2;
    s.text(ok ? '✓' : '✗', x0 + 1.6 * s.u, y, { size: 4, font: 'ui', weight: 700, color: s.c(ok ? 'green' : 'red') });
    s.text(text, x0 + 5 * s.u, y, { size: 3.4, align: 'left', color: s.c('--ink-2') });
  });
}

const size: SceneDef = {
  marks: {
    f: { tex: String.raw`\lVert\symg\rVert = \sqrt{\symg \cdot \symg}`, x: 0.5, y: 0.06, size: 4.6 },
  },
  draw(s) {
    const { F, px, ys } = layout(s);
    plane(s, F);
    const k = 0.1 + 0.9 * s.ease('explode', 1.6, 0.8);
    const legs = s.ease('pyth', 0.8);
    s.alpha(legs, () => {
      s.line(F.X(0), F.Y(0), F.X(6), F.Y(0), s.c('slate'), 0.45, [1.2, 0.9]);
      s.line(F.X(6), F.Y(0), F.X(6), F.Y(8), s.c('slate'), 0.45, [1.2, 0.9]);
      const o = { size: 3.4, font: 'mono', weight: 650, color: s.c('slate'), halo: true } as const;
      s.text('6', F.X(3), F.Y(0) + 3.4 * s.u, o);
      s.text('8', F.X(6) + 2.6 * s.u, F.Y(4), o);
    });
    vector(s, F, 6 * k, 8 * k, 'red', 0.7 + 0.35 * s.win('norm', 'pyth'));
    s.alpha(s.ease('explode', 0.6, 2.2), () => {
      s.text('g = [6, 8]', F.X(6) + 2 * s.u, F.Y(8), { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c('red'), halo: true });
    });
    const lab = { size: 3.6, font: 'mono', weight: 650, align: 'right', color: s.c('red'), halo: true } as const;
    s.alpha(s.win('norm', 'pyth'), () => s.text('‖g‖ = ?', F.X(3) - 2.5 * s.u, F.Y(4) - 2 * s.u, lab));
    s.alpha(s.ease('pyth', 0.6), () => s.text('‖g‖ = 10', F.X(3) - 2.5 * s.u, F.Y(4) - 2 * s.u, lab));
    say(s, '[0.6, 0.8] → [6, 8]', px, ys[0]!, 'red', s.win('explode', 'norm') * s.ease('explode', 0.6, 0.8));
    say(s, '‖g‖: the arrow\'s length', px, ys[0]!, '--ink-2', s.win('norm', 'dot'));
    say(s, '√(6² + 8²) = √100 = 10', px, ys[1]!, '--ink-2', s.ease('pyth', 0.6, 1.2));
    say(s, 'g · g = 36 + 64 = 100', px, ys[2]!, '--ink-2', s.ease('dot', 0.6, 1));
    s.show('f', s.ease('dot', 0.6, 2.4), { x: px / s.w, y: ys[0]! / s.h });
  },
};

const clip: SceneDef = {
  draw(s) {
    const { F, px, ys } = layout(s);
    plane(s, F);
    const r = F.X(5) - F.X(0);
    s.alpha(s.ease('threshold', 0.8), () => {
      clipped(s, F, () => {
        const c = s.ctx;
        c.beginPath();
        c.arc(F.X(0), F.Y(0), r, 0, Math.PI * 2);
        c.setLineDash([1.2 * s.u, 0.9 * s.u]);
        c.strokeStyle = s.c('slate');
        c.lineWidth = 0.4 * s.u;
        c.stroke();
        c.setLineDash([]);
      });
      s.text('c = 5', F.X(4.83) + 1.6 * s.u, F.Y(1.29) - 2 * s.u, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c('slate'), halo: true });
    });
    const each = s.ease('each', 0.8, 1.6);
    s.alpha(each, () => {
      clipped(s, F, () => s.rrect(F.X(-5), F.Y(5), F.X(5) - F.X(-5), F.Y(-5) - F.Y(5), 0, { stroke: s.tint('orange', 0.75), lw: 0.35 }));
    });
    const shrink = s.ease('scale', 1.4, 2.4);
    const k = 1 - 0.5 * shrink;
    s.alpha(s.ease('scale', 0.6, 2.4) * 0.8, () => s.line(F.X(0), F.Y(0), F.X(6.6), F.Y(8.8), s.tint('red', 0.6), 0.35, [1.2, 0.9]));
    s.alpha(s.win('turns', undefined), () => {
      const c = s.ctx;
      const R = F.X(3.6) - F.X(0);
      c.beginPath();
      c.moveTo(F.X(0), F.Y(0));
      c.arc(F.X(0), F.Y(0), R, -Math.atan2(8, 6), -Math.PI / 4);
      c.closePath();
      c.fillStyle = s.tint('orange', 0.45);
      c.fill();
    });
    vector(s, F, 6 * k, 8 * k, 'red', 0.7 + 0.35 * s.win('same', 'each'));
    s.alpha(each, () => vector(s, F, 5, 5, 'orange'));
    const tip = { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c('red'), halo: true } as const;
    s.alpha(1 - shrink, () => s.text('[6, 8]', F.X(6) + 2 * s.u, F.Y(8), tip));
    s.alpha(shrink, () => s.text('[3, 4]', F.X(2.55) - 2.5 * s.u, F.Y(3.4), { ...tip, align: 'right' }));
    s.alpha(each, () => s.text('[5, 5]', F.X(5) + 2 * s.u, F.Y(5) - 1.6 * s.u, { ...tip, color: s.c('orange') }));
    say(s, '‖g‖ ≤ 5: leave g alone', px, ys[0]!, 'slate', s.win('threshold', 'scale'));
    say(s, '‖g‖ = 10 > 5', px, ys[0]!, 'slate', s.win('scale', 'each'));
    say(s, '× 5/10: [6, 8] → [3, 4]', px, ys[1]!, 'red', s.ease('scale', 0.6, 2.4) * (1 - s.ease('each', 0.6)));
    mark(s, true, 'same direction, norm 5', px, ys[2]!, s.win('same', 'each'));
    say(s, 'each entry to [−5, 5]', px, ys[0]!, 'orange', s.ease('each', 0.6, 0.6));
    say(s, '[6, 8] → [5, 5]', px, ys[1]!, 'orange', s.ease('each', 0.6, 1.6));
    mark(s, false, 'direction turned', px, ys[2]!, s.ease('turns', 0.6, 0.6));
  },
};

const ROWS: [string, string[], Ink, string][] = [
  ['w', ['1', '2'], 'blue', 'step'],
  ['clipped', ['3', '4'], 'red', 'step'],
  ['η · clipped', ['0.3', '0.4'], 'slate', 'step'],
  ['new w', ['0.7', '1.6'], 'blue', 'step'],
];

const step: SceneDef = {
  draw(s) {
    const xs = columns(s, 2, 24).map((x) => x + 8 * s.u);
    const lx = xs[0]! - 11 * s.u;
    ROWS.forEach(([name, vals, k], i) => {
      const y = (14 + 15 * i) * s.u;
      const a = i < 2 ? 1 : s.ease('step', 0.6, i === 2 ? 3.5 : 6.5);
      s.alpha(a, () => {
        rowLabel(s, name, lx, y, k, 3.6);
        cells(s, xs, y, vals, k, { w: 14, h: 8.5, on: i === 3 ? [1, 1] : [0, 0] });
      });
    });
    s.alpha(s.ease('step', 0.6, 3.5), () => s.text('η = 0.1', xs[1]! + 10 * s.u, 44 * s.u, { size: 3.2, font: 'mono', align: 'left', color: s.c('slate') }));
    const o = { size: 3.4, font: 'mono', color: s.c('--ink-3'), halo: true } as const;
    s.alpha(s.ease('raw', 0.6), () => s.text('unclipped: w − η g = [0.4, 1.2]', s.w / 2, 77 * s.u, o));
    s.alpha(s.ease('raw', 0.6, 2.5), () => s.text('a clipped step: never past η c = 0.5', s.w / 2, 87 * s.u, { ...o, color: s.c('--ink-2') }));
  },
};

export const scenes: Record<string, SceneDef> = { size, clip, step };

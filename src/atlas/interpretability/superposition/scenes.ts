import type { Scene, SceneDef } from '../../../lecture/scene';
import { Rng } from '../../../core/rand';
import { cells, columns, frame, type Frame, num, rich } from '../draw';

const DIRS: [number, number][] = [
  [1, 0],
  [-0.5, Math.sqrt(3) / 2],
  [-0.5, -Math.sqrt(3) / 2],
];
const KS = ['purple', 'teal', 'gold'] as const;

/** A square plot of the 2-D stream, in the top part of the stage. */
function plot(s: Scene, frac = 0.62): Frame {
  const side = Math.min(s.h * frac, s.w * 0.8);
  const cx = s.w / 2;
  const top = s.h * 0.05;
  return frame(cx - side / 2, top, cx + side / 2, top + side, [-1.35, 1.35], [-1.35, 1.35]);
}

function ring(s: Scene, F: Frame): void {
  s.line(F.X(-1.3), F.Y(0), F.X(1.3), F.Y(0), s.c('--axis'), 0.25);
  s.line(F.X(0), F.Y(-1.3), F.X(0), F.Y(1.3), s.c('--axis'), 0.25);
  s.circle(F.X(0), F.Y(0), F.X(1) - F.X(0), { stroke: s.tint('--ink-3', 0.5), lw: 0.25 });
}

/** Feature directions as arrows from the origin, each labelled f0, f1, f2 past its tip. */
function features(s: Scene, F: Frame, a: number, grow = 1): void {
  s.alpha(a, () => {
    DIRS.forEach(([x, y], i) => {
      s.arrow(F.X(0), F.Y(0), F.X(x * grow), F.Y(y * grow), s.c(KS[i]!), 0.5, 2.4);
      s.text(`f${i}`, F.X(x * 1.2), F.Y(y * 1.2), { size: 3.4, font: 'mono', weight: 650, color: s.c(KS[i]!), halo: true });
    });
  });
}

const room: SceneDef = {
  draw(s) {
    const F = plot(s);
    ring(s, F);
    const three = s.ease('three', 0.8);
    s.alpha(s.ease('perp', 0.6) * (1 - three), () => {
      s.arrow(F.X(0), F.Y(0), F.X(1), F.Y(0), s.c('purple'), 0.5, 2.4);
      s.arrow(F.X(0), F.Y(0), F.X(0), F.Y(1), s.c('teal'), 0.5, 2.4);
      const q = 0.14;
      s.line(F.X(q), F.Y(0), F.X(q), F.Y(q), s.c('--ink-3'), 0.25);
      s.line(F.X(q), F.Y(q), F.X(0), F.Y(q), s.c('--ink-3'), 0.25);
      s.text('2 features, exactly perpendicular', s.w / 2, s.h * 0.78, { size: 3.4, color: s.c('--ink-2') });
    });
    features(s, F, three, three);
    s.alpha(s.ease('three', 0.6, 1.5) * (1 - s.ease('cos', 0.6)), () => s.text('3 features, 120° apart', s.w / 2, s.h * 0.78, { size: 3.4, color: s.c('--ink-2') }));
    s.alpha(s.ease('cos', 0.6), () => {
      const c = s.ctx;
      c.beginPath();
      c.arc(F.X(0), F.Y(0), (F.X(0.3) - F.X(0)), -(2 * Math.PI) / 3, 0);
      c.strokeStyle = s.c('--ink-2');
      c.lineWidth = 0.3 * s.u;
      c.stroke();
      s.text('120°', F.X(0.32), F.Y(0.32), { size: 3, font: 'mono', align: 'left', color: s.c('--ink-2'), halo: true });
      rich(s, [['f0 · f1', '--ink'], [' = cos 120° = ', '--ink-2'], ['−0.5', 'red']], s.w / 2, s.h * 0.78, { size: s.tall ? 3.4 : 3.8 });
    });
  },
};

const read: SceneDef = {
  draw(s) {
    const F = plot(s, 0.58);
    ring(s, F);
    features(s, F, 0.45);
    const both = s.ease('both', 1);
    const x = [1 - 0.5 * both, (Math.sqrt(3) / 2) * both];
    s.alpha(s.ease('store', 0.6), () => {
      s.arrow(F.X(0), F.Y(0), F.X(x[0]!), F.Y(x[1]!), s.c('orange'), 0.8, 2.8);
      s.text('x', F.X(x[0]! * 0.55) + 2 * s.u, F.Y(x[1]! * 0.55) + 3 * s.u, { size: 3.6, font: 'mono', weight: 700, color: s.c('orange'), halo: true });
    });
    const reads = DIRS.map(([a, b]) => a * x[0]! + b * x[1]!);
    const xs = columns(s, 3, s.tall ? 20 : 22);
    const y = s.h * 0.78;
    s.alpha(s.ease('read', 0.6), () => {
      xs.forEach((cx, i) => s.text(`f${i} reads`, cx, y - 7 * s.u, { size: 3, font: 'mono', color: s.c(KS[i]!) }));
      cells(s, xs, y, reads.map((v) => num(Math.round(v * 100) / 100)), 'slate', { w: 14, h: 8, on: [0, 1, 2].map((i) => (i === 0 ? both : s.win('read', 'both'))) });
    });
    s.alpha(s.ease('read', 0.6, 2.5) * (1 - both), () => s.text('interference', xs[1]!, y + 7.5 * s.u, { size: 3, color: s.c('red') }));
    s.alpha(s.ease('both', 0.6, 2), () => s.text('half the signal lost', xs[0]!, y + 7.5 * s.u, { size: 3, color: s.c('red') }));
  },
};

// Which of five features are on for each of twelve tokens: rare, with one collision.
const rng = new Rng(3);
const ON: boolean[][] = Array.from({ length: 5 }, () => Array.from({ length: 12 }, () => rng.next() < 0.12));
for (let t = 0; t < 12; t++) for (let f = 1; f < 5; f++) if (ON[0]![t] && ON[f]![t]) ON[f]![t] = false;
ON[1]![7] = true;
ON[3]![7] = true;

const sparse: SceneDef = {
  draw(s) {
    const xs = columns(s, 12, s.tall ? 7.6 : 8.4);
    const ys = [0, 1, 2, 3, 4].map((i) => s.h * (0.14 + i * 0.075));
    const grid = 1 - s.ease('more', 0.6);
    s.alpha(grid, () => {
      s.text('tokens →', xs[11]! + 3 * s.u, ys[0]! - 6 * s.u, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
      ys.forEach((y, f) => {
        s.text(`f${f}`, xs[0]! - 5 * s.u, y, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-2') });
        xs.forEach((x, t) => {
          const on = ON[f]![t];
          s.circle(x, y, (on ? 1.6 : 0.6) * s.u, { fill: on ? s.c(t === 7 ? 'red' : 'green') : s.tint('--ink-3', 0.4) });
        });
      });
      s.alpha(s.ease('rare', 0.6, 3), () => {
        s.rrect(xs[7]! - 3 * s.u, ys[0]! - 3.5 * s.u, 6 * s.u, ys[4]! - ys[0]! + 7 * s.u, 1.5, { stroke: s.c('red'), lw: 0.35 });
        s.text('two at once: rare', xs[7]!, ys[4]! + 7 * s.u, { size: 3, font: 'mono', color: s.c('red') });
      });
    });
    s.alpha(s.ease('clip', 0.6) * grid, () => {
      rich(s, [['alone, f1 reads ', '--ink-2'], ['−0.5', 'red'], ['  → ReLU →  ', '--ink-3'], ['0', 'green']], s.w / 2, s.h * 0.82, { size: s.tall ? 3.4 : 3.8, font: 'mono' });
    });
    s.alpha(s.ease('more', 0.6), () => {
      const l = s.w / 2 - (s.tall ? 40 : 48) * s.u;
      const full = (s.tall ? 80 : 96) * s.u;
      const bar = (y: number, w: number, k: 'slate' | 'green', label: string, grow: number) => {
        s.text(label, l, y - 6 * s.u, { size: 3.4, align: 'left', color: s.c(k) });
        s.rrect(l, y - 3 * s.u, Math.max(1, w * grow), 6 * s.u, 1, { fill: s.tint(k, 0.35), stroke: s.c(k), lw: 0.3 });
      };
      bar(s.h * 0.3, full * 0.12, 'slate', 'exactly perpendicular: d directions', s.ease('more', 0.8));
      bar(s.h * 0.5, full, 'green', 'nearly perpendicular: far more than d', s.ease('more', 2, 1.5));
      s.text('room for many sparse features', s.w / 2, s.h * 0.72, { size: 3.6, weight: 600, color: s.c('green') });
    });
  },
};

export const scenes: Record<string, SceneDef> = { room, read, sparse };

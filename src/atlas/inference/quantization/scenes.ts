import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { cells, columns, rowLabel } from '../../draw';
import { hbar } from '../draw';

const W = [0.7, -0.33, 0.18, -0.52];
const S = 0.1;
const Q = W.map((w) => Math.round(w / S));
const BACK = Q.map((q) => +(q * S).toFixed(1));
const ERR = W.map((w, i) => Math.abs(w - BACK[i]!));
const f = (v: number) => String(+v.toFixed(2)).replace('-', '−');

/** A number line over [-0.8, 0.8]; `ticks` fades in a tick per integer step of the scale. */
function line(s: Scene, y: number, l: number, r: number, step: number, n: number, a: number, ticks: number, labels: boolean): (v: number) => number {
  const X = (v: number) => l + ((v + 0.8) / 1.6) * (r - l);
  s.alpha(a, () => {
    s.line(l, y, r, y, s.c('--axis'), 0.35);
    s.alpha(ticks, () => {
      for (let k = -n; k <= n; k++) {
        const x = X(k * step);
        s.line(x, y - 1.2 * s.u, x, y + 1.2 * s.u, s.tint('slate', 0.9), 0.3);
        if (labels) s.text(String(k).replace('-', '−'), x, y + 4 * s.u, { size: 2.4, font: 'mono', color: s.c('--ink-3') });
      }
    });
  });
  return X;
}

const round: SceneDef = {
  draw(s) {
    const xs = columns(s, 4, s.tall ? 17 : 19).map((x) => x + 5 * s.u);
    const lx = xs[0]! - 11 * s.u;
    const rows: [string, string[], 'blue' | 'purple' | 'teal', number, number][] = [
      ['w', W.map(f), 'blue', s.h * 0.1, 1],
      ['q', Q.map(f), 'purple', s.h * 0.24, s.ease('divide', 0.6, 0.8)],
      ['q × s', BACK.map(f), 'teal', s.h * 0.38, s.ease('back', 0.6)],
    ];
    rows.forEach(([name, vals, k, y, a], r) => {
      s.alpha(r === 0 ? s.ease('weights', 0.6) : a, () => {
        rowLabel(s, name, lx, y, k, 3.6);
        cells(s, xs, y, vals, k, { w: 13, h: 8, size: 3.2, on: r === 1 ? [s.win('divide', 'back'), s.win('divide', 'back'), 0, 0] : r === 2 ? [0, s.win('back', 'error'), 0, 0] : undefined });
      });
    });
    s.alpha(s.ease('divide', 0.6), () => {
      s.text('÷ s, then round', (xs[1]! + xs[2]!) / 2, s.h * 0.17, { size: 2.7, font: 'mono', color: s.c('--ink-3') });
    });
    s.alpha(s.ease('back', 0.6), () => s.text('× s', (xs[1]! + xs[2]!) / 2, s.h * 0.31, { size: 2.7, font: 'mono', color: s.c('--ink-3') }));
    // The steps on a number line, the weights snapping to them.
    const ly = s.h * 0.66;
    const l = s.w / 2 - (s.tall ? 42 : 48) * s.u;
    const r = s.w / 2 + (s.tall ? 42 : 48) * s.u;
    const X = line(s, ly, l, r, S, 7, s.ease('weights', 0.6, 0.6), s.ease('grid', 0.6), true);
    s.alpha(s.ease('grid', 0.6, 1.2), () => s.text('s = 0.1: integers −7 to 7 cover −0.7 to 0.7', s.w / 2, ly + 10 * s.u, { size: 2.9, font: 'mono', color: s.c('--ink-2') }));
    const snap = s.ease('divide', 1, 1.6);
    W.forEach((w, i) => {
      s.alpha(s.ease('weights', 0.5, 0.8 + 0.2 * i), () => {
        // The true weight lifts above the line; its rounded copy slides to the nearest step.
        const lift = s.ease('divide', 0.6, 1);
        const x = lerp(X(w), X(BACK[i]!), snap);
        if (snap > 0.02) s.line(X(w), ly - 6 * s.u, x, ly - 6 * s.u, s.tint('red', 0.8), 0.4);
        s.circle(X(w), ly - (2.4 + 3.6 * lift) * s.u, (1.3 - 0.2 * lift) * s.u, { fill: s.tint('blue', 1 - 0.5 * lift) });
        s.alpha(lift, () => s.circle(x, ly - 2.4 * s.u, 1.3 * s.u, { fill: s.c(snap > 0.5 ? 'teal' : 'blue') }));
      });
    });
    s.alpha(s.ease('error', 0.6), () => {
      s.text(`errors: ${ERR.map((e) => e.toFixed(2)).join(', ')}`, s.w / 2, s.h * 0.84, { size: 3.1, font: 'mono', color: s.c('red') });
      s.text('never more than s / 2 = 0.05', s.w / 2, s.h * 0.91, { size: 3.4, font: 'mono', weight: 650, color: s.c('red') });
    });
  },
};

const SIZES: [string, number, string, string][] = [
  ['16 bits: 2 bytes each', 14, '14 GB', 'b16'],
  ['8 bits: 1 byte each', 7, '7 GB', 'b8'],
  ['4 bits: half a byte', 3.5, '3.5 GB', 'b4'],
];

const bytes: SceneDef = {
  draw(s) {
    const x0 = s.w / 2 - (s.tall ? 36 : 40) * s.u;
    const full = (s.tall ? 58 : 66) * s.u;
    const coarse = s.ease('coarse', 0.7);
    s.text('7 billion weights', s.w / 2, s.h * 0.08, { size: 3.4, font: 'mono', weight: 650, color: s.c('blue') });
    SIZES.forEach(([name, gb, label, beat], i) => {
      const y = s.h * (0.24 + i * 0.15);
      s.alpha(s.ease(beat, 0.6) * (1 - 0.5 * coarse), () => {
        s.text(name, x0, y - 5 * s.u, { size: 2.9, font: 'mono', align: 'left', color: s.c('--ink-3') });
        hbar(s, x0, y, (full * gb * s.ease(beat, 1, 0.3)) / 14, i === 0 ? 'slate' : i === 1 ? 'teal' : 'green', label);
      });
    });
    // The same range, cut into 255 steps or into 15.
    s.alpha(coarse, () => {
      const l = s.w / 2 - (s.tall ? 40 : 46) * s.u;
      const r = s.w / 2 + (s.tall ? 40 : 46) * s.u;
      const y8 = s.h * 0.7;
      const y4 = s.h * 0.86;
      s.text('8 bits: 255 steps over the range', l, y8 - 4.5 * s.u, { size: 2.8, font: 'mono', align: 'left', color: s.c('--ink-3') });
      s.line(l, y8, r, y8, s.c('--axis'), 0.35);
      for (let k = -127; k <= 127; k += 2) s.line(lerp(l, r, (k + 127) / 254), y8 - 0.8 * s.u, lerp(l, r, (k + 127) / 254), y8 + 0.8 * s.u, s.tint('teal', 0.7), 0.15);
      s.text('4 bits: 15 steps, each about 18 times as wide', l, y4 - 4.5 * s.u, { size: 2.8, font: 'mono', align: 'left', color: s.c('--ink-3') });
      line(s, y4, l, r, 0.8 / 7, 7, 1, 1, false);
    });
  },
};

export const scenes: Record<string, SceneDef> = { round, bytes };

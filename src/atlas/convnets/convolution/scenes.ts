import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01, lerp, smooth } from '../../../lecture/scene';
import { bars, cells, columns, rowLabel } from '../../draw';
import { after } from '../../networks/draw';
import { type Grid, type Ink, fmt, grid, gridCells, windowBox } from '../draw';

/** Slides `w` along `x` and takes a dot product at every position where it fits. */
const conv1 = (x: number[], w: number[]): number[] =>
  x.slice(0, x.length - w.length + 1).map((_, i) => w.reduce((a, wk, k) => a + wk * x[i + k]!, 0));

/** Who found an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

const gray = (v: number, max: number) => Math.round(28 + 212 * clamp01(v / max));

/** A pixel in its own gray, the same in both themes: 0 is near black, `max` near white. */
function pixel(s: Scene, cx: number, cy: number, side: number, v: number, max: number, o: { label?: boolean; ring?: number } = {}) {
  const g = gray(v, max);
  s.rrect(cx - side / 2, cy - side / 2, side, side, 0.8, { fill: `rgb(${g}, ${g}, ${g})`, stroke: s.c('--axis'), lw: 0.3 });
  if (o.label) s.text(String(v), cx, cy + 0.2 * s.u, { size: side / s.u * 0.4, font: 'mono', weight: 600, color: g > 140 ? '#1b1b1b' : '#f2f2f2' });
  const ring = o.ring ?? 0;
  if (ring > 0.003) s.alpha(ring, () => s.rrect(cx - side / 2, cy - side / 2, side, side, 0.8, { stroke: s.c('blue'), lw: 0.7 }));
}

function caption(s: Scene, text: string, y: number, k: Ink = '--ink-2', a = 1, size = 3.4) {
  s.alpha(a, () => s.text(text, s.w / 2, y, { size, font: 'mono', color: s.c(k), halo: true }));
}

// ---- finding an edge: a row of pixels, and a three-wide filter sliding along it

const X = [1, 1, 1, 6, 6, 6, 2];
/** The picture the row comes from: its first row is X. */
const IMG = [X, [1, 1, 1, 6, 6, 5, 2], [1, 2, 1, 6, 6, 6, 2]];
const W = [-1, 0, 1];
const OUT = conv1(X, W);
const SUM = conv1(X, [1, 1, 1]);
const sign = (v: number): Ink => (v > 0 ? 'green' : v < 0 ? 'red' : '--ink-3');

/** The detector as a glyph: dark, mid, bright, the pattern it answers to. */
function glyph(s: Scene, cx: number, cy: number) {
  const c = 2.6 * s.u;
  [70, 140, 225].forEach((g, k) => s.rrect(cx + (k - 1) * (c + 0.4 * s.u) - c / 2, cy - c / 2, c, c, 0.5, { fill: `rgb(${g}, ${g}, ${g})`, stroke: s.c('blue'), lw: 0.3 }));
}

const edge: SceneDef = {
  draw(s) {
    const u = s.u;
    const gap = s.tall ? 11.5 : 12;
    const xs = columns(s, 7, gap);
    const pitch = gap * u;
    const side = (gap - 1.5) * u;
    const yStrip = s.h * 0.15;
    const base = s.h * 0.52;
    const top = s.h * 0.31;
    const yo = s.h * 0.64;
    const [l1, l2] = [s.h * 0.75, s.h * 0.83];
    const [cy, cy2] = [s.h * 0.76, s.h * 0.85];

    // The picture first; once one row is taken, the others go.
    const rest = 1 - s.ease('row', 0.6);
    for (let r = IMG.length - 1; r >= 0; r--) s.alpha(r === 0 ? 1 : rest, () => IMG[r]!.forEach((v, j) => pixel(s, xs[j]!, yStrip + r * pitch, side, v, 6)));
    const ex = (xs[2]! + xs[3]!) / 2;
    const edgeA = s.ease('problem', 0.6, 2) * (1 - s.ease('row', 0.4));
    s.alpha(edgeA, () => {
      const yb = yStrip + (IMG.length - 1) * pitch + side / 2;
      s.line(ex, yStrip - side / 2 - 2 * u, ex, yb + 2 * u, s.c('gold'), 0.55, [1.2, 0.9]);
      s.text('edge', ex, yb + 5.5 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('gold'), halo: true });
    });
    caption(s, 'an edge: where the brightness jumps', cy, '--ink-2', s.win('problem', 'row'));

    const grow = s.ease('row', 0.9, 0.5);
    s.alpha(Math.min(1, grow * 2), () => bars(s, xs, base, X, 'orange', { max: 6, height: (base - top) / u, w: 8, fmt: String, grow }));
    s.alpha(grow, () => rowLabel(s, 'x', xs[0]! - (gap / 2 + 1) * u, base - 4 * u, 'orange'));
    caption(s, 'x: one row of brightnesses', cy, 'orange', s.ease('row', 0.6, 1.2) * (1 - s.ease('cells', 0.5)));

    // One cell watches one small patch; the neocognitron copies one detector to every position.
    const cA = s.win('cells', 'machine');
    s.alpha(cA, () => s.rrect(xs[2]! - pitch / 2 + 0.3 * u, yStrip - side / 2 - 1.3 * u, 3 * pitch - 0.6 * u, side + 2.6 * u, 1.4, { stroke: s.c('--ink-2'), lw: 0.55 }));
    caption(s, 'one cell: one small patch, one angle', cy, '--ink-2', cA);
    cite(s, 'Hubel & Wiesel, 1959', cA);
    const mA = s.win('machine', 'filter');
    for (let p = 0; p < 5; p++) s.alpha(mA * s.ease('machine', 0.4, 1.2 + 0.3 * p), () => glyph(s, xs[p + 1]!, yo));
    caption(s, 'the same detector at every position', cy, '--ink-2', mA);
    cite(s, 'the neocognitron · Fukushima, 1980', mA);

    // The filter slides across the climb, then the plateau and the fall; for `sum` it goes back and sweeps again.
    const sum = s.ease('sum', 0.5);
    const back = s.ease('sum', 0.6);
    const dur = s.end('sum') - s.at('sum');
    const fwd = 4 * smooth(clamp01((s.since('sum') - 0.3 * dur) / (0.35 * dur)));
    const p = 2 * s.ease('climb', 2.2, 1) + 2 * s.ease('flat', 2.4, 0.2) - 4 * back + fwd;
    const wx = xs[0]! + p * pitch;
    const flip = after(s, 'agree', 0.5);
    const flipped = flip > 0.5;
    const fA = s.ease('filter', 0.6);
    s.alpha(fA, () => {
      const y0 = yStrip - side / 2 - 1.6 * u;
      s.rrect(wx - pitch / 2, y0, 3 * pitch, base + 7 * u - y0, 1.8, { fill: s.tint('blue', 0.06), stroke: s.c('blue'), lw: 0.5 });
      rowLabel(s, 'w', wx - pitch / 2 - 1.4 * u, base + 3.8 * u, 'blue', 3.8);
      const swap = 1 - Math.abs(flip - 0.5) * 2;
      W.forEach((w, k) => {
        const lab = sum > 0.5 ? '1' : fmt(flipped ? -w : w);
        s.alpha(1 - Math.max(swap, 1 - Math.abs(sum - 0.5) * 2), () => s.text(lab, wx + k * pitch, base + 3.8 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('blue') }));
      });
    });
    caption(s, 'w: a filter of three weights', cy, 'blue', s.win('filter', 'diff'));
    s.alpha(s.ease('diff', 0.6) * (1 - sum), () => s.text('out = last − first', s.w / 2, 5 * u, { size: 3.8, font: 'mono', weight: 600, color: s.c('blue') }));
    s.alpha(sum, () => s.text('out = sum of the patch', s.w / 2, 5 * u, { size: 3.8, font: 'mono', weight: 600, color: s.c('blue') }));
    caption(s, '−1·1 + 0·1 + 1·1 = 0', cy, 'blue', s.ease('diff', 0.6, 1.5) * (1 - s.ease('climb', 0.5)), 3.6);

    const outA = s.ease('diff', 0.5, 2.5);
    s.alpha(outA, () => rowLabel(s, 'out', xs[1]! - (gap / 2 + 1) * u, yo, '--ink-2', 3.6));
    s.alpha(1 - sum, () => OUT.forEach((v0, i) => {
      const v = flipped ? -v0 : v0;
      const a = smooth(clamp01((p - i + 0.4) / 0.4)) * outA;
      const on = Math.max(Math.abs(i - p) < 0.5 ? 1 : 0, i === 4 ? s.win('agree', 'sum') * flip : 0);
      s.alpha(a, () => cells(s, [xs[i + 1]!], yo, [fmt(v)], sign(v), { w: 9.5, h: 8, on: [on] }));
    }));
    const peak = s.ease('sum', 0.6, 0.72 * dur);
    s.alpha(sum, () => SUM.forEach((v, i) => {
      const a = smooth(clamp01((fwd - i + 0.4) / 0.4));
      s.alpha(a, () => cells(s, [xs[i + 1]!], yo, [String(v)], 'gold', { w: 9.5, h: 8, on: [i === 3 ? peak : Math.abs(i - fwd) < 0.5 ? 0.6 : 0] }));
    }));

    const lab = { size: 3.4, font: 'mono', halo: true } as const;
    s.alpha(1 - s.ease('agree', 0.5), () => {
      s.alpha(s.ease('climb', 0.6, 2.6), () => s.text('climbs: +5', (xs[2]! + xs[3]!) / 2, l1, { ...lab, color: s.c('green') }));
      s.alpha(s.ease('flat', 0.6, 1), () => s.text('flat: 0', xs[4]!, l2, { ...lab, color: s.c('--ink-2') }));
      s.alpha(s.ease('flat', 0.6, 2.6), () => s.text('falls: −4', xs[5]!, l1, { ...lab, color: s.c('red') }));
    });
    caption(s, 'largest where the patch looks like w', cy, '--ink-2', s.win('agree', 'sum'));
    caption(s, 'signs flipped: now it finds the fall', cy2, 'green', flip * (1 - sum));
    s.alpha(peak, () => {
      s.text('brightest: 18', xs[4]!, l1, { ...lab, color: s.c('gold') });
      caption(s, 'peaks on the bright part, not the edge', s.h * 0.92);
    });
  },
};

// ---- slide, multiply, add: a bump-shaped filter on a row with one bright spot

const X1 = [1, 2, 5, 2, 3];
const W1 = [-1, 2, -1];
const OUT1 = conv1(X1, W1);

/** Where the window sits: 0 until `step`, then 1, then 2 at `last`, and back to 0 for `flip`. */
const pos1 = (s: Scene) => s.ease('step', 1, 0.2) + s.ease('last', 1, 0.2) - 2 * s.ease('flip', 1.2, 0.3);

const slide: SceneDef = {
  draw(s) {
    const u = s.u;
    const gap = s.tall ? 16 : 15;
    const xs = columns(s, 5, gap);
    const pitch = gap * u;
    const lx = xs[0]! - (gap / 2 + 3) * u;
    const [yw, yx, yp, ysum, yo] = [0.17, 0.36, 0.55, 0.65, 0.83].map((f) => s.h * f);
    const p = pos1(s);
    const pi = Math.round(p);
    const settled = clamp01(1 - Math.abs(p - pi) * 5);
    // The first weight on the first entry, once the window is back at the start.
    const first0 = s.ease('flip', 0.6, 1.6);

    rowLabel(s, 'w', lx + p * pitch, yw, 'blue');
    cells(s, W1.map((_, k) => xs[0]! + (p + k) * pitch), yw, W1.map(fmt), 'blue', { w: 12, h: 8.5, on: W1.map((w, k) => (w > 0 ? s.win('spot', 'first') : k === 0 ? first0 : 0)) });
    rowLabel(s, 'x', lx, yx, 'orange');
    cells(s, xs, yx, X1.map(fmt), 'orange', { w: 12, h: 8.5, on: X1.map((v, i) => (v === 5 ? s.ease('spot', 0.6, 3) * (1 - s.ease('first', 0.4)) : i === 0 ? first0 : 0)) });
    s.alpha(s.ease('first', 0.5), () => s.rrect(xs[0]! + (p - 0.5) * pitch - 0.6 * u, yx - 5.6 * u, 3 * pitch + 1.2 * u, 11.2 * u, 1.8, { stroke: s.c('blue'), lw: 0.5 }));

    const top = (t: string, a: number, k: Ink = '--ink-2') => s.alpha(a, () => s.text(t, s.w / 2, 5.5 * u, { size: 3.4, font: 'mono', color: s.c(k), halo: true }));
    top('w: high in the middle, low at the sides', s.win('spot', 'first'), 'blue');
    top('convolution: Latin for "roll together"', s.win('name', 'flip'));
    top('no flip: w[0] sits on the first entry', s.ease('flip', 0.6), 'blue');

    const prodA = s.ease('first', 0.6, 0.8) * settled * (1 - s.ease('name', 0.6));
    s.alpha(prodA, () => {
      const ps = W1.map((w, k) => w * X1[pi + k]!);
      W1.forEach((w, k) => s.text(`${fmt(w)}·${X1[pi + k]}`, xs[pi + k]!, yp - 6.5 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
      cells(s, ps.map((_, k) => xs[pi + k]!), yp, ps.map(fmt), 'gold', { w: 10, h: 7.5 });
      const sumA = pi === 0 ? s.ease('first', 0.6, 2.4) : pi === 1 ? s.ease('step', 0.6, 2) : s.ease('last', 0.6, 1.6);
      s.alpha(sumA, () => s.text(`${ps.map((v, k) => (k === 0 ? fmt(v) : v < 0 ? ` − ${-v}` : ` + ${v}`)).join('')} = ${fmt(OUT1[pi]!)}`, xs[pi + 1]!, ysum, { size: 3.6, font: 'mono', weight: 600, color: s.c('gold'), halo: true }));
    });

    const oA = [s.ease('first', 0.6, 3.4), s.ease('step', 0.6, 2.8), s.ease('last', 0.6, 2.4)];
    const all = s.ease('name', 0.6);
    s.alpha(oA[0]!, () => rowLabel(s, 'out', xs[1]! - (gap / 2 + 3) * u, yo, 'gold'));
    OUT1.forEach((v, i) => s.alpha(oA[i]!, () => {
      const on = Math.max(all, i === pi ? settled * (1 - all) : 0);
      cells(s, [xs[i + 1]!], yo, [fmt(v)], 'gold', { w: 12, h: 8.5, on: [on] });
    }));
    // Output numbers, counted from 0, once the filter has run out of room.
    s.alpha(s.ease('last', 0.6, 3.5), () => OUT1.forEach((_, i) => s.text(String(i), xs[i + 1]!, yo - 7 * u, { size: 2.8, font: 'mono', weight: 600, color: s.c('--ink-3') })));
    s.alpha(s.ease('last', 0.6, 4), () => s.text('5 inputs, 3 outputs', s.w / 2, yo + 9 * u, { size: 3.4, font: 'mono', color: s.c('--ink-3') }));
  },
};

// ---- in two dimensions: a tiny image with a bright diagonal line, and a diagonal filter

const X3 = [
  [1, 3, 0, 1],
  [0, 1, 3, 0],
  [2, 0, 1, 3],
  [1, 2, 0, 1],
];
const W3 = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
const OUT3 = [0, 1].map((i) => [0, 1].map((j) => X3[i]![j]! + X3[i + 1]![j + 1]! + X3[i + 2]![j + 2]!));

/** Where the window stops, and the beat and delay of each move there; back to the strongest match at `map`. */
const STOPS: [number, number][] = [[0, 0], [0, 1], [1, 0], [1, 1]];
const MOVES: [string, number][] = [['step', 0.3], ['rest', 0.4], ['rest', 2.4]];

function win2(s: Scene): { i: number; j: number; settled: number } {
  let i = 0;
  let j = 0;
  let settled = 1;
  MOVES.forEach(([beat, delay], m) => {
    const a = smooth(clamp01((s.since(beat) - delay) / 0.8));
    if (a > 0) {
      i = lerp(STOPS[m]![0], STOPS[m + 1]![0], a);
      j = lerp(STOPS[m]![1], STOPS[m + 1]![1], a);
      settled = Math.abs(a - 0.5) * 2;
    }
  });
  const back = s.ease('map', 1);
  if (back > 0) {
    i = lerp(i, 0, back);
    j = lerp(j, 1, back);
    settled = Math.abs(back - 0.5) * 2;
  }
  return { i, j, settled };
}

function pixels(s: Scene, g: Grid, X: number[][], max: number, ring: (i: number, j: number) => number) {
  const side = (g.pitch - 1) * s.u;
  X.forEach((row, i) => row.forEach((v, j) => pixel(s, g.x(j), g.y(i), side, v, max, { label: true, ring: ring(i, j) })));
}

const gridScene: SceneDef = {
  draw(s) {
    const tall = s.tall;
    const u = s.u;
    const g = grid(s, tall ? s.w / 2 : s.w * 0.45, tall ? s.h * 0.35 : s.h * 0.46, 4, 4, tall ? 10 : 12);
    const f = grid(s, tall ? s.w * 0.24 : s.w * 0.14, tall ? s.h * 0.81 : s.h * 0.46, 3, 3, tall ? 7 : 8);
    const o = grid(s, tall ? s.w * 0.74 : s.w * 0.8, tall ? s.h * 0.81 : s.h * 0.46, 2, 2, tall ? 10 : 12);
    const w = win2(s);
    const wi = Math.round(w.i);
    const wj = Math.round(w.j);
    const patchA = s.ease('patch', 0.6);
    const inWin = (i: number, j: number) => i - wi >= 0 && i - wi < 3 && j - wj >= 0 && j - wj < 3;
    const diag = (i: number, j: number) => inWin(i, j) && i - wi === j - wj;

    const idxA = s.ease('step', 0.6);
    s.text('x', (g.l + g.r) / 2, g.t - (3.4 + 4 * idxA) * u, { size: 4, font: 'mono', weight: 650, color: s.c('orange') });
    // Row numbers on the left, column numbers on top, lit inside the window.
    s.alpha(idxA, () => {
      for (let n = 0; n < 4; n++) {
        s.text(String(n), g.l - 2.6 * u, g.y(n), { size: 2.8, font: 'mono', weight: 600, color: s.c(n - wi >= 0 && n - wi < 3 ? 'blue' : '--ink-3') });
        s.text(String(n), g.x(n), g.t - 2.6 * u, { size: 2.8, font: 'mono', weight: 600, color: s.c(n - wj >= 0 && n - wj < 3 ? 'blue' : '--ink-3') });
      }
    });
    pixels(s, g, X3, 3, (i, j) => (diag(i, j) ? patchA * w.settled : 0));

    const fA = s.ease('w', 0.6);
    s.alpha(fA, () => {
      s.text('w', (f.l + f.r) / 2, f.t - 3.4 * u, { size: 4, font: 'mono', weight: 650, color: s.c('blue') });
      gridCells(s, f, W3, 'blue', { on: (i, j) => (i === j ? s.ease('w', 0.6, 1.2) : 0) });
    });
    windowBox(s, g, w.i, w.j, 3, 3, 'blue', patchA);

    const index = s.win('index', 'rest');
    const sumA = patchA * w.settled * (1 - s.ease('map', 0.4) + s.ease('map', 0.6, 1)) * (1 - index);
    s.alpha(sumA, () => {
      const d = [0, 1, 2].map((n) => X3[wi + n]![wj + n]!);
      s.text(`${d.join(' + ')} = ${OUT3[wi]![wj]}`, (g.l + g.r) / 2, g.b + 4.6 * u, { size: 3.6, font: 'mono', weight: 600, color: s.c('gold'), halo: true });
    });
    s.alpha(index, () => s.text('row 0, column 1: 0 down, 1 across', (g.l + g.r) / 2, g.b + 4.6 * u, { size: 3.1, font: 'mono', weight: 600, color: s.c('blue'), halo: true }));

    const shown = (i: number, j: number) => {
      const n = STOPS.findIndex(([a, b]) => a === i && b === j);
      if (n === 0) return s.ease('patch', 0.6, 3);
      const [beat, delay] = MOVES[n - 1]!;
      return s.ease(beat, 0.6, delay + 0.5);
    };
    s.alpha(s.ease('patch', 0.6, 3), () => s.text('out', (o.l + o.r) / 2, o.t - 3.4 * u, { size: 4, font: 'mono', weight: 650, color: s.c('gold') }));
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      s.alpha(shown(i, j), () => {
        const on = i === 0 && j === 1 ? Math.max(s.ease('map', 0.6, 0.8), 0.6 * s.win('step', 'rest') * w.settled) : i === wi && j === wj ? 0.6 * w.settled * (1 - s.ease('map', 0.4)) : 0;
        const cw = (o.pitch - 1) * u;
        s.cell(o.x(j) - cw / 2, o.y(i) - cw / 2, cw, cw, String(OUT3[i]![j]), 'gold', { on, size: o.pitch * 0.4 });
      });
    }
    s.alpha(s.ease('map', 0.6, 1.2), () => {
      const y = tall ? o.b + 4 * u : o.b + 5 * u;
      s.text('the line: 9', (o.l + o.r) / 2, y, { size: 3.2, font: 'mono', color: s.c('gold'), halo: true });
    });
  },
};

export const scenes: Record<string, SceneDef> = { edge, slide, grid: gridScene };

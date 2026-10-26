import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01, lerp, smooth } from '../../../lecture/scene';
import { bars, cells, columns, rowLabel } from '../../draw';
import { fmt, grid, gridCells, windowBox } from '../draw';

const X = [1, 2, 4, 4, 1];
const W = [-1, 0, 1];
const OUT = X.slice(0, 3).map((_, i) => W.reduce((a, w, k) => a + w * X[i + k]!, 0));

/** Where the window sits: 0 until `step`, then 1, then 2 at `last`. */
const pos1 = (s: Scene) => s.ease('step', 1, 0.2) + s.ease('last', 1, 0.2);

const slide: SceneDef = {
  draw(s) {
    const gap = s.tall ? 16 : 15;
    const xs = columns(s, 5, gap);
    const pitch = gap * s.u;
    const lx = xs[0]! - (gap / 2 + 3) * s.u;
    const [yw, yx, yp, ysum, yo] = [0.15, 0.34, 0.53, 0.63, 0.82].map((f) => s.h * f);
    const p = pos1(s);
    const pi = Math.round(p);
    const settled = clamp01(1 - Math.abs(p - pi) * 5);
    const dotOn = s.ease('dot', 0.6);

    rowLabel(s, 'w', lx + p * pitch, yw, 'blue');
    cells(s, W.map((_, k) => xs[0]! + (p + k) * pitch), yw, W.map(fmt), 'blue', { w: 12, h: 8.5, on: W.map(() => dotOn) });
    rowLabel(s, 'x', lx, yx, 'orange');
    cells(s, xs, yx, X.map(fmt), 'orange', { w: 12, h: 8.5 });
    s.alpha(s.ease('first', 0.5), () => s.rrect(xs[0]! + (p - 0.5) * pitch - 0.6 * s.u, yx - 5.6 * s.u, 3 * pitch + 1.2 * s.u, 11.2 * s.u, 1.8, { stroke: s.c('blue'), lw: 0.5 }));

    const prodA = s.ease('first', 0.6, 0.8) * settled * (1 - dotOn);
    s.alpha(prodA, () => {
      const ps = W.map((w, k) => w * X[pi + k]!);
      W.forEach((w, k) => s.text(`${fmt(w)}·${X[pi + k]}`, xs[pi + k]!, yp - 6.5 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
      cells(s, ps.map((_, k) => xs[pi + k]!), yp, ps.map(fmt), 'gold', { w: 10, h: 7.5 });
      const sumA = pi === 0 ? s.ease('first', 0.6, 2.4) : pi === 1 ? s.ease('step', 0.6, 2) : s.ease('last', 0.6, 1.6);
      s.alpha(sumA, () => s.text(`${ps.map((v, k) => (k === 0 ? fmt(v) : v < 0 ? ` − ${-v}` : ` + ${v}`)).join('')} = ${fmt(OUT[pi]!)}`, xs[pi + 1]!, ysum, { size: 3.6, font: 'mono', weight: 600, color: s.c('gold'), halo: true }));
    });

    const oA = [s.ease('first', 0.6, 3.4), s.ease('step', 0.6, 2.8), s.ease('last', 0.6, 2.4)];
    s.alpha(oA[0]!, () => rowLabel(s, 'out', xs[1]! - (gap / 2 + 3) * s.u, yo, 'gold'));
    OUT.forEach((v, i) => s.alpha(oA[i]!, () => cells(s, [xs[i + 1]!], yo, [fmt(v)], 'gold', { w: 12, h: 8.5, on: [Math.max(dotOn, i === pi ? settled * s.ease('first', 0.6, 3.4) * (1 - dotOn) : 0)] })));
    s.alpha(s.ease('last', 0.6, 4), () => s.text('5 inputs, 3 outputs', s.w / 2, yo + 9 * s.u, { size: 3.4, font: 'mono', color: s.c('--ink-3') }));
  },
};

const X2 = [1, 1, 1, 6, 6, 6, 2];
const OUT2 = X2.slice(0, 5).map((_, i) => X2[i + 2]! - X2[i]!);
const SUM2 = X2.slice(0, 5).map((_, i) => X2[i]! + X2[i + 1]! + X2[i + 2]!);

const edges: SceneDef = {
  draw(s) {
    const gap = s.tall ? 11.5 : 12;
    const xs = columns(s, 7, gap);
    const pitch = gap * s.u;
    const base = s.h * 0.5;
    const top = s.h * 0.2;
    const sum = s.ease('sum', 0.5);
    // The window crosses the climb during `step` and the plateau and fall during `flat`; for `sum` it goes back and sweeps again.
    const back = s.ease('sum', 0.6);
    const dur = s.end('sum') - s.at('sum');
    const fwd = 4 * smooth(clamp01((s.since('sum') - 0.3 * dur) / (0.35 * dur)));
    const p = 2 * s.ease('step', 2.5, 1.5) + 2 * s.ease('flat', 2.5, 0.3) - 4 * back + fwd;
    s.alpha(1 - sum, () => s.text('out = last − first', s.w / 2, s.h * 0.08, { size: 3.8, font: 'mono', weight: 600, color: s.c('blue') }));
    s.alpha(sum, () => s.text('out = sum of the window', s.w / 2, s.h * 0.08, { size: 3.8, font: 'mono', weight: 600, color: s.c('blue') }));
    bars(s, xs, base, X2, 'orange', { max: 6, height: (base - top) / s.u - 4, w: 8, fmt: (v) => String(v) });
    s.alpha(s.ease('step', 0.6), () => rowLabel(s, 'x', xs[0]! - (gap / 2 + 1) * s.u, base - 4 * s.u, 'orange'));
    const wx = xs[0]! + p * pitch;
    s.rrect(wx - pitch / 2, top - 6 * s.u, 3 * pitch, base - top + 13 * s.u, 1.8, { fill: s.tint('blue', 0.06), stroke: s.c('blue'), lw: 0.5 });
    W.forEach((w, k) => s.alpha(1 - sum, () => s.text(fmt(w), wx + k * pitch, base + 3.8 * s.u, { size: 3.4, font: 'mono', weight: 650, color: s.c('blue') })));
    W.forEach((_, k) => s.alpha(sum, () => s.text('1', wx + k * pitch, base + 3.8 * s.u, { size: 3.4, font: 'mono', weight: 650, color: s.c('blue') })));
    const yo = s.h * 0.64;
    s.alpha(1 - sum, () => OUT2.forEach((v, i) => {
      const a = smooth(clamp01((p - i + 0.4) / 0.4)) * s.ease('step', 0.4, 1.2);
      const k = v > 0 ? 'green' : v < 0 ? 'red' : '--ink-3';
      s.alpha(a, () => cells(s, [xs[i + 1]!], yo, [fmt(v)], k, { w: 9.5, h: 8, on: [Math.abs(i - p) < 0.5 ? 1 : 0] }));
    }));
    const peak = s.ease('sum', 0.6, 0.72 * dur);
    s.alpha(sum, () => SUM2.forEach((v, i) => {
      const a = smooth(clamp01((fwd - i + 0.4) / 0.4));
      s.alpha(a, () => cells(s, [xs[i + 1]!], yo, [String(v)], 'gold', { w: 9.5, h: 8, on: [i === 3 ? peak : Math.abs(i - fwd) < 0.5 ? 0.6 : 0] }));
    }));
    s.alpha(s.ease('step', 0.6, 1.2), () => rowLabel(s, 'out', xs[1]! - (gap / 2 + 1) * s.u, yo, '--ink-2', 3.6));
    const l1 = s.h * 0.75;
    const l2 = s.h * 0.83;
    s.alpha(1 - sum, () => {
      s.alpha(s.ease('step', 0.6, 3.5), () => s.text('climbs: +5', (xs[2]! + xs[3]!) / 2, l1, { size: 3.4, font: 'mono', color: s.c('green') }));
      s.alpha(s.ease('flat', 0.6, 1.2), () => s.text('flat: 0', xs[4]!, l2, { size: 3.4, font: 'mono', color: s.c('--ink-2') }));
      s.alpha(s.ease('flat', 0.6, 2.6), () => s.text('falls: −4', xs[5]!, l1, { size: 3.4, font: 'mono', color: s.c('red') }));
      s.alpha(s.ease('detect', 0.6), () => s.text('big where the input looks like the filter', s.w / 2, s.h * 0.93, { size: 3.5, color: s.c('--ink-2') }));
    });
    s.alpha(peak, () => {
      s.text('brightest: 18', xs[4]!, l1, { size: 3.4, font: 'mono', color: s.c('gold') });
      s.text('peaks on the bright part, not the edge', s.w / 2, s.h * 0.93, { size: 3.5, color: s.c('--ink-2') });
    });
  },
};

const X3 = [
  [1, 2, 0, 1],
  [0, 1, 3, 1],
  [2, 1, 0, 2],
  [1, 0, 1, 3],
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

function win2(s: Scene): { i: number; j: number; k: number; settled: number } {
  let i = 0;
  let j = 0;
  let k = 0;
  let settled = 1;
  MOVES.forEach(([beat, delay], m) => {
    const a = smooth(clamp01((s.since(beat) - delay) / 0.8));
    if (a > 0) {
      i = lerp(STOPS[m]![0], STOPS[m + 1]![0], a);
      j = lerp(STOPS[m]![1], STOPS[m + 1]![1], a);
      k = a > 0.5 ? m + 1 : m;
      settled = Math.abs(a - 0.5) * 2;
    }
  });
  const back = s.ease('map', 1);
  if (back > 0) {
    i = lerp(i, 0, back);
    j = lerp(j, 1, back);
    k = back > 0.5 ? 1 : k;
    settled = Math.abs(back - 0.5) * 2;
  }
  return { i, j, k, settled };
}

const gridScene: SceneDef = {
  draw(s) {
    const tall = s.tall;
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
    s.text('x', (g.l + g.r) / 2, g.t - (3.4 + 4 * idxA) * s.u, { size: 4, font: 'mono', weight: 650, color: s.c('orange') });
    // Row numbers on the left, column numbers on top, lit inside the window.
    s.alpha(idxA, () => {
      for (let n = 0; n < 4; n++) {
        s.text(String(n), g.l - 2.6 * s.u, g.y(n), { size: 2.8, font: 'mono', weight: 600, color: s.c(n - wi >= 0 && n - wi < 3 ? 'blue' : '--ink-3') });
        s.text(String(n), g.x(n), g.t - 2.6 * s.u, { size: 2.8, font: 'mono', weight: 600, color: s.c(n - wj >= 0 && n - wj < 3 ? 'blue' : '--ink-3') });
      }
    });
    gridCells(s, g, X3, 'orange', { on: (i, j) => (diag(i, j) ? patchA * w.settled : 0) });
    s.text('w', (f.l + f.r) / 2, f.t - 3.4 * s.u, { size: 4, font: 'mono', weight: 650, color: s.c('blue') });
    gridCells(s, f, W3, 'blue', { on: (i, j) => (i === j ? patchA : 0) });
    windowBox(s, g, w.i, w.j, 3, 3, 'blue', patchA);

    const rule = s.win('rule', 'rest');
    const sumA = patchA * w.settled * (1 - s.ease('map', 0.4) + s.ease('map', 0.6, 1)) * (1 - rule);
    s.alpha(sumA, () => {
      const d = [0, 1, 2].map((n) => X3[wi + n]![wj + n]!);
      s.text(`${d.join(' + ')} = ${OUT3[wi]![wj]}`, (g.l + g.r) / 2, g.b + 4.6 * s.u, { size: 3.6, font: 'mono', weight: 600, color: s.c('gold'), halo: true });
    });
    s.alpha(rule, () => s.text('row i, column j: rows i to i+2, columns j to j+2', (g.l + g.r) / 2, g.b + 4.6 * s.u, { size: 3, font: 'mono', weight: 600, color: s.c('blue'), halo: true }));

    const shown = (i: number, j: number) => {
      const n = STOPS.findIndex(([a, b]) => a === i && b === j);
      if (n === 0) return s.ease('patch', 0.6, 3);
      const [beat, delay] = MOVES[n - 1]!;
      return s.ease(beat, 0.6, delay + 0.5);
    };
    s.alpha(s.ease('patch', 0.6, 3), () => s.text('out', (o.l + o.r) / 2, o.t - 3.4 * s.u, { size: 4, font: 'mono', weight: 650, color: s.c('gold') }));
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      s.alpha(shown(i, j), () => {
        const on = i === 0 && j === 1 ? Math.max(s.ease('map', 0.6, 0.8), 0.6 * s.win('step', 'rest') * w.settled) : i === wi && j === wj ? 0.6 * w.settled * (1 - s.ease('map', 0.4)) : 0;
        const cw = (o.pitch - 1) * s.u;
        s.cell(o.x(j) - cw / 2, o.y(i) - cw / 2, cw, cw, String(OUT3[i]![j]), 'gold', { on, size: o.pitch * 0.4 });
      });
    }
    s.alpha(s.ease('map', 0.6, 1.2), () => {
      const y = tall ? o.b + 4 * s.u : o.b + 5 * s.u;
      s.text('strongest match', (o.l + o.r) / 2, y, { size: 3.2, font: 'mono', color: s.c('gold'), halo: true });
    });
  },
};

export const scenes: Record<string, SceneDef> = { slide, edges, grid: gridScene };

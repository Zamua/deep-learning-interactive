import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { after, band, name, pulse, runAfter, wire, type P } from '../../backprop/draw';
import type { Ink } from '../../linear-algebra/draw';
import { cells, columns, rich, rowLabel } from '../draw';

const X = [3, 1, 2, 1];
const W = [
  [1, -3, 0, 2],
  [2, 1, -1, 0],
  [-1, 0, 4, -2],
];
const S = W.map((r) => r.reduce((a, w, j) => a + w * X[j]!, 0));
const fmt = (v: number) => String(v).replace('-', '−');

/** Pixel columns and the rows of the linear scene, for either stage shape. */
function layout(s: Scene) {
  const xs = columns(s, 4, 13).map((x) => x - 6 * s.u);
  return { xs, lx: xs[0]! - 9 * s.u, sx: xs[3]! + 21 * s.u, yx: s.h * 0.12, yw: [0.3, 0.4, 0.5].map((f) => s.h * f), yt: s.h * 0.64, yg: s.h * 0.82 };
}

const linear: SceneDef = {
  draw(s) {
    const L = layout(s);
    const o = { w: 10.5, h: 7.4, size: 3.4 };
    const nudge = s.win('nudge', 'row');
    rowLabel(s, 'x', L.lx, L.yx, 'orange');
    cells(s, L.xs, L.yx, X.map(fmt), 'orange', { ...o, on: [0, nudge, 0, 0] });
    s.alpha(s.ease('setup', 0.6, 0.6), () => {
      rowLabel(s, 'W', L.lx, L.yw[0]! - 6.8 * s.u, 'blue', 3.8);
      W.forEach((r, c) => {
        const row0 = c === 0 ? s.ease('ask', 0.5) : 0;
        s.text(`class ${c}`, L.lx, L.yw[c]!, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
        cells(s, L.xs, L.yw[c]!, r.map(fmt), 'blue', { ...o, on: r.map((_, j) => (c === 0 ? (j === 1 ? Math.max(nudge, row0 * 0.6) : row0 * 0.6 * (1 - nudge)) : 0)) });
      });
    });
    s.alpha(after(s, 'setup', 0.6), () => {
      s.text('s', L.sx, L.yx, { size: 4, font: 'mono', weight: 650, color: s.c('purple') });
      W.forEach((_, c) => cells(s, [L.sx], L.yw[c]!, [fmt(S[c]!)], 'purple', { ...o, on: [c === 0 ? s.ease('ask', 0.5) : 0] }));
      s.arrow(L.xs[3]! + 7 * s.u, L.yw[1]!, L.sx - 7 * s.u, L.yw[1]!, s.c('--ink-3'), 0.35, 2);
    });
    s.alpha(after(s, 'ask', 0.5) * (1 - s.ease('nudge', 0.4)), () => rich(s, [['how fast does ', '--ink-2'], ['s₀', 'purple'], [' move per pixel?', '--ink-2']], s.w / 2, L.yt, { size: 3.4, weight: 600 }));
    s.alpha(after(s, 'nudge', 0.55) * (1 - s.ease('row', 0.4)), () =>
      rich(s, [['x₁ + 0.1', 'orange'], ['  →  ', '--ink-3'], ['s₀', 'purple'], [' moves −3 × 0.1 = −0.3', '--ink-2']], s.w / 2, L.yt, { size: 3.4, weight: 600 }),
    );
    const g = after(s, 'row', 0.1, 0.8);
    s.alpha(g, () => {
      s.arrow(s.w / 2 - 6 * s.u, L.yw[0]! + 5 * s.u, s.w / 2 - 6 * s.u, L.yg - 5 * s.u, s.tint('--ink-3', 0.6), 0.3, 2);
      rowLabel(s, '∂s₀/∂x', L.lx, L.yg, 'red', 3.6);
      cells(s, L.xs, L.yg, W[0]!.map(fmt), 'red', { ...o, on: [1, 1, 1, 1].map(() => after(s, 'row', 0.3)) });
    });
    s.alpha(after(s, 'row', 0.75), () => s.text('same for any x', L.sx, L.yg, { size: 3, color: s.c('--ink-3'), halo: true }));
  },
};

/** A 2 x 2 picture of four pixels in reading order, each tinted by `heat` (0..1), with its index. */
function pixels(s: Scene, cx: number, cy: number, heat: number[], k: Ink, ring = -1, ringA = 0): void {
  const p = 11 * s.u;
  heat.forEach((h, i) => {
    const x = cx + ((i % 2) - 0.5) * p;
    const y = cy + (Math.floor(i / 2) - 0.5) * p;
    s.rrect(x - p / 2 + 0.3 * s.u, y - p / 2 + 0.3 * s.u, p - 0.6 * s.u, p - 0.6 * s.u, 0.6, { fill: s.tint(k, 0.06 + 0.8 * h), stroke: s.tint(k, 0.5), lw: 0.25 });
    s.text(String(i), x, y, { size: 3, font: 'mono', weight: 600, color: s.c('--ink'), halo: true });
  });
  if (ringA > 0 && ring >= 0) {
    const x = cx + ((ring % 2) - 0.5) * p;
    const y = cy + (Math.floor(ring / 2) - 0.5) * p;
    s.alpha(ringA, () => s.rrect(x - p / 2 - 0.4 * s.u, y - p / 2 - 0.4 * s.u, p + 0.8 * s.u, p + 0.8 * s.u, 1, { stroke: s.c('red'), lw: 0.7 }));
  }
}

const map: SceneDef = {
  draw(s) {
    const L = layout(s);
    const o = { w: 10.5, h: 7.4, size: 3.4 };
    const sw = s.ease('other', 0.8, 0.5);
    const yg = s.h * 0.12;
    const ya = s.h * 0.29;
    const yb = s.h * 0.43;
    const c = sw > 0.5 ? 2 : 0;
    const g = W[c]!;
    const fade = sw < 0.5 ? 1 - 2 * sw : 2 * sw - 1;
    s.alpha(fade, () => {
      rowLabel(s, `∂s${c ? '₂' : '₀'}/∂x`, L.lx, yg, 'red', 3.6);
      cells(s, L.xs, yg, g.map(fmt), 'red', o);
    });
    // The sign as an arrow's direction, the size as its length.
    s.alpha(s.ease('sign', 0.6, 0.3) * fade, () => {
      g.forEach((v, j) => {
        if (!v) return;
        const len = Math.abs(v) * 2.2 * s.u;
        const up = v > 0;
        s.arrow(L.xs[j]!, ya + (up ? len / 2 : -len / 2), L.xs[j]!, ya + (up ? -len / 2 : len / 2), s.c(up ? 'green' : 'red'), 0.5, 1.8);
      });
      s.text('s moves', L.lx, ya, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
    });
    const abs = g.map((v) => Math.abs(v));
    s.alpha(after(s, 'abs', 0.3) * fade, () => {
      rowLabel(s, `|∂s${c ? '₂' : '₀'}/∂x|`, L.lx, yb, 'gold', 3.6);
      cells(s, L.xs, yb, abs.map(fmt), 'gold', o);
    });
    // The image and the class's saliency map over it.
    const ym = s.h * 0.74;
    const xi = s.w / 2 - 22 * s.u;
    const xm = s.w / 2 + 22 * s.u;
    s.alpha(s.ease('show', 0.6), () => {
      pixels(s, xi, ym, X.map((v) => v / 4), 'orange');
      s.text('image x', xi, ym + 15.5 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c('orange') });
      s.alpha(fade, () => {
        pixels(s, xm, ym, abs.map((v) => v / Math.max(...abs)), 'gold', c === 0 ? 1 : 2, after(s, 'show', 0.25) * (c === 0 ? 1 : after(s, 'other', 0.6)));
        s.text(`saliency, class ${c}`, xm, ym + 15.5 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c('gold') });
      });
    });
  },
};

// The graph s = 3 max(0, 2 x0 - x1): inputs, the two scalings, the add, the max, the last multiply.
const PT: Record<string, P> = {
  x0: [0, 0.34],
  x1: [0, 0.66],
  m0: [0.2, 0.34],
  m1: [0.2, 0.66],
  add: [0.42, 0.5],
  max: [0.62, 0.5],
  m3: [0.82, 0.5],
  out: [1, 0.5],
};
const R = 4.6;

/** An input's name, x with its index as a subscript, ending just left of (x, y). */
function pixel(s: Scene, x: number, y: number, i: string): void {
  const o = { font: 'serif', italic: true, weight: 550, color: s.c('orange'), align: 'right' } as const;
  s.text(i, x - 1.4 * s.u, y + 1.4 * s.u, { ...o, size: 3.2 });
  s.text('x', x - 3.4 * s.u, y, { ...o, size: 4.8 });
}

function node(s: Scene, x: number, y: number, glyph: string, on: number): void {
  s.circle(x, y, R * s.u, { fill: s.tint('--ink-2', 0.1 + 0.22 * on), stroke: s.tint('--ink-2', 0.55 + 0.45 * on), lw: 0.35 + 0.25 * on });
  s.text(glyph, x, y + 0.2 * s.u, { size: glyph.length > 2 ? 2.7 : 3.4, font: 'mono', weight: 650, color: s.c('--ink-2') });
}

// Forward values per wire (x0, x1, 2x0, -x1, q, r, s) on the image [2, 1], then on [1, 3].
const VA = ['2', '1', '4', '−1', '3', '3', '9'];
const VB = ['1', '3', '2', '−3', '−1', '0', '0'];
// Gradients flowing back along the same wires.
const GA = ['6', '−3', '3', '3', '3', '3', '1'];
const GB = ['0', '0', '0', '0', '0', '3', '1'];

const deeper: SceneDef = {
  marks: { f: { tex: String.raw`\syms = 3\max(0,\ 2\symx_0 - \symx_1)`, x: 0.5, y: 0.1, size: 5 } },
  draw(s) {
    s.show('f', 1);
    const at = band(s, 100, 13);
    const p = (k: string) => at(PT[k]!);
    const dep = s.ease('depends', 0.8, 0.4);
    const va = (i: number, a: number) => ({ val: dep > 0.5 ? VB[i]! : VA[i]!, va: a * (dep > 0.5 ? 2 * dep - 1 : 1 - 2 * dep) });
    const fv = (f: number) => after(s, 'fwd', f);
    const gr = (i: number, a: number) => ({ grad: dep > 0.5 ? GB[i]! : GA[i]!, ga: a * (dep > 0.5 ? 2 * dep - 1 : 1 - 2 * dep) });
    const gx = after(s, 'pixels', 0.45);
    const gq = after(s, 'pixels', 0.1);
    const gm = after(s, 'back', 0.6);
    const g3 = after(s, 'back', 0.3);
    const g1 = after(s, 'back', 0.05);
    const [x0, x1, m0, m1, add, mx, m3, out] = ['x0', 'x1', 'm0', 'm1', 'add', 'max', 'm3', 'out'].map(p) as [number, number][];
    wire(s, ...x0!, ...m0!, { r1: R, t: 0.4, ...va(0, fv(0.1)), ...gr(0, gx) });
    wire(s, ...x1!, ...m1!, { r1: R, t: 0.4, ...va(1, fv(0.1)), ...gr(1, gx) });
    wire(s, ...m0!, ...add!, { r0: R, r1: R, t: 0.45, ...va(2, fv(0.3)), ...gr(2, gq) });
    wire(s, ...m1!, ...add!, { r0: R, r1: R, t: 0.45, ...va(3, fv(0.3)), ...gr(3, gq) });
    wire(s, ...add!, ...mx!, { r0: R, r1: R, ...va(4, fv(0.45)), ...gr(4, gq) });
    wire(s, ...mx!, ...m3!, { r0: R, r1: R, ...va(5, fv(0.65)), ...gr(5, gm) });
    wire(s, ...m3!, ...out!, { r0: R, ...va(6, fv(0.85)), ...gr(6, g1) });
    pixel(s, x0![0], x0![1], '0');
    pixel(s, x1![0], x1![1], '1');
    name(s, out![0], out![1], 's', 'purple', 'out');
    const lit = (from: string, until: string) => s.win(from, until, 0.4);
    node(s, ...m0!, '×2', lit('pixels', 'depends'));
    node(s, ...m1!, '×−1', lit('pixels', 'depends'));
    node(s, ...add!, '+', lit('pixels', 'depends'));
    node(s, ...mx!, 'max', lit('back', 'pixels') * after(s, 'back', 0.5));
    node(s, ...m3!, '×3', lit('back', 'pixels') * (1 - after(s, 'back', 0.5)));
    // The gradient travelling back, one hop at a time.
    pulse(s, ...out!, ...m3!, runAfter(s, 'back', 0, 0.8), 'red');
    pulse(s, ...m3!, ...mx!, runAfter(s, 'back', 0.25, 0.8), 'red');
    pulse(s, ...mx!, ...add!, runAfter(s, 'back', 0.6, 0.8), 'red');
    pulse(s, ...add!, ...m0!, runAfter(s, 'pixels', 0.05, 0.7), 'red');
    pulse(s, ...add!, ...m1!, runAfter(s, 'pixels', 0.05, 0.7), 'red');
    pulse(s, ...m0!, ...x0!, runAfter(s, 'pixels', 0.35, 0.7), 'red');
    pulse(s, ...m1!, ...x1!, runAfter(s, 'pixels', 0.35, 0.7), 'red');
    const ly = s.h * 0.84;
    const line = (runs: [string, Ink][], a: number) => s.alpha(a, () => rich(s, runs, s.w / 2, ly, { size: 3.4, weight: 600 }));
    line([['saliency: ', '--ink-2'], ['|6| = 6', 'gold'], [',  ', '--ink-2'], ['|−3| = 3', 'gold']], after(s, 'pixels', 0.8) * (1 - s.ease('depends', 0.4)));
    line([['x = [1, 3]: q = −1, max sends back ', '--ink-2'], ['0', 'red']], after(s, 'depends', 0.35));
    s.alpha(after(s, 'depends', 0.75), () => rich(s, [['saliency: ', '--ink-2'], ['0, 0', 'gold']], s.w / 2, ly + 7 * s.u, { size: 3.4, weight: 600 }));
    s.alpha(after(s, 'graph', 0.4) * (1 - s.ease('fwd', 0.4)), () => {
      const [qx, qy] = add!;
      s.text('q', lerp(qx, mx![0], 0.5), qy + 5.5 * s.u, { size: 3.4, italic: true, color: s.c('--ink-3') });
      s.text('r', lerp(mx![0], m3![0], 0.5), qy + 5.5 * s.u, { size: 3.4, italic: true, color: s.c('--ink-3') });
    });
  },
};

export const scenes: Record<string, SceneDef> = { linear, map, deeper };

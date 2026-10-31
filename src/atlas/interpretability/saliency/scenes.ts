import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { band, name, type P, pulse, runAfter, wire } from '../../backprop/draw';
import { after, cells, cite, columns, fmt, rowLabel } from '../../draw';
import { rich } from '../../linear-algebra/draw';

const X = [3, 1, 2, 1];
const W = [
  [1, -3, 0, 2],
  [0, 2, -1, 0],
  [-1, 0, 3, -2],
];
const S = W.map((r) => r.reduce((a, w, j) => a + w * X[j]!, 0));
const G = W[0]!;
const sgn = (v: number) => (v > 0 ? `+${v}` : fmt(v));

function caption(s: Scene, text: string, a: number, k: Ink = '--ink-2', y = 0.92) {
  s.alpha(a, () => s.text(text, s.w / 2, s.h * y, { size: 3.4, font: 'mono', color: s.c(k), halo: true }));
}

/**
 * A 2 x 2 image of four pixels in reading order, `p` units a side: each tinted by `heat` (0..1),
 * with its index in the corner and, when given, a label in the middle. `ring` outlines pixels.
 */
function image(s: Scene, cx: number, cy: number, p: number, heat: number[], k: Ink, o: { labels?: string[]; ring?: number[]; ringK?: Ink } = {}): void {
  const P = p * s.u;
  heat.forEach((h, i) => {
    const x = cx + ((i % 2) - 0.5) * P;
    const y = cy + (Math.floor(i / 2) - 0.5) * P;
    s.rrect(x - P / 2 + 0.3 * s.u, y - P / 2 + 0.3 * s.u, P - 0.6 * s.u, P - 0.6 * s.u, 0.8, { fill: s.tint(k, 0.06 + 0.8 * h), stroke: s.tint(k, 0.5), lw: 0.25 });
    s.text(String(i), x - P / 2 + 2.2 * s.u, y - P / 2 + 2.6 * s.u, { size: 2.6, font: 'mono', color: s.c('--ink-3') });
    if (o.labels) s.text(o.labels[i]!, x, y + 0.3 * s.u, { size: p * 0.26, font: 'mono', weight: 650, color: s.c('--ink'), halo: true });
    const r = o.ring?.[i] ?? 0;
    if (r > 0.003) s.alpha(r, () => s.rrect(x - P / 2 - 0.3 * s.u, y - P / 2 - 0.3 * s.u, P + 0.6 * s.u, P + 0.6 * s.u, 1, { stroke: s.c(o.ringK ?? 'red'), lw: 0.7 }));
  });
}

// ---- which pixels mattered: nudge each one and watch class 0's score

const ask: SceneDef = {
  draw(s) {
    const u = s.u;
    const ix = s.w / 2 - 24 * u;
    const iy = s.h * 0.36;
    // How far each pixel is nudged right now, 0..1: pixel 0, then 1, then 2 and 3 in one beat.
    const n = [
      after(s, 'nudge', 0.6, 0.4) * (1 - s.ease('jump', 0.4)),
      after(s, 'jump', 0.15, 0.4) * (1 - s.ease('still', 0.4)),
      after(s, 'still', 0.08, 0.4) * (1 - after(s, 'still', 0.48, 0.4)),
      after(s, 'still', 0.58, 0.4) * (1 - s.ease('grad', 0.4)),
    ];
    const seen = [after(s, 'nudge', 0.75), after(s, 'jump', 0.3), after(s, 'still', 0.2), after(s, 'still', 0.7)];
    const pix = s.ease('pixels', 0.6, 0.6);
    image(s, ix, iy, 17, X.map((v, j) => (v + n[j]!) / 6), 'orange', { labels: X.map((v, j) => String(v + (n[j]! > 0.5 ? 1 : 0))), ring: n.map((v) => v * pix) });
    s.alpha(pix, () => s.text('image x', ix, iy + 21 * u, { size: 3.2, font: 'mono', weight: 600, color: s.c('orange') }));

    // The three class scores as bars; class 0's follows the nudges.
    const map = s.ease('name', 0.8);
    const bx = [s.w / 2 + 12 * u, s.w / 2 + 23 * u, s.w / 2 + 34 * u];
    const base = s.h * 0.5;
    const k = 6.5 * u;
    const s0 = S[0]! + n.reduce((a, v, j) => a + v * G[j]!, 0);
    const vals = [s0, S[1]!, S[2]!];
    const dim = s.win('nudge', 'name');
    s.alpha(1 - map, () => {
      s.line(bx[0]! - 6 * u, base, bx[2]! + 6 * u, base, s.c('--axis'), 0.35);
      vals.forEach((v, c) => {
        s.alpha(c ? 1 - 0.75 * dim : 1, () => {
          const top = c === 0;
          const hh = v * k;
          s.rrect(bx[c]! - 3.2 * u, Math.min(base, base - hh), 6.4 * u, Math.max(Math.abs(hh), 0.5 * u), 0.6, { fill: s.tint('purple', top ? 0.7 : 0.3), stroke: s.c('purple'), lw: 0.3 });
          s.text(fmt(Math.round(v)), bx[c]!, (hh >= 0 ? base - hh - 3 * u : base - hh + 3 * u), { size: 3.4, font: 'mono', weight: 650, color: s.c('purple'), halo: true });
          s.text(c ? `s${c === 1 ? '₁' : '₂'}` : 's₀', bx[c]!, base + 14.5 * u, { size: 3.4, font: 'mono', weight: top ? 700 : 500, color: s.c(top ? 'purple' : '--ink-3') });
        });
      });
      s.alpha(s.win('ask', 'nudge'), () => s.text('class 0 wins', bx[1]!, base - 24 * u, { size: 3.2, font: 'mono', color: s.c('--ink-2'), halo: true }));
    });

    // What each nudge did to s₀, recorded under the image: then named as the gradient.
    const gName = s.ease('grad', 0.6);
    const yr = s.h * 0.74;
    const xs = [0, 1, 2, 3].map((j) => ix + (j - 1.5) * 11 * u + 12 * u);
    s.alpha(seen[0]!, () => {
      s.alpha(1 - gName, () => rowLabel(s, 'moved', xs[0]! - 7 * u, yr, '--ink-2', 3.2));
      s.alpha(gName, () => rowLabel(s, '∂s₀/∂x', xs[0]! - 7 * u, yr, 'red', 3.6));
    });
    G.forEach((g, j) => s.alpha(seen[j]!, () => cells(s, [xs[j]!], yr, [sgn(g)], gName > 0.5 ? 'red' : '--ink-2', { w: 9.5, h: 7, on: [Math.max(n[j]!, gName)] })));

    // The saliency map, where the bars were.
    s.alpha(map, () => {
      const mx = s.w / 2 + 23 * u;
      image(s, mx, iy, 17, G.map((g) => Math.abs(g) / 3), 'gold', { labels: G.map((g) => String(Math.abs(g))) });
      s.text('saliency map', mx, iy + 21 * u, { size: 3.2, font: 'mono', weight: 600, color: s.c('gold') });
      s.arrow(ix + 19 * u, iy, mx - 19 * u, iy, s.c('--ink-3'), 0.35, 2);
    });

    caption(s, 'brighten one pixel by 1: how far does s₀ move?', s.win('nudge', 'grad') * after(s, 'nudge', 0.2));
    caption(s, 'per unit of brightness: the gradient', s.win('grad', 'name'), 'red');
    caption(s, 'salient: standing out', after(s, 'name', 0.5), 'gold');
  },
};

// ---- why those numbers: a linear classifier's gradient is its row of weights

/** Pixel columns and the rows of the linear scene, for either stage shape. */
function layout(s: Scene) {
  const xs = columns(s, 4, 13).map((x) => x - 6 * s.u);
  return { xs, lx: xs[0]! - 9 * s.u, sx: xs[3]! + 21 * s.u, yx: s.h * 0.12, yw: [0.3, 0.41, 0.52].map((f) => s.h * f), yt: s.h * 0.66, yg: s.h * 0.8 };
}

const linear: SceneDef = {
  draw(s) {
    const L = layout(s);
    const o = { w: 10.5, h: 7.4, size: 3.4 };
    const row0 = s.win('row', 'grad');
    const term = after(s, 'row', 0.45) * (1 - s.ease('grad', 0.6));
    // Row 0 lights again as the gradient appears: they are the same numbers.
    const same = s.win('grad', 'bias');
    rowLabel(s, 'x', L.lx, L.yx, 'orange');
    cells(s, L.xs, L.yx, X.map(fmt), 'orange', { ...o, on: X.map((_, j) => (j === 1 ? Math.max(term, row0 * 0.5) : row0 * 0.5 * (1 - term))) });
    s.alpha(s.ease('open', 0.6, 0.6), () => {
      rowLabel(s, 'W', L.lx, L.yw[0]! - 7 * s.u, 'blue', 3.8);
      W.forEach((r, c) => {
        s.text(`class ${c}`, L.lx, L.yw[c]!, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
        cells(s, L.xs, L.yw[c]!, r.map(fmt), 'blue', { ...o, on: r.map((_, j) => (c === 0 ? Math.max(same, j === 1 ? Math.max(term, row0 * 0.6) : row0 * 0.6 * (1 - term)) : 0)) });
      });
    });
    s.alpha(after(s, 'open', 0.6), () => {
      s.text('s', L.sx, L.yx, { size: 4, font: 'mono', weight: 650, color: s.c('purple') });
      W.forEach((_, c) => cells(s, [L.sx], L.yw[c]!, [fmt(S[c]!)], 'purple', { ...o, on: [c === 0 ? row0 : 0] }));
      s.arrow(L.xs[3]! + 7 * s.u, L.yw[1]!, L.sx - 7 * s.u, L.yw[1]!, s.c('--ink-3'), 0.35, 2);
    });
    const line = (runs: [string, Ink][], a: number) => s.alpha(a, () => rich(s, runs, s.w / 2, L.yt, { size: 3.4, weight: 600 }));
    line([['s₀', 'purple'], [' = 3·1 + 1·(−3) + 2·0 + 1·2 = 2', '--ink-2']], after(s, 'row', 0.1) * (1 - after(s, 'row', 0.45, 0.4)));
    line([['x₁ + 1', 'orange'], ['  →  ', '--ink-3'], ['s₀', 'purple'], [' moves by −3', '--ink-2']], after(s, 'row', 0.5) * (1 - s.ease('grad', 0.4)));
    const g = after(s, 'grad', 0.1, 0.8);
    s.alpha(g, () => {
      rowLabel(s, '∂s₀/∂x', L.lx, L.yg, 'red', 3.6);
      cells(s, L.xs, L.yg, G.map(fmt), 'red', { ...o, on: [1, 1, 1, 1].map(() => after(s, 'grad', 0.3)) });
    });
    s.alpha(after(s, 'grad', 0.6) * (1 - s.ease('history', 0.4)), () => s.text('same for any x', L.sx, L.yg, { size: 3, color: s.c('--ink-3'), halo: true }));
    line([['s₀ + b₀', 'purple'], [': b₀ has no x in it, so it drops out', '--ink-2']], s.win('bias', 'history'));
    line([['linear: the size of each weight = importance', '--ink-2']], s.ease('history', 0.6));
    cite(s, 'Simonyan, Vedaldi & Zisserman, 2013', s.ease('history', 0.6));
  },
};

// ---- size, not sign: the absolute value, painted over the image

const map: SceneDef = {
  draw(s) {
    const L = layout(s);
    const o = { w: 10.5, h: 7.4, size: 3.4 };
    const sw = s.ease('other', 0.8, 0.5);
    const yg = s.h * 0.1;
    const ya = s.h * 0.25;
    const yb = s.h * 0.4;
    const c = sw > 0.5 ? 2 : 0;
    const g = W[c]!;
    const fade = sw < 0.5 ? 1 - 2 * sw : 2 * sw - 1;
    const sub = c ? '₂' : '₀';
    s.alpha(fade, () => {
      rowLabel(s, `∂s${sub}/∂x`, L.lx, yg, 'red', 3.6);
      cells(s, L.xs, yg, g.map(fmt), 'red', o);
    });
    // The sign as an arrow's direction, the size as its length; then what each pixel adds right now.
    const adds = s.win('adds', 'other');
    s.alpha(s.ease('sign', 0.6, 0.3) * (1 - adds) * fade, () => {
      g.forEach((v, j) => {
        if (!v) return;
        const len = Math.abs(v) * 2.4 * s.u;
        const up = v > 0;
        s.arrow(L.xs[j]!, ya + (up ? len / 2 : -len / 2), L.xs[j]!, ya + (up ? -len / 2 : len / 2), s.c(up ? 'green' : 'red'), 0.5, 1.8);
      });
      s.text('s moves', L.lx, ya, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
    });
    s.alpha(adds, () => {
      rowLabel(s, 'adds now', L.lx, ya, '--ink-2', 3);
      cells(s, L.xs, ya, X.map((v, j) => fmt(v * G[j]!)), '--ink-2', { ...o, on: [1, 0, 0, 0] });
    });
    const abs = g.map((v) => Math.abs(v));
    const top = abs.indexOf(Math.max(...abs));
    s.alpha(after(s, 'abs', 0.3) * fade, () => {
      rowLabel(s, `|∂s${sub}/∂x|`, L.lx, yb, 'gold', 3.6);
      cells(s, L.xs, yb, abs.map(fmt), 'gold', { ...o, on: abs.map((_, j) => (j === top ? s.win('show', 'adds') + (c ? after(s, 'other', 0.6) : 0) : 0)) });
    });
    // The image and the class's saliency map.
    const ym = s.h * 0.72;
    const xi = s.w / 2 - 20 * s.u;
    const xm = s.w / 2 + 20 * s.u;
    s.alpha(s.ease('abs', 0.6, 0.8), () => {
      image(s, xi, ym, 12, X.map((v) => v / 4), 'orange', { labels: X.map(String), ring: [adds, 0, 0, 0], ringK: '--ink-2' });
      s.text('image x', xi, ym + 15.5 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c('orange') });
      s.alpha(fade, () => {
        const ring = abs.map((_, j) => (j === top ? after(s, 'show', 0.2) * (c ? after(s, 'other', 0.6) : 1) : 0));
        image(s, xm, ym, 12, abs.map((v) => v / Math.max(...abs)), 'gold', { ring });
        s.text(`saliency, class ${c}`, xm, ym + 15.5 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c('gold') });
      });
    });
    caption(s, 'adds the most now, but moves s₀ only 1 per unit', after(s, 'adds', 0.45) * (1 - s.ease('other', 0.4)), '--ink-2', 0.94);
  },
};

// ---- through a deeper model: s = 3 max(0, 2 x0 - x1), walked back gate by gate

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
    s.show('f', s.ease('graph', 0.6));
    const at = band(s, 100, 13);
    const p = (k: string) => at(PT[k]!);
    // The second image, [1, 3], from 'depends' until 'paths' returns to the first.
    const dep = s.ease('depends', 0.8, 0.4) * (1 - s.ease('paths', 0.8));
    const swap = dep > 0.5 ? 2 * dep - 1 : 1 - 2 * dep;
    const va = (i: number, a: number) => ({ val: dep > 0.5 ? VB[i]! : VA[i]!, va: a * swap });
    const gr = (i: number, a: number) => ({ grad: dep > 0.5 ? GB[i]! : GA[i]!, ga: a * swap });
    const fv = (f: number) => after(s, 'fwd', f);
    const g1 = after(s, 'back', 0.05);
    const g3 = after(s, 'back', 0.55);
    const gq = after(s, 'route', 0.15);
    const gm = after(s, 'route', 0.6);
    const g0 = after(s, 'px0', 0.4);
    const g1x = after(s, 'px1', 0.25);
    const [x0, x1, m0, m1, add, mx, m3, out] = ['x0', 'x1', 'm0', 'm1', 'add', 'max', 'm3', 'out'].map(p) as [number, number][];
    wire(s, ...x0!, ...m0!, { r1: R, t: 0.4, ...va(0, fv(0.1)), ...gr(0, g0) });
    wire(s, ...x1!, ...m1!, { r1: R, t: 0.4, ...va(1, fv(0.1)), ...gr(1, g1x) });
    wire(s, ...m0!, ...add!, { r0: R, r1: R, t: 0.45, ...va(2, fv(0.25)), ...gr(2, gm) });
    wire(s, ...m1!, ...add!, { r0: R, r1: R, t: 0.45, ...va(3, fv(0.25)), ...gr(3, gm) });
    wire(s, ...add!, ...mx!, { r0: R, r1: R, ...va(4, fv(0.4)), ...gr(4, gq) });
    wire(s, ...mx!, ...m3!, { r0: R, r1: R, ...va(5, fv(0.6)), ...gr(5, g3) });
    wire(s, ...m3!, ...out!, { r0: R, ...va(6, fv(0.8)), ...gr(6, g1) });
    pixel(s, x0![0], x0![1], '0');
    pixel(s, x1![0], x1![1], '1');
    name(s, out![0], out![1], 's', 'purple', 'out');
    const lit = (from: string, until: string) => s.win(from, until, 0.4);
    node(s, ...m0!, '×2', Math.max(lit('graph', 'max'), lit('px0', 'px1')));
    node(s, ...m1!, '×−1', Math.max(lit('graph', 'max'), lit('px1', 'once')));
    node(s, ...add!, '+', Math.max(lit('graph', 'max'), after(s, 'route', 0.5) * (1 - s.ease('px0', 0.4))));
    node(s, ...mx!, 'max', Math.max(lit('max', 'fwd'), lit('route', 'px0') * (1 - after(s, 'route', 0.5)), lit('depends', 'paths')));
    node(s, ...m3!, '×3', Math.max(lit('max', 'fwd'), lit('back', 'route')));
    // The gradient travelling back, one hop at a time.
    pulse(s, ...out!, ...m3!, runAfter(s, 'back', 0, 0.8), 'red');
    pulse(s, ...m3!, ...mx!, runAfter(s, 'back', 0.35, 0.8), 'red');
    pulse(s, ...mx!, ...add!, runAfter(s, 'route', 0, 0.8), 'red');
    pulse(s, ...add!, ...m0!, runAfter(s, 'route', 0.4, 0.7), 'red');
    pulse(s, ...add!, ...m1!, runAfter(s, 'route', 0.4, 0.7), 'red');
    pulse(s, ...m0!, ...x0!, runAfter(s, 'px0', 0.2, 0.7), 'red');
    pulse(s, ...m1!, ...x1!, runAfter(s, 'px1', 0.05, 0.7), 'red');
    s.alpha(s.win('graph', 'fwd') * after(s, 'graph', 0.6), () => {
      const [qx, qy] = add!;
      s.text('q', lerp(qx, mx![0], 0.5), qy + 5.5 * s.u, { size: 3.4, italic: true, color: s.c('--ink-3') });
      s.text('r', lerp(mx![0], m3![0], 0.5), qy + 5.5 * s.u, { size: 3.4, italic: true, color: s.c('--ink-3') });
    });
    const ly = s.h * 0.84;
    const line = (runs: [string, Ink][], a: number, y = ly) => s.alpha(a, () => rich(s, runs, s.w / 2, y, { size: 3.4, weight: 600 }));
    line([['no row of weights: nudge, and watch ', '--ink-2'], ['s', 'purple']], after(s, 'deep', 0.15) * (1 - after(s, 'deep', 0.55, 0.4)));
    line([['near one image, the gradient acts as the weights', '--ink-2']], after(s, 'deep', 0.6) * (1 - s.ease('graph', 0.4)));
    line([['saliency: ', '--ink-2'], ['|6| = 6', 'gold'], [',  ', '--ink-2'], ['|−3| = 3', 'gold']], after(s, 'px1', 0.6) * (1 - s.ease('once', 0.4)));
    line([['one backward pass: every pixel at once', '--ink-2']], s.win('once', 'depends'));
    line([['x = [1, 3]: q = −1, max sends back ', '--ink-2'], ['0', 'red']], s.win('depends', 'paths') * after(s, 'depends', 0.35));
    line([['saliency: ', '--ink-2'], ['0, 0', 'gold']], s.win('depends', 'paths') * after(s, 'depends', 0.75), ly + 6 * s.u);
    line([['two paths to a pixel: their gradients add', '--ink-2']], s.ease('paths', 0.6));
    cite(s, 'Simonyan, Vedaldi & Zisserman, 2013', Math.max(after(s, 'deep', 0.6) * (1 - s.ease('graph', 0.4)), s.win('once', 'depends')));
  },
};

export const scenes: Record<string, SceneDef> = { ask, linear, map, deeper };

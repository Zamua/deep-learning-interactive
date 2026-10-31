import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { clamp01 } from '../../../lecture/scene';
import { cite } from '../../draw';

// ---- the image: 13 by 13 pixels holding a ring, centered on pixel (6, 6)

const NI = 13;
const C = 6;
/** Brightness of each pixel, 0 to 1: a ring of radius about 4.6 pixels. */
const RING: number[][] = Array.from({ length: NI }, (_, i) => Array.from({ length: NI }, (_, j) => clamp01(1 - Math.abs(Math.hypot(i - C, j - C) - 4.6) / 0.8)));

function caption(s: Scene, text: string, a: number, k: Ink = '--ink-2', y = 0.93) {
  s.alpha(a, () => s.text(text, s.w / 2, s.h * y, { size: 3.5, font: 'mono', weight: 600, color: s.c(k), halo: true }));
}

/** A pixel of brightness `b`, outlined in blue when `on`. */
function pixel(s: Scene, x: number, y: number, w: number, b: number, on = 0): void {
  s.rrect(x - w / 2, y - w / 2, w, w, 0.8, { fill: s.tint('orange', 0.08 + 0.72 * b), stroke: on > 0.01 ? s.tint('blue', 0.35 + 0.65 * on) : s.tint('orange', 0.3 + 0.4 * b), lw: 0.22 + 0.3 * on });
}

function unit(s: Scene, x: number, y: number, r: number, k: Ink, on: number): void {
  s.circle(x, y, r, { fill: s.tint(k, 0.14 + 0.5 * on), stroke: s.tint(k, 0.5 + 0.5 * on), lw: 0.3 });
}

/** A bracket under columns x0..x1 (centers, pixel width w) with a label. */
function under(s: Scene, x0: number, x1: number, w: number, y: number, label: string, k: Ink): void {
  const a = x0 - w / 2;
  const b = x1 + w / 2;
  s.line(a, y - 1.2 * s.u, a, y, s.c(k), 0.3);
  s.line(a, y, b, y, s.c(k), 0.3);
  s.line(b, y - 1.2 * s.u, b, y, s.c(k), 0.3);
  if (label) s.text(label, (a + b) / 2, y + 3.4 * s.u, { size: 3.3, font: 'mono', weight: 650, color: s.c(k), halo: true });
}

/** A gap marker between two centers, above a row. */
function gap(s: Scene, x0: number, x1: number, y: number, label: string): void {
  s.line(x0, y, x1, y, s.c('slate'), 0.35);
  s.line(x0, y - 1 * s.u, x0, y + 1 * s.u, s.c('slate'), 0.35);
  s.line(x1, y - 1 * s.u, x1, y + 1 * s.u, s.c('slate'), 0.35);
  s.text(label, (x0 + x1) / 2, y - 3 * s.u, { size: 3.1, font: 'mono', weight: 600, color: s.c('slate'), halo: true });
}

const rowName = (s: Scene, t: string, x: number, y: number, k: Ink = '--ink-3', size = 3) => s.text(t, x, y, { size, font: 'mono', weight: 600, align: 'right', color: s.c(k) });

// ---- scene 1: one unit sees a 3 by 3 patch; stacked layers see 5 by 5, then 7 by 7

const WIN: { k: Ink; half: number }[] = [
  { k: 'blue', half: 1 },
  { k: 'teal', half: 2 },
  { k: 'purple', half: 3 },
];

const patch: SceneDef = {
  draw(s) {
    const p = Math.min(5.4 * s.u, (s.h * 0.7) / NI, (s.w - 16 * s.u) / NI);
    const cx = s.w / 2;
    const cy = s.h * 0.45;
    const X = (j: number) => cx + (j - C) * p;
    const Y = (i: number) => cy + (i - C) * p;
    const win = [s.ease('problem', 0.6, 2), s.ease('two', 0.6, 0.4), s.ease('three', 0.6)];
    for (let i = 0; i < NI; i++) for (let j = 0; j < NI; j++) pixel(s, X(j), Y(i), p * 0.88, RING[i]![j]!);
    // Each layer's field as a square; the newest is tinted.
    const fill = [s.win('field', 'two'), s.win('two', 'three'), s.ease('three', 0.6)];
    WIN.forEach(({ k, half }, n) => {
      s.alpha(win[n]!, () => {
        const e = (half + 0.5) * p + 0.4 * s.u;
        s.rrect(cx - e, cy - e, 2 * e, 2 * e, 1, { fill: s.tint(k, 0.16 * fill[n]!), stroke: s.c(k), lw: 0.55 });
      });
    });
    // The unit: one output number, sitting over the middle of its patch.
    s.alpha(s.win('unit', 'again'), () => {
      s.circle(cx, cy, 1.5 * s.u, { fill: s.c('blue'), stroke: s.c('--card'), lw: 0.35 });
      s.text('unit', cx, cy - 1.5 * p - 3 * s.u, { size: 3.3, font: 'mono', weight: 650, color: s.c('blue'), halo: true });
    });
    cite(s, 'Hubel & Wiesel, 1959', s.win('history', 'again'));
    const y = 0.92;
    caption(s, 'a 3 × 3 filter, a 13 × 13 image', s.win('problem', 'unit'), '--ink-2', y);
    caption(s, '9 pixels in, 1 unit out', s.win('unit', 'field'), 'blue', y);
    caption(s, 'its receptive field: 3 × 3, all blank', s.win('field', 'again'), 'blue', y);
    caption(s, 'convolve the output again', s.win('again', 'two'), '--ink-2', y);
    caption(s, 'layer 2 sees 5 × 5: still blank', s.win('two', 'three'), 'teal', y);
    caption(s, 'layer 3 sees 7 × 7: corners on the ring', s.ease('three', 0.6), 'purple', y);
  },
};

// ---- scene 2: one row from the side, a cone from the top unit down to the pixels

const N = 11;
/** The middle row of the ring, columns 1 to 11. */
const ROW = RING[C]!.slice(1, 12);

const count: SceneDef = {
  draw(s) {
    const pitch = Math.min(7.6, (s.w / s.u - 30) / N) * s.u;
    const cx = s.w / 2 + 6 * s.u;
    const xs = Array.from({ length: N }, (_, i) => cx + (i - (N - 1) / 2) * pitch);
    const ys = [0.76, 0.635, 0.51, 0.385, 0.26, 0.135].map((f) => s.h * f);
    const lx = xs[0]! - 4.5 * s.u;
    const r = Math.min(2.1 * s.u, pitch * 0.3);
    // The 3 by 3 cone, until the 5 by 5 pair replaces it.
    const mix = s.ease('mix', 0.8);
    const show = [1, 1 - mix, 1 - mix, s.ease('r', 0.6) * (1 - mix), s.ease('ring', 0.6) * (1 - mix), s.ease('ring', 0.6, 0.5) * (1 - mix)];
    // How much each layer is the cone's top, crossfading as layers arrive.
    const t3 = s.ease('r', 0.6, 0.8);
    const t5 = s.ease('ring', 0.6, 1.4);
    const top = [0, 0, 1 - t3, t3 * (1 - t5), 0, t5];
    const lit = (layer: number, q: number) => top.reduce((acc, w, t) => acc + (t >= layer && Math.abs(q - 5) <= t - layer ? w : 0), 0);
    for (let L = 5; L >= 1; L--) {
      s.alpha(show[L]!, () => {
        for (let q = 0; q < N; q++) {
          const on = lit(L, q);
          if (on > 0.01) for (const c of [q - 1, q, q + 1]) if (c >= 0 && c < N) s.alpha(on, () => s.line(xs[q]!, ys[L]! + r, xs[c]!, ys[L - 1]! - (L === 1 ? pitch * 0.45 : r), s.tint('blue', 0.8), 0.3));
        }
        for (let q = 0; q < N; q++) unit(s, xs[q]!, ys[L]!, r, 'blue', lit(L, q));
        rowName(s, `layer ${L}`, lx, ys[L]!);
      });
    }
    // Two layers of 5 by 5: each unit takes five neighbors, so the top one reaches 9 pixels.
    s.alpha(mix, () => {
      for (const q of [3, 4, 5, 6, 7]) {
        s.line(xs[5]!, ys[2]! + r, xs[q]!, ys[1]! - r, s.tint('blue', 0.8), 0.3);
        for (let c = q - 2; c <= q + 2; c++) s.line(xs[q]!, ys[1]! + r, xs[c]!, ys[0]! - pitch * 0.45, s.tint('blue', 0.55), 0.25);
      }
      for (const L of [1, 2]) {
        for (let q = 0; q < N; q++) unit(s, xs[q]!, ys[L]!, r, 'blue', L === 2 ? (q === 5 ? 1 : 0) : Math.abs(q - 5) <= 2 ? 1 : 0);
        rowName(s, `layer ${L}`, lx, ys[L]!);
      }
    });
    for (let q = 0; q < N; q++) pixel(s, xs[q]!, ys[0]!, pitch * 0.84, ROW[q]!, lit(0, q) * (1 - mix) + (Math.abs(q - 5) <= 4 ? mix : 0));
    rowName(s, 'x', lx, ys[0]!, 'orange', 3.6);
    // The overlap: three patches, each one pixel along from the last, and the two new pixels.
    const ov = s.win('overlap', 'F');
    const by = ys[0]! + pitch * 0.45 + 2.2 * s.u;
    s.alpha(ov, () => {
      ([['teal', -1], ['blue', 0], ['purple', 1]] as [Ink, number][]).forEach(([k, d], n) => under(s, xs[4 + d]!, xs[6 + d]!, pitch * 0.84, by + n * 2.4 * s.u, '', k));
      const g = { size: 3.3, font: 'mono' as const, weight: 700, color: s.c('gold'), halo: true };
      const gy = ys[0]! - pitch * 0.42 - 2.6 * s.u;
      s.text('+1', xs[3]!, gy, g);
      s.text('+1', xs[7]!, gy, g);
    });
    const w = 1 + 2 * (top[2]! > 0.5 ? 2 : top[3]! > 0.5 ? 3 : 5);
    const half = (w - 1) / 2;
    s.alpha((1 - ov) * (1 - mix), () => under(s, xs[5 - half]!, xs[5 + half]!, pitch * 0.84, by, `${w} wide`, 'blue'));
    s.alpha(mix, () => under(s, xs[1]!, xs[9]!, pitch * 0.84, by, '9 wide', 'blue'));
    caption(s, 'why 5, not 3 + 3?', s.win('side', 'overlap'));
    caption(s, 'each extra unit adds 1 pixel', s.win('overlap', 'F'), 'gold');
    caption(s, 'each layer adds F − 1', s.win('F', 'r'));
    caption(s, 'r = 1 + 2 + 2 + 2 = 7', s.win('r', 'L'), 'blue');
    caption(s, 'L layers of 3 × 3: r = 1 + 2L', s.win('L', 'ring'), 'blue');
    caption(s, '1 + 2 × 5 = 11: the whole ring', s.win('ring', 'mix'), 'blue');
    caption(s, 'two 5 × 5 layers: 1 + 4 + 4 = 9', s.ease('mix', 0.6));
  },
};

// ---- scene 3: strides of 2 spread the units, so the layers above them reach further

const NP = 15;
/** Each layer's unit centers, in pixel columns: stride 2, stride 2, then stride 1. */
const L1 = [1, 3, 5, 7, 9, 11, 13];
const L2 = [3, 7, 11];

const stride: SceneDef = {
  draw(s) {
    const pitch = Math.min(6.2, (s.w / s.u - 30) / NP) * s.u;
    const cx = s.w / 2 + 6 * s.u;
    const X = (c: number) => cx + (c - (NP - 1) / 2) * pitch;
    const ys = [0.78, 0.6, 0.42, 0.24].map((f) => s.h * f);
    const lx = X(0) - 4 * s.u;
    const r = Math.min(2 * s.u, pitch * 0.32);
    const pw = pitch * 0.84;
    const next = s.ease('next', 0.6, 0.3);
    const twice = s.ease('twice', 0.6, 0.4);
    const third = s.ease('twice', 0.6, 2.2);
    // Which layer-1 units and pixels the top unit reaches: one unit, then three, then all.
    const l1On = (c: number) => (c === 7 ? 1 - third : 0) * (1 - next) + (Math.abs(c - 7) <= 2 ? next * (1 - third) : 0) + third;
    const xOn = (c: number) => (Math.abs(c - 7) <= 1 ? (1 - next) * (1 - third) : 0) + (Math.abs(c - 7) <= 3 ? next * (1 - third) : 0) + third;
    const link = (x0: number, y0: number, x1: number, y1: number, a: number) => s.alpha(a, () => s.line(x0, y0 + r, x1, y1, s.tint('blue', 0.8), 0.3));
    for (const c of L1) {
      const on = Math.max(l1On(c), c === 7 ? s.ease('jump', 0.6, 1.5) : 0);
      for (const d of [-1, 0, 1]) link(X(c), ys[1]!, X(c + d), ys[0]! - pw / 2, on);
    }
    for (let c = 0; c < NP; c++) pixel(s, X(c), ys[0]!, pw, 0, xOn(c) * s.ease('jump', 0.6, 1.5));
    rowName(s, 'x', lx, ys[0]!, 'orange', 3.6);
    s.alpha(s.ease('jump', 0.6), () => {
      for (const c of L1) unit(s, X(c), ys[1]!, r, 'blue', c === 7 ? Math.max(l1On(c), s.ease('jump', 0.6, 1.5)) : l1On(c));
      rowName(s, 'layer 1', lx, ys[1]! - 1.6 * s.u);
      rowName(s, 'S = 2', lx, ys[1]! + 2 * s.u, 'slate', 2.8);
    });
    // Layer 2: the middle unit, then its neighbors once it has a stride of 2 too.
    s.alpha(next, () => {
      for (const c of L2) {
        const a = c === 7 ? 1 : twice;
        s.alpha(a, () => {
          const on = c === 7 ? 1 : third;
          for (const d of [-2, 0, 2]) link(X(c), ys[2]!, X(c + d), ys[1]! - r, c === 7 ? 1 : third);
          unit(s, X(c), ys[2]!, r, 'blue', on);
        });
      }
      rowName(s, 'layer 2', lx, ys[2]! - 1.6 * s.u);
      s.alpha(twice, () => rowName(s, 'S = 2', lx, ys[2]! + 2 * s.u, 'slate', 2.8));
    });
    s.alpha(third, () => {
      for (const c of L2) link(X(7), ys[3]!, X(c), ys[2]! - r, 1);
      unit(s, X(7), ys[3]!, r, 'blue', 1);
      rowName(s, 'layer 3', lx, ys[3]! - 1.6 * s.u);
      rowName(s, 'S = 1', lx, ys[3]! + 2 * s.u, 'slate', 2.8);
    });
    s.alpha(s.win('jump', 'next'), () => gap(s, X(7), X(9), ys[1]! - 5 * s.u, '2 apart'));
    s.alpha(twice * (1 - third), () => gap(s, X(7), X(11), ys[2]! - 5 * s.u, '4 apart'));
    const by = ys[0]! + pw / 2 + 2.2 * s.u;
    s.alpha(s.ease('own', 0.6) * (1 - next), () => under(s, X(6), X(8), pw, by, '3 wide', 'blue'));
    s.alpha(next * (1 - third), () => under(s, X(4), X(10), pw, by, '7 wide', 'blue'));
    s.alpha(third, () => under(s, X(0), X(14), pw, by, '15 wide', 'blue'));
    caption(s, 'stride 2: units 2 pixels apart', s.win('jump', 'own'), 'slate');
    caption(s, 'each still sees 3 pixels', s.win('own', 'next'), 'blue');
    caption(s, '3 + (3 − 1) × 2 = 7', s.win('next', 'rule'), 'blue');
    caption(s, 'add (F − 1) × jump, then jump × S', s.win('rule', 'twice'));
    caption(s, '7 + (3 − 1) × 4 = 15', s.ease('twice', 0.6, 2.2), 'blue');
  },
};

// ---- scene 4: two 3 by 3 layers against one 5 by 5 filter, then three against one 7 by 7

/** A stack of `n` 3 by 3 layers over 1 + 2n pixels (left) and one filter as wide (right). */
function versus(s: Scene, n: number, a: number): void {
  if (a <= 0.003) return;
  const w = 1 + 2 * n;
  const pitch = Math.min(n === 2 ? (s.tall ? 6.6 : 7.6) : s.tall ? 5.6 : 6.6, (s.w / s.u - 24) / (2 * w)) * s.u;
  const at = (fx: number) => Array.from({ length: w }, (_, i) => s.w * fx + (i - (w - 1) / 2) * pitch);
  const Lx = at(s.tall ? 0.27 : 0.3);
  const Rx = at(s.tall ? 0.73 : 0.7);
  const yx = s.h * 0.68;
  const yt = s.h * 0.27;
  const ys = Array.from({ length: n + 1 }, (_, l) => yx + ((yt - yx) * l) / n);
  const r = Math.min(2 * s.u, pitch * 0.32);
  const pw = pitch * 0.84;
  const mid = (w - 1) / 2;
  s.alpha(a, () => {
    const title = (t: string, x: number) => s.text(t, x, s.h * 0.13, { size: 3.6, font: 'mono', weight: 650, color: s.c('--ink-2') });
    title(n === 2 ? 'two 3 × 3' : 'three 3 × 3', Lx[mid]!);
    title(n === 2 ? 'one 5 × 5' : 'one 7 × 7', Rx[mid]!);
    for (let l = n; l >= 1; l--) {
      const reach = n - l;
      for (let q = mid - reach; q <= mid + reach; q++) {
        for (const d of [-1, 0, 1]) s.line(Lx[q]!, ys[l]! + r, Lx[q + d]!, ys[l - 1]! - (l === 1 ? pw / 2 : r), s.tint('blue', 0.7), 0.3);
      }
      for (let q = 0; q < w; q++) {
        const on = Math.abs(q - mid) <= reach ? 1 : 0;
        if (l === n && q !== mid) continue;
        unit(s, Lx[q]!, ys[l]!, r, 'blue', on);
      }
    }
    for (let q = 0; q < w; q++) s.line(Rx[mid]!, yt + r, Rx[q]!, yx - pw / 2, s.tint('purple', 0.8), 0.3);
    unit(s, Rx[mid]!, yt, r, 'purple', 1);
    for (let q = 0; q < w; q++) {
      pixel(s, Lx[q]!, yx, pw, 0, 1);
      pixel(s, Rx[q]!, yx, pw, 0);
    }
    const by = yx + pw / 2 + 2.2 * s.u;
    under(s, Lx[0]!, Lx[w - 1]!, pw, by, `${w} wide`, 'blue');
    under(s, Rx[0]!, Rx[w - 1]!, pw, by, `${w} wide`, 'purple');
  });
}

const why: SceneDef = {
  draw(s) {
    const three = s.ease('three', 0.7);
    versus(s, 2, 1 - three);
    versus(s, 3, three);
    const y = s.h * 0.84;
    const L = s.w * (s.tall ? 0.27 : 0.3);
    const R = s.w * (s.tall ? 0.73 : 0.7);
    const t = (str: string, x: number, k: Ink, a: number) => s.alpha(a, () => s.text(str, x, y, { size: 3.4, font: 'mono', weight: 650, color: s.c(k), halo: true }));
    t('9 + 9 = 18 weights', L, 'green', s.ease('weights', 0.6, 1) * (1 - three));
    t('25 weights', R, 'red', s.ease('weights', 0.6, 2.5) * (1 - three));
    t('3 × 9 = 27 weights', L, 'green', s.ease('three', 0.6, 1));
    t('7 × 7 = 49 weights', R, 'red', s.ease('seven', 0.6, 0.5));
    caption(s, 'same 5 × 5 view', s.win('same', 'weights'));
    caption(s, 'one weight per pixel covered', s.win('weights', 'three'));
    caption(s, 'same view, fewer weights', s.ease('vgg', 0.6));
    cite(s, 'Simonyan & Zisserman, 2014', s.ease('vgg', 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { patch, count, stride, why };

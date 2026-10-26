import { type Scene, type SceneDef, smooth } from '../../../lecture/scene';
import { columns, verdict } from '../../draw';
import type { Ink } from '../draw';

const ARROW = [
  '.......',
  '....#..',
  '.....#.',
  '#######',
  '.....#.',
  '....#..',
  '.......',
].map((r) => [...r].map((c) => c === '#'));

const mirror = (g: boolean[][]) => g.map((r) => [...r].reverse());
const shift = (g: boolean[][], dx: number, dy: number) => g.map((r, i) => r.map((_, j) => g[i - dy]?.[j - dx] ?? false));
const crop = (g: boolean[][]) => g.slice(1, 6).map((r) => r.slice(1, 7));

/** A pixel image: `g` drawn as a grid of squares filling a `size` box centered on (cx, cy). */
function pixels(s: Scene, cx: number, cy: number, size: number, g: boolean[][], k: Ink, light = 1): void {
  const n = Math.max(g.length, g[0]!.length);
  const p = size / n;
  const x0 = cx - (g[0]!.length * p) / 2;
  const y0 = cy - (g.length * p) / 2;
  s.rrect(cx - size / 2 - 0.8 * s.u, cy - size / 2 - 0.8 * s.u, size + 1.6 * s.u, size + 1.6 * s.u, 1, { fill: s.tint('--ink', 0.04), stroke: s.tint('--ink-3', 0.6), lw: 0.3 });
  g.forEach((r, i) => r.forEach((on, j) => {
    if (on) s.rrect(x0 + j * p + 0.15 * s.u, y0 + i * p + 0.15 * s.u, p - 0.3 * s.u, p - 0.3 * s.u, 0.3, { fill: s.tint(k, 0.45 * light + 0.15) });
  }));
}

const THUMBS: { name: string; g: boolean[][]; light: number; ok: boolean; label: string }[] = [
  { name: 'shift', g: shift(ARROW, -1, 1), light: 1, ok: true, label: 'right' },
  { name: 'darker', g: ARROW, light: 0.45, ok: true, label: 'right' },
  { name: 'crop', g: crop(ARROW), light: 1, ok: true, label: 'right' },
  { name: 'flip', g: mirror(ARROW), light: 1, ok: false, label: 'left' },
];

const variety: SceneDef = {
  draw(s) {
    const big = (s.tall ? 28 : 30) * s.u;
    const cy = s.h * 0.24;
    pixels(s, s.w / 2, cy, big, ARROW, 'orange');
    s.text('label: right', s.w / 2, cy + big / 2 + 5 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c('--ink-2') });
    const xs = columns(s, 4, s.tall ? 22 : 26);
    const ty = s.h * 0.62;
    const ts = (s.tall ? 14 : 15) * s.u;
    THUMBS.forEach((t, i) => {
      const a = i < 3 ? s.ease('change', 0.5, 1.2 + i * 1.6) : s.ease('flip', 0.6, 1.4);
      s.alpha(a, () => {
        pixels(s, xs[i]!, ty, ts, t.g, 'orange', t.light);
        s.text(t.name, xs[i]!, ty + ts / 2 + 4 * s.u, { size: 3.1, font: 'mono', color: s.c('--ink-2') });
        const vx = xs[i]! - 5.5 * s.u;
        s.alpha(i < 3 ? 1 : s.ease('flip', 0.5, 3.4), () => verdict(s, t.ok, t.label, vx, ty + ts / 2 + 10 * s.u, 3.1));
      });
    });
    s.alpha(s.ease('which', 0.6, 0.6), () => {
      s.text('6 upside down: a 9', s.w / 2, s.h * 0.87, { size: 3.3, font: 'mono', color: s.c('red') });
      s.text('red light, colors shifted: green', s.w / 2, s.h * 0.94, { size: 3.3, font: 'mono', color: s.c('red') });
    });
  },
};

/** Eased 0 -> 1 starting a fraction `f` of the way through beat `id`, so it tracks the voice at any pace. */
const after = (s: Scene, id: string, f: number, dur = 0.5): number => smooth((s.t - s.at(id) - f * (s.end(id) - s.at(id))) / dur);

/** Index into `n` items, stepping through them as `f` runs from 0 to 1. */
const step = (f: number, n: number): number => Math.min(n - 1, Math.max(0, Math.floor(f * n)));
const span01 = (v: number): number => Math.min(1, Math.max(0, v));

/** A dot per crop start position, `cols` by `rows` around (gx, cy), `gp` px apart. */
function starts(s: Scene, gx: number, cy: number, cols: number, rows: number, gp: number, lit: (i: number, j: number) => boolean, r = 1.5): void {
  for (let a = 0; a < rows; a++) for (let b = 0; b < cols; b++) {
    s.circle(gx + (b - (cols - 1) / 2) * gp, cy + (a - (rows - 1) / 2) * gp, r * s.u, { fill: lit(a, b) ? s.c('blue') : s.tint('blue', 0.15), stroke: s.tint('blue', 0.7), lw: 0.25 });
  }
}

/** The start index labels: 0.. across the top of the dot grid, and 0.. down its left. */
function edgeLabels(s: Scene, gx: number, cy: number, cols: number, rows: number, gp: number, a: { top: number; left: number }, hot: { col: number; row: number }, size = 2.8): void {
  const x0 = gx - ((cols - 1) / 2) * gp;
  const y0 = cy - ((rows - 1) / 2) * gp;
  s.alpha(a.top, () => {
    for (let b = 0; b < cols; b++) s.text(String(b), x0 + b * gp, y0 - gp * 0.6 - 2 * s.u, { size, font: 'mono', weight: b === hot.col ? 700 : 500, color: s.c(b === hot.col ? 'blue' : '--ink-3') });
    s.text('left edge', gx, y0 - gp * 0.6 - 6.5 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-2') });
  });
  s.alpha(a.left, () => {
    for (let i = 0; i < rows; i++) s.text(String(i), x0 - gp * 0.6 - 2 * s.u, y0 + i * gp, { size, font: 'mono', weight: i === hot.row ? 700 : 500, color: s.c(i === hot.row ? 'blue' : '--ink-3') });
  });
}

const crops: SceneDef = {
  draw(s) {
    const size = (s.tall ? 34 : 36) * s.u;
    const cx = s.w * (s.tall ? 0.3 : 0.32);
    const cy = s.h * 0.32;
    const px = size / 32;
    // The crop's start: (0, 0), then along row 0, then through every row.
    const inDown = s.since('down') >= 0;
    const k = inDown ? 5 + step(span01((s.prog('down') - 0.05) / 0.45), 20) : s.since('across') >= 0 ? step(span01((s.prog('across') - 0.12) / 0.4), 5) : 0;
    const [i, j] = [Math.floor(k / 5), k % 5];
    const flipOn = s.ease('flips', 0.6);
    s.rrect(cx - size / 2, cy - size / 2, size, size, 0.8, { fill: s.tint('orange', 0.12), stroke: s.tint('orange', 0.7), lw: 0.3 });
    pixels(s, cx, cy, size * 0.6, flipOn > 0.5 && Math.floor(s.since('flips') / 0.8) % 2 === 1 ? mirror(ARROW) : ARROW, 'orange');
    const w = 28 * px;
    s.rrect(cx - size / 2 + j * px, cy - size / 2 + i * px, w, w, 0.6, { stroke: s.c('blue'), lw: 0.5 });
    s.text('32 × 32 image, 28 × 28 crop', cx, cy + size / 2 + 4.5 * s.u, { size: 3, font: 'mono', color: s.c('--ink-2') });
    const gx = s.w * (s.tall ? 0.76 : 0.72);
    const gp = 5.6 * s.u;
    starts(s, gx, cy, 5, 5, gp, (a, b) => a * 5 + b <= k);
    edgeLabels(s, gx, cy, 5, 5, gp, { top: s.ease('across', 0.6), left: s.ease('down', 0.6) }, { col: s.since('across') >= 0 ? j : -1, row: inDown ? i : -1 });
    s.text('start positions', gx, cy + 2.5 * gp + 4.5 * s.u, { size: 3, font: 'mono', color: s.c('--ink-2') });
    const ly = s.h * 0.64;
    const done = 1 - s.ease('train', 0.6);
    s.alpha(done * after(s, 'across', 0.62), () => s.text('32 − 28 + 1 = 5 places across', s.w / 2, ly, { size: 3.6, font: 'mono', weight: 600, color: s.c('--ink-2') }));
    s.alpha(done * after(s, 'down', 0.55), () => s.text('5 × 5 = 25 crops', s.w / 2, ly + 6.5 * s.u, { size: 3.8, font: 'mono', weight: 650, color: s.c('blue') }));
    s.alpha(done * flipOn, () => s.text('× 2 with flips = 50 versions', s.w / 2, ly + 13 * s.u, { size: 3.6, font: 'mono', weight: 600, color: s.c('--ink-2') }));
    s.alpha(s.win('train', 'gap'), () => {
      s.text('training: fresh random crop and flip', s.w / 2, s.h * 0.82, { size: 3.2, font: 'mono', color: s.c('green') });
      s.text('validation, test: untouched', s.w / 2, s.h * 0.89, { size: 3.2, font: 'mono', color: s.c('--ink-2') });
    });
    const g = s.ease('gap', 0.8, 0.6);
    s.alpha(s.ease('gap', 0.6), () => {
      const groups: [string, number, number][] = [['without', 0.1, 1.3], ['with', 0.3, 0.9]];
      const base = s.h * 0.95;
      groups.forEach(([name, tr, va], n) => {
        const x = s.w / 2 + (n === 0 ? -1 : 1) * 16 * s.u;
        const hh = (v: number) => v * 13 * s.u * g;
        s.rrect(x - 6 * s.u, base - hh(tr), 5 * s.u, Math.max(0.4 * s.u, hh(tr)), 0.4, { fill: s.tint('blue', 0.6) });
        s.rrect(x + 1 * s.u, base - hh(va), 5 * s.u, Math.max(0.4 * s.u, hh(va)), 0.4, { fill: s.tint('red', 0.6) });
        s.text(name, x, base - 21 * s.u, { size: 3, font: 'mono', color: s.c('--ink-2') });
      });
      s.text('train', s.w / 2, base - 4 * s.u, { size: 2.8, font: 'mono', color: s.c('blue') });
      s.text('val', s.w / 2, base - 9 * s.u, { size: 2.8, font: 'mono', color: s.c('red') });
    });
  },
};

// The worked problem: a 36 × 32 image (width by height), a 28 × 28 crop, flips.
const TW = 36;
const TH = 32;
const TC = 28;
const NA = TW - TC + 1;
const ND = TH - TC + 1;

const tryIt: SceneDef = {
  draw(s) {
    const u = s.u;
    const q = { size: 3.2, font: 'mono', color: s.c('--ink') } as const;
    s.text('36 × 32 image (width × height), 28 × 28 crop', s.w / 2, s.h * 0.07, q);
    s.text('flipped half the time: how many versions?', s.w / 2, s.h * 0.07 + 5.5 * u, q);
    const px = (s.tall ? 0.85 : 0.95) * u;
    const cx = s.w * (s.tall ? 0.28 : 0.32);
    const cy = s.h * 0.4;
    const W = TW * px;
    const H = TH * px;
    // The crop's start: along row 0, then down column 0, then every position.
    const pa = span01((s.prog('across') - 0.1) / 0.5);
    const pd = span01((s.prog('down') - 0.1) / 0.5);
    const pt = span01((s.prog('total') - 0.05) / 0.6);
    const at: [number, number] = s.since('total') >= 0 ? (() => { const k = step(pt, NA * ND); return [Math.floor(k / NA), k % NA] as [number, number]; })() : s.since('down') >= 0 ? [step(pd, ND), 0] : [0, s.since('across') >= 0 ? step(pa, NA) : 0];
    const lit = (a: number, b: number): boolean => {
      if (s.since('total') >= 0) return a * NA + b <= at[0] * NA + at[1] || (a === 0) || (b === 0);
      if (s.since('down') >= 0) return a === 0 || (b === 0 && a <= at[0]);
      if (s.since('across') >= 0) return a === 0 && b <= at[1];
      return false;
    };
    const flipOn = s.ease('flip', 0.6);
    s.rrect(cx - W / 2, cy - H / 2, W, H, 0.8, { fill: s.tint('orange', 0.12), stroke: s.tint('orange', 0.7), lw: 0.3 });
    pixels(s, cx, cy, H * 0.55, flipOn > 0.5 && Math.floor(s.since('flip') / 0.8) % 2 === 1 ? mirror(ARROW) : ARROW, 'orange');
    s.alpha(s.ease('p1', 0.6, 0.4), () => s.rrect(cx - W / 2 + at[1] * px, cy - H / 2 + at[0] * px, TC * px, TC * px, 0.6, { stroke: s.c('blue'), lw: 0.5 }));
    s.text('36', cx, cy - H / 2 - 3.5 * u, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
    s.text('32', cx - W / 2 - 3.5 * u, cy, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
    const gx = s.w * (s.tall ? 0.74 : 0.7);
    const gp = (s.tall ? 3.4 : 4) * u;
    starts(s, gx, cy, NA, ND, gp, lit, 1.1);
    edgeLabels(s, gx, cy, NA, ND, gp, { top: s.ease('across', 0.6), left: s.ease('down', 0.6) }, { col: s.since('down') >= 0 ? -1 : s.since('across') >= 0 ? at[1] : -1, row: s.since('total') >= 0 || s.since('down') < 0 ? -1 : at[0] }, 2.5);
    const ly = s.h * 0.66;
    const line = { size: 3.6, font: 'mono', weight: 600 } as const;
    s.alpha(after(s, 'across', 0.55), () => s.text('across: 36 − 28 + 1 = 9', s.w / 2, ly, { ...line, color: s.c('--ink-2') }));
    s.alpha(after(s, 'down', 0.55), () => s.text('down: 32 − 28 + 1 = 5', s.w / 2, ly + 6.5 * u, { ...line, color: s.c('--ink-2') }));
    s.alpha(after(s, 'total', 0.4), () => s.text('9 × 5 = 45 crops', s.w / 2, ly + 13 * u, { ...line, color: s.c('blue') }));
    s.alpha(after(s, 'flip', 0.45), () => s.text('45 × 2 = 90 versions', s.w / 2, ly + 19.5 * u, { ...line, size: 3.9, weight: 650, color: s.c('blue') }));
  },
};

export const scenes: Record<string, SceneDef> = { variety, crops, try: tryIt };

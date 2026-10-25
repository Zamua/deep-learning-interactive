import type { Scene, SceneDef } from '../../../lecture/scene';
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
      s.text('6 upside down → 9', s.w / 2, s.h * 0.87, { size: 3.3, font: 'mono', color: s.c('red') });
      s.text('red light, colors shifted → green', s.w / 2, s.h * 0.94, { size: 3.3, font: 'mono', color: s.c('red') });
    });
  },
};

const crops: SceneDef = {
  draw(s) {
    const size = (s.tall ? 34 : 36) * s.u;
    const cx = s.w * (s.tall ? 0.3 : 0.32);
    const cy = s.h * 0.3;
    const px = size / 32;
    const k = Math.max(0, Math.min(24, Math.floor((s.since('count') - 1.2) / 0.26)));
    const going = s.since('count') > 1.2;
    const [i, j] = [Math.floor(k / 5), k % 5];
    const flipOn = s.ease('flips', 0.6);
    s.rrect(cx - size / 2, cy - size / 2, size, size, 0.8, { fill: s.tint('orange', 0.12), stroke: s.tint('orange', 0.7), lw: 0.3 });
    pixels(s, cx, cy, size * 0.6, flipOn > 0.5 && Math.floor(s.since('flips') / 0.8) % 2 === 1 ? mirror(ARROW) : ARROW, 'orange');
    const w = 28 * px;
    s.rrect(cx - size / 2 + j * px, cy - size / 2 + i * px, w, w, 0.6, { stroke: s.c('blue'), lw: 0.5 });
    s.text('32 × 32 image, 28 × 28 crop', cx, cy + size / 2 + 4.5 * s.u, { size: 3, font: 'mono', color: s.c('--ink-2') });
    const gx = s.w * (s.tall ? 0.76 : 0.72);
    const gp = 5.6 * s.u;
    for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) {
      const seen = going && a * 5 + b <= k;
      s.circle(gx + (b - 2) * gp, cy + (a - 2) * gp, 1.5 * s.u, { fill: seen ? s.c('blue') : s.tint('blue', 0.15), stroke: s.tint('blue', 0.7), lw: 0.25 });
    }
    s.text('start positions', gx, cy + 2.5 * gp + 4.5 * s.u, { size: 3, font: 'mono', color: s.c('--ink-2') });
    const ly = s.h * 0.62;
    s.alpha(s.ease('count', 0.6, 6), () => s.text('5 × 5 = 25 crops', s.w / 2, ly, { size: 3.8, font: 'mono', weight: 650, color: s.c('blue') }));
    s.alpha(flipOn, () => s.text('× 2 with flips = 50 versions', s.w / 2, ly + 6.5 * s.u, { size: 3.6, font: 'mono', weight: 600, color: s.c('--ink-2') }));
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

export const scenes: Record<string, SceneDef> = { variety, crops };

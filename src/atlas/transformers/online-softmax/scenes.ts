import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { bars, cells, columns, rowLabel } from '../../draw';
import { fmt, heat, rich, type Ink } from '../draw';

const S = [3, 4, 0];
const MAX = 4;
const SHIFT = S.map((v) => v - MAX);
/** e^(s - 4), rounded as the narration says them. */
const E = [0.37, 1, 0.02];
const f2 = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));

const max: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 3, s.tall ? 22 : 24);
    const lx = xs[0]! - 12 * u;
    const [y0, y1, y2] = [0.13, 0.33, 0.53].map((f) => s.h * f);
    const shift = s.ease('shift', 0.7, 0.4);
    rowLabel(s, 's', lx, y0, 'purple');
    cells(s, xs, y0, S.map(String), 'purple', { on: [0, s.win('shift', 'small'), 0] });
    s.alpha(s.ease('scores', 0.6, 1.2) * (1 - shift), () => s.text('exponentiate, then divide by the total', s.w / 2, y1, { size: 3.3, color: s.c('--ink-3') }));
    s.alpha(shift, () => {
      rowLabel(s, 's − m', lx, y1, 'purple', 3.6);
      cells(s, xs, y1, SHIFT.map((v) => fmt(v)), 'purple');
      s.text('m = 4', xs[2]! + 10 * u, (y0 + y1) / 2, { size: 3.3, font: 'mono', weight: 650, align: 'left', color: s.c('slate') });
    });
    const sm = s.ease('small', 0.7);
    s.alpha(sm, () => {
      rowLabel(s, 'e^(s−m)', lx, y2, 'gold', 3.4);
      cells(s, xs, y2, E.map(f2), 'gold', { on: E.map(() => s.win('small', 'catch')) });
      s.alpha(s.ease('small', 0.6, 2.4), () => rich(s, [['ℓ = 0.37 + 1 + 0.02 = ', '--ink-2'], ['1.39', 'gold']], s.w / 2, y2 + 9 * u, { size: 3.4, weight: 600 }));
    });
    s.alpha(s.ease('catch', 0.6), () => {
      const y = s.h * 0.8;
      const tx = s.w / 2 - (s.tall ? 40 : 46) * u;
      rich(s, [['pass 1: ', '--ink-3'], ['find m', 'slate']], tx, y, { size: 3.3, weight: 600, align: 'left' });
      rich(s, [['pass 2: ', '--ink-3'], ['add up ℓ', 'gold']], tx, y + 7 * u, { size: 3.3, weight: 600, align: 'left' });
      const gx = s.w / 2 + (s.tall ? 14 : 18) * u;
      const c = 2.6;
      heat(s, gx, y - 3 * u, 6, c, () => 0.3, 'purple');
      s.text('every score kept', gx + 2.5 * c * u, y + 15.5 * u, { size: 3, font: 'mono', color: s.c('red') });
    });
  },
};

/** The pass: which score is being read, each seen term's height e^(s - m), and m and l. */
const STEPS: { at: string; idx: number; m: number; l: string }[] = [
  { at: 'first', idx: 0, m: 3, l: '1' },
  { at: 'grow', idx: 1, m: 3, l: '1 × 0.37 = 0.37' },
  { at: 'add', idx: 1, m: 4, l: '0.37 + 1 = 1.37' },
  { at: 'below', idx: 2, m: 4, l: '1.37 + 0.02 = 1.39' },
];

const pass: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 3, s.tall ? 22 : 24);
    const y0 = s.h * 0.12;
    const base = s.h * 0.6;
    let step = -1;
    STEPS.forEach((st, i) => {
      if (s.since(st.at) >= 0) step = i;
    });
    rowLabel(s, 's', xs[0]! - 12 * u, y0, 'purple');
    cells(s, xs, y0, S.map(String), 'purple', { on: S.map((_, j) => (step >= 0 && STEPS[step]!.idx === j && s.since('weights') < 0 ? 1 : 0)) });
    if (step >= 0) {
      const j = STEPS[step]!.idx;
      s.alpha(1 - s.ease('weights', 0.4), () => s.arrow(xs[j]!, y0 + 9 * u, xs[j]!, y0 + 5.5 * u, s.c('purple'), 0.5, 2.2));
    }
    // Terms seen so far, each measured against the current max.
    const shrink = s.ease('grow', 1.2, 2);
    const h0 = lerp(1, 0.37, shrink);
    const terms = [
      { v: h0, a: s.ease('first', 0.6, 0.6) },
      { v: 1, a: s.ease('add', 0.6, 0.4) },
      { v: 0.02, a: s.ease('below', 0.6, 2) },
    ];
    s.alpha(s.ease('two', 0.6), () => {
      s.line(xs[0]! - 9 * u, base, xs[2]! + 9 * u, base, s.c('--axis'), 0.35);
      rowLabel(s, 'e^(s−m)', xs[0]! - 9 * u, base - 4 * u, 'gold', 3.2);
    });
    terms.forEach((t, j) => s.alpha(t.a, () => bars(s, [xs[j]!], base, [t.v], 'gold', { max: 1, height: 30, w: 11, fmt: f2, hi: [s.win('weights', undefined) * (j === 1 ? 1 : 0)] })));
    s.alpha(s.win('grow', 'add') * s.ease('grow', 0.5, 1.5), () => s.text('× 0.37', xs[0]! + 8 * u, base - 22 * u, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c('red'), halo: true }));
    // m and l, updated as each score is read.
    const ry = s.h * 0.74;
    s.alpha(s.ease('two', 0.6, 1), () => {
      const st = step >= 0 ? STEPS[step]! : null;
      const lx = s.w / 2 - (s.tall ? 40 : 44) * u;
      rich(s, [['m = ', '--ink-2'], [st ? String(st.m) : '−∞', 'slate']], lx, ry, { size: 3.8, weight: 650, align: 'left' });
      rich(s, [['ℓ = ', '--ink-2'], [st ? st.l : '0', 'gold']], lx, ry + 8 * u, { size: 3.8, weight: 650, align: 'left' });
    });
    s.alpha(s.ease('weights', 0.6, 0.4), () => {
      rich(s, [['weight of 4: ', '--ink-2'], ['1 / 1.39 ≈ 0.72', 'teal']], s.w / 2, s.h * 0.93, { size: 3.6, weight: 650 });
    });
  },
};

const N = 8;
const ROW = 2;
/** Made-up shades for one query row's scores, standing in for e^(s - m). */
const SHADE = [0.5, 0.2, 0.8, 0.35, 0.6, 0.95, 0.3, 0.45];

const tiles: SceneDef = {
  draw(s) {
    const u = s.u;
    const tall = s.tall;
    const c = (tall ? 5.2 : 6.4) * u;
    const gw = N * c;
    const left = 15 * u;
    const gx = left + c / 2;
    const gy = s.h * 0.2 + c / 2;
    // Two tiles of four keys each, read one after the other.
    const t1 = s.ease('tiles', 1, 1.2);
    const t2 = s.ease('tiles', 1, 3.4);
    const tileOf = (j: number) => (j < 4 ? t1 * (1 - 0.7 * t2) : t2);
    heat(s, gx, gy, N, c / u, (i, j) => (i === ROW && tileOf(j) > 0.02 ? SHADE[j]! * tileOf(j) : null), 'purple');
    s.text('keys', left + gw / 2, gy - c / 2 - 3 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
    s.text('query', left - 1.6 * u, gy + ROW * c, { size: 3, font: 'mono', weight: 600, align: 'right', color: s.c('teal') });
    // The query's row and the tile being read.
    s.rrect(left - 0.6 * u, gy + (ROW - 0.5) * c - 0.6 * u, gw + 1.2 * u, c + 1.2 * u, 1, { stroke: s.c('teal'), lw: 0.4 });
    const tx = lerp(0, 4, t2);
    s.alpha(s.ease('tiles', 0.6, 1), () => s.rrect(left + tx * c - 0.3 * u, gy - c / 2 - 0.3 * u, 4 * c + 0.6 * u, gw + 0.6 * u, 1.2, { stroke: s.tint('gold', 0.9), lw: 0.35 }));
    s.alpha(s.ease('tiles', 0.6, 2), () => s.text('T × T: never stored', left + gw / 2, gy - c / 2 + gw + 4.5 * u, { size: 3.1, font: 'mono', weight: 600, color: s.c('red') }));
    // The query's running state, to the right of the grid.
    const sx = (left + gw + s.w) / 2;
    const sy = s.h * 0.24;
    const row = (y: number, name: string, k: Ink, n: number, on: number) => {
      s.text(name, sx - 11 * u, y, { size: 3.6, font: 'mono', weight: 650, align: 'right', color: s.c(k) });
      for (let i = 0; i < n; i++) s.cell(sx - 9 * u + i * 6.4 * u, y - 3 * u, 5.6 * u, 6 * u, '', k, { on });
    };
    s.alpha(s.ease('tiles', 0.6, 0.6), () => {
      s.text('the query keeps', sx, sy - 8 * u, { size: 3.1, color: s.c('--ink-3') });
      row(sy, 'm', 'slate', 1, 0);
      row(sy + 8 * u, 'ℓ', 'gold', 1, 0);
    });
    s.alpha(s.ease('output', 0.6), () => {
      row(sy + 16 * u, 'o', 'teal', 4, s.win('output', 'divide'));
      s.alpha(s.ease('output', 0.6, 3), () => {
        s.text('when m grows:', sx, sy + 25 * u, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
        rich(s, [['ℓ', 'gold'], [', ', '--ink-3'], ['o', 'teal'], [' × e^(old m − new m)', 'red']], sx, sy + 30.5 * u, { size: 2.9, weight: 600 });
      });
    });
    s.alpha(s.ease('divide', 0.6), () => rich(s, [['out = ', '--ink-2'], ['o', 'teal'], [' / ', '--ink-2'], ['ℓ', 'gold']], sx, sy + 40 * u, { size: 3.8, weight: 650 }));
    s.alpha(s.ease('memory', 0.6), () => {
      s.text('per query: m, ℓ and one output row, for any T', s.w / 2, s.h * 0.9, { size: tall ? 3 : 3.3, color: s.c('--ink'), halo: true });
    });
  },
};

export const scenes: Record<string, SceneDef> = { max, pass, tiles };

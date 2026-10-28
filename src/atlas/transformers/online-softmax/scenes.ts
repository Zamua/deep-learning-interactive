import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { bars, cells, columns, rowLabel } from '../../draw';
import { after } from '../../networks/draw';
import { fmt, heat, rich, type Ink } from '../draw';

const S = [3, 4, 0];
const MAX = 4;
const SHIFT = S.map((v) => v - MAX);
/** e^s, then e^(s - 4): the same bars, rounded as the narration says them. */
const ES = S.map((v) => Math.exp(v));
const E = [0.37, 1, 0.02];
const f2 = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2));
const f1 = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const K = { s: 'purple', m: 'orange', l: 'green', o: 'gold' } as const satisfies Record<string, Ink>;

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** A small T by T grid of scores with one query's row outlined, its top-left cell centered on (x, y). */
function scoreGrid(s: Scene, x: number, y: number, n: number, cell: number, row: number) {
  heat(s, x, y, n, cell, (i, j) => 0.25 + 0.2 * Math.sin(i * 1.7 + j * 2.3) ** 2, K.s);
  const c = cell * s.u;
  s.rrect(x - c / 2 - 0.5 * s.u, y + (row - 0.5) * c - 0.5 * s.u, n * c + s.u, c + s.u, 1, { stroke: s.c('teal'), lw: 0.45 });
}

// ---- why the whole row is kept: softmax needs the row's total, and the max first

const row: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    // The T by T grid, while the problem is stated.
    s.alpha(1 - s.ease('big', 0.6), () => {
      const n = 8;
      const c = s.tall ? 5.6 : 6;
      const gx = cx - ((n - 1) / 2) * c * u;
      const gy = s.h * 0.2;
      s.text('T × T scores', cx, gy - c * u - 1.5 * u, { size: 3.3, font: 'mono', weight: 600, color: s.c('--ink-2') });
      scoreGrid(s, gx, gy, n, c, 2);
      s.text('one query', gx - c * u * 0.5 - 2 * u, gy + 2 * c * u, { size: 3, font: 'mono', weight: 600, align: 'right', color: s.c('teal') });
      s.alpha(after(s, 'row', 0.55), () => s.text('no weight until the whole row is read', cx, s.h * 0.88, { size: 3.4, font: 'mono', color: s.c('--ink-2'), halo: true }));
    });
    // The worked row: scores, scores minus the max, and their exponentials as bars.
    const xs = columns(s, 3, s.tall ? 22 : 24);
    const lx = xs[0]! - 12 * u;
    const [y0, y1] = [0.13, 0.27].map((f) => s.h * f);
    const base = s.h * 0.68;
    const work = s.ease('big', 0.6, 0.3);
    const passes = s.ease('passes', 0.6);
    s.alpha(work, () => {
      rowLabel(s, 's', lx, y0, K.s);
      cells(s, xs, y0, S.map(String), K.s, { on: [0, s.win('shift', 'small'), 0] });
    });
    const shift = s.ease('shift', 0.7, 1.2);
    s.alpha(shift, () => {
      rowLabel(s, 's − m', lx, y1, K.s, 3.6);
      cells(s, xs, y1, SHIFT.map((v) => fmt(v)), K.s);
      s.text('m = 4', xs[2]! + 10 * u, (y0 + y1) / 2, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c(K.m) });
    });
    // The bars keep their shape: e^(s - m) is e^s divided by e^4.
    const small = s.ease('small', 0.7, 1.5);
    s.alpha(work * (1 - passes), () => {
      bars(s, xs, base, ES, K.l, { max: ES[1]!, height: 28, w: 11 });
      const lab = { size: 3.4, font: 'mono' as const, weight: 600, halo: true };
      xs.forEach((x, i) => {
        const top = base - (ES[i]! / ES[1]!) * 28 * u - 3.2 * u;
        s.alpha(1 - small, () => s.text(f1(ES[i]!), x, top, { ...lab, color: s.c('--ink-2') }));
        s.alpha(small, () => s.text(f2(E[i]!), x, top, { ...lab, color: s.c(K.l) }));
      });
      s.alpha(1 - small, () => rowLabel(s, 'e^s', lx, base - 6 * u, K.l, 3.4));
      s.alpha(small, () => {
        rowLabel(s, 'e^(s−m)', lx, base - 6 * u, K.l, 3.4);
        s.line(xs[0]! - 8 * u, base - 28 * u, xs[2]! + 8 * u, base - 28 * u, s.tint(K.l, 0.7), 0.25, [1, 1]);
      });
      const cy = s.h * 0.84;
      s.alpha(s.win('big', 'shift'), () => rich(s, [['e^1000 → ', '--ink-2'], ['inf', 'red']], cx, cy, { size: 3.6, weight: 650 }));
      s.alpha(s.win('shift', 'small'), () => s.text('subtract the max: the gaps stay the same', cx, cy, { size: 3.3, font: 'mono', color: s.c('--ink-2'), halo: true }));
      s.alpha(small * (1 - s.ease('sum', 0.5)), () => s.text('same bars, now none above 1', cx, cy, { size: 3.3, font: 'mono', color: s.c(K.l), halo: true }));
      s.alpha(s.ease('sum', 0.6, 0.6), () => rich(s, [['ℓ = 0.37 + 1 + 0.02 = ', '--ink-2'], ['1.39', K.l]], cx, cy, { size: 3.6, weight: 650 }));
    });
    // Three passes, every score kept in between.
    s.alpha(passes, () => {
      const y = s.h * 0.47;
      const tx = cx - (s.tall ? 42 : 46) * u;
      const o = { size: 3.4, weight: 600, align: 'left' as const };
      rich(s, [['pass 1: ', '--ink-3'], ['find m', K.m]], tx, y, o);
      s.alpha(after(s, 'passes', 0.32), () => rich(s, [['pass 2: ', '--ink-3'], ['add up ℓ', K.l]], tx, y + 8 * u, o));
      s.alpha(after(s, 'passes', 0.45), () => rich(s, [['pass 3: ', '--ink-3'], ['divide', '--ink-2']], tx, y + 16 * u, o));
      const c = 3;
      const gx = cx + (s.tall ? 16 : 20) * u;
      scoreGrid(s, gx, y - 2 * u, 6, c, 2);
      s.alpha(after(s, 'passes', 0.6), () => s.text('every score kept', gx + 2.5 * c * u, y + 19 * u, { size: 3.1, font: 'mono', weight: 600, color: s.c('red') }));
    });
  },
};

// ---- one pass: a running max and a running sum, rescaled when the max grows

/** The pass: which score is being read, the max so far, and the sum so far. */
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
    const y0 = s.h * 0.15;
    const base = s.h * 0.62;
    const H = 28;
    let step = -1;
    STEPS.forEach((st, i) => {
      if (s.since(st.at) >= 0) step = i;
    });
    const reading = s.since('weight') < 0;
    rowLabel(s, 's', xs[0]! - 12 * u, y0, K.s);
    cells(s, xs, y0, S.map(String), K.s, { on: S.map((_, j) => (step >= 0 && STEPS[step]!.idx === j && reading ? 1 : 0)) });
    if (step >= 0) {
      const j = STEPS[step]!.idx;
      s.alpha(1 - s.ease('weight', 0.4), () => s.arrow(xs[j]!, y0 + 9.5 * u, xs[j]!, y0 + 5.8 * u, s.c(K.s), 0.5, 2.2));
    }
    // Each seen score's bar, measured against the current max: the max's bar is always 1.
    const shrink = s.ease('grow', 1.2, 2.2);
    const terms = [
      { v: lerp(1, 0.37, shrink), a: s.ease('first', 0.6, 0.6) },
      { v: 1, a: s.ease('add', 0.6, 0.4) },
      { v: 0.02, a: s.ease('below', 0.6, 2) },
    ];
    s.alpha(s.ease('idea', 0.6, 1), () => {
      s.line(xs[0]! - 9 * u, base, xs[2]! + 9 * u, base, s.c('--axis'), 0.35);
      rowLabel(s, 'e^(s−m)', xs[0]! - 9 * u, base - 4 * u, K.l, 3.2);
    });
    s.alpha(s.ease('first', 0.6, 1.5), () => {
      s.line(xs[0]! - 9 * u, base - H * u, xs[2]! + 9 * u, base - H * u, s.tint(K.m, 0.7), 0.25, [1, 1]);
      s.text('1: the max', xs[2]! + 9 * u, base - H * u - 2.4 * u, { size: 2.8, font: 'mono', weight: 600, align: 'right', color: s.c(K.m), halo: true });
    });
    terms.forEach((t, j) => s.alpha(t.a, () => bars(s, [xs[j]!], base, [t.v], K.l, { max: 1, height: H, w: 11, fmt: f2, hi: [s.win('weight', 'online') * (j === 1 ? 1 : 0)] })));
    s.alpha(s.win('grow', 'add') * s.ease('grow', 0.5, 1.6), () => s.text('× e^(3−4) ≈ 0.37', xs[0]! + 7 * u, base - 18 * u, { size: 3.3, font: 'mono', weight: 650, align: 'left', color: s.c('red'), halo: true }));
    // m and l, updated as each score is read.
    const ry = s.h * 0.76;
    s.alpha(s.ease('idea', 0.6, 2), () => {
      const st = step >= 0 ? STEPS[step]! : null;
      const lx = s.w / 2 - (s.tall ? 40 : 44) * u;
      rich(s, [['m = ', '--ink-2'], [st ? String(st.m) : '−∞', K.m]], lx, ry, { size: 3.8, weight: 650, align: 'left' });
      rich(s, [['ℓ = ', '--ink-2'], [st ? st.l : '0', K.l]], lx, ry + 7.5 * u, { size: 3.8, weight: 650, align: 'left' });
    });
    const cy = s.h * 0.93;
    s.alpha(s.win('rule', 'add'), () => rich(s, [['m grows: ', '--ink-3'], ['ℓ', K.l], [' × e^(old m − new m)', 'red']], s.w / 2, cy, { size: 3.4, weight: 650 }));
    s.alpha(s.win('weight', 'online'), () => rich(s, [['weight of 4: ', '--ink-2'], ['1 / 1.39 ≈ 0.72', 'teal']], s.w / 2, cy, { size: 3.6, weight: 650 }));
    s.alpha(s.ease('online', 0.6), () => s.text('online: each score handled as it arrives', s.w / 2, cy, { size: 3.3, font: 'mono', color: s.c('--ink-2'), halo: true }));
    cite(s, 'Milakov & Gimelshein, 2018', s.win('idea', 'first') + s.ease('online', 0.6));
  },
};

// ---- attention in tiles: a running output too, and the scores are never stored

const N = 8;
const ROW = 2;
/** Made-up shades for one query row's scores. */
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
    // One key at a time while the output is built, then tiles of four.
    const tiled = s.ease('tile', 0.6, 0.8);
    const one = Math.min(N - 1, Math.floor(s.prog('value') * 1.6 * N));
    const t1 = s.ease('tile', 1, 1.5);
    const t2 = s.ease('tile', 1, 4);
    const seen = (j: number) => (tiled > 0.5 ? (j < 4 ? t1 : t2) : s.since('value') >= 0 && j <= one ? 1 : 0);
    heat(s, gx, gy, N, c / u, (i, j) => (i === ROW && seen(j) > 0.02 ? SHADE[j]! * seen(j) : null), K.s);
    s.text('keys', left + gw / 2, gy - c / 2 - 3 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
    s.text('query', left - 1.6 * u, gy + ROW * c, { size: 3, font: 'mono', weight: 600, align: 'right', color: s.c('teal') });
    s.rrect(left - 0.6 * u, gy + (ROW - 0.5) * c - 0.6 * u, gw + 1.2 * u, c + 1.2 * u, 1, { stroke: s.c('teal'), lw: 0.4 });
    // The key being read, then the tile being read.
    s.alpha(s.win('value', 'tile') * (s.since('value') >= 0 ? 1 : 0), () => s.rrect(left + one * c - 0.3 * u, gy + (ROW - 0.5) * c - 0.3 * u, c + 0.6 * u, c + 0.6 * u, 0.8, { stroke: s.c('gold'), lw: 0.5 }));
    s.alpha(tiled, () => {
      // The grid's tiles, four by four, and the one being read.
      for (const a of [0, 4]) for (const b of [0, 4]) s.rrect(left + b * c + 0.2 * u, gy - c / 2 + a * c + 0.2 * u, 4 * c - 0.4 * u, 4 * c - 0.4 * u, 1, { stroke: s.tint('--ink-3', 0.5), lw: 0.25 });
      const tx = lerp(0, 4, s.ease('tile', 1, 3.6));
      s.rrect(left + tx * c - 0.3 * u, gy - c / 2 - 0.3 * u, 4 * c + 0.6 * u, 4 * c + 0.6 * u, 1.2, { stroke: s.c('gold'), lw: 0.5 });
      s.alpha(1 - s.ease('memory', 0.5), () => s.text('a tile', left + (tx + 2) * c, gy - c / 2 + gw + 4.5 * u, { size: 3.1, font: 'mono', weight: 650, color: s.c('gold') }));
    });
    s.alpha(s.ease('memory', 0.6), () => s.text('T × T: never stored', left + gw / 2, gy - c / 2 + gw + 4.5 * u, { size: 3.1, font: 'mono', weight: 600, color: s.c('red') }));
    // The query's running state, to the right of the grid.
    const sx = (left + gw + s.w) / 2;
    const sy = s.h * 0.24;
    const box = (y: number, name: string, k: Ink, n: number, on: number) => {
      s.text(name, sx - 11 * u, y, { size: 3.6, font: 'mono', weight: 650, align: 'right', color: s.c(k) });
      for (let i = 0; i < n; i++) s.cell(sx - 9 * u + i * 6.4 * u, y - 3 * u, 5.6 * u, 6 * u, '', k, { on });
    };
    const mem = s.win('memory', undefined);
    s.text('the query keeps', sx, sy - 8 * u, { size: 3.1, color: s.c('--ink-3') });
    box(sy, 'm', K.m, 1, mem);
    box(sy + 8 * u, 'ℓ', K.l, 1, mem);
    s.alpha(s.ease('value', 0.6, 1), () => {
      box(sy + 16 * u, 'o', K.o, 4, Math.max(s.win('value', 'divide'), mem));
      s.alpha(mem, () => s.text('dᵥ numbers', sx - 9 * u + 1.5 * 6.4 * u + 2.8 * u, sy + 22.5 * u, { size: 2.8, font: 'mono', color: s.c(K.o) }));
    });
    s.alpha(s.win('shrink', 'tile'), () => {
      s.text('when m grows:', sx, sy + 27 * u, { size: 2.9, font: 'mono', color: s.c('--ink-3') });
      rich(s, [['ℓ', K.l], [', ', '--ink-3'], ['o', K.o], [' × e^(old m − new m)', 'red']], sx, sy + 32.5 * u, { size: tall ? 2.7 : 2.9, weight: 600 });
    });
    s.alpha(s.win('divide', 'tile'), () => rich(s, [['out = ', '--ink-2'], ['o', K.o], [' / ', '--ink-2'], ['ℓ', K.l]], sx, sy + 41 * u, { size: 3.8, weight: 650 }));
    s.alpha(s.win('flash', 'memory'), () => s.text('FlashAttention', sx, sy + 32 * u, { size: 3.6, font: 'mono', weight: 650, color: s.c('--ink'), halo: true }));
    cite(s, 'Dao, Fu, Ermon, Rudra & Ré, 2022', s.ease('flash', 0.6));
    s.alpha(s.ease('memory', 0.6), () => s.text('per query: m, ℓ and one output row, for any T', s.w / 2, s.h * 0.9, { size: tall ? 3 : 3.3, color: s.c('--ink'), halo: true }));
  },
};

export const scenes: Record<string, SceneDef> = { row, pass, tiles };

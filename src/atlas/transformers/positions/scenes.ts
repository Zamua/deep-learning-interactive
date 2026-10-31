import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { cite, columns } from '../../draw';
import { brace, rich } from '../../linear-algebra/draw';
import { fmt, mini, sub } from '../draw';

// ---- scene 1: without positions, attention sees a bag of tokens

const WORDS = ['dog', 'bites', 'man'];
const OUT = [0.7, 1.3, -0.4];
/** Where each word sits in the swapped sentence. */
const SWAP = [2, 1, 0];

function chip(s: Scene, x: number, y: number, w: string, on = 0): void {
  s.cell(x - 8 * s.u, y - 3.5 * s.u, 16 * s.u, 7 * s.u, w, 'orange', { on, size: 3.2 });
}

/** An arc over the chips from x0 to x1, peaking `h` px above y. */
function hump(s: Scene, x0: number, x1: number, y: number, h: number, k: Ink): void {
  const c = s.ctx;
  c.beginPath();
  c.moveTo(x0, y);
  c.quadraticCurveTo((x0 + x1) / 2, y - 2 * h, x1, y);
  c.strokeStyle = s.tint(k, 0.7);
  c.lineWidth = 0.3 * s.u;
  c.stroke();
}

const blind: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 3, 28);
    const y1 = s.h * 0.24;
    const y2 = s.h * 0.54;
    // A recurrent network: one token per step, in order.
    s.alpha(s.win('rnn', 'all'), () => {
      WORDS.forEach((_, j) => {
        s.alpha(s.ease('rnn', 0.5, 0.8 + 0.7 * j), () => s.text(`step ${j + 1}`, xs[j]!, y1 - 7 * u, { size: 3, font: 'mono', weight: 600, color: s.c('blue') }));
        if (j > 0) s.alpha(s.ease('rnn', 0.5, 0.8 + 0.7 * j), () => s.arrow(xs[j - 1]! + 8.6 * u, y1, xs[j]! - 8.6 * u, y1, s.c('blue'), 0.45, 2));
      });
      s.alpha(s.ease('rnn', 0.6, 3.5), () => s.text('read in order: the order is built in', s.w / 2, s.h * 0.4, { size: 3.2, color: s.c('blue') }));
    });
    // Self-attention: every token with every token, all at once.
    s.alpha(s.win('all', 'one'), () => {
      s.alpha(s.ease('all', 0.6, 0.6), () => s.text('every token with every token, at once', s.w / 2, s.h * 0.4, { size: 3.2, color: s.c('teal') }));
      const top = y1 - 4 * u;
      hump(s, xs[0]!, xs[1]!, top, 4 * u, 'teal');
      hump(s, xs[1]!, xs[2]!, top, 4 * u, 'teal');
      hump(s, xs[0]!, xs[2]!, top, 8 * u, 'teal');
    });
    WORDS.forEach((w, j) => {
      chip(s, xs[j]!, y1, w, j === 1 ? s.win('same', 'bag') : 0);
      s.alpha(s.ease('one', 0.6, 2.2), () => s.cell(xs[j]! - 5 * u, y1 + 7 * u, 10 * u, 6.5 * u, fmt(OUT[j]!), 'teal', { size: 3 }));
    });
    s.alpha(s.ease('swap', 0.6), () => {
      WORDS.forEach((w, j) => {
        const to = xs[SWAP[j]!]!;
        const t = s.ease('swap', 1.2, 0.6);
        const x = lerp(xs[j]!, to, t);
        const y = lerp(y1, y2, t);
        if (j !== 1) s.alpha(0.5 * t, () => s.line(xs[j]!, y1 + 11 * u, to, y2 - 4.5 * u, s.tint('--ink-3', 0.7), 0.25, [1, 1]));
        chip(s, x, y, w, j === 1 ? s.win('same', 'bag') : 0);
      });
    });
    s.alpha(s.ease('same', 0.6), () => {
      WORDS.forEach((_, j) => s.cell(xs[SWAP[j]!]! - 5 * u, y2 + 7 * u, 10 * u, 6.5 * u, fmt(OUT[j]!), 'teal', { size: 3, on: j === 1 ? s.win('same', 'bag') : 0 }));
      s.alpha(s.ease('same', 0.6, 2.5), () => s.text('same outputs, moved with their tokens', s.w / 2, s.h * 0.76, { size: 3.2, color: s.c('--ink-2') }));
    });
    s.alpha(s.ease('bag', 0.6), () => {
      rich(s, [['{ ', '--ink-3'], ['dog, bites, man', 'orange'], [' }', '--ink-3']], s.w / 2, s.h * 0.86, { size: 3.8, weight: 600 });
      s.text('a bag of tokens: the order is lost', s.w / 2, s.h * 0.93, { size: 3.1, color: s.c('red') });
    });
  },
};

// ---- scene 2: add the position's vector, tip to tail

const E = [[1, 2], [0, 1], [3, 0]];
const P = [[0, 1], [2, 0], [1, -1]];
const DOG = E[0]!;
const AT0 = [DOG[0]! + P[0]![0]!, DOG[1]! + P[0]![1]!];
const AT2 = [DOG[0]! + P[2]![0]!, DOG[1]! + P[2]![1]!];

/** Plane coordinates on the stage. */
interface Plane {
  P(x: number, y: number): [number, number];
}

/** The plane in the left part of the stage, below the tables, with its axes and a few ticks. */
function plane(s: Scene): Plane {
  const u = s.u;
  const [l, t, r, b] = [5 * u, s.h * 0.41, s.w * 0.55, s.h * 0.97];
  const box = [-0.5, 3.3, -0.5, 3.6] as const;
  const k = Math.min((r - l) / (box[1] - box[0]), (b - t) / (box[3] - box[2]));
  const ox = (l + r) / 2 - ((box[0] + box[1]) / 2) * k;
  const oy = (t + b) / 2 + ((box[2] + box[3]) / 2) * k;
  const P = (x: number, y: number): [number, number] => [ox + x * k, oy - y * k];
  s.line(...P(box[0], 0), ...P(box[1], 0), s.c('--axis'), 0.3);
  s.line(...P(0, box[2]), ...P(0, box[3]), s.c('--axis'), 0.3);
  const tick = { size: 2.5, font: 'mono' as const, color: s.c('--ink-3') };
  for (const v of [1, 2, 3]) {
    const [ax, ay] = P(v, 0);
    const [bx, by] = P(0, v);
    s.text(String(v), ax, ay + 2.6 * u, tick);
    s.text(String(v), bx - 2.4 * u, by, tick);
  }
  return { P };
}

/** An arrow from a to b on the plane, drawn in up to fraction `f` of its length. */
function vec(s: Scene, F: Plane, a: readonly number[], b: readonly number[], k: Ink, f = 1, width = 0.7): void {
  if (f <= 0.003) return;
  const e = [a[0]! + (b[0]! - a[0]!) * f, a[1]! + (b[1]! - a[1]!) * f];
  s.arrow(...F.P(a[0]!, a[1]!), ...F.P(e[0]!, e[1]!), s.c(k), width, 2.6);
}

const add: SceneDef = {
  draw(s) {
    const u = s.u;
    const ty = s.h * 0.24;
    const ex = s.w * 0.3;
    const px = s.w * 0.76;
    const one = s.win('sum0', 'sum2');
    const two = s.ease('sum2', 0.6);
    const dogOn = Math.max(s.ease('dog', 0.6) * (1 - s.ease('rows', 0.6)), s.win('rows', 'differ'));
    const rows = s.ease('rows', 0.6);
    // The two tables: E by token, P by position.
    const eb = mini(s, ex, ty, E.map((r) => r.map((v) => fmt(v))), 'orange', { vpitch: 6.5, h: 5.6, on: (i) => (i === 0 ? dogOn : 0) });
    rich(s, [['E', 'orange'], ['  by token', '--ink-2']].slice(0, rows > 0.5 ? 2 : 1) as [string, Ink][], ex, eb.t - 3.6 * u, { size: 3.6, weight: 650 });
    WORDS.forEach((w, i) => s.text(w, eb.l - 2 * u, ty + (i - 1) * 6.5 * u, { size: 2.9, font: 'mono', weight: 600, align: 'right', color: s.c('--ink-2') }));
    s.alpha(s.ease('table', 0.6), () => {
      const pb = mini(s, px, ty, P.map((r) => r.map((v) => fmt(v))), 'slate', { vpitch: 6.5, h: 5.6, on: (i) => (i === 0 ? one : i === 2 ? two * (1 - 0.5 * s.ease('differ', 0.6)) : 0) });
      rich(s, [['P', 'slate'], ['  by position', '--ink-2']].slice(0, rows > 0.5 ? 2 : 1) as [string, Ink][], px, pb.t - 3.6 * u, { size: 3.6, weight: 650 });
      [0, 1, 2].forEach((i) => s.text(`pos ${i}`, pb.l - 2 * u, ty + (i - 1) * 6.5 * u, { size: 2.9, font: 'mono', weight: 600, align: 'right', color: s.c('--ink-2') }));
    });
    cite(s, 'Vaswani et al., 2017 · Attention Is All You Need', s.win('fix', 'table'));

    // The plane: dog's embedding, then each position's vector added tip to tail.
    const F = plane(s);
    const lab = { size: 3, font: 'mono' as const, weight: 650, halo: true };
    const dogA = s.ease('dog', 0.6);
    vec(s, F, [0, 0], DOG, 'orange', s.ease('dog', 1, 0.3), 0.6);
    s.alpha(dogA * (1 - s.ease('sum0', 0.5)), () => s.text('dog [1, 2]', ...F.P(DOG[0]! - 0.12, DOG[1]! + 0.25), { ...lab, align: 'right', color: s.c('orange') }));
    const dim0 = 1 - 0.55 * s.ease('sum2', 0.6) * (1 - s.ease('differ', 0.6));
    s.alpha(dim0, () => {
      vec(s, F, DOG, AT0, 'slate', s.ease('sum0', 1, 0.5), 0.6);
      vec(s, F, [0, 0], AT0, 'teal', s.ease('sum0', 1, 2.2), 0.8);
      s.alpha(s.ease('sum0', 0.6, 2.8), () => s.text('dog @ 0', ...F.P(AT0[0]! + 0.15, AT0[1]! + 0.12), { ...lab, align: 'left', color: s.c('teal') }));
    });
    vec(s, F, DOG, AT2, 'slate', s.ease('sum2', 1, 0.5), 0.6);
    vec(s, F, [0, 0], AT2, 'teal', s.ease('sum2', 1, 2), 0.8);
    s.alpha(s.ease('sum2', 0.6, 2.6), () => s.text('dog @ 2', ...F.P(AT2[0]! + 0.15, AT2[1]! - 0.2), { ...lab, align: 'left', color: s.c('teal') }));
    s.alpha(s.ease('differ', 0.6), () => {
      for (const p of [AT0, AT2]) s.circle(...F.P(p[0]!, p[1]!), 1.3 * u, { fill: s.tint('teal', 0.35), stroke: s.c('teal'), lw: 0.3 });
    });

    // The sums, written out beside the plane.
    const tx = s.w * 0.78;
    const row = (i: number) => s.h * 0.45 + i * 7 * u;
    const o = { size: s.tall ? 2.9 : 3.2, weight: 600 };
    s.alpha(dogA, () => rich(s, [['E[0] = ', 'orange'], ['[1, 2]', '--ink']], tx, row(0), o));
    s.alpha(s.ease('sum0', 0.6, 0.5), () => rich(s, [['+ P[0] = ', 'slate'], ['[0, 1]', '--ink']], tx, row(1), o));
    s.alpha(s.ease('sum0', 0.6, 2.2), () => rich(s, [['= ', '--ink-2'], ['[1, 3]', 'teal'], [': dog @ 0', '--ink-2']], tx, row(2), o));
    s.alpha(s.ease('sum2', 0.6, 0.5), () => rich(s, [['+ P[2] = ', 'slate'], ['[1, −1]', '--ink']], tx, row(3.3), o));
    s.alpha(s.ease('sum2', 0.6, 2), () => rich(s, [['= ', '--ink-2'], ['[2, 1]', 'teal'], [': dog @ 2', '--ink-2']], tx, row(4.3), o));
    s.alpha(s.ease('differ', 0.6, 0.5), () => rich(s, [['same word,', 'green']], tx, row(5.8), o));
    s.alpha(s.ease('differ', 0.6, 0.9), () => rich(s, [['two points', 'green']], tx, row(6.7), o));
  },
};

// ---- scene 3: the table is learned, one row per position up to T_max

const learned: SceneDef = {
  draw(s) {
    const u = s.u;
    const W = (s.tall ? 40 : 46) * u;
    const l = s.w / 2 - W / 2;
    const top = s.h * 0.16;
    const bot = s.h * 0.66;
    const rh = 5.6 * u;
    const size = s.ease('size', 0.6);
    const lab = { size: 2.8, font: 'mono' as const, align: 'right' as const, color: s.c('--ink-3') };
    // The table: its first rows, an ellipsis, and the last row.
    s.rrect(l, top, W, bot - top, 1, { fill: s.tint('slate', 0.1 + 0.08 * s.win('learned', 'tmax')), stroke: s.tint('slate', 0.6), lw: 0.35 });
    for (let i = 0; i < 4; i++) {
      s.line(l, top + (i + 1) * rh, l + W, top + (i + 1) * rh, s.tint('slate', 0.45), 0.25);
      s.text(String(i), l - 2 * u, top + (i + 0.5) * rh, lab);
    }
    s.line(l, bot - rh, l + W, bot - rh, s.tint('slate', 0.45), 0.25);
    s.text('⋮', s.w / 2, (top + 4 * rh + bot - rh) / 2, { size: 4, color: s.c('--ink-3') });
    const yLast = bot - rh / 2;
    s.alpha(s.win('end', 'turn'), () => s.rrect(l, bot - rh, W, rh, 1, { fill: s.tint('slate', 0.25) }));
    s.alpha(1 - size, () => {
      const w = s.measure(' − 1', lab);
      s.text(' − 1', l - 2 * u, yLast, lab);
      sub(s, 'T', 'max', l - 2 * u - w, yLast, { size: 2.8, align: 'right', k: '--ink-3', weight: 500 });
    });
    s.alpha(size, () => s.text('1,023', l - 2 * u, yLast, lab));
    // Its name, beside it.
    const nx = l + W + 4 * u;
    const ny = (top + bot) / 2;
    s.text('P', nx, ny - 4 * u, { size: 6, font: 'mono', weight: 700, align: 'left', color: s.c('slate') });
    s.alpha(s.ease('learned', 0.6, 1.5), () => {
      const o = { size: 2.9, font: 'mono' as const, weight: 600, align: 'left' as const, color: s.c('--ink-2') };
      s.text('position', nx, ny + 3.5 * u, o);
      s.text('embeddings', nx, ny + 7.5 * u, o);
    });

    // Its sizes: T_max rows of d numbers, then 1,024 of 768.
    s.alpha(s.ease('tmax', 0.6, 1), () => {
      const bx = l - 15 * u;
      brace(s, 'left', top, bot, bx, '', '--ink-2');
      s.alpha(1 - size, () => sub(s, 'T', 'max', bx - 2.4 * u, (top + bot) / 2, { size: 3.6, align: 'right', k: 'slate' }));
      s.alpha(size, () => s.text('1,024', bx - 2.4 * u, (top + bot) / 2, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('slate') }));
      brace(s, 'top', l, l + W, top - 2 * u, size > 0.5 ? '768' : 'd', '--ink-2', 3.4);
    });
    const cy = s.h * 0.86;
    s.alpha(s.win('tmax', 'size'), () => {
      const big = { size: 3.6, font: 'mono' as const, weight: 600 };
      const w1 = s.measure('P: ', big);
      const wt = s.measure('Tmax', big);
      const w2 = s.measure(' × d', big);
      const x0 = s.w / 2 - (w1 + wt + w2) / 2;
      s.text('P: ', x0, cy, { ...big, align: 'left', color: s.c('slate') });
      const w = sub(s, 'T', 'max', x0 + w1, cy, { size: 3.6, align: 'left', k: 'slate' });
      s.text(' × d', x0 + w1 + w, cy, { ...big, align: 'left', color: s.c('--ink-2') });
    });
    s.alpha(s.win('size', 'end'), () => {
      rich(s, [['1,024 × 768 = ', '--ink-2'], ['786,432', '--ink']], s.w / 2, cy, { size: 3.6, weight: 600 });
      s.text('learned numbers', s.w / 2, cy + 6 * u, { size: 3.1, font: 'mono', color: s.c('--ink-2') });
    });

    // One position too many: no row to read.
    s.alpha(s.ease('end', 0.6), () => {
      const y = bot + rh / 2 + 1.2 * u;
      const c = s.ctx;
      c.save();
      c.setLineDash([0.8 * u, 0.8 * u]);
      c.strokeStyle = s.c('red');
      c.lineWidth = 0.3 * u;
      c.strokeRect(l, y - rh / 2 + 0.4 * u, W, rh - 0.8 * u);
      c.restore();
      s.text('1,024', l - 2 * u, y, { ...lab, weight: 650, color: s.c('red') });
      s.text('no row', s.w / 2, y, { size: 3, font: 'mono', weight: 650, color: s.c('red') });
    });
    s.alpha(s.ease('end', 0.6, 1.2), () => rich(s, [['longest input: ', '--ink-2'], ['1,024', 'slate'], [' tokens', '--ink-2']], s.w / 2, cy, { size: 3.4, weight: 600 }));
  },
};

export const scenes: Record<string, SceneDef> = { blind, add, learned };

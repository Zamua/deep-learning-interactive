import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import type { Ink } from '../../linear-algebra/draw';
import { after } from '../../networks/draw';
import { fmt } from '../../sequences/draw';
import { chain, sub } from './chain';

/** h_1..h_n from h_0 = 0. */
const run = (a: number, b: number, xs: number[]) => xs.reduce<number[]>((hs, x) => [...hs, a * hs[hs.length - 1]! + b * x], [0]);

// The running example: a = 0.5, b = c = 2, reading 3, 1, 2.
const A = 0.5;
const B = 2;
const C = 2;
const XS = [3, 1, 2];
const HS = run(A, B, XS);
/** c aᵏ b for k = 0, 1, 2: 4, 2, 1. */
const W = [0, 1, 2].map((k) => C * A ** k * B);
const YS = XS.map((_, t) => W.slice(0, t + 1).reduce((acc, w, k) => acc + w * XS[t - k]!, 0));

const mono = (s: Scene, t: string, x: number, y: number, k: Ink, size = 3.4, align: CanvasTextAlign = 'center', weight = 600) => s.text(t, x, y, { size, font: 'mono', weight, align, color: s.c(k), halo: true });
const Y = (s: Scene, f: number) => f * s.h;

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** A tanh recurrence as states and tanh boxes in a row: `lit(i)` fills state i, `on(t)` lights step t, `tanh` fades the boxes. */
function tanhChain(s: Scene, y: number, o: { lit: (i: number) => number; on: (t: number) => number; tanh?: number; hot?: number; inputs?: boolean }) {
  const gap = (s.tall ? 14 : 17) * s.u;
  const at = (j: number) => s.w / 2 + (j - 3) * gap;
  const tanhA = o.tanh ?? 1;
  const hot = o.hot ?? 0;
  for (let j = 0; j <= 6; j++) {
    const x = at(j);
    if (j % 2 === 0) {
      const i = j / 2;
      const l = o.lit(i);
      s.circle(x, y, 4 * s.u, { fill: s.tint('gold', 0.1 + 0.32 * l), stroke: s.tint('gold', 0.5 + 0.5 * l), lw: 0.35 });
      mono(s, `h${sub(i)}`, x, y + 0.2 * s.u, 'gold', 2.8);
      continue;
    }
    const t = (j + 1) / 2;
    const on = o.on(t);
    s.alpha(1 - tanhA, () => s.arrow(at(j - 1) + 4 * s.u, y, at(j + 1) - 4.4 * s.u, y, s.c('--ink-3'), 0.3, 1.4));
    s.alpha(tanhA, () => {
      s.arrow(at(j - 1) + 4 * s.u, y, x - 4.8 * s.u, y, s.c('--ink-3'), 0.3, 1.4);
      s.arrow(x + 4.8 * s.u, y, at(j + 1) - 4 * s.u, y, s.c('--ink-3'), 0.3, 1.4);
      const k: Ink = hot > 0.5 ? 'red' : 'blue';
      s.rrect(x - 4.6 * s.u, y - 3.4 * s.u, 9.2 * s.u, 6.8 * s.u, 1.2, { fill: s.tint(k, 0.1 + 0.35 * Math.max(on, 0.6 * hot)), stroke: s.tint(k, 0.5 + 0.5 * Math.max(on, hot)), lw: 0.3 + 0.2 * hot });
      mono(s, 'tanh', x, y + 0.2 * s.u, k, 2.6);
    });
    if (o.inputs !== false) {
      const iy = y + 11 * s.u;
      s.cell(x - 3.6 * s.u, iy - 2.8 * s.u, 7.2 * s.u, 5.6 * s.u, `x${sub(t)}`, 'orange', { on: on, size: 2.6 });
      s.arrow(x, iy - 3 * s.u, x, y + lerp(0.8, 3.8, tanhA) * s.u, s.tint('--ink-3', 0.8), 0.3, 1.3);
    }
  }
}

// ---- scene 1: a tanh recurrence runs one step at a time

const CHIP = { cols: 12, rows: 3 };

const wait: SceneDef = {
  draw(s) {
    const y = Y(s, 0.3);
    const p = s.prog('wait');
    const done = (i: number) => (i === 0 ? 1 : s.t >= s.at('wait') + (0.14 + 0.24 * (i - 1)) * (s.end('wait') - s.at('wait')) ? 1 : 0);
    const free = after(s, 'blame', 0.45, 0.8);
    const lit = (i: number) => Math.max(s.t < s.at('wait') ? (i === 0 ? 1 : 0) : done(i), free);
    const on = (t: number) => (p > 0 && p < 1 && done(t) && !done(t + 1) ? 1 : 0);
    s.alpha(s.ease('read', 0.7), () => {
      tanhChain(s, y, { lit, on: (t) => on(t) * (1 - free), tanh: 1 - free, hot: s.ease('blame', 0.5) });
    });
    const cap = Y(s, 0.48);
    s.alpha(s.win('wait', 'blame'), () => s.text('one step after another', s.w / 2, cap, { size: 3.4, color: s.c('--ink-2') }));
    s.alpha(after(s, 'wait', 0.7) * (1 - s.ease('idle', 0.5)), () => s.text('1,000 tokens: 1,000 steps in a row', s.w / 2, cap + 5.4 * s.u, { size: 3.1, color: s.c('--ink-3') }));
    s.alpha(after(s, 'blame', 0.05) * (1 - free), () => s.text('the tanh holds the line', s.w / 2, cap, { size: 3.4, color: s.c('red') }));
    s.alpha(free, () => s.text('no tanh: every state straight from the inputs', s.w / 2, cap, { size: 3.4, color: s.c('green') }));
    // The chip: many multipliers, one busy while the chain steps, all busy once the steps come apart.
    s.alpha(s.ease('idle', 0.7), () => {
      const cols = s.tall ? 10 : CHIP.cols;
      const cell = 3.6 * s.u;
      const pitch = 4.6 * s.u;
      const x0 = s.w / 2 - ((cols - 1) * pitch) / 2;
      const y0 = Y(s, 0.7);
      s.text('a chip\'s multipliers', s.w / 2, y0 - 5.4 * s.u, { size: 3.1, color: s.c('--ink-3') });
      const n = cols * CHIP.rows;
      const busy = Math.floor(Math.max(0, s.since('idle')) / 0.35) % n;
      for (let r = 0; r < CHIP.rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const one = i === busy ? 1 - free : 0;
          const on = Math.max(one, free);
          s.rrect(x0 + c * pitch - cell / 2, y0 + r * pitch - cell / 2, cell, cell, 0.6, { fill: s.tint('teal', 0.08 + 0.4 * on), stroke: s.tint('teal', 0.35 + 0.6 * on), lw: 0.25 });
        }
      }
      const yc = y0 + (CHIP.rows - 0.5) * pitch + 4.4 * s.u;
      s.alpha(1 - free, () => s.text('one at work, the rest idle', s.w / 2, yc, { size: 3.3, color: s.c('--ink-2') }));
      s.alpha(free, () => s.text('all at work, in parallel', s.w / 2, yc, { size: 3.3, color: s.c('teal') }));
      s.alpha(after(s, 'history', 0.6), () => s.text('up to 9× faster to train', s.w / 2, yc + 5.6 * s.u, { size: 3.3, weight: 650, color: s.c('teal') }));
    });
    cite(s, 'Martin & Cundy, 2018', s.ease('history', 0.6));
  },
};

// ---- scene 2: drop the tanh, name a, b and c, run three steps

const drop: SceneDef = {
  marks: {
    old: { tex: String.raw`\symh_t = \tanh(\symWhh\,\symh_{t-1} + \symWxh\,\symx_t + b)`, x: 0.5, y: 0.1, size: 4.6 },
    bare: { tex: String.raw`\symh_t = \symWhh\,\symh_{t-1} + \symWxh\,\symx_t`, x: 0.5, y: 0.1, size: 5 },
    withA: { tex: String.raw`\symh_t = \syma\,\symh_{t-1} + \symWxh\,\symx_t`, x: 0.5, y: 0.1, size: 5 },
    lin: { tex: String.raw`\symh_t = \syma\,\symh_{t-1} + \symb\,\symx_t`, x: 0.5, y: 0.1, size: 5 },
    out: { tex: String.raw`\symy_t = \symc\,\symh_t`, x: 0.5, y: 0.19, size: 4.6 },
  },
  draw(s) {
    const bare = after(s, 'one', 0.5, 0.6);
    s.show('old', s.ease('one', 0.6) * (1 - bare));
    s.show('bare', bare * (1 - s.ease('a', 0.5)));
    s.show('withA', s.ease('a', 0.5) * (1 - s.ease('b', 0.5)));
    s.show('lin', s.ease('b', 0.5));
    s.show('out', s.ease('c', 0.6));
    const named = s.ease('a', 0.6, 0.3);
    const nb = s.ease('b', 0.6, 0.3);
    const o = { size: 3.4, font: 'mono', weight: 600, halo: true } as const;
    s.alpha(named * (1 - s.ease('c', 0.5)), () => s.text('a: the decay', s.w / 2 - 3 * s.u, Y(s, 0.19), { ...o, align: 'right', color: s.c('teal') }));
    s.alpha(nb * (1 - s.ease('c', 0.5)), () => s.text('b: the input weight', s.w / 2 + 3 * s.u, Y(s, 0.19), { ...o, align: 'left', color: s.c('green') }));
    const nums = s.ease('h1', 0.6);
    s.alpha(nums, () => mono(s, `a = ${A}   b = ${B}   c = ${C}`, s.w / 2, Y(s, 0.27), '--ink-2', 3.4));
    // The chain: unlabeled weights, then a and b, then the numbers.
    const t1 = s.at('h1') + 0.55 * (s.end('h1') - s.at('h1'));
    const filled = (i: number) => (i === 0 ? s.t >= s.at('h1') : i === 1 ? s.t >= t1 : i === 2 ? s.t >= s.at('h2') + 0.5 : s.t >= s.at('h3') + 0.5);
    const step = s.t >= s.at('h3') ? 3 : s.t >= s.at('h2') ? 2 : s.t >= s.at('h1') ? 1 : -1;
    const g = chain(s, {
      y: Y(s, 0.48),
      n: 3,
      states: (i) => (filled(i) ? fmt(HS[i]!) : ''),
      inputs: s.t >= s.at('h1') ? XS.map(String) : ['', '', ''],
      decay: () => (nums > 0.5 ? `×${A}` : named > 0.5 ? '×a' : ''),
      gain: nums > 0.5 ? `×${B}` : nb > 0.5 ? '×b' : '',
      show: (i) => after(s, 'one', 0.55 + 0.08 * i, 0.6),
      hot: (i) => (i === step ? 1 : 0),
      thick: () => 1 + named * s.win('a', 'b'),
      decayInk: () => 'teal',
    });
    s.alpha(s.win('linear', 'c'), () => s.text('weights times numbers, added up: nothing bends the sum', s.w / 2, Y(s, 0.9), { size: 3.2, color: s.c('--ink-2'), halo: true }));
    // The output, read off the last state.
    s.alpha(s.ease('c', 0.6, 0.6), () => {
      const x = g.x(3);
      const yy = g.y - 20 * s.u;
      s.arrow(x, g.y - g.r - 5 * s.u, x, yy + 3.9 * s.u, s.tint('--ink-3', 0.75), 0.35, 1.6);
      s.cell(x - 5 * s.u, yy - 3.5 * s.u, 10 * s.u, 7 * s.u, s.t >= s.at('y') + 0.4 ? fmt(C * HS[3]!) : '', 'purple', { on: s.ease('y', 0.5, 0.4) * 0.6, size: 3.2 });
      mono(s, nums > 0.5 ? `×${C}` : '×c', x - 1.4 * s.u, yy + 6.2 * s.u, 'red', 3, 'right');
      mono(s, 'y₃', x + 6.4 * s.u, yy, 'purple', 3.2, 'left');
    });
    // The arithmetic of the step being taken.
    const line = (t: number) => `h${sub(t)} = ${A}·${fmt(HS[t - 1]!)} + ${B}·${XS[t - 1]} = ${fmt(HS[t]!)}`;
    const yl = Y(s, 0.9);
    s.alpha(after(s, 'h1', 0.5) * (1 - s.ease('h2', 0.3)), () => mono(s, line(1), s.w / 2, yl, '--ink', 3.6));
    s.alpha(s.ease('h2', 0.3) * (1 - s.ease('h3', 0.3)), () => mono(s, line(2), s.w / 2, yl, '--ink', 3.6));
    s.alpha(s.ease('h3', 0.3) * (1 - s.ease('y', 0.3)), () => mono(s, line(3), s.w / 2, yl, '--ink', 3.6));
    s.alpha(s.ease('y', 0.3), () => mono(s, `y₃ = ${C}·${fmt(HS[3]!)} = ${fmt(C * HS[3]!)}`, s.w / 2, yl, 'purple', 3.6));
  },
};

// ---- scene 3: the unrolled sum, then a turned from 0.5 to 1 to 2 to −0.5

/** Bars standing on `base`, `unit` stage units per 1, with labels above and below. */
function barRow(s: Scene, xs: number[], base: number, vals: number[], k: Ink, o: { unit: number; w: number; above?: (i: number) => string; below?: (i: number) => string; on?: (i: number) => number; size?: number }): void {
  s.line(xs[0]! - o.w * s.u, base, xs[xs.length - 1]! + o.w * s.u, base, s.c('--axis'), 0.3);
  xs.forEach((x, i) => {
    const h = Math.max(0.5, vals[i]! * o.unit) * s.u;
    const on = o.on?.(i) ?? 0;
    s.rrect(x - (o.w / 2) * s.u, base - h, o.w * s.u, h, 0.8, { fill: s.tint(k, 0.3 + 0.3 * on), stroke: s.tint(k, 0.7 + 0.3 * on), lw: 0.3 });
    if (o.above) mono(s, o.above(i), x, base - h - 2.8 * s.u, k, o.size ?? 3.2);
    if (o.below) mono(s, o.below(i), x, base + 3.2 * s.u, '--ink-3', o.size ?? 3);
  });
}

/** a over the scene: 0.5, turned to 1, then 2, then −0.5. */
function aAt(s: Scene): number {
  let a = A;
  a = lerp(a, 1, after(s, 'move', 0.05, 1.2));
  a = lerp(a, 2, after(s, 'move', 0.5, 1.2));
  a = lerp(a, -0.5, after(s, 'size', 0.6, 1.4));
  return a;
}

const MAX = 2.4;

const unroll: SceneDef = {
  marks: {
    open: { tex: String.raw`\symh_3 = \symb\,\symx_3 + \syma\symb\,\symx_2 + \syma^2\symb\,\symx_1`, x: 0.5, y: 0.08, size: 4.6 },
    wt: { tex: String.raw`\symx_{t-k} \text{ reaches } \symy_t \text{ times } \symc\,\syma^k\symb`, x: 0.5, y: 0.17, size: 4.4 },
    rule: { tex: String.raw`|\syma| < 1 \text{ fades},\quad |\syma| > 1 \text{ blows up}`, x: 0.5, y: 0.08, size: 4.4 },
  },
  draw(s) {
    const gone = s.ease('fade', 0.6);
    s.show('open', s.ease('open', 0.6) * (1 - gone));
    s.show('wt', s.ease('k', 0.6, 0.6) * (1 - gone));
    s.show('rule', s.ease('size', 0.6));
    const gap = s.tall ? 26 : 30;
    const xs = [-1, 0, 1].map((j) => s.w / 2 + j * gap * s.u);
    s.alpha(s.ease('open', 0.6) * (1 - gone), () => {
      const cy = Y(s, 0.36);
      const terms = ['a²b·x₁', 'ab·x₂', 'b·x₃'];
      const reads = ['c a² b', 'c a b', 'c b'];
      xs.forEach((x, j) => {
        s.cell(x - 5 * s.u, cy - 3.6 * s.u, 10 * s.u, 7.2 * s.u, String(XS[j]), 'orange', { on: 0.3, size: 3.4 });
        mono(s, `x${sub(j + 1)}`, x, cy - 6.4 * s.u, 'orange', 3);
        s.alpha(after(s, 'open', 0.4) * (1 - s.ease('k', 0.5)), () => mono(s, terms[j]!, x, cy + 7 * s.u, '--ink-2', 3.2));
        s.alpha(after(s, 'k', 0.7), () => mono(s, reads[j]!, x, cy + 7 * s.u, 'red', 3.2));
        s.alpha(after(s, 'k', 0.7), () => mono(s, `k = ${2 - j}`, x, cy + 11.6 * s.u, '--ink-3', 2.8));
      });
      s.alpha(s.ease('bars', 0.6), () => {
        const base = Y(s, 0.8);
        const show = (j: number) => after(s, 'bars', 0.05 + 0.13 * (2 - j), 0.5);
        barRow(s, xs, base, W.slice().reverse(), 'red', {
          unit: 4.5,
          w: 9,
          above: (j) => (show(j) > 0.5 ? `${W[2 - j]}` : ''),
          on: (j) => show(j),
        });
        s.alpha(after(s, 'bars', 0.45), () => mono(s, `${W[0]}·${XS[2]} + ${W[1]}·${XS[1]} + ${W[2]}·${XS[0]} = ${YS[2]}`, s.w / 2, Y(s, 0.9), 'purple', 3.6));
      });
    });
    // aᵏ for k = 5 .. 0, live as a turns.
    s.alpha(gone, () => {
      const a = aAt(s);
      const m = Math.abs(a);
      const [word, k]: [string, Ink] = m < 0.97 ? ['fades', 'teal'] : m <= 1.03 ? ['holds', 'gold'] : ['blows up', 'red'];
      const flip = a < -0.05;
      mono(s, `a = ${fmt(Math.round(a * 100) / 100, 2)}`, s.w / 2, Y(s, 0.17), k, 4, 'center', 650);
      mono(s, flip ? `${word}, flipping sign` : word, s.w / 2, Y(s, 0.235), k, 3.4);
      const pitch = (s.tall ? 13 : 15) * s.u;
      const base = Y(s, 0.7);
      const unit = 13 * s.u;
      const bw = 8 * s.u;
      const x0 = s.w / 2 - 2.5 * pitch;
      s.line(x0 - pitch * 0.6, base, x0 + 5.6 * pitch, base, s.c('--axis'), 0.3);
      for (let j = 0; j < 6; j++) {
        const kk = 5 - j;
        const v = a ** kk;
        const shown = Math.max(-MAX, Math.min(MAX, v));
        const x = x0 + j * pitch;
        const h = Math.max(0.4 * s.u, Math.abs(shown) * unit);
        const top = shown >= 0 ? base - h : base;
        s.rrect(x - bw / 2, top, bw, h, 0.7, { fill: s.tint(k, 0.35), stroke: s.tint(k, 0.85), lw: 0.3 });
        const lab = Math.abs(v) >= 10 ? String(Math.round(v)) : fmt(Math.round(v * 100) / 100);
        if (v > MAX) s.arrow(x, base - h - 0.6 * s.u, x, base - h - 3.2 * s.u, s.c(k), 0.3, 1.2);
        mono(s, lab, x, shown >= 0 ? base - h - (v > MAX ? 5.4 : 2.6) * s.u : base + h + 2.6 * s.u, k, 2.7);
        mono(s, String(kk), x, base + 13 * s.u, '--ink-3', 2.8);
      }
      s.text('steps back, k', s.w / 2, base + 18 * s.u, { size: 2.9, color: s.c('--ink-3') });
      mono(s, 'aᵏ', x0 - pitch * 0.6, base - 2.6 * s.u, '--ink-3', 3, 'right');
    });
  },
};

// ---- scene 4: one matrix gives every output; the tanh chain cannot

const parallel: SceneDef = {
  draw(s) {
    const u = s.u;
    // The weights, fixed before any input.
    const top = Y(s, 0.09);
    const wx = [-1, 0, 1].map((j) => s.w / 2 + j * 12 * u);
    s.alpha(s.ease('known', 0.6), () => {
      wx.forEach((x, j) => {
        s.cell(x - 4.5 * u, top - 3.4 * u, 9 * u, 6.8 * u, String(W[2 - j]), 'red', { on: 0.4, size: 3.2 });
        mono(s, `k = ${2 - j}`, x, top + 6.4 * u, '--ink-3', 2.7);
      });
      s.text('set by a, b and c alone: known before any input', s.w / 2, Y(s, 0.23), { size: 3.2, color: s.c('--ink-2'), halo: true });
    });
    // y = W x, one row per output.
    const dim = 1 - 0.5 * s.ease('tanh', 0.6);
    s.alpha(s.ease('rows', 0.6) * dim, () => {
      const cy = Y(s, 0.45);
      const cw = (s.tall ? 9 : 10) * u;
      const ch = 7.6 * u;
      const mx = s.w / 2 - (s.tall ? 12 : 14) * u;
      const row = (i: number) => after(s, 'rows', 0.05 + 0.12 * i, 0.5);
      const all = after(s, 'all', 0.35, 0.6);
      const focus = s.win('rows', 'all') * (s.t > s.at('rows') + 0.42 * (s.end('rows') - s.at('rows')) ? 1 : 0);
      for (let i = 0; i < 3; i++) {
        s.alpha(row(i), () => {
          for (let j = 0; j < 3; j++) {
            const v = i >= j ? W[i - j]! : 0;
            const hi = i === 1 ? focus : 0;
            s.cell(mx + (j - 1.5) * cw + 0.4 * u, cy + (i - 1.5) * ch + 0.4 * u, cw - 0.8 * u, ch - 0.8 * u, String(v), i >= j ? 'red' : '--ink-3', { on: 0.2 + 0.6 * hi + 0.3 * all, size: 3.2 });
          }
        });
      }
      const xx = mx + 2.6 * cw;
      const yx = xx + 2.4 * cw;
      for (let i = 0; i < 3; i++) {
        s.cell(xx - cw / 2 + 0.4 * u, cy + (i - 1.5) * ch + 0.4 * u, cw - 0.8 * u, ch - 0.8 * u, String(XS[i]), 'orange', { on: 0.2 + 0.5 * focus, size: 3.2 });
        const shown = i === 1 ? Math.max(after(s, 'rows', 0.8, 0.4), all) : all;
        s.alpha(Math.max(0.35, shown), () => s.cell(yx - cw / 2 + 0.4 * u, cy + (i - 1.5) * ch + 0.4 * u, cw - 0.8 * u, ch - 0.8 * u, shown > 0.5 ? String(YS[i]) : '', 'purple', { on: shown * (i === 1 ? 0.6 : all), size: 3.2 }));
      }
      mono(s, '=', (xx + yx) / 2, cy, '--ink-3', 4);
      const head = cy - 1.5 * ch - 3 * u;
      mono(s, 'weights', mx, head, 'red', 3.2);
      mono(s, 'x', xx, head, 'orange', 3.2);
      mono(s, 'y', yx, head, 'purple', 3.2);
      const below = cy + 1.5 * ch + 5 * u;
      s.alpha(after(s, 'rows', 0.45) * (1 - s.ease('all', 0.4)), () => mono(s, 'y₂ = 4·1 + 2·3 = 10', s.w / 2, below, 'purple', 3.6));
      s.alpha(all, () => s.text('every output at once', s.w / 2, below, { size: 3.4, color: s.c('purple') }));
    });
    // The tanh chain, for contrast.
    s.alpha(s.ease('tanh', 0.6), () => {
      const y = Y(s, 0.8);
      const per = 0.7;
      const k = Math.floor(Math.max(0, s.since('tanh') - 0.4) / per);
      const cur = (k % 4) as number;
      tanhChain(s, y, { lit: (i) => (i <= cur ? 1 : 0), on: (t) => (t === cur ? 1 : 0), inputs: false });
      s.text('tanh: one step at a time', s.w / 2, y + 8.4 * u, { size: 3.3, color: s.c('blue') });
    });
  },
};

export const scenes: Record<string, SceneDef> = { wait, drop, unroll, parallel };

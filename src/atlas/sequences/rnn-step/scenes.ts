import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { after, cite } from '../../draw';
import { grid, matrix } from '../../linear-algebra/draw';
import { box, chip, fmt, stack } from '../draw';

const H0 = [0.5, -0.5];
const X = [0, 1];
const WHH = [
  [1, 0],
  [0, 2],
];
const WXH = [
  [1, 2],
  [0, 1],
];
const B = [-1.5, -0.5];
const mv = (M: number[][], v: number[]) => M.map((r) => r.reduce((t, a, j) => t + a * v[j]!, 0));
const MEM = mv(WHH, H0);
const INP = mv(WXH, X);
const Z = MEM.map((v, i) => v + INP[i]! + B[i]!);
const HT = Z.map(Math.tanh);
const lab = (xs: number[], p?: number) => xs.map((v) => fmt(v, p));

/** Each word's embedding for the two orders the loop scene reads, through the step's own weights. */
const EMB: Record<string, number[]> = { dog: [1, 0], cat: [0, 1], chases: [0.5, 0.5] };
function read(words: string[]): number[] {
  let h = [0, 0];
  for (const w of words) {
    const a = mv(WHH, h);
    const c = mv(WXH, EMB[w]!);
    h = a.map((v, i) => Math.tanh(v + c[i]! + B[i]!));
  }
  return h;
}
const vec2 = (v: number[]) => `[${v.map((x) => fmt(Math.round(x * 100) / 100, 2)).join(', ')}]`;
const DOG_FIRST = vec2(read(['dog', 'chases', 'cat']));
const CAT_FIRST = vec2(read(['cat', 'chases', 'dog']));

const mono = (s: Scene, t: string, x: number, y: number, k: Ink, size = 3.4, weight = 600) =>
  s.text(t, x, y, { size, font: 'mono', weight, color: s.c(k), halo: true });

const caption = (s: Scene, text: string, k: Ink, a: number, y = 0.9) => s.alpha(a, () => mono(s, text, s.w / 2, s.h * y, k, 3.4, 500));

/** Chip widths, so "chases" fits. */
const cw = (w: string) => (w.length > 4 ? 16 : 11);

/** The unrolled chain: memories in gold circles, one step box per token, tokens under the boxes. */
function chain(s: Scene, y: number, words: string[], o: { shown: (i: number) => number; label: string; same: number; mem: number; zero?: number; swap?: number }) {
  const u = s.u;
  const hx = [-42, -14, 14, 42].map((d) => s.w / 2 + d * u);
  const bx = [-28, 0, 28].map((d) => s.w / 2 + d * u);
  const r = 4.4 * u;
  const ty = y + 20 * u;
  hx.forEach((x, i) =>
    s.alpha(o.shown(i), () => {
      s.circle(x, y, r, { fill: s.tint('gold', 0.14 + 0.25 * o.mem), stroke: s.tint('gold', 0.7 + 0.3 * o.mem), lw: 0.35 });
      s.text(`h${'₀₁₂₃'[i]}`, x, y + 0.2 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c('gold') });
    }),
  );
  s.alpha(o.shown(0) * (o.zero ?? 1), () => mono(s, 'zeros', hx[0]!, y - r - 3 * u, '--ink-3', 2.8, 500));
  bx.forEach((x, i) =>
    s.alpha(o.shown(i + 1), () => {
      box(s, x, y, o.label, 'blue', { w: 10, h: 8, size: 3, on: o.same });
      const k = s.c(o.mem > 0.1 ? 'gold' : '--ink-3');
      s.arrow(hx[i]! + r, y, x - 5 * u, y, k, 0.35 + 0.2 * o.mem, 1.8);
      s.arrow(x + 5 * u, y, hx[i + 1]! - r, y, k, 0.35 + 0.2 * o.mem, 1.8);
      s.arrow(x, ty - 3.5 * u, x, y + 4 * u, s.c('--ink-3'), 0.35, 1.8);
      // The two end words trade places as `swap` runs 0 -> 1, one arcing over the other.
      const sw = i === 1 ? 0 : (o.swap ?? 0);
      const w = words[i]!;
      const lift = Math.sin(sw * Math.PI) * (i === 0 ? -5 : 5) * u;
      chip(s, lerp(x, bx[2 - i]!, sw), ty + lift, w, 'orange', { w: cw(w), h: 6.5, size: 3 });
    }),
  );
  return { hx, bx, ty };
}

// ---- scene 1: why a network that reads text needs a memory

const S1 = ['dog', 'chases', 'cat'];
const S2 = ['cat', 'chases', 'dog'];

const readScene: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    // The two sentences, then the first one dropping into fixed slots.
    const rowXs = [-20, 0, 20];
    const slotXs = [-24, -4, 16];
    const y1 = s.h * 0.3;
    const y2 = s.h * 0.46;
    const ySlot = s.h * 0.64;
    const toSlots = s.ease('slots', 1);
    const slotsOut = 1 - s.ease('copy', 0.6);
    s.alpha(s.ease('order', 0.6, 0.2) * slotsOut, () => {
      S1.forEach((w, i) => chip(s, cx + lerp(rowXs[i]!, slotXs[i]!, toSlots) * u, lerp(y1, ySlot, toSlots), w, 'orange', { w: cw(w), size: 3.2, on: i !== 1 ? s.win('order', 'slots') * 0.6 : 0 }));
    });
    s.alpha(after(s, 'order', 0.3) * (1 - s.ease('slots', 0.5)), () => {
      S2.forEach((w, i) => chip(s, cx + rowXs[i]! * u, y2, w, 'orange', { w: cw(w), size: 3.2, on: i !== 1 ? 0.6 : 0 }));
    });
    // The slots, and the two-layer network that reads them all at once.
    const yNet = s.h * 0.3;
    s.alpha(s.ease('slots', 0.8, 0.8) * slotsOut * (1 - 0.6 * s.ease('elman', 0.8)), () => {
      slotXs.forEach((d, i) => {
        const x = cx + d * u;
        s.rrect(x - 9.5 * u, ySlot - 5.5 * u, 19 * u, 11 * u, 1.6, { stroke: s.c('--ink-3'), lw: 0.3 });
        s.text(`slot ${i + 1}`, x, ySlot + 8.5 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
        s.arrow(x, ySlot - 5.5 * u, x, yNet + 5.5 * u, s.c('--ink-3'), 0.35, 1.8);
      });
      box(s, cx - 4 * u, yNet, 'two-layer network', '--ink-2', { w: 60, h: 11, size: 3.2 });
    });
    // A fourth word with no slot.
    s.alpha(s.ease('fixed', 0.6, 1.2) * slotsOut * (1 - 0.6 * s.ease('elman', 0.8)), () => {
      const x = cx + 36 * u;
      chip(s, x, ySlot, 'today', 'red', { w: 13, size: 3.2, on: 0.5 });
      s.text('no slot', x, ySlot + 8.5 * u, { size: 2.8, font: 'mono', weight: 600, color: s.c('red') });
    });

    // One step with its output copied back in: the loop.
    const loop = s.win('copy', 'chain');
    s.alpha(loop, () => {
      const y = s.h * 0.46;
      const bx = cx - 6 * u;
      const hx = cx + 20 * u;
      const r = 4.4 * u;
      box(s, bx, y, 'step', 'blue', { w: 12, h: 9, size: 3.2 });
      chip(s, bx, y + 22 * u, 'dog', 'orange', { w: 11, h: 6.5, size: 3 });
      s.arrow(bx, y + 18.5 * u, bx, y + 4.5 * u, s.c('--ink-3'), 0.35, 1.8);
      s.arrow(bx + 6 * u, y, hx - r, y, s.c('gold'), 0.45, 1.8);
      s.circle(hx, y, r, { fill: s.tint('gold', 0.2), stroke: s.c('gold'), lw: 0.35 });
      s.text('h', hx, y + 0.2 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('gold') });
      // The copy back: up from h, across, and down into the step.
      s.alpha(after(s, 'copy', 0.3), () => {
        const top = y - 15 * u;
        s.line(hx, y - r, hx, top, s.c('gold'), 0.45);
        s.line(hx, top, bx, top, s.c('gold'), 0.45);
        s.arrow(bx, top, bx, y - 4.5 * u, s.c('gold'), 0.45, 1.8);
        mono(s, 'copied back', (bx + hx) / 2, top - 3.5 * u, 'gold', 3, 600);
      });
    });

    // The loop drawn out in a row: the chain of memories.
    const yc = s.h * 0.4;
    s.alpha(s.ease('chain', 0.6), () =>
      chain(s, yc, S1, {
        shown: (i) => (i === 0 ? 1 : s.ease('chain', 0.5, 0.6 + 0.7 * (i - 1))),
        label: 'step',
        same: s.win('name'),
        mem: s.win('chain', 'name'),
      }),
    );

    caption(s, 'same words, another order', '--ink-2', s.win('order', 'slots') * after(s, 'order', 0.4));
    caption(s, 'one slot per position, all at once', '--ink-2', s.win('slots', 'fixed') * after(s, 'slots', 0.5));
    caption(s, 'a fixed size: built for the longest', 'red', s.win('fixed', 'elman'));
    caption(s, 'h goes back in with the next token', 'gold', s.win('copy', 'chain') * after(s, 'copy', 0.4));
    caption(s, 'h: the hidden state, the memory', 'gold', s.win('chain', 'name') * after(s, 'chain', 0.3));
    caption(s, 'the same step recurs at every token', 'blue', s.ease('name', 0.6));
    cite(s, 'Elman, 1990 · Finding Structure in Time', s.win('elman', 'chain'));
  },
};

// ---- scene 2: one step, in numbers

/** One matrix-vector product as a row: label, matrix, vector, "=", result. */
function product(s: Scene, y: number, name: string, M: number[][], v: number[], vk: 'gold' | 'orange', vName: string, res: number[], o: { a: number; on: number; res: number }): void {
  s.alpha(o.a, () => {
    const g = grid(s, s.w / 2 - 22 * s.u, y, 2, 2, 12, 9);
    s.text(name, g.l - 3 * s.u, y, { size: 3.8, font: 'mono', weight: 650, align: 'right', color: s.c('blue') });
    matrix(s, g, M.map((r) => lab(r)), 'blue', { w: 10.5, h: 7.5, size: 3.2, on: () => o.on });
    stack(s, s.w / 2 + 2 * s.u, y, lab(v), vk, { gap: 9, on: v.map(() => o.on) });
    s.text(vName, s.w / 2 + 2 * s.u, y - 10.5 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c(vk) });
    s.alpha(o.res, () => {
      s.text('=', s.w / 2 + 12 * s.u, y, { size: 4.4, font: 'mono', color: s.c('--ink-3') });
      stack(s, s.w / 2 + 23 * s.u, y, lab(res), 'blue', { gap: 9, on: res.map(() => o.on) });
    });
  });
}

const step: SceneDef = {
  marks: {
    f: { tex: String.raw`\symh_t = \tanh(\symWhh\symh_{t-1} + \symWxh\symx_t + \symb)`, x: 0.5, y: 0.08, size: 4.6 },
  },
  draw(s) {
    s.show('f', s.ease('line', 0.6));
    const u = s.u;
    const y1 = s.h * 0.3;
    const y2 = s.h * 0.53;
    // Before the products: the memory and the token, side by side.
    s.alpha(1 - s.ease('Whh', 0.5), () => {
      const xs = [s.w / 2 - 14 * u, s.w / 2 + 14 * u];
      const y = s.h * 0.42;
      stack(s, xs[0]!, y, lab(H0), 'gold', { gap: 9, on: [s.win('t', 'x'), s.win('t', 'x')] });
      mono(s, 'hₜ₋₁', xs[0]!, y - 10.5 * u, 'gold');
      mono(s, 'memory', xs[0]!, y + 11 * u, '--ink-3', 3, 500);
      s.alpha(s.ease('x', 0.6, 0.4), () => {
        stack(s, xs[1]!, y, lab(X), 'orange', { gap: 9, on: [s.win('x', 'Whh'), s.win('x', 'Whh')] });
        mono(s, 'xₜ', xs[1]!, y - 10.5 * u, 'orange');
        mono(s, 'token t', xs[1]!, y + 11 * u, '--ink-3', 3, 500);
      });
    });
    product(s, y1, 'Whh', WHH, H0, 'gold', 'hₜ₋₁', MEM, { a: s.ease('Whh', 0.6), on: s.win('Whh', 'Wxh'), res: after(s, 'mem', 0.55) });
    product(s, y2, 'Wxh', WXH, X, 'orange', 'xₜ', INP, { a: s.ease('Wxh', 0.6), on: s.win('Wxh', 'b'), res: after(s, 'Wxh', 0.6) });
    // The sum line: Whh h + Wxh x + b = z, then tanh.
    const ys = s.h * 0.82;
    const at = (dx: number) => s.w / 2 + dx * u;
    const top = ys - 10.5 * u;
    const name = (t: string, dx: number, k: Ink) => s.text(t, at(dx), top, { size: 3.2, font: 'mono', weight: 600, color: s.c(k) });
    const op = (t: string, dx: number) => s.text(t, at(dx), ys, { size: 4.2, font: 'mono', color: s.c('--ink-3') });
    s.alpha(s.ease('b', 0.6), () => {
      stack(s, at(-42), ys, lab(MEM), 'blue', { gap: 9 });
      name('Whh h', -42, 'blue');
      op('+', -33);
      stack(s, at(-24), ys, lab(INP), 'blue', { gap: 9 });
      name('Wxh x', -24, 'blue');
      op('+', -15);
    });
    s.alpha(after(s, 'b', 0.35), () => {
      stack(s, at(-6), ys, lab(B), 'green', { gap: 9, on: [s.win('b', 'z'), s.win('b', 'z')] });
      name('b', -6, 'green');
    });
    s.alpha(s.ease('z', 0.6, 0.3), () => {
      op('=', 4);
      stack(s, at(14), ys, lab(Z), '--ink-2', { gap: 9, on: [s.win('z', 'tanh'), s.win('z', 'tanh')] });
      name('z', 14, '--ink-2');
    });
    s.alpha(s.ease('tanh', 0.6), () => {
      s.arrow(at(21), ys, at(32), ys, s.c('--ink-3'), 0.4, 2);
      s.text('tanh', at(26.5), ys - 4 * u, { size: 3, font: 'mono', color: s.c('--ink-2') });
    });
    s.alpha(after(s, 'tanh', 0.45), () => {
      stack(s, at(41), ys, lab(HT, 2), 'gold', { gap: 9, on: [1, 1] });
      name('hₜ', 41, 'gold');
    });
    // Why squash: the second entry doubles at every pass through Whh.
    s.alpha(s.win('why', 'line'), () => {
      s.alpha(after(s, 'why', 0.25), () => mono(s, 'no squash: −0.5 → −1 → −2 → −4 → …', s.w / 2, s.h * 0.07, 'red', 3.2, 600));
      s.alpha(after(s, 'why', 0.7), () => mono(s, 'tanh: every entry in (−1, 1)', s.w / 2, s.h * 0.14, 'gold', 3.2, 600));
    });
  },
};

// ---- scene 3: the loop, with one set of weights

const loopScene: SceneDef = {
  draw(s) {
    const u = s.u;
    const y = s.h * 0.36;
    const shown = (i: number) => (i === 0 ? 1 : s.ease('loop', 0.5, 1 + 1.1 * (i - 1)));
    const same = s.win('same', 'order');
    const c = chain(s, y, S1, {
      shown,
      label: 'tanh',
      same,
      mem: s.win('loop', 'first'),
      zero: 1,
      swap: after(s, 'order', 0.45, 1),
    });
    // The first step: h0 is all zeros, so only the token counts.
    s.alpha(s.win('first', 'same'), () => {
      s.circle(c.hx[0]!, y, 6.2 * u, { stroke: s.c('gold'), lw: 0.45 });
      mono(s, 'Whh · h₀ = 0', s.w / 2, s.h * 0.78, 'blue', 3.4);
    });
    s.alpha(same, () => c.bx.forEach((x) => mono(s, 'Whh Wxh b', x, y - 9 * u, 'blue', 2.7, 600)));
    s.alpha(s.win('same', 'order') * after(s, 'same', 0.3), () => mono(s, 'the same weights at every step', s.w / 2, s.h * 0.78, 'blue', 3.4, 500));
    // Two orders, two final memories.
    s.alpha(s.win('order', 'H'), () => {
      const o = (t: string, v: string, yy: number, k: Ink) => mono(s, `${t}  →  h₃ = ${v}`, s.w / 2, yy, k, 3.2, 600);
      s.alpha(after(s, 'order', 0.2), () => o('dog chases cat', DOG_FIRST, s.h * 0.74, 'gold'));
      s.alpha(after(s, 'order', 0.7), () => o('cat chases dog', CAT_FIRST, s.h * 0.82, 'gold'));
    });
    // The shapes, one per beat.
    const sh = { size: 3.4, font: 'mono', weight: 600, halo: true } as const;
    s.alpha(s.ease('H', 0.6), () => s.text('Whh: (H, H)', s.w / 2, s.h * 0.72, { ...sh, color: s.c('blue') }));
    s.alpha(s.ease('D', 0.6), () => s.text('Wxh: (H, D)', s.w / 2, s.h * 0.8, { ...sh, color: s.c('blue') }));
    s.alpha(s.ease('bias', 0.6), () => s.text('b: (H,)   h: (H,)', s.w / 2, s.h * 0.88, { ...sh, color: s.c('green') }));
  },
};

export const scenes: Record<string, SceneDef> = { read: readScene, step, loop: loopScene };

import type { Color } from '../../../core/symbols';
import { type Scene, type SceneDef, lerp, smooth } from '../../../lecture/scene';
import { caption } from '../../networks/draw';

// Colors follow the concept's symbols: cell teal, f red, i green, g gold, o purple; h gold, x orange.
const CELL: Color = 'teal';
const H: Color = 'gold';
const GRAD: Color = 'red';

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** A small operator node on a wire: × or +. */
function op(s: Scene, x: number, y: number, t: string, k: Color | '--ink-2' = '--ink-2'): void {
  s.circle(x, y, 2.8 * s.u, { fill: s.c('--card'), stroke: s.tint('slate', 0.9), lw: 0.35 });
  s.text(t, x, y + 0.2 * s.u, { size: 3.4, font: 'mono', weight: 700, color: s.c(k) });
}

/** A gate (or the candidate) as a labelled circle, lit by `on`. */
function gate(s: Scene, x: number, y: number, t: string, k: Color, on: number): void {
  s.circle(x, y, 4.4 * s.u, { fill: s.tint(k, 0.14 + 0.3 * on), stroke: s.tint(k, 0.7 + 0.3 * on), lw: 0.35 + 0.2 * on });
  s.text(t, x, y + 0.2 * s.u, { size: 3.6, font: 'mono', weight: 700, color: s.c(k) });
}

// ---- 1. Memories that fade -------------------------------------------------------------

const N = 5;
const RNN_G = [0.0625, 0.125, 0.25, 0.5, 1];
const fmtG = (v: number) => (v >= 0.25 ? String(v) : v.toFixed(2));

const fade: SceneDef = {
  draw(s) {
    const gap = Math.min(20, (s.w / s.u - 18) / N);
    const xs = Array.from({ length: N }, (_, i) => s.w / 2 + (i - (N - 1) / 2) * gap * s.u);
    const yC = 21 * s.u;
    const yH = 44 * s.u;
    const yB = 84 * s.u;
    const barH = 18 * s.u;
    const cell = s.ease('cell', 0.8);
    // The plain RNN's chain of hidden states.
    xs.forEach((x, i) => {
      if (i > 0) s.arrow(xs[i - 1]! + 4.2 * s.u, yH, x - 4.2 * s.u, yH, s.tint(H, 0.7), 0.35, 1.6);
      s.circle(x, yH, 4 * s.u, { fill: s.tint(H, 0.14), stroke: s.tint(H, 0.8), lw: 0.35 });
      s.text(`h${'₁₂₃₄₅'[i]}`, x, yH + 0.2 * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c(H) });
    });
    s.text('loss here', xs[N - 1]!, yH - 7.5 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
    // Backprop through time: each step back multiplies by Whh times a tanh slope, here 0.5.
    const back = s.ease('back', 0.6);
    for (let i = 0; i < N - 1; i++) {
      s.alpha(s.ease('back', 0.5, 0.5 + 0.45 * (N - 2 - i)), () => {
        s.arrow(xs[i + 1]! - 4 * s.u, yH + 8 * s.u, xs[i]! + 4 * s.u, yH + 8 * s.u, s.c(GRAD), 0.4, 1.8);
        const lab = s.ease('fade', 0.5) > 0.5 ? '× 0.5' : '× Whh·tanh′';
        s.text(lab, (xs[i]! + xs[i + 1]!) / 2, yH + 11.5 * s.u, { size: s.tall ? 2.3 : 2.6, font: 'mono', weight: 600, color: s.c(GRAD), halo: true });
      });
    }
    // What reaches each step: through h it halves every step back; along c it stays whole.
    s.alpha(s.ease('fade', 0.6), () => s.line(xs[0]! - 6 * s.u, yB, xs[N - 1]! + 6 * s.u, yB, s.c('--axis'), 0.3));
    xs.forEach((x, i) => {
      const grow = s.ease('fade', 0.6, 0.5 + 0.6 * (N - 1 - i));
      const v = RNN_G[i]! * grow;
      s.alpha(grow, () => {
        s.rrect(x - 4.6 * s.u, yB - barH * v, 4 * s.u, barH * v, 0.5, { fill: s.tint(H, 0.45), stroke: s.c(H), lw: 0.25 });
        s.text('h', x - 2.6 * s.u, yB + 3 * s.u, { size: 2.6, font: 'mono', color: s.c(H) });
        s.text(fmtG(RNN_G[i]!), x - 0.6 * s.u, yB - barH * v - 2.6 * s.u, { size: 2.5, font: 'mono', weight: 600, align: 'right', color: s.c(H), halo: true });
      });
      s.alpha(s.ease('add', 0.6, 1.2), () => {
        s.rrect(x + 0.6 * s.u, yB - barH, 4 * s.u, barH, 0.5, { fill: s.tint(CELL, 0.45), stroke: s.c(CELL), lw: 0.25 });
        s.text('c', x + 2.6 * s.u, yB + 3 * s.u, { size: 2.6, font: 'mono', color: s.c(CELL) });
        s.text('1', x + 0.6 * s.u, yB - barH - 2.6 * s.u, { size: 2.5, font: 'mono', weight: 600, align: 'left', color: s.c(CELL), halo: true });
      });
    });
    // The cell: a straight line through every step, where each step only adds.
    s.alpha(cell, () => {
      s.line(xs[0]! - 8 * s.u, yC, xs[0]! - 8 * s.u + (xs[N - 1]! - xs[0]! + 16 * s.u) * s.ease('cell', 1.4), yC, s.c(CELL), 0.6);
      s.text('c', xs[0]! - 10 * s.u, yC, { size: 3.4, font: 'mono', weight: 700, align: 'right', color: s.c(CELL) });
      xs.forEach((x, i) =>
        s.alpha(s.ease('cell', 0.5, 0.6 + 0.3 * i), () => {
          s.arrow(x, yC + 9 * s.u, x, yC + 3 * s.u, s.tint('--ink-3', 0.9), 0.3, 1.4);
          op(s, x, yC, '+', CELL);
        }),
      );
    });
    for (let i = 0; i < N - 1; i++) {
      s.alpha(s.ease('add', 0.5, 0.4 + 0.35 * (N - 2 - i)), () => {
        s.arrow(xs[i + 1]! - 3.4 * s.u, yC - 6 * s.u, xs[i]! + 3.4 * s.u, yC - 6 * s.u, s.c(GRAD), 0.4, 1.8);
        s.text('× 1', (xs[i]! + xs[i + 1]!) / 2, yC - 9.5 * s.u, { size: 2.6, font: 'mono', weight: 600, color: s.c(GRAD), halo: true });
      });
    }
    cite(s, 'Hochreiter, 1991 · Hochreiter & Schmidhuber, 1997', s.win('hochreiter', 'cell'));
    cite(s, 'Hochreiter & Schmidhuber, 1997', s.ease('name', 0.6));
    const cy = 94 * s.u;
    s.alpha(s.win('back', 'fade'), () => caption(s, 'backprop through time', cy, GRAD, 3.4));
    s.alpha(s.win('fade', 'cell'), () => caption(s, 'ten steps back: 0.5¹⁰ ≈ 0.001', cy, H, 3.4));
    s.alpha(s.win('cell', 'add'), () => caption(s, 'new c = old c + something new', cy, CELL, 3.4));
    s.alpha(s.win('add', 'name'), () => caption(s, 'add gate: the gradient passes unchanged', cy, CELL, s.tall ? 3.1 : 3.4));
    s.alpha(s.ease('name', 0.6), () => caption(s, 'long short-term memory: LSTM', cy, CELL, 3.6));
  },
};

// ---- The cell diagram, shared by scenes 2 and 3 --------------------------------------

function layout(s: Scene) {
  const x = (d: number) => s.w / 2 + d * s.u;
  return { yc: s.h * 0.2, xL: x(-50), xR: x(50), xf: x(-30), xp: x(-3), xo: x(33), fy: s.h * 0.48, ig: s.h * 0.38, gy: s.h * 0.58, th: s.h * 0.4, oy: s.h * 0.6, hy: s.h * 0.82, bus: s.h * 0.9 };
}

type Part = 'f' | 'i' | 'g' | 'o' | 'cell' | 'bus';
interface Vals {
  c0?: string;
  f?: string;
  fc?: string;
  i?: string;
  g?: string;
  ig?: string;
  c?: string;
  tc?: string;
  o?: string;
  h?: string;
}

/** The cell wire along the top, the gates below it, the output branch on the right. `a` fades parts in; `on` lights them. */
function diagram(s: Scene, o: { a?: Partial<Record<Part, number>>; on?: Partial<Record<Part, number>>; vals?: Vals; va?: Partial<Record<keyof Vals, number>> } = {}): void {
  const L = layout(s);
  const a = { f: 1, i: 1, g: 1, o: 1, cell: 1, bus: 1, ...o.a };
  const on = o.on ?? {};
  const wire = s.tint(CELL, 0.6 + 0.4 * (on.cell ?? 0));
  const lw = 0.5 + 0.3 * (on.cell ?? 0);
  const ink = s.tint('slate', 0.6);
  const ox = L.xo + 11 * s.u;
  s.alpha(a.cell, () => {
    // Where the forget gate is absent, the wire runs straight through its spot.
    s.line(L.xL, L.yc, L.xp - 2.8 * s.u, L.yc, wire, lw);
    s.arrow(L.xp + 2.8 * s.u, L.yc, L.xR, L.yc, wire, lw, 2.2);
    s.text('cₜ₋₁', L.xL, L.yc - 4.5 * s.u, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c(CELL) });
    s.text('cₜ', L.xR, L.yc - 4.5 * s.u, { size: 3.2, font: 'mono', weight: 650, align: 'right', color: s.c(CELL) });
    op(s, L.xp, L.yc, '+', CELL);
  });
  s.alpha(a.bus, () => {
    s.line(L.xf, L.bus, ox, L.bus, ink, 0.35);
    s.text('hₜ₋₁, xₜ', L.xf - 3 * s.u, L.bus, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-2') });
  });
  s.alpha(Math.min(a.f, a.bus), () => s.arrow(L.xf, L.bus, L.xf, L.fy + 4.4 * s.u, ink, 0.35, 1.6));
  s.alpha(Math.min(a.i, a.bus), () => s.arrow(L.xp - 10 * s.u, L.bus, L.xp - 10 * s.u, L.gy + 4.4 * s.u, ink, 0.35, 1.6));
  s.alpha(Math.min(a.g, a.bus), () => s.arrow(L.xp + 10 * s.u, L.bus, L.xp + 10 * s.u, L.gy + 4.4 * s.u, ink, 0.35, 1.6));
  s.alpha(Math.min(a.o, a.bus), () => s.arrow(ox, L.bus, ox, L.oy + 4.4 * s.u, ink, 0.35, 1.6));
  // Forget: f scales the old cell.
  s.alpha(a.f, () => {
    s.arrow(L.xf, L.fy - 4.4 * s.u, L.xf, L.yc + 2.8 * s.u, s.tint('red', 0.8), 0.4, 1.8);
    op(s, L.xf, L.yc, '×', 'red');
    gate(s, L.xf, L.fy, 'f', 'red', on.f ?? 0);
  });
  // Write: i times g, added to the cell.
  s.alpha(Math.min(a.i, a.g), () => {
    s.arrow(L.xp, L.ig - 2.8 * s.u, L.xp, L.yc + 2.8 * s.u, s.tint('green', 0.8), 0.4, 1.8);
    op(s, L.xp, L.ig, '×');
  });
  s.alpha(a.i, () => {
    s.arrow(L.xp - 10 * s.u, L.gy - 4.4 * s.u, L.xp - 2.2 * s.u, L.ig + 2.2 * s.u, s.tint('green', 0.8), 0.4, 1.6);
    gate(s, L.xp - 10 * s.u, L.gy, 'i', 'green', on.i ?? 0);
  });
  s.alpha(a.g, () => {
    s.arrow(L.xp + 10 * s.u, L.gy - 4.4 * s.u, L.xp + 2.2 * s.u, L.ig + 2.2 * s.u, s.tint('gold', 0.8), 0.4, 1.6);
    gate(s, L.xp + 10 * s.u, L.gy, 'g', 'gold', on.g ?? 0);
  });
  // Show: o times tanh of the new cell gives h.
  s.alpha(a.o, () => {
    s.arrow(L.xo, L.yc, L.xo, L.th - 3.5 * s.u, s.tint(CELL, 0.7), 0.4, 1.8);
    s.rrect(L.xo - 6 * s.u, L.th - 3.5 * s.u, 12 * s.u, 7 * s.u, 1.4, { fill: s.c('--card'), stroke: s.tint('slate', 0.9), lw: 0.35 });
    s.text('tanh', L.xo, L.th + 0.2 * s.u, { size: 2.9, font: 'mono', color: s.c('--ink-2') });
    s.arrow(L.xo, L.th + 3.5 * s.u, L.xo, L.oy - 2.8 * s.u, s.tint('slate', 0.8), 0.4, 1.6);
    s.arrow(ox - 4.4 * s.u, L.oy, L.xo + 2.8 * s.u, L.oy, s.tint('purple', 0.8), 0.4, 1.6);
    op(s, L.xo, L.oy, '×');
    gate(s, ox, L.oy, 'o', 'purple', on.o ?? 0);
    s.arrow(L.xo, L.oy + 2.8 * s.u, L.xo, L.hy - 3 * s.u, s.tint(H, 0.8), 0.45, 1.8);
    s.text('hₜ', L.xo, L.hy, { size: 3.4, font: 'mono', weight: 700, color: s.c(H) });
  });
  // Values, when a step is worked in numbers.
  const v = o.vals ?? {};
  const va = o.va ?? {};
  const num = (key: keyof Vals, x: number, y: number, k: Color | `--${string}`, align: CanvasTextAlign = 'center') => {
    const t = v[key];
    if (t) s.alpha(va[key] ?? 1, () => s.text(t, x, y, { size: 3.2, font: 'mono', weight: 650, align, color: s.c(k), halo: true }));
  };
  num('c0', L.xL, L.yc + 4.5 * s.u, CELL, 'left');
  num('fc', (L.xf + L.xp) / 2, L.yc - 4 * s.u, CELL);
  num('f', L.xf - 6 * s.u, L.fy, 'red', 'right');
  num('i', L.xp - 15.5 * s.u, L.gy, 'green', 'right');
  num('g', L.xp + 15.5 * s.u, L.gy, 'gold', 'left');
  num('ig', L.xp + 4 * s.u, L.ig, '--ink-2', 'left');
  num('c', L.xR, L.yc + 4.5 * s.u, CELL, 'right');
  num('tc', L.xo - 7.5 * s.u, L.th, '--ink-2', 'right');
  num('o', ox, L.oy - 7 * s.u, 'purple');
  num('h', L.xo + 4 * s.u, L.hy, H, 'left');
}

// ---- 2. Gates on the cell ------------------------------------------------------------

/** What "gate" means here: a number from 0 to 1 fed into a multiply gate, shown open, shut, then ajar. */
function dial(s: Scene, a: number, slide: number): void {
  const cx = s.w / 2;
  const y = s.h * 0.58;
  const p = s.prog('dial');
  // Timed to the voice: open at "at one", shut at "at zero", half open at "in between".
  const g = p < 0.69 ? 1 : p < 0.84 ? 1 - smooth((p - 0.69) / 0.05) : 0.5 * smooth((p - 0.84) / 0.06);
  // The two backprop gates, before the word narrows.
  const mx = lerp(cx + 16 * s.u, cx, slide);
  s.alpha(a * (1 - slide), () => {
    op(s, cx - 16 * s.u, y, '+');
    s.text('add gate', cx - 16 * s.u, y + 7 * s.u, { size: 3, font: 'mono', color: s.c('--ink-2') });
    s.text('multiply gate', cx + 16 * s.u, y + 7 * s.u, { size: 3, font: 'mono', color: s.c('--ink-2') });
    s.text('backprop: every node is a gate', cx, y - 14 * s.u, { size: 3.3, color: s.c('--ink-2') });
  });
  s.alpha(a, () => op(s, mx, y, '×'));
  s.alpha(a * slide, () => {
    const o = { size: 3.2, font: 'mono', weight: 650 } as const;
    s.text('3', cx - 30 * s.u, y, { ...o, color: s.c('--ink-2') });
    s.arrow(cx - 27 * s.u, y, cx - 3.2 * s.u, y, s.tint('slate', 0.8), 0.45, 1.8);
    s.alpha(0.25 + 0.75 * g, () => s.arrow(cx + 3.2 * s.u, y, cx + 22 * s.u, y, s.tint('slate', 0.8), 0.2 + 0.6 * g, 1.8));
    s.text(String(Math.round(3 * g * 100) / 100), cx + 24 * s.u, y, { ...o, align: 'left', color: s.c('--ink') });
    // The gate as a meter from 0 to 1, feeding the multiply.
    const top = y - 23 * s.u;
    const hgt = 13 * s.u;
    s.rrect(cx - 2.2 * s.u, top, 4.4 * s.u, hgt, 0.8, { stroke: s.tint('slate', 0.8), lw: 0.3 });
    s.rrect(cx - 2.2 * s.u, top + hgt * (1 - g), 4.4 * s.u, hgt * g, 0.8, { fill: s.tint('green', 0.55) });
    s.arrow(cx, top + hgt + 0.8 * s.u, cx, y - 3.2 * s.u, s.tint('slate', 0.8), 0.35, 1.4);
    s.text(`gate ${g < 0.995 && g > 0.005 ? g.toFixed(1) : g.toFixed(0)}`, cx + 4 * s.u, top + hgt / 2, { ...o, size: 3, align: 'left', color: s.c('green') });
    const word = p < 0.5 ? '' : g > 0.9 ? 'open' : g < 0.1 ? 'shut' : p > 0.88 ? 'ajar' : '';
    s.text(word, cx, y + 8 * s.u, { size: 3.4, weight: 600, color: s.c('green') });
  });
}

const gates: SceneDef = {
  draw(s) {
    const L = layout(s);
    const build = s.ease('sigmoid', 0.8);
    s.alpha(1 - build, () => dial(s, 1, s.ease('dial', 0.8)));
    diagram(s, {
      a: { f: 0, cell: 1, bus: build, i: build, o: build, g: s.ease('cand', 0.7) },
      on: { cell: s.win('gate', 'sigmoid'), i: Math.max(s.win('sigmoid', 'cand'), s.win('input', 'output')), o: Math.max(s.win('sigmoid', 'cand'), s.ease('output', 0.6)), g: s.win('cand', 'output') },
    });
    const note = { size: 2.8, font: 'mono', color: s.c('--ink-3') } as const;
    s.alpha(build, () => {
      s.text('σ: 0 to 1', L.xp - 15.5 * s.u, L.gy, { ...note, align: 'right' });
      s.text('σ: 0 to 1', L.xo + 11 * s.u, L.oy - 7 * s.u, note);
    });
    s.alpha(s.ease('cand', 0.6, 0.8), () => s.text('tanh: −1 to 1', L.xp + 10 * s.u, L.gy + 7.5 * s.u, { ...note, halo: true }));
    const top = { size: 3.2, font: 'mono', color: s.c('--ink-2') } as const;
    s.alpha(s.win('input', 'output'), () => s.text('c = c + i·g', s.w / 2, s.h * 0.07, { ...top, color: s.c(CELL) }));
    s.alpha(s.ease('output', 0.6, 1), () => s.text('h = o · tanh(c)', s.w / 2, s.h * 0.07, { ...top, color: s.c(H) }));
  },
};

// ---- 3. Learning to forget -----------------------------------------------------------

const forget: SceneDef = {
  draw(s) {
    const fa = s.ease('forget', 0.8);
    const k = s.ease('keep', 0.6);
    const w = s.ease('write', 0.6);
    const ad = s.ease('add', 0.6);
    const sq = s.ease('squash', 0.6);
    const sh = s.ease('show', 0.6);
    diagram(s, {
      a: { f: fa },
      on: { f: Math.max(s.win('forget', 'formula'), s.win('keep', 'write')), i: s.win('write', 'add'), g: s.win('write', 'add'), o: s.win('show', 'layer'), cell: Math.max(s.win('grow', 'forget'), s.win('add', 'squash')) },
      vals: { c0: '2', f: '0.3', fc: '0.6', i: '0.8', g: '0.5', ig: '0.4', c: '1.0', tc: '0.76', o: '0.5', h: '0.38' },
      va: { c0: k, f: k, fc: s.ease('keep', 0.6, 2.5), i: w, g: w, ig: s.ease('write', 0.6, 2), c: ad, tc: sq, o: sh, h: s.ease('show', 0.6, 2) },
    });
    const L = layout(s);
    // Without a forget gate, the cell only ever adds: its value climbs with no end.
    s.alpha(s.win('grow', 'forget'), () => {
      const n = Math.floor(1 + s.prog('grow') * 14);
      s.text(`c: ${(0.4 * n).toFixed(1)} and climbing`, L.xp, L.yc - 9 * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c('red'), halo: true });
    });
    cite(s, 'Gers, Schmidhuber & Cummins, 2000', s.win('forget', 'formula'));
    const line = { size: 3.2, font: 'mono', weight: 600 } as const;
    const y = s.h * 0.07;
    s.alpha(s.win('formula', 'keep'), () => s.text('cₜ = fₜ cₜ₋₁ + iₜ gₜ', s.w / 2, y, { ...line, color: s.c(CELL) }));
    s.alpha(s.win('add', 'squash'), () => s.text('cₜ = 0.3 × 2 + 0.8 × 0.5 = 1.0', s.w / 2, y, { ...line, color: s.c(CELL) }));
    s.alpha(s.ease('show', 0.6, 1.2) * (1 - s.ease('layer', 0.6)), () => s.text('hₜ = 0.5 × tanh(1.0) ≈ 0.38', s.w / 2, y, { ...line, color: s.c(H) }));
    s.alpha(s.ease('layer', 0.6), () => s.text('a layer: each unit its own cell and gates', s.w / 2, y, { ...line, size: s.tall ? 2.9 : 3.2, color: s.c('--ink-2') }));
  },
};

// ---- 4. Why memories last ------------------------------------------------------------

const path: SceneDef = {
  draw(s) {
    const learn = s.ease('learn', 0.8);
    // The cell, step by step: each step back multiplies by f.
    const xs = [-44, -22, 0, 22, 44].map((d) => s.w / 2 + d * s.u);
    const y = s.h * 0.14;
    xs.forEach((x, i) => {
      s.circle(x, y, 4 * s.u, { fill: s.tint(CELL, 0.14 + 0.2 * learn), stroke: s.tint(CELL, 0.8), lw: 0.35 + 0.2 * learn });
      s.text(`c${'₁₂₃₄₅'[i]}`, x, y + 0.2 * s.u, { size: 3, font: 'mono', weight: 650, color: s.c(CELL) });
    });
    for (let i = 0; i < 4; i++) {
      s.arrow(xs[i]! + 4 * s.u, y, xs[i + 1]! - 4 * s.u, y, s.tint(CELL, 0.7 + 0.3 * learn), 0.4 + 0.2 * learn, 1.6);
      s.alpha(s.ease('path', 0.5, 1 + 0.5 * (3 - i)), () => {
        s.arrow(xs[i + 1]! - 4 * s.u, y + 7 * s.u, xs[i]! + 4 * s.u, y + 7 * s.u, s.c(GRAD), 0.4, 1.8);
        s.text('× f', (xs[i]! + xs[i + 1]!) / 2, y + 10.5 * s.u, { size: 2.8, font: 'mono', weight: 650, color: s.c(GRAD) });
      });
    }
    s.alpha(s.win('path', 'lstm'), () => caption(s, '∂cₜ/∂cₜ₋₁ = fₜ: no weight matrix, no tanh slope', s.h * 0.5, CELL, s.tall ? 3 : 3.4));
    // Gradient kept after k steps back: f^k along the cell, 0.5^k through a plain RNN's h.
    const L = s.w / 2 - 36 * s.u;
    const R = s.w / 2 + 40 * s.u;
    const T = s.h * 0.4;
    const B = s.h * 0.86;
    const X = (k: number) => L + ((R - L) * k) / 20;
    const Y = (v: number) => B - (B - T) * v;
    s.alpha(s.ease('lstm', 0.6), () => {
      s.line(L, T, L, B, s.c('--axis'), 0.35);
      s.line(L, B, R, B, s.c('--axis'), 0.35);
      const tick = { size: 2.8, font: 'mono', color: s.c('--ink-3') } as const;
      s.text('1', L - 1.5 * s.u, Y(1), { ...tick, align: 'right' });
      s.text('0', L - 1.5 * s.u, Y(0), { ...tick, align: 'right' });
      s.text('steps back: 20', R, B + 4 * s.u, { ...tick, align: 'right' });
      s.text('gradient kept', L + 1.5 * s.u, T - 3 * s.u, { ...tick, align: 'left' });
    });
    const curve = (a: number, k: Color, upto: number) => {
      const n = Math.floor(upto * 20);
      for (let i = 0; i < n; i++) s.line(X(i), Y(a ** i), X(i + 1), Y(a ** (i + 1)), s.c(k), 0.55);
      for (let i = 0; i <= n; i++) s.circle(X(i), Y(a ** i), 0.75 * s.u, { fill: s.c(k) });
    };
    s.alpha(s.ease('lstm', 0.6, 0.6), () => {
      curve(0.95, CELL, s.ease('lstm', 2, 0.6));
      s.alpha(s.ease('lstm', 0.6, 2.8), () => s.text('cell, f = 0.95: 0.36', X(20), Y(0.36) + 6 * s.u, { size: 3, font: 'mono', weight: 650, align: 'right', color: s.c(CELL), halo: true }));
    });
    s.alpha(s.ease('rnn', 0.6), () => {
      curve(0.5, H, s.ease('rnn', 2, 0.4));
      s.alpha(s.ease('rnn', 0.6, 2.6), () => s.text('plain RNN, × 0.5: 0.000001', X(20), Y(0) - 4 * s.u, { size: 3, font: 'mono', weight: 650, align: 'right', color: s.c(H), halo: true }));
    });
  },
};

export const scenes: Record<string, SceneDef> = { fade, gates, forget, path };

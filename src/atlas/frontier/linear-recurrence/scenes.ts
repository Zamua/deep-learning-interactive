import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import type { Ink } from '../../linear-algebra/draw';
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
const W = [0, 1, 2].map((k) => C * A ** k * B);
const YS = XS.map((_, t) => W.slice(0, t + 1).reduce((acc, w, k) => acc + w * XS[t - k]!, 0));
// The worked problems.
const XS1 = [2, 1, 3];
const HS1 = run(0.5, 4, XS1);
const W2 = [2, 1, 0].map((k) => 2 * 0.5 ** k * 3);

const mono = (s: Scene, t: string, x: number, y: number, k: Ink, size = 3.4, align: CanvasTextAlign = 'center', weight = 600) => s.text(t, x, y, { size, font: 'mono', weight, align, color: s.c(k), halo: true });
const Y = (s: Scene, f: number) => f * s.h;

// ---- scene 1: drop the tanh, then three steps

const drop: SceneDef = {
  marks: {
    old: { tex: String.raw`\symh_t = \tanh(\symWhh\symh_{t-1} + \symWxh\symx_t + \symb)`, x: 0.5, y: 0.3, size: 4.6 },
    lin: { tex: String.raw`\symh_t = a\,\symh_{t-1} + b\,\symx_t`, x: 0.5, y: 0.52, size: 5.2 },
    out: { tex: String.raw`y_t = c\,\symh_t`, x: 0.5, y: 0.19, size: 4.6 },
  },
  draw(s) {
    const up = s.ease('out', 0.8);
    s.show('old', s.ease('recall', 0.6) * (1 - 0.55 * s.ease('linear', 0.5)) * (1 - up));
    s.show('lin', s.ease('linear', 0.6, 0.4), { y: lerp(0.52, 0.09, up) });
    s.show('out', s.ease('out', 0.6, 0.5));
    s.alpha(s.ease('recall', 0.6, 0.8) * (1 - s.ease('linear', 0.5)), () => {
      s.text('one unit: every weight is a single number', s.w / 2, Y(s, 0.42), { size: 3.4, color: s.c('--ink-2') });
      s.text('then drop the tanh and the bias', s.w / 2, Y(s, 0.5), { size: 3.4, color: s.c('--ink-2') });
    });
    s.alpha(s.ease('linear', 0.6, 0.4) * (1 - up), () => {
      s.arrow(s.w / 2, Y(s, 0.36), s.w / 2, Y(s, 0.45), s.c('--ink-3'), 0.35, 1.8);
      const o = { size: 3.4, font: 'mono', weight: 600, halo: true } as const;
      s.text('a: the decay', s.w / 2 - 2 * s.u, Y(s, 0.64), { ...o, align: 'right', color: s.c('teal') });
      s.text('b: the input weight', s.w / 2 + 2 * s.u, Y(s, 0.64), { ...o, align: 'left', color: s.c('green') });
      s.text('old state', s.w / 2 - 2 * s.u, Y(s, 0.7), { size: 3, align: 'right', color: s.c('--ink-3') });
      s.text('new input', s.w / 2 + 2 * s.u, Y(s, 0.7), { size: 3, align: 'left', color: s.c('--ink-3') });
    });
    s.alpha(s.ease('out', 0.6, 1.2), () => mono(s, `a = ${A}   b = ${B}   c = ${C}`, s.w / 2, Y(s, 0.28), '--ink-2', 3.4));
    // The chain fills in step by step.
    const t2 = s.prog('h23');
    const filled = (i: number) => (i === 0 ? 1 : i === 1 ? s.ease('h1', 0.4, 2.6) : i === 2 ? (t2 > 0.25 ? 1 : 0) : t2 > 0.65 ? 1 : 0);
    const hot = (i: number) => (i === 1 ? s.win('h1', 'h23') : i === 2 ? (t2 > 0.25 && t2 < 0.65 ? 1 : 0) : i === 3 ? (t2 > 0.65 ? 1 : 0) : 0);
    const g = chain(s, {
      y: Y(s, 0.5),
      n: 3,
      states: (i) => (filled(i) > 0.5 ? fmt(HS[i]!) : ''),
      inputs: XS.map(String),
      decay: () => `×${A}`,
      gain: `×${B}`,
      show: (i) => (i === 0 ? s.ease('out', 0.6, 0.8) : s.ease('out', 0.6, 1 + 0.25 * i)),
      hot,
      decayInk: () => 'teal',
    });
    // The output, read off the last state.
    s.alpha(t2 > 0.85 ? s.ease('h23', 0.5, 0.85 * (s.end('h23') - s.at('h23'))) : 0, () => {
      const x = g.x(3);
      const yy = g.y - 20 * s.u;
      s.arrow(x, g.y - g.r - 5 * s.u, x, yy + 3.9 * s.u, s.tint('--ink-3', 0.75), 0.35, 1.6);
      s.cell(x - 5 * s.u, yy - 3.5 * s.u, 10 * s.u, 7 * s.u, fmt(C * HS[3]!), 'purple', { on: 0.6, size: 3.2 });
      mono(s, `×${C}`, x - 1.4 * s.u, yy + 6.2 * s.u, 'red', 3, 'right');
      mono(s, 'y₃', x + 6.4 * s.u, yy, 'purple', 3.2, 'left');
    });
    // The arithmetic of the step being taken.
    const line = (t: number) => `h${sub(t)} = ${A}·${fmt(HS[t - 1]!)} + ${B}·${XS[t - 1]} = ${fmt(HS[t]!)}`;
    const yl = Y(s, 0.86);
    s.alpha(s.ease('h1', 0.5, 2.2) * (1 - s.ease('h23', 0.4)), () => mono(s, line(1), s.w / 2, yl, '--ink', 3.6));
    s.alpha(t2 > 0.05 && t2 < 0.36 ? 1 : 0, () => mono(s, line(2), s.w / 2, yl, '--ink', 3.6));
    s.alpha(t2 >= 0.36 && t2 < 0.85 ? 1 : 0, () => mono(s, line(3), s.w / 2, yl, '--ink', 3.6));
    s.alpha(t2 >= 0.85 ? 1 : 0, () => mono(s, `y₃ = ${C}·${fmt(HS[3]!)} = ${fmt(C * HS[3]!)}`, s.w / 2, yl, 'purple', 3.6));
  },
};

// ---- scene 2: the unrolled sum, then what a decides

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

const CHARTS = [
  { a: 0.5, word: 'fades', k: 'teal' as Ink },
  { a: 1, word: 'holds', k: 'gold' as Ink },
  { a: 2, word: 'blows up', k: 'red' as Ink },
];

const unroll: SceneDef = {
  marks: {
    open: { tex: String.raw`\symh_3 = b\,\symx_3 + ab\,\symx_2 + a^2 b\,\symx_1`, x: 0.5, y: 0.09, size: 4.6 },
    wt: { tex: String.raw`\symx_{t-k} \text{ weighs } c\,a^k b`, x: 0.5, y: 0.19, size: 4.6 },
    powers: { tex: String.raw`c\,b,\ \ c\,a\,b,\ \ c\,a^2 b,\ \ c\,a^3 b,\ \dots`, x: 0.5, y: 0.14, size: 4.4 },
    rule: { tex: String.raw`|a| < 1 \text{ fades},\quad |a| > 1 \text{ blows up}`, x: 0.5, y: 0.14, size: 4.4 },
  },
  draw(s) {
    const gone = s.ease('fade', 0.6);
    s.show('open', s.ease('open', 0.6) * (1 - gone));
    s.show('wt', s.ease('weights', 0.6) * (1 - gone));
    const ruled = s.ease('blow', 0.6, 0.45 * (s.end('blow') - s.at('blow')));
    s.show('powers', s.ease('fade', 0.6, 0.3) * (1 - ruled));
    s.show('rule', ruled);
    const gap = s.tall ? 26 : 30;
    const xs = [-1, 0, 1].map((j) => s.w / 2 + j * gap * s.u);
    s.alpha(s.ease('open', 0.6) * (1 - gone), () => {
      const cy = Y(s, 0.33);
      const terms = ['a²b·x₁', 'ab·x₂', 'b·x₃'];
      xs.forEach((x, j) => {
        s.cell(x - 5 * s.u, cy - 3.6 * s.u, 10 * s.u, 7.2 * s.u, String(XS[j]), 'orange', { on: 0.3, size: 3.4 });
        mono(s, `x${sub(j + 1)}`, x, cy - 6.4 * s.u, 'orange', 3);
        s.alpha(s.ease('open', 0.5, 1.2) * (1 - s.ease('weights', 0.5)), () => mono(s, terms[j]!, x, cy + 7 * s.u, '--ink-2', 3.2));
      });
      s.alpha(s.ease('weights', 0.6, 0.4), () => {
        const base = Y(s, 0.78);
        const show = (j: number) => s.ease('weights', 0.5, 1.6 + 0.5 * (2 - j));
        barRow(s, xs, base, W.slice().reverse(), 'red', {
          unit: 4.5,
          w: 9,
          above: (j) => (show(j) > 0.5 ? `${W[2 - j]}` : ''),
          below: (j) => `k = ${2 - j}`,
          on: (j) => show(j),
        });
        s.alpha(s.ease('weights', 0.5, 0.62 * (s.end('weights') - s.at('weights'))), () =>
          mono(s, `${W[0]}·${XS[2]} + ${W[1]}·${XS[1]} + ${W[2]}·${XS[0]} = ${YS[2]}`, s.w / 2, Y(s, 0.91), 'purple', 3.6),
        );
      });
    });
    // Powers of a, k = 0..3, for three values of a.
    s.alpha(gone, () => {
      const cg = s.tall ? 31 : 44;
      const base = Y(s, 0.74);
      CHARTS.forEach((c, i) => {
        const cx = s.w / 2 + (i - 1) * cg * s.u;
        const on = i === 0 ? s.win('fade', 'blow') : s.ease('blow', 0.5, (i === 1 ? 0.05 : 0.2) * (s.end('blow') - s.at('blow')));
        s.alpha(i === 0 ? 1 : 0.25 + 0.75 * on, () => {
          const bx = [-1.5, -0.5, 0.5, 1.5].map((j) => cx + j * 6.4 * s.u);
          barRow(s, bx, base, [3, 2, 1, 0].map((k) => c.a ** k), c.k, { unit: 3.6, w: 4.6, below: (j) => String(3 - j), size: 2.6, on: () => on });
          mono(s, `a = ${c.a}`, cx, base + 8 * s.u, c.k, 3.2);
          mono(s, c.word, cx, base + 13 * s.u, c.k, 3.2, 'center', 650);
        });
      });
      s.text('steps back', s.w / 2, base + 18 * s.u, { size: 2.8, color: s.c('--ink-3') });
    });
  },
};

// ---- scene 3: sequential tanh steps against one product for every output

const parallel: SceneDef = {
  draw(s) {
    const y = Y(s, lerp(0.4, 0.2, s.ease('all', 0.7)));
    const gap = (s.tall ? 14 : 17) * s.u;
    const at = (j: number) => s.w / 2 + (j - 3) * gap;
    const p = s.prog('seq');
    const step = (t: number) => (p > 0.15 + 0.25 * (t - 1) ? 1 : 0);
    s.alpha(s.ease('seq', 0.6) * (1 - 0.6 * s.ease('all', 0.6)), () => {
      for (let j = 0; j <= 6; j++) {
        const x = at(j);
        if (j % 2 === 0) {
          const i = j / 2;
          s.circle(x, y, 4 * s.u, { fill: s.tint('gold', 0.12 + 0.3 * (i ? step(i) : 1)), stroke: s.tint('gold', 0.8), lw: 0.35 });
          mono(s, `h${sub(i)}`, x, y + 0.2 * s.u, 'gold', 2.8);
        } else {
          const t = (j + 1) / 2;
          const on = step(t) * (p < 0.15 + 0.25 * t ? 1 : 0.3);
          s.rrect(x - 4.6 * s.u, y - 3.4 * s.u, 9.2 * s.u, 6.8 * s.u, 1.2, { fill: s.tint('blue', 0.1 + 0.35 * on), stroke: s.tint('blue', 0.5 + 0.5 * on), lw: 0.3 });
          mono(s, 'tanh', x, y + 0.2 * s.u, 'blue', 2.6);
          mono(s, `step ${t}`, x, y + 7.6 * s.u, '--ink-3', 2.6);
          s.arrow(at(j - 1) + 4 * s.u, y, x - 4.8 * s.u, y, s.c('--ink-3'), 0.3, 1.4);
          s.arrow(x + 4.8 * s.u, y, at(j + 1) - 4 * s.u, y, s.c('--ink-3'), 0.3, 1.4);
        }
      }
      s.text('one step after another', s.w / 2, y + 13 * s.u, { size: 3.2, color: s.c('--ink-2') });
    });
    // y = M x, every row at once.
    s.alpha(s.ease('all', 0.6, 0.3), () => {
      const cy = Y(s, 0.62);
      const cw = (s.tall ? 9 : 10) * s.u;
      const ch = 7.6 * s.u;
      const mx = s.w / 2 - (s.tall ? 12 : 14) * s.u;
      const flash = s.ease('all', 0.5, 0.55 * (s.end('all') - s.at('all')));
      const diag = (i: number, j: number) => (i >= j ? s.ease('slide', 0.4, (0.05 + 0.12 * (i - j)) * (s.end('slide') - s.at('slide'))) * (1 - s.ease('slide', 0.4, (0.17 + 0.12 * (i - j)) * (s.end('slide') - s.at('slide')))) : 0);
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const v = i >= j ? W[i - j]! : 0;
          s.cell(mx + (j - 1.5) * cw + 0.4 * s.u, cy + (i - 1.5) * ch + 0.4 * s.u, cw - 0.8 * s.u, ch - 0.8 * s.u, String(v), i >= j ? 'red' : '--ink-3', { on: 0.25 * flash + 0.75 * diag(i, j), size: 3.2 });
        }
      }
      const xx = mx + 2.6 * cw;
      const yx = xx + 2.4 * cw;
      for (let i = 0; i < 3; i++) {
        s.cell(xx - cw / 2 + 0.4 * s.u, cy + (i - 1.5) * ch + 0.4 * s.u, cw - 0.8 * s.u, ch - 0.8 * s.u, String(XS[i]), 'orange', { size: 3.2 });
        s.cell(yx - cw / 2 + 0.4 * s.u, cy + (i - 1.5) * ch + 0.4 * s.u, cw - 0.8 * s.u, ch - 0.8 * s.u, String(YS[i]), 'purple', { on: flash, size: 3.2 });
      }
      mono(s, '=', (xx + yx) / 2, cy, '--ink-3', 4);
      const top = cy - 1.5 * ch - 3 * s.u;
      mono(s, 'weights', mx, top, 'red', 3.2);
      mono(s, 'x', xx, top, 'orange', 3.2);
      mono(s, 'y', yx, top, 'purple', 3.2);
      s.alpha(flash * (1 - s.ease('slide', 0.5)), () => s.text('every output at once', s.w / 2, cy + 1.5 * ch + 5 * s.u, { size: 3.4, color: s.c('purple') }));
      s.alpha(s.ease('slide', 0.5, 0.3), () => s.text('the same weights, slid one step per row', s.w / 2, cy + 1.5 * ch + 5 * s.u, { size: 3.4, color: s.c('red') }));
    });
  },
};

// ---- scene 4: two worked problems

const tryIt: SceneDef = {
  marks: {
    p1: { tex: String.raw`a = 0.5,\ \ b = 4,\ \ \symh_0 = 0`, x: 0.5, y: 0.08, size: 4.6 },
    q1: { tex: String.raw`\symx_1, \symx_2, \symx_3 = 2, 1, 3\!:\quad \symh_3\,?`, x: 0.5, y: 0.17, size: 4.4 },
    p2: { tex: String.raw`a = 0.5,\ \ b = 3,\ \ c = 2`, x: 0.5, y: 0.08, size: 4.6 },
    q2: { tex: String.raw`\text{weight of } \symx_{t-2} \text{ in } y_t\,?`, x: 0.5, y: 0.17, size: 4.4 },
  },
  draw(s) {
    const one = s.ease('p1', 0.6) * (1 - s.ease('p2', 0.5));
    const two = s.ease('p2', 0.6, 0.3);
    s.show('p1', one);
    s.show('q1', one * s.ease('p1', 0.5, 0.5 * (s.end('p1') - s.at('p1'))));
    s.show('p2', two);
    s.show('q2', two * s.ease('p2', 0.5, 0.5 * (s.end('p2') - s.at('p2'))));
    const q = s.prog('a1');
    s.alpha(one, () => {
      const filled = (i: number) => i === 0 || q > [0, 0.1, 0.35, 0.7][i]!;
      chain(s, {
        y: Y(s, 0.45),
        n: 3,
        states: (i) => (filled(i) ? fmt(HS1[i]!) : i === 3 ? '?' : ''),
        inputs: XS1.map(String),
        decay: () => '×0.5',
        gain: '×4',
        show: () => 1,
        hot: (i) => (i === 3 ? s.ease('a1', 0.5, 0.75 * (s.end('a1') - s.at('a1'))) : 0),
        decayInk: () => 'teal',
      });
      const lines = [1, 2, 3].map((t) => `h${sub(t)} = 0.5·${fmt(HS1[t - 1]!)} + 4·${XS1[t - 1]} = ${fmt(HS1[t]!)}`);
      lines.forEach((l, i) => s.alpha(q > [0.1, 0.35, 0.7][i]! ? 1 : 0, () => mono(s, l, s.w / 2, Y(s, 0.8 + 0.065 * i), i === 2 ? 'gold' : '--ink-2', 3.4)));
    });
    s.alpha(two, () => {
      const gap = s.tall ? 26 : 30;
      const xs = [-1, 0, 1].map((j) => s.w / 2 + j * gap * s.u);
      const base = Y(s, 0.72);
      const ask = s.ease('p2', 0.5, 0.6 * (s.end('p2') - s.at('p2')));
      const done = s.ease('a2', 0.5, 0.6 * (s.end('a2') - s.at('a2')));
      barRow(s, xs, base, W2, 'red', {
        unit: 4.2,
        w: 9,
        above: (j) => (j === 0 ? (done > 0.5 ? fmt(W2[0]!) : '?') : fmt(W2[j]!)),
        below: (j) => ['xₜ₋₂', 'xₜ₋₁', 'xₜ'][j]!,
        on: (j) => (j === 0 ? 0.4 * ask + 0.6 * done : 0),
      });
      s.alpha(1 - done, () => ['c a² b', 'c a b', 'c b'].forEach((t, j) => mono(s, t, xs[j]!, base + 8 * s.u, '--ink-3', 3)));
      s.alpha(done, () => mono(s, `${2} × 0.25 × ${3} = ${fmt(W2[0]!)}`, s.w / 2, base + 12 * s.u, 'red', 3.8));
    });
  },
};

export const scenes: Record<string, SceneDef> = { drop, unroll, parallel, try: tryIt };

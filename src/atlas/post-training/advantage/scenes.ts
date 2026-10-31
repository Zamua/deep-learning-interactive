import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { after, bars, cells, cite, columns, rowLabel } from '../../draw';
import { rich } from '../../linear-algebra/draw';
import { fmt } from '../../training/draw';
import { push } from '../draw';

const P = String.raw`\sym{pi}{\pi}`;
const TH0 = String.raw`\sym{theta}{\theta}_0`;

/** One line of plain text across the stage, centered. */
function caption(s: Scene, text: string, y: number, k: Ink, a: number, size = 3.2) {
  s.alpha(a, () => s.text(text, s.w / 2, y, { size, color: s.c(k), halo: true }));
}

// ---- scene 1: a baseline changes every single push

const R = [0.9, 0.6, 0.5, 0.2];
const B = 0.55;
const A = R.map((r) => Math.round((r - B) * 100) / 100);

const pushScene: SceneDef = {
  draw(s) {
    const xs = columns(s, 4, 20);
    const lx = xs[0]! - 10 * s.u;
    const base = s.h * 0.46;
    const H = 30;
    s.alpha(s.ease('pushes', 0.6), () => {
      rowLabel(s, 'R', lx, base - 8 * s.u, 'gold', 3.8);
      bars(s, xs, base, R, 'gold', { max: 1, height: H, w: 11, fmt: (v) => v.toFixed(1), hi: [0, 0, s.win('flip', 'worry'), s.win('flip', 'worry')] });
    });
    // The baseline: a dashed level across the bars.
    const bA = s.ease('flip', 0.8);
    const yb = base - B * H * s.u;
    s.alpha(bA, () => {
      const x0 = xs[0]! - 8 * s.u;
      s.line(x0, yb, x0 + (xs[3]! - xs[0]! + 16 * s.u) * bA, yb, s.c('green'), 0.45, [1.4, 1]);
      s.text(`b = ${B}`, xs[3]! + 8 * s.u, yb - 3 * s.u, { size: 3.2, font: 'mono', weight: 650, align: 'right', color: s.c('green'), halo: true });
    });
    s.alpha(after(s, 'flip', 0.35), () => {
      rowLabel(s, 'A', lx, base + 8 * s.u, 'red', 3.6);
      cells(s, xs, base + 8 * s.u, A.map((v) => fmt(v)), 'red', { w: 12, h: 7 });
    });
    // Each push: R's size at first, then A's, which turns the last two around.
    const yp = s.h * 0.76;
    const m = after(s, 'flip', 0.6, 1.2);
    const pa = s.ease('pushes', 0.8, 1.2);
    s.alpha(pa, () => {
      rowLabel(s, 'push', lx, yp, '--ink-3', 3);
      // A push's length follows its weight, but a small one stays visible.
      const len = (v: number) => Math.sign(v) * Math.max(0.25, Math.abs(v));
      xs.forEach((x, i) => push(s, x, yp, lerp(len(R[i]!), len(A[i]! * 2.4), m), 13, pa));
    });
    caption(s, 'every reward positive: all pushed up', s.h * 0.93, 'green', after(s, 'pushes', 0.6) * (1 - s.ease('flip', 0.5)));
    caption(s, 'below b: now pushed down', s.h * 0.93, 'red', after(s, 'flip', 0.75) * (1 - s.ease('worry', 0.5)));
    caption(s, 'every step changed: does the average still climb J?', s.h * 0.07, '--ink-2', s.win('worry', 'one'));
    caption(s, 'the probabilities always add up to 1', s.h * 0.07, 'teal', s.ease('one', 0.6, 1));
  },
};

// ---- scene 2: probabilities share a total of one

const PI = [0.5, 0.3, 0.2];
const ANS = ['56', '54', '64'];
/** The probabilities after raising fifty six's score by `t`: it grows, the others shrink in proportion. */
function shares(t: number): number[] {
  const e = PI[0]! * Math.exp(t);
  const p0 = e / (e + 1 - PI[0]!);
  return PI.map((p, i) => (i === 0 ? p0 : (p * (1 - p0)) / (1 - PI[0]!)));
}
const DP = [0.25, -0.15, -0.1];
const DPI = ['+0.0025', '−0.0015', '−0.001'];

/** The probabilities laid end to end as one bar of length 1, `grow` drawing it in from the left. */
function stack(s: Scene, y: number, p: number[], grow: number, lit: number) {
  const x0 = s.w / 2 - 40 * s.u;
  const W = 80 * s.u;
  const h = 9 * s.u;
  let x = x0;
  p.forEach((v, i) => {
    const w = v * W * grow;
    const on = i === 0 ? lit : 0;
    s.rrect(x, y - h / 2, Math.max(0, w - 0.4 * s.u), h, 0.8, { fill: s.tint('teal', [0.4, 0.24, 0.12][i]! + 0.2 * on), stroke: s.tint('teal', 0.7 + 0.3 * on), lw: 0.3 });
    s.alpha(grow > 0.9 ? 1 : 0, () => {
      s.text(ANS[i]!, x + w / 2, y + 0.2 * s.u, { size: 3.2, font: 'mono', weight: 650, color: s.c('--ink') });
      s.text(v.toFixed(4).replace(/0+$/, ''), x + w / 2, y - h / 2 - 3 * s.u, { size: 3, font: 'mono', weight: 600, color: s.c('teal'), halo: true });
    });
    x += w;
  });
  s.alpha(grow > 0.9 ? 1 : 0, () => {
    const yb = y + h / 2 + 2 * s.u;
    s.line(x0, yb, x0 + W, yb, s.c('--ink-3'), 0.3);
    s.line(x0, yb - 1 * s.u, x0, yb + 1 * s.u, s.c('--ink-3'), 0.3);
    s.line(x0 + W, yb - 1 * s.u, x0 + W, yb + 1 * s.u, s.c('--ink-3'), 0.3);
    const tot = p.reduce((a, b) => a + b, 0);
    s.text(`total ${tot.toFixed(2)}`, s.w / 2, yb + 3.4 * s.u, { size: 3, font: 'mono', weight: 600, color: s.c('--ink-2') });
  });
}

const one: SceneDef = {
  marks: {
    f: { tex: String.raw`\sum_y \dfrac{\partial ${P}(y)}{\partial ${TH0}} = 0`, x: 0.5, y: 0.08, size: 4.4 },
  },
  draw(s) {
    const eqA = s.ease('bars', 0.6, 2) * (1 - s.ease('always', 0.5));
    s.alpha(eqA, () => s.text('π(56) + π(54) + π(64) = 1', s.w / 2, s.h * 0.08, { size: 3.6, font: 'mono', weight: 600, color: s.c('teal') }));
    s.show('f', s.ease('always', 0.6, 0.3));
    // Raise θ₀ and let it settle back: fifty six's share swells, the other two make room.
    const t = 0.8 * s.ease('nudge', 1.6, 1.2) * (1 - s.ease('slopes', 1));
    stack(s, s.h * 0.27, shares(t), s.ease('bars', 1.2, 0.3), s.win('nudge', 'zero'));
    s.alpha(s.win('nudge', 'zero'), () => {
      const k = s.ease('nudge', 1.6, 1.2) * (1 - s.ease('slopes', 1));
      s.text(`θ₀ = ${(0.8 * k).toFixed(2)}`, s.w / 2 - 40 * s.u, s.h * 0.43, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('blue') });
    });
    const xs = columns(s, 3, 19);
    const lx = xs[0]! - 9.5 * s.u;
    const y1 = s.h * 0.58;
    const y2 = s.h * 0.7;
    const first = after(s, 'slopes', 0.3);
    const rest = after(s, 'others', 0.2);
    s.alpha(first, () => {
      xs.forEach((x, i) => s.text(ANS[i]!, x, y1 - 7 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
      rowLabel(s, 'Δπ', lx, y1, 'teal', 3.2);
      s.text('θ₀ + 0.01', s.w / 2 + 40 * s.u, s.h * 0.43, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
    });
    s.alpha(after(s, 'slopes', 0.6), () => rowLabel(s, '∂π/∂θ₀', lx, y2, 'slate', 3));
    const on = [s.win('slopes', 'others'), s.win('others', 'zero'), s.win('others', 'zero')];
    xs.forEach((x, i) => {
      s.alpha(i === 0 ? first : rest, () => cells(s, [x], y1, [DPI[i]!], 'teal', { w: 15, h: 7, size: 2.9, on: [on[i]!] }));
      s.alpha(i === 0 ? after(s, 'slopes', 0.6) : after(s, 'others', 0.5), () => cells(s, [x], y2, [fmt(DP[i]!)], 'slate', { w: 15, h: 7, on: [on[i]!] }));
    });
    s.alpha(after(s, 'zero', 0.15), () => {
      const yl = y2 + 5.5 * s.u;
      s.line(xs[0]! - 8 * s.u, yl, xs[2]! + 8 * s.u, yl, s.c('--axis'), 0.35);
      rowLabel(s, 'sum', lx, s.h * 0.82, 'green', 3.2);
      cells(s, [s.w / 2], s.h * 0.82, ['0'], 'green', { w: 15, h: 7, on: [s.win('zero', 'always')] });
    });
    caption(s, '0.25 − 0.15 − 0.10 = 0', s.h * 0.93, '--ink-2', after(s, 'zero', 0.05) * (1 - s.ease('always', 0.5)));
    caption(s, 'know all but one: the last is minus the sum of the rest', s.h * 0.93, 'green', after(s, 'always', 0.55), 3);
  },
};

// ---- scene 3: the baseline's part of the estimate cancels on average

const DL = [0.5, -0.5, -0.5];
const WB = ['0.25b', '−0.15b', '−0.10b'];
/** REINFORCE as Williams spelled it out (capitals first, then the rest of each word), beside what each part is. */
const NAME: [string[], string, Ink][] = [
  [['RE', 'ward ', 'I', 'ncrement'], 'Δθ', 'blue'],
  [['N', 'onnegative ', 'F', 'actor'], 'step size', '--ink-2'],
  [['O', 'ffset ', 'R', 'einforcement'], 'R − b', 'gold'],
  [['C', 'haracteristic ', 'E', 'ligibility'], '∂ln π/∂θ', 'red'],
];

const cancel: SceneDef = {
  marks: {
    f: { tex: String.raw`\sum_y ${P}(y)\,\dfrac{\partial \ln ${P}(y)}{\partial ${TH0}} = \sum_y \dfrac{\partial ${P}(y)}{\partial ${TH0}} = 0`, x: 0.5, y: 0.86, size: 3.9 },
    g: { tex: String.raw`\mathbb{E}\big[(\sym{R}{R} - \sym{b}{b})\,\nabla\ln ${P}\big] = \mathbb{E}\big[\sym{R}{R}\,\nabla\ln ${P}\big]`, x: 0.5, y: 0.86, size: 4.2 },
  },
  draw(s) {
    const one = 1 - s.ease('name', 0.6);
    const xs = columns(s, 3, 19);
    const lx = xs[0]! - 9.5 * s.u;
    const Y = (f: number) => s.h * f;
    s.alpha(one, () => {
      xs.forEach((x, i) => s.text(ANS[i]!, x, Y(0.1), { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
      rowLabel(s, 'π', lx, Y(0.17), 'teal', 3.4);
      const pOn = s.win('avg', 'why');
      cells(s, xs, Y(0.17), PI.map(String), 'teal', { w: 15, h: 7, on: [pOn, pOn, pOn] });
      rowLabel(s, '∂π/∂θ₀', lx, Y(0.27), 'slate', 3);
      cells(s, xs, Y(0.27), DP.map((v) => fmt(v)), 'slate', { w: 15, h: 7, on: [s.win('dlog', 'rest'), s.win('rest', 'part'), s.win('rest', 'part')].map((v) => Math.min(1, v + s.win('why', 'E'))) });
      // The slope of ln π: the slope of π divided by π.
      s.alpha(s.ease('dlog', 0.6, 1.5), () => {
        rowLabel(s, '∂ln π/∂θ₀', lx, Y(0.39), 'red', 3);
        cells(s, xs, Y(0.39), DL.map((v, i) => (i === 0 || after(s, 'rest', 0.1) > 0.5 ? fmt(v, 1) : '?')), 'red', { w: 15, h: 7, on: [s.win('dlog', 'rest'), s.win('rest', 'part'), s.win('rest', 'part')] });
        xs.forEach((x, i) => s.alpha(i === 0 ? 1 : after(s, 'rest', 0.1), () => s.text('÷ π', x, Y(0.33), { size: 2.6, font: 'mono', color: s.c('--ink-3') })));
      });
      // b's part of each estimate, then weighted by how often each answer is drawn.
      s.alpha(after(s, 'part', 0.2), () => {
        rowLabel(s, 'b · ∂ln π', lx, Y(0.5), 'green', 3);
        cells(s, xs, Y(0.5), ['+0.5b', '−0.5b', '−0.5b'], 'green', { w: 15, h: 7, on: [after(s, 'part', 0.45), after(s, 'part', 0.75), after(s, 'part', 0.75)].map((v) => v * (1 - s.ease('avg', 0.5))) });
      });
      s.alpha(after(s, 'avg', 0.15), () => {
        rowLabel(s, 'weighted', lx, Y(0.61), 'green', 3);
        cells(s, xs, Y(0.61), WB, 'green', { w: 15, h: 7, on: [s.win('avg', 'why'), s.win('avg', 'why'), s.win('avg', 'why')] });
      });
      s.alpha(after(s, 'avg', 0.75), () => {
        const yl = Y(0.66);
        s.line(xs[0]! - 8 * s.u, yl, xs[2]! + 8 * s.u, yl, s.c('--axis'), 0.35);
        rowLabel(s, 'average', lx, Y(0.72), 'green', 3);
        cells(s, [s.w / 2], Y(0.72), ['0'], 'green', { w: 15, h: 7, on: [s.win('avg', 'why')] });
      });
    });
    s.show('f', s.win('why', 'E') * one);
    s.show('g', s.ease('E', 0.6) * (1 - s.ease('williams', 0.5)));
    caption(s, 'each estimate: good up, poor down, swings less', Y(0.95), '--ink-2', s.win('noise', 'williams'), 3);
    caption(s, 'b may not depend on the answer drawn', Y(0.86), 'green', after(s, 'williams', 0.15) * one);
    cite(s, 'Williams, 1992', s.ease('williams', 0.6));
    // REINFORCE, letter by letter, beside the parts of the step it names.
    const two = s.ease('name', 0.6, 0.3);
    s.alpha(two, () => {
      const word = 'REINFORCE';
      const ks: Ink[] = ['blue', 'blue', 'blue', '--ink-2', '--ink-2', 'gold', 'gold', 'red', 'red'];
      const sz = 6;
      const cw = s.measure('M', { size: sz, font: 'mono', weight: 700 });
      word.split('').forEach((ch, i) => s.text(ch, s.w / 2 + (i - 4) * cw, Y(0.14), { size: sz, font: 'mono', weight: 700, color: s.c(ks[i]!) }));
    });
    const xl = s.w / 2 - 40 * s.u;
    const xr = s.w / 2 + 15 * s.u;
    NAME.forEach(([words, part, k], i) => {
      const y = Y(0.34 + 0.13 * i);
      s.alpha(after(s, 'name', 0.2 + 0.18 * i), () => {
        if (i > 0) s.text(i === 1 ? '=' : '×', xl - 3.5 * s.u, y, { size: 3.8, font: 'mono', color: s.c('--ink-3') });
        rich(s, words.map((w, j): [string, Ink] => [w, j % 2 ? '--ink-2' : k]), xl, y, { size: 3.8, font: 'serif', align: 'left', weight: 550 });
      });
      s.alpha(after(s, 'map', 0.15 + 0.2 * i), () => s.text(part, xr, y, { size: 3.8, font: 'mono', weight: 650, align: 'left', color: s.c(k) }));
    });
    s.alpha(after(s, 'map', 0.5), () => {
      const yb = Y(0.34 + 0.13 * 2);
      s.rrect(xr - 2 * s.u, yb - 4 * s.u, 20 * s.u, 8 * s.u, 1, { stroke: s.tint('gold', 0.8), lw: 0.35 });
    });
  },
};

// ---- scene 4: the worked problem, the third answer's slope from the other two

const G = [0.4, -1];
const W = [0.2, -0.3];

const tryIt: SceneDef = {
  marks: {
    rule: { tex: String.raw`\sum_y ${P}(y)\,\dfrac{\partial \ln ${P}(y)}{\partial ${TH0}} = 0`, x: 0.5, y: 0.09, size: 4.2 },
  },
  draw(s) {
    const xs = columns(s, 3, 17);
    const lx = xs[0]! - 9 * s.u;
    const yP = s.h * 0.3;
    const yG = s.h * 0.45;
    const yW = s.h * 0.62;
    s.show('rule', s.ease('a1', 0.6));
    s.alpha(s.ease('p1', 0.6, 0.3), () => {
      xs.forEach((x, i) => s.text(`answer ${i}`, x, yP - 7 * s.u, { size: 2.6, font: 'mono', color: s.c('--ink-3') }));
      rowLabel(s, 'π', lx, yP, 'teal', 3.6);
      cells(s, xs, yP, PI.map(String), 'teal', { w: 12, h: 7 });
    });
    s.alpha(s.ease('p1', 0.6, 4), () => {
      rowLabel(s, '∂ln π/∂θ₀', lx, yG, 'red', 3);
      const third = after(s, 'a2', 0.6);
      cells(s, xs, yG, ['0.4', '−1', third > 0.5 ? '0.5' : '?'], 'red', { w: 12, h: 7, on: [0, 0, third] });
    });
    s.alpha(after(s, 'a1', 0.2), () => {
      rowLabel(s, 'π · ∂ln π', lx, yW, 'green', 3);
      const w3 = after(s, 'a2', 0.1);
      cells(s, xs, yW, [...W.map((v) => fmt(v, 1)), w3 > 0.5 ? '0.1' : '?'], 'green', { w: 12, h: 7, on: [0, 0, w3] });
      xs.slice(0, 2).forEach((x, i) => s.text(`${PI[i]} × ${fmt(G[i]!, G[i]! % 1 ? 1 : 0)}`, x, yW + 6.5 * s.u, { size: 2.6, font: 'mono', color: s.c('--ink-3') }));
    });
    s.alpha(after(s, 'a1', 0.7) * (1 - after(s, 'a2', 0.1)), () => rich(s, [['0.2 − 0.3 = ', '--ink-2'], ['−0.1', 'green']], s.w / 2, s.h * 0.8, { size: 3.4, weight: 600 }));
    s.alpha(after(s, 'a2', 0.1), () => rich(s, [['answer 2: +0.1,  0.1 / 0.2 = ', '--ink-2'], ['0.5', 'red']], s.w / 2, s.h * 0.8, { size: 3.4, weight: 600 }));
  },
};

export const scenes: Record<string, SceneDef> = { push: pushScene, one, cancel, try: tryIt };

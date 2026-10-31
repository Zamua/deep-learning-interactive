import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp, smooth } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { caption } from '../../networks/draw';
import { after, cite } from '../../draw';
import { Frame, type Rect } from '../draw';

type View = [number, number, number, number];
const E = Math.E;

/** The plot: room on the left for heights, below for the years, the hops and a caption. */
const box = (s: Scene): Rect => [13 * s.u, 11 * s.u, s.w - 30 * s.u, s.h - 36 * s.u];
const capY = (s: Scene) => s.h - 6 * s.u;

/** The data window, eased from one view to the next as each listed beat starts. */
function view(s: Scene, keys: [string | null, View][]): View {
  let v = keys[0]![1];
  for (const [beat, next] of keys.slice(1)) {
    const k = s.ease(beat!, 1.2);
    v = v.map((x, i) => lerp(x, next[i]!, k)) as View;
  }
  return v;
}

/** A label under the x axis. */
function tick(s: Scene, F: Frame, x: number, text: string, k: Color | '--ink-3' = '--ink-3', weight = 500) {
  s.text(text, F.X(x), F.Y(0) + 3.6 * s.u, { size: 3.1, font: 'mono', weight, color: s.c(k) });
}

/** A label left of the plot, at height y. */
function height(s: Scene, F: Frame, y: number, text: string, k: Color | '--ink-3' = 'gold') {
  s.text(text, F.X(F.dom[0]) - 1.8 * s.u, F.Y(y), { size: 3.2, font: 'mono', weight: 600, align: 'right', color: s.c(k) });
}

/** One caption per beat, each fading out as the next begins; a null beat shows from the start. */
function captions(s: Scene, list: [string | null, string, (Color | '--ink-2')?][]) {
  list.forEach(([beat, text, k], i) => {
    const next = list[i + 1]?.[0];
    const a = (beat ? s.ease(beat, 0.4, 0.3) : 1) * (next ? 1 - s.ease(next, 0.3) : 1);
    s.alpha(a, () => caption(s, text, capY(s), k ?? '--ink-2', 3.5));
  });
}

// ---- one year of interest, paid more and more often

/** The money over one year with interest paid n times, drawn up to time `upto`. */
function stairs(s: Scene, F: Frame, n: number, upto: number, k: Color, width: number) {
  if (upto <= 0) return;
  const g = s.ctx;
  g.beginPath();
  g.moveTo(F.X(0), F.Y(1));
  let v = 1;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (t > upto) {
      g.lineTo(F.X(upto), F.Y(v));
      break;
    }
    g.lineTo(F.X(t), F.Y(v));
    v *= 1 + 1 / n;
    g.lineTo(F.X(t), F.Y(v));
  }
  g.strokeStyle = s.c(k);
  g.lineWidth = width * s.u;
  g.lineJoin = 'round';
  g.stroke();
}

const STAIRS: { n: number; beat: string; next: string; k: Color }[] = [
  { n: 1, beat: 'bank', next: 'half', k: 'slate' },
  { n: 2, beat: 'half', next: 'month', k: 'blue' },
  { n: 12, beat: 'month', next: 'day', k: 'teal' },
  { n: 365, beat: 'day', next: 'limit', k: 'green' },
];

/** A value at the year's end, right of the plot. */
function endLabel(s: Scene, F: Frame, v: number, text: string, k: Color, a: number) {
  s.alpha(a, () => {
    F.dot(1, v, k, 1.2);
    s.text(text, F.X(1) + 2.5 * s.u, F.Y(v), { size: 3.3, font: 'mono', weight: 650, align: 'left', color: s.c(k), halo: true });
  });
}

const grow: SceneDef = {
  draw(s) {
    const F = new Frame(s, box(s), [0, 1, 0, 3.2]);
    F.axes();
    for (const v of [1, 2, 3]) height(s, F, v, `$${v}`, '--ink-3');
    tick(s, F, 0, '0');
    tick(s, F, 1, '1 year');
    s.alpha(s.ease('half', 0.6), () => tick(s, F, 0.5, '½'));
    STAIRS.forEach(({ n, beat, next, k }) => {
      s.alpha(s.ease(beat, 0.4) * (1 - 0.75 * s.ease(next, 0.8)), () => stairs(s, F, n, s.ease(beat, 2.2, 0.3), k, 0.7));
      const v = (1 + 1 / n) ** n;
      endLabel(s, F, v, `$${v.toFixed(2)}`, k, s.ease(beat, 0.5, 2.3) * (1 - s.ease(next, 0.4)));
    });
    // Each payment multiplies by the same factor.
    s.alpha(s.win('factor', 'month'), () => {
      const o = { size: 3.3, font: 'mono', weight: 650, color: s.c('blue'), halo: true } as const;
      s.text('×1.5', F.X(0.5) + 2 * s.u, F.Y(1.25), { ...o, align: 'left' });
      s.text('×1.5', F.X(1) - 2 * s.u, F.Y(1.875), { ...o, align: 'right' });
    });
    // Nonstop growth, and the number the staircases close in on.
    F.fn(Math.exp, 'purple', 0.85, 0, Math.max(0.001, s.ease('limit', 2.2, 0.3)));
    s.alpha(after(s, 'limit', 0.55), () => F.seg(0, E, 1, E, '--ink-3', 0.3, [1.2, 1]));
    endLabel(s, F, E, '$2.718', 'purple', after(s, 'limit', 0.55));
    s.alpha(s.ease('e', 0.6), () => {
      const o = { size: 4.4, font: 'mono', weight: 650, align: 'left', color: s.c('purple'), halo: true } as const;
      s.alpha(1 - s.ease('approx', 0.5), () => s.text('e', F.X(0.03), F.Y(E) - 4 * s.u, o));
      s.alpha(s.ease('approx', 0.5), () => s.text('e ≈ 2.718', F.X(0.03), F.Y(E) - 4 * s.u, o));
    });
    cite(s, 'Jacob Bernoulli, 1690', s.win('bernoulli', 'e'));
    cite(s, 'the letter e · Leonhard Euler, 1736', s.win('e', 'natural'));
    captions(s, [
      ['bank', '1 payment of 100%:  1 × 2 = 2'],
      ['half', '2 payments of 50%:  1.5 × 1.5 = 2.25', 'blue'],
      ['factor', 'compound: each payment × 1.5', 'blue'],
      ['month', '12 payments of 1/12:  ≈ 2.61', 'teal'],
      ['day', '365 payments:  ≈ 2.71', 'green'],
      ['limit', 'growing nonstop:  ≈ 2.718', 'purple'],
      ['bernoulli', 'more than 2.5, less than 3', 'purple'],
      ['e', 'e: one year of nonstop growth', 'purple'],
    ]);
  },
};

// ---- the curve eˣ: x years of that growth

/** A point on eˣ with its label up and to the left, where the curve never is. */
function pt(s: Scene, F: Frame, x: number, label: string, a: number, la: number, on = 0) {
  const y = Math.exp(x);
  if (x < F.dom[0] || x > F.dom[1] || y > F.dom[3]) return;
  s.alpha(a, () => {
    if (on > 0.01) s.circle(F.X(x), F.Y(y), 2.4 * s.u, { stroke: s.tint('gold', on), lw: 0.4 });
    F.dot(x, y, 'gold', 1.25);
    s.alpha(la, () => s.text(label, F.X(x) - 2.2 * s.u, F.Y(y) - 2.6 * s.u, { size: 3.3, font: 'mono', weight: 650, align: 'right', color: s.c('gold'), halo: true }));
  });
}

/** "×e" under the curve between x and x + 1. */
function timesE(s: Scene, F: Frame, x: number, a: number) {
  s.alpha(a, () => s.text('×e', F.X(x + 0.5) + 2.4 * s.u, F.Y(Math.exp(x + 0.5)) + 2.2 * s.u, { size: 3.1, font: 'mono', weight: 600, align: 'left', color: s.c('--ink-3'), halo: true }));
}

/** An arrow along the years, under the axis's labels: one stretch of time. */
function hop(s: Scene, F: Frame, a: number, b: number, k: Color, label: string, al: number) {
  const y = F.Y(0) + 9 * s.u;
  s.alpha(al, () => {
    s.arrow(F.X(a), y, F.X(b), y, s.c(k), 0.5, 2.2);
    s.text(label, (F.X(a) + F.X(b)) / 2, y + 3.4 * s.u, { size: 3.1, font: 'mono', weight: 650, color: s.c(k) });
  });
}

const exp: SceneDef = {
  draw(s) {
    const V = view(s, [
      [null, [0, 1, 0, 3.2]],
      ['two', [-0.4, 2.5, 0, 8.6]],
      ['three', [-0.4, 3.4, 0, 22]],
      ['zero', [-2.6, 1.6, 0, 3.4]],
      ['add', [-0.4, 3.4, 0, 22]],
      ['pow', [-0.4, 6.6, 0, 22]],
    ]);
    const F = new Frame(s, box(s), V);
    F.axes();
    for (let x = Math.ceil(V[0] - 1e-9); x <= Math.floor(V[1] + 1e-9); x++) tick(s, F, x, String(x).replace('-', '−'));
    s.text('years', F.X(V[1]) + 1.5 * s.u, F.Y(0), { size: 3, font: 'mono', align: 'left', color: s.c('orange') });
    // The curve grows a year at a time, then fills in, then reaches back before zero.
    let xr = lerp(1, 2, s.ease('two', 1.4, 0.2));
    xr = lerp(xr, 3, s.ease('three', 1.4, 0.2));
    xr = lerp(xr, 7, s.ease('ex', 1.6, 0.3));
    const xl = lerp(0, -3, s.ease('neg', 1.6, 0.3));
    F.fn(Math.exp, 'purple', 0.85, xl, xr);

    const v2 = s.win('three', 'zero') + s.win('add', 'pow');
    const v3 = s.win('zero', 'add');
    const lab = (a: number) => Math.min(1, a);
    pt(s, F, 0, 'e⁰ = 1', 1, v3);
    pt(s, F, 1, 'e ≈ 2.72', 1, lab(1 - s.ease('three', 0.4) + v3));
    pt(s, F, 2, s.ease('power', 0.5) > 0.5 ? 'e² ≈ 7.39' : 'e · e ≈ 7.39', after(s, 'two', 0.45), lab(1 - s.ease('zero', 0.4) + s.ease('add', 0.5)), s.win('sub', 'pow') + s.win('pow'));
    pt(s, F, 3, 'e³ ≈ 20.09', after(s, 'three', 0.25), lab(v2), s.win('add', 'sub'));
    pt(s, F, -1, 'e⁻¹ ≈ 0.37', after(s, 'neg', 0.2), v3);
    pt(s, F, -2, 'e⁻² ≈ 0.14', after(s, 'neg', 0.45), v3);
    timesE(s, F, 1, after(s, 'two', 0.55) * (1 - s.ease('zero', 0.4)));
    timesE(s, F, 2, after(s, 'three', 0.4) * (1 - s.ease('zero', 0.4)));
    for (const x of [-2, -1, 0]) timesE(s, F, x, after(s, 'neg', 0.5) * (1 - s.ease('add', 0.4)));

    // The rules, as stretches of years.
    hop(s, F, 0, 2, 'orange', '2', after(s, 'add', 0.25) * (1 - s.ease('sub', 0.4)));
    hop(s, F, 2, 3, 'green', '+1', after(s, 'add', 0.38) * (1 - s.ease('sub', 0.4)));
    hop(s, F, 0, 3, 'orange', '3', s.ease('sub', 0.5, 0.3) * (1 - s.ease('pow', 0.4)));
    // A year back off: the red step overlays the end of the orange one.
    s.alpha(after(s, 'sub', 0.25) * (1 - s.ease('pow', 0.4)), () => {
      const y = F.Y(0) + 9 * s.u;
      s.arrow(F.X(3), y, F.X(2), y, s.c('red'), 0.6, 2.2);
      s.text('−1', F.X(3) + 2.2 * s.u, y, { size: 3.1, font: 'mono', weight: 650, align: 'left', color: s.c('red') });
    });
    [0, 2, 4].forEach((x, i) => hop(s, F, x, x + 2, 'orange', '2', after(s, 'pow', 0.25 + 0.1 * i)));
    s.alpha(after(s, 'pow', 0.55), () => {
      s.arrow(F.X(6), F.Y(16), F.X(6), F.Y(21.6), s.c('gold'), 0.5, 2.4);
      s.text('e⁶ ≈ 403', F.X(6) - 2.5 * s.u, F.Y(19), { size: 3.2, font: 'mono', weight: 650, align: 'right', color: s.c('gold'), halo: true });
    });

    captions(s, [
      [null, 'one year:  × e ≈ 2.72'],
      ['two', 'two years:  e × e ≈ 7.39'],
      ['power', 'e² = e · e: the 2 counts the factors'],
      ['three', 'each step right:  × e'],
      ['ex', 'eˣ: x years of growth, an exponential'],
      ['zero', 'no time yet:  e⁰ = 1'],
      ['neg', 'each step left:  ÷ e, never reaching 0'],
      ['add', 'e² · e¹ = e²⁺¹ = e³', 'orange'],
      ['rule', 'powers add:  e²⁺¹ = e² · e¹', 'orange'],
      ['sub', 'e³ / e¹ = e³⁻¹ = e²', 'red'],
      ['pow', '(e²)³ = e²⁺²⁺² = e⁶', 'orange'],
    ]);
  },
};

// ---- ln: from a height back to its years

/** ln read off the curve: across from height y to the curve, then down to x = ln y. */
function read(s: Scene, F: Frame, y: number, prog: number, k: Color) {
  if (prog <= 0) return;
  const x = Math.log(y);
  const a = Math.min(1, prog * 2);
  const b = Math.max(0, prog * 2 - 1);
  F.seg(F.dom[0], y, lerp(F.dom[0], x, a), y, k, 0.4, [1.2, 0.9]);
  if (b > 0.02 && y > 0.05) F.arrow(x, y, x, lerp(y, 0, b), k, 0.45, 2.2);
}

/** Growing for x years: up from x to the curve, then across to the height. */
function growUp(s: Scene, F: Frame, x: number, prog: number) {
  if (prog <= 0) return;
  const y = Math.exp(x);
  const a = Math.min(1, prog * 2);
  const b = Math.max(0, prog * 2 - 1);
  F.arrow(x, 0, x, lerp(0, y, a), 'gold', 0.5, 2.2);
  if (b > 0.02) F.arrow(x, y, lerp(x, F.dom[0], b), y, 'gold', 0.5, 2.2);
}

const READS: { y: number; beat: string; f: number; until: string; left: string; under: string; k: Color }[] = [
  { y: Math.exp(2), beat: 'ask', f: 0.45, until: 'one', left: '7.39', under: '2', k: 'teal' },
  { y: 1, beat: 'one', f: 0.05, until: 'undo', left: '1', under: '0', k: 'teal' },
  { y: E, beat: 'one', f: 0.5, until: 'undo', left: '2.72', under: '1', k: 'teal' },
  { y: 1 / E, beat: 'neg', f: 0.2, until: 'undo', left: '0.37', under: '−1', k: 'red' },
];

const log: SceneDef = {
  marks: {
    ask: { tex: String.raw`\ln y = \, ? \quad\text{means}\quad e^{\,?} = y`, x: 0.06, y: 0.42, size: 4.6, align: 'left' },
    undo: { tex: String.raw`\ln(e^{a}) = a`, x: 0.06, y: 0.17, size: 5, align: 'left' },
    back: { tex: String.raw`e^{\ln a} = a`, x: 0.06, y: 0.17, size: 5, align: 'left' },
    q: { tex: String.raw`\ln(e^{4} \cdot e^{-1}) = \, ?`, x: 0.5, y: 0.28, size: 5.2 },
    sum: { tex: String.raw`e^{4} \cdot e^{-1} = e^{4 + (-1)} = e^{3}`, x: 0.5, y: 0.47, size: 5.2 },
    ans: { tex: String.raw`\ln(e^{3}) = 3`, x: 0.5, y: 0.66, size: 5.2 },
  },
  draw(s) {
    const L1: View = [-2.6, 2.6, 0, 8.6];
    const V = view(s, [[null, L1], ['one', [-2.6, 1.6, 0, 3.4]], ['undo', L1]]);
    const F = new Frame(s, box(s), V);
    s.alpha(1 - s.ease('try', 0.8), () => {
      F.axes();
      s.text('years', F.X(V[1]) + 1.5 * s.u, F.Y(0), { size: 3, font: 'mono', align: 'left', color: s.c('orange') });
      F.fn(Math.exp, 'purple', 0.85);
      READS.forEach(({ y, beat, f, until, left, under, k }) => {
        const prog = after(s, beat, f, 1.4);
        const a = 1 - s.ease(until, 0.5);
        s.alpha(a, () => {
          read(s, F, y, prog, k);
          s.alpha(Math.min(1, prog * 4), () => height(s, F, y, left));
          s.alpha(smooth((prog - 0.85) / 0.15), () => tick(s, F, Math.log(y), under, k === 'red' ? 'red' : 'orange', 650));
        });
      });
      // Below one, every log is negative.
      s.alpha(after(s, 'neg', 0.6) * (1 - s.ease('undo', 0.5)), () => {
        const y = F.Y(0) + 8.5 * s.u;
        s.line(F.X(V[0]), y, F.X(0), y, s.tint('red', 0.7), 0.6);
        s.text('negative logs', (F.X(V[0]) + F.X(0)) / 2, y + 3.2 * s.u, { size: 3.1, font: 'mono', weight: 600, color: s.c('red') });
      });
      // Grow a years, then ln reads the same path back.
      s.alpha(s.win('undo', 'back'), () => {
        const a = 1.5;
        growUp(s, F, a, after(s, 'undo', 0.25, 1.4));
        read(s, F, Math.exp(a), after(s, 'undo', 0.62, 1.2), 'teal');
        tick(s, F, a, 'a', 'orange', 650);
        s.alpha(after(s, 'undo', 0.45), () => height(s, F, Math.exp(a), 'eᵃ'));
      });
      // From a height a: ln finds its years, and growing that long comes back to a.
      s.alpha(s.ease('back', 0.5), () => {
        const a = 5;
        height(s, F, a, 'a');
        read(s, F, a, after(s, 'back', 0.2, 1.2), 'teal');
        s.alpha(after(s, 'back', 0.4), () => tick(s, F, Math.log(a), 'ln a', 'teal', 650));
        growUp(s, F, Math.log(a), after(s, 'back', 0.6, 1.2));
      });
    });
    s.show('ask', s.win('y', 'natural'));
    s.show('undo', s.ease('undo', 0.6, 0.5) * (1 - s.ease('back', 0.4)));
    s.show('back', s.ease('back', 0.6, 0.5) * (1 - s.ease('try', 0.4)));
    s.show('q', s.ease('try', 0.6, 0.4));
    s.show('sum', after(s, 'solve', 0.1));
    s.show('ans', after(s, 'solve', 0.65));
    cite(s, 'the word logarithm · John Napier, 1614', s.win('natural', 'one'));
    captions(s, [
      ['ask', 'how many years to reach 7.39?  2', 'teal'],
      ['ln', 'ln 7.39 = 2', 'teal'],
      ['y', ''],
      ['natural', 'ln: the natural log, counting factors of e', 'teal'],
      ['one', 'ln 1 = 0      ln e = 1', 'teal'],
      ['neg', 'ln 0.37 = −1: below 1, a negative log', 'red'],
      ['minus', '−ln 0.37 = 1', 'green'],
      ['none', '0 and below: never a height, so no log'],
      ['undo', 'grow a years, then ask how many: a', 'gold'],
      ['back', 'find the years to reach a, grow: back at a', 'gold'],
      ['try', ''],
    ]);
  },
};

export const scenes: Record<string, SceneDef> = { grow, exp, log };

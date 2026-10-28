import type { Scene, SceneDef } from '../../../lecture/scene';
import { after, Frame, mono, type Ink } from '../draw';

const sq = (x: number) => x * x;
const cube = (x: number) => x * x * x;
const H = 0.1;

/** The plot above the text unless the stage is wide enough to hold them side by side; `row(i)` is the i-th text line. */
function layout(s: Scene, plotTo = 0.72) {
  const u = s.u;
  const tall = s.tall || s.w / s.h < 1.45;
  return {
    tall,
    plot: tall ? [12 * u, 5 * u, s.w - 6 * u, s.h * plotTo] : [12 * u, 6 * u, s.w * 0.6, s.h - 8 * u],
    tx: tall ? s.w / 2 : (s.w * 0.6 + s.w) / 2,
    room: tall ? s.w - 10 * u : s.w * 0.4 - 8 * u,
    row: (i: number) => (tall ? s.h * (plotTo + 0.08) + i * 6.2 * u : s.h * 0.26 + i * 9 * u),
  };
}

function frame(s: Scene, dom: [number, number, number, number], plotTo?: number): Frame {
  const [l, t, r, b] = layout(s, plotTo).plot as [number, number, number, number];
  return new Frame(s, l, t, r, b, dom);
}

/** A line of text in the layout's text area, as colored runs. */
function say(s: Scene, i: number, runs: [string, Ink][], a = 1, size = 3.6, plotTo?: number): void {
  if (a <= 0.003) return;
  const L = layout(s, plotTo);
  const full = s.measure(runs.map(([t]) => t).join(''), { size, font: 'mono', weight: 600 });
  const o = { size: full > L.room ? (size * L.room) / full : size, font: 'mono' as const, weight: 600 };
  const ws = runs.map(([t]) => s.measure(t, o));
  let x = L.tx - ws.reduce((p, w) => p + w, 0) / 2;
  s.alpha(a, () =>
    runs.forEach(([t, k], j) => {
      s.text(t, x, L.row(i), { ...o, align: 'left', color: s.c(k), halo: true });
      x += ws[j]!;
    }),
  );
}

/** The straight line through (x0, y0) with slope m, across the plot. */
function line(F: Frame, x0: number, y0: number, m: number, k: Ink, width = 0.5, dash?: number[]): void {
  F.fn((x) => y0 + m * (x - x0), k, width, undefined, undefined, dash);
}

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

// ---- backprop's slope, with a slip in it, beside the curve it should touch

const why: SceneDef = {
  draw(s) {
    const F = frame(s, [0.8, 5.2, -2, 27]);
    const u = s.u;
    F.fn(sq, 'teal', 0.8);
    F.dot(3, 9, 'teal', 1.5);
    mono(s, 'f(x) = x²', F.l + 2 * u, F.t + 3 * u, 'teal', 3.8, 'left', 650);
    mono(s, 'x = 3', F.X(3), F.Y(9) + 5 * u, '--ink-3', 3.3);
    const wrong = s.ease('wrong', 0.8, 1.2);
    s.alpha(wrong, () => {
      line(F, 3, 9, 3, 'blue', 0.6);
      mono(s, 'backprop: slope 3', F.X(5.15), F.Y(7.5), 'blue', 3.4, 'right', 650);
    });
    // Two nudges either side of 3, where the slope can be measured.
    s.alpha(s.ease('measure', 0.6, 2.5), () => {
      F.dot(2.6, sq(2.6), 'gold', 1.1);
      F.dot(3.4, sq(3.4), 'gold', 1.1);
    });
    say(s, 0, [['slope 2x = 6 at x = 3', 'teal']], s.win('slip', 'bottou'));
    say(s, 1, [['x where 2x belongs: says 3', 'blue']], s.win('wrong', 'bottou'));
    say(s, 0, [['slightly wrong: it still runs,', '--ink-2']], s.win('bottou', 'measure'));
    say(s, 1, [['often slowly and erratically', '--ink-2']], s.win('bottou', 'measure'));
    say(s, 0, [['measure the slope from f', 'gold']], s.ease('measure', 0.6, 2.5));
    say(s, 1, [['one more run of f per input', '--ink-2']], s.ease('cost', 0.6));
    cite(s, 'Léon Bottou, 2012', s.win('bottou', 'cost'));
  },
};

// ---- the centered difference on x² at 3

function nplot(s: Scene): Frame {
  return new Frame(s, 12 * s.u, s.h * 0.24, s.w - 8 * s.u, s.h * 0.92, [2.55, 3.45, 6.4, 11.8]);
}

const numeric: SceneDef = {
  marks: { c: { tex: String.raw`\frac{f(x + h) - f(x - h)}{2h} = \frac{1.2}{0.2} = 6`, x: 0.5, y: 0.11, size: 4.6 } },
  draw(s) {
    const F = nplot(s);
    const u = s.u;
    F.fn(sq, 'teal', 0.8);
    F.dot(3, 9, 'teal');
    mono(s, 'x = 3', F.X(3), F.b - 3 * u, '--ink-3', 3.4);
    mono(s, 'f(x) = x²', F.l + 2 * u, F.t + 3 * u, 'teal', 3.8, 'left', 650);
    s.show('c', after(s, 'divide', 0.25) * (1 - s.ease('one', 0.4)));
    const sides = after(s, 'sides', 0.35);
    const vals = 1 - s.win('caught', 'one');
    s.alpha(sides, () => {
      for (const x of [3 - H, 3 + H]) s.line(F.X(x), F.Y(sq(x)), F.X(x), F.b, s.tint('--ink-3', 0.6), 0.25, [1, 1]);
      F.dot(3 - H, sq(3 - H), 'gold');
      F.dot(3 + H, sq(3 + H), 'gold');
      s.alpha(vals, () => mono(s, '9.61', F.X(3 + H) + 2.4 * u, F.Y(sq(3 + H)) + 1.6 * u, 'gold', 3.6, 'left', 650));
      s.alpha(vals, () => mono(s, '8.41', F.X(3 - H) - 2 * u, F.Y(sq(3 - H)) - 3.4 * u, 'gold', 3.6, 'right', 650));
      mono(s, '2.9', F.X(3 - H), F.b - 3 * u, '--ink-3', 3.2, 'right');
      mono(s, '3.1', F.X(3 + H), F.b - 3 * u, '--ink-3', 3.2, 'left');
    });
    // Rise over run between the two side points.
    const runA = after(s, 'divide', 0.1) * (1 - s.ease('caught', 0.5));
    s.alpha(after(s, 'divide', 0.1), () => line(F, 3, 9, 6, 'gold', 0.6));
    s.alpha(runA, () => {
      const yb = F.Y(sq(3 - H));
      s.line(F.X(3 - H), yb, F.X(3 + H), yb, s.c('--ink-2'), 0.35);
      s.line(F.X(3 + H), yb, F.X(3 + H), F.Y(sq(3 + H)), s.c('--ink-2'), 0.35);
      mono(s, 'run 2h = 0.2', F.X(3), yb + 4.6 * u, '--ink-2', 3.3);
      mono(s, 'rise 1.2', F.X(3 + H) + 2 * u, F.Y(9), '--ink-2', 3.3, 'left');
    });
    // Notes stack in the empty upper left, under the curve's name.
    const note = (i: number, text: string, k: Ink) => mono(s, text, F.l + 2 * u, F.t + 9 * u + i * 5 * u, k, 3.5, 'left', 650);
    s.alpha(s.win('name', 'caught'), () => note(0, 'centered: x − h and x + h', 'gold'));
    // Backprop's slope against the measured one.
    s.alpha(s.win('caught', 'one'), () => {
      line(F, 3, 9, 3, 'blue', 0.6);
      note(0, 'backprop: 3', 'blue');
      note(1, 'measured: 6', 'gold');
      note(2, 'they disagree: a bug', 'red');
    });
    s.alpha(after(s, 'one', 0.2), () => {
      line(F, 3, 9, 6.1, 'red', 0.45);
      note(0, 'one-sided: 6.1', 'red');
      note(1, 'centered: 6.0', 'gold');
    });
  },
};

// ---- x³ at 1: the one-sided secant lags, the centered one hugs the tangent

const ERR_TO = 0.62;

/** The step: a tenth until it shrinks to a hundredth, sliding on a log scale. */
const stepAt = (s: Scene) => 0.1 * 10 ** -s.ease('shrink', 2.2, 1.2);

/** Up to four decimals, without trailing zeros, and a real minus sign. */
const dec = (v: number) => {
  const t = (Math.abs(v) < 5e-5 ? 0 : v).toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  return t.replace('-', '−');
};

const error: SceneDef = {
  draw(s) {
    const F = frame(s, [0.8, 1.2, 0.45, 1.8], ERR_TO);
    const u = s.u;
    const h = stepAt(s);
    F.fn(cube, 'teal', 0.8);
    mono(s, 'f(x) = x³', F.l + 2 * u, F.t + 3 * u, 'teal', 3.8, 'left', 650);
    mono(s, 'x = 1', F.X(1), F.b - 3 * u, '--ink-3', 3.3);
    line(F, 1, 1, 3, 'green', 0.45, [1.2, 1]);
    const one = s.ease('one', 0.6, 0.6);
    const mid = s.ease('mid', 0.6, 0.6);
    const left = s.ease('left', 0.6, 0.6) * (1 - s.ease('shrink', 0.6));
    const sOne = (cube(1 + h) - 1) / h;
    const sMid = (cube(1 + h) - cube(1 - h)) / (2 * h);
    const sLeft = (1 - cube(1 - h)) / h;
    s.alpha(left, () => line(F, 1, 1, sLeft, 'purple', 0.45));
    s.alpha(one, () => line(F, 1, 1, sOne, 'red', 0.45));
    s.alpha(mid, () => line(F, 1 + h, cube(1 + h), sMid, 'gold', 0.6));
    s.alpha(Math.max(one, mid), () => F.dot(1 + h, cube(1 + h), 'red', 1.1));
    s.alpha(Math.max(mid, left), () => F.dot(1 - h, cube(1 - h), mid > left ? 'gold' : 'purple', 1.1));
    F.dot(1, 1, 'teal', 1.3);

    const T = ERR_TO;
    say(s, 0, [['true slope 3x² = 3', 'green']], 1 - s.ease('one', 0.5), 3.6, T);
    say(s, 0, [['h = ', '--ink-2'], [dec(h), '--ink']], s.ease('one', 0.5), 3.6, T);
    say(s, 1, [['one-sided ', 'red'], [dec(sOne), '--ink'], [`  off ${dec(sOne - 3)}`, '--ink-2']], one, 3.4, T);
    say(s, 2, [['centered  ', 'gold'], [dec(sMid), '--ink'], [`  off ${dec(sMid - 3)}`, '--ink-2']], mid, 3.4, T);
    say(s, 3, [['left step ', 'purple'], [dec(sLeft), '--ink'], [`  off ${dec(sLeft - 3)}`, '--ink-2']], left * (1 - s.ease('cancel', 0.5)), 3.4, T);
    say(s, 3, [['(3.31 + 2.71) / 2 = ', '--ink-2'], ['3.01', 'gold']], s.win('cancel', 'shrink'), 3.4, T);
    say(s, 3, [['error ÷ 10', 'red'], ['   ', '--ink-2'], ['error ÷ 100', 'gold']], s.ease('order', 0.6, 0.8), 3.4, T);
  },
};

// ---- the relative error and where it lands

/** Position on a log axis from 1e-10 to 1, for the relative-error scale. */
const logX = (s: Scene, v: number) => {
  const l = 12 * s.u;
  const r = s.w - 10 * s.u;
  return l + ((Math.log10(v) + 10) / 10) * (r - l);
};

const BANDS: [number, number, 'green' | 'gold' | 'red', string, string][] = [
  [1e-10, 1e-6, 'green', 'right', 'ok'],
  [1e-6, 1e-3, 'gold', 'suspicious', 'sus'],
  [1e-3, 1, 'red', 'bug', 'bug'],
];
const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '4': '⁴', '7': '⁷' };
const pow10 = (e: number) => (e === 0 ? '1' : `10${String(e).replace(/./g, (c) => SUP[c]!)}`);

const compare: SceneDef = {
  marks: {
    abs: { tex: String.raw`|a - n|`, x: 0.5, y: 0.11, size: 5 },
    rel: { tex: String.raw`\text{rel} = \frac{|a - n|}{\max(|a|,\, |n|)}`, x: 0.5, y: 0.11, size: 5 },
  },
  draw(s) {
    const u = s.u;
    s.show('abs', s.win('abs', 'rel'));
    s.show('rel', s.ease('rel', 0.6));
    const tall = s.tall;
    const lx = s.w / 2 - (tall ? 44 : 48) * u;
    const nx = s.w / 2 - (tall ? 12 : 14) * u;
    const right = s.w / 2 + (tall ? 44 : 48) * u;
    // What a and n are, before the examples.
    s.alpha(s.win('a', 'gap'), () => mono(s, 'a: backprop, from formulas', s.w / 2, s.h * 0.27, 'blue', 3.6, 'center', 650));
    s.alpha(s.win('n', 'gap'), () => mono(s, 'n: measured, from values of f', s.w / 2, s.h * 0.37, 'gold', 3.6, 'center', 650));
    // Two pairs off by the same 0.0001.
    const rows: [string, string, string, Ink][] = [
      ['a = 1000.0000', 'n = 1000.0001', 'rel ≈ 10⁻⁷', 'green'],
      ['a = 0.0002', 'n = 0.0003', 'rel ≈ 0.33', 'red'],
    ];
    rows.forEach(([ta, tn, r, k], i) => {
      const y = s.h * (0.27 + 0.1 * i);
      const swap = after(s, 'rel', 0.5 + 0.2 * i);
      s.alpha(after(s, 'gap', 0.3 + 0.25 * i), () => {
        mono(s, ta, lx, y, 'blue', 3.4, 'left', 600);
        mono(s, tn, nx, y, 'gold', 3.4, 'left', 600);
        s.alpha(1 - swap, () => mono(s, 'off 0.0001', right, y, '--ink-2', 3.4, 'right', 550));
      });
      s.alpha(swap, () => mono(s, r, right, y, k, 3.6, 'right', 650));
    });
    // The scale of verdicts, one band per beat.
    const ya = s.h * 0.62;
    const axis = s.ease('ok', 0.6);
    s.alpha(axis, () => {
      for (const e of [-10, -7, -4, -2, 0]) {
        const x = logX(s, 10 ** e);
        s.line(x, ya + 3 * u, x, ya + 4.4 * u, s.c('--ink-3'), 0.3);
        if (e > -10) mono(s, pow10(e), x, ya + 7.6 * u, '--ink-3', 3.1, e === 0 ? 'right' : 'center', 500);
      }
      s.line(logX(s, 1e-10), ya + 3 * u, logX(s, 1), ya + 3 * u, s.c('--axis'), 0.3);
    });
    for (const [lo, hi, k, name, beat] of BANDS) {
      s.alpha(s.ease(beat, 0.6), () => {
        const x0 = logX(s, lo);
        const x1 = logX(s, hi);
        s.rrect(x0, ya - 3 * u, x1 - x0, 6 * u, 1, { fill: s.tint(k, 0.18), stroke: s.tint(k, 0.6), lw: 0.3 });
        mono(s, name, (x0 + x1) / 2, ya - 6.6 * u, k, 3.5, 'center', 650);
      });
    }
    s.alpha(s.win('ok', 'sus'), () => mono(s, 'in code, 10⁻⁷ is written 1e-7', s.w / 2, s.h * 0.86, '--ink-3', 3.3, 'center', 550));
    // Where the examples land.
    const pin = (v: number, k: Ink, a: number) =>
      s.alpha(a, () => {
        const x = logX(s, v);
        s.arrow(x, ya - 12 * u, x, ya - 3.6 * u, s.c(k), 0.45, 2);
      });
    pin(1e-7, 'green', after(s, 'ok', 0.4));
    pin(0.33, 'red', after(s, 'bug', 0.4) * (1 - s.ease('ex', 0.5)));
    pin(0.5, 'red', after(s, 'ex', 0.6));
    s.alpha(after(s, 'ex', 0.2), () => {
      mono(s, 'x for 2x:  a = 3,  n = 6', s.w / 2, s.h * 0.82, '--ink-2', 3.5, 'center', 600);
      mono(s, 'rel = 3 / 6 = 0.5', s.w / 2, s.h * 0.9, 'red', 3.8, 'center', 650);
    });
  },
};

export const scenes: Record<string, SceneDef> = { why, numeric, error, compare };

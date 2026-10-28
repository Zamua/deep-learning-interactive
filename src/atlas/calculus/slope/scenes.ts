import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { after, Frame, inset, note } from '../draw';

type Ink = Color | `--${string}`;

const f = (x: number) => x * x;

/** One window for every scene: the bottom of x² on the left, its climb past x = 2 on the right. */
const frame = (s: Scene) => new Frame(s, inset(s, 0.06, 0.06, 0.07), [-1.5, 2.7, -0.9, 6.4]);

/** Who introduced an idea, and when: small, at the bottom right, where the curve never reaches. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, s.h - 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

const lab = (s: Scene, k: Ink, align: CanvasTextAlign = 'center', size = 3.4) =>
  ({ size, font: 'mono', weight: 600, align, color: s.c(k), halo: true }) as const;

/** A run-then-rise triangle from (x0, y0) to (x1, y1), with its two legs labelled. */
function triangle(s: Scene, F: Frame, x0: number, y0: number, x1: number, y1: number, run: string, rise: string, a: number) {
  s.alpha(a, () => {
    F.seg(x0, y0, x1, y0, '--ink-3', 0.4, [1.2, 1]);
    F.seg(x1, y0, x1, y1, '--ink-3', 0.4, [1.2, 1]);
    if (run) s.text(run, (F.X(x0) + F.X(x1)) / 2, F.Y(y0) + 3.6 * s.u, lab(s, '--ink-2'));
    if (rise) s.text(rise, F.X(x1) + 2 * s.u, (F.Y(y0) + F.Y(y1)) / 2, lab(s, '--ink-2', 'left'));
  });
}

/** A tick label under the x axis. */
const tick = (s: Scene, F: Frame, x: number, text: string, a: number) =>
  s.alpha(a, () => s.text(text, F.X(x), F.Y(0) + 3.4 * s.u, { size: 3.2, font: 'mono', color: s.c('--ink-3'), halo: true }));

// ---- the question, and straight lines, where it is easy

const LINES: { beat: string; until: string; g: (x: number) => number; k: Ink; text: string }[] = [
  { beat: 'line', until: 'shift', g: (x) => 2 * x + 1, k: '--ink-2', text: '2x + 1: up 2 per step of 1' },
  { beat: 'shift', until: 'fall', g: (x) => 2 * x - 2, k: 'teal', text: '2x − 2: lower, slope 2' },
  { beat: 'fall', until: 'forms', g: (x) => 4 - 3 * x, k: 'red', text: '4 − 3x: slope −3' },
  { beat: 'forms', until: 'half', g: (x) => 3 * x - 3, k: 'gold', text: '3(x − 1) = 3x − 3: slope 3' },
  { beat: 'half', until: 'curve', g: (x) => x + 2, k: 'blue', text: '(2x + 4) / 2 = x + 2: slope 1' },
];

const steep: SceneDef = {
  draw(s) {
    const F = frame(s);
    F.axes();
    s.text('x', F.X(2.7) - 1.5 * s.u, F.Y(0) - 3 * s.u, { size: 3.4, font: 'mono', weight: 650, color: s.c('orange'), halo: true });
    const lines = s.win('line', 'curve');
    // The curve, dimmed while the lines are on.
    s.alpha(1 - 0.85 * lines, () => F.fn(f, 'purple', 0.8));

    // A walker climbs the curve with a short straight edge riding along, then stops at x = 1.
    const xw = s.since('ask') < 0 ? lerp(-1.25, 2.25, smooth(s.prog('walk') * 1.1)) : lerp(2.25, 1, s.ease('ask', 1.4));
    const walker = 1 - s.ease('tangent', 0.6);
    s.alpha(walker * (1 - lines), () => {
      F.tangent(xw, f(xw), 2 * xw, 'gold', xw - 0.4, xw + 0.4, 0.7);
      F.dot(xw, f(xw), 'purple', 1.3);
    });
    s.alpha(s.win('ask', 'tangent'), () => s.text('how steep, here?', F.X(1) - 3 * s.u, F.Y(1) - 5 * s.u, lab(s, 'purple', 'right', 3.6)));
    tick(s, F, 1, '1', s.ease('ask', 0.6) * (1 - lines));

    // The tangent at x = 1: it touches at one point.
    const tan = s.win('tangent', 'line') + s.ease('curve', 0.6);
    s.alpha(tan, () => {
      F.tangent(1, 1, 2, 'teal', -0.4, 2.4, 0.7);
      F.dot(1, 1, 'purple', 1.3);
      s.text('tangent', F.X(1.75) + 1.5 * s.u, F.Y(2.5) + 4.5 * s.u, lab(s, 'teal', 'left', 3.6));
    });
    s.alpha(s.win('tangent', 'leibniz'), () => note(s, F, 'touches at one point', 0, 'teal', 3.6));
    cite(s, 'Leibniz, Nova Methodus, 1684', s.win('leibniz', 'line'));
    s.alpha(s.win('leibniz', 'line'), () => note(s, F, 'a new method for tangents', 0, '--ink-2', 3.6));

    // Lines: one slope everywhere.
    LINES.forEach((L, i) => {
      // Each line shows on its own beats; 2x + 1 stays on faintly beside 2x − 2 to show the same tilt.
      const faint = i === 0 ? 0.3 * s.win('shift', 'fall') : 0;
      s.alpha(Math.max(s.win(L.beat, L.until), faint), () => F.fn(L.g, L.k, 0.7));
    });
    triangle(s, F, 0.5, 2, 1.5, 4, '1', '2', s.win('two', 'run'));
    triangle(s, F, 0, 1, 2, 5, 'run 2', 'rise 4', s.win('run', 'shift'));
    // Their notes sit on a card, since the falling line crosses them.
    s.alpha(lines, () => {
      const w = s.measure('(2x + 4) / 2 = x + 2: slope 1', { size: 3.6, font: 'mono', weight: 600 }) + 4 * s.u;
      s.rrect(F.X(F.dom[0]) + 1 * s.u, F.Y(F.dom[3]) - 0.5 * s.u, w, 16 * s.u, 1.5, { fill: s.tint('--card', 0.92) });
      note(s, F, 'y = mx + b', 0, '--ink', 4.4);
    });
    s.alpha(s.win('line', 'two'), () => note(s, F, 'm: the slope', 1, '--ink-2', 3.6));
    LINES.forEach((L, i) => s.alpha(i === 0 ? s.win('two', 'run') : s.win(L.beat, L.until), () => note(s, F, L.text, 1, L.k, 3.6)));
    s.alpha(s.win('run', 'shift'), () => note(s, F, 'rise / run = 4 / 2 = 2', 1, 'gold', 3.6));

    // Back to the curve: one point gives no run.
    s.alpha(s.ease('curve', 0.6, 1.2), () => note(s, F, 'rise / run needs two points', 0, 'purple', 3.6));
  },
};

// ---- two points on the curve, and the slope between them

const two: SceneDef = {
  marks: {
    formula: { tex: String.raw`\text{slope} = \dfrac{\symf(\symx + h) - \symf(\symx)}{h}`, x: 0.34, y: 0.17, size: 4.4 },
  },
  draw(s) {
    const F = frame(s);
    F.axes();
    F.fn(f, 'purple', 0.8);
    const named = s.ease('sq', 0.6);
    s.alpha(s.ease('f', 0.6) * (1 - named), () => s.text('f', F.X(Math.sqrt(5.6)) - 3 * s.u, F.Y(5.6), lab(s, 'purple', 'right', 4.2)));
    s.alpha(named, () => s.text('f(x) = x²', F.X(Math.sqrt(5.6)) - 3 * s.u, F.Y(5.6), lab(s, 'purple', 'right', 3.8)));
    s.alpha(s.win('f', 'sq'), () => note(s, F, 'input x, output f(x)', 0, '--ink-2', 3.6));
    // f(2) = 4: up from the input, across to the output.
    s.alpha(s.win('sq', 'h'), () => {
      F.seg(2, 0, 2, 4, 'orange', 0.4, [1.2, 1]);
      F.seg(2, 4, 0, 4, 'purple', 0.4, [1.2, 1]);
      F.dot(2, 4, 'purple', 1.2);
      tick(s, F, 2, '2', 1);
      s.text('4', F.X(0) - 2.5 * s.u, F.Y(4), lab(s, 'purple', 'right', 3.2));
      note(s, F, 'f(2) = 2 × 2 = 4', 0, 'purple', 3.6);
    });
    const pts = s.ease('h', 0.6);
    s.alpha(pts, () => {
      F.dot(1, 1, 'purple', 1.3);
      F.dot(2, 4, 'purple', 1.3);
      tick(s, F, 1, '1', 1);
      tick(s, F, 2, '2', 1);
    });
    // h, the step, as a bracket above the axis.
    s.alpha(s.ease('h', 0.6, 0.8), () => {
      F.arrow(1, 0.35, 2, 0.35, 'gold', 0.45, 2);
      s.text('h = 1', F.X(1.5), F.Y(0.35) - 3 * s.u, lab(s, 'gold', 'center', 3.4));
    });
    triangle(s, F, 1, 1, 2, 4, '', 'rise 3', s.ease('rise', 0.6));
    s.alpha(s.win('rise', 'flip'), () => note(s, F, 'rise = 4 − 1 = 3', 0, '--ink', 3.8));
    s.alpha(s.win('flip', 'slope'), () => note(s, F, '1 − 4 = −3: backwards', 0, 'red', 3.8));
    s.alpha(s.win('slope', 'formula'), () => note(s, F, 'slope = 3 / 1 = 3', 0, 'gold', 3.8));
    // The secant through both points.
    s.alpha(s.ease('secant', 0.8), () => {
      F.tangent(1, 1, 3, 'gold', -0.2, 2.45, 0.7);
      s.text('secant', F.X(0.45) - 1.5 * s.u, F.Y(-0.55), lab(s, 'gold', 'right', 3.6));
    });
    s.alpha(s.win('secant', 'formula'), () => note(s, F, 'it cuts the curve twice', 1, 'gold', 3.6));
    s.show('formula', s.ease('formula', 0.7));
  },
};

// ---- shrink the step until the secant becomes the tangent

/** h on a log scale: 1 to 0.5 as "half" starts, 0.5 to 0.1 as "tenth" starts, then 0.1 to 0.001 across "tiny". */
function hAt(s: Scene): number {
  const l = (a: number, b: number, t: number) => Math.exp(lerp(Math.log(a), Math.log(b), smooth(t)));
  if (s.since('tiny') >= 0) {
    const p = s.prog('tiny');
    return p < 0.5 ? l(0.1, 0.01, clamp01(p / 0.25)) : l(0.01, 0.001, clamp01((p - 0.5) / 0.2));
  }
  if (s.since('tenth') >= 0) return l(0.5, 0.1, clamp01(s.prog('tenth') / 0.35));
  return l(1, 0.5, clamp01(s.prog('half') / 0.35));
}

const trim = (v: string) => v.replace(/0+$/, '').replace(/\.$/, '');
/** The step with two significant figures; the slope, 2 + h, with as many decimals as h shows. */
const fmtH = (h: number) => trim(h >= 0.1 ? h.toFixed(2) : h >= 0.01 ? h.toFixed(3) : h.toFixed(4));
const fmtM = (m: number, h: number) => trim(m.toFixed(h >= 0.095 ? 2 : 3));

const shrink: SceneDef = {
  draw(s) {
    const F = frame(s);
    F.axes();
    const line = s.ease('line', 0.7);
    s.alpha(1 - 0.85 * line, () => F.fn(f, 'purple', 0.8));
    const h = hAt(s);
    const m = (f(1 + h) - f(1)) / h;
    const tan = s.ease('tangent', 0.8);
    s.alpha((1 - tan) * (1 - line), () => {
      F.tangent(1, 1, m, 'gold', -0.3, 2.5, 0.7);
      if (h > 0.03) F.dot(1 + h, f(1 + h), 'purple', 1.1);
    });
    s.alpha(1 - line, () => F.dot(1, 1, 'purple', 1.3));
    tick(s, F, 1, '1', 1 - line);
    // The run and rise, while the triangle is big enough to label.
    const big = clamp01((h - 0.3) / 0.15) * (1 - line);
    triangle(s, F, 1, 1, 1 + h, f(1 + h), h > 0.75 ? '1' : '0.5', h > 0.75 ? '3' : '1.25', big);
    // A live readout of the step and the slope over it.
    s.alpha((1 - s.ease('zero', 0.5)) * (1 - line), () => note(s, F, `h = ${fmtH(h)}   slope = ${fmtM(m, h)}`, 0, 'gold', 3.8));
    s.alpha(s.win('pin', 'half'), () => note(s, F, 'slope of the stretch 1 to 2', 1, '--ink-2', 3.6));
    s.alpha(s.win('zero', 'limit'), () => {
      note(s, F, 'h = 0:  0 / 0 = ?', 0, 'red', 3.8);
      note(s, F, 'no answer', 1, 'red', 3.6);
    });
    s.alpha(s.win('limit', 'derived'), () => {
      note(s, F, 'h shrinks: slope nears 2', 0, 'teal', 3.8);
      note(s, F, 'the limit: 2', 1, 'teal', 3.6);
    });
    s.alpha(s.win('derived', 'line'), () => note(s, F, s.since('prime') < 0 ? 'derivative at 1: 2' : 'f′(1) = 2', 0, 'teal', 4.4));
    s.alpha(s.win('derived', 'prime'), () => note(s, F, 'derived from f', 1, '--ink-2', 3.6));
    s.alpha(s.win('cauchy', 'tangent'), () => note(s, F, 'limit of rise / run', 1, '--ink-2', 3.6));
    cite(s, 'Lagrange, 1797: « fonction dérivée »', s.win('derived', 'cauchy'));
    cite(s, 'Cauchy, Résumé des leçons, 1823', s.win('cauchy', 'tangent'));
    // The tangent, which the secant has become.
    s.alpha(tan * (1 - line), () => {
      F.tangent(1, 1, 2, 'teal', -0.4, 2.4, 0.75);
      s.text('tangent', F.X(1.75) + 1.5 * s.u, F.Y(2.5) + 4.5 * s.u, lab(s, 'teal', 'left', 3.6));
    });
    s.alpha(s.win('tangent', 'line'), () => note(s, F, 'slope 2, touching at 1', 1, 'teal', 3.6));

    // A straight line: the same slope at every x, whatever its height.
    const g = (x: number) => 3 * x - 1;
    s.alpha(line, () => {
      F.fn(g, '--ink-2', 0.75);
      note(s, F, '3x − 1:  f′(x) = 3 at every x', 0, '--ink', 3.8);
    });
    triangle(s, F, 0, g(0), 1, g(1), '1', '3', s.win('line', 'height') * after(s, 'line', 0.4));
    triangle(s, F, 1, g(1), 2, g(2), '1', '3', s.ease('line', 0.6, 0.4) * after(s, 'line', 0.5));
    s.alpha(s.ease('height', 0.6), () => {
      F.seg(2, 0, 2, g(2), 'purple', 0.45, [1.2, 1]);
      F.dot(2, g(2), 'purple', 1.3);
      tick(s, F, 2, '2', 1);
      s.text('height 5', F.X(2) - 2 * s.u, F.Y(0.6), lab(s, 'purple', 'right', 3.4));
      note(s, F, 'f′(2) = 3: slope', 1, 'teal', 3.6);
      note(s, F, 'f(2) = 5: height', 2, 'purple', 3.6);
    });
  },
};

export const scenes: Record<string, SceneDef> = { steep, two, shrink };

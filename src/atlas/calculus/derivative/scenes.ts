import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../../lecture/scene';
import { after, Frame, inset, note } from '../draw';

const f = (x: number) => x * x;
const f2 = (v: number) => v.toFixed(2);

/** The frame for scenes on f(x) = x² near x = 1. */
const nearOne = (s: Scene) => new Frame(s, inset(s, 0.06, 0.07, 0.07), [-0.6, 2.7, -0.6, 6.3]);

/** A run then rise triangle under a secant from (x0, f(x0)) to (x1, f(x1)). */
function stepTriangle(s: Scene, F: Frame, x0: number, x1: number, run: string, rise: string, a: number) {
  s.alpha(a, () => {
    F.seg(x0, f(x0), x1, f(x0), '--ink-3', 0.4, [1.2, 1]);
    F.seg(x1, f(x0), x1, f(x1), '--ink-3', 0.4, [1.2, 1]);
    s.text(run, (F.X(x0) + F.X(x1)) / 2, F.Y(f(x0)) + 3.6 * s.u, { size: 3.4, font: 'mono', color: s.c('--ink-2'), halo: true });
    s.text(rise, F.X(x1) + 2 * s.u, (F.Y(f(x0)) + F.Y(f(x1))) / 2, { size: 3.4, font: 'mono', align: 'left', color: s.c('--ink-2'), halo: true });
  });
}

const slope: SceneDef = {
  marks: {
    factor: { tex: String.raw`3(\symx - 1) = 3\symx - 3`, x: 0.55, y: 0.45, size: 5.2 },
    half: { tex: String.raw`\dfrac{2\symx + 4}{2} = \symx + 2`, x: 0.55, y: 0.65, size: 5.2 },
    formula: { tex: String.raw`\text{slope} = \dfrac{\symf(\symx + h) - \symf(\symx)}{h}`, x: 0.36, y: 0.33, size: 4.6 },
  },
  draw(s) {
    const F = nearOne(s);
    F.axes();
    // Lines first: one slope everywhere, whatever the constant.
    const gone = 1 - s.ease('curve', 0.6);
    // Dimmed while the rewritten lines are on.
    const dim = gone * (1 - 0.8 * s.ease('forms', 0.6));
    s.alpha(s.ease('line', 0.6) * dim, () => {
      F.fn((x) => 2 * x + 1, '--ink-2', 0.7);
      note(s, F, '2x + 1: slope 2', 0, '--ink-2');
    });
    s.alpha(s.win('line', 'shift'), () => {
      F.seg(0.5, 2, 1.5, 2, '--ink-3', 0.4, [1.2, 1]);
      F.seg(1.5, 2, 1.5, 4, '--ink-3', 0.4, [1.2, 1]);
      s.text('1', F.X(1), F.Y(2) + 3.6 * s.u, { size: 3.6, font: 'mono', color: s.c('--ink-2'), halo: true });
      s.text('2', F.X(1.5) + 2 * s.u, F.Y(3), { size: 3.6, font: 'mono', align: 'left', color: s.c('--ink-2'), halo: true });
    });
    s.alpha(s.ease('shift', 0.6) * dim, () => {
      F.fn((x) => 2 * x - 2, 'teal', 0.7);
      note(s, F, '2x − 2: slope 2', 1, 'teal');
    });
    s.alpha(s.ease('fall', 0.6) * dim, () => {
      F.fn((x) => -3 * x + 4, 'red', 0.7);
      note(s, F, '−3x + 4: slope −3', 2, 'red');
    });
    s.show('factor', s.win('forms', 'curve'));
    s.show('half', s.ease('forms', 0.6, 2.2) * gone);
    const cA = s.ease('curve', 0.7);
    s.alpha(cA, () => {
      F.fn(f, 'purple', 0.8);
      F.dot(1, 1, 'purple');
      s.text('f(x) = x²', F.X(Math.sqrt(5.4)) - 3 * s.u, F.Y(5.4), { size: 3.8, font: 'mono', weight: 600, align: 'right', color: s.c('purple'), halo: true });
    });
    const tick = (x: number, a: number) => s.alpha(a, () => s.text(String(x), F.X(x), F.Y(0) + 3.4 * s.u, { size: 3.2, font: 'mono', color: s.c('--ink-3'), halo: true }));
    tick(1, cA);
    tick(2, s.ease('two', 0.6));
    const tA = s.ease('two', 0.7);
    s.alpha(tA, () => {
      F.tangent(1, 1, 3, 'gold', -0.6, 2.7);
      F.dot(2, 4, 'purple');
    });
    stepTriangle(s, F, 1, 2, 'h = 1', 'rise 3', s.ease('two', 0.6, 0.6));
    s.alpha(s.ease('rise', 0.6), () => note(s, F, 'slope = 3 / 1 = 3', 0, 'gold'));
    s.show('formula', s.ease('formula', 0.7));
  },
};

/** h on a log scale: 1 to 0.5 early in "shrink", 0.5 to 0.1 early in "tenth", then toward 0 in "limit". */
function hAt(s: Scene): number {
  const l = (a: number, b: number, t: number) => Math.exp(lerp(Math.log(a), Math.log(b), smooth(t)));
  if (s.prog('limit') > 0) return l(0.1, 0.002, clamp01(s.prog('limit') / 0.6));
  if (s.prog('tenth') > 0) return l(0.5, 0.1, clamp01(s.prog('tenth') / 0.25));
  return l(1, 0.5, clamp01((s.prog('shrink') - 0.05) / 0.2));
}

/** The worked secant for one step: f at the far point, the rise, then rise over run, each with the voice. */
function worked(s: Scene, F: Frame, beat: string, h: number, a: number) {
  const x1 = 1 + h;
  const rise = f(x1) - 1;
  const n = (v: number) => String(+v.toFixed(2));
  s.alpha(a, () => {
    s.alpha(after(s, beat, 0.12), () => note(s, F, `h = ${n(h)}: f(${n(x1)}) = ${n(f(x1))}`, 0, '--ink-2'));
    s.alpha(after(s, beat, 0.4), () => note(s, F, `rise = ${n(f(x1))} − 1 = ${n(rise)}`, 1, '--ink-2'));
    s.alpha(after(s, beat, 0.62), () => note(s, F, `slope = ${n(rise)} / ${n(h)} = ${n(rise / h)}`, 2, 'gold'));
  });
}

const shrink: SceneDef = {
  draw(s) {
    const F = nearOne(s);
    F.axes();
    F.fn(f, 'purple', 0.8);
    const h = hAt(s);
    const m = (f(1 + h) - f(1)) / h;
    const tan = s.ease('tangent', 0.8);
    s.alpha(1 - tan, () => F.tangent(1, 1, m, 'gold', -0.6, 2.7));
    s.alpha(tan, () => F.tangent(1, 1, 2, 'teal', -0.6, 2.7, 0.75));
    F.dot(1, 1, 'purple');
    s.alpha(clamp01((h - 0.03) / 0.05), () => F.dot(1 + h, f(1 + h), 'purple', 1.1));
    const tri = clamp01((h - 0.25) / 0.2);
    stepTriangle(s, F, 1, 1 + h, 'h', '', tri);
    s.alpha(tri * after(s, 'shrink', 0.4), () => s.text('1.25', F.X(1.5) + 2 * s.u, (F.Y(1) + F.Y(2.25)) / 2, { size: 3.4, font: 'mono', align: 'left', color: s.c('--ink-2'), halo: true }));
    worked(s, F, 'shrink', 0.5, 1 - s.ease('tenth', 0.4));
    worked(s, F, 'tenth', 0.1, s.ease('tenth', 0.5, 0.3) * (1 - s.ease('limit', 0.4)));
    const lim = s.ease('limit', 0.6, 1.2);
    s.alpha((1 - after(s, 'shrink', 0.1)) + s.ease('limit', 0.5, 0.3) * (1 - lim), () => note(s, F, `h = ${f2(h)}   slope = ${f2(m)}`, 0, 'gold'));
    s.alpha(lim, () => note(s, F, "f′(1) = 2", 0, 'teal', 4.6));
    s.alpha(s.ease('line', 0.7), () => {
      F.fn((x) => 2 * x + 1, '--ink-2', 0.6);
      note(s, F, '2x + 1: f′(x) = 2 at every x', 1, '--ink-2', 3.6);
    });
  },
};

/** A close-up of x² around x = 1, where a nudge of 0.01 is visible. */
const close = (s: Scene) => new Frame(s, inset(s, 0.08, 0.08, 0.08), [0.973, 1.027, 0.945, 1.055]);

/** The run and rise of a nudge from x = 1 to 1 + dx, along the tangent. */
function nudgeStep(s: Scene, F: Frame, dx: number, run: string, rise: string, a: number) {
  s.alpha(a, () => {
    F.seg(1, 1, 1 + dx, 1, '--ink-2', 0.45, [1.2, 1]);
    F.arrow(1 + dx, 1, 1 + dx, 1 + 2 * dx, 'gold', 0.55, 2.2);
    F.dot(1 + dx, f(1 + dx), 'purple', 1.1);
    const side = dx > 0 ? 1 : -1;
    s.text(run, F.X(1 + dx / 2), F.Y(1) + side * 3.8 * s.u, { size: 3.5, font: 'mono', color: s.c('--ink-2'), halo: true });
    s.text(rise, F.X(1 + dx) + side * 2 * s.u, F.Y(1 + dx), { size: 3.5, font: 'mono', weight: 600, align: dx > 0 ? 'left' : 'right', color: s.c('gold'), halo: true });
  });
}

const nudge: SceneDef = {
  marks: {
    rule: { tex: String.raw`\Delta \symf \approx \symf'(\symx)\,\Delta \symx`, x: 0.7, y: 0.84, size: 5 },
  },
  draw(s) {
    const F = close(s);
    F.tangent(1, 1, 2, 'teal', 0.973, 1.027, 0.5);
    F.fn(f, 'purple', 0.8);
    F.dot(1, 1, 'purple');
    s.alpha(1 - s.ease('right', 0.4), () => s.text('x = 1', F.X(1) + 2 * s.u, F.Y(1) + 3.6 * s.u, { size: 3.3, font: 'mono', align: 'left', color: s.c('--ink-3'), halo: true }));
    s.alpha(s.ease('rate', 0.6), () => note(s, F, "f′(1) = 2: f moves 2× as much as x", 0, 'teal', 3.6));
    nudgeStep(s, F, 0.01, '+0.01', '≈ +0.02', s.ease('right', 0.6));
    s.alpha(s.ease('value', 0.6), () => note(s, F, 'f(1.01) ≈ 1 + 0.02 = 1.02', 1, 'gold', 3.6));
    nudgeStep(s, F, -0.01, '−0.01', '≈ −0.02', s.ease('left', 0.6));
    s.alpha(s.ease('left', 0.6, 0.8), () => note(s, F, 'f(0.99) ≈ 1 − 0.02 = 0.98', 2, 'gold', 3.6));
    s.show('rule', s.ease('rule', 0.7));
  },
};

const wide = (s: Scene) => new Frame(s, inset(s, 0.07, 0.07, 0.06), [-2.3, 2.3, -0.8, 5.4]);

const sign: SceneDef = {
  draw(s) {
    const F = wide(s);
    F.axes();
    F.fn(f, 'purple', 0.8);
    let p = lerp(lerp(lerp(-2, -1.5, s.ease('slide', 1.2, 0.6)), 0, s.ease('zero', 1.4)), 1.5, s.ease('pos', 1.4));
    p = lerp(lerp(lerp(p, -1.5, s.ease('height', 1.2)), 1, s.ease('table', 1.2)), 0, s.ease('dip', 1.2));
    const m = 2 * p;
    const k = m < -0.3 ? 'red' : m > 0.3 ? 'green' : 'teal';
    F.tangent(p, f(p), m, k, p - 0.95, p + 0.95, 0.7);
    F.dot(p, f(p), 'purple');
    const word = m < -0.3 ? 'going down' : m > 0.3 ? 'going up' : 'flat';
    const row = (i: number) => F.Y(4.9) + i * 5.6 * s.u;
    const line = (t: string, i: number, c: Parameters<Scene['c']>[0], w = 500) => s.text(t, s.w / 2, row(i), { size: 3.6, font: 'mono', weight: w, color: s.c(c), halo: true });
    s.alpha(1 - s.ease('height', 0.5), () => s.text(`slope ${m < -0.05 ? '−' : ''}${Math.abs(m).toFixed(1)}: ${word}`, s.w / 2, row(0), { size: 3.9, font: 'mono', weight: 650, color: s.c(k), halo: true }));
    const hA = s.win('height', 'table', 0.5);
    s.alpha(hA * s.ease('height', 0.6, 1), () => {
      F.seg(-1.5, 0, -1.5, 2.25, 'purple', 0.45, [1.2, 1]);
      line('f(−1.5) = 2.25: high up', 0, 'purple');
      line('slope −3: still going down', 1, 'red', 650);
    });
    s.alpha(s.win('table', 'dip', 0.5), () => {
      line('f(0.9) = 0.81', 0, '--ink-2');
      line('f(1)   = 1   ', 1, '--ink-2');
      line('f(1.1) = 1.21', 2, '--ink-2');
      line('rising: f′(1) > 0', 3, 'green', 650);
    });
    s.alpha(s.ease('dip', 0.5), () => {
      line('f(−0.1) = 0.01', 0, '--ink-2');
      line('f(0)    = 0   ', 1, '--ink-2');
      line('f(0.1)  = 0.01', 2, '--ink-2');
      line('down, then up: f′(0) = 0', 3, 'teal', 650);
    });
  },
};

export const scenes: Record<string, SceneDef> = { slope, shrink, nudge, sign };

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
    // The readout runs while the voice reads the shrinking slopes, then gives way to f′(1).
    const lim = after(s, 'limit', 0.55, 0.6);
    s.alpha((1 - after(s, 'shrink', 0.1)) + s.ease('limit', 0.5, 0.3) * (1 - lim), () => note(s, F, `h = ${f2(h)}   slope = ${f2(m)}`, 0, 'gold'));
    s.alpha(lim, () => note(s, F, "f′(1) = 2", 0, 'teal', 4.6));
    s.alpha(s.ease('line', 0.7), () => {
      F.fn((x) => 2 * x + 1, '--ink-2', 0.6);
      note(s, F, '2x + 1: f′(x) = 2 at every x', 1, '--ink-2', 3.6);
    });
  },
};

export const scenes: Record<string, SceneDef> = { slope, shrink };

import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { after, Frame, gate, mono, name, pulse, runAfter, wire } from '../draw';

const sig = (x: number) => 1 / (1 + Math.exp(-x));
const slope = (x: number) => sig(x) * (1 - sig(x));

/** A labelled point: a dot on the curve and text beside it. */
function mark(s: Scene, F: Frame, x: number, y: number, text: string, k: 'teal' | 'red' | 'gold', align: CanvasTextAlign, dy = -4): void {
  F.dot(x, y, k);
  mono(s, text, F.X(x) + (align === 'left' ? 2.6 : align === 'right' ? -2.6 : 0) * s.u, F.Y(y) + dy * s.u, k, 3.8, align, 650);
}

/** The sigmoid's plot between `top` and `bottom` (fractions of the stage height). */
function sigFrame(s: Scene, top: number, bottom: number, x1 = 6): Frame {
  return new Frame(s, 10 * s.u, s.h * top, s.w - 8 * s.u, s.h * bottom, [-x1, x1, -0.08, 1.08]);
}

function guides(s: Scene, F: Frame, a = 1): void {
  s.alpha(a, () => {
    for (const y of [0, 1]) {
      s.line(F.X(F.dom[0]), F.Y(y), F.X(F.dom[1]), F.Y(y), s.c('--grid'), 0.25, [1, 1]);
      s.text(String(y), F.l - 2.4 * s.u, F.Y(y), { size: 3.2, font: 'mono', align: 'right', color: s.c('--ink-3') });
    }
    s.line(F.X(0), F.Y(-0.08), F.X(0), F.Y(1.08), s.c('--axis'), 0.25);
  });
}

/** One sigmoid node on a row: x in from the left, the output out to the right. */
function node(s: Scene, y: number, o: { x: string; out: string; up: string; dx: string; ua: number; da: number; run: [string, number] }): void {
  const x0 = s.w / 2 - 34 * s.u;
  const g = s.w / 2 + 4 * s.u;
  const x1 = s.w / 2 + 34 * s.u;
  name(s, x0, y, 'x', 'orange');
  wire(s, x0, y, g, y, { r1: 5, val: o.x, grad: o.dx, ga: o.da, size: 3.8 });
  wire(s, g, y, x1, y, { r0: 5, val: o.out, grad: o.up, ga: o.ua, size: 3.8 });
  gate(s, g, y, 'σ', '--ink-2', 0.3);
  pulse(s, x1, y, g, y, runAfter(s, o.run[0], o.run[1], 0.8), 'red');
  pulse(s, g, y, x0, y, runAfter(s, o.run[0], o.run[1] + 0.15, 0.8), 'red');
}

const curve: SceneDef = {
  marks: { f: { tex: String.raw`\sigma(x) = \frac{1}{1 + e^{-x}}`, x: 0.5, y: 0.11, size: 5.4 } },
  draw(s) {
    const F = sigFrame(s, 0.27, 0.9);
    const a = s.ease('def', 0.6);
    s.show('f', a);
    guides(s, F, a);
    const grow = s.ease('def', 2, 0.4);
    F.fn(sig, 'teal', 0.8, -6, lerp(-6, 6, grow));
    s.alpha(after(s, 'zero', 0.4), () => mark(s, F, 0, 0.5, 'σ(0) = 0.5', 'teal', 'left', 3));
    s.alpha(after(s, 'two', 0.7), () => mark(s, F, 2, sig(2), 'σ(2) ≈ 0.88', 'teal', 'right', -1));
    s.alpha(after(s, 'two', 0.3), () => mono(s, 'e⁻² ≈ 0.14', F.r - 2 * s.u, F.Y(0.32), '--ink-2', 3.6, 'right'));
    s.alpha(after(s, 'two', 0.6), () => mono(s, '1 / 1.14 ≈ 0.88', F.r - 2 * s.u, F.Y(0.32) + 5 * s.u, '--ink-2', 3.6, 'right'));
    // The working for x = -2 sits in the empty upper left.
    s.alpha(after(s, 'neg', 0.3), () => mono(s, 'e² ≈ 7.39', F.l + 2 * s.u, F.Y(0.68), '--ink-2', 3.6, 'left'));
    s.alpha(after(s, 'neg', 0.55), () => mono(s, '1 / 8.39 ≈ 0.12', F.l + 2 * s.u, F.Y(0.68) + 5 * s.u, '--ink-2', 3.6, 'left'));
    s.alpha(after(s, 'neg', 0.6), () => mark(s, F, -2, sig(-2), 'σ(−2) ≈ 0.12', 'teal', 'right', -3));
  },
};

/** The measurements under the curve: [text, colour, beat, fraction into it]. */
const READ: [string, 'gold' | 'red' | '--ink-2', string, number][] = [
  ['σ(0.01) − σ(0) = 0.5025 − 0.5 = 0.0025', '--ink-2', 'nudge', 0.55],
  ['slope ≈ 0.0025 / 0.01 = 0.25', 'gold', 'measure', 0.15],
  ['σ(1 − σ) = 0.5 × 0.5 = 0.25', 'red', 'measure', 0.7],
  ['σ(2.01) − σ(2) ≈ 0.00105', '--ink-2', 'two', 0.3],
  ['slope ≈ 0.00105 / 0.01 ≈ 0.105', 'gold', 'two', 0.7],
  ['σ(1 − σ) ≈ 0.881 × 0.119 ≈ 0.105', 'red', 'match', 0.6],
];

const measure: SceneDef = {
  marks: {
    m: { tex: String.raw`\text{slope} \approx \frac{\sigma(x + 0.01) - \sigma(x)}{0.01}`, x: 0.5, y: 0.1, size: 4.6 },
    f: { tex: String.raw`\frac{d\sigma}{dx} = \sigma\,(1 - \sigma)`, x: 0.5, y: 0.1, size: 5.2 },
  },
  draw(s) {
    const rule = s.ease('rule', 0.6);
    s.show('m', s.ease('nudge', 0.6) * (1 - rule));
    s.show('f', rule);
    const F = sigFrame(s, 0.22, 0.52);
    guides(s, F);
    F.fn(sig, 'teal', 0.7);
    s.alpha(after(s, 'nudge', 0.2), () => mark(s, F, 0, 0.5, 'x = 0', 'teal', 'left', 3));
    s.alpha(after(s, 'two', 0.1), () => mark(s, F, 2, sig(2), 'x = 2', 'teal', 'left', 3.6));
    const x0 = s.w / 2 - 40 * s.u;
    READ.forEach(([text, k, id, f], i) => {
      const y = s.h * (0.6 + 0.062 * i) + (i >= 3 ? 2.4 * s.u : 0);
      s.alpha(after(s, id, f), () => mono(s, text, x0, y, k, 3.5, 'left', k === '--ink-2' ? 550 : 650));
    });
  },
};

const slopeScene: SceneDef = {
  marks: { f: { tex: String.raw`\frac{d\sigma}{dx} = \sigma\,(1 - \sigma)`, x: 0.5, y: 0.1, size: 5.2 } },
  draw(s) {
    s.show('f', 1);
    const F = new Frame(s, 10 * s.u, s.h * 0.24, s.w - 8 * s.u, s.h * 0.58, [-6, 6, 0, 0.3]);
    F.axes();
    F.fn(slope, 'red', 0.8, -6, lerp(-6, 6, s.ease('plot', 1.6, 0.3)));
    s.text('slope', F.l + 1.5 * s.u, F.t + 1.5 * s.u, { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c('red') });
    const peak = after(s, 'plot', 0.55);
    const most = s.ease('most', 0.5);
    s.alpha(peak, () => {
      s.line(F.X(-6), F.Y(0.25), F.X(6), F.Y(0.25), s.tint('red', 0.6 + 0.4 * most), 0.25 + 0.2 * most, [1, 1]);
      mono(s, 'max 0.25', F.X(0) + 3 * s.u, F.Y(0.25) - 3.4 * s.u, 'red', 3.6, 'left', 650);
    });
    // The point being read, sliding from the peak to x = 2.
    const at = lerp(0, 2, s.ease('chain', 1.2, 0.2));
    s.alpha(peak, () => F.dot(at, slope(at), 'red'));
    s.alpha(after(s, 'chain', 0.25), () => mono(s, '0.105', F.X(2) + 2.6 * s.u, F.Y(slope(2)) - 2 * s.u, 'red', 3.6, 'left', 650));
    const y = s.h * 0.76;
    s.alpha(after(s, 'chain', 0.3), () =>
      node(s, y, { x: '2', out: '0.881', up: '2', dx: '0.21', ua: after(s, 'chain', 0.45), da: after(s, 'chain', 0.7), run: ['chain', 0.5] }),
    );
    const out = 1 - s.ease('most', 0.4);
    s.alpha(after(s, 'chain', 0.72) * out, () => mono(s, '∂f/∂x = 2 × 0.105 ≈ 0.21', s.w / 2, s.h * 0.91, 'red', 3.6, 'center', 650));
    s.alpha(after(s, 'most', 0.5), () => mono(s, 'at most 0.25 × 2 = 0.5', s.w / 2, s.h * 0.91, 'red', 3.6, 'center', 650));
  },
};

const flat: SceneDef = {
  marks: { f: { tex: String.raw`\sigma(6) \approx 0.9975`, x: 0.5, y: 0.1, size: 5.2 } },
  draw(s) {
    s.show('f', s.ease('six', 0.6, 0.6));
    const F = new Frame(s, 10 * s.u, s.h * 0.22, s.w - 8 * s.u, s.h * 0.6, [-8, 8, -0.08, 1.08]);
    guides(s, F);
    F.fn(sig, 'teal', 0.7);
    s.alpha(s.ease('six', 0.6), () => {
      const c = s.ctx;
      c.fillStyle = s.tint('gold', 0.08);
      c.fillRect(F.X(4), F.t, F.r - F.X(4), F.b - F.t);
      c.fillRect(F.l, F.t, F.X(-4) - F.l, F.b - F.t);
      mono(s, 'flat', F.X(6), F.Y(0.62), 'gold', 3.4, 'center', 600);
      mono(s, 'flat', F.X(-6), F.Y(0.38), 'gold', 3.4, 'center', 600);
    });
    s.alpha(after(s, 'six', 0.5), () => F.dot(6, sig(6), 'teal'));
    s.alpha(after(s, 'tiny', 0.6), () => {
      s.line(F.X(4.5), F.Y(sig(6) - 1.5 * slope(6)), F.X(7.5), F.Y(sig(6) + 1.5 * slope(6)), s.c('red'), 0.5);
      mono(s, 'slope ≈ 0.0025', F.r - 1 * s.u, F.Y(0.82), 'red', 3.6, 'right', 650);
    });
    // The mirror image at x = -6, its working in the empty upper left.
    s.alpha(after(s, 'mirror', 0.3), () => {
      F.dot(-6, sig(-6), 'teal');
      mono(s, 'σ(−6) ≈ 0.0025', F.l + 1 * s.u, F.Y(0.86), 'teal', 3.6, 'left', 650);
    });
    s.alpha(after(s, 'mirror', 0.75), () => {
      s.line(F.X(-7.5), F.Y(sig(-6) - 1.5 * slope(-6)), F.X(-4.5), F.Y(sig(-6) + 1.5 * slope(-6)), s.c('red'), 0.5);
      mono(s, 'slope ≈ 0.0025', F.l + 1 * s.u, F.Y(0.86) + 5 * s.u, 'red', 3.6, 'left', 650);
    });
    // One sigmoid node: what arrives from above, and what gets through to x.
    s.alpha(s.ease('dead', 0.6), () => node(s, s.h * 0.8, { x: '6', out: '0.9975', up: '1', dx: '0.0025', ua: 1, da: after(s, 'dead', 0.35), run: ['dead', 0.05] }));
  },
};

export const scenes: Record<string, SceneDef> = { curve, measure, slope: slopeScene, flat };

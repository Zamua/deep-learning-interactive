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

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number): void {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** The sigmoid's plot between `top` and `bottom` (fractions of the stage height). */
function sigFrame(s: Scene, top: number, bottom: number, x1 = 6, y1 = 1.08): Frame {
  return new Frame(s, 10 * s.u, s.h * top, s.w - 8 * s.u, s.h * bottom, [-x1, x1, -0.08, y1]);
}

/** Dotted lines at heights 0 and 1, the y axis, and their tick labels. */
function guides(s: Scene, F: Frame, a = 1, ys = [0, 1]): void {
  s.alpha(a, () => {
    for (const y of ys) {
      s.line(F.X(F.dom[0]), F.Y(y), F.X(F.dom[1]), F.Y(y), s.c('--grid'), 0.25, [1, 1]);
      s.text(String(y), F.l - 2.4 * s.u, F.Y(y), { size: 3.2, font: 'mono', align: 'right', color: s.c('--ink-3') });
    }
    s.line(F.X(0), F.Y(F.dom[2]), F.X(0), F.Y(F.dom[3]), s.c('--axis'), 0.25);
  });
}

/** The tangent at x: a short line with the curve's slope there. */
function tangent(s: Scene, F: Frame, x: number, half = 1.8): void {
  const m = slope(x);
  s.line(F.X(x - half), F.Y(sig(x) - m * half), F.X(x + half), F.Y(sig(x) + m * half), s.c('red'), 0.5);
}

// ---- scene 1: growth that levels off, and the S it draws

const grow: SceneDef = {
  marks: { f: { tex: String.raw`\sigma(x) = \frac{1}{1 + e^{-x}}`, x: 0.5, y: 0.11, size: 5.4 } },
  draw(s) {
    const F = sigFrame(s, 0.27, 0.9, 6, 1.24);
    guides(s, F, 1, [0]);
    // e^x, which leaves the top of the plot.
    const ex = (1 - 0.6 * s.ease('S', 0.8)) * (1 - s.ease('squash', 0.6));
    s.alpha(ex, () => {
      F.fn(Math.exp, 'gold', 0.7, -6, lerp(-6, 1, s.ease('exp', 1.6, 0.2)));
      s.alpha(after(s, 'exp', 0.5), () => mono(s, 'eˣ', F.X(0.25) + 2 * s.u, F.Y(1.2), 'gold', 4, 'left', 650));
    });
    // The limit the population cannot pass.
    s.alpha(s.ease('room', 0.6, 0.6), () => {
      s.line(F.X(-6), F.Y(1), F.X(6), F.Y(1), s.tint('--ink-2', 0.8), 0.35, [1.4, 1]);
      s.text('1', F.l - 2.4 * s.u, F.Y(1), { size: 3.2, font: 'mono', align: 'right', color: s.c('--ink-3') });
      s.alpha(1 - s.ease('S', 0.5, 1.5), () => mono(s, 'the limit', F.X(5.8), F.Y(1) - 3.2 * s.u, '--ink-2', 3.2, 'right', 600));
    });
    cite(s, 'Verhulst, 1838', s.ease('verhulst', 0.6, 0.3));
    // The S follows e^x on the left, then bends under the limit.
    F.fn(sig, 'teal', 0.8, -6, lerp(-6, 6, s.ease('S', 2.2, 0.4)));
    s.alpha(s.ease('name', 0.6, 0.6) * (1 - s.ease('zero', 0.5)), () => mono(s, 'σ', F.X(2.4) + 2 * s.u, F.Y(sig(2.4)) + 5 * s.u, 'teal', 4.6, 'left', 700));
    s.show('f', s.ease('def', 0.6, 0.3));
    // Between nothing and all.
    s.alpha(s.win('squash', 'zero'), () => {
      const c = s.ctx;
      c.fillStyle = s.tint('teal', 0.07);
      c.fillRect(F.l, F.Y(1), F.r - F.l, F.Y(0) - F.Y(1));
      mono(s, 'near 0', F.X(-4.5), F.Y(0.16), 'teal', 3.2, 'center', 600);
      mono(s, 'near 1', F.X(5), F.Y(0.8), 'teal', 3.2, 'center', 600);
    });
    s.alpha(after(s, 'zero', 0.4), () => mark(s, F, 0, 0.5, 'σ(0) = 0.5', 'teal', 'left', 3));
    s.alpha(after(s, 'two', 0.3), () => mono(s, 'e⁻² ≈ 0.14', F.r - 2 * s.u, F.Y(0.28), '--ink-2', 3.6, 'right'));
    s.alpha(after(s, 'two', 0.6), () => mono(s, '1 / 1.14 ≈ 0.88', F.r - 2 * s.u, F.Y(0.28) + 5 * s.u, '--ink-2', 3.6, 'right'));
    s.alpha(after(s, 'two', 0.7), () => mark(s, F, 2, sig(2), 'σ(2) ≈ 0.88', 'teal', 'right', -1));
    // The working for x = -2 sits in the empty upper left.
    s.alpha(after(s, 'neg', 0.3), () => mono(s, 'e² ≈ 7.39', F.l + 2 * s.u, F.Y(0.68), '--ink-2', 3.6, 'left'));
    s.alpha(after(s, 'neg', 0.55), () => mono(s, '1 / 8.39 ≈ 0.12', F.l + 2 * s.u, F.Y(0.68) + 5 * s.u, '--ink-2', 3.6, 'left'));
    s.alpha(after(s, 'neg', 0.6), () => mark(s, F, -2, sig(-2), 'σ(−2) ≈ 0.12', 'teal', 'right', -3));
  },
};

// ---- scene 2: the slope, measured, then read off Verhulst's rule

/** Where the point being read sits: 0, slid to 2, back to 0 for the rule, then 2 again. */
function readAt(s: Scene): number {
  return lerp(0, 2, s.ease('slide', 2.2, 0.2)) * (1 - s.ease('rule', 1, 0.3)) + 2 * s.ease('p2', 1, 0.1);
}

const slopeScene: SceneDef = {
  marks: {
    q: { tex: String.raw`\frac{d\sigma}{dx} = \ ?`, x: 0.5, y: 0.1, size: 5 },
    f: { tex: String.raw`\frac{d\sigma}{dx} = \sigma\,(1 - \sigma)`, x: 0.5, y: 0.1, size: 5.2 },
  },
  draw(s) {
    const rule = s.ease('formula', 0.6);
    s.show('q', s.ease('need', 0.6, 0.6) * (1 - rule));
    s.show('f', rule);
    const F = sigFrame(s, 0.22, 0.7, 5);
    guides(s, F);
    F.fn(sig, 'teal', 0.7);
    const x = readAt(s);
    const ys = sig(x);
    // How much there is, and the room left, as two bars at the point.
    s.alpha(s.ease('rule', 0.6, 0.6), () => {
      const bx = F.X(x);
      s.line(bx, F.Y(0), bx, F.Y(ys), s.tint('teal', 0.75), 1.2);
      s.line(bx, F.Y(ys), bx, F.Y(1), s.tint('gold', 0.75), 1.2);
      mono(s, 'σ', bx - 1.8 * s.u, F.Y(ys / 2), 'teal', 3.4, 'right', 700);
      mono(s, '1 − σ', bx - 1.8 * s.u, F.Y((1 + ys) / 2), 'gold', 3.4, 'right', 700);
    });
    s.alpha(s.ease('need', 0.6, 0.4), () => {
      tangent(s, F, x);
      F.dot(x, ys, 'teal');
    });
    s.alpha(after(s, 'need', 0.6) * (1 - s.ease('n0', 0.4)), () => mono(s, 'slope?', F.X(x) + 3 * s.u, F.Y(ys) + 4 * s.u, 'red', 3.6, 'left', 650));
    // The measured slope, read live as the point slides.
    s.alpha(after(s, 'n0', 0.6), () => mono(s, `slope ≈ ${slope(x).toFixed(3).replace(/0$/, '')}`, F.X(x) + 3 * s.u, F.Y(ys) + 4 * s.u, 'red', 3.6, 'left', 650));
    const ya = s.h * 0.8;
    const yb = s.h * 0.88;
    s.alpha(s.win('n0', 'slide') * after(s, 'n0', 0.5), () => mono(s, 'rise 0.0025 / run 0.01 = 0.25', s.w / 2, ya, '--ink-2', 3.4, 'center', 600));
    s.alpha(s.win('n2', 'rule') * after(s, 'n2', 0.5), () => mono(s, 'rise 0.00105 / run 0.01 ≈ 0.105', s.w / 2, ya, '--ink-2', 3.4, 'center', 600));
    s.alpha(s.ease('rule', 0.6, 0.8), () => mono(s, 'growth = how much there is × room left', s.w / 2, ya, '--ink', 3.3, 'center', 600));
    s.alpha(s.win('p0', 'p2') * after(s, 'p0', 0.3), () => mono(s, 'σ(1 − σ) = 0.5 × 0.5 = 0.25', s.w / 2, yb, 'red', 3.6, 'center', 650));
    s.alpha(after(s, 'p2', 0.4), () => mono(s, 'σ(1 − σ) ≈ 0.881 × 0.119 ≈ 0.105', s.w / 2, yb, 'red', 3.6, 'center', 650));
  },
};

// ---- scene 3: the slope as a hill, and one sigmoid node passing a gradient back

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

const nodeScene: SceneDef = {
  marks: { f: { tex: String.raw`\frac{d\sigma}{dx} = \sigma\,(1 - \sigma)`, x: 0.5, y: 0.1, size: 5.2 } },
  draw(s) {
    s.show('f', 1);
    const F = new Frame(s, 10 * s.u, s.h * 0.24, s.w - 8 * s.u, s.h * 0.58, [-6, 6, 0, 0.3]);
    F.axes();
    F.fn(slope, 'red', 0.8, -6, lerp(-6, 6, s.ease('plot', 1.6, 0.3)));
    s.text('slope', F.l + 1.5 * s.u, F.t + 1.5 * s.u, { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c('red') });
    const peak = after(s, 'plot', 0.5);
    const most = s.ease('most', 0.5);
    s.alpha(peak, () => {
      s.line(F.X(-6), F.Y(0.25), F.X(6), F.Y(0.25), s.tint('red', 0.6 + 0.4 * most), 0.25 + 0.2 * most, [1, 1]);
      mono(s, 'peak 0.25', F.X(0) + 3 * s.u, F.Y(0.25) - 3.4 * s.u, 'red', 3.6, 'left', 650);
    });
    // The point being read, sliding from the peak to x = 2.
    const at = lerp(0, 2, s.ease('chain', 1.2, 0.2));
    s.alpha(peak, () => F.dot(at, slope(at), 'red'));
    s.alpha(after(s, 'chain', 0.4), () => mono(s, '0.105', F.X(2) + 2.6 * s.u, F.Y(slope(2)) - 2 * s.u, 'red', 3.6, 'left', 650));
    const y = s.h * 0.76;
    s.alpha(after(s, 'chain', 0.3), () =>
      node(s, y, { x: '2', out: '0.881', up: '2', dx: '0.21', ua: after(s, 'chain', 0.75), da: after(s, 'dx', 0.6), run: ['dx', 0.15] }),
    );
    const out = 1 - s.ease('most', 0.4);
    s.alpha(after(s, 'dx', 0.65) * out, () => mono(s, '∂f/∂x = 2 × 0.105 ≈ 0.21', s.w / 2, s.h * 0.91, 'red', 3.6, 'center', 650));
    s.alpha(after(s, 'most', 0.5), () => mono(s, 'at most 0.25 × 2 = 0.5', s.w / 2, s.h * 0.91, 'red', 3.6, 'center', 650));
  },
};

// ---- scene 4: far out on either side, the slope all but vanishes

const flat: SceneDef = {
  marks: { f: { tex: String.raw`\sigma(6) \approx 0.9975`, x: 0.5, y: 0.1, size: 5.2 } },
  draw(s) {
    s.show('f', s.ease('six', 0.6, 0.6));
    const F = new Frame(s, 10 * s.u, s.h * 0.22, s.w - 8 * s.u, s.h * 0.6, [-8, 8, -0.08, 1.08]);
    guides(s, F);
    F.fn(sig, 'teal', 0.7);
    const sat = s.ease('name', 0.6);
    s.alpha(s.ease('six', 0.6), () => {
      const c = s.ctx;
      c.fillStyle = s.tint('gold', 0.08 + 0.06 * sat);
      c.fillRect(F.X(4), F.t, F.r - F.X(4), F.b - F.t);
      c.fillRect(F.l, F.t, F.X(-4) - F.l, F.b - F.t);
      for (const [x, y] of [
        [6, 0.62],
        [-6, 0.38],
      ] as const) {
        s.alpha(1 - sat, () => mono(s, 'flat', F.X(x), F.Y(y), 'gold', 3.4, 'center', 600));
        s.alpha(sat, () => mono(s, 'saturated', F.X(x), F.Y(y), 'gold', 3.4, 'center', 650));
      }
    });
    s.alpha(after(s, 'six', 0.5), () => F.dot(6, sig(6), 'teal'));
    s.alpha(after(s, 'tiny', 0.5), () => {
      s.line(F.X(4.5), F.Y(sig(6) - 1.5 * slope(6)), F.X(7.5), F.Y(sig(6) + 1.5 * slope(6)), s.c('red'), 0.5);
      mono(s, 'slope ≈ 0.0025', F.r - 1 * s.u, F.Y(0.82), 'red', 3.6, 'right', 650);
    });
    // The mirror image at x = -6, its working in the empty upper left.
    s.alpha(after(s, 'mirror', 0.2), () => {
      F.dot(-6, sig(-6), 'teal');
      mono(s, 'σ(−6) ≈ 0.0025', F.l + 1 * s.u, F.Y(0.86), 'teal', 3.6, 'left', 650);
    });
    s.alpha(after(s, 'mirror', 0.6), () => {
      s.line(F.X(-7.5), F.Y(sig(-6) - 1.5 * slope(-6)), F.X(-4.5), F.Y(sig(-6) + 1.5 * slope(-6)), s.c('red'), 0.5);
      mono(s, 'slope ≈ 0.0025', F.l + 1 * s.u, F.Y(0.86) + 5 * s.u, 'red', 3.6, 'left', 650);
    });
    // One sigmoid node: what arrives from above, and what gets through to x.
    s.alpha(s.ease('dead', 0.6), () => node(s, s.h * 0.8, { x: '6', out: '0.9975', up: '1', dx: '0.0025', ua: 1, da: after(s, 'dead', 0.55), run: ['dead', 0.2] }));
  },
};

export const scenes: Record<string, SceneDef> = { grow, slope: slopeScene, node: nodeScene, flat };

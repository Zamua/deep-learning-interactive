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
    s.alpha(after(s, 'two', 0.3) * (1 - s.ease('tails', 0.5)), () => mono(s, 'e⁻² ≈ 0.14', F.r - 2 * s.u, F.Y(0.3), '--ink-2', 3.6, 'right'));
    s.alpha(after(s, 'tails', 0.75), () => mark(s, F, -2, sig(-2), 'σ(−2) ≈ 0.12', 'teal', 'right', -3));
  },
};

const slopeScene: SceneDef = {
  marks: { f: { tex: String.raw`\frac{d\sigma}{dx} = \sigma\,(1 - \sigma)`, x: 0.5, y: 0.1, size: 5.2 } },
  draw(s) {
    s.show('f', s.ease('rule', 0.6));
    const top = sigFrame(s, 0.24, 0.5);
    const bot = new Frame(s, 10 * s.u, s.h * 0.6, s.w - 8 * s.u, s.h * 0.92, [-6, 6, 0, 0.3]);
    top.fn(sig, 'teal', 0.7);
    s.text('σ', top.l - 2.4 * s.u, top.Y(0.5), { size: 4, italic: true, align: 'right', color: s.c('teal') });
    s.line(top.X(0), top.t, top.X(0), top.b, s.c('--axis'), 0.25);
    const grow = s.ease('rule', 1.6, 0.8);
    bot.axes();
    bot.fn(slope, 'red', 0.8, -6, lerp(-6, 6, grow));
    s.text('slope', bot.l + 1.5 * s.u, bot.t + 1.5 * s.u, { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c('red') });
    // The point being read, sliding from 2 to 0.
    const at = lerp(2, 0, s.ease('peak', 1.2, 0.2));
    const show = after(s, 'two', 0.15);
    s.alpha(show, () => {
      s.line(top.X(at), top.Y(sig(at)), bot.X(at), bot.Y(0), s.tint('--ink-3', 0.7), 0.25, [1, 1]);
      top.dot(at, sig(at), 'teal');
      bot.dot(at, slope(at), 'red');
    });
    s.alpha(after(s, 'two', 0.55) * (1 - s.ease('peak', 0.4)), () => {
      mono(s, 'σ = 0.88', top.X(2) + 2.6 * s.u, top.Y(sig(2)) + 4 * s.u, 'teal', 3.6, 'left', 650);
      mono(s, '0.88 × 0.12 ≈ 0.105', bot.r, bot.Y(0.275), 'red', 3.6, 'right', 650);
    });
    s.alpha(after(s, 'peak', 0.5), () => {
      s.line(bot.X(-6), bot.Y(0.25), bot.X(6), bot.Y(0.25), s.tint('red', 0.6), 0.25, [1, 1]);
      mono(s, 'max 0.25', bot.X(0) + 3 * s.u, bot.Y(0.25) - 3.4 * s.u, 'red', 3.6, 'left', 650);
      mono(s, 'σ = 0.5', top.X(0) + 2.6 * s.u, top.Y(0.5) + 4 * s.u, 'teal', 3.6, 'left', 650);
    });
    s.alpha(after(s, 'chain', 0.5), () => mono(s, 'gradient × 0.25 at most', bot.r, s.h * 0.55, 'red', 3.4, 'right', 600));
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
    // One sigmoid node: what arrives from above, and what gets through to x.
    const a = s.ease('dead', 0.6);
    s.alpha(a, () => {
      const y = s.h * 0.8;
      const x0 = s.w / 2 - 34 * s.u;
      const g = s.w / 2 + 4 * s.u;
      const x1 = s.w / 2 + 34 * s.u;
      name(s, x0, y, 'x', 'orange');
      wire(s, x0, y, g, y, { r1: 5, val: '6', grad: '0.0025', ga: after(s, 'dead', 0.35), size: 3.8 });
      wire(s, g, y, x1, y, { r0: 5, val: '0.9975', grad: '1', size: 3.8 });
      gate(s, g, y, 'σ', '--ink-2', 0.3);
      pulse(s, x1, y, g, y, runAfter(s, 'dead', 0.05, 0.8), 'red');
      pulse(s, g, y, x0, y, runAfter(s, 'dead', 0.2, 0.8), 'red');
    });
  },
};

export const scenes: Record<string, SceneDef> = { curve, slope: slopeScene, flat };

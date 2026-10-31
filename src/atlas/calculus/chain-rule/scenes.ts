import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { clamp01 } from '../../../lecture/scene';
import { after, cite } from '../../draw';
import { Frame } from '../draw';
import { INKS, NODES, X3, between, chain, mono, roles } from '../chain-slopes/art';

const caption = (s: Scene, t: string, y: number, k: Ink = '--ink-2', size = 3.4) => mono(s, t, s.w / 2, y, k, size, 500);

// ---- the curve z = (3x + 1)², whose slope the chain found at one point only

const zf = (x: number) => (3 * x + 1) ** 2;
const dzf = (x: number) => 6 * (3 * x + 1);

/** The curve's window, `top` to `top + height` (stage units), as wide as the stage allows. */
function curveFrame(s: Scene, top: number, height: number): Frame {
  const pw = Math.min(s.w - 16 * s.u, 110 * s.u);
  return new Frame(s, [(s.w - pw) / 2, top * s.u, pw, height * s.u], [-1.3, 1.35, -3, 27]);
}

/** The tangent at (p, y) with slope m, about 2L stage units long whatever its tilt. */
function tangentAt(s: Scene, F: Frame, p: number, y: number, m: number, k: Ink, L = 20) {
  const dx = (L * s.u) / Math.hypot(F.kx, m * F.ky);
  F.tangent(p, y, m, k, p - dx, p + dx, 0.8);
}

/** The curve with its axes and ticks, the point at x0, and the tangent there. */
function curve(s: Scene, F: Frame, x0: number) {
  F.axes();
  for (const t of [-1, 1]) s.text(t < 0 ? '−1' : '1', F.X(t), F.Y(0) + 3 * s.u, { size: 3, font: 'mono', color: s.c('--ink-3'), halo: true });
  s.text('x', F.X(1.35), F.Y(0) + 3 * s.u, { size: 3, font: 'mono', weight: 600, align: 'right', color: s.c('orange'), halo: true });
  F.fn(zf, 'purple', 0.6);
  tangentAt(s, F, x0, zf(x0), dzf(x0), 'gold');
  F.dot(x0, zf(x0), 'purple', 1.3);
}

/** A readout row inside the curve's top-left corner. */
const corner = (s: Scene, F: Frame, t: string, row: number, k: Ink) =>
  s.text(t, F.X(F.dom[0]) + 3 * s.u, F.Y(F.dom[3]) + (3 + row * 4.8) * s.u, { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c(k), halo: true });

/** x sweeping from 1 down to -0.8 and back over the middle of beat `id`, else resting at 1. */
function sweep(s: Scene, id: string, until?: string): number {
  if (s.since(id) < 0 || (until && s.since(until) >= 0)) return 1;
  const p = clamp01((s.prog(id) - 0.15) / 0.8);
  return 0.1 + 0.9 * Math.cos(2 * Math.PI * p);
}

const fmt = (v: number) => (v < -0.005 ? `−${(-v).toFixed(1)}` : v.toFixed(1));

const every: SceneDef = {
  marks: {
    expand: { tex: String.raw`(3\symx + 1)^{2} = 9\symx^{2} + 6\symx + 1`, x: 0.5, y: 0.75, size: 4.6 },
    stuck: { tex: String.raw`e^{\symx^{2}} = \;?\qquad \ln(2\symx + 3) = \;?`, x: 0.5, y: 0.87, size: 4.6 },
  },
  draw(s) {
    const F = curveFrame(s, 9, 52);
    const x0 = sweep(s, 'every', 'expand');
    const moving = s.since('every') >= 0 && s.since('expand') < 0;
    s.alpha(s.ease('recap', 0.6), () => {
      curve(s, F, x0);
      corner(s, F, 'z = (3x + 1)²', 0, 'purple');
      s.alpha(1 - s.ease('every', 0.4), () => corner(s, F, 'slope at x = 1: 24', 1, 'gold'));
      s.alpha(moving ? 1 : s.win('every', 'expand'), () => corner(s, F, `x = ${fmt(x0)}: slope ?`, 1, 'gold'));
    });
    // The chain that found the 24, then the same chain as the pieces handled one at a time.
    const yc = s.h * 0.76;
    const chainA = Math.max(s.win('recap', 'every'), s.ease('leibniz', 0.6, 1.5));
    s.alpha(chainA, () => {
      chain(s, X3, yc, NODES, INKS, [1, 1, 1]);
      s.alpha(s.win('recap', 'every'), () => {
        mono(s, '×3', between(s, X3, 0), yc - 4.2 * s.u, 'gold', 3.4);
        mono(s, '×8', between(s, X3, 1), yc - 4.2 * s.u, 'gold', 3.4);
        caption(s, '3 × 8 = 24, at x = 1 only', s.h * 0.89, 'gold');
      });
      s.alpha(s.ease('leibniz', 0.6, 1.5), () => {
        mono(s, '3x + 1', between(s, X3, 0), yc - 5 * s.u, '--ink-2', 3.2);
        mono(s, 'u²', between(s, X3, 1), yc - 5 * s.u, '--ink-2', 3.2);
        caption(s, 'one piece at a time', s.h * 0.89);
      });
    });
    s.alpha(s.win('every', 'expand'), () => caption(s, 'one formula for the slope, at every x?', s.h * 0.8));
    s.show('expand', s.win('expand', 'leibniz') * s.ease('expand', 0.6, 0.4));
    s.show('stuck', s.win('expand', 'leibniz') * after(s, 'expand', 0.45));
    cite(s, 'Leibniz, Nova methodus, 1684', s.ease('leibniz', 0.6, 1.5));
  },
};

// ---- keep u as a letter: multiply the slopes, then put the inside back

const formula: SceneDef = {
  marks: {
    times: { tex: String.raw`\frac{dz}{d\symx} = 2u \cdot 3 = 6u`, x: 0.5, y: 0.29, size: 5 },
    sub: { tex: String.raw`\frac{dz}{d\symx} = 6(3\symx + 1)`, x: 0.5, y: 0.29, size: 5 },
    check: { tex: String.raw`\symx = 1\!:\quad 6 \times 4 = 24`, x: 0.5, y: 0.4, size: 4.6 },
  },
  draw(s) {
    const y = s.h * 0.12;
    chain(s, X3, y, NODES, INKS, [1, 1, 1], [0, s.win('letter', 'outer'), s.win('outer', 'times')]);
    mono(s, '3x + 1', between(s, X3, 0), y - 5 * s.u, '--ink-2', 3.2);
    mono(s, 'u²', between(s, X3, 1), y - 5 * s.u, '--ink-2', 3.2);
    s.alpha(s.ease('letter', 0.6, 1.5), () => mono(s, 'slope 3', between(s, X3, 0), y + 4.4 * s.u, 'gold', 3.1));
    s.alpha(s.ease('outer', 0.6, 0.8), () => mono(s, 'slope 2u', between(s, X3, 1), y + 4.4 * s.u, 'gold', 3.1));
    s.show('times', s.ease('times', 0.6) * (1 - s.ease('sub', 0.5, 1)));
    s.show('sub', s.ease('sub', 0.6, 1.4));
    s.alpha(s.win('notx', 'check'), () => caption(s, 'not 6x: the outside only sees u', s.h * 0.4, 'red', 3.3));
    s.show('check', s.ease('check', 0.6, 0.4) * (1 - s.ease('slide', 0.5)));

    // The curve below: waiting at x = 1, then checked there, then swept.
    const F = curveFrame(s, 48, 44);
    const x0 = sweep(s, 'slide');
    const live = s.ease('check', 0.6);
    s.alpha(0.3 + 0.7 * live, () => curve(s, F, x0));
    s.alpha(live, () => {
      // Rise over a tiny run, measured on the curve, against the formula.
      const h = 1e-4;
      const measured = (zf(x0 + h) - zf(x0)) / h;
      corner(s, F, `x = ${x0 < -0.005 ? '−' : ''}${Math.abs(x0).toFixed(2)}`, 0, 'orange');
      s.alpha(s.ease('slide', 0.6), () => corner(s, F, `rise / run ≈ ${fmt(measured)}`, 1, 'gold'));
      corner(s, F, `6(3x + 1) = ${fmt(dzf(x0))}`, s.since('slide') >= 0 ? 2 : 1, 'purple');
    });
  },
};

// ---- when the inside bends: e^(3x) seen again, then e^(x²)

const bend: SceneDef = {
  marks: {
    seen: { tex: String.raw`e^{3\symx} \;\to\; 3e^{3\symx}`, x: 0.5, y: 0.36, size: 5.6 },
    why: { tex: String.raw`\frac{dz}{d\symx} = e^{u} \cdot 3 = 3e^{3\symx}`, x: 0.5, y: 0.52, size: 5 },
    in: { tex: String.raw`\text{inside: } u = \symx^{2},\ \ \frac{du}{d\symx} = 2\symx`, x: 0.5, y: 0.36, size: 4.6 },
    out: { tex: String.raw`\text{outside: } z = e^{u},\ \ \frac{dz}{du} = e^{u}`, x: 0.5, y: 0.52, size: 4.6 },
    res: { tex: String.raw`\frac{dz}{d\symx} = e^{u} \cdot 2\symx = 2\symx\, e^{\symx^{2}}`, x: 0.5, y: 0.7, size: 5 },
  },
  draw(s) {
    const y = s.h * 0.14;
    const one = 1 - s.ease('in', 0.5);
    const two = s.ease('in', 0.6, 0.3);
    chain(s, X3, y, NODES, INKS, [1, 1, 1], [0, s.win('in', 'out'), s.win('out', 'res')]);
    roles(s, y, 1);
    const above = (a: string, b: string, k: number) => s.alpha(k, () => {
      mono(s, a, between(s, X3, 0), y - 5 * s.u, '--ink-2', 3.4);
      mono(s, b, between(s, X3, 1), y - 5 * s.u, '--ink-2', 3.4);
    });
    above('3x', 'eᵘ', one);
    above('x²', 'eᵘ', two);
    s.alpha(one * s.ease('why', 0.6), () => {
      mono(s, 'slope 3', between(s, X3, 0), y + 9 * s.u, 'gold', 3.1);
      mono(s, 'slope eᵘ', between(s, X3, 1), y + 9 * s.u, 'gold', 3.1);
    });
    s.alpha(s.ease('in', 0.6, 1.4), () => mono(s, 'slope 2x', between(s, X3, 0), y + 9 * s.u, 'gold', 3.1));
    s.alpha(s.ease('out', 0.6, 0.4), () => mono(s, 'slope eᵘ', between(s, X3, 1), y + 9 * s.u, 'gold', 3.1));
    s.show('seen', s.ease('seen', 0.6, 0.5) * one);
    s.show('why', after(s, 'why', 0.55) * one);
    s.show('in', two);
    s.show('out', s.ease('out', 0.6));
    s.show('res', s.ease('res', 0.6));
    s.alpha(after(s, 'res', 0.5), () => caption(s, 'x² goes back in for u', s.h * 0.84, '--ink-2', 3.3));
  },
};

// ---- try one: ln(2x + 3)

const TRY = [0.3, 0.42, 0.54, 0.66, 0.78, 0.9];

const worked: SceneDef = {
  marks: {
    q1: { tex: String.raw`z = \ln(2\symx + 3),\quad \frac{dz}{d\symx} = \; ?`, x: 0.5, y: TRY[0]!, size: 4.4 },
    in1: { tex: String.raw`\text{inside: } u = 2\symx + 3,\ \ \frac{du}{d\symx} = 2`, x: 0.5, y: TRY[1]!, size: 4.2 },
    out1: { tex: String.raw`\text{outside: } z = \ln u,\ \ \frac{dz}{du} = \frac{1}{u}`, x: 0.5, y: TRY[2]!, size: 4.2 },
    a1: { tex: String.raw`\frac{1}{u} \cdot 2 = \frac{2}{u}`, x: 0.5, y: TRY[3]!, size: 4.4 },
    back: { tex: String.raw`\frac{dz}{d\symx} = \frac{2}{2\symx + 3}`, x: 0.5, y: TRY[4]!, size: 4.4 },
    at: { tex: String.raw`\symx = 1\!:\quad \frac{2}{5} = 0.4`, x: 0.5, y: TRY[5]!, size: 4.4 },
  },
  draw(s) {
    const yc = s.h * 0.13;
    chain(s, X3, yc, NODES, INKS, [1, 1, 1], [0, s.win('in1', 'out1'), s.win('out1', 'a1')]);
    mono(s, '2x + 3', between(s, X3, 0), yc - 5 * s.u, '--ink-2', 3.4);
    mono(s, 'ln u', between(s, X3, 1), yc - 5 * s.u, '--ink-2', 3.4);
    roles(s, yc, 1);
    s.show('q1', s.ease('p1', 0.6, 0.3));
    s.show('in1', s.ease('in1', 0.6));
    s.show('out1', s.ease('out1', 0.6));
    s.show('a1', s.ease('a1', 0.6));
    s.show('back', s.ease('back', 0.6, 0.4));
    s.show('at', s.ease('at', 0.6, 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { every, formula, bend, worked };

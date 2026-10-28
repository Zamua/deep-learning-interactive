import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01 } from '../../../lecture/scene';
import { rich } from '../../networks/draw';
import { after, Frame } from '../draw';
import { INKS, type Ink, NODES, X3, X4, between, chain, label, mono, roles } from './art';

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

const caption = (s: Scene, t: string, y: number, k: Ink = '--ink-2', size = 3.4) => mono(s, t, s.w / 2, y, k, size, 500);

const lin = (x: number) => 3 * x + 1;
const sq = (u: number) => u * u;

// ---- two steps in a row: x -> u -> z, named only once the question is asked

const chainScene: SceneDef = {
  marks: {
    nest: { tex: String.raw`z = \big(\underbrace{3\symx + 1}_{\text{inside}}\big)^{2}`, x: 0.5, y: 0.6, size: 5.2 },
  },
  draw(s) {
    const y = s.h * 0.3;
    const a = [s.ease('two', 0.6), s.ease('two', 0.6, 1.4), s.ease('two', 0.6, 3.4)];
    chain(s, X3, y, ['x', '', ''], INKS, a);
    // Each '?' fades out before its name fades in.
    s.alpha(a[1]! * (1 - s.ease('u', 0.3)), () => label(s, X3[1]! * s.w, y, '?', '--ink-3'));
    s.alpha(s.ease('u', 0.4, 0.3), () => label(s, X3[1]! * s.w, y, 'u', INKS[1]!));
    s.alpha(a[2]! * (1 - s.ease('z', 0.3)), () => label(s, X3[2]! * s.w, y, '?', '--ink-3'));
    s.alpha(s.ease('z', 0.4, 0.3), () => label(s, X3[2]! * s.w, y, 'z', INKS[2]!));
    // What each link does, above its arrow.
    s.alpha(a[1]!, () => mono(s, '3x + 1', between(s, X3, 0), y - 5 * s.u, '--ink-2'));
    s.alpha(a[2]! * (1 - s.ease('z', 0.3)), () => mono(s, 'square it', between(s, X3, 1), y - 5 * s.u, '--ink-2'));
    s.alpha(s.ease('z', 0.4, 0.3), () => mono(s, 'u²', between(s, X3, 1), y - 5 * s.u, '--ink-2'));
    // The question: a nudge at one end, an unknown move at the other.
    s.alpha(s.win('ask', 'vals'), () => {
      mono(s, 'nudge', X3[0]! * s.w, y + 10.5 * s.u, 'orange', 3.4);
      mono(s, 'how far?', X3[2]! * s.w, y + 10.5 * s.u, 'purple', 3.4);
    });
    // Each step alone is familiar: a line, and a square. Then the same two places get their roles.
    s.alpha(s.win('known', 'nest'), () => {
      const glyph = (i: number, dom: [number, number, number, number], f: (t: number) => number, t: string) => {
        const F = new Frame(s, [between(s, X3, i) - 11 * s.u, s.h * 0.46, 22 * s.u, 18 * s.u], dom);
        F.axes();
        F.fn(f, '--ink-2', 0.6);
        mono(s, t, between(s, X3, i), s.h * 0.71, '--ink-2', 3, 500);
      };
      glyph(0, [0, 2, 0, 8], lin, 'a line');
      glyph(1, [0, 6, 0, 36], sq, 'power rule');
    });
    roles(s, y, s.ease('nest', 0.6, 1.2));
    s.show('nest', s.ease('nest', 0.6));
    const v = s.ease('vals', 0.6);
    ['1', '4', '16'].forEach((t, i) => s.alpha(v, () => mono(s, `${NODES[i]} = ${t}`, X3[i]! * s.w, y + 10.5 * s.u, INKS[i]!, 3.8)));
    s.alpha(s.ease('vals', 0.6, 1.6), () => caption(s, 'nudge x: how far does z move?', s.h * 0.86));
  },
};

// ---- follow a nudge: each link's curve above its arrow, and the nudge stretched by each slope


/** The two links' graphs, one above each arrow of the chain. */
function plots(s: Scene) {
  const pw = Math.min(0.31 * s.w, 40 * s.u);
  const ph = 34 * s.u;
  const top = 6 * s.u;
  return {
    F1: new Frame(s, [between(s, X3, 0) - pw / 2, top, pw, ph], [0, 2, 0, 8]),
    F2: new Frame(s, [between(s, X3, 1) - pw / 2, top, pw, ph], [0, 6, 0, 36]),
  };
}

/** A label row inside a plot's top-left corner. */
const corner = (s: Scene, F: Frame, t: string, row: number, k: Ink) =>
  s.text(t, F.X(F.dom[0]) + 2.5 * s.u, F.Y(F.dom[3]) + (3 + row * 4.6) * s.u, { size: 3.1, font: 'mono', weight: 600, align: 'left', color: s.c(k), halo: true });

/** The tangent at (p, y) with slope m, about 2L stage units long whatever its tilt. */
function tangentAt(s: Scene, F: Frame, p: number, y: number, m: number, k: Ink, L = 14) {
  const dx = (L * s.u) / Math.hypot(F.kx, m * F.ky);
  F.tangent(p, y, m, k, p - dx, p + dx, 0.75);
}

/** Where the chain sits on the second link: roaming during "curve", then held at 4. */
function u0(s: Scene): number {
  if (s.since('curve') < 0 || s.since('at4') >= 0) return 4;
  const p = clamp01((s.prog('curve') - 0.3) / 0.7);
  return 4 + 1.6 * Math.sin(2 * Math.PI * p);
}

const nudge: SceneDef = {
  draw(s) {
    const { F1, F2 } = plots(s);
    const u = s.u;
    const tick = (t: string, x: number, y: number, k: Ink, align: CanvasTextAlign = 'center') =>
      s.text(t, x, y, { size: 3, font: 'mono', weight: 600, align, color: s.c(k), halo: true });

    // The first link: a line, its own tangent.
    s.alpha(s.ease('line', 0.6), () => {
      F1.axes();
      F1.seg(1, 0, 1, 4, '--ink-3', 0.25, [0.8, 0.8]);
      F1.seg(0, 4, 1, 4, '--ink-3', 0.25, [0.8, 0.8]);
      F1.fn(lin, 'gold', 0.8, 0, 2 * s.ease('line', 1.2, 0.3));
      F1.dot(1, 4, 'orange', 1.2);
      tick('1', F1.X(1), F1.Y(0) + 3 * u, 'orange');
      tick('4', F1.X(0) - 1.6 * u, F1.Y(4), '--ink-2', 'right');
      tick('x', F1.X(2), F1.Y(0) + 3 * u, 'orange', 'right');
      corner(s, F1, 'u = 3x + 1', 0, '--ink-2');
      s.alpha(s.ease('line', 0.6, 2.5), () => corner(s, F1, 'slope 3', 1, 'gold'));
    });

    // The second link: a curve whose slope depends on where the chain sits.
    s.alpha(s.ease('curve', 0.6), () => {
      F2.axes();
      F2.fn(sq, '--ink-3', 0.6, 0, 6 * s.ease('curve', 1.2));
      tick('u', F2.X(6), F2.Y(0) + 3 * u, '--ink-2', 'right');
      corner(s, F2, 'z = u²', 0, '--ink-2');
      const p = u0(s);
      s.alpha(after(s, 'curve', 0.25), () => {
        tangentAt(s, F2, p, sq(p), 2 * p, 'gold');
        F2.dot(p, sq(p), '--ink-2', 1.2);
        corner(s, F2, `slope 2u = ${p === 4 ? '8' : (2 * p).toFixed(1)}`, 1, 'gold');
      });
      s.alpha(s.ease('at4', 0.6), () => {
        F2.seg(4, 0, 4, 16, '--ink-3', 0.25, [0.8, 0.8]);
        tick('4', F2.X(4), F2.Y(0) + 3 * u, '--ink-2');
      });
    });

    // The chain, its arrows labeled by the factor each link applies.
    const yc = s.h * 0.53;
    const lit = [s.win('n1', 'curve'), s.win('n1', 'curve') * after(s, 'n1', 0.5), after(s, 'n2', 0.5) * (1 - s.ease('local', 0.6))];
    chain(s, X3, yc, NODES, INKS, [1, 1, 1], lit);
    s.alpha(after(s, 'n1', 0.4), () => mono(s, '×3', between(s, X3, 0), yc - 4.2 * u, 'gold', 3.4));
    s.alpha(after(s, 'n2', 0.2), () => mono(s, '×8', between(s, X3, 1), yc - 4.2 * u, 'gold', 3.4));

    // The nudge at each node, drawn to scale as a bar so the stretching shows.
    const yn = s.h * 0.67;
    const yb = s.h * 0.735;
    const base = Math.min(1.2 * u, (0.17 * s.w - 4 * u) / 12);
    const ns: [string, number, number][] = [['+0.01', 1, after(s, 'n1', 0.1)], ['+0.03', 3, after(s, 'n1', 0.55)], ['≈ +0.24', 24, after(s, 'n2', 0.6)]];
    ns.forEach(([t, k, a], i) => s.alpha(a, () => {
      const x = X3[i]! * s.w;
      mono(s, t, x, yn, INKS[i]!, 3.6);
      s.rrect(x - (k * base) / 2, yb - 0.9 * u, k * base, 1.8 * u, 0.5, { fill: s.c(INKS[i]!) });
    }));

    const cy = s.h * 0.85;
    const cy2 = s.h * 0.93;
    s.alpha(s.win('local', 'mult'), () => caption(s, 'local slope: a link\'s slope where the chain is', cy2));
    s.alpha(s.ease('mult', 0.6), () => mono(s, '3 × 8 = 24', s.w / 2, cy, 'gold', 4.4));
    s.alpha(s.win('mult', 'name') * after(s, 'mult', 0.5), () => caption(s, 'not 3 + 8: each link multiplies', cy2, 'red', 3.2));
    s.alpha(s.ease('name', 0.6), () => caption(s, 'the chain rule: multiply the local slopes', cy2, '--ink', 3.3));
  },
};

// ---- Leibniz's notation: dz/dx for the whole chain, du/dx and dz/du for its links

const leibniz: SceneDef = {
  marks: {
    dzdx: { tex: String.raw`\frac{dz}{d\symx} = 24`, x: 0.5, y: 0.52, size: 6.4 },
    du: { tex: String.raw`\frac{du}{d\symx} = 3`, x: 0.335, y: 0.33, size: 5.2 },
    dz: { tex: String.raw`\frac{dz}{du} = 8`, x: 0.665, y: 0.33, size: 5.2 },
    rule: { tex: String.raw`\frac{dz}{d\symx} = \frac{dz}{du} \cdot \frac{du}{d\symx}`, x: 0.5, y: 0.52, size: 6 },
    cancel: { tex: String.raw`\frac{dz}{d\symx} = \frac{dz}{\cancel{du}} \cdot \frac{\cancel{du}}{d\symx}`, x: 0.5, y: 0.52, size: 6 },
    prime: { tex: String.raw`z'(4) \cdot u'(1) = 8 \times 3`, x: 0.5, y: 0.8, size: 5 },
  },
  draw(s) {
    const y = s.h * 0.16;
    chain(s, X3, y, NODES, INKS, [1, 1, 1], [0, s.win('du', 'dz'), s.win('dz', 'rule')]);
    mono(s, '3x + 1', between(s, X3, 0), y - 5 * s.u, '--ink-3', 3.2, 500);
    mono(s, 'u²', between(s, X3, 1), y - 5 * s.u, '--ink-3', 3.2, 500);
    const rule = s.ease('rule', 0.6);
    const cancel = after(s, 'rule', 0.62);
    s.show('dzdx', s.ease('rate', 0.6, 0.6) * (1 - rule));
    s.show('rule', rule * (1 - cancel));
    s.show('cancel', cancel);
    s.show('du', s.ease('du', 0.6, 0.6));
    s.show('dz', s.ease('dz', 0.6, 0.4));
    s.show('prime', s.ease('prime', 0.6, 1));
    const cy = s.h * 0.68;
    s.alpha(s.win('rate', 'dzdx'), () => caption(s, 'how fast z changes, per change in x', cy));
    s.alpha(s.win('dzdx', 'leibniz'), () => {
      caption(s, 'a tiny change in z, over a tiny change in x', cy);
      s.alpha(after(s, 'dzdx', 0.5), () => rich(s, [['0.24', 'purple'], [' / ', '--ink-2'], ['0.01', 'orange'], [' ≈ 24', '--ink-2']], s.w / 2, s.h * 0.77, { size: 3.8, weight: 600 }));
    });
    s.alpha(s.win('leibniz', 'du'), () => caption(s, 'dx: d for difference, a tiny change in x', cy));
    s.alpha(cancel * (1 - s.ease('prime', 0.6)), () => caption(s, 'like fractions, the du\'s seem to cancel', cy));
    s.alpha(after(s, 'prime', 0.45), () => caption(s, 'outside\'s slope at u = 4, not at x = 1', s.h * 0.92, 'purple', 3.2));
    cite(s, 'Leibniz, Nova methodus, 1684', s.ease('leibniz', 0.6, 1));
  },
};

// ---- walk back along a longer chain, collecting every slope on the way

const BACK = ['x', 'u', 'v', 'z'];
const BINKS: Ink[] = ['orange', '--ink-2', '--ink-2', 'purple'];
const SLOPES = ['×3', '×(−2)', '×0.5'];
const GRADS = ['−3', '−1', '0.5', '1'];

const back: SceneDef = {
  marks: {
    given: { tex: String.raw`\frac{du}{d\symx} = 3,\ \ \frac{dv}{du} = -2,\ \ \frac{dz}{dv} = 0.5`, x: 0.5, y: 0.1, size: 4.2 },
    q: { tex: String.raw`\frac{dz}{d\symx} = \; ?`, x: 0.5, y: 0.84, size: 4.8 },
    total: { tex: String.raw`\frac{dz}{d\symx} = 0.5 \times (-2) \times 3 = -3`, x: 0.5, y: 0.84, size: 4.8 },
  },
  draw(s) {
    const y = s.h * 0.3;
    const a = [0, 1, 2, 3].map((i) => s.ease('longer', 0.6, 0.5 * i));
    chain(s, X4, y, BACK, BINKS, a);
    SLOPES.forEach((t, i) => s.alpha(s.ease('longer', 0.6, 3), () => mono(s, t, between(s, X4, i), y - 5 * s.u, 'gold', 3.3)));
    // Backward: one cell per node, filled from z back to x.
    const yg = s.h * 0.54;
    const g = [after(s, 'x', 0.2), after(s, 'back', 0.6), after(s, 'back', 0.25), after(s, 'back', 0)];
    const on = [s.ease('x', 0.6, 1.2), s.win('free', 'turn'), s.win('free', 'turn'), 0];
    X4.forEach((f, i) => {
      s.alpha(g[i]!, () => {
        const x = f * s.w;
        s.cell(x - 6 * s.u, yg - 4.5 * s.u, 12 * s.u, 9 * s.u, GRADS[i]!, 'red', { on: Math.max(0.3, on[i]!) });
        if (i < 3) s.arrow(X4[i + 1]! * s.w - 7 * s.u, yg, x + 7 * s.u, yg, s.c('red'), 0.4, 2);
        s.text(`dz/d${BACK[i]}`, x, yg + 8 * s.u, { size: 3, font: 'mono', color: s.c('--ink-3') });
      });
    });
    s.show('given', s.ease('longer', 0.6, 3.6));
    s.show('q', after(s, 'longer', 0.85) * (1 - s.ease('x', 0.5)));
    s.show('total', s.ease('x', 0.6, 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { chain: chainScene, nudge, leibniz, back };

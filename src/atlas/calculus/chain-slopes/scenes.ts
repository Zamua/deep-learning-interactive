import type { SceneDef } from '../../../lecture/scene';
import { after } from '../draw';
import { INKS, type Ink, NODES, X3, X4, between, chain, mono, roles } from './art';

const chainScene: SceneDef = {
  marks: {
    nest: { tex: String.raw`z = \big(\underbrace{3\symx + 1}_{\text{inside}}\big)^{2}`, x: 0.5, y: 0.56, size: 5.2 },
    q: { tex: String.raw`\frac{dz}{d\symx} = \; ?`, x: 0.5, y: 0.82, size: 6 },
  },
  draw(s) {
    const y = s.h * 0.27;
    const a = [s.ease('chain', 0.6), s.ease('chain', 0.6, 0.8), s.ease('feed', 0.6)];
    chain(s, X3, y, NODES, INKS, a);
    s.alpha(a[1]!, () => mono(s, '3x + 1', between(s, X3, 0), y - 5 * s.u, '--ink-2'));
    s.alpha(a[2]!, () => mono(s, 'u²', between(s, X3, 1), y - 5 * s.u, '--ink-2'));
    roles(s, y, s.ease('nest', 0.6, 1.2));
    s.show('nest', s.ease('nest', 0.6));
    const v = s.ease('vals', 0.6);
    ['1', '4', '16'].forEach((t, i) => s.alpha(v, () => mono(s, `${NODES[i]} = ${t}`, X3[i]! * s.w, y + 10.5 * s.u, INKS[i]!, 3.8)));
    s.show('q', s.ease('vals', 0.6, 2.2));
  },
};

const local: SceneDef = {
  marks: {
    du: { tex: String.raw`\frac{du}{d\symx} = 3`, x: 0.3, y: 0.34, size: 5 },
    dz: { tex: String.raw`\frac{dz}{du} = z'(4) = 8`, x: 0.68, y: 0.34, size: 5 },
    rule: { tex: String.raw`\frac{dz}{d\symx} = \frac{dz}{du} \cdot \frac{du}{d\symx} = 8 \times 3 = 24`, x: 0.5, y: 0.85, size: 4.8 },
  },
  draw(s) {
    const y = s.h * 0.17;
    chain(s, X3, y, NODES, INKS, [1, 1, 1], [s.win('nudge', 'mult'), s.win('du', 'dz'), s.win('dz', 'nudge')]);
    mono(s, '3x + 1', between(s, X3, 0), y - 5 * s.u, '--ink-3', 3.2, 500);
    mono(s, 'u²', between(s, X3, 1), y - 5 * s.u, '--ink-3', 3.2, 500);
    roles(s, y, 1);
    s.show('du', s.ease('du', 0.6));
    s.show('dz', s.ease('dz', 0.6));
    // The nudge, carried link by link.
    const yn = s.h * 0.63;
    const n = [after(s, 'nudge', 0.02), after(s, 'nudge', 0.3), after(s, 'nudge', 0.65)];
    ['+0.01', '+0.03', '+0.24'].forEach((t, i) => s.alpha(n[i]!, () => mono(s, t, X3[i]! * s.w, yn, INKS[i]!, 3.8)));
    [['×3', 1], ['×8', 2]].forEach(([t, i]) => {
      const j = i as number;
      s.alpha(n[j]!, () => {
        s.arrow(X3[j - 1]! * s.w + 9 * s.u, yn, X3[j]! * s.w - 9 * s.u, yn, s.c('gold'), 0.4, 2);
        mono(s, t as string, between(s, X3, j - 1), yn - 3.6 * s.u, 'gold', 3.4);
      });
    });
    s.show('rule', s.ease('mult', 0.6, 0.4));
  },
};

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
    SLOPES.forEach((t, i) => s.alpha(s.ease('longer', 0.6, 2.4), () => mono(s, t, between(s, X4, i), y - 5 * s.u, 'gold', 3.3)));
    // Backward: one slope cell per node, filled from z back to x.
    const yg = s.h * 0.54;
    const g = [after(s, 'back', 0.8), after(s, 'back', 0.55), after(s, 'back', 0.3), after(s, 'back', 0)];
    X4.forEach((f, i) => {
      s.alpha(g[i]!, () => {
        const x = f * s.w;
        s.cell(x - 6 * s.u, yg - 4.5 * s.u, 12 * s.u, 9 * s.u, GRADS[i]!, 'red', { on: i === 0 ? s.ease('backprop', 0.6) : 0.3 });
        if (i < 3) s.arrow(X4[i + 1]! * s.w - 7 * s.u, yg, x + 7 * s.u, yg, s.c('red'), 0.4, 2);
        s.text(`dz/d${BACK[i]}`, x, yg + 8 * s.u, { size: 3, font: 'mono', color: s.c('--ink-3') });
      });
    });
    s.show('given', s.ease('longer', 0.6, 3));
    s.show('q', after(s, 'longer', 0.8) * (1 - s.ease('backprop', 0.5)));
    s.show('total', s.ease('backprop', 0.6, 0.3));
  },
};

export const scenes: Record<string, SceneDef> = { chain: chainScene, local, back };

import type { Color } from '../../../core/symbols';
import type { Scene, SceneDef } from '../../../lecture/scene';
import { after, node } from '../draw';

type Ink = Color | `--${string}`;
const X3 = [0.17, 0.5, 0.83];
const X4 = [0.12, 0.38, 0.63, 0.88];
const NODE_W = 12;

/** Nodes in a row joined by arrows; `a[i]` fades node i (and the arrow into it) in. */
function chain(s: Scene, fx: number[], y: number, labels: string[], inks: Ink[], a: number[], on: number[] = []) {
  fx.forEach((f, i) => {
    const x = f * s.w;
    s.alpha(a[i]!, () => {
      if (i > 0) s.arrow(fx[i - 1]! * s.w + (NODE_W / 2 + 1) * s.u, y, x - (NODE_W / 2 + 1) * s.u, y, s.c('--ink-3'), 0.4, 2.2);
      node(s, x, y, labels[i]!, inks[i]!, on[i] ?? 0, NODE_W);
    });
  });
}

/** Text centered between nodes i and i + 1. */
const between = (s: Scene, fx: number[], i: number) => ((fx[i]! + fx[i + 1]!) / 2) * s.w;

const mono = (s: Scene, t: string, x: number, y: number, k: Ink, size = 3.6, weight = 600) =>
  s.text(t, x, y, { size, font: 'mono', weight, color: s.c(k), halo: true });

/** "inside" under the first arrow of an x -> u -> z chain, "outside" under the second. */
function roles(s: Scene, y: number, a: number) {
  s.alpha(a, () => {
    mono(s, 'inside', between(s, X3, 0), y + 4.4 * s.u, '--ink-3', 2.9, 500);
    mono(s, 'outside', between(s, X3, 1), y + 4.4 * s.u, '--ink-3', 2.9, 500);
  });
}

const NODES = ['x', 'u', 'z'];
const INKS: Ink[] = ['orange', '--ink-2', 'purple'];

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

/** Rows of algebra under the chain, as fractions of the stage height. */
const ROWS = [0.4, 0.55, 0.7, 0.85];

const formula: SceneDef = {
  marks: {
    inner: { tex: String.raw`\text{inside: } \frac{du}{d\symx} = 3`, x: 0.5, y: ROWS[0]!, size: 4.6 },
    outer: { tex: String.raw`\text{outside: } \frac{dz}{du} = 2u`, x: 0.5, y: ROWS[1]!, size: 4.6 },
    times: { tex: String.raw`\frac{dz}{d\symx} = 2u \cdot 3 = 6u`, x: 0.5, y: ROWS[2]!, size: 4.6 },
    sub: { tex: String.raw`\frac{dz}{d\symx} = 6u = 6(3\symx + 1)`, x: 0.5, y: ROWS[2]!, size: 4.6 },
    check: { tex: String.raw`\symx = 1\!:\quad 6 \times 4 = 24`, x: 0.5, y: ROWS[3]!, size: 4.6 },
    inner2: { tex: String.raw`\text{inside: } u = \symx^{2},\ \ \frac{du}{d\symx} = 2\symx`, x: 0.5, y: ROWS[0]!, size: 4.4 },
    outer2: { tex: String.raw`\text{outside: } z = e^{u},\ \ \frac{dz}{du} = e^{u}`, x: 0.5, y: ROWS[1]!, size: 4.4 },
    times2: { tex: String.raw`\frac{dz}{d\symx} = e^{u} \cdot 2\symx = 2\symx\, e^{\symx^{2}}`, x: 0.5, y: ROWS[2]!, size: 4.6 },
  },
  draw(s) {
    const y = s.h * 0.17;
    const one = 1 - s.ease('curve', 0.5);
    const two = s.ease('curve', 0.6, 0.3);
    chain(s, X3, y, NODES, INKS, [1, 1, 1], [0, s.win('letter', 'outer'), s.win('outer', 'times')]);
    roles(s, y, 1);
    s.alpha(one, () => {
      mono(s, '3x + 1', between(s, X3, 0), y - 5 * s.u, '--ink-2', 3.4);
      mono(s, 'u²', between(s, X3, 1), y - 5 * s.u, '--ink-2', 3.4);
    });
    s.alpha(two, () => {
      mono(s, 'x²', between(s, X3, 0), y - 5 * s.u, '--ink-2', 3.4);
      mono(s, 'eᵘ', between(s, X3, 1), y - 5 * s.u, '--ink-2', 3.4);
    });
    s.show('inner', s.ease('letter', 0.6, 1) * one);
    s.show('outer', s.ease('outer', 0.6) * one);
    s.show('times', s.ease('times', 0.6) * (1 - s.ease('sub', 0.5)));
    s.show('sub', s.ease('sub', 0.6, 0.3) * one);
    s.show('check', s.ease('check', 0.6) * one);
    s.show('inner2', two);
    s.show('outer2', s.ease('curve', 0.6, 2.2));
    s.show('times2', s.ease('curve2', 0.6));
  },
};

const BACK = ['x', 'u', 'v', 'z'];
const BINKS: Ink[] = ['orange', '--ink-2', '--ink-2', 'purple'];
const SLOPES = ['×3', '×(−2)', '×0.5'];
const GRADS = ['−3', '−1', '0.5', '1'];
const TRY = [0.37, 0.53, 0.69, 0.85];

const back: SceneDef = {
  marks: {
    given: { tex: String.raw`\frac{du}{d\symx} = 3,\ \ \frac{dv}{du} = -2,\ \ \frac{dz}{dv} = 0.5`, x: 0.5, y: 0.1, size: 4.2 },
    total: { tex: String.raw`\frac{dz}{d\symx} = 0.5 \times (-2) \times 3 = -3`, x: 0.5, y: 0.84, size: 4.8 },
    q1: { tex: String.raw`z = \ln(2\symx + 3),\quad \frac{dz}{d\symx} = \; ?`, x: 0.5, y: TRY[0]!, size: 4.6 },
    in1: { tex: String.raw`\text{inside: } u = 2\symx + 3,\ \ \frac{du}{d\symx} = 2`, x: 0.5, y: TRY[1]!, size: 4.4 },
    out1: { tex: String.raw`\text{outside: } z = \ln u,\ \ \frac{dz}{du} = \frac{1}{u}`, x: 0.5, y: TRY[2]!, size: 4.4 },
    a1: { tex: String.raw`\frac{dz}{d\symx} = \frac{1}{u} \cdot 2 = \frac{2}{2\symx + 3}`, x: 0.5, y: TRY[3]!, size: 4.6 },
  },
  draw(s) {
    const walk = 1 - s.ease('p1', 0.5);
    const y = s.h * 0.3;
    s.alpha(walk, () => {
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
    });
    s.show('given', s.ease('longer', 0.6, 3) * walk);
    s.show('total', s.ease('backprop', 0.6, 0.3) * walk);
    // The worked formula: ln of a line.
    const one = s.ease('p1', 0.6, 0.3);
    const yc = s.h * 0.15;
    s.alpha(one, () => {
      chain(s, X3, yc, NODES, INKS, [1, 1, 1], [0, s.win('in1', 'out1'), s.win('out1', 'a1')]);
      mono(s, '2x + 3', between(s, X3, 0), yc - 5 * s.u, '--ink-2', 3.4);
      mono(s, 'ln u', between(s, X3, 1), yc - 5 * s.u, '--ink-2', 3.4);
      roles(s, yc, 1);
    });
    s.show('q1', after(s, 'p1', 0.3));
    s.show('in1', s.ease('in1', 0.6));
    s.show('out1', s.ease('out1', 0.6));
    s.show('a1', s.ease('a1', 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { chain: chainScene, local, formula, back };

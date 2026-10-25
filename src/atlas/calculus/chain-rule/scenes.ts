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

const NODES = ['x', 'u', 'z'];
const INKS: Ink[] = ['orange', '--ink-2', 'purple'];

const chainScene: SceneDef = {
  marks: {
    q: { tex: String.raw`\frac{dz}{d\symx} = \; ?`, x: 0.5, y: 0.72, size: 6 },
  },
  draw(s) {
    const y = s.h * 0.3;
    const a = [s.ease('chain', 0.6), s.ease('chain', 0.6, 0.8), s.ease('feed', 0.6)];
    chain(s, X3, y, NODES, INKS, a);
    s.alpha(a[1]!, () => mono(s, '3x + 1', between(s, X3, 0), y - 5 * s.u, '--ink-2'));
    s.alpha(a[2]!, () => mono(s, 'u²', between(s, X3, 1), y - 5 * s.u, '--ink-2'));
    const v = s.ease('vals', 0.6);
    ['1', '4', '16'].forEach((t, i) => s.alpha(v, () => mono(s, `${NODES[i]} = ${t}`, X3[i]! * s.w, y + 10 * s.u, INKS[i]!, 3.8)));
    s.show('q', s.ease('vals', 0.6, 2.2));
  },
};

const local: SceneDef = {
  marks: {
    du: { tex: String.raw`\frac{du}{d\symx} = 3`, x: 0.335, y: 0.34, size: 5 },
    dz: { tex: String.raw`\frac{dz}{du} = 8`, x: 0.665, y: 0.34, size: 5 },
    rule: { tex: String.raw`\frac{dz}{d\symx} = \frac{dz}{du} \cdot \frac{du}{d\symx} = 8 \times 3 = 24`, x: 0.5, y: 0.85, size: 4.8 },
  },
  draw(s) {
    const y = s.h * 0.2;
    chain(s, X3, y, NODES, INKS, [1, 1, 1], [s.win('nudge', 'mult'), s.win('du', 'dz'), s.win('dz', 'nudge')]);
    mono(s, '3x + 1', between(s, X3, 0), y - 5 * s.u, '--ink-3', 3.2, 500);
    mono(s, 'u²', between(s, X3, 1), y - 5 * s.u, '--ink-3', 3.2, 500);
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

const BACK = ['x', 'u', 'v', 'L'];
const BINKS: Ink[] = ['orange', '--ink-2', '--ink-2', 'red'];
const SLOPES = ['×3', '×(−2)', '×0.5'];
const GRADS = ['−3', '−1', '0.5', '1'];

const back: SceneDef = {
  marks: {
    total: { tex: String.raw`\frac{dL}{d\symx} = 0.5 \times (-2) \times 3 = -3`, x: 0.5, y: 0.84, size: 4.8 },
  },
  draw(s) {
    const y = s.h * 0.24;
    const a = [0, 1, 2, 3].map((i) => s.ease('longer', 0.6, 0.5 * i));
    chain(s, X4, y, BACK, BINKS, a);
    SLOPES.forEach((t, i) => s.alpha(s.ease('longer', 0.6, 2.4), () => mono(s, t, between(s, X4, i), y - 5 * s.u, 'gold', 3.3)));
    // Backward: one slope cell per node, filled from L back to x.
    const yg = s.h * 0.5;
    const g = [after(s, 'back', 0.8), after(s, 'back', 0.55), after(s, 'back', 0.3), after(s, 'back', 0)];
    X4.forEach((f, i) => {
      s.alpha(g[i]!, () => {
        const x = f * s.w;
        s.cell(x - 6 * s.u, yg - 4.5 * s.u, 12 * s.u, 9 * s.u, GRADS[i]!, 'red', { on: i === 0 ? s.ease('backprop', 0.6) : 0.3 });
        if (i < 3) s.arrow(X4[i + 1]! * s.w - 7 * s.u, yg, x + 7 * s.u, yg, s.c('red'), 0.4, 2);
        s.text(`dL/d${BACK[i]}`, x, yg + 8 * s.u, { size: 3, font: 'mono', color: s.c('--ink-3') });
      });
    });
    s.show('total', s.ease('backprop', 0.6, 0.3));
  },
};

export const scenes: Record<string, SceneDef> = { chain: chainScene, local, back };

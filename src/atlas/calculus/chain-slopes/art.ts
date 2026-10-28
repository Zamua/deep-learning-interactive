// Drawing shared by the chained-slopes and chain-rule explainers: a row of nodes joined by arrows.
import type { Color } from '../../../core/symbols';
import type { Scene } from '../../../lecture/scene';
import { node } from '../draw';

export type Ink = Color | `--${string}`;
export const X3 = [0.17, 0.5, 0.83];
export const X4 = [0.12, 0.38, 0.63, 0.88];
const NODE_W = 12;

/** Nodes in a row joined by arrows; `a[i]` fades node i (and the arrow into it) in. */
export function chain(s: Scene, fx: number[], y: number, labels: string[], inks: Ink[], a: number[], on: number[] = []) {
  fx.forEach((f, i) => {
    const x = f * s.w;
    s.alpha(a[i]!, () => {
      if (i > 0) s.arrow(fx[i - 1]! * s.w + (NODE_W / 2 + 1) * s.u, y, x - (NODE_W / 2 + 1) * s.u, y, s.c('--ink-3'), 0.4, 2.2);
      node(s, x, y, labels[i]!, inks[i]!, on[i] ?? 0, NODE_W);
    });
  });
}

/** A node's letter drawn on its own, so it can fade in after the node (as `node` draws it). */
export const label = (s: Scene, x: number, y: number, t: string, k: Ink) =>
  s.text(t, x, y - 0.2 * s.u, { size: 5.6, italic: true, weight: 500, color: s.c(k) });

/** Text centered between nodes i and i + 1. */
export const between = (s: Scene, fx: number[], i: number) => ((fx[i]! + fx[i + 1]!) / 2) * s.w;

export const mono = (s: Scene, t: string, x: number, y: number, k: Ink, size = 3.6, weight = 600) =>
  s.text(t, x, y, { size, font: 'mono', weight, color: s.c(k), halo: true });

/** "inside" under the first arrow of an x -> u -> z chain, "outside" under the second. */
export function roles(s: Scene, y: number, a: number) {
  s.alpha(a, () => {
    mono(s, 'inside', between(s, X3, 0), y + 4.4 * s.u, '--ink-3', 2.9, 500);
    mono(s, 'outside', between(s, X3, 1), y + 4.4 * s.u, '--ink-3', 2.9, 500);
  });
}

export const NODES = ['x', 'u', 'z'];
export const INKS: Ink[] = ['orange', '--ink-2', 'purple'];

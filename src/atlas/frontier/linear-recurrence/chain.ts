// A one-unit recurrence drawn as a chain: states h_0..h_n in circles, each input in a chip below
// its state, a decay label on every arrow between states.
import type { Scene } from '../../../lecture/scene';
import type { Ink } from '../../linear-algebra/draw';

export interface ChainSpec {
  y: number;
  n: number;
  /** h_i's value, or '' for a state not yet computed. */
  states: (i: number) => string;
  /** x_1..x_n. */
  inputs: string[];
  /** The label on the arrow into h_t, e.g. `×0.5`. */
  decay: (t: number) => string;
  /** The label on every input arrow, e.g. `×2`; '' for none. */
  gain: string;
  /** Alpha of h_i, and of x_i with its arrows for i >= 1. */
  show: (i: number) => number;
  hot?: (i: number) => number;
  /** Width factor of the arrow into h_t, 1 by default. */
  thick?: (t: number) => number;
  decayInk?: (t: number) => Ink;
}

export interface Chain {
  x: (i: number) => number;
  y: number;
  r: number;
  inputY: number;
}

const SUB = '₀₁₂₃₄₅₆₇₈₉';
export const sub = (i: number): string => String(i).split('').map((c) => SUB[+c]).join('');

export function chainAt(s: Scene, n: number, y: number): Chain {
  const gap = (s.tall ? 26 : 32) * s.u;
  return { x: (i) => s.w / 2 + (i - n / 2) * gap, y, r: 5.6 * s.u, inputY: y + 21 * s.u };
}

export function chain(s: Scene, o: ChainSpec): Chain {
  const g = chainAt(s, o.n, o.y);
  const { r } = g;
  const mono = (t: string, x: number, y: number, k: Ink, size = 3.2, align: CanvasTextAlign = 'center') => s.text(t, x, y, { size, font: 'mono', weight: 600, align, color: s.c(k), halo: true });
  for (let i = 0; i <= o.n; i++) {
    const a = o.show(i);
    s.alpha(a, () => {
      const x = g.x(i);
      const hot = o.hot?.(i) ?? 0;
      if (i > 0) {
        const w = o.thick?.(i) ?? 1;
        const k = o.decayInk?.(i) ?? '--ink-3';
        s.arrow(g.x(i - 1) + r, g.y, x - r - 0.4 * s.u, g.y, s.tint(k, 0.75), 0.35 * w, 1.8 + 0.5 * w);
        mono(o.decay(i), (g.x(i - 1) + x) / 2, g.y - 3.4 * s.u, k, 3);
        const cy = g.inputY;
        s.cell(x - 4.5 * s.u, cy - 3.5 * s.u, 9 * s.u, 7 * s.u, o.inputs[i - 1]!, 'orange', { size: 3.2 });
        mono(`x${sub(i)}`, x, cy + 6.2 * s.u, 'orange', 3);
        s.arrow(x, cy - 3.8 * s.u, x, g.y + r + 0.4 * s.u, s.tint('--ink-3', 0.75), 0.35, 1.8);
        if (o.gain) mono(o.gain, x + 1.4 * s.u, (cy - 3.8 * s.u + g.y + r) / 2, 'green', 3, 'left');
      }
      s.circle(x, g.y, r, { fill: s.tint('gold', 0.12 + 0.25 * hot), stroke: s.tint('gold', 0.65 + 0.35 * hot), lw: 0.35 + 0.15 * hot });
      const v = o.states(i);
      if (v) s.text(v, x, g.y + 0.2 * s.u, { size: v.length > 4 ? 2.8 : 3.2, font: 'mono', weight: 650, color: s.c('--ink') });
      mono(`h${sub(i)}`, x, g.y - r - 2.8 * s.u, 'gold', 3);
    });
  }
  return g;
}

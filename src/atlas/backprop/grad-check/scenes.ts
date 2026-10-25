import type { Scene, SceneDef } from '../../../lecture/scene';
import { after, Frame, mono } from '../draw';

const f = (x: number) => x * x;
const H = 0.1;

function plot(s: Scene): Frame {
  return new Frame(s, 12 * s.u, s.h * 0.24, s.w - 8 * s.u, s.h * 0.92, [2.55, 3.45, 6.4, 11.8]);
}

/** A straight line through (x0, y0) with slope m across the plot. */
function line(F: Frame, x0: number, y0: number, m: number, k: 'gold' | 'red' | '--ink-3', a: number, width = 0.5): void {
  F.s.alpha(a, () => F.fn((x) => y0 + m * (x - x0), k, width, 2.6, 3.4));
}

const numeric: SceneDef = {
  marks: { c: { tex: String.raw`\frac{f(x + h) - f(x - h)}{2h} = \frac{1.2}{0.2} = 6`, x: 0.5, y: 0.11, size: 4.6 } },
  draw(s) {
    const F = plot(s);
    const a = s.ease('why', 0.6);
    s.alpha(a, () => {
      F.fn(f, 'teal', 0.8);
      F.dot(3, 9, 'teal');
      mono(s, 'x = 3', F.X(3), F.b - 3 * s.u, '--ink-3', 3.4);
      mono(s, 'f(x) = x²', F.l + 2 * s.u, F.t + 3 * s.u, 'teal', 3.8, 'left', 650);
    });
    s.show('c', after(s, 'divide', 0.25) * (1 - s.ease('one', 0.4)));
    const sides = after(s, 'sides', 0.45);
    s.alpha(sides, () => {
      for (const x of [3 - H, 3 + H]) s.line(F.X(x), F.Y(f(x)), F.X(x), F.b, s.tint('--ink-3', 0.6), 0.25, [1, 1]);
      F.dot(3 - H, f(3 - H), 'gold');
      F.dot(3 + H, f(3 + H), 'gold');
      mono(s, '8.41', F.X(3 - H) - 2 * s.u, F.Y(f(3 - H)) - 3.4 * s.u, 'gold', 3.6, 'right', 650);
      mono(s, '9.61', F.X(3 + H) + 2.4 * s.u, F.Y(f(3 + H)) + 1.6 * s.u, 'gold', 3.6, 'left', 650);
      mono(s, '2.9', F.X(3 - H), F.b - 3 * s.u, '--ink-3', 3.2, 'right');
      mono(s, '3.1', F.X(3 + H), F.b - 3 * s.u, '--ink-3', 3.2, 'left');
    });
    // Rise over run between the two side points.
    const d = after(s, 'divide', 0.1);
    s.alpha(d, () => {
      line(F, 3, 9, 6, 'gold', 1);
      const yb = F.Y(f(3 - H));
      s.line(F.X(3 - H), yb, F.X(3 + H), yb, s.c('--ink-2'), 0.35);
      s.line(F.X(3 + H), yb, F.X(3 + H), F.Y(f(3 + H)), s.c('--ink-2'), 0.35);
      mono(s, 'run 2h = 0.2', F.X(3), yb + 4.6 * s.u, '--ink-2', 3.3);
      mono(s, 'rise 1.2', F.X(3 + H) + 2 * s.u, F.Y(9), '--ink-2', 3.3, 'left');
    });
    const one = after(s, 'one', 0.2);
    s.alpha(one, () => {
      line(F, 3, 9, 6.1, 'red', 1, 0.45);
      mono(s, 'one-sided: 6.1', F.r, F.Y(7.2), 'red', 3.6, 'right', 650);
      mono(s, 'centered: 6.0', F.r, F.Y(7.2) + 5 * s.u, 'gold', 3.6, 'right', 650);
    });
  },
};

/** Position on a log axis from 1e-10 to 1, for the relative-error scale. */
const logX = (s: Scene, v: number) => {
  const l = 12 * s.u;
  const r = s.w - 10 * s.u;
  return l + ((Math.log10(v) + 10) / 10) * (r - l);
};

const BANDS: [number, number, 'green' | 'gold' | 'red', string][] = [
  [1e-10, 1e-6, 'green', 'right'],
  [1e-6, 1e-3, 'gold', 'suspicious'],
  [1e-3, 1, 'red', 'bug'],
];

const compare: SceneDef = {
  marks: { rel: { tex: String.raw`\text{rel} = \frac{|a - n|}{\max(|a|,\, |n|)}`, x: 0.5, y: 0.11, size: 5 } },
  draw(s) {
    s.show('rel', s.ease('rel', 0.6));
    // Two pairs off by the same 0.01.
    const rows: [string, string, string][] = [
      ['a = 1000.0000', 'n = 1000.0001', '1e-7'],
      ['a = 0.0002', 'n = 0.0003', '0.33'],
    ];
    const tall = s.tall;
    rows.forEach(([ta, tn, r], i) => {
      const y = s.h * (0.27 + 0.1 * i);
      const swap = after(s, 'rel', 0.5 + 0.2 * i);
      const right = s.w / 2 + (tall ? 44 : 48) * s.u;
      s.alpha(after(s, 'diff', 0.3 + 0.25 * i), () => {
        mono(s, ta, s.w / 2 - (tall ? 44 : 48) * s.u, y, 'red', 3.4, 'left', 600);
        mono(s, tn, s.w / 2 - (tall ? 12 : 14) * s.u, y, 'gold', 3.4, 'left', 600);
        s.alpha(1 - swap, () => mono(s, 'off 0.0001', right, y, '--ink-2', 3.4, 'right', 550));
      });
      s.alpha(swap, () => mono(s, `rel ${r}`, right, y, i === 0 ? 'green' : 'red', 3.6, 'right', 650));
    });
    // The scale of verdicts.
    const ya = s.h * 0.62;
    const ba = s.ease('bands', 0.6);
    s.alpha(ba, () => {
      for (const [lo, hi, k, name] of BANDS) {
        const x0 = logX(s, lo);
        const x1 = logX(s, hi);
        s.rrect(x0, ya - 3 * s.u, x1 - x0, 6 * s.u, 1, { fill: s.tint(k, 0.18), stroke: s.tint(k, 0.6), lw: 0.3 });
        mono(s, name, (x0 + x1) / 2, ya - 6.6 * s.u, k, 3.5, 'center', 650);
      }
      for (const e of [-10, -7, -4, -2, 0]) {
        const x = logX(s, 10 ** e);
        s.line(x, ya + 3 * s.u, x, ya + 4.4 * s.u, s.c('--ink-3'), 0.3);
        mono(s, e === 0 ? '1' : `1e${e}`, x, ya + 7.4 * s.u, '--ink-3', 3, e === -10 ? 'left' : e === 0 ? 'right' : 'center', 500);
      }
    });
    // Where the examples land.
    const pin = (v: number, k: 'green' | 'red' | 'gold', a: number) =>
      s.alpha(a, () => {
        const x = logX(s, v);
        s.arrow(x, ya - 12 * s.u, x, ya - 3.6 * s.u, s.c(k), 0.45, 2);
      });
    pin(1e-7, 'green', after(s, 'bands', 0.3));
    pin(0.33, 'red', after(s, 'bands', 0.85));
    s.alpha(after(s, 'bug', 0.35), () => {
      mono(s, 'x instead of 2x:  a = 3,  n = 6', s.w / 2, s.h * 0.82, '--ink-2', 3.5, 'center', 600);
      mono(s, 'rel = 3 / 6 = 0.5', s.w / 2, s.h * 0.9, 'red', 3.8, 'center', 650);
    });
  },
};

export const scenes: Record<string, SceneDef> = { numeric, compare };

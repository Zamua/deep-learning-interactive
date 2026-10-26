import { Rng } from '../../../core/rand';
import { type Scene, type SceneDef, lerp } from '../../../lecture/scene';
import { after } from '../draw';
import { bowlLayout, fill, legendLine, result, ring, rings, termRow } from '../partials/art';

const f = (u: number, v: number) => u * u + 2 * v * v;
const P = [1, 1] as const;
const G = [2, 4] as const;
const SCALE = 0.25;

const stack: SceneDef = {
  marks: {
    f: { tex: String.raw`\symf(u, v) = u^2 + 2v^2`, x: 0.5, y: 0.5, size: 4.6, align: 'left' },
  },
  draw(s) {
    const { F, legend: L, fy } = bowlLayout(s);
    const st = s.ease('small', 1.4, 0.6);
    const q = [lerp(P[0], P[0] - 0.1 * G[0], st), lerp(P[1], P[1] - 0.1 * G[1], st)];
    rings(s, F, 3, s.ease('recap', 0.6, 1) * (1 - st));
    s.show('f', s.ease('recap', 0.6), { x: L.x / s.w, y: fy / s.h });
    // The ring through the new point, drawn in green as the step lands.
    s.alpha(st, () => ring(s, F, f(q[0]!, q[1]!), s.c('green'), 0.55));
    // The partials, then the vector they stack into; the partials give way as the gradient takes over.
    const parts = s.ease('recap', 0.6, 1.5) * (1 - s.ease('up', 0.6));
    s.alpha(parts, () => {
      F.seg(-2.3, 1, 2.3, 1, 'gold', 0.3, [1, 1]);
      F.arrow(P[0], P[1], P[0] + G[0] * SCALE, P[1], 'gold', 0.6);
    });
    s.alpha(s.ease('recap', 0.6, 3) * (1 - s.ease('up', 0.6)), () => {
      F.seg(1, -1.6, 1, 2.3, 'teal', 0.3, [1, 1]);
      F.arrow(P[0], P[1], P[0], P[1] + G[1] * SCALE, 'teal', 0.6);
    });
    legendLine(s, L, 0, '∂f/∂u = 2', 'gold', parts);
    legendLine(s, L, 1, '∂f/∂v = 4', 'teal', s.ease('recap', 0.6, 3) * (1 - s.ease('up', 0.6)));
    const g = s.ease('grad', 0.8);
    legendLine(s, L, 2, '∇f = [2, 4]', 'red', g * (1 - s.ease('up', 0.6)));
    // Level direction at P: perpendicular to the gradient.
    const n = Math.hypot(G[0], G[1]);
    const tx = -G[1] / n;
    const ty = G[0] / n;
    s.alpha(s.ease('up', 0.6, 1) * (1 - st), () => F.seg(P[0] - 0.7 * tx, P[1] - 0.7 * ty, P[0] + 0.7 * tx, P[1] + 0.7 * ty, '--ink-3', 0.35, [1, 1]));
    s.alpha(g, () => F.arrow(P[0], P[1], P[0] + G[0] * SCALE, P[1] + G[1] * SCALE, 'red', 0.8, 3.2));
    legendLine(s, L, 0, '∇f: uphill', 'red', s.ease('up', 0.6, 0.4));
    const d = s.ease('down', 0.7);
    s.alpha(d, () => F.arrow(P[0], P[1], P[0] - G[0] * SCALE, P[1] - G[1] * SCALE, 'green', 0.8, 3.2));
    legendLine(s, L, 1, '−∇f: downhill', 'green', d);
    F.dot(P[0], P[1], 'purple', 1.3);
    s.alpha(st, () => F.dot(q[0]!, q[1]!, 'green', 1.3));
    legendLine(s, L, 2, `f: 3 → ${f(q[0]!, q[1]!).toFixed(2)}`, 'green', s.ease('small', 0.6));
  },
};

const rng = new Rng(7);
const WV = Array.from({ length: 12 }, () => Math.round(rng.randn() * 10) / 10);
const GV = Array.from({ length: 12 }, () => Math.round(rng.randn() * 8) / 100);

/** A 3 by 4 grid of cells centered at (cx, cy); `hi` lights row 1, column 2. */
function grid(s: Scene, cx: number, cy: number, vals: number[], k: 'blue' | 'red', hi: number, fmt: (v: number) => string) {
  const cw = 12.5 * s.u;
  const ch = 8 * s.u;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const x = cx + (c - 2) * cw + 0.4 * s.u;
      const y = cy + (r - 1.5) * ch + 0.4 * s.u;
      s.cell(x, y, cw - 0.8 * s.u, ch - 0.8 * s.u, fmt(vals[r * 4 + c]!), k, { on: r === 1 && c === 2 ? hi : 0, size: 3.2 });
    }
  }
}

const shape: SceneDef = {
  draw(s) {
    const [wx, wy, gx, gy] = s.tall ? [s.w / 2, s.h * 0.27, s.w / 2, s.h * 0.76] : [s.w * 0.28, s.h * 0.55, s.w * 0.72, s.h * 0.55];
    const hi = s.ease('entry', 0.6);
    const label = (t: string, x: number, y: number, k: 'blue' | 'red') => s.text(t, x, y - 16 * s.u, { size: 4, font: 'mono', weight: 650, color: s.c(k) });
    s.alpha(s.ease('loss', 0.6), () => {
      grid(s, wx, wy, WV, 'blue', hi, (v) => v.toFixed(1));
      label('W  (3, 4)', wx, wy, 'blue');
    });
    s.alpha(s.ease('loss', 0.6, 2.5), () => {
      const [lx, ly] = s.tall ? [s.w / 2, s.h * 0.49] : [s.w / 2, s.h * 0.17];
      s.text('f: one number', lx, ly, { size: 4, font: 'mono', weight: 650, color: s.c('purple') });
    });
    s.alpha(s.ease('g', 0.6), () => {
      grid(s, gx, gy, GV, 'red', hi, (v) => v.toFixed(2));
      label('∇f  (3, 4)', gx, gy, 'red');
    });
    s.alpha(hi, () => {
      const [tx, ty] = s.tall ? [s.w / 2, s.h * 0.94] : [s.w / 2, s.h * 0.86];
      s.text('∇f[1, 2] = ∂f/∂W[1, 2]', tx, ty, { size: 3.8, font: 'mono', weight: 600, color: s.c('--ink-2') });
    });
  },
};

const worked: SceneDef = {
  marks: {
    p: { tex: String.raw`\symf(u, v) = 2u^2 + uv + 4v \quad \text{at } (1, 2)`, x: 0.5, y: 0.1, size: 4.6 },
  },
  draw(s) {
    s.show('p', s.ease('p', 0.6));
    const u = [0.1, 0.35, 0.6].map((f) => after(s, 'du', f));
    const v = [0.1, 0.35, 0.55].map((f) => after(s, 'dv', f));
    termRow(s, 3, 0, 'purple', s.ease('p', 0.6, 0.8), 'f =', ['2u²', 'uv', '4v']);
    termRow(s, 3, 1, 'gold', s.ease('du', 0.5), '∂f/∂u', [fill(u[0]!, '4u'), fill(u[1]!, 'v'), fill(u[2]!, '0')]);
    termRow(s, 3, 2, 'teal', s.ease('dv', 0.5), '∂f/∂v', [fill(v[0]!, '0'), fill(v[1]!, 'u'), fill(v[2]!, '4')]);
    result(s, '∂f/∂u = 4u + v = 4 + 2 = 6', 0, 'gold', after(s, 'du', 0.8));
    result(s, '∂f/∂v = u + 4 = 1 + 4 = 5', 1, 'teal', after(s, 'dv', 0.55));
    result(s, '∇f = [6, 5]', 2, 'red', after(s, 'dv', 0.75));
  },
};

export const scenes: Record<string, SceneDef> = { stack, shape, worked };

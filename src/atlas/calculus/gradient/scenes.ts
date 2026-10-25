import { Rng } from '../../../core/rand';
import { type Scene, type SceneDef, lerp } from '../../../lecture/scene';
import { Frame, type Rect } from '../draw';

const f = (u: number, v: number) => u * u + 2 * v * v;
const LEVELS = [0.5, 1.5, 3, 4.5, 6, 8];
const P = [1, 1] as const;
const G = [2, 4] as const;
const SCALE = 0.25;

/** The contour plot, and where its legend goes: below it on a phone, beside it on a desktop. */
function layout(s: Scene) {
  const plot: Rect = s.tall ? [s.w * 0.05, s.h * 0.04, s.w * 0.9, s.h * 0.56] : [s.w * 0.04, s.h * 0.06, s.w * 0.58, s.h * 0.88];
  const F = new Frame(s, plot, [-2.3, 2.3, -1.6, 2.3], true);
  const legend = s.tall ? { x: s.w / 2 - 22 * s.u, y: s.h * 0.785, dy: 7.2 * s.u } : { x: s.w * 0.65, y: s.h * 0.3, dy: 8 * s.u };
  return { F, legend };
}

/** The ring where f = c: an ellipse with semi-axes sqrt(c) in u and sqrt(c / 2) in v. */
function ring(s: Scene, F: Frame, c: number, stroke: string, lw: number) {
  const ctx = s.ctx;
  F.clip(() => {
    ctx.beginPath();
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * 2 * Math.PI;
      const x = F.X(Math.sqrt(c) * Math.cos(t));
      const y = F.Y(Math.sqrt(c / 2) * Math.sin(t));
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw * s.u;
    ctx.stroke();
  });
}

function rings(s: Scene, F: Frame, hi = -1, hiA = 0) {
  F.axes(0.8);
  for (const c of LEVELS) ring(s, F, c, s.tint('purple', c === hi ? 0.35 + 0.65 * hiA : 0.35), c === hi ? 0.3 + 0.35 * hiA : 0.3);
  const o = { size: 3.4, font: 'mono', color: s.c('--ink-3'), halo: true } as const;
  s.text('u', F.X(2.15), F.Y(0) + 3 * s.u, o);
  s.text('v', F.X(0) - 3 * s.u, F.Y(2.15), o);
}

function legendLine(s: Scene, L: { x: number; y: number; dy: number }, row: number, text: string, k: Parameters<Scene['c']>[0], a: number) {
  s.alpha(a, () => s.text(text, L.x, L.y + row * L.dy, { size: 3.9, font: 'mono', weight: 600, align: 'left', color: s.c(k) }));
}

const partials: SceneDef = {
  marks: {
    f: { tex: String.raw`\symf(u, v) = u^2 + 2v^2`, x: 0.5, y: 0.5, size: 4.6, align: 'left' },
  },
  draw(s) {
    const { F, legend: L } = layout(s);
    rings(s, F, 3, s.ease('two', 0.6, 1.5));
    F.dot(P[0], P[1], 'purple', 1.3);
    s.show('f', s.ease('two', 0.6), { x: L.x / s.w, y: (L.y - 1.2 * L.dy) / s.h });
    const du = s.ease('du', 0.6);
    s.alpha(du, () => {
      F.seg(-2.3, 1, 2.3, 1, 'gold', 0.3, [1, 1]);
      F.arrow(P[0], P[1], P[0] + G[0] * SCALE, P[1], 'gold', 0.6);
    });
    legendLine(s, L, 0, '∂f/∂u = 2u = 2', 'gold', du);
    const dv = s.ease('dv', 0.6);
    s.alpha(dv, () => {
      F.seg(1, -1.6, 1, 2.3, 'teal', 0.3, [1, 1]);
      F.arrow(P[0], P[1], P[0], P[1] + G[1] * SCALE, 'teal', 0.6);
    });
    legendLine(s, L, 1, '∂f/∂v = 4v = 4', 'teal', dv);
    const g = s.ease('grad', 0.8);
    s.alpha(g, () => F.arrow(P[0], P[1], P[0] + G[0] * SCALE, P[1] + G[1] * SCALE, 'red', 0.8, 3.2));
    legendLine(s, L, 2, '∇f = [2, 4]', 'red', g);
  },
};

const uphill: SceneDef = {
  draw(s) {
    const { F, legend: L } = layout(s);
    const st = s.ease('small', 1.4, 0.6);
    const q = [lerp(P[0], P[0] - 0.1 * G[0], st), lerp(P[1], P[1] - 0.1 * G[1], st)];
    rings(s, F, 3, 1 - st);
    // The ring through the new point, drawn in green as the step lands.
    s.alpha(st, () => ring(s, F, f(q[0]!, q[1]!), s.c('green'), 0.55));
    // Level direction at P: perpendicular to the gradient.
    const n = Math.hypot(G[0], G[1]);
    const tx = -G[1] / n;
    const ty = G[0] / n;
    s.alpha(s.ease('up', 0.6, 1) * (1 - st), () => F.seg(P[0] - 0.7 * tx, P[1] - 0.7 * ty, P[0] + 0.7 * tx, P[1] + 0.7 * ty, '--ink-3', 0.35, [1, 1]));
    F.arrow(P[0], P[1], P[0] + G[0] * SCALE, P[1] + G[1] * SCALE, 'red', 0.8, 3.2);
    legendLine(s, L, 0, '∇f: uphill', 'red', 1);
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
      s.text('L: one number', lx, ly, { size: 4, font: 'mono', weight: 650, color: s.c('red') });
    });
    s.alpha(s.ease('g', 0.6), () => {
      grid(s, gx, gy, GV, 'red', hi, (v) => v.toFixed(2));
      label('g  (3, 4)', gx, gy, 'red');
    });
    s.alpha(hi, () => {
      const [tx, ty] = s.tall ? [s.w / 2, s.h * 0.94] : [s.w / 2, s.h * 0.86];
      s.text('g[1, 2] = ∂L/∂W[1, 2]', tx, ty, { size: 3.8, font: 'mono', weight: 600, color: s.c('--ink-2') });
    });
  },
};

export const scenes: Record<string, SceneDef> = { partials, uphill, shape };

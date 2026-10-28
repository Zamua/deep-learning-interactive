import { Rng } from '../../../core/rand';
import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../../lecture/scene';
import { after, Frame, type Rect } from '../draw';
import { fill, legendLine, result, ring, rings, termRow } from '../partials/art';

type Ink = Parameters<Scene['c']>[0];

const f = (u: number, v: number) => u * u + 2 * v * v;
const P = [1, 1] as const;
const G = [2, 4] as const;
const SCALE = 0.25;
const TH = Math.atan2(G[1], G[0]);
const GN = Math.hypot(G[0], G[1]);
/** The level direction at P: along the ring, at right angles to the gradient. */
const T = [-G[1] / GN, G[0] / GN] as const;

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** The bowl zoomed in around the point, its legend below it on a phone and beside it on a desktop. */
function bowlLayout(s: Scene) {
  const plot: Rect = s.tall ? [s.w * 0.05, s.h * 0.03, s.w * 0.9, s.h * 0.56] : [s.w * 0.03, s.h * 0.05, s.w * 0.5, s.h * 0.9];
  const F = new Frame(s, plot, [-1.7, 2.5, -0.9, 2.5], true);
  const legend = s.tall ? { x: s.w / 2 - 22 * s.u, y: s.h * 0.78, dy: 7.2 * s.u } : { x: s.w * 0.56, y: s.h * 0.34, dy: 8 * s.u };
  const fy = s.tall ? s.h * 0.665 : legend.y - 1.9 * legend.dy;
  return { F, legend, fy };
}

const arrowTo = (F: Frame, dx: number, dy: number, k: Ink, w = 0.6, head = 2.8, from: readonly number[] = P) => F.arrow(from[0]!, from[1]!, from[0]! + dx, from[1]! + dy, k, w, head);

// ---- which way is uphill: the axis slopes, a step swung all the way round, and the gradient

const FAN = 12;
const STEP = 0.6;
const MIX = (25 * Math.PI) / 180;
const DOTS = 72;

const uphill: SceneDef = {
  marks: {
    f: { tex: String.raw`\symf(u, v) = u^2 + 2v^2`, x: 0.5, y: 0.5, size: 4.6, align: 'left' },
  },
  draw(s) {
    const { F, legend: L, fy } = bowlLayout(s);
    const lvl = s.ease('level', 0.6);
    rings(s, F, 3, lvl);
    s.show('f', s.ease('bowl', 0.6, 0.4), { x: L.x / s.w, y: fy / s.h });

    // Every way out of the point, while the question is open.
    for (let i = 0; i < FAN; i++) {
      const a = (i / FAN) * 2 * Math.PI;
      s.alpha(s.ease('any', 0.5, 1.2 + 0.08 * i) * (1 - s.ease('axes', 0.5)), () => arrowTo(F, 0.5 * Math.cos(a), 0.5 * Math.sin(a), '--ink-3', 0.4, 2));
    }

    // The two axis slopes; at 'grad' the v arrow slides onto the u arrow's tip.
    const guides = s.win('axes', 'sweep');
    s.alpha(guides, () => {
      F.seg(-1.7, P[1], 2.3, P[1], 'gold', 0.25, [1, 1]);
      F.seg(P[0], -0.9, P[0], 2.3, 'teal', 0.25, [1, 1]);
    });
    const dim = 1 - 0.6 * s.win('sweep', 'grad') - 0.6 * s.ease('name', 0.6);
    const ua = s.ease('axes', 0.6, 0.8) * dim;
    const va = s.ease('axes', 0.6, 2.4) * dim;
    const slide = s.ease('grad', 1, 2.2) * G[0] * SCALE;
    s.alpha(ua, () => arrowTo(F, G[0] * SCALE, 0, 'gold', 0.6));
    s.alpha(va, () => arrowTo(F, 0, G[1] * SCALE, 'teal', 0.6, 2.8, [P[0] + slide, P[1]]));

    // A step at an angle, split into its moves in u and in v, then swung once round.
    const turn = clamp01(s.prog('sweep') / 0.85);
    const th = s.since('sweep') < 0 ? MIX : MIX + smooth(turn) * (2 * Math.PI + TH - MIX);
    const d = [STEP * Math.cos(th), STEP * Math.sin(th)];
    const stepA = s.ease('mix', 0.6) * (1 - s.ease('grad', 0.6, 1));
    s.alpha(s.win('mix', 'sweep'), () => {
      F.seg(P[0], P[1], P[0] + d[0]!, P[1], 'gold', 0.3, [1, 1]);
      F.seg(P[0] + d[0]!, P[1], P[0] + d[0]!, P[1] + d[1]!, 'teal', 0.3, [1, 1]);
    });
    // Where the step has pointed, how much f rose: red up, green down, faint where level.
    const swept = s.since('sweep') < 0 ? 0 : th - MIX;
    const trail = s.ease('sweep', 0.4) * (1 - 0.8 * s.win('grad', 'level'));
    s.alpha(trail, () => {
      for (let i = 0; i < DOTS; i++) {
        const a = (i / DOTS) * 2 * Math.PI;
        if ((((a - MIX) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) > swept) continue;
        const c = Math.cos(a - TH);
        s.alpha(Math.abs(c), () => F.dot(P[0] + 0.78 * Math.cos(a), P[1] + 0.78 * Math.sin(a), c > 0 ? 'red' : 'green', 0.75));
      }
    });
    s.alpha(stepA, () => arrowTo(F, d[0]!, d[1]!, '--ink-2', 0.55, 2.4));
    const rise = G[0] * d[0]! + G[1] * d[1]!;
    s.alpha(s.win('sweep', 'grad'), () => {
      const k: Ink = rise >= 0 ? 'red' : 'green';
      const r = 1.08;
      s.text(`${rise >= 0 ? '+' : '−'}${Math.abs(rise).toFixed(1)}`, F.X(P[0] + r * Math.cos(th)), F.Y(P[1] + r * Math.sin(th)), { size: 3.2, font: 'mono', weight: 650, color: s.c(k), halo: true });
    });

    // The gradient, and the level direction across it.
    s.alpha(s.ease('level', 0.6, 0.6), () => F.seg(P[0] - 1.2 * T[0], P[1] - 1.2 * T[1], P[0] + 1.2 * T[0], P[1] + 1.2 * T[1], '--ink', 0.4, [1.2, 0.8]));
    s.alpha(s.ease('grad', 0.8, 1.2), () => arrowTo(F, G[0] * SCALE, G[1] * SCALE, 'red', 0.8, 3.2));
    F.dot(P[0], P[1], 'purple', 1.3);

    legendLine(s, L, 0, 'which way is uphill?', '--ink-2', s.win('bowl', 'axes') * s.ease('bowl', 0.6, 2));
    legendLine(s, L, 0, '∂f/∂u = 2', 'gold', s.ease('axes', 0.6, 0.8) * (1 - s.ease('grad', 0.6)));
    legendLine(s, L, 1, '∂f/∂v = 4', 'teal', s.ease('axes', 0.6, 2.4) * (1 - s.ease('grad', 0.6)));
    legendLine(s, L, 2, 'rise ≈ 2·Δu + 4·Δv', '--ink-2', s.ease('mix', 0.6, 1) * (1 - s.ease('grad', 0.6)));
    legendLine(s, L, 0, 'gradient = [2, 4]', 'red', s.ease('grad', 0.6, 3));
    legendLine(s, L, 1, 'axis climbs, combined', '--ink-2', s.win('maxwell', 'name') * after(s, 'maxwell', 0.2));
    legendLine(s, L, 2, '= the fastest way up', 'red', s.win('maxwell', 'name') * after(s, 'maxwell', 0.6));
    legendLine(s, L, 1, 'a slope, pointing up', '--ink-2', s.win('name', 'level'));
    legendLine(s, L, 2, 'longer = steeper', '--ink-2', s.win('name', 'level') * after(s, 'name', 0.7));
    legendLine(s, L, 1, 'along the ring: level', '--ink-2', s.ease('level', 0.6, 0.6));
    cite(s, 'James Clerk Maxwell, 1873', s.win('maxwell', 'name'));
  },
};

// ---- the symbol, and the way down

/** An equilateral triangle centered at (x, y), its point aimed at angle `dir` (canvas radians); `harp` strings it. */
function triangle(s: Scene, x: number, y: number, r: number, dir: number, k: Ink, harp = 0) {
  const g = s.ctx;
  const half = r * Math.sin(Math.PI / 3);
  g.save();
  g.translate(x, y);
  // Drawn pointing down, as ∇, then turned to `dir`.
  g.rotate(dir - Math.PI / 2);
  g.beginPath();
  g.moveTo(0, r);
  g.lineTo(-half, -r / 2);
  g.lineTo(half, -r / 2);
  g.closePath();
  g.strokeStyle = s.c(k);
  g.lineWidth = 0.55 * s.u;
  g.lineJoin = 'round';
  g.stroke();
  s.alpha(harp, () => {
    for (let i = 1; i <= 5; i++) {
      const sx = -half + (2 * half * i) / 6;
      const bottom = -r / 2 + (1 - Math.abs(sx) / half) * 1.5 * r;
      s.line(sx, -r / 2, sx, bottom, s.tint(k, 0.7), 0.25);
    }
  });
  g.restore();
}

const down: SceneDef = {
  marks: {
    f: { tex: String.raw`\symf(u, v) = u^2 + 2v^2`, x: 0.5, y: 0.5, size: 4.6, align: 'left' },
  },
  draw(s) {
    const { F, legend: L, fy } = bowlLayout(s);
    const st = s.ease('down', 1.4, 2.2);
    const q = [lerp(P[0], P[0] - 0.1 * G[0], st), lerp(P[1], P[1] - 0.1 * G[1], st)];
    rings(s, F);
    s.alpha(st * (1 - s.ease('others', 0.6)), () => ring(s, F, f(q[0]!, q[1]!), s.c('green'), 0.55));
    s.show('f', 1, { x: L.x / s.w, y: fy / s.h });
    arrowTo(F, G[0] * SCALE, G[1] * SCALE, 'red', 0.8, 3.2);
    s.alpha(s.ease('down', 0.7), () => arrowTo(F, -G[0] * SCALE, -G[1] * SCALE, 'green', 0.8, 3.2));
    // The two slower ways: only v, and along the ring.
    const o = s.ease('others', 0.6);
    s.alpha(o, () => arrowTo(F, 0, -G[1] * SCALE, 'teal', 0.6));
    s.alpha(s.ease('others', 0.6, 2.2), () => arrowTo(F, -G[1] * SCALE, G[0] * SCALE, '--ink-2', 0.6));
    F.dot(P[0], P[1], 'purple', 1.3);
    s.alpha(st * (1 - o), () => F.dot(q[0]!, q[1]!, 'green', 1.2));

    legendLine(s, L, 0, '∇f = [2, 4]', 'red', s.ease('nabla', 0.6, 1));
    // The symbol: on its side, stood upright, then strung like a harp.
    const gx = L.x + 5 * s.u;
    const gy = L.y + 1.5 * L.dy;
    const up = after(s, 'hamilton', 0.55, 1);
    const glyph = s.win('hamilton', 'down');
    s.alpha(glyph, () => {
      triangle(s, gx, gy, 4.2 * s.u, lerp(Math.PI, Math.PI / 2, up), '--ink', s.ease('smith', 0.8, 1.6));
      const t = { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c('--ink-2') } as const;
      s.alpha(1 - up, () => s.text('on its side', gx + 8 * s.u, gy, t));
      s.alpha(up * (1 - s.ease('smith', 0.6, 1.6)), () => s.text('upright', gx + 8 * s.u, gy, t));
      s.alpha(s.ease('smith', 0.6, 1.6), () => s.text('nabla: a harp', gx + 8 * s.u, gy, t));
    });
    cite(s, 'William Rowan Hamilton, 1846', s.ease('hamilton', 0.5) * (1 - after(s, 'hamilton', 0.55)));
    cite(s, 'Peter Guthrie Tait, 1867', after(s, 'hamilton', 0.6) * (1 - s.ease('smith', 0.5)));
    cite(s, 'William Robertson Smith', s.win('smith', 'down'));
    legendLine(s, L, 1, '−∇f = [−2, −4]', 'green', s.win('down', 'others'));
    legendLine(s, L, 2, 'fastest way down', 'green', s.win('down', 'others') * after(s, 'down', 0.6));
    legendLine(s, L, 1, '[0, −4]: down, slower', 'teal', s.ease('others', 0.6));
    legendLine(s, L, 2, '[−4, 2]: level', '--ink-2', s.ease('others', 0.6, 2.2));
  },
};

// ---- one entry per input: a grid of inputs has a gradient in the same grid

const rng = new Rng(7);
const WV = Array.from({ length: 12 }, () => Math.round(rng.randn() * 10) / 10);
const GV = Array.from({ length: 12 }, () => Math.round(rng.randn() * 8) / 100);
const wv = Array.from({ length: 5 }, () => Math.round(rng.randn() * 10) / 10);
const gv = Array.from({ length: 5 }, () => Math.round(rng.randn() * 8) / 10);

/** An r by c grid of cells centered at (cx, cy); `hi` lights row 1, column 2. */
function grid(s: Scene, cx: number, cy: number, r: number, c: number, vals: number[], k: 'blue' | 'red', hi: number, fmt: (v: number) => string, cw = 12.5) {
  const w = cw * s.u;
  const h = 8 * s.u;
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      const x = cx + (j - c / 2) * w + 0.4 * s.u;
      const y = cy + (i - r / 2) * h + 0.4 * s.u;
      s.cell(x, y, w - 0.8 * s.u, h - 0.8 * s.u, fmt(vals[i * c + j]!), k, { on: i === 1 && j === 2 ? hi : 0, size: 3.2 });
    }
  }
}

const shape: SceneDef = {
  draw(s) {
    const [wx, wy, gx, gy] = s.tall ? [s.w / 2, s.h * 0.27, s.w / 2, s.h * 0.76] : [s.w * 0.28, s.h * 0.55, s.w * 0.72, s.h * 0.55];
    const vec = s.ease('vec', 0.8);
    const hi = after(s, 'name', 0.3) * (1 - vec);
    const label = (t: string, x: number, y: number, k: 'blue' | 'red', dy = 16) => s.text(t, x, y - dy * s.u, { size: 4, font: 'mono', weight: 650, color: s.c(k) });
    s.alpha(s.ease('many', 0.6) * (1 - vec), () => {
      grid(s, wx, wy, 3, 4, WV, 'blue', hi, (v) => v.toFixed(1));
      label('W  (3, 4)', wx, wy, 'blue');
    });
    s.alpha(s.ease('many', 0.6, 3) * (1 - vec), () => {
      const [lx, ly] = s.tall ? [s.w / 2, s.h * 0.49] : [s.w / 2, s.h * 0.17];
      s.text('f: one number', lx, ly, { size: 4, font: 'mono', weight: 650, color: s.c('purple') });
    });
    const named = s.ease('name', 0.6);
    s.alpha(s.ease('g', 0.6) * (1 - vec), () => {
      grid(s, gx, gy, 3, 4, GV, 'red', hi, (v) => v.toFixed(2));
      s.alpha(1 - named, () => label('∇f  (3, 4)', gx, gy, 'red'));
      s.alpha(named, () => label('∂f/∂W  (3, 4)', gx, gy, 'red'));
    });
    s.alpha(hi, () => {
      const [tx, ty] = s.tall ? [s.w / 2, s.h * 0.94] : [s.w / 2, s.h * 0.86];
      s.text('∇f[1, 2]: slope in W[1, 2]', tx, ty, { size: 3.8, font: 'mono', weight: 600, color: s.c('--ink-2') });
    });
    // A vector input: five numbers in, five partials out.
    s.alpha(vec, () => {
      grid(s, wx, wy, 1, 5, wv, 'blue', 0, (v) => v.toFixed(1), 10);
      label('w  (5,)', wx, wy, 'blue', 9);
      grid(s, gx, gy, 1, 5, gv, 'red', 0, (v) => v.toFixed(1), 10);
      label('∂f/∂w  (5,)', gx, gy, 'red', 9);
    });
  },
};

// ---- a worked gradient, one entry at a time

const worked: SceneDef = {
  marks: {
    p: { tex: String.raw`\symf(u, v) = 2u^2 + uv + 4v \quad \text{at } (1, 2)`, x: 0.5, y: 0.1, size: 4.6 },
  },
  draw(s) {
    s.show('p', s.ease('p', 0.6));
    const u = [0.15, 0.4, 0.75].map((x) => after(s, 'du', x));
    const v = [0.15, 0.45, 0.8].map((x) => after(s, 'dv', x));
    termRow(s, 3, 0, 'purple', s.ease('p', 0.6, 0.8), 'f =', ['2u²', 'uv', '4v']);
    termRow(s, 3, 1, 'gold', s.ease('du', 0.5), '∂f/∂u', [fill(u[0]!, '4u'), fill(u[1]!, 'v'), fill(u[2]!, '0')]);
    termRow(s, 3, 2, 'teal', s.ease('dv', 0.5), '∂f/∂v', [fill(v[0]!, '0'), fill(v[1]!, 'u'), fill(v[2]!, '4')]);
    result(s, '∂f/∂u = 4u + v', 0, 'gold', s.ease('du-n', 0.5) * (1 - after(s, 'du-n', 0.55)));
    result(s, '∂f/∂u = 4u + v = 4 + 2 = 6', 0, 'gold', after(s, 'du-n', 0.55));
    result(s, '∂f/∂v = u + 4', 1, 'teal', s.ease('dv-n', 0.5) * (1 - after(s, 'dv-n', 0.5)));
    result(s, '∂f/∂v = u + 4 = 1 + 4 = 5', 1, 'teal', after(s, 'dv-n', 0.5));
    result(s, '∇f = [6, 5]', 2, 'red', after(s, 'stack', 0.4));
  },
};

export const scenes: Record<string, SceneDef> = { uphill, down, shape, worked };

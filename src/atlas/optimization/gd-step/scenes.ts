import { type Ink, type Scene, type SceneDef, lerp } from '../../../lecture/scene';
import { Frame, type Rect } from '../../calculus/draw';
import { after, cite, stacked } from '../../draw';
import { hop } from '../draw';

type Pt = [number, number];

const f = (u: number, v: number) => u * u + 2 * v * v;
const grad = (p: Pt): Pt => [2 * p[0], 4 * p[1]];
const ETA = 0.1;
/** The gradient arrow is drawn at a quarter of its length, as in the gradient explainer. */
const SCALE = 0.25;
const P0: Pt = [1, 1];
const P1: Pt = [0.8, 0.6];
/** The other side of the bowl, where u's slope is negative. */
const Q0: Pt = [-1, 1];
const Q1: Pt = [-0.8, 0.6];

/** The walk with eta = 0.1: every step multiplies u by 0.8 and v by 0.6. */
const WALK: Pt[] = [P0];
for (let k = 0; k < 9; k++) {
  const p = WALK[k]!;
  const g = grad(p);
  WALK.push([p[0] - ETA * g[0], p[1] - ETA * g[1]]);
}

/** The bowl from above, its formula and legend below it or beside it. */
function layout(s: Scene) {
  const st = stacked(s);
  const plot: Rect = st ? [s.w * 0.04, s.h * 0.04, s.w * 0.92, s.h * 0.52] : [s.w * 0.02, s.h * 0.06, s.w * 0.55, s.h * 0.88];
  // v spans the start, the arrows above it and the bottom; u widens to fill the plot, but always holds both starts.
  const [y0, y1] = [-0.55, 2.25];
  const half = Math.max(2, ((y1 - y0) * plot[2]) / plot[3] / 2);
  const F = new Frame(s, plot, [0.3 - half, 0.3 + half, y0, y1], true);
  const L = st ? { x: s.w / 2 - 25 * s.u, y: s.h * 0.72, dy: 6.6 * s.u } : { x: s.w * 0.6, y: s.h * 0.4, dy: 8 * s.u };
  const fy = st ? s.h * 0.635 : L.y - 1.9 * L.dy;
  return { F, L, fy };
}

/** The ring where f = c: an ellipse with semi-axes sqrt(c) in u and sqrt(c / 2) in v. */
function ring(s: Scene, F: Frame, c: number, stroke: string, lw: number) {
  const g = s.ctx;
  F.clip(() => {
    g.beginPath();
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * 2 * Math.PI;
      const x = F.X(Math.sqrt(c) * Math.cos(t));
      const y = F.Y(Math.sqrt(c / 2) * Math.sin(t));
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.strokeStyle = stroke;
    g.lineWidth = lw * s.u;
    g.stroke();
  });
}

const LEVELS = [0.5, 1.5, 3, 4.5, 6, 8];

/** Every ring, the one at height 3 (through the start) lit by `hi`, with the u and v axes. */
function rings(s: Scene, F: Frame, hi = 0) {
  F.axes(0.8);
  for (const c of LEVELS) ring(s, F, c, s.tint('purple', c === 3 ? 0.35 + 0.65 * hi : 0.35), c === 3 ? 0.3 + 0.35 * hi : 0.3);
  const o = { size: 3.4, font: 'mono', color: s.c('--ink-3'), halo: true } as const;
  s.text('u', F.X(F.dom[1]) - 3 * s.u, F.Y(0) + 3 * s.u, o);
  s.text('v', F.X(0) - 3 * s.u, F.Y(F.dom[3]) + 3 * s.u, o);
}

function legend(s: Scene, L: { x: number; y: number; dy: number }, row: number, text: string, k: Ink, a: number) {
  s.alpha(a, () => s.text(text, L.x, L.y + row * L.dy, { size: stacked(s) ? 3.7 : 3.5, font: 'mono', weight: 600, align: 'left', color: s.c(k) }));
}

/** A label beside a point on the bowl. */
function tag(s: Scene, F: Frame, p: Pt, text: string, k: Ink, dx: number, dy: number, align: CanvasTextAlign = 'left') {
  s.text(text, F.X(p[0]) + dx * s.u, F.Y(p[1]) + dy * s.u, { size: 3.4, font: 'mono', weight: 650, align, color: s.c(k), halo: true });
}

/** Fog over the plot: clear around (x, y), thickening outward. */
function fog(s: Scene, F: Frame, p: Pt, a: number) {
  if (a <= 0.003) return;
  const g = s.ctx;
  const r0 = 0.32 * F.kx;
  const r1 = 0.95 * F.kx;
  const grd = g.createRadialGradient(F.X(p[0]), F.Y(p[1]), r0, F.X(p[0]), F.Y(p[1]), r1);
  grd.addColorStop(0, s.tint('--card', 0));
  grd.addColorStop(1, s.tint('--card', 0.95 * a));
  const [x0, x1, y0, y1] = F.dom;
  F.clip(() => {
    g.fillStyle = grd;
    g.fillRect(F.X(x0), F.Y(y1), F.X(x1) - F.X(x0), F.Y(y0) - F.Y(y1));
  });
}

/** The trail of a walk: an arrow per step taken, a dot where each landed. */
function trail(s: Scene, F: Frame, pts: Pt[], done: number, k: Ink) {
  for (let i = 0; i < done; i++) F.arrow(pts[i]![0], pts[i]![1], pts[i + 1]![0], pts[i + 1]![1], k, 0.4, 1.8);
  for (let i = 0; i <= done; i++) s.circle(F.X(pts[i]![0]), F.Y(pts[i]![1]), 0.8 * s.u, { fill: s.tint('blue', 0.55) });
}

const fmarks = {
  f: { tex: String.raw`\symf(u, v) = u^2 + 2v^2`, x: 0.5, y: 0.5, size: 4.4, align: 'left' as const },
};

// ---- downhill in fog: only the slope underfoot, a short step, and again

const walk: SceneDef = {
  marks: fmarks,
  draw(s) {
    const { F, L, fy } = layout(s);
    rings(s, F);
    s.show('f', s.ease('bowl', 0.6, 0.4), { x: L.x / s.w, y: fy / s.h });

    // Where the walker stands: at the start, one short step in, then hopping down the walk.
    const first = after(s, 'short', 0.55, 0.9);
    const h = hop(WALK.slice(1), s.since('walk') - 0.4, 1);
    const at: Pt = s.since('walk') < 0 ? [lerp(P0[0], P1[0], first), lerp(P0[1], P1[1], first)] : [h.x, h.y];
    const done = s.since('walk') < 0 ? (first >= 1 ? 1 : 0) : 1 + h.done;

    // The bottom, seen at first, lost in the fog, found again at the end.
    s.alpha(s.ease('bowl', 0.6, 2.5), () => {
      F.dot(0, 0, 'green', 1.2);
      tag(s, F, [0, 0], 'bottom', 'green', -2.5, 3.6, 'right');
    });
    s.alpha(0.85, () => trail(s, F, WALK, done, 'slate'));
    fog(s, F, at, s.ease('fog', 1.4, 0.4) * (1 - s.ease('cauchy', 1.4)));

    // The slope felt at the start: uphill, and the way down.
    const dir = s.win('down', 'walk') * (1 - 0.6 * first);
    s.alpha(s.ease('down', 0.7, 1.5) * dir, () => {
      F.arrow(P0[0], P0[1], P0[0] + 2 * SCALE, P0[1] + 4 * SCALE, 'red', 0.7, 3);
      tag(s, F, [P0[0] + 2 * SCALE, P0[1] + 4 * SCALE], '[2, 4]', 'red', 2, 0);
    });
    s.alpha(s.ease('down', 0.7, 4.5) * dir, () => {
      F.arrow(P0[0], P0[1], P0[0] - 2 * SCALE, P0[1] - 4 * SCALE, 'green', 0.7, 3);
      tag(s, F, [P0[0] - 2 * SCALE, P0[1] - 4 * SCALE], '[−2, −4]', 'green', -2, 0, 'right');
    });
    F.dot(at[0], at[1], 'blue', 1.5);

    legend(s, L, 0, 'the goal: the bottom', '--ink-2', s.win('bowl', 'fog') * s.ease('bowl', 0.6, 2.5));
    legend(s, L, 0, 'known: only the slope here', '--ink-2', s.win('fog', 'down') * s.ease('fog', 0.6, 2));
    legend(s, L, 0, 'gradient [2, 4]: uphill', 'red', s.win('down', 'walk') * s.ease('down', 0.6, 1.5));
    legend(s, L, 1, '[−2, −4]: straight down', 'green', s.win('down', 'walk') * s.ease('down', 0.6, 4.5));
    legend(s, L, 2, 'short step, feel again', '--ink-2', s.win('short', 'walk') * s.ease('short', 0.6, 1));
    legend(s, L, 0, 'step, feel, step, feel ...', '--ink-2', s.ease('walk', 0.6));
    legend(s, L, 1, 'every step: straight down', 'green', s.ease('walk', 0.6, 1.2));
    cite(s, 'Augustin-Louis Cauchy, 1847', s.ease('cauchy', 0.6));
  },
};

// ---- the update: w, g, the step size, and the rule

const rule: SceneDef = {
  marks: {
    rule: { tex: String.raw`\symw \leftarrow \symw - \symeta\,\symg`, x: 0.5, y: 0.5, size: 5, align: 'left' },
  },
  draw(s) {
    const { F, L, fy } = layout(s);
    rings(s, F);
    s.show('rule', s.ease('rule', 0.6), { x: L.x / s.w, y: fy / s.h });

    const side = s.ease('sign', 0.8);
    const steep = s.ease('steep', 0.7);
    // The first point: g drawn at a quarter, cut to eta g, then flipped into the step.
    const shrink = s.ease('eg', 1, 1.5);
    const flip = s.ease('new', 0.8, 0.6);
    const go = s.ease('new', 1, 1.6);
    const k = lerp(SCALE, ETA, shrink);
    s.alpha((1 - 0.75 * side) * (1 - steep), () => {
      s.alpha(s.ease('g', 0.6) * (1 - flip), () => {
        F.arrow(P0[0], P0[1], P0[0] + 2 * k, P0[1] + 4 * k, 'red', 0.7, 2.6);
        tag(s, F, [P0[0] + 2 * k, P0[1] + 4 * k], shrink > 0.5 ? 'ηg' : 'g', 'red', 2, -1);
      });
      s.alpha(flip, () => {
        F.arrow(P0[0], P0[1], P1[0], P1[1], 'green', 0.7, 2.2);
        tag(s, F, P1, 'new w', 'blue', -2.5, 3.5, 'right');
      });
      s.alpha(go * 0.5, () => F.dot(P0[0], P0[1], 'blue', 1.3));
      F.dot(lerp(P0[0], P1[0], go), lerp(P0[1], P1[1], go), 'blue', 1.5);
      s.alpha(s.ease('w', 0.6, 1.5) * (1 - go), () => tag(s, F, P0, 'w', 'blue', 2.4, 2.8));
    });

    // The other side: u's slope is negative, so u moves right.
    s.alpha(side * (1 - steep), () => {
      F.arrow(Q0[0], Q0[1], Q0[0] - 2 * SCALE, Q0[1] + 4 * SCALE, 'red', 0.7, 2.6);
      tag(s, F, [Q0[0] - 2 * SCALE, Q0[1] + 4 * SCALE], '[−2, 4]', 'red', 2, 0);
      const m = s.ease('sign', 1, 4);
      s.alpha(m, () => F.arrow(Q0[0], Q0[1], Q1[0], Q1[1], 'green', 0.7, 2.2));
      s.alpha(m * 0.5, () => F.dot(Q0[0], Q0[1], 'blue', 1.3));
      F.dot(lerp(Q0[0], Q1[0], m), lerp(Q0[1], Q1[1], m), 'blue', 1.5);
    });

    // The walk again: the steps shrink as the slope does.
    s.alpha(steep, () => {
      const h = hop(WALK, s.since('steep') - 0.8, 0.8);
      for (let i = 0; i < h.done; i++) F.arrow(WALK[i]![0], WALK[i]![1], WALK[i + 1]![0], WALK[i + 1]![1], 'green', 0.5, 1.8);
      F.dot(h.x, h.y, 'blue', 1.5);
    });

    const named = 1 - side;
    legend(s, L, 0, 'w = [1, 1]', 'blue', s.ease('w', 0.6) * named * (1 - steep));
    legend(s, L, 1, 'g = [2, 4]', 'red', s.ease('g', 0.6) * named * (1 - steep));
    legend(s, L, 2, 'η = 0.1, the step size', 'slate', s.ease('eta', 0.6) * named * (1 - steep));
    legend(s, L, 3, 'ηg = [0.2, 0.4]', 'slate', s.win('eg', 'new') * s.ease('eg', 0.6, 1.5));
    legend(s, L, 3, 'w − ηg = [0.8, 0.6]', 'blue', s.ease('new', 0.6, 1.6) * named * (1 - steep));
    legend(s, L, 0, 'w = [−1, 1]', 'blue', side * (1 - steep));
    legend(s, L, 1, 'g = [−2, 4]', 'red', side * (1 - steep));
    legend(s, L, 2, 'u: −1 − 0.1·(−2) = −0.8', 'gold', s.win('sign', 'which') * s.ease('sign', 0.6, 2.5));
    legend(s, L, 3, 'v: 1 − 0.1·4 = 0.6', 'teal', s.win('sign', 'which') * s.ease('sign', 0.6, 6));
    legend(s, L, 2, 'sign of g: which way', 'red', s.win('which', 'steep'));
    legend(s, L, 3, 'η > 0: only how far', 'slate', s.win('which', 'steep') * s.ease('which', 0.6, 2.5));
    legend(s, L, 0, '2 × slope: 2 × step', '--ink-2', s.ease('steep', 0.6, 0.4));
    legend(s, L, 1, 'flatter, so shorter steps', 'green', s.ease('steep', 0.6, 3.5));
  },
};

// ---- how much f drops: each entry adds minus eta times its slope squared

const drop: SceneDef = {
  marks: fmarks,
  draw(s) {
    const { F, L, fy } = layout(s);
    rings(s, F, s.ease('ask', 0.6));
    s.show('f', 1, { x: L.x / s.w, y: fy / s.h });
    const moves = s.ease('ask', 0.6, 2);
    s.alpha(moves * (1 - s.ease('true', 0.6)), () => {
      F.seg(P0[0], P0[1], P1[0], P0[1], 'gold', 0.4, [1, 0.8]);
      F.seg(P1[0], P0[1], P1[0], P1[1], 'teal', 0.4, [1, 0.8]);
      tag(s, F, [0.9, P0[1]], '−0.2', 'gold', 0, -4, 'center');
      tag(s, F, [P1[0], 0.8], '−0.4', 'teal', -1.8, 0, 'right');
    });
    const tr = s.ease('true', 0.8, 0.4);
    s.alpha(tr, () => {
      ring(s, F, f(P1[0], P1[1]), s.c('green'), 0.55);
      tag(s, F, [0, Math.sqrt(1.36 / 2)], 'f = 1.36', 'green', -1.5, -2.2, 'right');
      tag(s, F, [0, Math.sqrt(3 / 2)], 'f = 3', 'purple', -1.5, -2.2, 'right');
    });
    F.arrow(P0[0], P0[1], P1[0], P1[1], 'green', 0.6, 2);
    s.alpha(0.5, () => F.dot(P0[0], P0[1], 'blue', 1.3));
    F.dot(P1[0], P1[1], 'blue', 1.5);

    legend(s, L, 0, 'Δf ≈ 2·(−0.2) + 4·(−0.4)', '--ink-2', s.ease('ask', 0.6, 2));
    legend(s, L, 1, 'each: −η · g[i]²', 'slate', s.ease('each', 0.6, 2.5));
    legend(s, L, 2, 'g[i]² ≥ 0: f goes down', 'green', s.win('never', 'sum') * s.ease('never', 0.6, 1));
    legend(s, L, 2, '2² + 4² = 20', '--ink-2', s.win('sum', 'est'));
    legend(s, L, 2, 'Δf ≈ −0.1 × 20 = −2', 'purple', s.ease('est', 0.6, 1));
    legend(s, L, 3, 'true: 3 → 1.36, Δf = −1.64', 'green', s.ease('true', 0.6, 1.5));
    cite(s, 'Cauchy, 1847: the same estimate', s.win('works', 'sum') * after(s, 'works', 0.4));
  },
};

export const scenes: Record<string, SceneDef> = { walk, rule, drop };


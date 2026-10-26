import type { Scene, SceneDef } from '../../../lecture/scene';
import { smooth } from '../../../lecture/scene';
import { rich, type Ink } from '../draw';

const RAD = Math.PI / 180;
const Q = [2, 1];
const K = [1, 1];
const lenOf = (p: number[]) => Math.hypot(p[0]!, p[1]!);
const angOf = (p: number[]) => Math.atan2(p[1]!, p[0]!) / RAD;

/** Plane coordinates mapped onto the stage: `k` stage px per unit, the box's center at (cx, cy). */
interface Plane {
  P(x: number, y: number): [number, number];
  k: number;
}

function plane(s: Scene, cx: number, cy: number, k: number, box: [number, number, number, number]): Plane {
  const [x0, x1, y0, y1] = box;
  const ox = cx - ((x0 + x1) / 2) * k;
  const oy = cy + ((y0 + y1) / 2) * k;
  const P = (x: number, y: number): [number, number] => [ox + x * k, oy - y * k];
  s.line(...P(x0, 0), ...P(x1, 0), s.c('--axis'), 0.3);
  s.line(...P(0, y0), ...P(0, y1), s.c('--axis'), 0.3);
  return { P, k };
}

/** An arrow from the origin at angle `a` (degrees) and length `r`, with a label beyond its tip. */
function ray(s: Scene, F: Plane, r: number, a: number, k: Ink, label?: string, o: { width?: number; size?: number; push?: number } = {}): void {
  const x = r * Math.cos(a * RAD);
  const y = r * Math.sin(a * RAD);
  s.arrow(...F.P(0, 0), ...F.P(x, y), s.c(k), o.width ?? 0.7, 3);
  if (!label) return;
  const d = r + (o.push ?? 0.42);
  s.text(label, ...F.P(d * Math.cos(a * RAD), d * Math.sin(a * RAD)), { size: o.size ?? 3.4, font: 'mono', weight: 650, color: s.c(k), halo: true });
}

/** An arc around the origin from angle a0 to a1 (degrees), radius r in plane units, with a label. */
function arc(s: Scene, F: Plane, r: number, a0: number, a1: number, k: Ink, label?: string): void {
  const [ox, oy] = F.P(0, 0);
  const c = s.ctx;
  c.beginPath();
  c.arc(ox, oy, r * F.k, -a0 * RAD, -a1 * RAD, a1 > a0);
  c.strokeStyle = s.tint(k, 0.8);
  c.lineWidth = 0.35 * s.u;
  c.stroke();
  if (label) {
    const m = ((a0 + a1) / 2) * RAD;
    s.text(label, ...F.P((r + 0.32) * Math.cos(m), (r + 0.32) * Math.sin(m)), { size: 3, font: 'mono', weight: 600, color: s.c(k), halo: true });
  }
}

/** Where the planes and the arithmetic sit: side by side on a wide stage, stacked on a tall one. */
function layout(s: Scene) {
  const tall = s.tall;
  return {
    cx: tall ? s.w / 2 : s.w * 0.27,
    cy: tall ? s.h * 0.27 : s.h * 0.58,
    px: tall ? s.w / 2 : s.w * 0.75,
    ty: tall ? s.h * 0.58 : s.h * 0.27,
    ly: tall ? s.h * 0.87 : s.h * 0.6,
    rule: tall ? { x: 0.5, y: 0.78 } : { x: 0.5, y: 0.09 },
  };
}

/** The plane for the pairs [2, 1] and [1, 1]. */
function pairPlane(s: Scene): Plane {
  const L = layout(s);
  const k = s.tall ? 14.5 * s.u : Math.min(15 * s.u, (0.5 * s.w) / 4.7);
  return plane(s, L.cx, L.cy, k, [-2, 2.7, -0.4, 2.7]);
}

/** q = [2, 1] turned a quarter turn, `sw` of the way, with a ghost where it started. */
function quarter(s: Scene, F: Plane, sw: number, ghost: number): void {
  const q0 = angOf(Q);
  s.alpha(ghost, () => {
    ray(s, F, lenOf(Q), q0, '--ink-3', undefined, { width: 0.4 });
    arc(s, F, 0.8, q0, q0 + 90 * sw, 'slate', sw > 0.9 ? '90°' : undefined);
  });
  const tip = sw < 0.5 ? '[2, 1]' : sw > 0.95 ? '[−1, 2]' : undefined;
  ray(s, F, lenOf(Q), q0 + 90 * sw, 'teal', tip, { push: 0.5 });
}

/** The plane for an arrow of length one, with a dashed half circle. */
function unitPlane(s: Scene): Plane {
  const L = layout(s);
  const k1 = s.tall ? 26 * s.u : Math.min(26 * s.u, (0.5 * s.w) / 2.8);
  const F = plane(s, s.tall ? L.cx : s.w * 0.3, L.cy, k1, [-1.25, 1.35, -0.3, 1.3]);
  const [ox, oy] = F.P(0, 0);
  const c = s.ctx;
  c.save();
  c.setLineDash([0.8 * s.u, 0.8 * s.u]);
  c.beginPath();
  c.arc(ox, oy, k1, -Math.PI, 0);
  c.strokeStyle = s.tint('--ink-3', 0.35);
  c.lineWidth = 0.25 * s.u;
  c.stroke();
  c.restore();
  return F;
}

const lab = { size: 3, font: 'mono' as const, weight: 650, halo: true };
const mono = { size: 3.3, font: 'mono' as const, weight: 600 };

/** Rows of angle, cos and sin; `on` lights a row. */
function table(s: Scene, rows: [string, string, string, number][]): void {
  const { px, ty } = layout(s);
  const cols = [-14, 2, 16].map((d) => px + d * s.u);
  const head: [string, Ink][] = [['angle', '--ink-3'], ['cos', '--ink-3'], ['sin', '--ink-3']];
  head.forEach(([t, kk], i) => s.text(t, cols[i]!, ty, { ...mono, color: s.c(kk) }));
  rows.forEach(([a, c, sn, on], r) => {
    const y = ty + (r + 1) * 5.4 * s.u;
    [a, c, sn].forEach((t, i) => s.text(t, cols[i]!, y, { ...mono, color: s.c(on > 0.5 ? '--ink' : '--ink-2') }));
  });
}

/** The unit arrow's angle: swept to 60° as it is introduced, then up to 90° and back while cos and sin are read off. */
function unitAngle(s: Scene): number {
  const cp = s.prog('cossin');
  return 60 * s.ease('unit', 1.4, 1.5) + 30 * smooth((cp - 0.04) / 0.1) - 30 * smooth((cp - 0.48) / 0.1);
}

const turn: SceneDef = {
  draw(s) {
    const unit = s.ease('unit', 0.6);
    s.alpha(1 - unit, () => {
      const F = pairPlane(s);
      s.alpha(s.ease('pair', 0.6), () => quarter(s, F, s.ease('turn', 1.4, 0.6), s.ease('turn', 0.5)));
      s.alpha(s.ease('pair', 0.6, 0.6) * (1 - s.ease('turn', 0.4)), () => s.text('q', ...F.P(1.0, 0.75), { size: 4, font: 'mono', weight: 650, color: s.c('teal'), halo: true }));
    });
    // An arrow of length one: its tip is (cos, sin).
    s.alpha(unit, () => {
      const F = unitPlane(s);
      const a = unitAngle(s);
      const ca = Math.cos(a * RAD);
      const sa = Math.sin(a * RAD);
      s.line(...F.P(ca, sa), ...F.P(ca, 0), s.tint('teal', 0.7), 0.3, [0.8, 0.8]);
      s.line(...F.P(ca, sa), ...F.P(0, sa), s.tint('gold', 0.7), 0.3, [0.8, 0.8]);
      s.text('cos', ...F.P(ca, -0.15), { ...lab, color: s.c('teal') });
      s.text('sin', ...F.P(-0.08, sa), { ...lab, align: 'right', color: s.c('gold') });
      arc(s, F, 0.32, 0, a, 'slate', a > 5 ? `${Math.round(a)}°` : undefined);
      ray(s, F, 1, a, 'teal');
    });
    const cp = s.prog('cossin');
    s.alpha(s.ease('cossin', 0.6), () =>
      table(s, [
        ['90°', '0', '1', 1 - smooth((cp - 0.48) / 0.1)],
        ['60°', '0.5', '0.87', smooth((cp - 0.48) / 0.1)],
      ]),
    );
  },
};

const rule: SceneDef = {
  marks: {
    rule: { tex: String.raw`[a,\ b] \;\to\; [\,a\cos{} - b\sin{},\ \ a\sin{} + b\cos{}\,]`, x: 0.5, y: 0.5, size: 4 },
  },
  draw(s) {
    const L = layout(s);
    const u = s.u;
    const check = s.ease('check', 0.6);
    // [1, 0] and [0, 1] turned together by 60°.
    s.alpha(1 - check, () => {
      const F = unitPlane(s);
      ray(s, F, 1, 0, '--ink-3', undefined, { width: 0.4 });
      ray(s, F, 1, 90, '--ink-3', undefined, { width: 0.4 });
      s.text('[1, 0]', ...F.P(1.12, -0.14), { ...lab, color: s.c('--ink-2') });
      s.text('[0, 1]', ...F.P(-0.08, 1.12), { ...lab, align: 'right', color: s.c('--ink-2') });
      arc(s, F, 0.32, 0, 60, 'slate', '60°');
      const b = s.ease('basis', 1.4, 1.5);
      arc(s, F, 0.32, 90, 90 + 60 * b, 'slate', b > 0.9 ? '60°' : undefined);
      ray(s, F, 1, 90 + 60 * b, 'purple');
      s.alpha(smooth((b - 0.9) / 0.1), () => s.text('[−sin, cos]', ...F.P(-1.15, 0.74), { ...lab, align: 'left', color: s.c('purple') }));
      ray(s, F, 1, 60, 'teal', '[cos, sin]', { size: 3, push: 0.45 });
    });
    // The worked quarter turn returns for the check.
    s.alpha(check, () => quarter(s, pairPlane(s), 1, 1));
    s.alpha(1 - s.win('rule', 'check'), () =>
      table(s, [
        ['90°', '0', '1', check],
        ['60°', '0.5', '0.87', 1 - check],
      ]),
    );
    s.alpha(s.win('rule', 'check'), () => {
      const ro = { ...mono, size: s.tall ? 3.3 : 3.1 };
      const rx = s.tall ? L.px : L.px - 4 * u;
      rich(s, [['[a, b] = a·[1, 0] + b·[0, 1]', '--ink-2']], rx, L.ty + 2 * u, ro);
      s.alpha(s.ease('rule', 0.6, 2.5), () => rich(s, [['→ a·', '--ink-2'], ['[cos, sin]', 'teal'], [' + b·', '--ink-2'], ['[−sin, cos]', 'purple']], rx, L.ty + 8.5 * u, ro));
    });
    s.show('rule', s.ease('rule', 0.6, 5), L.rule);
    s.alpha(s.ease('check', 0.6, 0.6), () => {
      rich(s, [['2×0 − 1×1 = ', '--ink-2'], ['−1', 'teal']], L.px, L.ly, mono);
      rich(s, [['2×1 + 1×0 = ', '--ink-2'], ['2', 'teal']], L.px, L.ly + 6 * u, mono);
    });
  },
};

const tryIt: SceneDef = {
  marks: {
    rule: { tex: String.raw`[a,\ b] \;\to\; [\,a\cos{} - b\sin{},\ \ a\sin{} + b\cos{}\,]`, x: 0.5, y: 0.5, size: 4 },
  },
  draw(s) {
    const L = layout(s);
    const u = s.u;
    const F = pairPlane(s);
    const k0 = angOf(K);
    const sw = s.ease('p', 1.4, 3);
    ray(s, F, lenOf(K), k0, '--ink-3', 'k = [1, 1]', { width: 0.4, push: 0.6 });
    arc(s, F, 0.55, k0, k0 + 60 * sw, 'slate', sw > 0.9 ? '60°' : undefined);
    const tip = sw < 0.95 ? undefined : s.ease('done', 0.6) > 0.5 ? '[−0.37, 1.37]' : '?';
    ray(s, F, lenOf(K), k0 + 60 * sw, 'purple', tip, { push: 0.5 });
    s.show('rule', 1, L.rule);
    s.alpha(s.ease('p', 0.6, 5) * (1 - s.ease('done', 0.6)), () => table(s, [['60°', '0.5', '0.87', 1]]));
    s.alpha(s.ease('first', 0.6), () => rich(s, [['1×0.5 − 1×0.87 ≈ ', '--ink-2'], ['−0.37', 'purple']], L.px, L.ly, mono));
    s.alpha(s.ease('second', 0.6), () => rich(s, [['1×0.87 + 1×0.5 ≈ ', '--ink-2'], ['1.37', 'purple']], L.px, L.ly + 6 * u, mono));
    s.alpha(s.ease('done', 0.6, 0.4), () => rich(s, [['k → ', 'purple'], ['[−0.37, 1.37]', '--ink']], L.px, L.ty + 5.4 * u, { ...mono, size: 3.8 }));
  },
};

export const scenes: Record<string, SceneDef> = { turn, rule, try: tryIt };

import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp, smooth } from '../../../lecture/scene';
import { rich, type Ink } from '../draw';

const RAD = Math.PI / 180;
const Q = [2, 1];
const K = [1, 1];
const turned = (p: number[], a: number) => [p[0]! * Math.cos(a * RAD) - p[1]! * Math.sin(a * RAD), p[0]! * Math.sin(a * RAD) + p[1]! * Math.cos(a * RAD)];
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

const f2 = (v: number) => (Math.abs(v) < 0.005 ? '0' : v.toFixed(2).replace(/\.?0+$/, '').replace('-', '−'));

/** The unit arrow's angle: swept to 60° as it is introduced, then up to 90° and back while cos and sin are read off. */
function unitAngle(s: Scene): number {
  const cp = s.prog('cossin');
  return 60 * s.ease('unit', 1.4, 1.5) + 30 * smooth((cp - 0.04) / 0.1) - 30 * smooth((cp - 0.48) / 0.1);
}

const turn: SceneDef = {
  marks: {
    rule: { tex: String.raw`[a,\ b] \;\to\; [\,a\cos{} - b\sin{},\ \ a\sin{} + b\cos{}\,]`, x: 0.5, y: 0.5, size: 4 },
  },
  draw(s) {
    const u = s.u;
    const tall = s.tall;
    const six = s.ease('sixty', 0.7);
    const unit = s.win('unit', 'check');
    const cx = tall ? s.w / 2 : s.w * 0.27;
    const cy = tall ? s.h * 0.27 : s.h * 0.58;
    s.alpha(1 - unit, () => {
      const box: [number, number, number, number] = [-2, 2.7, -0.4, 2.7];
      const k = tall ? 14.5 * u : Math.min(15 * u, (0.5 * s.w) / 4.7);
      const F = plane(s, cx, cy, k, box);
      const q0 = angOf(Q);
      // q: a ghost where it started, and the arrow sweeping a quarter turn.
      s.alpha(1 - six, () => {
        const sw = s.ease('turn', 1.4, 0.6);
        s.alpha(s.ease('turn', 0.5), () => {
          ray(s, F, lenOf(Q), q0, '--ink-3', undefined, { width: 0.4 });
          arc(s, F, 0.8, q0, q0 + 90 * sw, 'slate', sw > 0.9 ? '90°' : undefined);
        });
        const a = q0 + 90 * sw;
        const tip = sw < 0.5 ? '[2, 1]' : sw > 0.95 ? '[−1, 2]' : undefined;
        s.alpha(s.ease('pair', 0.6), () => ray(s, F, lenOf(Q), a, 'teal', tip, { push: 0.5 }));
        s.alpha(s.ease('pair', 0.6, 0.6) * (1 - s.ease('turn', 0.4)), () => s.text('q', ...F.P(1.0, 0.75), { size: 4, font: 'mono', weight: 650, color: s.c('teal'), halo: true }));
      });
      // k: one, one, turned sixty degrees.
      s.alpha(six, () => {
        const sw = s.ease('sixty', 1.4, 0.8);
        const k0 = angOf(K);
        ray(s, F, lenOf(K), k0, '--ink-3', undefined, { width: 0.4 });
        arc(s, F, 0.55, k0, k0 + 60 * sw, 'slate', sw > 0.9 ? '60°' : undefined);
        ray(s, F, lenOf(K), k0 + 60 * sw, 'purple', sw < 0.5 ? '[1, 1]' : sw > 0.95 ? '[−0.37, 1.37]' : undefined, { push: 0.5 });
      });
    });

    // An arrow of length one: its tip is (cos, sin); then [1, 0] and [0, 1] turned together.
    s.alpha(unit, () => {
      const k1 = tall ? 26 * u : Math.min(26 * u, (0.5 * s.w) / 2.8);
      const F = plane(s, tall ? cx : s.w * 0.3, cy, k1, [-1.25, 1.35, -0.3, 1.3]);
      const [ox, oy] = F.P(0, 0);
      const c = s.ctx;
      c.save();
      c.setLineDash([0.8 * u, 0.8 * u]);
      c.beginPath();
      c.arc(ox, oy, k1, -Math.PI, 0);
      c.strokeStyle = s.tint('--ink-3', 0.35);
      c.lineWidth = 0.25 * u;
      c.stroke();
      c.restore();
      const a = unitAngle(s);
      const ca = Math.cos(a * RAD);
      const sa = Math.sin(a * RAD);
      const basis = s.ease('basis', 0.6);
      const lab = { size: 3, font: 'mono' as const, weight: 650, halo: true };
      s.alpha(1 - basis, () => {
        s.line(...F.P(ca, sa), ...F.P(ca, 0), s.tint('teal', 0.7), 0.3, [0.8, 0.8]);
        s.line(...F.P(ca, sa), ...F.P(0, sa), s.tint('gold', 0.7), 0.3, [0.8, 0.8]);
        s.text('cos', ...F.P(ca, -0.15), { ...lab, color: s.c('teal') });
        s.text('sin', ...F.P(-0.08, sa), { ...lab, align: 'right', color: s.c('gold') });
        arc(s, F, 0.32, 0, a, 'slate', a > 5 ? `${Math.round(a)}°` : undefined);
      });
      s.alpha(basis, () => {
        ray(s, F, 1, 0, '--ink-3', undefined, { width: 0.4 });
        ray(s, F, 1, 90, '--ink-3', undefined, { width: 0.4 });
        s.text('[1, 0]', ...F.P(1.12, -0.14), { ...lab, color: s.c('--ink-2') });
        s.text('[0, 1]', ...F.P(-0.08, 1.12), { ...lab, align: 'right', color: s.c('--ink-2') });
        const b = s.ease('basis', 1.4, 1.5);
        arc(s, F, 0.32, 90, 90 + 60 * b, 'slate', b > 0.9 ? '60°' : undefined);
        ray(s, F, 1, 90 + 60 * b, 'purple');
        s.alpha(smooth((b - 0.9) / 0.1), () => s.text('[−sin, cos]', ...F.P(-1.15, 0.74), { ...lab, align: 'left', color: s.c('purple') }));
      });
      ray(s, F, 1, a, 'teal', s.ease('basis', 0.6) > 0.5 ? '[cos, sin]' : undefined, { size: 3, push: 0.45 });
    });

    // The arithmetic: a table of cosines and sines, the rule built from the two turned arrows, and each case worked out.
    const px = tall ? s.w / 2 : s.w * 0.75;
    const ty = tall ? s.h * 0.58 : s.h * 0.27;
    const o = { size: 3.3, font: 'mono' as const, weight: 600 };
    const cp = s.prog('cossin');
    const up = s.ease('cossin', 0.6) * (1 - smooth((cp - 0.48) / 0.1));
    s.alpha(s.ease('cossin', 0.6) * (1 - s.win('rule', 'check')), () => {
      const cols = [-14, 2, 16].map((d) => px + d * u);
      const head: [string, Ink][] = [['angle', '--ink-3'], ['cos', '--ink-3'], ['sin', '--ink-3']];
      head.forEach(([t, kk], i) => s.text(t, cols[i]!, ty, { ...o, color: s.c(kk) }));
      const rows: [string, string, string, number][] = [
        ['90°', '0', '1', up + s.win('check', 'sixty')],
        ['60°', '0.5', '0.87', s.ease('cossin', 0.6) * smooth((cp - 0.48) / 0.1) * (1 - s.ease('rule', 0.6)) + s.ease('sixty', 0.6, 0.3)],
      ];
      rows.forEach(([a, c, sn, on], r) => {
        const y = ty + (r + 1) * 5.4 * u;
        [a, c, sn].forEach((t, i) => s.text(t, cols[i]!, y, { ...o, color: s.c(on > 0.5 ? '--ink' : '--ink-2') }));
      });
    });
    s.alpha(s.win('rule', 'check'), () => {
      const ro = { ...o, size: tall ? 3.3 : 3.1 };
      const rx = tall ? px : px - 4 * u;
      rich(s, [['[a, b] = a·[1, 0] + b·[0, 1]', '--ink-2']], rx, ty + 2 * u, ro);
      s.alpha(s.ease('rule', 0.6, 2.5), () => rich(s, [['→ a·', '--ink-2'], ['[cos, sin]', 'teal'], [' + b·', '--ink-2'], ['[−sin, cos]', 'purple']], rx, ty + 8.5 * u, ro));
    });
    s.show('rule', s.ease('rule', 0.6, 5), tall ? { x: 0.5, y: 0.78 } : { x: 0.5, y: 0.09 });
    const ly = tall ? s.h * 0.87 : s.h * 0.6;
    const gap = 6 * u;
    s.alpha(s.ease('check', 0.6) * (1 - six), () => {
      rich(s, [['2×0 − 1×1 = ', '--ink-2'], ['−1', 'teal']], px, ly, o);
      rich(s, [['2×1 + 1×0 = ', '--ink-2'], ['2', 'teal']], px, ly + gap, o);
    });
    s.alpha(s.ease('sixty', 0.6, 2.2), () => {
      rich(s, [['1×0.5 − 1×0.87 ≈ ', '--ink-2'], ['−0.37', 'purple']], px, ly, o);
      rich(s, [['1×0.87 + 1×0.5 ≈ ', '--ink-2'], ['1.37', 'purple']], px, ly + gap, o);
    });
  },
};

const POS = [0, 1, 2, 3, 4];

/** A dial: a circle with an arrow turned to angle `a` (degrees), centered on (x, y), radius `r` px. */
function dial(s: Scene, x: number, y: number, r: number, a: number, k: Ink, base: number, on = 0): void {
  s.circle(x, y, r, { stroke: s.tint('--ink-3', 0.4), lw: 0.25, fill: s.tint(k, 0.04 + 0.12 * on) });
  const ux = Math.cos(base * RAD);
  const uy = -Math.sin(base * RAD);
  s.line(x, y, x + ux * r * 0.85, y + uy * r * 0.85, s.tint('--ink-3', 0.5), 0.25, [0.8, 0.8]);
  s.arrow(x, y, x + Math.cos(a * RAD) * r * 0.85, y - Math.sin(a * RAD) * r * 0.85, s.c(k), 0.55, 2.2);
}

const position: SceneDef = {
  draw(s) {
    const u = s.u;
    const pitch = (s.tall ? 19 : 24) * u;
    const r = (s.tall ? 7 : 8) * u;
    const xs = POS.map((m) => s.w / 2 + (m - 2) * pitch);
    const q0 = angOf(Q);
    const y1 = s.h * (s.tall ? 0.26 : 0.27);
    const o = { size: 3, font: 'mono' as const, weight: 600 };
    s.alpha(s.ease('idea', 0.6), () => {
      const grow = s.ease('example', 1.6, 0.4);
      xs.forEach((x, m) => {
        const a = q0 + 30 * m * grow;
        dial(s, x, y1, r, a, 'teal', q0, m === 3 ? s.win('example', 'pairs') : 0);
        s.text(`pos ${m}`, x, y1 - r - 3.4 * u, { ...o, color: s.c('--ink-2') });
        s.alpha(s.ease('angle', 0.6, 0.8), () => s.text(m === 0 ? 'no turn' : `${m === 1 ? '' : m}θ`, x, y1 + r + 3.6 * u, { size: 3.4, font: 'serif', italic: m > 0, weight: 600, color: s.c('teal') }));
        s.alpha(grow, () => s.text(`${30 * m}°`, x, y1 + r + 8.2 * u, { ...o, color: s.c('--ink-3') }));
      });
      s.alpha(s.ease('angle', 0.6), () => rich(s, [['pair 0: ', '--ink-3'], ['θ = 30°', 'teal'], [' per position', '--ink-3']], s.w / 2, y1 - r - 10 * u, { size: 3.6, font: 'serif', weight: 600 }));
    });
    const y2 = s.h * (s.tall ? 0.6 : 0.62);
    s.alpha(s.ease('pairs', 0.6), () => {
      const grow = s.ease('pairs', 1.6, 0.6);
      xs.forEach((x, m) => {
        dial(s, x, y2, r, q0 + 3 * m * grow, 'purple', q0);
        s.alpha(grow, () => s.text(`${3 * m}°`, x, y2 + r + 3.6 * u, { ...o, color: s.c('--ink-3') }));
      });
      rich(s, [['pair 1: ', '--ink-3'], ['θ = 3°', 'purple'], [' per position', '--ink-3']], s.w / 2, y2 - r - 4.4 * u, { size: 3.6, font: 'serif', weight: 600 });
    });
    s.alpha(s.ease('only', 0.6), () => {
      const y = s.h * 0.9;
      const parts: [string, Ink][] = [['q, k: turned', 'teal'], ['nothing added', '--ink-2'], ['nothing learned', '--ink-2']];
      const sp = (s.tall ? 31 : 40) * u;
      parts.forEach(([t, k], i) => s.text(t, s.w / 2 + (i - 1) * sp, y, { size: 3.3, font: 'mono', weight: 650, color: s.c(k), halo: true }));
    });
  },
};

const relative: SceneDef = {
  draw(s) {
    const u = s.u;
    const tall = s.tall;
    const k = (tall ? 13 : 15) * u;
    const F = plane(s, tall ? s.w * 0.3 : s.w * 0.3, tall ? s.h * 0.24 : s.h * 0.3, k, [-1.6, 2.6, -0.4, 2.5]);
    const sw = s.ease('both', 1.8, 0.8);
    const a = 90 * sw;
    const tr = s.ease('try', 0.6);
    const fade = (1 - 0.6 * s.ease('apart', 0.6)) * (1 - tr);
    s.alpha(fade, () => {
      ray(s, F, lenOf(Q), angOf(Q), '--ink-3', undefined, { width: 0.35 });
      ray(s, F, lenOf(K), angOf(K), '--ink-3', undefined, { width: 0.35 });
      ray(s, F, lenOf(Q), angOf(Q) + a, 'teal', 'q', { size: 4 });
      ray(s, F, lenOf(K), angOf(K) + a, 'purple', 'k', { size: 4, push: 0.3 });
      s.alpha(s.ease('both', 0.5, 1.2), () => arc(s, F, 0.5, angOf(K), angOf(K) + a, 'slate', sw > 0.9 ? '90°' : undefined));
    });
    // The dot product, unchanged by the shared turn.
    const rx = tall ? s.w * 0.74 : s.w * 0.72;
    const ry = tall ? s.h * 0.17 : s.h * 0.22;
    s.alpha(fade, () => {
      const qt = turned(Q, a);
      const kt = turned(K, a);
      const dotv = qt[0]! * kt[0]! + qt[1]! * kt[1]!;
      rich(s, [['q', 'teal'], [' · ', '--ink-2'], ['k', 'purple'], [` = ${f2(dotv)}`, '--ink']], rx, ry, { size: 4.6, weight: 650 });
      s.alpha(s.ease('numbers', 0.6), () => {
        const o = { size: 3.1, weight: 600 };
        rich(s, [['[2, 1]', 'teal'], [' · ', '--ink-3'], ['[1, 1]', 'purple'], [' = 3', '--ink-2']], rx, ry + 8 * u, o);
        s.alpha(s.ease('numbers', 0.6, 1.6), () => rich(s, [['[−1, 2]', 'teal'], [' · ', '--ink-3'], ['[−1, 1]', 'purple'], [' = 3', '--ink-2']], rx, ry + 14 * u, o));
      });
    });

    // Positions on a line: the query and key move together and stay three apart.
    const n = 11;
    const pitch = (tall ? 8.4 : 10) * u;
    const ly = s.h * (tall ? 0.7 : 0.75);
    const lx = (i: number) => s.w / 2 + (i - (n - 1) / 2) * pitch;
    s.alpha(s.ease('apart', 0.6) * (1 - tr), () => {
      for (let i = 0; i < n; i++) {
        s.circle(lx(i), ly, 0.7 * u, { fill: s.tint('--ink-3', 0.5) });
        s.text(String(i), lx(i), ly + 4 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
      }
      const mv = s.ease('shift', 1.4, 0.4);
      const qp = lerp(5, 9, mv);
      const kp = lerp(2, 6, mv);
      const mark = (p: number, label: string, kk: Ink) => {
        s.circle(lx(p), ly, 2 * u, { fill: s.tint(kk, 0.35), stroke: s.c(kk), lw: 0.35 });
        s.text(label, lx(p), ly - 5.4 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c(kk), halo: true });
      };
      mark(kp, `k at ${Math.round(kp)}`, 'purple');
      mark(qp, `q at ${Math.round(qp)}`, 'teal');
      const by = ly + 9.5 * u;
      s.line(lx(kp), by, lx(qp), by, s.c('slate'), 0.35);
      s.line(lx(kp), by - 1.2 * u, lx(kp), by + 1.2 * u, s.c('slate'), 0.35);
      s.line(lx(qp), by - 1.2 * u, lx(qp), by + 1.2 * u, s.c('slate'), 0.35);
      s.text(mv > 0.95 ? '3 apart: the same score' : '3 apart', (lx(kp) + lx(qp)) / 2, by + 4 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c(mv > 0.95 ? 'green' : 'slate'), halo: true });
    });
    s.alpha(s.ease('distance', 0.6) * (1 - tr), () => {
      s.text('only the distance and the order count', s.w / 2, s.h * 0.94, { size: tall ? 2.9 : 3.2, color: s.c('--ink'), halo: true });
    });

    // A worked score: the query at position 1 turns 90°, the key at position 0 stays.
    s.alpha(tr, () => {
      const qs = s.ease('tq', 1.4, 0.6);
      ray(s, F, lenOf(Q), angOf(Q), '--ink-3', undefined, { width: 0.35 });
      s.alpha(s.ease('tq', 0.5), () => arc(s, F, 0.8, angOf(Q), angOf(Q) + 90 * qs, 'slate', qs > 0.9 ? '90°' : undefined));
      ray(s, F, lenOf(Q), angOf(Q) + 90 * qs, 'teal', 'q', { size: 4 });
      ray(s, F, lenOf(K), angOf(K), 'purple', 'k', { size: 4, push: 0.3 });
      const o = { size: 3.1, weight: 600 };
      rich(s, [['θ = 90°', 'slate']], rx, ry, { size: 4, weight: 650 });
      rich(s, [['q at 1: ', 'teal'], ['turns 90°', '--ink-2']], rx, ry + 8 * u, o);
      rich(s, [['k at 0: ', 'purple'], ['no turn', '--ink-2']], rx, ry + 14 * u, o);
    });
    const o2 = { size: tall ? 3.1 : 3.4, weight: 600 };
    s.alpha(s.ease('tq', 0.6, 2), () => rich(s, [['2×0 − 1×1 = ', '--ink-2'], ['−1', 'teal'], ['    2×1 + 1×0 = ', '--ink-2'], ['2', 'teal']], s.w / 2, s.h * 0.62, o2));
    s.alpha(s.ease('tq', 0.6, 5.5), () => rich(s, [['q → ', 'teal'], ['[−1, 2]', '--ink'], ['    k = ', 'purple'], ['[1, 1]', '--ink']], s.w / 2, s.h * 0.7, o2));
    s.alpha(s.ease('tdot', 0.6), () => rich(s, [['[−1, 2] · [1, 1] = −1 + 2 = ', '--ink-2'], ['1', 'green']], s.w / 2, s.h * 0.8, { ...o2, size: o2.size + 0.3 }));
    s.alpha(s.ease('tdot', 0.6, 3), () => rich(s, [['unturned: [2, 1] · [1, 1] = 3', '--ink-3']], s.w / 2, s.h * 0.88, o2));
  },
};

export const scenes: Record<string, SceneDef> = { turn, position, relative };

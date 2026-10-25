import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { bars, cells, columns, downArrows, rowLabel } from '../../draw';

const f2 = (v: number) => v.toFixed(2);
const neg = (t: string) => t.replace(/-/g, '−');

/** Probability bars with option numbers under them and a gold `y` tag under the right one. */
function probBars(s: Scene, p: number[], yAt: number, o: { hi?: number[]; base?: number; tag?: number } = {}) {
  const xs = columns(s, p.length, s.tall ? 24 : 26);
  const base = o.base ?? s.h * 0.6;
  rowLabel(s, 'p', xs[0]! - 13 * s.u, base - 6 * s.u, 'teal');
  bars(s, xs, base, p, 'teal', { max: 1, height: (base - s.h * 0.1) / s.u - 6, w: 11, fmt: (v) => String(v), hi: o.hi });
  xs.forEach((x, i) => s.text(String(i), x, base + 4.5 * s.u, { size: 3.6, font: 'mono', color: s.c('--ink-3') }));
  const tx = lerp(xs[Math.floor(yAt)]!, xs[Math.ceil(yAt)]!, yAt - Math.floor(yAt));
  s.alpha(o.tag ?? 1, () => s.text('y', tx, base + 10.5 * s.u, { size: 4, font: 'mono', weight: 700, color: s.c('gold') }));
  return { xs, base };
}

const P = [0.7, 0.2, 0.1];

const loss: SceneDef = {
  draw(s) {
    const mv = s.ease('wrong', 1.2);
    const yAt = lerp(0, 2, mv);
    const hi = [s.ease('y', 0.6) * (1 - mv), 0, mv];
    probBars(s, P, yAt, { hi, tag: s.ease('y', 0.6) });
    const y = s.h * 0.88;
    const o = { size: 4.4, font: 'mono', weight: 650, color: s.c('red') } as const;
    s.alpha(s.ease('L', 0.6, 0.8) * (1 - mv), () => s.text(neg('L = -ln 0.7 ≈ 0.36'), s.w / 2, y, o));
    s.alpha(s.ease('wrong', 0.6, 1.2), () => s.text(neg('L = -ln 0.1 ≈ 2.30'), s.w / 2, y, o));
  },
};

/** The plot frame for L = -ln p. */
function frame(s: Scene) {
  const x0 = s.w * (s.tall ? 0.16 : 0.2);
  const x1 = s.w * (s.tall ? 0.9 : 0.86);
  const y0 = s.h * 0.84;
  const y1 = s.h * 0.1;
  const X = (p: number) => lerp(x0, x1, p);
  const Y = (L: number) => lerp(y0, y1, L / 5);
  return { x0, x1, y0, y1, X, Y };
}
const CURVE = Array.from({ length: 160 }, (_, i) => Math.exp(-5) + (1 - Math.exp(-5)) * (i / 159) ** 2);

const curve: SceneDef = {
  draw(s) {
    const F = frame(s);
    const ax = s.c('--axis');
    s.line(F.x0, F.y0, F.x1 + 2 * s.u, F.y0, ax, 0.35);
    s.line(F.x0, F.y0, F.x0, F.y1 - 2 * s.u, ax, 0.35);
    const t = { size: 3.2, font: 'mono', color: s.c('--ink-3') } as const;
    for (const p of [0, 0.5, 1]) s.text(String(p), F.X(p), F.y0 + 4 * s.u, t);
    for (const L of [0, 1, 2, 3, 4, 5]) s.text(String(L), F.x0 - 3 * s.u, F.Y(L), { ...t, align: 'right' });
    s.text('p', F.x1 + 5 * s.u, F.y0, { size: 3.8, font: 'mono', weight: 650, color: s.c('teal') });
    s.text('L', F.x0, F.y1 - 5 * s.u, { size: 3.8, font: 'mono', weight: 650, color: s.c('red') });
    const g = s.ease('curve', 1.6);
    const n = Math.max(2, Math.round(CURVE.length * g));
    const pts = CURVE.slice(CURVE.length - n).reverse();
    const c = s.ctx;
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(F.X(p), F.Y(-Math.log(p))) : c.moveTo(F.X(p), F.Y(-Math.log(p)))));
    c.strokeStyle = s.c('red');
    c.lineWidth = 0.6 * s.u;
    c.stroke();
    const dot = (p: number, a: number, label: string, k: 'red' | 'green', dx: number, dy: number, align: 'left' | 'right' = 'left') =>
      s.alpha(a, () => {
        s.circle(F.X(p), F.Y(-Math.log(p)), 1.3 * s.u, { fill: s.c(k) });
        s.text(label, F.X(p) + dx * s.u, F.Y(-Math.log(p)) + dy * s.u, { size: 3.4, font: 'mono', weight: 600, align, color: s.c(k), halo: true });
      });
    dot(0.7, s.ease('curve', 0.6, 1.4), '0.7 → 0.36', 'red', 2.5, -5);
    dot(0.1, s.ease('curve', 0.6, 1.8), '0.1 → 2.30', 'red', 3, -3.4);
    dot(1, s.ease('one', 0.6), 'p = 1 → 0', 'green', 2, 8.5, 'right');
    s.alpha(s.ease('one', 0.6, 2), () => s.text('never below 0', F.X(0.62), F.Y(1.6), { size: 3.4, color: s.c('--ink-2') }));
    s.alpha(s.ease('zero', 0.6), () => {
      s.arrow(F.X(0.05), F.Y(3.6), F.X(0.05), F.y1 - 1 * s.u, s.c('red'), 0.5, 2.4);
      s.text('→ ∞ as p → 0', F.X(0.1), F.Y(4.4), { size: 3.4, font: 'mono', align: 'left', color: s.c('red'), halo: true });
    });
  },
};

const SS = [2, 1, -1];
const SE = SS.map((v) => Math.exp(v));
const ST = SE.reduce((a, b) => a + b, 0);
const TEN = Array.from({ length: 10 }, () => 0.1);

const scores: SceneDef = {
  marks: {
    f: { tex: String.raw`\symL = -\ln \symp_{\symy} = \ln T - \syms_{\symy}`, x: 0.5, y: 0.62, size: 5 },
  },
  draw(s) {
    const xs = columns(s, 3, s.tall ? 24 : 26);
    const lx = xs[0]! - 13 * s.u;
    const init = s.ease('init', 0.8);
    s.alpha(1 - init, () => {
      rowLabel(s, 's', lx, s.h * 0.15, 'purple');
      cells(s, xs, s.h * 0.15, SS.map(String), 'purple', { on: [s.ease('rule', 0.6), 0, 0] });
      s.text('y', xs[0]!, s.h * 0.15 - 7.5 * s.u, { size: 3.4, font: 'mono', weight: 700, color: s.c('gold') });
      downArrows(s, xs, s.h * 0.15 + 5.5 * s.u, s.h * 0.32 - 5.5 * s.u);
      rowLabel(s, 'e', lx, s.h * 0.32, 'gold');
      cells(s, xs, s.h * 0.32, SE.map(f2), 'gold');
      s.text(`T = ${SE.map(f2).join(' + ')} = ${f2(ST)}`, s.w / 2, s.h * 0.44, { size: 3.4, font: 'mono', color: s.c('--ink-2'), halo: true });
      s.alpha(s.ease('rule', 0.6, 2.4), () => s.text(`ln ${f2(ST)} − 2 = ${f2(Math.log(ST))} − 2 = ${f2(Math.log(ST) - 2)}`, s.w / 2, s.h * 0.78, { size: 3.8, font: 'mono', weight: 600, color: s.c('red') }));
    });
    s.show('f', s.ease('rule', 0.6) * (1 - init));
    s.alpha(init, () => {
      const tx = columns(s, 10, s.tall ? 8.5 : 9);
      bars(s, tx, s.h * 0.5, TEN, 'teal', { max: 1, height: 30, w: 6.5 });
      s.text('10 equal scores: p = 0.1 each', s.w / 2, s.h * 0.58, { size: 3.4, font: 'mono', color: s.c('teal') });
      s.text('L = −ln 0.1 = ln 10 ≈ 2.30', s.w / 2, s.h * 0.74, { size: 4.2, font: 'mono', weight: 650, color: s.c('red') });
    });
  },
};

export const scenes: Record<string, SceneDef> = { loss, curve, scores };

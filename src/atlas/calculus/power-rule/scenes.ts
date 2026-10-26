import { type Scene, type SceneDef, clamp01, lerp } from '../../../lecture/scene';
import { cells, columns, rowLabel } from '../../draw';
import { after } from '../draw';

const serif = (s: Scene, t: string, x: number, y: number, size: number, k: Parameters<Scene['c']>[0] = '--ink', italic = false, align: CanvasTextAlign = 'center') =>
  s.text(t, x, y, { size, italic, align, color: s.c(k) });

/**
 * One power-rule row, `xⁿ → n xⁿ⁻¹`, drawn on the canvas so the exponent can travel: `move`
 * carries it from the left power down to the right coefficient, then the new power fades in.
 */
function powerRow(s: Scene, y: number, n: string, n1: string, appear: number, move: number) {
  const cx = s.w / 2;
  const M = 6.4;
  const xL = cx - 17 * s.u;
  const coefX = cx + 9 * s.u;
  const xR = coefX + (n.length > 1 ? 4.8 : 3.6) * s.u;
  const sup = (x: number) => [x + 1.9 * s.u, y - 2.9 * s.u] as const;
  s.alpha(appear, () => {
    serif(s, 'x', xL, y, M, 'orange', true);
    const [ex, ey] = sup(xL);
    serif(s, n, ex, ey, 3.8, 'gold', n === 'n', 'left');
    s.arrow(cx - 10 * s.u, y + 0.4 * s.u, cx + 3 * s.u, y + 0.4 * s.u, s.c('--ink-3'), 0.4, 2);
  });
  if (move <= 0) return;
  // The power's flight: a bezier from the left superscript to the right coefficient.
  const [sx, sy] = sup(xL);
  const t = clamp01(move);
  const mx = (sx + coefX) / 2;
  const my = y - 14 * s.u;
  const px = (1 - t) ** 2 * sx + 2 * (1 - t) * t * mx + t * t * coefX;
  const py = (1 - t) ** 2 * sy + 2 * (1 - t) * t * my + t * t * y;
  serif(s, n, px, py, lerp(3.8, M, t), 'gold', n === 'n');
  s.alpha(clamp01((move - 0.6) / 0.4), () => {
    serif(s, 'x', xR, y, M, 'orange', true);
    if (n1) serif(s, n1, sup(xR)[0], sup(xR)[1], 3.8, 'gold', n1.startsWith('n'), 'left');
  });
}

// Slopes of x² measured in the derivative concept, at these points.
const XS = [-1.5, 0, 1, 1.5];
const sgn = (v: number) => (v < 0 ? `−${-v}` : String(v));

/** x, the measured slope of x², and 2x, in three rows: the pattern before the rule. */
function slopeTable(s: Scene) {
  const xs = columns(s, 4, s.tall ? 17 : 19);
  const ys = [0.38, 0.55, 0.72].map((f) => s.h * f);
  const lx = xs[0]! - 9.5 * s.u;
  const shown = (i: number) => after(s, 'measured', 0.42 + 0.14 * i);
  const two = after(s, 'twox', 0.12);
  rowLabel(s, 'x', lx, ys[0]!, 'orange');
  cells(s, xs, ys[0]!, XS.map(sgn), 'orange');
  s.alpha(shown(0), () => rowLabel(s, 'slope', lx, ys[1]!, 'teal'));
  xs.forEach((x, i) => s.alpha(shown(i), () => cells(s, [x], ys[1]!, [sgn(2 * XS[i]!)], 'teal', { on: [two * 0.6] })));
  s.alpha(two, () => {
    rowLabel(s, '2x', lx, ys[2]!, 'gold');
    cells(s, xs, ys[2]!, XS.map((v) => sgn(2 * v)), 'gold', { on: XS.map(() => 0.6) });
  });
}

const power: SceneDef = {
  draw(s) {
    s.alpha(s.ease('measured', 0.6) * (1 - s.ease('cube', 0.5)), () => slopeTable(s));
    powerRow(s, s.h * 0.2, '2', '', s.ease('sq', 0.6), after(s, 'sq', 0.08, 1.4));
    powerRow(s, s.h * 0.42, '3', '2', s.ease('cube', 0.5, 0.5), after(s, 'cube', 0.3, 1.2));
    s.alpha(s.ease('rule', 0.6), () => {
      s.rrect(s.w / 2 - 27 * s.u, s.h * 0.64 - 8 * s.u, 54 * s.u, 15 * s.u, 2, { fill: s.tint('gold', 0.08), stroke: s.tint('gold', 0.55), lw: 0.35 });
    });
    powerRow(s, s.h * 0.645, 'n', 'n−1', s.ease('rule', 0.6), s.ease('rule', 1.2, 0.5));
    s.alpha(s.ease('check', 0.6), () => {
      const o = { size: 3.9, font: 'mono', weight: 600, color: s.c('--ink-2') } as const;
      s.text('measured slope of x³ at 2:  12.0', s.w / 2, s.h * 0.82, o);
      s.text('rule: 3 · 2² = 12', s.w / 2, s.h * 0.9, { ...o, color: s.c('green') });
    });
  },
};

const COLS = [0.2, 0.5, 0.8];
const TERMS = [String.raw`5\symx^{3}`, String.raw`2\symx`, '7'];
const DERIVS = [String.raw`15\symx^{2}`, '2', '0'];
const NOTES = ['5 · 3x²', 'slope 2', 'flat'];
const BEATS = ['factor', 'sum', 'zero'];

/** Each term with an arrow down to its derivative, the whole result, then that result at x = 2. */
const sums: SceneDef = {
  marks: {
    ...Object.fromEntries(TERMS.map((t, i) => [`t${i}`, { tex: t, x: COLS[i]!, y: 0.2, size: 6 }])),
    ...Object.fromEntries(DERIVS.map((t, i) => [`d${i}`, { tex: t, x: COLS[i]!, y: 0.5, size: 6 }])),
    whole: { tex: String.raw`\symf'(\symx) = 15\symx^{2} + 2`, x: 0.5, y: 0.78, size: 6 },
    ask: { tex: String.raw`\symf'(2) = \,?`, x: 0.5, y: 0.5, size: 6 },
    put: { tex: String.raw`\symf'(2) = 15 \cdot 2^{2} + 2`, x: 0.5, y: 0.5, size: 5.6 },
    val: { tex: String.raw`= 15 \cdot 4 + 2 = 60 + 2 = 62`, x: 0.5, y: 0.7, size: 5.6 },
  },
  draw(s) {
    // The terms give way to the value at 2, and the result rises to the top to be used.
    const gone = s.ease('ask', 0.7);
    const rows = s.ease('factor', 0.6) * (1 - gone);
    TERMS.forEach((_, i) => s.show(`t${i}`, rows));
    const op = (t: string, x: number, y: number, a: number) => s.alpha(a, () => s.text(t, x, y, { size: 5.4, color: s.c('--ink-3') }));
    [0, 1].forEach((i) => op('+', ((COLS[i]! + COLS[i + 1]!) / 2) * s.w, s.h * 0.2, rows));
    const on = BEATS.map((b) => s.ease(b, 0.6, 0.3) * (1 - gone));
    on.forEach((d, i) => {
      const x = COLS[i]! * s.w;
      s.alpha(d, () => {
        s.arrow(x, s.h * 0.28, x, s.h * 0.42, s.c('--ink-3'), 0.4, 2);
        s.text(NOTES[i]!, x + 2.5 * s.u, s.h * 0.35, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-3'), halo: true });
      });
      s.show(`d${i}`, d * (i === 2 ? 0.55 : 1));
    });
    [0, 1].forEach((i) => op('+', ((COLS[i]! + COLS[i + 1]!) / 2) * s.w, s.h * 0.5, Math.min(on[i]!, on[i + 1]!)));
    const w = s.ease('whole', 0.6, 0.6);
    const y = lerp(0.78, 0.22, gone);
    s.alpha(w, () => s.rrect(s.w / 2 - 30 * s.u, s.h * y - 7 * s.u, 60 * s.u, 14 * s.u, 2, { fill: s.tint('purple', 0.08), stroke: s.tint('purple', 0.55), lw: 0.35 }));
    s.show('whole', w, { y });
    s.show('ask', s.ease('ask', 0.6, 0.6) * (1 - after(s, 'put', 0.1)));
    s.show('put', after(s, 'put', 0.15));
    s.show('val', after(s, 'put', 0.45));
  },
};

export const scenes: Record<string, SceneDef> = { power, sums };

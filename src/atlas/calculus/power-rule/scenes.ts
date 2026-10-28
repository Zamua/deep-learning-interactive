import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { after, Frame } from '../draw';

type Ink = Color | `--${string}`;

// ---- the pattern: slide the tangent, plot each slope below, and the dots land on 2x, then 3x²

const sq = (x: number) => x * x;
const cu = (x: number) => x * x * x;
const X0 = -2.3;
const X1 = 2.3;
/** Where the slopes are marked: every quarter from -2 to 2. */
const XS = Array.from({ length: 17 }, (_, i) => -2 + i * 0.25);
const fmt = (v: number, d = 1) => (v < -0.05 ? `−${(-v).toFixed(d)}` : Math.abs(v).toFixed(d));

/** The curve above, its slopes below, sharing one x axis; each plot has a label row above it. */
function frames(s: Scene) {
  const W = Math.min(s.w - 16 * s.u, s.h * 1.15);
  const l = (s.w - W) / 2;
  const top = (y: [number, number]) => new Frame(s, [l, s.h * 0.1, W, s.h * 0.36], [X0, X1, ...y]);
  const bot = (y: [number, number]) => new Frame(s, [l, s.h * 0.58, W, s.h * 0.36], [X0, X1, ...y]);
  return { sqF: top([-0.6, 5.2]), cuF: top([-12.5, 12.5]), dSqF: bot([-5, 5]), dCuF: bot([-1.5, 16]) };
}

/** The label rows: above the curve, and above the slopes. */
const rowY = (s: Scene, lower: boolean) => s.h * (lower ? 0.535 : 0.055);

/** The tangent at x = p with slope m, about 2L stage units long whatever its tilt. */
function tangentAt(s: Scene, F: Frame, p: number, y: number, m: number, k: Ink, L = 13) {
  const dx = (L * s.u) / Math.hypot(F.kx, m * F.ky);
  F.tangent(p, y, m, k, p - dx, p + dx, 0.6);
}

function label(s: Scene, F: Frame, lower: boolean, text: string, k: Ink, a: number, right = false) {
  const [x0, x1] = F.dom;
  s.alpha(a, () => s.text(text, right ? F.X(x1) : F.X(x0), rowY(s, lower), { size: 3.6, font: 'mono', weight: 650, align: right ? 'right' : 'left', color: s.c(k), halo: true }));
}

/** One plot: the curve, its sliding tangent, the slope dots so far, and the slope curve drawn in. */
function sweep(s: Scene, F: Frame, D: Frame, o: { f: (x: number) => number; d: (x: number) => number; name: string; dName: string; p: number; reach: number; drawn: number; a: number; dA: number }) {
  s.alpha(o.a, () => {
    F.axes();
    F.fn(o.f, 'purple', 0.8);
    label(s, F, false, o.name, 'purple', 1);
    const m = o.d(o.p);
    tangentAt(s, F, o.p, o.f(o.p), m, 'teal');
    F.dot(o.p, o.f(o.p), 'purple', 1.3);
    label(s, F, false, `slope ${fmt(m)}`, 'teal', 1, true);
  });
  s.alpha(o.dA, () => {
    D.axes();
    // The slope curve draws in left to right once the dots are all down.
    D.fn(o.d, 'gold', 0.7, X0, lerp(X0, X1, o.drawn));
    XS.forEach((x) => {
      if (x <= o.reach + 1e-9) D.dot(x, o.d(x), 'teal', 1.05);
    });
    label(s, D, true, o.drawn > 0.5 ? o.dName : 'slope', o.drawn > 0.5 ? 'gold' : 'teal', 1);
    // A dashed guide from the point on the curve down to its slope, at the same x.
    if (o.reach > -2.01 && o.reach < 2) {
      const m = o.d(o.p);
      s.line(F.X(o.p), F.Y(o.f(o.p)), D.X(o.p), D.Y(m), s.tint('teal', 0.55), 0.3, [1, 1]);
      D.dot(o.p, m, 'teal', 1.4);
    }
  });
}

const pattern: SceneDef = {
  draw(s) {
    const { sqF, cuF, dSqF, dCuF } = frames(s);
    // x², first at x = 1, then swept from -2 to 2.
    const q = s.since('slide') >= 0 ? s.prog('slide') : 0;
    const back = smooth(q / 0.14);
    const run1 = clamp01((q - 0.16) / 0.72);
    const p1 = q < 0.16 ? lerp(1, -2, back) : -2 + 4 * run1;
    const reach1 = q < 0.16 ? -9 : p1;
    const c = s.ease('cube', 0.8);
    sweep(s, sqF, dSqF, {
      f: sq, d: (x) => 2 * x, name: 'f(x) = x²', dName: 'slope = 2x',
      p: p1, reach: reach1, drawn: s.ease('line', 1.6, 0.4), a: 1 - c, dA: s.ease('slide', 0.6) * (1 - c),
    });
    // x³: swept the same way, then held at x = 2 for the check.
    const r = s.since('cube') >= 0 ? s.prog('cube') : 0;
    const run2 = clamp01((r - 0.12) / 0.6);
    const p2 = r < 0.12 ? lerp(2, -2, smooth(r / 0.1)) : -2 + 4 * run2;
    sweep(s, cuF, dCuF, {
      f: cu, d: (x) => 3 * x * x, name: 'g(x) = x³', dName: 'slope = 3x²',
      p: p2, reach: r < 0.12 ? -9 : p2, drawn: after(s, 'cube', 0.74, 1.2), a: c, dA: c,
    });
    // One measurement, then the question of every other point.
    s.alpha(s.win('one', 'slide'), () => {
      const o = { size: 3.4, font: 'mono', weight: 600, color: s.c('teal'), halo: true } as const;
      s.text('slope at x = 1:', s.w / 2, s.h * 0.66, { ...o, color: s.c('--ink-2') });
      s.text('(f(1 + h) − f(1)) / h ≈ 2.0', s.w / 2, s.h * 0.74, { ...o, size: 3.8 });
    });
    s.alpha(s.win('every', 'slide') * s.ease('every', 0.6, 1.4), () => {
      [-2, -1, 0, 2].forEach((x) => {
        sqF.dot(x, sq(x), '--ink-3', 1);
        s.text('?', sqF.X(x), sqF.Y(sq(x)) - 4 * s.u, { size: 4, font: 'mono', weight: 700, color: s.c('--ink-2'), halo: true });
      });
    });
    // The check at x = 2: the measured slope of x³ against 3 · 2².
    s.alpha(s.ease('check', 0.6, 0.6), () => {
      dCuF.dot(2, 12, 'gold', 1.8);
      label(s, dCuF, true, 'at 2: 3 · 2² = 12', 'gold', 1, true);
    });
  },
};

// ---- the rule: the power comes down in front and drops by one

const serif = (s: Scene, t: string, x: number, y: number, size: number, k: Ink = '--ink', italic = false, align: CanvasTextAlign = 'center') =>
  s.text(t, x, y, { size, italic, align, color: s.c(k) });

/**
 * One power-rule row, `xⁿ → n xⁿ⁻¹`, drawn on the canvas so the power can travel: `move`
 * carries it from the left power down to the right coefficient, then the new power fades in.
 */
function powerRow(s: Scene, y: number, n: string, n1: string, appear: number, arrow: number, move: number) {
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
  });
  s.alpha(arrow, () => s.arrow(cx - 10 * s.u, y + 0.4 * s.u, cx + 3 * s.u, y + 0.4 * s.u, s.c('--ink-3'), 0.4, 2));
  if (move <= 0) return;
  // The power's flight: a curve from the left power to the right coefficient.
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

const rule: SceneDef = {
  draw(s) {
    const y0 = s.h * 0.2;
    const sqMove = after(s, 'sq', 0.08, 1.4);
    powerRow(s, y0, '2', '', 1, s.ease('sq', 0.6), sqMove);
    // x² as x times x, with its power named, before the power moves.
    const named = s.ease('power', 0.6, 0.8) * (1 - s.ease('sq', 0.5));
    s.alpha(named, () => {
      serif(s, '= x · x', s.w / 2 - 11 * s.u, y0, 5.4, '--ink-2', true, 'left');
      const px = s.w / 2 - 17 * s.u + 2.6 * s.u;
      s.arrow(px - 9 * s.u, y0 - 11 * s.u, px - 1 * s.u, y0 - 5 * s.u, s.c('gold'), 0.35, 1.8);
      s.text('the power', px - 10 * s.u, y0 - 12.5 * s.u, { size: 3.2, font: 'mono', weight: 650, align: 'right', color: s.c('gold'), halo: true });
    });
    powerRow(s, s.h * 0.42, '3', '2', s.ease('cube', 0.5, 0.3), s.ease('cube', 0.5, 0.3), after(s, 'cube', 0.3, 1.2));
    s.alpha(s.ease('rule', 0.6), () => {
      s.rrect(s.w / 2 - 27 * s.u, s.h * 0.64 - 8 * s.u, 54 * s.u, 15 * s.u, 2, { fill: s.tint('gold', 0.08), stroke: s.tint('gold', 0.55), lw: 0.35 });
    });
    powerRow(s, s.h * 0.645, 'n', 'n−1', s.ease('rule', 0.6), s.ease('rule', 0.6), s.ease('rule', 1.2, 0.5));
    const cy = s.h * 0.88;
    const cap = (t: string, a: number, k: Ink = '--ink-2') => s.alpha(a, () => s.text(t, s.w / 2, cy, { size: 3.6, font: 'mono', weight: 600, color: s.c(k), halo: true }));
    cap("the power: how many x's are multiplied", s.win('power', 'sq'), 'gold');
    cap('→ reads “becomes”', s.ease('sq', 0.6) * (1 - after(s, 'sq', 0.42)));
    cap('the 2 comes down, the power drops by 1', after(s, 'sq', 0.45) * (1 - s.ease('cube', 0.6)));
    cap('the 3 comes down, the power drops to 2', s.win('cube', 'rule'));
    cap('the power rule', s.ease('rule', 0.6, 1), 'gold');
  },
};

// ---- constants and sums, then the slope at one point

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
    val: { tex: String.raw`= 60 + 2`, x: 0.5, y: 0.66, size: 5.6 },
    res: { tex: String.raw`= 62`, x: 0.5, y: 0.82, size: 5.6 },
  },
  draw(s) {
    // The terms give way to the value at 2, and the result rises to the top to be used.
    const gone = s.ease('ask', 0.7);
    const rows = s.ease('factor', 0.6) * (1 - gone);
    TERMS.forEach((_, i) => s.show(`t${i}`, rows));
    const op = (t: string, x: number, y: number, a: number) => s.alpha(a, () => s.text(t, x, y, { size: 5.4, color: s.c('--ink-3') }));
    [0, 1].forEach((i) => op('+', ((COLS[i]! + COLS[i + 1]!) / 2) * s.w, s.h * 0.2, rows));
    const on = BEATS.map((b, i) => (i === 1 ? after(s, b, 0.55) : s.ease(b, 0.6, 0.3)) * (1 - gone));
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
    s.show('ask', s.ease('ask', 0.6, 0.6) * (1 - after(s, 'put', 0.05)));
    s.show('put', after(s, 'put', 0.1));
    s.show('val', after(s, 'put', 0.55));
    s.show('res', after(s, 'add', 0.45));
  },
};

export const scenes: Record<string, SceneDef> = { pattern, rule, sums };

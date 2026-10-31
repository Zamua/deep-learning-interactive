import { clamp01, type Ink, lerp, type Scene, type SceneDef, smooth } from '../../../lecture/scene';
import { after } from '../../draw';
import { Frame, type Rect } from '../draw';
import { besideX, fill, ring, result, ROW, termRow } from './art';

const LEVELS = [0.5, 1.5, 3, 4.5, 6, 8];
/** The bowl's height along the slice v = 1, and along the slice u = 1. */
const alongU = (u: number) => u * u + 2;
const alongV = (v: number) => 1 + 2 * v * v;

/** The map of the bowl top left, the formula and legend top right, and the slice panel below or beside. */
function layout(s: Scene) {
  const map: Rect = s.tall ? [s.w * 0.03, s.h * 0.03, s.w * 0.47, s.h * 0.42] : [s.w * 0.03, s.h * 0.08, s.w * 0.47, s.h * 0.84];
  const panel: Rect = s.tall ? [s.w * 0.08, s.h * 0.53, s.w * 0.86, s.h * 0.43] : [s.w * 0.56, s.h * 0.42, s.w * 0.4, s.h * 0.5];
  const M = new Frame(s, map, [-2.3, 2.3, -1.6, 2.3], true);
  const P = new Frame(s, panel, [-2.3, 2.3, 0, 8.5]);
  const formula = { x: 0.76, y: s.tall ? 0.09 : 0.12 };
  /** Where legend row i starts, under the formula. */
  const leg = (i: number) => ({ x: s.w * (s.tall ? 0.53 : 0.56), y: s.h * 0.22 + 6.5 * i * s.u });
  return { M, P, formula, leg };
}

function legend(s: Scene, L: ReturnType<typeof layout>, row: number, text: string, k: Ink, a: number, size = 3.7) {
  const p = L.leg(row);
  s.alpha(a, () => s.text(text, p.x, p.y, { size, font: 'mono', weight: 600, align: 'left', color: s.c(k), halo: true }));
}

/** Who wrote the symbol, and when, under the legend. */
function cite(s: Scene, L: ReturnType<typeof layout>, text: string, a: number) {
  const p = L.leg(2.6);
  s.alpha(a, () => s.text(text, p.x, p.y, { size: 3.2, italic: true, align: 'left', color: s.c('--ink-2'), halo: true }));
}

/** The u and v axes, and each ring fading in from the middle out as `grow` goes 0 -> 1; `hi` is lit by `hiA`. */
function map(s: Scene, M: Frame, grow: number, hiA: number) {
  M.axes(0.8);
  LEVELS.forEach((c, i) => {
    const a = clamp01(grow * LEVELS.length - i);
    const lit = c === 3 ? hiA : 0;
    s.alpha(a, () => ring(s, M, c, s.tint('purple', 0.35 + 0.65 * lit), 0.3 + 0.35 * lit));
  });
  const o = { size: 3.4, font: 'mono', color: s.c('--ink-3'), halo: true } as const;
  s.text('u', M.X(2.15), M.Y(0) + 3 * s.u, o);
  s.text('v', M.X(0) - 3 * s.u, M.Y(2.15), o);
}

/** A walker along a slice: sweeps across, then settles back at 1, through beat `id`. */
function walk(s: Scene, id: string, lo: number, hi: number): number {
  const p = s.prog(id);
  if (p < 0.15) return lerp(1, lo, smooth(p / 0.15));
  if (p < 0.75) return lerp(lo, hi, smooth((p - 0.15) / 0.6));
  return lerp(hi, 1, smooth((p - 0.75) / 0.25));
}

/** The panel's ground line and its axis label. */
function panelBase(s: Scene, P: Frame, label: string, k: Ink, a: number) {
  s.alpha(a, () => {
    P.seg(-2.3, 0, 2.3, 0, '--axis', 0.3);
    s.text(label, P.X(2.3), P.Y(0) - 3 * s.u, { size: 3.4, font: 'mono', weight: 600, align: 'right', color: s.c(k), halo: true });
  });
}

/** A slice's curve, drawn as far as the walker has gone, with a dot riding on it. */
function sliceCurve(s: Scene, P: Frame, g: (x: number) => number, k: Ink, from: number, upto: number, at: number, a: number) {
  s.alpha(a, () => {
    P.fn(g, k, 0.75, from, Math.max(from, upto));
    P.dot(at, g(at), 'purple', 1.2);
  });
}

// ---- which slope? hold v, walk along u, and name the slope of that curve

const slice: SceneDef = {
  marks: {
    f: { tex: String.raw`\symf(u, v) = u^2 + 2v^2`, x: 0.5, y: 0.5, size: 4.6 },
    fu: { tex: String.raw`\symf(u, v) = \underbrace{u^2}_{2u} + \underbrace{2v^2}_{0}`, x: 0.5, y: 0.5, size: 4.6 },
  },
  draw(s) {
    const L = layout(s);
    const { M, P } = L;
    map(s, M, s.ease('rings', 2), s.ease('which', 0.6));
    // Before the rings: one spot on the ground, a pair of inputs with a height.
    s.alpha(s.win('two', 'rings'), () => {
      M.dot(0.6, 1.2, 'purple', 1.2);
      s.text('(u, v): height f', M.X(0), M.Y(1.2) + 4.5 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c('purple'), halo: true });
    });
    legend(s, L, 0, 'each spot: a height', '--ink-2', s.win('two', 'which') * after(s, 'two', 0.5));
    legend(s, L, 1, 'rings: equal heights', '--ink-2', s.win('rings', 'which') * after(s, 'rings', 0.3));

    // The point, and the two ways to step from it.
    const pt = s.ease('which', 0.6);
    s.alpha(s.win('which', 'hold'), () => {
      M.arrow(1, 1, 1.6, 1, 'gold', 0.55, 2.2);
      M.arrow(1, 1, 1, 1.6, 'teal', 0.55, 2.2);
      s.text('u?', M.X(1.6) + 1.5 * s.u, M.Y(1), { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c('gold'), halo: true });
      s.text('v?', M.X(1), M.Y(1.6) - 3 * s.u, { size: 3.4, font: 'mono', weight: 650, color: s.c('teal'), halo: true });
    });
    legend(s, L, 0, 'at (1, 1): height 3', 'purple', s.win('which', 'hold') * after(s, 'which', 0.2));
    legend(s, L, 1, 'steep which way?', '--ink-2', s.win('which', 'hold') * after(s, 'which', 0.45));

    // Hold v = 1: walk the dashed line, and the heights draw a curve.
    const held = s.ease('hold', 0.6);
    const u = s.since('hold') < 0 ? 1 : walk(s, 'hold', -2.2, 2.2);
    const reach = s.since('hold') < 0 ? -2.3 : s.prog('hold') < 0.15 ? -2.3 : s.prog('hold') < 0.75 ? lerp(-2.2, 2.2, smooth((s.prog('hold') - 0.15) / 0.6)) : 2.3;
    s.alpha(held, () => M.seg(-2.3, 1, 2.3, 1, 'gold', 0.35, [1.2, 1]));
    s.alpha(pt, () => M.dot(u, 1, 'purple', 1.3));
    panelBase(s, P, 'u', 'gold', held);
    sliceCurve(s, P, alongU, 'purple', -2.3, reach, u, held);
    legend(s, L, 0, 'v held at 1', 'gold', s.win('hold', 'f'));
    legend(s, L, 0, 'v = 1:  f = u² + 2', 'gold', s.ease('f', 0.6, 1.5));

    // The formula, then what each term gives as u moves.
    const tu = s.ease('slope', 0.6, 0.4);
    s.show('f', s.ease('f', 0.6) * (1 - tu), L.formula);
    s.show('fu', tu, L.formula);
    s.alpha(s.ease('slope', 0.6, 0.6), () => {
      P.tangent(1, 3, 2, 'gold', -0.6, 2.6, 0.55);
      P.dot(1, 3, 'purple', 1.2);
    });
    legend(s, L, 1, 'slope at u = 1: 2', 'gold', s.win('slope', 'partial') * after(s, 'slope', 0.7));
    legend(s, L, 1, 'partial: only u moves', '--ink-2', s.win('partial', 'curly'));
    legend(s, L, 1, '∂f/∂u = 2u = 2', 'gold', s.ease('curly', 0.6), 4);
    cite(s, L, 'Legendre, 1786:', s.win('legendre', 'jacobi'));
    const q = L.leg(3.3);
    s.alpha(s.win('legendre', 'jacobi') * after(s, 'legendre', 0.3), () => s.text('« pour éviter toute ambiguïté »', q.x, q.y, { size: 3.1, italic: true, align: 'left', color: s.c('--ink-2'), halo: true }));
    cite(s, L, 'Jacobi, 1841', s.ease('jacobi', 0.6));
  },
};

// ---- hold u instead, compare the two slopes, and the general rule

/** Where a slice crosses each ring, for showing how closely the rings are packed along it. */
const crossU = LEVELS.filter((c) => c > 3).map((c) => Math.sqrt(c - 2)).filter((u) => u < 2.3);
const crossV = LEVELS.filter((c) => c > 3).map((c) => Math.sqrt((c - 1) / 2)).filter((v) => v < 2.3);

const other: SceneDef = {
  marks: {
    f: { tex: String.raw`\symf(u, v) = u^2 + 2v^2`, x: 0.5, y: 0.5, size: 4.6 },
    fv: { tex: String.raw`\symf(u, v) = \underbrace{u^2}_{0} + \underbrace{2v^2}_{4v}`, x: 0.5, y: 0.5, size: 4.6 },
  },
  draw(s) {
    const L = layout(s);
    const { M, P } = L;
    map(s, M, 1, 1);
    const tv = s.ease('dv', 0.6, 0.4);
    s.show('f', 1 - tv, L.formula);
    s.show('fv', tv, L.formula);

    // The u slice from before dims while v walks, then returns for the comparison.
    const back = s.ease('steep', 0.6);
    const dimU = lerp(1, 0.3, s.ease('hold', 0.6)) + 0.7 * back * (1 - s.ease('rule', 0.6));
    const rule = s.ease('rule', 0.6);
    s.alpha(dimU, () => M.seg(-2.3, 1, 2.3, 1, 'gold', 0.35, [1.2, 1]));
    s.alpha(s.ease('hold', 0.6), () => M.seg(1, -1.6, 1, 2.3, 'teal', 0.35, [1.2, 1]));
    const v = s.since('hold') < 0 ? 1 : walk(s, 'hold', -1.5, 1.9);
    M.dot(1, v, 'purple', 1.3);

    const panelA = 1 - 0.75 * rule;
    s.alpha(panelA, () => {
      panelBase(s, P, s.since('hold') < 0 ? 'u' : 'v', s.since('hold') < 0 ? 'gold' : 'teal', 1);
      // The u slice stays fainter than the v slice, so the two curves read apart; their tangents carry the colors.
      s.alpha(dimU * 0.5, () => P.fn(alongU, 'purple', 0.6, -2.3, 2.3));
      s.alpha(dimU, () => P.tangent(1, 3, 2, 'gold', -0.6, 2.6, 0.55));
      const p = s.prog('hold');
      const reach = s.since('hold') < 0 ? -1.6 : p < 0.15 ? -1.6 : p < 0.75 ? lerp(-1.5, 1.9, smooth((p - 0.15) / 0.6)) : 1.95;
      sliceCurve(s, P, alongV, 'purple', -1.6, reach, v, s.ease('hold', 0.6));
      s.alpha(s.ease('dv', 0.6, 0.8), () => P.tangent(1, 3, 4, 'teal', 0.15, 1.85, 0.55));
      P.dot(1, 3, 'purple', 1.2);
    });

    legend(s, L, 0, '∂f/∂u = 2', 'gold', 1 - s.ease('hold', 0.5) + back * (1 - rule));
    legend(s, L, 0, 'u = 1:  f = 1 + 2v²', 'teal', s.win('hold', 'steep') * after(s, 'hold', 0.6));
    legend(s, L, 1, '∂f/∂v = 4v = 4', 'teal', s.ease('dv', 0.6, 1.2) * (1 - rule), 4);

    // Ring crossings along each slice: closer together along v.
    s.alpha(s.win('steep', 'rule'), () => {
      for (const x of crossU) M.dot(x, 1, 'gold', 0.9);
      for (const y of crossV) M.dot(1, y, 'teal', 0.9);
    });
    legend(s, L, 2.3, 'v: twice as steep', '--ink-2', s.win('steep', 'rule') * after(s, 'steep', 0.2));

    // The rule, and the single-input case.
    const lines: [string, Ink][] = [['others held: numbers', '--ink'], ['no moving input: 0', '--ink']];
    lines.forEach(([t, k], i) => legend(s, L, i, t, k, rule * after(s, 'rule', 0.15 + 0.4 * i)));
    legend(s, L, 2.3, 'u alone:', 'gold', after(s, 'one', 0.25));
    legend(s, L, 3.3, '∂f/∂u = f′(u)', 'gold', after(s, 'one', 0.25));
  },
};

// ---- a term that mixes the inputs: the held one is a number multiplying the other

/** A small map of the inputs with the slice being walked: v = 2 across, or u = 1 up. */
function inset(s: Scene, tv: number, a: number) {
  const r: Rect = s.tall ? [4 * s.u, s.h * 0.2, 26 * s.u, s.h * 0.32] : [6 * s.u, s.h * 0.2, 30 * s.u, s.h * 0.32];
  const F = new Frame(s, r, [-0.6, 2.6, -0.6, 3], true);
  s.alpha(a, () => {
    F.axes(0.8);
    const o = { size: 3, font: 'mono', color: s.c('--ink-3'), halo: true } as const;
    s.text('u', F.X(2.5), F.Y(0) + 2.8 * s.u, o);
    s.text('v', F.X(0) - 2.5 * s.u, F.Y(2.9), o);
    const lab = (t: string, x: number, y: number, k: Ink) => s.text(t, x, y, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c(k), halo: true });
    s.alpha(1 - tv, () => {
      F.seg(-0.6, 2, 2.6, 2, 'gold', 0.35, [1.2, 1]);
      lab('v = 2', F.X(1.2), F.Y(2) - 3 * s.u, 'gold');
    });
    s.alpha(tv, () => {
      F.seg(1, -0.6, 1, 3, 'teal', 0.35, [1.2, 1]);
      lab('u = 1', F.X(1) + 1.5 * s.u, F.Y(0.4), 'teal');
    });
    F.dot(1, 2, 'purple', 1.1);
  });
}

const mixed: SceneDef = {
  marks: {
    f: { tex: String.raw`\symf(u, v) = u^2 + 3uv \quad \text{at } (1, 2)`, x: 0.5, y: 0.1, size: 4.6 },
  },
  draw(s) {
    s.show('f', s.ease('mix', 0.6));
    const tv = s.ease('pv', 0.6);
    inset(s, tv, s.ease('held', 0.6));
    termRow(s, 2, 0, 'purple', s.ease('mix', 0.6, 0.8), 'f =', ['u²', '3uv']);
    termRow(s, 2, 1, 'purple', s.ease('held', 0.6), 'v = 2', ['u²', '6u'], [0, s.win('held', 'pu')], { label: 'u = 1', cells: ['1', '3v'], t: tv, k: 'purple' });
    termRow(s, 2, 2, 'gold', s.ease('pu', 0.6), '∂f/∂u', ['2u', '3v'], [0, s.win('pu', 'pv')], { label: '∂f/∂v', cells: ['0', '3u'], t: tv, k: 'teal' });
    const nx = besideX(s, 2);
    const ny = s.h * ROW[1]!;
    const note = { size: 3, font: 'mono', weight: 600, align: 'left', halo: true } as const;
    s.alpha(s.ease('held', 0.6, 1.4) * (1 - tv), () => s.text('slope 6 = 3v', nx, ny, { ...note, color: s.c('gold') }));
    s.alpha(after(s, 'pv', 0.6), () => s.text('slope 3 = 3u', nx, ny, { ...note, color: s.c('teal') }));
    result(s, '∂f/∂u = 2u + 3v = 2 + 6 = 8', 0, 'gold', after(s, 'pu', 0.6));
    result(s, '∂f/∂v = 3u = 3', 1, 'teal', after(s, 'pv', 0.75));
  },
};

// ---- try one

const worked: SceneDef = {
  marks: {
    p: { tex: String.raw`\symf(u, v) = u^2 v + 2v^2 + 3u \quad \text{at } (2, 1)`, x: 0.5, y: 0.1, size: 4.6 },
  },
  draw(s) {
    s.show('p', s.ease('p', 0.6));
    const u = [0.4, 0.72, 0.88].map((f) => after(s, 'du', f));
    const v = [0.42, 0.75, 0.9].map((f) => after(s, 'dv', f));
    termRow(s, 3, 0, 'purple', s.ease('p', 0.6, 0.8), 'f =', ['u²v', '2v²', '3u']);
    termRow(s, 3, 1, 'gold', s.ease('du', 0.5), '∂f/∂u', [fill(u[0]!, '2uv'), fill(u[1]!, '0'), fill(u[2]!, '3')]);
    termRow(s, 3, 2, 'teal', s.ease('q', 0.5), '∂f/∂v', [fill(v[0]!, 'u²'), fill(v[1]!, '4v'), fill(v[2]!, '0')]);
    // The note on u²v changes with the input that moves.
    const sw = s.ease('dv', 0.5);
    result(s, 'u²v is v · u²: gives v · 2u', 0, '--ink-2', after(s, 'du', 0.1) * (1 - sw));
    result(s, 'u²v is u² · v: gives u²', 0, '--ink-2', after(s, 'dv', 0.1));
    result(s, '∂f/∂u = 2uv + 3 = 4 + 3 = 7', 1, 'gold', s.ease('du-n', 0.6));
    result(s, '∂f/∂v = u² + 4v = 4 + 4 = 8', 2, 'teal', s.ease('dv-n', 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { slice, other, mixed, worked };

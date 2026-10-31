import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp, smooth } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { after, stacked } from '../../draw';
import { Frame, rich } from '../../networks/draw';

const neg = (t: string) => t.replace(/-/g, '−');
const fmt = (v: number) => neg(String(+v.toFixed(1)));

/** Who introduced an idea, and when: small, at the top right of the stage, or the bottom right when `low`. */
function cite(s: Scene, text: string, a: number, low = false) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, low ? s.h - 5.5 * s.u : 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

// ---- the margin: the cats and ships of linear scores, the line w · x + b = 0, and room on both sides

const CATS: [number, number][] = [[0.8, 1.6], [1.4, 0.9], [1.1, 1.3], [0.7, 0.9], [1, 1], [0.5, 2.1], [1.6, 0.5]];
const SHIPS: [number, number][] = [[1.8, 3.3], [2.5, 3.9], [2.3, 3.6], [2.7, 3.4], [1.6, 3.8], [2.4, 3.1], [2, 4]];
/** w = (1, 1), b = -4, so a point's score is x₀ + x₁ - 4. */
const score = (p: readonly number[]) => p[0]! + p[1]! - 4;
/** On the edges of the margin, scoring exactly -1 and 1. */
const EDGE: { p: [number, number]; k: Color }[] = [{ p: [1.3, 1.7], k: 'gold' }, { p: [2.6, 2.4], k: 'teal' }];
/** The cat inside the margin, at score -0.5, and a clear one at -2. */
const CLOSE: [number, number] = [1.7, 1.8];
const CLEAR: [number, number] = [1, 1];

/** The feature plane, square: at the top of a narrow stage, at the left of a wide one. */
function plane(s: Scene): Frame {
  const side = stacked(s) ? Math.min(s.w - 20 * s.u, s.h * 0.64) : Math.min(s.h * 0.84, s.w * 0.5);
  const l = stacked(s) ? s.w / 2 - side / 2 : s.w * 0.05;
  const t = stacked(s) ? s.h * 0.04 : (s.h - side) / 2;
  return new Frame(s, l, t, l + side, t + side, [-0.5, 4.5], [-0.5, 4.5]);
}

/** The line x₀ + x₁ = c, which is where the score equals c - 4. */
function level(F: Frame, c: number, k: Color, width: number, dash?: number[]) {
  F.clip(() => F.seg(c + 10, -10, -10, c + 10, k, width, dash));
}

/** The strip between x₀ + x₁ = c0 and x₀ + x₁ = c1. */
function strip(s: Scene, F: Frame, c0: number, c1: number, fill: string) {
  F.clip(() => {
    const g = s.ctx;
    g.beginPath();
    g.moveTo(F.X(c0 + 10), F.Y(-10));
    g.lineTo(F.X(-10), F.Y(c0 + 10));
    g.lineTo(F.X(-10), F.Y(c1 + 10));
    g.lineTo(F.X(c1 + 10), F.Y(-10));
    g.closePath();
    g.fillStyle = fill;
    g.fill();
  });
}

const gap: SceneDef = {
  draw(s) {
    const F = plane(s);
    const u = s.u;
    strip(s, F, -20, 4, s.tint('gold', 0.1));
    strip(s, F, 4, 20, s.tint('teal', 0.1));
    const m = s.ease('gap', 0.8, 1);
    s.alpha(m, () => {
      strip(s, F, 3, 5, s.tint('purple', 0.14));
      level(F, 3, 'purple', 0.4, [1.2, 1]);
      level(F, 5, 'purple', 0.4, [1.2, 1]);
      const lab = { size: 2.9, font: 'mono', weight: 600, color: s.c('purple'), halo: true } as const;
      s.text('s = −1', F.X(2.85), F.Y(-0.2), lab);
      s.text('s = 1', F.X(4.05), F.Y(1.35), lab);
    });
    level(F, 4, 'purple', 0.8);
    s.rrect(F.l, F.t, F.r - F.l, F.b - F.t, 1, { stroke: s.c('--axis'), lw: 0.3 });
    F.axes();
    const ax = { size: 3.2, font: 'mono', weight: 600, color: s.c('orange'), halo: true } as const;
    s.text('x₀: blue →', F.X(0) + 2 * u, F.Y(0) + 3.2 * u, { ...ax, align: 'left' });
    s.text('x₁: edges ↑', F.X(0) + 2 * u, F.t + 3.5 * u, { ...ax, align: 'left' });

    CATS.forEach(([a, b]) => F.dot(a, b, 'gold', 1.3));
    SHIPS.forEach(([a, b]) => F.dot(a, b, 'teal', 1.3));
    EDGE.forEach(({ p, k }) => F.dot(p[0], p[1], k, 1.3));
    F.dot(CLOSE[0], CLOSE[1], 'gold', 1.3);

    // The cat against the line, and later how far short of its edge it falls.
    const close = s.win('close', 'svm');
    s.alpha(close, () => s.circle(F.X(CLOSE[0]), F.Y(CLOSE[1]), 2.6 * u, { stroke: s.c('red'), lw: 0.4 }));
    const cost = s.win('cost', 'svm');
    const tag = { size: 3, font: 'mono', weight: 650, halo: true } as const;
    s.alpha(cost, () => {
      s.circle(F.X(CLEAR[0]), F.Y(CLEAR[1]), 2.6 * u, { stroke: s.c('green'), lw: 0.4 });
      s.text('−2', F.X(CLEAR[0]), F.Y(CLEAR[1]) + 5 * u, { ...tag, color: s.c('green') });
    });
    s.alpha(cost * after(s, 'cost', 0.45), () => {
      const d = (score(CLOSE) + 1) / 2;
      F.seg(CLOSE[0], CLOSE[1], CLOSE[0] - d, CLOSE[1] - d, 'red', 0.7);
      s.text('−0.5', F.X(CLOSE[0]) + 4 * u, F.Y(CLOSE[1]) - 1.5 * u, { ...tag, align: 'left', color: s.c('red') });
    });
    // The support vectors: the points right on the edges.
    s.alpha(after(s, 'svm', 0.68), () => EDGE.forEach(({ p }) => s.circle(F.X(p[0]), F.Y(p[1]), 2.6 * u, { stroke: s.c('purple'), lw: 0.45 })));
    cite(s, 'Cortes & Vapnik, 1995', s.ease('svm', 0.6), stacked(s));

    // The equation and captions, beside the plane on a wide stage and under it on a phone.
    const st = stacked(s);
    const ex = st ? s.w / 2 : (F.r + s.w) / 2;
    const ey = st ? F.b + 8 * u : s.h * 0.4;
    const eq = { size: st ? 4.4 : 4.8, weight: 650 } as const;
    const cap = { size: st ? 3.3 : 3.5, font: 'mono', color: s.c('--ink-2'), halo: true } as const;
    const cy = ey + (st ? 11 : 13) * u;
    s.alpha(1 - s.ease('gap', 0.5), () => rich(s, [['w', 'blue'], [' · ', '--ink-2'], ['x', 'orange'], [' + ', '--ink-2'], ['b', 'green'], [' = 0', '--ink-2']], ex, ey, eq));
    s.alpha(m, () => {
      rich(s, [['ships: ', 'teal'], ['at least 1', 'purple']], ex, ey - 3.6 * u, eq);
      rich(s, [['cats: ', 'gold'], ['at most −1', 'purple']], ex, ey + 3.6 * u, eq);
    });
    s.alpha(s.win('recap', 'close'), () => s.text('s > 0: ship    s < 0: cat', ex, cy, { ...cap, color: s.c('purple') }));
    s.alpha(s.win('close', 'gap'), () => s.text('on its side, but only just', ex, cy, { ...cap, color: s.c('red') }));
    s.alpha(s.win('gap', 'cost'), () => s.text('a margin on both sides', ex, cy, cap));
    s.alpha(s.win('cost', 'loss'), () => {
      s.text('cat at −2: clear, costs 0', ex, cy, { ...cap, color: s.c('green') });
      s.alpha(after(s, 'cost', 0.45), () => s.text('cat at −0.5: costs 0.5', ex, cy + 6.5 * u, { ...cap, color: s.c('red') }));
    });
    s.alpha(s.win('loss', 'svm'), () => s.text('its loss: L = 0.5', ex, cy, { ...cap, size: cap.size + 0.4, weight: 650, color: s.c('red') }));
    s.alpha(after(s, 'svm', 0.68), () => s.text('support vectors: on the edges', ex, cy, { ...cap, color: s.c('purple') }));
  },
};

// ---- three classes: score bars, and the line one below the right class's score

interface Box {
  cx: number;
  gap: number;
  top: number;
  bot: number;
  lo: number;
  hi: number;
}

const mixBox = (a: Box, b: Box, t: number): Box => ({
  cx: lerp(a.cx, b.cx, t),
  gap: lerp(a.gap, b.gap, t),
  top: lerp(a.top, b.top, t),
  bot: lerp(a.bot, b.bot, t),
  lo: lerp(a.lo, b.lo, t),
  hi: lerp(a.hi, b.hi, t),
});

const full = (s: Scene): Box => ({ cx: s.w / 2 + (s.tall ? 3 * s.u : 0), gap: s.tall ? 24 : 28, top: s.h * 0.1, bot: s.h * 0.72, lo: -2, hi: 8 });
/** The bars at the top of a phone's stage or the left of a desktop's, leaving room for a graph or the sums. */
const compact = (s: Scene): Box => (stacked(s) ? { cx: s.w / 2, gap: 24, top: s.h * 0.07, bot: s.h * 0.41, lo: -3, hi: 7 } : { cx: s.w * 0.34, gap: 21, top: s.h * 0.1, bot: s.h * 0.72, lo: -3, hi: 7 });

/**
 * Score bars around a zero line, the right class tagged `y`, and the margin line one below its
 * score; the part of a wrong bar above the line is its cost, drawn in red.
 */
function hingeBars(s: Scene, vals: number[], y: number, names: string[], B: Box, o: { line?: number; cost?: number; tag?: number } = {}) {
  const xs = vals.map((_, i) => B.cx + (i - (vals.length - 1) / 2) * B.gap * s.u);
  const Y = (v: number) => lerp(B.bot, B.top, (v - B.lo) / (B.hi - B.lo));
  const w = 12 * s.u;
  const z = Y(0);
  s.line(xs[0]! - w, z, xs[xs.length - 1]! + w, z, s.c('--axis'), 0.35);
  const lineV = vals[y]! - 1;
  xs.forEach((x, i) => {
    const v = vals[i]!;
    const right = i === y;
    const k = right ? 'gold' : 'purple';
    const t = Y(v);
    s.rrect(x - w / 2, Math.min(z, t), w, Math.max(Math.abs(z - t), 0.6 * s.u), 1, { fill: s.tint(k, 0.3), stroke: s.tint(k, 0.85), lw: 0.3 });
    const cost = right ? 0 : Math.max(0, v - lineV);
    if (cost > 0.005 && (o.cost ?? 0) > 0.003) {
      s.alpha(o.cost!, () => {
        s.rrect(x - w / 2, t, w, Y(lineV) - t, 1, { fill: s.tint('red', 0.45), stroke: s.c('red'), lw: 0.35 });
        s.text(`+${fmt(cost)}`, x + w / 2 + 1.5 * s.u, (t + Y(lineV)) / 2, { size: 3.4, font: 'mono', weight: 700, align: 'left', color: s.c('red'), halo: true });
      });
    }
    s.text(fmt(v), x, v >= 0 ? t - 3.2 * s.u : t + 3.2 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c(k), halo: true });
    s.text(names[i]!, x, B.bot + 5 * s.u, { size: 3.4, font: 'mono', color: right ? s.c('gold') : s.c('--ink-2') });
  });
  s.alpha(o.tag ?? 1, () => s.text('y', xs[y]!, B.bot + 10 * s.u, { size: 3.6, font: 'mono', weight: 700, color: s.c('gold') }));
  if ((o.line ?? 0) > 0.003) {
    s.alpha(o.line!, () => {
      const ly = Y(lineV);
      s.line(xs[0]! - 7.5 * s.u, ly, xs[xs.length - 1]! + 9 * s.u, ly, s.c('red'), 0.35, [1.4, 1.2]);
      s.text(neg(`s[y]-1 = ${fmt(lineV)}`), xs[0]! - 8.5 * s.u, ly, { size: 2.9, font: 'mono', align: 'right', color: s.c('red') });
    });
  }
  return { xs, Y };
}

const CAT = [3, 5, -1];
const NAMES = ['cat', 'plane', 'ship'];

/** The graph of plane's cost against its score: on the right of a desktop's stage, under the bars on a phone. */
function costFrame(s: Scene): Frame {
  return stacked(s)
    ? new Frame(s, 20 * s.u, s.h * 0.6, s.w - 12 * s.u, s.h * 0.87, [-2, 7], [-0.6, 5.4])
    : new Frame(s, s.w * 0.6, s.h * 0.14, s.w * 0.94, s.h * 0.66, [-2, 7], [-0.6, 5.4]);
}

const classes: SceneDef = {
  draw(s) {
    const e = s.ease('slide', 0.8);
    const B = mixBox(full(s), compact(s), e);
    // `slide` drops plane's score to -2, then raises it back to 5 as the cost graph traces.
    const p = s.prog('slide');
    const plane = s.since('slide') >= 0 ? 5 - 7 * smooth(p / 0.12) + 7 * smooth((p - 0.15) / 0.85) : 5;
    const H = hingeBars(s, [CAT[0]!, plane, CAT[2]!], 0, NAMES, B, { line: s.ease('line', 0.8, 1.6), cost: s.ease('poke', 0.6, 0.8), tag: s.ease('y', 0.6) });
    s.alpha(s.ease('line', 0.6, 2.4) * (1 - e), () => {
      const x = H.xs[0]! + 8.5 * s.u;
      s.line(x, H.Y(3), x, H.Y(2), s.c('gold'), 0.35);
      s.text('1', x + 1.6 * s.u, (H.Y(3) + H.Y(2)) / 2, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('gold') });
    });
    s.alpha(s.win('line', 'slide') * after(s, 'line', 0.1), () => s.text('beat every wrong class by at least 1', s.w / 2, s.h * 0.93, { size: 3.4, font: 'mono', color: s.c('--ink-2'), halo: true }));

    // The cost graph: flat up to the line at 2, then up one for one.
    s.alpha(s.ease('slide', 0.8, 0.4), () => {
      const F = costFrame(s);
      const hinge = (v: number) => Math.max(0, v - 2);
      F.seg(-2, 0, 7, 0, '--axis', 0.3);
      F.seg(-2, -0.6, -2, 5.4, '--axis', 0.3);
      const lab = { size: 3, font: 'mono', color: s.c('--ink-3'), halo: true } as const;
      s.text('plane\'s score →', F.r, F.b + 3.6 * s.u, { ...lab, align: 'right' });
      s.text('cost ↑', F.l + 1.5 * s.u, F.t + 1 * s.u, { ...lab, align: 'left', color: s.c('red') });
      F.seg(2, -0.6, 2, 5.4, 'red', 0.25, [1, 1]);
      s.text('line', F.X(2), F.b + 3.6 * s.u, { ...lab, color: s.c('red') });
      const done = s.since('hinge') >= 0;
      const to = done ? 7 : Math.max(-2, plane);
      if (s.since('slide') >= 0 && p > 0.15) F.fn(hinge, 'red', 0.8, -2, to);
      s.alpha(done ? 1 - s.ease('hinge', 0.5) : 1, () => F.dot(plane, hinge(plane), 'purple', 1.4));
      s.alpha(s.ease('hinge', 0.6, 0.6), () => {
        s.circle(F.X(2), F.Y(0), 2.4 * s.u, { stroke: s.c('red'), lw: 0.45 });
        s.text('the hinge', F.X(2) - 2 * s.u, F.Y(0) - 5 * s.u, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('red'), halo: true });
        F.dot(5, 3, 'purple', 1.2);
        s.text('plane: 3', F.X(5) - 2.5 * s.u, F.Y(3), { size: 3, font: 'mono', weight: 600, align: 'right', color: s.c('purple'), halo: true });
      });
    });
  },
};

// ---- the sum: one term per wrong class, the right class skipped

const sum: SceneDef = {
  marks: {
    f: { tex: String.raw`\symL = \sum_{j \ne \symy} \max(0,\ \syms_j - \syms_{\symy} + 1)`, x: 0.5, y: 0.6, size: 4.2 },
  },
  draw(s) {
    const st = stacked(s);
    const H = hingeBars(s, CAT, 0, NAMES, compact(s), { line: 1, cost: 1 });
    const fpos = st ? { x: 0.5, y: 0.585 } : { x: 0.77, y: 0.2 };
    s.show('f', s.ease('sum', 0.6), fpos);
    // Ship's height: how far it sits below the line.
    s.alpha(s.ease('max', 0.6), () => {
      const x = H.xs[2]! + 8 * s.u;
      s.line(x, H.Y(2), x, H.Y(-1), s.c('green'), 0.35);
      s.text('−3', x + 1.4 * s.u, (H.Y(2) + H.Y(-1)) / 2, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('green'), halo: true });
    });
    const x0 = st ? s.w / 2 - 25 * s.u : s.w * 0.6;
    const ys = st ? [0.69, 0.76, 0.83].map((f) => s.h * f) : [0.4, 0.49, 0.58].map((f) => s.h * f);
    const o = { size: st ? 3.3 : 3.5, font: 'mono', align: 'left', halo: true } as const;
    const m = s.ease('max', 0.6);
    s.alpha(s.ease('height', 0.6, 0.6) * (1 - m), () => s.text('plane: 5 − 3 + 1 = 3', x0, ys[0]!, { ...o, color: s.c('red') }));
    s.alpha(m, () => {
      s.text('plane: max(0, 3) = 3', x0, ys[0]!, { ...o, color: s.c('red') });
      s.alpha(after(s, 'max', 0.3), () => s.text('ship:  max(0, −3) = 0', x0, ys[1]!, { ...o, color: s.c('green') }));
    });
    s.alpha(s.ease('skip', 0.6), () => s.text('cat:   skipped (always 1)', x0, ys[2]!, { ...o, color: s.c('--ink-3') }));
    const lx = st ? s.w / 2 : s.w * 0.77;
    const ly = st ? s.h * 0.92 : s.h * 0.75;
    s.alpha(s.ease('sum', 0.6, 2), () => s.text('L = 3 + 0 = 3', lx, ly, { size: 4.4, font: 'mono', weight: 650, color: s.c('red'), halo: true }));
    cite(s, 'Weston & Watkins, 1999', s.ease('ww', 0.6));
  },
};

// ---- zero loss: the right class must clear every other by the margin

const zero: SceneDef = {
  draw(s) {
    // `least` dips cat to 5.5 while the voice says so, then settles back on 6.
    const p = s.prog('least');
    const dip = smooth((p - 0.34) / 0.05) * (1 - smooth((p - 0.84) / 0.06));
    const c = lerp(3, 6, s.ease('raise', 2)) - 0.5 * dip;
    hingeBars(s, [c, 5, -1], 0, NAMES, full(s), { line: 1, cost: 1 });
    const L = Math.max(0, 5 - (c - 1)) + Math.max(0, -1 - (c - 1));
    const ok = L < 0.005;
    s.text(ok ? 'L = 0' : `L = ${+L.toFixed(2)}`, s.w / 2, s.h * 0.93, { size: 4.2, font: 'mono', weight: 650, color: s.c(ok ? 'green' : 'red') });
    const top = { size: 3.5, font: 'mono', weight: 600, halo: true } as const;
    s.alpha(s.win('zero', 'least'), () => s.text(neg('plane: max(0, 5 - 6 + 1) = 0'), s.w / 2, s.h * 0.05, { ...top, color: s.c('green') }));
    s.alpha(s.ease('least', 0.6), () => s.text('smallest s[y] = 5 + 1 = 6', s.w / 2, s.h * 0.05, { ...top, color: s.c('gold') }));
  },
};

export const scenes: Record<string, SceneDef> = { gap, classes, sum, zero };

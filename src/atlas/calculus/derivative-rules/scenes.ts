import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp, smooth } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { after, Frame } from '../draw';

type Ink = Color | `--${string}`;

const E = Math.E;
const LN2 = Math.log(2);
const LN5 = Math.log(5);

/** The plot on top of the stage, leaving two text rows below it. */
const plotRect = (s: Scene): [number, number, number, number] => [s.w * 0.07, s.h * 0.05, s.w * 0.86, s.h * 0.66];
/** The two text rows under the plot, as fractions of the stage height. */
const ROW = [0.8, 0.9];

function row(s: Scene, i: number, text: string, k: Ink, a: number, size = 3.5) {
  s.alpha(a, () => s.text(text, s.w / 2, s.h * ROW[i]!, { size, font: 'mono', weight: 600, color: s.c(k), halo: true }));
}

function label(s: Scene, F: Frame, x: number, y: number, text: string, k: Ink, a: number, align: CanvasTextAlign = 'center', dx = 0, dy = 0, size = 3.4) {
  s.alpha(a, () => s.text(text, F.X(x) + dx * s.u, F.Y(y) + dy * s.u, { size, font: 'mono', weight: 650, align, color: s.c(k), halo: true }));
}

/** The right triangle under a tangent: its run along a level line and its rise up to the point. */
function triangle(s: Scene, F: Frame, x: number, y: number, run: number, base: number, a: number, kRun: Ink = 'teal', kRise: Ink = 'gold') {
  s.alpha(a, () => {
    F.seg(x - run, base, x, base, kRun, 0.9);
    F.seg(x, base, x, y, kRise, 0.9);
  });
}

const fmt = (v: number) => (v < 0 ? `−${(-v).toFixed(2)}` : v.toFixed(2));

// ---- e^x: the bank's growth, where the rate is the amount, so the slope is the height

const grow: SceneDef = {
  marks: {
    rule: { tex: String.raw`e^{\symx} \;\longrightarrow\; e^{\symx}`, x: 0.5, y: ROW[0]!, size: 5 },
    lx: { tex: String.raw`e^{\symx}`, x: 0, y: 0, size: 4.6 },
  },
  draw(s) {
    const F = new Frame(s, plotRect(s), [-2.6, 2.3, -0.7, 9.6]);
    F.axes();
    F.fn(Math.exp, 'purple', 0.8);
    s.show('lx', 1, F.frac(2.0, Math.exp(2), -6, 0));

    row(s, 0, 'x³: x is the base   →  3x²', '--ink-2', s.win('problem', 'bank'));
    row(s, 1, 'e^x: x is the power →  ?', 'purple', s.win('problem', 'bank') * after(s, 'problem', 0.45));

    // The dollar, growing along the curve.
    const run = smooth(s.prog('bank'));
    s.alpha(s.win('bank', 'rate'), () => {
      const x = lerp(-2.4, 1.9, run);
      F.dot(x, Math.exp(x), 'gold', 1.5);
    });
    row(s, 0, 'grows 100% a year of what is there', '--ink-2', s.win('bank', 'slide'));

    // Two amounts, each growing at its own size.
    const r = s.win('rate', 'slide');
    [[LN2, 2], [LN5, 5]].forEach(([x, y], i) => {
      const a = r * after(s, 'rate', 0.25 + 0.3 * i);
      s.alpha(a, () => {
        F.tangent(x!, y!, y!, 'teal', x! - 0.25, x! + 0.25, 0.6);
        F.dot(x!, y!, 'purple', 1.3);
      });
      label(s, F, x!, y!, `${y}: grows ${y} a year`, 'teal', a, 'right', -3, 0, 3.2);
    });
    row(s, 1, 'rate of growth = amount', 'teal', r);

    // The tangent slides, then settles at x = 1.
    const p = s.since('one') >= 0 ? lerp(1.9, 1, s.ease('one', 1.2)) : lerp(-1.4, 1.9, smooth(s.prog('slide')));
    const ep = Math.exp(p);
    const tri = s.ease('slide', 0.6);
    s.alpha(tri, () => {
      F.tangent(p, ep, ep, 'teal', p - 1.25, p + 0.45, 0.6);
      triangle(s, F, p, ep, 1, 0, 1);
      F.dot(p, ep, 'purple', 1.4);
    });
    label(s, F, p - 0.5, 0, '1', 'teal', tri, 'center', 0, 4);
    label(s, F, p, ep / 2, fmt(ep), 'gold', tri, 'left', 2, 0);
    row(s, 0, 'rate → slope,  amount → height', '--ink-2', s.win('slide', 'rule'));
    s.alpha(tri, () => {
      const t = { size: 3.6, font: 'mono', weight: 650, halo: true } as const;
      const y = s.h * ROW[1]!;
      s.text(`height ${fmt(ep)}`, s.w / 2 - 2 * s.u, y, { ...t, align: 'right', color: s.c('gold') });
      s.text(`slope ${fmt(ep)}`, s.w / 2 + 2 * s.u, y, { ...t, align: 'left', color: s.c('teal') });
    });
    s.show('rule', s.ease('rule', 0.6));
  },
};

// ---- e^(3x): e^x squeezed to a third of its width, so every slope is three times as steep

const fast: SceneDef = {
  marks: {
    r3: { tex: String.raw`e^{3\symx} \;\longrightarrow\; 3e^{3\symx}`, x: 0.5, y: ROW[0]!, size: 4.6 },
    ra: { tex: String.raw`e^{a\symx} \;\longrightarrow\; a\,e^{a\symx}`, x: 0.5, y: ROW[1]!, size: 4.6 },
    lx: { tex: String.raw`e^{\symx}`, x: 0, y: 0, size: 4.6 },
    l3: { tex: String.raw`e^{3\symx}`, x: 0, y: 0, size: 4.6 },
  },
  draw(s) {
    const F = new Frame(s, plotRect(s), [-1.3, 1.6, -0.7, 9.6]);
    F.axes();
    // e^x, dimming once e^(3x) arrives.
    s.alpha(1 - 0.6 * s.ease('squeeze', 0.8), () => F.fn(Math.exp, 'purple', 0.8));
    s.show('lx', 1 - 0.5 * s.ease('squeeze', 0.8), F.frac(1.45, 2.6));

    // Each height of e^x reached three times sooner.
    const arrows = s.win('three', 'steep');
    [1, 1.5].forEach((x, i) => {
      const y = Math.exp(x);
      const a = arrows * after(s, 'three', 0.3 + 0.2 * i);
      s.alpha(a, () => {
        F.arrow(x, y, x / 3 + 0.06, y, '--ink-3', 0.4, 2);
        F.dot(x, y, 'purple', 1.2);
        F.dot(x / 3, y, 'orange', 1.2);
      });
      label(s, F, (x + x / 3) / 2, y, '÷3', '--ink-2', a, 'center', 0, -3, 3.2);
    });
    row(s, 0, 'e^3x: the power runs 3 times as fast', 'orange', s.win('three', 'steep'));

    // The squeeze: e^(kx), k going from 1 to 3.
    const k = lerp(1, 3, s.ease('squeeze', 1.6, 0.4));
    s.alpha(s.ease('squeeze', 0.4), () => F.fn((x) => Math.exp(k * x), 'orange', 0.8));
    s.show('l3', s.ease('squeeze', 0.6, 1.8), F.frac(0.58, Math.exp(3 * 0.58), -6, 0));

    // The same rise over a third of the run.
    const st = s.win('steep', 'zero');
    s.alpha(st, () => {
      F.tangent(1, E, E, 'teal', -0.15, 1.35, 0.5);
      triangle(s, F, 1, E, 1, 0, 1);
      F.dot(1, E, 'purple', 1.3);
      s.alpha(after(s, 'steep', 0.35), () => {
        F.tangent(1 / 3, E, 3 * E, 'teal', -0.05, 0.5, 0.5);
        triangle(s, F, 1 / 3, E, 1 / 3, 0, 1);
        F.dot(1 / 3, E, 'orange', 1.3);
      });
    });
    row(s, 0, 'e^x at 1:  2.72 over a run of 1 = 2.72', 'purple', st, 3.3);
    row(s, 1, 'e^3x at ⅓:  2.72 over a run of ⅓ = 8.15', 'orange', st * after(s, 'steep', 0.35), 3.3);

    // At zero: height 1, slope 3.
    const z = s.win('zero', 'rule');
    s.alpha(z, () => {
      F.tangent(0, 1, 3, 'teal', -0.6, 0.45, 0.6);
      triangle(s, F, 0, 1, 1 / 3, 0, 1);
      F.dot(0, 1, 'orange', 1.4);
    });
    row(s, 0, 'at 0:  height 1,  slope 3', 'orange', z);

    s.show('r3', s.ease('rule', 0.6));
    s.show('ra', s.ease('rule', 0.6, 2.5));
  },
};

// ---- ln x: e^x mirrored across the diagonal, so rise and run swap and the slope flips to 1/x

/** A point of e^x carried across the diagonal: k = 0 leaves it on e^x, k = 1 lands it on ln x. */
const fold = (t: number, k: number): [number, number] => [lerp(t, Math.exp(t), k), lerp(Math.exp(t), t, k)];

function foldCurve(s: Scene, F: Frame, k: number, col: Ink) {
  const c = s.ctx;
  F.clip(() => {
    c.beginPath();
    for (let i = 0; i <= 200; i++) {
      const [x, y] = fold(lerp(-2.6, 1.9, i / 200), k);
      if (i) c.lineTo(F.X(x), F.Y(y));
      else c.moveTo(F.X(x), F.Y(y));
    }
    c.strokeStyle = s.c(col);
    c.lineWidth = 0.8 * s.u;
    c.lineJoin = 'round';
    c.stroke();
  });
}

const mirror: SceneDef = {
  marks: {
    rule: { tex: String.raw`\ln \symx \;\longrightarrow\; \tfrac{1}{\symx}`, x: 0.5, y: ROW[0]!, size: 5 },
    lx: { tex: String.raw`e^{\symx}`, x: 0, y: 0, size: 4.6 },
    lln: { tex: String.raw`\ln \symx`, x: 0, y: 0, size: 4.6 },
  },
  draw(s) {
    // Zoomed in on the small triangles while they are swapped, out again for the rest.
    const zoom = s.ease('swap', 1.2) * (1 - s.ease('every', 1.2));
    const WIDE = [-1.3, 5.6, -1.7, 5.6];
    const NEAR = [-1.4, 2.7, -1.4, 2.7];
    const dom = WIDE.map((v, i) => lerp(v, NEAR[i]!, zoom)) as [number, number, number, number];
    const F = new Frame(s, [s.w * 0.07, s.h * 0.04, s.w * 0.86, s.h * 0.69], dom, true);
    F.axes();
    F.clip(() => F.seg(-1.7, -1.7, 5.6, 5.6, '--ink-3', 0.3, [1.2, 1]));
    const k = s.ease('ln', 1.8, 1);
    F.fn(Math.exp, 'purple', 0.8);
    s.show('lx', 1 - zoom, F.frac(1.62, 5.05, -6, 0));
    if (k > 0.003) foldCurve(s, F, k, 'blue');
    s.show('lln', k * (1 - zoom), F.frac(5.2, Math.log(5.2), 0, -5));
    row(s, 0, 'ln reads e^x backwards: the axes swap', 'blue', s.win('ln', 'point'));

    // One point and its mirror.
    const pt = s.win('point', 'every');
    s.alpha(pt, () => {
      F.seg(LN2, 2, 2, LN2, '--ink-3', 0.3, [0.8, 0.8]);
      F.dot(LN2, 2, 'purple', 1.4);
      s.alpha(after(s, 'point', 0.4), () => F.dot(2, LN2, 'blue', 1.4));
    });
    label(s, F, LN2, 2, '(0.69, 2)', 'purple', pt * (1 - s.ease('swap', 0.5)), 'right', -3, 0, 3.2);
    label(s, F, 2, LN2, '(2, 0.69)', 'blue', pt * after(s, 'point', 0.4) * (1 - s.ease('swap', 0.5)), 'left', 3, 3, 3.2);
    row(s, 0, 'e^x: height 2 at 0.69', 'purple', s.win('point', 'swap'));
    row(s, 1, 'ln: height 0.69 at 2', 'blue', s.win('point', 'swap') * after(s, 'point', 0.4));

    // The tangent's triangle and its mirror image: the gold rise becomes the run.
    const sw = s.win('swap', 'every');
    s.alpha(sw, () => {
      F.tangent(LN2, 2, 2, 'teal', LN2 - 1.25, LN2 + 0.4, 0.5);
      triangle(s, F, LN2, 2, 1, 0, 1);
    });
    const m = sw * after(s, 'swap', 0.4);
    s.alpha(m, () => {
      F.tangent(2, LN2, 0.5, 'teal', -0.3, 3.4, 0.5);
      // The mirror of run 1 (teal) and rise 2 (gold): rise 1 up the y axis, run 2 along y = ln 2.
      F.seg(0, LN2 - 1, 0, LN2, 'teal', 0.9);
      F.seg(0, LN2, 2, LN2, 'gold', 0.9);
      F.dot(2, LN2, 'blue', 1.4);
    });
    s.alpha(sw, () => F.dot(LN2, 2, 'purple', 1.4));
    label(s, F, LN2, 1.5, '2', 'gold', sw, 'left', 1.8, 0, 3.2);
    label(s, F, 1.45, LN2, '2', 'gold', m, 'center', 0, -3, 3.2);
    row(s, 0, 'e^x at 0.69:  rise 2, run 1: slope 2', 'purple', sw, 3.4);
    row(s, 1, 'ln at 2:  rise 1, run 2: slope ½', 'blue', m, 3.4);

    // Height five, and its mirror.
    const ev = s.win('every', 'rule');
    s.alpha(ev, () => {
      F.tangent(LN5, 5, 5, 'teal', LN5 - 0.25, LN5 + 0.12, 0.6);
      F.dot(LN5, 5, 'purple', 1.4);
      s.alpha(after(s, 'every', 0.45), () => {
        F.tangent(5, LN5, 0.2, 'teal', 4.1, 5.6, 0.6);
        F.dot(5, LN5, 'blue', 1.4);
      });
    });
    row(s, 0, 'e^x at height 5:  slope 5', 'purple', s.win('every', 'rule'));
    row(s, 1, 'ln at 5:  slope ⅕', 'blue', s.win('every', 'rule') * after(s, 'every', 0.45));

    s.show('rule', s.ease('rule', 0.6));

    // The slope of ln, slid along the curve.
    const sh = s.ease('rule', 0.5, 0.9);
    const x = lerp(0.3, 5.2, smooth(s.prog('rule')));
    s.alpha(sh, () => {
      const L = 0.9 / Math.hypot(1, 1 / x);
      F.tangent(x, Math.log(x), 1 / x, 'teal', x - L, x + L, 0.6);
      F.dot(x, Math.log(x), 'blue', 1.4);
      const y = s.h * ROW[1]!;
      const t = { size: 3.6, font: 'mono', weight: 650, halo: true } as const;
      s.text(`x ${x.toFixed(2)}`, s.w / 2 - 2 * s.u, y, { ...t, align: 'right', color: s.c('blue') });
      s.text(`slope ${(1 / x).toFixed(2)}`, s.w / 2 + 2 * s.u, y, { ...t, align: 'left', color: s.c('teal') });
    });
  },
};

// ---- the worked mix: each term's derivative, then the whole; then slopes at a point

const T_COLS = [0.2, 0.5, 0.8];
const TERMS = [String.raw`2\symx^{3}`, String.raw`4e^{-2\symx}`, String.raw`3\ln \symx`];
const DERIVS = [String.raw`6\symx^{2}`, String.raw`-8e^{-2\symx}`, String.raw`\dfrac{3}{\symx}`];
const T_NOTES = ['3 · 2x²', '4 · (−2)', '3 · 1/x'];
const T_BEATS = ['t1', 't2', 't3'];

const tryIt: SceneDef = {
  marks: {
    ...Object.fromEntries(TERMS.map((t, i) => [`t${i}`, { tex: t, x: T_COLS[i]!, y: 0.2, size: 5.6 }])),
    ...Object.fromEntries(DERIVS.map((t, i) => [`d${i}`, { tex: t, x: T_COLS[i]!, y: 0.5, size: 5.6 }])),
    whole: { tex: String.raw`\symf'(\symx) = 6\symx^{2} - 8e^{-2\symx} - \dfrac{3}{\symx}`, x: 0.5, y: 0.78, size: 5.2 },
    q2: { tex: String.raw`\symf(\symx) = \symx^{2} + 6\ln \symx, \quad \symf'(2) = \,?`, x: 0.5, y: 0.18, size: 5.2 },
    dq2: { tex: String.raw`\symf'(\symx) = 2\symx + \dfrac{6}{\symx}`, x: 0.5, y: 0.44, size: 5.4 },
    vq2: { tex: String.raw`\symf'(2) = 4 + 3 = 7`, x: 0.5, y: 0.7, size: 5.4 },
    q3: { tex: String.raw`\symf(\symx) = 5e^{3\symx}, \quad \symf'(0) = \,?`, x: 0.5, y: 0.18, size: 5.2 },
    dq3: { tex: String.raw`\symf'(\symx) = 15e^{3\symx}`, x: 0.5, y: 0.44, size: 5.4 },
    vq3: { tex: String.raw`\symf'(0) = 15 \cdot e^{0} = 15`, x: 0.5, y: 0.7, size: 5.4 },
  },
  draw(s) {
    const one = s.ease('p1', 0.6) * (1 - s.ease('p2', 0.5));
    const op = (t: string, x: number, y: number, a: number) => s.alpha(a, () => s.text(t, x * s.w, y * s.h, { size: 5.2, color: s.c('--ink-3') }));
    TERMS.forEach((_, i) => s.show(`t${i}`, one * s.ease('p1', 0.5, 0.4 * i)));
    op('+', (T_COLS[0]! + T_COLS[1]!) / 2, 0.2, one * s.ease('p1', 0.5, 0.4));
    op('−', (T_COLS[1]! + T_COLS[2]!) / 2, 0.2, one * s.ease('p1', 0.5, 0.8));
    T_BEATS.forEach((b, i) => {
      const d = after(s, b, 0.15) * one;
      const x = T_COLS[i]! * s.w;
      s.alpha(d, () => {
        s.arrow(x, s.h * 0.28, x, s.h * 0.41, s.c('--ink-3'), 0.4, 2);
        s.text(T_NOTES[i]!, x + 2.5 * s.u, s.h * 0.345, { size: 3.1, font: 'mono', align: 'left', color: s.c('--ink-3'), halo: true });
      });
      s.show(`d${i}`, after(s, b, 0.6) * one);
    });
    op('−', (T_COLS[1]! + T_COLS[2]!) / 2, 0.5, after(s, 't3', 0.8) * one);
    const w = s.ease('sum', 0.6, 0.3) * one;
    s.alpha(w, () => s.rrect(s.w / 2 - 34 * s.u, s.h * 0.78 - 7.5 * s.u, 68 * s.u, 15 * s.u, 2, { fill: s.tint('purple', 0.08), stroke: s.tint('purple', 0.55), lw: 0.35 }));
    s.show('whole', w);
    const two = s.ease('p2', 0.6, 0.3) * (1 - s.ease('zero', 0.5));
    s.show('q2', two);
    s.show('dq2', two * after(s, 'p2', 0.55));
    s.show('vq2', two * after(s, 'a2', 0.3));
    const three = s.ease('zero', 0.6, 0.3);
    s.show('q3', three);
    s.show('dq3', three * after(s, 'zero', 0.35));
    s.show('vq3', three * after(s, 'zero', 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { grow, fast, mirror, try: tryIt };

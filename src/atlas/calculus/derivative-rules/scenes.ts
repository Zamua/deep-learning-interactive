import type { SceneDef } from '../../../lecture/scene';
import { after, Frame, inset, note } from '../draw';

const E = Math.E;
const E3 = Math.exp(3);

const explog: SceneDef = {
  marks: {
    g3: { tex: String.raw`e^{3\symx}`, x: 0.5, y: 0.5, size: 4.6 },
    eax: { tex: String.raw`e^{3\symx} \;\longrightarrow\; 3e^{3\symx}`, x: 0.09, y: 0.5, size: 5, align: 'left' },
    eaxAny: { tex: String.raw`e^{a\symx} \;\longrightarrow\; a\,e^{a\symx}`, x: 0.09, y: 0.62, size: 5, align: 'left' },
    ln: { tex: String.raw`\ln \symx \;\longrightarrow\; \tfrac{1}{\symx}`, x: 0.6, y: 0.8, size: 5, align: 'left' },
  },
  draw(s) {
    const r = inset(s, 0.07, 0.07, 0.07);
    const lnA = s.ease('ln', 0.8);
    // e^(3x) takes over from e^x: its slope is three times its height.
    const three = s.ease('eax', 0.6);
    s.alpha(1 - lnA, () => {
      const F = new Frame(s, r, [-2.6, 2.2, -0.5, 6.4]);
      F.axes();
      s.alpha(1 - 0.65 * three, () => F.fn(Math.exp, 'purple', 0.8));
      s.alpha(1 - three, () => {
        F.seg(1, 0, 1, E, 'gold', 0.45, [1.2, 1]);
        F.tangent(1, E, E, 'teal', 0.1, 1.9, 0.6);
        F.dot(1, E, 'purple');
        note(s, F, 'height at 1:  2.72', 0, 'gold', 3.8);
        note(s, F, 'slope at 1:   2.72', 1, 'teal', 3.8);
      });
      s.alpha(three, () => {
        F.fn((x) => Math.exp(3 * x), 'orange', 0.8);
        s.alpha(after(s, 'eax', 0.55), () => F.tangent(0, 1, 3, 'teal', -0.55, 1.2, 0.6));
        F.dot(0, 1, 'orange');
        s.alpha(after(s, 'eax', 0.6), () => {
          note(s, F, 'at 0: height 1', 0, 'orange', 3.4);
          note(s, F, '  slope 3 = 3 × 1', 1, 'teal', 3.4);
        });
        s.alpha(after(s, 'one', 0.25), () => note(s, F, `at 1: height ${E3.toFixed(2)}`, 2, 'orange', 3.4));
        s.alpha(after(s, 'one', 0.5), () => note(s, F, `  slope ${(3 * E3).toFixed(1)} ≈ 3 × ${E3.toFixed(2)}`, 3, 'teal', 3.4));
      });
      s.show('g3', three * (1 - lnA), F.frac(1.0, 5.6));
    });
    s.show('eax', after(s, 'rule', 0.05) * (1 - lnA));
    s.show('eaxAny', after(s, 'rule', 0.6) * (1 - lnA));
    s.alpha(lnA, () => {
      const F = new Frame(s, r, [-0.4, 5.2, -2.4, 2.1]);
      F.axes();
      F.fn(Math.log, 'purple', 0.8, 0.02, 5.2);
      F.tangent(2, Math.log(2), 0.5, 'teal', 0.8, 3.4, 0.6);
      F.dot(2, Math.log(2), 'purple');
      note(s, F, 'slope at 2:  1/2', 0, 'teal', 3.8);
    });
    s.show('ln', s.ease('ln', 0.6, 0.6));
  },
};

// The worked mix: each term's derivative, then the whole.
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
    vq2: { tex: String.raw`\symf'(2) = 2 \cdot 2 + \dfrac{6}{2} = 4 + 3 = 7`, x: 0.5, y: 0.7, size: 5.4 },
  },
  draw(s) {
    const one = s.ease('p1', 0.6) * (1 - s.ease('p2', 0.5));
    const op = (t: string, x: number, y: number, a: number) => s.alpha(a, () => s.text(t, x * s.w, y * s.h, { size: 5.2, color: s.c('--ink-3') }));
    TERMS.forEach((_, i) => s.show(`t${i}`, one));
    op('+', (T_COLS[0]! + T_COLS[1]!) / 2, 0.2, one);
    op('−', (T_COLS[1]! + T_COLS[2]!) / 2, 0.2, one);
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
    const two = s.ease('p2', 0.6, 0.3);
    s.show('q2', two);
    s.show('dq2', two * after(s, 'a2', 0.1));
    s.show('vq2', two * after(s, 'a2', 0.55));
  },
};

export const scenes: Record<string, SceneDef> = { explog, try: tryIt };

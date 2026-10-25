import { type Scene, type SceneDef, clamp01, lerp } from '../../../lecture/scene';
import { Frame, inset, note } from '../draw';

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

const power: SceneDef = {
  draw(s) {
    powerRow(s, s.h * 0.2, '2', '', s.ease('sq', 0.6), s.ease('sq', 1.4, 2.4));
    powerRow(s, s.h * 0.42, '3', '2', s.ease('cube', 0.5), s.ease('cube', 1.2, 0.4));
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

interface TermsCfg {
  terms: string[];
  /** Operators between terms, e.g. ['+', '+'] or ['−', '+']. */
  ops: string[];
  derivs: string[];
  dOps: string[];
  /** A note beside each arrow. */
  notes: string[];
  whole: string;
  /** Beat at which column i turns into its derivative; the last entry shows the whole result. */
  beats: string[];
  /** The beat at which the terms first appear. */
  first: string;
}

const COLS = [0.2, 0.5, 0.8];

/** A row of terms, each with an arrow down to its derivative, then the whole result. */
function termsScene(c: TermsCfg): SceneDef {
  const marks: SceneDef['marks'] = {};
  c.terms.forEach((t, i) => (marks[`t${i}`] = { tex: t, x: COLS[i]!, y: 0.2, size: 6 }));
  c.derivs.forEach((t, i) => (marks[`d${i}`] = { tex: t, x: COLS[i]!, y: 0.5, size: 6 }));
  marks.whole = { tex: c.whole, x: 0.5, y: 0.78, size: 6 };
  return {
    marks,
    draw(s) {
      const a = s.ease(c.first, 0.6);
      c.terms.forEach((_, i) => s.show(`t${i}`, a));
      const op = (t: string, x: number, y: number, al: number) => s.alpha(al, () => s.text(t, x, y, { size: 5.4, color: s.c('--ink-3') }));
      c.ops.forEach((t, i) => op(t, ((COLS[i]! + COLS[i + 1]!) / 2) * s.w, s.h * 0.2, a));
      const on = c.beats.slice(0, 3).map((b) => s.ease(b, 0.6, 0.3));
      on.forEach((d, i) => {
        const x = COLS[i]! * s.w;
        s.alpha(d, () => {
          s.arrow(x, s.h * 0.28, x, s.h * 0.42, s.c('--ink-3'), 0.4, 2);
          s.text(c.notes[i]!, x + 2.5 * s.u, s.h * 0.35, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-3'), halo: true });
        });
        s.show(`d${i}`, d * (i === 2 ? 0.55 : 1));
      });
      c.dOps.forEach((t, i) => op(t, ((COLS[i]! + COLS[i + 1]!) / 2) * s.w, s.h * 0.5, Math.min(on[i]!, on[i + 1]!)));
      const w = s.ease(c.beats[3]!, 0.6, 0.6);
      s.alpha(w, () => s.rrect(s.w / 2 - 30 * s.u, s.h * 0.78 - 7 * s.u, 60 * s.u, 14 * s.u, 2, { fill: s.tint('purple', 0.08), stroke: s.tint('purple', 0.55), lw: 0.35 }));
      s.show('whole', w);
    },
  };
}

const sums = termsScene({
  terms: [String.raw`5\symx^{3}`, String.raw`2\symx`, '7'],
  ops: ['+', '+'],
  derivs: [String.raw`15\symx^{2}`, '2', '0'],
  dOps: ['+', '+'],
  notes: ['5 · 3x²', 'slope 2', 'flat'],
  whole: String.raw`\symf'(\symx) = 15\symx^{2} + 2`,
  beats: ['factor', 'sum', 'zero', 'whole'],
  first: 'factor',
});

const E = Math.E;

const explog: SceneDef = {
  marks: {
    eax: { tex: String.raw`e^{3\symx} \;\longrightarrow\; 3e^{3\symx}`, x: 0.09, y: 0.36, size: 5, align: 'left' },
    ln: { tex: String.raw`\ln \symx \;\longrightarrow\; \tfrac{1}{\symx}`, x: 0.6, y: 0.8, size: 5, align: 'left' },
  },
  draw(s) {
    const r = inset(s, 0.07, 0.07, 0.07);
    const lnA = s.ease('ln', 0.8);
    s.alpha(1 - lnA, () => {
      const F = new Frame(s, r, [-2.6, 2.2, -0.5, 6.4]);
      F.axes();
      F.fn(Math.exp, 'purple', 0.8);
      F.seg(1, 0, 1, E, 'gold', 0.45, [1.2, 1]);
      F.tangent(1, E, E, 'teal', 0.1, 1.9, 0.6);
      F.dot(1, E, 'purple');
      note(s, F, 'height at 1:  2.72', 0, 'gold', 3.8);
      note(s, F, 'slope at 1:   2.72', 1, 'teal', 3.8);
    });
    s.show('eax', s.ease('eax', 0.6) * (1 - lnA));
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

const example = termsScene({
  terms: [String.raw`4\symx^{3}`, String.raw`3\symx^{2}`, '5'],
  ops: ['−', '+'],
  derivs: [String.raw`12\symx^{2}`, String.raw`6\symx`, '0'],
  dOps: ['−', '+'],
  notes: ['4 · 3x²', '−3 · 2x', 'flat'],
  whole: String.raw`\symf'(\symx) = 12\symx^{2} - 6\symx`,
  beats: ['t1', 't2', 't3', 't3'],
  first: 'ask',
});

export const scenes: Record<string, SceneDef> = { power, sums, explog, example };

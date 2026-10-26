import type { Scene, SceneDef } from '../../../lecture/scene';
import { columns } from '../../draw';
import { hbar, mark, pass, word } from '../draw';

const GUESS = ['on', 'the', 'red', 'mat'];
const PICKS = ['on', 'the', 'soft', 'rug', '.'];
const OK = [true, true, false];
const TOK = { size: 3.1, h: 6.8 };

const check: SceneDef = {
  draw(s) {
    const xs = columns(s, 5, s.tall ? 14 : 16).map((x) => x + 6 * s.u);
    const lx = xs[0]! - 8 * s.u;
    const yG = s.h * 0.24;
    const yB = s.h * 0.44;
    const yP = s.h * 0.64;
    const yM = s.h * 0.75;
    const bh = s.h * 0.12;
    s.text('text so far: The cat sat', s.w / 2, s.h * 0.08, { size: 3.2, font: 'mono', weight: 600, color: s.c('--ink-2') });
    // Plain decoding first: one large pass per token.
    s.alpha(s.ease('slow', 0.6) * (1 - s.ease('draft', 0.5)), () => {
      xs.slice(0, 4).forEach((x, i) => {
        s.alpha(s.ease('slow', 0.5, 0.6 + 0.6 * i), () => {
          pass(s, x, yB, 'blue', { w: 9, h: bh / s.u, n: 3 });
          s.arrow(x, yB + bh / 2 + 0.6 * s.u, x, yP - 3.6 * s.u, s.c('--ink-3'), 0.3, 1.6);
          word(s, x, yP, PICKS[i]!, 'blue', TOK);
        });
      });
      s.text('plain decoding: one large pass per token', s.w / 2, s.h * 0.87, { size: 3, font: 'mono', color: s.c('blue') });
    });
    s.alpha(s.ease('draft', 0.5), () => s.text('small', lx, yG, { size: 2.9, font: 'mono', weight: 650, align: 'right', color: s.c('purple') }));
    GUESS.forEach((g, i) => {
      const thrown = i === 3 ? s.ease('keep', 0.6, 2.4) : 0;
      s.alpha(s.ease('draft', 0.4, 1.6 + 0.5 * i) * (1 - 0.65 * thrown), () => word(s, xs[i]!, yG, g, i === 2 ? (s.ease('compare', 0.5, 3.4) > 0 ? 'red' : 'purple') : 'purple', TOK));
    });
    s.alpha(s.ease('check', 0.6), () => {
      const l = xs[0]! - 7 * s.u;
      const r = xs[4]! + 7 * s.u;
      pass(s, (l + r) / 2, yB, 'blue', { w: (r - l) / s.u, h: bh / s.u, n: 3, on: s.win('check', 'compare') });
      s.text('large', lx, yP, { size: 2.9, font: 'mono', weight: 650, align: 'right', color: s.c('blue') });
      s.text('one pass', lx, yB, { size: 2.9, font: 'mono', weight: 650, align: 'right', color: s.c('blue') });
      xs.slice(0, 4).forEach((x) => s.arrow(x, yG + 3.6 * s.u, x, yB - bh / 2 - 0.6 * s.u, s.c('--ink-3'), 0.3, 1.6));
      xs.forEach((x, i) => {
        s.alpha(s.ease('check', 0.4, 1.2 + 0.15 * i), () => {
          s.arrow(x, yB + bh / 2 + 0.6 * s.u, x, yP - 3.6 * s.u, s.c('--ink-3'), 0.3, 1.6);
          const dim = i >= 3 ? s.ease('keep', 0.6, 2.4) * 0.65 : 0;
          s.alpha(1 - dim, () => word(s, x, yP, PICKS[i]!, i === 2 ? 'gold' : 'blue', { ...TOK, on: i === 2 ? s.ease('keep', 0.6, 1) : 0 }));
        });
      });
    });
    // Agreement, left to right, up to the first rejection.
    OK.forEach((ok, i) => s.alpha(s.ease('compare', 0.4, 0.8 + 1.3 * i), () => mark(s, ok, xs[i]!, yM, 4)));
    s.alpha(s.ease('keep', 0.6), () => {
      s.text('kept: on the soft', s.w / 2, s.h * 0.87, { size: 3.6, font: 'mono', weight: 650, color: s.c('gold') });
      s.alpha(s.ease('keep', 0.6, 3.6), () => s.text('3 tokens, 1 large pass', s.w / 2, s.h * 0.94, { size: 3, font: 'mono', color: s.c('--ink-2') }));
    });
  },
};

/** One pass drawn as its accepted prefix (✓), then the large model's own token (+1). */
function passRow(s: Scene, y: number, acc: number, k: number, a: number, label: string): void {
  const xs = columns(s, k + 1, 9).map((x) => x + 6 * s.u);
  s.alpha(a, () => {
    for (let i = 0; i <= k; i++) {
      const isAcc = i < acc;
      const isOwn = i === acc;
      const x = xs[i]!;
      if (isAcc) s.cell(x - 3.5 * s.u, y - 3 * s.u, 7 * s.u, 6 * s.u, '✓', 'purple', { on: 0.5, size: 3 });
      else if (isOwn) s.cell(x - 3.5 * s.u, y - 3 * s.u, 7 * s.u, 6 * s.u, '+1', 'gold', { on: 1, size: 2.8 });
      else s.cell(x - 3.5 * s.u, y - 3 * s.u, 7 * s.u, 6 * s.u, '', '--ink-3', { on: 0 });
    }
    s.text(label, xs[0]! - 6 * s.u, y, { size: 3, font: 'mono', weight: 650, align: 'right', color: s.c('--ink-2') });
  });
}

const YIELDS = [3, 5, 1, 3];

const count: SceneDef = {
  marks: {
    acc: { tex: String.raw`\text{keep with chance } \min\!\left(1,\ \dfrac{p_{\text{large}}}{p_{\text{small}}}\right)`, x: 0.5, y: 0.62, size: 4.4 },
  },
  draw(s) {
    const top = 1 - s.ease('speed', 0.6);
    s.alpha(top, () => {
      passRow(s, s.h * 0.2, 2, 4, s.ease('rule', 0.6), '2 + 1');
      passRow(s, s.h * 0.33, 0, 4, s.ease('rule', 0.6, 2.5), '0 + 1');
      passRow(s, s.h * 0.46, 4, 4, s.ease('all', 0.6), '4 + 1');
      s.alpha(s.ease('all', 0.6, 1), () => s.text('all accepted: the extra pick is free', s.w / 2, s.h * 0.58, { size: 3, font: 'mono', color: s.c('gold') }));
    });
    // Twelve tokens: twelve plain passes, or four speculative ones.
    s.alpha(s.ease('speed', 0.6) * (1 - 0.6 * s.ease('same', 0.6)) * (1 - s.ease('sample', 0.5)), () => {
      const l = s.w / 2 - 40 * s.u;
      const cw = 80 / 12;
      s.text('plain decoding: 12 passes', l, s.h * 0.14, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3') });
      for (let i = 0; i < 12; i++) s.cell(l + i * cw * s.u, s.h * 0.2, (cw - 0.8) * s.u, 6 * s.u, '1', 'slate', { size: 2.6 });
      s.text('speculative: 4 passes', l, s.h * 0.34, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3') });
      let at = 0;
      YIELDS.forEach((n, i) => {
        s.alpha(s.ease('speed', 0.4, 0.8 + 0.5 * i), () => s.cell(l + at * cw * s.u, s.h * 0.4, (n * cw - 0.8) * s.u, 6 * s.u, String(n), 'gold', { on: 0.6, size: 3 }));
        at += n;
      });
      s.alpha(s.ease('speed', 0.6, 3), () => s.text('12 ÷ 4 = 3 times fewer large passes', s.w / 2, s.h * 0.55, { size: 3.4, font: 'mono', weight: 650, color: s.c('gold') }));
    });
    s.alpha(s.win('same', 'sample'), () => {
      s.text('greedy: each kept token is the large model\'s pick', s.w / 2, s.h * 0.68, { size: 3, font: 'mono', color: s.c('blue') });
    });
    // One sampled guess: the draft's and the large model's probability for it.
    s.alpha(s.ease('sample', 0.6, 0.4), () => {
      const x0 = s.w / 2 - 16 * s.u;
      const full = 50 * s.u;
      s.text('sampling: is the guess red kept?', s.w / 2, s.h * 0.12, { size: 3.1, font: 'mono', weight: 600, color: s.c('--ink-2') });
      s.alpha(s.ease('sample', 0.6, 2.2), () => {
        s.text('draft p(red)', x0 - 2 * s.u, s.h * 0.23, { size: 2.9, font: 'mono', align: 'right', color: s.c('purple') });
        hbar(s, x0, s.h * 0.23, full * 0.6 * s.ease('sample', 0.8, 2.4), 'purple', '0.6');
      });
      s.alpha(s.ease('sample', 0.6, 4.2), () => {
        s.text('large p(red)', x0 - 2 * s.u, s.h * 0.33, { size: 2.9, font: 'mono', align: 'right', color: s.c('blue') });
        hbar(s, x0, s.h * 0.33, full * 0.3 * s.ease('sample', 0.8, 4.4), 'blue', '0.3');
      });
      s.alpha(s.ease('sample', 0.6, 6.5), () => s.text('kept with chance 0.3 / 0.6 = 0.5', s.w / 2, s.h * 0.45, { size: 3.4, font: 'mono', weight: 650, color: s.c('gold') }));
    });
    s.show('acc', s.ease('cap', 0.6, 0.4));
    s.alpha(s.ease('cap', 0.6, 4), () => s.text('large ≥ draft: always kept', s.w / 2, s.h * 0.73, { size: 3, font: 'mono', color: s.c('--ink-3') }));
    s.alpha(s.ease('resid', 0.6, 0.4), () => s.text('on a rejection, draw from what is left', s.w / 2, s.h * 0.83, { size: 3, font: 'mono', color: s.c('blue') }));
    s.alpha(s.ease('resid', 0.6, 4), () => s.text('every token: the large model\'s probabilities', s.w / 2, s.h * 0.9, { size: 3, font: 'mono', weight: 650, color: s.c('gold') }));
  },
};

export const scenes: Record<string, SceneDef> = { check, count };

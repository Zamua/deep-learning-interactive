import type { Scene, SceneDef } from '../../../lecture/scene';
import { bars, columns } from '../../draw';
import { box, chip, fmt, rich } from '../draw';

const TEXT = ['h', 'e', 'l', 'l', 'o'];
const VOCAB = ['h', 'e', 'l', 'o'];
const S = [0.2, 1.8, 1.3, 0.2];
const P = (() => {
  const e = S.map(Math.exp);
  const t = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / t);
})();
const PY = [0.5, 0.4, 0.6, 0.8];
const LOSS = PY.map((p) => Math.round(-Math.log(p) * 100) / 100);
const TOTAL = LOSS.reduce((a, b) => a + b, 0);

/** Five letter positions; the four steps sit under the first four. */
const slots = (s: Scene) => columns(s, 5, 22);

const shift: SceneDef = {
  draw(s) {
    const xs = slots(s);
    const yT = s.h * 0.12;
    const yB = s.h * 0.28;
    const yI = s.h * 0.44;
    const sh = s.ease('shift', 1.2, 1);
    const mem = s.win('memory', undefined);
    const hot = (i: number) => (i === 2 || i === 3 ? mem : 0);
    // Inputs stay; the last letter is never an input.
    TEXT.forEach((c, i) => s.alpha(i < 4 ? 1 : 1 - sh, () => chip(s, xs[i]!, yI, c, 'orange', { on: hot(i) })));
    // Targets: the text again, moved up and one step left.
    TEXT.slice(1).forEach((c, i) => {
      s.alpha(sh, () => chip(s, xs[i + 1]! + (xs[i]! - xs[i + 1]!) * sh, yI + (yT - yI) * sh, c, 'gold', { on: hot(i) }));
    });
    s.alpha(s.ease('shift', 0.6, 2.4), () => {
      s.text('targets', xs[4]!, yT, { size: 3, font: 'mono', color: s.c('gold') });
      s.text('inputs', xs[4]!, yI, { size: 3, font: 'mono', color: s.c('orange') });
    });
    s.alpha(sh, () => {
      for (let i = 0; i < 4; i++) {
        box(s, xs[i]!, yB, '', 'blue', { w: 10, h: 7, on: hot(i) });
        s.arrow(xs[i]!, yI - 3.5 * s.u, xs[i]!, yB + 3.5 * s.u, s.c('--ink-3'), 0.3, 1.6);
        s.arrow(xs[i]!, yB - 3.5 * s.u, xs[i]!, yT + 3.5 * s.u, s.c('--ink-3'), 0.3, 1.6);
        if (i < 3) s.arrow(xs[i]! + 5 * s.u, yB, xs[i + 1]! - 5 * s.u, yB, s.c(mem > 0.1 && i === 2 ? 'gold' : '--ink-3'), 0.35 + 0.2 * mem, 1.6);
      }
      s.text('h', xs[4]! - 3 * s.u, yB, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
    });
    // One step's output: scores, then probabilities, over the vocabulary.
    const out = s.ease('scores', 0.6) * (1 - s.ease('memory', 0.6));
    s.alpha(out, () => {
      const bx = columns(s, 4, 16);
      const base = s.h * 0.86;
      const pr = s.ease('softmax', 0.9);
      s.text(pr > 0.5 ? 'p after reading h' : 's after reading h', s.w / 2, s.h * 0.56, { size: 3.2, font: 'mono', color: s.c('--ink-2') });
      s.alpha(1 - pr, () => bars(s, bx, base, S, 'purple', { max: 2, height: 18, w: 9, fmt: (v) => fmt(v, 1) }));
      s.alpha(pr, () => bars(s, bx, base, P, 'teal', { max: 0.6, height: 18, w: 9, fmt: (v) => v.toFixed(1), hi: [0, s.ease('softmax', 0.6, 2), 0, 0] }));
      VOCAB.forEach((c, j) => s.text(c, bx[j]!, base + 4 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c(j === 1 && pr > 0.5 ? 'gold' : '--ink-2') }));
    });
    s.alpha(s.ease('memory', 0.6, 1), () => {
      s.text('same input l, different targets', s.w / 2, s.h * 0.62, { size: 3.4, color: s.c('--ink-2') });
      s.text('h carries what came before', s.w / 2, s.h * 0.72, { size: 3.4, color: s.c('gold') });
    });
  },
};

const loss: SceneDef = {
  marks: {
    f: { tex: String.raw`\symL = \sum_t -\ln \symp_t[\symy_t]`, x: 0.5, y: 0.9, size: 4.4 },
  },
  draw(s) {
    const xs = columns(s, 4, 22).map((x) => x + 12 * s.u);
    const yT = s.h * 0.1;
    const base = s.h * 0.5;
    const yL = s.h * 0.6;
    const shown = (i: number) => (i === 0 ? 1 : s.ease('all', 0.5, 0.6 * i));
    s.text('target', xs[0]! - 8 * s.u, yT, { size: 3, font: 'mono', align: 'right', color: s.c('gold') });
    TEXT.slice(1).forEach((c, i) => chip(s, xs[i]!, yT, c, 'gold', { on: i === 0 ? s.win('step', 'all') : 0 }));
    for (let i = 0; i < 4; i++) {
      s.alpha(shown(i), () => {
        bars(s, [xs[i]!], base, [PY[i]!], 'teal', { max: 1, height: 26, w: 9, fmt: (v) => fmt(v, 1), hi: [i === 0 ? s.win('step', 'all') : 0] });
        s.alpha(i === 0 ? s.ease('step', 0.6, 2.5) : 1, () => {
          s.cell(xs[i]! - 6 * s.u, yL - 4 * s.u, 12 * s.u, 8 * s.u, fmt(LOSS[i]!, 2), 'red', { on: s.win('total', undefined), size: 3.2 });
        });
      });
    }
    s.alpha(s.ease('step', 0.6, 1), () => {
      s.text('p(target)', xs[0]! - 8 * s.u, base - 8 * s.u, { size: 2.8, font: 'mono', align: 'right', color: s.c('teal') });
      s.text('−ln p', xs[0]! - 8 * s.u, yL, { size: 3, font: 'mono', align: 'right', color: s.c('red') });
    });
    s.alpha(s.ease('total', 0.6), () => {
      rich(s, [['L = ', 'red'], [LOSS.map((v) => fmt(v, 2)).join(' + '), '--ink-2'], [` = ${TOTAL.toFixed(2)}`, 'red']], s.w / 2, s.h * 0.72, { size: 3.4, weight: 600 });
      rich(s, [['per step: ', '--ink-3'], [`${TOTAL.toFixed(2)} / 4 ≈ ${(TOTAL / 4).toFixed(2)}`, '--ink-2']], s.w / 2, s.h * 0.79, { size: 3.2 });
    });
    s.show('f', s.ease('total', 0.6, 2));
  },
};

export const scenes: Record<string, SceneDef> = { shift, loss };

import type { Scene, SceneDef } from '../../../lecture/scene';
import { bars, columns } from '../../draw';
import { after } from '../../draw';
import { rich } from '../../linear-algebra/draw';
import { caption } from '../../networks/draw';
import { box, chip, fmt } from '../draw';

const TEXT = ['h', 'e', 'l', 'l', 'o'];
const VOCAB = ['h', 'e', 'l', 'o'];
/** Scores after reading h, and their softmax (rounded to one place, as the listing shows). */
const S = [0.2, 1.8, 1.3, 0.2];
const P0 = [0.1, 0.5, 0.3, 0.1];
/** Each step's guess over h, e, l, o; the target's entry is the listing's p_y. */
const ROWS = [P0, [0.1, 0.2, 0.4, 0.3], [0.05, 0.1, 0.6, 0.25], [0.05, 0.05, 0.1, 0.8]];
const TARGET = TEXT.slice(1).map((c) => VOCAB.indexOf(c));
const PY = ROWS.map((r, i) => r[TARGET[i]!]!);
const LOSS = PY.map((p) => Math.round(-Math.log(p) * 100) / 100);
const TOTAL = LOSS.reduce((a, b) => a + b, 0);
/** The mean of the unrounded losses: 0.586. */
const MEAN = PY.reduce((a, p) => a - Math.log(p), 0) / 4;

/** Who did it, and when: small, in a corner of the stage. */
function cite(s: Scene, text: string, a: number, y = 5) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, y < 0 ? s.h + y * s.u : y * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** The vocabulary as chips with their ids beneath. */
function vocabRow(s: Scene, y: number, o: { hi?: number; gap?: number } = {}) {
  const xs = columns(s, 4, o.gap ?? 13);
  VOCAB.forEach((c, j) => {
    chip(s, xs[j]!, y, c, 'slate', { on: j === 1 ? (o.hi ?? 0) : 0 });
    s.text(String(j), xs[j]!, y + 6.5 * s.u, { size: 3, font: 'mono', color: s.c('--ink-3') });
  });
  return xs;
}

const game: SceneDef = {
  draw(s) {
    const xs = columns(s, 5, 13);
    const y = s.h * 0.2;
    // The text so far, then the letter to guess.
    TEXT.slice(0, 4).forEach((c, i) => s.alpha(s.ease('game', 0.4, 0.4 * i), () => chip(s, xs[i]!, y, c, 'orange', { w: 10, h: 9, size: 4.2 })));
    const reveal = after(s, 'game', 0.8);
    s.alpha(s.ease('game', 0.4, 1.6) * (1 - reveal), () => chip(s, xs[4]!, y, '?', '--ink-3', { w: 10, h: 9, size: 4.2 }));
    s.alpha(reveal, () => chip(s, xs[4]!, y, 'o', 'gold', { w: 10, h: 9, size: 4.2, on: 1 - s.ease('shannon', 0.6) }));

    cite(s, 'Shannon, 1951', s.win('shannon', 'free'));
    s.alpha(s.win('shannon', 'free'), () => {
      caption(s, 'how well people guess', s.h * 0.44, '--ink-2', 3.6);
      caption(s, '= how predictable English is', s.h * 0.52, '--ink-2', 3.6);
      caption(s, 'entropy: the average surprise per letter', s.h * 0.66, 'teal', 3.4);
    });

    // The answer key the text carries: every prefix, and the letter after it.
    const key = s.win('free', 'vocab');
    s.alpha(key, () => {
      const lx = s.w / 2 + 2 * s.u;
      for (let i = 0; i < 4; i++) {
        const ry = s.h * 0.4 + i * 8 * s.u;
        s.alpha(s.ease('free', 0.4, 2.5 + 0.35 * i), () => {
          s.text(TEXT.slice(0, i + 1).join(''), lx - 6 * s.u, ry, { size: 3.6, font: 'mono', weight: 600, align: 'right', color: s.c('orange') });
          s.text('→', lx, ry, { size: 3.6, font: 'mono', color: s.c('--ink-3') });
          s.text(TEXT[i + 1]!, lx + 6 * s.u, ry, { size: 3.6, font: 'mono', weight: 650, align: 'left', color: s.c('gold') });
        });
      }
    });
    s.alpha(s.win('free', 'lm'), () => caption(s, 'no labels: the text is its own answer key', s.h * 0.86, '--ink-2', 3.4));
    s.alpha(s.win('lm', 'vocab'), () => caption(s, 'language model: predicts what comes next', s.h * 0.86, 'purple', 3.4));

    s.alpha(s.ease('vocab', 0.6, 2), () => {
      s.text('vocabulary', s.w / 2, s.h * 0.44, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
      vocabRow(s, s.h * 0.56);
      s.text('ids', columns(s, 4, 13)[0]! - 9 * s.u, s.h * 0.56 + 6.5 * s.u, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
    });
    s.alpha(s.ease('vocab', 0.6, 6), () => caption(s, 'V = 4', s.h * 0.76, 'slate', 3.8));
  },
};

const shift: SceneDef = {
  draw(s) {
    const xs = columns(s, 5, 22);
    const yT = s.h * 0.12;
    const yB = s.h * 0.28;
    const yI = s.h * 0.44;
    const sh = s.ease('shift', 1.2, 1);
    const mem = s.win('memory', undefined);
    const hot = (i: number) => (i === 2 || i === 3 ? mem : 0);
    // The whole text arrives as inputs; the o drops out, since nothing follows it.
    const last = after(s, 'inputs', 0.7);
    TEXT.forEach((c, i) => s.alpha(s.ease('inputs', 0.4, 0.3 * i) * (i < 4 ? 1 : (1 - 0.8 * last) * (1 - s.ease('shift', 0.6))), () => chip(s, xs[i]!, yI, c, 'orange', { on: hot(i) })));
    // Targets: the text again, moved up and one step left.
    TEXT.slice(1).forEach((c, i) => {
      s.alpha(sh, () => chip(s, xs[i + 1]! + (xs[i]! - xs[i + 1]!) * sh, yI + (yT - yI) * sh, c, 'gold', { on: Math.max(hot(i), i === 0 ? s.win('y', 'memory') : 0) }));
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
      s.text('h', xs[4]! - 3 * s.u, yB, { size: 3.2, font: 'mono', color: s.c(mem > 0.1 ? 'gold' : '--ink-3') });
    });
    // Step numbers, then the first target as an id.
    s.alpha(s.ease('y', 0.6), () => {
      for (let i = 0; i < 4; i++) s.text(`t = ${i}`, xs[i]!, yI + 7.5 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
    });
    s.alpha(s.win('y', 'memory'), () => {
      vocabRow(s, s.h * 0.66, { hi: s.ease('y', 0.6, 3) });
      s.alpha(s.ease('y', 0.6, 3), () => rich(s, [['y₀ = 1', 'gold'], ['   the target e, id 1', '--ink-2']], s.w / 2, s.h * 0.86, { size: 3.4, weight: 600 }));
    });
    s.alpha(s.ease('memory', 0.6, 1), () => {
      s.text('same input l, different targets', s.w / 2, s.h * 0.64, { size: 3.4, color: s.c('--ink-2') });
      s.text('h carries what came before', s.w / 2, s.h * 0.74, { size: 3.4, color: s.c('gold') });
    });
  },
};

/** One step's guess as a small bar chart over the vocabulary, its target's bar outlined. */
function miniChart(s: Scene, x: number, base: number, row: number[], target: number, hi: number) {
  const gap = 4.4 * s.u;
  const xs = row.map((_, j) => x + (j - 1.5) * gap);
  s.line(xs[0]! - 2.6 * s.u, base, xs[3]! + 2.6 * s.u, base, s.c('--axis'), 0.3);
  row.forEach((v, j) => {
    const hh = Math.max(0.5 * s.u, v * 20 * s.u);
    const on = j === target ? hi : 0;
    s.rrect(xs[j]! - 1.6 * s.u, base - hh, 3.2 * s.u, hh, 0.5, { fill: s.tint(on ? 'gold' : 'teal', 0.3 + 0.4 * on), stroke: s.tint(on ? 'gold' : 'teal', 0.6 + 0.4 * on), lw: 0.25 + 0.15 * on });
    s.text(VOCAB[j]!, xs[j]!, base + 3 * s.u, { size: 2.6, font: 'mono', weight: j === target ? 650 : 400, color: s.c(j === target && hi > 0.5 ? 'gold' : '--ink-3') });
  });
}

const guess: SceneDef = {
  draw(s) {
    const every = s.ease('every', 0.8);
    // One step: the memory, its scores, then their softmax.
    s.alpha(1 - every, () => {
      const bx = columns(s, 4, 16);
      const base = s.h * 0.5;
      const hy = s.h * 0.8;
      const pr = s.ease('softmax', 0.9);
      const idHi = s.ease('id', 0.6);
      box(s, s.w / 2, hy, 'h', 'gold', { w: 12, h: 8 });
      s.alpha(s.ease('scores', 0.6, 1), () => {
        s.arrow(s.w / 2, hy - 4.5 * s.u, s.w / 2, base + 12 * s.u, s.c('--ink-3'), 0.35, 1.8);
        s.text('W_hy', s.w / 2 + 2.5 * s.u, (hy + base) / 2 + 6 * s.u, { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c('blue'), halo: true });
      });
      s.alpha(s.ease('scores', 0.6, 2.5), () => {
        s.text(pr > 0.5 ? 'p: next-letter probabilities' : 's: one score per token', s.w / 2, s.h * 0.12, { size: 3.3, font: 'mono', color: s.c(pr > 0.5 ? 'teal' : 'purple') });
        s.alpha(1 - pr, () => bars(s, bx, base, S, 'purple', { max: 2, height: 22, w: 9, fmt: (v) => fmt(v, 1) }));
        s.alpha(pr, () => bars(s, bx, base, P0, 'teal', { max: 0.6, height: 22, w: 9, fmt: (v) => v.toFixed(1), hi: [0, s.ease('softmax', 0.6, 2), 0, 0] }));
        VOCAB.forEach((c, j) => {
          const t = j === 1 && pr > 0.5;
          s.text(c, bx[j]!, base + 4 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c(t ? 'gold' : '--ink-2') });
          s.text(String(j), bx[j]!, base + 8.5 * s.u, { size: 2.8, font: 'mono', color: s.c(j === 1 ? (idHi > 0.5 ? 'gold' : '--ink-3') : '--ink-3') });
        });
      });
      s.alpha(s.win('V', 'softmax'), () => caption(s, 'V = 4 scores, one per token', s.h * 0.93, 'purple', 3.4));
      s.alpha(s.win('softmax', 'id'), () => caption(s, 'after h, the target e gets 0.5', s.h * 0.93, 'teal', 3.4));
      s.alpha(idHi, () => {
        s.rrect(bx[1]! - 5.6 * s.u, base - 0.5 * 22 * s.u / 0.6 - 6 * s.u, 11.2 * s.u, 0.5 * 22 * s.u / 0.6 + 16 * s.u, 1.2, { stroke: s.c('gold'), lw: 0.45 });
        caption(s, 'e has id 1, so read p[1] = 0.5', s.h * 0.93, 'gold', 3.4);
      });
    });
    // Every step: its own guess over the vocabulary, its own target.
    s.alpha(every, () => {
      const xs = columns(s, 4, s.tall ? 25 : 30);
      const base = s.h * 0.56;
      const by = s.h * 0.72;
      const iy = s.h * 0.86;
      s.text('every step: a guess over h e l o', s.w / 2, s.h * 0.12, { size: 3.3, font: 'mono', color: s.c('--ink-2') });
      for (let i = 0; i < 4; i++) {
        const on = s.ease('every', 0.5, 1.2 + 0.4 * i);
        s.alpha(on, () => {
          miniChart(s, xs[i]!, base, ROWS[i]!, TARGET[i]!, on);
          s.text(`→ ${TEXT[i + 1]}`, xs[i]!, s.h * 0.27, { size: 3.4, font: 'mono', weight: 650, color: s.c('gold') });
        });
        box(s, xs[i]!, by, '', 'blue', { w: 10, h: 7 });
        s.arrow(xs[i]!, by - 3.5 * s.u, xs[i]!, base + 5 * s.u, s.c('--ink-3'), 0.3, 1.5);
        if (i < 3) s.arrow(xs[i]! + 5 * s.u, by, xs[i + 1]! - 5 * s.u, by, s.c('--ink-3'), 0.3, 1.5);
        chip(s, xs[i]!, iy, TEXT[i]!, 'orange');
        s.arrow(xs[i]!, iy - 3.5 * s.u, xs[i]!, by + 3.5 * s.u, s.c('--ink-3'), 0.3, 1.5);
      }
    });
  },
};

/** Elman's letter stream: words run together, with the error at each letter sketched high at each word's start. */
const STREAM = 'manyyearsago'.split('');
const ERR = [0.9, 0.6, 0.4, 0.3, 0.85, 0.55, 0.35, 0.3, 0.25, 0.9, 0.5, 0.3];

function stream(s: Scene, a: number) {
  s.alpha(a, () => {
    const gap = (s.tall ? 7.4 : 8) * s.u;
    const x0 = s.w / 2 - ((STREAM.length - 1) / 2) * gap;
    const base = s.h * 0.86;
    s.text('error at each letter (sketch)', s.w / 2, s.h * 0.69, { size: 3, font: 'mono', color: s.c('--ink-2'), halo: true });
    s.line(x0 - 3 * s.u, base, x0 + (STREAM.length - 1) * gap + 3 * s.u, base, s.c('--axis'), 0.3);
    STREAM.forEach((c, i) => {
      const x = x0 + i * gap;
      const start = i === 0 || i === 4 || i === 9;
      const on = s.ease('elman', 0.3, 2 + 0.25 * i);
      s.alpha(on, () => {
        const hh = ERR[i]! * 13 * s.u;
        s.rrect(x - 2 * s.u, base - hh, 4 * s.u, hh, 0.5, { fill: s.tint('red', start ? 0.6 : 0.3), stroke: s.tint('red', start ? 1 : 0.5), lw: 0.25 });
      });
      s.text(c, x, base + 3.5 * s.u, { size: 3.2, font: 'mono', weight: start ? 650 : 400, color: s.c(start ? 'red' : '--ink-2') });
    });
  });
}

const loss: SceneDef = {
  marks: {
    f: { tex: String.raw`\symL = \sum_t -\ln \symp_t[\symy_t]`, x: 0.5, y: 0.9, size: 4.4 },
  },
  draw(s) {
    const xs = columns(s, 4, 22).map((x) => x + 12 * s.u);
    const yT = s.h * 0.12;
    const base = s.h * 0.5;
    const yL = s.h * 0.6;
    const shown = (i: number) => (i === 0 ? 1 : s.ease('all', 0.5, 0.6 * i));
    const dim = 1 - 0.7 * s.win('elman', 'total');
    s.alpha(dim, () => {
      s.text('target', xs[0]! - 8 * s.u, yT, { size: 3, font: 'mono', align: 'right', color: s.c('gold') });
      TEXT.slice(1).forEach((c, i) => chip(s, xs[i]!, yT, c, 'gold', { on: i === 0 ? s.win('step', 'all') : i === 3 ? s.win('all', 'elman') * s.ease('all', 0.5, 2.5) : 0 }));
      for (let i = 0; i < 4; i++) {
        s.alpha(shown(i), () => {
          bars(s, [xs[i]!], base, [PY[i]!], 'teal', { max: 1, height: 26, w: 9, fmt: (v) => fmt(v, 1), hi: [i === 0 ? s.win('step', 'all') : 0] });
          s.alpha(i === 0 ? s.ease('step', 0.6, 4) : 1, () => {
            s.cell(xs[i]! - 6 * s.u, yL - 4 * s.u, 12 * s.u, 8 * s.u, fmt(LOSS[i]!, 2), 'red', { on: s.win('total', undefined), size: 3.2 });
          });
        });
      }
      s.alpha(s.ease('step', 0.6, 1), () => {
        s.text('p(target)', xs[0]! - 8 * s.u, base - 8 * s.u, { size: 2.8, font: 'mono', align: 'right', color: s.c('teal') });
        s.text('Lₜ = −ln p', xs[0]! - 8 * s.u, yL, { size: 2.8, font: 'mono', align: 'right', color: s.c('red') });
      });
    });
    stream(s, s.win('elman', 'total'));
    cite(s, 'Elman, 1990', s.win('elman', 'total'), -5);
    s.alpha(s.ease('total', 0.6), () => {
      rich(s, [['L = ', 'red'], [LOSS.map((v) => fmt(v, 2)).join(' + '), '--ink-2'], [` = ${TOTAL.toFixed(2)}`, 'red']], s.w / 2, s.h * 0.72, { size: 3.4, weight: 600 });
    });
    s.alpha(s.ease('mean', 0.6), () => {
      rich(s, [['per step: ', '--ink-3'], [`${TOTAL.toFixed(2)} / 4 ≈ ${MEAN.toFixed(2)}`, '--ink-2']], s.w / 2, s.h * 0.79, { size: 3.2 });
    });
    s.show('f', s.ease('sum', 0.6, 0.4));
  },
};

export const scenes: Record<string, SceneDef> = { game, shift, guess, loss };

import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01 } from '../../../lecture/scene';
import { after } from '../../networks/draw';
import { box, chip, rich, type Ink } from '../draw';

const SRC = ['je', 'suis', 'étudiant'];
const TGT = ['I', 'am', 'a', 'student'];
const OUT = [...TGT, '<end>'];
const IN = ['<start>', ...TGT];

/** A word chip wide enough for its word. */
const word = (s: Scene, x: number, y: number, t: string, k: Ink, on = 0) => chip(s, x, y, t, k, { w: Math.max(8, 2.2 + t.length * 1.75), h: 6.5, size: 2.8, on });

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number, y = 5) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, y * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

function caption(s: Scene, text: string, y: number, k: Ink = '--ink-2', size = 3.3) {
  s.text(text, s.w / 2, y, { size, font: 'mono', color: s.c(k), halo: true });
}

/** The final state: a gold circle with its name. */
function hCircle(s: Scene, x: number, y: number, r: number) {
  s.circle(x, y, r, { fill: s.tint('gold', 0.25), stroke: s.c('gold'), lw: 0.45 });
  s.text('h', x, y + 0.2 * s.u, { size: 3.6, font: 'mono', weight: 700, color: s.c('gold') });
}

/** x centers for `n` items `gap` stage units apart, centered on `cx`. */
const spread = (s: Scene, n: number, gap: number, cx = s.w / 2) => Array.from({ length: n }, (_, i) => cx + (i - (n - 1) / 2) * gap * s.u);

// ---- the problem: three words in, four out

const lengths: SceneDef = {
  draw(s) {
    const u = s.u;
    // The sentence pair, word for word.
    const pair = 1 - s.ease('one', 0.6);
    s.alpha(pair, () => {
      const xs = spread(s, 3, 17);
      const xt = spread(s, 4, 15);
      const ys = s.h * 0.3;
      const yt = s.h * 0.58;
      SRC.forEach((t, i) => word(s, xs[i]!, ys, t, 'orange'));
      s.alpha(s.ease('task', 0.6, 1.5), () => {
        TGT.forEach((t, i) => word(s, xt[i]!, yt, t, 'gold'));
        s.text('3 words in', xs[0]! - 7 * u, ys - 7.5 * u, { size: 2.9, align: 'left', color: s.c('orange') });
        s.text('4 words out', xt[0]! - 6 * u, yt + 7.5 * u, { size: 2.9, align: 'left', color: s.c('gold') });
        s.text('?', s.w / 2, (ys + yt) / 2, { size: 5, weight: 600, color: s.c('--ink-3') });
      });
    });
    // One RNN: an output for every input, so the fourth word has no step.
    s.alpha(s.win('one', 'two'), () => {
      const xs = spread(s, 4, 19);
      const by = s.h * 0.48;
      for (let i = 0; i < 4; i++) {
        const last = i === 3;
        s.alpha(last ? after(s, 'one', 0.55) : s.ease('one', 0.5, 0.4 + 0.5 * i), () => {
          if (last) {
            s.ctx.save();
            s.ctx.setLineDash([1.2 * u, 1 * u]);
            s.rrect(xs[i]! - 5.5 * u, by - 4 * u, 11 * u, 8 * u, 1.6, { stroke: s.tint('red', 0.7), lw: 0.35 });
            s.ctx.restore();
            s.text('no input', xs[i]!, s.h * 0.68, { size: 2.8, font: 'mono', color: s.c('red') });
            word(s, xs[i]!, s.h * 0.28, TGT[i]!, 'red');
            return;
          }
          word(s, xs[i]!, s.h * 0.68, SRC[i]!, 'orange');
          s.arrow(xs[i]!, s.h * 0.68 - 3.25 * u, xs[i]!, by + 4 * u, s.c('--ink-3'), 0.3, 1.6);
          box(s, xs[i]!, by, '', 'blue', { w: 11, h: 8 });
          if (i > 0) s.arrow(xs[i - 1]! + 5.5 * u, by, xs[i]! - 5.5 * u, by, s.c('--ink-3'), 0.35, 1.6);
          s.arrow(xs[i]!, by - 4 * u, xs[i]!, s.h * 0.28 + 3.25 * u, s.c('--ink-3'), 0.3, 1.6);
          word(s, xs[i]!, s.h * 0.28, TGT[i]!, 'gold');
        });
      }
      s.alpha(after(s, 'one', 0.6), () => caption(s, 'one RNN: one output per token read', s.h * 0.88, 'red'));
    });
    // Two RNNs: read everything, then write as long as needed.
    s.alpha(s.ease('two', 0.6), () => {
      const cx = s.w / 2;
      const ys = s.h * 0.15;
      const ye = s.h * 0.32;
      const yh = s.h * 0.47;
      const yd = s.h * 0.63;
      const yt = s.h * 0.8;
      const ar = (y0: number, y1: number) => s.arrow(cx, y0, cx, y1, s.c('--ink-3'), 0.35, 1.8);
      spread(s, 3, 17).forEach((x, i) => word(s, x, ys, SRC[i]!, 'orange'));
      ar(ys + 4 * u, ye - 5.5 * u);
      box(s, cx, ye, 'encoder: reads it all', 'blue', { w: 50, h: 9, size: 3 });
      ar(ye + 5 * u, yh - 5 * u);
      hCircle(s, cx, yh, 4.4 * u);
      s.alpha(s.ease('two', 0.6, 1.5), () => {
        ar(yh + 5 * u, yd - 5.5 * u);
        box(s, cx, yd, 'decoder: writes', 'teal', { w: 50, h: 9, size: 3 });
        ar(yd + 5 * u, yt - 4 * u);
        spread(s, 4, 15).forEach((x, i) => word(s, x, yt, TGT[i]!, 'gold'));
      });
      s.alpha(s.win('teams', 'name'), () => caption(s, 'an RNN encoder-decoder', s.h * 0.93, '--ink-2'));
      s.alpha(s.ease('name', 0.6), () => rich(s, [['seq2seq', 'teal'], [': sequence to sequence', '--ink-2']], cx, s.h * 0.93, { size: 3.6, weight: 600 }));
    });
    cite(s, 'Cho et al. · Sutskever, Vinyals & Le · 2014', s.ease('teams', 0.6));
  },
};

// ---- the encoder reads into h; the decoder writes from it, one token per step

const readwrite: SceneDef = {
  draw(s) {
    const u = s.u;
    const ey = s.h * 0.15;
    const ex = [-30, -8, 14].map((d) => s.w / 2 + d * u);
    const hx = s.w / 2 + 34 * u;
    const r = 4.4 * u;
    const dx = [-40, -20, 0, 20, 40].map((d) => s.w / 2 + (d + 4) * u);
    const dy = s.h * 0.62;
    const outY = s.h * 0.47;
    const inY = s.h * 0.77;
    const enc = (i: number) => s.ease('enc', 0.5, 0.4 + 1.2 * i);
    const named = s.win('code', 'start');
    // The encoder reading the French.
    s.text('encoder', ex[0]! - 5 * u, ey - 7.5 * u, { size: 3, font: 'mono', align: 'left', weight: 500 + 200 * named, color: s.c(named > 0.5 ? 'blue' : '--ink-3') });
    SRC.forEach((t, i) =>
      s.alpha(enc(i), () => {
        word(s, ex[i]!, s.h * 0.29, t, 'orange');
        s.arrow(ex[i]!, s.h * 0.29 - 3.25 * u, ex[i]!, ey + 4 * u, s.c('--ink-3'), 0.3, 1.6);
        box(s, ex[i]!, ey, '', 'blue', { w: 10, h: 8, on: s.win('total', undefined) });
        const nx = i < 2 ? ex[i + 1]! - 5 * u : hx - r;
        s.arrow(ex[i]! + 5 * u, ey, nx, ey, s.c('--ink-3'), 0.35, 1.6);
      }),
    );
    s.alpha(enc(3), () => hCircle(s, hx, ey, r));
    s.alpha(s.ease('h', 0.6), () => s.text('H numbers', hx, ey + r + 3.5 * u, { size: 2.8, font: 'mono', color: s.c('gold') }));
    // The decoder, started from h.
    s.alpha(s.ease('start', 0.5), () => {
      const gx = dx[0]! - 13 * u;
      const gy = s.h * 0.38;
      const k = s.tint('gold', 0.8);
      s.line(hx, ey + r + 6 * u, hx, gy, k, 0.45);
      s.line(hx, gy, gx, gy, k, 0.45);
      s.line(gx, gy, gx, dy, k, 0.45);
      s.arrow(gx, dy, dx[0]! - 5.5 * u, dy, k, 0.45, 1.8);
      s.text('decoder', dx[0]! - 5.5 * u, inY + 7 * u, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3') });
    });
    // What the two names mean, in the room the decoder will take.
    s.alpha(named, () => {
      rich(s, [['encode', 'blue'], [': the sentence → a code, h', '--ink-2']], s.w / 2, s.h * 0.48, { size: 3.2 });
      s.alpha(after(s, 'code', 0.5), () => rich(s, [['decode', 'teal'], [': the code → words', '--ink-2']], s.w / 2, s.h * 0.58, { size: 3.2 }));
    });
    const step = (i: number) => (i === 0 ? s.ease('start', 0.5, 0.8) : i < 4 ? s.ease('feed', 0.5, 0.6 + 1.6 * (i - 1)) : s.ease('end', 0.5, 0.6));
    const written = (i: number) => (i === 0 ? s.ease('first', 0.5, 2.5) : step(i));
    const reads = s.win('reads', 'total');
    for (let i = 0; i < 5; i++) {
      s.alpha(step(i), () => {
        word(s, dx[i]!, inY, IN[i]!, i === 0 ? 'teal' : 'gold', reads);
        s.arrow(dx[i]!, inY - 3.25 * u, dx[i]!, dy + 4 * u, s.c('--ink-3'), 0.3, 1.6);
        box(s, dx[i]!, dy, '', 'teal', { w: 11, h: 8, on: Math.max(s.win('count', 'reads'), s.win('total', undefined)) });
        if (i > 0) s.arrow(dx[i - 1]! + 5.5 * u, dy, dx[i]! - 5.5 * u, dy, s.c('--ink-3'), 0.35, 1.6);
      });
      s.alpha(written(i), () => {
        s.arrow(dx[i]!, dy - 4 * u, dx[i]!, outY + 3.25 * u, s.c('--ink-3'), 0.3, 1.6);
        word(s, dx[i]!, outY, OUT[i]!, i === 4 ? 'teal' : 'gold', i === 4 ? s.win('end', 'count') : 0);
      });
      // Each written word goes back in as the next step's input.
      if (i < 4) s.alpha(step(i + 1) * 0.6 * (1 - s.ease('count', 0.6)), () => s.line(dx[i]! + 3 * u, outY + 3 * u, dx[i + 1]! - 3 * u, inY - 3.5 * u, s.tint('gold', 0.8), 0.3, [1, 1]));
    }
    // The first prediction: a probability for every token, and the argmax wins.
    s.alpha(s.win('first', 'feed'), () => {
      // In the room the later steps will take, beside step 0.
      const bx = dx[1]! + 1 * u;
      const vals: [string, number][] = [['I', 0.7], ['the', 0.15], ['a', 0.1], ['…', 0.05]];
      vals.forEach(([t, p], j) => {
        const y = dy - 4.5 * u + j * 3.2 * u;
        s.rrect(bx, y - 1.1 * u, p * 30 * u, 2.2 * u, 0.4, { fill: s.tint('teal', j === 0 ? 0.7 : 0.35) });
        s.text(t, bx - 1.5 * u, y, { size: 2.6, font: 'mono', align: 'right', color: s.c(j === 0 ? 'teal' : '--ink-2') });
      });
      s.text('p over the vocabulary: argmax I', bx - 6 * u, dy - 9 * u, { size: 2.7, font: 'mono', align: 'left', color: s.c('teal') });
    });
    const cy = s.h * 0.93;
    s.alpha(s.win('count', 'reads'), () => caption(s, '4 words + <end> = 5 decoder steps', cy, 'teal'));
    s.alpha(reads, () => caption(s, 'reads <start> + 4 words; <end> is never read', cy, 'gold', 3.1));
    s.alpha(s.ease('total', 0.6), () => rich(s, [['3', 'blue'], [' encoder + ', '--ink-2'], ['5', 'teal'], [' decoder = 8 steps', '--ink-2']], s.w / 2, cy, { size: 3.4, weight: 600 }));
  },
};

// ---- training: every step scored; teacher forcing feeds the true word

const GUESS = ['I', 'was', 'a', 'student', '<end>'];

const train: SceneDef = {
  draw(s) {
    const u = s.u;
    const dx = [-40, -20, 0, 20, 40].map((d) => s.w / 2 + d * u);
    const dy = s.h * 0.42;
    const ty = s.h * 0.2;
    const iy = s.h * 0.62;
    const test = s.ease('test', 0.8);
    const loss = s.ease('targets', 0.6);
    const miss = s.ease('mistake', 0.6, 1);
    s.alpha(1 - loss, () => s.text('targets', dx[0]! - 5 * u, ty - 6.5 * u, { size: 2.8, font: 'mono', align: 'left', color: s.c('--ink-3') }));
    s.text('inputs', dx[0]! - 5 * u, iy + 7 * u, { size: 2.8, font: 'mono', align: 'left', color: s.c('--ink-3') });
    for (let i = 0; i < 5; i++) {
      s.text(String(i), dx[i]!, dy, { size: 3, font: 'mono', weight: 600, color: s.c('teal') });
      s.rrect(dx[i]! - 5.5 * u, dy - 4 * u, 11 * u, 8 * u, 1.6, { stroke: s.tint('teal', 0.6), lw: 0.35, fill: s.tint('teal', 0.12) });
      if (i < 4) s.arrow(dx[i]! + 5.5 * u, dy, dx[i + 1]! - 5.5 * u, dy, s.c('--ink-3'), 0.35, 1.6);
      s.arrow(dx[i]!, dy - 4 * u, dx[i]!, ty + 3.25 * u, s.c('--ink-3'), 0.3, 1.6);
      word(s, dx[i]!, ty, OUT[i]!, 'gold', i === 1 ? miss * (1 - test) : 0);
      s.arrow(dx[i]!, iy - 3.25 * u, dx[i]!, dy + 4 * u, s.c('--ink-3'), 0.3, 1.6);
      // Inputs: the true previous word in training, the model's own guess at test time.
      s.alpha(1 - test, () => word(s, dx[i]!, iy, IN[i]!, i === 0 ? 'teal' : 'gold', i === 2 ? s.win('tf', 'test') : 0));
      s.alpha(test, () => word(s, dx[i]!, iy, i === 0 ? IN[0]! : GUESS[i - 1]!, i === 0 ? 'teal' : i === 2 ? 'red' : 'orange', i === 2 ? 1 : 0));
      // Each step's loss, against its own target.
      s.alpha(loss * (1 - test), () => s.text(`L${'₀₁₂₃₄'[i]}`, dx[i]!, ty - 6.5 * u, { size: 2.9, font: 'mono', weight: 650, color: s.c('red') }));
    }
    // Step 1 guesses wrong and pays for it; teacher forcing still feeds the true word.
    s.alpha(s.win('mistake', 'test') * after(s, 'mistake', 0.2), () => {
      s.text('guess: was ✗', dx[1]!, ty - 11 * u, { size: 2.9, font: 'mono', weight: 650, color: s.c('red') });
    });
    s.alpha(s.win('tf', 'test'), () => s.text('reads the true word', dx[2]!, iy + 7 * u, { size: 2.8, font: 'mono', color: s.c('gold') }));
    const cy = s.h * 0.88;
    s.alpha(s.win('training', 'targets'), () => caption(s, 'a sentence pair: the right translation is known', cy));
    s.alpha(s.win('targets', 'mistake'), () => caption(s, '5 targets, 5 cross-entropy losses', cy, 'red'));
    s.alpha(s.win('mistake', 'tf'), () => caption(s, 'step 1 pays its loss; what does step 2 read?', cy, 'red', 3.1));
    s.alpha(s.win('tf', 'test'), () => caption(s, 'teacher forcing: the true word is forced in', cy, 'gold'));
    s.alpha(test, () => caption(s, 'test time: it reads its own guesses', cy, 'orange'));
    cite(s, 'Williams & Zipser, 1989', s.win('name', 'test'));
  },
};

// ---- the bottleneck: any number of words, one fixed-size h

const SHORT = 3;
const LONG = 50;

const squeeze: SceneDef = {
  draw(s) {
    const u = s.u;
    const hx = s.w / 2;
    const hy = s.h * 0.45;
    const r = 4.6 * u;
    const width = Math.min(s.w - 16 * u, 110 * u);
    const row = (n: number, y: number, a: number, label: string) => {
      const w = Math.min(6 * u, width / n - 0.6 * u);
      const pitch = n > SHORT ? width / n : 9 * u;
      const x0 = hx - ((n - 1) / 2) * pitch;
      s.alpha(a, () => {
        for (let i = 0; i < n; i++) {
          const x = x0 + i * pitch;
          s.line(x, y + (y < hy ? 3 * u : -3 * u), hx + (x - hx) * 0.08, hy + (y < hy ? -r : r), s.tint('blue', 0.35), 0.2);
          s.rrect(x - w / 2, y - 3 * u, w, 6 * u, 0.6, { fill: s.tint('blue', 0.3), stroke: s.tint('blue', 0.8), lw: 0.25 });
        }
        s.text(label, x0 - w / 2, y + (y < hy ? -6.5 : 6.5) * u, { size: 2.9, font: 'mono', align: 'left', color: s.c('--ink-3') });
      });
    };
    row(SHORT, s.h * 0.17, 1, '3 words');
    row(LONG, s.h * 0.73, s.ease('squeeze', 0.8, 3), '50 words');
    hCircle(s, hx, hy, r);
    s.text('H numbers', hx + r + 3.5 * u, hy, { size: 2.9, font: 'mono', align: 'left', color: s.c('gold'), halo: true });
    const bt = s.ease('bottle', 0.8);
    s.alpha(bt, () => {
      s.text('the bottleneck', hx - r - 3.5 * u, hy, { size: 3.2, font: 'mono', weight: 650, align: 'right', color: s.c('red'), halo: true });
      s.circle(hx, hy, r + 1.4 * u, { stroke: s.tint('red', 0.8), lw: 0.45 });
    });
    const cy = s.h * 0.9;
    s.alpha(s.win('squeeze', 'cho') * after(s, 'squeeze', 0.5), () => caption(s, '3 words or 50: the same H numbers', cy, 'gold'));
    s.alpha(s.win('cho', 'bottle'), () => caption(s, 'longer sentences: rapidly worse translations', cy, 'red', 3.1));
    s.alpha(bt, () => caption(s, 'one fixed-size vector limits what gets through', cy, '--ink-2', 3.1));
    cite(s, 'Cho, van Merriënboer, Bahdanau & Bengio, 2014', s.win('cho', undefined));
  },
};

export const scenes: Record<string, SceneDef> = { lengths, readwrite, train, squeeze };

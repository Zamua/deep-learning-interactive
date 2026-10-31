import { type Ink, lerp, type Scene, type SceneDef } from '../../../lecture/scene';
import { cite } from '../../draw';
import { rich } from '../../linear-algebra/draw';
import { box, chip } from '../../sequences/draw';
import { note, spread } from '../draw';

const TEXT = ['cats', 'like', 'fresh', 'fish', 'daily'];
const TOK = TEXT.slice(0, 4);
const NEXT = TEXT.slice(1);
const IDS = [3, 8, 5, 2];
/** Each position's next-token probabilities over TEXT, peaked at its target. */
const P = [
  [0.1, 0.5, 0.2, 0.1, 0.1],
  [0.1, 0.1, 0.4, 0.3, 0.1],
  [0.05, 0.1, 0.1, 0.6, 0.15],
  [0.05, 0.05, 0.05, 0.05, 0.8],
];
const PY = P.map((r, i) => r[i + 1]!);
const LOSS = PY.map((p) => -Math.log(p));
const SC = P.map((r) => r.map((p) => Math.log(p) + 3.3));
const E = [
  [0.8, -0.4, 0.3],
  [-0.6, 0.9, 0.1],
  [0.2, 0.5, -0.9],
  [-0.3, -0.7, 0.6],
];
const POS = [
  [0.3, 0.1, -0.2],
  [0.1, 0.3, 0.1],
  [-0.2, 0.2, 0.3],
  [-0.3, -0.1, 0.2],
];
const X = E.map((r, i) => r.map((v, j) => v + POS[i]![j]!));
const OUT = X.map((r) => r.map((v, j) => Math.tanh(v * 1.6 + (j - 1) * 0.4)));

const cols = (s: Scene) => spread(s, 4, s.tall ? 20 : 25);

/** A token's vector: d = 3 cells stacked, shaded by value. */
function vec(s: Scene, x: number, y: number, v: number[], k: Ink, on = 0): void {
  v.forEach((z, i) => {
    const yy = y + (i - 1) * 6 * s.u;
    s.rrect(x - 4 * s.u, yy - 2.5 * s.u, 8 * s.u, 5 * s.u, 1, { fill: s.tint(k, 0.15 + 0.55 * Math.min(1, Math.abs(z))), stroke: s.tint(k, 0.55 + 0.45 * on), lw: 0.3 + 0.25 * on });
  });
}

/** Encoder and decoder boxes for the history: the 2017 translator, then the decoder alone. */
function history(s: Scene, a: number): void {
  s.alpha(a, () => {
    const cx = s.w / 2;
    const y = s.h * 0.5;
    const only = s.ease('only', 0.9, 0.4);
    const named = s.ease('gpt', 0.7, 3);
    const ex = cx - 20 * s.u;
    const dx = lerp(cx + 20 * s.u, cx, only);
    s.alpha(1 - only, () => {
      box(s, ex, y, 'encoder', 'blue', { w: 28, h: 13, size: 3.4 });
      s.arrow(ex + 14.5 * s.u, y, dx - 14.5 * s.u, y, s.c('--ink-3'), 0.4, 2.2);
      note(s, 'je suis étudiant', ex, y + 12 * s.u, 'blue', 3);
      note(s, 'reads the source', ex, y - 11 * s.u, '--ink-3', 2.8);
    });
    box(s, dx, y, '', 'purple', { w: 28, h: 13, on: named });
    s.alpha(1 - named, () => s.text('decoder', dx, y + 0.2 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c('purple') }));
    s.alpha(named, () => s.text('GPT', dx, y + 0.2 * s.u, { size: 4.2, font: 'mono', weight: 700, color: s.c('purple') }));
    s.alpha(1 - only, () => {
      note(s, 'I am a student', dx, y - 12 * s.u, 'purple', 3);
      note(s, 'writes one token at a time', dx, y + 11 * s.u, '--ink-3', 2.8);
    });
    s.alpha(only, () => {
      note(s, 'decoder-only: no encoder, nothing to translate', cx, y + 12 * s.u, '--ink-2', 3);
      note(s, 'causal attention in every block', cx, y - 12 * s.u, 'gold', 3);
    });
    s.alpha(s.ease('gpt', 0.6, 0.6), () => note(s, '7,000+ unpublished books', cx, y + 18 * s.u, '--ink-3', 3));
  });
}

const job: SceneDef = {
  draw(s) {
    const cx = s.w / 2;
    const xs = cols(s);
    const strip = spread(s, 5, s.tall ? 17 : 20);
    const yS = s.h * 0.13;
    const yI = s.h * 0.7;
    const yT = s.h * 0.34;
    const hist = s.ease('decoder', 0.7);
    const mv = s.ease('shift', 1.2, 0.4);
    s.alpha(1 - hist, () => {
      // The whole text, then two copies of it: the first four read, the last four as targets.
      s.alpha(1 - 0.75 * mv, () => TEXT.forEach((t, i) => chip(s, strip[i]!, yS, t, 'orange', { w: 14, h: 6.5, size: 3 })));
      s.alpha(mv, () => {
        TOK.forEach((t, i) => {
          chip(s, lerp(strip[i]!, xs[i]!, mv), lerp(yS, yI, mv), t, 'orange', { w: 14, h: 7, size: 3.1, on: i === 1 ? s.win('peek', 'decoder') : 0 });
          chip(s, lerp(strip[i + 1]!, xs[i]!, mv), lerp(yS, yT, mv), NEXT[i]!, 'gold', { w: 14, h: 7, size: 3.1 });
          s.text(String(i), xs[i]!, yI + 7 * s.u, { size: 2.7, font: 'mono', color: s.c('--ink-3') });
        });
      });
      // One arrow per position, from what it reads up to what it must predict.
      const pulse = s.win('once', 'peek');
      xs.forEach((x, i) =>
        s.alpha(s.ease('shift', 0.5, 2 + 0.5 * i), () => s.arrow(x, yI - 5 * s.u, x, yT + 5.5 * s.u, s.tint('gold', 0.5 + 0.5 * pulse), 0.35 + 0.25 * pulse, 2)),
      );
      s.alpha(s.ease('shift', 0.6, 2.4), () => note(s, 'targets: the text, shifted by one', cx, s.h * 0.23, 'gold', 3));
      // The danger: position 1 could look ahead at the token it must predict.
      const peek = s.win('peek', 'causal');
      s.alpha(peek, () => {
        const y = yI - 7.5 * s.u;
        s.line(xs[1]! + 2 * s.u, y, xs[2]! - 2 * s.u, y, s.c('red'), 0.4, [1.4, 1.1]);
        s.arrow(xs[2]! - 3 * s.u, y, xs[2]! - 1.5 * s.u, y + 1 * s.u, s.c('red'), 0.4, 1.8);
        note(s, 'copy?', (xs[1]! + xs[2]!) / 2, y - 3 * s.u, 'red', 2.8);
      });
      // The rule: a veil over everything after position 1, and the lines it may still use.
      const ca = s.ease('causal', 0.7, 0.4);
      s.alpha(ca, () => {
        const l = (xs[1]! + xs[2]!) / 2;
        s.rrect(l, yI - 6 * s.u, xs[3]! + 9 * s.u - l, 15 * s.u, 1.4, { fill: s.tint('--ink-3', 0.22) });
        s.line(l, yI - 7 * s.u, l, yI + 10 * s.u, s.c('red'), 0.35, [1.2, 1]);
        note(s, 'hidden from position 1', (l + xs[3]! + 9 * s.u) / 2, yI + 12.5 * s.u, 'red', 2.6);
        for (const j of [0, 1]) s.line(xs[j]!, yI - 4 * s.u, xs[1]!, yT + 5.5 * s.u, s.c('gold'), 0.4);
      });
      s.alpha(s.ease('causal', 0.6, 2.5), () => note(s, 'causal: each position sees itself and the past', cx, s.h * 0.92, '--ink-2', 3.1));
      s.alpha(s.win('once', 'causal'), () => note(s, 'all four predictions in one pass', cx, s.h * 0.92, '--ink-2', 3.1));
    });
    history(s, hist);
    cite(s, 'Vaswani et al., 2017', s.win('decoder', 'only'));
    cite(s, 'Liu et al., 2018', s.win('only', 'gpt'));
    cite(s, 'Radford, Narasimhan, Salimans & Sutskever, 2018', s.ease('gpt', 0.6));
    s.alpha(s.ease('gpt', 0.6, 3), () => note(s, 'generative pre-trained transformer', cx, s.h * 0.84, 'purple', 3.2));
  },
};

const stack: SceneDef = {
  draw(s) {
    const xs = cols(s);
    const yTok = s.h * 0.9;
    const yV = s.h * 0.68;
    const yB1 = s.h * 0.5;
    const yBN = s.h * 0.31;
    const yO = s.h * 0.14;
    const cap = s.h * 0.2;
    const em = s.ease('embed', 0.8, 0.4);
    const pa = s.ease('pos', 0.6, 0.5);
    const merge = s.ease('pos', 0.9, 3);
    const grow = s.ease('blocks', 0.7);
    TOK.forEach((t, i) => {
      chip(s, xs[i]!, yTok, t, 'orange', { w: 13, h: 6.5, size: 3 });
      s.alpha(s.ease('ids', 0.5, 1.6), () => s.text(`id ${IDS[i]}`, xs[i]!, yTok - 7.5 * s.u, { size: 2.7, font: 'mono', color: s.c('--ink-3') }));
    });
    // Each id becomes its row of E; then a position vector slides in from the side and is added.
    xs.forEach((x, i) => {
      s.alpha(em, () => vec(s, x, yV, merge > 0.5 ? X[i]! : E[i]!, merge > 0.5 ? 'green' : 'blue'));
      s.alpha(pa * (1 - merge), () => {
        vec(s, x + lerp(9, 0, merge) * s.u, yV, POS[i]!, 'teal');
        s.text('+', x + 4.5 * s.u, yV - 10.5 * s.u, { size: 3.4, font: 'mono', color: s.c('teal') });
      });
    });
    s.alpha(em, () => s.text(merge > 0.5 ? 'x' : 'E', xs[0]! - 7.5 * s.u, yV, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c(merge > 0.5 ? 'green' : 'blue') }));
    // The shape of what has been built so far, until the blocks need the space.
    const capA = 1 - grow;
    s.alpha(s.win('ids', 'embed') * capA, () => note(s, 'ids: (T,) = (4,)', s.w / 2, cap, '--ink-2', 3.3));
    s.alpha(s.win('embed', 'pos') * capA, () => note(s, 'x = E[ids]: (T, d) = (4, d)', s.w / 2, cap, 'blue', 3.3));
    s.alpha(s.ease('pos', 0.6) * capA, () => note(s, merge > 0.5 ? 'x + pos: still (4, d)' : 'pos: one vector per position', s.w / 2, cap, merge > 0.5 ? 'green' : 'teal', 3.3));
    // The blocks stack upward, each (T, d) in and (T, d) out.
    const bw = (xs[3]! - xs[0]!) / s.u + 16;
    const bx = (xs[0]! + xs[3]!) / 2;
    const caus = s.ease('causal', 0.5);
    s.alpha(grow, () => {
      box(s, bx, yB1, '', 'blue', { w: bw, h: 8 });
      s.text('⋮', bx - (bw / 2 - 6) * s.u, (yB1 + yBN) / 2, { size: 4, color: s.c('--ink-3') });
      box(s, bx, yBN, '', 'blue', { w: bw, h: 8 });
      const lx = bx - (bw / 2 - 2.5) * s.u;
      s.alpha(1 - caus * 0.6, () => {
        s.text('block 1', lx, yB1, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c('blue') });
        s.text('block N', lx, yBN, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c('blue') });
      });
    });
    s.alpha(s.ease('blocks', 0.7, 1.2), () => {
      xs.forEach((x, i) => vec(s, x, yO, OUT[i]!, 'green', i === 2 ? caus : 0));
      s.alpha(1 - caus, () => note(s, '(4, d) in, (4, d) out', bx + (bw / 2) * s.u, (yB1 + yBN) / 2, '--ink-2', 3, 'right'));
    });
    // Position 2's attention: back to 0, 1 and itself, never ahead to 3.
    s.alpha(caus * (1 - s.ease('why', 0.6, 2) * 0.5), () => {
      const y0 = yV - 9.5 * s.u;
      const y1 = yO + 9.5 * s.u;
      for (let j = 0; j < 4; j++) {
        const ok = j <= 2;
        s.alpha(s.ease('causal', 0.5, 2 + 0.6 * j), () => s.line(xs[j]!, y0, xs[2]!, y1, s.c(ok ? 'gold' : 'red'), ok ? 0.5 : 0.35, ok ? undefined : [1.4, 1.2]));
      }
      s.alpha(s.ease('causal', 0.5, 4), () => {
        const mx = (xs[3]! + xs[2]!) / 2 + 2 * s.u;
        s.text('✗', mx, (y0 + y1) / 2, { size: 4.4, font: 'ui', weight: 700, color: s.c('red'), halo: true });
      });
    });
    s.alpha(s.ease('why', 0.6, 0.4), () => note(s, 'no peeking ahead; all 4 at once', bx, (yB1 + yBN) / 2, 'gold', 3.1));
  },
};

const out: SceneDef = {
  draw(s) {
    const xs = cols(s);
    const yX = s.h * 0.81;
    const base = s.h * 0.6;
    xs.forEach((x, i) => {
      vec(s, x, yX, OUT[i]!, 'green');
      s.text(TOK[i]!, x, yX + 11 * s.u, { size: 2.8, font: 'mono', color: s.c('orange') });
    });
    s.text('x', xs[0]! - 7.5 * s.u, yX, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('green') });
    const un = s.ease('unembed', 0.8, 0.5);
    const sm = s.ease('softmax', 0.9, 0.3);
    const ls = s.ease('loss', 0.6, 0.3);
    s.alpha(un, () => {
      xs.forEach((x, i) => {
        const bxs = spread(s, 5, s.tall ? 3.6 : 4.4, x);
        const vals = SC[i]!.map((v, j) => lerp(v / 3.3, P[i]![j]! * 1.6, sm));
        s.line(bxs[0]! - 2.4 * s.u, base, bxs[4]! + 2.4 * s.u, base, s.c('--axis'), 0.3);
        vals.forEach((v, j) => {
          const hh = Math.max(0.5, v * 12 * un) * s.u;
          const top = j === i + 1;
          const k = sm > 0.5 ? 'teal' : 'purple';
          s.rrect(bxs[j]! - 1.5 * s.u, base - hh, 3 * s.u, hh, 0.6, { fill: s.tint(k, top && sm > 0.5 ? 0.85 : 0.45), stroke: s.tint(k, 0.8), lw: 0.2 });
        });
      });
      const lab = sm > 0.5 ? 'p: one row per position, (4, V)' : 's = x W_Uᵀ: (4, V)';
      note(s, lab, s.w / 2, base + 5 * s.u, sm > 0.5 ? 'teal' : 'purple', 3);
    });
    // The token each row favors, and what it costs when that is the target.
    xs.forEach((x, i) => {
      const a = i < 3 ? s.ease('shift', 0.5, 0.4 + 1.6 * i) : s.ease('last', 0.6, 0.6);
      s.alpha(a, () => {
        chip(s, x, base - 20.5 * s.u, NEXT[i]!, 'gold', { w: 14, h: 6.5, size: 3.1 });
        s.text(PY[i]!.toFixed(1), x, base - 27 * s.u, { size: 2.8, font: 'mono', color: s.c('teal') });
      });
      s.alpha(ls, () => s.text(LOSS[i]!.toFixed(2), x, base - 32.5 * s.u, { size: 3, font: 'mono', weight: 650, color: s.c('red'), halo: true }));
    });
    s.alpha(s.ease('shift', 0.6), () => note(s, 'each row: the next token', s.w / 2, base - 38 * s.u, 'gold', 2.9));
    const top = s.h * 0.08;
    s.alpha(s.win('count', 'loss'), () => {
      rich(s, [['4 tokens in', 'orange'], ['  →  ', '--ink-3'], ['4 predictions out', 'teal']], s.w / 2, top, { size: 3.3, weight: 600 });
      note(s, 'a batch of B texts: B × T', s.w / 2, top + 5.5 * s.u, '--ink-3', 2.9);
    });
    s.alpha(ls, () => {
      rich(s, [['L = ', 'red'], ['0.69 + 0.92 + 0.51 + 0.22 = 2.34', '--ink-2']], s.w / 2, top, { size: 3.1, weight: 600 });
      note(s, 'each loss: −ln p of its target, all from one pass', s.w / 2, top + 5.5 * s.u, '--ink-3', 2.9);
    });
  },
};

export const scenes: Record<string, SceneDef> = { job, stack, out };

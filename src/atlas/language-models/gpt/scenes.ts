import { lerp, type Scene, type SceneDef } from '../../../lecture/scene';
import type { Ink } from '../draw';
import { box, chip, note, rich, spread } from '../draw';

const TOK = ['the', 'cat', 'sat', 'on'];
const IDS = [5, 9, 7, 2];
const NEXT = ['cat', 'sat', 'on', '?'];
const VOCAB = ['the', 'cat', 'sat', 'on', 'mat'];
/** Each position's next-token probabilities over VOCAB, peaked at its target. */
const P = [
  [0.1, 0.5, 0.1, 0.1, 0.2],
  [0.05, 0.05, 0.6, 0.2, 0.1],
  [0.15, 0.05, 0.05, 0.55, 0.2],
  [0.6, 0.05, 0.05, 0.05, 0.25],
];
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

const cols = (s: Scene) => spread(s, 4, s.tall ? 23 : 25);

/** A token's vector: d = 3 cells stacked, shaded by value. */
function vec(s: Scene, x: number, y: number, v: number[], k: Ink, on = 0): void {
  v.forEach((z, i) => {
    const yy = y + (i - 1) * 6 * s.u;
    s.rrect(x - 4 * s.u, yy - 2.5 * s.u, 8 * s.u, 5 * s.u, 1, { fill: s.tint(k, 0.15 + 0.55 * Math.min(1, Math.abs(z))), stroke: s.tint(k, 0.55 + 0.45 * on), lw: 0.3 + 0.25 * on });
  });
}

const into: SceneDef = {
  draw(s) {
    const xs = cols(s);
    const yT = s.h * 0.14;
    const yE = s.h * 0.42;
    const yP = s.h * 0.7;
    TOK.forEach((t, i) => {
      s.text(String(i), xs[i]!, s.h * 0.065, { size: 2.6, font: 'mono', color: s.c('--ink-3') });
      chip(s, xs[i]!, yT, t, 'orange', { w: 12, h: 7, size: 3.2 });
      s.alpha(s.ease('ids', 0.5, 1.2), () => s.text(`id ${IDS[i]}`, xs[i]!, s.h * 0.215, { size: 2.6, font: 'mono', color: s.c('--ink-3') }));
    });
    s.alpha(s.ease('ids', 0.6, 2.2) * (1 - s.ease('embed', 0.5)), () => note(s, 'T = 4 token ids: shape (4,)', s.w / 2, s.h * 0.5, '--ink-2', 3.4));
    const em = s.ease('embed', 0.8, 0.4);
    s.alpha(em, () => {
      note(s, 'each id becomes its row of E', s.w / 2, s.h * 0.28, '--ink-3', 3);
      xs.forEach((x, i) => vec(s, x, yE, E[i]!, 'blue'));
    });
    const ps = s.ease('pos', 0.8, 0.4);
    s.alpha(em, () => s.text('E', xs[0]! - 8 * s.u, yE, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('blue') }));
    s.alpha(ps, () => {
      xs.forEach((x, i) => {
        s.text('+', x, (yE + yP) / 2, { size: 4, font: 'mono', color: s.c('--ink-3') });
        vec(s, x, yP, POS[i]!, 'teal');
      });
      s.text('pos', xs[0]! - 8 * s.u, yP, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('teal') });
    });
    s.alpha(em, () => {
      const lbl = ps > 0.5 ? 'x = E[ids] + pos: (T, d) = (4, d)' : 'E[ids]: (T, d) = (4, d)';
      note(s, lbl, s.w / 2, s.h * 0.89, ps > 0.5 ? 'green' : 'blue', 3.4);
    });
  },
};

const through: SceneDef = {
  draw(s) {
    const xs = cols(s);
    const yX = s.h * 0.15;
    const yO = s.h * 0.74;
    const X = E.map((r, i) => r.map((v, j) => v + POS[i]![j]!));
    const O = X.map((r) => r.map((v, j) => Math.tanh(v * 1.6 + (j - 1) * 0.4)));
    const caus = s.win('causal', undefined);
    xs.forEach((x, i) => vec(s, x, yX, X[i]!, 'green'));
    s.text('x', xs[0]! - 9 * s.u, yX, { size: 3.6, font: 'mono', weight: 650, color: s.c('green') });
    const bw = (xs[3]! - xs[0]!) / s.u + 18;
    const bx = (xs[0]! + xs[3]!) / 2;
    const grow = s.ease('blocks', 0.7);
    s.alpha(grow, () => {
      box(s, bx, s.h * 0.34, '', 'blue', { w: bw, h: 8 });
      s.text('⋮', bx - (bw / 2 - 8) * s.u, s.h * 0.435, { size: 4, color: s.c('--ink-3') });
      box(s, bx, s.h * 0.52, '', 'blue', { w: bw, h: 8 });
      const lx = bx - (bw / 2 - 2.5) * s.u;
      s.text('block 1', lx, s.h * 0.34, { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c('blue') });
      s.text('block N', lx, s.h * 0.52, { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c('blue') });
    });
    s.alpha(s.ease('blocks', 0.7, 1), () => {
      xs.forEach((x, i) => vec(s, x, yO, O[i]!, 'green', i === 2 ? caus : 0));
      s.alpha(1 - s.ease('why', 0.5), () => note(s, '(4, d) in, (4, d) out', s.w / 2, s.h * 0.9, '--ink-2', 3.2));
    });
    // Position 2's attention: back to 0, 1 and itself, never ahead to 3.
    s.alpha(caus, () => {
      const y0 = yX + 9 * s.u;
      const y1 = yO - 9 * s.u;
      for (let j = 0; j < 4; j++) {
        const ok = j <= 2;
        const t = s.ease('causal', 0.5, 0.5 + 0.4 * j);
        s.alpha(t, () => s.line(xs[j]!, y0, lerp(xs[j]!, xs[2]!, 1), y1, s.c(ok ? 'gold' : 'red'), ok ? 0.5 : 0.35, ok ? undefined : [1.4, 1.2]));
      }
      s.alpha(s.ease('causal', 0.5, 2.2), () => {
        const mx = (xs[3]! + xs[2]!) / 2 + 1.5 * s.u;
        s.text('✗', mx, (y0 + y1) / 2, { size: 4.4, font: 'ui', weight: 700, color: s.c('red'), halo: true });
      });
    });
    s.alpha(s.ease('why', 0.6, 0.4), () => note(s, 'no peeking ahead; all 4 positions in one pass', s.w / 2, s.h * 0.9, 'gold', 3.2));
  },
};

const out: SceneDef = {
  draw(s) {
    const xs = cols(s);
    const yX = s.h * 0.14;
    const base = s.h * 0.52;
    const X = E.map((r, i) => r.map((v, j) => Math.tanh((v + POS[i]![j]!) * 1.6 + (j - 1) * 0.4)));
    xs.forEach((x, i) => {
      vec(s, x, yX, X[i]!, 'green');
      s.text(TOK[i]!, x, yX + 10.5 * s.u, { size: 2.8, font: 'mono', color: s.c('orange') });
    });
    const un = s.ease('unembed', 0.8, 0.5);
    const sm = s.ease('softmax', 0.9, 0.3);
    s.alpha(un, () => {
      xs.forEach((x, i) => {
        const bxs = spread(s, 5, s.tall ? 3.4 : 3.8, x);
        const vals = sm > 0 ? SC[i]!.map((v, j) => lerp(v / 3.3, P[i]![j]! * 1.6, sm)) : SC[i]!.map((v) => v / 3.3);
        s.line(bxs[0]! - 2.4 * s.u, base, bxs[4]! + 2.4 * s.u, base, s.c('--axis'), 0.3);
        vals.forEach((v, j) => {
          const hh = Math.max(0.5, v * 16 * un) * s.u;
          const top = P[i]!.indexOf(Math.max(...P[i]!)) === j;
          const k = sm > 0.5 ? 'teal' : 'purple';
          s.rrect(bxs[j]! - 1.4 * s.u, base - hh, 2.8 * s.u, hh, 0.6, { fill: s.tint(k, top && sm > 0.5 ? 0.85 : 0.45), stroke: s.tint(k, 0.8), lw: 0.2 });
        });
        s.alpha(s.ease('shift', 0.6, 0.6 + 1.2 * Math.min(i, 3)), () => {
          const j = P[i]!.indexOf(Math.max(...P[i]!));
          s.text(VOCAB[j]!, x, base - 18.5 * s.u, { size: 2.8, font: 'mono', weight: 650, color: s.c('teal') });
        });
      });
      note(s, sm > 0.5 ? 'p: one row per position, (4, V)' : 's = x W_Uᵀ: (4, V)', s.w / 2, s.h * 0.58, sm > 0.5 ? 'teal' : 'purple', 3);
    });
    s.alpha(s.ease('shift', 0.6), () => {
      xs.forEach((x, i) => {
        const a = i < 3 ? s.ease('shift', 0.5, 0.6 + 1.2 * i) : s.ease('last', 0.6);
        s.alpha(a, () => {
          s.arrow(x, s.h * 0.62, x, s.h * 0.67, s.c('--ink-3'), 0.3, 1.5);
          chip(s, x, s.h * 0.72, NEXT[i]!, i < 3 ? 'gold' : 'slate', { w: 11, h: 6.5, size: 3 });
        });
      });
      note(s, 'targets: the next token', s.w / 2, s.h * 0.795, 'gold', 2.8);
    });
    s.alpha(s.ease('count', 0.6), () => {
      rich(s, [['4 tokens in', 'orange'], ['  →  ', '--ink-3'], ['4 predictions out', 'teal']], s.w / 2, s.h * 0.87, { size: 3.4, weight: 600 });
      note(s, 'a cross-entropy loss at every position', s.w / 2, s.h * 0.935, '--ink-3', 3);
    });
  },
};

export const scenes: Record<string, SceneDef> = { into, through, out };

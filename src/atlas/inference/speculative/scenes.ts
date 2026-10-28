import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01, lerp } from '../../../lecture/scene';
import { columns } from '../../draw';
import { after } from '../../networks/draw';
import type { Ink } from '../draw';
import { hbar, mark, pass, rich, word } from '../draw';

const GUESS = ['on', 'the', 'red', 'mat'];
/** The large model's own pick at each guess, and one after the last. */
const PICKS = ['on', 'the', 'soft', 'mat', '.'];
const OK = [true, true, false];
const TOK = { size: 3.1, h: 6.8 };
const DRAFT: Ink = 'purple';
const LARGE: Ink = 'blue';

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

function caption(s: Scene, text: string, y: number, k: Ink = '--ink-2', size = 3.2, weight = 600) {
  s.text(text, s.w / 2, y, { size, font: 'mono', weight, color: s.c(k), halo: true });
}

/** A pass of the large model, with its read of the weights sweeping across it (gold, as in prefill). */
function largePass(s: Scene, x: number, y: number, w: number, h: number, read: number) {
  pass(s, x, y, LARGE, { w, h, n: 3 });
  if (read <= 0) return;
  const pad = 1.2 * s.u;
  s.rrect(x - (w * s.u) / 2 + pad, y - (h * s.u) / 2 + pad, Math.max(0.5 * s.u, (w * s.u - 2 * pad) * read), h * s.u - 2 * pad, 0.8, { fill: s.tint('gold', 0.4) });
}

// ---- One large pass per token, each one mostly reading the weights; a prefill shares that read.

const wait: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 4, s.tall ? 23 : 25);
    const yBox = s.h * 0.21;
    const yTok = s.h * 0.35;
    const bw = 18;
    const bh = 11;
    caption(s, 'plain decoding: one large pass per token', s.h * 0.07, LARGE, 3);
    xs.forEach((x, i) => {
      s.alpha(after(s, 'loop', 0.15 + 0.17 * i, 0.4), () => {
        const read = clamp01(s.prog('read') * 4.8 - i * 1.1);
        largePass(s, x, yBox, bw, bh, read);
        s.arrow(x, yBox + (bh / 2 + 0.6) * u, x, yTok - 4 * u, s.c('--ink-3'), 0.3, 1.6);
        word(s, x, yTok, PICKS[i]!, LARGE, TOK);
      });
    });
    s.alpha(after(s, 'loop', 0.75), () => {
      const y = s.h * 0.43;
      s.arrow(xs[0]! - 9 * u, y, xs[3]! + 9 * u, y, s.c('--ink-3'), 0.3, 1.8);
      s.text('time', xs[3]! + 9 * u, y + 3 * u, { size: 2.7, font: 'mono', align: 'right', color: s.c('--ink-3') });
    });
    s.alpha(s.ease('read', 0.6, 1), () => caption(s, 'each pass: read every weight, for 1 token', s.h * 0.49, 'gold', 3));

    // A prefill: the prompt's tokens share one pass. Then the next tokens: unknown, then guessed.
    const share = s.ease('share', 0.6);
    const yC = s.h * 0.62;
    const yP = s.h * 0.77;
    const cs = columns(s, 4, 12.5);
    const unknown = s.ease('catch', 0.6);
    const guessed = s.ease('guess', 0.6, 2.2);
    s.alpha(share, () => {
      const lab = guessed > 0.5 ? 'the guesses: checked in one pass' : unknown > 0.5 ? 'the next tokens: not known yet' : 'prefill: known tokens, one pass';
      caption(s, lab, s.h * 0.55, guessed > 0.5 ? DRAFT : unknown > 0.5 ? 'red' : '--ink-2', 3);
      largePass(s, s.w / 2, yP, bw, bh, s.ease('share', 1.6, 2.5));
      cs.forEach((x, i) => {
        s.arrow(x, yC + 3.6 * u, lerp(x, s.w / 2, 0.75), yP - (bh / 2 + 0.6) * u, s.c('--ink-3'), 0.3, 1.6);
        const prompt = ['The', 'cat', 'sat', 'on'][i]!;
        s.alpha(1 - unknown, () => word(s, x, yC, prompt, '--ink-2', TOK));
        s.alpha(unknown * (1 - guessed), () => word(s, x, yC, '?', 'red', TOK));
        s.alpha(guessed * after(s, 'guess', 0.35 + 0.06 * i, 0.3), () => word(s, x, yC, GUESS[i]!, DRAFT, TOK));
      });
      s.text('large', s.w / 2 - (bw / 2 + 2) * u, yP, { size: 2.9, font: 'mono', weight: 650, align: 'right', color: s.c(LARGE) });
      s.alpha(guessed, () => s.text('small model', cs[0]! - 7 * u, yC, { size: 2.9, font: 'mono', weight: 650, align: 'right', color: s.c(DRAFT) }));
    });
    s.alpha(s.win('share', 'catch'), () => caption(s, 'one read of the weights, shared', s.h * 0.89, 'gold', 3));
    s.alpha(s.win('catch', 'guess'), () => caption(s, 'each depends on the one before', s.h * 0.89, 'red', 3));
    s.alpha(after(s, 'guess', 0.55), () => caption(s, 'guess cheaply, check in one large pass', s.h * 0.89, '--ink-2', 3));
  },
};

// ---- Draft four guesses, check them all in one large pass, keep the prefix plus one.

const check: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 5, s.tall ? 14 : 16).map((x) => x + 6 * u);
    const lx = xs[0]! - 8 * u;
    const yG = s.h * 0.27;
    const yB = s.h * 0.45;
    const yP = s.h * 0.63;
    const yM = s.h * 0.73;
    const bh = s.h * 0.11;
    const thrown = after(s, 'mat', 0.45, 0.6);
    s.text('text so far: The cat sat', s.w / 2, s.h * 0.13, { size: 3.2, font: 'mono', weight: 600, color: s.c('--ink-2') });
    s.alpha(after(s, 'draft', 0.55), () => s.text('small', lx, yG, { size: 2.9, font: 'mono', weight: 650, align: 'right', color: s.c(DRAFT) }));
    GUESS.forEach((g, i) => {
      const k: Ink = i === 2 && after(s, 'compare', 0.8) > 0.5 ? 'red' : DRAFT;
      const dim = i === 3 ? thrown : 0;
      s.alpha(after(s, 'draft', 0.72 + 0.06 * i, 0.3) * (1 - 0.65 * dim), () => word(s, xs[i]!, yG, g, k, TOK));
    });
    s.alpha(s.ease('check', 0.6), () => {
      const l = xs[0]! - 7 * u;
      const r = xs[4]! + 7 * u;
      pass(s, (l + r) / 2, yB, LARGE, { w: (r - l) / u, h: bh / u, n: 3, on: s.win('check', 'compare') });
      s.text('large', lx, yP, { size: 2.9, font: 'mono', weight: 650, align: 'right', color: s.c(LARGE) });
      s.text('one pass', lx, yB, { size: 2.9, font: 'mono', weight: 650, align: 'right', color: s.c(LARGE) });
      xs.slice(0, 4).forEach((x) => s.arrow(x, yG + 3.6 * u, x, yB - bh / 2 - 0.6 * u, s.c('--ink-3'), 0.3, 1.6));
      xs.forEach((x, i) => {
        s.alpha(after(s, 'check', 0.45 + 0.08 * i, 0.4), () => {
          s.arrow(x, yB + bh / 2 + 0.6 * u, x, yP - 3.6 * u, s.c('--ink-3'), 0.3, 1.6);
          const dim = i >= 3 ? thrown * 0.65 : 0;
          s.alpha(1 - dim, () => word(s, x, yP, PICKS[i]!, i === 2 && after(s, 'keep', 0.45) > 0.5 ? 'gold' : LARGE, { ...TOK, on: i === 2 ? after(s, 'keep', 0.45, 0.6) : 0 }));
        });
      });
    });
    // Agreement, left to right, up to the first rejection; nothing after it counts.
    OK.forEach((ok, i) => s.alpha(after(s, 'compare', [0.3, 0.55, 0.8][i]!, 0.4), () => mark(s, ok, xs[i]!, yM, 4)));
    // Mat matches the large model's pick, but it was drafted after red, so it goes too.
    s.alpha(s.ease('mat', 0.4, 0.4), () => s.alpha(1 - 0.5 * thrown, () => mark(s, true, xs[3]!, yM, 4)));
    s.alpha(thrown, () => {
      const x = xs[3]!;
      s.line(x - 3 * u, yM, x + 3 * u, yM, s.c('red'), 0.4);
      s.line(x - 5 * u, yG, x + 5 * u, yG, s.c('red'), 0.4);
      s.line(x - 5 * u, yP, x + 5 * u, yP, s.c('red'), 0.4);
      s.line(xs[4]! - 4 * u, yP, xs[4]! + 4 * u, yP, s.c('red'), 0.4);
    });
    s.alpha(s.win('keep', 'mat'), () => {
      caption(s, 'kept: on the soft', s.h * 0.84, 'gold', 3.6, 650);
      s.alpha(after(s, 'keep', 0.75), () => caption(s, '3 tokens, 1 large pass', s.h * 0.91, '--ink-2', 3, 500));
    });
    s.alpha(s.win('mat', 'stern'), () => caption(s, 'after a rejection: all thrown away', s.h * 0.84, 'red', 3.2));
    s.alpha(s.win('stern', 'name'), () => caption(s, 'keep the longest approved prefix', s.h * 0.84, '--ink-2', 3.2));
    s.alpha(s.ease('name', 0.6, 4), () => caption(s, 'speculative: run ahead on a guess', s.h * 0.84, DRAFT, 3.2));
    cite(s, 'Stern, Shazeer & Uszkoreit, 2018', s.win('stern', 'name'));
    cite(s, 'Leviathan, Kalman & Matias, 2022', s.ease('name', 0.6));
  },
};

// ---- Tokens per pass, and the speedup over plain decoding.

/** One pass drawn as its accepted prefix (✓), then the large model's own token (+1). */
function passRow(s: Scene, y: number, acc: number, k: number, a: number, label: string): void {
  const xs = columns(s, k + 1, 9).map((x) => x + 6 * s.u);
  s.alpha(a, () => {
    for (let i = 0; i <= k; i++) {
      const x = xs[i]!;
      if (i < acc) s.cell(x - 3.5 * s.u, y - 3 * s.u, 7 * s.u, 6 * s.u, '✓', DRAFT, { on: 0.5, size: 3 });
      else if (i === acc) s.cell(x - 3.5 * s.u, y - 3 * s.u, 7 * s.u, 6 * s.u, '+1', 'gold', { on: 1, size: 2.8 });
      else s.cell(x - 3.5 * s.u, y - 3 * s.u, 7 * s.u, 6 * s.u, '', '--ink-3', { on: 0 });
    }
    s.text(label, xs[0]! - 6 * s.u, y, { size: 3, font: 'mono', weight: 650, align: 'right', color: s.c('--ink-2') });
  });
}

const YIELDS = [3, 5, 1, 3];

const count: SceneDef = {
  draw(s) {
    const u = s.u;
    const top = 1 - s.ease('speed', 0.6);
    s.alpha(top, () => {
      s.alpha(s.ease('rule', 0.5), () => caption(s, 'each pass: accepted prefix + 1', s.h * 0.09, '--ink-2', 3.2));
      passRow(s, s.h * 0.22, 2, 4, s.ease('rule', 0.6), '2 + 1');
      passRow(s, s.h * 0.35, 0, 4, after(s, 'rule', 0.55), '0 + 1');
      passRow(s, s.h * 0.48, 4, 4, s.ease('all', 0.6), '4 + 1');
      s.alpha(after(s, 'all', 0.4), () => caption(s, 'all accepted: the extra pick is free', s.h * 0.6, 'gold', 3));
    });
    // Twelve tokens: twelve plain passes, or four speculative ones.
    s.alpha(s.ease('speed', 0.6), () => {
      const l = s.w / 2 - 40 * u;
      const cw = 80 / 12;
      s.text('speculative: 4 passes', l, s.h * 0.12, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3') });
      let at = 0;
      YIELDS.forEach((n, i) => {
        s.alpha(after(s, 'speed', 0.3 + 0.12 * i, 0.4), () => s.cell(l + at * cw * u, s.h * 0.18, (n * cw - 0.8) * u, 6 * u, String(n), 'gold', { on: 0.6, size: 3 }));
        at += n;
      });
      s.alpha(s.ease('fewer', 0.6), () => {
        s.text('plain decoding: 12 passes', l, s.h * 0.32, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3') });
        for (let i = 0; i < 12; i++) s.alpha(s.ease('fewer', 0.3, 0.3 + 0.1 * i), () => s.cell(l + i * cw * u, s.h * 0.38, (cw - 0.8) * u, 6 * u, '1', 'slate', { size: 2.6 }));
      });
      s.alpha(after(s, 'fewer', 0.55), () => caption(s, '12 ÷ 4 = 3 times fewer large passes', s.h * 0.52, 'gold', 3.4, 650));
    });
    s.alpha(s.ease('same', 0.6), () => {
      caption(s, 'greedy: every kept token is', s.h * 0.68, LARGE, 3.1, 500);
      caption(s, 'the large model\'s own pick', s.h * 0.74, LARGE, 3.1, 500);
      s.alpha(after(s, 'same', 0.7), () => caption(s, 'the draft sets the speed, not the text', s.h * 0.84, DRAFT, 3.1, 600));
    });
  },
};

// ---- Sampling: keep a guess with chance min(1, p_large / p_small); refill the gaps on a rejection.

const TOKENS = ['red', 'soft', 'rug'];
const PL = [0.3, 0.5, 0.2];
const PS = [0.6, 0.3, 0.1];
/** Each gap's share of a replacement: (p_large - p_small) where positive, over their sum. */
const GAPS = PL.map((p, i) => Math.max(0, p - PS[i]!));

const sample: SceneDef = {
  marks: {
    acc: { tex: String.raw`\text{keep with chance } \min\!\left(1,\ \dfrac{p_{\text{large}}}{p_{\text{small}}}\right)`, x: 0.5, y: 0.56, size: 4.4 },
  },
  draw(s) {
    const u = s.u;
    const first = 1 - s.ease('bars', 0.5);
    s.alpha(first, () => {
      const x0 = s.w / 2 - 14 * u;
      const full = 50 * u;
      caption(s, 'sampling: is the guess red kept?', s.h * 0.1, '--ink-2', 3.1);
      s.alpha(after(s, 'sample', 0.45), () => {
        s.text('draft p(red)', x0 - 2 * u, s.h * 0.21, { size: 2.9, font: 'mono', align: 'right', color: s.c(DRAFT) });
        hbar(s, x0, s.h * 0.21, full * 0.6 * after(s, 'sample', 0.5, 0.8), DRAFT, '0.6');
      });
      s.alpha(after(s, 'sample', 0.75), () => {
        s.text('large p(red)', x0 - 2 * u, s.h * 0.31, { size: 2.9, font: 'mono', align: 'right', color: s.c(LARGE) });
        hbar(s, x0, s.h * 0.31, full * 0.3 * after(s, 'sample', 0.8, 0.8), LARGE, '0.3');
      });
      s.alpha(s.ease('red', 0.6), () => caption(s, 'kept with chance 0.3 / 0.6 = 0.5', s.h * 0.42, 'gold', 3.4, 650));
      s.alpha(after(s, 'cap', 0.7), () => caption(s, 'large ≥ draft: always kept', s.h * 0.69, '--ink-3', 3, 500));
    });
    s.show('acc', s.ease('cap', 0.6, 0.4) * first);

    // Three tokens: blue bars for the large model, purple lines for the draft.
    s.alpha(s.ease('bars', 0.6), () => {
      const xs = columns(s, 3, s.tall ? 27 : 30);
      const base = s.h * 0.74;
      const sc = s.h * 0.85;
      const bw = 12 * u;
      const Y = (p: number) => base - p * sc;
      caption(s, 'the next token: three it might be', s.h * 0.12, '--ink-2', 3.1);
      s.line(xs[0]! - 16 * u, base, xs[2]! + 16 * u, base, s.c('--axis'), 0.3);
      const kept = s.ease('kept', 1.2, 0.5);
      const fill = s.ease('gap', 1.6, 4.5);
      xs.forEach((x, i) => {
        const p = PL[i]!;
        const q = PS[i]!;
        const lo = Math.min(p, q);
        s.text(TOKENS[i]!, x, base + 4 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c('--ink-2') });
        // The large model's bar, filled from below by kept guesses, then by replacements.
        s.rrect(x - bw / 2, Y(p), bw, base - Y(p), 0.6, { fill: s.tint(LARGE, 0.08), stroke: s.c(LARGE), lw: 0.35 });
        s.alpha(kept, () => s.rrect(x - bw / 2, Y(lo * kept), bw, base - Y(lo * kept), 0.6, { fill: s.tint(DRAFT, 0.4) }));
        if (p > q) s.alpha(fill, () => s.rrect(x - bw / 2, Y(q + (p - q) * fill), bw, (p - q) * sc * fill, 0.6, { fill: s.tint('gold', 0.55) }));
        // The draft's share: a dashed line, and red's extra share above its bar, rejected.
        s.line(x - bw / 2 - 2 * u, Y(q), x + bw / 2 + 2 * u, Y(q), s.c(DRAFT), 0.45, [1.2, 0.8]);
        s.text(String(p), x + bw / 2 + 1.5 * u, Y(p) + (p > q ? -2 : 2.5) * u, { size: 2.8, font: 'mono', weight: 650, align: 'left', color: s.c(LARGE), halo: true });
        s.text(String(q), x - bw / 2 - 1.5 * u, Y(q) - 2 * u, { size: 2.8, font: 'mono', weight: 650, align: 'right', color: s.c(DRAFT), halo: true });
        if (q > p) {
          s.alpha(kept * (1 - fill), () => {
            s.rrect(x - bw / 2, Y(q), bw, (q - p) * sc, 0.6, { stroke: s.c('red'), lw: 0.35 });
            s.text('rejected', x - bw / 2 - 1.2 * u, (Y(q) + Y(p)) / 2, { size: 2.7, font: 'mono', weight: 650, align: 'right', color: s.c('red'), halo: true });
          });
        }
      });
      // The rejected share is poured into the gaps, in proportion to their sizes.
      const pour = s.ease('gap', 1.6, 4.5);
      if (pour > 0 && pour < 1) {
        let off = 0;
        const sum = GAPS.reduce((a, b) => a + b, 0);
        GAPS.forEach((g, i) => {
          if (g <= 0) return;
          const h = (g / sum) * (PS[0]! - PL[0]!) * sc;
          const fromY = Y(PS[0]!) + off;
          off += h;
          const x = lerp(xs[0]!, xs[i]!, pour);
          const y = lerp(fromY, Y(PL[i]!), pour);
          s.rrect(x - bw / 2, y, bw, h, 0.6, { fill: s.tint('gold', 0.55 * (1 - pour)) });
        });
      }
      s.alpha(s.win('bars', 'kept'), () => rich(s, [['■ ', LARGE], ['large   ', '--ink-3'], ['┄ ', DRAFT], ['draft', '--ink-3']], s.w / 2, s.h * 0.88, { size: 3, weight: 600 }));
      s.alpha(s.win('kept', 'gap'), () => {
        caption(s, 'kept guesses: up to the purple line', s.h * 0.88, DRAFT, 3);
        s.alpha(after(s, 'kept', 0.5), () => caption(s, 'red: 0.6 × ½ = 0.3, its whole bar', s.h * 0.94, '--ink-2', 3, 500));
      });
      s.alpha(s.win('gap', 'who'), () => caption(s, 'a replacement: drawn from the gaps', s.h * 0.88, 'gold', 3));
      s.alpha(s.ease('who', 0.6), () => caption(s, 'every token: the large model\'s probability', s.h * 0.88, LARGE, 3));
    });
    cite(s, 'Leviathan et al., 2022 · Chen et al., 2023', after(s, 'who', 0.4));
  },
};

export const scenes: Record<string, SceneDef> = { wait, check, count, sample };

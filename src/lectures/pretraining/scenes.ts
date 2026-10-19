import { Rng } from '../../core/rand';
import { type Scene, type SceneDef, clamp01, lerp } from '../../lecture/scene';
import { PLAIN, type Decoding, generate, score, shape } from '../../lib/pretraining-decode';
import { ANSWERS, TASKS, predict } from '../../lib/pretraining-icl';
import {
  BIGRAM, DOT, ENTROPY, FIVEGRAM, FOURGRAM, HELD, IX, NGRAM, TRAIN, TRIGRAM, UNIGRAM, V, VOCAB,
  maskedPosteriors, stateAfter, step, tok, trueNll, trueProbs,
} from '../../lib/pretraining-lang';
import { type Bar, Frame, type K, card, chipRow, current, dims, faces, fit, hbars, pct, sci, star } from './kit';

// ---------------------------------------------------------------- shared data

const C = (str: string): number[] => [DOT, ...tok(str)];
const W_ = (i: number): string => VOCAB[i]!;
/** Can the grammar take word `w` after context `ctx`? */
const allowed = (ctx: number[], w: number): boolean => {
  const st = stateAfter(ctx);
  return st >= 0 && step(st, w) >= 0;
};

const SENTS: string[] = (() => {
  const out: string[] = [];
  let cur: string[] = [];
  for (let i = 1; i < TRAIN.length && out.length < 4; i++) {
    cur.push(W_(TRAIN[i]!));
    if (TRAIN[i] === DOT) {
      out.push(cur.join(' '));
      cur = [];
    }
  }
  return out;
})();

/** The n-gram's next-word distribution after "the cat", most likely first. */
const AFTER_CAT = (() => {
  const pr = NGRAM.probs(C('the cat'));
  return Array.from({ length: V }, (_, i) => i).sort((a, b) => pr[b]! - pr[a]!).slice(0, 6).map((i) => ({ w: W_(i), p: pr[i]! }));
})();

const factors = (sent: string): number[] => {
  const x = tok(sent);
  return x.map((w, t) => NGRAM.probs([DOT, ...x.slice(0, t)])[w]!);
};
const CHAIN_S = 'the cat sleeps on the mat .';
const CHAIN_W = CHAIN_S.split(' ');
const CHAIN_P = factors(CHAIN_S);
const CHAIN_CUM = CHAIN_P.map((_, t) => CHAIN_P.slice(0, t + 1).reduce((a, b) => a * b, 1));
const GOOD2 = factors('the cats sleep .');
const BAD2 = factors('the cats sleeps .');

/** What followed "the cat" in the training text. */
const CAT_COUNTS = (() => {
  const m = new Map<number, number>();
  let n = 0;
  const the = IX.get('the')!;
  const cat = IX.get('cat')!;
  for (let i = 2; i < TRAIN.length; i++)
    if (TRAIN[i - 2] === the && TRAIN[i - 1] === cat) {
      n++;
      m.set(TRAIN[i]!, (m.get(TRAIN[i]!) ?? 0) + 1);
    }
  return { n, rows: [...m].sort((a, b) => b[1] - a[1]).map(([w, c]) => ({ w: W_(w), c })) };
})();

const SURP = CHAIN_P.map((p) => -Math.log(p));
const LOSS = SURP.reduce((a, b) => a + b, 0) / SURP.length;
const LOGV = Math.log(V);

/** After "the big cat": the language's own distribution and a slightly-off model. */
const PPL_W = ['sleeps', 'runs', 'sees', 'likes', 'chases', 'sleep', 'the', '.'];
const PD = (() => {
  const all = trueProbs(C('the big cat'));
  return PPL_W.map((w) => all[IX.get(w)!]!);
})();
const QOFF = PD.map((v) => 0.7 * v + 0.3 / PPL_W.length);
const H_PD = -PD.reduce((s, v) => s + (v > 0 ? v * Math.log(v) : 0), 0);
const CE_OFF = -PD.reduce((s, v, i) => s + (v > 0 ? v * Math.log(QOFF[i]!) : 0), 0);

/** Held-out loss of count models with 1..4 words of context, and the floor. */
const COUNT_LOSS = [BIGRAM, TRIGRAM, FOURGRAM, FIVEGRAM].map((m) => m.nll(HELD));
/**
 * Held-out loss of the chapter's window network (Fig 4.3: 1,500 Adam steps, batch 64, lr 0.004,
 * seed 1) for 1..4 words of context. Recorded from that figure rather than retrained here.
 */
const NET_LOSS = [1.597, 1.466, 1.368, 1.323];
const FLOOR = trueNll(HELD);

const GREEDY = generate(C('the'), { ...PLAIN, greedy: true }, new Rng(1), 5).map(W_);
const CAT_CTX = C('the cat');
const CAT_P = NGRAM.probs(CAT_CTX);

const THE_CTX = C('the');
const ON_CTX = C('the kids sleep on');
const THE_P = NGRAM.probs(THE_CTX);
const ON_P = NGRAM.probs(ON_CTX);

type Method = 'tau' | 'k' | 'p';
const SWEEP: Record<Method, number[]> = {
  tau: [0.35, 0.55, 0.75, 1, 1.3, 1.7],
  k: [1, 2, 3, 5, 8, 14, 36],
  p: [0.3, 0.55, 0.75, 0.85, 0.95, 1],
};
const asD = (m: Method, v: number): Decoding => (m === 'tau' ? { ...PLAIN, tau: v } : m === 'k' ? { ...PLAIN, topK: v } : { ...PLAIN, topP: v });
const CURVES: Record<Method, { c: number; g: number }[]> = {
  tau: SWEEP.tau.map((v) => score(asD('tau', v), new Rng(17), 300)).map((q) => ({ c: q.choices, g: q.good })),
  k: SWEEP.k.map((v) => score(asD('k', v), new Rng(17), 300)).map((q) => ({ c: q.choices, g: q.good })),
  p: SWEEP.p.map((v) => score(asD('p', v), new Rng(17), 300)).map((q) => ({ c: q.choices, g: q.good })),
};
const LANG_CHOICES = Math.exp(FLOOR);

const BERT_S = tok('the kids sleep in the park .');
const KIDS = 1;
const BITS_LEFT = -Math.log2(trueProbs([DOT, ...BERT_S.slice(0, KIDS)])[BERT_S[KIDS]!]!);
const BITS_BOTH = -Math.log2(maskedPosteriors(BERT_S, BERT_S.map((_, i) => i === KIDS))[KIDS]![BERT_S[KIDS]!]!);

const COMP_X = tok('the lazy dog chases a ball .');
const compRows = (probs: (ctx: number[]) => Float64Array) =>
  COMP_X.map((w, t) => {
    const pr = probs([DOT, ...COMP_X.slice(0, t)]);
    let below = 0;
    for (let i = 0; i < w; i++) below += pr[i]!;
    return { pr, below, p: pr[w]! };
  });
const COMP_NGRAM = compRows((c) => NGRAM.probs(c));
const bitsOf = (rows: { p: number }[]) => rows.reduce((a, r) => a - Math.log2(r.p), 0);
const BITS = {
  uniform: COMP_X.length * Math.log2(V),
  unigram: bitsOf(compRows((c) => UNIGRAM.probs(c))),
  ngram: bitsOf(COMP_NGRAM),
  grammar: bitsOf(compRows((c) => trueProbs(c))),
};

const FRENCH = 1;
const ICL = [0, 1, 2].map((k) => predict(Array.from({ length: k }, (_, i) => [i, TASKS[FRENCH]!.answers[i]!] as [number, string]), 4));

// ---------------------------------------------------------------- helpers

/** Heading text at the top of the drawing area. */
function heading(s: Scene, txt: string, a = 1, y = 15): void {
  s.alpha(a, () => s.text(txt, s.w / 2, y * s.u, { size: 4.4, font: 'display', weight: 600 }));
}

function note(s: Scene, txt: string, y: number, a = 1, k: K = '--ink-2', size = 3.7): void {
  s.alpha(a, () => s.text(txt, s.w / 2, y * s.u, { size, italic: true, color: s.c(k) }));
}

/** Sorted distribution rows with top-k / top-p cuts and grammar marks. */
function distRows(probs: Float64Array, ctx: number[], d: Decoding, n: number) {
  const sh = shape(probs, d);
  return sh.order.slice(0, n).map((w, r) => ({ w, p: sh.tempered[w]!, kept: r < sh.kept, ok: allowed(ctx, w) }));
}

// ---------------------------------------------------------------- 1 intro

const TILES: [string, string, K][] = [
  ['predict', 'the next token', 'purple'],
  ['score', 'loss, perplexity', 'red'],
  ['train', 'teacher forcing', 'blue'],
  ['generate', 'greedy, top-p', 'slate'],
  ['GPT vs BERT', 'causal, masked', 'teal'],
  ['why it works', 'compression', 'gold'],
];

function tiles(s: Scene, y0: number, appear: (i: number) => number, lit: (i: number) => number): void {
  const { u, W } = dims(s);
  const cols = 3;
  const gap = 2.4 * u;
  const tw = ((W - 10) * u - gap * (cols - 1)) / cols;
  const th = 19 * u;
  TILES.forEach(([name, sub, k], i) => {
    const a = appear(i);
    if (a <= 0.003) return;
    const x = 5 * u + (i % cols) * (tw + gap);
    const y = y0 * u + Math.floor(i / cols) * (th + gap) + (1 - a) * 2 * u;
    const on = lit(i);
    s.alpha(a, () => {
      card(s, x, y, tw, th, k, on);
      s.text(name, x + tw / 2, y + th * 0.36, { size: fit(s, name, tw - 2 * u, 4.6, 'display', 600), font: 'display', weight: 600 });
      s.text(sub, x + tw / 2, y + th * 0.7, { size: fit(s, sub, tw - 2 * u, 3.4), font: 'mono', color: s.c(k) });
    });
  });
}

const intro: SceneDef = {
  draw(s) {
    const { u, W } = dims(s);
    const { w, h } = s;
    s.alpha(s.win('hello', 'rnn'), () => {
      s.text('Language models', w / 2, h * 0.38, { size: 9, font: 'display', weight: 600 });
      s.text('and pretraining', w / 2, h * 0.38 + 11 * u, { size: 9, font: 'display', weight: 600 });
      s.text('one objective: predict the next token', w / 2, h * 0.66, { size: 4.2, italic: true, color: s.c('--ink-2') });
    });
    // Same recipe, a hundred million times the text.
    const sA = s.win('rnn', 'name');
    if (sA > 0) {
      s.alpha(sA, () => {
        const cw = (W - 14) / 2;
        const cards: [string, string[], K, string][] = [
          ['the RNN lecture', ['characters', 'an RNN', '3 KB of Shakespeare'], 'orange', 'rnn'],
          ['GPT-3, 2020', ['subword tokens', 'a transformer', '~300 billion tokens'], 'purple', 'same'],
        ];
        cards.forEach(([title, lines, k, beat], i) => {
          const a = s.ease(beat, 0.6);
          const x = (5 + i * (cw + 4)) * u;
          s.alpha(a, () => {
            card(s, x, 14 * u, cw * u, 34 * u, k, 0.4);
            s.text(title, x + (cw * u) / 2, 20.5 * u, { size: 4.4, font: 'display', weight: 600 });
            lines.forEach((l, j) => s.text(l, x + (cw * u) / 2, (28.5 + j * 6.2) * u, { size: fit(s, l, (cw - 3) * u, 3.6), font: 'mono', color: s.c(j === 2 ? k : '--ink-2') }));
          });
        });
        // A log axis of training text size.
        const aA = s.ease('scale', 0.7);
        s.alpha(aA, () => {
          const x0 = 9 * u;
          const x1 = (W - 6) * u;
          const y = 74 * u;
          const X = (e: number) => x0 + ((e - 3) / 9) * (x1 - x0);
          s.line(x0, y, x1, y, s.c('--axis'), 0.35);
          for (let e = 3; e <= 12; e++) {
            s.line(X(e), y - u, X(e), y + u, s.c('--axis'), 0.3);
            if (e % 3 === 0) s.text(`10^${e}`, X(e), y + 4.4 * u, { size: 3.4, font: 'mono', color: s.c('--ink-3') });
          }
          s.text('size of the training text', (x0 + x1) / 2, y + 10 * u, { size: 3.6, italic: true, color: s.c('--ink-2') });
          const ra = Math.log10(3307);
          const ga = Math.log10(3e11);
          s.circle(X(ra), y, 1.6 * u, { fill: s.c('orange') });
          s.circle(X(ga), y, 1.6 * u, { fill: s.c('purple') });
          s.text('3,300 characters', X(ra) + 2 * u, y - 5 * u, { size: 3.6, font: 'mono', color: s.c('orange'), align: 'left' });
          s.text('300 billion tokens', X(ga) - 2 * u, y - 5 * u, { size: 3.6, font: 'mono', color: s.c('purple'), align: 'right' });
          const p = s.ease('scale', 1.2, 0.5);
          s.arrow(X(ra) + 3 * u, y - 11 * u, lerp(X(ra) + 3 * u, X(ga) - 3 * u, p), y - 11 * u, s.c('--accent'), 0.5);
          s.alpha(p, () => s.text('about 100 million times more', (X(ra) + X(ga)) / 2, y - 14.5 * u, { size: 3.6, weight: 600, color: s.c('--accent') }));
        });
      });
    }
    // The objective.
    const oA = s.win('name', 'plan');
    if (oA > 0) {
      s.alpha(oA, () => {
        s.text('pretraining', w / 2, 20 * u, { size: 7, font: 'display', weight: 600 });
        s.text('no labels, no task, just raw text', w / 2, 29 * u, { size: 3.8, italic: true, color: s.c('--ink-2') });
        s.alpha(s.ease('goal', 0.6), () => {
          s.text('make the text as probable as possible,', w / 2, 41 * u, { size: 4.4, weight: 550 });
          s.text('one token at a time', w / 2, 48 * u, { size: 4.4, weight: 550 });
          const n = 1 + Math.min(3, Math.floor(Math.max(0, s.since('goal') - 1) / 0.9));
          const words = ['the', 'cat', 'sleeps', '.'];
          chipRow(s, [...words.slice(0, n), '?'], w / 2, 62 * u, { size: 4, k: (i) => (i === n ? 'purple' : 'orange'), on: (i) => (i === n ? 1 : 0) });
          s.text('p(next token | the text so far)', w / 2, 72 * u, { size: 3.6, font: 'mono', color: s.c('purple') });
        });
        s.alpha(s.ease('loop', 0.6), () => s.text('loss = −log p(text)  →  backprop  →  step', w / 2, 84 * u, { size: 3.6, font: 'mono', color: s.c('red') }));
      });
    }
    // The plan.
    const pA = s.ease('plan', 0.6);
    if (pA > 0) {
      s.alpha(pA, () => {
        heading(s, 'this lecture', 1, 15);
        tiles(s, 21, (i) => s.ease('plan', 0.5, 0.3 + i * 0.35), () => 0.3);
        s.alpha(s.ease('toy', 0.6), () => note(s, 'all with a toy language: 36 words, known probabilities', 72, 1, 'orange', 3.8));
      });
    }
  },
};

// ---------------------------------------------------------------- 2 next

const COLS: [string, string[]][] = [
  ['start', ['the', 'a']],
  ['adjective?', ['big', 'small', 'lazy', 'happy']],
  ['noun', ['cat', 'dog', '…', 'cats', 'dogs', '…']],
  ['verb', ['sleeps', 'sees', '…', 'sleep', 'see', '…']],
  ['then', ['.', 'on the mat', 'the ball']],
];

const next: SceneDef = {
  draw(s) {
    const { u, W } = dims(s);
    const { w } = s;
    // Sentences, then the grammar that writes them.
    const lA = s.win('lang', 'vocab');
    s.alpha(lA, () => {
      SENTS.forEach((st, i) => s.alpha(s.ease('lang', 0.5, 0.4 + i * 0.3), () => s.text(st, w / 2, (16 + i * 6) * u, { size: 3.8, font: 'mono' })));
      const gA = s.ease('grammar', 0.7);
      s.alpha(gA, () => {
        const cw = (W - 6) / COLS.length;
        COLS.forEach(([head, ws], i) => {
          const cx = (3 + cw * (i + 0.5)) * u;
          s.alpha(s.ease('grammar', 0.5, 0.2 + i * 0.35), () => {
            s.text(head, cx, 45 * u, { size: 3.4, italic: true, color: s.c('--ink-3') });
            ws.forEach((wd, j) => s.text(wd, cx, (51 + j * 5.4) * u, { size: 3.5, font: 'mono', color: s.c(wd === '…' ? '--ink-3' : 'orange') }));
            if (i < COLS.length - 1) s.arrow(cx + cw * 0.36 * u, 45 * u, cx + cw * 0.62 * u, 45 * u, s.c('--ink-3'), 0.3, 1.6);
          });
        });
      });
    });
    // The vocabulary.
    const vA = s.win('vocab', 'model');
    s.alpha(vA, () => {
      heading(s, `the vocabulary: ${V} words`, 1, 16);
      const cols = 6;
      const cw = ((W - 12) * u) / cols;
      const ch = 9 * u;
      VOCAB.forEach((wd, i) => {
        const x = 6 * u + (i % cols) * cw;
        const y = 24 * u + Math.floor(i / cols) * ch;
        s.alpha(s.ease('vocab', 0.4, 0.2 + i * 0.03), () => s.cell(x + u * 0.5, y, cw - u, ch - u * 1.4, wd, 'orange', { size: 3.4 }));
      });
    });
    // Context -> model -> distribution.
    const mA = s.ease('model', 0.6) * (1 - s.ease('big', 0.6));
    if (mA > 0) {
      s.alpha(mA, () => {
        const ctxY = 17 * u;
        chipRow(s, ['the', 'cat'], w / 2, ctxY, { size: 4 });
        s.arrow(w / 2, ctxY + 4 * u, w / 2, 26 * u, s.c('--ink-3'), 0.4);
        const morph = s.ease('softmax', 1.2);
        s.rrect(w / 2 - 19 * u, 27 * u, 38 * u, 8 * u, 1.5, { fill: s.tint('blue', 0.1), stroke: s.c('blue'), lw: 0.4 });
        s.text(morph < 0.5 && s.since('logits') >= 0 ? 'scores (logits)' : morph >= 0.5 ? 'softmax' : 'model', w / 2, 31.2 * u, { size: 3.8, font: 'mono', weight: 600, color: s.c('blue') });
        const lit = s.ease('read', 0.6);
        const logits = AFTER_CAT.map((r) => Math.log(r.p / AFTER_CAT[0]!.p) + 2);
        const bars: Bar[] = AFTER_CAT.map((r, i) => {
          const isScore = s.since('logits') >= 0 && morph < 0.5;
          const v = isScore ? logits[i]! / 2.4 : lerp(s.since('logits') >= 0 ? logits[i]! / 2.4 : r.p, r.p, morph);
          return { label: r.w, v: Math.max(0.01, v), k: 'purple', on: lit * (i < 4 ? 1 : 0), note: isScore ? logits[i]!.toFixed(1) : pct(r.p) };
        });
        hbars(s, 8 * u, 40 * u, (W - 16) * u, 48 * u, bars, 1, { labelW: 16 });
      });
    }
    // A real vocabulary.
    const bA = s.ease('big', 0.6);
    s.alpha(bA, () => {
      heading(s, 'the same classifier, at scale', 1, 18);
      const rows: [string, string, K][] = [
        ['toy language', `${V}-way softmax`, 'orange'],
        ['GPT-2', '50,257-way softmax', 'purple'],
      ];
      rows.forEach(([a, b, k], i) => {
        const y = (34 + i * 20) * u;
        card(s, 10 * u, y, (W - 20) * u, 14 * u, k, 0.3);
        s.text(a, 16 * u, y + 7 * u, { size: 4.2, font: 'display', weight: 600, align: 'left' });
        s.text(b, (W - 16) * u, y + 7 * u, { size: 3.8, font: 'mono', color: s.c(k), align: 'right' });
      });
      note(s, 'every prediction is a classification over the vocabulary', 82, s.ease('big', 0.6, 1));
    });
  },
};

// ---------------------------------------------------------------- 3 chain

const chain: SceneDef = {
  marks: {
    rule: { tex: String.raw`\symp(\symx_1,\dots,\symx_T) = \prod_{t=1}^{T} \symp(\symx_t \mid \symx_{<t})`, x: 0.5, y: 0.38, size: 5.2 },
  },
  draw(s) {
    const { u, W } = dims(s);
    const { w } = s;
    const main = 1 - s.ease('bad', 0.6);
    // How many words have been scored so far.
    const n = s.since('first') < 0 ? 0 : s.since('second') < 0 ? 1 : s.since('third') < 0 ? 2 : 3 + Math.floor(clamp01((s.since('third') - 1.5) / 3) * 4);
    s.alpha(s.win('whole', 'bad'), () => {
      const xs = chipRow(s, CHAIN_W, w / 2, 17 * u, { size: 3.9, k: (i) => (i < n ? 'orange' : '--ink-3'), on: (i) => (i === n - 1 ? 1 : 0) });
      xs.forEach((c, i) => {
        if (i >= n) return;
        s.text(pct(CHAIN_P[i]!), c.x, 24 * u, { size: 3.3, font: 'mono', weight: 600, color: s.c(CHAIN_P[i]! > 0.2 ? 'green' : CHAIN_P[i]! > 0.05 ? 'gold' : 'red') });
      });
    });
    s.show('rule', s.win('rule', 'first') * main);
    // The product, written out.
    s.alpha(s.ease('first', 0.5) * main, () => {
      if (n === 0) return;
      const shown = CHAIN_P.slice(0, n);
      const parts = shown.length > 4 ? ['…', ...shown.slice(-3).map((v) => sci(v))] : shown.map((v) => sci(v));
      s.text(n === 1 ? `p = ${sci(CHAIN_P[0]!)}` : `p = ${parts.join(' × ')} = ${sci(CHAIN_CUM[n - 1]!, 2)}`, w / 2, 33 * u, { size: 3.8, font: 'mono', weight: 600, color: s.c('purple') });
    });
    // The product and the log-sum, step by step.
    const pA = s.ease('third', 0.6, 1) * main;
    if (pA > 0) {
      s.alpha(pA, () => {
        const pw = (W - 16) / 2;
        const top = 44 * u;
        const ph = 40 * u;
        const panels = [
          { x: 5 * u, title: 'prob so far', on: s.ease('tiny', 0.5) * (1 - s.ease('logs', 0.5)), f: (v: number) => v, dom: [0, 1] as [number, number] },
          { x: (11 + pw) * u, title: 'log prob so far', on: s.ease('logs', 0.5), f: (v: number) => Math.log(v), dom: [-8, 0] as [number, number] },
        ];
        panels.forEach((pn) => {
          card(s, pn.x, top - 6 * u, pw * u, ph + 12 * u, pn.title.startsWith('log') ? 'teal' : 'purple', pn.on);
          s.text(pn.title, pn.x + (pw * u) / 2, top - 1.5 * u, { size: 3.5, font: 'mono', weight: 600, color: s.c('--ink-2') });
          const bw = (pw * u - 4 * u) / 7;
          const zeroY = pn.dom[1] === 0 && pn.dom[0] < 0 ? top + 3 * u : top + ph;
          for (let t = 0; t < Math.max(n, 0); t++) {
            const v = pn.f(CHAIN_CUM[t]!);
            const x = pn.x + 2 * u + t * bw;
            if (pn.dom[0] === 0) {
              const hh = (v / pn.dom[1]) * (ph - 4 * u);
              s.rrect(x + bw * 0.15, zeroY - hh, bw * 0.7, Math.max(0.3 * u, hh), 0.5, { fill: s.tint('purple', 0.6) });
            } else {
              const hh = (v / pn.dom[0]) * (ph - 4 * u);
              s.rrect(x + bw * 0.15, zeroY, bw * 0.7, hh, 0.5, { fill: s.tint('teal', 0.6) });
            }
          }
          if (n > 0) {
            const v = pn.f(CHAIN_CUM[n - 1]!);
            s.text(pn.dom[0] === 0 ? sci(v, 2) : v.toFixed(2), pn.x + (pw * u) / 2, top + ph + 3.5 * u, { size: 3.6, font: 'mono', weight: 650, color: s.c(pn.dom[0] === 0 ? 'purple' : 'teal') });
          }
        });
      });
    }
    // A broken sentence.
    const bA = s.ease('bad', 0.6);
    s.alpha(bA, () => {
      const rows: [string, number[], K][] = [
        ['the cats sleep .', GOOD2, 'green'],
        ['the cats sleeps .', BAD2, 'red'],
      ];
      rows.forEach(([sent, ps, k], r) => {
        const y = (40 + r * 24) * u;
        const xs = chipRow(s, sent.split(' '), w / 2, y, { size: 4, k: (i) => (r === 1 && i === 2 ? 'red' : 'orange'), on: (i) => (r === 1 && i === 2 ? 1 : 0) });
        xs.forEach((c, i) => s.text(pct(ps[i]!), c.x, y + 7 * u, { size: 3.4, font: 'mono', weight: 600, color: s.c(ps[i]! < 0.01 ? 'red' : '--ink-2') }));
        s.text(`p = ${sci(ps.reduce((a, b) => a * b, 1), 2)}`, w / 2, y + 13 * u, { size: 3.8, font: 'mono', weight: 650, color: s.c(k) });
      });
      const ratio = GOOD2.reduce((a, b) => a * b, 1) / BAD2.reduce((a, b) => a * b, 1);
      s.alpha(s.ease('bad', 0.6, 2.5), () => s.text(`about ${Math.round(ratio / 10) * 10} times less likely`, w / 2, 90 * u, { size: 4, weight: 600, color: s.c('red') }));
    });
  },
};

// ---------------------------------------------------------------- 4 ngram

const STREAM = Array.from(TRAIN.slice(1, 80)).map(W_);

const ngram: SceneDef = {
  marks: {
    ratio: { tex: String.raw`\symp(\text{sleeps} \mid \text{the cat}) = \frac{\operatorname{count}(\text{the cat sleeps})}{\operatorname{count}(\text{the cat})} = \frac{${CAT_COUNTS.rows.find((r) => r.w === 'sleeps')?.c ?? 0}}{${CAT_COUNTS.n}}`, x: 0.5, y: 0.86, size: 4.6 },
  },
  draw(s) {
    const { u, W } = dims(s);
    const { w } = s;
    // A window sliding over text.
    const wA = s.win('before', 'scan');
    s.alpha(wA, () => {
      heading(s, 'counting what comes next', 1, 18);
      const words = ['dog', 'chases', 'the', 'cat', '.', 'the', 'cat', 'sleeps'];
      const xs = chipRow(s, words, w / 2, 42 * u, { size: 3.3, gap: 0.8, k: () => 'orange' });
      const pos = 2 + Math.floor(clamp01(s.since('markov') / 5) * 5.99);
      s.alpha(s.ease('markov', 0.5), () => {
        const a = xs[pos - 2]!;
        const b = xs[pos - 1]!;
        const c = xs[Math.min(pos, xs.length - 1)]!;
        s.rrect(a.x - a.w / 2 - u, 36 * u, b.x + b.w / 2 - (a.x - a.w / 2) + 2 * u, 12 * u, 1.5, { stroke: s.c('blue'), lw: 0.5 });
        s.rrect(c.x - c.w / 2 - u, 36 * u, c.w + 2 * u, 12 * u, 1.5, { stroke: s.c('purple'), lw: 0.5 });
        s.text('context: 2 words', (a.x + b.x) / 2, 54 * u, { size: 3.4, color: s.c('blue') });
        s.text('next', c.x, 30.5 * u, { size: 3.4, color: s.c('purple') });
      });
      note(s, 'a trigram looks at the last two words', 70, s.ease('markov', 0.6, 1));
    });
    // Scanning the training text.
    const cA = s.win('scan', 'mle');
    if (cA > 0) {
      s.alpha(cA, () => {
        const lineW = (W - 10) * u;
        let x = 5 * u;
        let y = 16 * u;
        const size = 3.2;
        const sA = 1 - s.ease('next', 0.6);
        s.alpha(sA, () => {
          STREAM.forEach((wd, i) => {
            const ww = s.measure(`${wd} `, { font: 'mono', size });
            if (x + ww > 5 * u + lineW) {
              x = 5 * u;
              y += 5 * u;
            }
            const hit = (wd === 'the' && STREAM[i + 1] === 'cat') || (wd === 'cat' && STREAM[i - 1] === 'the');
            if (y < 52 * u) s.text(wd, x, y, { size, font: 'mono', align: 'left', color: hit ? s.c('orange') : s.c('--ink-3'), weight: hit ? 700 : 400 });
            x += ww;
          });
          s.text(`"the cat" appears ${CAT_COUNTS.n} times in 20,000 words`, w / 2, 62 * u, { size: 4, weight: 600, color: s.c('orange') });
        });
        const tA = s.ease('next', 0.6);
        s.alpha(tA, () => {
          heading(s, `what came after "the cat" (${CAT_COUNTS.n} times)`, 1, 16);
          const lit = current(s, ['next', 'dot']);
          const bars: Bar[] = CAT_COUNTS.rows.map((r) => ({
            label: r.w,
            v: r.c,
            k: r.w === '.' ? 'gold' : 'purple',
            on: (lit === 'next' && r.w === 'sleeps') || (lit === 'dot' && r.w === '.') ? 1 : 0,
            note: `${r.c}`,
          }));
          hbars(s, 10 * u, 22 * u, (W - 20) * u, 50 * u, bars, CAT_COUNTS.rows[0]!.c, { labelW: 14 });
          s.show('ratio', tA * (1 - s.ease('mle', 0.5)));
        });
      });
    }
    s.alpha(s.win('mle', 'real'), () => {
      heading(s, 'a count ratio is a trained model', 1, 30);
      note(s, 'it is exactly the maximum-likelihood estimate', 42, 1, '--ink-2', 3.8);
      note(s, 'for a model that sees two words', 49, 1, '--ink-2', 3.8);
    });
    // Contexts outgrow any data.
    const rA = s.win('real', 'history');
    if (rA > 0) {
      s.alpha(rA, () => {
        heading(s, 'possible contexts with 50,000 words', 1, 16);
        const rows: [string, number][] = [
          ['1 word', 4.7],
          ['2 words', 9.4],
          ['3 words', 14.1],
          ['4 words', 18.8],
        ];
        const x0 = 22 * u;
        const x1 = (W - 8) * u;
        const X = (e: number) => x0 + (e / 20) * (x1 - x0);
        const labels = ['50,000', '2.5 billion', '1.3e14', '6.3e18'];
        rows.forEach(([lab, e], i) => {
          const y = (27 + i * 11) * u;
          const a = s.ease('real', 0.5, 0.3 + i * 0.5);
          s.alpha(a, () => {
            s.text(lab, x0 - 2 * u, y + 3 * u, { size: 3.6, align: 'right', color: s.c('--ink-2') });
            s.rrect(x0, y, X(e) - x0, 6 * u, 0.8, { fill: s.tint('blue', 0.35) });
            s.text(labels[i]!, X(e) + (i === 0 ? 1.5 * u : -1.5 * u), y + 3 * u, { size: 3.4, font: 'mono', weight: 600, align: i === 0 ? 'left' : 'right', color: s.c('--ink'), halo: true });
          });
        });
        const dx = X(13);
        s.alpha(s.ease('real', 0.6, 2.5), () => {
          s.line(dx, 24 * u, dx, 72 * u, s.c('red'), 0.45, [1.4, 1]);
          s.text('a huge training set: 10^13 tokens', dx, 79 * u, { size: 3.5, color: s.c('red'), weight: 600 });
        });
        s.text('log scale', x1, 86 * u, { size: 3.2, italic: true, color: s.c('--ink-3'), align: 'right' });
      });
    }
    // A short history.
    const hA = s.ease('history', 0.6);
    if (hA > 0) {
      s.alpha(hA, () => {
        const ev: [string, string, string, K][] = [
          ['1948', 'Shannon', 'text from counts', 'slate'],
          ['2003', 'Bengio et al.', 'a neural network', 'blue'],
          ['2018', 'GPT, BERT', 'transformers', 'purple'],
        ];
        const y = 50 * u;
        const x0 = 14 * u;
        const x1 = (W - 14) * u;
        s.line(x0, y, x1, y, s.c('--axis'), 0.4);
        ev.forEach(([yr, who, what, k], i) => {
          const x = lerp(x0, x1, i / 2);
          s.alpha(s.ease('history', 0.5, 0.4 + i * 1.6), () => {
            s.circle(x, y, 1.8 * u, { fill: s.c(k) });
            s.text(yr, x, y - 7 * u, { size: 4.4, font: 'display', weight: 600 });
            s.text(who, x, y + 7 * u, { size: 3.6, weight: 600, color: s.c(k) });
            s.text(what, x, y + 12.5 * u, { size: 3.4, italic: true, color: s.c('--ink-2') });
          });
        });
        note(s, 'the objective never changed', 80, s.ease('history', 0.6, 5.5), 'red', 4);
      });
    }
  },
};

// ---------------------------------------------------------------- 5 loss

const loss: SceneDef = {
  marks: {
    L: { tex: String.raw`\symL = -\frac{1}{T}\sum_{t=1}^{T}\log \symp(\symx_t \mid \symx_{<t})`, x: 0.5, y: 0.8, size: 5 },
  },
  draw(s) {
    const { u, W } = dims(s);
    const { w } = s;
    const xs = chipRow(s, CHAIN_W, w / 2, 17 * u, { size: 3.9, k: () => 'orange' });
    const top = 22 * u;
    const scale = (32 * u) / 4;
    const barA = s.ease('surprise', 0.6);
    xs.forEach((c, i) => {
      const a = s.ease('surprise', 0.5, 0.6 + i * 0.35);
      s.alpha(a * barA, () => {
        const hh = SURP[i]! * scale;
        s.rrect(c.x - 2.2 * u, top, 4.4 * u, Math.max(0.3 * u, hh), 0.6, { fill: s.tint('red', 0.55) });
        s.text(SURP[i]!.toFixed(2), c.x, top + hh + 3 * u, { size: 3.2, font: 'mono', color: s.c('red') });
      });
    });
    s.alpha(barA, () => s.text('surprise = −log p', 5 * u, top + 36 * u, { size: 3.4, font: 'mono', align: 'left', color: s.c('red') }));
    // Average line, and the uniform model.
    const left = xs[0]!.x - xs[0]!.w / 2;
    const right = xs[xs.length - 1]!.x + xs[xs.length - 1]!.w / 2;
    s.alpha(s.ease('avg', 0.6), () => {
      const y = top + LOSS * scale;
      s.line(left, y, right, y, s.c('--ink'), 0.4, [1.4, 1]);
      s.text(`- - mean surprise: ${LOSS.toFixed(2)} nats`, (W - 5) * u, top + 36 * u, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('--ink') });
    });
    s.alpha(s.ease('uniform', 0.6), () => {
      const y = top + LOGV * scale;
      s.line(left, y, right, y, s.c('slate'), 0.4, [1.4, 1]);
      s.text(`knowing nothing: log 36 = ${LOGV.toFixed(2)}`, right, y + 3.4 * u, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('slate') });
    });
    // The surprise curve.
    const cA = s.win('curve', 'avg');
    if (cA > 0) {
      s.alpha(cA, () => {
        const fr = new Frame(s, 14 * u, 64 * u, (W - 28) * u, 26 * u, [0, 1, 0, 5]);
        s.line(fr.x, fr.Y(0), fr.x + fr.w, fr.Y(0), s.c('--axis'), 0.3);
        s.line(fr.x, fr.y, fr.x, fr.Y(0), s.c('--axis'), 0.3);
        const xsP = Array.from({ length: 120 }, (_, i) => 0.007 + (i / 119) * 0.993);
        fr.path(xsP, xsP.map((p) => -Math.log(p)), s.c('red'), 0.6);
        CHAIN_P.forEach((p) => fr.dot(p, -Math.log(p), 1.1, s.c('orange')));
        s.text('p = 1', fr.X(1), fr.Y(0) + 3 * u, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
        s.text('p → 0', fr.X(0.03), fr.Y(0) + 3 * u, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
        s.text('−log p', fr.X(0.12), fr.Y(4.6), { size: 3.4, font: 'mono', align: 'left', color: s.c('red') });
      });
    }
    s.show('L', s.ease('avg', 0.6, 0.6));
    s.alpha(s.win('same', 'here') , () => note(s, 'softmax cross-entropy, at every position', 92, 1));
    s.alpha(s.ease('here', 0.6) * (1 - s.ease('uniform', 0.5)), () => note(s, `about ${LOSS.toFixed(1)} nat per word`, 92, 1, '--ink'));
  },
};

// ---------------------------------------------------------------- 6 ppl

const ppl: SceneDef = {
  marks: {
    ppl: { tex: String.raw`\symPPL = e^{\symL}`, x: 0.5, y: 0.22, size: 7 },
    split: { tex: String.raw`H(\sympd, \symp) = H(\sympd) + \mathrm{KL}(\sympd \,\|\, \symp)`, x: 0.5, y: 0.2, size: 5 },
  },
  draw(s) {
    const { u, W } = dims(s);
    const { w } = s;
    const dA = s.win('def', 'floor');
    s.show('ppl', dA);
    s.alpha(s.win('hard', 'def'), () => {
      s.text('loss in nats  →  a count', w / 2, 40 * u, { size: 5, font: 'display', weight: 600 });
    });
    s.alpha(dA, () => {
      const sz = 6 * u;
      const f5 = s.win('faces', 'uniform');
      s.alpha(f5, () => {
        s.text('perplexity 5', w / 2, 38 * u, { size: 4.2, weight: 600, color: s.c('green') });
        faces(s, w / 2 - 2.5 * sz * 1.18, 44 * u, sz, 5, 'green', s.ease('faces', 0.8, 0.4));
        s.text('as unsure as a fair five-sided die, at every word', w / 2, 60 * u, { size: 3.7, italic: true, color: s.c('--ink-2') });
      });
      s.alpha(s.ease('uniform', 0.5), () => {
        s.text('uniform over 36 words: perplexity 36', w / 2, 38 * u, { size: 4.2, weight: 600, color: s.c('slate') });
        const per = 12;
        const fs = Math.min(sz, ((W - 16) * u) / (per * 1.18));
        faces(s, w / 2 - (per * fs * 1.18) / 2, 44 * u, fs, 36, 'slate', s.ease('uniform', 1.2, 0.3), 40, per);
      });
    });
    // The floor: the language's own distribution after "the big cat".
    const fA = s.ease('floor', 0.6);
    if (fA > 0) {
      s.alpha(fA * (1 - s.ease('toy', 0.6)), () => {
        s.text('next word after "the big cat"', w / 2, 34 * u, { size: 3.8, color: s.c('--ink-2') });
        const fr = new Frame(s, 8 * u, 40 * u, (W - 16) * u, 34 * u, [0, PPL_W.length, 0, 0.4]);
        const showQ = s.ease('pdata', 0.6);
        PPL_W.forEach((wd, i) => {
          const x0 = fr.X(i + 0.18);
          const x1 = fr.X(i + 0.82);
          if (PD[i]! > 0) s.rrect(x0, fr.Y(PD[i]!), x1 - x0, fr.Y(0) - fr.Y(PD[i]!), 0.6, { fill: s.tint('gold', 0.25), stroke: s.c('gold'), lw: 0.4 });
          s.alpha(showQ, () => s.rrect(x0 + (x1 - x0) * 0.25, fr.Y(QOFF[i]!), (x1 - x0) * 0.5, fr.Y(0) - fr.Y(QOFF[i]!), 0.5, { fill: s.tint('purple', 0.7) }));
          s.text(wd, (x0 + x1) / 2, fr.Y(0) + 3.4 * u, { size: 3.3, font: 'mono', color: s.c(PD[i]! > 0 ? '--ink-2' : 'red') });
        });
        s.line(fr.x, fr.Y(0), fr.x + fr.w, fr.Y(0), s.c('--axis'), 0.3);
        s.text('the language', 8 * u, 84 * u, { size: 3.6, align: 'left', weight: 600, color: s.c('gold') });
        s.alpha(showQ, () => s.text('a model', (W - 8) * u, 84 * u, { size: 3.6, align: 'right', weight: 600, color: s.c('purple') }));
        // The split.
        const sA = s.ease('split', 0.6);
        s.show('split', sA * (1 - s.ease('toy', 0.6)));
        s.alpha(sA, () => {
          const x0 = 12 * u;
          const tot = (W - 24) * u;
          const y = 90 * u;
          const fH = H_PD / CE_OFF;
          const klOn = s.ease('kl', 0.5);
          s.rrect(x0, y - 2.6 * u, tot * fH, 5.2 * u, 0.6, { fill: s.tint('gold', 0.6) });
          s.rrect(x0 + tot * fH, y - 2.6 * u, tot * (1 - fH), 5.2 * u, 0.6, { fill: s.tint('red', 0.35 + 0.4 * klOn) });
          s.text(`entropy ${H_PD.toFixed(2)}`, x0 + (tot * fH) / 2, y + 0.2 * u, { size: 3.3, font: 'mono', weight: 650, color: s.c('--ink') });
          s.alpha(klOn, () => s.text(`KL ${(CE_OFF - H_PD).toFixed(2)}`, x0 + tot * fH + (tot * (1 - fH)) / 2, y + 0.2 * u, { size: 3.3, font: 'mono', weight: 650, color: s.c('--ink') }));
        });
      });
    }
    // The toy floor.
    const tA = s.ease('toy', 0.6);
    s.alpha(tA, () => {
      heading(s, 'the floor of the toy language', 1, 22);
      s.text(`${ENTROPY.toFixed(2)} nats per word`, w / 2, 36 * u, { size: 5.2, font: 'mono', weight: 650, color: s.c('gold') });
      s.text(`perplexity ${Math.exp(ENTROPY).toFixed(2)}`, w / 2, 46 * u, { size: 4.2, font: 'mono', color: s.c('green') });
      const sz = 6 * u;
      faces(s, w / 2 - (Math.ceil(Math.exp(ENTROPY)) * sz * 1.18) / 2, 53 * u, sz, Math.exp(ENTROPY), 'gold', s.ease('toy', 0.8, 0.6));
      s.alpha(s.ease('real', 0.6), () => note(s, 'real text: the floor is unknown; scaling laws estimate it', 76, 1, '--ink-2', 3.7));
    });
  },
};

// ---------------------------------------------------------------- 7 teacher

const TF = C('the lazy cat chases a ball .').map(W_);

const teacher: SceneDef = {
  draw(s) {
    const { u, W } = dims(s);
    const { w } = s;
    const rowsA = s.win('how', 'net');
    if (rowsA > 0) {
      s.alpha(rowsA, () => {
        const n = TF.length - 1;
        const size = 3.6;
        const cw = Math.min(14 * u, ((W - 8) * u) / n);
        const x0 = w / 2 - (cw * n) / 2;
        const y1 = 26 * u;
        const y2 = 48 * u;
        const gen = s.ease('exposure', 0.6);
        s.text(gen > 0.5 ? 'training: reads the true text' : 'inputs', 4 * u, y1 - 8 * u, { size: 3.4, align: 'left', color: s.c('--ink-3') });
        s.text('targets: the same text, shifted by one', 4 * u, y2 + 8.5 * u, { size: 3.4, align: 'left', color: s.c('--ink-3') });
        // Which arrows are lit: one at a time, then all at once, then one at a time again.
        const seq = s.since('every') >= 0 && s.since('forcing') < 0 ? Math.floor(clamp01(s.prog('every')) * n * 0.999) : -1;
        const all = s.ease('parallel', 0.5) * (1 - s.ease('rnn', 0.4));
        const rnnStep = s.since('rnn') >= 0 && s.since('exposure') < 0 ? Math.floor(((s.since('rnn') * 2.2) % n)) : -1;
        for (let i = 0; i < n; i++) {
          const cx = x0 + cw * (i + 0.5);
          const on = i === seq || i === rnnStep ? 1 : all;
          s.cell(cx - cw * 0.46, y1 - 3.6 * u, cw * 0.92, 7.2 * u, TF[i]!, 'orange', { size, on });
          s.alpha(s.ease('how', 0.5, 1.2), () => {
            s.cell(cx - cw * 0.46, y2 - 3.6 * u, cw * 0.92, 7.2 * u, TF[i + 1]!, 'gold', { size, on });
            s.arrow(cx, y1 + 4 * u, cx, y2 - 4.4 * u, on > 0.5 ? s.c('--accent') : s.tint('--ink-3', 0.6), on > 0.5 ? 0.5 : 0.3, 1.8);
          });
        }
        s.alpha(s.ease('forcing', 0.5) * (1 - s.ease('parallel', 0.5)), () => note(s, 'every input is real text, never the model\'s own guess', 66, 1, 'green', 3.8));
        s.alpha(all, () => {
          s.rrect(x0 - 1 * u, y1 - 5 * u, cw * n + 2 * u, y2 - y1 + 10 * u, 1.6, { stroke: s.c('blue'), lw: 0.5 });
          note(s, 'one forward pass, every prediction at once', 66, 1, 'blue', 3.8);
          note(s, '2,048 tokens = 2,048 training examples', 73, s.ease('parallel', 0.6, 2), '--ink-2', 3.6);
        });
        s.alpha(s.win('rnn', 'exposure'), () => note(s, 'an RNN: one position after another', 66, 1, 'orange', 3.8));
        // Generation reads its own output.
        s.alpha(gen, () => {
          const y3 = 76 * u;
          s.text('generation: reads its own output', 4 * u, y3 - 6.5 * u, { size: 3.4, align: 'left', color: s.c('purple') });
          for (let i = 0; i < n; i++) {
            const cx = x0 + cw * (i + 0.5);
            const own = ['.', 'the', 'lazy', 'cat', 'sleeps', 'on', 'the'][i]!;
            s.cell(cx - cw * 0.46, y3 - 3.6 * u, cw * 0.92, 7.2 * u, own, 'purple', { size });
          }
          note(s, 'exposure bias: training never shows it its own mistakes', 90, s.ease('exposure', 0.6, 2), '--ink-2', 3.5);
        });
      });
    }
    // Held-out loss by context size: counting versus the network.
    const cA = s.ease('net', 0.6);
    if (cA > 0) {
      s.alpha(cA, () => {
        heading(s, 'held-out loss by words of context', 1, 15);
        const fr = new Frame(s, 14 * u, 22 * u, (W - 20) * u, 56 * u, [0.5, 4.5, 1.2, 1.75]);
        for (const g of [1.3, 1.4, 1.5, 1.6, 1.7]) {
          s.line(fr.x, fr.Y(g), fr.x + fr.w, fr.Y(g), s.c('--grid'), 0.25);
          s.text(g.toFixed(1), fr.x - 1.5 * u, fr.Y(g), { size: 3.2, font: 'mono', align: 'right', color: s.c('--ink-3') });
        }
        fr.hline(FLOOR, s.c('gold'), true, 0.45);
        const beatOf = ['one', 'one', 'three', 'four'];
        for (let i = 0; i < 4; i++) {
          const a = s.ease(beatOf[i]!, 0.6, i === 1 ? 0.8 : 0);
          if (a <= 0) continue;
          s.alpha(a, () => {
            const cx = fr.X(i + 1);
            const bw = (fr.w / 4) * 0.4;
            const bar = (x: number, v: number, k: K) => {
              const vv = Math.min(v, 1.75);
              s.rrect(x, fr.Y(vv), bw, fr.Y(1.2) - fr.Y(vv), 0.5, { fill: s.tint(k, 0.6) });
              s.text(v > 1.75 ? `${v.toFixed(2)}↑` : v.toFixed(2), x + bw / 2, fr.Y(vv) - 2.4 * u, { size: fit(s, '1.55', bw + 0.6 * u, 3.4), font: 'mono', weight: 600, color: s.c(k) });
            };
            bar(cx - bw - 0.3 * u, COUNT_LOSS[i]!, 'slate');
            bar(cx + 0.3 * u, NET_LOSS[i]!, 'purple');
            s.text(String(i + 1), cx, fr.Y(1.2) + 3.4 * u, { size: 3.6, font: 'mono', weight: 650 });
          });
        }
        s.line(fr.x, fr.Y(1.2), fr.x + fr.w, fr.Y(1.2), s.c('--axis'), 0.3);
        s.alpha(s.ease('one', 0.5), () => {
          const items: [string, K, boolean][] = [
            ['counting', 'slate', false],
            ['network', 'purple', false],
            [`floor ${FLOOR.toFixed(2)}`, 'gold', true],
          ];
          const iw = (W - 16) / 3;
          items.forEach(([lab, k, dash], i) => {
            const x = (8 + i * iw) * u;
            if (dash) s.line(x, 87.6 * u, x + 4 * u, 87.6 * u, s.c(k), 0.5, [1, 0.8]);
            else s.rrect(x, 86 * u, 3.4 * u, 3.4 * u, 0.4, { fill: s.tint(k, 0.6) });
            s.text(lab, x + 5.5 * u, 87.6 * u, { size: 3.4, align: 'left', color: s.c(dash ? k : '--ink-2'), font: dash ? 'mono' : 'serif', weight: dash ? 650 : 450 });
          });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- 8 greedy

function distBars(s: Scene, probs: Float64Array, ctx: number[], d: Decoding, x: number, y: number, ww: number, hh: number, n: number, opts: { showCut?: number; size?: number; vmax?: number } = {}): void {
  const rows = distRows(probs, ctx, d, n);
  const vmax = opts.vmax ?? Math.max(...rows.map((r) => r.p));
  const bars: Bar[] = rows.map((r) => ({
    label: W_(r.w),
    v: r.p,
    k: r.kept ? 'purple' : '--ink-3',
    labelK: r.ok ? undefined : 'red',
    on: r.kept ? 0.4 : 0,
    a: r.kept || opts.showCut === undefined ? 1 : 1 - 0.55 * (opts.showCut ?? 0),
  }));
  hbars(s, x, y, ww, hh, bars, vmax, { size: opts.size, labelW: 14 });
  const kept = rows.filter((r) => r.kept).length;
  if (opts.showCut !== undefined && kept < n) {
    const yy = y + (hh / n) * kept;
    s.alpha(opts.showCut, () => s.line(x, yy, x + ww, yy, s.c('teal'), 0.45, [1.4, 1]));
  }
}

const greedy: SceneDef = {
  marks: {
    temp: { tex: String.raw`q = \operatorname{softmax}(\text{logits} / \symtau)`, x: 0.5, y: 0.2, size: 5 },
  },
  draw(s) {
    const { u, W } = dims(s);
    const { w } = s;
    // The loop, with greedy picks.
    const lA = s.win('loop', 'human');
    if (lA > 0) {
      s.alpha(lA, () => {
        const nShown = s.since('greedy') < 0 ? 1 + Math.floor(clamp01(s.since('loop') / 9) * 3) : 4 + Math.floor(clamp01(s.since('loops') / 6) * (GREEDY.length - 4));
        const words = ['the', ...GREEDY].slice(0, nShown + 1);
        // Wrap the text into lines of whole sentences.
        const size = 3.8;
        let x = 6 * u;
        let y = 17 * u;
        words.forEach((wd, i) => {
          const ww = s.measure(`${wd} `, { font: 'mono', size });
          if (x + ww > (W - 6) * u) {
            x = 6 * u;
            y += 6 * u;
          }
          const last = i === words.length - 1;
          s.text(wd, x, y, { size, font: 'mono', align: 'left', color: last ? s.c('purple') : s.c('--ink'), weight: last ? 700 : 450 });
          x += ww;
        });
        const g = s.ease('greedy', 0.6);
        // The current distribution and the pick.
        const ctx = [DOT, ...words.slice(0, -1).map((x2) => IX.get(x2)!)];
        const pr = NGRAM.probs(ctx);
        const d: Decoding = g > 0.5 ? { ...PLAIN, greedy: true } : PLAIN;
        s.alpha(1 - s.ease('loops', 0.5, 1.2), () => {
          s.text(`next word after "${words.slice(-3, -1).join(' ')}"`, w / 2, 46 * u, { size: 3.5, color: s.c('--ink-2') });
          distBars(s, pr, ctx, d, 10 * u, 50 * u, (W - 20) * u, 30 * u, 5, { showCut: g });
          s.text(g > 0.5 ? 'pick: the most likely word' : 'pick, append, repeat', w / 2, 86 * u, { size: 3.8, weight: 600, color: s.c(g > 0.5 ? 'purple' : '--ink-2') });
        });
        s.alpha(s.ease('loops', 0.5, 1.2), () => {
          note(s, 'the cat sleeps . the dog runs . on repeat', 60, 1, 'red', 4);
        });
      });
    }
    s.alpha(s.win('human', 'sample'), () => {
      s.text('the most likely text', w / 2, 40 * u, { size: 5.2, font: 'display', weight: 600 });
      s.text('is not a typical text', w / 2, 50 * u, { size: 5.2, font: 'display', weight: 600, color: s.c('--accent') });
    });
    // Sampling, then temperature.
    const sA = s.ease('sample', 0.6);
    if (sA > 0) {
      s.alpha(sA, () => {
        const tau = s.since('cold') < 0 ? 1 : s.since('hot') < 0 ? lerp(1, 0.4, s.ease('cold', 2.5, 0.4)) : lerp(0.4, 2, s.ease('hot', 3, 0.3));
        const tOn = s.ease('temp', 0.5);
        s.show('temp', tOn);
        s.text('next word after "the cat"', w / 2, (tOn > 0.5 ? 31 : 17) * u, { size: 3.6, color: s.c('--ink-2') });
        distBars(s, CAT_P, CAT_CTX, { ...PLAIN, tau }, 10 * u, 35 * u, (W - 20) * u, 44 * u, 8, { vmax: 1 });
        s.alpha(tOn, () => s.text(`τ = ${tau.toFixed(2)}`, w / 2, 86 * u, { size: 4.4, font: 'mono', weight: 650, color: s.c('slate') }));
        s.alpha(s.win('tail', 'temp'), () => note(s, 'red words: the grammar forbids them here', 87, 1, 'red', 3.6));
      });
    }
  },
};

// ---------------------------------------------------------------- 9 nucleus

const nucleus: SceneDef = {
  draw(s) {
    const { u, W } = dims(s);
    const { w } = s;
    const dA = s.win('cut', 'measure');
    if (dA > 0) {
      s.alpha(dA, () => {
        const mode = current(s, ['cut', 'topk', 'fit', 'five', 'topp', 'adapt']);
        const isP = mode === 'topp' || mode === 'adapt';
        const d: Decoding = isP ? { ...PLAIN, topP: 0.9 } : mode === 'cut' ? PLAIN : { ...PLAIN, topK: 5 };
        const cutA = mode === 'cut' ? 0 : isP ? s.ease('topp', 0.6) : s.ease('topk', 0.6);
        heading(s, mode === 'cut' ? 'the head and the tail' : isP ? 'top-p = 0.9' : 'top-k = 5', 1, 15);
        const second = s.ease('fit', 0.6);
        const pw = second > 0 ? (W - 12) / 2 : W - 20;
        const panels: [string, Float64Array, number[]][] = [
          ['after "the"', THE_P, THE_CTX],
          ['after "the kids sleep on"', ON_P, ON_CTX],
        ];
        panels.forEach(([title, pr, ctx], i) => {
          if (i === 1 && second <= 0) return;
          const x = second > 0 ? (4 + i * (pw + 4)) * u : 10 * u;
          s.alpha(i === 1 ? second : 1, () => {
            s.text(title, x + (pw * u) / 2, 23 * u, { size: 3.4, font: 'mono', color: s.c('--ink-2') });
            distBars(s, pr, ctx, d, x, 27 * u, pw * u, 54 * u, 10, { showCut: cutA, size: 3.3, vmax: i === 1 ? 1 : 0.12 });
            const kept = shape(pr, d).kept;
            s.alpha(cutA, () => s.text(`${kept} kept`, x + (pw * u) / 2, 87 * u, { size: 3.6, font: 'mono', weight: 650, color: s.c('teal') }));
          });
        });
      });
    }
    // Quality versus diversity.
    const qA = s.ease('measure', 0.6);
    if (qA > 0) {
      s.alpha(qA, () => {
        const fr = new Frame(s, 16 * u, 18 * u, (W - 24) * u, 64 * u, [Math.log(0.9), Math.log(9), 0, 1.04]);
        for (const g of [0, 0.25, 0.5, 0.75, 1]) {
          s.line(fr.x, fr.Y(g), fr.x + fr.w, fr.Y(g), s.c('--grid'), 0.25);
          s.text(`${g * 100}%`, fr.x - 1.5 * u, fr.Y(g), { size: 3.1, font: 'mono', align: 'right', color: s.c('--ink-3') });
        }
        for (const c of [1, 2, 4, 8]) s.text(String(c), fr.X(Math.log(c)), fr.Y(0) + 3.4 * u, { size: 3.1, font: 'mono', color: s.c('--ink-3') });
        s.text('grammatical ↑', fr.x + 1 * u, fr.y - 2.5 * u, { size: 3.3, align: 'left', color: s.c('--ink-2') });
        s.text('choices per word →', fr.x + fr.w, fr.Y(0) + 8 * u, { size: 3.3, align: 'right', color: s.c('--ink-2') });
        const show = s.ease('plain', 0.8);
        const cols: Record<Method, K> = { tau: 'slate', k: 'orange', p: 'teal' };
        const names: Record<Method, string> = { tau: 'temperature', k: 'top-k', p: 'top-p' };
        (['tau', 'k', 'p'] as Method[]).forEach((m, i) => {
          const pts = CURVES[m];
          const lit = m === 'k' ? s.ease('lag', 0.5) : 0;
          fr.path(pts.map((q) => Math.log(q.c)), pts.map((q) => q.g), s.c(cols[m]), 0.5 + 0.3 * lit, Math.ceil(show * pts.length));
          pts.forEach((q, j) => {
            if (j < Math.ceil(show * pts.length) && q.c < 8.8) fr.dot(Math.log(q.c), q.g, 0.8, s.c(cols[m]));
          });
          const ly = fr.Y(0.38) + i * 5 * u;
          s.line(fr.x + 6 * u, ly, fr.x + 10 * u, ly, s.c(cols[m]), 0.6);
          s.text(names[m], fr.x + 11.5 * u, ly, { size: 3.3, align: 'left', color: s.c('--ink-2') });
        });
        star(s, fr.X(Math.log(LANG_CHOICES)), fr.Y(1), 2.2 * u, s.c('gold'));
        s.text('the language itself', fr.X(Math.log(LANG_CHOICES)) + 3 * u, fr.Y(1) + 0.3 * u, { size: 3.2, align: 'left', weight: 650, color: s.c('gold') });
        const plain = CURVES.tau[3]!;
        s.alpha(s.ease('plain', 0.6, 0.8), () => {
          s.circle(fr.X(Math.log(plain.c)), fr.Y(plain.g), 1.8 * u, { stroke: s.c('--ink'), lw: 0.5 });
          s.text(`plain sampling: ${Math.round(plain.g * 100)}%`, fr.X(Math.log(plain.c)) - 3 * u, fr.Y(plain.g) + 4.5 * u, { size: 3.4, font: 'mono', align: 'right', weight: 650 });
        });
      });
    }
  },
};

// ---------------------------------------------------------------- 10 bert

function matrix(s: Scene, x: number, y: number, cell: number, n: number, vis: (r: number, c: number) => boolean, pred: (r: number) => boolean, k: K): void {
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      const v = vis(r, c);
      s.rrect(x + c * cell + cell * 0.08, y + r * cell + cell * 0.08, cell * 0.84, cell * 0.84, 0.4, v ? { fill: s.tint(pred(r) ? k : '--ink-3', pred(r) ? 0.55 : 0.18) } : { stroke: s.tint('--ink-3', 0.3), lw: 0.2 });
    }
}

const bert: SceneDef = {
  draw(s) {
    const { u, W } = dims(s);
    const { w } = s;
    const words = ['.', ...BERT_S.slice(0, -1).map(W_)];
    const n = words.length;
    const mainA = 1 - s.ease('won', 0.6);
    const pw = (W - 12) / 2;
    const cell = Math.min(((pw - 4) * u) / n, 6.2 * u);
    const top = 30 * u;
    const showB = s.ease('bert', 0.6);
    const masked = (i: number) => i === KIDS + 1;
    s.alpha(mainA, () => {
      const heads: [string, string, K, number][] = [
        ['GPT', 'OpenAI, June 2018', 'blue', s.ease('two', 0.6, 0.6)],
        ['BERT', 'Google, October 2018', 'teal', s.ease('two', 0.6, 1.4)],
      ];
      heads.forEach(([name, sub, k, a], i) => {
        const cx = (4 + pw / 2 + i * (pw + 4)) * u;
        s.alpha(a, () => {
          s.text(name, cx, 15 * u, { size: 5.4, font: 'display', weight: 650, color: s.c(k) });
          s.text(sub, cx, 21.5 * u, { size: 3.3, font: 'mono', color: s.c('--ink-2') });
        });
      });
      // GPT's causal mask.
      s.alpha(s.ease('gpt', 0.6), () => {
        const x = (4 + pw / 2) * u - (cell * n) / 2;
        matrix(s, x, top, cell, n, (r, c) => c <= r, () => true, 'blue');
        s.alpha(1 - s.ease('mix', 0.5), () => s.text('sees only its left', (4 + pw / 2) * u, top + cell * n + 4 * u, { size: 3.4, italic: true, color: s.c('blue') }));
      });
      // BERT's full attention, with a hidden word.
      s.alpha(showB, () => {
        const x = (8 + pw * 1.5) * u - (cell * n) / 2;
        const mOn = s.ease('mlm', 0.5);
        s.alpha(mOn, () => {
          const mx = x + (KIDS + 1.5) * cell;
          s.text('[MASK]', mx, top - 2.6 * u, { size: 3.2, font: 'mono', weight: 700, color: s.c('teal') });
          s.line(mx, top - 1 * u, mx, top + 0.2 * u, s.c('teal'), 0.4);
        });
        matrix(s, x, top, cell, n, () => true, (r) => mOn < 0.5 || masked(r), 'teal');
        s.alpha(1 - s.ease('mix', 0.5), () => s.text('sees both sides', (8 + pw * 1.5) * u, top + cell * n + 4 * u, { size: 3.4, italic: true, color: s.c('teal') }));
      });
      // 80/10/10.
      s.alpha(s.win('mix', 'easier'), () => {
        const y = 84 * u;
        const x0 = 10 * u;
        const tot = (W - 20) * u;
        const parts: [number, K][] = [
          [0.8, 'teal'],
          [0.1, 'orange'],
          [0.1, 'slate'],
        ];
        let x = x0;
        parts.forEach(([f, k]) => {
          s.rrect(x, y - 3 * u, tot * f - 0.4 * u, 6 * u, 0.6, { fill: s.tint(k, 0.5) });
          x += tot * f;
        });
        s.text('80%: [MASK]', x0 + tot * 0.4, y + 0.3 * u, { size: 3.4, font: 'mono', weight: 650 });
        s.text('10% random word', x0 + tot, y + 7 * u, { size: 3.4, font: 'mono', align: 'right', color: s.c('orange') });
        s.text('10% unchanged', x0 + tot, y + 12 * u, { size: 3.4, font: 'mono', align: 'right', color: s.c('slate') });
        s.text('of the chosen 15%:', x0, y - 6.5 * u, { size: 3.4, italic: true, align: 'left', color: s.c('--ink-2') });
      });
      // Both sides make the blank easier.
      s.alpha(s.ease('easier', 0.6) * (1 - s.ease('signal', 0.5)), () => {
        s.text('the [MASK] sleep in the park .', w / 2, 81 * u, { size: 3.8, font: 'mono', weight: 600 });
        s.text(`left only: ${BITS_LEFT.toFixed(1)} bits`, (4 + pw / 2) * u, 90 * u, { size: fit(s, 'left only: 3.7 bits', (pw - 2) * u, 3.7), font: 'mono', weight: 650, color: s.c('blue') });
        s.text(`both sides: ${BITS_BOTH.toFixed(1)} bits`, (8 + pw * 1.5) * u, 90 * u, { size: fit(s, 'both sides: 2.0 bits', (pw - 2) * u, 3.7), font: 'mono', weight: 650, color: s.c('teal') });
      });
      s.alpha(s.ease('signal', 0.6), () => {
        s.text(`${n} of ${n} teach`, (4 + pw / 2) * u, 83 * u, { size: 3.8, font: 'mono', weight: 650, color: s.c('blue') });
        s.text(`1 of ${n} teaches`, (8 + pw * 1.5) * u, 83 * u, { size: 3.8, font: 'mono', weight: 650, color: s.c('teal') });
        s.text('and only GPT generates, left to right', w / 2, 92 * u, { size: 3.5, italic: true, color: s.c('--ink-2') });
      });
    });
    // Where each line went.
    const wA = s.ease('won', 0.6);
    s.alpha(wA, () => {
      heading(s, 'what each line became', 1, 18);
      const rows: [string, string, K][] = [
        ['decoders', 'GPT → GPT-2 → GPT-3 → chat models', 'blue'],
        ['encoders', 'BERT → RoBERTa → search embeddings', 'teal'],
      ];
      rows.forEach(([a, b, k], i) => {
        const y = (32 + i * 22) * u;
        card(s, 6 * u, y, (W - 12) * u, 16 * u, k, i === 0 ? 0.8 : 0.2);
        s.text(a, 12 * u, y + 5.5 * u, { size: 4, font: 'display', weight: 600, align: 'left', color: s.c(k) });
        s.text(b, 12 * u, y + 11 * u, { size: 3.4, font: 'mono', align: 'left' });
      });
      note(s, 'every token teaches, and a writer can do any text task', 82, s.ease('won', 0.6, 2), '--ink-2', 3.6);
    });
  },
};

// ---------------------------------------------------------------- 11 compress

const NEEDS: [string, string][] = [
  ['"The capital of France is"', 'a fact'],
  ['"17 + 25 ="', 'arithmetic'],
  ['"The keys to the cabinet"', 'grammar'],
  ['"def mean(xs): return"', 'code'],
];

const compress: SceneDef = {
  draw(s) {
    const { u, W } = dims(s);
    const { w } = s;
    s.alpha(s.win('why', 'claim'), () => {
      heading(s, 'predicting the next word needs...', 1, 18);
      NEEDS.forEach(([ctx, need], i) => {
        const y = (32 + i * 13) * u;
        s.alpha(s.ease('why', 0.5, 2 + i * 0.8), () => {
          s.text(ctx, 6 * u, y, { size: 3.5, font: 'mono', align: 'left' });
          s.text(need, (W - 6) * u, y, { size: 3.8, weight: 650, align: 'right', color: s.c('purple') });
        });
      });
    });
    s.alpha(s.win('claim', 'start'), () => {
      s.text('a predictor', w / 2, 40 * u, { size: 6, font: 'display', weight: 600, color: s.c('purple') });
      s.text('is a compressor', w / 2, 52 * u, { size: 6, font: 'display', weight: 600, color: s.c('red') });
    });
    // Arithmetic coding, row by row.
    const aA = s.ease('start', 0.6) * (1 - s.ease('numbers', 0.6));
    if (aA > 0) {
      s.alpha(aA, () => {
        const T = COMP_X.length;
        const shown = s.since('slice') < 0 ? 0 : Math.min(T, 1 + Math.floor(Math.max(0, s.since('zoom')) / 0.5) + (s.since('zoom') < 0 ? 0 : 1));
        const lw = 16 * u;
        const rw = 12 * u;
        const bx = 4 * u + lw;
        const bwid = (W - 8) * u - lw - rw;
        const top = 17 * u;
        const rh = 9 * u;
        const bh = 4.2 * u;
        // The starting interval.
        s.text('0', bx, top - 3 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
        s.text('1', bx + bwid, top - 3 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
        let total = 0;
        for (let t = 0; t < Math.max(1, shown); t++) {
          const r = COMP_NGRAM[t]!;
          const y = top + t * rh;
          const vis = shown > t;
          let acc = 0;
          for (let i = 0; i < V; i++) {
            const sw = r.pr[i]! * bwid;
            const on = vis && i === COMP_X[t];
            s.ctx.fillStyle = on ? s.tint('orange', 0.85) : s.tint(i % 2 ? 'purple' : 'blue', vis ? 0.18 : 0.08);
            s.ctx.fillRect(bx + acc, y, Math.max(on ? 1.5 : 0, sw - (sw > 2 ? 0.5 : 0)), bh);
            acc += sw;
          }
          s.rrect(bx, y, bwid, bh, 0.3, { stroke: s.tint('--ink-3', 0.6), lw: 0.2 });
          if (!vis) continue;
          s.text(W_(COMP_X[t]!), bx - 1.5 * u, y + bh / 2, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('orange') });
          const b = -Math.log2(r.p);
          total += b;
          s.text(b.toFixed(1), (W - 4) * u, y + bh / 2, { size: 3.3, font: 'mono', weight: 650, align: 'right', color: s.c('red') });
          if (t < T - 1 && shown > t + 1) {
            const s0 = bx + r.below * bwid;
            const s1 = s0 + r.p * bwid;
            s.line(s0, y + bh, bx, y + rh, s.tint('orange', 0.6), 0.2);
            s.line(s1, y + bh, bx + bwid, y + rh, s.tint('orange', 0.6), 0.2);
          }
        }
        s.alpha(s.ease('width', 0.6), () => {
          const width = COMP_NGRAM.reduce((a, r) => a * r.p, 1);
          s.text(`width = ${sci(width, 3)}  →  ${total.toFixed(1)} bits`, w / 2, 86 * u, { size: 3.9, font: 'mono', weight: 650, color: s.c('red') });
        });
        s.alpha(s.ease('size', 0.6), () => note(s, 'compressed size = the loss, in bits', 93, 1, '--ink', 3.7));
      });
    }
    // Bits for the same sentence, by model.
    const nA = s.ease('numbers', 0.6);
    s.alpha(nA, () => {
      heading(s, '"the lazy dog chases a ball ." in bits', 1, 16);
      const bars: Bar[] = [
        { label: 'uniform', v: BITS.uniform, k: 'slate', note: BITS.uniform.toFixed(1) },
        { label: 'n-gram', v: BITS.ngram, k: 'purple', note: BITS.ngram.toFixed(1) },
        { label: 'grammar', v: BITS.grammar, k: 'gold', note: BITS.grammar.toFixed(1) },
        { label: 'as text', v: 50, k: 'red', note: '224 →' },
      ];
      hbars(s, 6 * u, 24 * u, (W - 12) * u, 40 * u, bars, 50, { labelW: 18 });
      s.alpha(s.ease('floor', 0.6), () => {
        note(s, 'the entropy is the smallest possible average size', 76, 1, '--ink', 3.7);
        note(s, 'Shannon (1951): people manage about 1 bit per character', 84, s.ease('floor', 0.6, 2.5), '--ink-2', 3.5);
      });
    });
  },
};

// ---------------------------------------------------------------- 12 icl

const icl: SceneDef = {
  draw(s) {
    const { u, W } = dims(s);
    const { w } = s;
    const promptCard = (lines: [string, K][], y: number, a: number) =>
      s.alpha(a, () => {
        const hh = (lines.length * 6 + 4) * u;
        card(s, 10 * u, y * u, (W - 20) * u, hh, '--ink-3', 0.2);
        lines.forEach(([l, k], i) => s.text(l, 15 * u, (y + 5 + i * 6) * u, { size: 3.7, font: 'mono', align: 'left', color: s.c(k) }));
      });
    s.alpha(s.win('gpt2', 'gpt3'), () => {
      heading(s, 'GPT-2 (2019): tasks written as text', 1, 18);
      promptCard([['…a long news article…', '--ink-3'], ['TL;DR:', 'purple'], ['… something like a summary', 'green']], 30, s.ease('gpt2', 0.6, 1));
    });
    s.alpha(s.win('gpt3', 'why'), () => {
      heading(s, 'GPT-3 (2020): 175 billion parameters', 1, 18);
      promptCard([
        ['Translate English to French:', '--ink-2'],
        ['dog → chien', '--ink'],
        ['cow → vache', '--ink'],
        ['cat →', 'purple'],
      ], 28, s.ease('gpt3', 0.6, 1));
      s.alpha(s.ease('icl', 0.6), () => {
        s.rrect(w / 2 - 34 * u, 66 * u, 68 * u, 10 * u, 2, { fill: s.tint('green', 0.12), stroke: s.c('green'), lw: 0.4 });
        s.text('no gradient step, no weight change', w / 2, 71 * u, { size: 3.8, weight: 650, color: s.c('green') });
        note(s, 'in-context learning · few-shot prompting', 85, s.ease('icl', 0.6, 2), '--ink-2', 3.7);
      });
    });
    s.alpha(s.win('why', 'toy'), () => {
      heading(s, 'the web is full of patterns', 1, 18);
      const docs: string[][] = [
        ['apple: red', 'banana: yellow', 'lime: green'],
        ['Q: 2 + 2?', 'A: 4', 'Q: 3 + 5?'],
        ['hello = hola', 'thanks = gracias', 'cat = gato'],
      ];
      const dw = (W - 16) / 3;
      docs.forEach((d, i) => {
        const x = (4 + i * (dw + 4)) * u;
        s.alpha(s.ease('why', 0.5, 1 + i * 0.6), () => {
          card(s, x, 30 * u, dw * u, 28 * u, 'slate', 0.2);
          d.forEach((l, j) => s.text(l, x + 2 * u, (36 + j * 6.5) * u, { size: Math.min(3.2, (dw / 14)), font: 'mono', align: 'left' }));
        });
      });
      note(s, 'to predict the next line, work out which pattern this is', 72, s.ease('why', 0.6, 4), '--ink', 3.6);
    });
    // The Bayesian toy.
    const tA = s.ease('toy', 0.6);
    if (tA > 0) {
      s.alpha(tA, () => {
        const K = s.since('one') < 0 ? 0 : s.since('two') < 0 ? 1 : 2;
        const pr = ICL[K]!;
        const lines = TASKS[FRENCH]!.answers.slice(0, K).map((a, i) => `${['cat', 'dog'][i]} → ${a}`);
        const promptY = 14 * u;
        card(s, 6 * u, promptY, 34 * u, 24 * u, '--ink-3', 0.2);
        lines.forEach((l, i) => s.text(l, 9 * u, promptY + (6 + i * 6) * u, { size: 3.5, font: 'mono', align: 'left' }));
        s.text('duck →', 9 * u, promptY + (6 + K * 6) * u, { size: 3.5, font: 'mono', align: 'left', color: s.c('purple'), weight: 650 });
        s.text(`${K} example${K === 1 ? '' : 's'}`, 23 * u, promptY + 28 * u, { size: 3.3, italic: true, color: s.c('--ink-3') });
        const bx = 46 * u;
        const bw = (W - 50) * u;
        s.text('which kind of list?', bx + bw / 2, 15 * u, { size: 3.4, color: s.c('--ink-2') });
        const tb: Bar[] = TASKS.map((t, i) => ({ label: t.label, v: pr.posterior[i]!, k: 'blue', on: i === FRENCH ? 1 : 0 }));
        hbars(s, bx, 18 * u, bw, 24 * u, tb, 1, { labelW: 13, size: 3.2 });
        const order = ANSWERS.map((a, i) => ({ a, p: pr.answer[i]! })).sort((x, y) => y.p - x.p).slice(0, 4);
        s.text('next word after "duck →"', w / 2, 52 * u, { size: 3.6, color: s.c('--ink-2') });
        const ab: Bar[] = order.map((o) => ({ label: o.a, v: o.p, k: o.a === 'canard' ? 'green' : 'purple', on: o.a === 'canard' ? 1 : 0, labelK: o.a === 'canard' ? 'green' : undefined }));
        hbars(s, 10 * u, 56 * u, (W - 20) * u, 28 * u, ab, 1, { labelW: 18, size: 3.4 });
        s.alpha(s.ease('none', 0.6), () => note(s, 'the prompt alone selected the task', 92, 1, 'green', 3.8));
      });
    }
  },
};

// ---------------------------------------------------------------- 13 outro

const RECAP: [string, string, K, string][] = [
  ['chain rule', 'p(text) = Π p(next)', 'purple', 'r1'],
  ['cross-entropy', 'mean surprise', 'red', 'r2'],
  ['perplexity', 'choices, floor', 'green', 'r3'],
  ['decoding', 'greedy, τ, top-p', 'slate', 'r4'],
  ['GPT vs BERT', 'every token teaches', 'blue', 'r5'],
  ['why it works', 'compression, in-context', 'gold', 'r6'],
];

const outro: SceneDef = {
  draw(s) {
    const { u, W } = dims(s);
    const { w } = s;
    s.alpha(s.win('recap', 'r1'), () => {
      s.text('the chapter in six ideas', w / 2, s.h * 0.46, { size: 6, font: 'display', weight: 600 });
    });
    const tA = s.ease('r1', 0.6) * (1 - s.ease('next', 0.6, 0.3) * 0.94);
    s.alpha(tA, () => {
      const cols = 2;
      const gap = 2.6 * u;
      const tw = ((W - 10) * u - gap) / cols;
      const th = 20 * u;
      const cur = current(s, RECAP.map((r) => r[3]));
      RECAP.forEach(([name, sub, k, beat], i) => {
        const a = s.ease(beat, 0.5);
        if (a <= 0.003) return;
        const x = 5 * u + (i % cols) * (tw + gap);
        const y = 15 * u + Math.floor(i / cols) * (th + gap);
        s.alpha(a, () => {
          card(s, x, y, tw, th, k, cur === beat ? 1 : 0.25);
          s.text(name, x + tw / 2, y + th * 0.38, { size: fit(s, name, tw - 3 * u, 4.6, 'display', 600), font: 'display', weight: 600 });
          s.text(sub, x + tw / 2, y + th * 0.72, { size: fit(s, sub, tw - 3 * u, 3.5), font: 'mono', color: s.c(k) });
        });
      });
    });
    s.alpha(s.ease('next', 0.7, 0.4), () => {
      s.text('next: the interactive chapter', w / 2, s.h * 0.42, { size: 6.2, font: 'display', weight: 600 });
      s.text('train a small language model in your browser', w / 2, s.h * 0.54, { size: 3.8, italic: true, color: s.c('--ink-2') });
      s.alpha(s.ease('bye', 0.6), () => s.text('see you there', w / 2, s.h * 0.68, { size: 4.6, font: 'display', italic: true, color: s.c('--accent') }));
    });
  },
};

export const scenes: Record<string, SceneDef> = {
  intro,
  next,
  chain,
  ngram,
  loss,
  ppl,
  teacher,
  greedy,
  nucleus,
  bert,
  compress,
  icl,
  outro,
};

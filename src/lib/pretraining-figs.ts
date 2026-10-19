import type { Page } from '../core/page';
import { fmt } from '../core/code';
import { color, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { type Decoding, PLAIN, type SweepPoint, draw, generate, score, shape } from './pretraining-decode';
import { chip, line, measure, pct, rbox, sci, text } from './pretraining-draw';
import { ANIMALS, ANSWERS, TASKS, predict } from './pretraining-icl';
import {
  BIGRAM, DOT, FIVEGRAM, FOURGRAM, HELD, IX, NGRAM, START, TRAIN, TRIGRAM, UNIGRAM, V, VOCAB,
  maskedPosteriors, stateAfter, step, tok, trueNll, trueProbs,
} from './pretraining-lang';
import { WindowLM } from './pretraining-mlp';

/* ------------------------------------------------------------------ */
/* shared bits                                                          */
/* ------------------------------------------------------------------ */

/** Green for an unsurprising token, gold in between, red for a surprising one. */
function surpriseColor(p: number): string {
  const s = -Math.log(Math.max(p, 1e-12)) / Math.log(V);
  return s < 0.3 ? color('green') : s < 0.65 ? color('gold') : color('red');
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** A monospace panel for generated text. */
function textPanel(minH = '4.4em'): HTMLDivElement {
  const el = document.createElement('div');
  Object.assign(el.style, {
    fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace",
    fontSize: '12.5px', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    background: 'var(--paper)', border: '1px solid var(--rule)', borderRadius: '10px',
    padding: '9px 12px', minHeight: minH, color: 'var(--ink)', fontVariantLigatures: 'none',
  });
  return el;
}

/**
 * Words as HTML, checked against the grammar from state `s0`: the first word a sentence cannot
 * take is red, and the rest of that sentence is dimmed until its ".".
 */
function wordsHtml(ids: number[], s0 = START): string {
  let s = s0;
  let out = '';
  for (const w of ids) {
    let cls = '';
    if (s >= 0) {
      const nx = step(s, w);
      if (nx < 0) {
        cls = 'color:var(--c-red);font-weight:650;text-decoration:underline wavy';
        s = -1;
      } else s = nx;
    } else cls = 'color:var(--c-red);opacity:0.6';
    const t = esc(VOCAB[w]!);
    if (w === DOT) out = out.replace(/ $/, '');
    out += (cls ? `<span style="${cls}">${t}</span>` : t) + (w === DOT ? '\n' : ' ');
    if (w === DOT) s = START;
  }
  return out.trim();
}

const CTX = (s: string): number[] => [DOT, ...tok(s)];

/* ------------------------------------------------------------------ */
/* Fig: the chain rule                                                  */
/* ------------------------------------------------------------------ */

export function figChain(p: Page): void {
  const SENTS = [
    { value: 'the cat sleeps on the mat .', label: 'ordinary' },
    { value: 'a lazy dog chases the birds .', label: 'longer' },
    { value: 'the cats sleeps .', label: 'agreement error' },
    { value: 'mat the on sleeps cat the .', label: 'word salad' },
  ];
  p.figure({
    title: 'The chain rule, one word at a time',
    codeTitle: 'chain_rule.py',
    code: `
      x = tokenize("{{sent:the cat sleeps on the mat .}}")
      prob, logp = 1.0, 0.0
      for t in range(len(x)):                     #@loop
          probs = model(x[:t])    # p(next | x[:t])  #@model
          prob *= probs[x[t]]     # the word that came  #@mul
          logp += np.log(probs[x[t]])               #@mul
      # t = {{t:0}}   x[t] = "{{w:the}}"   p = {{pt:…}}
      # prob = {{prob:…}}   logp = {{logp:…}}
    `,
    setup(f) {
      let x: number[] = [];
      let dists: Float64Array[] = [];
      let cur = 0;
      const load = (s: string) => {
        x = tok(s);
        dists = x.map((_, t) => NGRAM.probs([DOT, ...x.slice(0, t)]));
      };
      load(SENTS[0]!.value);
      const pOf = (t: number) => dists[t]![x[t]!]!;
      const cv = f.canvas(640, 470, (ctx, w, h) => {
        const pad = 10;
        // the sentence, with the probability under each word read so far
        const ch = 26;
        const gap = 6;
        const ws = x.map((wd) => measure(ctx, VOCAB[wd]!, { font: 'mono', size: 12.5 }) + 14);
        const tot = ws.reduce((a, b) => a + b, 0) + gap * (x.length - 1);
        let cx = (w - tot) / 2;
        const labs = x.map((_, t) => pct(pOf(t)));
        const crowded = x.some((_, t) => t > 0 && measure(ctx, labs[t]!, { font: 'mono', size: 11, weight: 600 }) / 2 + measure(ctx, labs[t - 1]!, { font: 'mono', size: 11, weight: 600 }) / 2 + 4 > (ws[t]! + ws[t - 1]!) / 2 + gap);
        x.forEach((wd, t) => {
          const on = t === cur;
          const done = t <= cur;
          const k = done ? color('orange') : color('--ink-3');
          chip(ctx, VOCAB[wd]!, cx, pad, ch, { size: 12.5, minW: ws[t], fill: withAlpha(k, on ? 0.3 : done ? 0.12 : 0.05), stroke: withAlpha(k, on ? 1 : 0.5), bold: on });
          if (done) text(ctx, labs[t]!, cx + ws[t]! / 2, pad + ch + 11 + (crowded && t % 2 ? 13 : 0), { font: 'mono', size: 11, weight: 600, color: surpriseColor(pOf(t)) });
          cx += ws[t]! + gap;
        });
        // the next-word distribution at the current position
        const d = dists[cur]!;
        const order = Array.from({ length: V }, (_, i) => i).sort((a, b) => d[b]! - d[a]!);
        const rows = order.slice(0, 7);
        const tgt = x[cur]!;
        const extra = !rows.includes(tgt);
        if (extra) rows.push(tgt);
        const ctxWords = ['.', ...x.slice(0, cur).map((i) => VOCAB[i]!)];
        const shown = ctxWords.length > 4 ? `… ${ctxWords.slice(-4).join(' ')}` : ctxWords.join(' ');
        const top = pad + ch + 44;
        text(ctx, `next word after "${shown}"`, pad, top, { size: 12, color: color('--ink-2'), align: 'left' });
        const y0 = top + 14;
        const bottom = h - 58;
        const rh = (bottom - y0) / 8;
        const lw = 62;
        const bwMax = w - lw - 70;
        const sc = bwMax / Math.max(0.3, ...rows.map((r) => d[r]!));
        rows.forEach((wd, r) => {
          const y = y0 + (extra && r === rows.length - 1 ? r + 0.25 : r) * rh;
          const isT = wd === tgt;
          const pv = d[wd]!;
          text(ctx, VOCAB[wd]!, lw - 8, y + rh / 2, { font: 'mono', size: 12, weight: isT ? 700 : 500, color: isT ? color('orange') : color('--ink'), align: 'right' });
          const bw = Math.max(2, sc * pv);
          rbox(ctx, lw, y + rh * 0.16, bw, rh * 0.68, 3, withAlpha(isT ? color('orange') : color('purple'), isT ? 0.75 : 0.35), null);
          text(ctx, pct(pv), lw + bw + 6, y + rh / 2, { font: 'mono', size: 11, color: color('--ink-2'), align: 'left' });
        });
        if (extra) text(ctx, '⋮', lw - 30, y0 + 7 * rh, { size: 12, color: color('--ink-3') });
        // the running product and log-sum
        const ps = x.slice(0, cur + 1).map((_, t) => pOf(t));
        const tail = ps.length > 4 ? ps.slice(-3) : ps;
        const lead = ps.length > 4 ? '… × ' : '';
        const prod = ps.reduce((a, b) => a * b, 1);
        const lp = ps.reduce((a, b) => a + Math.log(b), 0);
        const fs = w < 420 ? 11 : 12.5;
        text(ctx, ps.length === 1 ? `prob = ${sci(prod)}` : `prob = ${lead}${tail.map((v) => sci(v)).join(' × ')} = ${sci(prod)}`, pad, h - 38, { font: 'mono', size: fs, color: color('purple'), align: 'left', weight: 600 });
        const ltail = ps.length > 4 ? ps.slice(-3) : ps;
        const llead = ps.length > 4 ? '… ' : '';
        const terms = ltail.map((v, i) => `${i || llead ? (Math.log(v) < 0 ? '− ' : '+ ') : Math.log(v) < 0 ? '−' : ''}${Math.abs(Math.log(v)).toFixed(2)}`).join(' ');
        text(ctx, ps.length === 1 ? `logp = ${lp.toFixed(2)}` : `logp = ${llead}${terms} = ${lp.toFixed(2)}`, pad, h - 16, { font: 'mono', size: fs, color: color('--ink'), align: 'left' });
      });
      cv.canvas.classList.add('scroll-ok');
      const sync = () => {
        const pv = pOf(cur);
        const ps = x.slice(0, cur + 1).map((_, t) => pOf(t));
        const prod = ps.reduce((a, b) => a * b, 1);
        const lp = ps.reduce((a, b) => a + Math.log(b), 0);
        f.code.setMany({ t: cur, w: VOCAB[x[cur]!]!, pt: sci(pv, 3), prob: sci(prod, 3), logp: lp.toFixed(3) });
        f.code.highlight(['model', 'mul']);
        cv.redraw();
      };
      const stepper = f.stepper({
        steps: x.length,
        interval: 1100,
        label: (k) => `word ${k + 1} of ${x.length}`,
        onStep: (k) => {
          cur = k;
          sync();
        },
      });
      f.segmented({
        label: 'sentence',
        options: SENTS,
        value: SENTS[0]!.value,
        slot: 'sent',
        onChange: (v) => {
          load(v);
          stepper.setSteps(x.length);
          stepper.go(0);
        },
      });
    },
    caption: `The model here is this chapter's n-gram model, built by counting the 20,000-word training text (every sentence is read after a ".", the end of the one before). Step through a sentence. The bars are the model's whole prediction for the next word; the orange bar is the word that really came, and its probability is one factor of the product. An ordinary sentence keeps every factor reasonable. In **agreement error**, *sleeps* after *the cats* gets well under 1% and drags the whole product down; in **word salad** nearly every factor is tiny. Watch the product shrink toward zero while the log-sum just walks steadily down: that is why code always adds logs.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: cross-entropy and perplexity                                    */
/* ------------------------------------------------------------------ */

export function figPerplexity(p: Page): void {
  const W = ['sleeps', 'runs', 'sees', 'likes', 'chases', 'sleep', 'the', '.'];
  const all = trueProbs(tok('the big cat'));
  const PD = W.map((w) => all[IX.get(w)!]!);
  const n = W.length;
  const PRESETS: Record<string, number[]> = {
    uniform: W.map(() => 1 / n),
    match: [...PD],
    sure: W.map((_, i) => (i === 0 ? 0.86 : 0.02)),
    leaky: PD.map((v) => 0.7 * v + 0.3 / n),
  };
  p.figure({
    title: 'Perplexity: the effective number of choices',
    codeTitle: 'perplexity.py',
    code: `
      # the next word after "the big cat"
      words = ["sleeps", "runs", "sees", "likes",
               "chases", "sleep", "the", "."]
      p_data = np.array([.25, .2, .2, .15, .2, 0, 0, 0])
      probs = np.array([{{qa}},   # the model
                        {{qb}}])

      nz = p_data > 0                 # 0 log 0 counts as 0
      loss = -(p_data[nz] * np.log(probs[nz])).sum()  #@ce
      ppl = np.exp(loss)              # {{ppl}}         #@ppl
      floor = -(p_data[nz] * np.log(p_data[nz])).sum() #@floor
      kl = loss - floor               # {{kl}}          #@kl
      # loss = {{loss}} nats, floor = {{floor}} nats
    `,
    setup(f) {
      let q = [...PRESETS.uniform!];
      const pl = f.plot({
        aspect: 1.55,
        square: false,
        domain: [0, n, -0.17, 1.06],
        draw: (pp) => {
          const ctx = pp.ctx;
          for (const g of [0.25, 0.5, 0.75, 1]) {
            line(ctx, pp.sx(0), pp.sy(g), pp.sx(n), pp.sy(g), color('--grid'), 1);
          }
          line(ctx, pp.sx(0), pp.sy(0), pp.sx(n), pp.sy(0), color('--axis'), 1);
          const bw = 0.62;
          W.forEach((wd, i) => {
            const x0 = pp.sx(i + 0.5 - bw / 2);
            const x1 = pp.sx(i + 0.5 + bw / 2);
            const bad = PD[i] === 0;
            rbox(ctx, x0, pp.sy(q[i]!), x1 - x0, pp.sy(0) - pp.sy(q[i]!), 3, withAlpha(color('purple'), bad ? 0.3 : 0.6), color('purple'), 1);
            if (PD[i]! > 0) {
              ctx.setLineDash([4, 3]);
              rbox(ctx, x0 - 2, pp.sy(PD[i]!), x1 - x0 + 4, pp.sy(0) - pp.sy(PD[i]!), 3, null, color('gold'), 2);
              ctx.setLineDash([]);
            }
            text(ctx, pct(q[i]!), (x0 + x1) / 2, pp.sy(Math.max(q[i]!, PD[i]!)) - 9, { font: 'mono', size: 11, color: color('--ink'), weight: 600 });
            text(ctx, wd, (x0 + x1) / 2, pp.sy(-0.085), { font: 'mono', size: pp.w < 420 ? 11 : 12, color: bad ? color('red') : color('--ink-2') });
          });
        },
      });
      const dice = f.canvas(640, 104, (ctx, w, h) => {
        const L = loss();
        const F = floor();
        const rows: [string, number, string][] = [
          ['the model', Math.exp(L), color('purple')],
          ['the language', Math.exp(F), color('gold')],
        ];
        const lw = w < 420 ? 98 : 118;
        rows.forEach(([lab, k, c], r) => {
          const y = 10 + r * (h / 2);
          const sz = Math.min(26, (w - lw - 92) / 12);
          text(ctx, lab, 4, y + sz / 2, { size: 12, color: color('--ink-2'), align: 'left' });
          const shown = Math.min(k, 12);
          for (let i = 0; i < Math.ceil(shown); i++) {
            const fr = Math.min(1, shown - i);
            const x0 = lw + i * (sz + 3);
            rbox(ctx, x0, y, sz, sz, 4, null, withAlpha(c, 0.6), 1.2);
            rbox(ctx, x0, y, sz * fr, sz, 4, withAlpha(c, 0.45), null);
          }
          const tx = lw + Math.ceil(shown) * (sz + 3) + 6;
          text(ctx, k > 12 ? `… ${fmt(k, 3)}` : `${fmt(k, 3)}`, tx, y + sz / 2, { font: 'mono', size: 12, weight: 600, color: c, align: 'left' });
        });
      });
      dice.canvas.classList.add('scroll-ok');
      const ceRo = f.readout('loss', { sym: 'L' });
      const pplRo = f.readout('perplexity', { sym: 'PPL' });
      const floorRo = f.readout('floor');
      const klRo = f.readout('KL');
      function loss(): number {
        return -PD.reduce((s, v, i) => s + (v > 0 ? v * Math.log(q[i]!) : 0), 0);
      }
      function floor(): number {
        return -PD.reduce((s, v) => s + (v > 0 ? v * Math.log(v) : 0), 0);
      }
      const sync = () => {
        const L = loss();
        const F = floor();
        f.code.setMany({ qa: q.slice(0, 4).map((v) => v.toFixed(2)).join(', '), qb: q.slice(4).map((v) => v.toFixed(2)).join(', '), ppl: fmt(Math.exp(L), 3), kl: fmt(L - F, 3), loss: fmt(L, 3), floor: fmt(F, 3) });
        ceRo.set(fmt(L, 3));
        pplRo.set(fmt(Math.exp(L), 3));
        floorRo.set(`${fmt(F, 3)} (PPL ${fmt(Math.exp(F), 3)})`);
        klRo.set(fmt(L - F, 3));
        pl.redraw();
        dice.redraw();
      };
      let drag = -1;
      const setBar = (e: PointerEvent) => {
        const [, y] = pl.pointer(e);
        const v = Math.max(0.01, Math.min(0.93, y));
        const rest = q.reduce((s, u, i) => s + (i === drag ? 0 : u), 0);
        q = q.map((u, i) => (i === drag ? v : rest > 1e-9 ? (u * (1 - v)) / rest : (1 - v) / (n - 1)));
        f.code.highlight(['ce', 'ppl']);
        sync();
      };
      pl.canvas.addEventListener('pointerdown', (e) => {
        const [xv] = pl.pointer(e);
        drag = Math.max(0, Math.min(n - 1, Math.floor(xv)));
        pl.canvas.setPointerCapture(e.pointerId);
        setBar(e);
      });
      pl.canvas.addEventListener('pointermove', (e) => drag >= 0 && setBar(e));
      pl.canvas.addEventListener('pointerup', () => (drag = -1));
      const seg = f.segmented({
        label: 'model',
        options: [
          { value: 'uniform', label: 'uniform' },
          { value: 'match', label: 'matches the data' },
          { value: 'leaky', label: 'a bit off' },
          { value: 'sure', label: 'too sure' },
        ],
        value: 'uniform',
        onChange: (v) => {
          q = [...PRESETS[v]!];
          f.code.highlight(v === 'match' ? ['floor', 'kl'] : ['ce', 'ppl']);
          sync();
        },
      });
      void seg;
      sync();
    },
    caption: `After *the big cat*, the toy language allows five verbs (dashed gold outlines: how often each really comes next) and forbids the rest. The purple bars are a model's prediction: **drag them**, or pick a preset. The loss is the average of $-\\log$ of the model's probability, weighted by how often each word really comes; perplexity turns it back into a count of equally likely options, drawn as faces of a fair die. **uniform** spreads over all 8 words: perplexity exactly 8. **matches the data** reaches the floor, the language's own perplexity of about 4.9, and no setting does better. **too sure** is worse than uniform: being confidently wrong 75% of the time costs more than knowing nothing.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: training with teacher forcing                                   */
/* ------------------------------------------------------------------ */

const REFS: Record<number, { name: string; loss: number }> = {
  1: { name: 'bigram counts (1 word)', loss: BIGRAM.nll(HELD) },
  2: { name: 'trigram counts (2 words)', loss: TRIGRAM.nll(HELD) },
  3: { name: '4-gram counts (3 words)', loss: FOURGRAM.nll(HELD) },
  4: { name: '5-gram counts (4 words)', loss: FIVEGRAM.nll(HELD) },
};
const FLOOR = trueNll(HELD);
const UNIGRAM_LOSS = UNIGRAM.nll(HELD);

export const TRAIN_REFS = { refs: REFS, floor: FLOOR, unigram: UNIGRAM_LOSS };

export function figTrain(p: Page): void {
  const STEPS = 1500;
  const BATCH = 64;
  const LR = 0.004;
  const STRIP = CTX('the lazy cat chases a ball .');
  p.figure({
    title: 'Teacher forcing: train a neural language model',
    codeTitle: 'train_lm.py',
    code: `
      C = {{C:4}}                       # words of context
      E = 0.5 * np.random.randn(V, 10)  # word embeddings
      W1 = np.random.randn(C * 10, 64) / np.sqrt(C * 10)
      W2 = 0.05 * np.random.randn(64, V)
      b1, b2 = np.zeros(64), np.zeros(V)

      for step in range(1500):
          i = np.random.randint(C, N, size=64)          #@batch
          ctx = tokens[i[:, None] - C + np.arange(C)]   #@batch
          targets = tokens[i]       # the real next word #@batch
          h = np.tanh(E[ctx].reshape(64, -1) @ W1 + b1) #@fwd
          logits = h @ W2 + b2                          #@fwd
          loss = cross_entropy(logits, targets)         #@loss
          adam_update(loss, lr=0.004)  # backprop, Adam #@upd
      # step {{step:0}}   held-out loss {{held:…}}
    `,
    setup(f) {
      let C = 4;
      let net = new WindowLM(C, 1);
      let rng = new Rng(11);
      let ema: number[] = [];
      let held: [number, number][] = [];
      let lastEma = Math.log(V);
      let sample = '';
      const pl = f.plot({
        aspect: 1.6,
        square: false,
        domain: [0, STEPS, 1.12, 2.36],
        draw: (pp) => {
          const ctx = pp.ctx;
          const small = pp.w < 420;
          for (const g of [1.25, 1.5, 1.75, 2, 2.25]) {
            line(ctx, pp.sx(0), pp.sy(g), pp.sx(STEPS), pp.sy(g), color('--grid'), 1);
            if (g < 2.2) text(ctx, g.toFixed(2), 3, pp.sy(g) + 8, { font: 'mono', size: 11, color: color('--ink-3'), align: 'left' });
          }
          for (const s of [500, 1000]) text(ctx, `${s} steps`, pp.sx(s), pp.h - 9, { size: 11, color: color('--ink-3') });
          const ref = REFS[C]!;
          const refLabel = (v: number, lab: string, c: string) => {
            const yv = Math.min(v, 2.31);
            line(ctx, pp.sx(0), pp.sy(yv), pp.sx(STEPS), pp.sy(yv), c, 1.5, [6, 4]);
            text(ctx, v > 2.31 ? `${lab.split(' (')[0]}: ${v.toFixed(2)} ↑` : `${lab}: ${v.toFixed(2)}`, pp.w - 6, v > 2.31 ? pp.sy(yv) + 9 : pp.sy(yv) - 8, { size: small ? 11 : 12, color: c, align: 'right', weight: 600 });
          };
          refLabel(ref.loss, ref.name, color('slate'));
          refLabel(FLOOR, 'floor: the grammar itself', color('gold'));
          text(ctx, `loss ↑ starts at ${Math.log(V).toFixed(2)}`, 4, pp.sy(2.31) + 9, { size: 11, color: color('--ink-3'), align: 'left' });
          if (ema.length > 1) pp.path(ema.map((_, i) => i + 1), ema, color('red'), 2);
          if (held.length) {
            pp.path(held.map((h) => h[0]), held.map((h) => h[1]), withAlpha(color('purple'), 0.6), 1.5);
            for (const [s, v] of held) pp.dot(s, v, 3.5, color('purple'));
          }
          rbox(ctx, pp.sx(STEPS * 0.5) - 4, pp.sy(2.12) - 2, 12, 3, 1, color('red'));
          text(ctx, 'training batches', pp.sx(STEPS * 0.5) + 12, pp.sy(2.12), { size: 11, color: color('red'), align: 'left' });
          pp.dot(STEPS * 0.5 + 2, 2.02, 3.5, color('purple'));
          text(ctx, 'held-out text', pp.sx(STEPS * 0.5) + 12, pp.sy(2.02), { size: 11, color: color('purple'), align: 'left' });
        },
      });
      const strip = f.canvas(640, 112, (ctx, w, h) => {
        const n = STRIP.length - 1;
        const gap = 4;
        const cw = (w - 8 - gap * (n - 1)) / n;
        const fs = cw < 50 ? 11 : 12;
        text(ctx, 'input', 4, 10, { size: 11, color: color('--ink-3'), align: 'left' });
        text(ctx, 'target, and p(target)', 4, 50, { size: 11, color: color('--ink-3'), align: 'left' });
        const pr = new Float64Array(V);
        for (let t = 0; t < n; t++) {
          const x0 = 4 + t * (cw + gap);
          rbox(ctx, x0, 18, cw, 22, 5, withAlpha(color('orange'), 0.12), withAlpha(color('orange'), 0.55), 1);
          text(ctx, VOCAB[STRIP[t]!]!, x0 + cw / 2, 29.5, { font: 'mono', size: fs, color: color('--ink') });
          net.probs(STRIP.slice(0, t + 1), pr);
          const pv = pr[STRIP[t + 1]!]!;
          const c = surpriseColor(pv);
          rbox(ctx, x0, 58, cw, 22, 5, withAlpha(c, 0.22), c, 1.2);
          text(ctx, VOCAB[STRIP[t + 1]!]!, x0 + cw / 2, 69.5, { font: 'mono', size: fs, color: color('--ink') });
          text(ctx, pct(pv), x0 + cw / 2, 96, { font: 'mono', size: 11, color: c, weight: 600 });
        }
      });
      strip.canvas.classList.add('scroll-ok');
      strip.canvas.style.aspectRatio = 'auto';
      strip.canvas.style.height = '108px';
      const out = textPanel('3.2em');
      f.viz.append(out);
      const stepRo = f.readout('step');
      const lossRo = f.readout('batch loss', { sym: 'L' });
      const heldRo = f.readout('held-out loss');
      const pplRo = f.readout('held-out PPL', { sym: 'PPL' });
      const evalHeld = () => {
        const v = net.nll(HELD);
        held.push([net.steps, v]);
        heldRo.set(fmt(v, 3));
        pplRo.set(fmt(Math.exp(v), 3));
        f.code.set('held', fmt(v, 3));
      };
      const resample = () => {
        const r = new Rng(net.steps + 3);
        const ctx = [DOT];
        const pr = new Float64Array(V);
        const gen: number[] = [];
        let ended = 0;
        while (ended < 3 && gen.length < 40) {
          net.probs(ctx, pr);
          const w = draw(pr, r);
          gen.push(w);
          ctx.push(w);
          if (w === DOT) ended++;
        }
        sample = wordsHtml(gen);
        out.innerHTML = `<span style="color:var(--ink-3)">sample after ${net.steps} steps:</span>\n${sample}`;
      };
      const reset = () => {
        net = new WindowLM(C, 1);
        rng = new Rng(11);
        ema = [];
        held = [];
        lastEma = Math.log(V);
        evalHeld();
        resample();
        stepRo.set(0);
        lossRo.set('–');
        f.code.setMany({ step: 0, C });
        pl.redraw();
        strip.redraw();
      };
      let phase = 0;
      const loop = f.loop(() => {
        for (let k = 0; k < 8 && net.steps < STEPS; k++) {
          const idx = Int32Array.from({ length: BATCH }, () => C + rng.int(TRAIN.length - C));
          const l = net.lossAndGrad(TRAIN, idx);
          net.adam(LR);
          lastEma = net.steps === 1 ? l : 0.95 * lastEma + 0.05 * l;
          ema.push(lastEma);
          if (net.steps % 150 === 0) evalHeld();
          if (net.steps % 150 === 0) resample();
        }
        f.code.highlight((['batch', 'fwd', 'loss', 'upd'] as const)[phase++ % 4]);
        f.code.set('step', net.steps);
        stepRo.set(net.steps);
        lossRo.set(fmt(lastEma, 3));
        pl.redraw();
        strip.redraw();
        if (net.steps >= STEPS) {
          stop();
          f.status(`Done: ${STEPS} steps, ${(STEPS * BATCH).toLocaleString()} predictions. Try another context size, then **Reset** and train again.`);
          return false;
        }
      });
      const stop = () => {
        loop.stop();
        btn.textContent = 'Train';
        f.code.highlight(null);
      };
      const btn = f.button('Train', () => {
        if (loop.running()) stop();
        else {
          if (net.steps >= STEPS) reset();
          loop.start();
          btn.textContent = 'Pause';
          f.status('');
        }
      }, { primary: true });
      f.button('Reset', () => {
        stop();
        reset();
      });
      f.segmented({
        label: 'context',
        options: [
          { value: '1', label: '1 word' },
          { value: '2', label: '2 words' },
          { value: '3', label: '3 words' },
          { value: '4', label: '4 words' },
        ],
        value: '4',
        onChange: (v) => {
          stop();
          C = Number(v);
          reset();
        },
      });
      reset();
    },
    caption: `A small neural network in the style of Bengio et al. (2003): look up an embedding for each of the last $C$ words, one tanh layer, a softmax over all 36 words. Every training example is a real context and the real next word: teacher forcing. Press **Train**. Red is the loss on each training batch (smoothed), purple the loss on held-out text the network never trains on; the strip shows one sentence, colored by the probability the network gives each real next word. With **1** or **2** words of context the network lands on the line of a counting model that sees the same words. With **3**, counting falls apart on new text (most 3-word contexts were seen too rarely to trust their counts) while the network keeps improving, because similar words get similar embeddings and share what they learn. With **4** it can tell *chases the big cat* (then ".") from *the big cat* (then a verb) and closes in on the floor.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: the decoding playground                                         */
/* ------------------------------------------------------------------ */

export function figDecode(p: Page): void {
  const CONTEXTS = [
    { value: 'the', label: '"the"' },
    { value: 'the cat', label: '"the cat"' },
    { value: 'the cat chases the', label: '"…chases the"' },
    { value: 'the kids sleep on', label: '"…sleep on"' },
  ];
  p.figure({
    title: 'Decoding: temperature, top-k and top-p',
    codeTitle: 'decode.py',
    code: `
      # temperature = {{tau:1}}, top_k = {{k:36}}, top_p = {{ptop:1}}
      def decode(probs, temperature, top_k, top_p):
          z = np.log(probs) / temperature                #@temp
          q = np.exp(z - z.max()); q /= q.sum()          #@temp
          keep = np.argsort(-q)[:top_k]   # best first   #@topk
          cum = np.cumsum(q[keep]) / q[keep].sum()       #@topp
          keep = keep[:np.searchsorted(cum, top_p) + 1]  #@topp
          out = np.zeros(V); out[keep] = q[keep]         #@norm
          return out / out.sum()     # {{kept}} kept    #@norm

      x = tokenize("{{ctx:the}}")
      while len(sentences(x)) < 4:                       #@loop
          probs = model(x)                               #@loop
          x.append({{pick:np.random.choice(V, p=decode(probs))}})  #@loop
    `,
    setup(f) {
      let ctxStr = 'the';
      let d: Decoding = { ...PLAIN };
      let seed = 4;
      const probs = () => NGRAM.probs(CTX(ctxStr));
      const cv = f.canvas(640, 380, (ctx, w, h) => {
        const pr = probs();
        const sh = shape(pr, d);
        const s0 = stateAfter(CTX(ctxStr));
        const pad = 6;
        const rows = 10;
        const top = 24;
        const rh = (h - top - 30) / rows;
        const lw = 60;
        const cumW = 56;
        const bwMax = w - lw - cumW - 54;
        text(ctx, `next word after "${ctxStr}"`, pad, 11, { size: 12, color: color('--ink-2'), align: 'left' });
        text(ctx, 'kept mass', w - 4, 11, { size: 11, color: color('--ink-3'), align: 'right' });
        let cum = 0;
        let mxP = 0;
        for (let r = 0; r < rows; r++) mxP = Math.max(mxP, sh.tempered[sh.order[r]!]!, pr[sh.order[r]!]!);
        const sc = bwMax / Math.max(mxP, 1e-9);
        for (let r = 0; r < rows; r++) {
          const wd = sh.order[r]!;
          const y = top + r * rh;
          const kept = r < sh.kept;
          const pv = sh.tempered[wd]!;
          const bad = s0 >= 0 && step(s0, wd) < 0;
          text(ctx, VOCAB[wd]!, lw - 8, y + rh / 2, { font: 'mono', size: 12, weight: kept ? 650 : 400, color: bad ? color('red') : kept ? color('--ink') : color('--ink-3'), align: 'right' });
          const bw = Math.max(2, sc * pv);
          rbox(ctx, lw, y + rh * 0.17, bw, rh * 0.66, 3, kept ? withAlpha(color('purple'), 0.62) : withAlpha(color('--ink-3'), 0.18), kept ? null : withAlpha(color('--ink-3'), 0.4), 1);
          const orig = pr[wd]!;
          const ox = lw + sc * orig;
          line(ctx, ox, y + rh * 0.08, ox, y + rh * 0.92, color('--ink'), 1.5);
          text(ctx, pct(pv), lw + Math.max(bw, ox - lw) + 6, y + rh / 2, { font: 'mono', size: 11, color: kept ? color('--ink-2') : color('--ink-3'), align: 'left' });
          if (kept) cum += pv;
          if (kept) text(ctx, pct(cum), w - 4, y + rh / 2, { font: 'mono', size: 11, color: color('teal'), align: 'right', weight: 600 });
          if (r === sh.kept - 1 && sh.kept < V) line(ctx, 4, y + rh, w - 4, y + rh, color('teal'), 1.5, [5, 4]);
        }
        const restKept = sh.kept > rows;
        let rest = 0;
        for (let r = rows; r < V; r++) rest += sh.tempered[sh.order[r]!]!;
        text(ctx, `${V - rows} more words: ${pct(rest)}${restKept ? ` (${sh.kept - rows} of them kept)` : ', all cut'}`, lw, h - 14, { size: 11.5, color: color('--ink-3'), align: 'left' });
      });
      cv.canvas.classList.add('scroll-ok');
      const out = textPanel('6.2em');
      f.viz.append(out);
      const keptRo = f.readout('kept');
      const goodRo = f.readout('grammatical');
      const regen = () => {
        const r = new Rng(seed);
        const gen = generate(CTX(ctxStr), d, r, 4);
        const body = wordsHtml(gen, stateAfter(CTX(ctxStr)));
        out.innerHTML = `<span style="color:var(--ink-3)">${esc(ctxStr)}</span> ${body}`;
        const sents: number[][] = [];
        let curS: number[] = [...tok(ctxStr)];
        for (const w of gen) {
          curS.push(w);
          if (w === DOT) {
            sents.push(curS);
            curS = [];
          }
        }
        const okN = sents.filter((s) => {
          let st = START;
          for (const w of s) {
            st = step(st, w);
            if (st < 0) return false;
          }
          return st === START;
        }).length;
        goodRo.set(`${okN} of ${sents.length} sentences`);
      };
      const sync = () => {
        const sh = shape(probs(), d);
        f.code.setMany({
          kept: sh.kept,
          ctx: ctxStr,
          pick: d.greedy ? 'np.argmax(probs)' : 'np.random.choice(V, p=decode(probs))',
        });
        keptRo.set(`${sh.kept} of ${V} words`);
        cv.redraw();
        regen();
      };
      f.segmented({
        label: 'context',
        options: CONTEXTS,
        value: 'the',
        onChange: (v) => {
          ctxStr = v;
          sync();
        },
      });
      f.segmented({
        label: 'pick',
        options: [
          { value: 'sample', label: 'sample' },
          { value: 'greedy', label: 'greedy (argmax)' },
        ],
        value: 'sample',
        onChange: (v) => {
          d = { ...d, greedy: v === 'greedy' };
          f.code.highlight('loop');
          sync();
        },
      });
      f.slider({ label: 'temperature τ', sym: 'tau', min: -1.6, max: 1.1, step: 0.01, value: 0, map: (r) => Math.round(Math.exp(r) * 100) / 100, format: (v) => v.toFixed(2), slot: 'tau', onInput: (v) => { d = { ...d, tau: v }; f.code.highlight('temp'); sync(); } });
      f.slider({ label: 'top-k', min: 1, max: V, step: 1, value: V, format: (v) => String(v), slot: 'k', onInput: (v) => { d = { ...d, topK: v }; f.code.highlight('topk'); sync(); } });
      f.slider({ label: 'top-p', sym: 'ptop', min: 0.05, max: 1, step: 0.01, value: 1, format: (v) => v.toFixed(2), slot: 'ptop', onInput: (v) => { d = { ...d, topP: v }; f.code.highlight('topp'); sync(); } });
      f.button('New sample', () => {
        seed++;
        regen();
      }, { primary: true });
      sync();
    },
    caption: `The bars are the n-gram model's next-word probabilities after the chosen context, reshaped by temperature (the thin black tick marks each word's probability before temperature). Purple bars are kept; gray ones are cut by top-k or top-p, and the dashed teal line is the cut. Red words are ones the grammar forbids here: the model's unreliable tail. The box continues the context until four sentences have ended, red from the first forbidden word. Try **greedy** after "the": it settles into *the cat sleeps. the dog runs.* on repeat. Push $\\symtau$ to 1.5: the tail swells and most sentences break (the next figure measures it: only 28% survive). Keep $\\symtau$ there and lower top-p to 0.7: the cut moves up past the forbidden words, and about nine sentences in ten are grammatical again. Compare "the" and "…sleep on" with top-k = 5: five is too few for one and too many for the other.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: quality versus diversity                                        */
/* ------------------------------------------------------------------ */

type Method = 'tau' | 'k' | 'p';
const SWEEP: Record<Method, number[]> = {
  tau: [0.3, 0.45, 0.6, 0.75, 0.9, 1, 1.15, 1.3, 1.5, 1.75, 2],
  k: [1, 2, 3, 4, 5, 6, 8, 10, 14, 20, 36],
  p: [0.2, 0.4, 0.55, 0.7, 0.8, 0.85, 0.9, 0.95, 0.98, 1],
};
const asDecoding = (m: Method, v: number): Decoding =>
  m === 'tau' ? { ...PLAIN, tau: v } : m === 'k' ? { ...PLAIN, topK: v } : { ...PLAIN, topP: v };

export function figTradeoff(p: Page): void {
  const NS = 400;
  const LANG = Math.exp(trueNll(HELD));
  p.figure({
    title: 'Quality versus diversity, over 400 sampled sentences',
    codeTitle: 'tradeoff.py',
    code: `
      def evaluate(decoding, n=400):
          good, H, steps = 0, 0.0, 0
          for _ in range(n):
              s = generate_sentence(model, decoding)   #@gen
              good += grammar.accepts(s.words)         #@good
              H += sum(entropy(q) for q in s.dists)    #@div
              steps += len(s.words)                    #@div
          return np.exp(H / steps), good / n           #@div

      # {{m:temperature}} = {{v:1.0}}
      # choices per word = {{c:…}}   grammatical = {{g:…}}
    `,
    setup(f) {
      let m: Method = 'tau';
      let v = 1;
      const curves: Record<Method, SweepPoint[]> = { tau: [], k: [], p: [] };
      const queue: [Method, number][] = (['tau', 'k', 'p'] as Method[]).flatMap((mm) => SWEEP[mm].map((vv) => [mm, vv] as [Method, number]));
      let curPt: SweepPoint | null = null;
      const COL: Record<Method, Parameters<typeof color>[0]> = { tau: 'slate', k: 'orange', p: 'teal' };
      const NAME: Record<Method, string> = { tau: 'temperature', k: 'top-k', p: 'top-p' };
      const X0 = 0.9;
      const X1 = 9;
      const lx = (c: number) => Math.log(c);
      const pl = f.plot({
        aspect: 1.45,
        square: false,
        domain: [lx(X0), lx(X1), -0.08, 1.08],
        draw: (pp) => {
          const ctx = pp.ctx;
          for (const g of [0, 0.25, 0.5, 0.75, 1]) {
            line(ctx, pp.sx(lx(X0)), pp.sy(g), pp.sx(lx(X1)), pp.sy(g), color('--grid'), 1);
            text(ctx, `${g * 100}%`, 3, pp.sy(g) - 8, { font: 'mono', size: 11, color: color('--ink-3'), align: 'left' });
          }
          for (const c of [1, 2, 4, 8]) {
            line(ctx, pp.sx(lx(c)), pp.sy(-0.02), pp.sx(lx(c)), pp.sy(1.02), color('--grid'), 1);
            text(ctx, String(c), pp.sx(lx(c)), pp.h - 9, { font: 'mono', size: 11, color: color('--ink-3') });
          }
          text(ctx, 'grammatical', 44, pp.sy(1.04) + 2, { size: 11, color: color('--ink-3'), align: 'left' });
          text(ctx, 'choices per word →', pp.w - 6, pp.h - 22, { size: 11, color: color('--ink-3'), align: 'right' });
          (['tau', 'k', 'p'] as Method[]).forEach((mm) => {
            const pts = curves[mm];
            if (pts.length < 1) return;
            const c = color(COL[mm]);
            const on = mm === m;
            pp.path(pts.map((q) => lx(q.choices)), pts.map((q) => q.good), withAlpha(c, on ? 1 : 0.55), on ? 2.5 : 1.6);
            for (const q of pts) pp.dot(lx(q.choices), q.good, on ? 3.5 : 2.5, withAlpha(c, on ? 1 : 0.6));
          });
          // the language itself
          const sx = pp.sx(lx(LANG));
          const sy = pp.sy(1);
          ctx.fillStyle = color('gold');
          ctx.beginPath();
          for (let i = 0; i < 10; i++) {
            const a = -Math.PI / 2 + (i * Math.PI) / 5;
            const r = i % 2 ? 4 : 9;
            ctx.lineTo(sx + r * Math.cos(a), sy + r * Math.sin(a));
          }
          ctx.closePath();
          ctx.fill();
          text(ctx, '← the language itself', sx + 13, sy, { size: 11, color: color('gold'), weight: 650, align: 'left' });
          if (curPt) {
            pp.dot(lx(curPt.choices), curPt.good, 7, color(COL[m]), color('--ink'));
          }
          // legend
          const lgx = pp.sx(lx(1.3));
          const lgy = pp.sy(0.36);
          (['tau', 'k', 'p'] as Method[]).forEach((mm, i) => {
            const y = lgy + i * 17;
            line(ctx, lgx, y, lgx + 16, y, color(COL[mm]), 2.5);
            text(ctx, NAME[mm], lgx + 22, y, { size: 11.5, color: color('--ink-2'), align: 'left', weight: mm === m ? 650 : 400 });
          });
        },
      });
      const out = textPanel('3.4em');
      f.viz.append(out);
      const gRo = f.readout('grammatical');
      const cRo = f.readout('choices per word');
      const dRo = f.readout('distinct');
      const evalCur = () => {
        curPt = score(asDecoding(m, v), new Rng(17), NS);
        gRo.set(`${Math.round(curPt.good * 100)}%`);
        cRo.set(fmt(curPt.choices, 3));
        dRo.set(`${Math.round(curPt.distinct * 100)}%`);
        f.code.setMany({ m: m === 'tau' ? 'temperature' : m === 'k' ? 'top_k' : 'top_p', v: m === 'k' ? String(v) : v.toFixed(2), c: fmt(curPt.choices, 3), g: `${Math.round(curPt.good * 100)}%` });
        const gen = generate([DOT], asDecoding(m, v), new Rng(5), 3);
        out.innerHTML = wordsHtml(gen);
        pl.redraw();
      };
      const loop = f.loop(() => {
        const t0 = performance.now();
        while (queue.length && performance.now() - t0 < 14) {
          const [mm, vv] = queue.shift()!;
          const pt = score(asDecoding(mm, vv), new Rng(17), NS);
          pt.value = vv;
          curves[mm].push(pt);
        }
        f.code.highlight(['gen', 'good', 'div'][queue.length % 3]!);
        pl.redraw();
        if (!queue.length) {
          f.code.highlight(null);
          return false;
        }
      });
      loop.start();
      const sliders = {
        tau: f.slider({ label: 'temperature τ', sym: 'tau', min: -1.2, max: 0.7, step: 0.01, value: 0, map: (r) => Math.round(Math.exp(r) * 100) / 100, format: (x) => x.toFixed(2), onInput: (x) => { v = x; evalCur(); } }),
        k: f.slider({ label: 'top-k', min: 1, max: V, step: 1, value: 5, format: (x) => String(x), onInput: (x) => { v = x; evalCur(); } }),
        p: f.slider({ label: 'top-p', sym: 'ptop', min: 0.2, max: 1, step: 0.01, value: 0.9, format: (x) => x.toFixed(2), onInput: (x) => { v = x; evalCur(); } }),
      };
      const showSlider = () => (Object.keys(sliders) as Method[]).forEach((mm) => (sliders[mm].el.style.display = mm === m ? '' : 'none'));
      f.segmented({
        label: 'method',
        options: [
          { value: 'tau', label: 'temperature' },
          { value: 'k', label: 'top-k' },
          { value: 'p', label: 'top-p' },
        ],
        value: 'tau',
        onChange: (val) => {
          m = val as Method;
          v = sliders[m].value;
          showSlider();
          evalCur();
        },
      });
      showSlider();
      evalCur();
    },
    caption: `Each point samples 400 sentences from the n-gram model with one setting and scores them two ways. Up is quality: the share of sentences the grammar accepts. Right is diversity: the sampler's own perplexity, the effective number of words it chooses among at each step (log scale). The gold star is the toy language itself: about 3.6 choices per word, all of them grammatical. Plain sampling ($\\symtau = 1$, top-k = 36, top-p = 1, where the three curves meet) is diverse but loses about a quarter of its sentences to the tail. Tightening any of the three trades diversity for quality, but not equally well: top-k lags, because a fixed $k$ suits no context (one word fits after *on*, thirteen after *the*). Temperature and top-p track each other closely on this small vocabulary. Pick a method and move its slider to see the current setting (the large dot) and three of its sentences.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: GPT versus BERT                                                 */
/* ------------------------------------------------------------------ */

export function figGptBert(p: Page): void {
  const SENTS = [
    { value: 'the kids sleep in the park .', label: 'the kids sleep…' },
    { value: 'a lazy cat sees the bird .', label: 'a lazy cat…' },
  ];
  p.figure({
    title: 'GPT versus BERT: who sees what, and what gets predicted',
    codeTitle: 'objectives.py',
    code: `
      x = tokenize(". {{sent:the kids sleep in the park .}}")
      T = len(x)
      # GPT: position t sees x[0..t] and predicts x[t+1]
      causal = np.tril(np.ones((T, T), bool))             #@gpt
      gpt_inputs, gpt_targets = x[:-1], x[1:]             #@gpt
      # BERT: every position sees every position
      chosen = np.random.rand(T) < 0.15     # {{chosen}}  #@bert
      bert_inputs = np.where(chosen, MASK, x)             #@bert
      bert_targets = x[chosen]                            #@bert
      # predictions per sentence: GPT {{ng}}, BERT {{nb}}
    `,
    setup(f) {
      let mode: 'gpt' | 'bert' = 'gpt';
      let x: number[] = [];
      let masked: boolean[] = [];
      let sel = -1;
      let rng = new Rng(3);
      const load = (s: string) => {
        x = [DOT, ...tok(s)];
        masked = x.map((_, i) => i === 2);
        sel = -1;
      };
      load(SENTS[0]!.value);
      // left-only cost of each word: -log2 p(x_t | x_<t) under the grammar
      const leftBits = () => x.map((w, t) => (t === 0 ? NaN : -Math.log2(trueProbs(x.slice(0, t))[w]!)));
      const bothBits = () => {
        const post = maskedPosteriors(x.slice(1), masked.slice(1));
        return x.map((w, t) => (t === 0 || !post[t - 1] ? NaN : -Math.log2(post[t - 1]![w]!)));
      };
      const fmtBits = (b: number) => (Number.isFinite(b) ? (Math.abs(b) < 0.005 ? '0' : b.toFixed(1)) : '–');
      const geom = (w: number, _h: number) => {
        const T = x.length;
        const lx = 6;
        const cw = (w - lx - 6) / T;
        return { T, lx, cw, rowH: 18, mY: 54 };
      };
      const cv = f.canvas(640, 300, (ctx, w, h) => {
        const { T, lx, cw, rowH, mY } = geom(w, h);
        const fs = cw < 44 ? 11 : 12;
        text(ctx, mode === 'gpt' ? 'input (the true text)' : 'input (chosen words hidden)', lx, 10, { size: 11, color: color('--ink-3'), align: 'left' });
        // input row
        for (let c = 0; c < T; c++) {
          const x0 = lx + c * cw + 2;
          const isM = mode === 'bert' && masked[c];
          rbox(ctx, x0, 22, cw - 4, 24, 5, isM ? withAlpha(color('--ink-3'), 0.3) : withAlpha(color('orange'), 0.12), isM ? color('--ink-3') : withAlpha(color('orange'), 0.55), 1.2);
          text(ctx, isM ? (cw < 52 ? 'MASK' : '[MASK]') : VOCAB[x[c]!]!, x0 + (cw - 4) / 2, 34.5, { font: isM ? 'sans' : 'mono', size: isM ? 11 : fs, weight: isM ? 650 : 500, color: color('--ink') });
        }
        // visibility matrix: row r is the output at position r
        for (let r = 0; r < T; r++) {
          const y = mY + r * rowH;
          const predicts = mode === 'gpt' ? r < T - 1 : masked[r]!;
          for (let c = 0; c < T; c++) {
            const vis = mode === 'gpt' ? c <= r : true;
            const on = sel === r;
            const x0 = lx + c * cw + 2;
            if (vis) rbox(ctx, x0, y + 1.5, cw - 4, rowH - 3, 3, withAlpha(predicts ? color('blue') : color('--ink-3'), (predicts ? 0.28 : 0.1) + (on ? 0.35 : 0)), on ? color('blue') : null, 1);
            else rbox(ctx, x0, y + 1.5, cw - 4, rowH - 3, 3, null, withAlpha(color('--ink-3'), 0.25), 1);
          }
        }
        const tY = mY + T * rowH + 8;
        text(ctx, mode === 'gpt' ? 'target: the next word' : 'target: the hidden word', lx, tY + 6, { size: 11, color: color('--ink-3'), align: 'left' });
        const lb = leftBits();
        const bb = mode === 'bert' ? bothBits() : null;
        for (let c = 0; c < T; c++) {
          const x0 = lx + c * cw + 2;
          const tgt = mode === 'gpt' ? (c < T - 1 ? x[c + 1]! : -1) : masked[c] ? x[c]! : -1;
          if (tgt < 0) continue;
          rbox(ctx, x0, tY + 16, cw - 4, 24, 5, withAlpha(color('gold'), 0.18), color('gold'), 1.2);
          text(ctx, VOCAB[tgt]!, x0 + (cw - 4) / 2, tY + 28.5, { font: 'mono', size: fs, color: color('--ink') });
          const b = mode === 'gpt' ? lb[c + 1]! : bb![c]!;
          text(ctx, fmtBits(b), x0 + (cw - 4) / 2, tY + 52, { font: 'mono', size: 11, weight: 600, color: color('red') });
          if (mode === 'bert') text(ctx, `(${fmtBits(lb[c]!)})`, x0 + (cw - 4) / 2, tY + 68, { font: 'mono', size: 11, color: color('--ink-3') });
        }
        if (mode === 'bert') text(ctx, 'best possible bits: both sides (left side only)', lx, h - 7, { size: 11, color: color('--ink-3'), align: 'left' });
        else text(ctx, 'best possible bits, from the grammar', lx, h - 7, { size: 11, color: color('--ink-3'), align: 'left' });
      });
      const sync = () => {
        const T = x.length;
        const nb = masked.filter(Boolean).length;
        f.code.setMany({ ng: T - 1, nb, chosen: masked.map((m) => (m ? 1 : 0)).join('') });
        f.code.highlight(mode);
        predRo.set(mode === 'gpt' ? `${T - 1} of ${T - 1}` : `${nb} of ${T - 1}`);
        cv.redraw();
      };
      cv.canvas.style.aspectRatio = 'auto';
      cv.canvas.style.height = '300px';
      cv.canvas.addEventListener('pointerdown', (e) => {
        const r = cv.canvas.getBoundingClientRect();
        const px = e.clientX - r.left;
        const py = e.clientY - r.top;
        const { T, lx, cw, rowH, mY } = geom(r.width, r.height);
        const c = Math.floor((px - lx) / cw);
        if (c < 0 || c >= T) return;
        if (py < mY) {
          if (mode === 'bert' && c > 0) {
            masked[c] = !masked[c];
            if (!masked.some(Boolean)) masked[c] = true;
          }
        } else {
          const row = Math.floor((py - mY) / rowH);
          sel = row >= 0 && row < T ? (row === sel ? -1 : row) : -1;
        }
        sync();
      });
      const predRo = f.readout('positions with a loss');
      f.segmented({
        label: 'objective',
        options: [
          { value: 'gpt', label: 'GPT' },
          { value: 'bert', label: 'BERT' },
        ],
        value: 'gpt',
        onChange: (v) => {
          mode = v as 'gpt' | 'bert';
          sync();
        },
      });
      f.segmented({
        label: 'sentence',
        options: SENTS,
        value: SENTS[0]!.value,
        slot: 'sent',
        onChange: (v) => {
          load(v);
          sync();
        },
      });
      f.button('Mask 15% at random', () => {
        mode = 'bert';
        do masked = x.map((_, i) => i > 0 && rng.next() < 0.15);
        while (!masked.some(Boolean));
        sync();
      });
      sync();
    },
    caption: `Columns are positions; the top row is what the model reads, and row $r$ of the grid shows which positions output $r$ can look at. **GPT** sees only the left (a triangle, the causal mask) and every position predicts the next word, so every word of the sentence is a training signal. **BERT** sees the whole sentence, but only the hidden words carry a loss. **Tap words** in the top row (BERT) to hide them, and tap a grid row to highlight it. The red numbers are the best possible cost of each prediction in bits, computed exactly from the toy grammar. *kids* starts hidden: from the left alone it costs 3.7 bits (13 words can follow *the*), but with both sides only 2, because *sleep* says the noun is plural. Hide *in*: 2 bits from the left, free with both sides, since only *in* fits before *the park*.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: prediction is compression                                       */
/* ------------------------------------------------------------------ */

export function figCompress(p: Page): void {
  const SENT = 'the lazy dog chases a ball .';
  const x = tok(SENT);
  const MODELS: Record<string, { label: string; probs: (ctx: number[]) => Float64Array }> = {
    uniform: { label: 'uniform', probs: () => new Float64Array(V).fill(1 / V) },
    unigram: { label: 'word counts', probs: (c) => UNIGRAM.probs(c) },
    bigram: { label: 'bigram', probs: (c) => BIGRAM.probs(c) },
    ngram: { label: 'our n-gram', probs: (c) => NGRAM.probs(c) },
    truth: { label: 'the grammar', probs: (c) => trueProbs(c) },
  };
  p.figure({
    title: 'Prediction is compression: arithmetic coding',
    codeTitle: 'arithmetic_code.py',
    code: `
      x = tokenize("the lazy dog chases a ball .")
      lo, width = 0.0, 1.0       # interval [lo, lo + width)
      for t in range(len(x)):
          probs = {{model:ngram}}(x[:t])                #@model
          lo += width * probs[:x[t]].sum()  # x[t]'s slice #@zoom
          width *= probs[x[t]]              # zoom in      #@zoom
      bits = -np.log2(width)    # {{bits}} bits          #@bits
      # as text: 28 characters x 8 bits = 224 bits
    `,
    setup(f) {
      let key = 'ngram';
      const rowsOf = () => {
        const probsFn = MODELS[key]!.probs;
        return x.map((w, t) => {
          const pr = probsFn([DOT, ...x.slice(0, t)]);
          let below = 0;
          for (let i = 0; i < w; i++) below += pr[i]!;
          return { pr, below, p: pr[w]! };
        });
      };
      const cv = f.canvas(640, 420, (ctx, w, h) => {
        const rows = rowsOf();
        const T = x.length;
        const lw = 62;
        const rw = 64;
        const bx = lw;
        const bwid = w - lw - rw;
        const top = 22;
        const rh = (h - top - 46) / T;
        const bh = Math.min(18, rh * 0.5);
        text(ctx, w < 480 ? 'zoom into each word\'s slice' : 'each row zooms into the slice of the word that came', bx, 9, { size: 11, color: color('--ink-3'), align: 'left' });
        text(ctx, 'bits', w - 6, 9, { size: 11, color: color('--ink-3'), align: 'right' });
        let total = 0;
        rows.forEach((r, t) => {
          const y = top + t * rh;
          text(ctx, VOCAB[x[t]!]!, lw - 8, y + bh / 2, { font: 'mono', size: 12, weight: 600, color: color('orange'), align: 'right' });
          // the current interval, drawn at full width, split into one slice per word
          let acc = 0;
          for (let i = 0; i < V; i++) {
            const sw = r.pr[i]! * bwid;
            if (sw <= 0) continue;
            const on = i === x[t];
            ctx.fillStyle = on ? withAlpha(color('orange'), 0.8) : withAlpha(i % 2 ? color('purple') : color('blue'), 0.16);
            ctx.fillRect(bx + acc, y, Math.max(on ? 1.5 : 0, sw - (sw > 2 ? 0.5 : 0)), bh);
            acc += sw;
          }
          rbox(ctx, bx, y, bwid, bh, 2, null, withAlpha(color('--ink-3'), 0.6), 1);
          const s0 = bx + r.below * bwid;
          const s1 = s0 + r.p * bwid;
          if (t < T - 1) {
            ctx.strokeStyle = withAlpha(color('orange'), 0.55);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(s0, y + bh);
            ctx.lineTo(bx, y + rh);
            ctx.moveTo(s1, y + bh);
            ctx.lineTo(bx + bwid, y + rh);
            ctx.stroke();
          }
          const b = -Math.log2(r.p);
          total += b;
          text(ctx, Number.isFinite(b) ? b.toFixed(2) : '∞', w - 6, y + bh / 2, { font: 'mono', size: 12, weight: 600, color: color('red'), align: 'right' });
        });
        const width = rows.reduce((a, r) => a * r.p, 1);
        const fsz = w < 420 ? 11.5 : 12.5;
        text(ctx, `width = ${sci(width, 3)}  →  ${total.toFixed(1)} bits`, bx, h - 26, { font: 'mono', size: fsz, weight: 650, color: color('red'), align: 'left' });
        text(ctx, `uniform ${(T * Math.log2(V)).toFixed(1)} bits · as text 224 bits`, bx, h - 8, { font: 'mono', size: 11, color: color('--ink-3'), align: 'left' });
      });
      cv.canvas.classList.add('scroll-ok');
      const bitsRo = f.readout('bits for the sentence');
      const sync = () => {
        const rows = rowsOf();
        const bits = rows.reduce((s, r) => s - Math.log2(r.p), 0);
        f.code.set('model', key === 'truth' ? 'grammar' : key);
        f.code.set('bits', bits.toFixed(1));
        f.code.highlight(['model', 'zoom', 'bits']);
        bitsRo.set(`${bits.toFixed(1)} (${(bits / x.length).toFixed(2)} per word)`);
        cv.redraw();
      };
      f.segmented({
        label: 'model',
        options: Object.entries(MODELS).map(([value, m]) => ({ value, label: m.label })),
        value: 'ngram',
        onChange: (v) => {
          key = v;
          sync();
        },
      });
      sync();
    },
    caption: `Arithmetic coding turns a predictor into a compressor. Start with the interval from 0 to 1. Each word cuts the current interval into slices, one per vocabulary word, sized by the model's probabilities; keep the slice of the word that actually came (orange), and repeat. The final interval's width is exactly the chain-rule product $\\symp(\\symx)$, and writing down a number inside an interval of width $w$ takes about $-\\log_2 w$ bits. So the compressed size is the model's loss, in bits. Switch models: knowing nothing costs 5.17 bits per word; word counts help a little; the n-gram is close to the grammar itself, which is the best any compressor can do on average.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: in-context learning as inference                                */
/* ------------------------------------------------------------------ */

export function figIcl(p: Page): void {
  const QUERY = 4;
  p.figure({
    title: 'In-context learning: inferring the task from the prompt',
    codeTitle: 'in_context.py',
    code: `
      prior = {"plural": .4, "French": .3,
               "sound": .2, "baby": .1}
      eps = 0.1    # share of noisy lines in the data

      def p_line(task, animal, answer):
          right = ANSWER[task][animal] == answer
          return (1 - eps) * right + eps / 20  # 20 answers

      post = dict(prior)
      for animal, answer in examples:      # {{K:2}} examples  #@ex
          for task in post:                                    #@ex
              post[task] *= p_line(task, animal, answer)       #@ex
      z = sum(post.values())                                   #@post
      post = {t: v / z for t, v in post.items()}               #@post
      p_next = {a: sum(post[t] * p_line(t, "duck", a)          #@pred
                       for t in post) for a in ANSWERS}         #@pred
      # p("{{ans}}") = {{pa}}
    `,
    setup(f) {
      let task = 1;
      let K = 2;
      let wrong = false;
      const examples = (): [number, string][] =>
        Array.from({ length: K }, (_, i) => {
          const ans = wrong && i === 1 ? TASKS[(task + 1) % TASKS.length]!.answers[i]! : TASKS[task]!.answers[i]!;
          return [i, ans];
        });
      const box = textPanel('7.6em');
      f.viz.append(box);
      const cv = f.canvas(640, 300, (ctx, w, h) => {
        const pr = predict(examples(), QUERY);
        const half = w / 2;
        const pad = 6;
        text(ctx, 'which kind of list is this?', pad, 10, { size: 11.5, color: color('--ink-2'), align: 'left' });
        text(ctx, 'next word after "duck =>"', half + pad, 10, { size: 11.5, color: color('--ink-2'), align: 'left' });
        const rh = (h - 30) / 5;
        const lw1 = 52;
        const bw1 = half - lw1 - 48;
        TASKS.forEach((t, i) => {
          const y = 24 + i * rh;
          const on = i === task;
          text(ctx, t.label, lw1 - 6, y + rh / 2, { size: 12, weight: on ? 650 : 400, color: on ? color('--ink') : color('--ink-2'), align: 'right' });
          const bw = Math.max(2, bw1 * pr.posterior[i]!);
          rbox(ctx, lw1, y + rh * 0.18, bw, rh * 0.64, 3, withAlpha(color('blue'), on ? 0.7 : 0.35), null);
          text(ctx, pct(pr.posterior[i]!), lw1 + bw + 5, y + rh / 2, { font: 'mono', size: 11, color: color('--ink-2'), align: 'left' });
        });
        const order = ANSWERS.map((a, i) => [a, pr.answer[i]!] as const).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const right = TASKS[task]!.answers[QUERY]!;
        const lw2 = w < 420 ? 66 : 74;
        const bw2 = half - lw2 - 44;
        order.forEach(([a, v], i) => {
          const y = 24 + i * rh;
          const ok = a === right;
          text(ctx, a, half + lw2 - 6, y + rh / 2, { font: 'mono', size: 11.5, weight: ok ? 700 : 400, color: ok ? color('green') : color('--ink-2'), align: 'right' });
          const bw = Math.max(2, bw2 * v);
          rbox(ctx, half + lw2, y + rh * 0.18, bw, rh * 0.64, 3, withAlpha(ok ? color('green') : color('purple'), ok ? 0.7 : 0.35), null);
          text(ctx, pct(v), half + lw2 + bw + 5, y + rh / 2, { font: 'mono', size: 11, color: color('--ink-2'), align: 'left' });
        });
      });
      cv.canvas.classList.add('scroll-ok');
      const pRo = f.readout('p(right answer)');
      const sync = () => {
        const ex = examples();
        const pr = predict(ex, QUERY);
        const right = TASKS[task]!.answers[QUERY]!;
        const pa = pr.answer[ANSWERS.indexOf(right)]!;
        const lines = ex.map(([a, y], i) => {
          const bad = wrong && i === 1;
          return `${ANIMALS[a]} => ${bad ? `<span style="color:var(--c-red)">${y}</span>` : y}`;
        });
        box.innerHTML = [...lines, `${ANIMALS[QUERY]} =><span style="color:var(--ink-3)"> ?</span>`].join('\n');
        f.code.setMany({ K, ans: right, pa: pa.toFixed(3) });
        f.code.highlight(['ex', 'post', 'pred']);
        pRo.set(pct(pa));
        cv.redraw();
      };
      f.segmented({
        label: 'the prompt shows',
        options: TASKS.map((t, i) => ({ value: String(i), label: t.label })),
        value: '1',
        onChange: (v) => {
          task = Number(v);
          sync();
        },
      });
      f.slider({ label: 'examples', min: 0, max: 4, step: 1, value: 2, format: (v) => String(v), slot: 'K', onInput: (v) => { K = v; sync(); } });
      f.toggle({ label: 'one wrong example', value: false, onChange: (v) => { wrong = v; sync(); } });
      sync();
    },
    caption: `An idealized model, not a trained network: the exact next-token predictor for a toy pretraining set in which lists of four kinds appear (plurals, French, animal sounds, baby animals), common ones more often, with 10% noisy lines. Whatever predictor gets the lowest possible loss on that data must behave like this, because the best prediction for "duck =>" depends on which kind of list the document is. With **0** examples the model can only follow the prior and bets on the plural. Each example multiplies in more evidence: a single French line moves the belief that this is a French list from 30% to 99%, and the right answer to about 90% (the 10% of noisy lines in the data caps it there). Turn on **one wrong example**: with two examples the model is torn between French and sounds; with three or four, the agreeing lines outvote the stray one, because the data taught it that stray lines happen. No weights changed anywhere; the prompt alone selected the task.`,
  });
}

export { CTX, wordsHtml };

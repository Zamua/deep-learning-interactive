import type { ChapterDef } from './index';
import type { Page } from '../core/page';
import { fmt } from '../core/code';
import { color, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import type { Color } from '../core/symbols';
import { arrow, chip, field, fitHeight, heat, label, lcsMarks, rbox, rgbK, text } from '../lib/seq2seq-draw';
import { MAXL, MINL, type Translation, type Translator, loadModels, reference, sentence, sentenceOfLength, softmax } from '../lib/seq2seq-model';
import { SEQ2SEQ_SYMBOLS } from '../lib/seq2seq-symbols';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pct = (p: number) => `${p >= 0.995 ? Math.round(p * 100) : (p * 100).toFixed(p < 0.1 ? 1 : 0)}%`;

/* ------------------------------------------------------------------ */
/* Fig: an encoder-decoder, one step at a time                          */
/* ------------------------------------------------------------------ */

function figEncDec(p: Page): void {
  const PRESETS = [
    { value: 'cat', label: 'cat sees dog', src: 'the black cat sees a dog' },
    { value: 'fox', label: 'fox chases duck', src: 'a fox chases the red duck' },
    { value: 'pig', label: 'pig likes horse', src: 'the pig likes a white horse' },
  ];
  p.figure({
    title: 'An encoder-decoder, one step at a time',
    codeTitle: 'encoder_decoder.py',
    code: `
      src = "{{src:the black cat sees a dog}}".split()
      h = np.zeros(32)
      for x in src:              # read a word  #@enc
          h = gru_enc(h, emb_src[x])              #@enc
      c = h      # the sentence, in 32 numbers    #@c

      s, y, out = c, "<bos>", []
      while y != "<eos>":                         #@dec
          inp = np.concatenate([emb_tgt[y], c])   #@dec
          s = gru_dec(s, inp)                     #@dec
          z = W_out @ np.concatenate([s, c])      #@p
          p = softmax(z + b_out)                  #@p
          y = vocab_tgt[p.argmax()]   # greedy    #@p
          out.append(y)                           #@p
      # {{now:…}}
    `,
    setup(f) {
      let model: Translator | null = null;
      let src = PRESETS[0]!.src.split(' ');
      let r: Translation | null = null;
      let cur = 0;
      type Step = { kind: 'enc'; j: number } | { kind: 'c' } | { kind: 'dec'; t: number };
      let steps: Step[] = [];
      const build = () => {
        if (!model) return;
        r = model.translate(src);
        steps = [...src.map((_, j) => ({ kind: 'enc' as const, j })), { kind: 'c' as const }, ...r.dec.map((_, t) => ({ kind: 'dec' as const, t }))];
      };
      const cv = f.canvas(640, 360, (ctx, w, hgt) => {
        if (!r) return;
        const st = steps[cur]!;
        const S = src.length;
        const T = r.dec.length;
        const lab = 30;
        const colW = (w - lab - 4) / Math.max(S, T);
        const cs = Math.max(3.6, Math.min(9, (colW * 0.62) / 4));
        const gw = cs * 4, gh = cs * 8;
        const chipH = 24;
        const yX = 16;
        const yH = yX + chipH / 2 + 14;
        const yC = yH + gh + 22;
        const yS = yC + gh + 30;
        const yY = yS + gh + 22;
        const need = yY + 30;
        if (fitHeight(cv.canvas, w, hgt, need)) return;
        const cx = (i: number) => lab + colW * (i + 0.5);
        const ink3 = withAlpha(color('--ink-3'), 0.7);
        const lit = color('--accent');
        const symLab = (s: string, y: number, k: Color) => text(ctx, s, 12, y, { font: 'serif', italic: true, weight: 600, size: 17, color: color(k) });
        symLab('x', yX, 'orange');
        symLab('h', yH + gh / 2, 'green');
        symLab('s', yS + gh / 2, 'blue');
        symLab('y', yY, 'slate');
        const encDone = st.kind === 'enc' ? st.j : S;
        const decDone = st.kind === 'dec' ? st.t : -1;
        // encoder
        for (let j = 0; j < S; j++) {
          const on = st.kind === 'enc' && st.j === j;
          chip(ctx, src[j]!, cx(j), yX, 'orange', { size: 11.5, on, dim: j > encDone, maxW: colW - 3 });
          const x0 = cx(j) - gw / 2;
          if (j <= encDone) {
            arrow(ctx, cx(j), yX + chipH / 2, cx(j), yH - 3, on ? lit : ink3, on ? 2 : 1.2, undefined, 5);
            heat(ctx, r.enc[j]!, x0, yH, 4, cs, color('green'), 0.7);
            if (on) rbox(ctx, x0 - 4, yH - 4, gw + 8, gh + 8, 4, null, lit, 2);
          } else {
            ctx.setLineDash([3, 3]);
            rbox(ctx, x0, yH, gw, gh, 3, null, ink3, 1);
            ctx.setLineDash([]);
          }
          if (j > 0 && j <= encDone) arrow(ctx, cx(j - 1) + gw / 2 + 2, yH + gh / 2, x0 - 3, yH + gh / 2, on ? lit : ink3, on ? 2 : 1.2, undefined, 5);
        }
        // the context vector: the last encoder state, the decoder's only view of the source
        const cOn = st.kind !== 'enc';
        const ccx = cx(S - 1);
        if (cOn) {
          arrow(ctx, ccx, yH + gh + 2, ccx, yC - 3, st.kind === 'c' ? lit : ink3, st.kind === 'c' ? 2 : 1.2, undefined, 5);
          heat(ctx, r.c!, ccx - gw / 2, yC, 4, cs, color('gold'), 0.7);
          rbox(ctx, ccx - gw / 2 - 4, yC - 4, gw + 8, gh + 8, 4, null, st.kind === 'c' ? lit : color('gold'), 2);
          const tx = ccx - gw / 2 - 10;
          text(ctx, 'c', tx, yC + gh / 2 - 8, { font: 'serif', italic: true, weight: 700, size: 17, color: color('gold'), align: 'right' });
          text(ctx, '32 numbers', tx, yC + gh / 2 + 9, { size: 11, color: color('--ink-2'), align: 'right' });
        }
        // decoder
        for (let t = 0; t < T; t++) {
          const on = st.kind === 'dec' && st.t === t;
          const x0 = cx(t) - gw / 2;
          if (t <= decDone) {
            // c feeds every decoder step
            ctx.strokeStyle = withAlpha(color('gold'), on ? 0.95 : 0.45);
            ctx.lineWidth = on ? 1.8 : 1;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.moveTo(ccx, yC + gh + 4);
            ctx.lineTo(cx(t), yS - 4);
            ctx.stroke();
            ctx.setLineDash([]);
            heat(ctx, r.dec[t]!, x0, yS, 4, cs, color('blue'), 0.7);
            if (on) rbox(ctx, x0 - 4, yS - 4, gw + 8, gh + 8, 4, null, lit, 2);
            if (t > 0) arrow(ctx, cx(t - 1) + gw / 2 + 2, yS + gh / 2, x0 - 3, yS + gh / 2, on ? lit : ink3, on ? 2 : 1.2, undefined, 5);
            arrow(ctx, cx(t), yS + gh + 2, cx(t), yY - 14, on ? lit : ink3, on ? 2 : 1.2, undefined, 5);
            const word = r.words[t] ?? '<eos>';
            chip(ctx, word, cx(t), yY, 'slate', { size: 11.5, on, maxW: colW - 3 });
            text(ctx, pct(r.probs[t]!), cx(t), yY + 19, { font: 'mono', size: 10.5, color: color('--ink-3') });
          } else {
            ctx.setLineDash([3, 3]);
            rbox(ctx, x0, yS, gw, gh, 3, null, ink3, 1);
            ctx.setLineDash([]);
          }
        }
      });
      cv.canvas.classList.add('scroll-ok');
      const sync = () => {
        if (!r) return;
        const st = steps[cur]!;
        if (st.kind === 'enc') {
          f.code.highlight('enc');
          f.code.set('now', `read "${src[st.j]}": h now summarizes ${st.j + 1} word${st.j ? 's' : ''}`);
          f.status(`The encoder reads **${src[st.j]}** and folds it into its state. Each grid is one 32-number state vector (darker means larger; slate cells are negative).`);
        } else if (st.kind === 'c') {
          f.code.highlight('c');
          f.code.set('now', 'c = h: everything the decoder will know');
          f.status('The last encoder state becomes $\\symc$. From here on, the source sentence is gone: the decoder sees only these 32 numbers.');
        } else {
          const w = r.words[st.t] ?? '<eos>';
          f.code.highlight(['dec', 'p']);
          f.code.set('now', `wrote "${w}" with p = ${fmt(r.probs[st.t]!, 3)}`);
          f.status(`Step ${st.t + 1}: likeliest next words ${r.top[st.t]!.map(([wd, q]) => `**${esc(wd)}** ${pct(q)}`).join(', ')}.`);
        }
        cv.redraw();
      };
      const stepper = f.stepper({
        steps: 1,
        interval: 900,
        label: (k) => {
          const st = steps[k];
          if (!st) return '';
          return st.kind === 'enc' ? `encode ${st.j + 1} / ${src.length}` : st.kind === 'c' ? 'hand over c' : `decode ${st.t + 1} / ${r!.dec.length}`;
        },
        onStep: (k) => {
          cur = k;
          sync();
        },
      });
      f.segmented({
        label: 'sentence',
        options: PRESETS.map((q) => ({ value: q.value, label: q.label })),
        value: 'cat',
        onChange: (v) => {
          src = PRESETS.find((q) => q.value === v)!.src.split(' ');
          f.code.set('src', src.join(' '));
          build();
          stepper.setSteps(steps.length);
          stepper.go(0);
        },
      });
      f.status('Loading the toy translators (0.4 MB)…');
      loadModels()
        .then((ms) => {
          model = ms.encdec32!;
          build();
          stepper.setSteps(steps.length);
          stepper.go(0);
        })
        .catch((e) => f.status(`Could not load the models: ${(e as Error).message}`));
    },
    caption: `A real model, running in your browser: the 32-number encoder-decoder trained for this chapter. **Step through** it. The encoder reads one word per step (top row), updating its state $\\symh$. Its last state becomes the context $\\symc$ (gold), and the decoder (bottom) writes French one word per step, feeding each word back in and reading the same $\\symc$ every time (dashed lines). The percentage under each word is the probability the decoder gave it. The decoder stops when its likeliest next word is the end token.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: quality versus sentence length                                  */
/* ------------------------------------------------------------------ */

const CURVES: { key: string; label: string; k: Color }[] = [
  { key: 'encdec32', label: 'fixed vector, 32', k: 'orange' },
  { key: 'encdec64', label: 'fixed vector, 64', k: 'purple' },
  { key: 'attn', label: 'attention, 32', k: 'teal' },
];

function figLength(p: Page): void {
  const PER = 12;
  p.figure({
    title: 'One vector for every sentence: quality falls with length',
    codeTitle: 'length_test.py',
    code: `
      models = {"fixed vector, 32": encdec32,
                "fixed vector, 64": encdec64,
                "attention, 32": attn}
      def perfect(m, x):
          return m.translate(x) == reference(x)

      for L in range(5, 41):      # words  #@loop
          tests = [random_sentence(L)
                   for _ in range(${PER})]
          for name, m in models.items():       #@eval
              ok = [perfect(m, x) for x in tests]  #@eval
              acc[name][L] = np.mean(ok)       #@eval
      # fraction perfect for 32, 64, attention:
      # L = {{L:5}}: {{a0:…}}, {{a1:…}}, {{a2:…}}
    `,
    setup(f) {
      let models: Record<string, Translator> | null = null;
      let seed = 3;
      let tests: string[][][] = [];
      let refs: string[][][] = [];
      const acc: number[][] = CURVES.map(() => []);
      let cursor = 0;
      let sel = 30;
      let sample = 0;
      const lengths = MAXL - MINL + 1;
      const total = lengths * PER * CURVES.length;
      const makeTests = () => {
        const rng = new Rng(seed);
        const u = () => rng.next();
        tests = [];
        for (let L = MINL; L <= MAXL; L++) {
          const row: string[][] = [];
          for (let i = 0; i < PER; i++) row.push(sentenceOfLength(u, L) ?? sentence(u, 3));
          tests.push(row);
        }
        refs = tests.map((row) => row.map((s) => reference(s)));
        for (const a of acc) a.length = 0;
        cursor = 0;
      };
      makeTests();
      const counts = CURVES.map(() => new Array<number>(lengths).fill(0));
      const pl = f.plot({
        aspect: 1.3,
        square: false,
        domain: [MINL - 4.2, MAXL + 1, -15, 106],
        draw: (pp) => {
          const c = pp.ctx;
          const [x0, x1] = [MINL - 1, MAXL + 1];
          // fixed pixel margins, so the percent labels fit at any width
          const kx = (pp.w - 44) / (x1 - x0);
          if (Math.abs(pp.sx(x0) - 38) > 1) pp.setDomain(x0 - 38 / kx, x1 + 6 / kx, -15, 106);
          c.lineWidth = 1;
          for (let v = 0; v <= 100; v += 25) {
            c.strokeStyle = color(v === 0 ? '--axis' : '--grid');
            c.beginPath();
            c.moveTo(pp.sx(x0), pp.sy(v));
            c.lineTo(pp.sx(x1), pp.sy(v));
            c.stroke();
            label(c, `${v}%`, pp.sx(x0) - 5, pp.sy(v), color('--ink-3'), 10.5, 'right');
          }
          for (let L = 5; L <= 40; L += 5) label(c, String(L), pp.sx(L), pp.sy(-6), color('--ink-3'), 10.5, 'center');
          label(c, 'sentence length (words)', pp.sx((x0 + x1) / 2), pp.sy(-12.2), color('--ink-2'), 11, 'center');
          // selected length
          c.strokeStyle = withAlpha(color('--accent'), 0.8);
          c.setLineDash([4, 4]);
          c.beginPath();
          c.moveTo(pp.sx(sel), pp.sy(-2));
          c.lineTo(pp.sx(sel), pp.sy(104));
          c.stroke();
          c.setLineDash([]);
          CURVES.forEach((cu, m) => {
            const xs: number[] = [], ys: number[] = [];
            acc[m]!.forEach((a, i) => {
              if (a === undefined) return;
              xs.push(MINL + i);
              ys.push(a * 100 + (m - 1) * 0.9);
            });
            if (xs.length > 1) pp.path(xs, ys, color(cu.k), 2.4);
            xs.forEach((x, i) => pp.dot(x, ys[i]!, 2.6, color(cu.k)));
          });
          // legend, bottom left, where every curve is still near 100%
          const lx = pp.sx(MINL + 0.2), ly = pp.sy(42);
          rbox(c, lx - 6, ly - 10, 138, 60, 6, withAlpha(color('--card'), 0.92), color('--rule'), 1);
          CURVES.forEach((cu, m) => {
            c.strokeStyle = color(cu.k);
            c.lineWidth = 2.6;
            c.beginPath();
            c.moveTo(lx, ly + m * 19);
            c.lineTo(lx + 16, ly + m * 19);
            c.stroke();
            label(c, cu.label, lx + 22, ly + m * 19, color('--ink-2'), 11.5);
          });
        },
      });
      const panel = document.createElement('div');
      panel.style.cssText = 'font: 13.5px/1.55 var(--font-ui); color: var(--ink-2); display: grid; gap: 6px; min-height: 9em;';
      f.viz.append(panel);
      const progress = f.readout('tested');
      const showSample = () => {
        if (!models) return;
        const li = sel - MINL;
        const x = tests[li]![sample % PER]!;
        const ref = refs[li]![sample % PER]!;
        const rows = CURVES.map((cu) => {
          const out = models![cu.key]!.translate(x).words;
          const ok = lcsMarks(out, ref);
          const nGood = ok.filter(Boolean).length;
          const words = out.map((w, i) => (ok[i] ? esc(w) : `<span style="color:var(--c-red);text-decoration:underline wavy;text-underline-offset:3px">${esc(w)}</span>`)).join(' ');
          const missing = ref.length - nGood;
          const verdict = missing === 0 && nGood === out.length ? '<b style="color:var(--c-green)">perfect</b>' : `<b style="color:var(--c-red)">${out.length - nGood} wrong, ${missing} missing</b>`;
          return `<div><span style="color:var(--c-${cu.k});font-weight:600">${cu.label}</span> · ${verdict}<br><span style="font-family:var(--font-mono);font-size:12.5px;color:var(--ink)">${words}</span></div>`;
        });
        panel.innerHTML =
          `<div><b>English, ${sel} words</b><br><span style="font-family:var(--font-mono);font-size:12.5px;color:var(--ink)">${esc(x.join(' '))}</span></div>` +
          `<div><b>Reference</b><br><span style="font-family:var(--font-mono);font-size:12.5px;color:var(--ink)">${esc(ref.join(' '))}</span></div>` +
          rows.join('');
      };
      const syncCode = (L: number) => {
        const li = L - MINL;
        f.code.setMany({ L, a0: acc[0]![li] === undefined ? '…' : fmt(acc[0]![li]!, 2), a1: acc[1]![li] === undefined ? '…' : fmt(acc[1]![li]!, 2), a2: acc[2]![li] === undefined ? '…' : fmt(acc[2]![li]!, 2) });
      };
      // One test translation per model per sentence, length by length, a few milliseconds per frame.
      const loop = f.loop(() => {
        if (!models) return;
        const t0 = performance.now();
        while (cursor < total && performance.now() - t0 < 12) {
          const li = Math.floor(cursor / (PER * CURVES.length));
          const rem = cursor % (PER * CURVES.length);
          const i = Math.floor(rem / CURVES.length);
          const m = rem % CURVES.length;
          if (i === 0) counts[m]![li] = 0;
          const out = models[CURVES[m]!.key]!.translate(tests[li]![i]!, undefined, false).words;
          if (out.join(' ') === refs[li]![i]!.join(' ')) counts[m]![li]!++;
          if (i === PER - 1) acc[m]![li] = counts[m]![li]! / PER;
          cursor++;
        }
        const li = Math.min(lengths - 1, Math.floor(cursor / (PER * CURVES.length)));
        f.code.highlight(cursor < total ? 'eval' : null);
        syncCode(cursor < total ? MINL + li : sel);
        progress.set(`${Math.floor(cursor / CURVES.length)} / ${lengths * PER} sentences`);
        pl.redraw();
        if (cursor >= total) {
          syncCode(sel);
          return false;
        }
      });
      const pick = (e: PointerEvent) => {
        const [x] = pl.pointer(e);
        const L = Math.max(MINL, Math.min(MAXL, Math.round(x)));
        if (L !== sel) {
          sel = L;
          sample = 0;
          showSample();
          if (cursor >= total) syncCode(sel);
          pl.redraw();
        }
      };
      let dragging = false;
      pl.canvas.classList.add('scroll-ok');
      pl.canvas.addEventListener('pointerdown', (e) => {
        dragging = true;
        pick(e);
      });
      pl.canvas.addEventListener('pointermove', (e) => dragging && pick(e));
      pl.canvas.addEventListener('pointerup', () => (dragging = false));
      pl.canvas.addEventListener('pointerleave', () => (dragging = false));
      f.button('Another sentence', () => {
        sample++;
        showSample();
      });
      f.button('New test set', () => {
        seed++;
        makeTests();
        sample = 0;
        showSample();
        loop.start();
      });
      f.status('Loading the toy translators…');
      loadModels()
        .then((ms) => {
          models = ms;
          f.status('');
          showSample();
          loop.start();
        })
        .catch((e) => f.status(`Could not load the models: ${(e as Error).message}`));
    },
    caption: `Each point is the fraction of ${PER} random sentences of that length that a model translated *perfectly*, computed live in your browser as you watch. The two fixed-vector models differ only in the size of $\\symc$. With 32 numbers the model is flawless up to about a dozen words and then falls off a cliff; with 64 the cliff moves out to around 30 words, but it is still a cliff. The attention model's decoder state is only 32 numbers too, yet it stays near 100% at every length, because it never has to hold the sentence: it looks back at it. **Tap the chart** to pick a length and see one sentence and what each model wrote (red: words not in the reference). The fixed-vector models typically get the start right and then drift: animals swap places, colors land on the wrong noun, phrases go missing.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: the alignment matrix                                            */
/* ------------------------------------------------------------------ */

function figAlign(p: Page): void {
  const PRESETS = [
    { value: 'a', label: 'cat and dog', src: 'the black cat sees a white dog' },
    { value: 'b', label: 'fox and wolf', src: 'a fox chases the red duck and the gray wolf' },
    { value: 'c', label: 'long', src: 'the brown tiger likes a pig and the green fish and a white rabbit' },
  ];
  const SCORE = {
    additive: 'np.tanh(Wa @ s + hs @ Ua.T + b) @ va',
    general: 'hs @ (Wg @ s)',
  };
  p.figure({
    title: 'Bahdanau attention, live: the alignment matrix',
    codeTitle: 'attention_decoder.py',
    code: `
      src = "{{src}}".split()
      hs = encode_bidirectional(src)  # (S, 32)
      s = np.tanh(W_init @ h_back[0] + b_init)
      y = "<bos>"
      for t in range(len(src) + 3):
          e = {{score:${SCORE.additive}}}  #@e
          alpha = softmax(e)    # row t       #@a
          c = alpha @ hs        # context     #@c
          inp = np.concatenate([emb_tgt[y], c])  #@c
          s = gru_dec(s, inp)                    #@c
          z = W_out @ np.concatenate([s, c])
          y = vocab_tgt[(z + b_out).argmax()]
          if y == "<eos>": break
      # row {{t:1}} "{{word:chat}}": most on "{{best:cat}}" ({{pc:99%}})
    `,
    setup(f) {
      let models: Record<string, Translator> | null = null;
      let which: 'attn' | 'attndot' = 'attn';
      let src = PRESETS[0]!.src.split(' ');
      let r: Translation | null = null;
      let row = 1;
      let lay = { top: 0, cell: 1, left: 0, rows: 0 };
      const rng = new Rng(11);
      const run = () => {
        if (!models) return;
        r = models[which]!.translate(src);
        row = Math.min(row, r.alpha!.length - 1);
        sync();
      };
      const cv = f.canvas(640, 520, (ctx, w, hgt) => {
        if (!r) return;
        const S = src.length;
        const T = r.alpha!.length;
        const outW = [...r.words, '<end>'];
        ctx.font = `600 11.5px 'JetBrains Mono Variable', ui-monospace, monospace`;
        const labW = Math.max(...outW.map((s) => ctx.measureText(s).width)) + 14;
        ctx.font = `500 11.5px 'JetBrains Mono Variable', ui-monospace, monospace`;
        const srcW = Math.max(...src.map((s) => ctx.measureText(s).width));
        const cell = Math.min((w - labW - 4 - srcW * 0.6) / S, 40, 300 / T);
        const top = srcW * 0.72 + 14;
        const left = labW + Math.max(0, (w - labW - 4 - srcW * 0.6 - S * cell) / 2);
        const barH = 40;
        const yE = top + T * cell + 16;
        const yA = yE + barH + 22;
        const need = yA + barH + 10;
        lay = { top, cell, left, rows: T };
        if (fitHeight(cv.canvas, w, hgt, need)) return;
        // column labels (source)
        for (let j = 0; j < S; j++) {
          const x = left + (j + 0.5) * cell;
          const best = r.alpha![row]![j]! === Math.max(...r.alpha![row]!);
          const col = best ? color('orange') : color('--ink-2');
          ctx.save();
          ctx.translate(x + 3, top - 6);
          ctx.rotate(-Math.PI / 4);
          text(ctx, src[j]!, 0, 0, { font: 'mono', size: 11.5, weight: best ? 700 : 500, color: col, align: 'left' });
          ctx.restore();
        }
        // rows (target) and cells
        const teal = color('teal');
        for (let t = 0; t < T; t++) {
          const y = top + t * cell;
          const on = t === row;
          text(ctx, outW[t]!, left - 7, y + cell / 2, { font: 'mono', size: 11.5, weight: on ? 700 : 500, color: t === T - 1 ? color('--ink-3') : on ? color('--ink') : color('--ink-2'), align: 'right' });
          for (let j = 0; j < S; j++) {
            const a = r.alpha![t]![j]!;
            ctx.fillStyle = withAlpha(teal, 0.03 + 0.92 * Math.pow(a, 0.75));
            ctx.fillRect(left + j * cell + 0.5, y + 0.5, cell - 1, cell - 1);
            if (cell >= 30 && a >= 0.05) text(ctx, String(Math.round(a * 100)), left + (j + 0.5) * cell, y + cell / 2, { font: 'mono', size: 10.5, weight: 600, color: a > 0.5 ? color('--paper') : color('--ink-2') });
          }
        }
        ctx.strokeStyle = color('--rule');
        ctx.lineWidth = 1;
        ctx.strokeRect(left, top, S * cell, T * cell);
        rbox(ctx, left - labW + 2, top + row * cell, labW + S * cell - 1, cell, 3, null, color('--accent'), 2);
        // the selected row, unpacked: scores, then weights
        const e = r.scores![row]!;
        const al = r.alpha![row]!;
        const hiE = Math.max(0, ...e), loE = Math.min(0, ...e);
        const spanE = hiE - loE || 1;
        const zero = yE + (barH * hiE) / spanE;
        text(ctx, 'e', left - 30, yE + barH / 2, { font: 'serif', italic: true, weight: 700, size: 16, color: color('purple') });
        text(ctx, 'α', left - 30, yA + barH / 2, { font: 'serif', italic: true, weight: 700, size: 16, color: teal });
        label(ctx, `scores for "${outW[row]}"`, left, yE - 7, color('--ink-3'), 11);
        label(ctx, 'softmax: the weights', left, yA - 7, color('--ink-3'), 11);
        ctx.strokeStyle = color('--axis');
        ctx.beginPath();
        ctx.moveTo(left, zero);
        ctx.lineTo(left + S * cell, zero);
        ctx.stroke();
        for (let j = 0; j < S; j++) {
          const x = left + j * cell + cell * 0.18;
          const bw = cell * 0.64;
          const hgtE = (Math.abs(e[j]!) / spanE) * barH;
          ctx.fillStyle = withAlpha(color('purple'), 0.75);
          ctx.fillRect(x, e[j]! >= 0 ? zero - hgtE : zero, bw, Math.max(1, hgtE));
          const ha = al[j]! * barH;
          ctx.fillStyle = withAlpha(teal, 0.85);
          ctx.fillRect(x, yA + barH - ha, bw, Math.max(1, ha));
        }
        ctx.strokeStyle = color('--axis');
        ctx.beginPath();
        ctx.moveTo(left, yA + barH);
        ctx.lineTo(left + S * cell, yA + barH);
        ctx.stroke();
      });
      const pickRow = (e: PointerEvent) => {
        const rc = cv.canvas.getBoundingClientRect();
        const y = e.clientY - rc.top;
        const t = Math.floor((y - lay.top) / lay.cell);
        if (t >= 0 && t < lay.rows && t !== row) {
          row = t;
          sync();
        }
      };
      cv.canvas.style.touchAction = 'pan-y';
      cv.canvas.addEventListener('pointerdown', pickRow);
      cv.canvas.addEventListener('pointermove', (e) => e.buttons && pickRow(e));
      const sync = () => {
        if (!r) return;
        const al = r.alpha![row]!;
        let best = 0;
        al.forEach((a, j) => a > al[best]! && (best = j));
        f.code.setMany({ src: src.join(' '), t: row, word: r.words[row] ?? '<eos>', best: src[best]!, pc: pct(al[best]!) });
        f.code.highlight(['e', 'a']);
        cv.redraw();
      };
      const seg = f.segmented({
        label: 'sentence',
        options: [...PRESETS.map((q) => ({ value: q.value, label: q.label })), { value: 'rand', label: 'random' }],
        value: 'a',
        onChange: (v) => {
          if (v === 'rand') src = sentence(() => rng.next(), 2 + Math.floor(rng.next() * 3), 0.6);
          else src = PRESETS.find((q) => q.value === v)!.src.split(' ');
          row = 1;
          run();
        },
      });
      f.button('Another random one', () => {
        seg.set('rand', true);
      });
      f.segmented({
        label: 'score',
        options: [
          { value: 'attn', label: 'additive (Bahdanau)' },
          { value: 'attndot', label: 'general (dot product)' },
        ],
        value: 'attn',
        onChange: (v) => {
          which = v as 'attn' | 'attndot';
          f.code.set('score', which === 'attn' ? SCORE.additive : SCORE.general);
          run();
        },
      });
      f.status('Loading the toy translators…');
      loadModels()
        .then((ms) => {
          models = ms;
          f.status('');
          run();
        })
        .catch((e) => f.status(`Could not load the models: ${(e as Error).message}`));
    },
    caption: `The attention model translating, live. Row $t$ is the attention $\\symalpha_{tj}$ the decoder spread over the English words while writing French word $t$ (numbers are percents). Nobody told the model which words correspond: it was only ever trained to produce the right French, and the alignment fell out. Mostly it is the diagonal, but look at every color: *black cat* becomes *chat noir*, so the attention steps forward to the noun, then back to the color, drawing a small cross. **Tap a row** to see its raw scores $\\syme_{tj}$ and the softmax that turns them into weights. Switch the **score** to a model trained with a dot-product score instead of Bahdanau's small network: the alignment is almost the same. (The last row, the end token, has no word to look at, so its attention wanders.)`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: a soft dictionary in 2-D                                        */
/* ------------------------------------------------------------------ */

const KEYS: [number, number][] = [[1.6, 0.4], [-0.3, 1.55], [-1.45, -0.55], [0.55, -1.45], [0.3, 0.15]];
const KEY_COLORS: Color[] = ['red', 'gold', 'blue', 'green', 'purple'];

function figLookup(p: Page): void {
  const SC = { dot: 'keys @ q', dist: '-((keys - q)**2).sum(axis=1)' };
  p.figure({
    title: 'A dictionary, made soft: drag the query',
    codeTitle: 'soft_lookup.py',
    code: `
      keys = np.array([[1.6, 0.4],      # k1
                       [-0.3, 1.55],    # k2
                       [-1.45, -0.55],  # k3
                       [0.55, -1.45],   # k4
                       [0.3, 0.15]])    # k5
      values = np.array([RED, GOLD, BLUE,
                         GREEN, PURPLE])  # RGB
      q = np.array([{{q0:1.2}}, {{q1:0.9}}])   # drag me

      e = {{score:keys @ q}}                 # (5,)  #@e
      alpha = softmax({{beta:2}} * e)           # soft  #@soft
      c = alpha @ values     # a blended color   #@soft
      c_hard = values[e.argmax()]  # hard #@hard
      # alpha = [{{al:…}}]
    `,
    setup(f) {
      let q: [number, number] = [1.2, 0.9];
      let beta = 2;
      let mode: 'soft' | 'hard' = 'soft';
      let score: 'dot' | 'dist' = 'dot';
      const scores = (x: number, y: number): number[] => KEYS.map(([a, b]) => (score === 'dot' ? a * x + b * y : -((a - x) ** 2 + (b - y) ** 2)));
      const weights = (x: number, y: number): number[] => {
        const e = scores(x, y);
        if (mode === 'soft') return softmax(e.map((v) => beta * v));
        let best = 0;
        e.forEach((v, i) => v > e[best]! && (best = i));
        return e.map((_, i) => (i === best ? 1 : 0));
      };
      let cols: [number, number, number][] = [];
      const blend = (w: number[]): [number, number, number] => [0, 1, 2].map((ch) => w.reduce((s, a, i) => s + a * cols[i]![ch]!, 0)) as [number, number, number];
      const pl = f.plot({
        aspect: 1.05,
        domain: [-2.3, 2.3, -2.3, 2.3],
        draw: (pp) => {
          cols = KEY_COLORS.map(rgbK);
          pp.field((x, y) => {
            const [r, g, b] = blend(weights(x, y));
            return [r, g, b, 120];
          }, 4);
          pp.axes({ grid: 1 });
          const w = weights(q[0], q[1]);
          KEYS.forEach(([a, b], i) => {
            const c = color(KEY_COLORS[i]!);
            pp.ctx.beginPath();
            pp.ctx.arc(pp.sx(a), pp.sy(b), 7 + 16 * w[i]!, 0, Math.PI * 2);
            pp.ctx.strokeStyle = withAlpha(color('teal'), 0.25 + 0.75 * w[i]!);
            pp.ctx.lineWidth = 1 + 3 * w[i]!;
            pp.ctx.stroke();
            pp.dot(a, b, 7, c, color('--paper'));
            pp.text(`k${i + 1}`, a + 0.17, b + 0.17, { size: 12, bold: true, color: color('--ink') });
          });
          if (score === 'dot') pp.arrow(0, 0, q[0], q[1], color('blue'), 2.5);
          pp.dot(q[0], q[1], 8, color('blue'), color('--paper'));
          pp.text('q', q[0] - 0.12, q[1] + 0.2, { size: 14, bold: true, color: color('blue'), align: 'right' });
        },
      });
      const bars = f.canvas(640, 84, (ctx, w, h) => {
        const al = weights(q[0], q[1]);
        const sw = Math.min(70, w * 0.18);
        const bw = (w - sw - 24) / KEYS.length;
        al.forEach((a, i) => {
          const x = i * bw + 4;
          const bh = (h - 34) * a;
          rbox(ctx, x + bw * 0.15, h - 22 - bh, bw * 0.7, Math.max(1.5, bh), 3, withAlpha(color(KEY_COLORS[i]!), 0.85), null);
          text(ctx, `k${i + 1}`, x + bw / 2, h - 10, { font: 'mono', size: 11, color: color('--ink-2') });
          text(ctx, pct(a), x + bw / 2, Math.max(9, h - 30 - bh), { font: 'mono', size: 10.5, color: color('--ink') });
        });
        const [r, g, b] = blend(al);
        const x0 = w - sw - 4;
        rbox(ctx, x0, 6, sw, h - 30, 8, `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`, color('--rule'), 1);
        text(ctx, mode === 'soft' ? 'c (blend)' : 'c_hard', x0 + sw / 2, h - 10, { font: 'mono', size: 11, color: color('gold') });
      });
      bars.canvas.classList.add('scroll-ok');
      const sync = () => {
        const al = weights(q[0], q[1]);
        f.code.setMany({ q0: fmt(q[0], 2), q1: fmt(q[1], 2), al: al.map((a) => fmt(a, 2)).join(', ') });
        f.code.highlight(['e', mode]);
        pl.redraw();
        bars.redraw();
      };
      let drag = false;
      const move = (e: PointerEvent) => {
        const [x, y] = pl.pointer(e);
        q = [Math.max(-2.2, Math.min(2.2, x)), Math.max(-2.2, Math.min(2.2, y))];
        sync();
      };
      pl.canvas.addEventListener('pointerdown', (e) => {
        drag = true;
        pl.canvas.setPointerCapture(e.pointerId);
        move(e);
      });
      pl.canvas.addEventListener('pointermove', (e) => drag && move(e));
      pl.canvas.addEventListener('pointerup', () => (drag = false));
      f.segmented({
        label: 'lookup',
        options: [
          { value: 'soft', label: 'soft (blend)' },
          { value: 'hard', label: 'hard (best key)' },
        ],
        value: 'soft',
        onChange: (v) => {
          mode = v as 'soft' | 'hard';
          sync();
        },
      });
      f.slider({ label: 'sharpness β', min: -1, max: 1.2, step: 0.01, value: Math.log10(2), map: (r) => 10 ** r, format: (v) => fmt(v, 2), slot: 'beta', onInput: (v) => { beta = v; sync(); } });
      f.segmented({
        label: 'score',
        options: [
          { value: 'dot', label: 'dot product q·k' },
          { value: 'dist', label: '−distance²' },
        ],
        value: 'dot',
        onChange: (v) => {
          score = v as 'dot' | 'dist';
          f.code.set('score', SC[score]);
          sync();
        },
      });
      sync();
    },
    caption: `Five entries, each **filed under** a key $\\symk_i$ (a point in the plane) and **holding** a value $\\symv_i$ (a color). The background shows what the lookup returns for a query anywhere in the plane. **Drag the query** $\\symq$. In *soft* mode the result is a blend of every color, weighted by $\\symalpha$ (the bars, and the rings around the keys); in *hard* mode one key wins and the plane breaks into flat regions with sharp borders. Raise the **sharpness** and soft turns into hard. With the dot-product score, notice that $k_5$, a short key near the middle, never wins anywhere: a dot product rewards keys for being long as well as for pointing the right way. Switch to $-\\text{distance}^2$ and every key owns the region nearest to it.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: hard lookup is a staircase, soft lookup is a ramp               */
/* ------------------------------------------------------------------ */

function figStaircase(p: Page): void {
  const K = [-2, -1, 0, 1, 2];
  const VALS = [0.6, 2.6, 1.4, 3.6, 3.0];
  p.figure({
    title: 'Hard lookup is a staircase; soft lookup is a ramp',
    codeTitle: 'learn_the_query.py',
    code: `
      keys = np.array([-2, -1, 0, 1, 2])
      values = np.array([0.6, 2.6, 1.4, 3.6, 3.0])
      def lookup(q, beta):
          e = -beta * (q - keys)**2      #@fwd
          alpha = softmax(e)                        #@fwd
          return alpha @ values, alpha              #@fwd

      q, target = {{q:0.2}}, {{target:3.2}}
      for it in range(200):
          c, alpha = lookup(q, {{beta:2}})           #@fwd
          dc_de = alpha * (values - c)   #@grad
          de_dq = -2 * {{beta:2}} * (q - keys)       #@grad
          dc_dq = dc_de @ de_dq                     #@grad
          step = 0.1 * (c - target) * dc_dq         #@upd
          q -= np.clip(step, -0.15, 0.15)           #@upd
      # soft: c = {{c:…}}, dc/dq = {{g:…}}
      # hard: c = values[e.argmax()], dc/dq = 0
    `,
    setup(f) {
      let beta = 2;
      let target = 3.2;
      let q0 = 0.2;
      let qs = q0;
      let steps = 0;
      const look = (q: number) => {
        const al = softmax(K.map((k) => -beta * (q - k) ** 2));
        const c = al.reduce((s, a, i) => s + a * VALS[i]!, 0);
        const dcde = al.map((a, i) => a * (VALS[i]! - c));
        const g = dcde.reduce((s, d, i) => s + d * (-2 * beta * (q - K[i]!)), 0);
        return { c, g };
      };
      const hard = (q: number) => {
        let best = 0;
        K.forEach((k, i) => Math.abs(q - k) < Math.abs(q - K[best]!) && (best = i));
        return VALS[best]!;
      };
      const pl = f.plot({
        aspect: 1.45,
        square: false,
        domain: [-3, 3, -0.95, 4.4],
        draw: (pp) => {
          const c = pp.ctx;
          for (let v = 0; v <= 4; v++) {
            c.strokeStyle = color('--grid');
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(pp.sx(-3), pp.sy(v));
            c.lineTo(pp.sx(3), pp.sy(v));
            c.stroke();
            pp.text(String(v), -2.93, v + 0.06, { size: 10.5, mono: true, color: color('--ink-3') });
          }
          c.strokeStyle = color('--axis');
          c.beginPath();
          c.moveTo(pp.sx(-3), pp.sy(-0.25));
          c.lineTo(pp.sx(3), pp.sy(-0.25));
          c.stroke();
          K.forEach((k) => pp.text(`k=${k}`, k, -0.88, { align: 'center', size: 10.5, mono: true, color: color('green') }));
          // target
          pp.path([-3, 3], [target, target], color('gold'), 1.8, [6, 4]);
          pp.text('target', 2.95, target + 0.1, { align: 'right', size: 11, color: color('gold'), bold: true });
          // hard: staircase
          const xs: number[] = [], ys: number[] = [];
          for (let i = 0; i <= 600; i++) {
            const x = -3 + (6 * i) / 600;
            xs.push(x);
            ys.push(hard(x));
          }
          pp.path(xs, ys, withAlpha(color('slate'), 0.9), 2, [5, 3]);
          // soft: ramp
          pp.fn((x) => look(x).c, color('teal'), 2.6);
          K.forEach((k, i) => pp.dot(k, VALS[i]!, 4.5, color('red'), color('--paper')));
          // the query, and the two learners
          const cs = look(qs);
          pp.path([qs, qs], [-0.25, cs.c], withAlpha(color('blue'), 0.7), 1.5, [3, 3]);
          pp.dot(qs, cs.c, 6.5, color('teal'), color('--paper'));
          pp.dot(q0, hard(q0), 6.5, color('slate'), color('--paper'));
          const tri = (x: number, k: string, up: boolean) => {
            const X = pp.sx(x), Y = pp.sy(-0.25);
            c.beginPath();
            c.moveTo(X, Y + (up ? -2 : 2));
            c.lineTo(X - 6, Y + (up ? 9 : -9));
            c.lineTo(X + 6, Y + (up ? 9 : -9));
            c.closePath();
            c.fillStyle = color(k as Color);
            c.fill();
          };
          tri(q0, 'slate', false);
          tri(qs, 'blue', true);
          // legend
          const lx = pp.sx(-2.55), ly = pp.sy(4.15);
          [['soft lookup c(q)', 'teal', []], ['hard lookup', 'slate', [5, 3]]].forEach(([s, k, d], i) => {
            c.strokeStyle = color(k as Color);
            c.lineWidth = 2.4;
            c.setLineDash(d as number[]);
            c.beginPath();
            c.moveTo(lx, ly + i * 17);
            c.lineTo(lx + 18, ly + i * 17);
            c.stroke();
            c.setLineDash([]);
            label(c, s as string, lx + 24, ly + i * 17, color('--ink-2'), 11.5);
          });
        },
      });
      const softRo = f.readout('soft dc/dq');
      const hardRo = f.readout('hard dc/dq');
      const sync = () => {
        const s = look(qs);
        f.code.setMany({ q: fmt(qs, 3), c: fmt(s.c, 3), g: fmt(s.g, 3) });
        softRo.set(fmt(s.g, 3));
        hardRo.set('0');
        pl.redraw();
      };
      const loop = f.loop(() => {
        for (let k = 0; k < 2; k++) {
          const s = look(qs);
          const step = 0.1 * (s.c - target) * s.g;
          qs = Math.max(-3, Math.min(3, qs - Math.max(-0.15, Math.min(0.15, step))));
          steps++;
        }
        f.code.highlight(['fwd', 'grad', 'upd'][steps % 3]!);
        sync();
        const s = look(qs);
        if (Math.abs(s.c - target) < 0.005 || Math.abs(s.g) < 1e-4 || steps >= 200) {
          f.code.highlight(null);
          f.status(Math.abs(s.c - target) < 0.005
            ? `Soft: reached the target in ${steps} steps, at q = ${fmt(qs, 3)}. Hard: still at q = ${fmt(q0, 3)}. Its gradient was exactly 0 the whole time.`
            : `Soft: stopped after ${steps} steps at c = ${fmt(s.c, 3)}, on a hilltop or a flat stretch of its curve where the slope is zero. Gradient descent only sees the local slope. Hard: never moved.`);
          btn.textContent = 'Descend';
          return false;
        }
      });
      const btn = f.button('Descend', () => {
        if (loop.running()) {
          loop.stop();
          btn.textContent = 'Descend';
          return;
        }
        steps = 0;
        f.status('');
        btn.textContent = 'Pause';
        loop.start();
      }, { primary: true });
      let drag = false;
      const move = (e: PointerEvent) => {
        const [x] = pl.pointer(e);
        q0 = qs = Math.max(-2.95, Math.min(2.95, x));
        loop.stop();
        btn.textContent = 'Descend';
        f.status('');
        sync();
      };
      pl.canvas.addEventListener('pointerdown', (e) => {
        drag = true;
        pl.canvas.setPointerCapture(e.pointerId);
        move(e);
      });
      pl.canvas.addEventListener('pointermove', (e) => drag && move(e));
      pl.canvas.addEventListener('pointerup', () => (drag = false));
      f.slider({ label: 'target', min: 0.8, max: 3.5, step: 0.05, value: target, slot: 'target', onInput: (v) => { target = v; sync(); } });
      f.slider({ label: 'sharpness β', min: -0.5, max: 1.3, step: 0.01, value: Math.log10(2), map: (r) => 10 ** r, format: (v) => fmt(v, 2), slot: 'beta', onInput: (v) => { beta = v; sync(); } });
      sync();
    },
    caption: `Five keys on a line (green labels), each holding a number (red dots). The query is a position $q$; the output is the value found there. The dashed staircase is the hard lookup: the nearest key's value, flat between jumps. The teal curve is the soft lookup: a smooth blend. Suppose training wants the output to equal the gold **target**. Press **Descend** to run gradient descent on $q$ for both. The soft learner (blue triangle) slides along its ramp to the target; the hard learner (gray triangle) cannot move, because on a flat step the gradient is exactly zero: there is no "warmer" or "colder" to follow. **Drag** on the plot to restart from another $q$, and raise the **sharpness**: the ramp turns into the staircase, its slopes flatten everywhere except at the jumps, and descent gets stuck too.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: dot product versus additive scores                              */
/* ------------------------------------------------------------------ */

function figScores(p: Page): void {
  const A = 6;
  type Net = { W: number[][]; U: number[][]; b: number[]; va: number[] };
  // Three pairs of units with W = -U and a bias: the score becomes a bump centered on the query.
  const bump = (): Net => {
    const U: number[][] = [];
    for (let i = 0; i < 3; i++) {
      const th = (i * Math.PI) / 3;
      U.push([1.6 * Math.cos(th), 1.6 * Math.sin(th)], [-1.6 * Math.cos(th), -1.6 * Math.sin(th)]);
    }
    return { U, W: U.map(([a, b]) => [-a!, -b!]), b: new Array(A).fill(1), va: new Array(A).fill(1) };
  };
  const random = (rng: Rng): Net => ({
    W: Array.from({ length: A }, () => [rng.randn() * 1.2, rng.randn() * 1.2]),
    U: Array.from({ length: A }, () => [rng.randn() * 1.2, rng.randn() * 1.2]),
    b: Array.from({ length: A }, () => rng.randn() * 0.6),
    va: Array.from({ length: A }, () => rng.randn() * 1.1),
  });
  const big = (v: number) => (v >= 1e12 ? `${fmt(v / 1e12, 3)} T` : v >= 1e9 ? `${fmt(v / 1e9, 3)} G` : v >= 1e6 ? `${fmt(v / 1e6, 3)} M` : v >= 1e3 ? `${fmt(v / 1e3, 3)} k` : fmt(v, 3));
  const bytes = (n: number) => (n * 4 >= 1e9 ? `${fmt((n * 4) / 1e9, 3)} GB` : n * 4 >= 1e6 ? `${fmt((n * 4) / 1e6, 3)} MB` : `${fmt((n * 4) / 1e3, 3)} kB`);
  p.figure({
    title: 'Two ways to score a key: dot product and additive',
    codeTitle: 'scores.py',
    code: `
      q = np.array([{{q0:1}}, {{q1:0.5}}])    # one query
      # K: every key position in the plane
      e_dot = K @ q            # a plane  #@dot
      e_add = np.tanh(Wa @ q + K @ Ua.T + b) @ va   #@add

      # n queries, n keys, d = A = 512
      # n = {{n:1000}}
      E_dot = Q @ K.T      # one matmul  #@cdot
      H = np.tanh((Q @ Wa.T)[:, None, :]             #@cadd
                  + (K @ Ua.T)[None, :, :] + b)      #@cadd
      E_add = H @ va       # H: (n, n, A)  #@cadd
    `,
    setup(f) {
      let q: [number, number] = [1, 0.5];
      let net = bump();
      const rng = new Rng(21);
      const D: [number, number, number, number] = [-2, 2, -2, 2];
      const eAdd = (x: number, y: number) => {
        let s = 0;
        for (let a = 0; a < A; a++) s += net.va[a]! * Math.tanh(net.W[a]![0]! * q[0] + net.W[a]![1]! * q[1] + net.U[a]![0]! * x + net.U[a]![1]! * y + net.b[a]!);
        return s;
      };
      const eDot = (x: number, y: number) => q[0] * x + q[1] * y;
      let lay = { size: 1, xs: [0, 0], y0: 0 };
      const cv = f.canvas(640, 340, (ctx, w, hgt) => {
        const gap = 14;
        const size = Math.min((w - gap) / 2, 300);
        const xs = [(w - 2 * size - gap) / 2, (w - 2 * size - gap) / 2 + size + gap];
        const y0 = 24;
        lay = { size, xs, y0 };
        if (fitHeight(cv.canvas, w, hgt, y0 + size + 22)) return;
        const pos = rgbK('purple');
        const neg = rgbK('slate');
        const paper = color('--paper');
        [eDot, eAdd].forEach((fn, k) => {
          const x0 = xs[k]!;
          rbox(ctx, x0, y0, size, size, 6, paper, null);
          field(ctx, x0, y0, size, size, D, (x, y) => {
            const e = fn(x, y);
            const v = Math.max(-1, Math.min(1, e / 4));
            const c = v >= 0 ? pos : neg;
            const band = Math.abs(e - Math.round(e)) < 0.06 ? 60 : 0;
            return [c[0], c[1], c[2], Math.min(255, 25 + 200 * Math.abs(v) + band)];
          }, 3);
          ctx.strokeStyle = color('--rule');
          ctx.lineWidth = 1;
          ctx.strokeRect(x0, y0, size, size);
          const X = (v: number) => x0 + ((v - D[0]) / (D[1] - D[0])) * size;
          const Y = (v: number) => y0 + ((D[3] - v) / (D[3] - D[2])) * size;
          ctx.strokeStyle = withAlpha(color('--axis'), 0.6);
          ctx.beginPath();
          ctx.moveTo(X(0), y0);
          ctx.lineTo(X(0), y0 + size);
          ctx.moveTo(x0, Y(0));
          ctx.lineTo(x0 + size, Y(0));
          ctx.stroke();
          arrow(ctx, X(0), Y(0), X(q[0]), Y(q[1]), color('blue'), 2.5);
          ctx.beginPath();
          ctx.arc(X(q[0]), Y(q[1]), 6, 0, Math.PI * 2);
          ctx.fillStyle = color('blue');
          ctx.fill();
          text(ctx, k === 0 ? (size > 230 ? 'dot product: q·k' : 'dot product') : size > 230 ? 'additive: vᵀtanh(Wq + Uk + b)' : 'additive', x0 + size / 2, 11, { size: 11.5, weight: 600, color: color('--ink-2') });
          let lo = Infinity, hi = -Infinity;
          for (let i = 0; i <= 20; i++) for (let j = 0; j <= 20; j++) {
            const e = fn(-2 + i / 5, -2 + j / 5);
            lo = Math.min(lo, e);
            hi = Math.max(hi, e);
          }
          text(ctx, `scores from ${fmt(lo, 2)} to ${fmt(hi, 2)}`, x0 + size / 2, y0 + size + 11, { font: 'mono', size: 10.5, color: color('--ink-3') });
        });
      });
      const sync = () => {
        f.code.setMany({ q0: fmt(q[0], 2), q1: fmt(q[1], 2) });
        cv.redraw();
      };
      let drag = false;
      const move = (e: PointerEvent) => {
        const rc = cv.canvas.getBoundingClientRect();
        const px = e.clientX - rc.left, py = e.clientY - rc.top;
        const k = px > lay.xs[1]! - 7 ? 1 : 0;
        const x = D[0] + ((px - lay.xs[k]!) / lay.size) * (D[1] - D[0]);
        const y = D[3] - ((py - lay.y0) / lay.size) * (D[3] - D[2]);
        q = [Math.max(-2, Math.min(2, x)), Math.max(-2, Math.min(2, y))];
        sync();
      };
      cv.canvas.addEventListener('pointerdown', (e) => {
        drag = true;
        cv.canvas.setPointerCapture(e.pointerId);
        move(e);
      });
      cv.canvas.addEventListener('pointermove', (e) => drag && move(e));
      cv.canvas.addEventListener('pointerup', () => (drag = false));
      f.button('Bump weights', () => {
        net = bump();
        sync();
      });
      f.button('Random weights', () => {
        net = random(rng);
        sync();
      }, { icon: 'shuffle' });
      const dotRo = f.readout('dot: scores stored');
      const addRo = f.readout('additive: tanh entries');
      f.slider({
        label: 'n words',
        min: 1,
        max: 4,
        step: 0.01,
        value: 3,
        map: (r) => Math.round(10 ** r),
        format: (v) => String(v),
        slot: 'n',
        onInput: (n) => {
          dotRo.set(`${big(n * n)} (${bytes(n * n)})`);
          addRo.set(`${big(n * n * 512)} (${bytes(n * n * 512)})`);
          f.code.highlight(['cdot', 'cadd']);
        },
      });
      dotRo.set(`${big(1e6)} (${bytes(1e6)})`);
      addRo.set(`${big(512e6)} (${bytes(512e6)})`);
      f.code.highlight(['dot', 'add']);
      sync();
    },
    caption: `For one query $\\symq$ (drag it, in either panel), each panel colors every possible key position $\\symk$ by its score: purple high, gray low, thin bands at whole numbers. The dot-product score is a tilted plane: it rises without limit in the direction of $\\symq$, and a longer $\\symq$ tilts it more steeply. The additive score is a small neural network (here ${A} hidden units), so it can bend: with the **bump** weights it peaks on keys *near* the query; with **random** weights it makes some other bounded shape. Below, the cost of scoring $n$ queries against $n$ keys with vectors of 512 numbers. Both take about $n^2 \\times 512$ multiply-adds, but the dot product is one matrix multiply that stores only the $n \\times n$ scores, while the additive score first builds an $n \\times n \\times 512$ block of tanh inputs.`,
  });
}

/* ------------------------------------------------------------------ */
/* Chapter                                                              */
/* ------------------------------------------------------------------ */

const chapter: ChapterDef = {
  symbols: SEQ2SEQ_SYMBOLS,

  render(p) {
    p.prose(`
In 2014, a neural network learned to translate English into French with no linguistics built into it at all: one recurrent network reads the sentence, a second one writes the translation. Within months the design showed a crack, and the patch for that crack, **attention**, turned out to be the most important idea in this course. The [Transformer](#/transformer) in the next chapter, and every large language model after it, is built out of it.

This chapter tells that story with real models at toy scale. Four tiny translators were trained for this page; their weights (0.4 MB) load into your browser, and the figures run them live. You will watch a fixed-size memory fail on long sentences, watch attention fix it, and then strip attention down to what it really is: a dictionary lookup made soft enough to train with backprop. CS231n met the idea for images ([attention and spatial transformers](#/attention)); here it gets its general form, with **queries**, **keys** and **values**, the form the Transformer uses.`);
    p.callout('aside', `**The toy language.** A subject, a verb (*sees, chases, eats, likes, follows*) and one to ten objects joined by *and*, built from ten animals, six colors and the articles *the* and *a*: for example *the black cat sees a dog and the gray fox*. The French is real French, word for word, except that every color moves after its noun: *le chat noir voit un chien et le renard gris*. Sentences run from 5 to 40 words. All four models are built from GRUs (the gated RNN of the [CS231n RNN chapter](#/rnn)), have 15,000 to 48,000 parameters, and were trained with Adam for 30,000 steps of 64 sentences, spread evenly over every length from 5 to 40.`);

    /* ---------------------------------------------------------------- */
    p.h2('Encoder and decoder', 'encoder-decoder');
    p.prose(`
Translation is the *many to many* shape from the [RNN chapter](#/rnn): read a whole sequence, then write another, possibly of a different length and in a different order. Two papers in 2014 made it work: Sutskever, Vinyals and Le, with deep LSTMs, and Cho and colleagues, who introduced the GRU along the way. Their recipe is called **sequence to sequence**, or the **encoder-decoder**.

The **encoder** is an RNN that reads the source sentence one word at a time. Each word enters as its *embedding*, a learned vector with one row per vocabulary word ([Tokens and embeddings](#/tokenization) covers them). Nothing comes out of the encoder until the end, when its final state is handed over:`);
    p.math({
      label: 'The encoder',
      tex: String.raw`\symh_j = f\big(\symh_{j-1},\, \symx_j\big), \qquad \symc = \symh_S`,
      code: `
        h = np.zeros(H)
        for x in src:            # S words
            h = gru_enc(h, emb_src[x])
        c = h    # H numbers, whatever S is
      `,
      codeTitle: 'encoder.py',
      terms: [
        [String.raw`\symx_j`, 'source word number $j$, as its embedding vector'],
        [String.raw`\symh_j`, 'the encoder state after reading $j$ words: its running summary'],
        [String.raw`f`, 'one step of a recurrent cell (here a GRU), the same weights at every step'],
        [String.raw`\symc = \symh_S`, 'the last state, after all $S$ words: the **context vector**'],
      ],
      explain: 'This is the RNN loop from CS231n, unchanged. What is new is how it is used: only the very last state leaves the encoder. Whatever the decoder will ever know about the source sentence has to be in those $H$ numbers.',
    });
    p.prose(`The **decoder** is a second RNN, a language model for French that is *conditioned* on $\\symc$. It starts from $\\symc$, and at each step it takes the word it wrote last, updates its state $\\syms_t$, and produces a probability for every word in the French vocabulary:`);
    p.math({
      label: 'The decoder, and the probability of a translation',
      tex: String.raw`\begin{aligned} \syms_t &= g\big(\syms_{t-1},\, \symy_{t-1},\, \symc\big) \\ p(\symy_1, \dots, \symy_T \mid \symx) &= \prod_{t=1}^{T} p\big(\symy_t \mid \symy_{<t},\, \symc\big) \end{aligned}`,
      code: `
        s, y, out = c, BOS, []
        while y != EOS:
            inp = np.concatenate([emb_tgt[y], c])
            s = gru_dec(s, inp)
            z = W_out @ np.concatenate([s, c])
            p = softmax(z + b_out)
            y = p.argmax()       # greedy
            out.append(y)
      `,
      codeTitle: 'decoder.py',
      terms: [
        [String.raw`\syms_t`, 'the decoder state after writing $t$ words'],
        [String.raw`g(\syms_{t-1}, \symy_{t-1}, \symc)`, 'one GRU step, fed the previous word and the context. Cho et al. fed $\\symc$ at every step, as here; Sutskever et al. used it only as the starting state'],
        [String.raw`p(\symy_t \mid \symy_{<t}, \symc)`, 'the softmax over the French vocabulary: how likely each word is next, given the words so far ($y_{<t}$ means $y_1$ to $y_{t-1}$) and the context'],
        [String.raw`\prod_{t=1}^{T}`, 'multiply over all $T$ steps. $\\prod$ ("pi", for product) is to multiplying what $\\Sigma$ is to adding'],
      ],
      explain: 'The right half is the **chain rule of probability**: the chance of a whole sentence is the chance of its first word, times the chance of the second given the first, and so on. [Language models and pretraining](#/pretraining) builds on exactly this. Translation is language modeling with something to talk about. Two special tokens bracket the output: the decoder starts by reading `<bos>` (beginning of sentence) and stops when it writes `<eos>` (end of sentence), so it decides the length of the translation itself.',
    });
    figEncDec(p);
    p.prose(`
### Training: teacher forcing

Training uses pairs of sentences and the softmax cross-entropy loss of [linear classification](#/linear-classification), once per output word. While training, the decoder is fed the *correct* previous word rather than its own guess, a trick called **teacher forcing**: one mistake early in a sentence would otherwise derail every word after it, and the model would learn little from the rest.`);
    p.math({
      label: 'The loss, with teacher forcing',
      tex: String.raw`\mathcal{L} = -\sum_{t=1}^{T+1} \log p\big(\symy^{*}_t \mid \symy^{*}_{<t},\, \symx\big)`,
      code: `
        loss, s, y_prev = 0.0, c, BOS
        for y_true in tgt + [EOS]:
            inp = np.concatenate([emb_tgt[y_prev], c])
            s = gru_dec(s, inp)
            z = W_out @ np.concatenate([s, c])
            p = softmax(z + b_out)
            loss -= np.log(p[y_true])
            y_prev = y_true    # teacher forcing
      `,
      codeTitle: 'loss.py',
      terms: [
        [String.raw`\symy^{*}_t`, 'the reference translation\'s word $t$ (the last one is `<eos>`)'],
        [String.raw`-\log p(\cdot)`, 'cross-entropy: 0 when the model is certain of the right word, large when it gave it little probability'],
        [String.raw`\symy^{*}_{<t}`, 'teacher forcing: the condition is the *reference* words so far, not the model\'s own'],
        [String.raw`\sum_t`, 'add up over every word of the translation, plus the end token'],
      ],
      explain: 'The log turns the product of the previous card into a sum, which is easier to differentiate and does not underflow. Backpropagation runs from every word\'s loss back through the decoder, through $\\symc$ and into the encoder, so one loss trains both networks. The catch is that at test time the decoder is fed its own outputs, a situation it never saw in training (this mismatch is called *exposure bias*).',
    });
    p.callout('aside', `**Greedy decoding and beam search.** The figures here decode *greedily*: take the likeliest word, feed it back, repeat. Real translation systems use **beam search**, which keeps the $B$ most probable partial translations at every step instead of one, and finally returns the most probable complete one. It rescues sentences where the best first word was not the locally likeliest. Sutskever et al. found that a beam of 2 already gave most of the benefit. [Language models and pretraining](#/pretraining) covers the sampling methods used instead for open-ended text.`, 'Decoding');

    /* ---------------------------------------------------------------- */
    p.h2('The bottleneck', 'bottleneck');
    p.prose(`
Here is the crack. A five-word sentence and a forty-word sentence both reach the decoder as the same $H$ numbers. The encoder has to pack the whole sentence into $\\symc$ in a form the decoder can unpack in order, and the longer the sentence, the more must fit. Worse, an RNN's state is overwritten a little at every step, so the first words have been squeezed the most by the time the last one arrives (the [vanishing-gradient](#/rnn/gradients) problem, seen from the other side).

Cho, van Merriënboer, Bahdanau and Bengio measured this on real translation in 2014: quality fell steadily as sentences grew longer. Sutskever et al. found that their much larger network (four layers of 1,000 LSTM units) held up better than expected, helped by a trick: **reverse the source sentence**. Reading it backwards puts the first source words right next to the first words the decoder writes, which made training much easier. The average distance between matching words stays the same, though, so the trick shortens some paths without removing the bottleneck. Here is the bottleneck on our toy:`);
    figLength(p);
    p.callout('intuition', 'Imagine translating a long sentence that you are allowed to hear only once, after which you must write the whole translation from memory. The start comes out fine; by the end you are guessing. Human translators do not work that way: they glance back at the source before each phrase. That glance is the fix.');

    /* ---------------------------------------------------------------- */
    p.h2('Bahdanau attention', 'bahdanau');
    p.prose(`
Bahdanau, Cho and Bengio (*Neural Machine Translation by Jointly Learning to Align and Translate*, 2014, published at ICLR 2015) let the decoder look back. Keep **every** encoder state $\\symh_1, \\dots, \\symh_S$, not only the last. Before writing each word, the decoder scores every source position against its current state, turns the scores into weights with a softmax, and reads a fresh context $\\symc_t$: the weighted average of the encoder states. The paper called this learning to *align* and translate jointly: which source words a target word depends on is never given; it falls out of training.

Two design details matter. First, the encoder is **bidirectional**: one RNN reads left to right, a second reads right to left, and $\\symh_j$ joins their two states at word $j$, so each $\\symh_j$ describes its word *in context*, with what came before and what comes after (in the toy, 16 numbers from each direction). Second, the scores come from a small neural network, now called **additive attention**:`);
    p.math({
      label: 'Step 1: score every source word',
      tex: String.raw`\syme_{tj} = v_a^{\top} \tanh\big(W_a\, \syms_{t-1} + U_a\, \symh_j\big)`,
      code: `
        # s: (H,) decoder state before word t
        # hs: (S, H) encoder states, one row each
        e = np.tanh(Wa @ s + hs @ Ua.T) @ va
        # e: (S,) one score per source word
      `,
      codeTitle: 'additive_score.py',
      terms: [
        [String.raw`\syms_{t-1}`, 'the decoder state: what has been written so far, and so what is needed next'],
        [String.raw`\symh_j`, 'source word $j$, in context'],
        [String.raw`W_a \syms_{t-1} + U_a \symh_j`, 'project both into a shared space of $A$ numbers and add them (hence *additive*)'],
        [String.raw`\tanh`, 'squash each of the $A$ numbers into $-1$ to $1$: the hidden layer of a tiny network'],
        [String.raw`v_a^{\top}`, 'a learned vector that reads one number off that hidden layer (the $\\top$ just turns it into a row, so the product is a dot product)'],
        [String.raw`\syme_{tj}`, 'the score: how useful source word $j$ looks for writing target word $t$'],
      ],
      explain: 'A one-hidden-layer network that takes a pair (what I need, what this word offers) and returns one relevance number. $U_a \\symh_j$ does not depend on $t$, so it is computed once per sentence; only $W_a \\syms_{t-1}$ changes from step to step. The toy uses $A = 16$ and, like most implementations, adds a bias inside the tanh.',
    });
    p.math({
      label: 'Step 2: softmax the scores into weights',
      tex: String.raw`\symalpha_{tj} = \frac{\exp(\syme_{tj})}{\sum_{k=1}^{S} \exp(\syme_{tk})}`,
      code: `
        alpha = np.exp(e - e.max())
        alpha = alpha / alpha.sum()   # sums to 1
      `,
      terms: [
        [String.raw`\exp(\syme_{tj})`, '$e$ to the power of the score: always positive, and higher scores win by a lot'],
        [String.raw`\sum_{k=1}^{S}`, 'the same for every source word, added up'],
        [String.raw`\symalpha_{tj}`, "source word $j$'s share of the decoder's attention at step $t$"],
      ],
      explain: 'The same softmax as for class scores, applied across source positions instead of classes. The decoder now has a budget of attention, 100% in total, to spread over the source sentence. Subtracting the largest score first changes nothing mathematically and keeps $\\exp$ from overflowing.',
    });
    p.math({
      label: 'Step 3: read the weighted average, then take a decoder step',
      tex: String.raw`\begin{aligned} \symc_t &= \sum_{j=1}^{S} \symalpha_{tj}\, \symh_j \\ \syms_t &= g\big(\syms_{t-1},\, \symy_{t-1},\, \symc_t\big) \end{aligned}`,
      code: `
        c = alpha @ hs       # this step's context
        inp = np.concatenate([emb_tgt[y], c])
        s = gru_dec(s, inp)
        z = W_out @ np.concatenate([s, c])
        p = softmax(z + b_out)
      `,
      terms: [
        [String.raw`\symalpha_{tj}\,\symh_j`, "each encoder state, scaled by its weight"],
        [String.raw`\symc_t`, 'their sum: a weighted average, mostly made of the words with high weight'],
        [String.raw`g(\syms_{t-1}, \symy_{t-1}, \symc_t)`, 'the same decoder step as before, with one change: $\\symc$ has become $\\symc_t$'],
      ],
      explain: 'Compare with the plain decoder: one fixed context has become one context *per output word*, chosen by the decoder itself. The decoder\'s state no longer has to carry the source sentence; it only has to keep track of what it has written so far, and the source can be as long as it likes. The price: $S$ scores for every output word, so $S \\times T$ per sentence.',
    });
    figAlign(p);
    p.prose(`
The real paper shows the same pictures for English to French: mostly diagonal, bending where the languages order words differently. Its best-known example is *the European Economic Area* becoming *la zone économique européenne*, where the attention runs backwards across the three reordered words. And it shows the length curve you saw above: the fixed-vector baselines lost quality steadily as sentences grew longer, while the attention model held up on sentences of 50 words and more.`);
    p.callout('history', `Bahdanau et al. called the decoder an RNN that *searches* the source (their model was named RNNsearch). Luong, Pham and Manning (2015) simplified the recipe: compute the attention from the *current* decoder state rather than the previous one, and try simpler score functions (more on those below). In 2016, Google's production translation system (GNMT, Wu et al.) used exactly this structure scaled up: eight layers of LSTMs in the encoder and in the decoder, with attention between them.`, 'From the paper to production');

    /* ---------------------------------------------------------------- */
    p.h2('Attention is a soft dictionary lookup', 'lookup');
    p.prose(`
Now take the translation away and look at what one attention step does by itself. It takes one vector (the decoder state: *what I am looking for*), compares it against a collection of vectors (the encoder states), and returns a blend of them, weighted by how well each matched. That is a **lookup**, like reading from a Python dictionary, with three roles:

- the **query** $\\symq$: what you are looking for;
- the **keys** $\\symk_i$: what each entry is filed under, compared with the query;
- the **values** $\\symv_i$: what each entry holds, returned when its key matches.

A Python \`dict\` does a *hard* lookup with *exact* matching: \`d[q]\` returns the value whose key equals \`q\`, or fails. Attention relaxes both. Matching is graded (a score, not equal or not equal), and the answer is a blend of every value, weighted by the softmax of the scores. In Bahdanau's model the query is $\\syms_{t-1}$, and the keys and the values are both the encoder states $\\symh_j$. Nothing forces keys and values to be the same vectors, though: an entry can be *found* by one vector and *deliver* another. Key-value memory networks (Miller et al., 2016) separated them, and the Transformer computes the query, key and value as three separate learned projections ([next chapter](#/transformer)).`);
    p.math({
      label: 'Attention, in general',
      tex: String.raw`\begin{aligned} \operatorname{attend}(\symq) &= \sum_{i=1}^{n} \symalpha_i\, \symv_i \\ \symalpha_i &= \operatorname{softmax}_i\big(\operatorname{score}(\symq, \symk_i)\big) \end{aligned}`,
      code: `
        def attend(q, keys, values, score):
            e = np.array([score(q, k) for k in keys])
            alpha = softmax(e)
            return alpha @ values   # blend all

        def lookup_hard(q, keys, values, score):
            e = np.array([score(q, k) for k in keys])
            return values[e.argmax()]   # best only
      `,
      codeTitle: 'attend.py',
      terms: [
        [String.raw`\operatorname{attend}(\symq)`, 'the answer to query $\\symq$, given $n$ entries, each a key $\\symk_i$ and a value $\\symv_i$'],
        [String.raw`\operatorname{score}(\symq, \symk_i)`, 'how well key $i$ matches the query: additive, a dot product, or anything differentiable'],
        [String.raw`\symalpha`, 'the softmax of the $n$ scores: weights that are positive and sum to 1'],
        [String.raw`\sum_i \symalpha_i \symv_i`, 'the blend of the values: the soft answer'],
      ],
      explain: 'The whole of attention in two lines. Everything else (bidirectional encoders, decoders, heads, masks) is about where the queries, keys and values come from. A hard lookup would return $\\symv_{i^*}$ for the single best key $i^* = \\arg\\max_i \\operatorname{score}(\\symq, \\symk_i)$ (*argmax*: the index of the largest).',
    });
    figLookup(p);

    /* ---------------------------------------------------------------- */
    p.h2('Hard versus soft', 'hard-soft');
    p.prose(`
Why blend at all? A hard lookup reads one entry instead of all of them, and a trained model's weights are often nearly all on one word anyway (look at the alignment matrix). The trouble is learning. A hard lookup is a staircase: move the query a little and the same key still wins, so the output does not change at all; then, at a border, it jumps. Gradient descent needs to know which way is downhill, and a flat step says nothing. CS231n's hard attention for images had to be trained with reinforcement-learning estimators for exactly this reason ([attention](#/attention/hard-attention)).

A soft lookup is smooth everywhere, and its gradient is short enough to read:`);
    p.math({
      label: 'The gradient of a soft lookup',
      tex: String.raw`\frac{\partial \symc}{\partial \syme_i} = \symalpha_i\,\big(\symv_i - \symc\big)`,
      code: `
        alpha = softmax(e)
        c = alpha @ values      # (D,)
        dc_de = alpha[:, None] * (values - c)
        # dc_de[i] is dc/de_i, a vector like c
      `,
      codeTitle: 'soft_grad.py',
      terms: [
        [String.raw`\frac{\partial \symc}{\partial \syme_i}`, 'how the output moves when score $i$ is nudged up (a vector: one number per entry of $\\symc$)'],
        [String.raw`\symv_i - \symc`, 'from where the output is now, toward value $i$'],
        [String.raw`\symalpha_i`, 'scaled by how much weight key $i$ already has'],
      ],
      explain: 'Raising one key\'s score pulls the output toward that key\'s value, in proportion to its weight. (It follows from the softmax derivative $\\partial \\alpha_j / \\partial e_i = \\alpha_j(\\mathbf{1}[i{=}j] - \\alpha_i)$, a two-line exercise below.) It also says where learning stops: a key with weight near 0 gets no gradient (it is ignored completely), and when one key has weight near 1 the output already equals its value, so $\\symv_i - \\symc \\approx 0$. A softmax that is too sharp behaves like a hard lookup and stops learning. That is why the Transformer scales its scores down ([next chapter](#/transformer)).',
    });
    figStaircase(p);

    /* ---------------------------------------------------------------- */
    p.h2('Scoring: dot product versus additive', 'scores');
    p.prose(`
Bahdanau's score is a small network. Luong, Pham and Manning (2015) compared it with simpler, *multiplicative* scores, and in their translation experiments the simple ones did as well or better. The plain **dot product** has no parameters at all; the **general** form puts one learned matrix between query and key, which lets them live in different spaces or have different sizes:`);
    p.math({
      label: 'Three score functions, and all scores at once',
      tex: String.raw`\begin{aligned} \text{dot:}\;\; & \symq^{\top}\symk \\ \text{general:}\;\; & \symq^{\top} W\, \symk \\ \text{additive:}\;\; & v_a^{\top}\tanh(W_a\symq + U_a\symk) \\ \text{all scores:}\;\; & E = \sym{q}{Q}\, \sym{k}{K}^{\top} \end{aligned}`,
      code: `
        e_dot = keys @ q                # (n,)
        e_general = keys @ (W @ q)      # (n,)
        e_add = np.tanh(Wa @ q + keys @ Ua.T) @ va

        # all T queries, all n keys, at once:
        E = Q @ K.T        # (T, n): one matmul
        A = softmax(E, axis=1)   # rows sum to 1
        C = A @ V          # (T, D): T contexts
      `,
      codeTitle: 'scores.py',
      terms: [
        [String.raw`\symq^{\top}\symk`, 'the dot product: multiply matching entries and add. Large when the two point the same way (and are long)'],
        [String.raw`\symq^{\top} W \symk`, 'transform the key by a learned matrix first, then take the dot product'],
        [String.raw`v_a^{\top}\tanh(\cdot)`, "Bahdanau's additive score from above"],
        [String.raw`E = \sym{q}{Q}\sym{k}{K}^{\top}`, 'stack the queries as rows of $\\sym{q}{Q}$ and the keys as rows of $\\sym{k}{K}$: one matrix multiply gives every score at once, row $t$ for query $t$'],
      ],
      explain: 'The last line is the reason the dot product won. With all queries in $\\sym{q}{Q}$, the scores, the softmax and the weighted sums are three matrix operations, $\\operatorname{softmax}(\\sym{q}{Q}\\sym{k}{K}^{\\top})\\sym{v}{V}$, which is what GPUs do fastest. The toy\'s second attention model uses the general score, and its alignments look almost the same as the additive model\'s (switch it in the alignment figure).',
    });
    figScores(p);
    p.prose(`
Which is better is an empirical question with a nuanced answer. A dot product is *bilinear*: for a fixed query, the score is a linear function of the key, so the only preference it can express is "far in my direction". That is less of a limit than it sounds, because the vectors are learned: the network shapes its keys and queries so that dot products mean what it needs. (Even "near the query" is reachable: $-\\lVert \\symq - \\symk \\rVert^2 = 2\\,\\symq^{\\top}\\symk - \\lVert\\symk\\rVert^2 - \\lVert\\symq\\rVert^2$ is a dot product plus a per-key bias, and the $\\lVert\\symq\\rVert^2$ term is the same for every key, so the softmax ignores it.) Dot products do have one real weakness: a dot product adds up one product per dimension, so its typical size grows with the number of dimensions, and with hundreds of them the scores get large and the softmax saturates into a near-hard lookup with vanishing gradients. The Transformer fixes that with one division ([next chapter](#/transformer)).`);

    /* ---------------------------------------------------------------- */
    p.h2('What attention costs, and what is left', 'costs');
    p.table(
      ['', 'Fixed-vector encoder-decoder', 'With attention'],
      [
        ['What the decoder can read', 'one vector $\\symc$, $H$ numbers', 'every encoder state: $S \\times H$ numbers'],
        ['Work per output word', 'one decoder step', 'one decoder step plus $S$ scores'],
        ['Work per sentence pair', 'grows like $S + T$', 'grows like $S \\times T$'],
        ['Steps from source word $j$ to output word $t$', 'about $S - j + t$, through both recurrences', 'one: through $\\symalpha_{tj}$'],
        ['Steps that must run one after another', '$S + T$', 'still $S + T$: the RNNs are still there'],
      ],
      { caption: 'Attention trades a little compute for a direct path from every source word to every output word.' },
    );
    p.prose(`
Attention removed the bottleneck and gave every output word a one-step path back to every source word. It costs $S \\times T$ scores per sentence, which is nothing for sentences and becomes the central cost once sequences reach thousands of tokens (later chapters return to it: [FlashAttention](#/modern-transformer) and the [KV cache](#/inference)).

What attention did *not* remove is the recurrence. The encoder still reads one word at a time and the decoder writes one word at a time, and each step waits for the one before, so a GPU cannot spread a sentence's steps across its thousands of cores. Information between two source words still travels through every word in between. The 2017 answer was to let attention do the encoding too: every word of the sentence attends to every other word of the *same* sentence (**self-attention**), the recurrence is dropped entirely, and the whole sentence is processed in parallel. That is the [Transformer](#/transformer), the next chapter.`);
    p.callout('history', `Soft, content-based reading had several near-simultaneous origins. Graves (2013) generated handwriting with a soft window that slid along the text being written. Neural Turing Machines (Graves, Wayne and Danihelka, 2014) read from an external memory by content: compare a key with every memory row, softmax, take the weighted sum. Memory networks (Weston, Chopra and Bordes, 2014; end-to-end version by Sukhbaatar et al., 2015) did the same for question answering, and key-value memory networks (Miller et al., 2016) separated the key used to find an entry from the value it returns. Bahdanau et al. (2014) is the one that changed a field overnight, because translation was a benchmark everyone cared about.`, 'Where attention came from');

    /* ---------------------------------------------------------------- */
    p.h2('Build it yourself', 'exercises');
    p.prose(`
1. **One step of attention (NumPy, 10 minutes).** Make random \`hs\` of shape (6, 8) and a decoder state \`s\` of shape (8,). Write \`additive(s, hs, Wa, Ua, va)\` and \`dot(s, hs)\`, each returning the weights $\\symalpha$ and the context $\\symc$. Check that the weights are positive and sum to 1, and that every entry of $\\symc$ lies between the smallest and largest entry of that column of \`hs\` (a weighted average cannot leave the range). Then multiply \`s\` by 10. The dot-product weights go nearly one-hot. What happens to the additive weights, and why? (Hint: what does tanh do to very large inputs?)
2. **The softmax gradient, by hand and by numbers.** Derive $\\partial \\alpha_j / \\partial e_i = \\alpha_j(\\mathbf{1}[i{=}j] - \\alpha_i)$ from the softmax formula, then $\\partial \\symc / \\partial e_i = \\alpha_i(\\symv_i - \\symc)$. Verify both with finite differences (nudge one score by $10^{-5}$, see how $\\symc$ moves). Then multiply all the scores by $\\beta$ from 0.1 to 100 and plot the size of the gradient of $\\symc$ with respect to the original, unscaled scores: it should rise, peak and collapse, which is the staircase figure in numbers.
3. **Vectorize the decoder's attention.** Under teacher forcing every decoder state is known in advance. Given \`S_dec\` of shape (T, H) and \`hs\` of shape (S, H), compute all $T \\times S$ dot-product weights and all $T$ contexts with three lines and no loop: \`E = S_dec @ hs.T\`, a row-wise softmax, \`C = A @ hs\`. Time it against a Python loop for $T = S = 500$. This is the core of the next chapter.
4. **Project: the bottleneck, reproduced.** In PyTorch, train a GRU encoder-decoder with and without attention on a toy task: this chapter's animal sentences (the grammar is described at the top), or simply reversing random strings of digits of length 5 to 40. Use the same decoder size for both. Success looks like this chapter's length figure: the fixed-vector model is perfect on short inputs and collapses past some length that grows with its hidden size, while the attention model stays near 100%. Plot one alignment matrix: for string reversal it should be an anti-diagonal.
5. **Stretch: does attention generalize to longer inputs?** Train both models only on lengths up to 20 and test on 21 to 40. Report what happens and look at the alignment matrices of the failures. (There is no single right answer: how far attention models extrapolate depends on how they track position, a question that comes back with positional encodings in the [Transformer](#/transformer).)`);

    p.callout('idea', `A plain encoder-decoder squeezes the source sentence into one context vector $\\symc$, and quality falls off a cliff once sentences outgrow it; a bigger vector only moves the cliff. **Attention** keeps every encoder state and, for each output word, scores them all against the decoder state, softmaxes the scores into weights $\\symalpha$, and reads their weighted average $\\symc_t$. Stripped down, that is a **soft dictionary lookup**: a query $\\symq$ is scored against keys $\\symk_i$, and the answer is a blend of values $\\symv_i$. Blending, rather than picking the best match, is what makes it differentiable, with gradient $\\alpha_i(\\symv_i - \\symc)$ for each score. Bahdanau scored with a small network (additive); the dot product does as well and turns every score into one matrix multiply, $\\operatorname{softmax}(\\sym{q}{Q}\\sym{k}{K}^\\top)\\sym{v}{V}$, which is where the Transformer begins.`, 'Takeaways');
  },
};

export default chapter;

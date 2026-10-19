import type { ChapterDef } from './index';
import type { Page } from '../core/page';
import { fmt } from '../core/code';
import { color, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { CharRNN, loadPretrained, vocab } from '../lib/rnn-charrnn';
import { CORPUS } from '../lib/rnn-corpus';
import { arrow, esc, glyph, rbox, signedFill, text } from '../lib/rnn-draw';
import { RNN_SYMBOLS } from '../lib/rnn-symbols';
import { secCaptioning, secGradients, secLstm, secMinChar, secSummary, secWhatItLearns } from '../lib/rnn-sections';

const VOC = vocab(CORPUS);

/* ------------------------------------------------------------------ */
/* Fig: five shapes of a sequence problem                               */
/* ------------------------------------------------------------------ */

function figShapes(p: Page): void {
  type Shape = { label: string; n: number; ins: string[]; outs: string[]; fb: boolean; ex: string; lines: (t: number, n: number) => string[] };
  const S: Record<string, Shape> = {
    one: {
      label: 'one to one', n: 1, ins: ['image'], outs: ['"cat"'], fb: false,
      ex: '**One to one.** No sequence at all: a fixed-size input in, a fixed-size output out. Image classification, and every network in the course so far.',
      lines: () => ['one'],
    },
    cap: {
      label: 'one to many', n: 4, ins: ['image', '', '', ''], outs: ['a', 'cat', 'on', 'grass'], fb: true,
      ex: '**One to many.** One input, a sequence out. *Image captioning*: one image in, a sentence out, one word per step. The dashed arrows feed each word back in as the next input.',
      lines: (t) => (t === 0 ? ['cap0', 'cap1'] : ['cap2', 'cap1']),
    },
    sent: {
      label: 'many to one', n: 4, ins: ['so', 'much', 'fun', '!'], outs: ['', '', '', 'happy'], fb: false,
      ex: '**Many to one.** A sequence in, one answer out. *Sentiment classification*: read a whole review word by word, then say whether it is positive or negative.',
      lines: (t, n) => (t === n - 1 ? ['sent0', 'sent1'] : ['sent0']),
    },
    mt: {
      label: 'many to many', n: 6, ins: ['the', 'black', 'cat', '', '', ''], outs: ['', '', '', 'le', 'chat', 'noir'], fb: true,
      ex: '**Many to many.** Read a whole sequence, then write another one. *Machine translation*: read the English sentence, then produce the French one, which can have a different length and word order.',
      lines: (t) => (t < 3 ? ['mt0'] : ['mt1']),
    },
    vid: {
      label: 'synced', n: 4, ins: ['frame', 'frame', 'frame', 'frame'], outs: ['walk', 'walk', 'jump', 'land'], fb: false,
      ex: '**Many to many, in step.** One output for every input. *Video classification at the frame level*: label each frame, using memory of the frames before it.',
      lines: () => ['vid'],
    },
  };
  let mode = 'cap';
  let cur = 0;
  p.figure({
    title: 'Five shapes of a sequence problem',
    codeTitle: 'shapes.py',
    code: `
      # step(h, x): one RNN update.  out(h): a prediction read from h.

      # one to one: a plain network, no time at all
      y = out(step(zeros, x))                 #@one

      # one to many: caption an image
      h = step(zeros, image)                  #@cap0
      for t in range(T):
          if t > 0:
              h = step(h, y[t-1])  # last word in   #@cap2
          y[t] = out(h)                       #@cap1

      # many to one: the sentiment of a sentence
      h = zeros
      for x in words:
          h = step(h, x)                      #@sent0
      y = out(h)                              #@sent1

      # many to many: translate (read it all, then write)
      for x in source_words:
          h = step(h, x)                      #@mt0
      for t in range(T_out):
          h = step(h, y[t-1] if t else START) #@mt1
          y[t] = out(h)                       #@mt1

      # many to many, synced: label every video frame
      for t, x in enumerate(frames):
          h = step(h, x)                      #@vid
          y[t] = out(h)                       #@vid
    `,
    setup(f) {
      const cv = f.canvas(640, 300, (ctx, w, h) => {
        const sh = S[mode]!;
        const n = sh.n;
        const colW = Math.min(96, (w - 16) / n);
        const x0 = (w - colW * n) / 2;
        const bw = Math.min(46, colW * 0.6);
        const bh = Math.min(42, h * 0.16);
        const rowY = [h * 0.13, h * 0.4, h * 0.67];
        const kinds = [color('purple'), color('green'), color('orange')];
        const names = ['y', 'h', 'x'];
        const fs = Math.max(11, Math.min(13, colW * 0.2));
        const dim = withAlpha(color('--ink-3'), 0.8);
        const lit = color('--accent');
        const box = (cx: number, y: number, k: number, now: boolean) => {
          rbox(ctx, cx - bw / 2, y, bw, bh, 7, withAlpha(kinds[k]!, now ? 0.35 : 0.14), kinds[k]!, now ? 2.5 : 1.2);
          text(ctx, names[k]!, cx, y + bh / 2 + 1, { font: 'serif', italic: true, weight: 600, size: Math.max(14, bh * 0.42), color: kinds[k]! });
        };
        for (let c = 0; c < n; c++) {
          const cx = x0 + colW * (c + 0.5);
          const now = c === cur;
          ctx.globalAlpha = c > cur ? 0.22 : 1;
          if (c > 0) arrow(ctx, cx - colW + bw / 2 + 2, rowY[1]! + bh / 2, cx - bw / 2 - 2, rowY[1]! + bh / 2, now ? lit : dim, now ? 2.5 : 1.4);
          if (sh.ins[c]) {
            box(cx, rowY[2]!, 2, now);
            arrow(ctx, cx, rowY[2]! - 1, cx, rowY[1]! + bh + 2, now ? lit : dim, now ? 2.5 : 1.4);
            text(ctx, sh.ins[c]!, cx, rowY[2]! + bh + 12, { size: fs, color: color('--ink-2') });
          }
          box(cx, rowY[1]!, 1, now);
          if (sh.outs[c]) {
            box(cx, rowY[0]!, 0, now);
            arrow(ctx, cx, rowY[1]! - 1, cx, rowY[0]! + bh + 2, now ? lit : dim, now ? 2.5 : 1.4);
            text(ctx, sh.outs[c]!, cx, rowY[0]! - 11, { size: fs, weight: 600, color: color('--ink') });
          }
          if (sh.fb && c > 0 && sh.outs[c - 1] && !sh.ins[c]) {
            const px = cx - colW + bw / 2;
            ctx.strokeStyle = now ? lit : dim;
            ctx.lineWidth = now ? 2 : 1.2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(px, rowY[0]! + bh * 0.5);
            ctx.quadraticCurveTo(cx - bw * 0.2, rowY[0]! + bh * 0.6, cx - bw * 0.25, rowY[1]! - 2);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        }
        ctx.globalAlpha = 1;
      });
      cv.canvas.classList.add('scroll-ok');
      const stepper = f.stepper({
        steps: S[mode]!.n,
        interval: 900,
        label: (k) => `time step ${k + 1} / ${S[mode]!.n}`,
        onStep: (k) => {
          cur = k;
          f.code.highlight(S[mode]!.lines(k, S[mode]!.n));
          cv.redraw();
        },
      });
      f.segmented({
        options: Object.entries(S).map(([value, s]) => ({ value, label: s.label })),
        value: mode,
        onChange: (v) => {
          mode = v;
          f.status(S[mode]!.ex);
          stepper.setSteps(S[mode]!.n);
          stepper.go(0);
        },
      });
      f.status(S[mode]!.ex);
    },
    caption: `Each column is one time step: input $\\symx$ at the bottom, hidden state $\\symh$ in the middle, output $\\symy$ on top. The arrows between hidden states carry memory forward, and every column uses the *same* weights. Pick a shape and step through time; the code lights the line that runs at that step.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: "hello", unrolled, one step at a time                           */
/* ------------------------------------------------------------------ */

function figHello(p: Page): void {
  const V = ['h', 'e', 'l', 'o'];
  const inputs = [0, 1, 2, 2];
  const targets = [1, 2, 2, 3];
  interface Run { hs: number[][]; ys: number[][]; ps: number[][]; losses: number[] }
  const run = (trained: boolean): Run => {
    const net = new CharRNN(4, 3, 2);
    for (const a of [net.Wxh, net.Whh, net.Why]) for (let i = 0; i < a.length; i++) a[i]! *= 50;
    if (trained) {
      for (let it = 0; it < 300; it++) {
        net.lossFun(inputs, targets, new Float64Array(3));
        net.update(0.1);
      }
    }
    const out: Run = { hs: [], ys: [], ps: [], losses: [] };
    let h = new Float64Array(3);
    for (let t = 0; t < 4; t++) {
      const nh = new Float64Array(3);
      net.stepHidden(inputs[t]!, h, nh);
      h = nh;
      const y = new Float64Array(4);
      const pr = new Float64Array(4);
      net.scores(h, y);
      net.probs(h, pr);
      out.hs.push([...h]);
      out.ys.push([...y]);
      out.ps.push([...pr]);
      out.losses.push(-Math.log(pr[targets[t]!]!));
    }
    return out;
  };
  const runs = { random: run(false), trained: run(true) };
  let which: 'random' | 'trained' = 'random';
  let cur = 0;
  const NS = 17;
  const at = (k: number) => (k >= 16 ? { t: 3, s: 4 } : { t: Math.floor(k / 4), s: k % 4 });

  p.figure({
    title: 'A character model learns "hello", one time step at a time',
    codeTitle: 'hello_forward.py',
    code: `
      vocab = ['h', 'e', 'l', 'o']
      inputs  = [0, 1, 2, 2]          # h e l l
      targets = [1, 2, 2, 3]          # e l l o
      xs, hs, ys, ps = {}, {}, {}, {}
      hs[-1] = np.zeros((3, 1))       # memory starts empty
      loss = 0
      for t in range(4):              # t = {{t:0}}
          xs[t] = np.zeros((4, 1))                              #@x
          xs[t][inputs[t]] = 1        # one-hot input           #@x
          hs[t] = np.tanh(np.dot(Wxh, xs[t])
                          + np.dot(Whh, hs[t-1]) + bh)          #@h
          ys[t] = np.dot(Why, hs[t]) + by   # 4 scores          #@y
          ps[t] = np.exp(ys[t]) / np.sum(np.exp(ys[t]))         #@p
          loss += -np.log(ps[t][targets[t], 0])                 #@loss
      # hs[t] = [{{h:…}}]
      # ps[t][target] = {{pt:…}}    loss = {{loss:0}}
    `,
    setup(f) {
      const cv = f.canvas(640, 660, (ctx, w, h) => {
        const R = runs[which];
        const st = at(cur);
        const labelW = Math.max(60, Math.min(92, w * 0.16));
        const colW = (w - labelW) / 4;
        const u = h / 19;
        const ch = u * 0.95;
        const cw = Math.min(colW * 0.72, 74);
        const fs = Math.max(11, Math.min(13.5, ch * 0.58));
        const yOut = u * 2.7;
        const yHid = yOut + 4 * ch + u * 2.0;
        const yIn = yHid + 3 * ch + u * 2.0;
        const yLet = yIn + 4 * ch + u * 0.95;
        const ink3 = color('--ink-3');
        const dim = withAlpha(ink3, 0.75);
        const lit = color('--accent');
        const O = color('orange'), G = color('green'), P = color('purple'), Gd = color('gold');
        const cell = (cx: number, y: number, s: string, fill: string | null, stroke: string, lw = 1, empty = false) => {
          if (empty) {
            ctx.setLineDash([3, 3]);
            rbox(ctx, cx - cw / 2, y + 1.5, cw, ch - 3, 5, null, withAlpha(ink3, 0.45), 1);
            ctx.setLineDash([]);
            return;
          }
          rbox(ctx, cx - cw / 2, y + 1.5, cw, ch - 3, 5, fill, stroke, lw);
          text(ctx, s, cx, y + ch / 2 + 0.5, { font: 'mono', size: fs, color: color('--ink') });
        };
        // group labels and letter labels
        const group = (sym: string, word: string, y0: number, rows: number, col: string) => {
          const mid = y0 + (rows * ch) / 2;
          text(ctx, sym, 4, mid - 8, { font: 'serif', italic: true, weight: 600, size: 17, color: col, align: 'left' });
          text(ctx, word, 4, mid + 10, { size: 11, color: color('--ink-3'), align: 'left' });
        };
        group('y', 'scores', yOut, 4, P);
        group('h', 'hidden', yHid, 3, G);
        group('x', 'input', yIn, 4, O);
        for (let k = 0; k < 4; k++) {
          text(ctx, V[k]!, labelW - 7, yOut + k * ch + ch / 2, { font: 'mono', size: 12, color: color('--ink-2'), align: 'right' });
          text(ctx, V[k]!, labelW - 7, yIn + k * ch + ch / 2, { font: 'mono', size: 12, color: color('--ink-2'), align: 'right' });
        }
        text(ctx, 'target', 4, u * 0.75, { size: 11, color: color('--ink-3'), align: 'left' });
        text(ctx, 'p(target)', 4, u * 1.75, { size: 11, color: color('--ink-3'), align: 'left' });
        for (let c = 0; c < 4; c++) {
          const cx = labelW + colW * (c + 0.5);
          const stage = c < st.t ? 4 : c === st.t ? st.s : -1;
          const now = c === st.t && st.s < 4;
          // recurrence arrow from previous column
          if (c > 0) {
            const on = now && st.s === 1;
            const a0 = cx - colW + cw / 2 + 2, a1 = cx - cw / 2 - 2, ay = yHid + 1.5 * ch;
            arrow(ctx, a0, ay, a1, ay, on ? lit : dim, on ? 2.6 : 1.3);
            if (c === 2) text(ctx, 'Whh', (a0 + a1) / 2, yHid - u * 0.55, { font: 'mono', size: 11, color: color('blue') });
          }
          // Wxh arrow
          {
            const on = now && st.s === 1;
            arrow(ctx, cx, yIn - 2, cx, yHid + 3 * ch + 2, on ? lit : dim, on ? 2.6 : 1.3);
            if (c === 0) text(ctx, 'Wxh', cx + 5, (yIn + yHid + 3 * ch) / 2, { font: 'mono', size: 11, color: color('blue'), align: 'left' });
          }
          // Why arrow
          {
            const on = now && st.s === 2;
            arrow(ctx, cx, yHid - 2, cx, yOut + 4 * ch + 2, on ? lit : dim, on ? 2.6 : 1.3);
            if (c === 0) text(ctx, 'Why', cx + 5, (yHid + yOut + 4 * ch) / 2, { font: 'mono', size: 11, color: color('blue'), align: 'left' });
          }
          // input one-hot
          for (let k = 0; k < 4; k++) {
            const one = inputs[c] === k;
            cell(cx, yIn + k * ch, one ? '1' : '0', withAlpha(O, one ? 0.55 : 0.06), withAlpha(O, one ? 1 : 0.4), now && st.s === 0 && one ? 2.5 : 1, stage < 0);
          }
          text(ctx, V[inputs[c]!]!, cx, yLet, { font: 'serif', italic: true, weight: 600, size: 16, color: stage < 0 ? withAlpha(O, 0.35) : O });
          // hidden
          for (let k = 0; k < 3; k++) {
            const v = R.hs[c]![k]!;
            cell(cx, yHid + k * ch, fmt(v, 2), signedFill(v), withAlpha(G, 0.8), now && st.s === 1 ? 2.2 : 1, stage < 1);
          }
          // output scores (tinted by probability once the softmax has run)
          for (let k = 0; k < 4; k++) {
            const isT = targets[c] === k;
            const pk = R.ps[c]![k]!;
            const fill = stage >= 3 ? withAlpha(P, 0.06 + 0.6 * pk) : withAlpha(P, 0.1);
            const stroke = stage >= 3 && isT ? Gd : withAlpha(P, 0.6);
            cell(cx, yOut + k * ch, fmt(R.ys[c]![k]!, 2), fill, stroke, stage >= 3 && isT ? 2.6 : 1, stage < 2);
          }
          if (stage >= 3) {
            const pt = R.ps[c]![targets[c]!]!;
            text(ctx, V[targets[c]!]!, cx, u * 0.75, { font: 'serif', italic: true, weight: 700, size: 16, color: Gd });
            text(ctx, pt.toFixed(2), cx, u * 1.75, { font: 'mono', size: 12, weight: now ? 700 : 400, color: pt > 0.5 ? color('green') : color('red') });
          }
        }
      });
      cv.canvas.classList.add('scroll-ok');
      const lossRo = f.readout('loss so far', { sym: 'L' });
      const narr = (k: number): string => {
        const R = runs[which];
        const { t, s } = at(k);
        const inL = V[inputs[t]!]!, tgL = V[targets[t]!]!;
        if (s === 4) {
          const tot = R.losses.reduce((a, b) => a + b, 0);
          return which === 'random'
            ? `Done: total loss **${tot.toFixed(2)}** (guessing would give 4 × 1.39 = 5.55). Random weights predict poorly. Switch to **trained** and step again.`
            : `Done: total loss **${tot.toFixed(2)}**. Steps 3 and 4 both read an *l*, yet the model predicts *l* after the first and *o* after the second: the hidden state remembers how many *l*s it has seen.`;
        }
        if (s === 0) return `**t = ${t}.** Read the letter *${inL}* as a one-hot vector: a 1 in its slot, 0 elsewhere.`;
        if (s === 1) return t === 0
          ? `New memory: \`tanh(Wxh·x + Whh·h + bh)\`. The old memory is all zeros at the first step.`
          : `New memory: mix the input (\`Wxh\`) with the previous hidden state (\`Whh\`), add the bias, squash with tanh.`;
        if (s === 2) return `Scores for the next letter: \`Why\` reads one score per vocabulary letter off the memory.`;
        const pt = R.ps[t]![targets[t]!]!;
        return `Softmax turns scores into probabilities (shading). The next letter really is *${tgL}*, which got probability ${pt.toFixed(2)}, so the loss grows by −log ${pt.toFixed(2)} = ${(-Math.log(pt)).toFixed(2)}.`;
      };
      const sync = () => {
        const R = runs[which];
        const { t, s } = at(cur);
        const done = R.losses.slice(0, s >= 3 ? t + 1 : t).reduce((a, b) => a + b, 0);
        f.code.highlight(s === 4 ? null : (['x', 'h', 'y', ['p', 'loss']] as const)[s] as string | string[]);
        f.code.setMany({
          t,
          h: s >= 1 ? R.hs[t]!.map((v) => fmt(v, 2)).join(', ') : '…',
          pt: s >= 3 ? fmt(R.ps[t]![targets[t]!]!, 3) : '…',
          loss: fmt(done, 3),
        });
        lossRo.set(fmt(done, 3));
        f.status(narr(cur));
        cv.redraw();
      };
      f.stepper({
        steps: NS,
        interval: 1100,
        label: (k) => (k >= 16 ? 'done' : `t = ${at(k).t}, ${['input', 'hidden', 'scores', 'loss'][at(k).s]}`),
        onStep: (k) => {
          cur = k;
          sync();
        },
      });
      f.segmented({
        label: 'weights',
        options: [
          { value: 'random', label: 'random' },
          { value: 'trained', label: 'trained' },
        ],
        value: which,
        onChange: (v) => {
          which = v;
          sync();
        },
      });
    },
    caption: `Bottom to top, each column is one time step: a one-hot input letter, a 3-number hidden state, 4 output scores, and the probability given to the true next letter (gold outline; green above 0.5, red below). Step through and watch the lit arrows: \`Wxh\` and \`Whh\` feed the new memory, \`Why\` reads scores from it. With **random** weights the guesses are poor; the **trained** weights come from 300 Adagrad steps on this one word, run in your browser when the page loaded.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: temperature                                                     */
/* ------------------------------------------------------------------ */

function figTemperature(p: Page): void {
  const contexts = [
    { value: 'First Citiz', label: '"First Citiz"' },
    { value: 'the ', label: '"the "' },
    { value: 'All:\n', label: '"All:⏎"' },
  ];
  p.figure({
    title: 'Temperature: how boldly to read the probabilities',
    codeTitle: 'sample.py',
    code: `
      def sample(h, seed_ix, n, temperature={{T:1.0}}):
          x = np.zeros((vocab_size, 1))
          x[seed_ix] = 1
          ixes = []
          for t in range(n):
              h = np.tanh(np.dot(Wxh, x) + np.dot(Whh, h) + bh)  #@h
              y = np.dot(Why, h) + by                            #@y
              z = y / temperature                                #@p
              p = np.exp(z) / np.sum(np.exp(z))                  #@p
              ix = np.random.choice(range(vocab_size), p=p.ravel())  #@pick
              x = np.zeros((vocab_size, 1))                      #@feed
              x[ix] = 1                  # feed the sample back in   #@feed
              ixes.append(ix)
          return ixes
    `,
    setup(f) {
      let net: CharRNN | null = null;
      let ctxStr = 'the ';
      let temp = 1;
      let probs = new Float64Array(VOC.chars.length);
      let shown = '';
      let full = '';
      let seed = 11;
      const pl = f.canvas(640, 400, (ctx, w, h) => {
        if (!net) return;
        const order = [...probs].map((v, k) => [v, k] as const).sort((a, b) => b[0] - a[0]).slice(0, 10);
        const top = 22;
        const rowH = (h - top - 6) / 10;
        const lw = 46;
        const bwMax = w - lw - 64;
        text(ctx, `next character after "${ctxStr.replace('\n', '⏎')}"`, 4, 10, { size: 12, color: color('--ink-2'), align: 'left' });
        order.forEach(([v, k], r) => {
          const y = top + r * rowH;
          text(ctx, glyph(VOC.chars[k]!), lw - 12, y + rowH / 2, { font: 'mono', size: 13, weight: 600, color: color('--ink'), align: 'right' });
          rbox(ctx, lw, y + rowH * 0.15, Math.max(2, bwMax * v), rowH * 0.7, 4, withAlpha(color('teal'), 0.25 + 0.6 * Math.sqrt(v)), null);
          text(ctx, `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`, lw + Math.max(2, bwMax * v) + 6, y + rowH / 2, { font: 'mono', size: 11.5, color: color('--ink-2'), align: 'left' });
        });
      });
      pl.canvas.classList.add('scroll-ok');
      const out = document.createElement('div');
      out.className = 'rnn-sample';
      Object.assign(out.style, {
        fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace",
        fontSize: '12.5px', lineHeight: '1.45', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        background: 'var(--paper)', border: '1px solid var(--rule)', borderRadius: '10px',
        padding: '10px 12px', minHeight: '7.6em', color: 'var(--ink)',
      });
      f.viz.append(out);
      const render = () => {
        const prefix = `<span style="color:var(--ink-3)">${esc(ctxStr)}</span>`;
        out.innerHTML = prefix + esc(shown);
      };
      const recompute = () => {
        if (!net) return;
        const ixs = [...ctxStr].map((c) => VOC.ix.get(c)!);
        const hs = net.hiddenStates(ixs);
        net.probs(hs[hs.length - 1]!, probs, temp);
        pl.redraw();
      };
      const resample = () => {
        if (!net) return;
        const ixs = [...ctxStr].map((c) => VOC.ix.get(c)!);
        const h0 = ixs.length > 1 ? net.hiddenStates(ixs.slice(0, -1)).pop()! : new Float64Array(net.H);
        full = net.sample(h0, ixs[ixs.length - 1]!, 160, new Rng(seed), temp).map((k) => VOC.chars[k]).join('');
        shown = '';
        typing.start();
      };
      let phase = 0;
      const typing = f.loop(() => {
        if (shown.length >= full.length) {
          f.code.highlight(null);
          return false;
        }
        shown = full.slice(0, shown.length + 3);
        f.code.highlight((['h', 'y', 'p', 'pick', 'feed'] as const)[phase++ % 5]);
        render();
      });
      f.slider({
        label: 'temperature T',
        sym: 'T',
        min: -1.2,
        max: 0.7,
        step: 0.01,
        value: 0,
        map: (r) => Math.round(Math.pow(Math.E, r) * 100) / 100,
        format: (v) => v.toFixed(2),
        slot: 'T',
        onInput: (v) => {
          temp = v;
          recompute();
          resample();
        },
      });
      f.segmented({
        label: 'context',
        options: contexts,
        value: ctxStr,
        onChange: (v) => {
          ctxStr = v;
          recompute();
          resample();
        },
      });
      f.button('Sample again', () => {
        seed++;
        resample();
      }, { primary: true });
      f.status('Loading the trained model…');
      loadPretrained()
        .then((m) => {
          net = m;
          f.status('');
          recompute();
          resample();
        })
        .catch((e) => f.status(`Could not load the model: ${(e as Error).message}`));
    },
    caption: `The bars are a trained character model's top ten guesses for the next character after the context (the model is the one you will train yourself below, trained a little longer: 30,000 steps on the opening of *Coriolanus*). The text box is a 160-character sample, each character drawn from these probabilities and fed back in. Slide $\\symT$ down to 0.3 and the samples turn safe and repetitive; push it up to 2 and spelling falls apart. After "First Citiz" the model is so sure of *e* that even a high temperature rarely changes its mind.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: truncated BPTT                                                  */
/* ------------------------------------------------------------------ */

function figTruncated(p: Page): void {
  const L = 8;
  const chunks = 4;
  const txt = CORPUS.slice(0, L * chunks + 1);
  p.figure({
    title: 'Truncated backpropagation through time',
    codeTitle: 'truncated_bptt.py',
    code: `
      seq_length = 8                # 25 in min-char-rnn
      p, hprev = 0, np.zeros((hidden_size, 1))
      while p + seq_length + 1 < len(data):
          chunk = data[p:p+seq_length]                          #@chunk
          inputs = [char_to_ix[ch] for ch in chunk]             #@chunk
          targets = [char_to_ix[ch]
                     for ch in data[p+1:p+seq_length+1]]        #@chunk
          # forward from hprev, backward to the chunk's start
          loss, *grads, hprev = lossFun(inputs, targets, hprev) #@fwd,bwd
          adagrad_update(params, grads)                         #@upd
          p += seq_length   # hprev carries on; its gradient does not  #@carry
      # chunk {{k:0}}: "{{chunk:…}}"
    `,
    setup(f) {
      let cur = 0;
      const cv = f.canvas(640, 430, (ctx, w, h) => {
        const k = Math.floor(cur / 3);
        const s = cur % 3;
        const padL = 8;
        const colW = (w - padL * 2) / L;
        const rowH = h / chunks;
        const r = Math.min(colW * 0.24, rowH * 0.14);
        const G = color('green'), O = color('orange'), Tl = color('teal'), lit = color('--accent');
        const dim = withAlpha(color('--ink-3'), 0.5);
        for (let row = 0; row < chunks; row++) {
          const y0 = row * rowH;
          const hy = y0 + rowH * 0.36;
          const cy = y0 + rowH * 0.72;
          const active = row === k;
          const past = row < k || (row === k && s === 2);
          if (active) rbox(ctx, 2, y0 + 3, w - 4, rowH - 6, 10, withAlpha(lit, 0.06), withAlpha(lit, 0.5), 1.2);
          for (let c = 0; c < L; c++) {
            const cx = padL + colW * (c + 0.5);
            const ch = txt[row * L + c]!;
            rbox(ctx, cx - colW * 0.36, cy - rowH * 0.13, colW * 0.72, rowH * 0.26, 5, withAlpha(O, active ? 0.18 : 0.07), withAlpha(O, active ? 0.8 : 0.35), 1);
            text(ctx, glyph(ch), cx, cy + 1, { font: 'mono', size: Math.max(11, Math.min(15, rowH * 0.16)), weight: 600, color: color('--ink') });
            ctx.beginPath();
            ctx.arc(cx, hy, r, 0, Math.PI * 2);
            const seen = row < k || (row === k);
            ctx.fillStyle = withAlpha(G, seen ? (active ? 0.45 : 0.25) : 0.06);
            ctx.fill();
            ctx.strokeStyle = withAlpha(G, seen ? 0.9 : 0.35);
            ctx.lineWidth = 1.2;
            ctx.stroke();
            arrow(ctx, cx, cy - rowH * 0.13 - 1, cx, hy + r + 2, active ? withAlpha(O, 0.8) : dim, 1, undefined, 5);
            if (c < L - 1) {
              const nx = padL + colW * (c + 1.5);
              const fwdOn = active && s === 0;
              arrow(ctx, cx + r + 2, hy - (active && s === 1 ? 4 : 0), nx - r - 2, hy - (active && s === 1 ? 4 : 0), fwdOn ? G : seen ? withAlpha(G, 0.6) : dim, fwdOn ? 2.4 : 1.2, undefined, 6);
              if (active && s === 1) arrow(ctx, nx - r - 2, hy + 5, cx + r + 2, hy + 5, Tl, 2.4, undefined, 6);
            }
          }
          // carried hidden state into the next row
          if (row < chunks - 1) {
            const xa = padL + colW * (L - 0.5);
            const xb = padL + colW * 0.5;
            const yb = (row + 1) * rowH + rowH * 0.36;
            const on = row === k && s === 2;
            ctx.strokeStyle = on ? lit : past ? withAlpha(G, 0.55) : dim;
            ctx.lineWidth = on ? 2.4 : 1.2;
            ctx.setLineDash([5, 4]);
            const yg = (row + 1) * rowH + rowH * 0.05;
            const xr = w - 5, xl = 5, rad = 8;
            ctx.beginPath();
            ctx.moveTo(xa + r, hy);
            ctx.arcTo(xr, hy, xr, yg, rad);
            ctx.arcTo(xr, yg, xl, yg, rad);
            ctx.arcTo(xl, yg, xl, yb, rad);
            ctx.arcTo(xl, yb, xb, yb, rad);
            ctx.lineTo(xb - r - 6, yb);
            ctx.stroke();
            ctx.setLineDash([]);
            arrow(ctx, xb - r - 7, yb, xb - r - 1, yb, ctx.strokeStyle as string, ctx.lineWidth, undefined, 6);
          }
          if (active && s === 1) {
            // the backward pass stops at the chunk boundary
            const bx = padL + 3;
            ctx.strokeStyle = color('red');
            ctx.lineWidth = 2.2;
            ctx.beginPath();
            ctx.moveTo(bx - 5, hy - 5);
            ctx.lineTo(bx + 5, hy + 5);
            ctx.moveTo(bx + 5, hy - 5);
            ctx.lineTo(bx - 5, hy + 5);
            ctx.stroke();
          }
        }
      });
      cv.canvas.classList.add('scroll-ok');
      const narr = [
        'Forward through the chunk, starting from the hidden state the last chunk ended with (zeros for the first chunk).',
        'Backward through *this chunk only*. The gradient stops at the chunk boundary (red cross): earlier chunks are never revisited.',
        'Update the weights. The final hidden state is carried into the next chunk (dashed arrow) as a plain number, with no gradient attached.',
      ];
      f.stepper({
        steps: chunks * 3,
        interval: 1100,
        label: (i) => `chunk ${Math.floor(i / 3) + 1}: ${['forward', 'backward', 'update + carry'][i % 3]}`,
        onStep: (i) => {
          cur = i;
          const k = Math.floor(i / 3);
          f.code.highlight((['fwd', 'bwd', ['upd', 'carry']] as const)[i % 3] as string | string[]);
          f.code.setMany({ k, chunk: txt.slice(k * L, k * L + L).replace(/\n/g, '\\n') });
          f.status(narr[i % 3]!);
          cv.redraw();
        },
      });
    },
    caption: `The opening of the training text, cut into chunks of 8 characters (one row each; ⏎ is a newline, ␣ a space). Green circles are hidden states, wired left to right. Step through: each chunk runs **forward** (green), then **backward** (teal) only as far as its own first character, then updates the weights and hands its last hidden state to the next row. Memory crosses the boundary; gradient does not.`,
  });
}

/* ------------------------------------------------------------------ */
/* Chapter                                                              */
/* ------------------------------------------------------------------ */

const chapter: ChapterDef = {
  symbols: RNN_SYMBOLS,

  render(p) {
    p.prose(`
Every network so far has had a fixed shape: one image in, one set of class scores out. That covers a lot, but much of the world arrives as a **sequence**: the words of a sentence, the frames of a video, the characters of a program. A sentence can be four words long or forty. To handle that, a network needs something it has not had until now: **memory**.

A **recurrent neural network** (RNN) gets memory with one small trick. It reads a sequence one element at a time, and at each step it combines the new element with a summary of everything it has read so far, its **hidden state**. Then it hands the updated summary to itself for the next step. The same small set of weights is reused at every step, so one network can read a sequence of any length.

This chapter follows Lecture 10 of the 2016 course, taught by Andrej Karpathy, whose blog post *The Unreasonable Effectiveness of Recurrent Neural Networks* (2015) and 112-line \`min-char-rnn\` script made these models famous. You will train that exact model in your browser and watch it learn to write fake Shakespeare, see why the simple version struggles to remember for long, meet the LSTM that fixes it, and then point the whole machine at images and have it write captions.`);

    p.h2('Sequences in, sequences out', 'sequences');
    p.prose(`
An RNN separates the *shape* of a problem from the network that solves it. Draw each time step as a column: an input at the bottom, the hidden state in the middle, an output on top. Arrows between the hidden states carry memory forward. By choosing which columns get an input and which produce an output, the same machinery covers very different problems.`);
    figShapes(p);
    p.prose(`
There is also a sneakier use: processing a *fixed-size* input or output **sequentially**. Ba, Mnih and Kavukcuoglu (2015) read house numbers by steering a small glimpse around the image, step by step, and DRAW (Gregor et al. 2015) generates images of digits by painting onto a canvas over many steps. The task has a fixed size; the RNN simply chooses to work on it in pieces.`);

    p.h2('The recurrence', 'recurrence');
    p.prose(`At the heart of every RNN is one update rule, applied at every time step $t$:`);
    p.math({
      label: 'The recurrence',
      tex: String.raw`\symh_t = f_W\big(\symh_{t-1},\, \symx_t\big)`,
      code: `
        h = np.zeros(hidden_size)     # memory starts empty
        for x in sequence:
            h = f(h, x, W)            # same f, same W, every step
      `,
      terms: [
        [String.raw`\symh_t`, 'the new hidden state: a vector (a list of numbers) summarizing everything up to step $t$'],
        [String.raw`\symh_{t-1}`, 'the hidden state from the step before: the memory so far'],
        [String.raw`\symx_t`, 'the input at step $t$: a word, a character, a video frame'],
        [String.raw`f_W`, 'a function with weights $W$. Crucially, the *same* function with the *same* weights at every step'],
      ],
      explain: 'This is a loop with a state variable, the kind of code you have written a thousand times. `h` works like an accumulator: each pass folds one more input into it. What makes it a *neural* network is that `f` is a small layer with learned weights, so the network itself learns what is worth remembering.',
    });
    p.prose(`The simplest choice of $f$ is one fully connected layer followed by a tanh. This is the **vanilla RNN**:`);
    p.math({
      label: 'The vanilla RNN',
      tex: String.raw`\begin{aligned}\symh_t &= \tanh\big(\symWhh\,\symh_{t-1} + \symWxh\,\symx_t\big)\\ \symy_t &= \symWhy\,\symh_t\end{aligned}`,
      code: `
        def rnn_step(h, x):
            h = np.tanh(np.dot(Whh, h) + np.dot(Wxh, x) + bh)
            y = np.dot(Why, h) + by    # output scores
            return h, y
      `,
      codeTitle: 'rnn_step.py',
      terms: [
        [String.raw`\symWhh\,\symh_{t-1}`, 'the old memory, mixed by a matrix multiply: each new hidden number is a weighted sum of all the old ones'],
        [String.raw`\symWxh\,\symx_t`, 'the new input, mixed in by its own weight matrix'],
        [String.raw`\tanh`, 'squashes each number into the range $-1$ to $1$, so the memory stays bounded'],
        [String.raw`\symh_t`, 'the new memory'],
        [String.raw`\symWhy\,\symh_t`, 'a third matrix reads output scores off the memory'],
      ],
      explain: 'Three weight matrices and nothing else (plus biases, which the equation leaves out and the code keeps). `Whh` is the interesting one: it decides how the previous memory turns into the new one. It is shared across every time step, which is exactly what lets one small network read a sentence of any length and, as we will see, exactly what makes it hard to train.',
    });
    p.callout('math', `**tanh** (the hyperbolic tangent) is an S-shaped curve. It maps any number into the range $-1$ to $1$: it passes through 0 at 0, rises steeply there, and flattens out far from it. Chapter 7 met it as an activation function. Its **slope** (how fast it rises) is 1 at the center and close to 0 in the flat parts, and that slope works out to $1 - \\tanh^2$. Remember the flat parts: they come back in the section on vanishing gradients.`, 'Math help: tanh');
    p.prose(`
### Unrolling

To see an RNN as an ordinary computational graph (Chapter 6), **unroll** the loop: draw one copy of the step for each element of the sequence, wired head to tail, as in the figure above. The result is a deep feedforward network with one layer per time step and one twist: every layer shares the same weights. The forward pass through it is plain. So is the backward pass: it is backpropagation through this deep graph, and because each weight matrix is used at every step, its gradient is the *sum* of the gradients from every copy.`);

    p.h2('A character-level language model', 'char-model');
    p.prose(`
Here is the example that makes it concrete. We want a model of text: given the characters so far, predict the next one. Train it on a body of text and it learns the statistics of that text at every scale it can manage: which letters follow which, how words are spelled, where lines break.

Shrink the world to a four-letter vocabulary, *h*, *e*, *l*, *o*, and one training word, *hello*. Each letter goes in as a **one-hot** vector: four numbers, all 0 except a 1 in that letter's slot (*e* is $[0, 1, 0, 0]$). At each step the RNN outputs four scores, one per letter, for what comes *next*. The targets are the input shifted by one: after *h* we want *e*, after *e* we want *l*, after the first *l* we want *l*, and after the second *l* we want *o*.

Look closely at those last two. The input is *l* both times, but the right answer differs. A network that only saw the current letter could never get both right. The hidden state is what lets the RNN tell the first *l* from the second: it remembers what came before.

Each step is a small classification problem (which of the four letters comes next?), graded by the softmax loss from Chapter 4. The loss for the whole sequence adds up the steps:`);
    p.math({
      label: 'Softmax loss, summed over time',
      tex: String.raw`\symL = \sum_{t} -\log \symp_t[\text{target}_t], \qquad \symp_t = \operatorname{softmax}(\symy_t)`,
      code: `
        loss = 0
        for t in range(len(inputs)):
            ps[t] = np.exp(ys[t]) / np.sum(np.exp(ys[t]))  # softmax
            loss += -np.log(ps[t][targets[t], 0])          # cross-entropy
      `,
      terms: [
        [String.raw`\symp_t`, "step $t$'s scores turned into probabilities (positive, adding up to 1) by the softmax"],
        [String.raw`\symp_t[\text{target}_t]`, 'pick out the probability given to the letter that actually came next'],
        [String.raw`-\log`, 'the loss of one step: 0 if that probability is 1, large if it is small'],
        [String.raw`\sum_t`, 'add up over every time step'],
      ],
      explain: 'Exactly the softmax classifier of Chapter 4, once per time step. A model that guesses uniformly among 4 letters pays $-\\log(1/4) \\approx 1.39$ per step; a perfect model pays 0.',
    });
    figHello(p);

    p.h2('Sampling: letting the model write', 'sampling');
    p.prose(`
Once trained, the model can **generate**. Give it a first character. It outputs a probability for every possible next character; draw one at random according to those probabilities (that is, *sample* one), print it, and feed it back in as the next input. Repeat as long as you like. Every character it writes becomes context for the next.

Sampling, rather than always taking the single most likely character, matters: always taking the top choice tends to fall into loops. A dial called **temperature** controls how adventurous the draws are, by dividing the scores before the softmax:`);
    p.math({
      label: 'Softmax with temperature',
      tex: String.raw`\symp_k = \frac{e^{\symy_k/\symT}}{\sum_j e^{\symy_j/\symT}}`,
      code: `
        def softmax_t(y, temperature=1.0):
            z = y / temperature
            e = np.exp(z - np.max(z))
            return e / e.sum()

        ix = np.random.choice(vocab_size, p=softmax_t(y, 0.5))
      `,
      terms: [
        [String.raw`\symy_k/\symT`, 'every score divided by the same number $T$'],
        [String.raw`\symT < 1`, 'gaps between scores grow, so the favorite becomes even more likely: cautious, repetitive text'],
        [String.raw`\symT > 1`, 'gaps shrink and the probabilities even out: adventurous text, then nonsense'],
        [String.raw`\symT = 1`, "the model's own probabilities"],
      ],
      explain: 'Dividing by a small number stretches the scores apart, and the exponential turns a stretched lead into a near-certain win. Dividing by a large number squeezes them together until every character is about equally likely. The model itself does not change at all: only how boldly we read it.',
    });
    figTemperature(p);

    p.h2('Backpropagation through time', 'bptt');
    p.prose(`
Training follows the usual recipe: forward pass, loss, backward pass, update. Because the unrolled RNN is an ordinary graph, backprop works unchanged; here it goes by the grand name **backpropagation through time** (BPTT). Run forward through the sequence adding up the losses, then backward through the sequence, accumulating each shared weight's gradient from every time step.

The one new piece is how the gradient reaches a hidden state. The hidden state $\\symh_t$ influenced the loss along two paths: through its own output $\\symy_t$, and through the next hidden state $\\symh_{t+1}$. Its gradient is the sum of the two:`);
    p.math({
      label: 'One step of backprop through time',
      tex: String.raw`\frac{\partial \symL}{\partial \symh_t} = \underbrace{\symWhy^{\!\top} \frac{\partial \symL}{\partial \symy_t}}_{\text{own output}} \;+\; \underbrace{\symWhh^{\!\top}\Big[\big(1-\symh_{t+1}^2\big)\odot\frac{\partial \symL}{\partial \symh_{t+1}}\Big]}_{\text{via the next step}}`,
      code: `
        dhnext = np.zeros_like(hs[0])
        for t in reversed(range(len(inputs))):
            dy = np.copy(ps[t])
            dy[targets[t]] -= 1               # softmax gradient
            dh = np.dot(Why.T, dy) + dhnext   # both paths into h[t]
            dhraw = (1 - hs[t] * hs[t]) * dh  # back through tanh
            dWhh += np.dot(dhraw, hs[t-1].T)  # summed over all t
            dhnext = np.dot(Whh.T, dhraw)     # pass to step t-1
      `,
      codeTitle: 'bptt.py',
      terms: [
        [String.raw`\frac{\partial \symL}{\partial \symh_t}`, 'how much the loss would change if $h_t$ were nudged: the gradient arriving at the hidden state (`dh`)'],
        [String.raw`\symWhy^{\!\top}\frac{\partial \symL}{\partial \symy_t}`, "the path through step $t$'s own output: the score gradient (`dy`, probabilities minus the one-hot target) pushed back through `Why`"],
        [String.raw`1-\symh_{t+1}^2`, 'the slope of tanh at step $t+1$'],
        [String.raw`\odot`, 'multiply element by element'],
        [String.raw`\symWhh^{\!\top}[\,\cdots]`, 'the path through the next hidden state: `dhnext` in the code'],
      ],
      explain: 'The backward pass is a loop running from the last time step to the first, carrying one vector, `dhnext`, from each step to the one before. On every pass it gets multiplied by tanh\'s slope and by `Whh.T`. Keep that sentence in mind: multiplying by the same matrix over and over is the whole story of the vanishing gradient section below.',
    });
    p.callout('math', `A **partial derivative** like $\\partial L / \\partial h_t$ answers one question: if I nudged this one quantity by a tiny amount and held everything else still, how much would the loss move? There is one such number for every entry of $h_t$, so the gradient is a vector the same shape as $h_t$. The little $\\top$ (*transpose*) flips a matrix over its diagonal; it is how gradients flow backward through a matrix multiply (Chapter 6).`, 'Math help: gradients and transposes');
    p.prose(`
### Truncated BPTT

Running forward and backward through an entire book for every single weight update would be slow and would need memory for every hidden state in the book. The fix is **truncated** BPTT: cut the text into chunks (25 characters in min-char-rnn) and run forward and backward through one chunk at a time. The trick is to *carry the hidden state forward* from one chunk to the next, so the model still reads continuous text, while *not* backpropagating past the start of the chunk.`);
    figTruncated(p);
    p.prose(`The price: the model never gets a direct learning signal about dependencies longer than a chunk. It can still end up using longer memory, but nothing in the gradient asks it to.`);

    secMinChar(p);
    secWhatItLearns(p);
    secCaptioning(p);
    secGradients(p);
    secLstm(p);
    secSummary(p);
  },
};

export default chapter;

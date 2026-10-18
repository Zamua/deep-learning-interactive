import type { Page } from '../core/page';
import { fmt } from '../core/code';
import { drawCifar, loadCifar, type CifarSet } from '../core/data';
import { color, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { CharRNN, loadPretrained, vocab } from './rnn-charrnn';
import { CORPUS } from './rnn-corpus';
import { arrow, esc, glyph, rbox, sigmoid, signedFill, text } from './rnn-draw';

const VOC = vocab(CORPUS);
const DATA = [...CORPUS].map((c) => VOC.ix.get(c)!);

/** A monospace text panel for samples, styled like the course's canvases. */
function textPanel(minH = '7em'): HTMLDivElement {
  const el = document.createElement('div');
  Object.assign(el.style, {
    fontFamily: "'JetBrains Mono Variable', ui-monospace, monospace",
    fontSize: '12.5px', lineHeight: '1.45', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
    background: 'var(--paper)', border: '1px solid var(--rule)', borderRadius: '10px',
    padding: '10px 12px', minHeight: minH, color: 'var(--ink)',
  });
  return el;
}

/* ------------------------------------------------------------------ */
/* min-char-rnn                                                         */
/* ------------------------------------------------------------------ */

export function secMinChar(p: Page): void {
  p.h2('min-char-rnn: the whole thing in 112 lines', 'min-char-rnn');
  p.prose(`
Karpathy published the complete character model as a single BSD-licensed NumPy file of about 112 lines, \`min-char-rnn.py\`: data loading, the forward and backward pass, gradient clipping, Adagrad updates and sampling, with no framework at all. It rewards slow reading. Here it is in four pieces, lightly modernized to Python 3 (the original uses Python 2's \`xrange\` and \`print\` statement); the main loop is the live figure after them.

### 1. Data and parameters

The vocabulary is just the set of distinct characters in the file. Each character gets an integer index, and the model is three weight matrices and two bias vectors, initialized small and random.`);
  p.code(`
    import numpy as np

    data = open('input.txt', 'r').read()     # any plain text file
    chars = list(set(data))
    data_size, vocab_size = len(data), len(chars)
    char_to_ix = {ch: i for i, ch in enumerate(chars)}
    ix_to_char = {i: ch for i, ch in enumerate(chars)}

    hidden_size = 100     # size of the hidden state
    seq_length = 25       # steps to unroll the RNN for
    learning_rate = 1e-1

    Wxh = np.random.randn(hidden_size, vocab_size) * 0.01   # input to hidden
    Whh = np.random.randn(hidden_size, hidden_size) * 0.01  # hidden to hidden
    Why = np.random.randn(vocab_size, hidden_size) * 0.01   # hidden to output
    bh = np.zeros((hidden_size, 1))                         # hidden bias
    by = np.zeros((vocab_size, 1))                          # output bias
  `, { title: 'min_char_rnn.py: data and parameters' });
  p.prose(`
### 2. The forward pass

\`lossFun\` takes a chunk of 25 input indices, the 25 targets (the same text shifted by one) and the hidden state left over from the previous chunk. Its forward half is the "hello" figure with bigger matrices. The dictionaries keep every time step's values, because the backward pass needs them.`);
  p.code(`
    def lossFun(inputs, targets, hprev):
        xs, hs, ys, ps = {}, {}, {}, {}
        hs[-1] = np.copy(hprev)
        loss = 0
        for t in range(len(inputs)):
            xs[t] = np.zeros((vocab_size, 1))    # one-hot input
            xs[t][inputs[t]] = 1
            hs[t] = np.tanh(np.dot(Wxh, xs[t]) + np.dot(Whh, hs[t-1]) + bh)
            ys[t] = np.dot(Why, hs[t]) + by      # scores for the next char
            ps[t] = np.exp(ys[t]) / np.sum(np.exp(ys[t]))   # probabilities
            loss += -np.log(ps[t][targets[t], 0])           # softmax loss
  `, { title: 'min_char_rnn.py: lossFun, forward' });
  p.prose(`
### 3. The backward pass

Still inside \`lossFun\`: walk the time steps in reverse, applying the chain rule to each line of the forward pass. \`dy\` is the softmax gradient (probabilities minus the one-hot target, as in Chapter 4). \`dhnext\` is the gradient flowing into the previous time step's hidden state. Every weight's gradient is *accumulated* with \`+=\` because every time step used the same weights. The last loop clips each gradient entry into the range $[-5, 5]$.`);
  p.code(`
        dWxh, dWhh = np.zeros_like(Wxh), np.zeros_like(Whh)
        dWhy = np.zeros_like(Why)
        dbh, dby = np.zeros_like(bh), np.zeros_like(by)
        dhnext = np.zeros_like(hs[0])
        for t in reversed(range(len(inputs))):
            dy = np.copy(ps[t])
            dy[targets[t]] -= 1               # gradient on the scores
            dWhy += np.dot(dy, hs[t].T)
            dby += dy
            dh = np.dot(Why.T, dy) + dhnext   # backprop into h
            dhraw = (1 - hs[t] * hs[t]) * dh  # backprop through tanh
            dbh += dhraw
            dWxh += np.dot(dhraw, xs[t].T)
            dWhh += np.dot(dhraw, hs[t-1].T)
            dhnext = np.dot(Whh.T, dhraw)
        for dparam in [dWxh, dWhh, dWhy, dbh, dby]:
            np.clip(dparam, -5, 5, out=dparam)   # tame exploding gradients
        return loss, dWxh, dWhh, dWhy, dbh, dby, hs[len(inputs)-1]
  `, { title: 'min_char_rnn.py: lossFun, backward' });
  p.prose(`
### 4. Sampling

The generator from the temperature figure, at temperature 1: run the recurrence on its own output.`);
  p.code(`
    def sample(h, seed_ix, n):
        x = np.zeros((vocab_size, 1))
        x[seed_ix] = 1
        ixes = []
        for t in range(n):
            h = np.tanh(np.dot(Wxh, x) + np.dot(Whh, h) + bh)
            y = np.dot(Why, h) + by
            p = np.exp(y) / np.sum(np.exp(y))
            ix = np.random.choice(range(vocab_size), p=p.ravel())
            x = np.zeros((vocab_size, 1))
            x[ix] = 1
            ixes.append(ix)
        return ixes
  `, { title: 'min_char_rnn.py: sample' });
  p.prose(`
### 5. The main loop, live

The loop sweeps through the text in chunks of 25, carrying \`hprev\` from chunk to chunk and starting over at the end of the file. Every 100 iterations it prints a sample. The update is **Adagrad** (Chapter 9): \`mem\` keeps a running sum of each parameter's squared gradients, and each step is divided by its square root, so parameters with consistently large gradients take smaller steps. \`smooth_loss\` is a moving average of the chunk loss, only for printing; it starts at $-\\log(1/V) \\times 25$, the loss of uniform guessing over 25 characters.

Below, the same algorithm runs in your browser, written in TypeScript line for line, on the opening 3,307 characters of Shakespeare's *Coriolanus* (the start of the tiny-shakespeare file Karpathy used for char-rnn).`);
  figCharTrainer(p);
}

function figCharTrainer(p: Page): void {
  const H = 64;
  const SEQ = 25;
  const NMAX = 8000;
  const MILESTONES = new Set([0, 100, 300, 600, 1000, 2000, 3000, 5000, 8000]);
  p.figure({
    title: 'min-char-rnn, training in your browser',
    codeTitle: 'min_char_rnn.py: main loop',
    code: `
      hidden_size, seq_length = 64, 25     # the gist uses 100, 25
      n, p = 0, 0
      mems = [np.zeros_like(w) for w in params]   # Adagrad memory
      smooth_loss = -np.log(1.0 / vocab_size) * seq_length
      while n <= ${NMAX}:
          if p + seq_length + 1 >= len(data) or n == 0:
              hprev = np.zeros((hidden_size, 1))   # reset memory  #@reset
              p = 0                                # back to start #@reset
          inputs = [char_to_ix[ch] for ch in data[p:p+seq_length]]       #@batch
          targets = [char_to_ix[ch] for ch in data[p+1:p+seq_length+1]]  #@batch
          if n % 100 == 0:
              sample_ix = sample(hprev, inputs[0], 200)                  #@sample
          loss, *grads, hprev = lossFun(inputs, targets, hprev)          #@loss
          smooth_loss = smooth_loss * 0.999 + loss * 0.001               #@loss
          for dparam in grads:
              np.clip(dparam, -5, 5, out=dparam)   # in lossFun          #@clip
          for param, dparam, mem in zip(params, grads, mems):
              mem += dparam * dparam                                     #@ada
              param += -learning_rate * dparam / np.sqrt(mem + 1e-8)     #@ada
          p += seq_length
          n += 1
      # n = {{n:0}}   p = {{p:0}}   smooth_loss = {{sl:98.8}}
    `,
    setup(f) {
      const V = VOC.chars.length;
      const net = new CharRNN(V, H, 7);
      let n = 0;
      let pos = 0;
      let hprev: Float64Array = new Float64Array(H);
      let smooth = -Math.log(1 / V) * SEQ;
      let temp = 1;
      let lastPt: number[] = [];
      let chunk = { inputs: DATA.slice(0, SEQ), targets: DATA.slice(1, SEQ + 1) };
      const curve: [number, number][] = [[0, smooth]];
      const rng = new Rng(3);
      const strip = f.canvas(640, 150, (ctx, w, h) => {
        const lab = 30;
        const cw = (w - lab - 4) / SEQ;
        const rh = (h - 34) / 2 - 2;
        text(ctx, `position ${pos} of ${DATA.length}`, 0, 8, { size: 11, color: color('--ink-3'), align: 'left' });
        rbox(ctx, lab, 18, w - lab - 4, 7, 3.5, withAlpha(color('--ink-3'), 0.15), null);
        rbox(ctx, lab + ((w - lab - 4) * pos) / DATA.length, 16, Math.max(3, ((w - lab - 4) * SEQ) / DATA.length), 11, 3, color('--accent'), null);
        const rows = [
          { y: 34, ixs: chunk.inputs, name: 'in', col: color('orange') },
          { y: 34 + rh + 4, ixs: chunk.targets, name: 'next', col: color('gold') },
        ];
        for (const r of rows) {
          text(ctx, r.name, 0, r.y + rh / 2, { size: 11, color: color('--ink-3'), align: 'left' });
          r.ixs.forEach((ix, k) => {
            const x = lab + k * cw;
            let fill = withAlpha(r.col, 0.1);
            if (r.name === 'next' && lastPt.length === SEQ) {
              const pt = lastPt[k]!;
              fill = pt > 0.5 ? withAlpha(color('green'), 0.15 + 0.5 * pt) : withAlpha(color('red'), 0.12 + 0.45 * (1 - pt));
            }
            rbox(ctx, x + 0.5, r.y, cw - 1, rh, 3, fill, null);
            text(ctx, glyph(VOC.chars[ix]!), x + cw / 2, r.y + rh / 2 + 0.5, { font: 'mono', size: Math.max(11, Math.min(14, cw * 0.75)), weight: 500, color: color('--ink') });
          });
        }
      });
      strip.canvas.classList.add('scroll-ok');
      const plot = f.plot({
        height: 120,
        square: false,
        domain: [0, NMAX, 0, 105],
        draw: (pl) => {
          pl.axes({ grid: 2000 });
          for (const v of [25, 50, 75, 100]) pl.text(String(v), 60, v - 1.5, { size: 10.5, mono: true, color: color('--ink-3') });
          const xs = curve.map((c) => c[0]);
          const ys = curve.map((c) => c[1]);
          if (xs.length > 1) pl.path(xs, ys, color('red'), 2);
          pl.ctx.fillStyle = color('red');
          pl.ctx.font = '11px system-ui, sans-serif';
          pl.ctx.textAlign = 'right';
          pl.ctx.fillText('smooth_loss', pl.w - 8, 15);
        },
      });
      plot.canvas.classList.add('scroll-ok');
      const latest = textPanel('8.6em');
      const history = textPanel('4em');
      history.style.maxHeight = '13em';
      history.style.overflowY = 'auto';
      history.style.fontSize = '11.5px';
      f.viz.append(latest, history);
      const iterRo = f.readout('iteration');
      const lossRo = f.readout('smooth loss', { sym: 'L' });
      const entries: string[] = [];
      const doSample = (h: Float64Array, seedIx: number) => {
        const s = net.sample(h, seedIx, 200, rng, temp).map((k) => VOC.chars[k]).join('');
        latest.innerHTML = `<span style="color:var(--ink-3)">sample at iteration ${n.toLocaleString()}, T = ${temp.toFixed(2)}</span>\n${esc(s)}`;
        if (MILESTONES.has(n)) {
          entries.unshift(`<span style="color:var(--accent);font-weight:600">iter ${n.toLocaleString()} · loss ${smooth.toFixed(1)}</span>\n${esc(s.slice(0, 110))}`);
          history.innerHTML = `<span style="color:var(--ink-3)">milestones (newest first)</span>\n${entries.join('\n\n')}`;
        }
      };
      const syncRo = () => {
        iterRo.set(n.toLocaleString());
        lossRo.set(smooth.toFixed(2));
        f.code.setMany({ n, p: pos, sl: smooth.toFixed(2) });
      };
      const iterate = (): string => {
        let tag = 'batch';
        if (pos + SEQ + 1 >= DATA.length || n === 0) {
          hprev = new Float64Array(H);
          pos = 0;
          tag = 'reset';
        }
        chunk = { inputs: DATA.slice(pos, pos + SEQ), targets: DATA.slice(pos + 1, pos + SEQ + 1) };
        if (n % 100 === 0) {
          doSample(hprev, chunk.inputs[0]!);
          tag = 'sample';
        }
        const { loss, h } = net.lossFun(chunk.inputs, chunk.targets, hprev);
        lastPt = [...net.lastPt];
        hprev = h;
        smooth = smooth * 0.999 + loss * 0.001;
        net.update(0.1, 5);
        pos += SEQ;
        n++;
        if (n % 20 === 0) curve.push([n, smooth]);
        return tag;
      };
      let phase = 0;
      const loop = f.loop(() => {
        const t0 = performance.now();
        let special: string | null = null;
        let k = 0;
        do {
          const tag = iterate();
          if (tag !== 'batch') special = tag;
          k++;
        } while (performance.now() - t0 < 7 && k < 30 && n <= NMAX);
        f.code.highlight(special ?? ['batch', 'loss', 'clip', 'ada'][phase++ % 4]!);
        syncRo();
        strip.redraw();
        plot.redraw();
        if (n > NMAX) {
          stop();
          f.status(`Done: ${NMAX.toLocaleString()} iterations, about ${Math.round((NMAX * SEQ) / DATA.length)} passes over the text. Press **Reset** to watch it learn again.`);
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
        else if (n <= NMAX) {
          loop.start();
          btn.textContent = 'Pause';
          f.status('');
        }
      }, { primary: true });
      f.button('Reset', () => {
        stop();
        net.reset(Math.floor(Math.random() * 1e6));
        n = 0;
        pos = 0;
        hprev = new Float64Array(H);
        smooth = -Math.log(1 / V) * SEQ;
        curve.length = 0;
        curve.push([0, smooth]);
        lastPt = [];
        entries.length = 0;
        history.innerHTML = '';
        chunk = { inputs: DATA.slice(0, SEQ), targets: DATA.slice(1, SEQ + 1) };
        doSample(hprev, chunk.inputs[0]!);
        syncRo();
        strip.redraw();
        plot.redraw();
        f.status('');
      });
      f.slider({
        label: 'sample temperature',
        sym: 'T',
        min: 0.2,
        max: 1.5,
        step: 0.05,
        value: 1,
        format: (v) => v.toFixed(2),
        onInput: (v) => {
          temp = v;
          if (!loop.running()) doSample(hprev, chunk.inputs[0]!);
        },
      });
      doSample(hprev, chunk.inputs[0]!);
      syncRo();
    },
    caption: `Press **Train**. The top strip is the current 25-character chunk: inputs, and below them the targets, colored by the probability the model just gave each one (green: confident and right, red: surprised). The chart is \`smooth_loss\`; the box shows the latest sample, and the list keeps samples from milestone iterations. Watch the progression: random characters, then spaces and line breaks in sensible places, then short common words, then the \`Name:\` and newline structure of a play. With only 3 KB of text the model will start reciting it (its loss keeps falling because it is memorizing); Karpathy's runs used megabytes. The temperature slider changes only the samples.`,
  });
}

/* ------------------------------------------------------------------ */
/* Inside the trained model                                             */
/* ------------------------------------------------------------------ */

function figInside(p: Page): void {
  const PRESETS = [
    { value: 'train', label: 'training text', text: CORPUS.slice(0, 108) },
    { value: 'new', label: 'new text', text: 'Second Citizen:\nThe people are hungry, and the senate will not hear us speak of bread.\n' },
  ];
  p.figure({
    title: 'Inside a trained character model',
    codeTitle: 'read_along.py',
    code: `
      h = np.zeros((hidden_size, 1))
      for t, ch in enumerate(text):
          x = np.zeros((vocab_size, 1))
          x[char_to_ix[ch]] = 1
          h = np.tanh(np.dot(Wxh, x) + np.dot(Whh, h) + bh)   #@h
          y = np.dot(Why, h) + by
          p = np.exp(y) / np.sum(np.exp(y))                   #@p
          guess = ix_to_char[np.argmax(p)]   # small letter    #@guess
          shade = h[{{unit:28}}, 0]          # cell color      #@shade
      # after '{{ch:…}}' the model expects: {{top:…}}
    `,
    setup(f) {
      let net: CharRNN | null = null;
      let txt = PRESETS[0]!.text;
      let unit = 28;
      let sel = 14;
      let hs: Float64Array[] = [];
      let ps: Float64Array[] = [];
      const recompute = () => {
        if (!net) return;
        hs = net.hiddenStates([...txt].map((c) => VOC.ix.get(c) ?? 0));
        ps = hs.map((h) => {
          const pr = new Float64Array(net!.V);
          net!.probs(h, pr);
          return pr;
        });
        sel = Math.min(sel, txt.length - 1);
      };
      let layout = { cols: 1, cw: 1, rh: 1, top: 0 };
      const cv = f.canvas(640, 420, (ctx, w, h) => {
        if (!net || !hs.length) return;
        const cw = w < 420 ? 20 : 23;
        const cols = Math.floor((w - 4) / cw);
        const rows = Math.ceil(txt.length / cols);
        const rh = 36;
        const barsH = 118;
        const need = rows * rh + barsH + 8;
        if (Math.abs(need - h) > 2) {
          cv.canvas.style.aspectRatio = `${w} / ${need}`;
          return;
        }
        layout = { cols, cw, rh, top: 0 };
        for (let t = 0; t < txt.length; t++) {
          const x = 2 + (t % cols) * cw;
          const y = Math.floor(t / cols) * rh;
          const a = hs[t]![unit]!;
          rbox(ctx, x + 0.5, y + 1, cw - 1, rh - 3, 4, signedFill(a, color('green'), color('purple')), t === sel ? color('--accent') : null, 2);
          text(ctx, glyph(txt[t]!), x + cw / 2, y + 12, { font: 'mono', size: 13, weight: 600, color: color('--ink') });
          const pr = ps[t]!;
          let best = 0;
          for (let k = 1; k < pr.length; k++) if (pr[k]! > pr[best]!) best = k;
          const nxt = txt[t + 1];
          const ok = nxt !== undefined && VOC.chars[best] === nxt;
          text(ctx, glyph(VOC.chars[best]!), x + cw / 2, y + 26, { font: 'mono', size: 11, color: nxt === undefined ? color('--ink-3') : ok ? color('green') : color('red') });
        }
        // the selected position's distribution
        const y0 = rows * rh + 10;
        const pr = ps[sel]!;
        const order = [...pr].map((v, k) => [v, k] as const).sort((a, b) => b[0] - a[0]).slice(0, 5);
        text(ctx, `after "${glyph(txt[sel]!)}" (position ${sel + 1}), the model expects:`, 2, y0 + 8, { size: 12, color: color('--ink-2'), align: 'left' });
        const bw = w - 60 - 50;
        order.forEach(([v, k], r) => {
          const yy = y0 + 22 + r * 18;
          text(ctx, glyph(VOC.chars[k]!), 40, yy + 7, { font: 'mono', size: 12.5, weight: 600, color: color('--ink'), align: 'right' });
          rbox(ctx, 48, yy, Math.max(2, bw * v), 14, 3, withAlpha(color('teal'), 0.3 + 0.55 * Math.sqrt(v)), null);
          text(ctx, `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`, 48 + Math.max(2, bw * v) + 5, yy + 7, { font: 'mono', size: 11, color: color('--ink-2'), align: 'left' });
        });
      });
      cv.canvas.style.touchAction = 'pan-y';
      cv.canvas.addEventListener('click', (e) => {
        const r = cv.canvas.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        const col = Math.floor((x - 2) / layout.cw), row = Math.floor(y / layout.rh);
        const t = row * layout.cols + col;
        if (col >= 0 && col < layout.cols && t >= 0 && t < txt.length) {
          sel = t;
          sync();
        }
      });
      const sync = () => {
        if (!net) return;
        const pr = ps[sel]!;
        const order = [...pr].map((v, k) => [v, k] as const).sort((a, b) => b[0] - a[0]).slice(0, 3);
        f.code.setMany({
          unit,
          ch: glyph(txt[sel]!),
          top: order.map(([v, k]) => `'${glyph(VOC.chars[k]!)}' ${(v * 100).toFixed(0)}%`).join(', '),
        });
        f.code.highlight(['shade', 'guess']);
        cv.redraw();
      };
      const unitSlider = f.slider({
        label: 'hidden unit',
        min: 0,
        max: 63,
        step: 1,
        value: unit,
        format: (v) => String(Math.round(v)),
        onInput: (v) => {
          unit = Math.round(v);
          sync();
        },
      });
      const presetEl = f.segmented({
        label: 'color by',
        options: [
          { value: 'space', label: 'space unit' },
          { value: 'vowel', label: 'vowel unit' },
        ],
        value: 'space',
        onChange: (v) => {
          const u = finders[v];
          if (u !== undefined) unitSlider.set(u.unit);
          f.status(u ? u.note : '');
        },
      });
      f.segmented({
        label: 'text',
        options: PRESETS.map((q) => ({ value: q.value, label: q.label })),
        value: 'train',
        onChange: (v) => {
          txt = PRESETS.find((q) => q.value === v)!.text;
          recompute();
          sync();
        },
      });
      const finders: Record<string, { unit: number; note: string }> = {};
      f.status('Loading the trained model…');
      loadPretrained()
        .then((m) => {
          net = m;
          // correlate every unit with two simple features over the whole training text
          const all = net.hiddenStates(DATA);
          const feats: Record<string, number[]> = {
            space: [...CORPUS].map((c) => (c === ' ' ? 1 : 0)),
            vowel: [...CORPUS].map((c) => ('aeiouAEIOU'.includes(c) ? 1 : 0)),
          };
          for (const [k, fv] of Object.entries(feats)) {
            let best = 0, bestC = 0;
            for (let u = 0; u < net.H; u++) {
              const c = corr(all.map((hh) => hh[u]!), fv);
              if (Math.abs(c) > Math.abs(bestC)) {
                best = u;
                bestC = c;
              }
            }
            finders[k] = {
              unit: best,
              note: `Unit ${best} has the strongest link to ${k === 'space' ? 'reading a space' : 'reading a vowel'} of all 64 units: correlation ${bestC.toFixed(2)} over the training text (1 would be a perfect detector, 0 no relation; the sign only says which way it swings).`,
            };
          }
          recompute();
          presetEl.set('space');
        })
        .catch((e) => f.status(`Could not load the model: ${(e as Error).message}`));
    },
    caption: `The trained model from the temperature figure reads the text one character at a time. Under each character is its top guess for the *next* one (green when right, red when wrong), and each cell is shaded by one hidden unit's value (green positive, purple negative). **Tap a character** to see the full guess. On the training text it is nearly always right, partly because it has memorized it; on new text it still knows that a newline after "Citizen:" is likely and which letters start words. Browse units with the slider: a few track simple things like spaces or vowels, most are a jumble.`,
  });
}

function corr(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((x, y) => x + y, 0) / n;
  const mb = b.reduce((x, y) => x + y, 0) / n;
  let s = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) {
    s += (a[i]! - ma) * (b[i]! - mb);
    sa += (a[i]! - ma) ** 2;
    sb += (b[i]! - mb) ** 2;
  }
  return s / Math.sqrt(sa * sb + 1e-12);
}

/* ------------------------------------------------------------------ */
/* What char-rnn learns                                                 */
/* ------------------------------------------------------------------ */

export function secWhatItLearns(p: Page): void {
  p.prose(`
### Looking inside

A trained model is just numbers, but we can watch it read. Feed it a passage one character at a time and record, at every step, its guess for the next character and the value of each hidden unit.`);
  figInside(p);
  p.h2('What char-rnn learns', 'what-it-learns');
  p.prose(`
Scale the same idea up (a few layers of LSTMs, the improved RNN at the end of this chapter, with hundreds of units each, trained for hours on a GPU) and the results get eerie. Karpathy's *char-rnn* code and his blog post fed it a range of texts, always one character at a time, with no notion of words, grammar or syntax given in advance:`);
  p.table(
    ['Training text', 'What the samples pick up'],
    [
      ['All of Shakespeare (4.4 MB)', 'Speaker names in capitals followed by speeches, archaic diction, plausible line lengths and punctuation. Reads like Shakespeare from across the room, nonsense up close.'],
      ['Wikipedia (the 100 MB Hutter Prize dump)', 'Headings, bulleted lists, internal links and wiki markup, citations with plausible but invented URLs, even the surrounding XML.'],
      ['The LaTeX source of an algebraic geometry book', 'Lemmas and proofs, `\\begin` and `\\end` blocks that mostly pair up, fake commutative diagrams; with light editing it nearly compiles.'],
      ['The Linux kernel source (474 MB of C)', 'Functions with balanced braces, sensible indentation, comments, `#include` lines and the GPL license header; variables that are used but never declared.'],
    ],
    { caption: 'From *The Unreasonable Effectiveness of Recurrent Neural Networks* (Karpathy, 2015). The model learns structure at every scale it can reach: spelling, then words, then formatting, then long-range bookkeeping like matching brackets.' },
  );
  p.prose(`
### Interpretable cells

Why does it work? Karpathy, Johnson and Fei-Fei, *Visualizing and Understanding Recurrent Networks* (2015), trained LSTMs on Tolstoy's *War and Peace* and on the Linux kernel, then simply watched individual memory cells as the network read, coloring each character by a cell's value, as in the figure above. Most cells were hard to interpret. But some had clean, human-readable jobs:

- a **quote detector** that switched on at an opening quotation mark and stayed on until the closing one;
- a **line-length tracker** that counted toward the fixed-width line breaks of the text file and reset at every newline;
- in the C code, cells that turned on **inside \`if\` conditions**, **inside comments and strings**, and one that tracked **how deeply nested** the code was.

Nobody told the network about quotes, lines or nesting. Tracking them simply helped it predict the next character, so gradient descent built the trackers. The same paper measured that LSTMs really do use their long memory: their advantage over simpler models showed up most on characters that depend on context far back, like a closing bracket.`);
  p.callout('aside', 'Our 64-unit model, trained on 3 KB, is far too small for detectors that clean. In the figure above, even the best units only loosely follow spaces or vowels. Size and data are part of what makes interpretable cells appear.');
}

/* ------------------------------------------------------------------ */
/* Image captioning                                                     */
/* ------------------------------------------------------------------ */

export function secCaptioning(p: Page): void {
  p.h2('Image captioning', 'captioning');
  p.prose(`
Now put the two halves of the course together. A ConvNet is good at turning an image into a vector that describes it; an RNN is good at turning a vector into a sentence. In 2015 several groups (among them Karpathy and Fei-Fei, Vinyals et al. at Google, and Donahue et al.) connected the two:

1. Run the image through a ConvNet pretrained on ImageNet (VGG in the lecture) and remove its final classification layer. Instead of 1000 class scores you keep the 4096-number feature vector $v$ from the layer before it.
2. Use $v$ to start the RNN. In the lecture's version, $v$ enters the recurrence as one extra term (below). A common alternative, the one Assignment 3 uses, projects $v$ into the RNN's initial hidden state $h_0$.
3. Feed a special \`<START>\` token as the first input. The RNN outputs scores over a vocabulary of words. Sample a word, feed it back in as the next input, and continue until the RNN produces the special \`<END>\` token.`);
  p.math({
    label: 'An RNN conditioned on an image',
    tex: String.raw`\symh_t = \tanh\big(\symWhh\,\symh_{t-1} + \symWxh\,\symx_t + W_{ih}\,v\big)`,
    code: `
      v = cnn_features(image)        # (4096,) VGG without its last layer
      x = W_embed[START]             # the <START> token as a vector
      h = np.tanh(np.dot(Whh, h) + np.dot(Wxh, x) + np.dot(Wih, v))
      y = np.dot(Why, h) + by        # scores over the word vocabulary
    `,
    terms: [
      [String.raw`v`, 'the image, summarized by the ConvNet as 4096 numbers'],
      [String.raw`W_{ih}\,v`, 'the image, mixed into the hidden state by its own new weight matrix'],
      [String.raw`\symx_t`, 'the current word, as a learned vector (a *word embedding*) instead of a one-hot letter'],
      [String.raw`\symWhh\,\symh_{t-1} + \symWxh\,\symx_t`, 'everything else is the vanilla RNN, unchanged'],
    ],
    explain: 'The image whispers into the RNN\'s memory, and a language model takes it from there. Every piece is differentiable, so the whole system, ConvNet included if you wish, trains end to end with backprop on pairs of images and human-written captions. The vocabulary is words rather than characters, so each output is a softmax over thousands of words.',
  });
  p.prose(`The standard dataset is **Microsoft COCO** (Lin et al. 2014): about 120,000 images, each described in a sentence by about five different people. Assignment 3 has you build exactly this model on COCO, first with a vanilla RNN and then with an LSTM. The toy below shows the sampling loop at test time.`);
  figCaption(p);
  p.prose(`
On typical scenes, trained models produce captions that are often startlingly good: a surfer riding a wave, a construction worker in a safety vest on a road, a cat curled up on a suitcase. The failures are just as instructive. Captioners happily mention a frisbee or a cat that is not there because those words usually go with the rest of the scene, mistake a fur coat for an animal, miscount people, or misread an action. They have learned the statistics of captions very well and the content of images somewhat less well. They also glance at the image only once, through one vector; the next chapter's **attention** lets the RNN look at different parts of the image for each word.`);
}

function figCaption(p: Page): void {
  const CAPS: Record<string, [string, number][]> = {
    cat: [['a cat sitting on a bed', 0.35], ['a cat lying on the grass', 0.25], ['a cat sitting in a box', 0.2], ['a dog sitting on a bed', 0.2]],
    ship: [['a boat sailing on the water', 0.45], ['a large ship in the water', 0.35], ['a boat sitting on the water', 0.2]],
    horse: [['a horse standing in a field', 0.45], ['a brown horse standing in the grass', 0.3], ['a man riding a horse', 0.25]],
    airplane: [['an airplane flying in the sky', 0.45], ['a large jet flying in the sky', 0.3], ['a bird flying in the sky', 0.25]],
  };
  const CLS: Record<string, number> = { airplane: 0, cat: 3, horse: 7, ship: 8 };
  const vocabW = [...new Set(Object.values(CAPS).flatMap((cs) => cs.flatMap(([s]) => s.split(' ')))), '<END>'];
  const EPS = 0.01;
  /** Toy p(next word | words so far, image): a mixture over a few hand-written captions. */
  const nextDist = (img: string, prefix: string[]): Map<string, number> => {
    const m = new Map<string, number>();
    let tot = 0;
    for (const [s, wt] of CAPS[img]!) {
      const ws = s.split(' ');
      if (prefix.length > ws.length || prefix.some((w, i) => ws[i] !== w)) continue;
      const nx = prefix.length < ws.length ? ws[prefix.length]! : '<END>';
      m.set(nx, (m.get(nx) ?? 0) + wt);
      tot += wt;
    }
    const out = new Map<string, number>();
    for (const w of vocabW) out.set(w, EPS / vocabW.length);
    if (tot === 0) {
      out.set('<END>', out.get('<END>')! + 1 - EPS);
    } else {
      for (const [w, v] of m) out.set(w, out.get(w)! + ((1 - EPS) * v) / tot);
    }
    return out;
  };

  p.figure({
    title: 'Sampling a caption, one word at a time (a toy)',
    codeTitle: 'caption_sample.py',
    code: `
      v = cnn_features(image)                  # (4096,)       #@init
      h = np.dot(W_proj, v) + b_proj           # image -> h0   #@init
      word, caption = START, []
      for t in range(max_length):
          x = W_embed[word]                    # word vector   #@embed
          h = np.tanh(np.dot(Wx, x) + np.dot(Wh, h) + b)       #@embed
          scores = np.dot(W_vocab, h) + b_vocab                #@scores
          word = {{pick:np.argmax(scores)}}                    #@pick
          if word == END:                                      #@end
              break                                            #@end
          caption.append(word)                                 #@append
      # caption = "{{cap:}}"
    `,
    setup(f) {
      let img = 'cat';
      let mode: 'greedy' | 'sample' = 'greedy';
      let seed = 1;
      let cifar: CifarSet | null = null;
      const imgIdx: Record<string, number> = {};
      type Step = { prefix: string[]; dist: [string, number][]; pick: string };
      let steps: Step[] = [];
      let cur = 0;
      const build = () => {
        const rng = new Rng(seed * 7919 + Object.keys(CAPS).indexOf(img));
        steps = [];
        const prefix: string[] = [];
        for (let t = 0; t < 12; t++) {
          const d = [...nextDist(img, prefix)].sort((a, b) => b[1] - a[1]);
          let pick = d[0]![0];
          if (mode === 'sample') {
            let u = rng.next();
            for (const [w, pr] of d) {
              u -= pr;
              if (u <= 0) {
                pick = w;
                break;
              }
            }
          }
          steps.push({ prefix: [...prefix], dist: d, pick });
          if (pick === '<END>') break;
          prefix.push(pick);
        }
      };
      // stepper index: 0 = init; then two sub-steps per word: scores, pick
      const at = (k: number) => (k === 0 ? { t: -1, s: 0 } : { t: Math.floor((k - 1) / 2), s: (k - 1) % 2 });
      const cv = f.canvas(640, 470, (ctx, w, h) => {
        const { t, s } = at(cur);
        const top = Math.min(110, h * 0.25);
        const sz = top - 14;
        // image -> CNN -> v -> h0
        if (cifar) drawCifar(ctx, cifar, imgIdx[img]!, 4, 4, sz);
        else rbox(ctx, 4, 4, sz, sz, 6, withAlpha(color('--ink-3'), 0.15), null);
        const cnnX = sz + 22;
        const cnnW = Math.min(64, w * 0.12);
        arrow(ctx, sz + 6, 4 + sz / 2, cnnX - 2, 4 + sz / 2, color('--ink-3'), 1.3);
        rbox(ctx, cnnX, 4 + sz * 0.22, cnnW, sz * 0.56, 7, withAlpha(color('blue'), 0.14), color('blue'), 1.2);
        text(ctx, 'CNN', cnnX + cnnW / 2, 4 + sz / 2, { size: 12, weight: 600, color: color('blue') });
        const hx = cnnX + cnnW + 34;
        const hOn = t === -1;
        arrow(ctx, cnnX + cnnW + 2, 4 + sz / 2, hx - 16, 4 + sz / 2, hOn ? color('--accent') : color('--ink-3'), hOn ? 2.4 : 1.3);
        text(ctx, 'v', cnnX + cnnW + 15, 4 + sz / 2 - 9, { font: 'serif', italic: true, size: 14, color: color('--ink-2') });
        ctx.beginPath();
        ctx.arc(hx, 4 + sz / 2, 14, 0, Math.PI * 2);
        ctx.fillStyle = withAlpha(color('green'), hOn ? 0.4 : 0.15);
        ctx.fill();
        ctx.strokeStyle = color('green');
        ctx.lineWidth = hOn ? 2.4 : 1.2;
        ctx.stroke();
        text(ctx, 'h', hx, 4 + sz / 2, { font: 'serif', italic: true, weight: 600, size: 15, color: color('green') });
        // caption so far, word chips that wrap
        const words = t < 0 ? [] : [...steps[Math.min(t, steps.length - 1)]!.prefix, ...(s === 1 ? [steps[t]!.pick] : [])];
        const chips = ['<START>', ...words];
        let cx = hx + 26;
        let cy = 4 + 10;
        ctx.font = '600 12.5px system-ui, sans-serif';
        chips.forEach((wd, k) => {
          const tw = ctx.measureText(wd).width + 14;
          if (cx + tw > w - 2) {
            cx = hx + 26;
            cy += 26;
          }
          const isNew = s === 1 && k === chips.length - 1;
          const isTok = wd.startsWith('<');
          rbox(ctx, cx, cy, tw, 21, 10, withAlpha(isTok ? color('slate') : color('purple'), isNew ? 0.35 : 0.12), isNew ? color('--accent') : null, 2);
          text(ctx, wd, cx + tw / 2, cy + 11, { size: 12.5, weight: 600, color: color('--ink') });
          cx += tw + 5;
        });
        // next-word distribution at this step
        const y0 = top + 12;
        if (t < 0) {
          text(ctx, 'The image becomes the first hidden state.', 4, y0 + 10, { size: 12.5, color: color('--ink-2'), align: 'left' });
          text(ctx, 'Step forward to sample words.', 4, y0 + 30, { size: 12.5, color: color('--ink-3'), align: 'left' });
          return;
        }
        const st = steps[t]!;
        const last = st.prefix.length ? st.prefix[st.prefix.length - 1]! : '<START>';
        text(ctx, `step ${t + 1}: input "${last}", next-word probabilities`, 4, y0 + 8, { size: 12, color: color('--ink-2'), align: 'left' });
        const show = st.dist.slice(0, 6);
        if (!show.some(([wd]) => wd === st.pick)) show[5] = st.dist.find(([wd]) => wd === st.pick)!;
        const rowH = Math.min(36, (h - y0 - 26) / 6);
        const lab = Math.min(96, w * 0.24);
        const bwMax = w - lab - 58;
        show.forEach(([wd, pr], r) => {
          const yy = y0 + 22 + r * rowH;
          const chosen = s === 1 && wd === st.pick;
          text(ctx, wd, lab - 8, yy + rowH * 0.42, { size: 12.5, weight: chosen ? 700 : 500, color: color('--ink'), align: 'right' });
          rbox(ctx, lab, yy + rowH * 0.12, Math.max(2, bwMax * pr), rowH * 0.6, 4, withAlpha(color('purple'), chosen ? 0.75 : 0.3), chosen ? color('--accent') : null, 2);
          text(ctx, pr < 0.01 ? '<1%' : `${Math.round(pr * 100)}%`, lab + Math.max(2, bwMax * pr) + 6, yy + rowH * 0.42, { font: 'mono', size: 11.5, color: color('--ink-2'), align: 'left' });
        });
      });
      cv.canvas.classList.add('scroll-ok');
      const sync = () => {
        const { t, s } = at(cur);
        if (t < 0) {
          f.code.highlight('init');
          f.code.set('cap', '');
        } else {
          const st = steps[t]!;
          f.code.highlight(s === 0 ? ['embed', 'scores'] : st.pick === '<END>' ? ['pick', 'end'] : ['pick', 'append']);
          f.code.set('cap', [...st.prefix, ...(s === 1 && st.pick !== '<END>' ? [st.pick] : [])].join(' '));
        }
        cv.redraw();
      };
      const stepper = f.stepper({
        steps: 1,
        interval: 900,
        label: (k) => {
          const { t, s } = at(k);
          return t < 0 ? 'image in' : `word ${t + 1}: ${s === 0 ? 'scores' : 'pick'}`;
        },
        onStep: (k) => {
          cur = k;
          sync();
        },
      });
      const rebuild = () => {
        build();
        stepper.setSteps(1 + steps.length * 2);
        stepper.go(1);
      };
      f.segmented({
        label: 'image',
        options: Object.keys(CAPS).map((k) => ({ value: k, label: k })),
        value: img,
        onChange: (v) => {
          img = v;
          rebuild();
        },
      });
      f.segmented({
        label: 'pick',
        options: [
          { value: 'greedy', label: 'most likely' },
          { value: 'sample', label: 'sample' },
        ],
        value: mode,
        onChange: (v) => {
          mode = v;
          f.code.set('pick', v === 'greedy' ? 'np.argmax(scores)' : 'sample(softmax(scores))');
          rebuild();
        },
      });
      f.button('New sample', () => {
        seed++;
        if (mode === 'greedy') {
          mode = 'sample';
          f.code.set('pick', 'sample(softmax(scores))');
        }
        rebuild();
      });
      rebuild();
      loadCifar()
        .then(({ test }) => {
          cifar = test;
          for (const [k, c] of Object.entries(CLS)) imgIdx[k] = test.labels.findIndex((l) => l === c);
          cv.redraw();
        })
        .catch(() => {});
    },
    caption: `**This is a toy, clearly labeled:** the images are real CIFAR-10 test images, but the "RNN" here is a hand-written table of next-word probabilities built from a few captions per image class, standing in for a trained network's softmax. What is real is the loop: the image sets the first hidden state, \`<START>\` goes in, and each chosen word is fed back in until \`<END>\` comes out. Step through with **most likely**, then switch to **sample** and press **New sample** a few times. Watch the cat: one caption in five calls it a dog, the kind of plausible-but-wrong answer real captioners make.`,
  });
}

/* ------------------------------------------------------------------ */
/* Vanishing and exploding gradients                                    */
/* ------------------------------------------------------------------ */

export function secGradients(p: Page): void {
  p.h2('Vanishing and exploding gradients', 'gradients');
  p.prose(`
In principle a vanilla RNN can carry information across hundreds of steps. In practice it struggles to learn dependencies longer than a dozen or so, and the reason is in the backward loop. To carry the gradient from step $t$ back to step $t-k$, the vector \`dhnext\` goes through the same two operations $k$ times: multiply by tanh's slope, then multiply by $\\symWhh^\\top$.`);
  p.math({
    label: 'Travelling k steps back in time',
    tex: String.raw`\frac{\partial \symL}{\partial \symh_{t-k}} = \Big(\symWhh^{\!\top} D_{t-k+1}\Big)\cdots\Big(\symWhh^{\!\top} D_{t-1}\Big)\Big(\symWhh^{\!\top} D_{t}\Big)\,\frac{\partial \symL}{\partial \symh_t}, \quad D_j = \operatorname{diag}\big(1-\symh_j^2\big)`,
    code: `
      dh = dh_t                            # gradient at step t
      for j in reversed(range(t - k + 1, t + 1)):
          dh = np.dot(Whh.T, (1 - hs[j]**2) * dh)   # one step back
      # dh is now the gradient at step t - k
    `,
    terms: [
      [String.raw`D_j`, "tanh's slope at step $j$, one number per hidden unit, each between 0 and 1 (*diag* means: multiply entry by entry)"],
      [String.raw`\symWhh^{\!\top} D_j`, 'one step back in time'],
      [String.raw`\big(\cdots\big)\cdots\big(\cdots\big)`, '$k$ of those in a row: the same matrix, over and over'],
    ],
    explain: 'Multiply a number by 1.1 fifty times and you get 117; by 0.9 fifty times and you get 0.005. Matrices behave the same way along their strongest direction, measured by the **largest singular value**. If it is above 1, the gradient can grow exponentially as it travels back: **exploding gradients**, which produce absurdly large updates. If it is below 1 (and the tanh slopes, all at most 1, only shrink things further), the gradient decays exponentially: **vanishing gradients**, and the early time steps receive essentially no learning signal. Bengio and colleagues described the problem in 1994; Pascanu, Mikolov and Bengio (2013) analyzed it in detail.',
  });
  p.callout('math', 'A matrix stretches some directions more than others. Its **largest singular value** is the biggest stretch factor it can apply: multiply any vector by the matrix, and the vector\'s length grows by at most that factor. Here, read it as "how much one step back through $W_{hh}$ can amplify a gradient." For an *orthogonal* matrix (a pure rotation) every singular value is exactly 1, which is why orthogonal initialization of $W_{hh}$ is popular.', 'Math help: singular values');
  figVanishing(p);
  p.prose(`
The two problems get different fixes:

- **Exploding gradients: clip them.** If the gradient's overall size (its *norm*) exceeds a threshold, scale it down to that threshold before the update. The direction is kept and the step is capped. min-char-rnn uses an even simpler element-wise version, clipping every entry to $\\pm 5$. It is cheap and it works.
- **Vanishing gradients: change the architecture.** No rescaling can rescue a signal that has shrunk to $10^{-10}$. What is needed is a path through time along which the gradient is *not* multiplied by a matrix at every step. That is the LSTM.`);
}

function figVanishing(p: Page): void {
  const HH = 16;
  const T = 50;
  const r = new Rng(21);
  const Q = Array.from({ length: HH * HH }, () => r.randn());
  // normalize Q so its largest singular value is 1 (power iteration on Q^T Q)
  {
    let v = Array.from({ length: HH }, () => r.randn());
    for (let it = 0; it < 80; it++) {
      const u = matvec(Q, v, HH, false);
      const w = matvec(Q, u, HH, true);
      const nn = Math.hypot(...w);
      v = w.map((x) => x / nn);
    }
    const s1 = Math.hypot(...matvec(Q, v, HH, false));
    for (let i = 0; i < Q.length; i++) Q[i]! /= s1;
  }
  const xs = Array.from({ length: T }, () => Array.from({ length: HH }, () => r.randn() * 0.5));
  const h0 = Array.from({ length: HH }, () => r.randn() * 0.5);
  const g0 = (() => {
    const g = Array.from({ length: HH }, () => r.randn());
    const nn = Math.hypot(...g);
    return g.map((x) => x / nn);
  })();

  p.figure({
    title: 'The gradient, travelling back through time',
    codeTitle: 'vanishing.py',
    code: `
      H, T = 16, 50
      Whh = {{sigma:1}} * Q      # Q: random, largest singular value 1
      for t in range(T):        # forward (random inputs x[t])
          hs[t] = np.tanh(np.dot(Whh, hs[t-1]) + x[t])        #@fwd
      dh = np.random.randn(H)   # a gradient arriving at the last step
      dh = dh / np.linalg.norm(dh)
      for t in reversed(range(T)):
          dhraw = {{nl:(1 - hs[t]**2) * dh}}   # back through tanh  #@tanh
          dWhh += np.outer(dhraw, hs[t-1])                     #@acc
          dh = np.dot(Whh.T, dhraw)            # back through Whh   #@whh
          norms.append(np.linalg.norm(dh))     # the curve          #@norm
      norm = np.linalg.norm(dWhh)              # {{gn:…}}
      if {{clip:False}} and norm > 5:          # gradient clipping
          dWhh *= 5 / norm                                     #@clip
    `,
    setup(f) {
      let sigma = 1;
      let useTanh = true;
      let clip = false;
      let norms: number[] = [];
      let gnorm = 0;
      const compute = () => {
        const W = Q.map((q) => q * sigma);
        const hs: number[][] = [];
        let h = h0;
        for (let t = 0; t < T; t++) {
          const a = matvec(W, h, HH, false).map((v, i) => v + xs[t]![i]!);
          h = useTanh ? a.map(Math.tanh) : a;
          hs.push(h);
        }
        let dh = [...g0];
        const dW = new Array(HH * HH).fill(0);
        norms = [1];
        for (let t = T - 1; t >= 0; t--) {
          const draw = useTanh ? dh.map((d, i) => d * (1 - hs[t]![i]! ** 2)) : dh;
          const hp = t > 0 ? hs[t - 1]! : h0;
          for (let i = 0; i < HH; i++) for (let j = 0; j < HH; j++) dW[i * HH + j] += draw[i]! * hp[j]!;
          dh = matvec(W, draw, HH, true);
          norms.push(Math.hypot(...dh));
        }
        gnorm = Math.hypot(...dW);
      };
      const pl = f.plot({
        aspect: 1.35,
        square: false,
        domain: [0, T, -12, 12],
        draw: (pp) => {
          pp.axes({ grid: 10 });
          const c = pp.ctx;
          for (const e of [-10, -5, 5, 10]) pp.text(`10^${e}`, 0.6, e + 0.25, { size: 10.5, mono: true, color: color('--ink-3') });
          pp.text('1', 0.6, 0.25, { size: 10.5, mono: true, color: color('--ink-3') });
          pp.text('steps back in time →', T - 0.5, -11.2, { size: 11, align: 'right', color: color('--ink-3') });
          const ks = norms.map((_, k) => k);
          const lg = norms.map((v) => Math.max(-12, Math.min(12, Math.log10(Math.max(v, 1e-30)))));
          // the sigma^k reference
          pp.path(ks, ks.map((k) => Math.max(-12, Math.min(12, k * Math.log10(sigma)))), withAlpha(color('slate'), 0.8), 1.5, [5, 5]);
          if (clip && gnorm > 5) {
            const s = Math.log10(5 / gnorm);
            pp.path(ks, lg, withAlpha(color('teal'), 0.35), 1.5, [3, 3]);
            pp.path(ks, lg.map((v) => Math.max(-12, v + s)), color('teal'), 2.5);
          } else {
            pp.path(ks, lg, color('teal'), 2.5);
          }
          c.fillStyle = color('slate');
          c.font = '11px system-ui, sans-serif';
          c.textAlign = 'right';
          c.fillText(`dashed: σ^k, σ = ${sigma.toFixed(2)}`, pp.w - 8, 16);
          c.fillStyle = color('teal');
          c.fillText(clip && gnorm > 5 ? '|dh| after clipping (faint: before)' : '|dh| at k steps back', pp.w - 8, 31);
        },
      });
      pl.canvas.classList.add('scroll-ok');
      const backRo = f.readout('|dh| 50 steps back');
      const gRo = f.readout('|dWhh|');
      const sync = () => {
        compute();
        backRo.set(fmtSci(norms[T]! * (clip && gnorm > 5 ? 5 / gnorm : 1)));
        gRo.set(clip && gnorm > 5 ? `${fmtSci(gnorm)} → 5` : fmtSci(gnorm));
        f.code.setMany({ gn: fmtSci(gnorm), clip: clip ? 'True' : 'False', nl: useTanh ? '(1 - hs[t]**2) * dh' : 'dh  # (no tanh)' });
        f.code.highlight(clip && gnorm > 5 ? ['whh', 'clip'] : useTanh ? ['tanh', 'whh'] : 'whh');
        pl.redraw();
      };
      f.slider({
        label: 'largest singular value σ of Whh',
        sym: 'Whh',
        min: 0.5,
        max: 1.6,
        step: 0.01,
        value: 1,
        format: (v) => v.toFixed(2),
        slot: 'sigma',
        onInput: (v) => {
          sigma = v;
          sync();
        },
      });
      f.segmented({
        label: 'nonlinearity',
        options: [
          { value: 'tanh', label: 'tanh' },
          { value: 'none', label: 'none (linear)' },
        ],
        value: 'tanh',
        onChange: (v) => {
          useTanh = v === 'tanh';
          sync();
        },
      });
      f.toggle({
        label: 'clip the gradient at norm 5',
        value: false,
        onChange: (v) => {
          clip = v;
          sync();
        },
      });
      sync();
    },
    caption: `The teal curve is the size of the gradient after travelling $k$ steps back through a 16-unit RNN, on a log scale (each grid line is a factor of $10^{10}$ apart, so the axis spans 24 powers of ten). The dashed line is $\\sigma^k$. Try **none (linear)** first: the curve follows the dashed line, exploding above $\\sigma = 1$ and vanishing below it. Switch back to **tanh**: its slopes are at most 1, so vanishing gets worse, and when $\\sigma$ is large the hidden state saturates in tanh's flat parts and even "exploding" settings can vanish. Turn on **clipping** with a large $\\sigma$: the whole curve shifts down to a safe size, but its slope (the vanishing or exploding with distance) is unchanged.`,
  });
}

function matvec(M: number[], v: number[], n: number, transpose: boolean): number[] {
  const out = new Array(n).fill(0);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out[i] += (transpose ? M[j * n + i]! : M[i * n + j]!) * v[j]!;
  return out;
}

function fmtSci(v: number): string {
  if (v === 0) return '0';
  if (v >= 0.01 && v < 1000) return fmt(v, 3);
  return v.toExponential(1).replace('e+', 'e');
}

/* ------------------------------------------------------------------ */
/* LSTM                                                                 */
/* ------------------------------------------------------------------ */

export function secLstm(p: Page): void {
  p.h2('Long Short-Term Memory (LSTM)', 'lstm');
  p.prose(`
The **LSTM** (Hochreiter and Schmidhuber, 1997) keeps two vectors of memory instead of one: the hidden state $\\symh_t$, which it shows to the rest of the network, and a **cell state** $\\symc_t$, a private memory lane. Information moves in and out of the cell through **gates**: vectors of numbers between 0 and 1, computed fresh at every step, that act as soft switches on each entry. 0 means closed, 1 means open, 0.7 means mostly open.

All four of the LSTM's internal vectors come out of *one* matrix multiply, applied to the previous hidden state stacked on top of the new input:`);
  p.math({
    label: 'LSTM: four vectors from one matrix multiply',
    tex: String.raw`\begin{pmatrix} i \\ f \\ o \\ g \end{pmatrix} = \begin{pmatrix} \sigma \\ \sigma \\ \sigma \\ \tanh \end{pmatrix} W \begin{pmatrix} \symh_{t-1} \\ \symx_t \end{pmatrix}`,
    code: `
      a = np.dot(W, np.concatenate([prev_h, x])) + b   # (4H,)
      H = prev_h.shape[0]
      i = sigmoid(a[0:H])        # input gate: write to the cell?
      f = sigmoid(a[H:2*H])      # forget gate: keep the old cell?
      o = sigmoid(a[2*H:3*H])    # output gate: reveal the cell?
      g = np.tanh(a[3*H:4*H])    # candidate values to write
    `,
    codeTitle: 'lstm_gates.py',
    terms: [
      [String.raw`\begin{pmatrix} \symh_{t-1} \\ \symx_t \end{pmatrix}`, 'the old hidden state and the new input, stacked into one tall vector'],
      [String.raw`W`, 'one weight matrix with $4H$ rows, so the product splits into four vectors of length $H$ (it plays the role of both $W_{hh}$ and $W_{xh}$)'],
      [String.raw`\sigma`, 'the sigmoid, $1/(1+e^{-z})$, which squashes any number into the range 0 to 1: the right range for a switch'],
      [String.raw`i,\ f,\ o`, 'the input, forget and output gates'],
      [String.raw`g`, 'the candidate values to write, squashed to between $-1$ and $1$ like a vanilla RNN\'s hidden state'],
    ],
    explain: 'The ingredients are the same as the vanilla RNN (an input, the previous hidden state, a matrix multiply, squashing functions), but the result is cut into four pieces with four jobs. Assignment 3 writes it exactly like this, with `x.dot(Wx) + prev_h.dot(Wh) + b` and the same i, f, o, g order.',
  });
  p.math({
    label: 'LSTM: cell and hidden state',
    tex: String.raw`\symc_t = f \odot \symc_{t-1} + i \odot g, \qquad \symh_t = o \odot \tanh(\symc_t)`,
    code: `
      next_c = f * prev_c + i * g     # forget some, write some
      next_h = o * np.tanh(next_c)    # reveal some
    `,
    terms: [
      [String.raw`f \odot \symc_{t-1}`, 'keep each entry of the old cell in proportion to the forget gate: 1 keeps it all, 0 wipes it'],
      [String.raw`i \odot g`, 'write new values in proportion to the input gate'],
      [String.raw`+`, 'the kept old values and the new ones are *added*'],
      [String.raw`o \odot \tanh(\symc_t)`, 'the hidden state is a squashed view of the cell, filtered by the output gate'],
    ],
    explain: 'Read it as a tiny memory controller: the forget gate decides what to erase, the input gate what to write, the output gate what to reveal. Each decision is made per entry, per time step, from the current input and hidden state, and all of it is learned. (The original 1997 LSTM had no forget gate; Gers, Schmidhuber and Cummins added it a few years later in *Learning to Forget*, and it turned out to be essential.)',
  });
  figLstm(p);
  p.prose(`
### The gradient highway

Now look at the backward pass along the cell. Since $\\symc_t = f \\odot \\symc_{t-1} + i \\odot g$, the gradient flowing from $\\symc_t$ back to $\\symc_{t-1}$ is simply multiplied, entry by entry, by the forget gate:`);
  p.math({
    label: 'Backprop along the cell state',
    tex: String.raw`\frac{\partial \symL}{\partial \symc_{t-1}} = f \odot \frac{\partial \symL}{\partial \symc_t}`,
    code: `
      dnext_c = dnext_c + dnext_h * o * (1 - np.tanh(next_c)**2)
      dprev_c = f * dnext_c     # no matrix multiply on this path
    `,
    terms: [
      [String.raw`\frac{\partial \symL}{\partial \symc_t}`, 'the gradient arriving at the cell (in code, it first collects what came back through $h_t$)'],
      [String.raw`f\,\odot`, 'multiplied element by element by the forget gate: no weight matrix, no tanh slope'],
      [String.raw`\frac{\partial \symL}{\partial \symc_{t-1}}`, 'the gradient handed to the previous step'],
    ],
    explain: 'Compare the vanilla RNN, where every step back multiplies by `Whh.T` and by tanh\'s slope. Along the LSTM\'s cell, k steps back just multiply by k forget gates, which the network sets for itself and can hold near 1 for as long as it needs to remember. This is the same idea as the residual connections of ResNet (Chapter 11): an *additive* path through which gradients pass many layers without being repeatedly transformed. An unrolled LSTM is a very deep network with a highway running down its length. (Gradients through the gates and $h$ can still vanish; the highway just guarantees one good road.)',
  });
  p.prose(`
### GRU, and the search for something better

The LSTM has inspired many variants. The most popular is the **GRU** (gated recurrent unit, Cho et al. 2014), which merges the cell and hidden state into one vector and uses two gates instead of three:`);
  p.math({
    label: 'The GRU',
    tex: String.raw`\begin{aligned} r &= \sigma\big(W_r [\symh_{t-1}, \symx_t]\big), \quad z = \sigma\big(W_z [\symh_{t-1}, \symx_t]\big)\\ \tilde h &= \tanh\big(W [r \odot \symh_{t-1}, \symx_t]\big)\\ \symh_t &= (1 - z) \odot \symh_{t-1} + z \odot \tilde h \end{aligned}`,
    code: `
      hx = np.concatenate([prev_h, x])
      r = sigmoid(np.dot(Wr, hx))       # reset gate
      z = sigmoid(np.dot(Wz, hx))       # update gate
      h_tilde = np.tanh(np.dot(W, np.concatenate([r * prev_h, x])))
      next_h = (1 - z) * prev_h + z * h_tilde   # blend old and new
    `,
    terms: [
      [String.raw`r`, 'the reset gate: how much of the old state to use when proposing a new one'],
      [String.raw`z`, 'the update gate: how far to move from the old state toward the proposal'],
      [String.raw`\tilde h`, 'the proposed new state'],
      [String.raw`(1-z)\odot\symh_{t-1} + z \odot \tilde h`, 'a per-entry blend of old and new: where $z$ is near 0 the old state is copied forward untouched'],
    ],
    explain: 'The GRU\'s update is a weighted average of the old state and a proposal (papers differ on which side gets $z$ and which $1-z$). Where the update gate stays near 0, the state is copied forward unchanged, which, like the LSTM\'s cell, gives gradients a clear path back through time.',
  });
  p.prose(`
Two large studies from 2015 asked whether anything clearly beats the LSTM. *LSTM: A Search Space Odyssey* (Greff et al.) compared eight variants on speech, handwriting and music tasks and found that none improved significantly on the standard LSTM; the forget gate and the output activation were its most important parts. Jozefowicz, Zaremba and Sutskever searched over ten thousand architectures; the GRU beat the plain LSTM on most of their tasks, but simply initializing the LSTM's forget-gate bias to 1 (so it starts out remembering) closed the gap. The practical verdict: use an LSTM or a GRU, and do not expect fiddling with the cell to buy much.`);
}

function figLstm(p: Page): void {
  const VALS = [0.8, -0.3, 0.5, -0.9, 0.1, 0.4, -0.6, 0.2];
  const STORE = [1, 0, 0, 0, 1, 0, 0, 0];
  // rows: i, f, o, g over [h_prev, value, store]
  const W = [
    [0, 0, 10],
    [0, 0, -10],
    [0, 0, 0],
    [0, 2, 0],
  ];
  const B = [-5, 5, 4, 0];
  interface St { i: number; f: number; o: number; g: number; c: number; h: number; cp: number; hp: number }
  const runSeq = (store: number[]): St[] => {
    let c = 0, h = 0;
    return VALS.map((v, t) => {
      const z = [h, v, store[t]!];
      const a = W.map((row, k) => row.reduce((s, wv, j) => s + wv * z[j]!, B[k]!));
      const i = sigmoid(a[0]!), f = sigmoid(a[1]!), o = sigmoid(a[2]!), g = Math.tanh(a[3]!);
      const cp = c, hp = h;
      c = f * c + i * g;
      h = o * Math.tanh(c);
      return { i, f, o, g, c, h, cp, hp };
    });
  };
  p.figure({
    title: 'An LSTM cell that learned to hold a value',
    codeTitle: 'lstm_step.py',
    code: `
      # x = [value, store];  H = 1, so every gate is one number
      W = np.array([[0, 0,  10],   # i: open when store = 1
                    [0, 0, -10],   # f: forget when store = 1
                    [0, 0,   0],   # o: (almost) always open
                    [0, 2,   0]])  # g: the value, squashed
      b = np.array([-5, 5, 4, 0])
      # t = {{t:0}}   x = [{{v:0.8}}, {{s:1}}]
      a = np.dot(W, np.concatenate([prev_h, x])) + b        #@a
      i = sigmoid(a[0])     # {{i:…}}                       #@gates
      f = sigmoid(a[1])     # {{f:…}}                       #@gates
      o = sigmoid(a[2])     # {{o:…}}                       #@gates
      g = np.tanh(a[3])     # {{g:…}}                       #@gates
      next_c = f * prev_c + i * g     # {{c:…}}             #@cell
      next_h = o * np.tanh(next_c)    # {{h:…}}             #@hid
    `,
    setup(f) {
      const store = [...STORE];
      let seq = runSeq(store);
      let cur = 0;
      const at = (k: number) => ({ t: Math.floor(k / 3), s: k % 3 });
      let stripTop = 0;
      let stripCw = 1;
      const cv = f.canvas(640, 640, (ctx, w, h) => {
        const { t, s } = at(cur);
        const st = seq[t]!;
        const Hd = h * 0.56;
        const Gd = color('gold'), Gr = color('green'), O = color('orange'), lit = color('--accent');
        const ink3 = color('--ink-3');
        const fs = Math.max(11, Math.min(13, w * 0.022));
        const yc = Hd * 0.13;
        const xf = w * 0.3, xp = w * 0.53, xt = w * 0.76;
        const cellOn = s === 1;
        const hidOn = s === 2;
        const gateOn = s === 0;
        const wire = (pts: [number, number][], on: boolean, col = ink3) => {
          ctx.strokeStyle = on ? lit : withAlpha(col, 0.8);
          ctx.lineWidth = on ? 2.2 : 1.2;
          ctx.beginPath();
          pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.stroke();
        };
        const op = (x: number, y: number, sym: string, on: boolean) => {
          ctx.beginPath();
          ctx.arc(x, y, 11, 0, Math.PI * 2);
          ctx.fillStyle = color('--card');
          ctx.fill();
          ctx.strokeStyle = on ? lit : ink3;
          ctx.lineWidth = on ? 2.4 : 1.3;
          ctx.stroke();
          text(ctx, sym, x, y + 1, { size: 15, weight: 600, color: on ? lit : color('--ink-2') });
        };
        // cell line: c_{t-1} -> x f -> + (i g) -> c_t
        ctx.strokeStyle = cellOn ? Gd : withAlpha(Gd, 0.7);
        ctx.lineWidth = cellOn ? 5 : 3;
        ctx.beginPath();
        ctx.moveTo(w * 0.1, yc);
        ctx.lineTo(w * 0.9, yc);
        ctx.stroke();
        text(ctx, 'c', w * 0.04, yc - 9, { font: 'serif', italic: true, weight: 600, size: 16, color: Gd });
        text(ctx, fmt(st.cp, 2), w * 0.045, yc + 10, { font: 'mono', size: fs, color: color('--ink') });
        text(ctx, 'c', w * 0.955, yc - 9, { font: 'serif', italic: true, weight: 600, size: 16, color: Gd });
        text(ctx, s >= 1 ? fmt(st.c, 2) : '?', w * 0.955, yc + 10, { font: 'mono', size: fs, weight: 700, color: color('--ink') });
        text(ctx, 'cell state', (xf + xp) / 2, yc - 11, { size: 11, color: Gd });
        // gates row
        const gy = Hd * 0.56, gh = Hd * 0.27, gw = Math.min(70, w * 0.13);
        const gates: { k: 'i' | 'f' | 'o' | 'g'; x: number; name: string }[] = [
          { k: 'f', x: xf, name: 'forget' },
          { k: 'i', x: w * 0.45, name: 'input' },
          { k: 'g', x: w * 0.61, name: 'value' },
          { k: 'o', x: xt, name: 'output' },
        ];
        const yig = Hd * 0.34;
        wire([[xf, gy], [xf, yc + 11]], cellOn);
        wire([[w * 0.45, gy], [w * 0.45, yig], [xp - 11, yig]], cellOn);
        wire([[w * 0.61, gy], [w * 0.61, yig], [xp + 11, yig]], cellOn);
        wire([[xp, yig - 11], [xp, yc + 11]], cellOn);
        // output path: c_t -> tanh -> x o -> h_t
        const xo = w * 0.86;
        const yth = Hd * 0.27, yom = Hd * 0.43;
        wire([[xo, yc], [xo, yth - 10]], hidOn, Gd);
        wire([[xo, yth + 10], [xo, yom - 11]], hidOn);
        wire([[xt, gy], [xt, yom], [xo - 11, yom]], hidOn);
        rbox(ctx, xo - 18, yth - 10, 36, 20, 6, color('--card'), hidOn ? lit : ink3, hidOn ? 2 : 1.2);
        text(ctx, 'tanh', xo, yth + 1, { size: 11, color: color('--ink-2') });
        op(xf, yc, '×', cellOn);
        op(xp, yc, '+', cellOn);
        op(xp, yig, '×', cellOn);
        op(xo, yom, '×', hidOn);
        arrow(ctx, xo, yom + 11, xo, gy + gh * 0.55, hidOn ? lit : withAlpha(Gr, 0.8), hidOn ? 2.4 : 1.4);
        text(ctx, 'h', xo + 14, gy + gh * 0.3, { font: 'serif', italic: true, weight: 600, size: 16, color: Gr, align: 'left' });
        text(ctx, s >= 2 ? fmt(st.h, 2) : '?', xo, gy + gh * 0.55 + 14, { font: 'mono', size: fs, weight: 700, color: color('--ink') });
        // gates with value bars: sigmoid gates fill 0..1 from the bottom, g fills from the middle
        for (const gt of gates) {
          const v = st[gt.k];
          const x0 = gt.x - gw / 2;
          rbox(ctx, x0, gy, gw, gh, 7, color('--card'), gateOn ? lit : withAlpha(ink3, 0.9), gateOn ? 2.2 : 1.2);
          const inner = gh - 8;
          if (gt.k === 'g') {
            const mid = gy + gh / 2;
            const bh = (Math.abs(v) * inner) / 2;
            rbox(ctx, x0 + 4, v >= 0 ? mid - bh : mid, gw - 8, Math.max(1, bh), 3, withAlpha(O, 0.55), null);
          } else {
            rbox(ctx, x0 + 4, gy + 4 + inner * (1 - v), gw - 8, Math.max(1, inner * v), 3, withAlpha(color('teal'), 0.5), null);
          }
          text(ctx, gt.k, gt.x, gy + gh * 0.3, { font: 'serif', italic: true, weight: 700, size: 16, color: color('--ink') });
          text(ctx, fmt(v, 2), gt.x, gy + gh * 0.72, { font: 'mono', size: fs, weight: 600, color: color('--ink') });
          text(ctx, gt.name, gt.x, gy + gh + 10, { size: 11, color: ink3 });
        }
        // inputs bus: [h_{t-1}, x_t] feeds all four gates
        const busY = Hd * 0.99;
        wire([[w * 0.2, busY], [xt, busY]], gateOn);
        for (const gt of gates) wire([[gt.x, busY], [gt.x, gy + gh + 18]], gateOn);
        text(ctx, `h=${fmt(st.hp, 2)}`, 4, busY - 8, { font: 'mono', size: 11, color: Gr, align: 'left' });
        text(ctx, `x=[${fmt(VALS[t]!, 1)}, ${store[t]}]`, 4, busY + 8, { font: 'mono', size: 11, color: O, align: 'left' });
        // sequence strip
        const sy = Hd + 34;
        const n = VALS.length;
        const cw = (w - 8) / n;
        stripTop = sy;
        stripCw = cw;
        text(ctx, 'tap a step to toggle "store"', 4, sy - 10, { size: 11, color: ink3, align: 'left' });
        for (let k = 0; k < n; k++) {
          const x = 4 + k * cw;
          const on = k === t;
          rbox(ctx, x + 2, sy, cw - 4, 50, 7, on ? withAlpha(lit, 0.1) : null, on ? lit : withAlpha(ink3, 0.5), on ? 2 : 1);
          text(ctx, (VALS[k]! > 0 ? '+' : '') + VALS[k]!.toFixed(1), x + cw / 2, sy + 14, { font: 'mono', size: 12, weight: 600, color: O });
          rbox(ctx, x + 4, sy + 27, cw - 8, 17, 8, store[k] ? withAlpha(color('purple'), 0.7) : withAlpha(ink3, 0.12), null);
          text(ctx, 'store', x + cw / 2, sy + 36, { size: 11, weight: store[k] ? 600 : 400, color: store[k] ? '#fff' : ink3 });
        }
        // c trace
        const ty0 = sy + 64, ty1 = h - 8;
        const yOf = (v: number) => ty0 + ((1 - v) / 2) * (ty1 - ty0);
        ctx.strokeStyle = withAlpha(ink3, 0.4);
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(4, yOf(0));
        ctx.lineTo(w - 4, yOf(0));
        ctx.stroke();
        ctx.setLineDash([]);
        text(ctx, 'c over time', w - 6, ty0 + 6, { size: 11, color: Gd, align: 'right' });
        ctx.strokeStyle = Gd;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        const upto = s >= 1 ? t : t - 1;
        for (let k = 0; k <= upto; k++) {
          const x = 4 + (k + 0.5) * cw;
          if (k) ctx.lineTo(x, yOf(seq[k]!.c));
          else ctx.moveTo(x, yOf(seq[k]!.c));
        }
        ctx.stroke();
        for (let k = 0; k <= upto; k++) {
          ctx.beginPath();
          ctx.arc(4 + (k + 0.5) * cw, yOf(seq[k]!.c), k === t ? 5 : 3.5, 0, Math.PI * 2);
          ctx.fillStyle = Gd;
          ctx.fill();
        }
      });
      cv.canvas.style.touchAction = 'pan-y';
      cv.canvas.addEventListener('click', (e) => {
        const r = cv.canvas.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        if (y < stripTop || y > stripTop + 52) return;
        const k = Math.floor((x - 4) / stripCw);
        if (k < 0 || k >= VALS.length) return;
        store[k] = store[k] ? 0 : 1;
        seq = runSeq(store);
        sync();
      });
      const sync = () => {
        const { t, s } = at(cur);
        const st = seq[t]!;
        f.code.highlight((['gates', 'cell', 'hid'] as const)[s]);
        if (s === 0) f.code.highlight(['a', 'gates']);
        f.code.setMany({
          t, v: fmt(VALS[t]!, 2), s: store[t]!,
          i: fmt(st.i, 3), f: fmt(st.f, 3), o: fmt(st.o, 3), g: fmt(st.g, 3),
          c: s >= 1 ? fmt(st.c, 3) : '…', h: s >= 2 ? fmt(st.h, 3) : '…',
        });
        let last = -1;
        for (let k = t; k >= 0; k--) if (store[k]) {
          last = k;
          break;
        }
        let prod = 1;
        for (let k = last + 1; k <= t; k++) prod *= seq[k]!.f;
        const msg = [
          store[t] ? `**Store** is on: the input gate opens (i = ${st.i.toFixed(3)}) and the forget gate closes (f = ${st.f.toFixed(3)}).` : `No store signal: the input gate is shut (i = ${st.i.toFixed(3)}) and the forget gate is open (f = ${st.f.toFixed(3)}).`,
          store[t] ? `The cell is overwritten with g = tanh(2 × ${VALS[t]!.toFixed(1)}) = ${st.g.toFixed(2)}.` : `The cell keeps ${(st.f * 100).toFixed(1)}% of its old value and ignores the new input ${VALS[t]!.toFixed(1)}.`,
          last >= 0 && last < t ? `The output gate reveals the cell as h. Since the last store (step ${last}), the gradient along the cell has been multiplied only by forget gates: ${prod.toFixed(3)} after ${t - last} steps.` : `The output gate reveals the cell as h = o × tanh(c) = ${st.h.toFixed(2)}.`,
        ][s]!;
        f.status(msg);
        cv.redraw();
      };
      f.stepper({
        steps: VALS.length * 3,
        interval: 1000,
        label: (k) => `t = ${at(k).t}: ${['gates', 'cell', 'hidden'][at(k).s]}`,
        onStep: (k) => {
          cur = k;
          sync();
        },
      });
    },
    caption: `A one-unit LSTM with hand-set weights (the comments say what each row does), reading a sequence of values with a "store" flag. Step through: when **store** is on, the input gate opens and the forget gate closes, so the value is written into the cell; otherwise the cell holds what it has, losing under 1% per step, no matter what new values arrive. **Tap a step** in the strip to toggle its flag and watch the gold trace of the cell change. A trained LSTM learns weights like these on its own; the gate bars show the gates as dials between 0 and 1.`,
  });
}

/* ------------------------------------------------------------------ */
/* Summary                                                              */
/* ------------------------------------------------------------------ */

export function secSummary(p: Page): void {
  p.h2('Summary', 'summary');
  p.prose(`
- **RNNs give networks memory**: a loop with a hidden state and shared weights. The same machinery handles one-to-many (captioning), many-to-one (sentiment) and many-to-many (translation, video) problems.
- **Training is ordinary backprop on the unrolled graph** (BPTT), usually truncated to chunks with the hidden state carried forward.
- **Vanilla RNNs are simple but do not work very well**: gradients flowing back through many steps are multiplied by the same matrix again and again, so they explode or vanish.
- **Clip gradients** to tame explosions. **Use an LSTM or GRU**, whose additive memory path lets gradients flow, to fight vanishing.
- The lecture's closing note still holds: we have good recipes, but a deeper theoretical and empirical understanding of these models is still being built.

Assignment 3 has you implement the vanilla RNN and LSTM steps forward and backward, then train a COCO captioner with each. The next chapter asks what happens if the RNN, instead of glancing at one image vector at the start, can look at a *different part of the image* for every word it writes.`);
  p.callout('idea', 'An RNN is a loop: $h_t = f_W(h_{t-1}, x_t)$ with the same weights at every step. Trained with the softmax loss on "predict the next element", it becomes a generator you can sample from, a step at a time, feeding each output back in. Backprop through time multiplies by $W_{hh}$ at every step, so plain RNNs explode or forget; clipping fixes the first, and the LSTM\'s additive cell state (a gradient highway, like ResNet\'s skip connections) fixes the second.', 'Takeaways');
}

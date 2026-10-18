import type { ChapterDef } from './index';
import type { Fig } from '../core/page';
import { fmt } from '../core/code';
import { type Dataset2D, blobs, circles, spiral, xor } from '../core/data';
import { type Activation, MLP, act, dact } from '../core/nn';
import { CLASS_COLORS, type Plot, color, rgbOf, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';

const sig = (z: number) => 1 / (1 + Math.exp(-z));

/** Two-class "noisy disc": label 0 inside a circle, 1 outside, with a fraction of labels flipped. */
function noisyDisc(n: number, seed: number, flip: number): Dataset2D {
  const r = new Rng(seed);
  const X = new Float64Array(n * 2);
  const y = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const a = r.uniform(-1, 1);
    const b = r.uniform(-1, 1);
    X[2 * i] = a;
    X[2 * i + 1] = b;
    let c = a * a + b * b < 0.42 ? 0 : 1;
    if (r.next() < flip) c = 1 - c;
    y[i] = c;
  }
  return { X, y, n, classes: 2 };
}

/** Decision regions of `net` plus the data points; misclassified points get a dark ring. */
function drawRegions(pp: Plot, net: MLP, d: Dataset2D, opts: { alpha?: number; cell?: number; faint?: Dataset2D } = {}) {
  const cols = CLASS_COLORS.slice(0, d.classes).map((c) => rgbOf(color(c)));
  const a = opts.alpha ?? 46;
  pp.field((x, y) => {
    const k = net.predict([x, y]);
    const [r, g, b] = cols[k]!;
    return [r, g, b, a];
  }, opts.cell ?? 6);
  pp.axes({ grid: 0.5 });
  if (opts.faint) {
    for (let i = 0; i < opts.faint.n; i++) pp.dot(opts.faint.X[2 * i]!, opts.faint.X[2 * i + 1]!, 2, withAlpha(color(CLASS_COLORS[opts.faint.y[i]!]!), 0.35));
  }
  for (let i = 0; i < d.n; i++) {
    const xi = d.X[2 * i]!, yi = d.X[2 * i + 1]!;
    const k = d.y[i]!;
    const wrong = net.predict([xi, yi]) !== k;
    pp.dot(xi, yi, wrong ? 5 : 4, color(CLASS_COLORS[k]!), wrong ? color('--ink') : withAlpha(color('--paper'), 0.9));
  }
}

/** A trainer that runs as many steps as fit in a few ms per frame and redraws. */
function trainer(f: Fig, o: { step: () => number; max: number; onFrame: (loss: number, done: boolean) => void; budgetMs?: number }) {
  let steps = 0;
  let loss = NaN;
  let frame = 0;
  const loop = f.loop(() => {
    const t0 = performance.now();
    while (performance.now() - t0 < (o.budgetMs ?? 6) && steps < o.max) {
      loss = o.step();
      steps++;
    }
    frame++;
    const done = steps >= o.max;
    if (done || frame % 2 === 0) o.onFrame(loss, done);
    if (done) return false;
  });
  return {
    get steps() {
      return steps;
    },
    get loss() {
      return loss;
    },
    reset() {
      steps = 0;
      loss = NaN;
    },
    loop,
  };
}

/** Draws a fully-connected net: columns of neurons, every pair of adjacent columns fully wired. */
function drawNet(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  sizes: number[],
  o: { sel?: number; vals?: (number[] | null)[]; W?: number[][][]; lit?: number; names?: boolean } = {},
) {
  const L = sizes.length;
  const padX = Math.max(34, w * 0.09);
  const top = 22;
  const bottom = o.names === false ? 14 : 40;
  const maxN = Math.max(...sizes);
  const gap = Math.min(46, (h - top - bottom) / Math.max(1, maxN));
  const r = Math.max(7, Math.min(14, gap * 0.32));
  const colX = (l: number) => (L === 1 ? w / 2 : padX + (l * (w - 2 * padX)) / (L - 1));
  const ny = (l: number, i: number) => top + (h - top - bottom) / 2 + (i - (sizes[l]! - 1) / 2) * gap;
  const ink3 = color('--ink-3');
  if (o.sel !== undefined) {
    const x = colX(o.sel);
    const n = sizes[o.sel]!;
    ctx.fillStyle = withAlpha(color('--accent'), 0.1);
    ctx.strokeStyle = withAlpha(color('--accent'), 0.6);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x - r - 9, ny(o.sel, 0) - r - 9, 2 * r + 18, (n - 1) * gap + 2 * r + 18, 10);
    ctx.fill();
    ctx.stroke();
  }
  let wmax = 1e-9;
  if (o.W) for (const M of o.W) for (const row of M) for (const v of row) wmax = Math.max(wmax, Math.abs(v));
  for (let l = 1; l < L; l++) {
    const lit = o.lit === undefined || o.lit === l;
    for (let i = 0; i < sizes[l]!; i++)
      for (let j = 0; j < sizes[l - 1]!; j++) {
        ctx.beginPath();
        ctx.moveTo(colX(l - 1) + r, ny(l - 1, j));
        ctx.lineTo(colX(l) - r, ny(l, i));
        if (o.W) {
          const v = o.W[l - 1]![i]![j]!;
          ctx.strokeStyle = withAlpha(color(v >= 0 ? 'blue' : 'red'), lit ? 0.75 : 0.18);
          ctx.lineWidth = 0.4 + 3 * (Math.abs(v) / wmax);
        } else {
          ctx.strokeStyle = withAlpha(ink3, 0.55);
          ctx.lineWidth = 1;
        }
        ctx.stroke();
      }
  }
  for (let l = 0; l < L; l++) {
    const role = l === 0 ? 'orange' : l === L - 1 ? 'purple' : 'gold';
    const col = color(role);
    for (let i = 0; i < sizes[l]!; i++) {
      const x = colX(l), y = ny(l, i);
      const v = o.vals?.[l]?.[i];
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = v === undefined ? color('--card') : withAlpha(col, 0.12 + 0.75 * Math.min(1, Math.abs(v)));
      ctx.fill();
      ctx.lineWidth = o.lit === l ? 2.6 : 1.6;
      ctx.strokeStyle = col;
      ctx.stroke();
      if (v !== undefined) {
        const s = fmt(v, 2);
        ctx.font = "600 11px 'JetBrains Mono Variable', ui-monospace, monospace";
        const tw = ctx.measureText(s).width;
        const tx = x - tw / 2;
        const ty = y - r - 8;
        ctx.fillStyle = withAlpha(color('--paper'), 0.85);
        ctx.fillRect(tx - 2, ty - 7, tw + 4, 14);
        ctx.fillStyle = color('--ink');
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(s, tx, ty);
      }
    }
    if (o.names !== false) {
      ctx.fillStyle = color('--ink-2');
      ctx.font = '11.5px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      const name = l === 0 ? 'input' : l === L - 1 ? 'output' : L > 3 ? `hidden ${l}` : 'hidden';
      ctx.fillText(name, x0(l), h - 20);
      ctx.fillStyle = color('--ink-3');
      ctx.font = "11px 'JetBrains Mono Variable', ui-monospace, monospace";
      ctx.fillText(String(sizes[l]), x0(l), h - 6);
    }
  }
  function x0(l: number) {
    return colX(l);
  }
  return { colX, r };
}

const chapter: ChapterDef = {
  symbols: {
    W: { color: 'blue', name: 'W: the weights of a layer (W1, W2, ... for each layer)', code: ['W', 'W1', 'W2', 'W3', 'w'] },
    x: { color: 'orange', name: 'x: the input to the network', code: ['x', 'X', 'inputs'] },
    b: { color: 'green', name: 'b: the biases of a layer', code: ['b', 'b1', 'b2', 'b3', 'bias'] },
    s: { color: 'purple', name: 's: the output scores (no activation on the last layer)', code: ['scores'] },
    h: { color: 'gold', name: 'h: hidden-layer activations, features the network computes for itself', code: ['h', 'h1', 'h2', 'hidden'] },
    f: { color: 'red', name: 'f: the activation function (the nonlinearity)', code: ['f'] },
    g: { color: 'teal', tex: '\\nabla', name: 'gradient: how the loss changes with a value', code: ['dz', 'dw', 'db', 'dout', 'dscore'] },
    lam: { color: 'slate', name: 'λ: regularization strength', tex: '\\lambda', code: ['reg'] },
  },

  render(p) {
    p.prose(`
A linear classifier draws straight walls between classes, and Chapter 4 showed where that runs out: one template per class, flat boundaries, no way to say "a horse facing left *or* a horse facing right." This chapter builds the fix, the **neural network**, out of pieces you already have: matrix multiplies, a simple nonlinearity, and (for training) the backpropagation of Chapter 6.

We will start with the plain math, then look at the brain analogy that gave neural networks their name (and its limits), then the choices you actually make when designing one: which activation function, how many layers, how wide.`);

    p.h2('Neural networks without the brain', 'quick-intro');
    p.prose(`
A linear classifier computes scores with one matrix multiply, $\\syms = \\symW\\symx$. A **two-layer neural network** does two multiplies with a very simple function in between:`);
    p.math({
      label: 'A two-layer neural network',
      tex: String.raw`\syms = \sym{W}{W_2}\,\max(0,\; \sym{W}{W_1}\,\symx)`,
      code: `
        x = image.reshape(3072)                  # (3072,)
        W1 = 0.01 * np.random.randn(100, 3072)
        W2 = 0.01 * np.random.randn(10, 100)
        h = np.maximum(0, W1.dot(x))             # (100,) hidden layer
        scores = W2.dot(h)                       # (10,)  class scores
      `,
      codeTitle: 'two_layer.py',
      terms: [
        [String.raw`\sym{W}{W_1}\,\symx`, 'the first matrix multiply: 100 rows, so 100 numbers out. Each row is a template, like in a linear classifier, but now there can be many per class'],
        [String.raw`\max(0,\,\cdot)`, 'applied to each of those 100 numbers separately: negative values become 0, positive ones pass through. This is the *nonlinearity*'],
        [String.raw`\sym{W}{W_2}`, 'the second multiply combines the 100 results into 10 class scores'],
      ],
      explain: 'The middle vector, written `h` in code, is the **hidden layer**: a hundred numbers the network computes for itself. The second layer can then say "this is a horse if template 17 *or* template 42 fires." Both `W1` and `W2` are learned with stochastic gradient descent, with backpropagation computing their gradients. The number 100 is a choice we make (a *hyperparameter*). Biases are left out here for brevity; real layers have them.',
    });
    p.prose(`
Why bother with the $\\max$? Because without it, the two multiplies collapse into one. $\\sym{W}{W_2}(\\sym{W}{W_1}\\symx)$ is just $(\\sym{W}{W_2}\\sym{W}{W_1})\\symx$, and the product of two matrices is another matrix, so the "two-layer" network would be a linear classifier wearing a disguise. The nonlinearity is what lets the network bend its decision boundaries.`);
    p.code(`
      W1 = np.random.randn(100, 3072)
      W2 = np.random.randn(10, 100)
      W = W2.dot(W1)                        # one (10, 3072) matrix
      np.allclose(W2.dot(W1.dot(x)), W.dot(x))                         # True
      np.allclose(W2.dot(np.maximum(0, W1.dot(x))), W.dot(x))          # False
    `, { title: 'collapse.py' });
    p.prose(`A **three-layer** network simply repeats the pattern, $\\syms = \\sym{W}{W_3}\\max(0, \\sym{W}{W_2}\\max(0, \\sym{W}{W_1}\\symx))$, and so on. The sizes of the intermediate vectors are hyperparameters, and we will see how to choose them at the end of the chapter.`);

    p.h2('A neuron, loosely inspired by biology', 'neuron');
    p.prose(`
The field started with an attempt to model the brain, and the vocabulary stuck, so here is the picture behind it.

The basic computing cell of the nervous system is the **neuron**. A human brain has about 86 billion of them, wired together by somewhere around $10^{14}$ to $10^{15}$ connections called **synapses**. Each neuron collects incoming signals through branching fibers called *dendrites* and sends its own signal out along a single long fiber, the *axon*, which branches out and connects to the dendrites of other neurons.

The classic computational model turns this into arithmetic. A signal $\\symx_i$ arriving along an axon is multiplied by the strength of the synapse it crosses, a weight $\\symW_i$. The weights are what learning adjusts: a positive weight *excites* the receiving neuron, a negative one *inhibits* it. The cell body adds up all the weighted inputs, plus a bias, and if the total is high enough the neuron *fires*, sending a spike down its axon. The model ignores the precise timing of spikes and keeps only the **firing rate**, computed from the total by an **activation function** $\\symf$. Historically that function was the sigmoid, which squashes any total into a rate between 0 and 1.`);
    p.math({
      label: 'The model neuron',
      tex: String.raw`\text{output} = \symf\Big(\sum_i \sym{W}{w_i}\,\sym{x}{x_i} + \symb\Big)`,
      code: `
        class Neuron:
            def forward(self, inputs):
                # inputs, weights: 1-D arrays; bias: a number
                cell_body_sum = np.sum(inputs * self.weights) + self.bias
                firing_rate = 1.0 / (1.0 + math.exp(-cell_body_sum))   # sigmoid
                return firing_rate
      `,
      codeTitle: 'neuron.py',
      terms: [
        [String.raw`\sym{W}{w_i}\,\sym{x}{x_i}`, 'input $i$ times the strength of its synapse'],
        [String.raw`\sum_i \cdots + \symb`, 'the cell body adds every weighted input, plus a bias that shifts the firing threshold'],
        [String.raw`\symf(\cdot)`, 'the activation function turns that sum into an output, the "firing rate"'],
      ],
      explain: 'One neuron is a dot product, a bias, and a squashing function. A whole layer of neurons is many of these computed at once, which is exactly the matrix multiply `W.dot(x) + b` followed by `f` applied to each entry.',
    });
    p.callout('warning', `This model is *very* coarse. Real neurons come in many different types with different behavior. Dendrites do complicated nonlinear computation of their own, a synapse is a whole dynamical system rather than a single number, and in many circuits the exact timing of spikes clearly matters, so the "only the firing rate counts" assumption is shaky. Treat the brain analogy as the history of the name, and as loose inspiration. A neural network is a mathematical function built from matrix multiplies and nonlinearities, and that is how this course will think about it.`, 'Not really a brain');

    p.h2('A single neuron is a linear classifier', 'single-neuron');
    p.prose(`
With the right loss attached, one neuron is already a classifier you know. Its weighted sum $\\symW \\cdot \\symx + \\symb$ is a linear score, and the sigmoid turns that score into a number between 0 and 1, which we can read as a probability.`);
    p.math({
      label: 'One neuron as binary softmax (logistic regression)',
      tex: String.raw`\begin{aligned} P(y = 1 \mid \symx) &= \sigma\big(\symW\cdot\symx + \symb\big) \\[2pt] P(y = 0 \mid \symx) &= 1 - P(y = 1 \mid \symx) \end{aligned}`,
      code: `
        def neuron(x, w, b):
            return 1.0 / (1.0 + np.exp(-(np.dot(w, x) + b)))

        p1 = neuron(x, w, b)        # probability of class 1
        loss = -np.log(p1) if y == 1 else -np.log(1 - p1)
        predicted = 1 if p1 > 0.5 else 0
      `,
      codeTitle: 'logistic.py',
      terms: [
        [String.raw`\sigma(\cdot)`, 'the sigmoid, $1/(1+e^{-z})$: maps any score to a number between 0 and 1'],
        [String.raw`P(y=1\mid\symx)`, 'read as "the probability that the label is 1, given input $x$"'],
        [String.raw`1 - P(\cdot)`, 'two classes, so the other probability is whatever is left'],
      ],
      explain: 'This is the two-class version of the Softmax classifier from Chapter 4, also called **logistic regression**: train it with the cross-entropy loss (minus the log probability of the correct class), and predict class 1 whenever the output is above 0.5, which happens exactly when the score $w\\cdot x + b$ is positive. Attach a hinge loss to the raw score instead and the same neuron becomes a **binary SVM**. Either way, the boundary is the straight line where the score is zero.',
    });
    p.figure({
      title: 'One neuron, two classes',
      codeTitle: 'one_neuron.py',
      code: `
        w = np.array([{{w0}}, {{w1}}])
        b = {{b}}
        reg = {{reg:0.01}}

        for step in range(1000):
            scores = X.dot(w) + b                     #@fwd
            if loss_type == '{{lt:softmax}}':
                p = 1 / (1 + np.exp(-scores))         #@soft
                dscore = (p - y) / N                  #@soft
            else:  # binary SVM with labels t = +1 / -1
                t = 2 * y - 1                         #@svm
                dscore = -t * (t * scores < 1) / N    #@svm
            dw = X.T.dot(dscore) + reg * w            #@upd
            db = dscore.sum()                         #@upd
            w -= 0.5 * dw                             #@upd
            b -= 0.5 * db                             #@upd
        # loss {{loss}}   accuracy {{acc}}
      `,
      setup(f) {
        const d = blobs(30, 2, 0.28, 21);
        const N = d.n;
        const st = { w0: 1.6, w1: -0.6, b: 0.3, reg: 0.01 };
        let lt: 'softmax' | 'svm' = 'softmax';
        const lossAndGrad = () => {
          let loss = 0;
          let gw0 = 0, gw1 = 0, gb = 0;
          for (let i = 0; i < N; i++) {
            const x0 = d.X[2 * i]!, x1 = d.X[2 * i + 1]!;
            const s = st.w0 * x0 + st.w1 * x1 + st.b;
            const yi = d.y[i]!;
            let ds: number;
            if (lt === 'softmax') {
              const p = sig(s);
              loss += -Math.log(Math.max(1e-12, yi ? p : 1 - p));
              ds = (p - yi) / N;
            } else {
              const t = 2 * yi - 1;
              loss += Math.max(0, 1 - t * s);
              ds = t * s < 1 ? -t / N : 0;
            }
            gw0 += ds * x0;
            gw1 += ds * x1;
            gb += ds;
          }
          loss = loss / N + 0.5 * st.reg * (st.w0 ** 2 + st.w1 ** 2);
          return { loss, gw0: gw0 + st.reg * st.w0, gw1: gw1 + st.reg * st.w1, gb };
        };
        const acc = () => {
          let ok = 0;
          for (let i = 0; i < N; i++) if ((st.w0 * d.X[2 * i]! + st.w1 * d.X[2 * i + 1]! + st.b > 0 ? 1 : 0) === d.y[i]) ok++;
          return ok / N;
        };
        const pl = f.plot({
          aspect: 1.15,
          domain: [-1.25, 1.25, -1.25, 1.25],
          draw: (pp) => {
            const c0 = rgbOf(color(CLASS_COLORS[0]!));
            const c1 = rgbOf(color(CLASS_COLORS[1]!));
            pp.field((a, bb) => {
              const q = sig(st.w0 * a + st.w1 * bb + st.b);
              return [c0[0] + (c1[0] - c0[0]) * q, c0[1] + (c1[1] - c0[1]) * q, c0[2] + (c1[2] - c0[2]) * q, 30 + 70 * Math.abs(q - 0.5)];
            }, 5);
            pp.axes({ grid: 0.5 });
            const n2 = st.w0 ** 2 + st.w1 ** 2;
            if (n2 > 1e-9) {
              const nrm = Math.sqrt(n2);
              const fx = (-st.b * st.w0) / n2, fy = (-st.b * st.w1) / n2;
              const tx = -st.w1 / nrm, ty = st.w0 / nrm;
              pp.path([fx - tx * 4, fx + tx * 4], [fy - ty * 4, fy + ty * 4], color('--ink'), 2);
              for (const lvl of [-2.197, 2.197]) {
                const ox = (lvl * st.w0) / n2, oy = (lvl * st.w1) / n2;
                pp.path([fx + ox - tx * 4, fx + ox + tx * 4], [fy + oy - ty * 4, fy + oy + ty * 4], withAlpha(color('--ink-3'), 0.8), 1.2, [5, 5]);
              }
              pp.arrow(fx, fy, fx + st.w0 * 0.3, fy + st.w1 * 0.3, color('blue'), 3);
            }
            for (let i = 0; i < N; i++) {
              const xi = d.X[2 * i]!, yi = d.X[2 * i + 1]!;
              const k = d.y[i]!;
              const wrong = (st.w0 * xi + st.w1 * yi + st.b > 0 ? 1 : 0) !== k;
              pp.dot(xi, yi, wrong ? 5.5 : 4.5, color(CLASS_COLORS[k]!), wrong ? color('--ink') : withAlpha(color('--paper'), 0.9));
            }
          },
        });
        const lossRo = f.readout('loss');
        const accRo = f.readout('accuracy');
        const normRo = f.readout('|w|', { sym: 'W' });
        const sync = () => {
          const { loss } = lossAndGrad();
          const a = `${Math.round(acc() * 100)}%`;
          f.code.setMany({ w0: fmt(st.w0, 3), w1: fmt(st.w1, 3), b: fmt(st.b, 3), loss: fmt(loss, 3), acc: a });
          lossRo.set(fmt(loss, 3));
          accRo.set(a);
          normRo.set(fmt(Math.hypot(st.w0, st.w1), 3));
          pl.redraw();
        };
        let drag = false;
        const aim = (e: PointerEvent) => {
          const [a, bb] = pl.pointer(e);
          const n2 = Math.max(1e-6, st.w0 ** 2 + st.w1 ** 2);
          const fx = (-st.b * st.w0) / n2, fy = (-st.b * st.w1) / n2;
          st.w0 = (a - fx) / 0.3;
          st.w1 = (bb - fy) / 0.3;
          sync();
        };
        pl.canvas.addEventListener('pointerdown', (e) => { drag = true; stopAll(); pl.canvas.setPointerCapture(e.pointerId); aim(e); });
        pl.canvas.addEventListener('pointermove', (e) => drag && aim(e));
        pl.canvas.addEventListener('pointerup', () => (drag = false));
        let mode: 'train' | 'forget' = 'train';
        let k = 0;
        const loop = f.loop(() => {
          for (let i = 0; i < 4; i++) {
            const g = lossAndGrad();
            if (mode === 'train') {
              st.w0 -= 0.5 * g.gw0;
              st.w1 -= 0.5 * g.gw1;
              st.b -= 0.5 * g.gb;
            } else {
              st.w0 *= 1 - 0.5 * st.reg * 10;
              st.w1 *= 1 - 0.5 * st.reg * 10;
            }
          }
          k++;
          f.code.highlight(mode === 'train' ? (['fwd', lt === 'softmax' ? 'soft' : 'svm', 'upd'] as const)[k % 3]! : 'upd');
          biasS.set(st.b, false);
          sync();
        });
        const stopAll = () => {
          loop.stop();
          trainBtn.textContent = 'Train';
          forgetBtn.textContent = 'Only forget';
          f.code.highlight(null);
        };
        const trainBtn = f.button('Train', () => {
          if (loop.running() && mode === 'train') return stopAll();
          stopAll();
          mode = 'train';
          f.status('');
          loop.start();
          trainBtn.textContent = 'Pause';
        }, { primary: true });
        const forgetBtn = f.button('Only forget', () => {
          if (loop.running() && mode === 'forget') return stopAll();
          stopAll();
          mode = 'forget';
          loop.start();
          forgetBtn.textContent = 'Stop';
          f.status('Only the regularization part of the update is running (sped up 10×): every step multiplies the weights by a number just below 1. The arrow shrinks, the boundary blurs, and the neuron slowly forgets.');
        });
        const biasS = f.slider({ label: 'bias b', sym: 'b', min: -1.5, max: 1.5, step: 0.01, value: st.b, onInput: (v) => { st.b = v; sync(); } });
        f.slider({ label: 'λ', sym: 'lam', min: -3, max: 0, step: 0.1, value: -2, map: (r) => 10 ** r, format: (v) => fmt(v, 2), slot: 'reg', onInput: (v) => { st.reg = v; sync(); } });
        f.segmented({
          label: 'loss',
          options: [
            { value: 'softmax', label: 'binary softmax' },
            { value: 'svm', label: 'binary SVM' },
          ],
          value: 'softmax',
          slot: 'lt',
          onChange: (v) => { lt = v as typeof lt; sync(); },
        });
        sync();
      },
      caption: `The blue arrow is the neuron's weight vector $\\symW$, and the background shading is its output $\\sigma(\\symW\\cdot\\symx + \\symb)$: deep blue near 0, deep orange near 1, pale where it is unsure. The solid line is where the output is exactly 0.5, the dashed lines where it is 0.1 and 0.9. **Drag** on the plot to aim the arrow; a longer arrow makes the transition sharper and the neuron more confident. Press **Train** to fit it with either loss. Then press **Only forget**: with the data term switched off, regularization alone shrinks every weight a little each step.`,
    });
    p.prose(`
That last button shows a nice reading of regularization in this biological picture. The L2 penalty adds $\\symlam\\symW$ to every weight's gradient, so each update first shrinks all the weights a little toward zero, then applies whatever the data asks for. Weights that the data keeps reinforcing survive; the rest decay. Regularization is **gradual forgetting**.`);
    p.math({
      label: 'Regularization as forgetting',
      tex: String.raw`\begin{aligned} \symW &\leftarrow \symW - \eta\big(\sym{g}{\nabla_{\symW}} L_{\text{data}} + \symlam\symW\big) \\[2pt] &= (1 - \eta\symlam)\,\symW - \eta\,\sym{g}{\nabla_{\symW}} L_{\text{data}} \end{aligned}`,
      code: `
        dw = dw_data + reg * w          # data gradient plus L2 term
        w -= lr * dw
        # same thing, regrouped:
        w = (1 - lr * reg) * w - lr * dw_data
      `,
      codeTitle: 'forgetting.py',
      terms: [
        [String.raw`\eta`, 'the learning rate (step size)'],
        [String.raw`\symlam\symW`, 'the gradient of the L2 penalty $\\tfrac{1}{2}\\lambda\\sum w^2$'],
        [String.raw`(1 - \eta\symlam)`, 'a factor slightly below 1, applied to every weight on every step'],
      ],
      explain: 'With a learning rate of 0.5 and $\\lambda = 0.01$, every step multiplies each weight by 0.995 before the data gets its say. Left alone for 1,000 steps, a weight would shrink to about 0.7% of its size.',
    });

    p.h2('Activation functions', 'activations');
    p.prose(`
Every neuron applies a fixed nonlinearity to its weighted sum. Several are in common use, and the choice matters for one main reason: during backpropagation, the gradient passing through a neuron gets **multiplied by the activation's local slope** (Chapter 6). An activation whose slope is nearly zero somewhere will block gradients there.`);
    p.math({
      label: 'The usual activation functions',
      tex: String.raw`\begin{aligned}
        \sigma(z) &= \tfrac{1}{1 + e^{-z}} \\[2pt]
        \tanh(z) &= 2\sigma(2z) - 1 \\[2pt]
        \mathrm{ReLU}(z) &= \max(0, z) \\[2pt]
        \mathrm{leaky}(z) &= \max(\alpha z, z) \\[2pt]
        \mathrm{maxout} &= \max(\sym{W}{w_1}^{\top}\symx{+}\sym{b}{b_1}, \sym{W}{w_2}^{\top}\symx{+}\sym{b}{b_2})
      \end{aligned}`,
      code: `
        sigmoid = lambda z: 1 / (1 + np.exp(-z))
        tanh = np.tanh
        relu = lambda z: np.maximum(0, z)
        leaky = lambda z: np.where(z > 0, z, 0.01 * z)
        maxout = lambda x: np.maximum(w1.dot(x) + b1, w2.dot(x) + b2)
      `,
      codeTitle: 'activations.py',
      terms: [
        [String.raw`\sigma(z)`, 'squashes into $(0, 1)$. Flat for large positive or negative $z$'],
        [String.raw`\tanh(z)`, 'squashes into $(-1, 1)$: a stretched, shifted sigmoid, centered on zero'],
        [String.raw`\max(0, z)`, 'the Rectified Linear Unit: zero for negative inputs, the identity for positive ones'],
        [String.raw`\max(\alpha z, z)`, 'Leaky ReLU: like ReLU, but negative inputs keep a small slope $\\alpha$ (about 0.01) instead of going flat'],
        [String.raw`\mathrm{maxout}`, 'not a function of one sum: the neuron computes two linear functions of its input and keeps the larger'],
      ],
      explain: 'Notice that ReLU is the special case of Maxout with $w_1 = 0, b_1 = 0$, and Leaky ReLU is another special case. The explorer below plots each one with its slope, which is the number that backprop multiplies in.',
    });
    p.figure({
      title: 'Activation functions and their gradients',
      codeTitle: 'activation_gates.py',
      code: `
        z = {{z:1.5}}          # the neuron's input, w.x + b
        dout = 1.0             # gradient arriving from above

        # sigmoid
        out = 1 / (1 + np.exp(-z))               #@sigmoid
        dz = out * (1 - out) * dout              #@sigmoid
        # tanh
        out = np.tanh(z)                         #@tanh
        dz = (1 - out**2) * dout                 #@tanh
        # ReLU
        out = np.maximum(0, z)                   #@relu
        dz = (z > 0) * dout                      #@relu
        # Leaky ReLU
        out = np.where(z > 0, z, 0.01 * z)       #@leaky
        dz = np.where(z > 0, 1.0, 0.01) * dout   #@leaky
        # Maxout, two pieces of a 1-D input
        a1, a2 = 1.0 * z + 0.0, -0.4 * z - 0.6   #@maxout
        out = np.maximum(a1, a2)                 #@maxout
        dz = np.where(a1 >= a2, 1.0, -0.4) * dout   #@maxout

        # out = {{out}}   dz = {{dz}}
      `,
      setup(f) {
        type A = 'sigmoid' | 'tanh' | 'relu' | 'leaky' | 'maxout';
        let a: A = 'sigmoid';
        let z = 1.5;
        const F = (v: number) => (a === 'maxout' ? Math.max(v, -0.4 * v - 0.6) : act(a as Activation, v));
        const D = (v: number) => (a === 'maxout' ? (v >= -0.4 * v - 0.6 ? 1 : -0.4) : dact(a as Activation, v));
        const pl = f.plot({
          aspect: 1.3,
          square: false,
          domain: [-5, 5, -1.5, 2.6],
          draw: (pp) => {
            // shade where the slope is (nearly) zero: gradients die there
            const [x0, x1, y0, y1] = pp.view();
            const n = 200;
            pp.ctx.fillStyle = withAlpha(color('red'), 0.09);
            for (let i = 0; i < n; i++) {
              const v = x0 + ((i + 0.5) * (x1 - x0)) / n;
              if (Math.abs(D(v)) < 0.03) pp.ctx.fillRect(pp.sx(x0 + (i * (x1 - x0)) / n), 0, pp.len((x1 - x0) / n) + 1, pp.h);
            }
            pp.axes({ grid: 1, labels: true });
            if (a === 'maxout') {
              pp.fn((v) => v, withAlpha(color('--ink-3'), 0.9), 1.4, [5, 5]);
              pp.fn((v) => -0.4 * v - 0.6, withAlpha(color('--ink-3'), 0.9), 1.4, [5, 5]);
            }
            pp.fn(D, color('teal'), 2, [7, 4]);
            pp.fn(F, color('red'), 3);
            pp.path([z, z], [0, F(z)], withAlpha(color('--ink-3'), 0.8), 1, [3, 3]);
            pp.dot(z, F(z), 6, color('red'), color('--paper'));
            pp.dot(z, D(z), 5, color('teal'), color('--paper'));
            pp.text('f(z)', x0 + 0.2, y1 - 0.25, { color: color('red'), bold: true, size: 13 });
            pp.text('slope f′(z): what backprop multiplies in', x0 + 0.2, y1 - 0.85, { color: color('teal'), size: 11.5 });
            pp.text('shaded: slope ≈ 0, gradient dies', x1 - 0.15, y0 + 0.15, { color: color('red'), size: 11, align: 'right' });
          },
        });
        const outRo = f.readout('f(z)', { sym: 'f' });
        const dRo = f.readout('local gradient f′(z)', { sym: 'g' });
        const sync = () => {
          f.code.setMany({ out: fmt(F(z), 3), dz: fmt(D(z), 3) });
          outRo.set(fmt(F(z), 3));
          dRo.set(fmt(D(z), 3));
          f.code.highlight(a);
          pl.redraw();
        };
        const zs = f.slider({ label: 'z', min: -5, max: 5, step: 0.1, value: z, slot: 'z', onInput: (v) => { z = v; sync(); } });
        f.segmented({
          options: [
            { value: 'sigmoid', label: 'sigmoid' },
            { value: 'tanh', label: 'tanh' },
            { value: 'relu', label: 'ReLU' },
            { value: 'leaky', label: 'leaky' },
            { value: 'maxout', label: 'maxout' },
          ],
          value: 'sigmoid',
          onChange: (v) => { a = v as A; sync(); },
        });
        let drag = false;
        const setZ = (e: PointerEvent) => zs.set(Math.round(Math.max(-5, Math.min(5, pl.pointer(e)[0])) * 10) / 10);
        pl.canvas.addEventListener('pointerdown', (e) => { drag = true; pl.canvas.setPointerCapture(e.pointerId); setZ(e); });
        pl.canvas.addEventListener('pointermove', (e) => drag && setZ(e));
        pl.canvas.addEventListener('pointerup', () => (drag = false));
        sync();
      },
      caption: `Red is the activation, dashed teal is its slope, and the red shading marks inputs where the slope is essentially zero. **Drag** across the plot to move $z$. For the sigmoid, push $z$ to 5: the output barely changes, and the local gradient is 0.007, so whatever gradient arrives from above is cut to under 1%. Its slope is never larger than 0.25. Tanh has the same flat tails. ReLU has no flat tail on the right at all (slope exactly 1), but its whole left half is flat. Leaky ReLU keeps a sliver of slope there. Maxout, with these two example pieces, is never flat.`,
    });
    p.prose(`
### Sigmoid

The sigmoid was the classic choice, because its output looks like a firing rate between "not firing" (0) and "fully saturated" (1). It has fallen out of favor for two reasons.

**Saturated sigmoids kill gradients.** When a neuron's input is large and positive or large and negative, the sigmoid sits on one of its flat tails and its local gradient is almost zero. Backprop multiplies by that near-zero number, so almost no gradient reaches the weights below, and the network learns very slowly or not at all. This also makes initialization delicate: start the weights too large and most neurons begin life saturated.

**Sigmoid outputs are not zero-centered.** They are always positive. That matters for the *next* layer, whose inputs are then all positive:`);
    p.math({
      label: 'All-positive inputs make all weight gradients share one sign',
      tex: String.raw`\begin{aligned} f &= \textstyle\sum_i \sym{W}{w_i}\,\sym{x}{x_i} + \symb \\[2pt] \sym{g}{\frac{\partial L}{\partial w_i}} &= \sym{x}{x_i}\;\sym{g}{\frac{\partial L}{\partial f}} \end{aligned}`,
      code: `
        dout = -0.8                       # gradient on this neuron's sum
        x = np.array([0.9, 0.2, 0.6])     # sigmoid outputs: all positive
        dw = x * dout                     # [-0.72, -0.16, -0.48]: all negative
      `,
      codeTitle: 'same_sign.py',
      terms: [
        [String.raw`\sym{x}{x_i}`, 'the inputs, here outputs of sigmoids from the layer below, so all positive'],
        [String.raw`\sym{g}{\frac{\partial L}{\partial f}}`, 'one number: the gradient on this neuron\'s sum'],
      ],
      explain: 'Every weight gradient is a positive number times the same $\\partial L/\\partial f$, so on any one example they all have the same sign: the update can make every weight go up together or every weight go down together, but never some up and some down. Reaching a target that needs mixed signs takes an inefficient zig-zag. Summing gradients over a batch mixes the signs somewhat, so this is a nuisance rather than a disaster, but it is one more reason to prefer activations centered on zero.',
    });
    p.prose(`
### Tanh

Tanh squashes into $[-1, 1]$ instead of $[0, 1]$. It still saturates, but its output is zero-centered, so in practice tanh is always preferred over the sigmoid. (It is literally a rescaled sigmoid: $\\tanh(z) = 2\\sigma(2z) - 1$.)

### ReLU

The **Rectified Linear Unit**, $\\max(0, z)$, has become the default. On the plus side, it was found to speed up the convergence of stochastic gradient descent dramatically compared to sigmoid and tanh (Krizhevsky et al. 2012 reported a factor of about 6), which is usually credited to its linear, non-saturating positive half. It is also cheap: a comparison with zero instead of an exponential.

On the minus side, ReLU units can **die**. If a large gradient update pushes a unit's weights so that its input is negative for *every* example in the data, it outputs 0 everywhere, its local gradient is 0 everywhere, and no gradient will ever flow through it again: it is permanently off. With a learning rate that is too high, as much as 40% of a network can end up dead. A sensible learning rate makes this much less common.

### Leaky ReLU and friends

**Leaky ReLU** gives the negative side a small slope, such as 0.01, so a unit is never completely off. Some people report good results with it, though the benefit is not consistent. The **PReLU** of He et al. (2015) makes that slope a learned parameter.

### Maxout

**Maxout** (Goodfellow et al. 2013) drops the "dot product, then nonlinearity" form altogether: each neuron computes two linear functions and outputs the larger. It contains ReLU and Leaky ReLU as special cases, so it keeps their good properties (a linear regime, no saturation) without dying. The price is that every neuron has twice as many parameters.`);
    p.table(
      ['Activation', 'Output range', 'Zero-centered', 'Saturates', 'Notes'],
      [
        ['sigmoid', '(0, 1)', 'no', 'both tails', 'historical; avoid in hidden layers'],
        ['tanh', '(−1, 1)', 'yes', 'both tails', 'always better than sigmoid'],
        ['ReLU', '[0, ∞)', 'no', 'never on the right', 'fast and cheap; units can die'],
        ['Leaky ReLU', '(−∞, ∞)', 'roughly', 'never', 'fixes dying; mixed results'],
        ['Maxout', '(−∞, ∞)', 'roughly', 'never', 'no dying; doubles the parameters'],
      ],
    );
    p.callout('idea', `Use **ReLU**, be careful with the learning rate, and if you are worried, monitor what fraction of units are dead. If that becomes a problem, try **Leaky ReLU** or **Maxout**. Never use the sigmoid in hidden layers. Tanh is worth a try, but expect it to do worse than ReLU or Maxout.`, 'Which activation should I use?');

    p.h2('Layers', 'layers');
    p.prose(`
Neural networks are organized as **layers** of neurons. The outputs of one layer are the inputs of the next, and there are no cycles (that would make the forward pass loop forever; recurrent networks in Chapter 15 unroll their loops in time). The most common kind is the **fully-connected layer**: every neuron in it connects to every neuron in the layer before, while neurons within the same layer share no connections.

A few naming conventions:

- An **N-layer network does not count the input layer.** A "single-layer" network maps inputs straight to outputs, so logistic regression and the SVM are single-layer networks. A network with one hidden layer is a 2-layer network.
- These networks are also called *Artificial Neural Networks* (ANNs) or *Multi-Layer Perceptrons* (MLPs). Some people prefer "units" to "neurons".
- **The output layer usually has no activation function.** Its outputs are the class scores (any real numbers) or a real-valued target in regression, and squashing them would be pointless.`);
    p.figure({
      title: 'Counting neurons and parameters',
      codeTitle: 'count_params.py',
      code: `
        sizes = {{sizes:[3, 4, 2]}}
        layers = len(sizes) - 1        # {{L}}
        neurons = sum(sizes[1:])       # {{neurons}}
        weights = sum(n_in * n_out     # {{weights}}
                      for n_in, n_out in zip(sizes[:-1], sizes[1:]))
        biases = sum(sizes[1:])        # {{biases}}
        params = weights + biases      # {{params}}
      `,
      setup(f) {
        let sizes = [3, 4, 2];
        let sel = 1;
        const cv = f.canvas(640, 330, (ctx, w, h) => {
          drawNet(ctx, w, h, sizes, { sel });
        });
        cv.canvas.classList.add('scroll-ok');
        const sync = () => {
          let wts = 0;
          for (let l = 1; l < sizes.length; l++) wts += sizes[l - 1]! * sizes[l]!;
          const neurons = sizes.slice(1).reduce((a, b) => a + b, 0);
          f.code.setMany({ sizes: `[${sizes.join(', ')}]`, L: `${sizes.length - 1}-layer net`, neurons, weights: wts, biases: neurons, params: wts + neurons });
          f.status(`A **${sizes.length - 1}-layer** network: ${neurons} neurons, ${wts} weights and ${neurons} biases, so **${wts + neurons} learnable parameters**. Selected: the ${sel === 0 ? 'input layer' : sel === sizes.length - 1 ? 'output layer' : `hidden layer ${sel}`}.`);
          cv.redraw();
        };
        cv.canvas.addEventListener('click', (e) => {
          const r = cv.canvas.getBoundingClientRect();
          const x = e.clientX - r.left;
          const L = sizes.length;
          const padX = Math.max(34, r.width * 0.09);
          let best = 0;
          let bd = Infinity;
          for (let l = 0; l < L; l++) {
            const cx = L === 1 ? r.width / 2 : padX + (l * (r.width - 2 * padX)) / (L - 1);
            if (Math.abs(cx - x) < bd) {
              bd = Math.abs(cx - x);
              best = l;
            }
          }
          sel = best;
          sync();
        });
        const preset = f.segmented({
          label: 'examples',
          options: [
            { value: 'a', label: '[3, 4, 2]' },
            { value: 'b', label: '[3, 4, 4, 1]' },
            { value: 'c', label: 'custom' },
          ],
          value: 'a',
          onChange: (v) => {
            if (v === 'a') sizes = [3, 4, 2];
            else if (v === 'b') sizes = [3, 4, 4, 1];
            else return;
            sel = Math.min(sel, sizes.length - 1);
            sync();
          },
        });
        const custom = () => preset.set('c', false);
        f.button('+ neuron', () => { sizes[sel] = Math.min(8, sizes[sel]! + 1); custom(); sync(); });
        f.button('− neuron', () => { sizes[sel] = Math.max(1, sizes[sel]! - 1); custom(); sync(); });
        f.button('+ layer', () => {
          if (sizes.length >= 6) return;
          const at = Math.max(1, Math.min(sel + 1, sizes.length - 1));
          sizes.splice(at, 0, 4);
          sel = at;
          custom();
          sync();
        });
        f.button('− layer', () => {
          if (sizes.length <= 2) return;
          const at = sel === 0 || sel === sizes.length - 1 ? sizes.length - 2 : sel;
          sizes.splice(at, 1);
          sel = Math.min(at, sizes.length - 1);
          custom();
          sync();
        });
        sync();
      },
      caption: `**Tap a column** to select a layer, then add or remove neurons in it, or add and remove hidden layers. The layer count never includes the input. The two presets are the classic examples: $[3, 4, 2]$ has $4 + 2 = 6$ neurons, $3 \\cdot 4 + 4 \\cdot 2 = 20$ weights and 6 biases, for **26** parameters; $[3, 4, 4, 1]$ has 9 neurons, $12 + 16 + 4 = 32$ weights and 9 biases, for **41**. Every line in the diagram is one weight. For scale, the convolutional networks later in the course have on the order of 100 million parameters across 10 to 20 layers (and, thanks to weight sharing, far more connections than parameters).`,
    });
    p.math({
      label: 'Parameters in a fully-connected network',
      tex: String.raw`\#\text{params} = \sum_{l=1}^{L} \big(\underbrace{n_{l-1}\, n_l}_{\text{weights}} + \underbrace{n_l}_{\text{biases}}\big)`,
      code: `
        sizes = [3, 4, 4, 1]          # n_0 (input) ... n_L (output)
        params = sum(n_in * n_out + n_out
                     for n_in, n_out in zip(sizes[:-1], sizes[1:]))   # 41
      `,
      codeTitle: 'params.py',
      terms: [
        [String.raw`n_l`, 'the number of neurons in layer $l$; $n_0$ is the size of the input'],
        [String.raw`n_{l-1}\,n_l`, 'a full grid of connections between consecutive layers: one weight per pair'],
        [String.raw`n_l`, 'plus one bias per neuron'],
      ],
      explain: 'Count each layer as a matrix of weights plus a vector of biases, then add up the layers. The weight matrix of layer $l$ has $n_l$ rows (one per neuron) and $n_{l-1}$ columns (one per input).',
    });

    p.h2('The forward pass', 'forward');
    p.prose(`
Organizing neurons into layers has a big practical payoff: a whole layer is computed with **one matrix multiply**, plus a bias and the activation. Put the weights of all of layer 1's neurons into the rows of a matrix $\\sym{W}{W_1}$ and their biases into a vector $\\sym{b}{b_1}$, and the layer's output is $\\symf(\\sym{W}{W_1}\\symx + \\sym{b}{b_1})$. The full forward pass is that line repeated, layer after layer.`);
    p.math({
      label: 'One fully-connected layer',
      tex: String.raw`\sym{h}{h_1} = \symf\big(\sym{W}{W_1}\,\symx + \sym{b}{b_1}\big)`,
      code: `
        f = lambda z: 1.0 / (1.0 + np.exp(-z))    # activation (sigmoid here)
        h1 = f(np.dot(W1, x) + b1)
      `,
      codeTitle: 'layer.py',
      terms: [
        [String.raw`\sym{W}{W_1}`, 'one row of weights per neuron in the layer: shape (neurons, inputs)'],
        [String.raw`\sym{W}{W_1}\symx + \sym{b}{b_1}`, 'every neuron\'s weighted sum, all at once'],
        [String.raw`\symf(\cdot)`, 'the activation, applied to each entry separately'],
      ],
      explain: 'All neurons of a layer, in one line of NumPy. And if `x` holds a whole batch of examples as its columns, the same line evaluates all of them in parallel: the matrix multiply does every example at once.',
    });
    p.figure({
      title: 'A three-layer network, one layer at a time',
      codeTitle: 'forward.py',
      code: `
        f = lambda z: 1.0 / (1.0 + np.exp(-z))   # sigmoid
        # W1: (4, 3)  W2: (4, 4)  W3: (1, 4)
        x = np.array([{{x0}}, {{x1}}, {{x2}}])    # (3,)    #@in
        h1 = f(np.dot(W1, x) + b1)        # (4,)          #@l1
        h2 = f(np.dot(W2, h1) + b2)       # (4,)          #@l2
        scores = np.dot(W3, h2) + b3      # (1,)          #@l3
        # h1 = {{h1}}
        # h2 = {{h2}}
        # scores = {{s}}
      `,
      setup(f) {
        const sizes = [3, 4, 4, 1];
        const rng = new Rng(8);
        const Ws: number[][][] = [];
        const bs: number[][] = [];
        for (let l = 1; l < sizes.length; l++) {
          Ws.push(Array.from({ length: sizes[l]! }, () => Array.from({ length: sizes[l - 1]! }, () => Math.round(rng.randn() * 1.2 * 100) / 100)));
          bs.push(Array.from({ length: sizes[l]! }, () => Math.round(rng.randn() * 0.3 * 100) / 100));
        }
        let x = [0.5, -1.2, 0.8];
        let cur = 0;
        const layer = (l: number, inp: number[], last: boolean) =>
          Ws[l]!.map((row, i) => {
            const s = row.reduce((a, w, j) => a + w * inp[j]!, bs[l]![i]!);
            return last ? s : sig(s);
          });
        const vals = () => {
          const h1 = layer(0, x, false);
          const h2 = layer(1, h1, false);
          const s = layer(2, h2, true);
          return [x, h1, h2, s];
        };
        const cv = f.canvas(640, 420, (ctx, w, h) => {
          const v = vals();
          drawNet(ctx, w, h, sizes, { W: Ws, vals: v.map((a, l) => (l <= cur ? a : null)), lit: cur === 0 ? -1 : cur });
        });
        cv.canvas.classList.add('scroll-ok');
        const arr = (a: number[]) => `[${a.map((q) => fmt(q, 2)).join(', ')}]`;
        const sync = () => {
          const v = vals();
          f.code.setMany({
            x0: fmt(x[0]!, 2), x1: fmt(x[1]!, 2), x2: fmt(x[2]!, 2),
            h1: cur >= 1 ? arr(v[1]!) : '…', h2: cur >= 2 ? arr(v[2]!) : '…', s: cur >= 3 ? arr(v[3]!) : '…',
          });
          f.code.highlight(['in', 'l1', 'l2', 'l3'][cur]!);
          f.status([
            'The input: three numbers. Step forward to compute each layer.',
            'Layer 1: each of the 4 hidden neurons takes a weighted sum of the 3 inputs (the lit wires), adds its bias and squashes it with the sigmoid. One `np.dot` does all four.',
            'Layer 2: the same thing again, now reading the 4 outputs of layer 1.',
            'The output layer: a weighted sum and a bias, with **no** activation. That number is the score.',
          ][cur]!);
          cv.redraw();
        };
        f.stepper({ steps: 4, interval: 1300, label: (k) => ['input', 'layer 1', 'layer 2', 'output'][k]!, onStep: (k) => { cur = k; sync(); } });
        f.button('New input', () => {
          x = [0, 0, 0].map(() => Math.round(rng.uniform(-1.5, 1.5) * 10) / 10);
          sync();
        }, { icon: 'shuffle' });
      },
      caption: `Wire color is the sign of the weight (blue positive, red negative) and thickness its size; neuron fill shows how strongly each one is active. Step through the forward pass: each step is one line of code, and each line is a matrix multiply, a bias and the activation. Then try **New input**. The parameters that make this network useful are \`W1, b1, W2, b2, W3, b3\`, and learning them is what the rest of the course is about. (A batch of examples can be stored as the *columns* of \`x\`. Chapter 10 stores examples as *rows* instead and writes the same layer as \`X.dot(W) + b\`; both conventions are common.)`,
    });

    p.h2('Representational power', 'power');
    p.prose(`
A network with a fixed architecture is a whole *family* of functions, one for each setting of its weights. How rich is that family? Remarkably rich: a network with just **one hidden layer** can approximate any continuous function as closely as you like, given enough neurons. This is the **universal approximation** theorem (Cybenko, 1989, for sigmoid units).`);
    p.math({
      label: 'Universal approximation',
      tex: String.raw`\begin{aligned} & g(\symx) = \sum_{i=1}^{n} c_i\, \sigma(\sym{W}{w_i}\cdot\symx + \sym{b}{b_i}) \\[2pt] & \forall\, \varepsilon > 0 \;\; \exists\, g: \;\; |f(\symx) - g(\symx)| < \varepsilon \;\;\forall\,\symx \end{aligned}`,
      code: `
        # g: a 2-layer net with n sigmoid hidden units
        def g(x):
            hidden = sigmoid(W1.dot(x) + b1)    # (n,)
            return c.dot(hidden)                # one output
        # for any continuous f and tolerance eps, some n, W1, b1, c
        # make |f(x) - g(x)| < eps for every x (in a bounded region)
      `,
      codeTitle: 'universal.py',
      terms: [
        [String.raw`\forall\,\varepsilon > 0`, '"for every tolerance $\\varepsilon$", no matter how tiny'],
        [String.raw`g(\symx)`, 'a network with one hidden layer of $n$ sigmoid units and a linear output with weights $c_i$'],
        [String.raw`\exists\, g`, '"there exists" such a network (with enough hidden units)'],
        [String.raw`|f(\symx) - g(\symx)| < \varepsilon`, 'that stays within $\\varepsilon$ of the target $f$ at every input'],
      ],
      explain: 'The theorem promises the right weights *exist*. It says nothing about how many hidden units you will need (possibly an enormous number), or whether gradient descent will find those weights. The figure below builds such a network by hand, which shows why the statement is true and also why it is less impressive than it sounds.',
    });
    p.figure({
      title: 'One hidden layer can draw any curve',
      codeTitle: 'bumps.py',
      code: `
        sig = lambda z: 1 / (1 + np.exp(-z))
        target = lambda x: 0.5 + 0.3*np.sin(8*x) + 0.15*np.sin(25*x)

        n, k = {{n:6}}, {{k:60}}       # bumps, steepness
        edges = np.linspace(0, 1, n + 1)
        heights = target((edges[:-1] + edges[1:]) / 2)

        def g(x):                     # one hidden layer of 2n sigmoids
            up = sig(k * (x - edges[:-1]))     # steps up at each left edge
            down = sig(k * (x - edges[1:]))    # steps down at each right edge
            return heights.dot(up - down)      # output: weighted sum
        # hidden units: {{units}}   worst error: {{err}}
      `,
      setup(f) {
        const target = (x: number) => 0.5 + 0.3 * Math.sin(8 * x) + 0.15 * Math.sin(25 * x);
        let n = 6;
        let k = 60;
        let show = true;
        const edges = () => Array.from({ length: n + 1 }, (_, i) => i / n);
        const g = (x: number) => {
          const e = edges();
          let s = 0;
          for (let i = 0; i < n; i++) s += target((e[i]! + e[i + 1]!) / 2) * (sig(k * (x - e[i]!)) - sig(k * (x - e[i + 1]!)));
          return s;
        };
        const pl = f.plot({
          aspect: 1.35,
          square: false,
          domain: [-0.03, 1.03, -0.1, 1.15],
          draw: (pp) => {
            pp.axes({ grid: 0.25 });
            const e = edges();
            if (show && n <= 40) {
              for (let i = 0; i < n; i++) {
                const hgt = target((e[i]! + e[i + 1]!) / 2);
                pp.fn((x) => hgt * (sig(k * (x - e[i]!)) - sig(k * (x - e[i + 1]!))), withAlpha(color(CLASS_COLORS[i % 6]!), 0.55), 1.2);
              }
            }
            pp.fn(target, color('--ink'), 2, [6, 4]);
            pp.fn(g, color('purple'), 2.8);
            pp.text('target f(x)', 0.0, 1.08, { size: 12, color: color('--ink-2'), bold: true });
            pp.text('network g(x)', 0.3, 1.08, { size: 12, color: color('purple'), bold: true });
          },
        });
        const errRo = f.readout('worst error');
        const unitsRo = f.readout('hidden units', { sym: 'h' });
        const sync = () => {
          let err = 0;
          for (let i = 0; i <= 400; i++) err = Math.max(err, Math.abs(target(i / 400) - g(i / 400)));
          errRo.set(fmt(err, 3));
          unitsRo.set(2 * n);
          f.code.setMany({ units: 2 * n, err: fmt(err, 3) });
          pl.redraw();
        };
        f.slider({ label: 'bumps n', min: 1, max: 60, step: 1, value: n, slot: 'n', onInput: (v) => { n = v; sync(); } });
        f.slider({ label: 'steepness k', min: 1, max: 3, step: 0.05, value: Math.log10(60), map: (r) => Math.round(10 ** r), slot: 'k', onInput: (v) => { k = v; sync(); } });
        f.toggle({ label: 'show bumps', value: true, onChange: (v) => { show = v; pl.redraw(); } });
        sync();
      },
      caption: `Two steep sigmoids, one stepping up at $a$ and one stepping down at $b$, make a **bump** that is about 1 between $a$ and $b$ and about 0 elsewhere. Give each bump the target's height in the middle of its interval and add them up: that sum is a network with one hidden layer of $2n$ sigmoid units and a linear output. Slide **bumps** up and the staircase hugs the target ever more closely; with enough bumps and steepness the worst error goes as low as you like. That is the whole idea behind universal approximation.`,
    });
    p.prose(`
If one hidden layer can already represent anything, why build deeper networks? Because "can represent" is a weak promise. As the figure suggests, a plain sum of rectangular bumps is *also* a universal approximator, and nobody would use it for vision. What matters in practice is whether a network represents the functions we care about *compactly*, and whether gradient descent can actually *find* good weights. Deeper networks tend to win on both counts: the functions they express are smooth and fit the statistics of real data well, and they are comparatively easy to optimize.

Empirically, for fully-connected networks, three layers often beat two, but going deeper (four, five, six layers) rarely helps much more. Convolutional networks are a striking exception: there depth is crucial, and good image recognizers have on the order of 10 learnable layers or more. One intuition is that images are hierarchical (faces are made of eyes and noses, which are made of edges and blobs), so several layers of processing fit the data naturally.`);

    p.h2('How big should the network be?', 'capacity');
    p.prose(`
When a problem calls for a network, how many layers and how many neurons per layer? More neurons means more **capacity**: the set of functions the network can represent grows, because neurons can cooperate to express more complicated shapes. The figure trains a two-layer network live on a 2-D dataset. Change the size of its hidden layer and watch what happens to the decision boundary.`);
    p.figure({
      title: 'Capacity: a two-layer network with H hidden neurons',
      codeTitle: 'capacity.py',
      code: `
        H = {{H:8}}                                 # hidden neurons
        W1 = np.random.randn(2, H) * np.sqrt(2.0 / 2)
        b1 = np.zeros(H)
        W2 = np.random.randn(H, {{C:3}}) * np.sqrt(2.0 / H)
        b2 = np.zeros({{C}})

        for step in range(1500):                    # {{step}}
            h = {{act:np.maximum(0, X.dot(W1) + b1)}}     #@fwd
            scores = h.dot(W2) + b2                 #@fwd
            loss, grads = backprop(scores, h, X, y, reg=1e-3)   #@bwd
            adam_update([W1, b1, W2, b2], grads, lr=0.03)       #@upd
        # loss {{loss}}   training accuracy {{acc}}
      `,
      setup(f) {
        const sets: Record<string, () => Dataset2D> = { spiral: () => spiral(50, 3, 0.2), circles: () => circles(70), xor: () => xor(160) };
        let dsName = 'spiral';
        let d = sets[dsName]!();
        let H = 8;
        let actv: Activation = 'relu';
        let net = new MLP({ sizes: [2, H, d.classes], activation: actv, seed: 3 });
        let idx = Int32Array.from({ length: d.n }, (_, i) => i);
        const pl = f.plot({ aspect: 1.1, domain: [-1.1, 1.1, -1.1, 1.1], draw: (pp) => drawRegions(pp, net, d) });
        const stepRo = f.readout('step');
        const lossRo = f.readout('loss');
        const accRo = f.readout('accuracy');
        const deadRo = f.readout('dead ReLUs');
        const dead = () => {
          if (actv !== 'relu') return '–';
          const hidden: Float64Array[] = [];
          const alive = new Array(H).fill(false);
          for (let i = 0; i < d.n; i++) {
            hidden.length = 0;
            net.forward(d.X.subarray(2 * i, 2 * i + 2), hidden);
            hidden[0]!.forEach((v, j) => { if (v > 0) alive[j] = true; });
          }
          return `${alive.filter((a) => !a).length} of ${H}`;
        };
        const tr = trainer(f, {
          max: 1500,
          step: () => {
            const l = net.lossAndGrad(d.X, d.y, idx, { reg: 1e-3 });
            net.step(0.03, 'adam');
            return l;
          },
          onFrame: (loss, done) => {
            const a = `${Math.round(net.accuracy(d.X, d.y, d.n) * 100)}%`;
            f.code.setMany({ step: tr.steps, loss: fmt(loss, 3), acc: a });
            f.code.highlight(done ? null : ['fwd', 'bwd', 'upd'][tr.steps % 3]!);
            stepRo.set(tr.steps);
            lossRo.set(fmt(loss, 3));
            accRo.set(a);
            if (done) deadRo.set(dead());
            pl.redraw();
          },
        });
        const restart = () => {
          net = new MLP({ sizes: [2, H, d.classes], activation: actv, seed: 3 });
          tr.reset();
          deadRo.set('…');
          f.code.setMany({ H, C: d.classes, act: actv === 'relu' ? 'np.maximum(0, X.dot(W1) + b1)' : actv === 'tanh' ? 'np.tanh(X.dot(W1) + b1)' : 'sigmoid(X.dot(W1) + b1)' });
          tr.loop.start();
        };
        f.slider({ label: 'hidden neurons H', sym: 'h', min: 1, max: 50, step: 1, value: H, onInput: (v) => { H = v; restart(); } });
        f.segmented({
          label: 'activation',
          options: [
            { value: 'relu', label: 'ReLU' },
            { value: 'tanh', label: 'tanh' },
            { value: 'sigmoid', label: 'sigmoid' },
          ],
          value: 'relu',
          onChange: (v) => { actv = v as Activation; restart(); },
        });
        f.segmented({
          label: 'data',
          options: [
            { value: 'spiral', label: 'spiral' },
            { value: 'circles', label: 'circles' },
            { value: 'xor', label: 'xor' },
          ],
          value: 'spiral',
          onChange: (v) => {
            dsName = v;
            d = sets[v]!();
            idx = Int32Array.from({ length: d.n }, (_, i) => i);
            restart();
          },
        });
        f.button('Retrain', restart, { icon: 'reset' });
        f.code.setMany({ H, C: d.classes });
        restart();
      },
      caption: `Each change retrains from scratch (1,500 steps, starting from the same random seed). On the three-armed spiral, **1 or 2** hidden neurons can only cut the plane with a couple of straight creases, and accuracy stalls well short of 100%. Around **4 to 8** the boundary starts to wind along the arms, and by 10 or so it gets nearly every point right. A ReLU network's boundary is made of straight pieces, creased along the lines where hidden units switch on or off; tanh and sigmoid bend smoothly instead. Notice too that the sigmoid network learns more slowly, exactly as its flat tails predict. The weight updates use Adam, a refinement of gradient descent from Chapter 9, so that the demo converges in a few seconds.`,
    });
    p.prose(`
So bigger networks can represent more complicated functions. That sounds like a pure win, but it cuts both ways: with enough capacity a network can also fit the **noise** in its training data (a few mislabeled points, say) by carving out little islands around them. That is **overfitting**: excellent on the training data, worse on anything new. A small network, by contrast, can only classify in broad strokes, and simply ignores the odd point as an outlier.

It would be natural to conclude that small networks are the safe choice when the data is simple. **That conclusion is wrong**, for two reasons.

First, there are much better tools for preventing overfitting than shrinking the network: L2 regularization, dropout and input noise (Chapter 8). The figure at the end of this section shows L2 at work.

Second, and more subtly, small networks are *harder to train* with local methods like gradient descent. Their loss surfaces have relatively few local minima, but many of those minima are easy to fall into and *bad* (high loss). Big networks have many more local minima, but they turn out to be about equally good. So a small network's final loss depends a lot on the luck of its random initialization, while a big network gets a good answer almost every time. (This is hard to prove, since the loss is not a convex function, but there is theoretical work in this direction, such as Choromanska et al., "The Loss Surfaces of Multilayer Networks", 2014.) You can watch this happen:`);
    p.figure({
      title: 'Ten random restarts: small networks are a lottery',
      codeTitle: 'restarts.py',
      code: `
        for H in [3, 5, 8, 30]:
            final = []
            for seed in range(10):                       #@seed
                np.random.seed(seed)
                net = TwoLayerNet(input_size=2, hidden_size=H, classes=3)
                for step in range(800):
                    loss = net.train_step(X, y, reg=1e-3)    #@train
                final.append(loss)
            print(H, np.round(final, 2))
        # now: H = {{H}}, seed = {{seed}}, step {{step}}
      `,
      setup(f) {
        const d = spiral(40, 3, 0.2);
        const idx = Int32Array.from({ length: d.n }, (_, i) => i);
        const Hs = [3, 5, 8, 30];
        const results: number[][] = Hs.map(() => []);
        let hi = 0;
        let seed = 1;
        let step = 0;
        let cur: MLP | null = null;
        let curLoss = NaN;
        const pl = f.plot({
          aspect: 1.5,
          square: false,
          domain: [0.15, 1.04, -0.6, 3.6],
          draw: (pp) => {
            const [x0, x1] = pp.view();
            for (let r = 0; r < Hs.length; r++) {
              const yv = 3 - r;
              pp.path([x0, x1], [yv, yv], color('--grid'), 1);
              pp.text(`H = ${Hs[r]}`, x0 + 0.01, yv + 0.3, { size: 12, bold: true, color: color('--ink-2') });
              results[r]!.forEach((l) => pp.dot(l, yv, 6, withAlpha(color(CLASS_COLORS[r]!), 0.75), color('--paper')));
              if (r === hi && cur && Number.isFinite(curLoss)) pp.dot(Math.min(x1 - 0.01, curLoss), yv, 6, 'transparent', color(CLASS_COLORS[r]!));
            }
            for (let v = 0.2; v <= 1.0001; v += 0.1) pp.text(v.toFixed(1), v, -0.45, { size: 11, mono: true, align: 'center', color: color('--ink-3') });
            pp.text('final training loss →', x1 - 0.01, -0.2, { size: 11, align: 'right', color: color('--ink-3') });
          },
        });
        const run = f.loop(() => {
          const t0 = performance.now();
          while (performance.now() - t0 < 7) {
            if (hi >= Hs.length) break;
            if (!cur) {
              cur = new MLP({ sizes: [2, Hs[hi]!, 3], activation: 'relu', seed });
              step = 0;
            }
            curLoss = cur.lossAndGrad(d.X, d.y, idx, { reg: 1e-3 });
            cur.step(0.03, 'adam');
            step++;
            if (step >= 800) {
              results[hi]!.push(curLoss);
              cur = null;
              seed++;
              if (seed > 10) {
                seed = 1;
                hi++;
              }
            }
          }
          f.code.setMany({ H: Hs[Math.min(hi, Hs.length - 1)]!, seed: Math.min(seed, 10) - 1, step });
          f.code.highlight(hi >= Hs.length ? null : ['seed', 'train'][step % 2]!);
          pl.redraw();
          if (hi >= Hs.length) {
            btn.textContent = 'Run again';
            f.status('Done. Each dot is one network trained from a different random start.');
            return false;
          }
        });
        const btn = f.button('Run 40 trainings', () => {
          if (run.running()) {
            run.stop();
            btn.textContent = 'Resume';
            return;
          }
          if (hi >= Hs.length) {
            results.forEach((r) => (r.length = 0));
            hi = 0;
            seed = 1;
          }
          f.status('');
          btn.textContent = 'Pause';
          run.start();
        }, { primary: true });
        f.status('Press the button to train ten networks of each size on the spiral (about 10 seconds).');
      },
      caption: `Each dot is the final training loss of one network, trained for 800 steps from a different random initialization. With **3** hidden neurons the results are scattered: some starts find a decent solution, others get stuck at a much worse one. As the network grows the dots pull together, and with **30** hidden neurons all ten land at essentially the same low loss. The big network does not depend on luck.`,
    });
    p.prose(`
And here is the right way to control overfitting: keep the big network and turn up the regularization. The data below is a disc of one class inside the other, but 12% of the training labels have been flipped at random, so a perfect fit to the training set is a *bad* fit to reality. A second, larger set of held-out points measures how well each network really generalizes.`);
    p.figure({
      title: 'A big network, tamed by regularization',
      codeTitle: 'regularize.py',
      code: `
        reg = {{reg:0.0001}}
        # 50 hidden ReLUs, same random start every time
        for step in range(4000):                     # {{step}}
            h = np.maximum(0, X.dot(W1) + b1)            #@fwd
            scores = h.dot(W2) + b2                      #@fwd
            data_loss, dscores = softmax_loss(scores, y)             #@loss
            reg_loss = 0.5 * reg * (np.sum(W1**2) + np.sum(W2**2))   #@loss
            grads = backprop(dscores, h, X, W1, W2, reg)  #@bwd
            adam_update([W1, b1, W2, b2], grads, lr=0.02) #@bwd
        # train accuracy {{tr}}   held-out accuracy {{te}}
      `,
      setup(f) {
        const d = noisyDisc(80, 1, 0.12);
        const test = noisyDisc(400, 2, 0.12);
        const idx = Int32Array.from({ length: d.n }, (_, i) => i);
        let reg = 0.0001;
        let showTest = false;
        let net = new MLP({ sizes: [2, 50, 2], activation: 'relu', seed: 5 });
        const pl = f.plot({ aspect: 1.1, domain: [-1.05, 1.05, -1.05, 1.05], draw: (pp) => {
          drawRegions(pp, net, d, { faint: showTest ? test : undefined });
          pp.path(Array.from({ length: 65 }, (_, i) => Math.sqrt(0.42) * Math.cos((i / 64) * Math.PI * 2)), Array.from({ length: 65 }, (_, i) => Math.sqrt(0.42) * Math.sin((i / 64) * Math.PI * 2)), withAlpha(color('--ink'), 0.5), 1.2, [4, 5]);
        } });
        const trRo = f.readout('train acc');
        const teRo = f.readout('held-out acc');
        const tr = trainer(f, {
          max: 4000,
          step: () => {
            const l = net.lossAndGrad(d.X, d.y, idx, { reg });
            net.step(0.02, 'adam');
            return l;
          },
          onFrame: (_loss, done) => {
            const a = `${Math.round(net.accuracy(d.X, d.y, d.n) * 100)}%`;
            const b = `${Math.round(net.accuracy(test.X, test.y, test.n) * 100)}%`;
            f.code.setMany({ step: tr.steps, tr: a, te: b });
            f.code.highlight(done ? null : ['fwd', 'loss', 'bwd'][tr.steps % 3]!);
            trRo.set(a);
            teRo.set(b);
            pl.redraw();
          },
        });
        const restart = () => {
          net = new MLP({ sizes: [2, 50, 2], activation: 'relu', seed: 5 });
          tr.reset();
          tr.loop.start();
        };
        f.slider({ label: 'λ', sym: 'lam', min: -4, max: -0.5, step: 0.1, value: -4, map: (r) => 10 ** r, format: (v) => fmt(v, 2), slot: 'reg', onInput: (v) => { reg = v; restart(); } });
        f.toggle({ label: 'show held-out points', value: false, onChange: (v) => { showTest = v; pl.redraw(); } });
        f.button('Retrain', restart, { icon: 'reset' });
        restart();
      },
      caption: `The dashed circle is the true boundary. With almost no regularization ($\\lambda$ near 0.0001) the 50-neuron network wraps little islands around the mislabeled points: training accuracy climbs toward 100% while held-out accuracy drops. Around $\\lambda = 0.01$ the islands melt away and the boundary settles closer to the true circle; the training accuracy falls (it no longer memorizes the noise) while the held-out accuracy improves by a few points. (No classifier can beat about 88% here, since 12% of the labels are wrong.) Push $\\lambda$ much higher and the network can no longer fit even the circle: that is *under*fitting. Same network every time; only the regularization changed.`,
    });
    p.callout('idea', `Do not use a smaller network because you are afraid of overfitting. Use as big a network as your computational budget allows, and control overfitting with regularization (L2, dropout, input noise), tuned on validation data.`, 'The practical rule');

    p.h2('Summary', 'summary');
    p.prose(`
- A neural network is a stack of **layers**: matrix multiply, bias, nonlinearity, repeated. Without the nonlinearity, any stack collapses to a single linear classifier.
- The brain analogy is where the name and the "neuron" vocabulary come from, but the model is a coarse cartoon of real neurons.
- A single neuron is a linear classifier: logistic regression with a sigmoid and cross-entropy, or a binary SVM with a hinge loss.
- **ReLU** is the default activation. Sigmoids saturate (killing gradients) and are not zero-centered; tanh fixes only the second problem. Leaky ReLU and Maxout avoid dying units.
- An N-layer network does not count its input layer; the output layer has no activation. Parameters are counted layer by layer as weights plus biases.
- One hidden layer is already a universal approximator, but depth tends to help in practice, and for ConvNets it is essential.
- Prefer big networks with strong regularization over small networks.`);
    p.callout('idea', `A neural network replaces the single matrix multiply of a linear classifier with a chain of them, separated by a simple element-wise nonlinearity such as $\\max(0, z)$. Each layer is one line of NumPy, the whole forward pass is a handful of lines, and backpropagation trains every weight in the chain. Capacity grows with width and depth, and the right way to use that capacity is a big network, kept honest by regularization.`, 'Takeaways');
  },
};

export default chapter;

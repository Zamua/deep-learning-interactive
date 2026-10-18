import type { ChapterDef } from './index';
import type { Fig } from '../core/page';
import { fmt } from '../core/code';
import { spiral } from '../core/data';
import { CLASS_COLORS, Plot, color, rgbOf, withAlpha } from '../core/plot';
import type { Color } from '../core/symbols';
import { type Mat, SoftmaxClassifier, TwoLayerNet, accuracy } from '../lib/case-study-np';

const STEP_SIZE = 1.0;
const REG = 1e-3;

interface Model {
  predict(a: number, b: number): number;
}

/** The case-study data: 100 points per class, 3 classes, as an (N*K, 2) matrix. */
function caseData() {
  const d = spiral(100, 3, 0.2, 3);
  const X: Mat = { r: d.n, c: 2, d: d.X };
  return { d, X, y: d.y };
}

function drawPoints(pp: Plot, X: Mat, y: ArrayLike<number>, model?: Model, r = 3.6) {
  for (let i = 0; i < X.r; i++) {
    const a = X.d[2 * i]!, b = X.d[2 * i + 1]!;
    const k = y[i]!;
    const wrong = model ? model.predict(a, b) !== k : false;
    pp.dot(a, b, wrong ? r + 0.8 : r, color(CLASS_COLORS[k]!), wrong ? color('--ink') : withAlpha(color('--paper'), 0.85));
  }
}

function drawRegions(pp: Plot, model: Model, K: number, cell = 6) {
  const cols = CLASS_COLORS.slice(0, K).map((c) => rgbOf(color(c)));
  pp.field((a, b) => {
    const [r, g, bl] = cols[model.predict(a, b)]!;
    return [r, g, bl, 48];
  }, cell);
}

/** A small loss-versus-iteration chart. */
function lossChart(f: Fig, losses: number[], maxIt: number, every: number) {
  return f.plot({
    height: 120,
    square: false,
    domain: [0, maxIt, 0, 1.2],
    draw: (pl) => {
      pl.axes({ grid: maxIt / 4 });
      for (const v of [0.4, 0.8]) pl.text(String(v), maxIt * 0.005, v + 0.03, { size: 11, mono: true, color: color('--ink-3') });
      if (losses.length > 1) pl.path(losses.map((_, i) => i * every), losses, color('red'), 2);
      pl.ctx.fillStyle = color('red');
      pl.ctx.font = '11.5px system-ui, sans-serif';
      pl.ctx.textAlign = 'right';
      pl.ctx.fillText('loss', pl.w - 8, 15);
      pl.ctx.fillStyle = color('--ink-3');
      pl.ctx.fillText(`iterations 0 to ${maxIt.toLocaleString('en-US')}`, pl.w - 8, pl.h - 6);
    },
  });
}

const chapter: ChapterDef = {
  symbols: {
    X: { color: 'orange', name: 'X: the data, one row per point (N·K rows, D = 2 columns)', code: ['X'] },
    y: { color: 'gold', name: 'y: the correct class of each point', code: ['y'] },
    W: { color: 'blue', name: 'W, W2: weights (first and second layer)', code: ['W', 'W2'] },
    b: { color: 'green', name: 'b, b2: biases', code: ['b', 'b2'] },
    s: { color: 'purple', name: 's: class scores, one row per point', code: ['scores'] },
    L: { color: 'red', name: 'L: the loss', code: ['loss', 'data_loss', 'reg_loss'] },
    g: { color: 'teal', tex: '\\nabla', name: 'gradients of the loss (dscores, dW, db, ...)', code: ['dscores', 'dW', 'db', 'dW2', 'db2', 'dhidden'] },
    hp: { color: 'slate', tex: '\\lambda', name: 'hyperparameters: reg (λ) and step_size, chosen by us', code: ['reg', 'step_size'] },
  },

  render(p) {
    p.prose(`
Everything from the last few chapters fits in about forty lines of NumPy. This chapter writes those lines, and runs them live. First we train a **softmax linear classifier** on a toy 2-D dataset, and watch it fail in an instructive way. Then we change a handful of lines to turn it into a **two-layer neural network**, and watch it succeed.

Two dimensions are the point. With 3072-dimensional images we can only stare at a loss curve; with points in a plane we can *see* the decision boundary each model learns. All the code below is meant to be read together as one script.`);

    p.h2('The data: a spiral', 'data');
    p.prose(`
The dataset is made to be hard for a linear classifier: $K$ classes laid out as the arms of a spiral, $N$ points each, every point a pair of coordinates ($D = 2$). Each arm sweeps out four radians while its radius grows from 0 to 1, and a little noise is added to the angle.`);
    p.math({
      label: 'Point i of spiral arm j',
      tex: String.raw`\begin{aligned} r_i &= \tfrac{i}{N-1} \\[2pt] t_i &= 4j + \tfrac{4i}{N-1} + 0.2\,\epsilon_i \\[2pt] \sym{X}{x_i} &= \big(r_i \sin t_i,\; r_i \cos t_i\big) \end{aligned}`,
      code: `
        r = np.linspace(0.0, 1, N)                       # radius
        t = np.linspace(j * 4, (j + 1) * 4, N) + np.random.randn(N) * 0.2
        X[ix] = np.c_[r * np.sin(t), r * np.cos(t)]      # (N, 2)
      `,
      terms: [
        [String.raw`r_i`, 'the distance from the center, growing evenly from 0 to 1 along the arm'],
        [String.raw`t_i`, 'the angle: arm $j$ starts at $4j$ radians and sweeps another 4. $\\epsilon_i$ is random noise from a standard normal distribution'],
        [String.raw`(r\sin t,\; r\cos t)`, 'turn a distance and an angle into the two coordinates of a point'],
      ],
      explain: 'Polar coordinates: walk out from the center while turning. Because each arm starts 4 radians (about 230 degrees) after the previous one, the arms wind around each other, and no straight line can separate them. Real data would usually be preprocessed to zero mean and unit variance first; these points already lie between $-1$ and $1$, so we skip that.',
    });
    p.figure({
      title: 'Generating the spiral',
      codeTitle: 'spiral.py',
      code: `
        N = {{N:100}}    # points per class
        D = 2            # dimensionality
        K = {{K:3}}      # number of classes
        X = np.zeros((N * K, D))             # one row per example
        y = np.zeros(N * K, dtype='uint8')   # class labels
        for j in range(K):                                   #@loop
            ix = range(N * j, N * (j + 1))                   #@loop
            r = np.linspace(0.0, 1, N)                       #@arm
            t = np.linspace(j * 4, (j + 1) * 4, N) + np.random.randn(N) * 0.2   #@arm
            X[ix] = np.c_[r * np.sin(t), r * np.cos(t)]      #@arm
            y[ix] = j                                        #@lab
        # X.shape = {{shape}}   arm j = {{j}}
      `,
      setup(f) {
        let N = 100;
        let K = 3;
        let d = spiral(N, K, 0.2, 3);
        let shown = Infinity;
        const pl = f.plot({
          aspect: 1.1,
          domain: [-1.1, 1.1, -1.1, 1.1],
          draw: (pp) => {
            pp.axes({ grid: 0.5, labels: true });
            for (let i = 0; i < d.n; i++) {
              const j = d.y[i]!;
              const k = i - j * N;
              const visible = j * N + k < shown;
              if (!visible) continue;
              pp.dot(d.X[2 * i]!, d.X[2 * i + 1]!, N > 120 ? 3 : 4, color(CLASS_COLORS[j % 8]!), withAlpha(color('--paper'), 0.85));
            }
          },
        });
        const regen = () => {
          d = spiral(N, K, 0.2, 3);
          f.code.setMany({ shape: `(${N * K}, 2)` });
          pl.redraw();
        };
        let t = 0;
        const anim = f.loop((dt) => {
          t += dt;
          shown = Math.floor(t * N * 1.6);
          const j = Math.min(K - 1, Math.floor(shown / N));
          f.code.set('j', j);
          f.code.highlight(shown % N < N * 0.15 ? 'loop' : 'arm');
          pl.redraw();
          if (shown >= N * K) {
            shown = Infinity;
            f.code.highlight('lab');
            return false;
          }
        });
        f.slider({ label: 'N per class', min: 5, max: 200, step: 5, value: N, slot: 'N', onInput: (v) => { N = v; shown = Infinity; anim.stop(); regen(); } });
        f.slider({ label: 'K classes', min: 2, max: 6, step: 1, value: K, slot: 'K', onInput: (v) => { K = v; shown = Infinity; anim.stop(); regen(); } });
        f.button('Replay', () => { t = 0; shown = 0; anim.start(); }, { icon: 'play' });
        regen();
      },
      caption: `Press **Replay** to watch the loop build the data one arm at a time: each pass through the loop fills in $N$ rows of \`X\` and sets their labels in \`y\` to $j$. Change $K$ to see more arms; with 5 or 6 they start to overlap. The rest of the chapter uses the default: $N = 100$, $K = 3$, so \`X\` has 300 rows.`,
    });

    p.h2('Training a softmax linear classifier', 'softmax');
    p.prose(`
### Initialize the parameters

A linear classifier has a weight matrix $\\symW$ of shape \`(D, K)\` and a bias vector $\\symb$ of shape \`(1, K)\`. Small random weights and zero biases are a fine start:`);
    p.code(`
      W = 0.01 * np.random.randn(D, K)    # (2, 3)
      b = np.zeros((1, K))                # (1, 3)
    `, { title: 'init_linear.py' });
    p.prose(`
### Compute the class scores

Storing examples as **rows** of \`X\` (as this script does), the scores for every example come from one matrix multiply:`);
    p.math({
      label: 'Class scores for every example at once',
      tex: String.raw`\underbrace{\syms}_{300 \times 3} = \underbrace{\symX}_{300 \times 2}\;\underbrace{\symW}_{2 \times 3} + \underbrace{\symb}_{1 \times 3}`,
      code: `
        scores = np.dot(X, W) + b     # (300, 3)
      `,
      terms: [
        [String.raw`\symX\,\symW`, 'row $i$ of the result is example $i$ dotted with each column of `W`: three scores'],
        [String.raw`+\,\symb`, 'the same bias row is added to every row: NumPy *broadcasting* stretches the `(1, 3)` row down all 300'],
      ],
      explain: 'This is the score function of Chapter 4, written with examples as rows instead of columns, which is why it reads `X.dot(W)` instead of `W.dot(x)`. Each of the 300 rows holds three numbers, one score per class.',
    });
    p.prose(`
### Compute the loss

We use the softmax (cross-entropy) loss from Chapter 4, averaged over the examples, plus L2 regularization:`);
    p.math({
      label: 'Softmax loss plus regularization',
      tex: String.raw`\begin{aligned} \symL = {} & \frac{1}{N}\sum_i -\log\frac{e^{\syms_{\symy_i}}}{\sum_j e^{\syms_j}} \\[2pt] & + \tfrac{1}{2}\symhp \sum_{k,l} \symW_{k,l}^{2} \end{aligned}`,
      code: `
        num_examples = X.shape[0]
        exp_scores = np.exp(scores)
        probs = exp_scores / np.sum(exp_scores, axis=1, keepdims=True)
        correct_logprobs = -np.log(probs[range(num_examples), y])
        data_loss = np.sum(correct_logprobs) / num_examples
        reg_loss = 0.5 * reg * np.sum(W * W)
        loss = data_loss + reg_loss
      `,
      codeTitle: 'loss.py',
      terms: [
        [String.raw`\frac{e^{\syms_{\symy_i}}}{\sum_j e^{\syms_j}}`, 'the softmax probability of the correct class for example $i$: `probs[i, y[i]]`'],
        [String.raw`-\log(\cdot)`, 'its negative log: 0 if that probability is 1, large if it is small'],
        [String.raw`\frac{1}{N}\sum_i`, 'averaged over all $N$ examples (here $N$ means all 300)'],
        [String.raw`\tfrac{1}{2}\symhp\sum \symW^2`, 'L2 regularization with strength `reg`; the $\\tfrac12$ makes its gradient come out as simply `reg * W`'],
      ],
      explain: 'The indexing `probs[range(num_examples), y]` picks, from each row, the one entry in the column of that example\'s correct class: 300 numbers. At the start, with tiny random weights, every class gets probability about 1/3, so every term is $-\\log(1/3) \\approx 1.0986$, and that is what the first loss should be. Checking that number is a cheap and useful sanity test.',
    });
    p.prose(`
### Compute the gradient with backpropagation

We want the gradient of the loss with respect to $\\symW$ and $\\symb$. Following Chapter 6, start at the loss and work backward, and the first stop is the scores. The softmax loss has a beautifully simple gradient there:`);
    p.math({
      label: 'Gradient of the softmax loss on the scores',
      tex: String.raw`\frac{\partial \symL_i}{\partial \syms_k} = p_k - \mathbb{1}(\symy_i = k)`,
      code: `
        dscores = probs.copy()
        dscores[range(num_examples), y] -= 1
        dscores /= num_examples       # the loss is an average over examples
      `,
      codeTitle: 'dscores.py',
      terms: [
        [String.raw`p_k`, 'the probability the classifier currently gives class $k$'],
        [String.raw`\mathbb{1}(\symy_i = k)`, '1 for the correct class, 0 for the others'],
        [String.raw`p_k - \mathbb{1}(\cdot)`, 'so: the probability itself for wrong classes, and the probability minus 1 for the correct class'],
      ],
      explain: 'Read it as advice. Suppose the probabilities are $[0.2, 0.3, 0.5]$ and the middle class is correct. The gradient on the scores is $[0.2, -0.7, 0.5]$. A positive entry says "raising this score raises the loss", so wrong classes get pushed down, harder the more probability they hold. The correct class gets a negative entry: raising its score lowers the loss. The final division by `num_examples` is there because the loss is an average.',
    });
    p.prose(`
Now backpropagate into $\\symW$ and $\\symb$. The scores were \`np.dot(X, W) + b\`, a matrix multiply plus a broadcast add, so the rules of Chapter 6 apply directly: the gradient on \`W\` is \`X.T\` times the gradient on the scores (check the shapes: $(2 \\times 300)(300 \\times 3) = 2 \\times 3$), and since \`b\` was added to every row, its gradient is the sum of \`dscores\` down the rows. Regularization adds its own term.`);
    p.math({
      label: 'Backprop into the weights and biases',
      tex: String.raw`\begin{aligned} \frac{\partial \symL}{\partial \symW} &= \symX^{\top}\,\sym{g}{\frac{\partial \symL}{\partial \syms}} + \symhp\,\symW \\[3pt] \frac{\partial \symL}{\partial \symb} &= \sum_i \sym{g}{\frac{\partial \symL}{\partial \syms_i}} \end{aligned}`,
      code: `
        dW = np.dot(X.T, dscores)                     # (2, 300) x (300, 3)
        db = np.sum(dscores, axis=0, keepdims=True)   # (1, 3)
        dW += reg * W                  # gradient of 0.5 * reg * sum(W * W)
      `,
      codeTitle: 'backprop_linear.py',
      terms: [
        [String.raw`\symX^{\top}\,\partial\symL/\partial\syms`, 'the matrix-multiply rule: gradient on `W` is the input, transposed, times the upstream gradient'],
        [String.raw`\symhp\,\symW`, 'the gradient of the regularization term'],
        [String.raw`\sum_i`, 'the bias reached every example, so the gradients from all examples add up (gradients add at forks)'],
      ],
      explain: 'Two lines of real work. Notice how little calculus was needed: the softmax gradient on the scores, then the matrix-multiply rule from the last chapter, with dimension analysis to place the transpose.',
    });
    p.prose(`
### Update the parameters

Finally, step downhill: move every parameter a little in the direction opposite its gradient.`);
    p.math({
      label: 'The parameter update',
      tex: String.raw`\symW \leftarrow \symW - \eta\,\sym{g}{\frac{\partial \symL}{\partial \symW}}, \qquad \symb \leftarrow \symb - \eta\,\sym{g}{\frac{\partial \symL}{\partial \symb}}`,
      code: `
        W += -step_size * dW
        b += -step_size * db
      `,
      terms: [
        [String.raw`\eta`, 'the step size (learning rate), `step_size` in code'],
        [String.raw`-\,\eta\,\partial\symL/\partial\symW`, 'a small step against the gradient, which is the direction that lowers the loss fastest'],
      ],
      explain: 'This is vanilla gradient descent from Chapter 5. On this tiny problem we can use the whole dataset for every step (no mini-batches) and a step size of 1.',
    });
    p.prose(`
### One iteration, line by line

Here is a single complete iteration, from scores to update, with the actual arrays. The table follows three example rows, one from the middle of each arm (rows 60, 160 and 260).`);
    p.figure({
      title: 'One training iteration, one line at a time',
      layout: 'stack',
      codeTitle: 'one_iteration.py',
      code: `
        # iteration {{it:0}}
        scores = np.dot(X, W) + b                                     #@s1
        exp_scores = np.exp(scores)                                   #@s2
        probs = exp_scores / np.sum(exp_scores, axis=1, keepdims=True)  #@s3
        correct_logprobs = -np.log(probs[range(num_examples), y])     #@s4
        data_loss = np.sum(correct_logprobs) / num_examples  # {{dl}}  #@s5
        reg_loss = 0.5 * reg * np.sum(W * W)                 # {{rl}}  #@s6
        loss = data_loss + reg_loss                          # {{loss}}  #@s7

        dscores = probs.copy()                                        #@s8
        dscores[range(num_examples), y] -= 1                          #@s9
        dscores /= num_examples                                       #@s10
        dW = np.dot(X.T, dscores)                                     #@s11
        db = np.sum(dscores, axis=0, keepdims=True)                   #@s12
        dW += reg * W                                                 #@s13
        W += -step_size * dW                                          #@s14
        b += -step_size * db                                          #@s15
      `,
      setup(f) {
        const { X, y } = caseData();
        const N = X.r;
        const rows = [60, 160, 260];
        const model = new SoftmaxClassifier(2, 3, 1);
        let it = 0;
        let cur = 0;
        let Wold = Float64Array.from(model.W.d);
        let bold = Float64Array.from(model.b.d);
        const refresh = () => {
          Wold = Float64Array.from(model.W.d);
          bold = Float64Array.from(model.b.d);
          model.step(X, y, REG, STEP_SIZE, false);
        };
        refresh();
        type View =
          | { kind: 'rows'; name: string; sym: string; shape: string; cols: number; get: (i: number, k: number) => number; mark?: (i: number, k: number) => boolean; note: string }
          | { kind: 'scalar'; name: string; sym: string; value: () => number; note: string }
          | { kind: 'mat'; name: string; sym: string; shape: string; r: number; c: number; get: (i: number, k: number) => number; prev?: (i: number, k: number) => number; note: string };
        const at = (m: Mat, i: number, k: number) => m.d[i * m.c + k]!;
        const dsAt = (stage: number) => (i: number, k: number) => {
          let v = at(model.probs, i, k);
          if (stage >= 9 && y[i] === k) v -= 1;
          if (stage >= 10) v /= N;
          return v;
        };
        const dWraw = (i: number, k: number) => at(model.dW, i, k) - REG * Wold[i * 3 + k]!;
        const views: View[] = [
          { kind: 'mat', name: 'W', sym: 'W', shape: '(2, 3)', r: 2, c: 3, get: (i, k) => Wold[i * 3 + k]!, note: 'The parameters going into this iteration. Step forward to run it.' },
          { kind: 'rows', name: 'scores', sym: 's', shape: '(300, 3)', cols: 3, get: (i, k) => at(model.scores, i, k), mark: (i, k) => y[i] === k, note: 'One row of three class scores per example. The correct class of each row is outlined.' },
          { kind: 'rows', name: 'exp_scores', sym: '', shape: '(300, 3)', cols: 3, get: (i, k) => at(model.exp_scores, i, k), mark: (i, k) => y[i] === k, note: 'Exponentiate every score: all positive now.' },
          { kind: 'rows', name: 'probs', sym: '', shape: '(300, 3)', cols: 3, get: (i, k) => at(model.probs, i, k), mark: (i, k) => y[i] === k, note: 'Divide each row by its sum: every row now adds up to 1.' },
          { kind: 'rows', name: 'correct_logprobs', sym: '', shape: '(300,)', cols: 1, get: (i) => model.correct_logprobs[i]!, note: 'Pick the correct class from each row and take minus its log.' },
          { kind: 'scalar', name: 'data_loss', sym: 'L', value: () => model.data_loss, note: 'The average over all 300 rows.' },
          { kind: 'scalar', name: 'reg_loss', sym: 'L', value: () => model.reg_loss, note: 'The weights are still tiny, so the regularization penalty is too.' },
          { kind: 'scalar', name: 'loss', sym: 'L', value: () => model.loss, note: 'The number gradient descent is trying to shrink. The forward pass is done.' },
          { kind: 'rows', name: 'dscores', sym: 'g', shape: '(300, 3)', cols: 3, get: dsAt(8), mark: (i, k) => y[i] === k, note: 'Backward pass. Start from a copy of the probabilities...' },
          { kind: 'rows', name: 'dscores', sym: 'g', shape: '(300, 3)', cols: 3, get: dsAt(9), mark: (i, k) => y[i] === k, note: '...subtract 1 at each correct class: those entries turn negative ("push this score up")...' },
          { kind: 'rows', name: 'dscores', sym: 'g', shape: '(300, 3)', cols: 3, get: dsAt(10), mark: (i, k) => y[i] === k, note: '...and divide by the number of examples, since the loss is an average.' },
          { kind: 'mat', name: 'dW', sym: 'g', shape: '(2, 3)', r: 2, c: 3, get: dWraw, note: 'X.T (2 × 300) times dscores (300 × 3): every example\'s gradient, weighted by its coordinates and summed.' },
          { kind: 'mat', name: 'db', sym: 'g', shape: '(1, 3)', r: 1, c: 3, get: (_i, k) => at(model.db, 0, k), note: 'Sum dscores down the rows.' },
          { kind: 'mat', name: 'dW', sym: 'g', shape: '(2, 3)', r: 2, c: 3, get: (i, k) => at(model.dW, i, k), note: 'Add the regularization gradient reg * W.' },
          { kind: 'mat', name: 'W', sym: 'W', shape: '(2, 3)', r: 2, c: 3, get: (i, k) => Wold[i * 3 + k]! - STEP_SIZE * at(model.dW, i, k), prev: (i, k) => Wold[i * 3 + k]!, note: 'Take a step against the gradient.' },
          { kind: 'mat', name: 'b', sym: 'b', shape: '(1, 3)', r: 1, c: 3, get: (_i, k) => bold[k]! - STEP_SIZE * at(model.db, 0, k), prev: (_i, k) => bold[k]!, note: 'Same for the biases. One iteration done: press **Next iteration** to apply it and run the next.' },
        ];
        const narrowView = f.viz.clientWidth < 560;
        const cv = f.canvas(narrowView ? 400 : 1000, narrowView ? 330 : 300, (ctx, w, h) => {
          const v = views[cur]!;
          const mono = (sz: number, wt = 500) => `${wt} ${sz}px 'JetBrains Mono Variable', ui-monospace, monospace`;
          const narrow = w < 560;
          const symColors: Record<string, Color> = { W: 'blue', s: 'purple', g: 'teal', L: 'red', b: 'green' };
          const symCol = v.sym ? color(symColors[v.sym]!) : color('--ink');
          ctx.textBaseline = 'alphabetic';
          ctx.textAlign = 'left';
          ctx.font = mono(narrow ? 15 : 18, 700);
          ctx.fillStyle = symCol;
          ctx.fillText(v.name, 14, 30);
          const nw = ctx.measureText(v.name).width;
          ctx.font = mono(13);
          ctx.fillStyle = color('--ink-3');
          if (v.kind !== 'scalar') ctx.fillText(v.shape, 14 + nw + 10, 30);
          const top = 52;
          if (v.kind === 'scalar') {
            ctx.font = mono(narrow ? 34 : 44, 700);
            ctx.fillStyle = symCol;
            ctx.textAlign = 'center';
            ctx.fillText(fmt(v.value(), 5), w / 2, top + (h - top) * 0.5);
            ctx.font = mono(12);
            ctx.fillStyle = color('--ink-3');
            ctx.fillText('a single number', w / 2, top + (h - top) * 0.5 + 30);
            return;
          }
          if (v.kind === 'mat') {
            const cw = Math.min(110, (w - 80) / v.c);
            const ch = Math.min(46, (h - top - 30) / Math.max(2, v.r + 1));
            const x0 = (w - cw * v.c) / 2 + 20;
            ctx.font = mono(12);
            ctx.fillStyle = color('--ink-3');
            ctx.textAlign = 'center';
            for (let k = 0; k < v.c; k++) ctx.fillText(`class ${k}`, x0 + cw * (k + 0.5), top + 14);
            for (let i = 0; i < v.r; i++) {
              const yy = top + 24 + i * ch;
              ctx.textAlign = 'right';
              ctx.fillStyle = color('--ink-3');
              ctx.fillText(v.r === 1 ? '' : `row ${i}`, x0 - 10, yy + ch / 2 + 4);
              for (let k = 0; k < v.c; k++) {
                ctx.fillStyle = withAlpha(symCol, 0.1);
                ctx.fillRect(x0 + cw * k + 2, yy + 2, cw - 4, ch - 4);
                ctx.textAlign = 'center';
                ctx.font = mono(narrow ? 12 : 14, 600);
                ctx.fillStyle = color('--ink');
                ctx.fillText(fmt(v.get(i, k), 3), x0 + cw * (k + 0.5), yy + ch / 2 + (v.prev ? 0 : 5));
                if (v.prev) {
                  ctx.font = mono(11);
                  ctx.fillStyle = color('--ink-3');
                  ctx.fillText(`was ${fmt(v.prev(i, k), 3)}`, x0 + cw * (k + 0.5), yy + ch / 2 + 15);
                }
              }
            }
            return;
          }
          // rows view: three example rows with their inputs and labels
          const headers = ['row', 'x₀', 'x₁', 'y', ...(v.cols === 1 ? ['value'] : ['class 0', 'class 1', 'class 2'])];
          const widths = [0.75, 0.85, 0.85, 0.45, ...Array(v.cols).fill(v.cols === 1 ? 1.6 : 1.35)] as number[];
          const tot = widths.reduce((a, b) => a + b, 0);
          const unit = Math.min((w - 20) / tot, narrow ? 60 : 92);
          const x0 = (w - unit * tot) / 2;
          const rh = Math.min(42, (h - top - 40) / 4);
          let xx = x0;
          const xs = widths.map((ww) => {
            const c = xx + (ww * unit) / 2;
            xx += ww * unit;
            return c;
          });
          ctx.font = mono(narrow ? 10.5 : 12);
          ctx.fillStyle = color('--ink-3');
          ctx.textAlign = 'center';
          headers.forEach((hd, c) => ctx.fillText(hd, xs[c]!, top + 14));
          rows.forEach((i, r) => {
            const yy = top + 22 + r * rh;
            const cells = [String(i), fmt(X.d[2 * i]!, 2), fmt(X.d[2 * i + 1]!, 2), String(y[i])];
            ctx.font = mono(narrow ? 11 : 13, 500);
            cells.forEach((s, c) => {
              ctx.fillStyle = c === 1 || c === 2 ? color('orange') : c === 3 ? color('gold') : color('--ink-2');
              ctx.fillText(s, xs[c]!, yy + rh / 2 + 4);
            });
            for (let k = 0; k < v.cols; k++) {
              const c = 4 + k;
              const cwid = widths[c]! * unit;
              const marked = v.mark?.(i, k) ?? false;
              ctx.fillStyle = withAlpha(symCol, marked ? 0.16 : 0.07);
              ctx.fillRect(xs[c]! - cwid / 2 + 2, yy + 2, cwid - 4, rh - 4);
              if (marked) {
                ctx.strokeStyle = color('gold');
                ctx.lineWidth = 2;
                ctx.strokeRect(xs[c]! - cwid / 2 + 2, yy + 2, cwid - 4, rh - 4);
              }
              ctx.font = mono(narrow ? 10.5 : 13, 600);
              ctx.fillStyle = color('--ink');
              ctx.fillText(fmt(v.get(i, k), 3), xs[c]!, yy + rh / 2 + 4);
            }
          });
          ctx.font = mono(11);
          ctx.fillStyle = color('--ink-3');
          ctx.fillText(`showing 3 of ${N} rows`, w / 2, top + 22 + 3 * rh + 18);
        });
        cv.canvas.classList.add('scroll-ok');
        const sync = () => {
          f.code.highlight(cur === 0 ? null : `s${cur}`);
          f.code.setMany({ it, dl: cur >= 5 ? fmt(model.data_loss, 4) : '…', rl: cur >= 6 ? fmt(model.reg_loss, 3) : '…', loss: cur >= 7 ? fmt(model.loss, 4) : '…' });
          f.status(views[cur]!.note);
          cv.redraw();
        };
        const st = f.stepper({ steps: views.length, interval: 1300, label: (k) => `step ${k} / 15`, onStep: (k) => { cur = k; sync(); } });
        f.button('Next iteration', () => {
          model.step(X, y, REG, STEP_SIZE, true);
          it++;
          refresh();
          st.go(0);
        }, { icon: 'next' });
        f.button('+10 iterations', () => {
          for (let k = 0; k < 10; k++) model.step(X, y, REG, STEP_SIZE, true);
          it += 10;
          refresh();
          st.go(0);
        });
        f.button('Reset', () => {
          const fresh = new SoftmaxClassifier(2, 3, 1);
          model.W = fresh.W;
          model.b = fresh.b;
          it = 0;
          refresh();
          st.go(0);
        }, { icon: 'reset' });
      },
      caption: `Step through all fifteen lines. Each step shows the array the highlighted line produces, with its shape. On the first iteration the scores are tiny, every probability is close to 1/3, and the loss is close to $\\log 3 \\approx 1.0986$, just as predicted. Watch the outlined correct-class cells in \`dscores\`: subtracting 1 turns them negative, the gradient's way of saying "raise this score." Press **Next iteration** a few times and the loss starts to drop.`,
    });

    p.prose(`
### Putting it all together

Wrap those lines in a loop, print the loss now and then, and measure the training accuracy at the end. That is a complete softmax classifier:`);
    p.figure({
      title: 'Training the linear classifier on the spiral',
      codeTitle: 'train_linear.py',
      code: `
        # initialize parameters randomly
        W = 0.01 * np.random.randn(D, K)
        b = np.zeros((1, K))
        step_size = 1e-0
        reg = 1e-3                     # regularization strength

        num_examples = X.shape[0]
        for i in range(200):                                           #@loop
            # forward: class scores, then the loss
            scores = np.dot(X, W) + b                                  #@fwd
            exp_scores = np.exp(scores)                                #@fwd
            probs = exp_scores / np.sum(exp_scores, axis=1, keepdims=True)   #@fwd
            correct_logprobs = -np.log(probs[range(num_examples), y])  #@loss
            data_loss = np.sum(correct_logprobs) / num_examples        #@loss
            reg_loss = 0.5 * reg * np.sum(W * W)                       #@loss
            loss = data_loss + reg_loss                                #@loss
            if i % 10 == 0:
                print("iteration %d: loss %f" % (i, loss))   # {{log}}
            # backward: gradient on scores, then into W and b
            dscores = probs.copy()                                     #@bwd
            dscores[range(num_examples), y] -= 1                       #@bwd
            dscores /= num_examples                                    #@bwd
            dW = np.dot(X.T, dscores)                                  #@bwd
            db = np.sum(dscores, axis=0, keepdims=True)                #@bwd
            dW += reg * W                                              #@bwd
            # parameter update
            W += -step_size * dW                                       #@upd
            b += -step_size * db                                       #@upd

        scores = np.dot(X, W) + b
        predicted_class = np.argmax(scores, axis=1)
        print('training accuracy: %.2f' % np.mean(predicted_class == y))   # {{acc}}
      `,
      setup(f) {
        const { X, y } = caseData();
        let model = new SoftmaxClassifier(2, 3, 1);
        const losses: number[] = [];
        let i = 0;
        const pl = f.plot({ aspect: 1.1, domain: [-1.1, 1.1, -1.1, 1.1], draw: (pp) => {
          drawRegions(pp, model, 3, 5);
          pp.axes({ grid: 0.5 });
          drawPoints(pp, X, y, model);
        } });
        const chart = lossChart(f, losses, 200, 1);
        const itRo = f.readout('iteration');
        const lossRo = f.readout('loss', { sym: 'L' });
        const accRo = f.readout('accuracy');
        const show = () => {
          const a = accuracy(model, X, y);
          itRo.set(i);
          lossRo.set(losses.length ? fmt(losses[losses.length - 1]!, 4) : '–');
          accRo.set(`${(a * 100).toFixed(0)}%`);
          f.code.set('acc', i >= 200 ? `${a.toFixed(2)}` : '…');
          pl.redraw();
          chart.redraw();
        };
        const loop = f.loop(() => {
          for (let k = 0; k < 2 && i < 200; k++) {
            const l = model.step(X, y, REG, STEP_SIZE);
            losses.push(l);
            if (i % 10 === 0) f.code.set('log', `iteration ${i}: loss ${l.toFixed(6)}`);
            i++;
          }
          f.code.highlight(['fwd', 'loss', 'bwd', 'upd'][i % 4]!);
          show();
          if (i >= 200) {
            stop();
            f.status(`Done: training accuracy **${(accuracy(model, X, y) * 100).toFixed(0)}%**. The loss stopped falling near 0.77, and no amount of extra training would help.`);
            return false;
          }
        });
        const stop = () => {
          loop.stop();
          btn.textContent = i >= 200 ? 'Train again' : 'Train';
          f.code.highlight(null);
        };
        const btn = f.button('Train', () => {
          if (loop.running()) return stop();
          if (i >= 200) {
            model = new SoftmaxClassifier(2, 3, 1);
            losses.length = 0;
            i = 0;
          }
          f.status('');
          loop.start();
          btn.textContent = 'Pause';
        }, { primary: true });
        show();
      },
      caption: `Press **Train** to run the 200 iterations. The loss starts at 1.096 (as predicted) and settles near 0.77, and the training accuracy ends at about **49%**. That is better than the 33% of guessing, but not good, and not surprising: the background shows three wedges cut by straight lines, which is all a linear classifier can ever produce, and the spiral arms wrap right through them. Ringed points are misclassified.`,
    });

    p.h2('Training a two-layer neural network', 'network');
    p.prose(`
A linear classifier cannot follow a spiral, but Chapter 7 showed that a network with one hidden layer can bend its boundary into whatever shape it needs. Let's add a hidden layer of 100 ReLU units. There are now two sets of weights and biases:`);
    p.code(`
      h = 100                              # size of the hidden layer
      W = 0.01 * np.random.randn(D, h)     # (2, 100)
      b = np.zeros((1, h))                 # (1, 100)
      W2 = 0.01 * np.random.randn(h, K)    # (100, 3)
      b2 = np.zeros((1, K))                # (1, 3)
    `, { title: 'init_network.py' });
    p.prose(`The forward pass gains one line: compute the hidden layer first, then the scores from it.`);
    p.math({
      label: 'The two-layer forward pass',
      tex: String.raw`\begin{aligned} \text{hidden} &= \max(0,\; \symX\symW + \symb) \\[2pt] \syms &= \text{hidden}\;\sym{W}{W_2} + \sym{b}{b_2} \end{aligned}`,
      code: `
        hidden_layer = np.maximum(0, np.dot(X, W) + b)   # (300, 100), ReLU
        scores = np.dot(hidden_layer, W2) + b2           # (300, 3)
      `,
      codeTitle: 'forward_network.py',
      terms: [
        [String.raw`\symX\symW + \symb`, 'a linear layer: 100 numbers per example'],
        [String.raw`\max(0,\cdot)`, 'ReLU, applied to each of those numbers separately'],
        [String.raw`\text{hidden}\;\sym{W}{W_2} + \sym{b}{b_2}`, 'a second linear layer turns the 100 hidden values into 3 class scores'],
      ],
      explain: 'Everything after the scores (the loss, and the gradient on the scores) is exactly the same as before: the loss does not care how the scores were made. Only the backward pass gets longer, because there is one more layer to backpropagate through.',
    });
    p.math({
      label: 'Backprop through both layers',
      tex: String.raw`\begin{aligned}
        \sym{g}{\tfrac{\partial \symL}{\partial \sym{W}{W_2}}} &= \text{hidden}^{\top}\,\sym{g}{\tfrac{\partial \symL}{\partial \syms}} \\[3pt]
        \sym{g}{\tfrac{\partial \symL}{\partial\, \text{hidden}}} &= \big(\sym{g}{\tfrac{\partial \symL}{\partial \syms}}\,\sym{W}{W_2}^{\top}\big) \odot \mathbb{1}(\text{hidden} > 0) \\[3pt]
        \sym{g}{\tfrac{\partial \symL}{\partial \symW}} &= \symX^{\top}\,\sym{g}{\tfrac{\partial \symL}{\partial\, \text{hidden}}}
      \end{aligned}`,
      code: `
        # into W2 and b2, exactly like the linear classifier
        dW2 = np.dot(hidden_layer.T, dscores)          # (100, 3)
        db2 = np.sum(dscores, axis=0, keepdims=True)
        # into the hidden layer
        dhidden = np.dot(dscores, W2.T)                # (300, 100)
        # through the ReLU
        dhidden[hidden_layer <= 0] = 0
        # into W and b
        dW = np.dot(X.T, dhidden)                      # (2, 100)
        db = np.sum(dhidden, axis=0, keepdims=True)
        dW2 += reg * W2
        dW += reg * W
      `,
      codeTitle: 'backprop_network.py',
      terms: [
        [String.raw`\text{hidden}^{\top}\,\partial\symL/\partial\syms`, 'the second layer is a matrix multiply, so its weight gradient follows the same rule as before, with `hidden_layer` playing the role of `X`'],
        [String.raw`\partial\symL/\partial\syms\;\sym{W}{W_2}^{\top}`, 'the other half of the matrix-multiply rule: the gradient flowing back to the multiply\'s *input*'],
        [String.raw`\odot\,\mathbb{1}(\text{hidden} > 0)`, 'ReLU\'s local gradient is 1 where the unit was active and 0 where it was clipped, so its backward pass just zeroes the gradient wherever `hidden_layer` was 0 ($\\odot$ means multiply element by element)'],
        [String.raw`\symX^{\top}\,\partial\symL/\partial\,\text{hidden}`, 'and the first layer is one more matrix multiply'],
      ],
      explain: 'Read it from the top: the gradient arrives at the scores, splits at the second matrix multiply (one part to `W2`, one part back to the hidden layer), passes through the ReLU as through a gate that is either open or shut for each unit and example, and finally reaches `W`. Every line is a rule from Chapter 6.',
    });
    p.figure({
      title: 'Training the two-layer network on the spiral',
      codeTitle: 'train_network.py',
      code: `
        # initialize parameters randomly
        h = 100                                    # size of hidden layer
        W = 0.01 * np.random.randn(D, h)
        b = np.zeros((1, h))
        W2 = 0.01 * np.random.randn(h, K)
        b2 = np.zeros((1, K))
        step_size = 1e-0
        reg = 1e-3                                 # regularization strength

        num_examples = X.shape[0]
        for i in range(10000):                                         #@loop
            # forward: hidden layer (ReLU), then class scores
            hidden_layer = np.maximum(0, np.dot(X, W) + b)             #@fwd
            scores = np.dot(hidden_layer, W2) + b2                     #@fwd
            # loss: softmax, same as before
            exp_scores = np.exp(scores)                                #@loss
            probs = exp_scores / np.sum(exp_scores, axis=1, keepdims=True)   #@loss
            correct_logprobs = -np.log(probs[range(num_examples), y])  #@loss
            data_loss = np.sum(correct_logprobs) / num_examples        #@loss
            reg_loss = 0.5*reg*np.sum(W*W) + 0.5*reg*np.sum(W2*W2)     #@loss
            loss = data_loss + reg_loss                                #@loss
            if i % 1000 == 0:
                print("iteration %d: loss %f" % (i, loss))   # {{log}}
            # backward: gradient on scores, same as before
            dscores = probs.copy()                                     #@bwd
            dscores[range(num_examples), y] -= 1                       #@bwd
            dscores /= num_examples                                    #@bwd
            # into W2 and b2
            dW2 = np.dot(hidden_layer.T, dscores)                      #@bwd
            db2 = np.sum(dscores, axis=0, keepdims=True)               #@bwd
            # into the hidden layer, then through the ReLU
            dhidden = np.dot(dscores, W2.T)                            #@bwd
            dhidden[hidden_layer <= 0] = 0                             #@bwd
            # into W and b
            dW = np.dot(X.T, dhidden)                                  #@bwd
            db = np.sum(dhidden, axis=0, keepdims=True)                #@bwd
            dW2 += reg * W2                                            #@bwd
            dW += reg * W                                              #@bwd
            # parameter update
            W += -step_size * dW                                       #@upd
            b += -step_size * db                                       #@upd
            W2 += -step_size * dW2                                     #@upd
            b2 += -step_size * db2                                     #@upd

        hidden_layer = np.maximum(0, np.dot(X, W) + b)
        scores = np.dot(hidden_layer, W2) + b2
        predicted_class = np.argmax(scores, axis=1)
        print('training accuracy: %.2f' % np.mean(predicted_class == y))   # {{acc}}
      `,
      setup(f) {
        const { X, y } = caseData();
        const MAX = 10000;
        let net = new TwoLayerNet(2, 100, 3, 1);
        const losses: number[] = [];
        let i = 0;
        let frame = 0;
        let showUnits = false;
        const pl = f.plot({ aspect: 1.1, domain: [-1.1, 1.1, -1.1, 1.1], draw: (pp) => {
          drawRegions(pp, net, 3, 6);
          pp.axes({ grid: 0.5 });
          if (showUnits) {
            const hN = net.W.c;
            for (let j = 0; j < hN; j++) {
              const a = net.W.d[j]!, bb = net.W.d[hN + j]!, c = net.b.d[j]!;
              const n2 = a * a + bb * bb;
              if (n2 < 1e-12) continue;
              const fx = (-c * a) / n2, fy = (-c * bb) / n2;
              const nr = Math.sqrt(n2);
              if (Math.hypot(fx, fy) > 1.6) continue;
              pp.path([fx - (bb / nr) * 3, fx + (bb / nr) * 3], [fy + (a / nr) * 3, fy - (a / nr) * 3], withAlpha(color('--ink'), 0.22), 1);
            }
          }
          drawPoints(pp, X, y, net);
        } });
        const chart = lossChart(f, losses, MAX, 20);
        const itRo = f.readout('iteration');
        const lossRo = f.readout('loss', { sym: 'L' });
        const accRo = f.readout('accuracy');
        let lastLoss = NaN;
        const show = () => {
          const a = accuracy(net, X, y);
          itRo.set(i.toLocaleString('en-US'));
          lossRo.set(Number.isFinite(lastLoss) ? fmt(lastLoss, 4) : '–');
          accRo.set(`${(a * 100).toFixed(0)}%`);
          f.code.set('acc', i >= MAX ? `${a.toFixed(2)}` : '…');
          pl.redraw();
          chart.redraw();
        };
        const loop = f.loop(() => {
          const t0 = performance.now();
          while (performance.now() - t0 < 8 && i < MAX) {
            lastLoss = net.step(X, y, REG, STEP_SIZE);
            if (i % 20 === 0) losses.push(lastLoss);
            if (i % 1000 === 0) f.code.set('log', `iteration ${i}: loss ${lastLoss.toFixed(6)}`);
            i++;
          }
          frame++;
          f.code.highlight(['fwd', 'loss', 'bwd', 'upd'][frame % 4]!);
          if (frame % 5 === 0 || i >= MAX) show();
          else {
            itRo.set(i.toLocaleString('en-US'));
            chart.redraw();
          }
          if (i >= MAX) {
            stop();
            f.status(`Done: training accuracy **${(accuracy(net, X, y) * 100).toFixed(0)}%** after 10,000 iterations.`);
            return false;
          }
        });
        const stop = () => {
          loop.stop();
          btn.textContent = i >= MAX ? 'Train again' : 'Resume';
          f.code.highlight(null);
        };
        const btn = f.button('Train', () => {
          if (loop.running()) return stop();
          if (i >= MAX) {
            net = new TwoLayerNet(2, 100, 3, 1);
            losses.length = 0;
            i = 0;
          }
          f.status('');
          loop.start();
          btn.textContent = 'Pause';
        }, { primary: true });
        f.toggle({ label: 'show hidden units', value: false, onChange: (v) => { showUnits = v; pl.redraw(); } });
        show();
      },
      caption: `Press **Train**: 10,000 full-batch iterations, which take your browser somewhere around 10 to 30 seconds (the boundary takes shape in the first few thousand). The loss falls from 1.099 to about 0.25 and the training accuracy climbs to about **98 to 99%**. Turn on **show hidden units** to draw, for each of the 100 ReLU units, the line where its input is zero: the unit is off on one side and grows linearly on the other. The final boundary is pieced together from segments of those lines, which is why it looks like a polygon that winds along each arm.`,
    });

    p.h2('Summary', 'summary');
    p.prose(`
Same data, same loss, same gradient descent, and the same handful of hyperparameters. The only difference between the two models is one hidden layer.`);
    p.figure({
      title: 'Linear versus two-layer: what changed',
      codeTitle: 'the_diff.py',
      code: `
        # linear classifier: the forward pass
        scores = np.dot(X, W) + b                              #@lin
        # two-layer network: one extra line in the forward pass
        hidden_layer = np.maximum(0, np.dot(X, W) + b)         #@net
        scores = np.dot(hidden_layer, W2) + b2                 #@net
        # ...and the backward pass continues one layer further
        dW2 = np.dot(hidden_layer.T, dscores)                  #@net
        db2 = np.sum(dscores, axis=0, keepdims=True)           #@net
        dhidden = np.dot(dscores, W2.T)                        #@net
        dhidden[hidden_layer <= 0] = 0                         #@net
        dW = np.dot(X.T, dhidden)                              #@net
        db = np.sum(dhidden, axis=0, keepdims=True)            #@net
        # training accuracy: linear {{lacc}}, two-layer {{nacc}}
      `,
      setup(f) {
        const { X, y } = caseData();
        const lin = new SoftmaxClassifier(2, 3, 1);
        const net = new TwoLayerNet(2, 100, 3, 1);
        let li = 0;
        let ni = 0;
        const row = document.createElement('div');
        row.style.display = 'grid';
        row.style.gridTemplateColumns = 'minmax(0, 1fr) minmax(0, 1fr)';
        row.style.gap = '8px';
        f.viz.append(row);
        const panel = (model: Model, title: () => string) =>
          new Plot(row, {
            aspect: 0.95,
            domain: [-1.1, 1.1, -1.1, 1.1],
            draw: (pp) => {
              drawRegions(pp, model, 3, 5);
              drawPoints(pp, X, y, model, 2.6);
              pp.ctx.fillStyle = withAlpha(color('--paper'), 0.85);
              pp.ctx.fillRect(0, 0, pp.w, 24);
              pp.ctx.fillStyle = color('--ink');
              pp.ctx.font = "600 12px system-ui, sans-serif";
              pp.ctx.textAlign = 'center';
              pp.ctx.fillText(title(), pp.w / 2, 16);
            },
          });
        const pctL = () => `${(accuracy(lin, X, y) * 100).toFixed(0)}%`;
        const pctN = () => `${(accuracy(net, X, y) * 100).toFixed(0)}%`;
        const p1 = panel(lin, () => `linear: ${li < 200 ? 'training…' : pctL()}`);
        const p2 = panel(net, () => `two-layer: ${ni < 10000 ? `training… ${Math.round(ni / 100)}%` : pctN()}`);
        f.code.highlight('net', 'alt');
        f.code.highlight('lin');
        let frame = 0;
        const loop = f.loop(() => {
          const t0 = performance.now();
          for (; li < 200; li++) lin.step(X, y, REG, STEP_SIZE);
          for (; performance.now() - t0 < 9 && ni < 10000; ni++) net.step(X, y, REG, STEP_SIZE);
          frame++;
          if (frame % 6 === 0 || ni >= 10000) {
            p1.redraw();
            p2.redraw();
            f.code.setMany({ lacc: pctL(), nacc: ni >= 10000 ? pctN() : '…' });
          }
          if (ni >= 10000) {
            f.status('Both models are trained, on identical data with identical settings.');
            return false;
          }
        });
        f.status('Training both models (starts when this figure is on screen)…');
        loop.start();
      },
      caption: `Both models train automatically while this figure is on screen. On the left, three straight-edged wedges: the best a linear classifier can do, about half right. On the right, the two-layer network's boundary follows every arm. In the listing, the orange line is the linear classifier's entire forward pass, and the teal lines are everything the network adds: one line forward, a few lines backward. Everything else in the two scripts is identical.`,
    });
    p.table(
      ['', 'Softmax linear classifier', 'Two-layer network'],
      [
        ['Parameters', '`W` (2 × 3), `b` (1 × 3): 9 numbers', '`W` (2 × 100), `b`, `W2` (100 × 3), `b2`: 603 numbers'],
        ['Forward pass', '`scores = X.dot(W) + b`', 'add `hidden_layer = max(0, X.dot(W) + b)` first'],
        ['Backward pass', 'gradient on scores, then `dW`, `db`', 'the same, then through `W2` and the ReLU into `dW`, `db`'],
        ['Iterations', '200', '10,000'],
        ['Final loss', 'about 0.77', 'about 0.25'],
        ['Training accuracy', 'about 49%', 'about 98 to 99%'],
      ],
    );
    p.prose(`
Two practical notes. First, this is training accuracy on a toy problem with no held-out data, so it says nothing yet about generalization: for that you need the validation discipline of Chapter 3 and the regularization of Chapters 7 and 8. Second, the code is deliberately plain. Assignment 1 asks you to write exactly this two-layer network (with a validation set, mini-batches and a learning-rate schedule) and train it on CIFAR-10.`);
    p.callout('idea', `A complete classifier is a short loop: compute scores, compute the loss, backpropagate to get the gradients, update the parameters. The softmax gradient on the scores is simply the probabilities with 1 subtracted at the correct class, and from there every gradient follows from the matrix-multiply and ReLU rules of Chapter 6. Turning a linear classifier into a neural network adds one line to the forward pass and a few to the backward pass, and on the spiral that takes training accuracy from about 49% to about 98 or 99%.`, 'Takeaways');
  },
};

export default chapter;

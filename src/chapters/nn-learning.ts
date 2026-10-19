import type { ChapterDef } from './index';
import { fmt } from '../core/code';
import { spiral } from '../core/data';
import { MLP } from '../core/nn';
import { CLASS_COLORS, color, rgbOf, withAlpha, type Plot } from '../core/plot';
import { Rng } from '../core/rand';
import { OPT_COLOR, OPT_LABEL, OPT_NAMES, SURFACES, Walker, type OptName } from '../lib/nn-learning-optim';
import { NN_LEARNING_SYMBOLS } from '../lib/nn-learning-symbols';

const mono = (sz: number, wt = 500) => `${wt} ${sz}px 'JetBrains Mono Variable', ui-monospace, monospace`;

/** Horizontal grid lines with labels on the left, for charts whose axes are not at zero. */
function hgrid(pl: Plot, vals: number[], label: (v: number) => string): void {
  const c = pl.ctx;
  c.strokeStyle = color('--grid');
  c.lineWidth = 1;
  for (const v of vals) {
    const y = Math.round(pl.sy(v)) + 0.5;
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(pl.w, y);
    c.stroke();
    c.fillStyle = color('--ink-3');
    c.font = mono(10.5);
    c.textAlign = 'left';
    c.textBaseline = 'bottom';
    c.fillText(label(v), 4, y - 2);
  }
}

/** Two classes split by a wavy boundary, with a fraction of labels flipped. */
function wavy(n: number, seed: number, flip: number) {
  const r = new Rng(seed);
  const X = new Float64Array(n * 2);
  const y = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const a = r.uniform(-1, 1), b = r.uniform(-1, 1);
    X[2 * i] = a;
    X[2 * i + 1] = b;
    let c = b > 0.5 * Math.sin(4 * a) ? 1 : 0;
    if (r.next() < flip) c = 1 - c;
    y[i] = c;
  }
  return { X, y, n };
}

/** Draws decision regions of a 2-class or 3-class net into a plot. */
function regions(pl: Plot, net: MLP, alpha = 46, cell = 6): void {
  const cols = CLASS_COLORS.slice(0, 3).map((c) => rgbOf(color(c)));
  pl.field((a, b) => {
    const k = net.predict([a, b]);
    const [r, g, bb] = cols[k]!;
    return [r, g, bb, alpha];
  }, cell);
}

const chapter: ChapterDef = {
  symbols: NN_LEARNING_SYMBOLS,

  render(p) {
    p.prose(`
You now have every ingredient of a neural network: the architecture (Chapter 7), the data preprocessing, initialization, regularization and loss (Chapter 8), and backpropagation to get gradients (Chapter 6). This chapter is about the part that takes most of the actual time in practice: **the training run itself.**

Training a network is less like running a program and more like tending an experiment. You check that the gradients are right before trusting them, check that the untrained network behaves as expected, watch the loss and accuracy curves for the telltale shapes of a bad learning rate or overfitting, pick a smarter update rule than plain gradient descent, and search for good hyperparameters. Here is each of those, with the reasoning behind them and live versions you can poke.`);

    // ------------------------------------------------------------------ gradient checks
    p.h2('Gradient checks', 'gradcheck');
    p.prose(`
Backpropagation code is easy to get subtly wrong: a missing transpose, a forgotten factor of 2, a sign flip. A buggy gradient often still makes the loss go down a little, so the bug can hide for a long time. The defense is a **gradient check**: compute the gradient a second, slow but nearly foolproof way, by literally nudging each parameter and measuring how the loss changes, and compare.`);

    p.math({
      label: 'Numerical gradient, centered difference',
      tex: String.raw`\frac{df}{dx} \approx \frac{f(x + \symh) - f(x - \symh)}{2\symh}`,
      code: `
        def eval_numerical_gradient(f, x, h=1e-5):
            grad = np.zeros_like(x)
            it = np.nditer(x, flags=['multi_index'])
            while not it.finished:
                ix = it.multi_index
                old = x[ix]
                x[ix] = old + h
                fxph = f(x)                 # f(x + h)
                x[ix] = old - h
                fxmh = f(x)                 # f(x - h)
                x[ix] = old                 # restore
                grad[ix] = (fxph - fxmh) / (2 * h)
                it.iternext()
            return grad
      `,
      codeTitle: 'gradient_check.py',
      terms: [
        [String.raw`\frac{df}{dx}`, 'the slope of $f$ at $x$: how much the loss changes per unit change of this one parameter'],
        [String.raw`f(x+\symh),\ f(x-\symh)`, 'the loss with the parameter nudged a tiny bit up, and a tiny bit down'],
        [String.raw`\frac{\cdots}{2\symh}`, 'rise over run: the slope of the straight line through those two points, which are $2\\symh$ apart'],
      ],
      explain: `This is the definition of a derivative from calculus, stopped just short of the limit. Use the **centered** version above rather than the one-sided $[f(x+\\symh) - f(x)]/\\symh$. A Taylor expansion shows that the one-sided formula is off by an amount proportional to $\\symh$, while the centered one is off by an amount proportional to $\\symh^2$: with $\\symh = 10^{-5}$, that is an error around $10^{-10}$ instead of $10^{-5}$. It costs two loss evaluations per parameter instead of one, which is fine for a check.`,
    });

    p.prose(`To compare the numerical gradient $f'_n$ with the analytic one $f'_a$ from backprop, don't look at their plain difference: whether $10^{-4}$ is a small difference depends entirely on whether the gradients themselves are around $10^{-2}$ or $10^{3}$. Use the **relative error**.`);

    p.math({
      label: 'Relative error',
      tex: String.raw`\text{rel. error} = \frac{|f'_a - f'_n|}{\max(|f'_a|,\ |f'_n|)}`,
      code: `
        num = eval_numerical_gradient(f, x)
        ana = analytic_gradient(x)        # from backprop
        top = np.abs(ana - num)
        bottom = np.maximum(np.abs(ana), np.abs(num))
        print((top / bottom).max())       # the worst entry
      `,
      codeTitle: 'rel_error.py',
      terms: [
        [String.raw`|f'_a - f'_n|`, 'how far apart the two gradients are'],
        [String.raw`\max(|f'_a|, |f'_n|)`, 'the size of the larger one, so the error is measured *relative* to the gradient itself'],
      ],
      explain: 'This is the disagreement as a fraction of the gradient\'s own size, so the same thresholds work for big and small gradients alike. (If both are exactly zero they agree perfectly; guard that case. The assignments\' helper divides by $|f\'_a| + |f\'_n|$ instead, which gives the same verdict to within a factor of two.)',
    });

    p.table(
      ['Relative error', 'Verdict'],
      [
        ['above $10^{-2}$', 'the gradient is probably wrong'],
        ['$10^{-2}$ to $10^{-4}$', 'you should feel uncomfortable'],
        ['$10^{-4}$ to $10^{-7}$', 'usually fine if the function has kinks (ReLU, SVM); too high if it is smooth (tanh, softmax)'],
        ['below $10^{-7}$', 'be happy'],
      ],
      { caption: 'Rules of thumb from the CS231n notes. Errors also grow with depth: for a 10-layer network, $10^{-2}$ can be acceptable because errors accumulate through the layers.' },
    );

    p.figure({
      title: 'Relative error of a gradient check, as the step h varies',
      codeTitle: 'check_one.py',
      code: `
        def f(x):                # kink at c, if the factor is 2
            out = np.tanh(1.5 * x) + 0.2 * x ** 2
            return out + {{kc:0}} * np.maximum(0, x - c)

        def df(x):               # the analytic gradient
            t = np.tanh(1.5 * x)
            out = 1.5 * (1 - t ** 2) + 0.4 * x
            return out + {{kc:0}} * (x > c)

        x = np.{{dtype:float64}}({{x0:0.4}})   # c = x + {{d:1e-4}}
        h = {{h:1e-5}}
        num = (f(x + h) - f(x - h)) / (2 * h)                #@num
        ana = df(x)                                          #@ana
        rel = abs(ana - num) / max(abs(ana), abs(num))       #@rel
        # num = {{num}}   ana = {{ana}}
        # rel = {{rel}}
        crossed = (x - h < c) and (x + h > c)   # {{crossed}} #@kink
      `,
      setup(f) {
        let kink = false;
        let d = 1e-4;
        let h = 1e-5;
        let single = false;
        const x0 = 0.4;
        const K = 2;
        const f64 = (x: number, c: number) => Math.tanh(1.5 * x) + 0.2 * x * x + (kink ? K * Math.max(0, x - c) : 0);
        const fr = Math.fround;
        const f32 = (x: number, c: number) => {
          const t = fr(Math.tanh(fr(1.5 * x)));
          let o = fr(t + fr(0.2 * fr(x * x)));
          if (kink) o = fr(o + fr(K * fr(Math.max(0, fr(x - c)))));
          return o;
        };
        const ana = (x: number, c: number) => {
          const t = Math.tanh(1.5 * x);
          return 1.5 * (1 - t * t) + 0.4 * x + (kink && x > c ? K : 0);
        };
        const check = (hh: number, s: boolean) => {
          const c = x0 + d;
          if (s) {
            const x = fr(x0), cc = fr(c);
            const xp = fr(x + fr(hh)), xm = fr(x - fr(hh));
            const num = fr(fr(f32(xp, cc) - f32(xm, cc)) / fr(2 * fr(hh)));
            const a = fr(ana(x, cc));
            return { num, a, rel: Math.abs(a - num) / Math.max(Math.abs(a), Math.abs(num), 1e-30), crossed: xm < cc && xp > cc };
          }
          const num = (f64(x0 + hh, c) - f64(x0 - hh, c)) / (2 * hh);
          const a = ana(x0, c);
          return { num, a, rel: Math.abs(a - num) / Math.max(Math.abs(a), Math.abs(num), 1e-300), crossed: x0 - hh < c && x0 + hh > c };
        };
        const curve = (s: boolean) => {
          const xs: number[] = [], ys: number[] = [];
          for (let i = 0; i <= 240; i++) {
            const lh = -12 + (12 * i) / 240;
            const r = check(10 ** lh, s).rel;
            xs.push(lh);
            ys.push(Math.max(-16.5, Math.min(0.4, Math.log10(Math.max(r, 1e-17)))));
          }
          return [xs, ys] as const;
        };
        const pl = f.plot({
          aspect: 1.25,
          square: false,
          domain: [-14.2, 0.45, -18.9, 1.1],
          draw: (pp) => {
            const c = pp.ctx;
            const band = (y0: number, y1: number, col: string, a: number) => {
              c.fillStyle = withAlpha(color(col as 'red'), a);
              c.fillRect(pp.sx(-12), pp.sy(y1), pp.sx(0) - pp.sx(-12), pp.sy(y0) - pp.sy(y1));
            };
            band(-2, 0.6, 'red', 0.12);
            band(-4, -2, 'gold', 0.12);
            band(-17, -7, 'green', 0.1);
            c.strokeStyle = color('--grid');
            c.lineWidth = 1;
            c.fillStyle = color('--ink-3');
            c.font = mono(10.5);
            for (let v = -16; v <= 0; v += 2) {
              const y = Math.round(pp.sy(v)) + 0.5;
              c.beginPath();
              c.moveTo(pp.sx(-12), y);
              c.lineTo(pp.sx(0), y);
              c.stroke();
              c.textAlign = 'right';
              c.textBaseline = 'middle';
              c.fillText(v === 0 ? '1' : `1e${v}`, pp.sx(-12) - 3, y);
            }
            for (let v = -12; v <= 0; v += 2) {
              const x = Math.round(pp.sx(v)) + 0.5;
              c.beginPath();
              c.moveTo(x, pp.sy(0.6));
              c.lineTo(x, pp.sy(-17));
              c.stroke();
              c.textAlign = 'center';
              c.textBaseline = 'top';
              c.fillText(v === 0 ? '1' : `1e${v}`, x, pp.sy(-17) + 3);
            }
            c.textAlign = 'right';
            c.textBaseline = 'alphabetic';
            c.font = '11px system-ui, sans-serif';
            c.fillStyle = color('red');
            c.fillText('probably wrong', pp.sx(-0.1), pp.sy(-1.3));
            c.fillStyle = color('gold');
            c.fillText('uncomfortable', pp.sx(-0.1), pp.sy(-3.3));
            c.fillStyle = color('green');
            c.fillText('great', pp.sx(-0.1), pp.sy(-16.2));
            const [x64, y64] = curve(false);
            const [x32, y32] = curve(true);
            pp.path(x32, y32, withAlpha(color('orange'), single ? 1 : 0.55), single ? 2.6 : 1.8);
            pp.path(x64, y64, withAlpha(color('blue'), single ? 0.55 : 1), single ? 1.8 : 2.6);
            const lh = Math.log10(h);
            const r = check(h, single);
            const ly = Math.max(-16.5, Math.min(0.4, Math.log10(Math.max(r.rel, 1e-17))));
            pp.path([lh, lh], [-17, 0.6], withAlpha(color('--ink'), 0.5), 1, [4, 4]);
            pp.dot(lh, ly, 6, color(single ? 'orange' : 'blue'), color('--paper'));
            if (kink) {
              const ld = Math.log10(d);
              pp.path([ld, ld], [-17, 0.6], withAlpha(color('red'), 0.6), 1.5, [2, 3]);
              pp.text('h = d', ld + 0.12, -11.5, { size: 11, color: color('red') });
            }
            pp.text('float64', -11.8, -13.6, { size: 12, bold: true, color: color('blue') });
            pp.text('float32', -11.8, -15.2, { size: 12, bold: true, color: color('orange') });
            pp.text('step h →', -0.1, -14.6, { size: 11, align: 'right', color: color('--ink-2') });
          },
        });
        const relRo = f.readout('relative error');
        const crossRo = f.readout('crossed the kink');
        const sync = () => {
          const r = check(h, single);
          f.code.setMany({
            num: fmt(r.num, 8), ana: fmt(r.a, 8), rel: r.rel === 0 ? '0' : r.rel.toExponential(1), crossed: kink ? (r.crossed ? 'True' : 'False') : 'n/a',
            kc: kink ? String(K) : '0', d: fmt(d, 1),
          });
          relRo.set(r.rel === 0 ? '0' : r.rel.toExponential(1));
          crossRo.set(kink ? (r.crossed ? 'yes' : 'no') : 'n/a');
          f.code.highlight(kink && r.crossed ? ['rel', 'kink'] : 'rel');
          pl.redraw();
        };
        f.segmented({
          label: 'function',
          options: [
            { value: 'smooth', label: 'smooth' },
            { value: 'kink', label: 'with a ReLU kink' },
          ],
          value: 'smooth',
          onChange: (v) => {
            kink = v === 'kink';
            dSl.input.disabled = !kink;
            sync();
          },
        });
        f.segmented({
          label: 'precision',
          options: [
            { value: 'float64', label: 'float64' },
            { value: 'float32', label: 'float32' },
          ],
          value: 'float64',
          slot: 'dtype',
          onChange: (v) => {
            single = v === 'float32';
            sync();
          },
        });
        f.slider({
          label: 'step h',
          sym: 'h',
          min: -12,
          max: 0,
          step: 0.05,
          value: -5,
          map: (r) => 10 ** r,
          format: (v) => v.toExponential(0),
          slot: 'h',
          onInput: (v) => {
            h = v;
            sync();
          },
        });
        const dSl = f.slider({
          label: 'kink distance d',
          min: -9,
          max: -1,
          step: 0.05,
          value: -4,
          map: (r) => 10 ** r,
          format: (v) => v.toExponential(0),
          onInput: (v) => {
            d = v;
            sync();
          },
        });
        dSl.input.disabled = true;
        sync();
      },
      caption: `Both axes are logarithmic: each grid step is a factor of 100. The blue curve is a gradient check of a smooth function in double precision (float64): the error is large for a big $\\symh$ (the straight line is a poor stand-in for the curve) and also for a tiny $\\symh$ (subtracting two nearly equal numbers wipes out most of the significant digits), with a sweet spot around $\\symh = 10^{-6}$ to $10^{-5}$, where the error is about $10^{-11}$. The orange curve is the same check in single precision (float32). At $\\symh = 10^{-5}$ its error is already around $10^{-4}$ to $10^{-3}$; at $10^{-6}$ it is a few percent, which looks exactly like a wrong gradient; below $10^{-8}$, $x + \\symh$ rounds back to $x$ and the check is meaningless. Now pick **with a ReLU kink** and drag $\\symh$: once $\\symh$ is larger than the distance $d$ to the kink, the two evaluations land on opposite sides of it, the check "fails" by a huge margin, and the code reports that it crossed the kink. Slide $d$ to see that a kink just $10^{-6}$ away is invisible to the analytic gradient but ruins the numerical one.`,
    });

    p.prose(`
### Pitfalls, and how to avoid them

The figure shows three of the classic traps directly. Here is the full list from the notes:

- **Use double precision.** A correct gradient checked in single precision can show relative errors as high as $10^{-2}$. Switching to float64 can drop that to $10^{-8}$.
- **Stay in the active range of floating point.** If the loss or the gradients are tiny (say $10^{-10}$ or smaller), the comparison loses precision. Print the raw numbers; if they are minuscule, scale the loss up by a constant so it is closer to 1, where floats are most precise.
- **Kinks.** ReLU, the SVM's hinge, and max pooling have points where the slope jumps. If $x$ is very close to one, $f(x - \\symh)$ and $f(x + \\symh)$ can straddle it and the numerical gradient is wrong, even though the analytic one is right. This is not rare: the SVM loss on all of CIFAR-10 contains 450,000 hinge terms (50,000 examples × 9 wrong classes). You can detect it by tracking, during the forward pass, which side of every \`max(x, y)\` "won": if any winner differs between the evaluations at $x + \\symh$ and $x - \\symh$, a kink was crossed and that check is not trustworthy.
- **Use few data points.** Fewer examples means fewer kinks to cross, and a faster check. A gradient that checks out on 2 or 3 examples is almost certainly right for the whole batch.
- **Be careful with $\\symh$.** Smaller is not always better, as the blue curve shows. If a check fails, try $10^{-4}$ or $10^{-6}$ before concluding the gradient is wrong.
- **Check during a "characteristic" phase of training.** At the very first iteration, with tiny random weights, the network can be in an unusual state (every score near zero, for instance) where a buggy gradient happens to look right. Let it train briefly, until the loss starts to go down, then check.
- **Don't let regularization overwhelm the data loss.** If the regularization term dominates, a broken data-loss gradient hides behind the (much simpler, easy to get right) regularization gradient. Check the data loss alone first, with $\\symlam = 0$, then the regularization term separately.
- **Turn off dropout and augmentation.** Anything random makes $f(x + \\symh)$ and $f(x - \\symh)$ incomparable. Disable it, or fix the random seed so every evaluation uses the same randomness.
- **Check only a few dimensions, but of every parameter.** With millions of parameters, checking a random sample of a few is enough. But sample from *each* parameter array separately: if everything is flattened into one long vector, the few thousand bias values are easy to miss entirely.

Assignments 1 and 2 provide \`eval_numerical_gradient\` and \`rel_error\` helpers exactly for this.`);

    // ------------------------------------------------------------------ sanity checks
    p.h2('Before learning: sanity checks', 'sanity');
    p.prose(`
Before starting a long, expensive optimization, run three quick checks. Each catches a whole class of bugs in seconds.

**1. Is the initial loss what it should be?** With small random weights, every class score is close to zero, so the network has no preference and its predictions are uniform. You can compute exactly what loss that gives. Do this first with regularization turned off.`);

    p.math({
      label: 'The loss of a network that knows nothing',
      tex: String.raw`\symL_{\text{softmax}} = -\ln\frac{1}{C} = \ln C, \qquad \symL_{\text{SVM}} = (C-1)\cdot\Delta`,
      code: `
        loss, _ = model.loss(X_small, y_small, reg=0.0)
        print(loss)               # softmax, 10 classes: ~2.302
        print(-np.log(1.0 / 10))  # 2.302585...
        # multiclass SVM, delta = 1: (10 - 1) * 1 = 9
      `,
      codeTitle: 'initial_loss.py',
      terms: [
        [String.raw`C`, 'the number of classes'],
        [String.raw`\frac{1}{C}`, 'the probability softmax gives each class when all scores are equal, including the correct one'],
        [String.raw`-\ln\frac{1}{C}`, 'the softmax loss is the negative log of the correct class\'s probability. For CIFAR-10: $-\\ln 0.1 = 2.302$'],
        [String.raw`(C-1)\cdot\Delta`, 'with all scores near zero, every one of the $C - 1$ wrong classes violates the margin by $\\Delta$. For CIFAR-10 with $\\Delta = 1$: 9'],
      ],
      explain: 'If your untrained network reports a softmax loss of 2.302 on CIFAR-10, the forward pass and loss are wired up plausibly. If it reports 0.5, or 40, something is off: often the initial weights are too large, or the loss is not averaged over the batch correctly.',
    });

    p.prose(`
**2. Does more regularization increase the loss?** Turn $\\symlam$ up and the reported loss should go up too. If it does not, the regularization term is not actually part of the loss.

**3. Can the network overfit a tiny dataset?** Take just a handful of training examples (say 20), turn regularization off, and train. A correctly implemented network has more than enough capacity to memorize 20 examples, so the loss should go to (nearly) zero and the training accuracy to 100%. If it cannot, there is a bug, and it is not worth moving on to the full dataset. (The converse does not hold: passing this check does not prove the code is right. If a bug scrambled the input features, for instance, the network could still memorize 20 random-looking examples, but would never generalize on the real data.)`);

    p.figure({
      title: 'Sanity checks on a small network',
      codeTitle: 'sanity.py',
      code: `
        model = TwoLayerNet(2, 50, 3, std={{std:0.01}})
        X, y = X_train[:{{n:20}}], y_train[:{{n:20}}]
        loss, grads = model.loss(X, y, reg={{reg:0}})   #@init
        # step 0 loss: {{l0}}   (chance: {{chance}})

        for it in range(2000):         # Adam (see below)
            loss, grads = model.loss(X, y, reg={{reg:0}}) #@step
            for k in model.params:
                adam_update(model.params[k], grads[k])     #@step
        # step {{it:0}}: loss {{loss:…}}, train acc {{acc:…}}
      `,
      setup(f) {
        const data = spiral(100, 3, 0.2, 3);
        const tiny = Int32Array.from({ length: 20 }, (_, i) => Math.floor((i * 300) / 20) + 3);
        const full = Int32Array.from({ length: 300 }, (_, i) => i);
        let useTiny = true;
        let reg = 0;
        let std = 0.01;
        let lossKind: 'softmax' | 'svm' = 'softmax';
        let net = new MLP({ sizes: [2, 50, 3], init: std, seed: 1 });
        let it = 0;
        const losses: number[] = [];
        const idx = () => (useTiny ? tiny : full);
        const chance = () => (lossKind === 'softmax' ? Math.log(3) : 2);
        const acc = () => {
          let ok = 0;
          const I = idx();
          for (const i of I) if (net.predict([data.X[2 * i]!, data.X[2 * i + 1]!]) === data.y[i]) ok++;
          return ok / I.length;
        };
        const regionPl = f.plot({
          aspect: 1.3,
          domain: [-1.1, 1.1, -1.1, 1.1],
          draw: (pp) => {
            regions(pp, net, 52, 6);
            const I = new Set(idx());
            for (let i = 0; i < data.n; i++) {
              const on = I.has(i);
              if (!on && useTiny) continue;
              pp.dot(data.X[2 * i]!, data.X[2 * i + 1]!, on && useTiny ? 5.5 : 3.2, color(CLASS_COLORS[data.y[i]!]!), on && useTiny ? color('--ink') : undefined);
            }
          },
        });
        const chart = f.plot({
          height: 120,
          square: false,
          domain: [0, 2000, 0, 2.5],
          draw: (pp) => {
            const top = Math.max(2.2, chance() * 1.35, ...losses.slice(0, 3));
            pp.setDomain(0, 2000, 0, top);
            hgrid(pp, [0.5, 1, 1.5, 2, 2.5, 3].filter((v) => v < top - 0.25), (v) => fmt(v, 2));
            pp.path([0, 2000], [chance(), chance()], color('--ink-2'), 1.2, [6, 4]);
            pp.text(lossKind === 'softmax' ? 'chance: ln 3 = 1.099' : 'chance: (3 - 1) × 1 = 2', 1980, chance() + top * 0.03, { size: 11, align: 'right', color: color('--ink-2') });
            if (losses.length > 1) pp.path(losses.map((_, i) => i * 10), losses, color('red'), 2);
            pp.text('loss', 1980, top * 0.97, { size: 11, align: 'right', base: 'top', color: color('red') });
          },
        });
        const l0Ro = f.readout('step 0 loss', { sym: 'L' });
        const lossRo = f.readout('loss now', { sym: 'L' });
        const accRo = f.readout('train acc');
        const reset = () => {
          net = new MLP({ sizes: [2, 50, 3], init: std, seed: 1 });
          it = 0;
          losses.length = 0;
          const l0 = net.lossAndGrad(data.X, data.y, idx(), { loss: lossKind, reg });
          losses.push(l0);
          l0Ro.set(l0.toFixed(4));
          lossRo.set(l0.toFixed(4));
          accRo.set(`${Math.round(acc() * 100)}%`);
          f.code.setMany({ l0: l0.toFixed(4), chance: lossKind === 'softmax' ? 'ln 3 = 1.0986' : '2', it: 0, loss: fmt(l0, 4), acc: `${Math.round(acc() * 100)}%` });
          f.code.highlight('init');
          regionPl.redraw();
          chart.redraw();
        };
        const loop = f.loop(() => {
          let l = 0;
          for (let k = 0; k < 10; k++) {
            l = net.lossAndGrad(data.X, data.y, idx(), { loss: lossKind, reg });
            net.step(0.01, 'adam');
            it++;
          }
          losses.push(l);
          lossRo.set(fmt(l, 4));
          const a = acc();
          accRo.set(`${Math.round(a * 100)}%`);
          f.code.setMany({ it, loss: fmt(l, 3), acc: `${Math.round(a * 100)}%` });
          f.code.highlight('step');
          if (it % 50 === 0) regionPl.redraw();
          chart.redraw();
          if (it >= 2000) {
            stop();
            regionPl.redraw();
            return false;
          }
        });
        const stop = () => {
          loop.stop();
          btn.textContent = 'Train';
        };
        const btn = f.button('Train', () => {
          if (loop.running()) stop();
          else {
            if (it >= 2000) reset();
            loop.start();
            btn.textContent = 'Pause';
          }
        }, { primary: true });
        f.button('Reset', () => {
          stop();
          reset();
        }, { icon: 'reset' });
        f.segmented({
          label: 'loss',
          options: [
            { value: 'softmax', label: 'softmax' },
            { value: 'svm', label: 'SVM' },
          ],
          value: 'softmax',
          onChange: (v) => {
            lossKind = v as 'softmax' | 'svm';
            stop();
            reset();
          },
        });
        f.segmented({
          label: 'data',
          options: [
            { value: '20', label: '20 examples' },
            { value: '300', label: 'all 300' },
          ],
          value: '20',
          slot: 'n',
          onChange: (v) => {
            useTiny = v === '20';
            stop();
            reset();
          },
        });
        f.segmented({
          label: 'λ',
          options: [
            { value: '0', label: '0' },
            { value: '0.01', label: '0.01' },
            { value: '0.1', label: '0.1' },
            { value: '1', label: '1' },
          ],
          value: '0',
          slot: 'reg',
          onChange: (v) => {
            reg = Number(v);
            stop();
            reset();
          },
        });
        f.segmented({
          label: 'init std',
          options: [
            { value: '0.01', label: '0.01' },
            { value: '1', label: '1.0' },
          ],
          value: '0.01',
          slot: 'std',
          onChange: (v) => {
            std = Number(v);
            stop();
            reset();
          },
        });
        reset();
      },
      caption: `A two-layer network (50 hidden units) on 20 points of the spiral data. Before pressing anything, check 1: the step-0 loss is 1.0986, exactly $\\ln 3$. Switch the loss to **SVM** and it is 2, as predicted. Check 2: raise $\\symlam$ and the step-0 loss rises (only slightly here, because the initial weights are tiny). Check 3: with $\\symlam = 0$, press **Train**: the loss heads to zero and the decision regions twist themselves around every one of the 20 points until training accuracy is 100%. Now try **init std 1.0**: the starting loss is no longer at chance level, a sign that the initial weights are too large. Finally, set $\\symlam$ above 0 and train again: even $\\symlam = 0.01$ keeps the network from memorizing the 20 points (it stalls around 65% training accuracy), which is why this check is run with regularization off.`,
    });

    // ------------------------------------------------------------------ babysitting
    p.h2('Babysitting the learning process', 'babysitting');
    p.prose(`
Once the checks pass, start training and **watch it.** A few quantities, plotted as training goes, tell you almost everything about whether the run is healthy. Plot them against **epochs** rather than iterations. An epoch is one full pass over the training set, so the x-axis then means the same thing no matter what batch size you use.

### The loss curve

The shape of the loss curve is the single best diagnostic of the learning rate. The figure trains four copies of the same network, identical except for the learning rate, on the spiral data.`);

    p.figure({
      title: 'Four learning rates, one network',
      codeTitle: 'train_lr.py',
      code: `
        learning_rate = {{lr:0.5}}        # {{name:good}}
        batch_size = {{B:32}}
        for epoch in range(60):
            for it in range(N // batch_size):
                idx = np.random.choice(N, batch_size)
                loss, grads = model.loss(X[idx], y[idx])   #@loss
                for k in model.params:
                    update = -learning_rate * grads[k]         #@upd
                    model.params[k] += update                  #@upd
        # epoch {{ep:0}}   loss {{loss:…}}
        # norm(update) / norm(W1) = {{ratio:…}}               #@ratio
      `,
      setup(f) {
        const data = spiral(100, 3, 0.2, 3);
        const N = data.n;
        const ALL = Int32Array.from({ length: N }, (_, i) => i);
        const runs = [
          { name: 'low', lr: 0.02, col: 'blue' as const },
          { name: 'good', lr: 0.5, col: 'green' as const },
          { name: 'high', lr: 4, col: 'orange' as const },
          { name: 'very high', lr: 15, col: 'red' as const },
        ].map((r) => ({ ...r, net: new MLP({ sizes: [2, 100, 3], init: 'he', seed: 1 }), rng: new Rng(7), iters: [] as number[], losses: [] as number[], epochs: [] as number[], seen: 0, ratio: 0, dead: false }));
        let B = 32;
        let sel = 1;
        const EPOCHS = 60;
        const fullLoss = (r: (typeof runs)[number]) => r.net.lossAndGrad(data.X, data.y, ALL, { reg: 1e-3 });
        const reset = () => {
          for (const r of runs) {
            r.net.reset('he', 1);
            r.rng = new Rng(7);
            r.iters = [];
            r.losses = [];
            r.epochs = [fullLoss(r)];
            r.seen = 0;
            r.ratio = 0;
            r.dead = false;
          }
          chart.redraw();
          sync();
        };
        const stepRun = (r: (typeof runs)[number]) => {
          if (r.dead) return;
          const idx = B >= N ? ALL : Int32Array.from({ length: B }, () => r.rng.int(N));
          const loss = r.net.lossAndGrad(data.X, data.y, idx, { reg: 1e-3 });
          const L = r.net.layers[0]!;
          let nu = 0, nw = 0;
          for (let i = 0; i < L.W.length; i++) {
            nu += (r.lr * L.dW[i]!) ** 2;
            nw += L.W[i]! ** 2;
          }
          r.ratio = Math.sqrt(nu / Math.max(nw, 1e-30));
          r.net.step(r.lr);
          r.seen += idx.length;
          if (!Number.isFinite(loss) || loss > 1e6) {
            r.dead = true;
            return;
          }
          r.iters.push(r.seen / N);
          r.losses.push(loss);
          // at each epoch boundary, measure the loss on the whole training set
          while (r.epochs.length <= Math.floor(r.seen / N)) r.epochs.push(fullLoss(r));
        };
        const chart = f.plot({
          aspect: 1.45,
          square: false,
          domain: [0, EPOCHS + 9, 0, 1.6],
          draw: (pp) => {
            const top = 1.6;
            hgrid(pp, [0.4, 0.8, 1.2], (v) => fmt(v, 2));
            const c = pp.ctx;
            c.fillStyle = color('--ink-3');
            c.font = mono(10.5);
            c.textAlign = 'center';
            c.textBaseline = 'bottom';
            for (let e = 10; e < EPOCHS; e += 10) c.fillText(String(e), pp.sx(e), pp.h - 2);
            const s = runs[sel]!;
            if (s.iters.length > 1) pp.path(s.iters, s.losses.map((v) => Math.min(v, top + 1)), withAlpha(color(s.col), 0.3), 1);
            const labels: { y: number; r: (typeof runs)[number]; k: number; x: number }[] = [];
            runs.forEach((r, k) => {
              const ys = r.epochs.map((v) => Math.min(v, top * 3));
              const xs = ys.map((_, i) => i);
              if (xs.length > 1) pp.path(xs, ys, color(r.col), k === sel ? 3 : 1.8);
              if (ys.length > 2) labels.push({ y: Math.min(ys[ys.length - 1]!, top * 0.97), r, k, x: xs[xs.length - 1]! });
            });
            // keep the end labels from overlapping
            labels.sort((a, b) => b.y - a.y);
            for (let i = 1; i < labels.length; i++) labels[i]!.y = Math.min(labels[i]!.y, labels[i - 1]!.y - 0.09);
            for (const l of labels) {
              const txt = l.r.dead ? `${l.r.name} (NaN)` : l.r.name;
              c.font = `${l.k === sel ? '600 ' : ''}11px system-ui, sans-serif`;
              const tw = c.measureText(txt).width;
              c.fillStyle = color(l.r.col);
              c.textAlign = 'left';
              c.textBaseline = 'middle';
              c.fillText(txt, Math.min(pp.sx(l.x) + 4, pp.w - tw - 3), pp.sy(l.y));
            }
            pp.text('epoch →', EPOCHS + 8.5, top * 0.06, { size: 11, align: 'right', color: color('--ink-3') });
          },
        });
        const ratioRo = f.readout('update / weight');
        const epRo = f.readout('epoch');
        const sync = () => {
          const s = runs[sel]!;
          f.code.setMany({
            lr: String(s.lr), name: s.name, B: String(B),
            ep: Math.floor(s.seen / N), loss: s.epochs.length ? fmt(s.epochs[s.epochs.length - 1]!, 3) : '…',
            ratio: s.ratio ? s.ratio.toExponential(1) : '…',
          });
          ratioRo.set(s.ratio ? s.ratio.toExponential(1) : '–');
          epRo.set(Math.floor(s.seen / N));
        };
        let phase = 0;
        const loop = f.loop(() => {
          for (const r of runs) {
            const target = r.seen + 75;
            while (r.seen < target && r.seen < EPOCHS * N && !r.dead) stepRun(r);
          }
          f.code.highlight(['loss', 'upd', 'ratio'][phase++ % 3]!);
          sync();
          chart.redraw();
          if (runs.every((r) => r.dead || r.seen >= EPOCHS * N)) {
            stop();
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
            if (runs.every((r) => r.dead || r.seen >= EPOCHS * N)) reset();
            loop.start();
            btn.textContent = 'Pause';
          }
        }, { primary: true });
        f.button('Reset', () => {
          stop();
          reset();
        }, { icon: 'reset' });
        f.segmented({
          label: 'show',
          options: runs.map((r, i) => ({ value: String(i), label: r.name })),
          value: '1',
          onChange: (v) => {
            sel = Number(v);
            sync();
            chart.redraw();
          },
        });
        f.segmented({
          label: 'batch size',
          options: [
            { value: '8', label: '8' },
            { value: '32', label: '32' },
            { value: '128', label: '128' },
            { value: '300', label: 'all' },
          ],
          value: '32',
          onChange: (v) => {
            B = Number(v);
            stop();
            reset();
          },
        });
        reset();
      },
      caption: `Press **Train**. The bold lines are each run's loss on the whole training set, measured at the end of every epoch; the faint line behind the selected run is its loss on every single mini-batch. The **low** learning rate improves slowly and almost linearly. The **good** one drops quickly and keeps improving. The **high** one drops fast at first but then stalls at a worse level, bouncing around because each step overshoots. The **very high** one makes the loss go *up* (here it shoots off the top of the chart and never recovers). Change the **batch size** and watch the faint line: tiny batches give very noisy per-step losses, the full batch gives a smooth one. (Which rate counts as "good" also depends on the batch size: these labels fit batches of 32.) The readout is the ratio of update size to weight size in the first layer for the selected run, explained below.`,
    });

    p.prose(`
Reading loss curves in practice:

- **Low learning rate:** the improvement looks linear and slow.
- **High learning rate:** the curve looks more exponential, dropping fast, but it then levels off at a worse loss than a good rate would reach. The optimization has too much "energy": the parameters bounce around chaotically and cannot settle into the deeper, narrower parts of the loss landscape.
- **Very high learning rate:** the loss increases, often all the way to \`inf\` or \`NaN\`. In the 2016 lecture's walk-through, a learning rate of 1e6 gave \`NaN\` immediately, and 3e-3 was still too high; 1e-6 was too low, with the loss barely moving. A rough working range turned out to be 1e-5 to 1e-3.
- **The wiggle** in the per-iteration loss reflects the batch size: a batch of one example is very noisy, and the full dataset gives a curve that should go down at every step (unless the learning rate is too high).
- **A plateau followed by a sudden drop** often means a bad initialization: the network spent a while doing nothing useful before finding its way.
- Some people plot the loss on a log scale, because learning progress is roughly exponential and looks closer to a straight line there.

### Training versus validation accuracy

The second plot to keep is accuracy on the training set and on the validation set, checked every epoch or so. The **gap** between them measures overfitting.`);

    p.figure({
      title: 'Training and validation accuracy: reading the gap',
      codeTitle: 'train_val.py',
      code: `
        model = Net(sizes=[2, {{arch:48, 48, }}2])
        X_train, y_train = data[:{{n:60}}]  # 10% mislabeled
        reg = {{reg:1e-4}}
        for it in range(1500):
            loss, grads = model.loss(X_batch, y_batch, reg)  #@step
            adam_update(model, grads, learning_rate=1e-2)    #@step
            if it % 25 == 0:
                tr = np.mean(model.predict(X_train) == y_train) #@acc
                va = np.mean(model.predict(X_val) == y_val)     #@acc
        # tr {{tr:…}}, va {{va:…}}, gap {{gap:…}}
      `,
      setup(f) {
        const val = wavy(1000, 4, 0.1);
        let nTrain = 60;
        let big = true;
        let reg = 1e-4;
        let train = wavy(nTrain, 3, 0.1);
        const sizesOf = () => (big ? [2, 48, 48, 2] : [2, 2]);
        let net = new MLP({ sizes: sizesOf(), init: 'he', seed: 2 });
        let it = 0;
        let rng = new Rng(9);
        const hist: { it: number; tr: number; va: number }[] = [];
        const TOTAL = 1500;
        const regionPl = f.plot({
          aspect: 1.35,
          domain: [-1.05, 1.05, -1.05, 1.05],
          draw: (pp) => {
            regions(pp, net, 50, 7);
            const xs: number[] = [], ys: number[] = [];
            for (let i = 0; i <= 80; i++) {
              const a = -1 + (2 * i) / 80;
              xs.push(a);
              ys.push(0.5 * Math.sin(4 * a));
            }
            pp.path(xs, ys, withAlpha(color('--ink'), 0.45), 1.5, [5, 4]);
            for (let i = 0; i < train.n; i++) pp.dot(train.X[2 * i]!, train.X[2 * i + 1]!, nTrain > 100 ? 2.8 : 4.6, color(CLASS_COLORS[train.y[i]!]!), nTrain > 100 ? undefined : color('--paper'));
          },
        });
        const chart = f.plot({
          height: 128,
          square: false,
          domain: [0, TOTAL, 0.45, 1.04],
          draw: (pp) => {
            hgrid(pp, [0.6, 0.7, 0.8, 0.9], (v) => `${Math.round(v * 100)}%`);
            pp.path([0, TOTAL], [0.9, 0.9], withAlpha(color('--ink-2'), 0.5), 1, [3, 4]);
            if (hist.length > 1) {
              pp.path(hist.map((h) => h.it), hist.map((h) => h.tr), color('blue'), 2.2);
              pp.path(hist.map((h) => h.it), hist.map((h) => h.va), color('orange'), 2.2);
            }
            pp.text('train', TOTAL * 0.55, 0.5, { size: 11, bold: true, base: 'middle', color: color('blue') });
            pp.text('validation', TOTAL * 0.66, 0.5, { size: 11, bold: true, base: 'middle', color: color('orange') });
            pp.text('best possible: 90%', TOTAL * 0.98, 0.875, { size: 10.5, align: 'right', base: 'top', color: color('--ink-3') });
          },
        });
        const trRo = f.readout('train');
        const vaRo = f.readout('val');
        const gapRo = f.readout('gap');
        const measure = () => {
          const tr = net.accuracy(train.X, train.y, train.n);
          const va = net.accuracy(val.X, val.y, val.n);
          hist.push({ it, tr, va });
          trRo.set(`${Math.round(tr * 100)}%`);
          vaRo.set(`${Math.round(va * 100)}%`);
          gapRo.set(`${Math.round((tr - va) * 100)} pts`);
          f.code.setMany({ tr: `${Math.round(tr * 100)}%`, va: `${Math.round(va * 100)}%`, gap: `${Math.round((tr - va) * 100)} pts` });
        };
        const reset = () => {
          train = wavy(nTrain, 3, 0.1);
          net = new MLP({ sizes: sizesOf(), init: 'he', seed: 2 });
          rng = new Rng(9);
          it = 0;
          hist.length = 0;
          measure();
          regionPl.redraw();
          chart.redraw();
        };
        let frames = 0;
        const loop = f.loop(() => {
          for (let k = 0; k < 5 && it < TOTAL; k++) {
            const idx = train.n <= 64 ? Int32Array.from({ length: train.n }, (_, i) => i) : Int32Array.from({ length: 64 }, () => rng.int(train.n));
            net.lossAndGrad(train.X, train.y, idx, { reg });
            net.step(0.01, 'adam');
            it++;
            if (it % 25 === 0) measure();
          }
          f.code.highlight(it % 25 < 5 ? 'acc' : 'step');
          if (++frames % 12 === 0 || it >= TOTAL) regionPl.redraw();
          chart.redraw();
          if (it >= TOTAL) {
            stop();
            return false;
          }
        });
        const stop = () => {
          loop.stop();
          btn.textContent = 'Train';
          f.code.highlight(null);
        };
        const restart = () => {
          stop();
          reset();
          loop.start();
          btn.textContent = 'Pause';
        };
        const btn = f.button('Train', () => {
          if (loop.running()) stop();
          else {
            if (it >= TOTAL) reset();
            loop.start();
            btn.textContent = 'Pause';
          }
        }, { primary: true });
        f.segmented({
          label: 'model',
          options: [
            { value: 'big', label: '2 hidden layers' },
            { value: 'linear', label: 'linear' },
          ],
          value: 'big',
          onChange: (v) => {
            big = v === 'big';
            f.code.set('arch', big ? '48, 48, ' : '');
            restart();
          },
        });
        f.segmented({
          label: 'training points',
          options: [
            { value: '60', label: '60' },
            { value: '400', label: '400' },
          ],
          value: '60',
          slot: 'n',
          onChange: (v) => {
            nTrain = Number(v);
            restart();
          },
        });
        f.slider({
          label: 'λ',
          sym: 'lam',
          min: -4,
          max: -1,
          step: 0.05,
          value: -4,
          map: (r) => 10 ** r,
          format: (v) => fmt(v, 2),
          slot: 'reg',
          onInput: (v) => {
            reg = v;
          },
        }).input.addEventListener('change', () => restart());
        reset();
      },
      caption: `A network learns to separate two classes along the dashed wavy boundary, from only 60 training points, 10% of which carry the wrong label (so no model can beat 90% on new data). Press **Train**. The training accuracy (blue) climbs to 100% as the decision regions contort to fit even the mislabeled points, while validation accuracy (orange) stalls just below 80%: a big gap, the signature of **overfitting**. Two remedies. Raise $\\symlam$ to about 0.006 (training restarts when you let go of the slider): the regions smooth out, the gap shrinks and validation accuracy rises to about 85%. Or switch to **400** training points, which closes the gap without any regularization. Push $\\symlam$ past about 0.02 and both curves sink together. Finally pick the **linear** model: train and validation stay close together, but both are stuck near 80%, well below what is possible. No gap but low accuracy means the model lacks **capacity**: make it bigger.`,
    });

    p.prose(`
In summary: a **large gap** (validation much worse than training) means overfitting, so increase regularization (a stronger L2 penalty, more dropout) or collect more data. **No gap** with mediocre accuracy means the model is not powerful enough to fit even the training data, so make it larger: more units, more layers.

### The ratio of updates to weights

A third number worth tracking is how big each update is compared with the weights it changes. Track it separately for each set of parameters (each layer's weights, say). Note that this is the *update* (for plain SGD, the gradient times the learning rate), not the raw gradient:`);

    p.code(`
      param_scale = np.linalg.norm(W.ravel())
      update = -learning_rate * dW   # the SGD update
      update_scale = np.linalg.norm(update.ravel())
      W += update                    # the actual update
      print(update_scale / param_scale)   # want ~1e-3
    `, { title: 'update_ratio.py' });

    p.prose(`
A rough heuristic is that the ratio should be around $10^{-3}$, that is, each update changes the weights by about a thousandth of their size. Much lower, and the learning rate is probably too low; much higher, and it is probably too high. (The Euclidean norm used here, the square root of the sum of squares, is a single number for the size of a whole array; tracking the minimum and maximum instead gives similar information.) In Fig 9.3, the low run sits near $10^{-4}$, the good run near $10^{-3}$, and the two high ones around $10^{-2}$ or more.

### Activation and gradient distributions

An incorrect initialization can slow or stall learning entirely, and it is easy to diagnose: plot histograms of the activations (and the gradients) of every layer, as in Fig 8.3. With tanh units, for example, you want to see activations spread across the whole range from $-1$ to $1$, not all crowded at zero and not all piled up at $\\pm 1$.

### First-layer weights

When the inputs are images, look at the first layer's weights as pictures, the way Chapter 4 displayed the linear classifier's templates. Noisy, speckled filters are a warning sign: the network may be unconverged, the learning rate badly set, or the weight regularization too weak. Smooth, clean and diverse filters (edges, color blobs, gradients at many orientations) are a good sign that training is going well. Chapter 12 looks at trained filters in detail.`);

    // ------------------------------------------------------------------ updates
    p.h2('Parameter updates', 'updates');
    p.prose(`
Backpropagation gives the gradient. What you *do* with it is the **update rule**, and there are better choices than the plain step downhill from Chapter 5.

### SGD and momentum

**Vanilla gradient descent** steps straight down the slope: \`w += -learning_rate * dw\`. Its weakness shows on loss surfaces shaped like a long, narrow valley, which are very common: the gradient points mostly *across* the valley (where it is steep) rather than *along* it (where the progress is). Gradient descent zigzags from wall to wall and creeps along the floor.

**Momentum** borrows from physics. Think of the loss as the height of a hilly landscape and the parameters as a ball rolling on it. The ball starts at rest. The gradient is the force of gravity, and instead of setting the ball's position directly, it changes the ball's **velocity**; the velocity then moves the position. Sideways pushes from the two valley walls cancel out over time, while the steady push along the floor keeps adding up, so the ball builds up speed in the direction that matters.`);

    p.math({
      label: 'SGD, and SGD with momentum',
      tex: String.raw`\begin{aligned}\text{SGD:}\quad \symw &\leftarrow \symw - \symlr\,\symdw \\[2pt] \text{momentum:}\quad v &\leftarrow \symmu\,v - \symlr\,\symdw \\ \symw &\leftarrow \symw + v\end{aligned}`,
      code: `
        # vanilla update
        w += -learning_rate * dw

        # momentum update
        v = mu * v - learning_rate * dw  # velocity
        w += v                           # position
      `,
      codeTitle: 'sgd_momentum.py',
      terms: [
        [String.raw`\symw \leftarrow \ldots`, 'the arrow means "replace with": compute the right side, store it in $\\symw$'],
        [String.raw`\symlr\,\symdw`, 'the learning rate times the gradient: a step in the direction the loss rises fastest, so we subtract it'],
        [String.raw`v`, 'the velocity, one number per parameter, starting at zero'],
        [String.raw`\symmu\,v`, 'last step\'s velocity, shrunk a little. $\\symmu$ is called "momentum", but it acts more like friction'],
      ],
      explain: `Without the friction term $\\symmu$ the ball would never stop rolling at the bottom; with $\\symmu = 0$ it is plain SGD again. Typical values are 0.5, 0.9, 0.95 and 0.99 (0.9 is the common default), and some schedules start around 0.5 and raise it toward 0.99 over training. Unrolling the update shows what momentum does: each step is a sum of all past gradients, with older ones weighted by higher powers of $\\symmu$. In directions where the gradient keeps its sign, those add up and the steps grow, up to $1/(1-\\symmu)$ times larger (10 times, for $\\symmu = 0.9$). In directions where it keeps flipping, they cancel.`,
    });

    p.prose(`
### Nesterov momentum

**Nesterov's accelerated gradient** is a small twist on momentum with stronger theoretical guarantees for convex problems, and in practice it consistently works a little better. The observation: the momentum term alone is going to move the parameters by $\\symmu v$ no matter what the gradient says. So why measure the gradient at the current position? Measure it at the **look-ahead** position $\\symw + \\symmu v$, where you are about to be anyway. If the ball is about to overshoot, the gradient there already says so and can brake in time.`);

    p.math({
      label: 'Nesterov momentum',
      tex: String.raw`\begin{aligned} v &\leftarrow \symmu\,v - \symlr\,\nabla L(\symw + \symmu v) \\ \symw &\leftarrow \symw + v\end{aligned}`,
      code: `
        w_ahead = w + mu * v
        # dw_ahead: the gradient at w_ahead, not at w
        v = mu * v - learning_rate * dw_ahead
        w += v

        # the form used in practice: same algorithm,
        # but the stored w is the look-ahead point
        v_prev = v                       # back this up
        v = mu * v - learning_rate * dw  # as in momentum
        w += -mu * v_prev + (1 + mu) * v # this changes
      `,
      codeTitle: 'nesterov.py',
      terms: [
        [String.raw`\symw + \symmu v`, 'where momentum alone would carry the parameters next: the look-ahead point'],
        [String.raw`\nabla L(\symw + \symmu v)`, 'the gradient measured *there* rather than at $\\symw$'],
      ],
      explain: 'The first version is the idea; the second is the same update after a change of variables, so it only needs the gradient at the stored point, like every other method. That is how it appears in code (and in Assignment 2, which asks you to implement it).',
    });

    p.prose(`
### Per-parameter adaptive learning rates

Everything so far uses one learning rate for every parameter. A family of methods instead **adapts the step size for each parameter separately**, based on the history of its gradients.

**Adagrad** (Duchi et al., 2011) keeps a running *sum* of each parameter's squared gradients, and divides every step by its square root. Parameters that receive large gradients get their effective learning rate reduced; parameters with small or rare gradients get theirs boosted. The square root turns out to matter a lot: without it the method works much worse. The catch for deep learning is that the sum only grows, so the effective learning rate shrinks monotonically, usually too aggressively, and learning stops too early.

**RMSprop** is a fix proposed by Geoff Hinton, never formally published: it appears on slide 29 of lecture 6 of his Coursera course, and is cited that way. It replaces the sum with a *moving average* of recent squared gradients, so the effective learning rate adapts up and down instead of only decaying.`);

    p.math({
      label: 'Adagrad and RMSprop',
      tex: String.raw`\begin{aligned}\text{Adagrad:}\quad c &\leftarrow c + (\symdw)^2 \\ \text{RMSprop:}\quad c &\leftarrow \rho\,c + (1 - \rho)\,(\symdw)^2 \\ \text{both:}\quad \symw &\leftarrow \symw - \frac{\symlr\,\symdw}{\sqrt{c} + \epsilon}\end{aligned}`,
      code: `
        # Adagrad
        cache += dw ** 2
        w += -learning_rate * dw / (np.sqrt(cache) + eps)

        # RMSprop
        cache = (decay_rate * cache
                 + (1 - decay_rate) * dw ** 2)
        w += -learning_rate * dw / (np.sqrt(cache) + eps)
      `,
      codeTitle: 'adagrad_rmsprop.py',
      terms: [
        [String.raw`c`, 'the `cache`: one number per parameter that remembers how large its gradients have been. Everything here is element-wise, per parameter'],
        [String.raw`(\symdw)^2`, 'each entry of the gradient, squared (so its sign does not matter, only its size)'],
        [String.raw`\rho`, 'the `decay_rate` of RMSprop, typically 0.9, 0.99 or 0.999: how long its memory is'],
        [String.raw`\sqrt{c} + \epsilon`, 'the typical recent gradient size; $\\epsilon$ (around $10^{-8}$ to $10^{-4}$) prevents division by zero'],
      ],
      explain: 'Dividing the gradient by its own typical size normalizes the step: every parameter moves by roughly the learning rate, whether its gradients are huge or tiny. In the long valley, that means the steep direction is tamed and the shallow direction is sped up, which is exactly the cure for zigzagging.',
    });

    p.prose(`
**Adam** (Kingma and Ba, 2014) combines the two ideas: it keeps a moving average of the gradients themselves (like momentum's velocity) *and* a moving average of the squared gradients (like RMSprop's cache), and steps with the first divided by the square root of the second.`);

    p.math({
      label: 'Adam',
      tex: String.raw`\begin{aligned} m &\leftarrow \beta_1 m + (1 - \beta_1)\,\symdw \\ v &\leftarrow \beta_2 v + (1 - \beta_2)\,(\symdw)^2 \\ \hat m &= \frac{m}{1 - \beta_1^{\,t}}, \quad \hat v = \frac{v}{1 - \beta_2^{\,t}} \\ \symw &\leftarrow \symw - \frac{\symlr\,\hat m}{\sqrt{\hat v} + \epsilon}\end{aligned}`,
      code: `
        # t counts updates: 1, 2, 3, ...
        # defaults: beta1 = 0.9, beta2 = 0.999, eps = 1e-8
        m = beta1 * m + (1 - beta1) * dw
        mt = m / (1 - beta1 ** t)        # bias correction
        v = beta2 * v + (1 - beta2) * (dw ** 2)
        vt = v / (1 - beta2 ** t)        # bias correction
        w += -learning_rate * mt / (np.sqrt(vt) + eps)
      `,
      codeTitle: 'adam.py',
      terms: [
        [String.raw`m`, 'the first moment: a moving average of the gradient, a smoothed (less noisy) direction, like momentum\'s velocity'],
        [String.raw`v`, 'the second moment: a moving average of the squared gradient, exactly like RMSprop\'s cache'],
        [String.raw`\hat m,\ \hat v`, 'bias-corrected versions. Both averages start at zero, so for the first steps they are too small; dividing by $1 - \\beta^t$ (tiny at first, near 1 later) undoes that'],
        [String.raw`\beta_1, \beta_2`, 'the memory lengths, recommended at 0.9 and 0.999, with $\\epsilon = 10^{-8}$'],
      ],
      explain: 'Without the bias correction, the very first update would divide $m = 0.1\\,\\symdw$ by $\\sqrt{v} = \\sqrt{0.001}\\,|\\symdw| \\approx 0.03\\,|\\symdw|$: a step about three times larger than intended. The correction makes the early steps behave like the later ones. Adam was the recommended default in the 2016 course, and usually works a little better than RMSprop. SGD with Nesterov momentum remains a strong alternative worth trying.',
    });

    p.figure({
      title: 'The update rules race on three loss surfaces',
      codeTitle: 'update_rules.py',
      code: `
        # w: the 2 parameters, dw: the gradient at w
        mu, decay, eps = 0.9, 0.99, 1e-8
        beta1, beta2 = 0.9, 0.999
        learning_rate = {{lr}}      # {{optname:SGD}} on {{surf:valley}}
        # SGD
        w += -learning_rate * dw                            #@sgd
        # Momentum
        v = mu * v - learning_rate * dw                     #@momentum
        w += v                                              #@momentum
        # Nesterov
        v_prev = v                                          #@nesterov
        v = mu * v - learning_rate * dw                     #@nesterov
        w += -mu * v_prev + (1 + mu) * v                    #@nesterov
        # Adagrad
        cache += dw ** 2                                    #@adagrad
        w += -learning_rate * dw / (np.sqrt(cache) + eps)   #@adagrad
        # RMSprop
        cache = decay * cache + (1 - decay) * dw ** 2       #@rmsprop
        w += -learning_rate * dw / (np.sqrt(cache) + eps)   #@rmsprop
        # Adam
        m = beta1 * m + (1 - beta1) * dw                    #@adam
        v = beta2 * v + (1 - beta2) * dw ** 2               #@adam
        mt, vt = m / (1 - beta1 ** t), v / (1 - beta2 ** t) #@adam
        w += -learning_rate * mt / (np.sqrt(vt) + eps)      #@adam
        # Newton (no learning rate; H = the 2 x 2 Hessian)
        w += -np.linalg.solve(H, dw)                        #@newton
        # step {{t:0}}: w = [{{w0}}, {{w1}}], loss {{loss}}
      `,
      setup(f) {
        let surf = SURFACES[0]!;
        let sel: OptName = 'sgd';
        let mult = 1;
        let showNewton = false;
        let start: [number, number] = [...surf.start];
        let walkers: Walker[] = [];
        const MAXSTEPS = 400;
        let steps = 0;
        const names = () => OPT_NAMES.filter((n) => n !== 'newton' || showNewton);
        const resetWalkers = () => {
          walkers = names().map((n) => new Walker(n, start));
          steps = 0;
        };
        resetWalkers();
        let cacheKey = '';
        let cacheCanvas: HTMLCanvasElement | null = null;
        const contour = (pp: Plot) => {
          const key = `${surf.id}|${pp.w}|${pp.h}|${color('--paper')}`;
          if (key !== cacheKey) {
            cacheKey = key;
            const cell = 2;
            const cols = Math.ceil(pp.w / cell), rows = Math.ceil(pp.h / cell);
            const img = new ImageData(cols, rows);
            const ink = rgbOf(color('slate'));
            const lv = (v: number) => Math.log(v - surf.fmin + 0.02);
            const [x0, x1, y0, y1] = pp.view();
            let lo = Infinity, hi = -Infinity;
            const vals = new Float64Array(cols * rows);
            for (let j = 0; j < rows; j++)
              for (let i = 0; i < cols; i++) {
                const x = x0 + ((i + 0.5) / cols) * (x1 - x0), y = y1 - ((j + 0.5) / rows) * (y1 - y0);
                const v = lv(surf.f(x, y));
                vals[j * cols + i] = v;
                lo = Math.min(lo, v);
                hi = Math.max(hi, v);
              }
            const bands = 15;
            const band = new Int32Array(vals.length);
            for (let q = 0; q < vals.length; q++) band[q] = Math.floor(((vals[q]! - lo) / (hi - lo)) * bands);
            for (let j = 0; j < rows; j++)
              for (let i = 0; i < cols; i++) {
                const q = j * cols + i;
                const t = (vals[q]! - lo) / (hi - lo);
                const edge = (i + 1 < cols && band[q + 1] !== band[q]) || (j + 1 < rows && band[q + cols] !== band[q]);
                img.data[q * 4] = ink[0];
                img.data[q * 4 + 1] = ink[1];
                img.data[q * 4 + 2] = ink[2];
                img.data[q * 4 + 3] = edge ? 120 : 6 + 46 * t;
              }
            cacheCanvas = document.createElement('canvas');
            cacheCanvas.width = cols;
            cacheCanvas.height = rows;
            cacheCanvas.getContext('2d')!.putImageData(img, 0, 0);
          }
          if (cacheCanvas) {
            pp.ctx.save();
            pp.ctx.imageSmoothingEnabled = true;
            pp.ctx.drawImage(cacheCanvas, 0, 0, cacheCanvas.width * 2, cacheCanvas.height * 2);
            pp.ctx.restore();
          }
        };
        const pl = f.plot({
          aspect: 1.45,
          domain: surf.domain,
          draw: (pp) => {
            contour(pp);
            for (const [mx, my] of surf.minima) {
              pp.ctx.fillStyle = color('--ink');
              pp.ctx.font = '16px system-ui, sans-serif';
              pp.ctx.textAlign = 'center';
              pp.ctx.textBaseline = 'middle';
              pp.ctx.fillText('★', pp.sx(mx), pp.sy(my));
            }
            for (const wk of walkers) {
              const on = wk.name === sel;
              pp.path(wk.xs, wk.ys, withAlpha(color(OPT_COLOR[wk.name]), on ? 1 : 0.75), on ? 3 : 1.8);
              pp.dot(wk.xs[wk.xs.length - 1]!, wk.ys[wk.ys.length - 1]!, on ? 6 : 4.5, color(OPT_COLOR[wk.name]), color('--paper'));
            }
            pp.dot(start[0], start[1], 4, color('--ink'));
          },
        });
        const legend = document.createElement('div');
        legend.className = 'nnl-legend';
        legend.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px 12px;font:12.5px system-ui,sans-serif;color:var(--ink-2)';
        f.viz.append(legend);
        const drawLegend = () => {
          legend.innerHTML = walkers
            .map((wk) => {
              const loss = surf.f(wk.w[0], wk.w[1]) - surf.fmin;
              const st = wk.dead ? 'diverged' : loss < 1e-3 ? 'at min' : `${fmt(loss, 2)}`;
              return `<span style="display:inline-flex;align-items:center;gap:5px;${wk.name === sel ? 'font-weight:650;color:var(--ink)' : ''}"><span style="width:10px;height:10px;border-radius:50%;background:var(--c-${OPT_COLOR[wk.name]})"></span>${OPT_LABEL[wk.name]} <span style="font-family:var(--font-mono);font-size:11.5px;color:var(--ink-3)">${st}</span></span>`;
            })
            .join('');
        };
        const syncCode = () => {
          const wk = walkers.find((w) => w.name === sel);
          const lr = surf.lr[sel] * (sel === 'newton' ? 1 : mult);
          f.code.setMany({
            lr: sel === 'newton' ? 'None' : fmt(lr, 3),
            optname: OPT_LABEL[sel],
            surf: surf.id,
            t: steps,
            w0: wk ? fmt(wk.w[0], 3) : '–',
            w1: wk ? fmt(wk.w[1], 3) : '–',
            loss: wk ? fmt(surf.f(wk.w[0], wk.w[1]), 3) : '–',
          });
          f.code.highlight(sel);
          drawLegend();
        };
        const loop = f.loop(() => {
          for (let k = 0; k < 2 && steps < MAXSTEPS; k++) {
            for (const wk of walkers) wk.step(surf, surf.lr[wk.name] * (wk.name === 'newton' ? 1 : mult));
            steps++;
          }
          syncCode();
          pl.redraw();
          if (steps >= MAXSTEPS) {
            stop();
            return false;
          }
        });
        const stop = () => {
          loop.stop();
          btn.textContent = 'Run';
        };
        const restart = () => {
          resetWalkers();
          syncCode();
          pl.redraw();
          loop.start();
          btn.textContent = 'Pause';
        };
        const btn = f.button('Run', () => {
          if (loop.running()) stop();
          else if (steps >= MAXSTEPS) restart();
          else {
            loop.start();
            btn.textContent = 'Pause';
          }
        }, { primary: true });
        f.segmented({
          label: 'surface',
          options: SURFACES.map((s) => ({ value: s.id, label: s.id })),
          value: surf.id,
          onChange: (v) => {
            surf = SURFACES.find((s) => s.id === v)!;
            start = [...surf.start];
            pl.setDomain(...surf.domain);
            cacheKey = '';
            stop();
            resetWalkers();
            syncCode();
            pl.redraw();
          },
        });
        f.segmented({
          label: 'code for',
          options: OPT_NAMES.map((n) => ({ value: n, label: OPT_LABEL[n] })),
          value: 'sgd',
          onChange: (v) => {
            sel = v;
            if (sel === 'newton' && !showNewton) newtonTg.set(true);
            syncCode();
            pl.redraw();
          },
        });
        f.slider({
          label: 'learning rates ×',
          sym: 'lr',
          min: -1,
          max: 1,
          step: 0.02,
          value: 0,
          map: (r) => 10 ** r,
          format: (v) => fmt(v, 2),
          onInput: (v) => {
            mult = v;
            syncCode();
          },
        }).input.addEventListener('change', () => restart());
        const newtonTg = f.toggle({
          label: 'include Newton',
          value: false,
          onChange: (v) => {
            showNewton = v;
            if (!v && sel === 'newton') sel = 'sgd';
            stop();
            resetWalkers();
            syncCode();
            pl.redraw();
          },
        });
        pl.canvas.addEventListener('pointerdown', (e) => {
          const [x, y] = pl.pointer(e);
          start = [x, y];
          restart();
        });
        syncCode();
      },
      caption: `Press **Run**, or **tap anywhere on the surface** to start every optimizer from that point. Each update rule gets its own base learning rate, tuned for the surface; the slider scales them all together (release it to restart). On the **valley**, SGD zigzags across the steep direction while crawling along the shallow one; momentum and Nesterov build speed along the floor but overshoot and swing back like a rolling ball (Nesterov less so); Adagrad, RMSprop and Adam rescale each direction and head almost straight for the minimum. On the **saddle**, starting just off the ridge, SGD barely moves away from the high point, because the gradient across the ridge is tiny; RMSprop and Adam divide by that tiny gradient's size, so they escape quickly. On the **banana**, a curved valley, notice how hard the bend is for everyone. Turn on **Newton** to see a second-order method: it reaches the minimum of the valley in a single step, but on the saddle it walks straight to the saddle point and stays there.`,
    });

    p.prose(`
### Annealing the learning rate

With a constant learning rate, the parameters keep bouncing around near a minimum: each mini-batch gradient is noisy, and a big step size keeps kicking them out of the narrow bottom. Slowly lowering the learning rate over training lets them settle. Timing it is the tricky part: decay too slowly and you waste a lot of computation bouncing around with little improvement; decay too fast and the system "cools" before it reaches a good spot.`);

    p.math({
      label: 'Three learning rate schedules',
      tex: String.raw`\begin{aligned}\text{step:}\quad \symlr_t &= \symlr_0 \cdot 0.5^{\lfloor t / T \rfloor} \\ \text{exponential:}\quad \symlr_t &= \symlr_0\,e^{-kt} \\ 1/t\text{:}\quad \symlr_t &= \frac{\symlr_0}{1 + kt}\end{aligned}`,
      code: `
        lr = lr0 * 0.5 ** (epoch // 5)  # step: halve / 5 ep
        lr = lr0 * np.exp(-k * t)       # exponential decay
        lr = lr0 / (1 + k * t)          # 1/t decay
      `,
      codeTitle: 'schedules.py',
      terms: [
        [String.raw`\symlr_0`, 'the initial learning rate'],
        [String.raw`t`, 'the iteration number (or the epoch)'],
        [String.raw`\lfloor t / T \rfloor`, '"floor": how many whole periods of length $T$ have passed. Each one halves the rate'],
        [String.raw`e^{-kt}`, 'shrinks by the same factor every step; $k$ sets how fast'],
        [String.raw`\frac{1}{1+kt}`, 'shrinks quickly at first, then more and more slowly'],
      ],
      explain: 'Step decay is the most common in practice, because its knobs (by how much, and after how many epochs) are easy to interpret, unlike the abstract $k$. Typical settings halve the rate every 5 epochs, or divide it by 10 every 20, but this depends strongly on the problem. A good heuristic: train with a fixed rate while watching the validation error, and cut the rate (say, in half) whenever the validation error stops improving. If you can afford it, err on the side of decaying slowly and training longer.',
    });

    p.figure({
      title: 'Annealing on a noisy bowl',
      codeTitle: 'anneal.py',
      code: `
        lr0, k = {{lr0:0.15}}, {{k:0.005}}
        schedules = {
            'constant':    lambda t: lr0,                      #@const
            'step':        lambda t: lr0 * 0.5 ** (t // 150),  #@step
            'exponential': lambda t: lr0 * np.exp(-k * t),     #@exp
            '1/t':         lambda t: lr0 / (1 + k * t),        #@inv
        }
        for t in range(800):
            # a noisy gradient, like one from a mini-batch
            dw = grad(w) + 1.5 * np.random.randn(2)     #@upd
            w -= schedules[name](t) * dw                #@upd
        # t = {{t:0}}
      `,
      setup(f) {
        const T = 800;
        const fbowl = (x: number, y: number) => 0.5 * (x * x + 5 * y * y);
        let lr0 = 0.15, k = 0.005;
        const scheds = [
          { name: 'constant', key: 'const', col: 'red' as const, lr: (t: number) => lr0 },
          { name: 'step', key: 'step', col: 'blue' as const, lr: (t: number) => lr0 * 0.5 ** Math.floor(t / 150) },
          { name: 'exponential', key: 'exp', col: 'green' as const, lr: (t: number) => lr0 * Math.exp(-k * t) },
          { name: '1/t', key: 'inv', col: 'purple' as const, lr: (t: number) => lr0 / (1 + k * t) },
        ];
        type Run = { w: [number, number]; xs: number[]; ys: number[]; loss: number[]; ema: number; rng: Rng };
        let seed = 3;
        let runs: Run[] = [];
        let t = 0;
        const reset = () => {
          runs = scheds.map(() => ({ w: [-3.6, 1.6], xs: [-3.6], ys: [1.6], loss: [], ema: fbowl(-3.6, 1.6), rng: new Rng(seed) }));
          t = 0;
          plane.redraw();
          chart.redraw();
          sync();
        };
        let sel = 0;
        const plane = f.plot({
          aspect: 1.7,
          domain: [-4, 4, -2, 2],
          draw: (pp) => {
            for (const lev of [0.1, 0.5, 1.5, 3, 5, 8]) {
              const a = Math.sqrt(2 * lev), b = Math.sqrt((2 * lev) / 5);
              const xs: number[] = [], ys: number[] = [];
              for (let i = 0; i <= 72; i++) {
                const th = (i / 72) * Math.PI * 2;
                xs.push(a * Math.cos(th));
                ys.push(b * Math.sin(th));
              }
              pp.path(xs, ys, withAlpha(color('slate'), 0.35), 1);
            }
            runs.forEach((r, i) => {
              const on = i === sel;
              const n = r.xs.length;
              const from = Math.max(0, n - (on ? 400 : 120));
              pp.path(r.xs.slice(from), r.ys.slice(from), withAlpha(color(scheds[i]!.col), on ? 0.9 : 0.35), on ? 1.6 : 1);
              pp.dot(r.w[0], r.w[1], on ? 5.5 : 4, color(scheds[i]!.col), color('--paper'));
            });
            pp.text('★', 0, 0, { size: 14, align: 'center', base: 'middle', color: color('--ink') });
          },
        });
        const chart = f.plot({
          height: 132,
          square: false,
          domain: [0, T, -3.3, 1.4],
          draw: (pp) => {
            hgrid(pp, [-3, -2, -1, 0], (v) => (v === 0 ? '1' : `1e${v}`));
            runs.forEach((r, i) => {
              if (r.loss.length < 2) return;
              pp.path(r.loss.map((_, j) => j), r.loss.map((v) => Math.max(-3.3, Math.log10(v))), color(scheds[i]!.col), i === sel ? 2.6 : 1.6);
            });
            // the highlighted run's learning-rate schedule, scaled into the top band
            const sc = scheds[sel]!;
            const lxs: number[] = [], lys: number[] = [];
            for (let q = 0; q <= T; q += 4) {
              lxs.push(q);
              lys.push(0.45 + 0.8 * (sc.lr(q) / lr0));
            }
            pp.path(lxs, lys, withAlpha(color(sc.col), 0.85), 1.4, [5, 3]);
            pp.text('loss (smoothed, log scale)', T * 0.99, -2.6, { size: 10.5, align: 'right', color: color('--ink-3') });
          },
        });
        const finalRo = f.readout('final loss');
        const sync = () => {
          f.code.set('t', t);
          const r = runs[sel];
          finalRo.set(r && r.loss.length ? r.loss[r.loss.length - 1]!.toExponential(1) : '–');
          f.code.highlight([scheds[sel]!.key, 'upd']);
        };
        const loop = f.loop(() => {
          for (let s = 0; s < 6 && t < T; s++, t++) {
            runs.forEach((r, i) => {
              const lr = scheds[i]!.lr(t);
              const gx = r.w[0] + 1.5 * r.rng.randn();
              const gy = 5 * r.w[1] + 1.5 * r.rng.randn();
              r.w = [r.w[0] - lr * gx, r.w[1] - lr * gy];
              r.xs.push(r.w[0]);
              r.ys.push(r.w[1]);
              r.ema = 0.97 * r.ema + 0.03 * fbowl(r.w[0], r.w[1]);
              r.loss.push(r.ema);
            });
          }
          sync();
          plane.redraw();
          chart.redraw();
          if (t >= T) {
            stop();
            return false;
          }
        });
        const stop = () => {
          loop.stop();
          btn.textContent = 'Run';
        };
        const btn = f.button('Run', () => {
          if (loop.running()) stop();
          else {
            if (t >= T) reset();
            loop.start();
            btn.textContent = 'Pause';
          }
        }, { primary: true });
        f.button('New noise', () => {
          stop();
          seed++;
          reset();
        }, { icon: 'shuffle' });
        f.segmented({
          label: 'highlight',
          options: scheds.map((s, i) => ({ value: String(i), label: s.name })),
          value: '0',
          onChange: (v) => {
            sel = Number(v);
            sync();
            plane.redraw();
            chart.redraw();
          },
        });
        f.slider({ label: 'η₀', sym: 'lr', min: 0.02, max: 0.36, step: 0.01, value: 0.15, slot: 'lr0', onInput: (v) => { lr0 = v; chart.redraw(); } }).input.addEventListener('change', () => { stop(); reset(); });
        f.slider({ label: 'k', min: -3.5, max: -1, step: 0.05, value: Math.log10(0.005), map: (r) => 10 ** r, format: (v) => fmt(v, 2), slot: 'k', onInput: (v) => { k = v; chart.redraw(); } }).input.addEventListener('change', () => { stop(); reset(); });
        reset();
      },
      caption: `Four runs of noisy gradient descent on the same bowl, identical except for the learning rate schedule (the dashed line in the chart shows the highlighted one). Press **Run**. All four rush down at first. Then the **constant** rate keeps rattling around the minimum (the star) and its loss flattens out at a "noise floor"; every decaying schedule settles closer and closer, and its loss keeps falling. Raise $\\symlr_0$ and the constant run's noise floor rises with it. Push $k$ toward 0.1 and the exponential schedule decays so fast that it freezes before reaching the bottom: cooling too quickly.`,
    });

    p.prose(`
### Second-order methods

All of the above are **first-order** methods: they use only the gradient, the slope. A **second-order** method also uses the *curvature*, how quickly the slope itself changes, which is described by the **Hessian**: the matrix of all second derivatives of the loss. The best known is Newton's method.`);

    p.math({
      label: "Newton's method",
      tex: String.raw`\symw \leftarrow \symw - \big[H(\symw)\big]^{-1}\,\symdw`,
      code: `
        H = hessian(loss_fn, w)    # D x D matrix
        # solve(H, dw) computes inv(H).dot(dw)
        w = w - np.linalg.solve(H, dw)
        # note: no learning rate anywhere
      `,
      codeTitle: 'newton.py',
      terms: [
        [String.raw`H(\symw)`, 'the Hessian of the loss at $\\symw$: entry $(i, j)$ says how the slope along parameter $i$ changes as parameter $j$ changes. Large entries mean sharp curvature'],
        [String.raw`[\cdot]^{-1}`, 'the matrix inverse: multiplying by it "divides" by the curvature, direction by direction'],
        [String.raw`[H]^{-1}\symdw`, 'the gradient, rescaled: long steps where the surface curves gently, short steps where it curves sharply'],
      ],
      explain: `Newton's method fits a bowl (a quadratic) to the surface at the current point and jumps straight to that bowl's bottom. On a surface that really is a bowl, like the long valley, it arrives in one step, and there is no learning rate to tune at all, which its proponents count as a big advantage. Two things make it impractical for deep learning. First, size: a network with one million parameters has a Hessian of one million by one million entries, about 3,725 gigabytes in 32-bit floats, and it would also have to be inverted. Second, on non-convex surfaces it is attracted to *any* flat point, including saddle points (you saw it stop on the saddle above).`,
    });

    p.prose(`
**Quasi-Newton** methods approximate the inverse Hessian instead of computing it. The most popular, **L-BFGS**, builds its approximation implicitly from the last few gradients, so the full matrix never exists in memory. But even L-BFGS has to be run on the entire training set at once: its approximations break down with the noise of mini-batches, and making it work in that setting is an open research problem. So in practice large-scale deep learning sticks with first-order methods. The 2016 lecture's advice: if you *can* afford full-batch updates (a small problem), L-BFGS is worth a try, as long as you turn off every source of noise.

### Which update to use

The notes' recommendation, which still holds up well: use **Adam** as the default, and try **SGD with Nesterov momentum** as an alternative. Whichever you pick, decay the learning rate over training.`);

    // ------------------------------------------------------------------ hyperparameters
    p.h2('Hyperparameter optimization', 'hyperparams');
    p.prose(`
A network comes with a lot of knobs that training does not set: the architecture, the update rule, and above all:

- the **initial learning rate**,
- the **learning rate decay schedule** (such as the decay constant),
- the **regularization strength** (the L2 penalty, the dropout probability).

Finding good values is a search, and a few habits make it much more efficient.

**Use one validation set.** Rather than full cross-validation with several folds, most deep learning work uses a single validation set of respectable size; it is much cheaper, and with enough data, reliable. (People still say they "cross-validated" a parameter even when they only used one validation fold.)

**Automate it.** A typical setup has a worker program that keeps sampling random hyperparameters, trains with them, records the validation performance after every epoch, and writes a checkpoint (with the loss history) to a file, ideally with the validation accuracy in the filename so the best runs are easy to sort. A master program launches and kills these workers across a cluster.

**Search on a log scale.** The learning rate and the regularization strength act multiplicatively on the training dynamics: adding 0.01 to a learning rate of 0.001 changes everything, while adding 0.01 to a learning rate of 10 changes nothing. So sample the exponent uniformly, not the value:`);

    p.code(`
      learning_rate = 10 ** np.random.uniform(-6, 1)
      reg = 10 ** np.random.uniform(-5, 5)
      # some hyperparameters stay on a linear scale:
      dropout = np.random.uniform(0, 1)
    `, { title: 'sample_hyperparams.py' });

    p.prose(`
**Prefer random search to grid search.** This was the point of a well-known paper by Bergstra and Bengio (2012): randomly chosen trials find good hyperparameters more efficiently than trials on a grid. The reason is that usually only a few of the hyperparameters really matter. A grid wastes most of its budget re-testing the same few values of the important one, while random sampling tries a new value of *every* hyperparameter on every trial.`);

    p.figure({
      title: 'Grid search versus random search',
      codeTitle: 'search.py',
      code: `
        # grid search: {{n:9}} trials
        for lr_exp in np.linspace(-6, -1, {{k:3}}):
            for other in np.linspace(0, 1, {{k:3}}):
                score = train_and_eval(10 ** lr_exp, other)  #@grid

        # random search: the same budget
        for trial in range({{n:9}}):
            lr = 10 ** np.random.uniform(-6, -1)             #@rand
            other = np.random.uniform(0, 1)                  #@rand
            score = train_and_eval(lr, other)                #@rand
        # best found: grid {{bg}}, random {{br}}
      `,
      setup(f) {
        const g = (x: number) => 0.12 + 0.76 * Math.exp(-((x + 2.0) ** 2) / (2 * 0.3 ** 2));
        const hy = (y: number) => 0.025 * Math.sin(Math.PI * y);
        const score = (x: number, y: number) => g(x) + hy(y);
        let n = 9;
        let seed = 4;
        let gridPts: [number, number][] = [];
        let randPts: [number, number][] = [];
        const build = () => {
          const k = Math.round(Math.sqrt(n));
          gridPts = [];
          for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) gridPts.push([-6 + (5 * a) / (k - 1), b / (k - 1)]);
          const r = new Rng(seed);
          randPts = Array.from({ length: n }, () => [r.uniform(-6, -1), r.uniform(0, 1)] as [number, number]);
        };
        build();
        const best = (pts: [number, number][]) => Math.max(...pts.map(([x, y]) => score(x, y)));
        const avgBest = () => {
          const r = new Rng(99);
          let sr = 0;
          const reps = 2000;
          for (let q = 0; q < reps; q++) {
            let b = -1;
            for (let i = 0; i < n; i++) b = Math.max(b, score(r.uniform(-6, -1), r.uniform(0, 1)));
            sr += b;
          }
          return sr / reps;
        };
        const top = f.plot({
          height: 86,
          square: false,
          domain: [-6.6, -0.75, 0, 1.0],
          draw: (pp) => {
            pp.fn(g, color('--ink-2'), 2);
            for (const [x] of gridPts) pp.path([x, x], [0, g(x)], withAlpha(color('slate'), 0.9), 2.5);
            for (const [x] of randPts) pp.path([x, x], [0, g(x)], withAlpha(color('purple'), 0.8), 1.6);
            pp.text('score vs learning rate (projection)', -6.5, 0.86, { size: 11, color: color('--ink-2') });
          },
        });
        const main = f.plot({
          aspect: 1.5,
          square: false,
          domain: [-6.6, -0.75, -0.2, 1.08],
          draw: (pp) => {
            const lo = rgbOf(color('--paper'));
            const hi = rgbOf(color('green'));
            pp.field((x, y) => {
              const t = Math.max(0, Math.min(1, (score(x, y) - 0.1) / 0.82));
              return [lo[0] + (hi[0] - lo[0]) * t, lo[1] + (hi[1] - lo[1]) * t, lo[2] + (hi[2] - lo[2]) * t, 255];
            }, 5);
            const c = pp.ctx;
            for (const [x, y] of gridPts) {
              c.fillStyle = color('slate');
              c.fillRect(pp.sx(x) - 5, pp.sy(y) - 5, 10, 10);
              c.strokeStyle = color('--paper');
              c.lineWidth = 1.5;
              c.strokeRect(pp.sx(x) - 5, pp.sy(y) - 5, 10, 10);
            }
            for (const [x, y] of randPts) pp.dot(x, y, 5.5, color('purple'), color('--paper'));
            c.fillStyle = color('--ink-2');
            c.font = '11px system-ui, sans-serif';
            c.textAlign = 'left';
            c.textBaseline = 'bottom';
            for (let e = -6; e <= -1; e++) c.fillText(`1e${e}`, pp.sx(e) - 8, pp.h - 2);
            c.textAlign = 'right';
            c.fillText('learning rate (important) →', pp.w - 4, pp.h - 17);
            c.save();
            c.translate(12, pp.h / 2);
            c.rotate(-Math.PI / 2);
            c.textAlign = 'center';
            c.textBaseline = 'top';
            c.fillText('unimportant parameter →', 0, -8);
            c.restore();
          },
        });
        const gRo = f.readout('grid best');
        const rRo = f.readout('random best');
        const avgRo = f.readout('random, typical best');
        const sync = () => {
          const bg = best(gridPts), br = best(randPts);
          gRo.set(`${Math.round(bg * 100)}%`);
          rRo.set(`${Math.round(br * 100)}%`);
          avgRo.set(`${Math.round(avgBest() * 100)}%`);
          f.code.setMany({ n: String(n), k: String(Math.round(Math.sqrt(n))), bg: `${Math.round(bg * 100)}%`, br: `${Math.round(br * 100)}%` });
          f.code.highlight(['grid', 'rand']);
          top.redraw();
          main.redraw();
        };
        f.segmented({
          label: 'budget',
          options: [
            { value: '9', label: '9 trials' },
            { value: '16', label: '16' },
            { value: '25', label: '25' },
          ],
          value: '9',
          onChange: (v) => {
            n = Number(v);
            build();
            sync();
          },
        });
        f.button('New random draw', () => {
          seed++;
          build();
          sync();
        }, { icon: 'shuffle', primary: true });
        sync();
      },
      caption: `The big panel is the (made-up) validation score over two hyperparameters: greener is better. Only the learning rate really matters, and its good region is narrow; the other parameter barely changes anything. The slate squares are a 3 × 3 grid, the purple dots 9 random trials. The top panel projects both onto the important axis. The grid tests just **3** distinct learning rates (three trials each, which is wasted effort), none of them near the peak. The random trials test **9** different ones. Press **New random draw** a few times: random search usually lands closer to the peak (the "typical best" readout averages 2,000 random draws). Larger budgets help both, but the grid only ever tests $\\sqrt{n}$ learning rates, so whether it finds the peak is luck of the spacing.`,
    });

    p.prose(`
**Watch the borders.** If you searched the learning rate over $10^{-6}$ to $10^{1}$ and the best result came from near one end of that range, the true optimum may well lie *outside* it. Make sure the best values are comfortably inside the searched range; if not, widen it.

**Go from coarse to fine.** Start with wide ranges (say, exponents from $-6$ to $1$) and train each trial for only one epoch, or even less: many settings make the network not learn at all, or blow up to an infinite loss, and that is visible right away. Then narrow the ranges around the best results and train each trial for about 5 epochs. In the last stage, search finely within the final range for many more epochs. The 2016 lecture's example of a coarse stage: 100 trials of 5 epochs each, with \`reg = 10 ** uniform(-5, 5)\` and \`lr = 10 ** uniform(-6, -3)\`, then a second stage zoomed in on the promising region.

**Bayesian hyperparameter optimization** is a whole research area devoted to choosing the next trial more cleverly, by modeling which regions are promising and balancing exploration (trying new regions) against exploitation (refining good ones). Spearmint, SMAC and Hyperopt are well-known libraries. In practice with ConvNets, though, a carefully ranged random search is still hard to beat.`);

    // ------------------------------------------------------------------ ensembles
    p.h2('Evaluation: model ensembles', 'ensembles');
    p.prose(`
One more trick reliably buys a few extra percent at the end: train several independent models and, at test time, **average their predictions**. The more models, the better the ensemble usually gets, with diminishing returns, and the more the models differ from each other, the bigger the gain. Ways to get the members:

- **Same model, different initializations.** Find the best hyperparameters with your validation set, then train several copies that differ only in their random initialization. Their variety comes only from the initialization, which limits the gain.
- **The top models from the hyperparameter search.** Take the best handful (say 10) of the models you trained anyway. More variety, at the risk of including weaker models, but no extra training needed.
- **Checkpoints of a single model.** If training is very expensive, save the model at several points (say, after every epoch) and ensemble those snapshots. Less variety, but practically free, and it can work reasonably well.
- **A running average of the parameters.** Keep a second copy of the weights that is an exponentially decaying average of the weights during training, and use that copy at test time. This almost always buys a percent or two:`);

    p.code(`
      # after every parameter update:
      w_test = 0.995 * w_test + 0.005 * w
      # evaluate validation and test data with w_test, not w
    `, { title: 'running_average.py' });

    p.prose(`
The intuition for the last one: near the end of training, the objective is roughly bowl-shaped and the parameters are jumping around its bottom (just like the constant-learning-rate run in Fig 9.6). Their average is more likely to sit close to the actual bottom than any single snapshot.

The downside of ensembles is cost at test time: ten models take ten times as long to evaluate. Geoff Hinton's work on "dark knowledge" (Hinton, Vinyals and Dean, 2015) shows how to *distill* an ensemble back into a single model, by training it to match the ensemble's predicted probabilities.`);

    // ------------------------------------------------------------------ summary
    p.h2('Summary: the training checklist', 'summary');
    p.prose(`
To train a neural network:

1. **Gradient check** your implementation on a small batch of data, in double precision, with regularization and dropout off, aware of kinks.
2. **Sanity check** the setup: the initial loss should match chance (2.302 for 10-class softmax), increasing $\\symlam$ should increase it, and you should be able to reach 100% training accuracy on a tiny subset of the data.
3. **Monitor** during training: the loss curve (its shape tells you about the learning rate), training and validation accuracy (their gap tells you about overfitting), and if you want to be thorough, the ratio of update size to weight size (around $10^{-3}$), plus the first-layer weights for ConvNets.
4. **Update with** SGD plus Nesterov momentum, or Adam.
5. **Decay the learning rate** over training: for example, halve it after a fixed number of epochs, or whenever the validation accuracy stops improving.
6. **Search hyperparameters** with random search, not grid search, on log scales, from coarse (wide ranges, 1 to 5 epochs per trial) to fine (narrow ranges, many epochs).
7. **Ensemble** several models, or at least use a running average of the parameters, for extra performance.

The next chapter puts the whole pipeline together on the spiral dataset, from a linear classifier to a two-layer network, in about a hundred lines of NumPy.`);

    p.callout('idea', `Training is an experiment you supervise. **Check** before you train (gradient checks, initial loss at chance, overfitting a tiny subset). **Watch** while you train: the loss curve's shape diagnoses the learning rate, and the train/validation gap diagnoses overfitting. **Update** with more than the raw gradient: momentum smooths the path, and adaptive methods like RMSprop and Adam give every parameter its own step size. **Decay** the learning rate, **search** hyperparameters randomly on log scales from coarse to fine, and **ensemble** at the end.`, 'Takeaways');
  },
};

export default chapter;

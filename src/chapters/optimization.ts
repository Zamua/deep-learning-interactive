import type { ChapterDef } from './index';
import { fmt } from '../core/code';
import { blobs } from '../core/data';
import { CLASS_COLORS, type Plot, color, rgbOf, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { K, Slice, Surface, lineChart, svm, toyProblem } from '../lib/optimization-svm';

const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";

/** A small labelled legend box in a plot corner. */
function legend(pl: Plot, items: { label: string; color: string }[], corner: 'tl' | 'bl' | 'br' = 'tl', inset = 6): void {
  const c = pl.ctx;
  c.font = '11px system-ui, sans-serif';
  const w = Math.max(...items.map((i) => c.measureText(i.label).width)) + 26;
  const h = items.length * 16 + 8;
  const x = corner === 'br' ? pl.w - w - 14 : inset;
  const y = corner === 'tl' ? (inset > 6 ? 24 : 6) : corner === 'bl' ? pl.h - h - 6 : pl.h - h - 38;
  c.fillStyle = withAlpha(color('--paper'), 0.88);
  c.beginPath();
  c.roundRect(x, y, w, h, 6);
  c.fill();
  items.forEach((it, k) => {
    c.beginPath();
    c.arc(x + 11, y + 12 + k * 16, 4, 0, Math.PI * 2);
    c.fillStyle = it.color;
    c.fill();
    c.fillStyle = color('--ink-2');
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(it.label, x + 20, y + 12 + k * 16);
  });
}

/** Polyline through slice points [a0, b0, a1, b1, ...] with a dot at each vertex. */
function trail(pl: Plot, pts: number[], col: string, width = 2, dots = true): void {
  if (pts.length < 2) return;
  const c = pl.ctx;
  c.strokeStyle = col;
  c.lineWidth = width;
  c.lineJoin = 'round';
  c.beginPath();
  for (let k = 0; k < pts.length; k += 2) {
    const X = pl.sx(Math.max(-1e4, Math.min(1e4, pts[k]!)));
    const Y = pl.sy(Math.max(-1e4, Math.min(1e4, pts[k + 1]!)));
    if (k) c.lineTo(X, Y);
    else c.moveTo(X, Y);
  }
  c.stroke();
  if (dots) for (let k = 0; k < pts.length; k += 2) pl.dot(pts[k]!, pts[k + 1]!, 2.5, col);
}

const START: [number, number] = [-3.2, 2.8];

const chapter: ChapterDef = {
  symbols: {
    W: { color: 'blue', name: 'W: the weights, the numbers we are searching for', code: ['W', 'W0', 'W_try', 'best_W'] },
    x: { color: 'orange', name: 'x: an input example (X: all of them, one per row)', code: ['x', 'X', 'X_train', 'X_batch'] },
    y: { color: 'gold', name: 'y: the correct class of an example', code: ['y', 'Y', 'y_train', 'y_batch'] },
    L: { color: 'red', name: 'L: the loss, the single number we want to make small', code: ['L', 'loss', 'best_loss'] },
    dW: { color: 'teal', name: '∇L: the gradient, which way (and how steeply) the loss goes up', tex: '\\nabla_{W} L', code: ['dW', 'grad', 'grad_L'] },
    eta: { color: 'slate', name: 'η: the step size, also called the learning rate', tex: '\\eta', code: ['step_size'] },
    h: { color: 'purple', name: 'h: the small nudge used to measure a slope numerically', code: ['h'] },
    B: { color: 'green', name: 'B: the mini-batch size, how many examples each step looks at', code: ['B', 'batch_size'] },
  },

  render(p) {
    p.prose(`
[Chapter 4](#/linear-classification) built two of the three pieces that every classifier in this course needs: a **score function** that turns an image into class scores ($\\symW\\symx$), and a **loss function** that grades those scores with a single number. This chapter supplies the third piece, **optimization**: the procedure that finds the weights $\\symW$ that make the loss as small as possible.

The running example is the multiclass SVM loss from Chapter 4, but nothing here is specific to it. The same procedure that tunes a linear classifier's 30,730 CIFAR-10 weights will later tune networks with millions of them.`);

    p.math({
      label: 'The objective: one number, as a function of W',
      tex: String.raw`\begin{aligned} \symL(\symW) &= \frac{1}{N}\sum_{i=1}^{N} \symL_i(\symW) \;+\; \lambda \sum_{k,l} \symW_{k,l}^{2} \\ \symL_i(\symW) &= \sum_{j \ne \symy_i} \max\!\big(0,\; \sym{W}{w_j}^{\top}\symx_i - \sym{W}{w_{\symy_i}}^{\top}\symx_i + 1\big) \end{aligned}`,
      codeTitle: 'svm_loss.py',
      code: `
        def L(W, X, y, reg):
            N = X.shape[0]
            scores = X.dot(W.T)                     # N x C
            correct = scores[np.arange(N), y]       # right-class scores
            margins = np.maximum(0, scores - correct[:, None] + 1)
            margins[np.arange(N), y] = 0
            return margins.sum() / N + reg * np.sum(W * W)
      `,
      terms: [
        [String.raw`\symL_i(\symW)`, 'the loss on training example $i$ alone: the multiclass SVM loss of Chapter 4'],
        [String.raw`\sym{W}{w_j}^{\top}\symx_i`, 'row $j$ of $W$ times example $i$: the score of class $j$ (called $s_j$ in Chapter 4)'],
        [String.raw`\sym{W}{w_j}^{\top}\symx_i - \sym{W}{w_{\symy_i}}^{\top}\symx_i + 1`, 'how far class $j$ intrudes on the correct class\'s safety margin of 1'],
        [String.raw`\max(0,\,\cdot)`, 'count only actual intrusions; classes safely below cost nothing'],
        [String.raw`\frac{1}{N}\sum_{i=1}^{N}`, 'average the per-example losses over all $N$ training examples'],
        [String.raw`\lambda \sum_{k,l} \symW_{k,l}^2`, 'the regularization penalty: the sum of every squared weight, times a knob $\\lambda$'],
      ],
      explain: 'Everything here is from Chapter 4, written with $W$ in plain view. The training data $X$ and $y$ are fixed; the only thing we are free to change is $W$. So the loss is really a function of $W$ alone, and optimization means finding the $W$ where it is smallest. The code is the fully vectorized version that Assignment 1 asks you to write, with no loop over examples.',
    });

    // --------------------------------------------------------------- landscape
    p.h2('Visualizing the loss function', 'landscape');
    p.prose(`
Think of the loss as a landscape: every possible weight matrix is a location, and the loss is the altitude there. Training is a search for the lowest point. For CIFAR-10 the landscape has 30,730 directions (a 10 × 3073 matrix, with the bias folded in), which nobody can picture. But we can look at **slices** of it.

Pick a weight matrix $\\symW$ to stand on and a random direction $W_1$ (a matrix of the same shape, used as a compass heading). Walk along the straight line $\\symW + aW_1$ and record the loss at each distance $a$: that gives a curve. Use two directions and a grid of distances $(a, b)$, and you get a map.`);
    p.math({
      label: 'Slices through the loss',
      tex: String.raw`\symL(\symW + a\,W_1) \qquad\qquad \symL(\symW + a\,W_1 + b\,W_2)`,
      codeTitle: 'slices.py',
      code: `
        W1 = np.random.randn(*W.shape)     # a random direction
        W2 = np.random.randn(*W.shape)     # and a second one
        steps = np.linspace(-1, 1, 101)
        curve = [L(W + a * W1) for a in steps]              # 1-D
        grid = [[L(W + a * W1 + b * W2) for a in steps]     # 2-D
                for b in steps]
      `,
      terms: [
        [String.raw`\symW`, 'where we stand: one particular weight matrix'],
        [String.raw`W_1,\ W_2`, 'random directions: matrices of the same shape as $W$'],
        [String.raw`a,\ b`, 'how far to walk along each direction (negative means backwards)'],
        [String.raw`\symL(\symW + a\,W_1)`, 'the loss along a straight line through $W$: a curve we can plot'],
      ],
      explain: 'Every point on a slice is a complete, legitimate weight matrix, so the loss there is an ordinary number we can compute. We simply cannot look in all directions at once, so we look along one or two random ones. Below, the toy problem has only 6 weights (3 classes, 2 inputs) and 300 training points, but its slices look like the CIFAR-10 slices in the course notes.',
    });

    p.figure({
      title: 'Slicing the SVM loss',
      codeTitle: 'loss_slices.py',
      code: `
        W1 = np.random.randn(3, 2)
        W1 /= np.linalg.norm(W1)          # random direction
        W2 = np.random.randn(3, 2)
        W2 -= np.sum(W2 * W1) * W1        # at right angles
        W2 /= np.linalg.norm(W2)

        def L(W):            # SVM loss on {{which:one example}}
            return svm_loss(W, X[{{idx:…}}], y[{{idx}}], reg={{reg:0}})

        steps = np.linspace(-4, 4, 161)
        curve = [L(W0 + a * W1) for a in steps]            #@one
        grid = [[L(W0 + a * W1 + b * W2) for a in steps]   #@two
                for b in steps]                            #@two
      `,
      setup(f) {
        const prob = toyProblem();
        let seed = 4;
        const sl = new Slice(prob.data, prob.W0, seed, prob.reg);
        let one = true;
        let regOn = false;
        // examples whose hinges switch on or off inside the view, so their slices show creases
        let candidates: number[] = [];
        const patterns = (i: number) => {
          const seen = new Set<number>();
          const x0 = prob.data.X[2 * i]!;
          const x1 = prob.data.X[2 * i + 1]!;
          const yi = prob.data.y[i]!;
          for (let u = 0; u <= 12; u++)
            for (let v = 0; v <= 12; v++) {
              const W = sl.at(-4.6 + (9.2 * u) / 12, -4 + (8 * v) / 12);
              const sc = [0, 1, 2].map((c) => W[2 * c]! * x0 + W[2 * c + 1]! * x1);
              let bits = 0;
              for (let c = 0; c < 3; c++) if (c !== yi && sc[c]! - sc[yi]! + 1 > 0) bits |= 1 << c;
              seen.add(bits);
            }
          return seen.size;
        };
        const pickCandidates = () => {
          const counts = Array.from({ length: prob.data.n }, (_, i) => patterns(i));
          const most = Math.max(...counts);
          candidates = counts.flatMap((c, i) => (c >= Math.min(3, most) ? [i] : []));
        };
        pickCandidates();
        let ci = 0;
        const loss = (a: number, b: number) => sl.loss(a, b, one ? [candidates[ci]!] : null, regOn ? prob.reg : 0);
        const surf = new Surface(loss, { hue: 'red', lo: 0, hi: 1, levels: [] });
        const rescale = () => {
          let lo = Infinity;
          let hi = -Infinity;
          for (let i = 0; i <= 16; i++)
            for (let j = 0; j <= 16; j++) {
              const v = loss(-4.6 + (9.2 * i) / 16, -4 + (8 * j) / 16);
              lo = Math.min(lo, v);
              hi = Math.max(hi, v);
            }
          surf.opts.lo = lo;
          surf.opts.hi = hi;
          surf.opts.levels = Array.from({ length: 9 }, (_, k) => lo + ((k + 0.5) * (hi - lo)) / 9);
          surf.invalidate();
        };
        const curve = f.plot({
          height: 150,
          square: false,
          draw: (pl) => {
            const xs: number[] = [];
            const ys: number[] = [];
            for (let k = 0; k <= 200; k++) {
              const a = -4 + (8 * k) / 200;
              xs.push(a);
              ys.push(loss(a, 0));
            }
            const top = Math.max(...ys) * 1.08 || 1;
            const bot = Math.min(...ys);
            const lo = bot > top * 0.35 ? Math.floor(bot * 4) / 4 : 0;
            const step = (top - lo) / 3;
            lineChart(pl, {
              x: [-4, 4],
              y: [lo, top],
              series: [{ xs, ys, color: color('red'), label: '' }],
              xTicks: [-4, -2, 0, 2, 4].map((v) => ({ v, s: String(v) })),
              yTicks: [0, 1, 2, 3].map((k) => ({ v: lo + k * step, s: fmt(lo + k * step, 2) })),
              xLabel: 'a (distance along W₁)',
              yLabel: 'L(W₀ + a W₁)',
              marks: [{ x: 0, color: color('blue') }],
            });
          },
        });
        const map = f.plot({
          aspect: 1.25,
          domain: [-4, 4, -4, 4],
          draw: (pl) => {
            surf.draw(pl);
            pl.path([-6, 6], [0, 0], withAlpha(color('--ink'), 0.6), 1.5, [6, 4]);
            pl.dot(0, 0, 5, color('blue'), color('--paper'));
            pl.text('W₀', 0.18, 0.25, { size: 12, bold: true, color: color('blue') });
            const [x0, , y0] = pl.view();
            pl.text('a →', x0 + 0.15, 0.25, { size: 11, color: color('--ink-2') });
            pl.text('b ↑', 0.18, y0 + 0.3, { size: 11, color: color('--ink-2') });
          },
        });
        map.canvas.classList.add('scroll-ok');
        curve.canvas.classList.add('scroll-ok');
        const sync = () => {
          rescale();
          f.code.setMany({
            which: one ? 'one example' : 'all 300 points',
            idx: one ? `${candidates[ci]}:${candidates[ci]! + 1}` : ':',
            reg: regOn ? prob.reg : 0,
          });
          curve.redraw();
          map.redraw();
        };
        f.segmented({
          label: 'examples',
          options: [
            { value: 'one', label: 'one' },
            { value: 'all', label: 'all 300' },
          ],
          value: 'one',
          onChange: (v) => {
            one = v === 'one';
            exBtn.disabled = !one;
            f.code.highlight(['one', 'two']);
            sync();
          },
        });
        f.toggle({
          label: 'regularization λ = 0.05',
          value: false,
          onChange: (v) => {
            regOn = v;
            sync();
          },
        });
        f.button('New directions', () => {
          seed += 1;
          sl.reroll(seed);
          pickCandidates();
          ci = 0;
          sync();
        }, { icon: 'shuffle' });
        const exBtn = f.button('Another example', () => {
          ci = (ci + 1) % candidates.length;
          sync();
        });
        sync();
      },
      caption: `Top: the loss along one random direction through a trained $\\symW_0$ (blue line). Bottom: along two directions; deeper color means higher loss, thin lines join points of equal loss, and the dashed line is the 1-D slice above. With **one** example the landscape is built from flat floors and straight ramps meeting at creases, because each hinge $\\max(0, \\cdot)$ is either off or a straight line. Switch to **all 300** and hundreds of creases average into something close to a smooth bowl, with a long, gentle valley floor. Turn on **regularization** and the valley closes into a rounder bowl. **New directions** slices the same landscape another way.`,
    });

    p.callout('math', `A function is **convex** if it is shaped like a bowl: the straight line between any two points on its graph never dips below the graph. Convex functions have no misleading local dips; any point where you cannot go further downhill is a lowest point. Each hinge term of the SVM loss is convex, sums of convex functions stay convex, and the squared-weights penalty is convex too, so the whole SVM loss is convex. Neural networks (Chapter 7) lose this property, yet the downhill methods of this chapter still work remarkably well on them in practice.`, 'Math help: convex functions');
    p.prose(`The creases have one technical consequence: right on a crease the slope jumps, so strictly speaking the loss has no single gradient there. In practice this almost never matters. We use the slope from either side (a *subgradient*), and the methods below work fine.`);

    // ------------------------------------------------------------------ search
    p.h2('Three ways to search', 'search');
    p.prose(`
How do you find the bottom of a landscape you cannot see? Picture yourself blindfolded on a hillside, trying to reach the valley floor. Here are three strategies, from hopeless to good.

### Strategy 1: random search

Try many random weight matrices and keep the best one. It is very easy to write:`);
    p.code(
      `
      best_loss = float('inf')
      for attempt in range(1000):
          W = np.random.randn(10, 3073) * 0.0001   # a random guess
          loss = L(W, X_train, y_train, reg)       # how bad is it?
          if loss < best_loss:
              best_loss, best_W = loss, W
      # best_W gets about 15.5% of CIFAR-10 test images right
    `,
      { title: 'random_search.py' },
    );
    p.prose(`
The best of 1,000 random tries classifies about **15.5%** of CIFAR-10's test images correctly: better than the 10% of pure guessing, but barely. In 30,730 dimensions, the chance of landing on a good spot by luck is effectively zero.

### Strategy 2: random local search

Better: start somewhere, then repeatedly try a small random step and take it only if the loss goes down. Blindfolded, that is poking a foot out in a random direction and stepping only if the ground there is lower.`);
    p.code(
      `
      W = np.random.randn(10, 3073) * 0.001   # a random start
      best_loss = L(W, X_train, y_train, reg)
      for i in range(1000):
          W_try = W + np.random.randn(10, 3073) * 0.0001   # small step
          loss = L(W_try, X_train, y_train, reg)
          if loss < best_loss:                 # keep it only if better
              W, best_loss = W_try, loss
      # about 21.4% test accuracy
    `,
      { title: 'random_local_search.py' },
    );
    p.prose(`
This reaches about **21.4%** on CIFAR-10. Better, but wasteful: most random steps point uphill or sideways and get thrown away, and in many dimensions almost every random direction is a poor one.

### Strategy 3: follow the slope

Best of all: feel the ground under your feet and step in the direction where it drops most steeply. No guessing is needed, because that direction can be computed. In one dimension it is the slope, or **derivative**, of the loss; in many dimensions it is the **gradient**. The figure below lets the three strategies race on the same landscape, one move each per round.`);

    p.figure({
      title: 'A race to the bottom',
      layout: 'side',
      codeTitle: 'race.py',
      code: `
        def W_at(t):              # a point on the slice
            return W0 + t[0] * W1 + t[1] * W2
        def L(t):
            return svm_loss(W_at(t), X, y, reg=0.05)
        def grad_L(t):            # slope along W1 and W2
            dW = svm_grad(W_at(t), X, y, reg=0.05)
            return np.array([np.sum(dW * W1), np.sum(dW * W2)])

        step_size = {{lr:1.5}}
        # all three start from the same point
        t_rs = t_ls = t_gd = np.array([-3.2, 2.8])
        for it in range(60):        # it = {{it:0}}
            # 1. random search: a fresh guess anywhere
            t_try = np.random.uniform(-4, 4, size=2)        #@rs
            if L(t_try) < L(t_rs): t_rs = t_try             #@rs
            # 2. random local search: a small random step
            t_try = t_ls + {{delta:0.5}} * np.random.randn(2)   #@ls
            if L(t_try) < L(t_ls): t_ls = t_try             #@ls
            # 3. gradient descent: straight downhill
            t_gd = t_gd - step_size * grad_L(t_gd)          #@gd
        # losses: {{lrs:…}} (rs), {{lls:…}} (ls), {{lgd:…}} (gd)
      `,
      setup(f) {
        const prob = toyProblem();
        const sl = new Slice(prob.data, prob.W0, 4, prob.reg);
        const surf = new Surface((a, b) => sl.loss(a, b), { hue: 'red', lo: 0.75, hi: 4.6, levels: [0.85, 1, 1.25, 1.6, 2, 2.5, 3, 3.6, 4.2] });
        const N_IT = 60;
        let lr = 1.5;
        let delta = 0.5;
        let rng = new Rng(9);
        let s = 0;
        let rsBest: [number, number] = [...START];
        let rsLoss = 0;
        let rsPath: number[] = [];
        let rsTries: number[] = [];
        let ls: [number, number] = [...START];
        let lsLoss = 0;
        let lsPath: number[] = [];
        let lsTries: number[] = [];
        let gd: [number, number] = [...START];
        let gdPath: number[] = [];
        let hist: { rs: number[]; ls: number[]; gd: number[] } = { rs: [], ls: [], gd: [] };
        const reset = () => {
          rng = new Rng(9);
          s = 0;
          rsBest = [...START];
          ls = [...START];
          gd = [...START];
          rsLoss = lsLoss = sl.loss(...START);
          rsPath = [...START];
          lsPath = [...START];
          gdPath = [...START];
          rsTries = [];
          lsTries = [];
          hist = { rs: [rsLoss], ls: [rsLoss], gd: [rsLoss] };
        };
        reset();
        const COL = { rs: () => color('gold'), ls: () => color('purple'), gd: () => color('teal') };
        const pl = f.plot({
          aspect: 1.15,
          domain: [-4.2, 4.2, -4.2, 4.2],
          draw: (pp) => {
            surf.draw(pp);
            for (let k = 0; k < rsTries.length; k += 2) pp.dot(rsTries[k]!, rsTries[k + 1]!, 2.5, withAlpha(COL.rs(), 0.45));
            for (let k = 0; k < lsTries.length; k += 2) pp.dot(lsTries[k]!, lsTries[k + 1]!, 2, withAlpha(COL.ls(), 0.4));
            trail(pp, rsPath, COL.rs(), 1.5, false);
            trail(pp, lsPath, COL.ls(), 2, false);
            trail(pp, gdPath, COL.gd(), 2.2, true);
            pp.dot(START[0], START[1], 6, 'transparent', color('--ink'));
            pp.dot(rsBest[0], rsBest[1], 5, COL.rs(), color('--paper'));
            pp.dot(ls[0], ls[1], 5, COL.ls(), color('--paper'));
            pp.dot(gd[0], gd[1], 5, COL.gd(), color('--paper'));
            legend(pp, [
              { label: 'random search', color: COL.rs() },
              { label: 'random local search', color: COL.ls() },
              { label: 'gradient descent', color: COL.gd() },
            ], 'bl');
          },
        });
        const chart = f.plot({
          height: 130,
          square: false,
          draw: (pp) => {
            const xs = hist.gd.map((_, i) => i);
            lineChart(pp, {
              x: [0, N_IT],
              y: [0.7, 3],
              series: [
                { xs: hist.rs.map((_, i) => i), ys: hist.rs, color: COL.rs(), label: fmt(hist.rs[hist.rs.length - 1]!, 3) },
                { xs: hist.ls.map((_, i) => i), ys: hist.ls, color: COL.ls(), label: fmt(hist.ls[hist.ls.length - 1]!, 3) },
                { xs, ys: hist.gd, color: COL.gd(), label: fmt(hist.gd[hist.gd.length - 1]!, 3) },
              ],
              xTicks: [0, 10, 20, 30, 40, 50, 60].map((v) => ({ v, s: String(v) })),
              yTicks: [1, 2, 3].map((v) => ({ v, s: String(v) })),
              xLabel: 'round',
              yLabel: 'loss',
            });
          },
        });
        const sync = () => {
          f.code.setMany({
            it: Math.floor(s / 3),
            lrs: fmt(rsLoss, 3),
            lls: fmt(lsLoss, 3),
            lgd: fmt(hist.gd[hist.gd.length - 1]!, 3),
          });
          pl.redraw();
          chart.redraw();
        };
        const substep = () => {
          const which = s % 3;
          if (which === 0) {
            const a = rng.uniform(-4, 4);
            const b = rng.uniform(-4, 4);
            rsTries.push(a, b);
            const l = sl.loss(a, b);
            if (l < rsLoss) {
              rsLoss = l;
              rsBest = [a, b];
              rsPath.push(a, b);
            }
            f.code.highlight('rs');
          } else if (which === 1) {
            const a = ls[0] + delta * rng.randn();
            const b = ls[1] + delta * rng.randn();
            lsTries.push(a, b);
            const l = sl.loss(a, b);
            if (l < lsLoss) {
              lsLoss = l;
              ls = [a, b];
              lsPath.push(a, b);
            }
            f.code.highlight('ls');
          } else {
            const g = sl.grad(gd[0], gd[1]);
            gd = [gd[0] - lr * g.ga, gd[1] - lr * g.gb];
            gdPath.push(gd[0], gd[1]);
            hist.rs.push(rsLoss);
            hist.ls.push(lsLoss);
            hist.gd.push(sl.loss(gd[0], gd[1]));
            f.code.highlight('gd');
          }
          s++;
        };
        let acc = 0;
        const loop = f.loop((dt) => {
          acc += dt;
          while (acc > 0.1) {
            acc -= 0.1;
            if (s >= N_IT * 3) {
              stop();
              return false;
            }
            substep();
          }
          sync();
        });
        const stop = () => {
          loop.stop();
          play.textContent = s >= N_IT * 3 ? 'Replay' : 'Play';
          if (s >= N_IT * 3) f.code.highlight(null);
        };
        const play = f.button('Play', () => {
          if (loop.running()) stop();
          else {
            if (s >= N_IT * 3) {
              reset();
              sync();
            }
            acc = 0;
            loop.start();
            play.textContent = 'Pause';
          }
        }, { primary: true });
        f.button('Step', () => {
          stop();
          if (s >= N_IT * 3) return;
          substep();
          sync();
        });
        f.slider({
          label: 'step size η',
          sym: 'eta',
          min: 0.05,
          max: 3,
          step: 0.05,
          value: 1.5,
          slot: 'lr',
          format: (v) => v.toFixed(2),
          onInput: (v) => {
            lr = v;
            stop();
            reset();
            sync();
          },
        });
        f.slider({
          label: 'local step',
          min: 0.1,
          max: 1.5,
          step: 0.05,
          value: 0.5,
          slot: 'delta',
          format: (v) => v.toFixed(2),
          onInput: (v) => {
            delta = v;
            stop();
            reset();
            sync();
          },
        });
        sync();
      },
      caption: `Press **Play** (or **Step**) and the three strategies take turns, all starting from the ringed point on the same 2-D slice of the SVM loss; the code line of whoever is moving lights up, and the chart tracks each one's loss. **Random search** (gold) throws guesses anywhere and keeps the best, so its path is a few long jumps. **Random local search** (purple) tries small random steps (faint dots) and keeps only the ones that go down. **Gradient descent** (teal) walks straight downhill and reaches the bottom first. Two honest caveats: in two dimensions random search is not hopeless, since a few dozen guesses cover a small map fairly well (in 30,730 dimensions the same number of guesses covers essentially nothing), and gradient descent's speed depends on its step size. Drag the step size down to 0.3 and watch it fall behind.`,
    });

    // ---------------------------------------------------------------- gradient
    p.h2('The gradient', 'gradient');
    p.prose(`In one dimension, the slope of a function at a point is its **derivative**: how much the output changes per unit change in the input, measured over a vanishingly small change.`);
    p.math({
      label: 'The derivative: slope at a point',
      tex: String.raw`\frac{df(x)}{dx} = \lim_{\symh \to 0}\; \frac{f(x + \symh) - f(x)}{\symh}`,
      codeTitle: 'slope.py',
      code: `
        def slope(f, x, h=1e-5):
            return (f(x + h) - f(x)) / h    # rise over run

        slope(lambda x: x ** 2, 3.0)        # 6.00001: the slope of x^2 at 3 is 6
      `,
      terms: [
        [String.raw`f(x + \symh) - f(x)`, 'the *rise*: how much the output changes when the input moves by $h$'],
        [String.raw`\frac{\cdots}{\symh}`, 'divided by the *run* $h$: the change per unit of input'],
        [String.raw`\lim_{\symh \to 0}`, 'make $h$ smaller and smaller, and see what number this settles on'],
      ],
      explain: 'This is the Calculus 1 slope: rise over run, for a run so short that the function looks like a straight line. A positive derivative means "going right goes up"; a negative one means "going right goes down"; its size says how steeply. For $f(x) = x^2$ at $x = 3$ the slope is $2 \\times 3 = 6$.',
    });
    p.prose(`The loss depends on many weights at once. The gradient handles that by measuring one slope per weight:`);
    p.math({
      label: 'The gradient: one slope per weight',
      tex: String.raw`\symdW = \left[\; \frac{\partial \symL}{\partial \symW_{1}},\; \frac{\partial \symL}{\partial \symW_{2}},\; \dots,\; \frac{\partial \symL}{\partial \symW_{n}} \;\right]`,
      codeTitle: 'gradient_shape.py',
      code: `
        dW = np.zeros_like(W)         # one slope per weight
        dW.shape == W.shape           # True: same shape as W
        # dW[k, l] answers: if W[k, l] alone grows a little,
        # how fast does the loss grow?
      `,
      terms: [
        [String.raw`\frac{\partial \symL}{\partial \symW_{k}}`, 'a *partial derivative*: the ordinary slope of the loss with respect to weight $k$ alone, with every other weight held still'],
        [String.raw`[\;\dots\;]`, 'all $n$ of those slopes collected together: one per weight, so the gradient has the same shape as $W$'],
        [String.raw`\symdW`, 'the gradient of $L$ with respect to $W$, read "grad L" (the symbol $\\nabla$ is called *nabla*)'],
      ],
      explain: 'Nudge one weight, keep the rest still, watch the loss: that is one partial derivative. Do it for every weight and you have the gradient. Taken together it is a direction in weight space, and a special one: it points the way the loss increases *fastest*. So its negative points the way the loss decreases fastest, which is exactly where the blindfolded hiker wants to step.',
    });
    p.callout('math', 'The curly $\\partial$ is a reminder that other variables exist but are being held fixed. Computing $\\partial L / \\partial W_k$ is plain Calculus 1 slope-finding, treating every weight except $W_k$ as a constant number. The [math survival kit](#/math-kit) walks through it slowly, with code.', 'Math help: partial derivatives');

    // --------------------------------------------------------------- numerical
    p.h2('The numerical gradient', 'numerical');
    p.prose(`The definition of the derivative hands us an algorithm directly: nudge each weight by a small $\\symh$, recompute the loss, and divide the change by $\\symh$. In practice a slightly different recipe works much better, the **centered difference**, which nudges both ways:`);
    p.math({
      label: 'Centered difference',
      tex: String.raw`\frac{\partial \symL}{\partial \symW_k} \;\approx\; \frac{\symL(\symW + \symh\,e_k) - \symL(\symW - \symh\,e_k)}{2\symh}`,
      codeTitle: 'gradient_check.py',
      code: `
        def eval_numerical_gradient(f, W, h=1e-5):
            grad = np.zeros_like(W)
            for idx in np.ndindex(W.shape):     # every single weight
                old = W[idx]
                W[idx] = old + h; fxph = f(W)   # nudged up
                W[idx] = old - h; fxmh = f(W)   # nudged down
                W[idx] = old                    # put it back
                grad[idx] = (fxph - fxmh) / (2 * h)
            return grad
      `,
      terms: [
        [String.raw`e_k`, 'a matrix of zeros with a single 1 at weight $k$, so $W + h\\,e_k$ is $W$ with only weight $k$ nudged'],
        [String.raw`\symL(\symW + \symh e_k) - \symL(\symW - \symh e_k)`, 'the change in loss between nudging that weight up and nudging it down'],
        [String.raw`2\symh`, 'the total run: from $-h$ to $+h$'],
      ],
      explain: 'The one-sided recipe $[f(x+h) - f(x)]/h$ measures the slope over a stretch that starts at $x$ and extends to one side, so any curvature makes it lean. The centered recipe is balanced around $x$, and the leaning errors from the two sides cancel: its error shrinks like $h^2$ instead of like $h$. The course recommends it, with $h$ around $10^{-5}$. The code is a compact version of the helper that Assignment 1 provides.',
    });

    p.figure({
      title: 'How small should h be?',
      codeTitle: 'numeric_vs_analytic.py',
      code: `
        W = np.array([[0.7, 0.4], [0.3, -0.8], [-0.5, 0.2]],
                     dtype=np.{{dtype:float64}})
        x, y = np.array([1.2, -0.7]), 1     # one example
        def f(w):         # loss as a function of W[0, 0]
            W[0, 0] = w
            return softmax_loss(W.dot(x), y)

        w, h = 0.7, {{h:1e-5}}
        num = (f(w + h) - f(w - h)) / (2 * h)              #@num
        fwd = (f(w + h) - f(w)) / h                        #@fwd
        W[0, 0] = w; probs = softmax(W.dot(x))
        ana = (probs[0] - (y == 0)) * x[0]   # calculus    #@ana
        rel = abs(num - ana) / max(abs(num), abs(ana))     #@err
        # num {{num:…}}
        # fwd {{fwd:…}}
        # ana {{ana:…}}
        # rel {{err:…}}
      `,
      setup(f) {
        const X = [1.2, -0.7];
        const Y: number = 1;
        const Wr = [
          [0.7, 0.4],
          [0.3, -0.8],
          [-0.5, 0.2],
        ];
        const w0 = 0.7;
        let f32 = false;
        let h = 1e-5;
        const F = Math.fround;
        const loss = (w: number, single: boolean) => {
          const r = single ? F : (v: number) => v;
          const s = Wr.map((row, c) => {
            const a = c === 0 ? r(w) : r(row[0]!);
            return r(r(a * r(X[0]!)) + r(r(row[1]!) * r(X[1]!)));
          });
          const m = Math.max(...s);
          let Z = 0;
          for (const v of s) Z = r(Z + r(Math.exp(r(v - m))));
          return r(r(-r(s[Y]! - m)) + r(Math.log(Z)));
        };
        const probs = (w: number) => {
          const s = Wr.map((row, c) => (c === 0 ? w : row[0]!) * X[0]! + row[1]! * X[1]!);
          const m = Math.max(...s);
          const e = s.map((v) => Math.exp(v - m));
          const Z = e.reduce((a, b) => a + b, 0);
          return e.map((v) => v / Z);
        };
        const ana = (probs(w0)[0]! - (Y === 0 ? 1 : 0)) * X[0]!;
        const estimates = (hh: number) => {
          const wp = f32 ? F(F(w0) + F(hh)) : w0 + hh;
          const wm = f32 ? F(F(w0) - F(hh)) : w0 - hh;
          const w = f32 ? F(w0) : w0;
          const num = f32 ? F(F(loss(wp, true) - loss(wm, true)) / F(2 * hh)) : (loss(wp, false) - loss(wm, false)) / (2 * hh);
          const fwd = f32 ? F(F(loss(wp, true) - loss(w, true)) / F(hh)) : (loss(wp, false) - loss(w, false)) / hh;
          return { num, fwd };
        };
        const rel = (v: number) => Math.abs(v - ana) / Math.max(Math.abs(v), Math.abs(ana));
        let curves = { xs: [] as number[], c: [] as number[], fw: [] as number[] };
        const buildCurves = () => {
          curves = { xs: [], c: [], fw: [] };
          for (let k = 0; k <= 120; k++) {
            const lh = -12 + k * 0.1;
            const e = estimates(10 ** lh);
            curves.xs.push(lh);
            curves.c.push(Math.log10(Math.max(1e-16, rel(e.num))));
            curves.fw.push(Math.log10(Math.max(1e-16, rel(e.fwd))));
          }
        };
        const top = f.plot({
          height: 160,
          square: false,
          draw: (pl) => {
            const span = 1.2;
            const xs: number[] = [];
            const ys: number[] = [];
            for (let k = 0; k <= 120; k++) {
              const w = w0 - span + (2 * span * k) / 120;
              xs.push(w);
              ys.push(loss(w, false));
            }
            const lo = Math.min(...ys);
            const hi = Math.max(...ys);
            const f0 = loss(w0, false);
            const e = estimates(h);
            const tangent = xs.map((w) => f0 + ana * (w - w0));
            const chordY0 = loss(w0 - h, false);
            const chord = xs.map((w) => chordY0 + e.num * (w - (w0 - h)));
            lineChart(pl, {
              x: [w0 - span, w0 + span],
              y: [lo - 0.15, hi + 0.15],
              series: [
                { xs, ys, color: color('red'), label: '' },
                { xs, ys: tangent, color: color('teal'), label: '' },
                { xs, ys: chord, color: color('orange'), label: '', dash: [6, 4] },
              ],
              xTicks: [-1, -0.5, 0, 0.5, 1].map((d) => ({ v: w0 + d, s: fmt(w0 + d, 2) })),
              yTicks: [Math.ceil(lo * 2) / 2, Math.ceil(lo * 2) / 2 + 0.5, Math.ceil(lo * 2) / 2 + 1].filter((v) => v <= hi + 0.15).map((v) => ({ v, s: String(v) })),
              xLabel: 'w = W[0, 0]',
              yLabel: '',
            });
            legend(pl, [
              { label: 'loss f(w)', color: color('red') },
              { label: 'tangent (calculus)', color: color('teal') },
              { label: 'chord through w ± h', color: color('orange') },
            ], 'tl', 44);
            const X0 = (v: number) => 40 + ((v - (w0 - span)) / (2 * span)) * (pl.w - 52);
            const Y0 = (v: number) => 26 + ((hi + 0.15 - v) / (hi - lo + 0.3)) * (pl.h - 59);
            if (h > 0.02) {
              for (const w of [w0 - h, w0 + h]) {
                pl.ctx.beginPath();
                pl.ctx.arc(X0(w), Y0(loss(w, false)), 4, 0, Math.PI * 2);
                pl.ctx.fillStyle = color('orange');
                pl.ctx.fill();
              }
            }
          },
        });
        const bottom = f.plot({
          aspect: 1.5,
          square: false,
          draw: (pl) => {
            lineChart(pl, {
              x: [-12, 0],
              y: [-14, 0.5],
              series: [
                { xs: curves.xs, ys: curves.fw, color: color('orange'), label: 'forward' },
                { xs: curves.xs, ys: curves.c, color: color('teal'), label: 'centered' },
              ],
              xTicks: [-12, -10, -8, -6, -4, -2, 0].map((v) => ({ v, s: v === 0 ? '1' : `1e${v}` })),
              yTicks: [-12, -9, -6, -3, 0].map((v) => ({ v, s: v === 0 ? '1' : `1e${v}` })),
              xLabel: 'h (log scale)',
              yLabel: 'relative error (log scale)',
              marks: [{ x: Math.log10(h), color: color('purple') }],
            });
          },
        });
        top.canvas.classList.add('scroll-ok');
        bottom.canvas.classList.add('scroll-ok');
        const numRo = f.readout('numerical');
        const anaRo = f.readout('analytic', { sym: 'dW' });
        const errRo = f.readout('relative error');
        const sync = () => {
          const e = estimates(h);
          const r = rel(e.num);
          f.code.setMany({
            h: fmt(h, 2),
            num: e.num.toPrecision(10),
            fwd: e.fwd.toPrecision(10),
            ana: ana.toPrecision(10),
            err: r.toExponential(1),
          });
          numRo.set(e.num.toPrecision(8));
          anaRo.set(ana.toPrecision(8));
          errRo.set(r.toExponential(1));
          top.redraw();
          bottom.redraw();
        };
        f.slider({
          label: 'h',
          sym: 'h',
          min: -12,
          max: 0,
          step: 0.1,
          value: -5,
          map: (r) => 10 ** r,
          format: (v) => fmt(v, 2),
          onInput: (v) => {
            h = v;
            f.code.highlight(['num', 'err']);
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
            f32 = v === 'float32';
            buildCurves();
            sync();
          },
        });
        buildCurves();
        sync();
      },
      caption: `The function here is smooth on purpose: the softmax loss of a single example, viewed as a function of one weight $w$. **Top:** the curve (red), its true tangent from calculus (teal), and the chord the centered difference actually measures (orange, through $w - h$ and $w + h$). With a large $h$ the chord visibly misses. **Bottom:** the relative error of each recipe for every $h$ from $10^{-12}$ to 1, on log scales. Slide $h$ down from 1 and the error falls, twice as steeply for the centered recipe. Keep going and it *rises* again: at tiny $h$ the two loss values agree in almost every digit, so their difference is mostly rounding noise. The centered recipe is best near $h = 10^{-5}$, exactly the course's advice. Switch to **float32** (the precision GPUs favor): the sweet spot moves to a much larger $h$ and even the best error is far worse, which is why gradient checks are done in float64.`,
    });

    p.prose(`
Numerical gradients are simple and always available, but they have two serious drawbacks. They are **approximate**, as the figure shows. And they are **slow**: the centered recipe needs two full evaluations of the loss *per weight*. For the CIFAR-10 linear classifier that is 61,460 passes over the training set to take a single step. A modern network has millions of weights. We need something better.`);

    // ---------------------------------------------------------------- analytic
    p.h2('The analytic gradient', 'analytic');
    p.prose(`
The alternative is to work out a formula for the gradient with calculus, once, on paper, and then just evaluate it. That is exact, and costs about as much as computing the loss itself. The catch is that deriving it by hand is error-prone, which is why the numerical gradient stays around as a check.

Take the SVM loss of a single example $i$: the inner sum of Eq 5.1, $\\sum_{j \\ne y_i} \\max(0,\\, w_j^\\top x_i - w_{y_i}^\\top x_i + \\Delta)$, with margin $\\Delta = 1$. Two facts from Calculus 1 are all we need:

- The slope of $\\max(0, z)$ is 0 when $z < 0$ (the flat part of the hinge) and 1 when $z > 0$ (the ramp).
- The slope of a score $w_j^\\top x_i = \\sum_d w_{j,d}\\, x_{i,d}$ with respect to weight $w_{j,d}$ is just $x_{i,d}$: raise that weight by one unit and the score rises by that input value. So with respect to the whole row $w_j$, the slope is the example $x_i$ itself.

Multiplying the outer slope by the inner slope (that is the *chain rule*, the subject of the [next chapter](#/backprop)) gives the gradient for each row of $\\symW$:`);
    p.math({
      label: 'SVM gradient for a wrong class j',
      tex: String.raw`\nabla_{\sym{W}{w_j}} \symL_i \;=\; \mathbf{1}\big(\sym{W}{w_j}^{\top}\symx_i - \sym{W}{w_{\symy_i}}^{\top}\symx_i + \Delta > 0\big)\; \symx_i \qquad (j \ne \symy_i)`,
      codeTitle: 'svm_grad_wrong.py',
      code: `
        scores = W.dot(x)
        margins = scores - scores[y] + 1      # one per class
        for j in range(num_classes):
            if j != y and margins[j] > 0:     # class j violates
                dW[j] += x                    # gradient of row j: +x
      `,
      terms: [
        [String.raw`\mathbf{1}(\cdots > 0)`, 'the indicator: 1 if class $j$ is inside the margin (its hinge is on the ramp), otherwise 0'],
        [String.raw`\symx_i`, 'the example itself: the slope of the score with respect to its row of weights'],
        [String.raw`\nabla_{\sym{W}{w_j}} \symL_i`, 'the gradient with respect to row $j$ of $W$: one number per input dimension'],
      ],
      explain: 'If class $j$ violates the margin, its row\'s gradient is the example $x_i$; if not, it is zero. Stepping *against* the gradient subtracts a little of $x_i$ from $w_j$, which lowers class $j$\'s score on this example: exactly the fix we want.',
    });
    p.math({
      label: 'SVM gradient for the correct class',
      tex: String.raw`\nabla_{\sym{W}{w_{\symy_i}}} \symL_i \;=\; -\Big(\sum_{j \ne \symy_i} \mathbf{1}\big(\sym{W}{w_j}^{\top}\symx_i - \sym{W}{w_{\symy_i}}^{\top}\symx_i + \Delta > 0\big)\Big)\; \symx_i`,
      codeTitle: 'svm_grad_right.py',
      code: `
        violators = np.sum(margins > 0) - 1   # margins[y] is 1: skip it
        dW[y] -= violators * x                # -x once per violator
      `,
      terms: [
        [String.raw`\sum_{j \ne \symy_i} \mathbf{1}(\cdots)`, 'the number of classes that violate the margin'],
        [String.raw`-`, 'the correct score enters every hinge with a minus sign'],
        [String.raw`\cdots\;\symx_i`, 'so the gradient is minus that count, times the example'],
      ],
      explain: 'The correct class\'s score appears, negated, inside every active hinge, so each violation contributes $-x_i$ to its row\'s gradient. Stepping against the gradient *adds* $x_i$ to $w_{y_i}$ once per violator, raising the correct score. For the full loss, average these per-example gradients over the training set and add $2\\lambda W$ from the regularization term.',
    });

    p.figure({
      title: 'What one example\'s gradient does',
      codeTitle: 'svm_grad_one.py',
      code: `
        x, y = X[{{i:…}}], Y[{{i}}]      # class {{yc:…}}
        scores = W.dot(x)     # [{{s0:…}}, {{s1:…}}, {{s2:…}}]
        margins = scores - scores[y] + 1
        # margins = [{{m0:…}}, {{m1:…}}, {{m2:…}}]
        dW = np.zeros_like(W)
        for j in range(3):
            if j != y and margins[j] > 0:   # j violates
                dW[j] += x    # step moves w_j away from x   #@wrong
                dW[y] -= x    # step moves w_y toward x      #@right
        step_size = {{lr:0.3}}
        W += -step_size * dW                               #@step
        # loss {{loss:…}}, numerical check {{err:…}}
      `,
      setup(f) {
        const data = blobs(15, 3, 0.3, 5);
        const W0 = new Float64Array(2 * K);
        for (let c = 0; c < K; c++) {
          const a = (c / 3) * Math.PI * 2 + 0.6 + 1.25;
          W0[2 * c] = 1.25 * Math.cos(a);
          W0[2 * c + 1] = 1.25 * Math.sin(a);
        }
        const W = Float64Array.from(W0);
        let lr = 0.3;
        const li = (i: number, w: ArrayLike<number> = W) => svm(w, data, [i], 0);
        const firstBad = () => {
          let best = 0;
          let bestV = -1;
          for (let i = 0; i < data.n; i++) {
            const v = li(i);
            if (v > bestV) {
              bestV = v;
              best = i;
            }
          }
          return best;
        };
        let sel = firstBad();
        const parts = () => {
          const x0 = data.X[2 * sel]!;
          const x1 = data.X[2 * sel + 1]!;
          const yi = data.y[sel]!;
          const s = [0, 1, 2].map((c) => W[2 * c]! * x0 + W[2 * c + 1]! * x1);
          const m = s.map((v) => v - s[yi]! + 1);
          const viol = [0, 1, 2].filter((c) => c !== yi && m[c]! > 0);
          return { x0, x1, yi, s, m, viol };
        };
        const pl = f.plot({
          aspect: 1.1,
          domain: [-1.75, 1.75, -1.75, 1.75],
          draw: (pp) => {
            const cols = CLASS_COLORS.slice(0, 3).map((c) => rgbOf(color(c)));
            pp.field((a, b) => {
              let best = 0;
              let bs = -Infinity;
              for (let c = 0; c < 3; c++) {
                const v = W[2 * c]! * a + W[2 * c + 1]! * b;
                if (v > bs) {
                  bs = v;
                  best = c;
                }
              }
              const [r, g, bb] = cols[best]!;
              return [r, g, bb, 30];
            }, 6);
            pp.axes({ grid: 0.5 });
            for (let i = 0; i < data.n; i++) pp.dot(data.X[2 * i]!, data.X[2 * i + 1]!, i === sel ? 6.5 : 4, color(CLASS_COLORS[data.y[i]!]!), i === sel ? color('--ink') : withAlpha(color('--paper'), 0.9));
            const { x0, x1, yi, viol } = parts();
            pp.path([0, x0], [0, x1], color('--ink-2'), 1.5, [4, 3]);
            pp.text('x', x0 + 0.07, x1 + 0.07, { size: 13, bold: true, color: color('orange') });
            for (let c = 0; c < 3; c++) {
              const col = color(CLASS_COLORS[c]!);
              pp.arrow(0, 0, W[2 * c]!, W[2 * c + 1]!, col, 3);
              const tx = W[2 * c]! * 1.12;
              const ty = W[2 * c + 1]! * 1.12;
              pp.text(`w${'₀₁₂'[c]}`, tx, ty, { size: 13, bold: true, color: col, align: 'center', base: 'middle' });
            }
            const teal = color('teal');
            for (const j of viol) pp.arrow(W[2 * j]!, W[2 * j + 1]!, W[2 * j]! - lr * x0, W[2 * j + 1]! - lr * x1, teal, 2.5);
            if (viol.length) pp.arrow(W[2 * yi]!, W[2 * yi + 1]!, W[2 * yi]! + lr * viol.length * x0, W[2 * yi + 1]! + lr * viol.length * x1, teal, 2.5);
          },
        });
        pl.canvas.classList.add('scroll-ok');
        const lossRo = f.readout('loss Lᵢ', { sym: 'L' });
        const violRo = f.readout('violations');
        const sync = () => {
          const { yi, s, m, viol } = parts();
          const loss = li(sel);
          // numerical check of the formula on this example
          const ana = new Float64Array(2 * K);
          svm(W, data, [sel], 0, ana);
          let worst = 0;
          const Wt = Float64Array.from(W);
          for (let k = 0; k < 2 * K; k++) {
            const old = Wt[k]!;
            Wt[k] = old + 1e-5;
            const fp = li(sel, Wt);
            Wt[k] = old - 1e-5;
            const fm = li(sel, Wt);
            Wt[k] = old;
            const num = (fp - fm) / 2e-5;
            const den = Math.max(Math.abs(num), Math.abs(ana[k]!));
            if (den > 0) worst = Math.max(worst, Math.abs(num - ana[k]!) / den);
          }
          f.code.setMany({
            i: sel,
            yc: `${yi} (${['blue', 'orange', 'green'][yi]})`,
            s0: fmt(s[0]!, 2),
            s1: fmt(s[1]!, 2),
            s2: fmt(s[2]!, 2),
            m0: yi === 0 ? '1' : fmt(m[0]!, 2),
            m1: yi === 1 ? '1' : fmt(m[1]!, 2),
            m2: yi === 2 ? '1' : fmt(m[2]!, 2),
            loss: fmt(loss, 3),
            err: worst === 0 ? '0' : worst.toExponential(1),
          });
          lossRo.set(loss);
          violRo.set(viol.length);
          f.code.highlight(viol.length ? ['wrong', 'right'] : null);
          pl.redraw();
        };
        pl.canvas.addEventListener('click', (e) => {
          const [a, b] = pl.pointer(e);
          let best = -1;
          let bd = Infinity;
          for (let i = 0; i < data.n; i++) {
            const d = Math.hypot(pl.sx(data.X[2 * i]!) - pl.sx(a), pl.sy(data.X[2 * i + 1]!) - pl.sy(b));
            if (d < bd) {
              bd = d;
              best = i;
            }
          }
          if (best >= 0 && bd < 22) {
            sel = best;
            sync();
          }
        });
        f.button('Step', () => {
          const g = new Float64Array(2 * K);
          svm(W, data, [sel], 0, g);
          for (let k = 0; k < 2 * K; k++) W[k] -= lr * g[k]!;
          f.code.highlight('step');
          sync();
          f.code.highlight('step');
        }, { primary: true });
        f.button('Worst example', () => {
          sel = firstBad();
          sync();
        });
        f.button('Reset', () => {
          W.set(W0);
          sel = firstBad();
          sync();
        }, { icon: 'reset' });
        f.slider({
          label: 'step size η',
          sym: 'eta',
          min: 0.05,
          max: 1,
          step: 0.05,
          value: 0.3,
          slot: 'lr',
          format: (v) => v.toFixed(2),
          onInput: (v) => {
            lr = v;
            pl.redraw();
          },
        });
        sync();
      },
      caption: `Each thick arrow is one row of $\\symW$ (one class's weights) in a 2-D toy problem; the background shows which class wins where. **Tap a point** to pick that example $\\symx_i$ (dashed line). For every wrong class that violates the margin, the teal arrow at the tip of its row is the step $-\\eta\\,\\symx_i$: pushed away from the example. The correct class's row gets $+\\eta\\,\\symx_i$ once per violator: pulled toward it. Press **Step** to apply the update (gradient descent on a single example) and watch the margins in the code shrink; **Worst example** jumps to the example with the highest loss. The last code line checks the formula against a numerical gradient: they agree to many digits, unless the example sits exactly on a crease.`,
    });

    p.prose(`
### Gradient check

Because analytic gradients are so easy to get subtly wrong (a flipped sign, a forgotten term), the standard practice is to compute both and compare them. This is a **gradient check**, and Assignment 1 has you run one for both the SVM and the softmax loss. The comparison uses the *relative* error, so that one threshold works whether the gradients are large or small.`);
    p.math({
      label: 'Relative error between two gradients',
      tex: String.raw`\text{relative error} = \frac{\big|\,f'_a - f'_n\,\big|}{\max\!\big(|f'_a|,\, |f'_n|\big)}`,
      codeTitle: 'grad_check.py',
      code: `
        f = lambda W: L(W, X, y, reg)
        num = eval_numerical_gradient(f, W)     # slow, approximate
        ana = svm_grad(W, X, y, reg)            # fast, exact if right
        rel = np.abs(ana - num) / np.maximum(np.abs(ana), np.abs(num))
        print(rel.max())                        # should be tiny
      `,
      terms: [
        [String.raw`f'_a`, 'the analytic gradient, from the formula'],
        [String.raw`f'_n`, 'the numerical gradient, from finite differences'],
        [String.raw`\max(|f'_a|, |f'_n|)`, 'the size of the larger of the two, so the error is measured relative to the gradient itself'],
      ],
      explain: 'A disagreement of 0.001 is alarming when both gradients are around 0.002, and meaningless when both are around 1,000; dividing by their size makes one yardstick work everywhere. With double precision and a smooth loss, a correct gradient typically shows relative errors of about $10^{-7}$ or less, while errors above about $10^{-2}$ almost always mean a bug. A kinked loss like the SVM can show a larger error when a nudge happens to cross a crease; [Chapter 9](#/nn-learning) covers these cases.',
    });
    p.table(
      ['', 'Numerical gradient', 'Analytic gradient'],
      [
        ['How', 'nudge each weight, re-run the loss', 'derive a formula with calculus, then evaluate it'],
        ['Accuracy', 'approximate (step size and rounding)', 'exact'],
        ['Cost', 'two loss evaluations *per weight*', 'about one loss evaluation in total'],
        ['Risk', 'very hard to get wrong', 'easy to get subtly wrong'],
        ['Use it for', 'checking', 'training'],
      ],
    );

    // ---------------------------------------------------------------- descent
    p.h2('Gradient descent', 'gradient-descent');
    p.prose(`Once we can compute the gradient, the optimization procedure is almost embarrassingly simple: compute the gradient, take a small step against it, and repeat.`);
    p.math({
      label: 'The gradient descent update',
      tex: String.raw`\symW \;\leftarrow\; \symW - \symeta\, \symdW`,
      codeTitle: 'gradient_descent.py',
      code: `
        while True:
            dW = evaluate_gradient(L, X_train, y_train, W)
            W += -step_size * dW        # a small step downhill
      `,
      terms: [
        [String.raw`\symdW`, 'the gradient: the direction in which the loss rises fastest'],
        [String.raw`-`, 'so we go the opposite way: downhill'],
        [String.raw`\symeta`, 'the *step size* or *learning rate*: how far to go each time'],
        [String.raw`\leftarrow`, '"replace $W$ with": the update is applied over and over'],
      ],
      explain: 'The gradient only says which way is downhill *right here*; a little further on, the ground may tilt differently. So we take a modest step and measure again. The step size $\\eta$ is the single most important hyperparameter in training a neural network: too small and progress is painfully slow; too large and each step overshoots the valley floor, bouncing from wall to wall or flying off entirely.',
    });
    p.prose(`There is no formula for the right step size; you find it by experiment ([Chapter 9](#/nn-learning) shows how to read the evidence). The figure shows the classic behaviors on a long, narrow valley, the shape that makes step sizes hardest to choose: steep across, nearly flat along. Real loss landscapes are full of such valleys.`);

    p.figure({
      title: 'Step size on a narrow valley',
      codeTitle: 'step_size.py',
      code: `
        c = {{c:10}}        # how much steeper across than along
        def L(W):  return 0.5 * (W[0] ** 2 + c * W[1] ** 2)
        def dL(W): return np.array([W[0], c * W[1]])

        W = np.array([-4.2, 1.6])
        step_size = {{lr:0.05}}
        for it in range(60):
            dW = dL(W)                          #@grad
            W += -step_size * dW                #@update
        # it {{it:0}}: W = [{{w0:…}}, {{w1:…}}], loss {{loss:…}}
      `,
      setup(f) {
        let lr = 0.05;
        let cc = 10;
        const N = 60;
        let path: number[] = [];
        let shown = 0;
        const Lf = (a: number, b: number) => 0.5 * (a * a + cc * b * b);
        const surf = new Surface(Lf, { hue: 'red', lo: 0, hi: 40, gamma: 0.45, levels: [0.25, 1, 2.5, 5, 9, 14, 21, 30], cell: 4 });
        const compute = () => {
          path = [-4.2, 1.6];
          let a = -4.2;
          let b = 1.6;
          for (let k = 0; k < N; k++) {
            a -= lr * a;
            b -= lr * cc * b;
            path.push(a, b);
          }
        };
        const verdict = () => {
          const L0 = Lf(-4.2, 1.6);
          const Lend = Lf(path[2 * N]!, path[2 * N + 1]!);
          if (lr * cc > 2 || lr > 2) return 'Diverging: every step overshoots by more than it corrects, and the loss explodes.';
          if (lr * cc > 1) return `Zig-zagging: the step is too big for the steep direction (η·c = ${fmt(lr * cc, 2)} > 1), so it overshoots on every step, but the bounces shrink.`;
          if (Lend / L0 > 0.01) return 'Crawling: the steps are safe but tiny, and after 60 of them it is still far from the bottom.';
          return 'Smooth: it slides across the valley quickly, then follows the floor to the bottom.';
        };
        const pl = f.plot({
          aspect: 1.75,
          domain: [-5, 5, -2.6, 2.6],
          draw: (pp) => {
            surf.draw(pp);
            const pts = path.slice(0, 2 * (shown + 1));
            trail(pp, pts, color('teal'), 2, true);
            const k = 2 * shown;
            if (Math.abs(path[k]!) < 50 && Math.abs(path[k + 1]!) < 50) pp.dot(path[k]!, path[k + 1]!, 5.5, color('teal'), color('--paper'));
            pp.dot(0, 0, 3, color('--ink'));
            pp.text('minimum', 0.12, -0.32, { size: 11, color: color('--ink-2') });
            pp.text('W₀ →', 3.9, -2.35, { size: 11, color: color('--ink-2') });
            pp.text('W₁ ↑', -4.85, 2.25, { size: 11, color: color('--ink-2') });
          },
        });
        pl.canvas.classList.add('scroll-ok');
        const itRo = f.readout('step');
        const lossRo = f.readout('loss', { sym: 'L' });
        const sync = () => {
          const k = 2 * shown;
          const a = path[k]!;
          const b = path[k + 1]!;
          const big = (v: number) => (Math.abs(v) > 1e5 ? v.toExponential(1) : fmt(v, 3));
          f.code.setMany({ it: shown, w0: big(a), w1: big(b), loss: big(Lf(a, b)) });
          itRo.set(shown);
          lossRo.set(big(Lf(a, b)));
          pl.redraw();
        };
        let acc = 0;
        let phase = 0;
        const loop = f.loop((dt) => {
          acc += dt;
          while (acc > 0.06) {
            acc -= 0.06;
            if (shown >= N) {
              f.code.highlight(null);
              f.status(verdict());
              return false;
            }
            shown++;
            f.code.highlight(phase++ % 2 ? 'update' : 'grad');
          }
          sync();
        });
        const restart = () => {
          compute();
          shown = 0;
          acc = 0;
          f.status('');
          sync();
          loop.start();
        };
        f.slider({
          label: 'step size η',
          sym: 'eta',
          min: -3,
          max: Math.log10(0.3),
          step: 0.01,
          value: Math.log10(0.05),
          map: (r) => 10 ** r,
          format: (v) => fmt(v, 2),
          slot: 'lr',
          onInput: (v) => {
            lr = v;
            restart();
          },
        });
        f.slider({
          label: 'steepness c',
          min: 1,
          max: 20,
          step: 1,
          value: 10,
          slot: 'c',
          onInput: (v) => {
            cc = v;
            surf.invalidate();
            restart();
          },
        });
        f.button('Replay', restart, { icon: 'play' });
        compute();
        shown = N;
        sync();
        f.status(verdict());
      },
      caption: `A valley $c$ times steeper across ($W_1$) than along ($W_0$), and 60 steps of gradient descent from the same start; moving either slider replays the run. With a very small step size the path creeps and is still far from the bottom after 60 steps. Around 0.05 it drops into the valley and glides along the floor. Past $1/c$ (0.1 for the default valley) it overshoots the steep direction on every step and zig-zags; past $2/c$ each bounce is bigger than the last and it diverges. Now lower $c$ to make the valley rounder: much larger steps become safe. The steepest direction sets the speed limit for every direction, which is why narrow valleys are slow (and why Chapter 9's momentum and Adam exist).`,
    });

    // -------------------------------------------------------------- minibatch
    p.h2('Mini-batch gradient descent', 'mini-batch');
    p.prose(`
The loss is an average over the whole training set, and so is its gradient. Computing it exactly means a pass over every training example for every single step. For a large dataset such as the ImageNet challenge (ILSVRC), with 1.2 million training images, that is extremely wasteful.

The standard fix is to estimate the gradient from a small random sample, a **mini-batch**: for example 256 images out of the 1.2 million. Each estimate is a little noisy, but it is thousands of times cheaper to compute, so in the same time you can take thousands of slightly wobbly steps instead of one perfect one.`);
    p.math({
      label: 'The mini-batch gradient',
      tex: String.raw`\symdW \;\approx\; \frac{1}{\symB} \sum_{i \in \mathcal{B}} \nabla_{\symW} \symL_i`,
      codeTitle: 'minibatch_gd.py',
      code: `
        while True:
            idx = np.random.choice(N, batch_size, replace=False)
            X_batch, y_batch = X_train[idx], y_train[idx]
            dW = evaluate_gradient(L, X_batch, y_batch, W)
            W += -step_size * dW
      `,
      terms: [
        [String.raw`\mathcal{B}`, 'a random set of $B$ training examples, drawn fresh for every step'],
        [String.raw`\nabla_{\symW} \symL_i`, 'the gradient of example $i$\'s loss alone'],
        [String.raw`\frac{1}{\symB}\sum_{i \in \mathcal{B}}`, 'the average over the batch: an estimate of the average over all $N$ examples'],
      ],
      explain: 'The true gradient averages over all $N$ examples; the mini-batch gradient averages over a random sample of $B$ of them. Like a poll of a few hundred voters standing in for a whole country, it is right on average and close most of the time, and it gets closer as $B$ grows.',
    });
    p.prose(`
Why does this work so well? Partly because training examples are correlated: a big dataset contains many images that are alike. Take the extreme case: suppose all 1.2 million ImageNet images were exact copies of just 1,000 distinct ones. Then the gradient computed from those 1,000 would be *identical* to the full gradient, and the other 1.199 million evaluations would add nothing. Real datasets are not that redundant, but they are redundant enough.

A few conventions worth knowing:

- Batch sizes are usually powers of 2 (32, 64, 128, 256), because many vectorized operations run faster on inputs of those sizes.
- The batch size is a hyperparameter, but it is rarely tuned carefully. Usually it is set by how much fits in memory.
- The extreme case, one example per step, is called **stochastic gradient descent** (SGD), or sometimes *on-line* gradient descent. Batches of one are rare in practice, and people say "SGD" for mini-batch gradient descent too: when a paper or a library says SGD, it almost always means mini-batches.`);

    p.figure({
      title: 'Full-batch versus mini-batch',
      codeTitle: 'batch_size.py',
      code: `
        # grad_L(t, idx): the slice gradient of Fig 5.2,
        # using only the examples listed in idx
        B = {{B:4}}               # mini-batch size
        step_size = 0.3
        t_full = t_mini = np.array([-3.2, 2.8])
        for it in range(100):    # it = {{it:0}}
            # full batch: exact gradient from all 300 points
            g = grad_L(t_full, all_idx)                    #@full
            t_full = t_full - step_size * g                #@full
            # mini-batch: estimate from B random points
            idx = np.random.choice(300, B, replace=False)  #@mini
            g = grad_L(t_mini, idx)                        #@mini
            t_mini = t_mini - step_size * g                #@mini
        # points looked at: full {{nf:0}}, mini-batch {{nm:0}}
      `,
      setup(f) {
        const prob = toyProblem();
        const sl = new Slice(prob.data, prob.W0, 4, prob.reg);
        const surf = new Surface((a, b) => sl.loss(a, b), { hue: 'red', lo: 0.75, hi: 4.6, levels: [0.85, 1, 1.25, 1.6, 2, 2.5, 3, 3.6, 4.2] });
        const N_IT = 100;
        const lr = 0.3;
        let B = 4;
        let seed = 3;
        let rng = new Rng(seed);
        let full: number[] = [];
        let mini: number[] = [];
        let lf: number[] = [];
        let lm: number[] = [];
        let it = 0;
        const reset = () => {
          rng = new Rng(seed);
          full = [...START];
          mini = [...START];
          const l0 = sl.loss(...START);
          lf = [l0];
          lm = [l0];
          it = 0;
        };
        reset();
        const pool = Array.from({ length: prob.data.n }, (_, i) => i);
        const step = () => {
          const n = full.length;
          const g = sl.grad(full[n - 2]!, full[n - 1]!);
          full.push(full[n - 2]! - lr * g.ga, full[n - 1]! - lr * g.gb);
          for (let k = 0; k < B; k++) {
            const j = k + rng.int(pool.length - k);
            [pool[k], pool[j]] = [pool[j]!, pool[k]!];
          }
          const idx = pool.slice(0, B);
          const m = mini.length;
          const gm = sl.grad(mini[m - 2]!, mini[m - 1]!, idx);
          mini.push(mini[m - 2]! - lr * gm.ga, mini[m - 1]! - lr * gm.gb);
          lf.push(sl.loss(full[n]!, full[n + 1]!));
          lm.push(sl.loss(mini[m]!, mini[m + 1]!));
          it++;
        };
        const COL = { full: () => color('teal'), mini: () => color('orange') };
        const pl = f.plot({
          aspect: 1.15,
          domain: [-4.2, 4.2, -4.2, 4.2],
          draw: (pp) => {
            surf.draw(pp);
            trail(pp, full, COL.full(), 2.2, true);
            trail(pp, mini, COL.mini(), 1.6, false);
            pp.dot(START[0], START[1], 6, 'transparent', color('--ink'));
            pp.dot(full[full.length - 2]!, full[full.length - 1]!, 5, COL.full(), color('--paper'));
            pp.dot(mini[mini.length - 2]!, mini[mini.length - 1]!, 5, COL.mini(), color('--paper'));
            legend(pp, [
              { label: 'full batch (300 per step)', color: COL.full() },
              { label: `mini-batch (${B} per step)`, color: COL.mini() },
            ], 'bl');
          },
        });
        const chart = f.plot({
          height: 140,
          square: false,
          draw: (pp) => {
            const xf = lf.map((_, k) => Math.log10(Math.max(1, k * 300)));
            const xm = lm.map((_, k) => Math.log10(Math.max(1, k * B)));
            lineChart(pp, {
              x: [0, Math.log10(300 * N_IT)],
              y: [0.7, 3],
              series: [
                { xs: xf.slice(1), ys: lf.slice(1), color: COL.full(), label: 'full' },
                { xs: xm.slice(1), ys: lm.slice(1), color: COL.mini(), label: 'mini' },
              ],
              xTicks: [0, 1, 2, 3, 4].map((v) => ({ v, s: ['1', '10', '100', '1k', '10k'][v]! })),
              yTicks: [1, 2, 3].map((v) => ({ v, s: String(v) })),
              xLabel: 'examples looked at (log scale)',
              yLabel: 'full training loss',
            });
          },
        });
        const sync = () => {
          f.code.setMany({ it, nf: (it * 300).toLocaleString('en-US'), nm: (it * B).toLocaleString('en-US') });
          pl.redraw();
          chart.redraw();
        };
        let acc = 0;
        let phase = 0;
        const loop = f.loop((dt) => {
          acc += dt;
          while (acc > 0.05) {
            acc -= 0.05;
            if (it >= N_IT) {
              stop();
              return false;
            }
            step();
            f.code.highlight(phase++ % 2 ? 'mini' : 'full');
          }
          sync();
        });
        const stop = () => {
          loop.stop();
          run.textContent = it >= N_IT ? 'Replay' : 'Run';
          if (it >= N_IT) f.code.highlight(null);
        };
        const run = f.button('Run', () => {
          if (loop.running()) stop();
          else {
            if (it >= N_IT) {
              reset();
              sync();
            }
            acc = 0;
            loop.start();
            run.textContent = 'Pause';
          }
        }, { primary: true });
        f.button('New batches', () => {
          stop();
          seed++;
          reset();
          sync();
          acc = 0;
          loop.start();
          run.textContent = 'Pause';
        }, { icon: 'shuffle' });
        f.slider({
          label: 'batch size B',
          sym: 'B',
          min: 0,
          max: 8,
          step: 1,
          value: 2,
          map: (r) => 2 ** r,
          format: (v) => String(v),
          slot: 'B',
          onInput: (v) => {
            B = v;
            stop();
            reset();
            sync();
          },
        });
        sync();
      },
      caption: `Full-batch gradient descent (teal) and mini-batch gradient descent (orange) on the same 2-D slice of the SVM loss, with the same step size and start. Press **Run**. The full-batch path is smooth because every step uses all 300 points. The mini-batch path wobbles, because each step sees only $\\symB$ of them, but it heads the same way. The chart plots each run's true loss against the number of examples it has looked at so far, on a log scale: for any fixed amount of work, the mini-batch run is far ahead. Slide $\\symB$ down to 1 for pure stochastic gradient descent (very noisy, yet it still gets close) and up to 256 (nearly the full-batch path, at nearly the full cost).`,
    });

    // ---------------------------------------------------------------- summary
    p.h2('Summary: the whole pipeline', 'summary');
    p.table(
      ['Piece', 'What it does', 'In code'],
      [
        ['Score function', 'maps an input to class scores', '`scores = W.dot(x)`'],
        ['Loss function', 'grades the scores on the training data with one number', '`loss = L(W)`'],
        ['Gradient', 'says which way is uphill for every weight: analytic for speed, numerical to check', '`dW = grad_L(W)`'],
        ['Update', 'steps the weights downhill, usually using mini-batches', '`W += -step_size * dW`'],
      ],
    );
    p.prose(`
Everything in the rest of the course plugs into this loop. Neural networks replace the score function with something far more expressive, and the loop stays exactly the same. What changes is how hard the gradient becomes: deriving it by hand the way we did for the SVM would be hopeless for a deep network. The [next chapter](#/backprop) introduces **backpropagation**, a systematic way to compute the gradient of any function built from simple pieces, by applying the chain rule one piece at a time.`);
    p.callout('idea', `Training is optimization: find the $\\symW$ that minimizes the loss. The loss is a landscape over weight space; for a linear SVM it is a convex bowl with creases. Random search fails in high dimensions; following the negative **gradient** works. The gradient is one slope per weight: compute it **analytically** (exact, fast) and verify it **numerically** with a centered difference and $\\symh \\approx 10^{-5}$ (slow, approximate). Gradient descent steps against it with a step size $\\symeta$ that must be tuned: too small crawls, too large bounces or diverges. **Mini-batches** make each step far cheaper at the price of a little noise, and "SGD" usually means exactly that.`, 'Takeaways');
  },
};

export default chapter;

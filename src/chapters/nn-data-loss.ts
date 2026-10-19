import type { ChapterDef } from './index';
import type { Fig } from '../core/page';
import { fmt } from '../core/code';
import { onDispose } from '../core/dom';
import { CIFAR_CLASSES, loadCifar } from '../core/data';
import { color, withAlpha, type Plot } from '../core/plot';
import { Rng } from '../core/rand';
import { eig2, eigSym, solve, stats2 } from '../lib/nn-data-loss-linalg';
import { NN_DATA_LOSS_SYMBOLS } from '../lib/nn-data-loss-symbols';

/** Animates a flat array of coordinates from its current value to a target. */
class Tween {
  cur: Float64Array;
  private from: Float64Array;
  private to: Float64Array;
  private t0 = 0;
  private loop: { start(): void; stop(): void; running(): boolean };

  constructor(f: Fig, init: Float64Array, private onFrame: () => void, private ms = 560) {
    this.cur = Float64Array.from(init);
    this.from = this.cur;
    this.to = this.cur;
    this.loop = f.loop(() => {
      const k = Math.min(1, (performance.now() - this.t0) / this.ms);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      for (let i = 0; i < this.cur.length; i++) this.cur[i] = this.from[i]! + (this.to[i]! - this.from[i]!) * e;
      this.onFrame();
      if (k >= 1) return false;
    });
  }

  go(target: Float64Array, animate = true): void {
    this.from = Float64Array.from(this.cur);
    this.to = Float64Array.from(target);
    this.t0 = performance.now();
    if (!animate) {
      this.loop.stop();
      this.cur.set(this.to);
      this.onFrame();
      return;
    }
    this.loop.start();
  }
}

const mono = (sz: number, wt = 500) => `${wt} ${sz}px 'JetBrains Mono Variable', ui-monospace, monospace`;
const ui = (sz: number, wt = 400) => `${wt} ${sz}px system-ui, sans-serif`;

/** Dashed ellipse at k standard deviations of a 2-D point cloud, plus its principal axes. */
function drawCov(pl: Plot, P: Float64Array, k: number, axes: boolean): void {
  const st = stats2(P);
  const { l1, l2, u1, u2 } = eig2(st.cxx, st.cxy, st.cyy);
  const a = Math.sqrt(Math.max(0, l1)) * k;
  const b = Math.sqrt(Math.max(0, l2)) * k;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i <= 72; i++) {
    const t = (i / 72) * Math.PI * 2;
    xs.push(st.mx + u1[0] * a * Math.cos(t) + u2[0] * b * Math.sin(t));
    ys.push(st.my + u1[1] * a * Math.cos(t) + u2[1] * b * Math.sin(t));
  }
  pl.path(xs, ys, withAlpha(color('--ink-2'), 0.7), 1.3, [5, 4]);
  if (axes) {
    pl.arrow(st.mx, st.my, st.mx + u1[0] * a, st.my + u1[1] * a, color('purple'), 2.2);
    if (b > 0.05) pl.arrow(st.mx, st.my, st.mx + u2[0] * b, st.my + u2[1] * b, color('purple'), 2.2);
  }
  const c = color('teal');
  pl.ctx.strokeStyle = c;
  pl.ctx.lineWidth = 2.5;
  const X = pl.sx(st.mx), Y = pl.sy(st.my);
  pl.ctx.beginPath();
  pl.ctx.moveTo(X - 6, Y - 6);
  pl.ctx.lineTo(X + 6, Y + 6);
  pl.ctx.moveTo(X + 6, Y - 6);
  pl.ctx.lineTo(X - 6, Y + 6);
  pl.ctx.stroke();
}

/** Gray 16 x 16 tile from 256 values, contrast-stretched to [lo, hi]. */
function grayTile(ctx: CanvasRenderingContext2D, v: ArrayLike<number>, lo: number, hi: number, x: number, y: number, size: number): void {
  const img = new ImageData(16, 16);
  const span = hi - lo || 1;
  for (let p = 0; p < 256; p++) {
    const g = Math.max(0, Math.min(255, (255 * (v[p]! - lo)) / span));
    img.data[p * 4] = img.data[p * 4 + 1] = img.data[p * 4 + 2] = g;
    img.data[p * 4 + 3] = 255;
  }
  const tmp = document.createElement('canvas');
  tmp.width = tmp.height = 16;
  tmp.getContext('2d')!.putImageData(img, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, x, y, size, size);
  ctx.restore();
}

/** Keeps a canvas's height a function of its width (hidpiCanvas only knows a fixed aspect). */
function fitHeight(canvas: HTMLCanvasElement, hOf: (w: number) => number): void {
  const ro = new ResizeObserver(() => {
    const w = canvas.getBoundingClientRect().width;
    if (w) canvas.style.aspectRatio = `${w} / ${Math.round(hOf(w))}`;
  });
  ro.observe(canvas.parentElement ?? canvas);
  onDispose(() => ro.disconnect());
}

function minmax(v: ArrayLike<number>): [number, number] {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < v.length; i++) {
    lo = Math.min(lo, v[i]!);
    hi = Math.max(hi, v[i]!);
  }
  return [lo, hi];
}

const chapter: ChapterDef = {
  symbols: NN_DATA_LOSS_SYMBOLS,

  render(p) {
    p.prose(`
Chapter 7 built the network itself: neurons, activation functions, layers. A network on paper is not a network that trains, though. Between "here is the architecture" and "here is a model that works" sit a handful of decisions that look like housekeeping and turn out to decide everything:

- what to do to the **data** before the network sees it,
- what numbers to put in the **weights** before training starts,
- how to keep the signal inside the network **well-scaled** as it flows through many layers (batch normalization),
- how to stop the network from **memorizing** the training set (regularization and dropout),
- and which **loss** to minimize for the problem you actually have.

Each of these has a short recipe that people follow in practice, and a reason behind it that is worth understanding. This chapter gives both, with the reason made visible.`);

    // ------------------------------------------------------------------ preprocessing
    p.h2('Preprocessing the data', 'preprocessing');
    p.prose(`
Arrange the training data as a matrix $\\symx$ with one row per example and one column per *feature* (for an image, a feature is one pixel value). There are three common things to do to it before training, from always-do to rarely-do.

**Mean subtraction** is the always-do. For every feature, compute its average over the training set and subtract it, so each column of $\\symx$ is centered on zero. Geometrically this slides the whole cloud of data points so it sits around the origin.

**Normalization** rescales each feature so they all have roughly the same spread. The usual way is to divide each (already zero-centered) column by its standard deviation. Another is to rescale so each feature's minimum and maximum land at $-1$ and $1$. Normalization only matters when features come in different units or ranges (say, a height in meters next to an income in dollars). For images the pixels already share one scale, 0 to 255, so it is optional.`);

    p.callout('math', `Three words this chapter leans on. The **mean** of a list of numbers is their average: add them up, divide by how many. The **variance** measures spread: subtract the mean from each number, square the differences (so negatives count too), and average those squares. The **standard deviation** (often $\\sigma$, "sigma") is the square root of the variance, which puts the spread back into the original units. If a feature has mean 120 and standard deviation 30, a typical value sits within about 30 of 120. In NumPy: \`np.mean\`, \`np.var\`, \`np.std\`, with \`axis=0\` meaning "down each column, separately per feature."`, 'Math help: mean, variance, standard deviation');

    p.math({
      label: 'Zero-centering and normalizing one feature',
      tex: String.raw`\begin{aligned}\symmu_j &= \frac{1}{N}\sum_{i=1}^{N} \symx_{ij} \\ \symx'_{ij} &= \frac{\symx_{ij} - \symmu_j}{\sigma_j}\end{aligned}`,
      code: `
        mu = np.mean(X, axis=0)   # one mean per column
        X -= mu                   # zero-center
        X /= np.std(X, axis=0)    # unit spread per feature
      `,
      codeTitle: 'preprocess.py',
      terms: [
        [String.raw`\symx_{ij}`, 'feature $j$ of example $i$: row $i$, column $j$ of the data matrix'],
        [String.raw`\symmu_j`, 'the mean of column $j$: add up that feature over all $N$ training examples and divide by $N$'],
        [String.raw`\symx_{ij} - \symmu_j`, 'how far this example sits above or below the average for that feature'],
        [String.raw`\sigma_j`, 'the standard deviation of column $j$, the typical size of those distances'],
      ],
      explain: 'After the subtraction every feature averages to zero; after the division every feature has a standard deviation of one. Nothing about *which* examples are similar to which has changed: the cloud of points has only been slid to the origin and stretched or squeezed along each axis.',
    });

    p.prose(`
### PCA and whitening

A third, heavier move looks at how features vary *together*. In real data, features are rarely independent: neighbouring pixels are almost always similar, so when one is bright the other usually is too. The **covariance matrix** records this. Its entry in row $j$, column $k$ is the average of $\\symx_{ij}\\symx_{ik}$ over all examples (with the data already zero-centered). On the diagonal ($j = k$) that is just each feature's variance. Off the diagonal, a large positive number means the two features rise and fall together; near zero means they are unrelated.`);

    p.callout('math', `A matrix can stretch space more along some directions than others. An **eigenvector** of the covariance matrix is a direction in feature space, and its **eigenvalue** is how much the data varies along that direction. For a symmetric matrix like a covariance, the eigenvectors are perpendicular to each other, so together they form a new set of axes: a rotated coordinate system lined up with the data's own spread. The first eigenvector points along the direction of greatest spread, the second along the greatest spread perpendicular to the first, and so on. \`np.linalg.svd(cov)\` returns them as the columns of \`U\`, already sorted from most to least variance, with the eigenvalues in \`S\`. You never need to compute these by hand; you only need the picture.`, 'Math help: eigenvectors in one paragraph');

    p.math({
      label: 'Covariance, then rotate into its eigenvectors (PCA)',
      tex: String.raw`\begin{aligned}\Sigma &= \frac{1}{N}\,\sym{x}{X}^{\top}\sym{x}{X} = U\,\mathrm{diag}(S)\,U^{\top} \\ \sym{x}{X}_{\text{rot}} &= \sym{x}{X}\,U\end{aligned}`,
      code: `
        X -= np.mean(X, axis=0)            # center first
        cov = np.dot(X.T, X) / X.shape[0]  # (D, D)
        U, S, V = np.linalg.svd(cov)  # eigenvectors in U
        Xrot = np.dot(X, U)           # decorrelated data
        # keep only the top 100 directions:
        Xrot_reduced = np.dot(X, U[:, :100])   # (N, 100)
      `,
      codeTitle: 'pca.py',
      terms: [
        [String.raw`\sym{x}{X}^{\top}\sym{x}{X}`, 'the data matrix, transposed (rows and columns swapped), times itself. Entry $(j,k)$ adds up feature $j$ times feature $k$ over every example'],
        [String.raw`\frac{1}{N}`, 'divide by the number of examples, turning that sum into an average'],
        [String.raw`U\,\mathrm{diag}(S)\,U^{\top}`, 'the same matrix rewritten through its eigenvectors $U$ (one per column) and eigenvalues $S$ (the variance along each)'],
        [String.raw`\sym{x}{X}\,U`, 'express every example in the new axes: its coordinate along eigenvector $j$ is the dot product with column $j$ of $U$'],
      ],
      explain: 'In the rotated coordinates the features no longer move together: the covariance of `Xrot` has zeros everywhere off the diagonal. And because the columns of `U` are sorted by variance, the last ones usually carry almost nothing. Keeping only the first $k$ columns is **PCA dimensionality reduction**: each example shrinks from $D$ numbers to $k$, losing very little. Training a network on PCA-reduced data saves time and memory.',
    });

    p.math({
      label: 'Whitening',
      tex: String.raw`\sym{x}{X}_{\text{white}} = \frac{\sym{x}{X}_{\text{rot}}}{\sqrt{S + \epsilon}}`,
      code: `
        # divide column j of Xrot by sqrt(S[j] + eps)
        Xwhite = Xrot / np.sqrt(S + 1e-5)
      `,
      codeTitle: 'whiten.py',
      terms: [
        [String.raw`\sym{x}{X}_{\text{rot}}`, 'the decorrelated data from PCA'],
        [String.raw`\sqrt{S}`, 'the standard deviation along each eigenvector (the square root of its variance)'],
        [String.raw`\epsilon`, 'a small constant ("epsilon") that prevents dividing by zero, and that can be raised to soften the effect'],
      ],
      explain: 'Dividing each rotated coordinate by its own standard deviation gives every direction a variance of one. The result is a perfectly round cloud: zero mean, no correlations, equal spread everywhere. The catch is that the low-variance directions get stretched the most, and in real data those directions are mostly noise. Whitening blows the noise up to the same size as the signal; a larger $\\epsilon$ tempers that.',
    });

    p.figure({
      title: 'The preprocessing pipeline on a 2-D cloud',
      codeTitle: 'pipeline.py',
      code: `
        # X: N x 2 data, one row per example
        mu = np.mean(X, axis=0)       # [{{m0}}, {{m1}}]
        X0 = X - mu                   # zero-center   #@center
        Xn = X0 / np.std(X0, axis=0)  # normalize     #@norm

        cov = np.dot(X0.T, X0) / X0.shape[0]          #@cov
        U, S, V = np.linalg.svd(cov)  # S = [{{s0}}, {{s1}}] #@cov
        Xrot = np.dot(X0, U)          # decorrelate   #@rot
        Xwhite = Xrot / np.sqrt(S + {{eps:1e-5}})      #@white
        Xred = np.dot(X0, U[:, :1])   # keep 1 of 2   #@reduce

        # covariance of the points shown now:
        # [[{{c00}}, {{c01}}],
        #  [{{c01}}, {{c11}}]]
      `,
      setup(f) {
        const N = 220;
        const rng = new Rng(21);
        const ang = (28 * Math.PI) / 180;
        const X = new Float64Array(N * 2);
        for (let i = 0; i < N; i++) {
          const a = rng.randn() * 1.35, b = rng.randn() * 0.3;
          X[2 * i] = 2.2 + a * Math.cos(ang) - b * Math.sin(ang);
          X[2 * i + 1] = 1.4 + a * Math.sin(ang) + b * Math.cos(ang);
        }
        const st = stats2(X);
        const X0 = X.map((v, i) => v - (i % 2 ? st.my : st.mx));
        const sx = Math.sqrt(st.cxx), sy = Math.sqrt(st.cyy);
        const Xn = X0.map((v, i) => v / (i % 2 ? sy : sx));
        const E = eig2(st.cxx, st.cxy, st.cyy);
        const Xrot = new Float64Array(N * 2);
        for (let i = 0; i < N; i++) {
          const a = X0[2 * i]!, b = X0[2 * i + 1]!;
          Xrot[2 * i] = a * E.u1[0] + b * E.u1[1];
          Xrot[2 * i + 1] = a * E.u2[0] + b * E.u2[1];
        }
        const Xred = Xrot.map((v, i) => (i % 2 ? 0 : v));
        let eps = 1e-5;
        const white = () => Xrot.map((v, i) => v / Math.sqrt((i % 2 ? E.l2 : E.l1) + eps));
        const names = ['the raw data', 'zero-centered', 'normalized', 'decorrelated (PCA)', 'whitened', 'reduced to 1-D'];
        const lines = [null, 'center', 'norm', ['cov', 'rot'], 'white', 'reduce'] as const;
        const stageData = (k: number) => [X, X0, Xn, Xrot, white(), Xred][k]!;
        let stage = 0;
        const pl = f.plot({
          aspect: 1.32,
          domain: [-3.9, 6.1, -3.5, 3.9],
          draw: (pp) => {
            pp.axes({ grid: 1, labels: true });
            const P = tw.cur;
            for (let i = 0; i < N; i++) pp.dot(P[2 * i]!, P[2 * i + 1]!, 2.6, withAlpha(color('orange'), 0.62));
            drawCov(pp, P, 2, true);
            pp.text(names[stage]!, pp.view()[0] + 0.15, pp.view()[3] - 0.45, { size: 13, bold: true, color: color('--ink') });
          },
        });
        const tw = new Tween(f, X, () => pl.redraw());
        const corrRo = f.readout('correlation');
        const sync = (k: number) => {
          const P = stageData(k);
          const s2 = stats2(P);
          const zero = (v: number) => (Math.abs(v) < 5e-4 ? 0 : v);
          f.code.setMany({ c00: fmt(s2.cxx, 3), c01: fmt(zero(s2.cxy), 3), c11: fmt(zero(s2.cyy), 3) });
          corrRo.set(s2.cxx * s2.cyy > 1e-9 ? fmt(zero(s2.cxy / Math.sqrt(s2.cxx * s2.cyy)), 2) : 'n/a (one column)');
          const ln = lines[k];
          f.code.highlight(ln === null ? null : [...(Array.isArray(ln) ? ln : [ln])]);
        };
        f.code.setMany({ m0: fmt(st.mx, 3), m1: fmt(st.my, 3), s0: fmt(E.l1, 3), s1: fmt(E.l2, 3) });
        f.stepper({
          steps: 6,
          interval: 1500,
          label: (k) => `${k + 1} / 6  ${names[k]}`,
          onStep: (k) => {
            stage = k;
            tw.go(stageData(k));
            sync(k);
          },
        });
        f.slider({
          label: 'whitening ε',
          min: -5,
          max: 0,
          step: 0.1,
          value: -5,
          map: (r) => 10 ** r,
          format: (v) => fmt(v, 2),
          slot: 'eps',
          onInput: (v) => {
            eps = v;
            if (stage === 4) {
              tw.go(white(), false);
              sync(4);
            }
          },
        });
      },
      caption: `Step through the pipeline. The cross marks the mean $\\symmu$, the dashed ellipse covers about 95% of the points, and the purple arrows are the eigenvectors of the current covariance, scaled by their spread. Centering slides the cloud to the origin. Normalizing evens out the two axes but leaves the tilt: the features are still correlated. PCA rotates the tilt away (the off-diagonal covariance becomes 0), whitening makes the cloud round (the covariance becomes the identity), and the last step keeps only the long axis. On step 5, raise $\\epsilon$ and watch whitening back off from stretching the thin direction.`,
    });

    p.prose(`Here is the same pipeline on real images. To keep the math fast enough for your browser, each CIFAR-10 image is shrunk to 16 × 16 gray pixels, so every image is a point in a 256-dimensional space. The eigenvectors are then themselves 256 numbers, which means they can be drawn as little images: the *eigen-images* of CIFAR-10.`);

    p.figure({
      title: 'PCA and whitening on CIFAR-10 images',
      codeTitle: 'pca_cifar.py',
      code: `
        X = gray16.reshape(1000, 256)   # 16x16 gray images
        mu = np.mean(X, axis=0)
        X -= mu
        cov = np.dot(X.T, X) / X.shape[0]   # (256, 256)  #@cov
        U, S, V = np.linalg.svd(cov)  # row 2: U[:, :16]  #@cov

        k = {{k:24}}                       # directions kept
        Xrot_reduced = np.dot(X, U[:, :k])  # (1000, k)   #@reduce
        # row 3: rotate back to pixels
        X_back = np.dot(Xrot_reduced, U[:, :k].T) + mu    #@back
        # row 4: whiten first, then rotate back
        Xwhite = Xrot_reduced / np.sqrt(S[:k] + 1e-5)    #@white
        X_white_back = np.dot(Xwhite, U[:, :k].T)        #@white
        # variance kept: {{kept:…}}
      `,
      setup(f) {
        const D = 256;
        let ready = false;
        let k = 24;
        let mu = new Float64Array(D);
        let d: Float64Array = new Float64Array(D);
        let V: Float64Array = new Float64Array(D * D);
        const picks: number[] = [];
        const samples: Float64Array[] = [];
        const tiles = f.canvas(640, 483, (ctx, w, h) => {
          ctx.fillStyle = color('--ink-3');
          ctx.font = ui(12);
          if (!ready) {
            ctx.textAlign = 'center';
            ctx.fillText('loading…', w / 2, h / 2);
            return;
          }
          const gap = 5;
          const head = 19;
          const rows = 5;
          const tile = Math.min((w - 7 * gap) / 8, (h - 4 * head - rows * gap - 4) / rows);
          const left = (w - (8 * tile + 7 * gap)) / 2;
          let y = 0;
          const heading = (s: string) => {
            ctx.fillStyle = color('--ink-2');
            ctx.font = ui(12, 600);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(s, left, y + 13);
            y += head;
          };
          const rowOf = (vals: Float64Array[], stretchEach: boolean) => {
            vals.forEach((v, i) => {
              const [lo, hi] = stretchEach ? minmax(v) : [0, 1];
              grayTile(ctx, v, lo, hi, left + i * (tile + gap), y, tile);
            });
            y += tile + gap;
          };
          heading('1. originals');
          rowOf(samples, false);
          heading('2. top 16 eigen-images (of 256)');
          for (let r = 0; r < 2; r++) {
            const ev: Float64Array[] = [];
            for (let j = r * 8; j < r * 8 + 8; j++) ev.push(Float64Array.from({ length: D }, (_, q) => V[q * D + j]!));
            rowOf(ev, true);
          }
          heading(`3. rebuilt from ${k} number${k === 1 ? '' : 's'} each`);
          rowOf(samples.map((s) => project(s, false)), false);
          heading('4. whitened, rotated back to pixels');
          rowOf(samples.map((s) => project(s, true)), true);
        });
        fitHeight(tiles.canvas, (w) => (5 * (w - 35)) / 8 + 110);
        /** Rotate a sample into the top k eigenvectors and back, optionally whitening in between. */
        function project(s: Float64Array, whiten: boolean): Float64Array {
          const out = new Float64Array(D);
          for (let j = 0; j < k; j++) {
            let c = 0;
            for (let q = 0; q < D; q++) c += (s[q]! - mu[q]!) * V[q * D + j]!;
            if (whiten) c /= Math.sqrt(Math.max(0, d[j]!) + 1e-5);
            for (let q = 0; q < D; q++) out[q]! += c * V[q * D + j]!;
          }
          if (!whiten) for (let q = 0; q < D; q++) out[q]! += mu[q]!;
          return out;
        }
        const keptRo = f.readout('variance kept');
        const syncK = () => {
          if (!ready) return;
          let a = 0, t = 0;
          for (let j = 0; j < D; j++) {
            t += d[j]!;
            if (j < k) a += d[j]!;
          }
          const s = `${(100 * a / t).toFixed(1)}%`;
          keptRo.set(s);
          f.code.set('kept', s);
          tiles.redraw();
        };
        f.slider({
          label: 'directions kept k',
          min: 0,
          max: 8,
          step: 0.05,
          value: Math.log2(24),
          map: (r) => Math.max(1, Math.round(2 ** r)),
          format: (v) => String(v),
          slot: 'k',
          onInput: (v) => {
            k = v;
            f.code.highlight(['reduce', 'back', 'white']);
            syncK();
          },
        });
        f.status('Loading 1,000 CIFAR-10 images…');
        loadCifar()
          .then(({ train }) => {
            f.status('Computing a 256 × 256 covariance and its eigenvectors…');
            setTimeout(() => {
              const n = train.n;
              const X = new Float64Array(n * D);
              for (let i = 0; i < n; i++) {
                const o = i * 3072;
                for (let r = 0; r < 16; r++)
                  for (let c = 0; c < 16; c++) {
                    let g = 0;
                    for (const [dr, dc] of [[0, 0], [0, 1], [1, 0], [1, 1]] as const) {
                      const q = (2 * r + dr) * 32 + 2 * c + dc;
                      g += 0.299 * train.pixels[o + q]! + 0.587 * train.pixels[o + 1024 + q]! + 0.114 * train.pixels[o + 2048 + q]!;
                    }
                    X[i * D + r * 16 + c] = g / (4 * 255);
                  }
              }
              mu = new Float64Array(D);
              for (let i = 0; i < n; i++) for (let q = 0; q < D; q++) mu[q]! += X[i * D + q]! / n;
              const cov = new Float64Array(D * D);
              const row = new Float64Array(D);
              for (let i = 0; i < n; i++) {
                for (let q = 0; q < D; q++) row[q] = X[i * D + q]! - mu[q]!;
                for (let a = 0; a < D; a++) {
                  const ra = row[a]!;
                  if (ra === 0) continue;
                  const base = a * D;
                  for (let b = a; b < D; b++) cov[base + b]! += ra * row[b]!;
                }
              }
              for (let a = 0; a < D; a++)
                for (let b = a; b < D; b++) {
                  cov[a * D + b]! /= n;
                  cov[b * D + a] = cov[a * D + b]!;
                }
              const E = eigSym(cov, D);
              d = E.d;
              V = E.V;
              // fix each eigenvector's sign so its first big entry is positive (stable picture)
              for (let j = 0; j < D; j++) {
                let s = 0;
                for (let q = 0; q < D; q++) s += V[q * D + j]!;
                if (s < 0) for (let q = 0; q < D; q++) V[q * D + j] = -V[q * D + j]!;
              }
              const want = [1, 7, 8, 3, 0, 9, 4, 2];
              for (const c of want) {
                for (let i = 0; i < n; i++) if (train.labels[i] === c && !picks.includes(i)) {
                  picks.push(i);
                  break;
                }
              }
              for (const i of picks) samples.push(X.slice(i * D, i * D + D));
              ready = true;
              f.status(`Images: ${want.map((c) => CIFAR_CLASSES[c]).join(', ')}.`);
              syncK();
            }, 40);
          })
          .catch((e) => f.status(`Could not load CIFAR-10: ${(e as Error).message}`));
      },
      caption: `Row 2 shows the first 16 columns of \`U\` as pictures. They look like smooth blobs and gradients because, in natural images, broad brightness patterns carry most of the variance: the top directions are the *low frequencies*. Row 3 keeps only $k$ coordinates per image and rotates back. At $k = 24$ (under a tenth of the dimensions) about 85% of the variance survives and the images are recognizable, just blurrier. Row 4 whitens those $k$ coordinates first: every direction gets equal weight, so the broad shapes fade and fine detail, edges and noise, are blown up. Slide $k$ all the way to 256 and row 4 turns almost entirely into amplified noise.`,
    });

    p.callout('aside', `**What people actually do with images.** PCA and whitening are explained here because they make the geometry clear, and you will meet them in other parts of machine learning. They are *not* used with convolutional networks. For ConvNets the standard recipe is just zero-centering: subtract the mean image (\`X -= np.mean(X, axis=0)\`, the CS231n assignments do this), or subtract one mean per color channel (VGGNet, for instance, subtracts the average red, green and blue values). Some pipelines also scale pixels into a fixed range like $[-1, 1]$.`, 'In practice');

    p.callout('warning', `Any statistic used for preprocessing (the mean, the standard deviation, the PCA basis) must be computed from the **training set only**, and then applied unchanged to the validation and test sets. Computing the mean over the whole dataset and *then* splitting it leaks information from the test images into training, and your test score stops being an honest estimate.

\`\`\`
mu = np.mean(X_train, axis=0)     # training data only
X_train -= mu
X_val -= mu                       # the SAME mu, not X_val's own mean
X_test -= mu
\`\`\``, 'The classic preprocessing bug');

    // ------------------------------------------------------------------ initialization
    p.h2('Weight initialization', 'init');
    p.prose(`
Before training starts, every weight needs a value. With well-preprocessed data we expect, roughly, that about half the final weights will be positive and half negative. So why not start them all at the reasonable "middle" value, zero?

**All zeros is a trap.** If every weight in a layer is identical, every neuron in that layer computes exactly the same output, receives exactly the same gradient in backpropagation, and makes exactly the same update. They stay clones forever, and a layer of a hundred neurons behaves like one neuron. The same goes for any constant: the problem is the *symmetry*, not the zero.

**Small random numbers** break the symmetry. Draw each weight from a Gaussian with mean zero and a small standard deviation, for example \`W = 0.01 * np.random.randn(D, H)\`, and every neuron starts out a little different, so they all learn different things. This works for small networks. For deep ones, though, "small" turns out to be a dangerous word, and to see why we need to know how the size of a neuron's output depends on the size of its weights.`);

    p.callout('math', `The **expected value** $E[\\cdot]$ of a random quantity is its long-run average: draw it many times and average the draws. $\\mathrm{Var}(\\cdot)$ is the expected squared distance from that average. Three facts do all the work below: variances of *independent* quantities add up; scaling a quantity by $a$ scales its variance by $a^2$; and for two independent quantities with mean zero, the variance of their product is the product of their variances.`, 'Math help: expected value and variance');

    p.math({
      label: 'How a neuron scales the spread of its inputs',
      tex: String.raw`\begin{aligned}\mathrm{Var}(s) &= \mathrm{Var}\Big(\sum_{i=1}^{n} \symW_i\,\symx_i\Big) \\ &= \sum_{i=1}^{n}\mathrm{Var}(\symW_i)\,\mathrm{Var}(\symx_i) \\ &= n\,\mathrm{Var}(\symW)\,\mathrm{Var}(\symx)\end{aligned}`,
      code: `
        n = 100                          # inputs per neuron
        x = np.random.randn(100000, n)   # Var(x) = 1
        w = np.random.randn(n) * 0.01    # Var(w) = 0.0001
        s = x.dot(w)                     # 100,000 outputs
        print(s.var())          # about n * 0.0001 = 0.01

        w = np.random.randn(n) / np.sqrt(n)   # Var(w) = 1/n
        print(x.dot(w).var())   # about 1.0: spread kept
      `,
      codeTitle: 'variance_check.py',
      terms: [
        [String.raw`s = \sum \symW_i\symx_i`, 'one neuron before its nonlinearity: $n$ inputs, each times its weight, all added up'],
        [String.raw`\sum \mathrm{Var}(\cdot)`, 'the $n$ terms are independent, so the variance of their sum is the sum of their variances'],
        [String.raw`\mathrm{Var}(\symW_i)\mathrm{Var}(\symx_i)`, 'the variance of one term $\\symW_i \\symx_i$: with weights and inputs both centered on zero, a product\'s variance is the product of the variances'],
        [String.raw`n\,\mathrm{Var}(\symW)\,\mathrm{Var}(\symx)`, 'all $n$ terms look alike, so the sum is $n$ copies of the same thing'],
      ],
      explain: `The output's spread is the input's spread multiplied by $n\\,\\mathrm{Var}(\\symW)$. If that factor is 0.01, as with \`0.01 * randn\` and 100 inputs, each layer shrinks the signal's variance a hundredfold; after ten layers almost nothing is left. If the factor is bigger than one, the signal grows layer after layer. The fix is to make the factor exactly one: choose $\\mathrm{Var}(\\symW) = 1/n$, which (since scaling by $a$ scales variance by $a^2$) means drawing \`randn\` and dividing by $\\sqrt{n}$.`,
    });

    p.math({
      label: 'Three calibrated initializations',
      tex: String.raw`\begin{aligned}\mathrm{Var}_{\text{Xavier}}(\symW) &= 1 / n_{\text{in}} \\ \mathrm{Var}_{\text{Glorot}}(\symW) &= 2 / (n_{\text{in}} + n_{\text{out}}) \\ \mathrm{Var}_{\text{He}}(\symW) &= 2 / n_{\text{in}}\end{aligned}`,
      code: `
        shape = (fan_in, fan_out)
        # Xavier: Var(W) = 1 / fan_in
        W = np.random.randn(*shape) / np.sqrt(fan_in)
        # Glorot and Bengio: Var(W) = 2 / (fan_in + fan_out)
        W = np.random.randn(*shape) * np.sqrt(
            2.0 / (fan_in + fan_out))
        # He et al., for ReLU: Var(W) = 2 / fan_in
        W = np.random.randn(*shape) * np.sqrt(2.0 / fan_in)
      `,
      codeTitle: 'init.py',
      terms: [
        [String.raw`n_{\text{in}}`, 'the *fan-in*: how many inputs feed each neuron (`fan_in` in code)'],
        [String.raw`n_{\text{out}}`, 'the *fan-out*: how many neurons the layer has, which matters for the backward pass'],
        [String.raw`\mathrm{Var}_{\text{Xavier}}`, 'the variance that keeps $n\\,\\mathrm{Var}(\\symW) = 1$, from the derivation above'],
        [String.raw`\mathrm{Var}_{\text{Glorot}}`, 'Glorot and Bengio\'s compromise between fan-in and fan-out, which keeps both the forward signal and the backward gradients at a steady size'],
        [String.raw`\mathrm{Var}_{\text{He}}`, 'twice the Xavier variance, for ReLU units (He et al.), because a ReLU throws away the negative half of its inputs'],
      ],
      explain: 'Glorot and Bengio (2010) analyzed the forward and backward passes together and proposed the middle formula; its simple fan-in-only cousin is widely called *Xavier* initialization (after Xavier Glorot). He, Zhang, Ren and Sun (2015) redid the analysis for ReLU units: a ReLU outputs zero for half of its inputs, which halves the variance it passes on, so doubling the weight variance makes up for it. For ReLU networks, `np.sqrt(2.0 / fan_in)` is the recommendation in the CS231n notes and the default in most code today.',
    });

    p.prose(`The lecture made this concrete with an experiment you can now run yourself: push random data through a 10-layer network and look at the activations at every layer. Try the four presets in order, with tanh first.`);

    p.figure({
      title: 'Activations through 10 layers, for different initializations',
      codeTitle: 'activation_stats.py',
      code: `
        D = np.random.randn(200, 100)   # 200 examples
        hidden_layer_sizes = [100] * 10
        act = {'relu': lambda x: np.maximum(0, x),
               'tanh': lambda x: np.tanh(x)}
        Hs = {}
        for i in range(len(hidden_layer_sizes)):
            X = D if i == 0 else Hs[i - 1]             #@loop
            fan_in = X.shape[1]
            fan_out = hidden_layer_sizes[i]
            W = np.random.randn(fan_in, fan_out) * {{scale:0.01}}  #@init
            H = np.dot(X, W)          # pre-activations  #@fwd
            Hs[i] = act['{{act:tanh}}'](H)                #@act
        # layer 10: mean {{mean}}, std {{std}}
      `,
      setup(f) {
        const B = 200, U = 100, NL = 10;
        let seed = 3;
        let D = new Float64Array(B * U);
        let Z: Float64Array[] = [];
        const draw = () => {
          const r = new Rng(seed);
          D = new Float64Array(B * U).map(() => r.randn());
          Z = Array.from({ length: NL }, () => new Float64Array(U * U).map(() => r.randn()));
        };
        draw();
        let act: 'tanh' | 'relu' = 'tanh';
        let scale = 0.01;
        let preset = 'small';
        let H: Float64Array[] = [];
        let sds: number[] = [];
        let means: number[] = [];
        const compute = () => {
          H = [];
          sds = [];
          means = [];
          let X = D;
          for (let l = 0; l < NL; l++) {
            const W = Z[l]!;
            const out = new Float64Array(B * U);
            for (let i = 0; i < B; i++) {
              const xo = i * U;
              for (let k = 0; k < U; k++) {
                const xk = X[xo + k]! * scale;
                if (xk === 0) continue;
                const wo = k * U;
                for (let j = 0; j < U; j++) out[xo + j]! += xk * W[wo + j]!;
              }
            }
            let s = 0, s2 = 0;
            for (let i = 0; i < out.length; i++) {
              const v = act === 'tanh' ? Math.tanh(out[i]!) : out[i]! > 0 ? out[i]! : 0;
              out[i] = v;
              s += v;
            }
            const m = s / out.length;
            for (let i = 0; i < out.length; i++) s2 += (out[i]! - m) ** 2;
            means.push(m);
            sds.push(Math.sqrt(s2 / out.length));
            H.push(out);
            X = out;
          }
          f.code.setMany({ mean: fmt(means[NL - 1]!, 2), std: fmt(sds[NL - 1]!, 2) });
          lastRo.set(fmt(sds[NL - 1]!, 2));
        };
        const chart = f.plot({
          height: 176,
          square: false,
          domain: [-1.0, 10.5, -13.5, 13.5],
          draw: (pl) => {
            const c = pl.ctx;
            // healthy band: std between 0.1 and 10
            c.fillStyle = withAlpha(color('green'), 0.12);
            c.fillRect(pl.sx(0.5), pl.sy(1), pl.w, pl.sy(-1) - pl.sy(1));
            c.strokeStyle = color('--grid');
            c.lineWidth = 1;
            for (const v of [-10, -5, 0, 5, 10]) {
              c.beginPath();
              c.moveTo(pl.sx(0.5), Math.round(pl.sy(v)) + 0.5);
              c.lineTo(pl.w, Math.round(pl.sy(v)) + 0.5);
              c.stroke();
              pl.text(v === 0 ? '1' : `1e${v}`, 0.3, v, { size: 11, mono: true, align: 'right', base: 'middle', color: color('--ink-3') });
            }
            for (let l = 1; l <= NL; l++) pl.text(String(l), l, -12.2, { size: 11, mono: true, align: 'center', base: 'middle', color: color('--ink-3') });
            const ys = sds.map((s) => Math.max(-11, Math.min(11, Math.log10(Math.max(s, 1e-300)))));
            pl.path(ys.map((_, i) => i + 1), ys, color('orange'), 2.2);
            ys.forEach((y, i) => pl.dot(i + 1, y, 3.5, color('orange')));
            pl.text('std of each layer\'s activations (log scale)', 10.45, 12, { size: 11, align: 'right', base: 'middle', color: color('--ink-2') });
          },
        });
        const hist = f.canvas(640, 250, (ctx, w, h) => {
          const cols = 5, rows = 2, gx = 8, gy = 10;
          const pw = (w - gx * (cols - 1)) / cols;
          const ph = (h - gy * (rows - 1)) / rows;
          const nb = 25;
          const lo = act === 'tanh' ? -1 : 0;
          const hi = act === 'tanh' ? 1 : 4;
          for (let l = 0; l < NL; l++) {
            const px = (l % cols) * (pw + gx);
            const py = Math.floor(l / cols) * (ph + gy);
            ctx.fillStyle = color('--paper');
            ctx.strokeStyle = color('--rule');
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(px + 0.5, py + 0.5, pw - 1, ph - 1, 6);
            ctx.fill();
            ctx.stroke();
            const top = py + 18, bot = py + ph - 16, ix0 = px + 6, ix1 = px + pw - 6;
            ctx.fillStyle = color('--ink-2');
            ctx.font = ui(11, 600);
            ctx.textAlign = 'left';
            ctx.fillText(`layer ${l + 1}`, px + 6, py + 13);
            ctx.font = mono(10.5);
            ctx.fillStyle = color('--ink-3');
            ctx.fillText(String(lo), ix0, py + ph - 4);
            ctx.textAlign = 'right';
            ctx.fillText(act === 'relu' ? '4+' : String(hi), ix1, py + ph - 4);
            const a = H[l];
            if (!a) continue;
            const bins = new Float64Array(nb);
            let zeros = 0, over = 0;
            for (let i = 0; i < a.length; i++) {
              const v = a[i]!;
              if (act === 'relu' && v === 0) {
                zeros++;
                continue;
              }
              if (act === 'relu' && v >= hi) {
                over++;
                continue;
              }
              const bi = Math.min(nb - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo)) * nb)));
              bins[bi]!++;
            }
            // one shared scale for the bins and the overflow bar (values beyond the right edge)
            const mx = Math.max(1, over, ...bins);
            const bw = (ix1 - ix0) / (nb + (act === 'relu' ? 1.5 : 0));
            ctx.fillStyle = withAlpha(color('orange'), 0.85);
            for (let b = 0; b < nb; b++) {
              const hh = ((bot - top) * bins[b]!) / mx;
              if (hh > 0) ctx.fillRect(ix0 + b * bw + 0.5, bot - Math.max(1, hh), Math.max(1, bw - 1), Math.max(1, hh));
            }
            if (act === 'relu' && over > 0) {
              const hh = ((bot - top) * over) / mx;
              ctx.fillStyle = withAlpha(color('red'), 0.85);
              ctx.fillRect(ix1 - bw, bot - Math.max(1, hh), bw, Math.max(1, hh));
            }
            ctx.strokeStyle = color('--axis');
            ctx.beginPath();
            ctx.moveTo(ix0, bot + 0.5);
            ctx.lineTo(ix1, bot + 0.5);
            ctx.stroke();
            if (act === 'relu' && zeros > 0) {
              ctx.fillStyle = withAlpha(color('slate'), 0.75);
              ctx.fillRect(ix0 - 1, top, 3, bot - top);
            }
          }
        });
        const lastRo = f.readout('layer 10 std');
        let pendingHl: string | null = null;
        const refresh = (hl: string) => {
          // recompute at most once per frame while a slider is dragged
          if (pendingHl === null) requestAnimationFrame(() => {
            compute();
            f.code.highlight(pendingHl);
            pendingHl = null;
            chart.redraw();
            hist.redraw();
          });
          pendingHl = hl;
        };
        const presetExpr: Record<string, string> = { small: '0.01', xavier: '1 / np.sqrt(fan_in)', large: '1.0', he: 'np.sqrt(2 / fan_in)' };
        const presetVal: Record<string, number> = { small: 0.01, xavier: 1 / Math.sqrt(U), large: 1, he: Math.sqrt(2 / U) };
        f.segmented({
          label: 'nonlinearity',
          options: [
            { value: 'tanh', label: 'tanh' },
            { value: 'relu', label: 'ReLU' },
          ],
          value: 'tanh',
          slot: 'act',
          onChange: (v) => {
            act = v as 'tanh' | 'relu';
            refresh('act');
          },
        });
        const seg = f.segmented({
          label: 'init',
          options: [
            { value: 'small', label: '0.01' },
            { value: 'xavier', label: 'Xavier' },
            { value: 'large', label: '1.0' },
            { value: 'he', label: 'He' },
          ],
          value: 'small',
          onChange: (v) => {
            preset = v;
            scale = presetVal[v]!;
            sl.set(Math.log10(scale), false);
            f.code.set('scale', presetExpr[v]!);
            refresh('init');
          },
        });
        const sl = f.slider({
          label: 'weight std',
          sym: 'W',
          min: -3,
          max: 0.3,
          step: 0.01,
          value: -2,
          map: (r) => 10 ** r,
          format: (v) => fmt(v, 2),
          onInput: (v) => {
            scale = v;
            preset = 'custom';
            seg.set('custom' as never, false);
            f.code.set('scale', fmt(v, 3));
            refresh('init');
          },
        });
        f.button('New random weights', () => {
          seed++;
          draw();
          refresh('init');
        }, { icon: 'shuffle' });
        f.code.set('scale', presetExpr[preset]!);
        compute();
      },
      caption: `The orange line tracks the spread (standard deviation) of each layer's activations on a log scale; the green band is a healthy range. Each small panel is a histogram of one layer's 20,000 activations. With **tanh and 0.01**, the spread shrinks tenfold per layer and by layer 10 every activation is essentially 0: the gradients for the weights, which are proportional to these activations, vanish too. With **1.0**, the neurons saturate and pile up at $-1$ and $+1$, where tanh is flat and its gradient is 0. **Xavier** keeps a usable spread all the way down. Now switch to **ReLU**: Xavier slowly starves the deep layers (each one halves the variance) and **He** fixes it. The slate bar at 0 is the half of ReLU outputs that are exactly zero, and a red bar at the right edge counts values beyond 4. (The lecture used 500 units per layer; 100 keeps this fast and tells the same story.)`,
    });

    p.prose(`
### Other choices

**Sparse initialization** is an alternative way to break symmetry: set every weight to zero, except that each neuron is connected to a small random set of the neurons below it (a typical number is 10), with those few weights drawn from a small Gaussian.

**Biases** are usually just initialized to zero. The weights already break the symmetry, so there is nothing for random biases to do. With ReLU some people prefer a small constant like 0.01, so that every unit starts out active and passes gradient. It is not clear that this helps consistently (it seems to hurt in some cases), and zero remains the more common choice.

**In practice**, the CS231n notes recommend ReLU units with \`w = np.random.randn(n) * np.sqrt(2.0 / n)\`, and biases at zero.`);

    // ------------------------------------------------------------------ batch norm
    p.h2('Batch normalization', 'batchnorm');
    p.prose(`
Careful initialization gets the activations to a good scale at the *start* of training. But the weights change with every update, and the spread of each layer's activations drifts with them. **Batch normalization** (Ioffe and Szegedy, 2015) takes the idea of "keep every layer's inputs roughly unit Gaussian" and simply enforces it, at every layer, at every training step.

The observation that makes this possible is that normalizing is a simple, differentiable operation. So we can insert a **BatchNorm layer** into the network that, for each feature, subtracts the mini-batch's mean and divides by its standard deviation, and backpropagate through it like any other layer.`);

    p.math({
      label: 'Batch normalization, training time',
      tex: String.raw`\begin{aligned}\symmu_B &= \frac{1}{m}\sum_{i=1}^{m}\symx_i \\ \sigma_B^2 &= \frac{1}{m}\sum_{i=1}^{m}(\symx_i - \symmu_B)^2 \\ \hat{\symx}_i &= \frac{\symx_i - \symmu_B}{\sqrt{\sigma_B^2 + \epsilon}} \\ y_i &= \symgamma\,\hat{\symx}_i + \symbeta\end{aligned}`,
      code: `
        # x: (N, D) mini-batch, one column per feature
        mu = x.mean(axis=0)      # (D,) mean of each feature
        var = x.var(axis=0)      # (D,) variance of each
        x_hat = (x - mu) / np.sqrt(var + eps)  # mean 0, var 1
        out = gamma * x_hat + beta   # learned scale, shift
      `,
      codeTitle: 'batchnorm_forward.py',
      terms: [
        [String.raw`\symx_i`, 'one example\'s value of one feature, out of a mini-batch of $m$ examples'],
        [String.raw`\symmu_B,\ \sigma_B^2`, 'the mean and variance of that feature *over this mini-batch*'],
        [String.raw`\hat{\symx}_i`, 'the normalized value: zero mean and unit variance across the batch. $\\epsilon$ (e.g. $10^{-5}$) avoids dividing by zero'],
        [String.raw`\symgamma,\ \symbeta`, 'two learned parameters per feature that rescale and shift the result'],
      ],
      explain: `Every feature is normalized *separately*, over the batch dimension: this is like the zero-centering and normalizing from the start of the chapter, redone inside the network on every mini-batch. Unlike whitening, nothing is decorrelated. The last step may look like it undoes the first: if the network learns $\\symgamma = \\sqrt{\\sigma^2_B}$ and $\\symbeta = \\symmu_B$, it gets its original values back. That is the point. Normalization is the default, but the network keeps the freedom to choose a different scale and offset if that helps the next layer.`,
    });

    p.prose(`BatchNorm is usually inserted right after a fully connected (or convolutional) layer and right before the nonlinearity. The figure shows why that spot matters: what the nonlinearity receives decides whether its gradient is alive.`);

    p.figure({
      title: 'Batch normalization on one mini-batch',
      codeTitle: 'batchnorm.py',
      code: `
        # x: a mini-batch of pre-activations, (64, 2)
        mu = x.mean(axis=0)                       #@mean
        var = x.var(axis=0)                       #@mean
        x_hat = (x - mu) / np.sqrt(var + eps)     #@norm
        out = gamma * x_hat + beta   # -> tanh    #@scale
        # mu = [{{mu0}}, {{mu1}}]  std = [{{sd0}}, {{sd1}}]
        # gamma = [{{g:1}}, 1]  beta = [{{b:0}}, 0]

        # each training step also keeps running averages:
        running_mean = 0.9 * running_mean + 0.1 * mu   #@run
        running_var = 0.9 * running_var + 0.1 * var    #@run
        # running_mean = [{{rm0:0}}, {{rm1:0}}]
        # test time: use them instead of mu and var
        x_hat = (x - running_mean) / np.sqrt(running_var + eps)  #@test
      `,
      setup(f) {
        const N = 64;
        const rng = new Rng(8);
        const pop = { m: [2.6, -0.9], s: [1.6, 0.6], rho: 0.55 };
        const sample = () => {
          const P = new Float64Array(N * 2);
          for (let i = 0; i < N; i++) {
            const a = rng.randn(), b = rng.randn();
            P[2 * i] = pop.m[0]! + pop.s[0]! * a;
            P[2 * i + 1] = pop.m[1]! + pop.s[1]! * (pop.rho * a + Math.sqrt(1 - pop.rho ** 2) * b);
          }
          return P;
        };
        let batch = sample();
        let gamma = 1, beta = 0;
        let stage = 0;
        let useRunning = false;
        const rm = [0, 0], rv = [1, 1];
        let seen = 0;
        const eps = 1e-5;
        const batchStats = () => {
          const s = stats2(batch);
          return { m: [s.mx, s.my], v: [s.cxx, s.cyy] };
        };
        const stageData = (k: number) => {
          const bs = batchStats();
          const m = useRunning ? rm : bs.m;
          const v = useRunning ? rv : bs.v;
          const out = new Float64Array(N * 2);
          for (let i = 0; i < N; i++) {
            for (let j = 0; j < 2; j++) {
              const x = batch[2 * i + j]!;
              let y = x;
              if (k >= 1) y = x - m[j]!;
              if (k >= 2) y /= Math.sqrt(v[j]! + eps);
              if (k >= 3) y = j === 0 ? gamma * y + beta : y;
              out[2 * i + j] = y;
            }
          }
          return out;
        };
        const names = ['raw pre-activations', 'minus the mean', 'divided by the std', 'scaled by γ, shifted by β'];
        const pl = f.plot({
          aspect: 1.55,
          domain: [-4.6, 7.6, -3.6, 3.6],
          draw: (pp) => {
            pp.axes({ grid: 1, labels: true });
            const P = tw.cur;
            for (let i = 0; i < N; i++) pp.dot(P[2 * i]!, P[2 * i + 1]!, 3.4, withAlpha(color('orange'), 0.7));
            drawCov(pp, P, 2, false);
            if (useRunning && stage > 0 && stage < 3) pp.text('using running averages', pp.view()[1] - 0.15, pp.view()[2] + 0.3, { size: 12, bold: true, align: 'right', color: color('--ink-2') });
            pp.text('feature 1 →', pp.view()[1] - 0.15, 0.18, { size: 11, align: 'right', color: color('--ink-3') });
            pp.text('↑ feature 2', 0.15, pp.view()[3] - 0.5, { size: 11, color: color('--ink-3') });
          },
        });
        const tanhPl = f.plot({
          height: 104,
          square: false,
          domain: [-4.6, 7.6, -1.35, 1.35],
          draw: (pp) => {
            const c = pp.ctx;
            c.fillStyle = withAlpha(color('red'), 0.08);
            c.fillRect(0, 0, pp.sx(-2), pp.h);
            c.fillRect(pp.sx(2), 0, pp.w - pp.sx(2), pp.h);
            pp.axes({ grid: 1 });
            pp.fn((x) => Math.tanh(x), color('--ink-2'), 2);
            const P = tw.cur;
            for (let i = 0; i < N; i++) {
              const v = P[2 * i]!;
              pp.dot(v, Math.tanh(v), 3.2, withAlpha(color('orange'), 0.75));
            }
            pp.text('what tanh receives (feature 1)', pp.view()[1] - 0.15, -0.55, { size: 11, align: 'right', color: color('--ink-2') });
            pp.text('shaded: flat, gradient ≈ 0', pp.view()[1] - 0.15, -0.95, { size: 11, align: 'right', color: color('--ink-3') });
          },
        });
        const tw = new Tween(f, batch, () => {
          pl.redraw();
          tanhPl.redraw();
        });
        const satRo = f.readout('saturated');
        const seenRo = f.readout('batches seen');
        const sync = (animate = true) => {
          const target = stageData(stage);
          tw.go(target, animate);
          let sat = 0;
          for (let i = 0; i < N; i++) if (Math.abs(target[2 * i]!) > 2) sat++;
          satRo.set(`${Math.round((100 * sat) / N)}%`);
          seenRo.set(seen);
          const bs = batchStats();
          f.code.setMany({
            mu0: fmt(bs.m[0]!, 2), mu1: fmt(bs.m[1]!, 2),
            sd0: fmt(Math.sqrt(bs.v[0]!), 2), sd1: fmt(Math.sqrt(bs.v[1]!), 2),
            g: fmt(gamma, 2), b: fmt(beta, 2),
            rm0: fmt(rm[0]!, 2), rm1: fmt(rm[1]!, 2),
          });
          const hl = ['', 'mean', 'norm', 'scale'][stage]!;
          f.code.highlight(hl ? (useRunning && (stage === 1 || stage === 2) ? 'test' : hl) : null);
        };
        f.stepper({
          steps: 4,
          interval: 1600,
          label: (k) => `${k + 1} / 4  ${names[k]}`,
          onStep: (k) => {
            stage = k;
            sync();
          },
        });
        const gs = f.slider({ label: 'γ (feature 1)', sym: 'gamma', min: 0, max: 3, step: 0.01, value: 1, onInput: (v) => { gamma = v; if (stage === 3) sync(false); else f.code.set('g', fmt(v, 2)); } });
        const bsl = f.slider({ label: 'β (feature 1)', sym: 'beta', min: -3, max: 4, step: 0.01, value: 0, onInput: (v) => { beta = v; if (stage === 3) sync(false); else f.code.set('b', fmt(v, 2)); } });
        f.segmented({
          label: 'normalize with',
          options: [
            { value: 'batch', label: 'batch (train)' },
            { value: 'running', label: 'running (test)' },
          ],
          value: 'batch',
          onChange: (v) => {
            useRunning = v === 'running';
            sync();
          },
        });
        f.button('Next batch', () => {
          batch = sample();
          const bs = batchStats();
          for (let j = 0; j < 2; j++) {
            rm[j] = 0.9 * rm[j]! + 0.1 * bs.m[j]!;
            rv[j] = 0.9 * rv[j]! + 0.1 * bs.v[j]!;
          }
          seen++;
          f.code.highlight('run', 'alt');
          sync();
        }, { primary: true });
        f.button('Undo BN: γ = σ, β = μ', () => {
          const bs = batchStats();
          gs.set(Math.sqrt(bs.v[0]!), false);
          bsl.set(bs.m[0]!, false);
          gamma = Math.sqrt(bs.v[0]!);
          beta = bs.m[0]!;
          stage = 3;
          sync();
        });
      },
      caption: `A mini-batch of 64 examples with two features, before the nonlinearity. Step through: the batch is centered, then each feature is divided by its own spread (the cloud stays tilted, because BatchNorm normalizes features separately and does not decorrelate them). The lower panel shows what tanh receives for feature 1: raw, most values sit in the flat, saturated region; after normalization almost none do. On the last step, play with $\\symgamma$ and $\\symbeta$, or press **Undo BN** to see the network recover the raw values exactly. Then switch to **running averages** (what the layer uses at test time): they start at mean 0, variance 1 and only become accurate after many **Next batch** presses.`,
    });

    p.prose(`
### Test time and why it helps

At test time there may be only one example, so there is no batch to compute a mean over, and in any case we want the prediction for an image to not depend on which other images happen to share its batch. So during training each BatchNorm layer keeps **running averages** of the means and variances it has seen (the last lines of the code above), and at test time it normalizes with those fixed numbers instead. Assignment 2 has you implement both modes, plus the backward pass.

What BatchNorm buys, as the 2016 lecture summarized it:

- **Better gradient flow** through the network, because activations stay out of the saturated regions.
- **Much less sensitivity to initialization.** Networks with BatchNorm are far more forgiving of a poor weight scale.
- **Higher learning rates** become usable, so training is faster.
- **A mild regularizing effect.** Each example's output depends a little on which other examples share its mini-batch, a kind of noise that slightly discourages memorizing; it can somewhat reduce the need for dropout.`);

    // ------------------------------------------------------------------ regularization
    p.h2('Regularization', 'regularization');
    p.prose(`
A big network can do more than learn the pattern in its training data; it can memorize the training data, noise and all, and then do worse on anything new. This is *overfitting*. **Regularization** is the family of techniques that discourage it. Chapter 4 introduced the first one; here is the full set the course covers.`);

    p.math({
      label: 'Weight penalties: L2, L1, elastic net',
      tex: String.raw`\begin{aligned}R_{L2} &= \tfrac{1}{2}\symlam\sum_k \symW_k^2 \\ R_{L1} &= \symlam\sum_k |\symW_k| \\ R_{\text{EN}} &= \lambda_1\sum_k|\symW_k| + \lambda_2\sum_k \symW_k^2\end{aligned}`,
      code: `
        # L2
        loss = data_loss + 0.5 * reg * np.sum(W * W)
        dW += reg * W            # its gradient

        # L1
        loss = data_loss + reg * np.sum(np.abs(W))
        dW += reg * np.sign(W)   # its (sub)gradient
      `,
      codeTitle: 'penalties.py',
      terms: [
        [String.raw`\tfrac{1}{2}\symlam\sum \symW_k^2`, 'L2: add up every squared weight. The $\\frac12$ is a convenience: the slope of $\\frac12 w^2$ is just $w$, so the gradient is $\\symlam \\symW$ with no stray 2'],
        [String.raw`\symlam\sum|\symW_k|`, 'L1: add up the absolute values (the sizes, ignoring sign)'],
        [String.raw`\lambda_1, \lambda_2`, 'elastic net mixes both, with a separate strength for each'],
      ],
      explain: `**L2** hates big weights much more than small ones (doubling a weight quadruples its penalty), so it pushes the network to spread its reliance over many inputs with modest weights. In gradient descent its effect is that every weight shrinks a little toward zero at every step, \`W += -learning_rate * reg * W\`, which is why L2 is also called **weight decay**. **L1** charges the same per unit of weight no matter how big the weight is. That constant pull drives unhelpful weights all the way to exactly zero, so neurons end up using a *sparse* subset of their inputs and ignore the noisy ones. Unless you specifically want that kind of feature selection, L2 usually performs better.`,
    });

    p.math({
      label: 'Max-norm constraint',
      tex: String.raw`\|\vec{\symW}\|_2 = \sqrt{\sum_k \symW_k^2} \;\le\; c`,
      code: `
        W -= learning_rate * dW    # normal update, then
        # each column = one neuron's incoming weights
        norms = np.linalg.norm(W, axis=0, keepdims=True)
        W *= np.minimum(1.0, c / norms)   # clip to length c
      `,
      codeTitle: 'max_norm.py',
      terms: [
        [String.raw`\vec{\symW}`, 'the incoming weights of one neuron (here one column of `W`)'],
        [String.raw`\|\vec{\symW}\|_2`, 'its length: the square root of the sum of squares (Pythagoras in many dimensions)'],
        [String.raw`c`, 'the allowed maximum; typical values are around 3 or 4'],
      ],
      explain: 'Instead of a penalty, a hard limit. Update normally; then, if any neuron\'s weight vector has grown longer than $c$, scale it back down to length $c$. This is called *projected* gradient descent. Even with a learning rate that is too high, the weights cannot blow up, because every update ends inside the limit.',
    });

    p.figure({
      title: 'L2, L1, elastic net and max-norm, side by side',
      codeTitle: 'regularize.py',
      code: `
        # w_star: the best fit with no regularization
        d = w - w_star
        data_loss = 0.5 * d.dot(A).dot(d)  # ellipses  #@data
        reg_loss = 0.5 * reg * np.sum(w * w)    # L2   #@l2
        reg_loss = reg * np.sum(np.abs(w))      # L1   #@l1
        reg_loss = reg * (0.5 * np.sum(np.abs(w))      #@en
                          + 0.25 * np.sum(w * w))      #@en
        loss = data_loss + reg_loss   # minimize       #@sum
        # max-norm: minimize data_loss alone, but     #@mn
        # clip after each step to length c            #@mn
        w *= min(1, c / np.linalg.norm(w))             #@mn

        # {{regline:reg = 0.13}}
        # best w = [{{w0}}, {{w1}}]
      `,
      setup(f) {
        // 2-D problem: data loss = 0.5 (w - ws)^T A (w - ws)
        const A = [1.0, 0.35, 0.35, 0.7];
        const ws = [1.45, 0.62];
        type Kind = 'l2' | 'l1' | 'en' | 'mn';
        let kind: Kind = 'l2';
        let lam = 0.3;
        let c = 1;
        const grad2 = (w: number[]) => [A[0]! * (w[0]! - ws[0]!) + A[1]! * (w[1]! - ws[1]!), A[2]! * (w[0]! - ws[0]!) + A[3]! * (w[1]! - ws[1]!)];
        const soft = (v: number, t: number) => Math.sign(v) * Math.max(0, Math.abs(v) - t);
        const solve2 = (k: Kind, l: number, cc: number, start = ws): number[] => {
          if (k === 'l2') {
            const M = new Float64Array([A[0]! + l, A[1]!, A[2]!, A[3]! + l]);
            const rhs = new Float64Array([A[0]! * ws[0]! + A[1]! * ws[1]!, A[2]! * ws[0]! + A[3]! * ws[1]!]);
            return Array.from(solve(M, rhs, 2));
          }
          let w = [...start];
          const l1 = k === 'l1' ? l : k === 'en' ? 0.5 * l : 0;
          const l2 = k === 'en' ? 0.5 * l : 0;
          const t = 1 / (1.25 + l2);
          for (let it = 0; it < 3000; it++) {
            const g = grad2(w);
            w = [w[0]! - t * (g[0]! + l2 * w[0]!), w[1]! - t * (g[1]! + l2 * w[1]!)];
            if (k === 'mn') {
              const nr = Math.hypot(w[0]!, w[1]!);
              if (nr > cc) w = [(w[0]! * cc) / nr, (w[1]! * cc) / nr];
            } else w = [soft(w[0]!, t * l1), soft(w[1]!, t * l1)];
          }
          return w;
        };
        // Path of solutions as the strength varies
        const pathOf = (k: Kind) => {
          const pts: number[][] = [ws];
          let prev = ws;
          if (k === 'mn') {
            for (let i = 0; i <= 60; i++) {
              const cc = 1.7 * (1 - i / 60);
              prev = solve2(k, 0, cc, prev);
              pts.push(prev);
            }
          } else {
            for (let i = 0; i <= 60; i++) {
              const l = 10 ** (-3 + (i / 60) * 4);
              prev = solve2(k, l, 0, prev);
              pts.push(prev);
            }
          }
          return pts;
        };
        const paths: Record<Kind, number[][]> = { l2: pathOf('l2'), l1: pathOf('l1'), en: pathOf('en'), mn: pathOf('mn') };
        let wsol = solve2('l2', lam, c);

        // 16-weight linear regression with 3 useful inputs
        const ND = 16, NS = 60;
        const r = new Rng(31);
        const Xb = new Float64Array(NS * ND).map(() => r.randn());
        const wtrue = new Float64Array(ND);
        wtrue[0] = 1.6; wtrue[3] = -1.1; wtrue[9] = 0.7;
        const yb = new Float64Array(NS);
        for (let i = 0; i < NS; i++) {
          let s = 0;
          for (let j = 0; j < ND; j++) s += Xb[i * ND + j]! * wtrue[j]!;
          yb[i] = s + 0.6 * r.randn();
        }
        const XtX = new Float64Array(ND * ND), Xty = new Float64Array(ND);
        for (let i = 0; i < NS; i++)
          for (let a = 0; a < ND; a++) {
            Xty[a]! += (Xb[i * ND + a]! * yb[i]!) / NS;
            for (let b = 0; b < ND; b++) XtX[a * ND + b]! += (Xb[i * ND + a]! * Xb[i * ND + b]!) / NS;
          }
        const solveBars = (k: Kind, l: number, cc: number): Float64Array => {
          if (k === 'l2') {
            const M = Float64Array.from(XtX);
            for (let a = 0; a < ND; a++) M[a * ND + a]! += l;
            return solve(M, Xty, ND);
          }
          const w = new Float64Array(ND);
          if (k === 'mn') {
            const t = 0.3;
            for (let it = 0; it < 600; it++) {
              const g = new Float64Array(ND);
              for (let a = 0; a < ND; a++) {
                let s = -Xty[a]!;
                for (let b = 0; b < ND; b++) s += XtX[a * ND + b]! * w[b]!;
                g[a] = s;
              }
              let nr = 0;
              for (let a = 0; a < ND; a++) {
                w[a]! -= t * g[a]!;
                nr += w[a]! ** 2;
              }
              nr = Math.sqrt(nr);
              if (nr > cc) for (let a = 0; a < ND; a++) w[a]! *= cc / nr;
            }
            return w;
          }
          const l1 = k === 'l1' ? l : 0.5 * l;
          const l2 = k === 'en' ? 0.5 * l : 0;
          for (let sweep = 0; sweep < 200; sweep++) {
            for (let j = 0; j < ND; j++) {
              let rho = Xty[j]!;
              for (let b = 0; b < ND; b++) if (b !== j) rho -= XtX[j * ND + b]! * w[b]!;
              w[j] = soft(rho, l1) / (XtX[j * ND + j]! + l2);
            }
          }
          return w;
        };
        let bars = solveBars('l2', lam, c);

        const pl = f.plot({
          aspect: 1.25,
          domain: [-0.55, 1.95, -0.5, 1.25],
          draw: (pp) => {
            pp.axes({ grid: 0.5, labels: true });
            const ctx = pp.ctx;
            // data-loss ellipses: 0.5 d^T A d = level
            const E = eig2(A[0]!, A[1]!, A[3]!);
            const ell = (lev: number, stroke: string, wdt: number, dash?: number[]) => {
              const a = Math.sqrt((2 * lev) / E.l1), b = Math.sqrt((2 * lev) / E.l2);
              const xs: number[] = [], ys: number[] = [];
              for (let i = 0; i <= 90; i++) {
                const t = (i / 90) * Math.PI * 2;
                xs.push(ws[0]! + E.u1[0] * a * Math.cos(t) + E.u2[0] * b * Math.sin(t));
                ys.push(ws[1]! + E.u1[1] * a * Math.cos(t) + E.u2[1] * b * Math.sin(t));
              }
              pp.path(xs, ys, stroke, wdt, dash);
            };
            for (const lev of [0.04, 0.16, 0.36, 0.64, 1.0]) ell(lev, withAlpha(color('red'), 0.28), 1);
            const d0 = wsol[0]! - ws[0]!, d1 = wsol[1]! - ws[1]!;
            const lev = 0.5 * (A[0]! * d0 * d0 + 2 * A[1]! * d0 * d1 + A[3]! * d1 * d1);
            if (lev > 1e-6) ell(lev, color('red'), 1.8);
            // regularizer level set through the solution
            const regShape = (k: Kind): [number[], number[]] => {
              const xs: number[] = [], ys: number[] = [];
              const R = (u: number[], rho: number) => {
                const a1 = Math.abs(u[0]!) + Math.abs(u[1]!);
                if (k === 'l2' || k === 'mn') return rho * rho;
                if (k === 'l1') return rho * a1;
                return 0.5 * rho * a1 + 0.25 * rho * rho;
              };
              const target = R([wsol[0]!, wsol[1]!].map((v) => v / (Math.hypot(wsol[0]!, wsol[1]!) || 1)), Math.hypot(wsol[0]!, wsol[1]!));
              for (let i = 0; i <= 120; i++) {
                const t = (i / 120) * Math.PI * 2;
                const u = [Math.cos(t), Math.sin(t)];
                let lo = 0, hi = 5;
                for (let it = 0; it < 40; it++) {
                  const mid = (lo + hi) / 2;
                  if (R(u, mid) < target) lo = mid;
                  else hi = mid;
                }
                xs.push(u[0]! * lo);
                ys.push(u[1]! * lo);
              }
              return [xs, ys];
            };
            if (kind === 'mn') {
              const xs: number[] = [], ys: number[] = [];
              for (let i = 0; i <= 120; i++) {
                const t = (i / 120) * Math.PI * 2;
                xs.push(c * Math.cos(t));
                ys.push(c * Math.sin(t));
              }
              ctx.fillStyle = withAlpha(color('blue'), 0.08);
              ctx.beginPath();
              xs.forEach((x, i) => (i ? ctx.lineTo(pp.sx(x), pp.sy(ys[i]!)) : ctx.moveTo(pp.sx(x), pp.sy(ys[i]!))));
              ctx.fill();
              pp.path(xs, ys, color('blue'), 1.8);
            } else if (Math.hypot(wsol[0]!, wsol[1]!) > 1e-4) {
              const [xs, ys] = regShape(kind);
              pp.path(xs, ys, color('blue'), 1.8);
            }
            const path = paths[kind];
            pp.path(path.map((q) => q[0]!), path.map((q) => q[1]!), withAlpha(color('--ink-2'), 0.75), 1.5, [4, 4]);
            pp.dot(ws[0]!, ws[1]!, 5, color('red'));
            pp.text('w*', ws[0]! + 0.05, ws[1]! + 0.05, { size: 12, mono: true, color: color('red') });
            pp.dot(wsol[0]!, wsol[1]!, 6.5, color('blue'), color('--paper'));
            pp.text('w₀ →', pp.view()[1] - 0.05, 0.04, { size: 11, align: 'right', color: color('--ink-3') });
            pp.text('w₁', 0.04, pp.view()[3] - 0.12, { size: 11, color: color('--ink-3') });
          },
        });
        const barPl = f.plot({
          height: 124,
          square: false,
          domain: [-0.5, ND - 0.5, -1.4, 2.3],
          draw: (pp) => {
            const ctx = pp.ctx;
            ctx.strokeStyle = color('--axis');
            ctx.beginPath();
            ctx.moveTo(0, Math.round(pp.sy(0)) + 0.5);
            ctx.lineTo(pp.w, Math.round(pp.sy(0)) + 0.5);
            ctx.stroke();
            const bw = pp.len(0.62);
            for (let j = 0; j < ND; j++) {
              const x0 = pp.sx(j) - bw / 2;
              if (wtrue[j] !== 0) {
                ctx.strokeStyle = withAlpha(color('red'), 0.7);
                ctx.setLineDash([3, 3]);
                ctx.strokeRect(x0 - 1, Math.min(pp.sy(0), pp.sy(wtrue[j]!)), bw + 2, Math.abs(pp.sy(wtrue[j]!) - pp.sy(0)));
                ctx.setLineDash([]);
              }
              const v = bars[j]!;
              if (v === 0) {
                ctx.fillStyle = color('--ink-3');
                ctx.beginPath();
                ctx.arc(pp.sx(j), pp.sy(0), 2.2, 0, Math.PI * 2);
                ctx.fill();
                continue;
              }
              ctx.fillStyle = withAlpha(color('blue'), 0.8);
              ctx.fillRect(x0, Math.min(pp.sy(0), pp.sy(v)), bw, Math.max(1, Math.abs(pp.sy(v) - pp.sy(0))));
            }
            pp.text('16 weights of a linear model (dashed: the 3 that matter)', -0.4, 2.0, { size: 11, color: color('--ink-2') });
          },
        });
        const zerosRo = f.readout('exactly zero');
        const lit: Record<Kind, string[]> = { l2: ['data', 'l2', 'sum'], l1: ['data', 'l1', 'sum'], en: ['data', 'en', 'sum'], mn: ['data', 'mn'] };
        const update = () => {
          wsol = solve2(kind, lam, c);
          bars = solveBars(kind, lam, kind === 'mn' ? c * 1.4 : c);
          let z = 0;
          for (const v of bars) if (v === 0) z++;
          zerosRo.set(`${z} / ${ND}`);
          f.code.setMany({ w0: fmt(Math.abs(wsol[0]!) < 5e-4 ? 0 : wsol[0]!, 3), w1: fmt(Math.abs(wsol[1]!) < 5e-4 ? 0 : wsol[1]!, 3), regline: kind === 'mn' ? `c = ${fmt(c, 2)}` : `reg = ${fmt(lam, 2)}` });
          f.code.highlight(lit[kind]);
          pl.redraw();
          barPl.redraw();
        };
        f.segmented({
          label: 'regularizer',
          options: [
            { value: 'l2', label: 'L2' },
            { value: 'l1', label: 'L1' },
            { value: 'en', label: 'elastic' },
            { value: 'mn', label: 'max-norm' },
          ],
          value: 'l2',
          onChange: (v) => {
            kind = v as Kind;
            labelEl.textContent = kind === 'mn' ? 'max length c' : 'strength λ';
            sl.set(Number(sl.input.value), false);
            update();
          },
        });
        const sl = f.slider({
          label: 'strength λ',
          sym: 'lam',
          min: 0,
          max: 1,
          step: 0.005,
          value: 0.6,
          map: (t) => (kind === 'mn' ? 1.7 * (1 - t) + 0.02 : 10 ** (-3 + 3.5 * t)),
          format: (v) => fmt(v, 2),
          onInput: (v) => {
            if (kind === 'mn') c = v;
            else lam = v;
            update();
          },
        });
        const labelEl = sl.el.querySelector('.ctl-label')!;
        lam = sl.value;
        update();
      },
      caption: `**Top:** a two-weight model. The red dot $w^*$ is the best fit to the data alone, and the red ellipses are contours of the data loss around it. The blue shape is the set of weights with the same penalty as the current solution (large blue dot), and the dashed line traces the solution as the strength grows. The optimum sits where an ellipse just touches the blue shape. A circle (L2) is touched at a smooth point, so both weights shrink but stay nonzero. A diamond (L1) is usually touched at a *corner*, on an axis: slide $\\symlam$ up and $w_1$ snaps to exactly zero while $w_0$ survives. **Bottom:** the same regularizer on a 16-weight linear model where only 3 inputs matter. With L1 the useless weights become exactly zero (dots); with L2 they only get small. Max-norm leaves the fit alone until it no longer fits inside the circle, then clips.`,
    });

    p.prose(`
### Details that matter

**Biases are usually not regularized.** A bias does not multiply any input, so it does not control how strongly the network reacts to any feature of the data; penalizing it buys nothing in terms of overfitting. In practice regularizing biases rarely makes a big difference either way, but leaving them out is the norm (Chapter 4's linear classifier already did this).

**Per-layer regularization** (a different $\\symlam$ for each layer) is possible, but uncommon, and there is little published evidence for it, except that the output layer is sometimes treated differently. The usual practice is a single global L2 strength, chosen with a validation set (Chapter 9 covers the search).`);

    // ------------------------------------------------------------------ dropout
    p.h2('Dropout', 'dropout');
    p.prose(`
**Dropout** (Srivastava, Hinton, Krizhevsky, Sutskever and Salakhutdinov, 2014) is an extremely simple and surprisingly effective regularizer that complements the weight penalties. During training, on every forward pass, each neuron is kept with some probability $\\symp$ and otherwise set to zero. A different random set of neurons is silenced for every example and every step. At test time nothing is dropped.

There are two ways to see why this helps:

- **It prevents co-adaptation.** No neuron can rely on any particular other neuron being there, so each has to learn something useful on its own, with redundancy built in. A network classifying cats cannot depend entirely on its one "whiskers" neuron, because half the time it is gone.
- **It trains an ensemble.** Each random mask selects a *thinned* sub-network, and each training step updates one of them. A network with $n$ droppable units contains $2^n$ such sub-networks, all sharing weights. Running the full network at test time acts like averaging the predictions of that whole, astronomically large ensemble.

The one subtlety is scale. If a unit is kept only half the time, the next layer gets used to receiving, on average, half its full input. At test time, with every unit present, it would suddenly see twice as much. The original fix multiplies activations by $\\symp$ at test time. The now-standard **inverted dropout** does the correction during training instead, so the test-time code needs no change at all:`);

    p.math({
      label: 'Inverted dropout keeps the expected value unchanged',
      tex: String.raw`\begin{aligned}m &= \begin{cases}1 & \text{with probability } \symp \\ 0 & \text{otherwise}\end{cases} \\ \mathbb{E}\Big[\frac{m}{\symp}\,h\Big] &= \symp\cdot\frac{1}{\symp}\,h + (1-\symp)\cdot 0 = h\end{aligned}`,
      code: `
        p = 0.5    # keep probability (higher = less dropout)
        # each unit: 0, or 1/p, at random
        mask = (np.random.rand(*h.shape) < p) / p
        h *= mask  # train time: drop and rescale
        # test time: use h as is, no mask, no scaling
      `,
      codeTitle: 'inverted_dropout.py',
      terms: [
        [String.raw`m`, 'the random mask for one unit: 1 (keep) with probability $\\symp$, else 0 (drop). `np.random.rand(...) < p` makes exactly that'],
        [String.raw`\frac{m}{\symp}\,h`, 'the unit\'s output during training: either zero or boosted by $1/\\symp$ (doubled, for $\\symp = 0.5$)'],
        [String.raw`\mathbb{E}[\cdot]`, 'the expected value: the average over all the random masks you could draw'],
        [String.raw`\symp\cdot\frac{1}{\symp}h + (1-\symp)\cdot 0`, 'average over the two cases, each weighted by how likely it is'],
      ],
      explain: 'On average, over the random masks, each unit sends exactly the value it would send with no dropout. The next layer therefore sees the same average input during training as it will at test time, so the plain, unmasked network is the right thing to run for predictions.',
    });

    p.figure({
      title: 'Dropout on a small network',
      codeTitle: 'dropout_net.py',
      code: `
        p = {{p:0.5}}   # probability of keeping a unit

        def train_step(x):
            h1 = np.maximum(0, W1.dot(x) + b1)
            mask1 = (np.random.rand(*h1.shape) < p){{div: / p}}  #@m1
            h1 *= mask1   # {{mask1}}        #@m1
            # the ringed unit is one entry of h2:
            h2 = np.maximum(0, W2.dot(h1) + b2)     #@z
            mask2 = (np.random.rand(*h2.shape) < p){{div: / p}}  #@m2
            h2 *= mask2   # {{mask2}}        #@m2
            out = W3.dot(h2) + b3

        def predict(x):   # test time: all units, no masks
            h1 = np.maximum(0, W1.dot(x) + b1)      #@test
            h2 = np.maximum(0, W2.dot(h1) + b2)     #@test
            out = W3.dot(h2) + b3                   #@test
      `,
      setup(f) {
        const sizes = [4, 6, 6, 2];
        const r = new Rng(17);
        const Ws = [0, 1, 2].map((l) => Array.from({ length: sizes[l + 1]! }, () => Array.from({ length: sizes[l]! }, () => r.randn() * 0.75)));
        const bs = [0, 1, 2].map((l) => Array.from({ length: sizes[l + 1]! }, () => 0.15 + 0.1 * r.randn()));
        const x = [1.0, 0.6, -0.4, 0.9];
        let keep = 0.5;
        let inverted = true;
        let mode: 'train' | 'test' = 'train';
        let m1 = new Array(6).fill(1);
        let m2 = new Array(6).fill(1);
        const samples: number[] = [];
        const relu = (v: number) => (v > 0 ? v : 0);
        const h1Full = Ws[0]!.map((row, j) => relu(row.reduce((a, w, i) => a + w * x[i]!, bs[0]![j]!)));
        const zAt = (h1: number[], u: number) => Ws[1]![u]!.reduce((a, w, i) => a + w * h1[i]!, bs[1]![u]!);
        // follow the layer-2 unit with the largest input, so it is clearly alive
        let track = 0;
        for (let u = 1; u < 6; u++) if (zAt(h1Full, u) > zAt(h1Full, track)) track = u;
        const zOf = (h1: number[]) => zAt(h1, track);
        const zTest = () => zOf(h1Full);
        const mr = new Rng(5);
        const sampleMasks = () => {
          m1 = m1.map(() => (mr.next() < keep ? 1 : 0));
          m2 = m2.map(() => (mr.next() < keep ? 1 : 0));
        };
        const scaleOf = () => (inverted ? 1 / keep : 1);
        const zTrain = () => zOf(h1Full.map((v, i) => v * m1[i]! * scaleOf()));
        const net = f.canvas(640, 280, (ctx, w, h) => {
          const xs = [0.1, 0.38, 0.66, 0.9].map((t) => t * w);
          const top = 34, bot = h - 26, gapY = (bot - top) / 5;
          const pos = sizes.map((n, l) => Array.from({ length: n }, (_, i) => [xs[l]!, (top + bot) / 2 + (i - (n - 1) / 2) * gapY] as [number, number]));
          const alive = (l: number, i: number) => mode === 'test' || l === 0 || l === 3 || (l === 1 ? m1[i] === 1 : m2[i] === 1);
          for (let l = 0; l < 3; l++)
            for (let i = 0; i < sizes[l]!; i++)
              for (let j = 0; j < sizes[l + 1]!; j++) {
                if (!alive(l, i) || !alive(l + 1, j)) continue;
                const wv = Ws[l]![j]![i]!;
                ctx.strokeStyle = withAlpha(color(wv > 0 ? 'blue' : 'red'), 0.18 + Math.min(0.5, Math.abs(wv) * 0.35));
                ctx.lineWidth = 0.6 + Math.min(2, Math.abs(wv) * 1.3);
                ctx.beginPath();
                ctx.moveTo(pos[l]![i]![0], pos[l]![i]![1]);
                ctx.lineTo(pos[l + 1]![j]![0], pos[l + 1]![j]![1]);
                ctx.stroke();
              }
          const rad = Math.max(8, Math.min(14, gapY * 0.36));
          sizes.forEach((n, l) => {
            for (let i = 0; i < n; i++) {
              const [cx, cy] = pos[l]![i]!;
              const on = alive(l, i);
              ctx.beginPath();
              ctx.arc(cx, cy, rad, 0, Math.PI * 2);
              ctx.fillStyle = on ? (l === 0 ? withAlpha(color('orange'), 0.85) : l === 3 ? withAlpha(color('purple'), 0.85) : withAlpha(color('green'), 0.8)) : color('--paper');
              ctx.fill();
              ctx.lineWidth = 1.5;
              ctx.strokeStyle = on ? color('--ink-2') : color('--ink-3');
              ctx.setLineDash(on ? [] : [3, 3]);
              ctx.stroke();
              ctx.setLineDash([]);
              if (!on) {
                ctx.strokeStyle = color('--ink-3');
                ctx.beginPath();
                ctx.moveTo(cx - rad * 0.5, cy - rad * 0.5);
                ctx.lineTo(cx + rad * 0.5, cy + rad * 0.5);
                ctx.moveTo(cx + rad * 0.5, cy - rad * 0.5);
                ctx.lineTo(cx - rad * 0.5, cy + rad * 0.5);
                ctx.stroke();
              }
              if (l === 2 && i === track) {
                ctx.strokeStyle = color('gold');
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(cx, cy, rad + 5, 0, Math.PI * 2);
                ctx.stroke();
              }
            }
          });
          ctx.fillStyle = color('--ink-3');
          ctx.font = ui(11);
          ctx.textAlign = 'center';
          ['input x', 'h1', 'h2', 'out'].forEach((s, l) => ctx.fillText(s, xs[l]!, h - 6));
          ctx.textAlign = 'left';
          ctx.fillStyle = color('--ink-2');
          ctx.font = ui(12, 600);
          ctx.fillText(mode === 'test' ? 'test time: all units' : `train: ${m1.filter(Boolean).length + m2.filter(Boolean).length} of 12 hidden units kept`, 6, 16);
        });
        net.canvas.classList.add('scroll-ok');
        fitHeight(net.canvas, (w) => Math.max(230, w * 0.44));
        const chart = f.plot({
          height: 120,
          square: false,
          domain: [0, 100, -1, 3],
          draw: (pp) => {
            const n = Math.max(100, samples.length);
            const zt = zTest();
            const vals = [...samples, zt, 0];
            const span = Math.max(1, Math.max(...vals) - Math.min(...vals));
            const lo = Math.min(...vals) - 0.08 * span, hi = Math.max(...vals) + 0.32 * span;
            pp.setDomain(0, n, lo, hi);
            const g = niceGrid(hi - lo);
            pp.ctx.strokeStyle = color('--grid');
            pp.ctx.lineWidth = 1;
            for (let v = Math.ceil(lo / g) * g; v <= hi; v += g) {
              pp.ctx.beginPath();
              pp.ctx.moveTo(0, Math.round(pp.sy(v)) + 0.5);
              pp.ctx.lineTo(pp.w, Math.round(pp.sy(v)) + 0.5);
              pp.ctx.stroke();
              pp.text(fmt(v, 2), n * 0.995, v, { size: 10.5, mono: true, align: 'right', base: 'bottom', color: color('--ink-3') });
            }
            pp.path([0, n], [0, 0], color('--axis'), 1);
            pp.path([0, n], [zt, zt], color('--ink'), 1.5, [6, 4]);
            pp.text('test-time value', n * 0.01, zt - (hi - lo) * 0.04, { size: 11, base: 'top', color: color('--ink-2') });
            samples.forEach((s, i) => pp.dot(i + 0.5, s, 2.2, withAlpha(color('green'), 0.55)));
            if (samples.length) {
              const run: number[] = [];
              let acc = 0;
              samples.forEach((s, i) => run.push((acc += s) / (i + 1)));
              pp.path(run.map((_, i) => i + 0.5), run, color('gold'), 2.4);
            }
            pp.text('input to the ringed unit, per pass (gold: average)', n * 0.01, hi - (hi - lo) * 0.04, { size: 11, base: 'top', color: color('--ink-2') });
          },
        });
        const avgRo = f.readout('average');
        const testRo = f.readout('test-time');
        const sync = () => {
          f.code.setMany({
            mask1: mode === 'test' ? '' : `[${m1.map((m) => fmt(m * scaleOf(), 2)).join(', ')}]`,
            mask2: mode === 'test' ? '' : `[${m2.map((m) => fmt(m * scaleOf(), 2)).join(', ')}]`,
          });
          testRo.set(fmt(zTest(), 3));
          avgRo.set(samples.length ? fmt(samples.reduce((a, b) => a + b, 0) / samples.length, 3) : '–');
          net.redraw();
          chart.redraw();
        };
        const pass = () => {
          sampleMasks();
          samples.push(zTrain());
          if (samples.length > 400) samples.shift();
        };
        sampleMasks();
        f.button('Forward pass', () => {
          if (mode === 'test') modeSeg.set('train');
          pass();
          f.code.highlight(['m1', 'z', 'm2']);
          sync();
        }, { primary: true });
        let todo = 0;
        const fast = f.loop(() => {
          for (let k = 0; k < 4 && todo > 0; k++, todo--) pass();
          sync();
          if (todo <= 0) return false;
        });
        f.button('Run 200 passes', () => {
          if (mode === 'test') modeSeg.set('train');
          todo = 200;
          f.code.highlight(['m1', 'z', 'm2']);
          fast.start();
        });
        const modeSeg = f.segmented({
          label: 'mode',
          options: [
            { value: 'train', label: 'train' },
            { value: 'test', label: 'test' },
          ],
          value: 'train',
          onChange: (v) => {
            mode = v as 'train' | 'test';
            f.code.highlight(mode === 'test' ? 'test' : ['m1', 'm2']);
            sync();
          },
        });
        f.slider({
          label: 'keep p',
          sym: 'p',
          min: 0.1,
          max: 1,
          step: 0.05,
          value: 0.5,
          slot: 'p',
          onInput: (v) => {
            keep = v;
            samples.length = 0;
            sync();
          },
        });
        f.segmented({
          label: 'train-time scaling',
          options: [
            { value: 'inv', label: '÷ p (inverted)' },
            { value: 'none', label: 'none (a bug)' },
          ],
          value: 'inv',
          onChange: (v) => {
            inverted = v === 'inv';
            f.code.set('div', inverted ? ' / p' : '');
            samples.length = 0;
            sync();
          },
        });
        sync();
      },
      caption: `Each **Forward pass** draws new random masks: crossed-out units are dropped, along with all their connections, and the code shows the masks (0 or $1/\\symp$). The chart tracks one number, the input arriving at the gold-ringed unit (computed even on passes where that unit's own output is then dropped). It jumps around from pass to pass, since each pass is a different sub-network, but press **Run 200 passes** and its running average (gold) settles onto the test-time value (dashed). Now set the scaling to **none**: without the $1/\\symp$, the average settles at only $\\symp$ times the test-time value, which is exactly the train/test mismatch inverted dropout exists to prevent.`,
    });

    p.prose(`
### Noise as a theme

Dropout is one instance of a broader recipe: **inject random noise during training, then average it away at test time.** The averaging can be done analytically, as dropout's rescaling does, or numerically, by running several noisy forward passes and averaging their predictions. Other members of the family:

- **DropConnect** (Wan et al., 2013) zeroes random individual *weights* instead of whole units.
- **Data augmentation**: random crops, flips and color shifts of the training images are noise in the input, and are standard for ConvNets (Chapter 13).
- Stochastic and fractional pooling randomize the pooling regions of a ConvNet.
- BatchNorm's batch-to-batch jitter, mentioned above, also belongs here.

**In practice:** use a single global L2 penalty chosen on validation data, and combine it with dropout applied after all layers. $\\symp = 0.5$ is a reasonable default, and can be tuned too.`);

    // ------------------------------------------------------------------ losses
    p.h2('Loss functions', 'losses');
    p.prose(`
The regularization penalty is one part of the loss. The other part, the **data loss**, measures how well the predictions match the labels, as an average over the examples: $\\symL = \\frac{1}{N}\\sum_i \\symL_i$. Write $f$ for the network's output scores on example $i$. Which $\\symL_i$ to use depends on what kind of answer you want.

### Classification: one correct label

This is the case Chapter 4 covered in depth. The two standard choices are the multiclass SVM, $\\symL_i = \\sum_{j\\ne y_i}\\max(0, f_j - f_{y_i} + 1)$, and the softmax cross-entropy, $\\symL_i = -\\log\\big(e^{f_{y_i}} / \\sum_j e^{f_j}\\big)$. Some people report better results with the **squared hinge loss**, which uses $\\max(0, f_j - f_{y_i} + 1)^2$ inside the sum.

**When there are a huge number of classes**, say every word of an English dictionary or the 22,000 categories of the full ImageNet, computing the softmax over all of them on every example becomes the bottleneck. **Hierarchical softmax** arranges the classes as the leaves of a tree. Every class is then a path from the root, and a small classifier at each internal node decides "left or right?". Scoring one class costs only the length of its path, not the number of classes. How well it works depends a lot on how the tree is built, which is problem-specific.

### Attribute classification: several labels at once

Sometimes each example has a *set* of labels: an Instagram photo may carry any subset of a large collection of hashtags, and a scene can contain both a dog and a beach. Softmax is wrong here, because it forces the classes to compete for one unit of probability. Instead, build an independent binary classifier per attribute. One version uses a hinge loss per attribute, with labels $y_{ij} \\in \\{+1, -1\\}$: $\\symL_i = \\sum_j \\max(0, 1 - y_{ij} f_j)$. Another trains a separate *logistic regression* per attribute:`);

    p.math({
      label: 'Independent logistic loss, one per attribute',
      tex: String.raw`\begin{aligned}\symL_i &= -\sum_j \Big[\, y_{ij}\log \sigma(f_j) \\ &\qquad\;\; + (1 - y_{ij})\log\big(1 - \sigma(f_j)\big)\Big] \\ \sigma(z) &= \frac{1}{1 + e^{-z}}\end{aligned}`,
      code: `
        # scores: (A,) one per attribute; y: (A,) 0s and 1s
        probs = 1 / (1 + np.exp(-scores))   # sigmoids
        loss = -np.sum(y * np.log(probs)
                       + (1 - y) * np.log(1 - probs))
        dscores = probs - y      # the gradient: that simple
      `,
      codeTitle: 'attribute_loss.py',
      terms: [
        [String.raw`\sigma(f_j)`, 'the *sigmoid* squashes attribute $j$\'s score into a probability between 0 and 1. It is the two-class version of softmax'],
        [String.raw`y_{ij}`, '1 if example $i$ has attribute $j$, else 0'],
        [String.raw`y_{ij}\log\sigma(f_j)`, 'when the attribute is present, this term is active: the log-probability given to "yes"'],
        [String.raw`(1-y_{ij})\log(1-\sigma(f_j))`, 'when it is absent, this one is active instead: the log-probability given to "no"'],
      ],
      explain: 'For each attribute, exactly one of the two terms is switched on, and it is the negative log of the probability the model gave to the right answer, just like softmax\'s cross-entropy but for a yes/no question. The attributes do not compete, so any number of them can be "yes" at once. A neat bonus: the gradient with respect to each score is simply the predicted probability minus the label.',
    });

    p.prose(`
### Regression: predicting real numbers

For outputs that are real-valued quantities (the height of a person, the length of something in an image, the angle of a head), the usual losses measure the distance between prediction and target:`);

    p.math({
      label: 'L2 and L1 regression losses',
      tex: String.raw`\begin{aligned}\text{L2:}\quad \symL_i &= \| f - y_i \|_2^2 = \sum_j (f_j - y_{ij})^2 \\ \text{L1:}\quad \symL_i &= \| f - y_i\|_1 = \sum_j |f_j - y_{ij}|\end{aligned}`,
      code: `
        diff = scores - y             # (D,) errors
        loss = np.sum(diff ** 2)      # L2 (squared error)
        dscores = 2 * diff            # grows with the error

        loss = np.sum(np.abs(diff))   # L1 (absolute error)
        dscores = np.sign(diff)       # just +1 or -1
      `,
      codeTitle: 'regression_loss.py',
      terms: [
        [String.raw`f - y_i`, 'the error on each output: prediction minus target'],
        [String.raw`\|\cdot\|_2^2`, 'squared L2 norm: add up the squared errors. The square (rather than the true length, with its square root) changes nothing about which predictions are best and makes the gradient simpler'],
        [String.raw`\|\cdot\|_1`, 'L1 norm: add up the absolute errors'],
      ],
      explain: 'The gradients show the personalities. Under L2, each output pushes back in proportion to its error, so one wildly wrong prediction produces a huge gradient. Under L1, every error pushes back with the same strength, only its direction matters. The figure shows what that does when one data point is an outlier.',
    });

    p.figure({
      title: 'One outlier: L2 versus L1',
      codeTitle: 'fit_line.py',
      code: `
        pred = w * x + b               # a line
        diff = pred - y
        loss = np.sum(diff ** 2)       # L2   #@l2
        loss = np.sum(np.abs(diff))    # L1   #@l1

        # how hard each point pulls on the fit:
        dpred = 2 * diff         # L2        #@g2
        dpred = np.sign(diff)    # L1        #@g1
        # the outlier pulls: L2 {{g2}}, L1 {{g1}}
        # L2 fit: w = {{w2}}, b = {{b2}}
        # L1 fit: w = {{w1}}, b = {{b1}}
      `,
      setup(f) {
        const n = 13;
        const r = new Rng(41);
        const xs: number[] = [], ys: number[] = [];
        for (let i = 0; i < n; i++) {
          const x = -1 + (2 * i) / (n - 1) + r.uniform(-0.04, 0.04);
          xs.push(x);
          ys.push(0.55 * x + 0.1 + r.randn() * 0.08);
        }
        const out = [0.72, -0.85];
        let sel: 'l2' | 'l1' = 'l2';
        const allX = () => [...xs, out[0]!];
        const allY = () => [...ys, out[1]!];
        const fitL2 = () => {
          const X = allX(), Y = allY();
          const m = X.length;
          const mx = X.reduce((a, b) => a + b, 0) / m, my = Y.reduce((a, b) => a + b, 0) / m;
          let sxy = 0, sxx = 0;
          X.forEach((x, i) => {
            sxy += (x - mx) * (Y[i]! - my);
            sxx += (x - mx) ** 2;
          });
          const w = sxy / sxx;
          return [w, my - w * mx];
        };
        const fitL1 = () => {
          const X = allX(), Y = allY();
          let best = [0, 0], bl = Infinity;
          for (let i = 0; i < X.length; i++)
            for (let j = i + 1; j < X.length; j++) {
              if (Math.abs(X[i]! - X[j]!) < 1e-9) continue;
              const w = (Y[j]! - Y[i]!) / (X[j]! - X[i]!);
              const b = Y[i]! - w * X[i]!;
              const l = X.reduce((a, x, k) => a + Math.abs(w * x + b - Y[k]!), 0);
              if (l < bl) {
                bl = l;
                best = [w, b];
              }
            }
          return best;
        };
        let f2 = fitL2(), f1 = fitL1();
        const pl = f.plot({
          aspect: 1.3,
          domain: [-1.25, 1.25, -1.25, 1.1],
          draw: (pp) => {
            pp.axes({ grid: 0.5, labels: true });
            const [w, b] = sel === 'l2' ? f2 : f1;
            const X = allX(), Y = allY();
            X.forEach((x, i) => pp.path([x, x], [Y[i]!, w! * x + b!], withAlpha(color(sel === 'l2' ? 'blue' : 'green'), 0.45), 1.5));
            pp.fn((x) => f2[0]! * x + f2[1]!, withAlpha(color('blue'), sel === 'l2' ? 1 : 0.4), sel === 'l2' ? 3 : 1.8);
            pp.fn((x) => f1[0]! * x + f1[1]!, withAlpha(color('green'), sel === 'l1' ? 1 : 0.4), sel === 'l1' ? 3 : 1.8);
            xs.forEach((x, i) => pp.dot(x, ys[i]!, 4, color('orange')));
            pp.dot(out[0]!, out[1]!, 7, color('red'), color('--paper'));
            pp.text('drag me', out[0]! + 0.08, out[1]! - 0.03, { size: 11, color: color('red') });
            // label each line at whichever end the two lines are further apart
            const xe = Math.abs((f2[0]! - f1[0]!) * 1.15 + f2[1]! - f1[1]!) > Math.abs((f2[0]! - f1[0]!) * -1.15 + f2[1]! - f1[1]!) ? 1.15 : -1.15;
            const y2 = f2[0]! * xe + f2[1]!, y1 = f1[0]! * xe + f1[1]!;
            const up2 = y2 >= y1;
            const al = xe > 0 ? 'right' : 'left';
            pp.text('L2 fit', xe, y2 + (up2 ? 0.07 : -0.07), { size: 12, bold: true, align: al, base: up2 ? 'bottom' : 'top', color: color('blue') });
            pp.text('L1 fit', xe, y1 + (up2 ? -0.07 : 0.07), { size: 12, bold: true, align: al, base: up2 ? 'top' : 'bottom', color: color('green') });
          },
        });
        const sync = () => {
          f2 = fitL2();
          f1 = fitL1();
          f.code.setMany({
            w2: fmt(f2[0]!, 3), b2: fmt(f2[1]!, 3), w1: fmt(f1[0]!, 3), b1: fmt(f1[1]!, 3),
            g2: fmt(2 * (f2[0]! * out[0]! + f2[1]! - out[1]!), 3),
            g1: fmt(Math.sign(f1[0]! * out[0]! + f1[1]! - out[1]!), 1),
          });
          f.code.highlight(sel === 'l2' ? ['l2', 'g2'] : ['l1', 'g1']);
          pl.redraw();
        };
        let drag = false;
        pl.canvas.addEventListener('pointerdown', (e) => {
          const [x, y] = pl.pointer(e);
          if (Math.hypot(x - out[0]!, y - out[1]!) > 0.3) return;
          drag = true;
          pl.canvas.setPointerCapture(e.pointerId);
        });
        pl.canvas.addEventListener('pointermove', (e) => {
          if (!drag) return;
          const [x, y] = pl.pointer(e);
          out[0] = Math.max(-1.2, Math.min(1.2, x));
          out[1] = Math.max(-1.2, Math.min(1.05, y));
          sync();
        });
        pl.canvas.addEventListener('pointerup', () => (drag = false));
        f.segmented({
          label: 'show residuals for',
          options: [
            { value: 'l2', label: 'L2 loss' },
            { value: 'l1', label: 'L1 loss' },
          ],
          value: 'l2',
          onChange: (v) => {
            sel = v as 'l2' | 'l1';
            sync();
          },
        });
        sync();
      },
      caption: `Thirteen points lie close to a line; the red one is an outlier you can **drag**. The L2 fit (blue) bends toward it, because squaring makes a big error expensive and the outlier's gradient grows with its distance. The L1 fit (green) barely notices: the outlier pulls with the same unit force as any other point that sits on the same side. Drag the outlier far away and compare the two "pulls" in the code. This is one reason L2 regression is fragile in neural networks: a few bad targets can produce gradients that dominate everything else.`,
    });

    p.callout('warning', `L2 regression is **much harder to optimize** than a classification loss like softmax, for two reasons. It asks the network to output exactly the right number for every input, whereas softmax only cares that the right score ends up comfortably larger than the others; the exact values hardly matter. And, as above, outliers create huge gradients. Dropout combines badly with it too (especially right before the L2 output layer).

So when you face a regression problem, first ask whether you could **quantize the output into bins** and classify instead. Predicting a 1 to 5 star rating, for example, often works better as 5 classes than as one real number. Classification also gives you a distribution over the answers, which tells you how confident the model is. Use L2 only when you really need a precise real value, and be careful with it.`, 'Prefer classification when you can');

    p.prose(`
### Structured prediction

Finally, the labels can be whole structures, such as graphs, trees or segmentations, so many possible answers that they cannot be listed. The **structured SVM** loss asks for a margin between the correct structure and the highest-scoring incorrect one. Finding that incorrect structure is a hard search problem in itself, so this is usually solved with special-purpose solvers rather than plain gradient descent, and it is beyond the scope of the course.`);

    p.table(
      ['Problem', 'Typical data loss', 'Notes'],
      [
        ['One label out of $C$ classes', 'Softmax cross-entropy, or multiclass SVM', 'Chapter 4. Softmax is the more common choice'],
        ['Very many classes', 'Hierarchical softmax', 'Cost per example grows with tree depth, not class count'],
        ['Several labels at once', 'Independent logistic (or hinge) loss per attribute', 'Attributes do not compete'],
        ['A real number', 'L2 or L1 distance', 'Fragile; consider binning into classes first'],
        ['A structure (graph, tree)', 'Structured SVM', 'Needs special solvers'],
      ],
    );

    p.h2('Summary', 'summary');
    p.prose(`
The recommendations from this chapter, as a checklist:

1. **Preprocess** by subtracting the mean (computed on training data only) and, if features differ in scale, dividing by the standard deviation. For images, a mean image or per-channel mean is standard; PCA and whitening are not used with ConvNets.
2. **Initialize** weights from a Gaussian scaled to the fan-in: \`np.random.randn(n) * np.sqrt(2.0 / n)\` for ReLU networks. Biases at zero.
3. **Use batch normalization** after fully connected or convolutional layers, before the nonlinearity. It makes the network far less sensitive to initialization.
4. **Regularize** with a global L2 penalty tuned on a validation set, plus dropout (inverted, $\\symp \\approx 0.5$) after each layer.
5. **Pick the loss** that matches the question: softmax for one label, independent logistic losses for many, and think twice before reaching for L2 regression.

Chapter 9 turns to the training run itself: checking gradients, babysitting the loss curve, the update rules beyond plain gradient descent, and how to search for good hyperparameters.`);

    p.callout('idea', `Most of this chapter is about **keeping signals at a healthy scale**: centering the data, calibrating the initial weights so each layer neither shrinks nor inflates its input (variance $\\approx 1/n$, or $2/n$ for ReLU), and BatchNorm, which enforces unit-scale activations on every mini-batch. The rest is about **not memorizing**: weight penalties (L2 spreads the weights out, L1 zeroes them), max-norm caps them, and dropout trains an ensemble of sub-networks and averages them for free at test time.`, 'Takeaways');
  },
};

/** A tidy grid spacing for a range of about `span`. */
function niceGrid(span: number): number {
  const raw = span / 4;
  const p10 = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p10;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p10;
}

export default chapter;

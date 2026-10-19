import type { ChapterDef } from './index';
import { fmt } from '../core/code';
import { color, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { cloud, coverage, ghost, halo, hatX0, legend, nearestLabel, offData } from '../lib/diffusion-draw';
import { MOONS, SPIRAL, model } from '../lib/diffusion-models';
import { DiffNet, SCHED, type Schedule, T, Trainer, cosineSchedule } from '../lib/diffusion-net';
import { Sampler } from '../lib/diffusion-sample';
import { DIFFUSION_SYMBOLS } from '../lib/diffusion-symbols';

const DOM: [number, number, number, number] = [-2.6, 2.6, -1.85, 1.85];
const MOON_COLORS = ['blue', 'gold'] as const;

const chapter: ChapterDef = {
  symbols: DIFFUSION_SYMBOLS,

  render(p) {
    p.prose(`
In 2016 the most impressive image generators were GANs, and the course's [last chapter](#/unsupervised) ended with them: sharp samples, unstable training, and a habit of collapsing onto a few outputs. A decade later nearly every image, video and audio generator is a **diffusion model** or its close relative, **flow matching**.

The idea fits in two sentences. Destroying data is easy: add a little Gaussian noise, again and again, until nothing is left but noise. Undoing *one small step* of that destruction is an ordinary regression problem, so train a network to do it, then chain many learned undo-steps to turn fresh noise into brand-new data.

Everything below runs on a toy: 1,000 points in the plane shaped like two interlocking moons. A data point $\\sym{x0}{x_0}$ is a pair of numbers instead of a million pixels, so a 10,000-weight network trains in your browser in well under a minute, and every picture is computed live. Nothing else about the algorithm changes for images: an image is a point with more coordinates.`);

    p.callout('history', `**Sohl-Dickstein et al. (2015)** introduced diffusion models, borrowing the idea from non-equilibrium physics. **Song and Ermon (2019)** trained networks to estimate the *score* (the direction toward higher probability) at many noise levels. **Ho, Jain and Abbeel (2020)**, DDPM, made the approach practical with a simple noise-prediction loss and image quality that rivaled GANs. **Dhariwal and Nichol (2021)** then beat GANs on ImageNet outright. In 2022 came DALL-E 2, Imagen and the openly released Stable Diffusion; by 2024 diffusion transformers were generating video (Sora) and rectified flow was training image models at scale (Stable Diffusion 3).`, 'Where this came from');

    // ---------------------------------------------------------------- forward
    p.h2('The forward process: noise in small steps', 'forward');
    p.prose(`
Pick a number of steps $T$ and a **noise schedule**: one small variance $\\symbeta$ for each step $t = 1, \\dots, T$. Then, starting from a clean point $\\sym{x0}{x_0}$, repeat: shrink the point very slightly toward the origin and add a little fresh Gaussian noise. After $T$ steps nothing of the moons is left, only a round cloud of noise.

This direction needs no learning at all. It is a fixed recipe for making training examples at every level of noise.`);

    p.callout('math', `$\\mathcal{N}(\\mu, \\sigma^2)$ is the **normal** (Gaussian) distribution: the bell curve centered at $\\mu$ with spread (standard deviation) $\\sigma$. Writing $\\symeps \\sim \\mathcal{N}(0, I)$ means "draw $\\epsilon$ at random from a standard bell curve, each coordinate independently", which is \`np.random.randn\`. Two facts carry this whole chapter: multiplying a random number by $s$ multiplies its **variance** (spread squared) by $s^2$, and adding two *independent* Gaussian numbers gives a Gaussian whose variance is the sum of the two variances.`, 'Math help: Gaussian noise');

    p.math({
      label: 'One step of the forward process',
      tex: String.raw`\symxt = \sqrt{1 - \symbeta}\;\sym{xt}{x_{t-1}} + \sqrt{\symbeta}\;\symeps, \qquad \symeps \sim \mathcal{N}(0, I)`,
      code: `
        def forward_step(x, t):
            eps = np.random.randn(*x.shape)      # fresh noise
            return np.sqrt(1 - beta[t]) * x + np.sqrt(beta[t]) * eps
      `,
      codeTitle: 'forward_step.py',
      terms: [
        [String.raw`\sym{xt}{x_{t-1}}`, 'the point after $t-1$ steps ($x_0$ is the clean data point)'],
        [String.raw`\sqrt{1 - \symbeta}`, 'shrink it slightly toward the origin. With $\\beta_t = 0.001$ that is a shrink of 0.05 percent'],
        [String.raw`\symbeta`, 'the variance of the noise added at step $t$: tiny at first, larger later'],
        [String.raw`\symeps \sim \mathcal{N}(0, I)`, 'a fresh draw of standard Gaussian noise, a new one at every step'],
      ],
      explain: `Why shrink at all? Bookkeeping of variance. If $x_{t-1}$ has variance 1, the shrunk point has variance $1 - \\beta_t$ and the noise adds back exactly $\\beta_t$: the total stays 1. This is called a *variance-preserving* process. Repeat it enough times and the original point has shrunk to nothing, leaving pure $\\mathcal{N}(0, I)$ noise, whatever $x_0$ was. DDPM used $T = 1000$ steps with $\\beta_t$ rising linearly from $10^{-4}$ to $0.02$. A 2-D toy needs fewer, so this page uses $T = 100$ with the same schedule stretched to match: $\\beta_t$ from $0.001$ to $0.2$.`,
    });

    p.prose(`
Simulating 700 steps to get one training example at step 700 would be slow. It is also unnecessary, because the noise of many steps merges into a single draw.`);

    p.math({
      label: 'Jumping straight to step t',
      tex: String.raw`\begin{aligned} \symalpha &= 1 - \symbeta, \qquad \symab = \prod_{s=1}^{t} \sym{alpha}{\alpha_s} \\ \symxt &= \sqrt{\symab}\;\sym{x0}{x_0} + \sqrt{1 - \symab}\;\symeps \end{aligned}`,
      code: `
        alpha = 1 - beta
        alpha_bar = np.cumprod(alpha)        # running product
        eps = np.random.randn(*x0.shape)
        xt = np.sqrt(alpha_bar[t]) * x0 + np.sqrt(1 - alpha_bar[t]) * eps
      `,
      codeTitle: 'closed_form.py',
      terms: [
        [String.raw`\symalpha`, 'the share of variance one step keeps'],
        [String.raw`\prod_{s=1}^{t}`, 'multiply together, for $s$ from 1 to $t$ (the product sign $\\prod$ is to multiplying what $\\sum$ is to adding)'],
        [String.raw`\symab`, 'the share of the original signal\'s variance that survives $t$ steps: 1 at the start, falling toward 0'],
        [String.raw`\sqrt{\symab}\;\sym{x0}{x_0}`, 'what is left of the clean point'],
        [String.raw`\sqrt{1 - \symab}\;\symeps`, 'all the noise of $t$ steps, combined into one Gaussian draw'],
      ],
      explain: `Check it for two steps. After step 1: $\\sqrt{\\alpha_1}x_0 + \\sqrt{1-\\alpha_1}\\epsilon_1$. Step 2 shrinks that by $\\sqrt{\\alpha_2}$ and adds $\\sqrt{1-\\alpha_2}\\epsilon_2$. The clean part is now $\\sqrt{\\alpha_1\\alpha_2}\\,x_0$. The two noises are independent Gaussians, so they merge into one with variance $\\alpha_2(1-\\alpha_1) + (1-\\alpha_2) = 1 - \\alpha_1\\alpha_2$. Every further step does the same, and the running product $\\bar\\alpha_t$ appears. The arrays in the code are indexed by step, with \`beta[0] = 0\` so that \`alpha_bar[0] = 1\` means "no noise yet".`,
    });

    p.figure({
      title: 'Two moons, drowned in noise',
      codeTitle: 'forward.py',
      code: `
        T = 100
        beta = np.r_[0, np.linspace(1e-3, 0.2, T)]  #@lin
        # or cosine: alpha_bar = f(t) / f(0)        #@cos
        alpha = 1 - beta
        alpha_bar = np.cumprod(alpha)

        x0 = data                        # (1000, 2)
        eps = np.random.randn(1000, 2)   # kept fixed
        t = {{t:5}}
        a = np.sqrt(alpha_bar[t])        # {{a:0.97}}   #@jump
        b = np.sqrt(1 - alpha_bar[t])    # {{b:0.25}}   #@jump
        xt = a * x0 + b * eps                      #@jump

        x = x0               # or: t small steps    #@walk
        for s in range(1, t + 1):                   #@walk
            z = np.random.randn(1000, 2)            #@walk
            x = np.sqrt(alpha[s]) * x + np.sqrt(beta[s]) * z  #@walk
      `,
      setup(f) {
        const data = MOONS;
        const n = data.n;
        const r0 = new Rng(17);
        const eps = Float32Array.from({ length: n * 2 }, () => r0.randn());
        const scheds: Record<string, Schedule> = { linear: SCHED, cosine: cosineSchedule() };
        let sk = 'linear';
        let how: 'jump' | 'walk' = 'jump';
        let t = 5;
        const walks = new Map<string, Float32Array[]>();
        const walk = (): Float32Array[] => {
          let w = walks.get(sk);
          if (!w) {
            const s = scheds[sk]!;
            const r = new Rng(23);
            w = [Float32Array.from(data.X)];
            for (let k = 1; k <= T; k++) {
              const prev = w[k - 1]!;
              const a = Math.sqrt(s.alpha[k]!), b = Math.sqrt(s.beta[k]!);
              w.push(prev.map((v) => a * v + b * r.randn()));
            }
            walks.set(sk, w);
          }
          return w;
        };
        const buf = new Float32Array(n * 2);
        const pointsAt = (tt: number): Float32Array => {
          if (how === 'walk') return walk()[tt]!;
          const s = scheds[sk]!;
          const a = Math.sqrt(s.ab[tt]!), b = Math.sqrt(1 - s.ab[tt]!);
          for (let i = 0; i < n * 2; i++) buf[i] = a * data.X[i]! + b * eps[i]!;
          return buf;
        };
        let sel = 0;
        let best = Infinity;
        for (let i = 0; i < n; i++) {
          const d = (data.X[2 * i]! + 1.25) ** 2 + (data.X[2 * i + 1]! - 0.62) ** 2;
          if (d < best) {
            best = d;
            sel = i;
          }
        }
        const pathOf = (upto: number): [number[], number[]] => {
          const xs: number[] = [], ys: number[] = [];
          const s = scheds[sk]!;
          const w = how === 'walk' ? walk() : null;
          for (let k = 0; k <= upto; k++) {
            if (w) {
              xs.push(w[k]![2 * sel]!);
              ys.push(w[k]![2 * sel + 1]!);
            } else {
              const a = Math.sqrt(s.ab[k]!), b = Math.sqrt(1 - s.ab[k]!);
              xs.push(a * data.X[2 * sel]! + b * eps[2 * sel]!);
              ys.push(a * data.X[2 * sel + 1]! + b * eps[2 * sel + 1]!);
            }
          }
          return [xs, ys];
        };
        const pl = f.plot({
          aspect: 1.3,
          domain: [-3, 3, -2.2, 2.2],
          draw: (pp) => {
            pp.axes({ grid: 1 });
            ghost(pp, data, 0.2);
            const X = pointsAt(t);
            cloud(pp, X, withAlpha(color('purple'), 0.62), 2.1);
            const [fx, fy] = pathOf(T);
            pp.path(fx, fy, withAlpha(color('purple'), 0.25), 1.5);
            const [px, py] = pathOf(t);
            pp.path(px, py, color('purple'), 2.2);
            const x0x = data.X[2 * sel]!, x0y = data.X[2 * sel + 1]!;
            pp.dot(x0x, x0y, 5.5, color('orange'), color('--card'));
            halo(pp, 'x₀', pp.sx(x0x) - 8, pp.sy(x0y) - 8, { color: color('orange'), bold: true, size: 13, align: 'right' });
            if (how === 'jump') {
              const ex = eps[2 * sel]!, ey = eps[2 * sel + 1]!;
              pp.dot(ex, ey, 5, color('teal'), color('--card'));
              halo(pp, 'ε', pp.sx(ex) + 8, pp.sy(ey) + 4, { color: color('teal'), bold: true, size: 14 });
            }
            const cx = px[px.length - 1]!, cy = py[py.length - 1]!;
            pp.dot(cx, cy, 6, color('purple'), color('--card'));
            halo(pp, 'xₜ', pp.sx(cx) + 9, pp.sy(cy) - 7, { color: color('purple'), bold: true, size: 13 });
            halo(pp, `t = ${t}`, pp.w - 10, 18, { align: 'right', mono: true, size: 12, color: color('--ink') });
          },
        });
        pl.canvas.classList.add('scroll-ok');
        const sch = f.plot({
          height: 116,
          square: false,
          domain: [-4, 104, -0.08, 1.12],
          draw: (pp) => {
            const c = pp.ctx;
            c.strokeStyle = color('--grid');
            c.lineWidth = 1;
            for (const v of [0, 0.5, 1]) {
              c.beginPath();
              c.moveTo(pp.sx(0), pp.sy(v));
              c.lineTo(pp.sx(100), pp.sy(v));
              c.stroke();
            }
            for (const [name, s] of Object.entries(scheds)) {
              const on = name === sk;
              const ts = Array.from({ length: T + 1 }, (_, k) => k);
              pp.path(ts, ts.map((k) => Math.sqrt(s.ab[k]!)), on ? color('slate') : withAlpha(color('slate'), 0.3), on ? 2.2 : 1.2, on ? undefined : [4, 4]);
              pp.path(ts, ts.map((k) => Math.sqrt(1 - s.ab[k]!)), on ? color('teal') : withAlpha(color('teal'), 0.3), on ? 2.2 : 1.2, on ? undefined : [4, 4]);
            }
            c.strokeStyle = color('purple');
            c.lineWidth = 1.5;
            c.beginPath();
            c.moveTo(pp.sx(t), pp.sy(-0.06));
            c.lineTo(pp.sx(t), pp.sy(1.1));
            c.stroke();
            halo(pp, '√ᾱₜ  signal', pp.sx(100) - 2, pp.sy(0.08), { align: 'right', size: 11, color: color('slate'), bold: true });
            halo(pp, '√(1 − ᾱₜ)  noise', pp.sx(100) - 2, pp.sy(0.86), { align: 'right', size: 11, color: color('teal'), bold: true });
            halo(pp, 'dashed: the other schedule', pp.sx(24), pp.sy(0.03), { size: 10, color: color('--ink-3') });
          },
        });
        sch.canvas.classList.add('scroll-ok');
        const abRo = f.readout('ᾱₜ', { sym: 'ab' });
        const sync = () => {
          const s = scheds[sk]!;
          const a = Math.sqrt(s.ab[t]!), b = Math.sqrt(1 - s.ab[t]!);
          f.code.setMany({ a: fmt(a, 3), b: fmt(b, 3) });
          abRo.set(fmt(s.ab[t]!, 3));
          f.code.highlight([how, sk === 'linear' ? 'lin' : 'cos']);
          pl.redraw();
          sch.redraw();
        };
        f.slider({ label: 'step t', min: 0, max: T, step: 1, value: t, slot: 't', onInput: (v) => { t = v; sync(); } });
        f.segmented({
          label: 'how',
          options: [
            { value: 'jump', label: 'one jump' },
            { value: 'walk', label: 't small steps' },
          ],
          value: 'jump',
          onChange: (v) => { how = v; sync(); },
        });
        f.segmented({
          label: 'schedule',
          options: [
            { value: 'linear', label: 'linear' },
            { value: 'cosine', label: 'cosine' },
          ],
          value: 'linear',
          onChange: (v) => { sk = v; sync(); },
        });
        pl.canvas.addEventListener('pointerdown', (e) => {
          const [mx, my] = pl.pointer(e);
          const X = pointsAt(t);
          let bi = -1, bd = Infinity;
          for (let i = 0; i < n; i++) {
            const d = (X[2 * i]! - mx) ** 2 + (X[2 * i + 1]! - my) ** 2;
            if (d < bd) { bd = d; bi = i; }
          }
          if (bi >= 0 && pl.len(Math.sqrt(bd)) < 30) {
            sel = bi;
            pl.redraw();
          }
        });
        sync();
      },
      caption: `Faint orange: the clean moons $\\sym{x0}{x_0}$. Purple: the same 1,000 points at step $t$. One point is followed: its path runs from $x_0$ (orange) to its noise $\\epsilon$ (teal), and the lower chart shows the two weights of the mix. Slide $t$: by $t = 20$ the moons are hard to make out, and at $t = 100$ the cloud is a plain bell curve. Switch to **t small steps**: the followed point now takes a jagged random walk, yet the cloud at every $t$ looks the same as with **one jump**, which is the closed form at work. Tap any point to follow it instead. The **cosine** schedule (Nichol and Dhariwal, 2021) destroys the signal more gently, so fewer steps are spent on almost-pure noise.`,
    });

    p.callout('intuition', `Why many small steps instead of one big one? When a step adds only a little noise, undoing it is also a small, nearly Gaussian step: the point moved a short distance, and the network only needs to say where it came from on average. Going back from pure noise to data in a single step would mean producing a whole sample of the data distribution at once, which is the hard problem we started with. Small steps turn one impossible prediction into many easy ones.`, 'Why small steps');

    p.callout('warning', `Papers do not agree on these letters. This chapter follows DDPM (Ho et al., 2020): $\\symbeta$ is one step's noise variance, $\\symalpha = 1 - \\beta_t$, and $\\symab$ is the running product. The DDIM paper writes $\\alpha_t$ for what is $\\bar\\alpha_t$ here, and many later papers write $\\alpha_t$ and $\\sigma_t$ for the two coefficients $\\sqrt{\\bar\\alpha_t}$ and $\\sqrt{1 - \\bar\\alpha_t}$. Before reusing a formula, check which one a paper means.`, 'Notation trap');

    // ---------------------------------------------------------------- training
    p.h2('Training: predict the noise', 'training');
    p.prose(`
To undo a step we need to know which way the data lies. DDPM's answer: train a network $\\symepsth(\\symxt, t)$ that looks at a noisy point and the step number and guesses the noise $\\symeps$ that was mixed in. Training examples are free and endless: take a clean point, pick a random step, draw noise, mix them with the closed form, and ask for the noise back.`);

    p.math({
      label: 'The training loss (DDPM\'s simplified objective)',
      tex: String.raw`\symL = \mathbb{E}_{\sym{x0}{x_0},\,t,\,\symeps}\Big[\big\lVert \symeps - \symepsth\big(\sqrt{\symab}\,\sym{x0}{x_0} + \sqrt{1-\symab}\,\symeps,\; t\big)\big\rVert^2\Big]`,
      code: `
        idx = np.random.randint(0, len(data), 128)
        x0 = data[idx]                              # clean points
        t = np.random.randint(1, T + 1, size=128)   # random steps
        eps = np.random.randn(128, 2)               # noise to hide
        ab = alpha_bar[t][:, None]
        xt = np.sqrt(ab) * x0 + np.sqrt(1 - ab) * eps
        loss = np.mean((eps - model(xt, t)) ** 2)
      `,
      codeTitle: 'loss.py',
      terms: [
        [String.raw`\mathbb{E}_{\sym{x0}{x_0},\,t,\,\symeps}[\cdots]`, 'the *expected value*: the average over random clean points, random steps and random noise. In code, the average over one mini-batch'],
        [String.raw`\sqrt{\symab}\,\sym{x0}{x_0} + \sqrt{1-\symab}\,\symeps`, 'the noisy input $x_t$, built with the closed form'],
        [String.raw`\symepsth(\cdot,\, t)`, 'the network: it sees the noisy point and the step number, never $x_0$ or $\\epsilon$'],
        [String.raw`\lVert \cdots \rVert^2`, 'the squared length of the error vector: squared differences, summed over coordinates'],
      ],
      explain: `A plain mean squared error, the loss of linear regression. No discriminator to balance against (GAN), no KL term to tune (VAE). DDPM derived the loss from a variational bound, like the VAE's, then found that dropping that bound's per-step weights gave better samples; this unweighted version is their "simple" loss. A useful yardstick: a network that always answers zero scores exactly 1 (the variance of $\\epsilon$), so anything below 1 is noise it has actually located.`,
    });

    p.prose(`
The network here is a small multilayer perceptron, the kind from the [neural network chapters](#/nn-architecture). Its only unusual feature is the input layer. The step $t$ goes in as sines and cosines at several frequencies (as Transformers encode positions, and as DDPM encodes $t$), and so does the point itself; this lets a 64-unit network make the sharp turns that two thin moons require.`);

    p.code(`
      def features(xt, t):                  # (B, 2), (B,) -> (B, 26)
          k = 2.0 ** np.arange(3)           # 1, 2, 4
          kx = (xt[:, :, None] * k).reshape(len(xt), 6)
          kt = (t[:, None] / T) * np.pi * 2.0 ** np.arange(6)
          return np.hstack([xt, np.sin(kx), np.cos(kx),
                            np.sin(kt), np.cos(kt)])

      def model(xt, t):                     # eps_theta(xt, t)
          h = features(xt, t)
          h = np.maximum(0, h @ W1 + b1)    # 26 -> 64
          h = np.maximum(0, h @ W2 + b2)    # 64 -> 64
          h = np.maximum(0, h @ W3 + b3)    # 64 -> 64
          return h @ W4 + b4                # 64 -> 2: the noise guess
    `, { title: 'model.py' });

    p.figure({
      title: 'Train a diffusion model in your browser',
      codeTitle: 'train.py',
      code: `
        params = init_mlp([26, 64, 64, 64, 2])  # 10,178
        for step in range(3000):
            idx = np.random.randint(0, len(data), 128)  #@batch
            x0 = data[idx]                              #@batch
            t = np.random.randint(1, T + 1, size=128)   #@batch
            eps = np.random.randn(128, 2)               #@noise
            ab = alpha_bar[t][:, None]                  #@noise
            xt = np.sqrt(ab) * x0 + np.sqrt(1 - ab) * eps  #@noise
            loss, grads = loss_and_grads(params, xt, t, eps)  #@loss
            adam_update(params, grads, cosine_lr(step))   #@upd
        # step {{step:0}}   loss {{loss:…}}
      `,
      setup(f) {
        let data = MOONS;
        const net = new DiffNet({ seed: 1 });
        let tr = new Trainer(net, data);
        const pnet = new DiffNet({ seed: 1 });
        let preview: Sampler | null = null;
        let previewStep = 0;
        let shown: Float32Array | null = null;
        let shownStep = -1;
        let running = false;
        const ema: number[] = [];
        const pl = f.plot({
          aspect: 1.35,
          domain: DOM,
          draw: (pp) => {
            pp.axes({ grid: 1 });
            ghost(pp, data, 0.3);
            if (shown) cloud(pp, shown, withAlpha(color('purple'), 0.8), 2.3);
            legend(pp, [['training data', withAlpha(color('orange'), 0.6)], ['samples (DDPM)', color('purple')]]);
            const msg = shown ? `samples after ${shownStep.toLocaleString()} steps` : 'press Train: samples appear here';
            halo(pp, msg, pp.w - 10, pp.h - 10, { align: 'right', size: 12, color: color('--ink-2') });
            if (preview) halo(pp, `sampling ${Math.round((preview.frames.length / (preview.total + 1)) * 100)}%`, pp.w - 10, 18, { align: 'right', size: 11, color: color('--ink-3') });
          },
        });
        pl.canvas.classList.add('scroll-ok');
        const lp = f.plot({
          height: 120,
          square: false,
          domain: [-150, 3150, -0.12, 1.3],
          draw: (pp) => {
            const c = pp.ctx;
            c.strokeStyle = color('--grid');
            c.lineWidth = 1;
            for (const v of [0, 0.5]) {
              c.beginPath();
              c.moveTo(pp.sx(0), pp.sy(v));
              c.lineTo(pp.sx(3000), pp.sy(v));
              c.stroke();
            }
            pp.path([0, 3000], [1, 1], withAlpha(color('--ink-3'), 0.8), 1, [4, 4]);
            halo(pp, 'always guessing 0', pp.sx(3000), pp.sy(1) - 5, { align: 'right', size: 11, color: color('--ink-3') });
            if (ema.length > 1) pp.path(ema.map((_, i) => i), ema, color('red'), 2);
            for (const v of [0, 1000, 2000, 3000]) halo(pp, String(v), pp.sx(v), pp.h - 3, { align: 'center', size: 10, mono: true, color: color('--ink-3') });
            halo(pp, 'loss (smoothed)', pp.sx(0) + 2, pp.sy(1) + 15, { size: 11, color: color('red'), bold: true });
            halo(pp, '0.5', pp.sx(0) + 2, pp.sy(0.5) - 3, { size: 10, mono: true, color: color('--ink-3') });
          },
        });
        lp.canvas.classList.add('scroll-ok');
        const stepRo = f.readout('step');
        const lossRo = f.readout('loss', { sym: 'L' });
        const labels = ['batch', 'noise', 'loss', 'upd'];
        let phase = 0;
        const loop = f.loop(() => {
          if (running && !tr.done) {
            const before = tr.losses.length;
            tr.slice(7);
            for (let i = before; i < tr.losses.length; i++) {
              const prev = ema.length ? ema[ema.length - 1]! : tr.losses[i]!;
              ema.push(0.97 * prev + 0.03 * tr.losses[i]!);
            }
            f.code.highlight(labels[phase++ % 4]!);
            const l = ema[ema.length - 1]!;
            f.code.setMany({ step: net.steps, loss: fmt(l, 3) });
            stepRo.set(net.steps);
            lossRo.set(fmt(l, 3));
            if (tr.done) {
              running = false;
              btn.textContent = 'Train again';
              f.code.highlight(null);
            }
          }
          if (!preview && shownStep !== net.steps && (net.steps - shownStep >= 300 || !running)) {
            pnet.load(net.save(), net.steps);
            preview = new Sampler(pnet, { kind: 'ddpm', n: 300, seed: 3 });
            previewStep = net.steps;
          }
          if (preview) {
            preview.slice(running ? 4 : 8);
            if (preview.done) {
              shown = preview.last;
              shownStep = previewStep;
              preview = null;
              if (tr.done && shownStep === net.steps) f.status(`Done: ${net.steps.toLocaleString()} steps. The picture shows 300 fresh samples from the finished model.`);
            }
          }
          pl.redraw();
          lp.redraw();
          if (!running && !preview && shownStep === net.steps) return false;
        });
        const reset = () => {
          running = false;
          loop.stop();
          net.reset(1);
          tr = new Trainer(net, data);
          ema.length = 0;
          preview = null;
          shown = null;
          shownStep = -1;
          btn.textContent = 'Train';
          stepRo.set(0);
          lossRo.set('–');
          f.code.setMany({ step: 0, loss: '…' });
          f.code.highlight(null);
          f.status('');
          pl.redraw();
          lp.redraw();
        };
        const btn = f.button('Train', () => {
          if (tr.done) reset();
          running = !running;
          btn.textContent = running ? 'Pause' : 'Train';
          if (!running) f.code.highlight(null);
          loop.start();
        }, { primary: true });
        f.button('Reset', reset);
        f.segmented({
          label: 'data',
          options: [
            { value: 'moons', label: 'two moons' },
            { value: 'spiral', label: 'spiral' },
          ],
          value: 'moons',
          onChange: (v) => {
            data = v === 'moons' ? MOONS : SPIRAL;
            reset();
          },
        });
      },
      caption: `Press **Train**. Each frame runs a few steps of the loop on the left (128 points per step), and every 300 steps the current weights are copied and used to draw 300 samples with the DDPM sampler of the next section. Faint orange is the data; purple is what the model makes from pure noise. The loss (red, smoothed) falls fast from 1 to about 0.2 and then crawls, yet the samples keep sharpening long after the curve looks flat: the remaining error is mostly the unavoidable kind (at high noise nobody can tell which noise was added), so small loss gains carry large quality gains. 3,000 steps take 20 to 40 seconds, depending on the device. Try the **spiral**: a harder shape, same code.`,
    });

    p.prose(`
### Why predict the noise?

The noisy point, the clean point and the noise are tied together by one equation, so knowing any two gives the third. A noise prediction *is* a prediction of the clean point, written differently:`);

    p.math({
      label: 'A noise guess is a denoised guess',
      tex: String.raw`\sym{x0}{\hat{x}_0} = \frac{\symxt - \sqrt{1-\symab}\;\symepsth(\symxt, t)}{\sqrt{\symab}}`,
      code: `
        eps_pred = model(xt, t)
        x0_hat = (xt - np.sqrt(1 - ab) * eps_pred) / np.sqrt(ab)
        # the two errors differ only by a step-dependent scale:
        # x0_hat - x0 == -np.sqrt((1 - ab) / ab) * (eps_pred - eps)
      `,
      codeTitle: 'denoise.py',
      terms: [
        [String.raw`\symxt - \sqrt{1-\symab}\;\symepsth`, 'take the predicted noise back out of the noisy point'],
        [String.raw`\frac{\cdots}{\sqrt{\symab}}`, 'and undo the shrinking of the signal'],
        [String.raw`\sym{x0}{\hat{x}_0}`, 'the network\'s best guess of the clean point (the hat means "estimate")'],
      ],
      explain: `So the choice of target is not about what the network can know, but about how its errors are weighted and how hard the regression is. Predicting $\\epsilon$ has three things going for it. The target has the same scale at every step (a standard Gaussian), so one network serves all noise levels without rescaling. It is a residual: at small $t$ the input is almost the answer, and the network reports only the small difference, magnified to unit size. And measured as an error on $x_0$, the $\\epsilon$ loss weights each step by $\\bar\\alpha_t / (1 - \\bar\\alpha_t)$, the *signal-to-noise ratio*, which emphasizes the nearly clean steps where fine detail gets decided. Ho et al. compared targets and found this one, with the simple loss, gave the best samples.`,
    });

    p.table(
      ['The network predicts', 'Target', 'Seen in'],
      [
        ['the noise', '$\\epsilon$', 'DDPM (2020), Stable Diffusion 1'],
        ['the clean point', '$x_0$', 'a natural choice; weights high-noise steps more'],
        ['"velocity"', '$\\sqrt{\\bar\\alpha_t}\\,\\epsilon - \\sqrt{1-\\bar\\alpha_t}\\,x_0$', 'Salimans and Ho (2022); Stable Diffusion 2\'s 768-pixel model'],
        ['flow velocity', '$\\epsilon - x_0$', 'flow matching and rectified flow (end of this chapter); Stable Diffusion 3'],
      ],
      { caption: 'Four interchangeable targets. Given $x_t$ and $t$, each one determines the others; they differ in how the loss spreads its attention across noise levels.' },
    );

    p.callout('aside', `This is the denoising autoencoder from the [CS231n chapter](#/unsupervised) grown up. Vincent et al. (2008) corrupted inputs and trained a network to reconstruct the clean version, at one fixed noise level. A diffusion model is a denoiser trained at *every* noise level at once and told which level it is facing, and it turns out that is exactly enough to generate.`, 'Old idea, new use');

    // ---------------------------------------------------------------- sampling
    p.h2('Sampling: walking back from noise', 'sampling');
    p.prose(`
Generation runs the process backwards. Start from pure noise $\\sym{xt}{x_T} \\sim \\mathcal{N}(0, I)$. At each step, ask the network for its noise guess, use it to move to a slightly cleaner $\\sym{xt}{x_{t-1}}$, then add back a little fresh noise. After $T$ steps you have a sample.`);

    p.math({
      label: 'One DDPM sampling step',
      tex: String.raw`\sym{xt}{x_{t-1}} = \frac{1}{\sqrt{\symalpha}}\Big(\symxt - \frac{\symbeta}{\sqrt{1-\symab}}\,\symepsth(\symxt, t)\Big) + \sigma_t\, z`,
      code: `
        x = np.random.randn(500, 2)          # x_T: pure noise
        for t in range(T, 0, -1):
            eps_pred = model(x, t)
            x = x - beta[t] / np.sqrt(1 - alpha_bar[t]) * eps_pred
            x = x / np.sqrt(alpha[t])
            if t > 1:
                x = x + np.sqrt(beta[t]) * np.random.randn(500, 2)
      `,
      codeTitle: 'ddpm_sample.py',
      terms: [
        [String.raw`\frac{\symbeta}{\sqrt{1-\symab}}\,\symepsth`, 'subtract a fraction of the predicted noise: the part this one step is responsible for (at $t = 1$, all that is left)'],
        [String.raw`\frac{1}{\sqrt{\symalpha}}`, 'undo this step\'s slight shrink'],
        [String.raw`\sigma_t\, z`, 'fresh Gaussian noise $z$ with $\\sigma_t^2 = \\beta_t$; none at the final step'],
      ],
      explain: `The bracket is the network's estimate of where $x_{t-1}$ lies *on average*, given $x_t$. It comes from a short Gaussian calculation: if we knew $x_0$, the distribution of $x_{t-1}$ given both $x_t$ and $x_0$ would be an exact Gaussian with a known center; plug in the network's estimate of $x_0$ and you get this formula. The fresh noise then draws a point from around that center, because the truth is a spread of possible $x_{t-1}$, not one point. DDPM tried $\\sigma_t^2 = \\beta_t$ and a slightly smaller variance and found they gave similar results.`,
    });

    p.prose(`
That fresh noise looks optional. It is not: averaging, step after step, with nothing to restore the spread, squeezes everything together. The figure lets you remove it.

Even so, 100 network calls per sample (1,000 for DDPM on images) is slow. **DDIM** (Song, Meng and Ermon, 2020) found a deterministic update for the *same trained network*: guess the clean point, then re-noise that guess directly to a lower level, using the network's own noise estimate instead of fresh noise. Because nothing is random, it can skip steps.`);

    p.math({
      label: 'One DDIM step, from level t down to t′',
      tex: String.raw`\begin{aligned} \sym{x0}{\hat{x}_0} &= \big(\symxt - \sqrt{1-\symab}\;\symepsth(\symxt, t)\big) / \sqrt{\symab} \\ \sym{xt}{x_{t'}} &= \sqrt{\sym{ab}{\bar\alpha_{t'}}}\;\sym{x0}{\hat{x}_0} + \sqrt{1-\sym{ab}{\bar\alpha_{t'}}}\;\symepsth(\symxt, t) \end{aligned}`,
      code: `
        ts = np.linspace(T, 0, steps + 1).round().astype(int)
        for t, s in zip(ts[:-1], ts[1:]):     # e.g. 100, 80, 60, ...
            eps_pred = model(x, t)
            ab, ab_next = alpha_bar[t], alpha_bar[s]
            x0_hat = (x - np.sqrt(1 - ab) * eps_pred) / np.sqrt(ab)
            x = np.sqrt(ab_next) * x0_hat + np.sqrt(1 - ab_next) * eps_pred
      `,
      codeTitle: 'ddim_sample.py',
      terms: [
        [String.raw`\sym{x0}{\hat{x}_0}`, 'the current guess of the clean point'],
        [String.raw`t' < t`, 'the next level down, which may be many steps lower'],
        [String.raw`\sqrt{\sym{ab}{\bar\alpha_{t'}}}\;\sym{x0}{\hat{x}_0} + \sqrt{1-\sym{ab}{\bar\alpha_{t'}}}\;\symepsth`, 'the closed form again, mixing the guess with the *predicted* noise at the lower level'],
      ],
      explain: 'It is the forward closed form run in reverse: the network\'s noise estimate plays the role of $\\epsilon$, and the point is re-mixed at a lower noise level. No retraining is needed; DDIM is only a different way to use the same $\\epsilon_\\theta$. On images it gives good samples in 20 to 50 calls instead of 1,000. Because the same starting noise always gives the same output, it also lets you interpolate between samples smoothly. (DDIM has a knob $\\eta$ that adds fresh noise back; $\\eta = 1$ gives a DDPM-like sampler.)',
    });

    p.figure({
      title: 'Sampling, animated',
      codeTitle: 'sample.py',
      code: `
        x = np.random.randn(500, 2)    # x_T: pure noise
        # DDPM: all T = 100 steps
        for t in range(T, 0, -1):                       #@ddpm
            eps_pred = model(x, t)                      #@pred
            coef = beta[t] / np.sqrt(1 - alpha_bar[t])  #@mean
            x = (x - coef * eps_pred) / np.sqrt(alpha[t])  #@mean
            if t > 1 and {{noise:True}}:                #@noise
                z = np.random.randn(500, 2)             #@noise
                x = x + np.sqrt(beta[t]) * z            #@noise

        # DDIM: {{k:20}} calls, no fresh noise
        for t, s in zip(ts[:-1], ts[1:]):               #@ddim
            eps_pred = model(x, t)                      #@dpred
            ab, ab_s = alpha_bar[t], alpha_bar[s]       #@dx0
            x0_hat = (x - np.sqrt(1-ab) * eps_pred) / np.sqrt(ab)  #@dx0
            x = np.sqrt(ab_s) * x0_hat                  #@dx0
            x = x + np.sqrt(1 - ab_s) * eps_pred        #@dx0
        # now at t = {{t:100}}
      `,
      setup(f) {
        const net = model('eps');
        const N = 500;
        const TRACK = 12;
        let kind: 'ddpm' | 'ddim' = 'ddpm';
        let k = 20;
        let noise = true;
        let seed = 3;
        let smp = new Sampler(net, { kind, steps: k, n: N, seed, noise });
        let head = 0;
        let playing = true;
        const at = (i: number, frac: number, j: number): [number, number] => {
          const A = smp.frames[i]!;
          const B = smp.frames[Math.min(i + 1, smp.frames.length - 1)]!;
          return [A[2 * j]! + (B[2 * j]! - A[2 * j]!) * frac, A[2 * j + 1]! + (B[2 * j + 1]! - A[2 * j + 1]!) * frac];
        };
        const cur = new Float32Array(N * 2);
        const pl = f.plot({
          aspect: 1.35,
          domain: [-3, 3, -2.15, 2.15],
          draw: (pp) => {
            pp.axes({ grid: 1 });
            ghost(pp, MOONS, 0.2);
            const i = Math.min(Math.floor(head), smp.frames.length - 1);
            const frac = i < smp.frames.length - 1 ? head - i : 0;
            for (let j = 0; j < N; j++) {
              const [x, y] = at(i, frac, j);
              cur[2 * j] = x;
              cur[2 * j + 1] = y;
            }
            const tail = kind === 'ddpm' ? 8 : smp.total;
            for (let j = 0; j < TRACK; j++) {
              let px = cur[2 * j]!, py = cur[2 * j + 1]!;
              for (let q = i, age = 0; q >= Math.max(0, i - tail); q--, age++) {
                const qx = smp.frames[q]![2 * j]!, qy = smp.frames[q]![2 * j + 1]!;
                pp.path([px, qx], [py, qy], withAlpha(color('purple'), 0.5 * (1 - age / (tail + 1))), 1.3);
                px = qx;
                py = qy;
              }
            }
            cloud(pp, cur, withAlpha(color('purple'), 0.75), 2.2);
            const tNow = smp.times[i]!;
            const label = kind === 'ddpm' ? `DDPM   t = ${tNow}` : `DDIM   call ${i} of ${smp.total}   t = ${tNow}`;
            halo(pp, label, pp.w - 10, 18, { align: 'right', mono: true, size: 12, color: color('--ink') });
          },
        });
        pl.canvas.classList.add('scroll-ok');
        const scrub = f.slider({
          label: 'progress',
          min: 0,
          max: smp.total,
          step: 1,
          value: 0,
          format: (v) => `t = ${smp.times[Math.min(v, smp.times.length - 1)] ?? '…'}`,
          onInput: (v) => {
            playing = false;
            playBtn.textContent = 'Play';
            head = Math.min(v, smp.frames.length - 1);
            sync();
            loop.start();
          },
        });
        const sync = () => {
          const i = Math.min(Math.floor(head), smp.frames.length - 1);
          f.code.set('t', smp.times[i]!, false);
          const sub = head - Math.floor(head);
          if (i >= smp.total) f.code.highlight(null);
          else if (kind === 'ddpm') f.code.highlight(sub < 0.33 ? 'pred' : sub < 0.66 || !noise ? 'mean' : 'noise');
          else f.code.highlight(sub < 0.5 ? 'dpred' : 'dx0');
          scrub.set(i, false);
          pl.redraw();
        };
        const loop = f.loop((dt) => {
          smp.slice(6);
          if (playing) {
            head = Math.min(smp.frames.length - 1, head + dt * (smp.total / 3.6));
            if (head >= smp.total) {
              playing = false;
              playBtn.textContent = 'Play';
            }
          }
          sync();
          if (!playing && smp.done) return false;
        });
        const restart = () => {
          smp = new Sampler(net, { kind, steps: k, n: N, seed, noise });
          scrub.input.max = String(smp.total);
          head = 0;
          playing = true;
          playBtn.textContent = 'Pause';
          loop.start();
        };
        const playBtn = f.button('Pause', () => {
          if (playing) {
            playing = false;
            playBtn.textContent = 'Play';
          } else {
            if (head >= smp.total) head = 0;
            playing = true;
            playBtn.textContent = 'Pause';
            loop.start();
          }
        }, { primary: true });
        f.button('New noise', () => {
          seed++;
          restart();
        });
        f.segmented({
          label: 'sampler',
          options: [
            { value: 'ddpm', label: 'DDPM' },
            { value: 'ddim', label: 'DDIM' },
          ],
          value: 'ddpm',
          onChange: (v) => {
            kind = v;
            restart();
          },
        });
        f.segmented({
          label: 'DDIM calls',
          options: ['50', '20', '10', '5'].map((v) => ({ value: v, label: v })),
          value: '20',
          slot: 'k',
          onChange: (v) => {
            k = Number(v);
            if (kind === 'ddim') restart();
          },
        });
        f.toggle({
          label: 'DDPM fresh noise z',
          value: true,
          onChange: (v) => {
            noise = v;
            f.code.set('noise', v ? 'True' : 'False');
            if (kind === 'ddpm') restart();
          },
        });
        loop.start();
      },
      caption: `500 points start as pure noise and walk to the moons; 12 of them leave trails. The network is the one from the training figure, trained for 3,000 steps with exactly that loop (its weights ship with the page). With **DDPM** the trails jitter, because every step adds fresh noise, and the moons appear late: the last 20 or so steps do the fine work. Now switch off **fresh noise**: all 500 points slide to nearly the same spot, the over-averaging described above. Switch to **DDIM**: the paths become smooth curves and 20 calls do about as well as 100. At 5 calls the moons turn blurry, because each jump is too long for a straight step to follow a curved path. The last section of the chapter is about fixing exactly that.`,
    });

    // ---------------------------------------------------------------- score
    p.h2('The score: arrows toward the data', 'score');
    p.prose(`
What has the network actually learned? At every point of the plane and every noise level it outputs a vector. Flip its sign and it points the way the noisy data gets denser: away from empty space, toward the moons. Statisticians have a name for "the direction in which probability increases fastest": the **score**.`);

    p.callout('math', `A **density** $p(x)$ says how much probability sits near each point: high on the moons, low in between. Its logarithm $\\log p(x)$ has the same hills and valleys, just rescaled. The **gradient** $\\nabla_x$ of a function is the vector of its slopes, one per coordinate (see the [math kit](#/math-kit)): it points uphill. So $\\nabla_x \\log p(x)$ is an arrow at every point telling you which way is "more likely data".`, 'Math help: the gradient of a log-density');

    p.math({
      label: 'The noise prediction is a scaled score',
      tex: String.raw`\nabla_{\symxt} \log p_t(\symxt) \;\approx\; -\frac{\symepsth(\symxt, t)}{\sqrt{1-\symab}}`,
      code: `
        def score(x, t):
            return -model(x, t) / np.sqrt(1 - alpha_bar[t])
      `,
      codeTitle: 'score.py',
      terms: [
        [String.raw`p_t`, 'the density of the data after $t$ steps of noise: the moons, blurred'],
        [String.raw`\nabla_{\symxt} \log p_t`, 'the score: the uphill direction of that blurred density at the point $x_t$'],
        [String.raw`-\symepsth`, 'the predicted noise, reversed: from the noisy point back toward the data'],
        [String.raw`\approx`, 'exact for a perfectly trained network; ours is close'],
      ],
      explain: `Training to predict noise is, up to that scale, training to estimate the score. This is called *denoising score matching* (Vincent, 2011). Song and Ermon (2019) learned scores at many noise levels and generated by walking uphill with small steps plus noise (Langevin dynamics). Song et al. (2021) then showed that DDPM and score models are two discretizations of one continuous-time process, written as a stochastic differential equation, and that a deterministic version (the *probability flow* ODE) produces the same distribution at every noise level. DDIM's update is one way to step along it.`,
    });

    p.figure({
      title: 'The learned vector field',
      codeTitle: 'field.py',
      code: `
        t = {{t:20}}
        gx, gy = np.meshgrid(np.linspace(-2.4, 2.4, 21),
                             np.linspace(-1.6, 1.6, 15))
        x = np.stack([gx.ravel(), gy.ravel()], 1)  # (315, 2)
        eps_pred = model(x, t)                       #@pred
        a, s = np.sqrt(alpha_bar[t]), np.sqrt(1 - alpha_bar[t])
        score = -eps_pred / s                        #@score
        x0_hat = (x - s * eps_pred) / a              #@x0
        # probe ({{px}}, {{py}}) -> x0_hat ({{hx}}, {{hy}})
      `,
      setup(f) {
        const net = model('eps');
        let t = 20;
        let mode: 'score' | 'x0' = 'score';
        const GX = 21, GY = 15;
        const G = new Float32Array(GX * GY * 2);
        for (let j = 0; j < GY; j++)
          for (let i = 0; i < GX; i++) {
            G[2 * (j * GX + i)] = -2.4 + (4.8 * i) / (GX - 1);
            G[2 * (j * GX + i) + 1] = -1.6 + (3.2 * j) / (GY - 1);
          }
        const E = new Float32Array(G.length);
        const probe = new Float32Array([1.55, 1.2]);
        const PE = new Float32Array(2);
        const compute = () => {
          net.predict(G, t / T, null, E);
          net.predict(probe, t / T, null, PE);
        };
        const x0hat = (x: number, e: number) => (x - Math.sqrt(1 - SCHED.ab[t]!) * e) / Math.sqrt(SCHED.ab[t]!);
        const pl = f.plot({
          aspect: 1.35,
          domain: DOM,
          draw: (pp) => {
            pp.axes({ grid: 1 });
            ghost(pp, MOONS, 0.32);
            const sp = 0.24;
            const c = pp.ctx;
            for (let q = 0; q < GX * GY; q++) {
              const x = G[2 * q]!, y = G[2 * q + 1]!;
              const ex = E[2 * q]!, ey = E[2 * q + 1]!;
              if (mode === 'score') {
                const m = Math.hypot(ex, ey) || 1e-9;
                const L = sp * (0.3 + 0.7 * Math.min(1, m / 1.6));
                pp.arrow(x, y, x - (ex / m) * L, y - (ey / m) * L, withAlpha(color('blue'), 0.75), 1.4);
              } else {
                const hx = x0hat(x, ex), hy = x0hat(y, ey);
                pp.path([x, hx], [y, hy], withAlpha(color('slate'), 0.35), 1);
                c.fillStyle = withAlpha(color('orange'), 0.9);
                c.beginPath();
                c.arc(pp.sx(hx), pp.sy(hy), 2, 0, Math.PI * 2);
                c.fill();
              }
            }
            const [px, py] = probe as unknown as [number, number];
            const hx = x0hat(px, PE[0]!), hy = x0hat(py, PE[1]!);
            pp.path([px, hx], [py, hy], color('orange'), 1.5, [5, 4]);
            pp.dot(hx, hy, 5.5, color('orange'), color('--card'));
            hatX0(pp, pp.sx(hx) + 9, pp.sy(hy) + 15);
            const m = Math.hypot(PE[0]!, PE[1]!) || 1e-9;
            pp.arrow(px, py, px - (PE[0]! / m) * 0.45, py - (PE[1]! / m) * 0.45, color('blue'), 2.6);
            pp.dot(px, py, 7, color('purple'), color('--card'));
            halo(pp, 'drag me', pp.sx(px) + 10, pp.sy(py) - 9, { color: color('purple'), size: 11, bold: true });
            halo(pp, `t = ${t}`, pp.w - 10, 18, { align: 'right', mono: true, size: 12, color: color('--ink') });
          },
        });
        const sync = () => {
          compute();
          const hx = x0hat(probe[0]!, PE[0]!), hy = x0hat(probe[1]!, PE[1]!);
          f.code.setMany({ px: fmt(probe[0]!, 2), py: fmt(probe[1]!, 2), hx: fmt(hx, 2), hy: fmt(hy, 2) });
          pl.redraw();
        };
        let drag = false;
        const move = (e: PointerEvent) => {
          const [x, y] = pl.pointer(e);
          probe[0] = Math.max(-2.5, Math.min(2.5, x));
          probe[1] = Math.max(-1.8, Math.min(1.8, y));
          sync();
        };
        pl.canvas.addEventListener('pointerdown', (e) => {
          drag = true;
          pl.canvas.setPointerCapture(e.pointerId);
          move(e);
        });
        pl.canvas.addEventListener('pointermove', (e) => drag && move(e));
        pl.canvas.addEventListener('pointerup', () => (drag = false));
        f.slider({ label: 'noise level t', min: 1, max: T, step: 1, value: t, slot: 't', onInput: (v) => { t = v; sync(); } });
        f.segmented({
          label: 'show',
          options: [
            { value: 'score', label: 'arrows (score)' },
            { value: 'x0', label: 'each point\'s x̂₀' },
          ],
          value: 'score',
          onChange: (v) => {
            mode = v;
            f.code.highlight(v === 'score' ? 'score' : 'x0');
            pl.redraw();
          },
        });
        f.code.highlight('score');
        sync();
      },
      caption: `Blue arrows: the direction of $-\\symepsth$ at 315 grid points, which is the direction of the score. **Drag** the purple probe: its big arrow is the network's opinion at that spot, and the dashed line runs to its denoised guess $\\sym{x0}{\\hat{x}_0}$. At high noise every arrow points roughly at the center. Switch to **each point's x̂₀** at $t = 60$: every guess lands near the middle of the data, because with that much noise the best guess is the average. Lower $t$ and the guesses spread out onto the two curves; sampling is following these arrows while $t$ falls. Above about $t = 80$ the guesses scatter wildly: computing $\\hat{x}_0$ divides by $\\sqrt{\\bar\\alpha_t}$, which is close to 0 there, so the network's small errors are magnified tens to hundreds of times. That is also why a sampler cannot simply jump from pure noise to $\\hat{x}_0$ in one step.`,
    });

    // ---------------------------------------------------------------- guidance
    p.h2('Guidance: steering with a label', 'guidance');
    p.prose(`
So far the model draws from the whole data distribution. To ask for something specific (one moon, a class, or a caption like "a red bicycle"), give the network the request as an extra input: $\\symepsth(\\symxt, t, \\symc)$. For a class this can be a one-hot vector; for text, the output of a text encoder, which the network reads through cross-attention.

Conditioning alone tends to produce samples that follow the request only loosely. **Classifier guidance** (Dhariwal and Nichol, 2021) sharpened them by adding the gradient of a separate classifier trained on noisy images. **Classifier-free guidance** (Ho and Salimans, 2021) made that classifier unnecessary: train *one* network both with and without the condition, by replacing the label with a special "no label" token for, say, 20 percent of training examples. At sampling time, run it both ways and push past the conditional answer.`);

    p.code(`
      NULL = 2                                  # the "no label" slot
      drop = np.random.rand(128) < 0.2          # 20% of the batch
      c = np.where(drop, NULL, labels[idx])     # which moon, or nothing
      loss = np.mean((eps - model(xt, t, c)) ** 2)
    `, { title: 'train_with_dropout.py' });

    p.math({
      label: 'Classifier-free guidance',
      tex: String.raw`\tilde{\epsilon} = \symepsth(\symxt, t, \varnothing) + \symw\,\big(\symepsth(\symxt, t, \symc) - \symepsth(\symxt, t, \varnothing)\big)`,
      code: `
        eps_u = model(x, t, NULL)     # condition dropped
        eps_c = model(x, t, c)        # condition given
        eps_pred = eps_u + w * (eps_c - eps_u)
      `,
      codeTitle: 'cfg.py',
      terms: [
        [String.raw`\varnothing`, '"no condition": the input slot the network learned from the dropped labels'],
        [String.raw`\symepsth(\symxt, t, \symc) - \symepsth(\symxt, t, \varnothing)`, 'what the label changes about the prediction: a direction pointing toward "more like class $c$"'],
        [String.raw`\symw`, 'the guidance scale: 0 ignores the label, 1 is plain conditioning, larger values exaggerate the label\'s effect'],
        [String.raw`\tilde{\epsilon}`, 'the guided noise estimate, used in the sampler in place of $\\epsilon_\\theta$'],
      ],
      explain: `In the score picture, the difference $\\epsilon_\\theta(c) - \\epsilon_\\theta(\\varnothing)$ is, up to scale, minus the gradient of $\\log p(c \\mid x_t)$: an *implicit classifier* obtained from Bayes' rule, since $\\log p(c \\mid x) = \\log p(x \\mid c) - \\log p(x) + \\text{const}$. Guidance with scale $w$ therefore aims at samples from roughly $p(x)\\,p(c \\mid x)^{w}$: for $w > 1$, points that are unmistakably class $c$. The cost is two network calls per step. Conventions differ: Ho and Salimans write $(1 + w)\\epsilon_c - w\\,\\epsilon_\\varnothing$, so their $w$ is this one minus 1. Stable Diffusion's default scale is 7.5 in the convention used here.`,
    });

    p.figure({
      title: 'Classifier-free guidance on two moons',
      codeTitle: 'guided_sample.py',
      code: `
        w = {{w:1}}
        c = {{c:both}}                    # which moon
        x = np.random.randn(200, 2)       # same for every w
        for t, s in zip(ts[:-1], ts[1:]):    # DDIM, 25 calls
            eps_u = model(x, t, NULL)                #@u
            eps_c = model(x, t, c)                   #@c
            eps_pred = eps_u + w * (eps_c - eps_u)   #@mix
            x = ddim_step(x, eps_pred, t, s)         #@upd
        # on the requested moon: {{acc:…}}
        # share of that moon covered: {{cov:…}}
      `,
      setup(f) {
        const net = model('cond');
        const N = 200;
        let w = 1;
        let which = 'both';
        let runs: { c: number; s: Sampler }[] = [];
        let phase = 0;
        const accRo = f.readout('on its moon');
        const covRo = f.readout('moon covered');
        const restart = () => {
          const cs = which === 'both' ? [0, 1] : [Number(which)];
          runs = cs.map((c) => ({ c, s: new Sampler(net, { kind: 'ddim', steps: 25, n: N, seed: 40 + c, cls: c, w }) }));
          accRo.set('…');
          covRo.set('…');
          loop.start();
        };
        const pl = f.plot({
          aspect: 1.35,
          domain: DOM,
          draw: (pp) => {
            pp.axes({ grid: 1 });
            for (let c = 0; c < 2; c++) {
              const pts: number[] = [];
              for (let j = 0; j < MOONS.n; j++) if (MOONS.y[j] === c) pts.push(MOONS.X[2 * j]!, MOONS.X[2 * j + 1]!);
              cloud(pp, pts, withAlpha(color(MOON_COLORS[c]!), 0.13), 2);
            }
            for (const r of runs) cloud(pp, r.s.last, withAlpha(color(MOON_COLORS[r.c]!), 0.85), 2.4);
            legend(pp, [['c = 0: upper moon', color('blue')], ['c = 1: lower moon', color('gold')]]);
            halo(pp, `w = ${w}`, pp.w - 10, pp.h - 10, { align: 'right', mono: true, size: 13, color: color('red'), bold: true });
          },
        });
        pl.canvas.classList.add('scroll-ok');
        const loop = f.loop(() => {
          const t0 = performance.now();
          for (const r of runs) r.s.slice(Math.max(1, 8 - (performance.now() - t0)));
          const done = runs.every((r) => r.s.done);
          f.code.highlight(done ? null : ['u', 'c', 'mix', 'upd'][phase++ % 4]!);
          pl.redraw();
          if (done) {
            let ok = 0, tot = 0, cov = 0;
            for (const r of runs) {
              const lab = nearestLabel(r.s.last, MOONS);
              for (const l of lab) ok += l === r.c ? 1 : 0;
              tot += lab.length;
              cov += coverage(r.s.last, MOONS, r.c) / runs.length;
            }
            const acc = `${Math.round((100 * ok) / tot)}%`;
            const cv = `${Math.round(100 * cov)}%`;
            accRo.set(acc);
            covRo.set(cv);
            f.code.setMany({ acc, cov: cv });
            return false;
          }
        });
        f.slider({ label: 'guidance w', sym: 'w', min: 0, max: 6, step: 0.5, value: 1, slot: 'w', onInput: (v) => { w = v; restart(); } });
        f.segmented({
          label: 'draw',
          options: [
            { value: '0', label: 'upper (c = 0)' },
            { value: '1', label: 'lower (c = 1)' },
            { value: 'both', label: 'both' },
          ],
          value: 'both',
          slot: 'c',
          onChange: (v) => {
            which = v;
            restart();
          },
        });
        restart();
      },
      caption: `One network, trained like the noise predictor above but with the moon's label as an extra input (dropped 20 percent of the time). Each color is 200 samples asked to land on that moon. At $\\symw = 0$ the label is ignored and both colors spread over both moons. At $\\symw = 1$ most samples obey. Push $\\symw$ to 3 and beyond: every sample lands on its own moon, but they pile up on the parts of each moon farthest from the other one, the **moon covered** readout falls, and at $\\symw = 5$ some samples overshoot past the end of the data. That is $p(c \\mid x)^w$ at work: it rewards points that are *unmistakably* class $c$, not points that are typical of it. The classic trade of guidance is fidelity to the condition bought with diversity; image models show it as more literal, more saturated, less varied pictures.`,
    });

    p.prose(`
For text-to-image models, $\\symc$ is the caption's embedding and $\\varnothing$ is the empty caption. A **negative prompt** simply replaces the empty caption with a description of what you do not want, so that guidance pushes away from it.`);

    // ---------------------------------------------------------------- latent
    p.h2('Latent diffusion and diffusion transformers', 'latent');
    p.prose(`
On images, every sampling step runs a large network over every pixel: a 512 by 512 color image is 786,432 numbers, and the network runs 20 to 1,000 times per image. Most of those numbers encode fine texture that a separate, simpler model could handle.

**Latent diffusion** (Rombach et al., 2021, released as Stable Diffusion in 2022) splits the work in two. First train an autoencoder (see [#/unsupervised](#/unsupervised)) whose encoder $\\mathcal{E}$ shrinks an image by a factor $f = 8$ along each side into a small grid of 4-channel vectors, and whose decoder $\\mathcal{D}$ restores it; perceptual and adversarial losses make the decoder put back sharp, realistic texture. Then freeze the autoencoder and run diffusion entirely on latents: the same loss, the same samplers, 48 times fewer numbers. One decoder call at the end turns the generated latent into pixels.`);

    p.math({
      label: 'Latent diffusion: the same loss, on encoded images',
      tex: String.raw`z_0 = \mathcal{E}(\sym{x0}{x_0}), \quad z_t = \sqrt{\symab}\,z_0 + \sqrt{1-\symab}\,\symeps, \quad \symL = \mathbb{E}\big[\lVert \symeps - \symepsth(z_t, t, \symc) \rVert^2\big]`,
      code: `
        z0 = encoder(image)               # (3, 512, 512) -> (4, 64, 64)
        t = np.random.randint(1, T + 1)
        eps = np.random.randn(*z0.shape)
        zt = np.sqrt(alpha_bar[t]) * z0 + np.sqrt(1 - alpha_bar[t]) * eps
        loss = np.mean((eps - model(zt, t, c)) ** 2)
        # generating: sample a latent, decode once at the end
        image = decoder(ddim_sample(model, c, shape=(4, 64, 64)))
      `,
      codeTitle: 'latent_diffusion.py',
      terms: [
        [String.raw`\mathcal{E}(\sym{x0}{x_0})`, 'the frozen encoder: an image becomes a $64 \\times 64 \\times 4$ latent'],
        [String.raw`z_t`, 'noise added in latent space, with the usual closed form'],
        [String.raw`\symepsth(z_t, t, \symc)`, 'the denoiser, now working on latents and reading the caption embedding $c$'],
      ],
      explain: 'Nothing in the diffusion math cares what the coordinates mean, so moving to latents changes only the shapes. The autoencoder handles detail the eye barely notices; the diffusion model spends its capacity on content and layout. For text, Stable Diffusion 1 encoded the caption with CLIP\'s frozen text encoder (see the [contrastive learning chapter](#/contrastive)) and let the denoiser read it through cross-attention layers: queries from the image latent, keys and values from the caption tokens.',
    });

    p.figure({
      title: 'Pixels, latents and tokens',
      codeTitle: 'sizes.py',
      code: `
        H = {{H:512}}               # image side, pixels
        f, C, p = {{f:8}}, {{C:4}}, {{p:2}}    # shrink, channels, patch
        pixels = 3 * H * H          # {{pix}}
        latent = C * (H // f) ** 2  # {{lat}}
        ratio = pixels / latent     # {{ratio}}x fewer numbers
        tokens = (H // f // p) ** 2   # {{tok}} DiT tokens
        pairs = tokens ** 2         # {{pairs}} scores
      `,
      setup(f) {
        let H = 512, fct = 8, C = 4, P = 2;
        const big = (v: number) => (v >= 1e9 ? `${fmt(v / 1e9, 3)} billion` : v >= 1e6 ? `${fmt(v / 1e6, 3)} million` : v.toLocaleString());
        const cv = f.canvas(640, 290, (ctx, w, h) => {
          const font = (s: number, wt = 500, mono = false) => `${wt} ${s}px ${mono ? "'JetBrains Mono Variable', ui-monospace, monospace" : 'system-ui, sans-serif'}`;
          const fs = Math.max(12, Math.min(14, w / 46));
          const small = Math.max(11, fs - 2);
          const pad = 8;
          const off = 4;
          const y0 = fs + 3 * off + 16;
          const side = Math.min((w - 2 * pad - 3 * off - 2 * 70) / 3, h - y0 - 2 * fs - 22);
          const gap = (w - 2 * pad - 3 * side - 3 * off) / 2;
          const xs = [pad, pad + side + gap, pad + 2 * side + 3 * off + 2 * gap];
          // the image (a drawn stand-in)
          const img = ctx.createLinearGradient(0, y0, 0, y0 + side);
          img.addColorStop(0, '#7fb2ec');
          img.addColorStop(0.6, '#cfe3f7');
          img.addColorStop(0.61, '#5f9e4f');
          img.addColorStop(1, '#3f7a3a');
          ctx.fillStyle = img;
          ctx.fillRect(xs[0]!, y0, side, side);
          ctx.fillStyle = '#f2c14e';
          ctx.beginPath();
          ctx.arc(xs[0]! + side * 0.72, y0 + side * 0.25, side * 0.1, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#2f5d2c';
          ctx.beginPath();
          ctx.moveTo(xs[0]!, y0 + side * 0.75);
          ctx.quadraticCurveTo(xs[0]! + side * 0.35, y0 + side * 0.45, xs[0]! + side * 0.7, y0 + side * 0.72);
          ctx.lineTo(xs[0]! + side, y0 + side * 0.68);
          ctx.lineTo(xs[0]! + side, y0 + side);
          ctx.lineTo(xs[0]!, y0 + side);
          ctx.fill();
          // the latent: stacked channel sheets with a cell grid on the front one
          const L = H / fct;
          const cell = side / L;
          for (let s = 3; s >= 0; s--) {
            const ox = xs[1]! + s * off, oy = y0 - s * off;
            ctx.fillStyle = withAlpha(color('purple'), 0.12 + 0.05 * (3 - s));
            ctx.strokeStyle = withAlpha(color('purple'), 0.7);
            ctx.lineWidth = 1;
            ctx.fillRect(ox, oy, side, side);
            ctx.strokeRect(ox, oy, side, side);
          }
          if (cell >= 2.5) {
            ctx.strokeStyle = withAlpha(color('purple'), 0.25);
            ctx.beginPath();
            for (let i = 1; i < L; i++) {
              ctx.moveTo(xs[1]! + i * cell, y0);
              ctx.lineTo(xs[1]! + i * cell, y0 + side);
              ctx.moveTo(xs[1]!, y0 + i * cell);
              ctx.lineTo(xs[1]! + side, y0 + i * cell);
            }
            ctx.stroke();
          }
          // tokens: the latent cut into P x P patches, one highlighted
          const nt = L / P;
          const tc = side / nt;
          ctx.fillStyle = withAlpha(color('blue'), 0.1);
          ctx.fillRect(xs[2]!, y0, side, side);
          if (tc >= 2) {
            ctx.strokeStyle = withAlpha(color('blue'), tc >= 3 ? 0.55 : 0.3);
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 0; i <= nt; i++) {
              ctx.moveTo(xs[2]! + i * tc, y0);
              ctx.lineTo(xs[2]! + i * tc, y0 + side);
              ctx.moveTo(xs[2]!, y0 + i * tc);
              ctx.lineTo(xs[2]! + side, y0 + i * tc);
            }
            ctx.stroke();
          }
          ctx.strokeStyle = color('blue');
          ctx.strokeRect(xs[2]!, y0, side, side);
          ctx.fillStyle = withAlpha(color('blue'), 0.55);
          ctx.fillRect(xs[2]!, y0, Math.max(tc, 2), Math.max(tc, 2));
          // arrows with two-line labels
          const ay = y0 + side * 0.62;
          const arrow = (x0: number, x1: number, l1: string, l2: string) => {
            ctx.strokeStyle = color('--ink-3');
            ctx.fillStyle = color('--ink-3');
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x0, ay);
            ctx.lineTo(x1 - 2, ay);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x1, ay);
            ctx.lineTo(x1 - 7, ay - 4);
            ctx.lineTo(x1 - 7, ay + 4);
            ctx.fill();
            ctx.font = font(small, 500);
            ctx.textAlign = 'center';
            ctx.fillStyle = color('--ink-2');
            ctx.fillText(l1, (x0 + x1) / 2, ay - 8 - (fs - 1));
            ctx.fillText(l2, (x0 + x1) / 2, ay - 8);
          };
          arrow(xs[0]! + side + 6, xs[1]! - 6, 'encoder', `÷${fct}`);
          arrow(xs[1]! + side + 3 * off + 6, xs[2]! - 6, `${P}×${P}`, 'patches');
          ctx.textAlign = 'center';
          ctx.textBaseline = 'alphabetic';
          ctx.fillStyle = color('--ink-2');
          ctx.font = font(fs, 600);
          ctx.fillText('pixels', xs[0]! + side / 2, y0 - 10);
          ctx.fillText('latent', xs[1]! + side / 2 + 1.5 * off, y0 - 3 * off - 10);
          ctx.fillText('tokens', xs[2]! + side / 2, y0 - 10);
          const yl = y0 + side + fs + 8;
          const cols: [number, CanvasTextAlign, string, string][] = [
            [xs[0]!, 'left', `${H}×${H}×3`, (3 * H * H).toLocaleString()],
            [xs[1]! + side / 2 + 1.5 * off, 'center', `${L}×${L}×${C}`, (C * L * L).toLocaleString()],
            [xs[2]! + side, 'right', `${nt}×${nt}`, `${C * P * P} per token`],
          ];
          for (const [x, align, a, b] of cols) {
            ctx.textAlign = align;
            ctx.font = font(fs - 1, 500, true);
            ctx.fillStyle = color('--ink');
            ctx.fillText(a, x, yl);
            ctx.font = font(small, 500);
            ctx.fillStyle = color('--ink-3');
            ctx.fillText(b, x, yl + fs + 4);
          }
        });
        const ratioRo = f.readout('fewer numbers');
        const tokRo = f.readout('tokens');
        const pairRo = f.readout('scores per head');
        const sync = () => {
          const pix = 3 * H * H;
          const lat = C * (H / fct) ** 2;
          const tok = (H / fct / P) ** 2;
          f.code.setMany({ H, f: fct, C, p: P, pix: pix.toLocaleString(), lat: lat.toLocaleString(), ratio: fmt(pix / lat, 3), tok: tok.toLocaleString(), pairs: big(tok * tok) });
          ratioRo.set(`${fmt(pix / lat, 3)}×`);
          tokRo.set(tok.toLocaleString());
          pairRo.set(big(tok * tok));
          cv.redraw();
        };
        cv.canvas.classList.add('scroll-ok');
        f.segmented({ label: 'image side', options: ['256', '512', '1024'].map((v) => ({ value: v, label: v })), value: '512', onChange: (v) => { H = Number(v); sync(); } });
        f.segmented({ label: 'downsample f', options: ['4', '8', '16'].map((v) => ({ value: v, label: v })), value: '8', onChange: (v) => { fct = Number(v); sync(); } });
        f.segmented({ label: 'channels C', options: ['4', '16'].map((v) => ({ value: v, label: v })), value: '4', onChange: (v) => { C = Number(v); sync(); } });
        f.segmented({ label: 'patch p', options: ['1', '2', '4'].map((v) => ({ value: v, label: v })), value: '2', onChange: (v) => { P = Number(v); sync(); } });
        sync();
      },
      caption: `The sizes involved, computed. Stable Diffusion 1 used 512-pixel images with $f = 8$ and 4 latent channels: 786,432 pixel numbers become 16,384 latent numbers. A diffusion transformer then cuts the latent into $p \\times p$ patches, one token each. Try $p = 1$ at 1024 pixels: 16,384 tokens and about 268 million attention scores per head per layer, which is why DiT models use $p = 2$, and why later work invested in better autoencoders (Stable Diffusion 3 uses 16 latent channels instead of 4). (The picture of the latent is a schematic of its shape; a real latent looks like a blurry, false-colored version of the image.)`,
    });

    p.prose(`
### Diffusion transformers

DDPM and Stable Diffusion 1 and 2 used a **U-Net** as the denoiser: a convolutional encoder-decoder with skip connections (the segmentation architecture of Ronneberger et al., 2015), with attention layers added at low resolution. **DiT** (Peebles and Xie, 2022) replaced it with a plain transformer, in the style of the [vision transformer](#/vit): cut the noisy latent into patches, embed each patch as a token, add position embeddings, run standard transformer blocks, and map each output token back to a patch of predicted noise. The step $t$ and the class enter through **adaptive layer norm**: a small network maps them to the scale and shift of every layer norm (in the adaLN-Zero variant, also to gates that start each residual branch at zero, so every block begins as the identity).

The headline result was scaling. Across model sizes and patch sizes, sample quality improved steadily with the transformer's compute per step, the same predictable behavior that made language models grow. Transformers have since become the default backbone: Stable Diffusion 3 (Esser et al., 2024) uses one that processes text and image tokens together, and OpenAI's Sora report (2024) describes a diffusion transformer over patches of compressed video, cut in space and time.`);

    // ---------------------------------------------------------------- flow
    p.h2('Flow matching: straight paths', 'flow-matching');
    p.prose(`
Look again at the first figure. For a fixed pair of a clean point and its noise, the forward path $\\sqrt{\\symab}\\,\\sym{x0}{x_0} + \\sqrt{1-\\symab}\\,\\symeps$ is curved: its two coefficients always satisfy $a^2 + b^2 = 1$, like a cosine and a sine, so the point travels along an arc. A sampler that takes a few long steps cuts across such curves and lands in the wrong place, which is the blur you saw with 5 DDIM calls.

So why not connect data and noise with straight lines? **Flow matching** (Lipman et al., 2022), **rectified flow** (Liu, Gong and Liu, 2022) and **stochastic interpolants** (Albergo and Vanden-Eijnden, 2022) did just that, independently. Use a continuous time $t$ from 0 to 1, put the point on the segment between $\\sym{x0}{x_0}$ and $\\symeps$, and train a network to predict the velocity along it.`);

    p.math({
      label: 'Flow matching with straight paths',
      tex: String.raw`\begin{aligned} \symxt &= (1 - t)\,\sym{x0}{x_0} + t\,\symeps, \qquad t \in [0, 1] \\ \symL &= \mathbb{E}_{\sym{x0}{x_0},\,t,\,\symeps}\big[\lVert \symvth(\symxt, t) - (\symeps - \sym{x0}{x_0}) \rVert^2\big] \end{aligned}`,
      code: `
        t = np.random.rand(128, 1)              # any time in [0, 1]
        eps = np.random.randn(128, 2)
        xt = (1 - t) * x0 + t * eps             # a point on the line
        v_pred = model(xt, t)                   # t goes in as is
        loss = np.mean((v_pred - (eps - x0)) ** 2)
      `,
      codeTitle: 'flow_matching.py',
      terms: [
        [String.raw`(1 - t)\,\sym{x0}{x_0} + t\,\symeps`, 'a straight segment: data at $t = 0$, pure noise at $t = 1$'],
        [String.raw`\symeps - \sym{x0}{x_0}`, 'the velocity along that segment: how $x_t$ changes per unit of $t$. Constant, because the path is straight'],
        [String.raw`\symvth(\symxt, t)`, 'the network\'s velocity guess; it sees only $x_t$ and $t$, never which pair the point came from'],
      ],
      explain: `Same network, same mean squared error, a different target. Because the network cannot see the pair, it learns the *average* velocity of all the lines passing through each point at time $t$. The theory of flow matching shows that following that averaged velocity field carries the whole noise distribution exactly onto the data distribution. Where lines from different pairs cross, the average bends, so the learned paths are much straighter than diffusion's, though not perfectly straight; rectified flow's "reflow" procedure retrains on the model's own (noise, sample) pairs to straighten them further. Papers differ on direction: some put the noise at $t = 0$. Here $t = 1$ is noise, as in Stable Diffusion 3, so that $t$ means "how noisy" throughout the chapter.`,
    });

    p.prose(`
To sample, start at $t = 1$ with pure noise and follow the velocity backwards to $t = 0$ with **Euler steps**: $\\symxt \\leftarrow \\symxt - \\Delta t\\,\\symvth(\\symxt, t)$. Along a straight line an Euler step is exact, however long, so a few steps go a long way.`);

    p.figure({
      title: 'Straight paths need fewer steps',
      codeTitle: 'few_steps.py',
      code: `
        k = {{k:4}}                       # network calls
        x = np.random.randn(300, 2)       # t = 1: noise
        for i in range(k):                          #@floop
            t = 1 - i / k                           #@floop
            v_pred = model(x, t)                    #@fv
            x = x - (1 / k) * v_pred   # Euler step #@fstep

        # or the diffusion model, with DDIM:        #@dd
        x = ddim_sample(eps_model, x_T, calls=k)    #@dd
        # mean distance to nearest data: {{dist:…}}
      `,
      setup(f) {
        const flowNet = model('flow');
        const epsNet = model('eps');
        let which: 'flow' | 'ddim' = 'flow';
        let k = 4;
        let showPaths = true;
        const N = 300;
        const TRACK = 24;
        let smp = new Sampler(flowNet, { kind: 'flow', steps: k, n: N, seed: 5 });
        const pr = new Rng(8);
        const pairs = Array.from({ length: 14 }, () => {
          const j = pr.int(MOONS.n);
          return [MOONS.X[2 * j]!, MOONS.X[2 * j + 1]!, pr.randn(), pr.randn()] as const;
        });
        const distRo = f.readout('distance to data');
        const pl = f.plot({
          aspect: 1.35,
          domain: [-3, 3, -2.15, 2.15],
          draw: (pp) => {
            pp.axes({ grid: 1 });
            ghost(pp, MOONS, 0.22);
            if (showPaths) {
              for (const [ax, ay, ex, ey] of pairs) {
                const xs: number[] = [], ys: number[] = [];
                for (let q = 0; q <= 40; q++) {
                  let a: number, b: number;
                  if (which === 'flow') {
                    a = 1 - q / 40;
                    b = q / 40;
                  } else {
                    const tt = Math.round((q / 40) * T);
                    a = Math.sqrt(SCHED.ab[tt]!);
                    b = Math.sqrt(1 - SCHED.ab[tt]!);
                  }
                  xs.push(a * ax + b * ex);
                  ys.push(a * ay + b * ey);
                }
                pp.path(xs, ys, withAlpha(color('teal'), 0.45), 1.3, [4, 3]);
              }
            }
            const F = smp.frames;
            for (let j = 0; j < TRACK; j++) {
              pp.path(F.map((fr) => fr[2 * j]!), F.map((fr) => fr[2 * j + 1]!), withAlpha(color('purple'), 0.55), 1.3);
              if (F.length <= 9) for (const fr of F) pp.dot(fr[2 * j]!, fr[2 * j + 1]!, 1.8, withAlpha(color('purple'), 0.7));
            }
            cloud(pp, smp.last, withAlpha(color('purple'), 0.8), 2.2);
            const name = which === 'flow' ? 'flow matching, Euler' : 'diffusion, DDIM';
            halo(pp, `${name}: ${smp.frames.length - 1} of ${k} calls`, pp.w - 10, 18, { align: 'right', mono: true, size: 12, color: color('--ink') });
            if (showPaths) halo(pp, which === 'flow' ? 'dashed: straight training paths' : 'dashed: curved training paths', 10, pp.h - 10, { size: 11, color: color('teal') });
          },
        });
        pl.canvas.classList.add('scroll-ok');
        const loop = f.loop(() => {
          smp.slice(8);
          pl.redraw();
          if (smp.done) {
            const d = fmt(offData(smp.last, MOONS), 3);
            distRo.set(d);
            f.code.set('dist', d);
            return false;
          }
        });
        const restart = () => {
          smp = new Sampler(which === 'flow' ? flowNet : epsNet, { kind: which, steps: k, n: N, seed: 5 });
          distRo.set('…');
          f.code.highlight(which === 'flow' ? ['fv', 'fstep'] : 'dd');
          loop.start();
        };
        f.segmented({
          label: 'model',
          options: [
            { value: 'flow', label: 'flow matching' },
            { value: 'ddim', label: 'diffusion (DDIM)' },
          ],
          value: 'flow',
          onChange: (v) => {
            which = v;
            restart();
          },
        });
        f.slider({ label: 'network calls k', min: 1, max: 32, step: 1, value: 4, slot: 'k', onInput: (v) => { k = v; restart(); } });
        f.toggle({ label: 'show training paths', value: true, onChange: (v) => { showPaths = v; pl.redraw(); } });
        restart();
      },
      caption: `Both models start from the same 300 noise points; 24 of them show their whole path, one segment per network call. Teal dashes are training paths from a clean point to its noise: straight for flow matching, bowed for diffusion. With **4 calls** flow matching already draws two clean moons while DDIM's points are still scattered; compare the **distance to data** readouts. At 1 call, flow matching gives a clump at the center: a single step from pure noise can only aim at the average of the data. DDIM's single step flings points far away, because it computes $\\hat{x}_0$ at $t = 100$ by dividing by $\\sqrt{\\bar\\alpha_{100}} \\approx 0.005$ (see the vector-field figure). From about 16 calls on, the two are hard to tell apart. Both networks are the same size and were trained for the same 3,000 steps.`,
    });

    p.prose(`
Diffusion and flow matching are close relatives, not rivals. With Gaussian noise both learn a field that transports noise to data; they differ in the path (arc or line) and in how training weighs the different noise levels, and DDIM is already a deterministic flow along diffusion's curved paths. Stable Diffusion 3 trained rectified-flow transformers at scale and found the straight-path formulation worked well, especially with a sampling of training times that favors the middle of the path. Pushing further, *distillation* and *consistency models* (Song et al., 2023) train networks that jump from noise to data in one to four steps.`);

    p.callout('idea', `
- The **forward process** adds Gaussian noise in small steps with variances $\\symbeta$; with $\\symalpha = 1 - \\beta_t$ and $\\symab$ their running product, any step can be reached in one jump: $\\symxt = \\sqrt{\\symab}\\,\\sym{x0}{x_0} + \\sqrt{1-\\symab}\\,\\symeps$.
- **Training** is regression: predict the noise $\\symeps$ from $\\symxt$ and $t$ with a mean squared error. The noise target has a fixed scale, acts as a residual, and doubles as a denoised guess $\\sym{x0}{\\hat{x}_0}$.
- **Sampling** walks back from pure noise. DDPM adds fresh noise each step (without it, samples collapse); DDIM re-noises with the predicted noise, which is deterministic and allows skipping steps.
- The noise prediction is a scaled **score**, an arrow toward denser data at every noise level.
- **Classifier-free guidance** trains one network with and without the condition and extrapolates with scale $\\symw$: more faithful samples, less diversity.
- **Latent diffusion** runs the same process in an autoencoder's compact latent space; **diffusion transformers** replace the U-Net and scale like language models.
- **Flow matching** connects data and noise with straight lines and predicts a velocity, so a few Euler steps suffice.`, 'Takeaways');

    // ---------------------------------------------------------------- exercises
    p.h2('Build it yourself', 'exercises');
    p.prose(`
1. **The forward process, checked (15 minutes).** In NumPy, build \`beta\`, \`alpha\` and \`alpha_bar\` for the linear schedule with $T = 1000$ and print \`alpha_bar[T]\`. Take one point $x_0 = (1, 1)$, make 100,000 copies, and push them to $t = 500$ two ways: 500 small steps with fresh noise each time, and one jump with the closed form. Compare means and variances, then repeat for the cosine schedule. *Success:* the two methods agree to two decimal places, the variance equals $1 - \\bar\\alpha_t$, and you can say what fraction of $x_0$ survives at $t = 500$ under each schedule.

2. **A 2-D DDPM from scratch.** Use \`sklearn.datasets.make_moons\` (standardize it) and the network of this chapter: Fourier features of $x$ and $t$, three hidden layers of 64, ReLU. Write the training loop with Adam in PyTorch (or NumPy with your own backward pass, as in [the backprop chapter](#/backprop)), then the DDPM sampler. *Success:* the loss settles well below 1, the score of always guessing zero (about 0.2 on this page's moons), and a scatter plot of 1,000 samples traces both moons.

3. **Samplers compared.** With the model from exercise 2, draw samples with DDPM ($T$ calls) and DDIM at 50, 20, 10 and 5 calls, starting each from the same noise. Score each set by the mean distance from a sample to its nearest training point, and plot score against network calls. Then remove DDPM's fresh noise and explain what you see. *Success:* a plot showing DDIM's quality holding up to about 20 calls and degrading below, and a two-sentence explanation of the collapse without noise.

4. **Classifier-free guidance.** Add the moon label as a one-hot input with a third "no label" slot, dropped 20 percent of the time during training. Sample 500 points per class for $w$ in $\\{0, 0.5, 1, 2, 4, 8\\}$. Measure accuracy (the share of samples whose nearest training point has the requested label) and diversity (the standard deviation of the samples' horizontal coordinate). *Success:* a plot with accuracy rising and diversity falling as $w$ grows, and a recommended $w$ with your reason.

5. **Project: flow matching on digits.** Load the 8 by 8 handwritten digits from \`sklearn.datasets.load_digits\` (1,797 images, so a data point has 64 coordinates), scale pixels to $[-1, 1]$, and train a velocity network (an MLP of 256 to 512 units, with Fourier features of $t$) with the flow-matching loss. Sample with 1, 4, 16 and 64 Euler steps and show a grid of results for each; then add class conditioning and classifier-free guidance to generate a requested digit. *Success:* recognizable digits at 16 steps, a clear quality ladder across step counts, and a row of guided samples for each digit 0 to 9.`);
  },
};

export default chapter;

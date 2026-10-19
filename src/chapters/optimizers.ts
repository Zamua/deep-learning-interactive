import type { ChapterDef } from './index';
import type { Fig } from '../core/page';
import { fmt } from '../core/code';
import { type Plot, color, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import type { Color } from '../core/symbols';
import { OPTIMIZERS_SYMBOLS } from '../lib/optimizers-symbols';
import {
  BF16,
  DECAY_SIGMAS,
  FP16,
  type FloatFormat,
  type Mat,
  NS3,
  NS5,
  NS_SPECTRUM,
  RACE_COLOR,
  RACE_LABEL,
  RACE_OPTS,
  RACE_T,
  type RaceOpt,
  type RaceRun,
  type SchedKind,
  decayRun,
  dirError,
  formatRange,
  frob,
  gradLog2Samples,
  gradStream,
  lrAt,
  matmul,
  noisyQuadLoss,
  nsPoly,
  nsStep,
  raceBest,
  raceSetup,
  roundTo,
  scaled,
  singularValues,
  transpose,
  withSpectrum,
} from '../lib/optimizers-math';

const mono = (sz: number, wt = 500) => `${wt} ${sz}px 'JetBrains Mono Variable', ui-monospace, monospace`;
const uiFont = (sz: number, wt = 500) => `${wt} ${sz}px system-ui, -apple-system, sans-serif`;

/** Horizontal grid lines labelled at the left edge, for charts whose axes are not at zero. */
function hgrid(pl: Plot, vals: number[], label: (v: number) => string): void {
  const c = pl.ctx;
  for (const v of vals) {
    const y = Math.round(pl.sy(v)) + 0.5;
    c.strokeStyle = color('--grid');
    c.lineWidth = 1;
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

/** Tick labels along the bottom edge. */
function xticks(pl: Plot, vals: number[], label: (v: number) => string): void {
  const c = pl.ctx;
  c.fillStyle = color('--ink-3');
  c.font = mono(10.5);
  c.textBaseline = 'bottom';
  for (const v of vals) {
    const x = pl.sx(v);
    c.textAlign = x < 20 ? 'left' : x > pl.w - 20 ? 'right' : 'center';
    c.fillText(label(v), x, pl.h - 3);
  }
}

/** A small text tag drawn in CSS px at the top-left corner of a plot. */
function corner(pl: Plot, s: string, col = color('--ink-2'), align: CanvasTextAlign = 'left'): void {
  const c = pl.ctx;
  c.font = uiFont(12, 600);
  c.textAlign = align;
  c.textBaseline = 'top';
  c.fillStyle = col;
  c.fillText(s, align === 'left' ? 8 : pl.w - 8, 7);
}

/** A wrapped row of colored dots and labels under a figure. */
function legend(f: Fig): (items: { k: Color; label: string; note?: string; bold?: boolean }[]) => void {
  const el = document.createElement('div');
  el.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px 14px;font:12.5px system-ui,sans-serif;color:var(--ink-2)';
  f.viz.append(el);
  return (items) => {
    el.innerHTML = items
      .map(
        (it) =>
          `<span style="display:inline-flex;align-items:center;gap:5px;${it.bold ? 'font-weight:650;color:var(--ink)' : ''}"><span style="width:10px;height:10px;border-radius:50%;background:var(--c-${it.k})"></span>${it.label}${it.note ? ` <span style="font-family:var(--font-mono);font-size:11.5px;color:var(--ink-3)">${it.note}</span>` : ''}</span>`,
      )
      .join('');
  };
}

/** Draws "2" with a raised exponent, centered at data point (x, y) with its top at y. */
function pow2(pl: Plot, e: number, x: number, y: number): void {
  const c = pl.ctx;
  c.font = mono(11);
  const wb = c.measureText('2').width;
  c.font = mono(9);
  const we = c.measureText(String(e)).width;
  const x0 = pl.sx(x) - (wb + we) / 2;
  const y0 = pl.sy(y);
  c.fillStyle = color('--ink-3');
  c.textAlign = 'left';
  c.textBaseline = 'top';
  c.font = mono(11);
  c.fillText('2', x0, y0 + 3);
  c.font = mono(9);
  c.fillText(String(e), x0 + wb, y0);
}

const sci = (v: number) => (v === 0 ? '0' : Math.abs(v) >= 1e-3 && Math.abs(v) < 1e4 ? fmt(v, 3) : v.toExponential(1).replace('e+', 'e'));
const pct = (v: number) => (v === 0 ? '0%' : v < 0.001 ? '<0.1%' : `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`);


const chapter: ChapterDef = {
  symbols: OPTIMIZERS_SYMBOLS,

  render(p) {
    p.prose(`
In 2016 the advice for training a network fit in one line: use Adam, and decay the learning rate in steps. A decade later, a large language model is trained with a recipe that has five or six moving parts, and every one of them exists because something broke at scale. Adam's weight decay turned out to be subtly wrong. Fixed schedules gave way to a warmup and a long smooth decay. A single bad batch could throw a billion-parameter run off a cliff, so gradients get clipped. Arithmetic moved to 16-bit numbers, which need their own care. And in late 2024 a new optimizer, **Muon**, showed that treating a weight matrix as a *matrix*, rather than a bag of independent numbers, trains transformers faster.

This chapter builds each piece from the ground up: AdamW, warmup with cosine and warmup-stable-decay schedules, gradient clipping, mixed precision, and then Muon in depth, from the matrix picture that motivates it to the Newton-Schulz iteration that makes it cheap. It assumes the update rules from [Chapter 9 of CS231n](#/nn-learning): SGD, momentum and Adam.`);

    // ------------------------------------------------------------------ AdamW
    p.h2('Weight decay, decoupled: AdamW', 'adamw');
    p.prose(`
Recall Adam (from [the CS231n chapter on training](#/nn-learning)). It keeps two moving averages per parameter: $\\symM$, a smoothed gradient (momentum), and $\\symv$, a smoothed *squared* gradient, a running estimate of how large this parameter's gradients usually are. Each step moves the parameter by $\\symM$ divided by $\\sqrt{\\symv}$: every parameter takes a step of about the same size, whether its gradients are huge or tiny.

The CS231n course added **L2 regularization** to the loss, $\\tfrac{\\symlam}{2}\\lVert \\symW \\rVert^2$, whose gradient is $\\symlam\\symW$. With plain SGD that extra gradient term does exactly one thing: every step, every weight shrinks by the same factor $1 - \\symlr\\symlam$. That is why L2 regularization is also called **weight decay**. For SGD the two names describe the same update.

For Adam they do not. If the $\\symlam\\symW$ term goes into the gradient, it also goes through Adam's division by $\\sqrt{\\symv}$. A weight whose data gradients are large has a large $\\sqrt{\\symv}$, so its decay is divided by a large number and nearly vanishes. A weight whose data gradients are tiny has a tiny $\\sqrt{\\symv}$, so its decay is *amplified*. How strongly each weight is regularized ends up depending on the size of its gradients, which is not what anyone asked for. Loshchilov and Hutter (2017) pointed this out and proposed the fix: take the decay out of the gradient and apply it to the weights directly, after the Adam step. That is **AdamW**.`);

    p.math({
      label: 'Adam with L2, versus AdamW',
      tex: String.raw`\begin{aligned}
\text{Adam + L2:}\quad & \symG \leftarrow \nabla L + \symlam\,\symW, \qquad \symW \leftarrow \symW - \symlr\,\frac{\hat\symM}{\sqrt{\hat\symv} + \epsilon} \\[4pt]
\text{AdamW:}\quad & \symG \leftarrow \nabla L, \qquad\qquad\ \ \, \symW \leftarrow \symW - \symlr\left(\frac{\hat\symM}{\sqrt{\hat\symv} + \epsilon} + \symlam\,\symW\right)
\end{aligned}`,
      code: `
        # both: m, v are Adam's moving averages of g and g**2,
        # m_hat, v_hat their bias-corrected versions
        # Adam + L2: decay goes into the gradient
        g = grad + wd * w
        m = beta1 * m + (1 - beta1) * g
        v = beta2 * v + (1 - beta2) * g ** 2
        w -= lr * m_hat / (np.sqrt(v_hat) + eps)

        # AdamW: decay skips the normalization
        g = grad
        m = beta1 * m + (1 - beta1) * g
        v = beta2 * v + (1 - beta2) * g ** 2
        w -= lr * (m_hat / (np.sqrt(v_hat) + eps) + wd * w)
      `,
      codeTitle: 'adamw.py',
      terms: [
        [String.raw`\nabla L`, 'the gradient of the data loss alone'],
        [String.raw`\symlam\,\symW`, 'the weight decay term: each weight times the decay strength $\\symlam$ (`wd`)'],
        [String.raw`\hat\symM / \sqrt{\hat\symv}`, "Adam's normalized step: the smoothed gradient divided by its typical size, so it is about the same size for every parameter"],
        [String.raw`\symlr\,\symlam\,\symW`, 'in AdamW, the decay is added *after* the division: every weight shrinks by the same fraction $\\symlr\\symlam$ per step'],
      ],
      explain: `The two lines differ only in where $\\symlam\\symW$ goes. Inside the gradient, it is divided by $\\sqrt{\\hat\\symv}$, a different number for every weight. Outside, it is not. AdamW also makes the two hyperparameters easier to tune: the best $\\symlr$ and the best $\\symlam$ stop depending so strongly on each other. Today AdamW is the default for training transformers, typically with $\\beta_1 = 0.9$, $\\beta_2 = 0.95$ and $\\symlam = 0.1$, and decay applied only to weight matrices, not to biases or normalization gains. In PyTorch the decay term is multiplied by the current learning rate, so it follows the schedule of the next section.`,
    });

    p.figure({
      title: 'Five weights, two ways to decay them',
      codeTitle: 'adamw_vs_l2.py',
      code: `
        def run(decoupled, wd={{wd:0.5}}, lr=0.01):
            w = np.ones(5)
            scale = np.array([0.003, 0.03, 0.3, 3, 30])
            m, v = np.zeros(5), np.zeros(5)
            for t in range(1, 301):
                g = scale * (-1) ** t  # noise only  #@noise
                if not decoupled:
                    g = g + wd * w     # L2 term     #@l2
                m = 0.9 * m + 0.1 * g                #@adam
                v = 0.999 * v + 0.001 * g ** 2       #@adam
                m_hat = m / (1 - 0.9 ** t)           #@adam
                v_hat = v / (1 - 0.999 ** t)         #@adam
                w -= lr * m_hat / (np.sqrt(v_hat) + 1e-8)  #@adam
                if decoupled:
                    w -= lr * wd * w   # AdamW       #@aw
            return w

        run(False)  # [{{l2}}]
        run(True)   # [{{aw}}]
      `,
      setup(f) {
        let wd = 0.5;
        let L2 = decayRun('l2', wd);
        let AW = decayRun('adamw', wd);
        let shown = 300;
        const cols: Color[] = ['blue', 'orange', 'green', 'purple', 'red'];
        const panel = (title: string, tr: () => number[][]) =>
          f.plot({
            aspect: 2.3,
            square: false,
            domain: [-26, 306, -0.14, 1.16],
            draw: (pl) => {
              hgrid(pl, [0, 0.5, 1], (v) => fmt(v, 2));
              const xs = Array.from({ length: shown + 1 }, (_, i) => i);
              const data = tr();
              for (let i = data.length - 1; i >= 0; i--) pl.path(xs, data[i]!.slice(0, shown + 1), withAlpha(color(cols[i]!), 0.95), 3.2 - i * 0.35);
              if (data === AW) {
                const ref = xs.map((t) => (1 - 0.01 * wd) ** t);
                pl.path(xs, ref, color('--ink'), 1, [3, 4]);
              }
              corner(pl, title, color('--ink'), 'right');
              pl.ctx.font = mono(10.5);
              pl.ctx.fillStyle = color('--ink-3');
              pl.ctx.textAlign = 'right';
              pl.ctx.textBaseline = 'bottom';
              pl.ctx.fillText(`step ${shown}`, pl.w - 6, pl.h - 3);
            },
          });
        const a = panel('Adam + L2', () => L2);
        const b = panel('AdamW', () => AW);
        const leg = legend(f);
        leg(DECAY_SIGMAS.map((s, i) => ({ k: cols[i]!, label: `gradient size ${s}` })));
        const sync = () => {
          f.code.setMany({
            l2: L2.map((t) => fmt(t[300]!, 2)).join(', '),
            aw: AW.map((t) => fmt(t[300]!, 2)).join(', '),
          });
        };
        const loop = f.loop(() => {
          shown = Math.min(300, shown + 4);
          f.code.highlight(['noise', 'l2', 'adam', 'aw'][Math.floor(shown / 12) % 4]!);
          a.redraw();
          b.redraw();
          if (shown >= 300) {
            f.code.highlight(null);
            return false;
          }
        });
        f.slider({
          label: 'weight decay λ',
          sym: 'lam',
          min: 0.05,
          max: 1.5,
          step: 0.05,
          value: 0.5,
          slot: 'wd',
          format: (v) => fmt(v, 2),
          onInput: (v) => {
            wd = v;
            L2 = decayRun('l2', wd);
            AW = decayRun('adamw', wd);
            sync();
            a.redraw();
            b.redraw();
          },
        });
        f.button('Replay', () => {
          shown = 0;
          loop.start();
        }, { primary: true, icon: 'play' });
        sync();
      },
      caption: `Five weights start at 1. Their gradients are pure noise that flips sign every step, from tiny (size 0.003, blue) to large (size 30, red), so the only force with a direction is weight decay. **Top:** with L2 inside Adam, the weights with tiny gradients are decayed to zero within about a hundred steps, while the one with large gradients barely moves: regularization strength now depends on gradient size. **Bottom:** AdamW shrinks all five along the same curve, $(1 - \\symlr\\symlam)^t$ (dashed), and the five lines sit on top of each other. Press **Replay**, and move $\\symlam$ to see that the mismatch is not a matter of tuning.`,
    });

    // ------------------------------------------------------------------ schedules
    p.h2('Warmup, cosine decay and warmup-stable-decay', 'schedules');
    p.prose(`
CS231n decayed the learning rate in steps: train, halve it, train, halve it. Large training runs now use one of two smooth shapes, and both start with a **warmup**.

**Why warm up.** At step zero the weights are random, the gradients are large and change direction quickly, and Adam's estimate $\\symv$ is based on only a handful of gradients, so it is noisy. A full-size step in that state can push the network into a region where the loss spikes or diverges, especially in deep transformers. Ramping the learning rate linearly from almost zero over the first few hundred or few thousand steps gives the optimizer statistics time to settle and the network time to move somewhere calmer before the steps get big. Goyal et al. (2017) used it to train ImageNet models with huge batches, and the original Transformer paper used a warmup too. How much a model needs depends on its architecture: pre-norm transformers (see [the modern block](#/modern-transformer)) need far less than the original post-norm design.

**Why decay.** A mini-batch gradient is noisy, so at a constant learning rate the weights never settle: they rattle around the bottom of the loss at a level set by the step size, the "noise floor" from CS231n's annealing figure. Lowering the learning rate at the end lowers the floor. **Cosine decay** (from SGDR, Loshchilov and Hutter, 2016) follows half a cosine wave from the peak down to a small final value; GPT-3, Chinchilla and Llama all used it, decaying to about 10% of the peak. Its catch is that it needs the total length $T$ in advance: stop early or train longer than planned, and the schedule is wrong for the run you actually did.

**Warmup-stable-decay** (WSD, named by the MiniCPM authors in 2024; similar shapes had been used before) holds the peak learning rate flat for most of training and then decays quickly over the last 10 to 20% of steps. The loss drops sharply during that final decay. Because the stable phase does not depend on $T$, you can save a checkpoint anywhere in it and branch off a short decay to get a finished model for any budget, which makes it cheap to train a family of models or to keep extending a run.`);

    p.math({
      label: 'Linear warmup, then cosine or WSD',
      tex: String.raw`\symlr_t = \begin{cases} \symlr_{\max}\,\dfrac{t+1}{t_w} & t < t_w \quad\text{(warmup)} \\[8pt] \symlr_{\min} + \tfrac12(\symlr_{\max} - \symlr_{\min})\big(1 + \cos(\pi\,\tfrac{t - t_w}{T - t_w})\big) & \text{cosine} \\[8pt] \symlr_{\max} \ \text{until } t_d, \ \text{then linearly down to } \symlr_{\min} \text{ at } T & \text{WSD} \end{cases}`,
      code: `
        def lr_at(t, T, peak, warm, final, sched, t_d=None):
            if t < warm:
                return peak * (t + 1) / warm          # warmup
            if sched == "cosine":
                p = (t - warm) / (T - warm)           # 0 -> 1
                return final + (peak - final) * 0.5 * (1 + np.cos(np.pi * p))
            if t < t_d:                               # WSD: stable
                return peak
            p = (t - t_d) / (T - t_d)                 # WSD: decay
            return final + (peak - final) * (1 - p)
      `,
      codeTitle: 'schedules.py',
      terms: [
        [String.raw`t_w`, 'the number of warmup steps'],
        [String.raw`\symlr_{\max}\frac{t+1}{t_w}`, 'a straight ramp from almost zero up to the peak learning rate'],
        [String.raw`\frac{t - t_w}{T - t_w}`, 'how far through the decay we are, from 0 to 1, where $T$ is the total number of steps'],
        [String.raw`\tfrac12(1 + \cos(\pi \cdot))`, 'half a cosine wave: starts at 1, falls slowly, fastest in the middle, and flattens out at 0'],
        [String.raw`t_d`, 'WSD only: the step where the decay begins, typically 80 to 90% of the way through'],
      ],
      explain: 'Cosine spends a long time at moderately high learning rates and eases into the end. WSD spends as long as possible at the peak, then cools down fast. Both reach a small final rate, which is what pulls the loss below the noise floor. The figure below runs each schedule on a toy problem where that noise floor is easy to see.',
    });

    p.figure({
      title: 'Schedules and the loss they produce',
      codeTitle: 'schedule_toy.py',
      code: `
        T, peak = 1000, 0.9
        warm, final = {{warm:50}}, {{final:0}} * peak
        t_d = int(T * (1 - {{decay:0.2}}))   # WSD decay start
        sched = "{{sched:cosine}}"
        lrs = [lr_at(t, T, peak, warm, final, sched, t_d)  #@lr
               for t in range(T)]                          #@lr

        # SGD on a noisy quadratic: 40 directions with
        # curvature h, gradient noise proportional to h.
        # Expected squared error per direction, exactly:
        for lr in lrs:
            x2 = (1 - lr * h) ** 2 * x2 + lr ** 2 * noise * h  #@loss
        loss = 0.5 * np.sum(h * x2)   # final: {{loss}}         #@loss
      `,
      setup(f) {
        const T = 1000;
        const o = { T, warm: 50, decay: 0.2, minRatio: 0 };
        let sel: SchedKind = 'cosine';
        const kinds: SchedKind[] = ['constant', 'cosine', 'wsd'];
        const kcol: Record<SchedKind, Color> = { constant: 'slate', cosine: 'blue', wsd: 'purple' };
        const klabel: Record<SchedKind, string> = { constant: 'constant', cosine: 'cosine', wsd: 'WSD' };
        let lrs: Record<SchedKind, number[]> = { constant: [], cosine: [], wsd: [] };
        let losses: Record<SchedKind, number[]> = { constant: [], cosine: [], wsd: [] };
        const recompute = () => {
          for (const k of kinds) {
            lrs[k] = Array.from({ length: T }, (_, t) => lrAt(k, t, o));
            losses[k] = noisyQuadLoss(lrs[k]);
          }
        };
        recompute();
        const xs = Array.from({ length: T + 1 }, (_, i) => i);
        const top = f.plot({
          aspect: 2.6,
          square: false,
          domain: [-95, T + 15, -0.08, 1.3],
          draw: (pl) => {
            hgrid(pl, [0, 0.5, 1], (v) => (v === 1 ? 'peak' : fmt(v, 2)));
            for (const k of kinds) if (k !== sel) pl.path(xs.slice(0, T), lrs[k], withAlpha(color(kcol[k]), 0.35), 1.5);
            pl.path(xs.slice(0, T), lrs[sel], color(kcol[sel]), 3);
            if (sel === 'wsd') {
              const td = Math.round(T * (1 - o.decay));
              pl.path([td, td], [-0.08, 1.1], withAlpha(color('--ink'), 0.5), 1, [3, 4]);
            }
            corner(pl, 'learning rate', color('slate'), 'right');
          },
        });
        const bot = f.plot({
          aspect: 2.0,
          square: false,
          domain: [-95, T + 15, -3.5, 0.75],
          draw: (pl) => {
            hgrid(pl, [-3, -2, -1, 0], (v) => `1e${v}`);
            for (const k of kinds) if (k !== sel) pl.path(xs, losses[k].map((v) => Math.log10(v)), withAlpha(color(kcol[k]), 0.35), 1.5);
            pl.path(xs, losses[sel].map((v) => Math.log10(v)), color(kcol[sel]), 3);
            corner(pl, 'expected loss (log scale)', color('red'), 'right');
            xticks(pl, [0, 250, 500, 750, 1000], (v) => (v === 0 ? '' : String(v)));
          },
        });
        const leg = legend(f);
        const sync = () => {
          f.code.set('loss', fmt(losses[sel][T]!, 3));
          f.code.highlight(['lr', 'loss']);
          leg(kinds.map((k) => ({ k: kcol[k], label: klabel[k], note: `final ${fmt(losses[k][T]!, 2)}`, bold: k === sel })));
          top.redraw();
          bot.redraw();
        };
        f.segmented({
          label: 'schedule',
          options: kinds.map((k) => ({ value: k, label: klabel[k] })),
          value: 'cosine',
          slot: 'sched',
          onChange: (v) => {
            sel = v;
            sync();
          },
        });
        f.slider({ label: 'warmup', sym: 'lr', min: 0, max: 200, step: 10, value: 50, slot: 'warm', onInput: (v) => { o.warm = Math.max(1, v); recompute(); sync(); } });
        f.slider({ label: 'WSD decay', min: 0.05, max: 0.5, step: 0.05, value: 0.2, slot: 'decay', format: (v) => fmt(v, 2), onInput: (v) => { o.decay = v; recompute(); sync(); } });
        f.slider({ label: 'final lr', min: 0, max: 0.3, step: 0.05, value: 0, slot: 'final', format: (v) => fmt(v, 2), onInput: (v) => { o.minRatio = v; recompute(); sync(); } });
        sync();
      },
      caption: `**Top:** the learning rate over 1,000 steps for the selected schedule (bold) and the other two (faint). **Bottom:** the expected loss of SGD on a noisy quadratic, a standard toy for studying schedules, computed exactly rather than sampled. A constant rate stalls on its noise floor. Cosine pulls the loss down gradually. WSD sits on the constant curve until its decay begins (dashed line), then drops steeply and ends as low as cosine. Try a short WSD decay (0.05) or a final rate of 0.3 of the peak: either leaves loss on the table. This toy has no unstable early phase, so warmup only delays it slightly here; in a real network, skipping warmup is what risks the early divergence described above.`,
    });

    // ------------------------------------------------------------------ clipping
    p.h2('Gradient clipping by global norm', 'clipping');
    p.prose(`
Most steps of a large training run look alike. A few do not: an unusual batch, a burst of large attention scores, or a sharp "cliff" in the loss surface produces a gradient many times larger than usual. With plain SGD, one such gradient can throw the weights far away in a single step. With Adam the damage is subtler but lasting: the spike inflates $\\symM$ and $\\symv$, the next step is several times too large, and the inflated $\\symv$ then shrinks every step for that parameter until it decays away.

**Gradient clipping** puts a ceiling on the step. Compute the **global norm**: the square root of the sum of the squares of every gradient entry in the whole model, all layers together. If it exceeds a threshold $c$, scale the *entire* gradient down so its norm is exactly $c$. Pascanu, Mikolov and Bengio (2013) introduced it for recurrent networks, whose gradients explode easily (see [the RNN chapter](#/rnn)); it is now standard for transformers, almost always with $c = 1.0$ (GPT-3 and Llama both used it).`);

    p.math({
      label: 'Clip by global norm',
      tex: String.raw`\lVert \symG \rVert = \sqrt{\textstyle\sum_{\text{all params}} \symG_{ij}^2}, \qquad \symG \leftarrow \symG \cdot \min\!\left(1,\ \frac{c}{\lVert \symG \rVert}\right)`,
      code: `
        def clip_grad_norm(grads, max_norm=1.0):
            total = np.sqrt(sum(np.sum(g ** 2) for g in grads))
            scale = min(1.0, max_norm / (total + 1e-6))
            return [g * scale for g in grads], total

        # PyTorch: one call, after backward, before the step
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
      `,
      codeTitle: 'clip.py',
      terms: [
        [String.raw`\sum_{\text{all params}} \symG_{ij}^2`, 'square every entry of every gradient in the model and add them all up'],
        [String.raw`\lVert \symG \rVert`, 'the global norm: the length of the whole gradient, viewed as one long vector'],
        [String.raw`\min(1, c / \lVert\symG\rVert)`, 'a shrink factor: 1 (no change) when the norm is below $c$, otherwise exactly enough to bring it down to $c$'],
      ],
      explain: 'Multiplying every entry by the same number keeps the gradient pointing the same way; only its length changes. That is the point of using the *global* norm: clipping each layer separately, or each entry separately, would change the relative sizes of the pieces and so the direction of the step. Training logs usually track the global norm too, because a rising norm is often the first sign of instability.',
    });

    p.figure({
      title: 'Clipping a stream of gradients',
      codeTitle: 'clip_stream.py',
      code: `
        max_norm = {{c:1.0}}
        for step, (gA, gB) in enumerate(stream):  # 2 layers
            total = np.sqrt(gA ** 2 + gB ** 2)          #@norm
            scale = min(1.0, max_norm / (total + 1e-6)) #@scale
            gA, gB = gA * scale, gB * scale  # same dir  #@clip
        # step {{step}}: g = [{{g0}}, {{g1}}]
        # norm {{nrm}}, scale {{sc}}

        # per-value clipping, for contrast: bends it
        g_val = np.clip([gA, gB], -max_norm, max_norm)  #@val
      `,
      setup(f) {
        const stream = gradStream(200);
        const N = stream.length;
        const norms = stream.map(([a, b]) => Math.hypot(a, b));
        let c = 1;
        const bendOf = ([a, b]: [number, number], cc: number) => {
          const va = Math.max(-cc, Math.min(cc, a)), vb = Math.max(-cc, Math.min(cc, b));
          return Math.abs(Math.atan2(vb, va) - Math.atan2(b, a)) * (180 / Math.PI);
        };
        let sel = 0;
        stream.forEach((gg, i) => {
          if (norms[i]! > 2 && norms[i]! < 4.2 && bendOf(gg, 1) > bendOf(stream[sel]!, 1)) sel = i;
        });
        let custom: [number, number] | null = null;
        const g = (): [number, number] => custom ?? stream[sel]!;
        const bars = f.plot({
          aspect: 3.2,
          square: false,
          domain: [-18, N + 1, -0.15, Math.max(...norms) * 1.08],
          draw: (pl) => {
            hgrid(pl, [0, 2, 4], (v) => fmt(v, 2));
            const bw = Math.max(1, pl.len(1) - 0.6);
            for (let i = 0; i < N; i++) {
              const x = pl.sx(i + 0.5) - bw / 2;
              const n = norms[i]!;
              const kept = Math.min(n, c);
              pl.ctx.fillStyle = withAlpha(color('teal'), i === sel && !custom ? 1 : 0.55);
              pl.ctx.fillRect(x, pl.sy(kept), bw, pl.sy(0) - pl.sy(kept));
              if (n > c) {
                pl.ctx.fillStyle = withAlpha(color('red'), i === sel && !custom ? 0.75 : 0.3);
                pl.ctx.fillRect(x, pl.sy(n), bw, pl.sy(kept) - pl.sy(n));
              }
            }
            pl.path([-1, N + 1], [c, c], color('red'), 1.5, [5, 4]);
            if (!custom) {
              const x = pl.sx(sel + 0.5);
              const y = pl.sy(norms[sel]!) - 4;
              pl.ctx.fillStyle = color('--ink');
              pl.ctx.beginPath();
              pl.ctx.moveTo(x, y);
              pl.ctx.lineTo(x - 5, y - 8);
              pl.ctx.lineTo(x + 5, y - 8);
              pl.ctx.closePath();
              pl.ctx.fill();
            }
            corner(pl, 'global norm per step (tap a bar)', color('--ink-2'), 'right');
          },
        });
        bars.canvas.classList.add('scroll-ok');
        bars.canvas.addEventListener('pointerdown', (e) => {
          const [x] = bars.pointer(e);
          sel = Math.max(0, Math.min(N - 1, Math.floor(x)));
          custom = null;
          sync();
        });
        const plane = f.plot({
          aspect: 1.25,
          domain: [-1.6, 4.6, -1.6, 3.4],
          draw: (pl) => {
            pl.axes({ grid: 1 });
            const ctx = pl.ctx;
            ctx.strokeStyle = withAlpha(color('red'), 0.7);
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.arc(pl.sx(0), pl.sy(0), pl.len(c), 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = withAlpha(color('slate'), 0.75);
            ctx.strokeRect(pl.sx(-c), pl.sy(c), pl.len(2 * c), pl.len(2 * c));
            ctx.setLineDash([]);
            const [a, b] = g();
            const n = Math.hypot(a, b);
            const s = Math.min(1, c / (n + 1e-6));
            const va = Math.max(-c, Math.min(c, a)), vb = Math.max(-c, Math.min(c, b));
            if (s < 1) pl.arrow(0, 0, a, b, withAlpha(color('teal'), 0.35), 2);
            if (s < 1) pl.arrow(0, 0, va, vb, color('slate'), 2.2);
            pl.arrow(0, 0, a * s, b * s, color('teal'), 3);
            pl.text('layer A gradient', pl.view()[1] - 0.08, -0.12, { align: 'right', base: 'top', size: 11, color: color('--ink-3') });
            pl.text('layer B', 0.1, pl.view()[3] - 0.1, { align: 'left', base: 'top', size: 11, color: color('--ink-3') });
          },
        });
        legend(f)([
          { k: 'teal', label: 'clipped by global norm' },
          { k: 'slate', label: 'clipped per value' },
          { k: 'red', label: 'threshold c (circle)' },
        ]);
        const nRo = f.readout('norm', { sym: 'G' });
        const sRo = f.readout('scale');
        const bRo = f.readout('per-value bend');
        const fRo = f.readout('steps clipped');
        const sync = () => {
          const [a, b] = g();
          const n = Math.hypot(a, b);
          const s = Math.min(1, c / (n + 1e-6));
          const bend = bendOf([a, b], c);
          f.code.setMany({ c: fmt(c, 2), step: custom ? 'custom' : sel, g0: fmt(a, 2), g1: fmt(b, 2), nrm: fmt(n, 3), sc: fmt(s, 3) });
          f.code.highlight(s < 1 ? ['scale', 'clip'] : 'norm');
          nRo.set(fmt(n, 3));
          sRo.set(fmt(s, 3));
          bRo.set(`${bend.toFixed(0)}°`);
          fRo.set(pct(norms.filter((v) => v > c).length / N));
          bars.redraw();
          plane.redraw();
        };
        let drag = false;
        const setG = (e: PointerEvent) => {
          const [x, y] = plane.pointer(e);
          custom = [x, y];
          sync();
        };
        plane.canvas.addEventListener('pointerdown', (e) => {
          drag = true;
          plane.canvas.setPointerCapture(e.pointerId);
          setG(e);
        });
        plane.canvas.addEventListener('pointermove', (e) => drag && setG(e));
        plane.canvas.addEventListener('pointerup', () => (drag = false));
        f.slider({ label: 'max_norm c', min: 0.25, max: 3, step: 0.05, value: 1, format: (v) => fmt(v, 2), onInput: (v) => { c = v; sync(); } });
        sync();
      },
      caption: `**Top:** the global gradient norm over 200 steps of a made-up but typical run: larger at the start, then mostly steady, with a few spikes. The dashed line is the threshold $c$; the red tops are what clipping cuts off. **Bottom:** the selected step's gradient split into two "layers". Global-norm clipping (solid teal) shrinks it onto the dashed circle without turning it. Clipping each value separately (gray) lands on the square instead, and bends the direction by the angle shown. **Tap a bar** to pick a step, or **drag** on the plane to make your own gradient. With $c = 1$ only a small share of steps is clipped: the ceiling is there for the spikes, not for ordinary steps.`,
    });

    // ------------------------------------------------------------------ mixed precision
    p.h2('Mixed precision: fp16, bf16 and loss scaling', 'mixed-precision');
    p.prose(`
A standard 32-bit float (fp32) spends 1 bit on the sign, 8 on the **exponent** (the power of two, which sets the *range*) and 23 on the **mantissa** (the digits, which set the *precision*). Halving that to 16 bits halves the memory and memory traffic for weights and activations, and GPU tensor cores multiply 16-bit matrices many times faster than 32-bit ones. Since Micikevicius et al. (2017), large models train in **mixed precision**: 16-bit numbers for the heavy matrix multiplies, 32-bit where it matters. There are two 16-bit formats, and they split the bits differently.`);

    p.table(
      ['Format', 'Exponent / mantissa bits', 'Largest value', 'Smallest normal value', 'Gap after 1.0'],
      [
        ['fp32', '8 / 23', '$3.4 \\times 10^{38}$', '$1.2 \\times 10^{-38}$', '$2^{-23} \\approx 1.2 \\times 10^{-7}$'],
        ['fp16', '5 / 10', '65,504', '$6.1 \\times 10^{-5}$ (subnormals down to $6 \\times 10^{-8}$)', '$2^{-10} \\approx 0.001$'],
        ['bf16', '8 / 7', '$3.4 \\times 10^{38}$', '$1.2 \\times 10^{-38}$', '$2^{-7} \\approx 0.008$'],
        ['fp8 (E4M3)', '4 / 3', '448', '$2^{-6} \\approx 0.016$', '$2^{-3} = 0.125$'],
      ],
      { caption: '**fp16** keeps more digits but has a tiny range. **bf16** ("brain float", from Google) keeps fp32\'s full range and gives up digits. Below the smallest normal value, fp16 has *subnormal* numbers that trade away digits to reach a little further toward zero. fp8, supported since NVIDIA\'s H100, needs a scaling factor per tensor or per block, and is used for parts of training in some recent models.' },
    );

    p.prose(`
### Precision: why weights stay in fp32

The "gap after 1.0" column matters more than it looks. An update is a tiny number added to a much larger weight. If the update is smaller than half the gap between the weight and its neighboring representable value, the sum rounds straight back to the weight, and the update is lost.`);

    p.math({
      label: 'An update smaller than half a gap disappears',
      tex: String.raw`\operatorname{round}(\symW + \Delta) = \symW \quad\text{whenever}\quad |\Delta| < \tfrac12\,\mathrm{gap}(\symW), \qquad \mathrm{gap}(\symW) = 2^{\lfloor \log_2 |\symW| \rfloor - p}`,
      code: `
        w = np.float16(1.0)
        print(np.spacing(w))            # 0.000977 = 2 ** -10
        print(w + np.float16(1e-4))     # 1.0: the update is lost

        w32 = np.float32(1.0)
        print(w32 + np.float32(1e-4))   # 1.0001: kept
      `,
      codeTitle: 'lost_update.py',
      terms: [
        [String.raw`\lfloor \log_2 |\symW| \rfloor`, 'which power of two the weight sits between: for 1.0 to 2.0 this is 0'],
        [String.raw`p`, 'the number of mantissa bits: 10 for fp16, 7 for bf16, 23 for fp32'],
        [String.raw`\mathrm{gap}(\symW)`, 'the distance from the weight to the next number the format can store'],
      ],
      explain: 'A weight of 1.0 in bf16 has a gap of $2^{-7} \\approx 0.008$, so any update smaller than 0.004 vanishes, and with learning rates around $10^{-4}$ that is nearly every update. The fix is to keep a **master copy** of the weights in fp32 and apply updates there; each step casts the master weights to 16 bits for the forward and backward passes. Adam\'s $\\symM$ and $\\symv$ stay in fp32 too. Together that costs about 16 bytes per parameter (counted in [the parallelism chapter](#/parallelism)), but it is what makes 16-bit training work at all.',
    });

    p.prose(`
### Range: why fp16 needs loss scaling

fp16's problem is the other column. Many gradient values in a deep network are far smaller than $6 \\times 10^{-8}$, fp16's smallest positive number, so they round to zero: the gradient silently loses most of its information. Micikevicius et al.'s fix is **loss scaling**: multiply the loss by a big constant $S$ before the backward pass. Every gradient is then $S$ times larger (backprop is linear in the loss), which slides the whole distribution up into fp16's range. Before the update, divide by $S$ again, in fp32.`);

    p.math({
      label: 'Loss scaling',
      tex: String.raw`\nabla (S \cdot L) = S \cdot \nabla L, \qquad \symG = \frac{\mathrm{fp16}\big(S\,\nabla L\big)}{S}\ \ \text{(divided in fp32)}`,
      code: `
        scaler = torch.amp.GradScaler()     # S starts at 2 ** 16
        with torch.autocast("cuda", dtype=torch.float16):
            loss = model(x, y)
        scaler.scale(loss).backward()       # gradients of S * loss
        scaler.unscale_(opt)                # divide by S, in fp32
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        scaler.step(opt)                    # skipped if inf or nan
        scaler.update()                     # S / 2 on overflow,
                                            # S * 2 after a calm stretch
      `,
      codeTitle: 'loss_scaling.py',
      terms: [
        [String.raw`S`, 'the loss scale, a power of two so that scaling and unscaling are exact'],
        [String.raw`\nabla(S\cdot L) = S \cdot \nabla L`, 'scaling the loss scales every gradient by the same factor: the chain rule multiplies everything by $S$'],
        [String.raw`\mathrm{fp16}(\cdot)`, 'the backward pass runs in fp16, so this is where tiny values would have rounded to zero'],
      ],
      explain: 'Too small an $S$ and small gradients still vanish; too large and big gradients overflow past 65,504 to infinity. **Dynamic** loss scaling searches for the sweet spot automatically: if any gradient overflows, skip that step and halve $S$; after a long run of good steps (2,000 by default in PyTorch), try doubling it. With **bf16** none of this is needed, because its range matches fp32, which is the main reason bf16 became the default for training on recent GPUs and TPUs: forward and backward in bf16, with fp32 master weights, optimizer state and a few sensitive operations (softmax, normalization, the loss).',
    });

    p.figure({
      title: 'Where gradients land in fp16 and bf16',
      codeTitle: 'loss_scale.py',
      code: `
        g = 2.0 ** np.random.normal(-27, 4, 20000)
        scale = 2.0 ** {{k:0}}      # the loss scale  #@scale
        h = (g * scale).astype(np.{{dtype:float16}})  #@cast
        zeroed = np.mean(h == 0)    # {{zeroed}}      #@zero
        overflow = np.isinf(h).any()  # {{over}}      #@inf
        if overflow:
            scale /= 2   # skip the step, try smaller #@inf
        else:
            g_used = h.astype(np.float32) / scale     #@ok
      `,
      setup(f) {
        const raw = gradLog2Samples(20000);
        let k = 0;
        let fmtSel: FloatFormat = FP16;
        const BIN0 = -50, BIN1 = 26;
        const pl = f.plot({
          aspect: 1.75,
          square: false,
          domain: [BIN0, BIN1, -0.17, 1.12],
          draw: (pp) => {
            const R = formatRange(fmtSel);
            const lZero = Math.log2(R.minSub) - 1;
            const lSub = Math.log2(R.minNormal);
            const lMax = Math.log2(R.max);
            const ctx = pp.ctx;
            const zone = (x0: number, x1: number, col: string, label: string) => {
              const a = Math.max(BIN0, x0), b = Math.min(BIN1, x1);
              if (b <= a) return;
              ctx.fillStyle = col;
              ctx.fillRect(pp.sx(a), pp.sy(1.12), pp.sx(b) - pp.sx(a), pp.sy(-0.0) - pp.sy(1.12));
              if (pp.sx(b) - pp.sx(a) > 44) pp.text(label, (a + b) / 2, 1.06, { align: 'center', base: 'top', size: 11, color: color('--ink-2') });
            };
            zone(BIN0, lZero, withAlpha(color('red'), 0.13), 'rounds to 0');
            zone(lZero, lSub, withAlpha(color('gold'), 0.18), 'subnormal');
            zone(lSub, lMax, withAlpha(color('green'), 0.07), 'normal range');
            zone(lMax, BIN1, withAlpha(color('red'), 0.13), 'inf');
            const counts = new Array<number>(BIN1 - BIN0).fill(0);
            for (const v of raw) {
              const b = Math.floor(v + k - BIN0);
              if (b >= 0 && b < counts.length) counts[b]!++;
            }
            const mx = Math.max(...counts, 1);
            for (let i = 0; i < counts.length; i++) {
              const x = BIN0 + i + 0.5;
              const hgt = (counts[i]! / mx) * 0.88;
              const col = x < lZero || x > lMax ? color('red') : x < lSub ? color('gold') : color('teal');
              ctx.fillStyle = withAlpha(col, 0.85);
              ctx.fillRect(pp.sx(BIN0 + i) + 0.5, pp.sy(hgt), Math.max(1, pp.len(1) - 1), pp.sy(0) - pp.sy(hgt));
            }
            pp.path([BIN0, BIN1], [0, 0], color('--axis'), 1);
            const ticks = fmtSel === FP16 ? [-40, -24, -14, 0, 16] : [-40, -20, 0, 20];
            for (const t of ticks) {
              pp.path([t, t], [-0.02, 0.02], color('--axis'), 1);
              pow2(pp, t, t, -0.035);
            }
          },
        });
        const zRo = f.readout('rounded to 0');
        const sRo = f.readout('subnormal');
        const oRo = f.readout('overflow');
        const sync = () => {
          const S = 2 ** k;
          let zero = 0, sub = 0, inf = 0;
          const R = formatRange(fmtSel);
          for (const v of raw) {
            const h = roundTo(2 ** v * S, fmtSel);
            if (h === 0) zero++;
            else if (!Number.isFinite(h)) inf++;
            else if (h < R.minNormal) sub++;
          }
          const n = raw.length;
          f.code.setMany({ zeroed: fmt(zero / n, 3), over: inf > 0 ? 'True' : 'False', dtype: fmtSel === FP16 ? 'float16' : 'bfloat16' });
          f.code.highlight(inf > 0 ? 'inf' : zero > 0 ? ['cast', 'zero'] : 'ok');
          zRo.set(pct(zero / n));
          sRo.set(pct(sub / n));
          oRo.set(inf > 0 ? `${inf} values: skip step` : 'none');
          pl.redraw();
        };
        f.segmented({
          label: 'format',
          options: [
            { value: 'fp16', label: 'fp16' },
            { value: 'bf16', label: 'bf16' },
          ],
          value: 'fp16',
          onChange: (v) => {
            fmtSel = v === 'fp16' ? FP16 : BF16;
            sync();
          },
        });
        f.slider({ label: 'loss scale S = 2^k', min: 0, max: 40, step: 1, value: 0, slot: 'k', onInput: (v) => { k = v; sync(); } });
        sync();
      },
      caption: `A histogram of 20,000 gradient magnitudes on a log scale (each bar is one power of two). They are synthetic, drawn from a log-normal distribution, but the shape is typical: a wide spread, centered far below 1. Each value is actually rounded to the chosen format. In **fp16** with no scaling, about 70% of them fall below $2^{-25}$ and become exactly zero (red), and the rest land among the subnormals (gold), where digits are lost. Slide the **loss scale** up: at $S = 2^{16}$ almost nothing is zeroed, though a fifth of the values are still subnormal, and by $2^{24}$ nearly everything sits in the normal range. From about $2^{28}$ the largest values overflow to infinity, so the step would be skipped. Switch to **bf16**: its range covers every value at any scale, with no scaling at all.`,
    });

    // ------------------------------------------------------------------ Muon
    p.h2('Muon: orthogonalized momentum', 'muon');
    p.prose(`
Everything so far treats the parameters as one long list of numbers. Adam, in particular, is *element-wise*: each entry of a weight matrix gets its own $\\symv$ and its own step size, as if it had nothing to do with its neighbors. But a hidden layer's weight matrix $\\symW$ is not a list. It is a **linear map**: it takes an input vector and turns it into an output vector, and its gradient has structure that an element-wise method cannot see.

For a linear layer $y = \\symW x$, the gradient is a sum over the batch of **outer products**, $\\symG = \\sum_b \\delta_b\\, x_b^\\top$, where $\\delta_b$ is how the loss wants that example's output to change. Each outer product is a rank-1 matrix (defined below), and when many examples push in similar directions the sum is dominated by a few of them. Keller Jordan, who designed Muon, reported that for the 2-D weights of transformers, the updates produced by SGD with momentum and by Adam have very high **condition number**: they are almost low-rank, a few directions carrying nearly all of the magnitude. A step proportional to such a matrix spends almost all of its size on those few directions, and the rest, directions that are rare in the data but may still matter, barely move.`);

    p.callout('math', `Every matrix can be written as **rotate, stretch, rotate**: $\\symG = U \\Sigma V^\\top$, the **singular value decomposition** (SVD). $V^\\top$ and $U$ are **orthogonal matrices**: their columns are unit-length and mutually perpendicular, so multiplying by one rotates (or reflects) a vector without changing its length. $\\Sigma$ is diagonal: the **singular values** $\\sym{sig}{\\sigma_1} \\ge \\sym{sig}{\\sigma_2} \\ge \\dots \\ge 0$, the stretch factors. Picture it in 2-D: the matrix turns the unit circle into an ellipse whose semi-axes are $\\sym{sig}{\\sigma_1}$ and $\\sym{sig}{\\sigma_2}$. The **rank** is the number of nonzero singular values; a rank-1 matrix squashes everything onto one line. The **condition number** $\\sym{sig}{\\sigma_1} / \\sym{sig}{\\sigma_{\\min}}$ says how lopsided the stretching is. A non-square matrix whose singular values are all exactly 1 is called **semi-orthogonal**: it changes directions but stretches nothing.`, 'Math help: singular values in one paragraph');

    p.prose(`
**Muon** (Jordan et al., 2024; the name stands for MomentUm Orthogonalized by Newton-Schulz) makes one change to SGD with momentum, for each 2-D weight matrix: before stepping, replace the momentum matrix $\\symM = U\\Sigma V^\\top$ by $\\symO = UV^\\top$. Same input and output directions; every stretch factor set to 1. Of all semi-orthogonal matrices, $UV^\\top$ is the closest one to $\\symM$. The update now moves every direction the momentum points in by the same amount, so the rare directions are no longer drowned out by the dominant ones.`);

    p.math({
      label: 'The Muon update for one weight matrix',
      tex: String.raw`\begin{aligned} \symM &\leftarrow \beta\,\symM + \symG \\ \symO &\leftarrow \operatorname{NewtonSchulz}_5(\symM) \;\approx\; UV^\top \quad\text{where } \symM = U\Sigma V^\top \\ \symW &\leftarrow \symW - \symlr \cdot \sqrt{\max(1,\ \tfrac{\text{rows}}{\text{cols}})}\ \cdot \symO \end{aligned}`,
      code: `
        def muon_step(W, G, M, lr=0.02, beta=0.95):
            M[:] = beta * M + G                 # momentum
            O = newton_schulz5(M)               # ~ U @ V.T
            rows, cols = W.shape                # (out, in)
            W -= lr * max(1, rows / cols) ** 0.5 * O
      `,
      codeTitle: 'muon.py',
      terms: [
        [String.raw`\beta\,\symM + \symG`, 'ordinary momentum: a running sum of recent gradients, $\\beta = 0.95$ in the reference implementation (which uses the Nesterov variant)'],
        [String.raw`U\Sigma V^\top`, 'the SVD of the momentum matrix: directions $U$ and $V$, stretches $\\Sigma$'],
        [String.raw`UV^\top`, 'the same directions with every singular value replaced by 1: the **orthogonalized** momentum'],
        [String.raw`\operatorname{NewtonSchulz}_5`, 'five steps of an iteration made only of matrix multiplications, which computes $UV^\\top$ approximately without an SVD (next section)'],
        [String.raw`\sqrt{\max(1, \text{rows}/\text{cols})}`, 'a shape correction so that tall matrices (more outputs than inputs) get proportionally larger steps'],
      ],
      explain: `Read it as SGD with momentum, plus one extra line that equalizes the momentum's singular values before the step. Because every singular value of $\\symO$ is about 1, the learning rate directly sets how far the layer moves in every direction at once. Muon applies only to 2-D weight matrices in the hidden layers: the embedding, the output layer, and all biases and normalization gains are still trained with AdamW (more on this below). Moonshot AI's large-scale study (2025) used a different shape factor, $0.2\\sqrt{\\max(\\text{rows}, \\text{cols})}$, chosen so that Muon's updates have the same typical entry size as AdamW's and AdamW's learning rate and weight decay can be reused.`,
    });

    // ------------------------------------------------------------------ Newton-Schulz
    p.h2('Newton-Schulz instead of an SVD', 'newton-schulz');
    p.prose(`
Computing $UV^\\top$ exactly needs an SVD, and an SVD is a poor fit for a GPU: it is an iterative, sequential algorithm that runs far below the hardware's peak and wants 32-bit precision. Doing one for every weight matrix at every step would be slow. Muon instead uses a **Newton-Schulz iteration**, a classic trick from numerical linear algebra that gets to (approximately) the same place using nothing but matrix multiplications, which GPUs do at full speed, even in bf16.

The key fact: if $X = U\\Sigma V^\\top$, then $XX^\\top X = U\\Sigma V^\\top V\\Sigma U^\\top U\\Sigma V^\\top = U\\Sigma^3 V^\\top$, because $V^\\top V$ and $U^\\top U$ are identity matrices. Odd powers of a matrix keep its singular directions and just raise each singular value to that power. So a combination like $aX + b(XX^\\top)X + c(XX^\\top)^2X$ applies the same ordinary polynomial to every singular value at once, without ever finding $U$, $\\Sigma$ or $V$.`);

    p.math({
      label: 'One quintic Newton-Schulz step',
      tex: String.raw`X \leftarrow aX + b\,(XX^\top)X + c\,(XX^\top)^2X \quad\Longleftrightarrow\quad \sym{sig}{\sigma_i} \leftarrow a\,\sym{sig}{\sigma_i} + b\,\sym{sig}{\sigma_i}^3 + c\,\sym{sig}{\sigma_i}^5`,
      code: `
        def newton_schulz5(G, steps=5):
            a, b, c = 3.4445, -4.7750, 2.0315
            X = G / (np.linalg.norm(G) + 1e-7)   # all sigma <= 1
            tall = X.shape[0] > X.shape[1]
            if tall:
                X = X.T                  # keep X @ X.T small
            for _ in range(steps):
                A = X @ X.T
                B = b * A + c * A @ A
                X = a * X + B @ X
            return X.T if tall else X
      `,
      codeTitle: 'newton_schulz.py',
      terms: [
        [String.raw`XX^\top`, 'a small square matrix (rows by rows). Computing it and its square costs three matrix multiplies per step in total'],
        [String.raw`a\,\sym{sig}{\sigma} + b\,\sym{sig}{\sigma}^3 + c\,\sym{sig}{\sigma}^5`, 'the polynomial each singular value goes through, every step, independently of the others'],
        [String.raw`a = 3.4445`, 'the slope at zero: a tiny singular value is multiplied by about 3.4 each step, so it grows fast'],
        [String.raw`b, c`, 'chosen so that the polynomial bends back down near 1, keeping large singular values from overshooting'],
      ],
      explain: `First divide by the Frobenius norm (the square root of the sum of squared entries). That norm is at least as big as the largest singular value, so afterward every $\\sym{sig}{\\sigma_i} \\le 1$, inside the range where the polynomial behaves. Then iterate. The classic cubic version, $1.5X - 0.5XX^\\top X$, converges exactly to $UV^\\top$ but slowly: tiny singular values grow by only 1.5 times per step. Jordan tuned the quintic's coefficients for speed instead: they make tiny singular values grow about 3.4 times per step, at the price of never converging exactly. After five steps, every singular value that started above about 1% of the largest sits in a band around 1, roughly 0.7 to 1.2, rather than at exactly 1. That turned out not to hurt training at all. The figure shows both versions.`,
    });

    p.figure({
      title: 'Newton-Schulz driving every singular value toward 1',
      codeTitle: 'ns_live.py',
      code: `
        # M: 8 x 8, sigma from 10 down to 0.01
        a, b, c = {{coef:3.4445, -4.7750, 2.0315}}
        X = M / np.linalg.norm(M)                        #@norm
        for k in range({{k:0}}):
            A = X @ X.T                                  #@iter
            B = b * A + c * A @ A                        #@iter
            X = a * X + B @ X                            #@iter
        S = np.linalg.svd(X, compute_uv=False)           #@svd
        # S = [{{s}}]
        # max |S - 1| = {{dev}}
      `,
      setup(f) {
        let coef = NS5;
        let rngSeed = 4;
        let G: Mat = withSpectrum(8, 8, NS_SPECTRUM, new Rng(rngSeed));
        const KMAX = 8;
        let svs: number[][] = [];
        let s0: number[] = [];
        let k = 0;
        const recompute = () => {
          let X = scaled(G, 1 / frob(G));
          svs = [singularValues(X)];
          for (let j = 1; j <= KMAX; j++) {
            X = nsStep(X, coef);
            svs.push(singularValues(X));
          }
          s0 = svs[0]!;
        };
        recompute();
        const bars = f.plot({
          aspect: 2.0,
          square: false,
          domain: [-0.75, 8.1, -0.16, 1.42],
          draw: (pl) => {
            hgrid(pl, [0, 0.5, 1], (v) => fmt(v, 2));
            pl.path([-0.75, 8.1], [1, 1], color('--ink'), 1, [4, 4]);
            const sv = svs[k]!;
            const bw = pl.len(1) * 0.68;
            sv.forEach((s, i) => {
              const x = pl.sx(i + 0.5) - bw / 2;
              const y = Math.min(s, 1.4);
              pl.ctx.fillStyle = withAlpha(color('red'), 0.7);
              pl.ctx.fillRect(x, pl.sy(y), bw, pl.sy(0) - pl.sy(y));
              pl.ctx.font = mono(11);
              const inside = y > 0.88 && pl.ctx.measureText('0.00').width + 6 < bw;
              pl.text(s < 0.01 ? s.toFixed(3) : s.toFixed(2), i + 0.5, inside ? y - 0.04 : y + 0.03, { align: 'center', base: inside ? 'top' : 'bottom', size: 11, mono: true, color: inside ? color('--paper') : color('--ink') });
              pl.text(`σ${'₁₂₃₄₅₆₇₈'[i]}`, i + 0.5, -0.04, { align: 'center', base: 'top', size: 11, color: color('--ink-3') });
            });
            corner(pl, `singular values after ${k} step${k === 1 ? '' : 's'}`, color('--ink'), 'right');
          },
        });
        const curve = f.plot({
          aspect: 1.7,
          square: false,
          domain: [-3.6, 0.12, -0.22, 1.38],
          draw: (pl) => {
            hgrid(pl, [0, 0.5, 1], (v) => fmt(v, 2));
            xticks(pl, [-3, -2, -1, 0], (v) => (v === 0 ? '1' : `0.${'0'.repeat(-v - 1)}1`));
            const xs = Array.from({ length: 241 }, (_, i) => -3.25 + (3.37 * i) / 240);
            for (const j of new Set([0, Math.max(0, k - 1), k])) {
              const ys = xs.map((lx) => {
                let s = 10 ** lx;
                for (let q = 0; q < j; q++) s = nsPoly(s, coef);
                return s;
              });
              pl.path(xs, ys, j === k ? color('red') : withAlpha(color(j === 0 ? '--ink' : 'red'), 0.3), j === k ? 2.5 : 1.2, j === 0 && k > 0 ? [3, 4] : undefined);
            }
            pl.path([-3.6, 0.12], [1, 1], color('--ink'), 1, [4, 4]);
            s0.forEach((s, i) => {
              let y = s;
              for (let q = 0; q < k; q++) y = nsPoly(y, coef);
              pl.dot(Math.log10(s), Math.min(y, 1.36), 4.5, color('red'), color('--paper'));
              if (i === 7) pl.text('σ₈', Math.log10(s), Math.min(y, 1.36) + 0.07, { align: 'center', base: 'bottom', size: 11, color: color('--ink-2') });
            });
            corner(pl, 'output vs. starting σ (log scale)', color('--ink-2'), 'right');
          },
        });
        const devRo = f.readout('max |σ − 1|', { sym: 'sig' });
        const orthRo = f.readout('‖XXᵀ − I‖');
        const show = () => {
          const sv = svs[k]!;
          const dev = Math.max(...sv.map((s) => Math.abs(s - 1)));
          const orth = Math.sqrt(sv.reduce((a2, s) => a2 + (s * s - 1) ** 2, 0));
          f.code.setMany({ k, s: sv.map((s) => s.toFixed(2)).join(', '), dev: fmt(dev, 3), coef: coef === NS5 ? '3.4445, -4.7750, 2.0315' : '1.5, -0.5, 0.0' });
          f.code.highlight(k === 0 ? ['norm', 'svd'] : ['iter', 'svd']);
          devRo.set(fmt(dev, 3));
          orthRo.set(fmt(orth, 3));
          bars.redraw();
          curve.redraw();
        };
        const st = f.stepper({
          steps: KMAX + 1,
          interval: 900,
          label: (i) => `step ${i} / ${KMAX}`,
          onStep: (i) => {
            k = i;
            show();
          },
        });
        f.segmented({
          label: 'coefficients',
          options: [
            { value: 'q', label: 'Muon quintic' },
            { value: 'c', label: 'classic cubic' },
          ],
          value: 'q',
          onChange: (v) => {
            coef = v === 'q' ? NS5 : NS3;
            recompute();
            show();
          },
        });
        f.button('New matrix', () => {
          rngSeed++;
          const r = new Rng(rngSeed * 7919);
          const spread = 2 + r.next() * 2;
          G = withSpectrum(8, 8, Array.from({ length: 8 }, (_, i) => 10 ** (1 - (spread * i) / 7)), r);
          recompute();
          st.go(0);
        });
        show();
      },
      caption: `An 8 by 8 matrix with singular values from 10 down to 0.01, like a momentum matrix dominated by a few directions. **Top:** its singular values, measured by an actual SVD after each Newton-Schulz step (the iteration itself never computes one). After normalizing, the largest is about 0.95 and the smallest about 0.001. Step through: the small ones are multiplied by about 3.4 per step. After five steps, seven of the eight sit between about 0.7 and 1.1, and the smallest, which started a thousand times below the largest, has risen from 0.001 to about 0.45; a sixth step would bring it into the band too. **Bottom:** the same story as a function. The bold curve is the polynomial applied $k$ times (the faint one is the previous step, the dashed one the starting identity), plotted against the starting singular value on a log axis; the dots are this matrix's values, and they land exactly on the bar heights above, because the matrix iteration *is* the scalar polynomial applied to each singular value. Switch to the **classic cubic**: it converges cleanly where it reaches, but after five steps the smallest values have grown only about 7 times.`,
    });

    p.prose(`
### What it costs

Each Newton-Schulz step is three matrix multiplications. For a square $m \\times m$ weight, each costs about $2m^3$ floating-point operations (FLOPs), so five steps cost about $30m^3$. Compare that with the cost of *using* the matrix: in training, every token costs about 6 FLOPs per weight (2 in the forward pass and 4 in the backward pass, as in [the scaling-laws chapter](#/scaling-laws)), so a batch of $B$ tokens costs $6Bm^2$ for this matrix.`);

    p.math({
      label: 'Muon\'s extra compute, as a fraction of training compute',
      tex: String.raw`\frac{\text{Newton-Schulz FLOPs}}{\text{training FLOPs}} \approx \frac{T \cdot 6m^3}{6\,B\,m^2} = \frac{T\,m}{B}`,
      code: `
        def muon_overhead(m, B, T=5):
            ns = T * 3 * 2 * m ** 3     # T steps, 3 matmuls each
            train = 6 * B * m ** 2      # forward + backward
            return ns / train           # = T * m / B

        muon_overhead(768, 524_288)      # 0.0073  (GPT-2 small)
        muon_overhead(16_384, 16e6)      # 0.0051  (a 405B model)
      `,
      codeTitle: 'overhead.py',
      terms: [
        [String.raw`T`, 'the number of Newton-Schulz steps, 5'],
        [String.raw`m`, 'the width of the (square) weight matrix'],
        [String.raw`B`, 'the number of tokens per optimizer step (the batch size in tokens)'],
      ],
      explain: 'The cubic cost of Newton-Schulz is paid once per step, while training cost grows with the number of tokens in the batch. Because language-model batches are huge (half a million to 16 million tokens), the ratio stays below 1% even for very wide models, a calculation from Jordan\'s write-up. The real engineering cost is elsewhere: Newton-Schulz needs each *whole* matrix in one place, while large runs shard optimizer state across GPUs (see [the parallelism chapter](#/parallelism)), so a distributed Muon must gather each matrix, orthogonalize it, and scatter the result. Moonshot\'s study describes one way to do this efficiently.',
    });

    // ------------------------------------------------------------------ why it works
    p.h2('Why it works: steepest descent in the spectral norm', 'why-muon');
    p.prose(`
"Take a step downhill" hides a choice: *how big* is a step? Gradient descent picks the step $\\Delta \\symW$ that lowers the loss the most, to first order, among all steps of a given size. The first-order change in loss is the sum of entries of $\\symG$ times $\\Delta\\symW$, written $\\langle \\symG, \\Delta\\symW \\rangle$. What "a given size" means is a choice of **norm**, and different norms give different optimizers.

- Measure size by the ordinary length of all entries (the Frobenius norm), and the best step points straight along $-\\symG$: that is **SGD**.
- Measure it by the largest single entry, and the best step is $-\\operatorname{sign}(\\symG)$, every entry moved by the same amount: that is **sign descent**, which Adam roughly behaves like when its averages are short.
- Measure it by the **spectral norm**, the largest singular value, which says how much the matrix can stretch any input. The best step is $-UV^\\top$: that is **Muon**.

Bernstein and Newhouse (2024) laid out this view of Adam, Shampoo and orthogonalized updates as steepest descent under different norms. The spectral norm is the natural one for a linear layer: it bounds how much the layer's output can change for any input, $\\lVert \\Delta \\symW x \\rVert \\le \\lVert \\Delta\\symW \\rVert_2\\, \\lVert x \\rVert$. Limiting it limits the effect of a step on everything downstream, whatever the input.`);

    p.math({
      label: 'Steepest descent under the spectral norm',
      tex: String.raw`\underset{\lVert \Delta\symW \rVert_2 \le \symlr}{\arg\min}\ \langle \symG, \Delta\symW \rangle = -\symlr\, UV^\top, \qquad \min = -\symlr \textstyle\sum_i \sym{sig}{\sigma_i} \qquad (\symG = U\Sigma V^\top)`,
      code: `
        U, S, Vt = np.linalg.svd(G, full_matrices=False)
        eta = 0.1
        step = -eta * U @ Vt                 # Muon's direction
        np.sum(G * step)        # = -eta * S.sum()   (the best)
        sgd = -eta * G / np.linalg.norm(G, 2)  # same spectral size
        np.sum(G * sgd)         # = -eta * (S @ S) / S[0]  (worse)
      `,
      codeTitle: 'steepest.py',
      terms: [
        [String.raw`\langle \symG, \Delta\symW\rangle`, 'multiply the two matrices entry by entry and add everything up: how much the loss changes, to first order, if we move by $\\Delta\\symW$'],
        [String.raw`\lVert \Delta\symW \rVert_2 \le \symlr`, 'the step may stretch no input by more than $\\symlr$: its largest singular value is at most $\\symlr$'],
        [String.raw`-\symlr\,UV^\top`, 'the answer: move against the gradient\'s own directions, by exactly $\\symlr$ in every one of them'],
        [String.raw`\sum_i \sym{sig}{\sigma_i}`, 'the decrease achieved: $\\symlr$ times the sum of all singular values (the "nuclear norm")'],
      ],
      explain: `In the gradient's own directions, the loss decrease is $\\sum_i \\sym{sig}{\\sigma_i} d_i$, where $d_i$ is how far the step moves along direction $i$. The spectral-norm budget caps each $d_i$ at $\\symlr$, so the best choice is obvious: max out every one, $d_i = \\symlr$. Under the Frobenius norm the budget is $\\sum d_i^2 \\le \\symlr^2$ instead, and the best choice gives most of it to the largest $\\sym{sig}{\\sigma_i}$. The figure draws these two budgets.`,
    });

    p.figure({
      title: 'Two step budgets, two best steps',
      codeTitle: 'two_balls.py',
      code: `
        S = np.array([{{s1:2.0}}, {{s2:0.5}}])  # of G
        eta = 1.0
        # Frobenius ball (SGD): sum(d**2) <= eta**2
        d_frob = eta * S / np.linalg.norm(S)    #@frob
        # spectral ball (Muon): max(d) <= eta
        d_spec = eta * np.ones(2)               #@spec
        # d_frob = [{{f1}}, {{f2}}]
        S @ d_frob     # decrease {{gf}}         #@frob
        S @ d_spec     # decrease {{gs}}         #@spec
      `,
      setup(f) {
        let S: [number, number] = [2.0, 0.5];
        const GS = 0.75;
        const pl = f.plot({
          aspect: 1.15,
          domain: [-1.35, 2.6, -1.35, 2.35],
          draw: (pp) => {
            pp.axes({ grid: 0.5 });
            const ctx = pp.ctx;
            ctx.fillStyle = withAlpha(color('purple'), 0.08);
            ctx.fillRect(pp.sx(-1), pp.sy(1), pp.len(2), pp.len(2));
            ctx.strokeStyle = color('purple');
            ctx.lineWidth = 2;
            ctx.strokeRect(pp.sx(-1), pp.sy(1), pp.len(2), pp.len(2));
            ctx.fillStyle = withAlpha(color('teal'), 0.1);
            ctx.beginPath();
            ctx.arc(pp.sx(0), pp.sy(0), pp.len(1), 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = color('teal');
            ctx.stroke();
            const n = Math.hypot(S[0], S[1]);
            const ux = S[0] / n, uy = S[1] / n;
            const fr: [number, number] = [ux, uy];
            const line = (val: number, col: string) => {
              const px = ux * val, py = uy * val;
              pp.path([px - uy * 4, px + uy * 4], [py + ux * 4, py - ux * 4], col, 1.3, [5, 4]);
            };
            line(1, withAlpha(color('teal'), 0.9));
            line(ux + uy, withAlpha(color('purple'), 0.9));
            pp.arrow(0, 0, S[0] * GS, S[1] * GS, color('red'), 3);
            pp.text('G', S[0] * GS + 0.06, S[1] * GS - 0.04, { size: 13, bold: true, color: color('red'), base: 'top' });
            pp.dot(fr[0], fr[1], 6, color('teal'), color('--paper'));
            pp.dot(1, 1, 6, color('purple'), color('--paper'));
            pp.text('SGD', fr[0] + 0.08, fr[1] - 0.04, { size: 12, bold: true, color: color('teal'), base: 'top' });
            pp.text('Muon', 1.06, 1.06, { size: 12, bold: true, color: color('purple'), base: 'bottom' });
            pp.text('d₁: along direction 1', pp.view()[1] - 0.05, -0.08, { align: 'right', base: 'top', size: 11, color: color('--ink-3') });
            pp.text('d₂', 0.06, pp.view()[3] - 0.06, { align: 'left', base: 'top', size: 11, color: color('--ink-3') });
          },
        });
        const fRo = f.readout('SGD gain');
        const sRo = f.readout('Muon gain');
        const rRo = f.readout('direction 2 moves');
        const sync = () => {
          const n = Math.hypot(S[0], S[1]);
          const d = [S[0] / n, S[1] / n];
          const gf = S[0] * d[0]! + S[1] * d[1]!;
          const gs = S[0] + S[1];
          f.code.setMany({ s1: fmt(S[0], 2), s2: fmt(S[1], 2), f1: fmt(d[0]!, 2), f2: fmt(d[1]!, 2), gf: fmt(gf, 3), gs: fmt(gs, 3) });
          f.code.highlight(['frob', 'spec']);
          fRo.set(fmt(gf, 3));
          sRo.set(fmt(gs, 3));
          rRo.set(`SGD ${fmt(d[1]!, 2)}, Muon 1`);
          pl.redraw();
        };
        let drag = false;
        const setS = (e: PointerEvent) => {
          const [x, y] = pl.pointer(e);
          const a = Math.max(0.02, x / GS), b = Math.max(0.02, y / GS);
          S = a >= b ? [Math.min(a, 3.2), Math.min(b, 3.2)] : [Math.min(b, 3.2), Math.min(b, 3.2)];
          sync();
        };
        pl.canvas.addEventListener('pointerdown', (e) => {
          drag = true;
          pl.canvas.setPointerCapture(e.pointerId);
          setS(e);
        });
        pl.canvas.addEventListener('pointermove', (e) => drag && setS(e));
        pl.canvas.addEventListener('pointerup', () => (drag = false));
        sync();
      },
      caption: `The plane of possible steps, measured in the gradient's own two singular directions: $d_1$ is how far a step moves along the gradient's strongest direction, $d_2$ along its weaker one. The red arrow is the gradient, whose coordinates here are its singular values (scaled to fit). The teal disc is every step of Frobenius size at most 1; the purple square is every step of spectral size at most 1. The best step in each set is the point that reaches furthest in the direction of the red arrow, where a dashed line of equal loss decrease just touches the set. In the disc that is the point along the gradient (SGD): it barely moves direction 2. In the square it is always the corner (1, 1) (Muon): both directions move by the full amount. **Drag** to change the gradient: the more lopsided it is ($\\sym{sig}{\\sigma_1} \\gg \\sym{sig}{\\sigma_2}$), the bigger the difference, and the corner never moves.`,
    });

    p.table(
      ['Optimizer', 'Step size measured by', 'Best step', 'Sees the matrix?'],
      [
        ['SGD', 'Frobenius norm (length of all entries)', '$-\\symG$, scaled', 'no: proportional to the gradient'],
        ['Adam (roughly)', 'largest entry ($\\ell_\\infty$)', '$-\\operatorname{sign}(\\symG)$, per entry', 'no: tied to the coordinate axes'],
        ['Muon', 'spectral norm (largest singular value)', '$-UV^\\top$', 'yes: uses the gradient\'s own directions'],
      ],
      { caption: 'Three update rules as steepest descent under three norms. Adam is not exactly sign descent: with long averages it is a smoothed, per-entry rescaling, but its rescaling always happens along the coordinate axes.' },
    );

    p.prose(`
### A race on a matrix problem

The difference between "per entry" and "per direction" shows up as soon as a problem's hard directions are not lined up with the coordinate axes. The figure below learns a 2 by 2 matrix $\\symW$ to match a target map, from inputs that vary a lot along one direction and very little along another, a "rare" direction. The ratio of the two variances is the condition number $\\kappa$, and the slider turns both directions together.`);

    p.figure({
      title: 'SGD, Adam and Muon on a rotated, ill-conditioned matrix',
      codeTitle: 'race.py',
      code: `
        # inputs x: variance 1 and 1/{{kappa:1000}} along two
        # directions, turned {{theta:45}} degrees from the axes
        for t in range(150):
            X = sample_inputs(batch=4)                   #@data
            G = (W - W_star) @ X @ X.T / 4               #@grad
            lr_t = lr * (1 - t / 150)   # decay to 0
            # SGD + momentum, lr {{lr_sgd}}
            M = 0.9 * M + G;  W -= lr_t * M                #@sgd
            # Adam, lr {{lr_adam}}
            W -= lr_t * adam_direction(G)                  #@adam
            # Muon, lr {{lr_muon}}
            M = 0.9 * M + G;  W -= lr_t * newton_schulz5(M) #@muon
        # step {{t}} loss: {{l_sgd}}, {{l_adam}}, {{l_muon}}
      `,
      setup(f) {
        let theta = Math.PI / 4;
        let kappa = 1000;
        let su = raceSetup(theta, kappa);
        let runs: Record<RaceOpt, RaceRun> = { sgd: raceBest('sgd', su), adam: raceBest('adam', su), muon: raceBest('muon', su) };
        let t = RACE_T;
        const rareDir = (): [number, number] => [su.R[0]![1]!, su.R[1]![1]!];
        const commonDir = (): [number, number] => [su.R[0]![0]!, su.R[1]![0]!];
        const ellipse = (pp: Plot, W: Mat, col: string, width: number, dash?: number[]) => {
          const xs: number[] = [], ys: number[] = [];
          for (let i = 0; i <= 96; i++) {
            const a = (i / 96) * Math.PI * 2;
            const c = Math.cos(a), s = Math.sin(a);
            xs.push(W[0]![0]! * c + W[0]![1]! * s);
            ys.push(W[1]![0]! * c + W[1]![1]! * s);
          }
          pp.path(xs, ys, col, width, dash);
        };
        const apply = (W: Mat, d: [number, number]): [number, number] => [W[0]![0]! * d[0] + W[0]![1]! * d[1], W[1]![0]! * d[0] + W[1]![1]! * d[1]];
        const plane = f.plot({
          aspect: 1.3,
          domain: [-1.75, 1.75, -1.45, 1.45],
          draw: (pp) => {
            pp.axes({ grid: 0.5 });
            ellipse(pp, su.Wstar, color('--ink'), 1.5, [5, 4]);
            const [rx, ry] = apply(su.Wstar, rareDir());
            const [cx, cy] = apply(su.Wstar, commonDir());
            pp.arrow(0, 0, cx, cy, withAlpha(color('--ink'), 0.35), 1.5);
            pp.arrow(0, 0, rx, ry, withAlpha(color('--ink'), 0.6), 1.5);
            pp.text('target, rare input', rx + 0.04, ry + 0.06, { size: 11, color: color('--ink-2'), base: 'bottom' });
            for (const o of RACE_OPTS) {
              const W = runs[o].Ws[Math.min(t, runs[o].Ws.length - 1)]!;
              const col = color(RACE_COLOR[o]);
              ellipse(pp, W, withAlpha(col, 0.9), 2.4);
              const [ax, ay] = apply(W, rareDir());
              pp.arrow(0, 0, ax, ay, col, 2.2);
            }
          },
        });
        const curves = f.plot({
          aspect: 2.4,
          square: false,
          domain: [-24, RACE_T + 3, -8.4, 1.1],
          draw: (pp) => {
            hgrid(pp, [-8, -6, -4, -2, 0], (v) => `1e${v}`);
            for (const o of RACE_OPTS) {
              const L = runs[o].losses.slice(0, t + 1).map((v) => Math.log10(Math.max(v, 1e-12)));
              pp.path(L.map((_, i) => i), L, color(RACE_COLOR[o]), 1.8);
            }
            corner(pp, `loss (log scale), step ${t}`, color('--ink-2'), 'right');
          },
        });
        const leg = legend(f);
        const sync = () => {
          const at = (o: RaceOpt) => runs[o].losses[Math.min(t, runs[o].losses.length - 1)]!;
          f.code.setMany({
            kappa,
            theta: Math.round((theta * 180) / Math.PI),
            lr_sgd: fmt(runs.sgd.lr, 2),
            lr_adam: fmt(runs.adam.lr, 2),
            lr_muon: fmt(runs.muon.lr, 2),
            t,
            l_sgd: sci(at('sgd')),
            l_adam: sci(at('adam')),
            l_muon: sci(at('muon')),
          });
          leg(
            RACE_OPTS.map((o) => {
              const W = runs[o].Ws[Math.min(t, runs[o].Ws.length - 1)]!;
              return { k: RACE_COLOR[o], label: RACE_LABEL[o], note: `rare-direction error ${fmt(dirError(W, su, rareDir()), 2)}` };
            }),
          );
          plane.redraw();
          curves.redraw();
        };
        let frame = 0;
        const loop = f.loop(() => {
          t = Math.min(RACE_T, t + 1);
          frame++;
          f.code.highlight(['data', 'grad', 'sgd', 'adam', 'muon'][Math.floor(frame / 6) % 5]!);
          sync();
          if (t >= RACE_T) {
            f.code.highlight(null);
            return false;
          }
        });
        const replay = () => {
          t = 0;
          loop.start();
        };
        let pending = 0;
        const rerun = () => {
          clearTimeout(pending);
          pending = window.setTimeout(() => {
            su = raceSetup(theta, kappa);
            runs = { sgd: raceBest('sgd', su), adam: raceBest('adam', su), muon: raceBest('muon', su) };
            sync();
          }, 40);
        };
        f.button('Replay', replay, { primary: true, icon: 'play' });
        f.slider({
          label: 'rotation',
          min: 0,
          max: 90,
          step: 5,
          value: 45,
          format: (v) => `${v}°`,
          onInput: (v) => {
            theta = (v * Math.PI) / 180;
            rerun();
          },
        });
        f.segmented({
          label: 'condition number κ',
          options: [
            { value: '10', label: '10' },
            { value: '100', label: '100' },
            { value: '1000', label: '1000' },
          ],
          value: '1000',
          onChange: (v) => {
            kappa = Number(v);
            rerun();
          },
        });
        sync();
      },
      caption: `Each optimizer learns the same 2 by 2 matrix from the same mini-batches, with its own learning rate picked as the best of a 44-value grid for this exact setting (computed live), and the same linear decay to zero. **Top:** each colored ellipse is the image of the unit circle under the current $\\symW$, the dashed ellipse is the target, and the colored arrows show what each $\\symW$ does to the *rare* input direction. **Bottom:** the loss. At 45 degrees, SGD fits the common direction quickly but hardly learns the rare one: its ellipse stays flattened. Adam is no better, because its per-entry rescaling cannot isolate a direction that is not an axis. Muon equalizes the two directions and learns both. Now set the rotation to **0**: the rare direction lies along an axis, and Adam becomes the best of the three. SGD and Muon do not change at all with rotation, because neither cares which basis the matrix is written in. Press **Replay** to watch it run.`,
    });

    p.callout('warning', `This race is a toy that isolates one property; it is not a benchmark. On a pure quadratic, carefully tuned SGD with momentum is hard to beat in the long run, and real networks are not quadratics. The real evidence for Muon is the training results below. What the toy shows is the mechanism: equal steps in every singular direction, independent of the basis.`, 'What the toy does and does not show');

    // ------------------------------------------------------------------ in practice
    p.h2('Muon in practice', 'muon-practice');
    p.prose(`
### Which parameters get Muon

Muon is for the **hidden 2-D weight matrices**: in a transformer, the attention projections and the feed-forward matrices of every block. Everything else stays on AdamW, so a Muon training loop always runs two optimizers side by side.`);

    p.table(
      ['Parameter', 'Optimizer', 'Why'],
      [
        ['attention $W_Q, W_K, W_V, W_O$, MLP matrices', 'Muon', 'linear maps between hidden vectors: the spectral-norm argument applies directly'],
        ['token embedding', 'AdamW', 'a lookup table, not a map applied to dense vectors: each token\'s row is used on its own, so there is no shared input space to balance'],
        ['output layer (unembedding)', 'AdamW', 'empirically better in the original experiments; it is also often tied to the embedding'],
        ['biases, normalization gains', 'AdamW', 'vectors, not matrices: there is nothing to orthogonalize'],
        ['convolution filters', 'Muon', 'reshape each 4-D filter bank to 2-D (output channels by everything else) first'],
      ],
    );

    p.code(`
      hidden = [p for n, p in model.named_parameters()
                if p.ndim == 2 and "embed" not in n and "head" not in n]
      rest = [p for p in model.parameters()
              if not any(p is q for q in hidden)]
      opt_muon = Muon(hidden, lr=0.02, momentum=0.95)  # e.g. Jordan's
      opt_adamw = torch.optim.AdamW(rest, lr=3e-4,
                                    betas=(0.9, 0.95), weight_decay=0.1)
      for x, y in loader:
          loss = model(x, y)
          loss.backward()
          opt_muon.step(); opt_adamw.step()
          opt_muon.zero_grad(); opt_adamw.zero_grad()
    `, { title: 'two_optimizers.py' });

    p.prose(`
### The track record

Muon came out of the **NanoGPT speedrun**, a public competition Keller Jordan ran in 2024: train a GPT-2-small-sized model (124 million parameters) on the FineWeb dataset to a fixed validation loss of 3.28, as fast as possible on 8 H100 GPUs. Over the second half of 2024 the record fell from about 45 minutes to a few minutes, through many changes to the model and the training loop; Muon, introduced in October 2024 and written up in December, was one of the largest single gains over a well-tuned AdamW baseline, and it stayed in the record runs that followed. Jordan also reported the advantage holding as the model grew to about 1.5 billion parameters.

The open question was whether it would survive real scale. In early 2025, Moonshot AI's study, *Muon is Scalable for LLM Training*, found two changes necessary for large runs: add **weight decay** (decoupled, as in AdamW), without which weights and outputs grew too large over long training; and **rescale each matrix's update** so its typical entry size matches AdamW's, which keeps the update size consistent across matrix shapes and lets AdamW's learning rate and weight decay be reused. With those, their scaling-law experiments showed Muon reaching the same loss as AdamW with roughly half the training compute, and they trained **Moonlight**, a mixture-of-experts model with 16 billion total and 3 billion active parameters, on 5.7 trillion tokens. Moonshot later trained its trillion-parameter Kimi K2 with a Muon variant that adds a safeguard against exploding attention scores. Results this young deserve some caution: the gains are clearest in pretraining from scratch, and fine-tuning a model with a different optimizer than the one it was pretrained with is still an active question.

### Relatives: Shampoo, SOAP and muP

Muon has an older relative. **Shampoo** (Gupta, Koren and Singer, 2018) keeps two running statistics per weight matrix, $L = \\sum \\symG\\symG^\\top$ and $R = \\sum \\symG^\\top\\symG$, and steps along $L^{-1/4}\\,\\symG\\,R^{-1/4}$. If those sums are dropped and only the current gradient is used, that expression is exactly $UV^\\top$: Muon is Shampoo without the memory, which is the observation Bernstein and Newhouse made. **SOAP** (Vyas et al., 2024) takes the other road: it uses Shampoo's statistics to find a rotated basis for each matrix, and runs Adam in that basis, so the per-entry rescaling happens along directions that matter rather than along the arbitrary coordinate axes. Both need extra memory and occasional expensive matrix roots or eigendecompositions, which Muon avoids.

A different problem is choosing hyperparameters at all. Tuning a large model's learning rate directly is too expensive, so you would like to tune a small model and reuse the values. In the standard parameterization, the best learning rate shifts as width grows. **muP** (the maximal update parameterization; Yang and Hu, 2021, and Yang et al., 2022, "Tensor Programs V") rescales initialization and per-layer learning rates with width so that the best hyperparameters stay put: tune at width 256, train at width 8,192. A later formulation (Yang, Simon and Bernstein, 2023) states the condition in spectral terms: each hidden matrix's update should have a spectral norm proportional to $\\sqrt{\\text{fan-out} / \\text{fan-in}}$. Muon's shape factor builds in exactly that form.`);

    // ------------------------------------------------------------------ recipe
    p.h2('The modern recipe', 'recipe');
    p.table(
      ['Piece', 'A typical large-model setting'],
      [
        ['optimizer', 'AdamW with $\\beta_1 = 0.9$, $\\beta_2 = 0.95$ (a shorter memory than the 2016 default of 0.999, which reacts faster when gradient sizes change)'],
        ['weight decay', '$\\symlam = 0.1$, on weight matrices only'],
        ['warmup', 'linear, from a few hundred to a few thousand steps (Llama: 2,000)'],
        ['decay', 'cosine to about 10% of the peak, or WSD with a short final decay'],
        ['clipping', 'global gradient norm at 1.0'],
        ['precision', 'bf16 forward and backward; fp32 master weights and optimizer state'],
        ['the Muon option', 'Muon (momentum 0.95, five Newton-Schulz steps) for hidden matrices, AdamW for everything else'],
      ],
      { caption: 'Values from the GPT-3 and Llama papers and the Muon write-ups. Every one of them is a starting point to tune, not a law.' },
    );
    p.callout('idea', `**AdamW** decays every weight by the same fraction per step, instead of letting Adam's normalization scramble L2 regularization. **Warmup** protects the fragile first steps; **cosine** or **warmup-stable-decay** ends training at a small learning rate, below the noise floor. **Global-norm clipping** caps the rare huge gradient without turning it. **Mixed precision** computes in 16 bits but updates fp32 master weights, and bf16's range makes fp16's loss scaling unnecessary. **Muon** treats a hidden weight matrix as a linear map: it replaces the momentum $\\symM = U\\Sigma V^\\top$ by $UV^\\top$, the steepest step under the spectral norm, so every direction moves equally; five Newton-Schulz steps compute it with matrix multiplies for under 1% extra compute.`, 'Takeaways');

    // ------------------------------------------------------------------ exercises
    p.h2('Build it yourself', 'exercises');
    p.prose(`
1. **Newton-Schulz in NumPy (10 minutes).** Write \`newton_schulz5(G)\` from the listing above. For random matrices of shapes 64 by 64 and 64 by 256 with singular values spread over two orders of magnitude, print the singular values of the result, and compare it with the exact \`U @ Vt\` from \`np.linalg.svd\` (their entry-wise correlation should be close to 1). *Success:* all singular values land roughly between 0.7 and 1.2; then swap in the cubic $1.5X - 0.5XX^\\top X$ and count how many steps it needs to match.
2. **Find the L2 bug (30 minutes).** Train logistic regression with Adam on data whose features have very different scales (multiply some columns by 100), once with \`g = grad + wd * w\` and once with AdamW's decoupled decay, at the same $\\symlam$. *Success:* a plot of final weight size per feature shows that L2-in-Adam regularizes the features unevenly while AdamW shrinks them uniformly, as in the five-weight figure.
3. **Schedules and branching (an evening).** Train a small character-level model (the RNN from [CS231n](#/rnn) or a tiny MLP language model) with cosine and with WSD at the same peak learning rate. Then save WSD checkpoints at 40%, 60% and 80% of training and branch a short decay from each. *Success:* each branched run's loss drops sharply during its decay, and the full-length WSD run ends within a few percent of cosine.
4. **Mixed precision by hand (an evening).** Train a two-layer network in NumPy with every forward and backward array cast to \`np.float16\`. Measure how many gradient entries become exactly zero, then add static loss scaling (try $2^{8}$, $2^{16}$, $2^{24}$) and fp32 master weights. *Success:* without master weights, training stalls once updates fall below half a gap; with both fixes it comes close to fp32 training.
5. **Small project: Muon versus AdamW (a weekend).** In PyTorch, train a small transformer (a few million parameters, e.g. on TinyShakespeare) twice: AdamW everywhere, and Muon on the hidden matrices with AdamW on embeddings, head and gains, as in \`two_optimizers.py\`. Tune each optimizer's learning rate over a small grid and use the same schedule. Also log the singular values of one layer's update matrix under each optimizer. *Success:* a fair comparison you trust (published small-scale runs show Muon reaching AdamW's loss in noticeably fewer steps), updates have all singular values near 1 while AdamW's are dominated by a few, and the extra time per step is small.`);
  },
};

export default chapter;

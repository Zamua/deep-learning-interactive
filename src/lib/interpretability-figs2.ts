// Figures on probes, superposition, polysemantic neurons and sparse autoencoders.
import { fmt } from '../core/code';
import type { Page } from '../core/page';
import { CLASS_COLORS, color, withAlpha } from '../core/plot';
import { finalWeights, Probe, type ProbeSet, type ProbeTarget, probeData } from './interpretability-model';
import { SAE, SAE_D, SAE_N, SAE_NAMES, SAE_STEPS, TOY_IMPORTANCE, TOY_N, TOY_STEPS, TRUE_DIRS, ToyModel, sampleSet } from './interpretability-toys';
import { fitHeight, line, measure, num, rbox, signed, text } from './interpretability-draw';

/* ------------------------------------------------------------------ */
/* Fig: linear probes                                                   */
/* ------------------------------------------------------------------ */

const LAYER_STYLE: { name: string; a: number; dash?: number[] }[] = [
  { name: 'x₀', a: 0.45, dash: [3, 4] },
  { name: 'x₁', a: 0.7, dash: [9, 4] },
  { name: 'x₂', a: 1 },
];

export function figProbes(p: Page): void {
  p.figure({
    title: 'Linear probes: what each point of the stream knows',
    codeTitle: 'probe.py',
    code: `
      # one probe each on x0, x1 and x2
      X = x1[train]          # (N, 32), frozen   #@data
      y = {{target:previous}}_letter[train]   # (N,)  #@data
      W_p, b_p = np.zeros((32, 20)), np.zeros(20)
      for step in range(150):          # {{step}}
          p = softmax(X @ W_p + b_p)              #@fwd
          loss = -np.log(p[range(N), y]).mean()   #@fwd
          W_p, b_p = adam(W_p, b_p, grads)        #@upd
      pred = np.argmax(X_te @ W_p + b_p, axis=1)  #@acc
      acc = (pred == y_te).mean()                 #@acc
      # x0 {{a0}}   x1 {{a1}}   x2 {{a2}}
    `,
    setup(f) {
      const w = finalWeights();
      const STEPS = 150;
      let target: ProbeTarget = 'previous';
      let train: ProbeSet;
      let test: ProbeSet;
      let probes: Probe[] = [];
      let hist: number[][] = [[], [], []];
      const build = () => {
        train = probeData(w, target, 1000, 40);
        test = probeData(w, target, 5000, 20);
        probes = [0, 1, 2].map(() => new Probe(0.05));
        hist = [[], [], []];
        probes.forEach((pr, l) => hist[l]!.push(pr.accuracy(test, l)));
      };
      const pl = f.plot({
        aspect: 1.6,
        square: false,
        domain: [-20, STEPS + 30, -0.12, 1.08],
        draw: (pp) => {
          pp.axes({ grid: 0 });
          for (const v of [0, 0.25, 0.5, 0.75, 1]) {
            pp.path([0, STEPS], [v, v], withAlpha(color('--ink-3'), 0.18), 1);
            pp.text(`${Math.round(v * 100)}%`, -2, v, { size: 10.5, mono: true, align: 'right', base: 'middle', color: color('--ink-3') });
          }
          for (const s of [0, 50, 100, 150]) pp.text(String(s), s, -0.07, { size: 10.5, mono: true, align: 'center', base: 'middle', color: color('--ink-3') });
          pp.path([0, STEPS], [0.05, 0.05], color('red'), 1, [2, 4]);
          // End labels, nudged apart so close curves keep readable labels.
          const ys = [...hist.map((hs) => hs[hs.length - 1] ?? 0), 0.05];
          const lab = [0, 1, 2, 3].sort((a, b) => ys[a]! - ys[b]! || b - a);
          const ly = ys.slice();
          for (let r = 1; r < 4; r++) ly[lab[r]!] = Math.max(ly[lab[r]!]!, ly[lab[r - 1]!]! + 0.09);
          pp.text('chance', STEPS + 3, ly[3]!, { size: 11, base: 'middle', color: color('red') });
          hist.forEach((hs, l) => {
            if (hs.length < 1) return;
            const st = LAYER_STYLE[l]!;
            const c = withAlpha(color('orange'), st.a);
            pp.path(hs.map((_, i) => i), hs, c, 2.4, st.dash);
            pp.text(`${st.name} ${Math.round(ys[l]! * 100)}%`, hs.length + 3, ly[l]!, { size: 11.5, bold: true, base: 'middle', color: color('orange') });
          });
          pp.text('test accuracy while the probe trains', 2, 1.04, { size: 11, color: color('--ink-2') });
        },
      });
      pl.canvas.classList.add('scroll-ok');
      const ro = [0, 1, 2].map((l) => f.readout(LAYER_STYLE[l]!.name, { sym: 'x' }));
      const sync = () => {
        const acc = hist.map((h) => h[h.length - 1] ?? 0);
        acc.forEach((a, l) => ro[l]!.set(`${Math.round(a * 100)}%`));
        f.code.setMany({ a0: fmt(acc[0]!, 2), a1: fmt(acc[1]!, 2), a2: fmt(acc[2]!, 2), step: hist[0]!.length - 1, target });
        pl.redraw();
      };
      let ph = 0;
      const loop = f.loop(() => {
        for (let k = 0; k < 2 && hist[0]!.length <= STEPS; k++)
          probes.forEach((pr, l) => {
            pr.step(train, l);
            hist[l]!.push(pr.accuracy(test, l));
          });
        f.code.highlight(['fwd', 'upd', 'acc'][ph++ % 3]!);
        sync();
        if (hist[0]!.length > STEPS) {
          f.code.highlight('acc');
          return false;
        }
      });
      const restart = () => {
        loop.stop();
        build();
        sync();
        loop.start();
      };
      f.segmented({
        label: 'decode',
        options: [
          { value: 'current', label: 'this letter' },
          { value: 'previous', label: 'previous letter' },
          { value: 'next', label: 'next letter' },
        ],
        value: 'previous',
        onChange: (v) => {
          target = v as ProbeTarget;
          restart();
        },
      });
      f.button('Train again', restart, { icon: 'reset' });
      build();
      sync();
      loop.start();
    },
    caption: `Three probes train at once, one on each partial sum of the residual stream, to read off a letter with nothing but a linear map and a softmax. Positions come from 40 training sequences; accuracy is measured on 20 others. **Previous letter** is unreadable from $\\symx_0$ (it holds only this letter and its position) and readable from $\\symx_1$: head 0 wrote it there. **This letter** is readable everywhere, since the residual stream keeps what the embedding put in. **Next letter** (measured on the repeated half only) appears only in $\\symx_2$, after the induction head. A probe says the information is there, linearly; whether the model *uses* it is a separate question.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: the toy model of superposition                                  */
/* ------------------------------------------------------------------ */

const FEAT_COLORS = CLASS_COLORS.slice(0, TOY_N);

export function figSuperposition(p: Page): void {
  p.figure({
    title: 'Five features in two dimensions',
    codeTitle: 'toy_superposition.py',
    code: `
      n, m, S = 5, 2, {{S:0.95}}
      I = 0.8 ** np.arange(n)   # importance
      W = 0.3 * np.random.randn(m, n)
      b = np.zeros(n)
      for step in range(6000):     # {{step:0}}
          f = np.random.rand(256, n)        #@data
          f[np.random.rand(256, n) < S] = 0 #@data
          x = f @ W.T              # (256, 2) #@fwd
          f_hat = relu(x @ W + b)  # (256, 5) #@fwd
          err = I * (f - f_hat) ** 2        #@loss
          loss = err.sum(1).mean()          #@loss
          W, b = adam(W, b, grads)          #@upd
      # loss {{loss}}; |W_i| > 0.5: {{kept}}
    `,
    setup(f) {
      let S = 0.95;
      let model = new ToyModel(S);
      let test = 0;
      const pl = f.plot({
        aspect: 1.3,
        domain: [-1.55, 1.55, -1.45, 1.45],
        draw: (pp) => {
          pp.axes({ grid: 0.5 });
          const ang = Array.from({ length: 121 }, (_, i) => (i / 120) * Math.PI * 2);
          pp.path(ang.map(Math.cos), ang.map(Math.sin), withAlpha(color('--ink-3'), 0.6), 1, [3, 4]);
          for (let i = TOY_N - 1; i >= 0; i--) {
            const [a, b] = model.col(i);
            const c = color(FEAT_COLORS[i]!);
            const nrm = Math.hypot(a, b);
            pp.arrow(0, 0, a, b, i === test ? c : withAlpha(c, 0.8), i === test ? 3.4 : 2.4);
            if (nrm > 0.15) pp.text(String(i + 1), a * (1 + 0.16 / nrm), b * (1 + 0.16 / nrm) - 0.06, { size: 13, bold: true, align: 'center', color: c });
          }
          pp.text('columns of W: where each feature points', -1.5, 1.37, { size: 11, color: color('--ink-2') });
        },
      });
      const bars = f.canvas(640, 200, (ctx, W, Hh) => {
        const wide = W >= 420;
        const gram = model.gram();
        const cs = Math.min(30, (wide ? W * 0.42 : W - 40) / TOY_N - 2);
        const gw = cs * TOY_N;
        const panelH = 22 + gw;
        const need = wide ? panelH + 34 : panelH + 26 + 152;
        if (fitHeight(bars.canvas, W, Hh, need)) return;
        const gx = wide ? 22 : (W - gw) / 2 + 8;
        text(ctx, 'Wᵀ W: overlaps between features', gx + gw / 2, 9, { size: 11, weight: 600, color: color('--ink-2') });
        for (let i = 0; i < TOY_N; i++) {
          text(ctx, String(i + 1), gx - 8, 22 + i * cs + cs / 2, { font: 'mono', size: 11, weight: 700, color: color(FEAT_COLORS[i]!) });
          for (let j = 0; j < TOY_N; j++) {
            const v = gram[i]![j]!;
            rbox(ctx, gx + j * cs + 1, 22 + i * cs + 1, cs - 2, cs - 2, 3, signed(v, 1.2, 'blue'), null);
            if (cs >= 26) text(ctx, num(v, 1), gx + j * cs + cs / 2, 22 + i * cs + cs / 2 + 0.5, { font: 'mono', size: 10, color: Math.abs(v) > 0.7 ? '#ffffff' : color('--ink') });
          }
        }
        // Feeding in one feature: pre-activations (outline) and outputs after the ReLU (filled).
        const bx = wide ? gx + gw + 40 : 8;
        const by = wide ? 22 : 22 + gw + 26;
        const bwAll = W - bx - 8;
        const bh = wide ? gw - 18 : 110;
        const mid = by + bh * 0.62;
        const sc = bh * 0.48;
        const fin = new Array<number>(TOY_N).fill(0);
        fin[test] = 1;
        const out = model.reconstruct(fin);
        const pre = Array.from({ length: TOY_N }, (_, k) => gram[k]![test]! + model.b[k]!);
        text(ctx, `input: feature ${test + 1} alone, at 1`, bx + bwAll / 2, by - 13, { size: 11, weight: 600, color: color('--ink-2') });
        line(ctx, bx, mid, bx + bwAll, mid, color('--axis'));
        const bw = bwAll / TOY_N;
        for (let k = 0; k < TOY_N; k++) {
          const c = color(FEAT_COLORS[k]!);
          const x = bx + k * bw + bw * 0.22;
          const ww = bw * 0.56;
          const pv = Math.max(-0.6, Math.min(1.25, pre[k]!));
          ctx.setLineDash([3, 2]);
          rbox(ctx, x, Math.min(mid, mid - pv * sc), ww, Math.max(1, Math.abs(pv) * sc), 2, null, withAlpha(c, 0.8), 1.2);
          ctx.setLineDash([]);
          const ov = Math.min(1.25, out[k]!);
          if (ov > 0.002) rbox(ctx, x, mid - ov * sc, ww, ov * sc, 2, withAlpha(c, 0.75), null);
          text(ctx, String(k + 1), x + ww / 2, mid + 10, { font: 'mono', size: 11, weight: 700, color: c });
          text(ctx, num(out[k]!, 2), x + ww / 2, Math.min(mid - Math.max(ov, Math.max(0, pv)) * sc - 8, mid - 8), { font: 'mono', size: 10, color: color('--ink-2') });
        }
        text(ctx, 'dashed: before the ReLU · filled: output', bx + bwAll / 2, by + bh + 8, { size: 10.5, color: color('--ink-3') });
      });
      bars.canvas.classList.add('scroll-ok');
      const lossRo = f.readout('loss', { sym: 'L' });
      const keptRo = f.readout('features kept');
      const kept = () => Array.from({ length: TOY_N }, (_, i) => Math.hypot(...model.col(i))).filter((v) => v > 0.5).length;
      const sync = () => {
        f.code.setMany({ step: model.steps, loss: fmt(model.loss, 3), kept: kept() });
        lossRo.set(fmt(model.loss, 3));
        keptRo.set(`${kept()} of 5`);
        pl.redraw();
        bars.redraw();
      };
      let ph = 0;
      const loop = f.loop(() => {
        model.train(60);
        f.code.highlight(['data', 'fwd', 'loss', 'upd'][ph++ % 4]!);
        sync();
        if (model.steps >= TOY_STEPS) {
          f.code.highlight(null);
          return false;
        }
      });
      const retrain = () => {
        model = new ToyModel(S);
        loop.start();
      };
      // Tap near an arrow tip to feed that feature in.
      pl.canvas.addEventListener('pointerdown', (e) => {
        const [x, y] = pl.pointer(e);
        let best = -1;
        let bd = 0.25;
        for (let i = 0; i < TOY_N; i++) {
          const [a, b] = model.col(i);
          const d = Math.hypot(a - x, b - y);
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
        if (best >= 0) seg.set(String(best), true);
      });
      f.slider({
        label: 'sparsity S',
        sym: 'S',
        min: 0,
        max: 0.98,
        step: 0.01,
        value: S,
        slot: 'S',
        format: (v) => v.toFixed(2),
        onInput: (v) => {
          S = v;
          retrain();
        },
      });
      const seg = f.segmented({
        label: 'feed in feature',
        options: Array.from({ length: TOY_N }, (_, i) => ({ value: String(i), label: String(i + 1) })),
        value: '0',
        onChange: (v) => {
          test = Number(v);
          sync();
        },
      });
      f.button('Retrain', retrain, { icon: 'reset' });
      retrain();
      void TOY_IMPORTANCE;
    },
    caption: `Five features, each a number between 0 and 1 that is zero with probability $\\symS$, must pass through two dimensions and come back out. Feature 1 matters most; each next one counts 0.8 times as much in the loss. Every change of the slider retrains the model from scratch (6,000 steps). **Dense features** ($\\symS = 0$): the model keeps the two most important, at right angles, and drops the rest, exactly what principal components would do. **Sparse features** (slide toward 0.95): it fits all five, as a pentagon, even though five directions in a plane must overlap. In between you will often see four, as two pairs of opposite arrows. The grid shows the overlaps $\\symW_i \\cdot \\symW_j$; the bars feed in one feature alone and show what comes out. Tap an arrow (or a number) to pick the feature.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: polysemantic neurons                                            */
/* ------------------------------------------------------------------ */

function featureHeader(ctx: CanvasRenderingContext2D, gx: number, gy: number, cw: number, hi: number[]): void {
  SAE_NAMES.forEach((nm, k) => {
    ctx.save();
    ctx.translate(gx + k * cw + cw / 2 + 3, gy - 6);
    ctx.rotate(-Math.PI / 3);
    text(ctx, nm, 0, 0, { size: 11, align: 'left', weight: hi.includes(k) ? 700 : 400, color: hi.includes(k) ? color('green') : color('--ink-3') });
    ctx.restore();
  });
}

export function figNeurons(p: Page): void {
  p.figure({
    title: 'Each neuron reads many features at once',
    codeTitle: 'neurons.py',
    code: `
      D = unit_vectors(8, 16)    # hidden truth  #@truth
      F = sparse_features(3000, 16)   # 5% on    #@truth
      X = F @ D.T        # (3000, 8): the layer  #@x
      n = {{n:3}}        # a neuron: a column of X
      top = np.argsort(-X[:, n])[:6]             #@top
      F[top]             # what was on           #@top
      D[n]               # its weight per feature  #@row
    `,
    setup(f) {
      const set = sampleSet(3000, 7);
      let sel = 3;
      let geo = { gx: 0, gy: 0, cw: 1, ch: 1 };
      const cv = f.canvas(640, 520, (ctx, W, Hh) => {
        const lab = 62;
        const cw = Math.min(30, (W - lab - 26) / SAE_N);
        const ch = Math.min(24, cw * 0.95);
        const gx = lab + (W - lab - 26 - cw * SAE_N) / 2;
        const gy = 76;
        const listTop = gy + SAE_D * ch + 30;
        const rowH = 22;
        const need = listTop + 6 * rowH + 10;
        if (fitHeight(cv.canvas, W, Hh, need)) return;
        geo = { gx, gy, cw, ch };
        const top = [...set.keys()].sort((a, b) => set[b]!.x[sel]! - set[a]!.x[sel]!).slice(0, 6);
        const on = new Set<number>();
        top.forEach((i) => set[i]!.f.forEach((v, k) => v > 0 && TRUE_DIRS[k]![sel]! > 0.2 && on.add(k)));
        featureHeader(ctx, gx, gy, cw, [...on]);
        for (let n = 0; n < SAE_D; n++) {
          text(ctx, `neuron ${n}`, gx - 6, gy + n * ch + ch / 2, { size: 11, align: 'right', weight: n === sel ? 700 : 400, color: n === sel ? color('--ink') : color('--ink-3') });
          for (let k = 0; k < SAE_N; k++) rbox(ctx, gx + k * cw + 1, gy + n * ch + 1, cw - 2, ch - 2, 3, signed(TRUE_DIRS[k]![n]!, 0.75, 'orange'), null);
        }
        rbox(ctx, gx - 1, gy + sel * ch - 1, SAE_N * cw + 2, ch + 2, 3, null, color('--ink'), 1.6);
        text(ctx, `neuron ${sel}: its six strongest activations, and what was on`, 4, listTop - 12, { size: 11.5, weight: 600, align: 'left', color: color('--ink-2') });
        top.forEach((i, r) => {
          const s = set[i]!;
          const y = listTop + r * rowH + rowH / 2;
          text(ctx, num(s.x[sel]!, 2), 4, y, { font: 'mono', size: 11, align: 'left', color: color('orange') });
          let x = 46;
          [...s.f.keys()]
            .filter((k) => s.f[k]! > 0)
            .sort((a, b) => s.f[b]! * TRUE_DIRS[b]![sel]! - s.f[a]! * TRUE_DIRS[a]![sel]!)
            .forEach((k) => {
              const label = `${SAE_NAMES[k]} ${num(s.f[k]!, 1)}`;
              const tw = measure(ctx, label, { size: 11 }) + 12;
              if (x + tw > W - 2) return;
              const strong = TRUE_DIRS[k]![sel]! > 0.2;
              rbox(ctx, x, y - 9, tw, 18, 9, withAlpha(color('green'), strong ? 0.22 : 0.06), withAlpha(color('green'), strong ? 0.8 : 0.3), 1);
              text(ctx, label, x + tw / 2, y + 0.5, { size: 11, weight: strong ? 600 : 400, color: color('--ink') });
              x += tw + 5;
            });
        });
      });
      cv.canvas.classList.add('scroll-ok');
      cv.canvas.addEventListener('pointerdown', (e) => {
        const r = cv.canvas.getBoundingClientRect();
        const n = Math.floor((e.clientY - r.top - geo.gy) / geo.ch);
        if (n >= 0 && n < SAE_D) {
          sel = n;
          f.code.set('n', n);
          f.code.highlight(['top', 'row']);
          cv.redraw();
        }
      });
    },
    caption: `A synthetic layer of 8 neurons whose activations are built from 16 sparse features with known directions (we name them to make the pictures readable; nothing in the math knows what "French" means). The grid is the hidden truth: how strongly each feature pushes each neuron (orange up, gray down). **Tap a neuron.** Its strongest activations come from several unrelated features, which is what a *polysemantic* neuron looks like from the outside: no single label fits it. Nothing is wrong with the neurons. There are simply more features than neurons, so the features cannot each have one.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: a sparse autoencoder                                            */
/* ------------------------------------------------------------------ */

export function figSAE(p: Page): void {
  p.figure({
    title: 'A sparse autoencoder pulls the features back out',
    codeTitle: 'sae.py',
    code: `
      m, lam = {{m:16}}, {{lam:0.2}}
      W_dec = unit_cols(randn(8, m))  # (8, m)
      W_enc = W_dec.T.copy()
      b_enc, b_dec = zeros(m), zeros(8)
      for step in range(3000):     # {{step:0}}
          X = sample_activations(256)    #@data
          Xc = X - b_dec                 #@enc
          f = relu(Xc @ W_enc.T + b_enc) #@enc
          X_hat = f @ W_dec.T + b_dec    #@dec
          mse = ((X - X_hat)**2).sum(1)  #@loss
          loss = (mse + lam * f.sum(1)).mean()  #@loss
          adam_step()                    #@upd
          W_dec /= norm(W_dec, axis=0)   #@upd
      # unexplained {{fvu}}, active {{l0}}
      # recovered (|cos| > 0.9): {{rec}} of 16
    `,
    setup(f) {
      const evalSet = sampleSet(1500, 99);
      let m = 16;
      let lam = 0.2;
      let sae = new SAE(m, lam);
      let stats = sae.evaluate(evalSet);
      const cv = f.canvas(640, 560, (ctx, W, Hh) => {
        const lab = 24;
        const cw = Math.min(30, (W - lab - 26) / SAE_N);
        const ch = m <= 16 ? 18 : 10;
        const gx = lab + (W - lab - 26 - cw * SAE_N) / 2;
        const gy = 76;
        const need = gy + m * ch + 30;
        if (fitHeight(cv.canvas, W, Hh, need)) return;
        const M = sae.match();
        const best = M.map((r) => r.indexOf(Math.max(...r)));
        const order = [...M.keys()].sort((a, b) => best[a]! - best[b]! || M[b]![best[b]!]! - M[a]![best[a]!]!);
        const rec = Array.from({ length: SAE_N }, (_, k) => Math.max(...M.map((r) => r[k]!)) > 0.9);
        featureHeader(ctx, gx, gy, cw, rec.flatMap((v, k) => (v ? [k] : [])));
        order.forEach((j, r) => {
          for (let k = 0; k < SAE_N; k++) {
            const v = M[j]![k]!;
            ctx.fillStyle = withAlpha(color('green'), 0.04 + 0.9 * v ** 2);
            ctx.fillRect(gx + k * cw + 1, gy + r * ch + (ch >= 12 ? 1 : 0.5), cw - 2, ch - (ch >= 12 ? 2 : 1));
          }
        });
        ctx.save();
        ctx.translate(gx - 10, gy + (m * ch) / 2);
        ctx.rotate(-Math.PI / 2);
        text(ctx, `the SAE's ${m} learned features`, 0, 0, { size: 10.5, color: color('--ink-3') });
        ctx.restore();
        text(ctx, W < 470 ? 'bright: same direction as a true feature' : '|cos| between each learned feature and each true one: bright = the same direction', W / 2, gy + m * ch + 16, { size: 10.5, color: color('--ink-3') });
      });
      cv.canvas.classList.add('scroll-ok');
      const fvuRo = f.readout('unexplained variance');
      const l0Ro = f.readout('active per input', { sym: 'f' });
      const recRo = f.readout('recovered');
      const recovered = () => {
        const M = sae.match();
        return Array.from({ length: SAE_N }, (_, k) => Math.max(...M.map((r) => r[k]!))).filter((v) => v > 0.9).length;
      };
      const sync = () => {
        stats = sae.evaluate(evalSet);
        const rec = recovered();
        f.code.setMany({ step: sae.steps, fvu: stats.fvu.toFixed(3), l0: stats.l0.toFixed(2), rec });
        fvuRo.set(`${(stats.fvu * 100).toFixed(1)}%`);
        l0Ro.set(fmt(stats.l0, 2));
        recRo.set(`${rec} of 16`);
        cv.redraw();
      };
      let ph = 0;
      const loop = f.loop(() => {
        sae.train(m > 16 ? 12 : 20);
        f.code.highlight(['data', 'enc', 'dec', 'loss', 'upd'][ph++ % 5]!);
        sync();
        if (sae.steps >= SAE_STEPS) {
          f.code.highlight(null);
          f.status(`Trained: ${SAE_STEPS} steps. The true features average 0.8 active per input.`);
          return false;
        }
      });
      const restart = () => {
        loop.stop();
        sae = new SAE(m, lam);
        f.status('');
        sync();
        loop.start();
      };
      f.slider({
        label: 'L1 weight λ',
        sym: 'lam',
        min: -2,
        max: 0,
        step: 0.05,
        value: Math.log10(lam),
        map: (r) => 10 ** r,
        format: (v) => fmt(v, 2),
        slot: 'lam',
        onInput: (v) => {
          lam = v;
          restart();
        },
      });
      f.segmented({
        label: 'dictionary size',
        options: [
          { value: '8', label: '8' },
          { value: '16', label: '16' },
          { value: '32', label: '32' },
        ],
        value: '16',
        slot: 'm',
        onChange: (v) => {
          m = Number(v);
          restart();
        },
      });
      f.button('Retrain', restart, { icon: 'reset' });
      restart();
    },
    caption: `The same 8-neuron activations as the last figure, now handed to a sparse autoencoder that has never seen the true directions. Each row is one learned feature (a column of $\\symW$, the decoder), compared with all 16 true ones. At the default $\\symlam = 0.2$ almost every true feature gets a learned feature of its own: the grid becomes a diagonal, and names light up as they are recovered. **Slide $\\symlam$ down** toward 0.01: the reconstruction gets nearly perfect, but each input uses several learned features and they stop matching the truth, because nothing pushes them to be sparse. **Push it up** to 1 and the features stay clean but the reconstruction gets worse: the L1 penalty shrinks every activation. Change the **dictionary size**: with 8, features have to share; with 32, some learned features duplicate or never fire.`,
  });
}

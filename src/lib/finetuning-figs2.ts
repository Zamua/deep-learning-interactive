import type { Page } from '../core/page';
import { fmt } from '../core/code';
import { type Plot, color, rgbOf, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { INT4, MODELS, NF4, NF4_BITS, type Targets, budget, quantize } from './finetuning-linalg';
import { DSTEPS, LD, LSTEPS, LoraRun, NEXT, OUTLIERS, QW, Student, TASK, TEACH, type Init } from './finetuning-toys';

const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";
const UI = 'system-ui, sans-serif';

/** A small signed heatmap with a caption above it. */
function heatSigned(ctx: CanvasRenderingContext2D, a: ArrayLike<number>, n: number, m: number, x: number, y: number, size: number, scale: number, label: string, labelColor: string) {
  const pos = rgbOf(color('teal')), neg = rgbOf(color('purple')), mid = rgbOf(color('--card'));
  const cs = size / m;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      const t = Math.max(-1, Math.min(1, a[i * m + j]! / scale));
      const k = t >= 0 ? pos : neg;
      const u = Math.abs(t) ** 0.8;
      const c = [0, 1, 2].map((q) => Math.round(mid[q]! + (k[q]! - mid[q]!) * u));
      ctx.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.fillRect(x + j * cs, y + i * cs, cs + 0.5, cs + 0.5);
    }
  ctx.strokeStyle = color('--rule');
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, size - 1, (size * n) / m - 1);
  ctx.font = `600 12px ${UI}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = labelColor;
  ctx.fillText(label, x + size / 2, y - 7);
}

/* ------------------------------------------------------------------ */
/* Fig: training a LoRA adapter, and why B starts at zero              */
/* ------------------------------------------------------------------ */

export function figLoraTrain(p: Page): void {
  p.figure({
    title: 'Training a LoRA adapter: rank, and why B starts at zero',
    codeTitle: 'lora_train.py',
    code: `
      d = k = 16; r = {{r:2}}; alpha = 8
      A = {{initA:np.random.randn(r, k) / np.sqrt(k)}}   #@init
      B = {{initB:np.zeros((d, r))}}                     #@init
      for step in range(300):
          dW = (alpha / r) * B @ A                      #@fwd
          err = X @ (W0 + dW).T - Y                     #@fwd
          loss = np.mean(err ** 2)                      #@loss
          G = 2 * err.T @ X / err.size  # dL/dW  #@grad
          dB = (alpha / r) * G @ A.T                    #@grad
          dA = (alpha / r) * B.T @ G                    #@grad
          adam(B, dB); adam(A, dA)                      #@upd
      # step {{step:0}}  loss {{loss:…}}
    `,
    setup(f) {
      let r = 2;
      let init: Init = 'lora';
      let run = new LoraRun(r, init);
      let ghosts: { r: number; init: Init; losses: number[] }[] = [];
      const cv = f.canvas(640, 250, (ctx, w, hh) => {
        const gap = Math.max(16, w * 0.06);
        const size = Math.min((w - gap) / 2, hh - 34);
        const x0 = (w - 2 * size - gap) / 2;
        const sc = 0.35;
        heatSigned(ctx, TASK.target, LD, LD, x0, 22, size, sc, 'needed (rank 2)', color('--ink-2'));
        heatSigned(ctx, run.dW, LD, LD, x0 + size + gap, 22, size, sc, `learned ΔW, r = ${r}`, color('teal'));
        if (run.dW.every((v) => v === 0)) {
          ctx.font = `12px ${UI}`;
          ctx.fillStyle = color('--ink-3');
          ctx.textAlign = 'center';
          ctx.fillText('all zeros', x0 + size * 1.5 + gap, 22 + size / 2 + 4);
        }
      });
      const pl = f.plot({
        height: 170,
        square: false,
        domain: [0, LSTEPS, -4.3, 2.5],
        draw: (pp: Plot) => {
          const c = pp.ctx;
          c.strokeStyle = color('--grid');
          c.lineWidth = 1;
          c.font = `10.5px ${MONO}`;
          c.fillStyle = color('--ink-3');
          c.textAlign = 'left';
          for (let e = -4; e <= 2; e++) {
            const y = Math.round(pp.sy(e)) + 0.5;
            c.beginPath();
            c.moveTo(0, y);
            c.lineTo(pp.w, y);
            c.stroke();
            if (e % 2 === 0 && y > 16) c.fillText(e === 0 ? '1' : `1e${e}`, 4, y - 3);
          }
          const lg = (v: number) => Math.max(-4.1, Math.log10(Math.max(v, 1e-6)));
          for (const g of ghosts) pp.path(g.losses.map((_, i) => i), g.losses.map(lg), withAlpha(color('--ink-3'), 0.55), 1.3, [4, 4]);
          const b0 = Math.log10(new LoraRun(1, 'lora').losses[0]!);
          pp.path([0, LSTEPS], [b0, b0], withAlpha(color('blue'), 0.8), 1.2, [2, 3]);
          c.fillStyle = color('blue');
          c.font = `11px ${UI}`;
          c.textAlign = 'right';
          c.fillText('the pretrained model, unchanged', pp.w - 6, pp.sy(b0) - 5);
          if (run.losses.length > 1) pp.path(run.losses.map((_, i) => i), run.losses.map(lg), color('red'), 2);
          pp.dot(0, lg(run.losses[0]!), 3.5, color('red'));
          c.fillStyle = color('red');
          c.font = `600 11.5px ${UI}`;
          c.textAlign = 'right';
          c.fillText(`loss at step 0: ${fmt(run.losses[0]!, 3)}`, pp.w - 6, 14);
        },
      });
      const lossRo = f.readout('loss', { sym: 'L' });
      const parRo = f.readout('trainable');
      const sync = () => {
        const L = run.losses[run.t]!;
        f.code.setMany({ step: run.t, loss: fmt(L, 3) });
        lossRo.set(fmt(L, 3));
        parRo.set(`${r * 2 * LD} of ${LD * LD}`);
        cv.redraw();
        pl.redraw();
      };
      let phase = 0;
      const loop = f.loop(() => {
        for (let k = 0; k < 2 && run.t < LSTEPS; k++) run.step();
        f.code.highlight(['fwd', 'loss', 'grad', 'upd'][phase++ % 4]!);
        sync();
        if (run.t >= LSTEPS) {
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
          if (run.t >= LSTEPS) restart();
          loop.start();
          btn.textContent = 'Pause';
        }
      }, { primary: true });
      const restart = () => {
        if (run.t > 5) ghosts = [...ghosts.slice(-2), { r: run.r, init, losses: run.losses.slice() }];
        run = new LoraRun(r, init);
        f.code.highlight('init');
        sync();
      };
      f.button('Reset', () => {
        stop();
        restart();
      });
      f.segmented({
        label: 'rank r',
        options: [1, 2, 4, 8].map((v) => ({ value: String(v), label: String(v) })),
        value: '2',
        onChange: (v) => {
          r = Number(v);
          f.code.set('r', r);
          stop();
          restart();
        },
      });
      f.segmented({
        label: 'start',
        options: [
          { value: 'lora', label: 'B = 0' },
          { value: 'rand', label: 'both random' },
          { value: 'zero', label: 'both zero' },
        ],
        value: 'lora',
        onChange: (v) => {
          init = v;
          f.code.setMany({
            initA: v === 'zero' ? 'np.zeros((r, k))' : 'np.random.randn(r, k) / np.sqrt(k)',
            initB: v === 'rand' ? 'np.random.randn(d, r) / np.sqrt(r)' : 'np.zeros((d, r))',
          });
          stop();
          restart();
        },
      });
      sync();
    },
    caption: `A frozen 16 by 16 matrix $\\symW$ meets a new task that needs it changed by a rank-2 update (left). LoRA learns $\\symdW = \\frac{\\symalpha}{\\symr}\\symB\\symA$ (right) with Adam; the plot is the loss on a log scale, and the blue line is the loss of the untouched pretrained model. Press **Train**. With $\\symr = 1$ the adapter can only learn the stronger of the two directions and the loss stalls; with 2 or more it solves the task. Now set **start** to *both random*: at step 0 the model is already damaged, worse than the pretrained one, before it has learned anything. With *both zero*, every gradient is zero and nothing ever moves. Dashed lines are your previous runs.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: 4-bit quantization, NF4 against plain int4                     */
/* ------------------------------------------------------------------ */

export function figNF4(p: Page): void {
  p.figure({
    title: '4-bit weights: NF4 levels against evenly spaced ones',
    codeTitle: 'nf4.py',
    code: `
      w = weights.reshape(-1, {{block:64}})  #@blocks
      c = np.abs(w).max(1, keepdims=True)  #@scale
      z = w / c            # in [-1, 1]     #@norm
      d = np.abs(z[..., None] - LEVELS)     #@code
      q = d.argmin(-1)     # 4-bit codes    #@code
      w_hat = LEVELS[q] * c                 #@deq
      rmse = np.sqrt(np.mean((w_hat - w) ** 2))  #@err
      # rmse = {{rmse:…}}
      # LEVELS = {{lv:NF4}}: {{bits:4.5}} bits/weight
    `,
    setup(f) {
      let lv: 'nf4' | 'int4' = 'nf4';
      let block = 64;
      let outl = false;
      const pl = f.plot({
        aspect: 1.55,
        square: false,
        domain: [-1.08, 1.08, -0.42, 1.12],
        draw: (pp) => {
          const w = outl ? OUTLIERS : QW;
          const levels = lv === 'nf4' ? NF4 : INT4;
          const q = quantize(w, block, levels);
          const bins = 72;
          const hist = new Array(bins).fill(0);
          for (const z of q.z) hist[Math.min(bins - 1, Math.floor(((z + 1) / 2) * bins))]++;
          const hm = Math.max(...hist);
          const c = pp.ctx;
          const bw = 2 / bins;
          c.fillStyle = withAlpha(color('blue'), 0.35);
          hist.forEach((n, i) => {
            const x0 = pp.sx(-1 + i * bw), x1 = pp.sx(-1 + (i + 1) * bw);
            const y1 = pp.sy((0.86 * n) / hm);
            c.fillRect(x0, y1, x1 - x0 - 0.5, pp.sy(0) - y1);
          });
          const col = lv === 'nf4' ? color('green') : color('orange');
          for (const l of levels) pp.path([l, l], [0, 0.95], withAlpha(col, 0.85), 1.3);
          // usage of each level
          const cm = Math.max(...q.counts);
          const uw = 0.05;
          levels.forEach((l, i) => {
            const hgt = (0.3 * q.counts[i]!) / cm;
            c.fillStyle = withAlpha(col, 0.75);
            c.fillRect(pp.sx(l - uw / 2), pp.sy(-0.06), pp.sx(l + uw / 2) - pp.sx(l - uw / 2), pp.sy(-0.06 - hgt) - pp.sy(-0.06));
          });
          pp.path([-1.05, 1.05], [0, 0], color('--axis'), 1);
          c.font = `11px ${UI}`;
          c.fillStyle = color('--ink-3');
          c.textAlign = 'left';
          c.fillText(`z = w / absmax, from -1 to 1, and the ${levels.length} levels`, pp.sx(-1.05), pp.sy(1.0) - 2);
          c.fillText('how many weights land on each level', pp.sx(-1.05), pp.sy(-0.4) - 2);
        },
      });
      const nfRo = f.readout('NF4 error');
      const inRo = f.readout('int4 error');
      const bitRo = f.readout('bits per weight');
      const sync = () => {
        const w = outl ? OUTLIERS : QW;
        const a = quantize(w, block, NF4), b = quantize(w, block, INT4);
        nfRo.set(fmt(a.rmse, 3));
        inRo.set(fmt(b.rmse, 3));
        bitRo.set(fmt(4 + 32 / block, 3));
        f.code.setMany({ rmse: fmt(lv === 'nf4' ? a.rmse : b.rmse, 3), bits: fmt(4 + 32 / block, 3), block, lv: lv === 'nf4' ? 'NF4' : 'INT4' });
        pl.redraw();
      };
      f.segmented({
        label: 'levels',
        options: [
          { value: 'nf4', label: 'NF4' },
          { value: 'int4', label: 'int4' },
        ],
        value: 'nf4',
        onChange: (v) => {
          lv = v;
          f.code.highlight(['code', 'deq']);
          sync();
        },
      });
      f.segmented({
        label: 'block size',
        options: [16, 64, 256, 8192].map((v) => ({ value: String(v), label: v === 8192 ? 'whole' : String(v) })),
        value: '64',
        onChange: (v) => {
          block = Number(v);
          f.code.highlight(['blocks', 'scale']);
          sync();
        },
      });
      f.toggle({
        label: 'add 6 outliers',
        value: false,
        onChange: (v) => {
          outl = v;
          f.code.highlight('err');
          sync();
        },
      });
      sync();
    },
    caption: `8,192 weights drawn from a bell curve (standard deviation 1), quantized in blocks: divide each block by its largest absolute value, then snap to one of 16 levels (int4 uses 15). The blue histogram is the normalized weights; vertical lines are the levels, and the bars underneath count how many weights each level receives. **int4** spaces its levels evenly ($k/7$), so the outer levels see few weights while the crowded middle is coarse. **NF4** places its levels at quantiles of a normal distribution: dense near zero where the weights are, so the levels share the work more evenly and the error (in units of the weights' spread) is lower. Try the block size: one scale for the *whole* tensor wastes range, and with **outliers** on, a single huge weight squashes everything else in its block toward zero. Small blocks cost bits for the scales: $4 + 32/\\text{block}$ per weight.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: memory for full fine-tuning, LoRA and QLoRA                    */
/* ------------------------------------------------------------------ */

export function figMemory(p: Page): void {
  p.figure({
    title: 'What fits: memory for full fine-tuning, LoRA and QLoRA',
    codeTitle: 'memory.py',
    code: `
      N = {{N:6.74e9}}   # all parameters
      mats = {{tg:["q", "v"]}}
      lora = L * sum(r * (k + d)          #@lora
                     for k, d in shapes(mats))   #@lora
      # trainable: {{lora:…}} ({{pct:…}} of N)

      full = 2*N + 2*N + 12*N   # 16 bytes  #@full
      lora_ft = 2*N + 16*lora   # bf16 base       #@lorab
      qlora = {{nb:0.516}}*N_lin + 2*N_emb + 16*lora   #@qlora
      # GB: {{gf:…}}, {{gl:…}}, {{gq:…}}
    `,
    setup(f) {
      let mk = '7b';
      let tg: Targets = 'qv';
      let r = 8;
      const cv = f.canvas(640, 300, (ctx, w, hh) => {
        const B = budget(MODELS[mk]!, tg, r);
        const rows: [string, [number, number, number]][] = [['full', B.full], ['LoRA', B.loraB], ['QLoRA', B.qlora]];
        const maxGB = Math.max(...rows.map(([, v]) => (v[0] + v[1] + v[2]) / 1e9));
        const scaleMax = [24, 48, 80, 160, 320, 640, 1280].find((g) => g >= maxGB) ?? 1280;
        const left = 58, right = 14;
        const W = w - left - right;
        const xs = (gb: number) => left + (W * gb) / scaleMax;
        const rowH = Math.min(30, (hh - 62) / 4.05);
        const top = 26;
        ctx.font = `10.5px ${MONO}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = color('--ink-3');
        const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * scaleMax);
        for (const t of ticks) {
          ctx.strokeStyle = color('--grid');
          ctx.beginPath();
          ctx.moveTo(Math.round(xs(t)) + 0.5, top - 6);
          ctx.lineTo(Math.round(xs(t)) + 0.5, top + 3 * rowH * 1.35);
          ctx.stroke();
          ctx.fillText(`${Math.round(t)}`, xs(t), top - 10);
        }
        ctx.textAlign = 'right';
        ctx.fillText('GB', left - 8, top - 10);
        // GPU sizes
        for (const g of [24, 80]) {
          if (g > scaleMax || (g === 24 && xs(80) - xs(24) < 70)) continue;
          const x = Math.round(xs(g)) + 0.5;
          ctx.strokeStyle = color('--ink-3');
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(x, top - 4);
          ctx.lineTo(x, top + 3 * rowH * 1.35 - 6);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = color('--ink-3');
          ctx.font = `10.5px ${UI}`;
          ctx.textAlign = 'center';
          ctx.fillText(`${g} GB GPU`, x, top + 3 * rowH * 1.35 + 8);
        }
        const cols = [color('blue'), color('teal'), color('red')];
        rows.forEach(([nm, v], i) => {
          const y = top + i * rowH * 1.35;
          ctx.fillStyle = color('--ink-2');
          ctx.font = `600 12.5px ${UI}`;
          ctx.textAlign = 'right';
          ctx.fillText(nm, left - 8, y + rowH / 2 + 4);
          let x = 0;
          v.forEach((b, j) => {
            const gb = b / 1e9;
            ctx.fillStyle = withAlpha(cols[j]!, 0.75);
            ctx.fillRect(xs(x), y, Math.max(gb > 0 ? 1 : 0, xs(x + gb) - xs(x)), rowH);
            x += gb;
          });
          ctx.fillStyle = color('--ink');
          ctx.font = `600 11.5px ${MONO}`;
          const lab = `${x < 10 ? x.toFixed(1) : Math.round(x)} GB`;
          const tw = ctx.measureText(lab).width;
          const lx = xs(x) + 6;
          const inside = lx + tw > w - 2;
          if (!inside) {
            ctx.fillStyle = color('--paper');
            ctx.fillRect(lx - 3, y + rowH / 2 - 8, tw + 6, 16);
          }
          ctx.textAlign = inside ? 'right' : 'left';
          ctx.fillStyle = inside ? color('--paper') : color('--ink');
          ctx.fillText(lab, inside ? xs(x) - 6 : lx, y + rowH / 2 + 4);
        });
        // legend
        const ly = hh - 10;
        const items = ['weights', 'gradients', 'Adam + fp32 copy'];
        ctx.font = `11px ${UI}`;
        ctx.textAlign = 'left';
        let lx = left;
        items.forEach((t, j) => {
          ctx.fillStyle = withAlpha(cols[j]!, 0.75);
          ctx.fillRect(lx, ly - 9, 10, 10);
          ctx.fillStyle = color('--ink-2');
          ctx.fillText(t, lx + 14, ly);
          lx += 14 + ctx.measureText(t).width + 14;
        });
      });
      const trRo = f.readout('trainable', { sym: 'r' });
      const sync = () => {
        const M = MODELS[mk]!;
        const B = budget(M, tg, r);
        const gb = (v: number[]) => `${((v[0]! + v[1]! + v[2]!) / 1e9).toFixed(1)}`;
        const pct = (100 * B.lora) / B.total;
        const mill = B.lora / 1e6;
        f.code.setMany({
          N: `${(B.total / 1e9).toFixed(2)}e9`,
          tg: tg === 'qv' ? '["q", "v"]' : tg === 'attn' ? '["q", "k", "v", "o"]' : 'ALL_LINEAR',
          lora: `${mill < 10 ? mill.toFixed(2) : mill.toFixed(1)}M`,
          pct: `${pct < 0.1 ? pct.toFixed(3) : pct.toFixed(2)}%`,
          nb: fmt(NF4_BITS / 8, 3),
          gf: gb(B.full),
          gl: gb(B.loraB),
          gq: gb(B.qlora),
        });
        trRo.set(`${mill < 10 ? mill.toFixed(2) : mill.toFixed(1)}M (${pct < 0.1 ? pct.toFixed(3) : pct.toFixed(2)}%)`);
        cv.redraw();
      };
      f.segmented({
        label: 'model',
        options: Object.keys(MODELS).map((k) => ({ value: k, label: k.toUpperCase() })),
        value: '7b',
        onChange: (v) => {
          mk = v;
          f.code.highlight(['full', 'lorab', 'qlora']);
          sync();
        },
      });
      f.segmented({
        label: 'adapt',
        options: [
          { value: 'qv', label: 'q, v' },
          { value: 'attn', label: 'attention' },
          { value: 'all', label: 'all linear' },
        ],
        value: 'qv',
        onChange: (v) => {
          tg = v;
          f.code.highlight('lora');
          sync();
        },
      });
      f.slider({
        label: 'rank r',
        sym: 'r',
        min: 0,
        max: 8,
        step: 1,
        value: 3,
        map: (v) => 2 ** Math.round(v),
        format: (v) => String(v),
        onInput: (v) => {
          r = v;
          f.code.highlight('lora');
          sync();
        },
      });
      sync();
    },
    caption: `Bytes per parameter, before activations: full fine-tuning with Adam in mixed precision keeps bf16 weights and gradients (2 + 2) plus an fp32 master copy and two fp32 Adam moments (4 + 8), about 16 bytes. LoRA keeps the base in bf16 with no gradients or optimizer state, and pays 16 bytes only for the adapter. QLoRA stores the base model's linear layers in NF4 at about 4.13 bits each (embeddings stay in bf16). Model shapes are those of Llama 3.2 1B and Llama 2 7B and 70B. Try 70B: full fine-tuning needs a cluster, LoRA still needs several GPUs, and QLoRA fits on one large card.`,
  });
}

/* ------------------------------------------------------------------ */
/* Fig: distillation from samples versus from probabilities            */
/* ------------------------------------------------------------------ */

export function figDistill(p: Page): void {
  p.figure({
    title: 'Learning from a teacher: its samples or its probabilities',
    codeTitle: 'distill.py',
    code: `
      prompt = "The capital of Australia is"
      p_t = teacher.probs(prompt)    # (V,)
      z_hard = np.zeros(V)
      z_soft = np.zeros(V)
      lr = 0.25
      for step in range(300):
          y = np.random.choice(V, p=p_t)         #@hard
          g_hard = softmax(z_hard) - onehot(y)   #@hard
          g_soft = softmax(z_soft) - p_t         #@soft
          z_hard -= lr * g_hard                  #@hard
          z_soft -= lr * g_soft                  #@soft
      # step {{step:0}}
      # KL, samples:       {{kh:…}}
      # KL, probabilities: {{ks:…}}
    `,
    setup(f) {
      let hard = new Student(), soft = new Student();
      let rng = new Rng(21);
      let step = 0;
      const lr = 0.25;
      hard.measure();
      soft.measure();
      const cv = f.canvas(640, 330, (ctx, w, hh) => {
        const left = 92;
        const rowH = (hh - 42) / NEXT.length;
        const W = w - left - 12;
        const xs = (v: number) => left + W * (v / 0.7);
        const qh = hard.probs(), qs = soft.probs();
        ctx.font = `11px ${UI}`;
        ctx.fillStyle = color('--ink-3');
        ctx.textAlign = 'left';
        ctx.fillText('next-word probabilities', left, 12);
        NEXT.forEach((wd, i) => {
          const y = 22 + i * rowH;
          ctx.fillStyle = color('--ink-2');
          ctx.font = `12px ${MONO}`;
          ctx.textAlign = 'right';
          ctx.fillText(wd, left - 8, y + rowH * 0.62);
          const bh = rowH * 0.3;
          ctx.fillStyle = withAlpha(color('orange'), 0.8);
          ctx.fillRect(xs(0), y + rowH * 0.12, xs(qh[i]!) - xs(0), bh);
          ctx.fillStyle = withAlpha(color('green'), 0.8);
          ctx.fillRect(xs(0), y + rowH * 0.12 + bh + 1, xs(qs[i]!) - xs(0), bh);
          ctx.strokeStyle = color('--ink');
          ctx.lineWidth = 2;
          const tx = Math.round(xs(TEACH[i]!)) + 0.5;
          ctx.beginPath();
          ctx.moveTo(tx, y + rowH * 0.05);
          ctx.lineTo(tx, y + rowH * 0.12 + 2 * bh + 4);
          ctx.stroke();
        });
        ctx.font = `11px ${UI}`;
        ctx.textAlign = 'right';
        const ly = hh - 4;
        ctx.fillStyle = color('--ink');
        ctx.fillText('| teacher', w - 8, ly);
        ctx.fillStyle = color('green');
        ctx.fillText('probabilities', w - 70, ly);
        ctx.fillStyle = color('orange');
        ctx.fillText('samples', w - 158, ly);
      });
      const pl = f.plot({
        height: 120,
        square: false,
        domain: [0, DSTEPS, -3.3, 0.5],
        draw: (pp) => {
          const c = pp.ctx;
          c.strokeStyle = color('--grid');
          c.font = `10.5px ${MONO}`;
          c.fillStyle = color('--ink-3');
          c.textAlign = 'left';
          for (let e = -3; e <= 0; e++) {
            const y = Math.round(pp.sy(e)) + 0.5;
            c.beginPath();
            c.moveTo(0, y);
            c.lineTo(pp.w, y);
            c.stroke();
            c.fillText(e === 0 ? '1' : `1e${e}`, 4, y - 3);
          }
          const lg = (v: number) => Math.max(-3.3, Math.log10(Math.max(v, 1e-6)));
          pp.path(hard.kl.map((_, i) => i), hard.kl.map(lg), color('orange'), 2);
          pp.path(soft.kl.map((_, i) => i), soft.kl.map(lg), color('green'), 2);
          c.fillStyle = color('--ink-3');
          c.font = `11px ${UI}`;
          c.textAlign = 'right';
          c.fillText('KL(teacher ‖ student), log scale', pp.w - 6, 13);
        },
      });
      const sync = () => {
        f.code.setMany({ step, kh: fmt(hard.kl[step]!, 3), ks: fmt(soft.kl[step]!, 3) });
        cv.redraw();
        pl.redraw();
      };
      let ph = 0;
      const loop = f.loop(() => {
        for (let k = 0; k < 2 && step < DSTEPS; k++) {
          let u = rng.next();
          let y = 0;
          while (y < TEACH.length - 1 && u > TEACH[y]!) u -= TEACH[y++]!;
          hard.step(TEACH.map((_, i) => (i === y ? 1 : 0)), lr);
          soft.step(TEACH, lr);
          step++;
        }
        f.code.highlight(ph++ % 2 ? 'soft' : 'hard');
        sync();
        if (step >= DSTEPS) {
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
          if (step >= DSTEPS) reset();
          loop.start();
          btn.textContent = 'Pause';
        }
      }, { primary: true });
      const reset = () => {
        hard = new Student();
        soft = new Student();
        hard.measure();
        soft.measure();
        rng = new Rng(Math.floor(Math.random() * 1e6));
        step = 0;
        sync();
      };
      f.button('Reset', () => {
        stop();
        reset();
      });
      sync();
    },
    caption: `A made-up teacher's next-word distribution after *The capital of Australia is* (black ticks), and two students that start from uniform guesses. The orange student sees one sampled word per step and is trained on it as a label: this is fine-tuning on the teacher's generated text. The green student is trained toward the teacher's whole distribution. Press **Train**: the green student converges smoothly, while the orange one keeps jittering, because a single sample says only "this word", never how plausible the other words were. Its gradient is the green one plus noise. Reset to draw new samples.`,
  });
}

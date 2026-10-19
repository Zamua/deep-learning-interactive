import { fmt } from '../../core/code';
import { Rng } from '../../core/rand';
import { type Scene, type SceneDef, clamp01, lerp } from '../../lecture/scene';
import { INT4, MODELS, NF4, budget, quantize } from '../../lib/finetuning-linalg';
import { DSTEPS, LSTEPS, LoraRun, NEXT, QW, Student, TEACH } from '../../lib/finetuning-toys';
import { type K, box, chip, chipW, current, flowLayout, frame, path, swatch, wsub } from './kit';

// ---------------------------------------------------------------- lora

/** Loss curves of the chapter's LoRA toy at rank 2, for the three ways to start. */
const LORA_RUNS = (['lora', 'rand', 'zero'] as const).map((init) => {
  const run = new LoraRun(2, init);
  while (run.t < LSTEPS) run.step();
  return run.losses.map((v, i) => [i, Math.log10(Math.max(v, 1e-6))] as [number, number]);
});

/** A trapezoid from x0 to x1, its height going from h0 to h1, centered on y. */
function trap(s: Scene, x0: number, x1: number, y: number, h0: number, h1: number, k: K, a = 0.35, dashed = false) {
  const c = s.ctx;
  c.save();
  c.beginPath();
  c.moveTo(x0, y - h0 / 2);
  c.lineTo(x1, y - h1 / 2);
  c.lineTo(x1, y + h1 / 2);
  c.lineTo(x0, y + h0 / 2);
  c.closePath();
  c.fillStyle = s.tint(k, dashed ? 0.04 : a);
  c.fill();
  if (dashed) c.setLineDash([s.u, s.u * 0.7]);
  c.strokeStyle = s.c(k);
  c.lineWidth = s.u * 0.4;
  c.stroke();
  c.restore();
}

const lora: SceneDef = {
  marks: {
    h: { tex: String.raw`\boldsymbol h = \symW\boldsymbol x + \frac{\symalpha}{\symr}\,\symB\symA\boldsymbol x`, x: 0.5, y: 0.53, size: 5 },
  },
  draw(s) {
    const { w, h, u } = s;
    const cur = current(s, ['what', 'freeze', 'path', 'h', 'count', 'gpt3', 'zero', 'whyA', 'stuck', 'alpha', 'typical']) ?? 'what';
    const rx = u * 5, rw = w - u * 10, ry = u * 8, rh = h * 0.42;
    const y1 = ry + rh * 0.3, y2 = ry + rh * 0.8;
    const X1 = rx + rw * 0.13, X2 = rx + rw * 0.62, X3 = rx + rw * 0.75, X4 = rx + rw - u * 3;
    const zero = cur === 'zero';
    // input x
    s.rrect(rx, y1 - rh * 0.22, u * 3, (y2 - y1) + rh * 0.44, 0.6, { fill: s.tint('orange', 0.25), stroke: s.c('orange'), lw: 0.35 });
    s.text('x', rx + u * 1.5, y1 - rh * 0.22 - u * 3.5, { size: 4.4, italic: true, weight: 600, color: s.c('orange') });
    s.arrow(rx + u * 3.5, y1, X1 - u, y1, s.c('--ink-3'), 0.35, 2);
    // W0
    s.rrect(X1, y1 - rh * 0.22, X2 - X1, rh * 0.44, 1, { fill: s.tint('blue', 0.22), stroke: s.c('blue'), lw: 0.45 });
    wsub(s, (X1 + X2) / 2, y1 - u * (s.tall ? 3.5 : 1.5), 6, s.c('blue'));
    s.alpha(s.ease('freeze', 0.6), () => {
      if (s.tall) {
        s.text('frozen', (X1 + X2) / 2, y1 + u * 2.6, { size: 3, font: 'ui', weight: 600, color: s.c('blue') });
        s.text('no gradient or optimizer state', (X1 + X2) / 2, y1 + u * 6.2, { size: 2.6, font: 'ui', color: s.c('blue') });
      } else s.text('frozen: no gradient, no optimizer state', (X1 + X2) / 2, y1 + u * 5, { size: 3.2, font: 'ui', color: s.c('blue') });
    });
    s.arrow(X2 + u, y1, X3 - u * 3, y1, s.c('--ink-3'), 0.35, 2);
    // the low-rank path
    const pA = s.ease('path', 0.7);
    s.alpha(pA, () => {
      const mid = (X1 + X2) / 2;
      s.arrow(rx + u * 3.5, y2, X1 - u, y2, s.c('--ink-3'), 0.35, 2);
      trap(s, X1, mid - u * 3, y2, rh * 0.3, u * 3, 'orange');
      s.text('A', X1 + u * 4, y2, { size: 4.6, italic: true, weight: 600, color: s.c('orange') });
      s.text('r', mid, y2 - u * 4, { size: 3.6, italic: true, color: s.c('slate') });
      trap(s, mid + u * 3, X2, y2, u * 3, rh * 0.3, 'green', 0.35, zero);
      s.text(zero ? 'B = 0' : 'B', X2 - u * (zero ? 7 : 4), y2, { size: 4.4, italic: true, weight: 600, color: s.c('green') });
      s.line(X2 + u, y2, X3, y2, s.c('--ink-3'), 0.35);
      s.arrow(X3, y2, X3, y1 + u * 3, s.c('--ink-3'), 0.35, 2);
      s.text('× α/r', (X2 + X3) / 2 + u, y2 - u * 3, { size: 3.4, font: 'ui', color: s.c('slate') });
    });
    // sum and output
    s.alpha(s.ease('h', 0.6), () => {
      s.circle(X3, y1, u * 2.6, { fill: s.tint('--ink-3', 0.12), stroke: s.c('--ink-2'), lw: 0.35 });
      s.text('+', X3, y1, { size: 4.4, weight: 600 });
      s.arrow(X3 + u * 2.8, y1, X4 - u * 1.5, y1, s.c('--ink-3'), 0.35, 2);
      s.rrect(X4 - u * 1.5, y1 - rh * 0.22, u * 3, rh * 0.44, 0.6, { fill: s.tint('purple', 0.25), stroke: s.c('purple'), lw: 0.35 });
      s.text('h', X4, y1 + rh * 0.22 + u * 4, { size: 4.4, italic: true, weight: 600, color: s.c('purple') });
    });
    // what the lower half shows
    const lowTop = h * 0.6;
    s.show('h', s.win('h', 'count'));
    s.alpha(s.win('count', 'zero'), () => {
      s.text('trains r (d + k) numbers', w / 2, lowTop, { size: 4.4, font: 'mono', weight: 650 });
      s.text('rank 8 on a 4096 × 4096 matrix: about 0.4%', w / 2, lowTop + u * 8, { size: s.tall ? 3.1 : 3.6, font: 'ui', color: s.c('--ink-2') });
      s.alpha(s.ease('gpt3', 0.6), () => {
        s.text('GPT-3: about 10,000× fewer trainable parameters', w / 2, lowTop + u * 18, { size: s.tall ? 3.2 : 3.8, font: 'ui', weight: 600, color: s.c('green') });
        s.text('checkpoint: 350 GB → 35 MB', w / 2, lowTop + u * 25, { size: 3.8, font: 'mono', weight: 650, color: s.c('green') });
      });
    });
    s.alpha(s.win('zero', 'whyA'), () => {
      s.text('B A = 0 at step 0', w / 2, lowTop + u * 4, { size: 5, font: 'mono', weight: 650, color: s.c('green') });
      s.text('so the model starts exactly as the pretrained one', w / 2, lowTop + u * 13, { size: 3.8, italic: true, color: s.c('--ink-2') });
    });
    // the three starts, as loss curves
    const gA = s.win('whyA', 'alpha');
    if (gA > 0)
      s.alpha(gA, () => {
        const cy = h * 0.6, ch = h - cy - u * 5;
        const { X, Y } = frame(s, rx, cy, rw, ch, LSTEPS, -4.3, 2.3, { grid: [2, 0, -2, -4], labels: ['100', '1', '0.01', '1e-4'] });
        const runs: [number, string, K, string][] = [
          [0, 'whyA', 'red', 'A random, B = 0'],
          [1, 'stuck', 'orange', 'both random'],
          [2, 'stuck', 'slate', 'both zero'],
        ];
        let ly = cy + u * 4;
        for (const [i, beat, k, lab] of runs) {
          if (s.since(beat) < 0) continue;
          const upto = LSTEPS * clamp01((s.since(beat) - (i === 2 ? 2.5 : 0.3)) / 2.5);
          if (upto <= 0) continue;
          path(s, LORA_RUNS[i]!, X, Y, s.c(k), 0.6, upto);
          s.text(lab, rx + rw - u * 2, ly, { font: 'ui', size: 3, weight: 650, align: 'right', color: s.c(k) });
          ly += u * 4.4;
        }
        s.text('loss, log scale', rx + u * 14, cy + u * 4, { font: 'ui', size: 2.9, align: 'left', color: s.c('--ink-3') });
      });
    s.alpha(s.ease('alpha', 0.6), () => {
      s.text('α / r keeps the update’s size steady as r changes', w / 2, lowTop + u * 4, { size: s.tall ? 3.3 : 3.8, italic: true, color: s.c('slate') });
      s.alpha(s.ease('typical', 0.6), () => s.text('r = 8 to 64,  α = r or 2r', w / 2, lowTop + u * 14, { size: 4.6, font: 'mono', weight: 650 }));
    });
  },
};

// ---------------------------------------------------------------- merge

const MATS: [string, 'attn' | 'mlp'][] = [['q', 'attn'], ['k', 'attn'], ['v', 'attn'], ['o', 'attn'], ['gate', 'mlp'], ['up', 'mlp'], ['down', 'mlp']];

const merge: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // A transformer block and where adapters go.
    s.alpha(s.win('which', 'merge'), () => {
      const cur = current(s, ['which', 'paper', 'all']);
      const bw = Math.min(w - u * 12, u * 110);
      const x0 = (w - bw) / 2;
      const y0 = h * 0.14;
      box(s, x0, y0, bw, h * 0.56, '--ink-3', { fill: 0.03 });
      s.text('one transformer block', x0 + u * 3, y0 + u * 4.5, { size: 3.4, font: 'ui', weight: 600, align: 'left', color: s.c('--ink-3') });
      const groups: ['attn' | 'mlp', string, number][] = [['attn', 'attention', y0 + u * 11], ['mlp', 'MLP', y0 + h * 0.3]];
      for (const [g, name, gy] of groups) {
        s.text(name, x0 + u * 3, gy + u * 2, { size: 3.6, font: 'display', weight: 600, align: 'left' });
        const items = MATS.filter((m) => m[1] === g);
        const tw = (bw - u * 6 - u * 3 * 3) / 4;
        items.forEach(([nm], i) => {
          const tx = x0 + u * 3 + i * (tw + u * 3);
          const ty = gy + u * 5;
          const on = cur === 'all' || (cur === 'paper' && (nm === 'q' || nm === 'v'));
          s.rrect(tx, ty, tw, u * 12, 1, { fill: s.tint('blue', 0.18), stroke: s.c('blue'), lw: 0.35 });
          s.text(`W_${nm}`, tx + tw / 2, ty + u * 6, { size: 3.6, font: 'mono', weight: 600, color: s.c('blue') });
          if (on) {
            const a = s.ease(cur!, 0.5, i * 0.15);
            s.alpha(a, () => {
              s.rrect(tx + tw - u * 6.5, ty - u * 2.5, u * 8, u * 5, 1, { fill: s.c('green'), stroke: s.c('green') });
              s.text('+BA', tx + tw - u * 2.5, ty, { size: 2.8, font: 'mono', weight: 700, color: s.c('--paper') });
            });
          }
        });
      }
      const note = cur === 'paper' ? 'LoRA paper: q and v' : cur === 'all' ? 'QLoRA paper: every linear layer' : '';
      if (note) s.text(note, w / 2, y0 + h * 0.56 + u * 7, { size: 4, italic: true, color: s.c('green') });
    });
    // Folding B A into W0.
    s.alpha(s.win('merge', 'many'), () => {
      const S = Math.min(w * 0.3, h * 0.36);
      const y = h * 0.22;
      const t = clamp01(s.since('merge') / 2.4);
      const xw = w * 0.5 - S * 1.2;
      const xs = lerp(w * 0.5 + S * 0.35, xw, t * t);
      s.rrect(xw, y, S, S, 1, { fill: s.tint('blue', 0.22 + 0.1 * t), stroke: s.c('blue'), lw: 0.45 });
      s.alpha(1 - t, () => {
        s.rrect(xs, y, S, S, 1, { fill: s.tint('teal', 0.3), stroke: s.c('teal'), lw: 0.4 });
        s.text('(α/r) B A', xs + S / 2, y + S / 2, { size: 4, font: 'mono', weight: 600, color: s.c('teal') });
      });
      if (t < 0.95) wsub(s, xw + S / 2, y + S + u * 6, 5, s.c('blue'));
      else s.text('W′ = W0 + (α/r) B A', xw + S / 2, y + S + u * 6, { size: 3.8, font: 'mono', weight: 600, color: s.c('blue') });
      s.alpha(s.ease('merge', 0.6, 2.6), () => {
        s.text('same shape, same speed', w * 0.5 + S * 0.85, y + S * 0.4, { size: 4, font: 'display', weight: 600 });
        s.text('no extra layers at inference', w * 0.5 + S * 0.85, y + S * 0.4 + u * 7, { size: 3.4, italic: true, color: s.c('--ink-2') });
      });
      s.alpha(s.ease('latency', 0.6), () => {
        const yy = y + S + u * 18;
        const rowsL: [string, string[]][] = [
          ['adapter layers', ['block', 'adapter', 'block', 'adapter']],
          ['merged LoRA', ['block', 'block']],
        ];
        rowsL.forEach(([lab, steps], i) => {
          const ry = yy + i * u * 11;
          s.text(lab, u * 6, ry, { font: 'ui', size: 3.2, weight: 600, align: 'left', color: s.c(i ? 'green' : '--ink-2') });
          let x = u * 6 + s.measure('adapter layers', { font: 'ui', size: 3.2, weight: 600 }) + u * 4;
          for (const st of steps) {
            x += chip(s, x, ry - u * 2.9, st, st === 'adapter' ? 'red' : 'blue', { size: 3.2 }) + u * 1.5;
          }
        });
      });
    });
    // One base, many adapters.
    s.alpha(s.win('many', 'swap'), () => {
      const cx = w / 2, cy = h * 0.42;
      const R = Math.min(w, h) * 0.3;
      s.rrect(cx - u * 16, cy - u * 9, u * 32, u * 18, 2, { fill: s.tint('blue', 0.2), stroke: s.c('blue'), lw: 0.45 });
      s.text('base model', cx, cy - u * 2.5, { size: 4.2, font: 'display', weight: 600, color: s.c('blue') });
      s.text('13.5 GB, once', cx, cy + u * 4, { size: 3.2, font: 'mono', color: s.c('--ink-2') });
      const names = ['support', 'legal', 'code', 'medical', 'tutor', 'poems'];
      names.forEach((nm, i) => {
        const a = s.ease('many', 0.4, 0.4 + i * 0.35);
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / names.length;
        const x = cx + Math.cos(ang) * R * 1.15, y = cy + Math.sin(ang) * R * 0.92;
        s.alpha(a, () => {
          s.line(cx + Math.cos(ang) * u * 14, cy + Math.sin(ang) * u * 8, x - Math.cos(ang) * u * 6, y - Math.sin(ang) * u * 4, s.tint('green', 0.6), 0.3);
          const cw2 = chipW(s, nm, 3);
          chip(s, x - cw2 / 2, y - u * 3, nm, 'green', { size: 3, on: 0.4 });
        });
      });
      s.alpha(s.ease('size', 0.6), () => s.text('each adapter: about 8 MB', w / 2, h * 0.88, { size: 4, font: 'display', weight: 600, color: s.c('green') }));
    });
    s.alpha(s.ease('swap', 0.6), () => {
      s.text('W′ − (α/r) B A = W0', w / 2, h * 0.42, { size: 5, font: 'mono', weight: 650 });
      s.text('subtract to unmerge, then merge another', w / 2, h * 0.52, { size: 3.8, italic: true, color: s.c('--ink-2') });
    });
  },
};

// ---------------------------------------------------------------- qlora

const Q64 = QW.slice(0, 64);
const QNF = quantize(QW, 64, NF4);
const QI4 = quantize(QW, 64, INT4);
const B7 = budget(MODELS['7b']!, 'qv', 8);
const B70 = budget(MODELS['70b']!, 'qv', 8);
const gb = (v: number[]) => (v[0]! + v[1]! + v[2]!) / 1e9;

const qlora: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const cur = current(s, ['still', 'qlora', 'dequant', 'block', 'snap', 'nf4', 'even', 'dq', 'paged', 'mem', 'one']) ?? 'still';
    const bw = Math.min(w - u * 12, u * 120);
    const x0 = (w - bw) / 2;
    // The base's memory under LoRA, then under QLoRA.
    s.alpha(s.win('still', 'dequant'), () => {
      const y = h * 0.3;
      const max = 16;
      const X = (g: number) => x0 + (bw * g) / max;
      const t = s.ease('qlora', 1.2, 0.6);
      const wgb = lerp(B7.loraB[0] / 1e9, B7.qlora[0] / 1e9, t);
      s.text('Llama 2 7B with LoRA: memory for the base weights', x0, y - u * 5, { size: 3.4, font: 'ui', weight: 600, align: 'left', color: s.c('--ink-2') });
      s.rrect(x0, y, X(wgb) - x0, u * 10, 1, { fill: s.tint('blue', 0.45), stroke: s.c('blue'), lw: 0.35 });
      s.text(`${wgb.toFixed(1)} GB`, X(wgb) + u * 2, y + u * 5.2, { size: 4, font: 'mono', weight: 650, align: 'left' });
      s.text(t < 0.5 ? 'bf16: 2 bytes per weight' : 'NF4: about half a byte per weight', x0, y + u * 17, { size: 3.8, italic: true, align: 'left', color: s.c(t < 0.5 ? 'blue' : 'green') });
    });
    // Decode on the fly.
    s.alpha(s.win('dequant', 'block'), () => {
      const y = h * 0.4;
      const steps: [string, K][] = [['4-bit codes', 'green'], ['decode', '--ink-3'], ['bf16 block', 'blue'], ['× x', 'purple'], ['discard', '--ink-3']];
      const L = flowLayout(s, steps.map((q) => q[0]), x0, y, bw, s.tall ? 3.2 : 3.8, { center: true, gapU: 5 });
      steps.forEach(([lab, k], i) => {
        const p = L.pos[i]!;
        s.alpha(s.ease('dequant', 0.4, i * 0.6), () => {
          chip(s, p.x, p.y, lab, k, { size: s.tall ? 3.2 : 3.8, on: 0.5 });
          if (i < steps.length - 1 && L.pos[i + 1]!.line === p.line) s.arrow(p.x + p.w + u * 0.8, p.y + u * 3, L.pos[i + 1]!.x - u * 0.8, p.y + u * 3, s.c('--ink-3'), 0.3, 1.6);
        });
      });
      s.text('every matmul still runs in 16 bits', w / 2, y + L.height + u * 12, { size: 3.8, italic: true, color: s.c('--ink-2') });
    });
    // One block on a number line, snapping to the levels.
    s.alpha(s.win('block', 'nf4'), () => {
      const y = h * 0.45;
      const X = (v: number) => x0 + ((v + 1) / 2) * bw;
      s.line(x0, y, x0 + bw, y, s.c('--axis'), 0.35);
      for (const v of [-1, 0, 1]) s.text(String(v), X(v), y + u * 7, { size: 3.2, font: 'mono', color: s.c('--ink-3') });
      const snap = s.ease('snap', 1.4, 0.4);
      s.alpha(s.ease('snap', 0.5), () => NF4.forEach((l) => s.line(X(l), y - u * 9, X(l), y + u * 2, s.tint('green', 0.85), 0.3)));
      const mx = Math.max(...Array.from(Q64, Math.abs));
      Array.from(Q64).forEach((wv, i) => {
        const z = wv / mx;
        let best = NF4[0]!;
        for (const l of NF4) if (Math.abs(z - l) < Math.abs(z - best)) best = l;
        const xx = X(lerp(z, best, snap));
        const yy = y - u * 3 - (i % 4) * u * 1.6;
        s.circle(xx, yy, u * 0.8, { fill: s.tint('blue', 0.8) });
      });
      s.text('one block of 64 weights, divided by its largest', w / 2, y - u * 16, { size: 3.6, italic: true, color: s.c('--ink-2') });
      s.alpha(snap, () => s.text('each stored as a 4-bit level number', w / 2, y + u * 15, { size: 3.6, italic: true, color: s.c('green') }));
    });
    // The histogram and the two sets of levels.
    s.alpha(s.win('nf4', 'dq'), () => {
      const y0 = h * 0.12, hh = h * 0.5;
      const X = (v: number) => x0 + ((v + 1) / 2) * bw;
      const bins = 60;
      const hist = new Array(bins).fill(0);
      for (const z of QNF.z) hist[Math.min(bins - 1, Math.floor(((z + 1) / 2) * bins))]++;
      const hm = Math.max(...hist);
      hist.forEach((n, i) => {
        const bh = (hh * 0.85 * n) / hm;
        s.ctx.fillStyle = s.tint('blue', 0.35);
        s.ctx.fillRect(X(-1 + (2 * i) / bins), y0 + hh - bh, bw / bins - 1, bh);
      });
      const even = cur === 'even';
      const lv = even ? INT4 : NF4;
      const k: K = even ? 'orange' : 'green';
      lv.forEach((l) => s.line(X(l), y0, X(l), y0 + hh, s.tint(k, 0.85), 0.3));
      s.line(x0, y0 + hh, x0 + bw, y0 + hh, s.c('--axis'), 0.3);
      s.text(even ? 'evenly spaced levels (int4)' : 'NF4: quantiles of a bell curve', w / 2, y0 + hh + u * 7, { size: 4, font: 'display', weight: 600, color: s.c(k) });
      s.alpha(s.ease('even', 0.6), () => {
        s.text(`error  NF4 ${fmt(QNF.rmse, 3)}   int4 ${fmt(QI4.rmse, 3)}`, w / 2, y0 + hh + u * 16, { size: 3.8, font: 'mono', weight: 650 });
      });
    });
    // Bits for the scales, and paging.
    s.alpha(s.win('dq', 'mem'), () => {
      const y = h * 0.3;
      const X = (b: number) => x0 + ((bw - u * 22) * b) / 4.5;
      const rowsQ: [string, number][] = [['one fp32 scale per 64', 4.5], ['double quantization', 4 + 8 / 64 + 32 / (64 * 256)]];
      rowsQ.forEach(([lab, bits], i) => {
        const ry = y + i * u * 16;
        s.text(lab, x0, ry - u * 3, { size: 3.2, font: 'ui', weight: 600, align: 'left', color: s.c('--ink-2') });
        s.rrect(x0, ry, X(4) - x0, u * 7, 0.8, { fill: s.tint('green', 0.4), stroke: s.c('green'), lw: 0.3 });
        s.rrect(X(4), ry, X(bits) - X(4), u * 7, 0.8, { fill: s.tint('gold', 0.6), stroke: s.c('gold'), lw: 0.3 });
        s.text(`${bits.toFixed(3)} bits`, X(bits) + u * 2, ry + u * 3.7, { size: 3.6, font: 'mono', weight: 650, align: 'left' });
      });
      s.alpha(s.ease('paged', 0.6), () => {
        const py = y + u * 40;
        box(s, x0, py, bw * 0.38, u * 12, 'green');
        s.text('GPU', x0 + bw * 0.19, py + u * 6, { size: 4, font: 'display', weight: 600, color: s.c('green') });
        box(s, x0 + bw * 0.62, py, bw * 0.38, u * 12, 'slate');
        s.text('CPU memory', x0 + bw * 0.81, py + u * 6, { size: 4, font: 'display', weight: 600, color: s.c('slate') });
        s.arrow(x0 + bw * 0.4, py + u * 4, x0 + bw * 0.6, py + u * 4, s.c('--ink-2'), 0.35, 2);
        s.arrow(x0 + bw * 0.6, py + u * 8, x0 + bw * 0.4, py + u * 8, s.c('--ink-2'), 0.35, 2);
        s.text('optimizer state, paged out during spikes', w / 2, py + u * 19, { size: 3.4, italic: true, color: s.c('--ink-2') });
      });
    });
    // 70B: full, LoRA, QLoRA.
    s.alpha(s.ease('mem', 0.6), () => {
      const y = h * 0.22;
      const vals: [string, number, K][] = [['full', gb(B70.full), 'red'], ['LoRA', gb(B70.loraB), 'blue'], ['QLoRA', gb(B70.qlora), 'green']];
      const lw = s.measure('QLoRA', { font: 'ui', size: 3.6, weight: 600 }) + u * 3;
      const X = (g: number) => x0 + lw + ((bw - lw - u * 14) * Math.sqrt(g)) / Math.sqrt(1200);
      s.text('Llama 2 70B, GB (square-root scale)', x0, y - u * 6, { size: 3.4, font: 'ui', weight: 600, align: 'left', color: s.c('--ink-2') });
      vals.forEach(([lab, g, k], i) => {
        const ry = y + i * u * 13;
        s.text(lab, x0 + lw - u * 2, ry + u * 4, { size: 3.6, font: 'ui', weight: 600, align: 'right' });
        const p = s.ease('mem', 0.8, 0.4 + i * 0.8);
        s.rrect(x0 + lw, ry, (X(g) - x0 - lw) * p, u * 8, 0.8, { fill: s.tint(k, 0.45), stroke: s.c(k), lw: 0.3 });
        s.alpha(p, () => s.text(`${Math.round(g)}`, Math.max(X(g), X(48) + u) + u * 2, ry + u * 4.2, { size: 3.6, font: 'mono', weight: 650, align: 'left' }));
      });
      const gx = X(48);
      s.line(gx, y - u * 2, gx, y + u * 38, s.c('--ink-2'), 0.3, [1, 0.8]);
      s.text('48 GB', gx, y + u * 42, { size: 3.2, font: 'ui', color: s.c('--ink-2') });
      s.alpha(s.ease('one', 0.6), () => s.text('65B fine-tuned on one 48 GB GPU', w / 2, h * 0.86, { size: 4.2, font: 'display', weight: 600, color: s.c('green') }));
    });
  },
};

// ---------------------------------------------------------------- distill

const RACE = (() => {
  const hard = new Student(), soft = new Student();
  hard.measure();
  soft.measure();
  const rng = new Rng(21);
  const hp: number[][] = [hard.probs()], sp: number[][] = [soft.probs()];
  for (let t = 0; t < DSTEPS; t++) {
    let r = rng.next();
    let y = 0;
    while (y < TEACH.length - 1 && r > TEACH[y]!) r -= TEACH[y++]!;
    hard.step(TEACH.map((_, i) => (i === y ? 1 : 0)), 0.25);
    soft.step(TEACH, 0.25);
    hp.push(hard.probs());
    sp.push(soft.probs());
  }
  return { hard, soft, hp, sp };
})();

const distill: SceneDef = {
  marks: {
    kl: { tex: String.raw`\sum_v p_T(v)\,\log\frac{p_T(v)}{p_\theta(v)}`, x: 0.5, y: 0.09, size: 5 },
  },
  draw(s) {
    const { w, h, u } = s;
    // Teacher writes, student imitates.
    s.alpha(s.win('cost', 'soft'), () => {
      const y = h * 0.3;
      const tw = Math.min(w * 0.3, u * 36);
      box(s, u * 6, y, tw, u * 22, 'purple', { fill: 0.14 });
      s.text('teacher', u * 6 + tw / 2, y + u * 9, { size: 4.6, font: 'display', weight: 600, color: s.c('purple') });
      s.text('large', u * 6 + tw / 2, y + u * 15, { size: 3.2, italic: true, color: s.c('--ink-2') });
      const sw = tw * 0.7;
      const sx = w - u * 6 - sw;
      s.alpha(s.ease('seq', 0.6), () => {
        box(s, sx, y + u * 4, sw, u * 14, 'green', { fill: 0.14 });
        s.text('student', sx + sw / 2, y + u * 11, { size: 4, font: 'display', weight: 600, color: s.c('green') });
        const mid = (u * 6 + tw + sx) / 2;
        s.arrow(u * 7 + tw, y + u * 11, sx - u, y + u * 11, s.c('--ink-3'), 0.35, 2);
        s.text('its answers as SFT data', mid, y + u * 6, { size: 3.2, italic: true, color: s.c('--ink-2') });
      });
      s.alpha(s.ease('examples', 0.6), () => {
        s.text('Alpaca: 52,000 answers from an OpenAI model', w / 2, y + u * 34, { size: s.tall ? 3.2 : 3.8, font: 'ui', weight: 600 });
        s.text('R1 distilled models: about 800,000 samples, no RL', w / 2, y + u * 42, { size: s.tall ? 3.2 : 3.8, font: 'ui', weight: 600 });
      });
    });
    // The teacher's distribution, then two students learning it.
    const dA = s.ease('soft', 0.6);
    if (dA <= 0) return;
    s.alpha(dA * (1 - s.ease('limits', 0.6)), () => {
      const racing = s.since('race') >= 0;
      const step = racing ? Math.round(DSTEPS * clamp01(s.since('race') / Math.max(1, s.end('race') - s.at('race')))) : 0;
      s.show('kl', s.win('kl', 'race'));
      const y0 = h * 0.27;
      const lw = s.measure('Melbourne', { font: 'mono', size: 3.2 }) + u * 8;
      const bx = u * 6 + lw;
      const bw = w - bx - u * 8;
      const rowH = (h * (racing ? 0.42 : 0.6)) / NEXT.length;
      const X = (p: number) => bx + (bw * p) / 0.7;
      s.text('The capital of Australia is …', w / 2, y0 - u * 4, { size: 3.6, italic: true, color: s.c('--ink-2') });
      NEXT.forEach((wd, i) => {
        const y = y0 + i * rowH;
        s.text(wd, bx - u * 2, y + rowH / 2, { size: 3.2, font: 'mono', align: 'right', color: s.c(s.since('dark') >= 0 && i === 1 ? 'gold' : '--ink-2') });
        if (racing) {
          const bh = rowH * 0.32;
          s.rrect(bx, y + rowH * 0.15, X(RACE.hp[step]![i]!) - bx, bh, 0.3, { fill: s.tint('orange', 0.75) });
          s.rrect(bx, y + rowH * 0.15 + bh + 1, X(RACE.sp[step]![i]!) - bx, bh, 0.3, { fill: s.tint('green', 0.75) });
        } else s.rrect(bx, y + rowH * 0.2, X(TEACH[i]!) - bx, rowH * 0.6, 0.4, { fill: s.tint('purple', 0.45), stroke: s.c('purple'), lw: 0.25 });
        const tx = X(TEACH[i]!);
        s.line(tx, y + rowH * 0.08, tx, y + rowH * 0.92, s.c('--ink'), 0.4);
      });
      if (s.since('dark') >= 0 && !racing) s.text('a plausible mistake', X(TEACH[1]!) + u * 3, y0 + rowH * 1.5, { size: 3.2, italic: true, align: 'left', color: s.c('gold') });
      if (racing) {
        const cy = y0 + NEXT.length * rowH + u * 4;
        const ch = h - cy - u * 4;
        const { X: XX, Y } = frame(s, u * 6, cy, w - u * 12, ch, DSTEPS, -3.3, 0.3, { grid: [0, -1, -2, -3], labels: ['1', '0.1', '0.01', '0.001'] });
        const pts = (st: Student) => st.kl.map((v, i) => [i, Math.log10(Math.max(v, 1e-6))] as [number, number]);
        path(s, pts(RACE.hard), XX, Y, s.c('orange'), 0.5, step);
        path(s, pts(RACE.soft), XX, Y, s.c('green'), 0.6, step);
        let lx = u * 8;
        const ly = cy + u * 4;
        lx = swatch(s, lx + u * 12, ly, 'samples', 'orange', 3);
        swatch(s, lx + u * 2, ly, 'probabilities', 'green', 3);
        s.text('KL to the teacher', w - u * 8, ly, { size: 3, font: 'ui', align: 'right', color: s.c('--ink-3') });
      }
    });
    s.alpha(s.ease('limits', 0.6), () => {
      s.text('inherits the teacher’s mistakes', w / 2, h * 0.42, { size: 4.6, font: 'display', weight: 600 });
      s.text('copies style more easily than ability', w / 2, h * 0.54, { size: 4.6, font: 'display', weight: 600 });
    });
  },
};

// ---------------------------------------------------------------- outro

const RECAP: [string, string, string, K][] = [
  ['sft', 'SFT', 'demonstrations, a template, an answer-only mask', 'gold'],
  ['mask', 'forgetting', 'replay old data, or change less', 'purple'],
  ['lora', 'LoRA', 'frozen W₀ plus a low-rank B A, B starting at 0', 'green'],
  ['qlora', 'QLoRA', 'a 4-bit NF4 base: big models on one GPU', 'teal'],
  ['distill', 'distillation', 'a stronger model writes the demonstrations', 'orange'],
];

const outro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const x0 = Math.max(u * 6, (w - u * 110) / 2);
    s.text('Fine-tuning, in five lines', w / 2, h * 0.09, { size: 5.6, font: 'display', weight: 600 });
    RECAP.forEach(([beat, head, line, k], i) => {
      const y = h * 0.2 + i * h * 0.12;
      s.alpha(s.ease(beat, 0.6), () => {
        s.circle(x0 + u * 2, y, u * 1.6, { fill: s.c(k) });
        s.text(head, x0 + u * 6, y - u * 2.2, { size: 4.2, font: 'display', weight: 600, align: 'left', color: s.c(k) });
        s.text(line, x0 + u * 6, y + u * 3.8, { size: s.tall ? 3.3 : 3.6, font: 'ui', align: 'left', color: s.c('--ink-2') });
      });
    });
    s.alpha(s.ease('next', 0.6), () => {
      s.text('imitation is capped by its examples', w / 2, h * 0.83, { size: 4.4, font: 'display', weight: 600 });
      s.alpha(s.ease('next', 0.6, 3.5), () => s.text('beyond them: a reward that says which answer is better', w / 2, h * 0.91, { size: s.tall ? 3.2 : 3.8, italic: true, color: s.c('--ink-2') }));
    });
  },
};

export const scenesC: Record<string, SceneDef> = { lora, merge, qlora, distill, outro };

import { type Scene, type SceneDef, clamp01, lerp, smooth } from '../../lecture/scene';
import {
  GPUS,
  KV_BLOCKS,
  KV_BS,
  type KvFrame,
  decodeStep,
  fmtCount,
  kvRequests,
  prefillCost,
  requestLengths,
  schedule,
  simulateKV,
} from '../../lib/inference-math';
import { Frame, type K, card, current, fit, hatch, pill, rect, reqK } from './kit';

const H100 = GPUS.H100;

// ---------------------------------------------------------------- intro

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // Title, lifting away as the story starts.
    const lift = s.ease('once', 0.8);
    s.alpha(1 - s.ease('surprise', 0.6), () => {
      const ty = lerp(h * 0.44, h * 0.2, lift);
      s.text('Fast inference', w / 2, ty, { size: lerp(10, 7, lift), font: 'display', weight: 600 });
      s.alpha(1 - lift, () => s.text('serving a trained model, fast and cheaply', w / 2, ty + u * 10, { size: 4.2, italic: true, color: s.c('--ink-2') }));
    });
    // Trained once, served forever.
    const sA = s.win('once', 'surprise');
    if (sA > 0)
      s.alpha(sA, () => {
        const y = h * 0.52;
        const bw = Math.min(w * 0.24, u * 30);
        const bh = u * 16;
        const x0 = w * 0.06;
        card(s, x0, y - bh / 2, bw, bh, 'train', 'once', 'gold', 0.4);
        const mx = x0 + bw + u * 8;
        const mw = Math.min(w * 0.18, u * 22);
        s.arrow(x0 + bw + u * 1, y, mx - u * 1, y, s.c('--ink-3'), 0.4, 2.2);
        s.rrect(mx, y - bh / 2, mw, bh, 2, { fill: s.tint('blue', 0.15), stroke: s.c('blue'), lw: 0.45 });
        s.text('model', mx + mw / 2, y - u * 2.2, { size: 4, font: 'display', weight: 620, color: s.c('blue') });
        s.text('W', mx + mw / 2, y + u * 3.6, { size: 4.6, italic: true, weight: 650, color: s.c('blue') });
        const fA = s.ease('forever', 0.6);
        const sx0 = mx + mw + u * 2;
        const sx1 = w - u * 5;
        s.alpha(fA, () => {
          const n = 9;
          const span = sx1 - sx0;
          for (let i = 0; i < n; i++) {
            const f = (((s.t * 0.22 + i / n) % 1) + 1) % 1;
            const x = sx0 + f * span;
            const a = Math.min(1, f * 6, (1 - f) * 6);
            s.alpha(a, () => s.rrect(x - u * 1.8, y - u * 1.8, u * 3.6, u * 3.6, 0.8, { fill: s.tint('purple', 0.55), stroke: s.c('purple'), lw: 0.3 }));
          }
          s.text('every token, every user', (sx0 + sx1) / 2, y + u * 9, { size: 3.6, italic: true, color: s.c('--ink-2') });
          s.text('a forward pass each', (sx0 + sx1) / 2, y - u * 8, { size: 3.4, font: 'mono', color: s.c('purple') });
        });
      });
    // Where the time goes: two meters.
    const mA = s.win('surprise', 'plan');
    if (mA > 0)
      s.alpha(mA, () => {
        const x0 = w * 0.1;
        const bw = w * 0.8;
        const fill = s.ease('wait', 1.2);
        const rows: [string, number, K][] = [
          ['arithmetic units busy', 0.003, 'orange'],
          ['memory bus busy', 1, 'blue'],
        ];
        s.text('one token, one user, one GPU', w / 2, h * 0.22, { size: 4.6, font: 'display', weight: 600 });
        rows.forEach(([label, v, k], i) => {
          const y = h * 0.38 + i * u * 20;
          s.text(label, x0, y - u * 5, { size: 3.8, align: 'left', color: s.c('--ink-2') });
          s.rrect(x0, y - u * 2.6, bw, u * 5.2, 1.4, { fill: s.tint(k, 0.08), stroke: s.tint(k, 0.5), lw: 0.3 });
          s.rrect(x0, y - u * 2.6, Math.max(u * 0.6, bw * v * fill), u * 5.2, 1.4, { fill: s.tint(k, 0.7) });
          s.text(i === 0 ? '0.3%' : `${Math.round(100 * fill)}%`, x0 + bw, y - u * 5, { size: 3.8, font: 'mono', weight: 600, align: 'right', color: s.c(k) });
        });
        s.alpha(s.ease('wait', 0.6, 1.4), () => s.text('it waits for memory', w / 2, h * 0.8, { size: 4.4, italic: true, color: s.c('blue') }));
      });
    // The plan.
    const pA = s.win('plan', 'example');
    if (pA > 0)
      s.alpha(pA, () => {
        const items: [string, string, K, number][] = [
          ['batching', 'share each weight read', 'purple', s.ease('plan', 0.5, 0.8)],
          ['paged attention', 'cache memory in blocks', 'green', s.ease('plan', 0.5, 1.6)],
          ['quantization', 'fewer bytes per weight', 'teal', s.ease('plan', 0.5, 2.6)],
          ['speculative decoding', 'draft, then verify', 'gold', s.ease('plan', 0.5, 3.6)],
          ['distillation', 'a smaller model', 'orange', s.ease('distill', 0.5, 0.6)],
          ['latency vs throughput', 'the tradeoff', 'slate', s.ease('distill', 0.5, 2)],
        ];
        const cols = s.tall ? 2 : 3;
        const gap = u * 3;
        const cw = (w - u * 10 - gap * (cols - 1)) / cols;
        const ch = u * 15;
        const rows = Math.ceil(items.length / cols);
        const y0 = (h - rows * ch - (rows - 1) * gap) / 2 + u * 4;
        items.forEach(([head, note, k, a], i) => {
          const x = u * 5 + (i % cols) * (cw + gap);
          const y = y0 + Math.floor(i / cols) * (ch + gap);
          card(s, x, y + (1 - a) * u * 3, cw, ch, head, note, k, 0.3, a);
        });
      });
    // The running example.
    const eA = s.ease('example', 0.6);
    if (eA > 0)
      s.alpha(eA, () => {
        const cw = s.tall ? w - u * 10 : (w - u * 13) / 2;
        const ch = u * 17;
        const x2 = s.tall ? u * 5 : u * 8 + cw;
        const y1 = s.tall ? h * 0.3 : h * 0.4;
        const y2 = s.tall ? y1 + ch + u * 5 : y1;
        card(s, u * 5, y1, cw, ch, 'Llama 3 8B', '8.03 billion parameters, 16 GB in bf16', 'blue', 0.3);
        card(s, x2, y2, cw, ch, 'one H100', '989 TFLOP/s, 3.35 TB/s, 80 GB', 'slate', 0.3);
      });
  },
};

// ---------------------------------------------------------------- prefill and decode

const PROMPT = ['The', 'keeper', 'climbed', 'the'];
const OUT = ['stairs', 'to', 'the', 'lamp'];

const prefill: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const n = PROMPT.length + OUT.length;
    const cw = Math.min(u * 15, (w - u * 10) / n - u);
    const gap = u;
    const x0 = (w - n * cw - (n - 1) * gap) / 2;
    const cx = (i: number) => x0 + i * (cw + gap);
    const ty = h * 0.2;
    const th = u * 7;
    // how many generated tokens exist now
    const first = s.ease('prefill', 0.5, 2.2);
    const decoded = clamp01(s.since('decode') / Math.max(0.5, s.end('decode') - s.at('decode')));
    const nOut = first > 0.5 ? 1 + Math.min(3, Math.floor(decoded * 3.2)) : 0;
    const numsA = s.ease('flops', 0.6);
    const picA = 1 - numsA;
    // tokens
    const tokSize = fit(s, 'climbed', cw - u * 1.2, 3.4, { font: 'mono', weight: 600 });
    PROMPT.forEach((t, i) => s.cell(cx(i), ty, cw, th, '', 'orange', { on: 0.3 }));
    PROMPT.forEach((t, i) => s.text(t, cx(i) + cw / 2, ty + th / 2, { font: 'mono', size: tokSize, weight: 600 }));
    OUT.forEach((t, j) => {
      const i = PROMPT.length + j;
      const a = j < nOut ? (j === 0 ? first : 1) : 0;
      s.alpha(Math.max(a, 0.25), () => s.rrect(cx(i), ty, cw, th, 1.2, { stroke: s.tint('purple', a > 0 ? 0.9 : 0.4), fill: a > 0 ? s.tint('purple', 0.2) : undefined, lw: 0.3 }));
      s.alpha(a, () => s.text(t, cx(i) + cw / 2, ty + th / 2, { font: 'mono', size: tokSize, weight: 600 }));
    });
    s.alpha(picA, () => {
      // the model
      const my = h * 0.36;
      const mh = u * 10;
      const pulse = Math.max(s.prog('prefill') > 0 && s.prog('prefill') < 1 ? Math.sin(s.prog('prefill') * Math.PI) : 0, 0);
      s.rrect(x0, my, n * cw + (n - 1) * gap, mh, 2, { fill: s.tint('blue', 0.1 + 0.25 * pulse), stroke: s.c('blue'), lw: 0.4 });
      s.text('model: every weight W', w / 2, my + mh / 2, { size: 4, font: 'display', weight: 600, color: s.c('blue') });
      // arrows into the model
      const pa = s.win('prefill', 'ttft');
      s.alpha(pa, () => PROMPT.forEach((_, i) => s.arrow(cx(i) + cw / 2, ty + th + u, cx(i) + cw / 2, my - u * 0.5, s.c('orange'), 0.45, 2)));
      if (s.since('decode') >= 0 && nOut >= 1 && nOut < 4) {
        const i = PROMPT.length + nOut - 1;
        s.arrow(cx(i) + cw / 2, ty + th + u, cx(i) + cw / 2, my - u * 0.5, s.c('purple'), 0.45, 2);
      }
      // the KV cache, one column per token
      const ky = my + mh + u * 7.5;
      const kh = u * 4.2;
      const cA = s.ease('cache', 0.6);
      s.alpha(cA, () => s.text('KV cache: a key and a value per token', x0, ky - u * 2.6, { size: 3.2, align: 'left', color: s.c('green') }));
      for (let i = 0; i < n; i++) {
        const isPrompt = i < PROMPT.length;
        const a = isPrompt ? (s.since('prefill') >= 0 ? s.ease('prefill', 0.6, 1) : cA * 0.25) : i - PROMPT.length < nOut ? 1 : 0;
        if (a <= 0) continue;
        s.alpha(a, () => {
          s.rrect(cx(i) + u * 0.6, ky, cw - u * 1.2, kh, 0.8, { fill: s.tint('green', 0.35), stroke: s.c('green'), lw: 0.25 });
          s.rrect(cx(i) + u * 0.6, ky + kh + u * 0.6, cw - u * 1.2, kh, 0.8, { fill: s.tint('gold', 0.35), stroke: s.c('gold'), lw: 0.25 });
        });
      }
      s.alpha(cA, () => {
        s.text('k', cx(n - 1) + cw + u * 2, ky + kh / 2, { size: 3.4, italic: true, color: s.c('green') });
        s.text('v', cx(n - 1) + cw + u * 2, ky + kh * 1.5 + u * 0.6, { size: 3.4, italic: true, color: s.c('gold') });
      });
      // the time line
      const ly = ky + 2 * kh + u * 9;
      const tl = n * cw + (n - 1) * gap;
      const pre = prefillCost(1000, H100).t;
      const dec = decodeStep(1, 1000, H100).t;
      const total = pre + 6 * dec;
      const X = (t: number) => x0 + (tl * t) / total;
      const lA = s.ease('prefill', 0.6, 1);
      s.alpha(lA, () => {
        s.rrect(X(0), ly, X(pre) - X(0) - u * 0.3, u * 5, 0.8, { fill: s.tint('orange', 0.5), stroke: s.c('orange'), lw: 0.3 });
        s.line(x0, ly + u * 6.4, x0 + tl, ly + u * 6.4, s.c('--axis'), 0.2);
        s.text('time, prompt of 1,000 tokens →', x0, ly + u * 9.5, { size: 3.2, align: 'left', color: s.c('--ink-3') });
      });
      for (let j = 1; j < nOut; j++) rect(s, X(pre + (j - 1) * dec) + u * 0.25, ly, X(dec) - X(0) - u * 0.5, u * 5, s.tint('purple', 0.55));
      s.alpha(s.win('ttft', 'decode'), () => {
        s.text('time to first token', X(0), ly - u * 3, { size: 3.6, align: 'left', weight: 600, color: s.c('orange') });
        s.text('16.5 ms', X(pre) + u, ly + u * 2.5, { size: 3.4, font: 'mono', align: 'left', color: s.c('orange') });
      });
      s.alpha(s.ease('tpot', 0.6), () => {
        s.text('time per output token: 4.8 ms', X(pre), ly - u * 3, { size: 3.6, align: 'left', weight: 600, color: s.c('purple') });
      });
    });
    // the arithmetic
    if (numsA > 0)
      s.alpha(numsA, () => {
        const y0 = h * 0.45;
        const sz = fit(s, '2N = 16 billion FLOPs per token', w - u * 12, 5.4, { font: 'display', weight: 600 });
        s.text('2N = 16 billion FLOPs per token', w / 2, y0, { size: sz, font: 'display', weight: 600 });
        s.alpha(s.ease('fast', 0.6), () => s.text('÷ 989 trillion FLOP/s = 16 µs', w / 2, y0 + u * 12, { size: fit(s, '÷ 989 trillion FLOP/s = 16 µs', w - u * 12, 4.6, { font: 'mono' }), font: 'mono', color: s.c('--ink-2') }));
        s.alpha(s.ease('slow', 0.6), () => {
          s.text('measured: 4.8 ms', w / 2, y0 + u * 26, { size: 5.4, font: 'mono', weight: 650, color: s.c('red') });
          s.text('300 times longer', w / 2, y0 + u * 35, { size: 4.2, italic: true, color: s.c('red') });
        });
      });
  },
};

// ---------------------------------------------------------------- roofline

/** log10 of attainable TFLOP/s at log10 intensity `lx`. */
const roofY = (lx: number): number => Math.log10(Math.min(H100.flops, 10 ** lx * H100.bw) / 1e12);
const RIDGE = Math.log10(H100.flops / H100.bw);

function roofFrame(s: Scene): Frame {
  const { w, h, u } = s;
  const left = u * 15;
  const top = h * 0.15;
  return new Frame(s, [left, top, w - left - u * 5, h - top - u * 10], [-0.3, 3.6, -0.2, 3.3]);
}

const roofline: SceneDef = {
  marks: {
    int: { tex: String.raw`\symI = \frac{\text{FLOPs}}{\text{bytes moved}} \approx \symB`, x: 0.5, y: 0.66, size: 6.4 },
    time: { tex: String.raw`t = \max\!\Big(\frac{\text{FLOPs}}{\text{peak}},\ \frac{\text{bytes}}{\text{bandwidth}}\Big)`, x: 0.5, y: 0.17, size: 4.6 },
  },
  draw(s) {
    const { w, h, u } = s;
    // Two speeds.
    const cA = s.win('two', 'roof');
    if (cA > 0)
      s.alpha(cA, () => {
        const cw = Math.min(w - u * 12, u * 80);
        const x = (w - cw) / 2;
        const lift = s.ease('intensity', 0.7);
        const y1 = lerp(h * 0.18, h * 0.14, lift);
        const ch = u * 15;
        const pk = s.since('peak') >= 0;
        const bk = s.since('bw') >= 0;
        card(s, x, y1, cw, ch, pk ? 'compute: 989 trillion FLOP/s' : 'compute', pk ? 'tensor cores, 16-bit numbers' : 'how fast it does arithmetic', 'orange', pk ? 0.5 : 0.2);
        card(s, x, y1 + ch + u * 4, cw, ch, bk ? 'memory: 3.35 trillion bytes/s' : 'memory bandwidth', bk ? 'from HBM to the arithmetic units' : 'how fast it fetches numbers', 'blue', bk ? 0.5 : 0.2);
        s.alpha(s.ease('ratio', 0.6), () => {
          const ty = y1 + 2 * ch + u * 13;
          s.text('≈ 295 FLOPs per byte fetched', w / 2, ty, { size: fit(s, '≈ 295 FLOPs per byte fetched', w - u * 10, 5.6, { font: 'display', weight: 620 }), font: 'display', weight: 620, color: s.c('red') });
        });
        s.show('int', s.ease('intensity', 0.6) * (1 - s.ease('roof', 0.5)), { y: 0.76 });
        s.alpha(s.ease('matmul', 0.6) * (1 - s.ease('roof', 0.5)), () =>
          s.text('a weight fetched is used once per token in the batch', w / 2, h * 0.9, { size: fit(s, 'a weight fetched is used once per token in the batch', w - u * 10, 3.6, { italic: true }), italic: true, color: s.c('--ink-2') }),
        );
      });
    // The roofline.
    const rA = s.ease('roof', 0.6);
    if (rA <= 0) return;
    s.alpha(rA, () => {
      const F = roofFrame(s);
      F.grid('x', [0, 1, 2, 3], (v) => ['1', '10', '100', '1k'][v]!);
      F.grid('y', [0, 1, 2, 3], (v) => ['1', '10', '100', '1k'][v]!);
      s.text('TFLOP/s', u * 2, F.rect[1] - u * 3, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3') });
      s.text('intensity I, FLOP per byte', F.X(1.65), F.rect[1] + F.rect[3] + u * 7, { size: 3.2, color: s.c('--ink-3') });
      const grow = s.ease('roof', 1.6, 0.3);
      const xs: number[] = [];
      const ys: number[] = [];
      for (let lx = -0.3; lx <= -0.3 + 3.9 * grow + 1e-9; lx += 0.02) {
        xs.push(lx);
        ys.push(roofY(lx));
      }
      F.poly(xs, ys, s.c('blue'), 0.7);
      const pA = s.ease('plot', 0.6);
      s.alpha(pA, () => {
        F.clip(() => s.line(F.X(RIDGE), F.Y(-0.2), F.X(RIDGE), F.Y(roofY(RIDGE)), s.tint('--ink-3', 0.8), 0.25, [1.2, 1]));
        s.text('ridge ≈ 295', F.X(RIDGE) + u, F.Y(-0.05), { size: 3.2, align: 'left', color: s.c('--ink-2') });
        s.text('memory-bound', F.X(1.05), F.Y(roofY(1.05)) - u * 5, { size: 3.6, weight: 600, color: s.c('blue'), halo: true });
        s.text('compute-bound', F.X(3.05), F.Y(3) + u * 5, { size: 3.6, weight: 600, color: s.c('blue'), halo: true });
      });
      s.show('time', s.win('roof', 'decode') * 0.999);
      const dA = s.ease('decode', 0.6);
      s.alpha(dA, () => {
        F.dot(0, roofY(0), 1.6, s.c('red'));
        s.text('decode, B = 1', F.X(0) + u * 3, F.Y(roofY(0)) + u * 1, { size: 3.6, weight: 650, align: 'left', base: 'top', color: s.c('red'), halo: true });
      });
      const pre = prefillCost(1000, H100);
      const sA = s.ease('slope', 0.6, 2);
      s.alpha(sA, () => {
        const px = Math.log10(pre.intensity);
        F.dot(px, roofY(px), 1.4, s.c('orange'));
        s.text('prefill, T = 1,000', F.X(px), F.Y(roofY(px)) - u * 3.4, { size: 3.4, weight: 600, color: s.c('orange'), halo: true });
      });
      const aA = s.ease('answer', 0.6);
      s.alpha(aA, () => {
        const x = F.rect[0] + u * 3;
        const y = F.rect[1] + u * 5;
        const t1 = '16 GB ÷ 3.35 TB/s = 4.8 ms';
        const sz = fit(s, t1, F.rect[2] * 0.62, 3.8, { font: 'mono', weight: 600 });
        s.text(t1, x, y, { size: sz, font: 'mono', weight: 600, align: 'left', color: s.c('red'), halo: true });
        s.text('compute busy: 0.3%', x, y + u * 6, { size: sz, font: 'mono', align: 'left', color: s.c('--ink-2'), halo: true });
      });
    });
  },
};

// ---------------------------------------------------------------- batching

const LB = Array.from({ length: 101 }, (_, i) => i / 10);
const CURVE = (ctx: number) => LB.map((lb) => decodeStep(2 ** lb, ctx, H100));
const C1K = CURVE(1024);
const C8K = CURVE(8192);

const batching: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // The picture of a batched step.
    const dA = s.win('idea', 'one');
    if (dA > 0)
      s.alpha(dA, () => {
        const nRows = Math.round(lerp(1, 8, s.ease('batch', 2, 1)));
        const wx = w * 0.38;
        const ws = Math.min(u * 36, h * 0.42);
        const wy = h * 0.3;
        s.rrect(wx, wy, ws, ws, 1.5, { fill: s.tint('blue', 0.14), stroke: s.c('blue'), lw: 0.45 });
        s.text('W', wx + ws / 2, wy + ws / 2, { size: 9, italic: true, weight: 650, color: s.c('blue') });
        const rh = Math.min(u * 4, (ws - u * 2) / 8 - u * 0.6);
        const inX = wx - u * 26;
        for (let i = 0; i < nRows; i++) {
          const y = wy + u + i * (rh + u * 0.6);
          s.rrect(inX, y, u * 20, rh, 0.6, { fill: s.tint('orange', 0.45), stroke: s.c('orange'), lw: 0.2 });
          s.rrect(wx + ws + u * 6, y, u * 14, rh, 0.6, { fill: s.tint('purple', 0.45), stroke: s.c('purple'), lw: 0.2 });
        }
        s.arrow(inX + u * 21, wy + ws / 2, wx - u, wy + ws / 2, s.c('--ink-3'), 0.4, 2);
        s.arrow(wx + ws + u, wy + ws / 2, wx + ws + u * 5, wy + ws / 2, s.c('--ink-3'), 0.4, 2);
        s.text(`B = ${nRows} token${nRows > 1 ? 's' : ''}`, inX + u * 10, wy - u * 3, { size: 3.6, font: 'mono', weight: 600, color: s.c('slate') });
        s.alpha(s.ease('once', 0.6), () => {
          s.text('W crosses the memory bus once per step', w / 2, wy + ws + u * 9, { size: fit(s, 'W crosses the memory bus once per step', w - u * 10, 4, { weight: 600 }), weight: 600, color: s.c('blue') });
          s.text(`and serves all ${nRows}`, w / 2, wy + ws + u * 16, { size: 3.6, italic: true, color: s.c('--ink-2') });
        });
      });
    // Throughput against batch size.
    const pA = s.ease('one', 0.6);
    if (pA <= 0) return;
    s.alpha(pA, () => {
      const left = u * 14;
      const top = h * 0.16;
      const bottom = s.ease('gqa', 0.6);
      const F = new Frame(s, [left, top, w - left - u * 5, h - top - u * lerp(10, 27, bottom)], [-0.2, 10.2, 1.6, 5]);
      F.grid('y', [2, 3, 4, 5], (v) => ['', '', '100', '1k', '10k', '100k'][v]!);
      F.grid('x', [0, 2, 4, 6, 8, 10], (v) => `${2 ** v}`);
      s.text('tokens/s', u * 2, F.rect[1] - u * 3, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3') });
      s.text('batch size B', F.X(5), F.rect[1] + F.rect[3] + u * 7, { size: 3.2, color: s.c('--ink-3') });
      F.poly(LB, C1K.map((c) => Math.log10(c.tokS)), s.c('purple'), 0.65);
      F.poly(LB, C1K.map((c) => Math.log10(c.userS)), s.c('--ink-2'), 0.45, [1.2, 1]);
      s.text('all users', F.X(0.3), F.Y(4.6), { size: 3.4, weight: 600, align: 'left', color: s.c('purple') });
      s.text('each user', F.X(0.3), F.Y(2.05), { size: 3.4, align: 'left', color: s.c('--ink-2') });
      const m = s.ease('many', 1.4, 0.3);
      const lb = lerp(0, 6, m);
      const st = decodeStep(2 ** lb, 1024, H100);
      F.dot(lb, Math.log10(st.tokS), 1.4, s.c('purple'));
      const lab = `${fmtCount(st.tokS)} tokens/s`;
      s.text(lab, F.X(lb) + u * 2.5, F.Y(Math.log10(st.tokS)) + u * (lb < 2 ? -3.4 : 3), { size: 3.6, font: 'mono', weight: 650, align: 'left', color: s.c('purple'), halo: true });
      s.alpha(s.ease('user', 0.6), () => {
        F.dot(6, Math.log10(st.userS), 1.1, s.c('--ink-2'));
        s.text(`${Math.round(st.userS)} each`, F.X(6) + u * 2, F.Y(Math.log10(st.userS)) + u * 3.4, { size: 3.4, font: 'mono', align: 'left', color: s.c('--ink-2'), halo: true });
      });
      const lA = s.ease('long', 0.8);
      s.alpha(lA, () => {
        let cut = 10.2;
        for (let i = 0; i < LB.length; i++)
          if (!C8K[i]!.fits) {
            cut = LB[i]!;
            break;
          }
        hatch(s, F.X(cut), F.rect[1], F.rect[0] + F.rect[2] - F.X(cut), F.rect[3], s.tint('--ink-3', 0.3), 1.4);
        s.text('8K: does not fit', F.X(10.1), F.Y(4.75), { size: 3.2, align: 'right', color: s.c('--ink-2'), halo: true });
        F.poly(LB, C8K.map((c) => Math.log10(c.tokS)), s.c('red'), 0.55, [1.6, 0.9]);
        const s8 = decodeStep(64, 8192, H100);
        F.dot(6, Math.log10(s8.tokS), 1.3, s.c('red'));
        s.text('2,530 at 8K', F.X(6) + u * 2, F.Y(Math.log10(s8.tokS)) + u * 3.4, { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c('red'), halo: true });
      });
      s.alpha(s.ease('cache', 0.6) * (1 - lA), () =>
        s.text('each sequence reads its own cache', F.X(5), F.Y(1.85), { size: 3.4, italic: true, color: s.c('green'), halo: true }),
      );
      s.alpha(bottom, () => card(s, u * 5, h - u * 15, w - u * 10, u * 12, 'shrink the cache', 'grouped-query attention, 8-bit caches', 'green', 0.3));
    });
  },
};

// ---------------------------------------------------------------- continuous batching

const LENS = requestLengths(30, 7);
const SCHED = { static: schedule(LENS, 6, 'static'), continuous: schedule(LENS, 6, 'continuous') };
const SPAN = 130;

function gantt(s: Scene, S: ReturnType<typeof schedule>, x: number, y: number, gw: number, rh: number, upto: number): void {
  const { u } = s;
  const cw = gw / SPAN;
  const shown = Math.min(upto, S.steps);
  for (let i = 0; i < S.slots; i++) {
    const ry = y + i * rh;
    rect(s, x, ry + rh * 0.12, gw, rh * 0.76, s.tint('--ink-3', 0.05));
    for (let t = 0; t < shown; ) {
      const id = S.cell[i * S.cap + t]!;
      let e = t;
      while (e < shown && S.cell[i * S.cap + e] === id) e++;
      if (id < 0) hatch(s, x + t * cw, ry + rh * 0.12, (e - t) * cw, rh * 0.76, s.tint('red', 0.4), 1);
      else {
        s.rrect(x + t * cw + 0.5, ry + rh * 0.12, (e - t) * cw - 1, rh * 0.76, 0.6, { fill: s.tint(reqK(id), 0.5), stroke: s.c(reqK(id)), lw: 0.2 });
        rect(s, x + t * cw + 0.5, ry + rh * 0.12, Math.max(1, cw - 0.5), rh * 0.76, s.c(reqK(id)));
      }
      t = e;
    }
  }
  if (shown < S.steps && shown > 0) s.line(x + shown * cw, y, x + shown * cw, y + S.slots * rh, s.c('--ink'), 0.3);
  void u;
}

const continuous: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const x = u * 6;
    const gw = w - u * 12;
    const rh = Math.min(u * 5.2, h * 0.045);
    // the queue
    const qA = s.win('real', 'static');
    s.alpha(qA, () => {
      const bw = gw / LENS.length;
      const maxL = Math.max(...LENS);
      const by = h * 0.62;
      LENS.forEach((L, i) => {
        const hh = (h * 0.36 * L) / maxL;
        s.rrect(x + i * bw + bw * 0.15, by - hh, bw * 0.7, hh, 0.5, { fill: s.tint(reqK(i), 0.5), stroke: s.c(reqK(i)), lw: 0.2 });
      });
      s.text('30 requests: how many tokens each will generate', w / 2, by + u * 6, { size: fit(s, '30 requests: how many tokens each will generate', gw, 3.6, { italic: true }), italic: true, color: s.c('--ink-2') });
    });
    // static
    const y1 = h * 0.18;
    const sA = s.ease('static', 0.6);
    s.alpha(sA, () => {
      s.text('static', x, y1 - u * 3, { size: 3.8, weight: 650, align: 'left', color: s.c('--ink-2') });
      const upto = s.span('static', 'cont') * (SCHED.static.steps + 2);
      gantt(s, SCHED.static, x, y1, gw, rh, upto);
      s.alpha(s.ease('picture', 0.6, 1.5), () => s.text('126 steps', x + gw, y1 - u * 3, { size: 3.6, font: 'mono', weight: 650, align: 'right', color: s.c('red') }));
    });
    // continuous
    const y2 = y1 + 6 * rh + u * 10;
    const cA = s.ease('cont', 0.6);
    s.alpha(cA, () => {
      s.text('continuous', x, y2 - u * 3, { size: 3.8, weight: 650, align: 'left', color: s.c('--ink-2') });
      const upto = s.span('cont', 'result') * (SCHED.continuous.steps + 2);
      gantt(s, SCHED.continuous, x, y2, gw, rh, upto);
      s.alpha(s.ease('result', 0.6), () => s.text('64 steps', x + (gw * 64) / SPAN + u, y2 + 3 * rh, { size: 4.2, font: 'mono', weight: 650, align: 'left', color: s.c('green') }));
    });
    const cur = current(s, ['leave', 'join']);
    if (cur && s.since('result') < 0) {
      const t = cur === 'leave' ? 'a finished sequence leaves' : 'a waiting request joins';
      s.text(t, w / 2, y2 + 6 * rh + u * 6, { size: 3.6, italic: true, color: s.c('--ink-2') });
    }
    s.alpha(s.ease('orca', 0.6), () => pill(s, 'Orca, 2022: iteration-level scheduling', w / 2, y2 + 6 * rh + u * 6, 'slate', fit(s, 'Orca, 2022: iteration-level scheduling', w - u * 14, 3.2, { font: 'mono', weight: 600 })));
  },
};

// ---------------------------------------------------------------- paged attention

const KV_REQS = kvRequests(80);
const KV_FR = { contig: simulateKV('contig', KV_REQS, 240), paged: simulateKV('paged', KV_REQS, 240) };

function memGrid(s: Scene, fr: KvFrame, x: number, y: number, gw: number, mark: number): number {
  const { u } = s;
  const cols = 16;
  const gap = Math.max(1, u * 0.35);
  const bs = (gw - gap * (cols - 1)) / cols;
  for (let b = 0; b < KV_BLOCKS; b++) {
    const bx = x + (b % cols) * (bs + gap);
    const by = y + Math.floor(b / cols) * (bs + gap);
    const id = fr.owner[b]!;
    if (id < 0) {
      s.rrect(bx, by, bs, bs, 0.5, { stroke: s.tint('--ink-3', 0.35), lw: 0.15 });
      continue;
    }
    const k = reqK(id);
    s.rrect(bx, by, bs, bs, 0.5, { fill: s.tint(k, 0.08), stroke: s.tint(k, 0.5), lw: 0.15 });
    const f = fr.fill[b]! / KV_BS;
    if (f <= 0) hatch(s, bx + 1, by + 1, bs - 2, bs - 2, s.tint(k, 0.4), 0.9);
    else rect(s, bx + 1, by + 1 + (bs - 2) * (1 - f), bs - 2, (bs - 2) * f, s.tint(k, 0.75));
    if (id === mark) s.rrect(bx - 1, by - 1, bs + 2, bs + 2, 0.6, { stroke: s.c('--ink'), lw: 0.45 });
  }
  return 4 * bs + 3 * gap;
}

const paged: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    // One cache, growing to an unknown length.
    const gA = s.win('grow', 'reserve');
    s.alpha(gA, () => {
      const y = h * 0.48;
      const x0 = u * 8;
      const full = w - u * 24;
      const f = 0.15 + 0.6 * clamp01(s.since('grow') / 7);
      s.rrect(x0, y - u * 3, full * f, u * 6, 1, { fill: s.tint('green', 0.45), stroke: s.c('green'), lw: 0.3 });
      s.line(x0 + full * f + u, y, x0 + full, y, s.tint('--ink-3', 0.6), 0.3, [1, 1]);
      s.text('?', x0 + full + u * 4, y, { size: 6, weight: 650, color: s.c('--ink-3') });
      s.text("one sequence's KV cache, a token more every step", w / 2, y - u * 9, { size: fit(s, "one sequence's KV cache, a token more every step", w - u * 10, 3.6, { italic: true }), italic: true, color: s.c('--ink-2') });
    });
    const mode: 'contig' | 'paged' = s.since('paged') >= 0 ? 'paged' : 'contig';
    const mA = s.win('reserve') * (1 - s.ease('result', 0.6) * 0.0);
    if (mA <= 0) return;
    s.alpha(mA, () => {
      const t = mode === 'contig' ? Math.floor(s.span('reserve', 'paged') * 239) : Math.floor(clamp01(s.span('paged', 'result') * 1.05) * 239);
      const fr = KV_FR[mode][t]!;
      const gx = u * 5;
      const gw = w - u * 10;
      const gy = h * 0.17;
      const mark = s.since('table') >= 0 && mode === 'paged' ? (fr.table?.id ?? -1) : -1;
      const swap = s.ease('paged', 0.5);
      const head = mode === 'paged' ? 'paged: a block at a time' : 'reserved: one slab per request';
      s.alpha(mode === 'paged' ? swap : 1, () => s.text(head, gx, gy - u * 3, { size: 3.8, weight: 650, align: 'left', color: s.c(mode === 'paged' ? 'green' : 'slate') }));
      const gh = memGrid(s, fr, gx, gy, gw, mark);
      const util = fr.tokens / (KV_BLOCKS * KV_BS);
      const sy = gy + gh + u * 7;
      const rA = s.ease('result', 0.6);
      s.alpha(1 - rA, () => {
        s.text(`${fr.running} running`, gx, sy, { size: 3.8, font: 'mono', weight: 600, align: 'left', color: s.c('--ink') });
        s.text(`memory holding tokens: ${Math.round(util * 100)}%`, gx + gw, sy, { size: 3.8, font: 'mono', weight: 600, align: 'right', color: s.c(util > 0.6 ? 'green' : 'red') });
        if (mark >= 0 && fr.table) {
          const list = fr.table.blocks.slice(0, 6).join(', ') + (fr.table.blocks.length > 6 ? ', …' : '');
          const txt = `block table: request ${fr.table.id} → [${list}]`;
          s.text(txt, gx, sy + u * 8, { size: fit(s, txt, gw, 3.6, { font: 'mono' }), font: 'mono', align: 'left', color: s.c('--ink-2') });
        }
        const note = current(s, ['blocks', 'ondemand', 'table', 'free', 'tail']);
        const notes: Record<string, string> = {
          blocks: '64 blocks of 16 tokens',
          ondemand: 'a new block only when the last one fills',
          table: 'outlined: one request, its blocks scattered',
          free: 'finished: blocks back to the pool',
          tail: 'waste: only the tail of each last block',
        };
        if (note) s.text(notes[note]!, w / 2, sy + u * (mark >= 0 ? 16 : 9), { size: fit(s, notes[note]!, gw, 3.6, { italic: true }), italic: true, color: s.c('--ink-2') });
        if (mode === 'contig' && s.since('waste') >= 0) s.text('hatched: reserved, never written', w / 2, sy + u * 9, { size: 3.6, italic: true, color: s.c('--ink-2') });
        // legend
        const ly = h - u * 9;
        const sw = u * 4;
        const items: [string, 'fill' | 'hatch' | 'free'][] = [['tokens', 'fill'], ['reserved, empty', 'hatch'], ['free', 'free']];
        let lx = gx;
        for (const [name, kind] of items) {
          if (kind === 'fill') rect(s, lx, ly - sw / 2, sw, sw, s.tint('teal', 0.75));
          else if (kind === 'hatch') {
            s.rrect(lx, ly - sw / 2, sw, sw, 0.4, { stroke: s.tint('teal', 0.5), lw: 0.15 });
            hatch(s, lx, ly - sw / 2, sw, sw, s.tint('teal', 0.5), 0.9);
          } else s.rrect(lx, ly - sw / 2, sw, sw, 0.4, { stroke: s.tint('--ink-3', 0.5), lw: 0.15 });
          s.text(name, lx + sw + u * 1.2, ly, { size: 3.2, align: 'left', color: s.c('--ink-2') });
          lx += sw + u * 3 + s.measure(name, { size: 3.2 });
        }
      });
      // finished requests over time, both policies
      s.alpha(rA, () => {
        const top = sy + u * 2;
        const F = new Frame(s, [gx + u * 9, top, gw - u * 9, h - top - u * 8], [0, 239, 0, 75]);
        F.grid('y', [0, 25, 50, 75], (v) => String(v));
        const prog = smooth(clamp01((s.since('result') - 0.2) / 2.2));
        const n = Math.max(2, Math.floor(prog * 239));
        const xs = Array.from({ length: n }, (_, i) => i);
        F.poly(xs, xs.map((i) => KV_FR.contig[i]!.done), s.c('slate'), 0.55);
        F.poly(xs, xs.map((i) => KV_FR.paged[i]!.done), s.c('green'), 0.65);
        s.alpha(clamp01(prog * 3 - 2), () => {
          s.text('paged: 71 finished', F.X(8), F.Y(68), { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c('green'), halo: true });
          s.text('reserved: 23', F.X(236), F.Y(23) + u * 3.5, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('slate'), halo: true });
        });
        s.text('decode steps →', F.X(239), F.rect[1] + F.rect[3] + u * 3.2, { size: 3, align: 'right', color: s.c('--ink-3') });
      });
    });
  },
};

export const scenesA: Record<string, SceneDef> = { intro, prefill, roofline, batching, continuous, paged };

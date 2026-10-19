import type { Page } from '../core/page';
import { color, withAlpha } from '../core/plot';
import { box, gridLines, hatch, legend, mono, narrow, pow10, reqColor, txt, ui } from './inference-draw';
import {
  GPUS,
  type GpuId,
  KV_BLOCKS,
  KV_BS,
  KV_PER_TOKEN,
  MODEL,
  decodeStep,
  fmtBytes,
  fmtCount,
  fmtTime,
  kvRequests,
  prefillCost,
  requestLengths,
  schedule,
  simulateKV,
} from './inference-math';

// ------------------------------------------------------------------ 1. prefill and decode

export function figGenerate(p: Page): void {
  p.figure({
    title: 'One request: a prefill, then one token per pass',
    codeTitle: 'generate.py',
    code: `
      prompt = tokenize(text)        # T = {{T:1000}} tokens
      logits, cache = model(prompt)  # all T at once   #@prefill
      tok = sample(logits[-1])       # after {{ttft}}  #@prefill
      for step in range(1, 24):                        #@decode
          logits, cache = model([tok], cache)          #@decode
          tok = sample(logits[-1])   # {{tpot}} each   #@decode
      # the cache holds T + {{n:24}} tokens: {{kv}}
    `,
    setup(f) {
      const gpu = GPUS.H100;
      const NEW = 24;
      let T = 1000;
      let shown = NEW;
      let phase = 1;
      let flash = 0;
      const cost = () => {
        const pre = prefillCost(T, gpu);
        const dec = decodeStep(1, T + NEW / 2, gpu);
        return { pre, dec };
      };
      const cv = f.canvas(640, narrow() ? 520 : 400, (c, w, h) => {
        const { pre, dec } = cost();
        const L = 10;
        const R = w - 10;
        const bw = R - L;
        const bh = 18;
        const y0 = Math.max(0, (h - 250) / 2);
        const head = (y: number, left: string, k: Parameters<typeof color>[0], right: string) => {
          txt(c, left, L, y, { font: ui(12, 600), color: color(k) });
          txt(c, right, R, y, { font: mono(11), color: color('--ink-2'), align: 'right' });
        };
        // tokens: the prompt as one bar, then each generated token as a square
        const nOut = phase === 0 ? 0 : shown;
        head(y0 + 8, 'tokens', '--ink-2', `prompt ${fmtCount(T)} + ${nOut} new`);
        const pw = bw * 0.3;
        const sq = Math.min(bh, (bw - pw - 6) / NEW - 2);
        box(c, L, y0 + 18, pw, bh, 4, withAlpha(color('orange'), phase === 0 ? 0.6 : 0.25), color('orange'));
        for (let i = 0; i < NEW; i++) {
          const x = L + pw + 6 + i * (sq + 2);
          const on = i < shown && phase === 1;
          box(c, x, y0 + 18 + (bh - sq) / 2, sq, sq, 2, on ? withAlpha(color('purple'), i === shown - 1 ? 0.95 : 0.5) : undefined, withAlpha(color('purple'), on ? 1 : 0.3));
        }
        // weights: read in full on every pass
        head(y0 + 54, 'weights W', 'blue', `${fmtBytes(MODEL.params * 2)}, all read every pass`);
        box(c, L, y0 + 64, bw, bh, 4, withAlpha(color('blue'), 0.14 + 0.5 * flash), color('blue'));
        // KV cache: grows a token at a time
        const ctxNow = T + nOut;
        head(y0 + 100, 'KV cache', 'green', `${fmtCount(ctxNow)} tokens × 128 KiB = ${fmtBytes(ctxNow * KV_PER_TOKEN)}`);
        box(c, L, y0 + 110, bw, bh, 4, undefined, withAlpha(color('green'), 0.45));
        box(c, L, y0 + 110, Math.max(4, (bw * ctxNow) / (4096 + NEW)), bh, 4, withAlpha(color('green'), 0.4), color('green'));
        // the time line
        const total = pre.t + NEW * dec.t;
        const sx = (t: number) => L + (bw * t) / total;
        head(y0 + 146, 'time', '--ink-2', `0 to ${fmtTime(total)}`);
        const ty = y0 + 156;
        box(c, sx(0), ty, Math.max(2, sx(pre.t) - sx(0) - 1), 22, 3, withAlpha(color('orange'), 0.5), color('orange'));
        for (let i = 0; i < nOut; i++) box(c, sx(pre.t + i * dec.t) + 0.5, ty, Math.max(1.5, sx(dec.t) - sx(0) - 1.5), 22, 2, withAlpha(color('purple'), 0.55));
        txt(c, `prefill: ${fmtTime(pre.t)}`, L, ty + 42, { font: mono(11.5, 600), color: color('orange') });
        txt(c, `${fmtCount(T / pre.t)} tokens/s`, R, ty + 42, { font: mono(11), color: color('--ink-2'), align: 'right' });
        txt(c, `decode: ${fmtTime(dec.t)} per token`, L, ty + 62, { font: mono(11.5, 600), color: color('purple') });
        txt(c, `${fmtCount(1 / dec.t)} tokens/s`, R, ty + 62, { font: mono(11), color: color('--ink-2'), align: 'right' });
      });
      const ttftRo = f.readout('time to first token');
      const tpotRo = f.readout('time per output token');
      const sync = () => {
        const { pre, dec } = cost();
        f.code.setMany({ ttft: fmtTime(pre.t), tpot: fmtTime(dec.t), n: phase === 0 ? 0 : shown, kv: fmtBytes((T + (phase === 0 ? 0 : shown)) * KV_PER_TOKEN) });
        ttftRo.set(fmtTime(pre.t));
        tpotRo.set(fmtTime(dec.t));
        cv.redraw();
      };
      f.slider({
        label: 'prompt length T',
        min: 4,
        max: 12,
        step: 0.01,
        value: Math.log2(1000),
        map: (r) => Number((2 ** r).toPrecision(2)),
        format: (v) => fmtCount(v),
        slot: 'T',
        onInput: (v) => {
          T = v;
          sync();
        },
      });
      let acc = 0;
      const run = f.loop((dt) => {
        acc += dt;
        flash = Math.max(0, flash - dt * 4);
        if (phase === 0 && acc > 0.9) {
          phase = 1;
          shown = 0;
          acc = 0;
        }
        if (phase === 1 && acc > 0.22) {
          acc = 0;
          shown++;
          flash = 1;
          f.code.highlight('decode');
        }
        sync();
        if (phase === 1 && shown >= NEW) {
          f.code.highlight(null);
          btn.textContent = 'Generate';
          return false;
        }
      });
      const btn = f.button('Generate', () => {
        phase = 0;
        shown = 0;
        acc = 0;
        flash = 1;
        f.code.highlight('prefill');
        btn.textContent = 'Generating…';
        run.start();
      }, { primary: true });
      sync();
    },
    caption: `A request to Llama 3 8B in bf16 on one H100, timed with the roofline model of the next section (datasheet speeds, so real servers are somewhat slower). **Generate** replays it: the whole prompt goes through the model in one pass, then every new token needs a pass of its own, and each pass reads all 16 GB of weights. Drag the prompt length: prefill time grows with $T$ once the prompt is a few hundred tokens long, while the time per output token barely moves. Prefill handles tens of thousands of tokens per second; decode, about two hundred.`,
  });
}

// ------------------------------------------------------------------ 2. the roofline and batching

export function figRoofline(p: Page): void {
  p.figure({
    title: 'The roofline, and what batching buys',
    codeTitle: 'roofline.py',
    code: `
      N, kv_tok = 8.03e9, 131072   # Llama 3 8B, bf16
      peak, bw = {{peak:989e12}}, {{bw:3.35e12}}  # {{gpu:H100}}
      B, ctx = {{B:1}}, {{ctx:1024}}

      flops = B * (2 * N + attn_flops(ctx))      #@flops
      bytes_ = 2 * N + B * ctx * kv_tok          #@bytes
      intensity = flops / bytes_    # {{I}}      #@I
      t = max(flops / peak, bytes_ / bw)         #@t
      tok_s = B / t          # {{tps}} tokens/s  #@tps
      per_user = 1 / t       # {{ups}} each      #@tps
    `,
    setup(f) {
      let B = 1;
      let ctx = 1024;
      let gid: GpuId = 'H100';
      const gpu = () => GPUS[gid];
      const roof = f.plot({
        aspect: 1.55,
        square: false,
        domain: [-0.3, 3.6, -0.32, 3.35],
        draw: (pl) => {
          const g = gpu();
          gridLines(pl, 'x', [0, 1, 2, 3], (v) => pow10(v));
          gridLines(pl, 'y', [0, 1, 2, 3], (v) => `${pow10(v)} TFLOP/s`);
          const ridge = Math.log10(g.flops / g.bw);
          const ys = (lx: number) => Math.log10(Math.min(g.flops, 10 ** lx * g.bw) / 1e12);
          const xs: number[] = [];
          const yv: number[] = [];
          for (let lx = -0.3; lx <= 3.6; lx += 0.02) {
            xs.push(lx);
            yv.push(ys(lx));
          }
          pl.ctx.fillStyle = withAlpha(color('blue'), 0.06);
          pl.ctx.beginPath();
          pl.ctx.moveTo(pl.sx(xs[0]!), pl.sy(-0.32));
          xs.forEach((x, i) => pl.ctx.lineTo(pl.sx(x), pl.sy(yv[i]!)));
          pl.ctx.lineTo(pl.sx(xs[xs.length - 1]!), pl.sy(-0.32));
          pl.ctx.fill();
          pl.path(xs, yv, color('blue'), 2.5);
          pl.path([ridge, ridge], [-0.32, ys(ridge)], withAlpha(color('--ink-3'), 0.8), 1, [4, 4]);
          const c = pl.ctx;
          c.save();
          c.translate(pl.sx(0.75), pl.sy(ys(0.75)) - 8);
          c.rotate(-Math.atan2(pl.sy(0) - pl.sy(1), pl.sx(1) - pl.sx(0)));
          c.font = ui(11.5, 600);
          c.fillStyle = color('blue');
          c.textAlign = 'left';
          c.fillText('memory roof: I × bandwidth', 0, 0);
          c.restore();
          pl.text(`compute roof ${Math.round(g.flops / 1e12)}`, 3.55, ys(3.5) - 0.3, { align: 'right', size: 11.5, bold: true, color: color('blue') });
          pl.text(`ridge ≈ ${Math.round(g.flops / g.bw)}`, ridge + 0.06, 0.12, { size: 11, color: color('--ink-2') });
          // prefill of a 1,000-token prompt, for reference
          const pre = prefillCost(1000, g);
          const px = Math.log10(pre.intensity);
          const py = Math.log10(pre.flops / pre.t / 1e12);
          pl.dot(px, py, 5, color('--card'), color('orange'));
          const st = decodeStep(B, ctx, g);
          const dx = Math.log10(st.intensity);
          const dy = Math.log10(st.flops / st.t / 1e12);
          pl.dot(dx, dy, 6.5, color('red'), color('--card'));
          const high = dx > 2.2;
          pl.text(`decode, B = ${B}`, dx + (high ? -0.1 : 0.12), dy + (high ? 0.15 : -0.17), { align: high ? 'right' : 'left', size: 12, bold: true, color: color('red') });
          pl.text('I, FLOP per byte →', 0.6, 0.12, { size: 11, color: color('--ink-3') });
        },
      });
      legend(f)([
        { k: 'red', label: 'a decode step at batch B' },
        { k: 'orange', label: 'prefill of a 1,000-token prompt' },
      ]);
      const thr = f.plot({
        aspect: 1.9,
        square: false,
        domain: [-0.9, 10.3, 1, 5.3],
        draw: (pl) => {
          const g = gpu();
          gridLines(pl, 'y', [2, 3, 4, 5], (v) => `${pow10(v)}`);
          gridLines(pl, 'x', [0, 2, 4, 6, 8, 10], (v) => `B=${2 ** v}`);
          const xs: number[] = [];
          const tot: number[] = [];
          const usr: number[] = [];
          let cut = 11;
          for (let lb = 0; lb <= 10.001; lb += 0.05) {
            const st = decodeStep(2 ** lb, ctx, g);
            if (!st.fits && cut > 10.5) cut = lb;
            xs.push(lb);
            tot.push(Math.log10(st.tokS));
            usr.push(Math.log10(st.userS));
          }
          if (cut <= 10.3) {
            const x = pl.sx(cut);
            pl.ctx.fillStyle = withAlpha(color('--ink-3'), 0.1);
            pl.ctx.fillRect(x, 0, pl.w - x, pl.h);
            hatch(pl.ctx, x, 0, pl.w - x, pl.h, withAlpha(color('--ink-3'), 0.25), 7);
            pl.text('cache + weights > 80 GB', 10.2, 5.05, { align: 'right', size: 11, color: color('--ink-2') });
          }
          pl.path(xs, tot, color('purple'), 2.5);
          pl.path(xs, usr, color('--ink-2'), 1.8, [5, 4]);
          const st = decodeStep(B, ctx, g);
          const lb = Math.log2(B);
          pl.path([lb, lb], [1, 5.3], withAlpha(color('red'), 0.5), 1, [3, 3]);
          pl.dot(lb, Math.log10(st.tokS), 5.5, color('purple'), color('--card'));
          pl.dot(lb, Math.log10(st.userS), 4.5, color('--ink-2'), color('--card'));
          pl.text('tokens/s, all users', 0.2, 4.75, { size: 11.5, bold: true, color: color('purple') });
          pl.text('tokens/s, each user', 0.2, 1.55, { size: 11.5, color: color('--ink-2') });
        },
      });
      const tRo = f.readout('step time');
      const tpsRo = f.readout('tokens/s');
      const boundRo = f.readout('limited by');
      const sync = () => {
        const st = decodeStep(B, ctx, gpu());
        f.code.setMany({ B, ctx, I: fmtCount(st.intensity, 3), tps: fmtCount(st.tokS), ups: fmtCount(st.userS) });
        tRo.set(fmtTime(st.t));
        tpsRo.set(fmtCount(st.tokS));
        boundRo.set(!st.fits ? 'memory capacity' : st.bound === 'compute' ? 'compute' : st.bound === 'weights' ? 'reading weights' : 'reading the cache');
        f.code.highlight(st.bound === 'compute' ? 't' : 'bytes');
        roof.redraw();
        thr.redraw();
      };
      f.slider({ label: 'batch size B', sym: 'B', min: 0, max: 10, step: 1, value: 0, map: (r) => 2 ** r, onInput: (v) => { B = v; sync(); } });
      f.slider({ label: 'context', min: 7, max: 15, step: 1, value: 10, map: (r) => 2 ** r, format: (v) => v.toLocaleString('en-US'), onInput: (v) => { ctx = v; sync(); } });
      f.segmented({
        label: 'GPU',
        options: [{ value: 'A100', label: 'A100' }, { value: 'H100', label: 'H100' }],
        value: 'H100',
        slot: 'gpu',
        onChange: (v) => {
          gid = v as GpuId;
          f.code.setMany({ peak: gid === 'H100' ? '989e12' : '312e12', bw: gid === 'H100' ? '3.35e12' : '2.04e12' });
          sync();
        },
      });
      sync();
    },
    caption: `**Top:** the roofline of one GPU. A kernel that does $\\symI$ floating-point operations per byte it moves can run no faster than $\\symI$ times the memory bandwidth (the slope) or the peak compute (the flat roof), whichever is lower. Decode at batch 1 sits at $\\symI \\approx 1$, far down the slope, using well under 1% of the compute; a 1,000-token prefill is past the ridge. **Bottom:** decode throughput as the batch grows, for the same model (log scales). Slide $\\symB$ up: total tokens per second rises almost in proportion while each user's speed barely drops, until the step turns compute-bound or the KV cache, which every sequence reads for itself, dominates the bytes. Raise the context to 8K and watch the cache take over long before compute does, and the 80 GB memory run out.`,
  });
}

// ------------------------------------------------------------------ 3. static versus continuous batching

export function figBatching(p: Page): void {
  p.figure({
    title: 'Static batching versus continuous batching',
    codeTitle: 'scheduler.py',
    code: `
      B = 6                           # slots in the batch
      slots = [None] * B
      while queue or any(slots):
          may_join = {{rule:True}}
          for i in range(B):
              if slots[i] is None and queue and may_join:  #@join
                  slots[i] = queue.pop(0)  # prefill, join  #@join
          decode_step(slots)   # one token for each         #@step
          for i in range(B):
              if slots[i] and slots[i].finished:           #@leave
                  slots[i] = None                           #@leave
      # {{steps:…}} steps, slots busy {{util:…}} of the time
    `,
    setup(f) {
      const lens = requestLengths(30, 7);
      const SLOTS = 6;
      const sched = { static: schedule(lens, SLOTS, 'static'), continuous: schedule(lens, SLOTS, 'continuous') };
      const span = Math.max(sched.static.steps, sched.continuous.steps);
      let mode: 'static' | 'continuous' = 'static';
      let t = span;
      const cv = f.canvas(640, narrow() ? 440 : 290, (c, w, h) => {
        const S = sched[mode];
        const L = 52;
        const R = w - 10;
        const top = 12;
        const rh = Math.min(30, (h - 80) / SLOTS);
        const cw = (R - L) / span;
        const shown = Math.min(t, S.steps);
        for (let i = 0; i < SLOTS; i++) {
          const y = top + i * rh;
          txt(c, `slot ${i}`, L - 8, y + rh / 2, { font: mono(11), color: color('--ink-3'), align: 'right' });
          box(c, L, y + 2, R - L, rh - 4, 4, withAlpha(color('--ink-3'), 0.05));
          // idle cells, drawn as hatching, only while work is still waiting
          for (let s = 0; s < shown; s++) {
            if (S.cell[i * S.cap + s]! >= 0) continue;
            let e = s;
            while (e < shown && S.cell[i * S.cap + e]! < 0) e++;
            hatch(c, L + s * cw, y + 3, (e - s) * cw, rh - 6, withAlpha(color('red'), 0.3), 5);
            s = e - 1;
          }
          for (let s = 0; s < shown; ) {
            const id = S.cell[i * S.cap + s]!;
            if (id < 0) {
              s++;
              continue;
            }
            let e = s;
            while (e < shown && S.cell[i * S.cap + e] === id) e++;
            const col = reqColor(id);
            box(c, L + s * cw + 0.5, y + 3, (e - s) * cw - 1, rh - 6, 3, withAlpha(col, 0.5), col);
            if (S.first[i * S.cap + s]) box(c, L + s * cw + 0.5, y + 3, Math.max(2, cw - 1), rh - 6, 2, col);
            s = e;
          }
        }
        const ay = top + SLOTS * rh + 6;
        c.strokeStyle = color('--axis');
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(L, ay + 0.5);
        c.lineTo(R, ay + 0.5);
        c.stroke();
        for (let s = 0; s <= span; s += 20) txt(c, String(s), L + s * cw, ay + 11, { font: mono(10.5), color: color('--ink-3'), align: 'center' });
        txt(c, 'step', L - 8, ay + 11, { font: mono(10.5), color: color('--ink-3'), align: 'right' });
        if (t < S.steps) {
          const x = L + t * cw;
          c.strokeStyle = color('--ink');
          c.lineWidth = 1.5;
          c.beginPath();
          c.moveTo(x, top);
          c.lineTo(x, ay);
          c.stroke();
        } else {
          const x = L + S.steps * cw;
          c.strokeStyle = color('green');
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(x, top);
          c.lineTo(x, ay);
          c.stroke();
          txt(c, `all 30 done after ${S.steps} steps`, L, h - 10, { font: mono(11.5, 600), color: color('green') });
        }
        const doneN = S.done.filter((d) => d >= 0 && d < shown).length;
        txt(c, `${doneN} / 30 requests done`, L, h - 30, { font: mono(11.5), color: color('--ink-2') });
      });
      const utilRo = f.readout('slots busy');
      const sync = () => {
        const S = sched[mode];
        const shown = Math.min(t, S.steps);
        let busy = 0;
        for (let i = 0; i < SLOTS; i++) for (let s = 0; s < shown; s++) if (S.cell[i * S.cap + s]! >= 0) busy++;
        const util = shown ? busy / (SLOTS * shown) : 0;
        utilRo.set(`${Math.round(util * 100)}%`);
        f.code.setMany({ steps: shown >= S.steps ? S.steps : '…', util: `${Math.round(util * 100)}%` });
        cv.redraw();
      };
      let acc = 0;
      let phase = 0;
      const run = f.loop((dt) => {
        acc += dt;
        while (acc > 0.05) {
          acc -= 0.05;
          t++;
          f.code.highlight(['join', 'step', 'leave'][phase++ % 3]!);
        }
        sync();
        if (t >= sched[mode].steps) {
          f.code.highlight(null);
          return false;
        }
      });
      f.segmented({
        label: 'batching',
        options: [{ value: 'static', label: 'static' }, { value: 'continuous', label: 'continuous' }],
        value: 'static',
        onChange: (v) => {
          mode = v as typeof mode;
          f.code.set('rule', mode === 'static' ? 'not any(slots)' : 'True');
          t = 0;
          run.start();
        },
      });
      f.code.set('rule', 'not any(slots)');
      f.button('Replay', () => {
        t = 0;
        run.start();
      }, { primary: true });
      sync();
    },
    caption: `Thirty requests with mixed output lengths share 6 slots; each colored bar is one request, its solid first cell the prefill. **Static** batching starts a new batch only when every request in the current one has finished, so slots sit idle (red hatching) while the longest request drags on. **Continuous** batching refills a slot on the very next step. Switch between them: the same work finishes in about half the steps. The last few steps of either schedule leave slots empty only because the queue has run dry.`,
  });
}

// ------------------------------------------------------------------ 4. paged KV memory

export function figPaged(p: Page): void {
  p.figure({
    title: 'KV-cache memory: reserved up front, or paged',
    codeTitle: 'paged_kv.py',
    code: `
      BLOCK = 16                    # tokens per block
      free = list(range(64))        # physical blocks
      table = {}                    # seq -> its blocks  #@table

      def admit(seq):
          n = -(-seq.prompt_len // BLOCK)   # ceil      #@admit
          table[seq.id] = [free.pop() for _ in range(n)]  #@admit

      def append_token(seq):
          if seq.len == BLOCK * len(table[seq.id]):    #@grow
              table[seq.id].append(free.pop())  # any  #@grow
          seq.len += 1

      def finish(seq):
          free.extend(table.pop(seq.id))               #@free
      # {{mode:paged}}: {{run}} running, {{util}} used
    `,
    setup(f) {
      const STEPS = 240;
      const reqs = kvRequests(80);
      const frames = { contig: simulateKV('contig', reqs, STEPS), paged: simulateKV('paged', reqs, STEPS) };
      let mode: 'contig' | 'paged' = 'contig';
      let t = STEPS - 1;
      const cv = f.canvas(640, narrow() ? 580 : 380, (c, w, h) => {
        const fr = frames[mode][t]!;
        const cols = 16;
        const gap = 2;
        const bs = Math.min(34, (w - 8 - gap * (cols - 1)) / cols);
        const gx = (w - (bs * cols + gap * (cols - 1))) / 2;
        const gy = 22;
        txt(c, `GPU memory: ${KV_BLOCKS} blocks of ${KV_BS} tokens`, gx, 10, { font: ui(12, 600), color: color('--ink-2') });
        for (let b = 0; b < KV_BLOCKS; b++) {
          const x = gx + (b % cols) * (bs + gap);
          const y = gy + Math.floor(b / cols) * (bs + gap);
          const id = fr.owner[b]!;
          if (id < 0) {
            box(c, x, y, bs, bs, 3, undefined, withAlpha(color('--ink-3'), 0.35));
            continue;
          }
          const col = reqColor(id);
          box(c, x, y, bs, bs, 3, withAlpha(col, 0.1), withAlpha(col, 0.55));
          const fill = fr.fill[b]! / KV_BS;
          if (fill <= 0) hatch(c, x + 1, y + 1, bs - 2, bs - 2, withAlpha(col, 0.35), 4);
          else box(c, x + 1, y + 1 + (bs - 2) * (1 - fill), bs - 2, (bs - 2) * fill, 2, withAlpha(col, 0.75));
        }
        const gridBottom = gy + 4 * (bs + gap);
        // block table of the oldest running sequence
        const tb = fr.table;
        if (tb) {
          const list = tb.blocks.length > 9 ? `${tb.blocks.slice(0, 8).join(', ')}, …` : tb.blocks.join(', ');
          const desc = mode === 'paged' ? `blocks [${list}]` : `blocks ${tb.blocks[0]}-${tb.blocks[tb.blocks.length - 1]}, one run`;
          box(c, gx, gridBottom + 4, 12, 12, 3, reqColor(tb.id));
          txt(c, `request ${tb.id} → ${desc}`, gx + 18, gridBottom + 10, { font: mono(11), color: color('--ink-2') });
        }
        // finished requests over time, both policies
        const py0 = gridBottom + 30;
        const py1 = h - 22;
        const px0 = gx + 28;
        const px1 = gx + bs * cols + gap * (cols - 1);
        const maxDone = frames.paged[STEPS - 1]!.done;
        const X = (s: number) => px0 + ((px1 - px0) * s) / (STEPS - 1);
        const Y = (d: number) => py1 - ((py1 - py0) * d) / maxDone;
        c.strokeStyle = color('--grid');
        c.lineWidth = 1;
        for (const d of [0, 20, 40, 60]) {
          if (d > maxDone) continue;
          c.beginPath();
          c.moveTo(px0, Math.round(Y(d)) + 0.5);
          c.lineTo(px1, Math.round(Y(d)) + 0.5);
          c.stroke();
          txt(c, String(d), px0 - 6, Y(d), { font: mono(10.5), color: color('--ink-3'), align: 'right' });
        }
        txt(c, 'requests finished', px0 + 4, py0 + 2, { font: ui(11), color: color('--ink-3') });
        txt(c, 'decode steps', px1, h - 9, { font: ui(11), color: color('--ink-3'), align: 'right' });
        for (const m of ['contig', 'paged'] as const) {
          const k = m === 'paged' ? 'green' : 'slate';
          c.strokeStyle = withAlpha(color(k), m === mode ? 1 : 0.45);
          c.lineWidth = m === mode ? 2.5 : 1.5;
          c.beginPath();
          frames[m].forEach((fm, s) => (s ? c.lineTo(X(s), Y(fm.done)) : c.moveTo(X(s), Y(fm.done))));
          c.stroke();
          const end = frames[m][STEPS - 1]!.done;
          txt(c, m === 'paged' ? `paged ${end}` : `reserved ${end}`, px1 - 4, Y(end) - 9, { font: mono(11, 600), color: color(k), align: 'right' });
        }
        c.strokeStyle = withAlpha(color('--ink'), 0.6);
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(X(t), py0);
        c.lineTo(X(t), py1);
        c.stroke();
      });
      const runRo = f.readout('running');
      const utilRo = f.readout('memory holding tokens');
      const sync = () => {
        const fr = frames[mode][t]!;
        const util = fr.tokens / (KV_BLOCKS * KV_BS);
        runRo.set(fr.running);
        utilRo.set(`${Math.round(util * 100)}%`);
        f.code.setMany({ run: fr.running, util: `${Math.round(util * 100)}%`, mode: mode === 'paged' ? 'paged' : 'reserved' });
        cv.redraw();
      };
      let acc = 0;
      const run = f.loop((dt) => {
        acc += dt;
        while (acc > 0.06 && t < STEPS - 1) {
          acc -= 0.06;
          t++;
          const a = frames[mode][t - 1]!;
          const b = frames[mode][t]!;
          let grew = false;
          let freed = false;
          for (let i = 0; i < KV_BLOCKS; i++) {
            if (a.owner[i]! < 0 && b.owner[i]! >= 0) grew = true;
            if (a.owner[i]! >= 0 && b.owner[i]! < 0) freed = true;
          }
          if (mode === 'paged') f.code.highlight(freed ? 'free' : grew ? 'grow' : null);
        }
        sync();
        if (t >= STEPS - 1) {
          f.code.highlight(null);
          return false;
        }
      });
      f.segmented({
        label: 'KV memory',
        options: [{ value: 'contig', label: 'reserve max length' }, { value: 'paged', label: 'paged' }],
        value: 'contig',
        onChange: (v) => {
          mode = v as typeof mode;
          t = 0;
          run.start();
        },
      });
      f.button('Replay', () => {
        t = 0;
        run.start();
      }, { primary: true });
      sync();
    },
    caption: `A toy server with 64 blocks of KV memory, 16 tokens each, and a queue of requests whose final lengths nobody knows in advance. Each color is one request; a block's solid fill is how many of its 16 slots hold real tokens, and hatching is memory reserved but empty. **Reserve max length** gives each request one contiguous run big enough for its prompt plus the most tokens it may generate: most of it never fills, so only four or five requests fit at once. **Paged** hands out a block whenever a sequence fills its last one, from anywhere in memory, and a block table (bottom) records where each sequence's blocks live. Three times as many requests run at once, and three times as many finish. When the blocks run out, the newest sequence is preempted and recomputed later, as vLLM does.`,
  });
}

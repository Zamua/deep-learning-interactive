// The eight figures of the parallelism chapter. Each is a function of the Page it renders into.
import { fmt } from '../core/code';
import type { Page } from '../core/page';
import { CLASS_COLORS, color, withAlpha } from '../core/plot';
import { arrowLine, hatch, heat, legend, partFill, rbox, textW, txt } from './parallelism-draw';
import {
  CK_A,
  CK_C,
  GPU,
  LINKS,
  type Link,
  PART_INFO,
  type PipeKind,
  SHAPES,
  ZERO_STAGES,
  bubbleFraction,
  bytesStr,
  ckCurve,
  ckStateAt,
  ckTimeline,
  coords3d,
  countStr,
  ddpStep,
  paramsOf,
  pipeSchedule,
  ringAllReduce,
  ringFactor,
  tpToy,
  trainMemory,
  zeroComm,
  zeroMem,
} from './parallelism-math';

const smooth = (v: number) => {
  const x = Math.max(0, Math.min(1, v));
  return x * x * (3 - 2 * x);
};
const pct = (v: number, digits = 0) => `${(v * 100).toFixed(digits)}%`;
const secs = (v: number) => (v >= 1 ? `${v.toFixed(2)} s` : `${(v * 1000).toFixed(0)} ms`);
const tokStr = (v: number) => (v >= 1024 ? `${v / 1024}K` : String(v));

// ---------------------------------------------------------------- 1. memory calculator

export function figMemory(p: Page): void {
  p.figure({
    title: 'How many GPUs does it take just to hold a training run?',
    codeTitle: 'train_memory.py',
    code: `
      def train_memory(L, d, s, b, ckpt):
          n_params = 12 * L * d**2 + 50257 * d
          weights = 2 * n_params    # bf16           #@w
          grads   = 2 * n_params    # bf16           #@g
          master  = 4 * n_params    # fp32 copy      #@st
          adam_m  = 4 * n_params    # fp32           #@st
          adam_v  = 4 * n_params    # fp32           #@st
          if ckpt:   # block inputs + one block      #@ck
              acts = 2*s*b*d*L + 34*s*b*d            #@ck
          else:      # all that backward needs       #@act
              acts = 34 * s * b * d * L              #@act
          return (weights + grads + master
                  + adam_m + adam_v + acts)

      train_memory(L={{L:32}}, d={{d:4096}}, s={{s:2048}},
                   b={{b:1}}, ckpt={{ck:False}})
      # n_params {{psi}}: {{total}} = {{gpus}} H100s
    `,
    setup(f) {
      let shape = SHAPES[1]!;
      let s = 2048;
      let b = 1;
      let ckpt = false;
      const cv = f.canvas(640, 340, (ctx, w, h) => {
        const m = trainMemory(shape.L, shape.d, s, b, ckpt);
        const barY = 4;
        const barH = 30;
        let x = 0;
        for (const part of m.parts) {
          const ww = (part.bytes / m.total) * w;
          ctx.fillStyle = partFill(part.key);
          ctx.fillRect(x, barY, ww, barH);
          const lab = `${PART_INFO[part.key].short} ${pct(part.bytes / m.total)}`;
          if (ww > textW(ctx, lab, 11) + 8) txt(ctx, lab, x + ww / 2, barY + barH / 2, { size: 11, align: 'center', weight: 600 });
          else if (ww > textW(ctx, pct(part.bytes / m.total), 11) + 6) txt(ctx, pct(part.bytes / m.total), x + ww / 2, barY + barH / 2, { size: 11, align: 'center', weight: 600 });
          x += ww;
        }
        const n = m.total / GPU.mem;
        const unit = n <= 40 ? 1 : n <= 320 ? 8 : 64;
        const cap = GPU.mem * unit;
        const count = Math.max(1, Math.ceil(m.total / cap - 1e-9));
        const top = barY + barH + 26;
        const bottom = h - 24;
        const gap = 5;
        let best = { cols: 1, size: 0 };
        for (let c = 1; c <= count; c++) {
          const r = Math.ceil(count / c);
          const size = Math.min((w - (c - 1) * gap) / c, (bottom - top - (r - 1) * gap) / r, 96);
          if (size >= best.size - 0.01) best = { cols: c, size };
        }
        const { cols, size } = best;
        const gw = cols * size + (cols - 1) * gap;
        const left = (w - gw) / 2;
        const head = unit === 1 ? `${count} × H100 (80 GB each)` : `${count} × ${unit === 8 ? 'server of 8 H100s' : 'group of 64 H100s'}`;
        txt(ctx, head, w / 2, top - 13, { size: 12.5, weight: 650, align: 'center' });
        const cum = [0];
        for (const part of m.parts) cum.push(cum[cum.length - 1]! + part.bytes);
        for (let k = 0; k < count; k++) {
          const tx = left + (k % cols) * (size + gap);
          const ty = top + Math.floor(k / cols) * (size + gap);
          rbox(ctx, tx, ty, size, size, 4, color('--card'));
          const lo = k * cap;
          const hi = lo + cap;
          ctx.save();
          ctx.beginPath();
          ctx.roundRect(tx, ty, size, size, 4);
          ctx.clip();
          m.parts.forEach((part, j) => {
            const a = Math.max(cum[j]!, lo);
            const bb = Math.min(cum[j + 1]!, hi);
            if (bb <= a) return;
            ctx.fillStyle = partFill(part.key);
            ctx.fillRect(tx + ((a - lo) / cap) * size, ty, ((bb - a) / cap) * size + 0.3, size);
          });
          ctx.restore();
          rbox(ctx, tx, ty, size, size, 4, undefined, color('--axis'), 1);
        }
        const foot = unit === 1 ? 'each square is one 80 GB GPU, filled left to right' : unit === 8 ? 'each square is one server: 8 GPUs, 640 GB' : 'each square is 64 GPUs, 5.1 TB';
        txt(ctx, foot, w / 2, h - 10, { size: 11, align: 'center', color: color('--ink-3') });
      });
      const leg = legend(f);
      const psiRo = f.readout('parameters', { sym: 'Psi' });
      const stRo = f.readout('weights + optimizer');
      const actRo = f.readout('activations', { sym: 'X' });
      const gpuRo = f.readout('H100s');
      f.segmented({
        label: 'model',
        options: SHAPES.map((sh) => ({ value: sh.label, label: sh.label })),
        value: '6.7B',
        onChange: (v) => {
          shape = SHAPES.find((sh) => sh.label === v)!;
          sync();
        },
      });
      f.slider({ label: 'tokens s', min: 9, max: 15, step: 1, value: 11, map: (r) => 2 ** r, format: (v) => String(v), onInput: (v) => { s = v; sync(); } });
      f.slider({ label: 'sequences b', min: 0, max: 4, step: 1, value: 0, map: (r) => 2 ** r, format: (v) => String(v), onInput: (v) => { b = v; sync(); } });
      f.toggle({ label: 'activation checkpointing', value: false, onChange: (v) => { ckpt = v; sync(); } });
      function sync() {
        const m = trainMemory(shape.L, shape.d, s, b, ckpt);
        const gpus = Math.ceil(m.total / GPU.mem - 1e-9);
        const act = m.parts[5]!.bytes;
        f.code.setMany({ L: shape.L, d: shape.d, s, b, ck: ckpt ? 'True' : 'False', psi: countStr(m.psi), total: bytesStr(m.total), gpus });
        f.code.highlight(ckpt ? 'ck' : 'act');
        psiRo.set(countStr(m.psi));
        stRo.set(bytesStr(16 * m.psi));
        actRo.set(bytesStr(act));
        gpuRo.set(String(gpus));
        leg(m.parts.map((pt) => ({ fill: partFill(pt.key), label: PART_INFO[pt.key].label, note: PART_INFO[pt.key].per ? `${PART_INFO[pt.key].per} B/param` : bytesStr(pt.bytes) })));
        cv.redraw();
      }
      sync();
    },
    caption: `**Top:** where the bytes go, as shares of the total. **Below:** the same total poured into 80 GB GPUs. The default, a 6.7-billion-parameter GPT-style model reading one 2,048-token sequence, already needs two GPUs, and almost all of it is the 16 bytes per parameter of weights and optimizer state. Switch to **175B**: 2.8 TB of state, about 36 GPUs before a single activation. Now raise **tokens s** and **sequences b** for the small model and watch the orange activations take over; then turn on **checkpointing** and watch them shrink by more than ten times. The shapes are GPT-3's 1.3B, 6.7B and 175B and a LLaMA-65B-sized stack; activations follow Korthikanti et al. (2022), with the attention matrix recomputed rather than stored, as FlashAttention does.`,
  });
}

// ---------------------------------------------------------------- 2. checkpointing timeline

export function figCheckpoint(p: Page): void {
  const L = 8;
  const KS = [0, 1, 2, 4];
  const runs = new Map(KS.map((k) => [k, ckTimeline(L, k)]));
  const ALL = runs.get(0)!;
  const TMAX = 32;
  const MMAX = ALL.peak;
  p.figure({
    title: 'Store or recompute: activation memory across one training step',
    codeTitle: 'checkpoint.py',
    code: `
      from torch.utils.checkpoint import checkpoint

      def run(seg, x):
          for layer in seg:
              x = layer(x)   # saves what backward needs  #@f
          return x

      k = {{k:1}}                # layers per segment
      for i in range(0, 8, k):                         #@loop
          seg = layers[i:i + k]
          # {{note:keep only x; redo seg in backward}}
          x = {{call:checkpoint(run, seg, x, use_reentrant=False)}}  #@loop
      loss = head(x)
      loss.backward()  # redo each segment, backprop it  #@bwd
      # peak memory {{peak}}, compute {{cost}}
    `,
    setup(f) {
      let k = 1;
      let t = 0;
      const geo = { px0: 0, px1: 1, py0: 0, py1: 1 };
      const cv = f.canvas(640, 420, (ctx, w, h) => {
        const run = runs.get(k)!;
        const st = ckStateAt(run.events, t);
        const pad = 8;
        const cw = (w - 2 * pad) / L;
        const barTop = 34;
        const baseY = h * 0.48;
        const hb = baseY - barTop;
        const orange = color('orange');
        for (let i = 0; i < L; i++) {
          const x = pad + i * cw + cw * 0.17;
          const bw = cw * 0.66;
          rbox(ctx, x, barTop, bw, hb, 3, withAlpha(color('--ink-3'), 0.05), color('--grid'), 1);
          const held = st.held[i]!;
          if (held > 0.01) {
            const hh = (held / CK_A) * hb;
            ctx.fillStyle = withAlpha(orange, 0.55);
            ctx.fillRect(x, baseY - hh, bw, hh);
            ctx.fillStyle = withAlpha(orange, 1);
            ctx.fillRect(x, baseY - Math.min(hh, (CK_C / CK_A) * hb + 1), bw, Math.min(hh, (CK_C / CK_A) * hb + 1));
          }
          txt(ctx, `L${i + 1}`, x + bw / 2, baseY + 11, { size: 11, align: 'center', color: color('--ink-2'), mono: true });
        }
        if (st.ev) {
          const i = st.ev.layer;
          const cx = pad + i * cw + cw / 2;
          const kind = st.ev.kind;
          const col = kind === 'B' ? color('teal') : kind === 'R' ? color('gold') : color('orange');
          const lab = kind === 'F' ? 'forward' : kind === 'R' ? 'recompute' : 'backward';
          const dir = kind === 'B' ? -1 : 1;
          arrowLine(ctx, cx - dir * cw * 0.32, barTop - 9, cx + dir * cw * 0.32, barTop - 9, col, 2, 7);
          const lw = textW(ctx, lab, 12, false, 650);
          const lx = Math.max(pad + lw / 2, Math.min(w - pad - lw / 2, cx));
          txt(ctx, lab, lx, barTop - 24, { size: 12, weight: 650, align: 'center', color: col });
        }
        // memory over time
        const px0 = pad + 4;
        const px1 = w - pad;
        const py0 = baseY + 36;
        const py1 = h - 20;
        Object.assign(geo, { px0, px1, py0, py1 });
        const X = (tt: number) => px0 + (tt / TMAX) * (px1 - px0);
        const Y = (mm: number) => py1 - (mm / MMAX) * (py1 - py0);
        ctx.strokeStyle = color('--axis');
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px0, py0 - 4);
        ctx.lineTo(px0, py1);
        ctx.lineTo(px1, py1);
        ctx.stroke();
        txt(ctx, 'activation memory', px0 + 6, py0 - 8, { size: 11, color: color('--ink-3') });
        txt(ctx, 'time →', px1, py1 + 11, { size: 11, align: 'right', color: color('--ink-3') });
        const curve = (pts: [number, number][], col: string, lw: number, dash?: number[]) => {
          ctx.beginPath();
          pts.forEach(([a, m], j) => (j ? ctx.lineTo(X(a), Y(m)) : ctx.moveTo(X(a), Y(m))));
          ctx.strokeStyle = col;
          ctx.lineWidth = lw;
          ctx.setLineDash(dash ?? []);
          ctx.stroke();
          ctx.setLineDash([]);
        };
        if (k !== 0) curve(ckCurve(ALL.events), withAlpha(color('--ink-3'), 0.7), 1.3, [5, 4]);
        const pts = ckCurve(run.events);
        curve(pts, withAlpha(orange, 0.25), 2);
        ctx.save();
        ctx.beginPath();
        ctx.rect(px0, py0 - 10, X(t) - px0, py1 - py0 + 12);
        ctx.clip();
        curve(pts, orange, 2.4);
        ctx.restore();
        ctx.strokeStyle = withAlpha(color('--ink'), 0.5);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(X(t), py0 - 4);
        ctx.lineTo(X(t), py1);
        ctx.stroke();
        txt(ctx, `peak ${run.peak}`, X(run.cost) - 2, Y(run.peak) - 9, { size: 11, align: 'right', color: orange, weight: 650, halo: true });
        if (k !== 0) txt(ctx, `store all: ${ALL.peak}`, X(ALL.cost) + 4, Y(ALL.peak) + 2, { size: 11, align: 'left', color: color('--ink-3'), halo: true });
        ctx.strokeStyle = color('--grid');
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(X(L), py0);
        ctx.lineTo(X(L), py1);
        ctx.stroke();
        ctx.setLineDash([]);
        txt(ctx, 'forward', X(L / 2), py1 + 11, { size: 11, align: 'center', color: color('--ink-3') });
      });
      cv.canvas.classList.add('scroll-ok');
      const peakRo = f.readout('peak memory', { sym: 'X' });
      const costRo = f.readout('compute');
      const sync = () => {
        const run = runs.get(k)!;
        const st = ckStateAt(run.events, t);
        f.code.setMany({
          k: k === 0 ? 8 : k,
          call: k === 0 ? 'run(seg, x)' : 'checkpoint(run, seg, x, use_reentrant=False)',
          note: k === 0 ? 'one segment, no checkpoint: keep all' : 'keep only x; redo seg in backward',
          peak: `${run.peak} units`,
          cost: `${run.cost} units`,
        });
        const kind = st.ev?.kind;
        f.code.highlight(!kind ? null : kind === 'F' ? (k === 0 ? 'f' : ['loop', 'f']) : kind === 'R' ? ['bwd', 'f'] : 'bwd');
        peakRo.set(`${run.peak} (${pct(run.peak / ALL.peak)} of storing all)`);
        costRo.set(`${run.cost} (${(run.cost / ALL.cost).toFixed(2)}×)`);
        cv.redraw();
      };
      const loop = f.loop((dt) => {
        const run = runs.get(k)!;
        t = Math.min(run.cost, t + dt * 3.2);
        sync();
        if (t >= run.cost) {
          btn.textContent = 'Replay';
          return false;
        }
      });
      const btn = f.button('Pause', () => {
        if (loop.running()) {
          loop.stop();
          btn.textContent = 'Play';
        } else {
          if (t >= runs.get(k)!.cost) t = 0;
          loop.start();
          btn.textContent = 'Pause';
        }
      }, { primary: true });
      f.segmented({
        label: 'checkpoint',
        options: KS.map((v) => ({ value: String(v), label: v === 0 ? 'none' : v === 1 ? 'every layer' : `every ${v}` })),
        value: '1',
        onChange: (v) => {
          k = Number(v);
          t = 0;
          loop.start();
          btn.textContent = 'Pause';
          sync();
        },
      });
      let drag = false;
      const scrub = (e: PointerEvent) => {
        const r = cv.canvas.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        if (!drag && y < geo.py0 - 20) return false;
        t = Math.max(0, Math.min(runs.get(k)!.cost, ((x - geo.px0) / (geo.px1 - geo.px0)) * TMAX));
        loop.stop();
        btn.textContent = 'Play';
        sync();
        return true;
      };
      cv.canvas.addEventListener('pointerdown', (e) => {
        if (scrub(e)) drag = true;
      });
      cv.canvas.addEventListener('pointermove', (e) => drag && scrub(e));
      cv.canvas.addEventListener('pointerup', () => (drag = false));
      cv.canvas.addEventListener('pointercancel', () => (drag = false));
      loop.start();
      sync();
    },
    caption: `Eight layers, one training step. **Top:** what each layer is holding for the backward pass. A full bar is one layer's activations (about $34\\,s b d$ bytes); the dark sliver at its foot is the layer's input (about $2\\,s b d$), the only thing a checkpoint keeps. **Bottom:** total activation memory over time, in units of one input; the dashed line is "store all". With checkpointing, memory stays low during the forward pass, and the backward pass reruns each segment (gold) just before backpropagating through it (teal). Compare the options: **every layer** cuts the peak from 136 to 24 units for a third more compute, while **every 4** keeps fewer checkpoints but must rebuild four layers at once, so its peak is higher. Tap or drag the lower plot to scrub.`,
  });
}

// ---------------------------------------------------------------- 3. ring all-reduce

export function figRing(p: Page): void {
  p.figure({
    title: 'Ring all-reduce: reduce-scatter, then all-gather',
    codeTitle: 'ring_allreduce.py',
    code: `
      N = {{N:4}}                   # GPUs in the ring
      # grads[i]: GPU i's gradient, cut into N chunks  #@init
      for step in range(N - 1):     # reduce-scatter   #@rs
          for i in range(N):        # all at once
              c = (i - step) % N                       #@rs
              grads[(i + 1) % N][c] += grads[i][c]     #@rs
      # GPU i has the full sum of chunk (i + 1) % N    #@own
      for step in range(N - 1):     # all-gather       #@ag
          for i in range(N):
              c = (i + 1 - step) % N                   #@ag
              grads[(i + 1) % N][c] = grads[i][c]      #@ag
      # sent per GPU: 2 * (N - 1) / N * size           #@done
      #             = {{sent}}                         #@done
    `,
    setup(f) {
      let N = 4;
      let run = ringAllReduce(N);
      let cur = 0;
      let q = 1;
      const cv = f.canvas(640, 440, (ctx, w, h) => {
        const boxW = Math.min(150, w * 0.29);
        const cellW = (boxW - 10) / N;
        const cellH = Math.max(22, Math.min(42, h * 0.095));
        const boxH = cellH + 26;
        const cx = w / 2;
        const cy = h / 2;
        const Rx = w / 2 - boxW / 2 - 4;
        const Ry = h / 2 - boxH / 2 - 4;
        const pos = (i: number): [number, number] => {
          const a = -Math.PI / 2 + (2 * Math.PI * i) / N;
          return [cx + Rx * Math.cos(a), cy + Ry * Math.sin(a)];
        };
        // the ring
        ctx.strokeStyle = color('--grid');
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Rx, Ry, 0, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < N; i++) {
          const a = -Math.PI / 2 + (2 * Math.PI * (i + 0.5)) / N;
          const x = cx + Rx * Math.cos(a);
          const y = cy + Ry * Math.sin(a);
          const tx = -Rx * Math.sin(a);
          const ty = Ry * Math.cos(a);
          const n = Math.hypot(tx, ty);
          arrowLine(ctx, x - (tx / n) * 9, y - (ty / n) * 9, x + (tx / n) * 9, y + (ty / n) * 9, color('--ink-3'), 1.5, 8);
        }
        const inFlight = q < 1 && cur > 0;
        const state = run.states[inFlight ? cur - 1 : cur]!;
        const cellAt = (gpu: number, c: number): [number, number] => {
          const [bx, by] = pos(gpu);
          return [bx - boxW / 2 + 5 + c * cellW, by - boxH / 2 + 20];
        };
        const drawCell = (x: number, y: number, contrib: boolean[], scale = 1) => {
          const cw = cellW * scale;
          const ch = cellH * scale;
          const full = contrib.every(Boolean);
          rbox(ctx, x + 1, y, cw - 2, ch, 2, color('--paper'));
          contrib.forEach((on, j) => {
            if (!on) return;
            ctx.fillStyle = withAlpha(color(CLASS_COLORS[j]!), 0.88);
            ctx.fillRect(x + 1.5, y + (j * ch) / N + 0.5, cw - 3, ch / N - 1);
          });
          rbox(ctx, x + 1, y, cw - 2, ch, 2, undefined, full ? color('--ink') : color('--axis'), full ? 1.8 : 1);
        };
        for (let i = 0; i < N; i++) {
          const [bx, by] = pos(i);
          const gc = color(CLASS_COLORS[i]!);
          rbox(ctx, bx - boxW / 2, by - boxH / 2, boxW, boxH, 6, withAlpha(gc, 0.07), gc, 1.5);
          txt(ctx, `GPU ${i}`, bx - boxW / 2 + 6, by - boxH / 2 + 10, { size: 11, weight: 650, color: gc });
          for (let c = 0; c < N; c++) {
            const [x, y] = cellAt(i, c);
            drawCell(x, y, state[i]![c]!);
          }
        }
        if (inFlight) {
          const e = smooth(q);
          for (const sd of run.sends[cur - 1]!) {
            const [x0, y0] = cellAt(sd.from, sd.chunk);
            const [x1, y1] = cellAt(sd.to, sd.chunk);
            const mx = (x0 + x1) / 2;
            const my = (y0 + y1) / 2;
            const ox = mx - cx;
            const oy = my - cy;
            const on = Math.hypot(ox, oy) || 1;
            const kx = mx + (ox / on) * 28;
            const ky = my + (oy / on) * 28;
            const x = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * kx + e * e * x1;
            const y = (1 - e) * (1 - e) * y0 + 2 * (1 - e) * e * ky + e * e * y1;
            ctx.save();
            ctx.shadowColor = withAlpha(color('--ink'), 0.35);
            ctx.shadowBlur = 6;
            drawCell(x, y - 4 * Math.sin(e * Math.PI), state[sd.from]![sd.chunk]!, 1);
            ctx.restore();
          }
        }
      });
      cv.canvas.classList.add('scroll-ok');
      const pl = f.plot({
        height: 130,
        square: false,
        domain: [1, 17, -0.9, 8.6],
        draw: (pp) => {
          const c = pp.ctx;
          for (const v of [0, 2, 4, 6, 8]) {
            pp.path([1.6, 16.6], [v, v], color('--grid'), 1);
            pp.text(String(v), 1.15, v, { size: 10.5, mono: true, base: 'middle', color: color('--ink-3') });
          }
          for (const n of [2, 4, 8, 16]) pp.text(String(n), n, -0.55, { size: 10.5, mono: true, align: 'center', base: 'middle', color: color('--ink-3') });
          const ns = Array.from({ length: 15 }, (_, i) => i + 2);
          c.save();
          c.beginPath();
          c.rect(0, 0, pp.w, pp.h);
          c.clip();
          pp.path(ns, ns.map((n) => n - 1), withAlpha(color('red'), 0.8), 2);
          pp.path(ns, ns.map(ringFactor), color('green'), 2.5);
          c.restore();
          for (const n of ns) pp.dot(n, ringFactor(n), n === N ? 5 : 2.5, color('green'));
          pp.dot(N, N - 1, N === N ? 4 : 2, color('red'));
          pp.text('one GPU collects: N − 1', 2.1, 7.6, { size: 11, color: color('red'), base: 'middle' });
          pp.text('ring: 2(N − 1)/N, never above 2', 16.5, 2.9, { size: 11, color: color('green'), align: 'right', base: 'middle', bold: true });
        },
      });
      const phaseRo = f.readout('phase');
      const sentRo = f.readout('sent per GPU');
      const loop = f.loop((dt) => {
        q = Math.min(1, q + dt / 0.75);
        cv.redraw();
        if (q >= 1) return false;
      });
      const show = (k: number) => {
        const anim = k === cur + 1;
        cur = k;
        q = anim ? 0 : 1;
        if (anim) loop.start();
        const R = N - 1;
        phaseRo.set(k === 0 ? 'each GPU has its own gradient' : k <= R ? `reduce-scatter ${k} of ${R}` : `all-gather ${k - R} of ${R}`);
        sentRo.set(`${fmt(k / N, 3)} × size${k === 2 * R ? ' (done)' : ''}`);
        f.code.set('sent', `${fmt(ringFactor(N), 3)} × size`, false);
        f.code.set('N', N, false);
        f.code.highlight(k === 0 ? 'init' : k < R ? 'rs' : k === R ? ['rs', 'own'] : k < 2 * R ? 'ag' : ['ag', 'done']);
        cv.redraw();
        pl.redraw();
      };
      const stepper = f.stepper({
        steps: 2 * (N - 1) + 1,
        interval: 1300,
        label: (k) => (k === 0 ? 'start' : `step ${k} of ${2 * (N - 1)}`),
        onStep: show,
      });
      f.slider({
        label: 'GPUs N',
        sym: 'N',
        min: 2,
        max: 6,
        step: 1,
        value: 4,
        onInput: (v) => {
          N = v;
          run = ringAllReduce(N);
          cur = 0;
          q = 1;
          stepper.setSteps(2 * (N - 1) + 1);
          stepper.go(0);
        },
      });
    },
    caption: `Each box is a GPU; its gradient is cut into $\\symN$ chunks (the columns). A colored stripe in a chunk means that GPU's contribution has been added in, so a full rainbow column, outlined in black, is the finished sum for that chunk. Press **play** or step. In **reduce-scatter**, every GPU passes one chunk to its neighbor at the same moment, and the neighbor adds it to its own; after $\\symN - 1$ steps each GPU owns one complete chunk. **All-gather** then passes the finished chunks around the ring. Every step moves only $1/\\symN$ of the gradient per GPU, and every link is busy in parallel. **Below:** data each GPU sends, in units of the gradient's size: the ring never exceeds 2, while a single collecting GPU has to send $\\symN - 1$ times the gradient.`,
  });
}

// ---------------------------------------------------------------- 4. overlap

export function figOverlap(p: Page): void {
  const PSI = paramsOf(32, 4096);
  p.figure({
    title: 'Hiding the all-reduce behind the backward pass',
    codeTitle: 'ddp.py',
    code: `
      model = DDP(model, bucket_cap_mb=25)  # 6.7B params
      for x, y in loader:     # T = {{T:16K}} tokens per GPU   #@fwd
          loss = model(x, y)                           #@fwd
          loss.backward()  # {{note:each bucket's all-reduce}}   #@bwd
                           # {{note2:starts once its grads exist}}  #@bwd
          opt.step()
      # compute 6 * n_params * T / F = {{tc}}
      # all-reduce 2(N-1)/N * 2 n_params / bw = {{tm}}
      # waiting {{exp}}, efficiency {{eff}}
    `,
    setup(f) {
      let link: Link = LINKS[1]!;
      let T = 16384;
      let overlap = true;
      const cv = f.canvas(640, 230, (ctx, w, h) => {
        const r = ddpStep(PSI, T, link, overlap);
        const r0 = ddpStep(PSI, T, link, false);
        const tmax = r0.total * 1.03;
        const lx = 70;
        const X = (t: number) => lx + (t / tmax) * (w - lx - 8);
        const top = 14;
        const laneH = Math.min(40, (h - top - 50) / 2);
        const y1 = top;
        const y2 = top + laneH + 16;
        txt(ctx, 'GPU math', 4, y1 + laneH / 2, { size: 11.5, weight: 600, color: color('--ink-2') });
        txt(ctx, 'network', 4, y2 + laneH / 2, { size: 11.5, weight: 600, color: color('--ink-2') });
        rbox(ctx, X(r.fwd[0]), y1, X(r.fwd[1]) - X(r.fwd[0]) - 1, laneH, 3, withAlpha(color('orange'), 0.75));
        if (X(r.fwd[1]) - X(r.fwd[0]) > 58) txt(ctx, 'forward', (X(r.fwd[0]) + X(r.fwd[1])) / 2, y1 + laneH / 2, { size: 11, align: 'center', weight: 600 });
        r.bwd.forEach(([a, b]) => rbox(ctx, X(a), y1, Math.max(1, X(b) - X(a) - 1), laneH, 2, withAlpha(color('teal'), 0.75)));
        const bw0 = X(r.bwd[0]![0]);
        const bw1 = X(r.bwd[r.bwd.length - 1]![1]);
        if (bw1 - bw0 > 64) txt(ctx, 'backward', (bw0 + bw1) / 2, y1 + laneH / 2, { size: 11, align: 'center', weight: 600, halo: true });
        r.comm.forEach(([a, b]) => {
          rbox(ctx, X(a), y2, Math.max(1, X(b) - X(a) - 1), laneH, 2, withAlpha(color('green'), 0.7));
          if (b > r.compute) hatch(ctx, X(Math.max(a, r.compute)), y2, X(b) - X(Math.max(a, r.compute)) - 1, laneH, withAlpha(color('red'), 0.75), 5);
        });
        if (r.exposed > 0.001) {
          ctx.fillStyle = withAlpha(color('red'), 0.08);
          ctx.fillRect(X(r.compute), y1, X(r.total) - X(r.compute), laneH);
          hatch(ctx, X(r.compute), y1, X(r.total) - X(r.compute), laneH, withAlpha(color('red'), 0.45), 6);
        }
        const axisY = y2 + laneH + 12;
        ctx.strokeStyle = color('--axis');
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lx, axisY);
        ctx.lineTo(w - 8, axisY);
        ctx.stroke();
        const step = tmax > 6 ? 2 : tmax > 3 ? 1 : tmax > 1.2 ? 0.5 : tmax > 0.6 ? 0.2 : 0.1;
        for (let v = 0; v <= tmax; v += step) {
          ctx.beginPath();
          ctx.moveTo(X(v), axisY);
          ctx.lineTo(X(v), axisY + 4);
          ctx.stroke();
          txt(ctx, v === 0 ? '0' : `${fmt(v, 2)} s`, X(v), axisY + 13, { size: 10.5, mono: true, align: v === 0 ? 'left' : 'center', color: color('--ink-3') });
        }
        ctx.strokeStyle = withAlpha(color('--ink'), 0.55);
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(X(r.total), y1 - 6);
        ctx.lineTo(X(r.total), y2 + laneH + 4);
        ctx.stroke();
        ctx.setLineDash([]);
      });
      cv.canvas.classList.add('scroll-ok');
      const stepRo = f.readout('step time');
      const expRo = f.readout('waiting on network');
      const effRo = f.readout('efficiency');
      f.segmented({
        label: 'cluster',
        options: LINKS.map((l) => ({ value: l.key, label: l.label })),
        value: 'ib',
        onChange: (v) => {
          link = LINKS.find((l) => l.key === v)!;
          sync();
        },
      });
      f.slider({ label: 'tokens per GPU per step T', min: 10, max: 17, step: 1, value: 14, map: (r) => 2 ** r, format: tokStr, onInput: (v) => { T = v; sync(); } });
      f.toggle({ label: 'overlap with backward', value: true, onChange: (v) => { overlap = v; sync(); } });
      function sync() {
        const r = ddpStep(PSI, T, link, overlap);
        const tm = r.comm.reduce((a, [x, y]) => a + y - x, 0);
        f.code.setMany({
          T: tokStr(T),
          note: overlap ? "each bucket's all-reduce" : 'all-reduce every bucket',
          note2: overlap ? 'starts once its grads exist' : 'only after backward ends',
          tc: secs(r.compute),
          tm: secs(tm),
          exp: secs(r.exposed),
          eff: pct(r.compute / r.total),
        });
        f.code.highlight(r.exposed > 0.1 * r.compute ? 'bwd' : null);
        stepRo.set(secs(r.total));
        expRo.set(secs(r.exposed));
        effRo.set(pct(r.compute / r.total));
        cv.redraw();
      }
      sync();
    },
    caption: `One data-parallel step of a 6.7-billion-parameter model, drawn to scale, on H100s running at 40% of their peak. The backward pass produces gradients from the last layer to the first, in eight buckets (teal); each bucket's all-reduce (green) can start as soon as that bucket is done. Red hatching is time the GPUs spend waiting. On **InfiniBand** with 16K tokens per GPU, the network finishes moments after the math. Halve the **tokens per GPU** a few times: compute shrinks, communication does not, and the wait grows. Switch to **Ethernet**, then turn **overlap** off to see what a naive implementation would cost.`,
  });
}

// ---------------------------------------------------------------- 5. ZeRO

export function figZero(p: Page): void {
  const MODELS = [
    { label: '7.5B', psi: 7.5e9 },
    { label: '65B', psi: 65e9 },
    { label: '175B', psi: 175e9 },
  ];
  p.figure({
    title: 'ZeRO: each GPU keeps 1/N of what used to be copied',
    codeTitle: 'zero_memory.py',
    code: `
      def zero_memory(n_params, N, stage):
          w   = 2 * n_params    # bf16 weights
          g   = 2 * n_params    # bf16 gradients
          opt = 12 * n_params   # fp32 master, Adam m, v
          if stage >= 1: opt /= N   # shard optimizer  #@s1
          if stage >= 2: g /= N     # shard gradients  #@s2
          if stage >= 3: w /= N     # shard weights    #@s3
          return w + g + opt

      zero_memory({{psi:7.5e9}}, N={{N:8}}, stage={{stage:1}})
      # = {{gb}} per GPU
    `,
    setup(f) {
      let psi = 7.5e9;
      let N = 8;
      let stage = 1;
      const cv = f.canvas(640, 330, (ctx, w, h) => {
        const cols: (number | null)[] = N <= 8 ? Array.from({ length: N }, (_, i) => i) : [0, 1, 2, 3, 4, 5, null, N - 1];
        const top = 22;
        const base = h - 8;
        const H = base - top;
        const heldW = Math.min(64, w * 0.15);
        const heldX = w - heldW - 4;
        const mapR = heldX - 44;
        const gap = Math.min(12, w * 0.02);
        const nc = cols.length;
        const cw = Math.min(56, (mapR - 40 - gap * (nc - 1)) / nc);
        const left = 40 + (mapR - 40 - (nc * cw + (nc - 1) * gap)) / 2;
        const bands = [
          { frac: 2 / 16, sharded: stage >= 3, k: 'blue' as const },
          { frac: 2 / 16, sharded: stage >= 2, k: 'teal' as const },
          { frac: 12 / 16, sharded: stage >= 1, k: 'gold' as const },
        ];
        txt(ctx, bytesStr(16 * psi), 2, top, { size: 10.5, mono: true, color: color('--ink-3') });
        txt(ctx, '0', 2, base - 4, { size: 10.5, mono: true, color: color('--ink-3') });
        cols.forEach((g, c) => {
          const x = left + c * (cw + gap);
          if (g === null) {
            txt(ctx, '…', x + cw / 2, top + H / 2, { size: 18, align: 'center', color: color('--ink-3') });
            return;
          }
          txt(ctx, cw >= 46 ? `GPU ${g}` : String(g), x + cw / 2, top - 11, { size: 11, align: 'center', color: color('--ink-2'), weight: 600 });
          let yb = base;
          for (const bd of bands) {
            const bh = bd.frac * H;
            const y0 = yb - bh;
            const col = color(bd.k);
            if (!bd.sharded) {
              ctx.fillStyle = withAlpha(col, 0.78);
              ctx.fillRect(x, y0, cw, bh);
            } else {
              ctx.fillStyle = withAlpha(col, 0.08);
              ctx.fillRect(x, y0, cw, bh);
              ctx.save();
              ctx.setLineDash([3, 3]);
              ctx.strokeStyle = withAlpha(col, 0.6);
              ctx.strokeRect(x + 0.5, y0 + 0.5, cw - 1, bh - 1);
              ctx.restore();
              ctx.fillStyle = withAlpha(col, 0.95);
              ctx.fillRect(x, yb - ((g + 1) / N) * bh, cw, Math.max(1.5, bh / N));
            }
            ctx.strokeStyle = color('--card');
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y0);
            ctx.lineTo(x + cw, y0);
            ctx.stroke();
            yb = y0;
          }
        });
        // what one GPU actually holds, on the same scale
        ctx.strokeStyle = color('--rule');
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(heldX - 36, top - 18);
        ctx.lineTo(heldX - 36, base);
        ctx.stroke();
        const z = zeroMem(psi, N, stage);
        txt(ctx, 'holds', heldX + heldW / 2, top - 11, { size: 11, align: 'center', color: color('--ink'), weight: 700 });
        let yb = base;
        for (const [v, k] of [[z.w, 'blue'], [z.g, 'teal'], [z.opt, 'gold']] as const) {
          const bh = (v / (16 * psi)) * H;
          ctx.fillStyle = withAlpha(color(k), 0.85);
          ctx.fillRect(heldX, yb - bh, heldW, bh);
          yb -= bh;
        }
        txt(ctx, bytesStr(z.total), heldX + heldW / 2, Math.max(top + 7, yb - 9), { size: 11, align: 'center', mono: true, weight: 650, halo: true });
        const yMem = base - (GPU.mem / (16 * psi)) * H;
        if (yMem > top) {
          ctx.strokeStyle = color('red');
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 3]);
          ctx.beginPath();
          ctx.moveTo(heldX - 4, yMem);
          ctx.lineTo(heldX + heldW + 3, yMem);
          ctx.stroke();
          ctx.setLineDash([]);
          txt(ctx, '80 GB', heldX - 6, yMem, { size: 10.5, align: 'right', color: color('red'), weight: 650, halo: true });
        }
      });
      const leg = legend(f);
      leg([
        { fill: withAlpha(color('blue'), 0.78), label: 'weights', note: '2Ψ' },
        { fill: withAlpha(color('teal'), 0.78), label: 'gradients', note: '2Ψ' },
        { fill: withAlpha(color('gold'), 0.78), label: 'optimizer states', note: '12Ψ' },
      ]);
      const memRo = f.readout('per GPU');
      const fitRo = f.readout('fits in 80 GB');
      const comRo = f.readout('traffic vs DDP');
      f.segmented({
        label: 'stage',
        options: ZERO_STAGES.map((sname, i) => ({ value: String(i), label: sname })),
        value: '1',
        onChange: (v) => {
          stage = Number(v);
          sync();
        },
      });
      f.slider({ label: 'GPUs N', sym: 'N', min: 0, max: 10, step: 1, value: 3, map: (r) => 2 ** r, format: (v) => String(v), onInput: (v) => { N = v; sync(); } });
      f.segmented({
        label: 'model',
        options: MODELS.map((m) => ({ value: m.label, label: m.label })),
        value: '7.5B',
        onChange: (v) => {
          psi = MODELS.find((m) => m.label === v)!.psi;
          sync();
        },
      });
      function sync() {
        const z = zeroMem(psi, N, stage);
        f.code.setMany({ psi: `${psi / 1e9}e9`, N, stage, gb: bytesStr(z.total) });
        f.code.highlight(stage === 0 ? null : ['s1', 's2', 's3'].slice(0, stage));
        memRo.set(bytesStr(z.total));
        fitRo.set(z.total <= GPU.mem ? 'yes' : 'no');
        comRo.set(`${zeroComm(stage)}×`);
        cv.redraw();
      }
      sync();
    },
    caption: `Each numbered column is one GPU's memory for weights, gradients and optimizer state, scaled to the 16 bytes per parameter of plain data parallelism. Dashed boxes are sharded: the GPU keeps only its own slice (the solid strip, a different slice on every GPU) and receives the rest when it needs them. The default is the ZeRO paper's example: 7.5 billion parameters on 8 GPUs. Step through the **stages**: ZeRO-1 alone takes it from 120 GB to 41 GB per GPU. Slide **N** to 64: ZeRO-3 needs 1.9 GB per GPU. Pick **175B** and find the smallest N that fits each stage under the red 80 GB line. Activations are not in these columns: every GPU still holds those for its own share of the batch.`,
  });
}

// ---------------------------------------------------------------- 6. tensor parallelism

export function figTensor(p: Page): void {
  const T = tpToy();
  const STEPS = [
    { line: 'ref', text: '**One GPU:** `X` times `W1`, GeLU, then times `W2`. Two tokens in, two tokens out.' },
    { line: 'col', text: '**Split `W1` by columns.** GPU 0 keeps the first four columns, GPU 1 the last four; both have all of `X`.' },
    { line: 'gelu', text: '**Each GPU computes its half of the hidden layer.** GeLU acts on each entry alone, so neither GPU needs the other half: no communication.' },
    { line: ['row', 'part'], text: '**Split `W2` by rows**, matching the halves. Each GPU multiplies its half of the hidden layer by its rows: a partial sum of the output.' },
    { line: 'ar', text: '**All-reduce:** add the two partial sums. The result equals the one-GPU answer, up to rounding. One all-reduce for the whole MLP.' },
    { line: 'bad', text: '**The other order fails.** Split `W1` by rows (and `X` by columns): each GPU now holds a partial *sum*, and GeLU of a partial sum is not a piece of GeLU of the total.' },
  ];
  p.figure({
    title: 'Tensor parallelism: an MLP split across two GPUs',
    codeTitle: 'tensor_parallel_mlp.py',
    code: `
      X  = rng.normal(size=(2, 4))  # 2 tokens, d = 4
      W1 = rng.normal(size=(4, 8))  # d -> 4d
      W2 = rng.normal(size=(8, 4))  # 4d -> d
      Z_ref = gelu(X @ W1) @ W2     # on one GPU       #@ref

      W1_0, W1_1 = W1[:, :4], W1[:, 4:]  # by columns  #@col
      Y_0 = gelu(X @ W1_0)          # on GPU 0         #@gelu
      Y_1 = gelu(X @ W1_1)          # on GPU 1         #@gelu
      W2_0, W2_1 = W2[:4], W2[4:]   # by rows          #@row
      Z_0 = Y_0 @ W2_0              # partial sums     #@part
      Z_1 = Y_1 @ W2_1                                 #@part
      Z = Z_0 + Z_1                 # the all-reduce   #@ar
      np.abs(Z - Z_ref).max()       # {{err}}          #@ar

      # wrong: split W1 by rows, GeLU before the sum   #@bad
      h0, h1 = slice(0, 2), slice(2, 4)                #@bad
      Z_bad = (gelu(X[:, h0] @ W1[h0]) @ W2            #@bad
               + gelu(X[:, h1] @ W1[h1]) @ W2)         #@bad
      np.abs(Z_bad - Z_ref).max()   # {{bad}}          #@bad
    `,
    setup(f) {
      let step = 0;
      const mx = (Ms: number[][][]) => Math.max(...Ms.flatMap((M) => M.flat().map(Math.abs)));
      const mX = mx([T.X]);
      const mW = mx([T.W1, T.W2]);
      const mY = mx([T.Y]);
      const mZ = mx([T.Zref, T.Z, ...T.Zs, T.Zwrong]);
      const mP = mx(T.partial.map((P) => P.map((r) => r.map((v) => v))));
      const cv = f.canvas(640, 460, (ctx, w, h) => {
        const gpuCol = [color('blue'), color('purple')];
        const op = (s: string, x: number, y: number) => txt(ctx, s, x, y, { size: 13, align: 'center', color: color('--ink-3'), weight: 600 });
        const title = (s: string, x: number, y: number, col = color('--ink-2')) => txt(ctx, s, x, y, { size: 11.5, align: 'center', color: col, weight: 650, mono: true });
        type Item = { M: number[][]; k: 'orange' | 'blue' | 'purple' | 'teal'; name: string; max: number; outline?: string; dim?: boolean } | string;
        const widthOf = (items: Item[], cs: number, g: number) => items.reduce((a, it) => a + (typeof it === 'string' ? g : it.M[0]!.length * cs), 0);
        const row = (items: Item[], x0: number, y: number, cs: number, g: number, rowsH: number) => {
          let x = x0;
          for (const it of items) {
            if (typeof it === 'string') {
              op(it, x + g / 2, y + rowsH / 2);
              x += g;
              continue;
            }
            const mh = it.M.length * cs;
            const my = y + (rowsH - mh) / 2;
            title(it.name, x + (it.M[0]!.length * cs) / 2, my - 9);
            heat(ctx, x, my, cs, it.M, it.k, { max: it.max, outline: it.outline, dim: it.dim });
            x += it.M[0]!.length * cs;
          }
        };
        const lane = (label: string, col: string, y: number, hh: number) => {
          rbox(ctx, 2, y, w - 4, hh, 8, withAlpha(col, 0.05), withAlpha(col, 0.5), 1);
          txt(ctx, label, 10, y + 11, { size: 11, weight: 700, color: col });
        };
        if (step === 0) {
          const items: Item[] = [
            { M: T.X, k: 'orange', name: 'X', max: mX },
            '·',
            { M: T.W1, k: 'blue', name: 'W1', max: mW },
            '→',
            { M: T.Y, k: 'teal', name: 'GeLU', max: mY },
            '·',
            { M: T.W2, k: 'blue', name: 'W2', max: mW },
            '=',
            { M: T.Zref, k: 'purple', name: 'Z', max: mZ },
          ];
          const g = 18;
          const cs = Math.min(22, (w - 16 - 4 * g) / 28);
          const x0 = (w - widthOf(items, cs, g)) / 2;
          const y0 = Math.max(6, (h - (8 * cs + 44)) / 2);
          lane('one GPU', color('--ink-3'), y0, 8 * cs + 44);
          row(items, x0, y0 + 24, cs, g, 8 * cs);
          return;
        }
        const g = Math.min(20, w * 0.04);
        if (step < 5) {
          const lanes = [0, 1].map((i) => {
            const items: Item[] = [{ M: T.X, k: 'orange', name: 'X', max: mX }, '·', { M: T.W1s[i]!, k: 'blue', name: `W1_${i}`, max: mW, outline: gpuCol[i] }];
            if (step >= 2) items.push('→', { M: T.Ys[i]!, k: 'teal', name: `Y_${i}`, max: mY });
            if (step >= 3) items.push('·', { M: T.W2s[i]!, k: 'blue', name: `W2_${i}`, max: mW, outline: gpuCol[i] }, '=', { M: T.Zs[i]!, k: 'purple', name: `Z_${i}`, max: mZ });
            return items;
          });
          const full: Item[] = [{ M: T.X, k: 'orange', name: 'X', max: mX }, '·', { M: T.W1s[0]!, k: 'blue', name: '', max: mW }, '→', { M: T.Ys[0]!, k: 'teal', name: '', max: mY }, '·', { M: T.W2s[0]!, k: 'blue', name: '', max: mW }, '=', { M: T.Zs[0]!, k: 'purple', name: '', max: mZ }];
          const cs = Math.min(22, (w - 20 - 4 * g) / (widthOf(full, 1, 0) + 0.5), (h - 150) / 10.6);
          const x0 = (w - widthOf(full, cs, g)) / 2;
          const laneH = 4 * cs + 40;
          lanes.forEach((items, i) => {
            const y = 6 + i * (laneH + 8);
            lane(`GPU ${i}`, gpuCol[i]!, y, laneH);
            row(items, x0, y + 26, cs, g, 4 * cs);
          });
          if (step === 4) {
            const y = 6 + 2 * (laneH + 8) + 6;
            const sum: Item[] = [
              { M: T.Zs[0]!, k: 'purple', name: 'Z_0', max: mZ },
              '+',
              { M: T.Zs[1]!, k: 'purple', name: 'Z_1', max: mZ },
              '=',
              { M: T.Z, k: 'purple', name: 'Z', max: mZ, outline: color('--ink') },
              '≡',
              { M: T.Zref, k: 'purple', name: 'Z_ref', max: mZ },
            ];
            const cs2 = Math.min(cs * 1.3, (w - 16 - 3 * g) / 16.5);
            row(sum, (w - widthOf(sum, cs2, g)) / 2, y + 16, cs2, g, 2 * cs2);
            txt(ctx, `max |Z − Z_ref| = ${T.err.toExponential(0)}`, w / 2, y + 16 + 2 * cs2 + 16, { size: 12, align: 'center', mono: true, color: color('green'), weight: 650 });
          }
          return;
        }
        // the wrong split
        const items = (i: number): Item[] => [{ M: T.Xr[i]!, k: 'orange', name: `X[:, ${i ? '2:' : ':2'}]`, max: mX }, '·', { M: T.W1r[i]!, k: 'blue', name: `W1[${i ? '2:' : ':2'}]`, max: mW, outline: gpuCol[i] }, '→', { M: T.partial[i]!.map((r) => r.map((v) => v)), k: 'teal', name: 'GeLU(part)', max: mP, dim: true }];
        const cs = Math.min(22, (w - 20 - 2 * g) / 19);
        const laneH = 2 * cs + 46;
        [0, 1].forEach((i) => {
          const y = 6 + i * (laneH + 8);
          lane(`GPU ${i}`, gpuCol[i]!, y, laneH);
          const it = items(i);
          row(it, (w - widthOf(it, cs, g)) / 2, y + 30, cs, g, 2 * cs);
        });
        const y = 6 + 2 * (laneH + 8) + 8;
        const cmp: Item[] = [{ M: T.Zwrong, k: 'purple', name: 'Z_bad', max: mZ, outline: color('red') }, '≠', { M: T.Zref, k: 'purple', name: 'Z_ref', max: mZ }];
        const cs2 = Math.min(26, (w - 40) / 10);
        row(cmp, (w - widthOf(cmp, cs2, 30)) / 2, y + 18, cs2, 30, 2 * cs2);
        txt(ctx, `max |Z_bad − Z_ref| = ${T.errWrong.toFixed(2)}`, w / 2, y + 18 + 2 * cs2 + 16, { size: 12, align: 'center', mono: true, color: color('red'), weight: 650 });
        txt(ctx, 'fix: all-reduce before GeLU, a second sync', w / 2, y + 18 + 2 * cs2 + 34, { size: 11, align: 'center', color: color('--ink-3') });
      });
      f.status(STEPS[0]!.text);
      f.code.setMany({ err: T.err.toExponential(0), bad: T.errWrong.toFixed(2) });
      f.stepper({
        steps: STEPS.length,
        interval: 2600,
        label: (k) => `step ${k + 1} / ${STEPS.length}`,
        onStep: (k) => {
          step = k;
          f.status(STEPS[k]!.text);
          f.code.highlight(STEPS[k]!.line);
          cv.redraw();
        },
      });
    },
    caption: `A two-token MLP with $d = 4$ and hidden width 8. Each square is one number: stronger color is a larger magnitude, gray is negative. Step through it. This is the split Megatron-LM uses: **columns** of the first matrix, then the matching **rows** of the second, so the GeLU in between runs on each GPU without any exchange, and one all-reduce at the end restores the exact output. The last step shows why the order matters: split the first matrix by rows instead and the GeLU lands on partial sums, which is simply wrong unless you pay for an extra all-reduce first.`,
  });
}

// ---------------------------------------------------------------- 7. pipeline schedule

export function figPipeline(p: Page): void {
  p.figure({
    title: 'Pipeline schedules and the bubble',
    layout: 'stack',
    codeTitle: 'pipeline_schedule.py',
    code: `
      def gpipe(i, p, m):                   # the order stage i runs
          return ([("F", j) for j in range(m)] +             #@gf
                  [("B", j) for j in reversed(range(m))])    #@gb

      def one_f_one_b(i, p, m):
          warm = min(p - i - 1, m)
          ops = [("F", j) for j in range(warm)]              #@warm
          for j in range(m - warm):                          #@steady
              ops += [("F", warm + j), ("B", j)]             #@steady
          ops += [("B", j) for j in range(m - warm, m)]      #@cool
          return ops

      p, m = {{p:4}}, {{m:8}}                 # stages, micro-batches
      bubble = (p - 1) / (m + p - 1)        # {{bubble}}
      # stage i starts F(j) once stage i-1 has sent it, and B(j)
      # once stage i+1 has sent back the gradient
    `,
    setup(f) {
      let P = 4;
      let M = 8;
      let kind: PipeKind = '1f1b';
      let run = pipeSchedule(P, M, kind);
      let tc = 0;
      const pl = f.plot({
        height: 270,
        square: false,
        draw: (pp) => {
          const ctx = pp.ctx;
          const w = pp.w;
          const h = pp.h;
          const lx = 46;
          const top = 6;
          const bottom = 22;
          const rh = (h - top - bottom) / P;
          const X = (t: number) => lx + (t / run.total) * (w - lx - 6);
          const cut = X(Math.min(tc, run.total));
          for (let i = 0; i < P; i++) {
            const y = top + i * rh;
            txt(ctx, `GPU ${i}`, 2, y + rh / 2, { size: 11, weight: 600, color: color('--ink-2') });
            ctx.fillStyle = withAlpha(color('red'), 0.06);
            ctx.fillRect(lx, y + 1, cut - lx, rh - 2);
            hatch(ctx, lx, y + 1, cut - lx, rh - 2, withAlpha(color('red'), 0.35), 6);
          }
          for (const o of run.ops) {
            if (o.t0 >= tc) continue;
            const x0 = X(o.t0);
            const x1 = Math.min(X(o.t1), cut);
            const y = top + o.stage * rh;
            const col = o.kind === 'F' ? color('orange') : color('teal');
            ctx.fillStyle = color('--paper');
            ctx.fillRect(x0 + 0.5, y + 1.5, x1 - x0 - 1, rh - 3);
            ctx.fillStyle = withAlpha(col, o.kind === 'F' ? 0.55 : 0.8);
            ctx.fillRect(x0 + 0.5, y + 1.5, x1 - x0 - 1, rh - 3);
            const full = X(o.t1) - x0;
            if (x1 >= X(o.t1) - 0.5 && full >= 19 && rh >= 14) txt(ctx, String(o.mb), x0 + full / 2, y + rh / 2 + 0.5, { size: Math.min(11, rh * 0.5), mono: true, align: 'center', weight: 600 });
          }
          if (tc < run.total) {
            ctx.strokeStyle = color('--ink');
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(cut, top);
            ctx.lineTo(cut, h - bottom);
            ctx.stroke();
          }
          const yA = h - bottom + 12;
          txt(ctx, 'time →', w - 4, yA, { size: 11, align: 'right', color: color('--ink-3') });
          let lxp = lx;
          for (const [lab, fill] of [['forward', withAlpha(color('orange'), 0.55)], ['backward (2× longer)', withAlpha(color('teal'), 0.8)], ['idle: the bubble', withAlpha(color('red'), 0.3)]] as const) {
            ctx.fillStyle = fill;
            ctx.fillRect(lxp, yA - 5, 10, 10);
            txt(ctx, lab, lxp + 14, yA, { size: 11, color: color('--ink-2') });
            lxp += 14 + textW(ctx, lab, 11) + 12;
            if (lxp > w - 120) break;
          }
        },
      });
      pl.canvas.classList.add('scroll-ok');
      const bRo = f.readout('bubble (p−1)/(m+p−1)');
      const iRo = f.readout('idle, measured');
      const sRo = f.readout('micro-batches held, most');
      const loop = f.loop((dt) => {
        tc = Math.min(run.total, tc + dt * Math.max(8, run.total / 5));
        const live = run.ops.filter((o) => o.stage === 0 && o.t0 <= tc).pop();
        if (live) f.code.highlight(kind === 'gpipe' ? (live.kind === 'F' ? 'gf' : 'gb') : live.phase);
        pl.redraw();
        if (tc >= run.total) {
          f.code.highlight(null);
          btn.textContent = 'Replay';
          return false;
        }
      });
      const btn = f.button('Play', () => {
        tc = 0;
        btn.textContent = 'Playing';
        loop.start();
      }, { primary: true });
      const sync = (replay: boolean) => {
        run = pipeSchedule(P, M, kind);
        f.code.setMany({ p: P, m: M, bubble: fmt(bubbleFraction(P, M), 3) });
        bRo.set(pct(bubbleFraction(P, M), 1));
        iRo.set(pct(run.idle, 1));
        sRo.set(`${Math.max(...run.peakStash)} (GPU 0)`);
        if (replay) {
          tc = 0;
          btn.textContent = 'Playing';
          loop.start();
        } else {
          tc = run.total;
          loop.stop();
          btn.textContent = 'Replay';
          f.code.highlight(null);
        }
        pl.redraw();
      };
      f.segmented({
        label: 'schedule',
        options: [
          { value: 'gpipe', label: 'GPipe' },
          { value: '1f1b', label: '1F1B' },
        ],
        value: '1f1b',
        onChange: (v) => {
          kind = v as PipeKind;
          sync(true);
        },
      });
      f.slider({ label: 'stages p', sym: 'p', min: 2, max: 8, step: 1, value: 4, onInput: (v) => { P = v; sync(false); } });
      f.slider({ label: 'micro-batches m', sym: 'm', min: 1, max: 32, step: 1, value: 8, onInput: (v) => { M = v; sync(false); } });
      sync(true);
    },
    caption: `Each row is a GPU holding one stage, a quarter of the layers by default; numbers are micro-batches. Orange is a forward pass, teal a backward pass (about twice as long). A micro-batch flows down the stages forward, then back up in reverse, so the first and last GPUs wait at the start and the end of every step: the red **bubble**. Set **m = 1** to see the naive case, three quarters idle with 4 stages; then slide **m** up and watch the bubble shrink as $(\\symp - 1)/(\\symm + \\symp - 1)$, with the measured idle time matching the formula exactly. Switch between **GPipe** and **1F1B**: the bubble is identical, but 1F1B starts each backward pass early, so GPU 0 never holds more than $\\symp$ micro-batches' activations instead of all $\\symm$.`,
  });
}

// ---------------------------------------------------------------- 8. 3-D parallelism

export function fig3d(p: Page): void {
  const TOTAL = 32;
  p.figure({
    title: 'Three ways at once: 32 GPUs in four servers',
    codeTitle: 'rank_layout.py',
    code: `
      TP, PP = {{TP:4}}, {{PP:2}}      # tensor, pipeline
      DP = 32 // (TP * PP)         # data-parallel: {{DP}}

      def coords(rank):            # Megatron's order
          tp = rank % TP           # fastest     #@tp
          dp = (rank // TP) % DP                 #@dp
          pp = rank // (TP * DP)   # slowest     #@pp
          return dp, pp, tp

      coords({{rank:13}})              # -> ({{c}})
      # TP group: same dp, pp: every layer
      # pipeline: same dp, tp: the next stage
      # DP group: same pp, tp: once per step
    `,
    setup(f) {
      let TP = 4;
      let PP = 2;
      let sel = 13;
      let mode: 'tp' | 'pp' | 'dp' = 'tp';
      const geo: { x: number; y: number; s: number }[] = [];
      const cv = f.canvas(640, 380, (ctx, w, h) => {
        const DP = TOTAL / (TP * PP);
        const wide = w >= 520;
        const nodeCols = wide ? 4 : 2;
        const gpuCols = 4;
        const pad = 8;
        const ngap = wide ? 10 : 8;
        const nodeW = (w - 2 * pad - (nodeCols - 1) * ngap) / nodeCols;
        const nodeRows = 4 / nodeCols;
        const nodeH = (h - 2 * pad - (nodeRows - 1) * ngap) / nodeRows;
        const s = Math.min((nodeW - 16 - 3 * 6) / gpuCols, (nodeH - 28 - 6) / 2, 52);
        const me = coords3d(sel, TP, DP);
        geo.length = 0;
        for (let n = 0; n < 4; n++) {
          const nx = pad + (n % nodeCols) * (nodeW + ngap);
          const ny = pad + Math.floor(n / nodeCols) * (nodeH + ngap);
          rbox(ctx, nx, ny, nodeW, nodeH, 8, withAlpha(color('--ink-3'), 0.05), color('--rule'), 1);
          txt(ctx, `server ${n}`, nx + 8, ny + 12, { size: 11, color: color('--ink-3'), weight: 600 });
          const gx0 = nx + (nodeW - (gpuCols * s + 3 * 6)) / 2;
          const gy0 = ny + 22 + (nodeH - 22 - (2 * s + 6)) / 2;
          for (let j = 0; j < 8; j++) {
            const r = n * 8 + j;
            const c = coords3d(r, TP, DP);
            const x = gx0 + (j % gpuCols) * (s + 6);
            const y = gy0 + Math.floor(j / gpuCols) * (s + 6);
            geo[r] = { x, y, s };
            const idx = mode === 'tp' ? c.tp : mode === 'pp' ? c.pp : c.dp;
            const col = color(CLASS_COLORS[idx % CLASS_COLORS.length]!);
            const tpPeer = c.dp === me.dp && c.pp === me.pp;
            const ppPeer = c.dp === me.dp && c.tp === me.tp;
            const dpPeer = c.pp === me.pp && c.tp === me.tp;
            rbox(ctx, x, y, s, s, 5, withAlpha(col, 0.22), withAlpha(col, 0.9), 1.2);
            txt(ctx, `${mode === 'tp' ? 't' : mode === 'pp' ? 'p' : 'd'}${idx}`, x + s / 2, y + s / 2 + 0.5, { size: Math.max(11, Math.min(13, s * 0.32)), mono: true, align: 'center', weight: 650, color: color('--ink') });
            if (r === sel) rbox(ctx, x - 4, y - 4, s + 8, s + 8, 7, undefined, color('--ink'), 2.5);
            else if (tpPeer) rbox(ctx, x - 3, y - 3, s + 6, s + 6, 6, undefined, color('blue'), 2);
            else if (ppPeer) rbox(ctx, x - 3, y - 3, s + 6, s + 6, 6, undefined, color('purple'), 2);
            else if (dpPeer) {
              ctx.save();
              ctx.setLineDash([4, 3]);
              rbox(ctx, x - 3, y - 3, s + 6, s + 6, 6, undefined, color('green'), 2);
              ctx.restore();
            }
          }
        }
      });
      cv.canvas.classList.add('scroll-ok');
      const leg = legend(f);
      leg([
        { fill: color('blue'), label: 'same tensor group: every layer, NVLink' },
        { fill: color('purple'), label: 'same pipeline: neighbors pass activations' },
        { fill: color('green'), label: 'same data group: gradients once per step' },
      ]);
      const dpRo = f.readout('data-parallel DP', { sym: 'N' });
      const inRo = f.readout('GPUs per model copy');
      cv.canvas.addEventListener('click', (e) => {
        const r = cv.canvas.getBoundingClientRect();
        const x = e.clientX - r.left;
        const y = e.clientY - r.top;
        let best = -1;
        let bd = Infinity;
        geo.forEach((g, i) => {
          const d = Math.hypot(x - (g.x + g.s / 2), y - (g.y + g.s / 2));
          if (d < bd) {
            bd = d;
            best = i;
          }
        });
        if (best >= 0 && bd < 60) {
          sel = best;
          sync();
        }
      });
      f.segmented({ label: 'tensor TP', options: [1, 2, 4, 8].map((v) => ({ value: String(v), label: String(v) })), value: '4', onChange: (v) => { TP = Number(v); sync(); } });
      f.segmented({ label: 'pipeline PP', options: [1, 2, 4].map((v) => ({ value: String(v), label: String(v) })), value: '2', onChange: (v) => { PP = Number(v); sync(); } });
      f.segmented({
        label: 'color by',
        options: [
          { value: 'tp', label: 'tensor slice' },
          { value: 'pp', label: 'stage' },
          { value: 'dp', label: 'replica' },
        ],
        value: 'tp',
        onChange: (v) => {
          mode = v as typeof mode;
          cv.redraw();
        },
      });
      function sync() {
        const DP = TOTAL / (TP * PP);
        const c = coords3d(sel, TP, DP);
        f.code.setMany({ TP, PP, DP, rank: sel, c: `${c.dp}, ${c.pp}, ${c.tp}` });
        f.code.highlight(['tp', 'dp', 'pp']);
        dpRo.set(String(DP));
        inRo.set(String(TP * PP));
        const nb = [c.pp - 1, c.pp + 1].filter((v) => v >= 0 && v < PP);
        f.status(`**GPU ${sel}**: replica ${c.dp}, stage ${c.pp}, tensor slice ${c.tp}. It all-reduces with ${TP - 1} tensor peer${TP === 2 ? '' : 's'} in every layer, trades activations with ${nb.length ? `stage ${nb.join(' and ')}` : 'nobody (one stage)'}, and averages gradients with ${DP - 1} data-parallel peer${DP === 2 ? '' : 's'} once per step.`);
        cv.redraw();
      }
      sync();
    },
    caption: `Four servers of eight GPUs. Pick the **tensor** and **pipeline** sizes; data parallelism takes whatever is left, $32 / (\\text{TP} \\cdot \\text{PP})$. **Tap a GPU** to see its partners: blue rings share its layers' matrices, purple rings hold its other pipeline stages, dashed green rings are its data-parallel copies. Megatron numbers ranks with the tensor index fastest, so tensor groups always fall inside one server, on NVLink, as long as TP is at most 8. Try TP 8 and PP 4: data parallelism disappears and each server holds one stage.`,
  });
}

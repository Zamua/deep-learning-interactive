import type { Color } from '../../core/symbols';
import { type Scene, type SceneDef, lerp } from '../../lecture/scene';
import {
  CK_A,
  CK_C,
  type CkEvent,
  LINKS,
  type PipeRun,
  ckCurve,
  ckStateAt,
  ckTimeline,
  coords3d,
  ddpStep,
  paramsOf,
  pipeSchedule,
  ringAllReduce,
  ringFactor,
  tpToy,
} from '../../lib/parallelism-math';
import { type K, type Rect, area, card, current, fit, gantt, gpu, gpuColor, hatch, heat, line, pill, ringView } from './kit';

// ---------------------------------------------------------------- shared data, computed once

const CK_ALL = ckTimeline(8, 0);
const CK_ONE = ckTimeline(8, 1);
const RING4 = ringAllReduce(4);
const PSI = paramsOf(32, 4096);
const IB = LINKS[1]!;
const DDP_SEQ = ddpStep(PSI, 16384, IB, false);
const DDP_OV = ddpStep(PSI, 16384, IB, true);
const DDP_SMALL = ddpStep(PSI, 2048, IB, true);
const DDP_SMALL_SEQ = ddpStep(PSI, 2048, IB, false);
const TP = tpToy();
const TP_MAX = {
  X: Math.max(...TP.X.flat().map(Math.abs)),
  W: Math.max(...[...TP.W1.flat(), ...TP.W2.flat()].map(Math.abs)),
  Y: Math.max(...TP.Y.flat().map(Math.abs)),
  Z: Math.max(...[...TP.Zref.flat(), ...TP.Zs.flat().flat(), ...TP.Zwrong.flat()].map(Math.abs)),
};
const PIPE_M1 = pipeSchedule(4, 1, 'gpipe');
const PIPE_GP = pipeSchedule(4, 8, 'gpipe');
const PIPE_1F = pipeSchedule(4, 8, '1f1b');

/** Text for whichever listed beat is playing, faded in as it starts. */
function caption(s: Scene, msgs: Record<string, string>, y: number, o: { size?: number; color?: K; maxW?: number; italic?: boolean } = {}): void {
  const cur = current(s, Object.keys(msgs));
  if (!cur) return;
  const t = msgs[cur]!;
  if (!t) return;
  s.alpha(s.ease(cur, 0.45), () => line(s, t, s.w / 2, y, o.maxW ?? s.w * 0.88, o.size ?? 4, { italic: o.italic ?? true, color: s.c(o.color ?? '--ink-2') }));
}

/** Vertical bands of the 16-byte state inside a box: 2 weights, 2 grads, 12 optimizer. */
function stateTile(s: Scene, x: number, y: number, sz: number, a = 1): void {
  s.alpha(a, () => {
    s.rrect(x, y, sz, sz, 1.2, { fill: s.c('--paper') });
    const c = s.ctx;
    const parts: [number, Color, number][] = [[2, 'blue', 0.85], [2, 'teal', 0.85], [4, 'gold', 0.95], [4, 'gold', 0.68], [4, 'gold', 0.42]];
    let xx = x;
    for (const [n, k, al] of parts) {
      c.fillStyle = s.tint(k, al);
      c.fillRect(xx, y, (sz * n) / 16, sz);
      xx += (sz * n) / 16;
    }
    s.rrect(x, y, sz, sz, 1.2, { stroke: s.c('--axis'), lw: 0.25 });
  });
}

// ---------------------------------------------------------------- 1. intro

const MOVES: { head: string; note: string; k: Color }[] = [
  { head: 'data parallel', note: 'copy the model, split the data', k: 'green' },
  { head: 'ZeRO / FSDP', note: 'stop keeping copies', k: 'gold' },
  { head: 'tensor', note: 'split the matrices', k: 'blue' },
  { head: 'pipeline', note: 'split the layers', k: 'purple' },
];

function moveCards(s: Scene, A: Rect, appear: (i: number) => number, lit: (i: number) => number): void {
  const [x, y, w, h] = A;
  const cols = s.tall ? 2 : 4;
  const rows = 4 / cols;
  const gap = s.u * 2.4;
  const cw = (w - gap * (cols - 1)) / cols;
  const ch = Math.min(s.u * 17, (h - gap * (rows - 1)) / rows);
  const top = y + (h - (ch * rows + gap * (rows - 1))) / 2;
  MOVES.forEach((m, i) => {
    const a = appear(i);
    if (a <= 0) return;
    card(s, x + (i % cols) * (cw + gap), top + Math.floor(i / cols) * (ch + gap) + (1 - a) * s.u * 3, cw, ch, m.head, m.note, m.k, lit(i), a);
  });
}

const intro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const A = area(s);
    s.alpha(1 - s.ease('budget', 0.6), () => {
      line(s, 'Training across many GPUs', w / 2, h * 0.45, w * 0.86, 9, { font: 'display', weight: 600 });
      line(s, 'memory · data · ZeRO · tensor · pipeline', w / 2, h * 0.57, w * 0.8, 4.4, { italic: true, color: s.c('--ink-2') });
    });
    const bA = s.win('budget', 'mem');
    if (bA > 0)
      s.alpha(bA, () => {
        const rows: { b: string; t: string; k: K; big?: boolean }[] = [
          { b: 'budget', t: '6 × parameters × tokens', k: '--ink-2' },
          { b: 'model', t: '6 × 70 billion × 15 trillion', k: '--ink' },
          { b: 'total', t: '≈ 6.3 × 10²⁴ operations', k: 'slate' },
          { b: 'gpu', t: 'one H100: about 4 × 10¹⁴ per second', k: '--ink-2' },
          { b: 'years', t: '≈ 500 years', k: 'red', big: true },
        ];
        const y0 = A[1] + A[3] * 0.1;
        const dy = A[3] * 0.18;
        rows.forEach((r, i) => s.alpha(s.ease(r.b, 0.6), () => line(s, r.t, w / 2, y0 + i * dy, A[2], r.big ? 9 : 5.2, { font: r.big ? 'display' : 'serif', weight: r.big ? 650 : 500, color: s.c(r.k) })));
      });
    const mA = s.win('mem', 'many');
    if (mA > 0)
      s.alpha(mA, () => {
        const cols = s.tall ? 5 : 7;
        const rows = Math.ceil(14 / cols);
        const gap = u * 2;
        const size = Math.min((A[2] - gap * (cols - 1)) / cols, (A[3] * 0.55 - gap * (rows - 1)) / rows, u * 18);
        const top = A[1] + A[3] * 0.12;
        for (let k = 0; k < 14; k++) {
          const r = Math.floor(k / cols);
          const inRow = Math.min(cols, 14 - r * cols);
          const left = w / 2 - (inRow * size + (inRow - 1) * gap) / 2;
          stateTile(s, left + (k % cols) * (size + gap), top + r * (size + gap), size, s.ease('mem', 0.4, 0.15 * k));
        }
        const ty = top + rows * (size + gap) + u * 5;
        line(s, '70B × 16 bytes = 1.12 TB of training state', w / 2, ty, A[2], 4.4, { color: s.c('--ink') });
        line(s, '14 GPUs of 80 GB, before any activations', w / 2, ty + u * 6.5, A[2], 3.8, { italic: true, color: s.c('--ink-2') });
      });
    const gA = s.ease('many', 0.8);
    if (gA > 0) {
      const cols = s.tall ? 22 : 40;
      const rows = s.tall ? 20 : 15;
      const cell = Math.min(A[2] / cols, A[3] / rows);
      const x0 = w / 2 - (cols * cell) / 2;
      const y0 = A[1] + (A[3] - rows * cell) / 2;
      const dim = 1 - 0.8 * s.ease('moves', 0.6);
      const c = s.ctx;
      for (let i = 0; i < rows; i++)
        for (let j = 0; j < cols; j++) {
          const a = s.ease('many', 0.5, ((i * cols + j) / (rows * cols)) * 1.8) * dim;
          if (a <= 0.003) continue;
          c.fillStyle = s.tint(j % 8 < 4 ? 'slate' : 'blue', 0.35 * a);
          c.fillRect(x0 + j * cell + cell * 0.12, y0 + i * cell + cell * 0.12, cell * 0.76, cell * 0.76);
        }
      s.alpha(gA * (1 - s.ease('moves', 0.4)), () => line(s, 'thousands of GPUs, one training run', w / 2, y0 + rows * cell * 0.5, A[2] * 0.9, 5.5, { font: 'display', weight: 620, halo: true }));
    }
    const cur = current(s, ['moves', 'plan']);
    moveCards(s, [A[0], A[1], A[2], A[3] * 0.84], (i) => s.ease('moves', 0.5, 0.9 + i * 1.1), (i) => (cur === 'moves' && s.since('moves') > 0.9 + i * 1.1 && s.since('moves') < 2.0 + i * 1.1 ? 1 : 0.15));
    s.alpha(s.ease('plan', 0.6), () => line(s, 'each trades memory for communication', w / 2, A[1] + A[3] * 0.93, A[2], 4.2, { italic: true, color: s.c('--ink-2') }));
  },
};

// ---------------------------------------------------------------- 2. memory

const SEGS: { from: number; to: number; k: Color; a: number; name: string; b: string; delay?: number; up?: boolean }[] = [
  { from: 0, to: 2, k: 'blue', a: 0.85, name: 'weights', b: 'w' },
  { from: 2, to: 4, k: 'teal', a: 0.85, name: 'grads', b: 'g', up: true },
  { from: 4, to: 8, k: 'gold', a: 0.95, name: 'fp32 master', b: 'master' },
  { from: 8, to: 12, k: 'gold', a: 0.68, name: 'Adam m', b: 'adam', up: true },
  { from: 12, to: 16, k: 'gold', a: 0.42, name: 'Adam v', b: 'adam', delay: 0.7 },
];

function byteStrip(s: Scene, x0: number, y: number, cw: number, ch: number, segs: { from: number; to: number; k: Color; a: number; label: string }[], appear: (i: number) => number, dimOf: (i: number) => number = () => 1): void {
  segs.forEach((g, i) => {
    const a = appear(i);
    if (a <= 0.003) return;
    s.alpha(a, () => {
      const x = x0 + g.from * cw + 1;
      const bw = (g.to - g.from) * cw - 2;
      s.rrect(x, y, bw, ch, 0.8, { fill: s.tint(g.k, g.a * dimOf(i)) });
      for (let c = g.from + 1; c < g.to; c++) s.line(x0 + c * cw, y + ch * 0.12, x0 + c * cw, y + ch * 0.88, s.tint('--card', 0.55), 0.15);
      s.rrect(x, y, bw, ch, 0.8, { stroke: s.tint(g.k, 0.9 * dimOf(i)), lw: 0.25 });
      s.text(g.label, x + bw / 2, y + ch / 2, { size: fit(s, g.label, bw * 0.86, 3.4, { font: 'mono', weight: 650 }), font: 'mono', weight: 650, halo: true });
    });
  });
}

const memory: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const A = area(s);
    const cw = Math.min(A[2] / 16, u * 8);
    const ch = Math.min(cw * 2, u * 12);
    const x0 = w / 2 - 8 * cw;
    const y = h * 0.37;
    s.alpha(1 - s.ease('w', 0.5), () => line(s, 'one parameter, five numbers', w / 2, y + ch / 2, A[2], 5.5, { font: 'display', weight: 620, color: s.c('--ink-2') }));
    s.alpha(s.ease('total', 0.6), () => line(s, '16 bytes per parameter', w / 2, h * 0.2, A[2], 6.5, { font: 'display', weight: 650 }));
    const share = s.ease('share', 0.6) * (1 - s.ease('fp32', 0.5));
    byteStrip(
      s,
      x0,
      y,
      cw,
      ch,
      SEGS.map((g) => ({ ...g, label: `${g.to - g.from} B` })),
      (i) => s.ease(SEGS[i]!.b, 0.6, SEGS[i]!.delay ?? 0),
      (i) => (i === 1 ? 1 - 0.6 * share : 1),
    );
    SEGS.forEach((g) =>
      s.alpha(s.ease(g.b, 0.6, g.delay ?? 0), () => {
        const mid = x0 + ((g.from + g.to) / 2) * cw;
        s.text(g.name, mid, y - (g.up ? u * 8.5 : u * 3.6), { size: fit(s, g.name, Math.max((g.to - g.from) * cw * (g.up ? 1.9 : 1.05), u * 10), 3.3), color: s.c(g.k), weight: 600 });
        if (g.up) s.line(mid, y - u * 6.3, mid, y - u * 0.8, s.tint(g.k, 0.6), 0.25);
      }),
    );
    if (share > 0)
      s.alpha(share, () => {
        const by = y + ch + u * 2;
        s.line(x0 + 2, by, x0 + 2 * cw - 2, by, s.c('blue'), 0.4);
        s.text('used by forward', x0, by + u * 3.4, { size: 3.1, align: 'left', color: s.c('blue'), weight: 600 });
        s.line(x0 + 4 * cw + 2, by, x0 + 16 * cw - 2, by, s.c('gold'), 0.4);
        s.text('optimizer state: 12 of 16', x0 + 16 * cw, by + u * 3.4, { size: fit(s, 'optimizer state: 12 of 16', 11 * cw, 3.1), align: 'right', color: s.c('gold'), weight: 600 });
      });
    const bA = s.ease('big', 0.6) * (1 - s.ease('fp32', 0.5));
    if (bA > 0)
      s.alpha(bA, () => {
        line(s, '70B × 16 bytes = 1.12 TB = 14 GPUs of 80 GB', w / 2, h * 0.6, A[2], 4, { color: s.c('--ink') });
        const cols = 7;
        const gap = u * 1.6;
        const size = Math.min((A[2] - gap * (cols - 1)) / cols, (h * 0.86 - h * 0.65 - gap) / 2, u * 12);
        const left = w / 2 - (cols * size + (cols - 1) * gap) / 2;
        for (let k = 0; k < 14; k++) stateTile(s, left + (k % cols) * (size + gap), h * 0.65 + Math.floor(k / cols) * (size + gap), size, s.ease('big', 0.4, 0.5 + 0.08 * k));
      });
    const fA = s.ease('fp32', 0.6, 0.4);
    if (fA > 0)
      s.alpha(fA, () => {
        const y2 = h * 0.68;
        line(s, 'pure fp32 Adam: also 16 bytes', w / 2, y2 - u * 5, A[2], 4, { color: s.c('--ink'), italic: true });
        byteStrip(
          s,
          x0,
          y2,
          cw,
          ch,
          [
            { from: 0, to: 4, k: 'blue', a: 0.85, label: 'w: 4 B' },
            { from: 4, to: 8, k: 'teal', a: 0.85, label: 'g: 4 B' },
            { from: 8, to: 12, k: 'gold', a: 0.68, label: 'm: 4 B' },
            { from: 12, to: 16, k: 'gold', a: 0.42, label: 'v: 4 B' },
          ],
          () => 1,
        );
        line(s, '16-bit math saves compute and activations', w / 2, y2 + ch + u * 5, A[2], 3.6, { italic: true, color: s.c('--ink-2') });
      });
  },
};

// ---------------------------------------------------------------- 3. activations

function layerBars(s: Scene, rect: Rect, held: number[], ev: CkEvent | null): void {
  const [x, y, w, h] = rect;
  const L = held.length;
  const cw = w / L;
  const labelH = s.u * 4;
  const hb = h - labelH;
  for (let i = 0; i < L; i++) {
    const bx = x + i * cw + cw * 0.18;
    const bw = cw * 0.64;
    s.rrect(bx, y, bw, hb, 0.8, { fill: s.tint('--ink-3', 0.05), stroke: s.c('--grid'), lw: 0.25 });
    const v = held[i]!;
    if (v > 0.01) {
      const hh = (v / CK_A) * hb;
      s.ctx.fillStyle = s.tint('orange', 0.55);
      s.ctx.fillRect(bx, y + hb - hh, bw, hh);
      const sl = Math.min(hh, (CK_C / CK_A) * hb + 1.5);
      s.ctx.fillStyle = s.c('orange');
      s.ctx.fillRect(bx, y + hb - sl, bw, sl);
    }
    s.text(`L${i + 1}`, bx + bw / 2, y + hb + labelH * 0.6, { size: Math.min(3, cw / s.u / 3), font: 'mono', color: s.c('--ink-3') });
  }
  if (ev) {
    const cx = x + ev.layer * cw + cw / 2;
    const col = ev.kind === 'B' ? s.c('teal') : ev.kind === 'R' ? s.c('gold') : s.c('orange');
    const dir = ev.kind === 'B' ? -1 : 1;
    s.arrow(cx - dir * cw * 0.3, y - s.u * 2.2, cx + dir * cw * 0.3, y - s.u * 2.2, col, 0.5, 2.2);
  }
}

function memCurve(s: Scene, rect: Rect, runs: { events: CkEvent[]; t: number; k: K; dash?: boolean; label?: string; la: number }[]): void {
  const [x, y, w, h] = rect;
  const X = (t: number) => x + (t / 32) * w;
  const Y = (m: number) => y + h - (m / CK_ALL.peak) * h;
  s.line(x, y - s.u, x, y + h, s.c('--axis'), 0.25);
  s.line(x, y + h, x + w, y + h, s.c('--axis'), 0.25);
  s.text('activation memory', x + w, y - s.u * 1.5, { size: 2.8, align: 'right', color: s.c('--ink-3') });
  s.text('time →', x + w, y + h + s.u * 2.6, { size: 2.8, align: 'right', color: s.c('--ink-3') });
  const c = s.ctx;
  for (const r of runs) {
    const pts = ckCurve(r.events);
    c.save();
    c.beginPath();
    c.rect(x - 2, y - s.u * 2, X(r.t) - x + 2, h + s.u * 4);
    c.clip();
    c.beginPath();
    pts.forEach(([t, m], j) => (j ? c.lineTo(X(t), Y(m)) : c.moveTo(X(t), Y(m))));
    c.strokeStyle = s.c(r.k);
    c.lineWidth = s.u * (r.dash ? 0.3 : 0.55);
    c.setLineDash(r.dash ? [s.u * 1.2, s.u * 1] : []);
    c.stroke();
    c.setLineDash([]);
    c.restore();
    if (r.label && r.la > 0) {
      const peak = Math.max(...pts.map((p) => p[1]));
      const tp = pts.find((p) => p[1] === peak)![0];
      s.alpha(r.la, () => s.text(r.label!, Math.min(X(tp) + s.u * 2, x + w), Y(peak) - s.u * 2.4, { size: 3, align: X(tp) > x + w * 0.6 ? 'right' : 'left', color: s.c(r.k), weight: 650, halo: true }));
    }
  }
}

const activations: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const A = area(s);
    const phaseB = s.since('ckpt') >= 0;
    let tA = 0;
    if (s.since('forward') >= 0) tA = s.since('backward') < 0 ? 8 * s.prog('forward') : 8 + 16 * s.prog('backward');
    const tB = !phaseB ? 0 : s.since('redo') < 0 ? 8 * s.prog('ckpt') : 8 + 24 * s.prog('redo');
    const run = phaseB ? CK_ONE : CK_ALL;
    const t = phaseB ? tB : tA;
    const st = ckStateAt(run.events, t);
    caption(
      s,
      {
        need: "backward needs every layer's inputs",
        grows: 'they grow with the tokens on each GPU',
        count: '34 · s · b · d bytes per layer',
        gpt3: 'GPT-3, one 2,048-token sequence: 82 GB',
        forward: 'forward: every layer stores its activations',
        backward: 'backward: free them, last layer first',
        ckpt: "checkpoint: keep only each block's input",
        redo: 'backward: rerun the block, then backprop',
        peak: 'peak: 136 units → 24',
        cost: 'one extra forward pass: compute × 4/3',
      },
      A[1] + u * 3,
      { size: 4.4, color: '--ink', italic: false },
    );
    const barsTop = A[1] + A[3] * 0.16;
    layerBars(s, [A[0], barsTop, A[2], A[3] * 0.34], st.held, t > 0 && t < run.cost ? st.ev : null);
    const cy = barsTop + A[3] * 0.34 + u * 7;
    const crect: Rect = [A[0] + u * 2, cy, A[2] - u * 2, A[1] + A[3] - cy - u * 3];
    memCurve(s, crect, [
      { events: CK_ALL.events, t: phaseB ? 32 : tA, k: phaseB ? '--ink-3' : 'orange', dash: phaseB, label: 'store all: peak 136', la: phaseB ? 1 : s.ease('backward', 0.5, 1.5) },
      ...(phaseB ? [{ events: CK_ONE.events, t: tB, k: 'orange' as K, label: 'checkpointed: peak 24', la: s.ease('peak', 0.5) }] : []),
    ]);
  },
};

// ---------------------------------------------------------------- 4. data parallelism

const data: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const A = area(s);
    const tall = s.tall;
    const bw = tall ? A[2] * 0.4 : A[2] * 0.27;
    const bh = tall ? A[3] * 0.27 : A[3] * 0.27;
    const xs = tall ? [0.27, 0.73] : [0.2, 0.8];
    const ys = tall ? [0.33, 0.67] : [0.33, 0.68];
    const ctr: [number, number] = [w * 0.5, h * 0.505];
    const boxes = [0, 1, 2, 3].map((i) => [w * xs[i % 2]!, h * ys[Math.floor(i / 2)]!] as [number, number]);
    const send = s.ease('avg', 1.2, 0.2);
    const back = s.ease('avg', 1.2, 2.2);
    const flash = s.ease('same', 0.4) * (1 - s.ease('same', 0.6, 1.4));
    // links to the averaging point
    s.alpha(s.ease('avg', 0.5), () => boxes.forEach(([bx, by]) => s.line(bx, by, ctr[0], ctr[1], s.tint('teal', 0.35), 0.35, [1.2, 1])));
    boxes.forEach(([bx, by], i) => {
      const x = bx - bw / 2;
      const y = by - bh / 2;
      gpu(s, x, y, bw, bh, `GPU ${i}`, 'slate', flash);
      const mw = bw * 0.42;
      const mh = bh * 0.38;
      s.rrect(x + u * 1.6, y + bh - mh - u * 1.6, mw, mh, 1, { fill: s.tint('blue', 0.22 + 0.4 * flash), stroke: s.c('blue'), lw: 0.3 });
      s.text('model', x + u * 1.6 + mw / 2, y + bh - mh / 2 - u * 1.6, { size: Math.min(3.2, mw / u / 3.6), color: s.c('blue'), weight: 600 });
      s.alpha(s.ease('slice', 0.5, i * 0.25), () => pill(s, `x[${i}::4]`, x + bw * 0.74, y + bh * 0.32, 'orange', Math.min(3, bw / u / 9)));
      s.alpha(s.ease('grad', 0.5, i * 0.25) * (1 - send * 0.85), () => pill(s, `G${i}`, x + bw * 0.74, y + bh * 0.7, 'teal', Math.min(3.2, bw / u / 8)));
      if (send > 0 && send < 1) {
        const gx = lerp(x + bw * 0.74, ctr[0], send);
        const gy = lerp(y + bh * 0.7, ctr[1], send);
        pill(s, `G${i}`, gx, gy, 'teal', 2.8);
      }
      if (back > 0) {
        const gx = lerp(ctr[0], x + bw * 0.74, back);
        const gy = lerp(ctr[1], y + bh * 0.7, back);
        pill(s, 'G', gx, gy, 'teal', 3.2);
      }
    });
    s.alpha(s.ease('avg', 0.5, 1.2), () => {
      s.circle(ctr[0], ctr[1], u * 6.5, { fill: s.tint('teal', 0.15), stroke: s.c('teal'), lw: 0.4 });
      s.text('avg', ctr[0], ctr[1], { size: 3.4, color: s.c('teal'), weight: 650, font: 'mono' });
    });
    caption(
      s,
      {
        copies: 'a full copy of the model on every GPU',
        slice: 'each GPU gets its own slice of the batch',
        grad: 'each computes its own gradient',
        avg: 'average the gradients, hand back the average',
        same: 'every copy takes the identical step',
        exact: 'the average of the slices = the whole batch’s gradient',
        allreduce: 'all-reduce: everyone gives an array, everyone gets the sum',
        size: '7B model: 14 GB of gradients, every step',
      },
      A[1] + A[3] - u * 1.5,
      { size: 4, color: '--ink' },
    );
  },
};

// ---------------------------------------------------------------- 5. ring all-reduce

const ring: SceneDef = {
  marks: {
    cost: { tex: String.raw`\text{sent per GPU} = \frac{2(\symN-1)}{\symN}\times\text{size}`, x: 0.5, y: 0.3, size: 5 },
  },
  draw(s) {
    const { w, h, u } = s;
    const A = area(s);
    // the star: one GPU collects everything
    const sA = 1 - s.ease('ring', 0.6);
    if (sA > 0)
      s.alpha(sA, () => {
        const cx = w / 2;
        const cy = A[1] + A[3] * 0.45;
        const R = Math.min(A[2] * 0.4, A[3] * 0.36);
        const bw = u * 17;
        const bh = u * 9;
        const hot = s.ease('bottleneck', 0.6);
        const outer = Array.from({ length: 6 }, (_, i) => {
          const a = -Math.PI / 2 + (2 * Math.PI * (i + 0.5)) / 6;
          return [cx + R * Math.cos(a) * (s.tall ? 1 : 1.5), cy + R * Math.sin(a)] as [number, number];
        });
        outer.forEach(([x, y], i) => {
          s.line(x, y, cx, cy, hot > 0 ? s.tint('red', 0.35 + 0.5 * hot) : s.c('--grid'), 0.35 + 0.5 * hot);
          const ph = (s.t * 0.6 + i * 0.17) % 1;
          s.circle(lerp(x, cx, ph), lerp(y, cy, ph), u * 1, { fill: s.c('teal') });
          s.circle(lerp(cx, x, (ph + 0.5) % 1), lerp(cy, y, (ph + 0.5) % 1), u * 1, { fill: s.c('green') });
        });
        outer.forEach(([x, y], i) => {
          s.rrect(x - bw / 2, y - bh / 2, bw, bh, 1.6, { fill: s.c('--card') });
          gpu(s, x - bw / 2, y - bh / 2, bw, bh, '', 'slate');
          s.text(`GPU ${i + 1}`, x, y, { size: 3.2, font: 'ui', weight: 650, color: s.c('slate') });
        });
        s.rrect(cx - bw * 0.65, cy - bh * 0.65, bw * 1.3, bh * 1.3, 1.6, { fill: s.c('--card') });
        gpu(s, cx - bw * 0.65, cy - bh * 0.65, bw * 1.3, bh * 1.3, '', hot > 0 ? 'red' : 'slate', hot);
        s.text('GPU 0', cx, cy, { size: 3.8, font: 'ui', weight: 700, color: s.c(hot > 0 ? 'red' : 'slate'), halo: true });
        s.alpha(hot, () => line(s, 'N − 1 gradients in, N − 1 sums out', w / 2, A[1] + A[3] * 0.94, A[2], 4, { color: s.c('red'), weight: 600 }));
        s.alpha(1 - hot, () => line(s, 'one GPU adds them all up', w / 2, A[1] + A[3] * 0.94, A[2], 4, { italic: true, color: s.c('--ink-2') }));
      });
    // the ring
    const rA = s.win('ring', 'cost');
    if (rA > 0) {
      let kf = 0;
      const quant = (raw: number) => Math.floor(raw) + Math.min(1, (raw - Math.floor(raw)) / 0.7);
      if (s.since('rs') >= 0) kf = quant(3 * s.prog('rs'));
      if (s.since('own') >= 0) kf = 3;
      if (s.since('ag') >= 0) kf = 3 + quant(Math.min(2.999, 3 * s.prog('ag')));
      if (s.since('ag') >= 0 && s.prog('ag') >= 1) kf = 6;
      s.alpha(rA, () => {
        ringView(s, [A[0], A[1] + u * 7, A[2], A[3] - u * 9], 4, RING4, kf);
        const k = Math.ceil(kf - 1e-6);
        const lab = s.since('rs') < 0 ? 'each gradient cut into 4 chunks' : k <= 3 ? `reduce-scatter: step ${Math.max(1, k)} of 3` : `all-gather: step ${k - 3} of 3`;
        line(s, s.since('own') >= 0 && s.since('ag') < 0 ? 'each GPU owns one finished chunk' : lab, w / 2, A[1] + u * 2.5, A[2], 4, { color: s.c('--ink'), weight: 600 });
      });
    }
    // the cost chart
    const cA = s.win('cost', 'halves');
    if (cA > 0)
      s.alpha(cA, () => {
        s.show('cost', cA * (1 - s.ease('latency', 0.5)), { y: 0.25 });
        const fx = A[0] + u * 6;
        const fw = A[2] - u * 8;
        const fy = A[1] + A[3] * 0.32;
        const fh = A[3] * 0.56;
        const X = (n: number) => fx + ((n - 2) / 14) * fw;
        const Y = (v: number) => fy + fh - (v / 8) * fh;
        for (const v of [0, 2, 4, 6, 8]) {
          s.line(fx, Y(v), fx + fw, Y(v), s.c('--grid'), 0.18);
          s.text(String(v), fx - u * 1.5, Y(v), { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
        }
        for (const n of [2, 4, 8, 16]) s.text(String(n), X(n), fy + fh + u * 3, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
        s.text('GPUs N', fx + fw, fy + fh + u * 6.5, { size: 2.8, align: 'right', color: s.c('--ink-3') });
        const c = s.ctx;
        const ns = Array.from({ length: 15 }, (_, i) => i + 2);
        c.save();
        c.beginPath();
        c.rect(fx, fy - u, fw, fh + u);
        c.clip();
        const curve = (f: (n: number) => number, k: K, lw: number, p: number) => {
          c.beginPath();
          ns.filter((n) => n <= 2 + 14 * p).forEach((n, j) => (j ? c.lineTo(X(n), Y(f(n))) : c.moveTo(X(n), Y(f(n)))));
          c.strokeStyle = s.c(k);
          c.lineWidth = u * lw;
          c.stroke();
        };
        curve((n) => n - 1, 'red', 0.4, s.ease('cost', 1.5, 0.6));
        curve(ringFactor, 'green', 0.65, s.ease('cost', 1.5, 0.6));
        c.restore();
        s.alpha(s.ease('cost', 0.5, 2), () => {
          s.text('one GPU collects: N − 1', X(2.4), Y(7.4), { size: 3, align: 'left', color: s.c('red'), weight: 600, halo: true });
          s.text('ring: 2(N − 1)/N', X(16), Y(2) - u * 3, { size: 3.2, align: 'right', color: s.c('green'), weight: 650, halo: true });
        });
        s.alpha(s.ease('flat', 0.5), () => s.text('never above 2', X(16), Y(2) + u * 3.6, { size: 3, align: 'right', color: s.c('green'), italic: true, halo: true }));
        s.alpha(s.ease('latency', 0.5), () => line(s, '2(N − 1) steps, each with a fixed delay: send big buckets', w / 2, A[1] + A[3] * 0.18, A[2], 3.8, { italic: true, color: s.c('--ink-2') }));
      });
    s.alpha(s.ease('halves', 0.6), () => {
      const y = A[1] + A[3] * 0.5;
      const gap = u * 3;
      const items: [string, K][] = [['reduce-scatter', 'teal'], ['+', '--ink-3'], ['all-gather', 'green'], ['=', '--ink-3'], ['all-reduce', 'slate']];
      const size = fit(s, 'reduce-scatter + all-gather = all-reduce', A[2] * 0.78, 4, { font: 'mono', weight: 600 });
      const widths = items.map(([t]) => (t.length > 1 ? s.measure(t, { font: 'mono', size, weight: 600 }) + u * size * 0.95 : u * 3));
      let x = w / 2 - (widths.reduce((a, b) => a + b, 0) + gap * 4) / 2;
      items.forEach(([t, k], i) => {
        if (t.length > 1) pill(s, t, x + widths[i]! / 2, y, k, size);
        else s.text(t, x + widths[i]! / 2, y, { size: 4.5, color: s.c(k) });
        x += widths[i]! + gap;
      });
      line(s, 'the two halves that sharding is built from', w / 2, y + u * 9, A[2], 3.8, { italic: true, color: s.c('--ink-2') });
    });
  },
};

// ---------------------------------------------------------------- 6. communication versus compute

function timeline(s: Scene, rect: Rect, seq: ReturnType<typeof ddpStep>, ov: ReturnType<typeof ddpStep>, mix: number, tmax: number): void {
  const [x, y, w, h] = rect;
  const lx = s.u * 15;
  const X = (t: number) => x + lx + (t / tmax) * (w - lx);
  const laneH = Math.min(s.u * 9, h * 0.32);
  const y1 = y;
  const y2 = y + laneH + s.u * 4;
  s.text('GPU math', x, y1 + laneH / 2, { size: 3, align: 'left', font: 'ui', weight: 600, color: s.c('--ink-2') });
  s.text('network', x, y2 + laneH / 2, { size: 3, align: 'left', font: 'ui', weight: 600, color: s.c('--ink-2') });
  const c = s.ctx;
  c.fillStyle = s.tint('orange', 0.7);
  c.fillRect(X(seq.fwd[0]), y1, X(seq.fwd[1]) - X(seq.fwd[0]) - 1, laneH);
  seq.bwd.forEach(([a, b]) => {
    c.fillStyle = s.tint('teal', 0.75);
    c.fillRect(X(a), y1, Math.max(1, X(b) - X(a) - 1), laneH);
  });
  const compute = seq.compute;
  let end = 0;
  seq.comm.forEach(([a0, b0], j) => {
    const [a1, b1] = ov.comm[j]!;
    const a = lerp(a0, a1, mix);
    const b = lerp(b0, b1, mix);
    end = Math.max(end, b);
    c.fillStyle = s.tint('green', 0.7);
    c.fillRect(X(a), y2, Math.max(1, X(b) - X(a) - 1), laneH);
    if (b > compute) hatch(s, X(Math.max(a, compute)), y2, X(b) - X(Math.max(a, compute)) - 1, laneH, s.tint('red', 0.75), 1.1);
  });
  if (end > compute) {
    c.fillStyle = s.tint('red', 0.08);
    c.fillRect(X(compute), y1, X(end) - X(compute), laneH);
    hatch(s, X(compute), y1, X(end) - X(compute), laneH, s.tint('red', 0.45), 1.4);
  }
  s.line(x + lx, y2 + laneH + s.u * 2.5, x + w, y2 + laneH + s.u * 2.5, s.c('--axis'), 0.2);
  s.text('time →', x + w, y2 + laneH + s.u * 5.2, { size: 2.8, align: 'right', color: s.c('--ink-3') });
}

const RATIOS: [string, number][] = [['1K', 5.15], ['4K', 1.29], ['16K', 0.32], ['64K', 0.08]];

const overlap: SceneDef = {
  marks: {
    ratio: { tex: String.raw`\frac{\text{talk}}{\text{compute}} \approx \frac{4\,\symPsi/\symB}{6\,\symPsi\, T / F}`, x: 0.5, y: 0.66, size: 5.4 },
    cancel: { tex: String.raw`\frac{4\,\cancel{\symPsi}/\symB}{6\,\cancel{\symPsi}\, T / F} = \frac{2F}{3\,T\,\symB}`, x: 0.5, y: 0.66, size: 5.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    const A = area(s);
    const rect: Rect = [A[0], A[1] + u * 7, A[2], A[3] * 0.34];
    const small = s.ease('shrink', 0.6);
    const mix = s.ease('overlap', 1.6, 0.6);
    s.alpha(1 - small, () => {
      line(s, s.since('overlap') < 0 ? 'all-reduce after the backward pass' : 'all-reduce during the backward pass', w / 2, A[1] + u * 2.5, A[2], 3.8, { color: s.c('--ink'), weight: 600 });
      timeline(s, rect, DDP_SEQ, DDP_OV, mix, DDP_SEQ.total * 1.02);
      s.alpha(s.ease('buckets', 0.5) * (1 - s.ease('overlap', 0.5)), () => {
        const lx = u * 15;
        const X = (t: number) => rect[0] + lx + (t / (DDP_SEQ.total * 1.02)) * (rect[2] - lx);
        const laneH = Math.min(u * 9, rect[3] * 0.32);
        DDP_SEQ.bwd.forEach(([a, b], j) => s.text(`b${8 - j}`, (X(a) + X(b)) / 2, rect[1] + laneH + u * 2, { size: 2.6, font: 'mono', weight: 650, color: s.c('teal') }));
      });
    });
    s.alpha(small, () => {
      line(s, 'T = 2K tokens per GPU: compute shrinks, talk does not', w / 2, A[1] + u * 2.5, A[2], 3.8, { color: s.c('red'), weight: 600 });
      timeline(s, rect, DDP_SMALL_SEQ, DDP_SMALL, 1, DDP_SMALL_SEQ.total * 1.02);
    });
    s.show('ratio', s.win('ratio', 'cancel', 0.4));
    s.show('cancel', s.win('cancel', 'tokens', 0.4));
    const bA = s.win('tokens', 'limit');
    if (bA > 0)
      s.alpha(bA, () => {
        const fx = A[0] + u * 10;
        const fw = A[2] - u * 12;
        const fy = A[1] + A[3] * 0.58;
        const fh = A[3] * 0.32;
        const Y = (v: number) => fy + fh - (Math.min(v, 2) / 2) * fh;
        s.line(fx, Y(1), fx + fw, Y(1), s.c('red'), 0.3, [1.2, 1]);
        s.text('talk = math', fx + fw, Y(1) - u * 2, { size: 2.8, align: 'right', color: s.c('red'), weight: 600 });
        const bw = fw / RATIOS.length;
        RATIOS.forEach(([lab, v], i) => {
          const a = s.ease('tokens', 0.5, 0.3 + i * 0.35);
          const x = fx + i * bw + bw * 0.22;
          const hh = (Y(0) - Y(v)) * a;
          s.ctx.fillStyle = s.tint(v > 1 ? 'red' : 'green', 0.65);
          s.ctx.fillRect(x, Y(0) - hh, bw * 0.56, hh);
          s.alpha(a, () => s.text(v >= 2 ? `${v} ↑` : String(v), x + bw * 0.28, Y(v) - u * 2.2, { size: 3, font: 'mono', weight: 600, color: s.c('--ink') }));
          s.text(`T = ${lab}`, x + bw * 0.28, Y(0) + u * 3, { size: 2.9, font: 'mono', color: s.c('--ink-2') });
        });
        s.text('talk / compute, InfiniBand', fx, fy - u * 7, { size: 2.9, align: 'left', color: s.c('--ink-3') });
      });
    const tA = s.ease('limit', 0.6);
    if (tA > 0)
      s.alpha(tA, () => {
        line(s, 'global batch = N × T tokens', w / 2, A[1] + A[3] * 0.68, A[2], 4.6, { font: 'mono', weight: 600, color: s.c('green') });
        line(s, 'past the critical batch size, bigger batches stop helping', w / 2, A[1] + A[3] * 0.78, A[2], 3.6, { italic: true, color: s.c('--ink-2') });
        s.alpha(s.ease('memory', 0.6), () => line(s, 'and every GPU still holds 16 bytes per parameter', w / 2, A[1] + A[3] * 0.9, A[2], 3.8, { color: s.c('gold'), weight: 600 }));
      });
  },
};

// ---------------------------------------------------------------- 7. ZeRO

const zero: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const A = area(s);
    const N = 4;
    const e1 = s.ease('s1', 1.2);
    const e2 = s.ease('s2', 1.2);
    const e3 = s.ease('s3', 1.2);
    const top = A[1] + u * 7;
    const base = A[1] + A[3] * 0.66;
    const H = base - top;
    const holdW = Math.min(u * 14, A[2] * 0.16);
    const holdX = A[0] + A[2] - holdW;
    const gap = u * 2.2;
    const cw = (holdX - u * 7 - A[0] - gap * (N - 1)) / N;
    const bands: { frac: number; e: number; k: Color }[] = [
      { frac: 2 / 16, e: e3, k: 'blue' },
      { frac: 2 / 16, e: e2, k: 'teal' },
      { frac: 12 / 16, e: e1, k: 'gold' },
    ];
    const c = s.ctx;
    for (let g = 0; g < N; g++) {
      const x = A[0] + g * (cw + gap);
      s.text(`GPU ${g}`, x + cw / 2, top - u * 2.5, { size: 3, font: 'ui', weight: 600, color: s.c('--ink-2') });
      let yb = base;
      for (const bd of bands) {
        const bh = bd.frac * H;
        const y0 = yb - bh;
        c.fillStyle = s.tint(bd.k, 0.08);
        c.fillRect(x, y0, cw, bh);
        const sy0 = lerp(y0, yb - ((g + 1) / N) * bh, bd.e);
        const sy1 = lerp(yb, yb - (g / N) * bh, bd.e);
        c.fillStyle = s.tint(bd.k, 0.8);
        c.fillRect(x, sy0, cw, sy1 - sy0);
        if (bd.e > 0.01) {
          c.save();
          c.setLineDash([u * 0.8, u * 0.6]);
          c.strokeStyle = s.tint(bd.k, 0.6 * bd.e);
          c.lineWidth = 1;
          c.strokeRect(x + 0.5, y0 + 0.5, cw - 1, bh - 1);
          c.restore();
        }
        s.line(x, y0, x + cw, y0, s.c('--card'), 0.2);
        yb = y0;
      }
    }
    s.line(holdX - u * 3.5, top - u * 4, holdX - u * 3.5, base, s.c('--rule'), 0.2);
    s.text('holds', holdX + holdW / 2, top - u * 2.5, { size: 3, font: 'ui', weight: 700 });
    let yb = base;
    for (const bd of bands) {
      const bh = bd.frac * H * lerp(1, 1 / N, bd.e);
      c.fillStyle = s.tint(bd.k, 0.85);
      c.fillRect(holdX, yb - bh, holdW, bh);
      yb -= bh;
    }
    const held = 16 * (bands[0]!.frac * lerp(1, 1 / N, e3) + bands[1]!.frac * lerp(1, 1 / N, e2) + bands[2]!.frac * lerp(1, 1 / N, e1));
    s.text(`${held.toFixed(1)} B`, holdX + holdW / 2, yb - u * 2.4 < top + u ? yb + u * 3 : yb - u * 2.4, { size: 2.9, font: 'mono', weight: 650, halo: true });
    // legend
    const ly = base + u * 4.5;
    const legend: [string, Color][] = [['weights 2', 'blue'], ['grads 2', 'teal'], ['optimizer 12', 'gold']];
    const size = fit(s, 'weights 2   grads 2   optimizer 12 (bytes per parameter)', A[2], 3);
    let lx = A[0];
    legend.forEach(([t, k]) => {
      s.rrect(lx, ly - u * 1.2, u * 2.4, u * 2.4, 0.4, { fill: s.tint(k, 0.85) });
      s.text(t, lx + u * 3.2, ly, { size, align: 'left', color: s.c('--ink-2') });
      lx += u * 3.2 + s.measure(t, { size }) + u * 3;
    });
    s.text('(bytes per parameter)', lx, ly, { size, align: 'left', color: s.c('--ink-3'), italic: true });
    caption(
      s,
      {
        copies: '4 GPUs, 4 copies of all 16 bytes',
        zero: 'ZeRO: remove the copies in three stages',
        s1: "stage 1: each GPU owns 1/N of Adam's state",
        rs: 'reduce-scatter grads → update own slice → all-gather weights',
        free: '12 of 16 bytes ÷ N, same traffic as before',
        s2: 'stage 2: gradients sharded too',
        s3: "stage 3: weights too, gathered just before each layer",
        cost3: '1.5 × the traffic, everything ÷ N',
        nums: '',
        fsdp: 'FSDP: per block, gather → run → free',
        acts: 'not sharded: activations, and each layer must fit',
      },
      A[1] + A[3] * 0.86,
      { size: 4, color: '--ink' },
    );
    s.alpha(s.win('nums', 'fsdp', 0.4), () => {
      const items: [string, K][] = [['DDP 120', 'slate'], ['Z-1 31.4', 'gold'], ['Z-2 16.6', 'teal'], ['Z-3 1.9 GB', 'blue']];
      const size2 = fit(s, 'DDP 120  Z-1 31.4  Z-2 16.6  Z-3 1.9 GB', A[2] * 0.82, 3.8, { font: 'mono', weight: 600 });
      const ws = items.map(([t]) => s.measure(t, { font: 'mono', size: size2, weight: 600 }) + u * size2 * 0.95);
      const g2 = u * 1.6;
      let x = w / 2 - (ws.reduce((a, b) => a + b, 0) + g2 * 3) / 2;
      items.forEach(([t, k], i) => {
        s.alpha(s.ease('nums', 0.4, 1.5 + i * 1.2), () => pill(s, t, x + ws[i]! / 2, A[1] + A[3] * 0.86, k, size2));
        x += ws[i]! + g2;
      });
      line(s, '7.5B parameters on 64 GPUs, per GPU', w / 2, A[1] + A[3] * 0.95, A[2], 3.2, { italic: true, color: s.c('--ink-3') });
    });
  },
};

// ---------------------------------------------------------------- 8. tensor parallelism

type Item = { M: number[][]; k: Color; name: string; max: number; outline?: K; dim?: number } | string;

function mRow(s: Scene, items: Item[], x0: number, y: number, cs: number, g: number, rowsH: number): void {
  let x = x0;
  for (const it of items) {
    if (typeof it === 'string') {
      s.text(it, x + g / 2, y + rowsH / 2, { size: Math.min(4, g / s.u), color: s.c('--ink-3'), weight: 600 });
      x += g;
      continue;
    }
    const mh = it.M.length * cs;
    const my = y + (rowsH - mh) / 2;
    if (it.name) s.text(it.name, x + (it.M[0]!.length * cs) / 2, my - s.u * 2, { size: Math.min(2.8, cs / s.u * 0.9), font: 'mono', weight: 650, color: s.c('--ink-2') });
    heat(s, x, my, cs, it.M, it.k, it.max, { outline: it.outline, dim: it.dim });
    x += it.M[0]!.length * cs;
  }
}
const rowW = (items: Item[], cs: number, g: number) => items.reduce((a, it) => a + (typeof it === 'string' ? g : it.M[0]!.length * cs), 0);

const tensor: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const A = area(s);
    const gc: K[] = ['blue', 'purple'];
    const pA = 1 - s.ease('attn', 0.6);
    if (pA > 0)
      s.alpha(pA, () => {
        const one = 1 - s.ease('split1', 0.6);
        const g = u * 3.6;
        if (one > 0)
          s.alpha(one, () => {
            const items: Item[] = [
              { M: TP.X, k: 'orange', name: 'X', max: TP_MAX.X },
              '·',
              { M: TP.W1, k: 'blue', name: 'W1', max: TP_MAX.W },
              '→',
              { M: TP.Y, k: 'teal', name: 'GeLU', max: TP_MAX.Y },
              '·',
              { M: TP.W2, k: 'blue', name: 'W2', max: TP_MAX.W },
              '=',
              { M: TP.Zref, k: 'purple', name: 'Z', max: TP_MAX.Z },
            ];
            const cs = Math.min(u * 5, (A[2] - 4 * g) / 28.5);
            const x0 = w / 2 - rowW(items, cs, g) / 2;
            const y0 = A[1] + A[3] * 0.48 - 4 * cs;
            mRow(s, items, x0, y0, cs, g, 8 * cs);
            const wx = x0 + rowW(items.slice(0, 2), cs, g);
            s.alpha(s.ease('cols', 0.5), () => s.line(wx + 4 * cs, y0 + 2 * cs - u * 0.4, wx + 4 * cs, y0 + 6 * cs + u * 1.5, s.c('--ink'), 0.45, [1, 0.8]));
            line(s, s.since('mlp') < 0 ? 'Megatron-LM: split inside each layer' : s.since('cols') < 0 ? 'the MLP on one GPU' : 'cut W1 between its columns', w / 2, A[1] + u * 2.5, A[2], 4, { color: s.c('--ink'), weight: 600 });
          });
        const two = s.ease('split1', 0.6);
        if (two > 0)
          s.alpha(two, () => {
            const stg = s.since('gelu') < 0 ? 1 : s.since('rows') < 0 ? 2 : 3;
            const full: Item[] = [{ M: TP.X, k: 'orange', name: '', max: 1 }, '·', { M: TP.W1s[0]!, k: 'blue', name: '', max: 1 }, '→', { M: TP.Ys[0]!, k: 'teal', name: '', max: 1 }, '·', { M: TP.W2s[0]!, k: 'blue', name: '', max: 1 }, '=', { M: TP.Zs[0]!, k: 'purple', name: '', max: 1 }];
            const cs = Math.min(u * 5, (A[2] - 4 * g) / (rowW(full, 1, 0) + 0.5), (A[3] - u * 40) / 10.6);
            const laneH = 4 * cs + u * 8;
            const x0 = w / 2 - rowW(full, cs, g) / 2;
            [0, 1].forEach((i) => {
              const y = A[1] + u * 6 + i * (laneH + u * 2);
              s.rrect(A[0], y, A[2], laneH, 1.6, { fill: s.tint(gc[i]!, 0.05), stroke: s.tint(gc[i]!, 0.5), lw: 0.25 });
              s.text(`GPU ${i}`, A[0] + u * 1.4, y + u * 2.4, { size: 2.9, font: 'ui', weight: 700, align: 'left', color: s.c(gc[i]!) });
              const items: Item[] = [{ M: TP.X, k: 'orange', name: 'X', max: TP_MAX.X }, '·', { M: TP.W1s[i]!, k: 'blue', name: `W1_${i}`, max: TP_MAX.W, outline: gc[i] }];
              if (stg >= 2) items.push('→', { M: TP.Ys[i]!, k: 'teal', name: `Y_${i}`, max: TP_MAX.Y });
              if (stg >= 3) items.push('·', { M: TP.W2s[i]!, k: 'blue', name: `W2_${i}`, max: TP_MAX.W, outline: gc[i] }, '=', { M: TP.Zs[i]!, k: 'purple', name: `Z_${i}`, max: TP_MAX.Z });
              mRow(s, items, x0, y + u * 6.5, cs, g, 4 * cs);
            });
            const sy = A[1] + u * 6 + 2 * (laneH + u * 2) + u * 4;
            const cs2 = Math.min(cs * 1.25, (A[2] - 3 * g) / 17);
            s.alpha(s.win('ar', 'wrong', 0.5), () => {
              const sum: Item[] = [{ M: TP.Zs[0]!, k: 'purple', name: 'Z_0', max: TP_MAX.Z }, '+', { M: TP.Zs[1]!, k: 'purple', name: 'Z_1', max: TP_MAX.Z }, '=', { M: TP.Z, k: 'purple', name: 'Z', max: TP_MAX.Z, outline: '--ink' }, '≡', { M: TP.Zref, k: 'purple', name: 'one GPU', max: TP_MAX.Z }];
              mRow(s, sum, w / 2 - rowW(sum, cs2, g) / 2, sy + u * 3, cs2, g, 2 * cs2);
              line(s, `all-reduce: max error ${TP.err.toExponential(0)}`, w / 2, sy + u * 3 + 2 * cs2 + u * 4.5, A[2], 3.4, { font: 'mono', weight: 650, color: s.c('green') });
            });
            s.alpha(s.ease('wrong', 0.5), () => {
              const bad: Item[] = [{ M: TP.Zwrong, k: 'purple', name: 'rows first', max: TP_MAX.Z, outline: 'red' }, '≠', { M: TP.Zref, k: 'purple', name: 'one GPU', max: TP_MAX.Z }];
              mRow(s, bad, w / 2 - rowW(bad, cs2, g * 1.5) / 2, sy + u * 3, cs2, g * 1.5, 2 * cs2);
              line(s, `GeLU of partial sums: error ${TP.errWrong.toFixed(2)}`, w / 2, sy + u * 3 + 2 * cs2 + u * 4.5, A[2], 3.4, { font: 'mono', weight: 650, color: s.c('red') });
            });
          });
      });
    // attention, the ratio and the server
    const aA = s.win('attn', 'ratio');
    if (aA > 0)
      s.alpha(aA, () => {
        const cw = s.tall ? A[2] : A[2] * 0.48;
        const ch = u * 16;
        const y0 = A[1] + A[3] * 0.22;
        card(s, A[0], y0, cw, ch, 'attention: split by heads', 'columns of W_Q, W_K, W_V; rows of W_O', 'blue', 0.4);
        const x2 = s.tall ? A[0] : A[0] + A[2] - cw;
        const y2 = s.tall ? y0 + ch + u * 4 : y0;
        card(s, x2, y2, cw, ch, 'per block: 4 all-reduces', '2 forward, 2 backward', 'slate', 0.4, s.ease('attn', 0.5, 2.5));
      });
    const rA = s.win('ratio', 'nvlink');
    if (rA > 0)
      s.alpha(rA, () => {
        const fx = A[0] + u * 4;
        const fw = A[2] - u * 8;
        const fy = A[1] + A[3] * 0.2;
        const fh = A[3] * 0.6;
        const Y = (v: number) => fy + fh - (v / 2) * fh;
        s.line(fx, Y(1), fx + fw, Y(1), s.c('red'), 0.3, [1.2, 1]);
        s.text('talk = math', fx, Y(1) - u * 2, { size: 3, align: 'left', color: s.c('red'), weight: 600 });
        const bars: [string, number, Color][] = [['NVLink', 0.17, 'green'], ['InfiniBand', 1.5, 'red']];
        bars.forEach(([lab, v, k], i) => {
          const a = s.ease('ratio', 0.6, 0.5 + i * 1.2);
          const bw = fw * 0.24;
          const x = fx + fw * (0.18 + i * 0.42);
          const hh = (Y(0) - Y(v)) * a;
          s.ctx.fillStyle = s.tint(k, 0.65);
          s.ctx.fillRect(x, Y(0) - hh, bw, hh);
          s.alpha(a, () => s.text(String(v), x + bw / 2, Y(v) - u * 2.4, { size: 3.4, font: 'mono', weight: 650 }));
          s.text(lab, x + bw / 2, Y(0) + u * 3, { size: 3.2, color: s.c('--ink-2'), weight: 600 });
        });
        line(s, 'tensor-parallel talk / compute, 8 GPUs, d = 8192', w / 2, A[1] + u * 2.5, A[2], 3.6, { color: s.c('--ink'), weight: 600 });
      });
    const nA = s.ease('nvlink', 0.6);
    if (nA > 0)
      s.alpha(nA, () => {
        const sw = Math.min(A[2] * 0.9, u * 90);
        const sh = Math.min(A[3] * 0.62, sw * 0.6);
        const sx = w / 2 - sw / 2;
        const sy = A[1] + A[3] * 0.12;
        s.rrect(sx, sy, sw, sh, 2, { fill: s.tint('--ink-3', 0.05), stroke: s.c('--rule'), lw: 0.3 });
        s.text('one server', sx + u * 2, sy + u * 3, { size: 3, align: 'left', color: s.c('--ink-3'), font: 'ui', weight: 600 });
        const gs = Math.min((sw - u * 10) / 4.6, (sh - u * 10) / 2.6);
        const pts: [number, number][] = [];
        for (let i = 0; i < 8; i++) {
          const cx = sx + sw / 2 + ((i % 4) - 1.5) * gs * 1.2;
          const cy = sy + sh / 2 + u * 2 + (Math.floor(i / 4) - 0.5) * gs * 1.3;
          pts.push([cx, cy]);
        }
        for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) s.line(pts[i]![0], pts[i]![1], pts[j]![0], pts[j]![1], s.tint('green', 0.3), 0.2);
        pts.forEach(([cx, cy], i) => gpu(s, cx - gs / 2, cy - gs * 0.4, gs, gs * 0.8, `t${i}`, 'blue', 0.5));
        line(s, 'tensor parallel: 8 GPUs on NVLink', w / 2, sy + sh + u * 5, A[2], 4, { color: s.c('--ink'), weight: 600 });
      });
  },
};

// ---------------------------------------------------------------- 9. pipeline

const pipeline: SceneDef = {
  marks: {
    bubble: { tex: String.raw`\text{bubble} = \frac{\symp - 1}{\symm + \symp - 1}`, x: 0.5, y: 0.8, size: 5.4 },
  },
  draw(s) {
    const { w, h, u } = s;
    const A = area(s);
    const dA = 1 - s.ease('idle', 0.5);
    if (dA > 0)
      s.alpha(dA, () => {
        const bw = (A[2] - u * 3 * 3) / 4;
        const bh = Math.min(u * 22, A[3] * 0.3);
        const y = A[1] + A[3] * 0.32;
        for (let i = 0; i < 4; i++) {
          const x = A[0] + i * (bw + u * 3);
          s.alpha(s.ease('depth', 0.5, 0.4 + i * 0.4), () => {
            gpu(s, x, y, bw, bh, `GPU ${i}`, 'purple', 0.3);
            line(s, `layers ${i * 8 + 1}–${i * 8 + 8}`, x + bw / 2, y + bh * 0.62, bw * 0.9, 3.2, { font: 'mono', color: s.c('--ink-2') });
          });
          if (i < 3)
            s.alpha(s.ease('send', 0.5, 0.3 + i * 0.3), () => {
              s.arrow(x + bw - u, y - u * 3, x + bw + u * 4, y - u * 3, s.c('orange'), 0.5, 2);
              s.arrow(x + bw + u * 4, y + bh + u * 3, x + bw - u, y + bh + u * 3, s.c('teal'), 0.5, 2);
            });
        }
        s.alpha(s.ease('send', 0.5, 1.2), () => {
          line(s, 'activations →', w / 2, y - u * 8, A[2], 3.6, { color: s.c('orange'), weight: 600 });
          line(s, '← gradients', w / 2, y + bh + u * 8, A[2], 3.6, { color: s.c('teal'), weight: 600 });
        });
        line(s, 'split the layers into p stages', w / 2, A[1] + u * 2.5, A[2], 4, { color: s.c('--ink'), weight: 600 });
      });
    const gA = s.ease('idle', 0.5);
    if (gA <= 0) return;
    let run: PipeRun = PIPE_M1;
    let tc = PIPE_M1.total * s.prog('idle');
    let title = 'one batch: m = 1';
    if (s.since('micro') >= 0) {
      run = PIPE_GP;
      tc = PIPE_GP.total * s.span('micro', 'bubble');
      title = 'GPipe: m = 8 micro-batches';
    }
    if (s.since('onef') >= 0) {
      run = PIPE_1F;
      tc = PIPE_1F.total * s.span('onef', 'memory');
      title = '1F1B: m = 8';
    }
    const rect: Rect = [A[0], A[1] + u * 7, A[2], A[3] * 0.5];
    s.alpha(gA, () => {
      line(s, title, w / 2, A[1] + u * 2.5, A[2], 4, { color: s.c('--ink'), weight: 600 });
      gantt(s, rect, run, 4, tc, { stash: s.since('memory') >= 0 ? PIPE_1F.peakStash : undefined });
    });
    const by = A[1] + A[3] * 0.72;
    s.alpha(s.win('bubble', 'formula', 0.4), () => line(s, `red: idle, the bubble (${Math.round(PIPE_GP.idle * 100)}% here)`, w / 2, by, A[2], 3.8, { color: s.c('red'), weight: 600 }));
    s.show('bubble', s.win('formula', 'onef', 0.4) * (1 - s.ease('numbers', 0.5)));
    s.alpha(s.win('numbers', 'onef', 0.4), () => {
      const items: [string, K][] = [['m = 1: 75%', 'red'], ['m = 8: 27%', 'gold'], ['m = 32: 9%', 'green']];
      const size = fit(s, 'm = 1: 75%   m = 8: 27%   m = 32: 9%', A[2] * 0.85, 3.4, { font: 'mono', weight: 600 });
      const ws = items.map(([t]) => s.measure(t, { font: 'mono', size, weight: 600 }) + u * size * 0.95);
      let x = w / 2 - (ws.reduce((a, b) => a + b, 0) + u * 4) / 2;
      items.forEach(([t, k], i) => {
        s.alpha(s.ease('numbers', 0.4, i * 1.5), () => pill(s, t, x + ws[i]! / 2, by + u * 4, k, size));
        x += ws[i]! + u * 2;
      });
      line(s, 'idle share with 4 stages', w / 2, by + u * 11, A[2], 3.2, { italic: true, color: s.c('--ink-3') });
    });
    s.alpha(s.ease('memory', 0.5, 0.6) * (1 - s.ease('later', 0.4)), () => line(s, 'same bubble; GPipe would hold all 8 on every GPU', w / 2, by + u * 2, A[2], 3.6, { color: s.c('purple'), weight: 600 }));
    s.alpha(s.ease('later', 0.5), () => line(s, 'interleaved and zero-bubble schedules shrink it further', w / 2, by + u * 2, A[2], 3.6, { italic: true, color: s.c('--ink-2') }));
  },
};

// ---------------------------------------------------------------- 10. sequence, context, expert

const sequence: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const A = area(s);
    const iA = 1 - s.ease('seq', 0.5);
    if (iA > 0)
      s.alpha(iA, () => {
        const items: [string, string, Color][] = [['sequence', 'norms and dropouts, by token', 'teal'], ['context', 'one long sequence, many GPUs', 'orange'], ['expert', 'experts on different GPUs', 'purple']];
        const ch = Math.min(u * 15, A[3] * 0.22);
        const y0 = A[1] + (A[3] - 3 * ch - 2 * u * 3) / 2;
        items.forEach(([hd, nt, k], i) => card(s, A[0] + A[2] * 0.08, y0 + i * (ch + u * 3), A[2] * 0.84, ch, hd, nt, k, 0.3, s.ease('intro', 0.5, i * 0.4)));
      });
    // sequence parallelism: a token strip split four ways
    const sA = s.win('seq', 'ctx');
    if (sA > 0)
      s.alpha(sA, () => {
        const n = 16;
        const tw = A[2] / n;
        const y = A[1] + A[3] * 0.32;
        line(s, 'layer norm and dropout, inside a tensor group', w / 2, A[1] + u * 2.5, A[2], 4, { color: s.c('--ink'), weight: 600 });
        for (let i = 0; i < n; i++) {
          const g = Math.floor(i / 4);
          const split = s.ease('seq', 0.8, 2);
          s.rrect(A[0] + i * tw + 1, y, tw - 2, u * 9, 0.6, { fill: s.tint(split > 0.5 ? gpuColor(g) : 'slate', 0.25 + 0.4 * split), stroke: s.tint(split > 0.5 ? gpuColor(g) : 'slate', 0.8), lw: 0.2 });
        }
        s.alpha(s.ease('seq', 0.6, 2), () => {
          for (let g = 0; g < 4; g++) s.text(`GPU ${g}`, A[0] + (g * 4 + 2) * tw, y + u * 13, { size: 3, font: 'ui', weight: 650, color: s.c(gpuColor(g)) });
          line(s, 'each GPU keeps a quarter of the tokens', w / 2, y + u * 20, A[2], 3.6, { italic: true, color: s.c('--ink-2') });
        });
        s.alpha(s.ease('free', 0.6), () => {
          const yy = A[1] + A[3] * 0.78;
          const size = fit(s, 'all-reduce → reduce-scatter + all-gather', A[2] * 0.95, 3.4, { font: 'mono', weight: 600 });
          line(s, 'all-reduce → reduce-scatter + all-gather', w / 2, yy, A[2], size, { font: 'mono', weight: 600, color: s.c('teal'), italic: false });
          line(s, 'same traffic, smaller activations', w / 2, yy + u * 7, A[2], 3.6, { italic: true, color: s.c('--ink-2') });
        });
      });
    // context parallelism: keys and values travel around a ring
    const cA = s.win('ctx', 'ep');
    if (cA > 0)
      s.alpha(cA, () => {
        line(s, 'one long sequence across 4 GPUs', w / 2, A[1] + u * 2.5, A[2], 4, { color: s.c('--ink'), weight: 600 });
        const cx = w / 2;
        const cy = A[1] + A[3] * 0.55;
        const Rx = Math.min(A[2] * 0.34, u * 60);
        const Ry = A[3] * 0.3;
        const bw = Math.min(u * 26, A[2] * 0.3);
        const bh = u * 11;
        const pos = (i: number): [number, number] => [cx + Rx * Math.cos(-Math.PI / 2 + (i * Math.PI) / 2), cy + Ry * Math.sin(-Math.PI / 2 + (i * Math.PI) / 2)];
        s.ctx.beginPath();
        s.ctx.ellipse(cx, cy, Rx, Ry, 0, 0, Math.PI * 2);
        s.ctx.strokeStyle = s.c('--grid');
        s.ctx.lineWidth = u * 0.5;
        s.ctx.stroke();
        for (let i = 0; i < 4; i++) {
          const [x, y] = pos(i);
          gpu(s, x - bw / 2, y - bh / 2, bw, bh, `GPU ${i}`, gpuColor(i), 0.2);
          pill(s, `Q${i}`, x, y + u * 1.6, 'teal', 2.8);
        }
        const rot = s.since('ringattn') > 0 ? s.since('ringattn') * 0.35 : 0;
        s.alpha(s.ease('ringattn', 0.5), () => {
          for (let i = 0; i < 4; i++) {
            const ph = (i + rot) % 4;
            const a = -Math.PI / 2 + (ph * Math.PI) / 2;
            const x = cx + Rx * 0.42 * Math.cos(a);
            const y = cy + Ry * 0.4 * Math.sin(a);
            pill(s, `KV${i}`, x, y, 'gold', 3);
          }
          s.text('K, V blocks', cx, cy, { size: 2.8, italic: true, color: s.c('--ink-3') });
        });
        s.alpha(s.ease('ringattn', 0.5, 3), () => line(s, 'ring attention: keys and values travel, queries stay', w / 2, A[1] + A[3] * 0.98, A[2], 3.4, { italic: true, color: s.c('--ink-2') }));
      });
    // expert parallelism
    const eA = s.ease('ep', 0.6);
    if (eA > 0)
      s.alpha(eA, () => {
        line(s, 'experts on 4 GPUs, tokens routed all-to-all', w / 2, A[1] + u * 2.5, A[2], 4, { color: s.c('--ink'), weight: 600 });
        const gw = (A[2] - u * 3 * 3) / 4;
        const gy = A[1] + A[3] * 0.56;
        const gh = A[3] * 0.32;
        const tokY = A[1] + A[3] * 0.2;
        const nTok = 12;
        const route = [0, 5, 2, 7, 3, 1, 6, 4, 2, 5, 0, 7];
        const ex = (e: number): [number, number] => {
          const g = Math.floor(e / 2);
          const x = A[0] + g * (gw + u * 3);
          return [x + gw * (e % 2 === 0 ? 0.28 : 0.72), gy + gh * 0.6];
        };
        for (let g = 0; g < 4; g++) {
          const x = A[0] + g * (gw + u * 3);
          gpu(s, x, gy, gw, gh, `GPU ${g}`, 'purple', 0.15);
        }
        for (let e = 0; e < 8; e++) {
          const [x, y] = ex(e);
          s.rrect(x - gw * 0.18, y - u * 4, gw * 0.36, u * 8, 1, { fill: s.tint('purple', 0.2), stroke: s.c('purple'), lw: 0.3 });
          s.text(`E${e}`, x, y, { size: 2.9, font: 'mono', weight: 650, color: s.c('purple') });
        }
        for (let i = 0; i < nTok; i++) {
          const tx = A[0] + ((i + 0.5) / nTok) * A[2];
          const [x, y] = ex(route[i]!);
          const p = s.ease('ep', 1.2, 1 + i * 0.25);
          s.alpha(p, () => s.line(tx, tokY + u * 2, lerp(tx, x, p), lerp(tokY + u * 2, y - u * 4, p), s.tint('orange', 0.5), 0.3));
          s.circle(tx, tokY, u * 1.6, { fill: s.c('orange') });
        }
        s.text('tokens', A[0], tokY - u * 4.5, { size: 3, align: 'left', color: s.c('--ink-3') });
      });
  },
};

// ---------------------------------------------------------------- 11. 3-D parallelism

const threed: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const A = area(s);
    const TPn = 4;
    const DPn = 4;
    const gA = 1 - s.ease('llama', 0.6);
    const tpA = s.ease('tp', 0.6);
    const ppA = s.ease('pp', 0.6);
    const dpA = s.ease('dp', 0.6);
    const nodeCols = s.w / s.h > 1.5 ? 4 : 2;
    const nodeRows = 4 / nodeCols;
    const ngap = u * 2.5;
    const gridH = A[3] * (nodeCols === 2 ? 0.82 : 0.62);
    const nodeW = (A[2] - ngap * (nodeCols - 1)) / nodeCols;
    const nodeH = (gridH - ngap * (nodeRows - 1)) / nodeRows;
    const gs = Math.min((nodeW - u * 6) / 4.4, (nodeH - u * 8) / 2.5);
    const at: [number, number][] = [];
    s.alpha(gA, () => {
      for (let n = 0; n < 4; n++) {
        const nx = A[0] + (n % nodeCols) * (nodeW + ngap);
        const ny = A[1] + u * 2 + Math.floor(n / nodeCols) * (nodeH + ngap);
        s.rrect(nx, ny, nodeW, nodeH, 1.6, { fill: s.tint('--ink-3', 0.05), stroke: s.c('--rule'), lw: 0.25 });
        s.text(`server ${n}`, nx + u * 1.5, ny + u * 2.6, { size: 2.8, align: 'left', font: 'ui', weight: 600, color: s.c('--ink-3') });
        for (let j = 0; j < 8; j++) {
          const r = n * 8 + j;
          const cc = coords3d(r, TPn, DPn);
          const x = nx + (nodeW - (4 * gs + 3 * gs * 0.3)) / 2 + (j % 4) * gs * 1.3;
          const y = ny + u * 5 + (nodeH - u * 5 - (2 * gs + gs * 0.3)) / 2 + Math.floor(j / 4) * gs * 1.3;
          at[r] = [x + gs / 2, y + gs / 2];
          s.rrect(x, y, gs, gs, 0.8, { fill: s.tint(gpuColor(cc.dp), 0.18), stroke: s.tint(gpuColor(cc.dp), 0.7), lw: 0.25 });
          s.text(`d${cc.dp}p${cc.pp}`, x + gs / 2, y + gs / 2, { size: Math.min(2.6, gs / u / 3.2), font: 'mono', weight: 600 });
        }
        if (tpA > 0)
          s.alpha(tpA, () => {
            for (let row = 0; row < 2; row++) {
              const x = nx + (nodeW - (4 * gs + 3 * gs * 0.3)) / 2 - u * 0.8;
              const y = ny + u * 5 + (nodeH - u * 5 - (2 * gs + gs * 0.3)) / 2 + row * gs * 1.3 - u * 0.8;
              s.rrect(x, y, 4 * gs + 3 * gs * 0.3 + u * 1.6, gs + u * 1.6, 1, { stroke: s.c('blue'), lw: 0.45 });
            }
          });
      }
      if (ppA > 0)
        s.alpha(ppA, () => {
          for (let r = 0; r < 16; r += 5) {
            const [x0, y0] = at[r]!;
            const [x1, y1] = at[r + 16]!;
            s.arrow(x0, y0, x1, y1, s.c('purple'), 0.45, 2.2);
          }
        });
      if (dpA > 0)
        s.alpha(dpA, () => {
          const grp = [1, 5, 9, 13].map((r) => at[r]!);
          s.ctx.beginPath();
          grp.forEach(([x, y], i) => (i ? s.ctx.lineTo(x, y) : s.ctx.moveTo(x, y)));
          s.ctx.closePath();
          s.ctx.strokeStyle = s.c('green');
          s.ctx.lineWidth = u * 0.4;
          s.ctx.setLineDash([u * 1.2, u * 0.9]);
          s.ctx.stroke();
          s.ctx.setLineDash([]);
        });
    });
    caption(
      s,
      {
        compose: 'TP 4 × PP 2 × DP 4 = 32 GPUs',
        tp: 'blue: tensor groups, inside a server',
        pp: 'purple: pipeline stages, across servers',
        dp: 'green: data-parallel copies, outermost',
        llama: '',
      },
      A[1] + A[3] * 0.95,
      { size: 3.8, color: '--ink', italic: false },
    );
    const cA = s.win('llama', 'mfu');
    if (cA > 0)
      s.alpha(cA, () => {
        const cw = A[2] * (s.tall ? 1 : 0.8);
        const cx = w / 2 - cw / 2;
        const ch = u * 17;
        card(s, cx, A[1] + A[3] * 0.18, cw, ch, 'Llama 3 405B: TP 8 × PP 16 × DP 128', '16,384 H100s, FSDP for the data axis', 'blue', 0.5);
        card(s, cx, A[1] + A[3] * 0.18 + ch + u * 4, cw, ch, 'DeepSeek-V3: no TP, PP 16, EP 64', 'ZeRO-1 data parallel, 2,048 H800s', 'purple', 0.5, s.ease('deepseek', 0.5));
      });
    const mA = s.ease('mfu', 0.6);
    if (mA > 0)
      s.alpha(mA, () => {
        const bx = A[0] + u * 2;
        const bw = A[2] - u * 4;
        const by = A[1] + A[3] * 0.45;
        const bh = u * 10;
        s.rrect(bx, by, bw, bh, 1.5, { fill: s.tint('--ink-3', 0.08), stroke: s.c('--rule'), lw: 0.25 });
        const f = 0.4 * s.ease('mfu', 1.2, 0.8);
        s.rrect(bx, by, bw * f, bh, 1.5, { fill: s.tint('green', 0.7) });
        s.alpha(s.ease('forty', 0.5), () => hatch(s, bx + bw * 0.4, by, bw * 0.6, bh, s.tint('red', 0.4), 1.6));
        line(s, 'model FLOPs utilization', w / 2, by - u * 6, A[2], 4.4, { font: 'display', weight: 620 });
        s.alpha(s.ease('mfu', 0.5, 2), () => s.text('≈ 40%', bx + bw * 0.4 - u * 1.5, by + bh / 2, { size: 4, align: 'right', font: 'mono', weight: 700 }));
        s.alpha(s.ease('forty', 0.5), () => line(s, 'lost to bubbles, waiting, recompute', bx + bw * 0.7, by + bh + u * 4.5, bw * 0.6, 3.2, { italic: true, color: s.c('red') }));
      });
  },
};

// ---------------------------------------------------------------- 12. outro

const RECAP: { head: string; note: string; k: Color; beat: string }[] = [
  { head: '16 bytes per parameter', note: 'plus activations', k: 'gold', beat: 'mem' },
  { head: 'checkpointing', note: '+1/3 compute, far less memory', k: 'orange', beat: 'ckpt' },
  { head: 'data parallel', note: 'ring all-reduce, 2(N − 1)/N', k: 'green', beat: 'dp' },
  { head: 'ZeRO / FSDP', note: 'shard the state', k: 'gold', beat: 'zero' },
  { head: 'tensor', note: 'columns then rows, in a server', k: 'blue', beat: 'tp' },
  { head: 'pipeline', note: 'bubble (p − 1)/(m + p − 1)', k: 'purple', beat: 'pp' },
];

const outro: SceneDef = {
  draw(s) {
    const { w, h, u } = s;
    const A = area(s);
    const cur = current(s, RECAP.map((r) => r.beat));
    const lA = 1 - s.ease('wire', 0.6);
    s.alpha(s.ease('recap', 0.5) * (1 - s.ease('mem', 0.4)), () => line(s, 'the whole picture', w / 2, A[1] + A[3] * 0.5, A[2], 7, { font: 'display', weight: 620 }));
    if (lA > 0)
      s.alpha(lA, () => {
        const cols = s.tall ? 1 : 2;
        const rows = 6 / cols;
        const gap = u * 2;
        const cw = (A[2] - gap * (cols - 1)) / cols;
        const ch = Math.min(u * 15, (A[3] - gap * (rows - 1)) / rows);
        const top = A[1] + (A[3] - (rows * ch + (rows - 1) * gap)) / 2;
        RECAP.forEach((r, i) => {
          const a = s.ease(r.beat, 0.5);
          if (a <= 0) return;
          const col = cols === 1 ? 0 : Math.floor(i / rows);
          const row = cols === 1 ? i : i % rows;
          card(s, A[0] + col * (cw + gap), top + row * (ch + gap), cw, ch, r.head, r.note, r.k, cur === r.beat ? 1 : 0.15, a);
        });
      });
    const wA = s.ease('wire', 0.6);
    if (wA > 0)
      s.alpha(wA, () => {
        const links: [string, string, number, Color][] = [
          ['NVLink, in a server', 'tensor', 450, 'green'],
          ['InfiniBand, between servers', 'pipeline, data', 50, 'teal'],
        ];
        const by = A[1] + A[3] * 0.14;
        const bwMax = A[2] - u * 18;
        links.forEach(([name, who, gbs, k], i) => {
          const y = by + i * A[3] * 0.22;
          const a = s.ease('wire', 0.6, 0.8 + i * 0.8);
          s.rrect(A[0], y, Math.max(u * 2, bwMax * (gbs / 450) * a), u * 7, 1, { fill: s.tint(k, 0.6) });
          s.text(`${gbs} GB/s`, A[0] + Math.max(u * 2, bwMax * (gbs / 450) * a) + u * 1.5, y + u * 3.5, { size: 3, align: 'left', font: 'mono', weight: 650 });
          s.text(`${name}: ${who}`, A[0], y - u * 2.6, { size: fit(s, `${name}: ${who}`, A[2], 3.3), align: 'left', color: s.c('--ink-2'), weight: 600 });
        });
        line(s, 'heavier, less hideable traffic gets the faster wire', w / 2, A[1] + A[3] * 0.57, A[2], 3.8, { italic: true, color: s.c('--ink-2') });
        s.alpha(s.ease('bye', 0.6), () => {
          line(s, 'Memory decides what must be split.', w / 2, A[1] + A[3] * 0.75, A[2], 5, { font: 'display', weight: 620 });
          line(s, 'Bandwidth decides where each split lives.', w / 2, A[1] + A[3] * 0.87, A[2], 5, { font: 'display', weight: 620, color: s.c('teal') });
        });
      });
  },
};

export const scenes: Record<string, SceneDef> = { intro, memory, activations, data, ring, overlap, zero, tensor, pipeline, sequence, threed, outro };

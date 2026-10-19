import type { Fig } from '../core/page';
import { fmt } from '../core/code';
import { color, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import type { Color } from '../core/symbols';
import { cellBox, haloText, ital, mono, ui } from './math-kit-draw';
import * as M from './modern-transformer-math';

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** Gives a canvas a fixed CSS height instead of an aspect ratio, for layouts measured in px. */
function fixHeight(c: HTMLCanvasElement, px: number): void {
  c.style.aspectRatio = 'auto';
  c.style.height = `${px}px`;
}

/** 0.000512 -> "5.1e-4", 0.42 -> "0.42". */
function sci(v: number): string {
  if (v === 0) return '0';
  if (Math.abs(v) >= 0.01) return fmt(v, 2);
  return v.toExponential(1);
}

function roundBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string, stroke: string, lw = 1): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lw;
  ctx.stroke();
}

function arrowPx(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col: string, lw = 1.5, head = 7): void {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.strokeStyle = ctx.fillStyle = col;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1 - Math.cos(a) * head * 0.7, y1 - Math.sin(a) * head * 0.7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(a - 0.42), y1 - head * Math.sin(a - 0.42));
  ctx.lineTo(x1 - head * Math.cos(a + 0.42), y1 - head * Math.sin(a + 0.42));
  ctx.closePath();
  ctx.fill();
}

// ---------------------------------------------------------------- Fig: the block, then and now

interface Part {
  id: string;
  kind: 'io' | 'branch' | 'stream' | 'plus';
  row: number;
  branch?: number;
  label: string;
  sub?: string;
  k: Color;
  lines: string[];
  note: string;
}

const S = '#/modern-transformer';

const MODERN: Part[] = [
  { id: 'in', kind: 'io', row: 0, label: 'x in', k: 'orange', lines: [], note: '**The residual stream** enters the block. No position vector was ever added to it: positions arrive through RoPE, inside attention.' },
  { id: 'norm1', kind: 'branch', branch: 0, row: 1, label: 'RMSNorm', sub: 'pre-norm', k: 'slate', lines: ['norm1'], note: `**RMSNorm, before the sub-block.** Only the copy going into attention is normalized; the stream itself is never rescaled. [Why pre-norm](${S}/pre-norm), [why RMS](${S}/rmsnorm).` },
  { id: 'qkv', kind: 'branch', branch: 0, row: 2, label: 'Wq  Wk  Wv', sub: 'fewer K, V heads (GQA)', k: 'blue', lines: ['qkv'], note: `**Query, key and value projections, with no biases.** Groups of query heads share one key and value head, which shrinks the KV cache. [More](${S}/gqa)` },
  { id: 'qknorm', kind: 'branch', branch: 0, row: 3, label: 'QK-norm', sub: 'RMSNorm on q and k', k: 'teal', lines: ['qknorm'], note: `**QK-norm.** Every query and key is normalized, so attention scores cannot grow without bound. [More](${S}/stability)` },
  { id: 'rope', kind: 'branch', branch: 0, row: 4, label: 'RoPE', sub: 'rotate q, k by position', k: 'red', lines: ['rope'], note: `**Rotary positions.** Queries and keys are rotated by angles proportional to their position, in every layer. [More](${S}/rope)` },
  { id: 'attn', kind: 'branch', branch: 0, row: 5, label: 'causal attention', sub: 'FlashAttention, in tiles', k: 'purple', lines: ['attn'], note: `**Causal attention, computed in tiles.** FlashAttention gives exactly the same output without ever storing the T x T score matrix. [More](${S}/flash)` },
  { id: 'plus1', kind: 'plus', branch: 0, row: 6, label: '+', k: 'orange', lines: ['attn'], note: '**Add back into the stream**, through the output projection `Wo`. The stream is a running sum of everything the sub-blocks write.' },
  { id: 'norm2', kind: 'branch', branch: 1, row: 7, label: 'RMSNorm', sub: 'pre-norm', k: 'slate', lines: ['norm2'], note: `**RMSNorm again**, on the copy going into the MLP. [More](${S}/rmsnorm)` },
  { id: 'mlp', kind: 'branch', branch: 1, row: 8, label: 'SwiGLU MLP', sub: 'silu(h W1) * (h W3), then W2', k: 'gold', lines: ['mlp'], note: `**SwiGLU.** Three matrices: a SiLU-gated path multiplied by a plain linear path, then projected back down. [More](${S}/swiglu)` },
  { id: 'plus2', kind: 'plus', branch: 1, row: 9, label: '+', k: 'orange', lines: ['mlp'], note: '**Add back again.** After the last block, one final RMSNorm feeds the unembedding.' },
  { id: 'out', kind: 'io', row: 10, label: 'x out', k: 'orange', lines: [], note: 'The stream leaves the block exactly as large as the sum of its writes: nothing on the main path rescales it.' },
];

const OLD: Part[] = [
  { id: 'in', kind: 'io', row: 0, label: 'x in', sub: 'embeddings + sinusoidal positions', k: 'orange', lines: [], note: '**The input**: token embeddings plus sinusoidal position vectors, added once, at the bottom of the stack.' },
  { id: 'qkv', kind: 'branch', branch: 0, row: 1, label: 'Wq  Wk  Wv', sub: 'with biases, all heads', k: 'blue', lines: ['o_attn'], note: '**Query, key and value projections**, each with a bias, and a separate key and value head for every query head.' },
  { id: 'attn', kind: 'branch', branch: 0, row: 2, label: 'attention', sub: 'full T x T matrix', k: 'purple', lines: ['o_attn'], note: '**Attention**: a softmax over the full T x T matrix of scores, written to memory and read back.' },
  { id: 'plus1', kind: 'plus', branch: 0, row: 3, label: '+', k: 'orange', lines: ['o_norm1'], note: '**Add**: the residual connection.' },
  { id: 'norm1', kind: 'stream', row: 4, label: 'LayerNorm', k: 'slate', lines: ['o_norm1'], note: `**LayerNorm on the stream itself** (post-norm): after every sub-block, the whole running sum is re-centered and rescaled. [Why it moved](${S}/pre-norm)` },
  { id: 'mlp', kind: 'branch', branch: 1, row: 5, label: 'ReLU MLP', sub: 'relu(x W1 + b1) W2 + b2', k: 'gold', lines: ['o_mlp'], note: '**ReLU MLP**: two matrices with biases, hidden width 4d.' },
  { id: 'plus2', kind: 'plus', branch: 1, row: 6, label: '+', k: 'orange', lines: ['o_norm2'], note: '**Add**: the second residual connection.' },
  { id: 'norm2', kind: 'stream', row: 7, label: 'LayerNorm', k: 'slate', lines: ['o_norm2'], note: '**LayerNorm on the stream** again, after the MLP.' },
  { id: 'out', kind: 'io', row: 8, label: 'x out', k: 'orange', lines: [], note: 'The stream leaves the block normalized: every block rescales everything below it.' },
];

export function setupBlock(f: Fig): void {
  let which: 'old' | 'new' = 'new';
  let sel = 'attn';
  let rects: { id: string; x: number; y: number; w: number; h: number }[] = [];
  const parts = () => (which === 'new' ? MODERN : OLD);
  const cv = f.canvas(600, 640, (ctx, w, h) => {
    const P = parts();
    const rows = Math.max(...P.map((p) => p.row)) + 1;
    const top = 26;
    const bot = 22;
    const rh = (h - top - bot) / (rows - 1);
    const Y = (r: number) => h - bot - r * rh;
    const sx = w * 0.15;
    const bx = w * 0.33;
    const bw = w * 0.63;
    const bh = Math.min(rh * 0.78, 50);
    const fs = Math.max(12, Math.min(15, w / 36));
    rects = [];
    // the stream
    ctx.strokeStyle = color('orange');
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(sx, Y(0) - 8);
    ctx.lineTo(sx, Y(rows - 1) + 14);
    ctx.stroke();
    arrowPx(ctx, sx, Y(rows - 1) + 16, sx, Y(rows - 1) + 4, color('orange'), 3.5, 10);
    // branch wiring
    for (const b of [0, 1]) {
      const bp = P.filter((p) => p.branch === b).sort((a, c) => a.row - c.row);
      const boxes = bp.filter((p) => p.kind === 'branch');
      const plus = bp.find((p) => p.kind === 'plus')!;
      const first = boxes[0]!;
      const cx = bx + bw / 2;
      ctx.fillStyle = color('orange');
      ctx.beginPath();
      ctx.arc(sx, Y(first.row), 4.5, 0, Math.PI * 2);
      ctx.fill();
      arrowPx(ctx, sx, Y(first.row), bx - 2, Y(first.row), withAlpha(color('--ink-2'), 0.8), 1.6);
      for (let i = 1; i < boxes.length; i++) arrowPx(ctx, cx, Y(boxes[i - 1]!.row) - bh / 2, cx, Y(boxes[i]!.row) + bh / 2 + 1, withAlpha(color('--ink-2'), 0.8), 1.6, 6);
      const last = boxes[boxes.length - 1]!;
      ctx.strokeStyle = withAlpha(color('--ink-2'), 0.8);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx, Y(last.row) - bh / 2);
      ctx.lineTo(cx, Y(plus.row));
      ctx.stroke();
      arrowPx(ctx, cx, Y(plus.row), sx + 13, Y(plus.row), withAlpha(color('--ink-2'), 0.8), 1.6);
    }
    for (const p of P) {
      const y = Y(p.row);
      const on = p.id === sel;
      const col = color(p.k);
      if (p.kind === 'io') {
        const lab = p.label + (p.sub ? `   ${p.sub}` : '');
        haloText(ctx, lab, sx + 12, p.row === 0 ? y + 2 : y + 10, on ? color('--ink') : color('--ink-2'), ui(fs - 1, on ? 650 : 500), 'left', 'middle');
        rects.push({ id: p.id, x: 0, y: y - 12, w: w * 0.8, h: 24 });
      } else if (p.kind === 'plus') {
        ctx.beginPath();
        ctx.arc(sx, y, 12, 0, Math.PI * 2);
        ctx.fillStyle = on ? withAlpha(col, 0.35) : color('--card');
        ctx.fill();
        ctx.strokeStyle = col;
        ctx.lineWidth = on ? 3 : 2;
        ctx.stroke();
        ctx.fillStyle = color('--ink');
        ctx.font = mono(16, 600);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('+', sx, y + 1);
        rects.push({ id: p.id, x: sx - 18, y: y - 18, w: 36, h: 36 });
      } else {
        const x0 = p.kind === 'stream' ? sx - w * 0.13 : bx;
        const ww = p.kind === 'stream' ? w * 0.26 : bw;
        roundBox(ctx, x0, y - bh / 2, ww, bh, 8, color('--card'), color('--card'), 0);
        roundBox(ctx, x0, y - bh / 2, ww, bh, 8, withAlpha(col, on ? 0.3 : 0.11), on ? col : withAlpha(col, 0.6), on ? 2.5 : 1.2);
        ctx.fillStyle = color('--ink');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const two = !!p.sub && bh > fs * 2.3;
        ctx.font = ui(fs, 650);
        ctx.fillText(p.label, x0 + ww / 2, two ? y - fs * 0.5 : y);
        if (two) {
          ctx.fillStyle = color('--ink-2');
          ctx.font = ui(Math.max(11, fs - 2.5), 450);
          ctx.fillText(p.sub!, x0 + ww / 2, y + fs * 0.62);
        }
        rects.push({ id: p.id, x: x0, y: y - bh / 2, w: ww, h: bh });
      }
    }
    ctx.fillStyle = color('--ink-3');
    ctx.font = ital(13, 500);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('residual stream', sx - 8, 4);
  });
  cv.canvas.classList.add('scroll-ok');
  const pick = (id: string) => {
    sel = id;
    const p = parts().find((q) => q.id === id) ?? parts()[0]!;
    f.code.highlight(p.lines.length ? p.lines : which);
    f.status(p.note);
    cv.redraw();
  };
  cv.canvas.addEventListener('click', (e) => {
    const r = cv.canvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const hit = rects.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h);
    if (hit) pick(hit.id);
  });
  f.segmented({
    label: 'block',
    options: [
      { value: 'old', label: '2017 (post-norm)' },
      { value: 'new', label: 'modern (2024)' },
    ],
    value: 'new',
    onChange: (v) => {
      which = v as 'old' | 'new';
      pick(parts().some((p) => p.id === sel) ? sel : 'attn');
    },
  });
  pick('attn');
}

// ---------------------------------------------------------------- Fig: the residual highway

export function setupHighway(f: Fig): void {
  let L = 24;
  let beta = 1;
  let mode: 'post' | 'pre' = 'post';
  let res = { post: M.highway(L, 'post', beta), pre: M.highway(L, 'pre', beta) };
  const sup = (n: number) => String(n).replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]!);
  const pl = f.plot({
    aspect: 1.35,
    square: false,
    domain: [-1, L + 1, -10, 1.2],
    draw: (p) => {
      const minLog = Math.min(...res.post.reach.map((v) => Math.log10(v)));
      const step = minLog < -12 ? 4 : 2;
      const LO = Math.min(-8, Math.floor(minLog / step) * step) - 0.6;
      const pad = (LO - 1.2) * -0.1;
      const x0 = -0.6 - ((36 / Math.max(1, p.w)) * (L + 1.8)) / (1 - 36 / Math.max(1, p.w));
      p.setDomain(x0, L + 1.2, LO - pad, 1.2);
      const ctx = p.ctx;
      for (let e = 0; e >= LO; e -= step) {
        p.path([x0, L + 1.2], [e, e], color('--grid'), 1);
        haloText(ctx, e === 0 ? '1' : `10⁻${sup(-e)}`, 4, p.sy(e), color('--ink-3'), mono(11), 'left', 'middle');
      }
      const bw = 0.72;
      const other = res[mode === 'post' ? 'pre' : 'post'].reach;
      const xs: number[] = [];
      const ys: number[] = [];
      for (let l = 0; l <= L; l++) {
        const lv = Math.max(LO, Math.log10(other[l]!));
        xs.push(l - 0.5, l + 0.5);
        ys.push(lv, lv);
      }
      const cur = res[mode].reach;
      for (let l = 0; l <= L; l++) {
        const lv = Math.max(LO, Math.log10(cur[l]!));
        const bx0 = p.sx(l - bw / 2);
        const bx1 = p.sx(l + bw / 2);
        const col = color(l === 0 ? 'slate' : 'orange');
        ctx.fillStyle = withAlpha(col, 0.75);
        ctx.fillRect(bx0, p.sy(lv), Math.max(1, bx1 - bx0), p.sy(LO) - p.sy(lv));
      }
      p.path(xs, ys, withAlpha(color('--ink-2'), 0.75), 1.5, [4, 3]);
      p.text('embedding', 0, LO - pad * 0.75, { size: 11, color: color('slate'), align: 'left' });
      p.text(`layer ${L}`, L, LO - pad * 0.75, { size: 11, color: color('--ink-2'), align: 'right' });
      haloText(ctx, mode === 'post' ? 'post-norm: each LayerNorm shrinks everything below it' : 'pre-norm: every write arrives with weight 1', p.sx(L + 1) - 4, p.sy(0) - 14, color('--ink-2'), ui(11.5, 500), 'right');
    },
  });
  const r0Ro = f.readout('embedding at the top');
  const rmsRo = f.readout('stream RMS at the top');
  const sync = () => {
    res = { post: M.highway(L, 'post', beta), pre: M.highway(L, 'pre', beta) };
    const r = res[mode];
    r0Ro.set(sci(r.reach[0]!));
    rmsRo.set(fmt(r.rms[L - 1]!, 3));
    f.code.setMany({ r0: sci(r.reach[0]!), rms: fmt(r.rms[L - 1]!, 3) });
    f.code.highlight(mode);
    pl.redraw();
  };
  f.segmented({
    label: 'norm',
    options: [
      { value: 'post', label: 'post-norm' },
      { value: 'pre', label: 'pre-norm' },
    ],
    value: 'post',
    slot: 'mode',
    onChange: (v) => {
      mode = v as 'post' | 'pre';
      sync();
    },
  });
  f.slider({ label: 'depth L', min: 2, max: 96, step: 1, value: L, slot: 'L', onInput: (v) => { L = v; sync(); } });
  f.slider({ label: 'branch scale β', min: 0.1, max: 1.5, step: 0.05, value: 1, slot: 'beta', format: (v) => fmt(v, 2), onInput: (v) => { beta = v; sync(); } });
  sync();
}

// ---------------------------------------------------------------- Fig: LayerNorm versus RMSNorm

export function setupNorms(f: Fig): void {
  const x0 = [1.2, -0.4, 2.1, 0.3, -1.1, 0.8, 1.6, -0.2];
  let a = 1;
  let c = 0;
  const xs = () => x0.map((t) => a * t + c);
  const bands: { label: string; k: Color; range: number; vals: () => number[] }[] = [
    { label: 'x', k: 'orange', range: 0, vals: xs },
    { label: 'LayerNorm(x)', k: 'slate', range: 3, vals: () => M.layerNorm(xs()) },
    { label: 'RMSNorm(x)', k: 'blue', range: 3, vals: () => M.rmsNorm(xs()) },
  ];
  let geom = { top: 0, bh: 0, left: 0, cw: 0 };
  const xRange = () => Math.max(4.5, Math.max(...xs().map(Math.abs)) * 1.4);
  const cv = f.canvas(640, 500, (ctx, w, h) => {
    const bh = h / 3;
    bands[0]!.range = xRange();
    const left = 8;
    const cw = (w - left - 8) / 8;
    geom = { top: 0, bh, left, cw };
    bands.forEach((b, bi) => {
      const y0 = bi * bh;
      const lab = 20;
      const mid = y0 + lab + (bh - lab - 6) / 2;
      const half = (bh - lab - 10) / 2;
      ctx.fillStyle = color(b.k);
      ctx.font = bi === 0 ? ital(15, 650) : mono(13, 600);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(b.label, left, y0 + 3);
      const vals = b.vals();
      const mu = M.mean(vals);
      const rms = Math.sqrt(M.mean(vals.map((t) => t * t)));
      ctx.fillStyle = color('--ink-3');
      ctx.font = mono(11.5);
      ctx.textAlign = 'right';
      ctx.fillText(`mean ${fmt(Math.abs(mu) < 1e-9 ? 0 : mu, 2)}   rms ${fmt(rms, 3)}`, w - 8, y0 + 5);
      ctx.strokeStyle = color('--axis');
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left, mid);
      ctx.lineTo(w - 8, mid);
      ctx.stroke();
      vals.forEach((t, j) => {
        const v = clamp(t, -b.range, b.range);
        const x = left + j * cw + cw * 0.18;
        const bw = cw * 0.64;
        const yy = mid - (v / b.range) * half;
        ctx.fillStyle = withAlpha(color(b.k), 0.7);
        ctx.fillRect(x, Math.min(mid, yy), bw, Math.abs(yy - mid));
        if (Math.abs(t) > b.range) {
          const dir = t > 0 ? -1 : 1;
          ctx.fillStyle = color(b.k);
          ctx.beginPath();
          ctx.moveTo(x + bw / 2, yy + dir * 7);
          ctx.lineTo(x + bw / 2 - 5, yy);
          ctx.lineTo(x + bw / 2 + 5, yy);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = color('--ink-2');
        ctx.font = mono(11);
        ctx.textAlign = 'center';
        ctx.textBaseline = t >= 0 ? 'bottom' : 'top';
        ctx.fillText(fmt(t, 2), x + bw / 2, yy + (t >= 0 ? -2 : 2) + (Math.abs(t) > b.range ? (t > 0 ? -7 : 7) : 0));
      });
      if (bi < 2) {
        ctx.strokeStyle = color('--rule');
        ctx.beginPath();
        ctx.moveTo(0, y0 + bh);
        ctx.lineTo(w, y0 + bh);
        ctx.stroke();
      }
    });
  });
  const muRo = f.readout('mean of x');
  const rRo = f.readout('rms of x');
  const sync = () => {
    const x = xs();
    const mu = M.mean(x);
    const r = Math.sqrt(M.mean(x.map((t) => t * t)));
    muRo.set(fmt(mu, 3));
    rRo.set(fmt(r, 3));
    f.code.setMany({ xa: x0.slice(0, 4).map((t) => fmt(t, 2)).join(', '), xb: x0.slice(4).map((t) => fmt(t, 2)).join(', '), mu: fmt(mu, 3), r: fmt(r, 3) });
    cv.redraw();
  };
  let drag = -1;
  const setFrom = (e: PointerEvent) => {
    const r = cv.canvas.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    if (drag < 0) {
      if (py > geom.bh) return;
      drag = clamp(Math.floor((px - geom.left) / geom.cw), 0, 7);
      bands[0]!.range = xRange();
    }
    const lab = 20;
    const mid = lab + (geom.bh - lab - 6) / 2;
    const half = (geom.bh - lab - 10) / 2;
    const v = clamp(((mid - py) / half) * bands[0]!.range, -bands[0]!.range, bands[0]!.range);
    x0[drag] = Math.round(((v - c) / a) * 10) / 10;
    f.code.highlight(['ln', 'rms']);
    sync();
  };
  cv.canvas.addEventListener('pointerdown', (e) => {
    drag = -1;
    setFrom(e);
    if (drag >= 0) cv.canvas.setPointerCapture(e.pointerId);
  });
  cv.canvas.addEventListener('pointermove', (e) => drag >= 0 && setFrom(e));
  cv.canvas.addEventListener('pointerup', () => (drag = -1));
  f.slider({ label: 'scale a', min: 0.25, max: 3, step: 0.05, value: 1, slot: 'a', format: (v) => fmt(v, 3), onInput: (v) => { a = v; f.code.highlight(['ln', 'rms']); sync(); } });
  f.slider({ label: 'shift c', min: -3, max: 3, step: 0.1, value: 0, slot: 'c', format: (v) => fmt(v, 2), onInput: (v) => { c = v; f.code.highlight(['ln']); sync(); } });
  sync();
}

// ---------------------------------------------------------------- Fig: RoPE

export function setupRope(f: Fig): void {
  const d = 16;
  const theta = M.ropeTheta(d);
  const r = new Rng(21);
  const q = Array.from({ length: d }, () => r.randn());
  const k = Array.from({ length: d }, () => r.randn());
  let m = 3;
  let n = 7;
  let t = 0;
  let pair = 0;
  const pl = f.plot({
    aspect: 1.2,
    domain: [-1.3, 1.3, -1.25, 1.25],
    draw: (p) => {
      const ctx = p.ctx;
      p.axes({ grid: 0.5 });
      ctx.strokeStyle = withAlpha(color('--ink-3'), 0.5);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.sx(0), p.sy(0), p.len(1), 0, Math.PI * 2);
      ctx.stroke();
      const qm = M.rope(q, m + t, theta);
      const kn = M.rope(k, n + t, theta);
      const i = pair;
      const sc = 1 / Math.max(Math.hypot(q[2 * i]!, q[2 * i + 1]!), Math.hypot(k[2 * i]!, k[2 * i + 1]!));
      const Q0 = [q[2 * i]! * sc, q[2 * i + 1]! * sc];
      const K0 = [k[2 * i]! * sc, k[2 * i + 1]! * sc];
      const Q1 = [qm[2 * i]! * sc, qm[2 * i + 1]! * sc];
      const K1 = [kn[2 * i]! * sc, kn[2 * i + 1]! * sc];
      p.path([0, Q0[0]!], [0, Q0[1]!], withAlpha(color('teal'), 0.45), 1.5, [4, 4]);
      p.path([0, K0[0]!], [0, K0[1]!], withAlpha(color('green'), 0.45), 1.5, [4, 4]);
      // the angle between the rotated pair
      const aq = Math.atan2(Q1[1]!, Q1[0]!);
      let ak = Math.atan2(K1[1]!, K1[0]!);
      while (ak - aq > Math.PI) ak -= 2 * Math.PI;
      while (ak - aq < -Math.PI) ak += 2 * Math.PI;
      ctx.strokeStyle = color('purple');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.sx(0), p.sy(0), p.len(0.32), -aq, -ak, ak > aq);
      ctx.stroke();
      p.arrow(0, 0, Q1[0]!, Q1[1]!, color('teal'), 3);
      p.arrow(0, 0, K1[0]!, K1[1]!, color('green'), 3);
      const lab = (v: number[], s: string, col: string) => {
        const L = Math.hypot(v[0]!, v[1]!) || 1;
        haloText(ctx, s, p.sx(v[0]! + (v[0]! / L) * 0.14), p.sy(v[1]! + (v[1]! / L) * 0.14), col, ital(15, 650), 'center');
      };
      lab(Q1, `q @ ${m + t}`, color('teal'));
      lab(K1, `k @ ${n + t}`, color('green'));
      haloText(ctx, `pair ${i}: θ = ${fmt(theta[i]!, 3)} rad per token`, p.sx(p.view()[0]) + 6, p.sy(p.view()[3]) + 12, color('red'), ui(12, 600), 'left');
      haloText(ctx, `angle between: ${fmt((((ak - aq) * 180) / Math.PI), 3)}°`, p.sx(p.view()[0]) + 6, p.sy(p.view()[2]) - 12, color('purple'), ui(12, 600), 'left');
    },
  });
  let dialRects: { i: number; x: number; y: number; r: number }[] = [];
  const dials = f.canvas(640, 128, (ctx, w, h) => {
    const nd = theta.length;
    const cw = w / nd;
    const rad = Math.min(cw * 0.36, (h - 44) / 2);
    dialRects = [];
    for (let i = 0; i < nd; i++) {
      const cx = cw * (i + 0.5);
      const cy = rad + 6;
      const on = i === pair;
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fillStyle = on ? withAlpha(color('red'), 0.12) : color('--card');
      ctx.fill();
      ctx.strokeStyle = on ? color('red') : color('--rule');
      ctx.lineWidth = on ? 2 : 1;
      ctx.stroke();
      const hand = (pos: number, col: string) => {
        const ang = pos * theta[i]!;
        ctx.strokeStyle = col;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(ang) * rad * 0.85, cy - Math.sin(ang) * rad * 0.85);
        ctx.stroke();
      };
      hand(m + t, color('teal'));
      hand(n + t, color('green'));
      const per = (2 * Math.PI) / theta[i]!;
      ctx.fillStyle = on ? color('--ink') : color('--ink-2');
      ctx.font = mono(11, on ? 650 : 500);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(per >= 1000 ? `${fmt(per / 1000, 2)}K` : String(Math.round(per)), cx, cy + rad + 5);
      dialRects.push({ i, x: cx, y: cy, r: rad + 6 });
    }
    ctx.fillStyle = color('--ink-3');
    ctx.font = ui(11);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('tokens per full turn, for each of the 8 pairs (tap one)', w / 2, h - 1);
  });
  dials.canvas.classList.add('scroll-ok');
  dials.canvas.addEventListener('click', (e) => {
    const rc = dials.canvas.getBoundingClientRect();
    const x = e.clientX - rc.left;
    const hit = dialRects.find((dr) => Math.abs(x - dr.x) < dr.r * 1.2);
    if (hit) {
      pair = hit.i;
      pairSl.set(pair, false);
      sync();
    }
  });
  const scoreRo = f.readout('score q·k', { sym: 'S' });
  const diffRo = f.readout('n − m');
  const sync = (hl?: string | string[]) => {
    const score = M.dot(M.rope(q, m + t, theta), M.rope(k, n + t, theta));
    scoreRo.set(fmt(score, 4));
    diffRo.set(n - m);
    f.code.setMany({ m: m + t, n: n + t, score: fmt(score, 4), diff: n - m });
    if (hl) f.code.highlight(hl);
    pl.redraw();
    dials.redraw();
  };
  f.slider({ label: 'query at m', min: 0, max: 48, step: 1, value: m, onInput: (v) => { m = v; sync(['q', 'score']); } });
  f.slider({ label: 'key at n', min: 0, max: 48, step: 1, value: n, onInput: (v) => { n = v; sync(['k', 'score']); } });
  f.slider({ label: 'shift both', min: 0, max: 400, step: 1, value: 0, onInput: (v) => { t = v; sync(['q', 'k', 'score']); } });
  const pairSl = f.slider({ label: 'pair i', min: 0, max: 7, step: 1, value: 0, onInput: (v) => { pair = v; sync(['theta', 'ang']); } });
  sync();
}

// ---------------------------------------------------------------- Fig: SwiGLU

export function setupSwiglu(f: Fig): void {
  type Unit = 'relu' | 'gelu' | 'swiglu';
  let unit: Unit = 'swiglu';
  const w1 = [1.2, 0.5];
  const w3 = [-0.4, 1.1];
  const val = (x: number, y: number): number => {
    const a = w1[0]! * x + w1[1]! * y;
    if (unit === 'relu') return M.relu(a);
    if (unit === 'gelu') return M.gelu(a);
    return M.silu(a) * (w3[0]! * x + w3[1]! * y);
  };
  const pl = f.plot({
    aspect: 1.1,
    domain: [-2.2, 2.2, -2.2, 2.2],
    draw: (p) => {
      const ctx = p.ctx;
      const pos = color('orange');
      const neg = color('blue');
      const [pr, pg, pb] = hex(pos);
      const [nr, ng, nb] = hex(neg);
      p.field((x, y) => {
        const u = val(x, y);
        const al = Math.tanh(Math.abs(u) / 2.2) * 210;
        return u >= 0 ? [pr, pg, pb, al] : [nr, ng, nb, al];
      }, 5);
      p.axes({ grid: 1 });
      const line = (w: number[], col: string) => {
        const L = Math.hypot(w[0]!, w[1]!) || 1;
        const ux = -w[1]! / L;
        const uy = w[0]! / L;
        p.path([-ux * 4, ux * 4], [-uy * 4, uy * 4], col, 1.5, [6, 5]);
      };
      line(w1, color('blue'));
      if (unit === 'swiglu') line(w3, color('slate'));
      p.arrow(0, 0, w1[0]!, w1[1]!, color('blue'), 3);
      const [vx0, vx1, vy0, vy1] = p.view();
      const lx = (v: number) => clamp(v, vx0 + 0.45, vx1 - 0.45);
      const ly = (v: number) => clamp(v, vy0 + 0.2, vy1 - 0.25);
      haloText(ctx, unit === 'swiglu' ? 'w1 (gate)' : 'w1', p.sx(lx(w1[0]! * 1.12)), p.sy(ly(w1[1]! * 1.12)) - 8, color('blue'), ital(14, 650), 'center');
      if (unit === 'swiglu') {
        p.arrow(0, 0, w3[0]!, w3[1]!, color('slate'), 3);
        haloText(ctx, 'w3', p.sx(lx(w3[0]! * 1.15)), p.sy(ly(w3[1]! * 1.15)) - 8, color('slate'), ital(14, 650), 'center');
      }
      haloText(ctx, 'orange: positive   blue: negative', p.sx(p.view()[0]) + 6, p.sy(p.view()[2]) - 10, color('--ink-2'), ui(11.5, 500), 'left');
    },
  });
  const act = f.plot({
    height: 120,
    square: false,
    domain: [-4, 3, -0.7, 3],
    draw: (p) => {
      p.axes({ grid: 1 });
      const curves: [Unit, (z: number) => number, string, string][] = [
        ['relu', M.relu, 'slate', 'ReLU'],
        ['gelu', M.gelu, 'purple', 'GELU'],
        ['swiglu', M.silu, 'blue', 'SiLU'],
      ];
      curves.forEach(([u, fn, k, name], i) => {
        const on = u === unit;
        p.fn(fn, withAlpha(color(k as Color), on ? 1 : 0.35), on ? 3 : 1.5);
        p.text(name, -3.85, 2.55 - i * 0.75, { size: 11.5, bold: on, color: withAlpha(color(k as Color), on ? 1 : 0.6) });
      });
    },
  });
  const wRo = f.readout('MLP weights at d = 4096');
  const sync = () => {
    f.code.setMany({ w10: fmt(w1[0]!, 2), w11: fmt(w1[1]!, 2), w30: fmt(w3[0]!, 2), w31: fmt(w3[1]!, 2) });
    f.code.set('unit', unit === 'relu' ? 'relu(x @ w1)' : unit === 'gelu' ? 'gelu(x @ w1)' : 'silu(x @ w1) * (x @ w3)');
    wRo.set(unit === 'swiglu' ? '3 × d × 11008 = 135M' : '2 × d × 4d = 134M');
    f.code.highlight(unit === 'swiglu' ? ['silu', 'swiglu', 'unit'] : ['relu', 'unit']);
    pl.redraw();
    act.redraw();
  };
  let drag: number[] | null = null;
  const move = (e: PointerEvent) => {
    if (!drag) return;
    const [x, y] = pl.pointer(e);
    drag[0] = Math.round(clamp(x, -1.8, 1.8) * 20) / 20;
    drag[1] = Math.round(clamp(y, -1.8, 1.8) * 20) / 20;
    sync();
  };
  pl.canvas.addEventListener('pointerdown', (e) => {
    const [x, y] = pl.pointer(e);
    const d1 = Math.hypot(x - w1[0]!, y - w1[1]!);
    const d3 = unit === 'swiglu' ? Math.hypot(x - w3[0]!, y - w3[1]!) : Infinity;
    drag = d1 <= d3 ? w1 : w3;
    pl.canvas.setPointerCapture(e.pointerId);
    move(e);
  });
  pl.canvas.addEventListener('pointermove', move);
  pl.canvas.addEventListener('pointerup', () => (drag = null));
  f.segmented({
    label: 'hidden unit',
    options: [
      { value: 'relu', label: 'ReLU' },
      { value: 'gelu', label: 'GELU' },
      { value: 'swiglu', label: 'SwiGLU' },
    ],
    value: 'swiglu',
    onChange: (v) => {
      unit = v as Unit;
      sync();
    },
  });
  sync();
}

function hex(css: string): [number, number, number] {
  const mm = css.match(/^#([0-9a-f]{6})$/i);
  if (!mm) return [128, 128, 128];
  const v = parseInt(mm[1]!, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// ---------------------------------------------------------------- Fig: KV cache and GQA

export function setupKV(f: Fig): void {
  let pi = 2;
  let P = M.PRESETS[pi]!;
  let kv = P.kvHeads;
  let T = 8192;
  let B = 1;
  let bytes = 2;
  const GPU = 80 * 1024 ** 3;
  const divisors = (n: number) => Array.from({ length: n }, (_, i) => i + 1).filter((i) => n % i === 0);
  const cv = f.canvas(640, 400, (ctx, w, h) => {
    const H = P.heads;
    const left = 10;
    const right = w - 10;
    const span = right - left;
    const qw = span / H;
    const qy = 34;
    const kvY = 112;
    const group = H / kv;
    ctx.fillStyle = color('--ink-2');
    ctx.font = ui(12.5, 600);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`${H} query heads`, left, qy - 8);
    for (let j = 0; j < H; j++) {
      const x = left + j * qw;
      const g = Math.floor(j / group);
      ctx.fillStyle = withAlpha(color('teal'), g % 2 ? 0.55 : 0.85);
      ctx.fillRect(x + Math.min(1, qw * 0.15), qy, Math.max(1, qw - Math.min(2, qw * 0.3)), 18);
    }
    const kvw = span / kv;
    for (let g = 0; g < kv; g++) {
      const gx = left + g * kvw;
      const cx = gx + kvw / 2;
      const qx0 = left + g * group * qw;
      const qx1 = qx0 + group * qw;
      ctx.strokeStyle = withAlpha(color('--ink-3'), 0.55);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(qx0 + 1, qy + 19);
      ctx.lineTo(cx, kvY - 2);
      ctx.lineTo(qx1 - 1, qy + 19);
      ctx.stroke();
      const bw = Math.max(2, Math.min(kvw - 3, 40));
      ctx.fillStyle = withAlpha(color('green'), 0.8);
      ctx.fillRect(cx - bw / 2, kvY, bw, 14);
      ctx.fillStyle = withAlpha(color('gold'), 0.85);
      ctx.fillRect(cx - bw / 2, kvY + 15, bw, 14);
    }
    const kind = kv === H ? 'MHA' : kv === 1 ? 'MQA' : 'GQA';
    ctx.fillStyle = color('--ink-2');
    ctx.font = ui(12.5, 600);
    ctx.fillText(`${kv} key + value head${kv > 1 ? 's' : ''} (${kind}${kv < H ? `: each shared by ${group}` : ''})`, left, kvY + 48);
    // memory bars
    const per = M.kvBytesPerToken(P.layers, kv, P.dHead, bytes);
    const cache = per * T * B;
    const weights = P.params * 2;
    const max = Math.max(weights, cache, GPU) * 1.08;
    const X = (b: number) => left + (b / max) * span;
    const by = 196;
    const bh = 34;
    const bar = (y: number, b: number, k: Color, label: string) => {
      ctx.fillStyle = withAlpha(color(k), 0.75);
      ctx.fillRect(left, y, Math.max(2, X(b) - left), bh);
      const txt = `${label}  ${M.bytesStr(b)}`;
      ctx.font = ui(13, 600);
      const tw = ctx.measureText(txt).width;
      const inside = X(b) - left > tw + 16;
      ctx.fillStyle = inside ? '#ffffff' : color('--ink');
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, inside ? left + 8 : Math.min(X(b) + 8, right - tw), inside || X(b) + 8 + tw <= right ? y + bh / 2 : y - 9);
    };
    const gx = X(GPU);
    ctx.strokeStyle = color('red');
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(gx, by - 14);
    ctx.lineTo(gx, by + 2 * bh + 34);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = color('red');
    ctx.font = ui(12, 600);
    ctx.textAlign = gx > w * 0.7 ? 'right' : 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('one 80 GB GPU', gx + (gx > w * 0.7 ? -6 : 6), by - 4);
    bar(by, weights, 'blue', 'weights (bf16)');
    bar(by + bh + 22, cache, 'green', 'KV cache');
    ctx.fillStyle = color('--ink-3');
    ctx.font = ui(12);
    ctx.textAlign = 'left';
    ctx.fillText(`${M.tokStr(T)} tokens x batch ${B}, ${bytes === 2 ? 'bf16' : 'fp8'} cache`, left, h - 10);
  });
  fixHeight(cv.canvas, 318);
  const perRo = f.readout('per token');
  const totRo = f.readout('cache');
  const kvSl = f.slider({
    label: 'KV heads',
    min: 0,
    max: divisors(P.heads).length - 1,
    step: 1,
    value: divisors(P.heads).indexOf(kv),
    format: (v) => String(divisors(P.heads)[Math.round(v)] ?? kv),
    onInput: (v) => {
      kv = divisors(P.heads)[Math.round(v)]!;
      sync('tok');
    },
  });
  const ctxSl = f.slider({ label: 'context', min: 10, max: 17, step: 1, value: 13, format: (v) => M.tokStr(2 ** v), onInput: (v) => { T = 2 ** v; sync('total'); } });
  f.slider({ label: 'batch', min: 0, max: 6, step: 1, value: 0, format: (v) => String(2 ** v), onInput: (v) => { B = 2 ** v; sync('total'); } });
  f.segmented({
    label: 'cache dtype',
    options: [
      { value: '2', label: 'bf16' },
      { value: '1', label: 'fp8' },
    ],
    value: '2',
    onChange: (v) => {
      bytes = Number(v);
      sync('tok');
    },
  });
  const presetSeg = f.segmented({
    label: 'model',
    options: M.PRESETS.map((p, i) => ({ value: String(i), label: p.name })),
    value: String(pi),
    onChange: (v) => {
      pi = Number(v);
      P = M.PRESETS[pi]!;
      kv = P.kvHeads;
      const ds = divisors(P.heads);
      kvSl.input.max = String(ds.length - 1);
      kvSl.set(ds.indexOf(kv), false);
      T = P.ctx;
      ctxSl.set(Math.log2(T), false);
      sync();
    },
  });
  f.controls.prepend(presetSeg.el);
  function sync(hl?: string) {
    if (hl) f.code.highlight(hl);
    const per = M.kvBytesPerToken(P.layers, kv, P.dHead, bytes);
    const cache = per * T * B;
    perRo.set(M.bytesStr(per));
    totRo.set(M.bytesStr(cache));
    f.code.setMany({ name: P.name, L: P.layers, H: P.heads, dh: P.dHead, kv, b: bytes, T: M.tokStr(T), B, pt: M.bytesStr(per), tot: M.bytesStr(cache), wt: M.bytesStr(P.params * 2) });
    cv.redraw();
  }
  sync();
}

// ---------------------------------------------------------------- Fig: QK-norm

export function setupQKNorm(f: Fig): void {
  const d = 16;
  const r = new Rng(8);
  const q0 = Array.from({ length: d }, () => r.randn());
  const K0 = Array.from({ length: 8 }, () => Array.from({ length: d }, () => r.randn()));
  let s = 1;
  let qk = false;
  const attend = (sv: number, norm: boolean) => {
    let q = q0.map((t) => t * sv);
    let K = K0.map((row) => row.map((t) => t * sv));
    if (norm) {
      q = M.rmsNorm(q);
      K = K.map((row) => M.rmsNorm(row));
    }
    const S = K.map((row) => M.dot(row, q) / Math.sqrt(d));
    return { S, A: M.softmax(S) };
  };
  const bars = f.canvas(640, 300, (ctx, w, h) => {
    const { S, A } = attend(s, qk);
    const left = 8;
    const cw = (w - 16) / 8;
    const base = h - 26;
    const top = 42;
    ctx.fillStyle = color('--ink-2');
    ctx.font = ui(12.5, 600);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('attention weights over 8 keys (scores below)', left, 16);
    A.forEach((a, j) => {
      const x = left + j * cw + cw * 0.15;
      const bw = cw * 0.7;
      const hh = (base - top) * a;
      ctx.fillStyle = withAlpha(color('purple'), 0.75);
      ctx.fillRect(x, base - hh, bw, hh);
      ctx.fillStyle = color('--ink-2');
      ctx.font = mono(11);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(a >= 0.995 ? '1.00' : a.toFixed(2), x + bw / 2, base - hh - 2);
      ctx.textBaseline = 'top';
      ctx.fillStyle = color('purple');
      ctx.fillText(fmt(S[j]!, 3), x + bw / 2, base + 5);
    });
    ctx.strokeStyle = color('--axis');
    ctx.beginPath();
    ctx.moveTo(left, base);
    ctx.lineTo(w - 8, base);
    ctx.stroke();
  });
  const LS = Array.from({ length: 61 }, (_, i) => i / 12);
  const curve = (norm: boolean) => LS.map((l) => M.entropyBits(attend(2 ** l, norm).A));
  const cOff = curve(false);
  const cOn = curve(true);
  const pl = f.plot({
    height: 150,
    square: false,
    domain: [-0.35, 5.35, -0.45, 3.4],
    draw: (p) => {
      p.axes({ grid: 1 });
      p.path(LS, cOff, withAlpha(color('red'), qk ? 0.4 : 1), qk ? 1.5 : 2.5);
      p.path(LS, cOn, withAlpha(color('teal'), qk ? 1 : 0.4), qk ? 2.5 : 1.5);
      const l = Math.log2(s);
      p.dot(l, M.entropyBits(attend(s, qk).A), 5, color(qk ? 'teal' : 'red'), color('--paper'));
      p.text('entropy (bits) vs growth', 0.08, 3.0, { size: 11.5, color: color('--ink-2') });
      p.text('with QK-norm', 5.2, cOn[cOn.length - 1]! - 0.45, { size: 11.5, color: color('teal'), align: 'right' });
      p.text('without', 5.2, 0.2, { size: 11.5, color: color('red'), align: 'right' });
      [1, 2, 4, 8, 16, 32].forEach((v) => p.text(`${v}x`, Math.log2(v), -0.38, { size: 10.5, mono: true, color: color('--ink-3'), align: 'center' }));
    },
  });
  const smRo = f.readout('largest |score|', { sym: 'S' });
  const hRo = f.readout('entropy');
  const sync = () => {
    const { S, A } = attend(s, qk);
    const smax = Math.max(...S.map(Math.abs));
    const H = M.entropyBits(A);
    smRo.set(fmt(smax, 3));
    const Hs = H < 0.005 ? '0.00' : fmt(H, 2);
    hRo.set(`${Hs} bits`);
    f.code.setMany({ s: fmt(s, 3), amax: fmt(Math.max(...A), 3), smax: fmt(smax, 3), H: Hs });
    f.code.highlight(qk ? ['norm', 'logits', 'soft'] : ['logits', 'soft']);
    bars.redraw();
    pl.redraw();
  };
  f.slider({ label: 'weight growth s', min: 0, max: 5, step: 0.05, value: 0, map: (v) => 2 ** v, format: (v) => `${fmt(v, 3)}x`, onInput: (v) => { s = v; sync(); } });
  f.toggle({ label: 'QK-norm', value: false, onChange: (v) => { qk = v; f.code.set('qk', v ? 'True' : 'False'); sync(); } });
  sync();
}

// ---------------------------------------------------------------- Fig: online softmax

export function setupOnline(f: Fig): void {
  let seed = 19;
  let row = M.toyRow(seed);
  let B = 4;
  let cur = 0;
  let res = M.onlineSoftmax(row.S, row.v, B);
  const N = row.S.length;
  const cv = f.canvas(640, 330, (ctx, w, h) => {
    const left = 8;
    const cw = (w - 16) / N;
    const sy = 40;
    const ch = Math.min(34, cw * 1.05);
    const vy = sy + ch + 22;
    const done = cur;
    const st = cur > 0 ? res.steps[cur - 1]! : null;
    ctx.font = mono(11.5, 600);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color('purple');
    ctx.fillText('scores S (one query, 12 keys)', left, sy - 22);
    for (let t = 0; t * B < N; t++) {
      const a = t * B;
      const b = Math.min(N, a + B);
      const x0 = left + a * cw + 2;
      const x1 = left + b * cw - 2;
      const isCur = t === done - 1;
      ctx.strokeStyle = isCur ? color('--accent') : t < done ? withAlpha(color('--ink-3'), 0.8) : color('--rule');
      ctx.lineWidth = isCur ? 2.5 : 1.2;
      ctx.beginPath();
      ctx.moveTo(x0, sy - 6);
      ctx.lineTo(x0, sy - 12);
      ctx.lineTo(x1, sy - 12);
      ctx.lineTo(x1, sy - 6);
      ctx.stroke();
    }
    const mx = Math.max(...row.S.map(Math.abs));
    row.S.forEach((sv, j) => {
      const inTile = st && j >= st.from && j < st.to;
      const seen = st && j < st.to;
      const x = left + j * cw;
      cellBox(ctx, x, sy, cw, ch, fmt(sv, 2), color('purple'), { on: !!inTile, dim: !seen, size: Math.max(10.5, Math.min(13, cw * 0.3)), fill: seen ? 0.08 + 0.3 * (Math.abs(sv) / mx) : 0.04 });
      cellBox(ctx, x, vy, cw, ch, fmt(row.v[j]!, 2), color('gold'), { on: !!inTile, dim: !seen, size: Math.max(10.5, Math.min(13, cw * 0.3)) });
    });
    ctx.fillStyle = color('gold');
    ctx.textAlign = 'left';
    ctx.fillText('values v (one channel)', left, vy + ch + 15);
    // running state
    const py = vy + ch + 34;
    const bw = (w - 16 - 16) / 3;
    const narrow = w < 420;
    const boxes: [string, string, string][] = [
      [narrow ? 'm (max)' : 'm  running max', st ? `${Number.isFinite(st.mOld) ? fmt(st.mOld, 3) : '-inf'} → ${fmt(st.mNew, 3)}` : '-inf', st ? `tile max ${fmt(st.tileMax, 3)}` : ''],
      [narrow ? 'ℓ (sum)' : 'ℓ  running sum', st ? `${fmt(st.lOld, 4)} → ${fmt(st.lNew, 4)}` : '0', st && st.corr > 0 && st.corr < 1 ? `old sum × ${fmt(st.corr, 3)}` : st ? 'no rescale' : ''],
      [narrow ? 'o (output)' : 'o  running output', st ? `${fmt(st.oOld, 4)} → ${fmt(st.oNew, 4)}` : '0', st && st.corr > 0 && st.corr < 1 ? `old output × ${fmt(st.corr, 3)}` : ''],
    ];
    boxes.forEach(([t, v, n], i) => {
      const x = left + i * (bw + 8);
      roundBox(ctx, x, py, bw, 72, 8, withAlpha(color('--ink-3'), 0.06), color('--rule'));
      ctx.fillStyle = color('--ink-2');
      ctx.font = ui(11.5, 600);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(t, x + 8, py + 7);
      ctx.fillStyle = color('--ink');
      ctx.font = mono(Math.max(11, Math.min(13.5, bw / 13)), 600);
      ctx.fillText(v, x + 8, py + 28);
      ctx.fillStyle = color('red');
      ctx.font = ui(narrow ? 10.5 : 11);
      ctx.fillText(narrow ? n.replace('old sum ', '').replace('old output ', '') : n, x + 8, py + 51);
    });
    const fy = py + 90;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    if (cur === res.steps.length) {
      ctx.fillStyle = color('--ink');
      ctx.font = mono(Math.max(11, Math.min(13, w / 46)), 600);
      ctx.fillText(`o / ℓ = ${res.online.toFixed(6)}    softmax(S) @ v = ${res.direct.toFixed(6)}`, left, fy);
      ctx.fillStyle = color('green');
      ctx.font = ui(12, 600);
      ctx.fillText(`difference ${Math.abs(res.online - res.direct).toExponential(0)}: the same answer, without ever holding all 12 weights`, left, fy + 20);
    } else {
      ctx.fillStyle = color('--ink-3');
      ctx.font = ui(12, 500);
      ctx.fillText(cur === 0 ? 'nothing loaded yet: m = -inf, ℓ = 0, o = 0' : `tile ${cur} of ${res.steps.length} is in fast memory; earlier tiles are gone`, left, fy);
    }
  });
  fixHeight(cv.canvas, 292);
  const stepper = f.stepper({
    steps: res.steps.length + 1,
    interval: 1300,
    label: (k) => (k === 0 ? 'start' : `tile ${k} / ${res.steps.length}`),
    onStep: (k) => {
      cur = k;
      f.code.highlight(k === 0 ? 'init' : k === res.steps.length ? ['acc', 'out'] : ['load', 'max', 'corr', 'sum', 'acc']);
      cv.redraw();
    },
  });
  const sync = () => {
    res = M.onlineSoftmax(row.S, row.v, B);
    f.code.setMany({ out: res.online.toFixed(6), direct: res.direct.toFixed(6) });
    stepper.setSteps(res.steps.length + 1);
    stepper.go(0);
  };
  f.segmented({
    label: 'tile size B',
    options: ['2', '3', '4', '6', '12'].map((v) => ({ value: v, label: v })),
    value: '4',
    slot: 'B',
    onChange: (v) => {
      B = Number(v);
      sync();
    },
  });
  f.button('New scores', () => {
    seed++;
    row = M.toyRow(seed);
    sync();
  });
  f.code.setMany({ out: res.online.toFixed(6), direct: res.direct.toFixed(6) });
}

// ---------------------------------------------------------------- Fig: long context

export function setupLong(f: Fig): void {
  const d = 128;
  const base = 10000;
  const Ltr = 4096;
  let s = 4;
  let method: M.Scaling = 'none';
  const th0 = M.ropeTheta(d, base);
  const lam = (t: number) => Math.log2((2 * Math.PI) / t);
  let th1 = th0;
  let over = th0.map(() => 1);
  const pl = f.plot({
    aspect: 1.3,
    square: false,
    domain: [-6, 66, 1, 23.5],
    draw: (p) => {
      const ctx = p.ctx;
      for (let e = 3; e <= 21; e += 3) {
        p.path([-6, 66], [e, e], color('--grid'), 1);
        const lab = e >= 20 ? `${2 ** (e - 20)}M` : e >= 10 ? `${2 ** (e - 10)}K` : String(2 ** e);
        p.text(lab, -5.6, e + 0.25, { size: 10.5, mono: true, color: color('--ink-3') });
      }
      const ly = Math.log2(Ltr);
      const ny = Math.log2(Ltr * s);
      p.path([-1, 66], [ly, ly], color('green'), 1.8, [6, 4]);
      p.text(`trained: ${M.tokStr(Ltr)}`, 0, ly - 0.9, { size: 11.5, color: color('green'), align: 'left', bold: true });
      if (s > 1) {
        p.path([-1, 66], [ny, ny], color('red'), 1.8, [6, 4]);
        p.text(`new: ${M.tokStr(Ltr * s)}`, 0, ny + 0.35, { size: 11.5, color: color('red'), align: 'left', bold: true });
      }
      for (let i = 0; i < th0.length; i++) {
        const y0 = lam(th0[i]!);
        const y1 = lam(th1[i]!);
        if (Math.abs(y1 - y0) > 0.05) p.path([i, i], [y0, y1], withAlpha(color('--ink-3'), 0.6), 1);
        p.dot(i, y0, 2.2, withAlpha(color('--ink-3'), 0.55));
        const bad = over[i]! > 1.001;
        p.dot(i, y1, bad ? 3.6 : 2.8, color(bad ? 'red' : y1 - y0 > 0.05 ? 'blue' : 'green'));
      }
      haloText(ctx, 'tokens per full turn (log scale)', p.sx(-0.5), p.sy(23), color('--ink-2'), ui(11.5, 500), 'left');
      haloText(ctx, 'pair i: fast → slow', p.sx(32), p.sy(1.5), color('--ink-2'), ui(11.5, 500), 'center');
    },
  });
  const badRo = f.readout('pairs meeting new angles');
  const worstRo = f.readout('worst overshoot');
  const fastRo = f.readout('fastest pair slowed');
  const sync = () => {
    th1 = M.scaledTheta(method, s, d, base, Ltr);
    over = M.overshoot(th0, th1, Ltr, Ltr * s);
    const bad = over.filter((o) => o > 1.001).length;
    badRo.set(`${bad} of 64`);
    worstRo.set(`${fmt(Math.max(...over), 3)}x`);
    fastRo.set(`${fmt(th0[0]! / th1[0]!, 3)}x`);
    f.code.setMany({ bad, s: fmt(s, 3) });
    f.code.highlight(method === 'none' ? null : method);
    pl.redraw();
  };
  f.segmented({
    label: 'method',
    options: [
      { value: 'none', label: 'none' },
      { value: 'pi', label: 'PI' },
      { value: 'ntk', label: 'NTK-aware' },
      { value: 'yarn', label: 'YaRN' },
    ],
    value: 'none',
    slot: 'method',
    onChange: (v) => {
      method = v as M.Scaling;
      sync();
    },
  });
  f.slider({ label: 'stretch s', min: 0, max: 5, step: 0.5, value: 2, map: (v) => 2 ** v, format: (v) => `${fmt(v, 3)}x`, onInput: (v) => { s = v; sync(); } });
  sync();
}

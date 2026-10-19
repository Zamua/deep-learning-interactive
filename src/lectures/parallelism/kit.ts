import type { Color } from '../../core/symbols';
import type { Scene } from '../../lecture/scene';
import { type PipeRun, type RingRun } from '../../lib/parallelism-math';

export type K = Color | `--${string}`;
export type Rect = [number, number, number, number];

/** The stage's drawing area inside a margin, leaving room for the scene chip at the top. */
export function area(s: Scene, top = 0.14, pad = 0.05): Rect {
  const m = Math.max(s.w * pad, s.u * 4);
  return [m, s.h * top, s.w - 2 * m, s.h * (1 - top) - m];
}

/** The beat currently playing, from a list in script order. */
export function current(s: Scene, ids: string[]): string | null {
  let cur: string | null = null;
  for (const id of ids) if (s.since(id) >= 0) cur = id;
  return cur;
}

/** Largest text size (in u) not above `size` that fits `text` within `maxW` px. */
export function fit(s: Scene, text: string, maxW: number, size: number, o: Parameters<Scene['measure']>[1] = {}): number {
  const wpx = s.measure(text, { ...o, size });
  return wpx <= maxW ? size : (size * maxW) / wpx;
}

/** Centered text shrunk to fit `maxW`. */
export function line(s: Scene, text: string, x: number, y: number, maxW: number, size: number, o: Parameters<Scene['text']>[3] = {}): void {
  s.text(text, x, y, { ...o, size: fit(s, text, maxW, size, o) });
}

/** A rounded card with a heading and a note, fitted to its width. */
export function card(s: Scene, x: number, y: number, w: number, h: number, head: string, note: string, k: K, on = 0, a = 1): void {
  if (a <= 0.003) return;
  s.alpha(a, () => {
    s.rrect(x, y, w, h, 2, { fill: s.tint(k, 0.07 + 0.18 * on), stroke: s.tint(k, 0.4 + 0.6 * on), lw: 0.3 + 0.3 * on });
    const pad = s.u * 2.4;
    const hs = fit(s, head, w - 2 * pad, Math.min(4.6, (h / s.u) * (note ? 0.34 : 0.45)), { font: 'display', weight: 620 });
    if (note) {
      const ns = fit(s, note, w - 2 * pad, Math.min(3.5, hs * 0.85), { italic: true });
      s.text(head, x + pad, y + h * 0.36, { size: hs, font: 'display', weight: 620, align: 'left', color: s.c(k) });
      s.text(note, x + pad, y + h * 0.72, { size: ns, italic: true, align: 'left', color: s.c('--ink-2') });
    } else s.text(head, x + w / 2, y + h / 2, { size: hs, font: 'display', weight: 620, color: s.c(k) });
  });
}

/** A rounded tag of mono text centered at (x, y); returns its width. */
export function pill(s: Scene, text: string, x: number, y: number, k: K, size = 3.4): number {
  const tw = s.measure(text, { font: 'mono', size, weight: 600 });
  const pw = tw + s.u * size * 0.95;
  const ph = s.u * size * 1.7;
  s.rrect(x - pw / 2, y - ph / 2, pw, ph, size * 0.85, { fill: s.tint(k, 0.12), stroke: s.tint(k, 0.75), lw: 0.3 });
  s.text(text, x, y + s.u * 0.15, { font: 'mono', size, weight: 600, color: s.c(k) });
  return pw;
}

/** Diagonal hatching inside a rectangle: idle or wasted time. */
export function hatch(s: Scene, x: number, y: number, w: number, h: number, col: string, gapU = 1.3): void {
  if (w <= 0.5 || h <= 0.5) return;
  const c = s.ctx;
  const gap = gapU * s.u;
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  c.strokeStyle = col;
  c.lineWidth = Math.max(1, s.u * 0.18);
  c.beginPath();
  for (let k = -h; k < w; k += gap) {
    c.moveTo(x + k, y + h);
    c.lineTo(x + k + h, y);
  }
  c.stroke();
  c.restore();
}

/** A GPU drawn as a labeled rounded box. */
export function gpu(s: Scene, x: number, y: number, w: number, h: number, label: string, k: K, on = 0): void {
  s.rrect(x, y, w, h, 1.6, { fill: s.tint(k, 0.06 + 0.12 * on), stroke: s.tint(k, 0.55 + 0.45 * on), lw: 0.3 + 0.25 * on });
  if (label) s.text(label, x + s.u * 1.4, y + s.u * 2.4, { size: Math.min(3.2, (h / s.u) * 0.3), font: 'ui', weight: 650, align: 'left', color: s.c(k) });
}

/** A heat-tinted matrix with its top-left corner at (x, y): tint strength is |value|, gray is negative. */
export function heat(s: Scene, x: number, y: number, cs: number, M: number[][], k: K, max: number, o: { outline?: K; dim?: number } = {}): void {
  const c = s.ctx;
  const dim = o.dim ?? 1;
  M.forEach((row, i) =>
    row.forEach((v, j) => {
      const a = (0.12 + 0.68 * Math.min(1, Math.abs(v) / max)) * dim;
      c.fillStyle = v >= 0 ? s.tint(k, a) : s.tint('--ink-3', a);
      c.fillRect(x + j * cs + 0.5, y + i * cs + 0.5, cs - 1, cs - 1);
    }),
  );
  c.strokeStyle = o.outline ? s.c(o.outline) : s.tint(k, 0.8 * dim);
  c.lineWidth = o.outline ? Math.max(1.5, s.u * 0.45) : 1;
  c.strokeRect(x + 0.5, y + 0.5, M[0]!.length * cs - 1, M.length * cs - 1);
}

const GPU_COLORS: Color[] = ['blue', 'orange', 'green', 'purple', 'red', 'teal'];
export const gpuColor = (i: number): Color => GPU_COLORS[i % GPU_COLORS.length]!;

/**
 * A ring all-reduce in `rect`: GPU boxes on an ellipse, each with N chunk cells whose stripes show
 * which GPUs' contributions they hold. `kf` is the step as a real number (2.4 = step 3, 40% sent).
 */
export function ringView(s: Scene, rect: Rect, N: number, run: RingRun, kf: number): void {
  const [rx, ry, rw, rh] = rect;
  const steps = run.sends.length;
  const kc = Math.max(0, Math.min(steps, kf));
  const k = Math.floor(kc);
  const q = k < steps ? kc - k : 0;
  const boxW = Math.min(rw * 0.32, s.u * 34);
  const cellW = (boxW - s.u * 2) / N;
  const cellH = Math.min(s.u * 9, rh * 0.11);
  const boxH = cellH + s.u * 6.5;
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  const Rx = rw / 2 - boxW / 2;
  const Ry = rh / 2 - boxH / 2;
  const pos = (i: number): [number, number] => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / N;
    return [cx + Rx * Math.cos(a), cy + Ry * Math.sin(a)];
  };
  const c = s.ctx;
  c.beginPath();
  c.ellipse(cx, cy, Rx, Ry, 0, 0, Math.PI * 2);
  c.strokeStyle = s.c('--grid');
  c.lineWidth = s.u * 0.5;
  c.stroke();
  for (let i = 0; i < N; i++) {
    const a = -Math.PI / 2 + (2 * Math.PI * (i + 0.5)) / N;
    const x = cx + Rx * Math.cos(a);
    const y = cy + Ry * Math.sin(a);
    const tx = -Rx * Math.sin(a);
    const ty = Ry * Math.cos(a);
    const n = Math.hypot(tx, ty);
    s.arrow(x - (tx / n) * s.u * 2.5, y - (ty / n) * s.u * 2.5, x + (tx / n) * s.u * 2.5, y + (ty / n) * s.u * 2.5, s.c('--ink-3'), 0.4, 2);
  }
  const state = run.states[k]!;
  const cellAt = (g: number, ch: number): [number, number] => {
    const [bx, by] = pos(g);
    return [bx - boxW / 2 + s.u + ch * cellW, by - boxH / 2 + s.u * 4.8];
  };
  const drawCell = (x: number, y: number, contrib: boolean[]) => {
    const full = contrib.every(Boolean);
    s.rrect(x + 1, y, cellW - 2, cellH, 0.6, { fill: s.c('--paper') });
    contrib.forEach((on, j) => {
      if (!on) return;
      c.fillStyle = s.tint(gpuColor(j), 0.9);
      c.fillRect(x + 2, y + (j * cellH) / N + 0.5, cellW - 4, cellH / N - 1);
    });
    s.rrect(x + 1, y, cellW - 2, cellH, 0.6, { stroke: full ? s.c('--ink') : s.c('--axis'), lw: full ? 0.45 : 0.2 });
  };
  for (let i = 0; i < N; i++) {
    const [bx, by] = pos(i);
    gpu(s, bx - boxW / 2, by - boxH / 2, boxW, boxH, `GPU ${i}`, gpuColor(i));
    for (let ch = 0; ch < N; ch++) {
      const [x, y] = cellAt(i, ch);
      drawCell(x, y, state[i]![ch]!);
    }
  }
  if (q > 0.001) {
    const e = q * q * (3 - 2 * q);
    for (const sd of run.sends[k]!) {
      const [x0, y0] = cellAt(sd.from, sd.chunk);
      const [x1, y1] = cellAt(sd.to, sd.chunk);
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      const ox = mx - cx;
      const oy = my - cy;
      const on = Math.hypot(ox, oy) || 1;
      const kx = mx + (ox / on) * s.u * 7;
      const ky = my + (oy / on) * s.u * 7;
      const x = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * kx + e * e * x1;
      const y = (1 - e) * (1 - e) * y0 + 2 * (1 - e) * e * ky + e * e * y1;
      c.save();
      c.shadowColor = s.tint('--ink', 0.35);
      c.shadowBlur = s.u * 1.5;
      drawCell(x, y, state[sd.from]![sd.chunk]!);
      c.restore();
    }
  }
}

/** A pipeline schedule as a Gantt chart in `rect`, drawn up to time `tc`. */
export function gantt(s: Scene, rect: Rect, run: PipeRun, P: number, tc: number, o: { stash?: number[]; labelW?: number } = {}): void {
  const [rx, ry, rw, rh] = rect;
  const lw = o.labelW ?? s.u * 11;
  const sw = o.stash ? s.u * 14 : 0;
  const rowH = rh / P;
  const X = (t: number) => rx + lw + (t / run.total) * (rw - lw - sw);
  const cut = X(Math.min(tc, run.total));
  for (let i = 0; i < P; i++) {
    const y = ry + i * rowH;
    s.text(`GPU ${i}`, rx, y + rowH / 2, { size: Math.min(3.1, (rowH / s.u) * 0.42), font: 'ui', weight: 600, align: 'left', color: s.c('--ink-2') });
    if (cut > rx + lw) {
      s.ctx.fillStyle = s.tint('red', 0.07);
      s.ctx.fillRect(rx + lw, y + 1, cut - rx - lw, rowH - 2);
      hatch(s, rx + lw, y + 1, cut - rx - lw, rowH - 2, s.tint('red', 0.35), 1.3);
    }
    if (o.stash) s.text(`holds ${o.stash[i]}`, rx + rw, y + rowH / 2, { size: Math.min(2.8, (rowH / s.u) * 0.4), font: 'mono', weight: 600, align: 'right', color: s.c('purple') });
  }
  const c = s.ctx;
  for (const op of run.ops) {
    if (op.t0 >= tc) continue;
    const x0 = X(op.t0);
    const x1 = Math.min(X(op.t1), cut);
    const y = ry + op.stage * rowH;
    const col = op.kind === 'F' ? s.tint('orange', 0.6) : s.tint('teal', 0.82);
    c.fillStyle = s.c('--paper');
    c.fillRect(x0 + 0.5, y + 1.5, x1 - x0 - 1, rowH - 3);
    c.fillStyle = col;
    c.fillRect(x0 + 0.5, y + 1.5, x1 - x0 - 1, rowH - 3);
    const full = X(op.t1) - x0;
    if (x1 >= X(op.t1) - 0.5 && full > s.u * 3.6 && rowH > s.u * 4) s.text(String(op.mb), x0 + full / 2, y + rowH / 2, { size: Math.min(3, (rowH / s.u) * 0.4), font: 'mono', weight: 600 });
  }
  if (tc < run.total) s.line(cut, ry, cut, ry + rh, s.c('--ink'), 0.35);
}

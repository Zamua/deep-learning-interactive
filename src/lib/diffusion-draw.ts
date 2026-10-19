import { type Plot, color, withAlpha } from '../core/plot';
import type { Points } from './diffusion-net';

/** Draws the first n points of a flat (x, y) array as one filled path. */
export function cloud(pl: Plot, pts: ArrayLike<number>, fill: string, r = 2.2, n = pts.length / 2): void {
  const c = pl.ctx;
  c.beginPath();
  for (let i = 0; i < n; i++) {
    const x = pl.sx(pts[2 * i]!);
    const y = pl.sy(pts[2 * i + 1]!);
    if (!(Math.abs(x) < 1e5 && Math.abs(y) < 1e5)) continue;
    c.moveTo(x + r, y);
    c.arc(x, y, r, 0, Math.PI * 2);
  }
  c.fillStyle = fill;
  c.fill();
}

/** The training data, faint, as a backdrop. */
export function ghost(pl: Plot, data: Points, a = 0.22, r = 2): void {
  cloud(pl, data.X, withAlpha(color('orange'), a), r);
}

/** Text in CSS px with a card-colored outline so it reads over points. */
export function halo(pl: Plot, s: string, px: number, py: number, o: { size?: number; color?: string; align?: CanvasTextAlign; base?: CanvasTextBaseline; bold?: boolean; mono?: boolean } = {}): void {
  const c = pl.ctx;
  c.font = `${o.bold ? '600 ' : ''}${o.size ?? 12}px ${o.mono ? "'JetBrains Mono Variable', ui-monospace, monospace" : 'system-ui, sans-serif'}`;
  c.textAlign = o.align ?? 'left';
  c.textBaseline = o.base ?? 'alphabetic';
  c.lineJoin = 'round';
  c.lineWidth = 3.5;
  c.strokeStyle = color('--card');
  c.strokeText(s, px, py);
  c.fillStyle = o.color ?? color('--ink-2');
  c.fillText(s, px, py);
}

/** "x₀" with a hat drawn as strokes, since a combining circumflex renders unevenly on canvas. */
export function hatX0(pl: Plot, px: number, py: number, col = color('orange'), size = 13): void {
  halo(pl, 'x₀', px, py, { color: col, bold: true, size });
  const c = pl.ctx;
  const wx = c.measureText('x').width;
  const cx = px + wx / 2;
  const top = py - size * 0.62;
  c.beginPath();
  c.moveTo(cx - size * 0.24, top);
  c.lineTo(cx, top - size * 0.22);
  c.lineTo(cx + size * 0.24, top);
  c.lineWidth = 1.4;
  c.strokeStyle = col;
  c.lineJoin = 'round';
  c.stroke();
}

/** A small legend in the top-left corner: colored dots with labels. */
export function legend(pl: Plot, items: [string, string][], x = 8, y = 8): void {
  const c = pl.ctx;
  c.font = '11px system-ui, sans-serif';
  const w = Math.max(...items.map(([s]) => c.measureText(s).width)) + 26;
  const h = items.length * 16 + 8;
  c.fillStyle = withAlpha(color('--card'), 0.86);
  c.strokeStyle = color('--rule');
  c.lineWidth = 1;
  c.beginPath();
  c.roundRect(x, y, w, h, 6);
  c.fill();
  c.stroke();
  items.forEach(([s, col], i) => {
    const cy = y + 12 + i * 16;
    c.beginPath();
    c.arc(x + 10, cy, 3.5, 0, Math.PI * 2);
    c.fillStyle = col;
    c.fill();
    c.fillStyle = color('--ink-2');
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(s, x + 19, cy + 0.5);
  });
}

/** Mean distance from each sample to its nearest data point: small when samples sit on the data. */
export function offData(pts: Float32Array, data: Points): number {
  const n = pts.length / 2;
  let tot = 0;
  let k = 0;
  for (let i = 0; i < n; i++) {
    const x = pts[2 * i]!, y = pts[2 * i + 1]!;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    let best = Infinity;
    for (let j = 0; j < data.n; j++) {
      const dx = x - data.X[2 * j]!, dy = y - data.X[2 * j + 1]!;
      const d = dx * dx + dy * dy;
      if (d < best) best = d;
    }
    tot += Math.sqrt(best);
    k++;
  }
  return k ? tot / k : NaN;
}

/** Label of the nearest data point for every sample. */
export function nearestLabel(pts: Float32Array, data: Points): Int32Array {
  const n = pts.length / 2;
  const out = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const x = pts[2 * i]!, y = pts[2 * i + 1]!;
    let best = Infinity;
    for (let j = 0; j < data.n; j++) {
      const dx = x - data.X[2 * j]!, dy = y - data.X[2 * j + 1]!;
      const d = dx * dx + dy * dy;
      if (d < best) {
        best = d;
        out[i] = data.y[j]!;
      }
    }
  }
  return out;
}

/** Share of class-c data points with a sample within `r`: how much of that moon the samples cover. */
export function coverage(pts: Float32Array, data: Points, c: number, r = 0.2): number {
  const n = pts.length / 2;
  let hit = 0;
  let tot = 0;
  for (let j = 0; j < data.n; j++) {
    if (data.y[j] !== c) continue;
    tot++;
    const x = data.X[2 * j]!, y = data.X[2 * j + 1]!;
    for (let i = 0; i < n; i++) {
      const dx = x - pts[2 * i]!, dy = y - pts[2 * i + 1]!;
      if (dx * dx + dy * dy < r * r) {
        hit++;
        break;
      }
    }
  }
  return tot ? hit / tot : 0;
}

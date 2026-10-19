import { color, withAlpha } from '../core/plot';
import type { Color } from '../core/symbols';

export const UI = 'system-ui, -apple-system, sans-serif';
export const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";
export const SERIF = "'Source Serif 4 Variable', Georgia, serif";

export interface TxtOpts {
  size?: number;
  weight?: number;
  mono?: boolean;
  serif?: boolean;
  italic?: boolean;
  color?: string;
  align?: CanvasTextAlign;
  base?: CanvasTextBaseline;
  halo?: boolean;
}

export function txt(c: CanvasRenderingContext2D, s: string, x: number, y: number, o: TxtOpts = {}): void {
  c.font = `${o.italic ? 'italic ' : ''}${o.weight ?? 500} ${o.size ?? 12}px ${o.mono ? MONO : o.serif ? SERIF : UI}`;
  c.textAlign = o.align ?? 'center';
  c.textBaseline = o.base ?? 'middle';
  if (o.halo) {
    c.lineJoin = 'round';
    c.lineWidth = 3.5;
    c.strokeStyle = color('--paper');
    c.strokeText(s, x, y);
  }
  c.fillStyle = o.color ?? color('--ink');
  c.fillText(s, x, y);
}

export function textWidth(c: CanvasRenderingContext2D, s: string, o: TxtOpts = {}): number {
  c.font = `${o.italic ? 'italic ' : ''}${o.weight ?? 500} ${o.size ?? 12}px ${o.mono ? MONO : o.serif ? SERIF : UI}`;
  return c.measureText(s).width;
}

export function rbox(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string | null, stroke: string | null, lw = 1): void {
  c.beginPath();
  c.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (stroke) {
    c.strokeStyle = stroke;
    c.lineWidth = lw;
    c.stroke();
  }
}

/**
 * A heatmap of an n x m matrix in [0, 1] (or values mapped by `norm`), with the diagonal outlined
 * in gold as the targets. Returns the cell size so callers can hit-test rows.
 */
export function heat(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  cell: number,
  M: ArrayLike<number>,
  n: number,
  m: number,
  o: { col?: Color; norm?: (v: number) => number; label?: (v: number) => string; hiRow?: number; diag?: boolean; font?: number } = {},
): void {
  const col = color(o.col ?? 'teal');
  const norm = o.norm ?? ((v: number) => v);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      const v = M[i * m + j]!;
      const a = Math.max(0, Math.min(1, norm(v)));
      const dim = o.hiRow !== undefined && o.hiRow >= 0 && i !== o.hiRow;
      c.fillStyle = withAlpha(col, (0.06 + 0.88 * a) * (dim ? 0.45 : 1));
      c.fillRect(x + j * cell + 1, y + i * cell + 1, cell - 2, cell - 2);
      if (o.label && cell >= 22) {
        txt(c, o.label(v), x + j * cell + cell / 2, y + i * cell + cell / 2 + 0.5, {
          size: o.font ?? Math.min(12, cell * 0.32),
          mono: true,
          color: a > 0.55 ? color('--paper') : color(dim ? '--ink-3' : '--ink-2'),
        });
      }
    }
  if (o.diag !== false) {
    c.strokeStyle = color('gold');
    c.lineWidth = 2;
    for (let i = 0; i < Math.min(n, m); i++) c.strokeRect(x + i * cell + 1.5, y + i * cell + 1.5, cell - 3, cell - 3);
  }
  if (o.hiRow !== undefined && o.hiRow >= 0) {
    c.strokeStyle = color('--ink');
    c.lineWidth = 1.5;
    c.strokeRect(x + 0.5, y + o.hiRow * cell + 0.5, m * cell - 1, cell - 1);
  }
}

/** A small check (or cross) badge. */
export function badge(c: CanvasRenderingContext2D, x: number, y: number, r: number, ok: boolean): void {
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = color(ok ? 'green' : 'red');
  c.fill();
  c.strokeStyle = '#fff';
  c.lineWidth = Math.max(1.2, r * 0.32);
  c.lineCap = 'round';
  c.beginPath();
  if (ok) {
    c.moveTo(x - r * 0.45, y + r * 0.02);
    c.lineTo(x - r * 0.1, y + r * 0.38);
    c.lineTo(x + r * 0.48, y - r * 0.35);
  } else {
    c.moveTo(x - r * 0.38, y - r * 0.38);
    c.lineTo(x + r * 0.38, y + r * 0.38);
    c.moveTo(x - r * 0.38, y + r * 0.38);
    c.lineTo(x + r * 0.38, y - r * 0.38);
  }
  c.stroke();
}

/** A unit circle with faint axes, centered at (cx, cy) with radius R in px. */
export function unitCircle(c: CanvasRenderingContext2D, cx: number, cy: number, R: number): void {
  c.strokeStyle = color('--grid');
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(cx - R * 1.12, cy);
  c.lineTo(cx + R * 1.12, cy);
  c.moveTo(cx, cy - R * 1.12);
  c.lineTo(cx, cy + R * 1.12);
  c.stroke();
  c.strokeStyle = color('--axis');
  c.lineWidth = 1.2;
  c.beginPath();
  c.arc(cx, cy, R, 0, Math.PI * 2);
  c.stroke();
}

/** Converts canvas pointer coordinates to CSS px within the canvas. */
export function localXY(canvas: HTMLCanvasElement, e: PointerEvent): [number, number] {
  const r = canvas.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}

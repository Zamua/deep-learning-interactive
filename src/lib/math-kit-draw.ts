import { fmt } from '../core/code';
import { type Plot, color, withAlpha } from '../core/plot';

export const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";
export const SERIF = "'Source Serif 4 Variable', Georgia, serif";
export const UI = 'system-ui, -apple-system, sans-serif';

export const mono = (size: number, weight = 500): string => `${weight} ${size}px ${MONO}`;
export const ui = (size: number, weight = 400): string => `${weight} ${size}px ${UI}`;
export const ital = (size: number, weight = 600): string => `italic ${weight} ${size}px ${SERIF}`;

export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const snap = (v: number, s = 0.5): number => Math.round(v / s) * s;

/** Python float repr for the common cases: 3 -> "3.0", 0.25 -> "0.25". */
export function pyf(v: number, digits = 4): string {
  if (Number.isNaN(v)) return 'nan';
  if (!Number.isFinite(v)) return v > 0 ? 'inf' : '-inf';
  if (Number.isInteger(v) && Math.abs(v) < 1e15) return v.toFixed(1);
  return fmt(v, digits);
}

/** A list literal of numbers: ints stay ints unless `float` is set. */
export function pyList(vals: number[], float: boolean, digits = 4): string {
  return `[${vals.map((v) => (float ? pyf(v, digits) : fmt(v, digits))).join(', ')}]`;
}

/** A rounded, tinted cell with a centered label, as used by the grid figures. */
export function cellBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  col: string,
  opts: { on?: boolean; dim?: boolean; size?: number; fill?: number; ink?: string; radius?: number } = {},
): void {
  const { on = false, dim = false } = opts;
  ctx.beginPath();
  ctx.roundRect(x + 1.5, y + 1.5, w - 3, h - 3, opts.radius ?? Math.min(6, w * 0.15));
  ctx.fillStyle = withAlpha(col, opts.fill ?? (on ? 0.3 : dim ? 0.04 : 0.11));
  ctx.fill();
  ctx.strokeStyle = on ? col : withAlpha(col, dim ? 0.25 : 0.5);
  ctx.lineWidth = on ? 2 : 1;
  ctx.stroke();
  if (!label) return;
  ctx.fillStyle = opts.ink ?? (dim ? color('--ink-3') : color('--ink'));
  ctx.font = mono(opts.size ?? Math.max(11, Math.min(15, h * 0.36)));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + h / 2 + 0.5);
}

/** Text with a paper-colored halo so it stays legible over lines and tints. */
export function haloText(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, fill: string, fontCss: string, align: CanvasTextAlign = 'left', base: CanvasTextBaseline = 'middle'): void {
  ctx.font = fontCss;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = withAlpha(color('--paper'), 0.92);
  ctx.strokeText(s, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
}

/** An italic math-style label at data coordinates on a Plot. */
export function plotLabel(pl: Plot, s: string, x: number, y: number, col: string, size = 16, align: CanvasTextAlign = 'center'): void {
  haloText(pl.ctx, s, pl.sx(x), pl.sy(y), col, ital(size), align);
}

/**
 * Lets the reader drag whichever handle is nearest the pointer. `move` gets the handle index and
 * the pointer position in data coordinates.
 */
export function dragNearest(pl: Plot, handles: () => [number, number][], move: (i: number, x: number, y: number) => void, onStart?: () => void): void {
  let active = -1;
  pl.canvas.addEventListener('pointerdown', (e) => {
    const [mx, my] = pl.pointer(e);
    let best = 0;
    let bd = Infinity;
    handles().forEach(([x, y], i) => {
      const d = Math.hypot(pl.sx(x) - pl.sx(mx), pl.sy(y) - pl.sy(my));
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    active = best;
    onStart?.();
    pl.canvas.setPointerCapture(e.pointerId);
    move(active, mx, my);
  });
  pl.canvas.addEventListener('pointermove', (e) => {
    if (active < 0) return;
    const [mx, my] = pl.pointer(e);
    move(active, mx, my);
  });
  const up = () => (active = -1);
  pl.canvas.addEventListener('pointerup', up);
  pl.canvas.addEventListener('pointercancel', up);
}

/** A toothed gear outline centered at (cx, cy), rotated by `ang` radians. */
export function gear(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, ang: number, col: string, teeth = 10): void {
  const inner = r * 0.78;
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = ang + (i * Math.PI) / teeth;
    const a1 = ang + ((i + 1) * Math.PI) / teeth;
    ctx.arc(cx, cy, i % 2 === 0 ? r : inner, a0, a1);
  }
  ctx.closePath();
  ctx.fillStyle = withAlpha(col, 0.16);
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(ang) * inner * 0.85, cy + Math.sin(ang) * inner * 0.85);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = col;
  ctx.fill();
}

/** A straight arrow in CSS px (for hand-built canvases without a Plot). */
export function pxArrow(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col: string, width = 1.5, head = 7): void {
  const a = Math.atan2(y1 - y0, x1 - x0);
  ctx.strokeStyle = ctx.fillStyle = col;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1 - Math.cos(a) * head * 0.7, y1 - Math.sin(a) * head * 0.7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - head * Math.cos(a - 0.45), y1 - head * Math.sin(a - 0.45));
  ctx.lineTo(x1 - head * Math.cos(a + 0.45), y1 - head * Math.sin(a + 0.45));
  ctx.closePath();
  ctx.fill();
}

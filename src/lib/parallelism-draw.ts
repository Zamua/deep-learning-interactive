// Canvas helpers for the parallelism chapter's figures (CSS px, theme-aware colors).
import type { Fig } from '../core/page';
import { color, withAlpha } from '../core/plot';
import type { Color } from '../core/symbols';
import type { PartKey } from './parallelism-math';

export const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";
export const UI = 'system-ui, -apple-system, sans-serif';

export interface TxtOpts {
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  base?: CanvasTextBaseline;
  weight?: number;
  mono?: boolean;
  halo?: boolean;
}

export function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, o: TxtOpts = {}): void {
  const size = o.size ?? 12;
  ctx.font = `${o.weight ?? 500} ${size}px ${o.mono ? MONO : UI}`;
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.base ?? 'middle';
  if (o.halo) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = color('--paper');
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = o.color ?? color('--ink');
  ctx.fillText(s, x, y);
}

export function textW(ctx: CanvasRenderingContext2D, s: string, size = 12, mono = false, weight = 500): number {
  ctx.font = `${weight} ${size}px ${mono ? MONO : UI}`;
  return ctx.measureText(s).width;
}

export function rbox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, lw = 1): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

/** Diagonal hatching inside a rectangle: idle or wasted time. */
export function hatch(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string, gap = 5): void {
  if (w <= 0 || h <= 0) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = col;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = -h; k < w; k += gap) {
    ctx.moveTo(x + k, y + h);
    ctx.lineTo(x + k + h, y);
  }
  ctx.stroke();
  ctx.restore();
}

export function arrowLine(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col: string, lw = 1.5, head = 7): void {
  const a = Math.atan2(y1 - y0, x1 - x0);
  const L = Math.hypot(x1 - x0, y1 - y0);
  const hl = Math.min(head, L * 0.45);
  ctx.strokeStyle = ctx.fillStyle = col;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1 - Math.cos(a) * hl * 0.7, y1 - Math.sin(a) * hl * 0.7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x1 - hl * Math.cos(a - 0.42), y1 - hl * Math.sin(a - 0.42));
  ctx.lineTo(x1 - hl * Math.cos(a + 0.42), y1 - hl * Math.sin(a + 0.42));
  ctx.closePath();
  ctx.fill();
}

/** Colors of the memory parts: the three optimizer-state pieces share one hue at three strengths. */
export const PART_COLOR: Record<PartKey, { k: Color; a: number }> = {
  w: { k: 'blue', a: 0.85 },
  g: { k: 'teal', a: 0.85 },
  master: { k: 'gold', a: 0.95 },
  am: { k: 'gold', a: 0.68 },
  av: { k: 'gold', a: 0.42 },
  act: { k: 'orange', a: 0.8 },
};
export const partFill = (k: PartKey): string => withAlpha(color(PART_COLOR[k].k), PART_COLOR[k].a);

/** A wrapped row of colored swatches and labels under a figure. */
export function legend(f: Fig): (items: { fill: string; label: string; note?: string; bold?: boolean }[]) => void {
  const el = document.createElement('div');
  el.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px 14px;font:12.5px system-ui,sans-serif;color:var(--ink-2)';
  f.viz.append(el);
  return (items) => {
    el.innerHTML = items
      .map(
        (it) =>
          `<span style="display:inline-flex;align-items:center;gap:5px;${it.bold ? 'font-weight:650;color:var(--ink)' : ''}"><span style="width:11px;height:11px;border-radius:3px;background:${it.fill}"></span>${it.label}${it.note ? ` <span style="font-family:var(--font-mono);font-size:11.5px;color:var(--ink-3)">${it.note}</span>` : ''}</span>`,
      )
      .join('');
  };
}

/** A heat-tinted matrix of cells: tint strength follows |value|, hue follows sign (negative = gray). */
export function heat(ctx: CanvasRenderingContext2D, x: number, y: number, cs: number, M: number[][], k: Color, o: { max?: number; nums?: boolean; dim?: boolean; outline?: string } = {}): void {
  const mx = o.max ?? Math.max(1e-9, ...M.flat().map(Math.abs));
  const pos = color(k);
  const neg = color('--ink-3');
  M.forEach((row, i) =>
    row.forEach((v, j) => {
      const a = 0.12 + 0.68 * Math.min(1, Math.abs(v) / mx);
      ctx.fillStyle = withAlpha(v >= 0 ? pos : neg, o.dim ? a * 0.35 : a);
      ctx.fillRect(x + j * cs + 0.5, y + i * cs + 0.5, cs - 1, cs - 1);
      if (o.nums && cs >= 22) txt(ctx, v.toFixed(1), x + j * cs + cs / 2, y + i * cs + cs / 2 + 0.5, { size: Math.min(11, cs * 0.36), mono: true, align: 'center', color: color('--ink') });
    }),
  );
  ctx.strokeStyle = o.outline ?? withAlpha(pos, o.dim ? 0.3 : 0.8);
  ctx.lineWidth = o.outline ? 2 : 1;
  ctx.strokeRect(x + 0.5, y + 0.5, M[0]!.length * cs - 1, M.length * cs - 1);
}

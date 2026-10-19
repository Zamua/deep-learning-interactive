import { type Plot, CLASS_COLORS, color, withAlpha } from '../core/plot';
import type { Fig } from '../core/page';
import type { Color } from '../core/symbols';

export const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";
export const mono = (sz: number, wt = 500): string => `${wt} ${sz}px ${MONO}`;
export const ui = (sz: number, wt = 500): string => `${wt} ${sz}px system-ui, -apple-system, sans-serif`;

/** A distinct palette color per request id. */
export const reqColor = (id: number): string => color(CLASS_COLORS[id % CLASS_COLORS.length]!);

export function txt(
  c: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  o: { font?: string; color?: string; align?: CanvasTextAlign; base?: CanvasTextBaseline } = {},
): void {
  c.font = o.font ?? ui(12);
  c.fillStyle = o.color ?? color('--ink-2');
  c.textAlign = o.align ?? 'left';
  c.textBaseline = o.base ?? 'middle';
  c.fillText(s, x, y);
}

export function box(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, lw = 1): void {
  if (w <= 0 || h <= 0) return;
  c.beginPath();
  c.roundRect(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
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

/** Grid lines at data values along one axis of a plot, labelled at the edge. */
export function gridLines(pl: Plot, axis: 'x' | 'y', vals: number[], label: (v: number) => string): void {
  const c = pl.ctx;
  c.font = mono(10.5);
  c.fillStyle = color('--ink-3');
  for (const v of vals) {
    c.strokeStyle = color('--grid');
    c.lineWidth = 1;
    c.beginPath();
    if (axis === 'y') {
      const y = Math.round(pl.sy(v)) + 0.5;
      c.moveTo(0, y);
      c.lineTo(pl.w, y);
      c.stroke();
      c.textAlign = 'left';
      c.textBaseline = 'bottom';
      c.fillText(label(v), 4, y - 2);
    } else {
      const x = Math.round(pl.sx(v)) + 0.5;
      c.moveTo(x, 0);
      c.lineTo(x, pl.h);
      c.stroke();
      c.textAlign = x < 24 ? 'left' : x > pl.w - 24 ? 'right' : 'center';
      c.textBaseline = 'bottom';
      c.fillText(label(v), x, pl.h - 3);
    }
  }
}

/** Powers of ten as compact labels: 1, 10, 100, 1k, 10k ... */
export function pow10(e: number): string {
  if (e < 0) return String(10 ** e);
  if (e < 3) return String(10 ** e);
  if (e < 6) return `${10 ** (e - 3)}k`;
  return `${10 ** (e - 6)}M`;
}

/** A wrapped row of colored swatches and labels under a figure. */
export function legend(f: Fig): (items: { k: Color | string; label: string; dash?: boolean }[]) => void {
  const el = document.createElement('div');
  el.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px 14px;font:12.5px system-ui,sans-serif;color:var(--ink-2);margin-top:2px';
  f.viz.append(el);
  return (items) => {
    el.innerHTML = items
      .map((it) => {
        const bg = it.k.startsWith('#') || it.k.startsWith('rgb') ? it.k : `var(--c-${it.k})`;
        const sw = it.dash
          ? `<span style="width:14px;height:0;border-top:2px dashed ${bg}"></span>`
          : `<span style="width:10px;height:10px;border-radius:3px;background:${bg}"></span>`;
        return `<span style="display:inline-flex;align-items:center;gap:5px">${sw}${it.label}</span>`;
      })
      .join('');
  };
}

/** Diagonal hatching inside a rectangle, for capacity that is reserved or wasted. */
export function hatch(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, col: string, gap = 5): void {
  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  c.strokeStyle = col;
  c.lineWidth = 1;
  c.beginPath();
  for (let d = -h; d < w; d += gap) {
    c.moveTo(x + d, y + h);
    c.lineTo(x + d + h, y);
  }
  c.stroke();
  c.restore();
}

export { color, withAlpha };

/** Phone-width page: canvases take a taller aspect so labels keep their room. */
export const narrow = (): boolean => window.innerWidth < 700;

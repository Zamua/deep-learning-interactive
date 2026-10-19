import type { Fig } from '../core/page';
import { onDispose } from '../core/dom';
import { color, withAlpha } from '../core/plot';
import type { Color } from '../core/symbols';
import { MONO, UI } from './math-kit-draw';
import { ANSWER as ANS_TOKEN, CHECK, type Rollout } from './grpo-toy';

export const mono = (px: number, wt = 500): string => `${wt} ${px}px ${MONO}`;
export const ui = (px: number, wt = 400): string => `${wt} ${px}px ${UI}`;

/** Token colors of the toy world: work a column, check the work, write the answer. */
export const TOKEN_COLORS: Color[] = ['blue', 'orange', 'purple'];

/**
 * A HiDPI canvas whose height follows its width through `heightFor`, so rows of text keep a
 * readable size on a phone instead of shrinking with a fixed aspect ratio.
 */
export function fitCanvas(f: Fig, heightFor: (w: number) => number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, host?: HTMLElement): { canvas: HTMLCanvasElement; redraw(): void; refit(): void } {
  const cv = f.canvas(640, 400, draw);
  const box = host ?? f.viz;
  if (host) host.append(cv.canvas);
  let last = '';
  const refit = () => {
    const w = box.clientWidth || 640;
    const want = `${Math.round(w)} / ${Math.round(heightFor(w))}`;
    if (want !== last) {
      last = want;
      cv.canvas.style.aspectRatio = want;
    }
  };
  const ro = new ResizeObserver(refit);
  ro.observe(box);
  onDispose(() => ro.disconnect());
  refit();
  return { ...cv, refit };
}

/** Two columns that sit side by side when there is room and stack when there is not. */
export function twoUp(f: Fig, minLeft = 330, minRight = 300): [HTMLElement, HTMLElement] {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start';
  const a = document.createElement('div');
  a.style.cssText = `flex:1.15 1 ${minLeft}px;min-width:0`;
  const b = document.createElement('div');
  b.style.cssText = `flex:1 1 ${minRight}px;min-width:0`;
  row.append(a, b);
  f.viz.append(row);
  return [a, b];
}

export function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, lw = 1): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
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

export function txt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, fill: string, align: CanvasTextAlign = 'left', base: CanvasTextBaseline = 'middle'): void {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = base;
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
}

/** Text shrunk (down to 9px) to fit `maxW`. */
export function fitTxt(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, maxW: number, px: number, wt: number, fill: string, align: CanvasTextAlign = 'left'): void {
  ctx.font = ui(px, wt);
  const w = ctx.measureText(s).width;
  const size = w > maxW ? Math.max(9, (px * maxW) / w) : px;
  txt(ctx, s, x, y, ui(size, wt), fill, align);
}

/** A filled disc with a check mark (reward 1) or a cross (reward 0). */
export function badge(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, ok: boolean, alpha = 1): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = withAlpha(color(ok ? 'green' : 'red'), 0.9 * alpha);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(1.4, r * 0.28);
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (ok) {
    ctx.moveTo(cx - r * 0.45, cy + r * 0.02);
    ctx.lineTo(cx - r * 0.1, cy + r * 0.38);
    ctx.lineTo(cx + r * 0.5, cy - r * 0.35);
  } else {
    ctx.moveTo(cx - r * 0.38, cy - r * 0.38);
    ctx.lineTo(cx + r * 0.38, cy + r * 0.38);
    ctx.moveTo(cx + r * 0.38, cy - r * 0.38);
    ctx.lineTo(cx - r * 0.38, cy + r * 0.38);
  }
  ctx.stroke();
}

/** The color for an advantage value: teal above the group, red below, grey at zero. */
export function advColor(A: number): string {
  return Math.abs(A) < 1e-6 ? color('--ink-3') : color(A > 0 ? 'teal' : 'red');
}

/**
 * One sampled response as a row of token chips. With `tint` each chip is washed in the color of
 * the response's advantage, the picture of "every token gets the same Â".
 */
export function tokenRow(ctx: CanvasRenderingContext2D, ro: Rollout, x: number, y: number, cw: number, ch: number, opts: { tint?: number; maxW?: number } = {}): number {
  let cx = x;
  const fs = Math.max(10, Math.min(13, ch * 0.58));
  ro.acts.forEach((a, t) => {
    const label = ro.shown[t]!;
    const font = mono(fs, a === ANS_TOKEN ? 650 : 500);
    ctx.font = font;
    const w = a === ANS_TOKEN ? Math.max(cw * 1.9, ctx.measureText(label).width + 10) : cw;
    if (opts.maxW && cx + w > x + opts.maxW) return;
    const col = color(TOKEN_COLORS[a]!);
    const fill = opts.tint !== undefined ? withAlpha(advColor(opts.tint), 0.12 + Math.min(0.35, Math.abs(opts.tint) * 0.22)) : withAlpha(col, 0.14);
    rrect(ctx, cx + 1, y + 1, w - 2, ch - 2, 4, fill, withAlpha(col, 0.85), a === ANS_TOKEN ? 1.6 : 1);
    txt(ctx, a === CHECK ? '✓' : label, cx + w / 2, y + ch / 2 + 0.5, font, a === CHECK ? col : color('--ink'), 'center');
    cx += w;
  });
  return cx - x;
}

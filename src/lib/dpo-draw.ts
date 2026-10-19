import { fmt } from '../core/code';
import { type Plot, color, withAlpha } from '../core/plot';
import type { Color } from '../core/symbols';
import { ANSWERS } from './dpo-toy';

export const UI = 'system-ui, -apple-system, sans-serif';
export const MONO = "'JetBrains Mono Variable', ui-monospace, monospace";

export interface BarSet {
  vals: readonly number[];
  col: Color;
  kind: 'fill' | 'line' | 'dash';
  name: string;
}

/** CSS px reserved above the bars for the legend and below them for the answer labels. */
const TOP = 30;
const BOTTOM = 36;

/**
 * Grouped bars over the four toy answers, one bar per set side by side, with a legend on top
 * and the answer letters below. Sets the plot's domain itself so the margins stay in px.
 */
export function answerChart(
  pl: Plot,
  sets: BarSet[],
  o: { ymax?: number; values?: number; hot?: number; grid?: boolean; extra?: LegendItem[] } = {},
): { x(i: number, k: number): number; bw: number } {
  const ymax = o.ymax ?? 1;
  const inner = Math.max(40, pl.h - TOP - BOTTOM);
  const per = ymax / inner;
  pl.setDomain(0, 4, -BOTTOM * per, ymax + TOP * per);
  const c = pl.ctx;
  const n = sets.length;
  const group = 0.74;
  const bw = group / n;
  const x = (i: number, k: number) => i + 0.5 - group / 2 + bw * (k + 0.5);
  if (o.grid !== false) {
    c.strokeStyle = color('--grid');
    c.lineWidth = 1;
    for (const g of [0.25, 0.5, 0.75, 1].map((f) => f * ymax)) {
      c.beginPath();
      c.moveTo(0, Math.round(pl.sy(g)) + 0.5);
      c.lineTo(pl.w, Math.round(pl.sy(g)) + 0.5);
      c.stroke();
    }
    c.fillStyle = color('--ink-3');
    c.font = `10.5px ${MONO}`;
    c.textAlign = 'left';
    c.textBaseline = 'bottom';
    c.fillText(fmt(ymax, 2), 3, pl.sy(ymax) - 2);
  }
  c.strokeStyle = color('--axis');
  c.beginPath();
  c.moveTo(0, Math.round(pl.sy(0)) + 0.5);
  c.lineTo(pl.w, Math.round(pl.sy(0)) + 0.5);
  c.stroke();
  for (let i = 0; i < 4; i++) {
    const hot = o.hot === i;
    if (hot) {
      c.fillStyle = withAlpha(color('--accent'), 0.08);
      c.fillRect(pl.sx(i + 0.04), pl.sy(ymax + TOP * per * 0.2), pl.sx(i + 0.96) - pl.sx(i + 0.04), pl.sy(0) - pl.sy(ymax + TOP * per * 0.2));
    }
    sets.forEach((s, k) => {
      const v = Math.max(0, Math.min(ymax, s.vals[i]!));
      const col = color(s.col);
      const x0 = pl.sx(x(i, k) - bw * 0.42);
      const x1 = pl.sx(x(i, k) + bw * 0.42);
      const y0 = pl.sy(0);
      const y1 = pl.sy(v);
      c.beginPath();
      c.rect(x0, y1, x1 - x0, y0 - y1);
      if (s.kind === 'fill') {
        c.fillStyle = withAlpha(col, 0.72);
        c.fill();
        c.strokeStyle = col;
        c.lineWidth = 1.5;
        c.stroke();
      } else {
        c.fillStyle = withAlpha(col, s.kind === 'line' ? 0.12 : 0.04);
        c.fill();
        c.strokeStyle = col;
        c.lineWidth = 1.6;
        c.setLineDash(s.kind === 'dash' ? [4, 3] : []);
        c.stroke();
        c.setLineDash([]);
      }
    });
    if (o.values !== undefined) {
      const k = o.values;
      const v = sets[k]!.vals[i]!;
      c.fillStyle = color('--ink');
      c.font = `600 11px ${MONO}`;
      c.textAlign = 'center';
      c.textBaseline = 'bottom';
      c.fillText(v < 0.0095 && v > 0 ? '<.01' : fmt(v, 2), pl.sx(x(i, k)), Math.max(TOP - 1, pl.sy(Math.min(v, ymax)) - 3));
    }
    c.fillStyle = color('--ink');
    c.font = `700 13px ${UI}`;
    c.textAlign = 'center';
    c.textBaseline = 'top';
    c.fillText(ANSWERS[i]!.key, pl.sx(i + 0.5), pl.sy(0) + 5);
    c.fillStyle = color('--ink-3');
    c.font = `11px ${UI}`;
    c.fillText(ANSWERS[i]!.short, pl.sx(i + 0.5), pl.sy(0) + 20);
  }
  legend(pl, [...sets.map((s) => ({ name: s.name, col: s.col, kind: s.kind })), ...(o.extra ?? [])]);
  return { x, bw };
}

export interface LegendItem {
  name: string;
  col: Color | `--${string}`;
  kind: 'fill' | 'line' | 'dash' | 'curve';
}

/** A one-line legend across the top of a plot. */
export function legend(pl: Plot, items: LegendItem[], y = 13): void {
  const c = pl.ctx;
  c.font = `11.5px ${UI}`;
  c.textBaseline = 'middle';
  c.textAlign = 'left';
  const widths = items.map((it) => 16 + c.measureText(it.name).width + 12);
  const total = widths.reduce((a, b) => a + b, 0);
  let xx = Math.max(4, (pl.w - total) / 2);
  items.forEach((it, k) => {
    const col = color(it.col);
    if (it.kind === 'curve') {
      c.strokeStyle = col;
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(xx, y);
      c.lineTo(xx + 11, y);
      c.stroke();
    } else {
      c.beginPath();
      c.rect(xx + 0.5, y - 5.5, 10, 11);
      c.fillStyle = withAlpha(col, it.kind === 'fill' ? 0.72 : it.kind === 'line' ? 0.12 : 0.04);
      c.fill();
      c.strokeStyle = col;
      c.lineWidth = 1.4;
      c.setLineDash(it.kind === 'dash' ? [3, 2] : []);
      c.stroke();
      c.setLineDash([]);
    }
    c.fillStyle = color('--ink-2');
    c.fillText(it.name, xx + 16, y + 0.5);
    xx += widths[k]!;
  });
}

/** Text with a card-colored halo, for labels that sit on lines or fills. */
export function halo(pl: Plot, s: string, px: number, py: number, o: { col?: string; size?: number; bold?: boolean; mono?: boolean; align?: CanvasTextAlign; base?: CanvasTextBaseline } = {}): void {
  const c = pl.ctx;
  c.font = `${o.bold ? '600 ' : ''}${o.size ?? 11.5}px ${o.mono ? MONO : UI}`;
  c.textAlign = o.align ?? 'left';
  c.textBaseline = o.base ?? 'middle';
  c.lineJoin = 'round';
  c.lineWidth = 3.5;
  c.strokeStyle = color('--card');
  c.strokeText(s, px, py);
  c.fillStyle = o.col ?? color('--ink-2');
  c.fillText(s, px, py);
}

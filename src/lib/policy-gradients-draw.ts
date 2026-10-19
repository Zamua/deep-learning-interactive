import { fmt } from '../core/code';
import { color, withAlpha } from '../core/plot';
import type { Color } from '../core/symbols';

export type Ctx = CanvasRenderingContext2D;
export type Rect = [number, number, number, number];

export const UI = 'system-ui, -apple-system, sans-serif';
export const MONO_F = "'JetBrains Mono Variable', ui-monospace, monospace";

export function txt(c: Ctx, s: string, x: number, y: number, o: { size?: number; color?: string; align?: CanvasTextAlign; base?: CanvasTextBaseline; mono?: boolean; weight?: number; halo?: boolean } = {}): void {
  c.font = `${o.weight ?? 400} ${o.size ?? 12}px ${o.mono ? MONO_F : UI}`;
  c.textAlign = o.align ?? 'left';
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

export function textW(c: Ctx, s: string, size = 12, mono = false, weight = 400): number {
  c.font = `${weight} ${size}px ${mono ? MONO_F : UI}`;
  return c.measureText(s).width;
}

export function rrect(c: Ctx, x: number, y: number, w: number, h: number, r: number, fill?: string, stroke?: string, lw = 1): void {
  c.beginPath();
  c.roundRect(x, y, w, h, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
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

export function seg(c: Ctx, x0: number, y0: number, x1: number, y1: number, col: string, lw = 1, dash?: number[]): void {
  c.beginPath();
  c.moveTo(x0, y0);
  c.lineTo(x1, y1);
  c.strokeStyle = col;
  c.lineWidth = lw;
  c.setLineDash(dash ?? []);
  c.stroke();
  c.setLineDash([]);
}

/** Splits a label into at most two lines that fit `maxW`. */
export function wrap2(c: Ctx, s: string, maxW: number, size: number, mono = false): string[] {
  if (textW(c, s, size, mono) <= maxW) return [s];
  const words = s.split(' ');
  for (let k = words.length - 1; k > 0; k--) {
    const a = words.slice(0, k).join(' ');
    const b = words.slice(k).join(' ');
    if (textW(c, a, size, mono) <= maxW && textW(c, b, size, mono) <= maxW) return [a, b];
  }
  return [s];
}

export interface BarOpts {
  labels: string[];
  /** Filled bars, 0..1. */
  pi: number[];
  piColor?: Color;
  /** Outlined comparison bars, 0..1 (e.g. a reference policy or sample frequencies). */
  ghost?: number[];
  ghostColor?: Color;
  /** A tick per answer (e.g. the optimal policy). */
  tick?: number[];
  /** Index drawn with a gold ring. */
  hi?: number;
  /** One small line under each label, e.g. the reward. */
  sub?: string[];
  subColor?: Color;
  /** Value printed above each bar. */
  show?: (i: number) => string;
  max?: number;
  title?: string;
}

/**
 * Probability bars for a handful of answers inside `r`, labels underneath. Returns the
 * bar centers so callers can add marks.
 */
export function answerBars(c: Ctx, r: Rect, o: BarOpts): { xs: number[]; bw: number; y0: number; sy: (v: number) => number } {
  const [x, y, w, h] = r;
  const n = o.labels.length;
  const slot = w / n;
  const bw = Math.min(slot * 0.56, 46);
  const fs = slot < 64 ? 11 : 12;
  const lines = o.labels.map((l) => wrap2(c, l, slot - 4, fs, true));
  const two = lines.some((l) => l.length > 1);
  const labelH = (two ? 2 : 1) * (fs + 3) + (o.sub ? fs + 4 : 0) + 6;
  if (o.title) txt(c, o.title, x + 4, y + 9, { size: 11.5, color: color('--ink-2'), weight: 600 });
  const top = y + (o.title ? 36 : 18);
  const y0 = y + h - labelH;
  const max = o.max ?? 1;
  const sy = (v: number) => y0 - ((y0 - top) * Math.max(0, Math.min(max, v))) / max;
  seg(c, x, y0 + 0.5, x + w, y0 + 0.5, color('--axis'), 1);
  const xs: number[] = [];
  for (let i = 0; i < n; i++) {
    const cx = x + slot * (i + 0.5);
    xs.push(cx);
    const pc = color(o.piColor ?? 'purple');
    const yv = sy(o.pi[i]!);
    if (o.hi === i) rrect(c, cx - bw / 2 - 4, yv - 4, bw + 8, y0 - yv + 4, 5, withAlpha(color('gold'), 0.16), color('gold'), 2);
    rrect(c, cx - bw / 2, yv, bw, y0 - yv, 3, withAlpha(pc, 0.62), pc, 1);
    if (o.ghost) {
      const gc = color(o.ghostColor ?? 'orange');
      const gy = sy(o.ghost[i]!);
      c.save();
      c.setLineDash([4, 3]);
      rrect(c, cx - bw / 2 - 2, gy, bw + 4, y0 - gy, 3, undefined, gc, 1.6);
      c.restore();
    }
    if (o.tick) {
      const ty = sy(o.tick[i]!);
      seg(c, cx - bw / 2 - 6, ty, cx + bw / 2 + 6, ty, color('--ink'), 2.2);
    }
    if (o.show) txt(c, o.show(i), cx, Math.min(yv, o.ghost ? sy(o.ghost[i]!) : yv) - (o.hi === i ? 13 : 8), { size: 11, mono: true, align: 'center', color: color('--ink-2') });
    lines[i]!.forEach((l, k) => txt(c, l, cx, y0 + 10 + k * (fs + 3), { size: fs, mono: true, align: 'center', color: color('--ink'), weight: o.hi === i ? 600 : 400 }));
    if (o.sub) txt(c, o.sub[i]!, cx, y0 + 12 + (two ? 2 : 1) * (fs + 3), { size: fs - 0.5, mono: true, align: 'center', color: color(o.subColor ?? 'gold') });
  }
  return { xs, bw, y0, sy };
}

/** Signed bars around a zero line, e.g. a gradient's components; values print along the bottom edge. */
export function signedBars(c: Ctx, r: Rect, vals: number[], range: number, o: { col?: Color; ticks?: number[]; tickCol?: string; title?: string; fmtDigits?: number; hideValues?: boolean } = {}): number[] {
  const [x, y, w, h] = r;
  const n = vals.length;
  const slot = w / n;
  const bw = Math.min(slot * 0.5, 40);
  const top = y + (o.title ? 18 : 4);
  const mid = top + (y + h - top) / 2;
  const half = (y + h - top) / 2 - 16;
  if (o.title) txt(c, o.title, x, y + 7, { size: 11.5, color: color('--ink-2'), weight: 600 });
  seg(c, x, mid + 0.5, x + w, mid + 0.5, color('--axis'), 1);
  const col = color(o.col ?? 'teal');
  const xs: number[] = [];
  vals.forEach((v, i) => {
    const cx = x + slot * (i + 0.5);
    xs.push(cx);
    const hh = (Math.max(-range, Math.min(range, v)) / range) * half;
    if (Math.abs(hh) > 0.5) rrect(c, cx - bw / 2, hh > 0 ? mid - hh : mid, bw, Math.abs(hh), 2.5, withAlpha(col, 0.6), col, 1);
    if (o.ticks) {
      const th = (Math.max(-range, Math.min(range, o.ticks[i]!)) / range) * half;
      seg(c, cx - bw / 2 - 6, mid - th, cx + bw / 2 + 6, mid - th, o.tickCol ?? color('--ink'), 2.2);
    }
    if (!o.hideValues) txt(c, fmt(v, o.fmtDigits ?? 2), cx, y + h - 5, { size: 10.5, mono: true, align: 'center', color: color('--ink-2'), halo: true });
  });
  return xs;
}

/** Axes for a small line chart; returns data-to-pixel maps. */
export function chartFrame(
  c: Ctx,
  r: Rect,
  dom: [number, number, number, number],
  o: { xTicks?: number[]; yTicks?: number[]; xLabel?: string; yLabel?: string; logX?: boolean; xFmt?: (v: number) => string; title?: string; titleColor?: string } = {},
): { X: (v: number) => number; Y: (v: number) => number } {
  const [x, y, w, h] = r;
  const left = x + 30;
  const right = x + w - 6;
  const top = y + (o.title ? 24 : 8);
  if (o.title) txt(c, o.title, x + 6, y + 9, { size: 11.5, weight: 600, color: o.titleColor ?? color('--ink-2') });
  const bottom = y + h - 20;
  const [x0, x1, y0, y1] = dom;
  const fx = (v: number) => (o.logX ? Math.log10(v) : v);
  const X = (v: number) => left + ((fx(v) - fx(x0)) / (fx(x1) - fx(x0))) * (right - left);
  const Y = (v: number) => bottom - ((v - y0) / (y1 - y0)) * (bottom - top);
  for (const t of o.yTicks ?? []) {
    seg(c, left, Y(t) + 0.5, right, Y(t) + 0.5, color('--grid'), 1);
    txt(c, String(t), left - 5, Y(t), { size: 10.5, mono: true, align: 'right', color: color('--ink-3') });
  }
  for (const t of o.xTicks ?? []) {
    seg(c, X(t) + 0.5, top, X(t) + 0.5, bottom, color('--grid'), 1);
    txt(c, o.xFmt ? o.xFmt(t) : String(t), X(t), bottom + 10, { size: 10.5, mono: true, align: 'center', color: color('--ink-3') });
  }
  seg(c, left, bottom + 0.5, right, bottom + 0.5, color('--axis'), 1);
  seg(c, left + 0.5, top, left + 0.5, bottom, color('--axis'), 1);
  if (o.xLabel) txt(c, o.xLabel, right, bottom - 8, { size: 10.5, align: 'right', color: color('--ink-3'), halo: true });
  if (o.yLabel) txt(c, o.yLabel, left + 6, top + 6, { size: 10.5, color: color('--ink-3'), halo: true });
  return { X, Y };
}

export function polyline(c: Ctx, xs: ArrayLike<number>, ys: ArrayLike<number>, n: number, col: string, lw = 1.5, dash?: number[]): void {
  if (n < 2) return;
  c.beginPath();
  for (let i = 0; i < n; i++) {
    if (i) c.lineTo(xs[i]!, ys[i]!);
    else c.moveTo(xs[i]!, ys[i]!);
  }
  c.strokeStyle = col;
  c.lineWidth = lw;
  c.lineJoin = 'round';
  c.setLineDash(dash ?? []);
  c.stroke();
  c.setLineDash([]);
}

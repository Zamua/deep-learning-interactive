import type { Color } from '../../core/symbols';
import type { Scene } from '../../lecture/scene';

export type K = Color | `--${string}`;
export type Rect = [number, number, number, number];

/** The drawing area: below the scene chip, inside a margin of `pad` stage units. */
export function area(s: Scene, pad = 4): Rect {
  const top = Math.max(46, s.h * 0.1);
  const m = s.u * pad;
  return [m, top, s.w - 2 * m, s.h - top - m];
}

/** The beat currently playing, from a list in script order. */
export function current(s: Scene, ids: string[]): string | null {
  let cur: string | null = null;
  for (const id of ids) if (s.since(id) >= 0) cur = id;
  return cur;
}

/** A rounded box with a centered label, opaque so lines behind it stay hidden. */
export function box(s: Scene, x: number, y: number, w: number, h: number, label: string, k: K, o: { on?: number; size?: number; color?: K; mono?: boolean } = {}): void {
  const on = o.on ?? 0;
  s.rrect(x, y, w, h, 1.6, { fill: s.c('--card') });
  s.rrect(x, y, w, h, 1.6, { fill: s.tint(k, 0.1 + 0.25 * on), stroke: s.tint(k, 0.55 + 0.45 * on), lw: 0.3 + 0.35 * on });
  if (!label) return;
  const size = o.size ?? Math.max(3.2, Math.min(4.2, (h / s.u) * 0.5));
  s.text(label, x + w / 2, y + h / 2 + s.u * 0.15, { size, font: o.mono ? 'mono' : 'ui', weight: 600, color: s.c(o.color ?? '--ink') });
}

/** A rounded tag of text; returns its width. */
export function pill(s: Scene, text: string, x: number, y: number, k: K, o: { size?: number; align?: 'left' | 'center' | 'right'; mono?: boolean } = {}): number {
  const size = o.size ?? 3.4;
  const font = o.mono ? 'mono' : 'ui';
  const tw = s.measure(text, { font, size, weight: 600 });
  const pw = tw + s.u * size * 1.1;
  const ph = s.u * size * 1.75;
  const x0 = o.align === 'left' ? x : o.align === 'right' ? x - pw : x - pw / 2;
  s.rrect(x0, y - ph / 2, pw, ph, size * 0.85, { fill: s.c('--card') });
  s.rrect(x0, y - ph / 2, pw, ph, size * 0.85, { fill: s.tint(k, 0.12), stroke: s.tint(k, 0.75), lw: 0.3 });
  s.text(text, x0 + pw / 2, y + s.u * 0.15, { font, size, weight: 600, color: s.c(k) });
  return pw;
}

/** Largest text size (in u, at most `max`) that fits `text` into `width` px. */
export function fitSize(s: Scene, text: string, width: number, max: number, o: { font?: 'ui' | 'mono' | 'serif' | 'display'; weight?: number } = {}): number {
  const w1 = s.measure(text, { size: 1, font: o.font ?? 'ui', weight: o.weight ?? 600 });
  return Math.min(max, width / Math.max(1, w1));
}

/** Superscript digits, for 10⁻⁴ style labels. */
export const sup = (n: number): string => String(n).replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]!).replace('-', '⁻');

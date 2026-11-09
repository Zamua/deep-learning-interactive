// Drawing helpers any course's scenes can use, on top of the lecture Scene.
import type { Color } from '../core/symbols';
import { smooth, type Ink, type Scene } from './scene';

/** A centered line of mono text at height `y`. */
export function caption(s: Scene, text: string, y: number, k: Ink = '--ink-2', size = 3.4): void {
  s.text(text, s.w / 2, y, { size, font: 'mono', color: s.c(k), halo: true });
}

/** Eases from 0 to 1 over `dur` seconds, starting a fraction `f` of the way through beat `id`. */
export const after = (s: Scene, id: string, f: number, dur = 0.5): number => smooth((s.t - s.at(id) - f * (s.end(id) - s.at(id))) / dur);

/** Whether the stage is too narrow for side-by-side panels, which then stack. */
export const stacked = (s: Scene): boolean => s.tall || s.w / s.h < 1.45;

/** A check or a cross with a caption, for "does it pass?" moments. */
export function verdict(s: Scene, ok: boolean, text: string, x: number, y: number, size = 3.8): void {
  const k: Color = ok ? 'green' : 'red';
  s.text(ok ? '✓' : '✗', x, y, { size: size * 1.2, font: 'ui', weight: 700, color: s.c(k) });
  s.text(text, x + size * 1.4 * s.u, y, { size, align: 'left', color: s.c('--ink-2') });
}

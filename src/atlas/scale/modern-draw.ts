// Drawing helpers for the modern-architecture explainers of the scale domain.
import type { Scene, TextOpts } from '../../lecture/scene';
import type { Ink } from '../../lecture/scene';

/** A line of text centered on x, faded in by `a`. */
export function line(s: Scene, a: number, text: string, x: number, y: number, k: Ink = '--ink-2', o: TextOpts = {}): void {
  s.alpha(a, () => s.text(text, x, y, { size: 3.6, color: s.c(k), ...o }));
}


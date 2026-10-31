// Drawing helpers for the language-model explainers.
import type { Ink, Scene } from '../../lecture/scene';

/** x centers for `n` items `pitch` stage units apart, centered on `cx`. */
export function spread(s: Scene, n: number, pitch: number, cx = s.w / 2): number[] {
  return Array.from({ length: n }, (_, i) => cx + (i - (n - 1) / 2) * pitch * s.u);
}

/** A small caption, centered unless aligned. */
export function note(s: Scene, text: string, x: number, y: number, k: Ink = '--ink-3', size = 3.2, align: CanvasTextAlign = 'center'): void {
  s.text(text, x, y, { size, align, color: s.c(k), halo: true });
}

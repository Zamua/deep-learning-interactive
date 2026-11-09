// Drawing helpers for the Nix course: store paths as boxes, references as arrows between them.
import type { Ink, Scene } from '../../lecture/scene';

const LABEL = { size: 3.4, font: 'mono', weight: 600 } as const;
const BOX_H = 8;

/** A store path as a box centered on (x, y), sized to its label; `on` (0 to 1) lights it. Returns its width. */
export function pathBox(s: Scene, x: number, y: number, label: string, k: Ink = '--ink-3', on = 0): number {
  const w = s.measure(label, LABEL) + 5 * s.u;
  const h = BOX_H * s.u;
  s.rrect(x - w / 2, y - h / 2, w, h, 1.2, { fill: s.tint(k, 0.1 + 0.25 * on), stroke: s.tint(k, 0.45 + 0.55 * on), lw: 0.35 });
  s.text(label, x, y, { ...LABEL, color: s.c(on > 0.5 ? k : '--ink') });
  return w;
}

/** A reference: an arrow from the bottom of the box at (x0, y0) to the top of the box at (x1, y1). */
export function reference(s: Scene, x0: number, y0: number, x1: number, y1: number, k: Ink = '--ink-3', width = 0.45): void {
  const half = (BOX_H / 2 + 0.6) * s.u;
  s.arrow(x0, y0 + half, x1, y1 - half, s.c(k), width, 2.4);
}

/** A store path written out, centered on (x, y): the hash colored `k` and the rest in ink. */
export function storePath(s: Scene, x: number, y: number, hash: string, name: string, k: Ink = 'gold', size = 3.3): void {
  const o = { size, font: 'mono', weight: 600, halo: true } as const;
  const parts: [string, string][] = [['/nix/store/', s.c('--ink-3')], [hash, s.c(k)], [`-${name}`, s.c('--ink')]];
  let at = x - parts.reduce((a, [t]) => a + s.measure(t, o), 0) / 2;
  for (const [t, color] of parts) {
    s.text(t, at, y, { ...o, align: 'left', color });
    at += s.measure(t, o);
  }
}

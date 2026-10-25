import type { Scene, SceneDef } from '../../../lecture/scene';
import type { Ink } from '../draw';
import { rich, sub } from '../draw';

/** A matrix drawn to scale, `w` by `h` stage units, with a subscripted name inside. */
function mat(s: Scene, x: number, y: number, w: number, h: number, k: Ink, base: string, low: string, on = 0): void {
  const u = s.u;
  s.rrect(x, y, w * u, h * u, 1, { fill: s.tint(k, 0.16 + 0.2 * on), stroke: s.tint(k, 0.6 + 0.4 * on), lw: 0.3 });
  sub(s, base, low, x + (w * u) / 2, y + (h * u) / 2, { k, size: 2.9, halo: true });
}

const block: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const q = 8;
    const y0 = s.h * 0.1;
    const attn = s.win('attn', 'mlp') + s.ease('total', 0.6);
    const mlp = s.win('mlp', 'small') + s.ease('total', 0.6);
    const ax = cx - 40 * u;
    ['Q', 'K', 'V', 'O'].forEach((n, i) => mat(s, ax + (i % 2) * (q + 2) * u, y0 + 6 * u + Math.floor(i / 2) * (q + 2) * u, q, q, 'teal', 'W', n, attn));
    s.text('d', ax + (q / 2) * u, y0 + 3.5 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
    s.text('d', ax - 1.5 * u, y0 + (6 + q / 2) * u, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
    rich(s, [['attention: ', '--ink-2'], ['4d²', 'teal']], ax + (q + 1) * u, y0 + 31 * u, { size: 3.3, weight: 600 });
    s.alpha(s.ease('mlp', 0.6), () => {
      const mx = cx - 8 * u;
      mat(s, mx, y0 + 2 * u, q, 4 * q, 'gold', 'W', '1', mlp);
      mat(s, mx + (q + 4) * u, y0 + 2 * u, 4 * q, q, 'gold', 'W', '2', mlp);
      s.text('d × 4d', mx + (q + 4 + 2 * q) * u, y0 + 14 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
      s.text('← 4d × d', mx + (q + 2) * u, y0 + 26 * u, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3') });
      rich(s, [['MLP: ', '--ink-2'], ['8d²', 'gold']], mx + 22 * u, y0 + 39 * u, { size: 3.3, weight: 600 });
    });
    s.alpha(s.ease('small', 0.6), () => {
      const y = s.h * 0.66;
      [0, 1, 2].forEach((i) => s.rrect(cx - 40 * u, y - 2 * u + i * 2 * u, (i === 1 ? 16 : 8) * u, 0.8 * u, 0.3, { fill: s.tint('slate', 0.6) }));
      s.text('biases, γ, β: length d or 4d, left out', cx - 21 * u, y, { size: 3, align: 'left', color: s.c('--ink-3') });
    });
    s.alpha(s.ease('total', 0.6), () => {
      rich(s, [['12d²', '--ink'], [' per block: ⅓ attention, ⅔ MLP', '--ink-2']], cx, s.h * 0.8, { size: 3.4, weight: 600 });
      s.alpha(s.ease('total', 0.6, 3.5), () => s.text('d = 1,000  →  12,000,000', cx, s.h * 0.9, { size: 3.4, font: 'mono', weight: 600, color: s.c('--ink') }));
    });
  },
};

const model: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const top = s.h * 0.08;
    const bw = 34;
    const bx = cx - 40 * u;
    for (let i = 0; i < 12; i++) {
      s.alpha(s.ease('stack', 0.4, 0.3 + 0.12 * i), () => s.rrect(bx, top + i * 4.4 * u, bw * u, 3.4 * u, 0.8, { fill: s.tint('teal', 0.22), stroke: s.tint('teal', 0.6), lw: 0.25 }));
    }
    s.alpha(s.ease('stack', 0.6, 2), () => {
      s.text('12 blocks × 12M', bx + (bw / 2) * u, top + 56 * u, { size: 3.1, font: 'mono', color: s.c('--ink-2') });
      s.text('= 144M', bx + (bw / 2) * u, top + 62 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('teal') });
    });
    s.alpha(s.ease('embed', 0.6), () => {
      const ex = cx + 14 * u;
      // Area to scale with the blocks: 50M against 144M.
      s.rrect(ex, top, 12 * u, 51.6 * u, 1, { fill: s.tint('orange', 0.2), stroke: s.tint('orange', 0.6), lw: 0.3 });
      s.text('E', ex + 6 * u, top + 26 * u, { size: 4, font: 'mono', weight: 650, color: s.c('orange'), halo: true });
      s.text('V rows', ex + 14 * u, top + 26 * u, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3') });
      s.text('V × d = 50M', ex + 6 * u, top + 56 * u, { size: 3.1, font: 'mono', color: s.c('--ink-2') });
      s.alpha(s.ease('embed', 0.6, 4), () => rich(s, [['144M + 50M = ', '--ink-2'], ['194M', '--ink']], cx, s.h * 0.8, { size: 3.6, weight: 650 }));
    });
    s.alpha(s.ease('scale', 0.6), () => s.text('2× d → 4× the blocks     2× blocks → 2×', cx, s.h * 0.91, { size: 3.2, font: 'mono', color: s.c('--ink-2') }));
  },
};

export const scenes: Record<string, SceneDef> = { block, model };

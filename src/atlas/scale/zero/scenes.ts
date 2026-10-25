import type { Scene, SceneDef } from '../../../lecture/scene';
import { bars, columns } from '../../draw';
import { gpu, mono, stack } from '../draw';

const PARTS = [
  { n: 2, k: 'blue', name: 'w' },
  { n: 2, k: 'red', name: 'grad' },
  { n: 4, k: 'purple', name: 'master' },
  { n: 4, k: 'orange', name: 'm' },
  { n: 4, k: 'teal', name: 'v' },
] as const;

/**
 * Each GPU's training state as a bar of bytes per parameter. `shard` says how far each part has
 * shrunk to its quarter, 0 to 1: [weights, gradients, optimizer state].
 */
function rows(s: Scene, shard: [number, number, number], gb: string, o: { names?: number; hl?: number } = {}): void {
  const unit = 4;
  const x0 = s.w / 2 - (s.tall ? 34 : 30) * s.u;
  const scale = (i: number) => 1 - 0.75 * (i === 0 ? shard[0] : i === 1 ? shard[1] : shard[2]);
  for (let g = 0; g < 4; g++) {
    const y = s.h * (0.24 + g * 0.16);
    mono(s, `GPU ${g}`, x0 - 3 * s.u, y, { size: 3, k: '--ink-2', align: 'right' });
    const parts = PARTS.map((p, i) => ({ n: p.n * scale(i), k: p.k }));
    const mids = stack(s, x0, y, unit, 8, parts);
    const end = x0 + parts.reduce((a, p) => a + p.n, 0) * unit * s.u;
    mono(s, gb, end + 3 * s.u, y, { size: 3.4, k: '--ink', align: 'left', weight: 650 });
    if (g === 0 && o.names) s.alpha(o.names, () => PARTS.forEach((p, i) => mono(s, p.name, mids[i]!, y - 7 * s.u, { size: 2.9, k: p.k, weight: 650 })));
  }
}

const copies: SceneDef = {
  draw(s) {
    rows(s, [0, 0, 0], '112 GB', { names: s.ease('dp', 0.6, 2) });
    s.alpha(s.ease('dp', 0.6, 4) * (1 - s.ease('idea', 0.5)), () => mono(s, '16 bytes per parameter, on every GPU', s.w / 2, s.h * 0.88, { size: s.tall ? 3.2 : 3.6, k: '--ink-2' }));
    s.alpha(s.ease('idea', 0.6), () => mono(s, 'one copy, spread out: a quarter each', s.w / 2, s.h * 0.88, { size: s.tall ? 3.2 : 3.6, k: 'green', weight: 650 }));
    s.alpha(s.ease('waste', 0.6, 1), () => mono(s, '7 × 10⁹ × 16 bytes = 112 GB', s.w / 2, s.h * 0.08, { size: 3.4, k: '--ink-3' }));
  },
};

const stages: SceneDef = {
  draw(s) {
    const a = s.ease('s1', 1.2, 0.6);
    const b = s.ease('s2', 1.2, 0.6);
    const c = s.ease('s3', 1.2, 0.6);
    const gb = c > 0.5 ? '28 GB' : b > 0.5 ? '38.5 GB' : a > 0.5 ? '49 GB' : '112 GB';
    rows(s, [c, b, a], gb);
    // A legend, since the shrinking parts get too narrow to label.
    const names = PARTS.map((p) => p.name);
    const widths = names.map((n) => s.measure(n, { size: 3, font: 'mono' }) + 6 * s.u);
    let x = s.w / 2 - widths.reduce((acc, w) => acc + w, 0) / 2;
    PARTS.forEach((p, i) => {
      s.rrect(x, s.h * 0.15 - 1.4 * s.u, 2.8 * s.u, 2.8 * s.u, 0.5, { fill: s.tint(p.k, 0.5), stroke: s.c(p.k), lw: 0.25 });
      mono(s, p.name, x + 4 * s.u, s.h * 0.15, { size: 3, k: p.k, align: 'left', weight: 650 });
      x += widths[i]!;
    });
    const label = (text: string, from: string, until?: string) => s.alpha(s.win(from, until), () => mono(s, text, s.w / 2, s.h * 0.08, { size: s.tall ? 3.2 : 3.6, weight: 650 }));
    label('stage 1: optimizer state split 4 ways', 's1', 's2');
    label('stage 2: + the gradients', 's2', 's3');
    label('stage 3: + the weights', 's3');
    s.alpha(s.win('s1n', 's2'), () => mono(s, '4 + 12 / 4 bytes per parameter', s.w / 2, s.h * 0.88, { size: 3.4, k: '--ink-2' }));
    s.alpha(s.win('s2', 's3'), () => mono(s, '2 + 14 / 4 bytes per parameter', s.w / 2, s.h * 0.88, { size: 3.4, k: '--ink-2' }));
    s.alpha(s.ease('s3', 0.6), () => mono(s, '16 / 4 bytes per parameter', s.w / 2, s.h * 0.88, { size: 3.4, k: '--ink-2' }));
  },
};

const cost: SceneDef = {
  draw(s) {
    // Stage 3: each GPU holds a quarter of the weights; a piece is gathered whole, then dropped.
    s.alpha(1 - s.ease('more', 0.5), () => {
      const xs = columns(s, 4, s.tall ? 26 : 30);
      const y = s.h * 0.62;
      xs.forEach((x, g) => {
        gpu(s, x, y, s.tall ? 23 : 26, 24, `GPU ${g}`);
        const q = 4;
        stack(s, x - 2 * 4 * s.u + g * q * s.u, y + 2 * s.u, q, 6, [{ n: 1, k: (['blue', 'orange', 'green', 'purple'] as const)[g]! }]);
      });
      const gather = s.ease('gather', 1, 2);
      const drop = s.ease('gather', 0.8, 5.5);
      s.alpha(gather * (1 - drop), () => {
        const yW = s.h * 0.28;
        xs.forEach((x, g) => s.arrow(x, y - 12 * s.u, s.w / 2 - 6 * s.u + g * 4 * s.u, yW + 5 * s.u, s.tint('--ink-3', 0.9), 0.3, 1.8));
        stack(s, s.w / 2 - 8 * s.u, yW, 4, 6, (['blue', 'orange', 'green', 'purple'] as const).map((k) => ({ n: 1, k })));
        mono(s, 'gathered just before use', s.w / 2, yW - 7 * s.u, { size: 3.2, k: '--ink-2' });
      });
      s.alpha(drop * (1 - s.ease('same', 0.5)), () => mono(s, 'then dropped', s.w / 2, s.h * 0.28, { size: 3.4, k: '--ink-3' }));
      s.alpha(s.ease('same', 0.6), () => {
        mono(s, 'same averaged gradient, same step', s.w / 2, s.h * 0.24, { size: s.tall ? 3.2 : 3.6, k: 'green', weight: 650 });
        mono(s, 'only where the numbers live changes', s.w / 2, s.h * 0.32, { size: s.tall ? 3 : 3.4, k: '--ink-2' });
      });
    });
    s.alpha(s.ease('more', 0.6), () => {
      const xs = columns(s, 4, s.tall ? 22 : 28);
      const base = s.h * 0.8;
      bars(s, xs, base, [112, 28, 7, 1.75], 'purple', { max: 112, height: 52, w: 12, grow: s.ease('more', 1, 0.4), fmt: (v) => `${v} GB` });
      ['1', '4', '16', '64'].forEach((g, i) => mono(s, `${g} GPU${g === '1' ? '' : 's'}`, xs[i]!, base + 4 * s.u, { size: 3, k: '--ink-2' }));
      mono(s, 'stage 3, 7 × 10⁹ parameters: memory per GPU', s.w / 2, s.h * 0.1, { size: s.tall ? 3 : 3.4, k: '--ink-2' });
    });
  },
};

export const scenes: Record<string, SceneDef> = { copies, stages, cost };

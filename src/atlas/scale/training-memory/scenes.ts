import type { Scene, SceneDef } from '../../../lecture/scene';
import { gpu, mono, stack } from '../draw';

const PARTS = [
  { n: 2, k: 'blue', label: '2', name: 'weights', beat: 'w' },
  { n: 2, k: 'red', label: '2', name: 'gradients', beat: 'g' },
  { n: 4, k: 'purple', label: '4', name: 'master copy', beat: 'master' },
  { n: 4, k: 'orange', label: '4', name: 'm', beat: 'mv' },
  { n: 4, k: 'teal', label: '4', name: 'v', beat: 'mv' },
] as const;

const bytes: SceneDef = {
  draw(s) {
    // A 32-bit and a 16-bit number, byte by byte.
    s.alpha(1 - s.ease('w', 0.6), () => {
      const unit = 9;
      const x0 = s.w / 2 - 8 * s.u;
      const nums: [string, number, number][] = [
        ['32-bit number', 4, 0.36],
        ['16-bit number', 2, 0.56],
      ];
      nums.forEach(([name, n, f]) => {
        const y = s.h * f;
        mono(s, name, x0 - 3 * s.u, y, { size: 3.6, k: '--ink-2', align: 'right' });
        stack(s, x0, y, unit, 8, Array.from({ length: n }, () => ({ n: 1, k: 'slate' as const, label: 'B' })), { size: 3 });
        mono(s, `${n} bytes`, x0 + n * unit * s.u + 3 * s.u, y, { size: 3.6, k: '--ink', align: 'left', weight: 650 });
      });
      mono(s, 'B: one byte, 8 bits', s.w / 2, s.h * 0.76, { size: 3.2, k: '--ink-3' });
    });
    const unit = s.tall ? 6 : 6.4;
    const x0 = s.w / 2 - 8 * unit * s.u;
    const y = s.h * 0.42;
    const parts = PARTS.map((p) => ({ n: p.n, k: p.k, label: p.label, a: s.ease(p.beat, 0.6, p.name === 'v' ? 1.2 : 0) }));
    s.alpha(s.ease('w', 0.6), () => {
      mono(s, 'bytes per parameter', s.w / 2, s.h * 0.2, { size: 3.6, k: '--ink-2' });
      const mids = stack(s, x0, y, unit, 10, parts, { size: 3.6 });
      PARTS.forEach((p, i) => {
        const below = i % 2 === 0;
        s.alpha(parts[i]!.a, () => mono(s, p.name, mids[i]!, y + (below ? 9 : -9) * s.u, { size: 3, k: p.k, weight: 650 }));
      });
    });
    s.alpha(s.ease('total', 0.6), () => {
      mono(s, '2 + 2 + 4 + 4 + 4 = 16 bytes', s.w / 2, s.h * 0.68, { size: 4, weight: 650 });
      mono(s, 'the math uses only the first 2', s.w / 2, s.h * 0.78, { size: 3.4, k: 'blue' });
    });
  },
};

/** A GPU card of `cap` GB, filled to `used` GB. */
function card(s: Scene, x: number, y: number, w: number, h: number, used: number, cap: number, name: string, grow: number): void {
  gpu(s, x, y, w, h, name, { size: 2.6 });
  const inner = (h - 7) * s.u;
  const fill = (Math.min(used, cap) / cap) * inner * grow;
  s.rrect(x - (w / 2 - 2) * s.u, y + h / 2 * s.u - 2 * s.u - fill, (w - 4) * s.u, fill, 0.6, { fill: s.tint('purple', 0.45), stroke: s.tint('purple', 0.9), lw: 0.25 });
}

const model: SceneDef = {
  draw(s) {
    const lx = s.w / 2 - (s.tall ? 12 : 16) * s.u;
    const rows: [string, string, string][] = [
      ['n', 'N', '7 × 10⁹ parameters'],
      ['n', 'bytes', '16 × 7 × 10⁹ = 1.12 × 10¹¹'],
      ['gb', 'GB', '112'],
    ];
    s.alpha(1 - s.ease('big', 0.5), () => {
      rows.forEach(([beat, a, b], i) => {
        const y = s.h * (0.1 + i * 0.09);
        s.alpha(s.ease(beat, 0.6, i === 1 ? 1.2 : 0), () => {
          mono(s, a, lx - 2 * s.u, y, { size: 3.8, k: i === 0 ? 'blue' : 'purple', align: 'right', weight: 650 });
          mono(s, b, lx + 2 * s.u, y, { size: s.tall ? 3.4 : 3.8, align: 'left' });
        });
      });
      s.alpha(s.ease('gpu', 0.6), () => {
        const w = 26;
        const h = 34;
        const y = s.h * 0.66;
        card(s, s.w / 2 - 16 * s.u, y, w, h, 80, 80, 'GPU 0: 80 GB', s.ease('gpu', 1.2, 0.4));
        card(s, s.w / 2 + 16 * s.u, y, w, h, 32, 80, 'GPU 1: 80 GB', s.ease('gpu', 1, 1.6));
        s.alpha(s.ease('gpu', 0.6, 2.4), () => mono(s, '112 = 80 + 32', s.w / 2, y + h / 2 * s.u + 5 * s.u, { size: 3.4, k: '--ink-2' }));
      });
    });
    s.alpha(s.ease('big', 0.6), () => {
      mono(s, '70 × 10⁹ parameters × 16 = 1,120 GB', s.w / 2, s.h * 0.1, { size: s.tall ? 3.4 : 3.8, weight: 650 });
      const cols = 7;
      const w = s.tall ? 11 : 12;
      const h = 17;
      for (let i = 0; i < 14; i++) {
        const x = s.w / 2 + ((i % cols) - (cols - 1) / 2) * (w + 2.4) * s.u;
        const y = s.h * 0.34 + Math.floor(i / cols) * (h + 3) * s.u;
        s.alpha(s.ease('big', 0.4, 0.8 + i * 0.12), () => card(s, x, y, w, h, 80, 80, '', 1));
      }
      mono(s, '14 GPUs of 80 GB', s.w / 2, s.h * 0.34 + (2 * h + 6) * s.u, { size: 3.6, k: '--ink-2' });
    });
    s.alpha(s.ease('batch', 0.6), () => {
      mono(s, 'batch of 1 or of 1,000:', s.w / 2, s.h * 0.82, { size: 3.6, k: '--ink-2' });
      mono(s, 'still 16 bytes per parameter', s.w / 2, s.h * 0.9, { size: 3.8, k: 'green', weight: 650 });
    });
  },
};

export const scenes: Record<string, SceneDef> = { bytes, model };

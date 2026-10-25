import type { Scene, SceneDef } from '../../../lecture/scene';
import { mono, stack } from '../draw';

const FORMATS = [
  { name: 'fp32', bits: [1, 8, 23], bytes: '4 bytes', note: '', beat: 'fp32' },
  { name: 'bf16', bits: [1, 8, 7], bytes: '2 bytes', note: 'fp32\'s range, ~3 digits', beat: 'bf16' },
  { name: 'fp16', bits: [1, 5, 10], bytes: '2 bytes', note: 'range: 6×10⁻⁸ to 65,504', beat: 'fp16' },
  { name: 'fp8', bits: [1, 4, 3], bytes: '1 byte', note: '', beat: 'fp8' },
] as const;
const KS = ['slate', 'gold', 'teal'] as const;

/** One format as a strip of bit cells from x0: sign, exponent, mantissa. */
function strip(s: Scene, x0: number, y: number, b: number, bits: readonly number[], counts: number): void {
  let at = 0;
  bits.forEach((n, j) => {
    for (let i = 0; i < n; i++) {
      const x = x0 + (at + i) * b * s.u;
      s.rrect(x + 0.1 * s.u, y - 3 * s.u, b * s.u - 0.2 * s.u, 6 * s.u, 0.4, { fill: s.tint(KS[j]!, 0.4), stroke: s.tint(KS[j]!, 0.85), lw: 0.15 });
    }
    s.alpha(counts, () => mono(s, String(n), x0 + (at + n / 2) * b * s.u, y - 5.4 * s.u, { size: 2.8, k: KS[j]!, weight: 650 }));
    at += n;
  });
}

const formats: SceneDef = {
  draw(s) {
    const b = s.tall ? 2.5 : 2.9;
    const x0 = s.w / 2 - 16 * b * s.u + 7 * s.u;
    FORMATS.forEach((f, i) => {
      const y = s.h * (0.16 + i * 0.2);
      s.alpha(i === 0 ? 1 : s.ease(f.beat, 0.6), () => {
        mono(s, f.name, x0 - 2.5 * s.u, y - 1.4 * s.u, { size: 3.8, weight: 650, align: 'right' });
        mono(s, f.bytes, x0 - 2.5 * s.u, y + 3 * s.u, { size: 2.7, k: '--ink-3', align: 'right' });
        strip(s, x0, y, b, f.bits, 1);
        if (f.note) s.alpha(s.ease(f.beat, 0.6, 2.5), () => mono(s, f.note, x0, y + 6.4 * s.u, { size: 2.9, k: '--ink-2', align: 'left' }));
      });
    });
    s.alpha(s.ease('parts', 0.6), () => {
      const y = s.h * 0.16 + 6.4 * s.u;
      mono(s, 'exponent: range', x0 + 1 * b * s.u, y, { size: 2.9, k: 'gold', align: 'left' });
      mono(s, 'mantissa: precision', x0 + 32 * b * s.u, y, { size: 2.9, k: 'teal', align: 'right' });
    });
  },
};

const master: SceneDef = {
  draw(s) {
    // Memory for the weights in each format.
    s.alpha(1 - s.ease('grid', 0.5), () => {
      const unit = s.tall ? 2.6 : 3;
      const x0 = s.w / 2 - 14 * unit * s.u + 6 * s.u;
      [
        ['fp32', 28, 'purple', 0.3, 0],
        ['bf16', 14, 'teal', 0.5, 1.4],
      ].forEach(([name, gb, k, f, delay]) => {
        const y = s.h * (f as number);
        s.alpha(s.ease('math', 0.6, delay as number), () => {
          mono(s, name as string, x0 - 2.5 * s.u, y, { size: 3.8, weight: 650, align: 'right' });
          stack(s, x0, y, unit, 8, [{ n: gb as number, k: k as 'teal', label: `${gb} GB` }], { size: 3.4, grow: s.ease('math', 1, (delay as number) + 0.3) });
        });
      });
      s.alpha(s.ease('math', 0.6, 3), () => mono(s, '7 × 10⁹ weights', s.w / 2, s.h * 0.12, { size: 3.6, k: '--ink-2' }));
    });
    // bf16's neighbors near 1, and an update too small to reach the next one.
    s.alpha(s.ease('grid', 0.6), () => {
      const l = 10 * s.u;
      const r = s.w - 10 * s.u;
      const X = (v: number) => l + ((v - 0.994) / 0.024) * (r - l);
      const y = s.h * 0.4;
      s.line(l, y, r, y, s.c('--axis'), 0.4);
      [1 - 1 / 256, 1, 1 + 1 / 128, 1 + 2 / 128].forEach((v, i) => {
        s.line(X(v), y - 2.4 * s.u, X(v), y + 2.4 * s.u, s.c('teal'), 0.5);
        mono(s, ['0.9961', '1.0', '1.0078', '1.0156'][i]!, X(v), y + 6 * s.u, { size: 3, k: 'teal' });
      });
      mono(s, 'bf16 numbers near 1', s.w / 2, y - 9 * s.u, { size: 3.4, k: '--ink-2' });
      const lost = s.ease('lost', 0.6);
      s.alpha(lost, () => {
        const snap = s.ease('lost', 0.8, 2.2);
        const x = X(1.0001) + (X(1) - X(1.0001)) * snap;
        s.circle(x, y, 1.4 * s.u, { fill: s.c(snap > 0.5 ? 'red' : 'blue'), stroke: s.c('--card'), lw: 0.3 });
        mono(s, snap > 0.5 ? '1 + 0.0001 → 1.0' : '1 + 0.0001', X(1), y - 4.6 * s.u, { size: 3.2, k: snap > 0.5 ? 'red' : 'blue', align: 'left', halo: true });
      });
    });
    s.alpha(s.ease('copy', 0.6), () => {
      const y0 = s.h * 0.66;
      const lx = s.w / 2 - (s.tall ? 6 : 10) * s.u;
      mono(s, 'fp32 master copy', lx, y0, { size: 3.4, k: 'purple', align: 'right', weight: 650 });
      mono(s, '1.0001  kept', lx + 4 * s.u, y0, { size: 3.6, k: 'green', align: 'left', weight: 650 });
      s.alpha(s.ease('copy', 0.6, 2.5), () => {
        mono(s, 'bf16 copy for the math', lx, y0 + 10 * s.u, { size: 3.4, k: 'teal', align: 'right', weight: 650 });
        mono(s, 'made fresh from it', lx + 4 * s.u, y0 + 10 * s.u, { size: 3.4, k: '--ink-2', align: 'left' });
      });
    });
  },
};

const scaling: SceneDef = {
  draw(s) {
    const l = 11 * s.u;
    const r = s.w - 9 * s.u;
    const X = (e: number) => l + ((e + 12) / 18) * (r - l);
    const y16 = s.h * 0.36;
    const yB = s.h * 0.62;
    // Ticks along the bottom: powers of ten.
    const yt = s.h * 0.8;
    s.line(l, yt, r, yt, s.c('--axis'), 0.35);
    [-12, -8, -4, 0, 4].forEach((e) => {
      s.line(X(e), yt - 1 * s.u, X(e), yt + 1 * s.u, s.c('--axis'), 0.35);
      mono(s, e === 0 ? '1' : `10${String(e).replace('-', '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+d]!)}`, X(e), yt + 4 * s.u, { size: 3, k: '--ink-3' });
    });
    const band = (y: number, a: number, b: number, k: 'gold' | 'teal', name: string, open: boolean) => {
      s.rrect(X(a), y - 3 * s.u, X(b) - X(a), 6 * s.u, 1, { fill: s.tint(k, 0.22), stroke: s.tint(k, 0.7), lw: 0.3 });
      mono(s, name, X(a) + 1.5 * s.u, y - 6.4 * s.u, { size: 3.2, k, align: 'left', weight: 650 });
      if (open) mono(s, 'and beyond, to 10⁻³⁸', X(b) - 1 * s.u, y - 6.4 * s.u, { size: 2.8, k: '--ink-3', align: 'right' });
    };
    band(y16, -7.2, 4.8, 'gold', 'fp16', false);
    s.alpha(s.ease('bf16', 0.6), () => band(yB, -12, 6, 'teal', 'bf16', true));
    const caption = (text: string, from: string, until?: string, k: 'red' | 'green' | '--ink-2' = '--ink-2') =>
      s.alpha(s.win(from, until), () => mono(s, text, s.w / 2, s.h * 0.12, { size: s.tall ? 3.2 : 3.6, k, weight: 650 }));
    caption('a gradient of 2×10⁻⁸ in fp16: 0', 'tiny', 'scale', 'red');
    caption('loss × 1,024: every gradient × 1,024', 'scale', 'safe');
    caption('then ÷ 1,024, in 32 bits, before the step', 'safe', 'bf16');
    caption('bf16 has fp32\'s range: no scaling', 'bf16', undefined, 'green');
    const g = Math.log10(2e-8);
    const scaled = Math.log10(2e-8 * 1024);
    // The tiny gradient: lost in fp16, then rescued by scaling.
    const up = s.ease('scale', 1.2, 2.5);
    const e = g + (scaled - g) * up;
    const inside = e > -7.2;
    s.circle(X(e), y16, 1.6 * s.u, { fill: s.c(inside ? 'green' : 'red'), stroke: s.c('--card'), lw: 0.35 });
    s.alpha(1 - s.ease('scale', 0.5), () => mono(s, '2×10⁻⁸ → 0', X(g), y16 + 6.4 * s.u, { size: 3.2, k: 'red', weight: 650 }));
    s.alpha(s.ease('scale', 0.6, 1) * (1 - s.ease('bf16', 0.5)), () => {
      s.arrow(X(g), y16 + 5 * s.u, X(scaled), y16 + 5 * s.u, s.c('--ink-2'), 0.4, 2.2);
      mono(s, '× 1,024', (X(g) + X(scaled)) / 2, y16 + 9 * s.u, { size: 3.2, k: '--ink-2' });
    });
    s.alpha(s.ease('safe', 0.6), () => mono(s, '2×10⁻⁵: kept', X(scaled) + 2.4 * s.u, y16 - 6.4 * s.u, { size: 3.2, k: 'green', weight: 650, align: 'left', halo: true }));
    s.alpha(s.ease('bf16', 0.6, 1), () => {
      s.circle(X(g), yB, 1.6 * s.u, { fill: s.c('green'), stroke: s.c('--card'), lw: 0.35 });
      mono(s, '2×10⁻⁸ kept, unscaled', X(g), yB + 6.4 * s.u, { size: 3.2, k: 'green', weight: 650 });
    });
  },
};

export const scenes: Record<string, SceneDef> = { formats, master, scaling };

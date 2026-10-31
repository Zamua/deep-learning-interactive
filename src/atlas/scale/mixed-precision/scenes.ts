import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01 } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { cite } from '../../draw';
import { gpu, mono } from '../draw';

type Run = [string, Ink];

/**
 * Mono text in colored runs, where `^-8` is drawn as a raised exponent: the mono face has no
 * superscript glyphs. Returns each run's [left, right] edge.
 */
function sci(s: Scene, runs: Run[] | string, x: number, y: number, o: { size?: number; k?: Ink; align?: CanvasTextAlign; weight?: number; halo?: boolean } = {}): [number, number][] {
  const size = o.size ?? 3.4;
  const list: Run[] = typeof runs === 'string' ? [[runs, o.k ?? '--ink']] : runs;
  const parts: { t: string; k: Ink; up: boolean; run: number }[] = [];
  list.forEach(([t, k], run) =>
    t.split(/(\^-?\d+)/).forEach((p) => {
      if (p) parts.push(p.startsWith('^') ? { t: p.slice(1).replace('-', '−'), k, up: true, run } : { t: p, k, up: false, run });
    }),
  );
  const opt = (up: boolean) => ({ size: up ? size * 0.62 : size, font: 'mono' as const, weight: o.weight ?? 550 });
  const pad = 0.25 * s.u;
  const ws = parts.map((p) => s.measure(p.t, opt(p.up)) + (p.up ? pad : 0));
  const total = ws.reduce((a, b) => a + b, 0);
  let cur = o.align === 'left' ? x : o.align === 'right' ? x - total : x - total / 2;
  const edges: [number, number][] = list.map(() => [Infinity, -Infinity]);
  parts.forEach((p, i) => {
    s.text(p.t, cur + (p.up ? pad : 0), p.up ? y - size * 0.38 * s.u : y, { ...opt(p.up), align: 'left', color: s.c(p.k), halo: o.halo });
    const e = edges[p.run]!;
    e[0] = Math.min(e[0], cur);
    e[1] = Math.max(e[1], cur + ws[i]!);
    cur += ws[i]!;
  });
  return edges;
}

// Sign, exponent, mantissa.
const KS = ['slate', 'gold', 'teal'] as const;

/** A format as a strip of bit cells from x0, `b` units per bit, its part sizes printed inside. */
function strip(s: Scene, x0: number, y: number, b: number, bits: readonly number[], h = 5) {
  let at = 0;
  bits.forEach((n, j) => {
    for (let i = 0; i < n; i++) {
      const x = x0 + (at + i) * b * s.u;
      s.rrect(x + 0.1 * s.u, y - (h / 2) * s.u, b * s.u - 0.2 * s.u, h * s.u, 0.4, { fill: s.tint(KS[j]!, 0.4), stroke: s.tint(KS[j]!, 0.85), lw: 0.15 });
    }
    if (j > 0) mono(s, String(n), x0 + (at + n / 2) * b * s.u, y + 0.2 * s.u, { size: 3, k: '--ink', weight: 700, halo: true });
    at += n;
  });
}

/** Bit width and left edge shared by the format scenes, so fp32 stays put between them. */
function lane(s: Scene) {
  const b = s.tall ? 2.4 : 2.9;
  return { b, x0: s.w / 2 - 16 * b * s.u + 6 * s.u };
}

const why: SceneDef = {
  draw(s) {
    const cx = s.w / 2;
    const cw = Math.min(84, s.w / s.u - 12);
    const top = s.h * 0.05;
    const ch = s.h * 0.56;
    const half = s.ease('half', 1, 0.6);
    s.alpha(s.ease('gpu', 0.6), () => {
      gpu(s, cx, top + ch / 2, cw, ch / s.u, 'GPU', { size: 3.4 });
      // Many small multipliers working at once; 16-bit math doubles their pace.
      const n = 16;
      const p = Math.min(4.2, (cw - 8) / n);
      const t1 = s.at('half');
      const phase = 3 * s.t + 3 * Math.max(0, s.t - t1);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < 4; j++) {
          const x = cx + (i - (n - 1) / 2) * p * s.u;
          const y = top + (9 + j * p) * s.u;
          const on = 0.5 + 0.5 * Math.sin(phase - i * 0.45 - j * 0.9);
          s.rrect(x - 1.4 * s.u, y - 1.4 * s.u, 2.8 * s.u, 2.8 * s.u, 0.4, { fill: s.tint('slate', 0.15 + 0.45 * on), stroke: s.tint('slate', 0.6), lw: 0.12 });
        }
      }
      const yc = top + (9 + 4 * p + 1.6) * s.u;
      s.alpha(1 - half, () => mono(s, 'thousands of multiplications at once', cx, yc, { size: 2.8, k: '--ink-2' }));
      s.alpha(half, () => mono(s, '16-bit math: 2× to 8× faster', cx, yc, { size: 2.9, k: 'green', weight: 650 }));
    });
    // The memory, with the weights' share of it.
    const mx0 = cx - (cw / 2 - 6) * s.u;
    const mx1 = cx + (cw / 2 - 6) * s.u;
    const ym = top + ch - 13.5 * s.u;
    s.alpha(s.ease('gpu', 0.6, 1.5), () => {
      mono(s, 'memory', mx0, ym - 5.8 * s.u, { size: 3, k: '--ink-2', align: 'left' });
      mono(s, '80 GB', mx1, ym - 5.8 * s.u, { size: 3, k: '--ink-3', align: 'right' });
      s.rrect(mx0, ym - 3.5 * s.u, mx1 - mx0, 7 * s.u, 1, { stroke: s.tint('slate', 0.7), lw: 0.3 });
    });
    s.alpha(s.ease('fp32', 0.6), () => {
      const gb = 28 - 14 * half;
      const w = ((mx1 - mx0) * gb * s.ease('fp32', 1, 0.3)) / 80;
      const draw = (k: Ink, a: number) =>
        s.alpha(a, () => s.rrect(mx0 + 0.4 * s.u, ym - 3 * s.u, Math.max(0, w - 0.8 * s.u), 6 * s.u, 0.8, { fill: s.tint(k, 0.35), stroke: s.tint(k, 0.9), lw: 0.3 }));
      draw('purple', 1 - half);
      draw('teal', half);
      s.alpha(1 - half, () => mono(s, '32-bit weights: 28 GB', mx0, ym + 6.4 * s.u, { size: 3.1, k: 'purple', align: 'left', weight: 650 }));
      s.alpha(half, () => mono(s, '16-bit weights: 14 GB', mx0, ym + 6.4 * s.u, { size: 3.1, k: 'teal', align: 'left', weight: 650 }));
    });
    // How many values each width can name: a dense ruler and a sparse one.
    const l = 8 * s.u;
    const r = s.w - 8 * s.u;
    const ruler = (y: number, n: number, k: Ink, label: string, a: number, lw: number) =>
      s.alpha(a, () => {
        mono(s, label, l, y - 4.6 * s.u, { size: 3.1, k, align: 'left', weight: 650 });
        s.line(l, y, r, y, s.c('--axis'), 0.3);
        for (let i = 0; i < n; i++) {
          const x = l + ((i + 0.5) / n) * (r - l);
          s.line(x, y - 1.6 * s.u, x, y + 1.6 * s.u, s.c(k), lw);
        }
      });
    ruler(s.h * 0.72, 220, 'purple', '32 bits: over 4 billion values', s.ease('catch', 0.6, 3.5), 0.1);
    ruler(s.h * 0.88, 17, 'teal', '16 bits: 65,536 values', s.ease('catch', 0.6, 1.5), 0.35);
  },
};

const float: SceneDef = {
  draw(s) {
    // A tiny number as digits times a power of ten; the 2 stays put while the point moves.
    const y1 = s.h * 0.15;
    const ax = s.w / 2 + 1 * s.u;
    const p = s.prog('float');
    const tri = p < 0.5 ? p * 2 : (1 - p) * 2;
    const e = -8 + Math.round(clamp01(tri * 1.25) * 4);
    const dec = `0.${'0'.repeat(-e - 1)}2`;
    const o = { size: s.tall ? 4.2 : 4.6, font: 'mono' as const, weight: 600 };
    s.alpha(s.ease('sci', 0.6), () => {
      s.text(dec, ax, y1, { ...o, align: 'right', color: s.c('--ink') });
      sci(s, [[' = ', '--ink-2'], ['2', 'teal'], [' × 10', '--ink'], [`^${e}`, 'gold']], ax, y1, { ...o, align: 'left' });
    });
    s.alpha(s.win('float', 'two'), () => {
      const xp = ax - s.measure(dec, o) + s.measure('0', o) + s.measure('.', o) / 2;
      s.line(xp, y1 + 3.4 * s.u, xp, y1 + 5.6 * s.u, s.c('gold'), 0.35);
      mono(s, 'the point floats', xp, y1 + 8.2 * s.u, { size: 3, k: 'gold', weight: 650 });
    });
    // Base two: 12 = 1.5 × 2³, with the mantissa and the exponent named.
    const y2 = s.h * 0.43;
    s.alpha(s.ease('two', 0.6), () => {
      const ed = sci(s, [['12 = ', '--ink'], ['1.5', 'teal'], [' × 2', '--ink'], ['^3', 'gold']], s.w / 2, y2, o);
      const mid = (i: number) => (ed[i]![0] + ed[i]![1]) / 2;
      s.alpha(s.ease('mantissa', 0.6), () => mono(s, 'mantissa: the digits', mid(1), y2 + 7 * s.u, { size: 3, k: 'teal', weight: 650 }));
      s.alpha(s.ease('exponent', 0.6), () => mono(s, 'exponent: the power', mid(3), y2 - 7 * s.u, { size: 3, k: 'gold', weight: 650 }));
    });
    // fp32's 32 bits, spent on the three parts.
    const { b, x0 } = lane(s);
    const y3 = s.h * 0.72;
    s.alpha(s.ease('fp32', 0.6), () => {
      mono(s, 'fp32', x0 - 2.5 * s.u, y3, { size: 3.8, weight: 650, align: 'right' });
      strip(s, x0, y3, b, [1, 8, 23]);
      const lab = (text: string, at: number, k: Ink, dy: number, d: number) =>
        s.alpha(s.ease('fp32', 0.6, d), () => mono(s, text, x0 + at * b * s.u, y3 + dy * s.u, { size: 2.9, k, weight: 600 }));
      lab('±', 0.5, 'slate', 6, 0.8);
      lab('exponent', 5, 'gold', 6, 1.8);
      lab('range', 5, 'gold', 10, 1.8);
      lab('mantissa', 20.5, 'teal', 6, 3);
      lab('precision: ~7 digits', 20.5, 'teal', 10, 3);
    });
  },
};

const FORMATS = [
  { name: 'fp32', bits: [1, 8, 23], bytes: '4 bytes', note: ['', ''], beat: '' },
  { name: 'bf16', bits: [1, 8, 7], bytes: '2 bytes', note: ['range: fp32\'s', 'digits: ~3'], beat: 'bf16' },
  { name: 'fp16', bits: [1, 5, 10], bytes: '2 bytes', note: ['digits: more', 'range: short'], beat: 'fp16' },
  { name: 'fp8', bits: [1, 4, 3], bytes: '1 byte', note: ['', ''], beat: 'fp8' },
] as const;

const formats: SceneDef = {
  draw(s) {
    const { b, x0 } = lane(s);
    FORMATS.forEach((f, i) => {
      const y = s.h * (0.1 + i * 0.1);
      s.alpha(f.beat ? s.ease(f.beat, 0.6) : 1, () => {
        mono(s, f.name, x0 - 2.5 * s.u, y - 1.3 * s.u, { size: 3.6, weight: 650, align: 'right' });
        mono(s, f.bytes, x0 - 2.5 * s.u, y + 2.6 * s.u, { size: 2.5, k: '--ink-3', align: 'right' });
        strip(s, x0, y, b, f.bits);
        const nx = x0 + (16 * b + 2.5) * s.u;
        if (f.note[0]) {
          s.alpha(s.ease(f.beat, 0.6, 2), () => {
            mono(s, f.note[0], nx, y - 1.6 * s.u, { size: 2.7, k: '--ink-2', align: 'left' });
            mono(s, f.note[1], nx, y + 1.8 * s.u, { size: 2.7, k: '--ink-2', align: 'left' });
          });
        }
      });
    });
    cite(s, 'bfloat16 · Google Brain', s.win('brain', 'fp16'));
    // Each format's range on a log scale, from 1e-40 to 1e40.
    const xr = s.w - 5 * s.u;
    const X = (e: number) => x0 + ((e + 40) / 80) * (xr - x0);
    const ya = s.h * 0.87;
    mono(s, 'range, tiny to huge', x0, s.h * 0.52, { size: 3, k: '--ink-2', align: 'left' });
    s.line(x0, ya, xr, ya, s.c('--axis'), 0.35);
    [-20, 0, 20].forEach((e) => {
      s.line(X(e), ya - 1 * s.u, X(e), ya + 1 * s.u, s.c('--axis'), 0.35);
      sci(s, e === 0 ? '1' : `10^${e}`, X(e), ya + 3.8 * s.u, { size: 2.8, k: '--ink-3' });
    });
    const band = (y: number, lo: number, hi: number, k: Ink, name: string, ends: boolean) => {
      mono(s, name, x0 - 2.5 * s.u, y, { size: 3.2, weight: 650, align: 'right', k });
      s.rrect(X(lo), y - 2.5 * s.u, X(hi) - X(lo), 5 * s.u, 1, { fill: s.tint(k, 0.22), stroke: s.tint(k, 0.7), lw: 0.3 });
      if (ends) {
        sci(s, `10^${lo}`, X(lo) + 1 * s.u, y + 0.5 * s.u, { size: 2.7, k: '--ink-2', align: 'left' });
        sci(s, `10^${hi}`, X(hi) - 1 * s.u, y + 0.5 * s.u, { size: 2.7, k: '--ink-2', align: 'right' });
      }
    };
    band(s.h * 0.6, -38, 38, 'purple', 'fp32', true);
    s.alpha(s.ease('bf16', 0.6, 1.5), () => band(s.h * 0.69, -38, 38, 'teal', 'bf16', true));
    const y16 = s.h * 0.78;
    s.alpha(s.ease('fp16', 0.6, 2), () => band(y16, Math.log10(5.96e-8), Math.log10(65504), 'gold', 'fp16', false));
    s.alpha(s.ease('range', 0.6), () => {
      sci(s, [['65,504', '--ink-2'], [' → infinity', 'red']], X(Math.log10(65504)) + 1.2 * s.u, y16, { size: 2.8, align: 'left' });
    });
    s.alpha(s.ease('range', 0.6, 2.5), () => {
      sci(s, [['0 ← ', 'red'], ['6×10^-8', '--ink-2']], X(Math.log10(5.96e-8)) - 1.2 * s.u, y16 + 0.3 * s.u, { size: 2.8, align: 'right' });
    });
  },
};

const master: SceneDef = {
  draw(s) {
    const l = 10 * s.u;
    const r = s.w - 10 * s.u;
    const X = (v: number) => l + ((v - 0.994) / 0.024) * (r - l);
    const B = [1 - 1 / 256, 1, 1 + 1 / 128, 1 + 2 / 128];
    const y = s.h * 0.34;
    const y2 = s.h * 0.62;
    // bf16's neighbors near 1, and the gap between them.
    mono(s, 'bf16 near 1', l, y - 8 * s.u, { size: 3.3, k: 'teal', align: 'left', weight: 650 });
    s.line(l, y, r, y, s.c('--axis'), 0.4);
    B.forEach((v, i) => {
      s.line(X(v), y - 2.4 * s.u, X(v), y + 2.4 * s.u, s.c('teal'), 0.5);
      mono(s, ['0.9961', '1.0', '1.0078', '1.0156'][i]!, X(v), y + 5.6 * s.u, { size: 3, k: 'teal' });
    });
    s.alpha(s.win('grid', 'lost'), () => {
      s.line(X(1), y - 4 * s.u, X(B[2]!), y - 4 * s.u, s.c('--ink-2'), 0.3);
      mono(s, 'gap ≈ 0.008', (X(1) + X(B[2]!)) / 2, y - 7 * s.u, { size: 3, k: '--ink-2', halo: true });
    });
    // The update rounds back to 1.
    s.alpha(s.win('lost', 'fresh'), () => {
      const snap = s.ease('lost', 0.8, 2.2);
      s.circle(X(1), y, 1.4 * s.u, { fill: s.c(snap > 0.5 ? 'red' : 'blue'), stroke: s.c('--card'), lw: 0.3 });
      mono(s, snap > 0.5 ? '1 + 0.0001 → 1.0: lost' : '1 + 0.0001 = ?', X(1) + 2.4 * s.u, y - 4.6 * s.u, { size: 3.1, k: snap > 0.5 ? 'red' : 'blue', align: 'left', halo: true });
    });
    // The fp32 master copy: a value every ten millionth, so small updates add up.
    const k = clamp01((s.since('fresh') - 0.3 * (s.end('fresh') - s.at('fresh'))) / (0.55 * (s.end('fresh') - s.at('fresh'))));
    const n = 1 + Math.round(39 * k);
    const m = 1 + n * 1e-4;
    s.alpha(s.ease('copy', 0.6, 1.5), () => {
      mono(s, 'fp32 master copy near 1', r, y2 - 8 * s.u, { size: 3.3, k: 'purple', align: 'right', weight: 650 });
      s.line(l, y2, r, y2, s.c('--axis'), 0.4);
      for (let i = 0; i <= 160; i++) {
        const x = l + (i / 160) * (r - l);
        s.line(x, y2 - 1.2 * s.u, x, y2 + 1.2 * s.u, s.tint('purple', 0.5), 0.1);
      }
      s.circle(X(m), y2, 1.4 * s.u, { fill: s.c('green'), stroke: s.c('--card'), lw: 0.3 });
      mono(s, `${n} update${n > 1 ? 's' : ''}: ${m.toFixed(4)}`, X(m) - 1 * s.u, y2 + 5.4 * s.u, { size: 3.1, k: 'green', align: 'left', weight: 650, halo: true });
    });
    // The 16-bit copy, rounded from the master: it moves once the updates add up.
    s.alpha(s.ease('fresh', 0.6), () => {
      const w16 = m >= 1 + 1 / 256 ? B[2]! : 1;
      s.line(X(m), y2 - 1.8 * s.u, X(m), y + 8.6 * s.u, s.c('--ink-3'), 0.3, [1.2, 1.2]);
      s.circle(X(w16), y, 1.4 * s.u, { fill: s.c('teal'), stroke: s.c('--card'), lw: 0.3 });
      mono(s, 'rounded to bf16 for the math', s.w / 2, s.h * 0.8, { size: s.tall ? 3.1 : 3.4, k: '--ink-2' });
    });
    s.alpha(s.ease('name', 0.6), () => mono(s, '16 bits for the math, 32 for the step', s.w / 2, s.h * 0.9, { size: s.tall ? 3.2 : 3.6, k: '--ink', weight: 650 }));
    cite(s, 'Micikevicius et al., 2017', s.ease('copy', 0.6));
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
      sci(s, e === 0 ? '1' : `10^${e}`, X(e), yt + 4.2 * s.u, { size: 3, k: '--ink-3' });
    });
    const band = (y: number, a: number, b: number, k: 'gold' | 'teal', name: string, open: boolean) => {
      s.rrect(X(a), y - 3 * s.u, X(b) - X(a), 6 * s.u, 1, { fill: s.tint(k, 0.22), stroke: s.tint(k, 0.7), lw: 0.3 });
      mono(s, name, X(a) + 1.5 * s.u, y - 6.4 * s.u, { size: 3.2, k, align: 'left', weight: 650 });
      if (open) sci(s, 'and beyond, to 10^-38', X(b) - 1 * s.u, y - 6.4 * s.u, { size: 2.9, k: '--ink-3', align: 'right' });
    };
    band(y16, -7.2, 4.8, 'gold', 'fp16', false);
    s.alpha(s.ease('bf16', 0.6), () => band(yB, -12, 6, 'teal', 'bf16', true));
    const caption = (text: string, from: string, until?: string, k: 'red' | 'green' | '--ink-2' = '--ink-2') =>
      s.alpha(s.win(from, until), () => sci(s, text, s.w / 2, s.h * 0.13, { size: s.tall ? 3.2 : 3.6, k, weight: 650 }));
    caption('a gradient of 2×10^-8 in fp16: 0', 'tiny', 'scale', 'red');
    caption('loss × 1,024: every gradient × 1,024', 'scale', 'safe');
    caption('then ÷ 1,024, in 32 bits, before the step', 'safe', 'bf16');
    caption('bf16 has fp32\'s range: no scaling', 'bf16', undefined, 'green');
    cite(s, 'Micikevicius et al., 2017', s.win('tiny', 'bf16'));
    const g = Math.log10(2e-8);
    const scaled = Math.log10(2e-8 * 1024);
    // The tiny gradient: lost in fp16, then rescued by scaling.
    const up = s.ease('scale', 1.2, 2.5);
    const e = g + (scaled - g) * up;
    const inside = e > -7.2;
    s.circle(X(e), y16, 1.6 * s.u, { fill: s.c(inside ? 'green' : 'red'), stroke: s.c('--card'), lw: 0.35 });
    s.alpha(1 - s.ease('scale', 0.5), () => sci(s, '2×10^-8 → 0', X(g), y16 + 6.6 * s.u, { size: 3.2, k: 'red', weight: 650 }));
    s.alpha(s.ease('scale', 0.6, 1) * (1 - s.ease('bf16', 0.5)), () => {
      s.arrow(X(g), y16 + 5 * s.u, X(scaled), y16 + 5 * s.u, s.c('--ink-2'), 0.4, 2.2);
      mono(s, '× 1,024', (X(g) + X(scaled)) / 2, y16 + 9 * s.u, { size: 3.2, k: '--ink-2' });
    });
    s.alpha(s.ease('safe', 0.6), () => sci(s, '2×10^-5: kept', X(scaled) + 2.4 * s.u, y16 - 6.4 * s.u, { size: 3.2, k: 'green', weight: 650, align: 'left', halo: true }));
    s.alpha(s.ease('bf16', 0.6, 1), () => {
      s.circle(X(g), yB, 1.6 * s.u, { fill: s.c('green'), stroke: s.c('--card'), lw: 0.35 });
      sci(s, '2×10^-8 kept, unscaled', X(g), yB + 6.6 * s.u, { size: 3.2, k: 'green', weight: 650 });
    });
  },
};

export const scenes: Record<string, SceneDef> = { why, float, formats, master, scaling };

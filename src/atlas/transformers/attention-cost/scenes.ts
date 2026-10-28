import type { Scene, SceneDef } from '../../../lecture/scene';
import { smooth } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { bars, columns } from '../../draw';
import { after, caption } from '../../networks/draw';
import { rich } from '../draw';

type Ink = Color | `--${string}`;

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number): void {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/**
 * An m by n block of cells, `c` stage units each, top-left at (x, y). `shown` reveals cells in
 * reading order (0..m·n); `tint(i, j)` sets each cell's strength.
 */
function block(s: Scene, x: number, y: number, m: number, n: number, c: number, k: Ink, o: { shown?: number; tint?: (i: number, j: number) => number; color?: (i: number, j: number) => Ink } = {}): void {
  const u = s.u;
  const shown = o.shown ?? m * n;
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      const f = Math.min(1, Math.max(0, shown - (i * n + j)));
      if (f <= 0) continue;
      const kk = o.color?.(i, j) ?? k;
      const t = o.tint?.(i, j) ?? 0.5;
      s.alpha(f, () => s.rrect(x + j * c * u + 0.2 * u, y + i * c * u + 0.2 * u, (c - 0.4) * u, (c - 0.4) * u, 0.4, { fill: s.tint(kk, 0.1 + 0.3 * t), stroke: s.tint(kk, 0.35 + 0.5 * t), lw: 0.2 }));
    }
  }
}

const cy = (s: Scene) => s.h * 0.92;
const WORDS = ['cats', 'like', 'fish'];

const pairs: SceneDef = {
  draw(s) {
    const u = s.u;
    const lab = { size: 3.3, font: 'mono', weight: 600 } as const;
    // Three tokens: who asks (rows) and who answers (columns).
    const small = 1 - s.ease('double', 0.6);
    s.alpha(small, () => {
      const c = 13;
      const x0 = s.w / 2 - 1.5 * c * u + 6 * u;
      const y0 = s.h * 0.48 - 1.5 * c * u - 2 * u;
      block(s, x0, y0, 3, 3, c, 'gold', { shown: 9 * smooth((s.t - s.at('grid') - 0.4 * (s.end('grid') - s.at('grid'))) / 3) });
      WORDS.forEach((w, i) => {
        s.text(w, x0 - 2 * u, y0 + (i + 0.5) * c * u, { ...lab, align: 'right', color: s.c('teal') });
        s.text(w, x0 + (i + 0.5) * c * u, y0 - 3 * u, { ...lab, color: s.c('purple') });
      });
      s.text('asking', x0 - 2 * u, y0 - 3 * u, { ...lab, size: 3, align: 'right', weight: 500, color: s.c('teal') });
      s.text('answering', x0 + 3 * c * u + 2 * u, y0 - 3 * u, { ...lab, size: 3, align: 'left', weight: 500, color: s.c('purple') });
      s.alpha(s.ease('T', 0.6), () => rich(s, [['T × T = ', '--ink-2'], ['T²', 'gold'], [' scores', '--ink-2']], s.w / 2, y0 + 3 * c * u + 8 * u, { size: 3.6, weight: 600 }));
    });
    s.alpha(s.win('grid', 'T'), () => caption(s, '3 tokens: 3 × 3 = 9 scores', cy(s), 'gold', 3.4));
    s.alpha(s.win('T', 'double'), () => caption(s, 'e = Q Kᵀ, shape (T, T)', cy(s), '--ink-2', 3.4));

    // Four tokens beside eight: the old sixteen pairs are one quarter of the new grid.
    const big = s.ease('double', 0.6);
    s.alpha(big, () => {
      const c = s.tall ? 5 : 5.4;
      const gap = 16;
      const total = 12 * c + gap;
      const lx = s.w / 2 - (total / 2) * u;
      const rx = lx + (4 * c + gap) * u;
      const y0 = s.h * 0.46 - 4 * c * u;
      const why = s.ease('why', 0.6);
      block(s, lx, y0, 4, 4, c, 'gold');
      block(s, rx, y0, 8, 8, c, 'gold', {
        shown: 64 * smooth((s.t - s.at('double') - 0.45 * (s.end('double') - s.at('double'))) / 1.6),
        tint: (i, j) => (i < 4 && j < 4 ? 0.5 + 0.4 * why : 0.5),
        color: (i, j) => (why > 0.01 && (i >= 4 || j >= 4) ? 'red' : 'gold'),
      });
      s.alpha(why, () => {
        s.line(rx + 4 * c * u, y0 - 1 * u, rx + 4 * c * u, y0 + 8 * c * u + 1 * u, s.c('--ink-2'), 0.35, [1, 0.8]);
        s.line(rx - 1 * u, y0 + 4 * c * u, rx + 8 * c * u + 1 * u, y0 + 4 * c * u, s.c('--ink-2'), 0.35, [1, 0.8]);
      });
      rich(s, [['T = 4: ', '--ink-2'], ['16', 'gold']], lx + 2 * c * u, y0 + 8 * c * u + 6 * u, { size: 3.4, weight: 600 });
      s.alpha(after(s, 'double', 0.7), () => rich(s, [['T = 8: ', '--ink-2'], ['64', 'gold'], ['  (4×)', 'red']], rx + 4 * c * u, y0 + 8 * c * u + 6 * u, { size: 3.4, weight: 600 }));
    });
    s.alpha(s.win('double', 'why'), () => caption(s, 'the context: the tokens read at once', cy(s), '--ink-2', 3.4));
    s.alpha(s.win('why', 'square'), () => caption(s, '2× askers × 2× answering = 4×', cy(s), 'red', 3.4));
    s.alpha(s.ease('square', 0.6), () => caption(s, '10× tokens → 100× scores: quadratic', cy(s), 'red', 3.4));
  },
};

/** Work per pass, in units of d³, against T / d: attention T²d, recurrence Td². */
const grows: SceneDef = {
  draw(s) {
    const u = s.u;
    const plot = s.ease('vaswani', 0.6);
    // Phase one: what doubling T does to each matrix, with the old size inside the new.
    s.alpha(1 - plot, () => {
      const c = 4.4;
      const [qx, wx, ex] = columns(s, 3, s.tall ? 32 : 36);
      const top = s.h * 0.46 - 4 * c * u;
      const lab = { size: 3.4, font: 'mono', weight: 650 } as const;
      const qOn = s.win('rows', 'weights');
      const wOn = s.ease('weights', 0.6);
      block(s, qx! - c * u, top, 8, 2, c, 'teal', { tint: (i) => (i < 4 ? 0.85 : 0.35 + 0.3 * qOn) });
      block(s, wx! - 1.5 * c * u, top + 3 * c * u, 2, 3, c, 'blue', { tint: () => 0.5 + 0.4 * wOn });
      block(s, ex! - 4 * c * u, top, 8, 8, c, 'gold', { tint: (i, j) => (i < 4 && j < 4 ? 0.85 : 0.4) });
      const by = top + 8 * c * u + 6 * u;
      s.text('Q', qx!, top - 4 * u, { ...lab, color: s.c('teal') });
      s.text('Wq', wx!, top + 3 * c * u - 4 * u, { ...lab, color: s.c('blue') });
      s.text('Q Kᵀ', ex!, top - 4 * u, { ...lab, color: s.c('gold') });
      s.text('2×', qx!, by, { ...lab, color: s.c('teal') });
      s.text('same', wx!, by, { ...lab, color: s.c('blue') });
      s.text('4×', ex!, by, { ...lab, color: s.c('gold') });
      s.alpha(s.win('rows', 'weights'), () => caption(s, 'one row per token: T = 4 → 8 rows', cy(s), 'teal', 3.4));
      s.alpha(s.ease('weights', 0.6), () => caption(s, 'shared by every token: never grows', cy(s), 'blue', 3.4));
    });
    // Phase two: the two costs against T, crossing at T = d.
    s.alpha(plot, () => {
      const l = 14 * u;
      const r = s.w - 8 * u;
      const t = s.h * 0.14;
      const b = s.h * 0.78;
      const X = (x: number) => l + (x / 2) * (r - l);
      const Y = (y: number) => b - (y / 4.2) * (b - t);
      const cross = s.ease('cross', 0.6);
      s.alpha(cross, () => {
        s.rrect(X(0), t, X(1) - X(0), b - t, 0, { fill: s.tint('green', 0.1) });
        s.text('attention cheaper', X(0.5), Y(2.2), { size: 3.1, font: 'mono', weight: 600, color: s.c('green'), halo: true });
        s.line(X(1), t, X(1), b, s.tint('green', 0.7), 0.3, [1, 0.8]);
      });
      s.line(l, b, r, b, s.c('--axis'), 0.35);
      s.line(l, b, l, t, s.c('--axis'), 0.35);
      s.text('work', l + 2 * u, t + 2 * u, { size: 3.3, font: 'mono', weight: 650, align: 'left', color: s.c('--ink-2') });
      s.text('T', r, b + 4 * u, { size: 3.6, font: 'mono', weight: 650, align: 'right', color: s.c('slate') });
      s.alpha(cross, () => s.text('T = d = 512', X(1), b + 4 * u, { size: 3, font: 'mono', color: s.c('--ink-2') }));
      const path = (f: (x: number) => number, k: Ink, upto: number) => {
        const c = s.ctx;
        c.save();
        c.beginPath();
        c.rect(l, t, r - l, b - t);
        c.clip();
        c.beginPath();
        for (let i = 0; i <= 80; i++) {
          const x = (2 * upto * i) / 80;
          if (i) c.lineTo(X(x), Y(f(x)));
          else c.moveTo(X(x), Y(f(x)));
        }
        c.strokeStyle = s.c(k);
        c.lineWidth = 0.7 * u;
        c.stroke();
        c.restore();
      };
      const pa = smooth((s.t - s.at('vaswani') - 0.5 * (s.end('vaswani') - s.at('vaswani'))) / 1.5);
      const pr = smooth((s.t - s.at('rnn') - 0.5 * (s.end('rnn') - s.at('rnn'))) / 1.5);
      if (pa > 0) path((x) => x * x, 'gold', pa);
      if (pr > 0) path((x) => x, 'purple', pr);
      // A legend, top left: the curves cross the right half's labels otherwise.
      const tl = { size: 3.2, font: 'mono', weight: 650, align: 'left' } as const;
      const legend = (y: number, k: Ink, text: string, a: number) => s.alpha(a, () => {
        s.line(l + 4 * u, y, l + 8 * u, y, s.c(k), 0.7);
        s.text(text, l + 9.5 * u, y, { ...tl, color: s.c(k) });
      });
      legend(t + 8 * u, 'gold', 'attention: T²d', pa);
      legend(t + 13 * u, 'purple', 'recurrent: Td²', pr);
    });
    cite(s, 'Vaswani et al., 2017', s.ease('vaswani', 0.6));
    s.alpha(after(s, 'cross', 0.4), () => caption(s, 'fewer tokens than d: attention wins', cy(s), 'green', 3.4));
  },
};

const TS = [1000, 2000, 4000, 8000];
const MB = TS.map((t) => (2 * t * t) / 1e6);

const memory: SceneDef = {
  draw(s) {
    const u = s.u;
    const heads = s.ease('heads', 0.6);
    // One score's cost, then the bars for growing T.
    s.alpha(s.win('bytes', 'one'), () => {
      const c = 16;
      const y = s.h * 0.44 - (c / 2) * u;
      s.rrect(s.w / 2 - (c / 2) * u, y, c * u, c * u, 0.8, { fill: s.tint('gold', 0.3), stroke: s.tint('gold', 0.8), lw: 0.3 });
      s.text('one score', s.w / 2, y - 4.5 * u, { size: 3.4, font: 'mono', weight: 600, color: s.c('gold') });
      s.text('2 bytes', s.w / 2, y + (c + 5.5) * u, { size: 3.8, font: 'mono', weight: 650, color: s.c('--ink') });
    });
    const long = s.ease('long', 1.2, 0.3);
    s.alpha(s.ease('one', 0.6) * (1 - heads), () => {
      const xs = columns(s, 4, s.tall ? 24 : 26);
      const base = s.h * 0.7;
      const vals = MB.map((v, i) => (i === 0 ? v : v * long));
      const fmt = (v: number) => (s.t < s.at('mb') + 0.3 ? '' : `${Math.round(v)} MB`);
      bars(s, xs.slice(0, 1), base, vals.slice(0, 1), 'gold', { max: 128, height: 46, w: 12, fmt, hi: [s.win('mb', 'long')] });
      s.alpha(long, () => bars(s, xs.slice(1), base, vals.slice(1), 'gold', { max: 128, height: 46, w: 12, fmt, hi: [0, 0, long] }));
      TS.forEach((t, i) => s.alpha(i === 0 ? 1 : long, () => s.text(`T = ${t.toLocaleString('en-US')}`, xs[i]!, base + 4.5 * u, { size: 3, font: 'mono', color: s.c('--ink-3') })));
    });
    s.alpha(s.win('one', 'mb'), () => caption(s, '1,000 × 1,000 = 1,000,000 scores', cy(s), 'gold', 3.4));
    s.alpha(s.win('mb', 'long'), () => caption(s, '× 2 bytes = 2,000,000 bytes: 2 MB', cy(s), 'gold', 3.4));
    s.alpha(s.win('long', 'heads'), () => caption(s, '8× tokens: 64× the bytes, 128 MB', cy(s), 'red', 3.4));

    // Sixteen heads, each with its own 128 MB grid, side by side in one layer.
    s.alpha(heads, () => {
      const n = 4;
      const c = s.tall ? 10 : 11;
      const g = 3;
      const span = n * c + (n - 1) * g;
      const x0 = s.w / 2 - (span / 2) * u;
      const y0 = s.h * 0.44 - (span / 2) * u;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const k = i * n + j;
          s.alpha(after(s, 'heads', 0.1 + 0.025 * k, 0.4), () => {
            const x = x0 + j * (c + g) * u;
            const y = y0 + i * (c + g) * u;
            s.rrect(x, y, c * u, c * u, 0.6, { fill: s.tint('gold', 0.25), stroke: s.tint('gold', 0.75), lw: 0.25 });
            s.text('128', x + (c / 2) * u, y + (c / 2) * u - 1.4 * u, { size: 2.8, font: 'mono', weight: 600, color: s.c('gold') });
            s.text('MB', x + (c / 2) * u, y + (c / 2) * u + 2 * u, { size: 2.6, font: 'mono', color: s.c('gold') });
          });
        }
      }
      const layer = s.ease('layer', 0.6);
      s.alpha(layer, () => {
        s.rrect(x0 - 2.5 * u, y0 - 2.5 * u, (span + 5) * u, (span + 5) * u, 1.6, { stroke: s.c('slate'), lw: 0.45 });
        s.text('one self-attention layer', s.w / 2, y0 + (span + 7) * u, { size: 3.3, font: 'mono', weight: 600, color: s.c('slate') });
      });
    });
    s.alpha(s.win('heads', 'layer'), () => caption(s, '16 heads × 128 MB ≈ 2 GB', cy(s), 'red', 3.4));
    s.alpha(s.win('layer', 'child'), () => caption(s, 'heads side by side, like neurons', cy(s), 'slate', 3.4));
    s.alpha(s.win('child', 'end'), () => caption(s, 'time and memory: quadratic in T', cy(s), 'red', 3.4));
    s.alpha(s.ease('end', 0.6), () => caption(s, 'twice the context: four times the cost', cy(s), '--ink', 3.4));
    cite(s, 'Child, Gray, Radford & Sutskever, 2019', s.win('child', 'end'));
  },
};

export const scenes: Record<string, SceneDef> = { pairs, grows, memory };

import type { Scene, SceneDef } from '../../../lecture/scene';
import { after, caption } from '../../networks/draw';
import { gpu, type Ink, mono, stack } from '../draw';

/** One parameter's training state in bytes, in the order the explainer counts it. */
const PARTS = [
  { n: 2, k: 'blue', name: 'weight', beat: 'one' },
  { n: 2, k: 'red', name: 'gradient', beat: 'g' },
  { n: 4, k: 'purple', name: 'master copy', beat: 'master' },
  { n: 4, k: 'orange', name: 'm', beat: 'mv' },
  { n: 4, k: 'teal', name: 'v', beat: 'mv' },
] as const;
/** Where each part starts and ends along the 16 bytes. */
const SPANS = PARTS.map((_, i) => {
  const a = PARTS.slice(0, i).reduce((t, p) => t + p.n, 0);
  return [a, a + PARTS[i]!.n] as const;
});

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

// ---- the puzzle: the weights fit on one GPU, training overflows it

/** The opening's GPU card: tall, right of center, its 80 GB filling from the bottom. */
function bigCard(s: Scene) {
  const w = s.tall ? 30 : 32;
  const h = 52;
  const x = s.w / 2 + (s.tall ? 20 : 28) * s.u;
  const y = s.h * 0.56;
  const bottom = y + (h / 2 - 2) * s.u;
  const inner = (h - 9) * s.u;
  return { x, y, w, h, top: y - (h / 2) * s.u, bottom, inner, gb: (g: number) => bottom - (g / 80) * inner };
}

const fit: SceneDef = {
  draw(s) {
    const B = bigCard(s);
    const lx = s.tall ? s.w / 2 - 22 * s.u : s.w / 2 - 28 * s.u;
    const named = s.ease('gb', 0.6);
    gpu(s, B.x, B.y, B.w, B.h, '', { size: 2.8 });
    s.alpha(1 - named, () => mono(s, 'GPU memory', B.x, B.top + 3 * s.u, { size: 2.9, k: '--ink-2', weight: 650 }));
    s.alpha(named, () => mono(s, 'GPU: 80 GB', B.x, B.top + 3 * s.u, { size: 2.9, k: '--ink-2', weight: 650 }));
    const iw = (B.w - 4) * s.u;
    const ix = B.x - iw / 2;

    // The chip: many multiplications at once.
    s.alpha(s.win('gpu', 'bytes'), () => {
      const n = 7;
      const c = s.tall ? 4.2 : 4.6;
      const y0 = s.h * 0.34;
      for (let i = 0; i < n * 5; i++) {
        const x = lx + ((i % n) - (n - 1) / 2) * (c + 1) * s.u;
        const y = y0 + Math.floor(i / n) * (c + 1) * s.u;
        const on = 0.5 + 0.5 * Math.sin(s.t * 5 + i * 2.3);
        s.cell(x - (c / 2) * s.u, y - (c / 2) * s.u, c * s.u, c * s.u, '×', 'orange', { on, size: 2.6 });
      }
      mono(s, 'thousands of × at once', lx, y0 + 5 * (c + 1) * s.u + 2 * s.u, { size: 3.2, k: '--ink-2' });
    });

    // A byte: eight bits, each a 0 or a 1.
    s.alpha(s.ease('bytes', 0.6) * (1 - s.ease('w', 0.5)), () => {
      const bits = '01101001';
      const cw = s.tall ? 4.6 : 5;
      const y = s.h * 0.36;
      [...bits].forEach((b, i) => {
        const x = lx + (i - 3.5) * (cw + 0.6) * s.u;
        s.alpha(after(s, 'bytes', 0.25 + i * 0.03), () => s.cell(x - (cw / 2) * s.u, y - 3.2 * s.u, cw * s.u, 6.4 * s.u, b, 'slate', { size: 3 }));
      });
      s.alpha(after(s, 'bytes', 0.25), () => mono(s, 'a bit: one 0 or 1', lx, y - 7.5 * s.u, { size: 3.2, k: '--ink-2' }));
      s.alpha(after(s, 'bytes', 0.6), () => {
        const half = 4 * (cw + 0.6) * s.u;
        s.line(lx - half, y + 5 * s.u, lx + half, y + 5 * s.u, s.c('--ink-3'), 0.35);
        mono(s, '8 bits = 1 byte', lx, y + 9 * s.u, { size: 3.4, weight: 650 });
      });
      s.alpha(named, () => {
        mono(s, '1 GB: a billion bytes', lx, s.h * 0.62, { size: 3.4, k: '--ink-2' });
        mono(s, 'a large GPU: 80 GB', lx, s.h * 0.62 + 6 * s.u, { size: 3.4, weight: 650 });
      });
    });

    // The weights: 14 GB, a sliver of the card.
    const wIn = s.ease('w', 0.9, 1.2);
    const dim = 1 - 0.55 * s.ease('train', 0.6);
    s.alpha(s.ease('w', 0.6) * dim, () => {
      mono(s, '7 × 10⁹ parameters', lx, s.h * 0.34, { size: 3.4 });
      s.alpha(after(s, 'w', 0.3), () => mono(s, '× 2 bytes each', lx, s.h * 0.34 + 6 * s.u, { size: 3.4, k: '--ink-2' }));
      s.alpha(after(s, 'w', 0.55), () => mono(s, '= 14 GB of weights', lx, s.h * 0.34 + 12 * s.u, { size: 3.6, k: 'blue', weight: 650 }));
    });
    if (wIn > 0) {
      const top = B.gb(14 * wIn);
      s.rrect(ix, top, iw, B.bottom - top, 0.6, { fill: s.tint('blue', 0.4), stroke: s.tint('blue', 0.9), lw: 0.25 });
      s.alpha(after(s, 'w', 0.55) * dim, () => mono(s, 'weights', B.x, (top + B.bottom) / 2, { size: 2.8, k: 'blue', weight: 650, halo: true }));
    }

    // Training with Adam: the state climbs past the top of the card.
    const grow = s.ease('train', 2.4, 0.6);
    if (grow > 0) {
      const level = 14 + 98 * grow;
      const inTop = B.gb(Math.min(80, level));
      s.rrect(ix, inTop, iw, B.gb(14) - inTop, 0.6, { fill: s.tint('purple', 0.4), stroke: s.tint('purple', 0.9), lw: 0.25 });
      if (level > 80) {
        const hh = ((level - 80) / 80) * B.inner;
        s.rrect(ix, B.top - hh, iw, hh, 0.6, { fill: s.tint('purple', 0.22) });
        s.ctx.save();
        s.ctx.setLineDash([1.2 * s.u, 0.8 * s.u]);
        s.rrect(ix, B.top - hh, iw, hh, 0.6, { stroke: s.c('purple'), lw: 0.3 });
        s.ctx.restore();
        s.alpha(smoothIn(level, 88, 100), () => mono(s, '?', B.x, B.top - hh / 2, { size: 4.6, k: 'purple', weight: 700 }));
      }
    }
    s.alpha(s.ease('train', 0.6, 1), () => {
      mono(s, 'training with Adam:', lx, s.h * 0.62, { size: 3.4, k: 'purple' });
      mono(s, 'more than 80 GB', lx, s.h * 0.62 + 6 * s.u, { size: 3.6, k: 'purple', weight: 650 });
    });

    const cy = s.h * 0.92;
    s.alpha(s.win('gpu', 'bytes'), () => caption(s, 'GPU: graphics processing unit', cy, '--ink-2', 3.4));
  },
};

/** 0 below `a`, 1 above `b`, linear between. */
const smoothIn = (v: number, a: number, b: number) => Math.max(0, Math.min(1, (v - a) / (b - a)));

// ---- one parameter's sixteen bytes, piece by piece

const param: SceneDef = {
  draw(s) {
    const unit = s.tall ? 5.4 : 6.4;
    const x0 = s.w / 2 - 8 * unit * s.u;
    const y = s.h * 0.4;
    const plain = s.ease('plain', 0.8);
    mono(s, 'bytes kept for one parameter', s.w / 2, s.h * 0.14, { size: 3.6, k: '--ink-2' });
    const parts = PARTS.map((p, i) => ({ n: p.n, k: p.k as Ink, label: String(p.n), a: s.ease(p.beat, 0.6, i === 4 ? 1.2 : 0) * (i >= 3 ? 1 - 0.75 * plain : 1) }));
    const mids = stack(s, x0, y, unit, 10, parts, { size: 3.6 });
    PARTS.forEach((p, i) => {
      const below = i % 2 === 0;
      s.alpha(parts[i]!.a, () => mono(s, p.name, mids[i]!, y + (below ? 9 : -9) * s.u, { size: 3, k: p.k, weight: 650 }));
    });
    // Plain gradient descent: m and v struck out.
    s.alpha(plain, () => {
      const a = x0 + SPANS[3]![0] * unit * s.u;
      const b = x0 + 16 * unit * s.u;
      s.line(a, y + 6.5 * s.u, a + (b - a) * s.ease('plain', 0.8, 0.3), y - 6.5 * s.u, s.c('red'), 0.6);
    });

    // How many bytes a 16-bit and a 32-bit number take.
    const keyRow = (text: string, n: number, yy: number) => {
      mono(s, text, s.w / 2 - 2 * s.u, yy, { size: 3.3, k: '--ink-2', align: 'right' });
      stack(s, s.w / 2 + 2 * s.u, yy, 5, 6, Array.from({ length: n }, () => ({ n: 1, k: 'slate' as const, label: 'B' })), { size: 2.8 });
    };
    const ky = s.h * 0.66;
    s.alpha(s.win('one', 'total'), () => keyRow('16 bits = 2 bytes', 2, ky));
    s.alpha(s.win('mix', 'total'), () => {
      keyRow('32 bits = 4 bytes', 4, ky + 9 * s.u);
      mono(s, 'B: one byte', s.w / 2, ky + 18 * s.u, { size: 3, k: '--ink-3' });
    });
    s.alpha(s.win('total', 'plain'), () => {
      mono(s, '2 + 2 + 4 + 4 + 4 = 16 bytes', s.w / 2, s.h * 0.68, { size: 4, weight: 650 });
      mono(s, 'the training state of one parameter', s.w / 2, s.h * 0.68 + 7 * s.u, { size: 3.2, k: '--ink-2' });
      s.alpha(after(s, 'total', 0.55), () => mono(s, 'the math uses only the first 2', s.w / 2, s.h * 0.68 + 13 * s.u, { size: 3.4, k: 'blue' }));
    });
    s.alpha(plain, () => {
      mono(s, 'plain gradient descent: no m, no v', s.w / 2, s.h * 0.68, { size: 3.4, k: '--ink-2' });
      mono(s, '2 + 2 + 4 = 8 bytes', s.w / 2, s.h * 0.68 + 7 * s.u, { size: 4, weight: 650 });
    });
  },
};

// ---- a whole model: sixteen bytes times N, on GPUs of 80 GB

/**
 * A GPU card of 80 GB centered on (x, y), `w` by `h` units, showing the slice of the training
 * state from `from` GB on, each part in its color. `gbPer` is the GB one byte per parameter costs,
 * `level` how many GB are filled so far, and `lit` lights parts (others dim when any is lit).
 */
function card(s: Scene, x: number, y: number, w: number, h: number, name: string, from: number, gbPer: number, level: number, lit = 0): void {
  gpu(s, x, y, w, h, name, { size: 2.6 });
  const bottom = y + (h / 2 - 2) * s.u;
  const inner = (h - (name ? 8 : 4)) * s.u;
  const iw = (w - 4) * s.u;
  const at = (g: number) => bottom - ((g - from) / 80) * inner;
  SPANS.forEach(([a, b], i) => {
    const lo = Math.max(a * gbPer, from);
    const hi = Math.min(b * gbPer, from + 80, level);
    if (hi <= lo) return;
    const on = i >= 3 ? 1 : 1 - 0.7 * lit;
    s.alpha(on, () => s.rrect(x - iw / 2, at(hi), iw, at(lo) - at(hi), 0.4, { fill: s.tint(PARTS[i]!.k, 0.45), stroke: s.tint(PARTS[i]!.k, 0.9), lw: 0.2 }));
  });
}

const model: SceneDef = {
  draw(s) {
    const big = s.ease('big', 0.5);
    const lit = s.win('adam', 'big');
    const cards = s.ease('gpu', 0.6);
    s.alpha(1 - big, () => {
      s.alpha(s.ease('gb', 0.6), () => mono(s, '16 × 7 × 10⁹ bytes = 112 GB', s.w / 2, s.h * 0.12, { size: s.tall ? 3.6 : 4, weight: 650 }));
      // One row of sixteen bytes per parameter, N rows.
      s.alpha(s.ease('n', 0.6) * (1 - cards), () => {
        const unit = s.tall ? 2.8 : 3;
        const bw = 16 * unit;
        const x0 = s.w / 2 - (bw / 2 - 6) * s.u;
        const rows = ['1', '2', '3', '4', '', 'N'];
        rows.forEach((r, i) => {
          const y = s.h * 0.26 + i * 6.2 * s.u;
          s.alpha(after(s, 'n', 0.1 + 0.08 * i), () => {
            if (!r) {
              mono(s, '⋮', x0 + (bw / 2) * s.u, y, { size: 4, k: '--ink-3' });
              return;
            }
            mono(s, `param ${r}`, x0 - 2 * s.u, y, { size: 3, k: r === 'N' ? 'blue' : '--ink-2', align: 'right', weight: r === 'N' ? 650 : 550 });
            stack(s, x0, y, unit, 4.4, PARTS.map((p) => ({ n: p.n, k: p.k as Ink })), {});
          });
        });
        s.alpha(after(s, 'n', 0.6), () => mono(s, '16N bytes', x0 + (bw + 2) * s.u, s.h * 0.26 + 15.5 * s.u, { size: 3.6, k: 'blue', weight: 650, align: 'left' }));
      });
      const grow = s.ease('gpu', 1.8, 0.4);
      s.alpha(cards, () => {
        const w = 26;
        const h = 34;
        const y = s.h * 0.5;
        card(s, s.w / 2 - 16 * s.u, y, w, h, 'GPU 0: 80 GB', 0, 7, 112 * grow, lit);
        card(s, s.w / 2 + 16 * s.u, y, w, h, 'GPU 1: 80 GB', 80, 7, 112 * grow, lit);
        const ly = y + (h / 2 + 5) * s.u;
        s.alpha(after(s, 'gpu', 0.6) * (1 - lit), () => mono(s, '112 / 80 = 1.4: round up to 2', s.w / 2, ly, { size: 3.4, k: '--ink-2' }));
        s.alpha(lit, () => {
          mono(s, 'm and v: 8 × 7 = 56 GB', s.w / 2, ly, { size: 3.6, k: 'orange', weight: 650 });
          mono(s, '"little memory requirements"', s.w / 2, ly + 6 * s.u, { size: 3.2, k: '--ink-2' });
        });
      });
    });
    cite(s, 'Adam · Kingma & Ba, 2014', lit);

    s.alpha(big, () => {
      mono(s, '16 × 70 × 10⁹ bytes = 1,120 GB', s.w / 2, s.h * 0.12, { size: s.tall ? 3.4 : 3.8, weight: 650 });
      const cols = 7;
      const w = s.tall ? 11 : 12;
      const h = 17;
      for (let i = 0; i < 14; i++) {
        const x = s.w / 2 + ((i % cols) - (cols - 1) / 2) * (w + 2.4) * s.u;
        const y = s.h * 0.34 + Math.floor(i / cols) * (h + 3) * s.u;
        s.alpha(s.ease('big', 0.4, 0.8 + i * 0.12), () => card(s, x, y, w, h, '', 80 * i, 70, 1120));
      }
      s.alpha(s.ease('many', 0.6), () => mono(s, '1,120 / 80 = 14 GPUs', s.w / 2, s.h * 0.34 + (h + 3 + h / 2 + 6) * s.u, { size: 3.8, weight: 650 }));
    });
    s.alpha(s.ease('batch', 0.6), () => {
      mono(s, 'a batch of 1 or of 1,000:', s.w / 2, s.h * 0.83, { size: 3.4, k: '--ink-2' });
      mono(s, 'still 16 bytes per parameter', s.w / 2, s.h * 0.83 + 6.5 * s.u, { size: 3.8, k: 'green', weight: 650 });
    });
  },
};

export const scenes: Record<string, SceneDef> = { fit, param, model };

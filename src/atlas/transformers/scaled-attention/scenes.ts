import type { SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { bars, cells, columns, downArrows, rowLabel } from '../../draw';
import { rich, vrow } from '../draw';

const Q = [2, 1, 0, 1];
const K = [1, 0, 1, 2];
const DOTS = [4, 0, 2];
const SC = DOTS.map((v) => v / 2);
const soft = (e: number[]) => {
  const x = e.map(Math.exp);
  const t = x.reduce((a, b) => a + b, 0);
  return x.map((v) => v / t);
};
const A = soft(SC);
const A4 = soft(SC.map((v) => 4 * v));
const f2 = (v: number) => v.toFixed(2);

const scale: SceneDef = {
  marks: {
    f: { tex: String.raw`\text{score} = \frac{\sym{q}{q} \cdot \sym{k}{k}}{\sqrt{\sym{dk}{d_k}}}`, x: 0.5, y: 0.12, size: 6 },
  },
  draw(s) {
    const cx = s.w / 2;
    const u = s.u;
    s.show('f', 1);
    const row = s.ease('row', 0.6);
    s.alpha(1 - row, () => {
      rowLabel(s, 'q', cx - 20 * u, s.h * 0.3, 'teal', 4);
      vrow(s, cx, s.h * 0.3, Q.map(String), 'teal', { on: Q.map(() => s.win('example', 'row')) });
      rowLabel(s, 'k', cx - 20 * u, s.h * 0.4, 'purple', 4);
      vrow(s, cx, s.h * 0.4, K.map(String), 'purple', { on: K.map(() => s.win('example', 'row')) });
      s.alpha(s.ease('formula', 0.6, 2), () => s.text('dₖ = 4 entries', cx + 22 * u, s.h * 0.35, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-3') }));
      s.alpha(s.ease('example', 0.6, 1.5), () => rich(s, [['q · k = 2 + 0 + 0 + 2 = ', '--ink-2'], ['4', '--ink']], cx, s.h * 0.55, { size: 3.6 }));
      s.alpha(s.ease('example', 0.6, 3.5), () => rich(s, [['√4 = 2   →   4 / 2 = ', '--ink-2'], ['2', 'slate']], cx, s.h * 0.66, { size: 3.6, weight: 600 }));
    });
    const xs = columns(s, 3, 26);
    s.alpha(row, () => {
      rowLabel(s, 'q·k', xs[0]! - 10 * u, s.h * 0.3, '--ink-2', 3.6);
      cells(s, xs, s.h * 0.3, DOTS.map(String), '--ink-3', { w: 11, h: 8 });
      s.alpha(s.ease('row', 0.6, 1), () => {
        downArrows(s, xs, s.h * 0.3 + 5 * u, s.h * 0.45 - 5 * u);
        xs.forEach((x) => s.text('÷ 2', x + 3 * u, s.h * 0.375, { size: 3, font: 'mono', align: 'left', color: s.c('--ink-3'), halo: true }));
        rowLabel(s, 'score', xs[0]! - 10 * u, s.h * 0.45, 'slate', 3.6);
        cells(s, xs, s.h * 0.45, SC.map(String), 'slate', { w: 11, h: 8, on: SC.map(() => s.win('row', 'softmax')) });
      });
    });
    s.alpha(s.ease('softmax', 0.6), () => {
      const base = s.h * 0.9;
      rowLabel(s, 'α', xs[0]! - 9 * u, base - 5 * u, 'green', 3.8);
      bars(s, xs, base, A, 'green', { max: 1, height: 22, w: 9, fmt: f2, grow: s.ease('softmax', 1, 0.3) });
    });
  },
};

// A fixed draw of 16 coin-flip products, summing to +2.
const COINS = [1, -1, 1, 1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, -1, 1];
const DKS = [4, 16, 64, 256];

const why: SceneDef = {
  draw(s) {
    const cx = s.w / 2;
    const u = s.u;
    const lit = s.win('coin', 'sum');
    COINS.forEach((c, i) => {
      const x = cx - 38 * u + (i % 8) * 8 * u;
      const y = s.h * (0.09 + Math.floor(i / 8) * 0.1);
      s.alpha(s.ease('coin', 0.4, 0.8 + 0.08 * i), () => s.cell(x - 3.5 * u, y - 3.5 * u, 7 * u, 7 * u, c > 0 ? '+1' : '−1', c > 0 ? 'teal' : 'red', { on: lit, size: 2.8 }));
    });
    s.alpha(s.ease('coin', 0.6, 2.4), () => {
      s.text('16 products', cx + 30 * u, s.h * 0.09, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-3') });
      s.text('sum = +2', cx + 30 * u, s.h * 0.19, { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c('--ink') });
    });

    const xs = columns(s, 4, 22);
    const base = s.h * 0.82;
    const fix = s.ease('fix', 1.2, 0.6);
    const typ = DKS.map((d) => lerp(Math.sqrt(d), 1, fix));
    s.alpha(s.win('sum', 'sharp') + s.ease('fix', 0.6), () => {
      bars(s, xs, base, typ, fix > 0.5 ? 'green' : 'slate', { max: 16, height: 34, w: 9, fmt: (v) => (fix > 0.99 ? '≈ 1' : String(Math.round(v))), grow: s.since('fix') > 0 ? 1 : s.ease('sum', 1.2, 1) });
      DKS.forEach((d, i) => s.text(`dₖ = ${d}`, xs[i]!, base + 4 * u, { size: 3, font: 'mono', color: s.c('--ink-3') }));
      s.text(fix > 0.5 ? 'typical |q · k| / √dₖ ≈ 1' : 'typical |q · k| ≈ √dₖ', cx, s.h * 0.33, { size: 3.4, font: 'mono', weight: 600, color: s.c(fix > 0.5 ? 'green' : '--ink-2') });
    });

    s.alpha(s.win('sharp', 'fix'), () => {
      const gx = s.tall ? 25 : 30;
      [
        [SC, A, 'scores'],
        [SC.map((v) => 4 * v), A4, 'four times bigger'],
      ].forEach(([sc, p, cap], g) => {
        const gxs = columns(s, 3, 12).map((x) => x + (g === 0 ? -gx : gx) * u);
        s.alpha(g === 0 ? 1 : s.ease('sharp', 0.6, 4.5), () => {
          s.text(cap as string, gxs[1]!, s.h * 0.42, { size: 3.2, font: 'mono', color: s.c('--ink-2') });
          s.text(`[${(sc as number[]).join(', ')}]`, gxs[1]!, s.h * 0.49, { size: 3.4, font: 'mono', weight: 600, color: s.c('slate') });
          bars(s, gxs, base, p as number[], 'green', { max: 1, height: 22, w: 7.5, fmt: f2 });
        });
      });
      s.alpha(s.ease('stuck', 0.6), () => s.text('one weight near 1: a nudged score barely moves it', cx, s.h * 0.32, { size: 3.2, color: s.c('red') }));
    });
  },
};

export const scenes: Record<string, SceneDef> = { scale, why };

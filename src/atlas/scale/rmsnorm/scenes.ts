import type { Scene, SceneDef } from '../../../lecture/scene';
import { box, cells, columns, downArrows, rowLabel } from '../modern-draw';

const X = [1, -5, 5, 7];
const SQ = X.map((v) => v * v);
const OUT = X.map((v) => v / 5);
const SHIFT = X.map((v) => v + 3);
const RS = Math.sqrt(SHIFT.reduce((a, v) => a + v * v, 0) / 4);
const n = (v: number) => String(Number(v.toFixed(2))).replace('-', '−');

/** A pipeline of step boxes joined by arrows; `gone` steps are drawn struck out. */
function pipeline(s: Scene, y: number, steps: string[], k: 'purple' | 'teal', gone: boolean[] = [], a = 1): void {
  const pitch = s.tall ? 26 : 30;
  const xs = columns(s, steps.length, pitch);
  const w = pitch - 7;
  s.alpha(a, () => {
    xs.forEach((x, i) => {
      s.alpha(gone[i] ? 0.35 : 1, () => box(s, x, y, steps[i]!, k, { w, h: 9, size: 3.2 }));
      if (gone[i]) s.line(x - w / 2 * s.u, y, x + (w / 2) * s.u, y, s.c('red'), 0.45);
      if (i) s.arrow(xs[i - 1]! + (w / 2) * s.u, y, x - (w / 2) * s.u, y, s.c('--ink-3'), 0.3, 1.6);
    });
  });
}

const jobs: SceneDef = {
  draw(s) {
    const y1 = s.h * 0.3;
    const y2 = s.h * 0.62;
    s.text('layer norm', s.w / 2, y1 - 9 * s.u, { size: 3.6, font: 'mono', weight: 650, color: s.c('purple') });
    pipeline(s, y1, ['x', '− mean', '÷ std', '×γ + β'], 'purple');
    s.alpha(s.ease('ln', 0.6, 1.5), () => {
      const xs = columns(s, 4, s.tall ? 26 : 30);
      s.text('re-center', xs[1]!, y1 + 8 * s.u, { size: 3, color: s.c('--ink-3') });
      s.text('re-scale', xs[2]!, y1 + 8 * s.u, { size: 3, color: s.c('--ink-3') });
    });
    s.alpha(s.ease('rms', 0.6), () => {
      s.text('RMSNorm', s.w / 2, y2 - 9 * s.u, { size: 3.6, font: 'mono', weight: 650, color: s.c('teal') });
      pipeline(s, y2, ['x', '− mean', '÷ rms', '× γ'], 'teal', [false, true, false, false]);
    });
    s.alpha(s.ease('why', 0.6), () => s.text('same job, less work', s.w / 2, s.h * 0.86, { size: 3.6, weight: 600, color: s.c('green') }));
  },
};

const rms: SceneDef = {
  marks: {
    f: { tex: String.raw`\text{rms}(\symx) = \sqrt{\tfrac{1}{d}\textstyle\sum_i \symx_i^2}`, x: 0.5, y: 0.09, size: 4.6 },
  },
  draw(s) {
    s.show('f', s.ease('root', 0.6));
    const xs = columns(s, 4, s.tall ? 20 : 22);
    const lx = xs[0]! - 13 * s.u;
    const ys = [s.h * 0.24, s.h * 0.42, s.h * 0.74];
    rowLabel(s, 'x', lx, ys[0]!, 'orange');
    cells(s, xs, ys[0]!, X.map(n), 'orange', { on: X.map(() => s.win('x', 'sq')) });
    s.alpha(s.ease('sq', 0.6), () => {
      downArrows(s, xs, ys[0]! + 5.5 * s.u, ys[1]! - 5.5 * s.u);
      rowLabel(s, 'x²', lx, ys[1]!, 'orange');
      cells(s, xs, ys[1]!, SQ.map(n), 'orange', { on: SQ.map(() => s.win('sq', 'root')) });
    });
    const ym = (ys[1]! + ys[2]!) / 2;
    s.alpha(s.ease('mean', 0.6), () => s.text('mean: 100 / 4 = 25', s.w / 2, ym - 3 * s.u, { size: 3.6, font: 'mono', color: s.c('--ink-2') }));
    s.alpha(s.ease('root', 0.6, 0.8), () => s.text('rms = √25 = 5', s.w / 2, ym + 3.5 * s.u, { size: 3.8, font: 'mono', weight: 650, color: s.c('teal') }));
    s.alpha(s.ease('out', 0.6), () => {
      rowLabel(s, 'x / 5', lx, ys[2]!, 'teal', 3.6);
      cells(s, xs, ys[2]!, OUT.map(n), 'teal', { on: OUT.map(() => s.ease('out', 0.6, 1)) });
    });
    s.alpha(s.ease('gain', 0.6), () => {
      s.text('× γ, one gain per feature: d parameters', s.w / 2, s.h * 0.88, { size: s.tall ? 3.2 : 3.6, color: s.c('purple') });
    });
  },
};

const shift: SceneDef = {
  draw(s) {
    const xs = columns(s, 4, s.tall ? 20 : 22);
    const lx = xs[0]! - 13 * s.u;
    const rows: [string, number[], number[], string, number][] = [
      ['x', X, OUT, 'base', 1],
      ['3x', X.map((v) => 3 * v), OUT, 'scale', s.ease('scale', 0.6)],
      ['x + 3', SHIFT, SHIFT.map((v) => v / RS), 'shift', s.ease('shift', 0.6)],
    ];
    s.text('input  →  RMSNorm output', s.w / 2, s.h * 0.07, { size: 3.2, color: s.c('--ink-3') });
    rows.forEach(([name, inp, out, beat, a], r) => {
      const y = s.h * (0.2 + r * 0.28);
      s.alpha(a, () => {
        rowLabel(s, name, lx, y, 'orange', 3.6);
        cells(s, xs, y, inp.map(n), 'orange', { w: 13, h: 7, size: 3.2 });
        const ok = beat !== 'shift';
        cells(s, xs, y + 9.5 * s.u, out.map(n), ok ? 'teal' : 'red', { w: 13, h: 7, size: 3.2, on: beat === 'base' ? [0, 0, 0, 0] : out.map(() => 1) });
        if (beat !== 'base') s.alpha(s.ease(beat, 0.6, 1.5), () => s.text(ok ? 'same' : 'moved', xs[3]! + 9 * s.u, y + 9.5 * s.u, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c(ok ? 'green' : 'red'), halo: true }));
      });
    });
  },
};

export const scenes: Record<string, SceneDef> = { jobs, rms, shift };

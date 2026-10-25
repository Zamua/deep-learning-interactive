import type { Scene, SceneDef } from '../../../lecture/scene';
import { cells, columns, downArrows, line, rich, rowLabel } from '../modern-draw';

const MH = String.raw`\sym{m}{\hat m}`;
const VH = String.raw`\sym{v}{\hat v}`;

/** Two columns, one per weight, with room for row labels on the left. */
function cols(s: Scene) {
  const xs = columns(s, 2, s.tall ? 40 : 46);
  return { xs, lx: xs[0]! - 13 * s.u };
}

const inside: SceneDef = {
  marks: {
    l2: { tex: String.raw`\symg \leftarrow \symg + \symlam\,\symw`, x: 0.5, y: 0.09, size: 5 },
    step: { tex: String.raw`\symw \leftarrow \symw - \symeta\,${MH} / \sqrt{${VH}}`, x: 0.5, y: 0.2, size: 5 },
  },
  draw(s) {
    s.show('l2', s.ease('recall', 0.6));
    s.show('step', s.ease('adam', 0.6));
    s.alpha(s.win('recall', 'two'), () => {
      s.text('every weight gets the same pull λw', s.w / 2, s.h * 0.42, { size: 3.6, color: s.c('--ink-2') });
    });
    const { xs, lx } = cols(s);
    const y0 = s.h * 0.33;
    const y1 = s.h * 0.45;
    const y2 = s.h * 0.58;
    const y3 = s.h * 0.71;
    s.alpha(s.ease('two', 0.6), () => {
      s.text('a: large gradients', xs[0]!, y0, { size: 3.4, color: s.c('--ink-2') });
      s.text('b: tiny gradients', xs[1]!, y0, { size: 3.4, color: s.c('--ink-2') });
      rowLabel(s, '√v̂', lx, y1, 'teal', 3.8);
      cells(s, xs, y1, ['10', '0.1'], 'teal', { w: 16, h: 8, size: 3.4 });
    });
    s.alpha(s.ease('divide', 0.6), () => {
      rowLabel(s, 'λw', lx, y2, 'slate', 3.8);
      cells(s, xs, y2, ['0.1', '0.1'], 'slate', { w: 16, h: 8, size: 3.4 });
    });
    s.alpha(s.ease('divide', 0.6, 2.2), () => {
      downArrows(s, xs, y2 + 5 * s.u, y3 - 5 * s.u);
      xs.forEach((x) => s.text('÷ √v̂', x + 10 * s.u, (y2 + y3) / 2, { size: 3, font: 'mono', align: 'left', color: s.c('teal'), halo: true }));
      rowLabel(s, 'decay', lx, y3, 'red', 3.6);
      cells(s, xs, y3, ['0.01', '1'], 'red', { w: 16, h: 8, size: 3.4, on: [s.ease('wrong', 0.6), s.ease('wrong', 0.6)] });
    });
    s.alpha(s.ease('wrong', 0.6, 0.5), () => {
      s.text('10× too weak', xs[0]!, s.h * 0.83, { size: 3.4, weight: 600, color: s.c('red') });
      s.text('10× too strong', xs[1]!, s.h * 0.83, { size: 3.4, weight: 600, color: s.c('red') });
    });
  },
};

const outside: SceneDef = {
  marks: {
    aw: { tex: String.raw`\symw \leftarrow \symw - \symeta\Big(${MH} / \sqrt{${VH}} + \symlam\,\symw\Big)`, x: 0.5, y: 0.1, size: 4.8 },
  },
  draw(s) {
    s.show('aw', s.ease('rule', 0.6));
    const cx = s.w / 2;
    s.alpha(s.win('fix', 'nums'), () => {
      const y = s.h * 0.34;
      const o = { size: 4.2, font: 'mono', weight: 600 } as const;
      rich(s, [['g = grad', 'red'], ['  + λw', 'slate']], cx, y, o);
      const w0 = s.measure('g = grad', o);
      const w1 = s.measure('  + λw', o);
      const x0 = cx - (w0 + w1) / 2 + w0 + 1.5 * s.u;
      const cut = s.ease('fix', 0.6, 1);
      s.line(x0, y, x0 + (w1 - 1.5 * s.u) * cut, y, s.c('red'), 0.5);
      s.alpha(s.ease('fix', 0.6, 1.8), () => s.text('m and v see the data\'s gradient only', cx, s.h * 0.46, { size: 3.6, color: s.c('--ink-2') }));
    });
    const sums = 1 - s.ease('same', 0.6);
    s.alpha(sums, () => {
      const o = { size: 3.8, font: 'mono' } as const;
      s.alpha(s.ease('nums', 0.6), () => s.text('w = 2   m̂ = 0.3   v̂ = 0.09', cx, s.h * 0.28, { ...o, color: s.c('--ink-3') }));
      s.alpha(s.ease('nums', 0.6, 3), () => rich(s, [['m̂ / √v̂', 'orange'], [' = 0.3 / 0.3 = 1', '--ink']], cx, s.h * 0.4, o));
      s.alpha(s.ease('decay', 0.6), () => rich(s, [['λw', 'slate'], [' = 0.1 × 2 = 0.2', '--ink']], cx, s.h * 0.5, o));
      s.alpha(s.ease('decay', 0.6, 2), () => rich(s, [['η', 'slate'], [' × (1 + 0.2) = 0.12', '--ink']], cx, s.h * 0.6, o));
      s.alpha(s.ease('decay', 0.6, 4.5), () => {
        cells(s, [cx - 13 * s.u, cx + 13 * s.u], s.h * 0.75, ['2', '1.88'], 'blue', { w: 16, h: 9, size: 4, on: [0, 1] });
        s.arrow(cx - 4 * s.u, s.h * 0.75, cx + 4 * s.u, s.h * 0.75, s.c('--ink-3'), 0.4, 2);
        rowLabel(s, 'w', cx - 24 * s.u, s.h * 0.75, 'blue');
      });
    });
    s.alpha(s.ease('same', 0.6), () => {
      const { xs, lx } = cols(s);
      const lab = lx + 2 * s.u;
      s.text('decay inside the step', s.w / 2, s.h * 0.27, { size: 3.4, color: s.c('--ink-3') });
      s.text('a', xs[0]!, s.h * 0.36, { size: 3.8, font: 'mono', weight: 650, color: s.c('--ink-2') });
      s.text('b', xs[1]!, s.h * 0.36, { size: 3.8, font: 'mono', weight: 650, color: s.c('--ink-2') });
      s.alpha(0.55, () => {
        rowLabel(s, 'L2', lab, s.h * 0.48, 'red', 3.6);
        cells(s, xs, s.h * 0.48, ['0.01', '1'], 'red', { w: 16, h: 8, size: 3.4 });
      });
      rowLabel(s, 'AdamW', lab, s.h * 0.62, 'green', 3.6);
      cells(s, xs, s.h * 0.62, ['0.1', '0.1'], 'green', { w: 16, h: 8, size: 3.4, on: [1, 1] });
      line(s, s.ease('same', 0.6, 3), 'the same fraction ηλ for every weight', s.w / 2, s.h * 0.78, 'green', { weight: 600 });
    });
  },
};

export const scenes: Record<string, SceneDef> = { inside, outside };

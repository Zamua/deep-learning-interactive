import { lerp, type Scene, type SceneDef } from '../../../lecture/scene';
import type { Ink } from '../draw';
import { note, rich, spread } from '../draw';

/** A line of the prompt in a soft box, left-aligned at x. */
function line(s: Scene, x: number, y: number, text: string, k: Ink, w: number): void {
  s.rrect(x, y - 3.6 * s.u, w, 7.2 * s.u, 1.2, { fill: s.tint(k, 0.12), stroke: s.tint(k, 0.55), lw: 0.3 });
  s.text(text, x + 2.4 * s.u, y + 0.2 * s.u, { size: 3.3, font: 'mono', weight: 600, align: 'left', color: s.c(k) });
}

const prompt: SceneDef = {
  draw(s) {
    const w = (s.tall ? 62 : 70) * s.u;
    const x = s.w / 2 - w / 2 - (s.tall ? 8 : 6) * s.u;
    const few = s.ease('few', 0.9, 0.3);
    const pitch = 10 * s.u;
    const y0 = s.h * 0.24;
    line(s, x, y0, 'English to French:', 'slate', w);
    s.alpha(few, () => {
      line(s, x, y0 + pitch, 'dog => chien', 'blue', w);
      line(s, x, y0 + 2 * pitch, 'cow => vache', 'blue', w);
    });
    const yIn = lerp(y0 + pitch, y0 + 3 * pitch, few);
    line(s, x, yIn, 'cheese =>', 'orange', w);
    s.alpha(s.ease('answer', 0.6, 0.4), () => {
      s.text('fromage', x + 26 * s.u, yIn + 0.2 * s.u, { size: 3.3, font: 'mono', weight: 650, align: 'left', color: s.c('gold') });
      note(s, 'learned from the context, not from training', s.w / 2, s.h * 0.7, 'gold', 3.2);
    });
    const tag = (txt: string, y: number, k: Ink, a: number) => s.alpha(a, () => s.text(txt, x + w + 2.4 * s.u, y, { size: 2.8, font: 'mono', align: 'left', color: s.c(k) }));
    tag('instruction', y0, 'slate', s.ease('zero', 0.6, 2));
    tag('examples', y0 + 1.5 * pitch, 'blue', few);
    tag('input', yIn, 'orange', s.ease('zero', 0.6, 3));
    s.alpha(s.ease('shots', 0.6), () => {
      const xs = spread(s, 3, s.tall ? 33 : 36);
      const lab: [string, string][] = [
        ['0 examples', 'zero-shot'],
        ['1 example', 'one-shot'],
        ['several', 'few-shot'],
      ];
      lab.forEach(([a, b], i) =>
        s.alpha(s.ease('shots', 0.5, 0.6 * i), () => {
          s.text(a, xs[i]!, s.h * 0.82, { size: 3, font: 'mono', color: s.c('--ink-3') });
          s.text(b, xs[i]!, s.h * 0.89, { size: 3.4, font: 'mono', weight: 650, color: s.c(i === 2 ? 'blue' : '--ink-2') });
        }),
      );
    });
  },
};

/** The prompt as a row of token cells: instruction, examples, input. */
const SEG: [number, Ink][] = [
  [5, 'slate'],
  [4, 'blue'],
  [4, 'blue'],
  [3, 'orange'],
];

function tokens(s: Scene, y: number, a: number, keep: (seg: number) => number): number[] {
  const n = SEG.reduce((t, [m]) => t + m, 0);
  const c = (s.tall ? 5.6 : 6) * s.u;
  const x0 = s.w / 2 - (n * c) / 2;
  const centers: number[] = [];
  let i = 0;
  s.alpha(a, () => {
    SEG.forEach(([m, k], g) => {
      for (let j = 0; j < m; j++, i++) {
        const x = x0 + i * c;
        centers.push(x + c / 2);
        s.alpha(keep(g), () => s.rrect(x + 0.3 * s.u, y - c / 2, c - 0.6 * s.u, c, 0.6, { fill: s.tint(k, 0.45), stroke: s.tint(k, 0.8), lw: 0.25 }));
      }
    });
  });
  return centers;
}

const frozen: SceneDef = {
  draw(s) {
    // The weights: a grid that never changes.
    const gx = s.w / 2;
    const gy = s.h * 0.2;
    const c = 3.6 * s.u;
    const fz = 1 - s.ease('cost', 0.6) * 0.6;
    s.alpha(fz, () => {
      for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) {
        const v = Math.sin(i * 3.1 + j * 1.7) * 0.5 + 0.5;
        s.rrect(gx - 4 * c + j * c + 0.3 * s.u, gy - 2 * c + i * c + 0.3 * s.u, c - 0.6 * s.u, c - 0.6 * s.u, 0.5, { fill: s.tint('blue', 0.15 + 0.6 * v) });
      }
      s.text('weights', gx - 4 * c - 2 * s.u, gy, { size: 3.2, font: 'mono', weight: 600, align: 'right', color: s.c('blue') });
      s.alpha(s.ease('frozen', 0.6, 1.5), () => s.text('unchanged', gx + 4 * c + 2 * s.u, gy, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('green') }));
    });
    const y = s.h * 0.52;
    const gone = s.ease('gone', 0.7, 0.4);
    const back = s.ease('cost', 0.6);
    const xs = tokens(s, y, s.ease('frozen', 0.6, 0.6), (g) => (g === 1 || g === 2 ? 1 - gone * (1 - back) * 0.85 : 1));
    s.alpha(s.ease('frozen', 0.6, 1.2) * (1 - s.ease('tokens', 0.5)), () => note(s, 'the prompt, as tokens', s.w / 2, y + 8 * s.u, '--ink-3', 3));
    s.alpha(s.ease('tokens', 0.6, 1) * (1 - gone), () => {
      const last = xs[xs.length - 1]!;
      for (let j = 5; j < 13; j++) {
        const x0 = xs[j]!;
        const top = y - (5 + 0.9 * (xs.length - 1 - j)) * s.u;
        const ctx = s.ctx;
        ctx.beginPath();
        ctx.moveTo(last, y - 3.4 * s.u);
        ctx.quadraticCurveTo((last + x0) / 2, top, x0, y - 3.4 * s.u);
        ctx.strokeStyle = s.tint('gold', 0.7);
        ctx.lineWidth = 0.3 * s.u;
        ctx.stroke();
      }
      note(s, 'the last position attends back over the examples', s.w / 2, y + 8 * s.u, 'gold', 3);
    });
    s.alpha(gone * (1 - s.ease('cost', 0.5)), () => note(s, 'a new prompt: the examples are gone, nothing kept', s.w / 2, y + 8 * s.u, '--ink-2', 3));
    s.alpha(s.ease('cost', 0.6), () => {
      rich(s, [['5', 'slate'], [' + ', '--ink-3'], ['2 × 4', 'blue'], [' + ', '--ink-3'], ['3', 'orange'], [' = 16 tokens', '--ink-2']], s.w / 2, s.h * 0.72, { size: 3.8, weight: 650 });
      note(s, 'instruction, examples and input all fill the context', s.w / 2, s.h * 0.81, '--ink-3', 3);
    });
  },
};

export const scenes: Record<string, SceneDef> = { prompt, frozen };

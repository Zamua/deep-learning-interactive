import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { columns, verdict } from '../../draw';
import { hbar, mark, pass, word } from '../draw';

/** Each pass: what it reads, the step it takes, what it writes. */
const PASSES: [string, string, string][] = [
  ['17 × 24 = ?', '17 × 20 =', '340'],
  ['340', '17 × 4 =', '68'],
  ['68', '340 + 68 =', '408'],
];

const BIG = { size: 3.4, h: 7.2 };

const depth: SceneDef = {
  draw(s) {
    const xs = columns(s, 3, s.tall ? 31 : 36);
    const yOut = s.h * 0.2;
    const yBox = s.h * 0.48;
    const yIn = s.h * 0.77;
    const bh = (s.h * 0.34) / s.u;
    const cot = s.ease('step1', 0.9);
    const shown = [1, s.ease('feed', 0.7, 0.4), s.ease('answer', 0.7, 0.2)];
    PASSES.forEach(([inp, step, out], i) => {
      const x = i === 0 ? lerp(s.w / 2, xs[0]!, cot) : xs[i]!;
      s.alpha(shown[i]!, () => {
        word(s, x, yIn, inp, i === 0 ? 'orange' : 'gold', BIG);
        s.arrow(x, yIn - 3.6 * s.u, x, yBox + (bh / 2) * s.u + 0.8 * s.u, s.c('--ink-3'), 0.35, 1.8);
        pass(s, x, yBox, 'blue', { h: bh, w: 15, on: i === 0 ? s.win('pass', 'direct') : 0 });
        s.arrow(x, yBox - (bh / 2) * s.u - 0.8 * s.u, x, yOut + 3.6 * s.u, s.c('--ink-3'), 0.35, 1.8);
        if (i === 0) {
          s.alpha(s.ease('direct', 0.6, 1.2) * (1 - cot), () => {
            word(s, x, yOut, '418', 'red', BIG);
            mark(s, false, x + 9 * s.u, yOut);
          });
          s.alpha(cot, () => word(s, x, yOut, out, 'gold', BIG));
        } else word(s, x, yOut, out, i === 2 ? 'green' : 'gold', BIG);
        s.alpha(i === 0 ? s.ease('step1', 0.6, 0.6) : 1, () => s.text(step, x, yOut - 7 * s.u, { size: 3.1, font: 'mono', color: s.c('--ink-3') }));
        if (i === 2) s.alpha(s.ease('answer', 0.6, 1), () => mark(s, true, x + 8 * s.u, yOut));
      });
      // The written token travels back in as the next pass's input.
      if (i < 2) {
        s.alpha(shown[i + 1]!, () => {
          const x1 = xs[i + 1]!;
          s.line(x + 5 * s.u, yOut + 2 * s.u, x1 - 5 * s.u, yIn - 2 * s.u, s.tint('gold', 0.8), 0.35, [1.2, 1]);
        });
      }
    });
    s.alpha(s.win('pass', 'step1'), () => {
      const x = s.w / 2 + 10 * s.u;
      s.text('the same layers', x, yBox - 2.5 * s.u, { size: 3, font: 'mono', align: 'left', color: s.c('blue') });
      s.text('on every pass', x, yBox + 2.5 * s.u, { size: 3, font: 'mono', align: 'left', color: s.c('blue') });
    });
    s.alpha(s.ease('feed', 0.6, 1.4), () => s.text('each pass reads the steps already written', s.w / 2, s.h * 0.92, { size: 3, color: s.c('--ink-3') }));
  },
};

const STEPS = 30;

const cost: SceneDef = {
  draw(s) {
    const cw = 4;
    const per = 16;
    const xs = columns(s, per, cw + 1);
    const y1 = s.h * 0.13;
    const y2 = s.h * 0.3;
    const lab = (t: string, y: number) => s.text(t, s.w / 2, y, { size: 3, font: 'mono', color: s.c('--ink-3') });
    const row = (y: number, n: number, k: (i: number) => 'gold' | 'slate', a: (i: number) => number) => {
      for (let i = 0; i < n; i++) {
        const r = Math.floor(i / per);
        const x = n <= 2 ? s.w / 2 + (i - 0.5) * (cw + 1) * s.u : xs[i % per]!;
        s.alpha(a(i), () => s.cell(x - (cw / 2) * s.u, y + r * 5.4 * s.u - 2.2 * s.u, cw * s.u, 4.4 * s.u, '', k(i), { on: k(i) === 'gold' ? 1 : 0 }));
      }
    };
    const fade = 1 - s.ease('helps', 0.6);
    s.alpha(fade, () => {
      lab('at once: 2 tokens', y1 - 5 * s.u);
      row(y1, 2, () => 'gold', () => 1);
      s.alpha(s.ease('tokens', 0.6, 1.2), () => {
        lab('with steps: 30 + 2 tokens', y2 - 5 * s.u);
        row(y2, STEPS + 2, (i) => (i < STEPS ? 'slate' : 'gold'), (i) => s.ease('tokens', 0.3, 1.4 + i * 0.07));
      });
      const x0 = s.w * (s.tall ? 0.12 : 0.22);
      const full = s.w * (s.tall ? 0.62 : 0.5);
      s.alpha(s.ease('time', 0.6), () => {
        lab('time: one pass per token, 20 ms each', s.h * 0.5);
        hbar(s, x0, s.h * 0.58, (full * 40) / 640, 'gold', '40 ms');
        hbar(s, x0, s.h * 0.67, full * s.ease('time', 1.2, 0.8), 'slate', '640 ms');
      });
      s.alpha(s.ease('long', 0.6), () => s.text('2,000 tokens × 20 ms = 40 s', s.w / 2, s.h * 0.82, { size: 3.8, font: 'mono', weight: 650, color: s.c('red') }));
    });
    const vx = s.w / 2 - (s.tall ? 40 : 36) * s.u;
    s.alpha(s.ease('helps', 0.6, 0.3), () => {
      s.text('17 × 24', vx + 5 * s.u, s.h * 0.3, { size: 3.8, font: 'mono', weight: 650, align: 'left', color: s.c('orange') });
      verdict(s, true, 'steps help: each needs the last', vx, s.h * 0.4, 3.4);
    });
    s.alpha(s.ease('recall', 0.6, 0.3), () => {
      s.text('the capital of France', vx + 5 * s.u, s.h * 0.6, { size: 3.8, font: 'mono', weight: 650, align: 'left', color: s.c('orange') });
      verdict(s, false, 'nothing to build on: only cost', vx, s.h * 0.7, 3.4);
    });
  },
};

export const scenes: Record<string, SceneDef> = { depth, cost };

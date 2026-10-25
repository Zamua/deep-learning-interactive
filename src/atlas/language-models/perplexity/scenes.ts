import type { Scene, SceneDef } from '../../../lecture/scene';
import { bars } from '../../draw';
import { chip, type Ink, note, rich, spread } from '../draw';

const TGT = ['cat', 'sat', 'on', 'a'];
const PY = [1 / 2, 1 / 4, 1 / 2, 1 / 8];
const PYL = ['1/2', '1/4', '1/2', '1/8'];
const LOSS = PY.map((p) => -Math.log(p));
const MEAN = LOSS.reduce((a, b) => a + b, 0) / LOSS.length;
const PPL = Math.exp(MEAN);
const f2 = (v: number) => v.toFixed(2);

const undo: SceneDef = {
  marks: {
    f: { tex: String.raw`\text{perplexity} = e^{\symL}`, x: 0.5, y: 0.84, size: 5 },
    v: { tex: String.raw`e^{1.21} \approx 3.36`, x: 0.5, y: 0.93, size: 4.6 },
  },
  draw(s) {
    const xs = spread(s, 4, s.tall ? 22 : 25);
    const base = s.h * 0.38;
    const yT = s.h * 0.44;
    const yL = s.h * 0.62;
    s.alpha(s.ease('probs', 0.6), () => {
      bars(s, xs, base, PY, 'teal', { max: 0.5, height: 22, w: 10, grow: s.ease('probs', 0.9, 0.5), fmt: () => '' });
      xs.forEach((x, i) => {
        s.alpha(s.ease('probs', 0.5, 1 + 0.5 * i), () => s.text(PYL[i]!, x, base - (PY[i]! / 0.5) * 22 * s.u - 3.4 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c('teal'), halo: true }));
        chip(s, x, yT, TGT[i]!, 'gold', { w: 11, h: 6.5, size: 3 });
      });
      note(s, 'probability of the right next token', s.w / 2, s.h * 0.06, '--ink-3', 3);
    });
    s.alpha(s.ease('losses', 0.6), () => {
      note(s, 'loss: −ln p', s.w / 2, s.h * 0.53, 'red', 3.2);
      xs.forEach((x, i) => s.alpha(s.ease('losses', 0.5, 0.8 + 0.6 * i), () => s.cell(x - 6 * s.u, yL - 4 * s.u, 12 * s.u, 8 * s.u, f2(LOSS[i]!), 'red', { on: s.win('mean', 'exp'), size: 3.2 })));
    });
    s.alpha(s.ease('mean', 0.6), () => {
      rich(s, [['mean loss ', '--ink-3'], ['L', 'red'], [` = ${f2(MEAN)}`, '--ink-2'], [' per token', '--ink-3']], s.w / 2, s.h * 0.73, { size: 3.4, weight: 600 });
    });
    s.show('f', s.ease('exp', 0.6));
    s.show('v', s.ease('exp', 0.6, 2.2));
  },
};

/** A number line from 1 to V, with markers. */
function line(s: Scene, y: number, a: number, marks: [number, string, Ink][]): void {
  s.alpha(a, () => {
    const x0 = s.w / 2 - (s.tall ? 40 : 46) * s.u;
    const x1 = s.w / 2 + (s.tall ? 40 : 46) * s.u;
    // Log scale, so 1, a few, and V all fit.
    const X = (v: number) => x0 + ((x1 - x0) * Math.log(v)) / Math.log(1000);
    s.line(x0, y, x1, y, s.c('--axis'), 0.4);
    for (const [v, lab, k] of marks) {
      s.line(X(v), y - 1.6 * s.u, X(v), y + 1.6 * s.u, s.c(k), 0.5);
      s.text(lab, X(v), y + 5 * s.u, { size: 3, font: 'mono', weight: 600, color: s.c(k) });
    }
  });
}

const count: SceneDef = {
  draw(s) {
    const xs = spread(s, 4, s.tall ? 16 : 18);
    const base = s.h * 0.3;
    const ly = s.h * 0.62;
    s.alpha(s.ease('uniform', 0.6) * (1 - s.ease('bounds', 0.6)), () => {
      bars(s, xs, base, [0.25, 0.25, 0.25, 0.25], 'teal', { max: 0.5, height: 20, w: 9, grow: s.ease('uniform', 0.8, 0.3), fmt: () => '1/4' });
      note(s, 'even over 4 tokens', s.w / 2, base + 4.5 * s.u, '--ink-3', 3);
    });
    s.alpha(s.ease('k', 0.6) * (1 - s.ease('bounds', 0.6)), () => {
      rich(s, [['loss ', '--ink-3'], ['ln 4', 'red'], ['   perplexity ', '--ink-3'], ['e^(ln 4) = 4', 'gold']], s.w / 2, s.h * 0.44, { size: 3.4, weight: 600 });
    });
    line(s, ly, s.ease('means', 0.6), [
      [1, '1', '--ink-3'],
      [PPL, f2(PPL), 'gold'],
      ...(s.ease('bounds', 0.4) > 0.5 ? ([[1000, 'V', 'red']] as [number, string, Ink][]) : []),
    ]);
    s.alpha(s.ease('means', 0.6, 0.8) * (1 - s.ease('bounds', 0.6)), () => note(s, 'as unsure as a fair pick among 3.4 tokens', s.w / 2, ly + 13 * s.u, '--ink-2', 3.2));
    s.alpha(s.ease('bounds', 0.6, 0.6), () => {
      note(s, 'always right', s.w / 2 - (s.tall ? 40 : 46) * s.u, ly + 10 * s.u, '--ink-3', 2.8, 'left');
      note(s, 'knows nothing', s.w / 2 + (s.tall ? 40 : 46) * s.u, ly + 10 * s.u, '--ink-3', 2.8, 'right');
    });
    s.alpha(s.ease('compare', 0.6), () => {
      const y = s.h * 0.24;
      rich(s, [['model A: ', '--ink-3'], ['12', 'green'], ['    model B: ', '--ink-3'], ['30', 'red']], s.w / 2, y - 4 * s.u, { size: 3.6, weight: 600 });
      rich(s, [['loss ', '--ink-3'], ['ln 12 ≈ 2.48', 'green'], ['  <  ', '--ink-3'], ['ln 30 ≈ 3.40', 'red']], s.w / 2, y + 5 * s.u, { size: 3.2 });
      note(s, 'lower perplexity, lower loss: A is better', s.w / 2, y + 14 * s.u, 'green', 3.2);
    });
  },
};

export const scenes: Record<string, SceneDef> = { undo, count };

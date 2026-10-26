import type { SceneDef } from '../../../lecture/scene';
import { INKS, NODES, X3, between, chain, mono, roles } from '../chain-slopes/art';

/** Rows of algebra under the chain, as fractions of the stage height. */
const ROWS = [0.4, 0.55, 0.7, 0.85];

const formula: SceneDef = {
  marks: {
    recap: { tex: String.raw`\symx = 1\!:\quad u = 4,\ \ \frac{dz}{d\symx} = 8 \times 3 = 24`, x: 0.5, y: ROWS[1]!, size: 4.6 },
    inner: { tex: String.raw`\text{inside: } \frac{du}{d\symx} = 3`, x: 0.5, y: ROWS[0]!, size: 4.6 },
    outer: { tex: String.raw`\text{outside: } \frac{dz}{du} = 2u`, x: 0.5, y: ROWS[1]!, size: 4.6 },
    times: { tex: String.raw`\frac{dz}{d\symx} = 2u \cdot 3 = 6u`, x: 0.5, y: ROWS[2]!, size: 4.6 },
    sub: { tex: String.raw`\frac{dz}{d\symx} = 6u = 6(3\symx + 1)`, x: 0.5, y: ROWS[2]!, size: 4.6 },
    check: { tex: String.raw`\symx = 1\!:\quad 6 \times 4 = 24`, x: 0.5, y: ROWS[3]!, size: 4.6 },
    inner2: { tex: String.raw`\text{inside: } u = \symx^{2},\ \ \frac{du}{d\symx} = 2\symx`, x: 0.5, y: ROWS[0]!, size: 4.4 },
    outer2: { tex: String.raw`\text{outside: } z = e^{u},\ \ \frac{dz}{du} = e^{u}`, x: 0.5, y: ROWS[1]!, size: 4.4 },
    times2: { tex: String.raw`\frac{dz}{d\symx} = e^{u} \cdot 2\symx = 2\symx\, e^{\symx^{2}}`, x: 0.5, y: ROWS[2]!, size: 4.6 },
  },
  draw(s) {
    const y = s.h * 0.17;
    const one = 1 - s.ease('curve', 0.5);
    const two = s.ease('curve', 0.6, 0.3);
    chain(s, X3, y, NODES, INKS, [1, 1, 1], [0, s.win('letter', 'outer'), s.win('outer', 'times')]);
    roles(s, y, 1);
    s.alpha(one, () => {
      mono(s, '3x + 1', between(s, X3, 0), y - 5 * s.u, '--ink-2', 3.4);
      mono(s, 'u²', between(s, X3, 1), y - 5 * s.u, '--ink-2', 3.4);
    });
    s.alpha(two, () => {
      mono(s, 'x²', between(s, X3, 0), y - 5 * s.u, '--ink-2', 3.4);
      mono(s, 'eᵘ', between(s, X3, 1), y - 5 * s.u, '--ink-2', 3.4);
    });
    s.show('recap', s.ease('recap', 0.6, 0.8) * (1 - s.ease('letter', 0.5)));
    s.show('inner', s.ease('letter', 0.6, 1) * one);
    s.show('outer', s.ease('outer', 0.6) * one);
    s.show('times', s.ease('times', 0.6) * (1 - s.ease('sub', 0.5)));
    s.show('sub', s.ease('sub', 0.6, 0.3) * one);
    s.show('check', s.ease('check', 0.6) * one);
    s.show('inner2', two);
    s.show('outer2', s.ease('curve', 0.6, 2.2));
    s.show('times2', s.ease('curve2', 0.6));
  },
};

const TRY = [0.31, 0.45, 0.59, 0.73, 0.87];

const worked: SceneDef = {
  marks: {
    q1: { tex: String.raw`z = \ln(2\symx + 3),\quad \frac{dz}{d\symx} = \; ?`, x: 0.5, y: TRY[0]!, size: 4.6 },
    in1: { tex: String.raw`\text{inside: } u = 2\symx + 3,\ \ \frac{du}{d\symx} = 2`, x: 0.5, y: TRY[1]!, size: 4.4 },
    out1: { tex: String.raw`\text{outside: } z = \ln u,\ \ \frac{dz}{du} = \frac{1}{u}`, x: 0.5, y: TRY[2]!, size: 4.4 },
    a1: { tex: String.raw`\frac{dz}{d\symx} = \frac{1}{u} \cdot 2 = \frac{2}{2\symx + 3}`, x: 0.5, y: TRY[3]!, size: 4.6 },
    at: { tex: String.raw`\symx = 1\!:\quad \frac{2}{5} = 0.4`, x: 0.5, y: TRY[4]!, size: 4.6 },
  },
  draw(s) {
    const yc = s.h * 0.13;
    chain(s, X3, yc, NODES, INKS, [1, 1, 1], [0, s.win('in1', 'out1'), s.win('out1', 'a1')]);
    mono(s, '2x + 3', between(s, X3, 0), yc - 5 * s.u, '--ink-2', 3.4);
    mono(s, 'ln u', between(s, X3, 1), yc - 5 * s.u, '--ink-2', 3.4);
    roles(s, yc, 1);
    s.show('q1', s.ease('p1', 0.6, 0.3));
    s.show('in1', s.ease('in1', 0.6));
    s.show('out1', s.ease('out1', 0.6));
    s.show('a1', s.ease('a1', 0.6));
    s.show('at', s.ease('at', 0.6, 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { formula, worked };

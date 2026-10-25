import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-learning-rate',
  title: 'Learning rate',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'factor',
      title: 'Every step multiplies x',
      codeTitle: 'bowl.py',
      code: `
        a, lr = 1.0, 0.3
        x = 1.0                            #@x
        g = 2 * a * x        # gradient    #@g
        x = x - lr * g                     #@step
        # same as x = (1 - 2*a*lr) * x     #@factor
      `,
      beats: [
        { id: 'bowl', say: 'Take the simplest function to walk down, a bowl: f of x equals a x squared, with its minimum at zero. Here a is one, and x starts at one.', code: 'x' },
        { id: 'grad', say: 'Its gradient is two a x. So one step takes x to x, minus {η|eta} times two a x. That step size, {η|eta}, is called the learning rate.', code: ['g', 'step'] },
        { id: 'factor', say: 'Pull out the x, and every step just multiplies x by the same factor: one minus two a {η|eta}. With {η|eta} at {0.3|zero point three}, that is {0.4|zero point four}.', code: 'factor' },
      ],
    },
    {
      id: 'race',
      title: 'Small, good, too large',
      codeTitle: 'race.py',
      code: `
        a, x = 1.0, 1.0
        lr = {{lr:0.05}}
        r = 1 - 2 * a * lr    # {{r:0.9}}    #@r
        x = r * x             # every step    #@step
      `,
      beats: [
        { id: 'small', say: 'With a learning rate of {0.05|zero point zero five}, the factor is {0.9|zero point nine}. Each step keeps ninety percent of x, and the ball creeps.', code: 'r' },
        { id: 'good', say: 'With {0.3|zero point three}, the factor is {0.4|zero point four}. x shrinks fast and slides straight in.', code: 'r' },
        { id: 'zig', say: 'With {0.8|zero point eight}, the factor is minus {0.6|zero point six}. Each step overshoots to the other side, but lands closer: it zigzags in.', code: ['r', 'step'] },
        { id: 'big', say: 'With {1.1|one point one}, the factor is minus {1.2|one point two}. Every overshoot lands farther out, and the steps blow up.', code: ['r', 'step'] },
      ],
    },
    {
      id: 'limit',
      title: 'Where it breaks',
      codeTitle: 'limit.py',
      code: `
        r = 1 - 2 * a * lr                     #@line
        # lr = 1 / (2*a):  r = 0, one step     #@half
        # lr = 1 / a:      r = -1, bounces     #@edge
        lr_max = 1 / a                         #@steep
      `,
      beats: [
        { id: 'line', say: 'Plot the factor against {η|eta}. It starts at one and falls in a straight line as {η|eta} grows.', code: 'line' },
        { id: 'half', say: 'At {η|eta} equals one over two a, it is zero: a single step lands right on the minimum.', code: 'half' },
        { id: 'edge', say: 'At one over a, it reaches minus one, and x bounces between two points forever. Any larger, and it blows up.', code: 'edge' },
        { id: 'steep', say: 'A steeper bowl, a bigger a, makes the line fall faster. The largest learning rate that does not diverge is one over a.', code: 'steep' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

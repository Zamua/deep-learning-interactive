import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-step-factor',
  title: 'The step factor',
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
        # x: 1, 0.4, 0.16, 0.064           #@repeat
      `,
      beats: [
        { id: 'bowl', say: 'Take the simplest function to walk down, a bowl: f of x equals a x squared, where a, a positive number, sets how steep it is. Its minimum is at zero. Here a is one, and x starts at one.', code: 'x' },
        { id: 'grad', say: 'Its gradient is two a x. So one step takes x to x, minus {η|eta} times two a x. That step size, {η|eta}, is called the learning rate.', code: ['g', 'step'] },
        { id: 'factor', say: 'Pull out the x, and every step just multiplies x by the same factor: one minus two a {η|eta}. With {η|eta} at {0.3|zero point three}, that is {0.4|zero point four}.', code: 'factor' },
        { id: 'repeat', say: 'So from one, x goes to {0.4|zero point four}. The next step multiplies by {0.4|zero point four} again, to {0.16|zero point one six}, then to {0.064|zero point zero six four}: the same factor, every step.', code: 'repeat' },
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
      id: 'try',
      title: 'Try one',
      codeTitle: 'try.py',
      code: `
        a, x, lr = 4.0, 3.0, 0.1             #@p1
        g = 2 * a * x          # 24.0        #@a1
        x = x - lr * g         # 0.6         #@a1
        r = 1 - 2 * a * lr     # 0.2         #@check
        x = r * x              # 0.12        #@two
        # 0 < r < 1: slides straight in      #@where
      `,
      beats: [
        { id: 'p1', say: 'Try one: f of x is four x squared, x is three, and {η|eta} is {0.1|zero point one}. Where does one step land?', code: 'p1' },
        { id: 'a1', say: 'The gradient is two times four times three: twenty-four. The step is {0.1|zero point one} times that, {2.4|two point four}. So x goes from three to {0.6|zero point six}.', code: 'a1' },
        { id: 'check', say: 'Check with the factor: one minus two times four times {0.1|zero point one} is {0.2|zero point two}, and {0.2|zero point two} times three is {0.6|zero point six}.', code: 'check' },
        { id: 'two', say: 'And after two steps? The second step multiplies by the same {0.2|zero point two}: {0.2|zero point two} times {0.6|zero point six} is {0.12|zero point one two}.', code: 'two' },
        { id: 'where', say: 'So what does x do over the next steps? The factor, {0.2|zero point two}, is between zero and one, well below one: x keeps its sign and shrinks fast. It slides straight in.', code: 'where' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

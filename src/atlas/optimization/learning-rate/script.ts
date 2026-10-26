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
        # f = a * (x - 3)**2               #@shift
        g = 2 * a * (x - 3)                #@shift
        # x - 3: 1, 0.4, 0.16, ...         #@dist
      `,
      beats: [
        { id: 'bowl', say: 'Take the simplest function to walk down, a bowl: f of x equals a x squared, where a, a positive number, sets how steep it is. Its minimum is at zero. Here a is one, and x starts at one.', code: 'x' },
        { id: 'grad', say: 'Its gradient is two a x. So one step takes x to x, minus {η|eta} times two a x. That step size, {η|eta}, is called the learning rate.', code: ['g', 'step'] },
        { id: 'factor', say: 'Pull out the x, and every step just multiplies x by the same factor: one minus two a {η|eta}. With {η|eta} at {0.3|zero point three}, that is {0.4|zero point four}.', code: 'factor' },
        { id: 'shift', say: 'Now slide the bowl so its bottom sits at three: f of x equals a times {(x − 3)²|x minus three, squared}. Each slope is the old one at the same distance from the bottom, so the gradient is {2a(x − 3)|two a, times x minus three}.', code: 'shift' },
        { id: 'dist', say: 'From x equals four, with {η|eta} at {0.3|zero point three}, the distance x minus three goes one, {0.4|zero point four}, {0.16|zero point one six}: the same factor, one minus two a {η|eta}, every step. Sliding the bowl moves the minimum, and nothing else.', code: 'dist' },
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
        # 1 - 2*a*lr == -1  ->  2*a*lr == 2    #@solve
        lr_max = 1 / a                         #@steep
      `,
      beats: [
        { id: 'line', say: 'Plot the factor against {η|eta}. It starts at one and falls in a straight line as {η|eta} grows.', code: 'line' },
        { id: 'half', say: 'At {η|eta} equals one over two a, it is zero: a single step lands right on the minimum.', code: 'half' },
        { id: 'edge', say: 'At one over a, it reaches minus one, and x bounces between two points forever. Any larger, and it blows up.', code: 'edge' },
        { id: 'solve', say: 'Why one over a? Set the factor to minus one: one minus two a {η|eta} equals minus one. Then two a {η|eta} is two, and {η|eta} is one over a.', code: 'solve' },
        { id: 'steep', say: 'A steeper bowl, a bigger a, makes the line fall faster, so it reaches minus one sooner: at a half, when a is two. The largest learning rate that does not diverge, written {ηₘₐₓ|eta max}, is one over a.', code: 'steep' },
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
        # f = 4 * (x - 3)**2                 #@p2
        # 1 - 8*lr == -1  ->  8*lr == 2      #@a2
        lr_max = 2 / 8         # 0.25        #@a2
      `,
      beats: [
        { id: 'p1', say: 'Try one: f of x is four x squared, x is three, and {η|eta} is {0.1|zero point one}. Where does one step land?', code: 'p1' },
        { id: 'a1', say: 'The gradient is two times four times three: twenty-four. The step is {0.1|zero point one} times that, {2.4|two point four}. So x goes from three to {0.6|zero point six}.', code: 'a1' },
        { id: 'check', say: 'Check with the factor: one minus two times four times {0.1|zero point one} is {0.2|zero point two}, and {0.2|zero point two} times three is {0.6|zero point six}.', code: 'check' },
        { id: 'p2', say: 'Now slide that bowl to three: f is four times {(x − 3)²|x minus three, squared}. What is the largest {η|eta} that does not diverge?', code: 'p2' },
        { id: 'a2', say: 'Sliding moves only the minimum, so a is still four. Set the factor to minus one: one minus eight {η|eta} is minus one, so eight {η|eta} is two, and {η|eta} is {0.25|zero point two five}.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

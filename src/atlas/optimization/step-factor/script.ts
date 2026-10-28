import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-step-factor',
  title: 'The step factor',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'race',
      title: 'Four walks down one bowl',
      codeTitle: 'race.py',
      code: `
        x = 1.0                   #@x
        eta = {{eta:0.05}}        #@eta
        g = 2 * x      # slope    #@step
        x = x - eta * g           #@step
      `,
      beats: [
        { id: 'bowl', say: 'Here is a bowl: f of x equals x squared, lowest at zero. A ball at x equals one walks downhill by the gradient step: each move is minus {η|eta}, the step size, times the slope.', code: ['x', 'step'] },
        { id: 'creep', say: 'With a small step size, {η|eta} at {0.05|zero point zero five}, the ball creeps.', code: 'eta' },
        { id: 'slide', say: 'At {0.3|zero point three}, it slides straight in.', code: 'eta' },
        { id: 'zig', say: 'At {0.8|zero point eight}, each step jumps past the bottom, but lands closer: the ball zigzags in.', code: 'eta' },
        { id: 'blow', say: 'And at {1.1|one point one}, every jump lands farther out. The walk blows up.', code: 'eta' },
        { id: 'why', say: 'Same bowl, same rule; only the step size changed. One number explains all four.', code: 'step' },
      ],
    },
    {
      id: 'factor',
      title: 'Every step multiplies x',
      codeTitle: 'factor.py',
      code: `
        a, eta = 1.0, 0.3              #@a
        x = 1.0                        #@a
        g = 2 * a * x                  #@g
        x = x - eta * g                #@step
        x = (1 - 2*a*eta) * x  # same  #@pull
        r = 1 - 2*a*eta        # 0.4   #@r
        # x: 1, 0.4, 0.16, 0.064       #@repeat
      `,
      beats: [
        { id: 'a', say: 'To see why, give the bowl a steepness: f of x equals {a|A} x squared, where {a|A} is a positive number. Raise {a|A}, and the walls rise faster.', code: 'a' },
        { id: 'grad', say: 'By the power rule, its gradient is two {a|A} x.', code: 'g' },
        { id: 'step', say: 'So one step takes x to x, minus {η|eta} times two {a|A} x.', code: 'step' },
        { id: 'pull', say: 'Both parts hold an x. Pull it out, and the step is x times one minus two {a|A} {η|eta}.', code: 'pull' },
        { id: 'name', say: 'So every step multiplies x by the same number, one minus two {a|A} {η|eta}: the step factor. It depends on the bowl and the step size, but not on where x is.', code: 'pull' },
        { id: 'num', say: 'With {a|A} at one and {η|eta} at {0.3|zero point three}, the factor is one minus {0.6|zero point six}, which is {0.4|zero point four}.', code: 'r' },
        { id: 'x1', say: 'So from one, the first step lands at {0.4|zero point four}.', code: 'repeat' },
        { id: 'x2', say: 'The next step multiplies by {0.4|zero point four} again, landing at {0.16|zero point one six}.', code: 'repeat' },
      ],
    },
    {
      id: 'read',
      title: 'The factor decides',
      codeTitle: 'read.py',
      code: `
        a, x = 1.0, 1.0
        eta = {{eta:0.05}}
        r = 1 - 2*a*eta  # {{r:0.9}}   #@r
        x = r * x        # every step  #@step
      `,
      beats: [
        { id: 'creep', say: 'Now the four walks. At {0.05|zero point zero five}, the factor is {0.9|zero point nine}: each step keeps ninety percent of x, so x creeps.', code: 'r' },
        { id: 'slide', say: 'At {0.3|zero point three}, it is {0.4|zero point four}: positive and well below one, so x keeps its sign and shrinks fast.', code: 'r' },
        { id: 'zig', say: 'At {0.8|zero point eight}, it is minus {0.6|zero point six}. A negative factor flips the sign of x: the jump to the other side.', code: ['r', 'step'] },
        { id: 'zig2', say: 'But {0.6|zero point six} is less than one, so each landing is closer: x zigzags in.', code: 'step' },
        { id: 'blow', say: 'At {1.1|one point one}, it is minus {1.2|one point two}. The sign flips, and x grows every step: it blows up.', code: ['r', 'step'] },
        { id: 'map', say: 'So the factor tells the walk. Between zero and one, x slides in, slower the nearer it is to one. Between minus one and zero, it zigzags in. Below minus one, it blows up.', code: 'r' },
      ],
    },
    {
      id: 'try',
      title: 'Try one',
      codeTitle: 'try.py',
      code: `
        a, x, eta = 4.0, 3.0, 0.1      #@p1
        g = 2 * a * x      # 24.0      #@g
        x = x - eta * g    # 0.6       #@x1
        r = 1 - 2*a*eta    # 0.2       #@check
        x = r * x          # 0.12      #@two
        # 0 < r < 1: slides in         #@where
      `,
      beats: [
        { id: 'p1', say: 'Try one: f of x is four x squared, x is three, and {η|eta} is {0.1|zero point one}. Where does one step land?', code: 'p1' },
        { id: 'g', say: 'The gradient is two times four times three: twenty-four.', code: 'g' },
        { id: 'stp', say: 'The step is {0.1|zero point one} times that, which is {2.4|two point four}.', code: 'x1' },
        { id: 'x1', say: 'Three minus {2.4|two point four} lands x at {0.6|zero point six}.', code: 'x1' },
        { id: 'check', say: 'And after two steps? The factor here is one minus two times four times {0.1|zero point one}, which is {0.2|zero point two}.', code: 'check' },
        { id: 'two', say: 'So the second step multiplies {0.6|zero point six} by {0.2|zero point two}, landing at {0.12|zero point one two}.', code: 'two' },
        { id: 'where', say: 'And after that? The factor is between zero and one, well below one: x slides straight in.', code: 'where' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

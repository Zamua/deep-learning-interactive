import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-learning-rate',
  title: 'Learning rate',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
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
        { id: 'recap', say: 'On the bowl a x squared, every step multiplies x by one minus two a {η|eta}. With a at one and a learning rate of {0.8|zero point eight}, that is minus {0.6|zero point six}, and x zigzags in.', code: 'line' },
        { id: 'line', say: 'Plot the factor against {η|eta}. It starts at one and falls in a straight line as {η|eta} grows.', code: 'line' },
        { id: 'half', say: 'At {η|eta} equals one over two a, it is zero: a single step lands right on the minimum.', code: 'half' },
        { id: 'edge', say: 'At one over a, it reaches minus one, and x bounces between two points forever. Any larger, and it blows up.', code: 'edge' },
        { id: 'solve', say: 'Why one over a? Set the factor to minus one: one minus two a {η|eta} equals minus one. Then two a {η|eta} is two, and {η|eta} is one over a.', code: 'solve' },
        { id: 'steep', say: 'A steeper bowl, a bigger a, makes the line fall faster, so it reaches minus one sooner: at a half, when a is two. The largest learning rate that does not diverge, written {ηₘₐₓ|eta max}, is one over a.', code: 'steep' },
      ],
    },
    {
      id: 'slide',
      title: 'Slide the bowl',
      codeTitle: 'slide.py',
      code: `
        a, lr = 1.0, 0.3
        # f = a * (x - 3)**2                 #@shift
        g = 2 * a * (x - 3)                  #@shift
        x = x - lr * g                       #@dist
        # x - 3: 1, 0.4, 0.16, ...           #@dist
      `,
      beats: [
        { id: 'shift', say: 'Now slide the bowl so its bottom sits at three: f of x equals a times {(x − 3)²|x minus three, squared}. Each slope is the old one at the same distance from the bottom, so the gradient is {2a(x − 3)|two a, times x minus three}.', code: 'shift' },
        { id: 'dist', say: 'From x equals four, with {η|eta} at {0.3|zero point three}, the distance x minus three goes one, {0.4|zero point four}, {0.16|zero point one six}: the same factor, one minus two a {η|eta}, every step. Sliding the bowl moves the minimum, and nothing else: the limit is still one over a.', code: 'dist' },
      ],
    },
    {
      id: 'try',
      title: 'Try one',
      codeTitle: 'try.py',
      code: `
        # f = 4 * (x - 3)**2                 #@p1
        # 1 - 8*lr == -1  ->  8*lr == 2      #@a1
        lr_max = 2 / 8         # 0.25        #@a1
        # 1 - 8*lr == 0   ->  8*lr == 1      #@a2
        lr_one = 1 / 8         # 0.125       #@a2
        r = 1 - 8 * 0.2        # -0.6        #@a3
      `,
      beats: [
        { id: 'p1', say: 'Try one: f of x is four times {(x − 3)²|x minus three, squared}. What is the largest {η|eta} that does not diverge?', code: 'p1' },
        { id: 'a1', say: 'Sliding moves only the minimum, so a is still four. Set the factor to minus one: one minus eight {η|eta} is minus one, so eight {η|eta} is two, and {η|eta} is {0.25|zero point two five}.', code: 'a1' },
        { id: 'p2', say: 'Which {η|eta} lands on the minimum in a single step?', code: 'p1' },
        { id: 'a2', say: 'Set the factor to zero instead: one minus eight {η|eta} is zero, so eight {η|eta} is one, and {η|eta} is one eighth, {0.125|zero point one two five}.', code: 'a2' },
        { id: 'p3', say: 'And what does x do with {η|eta} at {0.2|zero point two}? The factor is one minus eight times {0.2|zero point two}: minus {0.6|zero point six}, between minus one and zero. x zigzags in.', code: 'a3' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

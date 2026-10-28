import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-learning-rate',
  title: 'Learning rate',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Rumelhart, Hinton & Williams', year: 1986, title: 'Learning internal representations by error propagation', url: 'https://doi.org/10.7551/mitpress/5236.001.0001', scene: 'ask' },
    { who: 'Widrow, McCool, Larimore & Johnson', year: 1976, title: 'Stationary and nonstationary learning characteristics of the LMS adaptive filter', url: 'https://doi.org/10.1109/PROC.1976.10286', scene: 'line' },
  ],
  scenes: [
    {
      id: 'ask',
      title: 'How big a step?',
      codeTitle: 'edge.py',
      code: `
        x = x - lr * 2 * x             #@step
        r = 1 - 2 * lr                 #@r
        # lr 0.1:  r 0.8, slow         #@small
        # lr 0.4:  r 0.2, fast         #@small
        # lr 0.95: r -0.9, settles     #@edge
        # lr 1.05: r -1.1, diverges    #@edge
      `,
      beats: [
        { id: 'fast', say: 'Back to the bowl, f of x equals x squared. A bigger step size gets down faster: at {0.1|zero point one}, the ball crawls; at {0.4|zero point four}, it is there in a few hops.', code: ['step', 'small'] },
        { id: 'edge', say: 'But push it too far, and it breaks. At {0.95|zero point nine five}, x zigzags and settles. At {1.05|one point zero five}, barely more, every swing lands farther out.', code: 'edge' },
        { id: 'diverge', say: 'A walk that runs away like that, its swings growing without end, is said to diverge. So how big can a step be?', code: 'edge' },
        { id: 'name', say: 'In 1986, David Rumelhart, Geoffrey Hinton and Ronald Williams, who used steps like these to make programs learn, called the step size the learning rate.', code: 'step' },
        { id: 'advice', say: 'Their advice: make it as large as possible without leading to oscillation, x swinging back and forth, since that learns fastest. On a bowl, the edges can be found exactly.', code: 'r' },
      ],
    },
    {
      id: 'line',
      title: 'Where the factor hits minus one',
      codeTitle: 'limit.py',
      code: `
        r = 1 - 2 * a * lr               #@line
        # lr = 1 / (2*a):  r = 0         #@half
        # lr = 1 / a:      r = -1        #@edge
        # 1 - 2*a*lr == -1               #@solve
        # 2*a*lr == 2                    #@solve2
        lr_max = 1 / a                   #@max
      `,
      beats: [
        { id: 'line', say: 'Each step multiplies x by one minus two {a|A} {η|eta}. Plot that factor against {η|eta}, with {a|A} at one: it falls from one in a straight line.', code: 'line' },
        { id: 'bands', say: 'Behind it are the walks it gives: sliding in above zero, zigzagging in down to minus one, and blowing up below.', code: 'line' },
        { id: 'half', say: 'It crosses zero at {η|eta} equals one over two {a|A}, a half here. A factor of zero leaves nothing of x: one step lands right on the minimum. Past that, x starts to swing.', code: 'half' },
        { id: 'edge', say: 'At {η|eta} equals one, it reaches minus one. Each step then flips x but keeps its size, so x bounces between two points forever. Any larger, and it diverges.', code: 'edge' },
        { id: 'solve', say: 'Where is that edge for any {a|A}? Set the factor to minus one: one minus two {a|A} {η|eta} equals minus one.', code: 'solve' },
        { id: 'solve2', say: 'Then two {a|A} {η|eta} must equal two.', code: 'solve2' },
        { id: 'max', say: 'Divide by two {a|A}: {η|eta} is one over {a|A}. That is the largest learning rate that does not diverge, written {ηₘₐₓ|eta max}.', code: 'max' },
        { id: 'widrow', say: 'Bernard Widrow and colleagues wrote down this same limit in 1976, for adaptive filters: circuits that tune their own settings by walking down a bowl.', code: 'max' },
        { id: 'steep', say: 'A steeper bowl, a bigger {a|A}, makes the line fall faster. With {a|A} at two, it reaches minus one at a half: steep walls need small steps.', code: 'max' },
      ],
    },
    {
      id: 'slide',
      title: 'Slide the bowl',
      codeTitle: 'slide.py',
      code: `
        # f = a * (x - 3)**2           #@shift
        g = 2 * a * (x - 3)            #@grad
        x = x - lr * g                 #@dist
        # x - 3: 1, then 0.4           #@dist
      `,
      beats: [
        { id: 'shift', say: 'Now slide the bowl so its bottom sits at three: f of x equals {a|A} times {(x − 3)²|x minus three, squared}.', code: 'shift' },
        { id: 'grad', say: 'Each slope is the old one at the same distance from the bottom, so the gradient is {2a(x − 3)|two A, times x minus three}.', code: 'grad' },
        { id: 'dist', say: 'So each step multiplies the distance to the bottom by the same factor. With {a|A} at one and {η|eta} at {0.3|zero point three}, a ball at four is one away, and one step leaves it {0.4|zero point four} away.', code: 'dist' },
        { id: 'same', say: 'Sliding moves the minimum and nothing else: the factor, and so the limit of one over {a|A}, stay the same.', code: 'dist' },
      ],
    },
    {
      id: 'try',
      title: 'Try one',
      codeTitle: 'try.py',
      code: `
        # f = 4 * (x - 3)**2           #@p1
        lr_max = 1 / 4       # 0.25    #@a1
        lr_one = 1 / (2*4)   # 0.125   #@a2
        r = 1 - 8 * 0.2      # -0.6    #@a3
      `,
      beats: [
        { id: 'p1', say: 'Try one: f of x is four times {(x − 3)²|x minus three, squared}. What is the largest {η|eta} that does not diverge?', code: 'p1' },
        { id: 'a1', say: 'Sliding changes nothing, so {a|A} is four, and the limit is one over four: {0.25|zero point two five}.', code: 'a1' },
        { id: 'p2', say: 'Which {η|eta} lands on the minimum in one step?', code: 'p1' },
        { id: 'a2', say: 'That needs a factor of zero: one over two {a|A}, which is one eighth, or {0.125|zero point one two five}.', code: 'a2' },
        { id: 'p3', say: 'And with {η|eta} at {0.2|zero point two}, what does x do?', code: 'p1' },
        { id: 'z1', say: 'The factor is one minus eight times {0.2|zero point two}: minus {0.6|zero point six}. That is between minus one and zero, so x zigzags in, closing on three.', code: 'a3' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

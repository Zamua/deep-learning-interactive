import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-sigmoid-grad',
  title: 'Sigmoid gradient',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'curve',
      title: 'Squash into zero to one',
      codeTitle: 'sigmoid.py',
      code: `
        def sigmoid(x):                    #@def
            return 1 / (1 + np.exp(-x))    #@def
        sigmoid(0)     # 0.5               #@zero
        sigmoid(2)     # 0.88              #@two
        sigmoid(-2)    # 0.12              #@neg
      `,
      beats: [
        { id: 'def', say: 'The sigmoid squashes any number into the range zero to one. Written {σ(x)|sigma of x}, with the Greek letter sigma, it is one over one plus e to the minus x.', code: 'def' },
        { id: 'zero', say: 'At zero, e to the zero is one, so sigma is one over two: a half.', code: 'zero' },
        { id: 'two', say: 'At two, e to the minus two is about {0.14|zero point one four}. One over {1.14|one point one four} is about {0.88|zero point eight eight}.', code: 'two' },
        { id: 'tails', say: 'Far to the right it creeps up toward one, and far to the left down toward zero. At minus two, it is {0.12|zero point one two}.', code: 'neg' },
      ],
    },
    {
      id: 'slope',
      title: 'The slope from the output',
      codeTitle: 'slope.py',
      code: `
        out = sigmoid(x)                  #@out
        local = out * (1 - out)           #@local
        # x = 2: 0.88 * 0.12 = 0.105      #@two
        # x = 0: 0.5 * 0.5 = 0.25         #@peak
        dx = local * dout                 #@chain
      `,
      beats: [
        { id: 'rule', say: 'Its slope, {dσ/dx|d sigma, d x}, has a neat form: sigma times one minus sigma. Backprop can build it from the output it already has.', code: ['out', 'local'] },
        { id: 'two', say: 'At x equals two, that is {0.88|zero point eight eight} times {0.12|zero point one two}: about {0.105|zero point one zero five}.', code: 'two' },
        { id: 'peak', say: 'The slope is steepest at zero: a half times a half, a quarter. It is never more than that.', code: 'peak' },
        { id: 'chain', say: 'In a graph, the sigmoid node multiplies the gradient from above by this local slope, so it shrinks the gradient at least four times.', code: 'chain' },
      ],
    },
    {
      id: 'flat',
      title: 'Saturation',
      codeTitle: 'saturate.py',
      code: `
        out = sigmoid(6)          # 0.9975   #@six
        out * (1 - out)           # 0.0025   #@tiny
        # dout = 1: x gets 0.0025            #@dead
      `,
      beats: [
        { id: 'six', say: 'Far from zero the curve goes flat. At six, sigma is {0.9975|zero point nine nine seven five}.', code: 'six' },
        { id: 'tiny', say: 'So its slope is {0.9975|zero point nine nine seven five} times {0.0025|zero point zero zero two five}: about {0.0025|zero point zero zero two five}.', code: 'tiny' },
        { id: 'dead', say: 'Almost no gradient gets through. A saturated sigmoid, stuck near zero or one, passes almost nothing back to the nodes before it.', code: 'dead' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

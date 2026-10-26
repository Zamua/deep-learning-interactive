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
        sigmoid(0)   # 1 / (1 + 1) = 0.5        #@zero
        sigmoid(2)   # 1 / (1 + 0.14) = 0.88    #@two
        sigmoid(-2)  # 1 / (1 + 7.39) = 0.12    #@neg
      `,
      beats: [
        { id: 'def', say: 'The sigmoid squashes any number into the range zero to one. Written {σ(x)|sigma of x}, with the Greek letter sigma, it is one over one plus e to the minus x.', code: 'def' },
        { id: 'zero', say: 'At zero, e to the zero is one, so sigma is one over two: a half.', code: 'zero' },
        { id: 'two', say: 'At two, e to the minus two is about {0.14|zero point one four}. One over {1.14|one point one four} is about {0.88|zero point eight eight}.', code: 'two' },
        { id: 'tails', say: 'Far to the right it creeps up toward one, and far to the left down toward zero.', code: 'def' },
        { id: 'neg', say: 'At minus two, minus x is two, so e to the minus x is e squared: about {7.39|seven point three nine}. One over {8.39|eight point three nine} is about {0.12|zero point one two}: below a half, as every negative input gives.', code: 'neg' },
      ],
    },
    {
      id: 'measure',
      title: 'Measure the slope',
      codeTitle: 'measure.py',
      code: `
        sigmoid(0.01) - sigmoid(0)   # 0.0025     #@nudge
        0.0025 / 0.01                # 0.25       #@measure
        0.5 * (1 - 0.5)              # 0.25       #@measure
        sigmoid(2.01) - sigmoid(2)   # 0.00105    #@two
        0.00105 / 0.01               # 0.105      #@two
        0.881 * (1 - 0.881)          # 0.105      #@match
        local = out * (1 - out)                   #@rule
      `,
      beats: [
        { id: 'nudge', say: 'How steep is the sigmoid? Measure it as for any curve. Nudge x from zero to {0.01|zero point zero one}, and sigma goes from a half to {0.5025|zero point five zero two five}.', code: 'nudge' },
        { id: 'measure', say: 'It rose {0.0025|zero point zero zero two five} over a run of {0.01|zero point zero one}: a slope of a quarter. And a quarter is a half times a half, which is sigma times one minus sigma.', code: 'measure' },
        { id: 'two', say: 'At two, the same nudge raises sigma by about {0.00105|zero point zero zero one zero five}. Over the run of {0.01|zero point zero one}, that is a slope of about {0.105|zero point one zero five}.', code: 'two' },
        { id: 'match', say: 'Sigma there is about {0.881|zero point eight eight one}, and one minus it is {0.119|zero point one one nine}. Their product is about {0.105|zero point one zero five}: the same again.', code: 'match' },
        { id: 'rule', say: 'That holds at every x: the slope, {dσ/dx|d sigma, d x}, is sigma times one minus sigma. Backprop can build it from the output it already has.', code: 'rule' },
      ],
    },
    {
      id: 'slope',
      title: 'The slope in a graph',
      codeTitle: 'slope.py',
      code: `
        # x = 0: 0.5 * 0.5 = 0.25           #@plot
        out = sigmoid(2)        # 0.881     #@chain
        dout = 2                            #@chain
        dx = out * (1 - out) * dout  # 0.21 #@chain
        # dx is at most 0.25 * dout         #@most
      `,
      beats: [
        { id: 'plot', say: 'Plot that slope at every x. It peaks at zero, where sigma is a half, at a quarter, and falls away on both sides.', code: 'plot' },
        { id: 'chain', say: 'In a graph, the sigmoid node multiplies the gradient from above, {∂f/∂σ|partial f, partial sigma}, by this local slope. Say two arrives, at x equals two. Then x gets two times {0.105|zero point one zero five}: about {0.21|zero point two one}.', code: 'chain' },
        { id: 'most', say: 'Wherever x is, the slope is at most a quarter. So x gets at most a quarter of what arrives: with two from above, never more than a half.', code: 'most' },
      ],
    },
    {
      id: 'flat',
      title: 'Saturation',
      codeTitle: 'saturate.py',
      code: `
        out = sigmoid(6)          # 0.9975   #@six
        out * (1 - out)           # 0.0025   #@tiny
        out = sigmoid(-6)         # 0.0025   #@mirror
        out * (1 - out)           # 0.0025   #@mirror
        # dout = 1: x gets 0.0025            #@dead
      `,
      beats: [
        { id: 'six', say: 'Far from zero the curve goes flat. At six, sigma is {0.9975|zero point nine nine seven five}.', code: 'six' },
        { id: 'tiny', say: 'So its slope is {0.9975|zero point nine nine seven five} times {0.0025|zero point zero zero two five}: about {0.0025|zero point zero zero two five}.', code: 'tiny' },
        { id: 'mirror', say: 'At minus six, it is the mirror image: sigma is {0.0025|zero point zero zero two five}, one minus sigma is {0.9975|zero point nine nine seven five}, and the slope is the same.', code: 'mirror' },
        { id: 'dead', say: 'Almost no gradient gets through. A saturated sigmoid, stuck near zero or one, passes almost nothing back to the nodes before it.', code: 'dead' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

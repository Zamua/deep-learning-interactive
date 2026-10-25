import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-bptt',
  title: 'Backprop through time',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'unroll',
      title: 'Backprop through the loop',
      codeTitle: 'bptt.py',
      code: `
        for x in xs:                              #@fwd
            h = np.tanh(Whh @ h + Wxh @ x + b)    #@fwd
        L = loss(h)                               #@loss
        # back one step: times Whh, tanh slope   #@back
        # dWhh: one term from every step, added up      #@sum
      `,
      beats: [
        { id: 'graph', say: 'Unroll the loop, and an RNN is just a deep graph: one copy of the step for every token, all sharing the same weights.', code: 'fwd' },
        { id: 'back', say: 'Backprop runs through it as through any graph, from the loss back to the first step. That is backprop through time.', code: ['loss', 'back'] },
        { id: 'factor', say: 'Each step back multiplies the gradient by that step\'s local derivative: {Whh|W h h}, times the slope of the tanh.', code: 'back' },
        { id: 'sum', say: 'And since {Whh|W h h} is used at every step, its gradient adds up one contribution from each of them.', code: 'sum' },
      ],
    },
    {
      id: 'products',
      title: 'Long products',
      codeTitle: 'products.py',
      code: `
        grad = 1.0
        for _ in range(10):        # ten steps back   #@loop
            grad = grad * a                            #@loop
        # a = 0.5:  0.5 ** 10 = 0.001                  #@vanish
        # a = 2.0:  2.0 ** 10 = 1024                   #@explode
      `,
      beats: [
        { id: 'scalar', say: 'Picture a single hidden unit, where each step back multiplies the gradient by the same number, a. Ten steps back, it has been multiplied by a to the tenth.', code: 'loop' },
        { id: 'vanish', say: 'If a is one half, that is about one thousandth. The gradient vanishes: the early steps get almost none of it.', code: 'vanish' },
        { id: 'explode', say: 'If a is two, it is over a thousand. The gradient explodes, and the numbers soon grow too large to use.', code: 'explode' },
      ],
    },
    {
      id: 'clip',
      title: 'Clip the norm',
      codeTitle: 'clip.py',
      code: `
        g = np.array([3.0, 4.0])     # norm 5        #@g
        c = 1.0                      # threshold     #@c
        n = np.linalg.norm(g)                        #@check
        if n > c:                                    #@check
            g = g * c / n            # [0.6, 0.8]    #@scale
      `,
      beats: [
        { id: 'clip', say: 'Exploding gradients have a blunt fix: clip them. Pick a threshold, c, say one.', code: 'c' },
        { id: 'check', say: 'Whenever the gradient\'s norm is over c, shrink the whole vector to length c. Here g is three, four, with norm five.', code: ['g', 'check'] },
        { id: 'scale', say: 'Multiply it by c over the norm, one fifth: {0.6|zero point six} and {0.8|zero point eight}. Same direction, shorter length.', code: 'scale' },
        { id: 'limit', say: 'Clipping only ever shrinks: it tames a gradient that explodes, but it cannot bring back one that has vanished.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-weight-init',
  title: 'Weight initialization',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'symmetry',
      title: 'Why not all the same',
      codeTitle: 'init.py',
      code: `
        W1 = np.zeros((H, D))      # every unit the same    #@zero
        # same output, same gradient, same change           #@same
        W1 = 0.01 * np.random.randn(H, D)  # break the tie  #@random
      `,
      beats: [
        { id: 'zero', say: 'Before any weight is adjusted by its gradient, every weight needs a starting value. The obvious choice, all zeros, does not work.', code: 'zero' },
        { id: 'same', say: 'If every hidden unit starts with the same weights, every unit computes the same output and backprop hands every unit the same gradient. Adjusted by the same gradient, they stay copies of one unit, forever.', code: 'same' },
        { id: 'random', say: 'So the weights start random, which breaks the tie. The question is how big to make them.', code: 'random' },
      ],
    },
    {
      id: 'grow',
      title: 'Sums grow',
      codeTitle: 'init.py',
      code: `
        z = w @ x    # n terms, each of variance v   #@sum
        # Var(z) = n * v                              #@sum
        # n = 100, std(w) = 1: std(z) = 10            #@big
        np.tanh(10)  # 1.0: flat, slope near 0        #@flat
        # std(w) too small: shrinks every layer       #@small
      `,
      beats: [
        { id: 'sum', say: 'A unit adds up n inputs times weights. A term\'s variance is its average squared distance from its mean. When you add independent terms, their variances add: n terms of variance v give a sum z of variance n times v, written {Var(z) = n v|var of z equals n v}.', code: 'sum' },
        { id: 'big', say: 'The standard deviation, {std|S T D} for short, is the square root of the variance. Give a hundred inputs, and their weights, a variance of one each. A weight times an input has the product of their variances, one, so the sum has variance a hundred, and a {std|standard deviation} of {√100|the square root of a hundred}: ten.', code: 'big' },
        { id: 'flat', say: 'Through a tanh, a value like ten sits far out on the flat end. The slope there is nearly zero, and so is the gradient.', code: 'flat' },
        { id: 'small', say: 'Too small is just as bad. Each layer shrinks the signal, and after a few layers almost nothing is left.', code: 'small' },
      ],
    },
    {
      id: 'scale',
      title: 'Scale by the fan-in',
      codeTitle: 'init.py',
      code: `
        W = np.random.randn(H, n) / np.sqrt(n)      # Xavier, tanh  #@xavier
        W = np.random.randn(H, n) * np.sqrt(2 / n)  # He, ReLU      #@he
      `,
      beats: [
        { id: 'xavier', say: 'The fix: give each weight a variance of one over n, the fan-in, which is the number of inputs a unit adds up. Then the n terms add up to a variance of one. The standard deviation is {1/√n|one over root n}: for a hundred inputs, {0.1|zero point one}.', code: 'xavier' },
        { id: 'he', say: 'A ReLU zeroes about half of its inputs, which halves the variance. So for ReLU, double it: a variance of two over n. For fifty inputs, the standard deviation is {√(2/50)|the root of two over fifty}: {0.2|zero point two}.', code: 'he' },
        { id: 'names', say: 'The first is Xavier initialization, used with tanh. The second is {He|Kaiming He} initialization, used with ReLU.', code: ['xavier', 'he'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

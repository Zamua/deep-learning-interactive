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
      id: 'scale',
      title: 'Scale by the fan-in',
      codeTitle: 'init.py',
      code: `
        # n = 100, std(w) = 1: std(z) = 10, tanh flat   #@recap
        # std(w) = 0.01: std(z) = 0.1 per layer         #@small
        W = np.random.randn(H, n)                   # H units, n inputs  #@fanin
        W = np.random.randn(H, n) / np.sqrt(n)      # Xavier, tanh       #@xavier
        W = np.random.randn(H, n) * np.sqrt(2 / n)  # He, ReLU           #@he
      `,
      beats: [
        { id: 'recap', say: 'A sum of n independent terms has n times their variance. Give a hundred inputs, each of variance one, weights of variance one, and z has variance a hundred: a {std|standard deviation} of ten.', code: 'recap' },
        { id: 'flat', say: 'Through a tanh, a value like ten sits far out on the flat end. The slope there is nearly zero, and so is the gradient.', code: 'recap' },
        { id: 'small', say: 'Too small is just as bad. With weights of {std|standard deviation} {0.01|zero point zero one}, z has variance a hundred times {0.0001|zero point zero zero zero one}: {0.01|zero point zero one}, a {std|standard deviation} of {0.1|zero point one}. Near zero, tanh passes values almost unchanged, so layer after layer the signal shrinks: one, {0.1|zero point one}, {0.01|zero point zero one}, {0.001|zero point zero zero one}.', code: 'small' },
        { id: 'fanin', say: 'The fix scales the weights by the fan-in, n: the number of inputs each unit adds up. The weight matrix has a row per unit and a column per input, so n is its number of columns.', code: 'fanin' },
        { id: 'xavier', say: 'Give each weight a variance of one over n. Then the n terms add up to a variance of one. The standard deviation is {1/√n|one over root n}: for a hundred inputs, {0.1|zero point one}.', code: 'xavier' },
        { id: 'he', say: 'A ReLU zeroes about half of its inputs, which halves the variance. So for ReLU, double it: a variance of two over n. For fifty inputs, the standard deviation is {√(2/50)|the root of two over fifty}: {0.2|zero point two}.', code: 'he' },
        { id: 'names', say: 'The first is Xavier initialization, used with tanh. The second is {He|Kaiming He} initialization, used with ReLU.', code: ['xavier', 'he'] },
      ],
    },
    {
      id: 'try',
      title: 'Try one',
      codeTitle: 'check.py',
      code: `
        W = np.random.randn(20, 8) * np.sqrt(2 / 8)   #@p1
        # fan-in 8: std = sqrt(0.25) = 0.5            #@a1
      `,
      beats: [
        { id: 'p1', say: 'Try one: a ReLU layer with He initialization has a weight matrix of shape twenty by eight. What standard deviation should its weights have?', code: 'p1' },
        { id: 'a1', say: 'One column per input, so the fan-in is eight, not twenty. He\'s variance is two over eight, a quarter, and its square root is a half.', code: 'a1' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

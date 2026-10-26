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
      title: 'Spread adds up',
      codeTitle: 'spread.py',
      code: `
        a = np.random.choice([-2, 2])   # mean 0           #@spread
        # variance: mean of (a - 0)**2 = 4                  #@var
        # std = np.sqrt(4) = 2                              #@std
        b, c = np.random.choice([-1, 1], 2)  # var 1 each   #@pair
        # var of b + c: (4 + 0 + 0 + 4) / 4 = 2             #@adds
        # var of a * b: 4 * 1 = 4                           #@prod
        z = w @ x    # n terms, each of variance v          #@sum
        # Var(z) = n * v                                    #@sum
        # n = 100, std(w) = 1: std(z) = 10                  #@big
        np.tanh(10)  # 1.0: flat, slope near 0              #@flat
        # std(w) too small: shrinks every layer             #@small
      `,
      beats: [
        { id: 'spread', say: 'To answer that, first a way to measure spread. Take a value that is minus two or two, equally often. Its mean, the average, is zero.', code: 'spread' },
        { id: 'var', say: 'The variance is the average squared distance from the mean. Each value sits two away, and two squared is four, so the variance is four.', code: 'var' },
        { id: 'std', say: 'Its square root, {√4|the square root of four}, is two: the standard deviation, {std|S T D} for short. Square a {std|standard deviation} to get the variance back.', code: 'std' },
        { id: 'pair', say: 'Now add two independent values, each minus one or one, with variance one. Independent: one tells nothing about the other, so all four pairs are equally likely. Their sums are minus two, zero, zero and two.', code: 'pair' },
        { id: 'adds', say: 'Squared, those are four, zero, zero and four, which average to two: one plus one. When independent values add, their variances add.', code: 'adds' },
        { id: 'prod', say: 'Multiply instead: a weight of minus two or two, times an independent input of minus one or one. Every product is minus two or two: variance four, which is four times one. With mean zero, variances multiply.', code: 'prod' },
        { id: 'sum', say: 'A unit adds up n such terms, inputs times weights. If each has variance v, the sum z has variance n times v, written {Var(z) = n v|var of z equals n v}, Var for variance.', code: 'sum' },
        { id: 'big', say: 'Give a hundred inputs, and their weights, a variance of one. Each term has variance one times one, so the sum has variance a hundred, and a {std|standard deviation} of {√100|the square root of a hundred}: ten.', code: 'big' },
        { id: 'flat', say: 'Through a tanh, a value like ten sits far out on the flat end. The slope there is nearly zero, and so is the gradient.', code: 'flat' },
        { id: 'small', say: 'Too small is just as bad. Each layer shrinks the signal, and after a few layers almost nothing is left.', code: 'small' },
      ],
    },
    {
      id: 'scale',
      title: 'Scale by the fan-in',
      codeTitle: 'init.py',
      code: `
        W = np.random.randn(H, n)                   # H units, n inputs  #@fanin
        W = np.random.randn(H, n) / np.sqrt(n)      # Xavier, tanh       #@xavier
        W = np.random.randn(H, n) * np.sqrt(2 / n)  # He, ReLU           #@he
      `,
      beats: [
        { id: 'fanin', say: 'The fix scales the weights by the fan-in, n: the number of inputs each unit adds up. The weight matrix has a row per unit and a column per input, so n is its number of columns.', code: 'fanin' },
        { id: 'xavier', say: 'Give each weight a variance of one over n. Then the n terms add up to a variance of one. The standard deviation is {1/√n|one over root n}: for a hundred inputs, {0.1|zero point one}.', code: 'xavier' },
        { id: 'he', say: 'A ReLU zeroes about half of its inputs, which halves the variance. So for ReLU, double it: a variance of two over n. For fifty inputs, the standard deviation is {√(2/50)|the root of two over fifty}: {0.2|zero point two}.', code: 'he' },
        { id: 'names', say: 'The first is Xavier initialization, used with tanh. The second is {He|Kaiming He} initialization, used with ReLU.', code: ['xavier', 'he'] },
      ],
    },
    {
      id: 'try',
      title: 'Try it',
      codeTitle: 'check.py',
      code: `
        n, std_w = 400, 0.1                    #@p1
        var_term = std_w**2 * 1      # 0.01    #@a1
        var_z = n * var_term         # 4       #@b1
        std_z = np.sqrt(var_z)       # 2       #@b1
        W = np.random.randn(20, 8) * np.sqrt(2 / 8)   #@p2
        # fan-in 8: std = sqrt(0.25) = 0.5            #@a2
      `,
      beats: [
        { id: 'p1', say: 'Try one. A unit computes z, w dot x, over four hundred inputs, each of variance one. Each weight has a standard deviation of {0.1|zero point one}. What is the standard deviation of z?', code: 'p1' },
        { id: 'a1', say: 'Square the weight\'s {std|standard deviation} to get its variance: {0.01|zero point zero one}. Times the input\'s variance, one, each term has variance {0.01|zero point zero one}.', code: 'a1' },
        { id: 'b1', say: 'Four hundred terms add up to a variance of four. Its square root is the {std|standard deviation}: two.', code: 'b1' },
        { id: 'p2', say: 'Now a ReLU layer with He initialization has a weight matrix of shape twenty by eight. What standard deviation should its weights have?', code: 'p2' },
        { id: 'a2', say: 'One column per input, so the fan-in is eight, not twenty. He\'s variance is two over eight, a quarter, and its square root is a half.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

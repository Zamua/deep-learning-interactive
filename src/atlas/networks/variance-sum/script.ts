import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-variance-sum',
  title: 'Variance of a sum',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'spread',
      title: 'Measuring spread',
      codeTitle: 'spread.py',
      code: `
        a = np.random.choice([-2, 2])   # mean 0           #@spread
        # variance: mean of (a - 0)**2 = 4                  #@var
        # std = np.sqrt(4) = 2                              #@std
      `,
      beats: [
        { id: 'spread', say: 'How spread out is a random value? Take one that is minus two or two, equally often. Its mean, the average, is zero.', code: 'spread' },
        { id: 'var', say: 'The variance is the average squared distance from the mean. Each value sits two away, and two squared is four, so the variance is four.', code: 'var' },
        { id: 'std', say: 'Its square root, {√4|the square root of four}, is two: the standard deviation, {std|S T D} for short. Square a {std|standard deviation} to get the variance back.', code: 'std' },
      ],
    },
    {
      id: 'adds',
      title: 'Variances add',
      codeTitle: 'spread.py',
      code: `
        b, c = np.random.choice([-1, 1], 2)  # var 1 each   #@pair
        # var of b + c: (4 + 0 + 0 + 4) / 4 = 2             #@adds
        # var of a * b: 4 * 1 = 4                           #@prod
        z = w @ x    # n terms, each of variance v          #@sum
        # Var(z) = n * v                                    #@sum
        # n = 100, std(w) = 1: std(z) = 10                  #@big
        # n = 25: std(z) = 5,  n = 100: std(z) = 10         #@root
      `,
      beats: [
        { id: 'pair', say: 'Now add two independent values, each minus one or one, with variance one. Independent: one tells nothing about the other, so all four pairs are equally likely. Their sums are minus two, zero, zero and two.', code: 'pair' },
        { id: 'adds', say: 'Squared, those are four, zero, zero and four, which average to two: one plus one. When independent values add, their variances add.', code: 'adds' },
        { id: 'prod', say: 'Multiply instead: a weight of minus two or two, times an independent input of minus one or one. Every product is minus two or two: variance four, which is four times one. With mean zero, variances multiply.', code: 'prod' },
        { id: 'sum', say: 'A unit adds up n such terms, inputs times weights. If each has variance v, the sum z has variance n times v, written {Var(z) = n v|var of z equals n v}, Var for variance.', code: 'sum' },
        { id: 'big', say: 'Give a hundred inputs, and their weights, a variance of one. Each term has variance one times one, so the sum has variance a hundred, and a {std|standard deviation} of {√100|the square root of a hundred}: ten.', code: 'big' },
        { id: 'root', say: 'Four times as many terms make the variance four times as big, but the {std|standard deviation} only twice as big: twenty-five such terms give a {std|standard deviation} of five, and a hundred give ten.', code: 'root' },
      ],
    },
    {
      id: 'try',
      title: 'Try one',
      codeTitle: 'check.py',
      code: `
        n, std_w = 400, 0.1                    #@p1
        var_term = std_w**2 * 1      # 0.01    #@a1
        var_z = n * var_term         # 4       #@b1
        std_z = np.sqrt(var_z)       # 2       #@b1
      `,
      beats: [
        { id: 'p1', say: 'Try one. A unit computes z, w dot x, over four hundred inputs, each of variance one. Each weight has a standard deviation of {0.1|zero point one}. What is the standard deviation of z?', code: 'p1' },
        { id: 'a1', say: 'Square the weight\'s {std|standard deviation} to get its variance: {0.01|zero point zero one}. Times the input\'s variance, one, each term has variance {0.01|zero point zero one}.', code: 'a1' },
        { id: 'b1', say: 'Four hundred terms add up to a variance of four. Its square root is the {std|standard deviation}: two.', code: 'b1' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-variance-sum',
  title: 'Variance of a sum',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Pearson', year: 1894, title: 'Contributions to the mathematical theory of evolution', url: 'https://doi.org/10.1098/rsta.1894.0003', scene: 'spread' },
    { who: 'Fisher', year: 1918, title: 'The correlation between relatives on the supposition of Mendelian inheritance', url: 'https://doi.org/10.1017/S0080456800012163', scene: 'adds' },
  ],
  scenes: [
    {
      id: 'swing',
      title: 'How far does z swing?',
      codeTitle: 'unit.py',
      code: `
        z = w @ x   # n terms, added up  #@z
        # a term, w_i * x_i: -1 or 1     #@term
        # n = 1:   z is -1 or 1          #@one
        # n = 4:   z within 4 of 0       #@four
        # n = 100: often 10 or more out  #@many
        np.tanh(z)  # flat far from 0    #@flat
      `,
      beats: [
        { id: 'unit', say: 'A unit adds up its inputs, each times its weight, into one number, z. A new example brings new inputs, and a new z.', code: 'z' },
        { id: 'one', say: 'Say each term, an input times its weight, is minus one or one, at random. With one term, z is just that.', code: ['term', 'one'] },
        { id: 'four', say: 'Four such terms, and z can land as far as four out on either side, though most often near zero.', code: 'four' },
        { id: 'many', say: 'A hundred, and z swings far wider: it often lands ten or more from zero.', code: 'many' },
        { id: 'flat', say: 'That matters for the bend that comes next: far from zero the tanh is flat, so a z out there leaves the unit saturated.', code: 'flat' },
      ],
    },
    {
      id: 'spread',
      title: 'A number for the width',
      codeTitle: 'spread.py',
      code: `
        t = np.random.choice([-2, 2])  #@t
        mean = 0      # the center      #@mean
        # deviations: -2 and 2          #@dev
        var = (4 + 4) / 2   # 4         #@var
        std = np.sqrt(var)  # 2         #@std
      `,
      beats: [
        { id: 'mean', say: 'Take the simplest swing: minus two or two, equally often. Its mean, the average, is zero: the center of the swing.', code: ['t', 'mean'] },
        { id: 'dev', say: 'Each value lies two away from the mean, one on each side. That gap, the value minus the mean, is its deviation.', code: 'dev' },
        { id: 'var', say: 'Square each deviation, and average: four and four average to four. That average squared deviation is the variance.', code: 'var' },
        { id: 'std', say: '{√4|The square root of four} is two, back in the value\'s own units: the standard deviation, the size of a typical deviation.', code: 'std' },
        { id: 'name', say: 'Karl Pearson gave it that name in 1894. Code writes it {std|S T D}.', code: 'std' },
      ],
    },
    {
      id: 'adds',
      title: 'Variances add',
      codeTitle: 'adds.py',
      code: `
        t1 = np.random.choice([-1, 1])  #@pair
        t2 = np.random.choice([-1, 1])  #@pair
        # t1 + t2: -2, 0, 0 or 2        #@sums
        # var: (4 + 0 + 0 + 4) / 4 = 2  #@adds
        # std: √2 ≈ 1.41, not 1 + 1     #@std
        # w * x: -2 or 2, var 4 × 1     #@prod
      `,
      beats: [
        { id: 'pair', say: 'Now add two values, each minus one or one, so each has a variance of one.', code: 'pair' },
        { id: 'indep', say: 'Say they are independent: one tells you nothing about the other. So all four pairs are equally likely, and their sums are minus two, zero, zero and two.', code: 'sums' },
        { id: 'adds', say: 'The mean is still zero. Squared, the sums give four, zero, zero and four, which average to two: one plus one. The variances add.', code: 'adds' },
        { id: 'std', say: 'Standard deviations do not. Draw each as a square\'s side, with its variance as the area: the areas add to two, so the new side is {√2|the square root of two}, about {1.41|one point four one}.', code: 'std' },
        { id: 'fisher', say: 'That is why the square has a name of its own. In 1918, Ronald Fisher noted that independent causes add the squares of their standard deviations, and named that square the variance.', code: 'adds' },
        { id: 'prod', say: 'A unit\'s terms are products: say, a weight of minus two or two, times an independent input of minus one or one. Every product is minus two or two.', code: 'prod' },
        { id: 'mult', say: 'So the product\'s variance is four: the weight\'s four, times the input\'s one. With means of zero, variances multiply.', code: 'prod' },
      ],
    },
    {
      id: 'grow',
      title: 'A sum of n terms',
      codeTitle: 'sum.py',
      code: `
        z = w @ x   # n terms            #@n
        # each term: variance v          #@v
        # Var(z) = n * v                 #@var
        # n = 100, v = 1: Var(z) = 100   #@big
        # std of z: √100 = 10            #@ten
        # 4 × the terms: 2 × the std     #@root
        n, std_w = 400, 0.1              #@unit
        v = std_w**2 * 1     # 0.01      #@term
        var_z = n * v        # 4         #@sum
        np.sqrt(var_z)       # 2         #@sd
      `,
      beats: [
        { id: 'n', say: 'Back to the unit\'s sum. Call its number of terms n.', code: 'n' },
        { id: 'v', say: 'Make the terms independent, each with the same variance, v.', code: 'v' },
        { id: 'var', say: 'Then their variances add, n times over: the variance of z is n times v, written {Var(z) = n v|var of z equals n v}.', code: 'var' },
        { id: 'big', say: 'The opening\'s hundred terms are each minus one or one, so v is one, and z has a variance of a hundred.', code: 'big' },
        { id: 'ten', say: 'Its square root, ten, is the standard deviation: the wide swing we saw.', code: 'ten' },
        { id: 'root', say: 'Twenty-five terms give a standard deviation of five, and a hundred give ten. Four times the terms, twice the swing: it grows with the square root of n.', code: 'root' },
        { id: 'unit', say: 'Now four hundred inputs of variance one, and weights with a standard deviation of {0.1|zero point one}.', code: 'unit' },
        { id: 'term', say: 'Squared, that is the weight\'s variance: {0.01|zero point zero one}. Times the input\'s one, each term\'s v is also {0.01|zero point zero one}.', code: 'term' },
        { id: 'sum', say: 'Four hundred such terms add up to a variance of four.', code: 'sum' },
        { id: 'sd', say: 'And its square root, two, is the standard deviation of z.', code: 'sd' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

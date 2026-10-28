import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-weight-init',
  title: 'Weight initialization',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Rumelhart, Hinton & Williams', year: 1986, title: 'Learning internal representations by error propagation', url: 'https://www.cs.toronto.edu/~fritz/absps/pdp8.pdf', scene: 'start' },
    { who: 'LeCun, Bottou, Orr & Müller', year: 1998, title: 'Efficient BackProp', url: 'https://leon.bottou.org/papers/lecun-98x', scene: 'size' },
    { who: 'Glorot & Bengio', year: 2010, title: 'Understanding the difficulty of training deep feedforward neural networks', url: 'https://proceedings.mlr.press/v9/glorot10a.html', scene: 'fanin' },
    { who: 'He, Zhang, Ren & Sun', year: 2015, title: 'Delving deep into rectifiers: surpassing human-level performance on ImageNet classification', url: 'https://arxiv.org/abs/1502.01852', scene: 'relu' },
  ],
  scenes: [
    {
      id: 'start',
      title: 'Where to start',
      codeTitle: 'init.py',
      code: `
        W -= lr * dW   # each step        #@step
        x = np.array([2, 1])              #@x
        W = np.full((3, 2), 0.5)          #@equal
        z = W @ x   # [1.5, 1.5, 1.5]     #@same
        # same z: same dW, same step      #@grad
        W = 0.1 * np.random.randn(3, 2)   #@random
      `,
      beats: [
        { id: 'start', say: 'Training steps each weight against its gradient. But before the first step, every weight needs a value to start from.', code: 'step' },
        { id: 'equal', say: 'The simplest start gives every weight the same value: say, all of them a half.', code: ['x', 'equal'] },
        { id: 'same', say: 'Then every hidden unit adds up the same inputs with the same weights, and gets the same z: one and a half.', code: 'same' },
        { id: 'grad', say: 'Backprop hands each one the same gradient, so every step changes them alike: copies of one unit, forever.', code: 'grad' },
        { id: 'symmetry', say: 'In 1986, David Rumelhart, Geoffrey Hinton and Ronald Williams called this the problem of symmetry breaking: the units are symmetric, so swap any two and nothing changes.', code: 'grad' },
        { id: 'random', say: 'Their cure: small random weights, so every unit starts out different.', code: 'random' },
      ],
    },
    {
      id: 'size',
      title: 'How big?',
      codeTitle: 'size.py',
      code: `
        W = std * np.random.randn(H, n)   #@randn
        # n = 100, std = 1: std(z) = 10   #@big
        np.tanh(10)   # ≈ 1: flat         #@flat
        # std = 0.01: std(z) = 0.1        #@small
        # per layer: 1, 0.1, 0.01, 0.001  #@layers
      `,
      beats: [
        { id: 'randn', say: 'How big should they be? Code draws them with {randn|rand N}: numbers centered on zero, with a standard deviation of one. Times a scale, the scale becomes their standard deviation.', code: 'randn' },
        { id: 'big', say: 'Each unit adds up n terms, so z swings root n times as wide as a single term. A hundred inputs of variance one, at a scale of one, give z a standard deviation of ten.', code: 'big' },
        { id: 'flat', say: 'Through a tanh, most of that bell lands on the flat ends: the units are saturated, with slopes near zero, so almost no gradient gets back.', code: 'flat' },
        { id: 'small', say: 'So make the scale small: {0.01|zero point zero one}. Then z\'s standard deviation is ten times that: {0.1|zero point one}.', code: 'small' },
        { id: 'layers', say: 'Near zero, tanh barely bends, so it passes that on, and the next layer shrinks it by ten again: one, {0.1|zero point one}, {0.01|zero point zero one}, {0.001|zero point zero zero one}. The signal fades away.', code: 'layers' },
        { id: 'back', say: 'So does the gradient, multiplied by the same small weights on its way back.', code: 'layers' },
        { id: 'lecun', say: 'Yann LeCun and colleagues warned of both in 1998: too large saturates, too small leaves the gradients tiny. They aimed between, for a z with a standard deviation of about one.', code: ['big', 'small'] },
      ],
    },
    {
      id: 'fanin',
      title: 'Scale by the fan-in',
      codeTitle: 'fanin.py',
      code: `
        # aim: std(z) ≈ 1, every layer    #@goal
        # n: inputs per unit, the fan-in  #@fanin
        # W: H rows, n columns            #@cols
        # Var(z) = n * Var(w) = 1         #@rule
        W = np.random.randn(H, n)         #@std
        W /= np.sqrt(n)   # std 1/√n      #@std
        # Xavier: Var(w) = 1/n, for tanh  #@name
      `,
      beats: [
        { id: 'goal', say: 'A standard deviation of one keeps z on the bend of the tanh, off its flat ends.', code: 'goal' },
        { id: 'fanin', say: 'The scale that does it depends on n, the number of inputs a unit adds up. Drawn as lines, they fan in to the unit, so n is called its fan-in.', code: 'fanin' },
        { id: 'cols', say: 'In the weight matrix, each unit is a row and each input a column, so the fan-in is the number of columns.', code: 'cols' },
        { id: 'rule', say: 'With inputs of variance one, z\'s variance is n times the weights\' variance. For that to equal one, the weights\' variance must be one over n.', code: 'rule' },
        { id: 'std', say: 'So divide by root n: the standard deviation is one over root n. For a hundred inputs, one over ten: {0.1|zero point one}.', code: 'std' },
        { id: 'glorot', say: 'In 2010, Xavier Glorot and Yoshua Bengio studied why deep networks trained so poorly, and asked every layer to pass on the variance it receives: this same rule.', code: 'std' },
        { id: 'name', say: 'It carries his first name: Xavier initialization, the rule for tanh.', code: 'name' },
      ],
    },
    {
      id: 'relu',
      title: 'Double it for ReLU',
      codeTitle: 'relu.py',
      code: `
        h = np.maximum(0, z)   # ReLU     #@relu
        # about half the h's are 0        #@half
        # Var(w) = 2 / n: double it       #@double
        W = np.random.randn(H, n)         #@he
        W *= np.sqrt(2 / n)   # He        #@he
        # W: 20 rows, 8 columns: n = 8    #@shape
        np.sqrt(2 / 8)        # 0.5       #@ans
      `,
      beats: [
        { id: 'relu', say: 'A ReLU bends differently: it zeroes every negative z, and that is about half of them.', code: 'relu' },
        { id: 'half', say: 'Those zeros add nothing to the next layer\'s sum, so with one over n, its variance comes out halved, layer after layer.', code: 'half' },
        { id: 'double', say: 'So double the weights\' variance: two over n.', code: 'double' },
        { id: 'he', say: 'Kaiming He and colleagues at Microsoft Research worked this out in 2015: a thirty-layer ReLU network that stalled under Xavier\'s rule trained under theirs. It is called {He|Kaiming He} initialization.', code: 'he' },
        { id: 'shape', say: 'Try one: a ReLU layer, {He|Kaiming He} initialization, with a weight matrix of twenty rows and eight columns. Its fan-in is the columns: eight, not twenty.', code: 'shape' },
        { id: 'ans', say: 'Two over eight is a quarter, and its square root, a half, is the standard deviation.', code: 'ans' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

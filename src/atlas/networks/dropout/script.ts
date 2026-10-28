import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-dropout',
  title: 'Dropout',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Hinton, Srivastava, Krizhevsky, Sutskever & Salakhutdinov', year: 2012, title: 'Improving neural networks by preventing co-adaptation of feature detectors', url: 'https://arxiv.org/abs/1207.0580', scene: 'lean' },
    { who: 'Srivastava, Hinton, Krizhevsky, Sutskever & Salakhutdinov', year: 2014, title: 'Dropout: A Simple Way to Prevent Neural Networks from Overfitting', url: 'https://jmlr.org/papers/v15/srivastava14a.html', scene: 'mask' },
  ],
  scenes: [
    {
      id: 'lean',
      title: 'Units that lean on each other',
      codeTitle: 'dropout.py',
      code: `
        w = w - eta * g      # one step    #@train
        # test time: weights fixed         #@test
        # few examples: right on those     #@gap
        # units tuned to work together     #@lean
        keep = np.random.rand(4) < 0.5     #@drop
        h = h * keep    # some units off   #@drop
      `,
      beats: [
        { id: 'train', say: 'A network learns its weights in training: gradient steps, one after another, each nudging the weights so its scores come out better on a set of examples.', code: 'train' },
        { id: 'test', say: 'Test time comes after. The weights are fixed, and the network meets inputs it has never seen.', code: 'test' },
        { id: 'gap', say: 'Trained on too few examples, a big network can get those almost all right, and still do worse on new ones.', code: 'gap' },
        { id: 'lean', say: 'In 2012, Geoffrey Hinton and colleagues traced this to units tuned to work together on the training examples: each one useful only alongside a few particular others.', code: 'lean' },
        { id: 'drop', say: 'Their fix: on every training example, switch off each hidden unit at random, half of them on average. Then no unit can count on another being there, so each must be useful on its own.', code: 'drop' },
        { id: 'name', say: 'Units drop out of the network for one example, a different random set each time: hence the name, dropout.', code: 'drop' },
      ],
    },
    {
      id: 'mask',
      title: 'A random mask',
      codeTitle: 'dropout.py',
      code: `
        h = np.array([2, 1, 3, 2])          #@h
        p_keep = 0.5     # keep probability #@p
        m = np.random.rand(4) < p_keep      #@mask
        # m = [1, 0, 1, 0]: keeps 0 and 2   #@mask
        out = h * m      # [2, 0, 3, 0]     #@zero
        # kept on average: 4 * 0.5 = 2      #@kept
      `,
      beats: [
        { id: 'h', say: 'In numbers: a hidden layer\'s output, h, with four units: two, one, three and two.', code: 'h' },
        { id: 'p', say: 'A 2014 paper by Nitish Srivastava and the same group made that share a setting, p: the probability that a unit is kept.', code: 'p' },
        { id: 'prob', say: 'A probability is the share of tries in which something happens. With p a half, each unit is kept half the time, like a coin toss.', code: 'p' },
        { id: 'mask', say: 'Each step tosses one coin per unit, giving a mask, m: a one keeps the unit, and a zero drops it. This one keeps units zero and two.', code: 'mask' },
        { id: 'zeroed', say: 'Multiply h by m, entry by entry: two, zero, three, zero.', code: 'zero' },
        { id: 'kept', say: 'On average, a fraction p of the units stay: four times a half, two. Each step draws a new mask, so which units stay keeps changing.', code: 'kept' },
      ],
    },
    {
      id: 'scale',
      title: 'Make up the difference',
      codeTitle: 'dropout.py',
      code: `
        # unit 0, on average: 0.5 * 2 = 1   #@shrink
        out = h           # test: all kept  #@test
        out = p_keep * h  # plain, at test  #@plain
        out = h * m / p_keep   # inverted   #@invert
        # = [4, 0, 6, 0]                    #@scaled
        # on average: 0.5 * 4 = 2, so h     #@avg
        out = h      # inverted, at test    #@free
      `,
      beats: [
        { id: 'shrink', say: 'Dropping lowers each unit\'s average. Unit zero gives two when kept and zero when dropped, so on average, a half times two: one. That is p times h, less than its full two.', code: 'shrink' },
        { id: 'test', say: 'At test time nothing is dropped, so the next layer would suddenly see bigger numbers than it ever saw in training.', code: 'test' },
        { id: 'plain', say: 'The 2012 paper fixed this at test time: keep every unit, and halve its outgoing weights, which halves what it passes on. In general, multiply by p, to match the training average.', code: 'plain' },
        { id: 'invert', say: 'A variant called inverted dropout turns this around, moving the scaling into training. Each kept unit is divided by p, which is multiplying by one over p: with p a half, it doubles.', code: 'invert' },
        { id: 'scaled', say: 'So two, zero, three, zero become four, zero, six, zero.', code: 'scaled' },
        { id: 'avg', say: 'Now unit zero gives four half the time, and zero otherwise: on average, two, its full value. In general, p times h over p is h itself.', code: 'avg' },
        { id: 'free', say: 'So at test time there is nothing to fix: keep every unit, scale nothing, and h passes straight through.', code: 'free' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-sgd-linear',
  title: 'SGD step',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'loop',
      title: 'One step, four moves',
      codeTitle: 'sgd.py',
      code: `
        s = W @ x + b           # [1.0, 1.85]   #@s
        p = softmax(s)          # [0.3, 0.7]    #@p
        ds = p - np.eye(2)[y]   # [-0.7, 0.7]   #@ds
        dW = np.outer(ds, x)                    #@dW
        db = ds                                 #@dW
        W -= lr * dW                            #@step
        b -= lr * db                            #@step
      `,
      beats: [
        { id: 'x', say: 'Here is one full training step for a tiny linear classifier, with two features and two classes. The input x is two, one, and the correct class is class zero.' },
        { id: 'scores', say: 'Forward: the scores are W x plus b, one per class: one, and {1.85|one point eight five}.', code: 's' },
        { id: 'probs', say: 'Softmax turns them into probabilities, {0.3|zero point three} and {0.7|zero point seven}. The model leans the wrong way.', code: 'p' },
        { id: 'grad', say: 'Backward: the gradient on the scores is p minus the one-hot label, minus {0.7|zero point seven} and plus {0.7|zero point seven}.', code: 'ds' },
        { id: 'update', say: 'Then every weight and bias steps against its own gradient. What is left is to find those gradients.', code: ['dW', 'step'] },
      ],
    },
    {
      id: 'outer',
      title: 'The gradient on W',
      codeTitle: 'sgd.py',
      code: `
        ds = p - np.eye(2)[y]   # [-0.7, 0.7]   #@ds
        dW = np.outer(ds, x)    # ds[i] * x[j]  #@outer
        # [[-1.4, -0.7],                        #@outer
        #  [ 1.4,  0.7]]                        #@outer
        db = ds                 # [-0.7, 0.7]   #@db
      `,
      beats: [
        { id: 'chain', say: 'Score i is row i of W dotted with x, plus b i. So nudging the weight W i j moves score i by x j times as much.', code: 'ds' },
        { id: 'outer', say: 'By the chain rule, the gradient on W i j is ds i times x j. Every entry of ds times every entry of x: an outer product.', code: 'outer' },
        { id: 'db', say: 'Each bias adds straight into its own score, so its gradient is just ds.', code: 'db' },
      ],
    },
    {
      id: 'toward',
      title: 'The right row moves toward x',
      codeTitle: 'sgd.py',
      code: `
        lr = 0.5
        W[0] -= lr * ds[0] * x   # ds[0] = -0.7: +0.35 x   #@toward
        W[1] -= lr * ds[1] * x   # ds[1] = +0.7: -0.35 x   #@away
        W @ x   # [2.75, 0.1], was [1.0, 1.85]            #@scores
      `,
      beats: [
        { id: 'step', say: 'Now step, here with {η|eta} one half. Row zero belongs to the correct class, and its ds is minus {0.7|zero point seven}, so it gains {0.35|zero point three five} times x: it moves toward x.', code: 'toward' },
        { id: 'away', say: 'Row one, the wrong class, has ds plus {0.7|zero point seven}. It loses {0.35|zero point three five} times x, and moves away.', code: 'away' },
        { id: 'scores', say: 'Measured along x, the correct row climbs from one to {2.75|two point seven five}, and the wrong one falls from {1.85|one point eight five} to {0.1|zero point one}.', code: 'scores' },
      ],
    },
    {
      id: 'example',
      title: 'Worked example',
      codeTitle: 'example.py',
      code: `
        x, y, lr = np.array([3, -1]), 1, 0.1      #@given
        p = np.array([0.4, 0.6])                  #@given
        ds = p - np.eye(2)[y]     # [0.4, -0.4]   #@ds
        dW10 = ds[1] * x[0]       # -1.2          #@dW
        W[1, 0] -= lr * dW10      # 1 -> 1.12     #@step
      `,
      beats: [
        { id: 'ask', say: 'Your turn to follow along. The weight in row one, column zero is one. The input is three, minus one; the correct class is class one; softmax gives {0.4|zero point four} and {0.6|zero point six}; and {η|eta} is {0.1|zero point one}. What is that weight after one step?', code: 'given' },
        { id: 'ds', say: 'The score gradient, p minus one-hot, is {0.4|zero point four}, and {0.6|zero point six} minus one: minus {0.4|zero point four}.', code: 'ds' },
        { id: 'dW', say: 'The weight\'s gradient is ds one times x zero: minus {0.4|zero point four} times three, minus {1.2|one point two}.', code: 'dW' },
        { id: 'step', say: 'Step against it: one, minus {0.1|zero point one} times minus {1.2|one point two}, is {1.12|one point one two}. The correct class\'s weight grew.', code: 'step' },
      ],
    },
  ],
};

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
        { id: 'x', say: 'Here is one full step of stochastic gradient descent, or SGD, for a tiny linear classifier, with two features and two classes. The input x is two, one, and the correct class is class zero.' },
        { id: 'scores', say: 'Forward: the scores are W x plus b, one per class: one, and {1.85|one point eight five}.', code: 's' },
        { id: 'probs', say: 'Softmax turns them into probabilities, {0.3|zero point three} and {0.7|zero point seven}. The model leans the wrong way.', code: 'p' },
        { id: 'grad', say: 'Backward: the gradient on the scores, ds for short, is p minus the one-hot label: minus {0.7|zero point seven} and plus {0.7|zero point seven}.', code: 'ds' },
        { id: 'update', say: 'Then every weight and bias steps against its own gradient. What is left is to find those gradients.', code: ['dW', 'step'] },
      ],
    },
    {
      id: 'outer',
      title: 'The gradient on W, one weight at a time',
      codeTitle: 'sgd.py',
      code: `
        ds = p - np.eye(2)[y]   # [-0.7, 0.7]   #@ds
        # s[0] = W[0,0]*x[0] + W[0,1]*x[1] + b[0] #@one
        # W[0,0] up by h: s[0] up by x[0]*h = 2h #@slope
        dW[0,0] = ds[0] * x[0]  # -0.7*2 = -1.4 #@entry
        dW[0,1] = ds[0] * x[1]  # -0.7*1 = -0.7 #@row0
        dW[1] = ds[1] * x       # [1.4, 0.7]    #@row1
        dW = np.outer(ds, x)    # ds[i] * x[j]  #@rule
        db = ds                 # [-0.7, 0.7]   #@db
      `,
      beats: [
        { id: 'one', say: 'Take one weight, {W₀₀|W zero zero}: the one in row zero, column zero. Row zero belongs to class zero, so this weight feeds only score zero: {s₀|s zero} is {W₀₀|W zero zero} times {x₀|x zero}, plus {W₀₁|W zero one} times {x₁|x one}, plus {b₀|b zero}.', code: 'one' },
        { id: 'slope', say: 'So nudging {W₀₀|W zero zero} moves {s₀|s zero} by {x₀|x zero} times as much: twice as much, since {x₀|x zero} is two.', code: 'slope' },
        { id: 'entry', say: 'And the loss moves {ds₀|d s zero} times as much as {s₀|s zero}: minus {0.7|zero point seven} times. The chain rule multiplies the two: the gradient on {W₀₀|W zero zero}, {∂L/∂W₀₀|partial L, partial W zero zero}, is minus {0.7|zero point seven} times two, minus {1.4|one point four}.', code: 'entry' },
        { id: 'row0', say: '{W₀₁|W zero one} is in the same row, so it also gets {ds₀|d s zero}, times its own input, {x₁|x one}, which is one: minus {0.7|zero point seven}.', code: 'row0' },
        { id: 'row1', say: 'Row one feeds score one, whose ds is plus {0.7|zero point seven}. Times two is {1.4|one point four}, and times one is {0.7|zero point seven}.', code: 'row1' },
        { id: 'rule', say: 'So the weight in row i, column j, {Wᵢⱼ|W i j}, gets {dsᵢ|d s i} times {xⱼ|x j}: its row\'s score gradient, times its column\'s input. A grid of every entry of ds times every entry of x is called an outer product.', code: 'rule' },
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
      id: 'try',
      title: 'Try one',
      codeTitle: 'try.py',
      code: `
        W = np.array([[1, 2], [2, -1]])   #@p1
        x, y = np.array([3, 1]), 1        #@p1
        p = np.array([0.4, 0.6])          #@p1
        ds = p - np.eye(2)[y]  # [0.4, -0.4]  #@ds
        dW10 = ds[1] * x[0]    # -1.2     #@dw
        W[1,0] - 0.5 * dW10    # 2.6      #@step
        b = np.array([-0.2, 0.2])         #@p2
        b - 0.5 * ds    # [-0.4, 0.4]     #@a2
      `,
      beats: [
        { id: 'p1', say: 'Try one. W has rows one, two, and two, minus one. The input x is three, one, its label is class one, and softmax gives {0.4|zero point four} and {0.6|zero point six}. After one step with {η|eta} one half, what is {W₁₀|W one zero}?', code: 'p1' },
        { id: 'ds', say: 'First the score gradient: take one away at the label, class one. {0.4|zero point four}, and {0.6|zero point six} minus one, which is minus {0.4|zero point four}.', code: 'ds' },
        { id: 'dw', say: '{W₁₀|W one zero} sits in row one, so it takes {ds₁|d s one}, minus {0.4|zero point four}. Column zero takes {x₀|x zero}, three. Its gradient is minus {0.4|zero point four} times three: minus {1.2|one point two}.', code: 'dw' },
        { id: 'step', say: 'Step against it: two, minus one half times minus {1.2|one point two}. Subtracting a negative adds, so two plus {0.6|zero point six}: {2.6|two point six}.', code: 'step' },
        { id: 'p2', say: 'Now the biases, minus {0.2|zero point two} and {0.2|zero point two}. After the same step, what is b?', code: 'p2' },
        { id: 'a2', say: 'A bias\'s gradient is just ds, {0.4|zero point four} and minus {0.4|zero point four}. Half of each comes off: minus {0.2|zero point two} minus {0.2|zero point two} is minus {0.4|zero point four}, and {0.2|zero point two} plus {0.2|zero point two} is {0.4|zero point four}.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

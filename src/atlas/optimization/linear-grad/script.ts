import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-linear-grad',
  title: 'Linear classifier gradient',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'loop',
      title: 'From the scores back to W',
      codeTitle: 'grad.py',
      code: `
        s = W @ x + b           # [1.0, 1.85]   #@s
        p = softmax(s)          # [0.3, 0.7]    #@p
        ds = p - np.eye(2)[y]   # [-0.7, 0.7]   #@ds
        dW, db = ?, ?                           #@dW
      `,
      beats: [
        { id: 'x', say: 'A tiny linear classifier has two features and two classes. The input x is two, one, and the correct class is class zero.' },
        { id: 'scores', say: 'The scores are W x plus b, one per class: one, and {1.85|one point eight five}.', code: 's' },
        { id: 'probs', say: 'Softmax turns them into probabilities, {0.3|zero point three} and {0.7|zero point seven}.', code: 'p' },
        { id: 'grad', say: 'The gradient on the scores, ds for short, is p minus the one-hot label: minus {0.7|zero point seven} and plus {0.7|zero point seven}.', code: ['ds', 'dW'] },
      ],
    },
    {
      id: 'outer',
      title: 'The gradient on W, one weight at a time',
      codeTitle: 'grad.py',
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
        { id: 'one', say: 'Now the weights. Take one, {W₀₀|W zero zero}: the one in row zero, column zero. Row zero belongs to class zero, so this weight feeds only score zero: {s₀|s zero} is {W₀₀|W zero zero} times {x₀|x zero}, plus {W₀₁|W zero one} times {x₁|x one}, plus {b₀|b zero}.', code: 'one' },
        { id: 'slope', say: 'So nudging {W₀₀|W zero zero} moves {s₀|s zero} by {x₀|x zero} times as much: twice as much, since {x₀|x zero} is two.', code: 'slope' },
        { id: 'entry', say: 'And the loss moves {ds₀|d s zero} times as much as {s₀|s zero}: minus {0.7|zero point seven} times. The chain rule multiplies the two: the gradient on {W₀₀|W zero zero}, {∂L/∂W₀₀|partial L, partial W zero zero}, is minus {0.7|zero point seven} times two, minus {1.4|one point four}.', code: 'entry' },
        { id: 'row0', say: '{W₀₁|W zero one} is in the same row, so it also gets {ds₀|d s zero}, times its own input, {x₁|x one}, which is one: minus {0.7|zero point seven}.', code: 'row0' },
        { id: 'row1', say: 'Row one feeds score one, whose ds is plus {0.7|zero point seven}. Times two is {1.4|one point four}, and times one is {0.7|zero point seven}.', code: 'row1' },
        { id: 'rule', say: 'The weight in row i, column j, {Wᵢⱼ|W i j}, gets {dsᵢ|d s i} times {xⱼ|x j}: its row\'s score gradient, times its column\'s input. A grid of every entry of ds times every entry of x is called an outer product.', code: 'rule' },
        { id: 'db', say: 'Each bias adds straight into its own score, so its gradient is just ds.', code: 'db' },
      ],
    },
    {
      id: 'try',
      title: 'Try one',
      codeTitle: 'try.py',
      code: `
        W = np.array([[2, 0], [-1, 1]])   #@p1
        x, y = np.array([1, 3]), 0        #@p1
        p = np.array([0.2, 0.8])          #@p1
        ds = p - np.eye(2)[y]  # [-0.8, 0.8]  #@ds
        dW01 = ds[0] * x[1]    # -2.4     #@dw
      `,
      beats: [
        { id: 'p1', say: 'Try one. W has rows two, zero, and minus one, one. x is one, three, with label class zero, and softmax gives {0.2|zero point two} and {0.8|zero point eight}. What is the gradient on {W₀₁|W zero one}?', code: 'p1' },
        { id: 'ds', say: 'First the score gradient: take one away at class zero, the label. {0.2|zero point two} minus one is minus {0.8|zero point eight}; {0.8|zero point eight} stays.', code: 'ds' },
        { id: 'dw', say: '{W₀₁|W zero one} sits in row zero, so it takes {ds₀|d s zero}, minus {0.8|zero point eight}. Column one takes {x₁|x one}, three. Its gradient is minus {0.8|zero point eight} times three: minus {2.4|two point four}.', code: 'dw' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

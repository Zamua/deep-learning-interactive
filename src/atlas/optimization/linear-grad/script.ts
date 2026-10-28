import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-linear-grad',
  title: 'Linear classifier gradient',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Widrow & Hoff', year: 1960, title: 'Adaptive switching circuits', url: 'https://isl.stanford.edu/~widrow/papers/c1960adaptiveswitching.pdf', scene: 'grid' },
  ],
  scenes: [
    {
      id: 'ask',
      title: 'Which way should each weight move?',
      codeTitle: 'grad.py',
      code: `
        x = np.array([2, 1])   # a cat       #@x
        s = W @ x + b          # [1.0, 1.85] #@s
        p = softmax(s)         # [0.3, 0.7]  #@p
        y = 0                  # cat         #@y
        ds = p - np.eye(2)[y]  # [-0.7, 0.7] #@ds
        dW, db = ?, ?                        #@dW
      `,
      beats: [
        { id: 'plane', say: 'Back on the graph of two features, blue and edges: cats sit low, and ships sit high. Here is one cat, x, at two, one.', code: 'x' },
        { id: 'border', say: 'Cat and ship each get their own row of weights and their own bias, so their own score. The border between their regions is where the scores tie.', code: 's' },
        { id: 'wrong', say: 'This border is in the wrong place: the cat lands on the ship side, and softmax gives cat only {0.3|zero point three}, and ship {0.7|zero point seven}.', code: 'p' },
        { id: 'label', say: 'The correct class is called the label: here, cat, so y is zero.', code: 'y' },
        { id: 'ds', say: 'The gradient of the loss on the scores, {ds|d s}, is p minus the one-hot label: minus {0.7|zero point seven} for cat, plus {0.7|zero point seven} for ship.', code: 'ds' },
        { id: 'error', say: 'Read it as the error: what the classifier said, minus what it should have said. Cat\'s score should rise, and ship\'s should fall.', code: 'ds' },
        { id: 'ask', say: 'But scores are not knobs: only the weights and biases can change. How should each weight move?', code: 'dW' },
      ],
    },
    {
      id: 'nudge',
      title: 'Nudge one weight',
      codeTitle: 'nudge.py',
      code: `
        s[0] = W[0] @ x + b[0]   # cat     #@row
        W[0,0] += 0.5   # s[0] += 1.0      #@w00
        dW[0,0] = ds[0] * x[0]   # -1.4    #@g00
        W[0,1] += 0.5   # s[0] += 0.5      #@w01
        dW[0,1] = ds[0] * x[1]   # -0.7    #@g01
        db[0] = ds[0]            # -0.7    #@b0
      `,
      beats: [
        { id: 'row', say: 'Cat\'s score, {s₀|s zero}, comes from cat\'s row alone: its weight on blue times blue, plus its weight on edges times edges, plus cat\'s bias.', code: 'row' },
        { id: 'w00', say: 'Take cat\'s weight on blue, {W₀₀|W zero zero}: row zero for cat, column zero for blue. Nudge it up by a half, and the border turns.', code: 'w00' },
        { id: 'twice', say: '{s₀|s zero} rises by one, twice the nudge, since this cat has two on blue, and the border sweeps past it.', code: 'w00' },
        { id: 'g00', say: 'The loss moves {ds₀|d s zero} times as far as {s₀|s zero}, so chain the two: the gradient on {W₀₀|W zero zero} is minus {0.7|zero point seven} times two, minus {1.4|one point four}.', code: 'g00' },
        { id: 'w01', say: 'Cat\'s weight on edges, {W₀₁|W zero one}, turns the border another way. This cat has just one on edges, so the same nudge moves {s₀|s zero} by only a half.', code: 'w01' },
        { id: 'g01', say: 'Its gradient is minus {0.7|zero point seven} times one: minus {0.7|zero point seven}. The bigger the input, the more its weight matters.', code: 'g01' },
        { id: 'b0', say: 'Cat\'s bias is like a weight whose input is always one: nudging it slides the border, and moves {s₀|s zero} just as far. Its gradient is {ds₀|d s zero}: minus {0.7|zero point seven}.', code: 'b0' },
      ],
    },
    {
      id: 'grid',
      title: 'Every weight at once',
      codeTitle: 'grad.py',
      code: `
        ds = p - np.eye(2)[y]  # [-0.7, 0.7] #@ds
        dW[0] = ds[0] * x  # [-1.4, -0.7]    #@row0
        dW[1] = ds[1] * x  # [1.4, 0.7]      #@row1
        dW = np.outer(ds, x)  # ds[i]*x[j]   #@rule
        db = ds                # [-0.7, 0.7] #@db
      `,
      beats: [
        { id: 'row0', say: 'Lay the gradients out like W: x across the top, {ds|d s} down the side. Cat\'s row is cat\'s error times each input.', code: ['ds', 'row0'] },
        { id: 'row1', say: 'Ship\'s row is ship\'s error, plus {0.7|zero point seven}, times each input: positive, so raising ship\'s weights would raise the loss.', code: 'row1' },
        { id: 'rule', say: 'So the weight in row i, column j, {Wᵢⱼ|W i j}, gets {dsᵢ|d s i} times {xⱼ|x j}: its class\'s error, times its feature\'s input.', code: 'rule' },
        { id: 'outer', say: 'A dot product, also called an inner product, multiplies matched pairs into one number. This grid keeps every pairing apart: the outer product.', code: 'rule' },
        { id: 'db', say: 'And a bias\'s input is always one, so the biases\' gradient is {ds|d s} itself.', code: 'db' },
        { id: 'widrow', say: 'This shape is old. In 1960, Bernard Widrow and Marcian Hoff built Adaline, short for adaptive linear, a machine that sorted patterns with a weighted sum.', code: 'rule' },
        { id: 'measure', say: 'Each weight\'s gradient came down to the error times its input, so it could be measured without calculus.', code: 'rule' },
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
        { id: 'own', say: 'The weight itself, zero, never comes into it: a weight\'s gradient is its error times its input, whatever the weight is.', code: 'dw' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

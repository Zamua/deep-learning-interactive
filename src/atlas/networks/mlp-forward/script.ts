import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-mlp-forward',
  title: 'Two-layer forward pass',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'hidden',
      title: 'Layer one: a row of neurons',
      codeTitle: 'forward.py',
      code: `
        x = np.array([1, 2])                 #@x
        W1 = np.array([[2, -1], [1, -2]])    #@W1
        b1 = np.array([1, 0])                #@b1
        z = W1 @ x + b1       # [1, -3]      #@z
        h = np.maximum(0, z)  # [1, 0]       #@h
      `,
      beats: [
        { id: 'x', say: 'A two-layer network starts like a linear classifier. Here the input, x, has two entries: one and two.', code: 'x' },
        { id: 'W1', say: 'The first layer\'s weights, {W₁|W one}, have one row per hidden unit. Each row is one neuron\'s weights, so this layer is two neurons side by side.', code: 'W1' },
        { id: 'z', say: 'Dot each row with x, and add the biases, {b₁|b one}. Unit zero: two, minus two, plus one, is one. Unit one: one, minus four, plus zero, is minus three.', code: ['b1', 'z'] },
        { id: 'h', say: 'Then the ReLU, entry by entry: one stays one, and minus three becomes zero. That is h, the hidden layer: h is the ReLU of {W₁ x plus b₁|W one x, plus b one}.', code: 'h' },
      ],
    },
    {
      id: 'scores',
      title: 'Layer two: a classifier on h',
      codeTitle: 'forward.py',
      code: `
        W2 = np.array([[3, 1], [-1, 2]])     #@W2
        b2 = np.array([0, 1])                #@W2
        s = W2 @ h + b2       # [3, 0]       #@s
        W2 @ z + b2           # [0, -6]      #@noRelu
        # W1: (H, D)    W2: (C, H)           #@shapes
      `,
      beats: [
        { id: 'W2', say: 'The second layer scores h exactly as a linear classifier scores an input, with its own weights, {W₂|W two}, and biases, {b₂|b two}: {s = W₂h + b₂|s is W two h, plus b two}.', code: 'W2' },
        { id: 's', say: 'Class zero: three times one, plus one times zero, plus zero: three. Class one: minus one, plus zero, plus one: zero.', code: 's' },
        { id: 'forget', say: 'Skip the ReLU, and h would be one and minus three. Class zero would score zero, not three. The bend changes the answer.', code: 'noRelu' },
        { id: 'shapes', say: 'The shapes chain together. Write D for the number of inputs, H for the number of hidden units, and C for the number of classes. {W₁|W one} is H by D: it turns D inputs into H hidden units. {W₂|W two} is C by H: it turns those into C scores.', code: 'shapes' },
      ],
    },
    {
      id: 'collapse',
      title: 'Why the bend matters',
      codeTitle: 'collapse.py',
      code: `
        s = W2 @ (W1 @ x + b1) + b2           #@sub
        s = (W2 @ W1) @ x + (W2 @ b1 + b2)    #@sub
        W = W2 @ W1    # shape (C, D)         #@one
      `,
      beats: [
        { id: 'sub', say: 'Take the ReLU out and substitute. The scores are {W₂|W two} times {W₁ x plus b₁|W one x, plus b one}, plus {b₂|b two}. Multiply it out, and that is {W₂ W₁|W two W one}, the product of the two matrices, times x, plus a constant.', code: 'sub' },
        { id: 'one', say: '{W₂ W₁|W two W one} is a single C by D matrix. The two layers collapse into one linear classifier, however wide the middle is.', code: 'one' },
        { id: 'bend', say: 'The ReLU between them is what stops the collapse, and what lets the network bend its decision boundaries.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

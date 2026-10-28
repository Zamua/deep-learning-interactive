import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-mlp-backprop',
  title: 'Two-layer backward pass',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Rumelhart, Hinton & Williams', year: 1986, title: 'Learning representations by back-propagating errors', url: 'https://doi.org/10.1038/323533a0', scene: 'why' },
  ],
  scenes: [
    {
      id: 'why',
      title: 'No one says what h should be',
      codeTitle: 'forward.py',
      code: `
        z = W1 @ x + b1       # [2, -1]  #@z
        h = np.maximum(0, z)  # [2, 0]   #@h
        s = W2 @ h + b2       # [3, 3]   #@s
        # L: the loss on s, with y = 0   #@s
        # dW2, db2: from ds              #@top
        # dW1, db1: only through h       #@deep
      `,
      beats: [
        { id: 'net', say: 'Here is a two-layer network, already run forward: the input, x, on the left, the hidden layer, h, in the middle, and the scores on the right, where the loss measures them.', code: ['z', 'h', 's'] },
        { id: 'off', say: 'Hidden unit one had a pre-activation of minus one, so the ReLU turned it off: h is two and zero. The two scores tied, at three each.', code: ['z', 'h'] },
        { id: 'need', say: 'To learn, every weight in both layers needs its gradient: which way to nudge it, to bring the loss down.', code: ['top', 'deep'] },
        { id: 'top', say: 'The second layer is the easy one: the loss says straight away how each score should move.', code: 'top' },
        { id: 'hidden', say: 'But nothing says what the hidden units should have been. The data shows x and the right answer, never h.', code: 'deep' },
        { id: 'walk', say: 'So the first layer\'s weights can only be reached by walking back from the loss: through {W₂|W two}, then through the ReLU.', code: 'deep' },
        { id: 'paper', say: 'In 1986, David Rumelhart, Geoffrey Hinton and Ronald Williams trained hidden units this way, and found they learn useful features of their own. That, they wrote, set backprop apart from simpler methods, like the perceptron\'s.', code: 'deep' },
      ],
    },
    {
      id: 'top',
      title: 'At the top: W₂ and b₂',
      codeTitle: 'backward.py',
      code: `
        ds = p.copy()    # p: [0.5, 0.5]  #@ds
        ds[y] -= 1       # [-0.5, 0.5]    #@ds
        dW2 = np.outer(ds, h)             #@dW2
        # [[-1, 0],                       #@dW2
        #  [ 1, 0]]                       #@dW2
        db2 = ds.copy()  # [-0.5, 0.5]    #@db2
      `,
      beats: [
        { id: 'ds', say: 'With the scores tied, softmax gives each class a half. Class zero is right, so the gradient on the scores, {ds|d s}, is p minus one at class zero: minus a half, and a half.', code: 'ds' },
        { id: 'w00', say: 'Now one weight of {W₂|W two}: the one carrying h zero into score zero. As for any weight, its gradient is its output\'s gradient, times its input: minus a half, times two. Minus one.', code: 'dW2' },
        { id: 'w10', say: 'The weight from h zero into score one gets a half, times two: one.', code: 'dW2' },
        { id: 'silent', say: 'And both weights reading h one get zero. They multiplied a zero, so nudging them changes nothing at all.', code: 'dW2' },
        { id: 'table', say: 'As a grid, {dW₂|d W two} is the outer product of {ds|d s} and h: {ds|d s} down the side, h across the top, and each cell, its row\'s number times its column\'s.', code: 'dW2' },
        { id: 'db2', say: 'Each bias adds straight onto its own score, so its gradient is that score\'s gradient: {db₂|d b two} is {ds|d s} itself.', code: 'db2' },
      ],
    },
    {
      id: 'down',
      title: 'Back through W₂',
      codeTitle: 'backward.py',
      code: `
        W2 = np.array([[1, -1],        #@W2
                       [2,  1]])       #@W2
        dh = W2.T @ ds  # [0.5, 1.0]   #@dh
        # h0: 1*(-0.5) + 2*0.5 = 0.5   #@u0
        # h1: -1*(-0.5) + 1*0.5 = 1.0  #@u1
      `,
      beats: [
        { id: 'fork', say: 'To keep walking, h needs its gradient, {dh|d h}. Each hidden unit fed both scores, so it collects from each, the score\'s gradient times the weight between them, and adds them up.', code: ['W2', 'dh'] },
        { id: 'u0', say: 'h zero went out through a weight of one into score zero, and a weight of two into score one. One times minus a half, plus two times a half, is a half.', code: 'u0' },
        { id: 'u1', say: 'h one went out through weights of minus one and one: a half, plus a half, is one.', code: 'u1' },
        { id: 'T', say: 'Each unit reads down its own column of {W₂|W two}, so all of {dh|d h} is {W₂ᵀ|W two transpose}, times {ds|d s}.', code: 'dh' },
      ],
    },
    {
      id: 'mask',
      title: 'Through the ReLU, to W₁',
      codeTitle: 'backward.py',
      code: `
        z = np.array([2, -1])          #@z
        dz = dh * (z > 0)  # [0.5, 0]  #@dz
        x = np.array([1, 2])           #@x
        dW1 = np.outer(dz, x)          #@dW1
        # [[0.5, 1.0],                 #@dW1
        #  [0,   0  ]]                 #@dead
      `,
      beats: [
        { id: 'slope', say: 'The ReLU\'s slope is one where its input was positive, and zero where it was negative.', code: 'z' },
        { id: 'on', say: 'Unit zero\'s input was two: on. Its gradient, a half, passes through unchanged.', code: ['z', 'dz'] },
        { id: 'off', say: 'Unit one\'s was minus one: off. Its gradient of one is multiplied by zero, and stops dead. So {dz|d z}, the gradient on the pre-activations, is a half, and zero.', code: 'dz' },
        { id: 'mask', say: '{z > 0|z greater than zero} is a row of ones and zeros, laid over the gradient like a mask: it lets the gradient through where a unit was on, and covers it where it was off.', code: 'dz' },
        { id: 'sign', say: 'The mask comes from z, going forward, not from the sign of the gradient coming back.', code: ['z', 'dz'] },
        { id: 'dW1', say: 'From here, the first layer works just like the second: {dW₁|d W one} is the outer product of {dz|d z} and x. Row zero is a half, times one and two: a half, and one.', code: ['x', 'dW1'] },
        { id: 'dead', say: 'Row one is zero times x: all zeros. From this example, no gradient reaches the off unit\'s weights at all.', code: 'dead' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-mlp-backprop',
  title: 'Two-layer backward pass',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'top',
      title: 'From the scores to W₂',
      codeTitle: 'backward.py',
      code: `
        h = np.array([2, 0])        # z was [2, -1]      #@h
        s = W2 @ h + b2             # [3, 3]             #@h
        ds = np.array([-0.5, 0.5])  # from the loss      #@ds
        dW2 = np.outer(ds, h)       # [[-1, 0], [1, 0]]  #@dW2
        db2 = ds                    # [-0.5, 0.5]        #@db2
      `,
      beats: [
        { id: 'setup', say: 'Here is a forward pass, already run. The hidden layer, h, is two and zero: the second unit\'s pre-activation was minus one, so the ReLU zeroed it. The scores came out three and three.', code: 'h' },
        { id: 'ds', say: 'The loss sends back its gradient on the scores, ds. With class zero correct, softmax gives minus a half and a half.', code: 'ds' },
        { id: 'dW2', say: 'The second layer computes {W₂|W two} times h. As for any matrix product, the gradient on {W₂|W two} is ds times h transposed: entry i, j is ds i, times h j.', code: 'dW2' },
        { id: 'entries', say: 'Row zero: minus a half times two is minus one, and times zero is zero. Row one: one, and zero. The weights that read the silent unit get nothing.', code: 'dW2' },
        { id: 'db2', say: 'The bias adds straight onto the scores, so its gradient is ds itself: minus a half, and a half.', code: 'db2' },
      ],
    },
    {
      id: 'down',
      title: 'Back through W₂',
      codeTitle: 'backward.py',
      code: `
        W2 = np.array([[1, -1], [2, 1]])    #@W2
        dh = W2.T @ ds      # [0.5, 1.0]     #@dh
        # unit 0: 1*(-0.5) + 2*0.5 = 0.5     #@u0
        # unit 1: -1*(-0.5) + 1*0.5 = 1.0    #@u1
      `,
      beats: [
        { id: 'dh', say: 'To keep going, we need the gradient on h, {dh|d h}. It is {W₂|W two} transposed, times ds: each hidden unit collects the gradient of every score it fed, weighted by the weight it fed it through.', code: ['W2', 'dh'] },
        { id: 'u0', say: 'Unit zero fed score zero with weight one, and score one with weight two. One times minus a half, plus two times a half, is a half.', code: 'u0' },
        { id: 'u1', say: 'Unit one, with weights minus one and one: a half, plus a half, is one.', code: 'u1' },
      ],
    },
    {
      id: 'mask',
      title: 'Through the ReLU',
      codeTitle: 'backward.py',
      code: `
        z = np.array([2, -1])             #@mask
        dz = dh * (z > 0)    # [0.5, 0]   #@apply
        x = np.array([1, 2])              #@dW1
        dW1 = np.outer(dz, x)             #@dW1
        # [[0.5, 1.0], [0, 0]]            #@dW1
      `,
      beats: [
        { id: 'mask', say: 'Now the ReLU. Its slope is one where its input was positive and zero where it was negative. So the gradient passes where a unit was on, and stops where it was off.', code: 'mask' },
        { id: 'apply', say: 'Unit zero was on, so it keeps its half. Unit one was off, so its gradient of one becomes zero. That is {dz|d z}, the gradient on the pre-activations.', code: 'apply' },
        { id: 'dW1', say: 'From here, the first layer works like the second: the gradient on {W₁|W one} is that masked gradient times x transposed. The off unit\'s row is all zeros: from this example, no gradient reaches its weights at all.', code: 'dW1' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

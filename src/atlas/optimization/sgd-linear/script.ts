import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-sgd-linear',
  title: 'SGD step',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'toward',
      title: 'The right row moves toward x',
      codeTitle: 'sgd.py',
      code: `
        ds = np.array([-0.7, 0.7])                     #@ds
        lr = 0.5
        W[0] -= lr * ds[0] * x   # ds[0] = -0.7: +0.35 x   #@toward
        W[1] -= lr * ds[1] * x   # ds[1] = +0.7: -0.35 x   #@away
        W @ x   # [2.75, 0.1], was [1.0, 1.85]            #@scores
      `,
      beats: [
        { id: 'recap', say: 'For the input x of two, one, with correct class zero, the score gradient ds is minus {0.7|zero point seven} and plus {0.7|zero point seven}. So row zero of W has gradient minus {0.7|zero point seven} times x, and row one plus {0.7|zero point seven} times x.', code: 'ds' },
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

import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-l2-reg',
  title: 'L2 regularization',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'penalty',
      title: 'A price on big weights',
      codeTitle: 'l2.py',
      code: `
        w = np.array([2.0, -1.0, 0.0])        #@w
        lam = 0.1                             #@lam
        R = lam * np.sum(w**2)   # 0.1 * 5    #@sum
        L = data_loss + R                     #@add
      `,
      beats: [
        { id: 'add', say: 'L2 regularization adds a second term to the loss: {λ|lambda} times the sum of the squared weights.', code: 'add' },
        { id: 'example', say: 'Say the weights are two, minus one and zero, and {λ|lambda} is {0.1|zero point one}. Squared, they are four, one and zero.', code: ['w', 'lam'] },
        { id: 'sum', say: 'They add up to five, and {λ|lambda} times five is a penalty of {0.5|zero point five}, added to the data loss.', code: ['sum', 'add'] },
        { id: 'lam', say: '{λ|Lambda} sets the trade. At zero the penalty vanishes; large, and keeping the weights small matters more than fitting the data.', code: 'lam' },
      ],
    },
    {
      id: 'decay',
      title: 'Weight decay',
      codeTitle: 'l2.py',
      code: `
        dR = 2 * lam * w      # [0.4, -0.2, 0.0]   #@grad
        w = w - lr * (dW + dR)                     #@step
        # where dW = 0: w *= 1 - 2*lr*lam          #@decay
      `,
      beats: [
        { id: 'grad', say: 'The penalty\'s gradient is two {λ|lambda} w. Each weight\'s slope is proportional to the weight itself.', code: 'grad' },
        { id: 'example', say: 'For two, minus one and zero, with {λ|lambda} at {0.1|zero point one}, that is {0.4|zero point four}, minus {0.2|zero point two}, and zero.', code: 'grad' },
        { id: 'step', say: 'The gradient step adds it to the data gradient: w becomes w, minus {η|eta} times g plus two {λ|lambda} w.', code: 'step' },
        { id: 'shrink', say: 'Where the data gradient is zero, each step just multiplies the weight by one minus two {η|eta} {λ|lambda}. With {η|eta} at a half, that is {0.9|zero point nine}: two becomes {1.8|one point eight}, then {1.62|one point six two}.', code: 'decay' },
        { id: 'pull', say: 'So every step pulls every weight a little toward zero, and only the data can pull back. That is why L2 is also called weight decay.', code: ['step', 'decay'] },
      ],
    },
    {
      id: 'spread',
      title: 'Spread it out',
      codeTitle: 'spread.py',
      code: `
        x = np.array([1, 1, 1, 1])
        w1 = np.array([1, 0, 0, 0])                  #@w1
        w2 = np.array([0.25, 0.25, 0.25, 0.25])      #@w2
        w1 @ x, w2 @ x                # 1.0, 1.0     #@same
        np.sum(w1**2), np.sum(w2**2)  # 1.0, 0.25    #@pen
      `,
      beats: [
        { id: 'same', say: 'Take the input one, one, one, one. The weights one, zero, zero, zero, and a quarter in every entry, both give it a score of one.', code: ['w1', 'w2', 'same'] },
        { id: 'pen', say: 'But their penalties differ. The first costs one squared: one. The second, four times a quarter squared: a quarter.', code: 'pen' },
        { id: 'prefer', say: 'Squaring makes big weights expensive, so L2 prefers the second: weight spread over every input, using all of the evidence a little rather than one input a lot.', code: ['w2', 'pen'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

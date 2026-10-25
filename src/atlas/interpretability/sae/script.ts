import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-sae',
  title: 'Sparse autoencoders',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'wide',
      title: 'Wider, not narrower',
      codeTitle: 'sae.py',
      code: `
        f = relu(W_enc @ x + b_enc)   # m features, m >> d  #@enc
        x_hat = W_dec @ f             # back to d           #@dec
      `,
      beats: [
        { id: 'recall', say: 'An autoencoder squeezes its input through a narrow middle, then rebuilds it.' },
        { id: 'flip', say: 'A sparse autoencoder turns that around. If a model stores more features than it has dimensions, the middle must be wider: often eight or sixteen times d.', code: 'enc' },
        { id: 'dict', say: 'Each middle unit is a feature, and each has its own direction in the decoder. Together they form a dictionary.', code: 'dec' },
      ],
    },
    {
      id: 'loss',
      title: 'Rebuild well, with few features',
      codeTitle: 'loss.py',
      code: `
        err = ((x - x_hat)**2).sum()   # rebuild well  #@err
        l1 = lam * f.sum()             # f is >= 0     #@l1
        loss = err + l1                                #@loss
      `,
      beats: [
        { id: 'err', say: 'Training balances two terms. The reconstruction error asks the rebuild to match x.', code: 'err' },
        { id: 'l1', say: 'The L1 penalty adds {λ|lambda} times the sum of the features, which the ReLU keeps from going negative. For the code zero, two, zero, zero, a half, zero, zero, zero, with {λ|lambda} at {0.1|zero point one}, the penalty is {0.25|zero point two five}.', code: 'l1' },
        { id: 'zero', say: 'Every active feature costs something, so small, unhelpful ones are pushed all the way to zero. Only a few stay on for any one input.', code: 'loss' },
      ],
    },
    {
      id: 'rebuild',
      title: 'A sum of a few directions',
      codeTitle: 'rebuild.py',
      code: `
        x_hat = 2 * W_dec[:, 1] + 0.5 * W_dec[:, 4]   #@sum
        # = 2 * [1, 0] + 0.5 * [0, 2] = [2, 1]        #@nums
      `,
      beats: [
        { id: 'sum', say: 'The rebuild is the sum of each active feature times its direction. Here, two times feature one\'s direction, one, zero, plus a half times feature four\'s, zero, two. That is two, one.', code: ['sum', 'nums'] },
        { id: 'meaning', say: 'Because each input uses only a few features, each feature tends to stand for one thing. That is what sparsity buys: a readable dictionary of what the model represents.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

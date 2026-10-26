import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-minibatch',
  title: 'Minibatches',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'full',
      title: 'Every example, every step',
      codeTitle: 'batch.py',
      code: `
        # exact: average over all N examples        #@full
        # N = 50,000 gradients for one step         #@cost
        idx = np.random.choice(N, B, replace=False) #@batch
        batch = data[idx]         # B examples      #@batch
      `,
      beats: [
        { id: 'full', say: 'Often the function to minimize is an average over N examples, each adding its own term. Then its gradient is the average of N per-example gradients.', code: 'full' },
        { id: 'cost', say: 'With fifty thousand examples, one exact step means computing fifty thousand gradients first.', code: 'cost' },
        { id: 'batch', say: 'So draw a small random batch of B examples, B for the batch size, and average only theirs. It estimates the same gradient, at a fraction of the cost.', code: 'batch' },
      ],
    },
    {
      id: 'average',
      title: 'A noisy average',
      codeTitle: 'batch.py',
      code: `
        g = np.array([2, -1, 3, 0])   # B = 4    #@per
        g.mean()        # 1.0                     #@mean
        # another batch: 0.2, then 1.9, ...       #@noise
        # the scatter shrinks like 1 / sqrt(B)    #@size
        # B = 4 to 64: 16x B, 1/4 the scatter     #@size
        # work per step grows like B              #@cost
        # B = 64 to 8: 1/8 the work, noisier      #@cost
      `,
      beats: [
        { id: 'per', say: 'Say B is four, and for one entry of w the four examples give gradients of two, minus one, three and zero.', code: 'per' },
        { id: 'mean', say: 'The minibatch gradient is their mean: they add up to four, and four over four is one.', code: 'mean' },
        { id: 'noise', say: 'Another batch gives another estimate. Batch after batch, they scatter around the true gradient.', code: 'noise' },
        { id: 'size', say: 'Bigger batches scatter less: the scatter shrinks like {1/√B|one over the square root of B}, the sign {√|root} meaning square root. So four times the batch halves it, and sixteen times, from four to sixty four, quarters it.', code: 'size' },
        { id: 'cost', say: 'But each step costs work in proportion to B, since every example in the batch needs its own gradient. Going from sixty four down to eight does one eighth of the work per step, with a noisier gradient: many cheap, noisy steps.', code: 'cost' },
      ],
    },
    {
      id: 'epoch',
      title: 'Steps per epoch',
      codeTitle: 'epoch.py',
      code: `
        N, B = 1200, 100
        steps_per_epoch = N // B   # 12     #@count
        3 * steps_per_epoch        # 36     #@epochs
        k = 5
        seen = k * B               # 500    #@seen
        36 * B / N                 # 3.0    #@back
      `,
      beats: [
        { id: 'epoch', say: 'One pass through all N examples is called an epoch.' },
        { id: 'count', say: 'Each step uses one batch of B, so an epoch takes N over B steps. Twelve hundred examples in batches of a hundred: twelve steps.', code: 'count' },
        { id: 'epochs', say: 'Several epochs take that many times the steps: three epochs are three times twelve, thirty six steps.', code: 'epochs' },
        { id: 'seen', say: 'And after k steps, k times B examples have been used. Five steps of a hundred: five hundred.', code: 'seen' },
        { id: 'back', say: 'Turn that around to count epochs. Thirty six steps of a hundred is thirty six hundred examples; divide by N, twelve hundred: three epochs.', code: 'back' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

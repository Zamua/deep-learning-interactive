import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-minibatch',
  title: 'Minibatches',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Robbins & Monro', year: 1951, title: 'A stochastic approximation method', url: 'https://doi.org/10.1214/aoms/1177729586', scene: 'path' },
  ],
  scenes: [
    {
      id: 'full',
      title: 'One arrow per example',
      codeTitle: 'batch.py',
      code: `
        N = 50000   # photos: examples       #@data
        # f(w): the average of N terms       #@example
        # grads[i]: example i's gradient     #@per
        g = grads.mean(axis=0)   # true      #@true
        # one exact step: N gradients        #@descent
        idx = np.random.choice(N, 8)         #@poll
        grads[idx].mean(axis=0)  # close     #@poll
        B = len(idx)    # 8: the batch size  #@B
      `,
      beats: [
        { id: 'data', say: 'Often the function to minimize is built from data: say fifty thousand photos, each a vector of numbers. Call how many there are N.', code: 'data' },
        { id: 'example', say: 'Each photo is called an example, and adds its own term to f: a number that depends on w and that one photo, small when w suits it. f is the average of the N terms.', code: 'example' },
        { id: 'per', say: 'So each example has its own gradient, the gradient of its term. These per-example gradients point roughly, but not exactly, the same way.', code: 'per' },
        { id: 'true', say: 'The slope of a sum is the sum of the slopes, so the gradient of f is the average of all N arrows. Call it the true gradient.', code: 'true' },
        { id: 'descent', say: 'Stepping w against it, downhill, step after step, is called gradient descent. But each exact step needs all fifty thousand gradients first.', code: 'descent' },
        { id: 'poll', say: 'So do what a pollster does: ask a random few. Pick eight photos at random and average just their arrows. It lands close, for a sliver of the work.', code: 'poll' },
        { id: 'B', say: 'How many you pick is the batch size, B. A batch is a group handled together, like a batch of loaves; this one is small next to N, so it is a minibatch.', code: 'B' },
      ],
    },
    {
      id: 'average',
      title: 'A noisy average',
      codeTitle: 'average.py',
      code: `
        g = np.array([2, -1, 3, 0])  # B = 4 #@per
        g.mean()     # 4 / 4 = 1.0           #@mean
        # divide by B, not by N              #@used
        # next batches: 0.2, 1.9, ...        #@noise
        # scatter: like 1 / sqrt(B)          #@size
        # work per step: like B              #@cost
      `,
      beats: [
        { id: 'per', say: 'Follow one entry of w. In a batch of four, say the examples\' gradients for that entry are two, minus one, three and zero.', code: 'per' },
        { id: 'mean', say: 'The minibatch gradient is their average: they add up to four, and four over four is one.', code: 'mean' },
        { id: 'used', say: 'Divide by B, the examples you used, not by N. The four stand in for all of them.', code: 'used' },
        { id: 'noise', say: 'Another batch gives another estimate: {0.2|zero point two}, then {1.9|one point nine}. Batch after batch, they scatter around the true gradient, here {0.8|zero point eight}.', code: 'noise' },
        { id: 'more', say: 'Bigger batches scatter less: with more examples, more of their quirks cancel.', code: 'size' },
        { id: 'sqrt', say: 'The scatter shrinks like {1/√B|one over the square root of B}, where {√|the root sign} means square root. So four times the batch halves the scatter.', code: 'size' },
        { id: 'cost', say: 'But every example in a batch needs its own gradient, so a step\'s work grows in proportion to B. Sixteen examples cost a quarter of what sixty four do.', code: 'cost' },
        { id: 'trade', say: 'So small batches buy many cheap, noisy steps, and big ones fewer, steadier, costlier steps.', code: ['size', 'cost'] },
      ],
    },
    {
      id: 'path',
      title: 'Noisy steps still get there',
      codeTitle: 'sgd.py',
      code: `
        for k in range(steps):               #@loop
            idx = np.random.choice(N, B)     #@loop
            g = grads[idx].mean(axis=0)      #@est
            w = w - eta * g                  #@step
      `,
      beats: [
        { id: 'path', say: 'On the bowl from before, exact steps glide down to the bottom. Minibatch steps follow noisy estimates, so their path wobbles.', code: 'step' },
        { id: 'cancel', say: 'But each estimate points the true way on average, so the wobbles tend to cancel, and the path still closes in.', code: 'est' },
        { id: 'robbins', say: 'In 1951, Herbert Robbins and Sutton Monro proved this can work: a method that sees only noisy measurements, stepping after each one with shrinking steps, still homes in on the answer.', code: 'loop' },
        { id: 'name', say: 'Their paper was called A Stochastic Approximation Method. Stochastic, from a Greek word for aiming, or guessing, means random.', code: 'loop' },
        { id: 'sgd', say: 'So gradient descent on random examples is called stochastic gradient descent, or {SGD|S G D}. Strictly that means one example per step, but the name covers minibatches too.', code: ['loop', 'step'] },
      ],
    },
    {
      id: 'epoch',
      title: 'Counting in epochs',
      codeTitle: 'epoch.py',
      code: `
        N, B = 1200, 100                     #@NB
        N // B      # 12 steps per epoch     #@count
        3 * 12      # 36 steps: 3 epochs     #@epochs
        k = 5       # steps taken            #@seen
        k * B       # 500 examples seen      #@seen
        36 * B      # 3,600 examples seen    #@back
        3600 / N    # 3.0 epochs             #@div
      `,
      beats: [
        { id: 'shuffle', say: 'In practice, shuffle the examples, cut them into batches of B, and take the next batch each step. Here, twelve hundred examples in batches of a hundred.', code: 'NB' },
        { id: 'epoch', say: 'One full pass through all N examples is called an epoch, an old word for a period of time.', code: 'NB' },
        { id: 'count', say: 'Each step uses one batch, so an epoch takes N over B steps: twelve hundred over a hundred, twelve.', code: 'count' },
        { id: 'epochs', say: 'Three epochs take three times that: thirty six steps.', code: 'epochs' },
        { id: 'seen', say: 'After k steps, k times B examples have gone through. Five steps of a hundred: five hundred.', code: 'seen' },
        { id: 'back', say: 'Turn that around to count epochs. Thirty six steps of a hundred are thirty six hundred examples.', code: 'back' },
        { id: 'div', say: 'Divide by N, twelve hundred: three epochs.', code: 'div' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

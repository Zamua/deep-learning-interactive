import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-softmax',
  title: 'Softmax',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'John S. Bridle', year: 1989, title: 'Training stochastic model recognition algorithms as networks can lead to maximum mutual information estimation of parameters', url: 'https://proceedings.neurips.cc/paper/1989/hash/0336dcbab05b9d5ad24f4333c7658a0e-Abstract.html', scene: 'gaps' },
  ],
  scenes: [
    {
      id: 'sure',
      title: 'How sure?',
      codeTitle: 'scores.py',
      code: `
        # cat, dog or bird?              #@ask
        s = np.array([2, 1, -1])         #@s
        np.argmax(s)      # 0: cat       #@arg
        # how sure? shares of one whole  #@p
        s.sum()           # 2, not 1     #@fail
      `,
      beats: [
        { id: 'ask', say: 'A program looks at a photo and scores three answers: cat, dog and bird. The scores are two, one and minus one, and the higher the score, the more it leans that way.', code: ['ask', 's'] },
        { id: 'arg', say: 'Argmax picks cat, the top score. But how sure is the program? Two against one could be a near thing.', code: 'arg' },
        { id: 'prob', say: 'A probability measures how likely something is: a number from zero, meaning no chance, to one, meaning certain.', code: 'p' },
        { id: 'whole', say: 'One of the answers must be right, so their probabilities add up to exactly one. Each is a share, a slice of the same whole.', code: 'p' },
        { id: 'fail', say: 'Scores cannot be those slices. Minus one is negative, a slice smaller than nothing, and the three add up to two, not one.', code: 'fail' },
      ],
    },
    {
      id: 'exp',
      title: 'Move one: make them positive',
      codeTitle: 'softmax.py',
      code: `
        s = np.array([2, 1, -1])         #@s
        e = np.exp(s)                    #@exp
        # [7.39, 2.72, 0.37]: all > 0    #@vals
        # order kept: 7.39 > 2.72 > 0.37 #@order
      `,
      beats: [
        { id: 'two', say: 'Softmax fixes both problems in two moves.', code: 's' },
        { id: 'exp', say: 'First, raise e, about {2.718|two point seven one eight}, to the power of each score.', code: 'exp' },
        { id: 'pos', say: 'e to any power is positive, so minus one becomes {0.37|zero point three seven}: a small slice, but a real one.', code: 'vals' },
        { id: 'order', say: 'A higher score always gives a bigger result, so the order stays the same: cat, then dog, then bird.', code: 'order' },
        { id: 'grow', say: 'And each extra point of score multiplies by about {2.7|two point seven}, so the leader pulls ahead: two becomes {7.39|seven point three nine}.', code: 'vals' },
      ],
    },
    {
      id: 'divide',
      title: 'Move two: share out one whole',
      codeTitle: 'softmax.py',
      code: `
        e = np.exp(s)  # [7.39, 2.72, 0.37] #@e
        e.sum()        # 10.48: the total   #@total
        p = e / e.sum()                     #@p
        # [0.71, 0.26, 0.04]                #@p
        p.sum()        # 1.0                #@sum
      `,
      beats: [
        { id: 'stack', say: 'Second, stack the three into one bar. Its height is their total: {10.48|ten point four eight}.', code: 'total' },
        { id: 'divide', say: 'Now divide each one by that total. The whole bar now measures one, and every slice keeps its share of it. These shares are the probabilities, p.', code: 'p' },
        { id: 'cat', say: 'Cat\'s slice is {7.39|seven point three nine} over {10.48|ten point four eight}: about {0.71|zero point seven one}.', code: 'p' },
        { id: 'check', say: 'Every slice is positive, and together they fill the bar exactly: they add up to one.', code: 'sum' },
        { id: 'pk', say: 'In symbols, the probability at position k, {pₖ|p sub k}, is that answer\'s slice, e to its score, over the total.', code: 'p' },
        { id: 'sigma', say: 'The total is written with {Σ|sigma}, a capital Greek S, for sum: add up e to the score of every answer.', code: 'total' },
        { id: 'j', say: 'The j beneath it stands for each position in turn: zero, one and two.', code: 'total' },
      ],
    },
    {
      id: 'gaps',
      title: 'Only the gaps matter',
      codeTitle: 'gaps.py',
      code: `
        softmax(s)      # [0.71, 0.26, 0.04] #@base
        softmax(s + 5)  # [0.71, 0.26, 0.04] #@shift
        softmax(0 * s)  # [0.33, 0.33, 0.33] #@flat
        softmax(2 * s)  # [0.88, 0.12, 0.00] #@scale
      `,
      beats: [
        { id: 'shift', say: 'Raise every score by five. Each e to the score is multiplied by the same factor, e to the five, so every slice grows alike, and the shares stay put.', code: ['base', 'shift'] },
        { id: 'gaps', say: 'Only the gaps between the scores matter. With no gaps at all, every answer gets an equal share: a third each.', code: 'flat' },
        { id: 'scale', say: 'Double every score instead, and the gaps double. Cat\'s share grows to {0.88|zero point eight eight}.', code: ['base', 'scale'] },
        { id: 'soft', say: 'So the top score gets the biggest slice, but never all of it: every answer keeps a little. Argmax is a hard pick, and this is a soft one.', code: 'scale' },
        { id: 'bridle', say: 'John Bridle named it softmax in 1989: it keeps the order of the scores, he wrote, and is a smooth version of winner take all, picking the maximum.', code: 'base' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

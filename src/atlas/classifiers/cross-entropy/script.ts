import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-cross-entropy',
  title: 'Cross-entropy',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'loss',
      title: 'Minus the log of the right answer',
      codeTitle: 'loss.py',
      code: `
        p = np.array([0.7, 0.2, 0.1])   #@p
        y = 0                           #@y
        L = -np.log(p[y])    # 0.36     #@L
        -np.log(p[2])        # 2.30     #@L2
      `,
      beats: [
        { id: 'p', say: 'Softmax hands back probabilities: {0.7|zero point seven}, {0.2|zero point two} and {0.1|zero point one}.', code: 'p' },
        { id: 'y', say: 'Say option zero turns out to be right, so y is zero. The loss is one number that says how bad the guess was, and it looks only at that option\'s probability.', code: 'y' },
        { id: 'L', say: 'The loss, L, is minus the log of it. Minus the log of {0.7|zero point seven} is about {0.36|zero point three six}.', code: 'L' },
        { id: 'wrong', say: 'Had option two been the right one, it would be minus the log of {0.1|zero point one}: {2.30|two point three zero}. Less probability on the truth, more loss.', code: 'L2' },
      ],
    },
    {
      id: 'curve',
      title: 'From zero to infinity',
      codeTitle: 'curve.py',
      code: `
        -np.log(1.0)     # 0.00     #@one
        -np.log(0.7)     # 0.36     #@mid
        -np.log(0.1)     # 2.30     #@mid
        -np.log(0.001)   # 6.91     #@zero
      `,
      beats: [
        { id: 'curve', say: 'Here is the loss, minus log p, for every p from zero to one. {→|The arrow} reads “goes to”: a p of {0.7|zero point seven} goes to a loss of {0.36|zero point three six}.', code: 'mid' },
        { id: 'one', say: 'At p equal to one, a confident right answer, the loss is zero. It never dips below zero, because the log of a probability is never positive.', code: 'one' },
        { id: 'zero', say: 'As p falls toward zero, the loss climbs without limit, toward infinity, {∞|infinity}. A confident wrong answer costs the most.', code: 'zero' },
      ],
    },
    {
      id: 'scores',
      title: 'Straight from the scores',
      codeTitle: 'from_scores.py',
      code: `
        s = np.array([2, 1, -1])               #@s
        y = 0                                  #@s
        total = np.exp(s).sum()    # T = 10.48  #@T
        L = np.log(total) - s[y]   # 2.35 - 2   #@L
        np.log(10)   # 2.30: ten equal scores  #@init
      `,
      beats: [
        { id: 's', say: 'From scores, softmax makes p of y, the right option\'s probability, equal to e to its score, over the total, T.', code: ['s', 'T'] },
        { id: 'rule', say: 'Take minus the log, and the loss is the log of the total, minus the right option\'s score, s of y. For scores two, one and minus one, with y equal to zero, that is {2.35|two point three five} minus two: {0.35|zero point three five}.', code: 'L' },
        { id: 'init', say: 'When all the scores are equal, each of C options gets one over C, and the loss is log C. With ten options, {2.30|two point three zero}.', code: 'init' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

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
        { id: 'y', say: 'The image really is class zero, so y is zero. For the loss, only that class\'s probability matters.', code: 'y' },
        { id: 'L', say: 'The loss is minus the log of it. Minus the log of {0.7|zero point seven} is about {0.36|zero point three six}.', code: 'L' },
        { id: 'wrong', say: 'Had the right class been class two, it would be minus the log of {0.1|zero point one}: {2.30|two point three zero}. Less probability on the truth, more loss.', code: 'L2' },
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
        { id: 'curve', say: 'Here is the loss, minus log p, for every p from zero to one.', code: 'mid' },
        { id: 'one', say: 'At p equal to one, a confident right answer, the loss is zero. It never dips below zero, because the log of a probability is never positive.', code: 'one' },
        { id: 'zero', say: 'As p falls toward zero, the loss climbs without limit. A confident wrong answer costs the most.', code: 'zero' },
      ],
    },
    {
      id: 'scores',
      title: 'Straight from the scores',
      codeTitle: 'from_scores.py',
      code: `
        s = np.array([2, 1, -1])               #@s
        y = 0                                  #@s
        T = np.exp(s).sum()     # 10.48        #@T
        L = np.log(T) - s[y]    # 2.35 - 2     #@L
        np.log(10)   # 2.30: ten equal scores  #@init
      `,
      beats: [
        { id: 's', say: 'From scores, softmax makes p of y equal to e to the right score, over the total, T.', code: ['s', 'T'] },
        { id: 'rule', say: 'Take minus the log, and the loss is the log of the total, minus the right class\'s score. For scores two, one and minus one, with y equal to zero, that is {2.35|two point three five} minus two: {0.35|zero point three five}.', code: 'L' },
        { id: 'init', say: 'Before training, the scores are about equal, so each of C classes gets one over C, and the loss is log C. With ten classes, {2.30|two point three zero}.', code: 'init' },
      ],
    },
    {
      id: 'example',
      title: 'Worked example',
      codeTitle: 'example.py',
      code: `
        p = np.array([0.1, 0.6, 0.3])   #@p
        y = 2                           #@p
        -np.log(p[y])    # 1.20         #@L
      `,
      beats: [
        { id: 'ask', think: true, say: 'Your turn. The probabilities are {0.1|zero point one}, {0.6|zero point six} and {0.3|zero point three}, and the right class is two. The log of {0.3|zero point three} is about minus {1.20|one point two zero}.', code: 'p' },
        { id: 'pick', say: 'The loss looks only at class two, with {0.3|zero point three}. Not {0.6|zero point six}, even though that is the largest.' },
        { id: 'L', say: 'Minus its log, minus minus {1.20|one point two zero}, gives a loss of {1.20|one point two zero}.', code: 'L' },
      ],
    },
  ],
};

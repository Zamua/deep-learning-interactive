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
        s = np.array([2, 1, -1])            #@s
        y = 0                               #@s
        T = np.exp(s).sum()      # 10.48    #@T
        p_y = np.exp(s[y]) / T   # e**2 / T #@py
        np.log(p_y)      # 2 - 2.35         #@quot
        L = -np.log(p_y) # 2.35 - 2 = 0.35  #@flip
        L = np.log(T) - s[y]     # the same #@L
      `,
      beats: [
        { id: 's', say: 'Now start from scores: two, one and minus one, with option zero right. Softmax raises e to each score and adds them up: the total, T, is {10.48|ten point four eight}.', code: ['s', 'T'] },
        { id: 'py', say: 'The right option\'s probability, p of y, is e to its score, over the total: e squared, over {10.48|ten point four eight}.', code: 'py' },
        { id: 'quot', say: 'The log of a quotient is the log of the top, minus the log of the bottom: ln of e squared, minus ln {10.48|ten point four eight}.', code: 'quot' },
        { id: 'undo', say: 'ln undoes e to a power, so ln of e squared is just two, the score itself. And ln {10.48|ten point four eight} is about {2.35|two point three five}.', code: 'quot' },
        { id: 'flip', say: 'The loss is minus that log, which flips the subtraction: {2.35|two point three five} minus two, or {0.35|zero point three five}.', code: 'flip' },
        { id: 'rule', say: 'Any scores go the same way. The loss is the log of the total, minus the right option\'s score, s of y.', code: 'L' },
      ],
    },
    {
      id: 'uniform',
      title: 'Equal scores',
      codeTitle: 'equal.py',
      code: `
        C = 10                              #@init
        p = np.full(C, 1 / C)   # 0.1 each  #@init
        -np.log(1 / C)    # ln 10 = 2.30    #@recip
        # any C: L = ln C                   #@logC
        np.log(8)         # 3 ln 2 = 2.08   #@eight
      `,
      beats: [
        { id: 'init', say: 'When all the scores are equal, every option gets the same share. With C options, that share is one over C: ten options get a tenth each.', code: 'init' },
        { id: 'recip', say: 'So the loss is minus ln of a tenth. One over a number flips the sign of its log, so that is ln ten: about {2.30|two point three zero}.', code: 'recip' },
        { id: 'logC', say: 'For any C, equal scores give a loss of ln C, whichever option is right.', code: 'logC' },
        { id: 'eight', say: 'With eight options, write eight as two cubed, and the power comes out in front: ln eight is three ln two. That is three times {0.693|zero point six nine three}, about {2.08|two point zero eight}.', code: 'eight' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

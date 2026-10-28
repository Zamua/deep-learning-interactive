import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-softmax-grad',
  title: 'Deriving the softmax gradient',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Bridle', year: 1989, title: 'Training stochastic model recognition algorithms as networks can lead to maximum mutual information estimation of parameters', url: 'https://papers.nips.cc/paper/1989/hash/0336dcbab05b9d5ad24f4333c7658a0e-Abstract.html', scene: 'right' },
  ],
  scenes: [
    {
      id: 'paths',
      title: 'Two paths to the loss',
      codeTitle: 'loss.py',
      code: `
        s = np.array([1.8, 1.1, 0.0])     #@s
        y = 1           # the right answer #@s
        ds = [0.6, -0.7, 0.1]  # nudged    #@ds
        T = np.exp(s).sum()    # 10.05     #@T
        L = np.log(T) - s[y]   # 1.21      #@L
      `,
      beats: [
        { id: 'measured', say: 'Nudging the scores one at a time measured the gradient of the loss: {0.6|zero point six}, minus {0.7|zero point seven}, and {0.1|zero point one}. That is p, with one taken away at the right answer, y.', code: ['s', 'ds'] },
        { id: 'why', say: 'But a nudge measures only the scores in front of you. To know the pattern holds for every set of scores, follow how each score reaches the loss, and use the chain rule.', code: 'ds' },
        { id: 'loss', say: 'Written out, the loss is the log of the total, T, minus the right answer\'s score: {L = log T − s_y|L equals log T, minus s y}.', code: ['T', 'L'] },
        { id: 'paths', say: 'So every score feeds T, T feeds log T, and log T feeds L. The right answer\'s score also takes a second, shorter path, straight to minus {s_y|s y}.', code: 'L' },
      ],
    },
    {
      id: 'top',
      title: 'Through the total',
      codeTitle: 'top.py',
      code: `
        # s[0] -> T -> log T -> L          #@path
        np.exp(s[0])   # T's slope: 6.05   #@dT
        1 / T          # log's slope: 0.1  #@dlog
        6.05 / 10.05   # 0.60, as nudged   #@mult
        np.exp(s) / T  # every j: p[j]     #@pj
      `,
      beats: [
        { id: 'term', say: 'Follow {s₀|s zero}, a wrong option\'s score, along the long path. T adds up e to every score, but only one of its terms holds {s₀|s zero}: e to the {s₀|s zero}. The others stay put.', code: 'path' },
        { id: 'dT', say: 'e to the x is its own slope, so T moves e to the {1.8|one point eight}, about six, times as fast as {s₀|s zero}. A nudge grows sixfold.', code: 'dT' },
        { id: 'dlog', say: 'The log\'s slope is one over its input, so log T moves one over T times as fast as T. T is about ten, so the nudge shrinks to a tenth.', code: 'dlog' },
        { id: 'mult', say: 'The chain rule multiplies the local slopes: six times a tenth is {0.6|zero point six}, the slope the nudges measured.', code: 'mult' },
        { id: 'pj', say: 'None of that needed these numbers. For any score {sⱼ|s j}, the two slopes are e to the {sⱼ|s j}, and one over T. Their product, e to the score over the total, is that option\'s probability, {pⱼ|p j}.', code: 'pj' },
      ],
    },
    {
      id: 'right',
      title: 'The right answer\'s extra path',
      codeTitle: 'right.py',
      code: `
        # -s[y] moves with s[y] only       #@minus
        # j == y: slope -1                 #@minus
        # j != y: slope 0                  #@zero
        ds = p.copy()   # every j: p[j]    #@add
        ds[y] -= 1      # and -1 at y      #@add
        # ds[j] = p[j] - (j == y)          #@br
      `,
      beats: [
        { id: 'minus', say: 'Now the short path. Minus {s_y|s y} holds only the right answer\'s score, and moves against it by the whole nudge: a slope of minus one.', code: 'minus' },
        { id: 'zero', say: 'Every other score leaves it alone: a slope of zero when {j ≠ y|j is not y}, where the slashed equals sign reads “is not”.', code: 'zero' },
        { id: 'add', say: 'L is the sum of the two parts, and the slope of a sum is the sum of the slopes.', code: 'add' },
        { id: 'wrong', say: 'So a wrong option gets {pⱼ|p j} alone, while the right answer gets {p_y|p y}, minus one: {0.3|zero point three} minus one, minus {0.7|zero point seven}.', code: 'add' },
        { id: 'bracket', say: 'One line covers both with a bracket. {[j = y]|The bracket j equals y} is one when j is y, and zero otherwise: entry j of the one-hot vector of y.', code: 'br' },
        { id: 'result', say: 'So {∂L/∂sⱼ = pⱼ − [j = y]|partial L, partial s j, equals p j, minus the bracket j equals y}, for any scores at all. The pattern the nudges found now has a reason.', code: 'br' },
        { id: 'bridle', say: 'In 1989, John Bridle, who named the softmax, made the same point: the gradient on the scores is the probabilities, minus the one-hot target. He called softmax and this loss natural partners.', code: 'br' },
      ],
    },
    {
      id: 'any',
      title: 'Scores never nudged',
      codeTitle: 'any.py',
      code: `
        s = np.array([2.0, 0.0, 0.0])     #@s
        y = 0                             #@s
        T = 7.39 + 1 + 1     # 9.39       #@T
        p = np.exp(s) / T    # 0.79, ...  #@p
        ds = p.copy()                     #@g0
        ds[y] -= 1      # -0.21 at y      #@g0
        ds[1]           # 1 / 9.39: 0.11  #@g1
      `,
      beats: [
        { id: 'new', say: 'The rule works on scores nobody nudged. Take two, zero and zero, with option zero right, and e squared about {7.39|seven point three nine}.', code: 's' },
        { id: 'total', say: 'The total, T, is {7.39|seven point three nine}, plus one, plus one: {9.39|nine point three nine}.', code: 'T' },
        { id: 'p0', say: 'Option zero\'s probability is {7.39|seven point three nine} over {9.39|nine point three nine}: about {0.79|zero point seven nine}.', code: 'p' },
        { id: 'g0', say: 'It is the right answer, so take one away: {0.79|zero point seven nine}, minus one, is minus {0.21|zero point two one}.', code: 'g0' },
        { id: 'g1', say: 'Option one is wrong, so its slope is its probability alone: one over {9.39|nine point three nine}, about {0.11|zero point one one}.', code: 'g1' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

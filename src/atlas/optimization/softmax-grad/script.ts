import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-softmax-grad',
  title: 'Softmax gradient',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'setup',
      title: 'Scores in, loss out',
      codeTitle: 'grad.py',
      code: `
        s = np.array([1.8, 1.1, 0.0])       #@s
        p = softmax(s)   # [0.6, 0.3, 0.1]  #@p
        L = -np.log(p[y])   # y = 1: 1.2    #@L
        ds = p - np.eye(3)[y]               #@ds
        # [0.6, -0.7, 0.1]                  #@ds
      `,
      beats: [
        { id: 'chain', say: 'Scores, s, go through softmax to give probabilities, p. The loss is minus the log of the correct option\'s probability. Here the correct option is option one, so the loss is minus log {0.3|zero point three}, about {1.2|one point two}.', code: ['s', 'p', 'L'] },
        { id: 'ask', say: 'Now ask how the loss changes as each score moves. One derivative per score, stacked into a vector: the gradient.', code: 'ds' },
        { id: 'answer', say: 'It comes out remarkably simple: p, minus the one-hot vector for y, a one at the correct option and zeros elsewhere. Here, {0.6|zero point six}, minus {0.7|zero point seven}, and {0.1|zero point one}.', code: 'ds' },
      ],
    },
    {
      id: 'derive',
      title: 'Why p minus one-hot',
      codeTitle: 'derive.py',
      code: `
        # L = -s[y] + log(sum(exp(s)))       #@expand
        # d/ds[j] log(sum(exp(s))) = p[j]    #@log
        # d/ds[j] (-s[y]) = -1 if j == y     #@minus
        ds = p.copy()                        #@together
        ds[y] -= 1                           #@together
      `,
      beats: [
        { id: 'expand', say: 'Write the loss out. Minus the log of a fraction is minus the log of the top, plus the log of the bottom: minus s y, plus the log of the sum.', code: 'expand' },
        { id: 'log', say: 'Now take the derivative with respect to any one score, s j. By the chain rule, the log of the sum gives one over the sum, times e to the s j. That is exactly p j.', code: 'log' },
        { id: 'minus', say: 'Minus s y depends only on the correct score: its derivative is minus one when j is y, and zero for every other option.', code: 'minus' },
        { id: 'together', say: 'Add the two: p j, with one taken away at the correct option.', code: 'together' },
      ],
    },
    {
      id: 'bars',
      title: 'Push the right score up',
      codeTitle: 'grad.py',
      code: `
        p = np.array([0.6, 0.3, 0.1])     #@p
        ds = p - np.eye(3)[1]             #@sub
        # [0.6, -0.7, 0.1]                #@sub
        sum(ds)    # 0.0                  #@sum
        # moving s against ds lowers L:   #@step
        # s[1] up, s[0] and s[2] down     #@step
      `,
      beats: [
        { id: 'p', say: 'Back to our numbers. The probabilities are {0.6|zero point six}, {0.3|zero point three} and {0.1|zero point one}, and the correct option is option one.', code: 'p' },
        { id: 'sub', say: 'Take one away at option one: {0.3|zero point three} minus one is minus {0.7|zero point seven}. The other options keep their probabilities.', code: 'sub' },
        { id: 'sum', say: 'The entries always add up to zero: p adds up to one, and the one-hot vector takes exactly one away.', code: 'sum' },
        { id: 'step', say: 'So to lower the loss, move each score against its entry: the correct score goes up, and the others go down, the most confident wrong option the most.', code: 'step' },
        { id: 'done', say: 'And once the correct option gets nearly all the probability, the gradient is nearly zero: there is little loss left to remove.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

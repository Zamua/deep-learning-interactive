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
      title: 'Nudge each score',
      codeTitle: 'grad.py',
      code: `
        s = np.array([1.8, 1.1, 0.0])        #@s
        p = softmax(s)   # [0.6, 0.3, 0.1]   #@p
        L = -np.log(p[y])   # y = 1: 1.208   #@L
        s[0] += 0.01     # L -> 1.214        #@nudge
        (1.214 - 1.208) / 0.01   # 0.6       #@nudge
        ds = np.array([0.6, -0.7, 0.1])      #@ds
        # [p[0], p[1] - 1, p[2]]             #@pattern
      `,
      beats: [
        { id: 'chain', say: 'Scores, s, go through softmax to give probabilities, p. The loss is minus the log of the correct option\'s probability. Here the correct option is option one, so the loss is minus log {0.3|zero point three}, about {1.2|one point two}.', code: ['s', 'p', 'L'] },
        { id: 'ask', say: 'Now ask how the loss changes as each score moves. One partial derivative per score, stacked into a vector: the gradient, {∂L/∂s|partial L, partial s}, called ds in code.', code: 'ds' },
        { id: 'nudge', say: 'Measure the first one. Raise {s₀|s zero} by {0.01|zero point zero one}, and the loss goes from {1.208|one point two zero eight} to {1.214|one point two one four}: up {0.006|zero point zero zero six}, which is {0.6|zero point six} times the nudge. That slope, {0.6|zero point six}, is the first entry.', code: 'nudge' },
        { id: 'others', say: 'Nudge the others the same way. Raising {s₁|s one}, the correct score, lowers the loss, by {0.007|zero point zero zero seven}: a slope of minus {0.7|zero point seven}. Raising {s₂|s two} adds {0.001|zero point zero zero one}: a slope of {0.1|zero point one}.', code: 'ds' },
        { id: 'pattern', say: 'Now compare with p. The two wrong options\' slopes are their own probabilities, {0.6|zero point six} and {0.1|zero point one}. The correct option\'s slope is its probability minus one: {0.3|zero point three} minus one.', code: 'pattern' },
      ],
    },
    {
      id: 'derive',
      title: 'Why p, minus one',
      codeTitle: 'derive.py',
      code: `
        # L = -s[y] + log(T), T = sum(exp(s))  #@expand
        # T moves exp(s[j]) times as fast     #@dT
        # log(T) moves 1 / T times as fast    #@dlog
        # exp(s[j]) / T = p[j]                #@pj
        # d/ds[j] (-s[y]) = -1 if j == y      #@minus
        ds = p.copy()                         #@together
        ds[y] -= 1                            #@together
      `,
      beats: [
        { id: 'expand', say: 'Write the loss out. Minus the log of a fraction is minus the log of the top, plus the log of the bottom: minus {s_y|s y}, the correct option\'s score, plus the log of the total, T.', code: 'expand' },
        { id: 'dT', say: 'Start with the log of the total. It reaches {s₀|s zero} through a chain: {s₀|s zero} feeds T, and T feeds log T. T adds up e to every score, and only one of those terms holds {s₀|s zero}. e to the x is its own derivative, so T moves e to the {1.8|one point eight}, about six, times as fast as {s₀|s zero}.', code: 'dT' },
        { id: 'dlog', say: 'And log T, the natural log, has slope one over T. T is about ten, so log T moves a tenth as fast as T. A nudge of {0.01|zero point zero one} grows to {0.06|zero point zero six}, then shrinks to {0.006|zero point zero zero six}.', code: 'dlog' },
        { id: 'pj', say: 'The chain rule multiplies the two: six times a tenth is {0.6|zero point six}, the slope measured before. For any score {sⱼ|s j}, it is e to the {sⱼ|s j}, over the total. That is exactly {pⱼ|p j}.', code: 'pj' },
        { id: 'minus', say: 'Minus {s_y|s y} depends only on the correct score: its derivative is minus one when j is y, and zero when {j ≠ y|j is not y}, the slashed equals sign reading “is not”.', code: 'minus' },
        { id: 'together', say: 'Add the two: {pⱼ − [j = y]|p j, minus the bracket j equals y}. The bracket is one when j is y and zero otherwise, so it is {pⱼ|p j} with one taken away at the correct option. Just the pattern the nudges found.', code: 'together' },
      ],
    },
    {
      id: 'bars',
      title: 'Push the right score up',
      codeTitle: 'grad.py',
      code: `
        p = np.array([0.6, 0.3, 0.1])     #@p
        onehot = np.eye(3)[1]  # [0, 1, 0] #@answer
        ds = p - onehot                   #@sub
        # [0.6, -0.7, 0.1]                #@sub
        sum(ds)    # 0.0                  #@sum
        # moving s against ds lowers L:   #@step
        # s[1] up, s[0] and s[2] down     #@step
      `,
      beats: [
        { id: 'p', say: 'Back to our numbers. The probabilities are {0.6|zero point six}, {0.3|zero point three} and {0.1|zero point one}, and the correct option is option one.', code: 'p' },
        { id: 'answer', say: 'As a vector, the gradient is p, minus {onehot(y)|one-hot of y}: the vector with a one at the correct option and zeros elsewhere. Here, zero, one, zero.', code: 'answer' },
        { id: 'sub', say: 'Take one away at option one: {0.3|zero point three} minus one is minus {0.7|zero point seven}. The other options keep their probabilities.', code: 'sub' },
        { id: 'sum', say: 'The entries always add up to zero: p adds up to one, and the one-hot vector takes exactly one away.', code: 'sum' },
        { id: 'step', say: 'So to lower the loss, move each score against its entry: the correct score goes up, and the others go down, the most confident wrong option the most.', code: 'step' },
        { id: 'done', say: 'And once the correct option gets nearly all the probability, the gradient is nearly zero: there is little loss left to remove.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

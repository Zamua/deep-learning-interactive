import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-advantage',
  title: 'Why a baseline is allowed',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'same',
      title: 'Same direction, less noise',
      codeTitle: 'baseline.py',
      code: `
        A = R - b    # 0.9 - 0.55 = 0.35        #@recall
        # (R - b) * g = R * g - b * g           #@sum
        pi = np.array([0.5, 0.3, 0.2])          #@check
        g = np.array([[0.5, -0.3, -0.2],  # 56  #@check
                      [-0.5, 0.7, -0.2],  # 54  #@check
                      [-0.5, -0.3, 0.8]]) # 64  #@check
        pi @ g      # [0, 0, 0]                 #@weigh
        # pi * grad log pi = grad pi            #@why
        # sum of grad pi = grad 1 = 0           #@why
        # so b * grad log pi averages to 0      #@zero
      `,
      beats: [
        { id: 'recall', say: 'A baseline, b, swaps each reward for its advantage, A, equal to R minus b. With b at {0.55|zero point five five}, a reward of {0.9|zero point nine} becomes {0.35|zero point three five}.', code: 'recall' },
        { id: 'sum', say: 'Why is this allowed? Subtracting b takes b times the gradient of ln {π|pi} off every estimate. Averaged over the model\'s answers, that part comes to zero. Check it on the seven times eight model.', code: 'sum' },
        { id: 'check', say: 'Its answers have probabilities {0.5|zero point five}, {0.3|zero point three} and {0.2|zero point two}, and each has its own gradient of ln {π|pi}: one row each, for fifty six, fifty four and sixty four.', code: 'check' },
        { id: 'weigh', say: 'Weight each row by its probability, and add down the columns. The first: {0.5|zero point five} times {0.5|zero point five}, plus {0.3|zero point three} times minus {0.5|zero point five}, plus {0.2|zero point two} times minus {0.5|zero point five}. That is {0.25|zero point two five}, minus {0.15|zero point one five}, minus {0.1|zero point one}: zero. The other columns cancel too.', code: 'weigh' },
        { id: 'why', say: 'That is no accident. {π|pi} times the gradient of its log is just the gradient of {π|pi}. And the probabilities always add up to one, so their gradients add up to zero: they cannot all rise at once.', code: 'why' },
        { id: 'zero', say: 'So b times the gradient of ln {π|pi} averages to zero, whatever b is. Each estimate just swings less.', code: 'zero' },
        { id: 'E', say: 'An average over the model\'s answers like this is written with a double-struck E, {𝔼|E}, for expected value. With b or without, the expected estimate is the same.', code: 'zero' },
        { id: 'best', say: 'The best baseline is the reward you expect for that very question: a running average of past rewards works, or a second model trained to predict it.' },
      ],
    },
    {
      id: 'try',
      title: 'Try one',
      codeTitle: 'cancel.py',
      code: `
        pi = np.array([0.5, 0.3, 0.2])          #@p1
        g = np.array([0.4, -1.0, x])  # theta 0 #@p1
        0.5 * 0.4 + 0.3 * -1.0     # -0.1       #@a1
        x = 0.1 / 0.2              # 0.5        #@a2
      `,
      beats: [
        { id: 'p1', say: 'Try one. A model\'s three answers have probabilities {0.5|zero point five}, {0.3|zero point three} and {0.2|zero point two}. For one parameter, {θ₀|theta zero}, {∂ln π/∂θ₀|partial ln pi, partial theta zero} is {0.4|zero point four} for the first answer and minus one for the second. What is it for the third?', code: 'p1' },
        { id: 'a1', say: 'Weighted by probability, the three add up to zero. The first two give {0.5|zero point five} times {0.4|zero point four}, which is {0.2|zero point two}, and {0.3|zero point three} times minus one, minus {0.3|zero point three}: together, minus {0.1|zero point one}.', code: 'a1' },
        { id: 'a2', say: 'So the third must bring plus {0.1|zero point one}. Divide by its probability: {0.1|zero point one} over {0.2|zero point two} is {0.5|zero point five}.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

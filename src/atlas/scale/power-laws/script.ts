import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-power-laws',
  title: 'Ten times the compute',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'tenfold',
      title: 'Ten times the compute',
      codeTitle: 'tenfold.py',
      code: `
        # log loss = log a - alpha * log compute  #@line
        alpha = 0.1                         #@step
        factor = 10 ** -alpha    # 0.79     #@ex
        3.16 * factor            # 2.51     #@ex
        3.16 * 10 ** (-2 * alpha)  # 2.00   #@hundred
        10 ** (-3 * alpha)       # 0.50     #@k
        # drops: 0.82, 0.65, 0.51           #@cost
        2.56 / 4         # 0.64 = 0.8 * 0.8  #@back
        10 ** 2          # 100x the compute  #@factors
      `,
      beats: [
        { id: 'line', say: 'On log-log axes, a scaling law is a straight line of slope minus {α|alpha}. With {α|alpha} at {0.1|zero point one}, each power of ten in compute moves log L down by {0.1|zero point one}.', code: 'line' },
        { id: 'step', say: 'In plain numbers, taking {α|alpha} off the log multiplies the loss by ten to the minus {α|alpha}.', code: 'step' },
        { id: 'ex', say: 'With {α|alpha} at {0.1|zero point one}, the factor is {0.79|zero point seven nine}. Ten times the compute takes a loss of {3.16|three point one six} down to {2.51|two point five one}.', code: 'ex' },
        { id: 'hundred', say: 'A hundred times the compute is two such steps: {0.79|zero point seven nine} times {0.79|zero point seven nine}. That is ten to the minus {0.1|zero point one}, twice, and multiplying adds the powers: ten to the minus {0.2|zero point two}, about {0.63|zero point six three}. The loss reaches about {2.00|two point zero}.', code: 'hundred' },
        { id: 'k', say: 'So k factors of ten in compute multiply the loss by ten to the minus k {α|alpha}. A thousand times the compute is three factors: ten to the minus {0.3|zero point three}, about a half.', code: 'k' },
        { id: 'cost', say: 'Each step takes the same fraction off a smaller loss, so the drops shrink: {0.82|zero point eight two}, then {0.65|zero point six five}, then {0.51|zero point five one}. Every gain asks for ten times the compute of the last.', code: 'cost' },
        { id: 'back', say: 'Run it backwards, too. Say each tenfold step multiplies the loss by {0.8|zero point eight}. How much more compute takes a loss of four down to {2.56|two point five six}? {2.56|Two point five six} over four is {0.64|zero point six four}, which is {0.8|zero point eight} times {0.8|zero point eight}: two factors.', code: 'back' },
        { id: 'factors', say: 'Each factor costs ten times the compute, so two of them cost ten times ten: a hundred times the compute.', code: 'factors' },
      ],
    },
    {
      id: 'try',
      title: 'A hundred times the compute, worked',
      codeTitle: 'try.py',
      code: `
        alpha, loss = 0.3, 3.6                #@p
        # 10**-0.3 ~ 0.50, 10**-0.6 ~ 0.25    #@p
        # 100x = 10 * 10: two factors of ten  #@two
        10**-0.3 * 10**-0.3   # 10**-0.6, 0.25  #@f
        3.6 * 0.25            # 0.90          #@ans
      `,
      beats: [
        { id: 'p', say: 'Try one. A family of models follows a scaling law with {α|alpha} at {0.3|zero point three}. One run ends at loss {3.6|three point six}. What loss does a run with a hundred times its compute reach? Use ten to the minus {0.3|zero point three} is about {0.50|zero point five}, and ten to the minus {0.6|zero point six} about {0.25|zero point two five}.', code: 'p' },
        { id: 'two', say: 'A hundred times the compute is two factors of ten.', code: 'two' },
        { id: 'f', say: 'Each multiplies the loss by ten to the minus {0.3|zero point three}. Multiplying adds the powers: ten to the minus {0.6|zero point six}, about {0.25|zero point two five}.', code: 'f' },
        { id: 'ans', say: 'So the loss becomes {3.6|three point six} times {0.25|zero point two five}: {0.90|zero point nine}.', code: 'ans' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

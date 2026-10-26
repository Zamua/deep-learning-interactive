import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-contrastive',
  title: 'Pull, push and temperature',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'push',
      title: 'Where the loss pushes',
      codeTitle: 'info_nce.py',
      code: `
        s = np.array([2, 0, 1])            #@recall
        p = softmax(s)  # [0.67, 0.09, 0.24]  #@recall
        loss = -np.log(p[0])  # 0.41       #@recall
        # s[2] enters only via e^1 = 2.72  #@nudge
        ds = p.copy()  # [0.67, 0.09, 0.24]  #@share
        ds[0] -= 1     # [-0.33, 0.09, 0.24] #@push
      `,
      beats: [
        { id: 'recall', say: 'Take a row whose scores are two, zero and one, the positive first. Its softmax is {0.67|zero point six seven}, {0.09|zero point zero nine} and {0.24|zero point two four}, and its loss is {0.41|zero point four one}.', code: 'recall' },
        { id: 'nudge', say: 'How hard does the loss push each negative? Candidate two\'s score enters the loss only through the total, as e to the one. e to the x is its own slope, so the total grows {2.72|two point seven two} times as fast as that score.', code: 'nudge' },
        { id: 'share', say: 'The log of the total grows one over the total as fast. So the loss\'s slope on that score is {2.72|two point seven two} over {11.11|eleven point one one}: {0.24|zero point two four}, its probability. Candidate one\'s slope is its probability too: {0.09|zero point zero nine}.', code: 'share' },
        { id: 'push', say: 'The positive\'s score is also subtracted on its own, so its slope is {0.67|zero point six seven} minus one. Lowering the loss pulls the positive in and pushes each negative away by its probability, the closer negative hardest. Every row takes its turn, and their losses are averaged.', code: 'push' },
      ],
    },
    {
      id: 'temperature',
      title: 'The temperature',
      codeTitle: 'temperature.py',
      code: `
        sim[0]        # [0.9, 0.1, 0.5]        #@sims
        sim[0] / 1.0  # p = [0.47, 0.21, 0.32] #@warm
        sim[0] / 0.1  # p = [0.98, 0.00, 0.02] #@cold
      `,
      beats: [
        { id: 'sharp', say: 'Take similarities of {0.9|zero point nine}, {0.1|zero point one} and {0.5|zero point five}. Divided by a temperature of one, the softmax stays soft: {0.47|zero point four seven} for the top. Divided by {0.1|zero point one}, the top takes {0.98|zero point nine eight}.', code: ['sims', 'warm', 'cold'] },
        { id: 'hard', say: 'A small temperature also aims the push. Each negative is pushed by its probability. Divided by one, the negatives hold {0.21|zero point two one} and {0.32|zero point three two}, close to even. Divided by {0.1|zero point one}, the one at {0.5|zero point five} holds {0.02|zero point zero two} and the other almost none: nearly all the push lands on the negative most like the anchor.', code: ['warm', 'cold'] },
      ],
    },
    {
      id: 'worked',
      title: 'One row\'s slopes',
      codeTitle: 'slopes.py',
      code: `
        s = np.array([2, 1, 1])   # positive: 0     #@ask
        e = np.exp(s)  # [7.39, 2.72, 2.72]         #@exps
        total = e.sum()           # 12.83           #@exps
        e[1] / total              # 0.21            #@neg
        e[0] / total - 1          # -0.42           #@pos
      `,
      beats: [
        { id: 'ask', say: 'One more row. The positive is candidate zero, and the scores are two, one and one. What is the loss\'s slope on candidate one\'s score?', code: 'ask' },
        { id: 'exps', say: 'The exponentials are {7.39|seven point three nine}, {2.72|two point seven two} and {2.72|two point seven two}: a total of {12.83|twelve point eight three}.', code: 'exps' },
        { id: 'neg', say: 'Candidate one is a negative, so its slope is its probability: {2.72|two point seven two} over {12.83|twelve point eight three}, {0.21|zero point two one}.', code: 'neg' },
        { id: 'pos', say: 'The positive\'s slope would be its probability minus one: {0.58|zero point five eight} minus one, {−0.42|minus zero point four two}.', code: 'pos' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

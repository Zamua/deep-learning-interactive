import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-contrastive',
  title: 'Pull, push and temperature',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Wang & Isola', year: 2020, title: 'Understanding contrastive representation learning through alignment and uniformity on the hypersphere', url: 'https://arxiv.org/abs/2005.10242', scene: 'pull' },
    { who: 'Wang & Liu', year: 2021, title: 'Understanding the behaviour of contrastive loss', url: 'https://arxiv.org/abs/2012.09740', scene: 'temperature' },
  ],
  scenes: [
    {
      id: 'pull',
      title: 'Which way does each view move?',
      codeTitle: 'row.py',
      code: `
        sim = np.array([0.8, 0.0, 0.4])  #@sim
        # 0: positive; 1, 2: negatives   #@sim
        tau = 0.4                        #@s
        s = sim / tau    # [2, 0, 1]     #@s
        p = softmax(s)   # p[0] = 0.67   #@loss
        loss = -np.log(p[0])   # 0.41    #@loss
        # lower it: s[0] up, s[1:] down  #@move
      `,
      beats: [
        { id: 'anchor', say: 'Back on the circle of unit vectors. The view a row belongs to is its anchor: the fixed point the whole row is measured from.', code: 'sim' },
        { id: 'cands', say: 'Its positive sits close, at a similarity of {0.8|zero point eight}. Two negatives, views of other images, sit at zero and {0.4|zero point four}.', code: 'sim' },
        { id: 'ask', say: 'Training lowers the loss. As it does, which way does each of them move?', code: 'loss' },
        { id: 'low', say: 'The loss is low when the positive holds most of the probability. So lowering it raises the positive\'s score, and lowers each negative\'s.', code: 'move' },
        { id: 'move', say: 'A higher score is a higher similarity: an arrow turned toward the anchor. So the positive is pulled in, and the negatives are pushed away.', code: 'move' },
        { id: 'names', say: 'In 2020, Tongzhou Wang and Phillip Isola named the two effects: alignment, positive pairs pulled together, and uniformity, all the views spread evenly around the circle. With enough negatives, they proved, the loss aims for both.', code: 'move' },
        { id: 'how', say: 'But the negatives are not pushed equally. How hard each is pushed is the loss\'s slope on its score.', code: 'move' },
      ],
    },
    {
      id: 'slopes',
      title: 'Each push is a probability',
      codeTitle: 'slopes.py',
      code: `
        s = np.array([2, 0, 1])          #@s
        e = np.exp(s)  # [7.39, 1, 2.72] #@e
        total = e.sum()       # 11.11    #@e
        loss = np.log(total) - s[0]      #@loss
        p = e / total  # [0.67, 0.09, 0.24]  #@p
        ds = p.copy()  # negatives: p    #@neg
        ds[0] -= 1     # positive: p - 1 #@pos
      `,
      beats: [
        { id: 'row', say: 'In numbers: divided by the temperature, {0.4|zero point four}, the similarities become scores of two, zero and one.', code: 's' },
        { id: 'loss', say: 'As cross-entropy, the loss is the log of the total, {11.11|eleven point one one}, minus the score of the positive: {0.41|zero point four one}.', code: ['e', 'loss'] },
        { id: 'nudge', say: 'Now nudge candidate two\'s score up. It reaches the loss only through the total, as e to the one: e to the x is its own slope, so the total grows {2.72|two point seven two} times as fast as the score.', code: 'e' },
        { id: 'share', say: 'And the log of a number grows one over that number as fast. So the loss grows {2.72|two point seven two} over {11.11|eleven point one one} as fast: {0.24|zero point two four}.', code: 'loss' },
        { id: 'is-p', say: 'That is candidate two\'s probability. For every negative, the slope is its probability: for candidate one, {0.09|zero point zero nine}.', code: ['p', 'neg'] },
        { id: 'pos', say: 'The positive is in the total as well, but the loss also subtracts its score, which takes off one: its slope is {0.67|zero point six seven} minus one, which is {−0.33|minus zero point three three}.', code: 'pos' },
        { id: 'step', say: 'Training steps each score against its slope: the negatives\' scores go down, a push, and the positive\'s goes up, a pull.', code: ['neg', 'pos'] },
        { id: 'order', say: 'The closer negative holds more probability, so it is pushed hardest: the slopes follow the scores, and the positive comes last.', code: 'neg' },
      ],
    },
    {
      id: 'temperature',
      title: 'Where the temperature aims',
      codeTitle: 'temperature.py',
      code: `
        sim = np.array([0.8, 0.0, 0.4])  #@sim
        tau = {{tau:0.4}}                #@tau
        p = softmax(sim / tau)           #@tau
        # each negative's share of push  #@share
        p[1:] / p[1:].sum()  # {{share:[0.27, 0.73]}}  #@share
      `,
      beats: [
        { id: 'circle', say: 'On the circle, draw each slope as an arrow. The pushes, {0.09|zero point zero nine} and {0.24|zero point two four}, add up to the pull, {0.33|zero point three three}.', code: 'share' },
        { id: 'hard', say: 'The closer negative takes {0.24|zero point two four} of it, almost three quarters. A negative this close to the anchor is called a hard negative: it is hard to tell apart from the positive.', code: 'share' },
        { id: 'warm', say: 'Raise the temperature, tau, to one. The gaps between the scores narrow, the softmax flattens, and the push is split more evenly: {0.6|zero point six} and {0.4|zero point four}.', code: ['tau', 'share'] },
        { id: 'cold', say: 'Lower it to {0.1|zero point one}, and every gap stretches tenfold. The softmax turns sharp, and the hard negative takes {0.98|zero point nine eight} of the push.', code: ['tau', 'share'] },
        { id: 'unit', say: 'The vectors never move, and stay length one: tau only rescales the scores, and with them their gaps.', code: 'tau' },
        { id: 'aware', say: 'Feng Wang and Huaping Liu showed in 2021 that the contrastive loss is hardness-aware, and that the temperature sets how hard it presses on the hard negatives.', code: 'share' },
      ],
    },
    {
      id: 'worked',
      title: 'One row, worked',
      codeTitle: 'worked.py',
      code: `
        # the positive is candidate 1    #@ask
        s = np.array([1, 2, 1])          #@ask
        e = np.exp(s)  # [2.72, 7.39, 2.72]  #@exps
        total = e.sum()       # 12.83    #@exps
        e[0] / total      # 0.21: negative   #@neg
        e[1] / total - 1  # -0.42: positive  #@pos
      `,
      beats: [
        { id: 'ask', say: 'One more: the positive is candidate one, and the scores are one, two and one. What is the slope on candidate zero?', code: 'ask' },
        { id: 'neg', say: 'Candidate zero is a negative, so the slope is its probability: {2.72|two point seven two} over the total, {12.83|twelve point eight three}, which is {0.21|zero point two one}.', code: ['exps', 'neg'] },
        { id: 'pos', say: 'For the positive, the slope is its probability minus one: {0.58|zero point five eight} minus one, which is {−0.42|minus zero point four two}.', code: 'pos' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

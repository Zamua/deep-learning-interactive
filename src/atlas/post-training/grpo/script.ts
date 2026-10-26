import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-grpo',
  title: 'GRPO',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'group',
      title: 'A baseline from the group',
      codeTitle: 'grpo.py',
      code: `
        group = [sample(pi, q) for _ in range(8)]  #@group
        r = np.array([1, 0, 0, 1, 0, 0, 1, 0])     #@r
        r.mean()        # 0.375: the baseline      #@mean
        r - r.mean()    # right 0.625, wrong -0.375 #@sub
        r.std()         # 0.484                    #@std
        A = (r - r.mean()) / (r.std() + 1e-4)      #@A
        # right: 0.625 / 0.484 = 1.29              #@A
        # wrong: -0.375 / 0.484 = -0.77            #@A
      `,
      beats: [
        { id: 'value', say: 'A good baseline is the reward you expect for this very question. One way to get it is to train a second model to predict it: a value model, a whole second network to train.' },
        { id: 'group', say: 'GRPO does without it. For each question, sample a group of G answers, here eight, and check each one: a reward, r, of one if it is right, zero if it is wrong.', code: ['group', 'r'] },
        { id: 'mean', say: 'The group\'s mean reward is the baseline. Three of the eight are right, so it is {0.375|zero point three seven five}.', code: 'mean' },
        { id: 'sub', say: 'Subtract it, as with any baseline. A right answer is one minus {0.375|zero point three seven five}: {0.625|zero point six two five} above it. A wrong one is {0.375|zero point three seven five} below.', code: 'sub' },
        { id: 'std', say: 'Then divide by the group\'s standard deviation, how spread out its rewards are: here about {0.484|zero point four eight four}. That puts every question\'s advantages on a similar scale.', code: 'std' },
        { id: 'adv', say: 'Right answers get {0.625|zero point six two five} over {0.484|zero point four eight four}: {1.29|one point two nine}. Wrong ones get minus {0.375|zero point three seven five} over {0.484|zero point four eight four}: minus {0.77|zero point seven seven}. Each advantage is r minus the mean, over the standard deviation.', code: 'A' },
      ],
    },
    {
      id: 'agree',
      title: 'When the group agrees',
      codeTitle: 'grpo.py',
      code: `
        r = [1, 0, 0, 0, 0, 0, 0, 0]   # 1 of 8    #@hard
        r = [1, 1, 1, 1, 1, 1, 1, 0]   # 7 of 8    #@easy
        r = np.ones(8)       # all right           #@all
        r - r.mean()         # all zeros: no push  #@all
        # std = 0, so + 1e-4 keeps 0 / 0 at 0      #@eps
      `,
      beats: [
        { id: 'hard', say: 'A right answer to a hard question, where only one of eight succeeds, earns a big push: {2.65|two point six five}. On an easy one, where seven of eight do, each right answer gets only {0.38|zero point three eight}.', code: ['hard', 'easy'] },
        { id: 'easy', say: 'If every answer in the group is right, each reward equals the mean, and every advantage is zero.', code: 'all' },
        { id: 'none', say: 'Such a group teaches nothing, and the same goes when every answer is wrong. The standard deviation is zero then, so code adds a tiny number to it, and zero divided by that stays zero.', code: 'eps' },
        { id: 'sum', say: 'Within any group, the advantages add up to zero: probability moves from the worse answers to the better ones.' },
        { id: 'cost', say: 'There is no value model to train. The price is sampling several answers for every question.' },
      ],
    },
    {
      id: 'try',
      title: 'Try one',
      codeTitle: 'grpo.py',
      code: `
        r = np.array([0, 1, 0, 0, 0])   # G = 5        #@p1
        r.std()            # 0.4                       #@p1
        r.mean()           # 1 / 5 = 0.2               #@mean
        r[1] - r.mean()    # 1 - 0.2 = 0.8             #@sub
        0.8 / 0.4          # 2.0                       #@div
        (r - 0.2) / 0.4    # [-0.5, 2, -0.5, -0.5, -0.5]  #@all
      `,
      beats: [
        { id: 'p1', say: 'Try one. GRPO samples five answers, with rewards zero, one, zero, zero and zero, and a standard deviation of {0.4|zero point four}. What is the advantage of answer one, counting from zero?', code: 'p1' },
        { id: 'mean', say: 'One of the five is right, so the mean is one fifth: {0.2|zero point two}.', code: 'mean' },
        { id: 'sub', say: 'Answer one got a reward of one: one minus {0.2|zero point two} is {0.8|zero point eight}.', code: 'sub' },
        { id: 'div', say: 'Divide by the standard deviation: {0.8|zero point eight} over {0.4|zero point four} is two.', code: 'div' },
        { id: 'all', say: 'Each wrong answer gets zero minus {0.2|zero point two}, over {0.4|zero point four}: minus {0.5|zero point five}. So the whole group\'s advantages are minus {0.5|zero point five}, two, then minus {0.5|zero point five} three more times.', code: 'all' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

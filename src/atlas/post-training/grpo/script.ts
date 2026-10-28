import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-grpo',
  title: 'GRPO',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Shao et al.', year: 2024, title: 'DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models', url: 'https://arxiv.org/abs/2402.03300', scene: 'expect' },
  ],
  scenes: [
    {
      id: 'expect',
      title: 'A baseline for each question',
      codeTitle: 'baseline.py',
      code: `
        # 8 answers each; r = 1 if right   #@r
        easy = np.array([1,1,1,0,1,1,1,1]) #@easy
        hard = np.array([0,0,1,0,0,0,0,0]) #@hard
        # baseline: a value model's guess? #@value
        easy.mean()   # 7 / 8 = 0.875      #@mean
        hard.mean()   # 1 / 8 = 0.125      #@mean
      `,
      beats: [
        { id: 'two', say: 'A model answers two questions, eight times each. A checker gives each answer a reward, r: one if it is right, zero if it is wrong.', code: 'r' },
        { id: 'news', say: '{7 × 8|Seven times eight} is easy for it: seven of its eight answers are right. {17 × 24|Seventeen times twenty four} is hard: just one is.', code: ['easy', 'hard'] },
        { id: 'worth', say: 'A right answer to the hard one is news, worth a big push. On the easy one, it is what the model does anyway.', code: 'hard' },
        { id: 'same', say: 'A baseline is the reward you expected. One baseline shared by every question would push those two alike, so each question needs its own.', code: ['easy', 'hard'] },
        { id: 'value', say: 'One way is to train a second network to predict it: a value model, since a question\'s value is the reward it is expected to bring.', code: 'value' },
        { id: 'cost', say: 'In 2024, Zhihong Shao and colleagues at DeepSeek pointed out the cost: that network is usually about as big as the model itself.', code: 'value' },
        { id: 'group', say: 'Their way needs no second network: the mean reward of the question\'s own group of answers is its baseline. Seven eighths here, one eighth there.', code: 'mean' },
        { id: 'name', say: 'They called it GRPO, for group relative policy optimization. It improves the policy, the model\'s rule for answering, by judging each answer relative to its own group.', code: 'mean' },
      ],
    },
    {
      id: 'curve',
      title: 'Measured against the group',
      codeTitle: 'grpo.py',
      code: `
        r = np.array([1,0,0,1,0,0,1,0])     #@r
        r.mean()       # 3 / 8 = 0.375      #@mean
        r - r.mean()   # 0.625 or -0.375    #@sub
        np.sqrt(((r - r.mean())**2).mean()) #@spread
        r.std()        # ≈ 0.484            #@std
        A = (r - r.mean()) / r.std()        #@A
        # right: 0.625 / 0.484 ≈ 1.29       #@right
        # wrong: -0.375 / 0.484 ≈ -0.77     #@wrong
      `,
      beats: [
        { id: 'r', say: 'Now one question, with a group of G answers. {DeepSeekMath|The DeepSeek Math paper} sampled sixty four; here there are eight, and three are right.', code: 'r' },
        { id: 'mean', say: 'Their mean reward is three eighths, {0.375|zero point three seven five}. Draw it as a level line through the rewards: the baseline.', code: 'mean' },
        { id: 'right', say: 'Subtract it, as with any baseline. Right answers sit {0.625|zero point six two five} above the line, and wrong ones {0.375|zero point three seven five} below.', code: 'sub' },
        { id: 'spread', say: 'How spread out is the group? Square each distance from the line, average the squares, and take the square root: the standard deviation, a typical distance from the mean.', code: 'spread' },
        { id: 'std', say: 'Here it is about {0.484|zero point four eight four}. Shade a band that far on either side of the line.', code: 'std' },
        { id: 'dright', say: 'Divide by it, to count each distance in standard deviations. A right answer: {0.625|zero point six two five} over {0.484|zero point four eight four}, about {1.29|one point two nine}.', code: 'right' },
        { id: 'dwrong', say: 'A wrong one: minus {0.375|zero point three seven five} over {0.484|zero point four eight four}, about minus {0.77|zero point seven seven}.', code: 'wrong' },
        { id: 'A', say: 'That is GRPO\'s advantage, A: each reward, minus the group\'s mean, over the group\'s standard deviation.', code: 'A' },
        { id: 'curve', say: 'It is grading on a curve, each answer marked against its own group, so the scale of the rewards drops out: pay ten for a right answer instead of one, and every advantage stays the same.', code: 'A' },
      ],
    },
    {
      id: 'agree',
      title: 'Hard, easy, and all alike',
      codeTitle: 'grpo.py',
      code: `
        hard = np.array([0,0,1,0,0,0,0,0])    #@hard
        # std ≈ 0.331; right: 2.65            #@hard
        easy = np.array([1,1,1,0,1,1,1,1])    #@easy
        # right: 0.38; wrong: -2.65           #@easy
        r = np.ones(8)    # all right         #@all
        r - r.mean()      # all 0             #@all
        A = (r - r.mean()) / (r.std() + 1e-4) #@eps
        # in any group, A adds up to 0        #@sum
      `,
      beats: [
        { id: 'hard', say: 'Back to the hard question: mean one eighth, standard deviation about {0.33|zero point three three}. Its one right answer gets about {2.65|two point six five}, a big push.', code: 'hard' },
        { id: 'easy', say: 'On the easy one, each right answer gets only about {0.38|zero point three eight}, and the wrong one about minus {2.65|two point six five}.', code: 'easy' },
        { id: 'all', say: 'If every answer is right, each reward equals the mean, and every advantage is zero: the group teaches nothing. All wrong, the same.', code: 'all' },
        { id: 'eps', say: 'The standard deviation is zero then, so code adds a tiny number to it, and zero divided by that stays zero.', code: 'eps' },
        { id: 'sum', say: 'In every group, the advantages add up to zero: probability moves from the worse answers to the better ones.', code: 'sum' },
        { id: 'cost', say: 'So GRPO trains no value model. Its price is a whole group of answers for every question.' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

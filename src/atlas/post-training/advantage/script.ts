import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-advantage',
  title: 'Why a baseline is allowed',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Williams', year: 1992, title: 'Simple statistical gradient-following algorithms for connectionist reinforcement learning', url: 'https://doi.org/10.1007/BF00992696', scene: 'cancel' },
  ],
  scenes: [
    {
      id: 'push',
      title: 'A baseline changes every push',
      codeTitle: 'baseline.py',
      code: `
        R = np.array([.9, .6, .5, .2])  #@R
        pg = R[i] * dlogpi  # all R > 0 #@R
        A = R - 0.55  # .35 .05 -.05 -.35 #@A
        pg = A[i] * dlogpi  # two flip  #@A
        # same average step as with R?  #@ask
      `,
      beats: [
        { id: 'pushes', say: 'A grader gives four sampled answers rewards of {0.9|zero point nine}, {0.6|zero point six}, {0.5|zero point five} and {0.2|zero point two}. Used as they are, every one pushes its answer up.', code: 'R' },
        { id: 'flip', say: 'Subtract a baseline, b, of {0.55|zero point five five}, and each push uses the advantage, A, equal to R minus b. Now the last two push down.', code: 'A' },
        { id: 'worry', say: 'So every single step changes. Does training still climb J, the expected reward, on average, or has b steered it somewhere else?', code: 'ask' },
        { id: 'one', say: 'It still climbs J, because a model\'s probabilities must always add up to one.', code: 'ask' },
      ],
    },
    {
      id: 'one',
      title: 'Probabilities share a total of one',
      codeTitle: 'share.py',
      code: `
        pi = np.array([.5, .3, .2])     #@pi
        pi.sum()           # always 1   #@pi
        # theta0 + 0.01:                #@nudge
        # pi = .5025, .2985, .199       #@nudge
        d = [.25, -.15, -.1]  # slopes  #@slopes
        sum(d)             # 0          #@zero
      `,
      beats: [
        { id: 'bars', say: 'Take the seven times eight model: fifty six half the time, fifty four three times in ten, and sixty four twice. Laid end to end, they fill exactly one.', code: 'pi' },
        { id: 'nudge', say: 'Raise {θ₀|theta zero}, the score of fifty six. Its share grows, so the other two must shrink: together they still make one.', code: 'nudge' },
        { id: 'slopes', say: 'Measure it as the log trick did, with a nudge of {0.01|zero point zero one}. Fifty six gains {0.0025|zero point zero zero two five}: a slope, {∂π/∂θ₀|partial pi, partial theta zero}, of {0.25|zero point two five}.', code: ['nudge', 'slopes'] },
        { id: 'others', say: 'The other two give that back: their slopes are minus {0.15|zero point one five} and minus {0.1|zero point one}.', code: ['nudge', 'slopes'] },
        { id: 'zero', say: 'Add the three, and you get zero. Whatever one probability gains, the others lose.', code: 'zero' },
        { id: 'always', say: 'That holds for any parameter and any number of answers. Know all the slopes but one, and the last is minus the sum of the rest.', code: 'zero' },
      ],
    },
    {
      id: 'cancel',
      title: 'The baseline\'s part cancels',
      codeTitle: 'cancel.py',
      code: `
        pi = np.array([.5, .3, .2])     #@pi
        dlog = d / pi   # .5, -.5, -.5  #@dlog
        part = b * dlog  # b's part     #@part
        pi @ part        # 0, any b     #@avg
        pi * dlog        # = d again    #@why
        # REINFORCE step:               #@name
        # step * (R - b) * dlog         #@name
      `,
      beats: [
        { id: 'dlog', say: 'The policy gradient uses slopes of ln {π|pi}, though: by the log trick, the slope of {π|pi} divided by {π|pi}. For fifty six, {0.25|zero point two five} over {0.5|zero point five} is {0.5|zero point five}.', code: 'dlog' },
        { id: 'rest', say: 'Fifty four and sixty four both come out at minus {0.5|zero point five}.', code: 'dlog' },
        { id: 'part', say: 'Subtracting b takes b times that slope off the estimate for whichever answer was drawn: plus {0.5|zero point five} times b for fifty six, and minus {0.5|zero point five} times b for the others.', code: 'part' },
        { id: 'avg', say: 'Average over the model\'s draws. Fifty six turns up half the time, bringing plus {0.5|zero point five} times b; the other two make up the other half, bringing minus {0.5|zero point five} times b. They cancel.', code: 'avg' },
        { id: 'why', say: 'That is no accident. Weighting by probability undoes the division: {π|pi} times the slope of ln {π|pi} is just the slope of {π|pi}. And those always add up to zero.', code: 'why' },
        { id: 'E', say: 'An average over the model\'s draws is written with a double-struck E, {𝔼|E}, for expected value. With b or without, the expected estimate is the same.', code: 'avg' },
        { id: 'noise', say: 'What b does change is each single estimate: good answers are pushed up and poor ones down, so the estimates swing less.' },
        { id: 'williams', say: 'Ronald Williams proved this in 1992, for any baseline that does not depend on the answer drawn.', code: 'name' },
        { id: 'name', say: 'He built the baseline into the name. REINFORCE stands for reward increment equals nonnegative factor, times offset reinforcement, times characteristic eligibility.', code: 'name' },
        { id: 'map', say: 'That is the step itself: a step size, times R minus b, times the slope of ln {π|pi} of the answer drawn.', code: 'name' },
      ],
    },
    {
      id: 'try',
      title: 'Try one',
      codeTitle: 'cancel.py',
      code: `
        pi = np.array([.5, .3, .2])     #@p1
        dlog = [0.4, -1.0, x]  # theta0 #@p1
        .5 * .4 + .3 * -1.0  # -0.1     #@a1
        x = 0.1 / 0.2        # 0.5      #@a2
      `,
      beats: [
        { id: 'p1', say: 'Try one. Three answers have probabilities {0.5|zero point five}, {0.3|zero point three} and {0.2|zero point two}. For a parameter {θ₀|theta zero}, {∂ln π/∂θ₀|partial ln pi, partial theta zero} is {0.4|zero point four} for answer zero, and minus one for answer one. What is it for answer two?', code: 'p1' },
        { id: 'a1', say: 'Weighted by probability, the three must add up to zero. The first two bring {0.2|zero point two} and minus {0.3|zero point three}: together, minus {0.1|zero point one}.', code: 'a1' },
        { id: 'a2', say: 'So answer two must bring plus {0.1|zero point one}. Divide by its probability: {0.1|zero point one} over {0.2|zero point two} is {0.5|zero point five}.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-log-trick',
  title: 'The log trick',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'sample',
      title: 'A reward for a sampled answer',
      codeTitle: 'reinforce.py',
      code: `
        pi = softmax(theta)  # [0.5, 0.3, 0.2]  #@pi
        ans = np.random.choice(3, p=pi)         #@sample
        R = 1.0 if ans == 0 else 0.0  # check   #@R
        J = 0.5 * 1 + 0.3 * 0 + 0.2 * 0  # 0.5  #@J
      `,
      beats: [
        { id: 'ask', say: 'A model answers a question by sampling. Asked seven times eight, it says fifty six half the time, fifty four three times in ten, and sixty four the rest: its probabilities, written with the Greek letter {π|pi}.', code: ['pi', 'sample'] },
        { id: 'reward', say: 'A checker scores each answer: a reward, R, of one when it is right and zero when it is wrong. It is just a number, with nothing to differentiate.', code: 'R' },
        { id: 'goal', say: 'Training should raise the expected reward, J: each answer\'s probability times its R, added up. Here {0.5|zero point five} times one, plus zeros: {0.5|zero point five}. Its gradient would say how to change the model\'s parameters, written {θ|theta}.', code: 'J' },
        { id: 'stuck', say: 'But {θ|theta} reaches the reward only through which answer gets sampled, and a random draw has no slope.', code: 'sample' },
      ],
    },
    {
      id: 'trick',
      title: 'The log trick',
      codeTitle: 'trick.py',
      code: `
        # J = sum over y of pi(y) * R(y)            #@sum
        # grad J = sum over y of R(y) * grad pi(y)  #@sum
        pi[0]                    # 0.5              #@one
        dpi = 0.0025 / 0.01      # 0.25             #@nudge
        dlogpi = dpi / pi[0]     # 0.25 / 0.5 = 0.5 #@chain
        dpi = pi[0] * dlogpi     # 0.5 * 0.5 = 0.25 #@back
        # grad pi(y) = pi(y) * grad log pi(y)       #@trick
      `,
      beats: [
        { id: 'sum', say: 'Write J as a sum over every answer y: {π(y)|pi of y} times {R(y)|R of y}. Only the probabilities depend on {θ|theta}, so the gradient of J is each reward times the gradient of its probability.', code: 'sum' },
        { id: 'one', say: 'Take one answer and one parameter. Here {θ|theta} is three scores, one per answer, through a softmax. {θ₀|theta zero} is the first, the score of fifty six, whose probability is {0.5|zero point five}.', code: 'one' },
        { id: 'nudge', say: 'Nudge {θ₀|theta zero} up by {0.01|zero point zero one}, and {π(56)|pi of fifty six} rises to {0.5025|zero point five oh two five}: a slope of {0.25|zero point two five}, written {∂π/∂θ₀|partial pi, partial theta zero}.', code: 'nudge' },
        { id: 'chain', say: 'Now the slope of its log. ln {π|pi} is ln u, with {π|pi} as the inside, u. The slope of ln u is one over u, so by the chain rule, {∂ln π/∂θ₀|partial ln pi, partial theta zero} is {∂π/∂θ₀|partial pi, partial theta zero} divided by {π|pi}: {0.25|zero point two five} over {0.5|zero point five}, which is {0.5|zero point five}.', code: 'chain' },
        { id: 'back', say: 'Run it backwards: the slope of {π|pi} is {π|pi} times the slope of its log. {0.5|zero point five} times {0.5|zero point five} gives back {0.25|zero point two five}.', code: 'back' },
        { id: 'trick', say: 'That holds for every answer and every parameter: the gradient of {π|pi} is {π|pi} times the gradient of ln {π|pi}. This is the log trick.', code: 'trick' },
      ],
    },
    {
      id: 'try',
      title: 'Try one',
      codeTitle: 'trick.py',
      code: `
        pi_y = 0.2                               #@p1
        dpi = 0.16           # slope of pi(y)    #@p1
        dlogpi = dpi / pi_y  # 0.16 / 0.2 = 0.8  #@a1
      `,
      beats: [
        { id: 'p1', say: 'Try one. For one parameter, {θ₀|theta zero}, an answer y has {π(y)|pi of y} of {0.2|zero point two}, and {∂π/∂θ₀|partial pi, partial theta zero} of {0.16|zero point one six}. What is {∂ln π/∂θ₀|partial ln pi, partial theta zero}?', code: 'p1' },
        { id: 'a1', say: 'Divide the slope of {π|pi} by {π|pi}: {0.16|zero point one six} over {0.2|zero point two} is {0.8|zero point eight}.', code: 'a1' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-log-trick',
  title: 'The log trick',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Williams', year: 1992, title: 'Simple statistical gradient-following algorithms for connectionist reinforcement learning', url: 'https://doi.org/10.1007/BF00992696', scene: 'average' },
  ],
  scenes: [
    {
      id: 'model',
      title: 'A model that samples',
      codeTitle: 'reinforce.py',
      code: `
        theta = np.array([0, -.51, -.92])  #@theta
        pi = softmax(theta)   # .5 .3 .2   #@pi
        ans = np.random.choice(3, p=pi)    #@draw
        R = 1.0 if ans == 0 else 0.0       #@R
      `,
      beats: [
        { id: 'stuck', say: 'Training should make a model give the right answer more often. But many models pick each answer at random, and a random draw has no slope for training to follow.', code: 'draw' },
        { id: 'ask', say: 'Ask a model seven times eight, and it does not always give the same answer. It samples: fifty six half the time, fifty four three times in ten, and sixty four the rest. Those are its probabilities, written {π|pi}.', code: ['pi', 'draw'] },
        { id: 'reward', say: 'A checker marks each answer: one if it is right, zero if it is wrong. That mark is the reward, R: a plain number, from outside the model.', code: 'R' },
        { id: 'theta', say: 'Training should make the right answer come up more often, and all it can change are the model\'s weights. Here they are three scores, one per answer, which a softmax turns into the probabilities. Numbers that training changes are called parameters, written {θ|theta}.', code: ['theta', 'pi'] },
      ],
    },
    {
      id: 'average',
      title: 'No slope, until you average',
      codeTitle: 'reinforce.py',
      code: `
        # one draw: R is 1 or 0, no slope  #@one
        J = np.mean(Rs)   # many draws     #@avg
        J = .5*1 + .3*0 + .2*0   # 0.5     #@J
        J = .5*1 + .3*0 + .2*-1  # 0.3     #@any
        # grad J = sum R(y) * grad pi(y)   #@grad
      `,
      beats: [
        { id: 'nudge', say: 'The usual tool for improving a model is the gradient: nudge a parameter, and watch the result move. So slide {θ₀|theta zero}, the score of fifty six, along this axis, and draw one answer at each setting.', code: 'one' },
        { id: 'jump', say: 'Each draw is right or wrong, so every reward sits at one or at zero, scattered by chance. Nudge {θ₀|theta zero} a hair, and the reward does not slide: it stays put, or it jumps. A random draw has no slope.', code: 'one' },
        { id: 'avg', say: 'But average many draws at each setting, and the jumps smooth into a curve. That average is the expected reward, J. Ronald Williams made it the goal in 1992, for networks whose outputs are random.', code: 'avg' },
        { id: 'J', say: 'Over many draws, each answer turns up as often as its probability, so J is each probability times its reward, added up. Here, {0.5|zero point five} times one, plus zeros: {0.5|zero point five}.', code: 'J' },
        { id: 'any', say: 'Rewards can be any numbers. Mark sixty four, the worst miss, as minus one, and J drops: {0.5|zero point five} minus {0.2|zero point two} is {0.3|zero point three}.', code: 'any' },
        { id: 'only', say: 'The rewards come from the checker and never move. Only the probabilities move with {θ|theta}, so the gradient of J is each reward times the gradient of its probability, added up.', code: 'grad' },
        { id: 'lost', say: 'But look: no probability weighs those terms any more. J was an average over draws; its gradient, written this way, is not.', code: 'grad' },
      ],
    },
    {
      id: 'trick',
      title: 'The slope of a log',
      codeTitle: 'trick.py',
      code: `
        # theta0: 0, then 0.01            #@nudge
        # pi(56): 0.5, then 0.5025        #@nudge
        dpi = 0.0025 / 0.01    # 0.25     #@dpi
        dlogpi = 0.005 / 0.01  # 0.5      #@dlog
        dlogpi = dpi / pi      # .25/.5   #@rule
        dpi = pi * dlogpi      # .5*.5    #@back
        # grad pi = pi * grad ln pi       #@trick
      `,
      beats: [
        { id: 'two', say: 'A small identity puts that probability back, and it comes from the slope of a log. On the left, {π(56)|pi of fifty six} against {θ₀|theta zero}: an S that climbs as the score climbs. On the right, its log, ln {π|pi}.', code: 'nudge' },
        { id: 'nudge', say: 'Nudge {θ₀|theta zero} up by {0.01|zero point zero one}. {π(56)|pi of fifty six} was {0.5|zero point five}; now it is {0.5025|zero point five oh two five}.', code: 'nudge' },
        { id: 'dpi', say: 'It rose {0.0025|zero point zero zero two five} for a step of {0.01|zero point zero one}: a slope of {0.25|zero point two five}, written {∂π/∂θ₀|partial pi, partial theta zero}.', code: 'dpi' },
        { id: 'dlog', say: 'Its log rose {0.005|zero point zero zero five}, twice as much: a slope of {0.5|zero point five}, written {∂ln π/∂θ₀|partial ln pi, partial theta zero}.', code: 'dlog' },
        { id: 'why', say: 'Why twice? A log counts growth relative to size. {π|pi} grew by half a percent of itself, and its log grew by about that fraction: {0.005|zero point zero zero five}.', code: 'dlog' },
        { id: 'rule', say: 'That is the chain rule: the slope of ln u is one over u, so the slope of ln {π|pi} is the slope of {π|pi}, divided by {π|pi}. {0.25|zero point two five} over {0.5|zero point five} is {0.5|zero point five}.', code: 'rule' },
        { id: 'trick', say: 'It holds for every answer and every parameter, for slopes up or down: the gradient of {π|pi} is {π|pi} times the gradient of ln {π|pi}. This is the log trick.', code: ['back', 'trick'] },
        { id: 'payoff', say: 'Put it into the gradient of J, and each term gets its probability back: {π|pi}, times R, times the gradient of ln {π|pi}. The gradient is a probability-weighted sum again, just like J.', code: 'trick' },
      ],
    },
    {
      id: 'try',
      title: 'Try one',
      codeTitle: 'trick.py',
      code: `
        pi_y = 0.2                          #@p1
        dpi = 0.16          # slope of pi   #@p1
        dlogpi = dpi / pi_y # .16/.2 = .8   #@a1
      `,
      beats: [
        { id: 'p1', say: 'Try one. For one parameter, {θ₀|theta zero}, an answer y has {π(y)|pi of y} of {0.2|zero point two}, and {∂π/∂θ₀|partial pi, partial theta zero} of {0.16|zero point one six}. What is {∂ln π/∂θ₀|partial ln pi, partial theta zero}?', code: 'p1' },
        { id: 'a1', say: 'Divide the slope of {π|pi} by {π|pi}: {0.16|zero point one six} over {0.2|zero point two} is {0.8|zero point eight}. The smaller the probability, the steeper its log.', code: 'a1' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

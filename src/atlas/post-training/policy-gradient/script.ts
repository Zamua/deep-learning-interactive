import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-policy-gradient',
  title: 'Policy gradients',
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
        { id: 'ask', say: 'A model answers a question by sampling. Asked seven times eight, it says fifty six half the time, fifty four three times in ten, and sixty four the rest.', code: ['pi', 'sample'] },
        { id: 'reward', say: 'A checker scores each answer: a reward, R, of one when it is right and zero when it is wrong. It is just a number, with nothing to differentiate.', code: 'R' },
        { id: 'goal', say: 'Training should raise the expected reward: the average R over the model\'s answers, here {0.5|zero point five}. Its gradient would say how to change the parameters, {θ|theta}.', code: 'J' },
        { id: 'stuck', say: 'But {θ|theta} reaches the reward only through which answer gets sampled, and a random draw has no slope.', code: 'sample' },
      ],
    },
    {
      id: 'trick',
      title: 'The log trick',
      codeTitle: 'reinforce.py',
      code: `
        # J = sum over y of pi(y) * R(y)          #@sum
        # grad pi(y) = pi(y) * grad log pi(y)     #@trick
        # grad J = average, over sampled y,       #@avg
        #          of R(y) * grad log pi(y)       #@avg
        pg = R * grad_logp(ans)  # one sample     #@est
        # ans = 56, R = 1: [0.5, -0.3, -0.2]      #@est
      `,
      beats: [
        { id: 'sum', say: 'Write the expected reward as a sum over answers: each answer\'s probability times its reward. Only the probabilities depend on {θ|theta}.', code: 'sum' },
        { id: 'trick', say: 'Now the trick. The slope of log {π|pi} is the slope of {π|pi} divided by {π|pi}. So the gradient of {π|pi} is {π|pi} times the gradient of its log.', code: 'trick' },
        { id: 'avg', say: 'Put that in, and the gradient of the expected reward becomes a sum of {π|pi} times R times the gradient of log {π|pi}: an average over the model\'s own answers.', code: 'avg' },
        { id: 'est', say: 'So sample one answer, and multiply its reward by the gradient of its log-probability. That one sample is an estimate of the gradient: the policy gradient.', code: 'est' },
        { id: 'eg', say: 'For fifty six, this model\'s gradient of log {π|pi} is {0.5|zero point five}, minus {0.3|zero point three}, minus {0.2|zero point two}. With R equal to one, the estimate is that same vector.', code: 'est' },
      ],
    },
    {
      id: 'push',
      title: 'Which way it pushes',
      codeTitle: 'reinforce.py',
      code: `
        pg = R * grad_logp(ans)                 #@est
        theta = theta + 0.5 * pg   # uphill     #@step
        # R = 1: pi(56) 0.5 -> 0.59             #@up
        # R = 0: nothing moves                  #@zero
        # R = -1: pi(56) 0.5 -> 0.41            #@neg
        loss = -R * np.log(pi[ans])             #@loss
      `,
      beats: [
        { id: 'up', say: 'Step {θ|theta} a little along the estimate, and the log-probability of the sampled answer rises, in proportion to R. A rewarded fifty six becomes more likely.', code: ['step', 'up'] },
        { id: 'zero', say: 'A wrong answer gets R of zero, so its estimate is zero, and nothing moves.', code: 'zero' },
        { id: 'neg', say: 'A negative reward flips the step, and makes that answer less likely.', code: 'neg' },
        { id: 'loss', say: 'As a loss to minimize, it is minus R times log {π|pi} of the sample: cross-entropy on the model\'s own answer, weighted by its reward.', code: 'loss' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

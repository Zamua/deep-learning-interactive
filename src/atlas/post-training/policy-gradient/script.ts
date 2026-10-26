import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-policy-gradient',
  title: 'Policy gradients',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'avg',
      title: 'An average over samples',
      codeTitle: 'reinforce.py',
      code: `
        # grad pi(y) = pi(y) * grad log pi(y)                   #@recall
        # 0.25 = 0.5 * 0.5                                      #@recall
        # grad J = sum over y of pi(y) * R(y) * grad log pi(y)  #@avg
        #   = 0.5*1*g(56) + 0.3*0*g(54) + 0.2*0*g(64)          #@avg
        ys = np.random.choice(3, size=10, p=pi)                #@draws
        pg = np.mean([R(y) * grad_logp(y) for y in ys], 0)     #@draws
        pg = R * grad_logp(ans)  # one sample                  #@est
        # ans = 56, R = 1: [0.5, -0.3, -0.2]                    #@eg
      `,
      beats: [
        { id: 'recall', say: 'The log trick: the gradient of {π|pi} is {π|pi} times the gradient of ln {π|pi}. For fifty six, {0.25|zero point two five} is {0.5|zero point five} times {0.5|zero point five}.', code: 'recall' },
        { id: 'avg', say: 'The gradient of the expected reward, J, takes each answer\'s R times the gradient of its {π|pi}. Put the trick in, and each answer brings R times the gradient of ln {π|pi}, weighted by its probability. For seven times eight: {0.5|zero point five} times one, times the gradient for fifty six, plus {0.3|zero point three} times zero, plus {0.2|zero point two} times zero.', code: 'avg' },
        { id: 'draws', say: 'A real model has far too many answers to list. But drawing answers weights them for free: fifty six turns up in half the draws. So R times the gradient of ln {π|pi}, averaged over answers drawn from the model, written {y ∼ π|y drawn from pi}, is the gradient of J.', code: 'draws' },
        { id: 'est', say: 'Even one draw gives an estimate of it: the sampled answer\'s reward, times the gradient of its log-probability. That estimate is the policy gradient.', code: 'est' },
        { id: 'eg', say: 'For fifty six, this model\'s gradient of ln {π|pi} is {0.5|zero point five}, minus {0.3|zero point three}, minus {0.2|zero point two}. With R equal to one, the estimate is that same vector.', code: 'eg' },
      ],
    },
    {
      id: 'push',
      title: 'Which way it pushes, then try one',
      codeTitle: 'reinforce.py',
      code: `
        pg = R * grad_logp(ans)                 #@est
        theta = theta + 0.5 * pg   # uphill     #@step
        # R = 1: pi(56) 0.5 -> 0.59             #@up
        # R = 0: nothing moves                  #@zero
        # R = -1: pi(56) 0.5 -> 0.41            #@neg
        loss = -R * np.log(pi[ans])             #@loss
        pg1 = -1 * np.array([-0.5, 0.7, -0.2])  #@p1
        # [0.5, -0.7, 0.2]                      #@a1
        pg2 = 1 * np.array([0.5, -0.3, -0.2])   #@p2
        (pg1 + pg2) / 2    # [0.5, -0.5, 0]     #@a2
      `,
      beats: [
        { id: 'up', say: 'Step {θ|theta} a little along the estimate, and the log-probability of the sampled answer rises, in proportion to R. A rewarded fifty six becomes more likely.', code: ['step', 'up'] },
        { id: 'zero', say: 'A wrong answer gets R of zero, so its estimate is zero, and nothing moves.', code: 'zero' },
        { id: 'neg', say: 'A negative reward flips the step, and makes that answer less likely.', code: 'neg' },
        { id: 'loss', say: 'As a loss to minimize, it is minus R times log {π|pi} of the sample: cross-entropy on the model\'s own answer, weighted by its reward.', code: 'loss' },
        { id: 'p1', say: 'Try one. A checker gives minus one for a wrong answer, and the model samples fifty four. Its gradient of ln {π|pi} is minus {0.5|zero point five}, {0.7|zero point seven}, minus {0.2|zero point two}. What is the estimate?', code: 'p1' },
        { id: 'a1', say: 'Multiply each entry by R. Minus one flips every sign: {0.5|zero point five}, minus {0.7|zero point seven}, {0.2|zero point two}. It points where fifty four gets less likely.', code: 'a1' },
        { id: 'p2', say: 'Now average it with a second sample: fifty six, with R of one, whose estimate is {0.5|zero point five}, minus {0.3|zero point three}, minus {0.2|zero point two}.', code: 'p2' },
        { id: 'a2', say: 'Add the two entry by entry: one, minus one, and zero. Then halve: {0.5|zero point five}, minus {0.5|zero point five}, and zero.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

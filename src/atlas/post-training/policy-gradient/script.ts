import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-policy-gradient',
  title: 'Policy gradients',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Williams', year: 1992, title: 'Simple statistical gradient-following algorithms for connectionist reinforcement learning', url: 'https://doi.org/10.1007/BF00992696', scene: 'name' },
    { who: 'Sutton, McAllester, Singh & Mansour', year: 1999, title: 'Policy gradient methods for reinforcement learning with function approximation', url: 'https://papers.nips.cc/paper_files/paper/1999/hash/464d828b85b0bed98e80ade0a5c43b0f-Abstract.html', scene: 'name' },
  ],
  scenes: [
    {
      id: 'draws',
      title: 'Too many answers to add up',
      codeTitle: 'reinforce.py',
      code: `
        # grad J = sum over y of     #@sum
        #   pi(y) R(y) grad ln pi(y) #@sum
        ys = np.random.choice(3, 10, p=pi)  #@draws
        pg = R * grad_logp(ans)      #@est
      `,
      beats: [
        { id: 'sum', say: 'The log trick wrote the gradient of the expected reward, J, as a sum over every answer: its probability, times its reward, times the gradient of ln {π|pi}. For seven times eight, that is three terms.', code: 'sum' },
        { id: 'many', say: 'But a real model can write any sentence at all. That is far too many answers to list, let alone add up.', code: 'sum' },
        { id: 'draws', say: 'So learn from what the model actually says. Its own draws weigh every answer by its probability for free: fifty six turns up in half of them.', code: 'draws' },
        { id: 'est', say: 'Average R times the gradient of ln {π|pi} over its draws, and you get the gradient of J. Even one draw gives an estimate that is right on average: its reward, times the gradient of ln {π|pi} for {the answer drawn, y ∼ π|the answer drawn}.', code: 'est' },
      ],
    },
    {
      id: 'push',
      title: 'Push up what paid off',
      codeTitle: 'reinforce.py',
      code: `
        ans = 0                # drew 56     #@grad
        grad_logp(ans)  # [.5, -.3, -.2]    #@grad
        pg = R * grad_logp(ans)             #@est
        theta = theta + 0.5 * pg            #@step
        # R = 1: pi(56) 0.5 -> 0.59         #@up
        # R = 0: nothing moves              #@zero
        # R = -1: pi(56) 0.5 -> 0.41        #@neg
      `,
      beats: [
        { id: 'grad', say: 'Take one draw: fifty six. Nudging each score in turn, as the log trick did, gives the gradient of ln {π(56)|pi of fifty six}: {0.5|zero point five} for its own score, and minus {0.3|zero point three} and minus {0.2|zero point two} for the other two. Raising its own score helps it; raising the others hurts it.', code: 'grad' },
        { id: 'up', say: 'Fifty six is right, so R is one, and the estimate is that same vector. Step the scores a little along it, and fifty six becomes more likely.', code: ['est', 'step', 'up'] },
        { id: 'zero', say: 'Had the draw been wrong, with R of zero, the estimate would be zero, and nothing would move.', code: 'zero' },
        { id: 'neg', say: 'And a reward of minus one flips the step: the answer drawn becomes less likely. The sign of R alone sets the direction.', code: 'neg' },
      ],
    },
    {
      id: 'name',
      title: 'Why "policy"',
      codeTitle: 'reinforce.py',
      code: `
        pi = softmax(theta)  # the policy  #@policy
        ans = np.random.choice(3, p=pi)    #@policy
        pg = R * grad_logp(ans)            #@est
        theta = theta + 0.5 * pg           #@step
      `,
      beats: [
        { id: 'policy', say: 'Why is it called a policy gradient? A rule for choosing what to do is called a policy, like a shop\'s returns policy. A model that samples answers follows one: for seven times eight, say fifty six half the time.', code: 'policy' },
        { id: 'sutton', say: 'In 1999, Richard Sutton and three colleagues wrote such a policy as {π|pi}, the probability of each choice, set by parameters {θ|theta}, such as a network\'s weights. They called methods that climb the gradient of J with respect to those parameters policy gradient methods.', code: 'policy' },
        { id: 'williams', say: 'Among their examples was REINFORCE, published by Ronald Williams in 1992. In its simplest form, it steps each weight by the reward times the gradient of ln {π|pi} of what was drawn, and Williams proved that this step goes uphill on J, on average.', code: ['est', 'step'] },
      ],
    },
    {
      id: 'try',
      title: 'Try one',
      codeTitle: 'reinforce.py',
      code: `
        g54 = np.array([-0.5, 0.7, -0.2])  #@p1
        pg1 = -1 * g54  # [.5, -.7, .2]    #@a1
        pg2 = 1 * np.array([.5, -.3, -.2]) #@p2
        (pg1 + pg2) / 2  # [.5, -.5, 0]    #@a2
      `,
      beats: [
        { id: 'p1', say: 'Try one. The model draws fifty four, and the checker gives it minus one. Its gradient of ln {π|pi} is minus {0.5|zero point five}, {0.7|zero point seven}, minus {0.2|zero point two}. What is the estimate?', code: 'p1' },
        { id: 'a1', say: 'Multiply each entry by R. Minus one flips every sign: {0.5|zero point five}, minus {0.7|zero point seven}, {0.2|zero point two}. It points where fifty four gets less likely.', code: 'a1' },
        { id: 'p2', say: 'Now average it with a second draw: fifty six, with R of one, whose estimate is {0.5|zero point five}, minus {0.3|zero point three}, minus {0.2|zero point two}.', code: 'p2' },
        { id: 'a2', say: 'Add the two entry by entry: one, minus one, and zero. Then halve: {0.5|zero point five}, minus {0.5|zero point five}, and zero.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

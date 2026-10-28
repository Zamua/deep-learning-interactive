import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-prob-ratio',
  title: 'The probability ratio',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Kahn & Marshall', year: 1953, title: 'Methods of reducing sample size in Monte Carlo computations', url: 'https://doi.org/10.1287/opre.1.5.263', scene: 'ratio' },
    { who: 'Schulman, Levine, Moritz, Jordan & Abbeel', year: 2015, title: 'Trust Region Policy Optimization', url: 'https://arxiv.org/abs/1502.05477', scene: 'ratio' },
  ],
  scenes: [
    {
      id: 'stale',
      title: 'One batch, several updates',
      codeTitle: 'reuse.py',
      code: `
        ys = sample(pi_old, 10)  # slow     #@draws
        for step in range(4):    # reuse    #@loop
            ...          # update pi on ys  #@loop
        # pi: 0.5 0.3 0.2 -> 0.6 0.3 0.1    #@moved
        # fresh: 6, 3, 1; batch: 5, 3, 2    #@stale
      `,
      beats: [
        { id: 'draws', say: 'The policy gradient learns from the model\'s own draws. Draw ten answers from the seven times eight model, and each turns up about as often as its probability: fifty six comes up five times, fifty four three times, and sixty four twice.', code: 'draws' },
        { id: 'slow', say: 'Drawing long answers is slow, so take several gradient steps on the same batch. Each step is an update.', code: 'loop' },
        { id: 'old', say: 'Call the model that drew the batch {π_old|pi old}. It stays fixed, while the model being trained, {π|pi}, moves with every update.', code: ['draws', 'loop'] },
        { id: 'moved', say: 'Say one update leaves {π|pi} at {0.6|zero point six}, {0.3|zero point three} and {0.1|zero point one}. Drawn fresh from {π|pi}, fifty six would come up six times in ten, and sixty four once.', code: 'moved' },
        { id: 'stale', say: 'But this batch still holds five and two: it counts answers as {π_old|pi old} drew them.', code: 'stale' },
      ],
    },
    {
      id: 'ratio',
      title: 'Weigh each draw by a ratio',
      codeTitle: 'ratio.py',
      code: `
        rho = pi(ans) / pi_old(ans)        #@rho
        # 56: 0.6 / 0.5 = 1.2              #@w56
        # 64: 0.1 / 0.2 = 0.5              #@w64
        # 54: 0.3 / 0.3 = 1                #@w64
        # before any update: rho = 1       #@one
        pi_old = pi    # the next batch    #@next
      `,
      beats: [
        { id: 'fix', say: 'So weigh each draw by how much more {π|pi} likes it than {π_old|pi old} did: {π|pi} over {π_old|pi old}.', code: 'rho' },
        { id: 'w56', say: 'Fifty six had {0.5|zero point five}, and now has {0.6|zero point six}. {0.6|zero point six} over {0.5|zero point five} is {1.2|one point two}.', code: 'w56' },
        { id: 'six', say: 'So its five draws count as six, just as in a fresh batch.', code: 'w56' },
        { id: 'w64', say: 'Sixty four had {0.2|zero point two}, and now has {0.1|zero point one}, so each draw counts a half, and its two count as one. Fifty four kept {0.3|zero point three}, and counts once.', code: 'w64' },
        { id: 'rho', say: 'This weight is the probability ratio, written with the Greek letter {ρ|rho}. Before any update, {π|pi} is {π_old|pi old}, and every ratio is one.', code: ['rho', 'one'] },
        { id: 'kahn', say: 'Weighing draws like this is called importance sampling. Herman Kahn and Andrew Marshall described it in 1953, to make simulations cheaper.', code: 'rho' },
        { id: 'schulman', say: 'In 2015, John Schulman and colleagues used this ratio to train policies on draws from an older policy.', code: 'rho' },
        { id: 'next', say: 'When the updates are done, the trained model draws the next batch, and becomes the new {π_old|pi old}.', code: 'next' },
      ],
    },
    {
      id: 'objective',
      title: 'Ratio times advantage',
      codeTitle: 'objective.py',
      code: `
        # R: 1 for 56, else 0              #@R
        np.mean(Rs)          # 0.5         #@plain
        np.mean(rho * Rs)    # 0.6         #@J
        A = Rs - 0.5         # advantage   #@A
        rho * A    # 56: 1.2 * 0.5 = 0.6   #@term
        obj = np.mean(rho * A)             #@obj
      `,
      beats: [
        { id: 'J', say: 'As in the log trick, training raises J, the expected reward. With fifty six marked one and the rest zero, J is just the probability of fifty six.', code: 'R' },
        { id: 'plain', say: 'The batch\'s plain average reward is five in ten, {0.5|zero point five}: the J of {π_old|pi old}, not of {π|pi}.', code: 'plain' },
        { id: 'weighted', say: 'Weigh each reward by its ratio, and five draws counting {1.2|one point two} each, over ten, make {0.6|zero point six}: the J of {π|pi}.', code: 'J' },
        { id: 'obj', say: 'What training raises is called its objective. Here it is the batch\'s average of the ratio times the advantage, A, used in place of the reward as before.', code: ['A', 'obj'] },
        { id: 'term', say: 'With a baseline of {0.5|zero point five}, fifty six has an advantage of {0.5|zero point five}, so its term is {1.2|one point two} times {0.5|zero point five}: {0.6|zero point six}.', code: 'term' },
        { id: 'push', say: 'The others have an advantage of minus {0.5|zero point five}. Raising the objective pushes fifty six up and the other two down: A sets the direction, and the ratio how much each draw counts.', code: 'obj' },
      ],
    },
    {
      id: 'logs',
      title: 'Ratios from logs',
      codeTitle: 'logs.py',
      code: `
        0.5 ** 20     # 0.00000095        #@tiny
        logp_old = -12.4   # ln pi_old     #@lo
        logp = -12.7       # ln pi         #@lo
        logp - logp_old    # -0.3: ln rho  #@diff
        np.exp(-0.3)       # 0.74: rho     #@exp
      `,
      beats: [
        { id: 'tiny', say: 'A real answer is many tokens long, and its probability is theirs multiplied together: twenty tokens at a half each make less than one in a million.', code: 'tiny' },
        { id: 'logs', say: 'So code adds up their logs instead. Say an answer had {ln π_old|ln pi old} of minus {12.4|twelve point four}, and now has {ln π|ln pi} of minus {12.7|twelve point seven}.', code: 'lo' },
        { id: 'quot', say: 'The log of a quotient is the top\'s log minus the bottom\'s. So {ln ρ|ln rho} is minus {12.7|twelve point seven}, minus minus {12.4|twelve point four}: minus {0.3|zero point three}.', code: 'diff' },
        { id: 'exp', say: 'Then {ρ|rho} is e to the minus {0.3|zero point three}: about {0.74|zero point seven four}. Below one, so this answer became less likely.', code: 'exp' },
        { id: 'token', say: 'A single token\'s ratio works the same way: its new probability over its old one.', code: 'diff' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-prob-ratio',
  title: 'The probability ratio',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'ratio',
      title: 'Reuse a batch, weigh by a ratio',
      codeTitle: 'ppo.py',
      code: `
        batch = sample(pi_old)   # once: slow     #@batch
        for step in range(4):    # reuse it       #@loop
            rho = pi(tok) / pi_old(tok)           #@rho
            # 0.3 / 0.2 = 1.5                     #@eg
            rho = np.exp(logp - logp_old)         #@logs
            # exp(-12.7 + 12.4) = exp(-0.3)       #@lognum
            #   = 0.74                            #@lognum
            obj = rho * A                         #@obj
        pi_old = pi              # next batch     #@next
      `,
      beats: [
        { id: 'batch', say: 'Sampling is slow, so PPO samples a batch of answers once, then steps {θ|theta} along the estimate several times on it. Each step is an update.', code: ['batch', 'loop'] },
        { id: 'old', say: 'Call the model that sampled it {π_old|pi old}. It stays fixed for the whole batch, while the model being trained, {π|pi}, moves away from it with every update.', code: 'batch' },
        { id: 'next', say: 'When the batch is used up, the trained model samples the next batch, and becomes the new {π_old|pi old}.', code: 'next' },
        { id: 'rho', say: 'So each sampled token is weighed by its new probability over its old one, {π|pi} over {π_old|pi old}: a ratio, written with the Greek letter {ρ|rho}. Before any update, it is one.', code: 'rho' },
        { id: 'eg', say: 'If {π_old|pi old} gave a token {0.2|zero point two} and {π|pi} now gives it {0.3|zero point three}, its ratio is {1.5|one point five}.', code: ['rho', 'eg'] },
        { id: 'logs', say: 'An answer\'s probability is tiny, so code keeps logs. Say {ln π_old|ln pi old} was minus {12.4|twelve point four}, and {ln π|ln pi} is now minus {12.7|twelve point seven}.', code: 'logs' },
        { id: 'lognum', say: 'The log of a quotient is a difference of logs, so {ln ρ|ln rho} is minus {0.3|zero point three}, and {ρ|rho} is e to that: about {0.74|zero point seven four}.', code: 'lognum' },
        { id: 'obj', say: 'The objective is the ratio times the advantage: raising it pushes tokens with a positive advantage up, and those with a negative one down.', code: 'obj' },
      ],
    },
    {
      id: 'try',
      title: 'Try two',
      codeTitle: 'check.py',
      code: `
        logp_old, logp = -15.2, -15.4             #@p1
        logp - logp_old          # -0.2           #@a1
        np.exp(-0.2)             # 0.82           #@a1
        pi_old, pi, A = 0.4, 0.6, -2              #@p2
        rho = 0.6 / 0.4          # 1.5            #@a2
        rho * A                  # -3.0           #@a2
      `,
      beats: [
        { id: 'p1', say: 'Try one. For a sampled answer, {ln π_old|ln pi old} is minus {15.2|fifteen point two}, and after a few updates {ln π|ln pi} is minus {15.4|fifteen point four}. What is the ratio?', code: 'p1' },
        { id: 'a1', say: 'Subtract the logs: minus {15.4|fifteen point four}, minus minus {15.2|fifteen point two}, is minus {0.2|zero point two}. Then {ρ|rho} is e to the minus {0.2|zero point two}: about {0.82|zero point eight two}. The answer became less likely.', code: 'a1' },
        { id: 'p2', say: 'Now a token had {π_old|pi old} of {0.4|zero point four}, after one update {π|pi} is {0.6|zero point six}, and its advantage is minus two. What is its term in the objective?', code: 'p2' },
        { id: 'a2', say: 'Its ratio is {0.6|zero point six} over {0.4|zero point four}: {1.5|one point five}. Times minus two, the term is minus three. Raising the objective pushes this token back down.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

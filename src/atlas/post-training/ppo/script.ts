import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-ppo',
  title: 'PPO\'s clipped objective',
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
      `,
      beats: [
        { id: 'batch', say: 'Sampling is slow, so PPO samples a batch of answers once, then steps {θ|theta} along the estimate several times on it. Each step is an update.', code: ['batch', 'loop'] },
        { id: 'old', say: 'Call the model that sampled it {π_old|pi old}. After one update, the model being trained, {π|pi}, already differs from it.', code: 'batch' },
        { id: 'rho', say: 'So each sampled token is weighed by its new probability over its old one, {π|pi} over {π_old|pi old}: a ratio, written with the Greek letter {ρ|rho}. Before any update, it is one.', code: 'rho' },
        { id: 'eg', say: 'If {π_old|pi old} gave a token {0.2|zero point two} and {π|pi} now gives it {0.3|zero point three}, its ratio is {1.5|one point five}.', code: ['rho', 'eg'] },
        { id: 'logs', say: 'An answer\'s probability is tiny, so code keeps logs. Say {ln π_old|ln pi old} was minus {12.4|twelve point four}, and {ln π|ln pi} is now minus {12.7|twelve point seven}.', code: 'logs' },
        { id: 'lognum', say: 'The log of a quotient is a difference of logs, so {ln ρ|ln rho} is minus {0.3|zero point three}, and {ρ|rho} is e to that: about {0.74|zero point seven four}.', code: 'lognum' },
        { id: 'obj', say: 'The objective is the ratio times the advantage: raising it pushes tokens with a positive advantage up, and those with a negative one down.', code: 'obj' },
      ],
    },
    {
      id: 'clip',
      title: 'Clip the ratio, one token at a time',
      codeTitle: 'ppo.py',
      code: `
        eps = 0.2                                #@eps
        c = np.clip(rho, 1 - eps, 1 + eps)       #@clip
        terms = rho * A, c * A                   #@in
        # A = +1, rho = 1.1:  1.1,  1.1          #@in
        # A = +1, rho = 1.5:  1.5,  1.2          #@out
        # A = -1, rho = 0.6: -0.6, -0.8          #@neg
        # A = -1, rho = 1.3: -1.3, -1.2          #@wrong
        term = min(terms)                        #@min
      `,
      beats: [
        { id: 'trust', say: 'But the samples only tell us about answers near {π_old|pi old}. Push a ratio far from one, and the estimate stops being trustworthy.' },
        { id: 'clip', say: 'So PPO clips the ratio to within a small {ε|epsilon} of one, written with the Greek letter {ε|epsilon}. With {ε|epsilon} at {0.2|zero point two}, that is {0.8|zero point eight} to {1.2|one point two}.', code: ['eps', 'clip'] },
        { id: 'in', say: 'Take a token with advantage plus one and ratio {1.1|one point one}. It has two terms: {ρA|rho A}, and the same with {ρ|rho} clipped. Inside the range, both are {1.1|one point one}.', code: 'in' },
        { id: 'out', say: 'Let the ratio climb to {1.5|one point five}. Unclipped, the term is {1.5|one point five}. Clipped, {ρ|rho} drops to {1.2|one point two}, and so does the term.', code: 'out' },
        { id: 'min', say: 'PPO keeps the smaller: {1.2|one point two}. Push the ratio higher, and it stays {1.2|one point two}: no reward for going further.', code: ['out', 'min'] },
        { id: 'neg', say: 'With advantage minus one, a lower ratio pays. At {0.6|zero point six}, the unclipped term is minus {0.6|zero point six}.', code: 'neg' },
        { id: 'negmin', say: 'Clipped, {ρ|rho} rises to {0.8|zero point eight}: minus {0.8|zero point eight}. That is the smaller, however low the ratio goes.', code: ['neg', 'min'] },
        { id: 'wrong', say: 'If instead the ratio went the wrong way, to {1.3|one point three}, the terms are minus {1.3|one point three} and minus {1.2|one point two}. The smaller is unclipped: still pushed down.', code: ['wrong', 'min'] },
      ],
    },
    {
      id: 'rule',
      title: 'The rule, and its shape',
      codeTitle: 'ppo.py',
      code: `
        def ppo_term(rho, A, eps=0.2):            #@rule
            c = np.clip(rho, 1 - eps, 1 + eps)    #@rule
            return min(rho * A, c * A)            #@rule
        # A > 0: flat past 1 + eps                #@plot
        # A < 0: flat below 1 - eps               #@plot
        # wrong way: still pulled back            #@wrong
      `,
      beats: [
        { id: 'rule', say: 'So each token\'s term is the min, the smaller, of {ρA|rho A} and {clip(ρ, 1 − ε, 1 + ε) A|clip of rho, between one minus epsilon and one plus epsilon, times A}.', code: 'rule' },
        { id: 'plot', say: 'Plot it against the ratio. With a positive advantage, it rises until {1.2|one point two}, then goes flat. With a negative one, it rises as the ratio falls, until {0.8|zero point eight}, then goes flat.', code: 'plot' },
        { id: 'wrong', say: 'Clipping only ever removes a reward. A ratio that moved the wrong way stays on the slope: still pulled back.', code: 'wrong' },
        { id: 'why', say: 'So one batch serves several updates, none far from {π_old|pi old}. Then the trained model samples the next batch, as the new {π_old|pi old}. The KL penalty, instead, keeps the whole run near the reference.' },
      ],
    },
    {
      id: 'try',
      title: 'Try two',
      codeTitle: 'check.py',
      code: `
        rho, A, eps = 0.5, -2, 0.2               #@p1
        rho * A                      # -1.0      #@a1
        np.clip(rho, 0.8, 1.2) * A   # -1.6      #@a1
        min(-1.0, -1.6)              # -1.6      #@a1
        A, rho, eps = -2, 0.85, 0.3              #@p2
        # clip range: 0.7 to 1.3                 #@a2
        # 0.85 > 0.7: lower rho still pays       #@a2
      `,
      beats: [
        { id: 'p1', say: 'Try one: {ρ|rho} is {0.5|zero point five}, A is minus two, and {ε|epsilon} is {0.2|zero point two}. What is the token\'s term?', code: 'p1' },
        { id: 'a1', say: 'Unclipped: {0.5|zero point five} times minus two, minus one. Clipped: {0.5|zero point five} rises to {0.8|zero point eight}, and times minus two that is minus {1.6|one point six}. The smaller is minus {1.6|one point six}.', code: 'a1' },
        { id: 'p2', say: 'Now A is minus two, {ρ|rho} is {0.85|zero point eight five}, and {ε|epsilon} is {0.3|zero point three}. Is the token still pushed, and which way?', code: 'p2' },
        { id: 'a2', say: 'The range is {0.7|zero point seven} to {1.3|one point three}. A is negative, so a lower ratio pays until {0.7|zero point seven}: at {0.85|zero point eight five}, the token is still pushed down.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

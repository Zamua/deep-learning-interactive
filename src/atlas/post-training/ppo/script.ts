import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-ppo',
  title: 'PPO\'s clipped objective',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Schulman, Levine, Moritz, Jordan & Abbeel', year: 2015, title: 'Trust Region Policy Optimization', url: 'https://arxiv.org/abs/1502.05477', scene: 'far' },
    { who: 'Kullback & Leibler', year: 1951, title: 'On information and sufficiency', url: 'https://doi.org/10.1214/aoms/1177729694', scene: 'far' },
    { who: 'Schulman, Wolski, Dhariwal, Radford & Klimov', year: 2017, title: 'Proximal Policy Optimization Algorithms', url: 'https://arxiv.org/abs/1707.06347', scene: 'clip' },
  ],
  scenes: [
    {
      id: 'far',
      title: 'Nothing stops the ratio',
      codeTitle: 'objective.py',
      code: `
        rho = pi(tok) / pi_old(tok)    #@rho
        obj = np.mean(rho * A)         #@rho
        # A = +1: term = rho, a line   #@line
        # rho 1.5, 2, 3: pays more     #@run
        # far from 1: batch says little #@trust
        # TRPO: KL(pi_old, pi) small   #@trpo
      `,
      beats: [
        { id: 'reuse', say: 'The probability ratio lets one batch serve several updates, as training raises the objective: the batch\'s average of {ρ|rho} times A.', code: 'rho' },
        { id: 'line', say: 'Follow one token with an advantage of plus one. Its term, {ρA|rho A}, is a straight line in {ρ|rho}: the more likely the token gets, the more it pays.', code: 'line' },
        { id: 'run', say: 'So every update pushes that ratio higher, and nothing ever says stop: {1.5|one point five}, two, three.', code: 'run' },
        { id: 'trust', say: 'But the batch was drawn by {π_old|pi old}. Far from a ratio of one, it says little about the model now, and repeated steps on it often lead to destructively large updates.', code: 'trust' },
        { id: 'trpo', say: 'In 2015, John Schulman and colleagues bounded each update with TRPO, trust region policy optimization: stay within a small KL divergence of {π_old|pi old}, the region where the batch can be trusted.', code: 'trpo' },
        { id: 'kl', say: 'KL is for Solomon Kullback and Richard Leibler, who defined that divergence in 1951.', code: 'trpo' },
        { id: 'hard', say: 'But enforcing that hard limit made every update complicated to compute.', code: 'trpo' },
      ],
    },
    {
      id: 'clip',
      title: 'Clip the ratio, keep the smaller',
      codeTitle: 'ppo.py',
      code: `
        eps = 0.2                        #@eps
        c = np.clip(rho, 1 - eps, 1 + eps) #@eps
        term = min(rho * A, c * A)       #@min
        # A = +1, rho 1.5: 1.5 or 1.2    #@pos
        # A = -1, rho 0.6: -0.6 or -0.8  #@neg
        # A = -1, rho 1.3: -1.3 or -1.2  #@wrong
      `,
      beats: [
        { id: 'ppo', say: 'In 2017, Schulman and four colleagues found something simpler: PPO, proximal policy optimization. Proximal means near: improve the policy, but only near the one that drew the batch.' },
        { id: 'clip', say: 'Clip the ratio to within a small {ε|epsilon} of one, written with the Greek letter epsilon. With {ε|epsilon} at {0.2|zero point two}, that is between {0.8|zero point eight} and {1.2|one point two}.', code: 'eps' },
        { id: 'flat', say: 'Clipped, the term goes flat past {1.2|one point two}, and a flat term gives no push.', code: 'eps' },
        { id: 'min', say: 'PPO keeps the smaller of two terms: {ρA|rho A}, and the same with {ρ|rho} clipped. At a ratio of {1.5|one point five}, that is {1.2|one point two}: no reward for going further.', code: ['min', 'pos'] },
        { id: 'neg', say: 'With an advantage of minus one, a lower ratio pays, until {0.8|zero point eight}; then the term goes flat. At {0.6|zero point six}, it is minus {0.8|zero point eight}, not minus {0.6|zero point six}.', code: ['min', 'neg'] },
        { id: 'wrong', say: 'If that ratio went the wrong way instead, up at {1.3|one point three}, the unclipped term, minus {1.3|one point three}, is the smaller. It stays: the token is still pushed down.', code: ['min', 'wrong'] },
        { id: 'pess', say: 'So the clip only removes a reward for going further; it never hides a mistake. The paper calls this a pessimistic bound.', code: 'min' },
      ],
    },
    {
      id: 'rule',
      title: 'The rule, and what it limits',
      codeTitle: 'ppo.py',
      code: `
        def ppo_term(rho, A, eps=0.2):          #@rule
            c = np.clip(rho, 1 - eps, 1 + eps)  #@rule
            return min(rho * A, c * A)          #@rule
        # clip: each batch near its pi_old      #@batch
        # KL penalty: run near pi_ref           #@kl
      `,
      beats: [
        { id: 'rule', say: 'Written out, each token\'s term is the min, the smaller, of {ρA|rho A} and {clip(ρ, 1 − ε, 1 + ε) A|clip of rho, between one minus epsilon and one plus epsilon, times A}.', code: 'rule' },
        { id: 'batch', say: 'So one batch serves several updates, none far from {π_old|pi old}. Then the trained model draws the next batch, as the new {π_old|pi old}.', code: 'batch' },
        { id: 'kl', say: 'The KL penalty does a different job: it keeps the whole run near {π_ref|pi ref}, the frozen start. A model can carry both.', code: 'kl' },
        { id: 'tried', say: 'Schulman\'s team also tried a KL penalty against {π_old|pi old} instead of the clip. In their tests, the clip did better.', code: ['batch', 'kl'] },
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
        { id: 'a2', say: 'The band lies between {0.7|zero point seven} and {1.3|one point three}. A is negative, so a lower ratio pays until {0.7|zero point seven}: at {0.85|zero point eight five}, the token is still pushed down.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

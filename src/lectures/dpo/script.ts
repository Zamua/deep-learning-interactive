import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'dpo',
  title: 'Direct preference optimization',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'One loss instead of a pipeline',
      codeTitle: 'pipelines.py',
      code: `
        # RLHF: three stages                #@rlhf
        sft = finetune(base, demos)         #@rlhf
        rm = train_reward(sft, pairs)       #@rm
        policy = ppo(sft, rm, ref=sft)      #@ppo
        # sample, score, value, KL: per step  #@ppo

        # DPO: the last two, as one loss    #@dpo
        policy = sft.copy()                 #@dpo
        for batch in pairs:                 #@dpo
            loss = dpo_loss(policy, ref, batch)  #@loss

        answers = ["A", "B", "C", "D"]     #@toy
        r      = [1.6, 0.9, -0.8, -1.4]     #@r
        pi_ref = [0.15, 0.45, 0.25, 0.15]   #@ref
      `,
      beats: [
        { id: 'hello', say: 'This lecture is about direct preference optimization, or {DPO|D P O}.' },
        { id: 'recall', say: 'In the last chapter, we taught a language model from human preferences with a three stage pipeline.', code: 'rlhf' },
        { id: 'stages', say: 'First, supervised fine tuning. Then a reward model, trained on pairs of answers. Then {PPO|P P O}, pushing the model toward high reward.', code: ['rlhf', 'rm', 'ppo'] },
        { id: 'heavy', say: 'That last stage is heavy. Four networks in memory, fresh text sampled at every step, and a long list of settings that all have to be right.', code: 'ppo' },
        { id: 'paper', say: 'In 2023, Rafailov and colleagues at Stanford showed that the last two stages can be replaced by one ordinary loss on the preference pairs.', code: 'dpo' },
        { id: 'same', say: 'No reward model. No reinforcement learning loop. No sampling during training. And yet it optimizes the very same objective.', code: ['dpo', 'loss'] },
        { id: 'title', say: 'The subtitle of their paper says it all: your language model is secretly a reward model.' },
        { id: 'plan', say: 'The whole idea is five steps of algebra. We will walk them slowly, one small step at a time.' },
        { id: 'toy', say: 'And we will use one tiny example throughout. One prompt: how do I reverse a list in Python?', code: 'toy' },
        { id: 'answers', say: 'Four possible answers. A is short and correct. B is correct, but rambling. C is confidently wrong. And D refuses.', code: 'toy' },
        { id: 'reward', say: 'Our pretend labelers follow a hidden reward, in gold. They like A best, and D least.', code: 'r' },
        { id: 'ref', say: 'The reference model, in orange, is the fine tuned model we start from. It prefers the rambling answer, B.', code: 'ref', pause: 0.3 },
      ],
    },
    {
      id: 'bt',
      title: 'Preferences from a reward',
      codeTitle: 'bradley_terry.py',
      code: `
        def sigmoid(z):
            return 1 / (1 + np.exp(-z))     #@sig

        r_w, r_l = {{rw:1.6}}, {{rl:-0.8}}          #@r
        p_w = sigmoid(r_w - r_l)  # {{p:0.917}}  #@p
        loss_rm = -np.log(p_w)              #@loss
      `,
      beats: [
        { id: 'pair', say: 'Start with one comparison. A labeler sees two answers, and picks one.' },
        { id: 'names', say: 'We call the chosen answer {y_w|y w}, for winner, and the rejected one {y_l|y l}, for loser.' },
        { id: 'bt', say: 'The Bradley-Terry model says that each answer has a hidden score: its reward.', code: 'r' },
        { id: 'sig', say: 'The chance that the labeler picks {y_w|y w} is the sigmoid of the difference between the two rewards.', code: ['sig', 'p'] },
        { id: 'curve', say: 'The sigmoid squashes any number into a probability. A gap of zero gives a coin flip: one half.', code: 'sig' },
        { id: 'gap', say: 'A versus C has a reward gap of {2.4|two point four}, so the labeler picks A about ninety two percent of the time. Never a hundred: people are noisy.', code: 'p' },
        { id: 'diff', say: 'Notice that only the difference matters. Add the same number to both rewards, and nothing changes.', code: ['r', 'p'] },
        { id: 'rm', say: 'In {RLHF|R L H F}, a reward model is trained by minimizing minus the log of this probability, over many labeled pairs.', code: 'loss' },
        { id: 'keep', say: 'Keep this equation in mind. The whole derivation ends right back here.', pause: 0.3 },
      ],
    },
    {
      id: 'objective',
      title: 'Reward on a KL leash',
      codeTitle: 'objective.py',
      code: `
        def J(pi, pi_ref, r, beta):
            reward = (pi * r).sum()         #@reward
            kl = (pi * np.log(pi / pi_ref)).sum()  #@kl
            return reward - beta * kl       #@J

        # reward {{er:0.24}}  KL {{kl:0}}  J {{J:0.24}}
      `,
      beats: [
        { id: 'goal', say: 'Next, the objective that {RLHF|R L H F} is really optimizing.' },
        { id: 'policy', say: 'The policy, in blue, is the model we train. It gives every possible answer a probability.' },
        { id: 'reward', say: 'We want its expected reward to be high: the average reward of the answers it would write.', code: 'reward' },
        { id: 'greedy', say: 'But reward alone would pile all the probability onto one answer. In practice, that is often an answer that exploits a flaw in the reward model.', code: 'reward' },
        { id: 'leash', say: 'So we add a leash. The {KL|K L} divergence measures how far the policy has drifted from the reference.', code: 'kl' },
        { id: 'kl', say: 'It averages the log ratio, the log of pi over {π_ref|pi ref}, over the policy\'s own answers. It is zero when the two match, and positive otherwise.', code: 'kl' },
        { id: 'beta', say: '{β|Beta} is the price of drifting. The objective is the expected reward, minus {β|beta} times the {KL|K L}.', code: 'J' },
        { id: 'tug', say: 'Watch the tug of war. Moving probability toward A earns reward, but every step away from the orange bars costs {KL|K L}. The best policy sits somewhere in between.', code: 'J' },
        { id: 'ppo', say: '{PPO|P P O} finds that policy by trial and error. {DPO|D P O} will find it with algebra.', pause: 0.3 },
      ],
    },
    {
      id: 'optimal',
      title: 'The best policy has a formula',
      codeTitle: 'optimal_policy.py',
      code: `
        beta = {{beta:1}}
        pi_star = pi_ref * np.exp(r / beta)  #@tilt
        Z = pi_star.sum()        # {{Z:2.0}}  #@Z
        pi_star = pi_star / Z               #@norm

        best = beta * np.log(Z)             #@best
        gap = beta * kl(pi, pi_star)        #@gap
        # J(pi) == best - gap, for any pi   #@gap
      `,
      beats: [
        { id: 'surprise', say: 'Here is the surprise that makes everything work. For one prompt, this objective has an exact solution. You can simply write it down.' },
        { id: 'steps', say: 'Step one was the objective. Step two is its answer.' },
        { id: 'tilt', say: 'Take the reference model\'s probabilities, and multiply each one by e to the reward over {β|beta}.', code: 'tilt' },
        { id: 'grow', say: 'High reward answers grow. Low reward answers shrink.', code: 'tilt' },
        { id: 'norm', say: 'Then divide by the total, so the probabilities add up to one again. That total is called Z.', code: ['Z', 'norm'] },
        { id: 'result', say: 'The result is {π*|pi star}, the best possible policy. With {β|beta} equal to one, A rises to {0.37|zero point three seven}, while B stays on top at {0.55|zero point five five}.', code: 'norm' },
        { id: 'beta', say: 'Now loosen the leash. As {β|beta} shrinks, {π*|pi star} piles onto the best answer, A. Tighten it, and {π*|pi star} stays close to the reference.', code: 'tilt' },
        { id: 'why', say: 'Why is this the best? Rewrite the objective, and it becomes a fixed ceiling, {β|beta} log Z, minus {β|beta} times the {KL|K L} from the policy to {π*|pi star}.', code: ['best', 'gap'] },
        { id: 'zero', say: 'That {KL|K L} is zero only when the policy equals {π*|pi star}. So nothing can beat it.', code: 'gap' },
        { id: 'catch', say: 'There is one catch. For a real language model, Z is a sum over every possible answer: more strings than there are atoms in the universe. Nobody can compute it.', code: 'Z', pause: 0.3 },
      ],
    },
    {
      id: 'invert',
      title: 'Turn the formula around',
      codeTitle: 'invert.py',
      code: `
        # pi_star = pi_ref * exp(r / beta) / Z
        # take logs, then solve for r:       #@solve
        r_hat = beta * np.log(pi_star / pi_ref)  #@hat
        r = r_hat + beta * np.log(Z)       #@r
        # beta * log(Z) = {{blz:0.693}}
      `,
      beats: [
        { id: 'back', say: 'Step three. The formula turns a reward into a policy. Read it backwards, and it turns a policy into a reward.' },
        { id: 'logs', say: 'Take the log of both sides, and solve for r.', code: 'solve' },
        { id: 'result', say: 'The reward is {β|beta} times the log ratio, log of {π*|pi star} over {π_ref|pi ref}, plus {β|beta} times log Z.', code: ['hat', 'r'] },
        { id: 'implicit', say: 'The first part is called the implicit reward. An answer the policy made more likely than the reference did gets a positive implicit reward.', code: 'hat' },
        { id: 'bars', say: 'Here are the true rewards in gold, and the implicit rewards in purple.', code: 'hat' },
        { id: 'shift', say: 'Every purple bar sits below its gold bar by the same amount: {β|beta} log Z, about {0.69|zero point six nine} here.', code: 'r' },
        { id: 'secret', say: 'So a policy is a reward model in disguise. That is the secret in the title of the paper.' },
        { id: 'stuck', say: 'But we still cannot compute Z. Luckily, look at what it is: one number per prompt, shared by every answer to that prompt.', code: 'r', pause: 0.3 },
      ],
    },
    {
      id: 'cancel',
      title: 'The prompt term cancels',
      codeTitle: 'cancel.py',
      code: `
        def r(y):                  # step 3
            return (beta * log_ratio(y)
                    + beta * np.log(Z))     #@z

        p_w = sigmoid(r(y_w) - r(y_l))      #@bt
        # = sigmoid(beta * log_ratio(y_w)   #@cancel
        #         - beta * log_ratio(y_l))  #@cancel

        # shift c = {{c:0}}: Z = {{Z:2.0}}, p_w = {{p:0.917}}
      `,
      beats: [
        { id: 'step4', say: 'Step four. Bradley-Terry never uses a reward on its own. It only uses the difference between two rewards, for the same prompt.', code: 'bt' },
        { id: 'sub', say: 'So substitute step three for both rewards in the pair.', code: ['z', 'bt'] },
        { id: 'two', say: 'Each one brings its own {β|beta} log Z of x. And since the prompt is the same, the two are identical.', code: 'z' },
        { id: 'cancel', say: 'Subtract, and they cancel.', code: 'cancel' },
        { id: 'left', say: 'What is left is the sigmoid of {β|beta} times the log ratio of the chosen answer, minus {β|beta} times the log ratio of the rejected one.', code: 'cancel' },
        { id: 'gone', say: 'The unknown reward is gone. The impossible normalizer is gone. Everything that remains is a log probability under one of two models.', code: 'cancel' },
        { id: 'check', say: 'We can check it on the toy. Shift every reward up or down by the same amount. Z changes, but {π*|pi star} and every preference probability stay exactly the same.' },
        { id: 'never', say: 'Rewards were never unique anyway. A constant per prompt changes no preference, so no data could ever have pinned it down.', pause: 0.3 },
      ],
    },
    {
      id: 'loss',
      title: 'Step five: the DPO loss',
      codeTitle: 'dpo_loss.py',
      code: `
        def dpo_loss(logp_w, logp_l,
                     ref_w, ref_l, beta=0.1):
            h = ((logp_w - ref_w)           #@h
                 - (logp_l - ref_l))        #@h
            margin = beta * h               #@m
            return -log_sigmoid(margin)     #@loss

        # start: pi == pi_ref, margin = 0   #@start
        # loss = log 2 = 0.693              #@start
      `,
      beats: [
        { id: 'step5', say: 'Step five turns all of this into a training rule.' },
        { id: 'replace', say: 'Replace {π*|pi star} with the model we are actually training, pi theta.', code: 'h' },
        { id: 'likely', say: 'Then ask how likely our labeled pairs are under this model, and make that likelihood as large as possible.', code: 'loss' },
        { id: 'loss', say: 'That is the {DPO|D P O} loss: minus the log sigmoid of the implicit reward margin.', code: ['m', 'loss'] },
        { id: 'margin', say: 'The margin is {β|beta} times the gap between the two log ratios: how much more the model has raised the chosen answer than the rejected one, compared with the reference.', code: ['h', 'm'] },
        { id: 'classify', say: 'This is plain binary classification: the logistic loss from the linear classifier chapter. The score is the margin, and the label is always: the first answer won.', code: 'loss' },
        { id: 'curve', say: 'Here is the loss for one pair, as the margin changes.', code: 'loss' },
        { id: 'start', say: 'Training starts with the policy equal to the reference. Every margin is zero, and the loss is log two, about {0.693|zero point six nine three}. That is the first line of every {DPO|D P O} training log.', code: 'start' },
        { id: 'right', say: 'Rank the pair correctly, and the loss flattens toward zero. Rank it wrongly, and the loss climbs in a straight line.', code: 'loss' },
        { id: 'same', say: 'And if the model could represent any policy, the minimum of this loss is exactly {π*|pi star}. Same goal as {RLHF|R L H F}. No reward model. No reinforcement learning.', pause: 0.3 },
      ],
    },
    {
      id: 'gradient',
      title: 'How wrong decides how hard',
      codeTitle: 'dpo_grad.py',
      code: `
        r_hat_w = beta * (logp_w - ref_w)
        r_hat_l = beta * (logp_l - ref_l)
        weight = sigmoid(r_hat_l - r_hat_w)  #@w
        # d loss / d logp_w = -beta * weight  #@up
        # d loss / d logp_l = +beta * weight  #@down

        # batch of 6 pairs, step {{t:0}}       #@batch
      `,
      beats: [
        { id: 'diff', say: 'Now differentiate the loss, and something readable appears.' },
        { id: 'up', say: 'Every step pushes the log probability of the chosen answer up,', code: 'up' },
        { id: 'down', say: 'and the log probability of the rejected answer down.', code: 'down' },
        { id: 'weight', say: 'But each pair is scaled by a weight: the sigmoid of minus the margin.', code: 'w' },
        { id: 'wrong', say: 'When the implicit reward ranks a pair the wrong way round, the weight is close to one. That pair pulls hard.', code: 'w' },
        { id: 'right', say: 'When the pair is already ranked correctly by a wide margin, the weight fades toward zero. That pair stops pulling.', code: 'w' },
        { id: 'batch', say: 'Here is a mini batch of six pairs. The last one is a noisy label that contradicts the first. At the start, every margin is zero and every weight is one half.', code: 'batch' },
        { id: 'steps', say: 'Take a few steps. Pairs the model already gets right fade out, while the two contradicting pairs keep pulling against each other.', code: ['batch', 'w'] },
        { id: 'naive', say: 'The {DPO|D P O} paper notes that a naive version, without this weight, can make the model degenerate. It keeps pushing on pairs it has already won.' },
        { id: 'nosample', say: 'And notice what the gradient never needs: a sample from the policy. This is supervised learning, with a cleverly chosen loss.', pause: 0.3 },
      ],
    },
    {
      id: 'beta',
      title: 'The role of beta',
      codeTitle: 'beta.py',
      code: `
        # in the objective: the leash
        pi_star = pi_ref * np.exp(r / beta)  #@obj
        # in the loss: the exchange rate
        r_hat = beta * np.log(pi / pi_ref)   #@rate
        margin = beta * h                    #@rate

        beta = {{beta:1}}
      `,
      beats: [
        { id: 'twice', say: '{β|Beta} appears twice, and both times it says the same thing.' },
        { id: 'obj', say: 'In the objective, it is the price of drifting away from the reference.', code: 'obj' },
        { id: 'small', say: 'A small {β|beta} is a loose leash: {π*|pi star} piles onto the answer with the highest reward.', code: 'obj' },
        { id: 'large', say: 'A large {β|beta} is a short leash: {π*|pi star} barely moves from the reference.', code: 'obj' },
        { id: 'loss', say: 'In the loss, {β|beta} is the exchange rate between log ratios and reward.', code: 'rate' },
        { id: 'stretch', say: 'The loss is mostly satisfied once the margin is a few units. So the log ratios have to move by a few units, divided by {β|beta}.', code: 'rate' },
        { id: 'example', say: 'With {β|beta} at {0.1|zero point one}, a margin of three needs a gap of thirty: an enormous change in probability. With {β|beta} at one, a gap of three will do.', code: 'rate' },
        { id: 'typical', say: 'Most runs use a value near {0.1|zero point one}, the default in the {DPO|D P O} paper.' },
        { id: 'price', say: 'But remember: {β|beta} is a price, not a wall. Later, we will see a case where {DPO|D P O} walks right past it.', pause: 0.3 },
      ],
    },
    {
      id: 'run',
      title: 'A whole run, in miniature',
      codeTitle: 'train_dpo.py',
      code: `
        pairs = load_pairs()   # 1,000, fixed  #@data
        theta = np.log(pi_ref)    # beta = 0.5  #@init
        for step in range(400):   # {{step:0}}   #@loop
            loss = dpo_loss(theta, pairs)   #@loss
            theta = adam(theta, grad(loss))  #@step
        # loss {{loss:0.693}}, answers sampled: 0  #@zero
      `,
      beats: [
        { id: 'test', say: 'Time to test the whole claim, end to end.' },
        { id: 'data', say: 'We sample a thousand preference pairs once, from the reference model, and label them with a noisy labeler that follows the hidden rewards.', code: 'data' },
        { id: 'init', say: 'The policy starts as a copy of the reference. The dashed outline is {π*|pi star}: the answer {RLHF|R L H F} is looking for.', code: 'init' },
        { id: 'loop', say: 'Then we train the policy with the {DPO|D P O} loss and Adam.', code: ['loop', 'loss', 'step'] },
        { id: 'never', say: 'The loop never sees a reward, and never generates a single answer.', code: 'zero' },
        { id: 'watch', say: 'Watch the blue bars. A climbs, B gives way, and the wrong answer and the refusal fade out.', code: ['loss', 'step'] },
        { id: 'land', say: 'They land on the dashed outline. Up to the noise of a finite dataset, {DPO|D P O} has found the {RLHF|R L H F} optimum.' },
        { id: 'lossc', say: 'The loss falls from {0.693|zero point six nine three}, and settles near {0.42|zero point four two}, not zero.', code: 'loss' },
        { id: 'noisy', say: 'It cannot reach zero, because the labels are noisy. Even the true reward agrees with only about eighty three percent of them.', pause: 0.3 },
      ],
    },
    {
      id: 'recipe',
      title: 'The practical recipe',
      codeTitle: 'dpo_step.py',
      code: `
        with torch.no_grad():               #@ref
            ref_w = seq_logp(ref, chosen)    #@ref
            ref_l = seq_logp(ref, rejected)  #@ref
        logp_w = seq_logp(policy, chosen)    #@pol
        logp_l = seq_logp(policy, rejected)  #@pol
        loss = dpo_loss(logp_w, logp_l,      #@loss
                        ref_w, ref_l, beta)  #@loss
        loss.backward(); opt.step()          #@loss
      `,
      beats: [
        { id: 'real', say: 'On a real language model, the recipe is short.' },
        { id: 'seq', say: 'The log probability of a whole answer is the sum of the log probabilities of its tokens, each given the ones before. One forward pass computes them all, with the prompt tokens masked out.', code: 'pol' },
        { id: 'two', say: 'Start from the fine tuned model, and make two copies: the policy, which trains, and the reference, which stays frozen.', code: ['ref', 'pol'] },
        { id: 'pairs', say: 'Collect preference pairs once, from people, or from a strong model acting as a judge.' },
        { id: 'cache', say: 'Since the reference never changes, its log probabilities can even be computed once, ahead of time.', code: 'ref' },
        { id: 'train', say: 'Then train with the {DPO|D P O} loss, usually for one to a few passes, with a small learning rate.', code: 'loss' },
        { id: 'compare', say: 'Compare that with {PPO|P P O}. Four models become two. Sampling at every step becomes none. A long list of settings becomes mostly {β|beta} and the learning rate.' },
        { id: 'spread', say: 'That simplicity is why {DPO|D P O} spread so fast: from Zephyr in late 2023, to Llama 3 in 2024.', pause: 0.3 },
      ],
    },
    {
      id: 'limits',
      title: 'Limits, and the variants',
      codeTitle: 'variants.py',
      code: `
        # DPO: keeps falling as h grows      #@dpo
        dpo = -log_sigmoid(beta * h)         #@dpo
        # IPO: squared, with a fixed target  #@ipo
        ipo = (h - 1 / (2 * tau)) ** 2       #@ipo
        # KTO: thumbs up or down, no pairs   #@kto
        # SimPO: no reference model          #@simpo
        avg_w = logp_w / len_w               #@simpo
      `,
      beats: [
        { id: 'same', say: 'The strengths and the weaknesses of {DPO|D P O} come from the same place: it never leaves its dataset.' },
        { id: 'explore', say: 'First, it cannot explore. {PPO|P P O} grades the policy\'s own fresh answers. {DPO|D P O} only sees answers someone else wrote, so once the policy moves, it writes text that nobody ever judged.' },
        { id: 'online', say: 'A common fix is online {DPO|D P O}: generate new pairs from the current model, label them, and train again.' },
        { id: 'certain', say: 'Second, certain preferences break the leash. If every label says A beats B, the loss keeps shrinking as the gap grows.', code: 'dpo' },
        { id: 'push', say: 'So {DPO|D P O} keeps pushing, and the probability of B races toward zero, whatever {β|beta} says.', code: 'dpo' },
        { id: 'ipo', say: '{IPO|I P O} replaces the loss with a squared error that aims for a fixed gap, and stops there.', code: 'ipo' },
        { id: 'both', say: 'Third, the loss only cares about the gap. Often both answers lose probability, the rejected one just faster.', code: 'dpo' },
        { id: 'length', say: 'And if the chosen answers in the data tend to be longer, the model learns that length itself is rewarded.' },
        { id: 'kto', say: 'Two more variants are worth knowing. {KTO|K T O} needs no pairs at all: just a thumbs up or a thumbs down for each answer.', code: 'kto' },
        { id: 'simpo', say: '{SimPO|Sim P O} drops the reference model, and scores answers by their average log probability per token, which also removes the pull toward long answers.', code: 'simpo', pause: 0.3 },
      ],
    },
    {
      id: 'outro',
      title: 'Five steps, one loss',
      codeTitle: 'dpo.py',
      code: `
        def dpo_loss(logp_w, logp_l,
                     ref_w, ref_l, beta=0.1):
            margin = beta * ((logp_w - ref_w)
                             - (logp_l - ref_l))
            return -log_sigmoid(margin).mean()
      `,
      beats: [
        { id: 'recap', say: 'Let us put the five steps side by side.' },
        { id: 's1', say: 'One: the objective. Expected reward, minus {β|beta} times the {KL|K L} to the reference.' },
        { id: 's2', say: 'Two: its best policy has a formula. The reference, tilted by e to the reward over {β|beta}, and divided by Z.' },
        { id: 's3', say: 'Three: turned around, any policy implies a reward, up to a constant per prompt.' },
        { id: 's4', say: 'Four: Bradley-Terry only uses differences, so that constant cancels.' },
        { id: 's5', say: 'Five: maximum likelihood on the pairs gives the {DPO|D P O} loss. Logistic regression on the implicit reward margin.', code: [3, 4, 5] },
        { id: 'grad', say: 'Its gradient raises the chosen answer and lowers the rejected one, weighted by how wrong the model still is.' },
        { id: 'next', say: 'Next, rewards a program can check: answers graded right or wrong by code, and {GRPO|G R P O}, which learns from them with no critic at all.', pause: 0.6 },
      ],
    },
  ],
};

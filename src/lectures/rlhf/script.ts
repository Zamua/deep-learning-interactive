import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'rlhf',
  title: 'RLHF and PPO',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'Learning from human judgment',
      codeTitle: 'rlhf.py',
      code: `
        pairs = humans_compare(answers)   #@compare
        rm = fit_reward_model(pairs)      #@rm
        policy = ppo(sft, rm, ref=sft)    #@ppo
      `,
      beats: [
        { id: 'hello', say: 'This lecture is about reinforcement learning from human feedback, {RLHF|R L H F}, and the algorithm that made it work: {PPO|P P O}.' },
        { id: 'mimic', say: 'A pretrained language model is a superb mimic. It continues any text the way the internet would.' },
        { id: 'moon', say: 'Ask it to explain the moon landing to a six year old, and it may answer with more questions just like yours.' },
        { id: 'sft', say: 'Fine-tuning on written demonstrations teaches the format, but they are slow to write, and only show what to do.' },
        { id: 'judge', say: 'People are much better at judging answers than at writing them. Which of these two is better? Anyone can tell.', code: 'compare' },
        { id: 'recipe', say: 'So {RLHF|R L H F} collects comparisons, fits a reward model to predict them, and then trains the language model against that reward model.', code: ['compare', 'rm', 'ppo'] },
        { id: 'ppo', say: 'That last step is reinforcement learning, and the algorithm of choice was {PPO|P P O}: proximal policy optimization.', code: 'ppo' },
        { id: 'plan', say: 'We will build each piece in turn, and then see how it all goes wrong.' },
      ],
    },
    {
      id: 'recap',
      title: 'Where we left off',
      codeTitle: 'reinforce.py',
      code: `
        logp = policy.logprobs(x, y)  # (T,)  #@logp
        loss = -(adv * logp).sum()           #@loss
        kl = logp.sum() - logp_ref.sum()     #@kl
        objective = reward - beta * kl       #@obj
      `,
      beats: [
        { id: 'policy', say: 'First, a recap. The language model is a policy: each next token is an action, and when the answer is finished, a reward says how good it was.', code: 'logp' },
        { id: 'adv', say: 'The policy gradient pushes every token the model wrote in proportion to its advantage: how much better things went than expected.', code: 'loss' },
        { id: 'sign', say: 'Positive advantage: more likely next time. Negative: less likely.', code: 'loss' },
        { id: 'baseline', say: 'Subtracting a baseline leaves the average gradient unchanged, and makes it far less noisy.', code: 'loss' },
        { id: 'leash', say: 'And a frozen copy of the starting model, the reference, acts as a leash.', code: 'kl' },
        { id: 'kl', say: 'The {KL|K L} divergence measures how far the policy has drifted, and the objective pays {β|beta} times that drift.', code: ['kl', 'obj'] },
        { id: 'why', say: 'Without it, the policy can wander into strange text that happens to score well. Hold that thought.', code: 'obj' },
      ],
    },
    {
      id: 'recipe',
      title: 'The InstructGPT recipe',
      codeTitle: 'instructgpt.py',
      code: `
        demos = labelers_write(prompts)  #@sft
        sft = finetune(base, demos)      #@sft

        answers = sft.sample(x, n=4)     #@sample
        ranks = labelers_rank(answers)   #@rank
        rm = fit_reward_model(ranks)     #@rm

        policy = copy(sft)               #@ppo
        y = policy.sample(x)             #@ppo
        reward = rm(x, y)                #@ppo
        ppo_update(policy, reward)       #@ppo
      `,
      beats: [
        { id: 'intro', say: 'The standard recipe comes from {InstructGPT|Instruct G P T}, by Ouyang and colleagues at Open A I, in {2022|twenty twenty two}. It has three stages.' },
        { id: 'sft', say: 'Stage one, supervised fine-tuning. Labelers write answers to about thirteen thousand prompts, and the pretrained model imitates them.', code: 'sft' },
        { id: 'sample', say: 'Stage two. The fine-tuned model, called {SFT|S F T}, writes four to nine answers to each prompt.', code: 'sample' },
        { id: 'rank', say: 'Labelers rank them, best to worst. Ranking is far quicker than writing.', code: 'rank' },
        { id: 'rm', say: 'Those rankings train a reward model: a network that reads a prompt and an answer, and outputs a single number.', code: 'rm' },
        { id: 'ppo', say: 'Stage three. A copy of the {SFT|S F T} model becomes the policy. It answers new prompts, the reward model scores them, and {PPO|P P O} updates it.', code: 'ppo' },
        { id: 'nohuman', say: 'In stage three, nobody writes or ranks anything. The reward model stands in for people: the power of the method, and its weak point.', code: 'ppo' },
        { id: 'result', say: 'People preferred a {1.3 billion|one point three billion} parameter {InstructGPT|Instruct G P T} to the {175 billion|hundred and seventy five billion} parameter {GPT-3|G P T 3}. {ChatGPT|Chat G P T}, later that year, used the same methods.' },
      ],
    },
    {
      id: 'bt',
      title: 'Comparisons and Bradley-Terry',
      codeTitle: 'bradley_terry.py',
      code: `
        margin = r_chosen - r_rejected    #@margin
        p = 1 / (1 + np.exp(-margin))     #@p
        # p(0) = 0.5    p(2) = 0.88       #@vals
        loss = -np.log(p).mean()          #@loss
        dloss = -(1 - p)    # per pair    #@grad
      `,
      beats: [
        { id: 'scales', say: 'Why comparisons, and not scores? Ask ten people to rate an answer out of ten, and you get ten different scales.' },
        { id: 'pairs', say: 'Ask which of two is better, and they agree much more often. So the data is triples: a prompt, a chosen answer, and a rejected one.' },
        { id: 'rankings', say: 'A ranking of nine answers holds thirty six pairs.' },
        { id: 'noise', say: 'Labels are still noisy: {InstructGPT\'s|Instruct G P T\'s} labelers agreed with each other about three quarters of the time.' },
        { id: 'model', say: 'The reward model is a language model whose vocabulary output is swapped for a single number.' },
        { id: 'bt', say: 'To connect scores to choices, we use the Bradley-Terry model, from {1952|nineteen fifty two}: the chance of preferring the chosen answer is the sigmoid of the difference between the two scores.', code: ['margin', 'p'] },
        { id: 'zero', say: 'A margin of zero is a coin flip.', code: 'vals' },
        { id: 'two', say: 'A margin of two means eighty eight percent. Only the difference matters, so adding a constant to every score changes nothing.', code: 'vals' },
        { id: 'loss', say: 'The loss is minus the log of that probability: logistic regression, where the right answer is always that the chosen one wins.', code: 'loss' },
        { id: 'grad', say: 'Its slope is steepest when the model has a pair backwards, so training concentrates on the pairs it gets wrong.', code: 'grad' },
      ],
    },
    {
      id: 'rmtoy',
      title: 'Watching a reward model learn',
      codeTitle: 'train_rm.py',
      code: `
        w = np.array([-0.6, 0.1])  # random  #@init
        for step in range(200):
            d = f_w - f_l   # feature gaps
            margin = d @ w                   #@margin
            p = 1 / (1 + np.exp(-margin))
            grad = -((1 - p)[:, None]        #@grad
                     * d).mean(0)            #@grad
            w -= 0.05 * grad                 #@step
        # step {{step:0}}   accuracy {{acc:39%}}
      `,
      beats: [
        { id: 'toy', say: 'Here is a toy where we can watch one learn. Each answer is a point with two features: its length, and its quality.' },
        { id: 'cloud', say: 'The fine-tuned model\'s answers form a cloud. Their length varies a lot, their quality only a little.' },
        { id: 'taste', say: 'Simulated labelers have a hidden taste: quality matters most, some extra length helps, and too much length hurts.' },
        { id: 'pairs', say: 'They compare pairs and pick winners, noisily. Each line joins a pair; the filled dot is the one they chose.' },
        { id: 'linear', say: 'Our reward model is linear: a weighted sum of length and quality. It starts out random, and gets most pairs backwards.', code: 'init' },
        { id: 'train', say: 'Training on the Bradley-Terry loss turns its contours until they agree with the labels...', code: ['margin', 'grad', 'step'] },
        { id: 'ceiling', say: '...up to about seventy percent of new pairs: close to the ceiling set by the labelers\' own noise.', code: 'step' },
        { id: 'curve', say: 'But look at the labelers\' true taste. Its contours curve, because length helps only up to a point.' },
        { id: 'straight', say: 'A linear model can only draw straight lines, so it learns that longer is always better. Inside the cloud, that is nearly right. Remember it.' },
      ],
    },
    {
      id: 'ratio',
      title: 'Reusing a batch: the ratio',
      codeTitle: 'surrogate.py',
      code: `
        logp_old = logprobs(policy, y)  # fixed  #@old
        for epoch in range({{K:1}}):          #@reuse
            logp = logprobs(policy, y)
            ratio = np.exp(logp - logp_old)   #@ratio
            loss = -(ratio * adv).mean()      #@loss
            step(loss)                        #@loss
      `,
      beats: [
        { id: 'cost', say: 'Now, stage three. Its expensive part is generation: every batch means sampling whole answers from a large model, token by token.' },
        { id: 'once', say: '{REINFORCE|Reinforce} takes one gradient step on that batch, and throws it away. Why not take several?', code: 'reuse' },
        { id: 'stale', say: 'Because after one step, the batch is stale. It came from the old policy, and the gradient assumes samples from the current one.', code: 'old' },
        { id: 'is', say: 'Importance sampling fixes this. Weight each token by its ratio, {ρ|rho}: its probability now, over its probability when sampled.', code: 'ratio' },
        { id: 'double', say: 'A token that has become twice as likely counts twice, because the new policy would write it twice as often.', code: ['ratio', 'loss'] },
        { id: 'first', say: 'At the first step, every ratio is exactly one, and the gradient is exactly {REINFORCE|reinforce}. After that, the ratios correct for the drift.', code: 'ratio' },
        { id: 'limit', say: 'But a dozen samples cannot say much about a policy far from the one that made them.' },
        { id: 'runs', say: 'Here are sixteen training runs on a prompt with five kinds of answer. With one step per batch, learning is steady, but slow.', code: 'reuse' },
        { id: 'twenty', say: 'With twenty steps per batch, the runs climb much faster. But some lurch onto a worse answer, and stay there.', code: 'reuse' },
        { id: 'stuck', say: 'Once an answer\'s probability is near zero, the policy stops sampling it, and never learns otherwise.' },
      ],
    },
    {
      id: 'clip',
      title: 'The clipped surrogate',
      codeTitle: 'ppo_loss.py',
      code: `
        ratio = np.exp(logp - logp_old)
        unclipped = ratio * adv                #@u
        lo, hi = 1 - eps, 1 + eps  # eps 0.2   #@band
        clipped = np.clip(ratio, lo, hi) * adv #@c
        loss = -np.minimum(unclipped,          #@min
                           clipped).mean()     #@min
      `,
      beats: [
        { id: 'trpo', say: '{PPO\'s|P P O\'s} predecessor, {TRPO|T R P O}, said it directly: keep the new policy within a small {KL|K L} distance of the old one, a trust region. Enforcing that takes heavy machinery.' },
        { id: 'ppo', say: '{PPO|P P O}, from {2017|twenty seventeen}, gets most of the benefit with a small change to the loss.' },
        { id: 'formula', say: 'For each token, take the ratio times the advantage, and the same with the ratio clipped into a narrow band. Keep the smaller one.', code: ['u', 'c', 'min'] },
        { id: 'eps', say: 'The band runs from one minus epsilon to one plus epsilon. Epsilon is usually {0.2|zero point two}, so from {0.8|zero point eight} to {1.2|one point two}.', code: 'band' },
        { id: 'pos', say: 'Take a good token, with a positive advantage. As its ratio rises, the objective rises...', code: 'u' },
        { id: 'flat', say: '...until {1.2|one point two}. Then the clipped term wins the minimum, and the curve goes flat. Once the token is twenty percent more likely, this batch stops asking for more.', code: ['c', 'min'] },
        { id: 'below', say: 'Below the band there is no clipping: if an update made a good token less likely, the full gradient pulls it back.', code: 'u' },
        { id: 'neg', say: 'Now a bad token, with a negative advantage. Everything mirrors.' },
        { id: 'negflat', say: 'Lowering its ratio helps until {0.8|zero point eight}. Then the curve goes flat.', code: ['c', 'min'] },
        { id: 'negabove', say: 'But if an update made a bad token more likely, there is no clipping. The full penalty applies.', code: 'u' },
        { id: 'pessimism', say: 'That is what the minimum is for: clipping removes the incentive to keep improving, but never hides a step in the wrong direction.', code: 'min' },
        { id: 'back', say: 'Back to our sixteen runs, now with clipping: still fast, and every run finds the best answer.' },
      ],
    },
    {
      id: 'gae',
      title: 'The value head and GAE',
      codeTitle: 'gae.py',
      code: `
        lam = {{lam:0.95}}
        for t in reversed(range(T)):
            delta = (rewards[t]
                     + values[t + 1]
                     - values[t])            #@delta
            last = delta + lam * last        #@acc
            adv[t] = last                    #@acc
        returns = adv + values[:T]           #@vloss
        v_loss = ((critic(x, y) - returns)   #@vloss
                  ** 2).mean()               #@vloss
      `,
      beats: [
        { id: 'credit', say: '{PPO|P P O} needs an advantage for every token, but the reward model scores only the finished answer. Which tokens deserve the credit?' },
        { id: 'value', say: 'The tool is a value head: at every position, a prediction of the reward still to come.' },
        { id: 'delta', say: 'The prediction after a token, plus any reward that arrived, minus the prediction before it, is the surprise, delta. With a perfect value head, it equals the advantage on average.', code: 'delta' },
        { id: 'lam0', say: 'Trust the value head completely, and the advantage is just delta: low noise, but biased whenever the value head is wrong.', code: 'delta' },
        { id: 'lam1', say: 'Trust it only as a baseline, and the advantage is all the remaining reward minus the prediction: unbiased, but every later token adds noise.', code: 'acc' },
        { id: 'gae', say: 'Generalized advantage estimation blends the two. Each token adds up the surprises that follow it, weighted by lambda to the power of the distance.', code: 'acc' },
        { id: 'kernel', say: 'With lambda near zero, only the first surprise counts. With lambda near one, they all do.', code: 'acc' },
        { id: 'toy', say: 'Here is a ten token toy. Each token is good or bad, and the final reward counts the good ones, so good tokens truly deserve exactly one more than bad ones.' },
        { id: 'flawed', say: 'Give it a flawed value head. At lambda zero, the estimates are tight, but the gap between good and bad tokens is far too small.' },
        { id: 'one', say: 'At lambda one, the gap is right, but buried in noise.' },
        { id: 'between', say: 'In between, lambda trades bias for variance. Language models usually take lambda around {0.95|zero point nine five}.' },
        { id: 'vloss', say: 'The value head itself learns by plain regression onto the returns it sees, alongside the policy.', code: 'vloss' },
      ],
    },
    {
      id: 'kl',
      title: 'The KL penalty, token by token',
      codeTitle: 'token_rewards.py',
      code: `
        kl = logp_old - logp_ref   # per token  #@kl
        rewards = -beta * kl   # beta {{beta:0.1}}   #@pen
        rewards[-1] += reward  # at the end    #@rm
        adv, returns = gae(rewards, values)    #@gae
        # total reward {{total:1.21}}
      `,
      beats: [
        { id: 'chain', say: 'The {KL|K L} leash has to work per token too. The log probability of an answer is the sum over its tokens.' },
        { id: 'sample', say: 'So each written token\'s log ratio, policy over reference, estimates its share of the {KL|K L}.', code: 'kl' },
        { id: 'fold', say: 'Implementations fold the penalty straight into the reward: every token pays {β|beta} times its log ratio.', code: 'pen' },
        { id: 'end', say: 'The reward model\'s score arrives only on the last token, and {GAE|G A E} spreads everything across the answer.', code: ['rm', 'gae'] },
        { id: 'sure', say: 'Here is one answer. The policy has learned to open with: Sure! The reference found that unlikely, so those two tokens carry most of the penalty.', code: ['kl', 'pen'] },
        { id: 'cheap', say: 'The tokens that actually describe the sea cost almost nothing.' },
        { id: 'neg', say: 'One token\'s log ratio can even be negative. Averaged over many samples, though, it is the {KL|K L}, which never is.', code: 'kl' },
        { id: 'beta', say: 'Raise {β|beta}, and drift costs more. Near {0.3|zero point three}, it eats almost everything the reward model gave.', code: 'pen' },
      ],
    },
    {
      id: 'models',
      title: 'Four models in memory',
      codeTitle: 'ppo_iteration.py',
      code: `
        y, logp_old = policy.generate(x)    #@policy
        logp_ref = ref.logprobs(x, y)       #@ref
        reward = rm(x, y)                   #@rm
        values = critic(x, y)               #@critic
        rewards = -beta * (logp_old - logp_ref)
        rewards[:, -1] += reward
        adv, returns = gae(rewards, values) #@adv
        for epoch in range(4):              #@epochs
            ppo_step(policy, critic, adv)   #@epochs
      `,
      beats: [
        { id: 'four', say: 'Put it all together, and one {PPO|P P O} iteration touches four networks.' },
        { id: 'policy', say: 'The policy, which writes the answers, and is trained.', code: 'policy' },
        { id: 'ref', say: 'The reference: a frozen copy of the {SFT|S F T} model, for the {KL|K L} penalty.', code: 'ref' },
        { id: 'rm', say: 'The reward model, also frozen, which scores each finished answer.', code: 'rm' },
        { id: 'critic', say: 'And the value model, trained, which predicts the reward to come at every token.', code: 'critic' },
        { id: 'bytes', say: 'Training a model with Adam in mixed precision costs about sixteen bytes per parameter. A frozen model costs two.' },
        { id: 'total', say: 'So a seven billion parameter policy with same-sized helpers needs about two hundred and fifty gigabytes before a single activation: more than twice what fine-tuning needs.' },
        { id: 'small', say: 'That is one reason {InstructGPT|Instruct G P T} kept its reward and value models at six billion parameters, even for its largest policy.' },
        { id: 'loop', say: 'One iteration: generate a batch, score it, turn the scores into per-token rewards and advantages, then run several clipped epochs over it.', code: ['policy', 'ref', 'rm', 'critic', 'adv', 'epochs'] },
        { id: 'preview', say: 'Later recipes trim this. {GRPO|G R P O} drops the value model. {DPO|D P O} drops both the reward model and the value model.' },
      ],
    },
    {
      id: 'hacking',
      title: 'Reward hacking',
      codeTitle: 'overoptimize.py',
      code: `
        for step in range(600):
          e = rng.normal(size=(64, 2))      #@sample
          y = m + e          # answers      #@sample
          kl = e @ m + m @ m / 2            #@kl
          reward = y @ w_rm - beta * kl     #@reward
          adv = reward - reward.mean()      #@adv
          m += 0.05 * (adv[:, None] * e).mean(0)   #@step
        # beta {{beta:0.05}}   KL {{kl:0}}
      `,
      beats: [
        { id: 'notlabelers', say: 'Now the catch. The reward model is not the labelers. It was fit to comparisons of {SFT|S F T} answers, and is only accurate where those answers lived.' },
        { id: 'optimizer', say: 'And the policy is an optimizer, pointed straight at it.' },
        { id: 'goodhart', say: 'Push hard enough, and it finds answers the reward model loves for the wrong reasons. Goodhart\'s law: when a measure becomes a target, it ceases to be a good measure.' },
        { id: 'examples', say: 'Real models learned to write longer, to agree with the user, and to sound confident: reward, without being more correct.' },
        { id: 'toy', say: 'Back to our toy reward model. The policy is now a cloud of answers, and each step moves it toward a higher score, minus {β|beta} times the {KL|K L}.', code: ['sample', 'kl', 'reward'] },
        { id: 'run', say: 'With a weak leash, the answers grow longer and longer, and the reward model\'s score climbs without end...', code: ['adv', 'step'] },
        { id: 'peak', say: '...while the labelers\' true taste rises, peaks, and then collapses.' },
        { id: 'gao', say: 'Gao, Schulman and Hilton measured exactly this shape in {2022|twenty twenty two}, with a large reward model standing in for people.' },
        { id: 'leash', say: 'With a stronger leash, {β|beta} near {0.3|zero point three}, the policy stops close to the peak.', code: 'kl' },
        { id: 'hard', say: 'That is what {β|beta} is for, and why setting it is hard: in a real run, nobody can see the true curve.' },
        { id: 'fixes', say: 'So practitioners keep the {KL|K L} penalty, pick checkpoints by human evaluation, and refresh the reward model with comparisons of the policy\'s own answers.' },
      ],
    },
    {
      id: 'outro',
      title: 'Takeaways',
      codeTitle: 'takeaways.py',
      code: `
        rm = fit_bradley_terry(pairs)       #@r1
        ratio = np.exp(logp - logp_old)     #@r2
        obj = min(ratio * adv,              #@r2
                  clip(ratio) * adv)        #@r2
        adv = gae(rewards, values, lam)     #@r3
        rewards = -beta * kl                #@r4
        # the reward is only a proxy        #@r5
      `,
      beats: [
        { id: 'recap1', say: 'To recap. {RLHF|R L H F} learns a reward from human comparisons: a Bradley-Terry classifier on score differences.', code: 'r1' },
        { id: 'recap2', say: '{PPO|P P O} reuses each expensive batch for several steps, weighting tokens by the ratio {ρ|rho}, and clips that ratio pessimistically, so no batch moves a token far.', code: 'r2' },
        { id: 'recap3', say: 'A value head and {GAE|G A E} turn one score per answer into an advantage per token, with lambda trading bias for variance.', code: 'r3' },
        { id: 'recap4', say: 'The {KL|K L} penalty, paid token by token, keeps the policy near the reference, where the reward model can be trusted.', code: 'r4' },
        { id: 'recap5', say: 'And the learned reward is only a proxy. Optimize it too hard, and quality falls.', code: 'r5' },
        { id: 'next', say: 'Next come two simplifications: {DPO|D P O}, which skips the reward model and the sampling, and {GRPO|G R P O}, which drops the value head.' },
        { id: 'explore', say: 'But first, open the interactive chapter, where every figure runs live, with its code beside it.' },
        { id: 'bye', say: 'See you there.', pause: 0.6 },
      ],
    },
  ],
};

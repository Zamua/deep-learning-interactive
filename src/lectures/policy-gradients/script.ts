import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'policy-gradients',
  title: 'Reinforcement learning for language models',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'Learning from a score',
      codeTitle: 'two_ways.py',
      code: `
        # imitation: copy a target           #@imitate
        loss = -np.log(probs[y_target])       #@imitate

        # reinforcement: try, then get scored #@rl
        y = sample(policy, x)                 #@try
        R = grade(x, y)       # just a number #@grade
        # make high-R answers more likely     #@push
      `,
      beats: [
        { id: 'hello', say: 'Welcome to reinforcement learning for language models.' },
        { id: 'imitate', say: 'Everything so far has taught a model to imitate. Pretraining copies the web, and fine-tuning copies answers that people wrote.', code: 'imitate' },
        { id: 'target', say: 'Imitation needs a target: someone has to write the right answer first.', code: 'imitate' },
        { id: 'judge', say: 'But many things are easier to judge than to write. A program can check a math answer; a person can pick the better reply.' },
        { id: 'rl', say: 'Reinforcement learning learns from that judgment. The model tries an answer, gets a score, and shifts its probabilities toward what scored well.', code: ['try', 'grade', 'push'] },
        { id: 'number', say: 'The score is just a number. No target, no gradient, no explanation.', code: 'grade' },
        { id: 'next', say: 'This lecture builds the toolkit on a toy small enough to see completely, and the next three chapters stand on it: {PPO|P P O}, {DPO|D P O} and {GRPO|G R P O}.' },
        { id: 'go', say: 'So let us look at a language model the way reinforcement learning sees it.' },
      ],
    },
    {
      id: 'policy',
      title: 'Generation as a policy',
      codeTitle: 'generate.py',
      code: `
        state = "Is 91 prime?"                #@state
        logp = 0.0
        for t in range(2):
            probs = model(state)    # policy  #@probs
            a = np.random.choice(5, p=probs)  #@act
            logp += np.log(probs[a])          #@logp
            state += vocab[a]       # state   #@next
        R = grade(state)    # only at the end #@R
      `,
      beats: [
        { id: 'words', say: 'Reinforcement learning has its own vocabulary, but each word has a plain meaning for a language model.' },
        { id: 'state', say: 'The state is the prompt, plus every token written so far. Our prompt asks: is {91|ninety one} prime?', code: 'state' },
        { id: 'policy', say: 'The policy is the model itself. Given the state, its softmax gives a probability to every possible next token.', code: 'probs' },
        { id: 'policyname', say: 'Policy is the reinforcement learning word for a rule that picks actions: here, the next token.', code: 'probs' },
        { id: 'action', say: 'And an action is the token it picks.', code: 'act' },
        { id: 'tree', say: 'Picture every possible answer as a tree. Each branch is one choice, labeled with the policy\'s probability.' },
        { id: 'walk', say: 'Sampling walks down the tree: No, with probability one half, then seven times thirteen, with probability {0.4|zero point four}.', code: ['probs', 'act', 'next'] },
        { id: 'episode', say: 'One full walk is one episode: a complete answer.' },
        { id: 'reward', say: 'Only at the very end does the answer get its reward: one score for the whole thing.', code: 'R' },
        { id: 'grades', say: 'Our grader gives one point for a right answer with a reason, half a point for a bare right answer, and nothing for a wrong one.', code: 'R' },
        { id: 'trap', say: '{91|Ninety one} looks prime, but it is seven times thirteen, so this model answers wrongly half of the time.' },
      ],
    },
    {
      id: 'logprob',
      title: 'Products become sums',
      codeTitle: 'logprob.py',
      code: `
        token_probs = np.array([0.5, 0.4])   #@two
        np.prod(token_probs)          # 0.2  #@prod
        np.sum(np.log(token_probs))   # -1.61 #@log

        p = np.full(1100, 0.5)               #@long
        np.prod(p)         # 0.0: underflow  #@under
        np.sum(np.log(p))  # -762.5          #@fine
      `,
      beats: [
        { id: 'chain', say: 'The probability of a whole answer is a product: the first token\'s probability, times the second\'s, given the first.', code: 'two' },
        { id: 'prod', say: 'For our path, one half times {0.4|zero point four} gives {0.2|zero point two}.', code: 'prod' },
        { id: 'long', say: 'Real answers are hundreds of tokens long, and a product of that many numbers below one races toward zero.', code: 'long' },
        { id: 'under', say: 'Eleven hundred tokens at one half each, and the computer rounds the answer to exactly zero. It underflows.', code: 'under' },
        { id: 'logs', say: 'Logarithms fix this, because the log of a product is the sum of the logs.', code: 'log' },
        { id: 'scale', say: 'The log of one is zero. The log of one half is about minus {0.69|zero point six nine}. The log of a tiny probability is a large negative number.' },
        { id: 'sum', say: 'So instead of multiplying tiny numbers, we add moderate negative ones. Eleven hundred tokens give about minus seven hundred and sixty. No problem.', code: 'fine' },
        { id: 'star', say: 'That sum is the log probability of the answer, and it is the star of this lecture.' },
      ],
    },
    {
      id: 'expected',
      title: 'Expected reward',
      codeTitle: 'expected.py',
      code: `
        pi = np.array([0.4, 0.1, 0.3, 0.2])  #@pi
        R = np.array([0.0, 0.0, 0.5, 1.0])   #@R
        J = np.sum(pi * R)    # exact: 0.35  #@exact

        N = {{N:0}}
        ys = np.random.choice(4, size=N, p=pi)   #@sample
        J_hat = R[ys].mean()  # {{est:…}}    #@avg
      `,
      beats: [
        { id: 'bandit', say: 'Now collapse the tree, and treat each complete answer as one action: four answers, each with a probability and a grade.', code: ['pi', 'R'] },
        { id: 'name', say: 'One choice and one reward is called a bandit, after slot machines. Ours has four arms.' },
        { id: 'random', say: 'Sampling is random, so the reward changes every time. Which number should training push up?' },
        { id: 'average', say: 'The average: sample thousands of answers, grade them all, and take the mean. That is the expected reward.' },
        { id: 'weighted', say: 'An expected value is just a weighted average: every answer\'s reward, weighted by how often the policy writes it.', code: 'exact' },
        { id: 'calc', say: 'Here that is {0.3|zero point three} times one half, plus {0.2|zero point two} times one, which makes {0.35|zero point three five}.', code: 'exact' },
        { id: 'huge', say: 'A real model can write more answers than there are atoms in the universe, so we can never add them all up.' },
        { id: 'sample', say: 'But we can sample. Draw answers from the policy, grade them, and average the grades.', code: ['sample', 'avg'] },
        { id: 'settle', say: 'With a few samples, the average jumps around. With hundreds, it settles onto {0.35|zero point three five}.', code: 'avg' },
        { id: 'recipe', say: 'Sample, score, average. Everything that follows is built to be estimated this way.' },
      ],
    },
    {
      id: 'trick',
      title: 'The log-derivative trick',
      codeTitle: 'policy_gradient.py',
      code: `
        # J = sum over y: pi(y) * R(y)       #@J
        # grad J = sum: grad pi(y) * R(y)    #@snag
        # grad pi = pi * grad log pi         #@trick
        # grad J = E[R * grad log pi]        #@pg

        def policy_gradient(theta, N):
            pi = softmax(theta)                     #@est
            ys = np.random.choice(4, size=N, p=pi)  #@est
            grad_logp = grad_log_pi(theta, ys)      #@est
            w = R[ys][:, None]                      #@est
            return (w * grad_logp).mean(0)          #@est
      `,
      beats: [
        { id: 'goal', say: 'To improve the policy, we want the gradient of the expected reward: the direction in weight space that raises the average grade.', code: 'J' },
        { id: 'diff', say: 'Write it as a sum over answers of probability times reward, and differentiate. The rewards do not depend on the weights; only the probabilities do.', code: ['J', 'snag'] },
        { id: 'snag', say: 'And now we are stuck. Without the probability weights, the sum is no longer an average over samples, and we cannot add up every answer.', code: 'snag' },
        { id: 'trick', say: 'Here is the trick. The gradient of a probability equals the probability, times the gradient of its log.', code: 'trick' },
        { id: 'chain', say: 'It is only the chain rule. The derivative of log u is one over u, times the derivative of u. Multiply both sides by u, and there it is.', code: 'trick' },
        { id: 'back', say: 'Substitute it in, and the probability weight is back in front.', code: 'pg' },
        { id: 'pg', say: 'So the gradient of the expected reward is itself an average: of the reward, times the gradient of the log probability.', code: 'pg' },
        { id: 'recipe', say: 'And that we can estimate: sample answers, find the direction that makes each one more likely, scale it by its reward, and average.', code: 'est' },
        { id: 'black', say: 'And the reward never needs a gradient. It can come from a program, a reward model, or a person.' },
        { id: 'heart', say: 'This one line is the policy gradient, and it sits under all of post-training.', code: 'pg' },
      ],
    },
    {
      id: 'softmax',
      title: 'One-hot minus probabilities',
      codeTitle: 'grad_log_pi.py',
      code: `
        def grad_log_pi(theta, y):
            pi = softmax(theta)                 #@pi
            return np.eye(len(theta))[y] - pi   #@grad

        # sampled y = 3, "No, 7×13.":           #@ex
        # [0,0,0,1] - [0.4,0.1,0.3,0.2]         #@ex
        # = [-0.4, -0.1, -0.3, 0.8]             #@ex

        # a softmax classifier's gradient:
        dscores = probs.copy()                  #@ce
        dscores[y] -= 1    # = -grad_log_pi     #@ce
      `,
      beats: [
        { id: 'left', say: 'One ingredient is left: the gradient of the log probability. For a softmax policy, it is simple.' },
        { id: 'logits', say: 'Give each answer a logit, a raw score, and turn the logits into probabilities with a softmax, like the class scores of a linear classifier.', code: 'pi' },
        { id: 'formula', say: 'The gradient of log pi of y, with respect to the logits, is the one-hot vector for y, minus the probabilities.', code: 'grad' },
        { id: 'read', say: 'Read it as an instruction: raise the sampled answer\'s logit, and lower every other logit by its own probability.', code: 'grad' },
        { id: 'example', say: 'If we sampled No, seven times thirteen, its logit goes up by {0.8|zero point eight}, and the others go down by their probabilities.', code: 'ex' },
        { id: 'zero', say: 'The pushes add up to zero. Probability only moves around; it is never created.', code: 'ex' },
        { id: 'ce', say: 'You have seen this before, with the sign flipped: a softmax classifier\'s cross-entropy gradient was probabilities minus the one-hot label.', code: 'ce' },
        { id: 'supervised', say: 'So a policy gradient step is a supervised step on the model\'s own sample, as if it were the correct label.', code: 'ce' },
        { id: 'scaled', say: 'With one difference: the step is scaled by the reward. A great answer is learned strongly, and a poor one barely at all.' },
        { id: 'tokens', say: 'A language model ends in a softmax over its vocabulary, so the same formula holds at every token.' },
      ],
    },
    {
      id: 'reinforce',
      title: 'REINFORCE',
      codeTitle: 'reinforce.py',
      code: `
        theta = np.log([0.4, 0.1, 0.3, 0.2])
        for step in range(200):
            pi = softmax(theta)                #@pi
            y = np.random.choice(4, p=pi)      #@sample
            grad_logp = np.eye(4)[y] - pi      #@grad
            theta += lr * R[y] * grad_logp     #@update
        # step {{step:0}}: y = {{y:…}}

        # with autograd, a surrogate loss:
        loss = -(R * logp).mean()              #@loss
      `,
      beats: [
        { id: 'name', say: 'Put the pieces together, and you have the oldest policy gradient algorithm: {REINFORCE|reinforce}, from Ronald Williams in {1992|nineteen ninety two}.' },
        { id: 'loop', say: 'Sample an answer, grade it, and step uphill along reward times the gradient of its log probability. Repeat.', code: ['pi', 'sample', 'grad', 'update'] },
        { id: 'start', say: 'Watch it on our bandit. The policy starts as the base model, with forty percent on the wrong yes.', code: 'pi' },
        { id: 'steps', say: 'Each step samples one answer, ringed in gold, and nudges the logits.', code: ['sample', 'update'] },
        { id: 'wrong', say: 'Sampling a wrong answer changes nothing at all, because its reward is zero.', code: 'update' },
        { id: 'right', say: 'Sampling a rewarded answer pushes it up, and everything else down.', code: 'update' },
        { id: 'drift', say: 'Step by step, the policy drifts toward the best answer, and the expected reward climbs.' },
        { id: 'noisy', say: 'But look at the path: it is jagged, and every run would take a different one.' },
        { id: 'loss', say: 'In practice, we write a surrogate loss, minus the reward times the log probability, and let autograd do the rest.', code: 'loss' },
        { id: 'weighted', say: 'It is cross-entropy on the model\'s own samples, weighted by reward, and the reward is a plain constant, with no gradient through it.', code: 'loss' },
      ],
    },
    {
      id: 'baselines',
      title: 'Baselines and advantages',
      codeTitle: 'baseline.py',
      code: `
        r = R[y] + c        # shift every reward  #@shift
        A = r - b           # the advantage       #@adv
        theta += lr * A * grad_logp               #@upd
        b = 0.9 * b + 0.1 * r   # running mean    #@b

        # E[grad_logp] = 0, so subtracting b      #@zero
        # leaves the average gradient unchanged   #@zero
      `,
      beats: [
        { id: 'noise', say: '{REINFORCE|reinforce} works, but it is noisy, and the noise has a specific cause.' },
        { id: 'all', say: 'The update pushes up every sampled answer, in proportion to its reward, but the useful signal lives in the differences between rewards.', code: 'upd' },
        { id: 'runs', say: 'Here are eight runs with different seeds. They already disagree a little.' },
        { id: 'shift', say: 'Now add two points to every reward. Every answer gets pushed up, the good ones only slightly more than the bad.', code: 'shift' },
        { id: 'fan', say: 'On average, the gradient is exactly the same. But the eight runs fan out.', code: 'shift' },
        { id: 'stuck', say: 'Some lock onto a worse answer for good: whatever they sampled got pushed up, became likelier, and got sampled again.' },
        { id: 'fix', say: 'The fix is to judge each reward against what you expected. Subtract a baseline, b.', code: 'adv' },
        { id: 'adv', say: 'Reward minus baseline is the advantage, A: how much better than usual was this answer?', code: 'adv' },
        { id: 'why', say: 'Why is this allowed? Probabilities always add up to one, so the gradient of the log probability averages to zero: pushes up and down cancel.', code: 'zero' },
        { id: 'free', say: 'So subtracting b times it changes nothing on average. It only removes noise.', code: 'zero' },
        { id: 'tight', say: 'With a running mean as the baseline, the eight runs pull back together, shift or no shift.', code: 'b' },
        { id: 'teach', say: 'And an answer worse than usual is now pushed down, so even a wrong answer teaches something.', code: ['adv', 'upd'] },
        { id: 'family', say: 'The best baseline is close to the average reward. A running mean, the group mean in {GRPO|G R P O}, and the value function in {PPO|P P O} all estimate it.' },
      ],
    },
    {
      id: 'credit',
      title: 'Credit assignment over tokens',
      codeTitle: 'credit.py',
      code: `
        logp_t = token_logprobs(model, x, y)   #@tok
        A = R - R.mean()      # one per answer #@adv
        A_t = A[:, None] * mask  # every token #@share
        loss = -(A_t * logp_t).sum(-1).mean()  #@loss

        # average push per chunk, N = {{N:8}}  #@avg
      `,
      beats: [
        { id: 'tokens', say: 'A real answer is hundreds of tokens, and the reward arrives once, at the end.' },
        { id: 'which', say: 'So which tokens deserve the credit?' },
        { id: 'sum', say: 'The log probability of an answer is a sum over its tokens, so the policy gradient has one term per token.', code: ['tok', 'loss'] },
        { id: 'same', say: 'And with one reward at the end, every token of an answer gets the same advantage.', code: ['adv', 'share'] },
        { id: 'rows', say: 'Here are sampled answers: an opener, some work, and a verdict. Only the verdict is graded.' },
        { id: 'tint', say: 'Each chunk is tinted by its answer\'s advantage: green above average, red below.', code: 'share' },
        { id: 'filler', say: 'The filler, let me think, is pushed up in good answers and down in bad ones.' },
        { id: 'average', say: 'Average each chunk\'s push over more and more answers, and the filler nets out to zero. It never mattered.', code: 'avg' },
        { id: 'work', say: 'Working out seven times thirteen earns real credit, because it usually leads to the right verdict. Saying {91|ninety one} is odd earns blame.', code: 'avg' },
        { id: 'stats', say: 'Credit assignment emerges statistically. The price is noise, and more of it the longer the answers get.' },
        { id: 'value', say: 'A sharper tool is a value function: it predicts the final grade from a partial answer, and credits each token with the change it caused.' },
        { id: 'jump', say: 'Here the predicted grade jumps from {0.54|zero point five four} to {0.9|zero point nine} at seven times thirteen. That is {PPO|P P O}\'s critic, next chapter.' },
      ],
    },
    {
      id: 'kl',
      title: 'The KL leash',
      codeTitle: 'kl_leash.py',
      code: `
        kl_y = np.log(pi[y] / pi_ref[y])       #@kl
        r = R[y] - beta * kl_y                 #@pen

        # exact, for a handful of answers:
        kl = np.sum(pi * np.log(pi / pi_ref))  #@exact

        # the best policy, for a bandit:       #@opt
        # pi_ref * np.exp(R / beta), normalized  #@opt
        # beta = {{beta:3}}
      `,
      beats: [
        { id: 'hack', say: 'Optimize a reward hard enough, and the policy finds whatever the reward likes most, which is not always what we meant.' },
        { id: 'rm', say: 'Say a learned reward model has a blind spot: it scores a shouted answer at {1.2|one point two}, above the genuinely best one.' },
        { id: 'rare', say: 'The reference model almost never writes it, three percent of the time, and its true quality is zero.' },
        { id: 'leash', say: 'The fix is a leash. Keep a frozen copy of the starting model, the reference policy, and charge the policy for moving away from it.' },
        { id: 'kl', say: 'The distance is the {KL|K L} divergence: averaged over the policy\'s own answers, the log of how much likelier the policy finds them than the reference.', code: 'exact' },
        { id: 'penalty', say: 'It is charged inside the reward: the reward, minus beta times that log ratio. {REINFORCE|reinforce} needs no change.', code: ['kl', 'pen'] },
        { id: 'opt', say: 'For a bandit, the best policy has a closed form: the reference, reweighted by e to the reward over beta.', code: 'opt' },
        { id: 'loose', say: 'Let the leash go slack, with a tiny beta, and the policy abandons everything for the hack: the reward model\'s score climbs, and true quality collapses.', code: 'opt' },
        { id: 'tight', say: 'Pull it tight, with a large beta, and the policy barely leaves the reference.', code: 'opt' },
        { id: 'sweet', say: 'In between, around {0.2|zero point two}, the policy gets the most true quality.', code: 'opt' },
        { id: 'dpo', say: 'Remember that formula. Chapter sixteen turns it around to derive {DPO|D P O}.' },
      ],
    },
    {
      id: 'entropy',
      title: 'Exploration and entropy',
      codeTitle: 'explore.py',
      code: `
        H = -np.sum(pi * np.log(pi))      #@H
        grad_H = -pi * (np.log(pi) + H)   #@gH
        theta += lr * (A * grad_logp      #@upd
                       + tau * grad_H)    #@upd
        # tau = {{tau:0}}
      `,
      beats: [
        { id: 'only', say: 'One more failure, a quieter one. {REINFORCE|reinforce} can only reinforce answers the policy actually samples.' },
        { id: 'start', say: 'Start from a base model that rarely explains itself: the best answer gets only five percent.' },
        { id: 'squeeze', say: 'A decent, common answer gets sampled, pushed up, and squeezes the rare one further.' },
        { id: 'runs', say: 'Twelve runs. About half find the best answer. The other half lock onto a plain no, for good.' },
        { id: 'never', say: 'Once the best answer\'s probability is near zero, it is never sampled again, so it can never earn credit.' },
        { id: 'entropy', say: 'The measure of this is entropy: the average surprise of the policy\'s own samples.', code: 'H' },
        { id: 'range', say: 'It is zero when the policy always writes the same thing, and largest when it spreads evenly.', code: 'H' },
        { id: 'crash', say: 'In the stuck runs, the entropy crashes within a few dozen steps.' },
        { id: 'bonus', say: 'A small entropy bonus pays the policy to stay a little uncertain, so it keeps trying the alternatives.', code: ['gH', 'upd'] },
        { id: 'found', say: 'With a bonus of {0.1|zero point one}, all twelve runs find the best answer.', code: 'upd' },
        { id: 'much', say: 'Too much, and the policy stays random. In language model training, entropy is watched closely: a fast collapse is a warning sign.' },
      ],
    },
    {
      id: 'outro',
      title: 'The recipe, and what comes next',
      codeTitle: 'recipe.py',
      code: `
        for step in range(steps):
            y = sample(policy, x)          #@sample
            R = grade(x, y)                #@grade
            r = R - beta * kl(y)           #@kl
            A = r - baseline(x)            #@adv
            loss = -(A * logp(y)).mean()   #@loss
            loss.backward(); opt.step()    #@loss
      `,
      beats: [
        { id: 'recap', say: 'Here is the whole recipe on one screen.' },
        { id: 'sample', say: 'Sample answers from the policy.', code: 'sample' },
        { id: 'grade', say: 'Grade them, with any score you like.', code: 'grade' },
        { id: 'kl', say: 'Subtract a {KL|K L} penalty, to stay close to the reference.', code: 'kl' },
        { id: 'adv', say: 'Subtract a baseline, to turn rewards into advantages.', code: 'adv' },
        { id: 'loss', say: 'And step along the advantage, times the gradient of the log probability.', code: 'loss' },
        { id: 'rlhf', say: 'The next chapters swap in better parts. {RLHF|R L H F} learns the reward from human preferences, and {PPO|P P O} adds a critic and clipped steps that reuse samples.' },
        { id: 'dpo', say: '{DPO|D P O} skips the sampling loop entirely, using the closed form of the leash.' },
        { id: 'grpo', say: 'And {GRPO|G R P O} grades with a program, and uses a group of answers to the same prompt as its baseline.' },
        { id: 'explore', say: 'All three keep this same core: sample, grade, and raise the log probability of whatever beat the baseline. First up, {RLHF|R L H F}.', pause: 0.6 },
      ],
    },
  ],
};

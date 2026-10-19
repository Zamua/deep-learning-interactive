import type { ChapterDef } from './index';
import { DPO_SYMBOLS } from '../lib/dpo-symbols';
import { figCertain, figInvert, figLoss, figObjective, figPush, figRun } from '../lib/dpo-figs';

const chapter: ChapterDef = {
  symbols: DPO_SYMBOLS,

  render(p) {
    p.prose(`
[The RLHF chapter](#/rlhf) built a three-stage machine. First, supervised fine-tuning turns a pretrained model into a passable assistant. Second, a **reward model** learns from human comparisons which of two answers is better. Third, **PPO** pushes the assistant toward answers the reward model likes, while a KL penalty keeps it close to where it started. That is how InstructGPT was trained, and it works. It is also a lot of machinery: four networks in memory, fresh text sampled from the policy at every step, and a long list of settings that all have to be right at the same time.

In 2023, Rafael Rafailov, Archit Sharma, Eric Mitchell, Stefano Ermon, Christopher Manning and Chelsea Finn showed that the last two stages can be replaced by a single ordinary loss on the preference pairs. Their paper was called *Direct Preference Optimization: Your Language Model Is Secretly a Reward Model*. **DPO** trains no separate reward model, runs no reinforcement learning loop and samples no text during training, yet it optimizes the very same objective as RLHF. Within a year it had become a standard step in open model recipes, from Zephyr in late 2023 to Llama 3 in 2024.

The idea fits in five steps of algebra, and the whole chapter is built around them. We will walk them slowly, with code beside every line, on a toy small enough to see completely: **one prompt and four possible answers**.`);

    p.table(
      ['answer', 'to "How do I reverse a list in Python?"', 'reward', 'reference'],
      [
        ['**A** concise', '`xs[::-1]`, or `xs.reverse()` to do it in place.', '1.6', '0.15'],
        ['**B** rambling', 'The same advice, buried in three paragraphs of history.', '0.9', '0.45'],
        ['**C** wrong', '`xs.sort(reverse=True)` (this sorts; it does not reverse).', '−0.8', '0.25'],
        ['**D** refuses', '"I am sorry, I cannot help with that."', '−1.4', '0.15'],
      ],
      { caption: 'The toy used by every figure, with each answer\'s reward $\\symr$ and its probability under the reference model $\\sympiref$. The reference model (the SFT model) likes the rambling answer best; the hidden reward that our pretend labelers follow prefers the concise one. A real language model has astronomically many possible answers instead of four, but every formula below is the same.' },
    );

    // ------------------------------------------------------------------
    p.h2('Two ingredients from RLHF', 'recap');
    p.prose(`
DPO starts from two pieces of the RLHF pipeline. Both are covered properly in [RLHF and PPO](#/rlhf) and [policy gradients](#/policy-gradients); here is all we need from them.

**Preferences.** A labeler sees a prompt $x$ and two answers, and picks one. Call the chosen answer $\\symyw$ (w for *winner*) and the rejected one $\\symyl$ (l for *loser*). The **Bradley-Terry model** (Bradley and Terry, 1952) explains such choices with a hidden score per answer, the reward $\\symr(x, y)$: the bigger the gap between the two rewards, the more reliably the better answer gets picked.`);
    p.math({
      label: 'Bradley-Terry: preferences from a reward',
      tex: String.raw`P(\symyw \succ \symyl \mid x) = \sigma\big(\symr(x, \symyw) - \symr(x, \symyl)\big)`,
      code: `
        def sigmoid(z):
            return 1 / (1 + np.exp(-z))

        p_w = sigmoid(r_w - r_l)   # chance the labeler picks y_w
        loss_rm = -np.log(p_w)     # the reward model's training loss
      `,
      codeTitle: 'bradley_terry.py',
      terms: [
        [String.raw`\symyw \succ \symyl`, 'read "$\\symyw$ is preferred to $\\symyl$"'],
        [String.raw`\symr(x, y)`, 'the reward: one number scoring answer $y$ to prompt $x$'],
        [String.raw`\symr(x, \symyw) - \symr(x, \symyl)`, 'only the *difference* of the two rewards matters'],
        [String.raw`\sigma(z)`, 'the **sigmoid** $1 / (1 + e^{-z})$: it squashes any number into a probability between 0 and 1. $\\sigma(0) = 0.5$, big positive $z$ gives nearly 1, big negative nearly 0'],
      ],
      explain: `Equal rewards make the choice a coin flip. A reward gap of 2 makes the better answer win 88% of the time, never 100%: labelers are noisy. In RLHF, a reward model is trained by minimizing $-\\log P$ on the labeled pairs, which is exactly the two-class softmax loss of [the linear classifier](#/linear-classification) with the reward gap as the score. Keep this equation in mind: it is where the derivation will end.`,
    });

    p.prose(`
**The objective.** RLHF then looks for a policy $\\sympi$ (the language model, giving a probability $\\sympi(y \\mid x)$ to every possible answer) that earns a high reward *without* drifting far from the reference model $\\sympiref$, a frozen copy of the SFT model. Drift is measured with the KL divergence and charged at a price $\\symbeta$:`);
    p.math({
      label: 'The KL-regularized objective',
      tex: String.raw`\begin{aligned} &\max_{\sympi}\; \mathbb{E}_{x}\Big[\, \mathbb{E}_{y \sim \sympi(\cdot \mid x)}\big[\symr(x, y)\big] \\ &\qquad -\, \symbeta\, \mathrm{KL}\big(\sympi(\cdot \mid x) \,\|\, \sympiref(\cdot \mid x)\big) \Big] \end{aligned}`,
      code: `
        def J(pi, pi_ref, r, beta):         # one prompt, all answers
            reward = (pi * r).sum()         # expected reward
            kl = (pi * np.log(pi / pi_ref)).sum()
            return reward - beta * kl
      `,
      codeTitle: 'objective.py',
      terms: [
        [String.raw`\max_{\sympi}`, 'find the policy that makes everything after it as large as possible'],
        [String.raw`\mathbb{E}_{y \sim \sympi}\big[\symr\big]`, 'the **expected reward**: the average reward of answers drawn from the policy, $\\sum_y \\sympi(y)\\,\\symr(y)$'],
        [String.raw`\mathrm{KL}\big(\sympi \,\|\, \sympiref\big)`, 'how far the policy has moved away from the reference model (see the box below)'],
        [String.raw`\symbeta`, 'the price of moving: a big $\\symbeta$ is a short leash'],
        [String.raw`\mathbb{E}_{x}`, 'averaged over the prompts. Each prompt is its own separate problem, so from now on we fix one prompt $x$'],
      ],
      explain: `Without the KL term, the best policy would put all its probability on the single answer the reward model rates highest, which is usually an answer that exploits a flaw in the reward model (the reward hacking of the RLHF chapter). The KL term says: stay a fluent, sensible model like $\\sympiref$, and only move where the reward makes it worth it. PPO maximizes this objective by trial and error. DPO will maximize it with algebra.`,
    });

    p.callout('math', `An **expectation** $\\mathbb{E}_{y \\sim \\sympi}[f(y)]$ is a probability-weighted average: $\\sum_y \\sympi(y) f(y)$. For a language model the sum runs over every possible answer, which is far too many to list, so in practice it is estimated by sampling.

The **log-probability** of a whole answer is the sum of the log-probabilities of its tokens, each given the ones before it (the chain rule from [pretraining](#/pretraining)). So $\\log \\sympi(y \\mid x)$ is one number per answer, and the ratio $\\sympi(y) / \\sympiref(y)$ says how much more (above 1) or less (below 1) likely the policy has made that answer than the reference did. Its log, the **log ratio**, is positive or negative accordingly.

The **KL divergence** $\\mathrm{KL}(\\sympi \\,\\|\\, \\sympiref) = \\sum_y \\sympi(y) \\log \\frac{\\sympi(y)}{\\sympiref(y)}$ is the average log ratio, averaged over the policy's own answers. It is 0 exactly when the two distributions are identical and positive otherwise. It is not symmetric: swapping the two arguments gives a different number.`, 'Math help: expectations, log ratios and KL');

    // ------------------------------------------------------------------
    p.h2('Steps 1 and 2: the best policy has a formula', 'optimal-policy');
    p.prose(`
Here is the surprise that makes DPO possible. For a fixed prompt, the KL-regularized objective has an exact, closed-form maximizer. You do not need PPO to find it: you can write it down. Take the reference model, multiply each answer's probability by $e^{\\symr / \\symbeta}$, and renormalize so the probabilities add up to 1 again.`);
    p.math({
      label: 'Step 2: the optimal policy',
      tex: String.raw`\begin{aligned} \sympistar(y \mid x) &= \frac{1}{\symZ(x)}\, \sympiref(y \mid x)\, e^{\symr(x, y) / \symbeta} \\ \symZ(x) &= \sum_{y} \sympiref(y \mid x)\, e^{\symr(x, y) / \symbeta} \end{aligned}`,
      code: `
        pi_star = pi_ref * np.exp(r / beta)   # reweight each answer
        Z = pi_star.sum()                     # over EVERY answer
        pi_star = pi_star / Z                 # make it sum to 1
      `,
      codeTitle: 'optimal_policy.py',
      terms: [
        [String.raw`\sympiref(y \mid x)`, 'start from what the reference model would say'],
        [String.raw`e^{\symr / \symbeta}`, 'multiply by a factor that grows with the reward. Each extra $\\symbeta$ of reward multiplies the weight of an answer by $e \\approx 2.7$, before renormalizing'],
        [String.raw`\symZ(x)`, 'the **normalizer** (also called the partition function): the total after reweighting. Dividing by it makes the probabilities sum to 1. It depends on the prompt $x$, but not on any particular answer'],
      ],
      explain: `The reference model's opinion is kept, then tilted toward high reward. How hard it tilts depends on $\\symbeta$: with a small $\\symbeta$ the exponent is large and the best answer takes almost everything; with a large $\\symbeta$ the factors are all close to 1 and $\\sympistar$ stays close to $\\sympiref$. One catch, which will matter in a moment: for a language model, $\\symZ(x)$ is a sum over *every possible answer*, more strings than there are atoms in the universe. Nobody can compute it.`,
    });

    p.prose(`
### Why is that the maximum?

It takes four lines. Write the KL out as a sum and put the reward inside it, so the objective for one prompt is $J(\\sympi) = \\sum_y \\sympi(y)\\,\\big[\\symr(y) - \\symbeta \\log \\frac{\\sympi(y)}{\\sympiref(y)}\\big]$. Then:

1. A reward can be written as a log: $\\symr(y) = \\symbeta \\log e^{\\symr(y)/\\symbeta}$. So the bracket becomes $-\\symbeta \\log \\frac{\\sympi(y)}{\\sympiref(y)\\, e^{\\symr(y)/\\symbeta}}$.
2. By the definition of $\\sympistar$, the denominator $\\sympiref(y)\\,e^{\\symr(y)/\\symbeta}$ is exactly $\\symZ\\,\\sympistar(y)$.
3. Split the log of that product: the bracket is $-\\symbeta \\log \\frac{\\sympi(y)}{\\sympistar(y)} + \\symbeta \\log \\symZ$.
4. Average over $\\sympi$. The first part becomes a KL divergence, and the second is a constant.`);
    p.math({
      label: 'The objective, rewritten',
      tex: String.raw`J(\sympi) \;=\; \symbeta \log \symZ(x) \;-\; \symbeta\, \mathrm{KL}\big(\sympi \,\|\, \sympistar\big)`,
      code: `
        best = beta * np.log(Z)
        gap = beta * (pi * np.log(pi / pi_star)).sum()
        np.isclose(J(pi, pi_ref, r, beta), best - gap)   # True, any pi
      `,
      codeTitle: 'why_optimal.py',
      terms: [
        [String.raw`\symbeta \log \symZ(x)`, 'a number that does not depend on the policy at all'],
        [String.raw`\mathrm{KL}\big(\sympi \,\|\, \sympistar\big)`, 'how far the policy is from $\\sympistar$: zero when they match, positive otherwise'],
      ],
      explain: `So the objective is a fixed ceiling, $\\symbeta \\log \\symZ$, minus a penalty for being anywhere other than $\\sympistar$. The only way to reach the ceiling is to make the KL zero, which means $\\sympi = \\sympistar$. That proves the formula. It was known long before DPO, from older work on KL-regularized reinforcement learning; DPO's contribution was to run it backwards. The figure lets you check the identity by hand.`,
    });

    figObjective(p);

    p.callout('intuition', 'If we could just compute $\\sympistar$ and sample from it, RLHF would be done. Two things stand in the way: we do not know the true reward $\\symr$ (only a learned approximation of it), and we cannot compute $\\symZ$. DPO gets rid of both at once.', 'So why not just use the formula?');

    // ------------------------------------------------------------------
    p.h2('Step 3: turn the formula around', 'invert');
    p.prose(`
The formula says how to get a policy from a reward. Read it backwards and it says how to get a reward from a policy. Take the log of both sides, $\\log \\sympistar = \\log \\sympiref + \\symr / \\symbeta - \\log \\symZ$, and solve for $\\symr$:`);
    p.math({
      label: 'Step 3: the reward, written with the policy',
      tex: String.raw`\begin{aligned} \symr(x, y) &= \symbeta \log \frac{\sympistar(y \mid x)}{\sympiref(y \mid x)} \\ &\quad +\, \symbeta \log \symZ(x) \end{aligned}`,
      code: `
        r_hat = beta * np.log(pi_star / pi_ref)   # implicit reward
        np.allclose(r, r_hat + beta * np.log(Z))  # True
      `,
      codeTitle: 'invert.py',
      terms: [
        [String.raw`\symbeta \log \frac{\sympistar(y \mid x)}{\sympiref(y \mid x)}`, 'the **implicit reward** $\\hat r$: $\\symbeta$ times the log ratio. Positive for answers the optimal policy made more likely than the reference did, negative for answers it made less likely'],
        [String.raw`\symbeta \log \symZ(x)`, 'a correction that depends only on the prompt: the same number is added to every answer of the same prompt'],
      ],
      explain: `Every reward function determines its optimal policy, and this equation says the reverse also holds, up to that one per-prompt constant. Look at what a policy is "saying" when it raises an answer's probability above the reference: it is implying that answer has a high reward. A policy *is* a reward model in disguise, which is the "secretly" in the paper's title.`,
    });

    p.prose(`
We still cannot compute $\\symZ(x)$. But look at what it is: one number per prompt, added equally to the reward of every answer to that prompt. And the reward of one answer, on its own, was never the point.`);

    // ------------------------------------------------------------------
    p.h2('Step 4: the prompt term cancels', 'cancel');
    p.prose(`
Bradley-Terry only ever uses *differences* of rewards for the same prompt. So substitute the expression from step 3 for both rewards in a pair. Each brings its own $\\symbeta \\log \\symZ(x)$, the two are identical because the prompt is the same, and the subtraction removes them:`);
    p.math({
      label: 'Step 4: Bradley-Terry with the implicit reward',
      tex: String.raw`\begin{aligned} P(\symyw \succ \symyl \mid x) = \sigma\Big(&\symbeta \log \frac{\sympistar(\symyw \mid x)}{\sympiref(\symyw \mid x)} \\ &-\, \symbeta \log \frac{\sympistar(\symyl \mid x)}{\sympiref(\symyl \mid x)}\Big) \end{aligned}`,
      code: `
        r_w = beta * np.log(pi_star[y_w] / pi_ref[y_w]) + beta * np.log(Z)
        r_l = beta * np.log(pi_star[y_l] / pi_ref[y_l]) + beta * np.log(Z)
        p_w = sigmoid(r_w - r_l)        # the two log Z terms cancel
      `,
      codeTitle: 'cancel.py',
      terms: [
        [String.raw`\symbeta \log \frac{\sympistar(\symyw)}{\sympiref(\symyw)}`, 'the implicit reward of the chosen answer'],
        [String.raw`\symbeta \log \frac{\sympistar(\symyl)}{\sympiref(\symyl)}`, 'the implicit reward of the rejected answer'],
        [String.raw`\sigma(\ldots)`, 'the same sigmoid as before, of the same reward gap, now with no $\\symZ$ and no reward model left in it'],
      ],
      explain: `The probability that humans prefer one answer to another is now written entirely with the optimal policy and the reference model. The unknown reward has disappeared, and so has the incomputable normalizer. Everything left can be evaluated: two log-probabilities under each model.`,
    });

    figInvert(p);

    p.callout('aside', 'Rewards were never unique in the first place. Adding the same constant to every answer of a prompt changes no Bradley-Terry probability, so no amount of preference data can pin it down. Step 3 only loses information the data never contained, which is why the implicit reward is no less general than an explicit reward model: every reward model can be expressed this way.', 'Nothing was lost');

    // ------------------------------------------------------------------
    p.h2('Step 5: the DPO loss', 'loss');
    p.prose(`
Step 4 describes the preferences that the *optimal* policy implies. Now turn it into a training rule. Replace $\\sympistar$ by the model we are training, $\\sympi$, and ask the same question we asked of the reward model in RLHF: how likely are the labels in our dataset under this model? Make that likelihood as large as possible, which means making the negative log-likelihood as small as possible:`);
    p.math({
      label: 'Step 5: the DPO loss',
      tex: String.raw`\begin{aligned} \mathcal{L}_{\text{DPO}} &= -\,\mathbb{E}_{(x, \symyw, \symyl) \sim \mathcal{D}}\big[\log \sigma(\symm)\big] \\ \symm &= \symbeta \log \frac{\sympi(\symyw \mid x)}{\sympiref(\symyw \mid x)} \\ &\quad -\, \symbeta \log \frac{\sympi(\symyl \mid x)}{\sympiref(\symyl \mid x)} \end{aligned}`,
      code: `
        def log_sigmoid(z):
            return -np.logaddexp(0, -z)    # log(sigmoid(z)), stable

        def dpo_loss(logp_w, logp_l, ref_w, ref_l, beta=0.1):
            # one entry per pair: log-probs of whole answers
            margin = beta * ((logp_w - ref_w) - (logp_l - ref_l))
            return -log_sigmoid(margin).mean()
      `,
      codeTitle: 'dpo_loss.py',
      terms: [
        [String.raw`(x, \symyw, \symyl) \sim \mathcal{D}`, 'average over the pairs in a fixed preference dataset $\\mathcal{D}$'],
        [String.raw`\log \frac{\sympi(\symyw \mid x)}{\sympiref(\symyw \mid x)}`, 'how much the model being trained has raised the chosen answer relative to the reference (as a log ratio). In code: `logp_w - ref_w`'],
        [String.raw`\symm`, 'the **implicit reward margin**: $\\symbeta$ times the gap between the two log ratios. In code: `margin`'],
        [String.raw`-\log \sigma(\symm)`, 'logistic loss: near 0 when the margin is large and positive, growing in a straight line when it is negative'],
      ],
      explain: `This is binary classification. Each pair is one example whose label is always "the first answer won", and the classifier's score is the implicit reward margin. The parameters being learned are the language model's own weights, through $\\log \\sympi(\\symyw \\mid x)$ and $\\log \\sympi(\\symyl \\mid x)$. The reference model only contributes two fixed numbers per pair. If the model could represent every policy, the minimum of this loss on unlimited data would be exactly $\\sympistar$, the optimum of the RLHF objective: same goal, no reward model, no reinforcement learning.`,
    });

    p.prose(`
At the start of training $\\sympi = \\sympiref$, so every log ratio is 0, every margin $\\symm$ is 0, and the loss is $-\\log \\sigma(0) = \\log 2 \\approx 0.693$ on every pair. That number is the first line of every DPO training log. The figure shows the loss for one pair as a function of the gap $h$ between the two log ratios, so that $\\symm = \\symbeta h$.`);

    figLoss(p);

    // ------------------------------------------------------------------
    p.h2('What the gradient does', 'gradient');
    p.prose(`
Differentiate the loss for one pair (the sigmoid's derivative is $\\sigma(z)\\,\\sigma(-z)$, and the derivative of $-\\log \\sigma(z)$ works out to $-\\sigma(-z)$) and something readable appears. Write $\\hat r(y) = \\symbeta \\log \\frac{\\sympi(y \\mid x)}{\\sympiref(y \\mid x)}$ for the implicit reward the current model assigns:`);
    p.math({
      label: 'The DPO gradient',
      tex: String.raw`\begin{aligned} \nabla_\theta \mathcal{L}_{\text{DPO}} &= -\symbeta\, \mathbb{E}\Big[\sigma(-\symm) \times \\ &\qquad \big(\nabla_\theta \log \sympi(\symyw \mid x) \\ &\qquad -\, \nabla_\theta \log \sympi(\symyl \mid x)\big)\Big] \\ \sigma(-\symm) &= \sigma\big(\hat r(\symyl) - \hat r(\symyw)\big) \end{aligned}`,
      code: `
        r_hat_w = beta * (logp_w - ref_w)     # implicit rewards
        r_hat_l = beta * (logp_l - ref_l)
        weight = sigmoid(r_hat_l - r_hat_w)   # = sigmoid(-margin)
        # d loss / d logp_w = -beta * weight   (raise the chosen)
        # d loss / d logp_l = +beta * weight   (lower the rejected)
      `,
      codeTitle: 'dpo_grad.py',
      terms: [
        [String.raw`\nabla_\theta \log \sympi(\symyw \mid x)`, 'the direction in weight space that makes the chosen answer more likely. Gradient descent moves along it'],
        [String.raw`- \nabla_\theta \log \sympi(\symyl \mid x)`, 'and away from the direction that makes the rejected answer more likely'],
        [String.raw`\sigma(-\symm) = \sigma\big(\hat r(\symyl) - \hat r(\symyw)\big)`, 'the **weight**: close to 1 when the implicit reward ranks the pair the wrong way round, close to 0 when it already ranks it correctly by a wide margin'],
      ],
      explain: `Every step raises the chosen answer and lowers the rejected one, like supervised learning on the chosen answers combined with "unlearning" the rejected ones. The weight is what makes it work: each pair is weighted by how wrong the model's implicit reward currently is about it. Pairs the model already gets right stop pulling, so the model does not keep pushing probabilities to extremes. The DPO paper notes that a naive version without this weight can make the model degenerate.`,
    });

    figPush(p);

    p.prose(`
Notice also what the gradient does *not* contain: any sample from the policy. It needs the log-probabilities of two answers someone else already wrote. In the language of [policy gradients](#/policy-gradients), DPO is not a policy-gradient method at all; it is supervised learning with a cleverly chosen loss.`);

    // ------------------------------------------------------------------
    p.h2('A whole run, in miniature', 'toy-run');
    p.prose(`
Here is the full claim tested end to end. We sample 1,000 preference pairs once, from the reference model, and label them with a noisy Bradley-Terry labeler that follows the hidden rewards in the table at the top. Then we train the four logits of a policy with the DPO loss and Adam. The training loop never sees a reward and never generates an answer. If the derivation is right, the policy should land on $\\sympistar$, the answer to the RLHF problem.`);

    figRun(p);

    // ------------------------------------------------------------------
    p.h2('The role of β', 'beta');
    p.prose(`
$\\symbeta$ appears twice, and both appearances say the same thing.

In the **objective**, it is the price of drifting from the reference model. In $\\sympistar \\propto \\sympiref\\, e^{\\symr/\\symbeta}$ ($\\propto$ means "proportional to": equal up to the normalizer), a small $\\symbeta$ makes the exponent large, and the policy concentrates on the highest-reward answer whatever the reference thought. A large $\\symbeta$ keeps the policy close to $\\sympiref$.

In the **loss**, it is the exchange rate between log ratios and rewards: $\\hat r = \\symbeta \\log(\\sympi/\\sympiref)$. The loss is mostly satisfied once the margin $\\symm$ is a few units, so the log ratios have to move by a few units *divided by* $\\symbeta$. With $\\symbeta = 0.1$, a margin of 3 needs a log-ratio gap of 30, an enormous change in probability; with $\\symbeta = 1$, a gap of 3 will do. You saw this in Fig 16.3: shrinking $\\symbeta$ stretches the loss curve sideways.`);
    p.table(
      ['', 'small value: loose leash', 'large value: short leash'],
      [
        ['$\\sympistar$', 'piles onto the highest-reward answers', 'stays close to $\\sympiref$'],
        ['log ratios needed for a given margin', 'large: the model moves far', 'small: the model barely moves'],
        ['risk', 'overfitting the preferences, losing fluency', 'learning too little from the data'],
      ],
      { caption: 'What a small or large $\\symbeta$ does. Most runs use a value near 0.1, the default in the DPO paper. Note that $\\symbeta$ is only a price, not a hard limit: the section on limits shows a case where DPO ignores it.' },
    );

    // ------------------------------------------------------------------
    p.h2('The practical recipe', 'recipe');
    p.prose(`
Everything above assumed we can compute $\\log \\sympi(y \\mid x)$ for a whole answer. For a language model that is one forward pass: run the prompt and answer through the model, read off the log-probability of each answer token given everything before it, and add them up. The prompt's tokens are masked out, exactly as in [supervised fine-tuning](#/finetuning).`);
    p.math({
      label: 'Log-probability of a whole answer',
      tex: String.raw`\log \sympi(y \mid x) = \sum_{t=1}^{|y|} \log \sympi\big(y_t \mid x, y_{<t}\big)`,
      code: `
        def seq_logp(model, ids, resp_mask):
            lp = model(ids).logits[:, :-1].log_softmax(-1)
            tok = lp.gather(-1, ids[:, 1:, None]).squeeze(-1)
            return (tok * resp_mask[:, 1:]).sum(-1)  # answer tokens only
      `,
      codeTitle: 'seq_logp.py',
      terms: [
        [String.raw`y_t`, 'the $t$-th token of the answer'],
        [String.raw`y_{<t}`, 'all the answer tokens before it'],
        [String.raw`\sum_{t=1}^{|y|}`, 'add up over every token of the answer; $|y|$ is its length in tokens'],
      ],
      explain: 'The model predicts every next token in one parallel pass (teacher forcing), so the log-probability of a 500-token answer costs one forward pass, not 500. `gather` picks out the log-probability of the token that actually came next; the mask keeps only the answer\'s tokens.',
    });
    p.prose(`
The whole method is then:

1. **Start from an SFT model.** Make two copies: the policy $\\sympi$, which is trained, and the reference $\\sympiref$, which is frozen. (If no SFT model exists, the DPO paper suggests first fine-tuning on the chosen answers, so that the reference matches the data.)
2. **Collect preference pairs, once.** Triples $(x, \\symyw, \\symyl)$ from human labelers or a strong model acting as a judge. Public sets such as Anthropic's HH-RLHF and UltraFeedback were used to train many open models.
3. **Compute the reference log-probabilities.** Since $\\sympiref$ never changes, its two numbers per pair can even be computed ahead of time, and the reference model need not be kept in memory at all.
4. **Train with the DPO loss**, usually for one to a few passes over the data with a small learning rate. Watch the loss fall from 0.693, and the *reward accuracy*: the share of pairs where $\\hat r(\\symyw) > \\hat r(\\symyl)$.`);
    p.code(`
      # one DPO training step (PyTorch-style)
      with torch.no_grad():                   # frozen reference
          ref_w = seq_logp(ref, chosen, mask_w)
          ref_l = seq_logp(ref, rejected, mask_l)
      logp_w = seq_logp(policy, chosen, mask_w)
      logp_l = seq_logp(policy, rejected, mask_l)

      margin = beta * ((logp_w - ref_w) - (logp_l - ref_l))
      loss = -F.logsigmoid(margin).mean()
      loss.backward()
      opt.step(); opt.zero_grad()

      acc = (margin > 0).float().mean()       # reward accuracy
    `, { title: 'dpo_step.py' });
    p.table(
      ['', 'RLHF with PPO', 'DPO'],
      [
        ['models during training', 'policy, reference, reward model, value model', 'policy and reference (or cached reference numbers)'],
        ['text generated during training', 'every step, from the current policy', 'none'],
        ['reward model', 'trained first, then queried', 'none: the policy is its own reward model'],
        ['data', 'prompts, plus the pairs that trained the reward model', 'a fixed list of pairs'],
        ['main settings', 'learning rates, KL coefficient, clip range, GAE, value loss, batch sizes', 'β and the learning rate'],
        ['can try new answers', 'yes', 'no'],
      ],
      { caption: 'The same objective, two ways to optimize it. The last row is the price DPO pays for the others.' },
    );
    p.prose(`
On the paper's three tasks (steering movie reviews toward positive sentiment, summarization, and single-turn dialogue) DPO matched or beat PPO-based RLHF with far less effort. Its simplicity, stability and low cost are why it spread so fast.`);

    // ------------------------------------------------------------------
    p.h2('Known limits', 'limits');
    p.prose(`
DPO's strengths and weaknesses come from the same place: it never leaves the dataset.

- **No exploration.** PPO grades the policy's own fresh answers, so if the policy drifts somewhere bad, the reward model sees it and pushes back. DPO only ever looks at the answers in its fixed pairs, usually written by a different model (the SFT model, or other models entirely). Once the policy moves, it produces text no one ever judged: this is **distribution shift**. A common remedy is iterative or *online* DPO: generate new pairs from the current policy, label them with a reward model or a judge, train, and repeat. It brings back some of RL's sampling cost, and much of its benefit.
- **Certain preferences break the leash.** If every label in the data says A beats B, the loss keeps shrinking as the gap grows, so the optimum is at infinity: $\\sympi(B)$ is driven toward 0 however large $\\symbeta$ is. With finite data, many pairs look like this, since each was labeled only once. In practice training is stopped early, after one or a few passes. The figure below shows the effect and the fix proposed by IPO.
- **Both answers can lose probability.** The loss only cares about the *gap* between the two log ratios. It is very common for the log-probability of the chosen answer to fall during training too, as long as the rejected one falls faster. In a real network, with weights shared across all answers, the probability that leaves both has to go somewhere, sometimes to answers that were never in the data.
- **Length and style.** If the chosen answers in a dataset tend to be longer, DPO learns that length is rewarded, and models trained with it often grow more verbose.
- **Not always the best.** Several 2024 studies found that carefully tuned PPO, or online variants of preference optimization, can beat offline DPO, especially on harder tasks like reasoning and code. DPO is the strong, cheap baseline; [reinforcement learning from verifiable rewards](#/grpo) is where the next chapter goes when the answers can be checked.`);

    figCertain(p);

    // ------------------------------------------------------------------
    p.h2('Variants', 'variants');
    p.prose(`
DPO started a family. Most members keep its shape, a loss on a function of log-probabilities with no sampling, and change one ingredient. Three are worth knowing by name.`);
    p.table(
      ['variant', 'what it changes', 'loss for one example'],
      [
        ['**IPO** (Azar et al., 2023)', 'Replaces the logistic loss with a squared loss that pulls the log-ratio gap $h$ to a fixed target, so certain preferences cannot push forever.', '$\\big(h - \\tfrac{1}{2\\tau}\\big)^2$'],
        ['**KTO** (Ethayarajh et al., 2024)', 'Needs no pairs: each answer just gets a thumbs up or a thumbs down. Inspired by Kahneman and Tversky\'s prospect theory, it compares each answer\'s implicit reward with a reference point $z_0$ (an estimate of the KL between policy and reference).', 'up: $1 - \\sigma\\big(\\symbeta(\\hat r - z_0)\\big)$; down: $1 - \\sigma\\big(\\symbeta(z_0 - \\hat r)\\big)$, each times a weight, with $\\hat r = \\log \\frac{\\sympi}{\\sympiref}$'],
        ['**SimPO** (Meng et al., 2024)', 'Drops the reference model: the implicit reward is the *average* log-probability per token, which also removes the pull toward long answers, and a target margin $\\gamma$ is added.', 'see below'],
      ],
    );
    p.math({
      label: 'SimPO: no reference model',
      tex: String.raw`\begin{aligned} \mathcal{L}_{\text{SimPO}} = -\log \sigma\Big(&\frac{\symbeta}{|\symyw|} \log \sympi(\symyw \mid x) \\ &-\, \frac{\symbeta}{|\symyl|} \log \sympi(\symyl \mid x) \\ &-\, \gamma\Big) \end{aligned}`,
      code: `
        avg_w = logp_w / len_w        # mean log-prob per token
        avg_l = logp_l / len_l
        loss = -log_sigmoid(beta * (avg_w - avg_l) - gamma)
        # no reference model anywhere
      `,
      codeTitle: 'simpo.py',
      terms: [
        [String.raw`\frac{1}{|\symyw|} \log \sympi(\symyw \mid x)`, 'the average log-probability per token of the chosen answer: a long answer is not penalized just for having more tokens'],
        [String.raw`\gamma`, 'a target margin: the chosen answer must win by at least this much before the loss relaxes'],
      ],
      explain: 'Without $\\sympiref$ there is no explicit leash; SimPO relies on a small learning rate and short training to stay close to the starting model, and saves the memory and compute of the reference model. Which variant wins depends on the data and the model; none has replaced DPO everywhere.',
    });

    p.callout('idea', `
- RLHF's objective, expected reward minus $\\symbeta$ times the KL to $\\sympiref$, has a closed-form optimum: $\\sympistar \\propto \\sympiref\\, e^{\\symr/\\symbeta}$.
- Inverted, any policy implies a reward, $\\hat r = \\symbeta \\log(\\sympi/\\sympiref)$, up to a per-prompt constant $\\symbeta \\log \\symZ$ that nobody can compute.
- Bradley-Terry uses only reward differences within a prompt, so that constant cancels, and maximum likelihood on the pairs becomes the **DPO loss**: logistic regression on the implicit reward margin $\\symm$.
- The gradient raises $\\symyw$ and lowers $\\symyl$, weighted by $\\sigma(-\\symm)$: how wrong the current implicit reward is about the pair.
- $\\symbeta$ is both the leash and the exchange rate between log ratios and reward.
- DPO is simple, stable and cheap (two models, no sampling), but offline: it cannot explore, it can drift where the data says nothing, and certain preferences can push it past its leash. IPO, KTO and SimPO each change one piece.`, 'Takeaways');

    // ------------------------------------------------------------------
    p.h2('Build it yourself', 'exercises');
    p.prose(`
1. **The loss and its gradient (10 minutes).** In NumPy, write \`dpo_loss(logp_w, logp_l, ref_w, ref_l, beta)\` returning the mean loss and its gradients with respect to \`logp_w\` and \`logp_l\`. Check the gradients against a numerical gradient (as in [the optimization chapter](#/optimization)). *Success:* the check passes, the loss is exactly $\\log 2$ when \`logp_w == ref_w\` and \`logp_l == ref_l\`, and every pair's gradient weight is then one half.

2. **Prove step 2 numerically.** For the four-answer toy, maximize $J(\\sympi)$ directly with gradient ascent on four logits (no formula), for $\\symbeta$ in 0.1, 0.5, 1 and 5. Compare with $\\sympiref e^{\\symr/\\symbeta} / \\symZ$, and check that the maximum value is $\\symbeta \\log \\symZ$. *Success:* agreement to six decimal places, and you can explain in one sentence why a small $\\symbeta$ picks answer A while a large one stays near B.

3. **Tabular DPO and sample size.** Rebuild Fig 16.5: sample $N$ pairs from $\\sympiref$, label them with Bradley-Terry using the true rewards, and train four logits with the DPO loss. Plot $\\mathrm{KL}(\\sympi \\,\\|\\, \\sympistar)$ after training for $N$ from 30 to 30,000. Then sample the pairs from a *different* model that almost never writes answer A, and repeat. *Success:* the KL falls steadily with $N$ in the first case; in the second you can see, and explain, what goes wrong with A.

4. **DPO versus IPO under certain labels.** Make a dataset where every label says A beats B, and train both losses on it for 5,000 steps with Adam. Track the log-ratio gap and $\\mathrm{KL}(\\sympi \\,\\|\\, \\sympiref)$ over time, for three values of $\\symbeta$. *Success:* the DPO gap keeps growing for every $\\symbeta$, and the IPO gap settles at $1/(2\\tau)$.

5. **Project: DPO on a small language model.** Take a small open model (GPT-2 or a model of a few hundred million parameters), and a few thousand pairs from a public preference set (Anthropic HH-RLHF or UltraFeedback). Implement \`seq_logp\` and the loss yourself in PyTorch, cache the reference log-probabilities, and train with $\\symbeta = 0.1$ and a learning rate around $10^{-6}$ for one pass. Log the loss, reward accuracy on held-out pairs, and the average log-probability of chosen and of rejected answers. *Success:* held-out reward accuracy clearly above 50%, a loss curve that starts at 0.693, and an answer to the question: did the chosen answers become more likely, or just less unlikely than the rejected ones?`);
  },
};

export default chapter;

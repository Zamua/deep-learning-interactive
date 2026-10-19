import type { ChapterDef } from './index';
import { REASONING_SYMBOLS } from '../lib/reasoning-symbols';
import { figBestOfN, figBudget, figCoverage, figCups, figPrm, figVote } from '../lib/reasoning-figs';

const chapter: ChapterDef = {
  symbols: REASONING_SYMBOLS,

  render(p) {
    p.prose(`
Every chapter so far has spent compute on *training*: [pretraining](#/pretraining) on trillions of tokens, then [RLHF](#/rlhf), [DPO](#/dpo) and [GRPO](#/grpo) to shape the model. Once training ends, the model answers each question with whatever one pass of the network, one token at a time, happens to produce.

This chapter is about the other place to spend compute: at *answer time*, also called test time or inference time. The same weights can answer much better if they are allowed to

- **think longer**: write out intermediate steps, a *chain of thought*, before the answer;
- **think wider**: sample many answers and vote, or let a separate *verifier* pick the best one;
- **think smarter**: search over partial solutions, scoring each step as it is written.

We start with why writing steps helps a network of fixed depth at all, then work through the math of voting and verifiers, the difference between grading answers and grading steps, how test-time compute trades against model size, and finally the reasoning models (o1, R1) that are trained with RL to do all of this inside one long chain of thought, how their thinking is budgeted, and how it is distilled into small models.`);

    // ------------------------------------------------------------ serial computation
    p.h2('Why writing steps helps', 'serial');
    p.prose(`
A transformer does a fixed amount of work per token: the input goes up through $\\symL$ layers, and out comes a distribution over the next token ([the Transformer chapter](#/transformer)). Inside one forward pass, the longest chain of computations that depend on each other is bounded by the depth. Layer 7 can use what layer 6 computed, but nothing in the pass can use the result of a computation that would need layer 200.

Now let the model write a token, and feed that token back in. The token is computed at the *top* of the network and read at the *bottom* of the next pass, so the next pass can continue from where the last one ended. Each written token buys another $\\symL$ layers of serial computation. A chain of thought of $\\symT$ tokens turns a fixed-depth network into one that can take roughly $\\symL \\cdot \\symT$ dependent steps.`);
    p.math({
      label: 'Serial steps with a chain of thought',
      tex: String.raw`\text{serial steps} \;\approx\; \symL \cdot (\symT + 1)`,
      codeTitle: 'depth.py',
      code: `
        L = 32          # layers in the model
        T = 2000        # chain-of-thought tokens before the answer
        serial = L * (T + 1)    # 64,032, versus 32 with no thinking
      `,
      terms: [
        [String.raw`\symL`, 'the number of layers: the most dependent steps one forward pass can take'],
        [String.raw`\symT`, 'the number of reasoning tokens written before the answer'],
        [String.raw`+1`, 'the pass that writes the answer itself'],
        [String.raw`\approx`, 'roughly: one layer can do several things side by side, so this counts the *chain* of steps, not all the work'],
      ],
      explain: 'Inside a pass, a later position can read what earlier positions computed at the same layer (that is what attention does), but the only route from the top of the network at one position back to the bottom is the token it writes. So writing tokens is the one way a fixed network gets more serial depth for a single question. The cost is one full forward pass per token, which is why long reasoning is slow and expensive to serve ([fast inference](#/inference)).',
    });
    p.prose(`
Here is a task that needs serial steps: track a ball under five cups through a list of swaps. Each swap depends on where the ball ended up after the previous one, so the work does not split into independent pieces. The figure runs a *cartoon* network in which every layer can carry out exactly one swap.`);
    p.figure({
      title: 'Depth per token: tracking a ball through swaps',
      codeTitle: 'cups.py',
      code: `
        swaps = [{{sw}}]   # n = {{n:8}}
        L = {{L:3}}            # layers: one swap each

        def forward(ball, todo):   # one pass, L steps deep
            for i, j in todo[:L]:      # a layer each  #@layer
                if ball in (i, j):                     #@layer
                    ball = i + j - ball  # swapped     #@layer
            return ball, todo[L:]

        ball, todo, cot = 0, swaps, []
        if {{cot:True}}:           # write a token after each pass
            while todo:
                ball, todo = forward(ball, todo)  #@pass
                cot.append(ball)   # read back next pass  #@write
        else:
            ball, todo = forward(ball, todo)      #@pass
        answer = ball   # {{ans}} (truth {{truth}})   #@answer
        # swaps never applied: {{left}}
      `,
      setup: figCups,
      caption: `Each row is one forward pass: the input on the left (the question $\\symx$, or the token the last pass wrote), $\\symL$ layers, and the token it writes on the right. With **chain of thought** on, every pass writes where the ball is, and the next pass starts from there: any number of swaps works, at the price of more tokens. Turn it off and the model must answer after one pass: swaps beyond its depth are never applied (struck out), and the answer is right only when the leftover swaps happen to miss the ball. Try 12 swaps with 3 layers, both ways, and press play to watch the computation in order.`,
    });
    p.callout('aside', `Real layers can do more than one step, and a clever network can compose several swaps at once, in a tree. But for problems like this one, the depth needed still grows with the length of the input, so any fixed depth eventually runs out. Theory papers made this precise in 2023 and 2024 (Feng et al.; Merrill and Sabharwal; Li et al.): under standard assumptions from complexity theory, a constant-depth transformer answering in one step is limited to problems that parallelize well, and a chain of thought whose length grows with the input lets it carry out serial algorithms. Earlier, Nye et al. (2021) had shown the practical version: models trained to write a *scratchpad* of intermediate results got much better at long addition and at running small programs.`, 'Why depth runs out');

    // ------------------------------------------------------------ CoT prompting
    p.h2('Chain-of-thought prompting', 'cot');
    p.prose(`
A pretrained model has read a great deal of worked reasoning: textbook solutions, proofs, forum answers that explain themselves. [In-context learning](#/pretraining/why-it-works) means we can ask for that style just by showing it. **Chain-of-thought prompting** (Wei et al., 2022) does exactly this: the few-shot examples in the prompt include the reasoning, not just the answer, so the model writes reasoning too before its answer.`);
    p.code(`
      Q: A baker has 3 trays of 8 rolls and sells 10. How many are left?
      A: 3 trays of 8 rolls is 24 rolls. Selling 10 leaves 24 - 10 = 14.
         The answer is 14.

      Q: A library has 5 shelves of 40 books. It lends out 65. How many
         books are still on the shelves?
      A:`, { title: 'few_shot_cot.txt' });
    p.prose(`
The model continues the pattern: it writes the multiplication, the subtraction, and then "The answer is 135." The paper's headline result used eight such exemplars with PaLM, a 540-billion-parameter model, and set a new state of the art on GSM8K, a benchmark of grade-school math word problems, beating a fine-tuned GPT-3 that used a trained verifier. It also found the gain to be an *emergent* ability of scale: chain-of-thought prompts did little for small models, and sometimes hurt them, and helped only from around 100 billion parameters.

A few months later Kojima et al. (2022) showed that the examples are not even necessary. Appending one sentence, **"Let's think step by step."**, makes a large model write its reasoning in *zero-shot* mode. A second prompt then pulls out the final answer.`);
    p.code(`
      # stage 1: elicit the reasoning
      Q: A library has 5 shelves of 40 books. It lends out 65. How many
         books are still on the shelves?
      A: Let's think step by step.
      [model writes its reasoning here]

      # stage 2: extract the answer
      ... [the reasoning] ...
      Therefore, the answer (arabic numerals) is`, { title: 'zero_shot_cot.txt' });
    p.prose(`
With InstructGPT (text-davinci-002), this one sentence raised accuracy on the MultiArith arithmetic benchmark from 17.7% to 78.7%, and on GSM8K from 10.4% to 40.7%. Today's chat models are fine-tuned on step-by-step answers, so they reason without being asked; the prompting results matter because they showed the ability was already in the pretrained weights, waiting for the right context.`);
    p.callout('warning', `A chain of thought reads like an explanation, but it is a generated text, not a trace of the network's internals. Turpin et al. (2023) planted hints in few-shot prompts (for example, making the right answer always option A) and found that models followed the hint while their written reasoning never mentioned it. The tokens do carry computation, as the cups figure shows, but a plausible chain of thought is not proof of *why* the model answered as it did.`, 'Reasoning you can read is not always the reasoning used');

    // ------------------------------------------------------------ self-consistency
    p.h2('Sample many, then vote', 'self-consistency');
    p.prose(`
Sample a chain of thought at a nonzero temperature and you get a different one each time. Some take a wrong turn; many arrive at the same answer by different routes. **Self-consistency** (Wang et al., 2022) uses this: sample $n$ reasoning paths, pull out each final answer, and return the answer that appears most often.

There is a clean way to see why this is the right thing to do. The question we actually care about is "what is the most likely *answer*?", not "what is the most likely *text*?". Many different chains of thought $\\symz$ lead to the same answer $\\syma$, and an answer's probability is the sum over all of them.`);
    p.callout('math', `An **expectation** or a **sum over all possible values** is often impossible to compute exactly, because there are too many values (here, every possible chain of thought). But if you can *sample* values from the right distribution, the fraction of samples that land on something estimates its probability. Counting votes is exactly that: an estimate of $p(\\syma \\mid \\symx)$ for each answer, from $n$ samples.`, 'Math help: estimating a sum by sampling');
    p.math({
      label: 'The answer, with the reasoning summed out',
      tex: String.raw`\begin{gathered} p(\syma \mid \symx) = \sum_{\symz} p(\symz \mid \symx)\; p(\syma \mid \symx, \symz) \\[6pt] \hat{\syma} = \arg\max_{\syma} \sum_{i=1}^{n} \mathbf{1}\big[\sym{a}{a_i} = \syma\big] \end{gathered}`,
      codeTitle: 'self_consistency.py',
      code: `
        from collections import Counter
        answers = []
        for _ in range(n):
            cot = model.sample(question, temperature=0.7)
            answers.append(extract_answer(cot))
        votes = Counter(answers)
        a_hat = votes.most_common(1)[0][0]   # the plurality
      `,
      terms: [
        [String.raw`p(\symz \mid \symx)`, 'the chance the model writes chain of thought $\\symz$ for question $\\symx$'],
        [String.raw`p(\syma \mid \symx, \symz)`, 'the chance that chain ends in answer $\\syma$ (usually 0 or 1: the answer is written at its end)'],
        [String.raw`\sum_{\symz}`, 'add over every possible chain of thought: the answer\'s total probability, whatever the route'],
        [String.raw`\mathbf{1}[\sym{a}{a_i} = \syma]`, 'the *indicator*: 1 if sample $i$ ended in answer $\\syma$, else 0'],
        [String.raw`\arg\max_{\syma} \sum_i`, 'the answer with the most votes. The count over $n$ samples estimates the sum on the left'],
      ],
      explain: 'Greedy decoding picks one likely-looking chain of thought, which can be a fluent path to a wrong answer. Voting ignores how the reasoning went and asks which *answer* most reasoning paths agree on. The paper reports large gains over a single chain of thought, for example 17.9 points on GSM8K. Voting needs answers that can be compared: a number, a multiple-choice letter. For an essay there is nothing to count.',
    });
    p.prose(`
How much does voting help? Start with the simplest case, where every sample is either right (with probability $\\symp$) or the same wrong answer. The vote is right when more than half the samples are right.`);
    p.math({
      label: 'Majority vote with two possible answers',
      tex: String.raw`P_{\text{vote}}(n) = \sum_{k > n/2} \binom{n}{k}\, \symp^{\,k}\, (1 - \symp)^{\,n-k}`,
      codeTitle: 'majority.py',
      code: `
        from math import comb
        def majority(p, n):          # n odd, two answers
            return sum(comb(n, k) * p**k * (1 - p)**(n - k)
                       for k in range(n // 2 + 1, n + 1))
        # p = 0.6: n=1 -> 0.60, n=11 -> 0.75, n=101 -> 0.98
        # p = 0.4: n=1 -> 0.40, n=11 -> 0.25, n=101 -> 0.02
      `,
      terms: [
        [String.raw`\symp^{\,k}(1-\symp)^{\,n-k}`, 'the chance of one particular sequence with $k$ right samples and $n - k$ wrong ones'],
        [String.raw`\binom{n}{k}`, '"$n$ choose $k$": how many different sequences have exactly $k$ right samples'],
        [String.raw`\sum_{k > n/2}`, 'add up every count of right samples that wins the vote'],
      ],
      explain: 'This is the *binomial* distribution: the number of heads in $n$ flips of a coin that lands heads with probability $\\symp$. If $\\symp$ is above one half, the share of right samples settles above one half as $n$ grows, and the vote is right almost surely. If $\\symp$ is below one half, the same law works against you: more samples make the wrong answer win more reliably. This is the Condorcet jury theorem from 1785, applied to a language model.',
    });
    p.prose(`
Real wrong answers are not all the same. Usually they scatter: one sample gets 112, another 140, another 98. A scattered wrong answer rarely wins, so voting can succeed even when $\\symp$ is well below one half. What it cannot survive is a **common mistake**: a wrong answer that many samples agree on, with share $\\symq$. The figure computes the vote exactly for a model whose samples are right with probability $\\symp$, land on the common mistake with probability $\\symq$, and otherwise give wrong answers that all differ.`);
    p.figure({
      title: 'Majority voting as the number of samples grows',
      codeTitle: 'vote.py',
      code: `
        from math import comb
        p, q, n = {{p:0.40}}, {{q:0.20}}, {{n:15}}
        r = 1 - p - q          # scattered: all different

        def wins(k_right, k_q, k_r):   # P(right answer wins)
            top = max(k_right, k_q, min(k_r, 1))
            if k_right == 0 or k_right < top:
                return 0.0
            ties = (1 + (k_q == top)
                    + (k_r if top == 1 else 0))
            return 1 / ties        # a tie: pick at random  #@win

        acc = 0.0
        for k_right in range(n + 1):
            for k_q in range(n - k_right + 1):
                k_r = n - k_right - k_q
                ways = comb(n, k_right) * comb(n - k_right, k_q)
                prob = ways * p**k_right * q**k_q * r**k_r  #@sum
                acc += prob * wins(k_right, k_q, k_r)      #@sum
        # acc = {{acc}}
      `,
      setup: figVote,
      caption: `The green curve is the exact chance the vote is right, for every $n$ from 1 to 128; the bars below are one simulated vote. With $\\symp = 0.4$ and a common mistake at $\\symq = 0.2$, voting climbs toward 100%: the right answer is the most common one, and enough samples reveal it. Now drag $\\symq$ above $\\symp$: the curve turns over and falls toward zero, because voting converges on the *plurality*, and the plurality is wrong. Try $\\symp = 0.3$ with $\\symq = 0.4$ and watch it rise a little first (at small $n$, scattered answers break ties) before it falls. The dotted line is the chance that *at least one* sample is right, the subject of the next section.`,
    });
    p.math({
      label: 'Where voting converges',
      tex: String.raw`\lim_{n \to \infty} P_{\text{vote}}(n) = \begin{cases} 1 & \text{if } \symp > \symq \\ 0 & \text{if } \symp < \symq \end{cases}`,
      codeTitle: 'plurality.py',
      code: `
        shares = np.bincount(answers) / n  # -> each answer's prob
        p, q = shares[right], shares[wrong].max()
        vote_right = p > q   # true for all large enough n
      `,
      terms: [
        [String.raw`\lim_{n \to \infty}`, 'what the accuracy approaches as the number of samples grows without bound'],
        [String.raw`\symp`, 'the probability of the right answer'],
        [String.raw`\symq`, 'the probability of the most common *wrong* answer'],
      ],
      explain: 'With many samples, each answer\'s share of the votes settles at its probability (the *law of large numbers*). So the vote ends up returning the answer with the highest probability, the plurality. Voting is a way to find the mode of the model\'s answer distribution, nothing more: it cannot fix a model whose favorite answer is wrong.',
    });

    // ------------------------------------------------------------ coverage
    p.h2('pass@k: the right answer is often in the pile', 'coverage');
    p.prose(`
The dotted line in the voting figure is a different question: not "does the vote pick the right answer?" but "is the right answer anywhere among the $k$ samples?". This is **pass@k**, also called *coverage*. It is what a perfect verifier could achieve, one that always recognizes a right answer when it sees one. For code with unit tests, that verifier exists: run every sample against the tests and keep one that passes.`);
    p.math({
      label: 'pass@k, and how to estimate it',
      tex: String.raw`\begin{gathered} \text{pass@}k = 1 - (1 - \symp)^k \\[6pt] \widehat{\text{pass@}k} = 1 - \binom{n - c}{k} \bigg/ \binom{n}{k} \end{gathered}`,
      codeTitle: 'pass_at_k.py',
      code: `
        from math import comb
        def pass_at_k(n, c, k):    # n samples drawn, c right
            if n - c < k:
                return 1.0         # every k-subset has a right one
            return 1 - comb(n - c, k) / comb(n, k)
        # pass_at_k(200, 3, 1) = 0.015, (200, 3, 100) = 0.877
      `,
      terms: [
        [String.raw`(1 - \symp)^k`, 'the chance that all $k$ independent samples are wrong'],
        [String.raw`1 - (1-\symp)^k`, 'so the chance that at least one is right'],
        [String.raw`\binom{n - c}{k} / \binom{n}{k}`, 'among all ways to pick $k$ of your $n$ samples, the share that picks only wrong ones'],
      ],
      explain: 'The left form is for one question with a known $\\symp$. In practice $\\symp$ is unknown and differs per question, so Chen et al. (2021, the Codex paper) proposed the estimator on the right: draw $n \\ge k$ samples, count the $c$ right ones, and average over every subset of size $k$. It is unbiased; simply plugging $c / n$ into the left formula underestimates pass@k. Even a problem the model solves 1.5% of the time is solved 78% of the time with 100 independent tries.',
    });
    p.prose(`
Across a whole benchmark, coverage behaves in a characteristic way. Brown et al. (2024, "Large Language Monkeys") found that coverage often keeps rising, roughly linearly in the *logarithm* of the number of samples, over several orders of magnitude. On coding tasks with tests, that turned directly into solved problems; on math, where they had no perfect checker, majority voting and reward models leveled off after a few hundred samples while coverage kept climbing. Part of the explanation is the spread of difficulty: a benchmark contains problems the model solves every time and problems it solves once in a thousand tries, and coverage keeps finding more of the second kind.`);
    p.figure({
      title: 'Coverage keeps climbing; voting levels off',
      codeTitle: 'coverage.py',
      code: `
        p = (np.arange(2000) + 0.5) / 2000  # problem accuracies
        a, b = {{a:0.25}}, {{b:0.75}}        # Beta(a, b) benchmark
        w = p**(a - 1) * (1 - p)**(b - 1)
        w /= w.sum()               # share of problems at each p
        q = {{c:0.50}} * (1 - p)   # each one's common mistake

        def pass_at(n):            # any of n samples right
            return np.sum(w * (1 - (1 - p)**n))         #@cov
        ceiling = np.sum(w * (p > q))  # voting, n -> inf  #@ceil
        # pass@1, @100, @10k: {{cov}}
        # voting ceiling: {{ceil}}
      `,
      setup: figCoverage,
      caption: `A benchmark is a mix of problems, each with its own per-sample accuracy $\\symp$, drawn here from a *Beta distribution* (a standard family of shapes on the interval 0 to 1; the histogram shows it, with bar heights on a square-root scale so the thin tails stay visible). On each problem, a share $c$ of the wrong samples agree on one common mistake. The teal curve is pass@n over the benchmark; the green line is the best majority voting can ever do, the share of problems whose right answer is their plurality (green bars). Lower the **spread** to make problems all-or-nothing (some always solved, some almost never) and watch coverage crawl up over four orders of magnitude. Raise **agree c** and the voting ceiling drops, while coverage does not change: whether a right answer exists among the samples has nothing to do with how the wrong ones are distributed. The gap between the curves is the prize for a good verifier.`,
    });

    // ------------------------------------------------------------ best-of-n
    p.h2('Best-of-n with a verifier', 'best-of-n');
    p.prose(`
To collect that prize we need something that can tell right answers from wrong ones without knowing the answer: a **verifier**. Cobbe et al. (2021), in the paper that introduced GSM8K, trained one: a model that reads a question and a full solution and predicts the probability the solution is right, trained on many sampled solutions labeled by whether their final answer matched. At test time they sampled 100 solutions and returned the one the verifier scored highest. They found that a 6-billion-parameter model with a verifier slightly beat a fine-tuned 175-billion-parameter model without one, a boost they likened to a 30-fold increase in model size. A reward model from [RLHF](#/rlhf) can play the same role, and so can a program, when one exists: unit tests, a proof checker, the rule-based rewards of [RLVR](#/grpo/verifiable).

**Best-of-n** is the simplest way to use a verifier: sample $n$ answers, score each, keep the top one. It works when the verifier is good, and it fails in an instructive way when it is not.`);
    p.math({
      label: 'Best-of-n: the chance the pick is right',
      tex: String.raw`\begin{gathered} \hat{y} = \arg\max_{i \le n} \symV(\symx, y_i) \\[6pt] P(\hat{y}\ \text{right}) = \int n\,\symp\, f_{\text{right}}(v)\, F(v)^{n-1} dv \end{gathered}`,
      codeTitle: 'best_of_n.py',
      code: `
        scores = [verifier(question, y) for y in samples]
        y_hat = samples[int(np.argmax(scores))]
      `,
      terms: [
        [String.raw`\symV(\symx, y_i)`, 'the verifier\'s score for sample $y_i$'],
        [String.raw`\symp\, f_{\text{right}}(v)`, 'how often a sample is right *and* scores $v$. Here $f_{\\text{right}}$ is the *probability density* of right answers\' scores: how thickly they pile up near each value $v$'],
        [String.raw`F(v)`, 'the chance one sample, right or wrong, scores below $v$'],
        [String.raw`F(v)^{n-1}`, 'the chance the other $n - 1$ samples all score below $v$'],
        [String.raw`n`, 'any of the $n$ samples can be the one on top'],
        [String.raw`\int \cdots dv`, 'add up over every possible top score $v$: slice the score axis thin, multiply, and sum'],
      ],
      explain: 'Read it as a story: the pick is right when some right answer scores $v$ and every other answer scores below it, for whatever $v$ that turns out to be. If right answers always outscore wrong ones, this approaches pass@n. If some wrong answers score as high as the best right ones, the top of the score range fills with them as $n$ grows, which is exactly the trouble the next figure shows. Its code computes the same sum on a grid of scores, one thin slice at a time.',
    });
    p.prose(`
The figure uses a simple model of an imperfect verifier. Right answers get scores around $d$, wrong ones around 0, both blurred by noise. And a small share $\\varepsilon$ of the wrong answers are **exploits**: answers that look better to the verifier than typical right ones (here, scores around $d + 1$). An exploit might be a confident, well-formatted solution with a subtle error, or an answer that games a quirk of the reward model.`);
    p.figure({
      title: 'Best-of-n with a noisy verifier',
      codeTitle: 'noisy_verifier.py',
      code: `
        p, d, eps, n = {{p:0.30}}, {{d:2.0}}, {{eps:0.02}}, {{n:16}}
        V = np.linspace(-6, 14, 1400)     # verifier scores
        phi = lambda m: np.exp(-(V - m)**2 / 2)
        right = p * phi(d)                # right answers: ~ d
        wrong = (1 - p) * ((1 - eps) * phi(0)
                           + eps * phi(d + 1))   # exploits
        tot = (right + wrong).sum()
        mass, right = (right + wrong) / tot, right / tot

        G = np.cumsum(mass)               # P(score <= V)
        top = G**n - np.r_[0, G[:-1]**n]  # best lands at V  #@top
        acc = np.sum(top * right / mass)  # and is right    #@acc
        # acc = {{acc}}
      `,
      setup: figBestOfN,
      caption: `Top: one draw of $n$ answers placed by verifier score; the ringed one is the pick. Bottom: the exact accuracy of the pick for $n$ from 1 to 1,024. With no exploits ($\\varepsilon = 0$) best-of-n climbs toward pass@n. With 2% exploits it peaks near $n = 16$ to 32 and then *falls*: the more samples you draw, the surer you are to include an exploit, and the verifier prefers it. Raise $d$ (a sharper verifier) and the peak moves right and up; raise $\\varepsilon$ and it moves left and down. The readout shows how far best-of-n has moved from the base model, in the KL units of the next equation.`,
    });
    p.prose(`
This is [over-optimization](#/rlhf/hacking) again, without any training. Picking the best of $n$ is a search against the verifier, and with enough search, the answers that score highest are increasingly the ones where the verifier is wrong. Gao, Schulman and Hilton (2022) measured this systematically: using one reward model as a stand-in "gold" judge and a smaller one as the proxy, they found that as best-of-n pushed further, the proxy score kept rising while the gold score rose, peaked, and fell, the same shape RL produced.

To compare best-of-n with RL on one axis, they used the distance best-of-n moves the output distribution from the base model:`);
    p.math({
      label: 'How far best-of-n moves from the base model',
      tex: String.raw`\mathrm{KL}\big(\pi_{\text{best-of-}n} \,\big\|\, \pi\big) = \log n - \frac{n - 1}{n}`,
      codeTitle: 'kl_best_of_n.py',
      code: `
        def kl_best_of_n(n):
            return np.log(n) - (n - 1) / n
        # n=4: 0.64, n=16: 1.84, n=256: 4.55, n=1024: 5.93 nats
      `,
      terms: [
        [String.raw`\pi`, 'the base model\'s distribution over answers'],
        [String.raw`\pi_{\text{best-of-}n}`, 'the distribution of the answer best-of-n returns'],
        [String.raw`\mathrm{KL}(\cdot \,\|\, \cdot)`, 'the KL divergence, the average log-ratio of the two probabilities: how far one distribution has moved from the other, in *nats*'],
        [String.raw`\log n`, 'grows very slowly: every doubling of $n$ adds only $\\log 2 \\approx 0.69$'],
      ],
      explain: 'Best-of-n is a gentle optimizer: a thousand samples move the distribution less than 6 nats. RL can move a model much further, which makes it far more powerful and far easier to overdo. The formula assumes no two samples tie; with repeated answers it is an upper bound.',
    });
    p.callout('intuition', `Voting and best-of-n can be combined: **weighted voting** adds up the verifier's scores per answer instead of counting votes, so an answer reached by many well-scored solutions wins. In practice it is often more robust than either alone, because an exploit has to fool the verifier *and* agree with many other samples.`, 'Weighted voting');

    // ------------------------------------------------------------ ORM vs PRM
    p.h2('Grading answers or grading steps', 'prm');
    p.prose(`
The verifier above judges a whole solution at once. It is an **outcome reward model** (ORM): trained on whether the final answer was right, it outputs one probability per solution. That training signal has two weaknesses. It is sparse: a 20-step solution gets one bit of feedback, with no hint of where it went wrong. And it rewards right answers reached by wrong reasoning: a solution with two errors that cancel is labeled correct.

A **process reward model** (PRM) is trained on labels for every *step*. Lightman et al. (2023), "Let's Verify Step by Step", had people label each step of model-written solutions to competition math problems as correct, incorrect or neutral: about 800,000 step labels in all, released as PRM800K. To score a whole solution, a PRM multiplies its per-step probabilities: the chance that every step is correct.`);
    p.math({
      label: 'Outcome and process scores',
      tex: String.raw`\begin{gathered} \symV_{\text{ORM}} = P(\text{answer right} \mid \symx, \symz) \\[6pt] \symV_{\text{PRM}} = \prod_{t=1}^{S} P\big(\text{step } t \text{ right} \mid \symx, \sym{z}{z_{\le t}}\big) \end{gathered}`,
      codeTitle: 'orm_prm.py',
      code: `
        steps = cot.split("\\n")           # a line per step
        orm = orm_model(question, cot)     # one number
        probs = prm_model(question, steps) # one per step
        prm = np.prod(probs)               # all right
        first_bad = np.argmax(probs < 0.5) # where it broke
      `,
      terms: [
        [String.raw`\symV_{\text{ORM}}`, 'one number for the whole chain of thought: will its final answer be right?'],
        [String.raw`\sym{z}{z_{\le t}}`, 'the chain of thought up to and including step $t$'],
        [String.raw`P(\text{step } t \text{ right} \mid \cdot)`, 'the PRM\'s probability that step $t$ is correct, given everything before it'],
        [String.raw`\prod_{t=1}^{S}`, 'the capital Greek letter *pi*: multiply over all $S$ steps (as $\\sum$ adds, $\\prod$ multiplies)'],
      ],
      explain: 'A product is small if any factor is small, so one bad step sinks the solution, wherever it sits. The minimum over steps is a common alternative. Either way the PRM also says *which* step failed, which a search can use to stop extending a doomed solution early.',
    });
    p.figure({
      title: 'An outcome check and a step check, side by side',
      codeTitle: 'process_vs_outcome.py',
      code: `
        x = "4 x 12 markers at $2, $18 off, split 3 ways"
        lines = ["{{l1:4 * 12 = 48}}",     #@s1
                 "{{l2:48 * 2 = 96}}",     #@s2
                 "{{l3:96 - 18 = 78}}",    #@s3
                 "{{l4:78 / 3 = 26}}"]     #@s4

        def step_ok(line):        # follows from the line above?
            expr, val = line.split(" = ")
            return eval(expr) == float(val)

        orm = float(lines[-1].endswith(" 26"))   # answer only  #@orm
        # a stand-in PRM: confident when the step checks out
        probs = [0.95 if step_ok(s) else 0.1 for s in lines]  #@prm
        prm = np.prod(probs)                      #@prm
        # orm = {{orm:1.0}}, prm = {{prm:0.81}}
      `,
      setup: figPrm,
      caption: `A four-step solution; each line is computed from the line above it. **Tap a step** to put a slip in it (the steps after it then compute correctly from the wrong value). The ORM column sees only the final answer; the PRM column checks each step. With **one slip**, both object, but only the PRM says where. With **two that cancel**, the answer is right, so an outcome label calls this solution correct, and an ORM trained on such labels learns to like it; the PRM does not. The per-step probabilities here come from a stand-in that checks the arithmetic; a real PRM is a network trained to predict human step labels, and it can be wrong too.`,
    });
    p.prose(`
In their experiments, best-of-1,860 with the PRM solved about 78% of a representative 500-problem subset of the MATH test set, against about 72% for an ORM and about 70% for majority voting. Step labels are expensive, so later work produced them automatically: Math-Shepherd (Wang et al., 2023) labels a step by sampling several completions from it and checking how often they reach the right answer, a Monte Carlo estimate of the step's value. Uesato et al. (2022) had earlier found that outcome supervision can match process supervision on final-answer accuracy, but that process feedback (or a reward model trained to imitate it) was needed to keep errors out of the *reasoning*.`);

    // ------------------------------------------------------------ search and scaling
    p.h2('Search, and compute versus parameters', 'scaling');
    p.prose(`
A PRM can score a partial solution, so it can guide a **search** over steps instead of waiting for whole answers.

- **Beam search over steps**: keep the $b$ best partial solutions; extend each with several sampled next steps; score them all with the PRM; keep the best $b$ again, and repeat until the solutions finish.
- **Tree search**: Tree of Thoughts (Yao et al., 2023) lets the model propose and evaluate several "thoughts" at each step and explore the tree breadth-first or depth-first, backtracking from dead ends. Monte Carlo tree search, the algorithm behind AlphaGo, has been used the same way with a learned value of each partial solution.
- **Sequential revision**: the model reads its own answer and writes an improved one, a search in time rather than in width.

Which of these is worth its compute depends on the problem. Snell et al. (2024) compared them against each other and against simply using a bigger model, matching the total compute. Their findings, stated qualitatively:`);
    p.table(
      ['Finding', 'What it means'],
      [
        ['The best strategy depends on difficulty', 'on easy questions, sequential revisions of one answer did best; harder questions needed more parallel sampling, or search'],
        ['Beam search beats best-of-n at small budgets', 'but at large budgets, and on easy questions, best-of-n caught up or won: aggressive search against a PRM over-optimizes it'],
        ['Choose the strategy per question', 'allocating compute by estimated difficulty matched best-of-n while using about 4 times less compute'],
        ['Test-time compute can stand in for parameters', 'on problems the small model solves at least sometimes, extra inference beat a model about 14 times larger at equal total compute'],
        ['But not on the hardest problems', 'when the model almost never finds the answer, no amount of sampling or search helps much; there, more pretraining is the better buy'],
      ],
      { caption: 'Scaling test-time compute versus parameters (Snell et al., 2024).' },
    );
    p.prose(`
The last two rows are the voting and coverage math again. If per-sample accuracy $\\symp$ is moderate, more samples or more search recover the right answer. If $\\symp$ is near zero, or the plurality is wrong and there is no good verifier, they cannot, and the only remedy is a model whose $\\symp$ is higher. Test-time compute multiplies what the model can already do sometimes; it does not create what it cannot do at all.`);

    // ------------------------------------------------------------ reasoning models
    p.h2('Reasoning models: RL teaches the search', 'reasoning-models');
    p.prose(`
Everything so far wraps an ordinary model in machinery: a prompt that asks for steps, a sampler, a voter, a verifier, a search. **Reasoning models** move that machinery inside the model. They are trained with reinforcement learning (in the published recipes, mostly against verifiable rewards) to write long chains of thought before answering, and in those chains they learn to do what the outer algorithms did: try an approach, check it, notice a mistake ("wait, that is not right"), back up, and try another. One long chain becomes a *sequential* search with built-in verification.

OpenAI introduced the idea with **o1** in September 2024. Its announcement reported that performance improved smoothly with more RL training compute *and* with more thinking time at test time: two new axes to scale, alongside parameters and pretraining data. On the 2024 AIME math competition, it reported about 74% of problems solved with a single sample, against about 12% for GPT-4o, and more with voting over 64 samples. o1 hides its raw chain of thought and shows the user a summary.

The training recipe was not published. **DeepSeek-R1** (January 2025) published one: GRPO with rule-based rewards on math and code, starting from a strong base model, and it showed long chains of thought, self-verification and the "aha moment" emerging from RL alone. The [GRPO chapter](#/grpo/r1) covers that recipe and its toy version in detail. Within months, most frontier labs offered a reasoning mode, and open models followed.`);
    p.table(
      ['', 'Sampling + verifier', 'Reasoning model'],
      [
        ['Where the search happens', 'outside: many independent samples', 'inside: one long chain that revisits itself'],
        ['Who checks the work', 'a separate verifier or a vote', 'the model, in its own words, trained by RL to check usefully'],
        ['How compute is spent', 'in width: $n$ samples', 'in length: $\\symT$ thinking tokens'],
        ['Can they combine?', 'yes: vote or verify over several reasoning-model samples', 'o1 and R1-Zero both reported higher scores with voting'],
      ],
      { caption: 'Two ways to spend test-time compute.' },
    );

    // ------------------------------------------------------------ budgets
    p.h2('Thinking budgets and overthinking', 'budgets');
    p.prose(`
A reasoning model decides for itself how long to think, which raises a practical question: how much thinking is the right amount? Model APIs expose it as a knob: a maximum number of thinking tokens, or a coarse effort setting. A cap that is too low cuts reasoning off before it reaches an answer; a cap that is too high pays for tokens that add nothing.

The s1 paper (Muennighoff et al., 2025) made the knob explicit with **budget forcing**. They fine-tuned an open 32B model on just 1,000 carefully chosen reasoning traces, then controlled its thinking at test time: to cut thinking short, insert the end-of-thinking marker and make it answer; to extend it, suppress the marker and append "Wait", which makes the model re-examine its work. Accuracy on competition math rose as the forced budget grew, until it flattened out.

The opposite problem is **overthinking**. Chen et al. (2024) found that o1-style models spend hundreds of tokens on questions like "what is 2 + 3?", solving them several times over. Most of that is wasted compute rather than wrong answers, but re-examination is not free of risk: a model that keeps second-guessing a right answer can talk itself out of it, and 2025 studies found tasks where longer reasoning lowered accuracy.`);
    p.figure({
      title: 'A toy thinking budget: an easy problem and a hard one',
      codeTitle: 'budget.py',
      code: `
        def accuracy(d, T, fix={{fix:0.30}}, brk={{brk:0.03}}):
            clean = np.zeros(d + 1); clean[0] = 1  # k steps, no error
            dirty = np.zeros(d + 1)                 # k steps, an error
            for t in range(T):
                c, e = clean.copy(), dirty.copy()
                clean[1:] = c[:-1] * 0.97          # a work step  #@work
                dirty[1:] = c[:-1] * 0.03 + e[:-1] # ...or a slip #@work
                clean[0] = dirty[0] = 0
                clean[d] += c[d] * (1 - brk) + e[d] * fix   #@check
                dirty[d] += e[d] * (1 - fix) + c[d] * brk   #@check
            left = 1 - clean[d] - dirty[d]         # not finished
            return clean[d] + left * 0.1           # so: a guess  #@done

        T = {{T:16}}
        easy, hard = accuracy(2, T), accuracy(12, T)
        # easy {{easy}}, hard {{hard}}
      `,
      setup: figBudget,
      caption: `A toy reasoner that must think for exactly $\\symT$ tokens, as under budget forcing. A problem needs $d$ steps; each step can slip; a budget that ends before the last step forces a guess. After the last step, every extra token is a **re-check**, which may fix an error or, rarely, break a right answer. The hard problem (12 steps) needs a budget past 12 before it gets anywhere, and then gains from re-checks. The easy one (2 steps) is done almost at once: everything after that is overthinking, and with a nonzero break rate its accuracy even drifts *down*. Drag on the chart or use the slider to set $\\symT$; set the break rate to 0 and re-checking becomes harmless, only wasteful. The numbers are invented; the shapes are the point: the right budget depends on the problem, which is why models are trained to choose it themselves.`,
    });
    p.prose(`
Training can address both problems. RL rewards that subtract a little for length push a model to stop when it is done; Kimi k1.5 (2025) used a length penalty of this kind, and other work trains models to hit a requested token budget. The goal is a model that thinks for a few tokens on "2 + 3" and for thousands on an olympiad problem.`);

    // ------------------------------------------------------------ distillation
    p.h2('Distilling reasoning into small models', 'distillation');
    p.prose(`
Discovering good reasoning through RL is expensive: long rollouts, many samples per question, a large model. Copying it is cheap. **Distillation** here means plain supervised fine-tuning: run a strong reasoning model (the teacher) on many questions, keep its chains of thought and answers (often only the ones whose answer checks out), and train a smaller model (the student) to predict those tokens. It is next-token prediction, as in [pretraining](#/pretraining), on the teacher's text. Kim and Rush (2016) called this *sequence-level* knowledge distillation; the student learns from the teacher's sampled outputs rather than its full probability distributions.`);
    p.math({
      label: 'Distillation is next-token prediction on the teacher\'s traces',
      tex: String.raw`\mathcal{L}(\theta) = -\,\mathbb{E}_{(\symx,\, y) \sim \text{teacher}} \sum_{t=1}^{|y|} \log p_\theta\big(y_t \mid \symx, y_{<t}\big), \qquad y = (\symz, \syma)`,
      codeTitle: 'distill.py',
      code: `
        data = []
        for question in questions:
            cot, answer = teacher.generate(question)
            if check(question, answer):       # keep correct ones
                data.append((question, cot + answer))
        for question, y in data:              # ordinary SFT
            logp = student.log_probs(question, y)   # per token
            loss = -logp.mean()   # loss on y only, not the prompt
            loss.backward(); opt.step()
      `,
      terms: [
        [String.raw`(\symx, y) \sim \text{teacher}`, 'questions paired with the teacher\'s full response $y$: its chain of thought $\\symz$, then its answer $\\syma$'],
        [String.raw`\log p_\theta(y_t \mid \symx, y_{<t})`, 'the student\'s log-probability of the teacher\'s next token, given the question and the response so far'],
        [String.raw`-\sum_t`, 'add over every token of the response and flip the sign: the usual cross-entropy, the loss of pretraining and fine-tuning'],
      ],
      explain: 'The student is not rewarded for being right; it is trained to write what the teacher wrote, reasoning included. The filter on correct answers is a form of rejection sampling. The expensive part, finding chains of thought that work, was done by the teacher.',
    });
    p.prose(`
The results were striking. DeepSeek fine-tuned open models from 1.5B to 70B parameters on about 800,000 samples from R1's pipeline, and the distilled 32B model was far stronger at reasoning than the same base trained with large-scale RL directly ([GRPO chapter](#/grpo/r1)). The s1 paper reached strong competition-math scores with only 1,000 traces, and LIMO (Ye et al., 2025) with 817: when the base model is strong, a small number of excellent demonstrations is enough to switch the behavior on.

The idea is older than reasoning models. **STaR**, the Self-Taught Reasoner (Zelikman et al., 2022), had a model distill *itself*: generate rationales, keep the ones that reach the right answer, fine-tune on them, and repeat, with a twist for failures (give the model the right answer as a hint and ask it to write a rationale for it). Rejection-sampling fine-tuning of this kind is also a step inside the R1 recipe.

Distillation has limits. A student imitates the teacher's traces, so it is bounded by the teacher; it learns the *form* of long reasoning, including its verbosity; and it does not learn to explore, so RL on top of a distilled model can still help.`);

    // ------------------------------------------------------------ exercises
    p.h2('Build it yourself', 'exercises');
    p.prose(`
1. **Voting by simulation (10 minutes, NumPy).** Simulate majority voting: draw $n$ answers per trial from a categorical distribution with probability $\\symp$ for the right answer, $\\symq$ for one common mistake, and the rest spread over many distinct wrong answers. Estimate the vote's accuracy over 20,000 trials for $n$ from 1 to 64 and check it against \`vote.py\` from this chapter. Then find the smallest odd $n$ for which a binary vote with $\\symp = 0.6$ is right 90% of the time. Success: your simulation and the exact formula agree to within a percent, and you can show a case where more samples make the vote worse.

2. **The pass@k estimator (20 minutes).** Implement \`pass_at_k(n, c, k)\`. For a problem with true $\\symp = 0.05$, repeatedly draw $n = 20$ samples and compute both the unbiased estimator and the naive $1 - (1 - c/n)^k$ for $k = 10$. Average each over 10,000 repetitions and compare them with the truth, $1 - 0.95^{10}$. Success: a sentence on which estimator is biased, in which direction, and why (hint: the curve $1 - (1-x)^k$ bends).

3. **Over-optimizing a verifier (45 minutes).** Reproduce the noisy-verifier figure by Monte Carlo: sample $n$ candidates with scores as in \`noisy_verifier.py\`, keep the top-scored one, and record whether it is right. Plot accuracy against $n$ and against $\\log n - (n-1)/n$. Then find the best $n$ for exploit rates from 0 to 10% and plot that too. Success: an accuracy curve that peaks and falls, matching the figure, and a rule of thumb for how the best $n$ shrinks as exploits become more common.

4. **Self-consistency on a real model (an afternoon).** Take a small open instruct model (around 1B parameters) and 200 GSM8K test problems. For each, sample 16 chains of thought at temperature 0.7 and extract the final numbers. Plot greedy accuracy, majority-vote accuracy and pass@k for $k = 1$ to 16. Then list the problems where pass@16 succeeds but the vote fails, and read their samples. Success: the three curves, plus a short note on what the common mistakes look like.

5. **Teach a tiny transformer to show its work (a weekend project).** Generate the cups task: five cups, $n$ random swaps, the ball's final position as the target. Train a small transformer (2 layers) in two ways: to output the final position directly, and to write the ball's position after every swap before answering. Train on $n \\le 8$ and test on $n$ up to 16. Success: a plot of accuracy against $n$ where the direct model falls toward chance (20%) as $n$ grows, and the chain-of-thought model stays high, the cups figure made real.`);

    p.callout('idea', `A transformer does a fixed amount of serial computation per token, so writing intermediate steps (a chain of thought) is how it gets more: each token is another pass through every layer. Chain-of-thought prompting, few-shot or zero-shot, showed pretrained models could already do this. Spending compute in width helps too: **majority voting** finds the most common answer and converges to it, which is right only if the right answer is the plurality ($\\symp > \\symq$); **pass@k** measures whether the right answer is anywhere among the samples, and it keeps climbing. A **verifier** can close that gap, but best-of-n against an imperfect verifier over-optimizes it, and accuracy peaks then falls. **Process reward models** grade each step, catch right answers reached by wrong reasoning, and can guide a search. Test-time compute substitutes for parameters when the model solves a problem sometimes, not when it never does. **Reasoning models** like o1 and R1 are trained with RL to search and self-check inside one long chain, with a thinking budget that should match the problem, and their traces can be **distilled** into small models with ordinary fine-tuning.`, 'Takeaways');
  },
};

export default chapter;

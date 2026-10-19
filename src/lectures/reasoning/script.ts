import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'reasoning',
  title: 'Reasoning and test-time compute',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'Compute at answer time',
      codeTitle: 'three_ways.py',
      code: `
        # longer: write the steps first   #@long
        z = model.generate(x)              #@long

        # wider: many tries, then pick    #@wide
        ys = [model.sample(x) for _ in range(n)]  #@wide
        a = vote(ys)     # or: best by V   #@wide

        # smarter: search, grading steps  #@smart
        z = beam_search(x, prm)            #@smart
      `,
      beats: [
        { id: 'hello', say: 'This lecture is about a second place to spend compute: not while a model is trained, but while it answers.' },
        { id: 'before', say: 'So far, training got all the compute: pretraining, then {RLHF|R L H F}, {DPO|D P O} and {GRPO|G R P O}. After that, the model answers one token at a time.' },
        { id: 'more', say: 'But the same weights can answer much better if they spend more compute on each question.' },
        { id: 'long', say: 'They can think longer, writing out steps before the answer: a chain of thought.', code: 'long' },
        { id: 'wide', say: 'They can think wider, sampling many answers and voting, or letting a verifier pick one.', code: 'wide' },
        { id: 'smart', say: 'And they can think smarter, searching over partial solutions and grading each step.', code: 'smart' },
        { id: 'models', say: 'Then come reasoning models, like {o1|oh one} and {R1|R one}, trained to do all of this inside one long chain of thought, and finally, thinking budgets and distillation.' },
      ],
    },
    {
      id: 'serial',
      title: 'Depth per token',
      codeTitle: 'cups.py',
      code: `
        L = 3        # layers: one swap each
        def forward(ball, todo):   # one pass  #@pass
            for i, j in todo[:L]:              #@layer
                if ball in (i, j):             #@layer
                    ball = i + j - ball        #@layer
            return ball, todo[L:]

        ball, todo, cot = 0, swaps, []
        while todo:              # with CoT    #@loop
            ball, todo = forward(ball, todo)   #@loop
            cot.append(ball)  # write it down  #@write
        answer = ball                          #@answer
      `,
      beats: [
        { id: 'puzzle', say: 'First, a puzzle. Why should writing out steps help a neural network at all?' },
        { id: 'fixed', say: 'A transformer does a fixed amount of work per token. The input climbs through {L|L} layers, and a prediction comes out at the top.' },
        { id: 'chain', say: 'So inside one pass, the longest chain of dependent steps is limited by that depth.' },
        { id: 'cups', say: 'Here is a task that needs a long chain: a ball under five cups, and a list of swaps.' },
        { id: 'serial', say: 'Each swap depends on where the ball ended up after the last one. The work cannot be split up.' },
        { id: 'cartoon', say: 'Picture a cartoon network where every layer does one swap. With three layers, one pass handles three swaps.', code: ['pass', 'layer'] },
        { id: 'fail', say: 'Give it eight swaps and demand the answer at once. Five swaps never happen, and here the answer is wrong.', code: 'pass' },
        { id: 'write', say: 'Now let it write a token after each pass, saying where the ball is so far.', code: 'write' },
        { id: 'readback', say: 'That token is made at the top of the network and read at the bottom of the next pass, which picks up where the last one stopped.', code: 'loop' },
        { id: 'three', say: 'Three passes, three tokens, all eight swaps done, and the answer is right.', code: 'answer' },
        { id: 'formula', say: 'So {T|T} tokens of thinking give a network with {L|L} layers about {L × T|L times T} serial steps instead of {L|L}. Theory papers in 2023 and 2024 made this precise.' },
        { id: 'cost', say: 'The price is one full forward pass per token, which is why long thinking is slow and expensive.' },
      ],
    },
    {
      id: 'cot',
      title: 'Chain-of-thought prompting',
      codeTitle: 'prompts.py',
      code: `
        few_shot = (                           #@few
          "Q: 3 trays of 8 rolls, 10 sold?\\n"  #@few
          "A: 3 x 8 = 24. 24 - 10 = 14.\\n"     #@few
          "   The answer is 14.\\n"             #@few
          "Q: " + x + "\\nA:")                  #@few

        zero_shot = ("Q: " + x + "\\n"          #@zero
          "A: Let's think step by step.")      #@zero
        then = "Therefore, the answer is"      #@extract
      `,
      beats: [
        { id: 'seen', say: 'A pretrained model has read a lot of worked reasoning: textbook solutions, proofs, answers that explain themselves.' },
        { id: 'show', say: 'So we can ask for that style by showing it. That is chain-of-thought prompting, from Wei and colleagues in 2022.', code: 'few' },
        { id: 'exemplar', say: 'The examples include the reasoning, not just the answer, so the model writes reasoning too.', code: 'few' },
        { id: 'palm', say: 'With eight examples, the 540 billion parameter PaLM set a new state of the art on {GSM8K|G S M eight K}, grade-school math problems.' },
        { id: 'emerge', say: 'Curiously, it did little for small models, and helped only from around a hundred billion parameters.' },
        { id: 'zero', say: 'Then Kojima and colleagues found the examples were not even needed. One sentence does it: let\'s think step by step.', code: 'zero' },
        { id: 'numbers', say: 'On {GSM8K|G S M eight K}, that sentence took InstructGPT from about ten percent to about forty one.', code: 'zero' },
        { id: 'extract', say: 'A second prompt pulls the final answer out.', code: 'extract' },
        { id: 'caveat', say: 'One caution: a chain of thought reads like an explanation, but it is generated text, not always the real reason for the answer.' },
      ],
    },
    {
      id: 'vote',
      title: 'Sample many, then vote',
      codeTitle: 'self_consistency.py',
      code: `
        answers = []
        for _ in range(n):                  #@sample
            z = model.sample(x, temp=0.7)   #@sample
            answers.append(extract(z))      #@extract
        votes = Counter(answers)            #@count
        a_hat = votes.most_common(1)[0][0]  #@argmax
      `,
      beats: [
        { id: 'diff', say: 'Sample a chain of thought at a nonzero temperature, and you get a different one every time.', code: 'sample' },
        { id: 'paths', say: 'Some take a wrong turn. Many reach the same answer by different routes.', code: 'sample' },
        { id: 'sc', say: 'Self-consistency, from Wang and colleagues in 2022, uses this: sample many paths, pull out each final answer,', code: 'extract' },
        { id: 'count', say: 'and return the answer that appears most often.', code: ['count', 'argmax'] },
        { id: 'sum', say: 'We care about the most likely answer, not the most likely text, and an answer\'s probability sums over every chain that leads to it.' },
        { id: 'estimate', say: 'Counting votes from samples estimates that sum.', code: 'count' },
        { id: 'gain', say: 'The paper reported large gains, for example almost eighteen points on {GSM8K|G S M eight K}.' },
        { id: 'need', say: 'Voting needs answers that can be compared, like numbers. For an essay, there is nothing to count.' },
      ],
    },
    {
      id: 'votemath',
      title: 'When voting works, and when it fails',
      codeTitle: 'vote.py',
      code: `
        def majority(p, n):      # two answers  #@binary
            ks = range(n // 2 + 1, n + 1)       #@binary
            return sum(comb(n, k) * p**k        #@binary
                       * (1 - p)**(n - k)       #@binary
                       for k in ks)             #@binary
        # p = 0.6: n=1 -> 0.60, n=101 -> 0.98   #@good
        # p = 0.4: n=1 -> 0.40, n=101 -> 0.02   #@bad

        vote_right = p > q    # once n is big   #@plural
      `,
      beats: [
        { id: 'simple', say: 'How much does voting help? Start simple: each sample is right with probability {p|p}, or else the same wrong answer.' },
        { id: 'coin', say: 'That is like counting heads in {n|n} coin flips, and the vote is right when more than half come up right.', code: 'binary' },
        { id: 'good', say: 'With {p|p} above one half, more samples help. At {0.6|point six}, one sample is right sixty percent of the time, and a hundred and one samples, ninety eight percent.', code: 'good' },
        { id: 'bad', say: 'Below one half, the same law works against you: more samples make the wrong answer win more reliably. This is the Condorcet jury theorem, from 1785.', code: 'bad' },
        { id: 'scatter', say: 'But real wrong answers usually scatter: one sample says 125, another 145, another 98.' },
        { id: 'weak', say: 'A scattered wrong answer rarely wins, so voting can succeed even with {p|p} well below one half.' },
        { id: 'common', say: 'What voting cannot survive is a common mistake: one wrong answer that many samples agree on, with share {q|q}.' },
        { id: 'flip', say: 'Put {q|q} above {p|p}, and the curve turns over and falls toward zero.' },
        { id: 'plural', say: 'With many samples, each answer\'s vote share settles at its probability, so the vote returns the plurality.', code: 'plural' },
        { id: 'limit', say: 'Voting finds the model\'s favorite answer. If the favorite is wrong, no number of samples will fix it.', code: 'plural' },
      ],
    },
    {
      id: 'coverage',
      title: 'The right answer is often in the pile',
      codeTitle: 'pass_at_k.py',
      code: `
        def pass_at(p, k):      # any of k right  #@pk
            return 1 - (1 - p)**k                 #@pk

        def pass_at_k(n, c, k):  # c right of n   #@est
            if n - c < k:                         #@est
                return 1.0                        #@est
            return 1 - comb(n-c, k) / comb(n, k)  #@est
      `,
      beats: [
        { id: 'other', say: 'Now a different question: is the right answer anywhere among the samples?' },
        { id: 'passk', say: 'That is pass at {k|k}, or coverage: one, minus the chance that all {k|k} samples are wrong.', code: 'pk' },
        { id: 'tries', say: 'A problem solved one and a half percent of the time is solved about seventy eight percent of the time in a hundred tries.', code: 'pk' },
        { id: 'tests', say: 'Coverage is what a perfect checker could reach. For code with unit tests, that checker exists.' },
        { id: 'est', say: 'To measure it, draw {n|n} samples, count the {c|c} right ones, and use this unbiased estimator from the Codex paper.', code: 'est' },
        { id: 'bench', say: 'Across a benchmark, coverage keeps climbing, roughly in a straight line against the log of the number of samples.' },
        { id: 'why', say: 'A benchmark mixes problems the model always solves with problems it solves once in a thousand tries.' },
        { id: 'ceiling', say: 'Voting, meanwhile, levels off at the share of problems whose right answer is the plurality.' },
        { id: 'gap', say: 'The gap between the curves is the prize for a good verifier.' },
      ],
    },
    {
      id: 'bon',
      title: 'Best-of-n with a verifier',
      codeTitle: 'best_of_n.py',
      code: `
        scores = [V(x, y) for y in samples]   #@score
        y_hat = samples[np.argmax(scores)]    #@pick

        # the chance the pick is right
        acc = np.sum(top * right / mass)      #@acc

        def kl_best_of_n(n):                  #@kl
            return np.log(n) - (n - 1) / n    #@kl
      `,
      beats: [
        { id: 'verifier', say: 'To collect that prize, we need a verifier: something that tells right answers from wrong ones without knowing the answer.' },
        { id: 'cobbe', say: 'Cobbe and colleagues trained one in 2021, alongside {GSM8K|G S M eight K}: it reads a solution and predicts whether it is right. Their six billion parameter model with a verifier slightly beat a fine-tuned one thirty times larger.' },
        { id: 'bon', say: 'Best-of-{n|n} is the simplest use: sample {n|n} answers, score each one, keep the top.', code: ['score', 'pick'] },
        { id: 'noisy', say: 'But verifiers are imperfect. Here, right answers score around two, wrong ones around zero, blurred by noise.', code: 'score' },
        { id: 'exploit', say: 'And two percent of wrong answers are exploits, scoring higher than typical right ones.' },
        { id: 'small', say: 'With sixteen samples, the top-scored answer is usually right.', code: 'pick' },
        { id: 'big', say: 'With two hundred and fifty six, an exploit is almost surely in the pile, and the verifier picks it.', code: 'pick' },
        { id: 'curve', say: 'So accuracy climbs, peaks around sixteen to thirty two samples, and then falls.', code: 'acc' },
        { id: 'goodhart', say: 'This is over-optimization again, with no training at all. Gao, Schulman and Hilton measured it in 2022: the proxy score keeps rising while a stronger judge\'s score peaks and falls.' },
        { id: 'kl', say: 'They measured how far best-of-{n|n} moves from the base model with this formula: the log of {n|n}, minus {n − 1|n minus one} over {n|n}.', code: 'kl' },
        { id: 'gentle', say: 'A thousand samples move it less than six nats. Best-of-{n|n} is a gentle optimizer.', code: 'kl' },
      ],
    },
    {
      id: 'prm',
      title: 'Grading answers or grading steps',
      codeTitle: 'orm_prm.py',
      code: `
        orm = orm_model(x, z)       # one number  #@orm
        probs = prm_model(x, steps) # per step    #@prm
        prm = np.prod(probs)        # all right   #@prm
        first_bad = np.argmax(probs < 0.5)          #@where
      `,
      beats: [
        { id: 'orm', say: 'That verifier is an outcome reward model, or {ORM|O R M}: trained on whether the final answer was right, it gives one number per solution.', code: 'orm' },
        { id: 'example', say: 'Take this problem: four boxes of twelve markers at two dollars each, eighteen dollars off, split by three classes.' },
        { id: 'clean', say: 'Four checkable steps, ending in twenty six dollars per class.' },
        { id: 'slip', say: 'Put a slip in step two, and every later line inherits it. The outcome check says the answer is wrong, but not where.', code: 'orm' },
        { id: 'prm', say: 'A process reward model, or {PRM|P R M}, grades every step instead, and flags step two directly.', code: ['prm', 'where'] },
        { id: 'cancel', say: 'Now make two slips that cancel. The answer is twenty six again.' },
        { id: 'fooled', say: 'An outcome label calls this correct, and an {ORM|O R M} trained on such labels learns to like it. The {PRM|P R M} does not.', code: 'where' },
        { id: 'product', say: 'To score a whole solution, a {PRM|P R M} multiplies its step probabilities: the chance every step is right.', code: 'prm' },
        { id: 'lightman', say: 'Lightman and colleagues at OpenAI built one in 2023, from about eight hundred thousand human step labels on competition math.' },
        { id: 'result', say: 'Picking the best of about eighteen hundred samples, their {PRM|P R M} solved about seventy eight percent of a test set, the {ORM|O R M} seventy two, and majority voting seventy.' },
        { id: 'auto', say: 'Later work made step labels automatically: a step is good if completions from it often reach the right answer.' },
      ],
    },
    {
      id: 'search',
      title: 'Search, and compute versus parameters',
      codeTitle: 'beam_search.py',
      code: `
        beams = [x]                            #@init
        for depth in range(max_steps):         #@loop
            cands = [b + s for b in beams      #@expand
                     for s in sample_steps(b)] #@expand
            cands.sort(key=prm, reverse=True)  #@score
            beams = cands[:3]                  #@keep
      `,
      beats: [
        { id: 'guide', say: 'A {PRM|P R M} can score a partial solution, so it can guide a search.' },
        { id: 'beam', say: 'Beam search over steps keeps the three best partial solutions,', code: ['init', 'keep'] },
        { id: 'expand', say: 'extends each with a few sampled next steps,', code: 'expand' },
        { id: 'score', say: 'scores them all with the {PRM|P R M}, and keeps the best three again.', code: ['score', 'keep'] },
        { id: 'tree', say: 'Tree of Thoughts, in 2023, searched trees like this, backing up from dead ends. Monte Carlo tree search is used too.', code: 'loop' },
        { id: 'snell', say: 'Which way of spending compute is best? In 2024, Snell and colleagues compared them, and compared them with a bigger model.' },
        { id: 'depends', say: 'It depends on difficulty. Easy questions did best with revisions of one answer; harder ones needed more sampling or search.' },
        { id: 'fourteen', say: 'Choosing per question saved about four times the compute. And where the small model succeeded at least sometimes, extra inference beat a model fourteen times larger.' },
        { id: 'hard', say: 'But where the model almost never finds the answer, sampling barely helps. There, a bigger model is the better buy.' },
        { id: 'multiply', say: 'Test-time compute multiplies what a model can sometimes do. It cannot create what it cannot do at all.' },
      ],
    },
    {
      id: 'models',
      title: 'Reasoning models',
      codeTitle: 'reasoning_model.py',
      code: `
        # outside the model: parallel search  #@outer
        ys = [model.sample(x) for _ in range(n)]  #@outer
        a = best_of(ys, verifier)              #@outer

        # inside: one long chain, from RL     #@inner
        z = reasoner.think(x, budget=T)        #@inner
        a = extract(z)                         #@inner
      `,
      beats: [
        { id: 'outer', say: 'Everything so far wraps an ordinary model in machinery: a sampler, a voter, a verifier, a search.', code: 'outer' },
        { id: 'inside', say: 'Reasoning models move that machinery inside the model.', code: 'inner' },
        { id: 'rl', say: 'They are trained with reinforcement learning to write long chains of thought before they answer.', code: 'inner' },
        { id: 'behave', say: 'In those chains they learn what the outer algorithms did: try an approach, check it, notice a mistake, back up, try another.' },
        { id: 'seq', say: 'One long chain becomes a sequential search, with its own verification built in.' },
        { id: 'o1', say: 'OpenAI introduced the idea with {o1|oh one}, in September 2024. It hides its raw chain of thought and shows a summary.' },
        { id: 'axes', say: 'It reported accuracy improving smoothly with more {RL|R L} training compute, and with more thinking time: two new axes to scale.' },
        { id: 'aime', say: 'On the 2024 {AIME|A I M E} math competition, it reported about seventy four percent solved with one sample, against about twelve for {GPT-4o|G P T four oh}.' },
        { id: 'r1', say: 'DeepSeek {R1|R one}, in January 2025, published a recipe: {GRPO|G R P O}, rewarded only by answers a program can check.' },
      ],
    },
    {
      id: 'budget',
      title: 'Thinking budgets and overthinking',
      codeTitle: 'budget.py',
      code: `
        z = reasoner.think(x, budget=T)     #@cap
        # budget forcing, as in s1:
        if len(z) >= T:                     #@cut
            z += "</think>"  # answer now   #@cut
        elif wants_to_stop(z):              #@extend
            z += "Wait"      # keep going   #@extend
      `,
      beats: [
        { id: 'knob', say: 'A reasoning model decides how long to think. Most {APIs|A P Is} add a knob: a cap on thinking tokens, or an effort level.', code: 'cap' },
        { id: 'low', say: 'Too low a cap cuts reasoning off before an answer. Too high, and you pay for tokens that add nothing.', code: 'cap' },
        { id: 's1', say: 'The s1 paper, in 2025, fine-tuned a model on just a thousand reasoning traces, and controlled its thinking with budget forcing.' },
        { id: 'cut', say: 'To cut thinking short, insert the end-of-thinking marker, and make it answer.', code: 'cut' },
        { id: 'wait', say: 'To extend it, hold back the marker and append the word wait, so the model looks at its work again.', code: 'extend' },
        { id: 'rose', say: 'Accuracy rose with the forced budget, then flattened out.' },
        { id: 'toy', say: 'Here is a toy. A hard problem needs twelve steps. Until the budget passes twelve it can only guess; after that, re-checks help.' },
        { id: 'easy', say: 'An easy problem, two steps, is done almost at once. Everything after that is overthinking.' },
        { id: 'drift', say: 'And if a re-check can now and then break a right answer, too much thinking even drags accuracy down.' },
        { id: 'real', say: 'Real models do this: o1-style models were found spending hundreds of tokens on two plus three.' },
        { id: 'train', say: 'Rewards that charge a little for length can teach a model to stop when it is done.' },
      ],
    },
    {
      id: 'distill',
      title: 'Distilling reasoning into small models',
      codeTitle: 'distill.py',
      code: `
        data = []
        for x in questions:
            z, a = teacher.generate(x)       #@teach
            if check(x, a):     # keep right #@filter
                data.append((x, z + a))      #@filter
        for x, y in data:       # plain SFT  #@sft
            logp = student.log_probs(x, y)   #@sft
            loss = -logp.mean()              #@sft
            loss.backward(); opt.step()      #@sft
      `,
      beats: [
        { id: 'cheap', say: 'Discovering good reasoning with reinforcement learning is expensive. Copying it is cheap.' },
        { id: 'teacher', say: 'Run a strong reasoning model, the teacher, on many questions, and keep its chains of thought and answers,', code: 'teach' },
        { id: 'filter', say: 'often only the ones whose answer checks out.', code: 'filter' },
        { id: 'student', say: 'Then train a small student model to predict those tokens: plain next-token prediction on the teacher\'s text.', code: 'sft' },
        { id: 'r1d', say: 'DeepSeek distilled {R1|R one} into open models from one and a half to seventy billion parameters, with about eight hundred thousand samples.' },
        { id: 'beat', say: 'The distilled thirty two billion model reasoned far better than the same base trained with large-scale reinforcement learning.' },
        { id: 'few', say: 'Others needed far less: s1 used a thousand traces, and LIMO, eight hundred and seventeen.' },
        { id: 'star', say: 'The idea is older. {STaR|Star}, in 2022, had a model teach itself: keep the rationales that reach the right answer, fine-tune, repeat.' },
        { id: 'limits', say: 'The limits: a student is bounded by its teacher, copies its verbosity, and does not learn to explore.' },
      ],
    },
    {
      id: 'outro',
      title: 'Recap',
      codeTitle: 'recap.py',
      code: `
        # longer: tokens buy serial depth    #@long
        # wider: a vote finds the plurality  #@vote
        #   pass@k climbs; a verifier picks  #@verify
        # smarter: PRMs grade every step     #@prm
        # reasoning models: RL, one chain    #@rl
        # then distill into a small model    #@distill
      `,
      beats: [
        { id: 'long', say: 'To recap. A transformer does a fixed amount of serial work per token, so writing steps buys depth.', code: 'long' },
        { id: 'vote', say: 'Voting finds the plurality. It works when the right answer is the most common one.', code: 'vote' },
        { id: 'verify', say: 'The right answer is often in the pile. A verifier can pick it out, but search too hard against an imperfect one and accuracy falls.', code: 'verify' },
        { id: 'prm', say: 'Process reward models grade each step, and can guide a search.', code: 'prm' },
        { id: 'rl', say: 'Reasoning models learn with reinforcement learning to do all this inside one chain, on a budget that should match the problem.', code: 'rl' },
        { id: 'distill', say: 'And their reasoning can be handed to small models by ordinary fine-tuning.', code: 'distill' },
        { id: 'close', say: 'The thread through all of it: the same weights, given more compute at answer time, can find answers one quick pass would miss, as long as something can tell a good answer from a bad one.', code: ['long', 'vote', 'verify', 'prm', 'rl', 'distill'] },
      ],
    },
  ],
};

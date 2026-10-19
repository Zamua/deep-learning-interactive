import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'grpo',
  title: 'RL from verifiable rewards and GRPO',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'Rewards you can check',
      codeTitle: 'the_idea.py',
      code: `
        # RLHF: a network guesses the reward  #@rlhf
        r = reward_model(q, o)                #@rlhf
        # RLVR: a program checks the answer   #@rlvr
        r = float(extract(o) == answer[q])    #@rlvr
        # GRPO: the group is the baseline     #@grpo
        A = (r - r.mean()) / r.std()          #@grpo
      `,
      beats: [
        { id: 'hello', say: 'This lecture is about a simple idea that reshaped post-training in 2025: rewards a program can check.' },
        { id: 'recap', say: '{RLHF|R L H F} trains a reward model on human comparisons, then optimizes against it. {DPO|D P O} fits the comparisons directly.', code: 'rlhf' },
        { id: 'guess', say: 'Either way, the reward is a learned guess, and a policy that optimizes hard against a guess finds where it is wrong.', code: 'rlhf' },
        { id: 'check', say: 'For some tasks we can do better: a math answer can be checked, and a program can be tested.' },
        { id: 'rlvr', say: 'Use the checker as the reward, and you get reinforcement learning from verifiable rewards: {RLVR|R L V R}.', code: 'rlvr' },
        { id: 'grpo', say: 'Pair it with {GRPO|G R P O}, a lean version of {PPO|P P O} with no value network, and you have the recipe behind DeepSeek {R1|R one}.', code: 'grpo' },
        { id: 'plan', say: 'We will build it piece by piece: verifiers, a {PPO|P P O} recap, {GRPO|G R P O} term by term, a toy trained live, the {R1|R one} recipes, and how {GRPO|G R P O} goes wrong.' },
      ],
    },
    {
      id: 'verifier',
      title: 'A program as the reward',
      codeTitle: 'reward.py',
      code: `
        def reward(q, o):
            pred = extract_boxed(o)      #@extract
            if pred is None:             #@format
                return 0.0               #@format
            ok = equal(pred, answer[q])  #@compare
            return 1.0 if ok else 0.0    #@compare
      `,
      beats: [
        { id: 'q', say: 'A question with a known answer: {437 + 285|four thirty seven plus two eighty five}.' },
        { id: 'out', say: 'The model reasons, then puts its final answer in a box.' },
        { id: 'extract', say: 'The verifier is a few lines of code. It pulls out what is in the box,', code: 'extract' },
        { id: 'compare', say: 'compares it with the stored answer, {722|seven twenty two}, and returns one on a match, zero if not.', code: 'compare' },
        { id: 'wrong', say: 'A wrong answer gets zero. So does an answer with no box at all: the format is part of the task.', code: 'format' },
        { id: 'binary', say: 'The reward is binary, cheap and exact. It grades the answer, never the reasoning.' },
        { id: 'rm', say: 'A reward model is a network, and networks have adversarial inputs: strange outputs that score high.' },
        { id: 'fool', say: 'Optimize long enough and the policy finds them: reward hacking.' },
        { id: 'robust', say: 'A checker that compares a number with {722|seven twenty two} has no such blind spot. The only way to earn its reward is to be right.', code: 'compare' },
        { id: 'name', say: 'The name {RLVR|R L V R} comes from {AI2|A I two}\'s {Tülu 3|Tulu three}, in 2024. DeepSeek calls the same thing rule-based rewards.' },
      ],
    },
    {
      id: 'gaming',
      title: 'How a verifier still gets gamed',
      codeTitle: 'checkers.py',
      code: `
        # loose: any boxed answer that matches
        ok = answer in boxes               #@anybox
        # looser: any number in the text
        ok = answer in re.findall(r"\\d+", o)  #@anynum
        # strict: one box, compared as a number
        ok = (len(boxes) == 1 and          #@strict
              num(boxes[0]) == num(answer))  #@strict

        def square(x):     # passes 3 tests  #@cheat
            return {2: 4, 3: 9, 5: 25}[x]    #@cheat
      `,
      beats: [
        { id: 'still', say: 'Verifiable rewards are hard to hack, not impossible. The policy optimizes what the checker checks, not what you meant.' },
        { id: 'six', say: 'Here are six answers to one question, each marked with a careful human\'s verdict.' },
        { id: 'anybox', say: 'Suppose the checker accepts any boxed answer that matches. Then boxing two guesses earns full reward.', code: 'anybox' },
        { id: 'anynum', say: 'Accept any number in the text, and spraying numbers works too.', code: 'anynum' },
        { id: 'strict', say: 'A strict checker wants exactly one box, compared as a number. Both exploits fail, and {722.0|seven twenty two point zero} still passes.', code: 'strict' },
        { id: 'partial', say: 'The second gap is a partial checker. Three unit tests reward any code that passes them,' },
        { id: 'cheat', say: 'including code that simply memorizes them.', code: 'cheat' },
        { id: 'answer', say: 'And a checker that reads only the final answer gives full credit to a lucky guess.' },
        { id: 'lesson', say: 'So treat the verifier as training code, and test it against adversarial outputs before a long run.' },
      ],
    },
    {
      id: 'ppo',
      title: 'PPO in one page',
      codeTitle: 'ppo_clip.py',
      code: `
        ratio = np.exp(logp - old_logp)    #@ratio
        unclipped = ratio * A              #@un
        clipped = np.clip(ratio, 1 - eps,  #@cl
                          1 + eps) * A     #@cl
        objective = np.minimum(unclipped,  #@min
                               clipped)    #@min
        # PPO's A comes from a critic V:   #@critic
        A = gae(rewards, V(states))        #@critic
      `,
      beats: [
        { id: 'policy', say: 'First, a recap of {PPO|P P O}, which {GRPO|G R P O} mostly keeps. A language model is a policy: it picks each next token with some probability.' },
        { id: 'pg', say: 'The policy gradient raises the probability of outputs that did better than expected, and lowers the rest.' },
        { id: 'adv', say: 'Better than expected is the advantage, {Â|A hat}: the reward minus a baseline, an estimate of what the model usually gets.' },
        { id: 'reuse', say: '{PPO|P P O} takes several steps on each sampled batch, weighting each token by a ratio, rho: its probability now, over when it was sampled.', code: 'ratio' },
        { id: 'ratio', say: 'A ratio of one means unchanged. {1.3|One point three} means the token is now thirty percent more likely.', code: 'ratio' },
        { id: 'clip', say: 'Then it clips. For a good token, the objective rises with the ratio until one plus epsilon, then goes flat.', code: ['cl', 'min'] },
        { id: 'flat', say: 'Flat means zero gradient: the token stops being pushed. Bad tokens get the same treatment below one minus epsilon.', code: ['cl', 'min'] },
        { id: 'safe', say: 'So one batch cannot move the policy far.' },
        { id: 'critic', say: '{PPO|P P O}\'s advantage comes from a critic: a value network that predicts, at every token, the reward still to come.', code: 'critic' },
        { id: 'four', say: 'So {PPO|P P O} holds four models: the policy and the critic, both trained, plus a frozen reference and reward model.' },
        { id: 'heavy', say: 'The critic is as big as the policy, and must predict a reward that only arrives at the end. {GRPO|G R P O} throws it away.' },
      ],
    },
    {
      id: 'group',
      title: 'The group is the baseline',
      codeTitle: 'group.py',
      code: `
        outputs = [policy.sample(q)        #@sample
                   for _ in range(G)]      #@sample
        r = np.array([verify(q, o)         #@verify
                      for o in outputs])   #@verify
        # r = [{{r:…}}]
        mean, std = r.mean(), r.std()      #@stats
        A = (r - mean) / (std + 1e-4)      #@adv
        # token t of output i gets A[i]    #@tok
      `,
      beats: [
        { id: 'idea', say: 'Group Relative Policy Optimization comes from DeepSeekMath, in 2024. Its idea fits in one sentence.' },
        { id: 'sentence', say: 'Instead of training a critic to guess how well the model does, sample several answers and look.' },
        { id: 'sample', say: 'For each question, draw a group of G outputs. Here are eight, from a toy model doing addition.', code: 'sample' },
        { id: 'tokens', say: 'Blue chips are steps of work, orange chips re-check the work, and the purple chip is the final answer.', code: 'sample' },
        { id: 'verify', say: 'The verifier scores each one. Two of the eight are right.', code: 'verify' },
        { id: 'mean', say: 'The average reward, one quarter, is the model\'s pass rate on this question: exactly what a critic would try to learn.', code: 'stats' },
        { id: 'adv', say: 'Each output\'s advantage is its reward minus that mean, divided by the group\'s standard deviation.', code: 'adv' },
        { id: 'values', say: 'The two right answers get plus {1.73|one point seven three}. The six wrong ones get minus {0.58|point five eight}.', code: 'adv' },
        { id: 'sum', say: 'The advantages always add up to zero, so probability moves from worse outputs to better ones.' },
        { id: 'broadcast', say: 'And every token of an output gets that same advantage: the whole row is pushed up, or down.', code: 'tok' },
        { id: 'hard', say: 'On a hard question, a rare right answer earns a big advantage. On an easy one, being right earns little.' },
        { id: 'cost', say: 'The price is G samples per question, which reasoning training pays for anyway.' },
      ],
    },
    {
      id: 'objective',
      title: 'The GRPO objective, term by term',
      codeTitle: 'grpo_loss.py',
      code: `
        def grpo_loss(logp, old_logp, ref_logp,
                      A, mask, eps, beta):
            ratio = np.exp(logp - old_logp)    #@ratio
            adv = A[:, None]                   #@adv
            c = np.clip(ratio, 1-eps, 1+eps)   #@clip
            surr = np.minimum(ratio*adv, c*adv)  #@clip
            x = np.exp(ref_logp - logp)        #@kl
            kl = x - np.log(x) - 1             #@kl
            ell = surr - beta * kl             #@ell
            seq = (ell*mask).sum(1) / mask.sum(1)  #@tok
            return -seq.mean()                 #@group
      `,
      beats: [
        { id: 'whole', say: 'Here is the whole {GRPO|G R P O} objective. It looks dense, but it is {PPO|P P O}\'s with two swaps. Let us read it piece by piece.' },
        { id: 'group', say: 'Outside, one over G times a sum over i: an average over the group.', code: 'group' },
        { id: 'tokens', say: 'Inside, one over the length of output i, times a sum over its tokens: an average over that output\'s tokens. Remember this one.', code: 'tok' },
        { id: 'ratio', say: 'For each token, the ratio rho: its probability now, over when it was sampled.', code: 'ratio' },
        { id: 'adv', say: 'Times {Â|A hat}, the group advantage, the same for every token of the output.', code: 'adv' },
        { id: 'clip', say: 'Then {PPO|P P O}\'s clip and min, unchanged.', code: 'clip' },
        { id: 'kl', say: 'And minus beta times a {KL|K L} penalty, which keeps the policy near the frozen reference model, {π_ref|pi ref}.', code: 'kl' },
        { id: 'inloss', say: '{PPO|P P O} folds that penalty into the reward. {GRPO|G R P O} adds it to the loss, so the advantage stays a clean function of the rewards.', code: 'ell' },
        { id: 'estimator', say: 'The penalty uses a neat estimator. Let x be the reference\'s probability of the sampled token, over the policy\'s.', code: 'kl' },
        { id: 'curve', say: 'Then x minus log x minus one is zero when the two agree, and positive everywhere else.', code: 'kl' },
        { id: 'unbiased', say: 'Averaged over samples it equals the true {KL|K L} divergence, and it is never negative, which keeps it low in noise.' },
        { id: 'code', say: 'In code, it is about ten lines: ratio, clip, penalty, and two averages.', code: ['ratio', 'clip', 'kl', 'tok', 'group'] },
      ],
    },
    {
      id: 'memory',
      title: 'Why dropping the critic matters',
      codeTitle: 'memory.py',
      code: `
        N = 7e9               # params per model
        trained = 16 * N      # 112 GB     #@trained
        frozen = 2 * N        # 14 GB      #@frozen
        ppo = 2*trained + 2*frozen  # 252  #@ppo
        grpo = trained + 2*frozen   # 140  #@grpo
        rlvr = trained + frozen     # 126  #@rlvr
      `,
      beats: [
        { id: 'bytes', say: 'How much does the critic cost? Training with Adam in mixed precision takes about sixteen bytes per parameter.', code: 'trained' },
        { id: 'split', say: 'Two for the weights, two for the gradients, four for a full-precision copy, and eight for Adam\'s two running averages.', code: 'trained' },
        { id: 'frozen', say: 'A frozen model that only runs inference needs two bytes per parameter.', code: 'frozen' },
        { id: 'ppo', say: 'So at seven billion parameters each, {PPO|P P O}\'s four models need about two hundred and fifty gigabytes, before a single activation.', code: 'ppo' },
        { id: 'grpo', say: '{GRPO|G R P O} drops the critic: a hundred and twelve gigabytes gone, as much as the policy itself.', code: 'grpo' },
        { id: 'rlvr', say: 'With a verifier, the reward model goes too. That is half of {PPO|P P O}\'s memory.', code: 'rlvr' },
        { id: 'compute', say: 'It also saves the critic\'s compute, freeing room for generation: long answers, many per prompt.' },
      ],
    },
    {
      id: 'toy',
      title: 'Watching GRPO learn to add',
      codeTitle: 'grpo_train.py',
      code: `
        for step in range(400):    # {{step:0}}
            batch = sample_groups(policy, G=8)  #@sample
            for q, outputs in batch:
                r = verify_all(q, outputs)  #@reward
                A = group_adv(r)            #@adv
            loss = grpo_loss(policy, old,   #@loss
                             ref, batch)    #@loss
            opt.step()                      #@update
        # accuracy {{acc:…}}, length {{len:…}}
      `,
      beats: [
        { id: 'world', say: 'Let us watch {GRPO|G R P O} work on a toy, small enough to see every step. The prompt is an addition problem of one to four digits.' },
        { id: 'vocab', say: 'It has three tokens: work out the next column, check the work so far, or write the answer.' },
        { id: 'slips', say: 'A column slips fifteen percent of the time, a check fixes a slip seventy percent of the time, and unworked columns are guessed.' },
        { id: 'base', say: 'The base model answers too early and rarely checks. It is right about thirty percent of the time.' },
        { id: 'train', say: 'Now train: groups of eight, eight problems per batch, two clipped passes each.', code: ['sample', 'reward', 'adv', 'loss', 'update'] },
        { id: 'acc', say: 'Accuracy climbs, from about thirty percent to nearly ninety.', code: 'update' },
        { id: 'len', say: 'And something nobody asked for: the outputs get longer, from under three tokens to over five.' },
        { id: 'why', say: 'Working every column, and spending a token on a check, pays off. Most of the new length is that useful work.' },
        { id: 'filler', say: 'Some is filler: work after the last column, which no reward discourages. Remember that.' },
        { id: 'checks', say: 'And the check tokens multiply. Self-verification appeared because it raised the reward.' },
        { id: 'r1', say: 'Longer outputs, more checking, higher accuracy: the pattern DeepSeek saw at enormous scale.' },
      ],
    },
    {
      id: 'r1zero',
      title: 'R1-Zero: pure RL from the base',
      codeTitle: 'r1_zero.py',
      code: `
        base = load("DeepSeek-V3-Base")     #@base
        prompt = TEMPLATE.format(q=q)       #@template
        # reason in <think>, answer after   #@template
        r = accuracy(o) + format_ok(o)      #@reward
        r1_zero = grpo(base, math_code,     #@grpo
                       reward=r)            #@grpo
      `,
      beats: [
        { id: 'jan', say: 'In January 2025, DeepSeek released {R1|R one}, and with it an experiment called {R1-Zero|R one Zero}.' },
        { id: 'nosft', say: '{R1-Zero|R one Zero} is {GRPO|G R P O} applied straight to the pretrained DeepSeek {V3|V three} Base, with no supervised fine-tuning.', code: ['base', 'grpo'] },
        { id: 'template', say: 'A simple template asks it to reason inside think tags, then answer.', code: 'template' },
        { id: 'rewards', say: 'The reward is a rule: an answer check for math, test cases for code, and a format check. No reward model.', code: 'reward' },
        { id: 'aime', say: 'On the {AIME|A I M E} 2024 math contest, the paper reports single-sample accuracy rising from {15.6|fifteen point six} to {71.0|seventy one} percent.' },
        { id: 'vote', say: 'With a majority vote over sixty four samples, {86.7|eighty six point seven} percent.' },
        { id: 'long', say: 'And, like our toy, its answers grew steadily longer, from hundreds of tokens toward many thousands.' },
        { id: 'aha', say: 'Reflection emerged too. The paper shows a checkpoint writing, mid-solution: {"Wait, wait. Wait. That\'s an aha moment I can flag here."|wait, wait. wait. that\'s an aha moment I can flag here.} Then it re-checks its work.' },
        { id: 'flaws', say: 'But {R1-Zero|R one Zero}\'s reasoning was hard to read, and it mixed languages inside a single answer.' },
      ],
    },
    {
      id: 'r1',
      title: 'R1, and distillation',
      codeTitle: 'r1_recipe.py',
      code: `
        m = sft(base, cold_start_cot)     #@cold
        m = grpo(m, math_code,            #@rl1
                 reward=rules + language) #@rl1
        data = rejection_sample(m)  # 600k  #@rs
        data += general_sft_data    # 200k  #@rs
        m = sft(base, data)       # 2 epochs  #@sft
        r1 = grpo(m, all_prompts,         #@rl2
                  reward=rules + rms)     #@rl2
        # distillation: SFT only, no RL
        small = sft(load("Qwen2.5-Math-7B"), data)  #@distill
      `,
      beats: [
        { id: 'stages', say: '{R1|R one} keeps the RL and wraps it in stages, starting again from the same base.' },
        { id: 'cold', say: 'Stage one, a cold start: fine-tune on a few thousand long, readable chains of thought.', code: 'cold' },
        { id: 'rl1', say: 'Stage two: the same reasoning RL as {R1-Zero|R one Zero}, plus a reward for staying in one language.', code: 'rl1' },
        { id: 'rs', say: 'Stage three: sample from that model and keep the good answers, about six hundred thousand, plus two hundred thousand ordinary assistant examples.', code: 'rs' },
        { id: 'sft', say: 'Fine-tune the base again on those eight hundred thousand, for two epochs.', code: 'sft' },
        { id: 'rl2', say: 'Stage four: a last RL round over all prompts, with rules where answers can be checked and reward models elsewhere. That is {R1|R one}.', code: 'rl2' },
        { id: 'distill', say: 'Then the cheapest step, distillation: fine-tune smaller open models, one and a half to seventy billion parameters, on the same samples. No RL.', code: 'distill' },
        { id: 'strong', say: 'They reason far better than the models they started from.', code: 'distill' },
        { id: 'vsrl', say: 'And RL run directly on a thirty-two billion parameter base did much worse than distilling {R1|R one} into that size.' },
        { id: 'lesson', say: 'Reasoning that a huge model discovers through RL can be handed to a small model with ordinary fine-tuning.' },
      ],
    },
    {
      id: 'biases',
      title: 'When GRPO goes wrong',
      codeTitle: 'fixes.py',
      code: `
        # 1. no signal: drop it, draw another
        if r.std() == 0: continue        #@zero
        # 2. length: GRPO weights A / |o|
        w_token = A / len(o)             #@len
        w_token = A / MAX_LEN  # Dr. GRPO  #@lendr
        # 3. difficulty: GRPO divides by std
        A = (r - r.mean()) / r.std()     #@std
        A = r - r.mean()       # Dr. GRPO  #@stddr
      `,
      beats: [
        { id: 'edges', say: '{GRPO|G R P O}\'s simplicity hides sharp edges, and the open reproductions of {R1-Zero|R one Zero} kept hitting the same four.' },
        { id: 'zero', say: 'First, groups with no signal. If all eight outputs are right, or all wrong, every advantage is zero.', code: 'zero' },
        { id: 'worse', say: 'That question wastes compute, and it gets worse as training succeeds: mastered questions become all-right groups.' },
        { id: 'dyn', say: '{DAPO|D A P O}\'s fix is dynamic sampling: drop those groups and refill the batch.', code: 'zero' },
        { id: 'len', say: 'Second, length. Averaging over each output\'s tokens makes each token\'s weight the advantage divided by the length.', code: 'len' },
        { id: 'right', say: 'Among right answers, short ones get a bigger push per token.', code: 'len' },
        { id: 'wrong', say: 'Among wrong answers, long ones get a smaller penalty per token: length softens the blow.', code: 'len' },
        { id: 'drgrpo', say: 'The {Dr. GRPO|Doctor G R P O} paper, {GRPO|G R P O} done right, argues this lets wrong answers grow ever longer. Its fix: divide by one constant.', code: 'lendr' },
        { id: 'std', say: 'Third, difficulty. Dividing by the standard deviation rescales each question, and it is small when nearly everything is right, or wrong.', code: 'std' },
        { id: 'weight', say: 'So those get inflated: a question solved seven times in eight pulls two thirds as hard as a fifty-fifty one. Without the division, less than half.', code: 'std' },
        { id: 'drfix', say: '{Dr. GRPO|Doctor G R P O} drops that division too, leaving an honest policy gradient with the group mean as baseline.', code: 'stddr' },
      ],
    },
    {
      id: 'entropy',
      title: 'Entropy collapse and clip-higher',
      codeTitle: 'clip_higher.py',
      code: `
        p_old = np.array([0.01, 0.5, 0.9])  #@p
        p_max = np.minimum(1, p_old * 1.2)  #@sym
        # [0.012, 0.6, 1.0]                 #@sym
        eps_low, eps_high = 0.2, 0.28       #@hi
        p_max = np.minimum(1, p_old * 1.28) #@hi
        # DAPO: clip-higher, dynamic        #@dapo
        # sampling, token-level loss,       #@dapo
        # overlong shaping, and no KL       #@dapo
      `,
      beats: [
        { id: 'entropy', say: 'Fourth, entropy collapse. Entropy measures how spread out the policy\'s choices are, and under RL it falls fast, even in our toy.' },
        { id: 'same', say: 'A confident policy writes near-identical outputs, which get identical rewards: no signal, and no exploration.' },
        { id: 'blame', say: 'The {DAPO|D A P O} authors traced part of this to the clip itself.' },
        { id: 'ratio', say: 'The clip limits the ratio, so how far a token can move in one batch is proportional to where it started.', code: ['p', 'sym'] },
        { id: 'likely', say: 'A token at probability {0.9|point nine} may rise all the way to one: no real limit.', code: 'sym' },
        { id: 'rare', say: 'A token at {0.01|point zero one} may only reach {0.012|point zero one two}. Rare tokens, which open new lines of reasoning, can barely grow.', code: 'sym' },
        { id: 'higher', say: 'The fix, clip higher, raises only the top of the band: {DAPO|D A P O} uses {0.2|point two} below and {0.28|point two eight} above.', code: 'hi' },
        { id: 'dapo', say: '{DAPO|D A P O} bundles four changes: clip higher, dynamic sampling, a loss averaged over every token in the batch, and gentler handling of truncated answers.', code: 'dapo' },
        { id: 'nokl', say: 'It also drops the {KL|K L} penalty, so long reasoning training can move the policy far from where it began.', code: 'dapo' },
        { id: 'result', say: 'From a thirty-two billion parameter base it reached about fifty on {AIME|A I M E}, beating the {R1|R one} paper\'s RL result there in half the steps.' },
      ],
    },
    {
      id: 'outro',
      title: 'Takeaways',
      codeTitle: 'summary.py',
      code: `
        r = float(extract(o) == answer)  #@rlvr
        A = (r - r.mean()) / r.std()     #@grpo
        loss = -(clipped(ratio, A)       #@grpo
                 - beta * kl)            #@grpo
        # no critic: half PPO's memory   #@mem
        # R1: long CoT, then distill     #@r1
        # watch: no-signal groups,       #@fail
        #   length and difficulty bias,  #@fail
        #   entropy collapse             #@fail
      `,
      beats: [
        { id: 'rlvr', say: 'To sum up. Verifiable rewards replace a learned reward model with a program, far harder to hack if the checker is strict.', code: 'rlvr' },
        { id: 'grpo', say: '{GRPO|G R P O} is {PPO|P P O} without the critic: sample a group, use its mean as the baseline, give every token its output\'s advantage, and clip.', code: 'grpo' },
        { id: 'mem', say: 'Dropping the critic halves the memory, and samples you were going to draw anyway do the critic\'s job.', code: 'mem' },
        { id: 'r1', say: '{R1-Zero|R one Zero} showed this alone grows long reasoning and self-checking. {R1|R one} made it readable; distillation handed it down.', code: 'r1' },
        { id: 'fail', say: 'And the sharp edges have names: no-signal groups, length and difficulty bias, entropy collapse. {Dr. GRPO|Doctor G R P O} and {DAPO|D A P O} fix them.', code: 'fail' },
        { id: 'next', say: 'Next, reasoning at test time: longer chains of thought, many samples and a vote, and verifiers that trade compute for accuracy.', pause: 0.6 },
      ],
    },
  ],
};

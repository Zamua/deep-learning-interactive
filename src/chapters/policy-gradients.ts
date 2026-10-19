import type { ChapterDef } from './index';
import { fmt } from '../core/code';
import { color, withAlpha } from '../core/plot';
import { Rng } from '../core/rand';
import { POLICY_GRADIENTS_SYMBOLS } from '../lib/policy-gradients-symbols';
import { answerBars, chartFrame, polyline, rrect, seg, signedBars, textW, txt, type Ctx } from '../lib/policy-gradients-draw';
import {
  ANSWERS,
  ANSWERS_KL,
  CHUNKS,
  CREDIT_LIMIT,
  EXPLORE_LR,
  EXPLORE_SEEDS,
  EXPLORE_STEPS,
  PI0,
  PI0_EXPLORE,
  PROMPT,
  REF_KL,
  REWARD,
  RM_KL,
  TREE,
  TRUE_KL,
  VAR_LR,
  VAR_SEEDS,
  VAR_STEPS,
  Pg,
  type Response,
  creditStats,
  curves,
  dot,
  entropy,
  exactGrad,
  expectedReward,
  gradLogPi,
  gradNoise,
  kl,
  leafOf,
  optimalPolicy,
  sampleFrom,
  sampleResponse,
  softmax,
  trajectories,
} from '../lib/policy-gradients-toy';

const pct = (v: number) => `${Math.round(v * 100)}%`;
const rLabel = (v: number) => `R ${fmt(v, 2)}`;

const chapter: ChapterDef = {
  symbols: POLICY_GRADIENTS_SYMBOLS,

  render(p) {
    p.prose(`
Every chapter so far has trained a model to *imitate*. Pretraining imitates the web, one next token at a time; supervised fine-tuning ([Chapter 13](#/finetuning)) imitates answers that people wrote down. Imitation needs someone to write the right answer first.

Many things are easier to *judge* than to demonstrate. A program can check whether a math answer is right or whether code passes its tests. A person can say which of two replies they prefer, even if they could not have written either one. **Reinforcement learning** (RL) is the toolkit for learning from a judgment instead of a target: the model tries something, gets a score, and shifts its probabilities toward whatever scored well.

This chapter builds that toolkit from scratch on a toy small enough to see completely: the policy gradient, REINFORCE, baselines and advantages, credit assignment, the KL leash and exploration. The next three chapters are variations on it. [RLHF and PPO](#/rlhf) learn the score from human preferences, [DPO](#/dpo) gets rid of the sampling loop, and [GRPO](#/grpo) uses scores that a program can verify.`);

    // ------------------------------------------------------------ policy
    p.h2('Text generation as a policy', 'policy');
    p.prose(`RL comes with its own vocabulary, but for a language model every word has a plain meaning:`);
    p.table(
      ['RL word', 'For a language model'],
      [
        ['**state** $s_t$', 'the prompt plus every token written so far'],
        ['**action** $a_t$', 'the next token'],
        ['**policy** $\\sympi(a_t \\mid s_t)$', 'the model itself: its softmax over the vocabulary, computed with weights $\\symtheta$'],
        ['**episode**', 'one complete response $y$, from its first token to the end-of-sequence token'],
        ['**reward** $\\symR(y)$', 'one score for the whole response: from a checker program, a reward model, or a person'],
      ],
    );
    p.prose(`
Nothing about the network changes. A language model already *is* a policy: given a state, it returns a probability for every possible action. Generating text is acting, and sampling is how the policy chooses.

### The probability of a whole answer

A response is a chain of choices, so its probability is a product: the probability of the first token, times the probability of the second given the first, and so on (the chain rule of probability from [pretraining](#/pretraining)).`);
    p.math({
      label: 'An answer\'s probability, and its log-probability',
      tex: String.raw`\begin{aligned} \sympi(y \mid x) &= \prod_{t=1}^{T} \sympi(y_t \mid x, y_{<t}) \\ \log \sympi(y \mid x) &= \sum_{t=1}^{T} \log \sympi(y_t \mid x, y_{<t}) \end{aligned}`,
      codeTitle: 'logprob.py',
      code: `
        token_probs = np.array([0.5, 0.4])
        np.prod(token_probs)          # 0.2
        np.sum(np.log(token_probs))   # -1.609 = log(0.2)

        np.prod(np.full(1100, 0.5))   # 0.0: underflow
        np.sum(np.log(np.full(1100, 0.5)))   # -762.5
      `,
      terms: [
        ['x', 'the prompt'],
        ['y_t,\\; y_{<t}', 'the $t$-th token of the response, and all the tokens before it'],
        [String.raw`\sympi(y_t \mid x, y_{<t})`, "the model's probability for that token in that context: one entry of its softmax"],
        [String.raw`\prod_{t=1}^{T}`, 'multiply over every position from 1 to $T$ ($\\prod$ is to multiplying what $\\sum$ is to adding)'],
        [String.raw`\log \sympi(y \mid x)`, 'the log-probability of the whole response: a plain sum of per-token log-probabilities'],
      ],
      explain: `Multiply many numbers below 1 and the result races toward zero. A 500-token answer whose tokens each had probability 0.5 has probability $0.5^{500} \\approx 3 \\times 10^{-151}$, and at 1,100 tokens a 64-bit float rounds it to exactly 0. Logs fix this: the log of a product is the sum of the logs, so instead of multiplying tiny numbers we add moderate negative ones ($\\log 0.5 \\approx -0.69$ per token). Every method in the coming chapters works with log-probabilities, and as we will see, the gradient we need is the gradient of a log anyway.`,
    });
    p.callout('math', `Here $\\log$ is the natural logarithm, the inverse of $e^x$. Three facts carry this chapter. $\\log 1 = 0$. The log of a number between 0 and 1 is negative, and very negative for tiny numbers ($\\log 0.01 \\approx -4.6$). And $\\log(ab) = \\log a + \\log b$, which turns products into sums. So a token the model was sure of costs almost nothing in log space, and a rare token costs a lot. The [math survival kit](#/math-kit) has the long version.`, 'Math help: logarithms');

    p.figure({
      title: 'An answer is a path through a tree of tokens',
      codeTitle: 'generate.py',
      code: `
        vocab = ["Yes", "No", ".", ", odd.", ", 7×13."]
        state = "${PROMPT}"
        logp = 0.0
        for t in range(2):    # 2 tokens per answer here
            probs = model(state)    # softmax   #@probs
            a = np.random.choice(5, p=probs)    #@act
            logp += np.log(probs[a])            #@logp
            state += vocab[a]       # new state #@act
        R = grade(state)      # only at the end  #@R
        # y = "{{ans:No, 7×13.}}"
        # pi(y) = {{py:0.20}}, log pi(y) = {{lp:-1.61}}
        # R = {{R:1}}
      `,
      setup(f) {
        let leaf = 3;
        let anim = 3;
        const rng = new Rng(7);
        const path = (k: number) => [Math.floor(k / 2), k % 2] as const;
        // Rows in px from the bottom up, so the labels keep their spacing at any width.
        const leafRow = (h: number) => h - 136;
        const cv = f.canvas(640, 620, (c, w, h) => {
          const [li, lj] = path(leaf);
          const lit1 = (i: number) => (i === li ? Math.min(1, anim) : 0);
          const lit2 = (i: number, j: number) => (i === li && j === lj ? Math.max(0, Math.min(1, anim - 1)) : 0);
          const ly = leafRow(h);
          const root = { x: w / 2, y: 24 };
          const mid = [w * 0.27, w * 0.73].map((x) => ({ x, y: (root.y + ly) / 2 }));
          const lx = [w * 0.135, w * 0.405, w * 0.595, w * 0.865];
          const chip = (x: number, y: number, s: string, on: number, k: 'purple' | '--ink-3', fs = 12.5) => {
            const tw = textW(c, s, fs, true, 600) + 16;
            rrect(c, x - tw / 2, y - 13, tw, 26, 7, withAlpha(color(k === '--ink-3' ? 'slate' : k), 0.1 + 0.2 * on), on > 0.5 ? color('purple') : withAlpha(color('slate'), 0.6), on > 0.5 ? 2 : 1);
            txt(c, s, x, y + 1, { size: fs, mono: true, weight: 600, align: 'center' });
          };
          const edge = (x0: number, y0: number, x1: number, y1: number, pr: number, on: number) => {
            seg(c, x0, y0 + 14, x1, y1 - 14, on > 0 ? withAlpha(color('purple'), 0.35 + 0.65 * on) : withAlpha(color('--ink-3'), 0.5), 1.2 + 2 * on);
            txt(c, fmt(pr, 2), (x0 + x1) / 2 + (x1 > x0 ? 10 : -10), (y0 + y1) / 2, { size: 11.5, mono: true, align: x1 > x0 ? 'left' : 'right', color: on > 0.5 ? color('purple') : color('--ink-2'), weight: on > 0.5 ? 600 : 400, halo: true });
          };
          TREE.first.forEach((t, i) => {
            edge(root.x, root.y, mid[i]!.x, mid[i]!.y, t.p, lit1(i));
            TREE.second[i]!.forEach((t2, j) => edge(mid[i]!.x, mid[i]!.y, lx[i * 2 + j]!, ly, t2.p, lit2(i, j)));
          });
          chip(root.x, root.y, PROMPT, 0, '--ink-3', 12);
          TREE.first.forEach((t, i) => chip(mid[i]!.x, mid[i]!.y, t.tok, lit1(i), 'purple'));
          const fsz = w < 420 ? 11 : 12;
          ANSWERS.forEach((ans, k) => {
            const [i, j] = path(k);
            const on = lit2(i, j);
            chip(lx[k]!, ly, TREE.second[i]![j]!.tok, on, 'purple', w < 420 ? 11.5 : 12.5);
            const yy = ly + 30;
            txt(c, `"${ans}"`, lx[k]!, yy, { size: fsz, mono: true, align: 'center', color: color('--ink-2') });
            txt(c, `π ${fmt(PI0[k]!, 2)}`, lx[k]!, yy + 18, { size: fsz, mono: true, align: 'center', color: color('purple') });
            const ra = k === leaf ? Math.max(0, Math.min(1, anim - 2)) : 0;
            rrect(c, lx[k]! - 24, yy + 29, 48, 20, 6, withAlpha(color('gold'), 0.08 + 0.3 * ra), withAlpha(color('gold'), 0.4 + 0.6 * ra), 1 + ra);
            txt(c, `R ${REWARD[k]}`, lx[k]!, yy + 39, { size: fsz, mono: true, align: 'center', color: color('--ink'), weight: ra > 0.5 ? 600 : 400 });
          });
          // the arithmetic for the chosen path
          if (anim >= 2) {
            const p1 = TREE.first[li]!.p;
            const p2 = TREE.second[li]![lj]!.p;
            const by = h - 42;
            const fs2 = w < 420 ? 11.5 : 12.5;
            txt(c, `π(y) = ${p1.toFixed(1)} × ${p2.toFixed(1)} = ${(p1 * p2).toFixed(2)}`, w / 2, by, { size: fs2, mono: true, align: 'center', color: color('purple'), weight: 600 });
            txt(c, `log π(y) = ${Math.log(p1).toFixed(2)} + (${Math.log(p2).toFixed(2)}) = ${Math.log(p1 * p2).toFixed(2)}`, w / 2, by + 22, { size: fs2, mono: true, align: 'center', color: color('--ink-2') });
          }
        });
        cv.canvas.classList.add('scroll-ok');
        const pyRo = f.readout('π(y)', { sym: 'pi' });
        const lpRo = f.readout('log π(y)');
        const rRo = f.readout('R(y)', { sym: 'R' });
        const sync = () => {
          const [i, j] = path(leaf);
          const pr = TREE.first[i]!.p * TREE.second[i]![j]!.p;
          f.code.setMany({ ans: ANSWERS[leaf]!, py: pr.toFixed(2), lp: Math.log(pr).toFixed(2), R: REWARD[leaf]! });
          pyRo.set(pr.toFixed(2));
          lpRo.set(Math.log(pr).toFixed(2));
          rRo.set(REWARD[leaf]!);
        };
        const run = f.loop((dt) => {
          anim = Math.min(3, anim + dt * 2.2);
          f.code.highlight(anim < 1 ? ['probs', 'act'] : anim < 2 ? ['probs', 'act', 'logp'] : 'R');
          cv.redraw();
          if (anim >= 2) sync();
          if (anim >= 3) return false;
        });
        const go = (k: number) => {
          leaf = k;
          anim = 0;
          f.code.setMany({ ans: ANSWERS[k]!, py: '…', lp: '…', R: '…' });
          pyRo.set('…');
          lpRo.set('…');
          rRo.set('…');
          run.start();
        };
        f.button('Sample', () => {
          const i = sampleFrom(TREE.first.map((t) => t.p), rng);
          const j = sampleFrom(TREE.second[i]!.map((t) => t.p), rng);
          go(leafOf(i, j));
        }, { primary: true, icon: 'shuffle' });
        cv.canvas.addEventListener('pointerdown', (e) => {
          const r = cv.canvas.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width;
          const y = e.clientY - r.top;
          if (y > leafRow(r.height) - 20 && y < r.height - 56) go(Math.max(0, Math.min(3, Math.floor(x * 4))));
        });
        sync();
      },
      caption: `Each box is one token (to keep the tree small, a few short tokens share a box). The numbers on the branches are the policy's probabilities: one softmax per state. Press **Sample** to generate an answer, or **tap an answer** to choose its path. The path lights up, its probability is the product along it, and its log-probability is the sum of the logs. The grade arrives only at the very end. These four answers are the whole world of this toy, and their probabilities add up to 1.`,
    });

    // ------------------------------------------------------------ expected reward
    p.h2('The goal: a high reward on average', 'expected-reward');
    p.prose(`
Sampling is random, so the same policy writes different answers, with different rewards, each time. We cannot ask for a high reward on one sample. We can ask for a high reward *on average*: if we sampled a thousand answers from this policy and graded them all, what would the mean grade be? That average is the **expected reward**, and it is the number RL tries to push up.`);
    p.math({
      label: 'Expected reward',
      tex: String.raw`\begin{aligned} J(\symtheta) &= \mathbb{E}_{y \sim \sympi}\big[\symR(y)\big] \\ &= \sum_{y} \sympi(y)\,\symR(y) \\ &\approx \frac{1}{N}\sum_{i=1}^{N} \symR(y_i) \end{aligned}`,
      codeTitle: 'expected_reward.py',
      code: `
        # answers: Yes. / Yes, odd. / No. / No, 7×13.
        pi = np.array([0.4, 0.1, 0.3, 0.2])
        R = np.array([0.0, 0.0, 0.5, 1.0])   # grades

        J = np.sum(pi * R)       # exact: 0.35
        ys = np.random.choice(4, size=1000, p=pi)
        J_hat = R[ys].mean()     # close to 0.35
      `,
      terms: [
        [String.raw`J(\symtheta)`, 'the objective: one number for every setting of the weights $\\symtheta$. RL climbs it'],
        [String.raw`\mathbb{E}_{y \sim \sympi}[\,\cdot\,]`, 'the *expected value*: the average of what is inside the brackets, when $y$ is drawn from the policy. Read $y \\sim \\sympi$ as "y sampled from pi"'],
        [String.raw`\sum_{y} \sympi(y)\,\symR(y)`, 'the exact version: every possible answer\'s reward, weighted by how often the policy writes it'],
        [String.raw`\frac{1}{N}\sum_{i} \symR(y_i)`, 'the practical version: draw $N$ answers, grade them, take the mean'],
      ],
      explain: `An expectation is a weighted average where the weights are probabilities. For the toy: $0.4 \\times 0 + 0.1 \\times 0 + 0.3 \\times 0.5 + 0.2 \\times 1 = 0.35$. A real language model can write more different answers than there are atoms in the universe, so the exact sum is out of reach. The sample average, though, closes in on it as $N$ grows, with an error that shrinks like $1/\\sqrt{N}$. Everything in this chapter is built so that it can be estimated the same way: sample, score, average.`,
    });
    p.callout('aside', `A problem with one decision and one reward is called a **bandit**, after slot machines ("one-armed bandits"). Our toy is a four-armed bandit: four whole answers to *${PROMPT}*, each with a fixed grade. Real models make thousands of decisions per answer, but the previous section showed that the log-probability of an answer is just a sum over its tokens, so everything we derive for the bandit carries over to text.`, 'A four-armed bandit');

    p.figure({
      title: 'Expected reward is an average over many samples',
      codeTitle: 'estimate.py',
      code: `
        pi = np.array([0.4, 0.1, 0.3, 0.2])
        R = np.array([0.0, 0.0, 0.5, 1.0])
        J = np.sum(pi * R)       # 0.35         #@exact

        N = {{N:0}}
        ys = np.random.choice(4, size=N, p=pi)  #@sample
        counts = np.bincount(ys, minlength=4)   #@sample
        J_hat = R[ys].mean()     # {{est:…}}      #@avg
      `,
      setup(f) {
        const rng = new Rng(11);
        const ys: number[] = [];
        const runAvg: number[] = [];
        let sum = 0;
        const J = expectedReward(PI0);
        const cv = f.canvas(640, 600, (c, w, h) => {
          const n = ys.length;
          const counts = [0, 0, 0, 0];
          ys.forEach((y) => counts[y]!++);
          const freq = counts.map((k) => (n ? k / n : 0));
          answerBars(c, [6, 4, w - 12, h * 0.5], {
            labels: ANSWERS,
            pi: PI0,
            ghost: n ? freq : undefined,
            ghostColor: 'slate',
            sub: REWARD.map(rLabel),
            show: (i) => (n ? `${pct(PI0[i]!)} / ${pct(freq[i]!)}` : pct(PI0[i]!)),
            max: 0.6,
            title: n ? 'probability / share of samples' : 'probability of each answer',
          });
          const xmax = Math.max(1000, 10 ** Math.ceil(Math.log10(Math.max(1, n))));
          const ticks = [1, 10, 100, 1000, 10000].filter((t) => t <= xmax);
          const { X, Y } = chartFrame(c, [4, h * 0.56, w - 8, h * 0.44], [1, xmax, 0, 1], { logX: true, xTicks: ticks, yTicks: [0, 0.5, 1], xLabel: 'samples N', xFmt: (v) => (v >= 1000 ? `${v / 1000}k` : String(v)) });
          seg(c, X(1), Y(J), X(xmax), Y(J), color('gold'), 1.5, [6, 4]);
          txt(c, 'E[R] = 0.35', X(xmax) - 4, Y(J) - 10, { size: 11, mono: true, align: 'right', color: color('gold'), halo: true });
          if (n) {
            const xs = runAvg.map((_, i) => X(i + 1));
            const yv = runAvg.map((v) => Y(v));
            polyline(c, xs, yv, n, color('purple'), 1.8);
            c.beginPath();
            c.arc(xs[n - 1]!, yv[n - 1]!, 3.5, 0, Math.PI * 2);
            c.fillStyle = color('purple');
            c.fill();
          }
          txt(c, 'running average of R', X(1) + 6, Y(1) + 2, { size: 11, color: color('purple'), halo: true });
        });
        cv.canvas.classList.add('scroll-ok');
        const nRo = f.readout('N');
        const avgRo = f.readout('average R', { sym: 'R' });
        const add = (k: number) => {
          for (let i = 0; i < k && ys.length < 20000; i++) {
            const y = sampleFrom(PI0, rng);
            ys.push(y);
            sum += REWARD[y]!;
            runAvg.push(sum / ys.length);
          }
          const n = ys.length;
          nRo.set(n);
          avgRo.set(n ? fmt(sum / n, 3) : '–');
          f.code.setMany({ N: n, est: n ? fmt(sum / n, 3) : '…' });
          f.code.highlight(n ? ['sample', 'avg'] : 'exact');
          cv.redraw();
        };
        f.button('Sample 1', () => add(1), { primary: true });
        f.button('Sample 10', () => add(10));
        f.button('Sample 100', () => add(100));
        f.button('Reset', () => {
          ys.length = 0;
          runAvg.length = 0;
          sum = 0;
          add(0);
        }, { icon: 'reset' });
        add(0);
      },
      caption: `The bars show the policy's probability for each answer (purple) and, once you sample, the share of samples that landed on it (dashed). The chart is the running average of the grades. Press **Sample 1** a few times: the average jumps around. Then **Sample 100** a few times: the shares settle onto the probabilities, and the average settles onto the exact expected reward, 0.35 (dashed gold line). For a real model this is the only way to measure expected reward: sample and average.`,
    });

    // ------------------------------------------------------------ log-derivative trick
    p.h2('The policy gradient and the log-derivative trick', 'log-derivative');
    p.prose(`
To improve the policy we want the gradient of $J$: for every weight, the direction that makes the expected reward go up (the gradient is the list of those slopes; see [optimization](#/optimization)). Then we step uphill, which is gradient descent with the sign flipped.

Here is the snag. Differentiate the exact sum, and the rewards stay put, because the grade of a given answer does not depend on $\\symtheta$; only the probabilities do. That leaves $\\nabla_\\theta J = \\sum_y \\nabla_\\theta \\sympi(y)\\, \\symR(y)$. This is no longer an average over samples: there is no $\\sympi(y)$ in front saying "weighted by how often the policy writes $y$". So we cannot estimate it by sampling, and we cannot compute the sum, because there are far too many answers. One line of calculus gets us out.`);
    p.math({
      label: 'The log-derivative trick',
      tex: String.raw`\nabla_\theta \sympi(y) = \sympi(y)\;\symg(y)`,
      codeTitle: 'check_trick.py',
      code: `
        theta = np.log([0.4, 0.1, 0.3, 0.2])
        y = 3
        f = lambda th: softmax(th)[y]    # pi(y)
        lf = lambda th: np.log(f(th))    # log pi(y)
        d = 1e-5 * np.eye(4)[0]          # nudge theta[0]

        dpi = (f(theta + d) - f(theta - d)) / 2e-5
        dlog = (lf(theta + d) - lf(theta - d)) / 2e-5
        dpi, f(theta) * dlog      # -0.08, -0.08
      `,
      terms: [
        [String.raw`\nabla_\theta \sympi(y)`, 'how the probability of answer $y$ changes as the weights change'],
        [String.raw`\symg(y)`, 'how its *log*-probability changes'],
        [String.raw`\sympi(y)\;\cdot`, 'multiplied back by the probability itself'],
      ],
      explain: `This is the chain rule and nothing more. The derivative of $\\log u$ is $1/u$ times the derivative of $u$, so $\\nabla \\log \\pi = \\nabla\\pi / \\pi$; multiply both sides by $\\pi$. It looks like a step backwards, trading a gradient for a gradient times a probability. But that probability is exactly the weight that an average over samples needs.`,
    });
    p.math({
      label: 'The policy gradient',
      tex: String.raw`\begin{aligned} \nabla_\theta J &= \sum_y \sympi(y)\,\symR(y)\,\symg(y) \\ &= \mathbb{E}_{y\sim\sympi}\big[\,\symR(y)\;\symg(y)\,\big] \end{aligned}`,
      codeTitle: 'policy_gradient.py',
      code: `
        def policy_gradient(theta, N=1000):
            pi = softmax(theta)
            ys = np.random.choice(4, size=N, p=pi)
            grad_logp = np.eye(4)[ys] - pi    # (N, 4)
            w = R[ys][:, None]                # (N, 1)
            return (w * grad_logp).mean(axis=0)
      `,
      terms: [
        [String.raw`\sum_y \sympi(y)\,\symR(y)\,\symg(y)`, 'the trick substituted into $\\sum_y \\nabla_\\theta\\sympi(y)\\,\\symR(y)$: the weight $\\sympi(y)$ is back in front'],
        [String.raw`\mathbb{E}_{y\sim\sympi}[\,\cdot\,]`, 'so it is an average over the policy\'s samples again, which we know how to estimate'],
        [String.raw`\symR(y)\;\symg(y)`, 'for one sampled answer: the direction that makes it more likely, scaled by its reward'],
      ],
      explain: `Read it as a recipe. Sample an answer from the policy; find the direction in weight space that makes that answer more likely; scale it by the answer's reward; average over many samples. High-reward answers get pushed up hard, low-reward answers barely at all. Nothing here needs the reward to be differentiable, or even to be a formula: it is one number per sample, from a program, a model or a person. That is why this single equation sits under all of post-training.`,
    });
    p.prose(`
For a softmax policy the last ingredient, $\\symg(y)$, has a famously simple form. Let the policy's parameters be one logit per answer, $\\symtheta_k$, so that $\\sympi = \\text{softmax}(\\symtheta)$, exactly like the class scores of a [linear classifier](#/linear-classification).`);
    p.math({
      label: 'The gradient of a softmax policy\'s log-probability',
      tex: String.raw`\begin{aligned} \frac{\partial \log \sympi(y)}{\partial \symtheta_k} &= \mathbf{1}[k = y] - \sympi(k) \\ \symg(y) &= \mathbf{e}_y - \sympi \end{aligned}`,
      codeTitle: 'grad_log_softmax.py',
      code: `
        def grad_log_softmax(theta, y):
            pi = softmax(theta)
            return np.eye(len(theta))[y] - pi

        # the linear classifier's gradient on its scores:
        dscores = probs.copy()
        dscores[y] -= 1      # = -grad_log_softmax
      `,
      terms: [
        [String.raw`\symtheta_k`, 'the logit of answer $k$'],
        [String.raw`\mathbf{1}[k = y]`, '1 if $k$ is the sampled answer, 0 otherwise'],
        [String.raw`\mathbf{e}_y`, 'a one-hot vector: 1 at position $y$, 0 everywhere else'],
        [String.raw`\mathbf{e}_y - \sympi`, 'raise the sampled answer\'s logit by $1 - \\sympi(y)$, and lower every other logit by its own probability'],
      ],
      explain: `You have met this before, with the sign flipped. The gradient of the softmax cross-entropy loss with respect to the scores was the probabilities minus the one-hot label. So $\\nabla\\log\\sympi(y)$ is exactly *minus* the cross-entropy gradient, with the sampled answer playing the label. A policy-gradient step is a supervised step on the model's own sample, treated as if it were the correct answer, with the step scaled by the reward. A language model's output layer is a softmax over the vocabulary, so the same formula applies at every token.`,
    });

    p.figure({
      title: 'One sample\'s gradient is noisy; the average is right',
      codeTitle: 'gradient_estimates.py',
      code: `
        pi = softmax(theta)     # [0.4, 0.1, 0.3, 0.2]
        true_grad = pi * (R - pi @ R)          #@true
        # = [-0.14, -0.035, 0.045, 0.13]       #@true

        ests = []
        for i in range({{N:0}}):
            y = np.random.choice(4, p=pi)      #@sample
            grad_logp = np.eye(4)[y] - pi      #@est
            ests.append(R[y] * grad_logp)      #@est
        avg = np.mean(ests, axis=0)            #@avg
        # last: [{{e0:0}}, {{e1:0}}, {{e2:0}}, {{e3:0}}]
        # avg:  [{{a0:0}}, {{a1:0}}, {{a2:0}}, {{a3:0}}]
      `,
      setup(f) {
        const rng = new Rng(3);
        const tg = exactGrad(PI0);
        let n = 0;
        let last = [0, 0, 0, 0];
        let lastY = -1;
        const sum = [0, 0, 0, 0];
        const cv = f.canvas(640, 600, (c, w, h) => {
          signedBars(c, [6, 4, w - 12, h * 0.4], last, 1, { title: n ? `this sample ("${ANSWERS[lastY]}"): R(y) · ∇log π(y)` : 'this sample: R(y) · ∇log π(y)', hideValues: !n });
          if (!n) txt(c, 'press Sample', w / 2, h * 0.12, { size: 12, align: 'center', color: color('--ink-3') });
          const slot = (w - 12) / 4;
          ANSWERS.forEach((a, i) => {
            const cx = 6 + slot * (i + 0.5);
            txt(c, a, cx, h * 0.455, { size: w < 420 ? 11 : 12, mono: true, align: 'center', weight: i === lastY ? 700 : 400, color: i === lastY ? color('gold') : color('--ink') });
          });
          const avg = sum.map((s) => (n ? s / n : 0));
          signedBars(c, [6, h * 0.5, w - 12, h * 0.5 - 4], avg, 0.2, { title: `average of ${n} sample${n === 1 ? '' : 's'} vs exact (ticks)`, ticks: tg, fmtDigits: 3, hideValues: !n });
        });
        cv.canvas.classList.add('scroll-ok');
        const nRo = f.readout('N');
        const add = (k: number) => {
          for (let i = 0; i < k; i++) {
            const y = sampleFrom(PI0, rng);
            const gl = gradLogPi(PI0, y);
            last = gl.map((v) => REWARD[y]! * v);
            lastY = y;
            last.forEach((v, j) => (sum[j]! += v));
            n++;
          }
          nRo.set(n);
          const v: Record<string, string> = { N: String(n) };
          last.forEach((x, j) => (v[`e${j}`] = fmt(x, 3)));
          sum.forEach((x, j) => (v[`a${j}`] = fmt(n ? x / n : 0, 3)));
          f.code.setMany(v);
          f.code.highlight(n ? ['sample', 'est', 'avg'] : 'true');
          cv.redraw();
        };
        f.button('Sample 1', () => add(1), { primary: true });
        f.button('Sample 100', () => add(100));
        f.button('Reset', () => {
          n = 0;
          lastY = -1;
          last = [0, 0, 0, 0];
          sum.fill(0);
          add(0);
        }, { icon: 'reset' });
        add(0);
      },
      caption: `Top: the gradient estimate from the latest single sample, one bar per answer's logit (scale ±1). Bottom: the average of every estimate so far (scale ±0.2), against the exact gradient (thick ticks). Sample a few times. A wrong answer has reward 0, so it contributes nothing at all. A rewarded answer pushes its own logit up and every other logit down. Single estimates are wild, often many times larger than the true gradient, yet their average closes in on it. In statistics' words, the estimate is *unbiased* (right on average) but has high *variance* (any single value is far off). Variance is the enemy for the rest of this chapter.`,
    });

    // ------------------------------------------------------------ REINFORCE
    p.h2('REINFORCE', 'reinforce');
    p.prose(`
Put the pieces together and you have the oldest policy-gradient algorithm, **REINFORCE** (Williams, 1992): sample, score, step uphill along $\\symR\\,\\nabla\\log\\pi$, repeat. In a deep learning framework nobody writes that gradient by hand. Instead we write a *surrogate loss*, a quantity whose gradient is the (negative) policy gradient, and let autograd do the rest. The sign flips because frameworks minimize.`);
    p.math({
      label: 'The REINFORCE loss',
      tex: String.raw`\mathcal{L}(\symtheta) = -\frac{1}{N}\sum_{i=1}^{N} \symR(y_i)\,\log \sympi(y_i \mid x_i)`,
      codeTitle: 'reinforce_loss.py',
      code: `
        y = model.generate(x)     # N answers: (N, T)
        R = grade(x, y)           # (N,) plain numbers
        logits = model(x, y)      # (N, T, vocab)
        logp = logits.log_softmax(-1)
        logp = logp.gather(-1, y[..., None]).squeeze(-1)
        seq_logp = (logp * mask).sum(-1)    # (N,)
        loss = -(R * seq_logp).mean()
        loss.backward()
        opt.step()
      `,
      terms: [
        ['y_i', 'answer $i$, sampled from the current policy for prompt $x_i$'],
        [String.raw`\symR(y_i)`, 'its reward, treated as a fixed number'],
        [String.raw`\log \sympi(y_i \mid x_i)`, 'its log-probability: the sum over its tokens (the `mask` keeps only the answer, not the prompt or padding)'],
        [String.raw`-\frac{1}{N}\sum_i`, 'average over the batch, and flip the sign so that minimizing the loss maximizes reward'],
      ],
      explain: `Take the gradient of this loss and you get minus the sampled policy gradient, because the reward is a constant. Look at its shape: it is cross-entropy on the model's own samples, weighted by reward. A supervised loss whose "labels" are whatever the model happened to write, and whose weights say how much to believe them. Unlike a normal loss, its value means little (it depends on which answers were sampled), so in practice you watch the average reward instead.`,
    });
    p.callout('warning', `The reward enters as a constant: in PyTorch you would compute it without gradients or call \`.detach()\` on it. That is a feature. The grader can be a Python script, a unit test or a person, none of which has a gradient. It also means that when the reward comes from a network (a reward model, next chapter), the policy is never told *why* an answer scored well, only *that* it did.`, 'No gradient flows through the reward');

    p.figure({
      title: 'REINFORCE on the four-answer bandit',
      codeTitle: 'reinforce.py',
      code: `
        R = np.array([0.0, 0.0, 0.5, 1.0])    # grades
        theta = np.log([0.4, 0.1, 0.3, 0.2])  # base model
        lr = {{lr:0.3}}

        for step in range(400):
            pi = softmax(theta)                #@pi
            y = np.random.choice(4, p=pi)      #@sample
            grad_logp = np.eye(4)[y] - pi      #@grad
            theta += lr * R[y] * grad_logp     #@update
        # step {{step:0}}: y = {{y:…}}
        # R[y] = {{ry:…}}
      `,
      setup(f) {
        let seed = 21;
        let lr = 0.3;
        let pg = new Pg(PI0, { lr }, seed);
        let prev = PI0.slice();
        let lastY = -1;
        const hist = [expectedReward(PI0)];
        let phase = 0;
        const cv = f.canvas(640, 620, (c, w, h) => {
          const pi = pg.pi;
          const bars = answerBars(c, [6, 4, w - 12, h * 0.55], {
            labels: ANSWERS,
            pi,
            hi: lastY >= 0 ? lastY : undefined,
            sub: REWARD.map(rLabel),
            show: (i) => pct(pi[i]!),
            title: 'π(y): the policy',
          });
          // how each probability just moved
          if (lastY >= 0)
            bars.xs.forEach((x, i) => {
              const d = pi[i]! - prev[i]!;
              if (Math.abs(d) < 0.002) return;
              const ax = x + bars.bw / 2 + 9;
              const y1 = bars.sy(pi[i]!);
              const y0 = bars.sy(prev[i]!);
              const col = d > 0 ? color('green') : color('red');
              seg(c, ax, y0, ax, y1, col, 2);
              c.beginPath();
              const dir = d > 0 ? -1 : 1;
              c.moveTo(ax, y1);
              c.lineTo(ax - 4, y1 - dir * 6);
              c.lineTo(ax + 4, y1 - dir * 6);
              c.closePath();
              c.fillStyle = col;
              c.fill();
            });
          const T = Math.max(200, hist.length - 1);
          const { X, Y } = chartFrame(c, [4, h * 0.6, w - 8, h * 0.4], [0, T, 0, 1], { xTicks: [0, T / 2, T], yTicks: [0, 0.5, 1], xLabel: 'step' });
          polyline(c, hist.map((_, i) => X(i)), hist.map((v) => Y(v)), hist.length, color('gold'), 2);
          txt(c, 'E[R] under the policy', X(0) + 6, Y(1) + 2, { size: 11, color: color('gold'), halo: true });
        });
        cv.canvas.classList.add('scroll-ok');
        const stepRo = f.readout('step');
        const erRo = f.readout('E[R]', { sym: 'R' });
        const one = () => {
          prev = pg.pi;
          const s = pg.step();
          lastY = s.ys[0]!;
          hist.push(expectedReward(pg.pi));
          f.code.setMany({ step: pg.t, y: `${lastY} "${ANSWERS[lastY]}"`, ry: fmt(REWARD[lastY]!, 2) });
          stepRo.set(pg.t);
          erRo.set(fmt(hist[hist.length - 1]!, 3));
        };
        const loop = f.loop(() => {
          one();
          f.code.highlight(['pi', 'sample', 'grad', 'update'][phase++ % 4]!);
          cv.redraw();
          if (pg.t >= 400) {
            stop();
            return false;
          }
        });
        const stop = () => {
          loop.stop();
          runBtn.textContent = 'Run';
          f.code.highlight(null);
        };
        f.button('Step', () => {
          stop();
          one();
          f.code.highlight(['sample', 'grad', 'update']);
          cv.redraw();
        }, { icon: 'next' });
        const runBtn = f.button('Run', () => {
          if (loop.running()) stop();
          else {
            if (pg.t >= 400) reset(false);
            loop.start();
            runBtn.textContent = 'Pause';
          }
        }, { primary: true });
        const reset = (newSeed: boolean) => {
          stop();
          if (newSeed) seed++;
          pg = new Pg(PI0, { lr }, seed);
          prev = PI0.slice();
          lastY = -1;
          hist.length = 1;
          f.code.setMany({ step: 0, y: '…', ry: '…' });
          stepRo.set(0);
          erRo.set(fmt(hist[0]!, 3));
          cv.redraw();
        };
        f.button('Reset', () => reset(true), { icon: 'reset' });
        f.slider({ label: 'learning rate', min: 0.05, max: 2, step: 0.05, value: 0.3, slot: 'lr', onInput: (v) => {
          lr = v;
          pg.opts.lr = v;
        } });
        reset(false);
      },
      caption: `Each **Step** samples one answer (ringed in gold), grades it, and moves the logits by \`lr * R[y] * grad_logp\`; the small arrows show how each probability just moved. **Run** repeats that, one step per frame. The policy starts as the base model, 40% on the wrong "Yes.", and drifts toward "No, 7×13.", which has the best grade. Notice that sampling a wrong answer changes nothing, because its reward is 0. **Reset** starts a fresh random run: every run takes a different path, and some take much longer than others. Raise the learning rate and runs get faster and more erratic.`,
    });

    // ------------------------------------------------------------ baselines
    p.h2('Variance, baselines and advantages', 'baselines');
    p.prose(`
REINFORCE works, but it is noisy, and the noise has a specific cause. The update pushes up *every* sampled answer in proportion to its reward. Suppose the grader handed out 1 to 2 points instead of 0 to 1. Then every answer the model writes gets pushed up, the good ones only a little more than the bad ones. The useful signal lives in the *differences* between rewards, buried under a big common push that only cancels out on average, over many samples.

The fix is to judge each reward against what we expected. Subtract a **baseline** $\\symb$, any number that does not depend on which answer was just sampled, and the average gradient does not change at all.`);
    p.math({
      label: 'A baseline costs nothing on average',
      tex: String.raw`\begin{aligned} \mathbb{E}[\symg] &= \textstyle\sum_y \sympi(y)\symg(y) \\ &= \textstyle\sum_y \nabla_\theta\sympi(y) \\ &= \nabla_\theta 1 = 0 \\[4pt] \nabla_\theta J &= \mathbb{E}\big[(\symR - \symb)\symg\big] \\ &= \mathbb{E}\big[\symA\,\symg\big] \end{aligned}`,
      codeTitle: 'baseline.py',
      code: `
        pi = softmax(theta)
        G = np.eye(4) - pi     # row y: grad log pi(y)
        pi @ G                 # [0, 0, 0, 0]

        A = R[y] - b           # b: from before this y
        theta += lr * A * G[y]
        b = 0.9 * b + 0.1 * R[y]    # running mean
      `,
      terms: [
        [String.raw`\mathbb{E}[\symg] = 0`, 'the average push, over answers sampled from the policy, is zero: by the trick run backwards it is the gradient of the total probability, and the total is always 1'],
        [String.raw`\symb`, 'the baseline: a running average of past rewards, the average reward of other answers to the same prompt, or a network\'s prediction'],
        [String.raw`\symA = \symR - \symb`, 'the **advantage**: how much better than expected this answer turned out'],
        [String.raw`\mathbb{E}[\symA\,\symg]`, 'the same gradient as before (with $y$ sampled from the policy, as always), and far less noise when $\\symb$ is close to a typical reward'],
      ],
      explain: `Probabilities always add up to 1, so if some answers become more likely, others must become less likely: the pushes from $\\nabla\\log\\pi$ cancel on average. Multiplying them all by the same constant $\\symb$ keeps them cancelling, so subtracting $\\symb\\,\\nabla\\log\\pi$ removes nothing from the average gradient. It removes a lot of noise, though. With a baseline, an answer better than usual is pushed up and one worse than usual is pushed *down*, so a wrong answer with reward 0 finally teaches something. The best constant baseline is close to the average reward, which is why the running mean, the group mean of GRPO and the learned value function of PPO are all estimates of it.`,
    });

    p.figure({
      title: 'Eight runs, with and without a baseline',
      codeTitle: 'variance.py',
      code: `
        c = {{c:0}}            # added to every reward
        use_baseline = {{bl:False}}
        for seed in range(8):
            theta, b = np.log(pi0), None
            for step in range(150):
                pi = softmax(theta)
                y = np.random.choice(4, p=pi)
                r = R[y] + c                         #@r
                if b is None: b = r                  #@b
                A = r - b if use_baseline else r     #@A
                grad_logp = np.eye(4)[y] - pi
                theta += 0.3 * A * grad_logp         #@upd
                b = 0.9 * b + 0.1 * r                #@b
        # spread at step 150: {{spread:…}}
      `,
      setup(f) {
        let c0 = 0;
        let bl = false;
        let seeds = VAR_SEEDS.slice();
        let data: Float64Array[] = [];
        let reveal = 1;
        const compute = () => {
          data = curves(PI0, { lr: VAR_LR, baseline: bl, offset: c0 }, seeds, VAR_STEPS);
          const last = data.map((d) => d[VAR_STEPS]!);
          const m = last.reduce((a, v) => a + v, 0) / last.length;
          const sd = Math.sqrt(last.reduce((a, v) => a + (v - m) ** 2, 0) / last.length);
          f.code.set('spread', fmt(sd, 2));
          spreadRo.set(fmt(sd, 2));
          noiseRo.set(fmt(gradNoise(PI0, REWARD, c0, bl ? expectedReward(PI0) + c0 : 0), 3));
          reveal = 0;
          anim.start();
        };
        const cv = f.canvas(640, 470, (c, w, h) => {
          const { X, Y } = chartFrame(c, [4, 4, w - 8, h - 4], [0, VAR_STEPS, 0, 1], { xTicks: [0, 50, 100, 150], yTicks: [0, 0.25, 0.5, 0.75, 1], xLabel: 'step', title: `E[R] of each run's policy, ${bl ? 'with a baseline' : 'no baseline'}`, titleColor: color(bl ? 'green' : 'gold') });
          const n = Math.max(2, Math.round(reveal * VAR_STEPS) + 1);
          const xs = Array.from({ length: VAR_STEPS + 1 }, (_, i) => X(i));
          data.forEach((d) => polyline(c, xs, Array.from(d, (v) => Y(v)), n, withAlpha(color(bl ? 'green' : 'gold'), 0.8), 1.6));
        });
        cv.canvas.classList.add('scroll-ok');
        const anim = f.loop((dt) => {
          reveal = Math.min(1, reveal + dt * 1.4);
          cv.redraw();
          if (reveal >= 1) return false;
        });
        f.segmented({
          label: 'baseline',
          options: [
            { value: 'False', label: 'none' },
            { value: 'True', label: 'running mean' },
          ],
          value: 'False',
          slot: 'bl',
          onChange: (v) => {
            bl = v === 'True';
            f.code.highlight(bl ? ['b', 'A'] : 'A');
            compute();
          },
        });
        f.slider({ label: 'offset c', min: 0, max: 3, step: 0.25, value: 0, slot: 'c', onInput: (v) => {
          c0 = v;
          f.code.highlight('r');
          compute();
        } });
        f.button('New seeds', () => {
          seeds = seeds.map((s) => s + 8);
          compute();
        }, { icon: 'shuffle' });
        const spreadRo = f.readout('spread at step 150');
        const noiseRo = f.readout('gradient noise at the start');
        compute();
      },
      caption: `Eight REINFORCE runs with different random seeds; each line is the true expected reward of one run's policy. Start with no baseline and $c = 0$: the runs already disagree a little. Now slide the **reward offset** $c$, which adds the same constant to every reward. The true gradient does not change at all, yet without a baseline the runs fan out, and some lock onto a worse answer for good: whatever they happened to sample got pushed up, became likelier, got sampled again. Switch on the **running-mean baseline** and the spread collapses, whatever $c$ is. "Gradient noise" is the exact variance of the one-sample gradient estimate at the starting policy (with the baseline set to the average reward), and it grows with $c$ like $c^2$ when there is no baseline.`,
    });

    // ------------------------------------------------------------ credit
    p.h2('Credit assignment over tokens', 'credit');
    p.prose(`
So far each answer was a single action. A real response is hundreds of tokens, and the reward arrives once, at the end. Which tokens deserve the credit for a good grade?

Put the sum of per-token log-probabilities into the policy gradient and the answer comes out: all of them, equally.`);
    p.math({
      label: 'The policy gradient for a sequence',
      tex: String.raw`\begin{aligned} \nabla_\theta J &= \mathbb{E}\big[\textstyle\sum_{t} \symA_t\,\nabla_\theta\log\sympi(y_t \mid x, y_{<t})\big] \\ \symA_t &= \symR(y) - \symb \end{aligned}`,
      codeTitle: 'sequence_pg.py',
      code: `
        # logp_t[i, t] = log pi(y_t | x, y_<t)
        logp_t = token_logprobs(model, x, y)   # (N, T)
        R = grade(x, y)           # (N,) one per answer
        A = R - R.mean()          # (N,) one per answer
        A_t = A[:, None] * mask   # same A at every token
        loss = -(A_t * logp_t).sum(-1).mean()
      `,
      terms: [
        [String.raw`\textstyle\sum_{t}`, 'one term for every token $t = 1, \\dots, T$ of the response'],
        [String.raw`\nabla_\theta\log\sympi(y_t \mid x, y_{<t})`, 'the direction that makes this token more likely in this context'],
        [String.raw`\symA_t`, 'the advantage assigned to token $t$'],
        [String.raw`\symA_t = \symR(y) - \symb`, 'with one reward at the end, every token of a response gets the same advantage'],
      ],
      explain: `Every token in a good answer is pushed up, including the filler ("Let me think."), and every token in a bad answer is pushed down, including the parts that were fine. That sounds hopeless, but it averages out. A token that shows up as often in good answers as in bad ones is pushed up and down equally and nets nothing. A token that tends to show up in good answers nets a positive push. Credit assignment emerges statistically, at the price of more noise the longer the answers get.`,
    });

    p.figure({
      title: 'Who gets the credit?',
      codeTitle: 'credit.py',
      code: `
        N = {{N:16}}
        ys = [sample_response() for _ in range(N)]  #@sample
        R = np.array([grade(y) for y in ys])        #@R
        A = R - R.mean()          # one per answer  #@A

        push = defaultdict(list)
        for y, a in zip(ys, A):
            for chunk in y:       # all share A     #@share
                push[chunk].append(a)               #@share
        avg = {k: np.mean(v) for k, v in push.items()}   #@avg
      `,
      setup(f) {
        let N = 16;
        let seed = 5;
        let rs: Response[] = [];
        let st = creditStats([]);
        const draw = () => {
          const rng = new Rng(seed);
          rs = Array.from({ length: N }, () => sampleResponse(rng));
          st = creditStats(rs);
          meanRo.set(fmt(rs.reduce((a, r) => a + r.R, 0) / N, 2));
          cv.redraw();
        };
        const tint = (a: number) => (a >= 0 ? withAlpha(color('green'), 0.12 + 0.5 * Math.min(1, a)) : withAlpha(color('red'), 0.12 + 0.5 * Math.min(1, -a)));
        const cv = f.canvas(600, 700, (c, w, h) => {
          const rows = Math.min(8, rs.length);
          const fs = w < 420 ? 10.5 : 11.5;
          const top = 26;
          const rh = Math.min(26, (h * 0.5 - top) / 8);
          txt(c, `${rows < rs.length ? `${rows} of ` : ''}${rs.length} answers, tinted by advantage A`, 8, 11, { size: 11.5, weight: 600, color: color('--ink-2') });
          for (let i = 0; i < rows; i++) {
            const r = rs[i]!;
            const a = st.A[i]!;
            let x = 8;
            const y = top + i * rh;
            r.parts.forEach((k) => {
              const s = CHUNKS[k]!;
              const tw = textW(c, s, fs, true) + 10;
              rrect(c, x, y + 2, tw, rh - 5, 5, tint(a), withAlpha(color(a >= 0 ? 'green' : 'red'), 0.6), 1);
              txt(c, s, x + 5, y + rh / 2, { size: fs, mono: true });
              x += tw + 4;
            });
            txt(c, `A ${a >= 0 ? '+' : ''}${fmt(a, 2)}`, w - 8, y + rh / 2, { size: fs, mono: true, align: 'right', color: color(a >= 0 ? 'green' : 'red') });
          }
          // per-chunk average advantage
          const by = h * 0.56;
          txt(c, 'average advantage of each chunk (ticks: many samples)', 8, by, { size: 11.5, weight: 600, color: color('--ink-2') });
          const labW = Math.max(...CHUNKS.map((s) => textW(c, s, fs, true))) + 14;
          const valW = 46;
          const x0 = labW + (w - labW - valW) / 2;
          const half = (w - labW - valW) / 2 - 6;
          const bh = (h - by - 24) / CHUNKS.length;
          seg(c, x0 + 0.5, by + 14, x0 + 0.5, h - 6, color('--axis'), 1);
          CHUNKS.forEach((s, k) => {
            const y = by + 18 + k * bh;
            txt(c, s, 8, y + bh / 2, { size: fs, mono: true, color: color('--ink') });
            const v = st.avg[k];
            if (v !== null && v !== undefined) {
              const ww = Math.max(-1, Math.min(1, v / 0.6)) * half;
              rrect(c, ww >= 0 ? x0 : x0 + ww, y + 4, Math.abs(ww), bh - 8, 3, tint(v * 1.6), color(v >= 0 ? 'green' : 'red'), 1);
              txt(c, `${v >= 0 ? '+' : ''}${fmt(v, 2)}`, w - 8, y + bh / 2, { size: 10.5, mono: true, align: 'right', color: color(v >= 0 ? 'green' : 'red') });
            } else txt(c, 'unseen', w - 8, y + bh / 2, { size: 10.5, align: 'right', color: color('--ink-3') });
            const tx = x0 + (CREDIT_LIMIT[k]! / 0.6) * half;
            seg(c, tx, y + 1, tx, y + bh - 1, color('--ink'), 2.2);
          });
        });
        cv.canvas.classList.add('scroll-ok');
        f.slider({
          label: 'answers N',
          min: 2,
          max: 9,
          step: 1,
          value: 4,
          map: (r) => 2 ** r,
          format: (v) => String(v),
          slot: 'N',
          onInput: (v) => {
            N = v;
            f.code.highlight(['sample', 'A', 'avg']);
            draw();
          },
        });
        f.button('Resample', () => {
          seed++;
          f.code.highlight(['sample', 'R', 'A', 'share']);
          draw();
        }, { primary: true, icon: 'shuffle' });
        const meanRo = f.readout('mean R', { sym: 'R' });
        draw();
      },
      caption: `Each row is one sampled answer to *${PROMPT}*: an opener, a piece of work, and a verdict. Only the verdict is graded (1 for "Not prime."). Every chunk in a row is tinted by that answer's advantage: green above the batch average, red below. The bars underneath average each chunk's advantage over every answer it appears in, which is the net push that chunk receives. With a handful of samples, the openers collect credit or blame by pure luck. Slide **N** up: the openers settle on zero (they never mattered), "91 = 7×13." earns credit because it usually leads to the right verdict, and "91 is odd." earns blame. The thick ticks show where each bar settles with unlimited samples.`,
    });
    p.prose(`
### Doing better than equal shares

- **Reward to go.** When rewards arrive along the way (the KL penalty in the next section is charged per token), a token should only be credited with rewards that come *after* it, because an action cannot change the past. Its advantage then uses the sum of the rewards from position $t$ onward.
- **A value function.** Train a second network $V(s_t)$ to predict the final reward from a partial response, and credit each token with the change in prediction it caused, roughly $V(s_{t+1}) - V(s_t)$. In the toy, a value function would see the expected grade jump from 0.54 to 0.90 at "91 = 7×13." and hand that chunk most of the credit, while the opener changes nothing. This is the *critic* of PPO's actor-critic setup, with GAE to blend short and long views of the future: the subject of [the next chapter](#/rlhf).
- **Many answers per prompt.** GRPO keeps one advantage per answer, but samples a group of answers to each prompt and uses the group's mean as the baseline, so the signal comes from differences between answers to the *same* question ([Chapter 17](#/grpo)).
- **Rewards for steps.** Process reward models grade each step of a solution instead of only the final answer ([Chapter 18](#/reasoning)).`);

    // ------------------------------------------------------------ KL
    p.h2('Staying close: the KL penalty', 'kl');
    p.prose(`
Optimize a reward hard enough and the policy finds whatever the reward likes most, which is not always what we meant. A learned reward model is a network trained on a finite set of human judgments; it has blind spots, and RL is very good at finding them. This is **reward hacking** (or over-optimization), and it gets its own figure in [the next chapter](#/rlhf). Even with a perfect grader, a policy that drifts far from where it started can lose the fluent, sensible language that pretraining gave it.

The standard fix is a leash. Keep a frozen copy of the model you started from, the **reference policy** $\\sympiref$ (usually the fine-tuned model from [Chapter 13](#/finetuning)), and charge the policy for moving away from it. The distance used is the **KL divergence**.`);
    p.math({
      label: 'KL divergence, and the regularized objective',
      tex: String.raw`\begin{aligned} \mathrm{KL}(\sympi \,\|\, \sympiref) &= \textstyle\sum_y \sympi(y) \log\frac{\sympi(y)}{\sympiref(y)} \\ &= \mathbb{E}\Big[\log\frac{\sympi(y)}{\sympiref(y)}\Big] \\[4pt] J_{\symbeta}(\symtheta) &= \mathbb{E}[\symR] - \symbeta\,\mathrm{KL}(\sympi \,\|\, \sympiref) \end{aligned}`,
      codeTitle: 'kl_penalty.py',
      code: `
        # exact, for a small set of answers:
        kl = np.sum(pi * (np.log(pi) - np.log(pi_ref)))

        # from samples, as in RLHF: summed over tokens
        kl_y = (logp_t - ref_logp_t).sum(-1)   # (N,)
        r = R - beta * kl_y       # the reward PG sees
        A = r - r.mean()
      `,
      terms: [
        [String.raw`\log\frac{\sympi(y)}{\sympiref(y)}`, 'for one answer: how much more likely the policy finds it than the reference does, in log space. It equals $\\log\\pi(y) - \\log\\pi_{\\text{ref}}(y)$'],
        [String.raw`\mathbb{E}_{y\sim\sympi}[\,\cdot\,]`, 'averaged over the policy\'s own samples: that average is the KL divergence'],
        [String.raw`\mathrm{KL}`, 'zero when the two policies agree on everything, positive otherwise. It is not symmetric: $\\mathrm{KL}(p\\,\\|\\,q) \\neq \\mathrm{KL}(q\\,\\|\\,p)$ in general'],
        [String.raw`\symbeta`, 'the strength of the leash: how many reward points one unit of KL costs'],
      ],
      explain: `The KL divergence is the average, over answers the policy actually writes, of how much more probable it makes them than the reference model would. If the policy starts writing answers the reference finds absurd, those log-ratios get large and the penalty bites. In practice it is estimated from the same samples as the reward, token by token: add up $\\log\\pi - \\log\\pi_{\\text{ref}}$ over an answer's tokens and subtract $\\symbeta$ times that from its reward. REINFORCE needs no change at all: it just sees a reward that includes the penalty.`,
    });
    p.prose(`
For a bandit the regularized objective can be solved exactly. The best policy reweights the reference by the exponentiated reward, $\\pi^*(y) \\propto \\sympiref(y)\\, e^{\\symR(y)/\\symbeta}$: a small $\\symbeta$ lets the reward dominate, a large one keeps the reference. [Chapter 16](#/dpo) turns this formula around to derive DPO.`);

    p.figure({
      title: 'The KL leash',
      codeTitle: 'kl_leash.py',
      code: `
        R = np.array([0, 0, 0.5, 1.0, 1.2])   # RM scores
        beta = {{beta:0.2}}
        theta = np.log(pi_ref)    # start at the reference
        for step in range(4000):
            pi = softmax(theta)
            ys = np.random.choice(5, size=16, p=pi)
            kl_y = np.log(pi[ys] / pi_ref[ys])        #@kl
            r = R[ys] - beta * kl_y                   #@kl
            if step == 0: b = r.mean()
            A = r - b                                 #@A
            G = np.eye(5)[ys] - pi                    #@upd
            theta += 0.5 * (A[:, None] * G).mean(0)   #@upd
            b = 0.9 * b + 0.1 * r.mean()
        # step {{step:0}}, KL = {{kl:0}}
        # RM score = {{rm:…}}, true = {{tq:…}}
      `,
      setup(f) {
        let beta = 0.2;
        let pg = new Pg(REF_KL, { lr: 0.5, R: RM_KL, beta, ref: REF_KL, baseline: true, batch: 16 }, 9);
        let since = 0;
        const betas = Array.from({ length: 81 }, (_, i) => 10 ** (-2 + (i / 80) * Math.log10(300)));
        const sweep = betas.map((b) => {
          const o = optimalPolicy(REF_KL, RM_KL, b);
          return { rm: dot(o, RM_KL), tq: dot(o, TRUE_KL) };
        });
        const cv = f.canvas(640, 680, (c, w, h) => {
          const pi = pg.pi;
          const opt = optimalPolicy(REF_KL, RM_KL, beta);
          answerBars(c, [6, 4, w - 12, h * 0.56], {
            labels: ANSWERS_KL,
            pi,
            ghost: REF_KL,
            ghostColor: 'orange',
            tick: opt,
            sub: RM_KL.map((v) => `RM ${v}`),
            show: (i) => pct(pi[i]!),
            title: 'π (purple), π_ref (dashed), optimum π* (ticks)',
          });
          const { X, Y } = chartFrame(c, [4, h * 0.59, w - 8, h * 0.41], [0.01, 3, 0, 1.25], { logX: true, xTicks: [0.01, 0.1, 1, 3], yTicks: [0, 0.5, 1], xLabel: 'β', xFmt: (v) => String(v), title: 'optimum π* as β varies' });
          const xs = betas.map((b) => X(b));
          polyline(c, xs, sweep.map((s) => Y(s.rm)), xs.length, color('gold'), 2);
          polyline(c, xs, sweep.map((s) => Y(s.tq)), xs.length, color('--ink'), 2, [5, 3]);
          seg(c, X(beta), Y(0), X(beta), Y(1.25), withAlpha(color('slate'), 0.9), 1.5);
          c.beginPath();
          c.arc(X(beta), Y(dot(pi, RM_KL)), 4, 0, Math.PI * 2);
          c.fillStyle = color('gold');
          c.fill();
          c.beginPath();
          c.arc(X(beta), Y(dot(pi, TRUE_KL)), 4, 0, Math.PI * 2);
          c.fillStyle = color('--ink');
          c.fill();
          txt(c, 'RM score', X(0.012), Y(1.2) + 12, { size: 11, color: color('gold'), halo: true });
          txt(c, 'true quality', X(0.012), Y(0.04) - 12, { size: 11, color: color('--ink'), halo: true });
        });
        cv.canvas.classList.add('scroll-ok');
        const klRo = f.readout('KL(π‖π_ref)');
        const rmRo = f.readout('RM score', { sym: 'R' });
        const tqRo = f.readout('true quality');
        const sync = () => {
          const pi = pg.pi;
          const k = Math.max(0, kl(pi, REF_KL));
          const rm = dot(pi, RM_KL);
          const tq = dot(pi, TRUE_KL);
          klRo.set(fmt(k, 2));
          rmRo.set(fmt(rm, 2));
          tqRo.set(fmt(tq, 2));
          f.code.setMany({ step: pg.t, kl: fmt(k, 2), rm: fmt(rm, 2), tq: fmt(tq, 2) });
        };
        let phase = 0;
        const loop = f.loop(() => {
          for (let i = 0; i < 20; i++) pg.step();
          since += 20;
          f.code.highlight(['kl', 'A', 'upd'][phase++ % 3]!);
          sync();
          cv.redraw();
          if (since >= 4000) {
            stop();
            return false;
          }
        });
        const stop = () => {
          loop.stop();
          btn.textContent = 'Train';
          f.code.highlight(null);
        };
        const start = () => {
          since = 0;
          loop.start();
          btn.textContent = 'Pause';
        };
        f.slider({
          label: 'β',
          sym: 'beta',
          min: -2,
          max: Math.log10(3),
          step: 0.01,
          value: Math.log10(0.2),
          map: (r) => 10 ** r,
          format: (v) => fmt(v, 2),
          slot: 'beta',
          onInput: (v) => {
            beta = v;
            pg.opts.beta = v;
            start();
            cv.redraw();
          },
        });
        const btn = f.button('Train', () => (loop.running() ? stop() : start()), { primary: true });
        f.button('Reset', () => {
          stop();
          pg = new Pg(REF_KL, { lr: 0.5, R: RM_KL, beta, ref: REF_KL, baseline: true, batch: 16 }, 9);
          sync();
          cv.redraw();
        }, { icon: 'reset' });
        sync();
      },
      caption: `Five answers now, and a learned reward model with a blind spot: it scores the shouted "No!! 7×13!!" at 1.2, above the genuinely best answer, although its true quality is 0 and the reference model almost never writes it (3%). Dashed orange bars: the reference policy. Purple: the policy, trained live by REINFORCE on the penalized reward. Ticks: the exact optimum $\\pi^*$. Press **Train**. Then drag $\\symbeta$ down toward 0.01: the policy abandons everything for the hack, the reward model's score climbs, and the true quality collapses. Push $\\symbeta$ up to 3 and the policy barely leaves the reference. Somewhere around 0.2 it gets the most true quality. The chart sweeps $\\symbeta$ for the exact optimum; the dots are the live policy.`,
    });

    // ------------------------------------------------------------ entropy
    p.h2('Exploration and entropy', 'entropy');
    p.prose(`
There is a quieter failure too. REINFORCE can only reinforce answers the policy actually samples. A great but rare answer is hardly ever tried, so it hardly ever gets credit, while a decent common answer gets pushed up and squeezes the rare one further. The policy can lock onto "good enough" before it ever finds "best". Its probabilities collapse onto one answer, and its diversity collapses with them.

The natural measure of that diversity is **entropy**: the average surprise of the policy's own samples.`);
    p.math({
      label: 'Entropy, and an entropy bonus',
      tex: String.raw`\begin{aligned} H(\sympi) &= -\sum_y \sympi(y)\log\sympi(y) \\ &= \mathbb{E}_{y\sim\sympi}\big[-\log\sympi(y)\big] \\[4pt] J_\tau(\symtheta) &= \mathbb{E}\big[\symR(y)\big] + \tau\, H(\sympi) \end{aligned}`,
      codeTitle: 'entropy.py',
      code: `
        H = -np.sum(pi * np.log(pi))
        # 1.39 for 4 equally likely answers, 0 if certain

        # in a language model: at every position
        H_t = -(probs * logits.log_softmax(-1)).sum(-1)
        H_mean = (H_t * mask).sum() / mask.sum()
        loss = pg_loss - tau * H_mean
      `,
      terms: [
        [String.raw`-\log\sympi(y)`, 'the surprise of seeing answer $y$: 0 for a certain answer, large for a rare one'],
        [String.raw`H(\sympi)`, 'its average over the policy\'s samples: 0 when the policy always writes the same thing, $\\log K$ (1.39 for four answers) when it spreads evenly over $K$'],
        [String.raw`\tau`, 'the size of the entropy bonus: a small reward for staying uncertain'],
      ],
      explain: `Adding a little entropy to the objective pays the policy to keep some probability on the alternatives, so it keeps sampling them long enough to find out whether one is better. Too much, and the policy stays random forever and gives up reward. Entropy bonuses were standard in classic deep RL (A3C, 2016), and PPO's original objective includes one. In language-model training, entropy is watched closely: a fast collapse is a warning sign, and [Chapter 17](#/grpo) meets several fixes for it.`,
    });

    p.figure({
      title: 'Exploration: collapse, and an entropy bonus',
      codeTitle: 'explore.py',
      code: `
        tau = {{tau:0}}            # entropy bonus
        for seed in range(12):
            # the best answer starts at 5%
            theta = np.log([0.30, 0.10, 0.55, 0.05])
            b = None
            for step in range(300):
                pi = softmax(theta)
                y = np.random.choice(4, p=pi)
                if b is None: b = R[y]
                A = R[y] - b                         #@A
                H = -np.sum(pi * np.log(pi))         #@H
                grad_H = -pi * (np.log(pi) + H)      #@H
                grad_logp = np.eye(4)[y] - pi        #@upd
                theta += 2.0 * (A * grad_logp + tau * grad_H)  #@upd
                b = 0.9 * b + 0.1 * R[y]
        # found "No, 7×13.": {{found:…}} of 12
      `,
      setup(f) {
        let tau = 0;
        let seeds = EXPLORE_SEEDS.slice();
        let tr: number[][][] = [];
        let reveal = 1;
        const compute = () => {
          tr = trajectories(PI0_EXPLORE, { lr: EXPLORE_LR, baseline: true, ent: tau }, seeds, EXPLORE_STEPS);
          const fin = tr.map((t) => t[t.length - 1]!);
          const found = fin.filter((p) => p[3]! > 0.5).length;
          f.code.set('found', found);
          foundRo.set(`${found} of 12`);
          erRo.set(fmt(fin.reduce((a, p) => a + expectedReward(p), 0) / fin.length, 2));
          reveal = 0;
          anim.start();
        };
        const cv = f.canvas(640, 600, (c, w, h) => {
          const n = Math.max(2, Math.round(reveal * EXPLORE_STEPS) + 1);
          const top = chartFrame(c, [4, 2, w - 8, h * 0.52], [0, EXPLORE_STEPS, 0, 1], { xTicks: [0, 100, 200, 300], yTicks: [0, 0.5, 1], title: 'π("No, 7×13.") in each run' });
          const xs = Array.from({ length: EXPLORE_STEPS + 1 }, (_, i) => top.X(i));
          tr.forEach((t) => {
            const ok = t[t.length - 1]![3]! > 0.5;
            polyline(c, xs, t.map((p) => top.Y(p[3]!)), n, withAlpha(color(ok ? 'purple' : 'red'), 0.75), 1.5);
          });
          const bot = chartFrame(c, [4, h * 0.54, w - 8, h * 0.46], [0, EXPLORE_STEPS, 0, 1.4], { xTicks: [0, 100, 200, 300], yTicks: [0, 0.5, 1], xLabel: 'step', title: 'entropy H(π) of each run' });
          tr.forEach((t) => {
            const ok = t[t.length - 1]![3]! > 0.5;
            polyline(c, xs, t.map((p) => bot.Y(entropy(p))), n, withAlpha(color(ok ? 'slate' : 'red'), 0.55), 1.2);
          });
        });
        cv.canvas.classList.add('scroll-ok');
        const anim = f.loop((dt) => {
          reveal = Math.min(1, reveal + dt * 1.2);
          cv.redraw();
          if (reveal >= 1) return false;
        });
        f.slider({ label: 'entropy bonus τ', min: 0, max: 0.5, step: 0.01, value: 0, slot: 'tau', onInput: (v) => {
          tau = v;
          f.code.highlight(v > 0 ? ['H', 'upd'] : 'upd');
          compute();
        } });
        f.button('New seeds', () => {
          seeds = seeds.map((s) => s + 12);
          compute();
        }, { icon: 'shuffle' });
        const foundRo = f.readout('found the best answer');
        const erRo = f.readout('final E[R]', { sym: 'R' });
        compute();
      },
      caption: `Twelve REINFORCE runs (with a baseline) from a base model that rarely explains itself: the best answer, "No, 7×13.", starts at 5%, and "No." (worth 0.5) at 55%. Top: each run's probability of the best answer; red runs end up stuck without it. Bottom: each run's entropy. With $\\tau = 0$ the entropy crashes within a few dozen steps and about half the runs lock onto "No." for good: once the best answer's probability is near zero, it is never sampled again, so it can never earn credit. Raise $\\tau$ a little (0.05 to 0.1) and nearly every run finds it. Raise it a lot (0.4) and the policy never fully commits, giving up some reward.`,
    });

    // ------------------------------------------------------------ road ahead
    p.h2('From REINFORCE to modern post-training', 'road-ahead');
    p.prose(`
Everything in the next three chapters is this chapter's recipe with better parts. One limitation of REINFORCE deserves a name first: the policy gradient assumes the answers were sampled from the *current* policy, so after a single update the batch is stale. Generating answers is the expensive part of RL for language models, so PPO and GRPO reuse each batch for several steps, correcting for the mismatch with an importance ratio $\\pi_\\theta / \\pi_{\\text{old}}$ and clipping it so no step moves too far.`);
    p.table(
      ['', 'Where the reward comes from', 'Baseline or advantage', 'How it stays close'],
      [
        ['REINFORCE (this chapter)', 'any score', 'running mean', 'KL penalty in the reward'],
        ['[RLHF with PPO](#/rlhf)', 'a reward model trained on human preference pairs', 'a learned value function, with GAE', 'per-token KL penalty, plus a clipped ratio'],
        ['[DPO](#/dpo)', 'the preference pairs directly', 'none: there is no sampling loop', 'the KL-regularized optimum is built into the loss'],
        ['[GRPO](#/grpo)', 'a program that checks the answer', 'mean and spread of a group of answers to the same prompt', 'a clipped ratio, plus a KL term in the loss'],
      ],
    );
    p.callout('history', `REINFORCE is from Ronald Williams (1992), whose paper already included the reinforcement baseline. The general policy gradient theorem, for policies computed by function approximators, is from Sutton and colleagues (2000). Text generation met REINFORCE in sequence-level training of RNNs (Ranzato et al., 2016) and in self-critical sequence training for image captioning (Rennie et al., 2017), which used the reward of the model's own greedy caption as the baseline: the captioning models of [CS231n's RNN chapter](#/rnn), trained directly on their evaluation metric. RL from a pretrained language model with a KL penalty to it appears in Ziegler et al. (2019) and became the recipe of InstructGPT (2022). Kool et al. (2019) proposed using the other samples of a batch as the baseline (leave-one-out), an idea Ahmadian et al. (2024) revived for RLHF as RLOO.`, 'Where these ideas come from');
    p.callout('idea', `A language model is a policy: the state is the text so far, the action is the next token, and a reward grades the finished answer. RL maximizes the **expected reward**, an average we can only estimate by sampling. The **log-derivative trick** turns its gradient into another average, $\\mathbb{E}[\\symR\\,\\nabla\\log\\pi]$, which for a softmax is "onehot minus probabilities", a cross-entropy step on the model's own sample scaled by reward: that is **REINFORCE**. It is unbiased but noisy; subtracting a **baseline** gives the **advantage** $\\symA = \\symR - \\symb$ and much less noise. With one reward per answer, every token shares the same advantage and credit emerges statistically. A **KL penalty** to a frozen reference keeps the policy from hacking the reward or forgetting good language, and **entropy** tracks whether it is still exploring.`, 'Takeaways');

    // ------------------------------------------------------------ exercises
    p.h2('Build it yourself', 'exercises');
    p.prose(`
Use the four-answer bandit from this chapter: \`R = [0, 0, 0.5, 1]\` and \`pi0 = [0.4, 0.1, 0.3, 0.2]\`, with one logit per answer. Seed everything so your plots are repeatable.

### 1. Warm-up: the gradient of log-softmax (10 minutes)

Write \`grad_log_softmax(theta, y)\` and check it against centered finite differences on random \`theta\` for every \`y\`. Then compute \`pi @ (np.eye(4) - pi)\`, the probability-weighted average of the four gradients, and confirm it is zero to machine precision. **Success:** relative error below $10^{-6}$, and a zero vector you can explain in one sentence.

### 2. REINFORCE, with and without a baseline

Implement the training loop from the REINFORCE figure. For each of $c \\in \\{0, 1, 3\\}$ added to every reward, run 50 seeds for 150 steps without a baseline and with a running-mean baseline, and plot the mean and the 10th and 90th percentiles of the true expected reward over time. **Success:** with the baseline the three values of $c$ give nearly identical curves; without it the band widens as $c$ grows, and some runs lock onto a worse answer. Count them.

### 3. Measure the variance

At the starting policy, draw 100,000 one-sample gradient estimates for baselines $b$ from $-1$ to $2$ and plot their total variance against $b$. Find the minimizing $b$ and compare it with the average reward, 0.35. **Success:** a U-shaped curve with its minimum close to (but not exactly at) 0.35, plus a sentence on why the best $b$ weights each reward by how large its gradient is.

### 4. The KL leash and its optimum

Add $-\\beta(\\log\\pi(y) - \\log\\pi_{\\text{ref}}(y))$ to the reward, using the five answers and the reward model of the KL figure, and train with 16 samples per step. For $\\beta \\in \\{0.05, 0.2, 1\\}$ compare the trained policy with the closed form $\\pi_{\\text{ref}}\\, e^{R/\\beta}$, normalized. **Success:** they agree to within 0.02 for every answer, and you can say which $\\beta$ gives the best *true* quality.

### 5. Project: REINFORCE on sequences

Build a tiny language model: a table of logits indexed by the previous character, over an alphabet of 8 characters plus an end token, writing strings of up to 10 characters. Choose a checkable reward, for example "the digits in the string sum to 10" or "the string is a palindrome". Train with the sequence policy gradient: a group of 16 samples per update, the group mean as baseline, and a KL penalty to the initial model. Plot average reward, KL and per-position entropy over training. **Success:** reward climbs from near 0 to above 0.8, KL stays bounded, and you can show the effect of removing the baseline and of setting the KL penalty to 0. For extra credit, compare equal credit for every token with reward to go, using a per-token KL penalty.`);
  },
};

export default chapter;

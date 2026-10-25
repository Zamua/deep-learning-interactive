import type { ChapterDef } from './index';
import { CHAPTERS, COURSES } from './index';
import { DECADE_SYMBOLS } from '../lib/decade-symbols';
import { figCarried, figFeedback, figScale, figSoftmax, figTimeline } from '../lib/decade-figs';
import { attentionArt } from '../lib/course-art';

const PART_INTRO: Record<string, string> = {
  'Start here': 'This chapter: the decade at a glance, and how the course fits together.',
  'Attention and transformers': 'The core, best read in order. From the one-vector bottleneck of 2014 translation models to attention as a soft lookup, then the full Transformer block, how text becomes tokens, and next-token pretraining. Nearly everything after leans on chapters 2 and 4.',
  Scale: 'What it takes to make the block big and train it well: the laws that predict loss from compute, what changed inside the block since 2017, the optimizers, training across many GPUs, and mixture-of-experts layers.',
  'Seeing and generating': 'The same ideas for images: vision transformers, learning without labels with contrastive losses and CLIP, and diffusion models that generate pictures from noise.',
  'Post-training': 'Turning a text predictor into an assistant and then a reasoner: fine-tuning and LoRA, the policy gradient, RLHF with PPO, DPO, verifiable rewards with GRPO, and test-time compute. Best read in order.',
  'Serving and understanding': 'Running a trained model fast (KV caches, batching, quantization, speculative decoding) and looking inside it (induction heads, superposition, sparse autoencoders).',
};

const chapter: ChapterDef = {
  symbols: DECADE_SYMBOLS,

  render(p) {
    p.prose(`
In the winter of 2016, CS231n taught the state of the art. Images went through convolutional networks and sentences through recurrent ones. Every task got its own architecture, its own labeled dataset, and a model trained from scratch. The best ImageNet models had tens of millions of parameters and trained on a few GPUs.

Ten years later nearly every part of that paragraph has changed. One architecture, the **transformer**, reads text, images, audio and code. Models learn from trillions of words before they see a single task, and the largest ones have hundreds of billions of parameters. And the most capable models are finished not with more labels but with **feedback**: people comparing answers, and programs checking them.

Here is the surprise, and the reason this course is a continuation rather than a fresh start: the code inside is mostly what you already know. A 2026 language model is trained by backpropagation with a descendant of Adam, on a softmax cross-entropy loss, with residual connections and normalization in every block. The genuinely new pieces are few, and each fits in your head.

This chapter is the map. It walks the decade year by year, names the three shifts that matter, shows what carried over from CS231n, and lays out the course ahead.`);
    p.table(
      ['', 'CS231n, 2016', 'DL26, 2026'],
      [
        ['Architecture', 'ConvNets for images, RNNs and LSTMs for text', 'one transformer for text, images, audio and code'],
        ['Training data', 'labeled datasets: ImageNet\'s 1.2 million photos', 'raw text and captioned images: trillions of tokens'],
        ['Learning signal', 'a human label per example', 'the next token, then human preferences, then programs that check answers'],
        ['Model size', 'tens of millions of parameters', 'billions to hundreds of billions'],
        ['Training hardware', 'a few GPUs for days', 'thousands of GPUs for weeks'],
        ['Using a model', 'one network per task', 'one model, asked in words to do any task'],
      ],
      { caption: 'The same field, ten years apart. Each row is the subject of several chapters of this course.' },
    );

    /* ---------------------------------------------------------------- timeline */
    p.append(attentionArt(p));

    p.h2('The decade, year by year', 'timeline');
    p.prose(`
Start with the whole picture. Each dot below is one milestone: a paper, a model or a release that changed how the field works. They fall into five threads, and the threads are the five parts of this course. Three of them carry the big shifts this chapter is about: **attention** (one architecture for everything), **scale** (size as a research direction) and **feedback** (learning from preferences and checkers). The other two, images and serving, are where those shifts spread.`);
    figTimeline(p);
    p.prose(`
Two patterns are worth noticing before going thread by thread. First, the field speeds up: 2017 has one landmark paper, while by 2022 a single year changes the training recipe, the block, inference and the first public chat assistant. Second, the threads feed each other. The transformer made scale practical, scale made pretrained models capable enough to be worth aligning, and feedback training is now pushing models to spend more computation at the moment they answer, which sends the work back to the serving thread.`);

    /* ---------------------------------------------------------------- shift 1 */
    p.h2('Shift 1: one architecture for everything', 'architecture');
    p.prose(`
In 2016 each kind of data had its own architecture, and each architecture had an assumption built in. A ConvNet assumes that nearby pixels belong together and that a cat is a cat wherever it appears ([convolutional networks](#/convnets)). A recurrent network assumes that text comes in order and reads it one token at a time, folding each into a hidden state ([recurrent networks](#/rnn)). Attention existed, but as an add-on: CS231n's last lectures used it to let a captioning RNN look at different parts of an image ([attention](#/attention)), and translation models used it to look back at the source sentence.

In 2017 *Attention Is All You Need* (Vaswani et al.) threw the recurrence away. The **Transformer** is attention, a small per-token network, residual connections and normalization, stacked. Every token looks at every other token in one step, and all positions are computed at once, which is exactly the kind of work GPUs are fast at. It trained in a fraction of the time of the recurrent translators and translated better.

Then it spread. In 2018 **GPT** and **BERT** pretrained transformers on plain text. In 2020 the **vision transformer** (ViT) cut an image into 16 by 16 patches, treated each patch as a token, and with enough data matched the best ConvNets. In 2021 **CLIP** trained an image transformer and a text transformer together, so that a photo and its caption land close together in one space. Today the same block handles text, images, audio and code, often in one model at once.

At its heart is an operation you have already written. Compare the linear classifier of CS231n with one row of attention:`);
    p.math({
      label: 'Two softmaxes, a year apart',
      tex: String.raw`\begin{aligned} &\text{2016:} & \symp &= \operatorname{softmax}(\symW\,\symx) \\ &\text{2017:} & \symp &= \operatorname{softmax}\big(\sym{W}{K}\,\sym{x}{q} / \sqrt{d}\,\big) \\ && \text{out} &= \symp\,V \end{aligned}`,
      codeTitle: 'two_softmaxes.py',
      code: `
        def softmax(s):
            e = np.exp(s - s.max())
            return e / e.sum()

        p = softmax(W @ x)               # 2016: classify
        a = softmax(K @ q / np.sqrt(d))  # 2017: attend
        out = a @ V                      # blend the values
      `,
      terms: [
        [String.raw`\symW\,\symx`, 'a matrix times a vector: one dot product per row of $W$, so one score per class ([linear classifiers](#/linear-classification))'],
        [String.raw`\operatorname{softmax}`, 'exponentiate every score and divide by the total: positive numbers that add up to 1 ([the Softmax classifier](#/linear-classification/softmax))'],
        [String.raw`\sym{W}{K}\,\sym{x}{q}`, 'the same product under new names: the rows are **keys**, one per token, and the vector is a **query**'],
        [String.raw`\sqrt{d}`, 'divide by the square root of the vectors\' length $d$, so the scores do not grow with the width ([why](#/transformer/scaling))'],
        [String.raw`\symp\,V`, 'a weighted average of the **values**, one per token, in the proportions the softmax chose'],
      ],
      explain: `In 2016 the rows being compared with were learned weights, fixed once training ends, and the softmax produced the answer. In attention the rows are computed from the input itself (every token makes its own key), so the "classes" change with every sentence, and the softmax output is not the answer but a recipe for mixing: how much of each token to take. Stack that operation with the MLPs and residual connections you already know and you have a transformer ([Chapter 2](#/transformer)).`,
    });
    figSoftmax(p);
    p.callout('intuition', `When everything is a transformer, every improvement is shared. A faster attention kernel, a better optimizer or a cheaper way to store activations, found for language models, speeds up vision models the same month. Hardware is designed around one workload, and one model can take a photo and a question about it in the same sequence. Much of the decade's pace comes from this convergence.`, 'Why one architecture matters');
    p.callout('aside', `The transformer gave something up: the built-in assumptions. A ConvNet knows from its first step that nearby pixels matter together; a vision transformer has to learn it from data, which is why ViT needed far more training images than ResNet to win. With little data or a small compute budget, ConvNets are still a strong choice, and the U-Nets inside many diffusion models are ConvNets. [Chapter 10](#/vit) weighs the trade.`, 'What attention gave up');

    /* ---------------------------------------------------------------- shift 2 */
    p.h2('Shift 2: scale as a research direction', 'scale');
    p.prose(`
In 2016 more data meant more labels, and labels cost money: ImageNet took years of crowd work. The insight of 2018 was that text labels itself. Take any document, hide the next token, and ask the model to predict it. Every position of every text on the web is a training example with a free label. The loss is one CS231n already taught:`);
    p.math({
      label: 'Pretraining: the softmax loss at every position',
      tex: String.raw`\begin{aligned} \symL &= -\frac{1}{T}\sum_{t=1}^{T} \log \symp_t[\,y_t\,] \\ \symp_t &= \operatorname{softmax}(\syms_t) \end{aligned}`,
      codeTitle: 'next_token.py',
      code: `
        # ids: T + 1 token ids from one text
        logits = model(ids[:-1])     # (T, vocab)
        p = softmax(logits, axis=1)  # a row per position
        y = ids[1:]                  # the next tokens
        loss = -np.log(p[np.arange(T), y]).mean()
      `,
      terms: [
        [String.raw`\syms_t`, 'the model\'s scores at position $t$, one per vocabulary entry, computed from the tokens up to $t$ only'],
        [String.raw`\symp_t`, 'their softmax: a probability for every possible next token'],
        [String.raw`y_t`, 'the label: the token that actually comes next in the text. No human needed'],
        [String.raw`-\log \symp_t[\,y_t\,]`, 'the softmax loss of one example: small when the right token got high probability ([Softmax](#/linear-classification/softmax))'],
        [String.raw`\frac{1}{T}\sum_{t=1}^{T}`, 'add up over all $T$ positions (Σ means "add up") and divide by $T$: an average'],
      ],
      explain: `This is the loss of Assignment 1's Softmax classifier, with the vocabulary as the classes (tens of thousands of them) and every position of every text as a labeled example. That last part changed the field. Any text is now a dataset, so the size of a model is limited by compute, not by how many labels people can write. [Chapter 4](#/pretraining) builds it out.`,
    });
    p.prose(`
Then people noticed what happens as you scale it. **GPT-2** (2019, 1.5 billion parameters) could attempt tasks it was never trained for when given the right prompt. **GPT-3** (2020, 175 billion) could learn a task from a few examples written into the prompt, with no gradient step at all: *in-context learning*.

That same year **Kaplan et al.** measured how the loss falls. Plotted against parameters, data or compute on log axes, it follows a straight line, a **power law**, over many orders of magnitude. That turned scale from a gamble into a plan: train small models, fit the line, and predict what a model a thousand times bigger will reach. In 2022 **Chinchilla** (Hoffmann et al.) corrected the plan. For a fixed compute budget, parameters and training tokens should grow together, at about 20 tokens per parameter; GPT-3, with 300 billion tokens for 175 billion parameters, had been under-trained. The budget itself is one line of arithmetic:`);
    p.math({
      label: 'Training compute',
      tex: String.raw`C \approx 6\,\symN\,\symD`,
      codeTitle: 'compute.py',
      code: `
        N = 175e9         # GPT-3: parameters
        D = 300e9         # training tokens
        C = 6 * N * D     # 3.15e23 FLOPs
        D / N             # 1.7 tokens per parameter
      `,
      terms: [
        [String.raw`\symN`, 'the parameters: every weight is used once for every token'],
        [String.raw`\symD`, 'the number of training tokens'],
        [String.raw`6`, 'about 2 operations per parameter per token in the forward pass (a multiply and an add), and about 4 in the backward pass, which needs gradients for both the inputs and the weights'],
        [String.raw`C`, 'the training compute, counted in floating-point operations (FLOPs)'],
      ],
      explain: `For GPT-3 that is $6 \\times 175$ billion $\\times 300$ billion, about $3.15 \\times 10^{23}$ operations, which matches the figure its paper reports. The scaling laws answer the question this raises: for a fixed $C$, how should you split it between $\\symN$ and $\\symD$? [Chapter 5](#/scaling-laws) fits the lines and does the split.`,
    });
    figScale(p);
    p.callout('aside', `Scale sent a bill, and paying it is a thread of its own. Models stopped fitting on one GPU, so training was split across thousands ([Chapter 8](#/parallelism)). Mixture-of-experts layers grew the parameter count without growing the work per token ([Chapter 9](#/moe)). Attention was rewritten to avoid slow memory, the block was reshaped for stability at depth ([Chapter 6](#/modern-transformer)), and optimizers and 16-bit number formats were tuned for runs that cannot be restarted cheaply ([Chapter 7](#/optimizers)).`, 'The bill for scale');

    /* ---------------------------------------------------------------- shift 3 */
    p.h2('Shift 3: learning from feedback', 'feedback');
    p.prose(`
A pretrained model is a text predictor. Ask it a question and it may answer, or it may continue with three more questions, because that is what text on the web often does. Turning it into an assistant takes a different kind of training.

The first step is ordinary supervised learning: fine-tune on written examples of good answers ([Chapter 13](#/finetuning)). But good answers are hard to write and easy to judge, so the next step learns from judgments. In **RLHF**, people compare two answers; a **reward model** learns to predict which one they prefer; and the language model is trained with reinforcement learning (PPO) to produce answers the reward model scores highly, while a penalty keeps it close to where it started ([Chapter 15](#/rlhf)). **InstructGPT** (2022) made this the recipe: labelers preferred its 1.3-billion-parameter model to the 175-billion-parameter GPT-3. **ChatGPT**, released that November, was trained the same way.

Two refinements followed. **DPO** (2023) showed the same objective can be optimized directly on the preference pairs, with no reward model and no RL loop ([Chapter 16](#/dpo)). And for tasks with checkable answers, such as math and code, the learned reward can be replaced by a program: **RL from verifiable rewards**. **GRPO** (in DeepSeekMath, 2024) made that cheap by comparing each sampled answer with its group instead of training a second network ([Chapter 17](#/grpo)). OpenAI's **o1** (September 2024) showed a model trained with RL to reason at length before answering, whose accuracy kept rising with more thinking, and **DeepSeek-R1** (January 2025) published a recipe: RL on checkable problems makes long chains of reasoning grow on their own ([Chapter 18](#/reasoning)).

Under all of it is one update, and it is a close relative of the gradient you derived for the Softmax classifier:`);
    p.math({
      label: 'The policy gradient for a softmax',
      tex: String.raw`\begin{aligned} \nabla_{\syms} \log \symp_i &= \mathbf{e}_i - \symp \\ \syms &\leftarrow \syms + \eta\,(r - b)\,(\mathbf{e}_i - \symp) \end{aligned}`,
      codeTitle: 'policy_gradient.py',
      code: `
        p = softmax(logits)
        i = rng.choice(len(p), p=p)  # the model answers
        r = reward(i)     # person, model or checker
        b = baseline()    # e.g. the average reward
        grad = np.eye(len(p))[i] - p   # d log p[i] / ds
        logits += lr * (r - b) * grad
      `,
      terms: [
        [String.raw`\symp_i`, 'the probability the model gave the answer $i$ it actually sampled'],
        [String.raw`\mathbf{e}_i - \symp`, 'the gradient of $\\log p_i$ with respect to the scores: $1 - p_i$ at the sampled answer and $-p_j$ everywhere else. It is the cross-entropy gradient of CS231n with the sign flipped ([softmax gradient](#/linear-classification/softmax))'],
        [String.raw`r - b`, 'the reward minus a baseline, what the model usually gets: positive if this answer was better than usual, negative if worse'],
        [String.raw`\eta`, 'the learning rate'],
      ],
      explain: `Supervised learning raises the probability of a label someone provides. This raises the probability of whatever the model itself produced, in proportion to how much better than usual it turned out. With $r - b = 1$ it is one step of ordinary cross-entropy training on the model's own answer; with $r - b < 0$ it trains *away* from that answer. PPO, DPO and GRPO are each careful versions of this line ([Chapter 14](#/policy-gradients) derives it).`,
    });
    figFeedback(p);

    /* ---------------------------------------------------------------- carried over */
    p.h2('What carried over from CS231n', 'carried-over');
    p.prose(`
For all that changed, the machinery underneath did not. Everything below is from CS231n, and every one of them is in a 2026 training run:

- **Backpropagation** ([backpropagation](#/backprop)): the chain rule, run backward through a graph of simple nodes. Frameworks now do it automatically, but it is the same computation.
- **SGD and Adam** ([parameter updates](#/nn-learning/updates)): mini-batches, momentum and per-parameter step sizes. AdamW (2017) changes only how weight decay is applied; Muon (2024) is a new member of the same family ([Chapter 7](#/optimizers)).
- **Softmax and cross-entropy** ([the Softmax classifier](#/linear-classification/softmax)): the pretraining loss, the attention weights, the router of a mixture of experts and the contrastive loss of CLIP are all softmaxes.
- **Residual connections** ([ConvNet case studies](#/convnets/case-studies)): ResNet's shortcut is the backbone of every transformer, the *residual stream* that each layer reads from and writes to.
- **Normalization** ([batch normalization](#/nn-data-loss/batchnorm)): the same rescale-and-shift, now computed per token instead of per batch (layer norm, RMSNorm).
- **Initialization** ([weight initialization](#/nn-data-loss/init)): small random weights scaled by layer width, so signals keep their size through a deep stack.

The figure puts them in place: one training step of a modern language model, colored by age.`);
    figCarried(p);
    p.callout('history', `Some things did fade. Hand-designed image features had already lost to ConvNets by 2016. Recurrent networks lost language to transformers within about two years of 2017. And training a separate model for each task from scratch gave way to adapting one pretrained model, by fine-tuning or just by asking. Habits from CS231n's practical lectures survived intact, though: watch the loss curve, check gradients when in doubt, sweep learning rates on a log scale, and overfit a tiny batch before a big run ([training](#/nn-learning)).`, 'What faded');

    /* ---------------------------------------------------------------- map */
    p.h2('The map of this course', 'map');
    p.prose(`
DL26 has twenty chapters after this one, in five parts that follow the threads of the timeline. It assumes CS231n: linear classifiers, softmax and cross-entropy, backpropagation, SGD and Adam, ConvNets and RNNs.`);
    for (const part of COURSES.find((k) => k.id === 'dl26')!.parts) {
      const items = CHAPTERS.filter((c) => c.course === 'dl26' && c.part === part);
      const list = items.map((c) => `- [**${c.num}.** ${c.title}](#/${c.id}): ${c.blurb}${c.id === 'decade' ? ' *You are here.*' : ''}`).join('\n');
      p.prose(`### ${part}\n\n${PART_INTRO[part] ?? ''}\n\n${list}`);
    }
    p.prose(`
### What builds on what

Chapters 1 to 4 are the spine: most later chapters use the Transformer block and the next-token loss. Four chapters need only CS231n: **3** (tokens), **7** (optimizers), **8** (many GPUs) and **12** (diffusion). The post-training chapters build on each other, from 14 to 18.`);
    p.table(
      ['If you want', 'Read'],
      [
        ['how a chat model is built, end to end', '[1](#/seq2seq), [2](#/transformer), [3](#/tokenization), [4](#/pretraining), [5](#/scaling-laws), then [13](#/finetuning) to [18](#/reasoning)'],
        ['images: understanding and generating them', '[2](#/transformer), [10](#/vit), [11](#/contrastive), [12](#/diffusion)'],
        ['training big models', '[5](#/scaling-laws), [6](#/modern-transformer), [7](#/optimizers), [8](#/parallelism), [9](#/moe)'],
        ['serving models, and looking inside them', '[2](#/transformer), [6](#/modern-transformer), [19](#/inference), [20](#/interpretability)'],
      ],
      { caption: 'Four short paths through the course. Each assumes CS231n.' },
    );

    p.callout('idea', `
- After 2016 deep learning changed shape in three ways. **One architecture**: attention replaced recurrence in 2017, and the transformer spread from text to images and beyond. **Scale**: next-token pretraining turned any text into training data, and scaling laws (2020, 2022) turned model size into a predictable plan, budgeted as $C \\approx 6\\symN\\symD$. **Feedback**: RLHF (InstructGPT, ChatGPT, 2022), then DPO (2023), then RL from verifiable rewards with GRPO, o1 and R1 (2024 to 2025).
- The machinery carried over: backprop, SGD and Adam, softmax and cross-entropy, residual connections, normalization and initialization. Attention is a softmax over dot products, pretraining is the Softmax classifier's loss at every position, and the policy gradient is its gradient weighted by a reward.
- The course follows the threads: attention and transformers, scale, images, post-training, serving and understanding. Chapters 1 to 4 come first; the rest branch from them.`, 'Takeaways');

    /* ---------------------------------------------------------------- exercises */
    p.h2('Build it yourself', 'exercises');
    p.prose(`
1. **Set up your tools** (20 minutes). Install Python 3 with NumPy and PyTorch (\`pip install numpy torch\`). Write \`softmax(s)\` in NumPy, subtracting the row maximum first, and compare it with \`torch.softmax\` on a random (4, 10) array that includes a row of scores near 1,000. Then time a 2048 by 2048 matrix multiply in NumPy and in PyTorch, on your GPU if you have one (\`cuda\`, or \`mps\` on a Mac). Success: the two softmaxes agree to about \`1e-6\` with no overflow warning, and you know how much faster your accelerator is than your CPU.
2. **Read the 2017 paper's first two pages** (30 minutes). Open *Attention Is All You Need* (arXiv 1706.03762) and read the abstract, the introduction and the background section. Write down in your own words what it replaces and why (the sequential computation of recurrent networks), what it claims (better translation for a fraction of the training cost), and one thing you do not understand yet. Success: three sentences you could say to a friend, and a question that [Chapters 1](#/seq2seq) and [2](#/transformer) answer.
3. **One softmax, two jobs** (45 minutes). In NumPy, write a linear classifier's forward pass \`p = softmax(W @ x)\` for 3 classes. Then reuse the same function for self-attention: for \`X\` of shape (T, d), compute \`Q = X @ Wq\`, \`K = X @ Wk\` and \`V = X @ Wv\` with random matrices, then \`out = softmax(Q @ K.T / np.sqrt(d)) @ V\`, applying the softmax to each row (give your function an \`axis\` argument). Success: every row of the attention weights sums to 1; with \`Wq\` set to zeros every token gets the plain average of the values; and you can point to the one function both programs share.`);
  },
};

export default chapter;

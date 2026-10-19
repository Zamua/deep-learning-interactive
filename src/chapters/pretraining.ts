import type { ChapterDef } from './index';
import { DOT, ENTROPY, TRAIN, V, VOCAB } from '../lib/pretraining-lang';
import { figChain, figCompress, figDecode, figGptBert, figIcl, figPerplexity, figTradeoff, figTrain } from '../lib/pretraining-figs';
import { PRETRAINING_SYMBOLS } from '../lib/pretraining-symbols';

/** The first few sentences of the generated training text, for the prose. */
function firstSentences(n: number): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  for (let i = 1; i < TRAIN.length && out.length < n; i++) {
    cur.push(VOCAB[TRAIN[i]!]!);
    if (TRAIN[i] === DOT) {
      out.push(cur.join(' '));
      cur = [];
    }
  }
  return out;
}

const chapter: ChapterDef = {
  symbols: PRETRAINING_SYMBOLS,

  render(p) {
    const H = ENTROPY.toFixed(2);
    const PPLH = Math.exp(ENTROPY).toFixed(1);

    p.prose(`
In [the RNN chapter](#/rnn) of CS231n, a small network read a few kilobytes of Shakespeare, learned to predict the next character, and then wrote new text one character at a time. Almost everything in modern language AI is that same recipe with the dials turned up: a [transformer](#/transformer) instead of an RNN, [subword tokens](#/tokenization) instead of characters, and a large slice of the internet instead of one play. GPT-3 (2020) trained on about 300 billion tokens.

This first stage is called **pretraining**: learning from raw text, with no labels and no particular task in mind. Its objective fits in a sentence: make the text you are shown as probable as possible, one token at a time. This chapter is about that objective. What it measures and how you score a model with it (cross-entropy and perplexity), how the training loop uses it (teacher forcing), how you get text back out (greedy decoding, temperature, top-k and top-p), the main alternative (BERT's masked words), and why something so simple teaches a network so much.`);

    p.callout('aside', `Every figure in this chapter computes live, so it needs a language small enough to work with. The **toy language** has ${V} words and sentences like ${[0, 2].map((i) => `*${firstSentences(3)[i]!.replace(/ \.$/, '.')}*`).join(' and ')} (the period counts as a word), produced by a small grammar with fixed probabilities. Because we wrote the grammar, we know the true probability of every next word in every context, and therefore the best loss any model could ever reach. Its 20,000-word training text and 3,000-word held-out text are generated in your browser.`, 'The toy language');

    // ------------------------------------------------------------------
    p.h2('Predicting the next token', 'next-token');
    p.prose(`
A **language model** reads some text and returns a probability for every token in its vocabulary: how likely each one is to come next. Under the hood it is the softmax classifier of [linear classification](#/linear-classification) with a very large number of classes. A network turns the text so far into one score (a *logit*) per token, and a softmax turns the scores into probabilities that are positive and add up to 1. GPT-2's vocabulary has 50,257 tokens, so every prediction it makes is a 50,257-way classification.

One prediction is useful, but a probability for a whole text is what lets us score, compare and generate texts. The **chain rule of probability** builds it from next-token predictions, and it does so exactly:`);
    p.math({
      label: 'The chain rule of probability',
      tex: String.raw`\begin{aligned} \symp(\symx_1, \dots, \symx_T) &= \symp(\symx_1)\,\symp(\symx_2 \mid \symx_1)\cdots \\ &= \prod_{t=1}^{T} \symp(\symx_t \mid \symx_{<t}) \end{aligned}`,
      code: `
        x = tokenize("the cat sleeps .")   # token ids
        prob, logp = 1.0, 0.0
        for t in range(len(x)):
            probs = model(x[:t])       # V numbers that sum to 1
            prob *= probs[x[t]]        # the token that really came
            logp += np.log(probs[x[t]])
      `,
      codeTitle: 'chain_rule.py',
      terms: [
        [String.raw`\symp(\symx_1, \dots, \symx_T)`, 'the probability the model gives the whole text of $T$ tokens'],
        [String.raw`\symx_{<t}`, 'every token before position $t$: the *prefix*, or *context*'],
        [String.raw`\symp(\symx_t \mid \symx_{<t})`, 'read "the probability of $x_t$ given $x_{<t}$": the model\'s prediction at position $t$, looked up at the token that really came next'],
        [String.raw`\prod_{t=1}^{T}`, 'multiply one such factor for every position, from 1 to $T$'],
      ],
      explain: `Read it as a story told one word at a time. The chance of *the cat sleeps .* is the chance that a text starts with *the*, times the chance that *cat* follows *the*, times the chance that *sleeps* follows *the cat*, and so on. Nothing is approximated: every probability distribution over texts can be written this way. So a model that predicts the next token well at every position is automatically a model of whole texts, and it can generate the same way it scores, one token at a time. The code also keeps the sum of logs, for a reason the figure makes plain: a product of many numbers below 1 races toward zero (a thousand factors of 0.1 is $10^{-1000}$, far below the smallest number a computer's floating point can hold, about $10^{-308}$), while the log turns the product into a sum of modest negative numbers.`,
    });
    p.callout('math', `**Conditional probability.** $p(B \\mid A)$, read "the probability of B given A", is the probability of B in the world where A already happened. The chance that a random English word is *States* is small; the chance that the next word is *States*, given that the last two were *the United*, is large. **Product notation.** The capital $\\prod$ (pi) does for multiplication what $\\sum$ does for addition: multiply what follows it once for every value of $t$. **Logs.** $\\log(ab) = \\log a + \\log b$, so the log of a product is a sum of logs, and $\\log$ of a number between 0 and 1 is negative. The [math survival kit](#/math-kit) covers all three.`, 'Math help: given, products and logs');

    p.prose(`
### A model you can build by counting

Before neural networks, language models were built by counting. An **n-gram model** assumes that the next word depends only on the last $n - 1$ words, and estimates its probability from how often each continuation followed those words in a large text. For a trigram ($n = 3$):`);
    p.math({
      label: 'A trigram model, by counting',
      tex: String.raw`\symp(\symx_t \mid \symx_{t-2}, \symx_{t-1}) = \frac{\#(\symx_{t-2}\,\symx_{t-1}\,\symx_t)}{\#(\symx_{t-2}\,\symx_{t-1})}`,
      code: `
        from collections import Counter
        tri = Counter(zip(tokens, tokens[1:], tokens[2:]))
        bi = Counter(zip(tokens, tokens[1:]))

        def p_next(w, u, v):          # p(w | u v)
            return tri[u, v, w] / bi[u, v]
      `,
      codeTitle: 'trigram.py',
      terms: [
        [String.raw`\#(\symx_{t-2}\,\symx_{t-1}\,\symx_t)`, '"the number of": how many times these three words appear in a row in the training text'],
        [String.raw`\#(\symx_{t-2}\,\symx_{t-1})`, 'how many times the two context words appear in a row'],
        [String.raw`\frac{\cdot}{\cdot}`, 'of all the times the context appeared, the fraction that went on with $x_t$'],
      ],
      explain: `This ratio is not a heuristic. For a model that only sees two words of context, it is exactly the probability that minimizes the training loss of the next section (the *maximum-likelihood* estimate). Its weakness is data. With a vocabulary of 50,000 words there are $50{,}000^2$, or 2.5 billion, possible two-word contexts, and most four-word contexts in a new sentence never occurred in any training text, so their counts are zero and the ratio calls perfectly good text impossible. Counting models patch this with *smoothing*: mix in the estimates from shorter contexts. The figures in this chapter use such a mix, over the last 4, 3, 2, 1 and 0 words, which we will just call **the n-gram model**.`,
    });
    figChain(p);
    p.callout('history', `Claude Shannon's *A Mathematical Theory of Communication* (1948) generated "approximations to English" by sampling letters, and then words, from n-gram statistics, and noted that the output looks more like English as $n$ grows. Bengio et al. (2003) replaced the count table with a neural network over learned word embeddings, so that what is learned about *cat* also helps *dog*. RNNs and then transformers removed the fixed window altogether. The objective never changed.`, 'From Shannon to neural language models');

    // ------------------------------------------------------------------
    p.h2('Cross-entropy and perplexity', 'cross-entropy');
    p.prose(`
Training needs one number that says how good the predictions are. The natural choice is the average negative log-probability the model gave to the tokens that actually came next. It is the softmax cross-entropy loss from [linear classification](#/linear-classification), applied at every position of the text, with the vocabulary as the set of classes.`);
    p.math({
      label: 'The language-modeling loss',
      tex: String.raw`\symL = -\frac{1}{T}\sum_{t=1}^{T} \log \symp(\symx_t \mid \symx_{<t})`,
      code: `
        loss = 0.0
        for t in range(T):
            probs = model(x[:t])
            loss += -np.log(probs[x[t]])    # surprise at x[t]
        loss /= T                           # nats per token
      `,
      codeTitle: 'lm_loss.py',
      terms: [
        [String.raw`-\log \symp(\symx_t \mid \symx_{<t})`, 'the *surprise* at the token that came: 0 if the model gave it probability 1, large if it gave it almost nothing'],
        [String.raw`\frac{1}{T}\sum_{t=1}^{T}`, 'the average over all $T$ positions, so long and short texts compare fairly'],
        [String.raw`\symL`, 'the loss, measured in *nats* when the log is natural; divide by $\\ln 2 \\approx 0.693$ to get *bits*'],
      ],
      explain: `It is the chain rule's log-probability, negated and divided by the length. Minimizing it makes the training text as probable as possible. A model that knows nothing spreads its probability evenly over all $V$ tokens and pays $\\log V$ on every one: $\\log 36 \\approx 3.58$ nats for the toy language, and about 10.8 for GPT-2's 50,257 tokens.`,
    });
    p.prose(`A loss of 1.6 nats is hard to feel. **Perplexity** converts it back into a count:`);
    p.math({
      label: 'Perplexity',
      tex: String.raw`\symPPL = e^{\symL} = \Big(\prod_{t=1}^{T} \symp(\symx_t \mid \symx_{<t})\Big)^{-1/T}`,
      code: `
        ppl = np.exp(loss)

        # a model that is uniform over k tokens pays log(k):
        k = 36
        np.exp(np.log(k))    # 36.0: perplexity is exactly k
      `,
      codeTitle: 'perplexity.py',
      terms: [
        [String.raw`e^{\symL}`, '$e$ to the power of the loss, which undoes the log'],
        [String.raw`\big(\prod \cdots\big)^{-1/T}`, 'the same thing written without logs: one over the *geometric mean* of the probabilities given to the right tokens'],
      ],
      explain: `Perplexity is the effective number of choices: the model is as uncertain as if it were picking uniformly among $\\symPPL$ tokens at every step. Uniform guessing over 36 words has perplexity exactly 36; a model that is always certain and always right has perplexity 1; a perplexity of 20 means "about as unsure as a fair 20-sided die". It answers the question "how many tokens is the model really hesitating between?"`,
    });

    p.prose(`
### The floor: the language's own uncertainty

Even a perfect model cannot reach zero loss on real text, because text is genuinely uncertain: after *the cat*, both *sleeps* and *runs* are fine. Write $\\sympd$ for the true distribution of the next token. If the text really comes from $\\sympd$ and the model predicts $\\symp$, the model's expected loss on the next token is the **cross-entropy** between the two, and it splits into two parts:`);
    p.math({
      label: 'Cross-entropy = entropy + KL divergence',
      tex: String.raw`\begin{aligned} H(\sympd, \symp) &= -\textstyle\sum_w \sympd(w)\log \symp(w) \\ &= H(\sympd) \\ &\quad + \mathrm{KL}(\sympd \,\|\, \symp) \end{aligned}`,
      code: `
        nz = p_data > 0                      # 0 log 0 counts as 0
        loss = -(p_data[nz] * np.log(probs[nz])).sum()
        floor = -(p_data[nz] * np.log(p_data[nz])).sum()
        kl = loss - floor                    # never negative
      `,
      codeTitle: 'decompose.py',
      terms: [
        [String.raw`H(\sympd, \symp)`, 'the *cross-entropy*: the average loss when the text follows $\\sympd$ and the model predicts $\\symp$'],
        [String.raw`\sum_w \sympd(w)\,(\cdots)`, 'an *expectation*: an average over next words $w$, each weighted by how often it really comes'],
        [String.raw`H(\sympd) = -\textstyle\sum_w \sympd(w)\log \sympd(w)`, 'the *entropy*: the same average with the true distribution in both places. It is the uncertainty built into the language itself and does not depend on the model at all'],
        [String.raw`\mathrm{KL}(\sympd\,\|\,\symp) = \textstyle\sum_w \sympd(w)\log\frac{\sympd(w)}{\symp(w)}`, 'the *Kullback-Leibler divergence*: the extra loss paid for predicting $\\symp$ when the truth is $\\sympd$. It is never negative, and zero only when the two are equal'],
      ],
      explain: `Training can only shrink the second part. The entropy is a property of the text, so no model can beat it on average: it is the **floor**. For real text nobody knows the floor exactly (the scaling-law fits of [the next chapter](#/scaling-laws) estimate it as an "irreducible" term), but for the toy language we can compute it: ${H} nats per word, a perplexity of ${PPLH}. The KL divergence, a measure of how far one distribution is from another, comes back often in this course: post-training keeps a model close to its pretrained self with a [KL penalty](#/policy-gradients).`,
    });
    figPerplexity(p);
    p.callout('warning', `Perplexity is an average *per token*, so it depends on the tokenizer. A model with a bigger vocabulary cuts the same text into fewer, harder-to-predict tokens, and its perplexity is not comparable with a model that uses smaller tokens. To compare across tokenizers, divide the total bits for a text by its length in bytes or characters (*bits per byte*), or compare on the same tokenizer (see [tokens and embeddings](#/tokenization)).`, 'Comparing perplexities');

    // ------------------------------------------------------------------
    p.h2('Training with teacher forcing', 'teacher-forcing');
    p.prose(`
To train on this loss, cut the training text into chunks of $T + 1$ tokens. Feed the first $T$ tokens in as input and ask for the last $T$ as output: the same text, shifted by one. At every position the model reads the true prefix, never its own guesses, and is graded on the true next token. This is called **teacher forcing**, after a teacher who tells you the right word after each guess, before you guess the next one.

With a transformer and a [causal mask](#/transformer), all $T$ predictions come out of a single forward pass, in parallel. A 2,048-token chunk is 2,048 training examples for the price of one pass. An RNN computes the same loss but has to walk through the positions one after another; that parallelism is a large part of why transformers took over.`);
    p.math({
      label: 'One batch of teacher-forced training',
      tex: String.raw`\symL = -\frac{1}{BT}\sum_{b=1}^{B}\sum_{t=1}^{T}\log \symp\big(\symx_{b,t+1} \mid \symx_{b,\le t}\big)`,
      code: `
        starts = np.random.randint(0, N - T - 1, size=B)
        chunk = tokens[starts[:, None] + np.arange(T + 1)]
        inputs, targets = chunk[:, :-1], chunk[:, 1:]  # shift by one

        logits = model(inputs)                  # (B, T, V)
        z = logits - logits.max(-1, keepdims=True)
        logp = z - np.log(np.exp(z).sum(-1, keepdims=True))
        picked = np.take_along_axis(logp, targets[..., None], -1)
        loss = -picked.mean()                   # average of B*T terms
      `,
      codeTitle: 'batch_loss.py',
      terms: [
        [String.raw`\sum_{b=1}^{B}\sum_{t=1}^{T}`, 'two sums: over the $B$ chunks in the batch, and over the $T$ positions of each chunk'],
        [String.raw`\symx_{b,t+1}`, 'the target: the real next token of chunk $b$'],
        [String.raw`\symx_{b,\le t}`, 'the real prefix, tokens 1 to $t$ of chunk $b$. The model is always conditioned on true text, never on its own output'],
        [String.raw`\frac{1}{BT}`, 'the average over all $B \\times T$ predictions'],
      ],
      explain: `\`inputs\` and \`targets\` are the same chunk offset by one position, which is the whole trick. The \`logp\` lines are a numerically safe log-softmax, and \`take_along_axis\` picks out the log-probability of each real next token. Conditioning on true text makes training simple and parallel, but it leaves a mismatch called **exposure bias**: in training the model never sees its own mistakes, while in generation it reads nothing but its own output, so errors can compound. How much this matters for large models is debated; it is one more reason the decoding rules below exist.`,
    });
    figTrain(p);
    p.prose(`
Two lessons from that figure carry straight over to real models. First, more context lowers the loss, and real text has dependencies that span paragraphs and whole documents, which is why context lengths grew from 512 tokens (GPT-1) to hundreds of thousands. Second, held-out loss tracks training loss closely: there are 20,000 words of training text and only about 5,000 parameters, so the network cannot memorize much. Large language models live in the same regime. They usually see each token of their training data about once, so their training loss is an honest estimate of their loss on new text, and the question becomes how fast it falls with size and data, the subject of [scaling laws](#/scaling-laws).`);

    // ------------------------------------------------------------------
    p.h2('Generating text: decoding', 'decoding');
    p.prose(`
A trained language model is a next-token distribution on demand. To generate, run it in a loop: compute the distribution, choose a token, append it, repeat. This is **autoregressive** generation: every token the model writes becomes context for the next. The model only says how likely each token is; the rule for choosing one is called the **decoding strategy**, and it matters almost as much as the model.

### Greedy decoding and beam search

The obvious rule takes the most likely token every time: **greedy** decoding, an \`argmax\`. It is deterministic, and for open-ended text it is surprisingly bad. It always takes the safest continuation, and once a phrase is likely enough, it is likely enough to repeat: in the toy language, greedy decoding settles into the same few short sentences over and over. **Beam search** keeps the $B$ most probable partial texts instead of one. It is the standard for translation, where there is roughly one right answer, but for open-ended writing it shares greedy's taste for bland, repetitive text, even though that text has a higher probability than what people write (Holtzman et al., 2019). Human text is not the most likely text; it is a typical sample.

### Sampling and temperature

**Sampling** draws the next token at random, in proportion to its probability. That reproduces the model faithfully, mistakes included. A model spreads a little probability over thousands of tokens that are wrong in context, and over a long text those small chances add up to errors. **Temperature**, met in the [RNN chapter](#/rnn), reshapes the distribution before the draw:`);
    p.math({
      label: 'Temperature',
      tex: String.raw`\begin{gathered} q(w) = \frac{\symp(w)^{1/\symtau}}{\sum_{v} \symp(v)^{1/\symtau}} \\ \text{the same as}\quad q = \operatorname{softmax}\!\Big(\frac{\text{logits}}{\symtau}\Big) \end{gathered}`,
      code: `
        def with_temperature(probs, temperature):
            z = np.log(probs) / temperature   # = logits / T + const
            q = np.exp(z - z.max())
            return q / q.sum()
      `,
      codeTitle: 'temperature.py',
      terms: [
        [String.raw`\symp(w)^{1/\symtau}`, 'each probability raised to the power $1/\\tau$. For $\\tau < 1$ the power is above 1, which shrinks small probabilities much faster than large ones'],
        [String.raw`\sum_v \cdots`, 'renormalize, so the new numbers add up to 1 again'],
        [String.raw`\operatorname{softmax}(\text{logits}/\symtau)`, 'the same thing, written the way code usually does it: divide the scores by $\\tau$ before the softmax'],
      ],
      explain: `$\\tau = 1$ leaves the model alone. Below 1 the distribution sharpens toward the favorite, and as $\\tau$ approaches 0 sampling becomes greedy decoding. Above 1 it flattens toward uniform, and the tail of unlikely tokens swells. Temperature changes *how boldly* we read the model, never what it knows.`,
    });
    p.prose(`
### Cutting the tail: top-k and top-p

Instead of reshaping everything, we can cut the unreliable tail off and sample only from the head. **Top-k** sampling (Fan et al., 2018) keeps the $k$ most likely tokens and renormalizes. Its weakness is that no single $k$ fits every context: after *the dogs sleep on*, only *the* makes sense, while after *the* a dozen words do. **Top-p**, or **nucleus**, sampling (Holtzman et al., 2019) keeps the smallest set of most likely tokens whose probabilities add up to at least $\\symptop$, so the number of survivors adapts: one or two where the model is sure, dozens where many continuations are fine.`);
    p.math({
      label: 'Top-p (nucleus) sampling',
      tex: String.raw`\begin{gathered} q(w) = \begin{cases} \dfrac{\symp(w)}{\sum_{v \in N} \symp(v)} & w \in N \\[1ex] 0 & w \notin N \end{cases} \\[1ex] \text{smallest } N \text{ with } \textstyle\sum_{v \in N} \symp(v) \ge \symptop \end{gathered}`,
      code: `
        order = np.argsort(-probs)            # most likely first
        cum = np.cumsum(probs[order])
        keep = order[:np.searchsorted(cum, top_p) + 1]
        q = np.zeros_like(probs)
        q[keep] = probs[keep] / probs[keep].sum()
        next_token = np.random.choice(len(q), p=q)
      `,
      codeTitle: 'top_p.py',
      terms: [
        [String.raw`N`, 'the *nucleus*: walk down the tokens from most to least likely, adding up their probabilities, and stop as soon as the total reaches $p_{\\text{top}}$'],
        [String.raw`\frac{\symp(w)}{\sum_{v\in N}\symp(v)}`, 'inside the nucleus, the model\'s probabilities rescaled to add up to 1'],
        [String.raw`0`, 'everything outside the nucleus can never be drawn'],
      ],
      explain: `With $p_{\\text{top}} = 0.9$, the model keeps whatever head of the distribution holds 90% of the probability and discards the long tail where most of its mistakes live. $p_{\\text{top}} = 1$ is plain sampling. In practice it is usually combined with a temperature, applied first, which is how the code below orders them.`,
    });
    figDecode(p);
    p.prose(`The playground shows one distribution at a time. To compare strategies fairly, sample many sentences with each setting and measure both what we want (grammatical sentences) and what we pay for it (less variety):`);
    figTradeoff(p);
    p.callout('aside', `Temperature 0 usually means greedy decoding. Low temperatures suit tasks with one right answer, such as code or arithmetic, where the most likely continuation is usually the right one; open-ended writing uses moderate temperatures with a top-p cut. The [fast inference](#/inference) chapter shows how sampling interacts with speed, including speculative decoding, which keeps the sampled distribution exactly.`, 'In practice');

    // ------------------------------------------------------------------
    p.h2('Two ways to pretrain: GPT and BERT', 'gpt-bert');
    p.prose(`
In 2018 two influential pretraining recipes appeared within months of each other.

**GPT** (Radford et al., June 2018) was a 12-layer decoder-only transformer trained with exactly the loss above: predict the next token at every position, with a causal mask so each position sees only its left. The pretrained model was then fine-tuned for each task, with a small output layer on top.

**BERT** (Devlin et al., October 2018) argued that seeing only the left side wastes half the context. It used a transformer encoder, where every position attends to every other, and a different objective: **masked language modeling**. Pick 15% of the tokens, hide them, and train the model to recover them from both sides. (BERT also had a second objective, predicting whether two sentences were consecutive; RoBERTa (2019) showed it could be dropped.)`);
    p.math({
      label: 'Masked language modeling (BERT)',
      tex: String.raw`\symL_{\text{MLM}} = -\frac{1}{|M|}\sum_{t \in M} \log \symp\big(\symx_t \mid \tilde{\symx}\big)`,
      code: `
        chosen = np.random.rand(T) < 0.15     # positions with a loss
        r = np.random.rand(T)
        inp = x.copy()
        inp[chosen & (r < 0.8)] = MASK               # 80%: [MASK]
        swap = chosen & (r >= 0.8) & (r < 0.9)       # 10%: random
        inp[swap] = np.random.randint(V, size=swap.sum())
                                                     # 10%: unchanged
        probs = model(inp)           # (T, V): sees both sides
        loss = -np.log(probs[chosen, x[chosen]]).mean()
      `,
      codeTitle: 'mlm.py',
      terms: [
        [String.raw`M`, 'the set of chosen positions, about 15% of the sequence; $|M|$ is how many there are'],
        [String.raw`\tilde{\symx}`, 'the corrupted input: chosen tokens mostly replaced by a special [MASK] token'],
        [String.raw`\symp(\symx_t \mid \tilde{\symx})`, 'the model reads the whole corrupted sequence, left and right, and predicts the original token at position $t$'],
      ],
      explain: `Only the chosen positions carry a loss. Of those, 80% are replaced by [MASK], 10% by a random token and 10% are left alone. The reason: [MASK] never appears when the model is later used on real text, and if only [MASK] positions ever mattered, the model could stop paying attention to the other tokens. With some chosen tokens swapped or untouched, it has to build a good representation of every position.`,
    });
    figGptBert(p);
    p.table(
      ['', 'GPT (causal)', 'BERT (masked)'],
      [
        ['Architecture', 'decoder-only transformer, causal mask', 'encoder-only transformer, no mask'],
        ['Each position sees', 'the tokens to its left', 'the whole sequence'],
        ['Positions with a loss', 'every one', 'about 15%'],
        ['Generates text', 'naturally, left to right', 'not directly'],
        ['Best at, in 2018 to 2020', 'generation', 'classification, tagging, question answering by extracting spans'],
        ['Descendants', 'GPT-2, GPT-3 and nearly every chat model', 'RoBERTa, ELECTRA; text-embedding models for search'],
      ],
    );
    p.prose(`
For a couple of years BERT-style encoders won most language-understanding benchmarks. Then the field converged on GPT-style decoders, for three reasons. Every token is a training signal, not 15% of them (ELECTRA (2020) attacked the same inefficiency from the encoder side, by training on every position). A model that generates can do any task that can be phrased as text in, text out, including tasks nobody planned for. And as decoders grew, they started doing new tasks from a prompt alone, the subject of the next section. A third family, encoder-decoders such as T5 (2019), reads the input bidirectionally and writes the output causally, and is trained by filling in masked spans; it remains common for translation and other input-to-output tasks.`);

    // ------------------------------------------------------------------
    p.h2('Why next-token prediction teaches so much', 'why-it-works');
    p.prose(`
The objective looks shallow: guess the next word. But to drive the loss down on a large and varied corpus, a model has to absorb whatever regularities make text predictable, and in human text that is nearly everything.`);
    p.table(
      ['To predict what comes after...', 'the model needs'],
      [
        ['"The capital of France is"', 'a fact about the world'],
        ['"The keys to the old wooden cabinet"', 'grammar across intervening words (*are*, not *is*)'],
        ['"17 + 25 ="', 'arithmetic'],
        ['"She dropped the glass, and it"', 'everyday physics'],
        ['"A total waste of two hours. I would rate it"', 'sentiment'],
        ['"def mean(xs):\\n    return"', 'programming'],
      ],
    );
    p.prose(`
Every bit of loss removed is a piece of structure captured. There are two precise ways to say why this is a good objective, and one surprising consequence.

### Prediction is compression

Shannon's work implies that a predictor and a compressor are the same object. Given a model, **arithmetic coding** stores a text in about $-\\log_2 \\symp(\\symx)$ bits, within a couple of bits for the whole message, and decoding it back needs only the same model. So the loss, measured in bits, *is* the compressed size:`);
    p.math({
      label: 'Compressed size equals total loss',
      tex: String.raw`\begin{aligned} \text{bits}(\symx) &\approx -\log_2 \symp(\symx) \\ &= \sum_{t=1}^{T} -\log_2 \symp(\symx_t \mid \symx_{<t}) = \frac{T\,\symL}{\ln 2} \end{aligned}`,
      code: `
        bits = -np.log2(prob)        # length of the arithmetic code
        bits = T * loss / np.log(2)  # the same number, from the loss
      `,
      codeTitle: 'bits.py',
      terms: [
        [String.raw`-\log_2 \symp(\symx)`, 'the number of bits needed to point at one particular text, given the model'],
        [String.raw`\sum_t -\log_2 \symp(\symx_t \mid \symx_{<t})`, 'by the chain rule, the sum of each token\'s surprise in bits'],
        [String.raw`\frac{T\,\symL}{\ln 2}`, 'the total loss in nats, converted to bits'],
      ],
      explain: `A better language model is, literally, a better compressor of text, and the floor from earlier, the entropy, is the smallest possible average file size. Shannon (1951) measured how well people predict English one letter at a time and estimated roughly one bit per character. Large language models used as compressors (Delétang et al., 2023) beat specialized compressors even on images and audio, when the size of the model itself is not counted. Compressing text well forces a model to find its regularities, and that is the sense in which "predict the next token" is a demanding objective.`,
    });
    figCompress(p);

    p.prose(`
### In-context learning and few-shot prompting

GPT-2 (2019, 1.5 billion parameters) showed that a large enough language model can attempt tasks it was never trained for, if the task is written as text: append *TL;DR:* to a news article, and it continues with something like a summary. GPT-3 (Brown et al., 2020, 175 billion parameters) made this systematic. Put a few examples of a task in the prompt, then the new input, and let the model continue. No gradient step, no weight change: the model learns the task from its context. This is **in-context learning**, and prompting with examples is **few-shot** prompting. GPT-3 found that the benefit of the examples grows with model size, so that its largest model, given a few dozen examples, was competitive with fine-tuned systems on several benchmarks.`);
    p.table(
      ['Prompt style', 'What the model is given'],
      [
        ['zero-shot', '"Translate English to French:" then "cat =>"'],
        ['one-shot', 'the instruction, one example "dog => chien", then "cat =>"'],
        ['few-shot', 'the instruction, several examples ("dog => chien", "cow => vache", ...), then "cat =>"'],
      ],
    );
    p.prose(`
Why would next-token training produce this? The web is full of documents that set up a pattern and then continue it: lists, tables, glossaries, question-and-answer pages, translations side by side. To predict the later lines of such a document, the model has to work out from the earlier lines which pattern it is in. A model that drives its loss down on that data has to become good at this inference, inside its forward pass. Xie et al. (2021) made the view precise: in-context learning as implicit Bayesian inference over the hidden "task" of a document. The figure below is that argument at toy scale. [Looking inside language models](#/interpretability) shows one mechanism transformers use for it, the induction head.`);
    figIcl(p);
    p.callout('idea', `A language model gives a probability to every possible next token; by the chain rule, that is a probability for every text. Pretraining minimizes the average negative log-probability of real text (cross-entropy), with teacher forcing so every position of every chunk is a training example. Perplexity, $e^{\\symL}$, is the effective number of choices per token, and no model can go below the entropy of the text itself. Generating means choosing tokens one at a time: greedy decoding repeats itself, plain sampling falls into the tail, and temperature and top-p trade diversity for quality. GPT's causal objective beat BERT's masked one in the long run because every token teaches and a generator can do any text task. And because good prediction is good compression of a huge, varied corpus, the pretrained model absorbs facts, grammar and skills, and can even infer a new task from examples in its prompt. Turning that raw predictor into an assistant is the job of [fine-tuning](#/finetuning) and the post-training chapters.`, 'Takeaways');

    // ------------------------------------------------------------------
    p.h2('Build it yourself', 'exercises');
    p.prose(`
1. **Perplexity by hand (10 minutes, NumPy).** Build a bigram model with add-one smoothing (add 1 to every count before dividing) from a few paragraphs of text, and write \`perplexity(model, tokens)\`. Check two things: a model that is uniform over the vocabulary has perplexity exactly $V$, and shuffling the words of the test text raises the perplexity. *Success:* both checks pass, and you can say in one sentence why the shuffled text costs more.

2. **Write the decoders (30 minutes).** Implement greedy, temperature, top-k and top-p as one \`decode(probs, temperature, top_k, top_p)\` function, as in the playground. Test it: with $\\tau = 1$, $k = V$ and $p_{\\text{top}} = 1$, the frequencies of 100,000 draws match \`probs\` to within about 1%; $k = 1$ always returns the argmax; $\\tau = 0.01$ agrees with greedy. *Success:* all three tests pass.

3. **Teacher forcing on real text (an evening).** Train the window model of [Training with teacher forcing](#/pretraining/teacher-forcing) on real text, for example the tiny-Shakespeare file from the RNN chapter, at the word or character level, in NumPy or PyTorch. Plot training and validation loss, and compare the validation perplexity with a smoothed trigram on the same split. *Success:* the network beats the trigram on validation, and when you shrink the training set you can make the network overfit (training loss falling while validation loss rises).

4. **Masked versus causal (a weekend).** Take a small [transformer](#/transformer) and one dataset. Train it once with the next-token loss and once with BERT-style 15% masking, for the same number of steps. Compare how fast each loss falls per token of text seen, and how well each fills in a blank in the middle of a sentence. *Success:* a small table of results, and an explanation of the difference in terms of "positions with a loss" and "sees both sides".

5. **Project: in-context learning from scratch.** Generate a synthetic corpus of short lists like the last figure's: several tasks that map the same inputs to different outputs, mixed at different rates, with some noise. Train a small causal transformer on it, then measure its accuracy on a held-out query as a function of the number of examples in the prompt, and plot the Bayesian predictor's accuracy on the same axes. *Success:* the network's accuracy rises with the number of examples and approaches the Bayes curve. *Bonus:* find the attention head that copies the answer pattern (see [induction heads](#/interpretability)).`);
  },
};

export default chapter;

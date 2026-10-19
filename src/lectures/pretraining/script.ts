import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'pretraining',
  title: 'Language models and pretraining',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'One objective',
      codeTitle: 'pretrain.py',
      code: `
        # pretraining, in one loop
        for chunk in web_text:            #@data
            loss = -log_prob(model, chunk)  #@loss
            loss.backward()               #@step
            optimizer.step()              #@step
      `,
      beats: [
        { id: 'hello', say: 'Welcome to language models and pretraining.' },
        { id: 'rnn', say: 'Back in the RNN lecture, a small network read a few kilobytes of Shakespeare and learned to guess the next character.' },
        { id: 'same', say: 'Modern language models run the same recipe. The network is now a transformer, the characters are subword tokens, and the text is a large slice of the internet.', code: 'data' },
        { id: 'scale', say: '{GPT-3|G P T three}, in {2020|twenty twenty}, trained on about three hundred billion tokens.', code: 'data' },
        { id: 'name', say: 'This first stage is called pretraining: no labels, no particular task, just raw text.' },
        { id: 'goal', say: 'Its objective fits in one sentence: make the text you see as probable as possible, one token at a time.', code: 'loss' },
        { id: 'loop', say: 'In code, it is the training loop you already know.', code: 'step' },
        { id: 'plan', say: 'In this lecture we take that sentence apart, and see why such a simple goal teaches a network so much.' },
        { id: 'toy', say: 'To make every number exact, we will use a toy language whose true probabilities we know.', pause: 0.3 },
      ],
    },
    {
      id: 'next',
      title: 'A distribution over the next word',
      codeTitle: 'next_word.py',
      code: `
        VOCAB = [".", "the", "a", "big", ...]
        len(VOCAB)               # 36       #@vocab

        x = tokenize("the cat")             #@ctx
        logits = model(x)        # 36 scores  #@logits
        probs = softmax(logits)  # sum to 1   #@probs
      `,
      beats: [
        { id: 'lang', say: 'Here is the toy language. Thirty six words, and sentences like: the lazy cat chases a ball.' },
        { id: 'grammar', say: 'A small grammar with fixed probabilities writes them, so we know the exact chance of every next word.' },
        { id: 'vocab', say: 'These thirty six words are the vocabulary.', code: 'vocab' },
        { id: 'model', say: 'A language model reads the text so far, here, the cat, and returns one probability for every word in the vocabulary.', code: 'ctx' },
        { id: 'logits', say: 'Inside, it is the softmax classifier from linear classification: one score per word, called a logit,', code: 'logits' },
        { id: 'softmax', say: 'and a softmax that turns the scores into probabilities that add up to one.', code: 'probs' },
        { id: 'read', say: 'After the cat, this model expects a verb. Sleeps is the favorite, then sees, runs and chases.', code: 'probs' },
        { id: 'big', say: 'Real models do this with about fifty thousand tokens, so every prediction is a fifty thousand way classification.' },
      ],
    },
    {
      id: 'chain',
      title: 'The chain rule',
      codeTitle: 'chain_rule.py',
      code: `
        text = "the cat sleeps on the mat ."
        x = tokenize(text)
        prob, logp = 1.0, 0.0
        for t in range(len(x)):         #@loop
            probs = model(x[:t])        #@model
            prob *= probs[x[t]]         #@mul
            logp += np.log(probs[x[t]]) #@log
      `,
      beats: [
        { id: 'whole', say: 'One prediction is useful, but we want a probability for a whole text, to score, compare and generate texts.' },
        { id: 'rule', say: 'The chain rule of probability builds it from next-word predictions.', code: 'loop' },
        { id: 'first', say: 'The chance of this sentence is the chance that it starts with the, about sixty percent,', code: ['model', 'mul'] },
        { id: 'second', say: 'times the chance that cat follows the, about eight percent,', code: 'mul' },
        { id: 'third', say: 'times the chance that sleeps follows the cat, and so on. One factor for every word.', code: 'mul' },
        { id: 'exact', say: 'This is not an approximation: every distribution over texts can be written this way. So a model that predicts the next word well, everywhere, is a model of whole texts.' },
        { id: 'tiny', say: 'But look at the product. Seven factors, and it is already below one in a thousand. A thousand factors would underflow to zero.', code: 'mul' },
        { id: 'logs', say: 'So code adds logarithms instead. The log of a product is the sum of the logs, and the sum just walks steadily downward.', code: 'log' },
        { id: 'bad', say: 'Break the grammar, the cats sleeps, and one factor collapses below a tenth of a percent: the sentence becomes nearly three hundred times less likely than the cats sleep.', code: 'mul' },
      ],
    },
    {
      id: 'ngram',
      title: 'Counting: the n-gram model',
      codeTitle: 'trigram.py',
      code: `
        tri = Counter(zip(x, x[1:], x[2:]))  #@count
        bi = Counter(zip(x, x[1:]))          #@count

        def p_next(w, u, v):    # p(w | u v)  #@ratio
            return tri[u, v, w] / bi[u, v]   #@ratio
      `,
      beats: [
        { id: 'before', say: 'Before neural networks, language models were built by counting.' },
        { id: 'markov', say: 'An n-gram model assumes that the next word depends only on the last few words. A trigram looks at the last two.' },
        { id: 'scan', say: 'To estimate the chance of sleeps after the cat, scan the training text. The cat appears two hundred and fifty times.', code: 'count' },
        { id: 'next', say: 'Now count what came next. Sleeps came fifty times, so its probability is fifty out of two hundred and fifty: one in five.', code: 'ratio' },
        { id: 'dot', say: 'And a period came eighty times, because the cat is often an object, as in: the dog chases the cat.', code: 'ratio' },
        { id: 'mle', say: 'This ratio is not a rule of thumb: for a model that sees two words, it is exactly the probability that makes the training text most likely.' },
        { id: 'real', say: 'Its weakness is data. With fifty thousand words there are two and a half billion two-word contexts, and most longer contexts in a new sentence were never seen at all.' },
        { id: 'history', say: '{Shannon|Claude Shannon} generated text from counts like these in {1948|nineteen forty eight}. In {2003|two thousand and three}, Bengio and colleagues swapped the table for a neural network. The objective never changed.' },
      ],
    },
    {
      id: 'loss',
      title: 'Cross-entropy, one token at a time',
      codeTitle: 'lm_loss.py',
      code: `
        loss = 0.0
        for t in range(T):
            probs = model(x[:t])
            loss += -np.log(probs[x[t]])  #@surp
        loss /= T        # nats per token  #@mean
      `,
      beats: [
        { id: 'need', say: 'To train, we need one number that says how good the predictions are.' },
        { id: 'surprise', say: 'At each position, take the probability the model gave to the word that really came, and compute minus its log. Call it the surprise.', code: 'surp' },
        { id: 'curve', say: 'If the model was sure and right, the surprise is zero. If it gave the word almost nothing, the surprise is huge.', code: 'surp' },
        { id: 'avg', say: 'Average the surprise over every position, and you have the loss: the cross-entropy, measured in nats.', code: 'mean' },
        { id: 'same', say: 'It is the softmax loss from linear classification, applied at every position.' },
        { id: 'mle', say: 'Minimizing it makes the training text as probable as possible.' },
        { id: 'here', say: 'Our sentence costs this model about one nat per word.', code: 'mean' },
        { id: 'uniform', say: 'A model that knows nothing spreads its bets evenly and pays the log of the vocabulary size on every word: about three point six for our thirty six words.' },
      ],
    },
    {
      id: 'ppl',
      title: 'Perplexity and the floor',
      codeTitle: 'perplexity.py',
      code: `
        ppl = np.exp(loss)                   #@ppl

        nz = p_data > 0                      #@ce
        loss = -(p_data[nz]                  #@ce
                 * np.log(probs[nz])).sum()  #@ce
        floor = -(p_data[nz]                 #@floor
                  * np.log(p_data[nz])).sum()  #@floor
        kl = loss - floor     # never < 0    #@kl
      `,
      beats: [
        { id: 'hard', say: 'A loss in nats is hard to feel. Perplexity turns it back into a count.' },
        { id: 'def', say: 'Perplexity is e to the power of the loss.', code: 'ppl' },
        { id: 'faces', say: 'It is the effective number of choices. A perplexity of five means the model is as unsure as a fair five-sided die, at every word.', code: 'ppl' },
        { id: 'uniform', say: 'Uniform guessing over thirty six words gives exactly thirty six.', code: 'ppl' },
        { id: 'floor', say: 'But even a perfect model cannot reach one, because language itself is uncertain: after the big cat, five different verbs are fine.' },
        { id: 'pdata', say: 'Call the true distribution {p_data|p data}. A model that predicts something else pays the cross-entropy between the two.', code: 'ce' },
        { id: 'split', say: 'It splits into two parts. The entropy of the language, which no model can beat,', code: 'floor' },
        { id: 'kl', say: 'plus the {KL|K L} divergence, the extra cost of predicting the wrong distribution. It is zero only when the model matches the data.', code: 'kl' },
        { id: 'toy', say: 'For the toy language, we can compute the floor: about one point three nats per word, a perplexity of about three point six.' },
        { id: 'real', say: 'For real text, nobody knows the floor exactly; scaling laws estimate it.' },
      ],
    },
    {
      id: 'teacher',
      title: 'Teacher forcing',
      codeTitle: 'teacher_forcing.py',
      code: `
        chunk = tokens[i : i + T + 1]
        inputs = chunk[:-1]                #@shift
        targets = chunk[1:]   # shifted    #@shift
        logits = model(inputs)   # (T, V)  #@fwd
        loss = cross_entropy(logits,       #@loss
                             targets)      #@loss
      `,
      beats: [
        { id: 'how', say: 'How do we train on this loss? Cut the text into chunks. Feed a chunk in, and ask for the same chunk, shifted by one position.', code: 'shift' },
        { id: 'every', say: 'Every position becomes a prediction: position one predicts word two, and so on.', code: 'shift' },
        { id: 'forcing', say: 'At every position the model reads the true text, never its own guesses. That is teacher forcing.' },
        { id: 'parallel', say: 'With a transformer and a causal mask, all of these predictions come from one forward pass: a chunk of two thousand tokens is two thousand examples.', code: ['fwd', 'loss'] },
        { id: 'rnn', say: 'An RNN has to walk through the positions one by one. That parallelism helped transformers win.' },
        { id: 'exposure', say: 'One catch: in training, the model never sees its own mistakes, but when it generates, it reads nothing else. That mismatch is called exposure bias.' },
        { id: 'net', say: 'Here it is at work on the toy language: a small network that looks at the last few words.', code: 'loss' },
        { id: 'one', say: 'With one or two words of context, it lands next to the counting models that see the same words.' },
        { id: 'three', say: 'With three words, counting falls apart on new text: most three-word contexts were seen too rarely. The network keeps improving, because similar words share what they learn.' },
        { id: 'four', say: 'And with four words, it can tell a subject from an object, and it closes in on the floor.' },
      ],
    },
    {
      id: 'greedy',
      title: 'Decoding: greedy and temperature',
      codeTitle: 'generate.py',
      code: `
        x = tokenize("the")
        while not done(x):
            probs = model(x)               #@probs
            x.append(np.argmax(probs))     #@greedy

        z = np.log(probs) / temperature    #@temp
        q = np.exp(z) / np.exp(z).sum()    #@temp
        x.append(np.random.choice(V, p=q)) #@sample
      `,
      beats: [
        { id: 'loop', say: 'To generate, run the model in a loop: get the distribution, choose a word, append it, repeat.', code: 'probs' },
        { id: 'auto', say: 'Every word it writes becomes context for the next. The rule for choosing each word is the decoding strategy.', code: 'probs' },
        { id: 'greedy', say: 'The obvious rule takes the most likely word, every time. That is greedy decoding.', code: 'greedy' },
        { id: 'loops', say: 'And it is surprisingly bad. After the bird sleeps, it settles into the cat sleeps, the dog runs, over and over.', code: 'greedy' },
        { id: 'human', say: 'Human text is not the most likely text. It is a typical sample.' },
        { id: 'sample', say: 'So we sample instead: draw the next word at random, in proportion to its probability.', code: 'sample' },
        { id: 'tail', say: 'But sampling reproduces the model\'s mistakes. It spreads a little probability over many wrong words, and over a long text, those chances add up.', code: 'sample' },
        { id: 'temp', say: 'Temperature reshapes the distribution first. Divide the logits by {τ|tau} before the softmax.', code: 'temp' },
        { id: 'cold', say: 'Below one, the favorite grows and the tail shrinks. Near zero, sampling becomes greedy.', code: 'temp' },
        { id: 'hot', say: 'Above one, everything flattens, the tail swells, and the grammar breaks.', code: 'temp' },
      ],
    },
    {
      id: 'nucleus',
      title: 'Cutting the tail: top-k and top-p',
      codeTitle: 'top_k_top_p.py',
      code: `
        order = np.argsort(-probs)           #@sort
        keep = order[:top_k]                 #@topk
        cum = np.cumsum(probs[order])        #@topp
        n = np.searchsorted(cum, top_p) + 1  #@topp
        keep = order[:n]                     #@topp
        q = probs[keep] / probs[keep].sum()  #@norm
      `,
      beats: [
        { id: 'cut', say: 'Instead of reshaping everything, we can cut the unreliable tail off, and sample only from the head.', code: 'sort' },
        { id: 'topk', say: '{Top-k|Top k} keeps the k most likely words, and renormalizes.', code: 'topk' },
        { id: 'fit', say: 'But no single k fits every context. After the, a dozen words are fine. After the kids sleep on, only one is.', code: 'topk' },
        { id: 'five', say: 'With {k = 5|k equal to five}, the first list is cut too short, and the second keeps four forbidden words.', code: 'topk' },
        { id: 'topp', say: '{Top-p|Top p}, or nucleus sampling, from Holtzman and colleagues, keeps the smallest set of top words whose probabilities add up to at least p.', code: 'topp' },
        { id: 'adapt', say: 'So it adapts. Where the model is sure, the nucleus is a single word. Where many words fit, it keeps many.', code: ['topp', 'norm'] },
        { id: 'measure', say: 'To compare fairly, sample hundreds of sentences per setting. Up is quality: the share the grammar accepts. Right is diversity: how many words the sampler effectively chooses among.' },
        { id: 'plain', say: 'Plain sampling is diverse, but loses about a quarter of its sentences. Tighten any method, and quality rises while diversity falls.' },
        { id: 'lag', say: '{Top-k|Top k} lags, because a fixed k suits no context. Temperature and {top-p|top p} track each other closely here, and in practice they are combined.', code: 'norm' },
      ],
    },
    {
      id: 'bert',
      title: 'GPT versus BERT',
      codeTitle: 'objectives.py',
      code: `
        # GPT: causal mask, every position
        mask = np.tril(np.ones((T, T)))    #@gpt
        loss = ce(model(x[:-1]), x[1:])    #@gpt

        # BERT: hide 15%, predict them
        chosen = np.random.rand(T) < 0.15  #@bert
        inp = np.where(chosen, MASK, x)    #@bert
        loss = ce(model(inp)[chosen],      #@bert
                  x[chosen])               #@bert
      `,
      beats: [
        { id: 'two', say: 'In {2018|twenty eighteen}, two pretraining recipes appeared within months of each other.' },
        { id: 'gpt', say: '{GPT|G P T}, from OpenAI, is a decoder-only transformer trained exactly as we have seen: a causal mask, and a next-word loss at every position.', code: 'gpt' },
        { id: 'bert', say: 'BERT, from Google, argued that seeing only the left wastes half the context. In its encoder, every position attends to every other.' },
        { id: 'mlm', say: 'Its objective is masked language modeling. Hide fifteen percent of the tokens, and train the model to recover them from both sides.', code: 'bert' },
        { id: 'mix', say: 'Of the chosen tokens, eighty percent become a mask token, ten percent a random word, and ten percent stay put, so the model must represent every position well.', code: 'bert' },
        { id: 'easier', say: 'Seeing both sides makes a blank easier. In: the kids sleep in the park, hide kids. From the left alone, it costs about three point seven bits. With sleep on the right, the noun must be plural, and it costs two.', code: 'bert' },
        { id: 'signal', say: 'But only the hidden fifteen percent carry a loss, while {GPT|G P T} learns from every word, and can generate, left to right.', code: 'gpt' },
        { id: 'won', say: 'In the long run the field converged on {GPT|G P T} style decoders: every token teaches, and a model that writes can do any task phrased as text.' },
      ],
    },
    {
      id: 'compress',
      title: 'Prediction is compression',
      codeTitle: 'arithmetic_code.py',
      code: `
        lo, width = 0.0, 1.0
        for t in range(len(x)):
            probs = model(x[:t])              #@model
            lo += width * probs[:x[t]].sum()  #@zoom
            width *= probs[x[t]]              #@zoom
        bits = -np.log2(width)                #@bits
      `,
      beats: [
        { id: 'why', say: 'Why does guessing the next word teach so much? Pushing the loss down on a huge, varied text means capturing whatever makes it predictable: grammar, facts, arithmetic, code.' },
        { id: 'claim', say: 'There is a precise way to say this. A predictor is a compressor.' },
        { id: 'start', say: 'Arithmetic coding shows how. Start with the interval from zero to one.', code: 'model' },
        { id: 'slice', say: 'Cut it into slices, one per word, sized by the model\'s probabilities. Keep the slice of the word that actually came.', code: 'zoom' },
        { id: 'zoom', say: 'Zoom into that slice, and repeat for the next word.', code: 'zoom' },
        { id: 'width', say: 'The final width is the chain rule product, the probability of the sentence, and pointing inside it takes about minus log two of the width, in bits.', code: 'bits' },
        { id: 'size', say: 'So the compressed size is the loss, in bits. A better language model is, literally, a better compressor.', code: 'bits' },
        { id: 'numbers', say: 'Our sentence takes thirty six bits with a uniform model, about twenty with the n-gram, and fourteen with the true grammar. As plain text, two hundred and twenty four.' },
        { id: 'floor', say: 'The entropy is the smallest possible average size. Shannon estimated that people predicting English manage about one bit per character.' },
      ],
    },
    {
      id: 'icl',
      title: 'In-context learning',
      codeTitle: 'in_context.py',
      code: `
        post = dict(prior)                   #@prior
        for animal, answer in examples:      #@ex
            for task in post:                #@ex
                post[task] *= p_line(task,   #@ex
                         animal, answer)     #@ex
        post = normalize(post)               #@ex
        p_next = predict(post, "duck")       #@pred
      `,
      beats: [
        { id: 'gpt2', say: 'One more surprise. {GPT-2|G P T two} could attempt tasks it was never trained for, as long as they were written as text.' },
        { id: 'gpt3', say: '{GPT-3|G P T three}, with a hundred and seventy five billion parameters, made it systematic: a few examples of a task in the prompt, then a new input.' },
        { id: 'icl', say: 'No gradient step and no weight change: the model learns the task from its context. This is in-context learning, and prompting with examples is few-shot prompting.' },
        { id: 'why', say: 'Why would next-word training do this? The web is full of documents that set up a pattern and continue it. To predict their later lines, a model must work out which pattern it is in.' },
        { id: 'toy', say: 'Here is that argument at toy scale. The data mixes four kinds of animal lists: plurals, French, sounds and babies, with plurals the most common.', code: 'prior' },
        { id: 'zero', say: 'With no examples, the best guess for duck can only follow the prior. It bets on ducks.', code: 'pred' },
        { id: 'one', say: 'Add one French line: cat gives chat. The belief that this is a French list jumps from thirty percent to ninety nine.', code: 'ex' },
        { id: 'two', say: 'Now canard is the answer, at about ninety percent. The noise in the data caps it there.', code: 'pred' },
        { id: 'none', say: 'No weights changed. The prompt alone selected the task.' },
      ],
    },
    {
      id: 'outro',
      title: 'Recap',
      codeTitle: 'recap.py',
      code: `
        probs = model(x[:t])      # next word  #@pred
        loss = -np.log(probs[x[t]])  # surprise #@loss
        ppl = np.exp(loss.mean())  # choices   #@ppl
        x.append(sample(probs, top_p=0.9))     #@dec
      `,
      beats: [
        { id: 'recap', say: 'Let us put it all together.' },
        { id: 'r1', say: 'A language model gives a probability to every next token, and, by the chain rule, to every text.', code: 'pred' },
        { id: 'r2', say: 'Pretraining minimizes the average surprise, the cross-entropy, with teacher forcing, so every position of every chunk teaches.', code: 'loss' },
        { id: 'r3', say: 'Perplexity reads the loss as a number of choices, and no model can go below the entropy of the language.', code: 'ppl' },
        { id: 'r4', say: 'To generate, pick one token at a time: greedy repeats itself, plain sampling falls into the tail, and temperature and {top-p|top p} trade diversity for quality.', code: 'dec' },
        { id: 'r5', say: '{GPT\'s|G P T\'s} next-word objective beat BERT\'s masked words in the long run: every token teaches, and a generator can do any text task.' },
        { id: 'r6', say: 'And since good prediction is good compression of a huge corpus, the model absorbs facts and skills, and can infer a task from its prompt.' },
        { id: 'next', say: 'Next, scale: how that loss falls, smoothly and predictably, as the model, the data and the compute grow, and how to spend a budget.', pause: 0.6 },
      ],
    },
  ],
};

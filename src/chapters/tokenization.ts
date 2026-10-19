import type { ChapterDef } from './index';
import { TOKENIZATION_SYMBOLS } from '../lib/tokenization-symbols';
import { figByHand, figBytes, figEncode, figNumbers, figSlider, figThreeWays } from '../lib/tokenization-figs';
import { figEmbedSpace, figParams } from '../lib/tokenization-figs2';
import { installCss } from '../lib/tokenization-ui';

const chapter: ChapterDef = {
  symbols: TOKENIZATION_SYMBOLS,

  render(p) {
    installCss(p.root);

    p.prose(`
A transformer ([the last chapter](#/transformer)) maps a list of vectors to a list of vectors. Text is not vectors. It is a string of characters, typed in hundreds of languages, full of names, numbers, emoji, code and typos. This chapter is about the two ends of a language model that convert between the two:

- the **tokenizer** cuts text into pieces from a fixed list, the *vocabulary*, and replaces each piece with its position in that list: a whole number called a **token id**, written $\\symt$;
- the **embedding table** $\\symE$ turns each id into a vector $\\symx$ of $\\symd$ numbers the network can compute with;
- at the top, the **unembedding** $\\symU$ turns the network's final vector $\\symh$ back into one score per vocabulary entry, the logits $\\symz$, so the model can say which token comes next.

The tokenizer is the odd one out. It is not a neural network and it is not trained by gradient descent. It is built once, before the model, by a counting algorithm, and then frozen. Yet everything the model reads or writes passes through it, so its choices leak everywhere: how much text fits in the context window, what a training run costs, why models stumble on arithmetic and spelling, and why the same sentence costs more in Greek than in English.`);

    p.h2('Characters, words, or something in between', 'units');
    p.prose(`
The first decision is the unit. The two obvious choices both fail, in instructive ways.

**Characters.** The character model in [the RNN chapter](#/rnn) read text one character at a time. Its vocabulary is tiny (about a hundred symbols covers English), and no word is ever unknown. But sequences are long: this paragraph is over 400 characters. Every token is a step the model must take, and in a transformer every token attends to every earlier one, so attention work grows with the *square* of the length. The model also has to spend its early layers assembling letters into words, work a better unit would hand it for free.

**Words.** Splitting at spaces and punctuation makes English sequences roughly five times shorter. But the vocabulary explodes. *Run*, *runs*, *running*, *runner* and *rerun* become five unrelated entries, and with names, numbers and typos the list of word forms never ends. Each entry needs its own row of parameters, rare words occur too seldom to learn anything, and any word missing from the list turns into a single \`<unk>\` (unknown) token: the model cannot see what was there, let alone write it.

**Subwords** sit in between. Frequent words get a token of their own; rare words are spelled out of smaller pieces that are themselves frequent, like *light + houses* or *re + written*. Nothing is ever unknown, because the pieces go all the way down to single characters, or, as we will see, single bytes.`);

    figThreeWays(p);

    p.h2('The dial: vocabulary size against sequence length', 'tradeoff');
    p.prose(`
Every tokenizer sits somewhere on one dial. A bigger vocabulary lets each token cover more text, so sequences get shorter. A smaller vocabulary makes them longer. Both directions cost something.

- **Long sequences** cost compute and context. A model with a 4,096-token context window sees 4,096 tokens, however much text that turns out to be. Halve the text per token and the model sees half as much of your document, takes twice as many steps to write the same answer, and does about four times the attention work over it.
- **A big vocabulary** costs parameters and data. The embedding table has a row of $\\symd$ numbers for each of the $\\symV$ tokens, and so does the output layer. And every token has to appear often enough in training to earn a good vector; a vocabulary too large for its data fills up with tokens the model has barely seen.

The usual way to measure where a tokenizer sits is its **compression**: how many bytes of text one token covers, on average.`);

    p.math({
      label: 'Compression: text per token',
      tex: String.raw`r = \frac{\text{bytes of text}}{n \text{ tokens}}, \qquad \text{text in a context window} \approx r \cdot n_{\max} \text{ bytes}`,
      code: `
        text = open("keeper.txt").read()
        ids = encode(text)
        r = len(text.encode()) / len(ids)  # bytes/token
        print(r * 4096)  # bytes a 4,096-token window holds
      `,
      codeTitle: 'compression.py',
      terms: [
        ['n', 'how many tokens the tokenizer turned the text into'],
        [String.raw`r`, 'the compression ratio: bytes of text per token. Higher is better'],
        [String.raw`n_{\max}`, 'the context window: the most tokens the model can look at at once'],
        [String.raw`r \cdot n_{\max}`, 'so the amount of actual text the model can see is set by the tokenizer as much as by the model'],
      ],
      explain: `For plain English, OpenAI's rule of thumb for its tokenizers is about four characters per token, which is four bytes. A character-level model has $r = 1$ and sees a quarter as much text in the same window. The ratio also prices everything else: training and serving cost are paid per token, so a tokenizer that gets 20% more text into each token makes every step of the model's life 20% cheaper on that text.`,
    });

    p.h2('Byte-pair encoding', 'bpe');
    p.prose(`
How do we pick the subwords? The most widely used answer is **byte-pair encoding** (BPE). It began as a data-compression trick (Philip Gage, 1994) and was brought to neural machine translation by Sennrich, Haddow and Birch (2015), who wanted a translator that could handle rare words and names without an \`<unk>\`. GPT-2 (2019) made it byte-level, and the GPT and LLaMA families, among many others, use a version of it today.

The algorithm fits in one sentence: *start from single symbols, find the pair of neighbors that occurs most often, glue it into a new symbol, and repeat.* Each repetition adds one entry to the vocabulary and shortens the text. Frequent strings get glued early; rare ones stay in pieces.`);

    p.math({
      label: 'One BPE merge',
      tex: String.raw`(a^\ast, b^\ast) = \arg\max_{(a,\,b)} \operatorname{count}(a, b), \qquad a^\ast b^\ast \;\to\; 256 + k`,
      code: `
        stats = get_stats(ids)    # {(a, b): count}
        pair = max(stats, key=stats.get)  # top pair
        ids = merge(ids, pair, 256 + k)   # glue it
        merges[pair] = 256 + k    # remember the rule
      `,
      terms: [
        [String.raw`\operatorname{count}(a, b)`, 'how many times token $a$ is immediately followed by token $b$ in the training text'],
        [String.raw`\arg\max_{(a,\,b)}`, '"the pair that makes this largest". The *arg* means we want the pair itself, not its count'],
        [String.raw`256 + k`, 'the new token id. Ids 0 to 255 are the 256 possible bytes, so merge number $k$ (counting from 0) creates id $256 + k$'],
        [String.raw`a^\ast b^\ast \to 256 + k`, 'every occurrence of the pair, scanning left to right, is replaced by the new id'],
      ],
      explain: `BPE is a greedy compressor. Merging a pair that occurs 85 times shortens the text by (nearly always) 85 tokens, the biggest saving available at that moment, so vocabulary entries go exactly where they buy the most length. That is the whole training procedure: no gradients, no loss function, just counting. The number of merges is the one knob, and it sets the vocabulary size: $\\symV = 256 + {}$merges.`,
    });

    figByHand(p);

    p.prose(`
On a toy sentence BPE looks like a party trick. On real text it rediscovers the structure of the language with no rules given. Below it trains on a short story about a lighthouse keeper (1,575 bytes, written for this chapter). The first merges are the commonest letter pairs, then common words with their leading space (*␣the*, *␣and*), then whole words of the story (*␣keeper*, *␣night*), and finally phrases that happen to repeat.`);

    figSlider(p);

    p.callout('intuition', `Merges learned from the training text keep shrinking *that* text for as long as you add them, because late merges memorize phrases that occur only twice. On new text the gains flatten: a merge for *␣the␣wind* is useless in a story about something else. That is why production tokenizers are trained on large, varied samples of text, and why the vocabulary size is a choice: past some point, more merges only memorize.`, 'Learning or memorizing?');

    p.h2('Encoding and decoding', 'encode-decode');
    p.prose(`
Training leaves two things behind: the ordered list of merges, and the vocabulary, the bytes behind every id. Together they are the entire tokenizer.

**Encoding** new text replays the merges in the order they were learned. Start from the bytes, and repeatedly apply the *earliest-learned* merge that occurs anywhere, until none applies. Order matters because each merge was learned on text where all the earlier merges had already happened: a rule like *␣th + e → ␣the* only makes sense once *␣th* exists.`);

    p.math({
      label: 'Encoding: earliest merge first',
      tex: String.raw`(a, b) = \arg\min_{(a,\,b)\ \text{adjacent in}\ \symt_1 \dots \symt_n} \operatorname{rank}(a, b)`,
      code: `
        stats = get_stats(ids)   # pairs present
        rank = lambda p: merges.get(p, inf)
        pair = min(stats, key=rank)  # oldest rule
        if pair in merges:       # inf: never learned
            ids = merge(ids, pair, merges[pair])
      `,
      terms: [
        [String.raw`\symt_1, \dots, \symt_n`, 'the token ids so far, starting as the raw bytes'],
        [String.raw`(a,\,b)\ \text{adjacent}`, 'any pair of neighbors in that list'],
        [String.raw`\operatorname{rank}(a, b)`, 'when the pair was learned: merge $k$ has rank $k$, and a pair never learned has rank infinity'],
        [String.raw`\arg\min`, 'pick the pair with the smallest rank, the oldest rule that applies'],
      ],
      explain: `Encoding is a loop: find the oldest applicable rule, apply it everywhere, repeat. Since the merges dictionary stores the new id as the value, the id doubles as the rank: smaller ids were learned earlier. When no pair present has ever been merged, encoding stops; whatever is left, down to single bytes, is the answer.`,
    });

    p.prose(`**Decoding** is easier. Every id stands for a fixed string of bytes: the 256 base ids for themselves, and each merged id for the bytes of its two parts, joined. Look up the bytes of every id, concatenate them, and read the result as UTF-8 text.`);

    p.math({
      label: 'Decoding: ids back to bytes',
      tex: String.raw`\operatorname{bytes}(256 + k) = \operatorname{bytes}(a_k) \,\Vert\, \operatorname{bytes}(b_k), \qquad \text{text} = \operatorname{utf8}\Big(\big\Vert_{i}\, \operatorname{bytes}(\symt_i)\Big)`,
      code: `
        vocab = {i: bytes([i]) for i in range(256)}
        for (a, b), idx in merges.items():  # in order
            vocab[idx] = vocab[a] + vocab[b]
        data = b"".join(vocab[i] for i in ids)
        text = data.decode("utf-8", errors="replace")
      `,
      terms: [
        [String.raw`a_k, b_k`, 'the two tokens that merge $k$ glued together'],
        [String.raw`\Vert`, 'concatenation: write one byte string right after the other'],
        [String.raw`\big\Vert_i \operatorname{bytes}(\symt_i)`, 'the bytes of every token in the sequence, joined in order'],
        [String.raw`\operatorname{utf8}(\cdot)`, 'read the bytes as text. `errors="replace"` turns any invalid byte sequence into the symbol �'],
      ],
      explain: `Decoding can never fail on a sequence the encoder produced: it simply undoes the merges. But a model can *generate* any sequence of ids, including one that ends halfway through a multi-byte character, and then the bytes are not valid UTF-8. Hence \`errors="replace"\`; it is also why a streaming chat interface sometimes shows a � for a moment until the next token completes the character.`,
    });

    figEncode(p);

    p.prose(`
### Special tokens

Real vocabularies also hold a few **special tokens** that no merge produces. GPT-2's vocabulary of 50,257 entries is exactly 256 bytes, 50,000 merges, and one special token, \`<|endoftext|>\` (id 50,256), placed between documents in the training data so the model learns where one text ends and the next begins. Chat models add more of them to mark where each message starts and who wrote it (more in [fine-tuning](#/finetuning)). Code inserts them by id. If a user types the characters \`<|endoftext|>\`, a careful tokenizer encodes them as ordinary text, so nobody can forge a special token from the keyboard.`);

    p.h2('Bytes, not characters', 'bytes');
    p.prose(`
Sennrich's BPE started from characters, which brings the unknown-symbol problem back one level down. Unicode defines well over 150,000 characters (every script, plus emoji and symbols), far too many for a base vocabulary, and any character left out becomes \`<unk>\` again.

**Byte-level BPE** (GPT-2, 2019) starts lower. Computers store text as bytes, almost always in **UTF-8**, which writes each character as 1 to 4 bytes, and a byte has only 256 possible values. Start BPE from those 256 and the base vocabulary covers every string that can ever be typed, in any language, with no \`<unk>\` at all. How many bytes a character takes depends on its **code point**, its number in the Unicode table:`);

    p.math({
      label: 'UTF-8: bytes per character',
      tex: String.raw`\operatorname{bytes}(c) = \begin{cases} 1 & c < 128 \quad \text{(ASCII)} \\ 2 & c < 2{,}048 \\ 3 & c < 65{,}536 \\ 4 & \text{otherwise} \end{cases}`,
      code: `
        def utf8_len(c):     # c = ord(ch)
            if c < 0x80:    return 1  # ASCII
            if c < 0x800:   return 2  # é, Greek, Russian
            if c < 0x10000: return 3  # most Chinese
            return 4                  # emoji
        utf8_len(ord("é")) == len("é".encode())  # True
      `,
      codeTitle: 'utf8_len.py',
      terms: [
        [String.raw`c`, "the character's code point: `ord('A')` is 65, `ord('é')` is 233, `ord('你')` is 20,320"],
        [String.raw`c < 128`, 'the first 128 code points are ASCII, and UTF-8 stores them as one byte, unchanged'],
        [String.raw`2, 3, 4`, 'larger code points need more bytes, since each byte carries only part of the number'],
      ],
      explain: `UTF-8 was designed so that plain English text is byte-for-byte identical to old ASCII files. Everything else pays more: two bytes per letter for Greek or Russian, three for Chinese, four for most emoji. For a byte-level tokenizer this is the starting length before any merge, so a script the merges never covered stays two or three tokens per character.`,
    });

    figBytes(p);

    p.prose(`
### Chunks first: the GPT-2 split

Run BPE on raw bytes and merges cross word boundaries freely. In the toy example \`at,␣\` became a token, and on web text you would get separate entries for *dog.*, *dog!* and *dog?*, spending the vocabulary on punctuation combinations. GPT-2 avoids this by first cutting text into chunks with a regular expression; BPE then counts and merges only *inside* a chunk. The pattern keeps runs of letters together, runs of digits together and runs of other symbols together, attaches at most one leading space to each, and splits off common English contractions:`);

    p.code(`
      import regex as re      # the standard re lacks \\p{...} classes
      GPT2_SPLIT = (r"""'s|'t|'re|'ve|'m|'ll|'d| ?\\p{L}+| ?\\p{N}+"""
                    r"""| ?[^\\s\\p{L}\\p{N}]+|\\s+(?!\\S)|\\s+""")
      re.findall(GPT2_SPLIT, "The keeper's log, 1901!")
      # ['The', ' keeper', "'s", ' log', ',', ' 1901', '!']
    `, { title: 'gpt2_split.py' });

    p.prose(`\`\\p{L}\` matches any letter in any script and \`\\p{N}\` any digit. The toggle in the merge-slider figure above switches this split on and off: without it, merges memorize cross-word phrases that do not transfer to new text. One side effect is worth remembering: because a space travels with the word after it, \`␣the\` and \`the\` are different tokens.`);

    p.callout('warning', `A tokenizer's merges follow its training text. If that text is mostly English, English words become single tokens while other languages, especially in non-Latin scripts, stay split into small pieces. The same sentence can then cost several times more tokens: higher prices per message, less text in the context window, and less meaning per training step (Petrov et al., 2023, measured these gaps across many languages). Multilingual tokenizers fight this with more balanced training text and bigger vocabularies.`, 'Not every language pays the same');

    p.h2('Tokenization quirks', 'quirks');
    p.prose(`
The model never sees letters, only ids. Several behaviors that look like failures of intelligence are really artifacts of that.

- **Spaces belong to words.** \`␣the\`, \`the\`, \`␣The\` and \`The\` are four different tokens with four unrelated ids, and the model must learn from data that they are the same word. A prompt that ends with a space is awkward too: in training text that space was nearly always glued to the front of the next word, so a lone trailing space is a rare token in an odd spot.
- **Case.** *keeper*, *Keeper* and *KEEPER* can tokenize completely differently (try them in the encoding figure).
- **Spelling.** Ask how many r's are in *strawberry*, and the model sees two or three tokens, not ten letters. To answer, it must have learned the spelling of each token, a fact that only shows up indirectly in its training text.
- **Numbers.** GPT-2's merges treated digits like letters: frequent numbers such as recent years became single tokens, and others split wherever earlier merges happened to fall, so the same digit can sit in tokens of different sizes from one number to the next. Later tokenizers fixed a policy instead: GPT-4's splits digit runs into chunks of at most three, and LLaMA and LLaMA 2 split every number into single digits.
- **Glitch tokens.** A token can exist in the vocabulary yet almost never occur in the *model's* training data, if the tokenizer was trained on different text. Its embedding then barely moves from its random start. The best-known case, \`␣SolidGoldMagikarp\` (a username that was common in the tokenizer's training text), made GPT-3-era models produce bizarre replies when asked to repeat it, as researchers found in early 2023.`);

    figNumbers(p);

    p.prose(`
### The family

BPE is not the only subword method. **WordPiece** (used by BERT, 2018) also builds the vocabulary by merging, but picks the merge that most increases the likelihood of the training text rather than the most frequent pair. The **unigram** method (Kudo, 2018) works the other way around: start from a large set of candidate pieces and prune the ones that matter least. The **SentencePiece** library (Kudo and Richardson, 2018) runs BPE or unigram directly on raw text, treating the space as an ordinary symbol (written ▁); the LLaMA and LLaMA 2 tokenizers were built with it. The sizes have grown over time:`);

    p.table(
      ['Tokenizer', 'Year', 'Vocabulary $\\symV$', 'Method'],
      [
        ['BERT (base)', '2018', '30,522', 'WordPiece'],
        ['GPT-2', '2019', '50,257', 'byte-level BPE with the regex split'],
        ['LLaMA, LLaMA 2', '2023', '32,000', 'SentencePiece BPE, digits split, unknown characters fall back to bytes'],
        ['GPT-4 (cl100k)', '2023', 'about 100,000', 'byte-level BPE, digits in chunks of up to three'],
        ['LLaMA 3', '2024', 'about 128,000', 'byte-level BPE'],
        ['GPT-4o (o200k)', '2024', 'about 200,000', 'byte-level BPE'],
      ],
      { caption: 'Bigger models can afford bigger vocabularies: the table becomes a smaller share of the parameters, and better compression shortens every sequence, especially for code and non-English text.' },
    );

    p.h2('Embeddings: a table of vectors', 'embeddings');
    p.prose(`
After tokenization the model holds a list of integers. An integer by itself is a poor input: token 1,000 is not "more" than token 999, and neighboring ids say nothing about meaning. So the first layer of every language model is a lookup table, the **embedding matrix** $\\symE$, with one row of $\\symd$ learned numbers for each of the $\\symV$ tokens. Token $\\symt$ becomes the vector $\\symx = \\symE[\\symt]$: its row.`);

    p.math({
      label: 'Embedding lookup',
      tex: String.raw`\symx = \symE[\symt] = \operatorname{onehot}(\symt)^{\top}\,\symE`,
      code: `
        V, d = 427, 16
        E = 0.02 * np.random.randn(V, d)  # learned
        ids = np.array([84, 371, 263])  # three ids
        x = E[ids]               # (3, d): one row each
        onehot = np.eye(V)[ids]  # (3, V)
        np.allclose(onehot @ E, x)  # True
      `,
      codeTitle: 'embedding.py',
      terms: [
        [String.raw`\symE`, 'the table: $\\symV$ rows, $\\symd$ columns. Row $\\symt$ belongs to token $\\symt$'],
        [String.raw`\symE[\symt]`, 'pick out row $\\symt$: a vector of $\\symd$ numbers'],
        [String.raw`\operatorname{onehot}(\symt)`, 'a vector of $\\symV$ zeros with a single 1 at position $\\symt$'],
        [String.raw`\operatorname{onehot}(\symt)^{\top}\symE`, 'that vector times the matrix: every row gets multiplied by 0 except row $\\symt$, so the product is exactly row $\\symt$'],
      ],
      explain: `Writing the lookup as a matrix product shows that it is an ordinary linear layer whose input happens to be one-hot. So [backpropagation](#/backprop) trains it like any other weight. Its gradient is zero everywhere except the rows of tokens that were in the batch, and in code that is a scatter-add (\`np.add.at(dE, ids, dx)\`). Nobody actually builds the one-hot vectors: indexing gives the same answer without multiplying by thousands of zeros.`,
    });

    p.prose(`
What do the rows learn? Nobody tells the table anything except, through backprop, how to lower the loss. Tokens that appear in similar contexts receive similar gradients, so they drift toward similar vectors, because swapping one for the other would change the predictions very little. With $\\symd$ in the thousands, directions in this space come to line up with meaning: topic, grammatical role, language, sentiment.

The table knows nothing about *where* a token sits: \`E[ids]\` gives the same row for a word at position 3 or position 300. Order comes from positional information added on top ([sinusoids in the Transformer chapter](#/transformer), rotary embeddings in [the modern block](#/modern-transformer)).

The figure below makes this concrete with the smallest language model there is: a 2-D embedding, one 2 × 2 matrix standing in for the whole transformer, and an unembedding to scores, trained live on a tiny language.`);

    figEmbedSpace(p);

    p.callout('history', `Embedding words as learned vectors predates transformers. Bengio and colleagues' neural language model (2003) learned a word table jointly with a next-word predictor, much like the figure above. **Word2vec** (Mikolov and colleagues, 2013) trained word vectors alone, cheaply, on billions of words, and found that differences between vectors capture relations: the vector for *king* minus *man* plus *woman* lands near *queen*. A transformer's embedding table is the same object, now one layer of a much larger network and indexed by subword tokens instead of words.`, 'Where embeddings came from');

    p.h2('The unembedding: back to the vocabulary', 'unembedding');
    p.prose(`
At the top of the stack, the transformer hands back one vector $\\symh$ of $\\symd$ numbers per position. To predict the next token, that vector must become a score for every one of the $\\symV$ tokens. This is a linear layer, $\\symz = \\symh\\symU$, with $\\symU$ of shape $\\symd \\times \\symV$, followed by a softmax.

Look closely and it is an old friend: a [linear classifier with a softmax](#/linear-classification), where the classes are the tokens. The last layer of GPT-2 is a softmax classifier with 50,257 classes, sitting on top of features that twelve transformer blocks computed.`);

    p.math({
      label: 'Unembedding: a vector to next-token probabilities',
      tex: String.raw`\symz = \symh\,\symU, \qquad p_j = \frac{e^{\symz_j}}{\sum_{k=1}^{\symV} e^{\symz_k}}`,
      code: `
        h = hidden[-1]       # (d,) last position
        logits = h @ U       # (V,) score per token
        p = np.exp(logits - logits.max())
        p /= p.sum()         # probabilities
        next_id = p.argmax() # or sample (next chapter)
      `,
      codeTitle: 'unembed.py',
      terms: [
        [String.raw`\symh`, 'the final hidden vector at one position, $\\symd$ numbers'],
        [String.raw`\symU`, 'the unembedding, $\\symd$ rows by $\\symV$ columns: column $j$ is an *output vector* for token $j$'],
        [String.raw`\symz_j`, 'the logit of token $j$: the dot product of $\\symh$ with column $j$. Large when $\\symh$ points the same way'],
        [String.raw`p_j`, 'softmax: exponentiate every logit and divide by the total, giving probabilities that add up to 1'],
      ],
      explain: `Each column of $\\symU$ is a direction in the model's $\\symd$-dimensional space, one per token, and the network's whole job, layer after layer, is to steer $\\symh$ toward the output vectors of plausible next tokens. Training ([next chapter](#/pretraining)) applies cross-entropy to these probabilities at every position at once. This layer is not cheap: it is a $\\symd \\times \\symV$ multiply at every position, and with a big vocabulary the logits ($\\symV$ numbers per position) are among the largest arrays a training step creates.`,
    });

    p.h2('Weight tying', 'tying');
    p.prose(`
Put the two tables side by side. $\\symE$ has one row per token; $\\symU$ has one column per token. Both hold a $\\symd$-dimensional vector for every token in the same space. **Weight tying** uses a single matrix for both jobs: $\\symU = \\symE^{\\top}$ (Press and Wolf, 2017; Inan, Khosravi and Socher, 2017). The original Transformer shared its embedding and pre-softmax weights this way, and GPT-2 does too.`);

    p.math({
      label: 'Tied input and output embeddings',
      tex: String.raw`\symU = \symE^{\top} \quad\Longrightarrow\quad \symz_j = \symh \cdot \symE_j`,
      code: `
        x = E[ids]               # in:  row t of E
        h = transformer(x)       # (n, d)
        logits = h @ E.T         # out: same rows
      `,
      codeTitle: 'tied.py',
      terms: [
        [String.raw`\symE^{\top}`, 'the transpose of $\\symE$: rows become columns, so it has shape $\\symd \\times \\symV$, exactly the shape of $\\symU$'],
        [String.raw`\symE_j`, "row $j$ of $\\symE$: token $j$'s embedding"],
        [String.raw`\symh \cdot \symE_j`, 'the score for token $j$ is how well $\\symh$ lines up with the very vector that represents $j$ as an input'],
      ],
      explain: `Tying saves $\\symV\\symd$ parameters, a third of GPT-2 small. It also helps rare tokens. An input row only gets a gradient when its token appears in the batch, but an output vector gets one at *every* position, because the softmax nudges every wrong token's score down a little. Tied, those constant nudges train the input vectors of rare tokens too. The cost is a compromise: an input vector should say what a token *is*, an output vector in which contexts it comes *next*, and one vector has to do both. Large models, where the table is a small share, often keep them separate (the larger LLaMA models do); small models, where it is a big share, often tie.`,
    });

    p.prose(`How big a share? The two tables hold $\\symV\\symd$ numbers each, while each transformer block holds about $12\\symd^2$. The vocabulary's share therefore shrinks as models get wider and deeper, and grows with the vocabulary.`);

    p.math({
      label: 'Where the parameters are',
      tex: String.raw`\text{params} \approx \underbrace{\symV\symd}_{\symE} + \underbrace{\symV\symd}_{\symU \text{ (0 if tied)}} + \underbrace{12\,L\,\symd^{2}}_{L \text{ blocks}}`,
      code: `
        V, d, L = 50257, 768, 12  # GPT-2 small
        embed = V * d             # 38.6 million
        blocks = L * 12 * d * d   # 84.9 million
        embed / (embed + blocks)  # 0.31, tied
      `,
      terms: [
        [String.raw`\symV\symd`, 'one table: a row of $\\symd$ numbers for each of $\\symV$ tokens'],
        [String.raw`12\,L\,\symd^2`, '$L$ transformer blocks of about $12\\symd^2$ each: $4\\symd^2$ for attention and $8\\symd^2$ for the MLP'],
      ],
      explain: `The table grows like $\\symd$ while the blocks grow like $\\symd^2$ times the depth, so doubling a model's width doubles its table but quadruples each block. This is the arithmetic behind the table of tokenizers above: as models grew, vocabularies of 100,000 to 200,000 tokens became affordable, and the shorter sequences they give pay for themselves.`,
    });

    figParams(p);

    p.callout('idea', `
- Models read token ids, not text. Subword tokenizers sit between characters (long sequences) and words (huge vocabularies with \`<unk>\`).
- **BPE** learns its vocabulary by counting: merge the most frequent adjacent pair, repeat. Encoding replays the merges in learned order; decoding concatenates bytes.
- **Byte-level** BPE starts from the 256 byte values, so nothing is ever unknown; a regex split keeps merges inside words, numbers and punctuation runs.
- Tokenization explains many quirks: spaces glued to words, inconsistent numbers, trouble with spelling, and higher costs for languages the tokenizer saw little of.
- The **embedding** $\\symE$ is a lookup table trained by backprop. The **unembedding** $\\symU$ is a softmax classifier over the vocabulary. **Weight tying** sets $\\symU = \\symE^{\\top}$, saving $\\symV\\symd$ parameters.`, 'Takeaways');

    p.h2('Build it yourself', 'exercises');
    p.prose(`
1. **UTF-8 by hand (10 minutes).** In Python, print \`list(s.encode("utf-8"))\` for \`"a"\`, \`"é"\`, \`"你"\` and \`"🌊"\`. Write \`utf8_len(c)\` from the equation above and check it against \`len(ch.encode("utf-8"))\` for every character of a paragraph in three languages. Then decode \`"你".encode("utf-8")[:2]\` with \`errors="replace"\` and explain the output. *Success:* your function agrees on every character, and you can say why a half character decodes to �.
2. **A BPE trainer in 40 lines.** Write \`get_stats\`, \`merge\`, \`train(text, vocab_size)\`, \`encode\` and \`decode\` from this chapter's listings. Train on a public-domain book (Project Gutenberg has thousands) up to a vocabulary of 1,000. Print the first 30 merges and the 30 longest tokens. *Success:* \`decode(encode(s)) == s\` for random strings, including emoji and other scripts, and the longest tokens are recognizable words of the book.
3. **The split and the dial.** Add the GPT-2 regex split (with the \`regex\` package) to your trainer. Hold out the last 10% of the book, then plot bytes per token on the held-out text against vocabulary size, from 256 to 8,000, with and without the split. *Success:* two curves; you can say where extra merges stop paying for themselves and which version generalizes better.
4. **Embeddings are a matmul.** With NumPy, check that \`np.eye(V)[ids] @ E\` equals \`E[ids]\`. Write the backward pass of the lookup with \`np.add.at\` and check it against a numerical gradient (as in [the optimization chapter](#/optimization)). What happens to the gradient of a row whose token appears twice in \`ids\`? *Success:* the gradient check passes, and the repeated token's row receives the sum of both gradients.
5. **Project: a tied bigram model on your tokens.** Using your tokenizer from exercise 2 (vocabulary around 500), train the model from the 2-D figure in NumPy: \`logits = E[ids] @ W @ U + b\` predicting the next token, with $\\symd$ = 32, cross-entropy loss and Adam. Train once with a separate $\\symU$ and once with $\\symU$ = \`E.T\`, and compare held-out loss and parameter counts. Then project the embeddings to 2-D with PCA and look at what lands together. *Success:* both models beat the unigram baseline on held-out text, and you can report which one wins at your data size and how many parameters tying saved.`);
  },
};

export default chapter;

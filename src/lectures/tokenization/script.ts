import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'tokenization',
  title: 'Tokens and embeddings',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'Text in, numbers inside',
      codeTitle: 'pipeline.py',
      code: `
        text = "the keeper lit the"  #@text
        ids = encode(text)    # tokenizer  #@tok
        x = E[ids]            # embedding  #@emb
        h = transformer(x)    # chapter 2  #@tf
        logits = h @ U        # unembed    #@unemb
        next_id = logits[-1].argmax()      #@next
        print(decode([next_id]))           #@next
      `,
      beats: [
        { id: 'hello', say: 'This lecture is about the two ends of a language model: where text goes in, and where text comes out.', code: 'text' },
        { id: 'vectors', say: 'The transformer from the last chapter turns a list of vectors into a list of vectors. But text is not vectors.', code: 'tf' },
        { id: 'tok', say: 'So first, a tokenizer cuts the text into pieces from a fixed list, the vocabulary, and replaces each piece with its number in that list.', code: 'tok' },
        { id: 'emb', say: 'Then an embedding table turns each id into a vector, simply by looking up one row.', code: 'emb' },
        { id: 'tf', say: 'The transformer works on those vectors, and hands back one vector per position.', code: 'tf' },
        { id: 'unemb', say: 'At the top, the unembedding turns the last vector into a score for every token in the vocabulary.', code: 'unemb' },
        { id: 'next', say: 'The best score, or a random draw, is the next token, and decoding turns it back into text.', code: 'next' },
        { id: 'odd', say: 'Of these pieces, the tokenizer is the odd one out. It is not a neural network, and gradient descent never touches it.', code: 'tok' },
        { id: 'leak', say: 'It is built once, by counting, then frozen. Yet everything the model reads or writes passes through it.', code: 'tok' },
      ],
    },
    {
      id: 'units',
      title: 'Characters, words or subwords',
      codeTitle: 'three_ways.py',
      code: `
        s = "The lighthouses were rewritten"
        s += " by machines."
        chars = list(s)            # 43  #@chars
        words = re.findall(r"\\w+|\\S", s) #@words
        # 7 words, 3 of them <unk>       #@unk
        ids = bpe.encode(s)        # 19  #@sub
        # V: 48 chars, 150 words, 427 BPE #@V
      `,
      beats: [
        { id: 'first', say: 'The first decision is the unit. The two obvious choices, characters and words, both fail, in instructive ways.', code: ['chars', 'words'] },
        { id: 'chars', say: 'Characters, like the character model in the {RNN|R N N} chapter, need a tiny vocabulary, and no word is ever unknown.', code: 'chars' },
        { id: 'long', say: 'But sequences get long. This one sentence is {43|forty three} characters.', code: 'chars' },
        { id: 'square', say: 'And in a transformer, every token attends to every earlier one, so the work grows with the square of the length.', code: 'chars' },
        { id: 'words', say: 'Words make sequences short: just seven tokens here.', code: 'words' },
        { id: 'explode', say: 'But the vocabulary explodes. Run, runs, running and runner are four unrelated entries, and the list of word forms never ends.', code: 'words' },
        { id: 'unk', say: 'Worse, any word missing from the list becomes a single unknown token. Three of these seven words are simply lost.', code: 'unk' },
        { id: 'sub', say: 'Subwords sit in between. Frequent words get a token of their own, and rare words are spelled out of frequent pieces.', code: 'sub' },
        { id: 'pieces', say: 'Lighthouses becomes lighthouse, plus an s. Nothing is ever unknown, because the pieces go all the way down to single bytes.', code: 'sub' },
        { id: 'dial', say: 'So every tokenizer sets one dial. A bigger vocabulary means shorter sequences, and a smaller one means longer sequences.', code: 'V' },
        { id: 'costs', say: 'Long sequences cost compute and context. A big vocabulary costs parameters, and data to train every entry.', code: 'V' },
      ],
    },
    {
      id: 'bpe',
      title: 'Byte-pair encoding, by hand',
      codeTitle: 'bpe_train.py',
      code: `
        text = ("the hat, the cat, "
                "that hat, the bat")
        ids = list(text.encode("utf-8"))  #@init
        merges = {}
        for k in range(8):
            stats = get_stats(ids)        #@count
            pair = max(stats, key=stats.get)  #@count
            ids = merge(ids, pair, 256 + k)   #@merge
            merges[pair] = 256 + k        #@merge
        # k = {{k:0}}   pair = {{pair:…}}
        # len(ids) = {{n:35}}
      `,
      beats: [
        { id: 'name', say: 'The most widely used way to choose subwords is byte-pair encoding, or {BPE|B P E}.', code: 'init' },
        { id: 'history', say: 'It began as a compression trick in {1994|nineteen ninety four}, came to machine translation in {2015|twenty fifteen}, and {GPT-2|G P T two} made it work on raw bytes in {2019|twenty nineteen}.' },
        { id: 'one', say: 'The whole algorithm fits in one sentence: find the most frequent pair of neighbors, glue it into a new symbol, and repeat.', code: ['count', 'merge'] },
        { id: 'start', say: 'Take a tiny text: the hat, the cat, that hat, the bat. As bytes, it is {35|thirty five} tokens, each a number below {256|two hundred and fifty six}.', code: 'init' },
        { id: 'count', say: 'Count every pair of neighbors. {a, t|Ay, then tee,} appear together five times, more than any other pair.', code: 'count' },
        { id: 'glue', say: 'So {at|ay tee} becomes token {256|two hundred and fifty six}, and every occurrence is replaced. {35|Thirty five} tokens become thirty.', code: 'merge' },
        { id: 'th', say: 'Count again. Now {t, h|tee, aitch,} wins with four, and becomes token {257|two hundred and fifty seven}.', code: ['count', 'merge'] },
        { id: 'the', say: 'Then the new token {th|tee aitch}, followed by {e|an ee}, becomes {the|tee aitch ee}, token {258|two hundred and fifty eight}.', code: ['count', 'merge'] },
        { id: 'on', say: 'Each merge adds one entry to the vocabulary and shortens the text. The most frequent strings get glued first.', code: 'merge' },
        { id: 'cross', say: 'Keep going, and merges start to cross spaces and commas: {at,␣|ay tee, comma, space} becomes one token.', code: 'merge' },
        { id: 'end', say: 'After eight merges the text is ten tokens long, and no pair occurs twice, so training stops.', code: 'merge' },
        { id: 'greedy', say: 'That is all of training: no gradients, no loss, just counting. The number of merges sets the vocabulary size.', code: 'init' },
      ],
    },
    {
      id: 'page',
      title: 'Training on a page',
      codeTitle: 'bpe_page.py',
      code: `
        chunks = re.findall(GPT2_SPLIT, text)  #@split
        ids = [list(c.encode()) for c in chunks]
        for k in range({{k:0}}):          #@loop
            stats = {}
            for c in ids:
                get_stats(c, stats)       #@loop
            pair = max(stats, key=stats.get)
            ids = [merge(c, pair, 256 + k)
                   for c in ids]          #@loop
        V = 256 + k   # {{V:256}}         #@V
        n = sum(len(c) for c in ids)      #@n
        # n = {{n:1575}} tokens           #@n
      `,
      beats: [
        { id: 'real', say: 'On a real page of text, {BPE|B P E} rediscovers the structure of the language, with no rules given.', code: 'loop' },
        { id: 'story', say: 'Here it trains on a short story about a lighthouse keeper: {1,575|one thousand, five hundred and seventy five} bytes.', code: 'n' },
        { id: 'early', say: 'The first merges are common pairs, {he|aitch ee} and {␣t|space tee}, then {␣the|space the}, with its leading space.', code: 'loop' },
        { id: 'words', say: 'Soon whole words of the story become single tokens: keeper, night, wind.', code: 'loop' },
        { id: 'curve', say: "The blue curve is the text's length, in tokens per byte. It falls fast at first, then slowly.", code: 'n' },
        { id: 'dial', say: 'Every merge moves the dial one notch: the vocabulary grows by one, and the text shrinks.', code: ['V', 'n'] },
        { id: 'end', say: 'After {171|a hundred and seventy one} merges, no pair occurs twice. The vocabulary is {427|four hundred and twenty seven}, and a token averages about three bytes.', code: ['V', 'n'] },
        { id: 'new', say: 'The purple curve is new text in the same style, which training never saw. It falls too.', code: 'n' },
        { id: 'memorize', say: 'But the last merges memorize words that occur only twice, like eleven and thousand. In a text about anything else, those slots are wasted.', code: 'loop' },
        { id: 'split', say: 'Notice that every token stays inside one word. Before counting, the text is split into words, and merges never cross that line.', code: 'split' },
        { id: 'scale', say: 'Real tokenizers train on huge, varied text, so every merge earns its slot.', code: 'loop' },
      ],
    },
    {
      id: 'encode',
      title: 'Encoding and decoding',
      codeTitle: 'bpe_encode.py',
      code: `
        def encode_chunk(ids):
            while len(ids) >= 2:
                stats = get_stats(ids)
                pair = min(stats, key=rank)  #@pick
                if pair not in merges:
                    break                    #@done
                ids = merge(ids, pair,
                            merges[pair])    #@apply
            return ids

        def decode(ids):
            data = b"".join(vocab[i]
                            for i in ids)    #@join
            return data.decode("utf-8",
                        errors="replace")    #@join
      `,
      beats: [
        { id: 'two', say: 'Training leaves two things behind: the ordered list of merges, and the bytes behind every id. Together, they are the whole tokenizer.' },
        { id: 'replay', say: 'To encode new text, start from its bytes, and replay the merges in the order they were learned.', code: ['pick', 'apply'] },
        { id: 'oldest', say: 'At every step, find the earliest learned merge that applies anywhere, and apply it everywhere.', code: 'pick' },
        { id: 'why', say: 'Order matters. {␣wrote|Space wrote} is glued from {␣wro|space, double-u, ar, oh,} and {te|tee ee}, so that rule can only fire once both pieces exist.', code: 'pick' },
        { id: 'watch', say: 'Watch: the keeper wrote it down. {24|Twenty four} bytes become six tokens, one merge at a time.', code: 'apply' },
        { id: 'stop', say: 'When no pair in the text was ever learned, encoding stops. Whatever is left is the answer.', code: 'done' },
        { id: 'decode', say: 'Decoding is simpler. Each id stands for fixed bytes: look them up, join them, and read the bytes as text.', code: 'join' },
        { id: 'space', say: 'One surprise. The story always put a space before lighthouse, so {␣lighthouse|space lighthouse} is a single token, while lighthouse without the space takes five.', code: 'pick' },
        { id: 'special', say: "Real vocabularies also hold special tokens that no merge can make. {GPT-2|G P T two}'s end of text token marks where one document stops and the next begins." },
        { id: 'gpt2', say: "So {GPT-2|G P T two}'s vocabulary of {50,257|fifty thousand, two hundred and fifty seven} is {256|two hundred and fifty six} bytes, {50,000|fifty thousand} merges, and that one special token." },
      ],
    },
    {
      id: 'bytes',
      title: 'Bytes, not characters',
      codeTitle: 'utf8.py',
      code: `
        def utf8_len(c):       # c = ord(ch)
            if c < 0x80: return 1      #@b1
            if c < 0x800: return 2     #@b2
            if c < 0x10000: return 3   #@b3
            return 4                   #@b4

        s = "καλημέρα"                 #@greek
        len(s), len(s.encode())  # 8, 16   #@greek
        len(encode(s))           # 16  #@tok
      `,
      beats: [
        { id: 'problem', say: 'Starting {BPE|B P E} from characters brings the unknown token back. Unicode defines more than {150,000|a hundred and fifty thousand} characters, far too many to list.' },
        { id: 'bytes', say: 'So {GPT-2|G P T two} starts one level lower, from bytes. Computers store text as {UTF-8|U T F eight}, which writes every character as one to four bytes.', code: ['b1', 'b2', 'b3', 'b4'] },
        { id: 'base', say: 'A byte has only {256|two hundred and fifty six} possible values. Start from those, and every string ever typed can be encoded. No unknown token, ever.' },
        { id: 'ascii', say: 'English letters take one byte each, exactly as in old {ASCII|ask-ee} files.', code: 'b1' },
        { id: 'two', say: 'Accented letters, Greek, and Russian take two bytes per character.', code: 'b2' },
        { id: 'three', say: 'Chinese characters take three bytes, and most emoji take four.', code: ['b3', 'b4'] },
        { id: 'cost', say: 'Here is the catch. Merges follow the text the tokenizer trained on, and ours only ever saw English.', code: 'tok' },
        { id: 'greek', say: 'So the Greek word for good morning, eight letters, stays sixteen tokens: one per byte, two per letter.', code: ['greek', 'tok'] },
        { id: 'unfair', say: 'Real tokenizers trained mostly on English show a milder form of this: other languages pay more tokens for the same meaning.', code: 'tok' },
        { id: 'fix', say: 'Multilingual tokenizers fight back with balanced training text and bigger vocabularies.' },
      ],
    },
    {
      id: 'quirks',
      title: 'Tokenization quirks',
      codeTitle: 'quirks.py',
      code: `
        GPT2_SPLIT = (r"'s|'t|'re|'ve|'m|'ll|'d"
                      r"| ?\\p{L}+| ?\\p{N}+"
                      r"| ?[^\\s\\p{L}\\p{N}]+"
                      r"|\\s+(?!\\S)|\\s+")      #@split
        re.findall(GPT2_SPLIT, "The keeper's")
        # ['The', ' keeper', "'s"]         #@split
        encode(" the"), encode("the")      #@space
        # [258], [116, 256]                #@space
        re.findall(r"\\d{1,3}|\\D+", s)      #@three
        re.findall(r"\\d|\\D+", s)           #@digit
      `,
      beats: [
        { id: 'split', say: 'Before merging, {GPT-2|G P T two} cuts text into chunks with a regular expression: runs of letters, runs of digits, and runs of punctuation.', code: 'split' },
        { id: 'why', say: 'Merges never cross a chunk boundary, so no vocabulary is wasted on pairs like a word plus a full stop.', code: 'split' },
        { id: 'space', say: 'Each chunk carries at most one leading space. So {␣the|space the} and {the|plain the} are different tokens with unrelated ids, and so are {The|capital the} and {␣The|space capital the}.', code: 'space' },
        { id: 'learn', say: 'The model has to learn, from data alone, that all four are the same word.', code: 'space' },
        { id: 'letters', say: 'And the model never sees letters. Ask how many {h\'s|aitches} are in lighthouse, and our tokenizer hands the model a single id: {366|three hundred and sixty six}.' },
        { id: 'straw', say: 'That is why models famously miscounted the {r\'s|ars} in strawberry: they see a few tokens, not ten letters.' },
        { id: 'numbers', say: "Numbers are worse. {GPT-2|G P T two}'s merges treated digits like letters: common numbers became single tokens, and others split wherever earlier merges fell." },
        { id: 'threes', say: "{GPT-4|G P T four}'s tokenizer instead cuts digits into chunks of at most three, counting from the left.", code: 'three' },
        { id: 'align', say: 'But then the places stop lining up: four eight two, then one three, against seven seven five, then nine.', code: 'three' },
        { id: 'digits', say: '{LLaMA|Lama} and {LLaMA 2|Lama two} split every number into single digits: consistent places, at the price of longer sequences.', code: 'digit' },
        { id: 'glitch', say: "Last, a token can sit in the vocabulary yet almost never appear in the model's training text. Its embedding barely trains." },
        { id: 'magikarp', say: 'The famous case, a username, {SolidGoldMagikarp|Solid Gold Magikarp}, made {GPT-3|G P T three} era models produce bizarre replies when asked to repeat it.' },
      ],
    },
    {
      id: 'embed',
      title: 'Embeddings: a table of vectors',
      codeTitle: 'embedding.py',
      code: `
        V, d = 427, 8
        E = 0.02 * np.random.randn(V, d)  #@E
        x = E[ids]           # (n, d)     #@x
        onehot = np.eye(V)[ids]           #@onehot
        np.allclose(onehot @ E, x) # True #@onehot
        # backward: only rows in ids move
        np.add.at(dE, ids, dx)            #@grad
      `,
      beats: [
        { id: 'ints', say: 'After tokenization, the model holds integers, and an integer alone is a poor input: token one thousand is not more than token nine hundred and ninety nine.' },
        { id: 'table', say: 'So the first layer is a lookup table, the embedding matrix E: one row of d learned numbers for each of the V tokens.', code: 'E' },
        { id: 'row', say: 'Token t becomes x, row t of the table.', code: 'x' },
        { id: 'onehot', say: 'In math, the lookup is a one-hot vector, all zeros except a single one at position t, times the matrix.', code: 'onehot' },
        { id: 'picks', say: 'Every row gets multiplied by zero except row t, so the product is exactly that row.', code: 'onehot' },
        { id: 'linear', say: 'So the embedding is an ordinary linear layer, and backpropagation trains it like any other weight.', code: 'grad' },
        { id: 'sparse', say: 'Its gradient only touches the rows of tokens in the batch. A token that never appears never moves.', code: 'grad' },
        { id: 'learn', say: 'What do the rows learn? Nobody tells them, except through the loss.' },
        { id: 'toy', say: 'Here is the smallest language model there is: a two dimensional embedding, one two by two matrix, and an unembedding, trained on a language of fourteen words.' },
        { id: 'clusters', say: 'As it trains, words that are followed by the same things slide together: the with a, the three adjectives, cat with dog.' },
        { id: 'apart', say: 'Bird and fish stay apart, because different verbs follow them.' },
        { id: 'meaning', say: 'With thousands of dimensions instead of two, directions in this space come to line up with meaning.' },
        { id: 'position', say: 'The table cannot know position: a token gets the same row wherever it sits. Order is added separately, as the transformer chapter showed.', code: 'x' },
      ],
    },
    {
      id: 'unembed',
      title: 'The unembedding',
      codeTitle: 'unembed.py',
      code: `
        h = hidden[-1]           # (d,)  #@h
        logits = h @ U           # (V,)  #@z
        p = np.exp(logits - logits.max())  #@p
        p /= p.sum()                     #@p
        next_id = p.argmax()             #@pick
      `,
      beats: [
        { id: 'top', say: 'At the top of the stack, the transformer hands back one vector, h, for each position.', code: 'h' },
        { id: 'scores', say: 'To predict the next token, that vector has to become a score for every one of the V tokens.', code: 'z' },
        { id: 'matmul', say: 'That is one matrix multiply: z equals h times U, where U has d rows and V columns.', code: 'z' },
        { id: 'column', say: "Each column of U is an output vector for one token, and that token's score is the dot product of h with its column.", code: 'z' },
        { id: 'points', say: 'So a token scores high when h points its way. In our tiny model, after cat, h points toward runs and sleeps.', code: 'z' },
        { id: 'softmax', say: 'A softmax turns the scores into probabilities that add up to one.', code: 'p' },
        { id: 'classifier', say: 'If this looks familiar, it should. It is the linear softmax classifier from {CS231n|C S two thirty one N}, with one class per token.', code: ['z', 'p'] },
        { id: 'gpt2', say: 'The last layer of {GPT-2|G P T two} is a softmax classifier with {50,257|fifty thousand, two hundred and fifty seven} classes.', code: 'pick' },
        { id: 'steer', say: 'Every layer below exists to steer h toward the output vectors of likely next tokens.', code: 'h' },
        { id: 'cost', say: 'And this layer is not cheap: a d by V multiply at every position.', code: 'z' },
      ],
    },
    {
      id: 'tying',
      title: 'Weight tying',
      codeTitle: 'tied.py',
      code: `
        x = E[ids]         # in: rows of E  #@in
        h = transformer(x)                  #@in
        logits = h @ E.T   # out: same rows #@out

        V, d, L = 50257, 768, 12  # GPT-2   #@size
        table = V * d             # 38.6M   #@size
        blocks = L * 12 * d * d   # 84.9M   #@size
      `,
      beats: [
        { id: 'side', say: 'Put the two tables side by side: E has a row for every token, and U a column for every token. Both hold one vector per token, in the same space.', code: ['in', 'out'] },
        { id: 'tie', say: 'Weight tying uses one matrix for both jobs: U is E, transposed.', code: 'out' },
        { id: 'who', say: 'The original Transformer did this, and so does {GPT-2|G P T two}.', code: 'out' },
        { id: 'score', say: "Now the score for token j is how well h lines up with j's own embedding.", code: 'out' },
        { id: 'saves', say: 'It saves a whole table: for {GPT-2|G P T two} small, {38.6|thirty eight point six} million parameters, almost a third of the model.', code: 'size' },
        { id: 'rare', say: 'It also helps rare tokens. An input row trains only when its token appears, but an output vector trains at every position, since the softmax pushes every wrong token down a little.' },
        { id: 'share', say: 'Tied, those constant nudges train the input vectors of rare tokens too.' },
        { id: 'cost', say: 'The price is a compromise: one vector must say both what a token is, and when it comes next.' },
        { id: 'scale', say: 'How much does vocabulary cost? Each table holds V times d numbers, while each transformer block holds about twelve d squared.', code: 'size' },
        { id: 'xl', say: 'So its share shrinks as models grow: about five percent of {GPT-2 XL|G P T two X L}, and four percent of a seven billion parameter model with {32,000|thirty two thousand} tokens, even untied.' },
        { id: 'vocab', say: 'That is why vocabularies grew, from {50,000|fifty thousand} tokens in {GPT-2|G P T two} to around {200,000|two hundred thousand} today: big models can afford them, and shorter sequences pay them back.' },
      ],
    },
    {
      id: 'outro',
      title: 'Putting it together',
      codeTitle: 'pipeline.py',
      code: `
        ids = encode(text)    # BPE        #@tok
        x = E[ids]            # embedding  #@emb
        h = transformer(x)                 #@tf
        logits = h @ E.T      # tied       #@unemb
        p = softmax(logits[-1])            #@unemb
        print(decode([p.argmax()]))        #@next
      `,
      beats: [
        { id: 'recap', say: "Let's put it all together." },
        { id: 'tok', say: 'A tokenizer cuts text into subword tokens. {BPE|B P E} learns them by counting: merge the most frequent pair, and repeat.', code: 'tok' },
        { id: 'bytes', say: 'Starting from the {256|two hundred and fifty six} byte values means nothing is ever unknown.', code: 'tok' },
        { id: 'quirks', say: 'Its choices explain a lot: spaces glued to words, odd numbers, trouble with spelling, and higher costs for some languages.', code: 'tok' },
        { id: 'emb', say: 'The embedding table turns each id into a learned vector.', code: 'emb' },
        { id: 'unemb', say: 'The unembedding turns the final vector back into a score per token, a softmax classifier over the vocabulary. Tying makes the two one matrix.', code: 'unemb' },
        { id: 'next', say: 'Next comes training: how a model learns to predict those next tokens, and how we sample from it.', code: 'next', pause: 0.6 },
      ],
    },
  ],
};

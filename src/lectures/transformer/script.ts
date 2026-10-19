import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'transformer',
  title: 'The Transformer',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'One block for everything',
      codeTitle: 'transformer.py',
      code: `
        # Attention Is All You Need (2017)
        x = embed(tokens) + positions   #@embed
        for block in blocks:            #@loop
            x = x + attention(x)        #@attn
            x = x + mlp(x)              #@mlp
        logits = unembed(x)             #@out
        # (layer norms come later)
      `,
      beats: [
        { id: 'hello', say: 'This is chapter two: the Transformer.' },
        { id: 'paper', say: 'In {2017|twenty seventeen}, a team at Google published a paper with a bold title: Attention Is All You Need. It described a translation model with no recurrence at all.' },
        { id: 'block', say: 'Instead of reading a sentence one word at a time, every word looks at every other word at once. And the model is a single block, repeated.', code: 'loop' },
        { id: 'everywhere', say: 'That same block became BERT and GPT, then vision models, then the chat models of today.' },
        { id: 'recipe', say: 'Here is the whole recipe. Turn tokens into vectors and add their positions. Run a stack of blocks. Then read off a score for every possible next word.', code: ['embed', 'loop', 'out'] },
        { id: 'inside', say: 'Inside each block are just two steps. Attention lets the tokens share information, and a small MLP then works on each token alone.', code: ['attn', 'mlp'] },
        { id: 'plan', say: 'We will build the block piece by piece: queries, keys and values, the scaling, many heads, the mask, positions, and the wiring around them.' },
        { id: 'why', say: 'But first: why throw recurrence away at all?' },
      ],
    },
    {
      id: 'why',
      title: 'Why drop recurrence',
      codeTitle: 'rnn_vs_attention.py',
      code: `
        # an RNN: one step at a time
        h = h0
        for x_t in tokens:            #@rnn
            h = rnn_step(h, x_t)      #@rnn

        # self-attention: all at once
        S = Q @ K.T       # (T, T)    #@attn
        out = softmax(S) @ V          #@attn
      `,
      beats: [
        { id: 'rnn', say: 'A recurrent network reads a sentence like a ticker tape: one token at a time, folding each one into a hidden state.', code: 'rnn' },
        { id: 'wait', say: 'Every step needs the result of the step before. So fifty tokens means fifty steps in a row, while the GPU, built to do thousands of things at once, mostly waits.', code: 'rnn' },
        { id: 'far', say: 'Information also has to travel. For the last word to use the first, it must survive every update in between, and so must the gradient, on its way back.' },
        { id: 'lstm', say: 'LSTMs help, but the path is still long.' },
        { id: 'attn', say: 'Attention changes the picture. Every token connects to every other token directly, so the first word and the last are a single step apart.', code: 'attn' },
        { id: 'parallel', say: 'And there is no loop over time. A whole layer is a few matrix multiplies, with every position computed at once.', code: 'attn' },
        { id: 'cost', say: 'The price: every token is compared with every token. For {T|T} tokens that is a {T × T|T by T} grid of scores, so doubling the length quadruples the work.', code: 'attn' },
        { id: 'worth', say: 'For sentences, that price is small, and the speed-up in training was enormous.', pause: 0.3 },
      ],
    },
    {
      id: 'qkv',
      title: 'Queries, keys and values',
      codeTitle: 'qkv.py',
      code: `
        ids = [0, 1, 3, 4, 0, 5]
        X = E[ids]       # (6, 4)    #@x
        Q = X @ Wq       # (6, 2)    #@q
        K = X @ Wk       # (6, 2)    #@k
        V = X @ Wv       # (6, 2)    #@v
      `,
      beats: [
        { id: 'tokens', say: 'Start with six tokens: the cat sat on the mat.' },
        { id: 'rows', say: 'Each token is a vector of numbers, its embedding. Stack them as rows, and you have a matrix, X: six rows, four columns.', code: 'x' },
        { id: 'roles', say: 'In self-attention, every token plays three roles at once.' },
        { id: 'query', say: 'A query: what am I looking for?', code: 'q' },
        { id: 'key', say: 'A key: what do I contain, for others to find?', code: 'k' },
        { id: 'value', say: 'And a value: what do I hand over, if someone attends to me?', code: 'v' },
        { id: 'matrices', say: 'Each role comes from its own learned matrix. Multiply X by {Wq|W Q}, and every row becomes that token\'s query.', code: 'q' },
        { id: 'same', say: '{Wk|W K} makes the keys, and {Wv|W V} makes the values. Three matrix multiplies, and every token has all three.', code: ['k', 'v'] },
        { id: 'why3', say: 'Why three different matrices? Because what a word looks for is not what it offers. A verb might look for its subject, while what it offers is: I am an action, in the past tense.' },
        { id: 'shapes', say: 'Notice the shapes. {6 × 4|Six by four}, times {4 × 2|four by two}, gives {6 × 2|six by two}. One row per token, all the way through.', code: ['q', 'k', 'v'] },
      ],
    },
    {
      id: 'scores',
      title: 'Scores, softmax, blend',
      codeTitle: 'attention.py',
      code: `
        S = Q @ K.T / np.sqrt(d_k)   #@s
        A = softmax(S, axis=1)       #@a
        out = A @ V                  #@out
        # A[sat] = [.07 .36 .21 .06 .07 .23]
      `,
      beats: [
        { id: 'compare', say: 'Now the lookup. Take one token, sat, and compare its query with every key, using a dot product.', code: 's' },
        { id: 'grid', say: 'Do that for every token, and you get a {6 × 6|six by six} grid of scores. Row i, column j: how well token j matches what token i is looking for.', code: 's' },
        { id: 'onemm', say: 'And the whole grid is one matrix multiply: {Q Kᵀ|Q times K transposed}, divided by a constant we will come back to.', code: 's' },
        { id: 'softmax', say: 'Each row then goes through a softmax: exponentiate, and divide by the row\'s total.', code: 'a' },
        { id: 'weights', say: 'Now every row is a set of weights, all positive, adding up to one. This grid is the attention matrix, A.', code: 'a' },
        { id: 'sat', say: 'Here, sat puts its biggest weight on cat: thirty six percent. These toy weights happen to make the verb look for its noun.', code: 'a' },
        { id: 'mix', say: 'Last, each token\'s output is a blend of all the values, mixed in the proportions its row chose.', code: 'out' },
        { id: 'mm', say: 'That is A times V: one more matrix multiply, for every token at once.', code: 'out' },
        { id: 'same', say: 'Notice the two rows for the. They are identical at every step. Nothing so far tells the model that they sit in different places. Keep that in mind.' },
        { id: 'total', say: 'So self-attention is three projections, two matrix multiplies and a softmax. No loops, and no idea how long the sentence is.', code: ['s', 'a', 'out'] },
      ],
    },
    {
      id: 'scaling',
      title: 'Why divide by the square root of d',
      codeTitle: 'why_scale.py',
      code: `
        q = np.random.randn(2000, d_k)   #@sample
        k = np.random.randn(2000, d_k)   #@sample
        dots = (q * k).sum(axis=1)       #@dot
        # d_k = {{dk:1}}, std = {{sd:1.0}}       #@std
        dots = dots / np.sqrt(d_k)       #@fix
      `,
      beats: [
        { id: 'skipped', say: 'We skipped a detail: the division by the square root of {dₖ|d k}. It decides whether the model can learn at all.', code: 'fix' },
        { id: 'random', say: 'Picture queries and keys made of random numbers, with average zero and spread one: roughly what they look like when training starts.', code: 'sample' },
        { id: 'sum', say: 'A dot product adds up {dₖ|d k} products. Each product has a variance of one, and the variances of independent numbers add up.', code: 'dot' },
        { id: 'grow', say: 'So the dot product has a variance of {dₖ|d k}, and a typical score is about the square root of {dₖ|d k}.', code: 'std' },
        { id: 'watch', say: 'Watch the scores spread out as the width grows. At sixty four, the width in the paper, a typical score is about eight.', code: 'std' },
        { id: 'softmax', say: 'Now feed scores that big into a softmax.' },
        { id: 'saturate', say: 'One key grabs almost all the weight, and the rest get almost nothing. The softmax has saturated.' },
        { id: 'gradient', say: 'And a saturated softmax has almost no gradient. Nudge any score, and the weights barely move, so the queries and keys get no signal to learn from.' },
        { id: 'fix', say: 'The fix is a single division. Divide every score by the square root of {dₖ|d k}, and the spread goes back to one, whatever the width.', code: 'fix' },
        { id: 'soft', say: 'The softmax is soft again, and the gradient can flow.', pause: 0.3 },
      ],
    },
    {
      id: 'heads',
      title: 'Many heads',
      codeTitle: 'multi_head.py',
      code: `
        heads = []
        for i in range(n_heads):         #@loop
            Q = X @ Wq[i]                #@proj
            K = X @ Wk[i]                #@proj
            V = X @ Wv[i]                #@proj
            A = softmax(Q @ K.T / np.sqrt(d_k))  #@attn
            heads.append(A @ V)          #@attn
        H = np.concatenate(heads, 1)     #@cat
        out = H @ Wo                     #@wo
      `,
      beats: [
        { id: 'budget', say: 'One row of weights per token is a tight budget. Sat might want to know who sat, and where, at the same time.' },
        { id: 'many', say: 'So run several attentions side by side. Each one is called a head, and each has its own small {Wq|W Q}, {Wk|W K} and {Wv|W V}.', code: ['loop', 'proj'] },
        { id: 'prev', say: 'Here are four heads, built by hand. The first looks at the previous word.', code: 'attn' },
        { id: 'next', say: 'The second looks at the next word.', code: 'attn' },
        { id: 'nouns', say: 'The third finds the nouns: cat and mat.', code: 'attn' },
        { id: 'sameword', say: 'And the fourth links a word to its other copies, like the two thes.', code: 'attn' },
        { id: 'how', say: 'None of this is magic. Each pattern is just a choice of two matrices, {Wq|W Q} and {Wk|W K}. The position heads read position features, and the word heads read the words.', code: 'proj' },
        { id: 'concat', say: 'Each head returns a narrow result. Lay them side by side, and you are back to the full width.', code: 'cat' },
        { id: 'wo', say: 'One more matrix, {Wo|W O}, mixes what the heads found into one vector per token.', code: 'wo' },
        { id: 'cost', say: 'Eight heads of width sixty four cost about as much as one head of width five hundred and twelve. What you gain is eight separate places to look.' },
      ],
    },
    {
      id: 'mask',
      title: 'No peeking: the causal mask',
      codeTitle: 'causal.py',
      code: `
        T = S.shape[0]
        M = np.triu(np.full((T, T), -np.inf), 1)  #@m
        A = softmax(S + M, axis=1)    #@a
        # row i sees tokens 0..i      #@a
      `,
      beats: [
        { id: 'lm', say: 'A language model learns to predict each next token from the ones before it.' },
        { id: 'parallel', say: 'A transformer can practice on every position at once. Feed in the whole sentence, and ask output i to predict token i plus one.' },
        { id: 'cheat', say: 'But look at the next-word head. Token i can see token i plus one, so it can simply copy the answer, and learn nothing it could use later.' },
        { id: 'mask', say: 'The fix is the causal mask. Before the softmax, add minus infinity to every score where the key comes after the query.', code: 'm' },
        { id: 'zero', say: '{e to the −∞|e to the minus infinity} is zero, so those keys get no weight at all, and each row still adds up to one.', code: 'a' },
        { id: 'triangle', say: 'The attention matrix becomes a lower triangle. Each token sees itself and its past, and nothing else.', code: 'a' },
        { id: 'next', say: 'With the mask on, the next-word head loses its target, and falls back on the current word.' },
        { id: 'payoff', say: 'Now one pass over a sentence trains every next-token prediction in it at once, with no cheating. An RNN would need one step per token.' },
        { id: 'generate', say: 'When generating, the model writes one token, appends it, and runs again. The mask makes training and generation see the same past.' },
      ],
    },
    {
      id: 'order',
      title: 'Order is invisible',
      codeTitle: 'shuffle.py',
      code: `
        out = attention(E[ids])          #@a
        perm = [3, 0, 5, 1, 4, 2]        #@p
        out2 = attention(E[ids][perm])   #@b
        np.allclose(out2, out[perm])     #@c
        # True: the rows only moved      #@c
      `,
      beats: [
        { id: 'strange', say: 'Here is a strange fact. Self-attention has no idea what order its tokens are in.' },
        { id: 'why', say: 'The score between cat and mat depends only on their two vectors, not on where they sit.' },
        { id: 'outs', say: 'Here is each word\'s attention output, from our toy example.', code: 'a' },
        { id: 'shuffle', say: 'Now shuffle the sentence, and run attention again.', code: ['p', 'b'] },
        { id: 'moved', say: 'Every word gets exactly the same output as before. The rows simply moved along with their words.', code: 'c' },
        { id: 'bag', say: 'So the cat sat on the mat, and the mat sat on the cat, look identical to an attention layer. That will not do.' },
        { id: 'fix', say: 'The fix: write each token\'s position into its vector.' },
      ],
    },
    {
      id: 'positions',
      title: 'Sinusoidal positions',
      codeTitle: 'positions.py',
      code: `
        pos = np.arange(T)[:, None]       #@pos
        i = np.arange(0, d, 2)[None, :]   #@i
        angle = pos / 10000 ** (i / d)    #@ang
        P[:, 0::2] = np.sin(angle)        #@sin
        P[:, 1::2] = np.cos(angle)        #@sin
        X = E[ids] + P                    #@add
      `,
      beats: [
        { id: 'add', say: 'The original transformer adds a positional encoding to each token: a vector that depends only on its position.', code: 'add' },
        { id: 'waves', say: 'It is built from sine and cosine waves. Each pair of columns gets one wave, and each pair turns at its own speed.', code: ['ang', 'sin'] },
        { id: 'fast', say: 'The first pair turns fast, about once every six positions. It tells neighbors apart.', code: 'ang' },
        { id: 'slow', say: 'Later pairs turn slower and slower, until the last takes tens of thousands of positions to come around. They tell the start of a document from its middle.', code: 'ang' },
        { id: 'clock', say: 'Think of a clock with many hands. Read all the hands together, and every position has its own pattern.', code: ['pos', 'i'] },
        { id: 'grid', say: 'Here are sixty four positions, one per row, across sixty four columns: fast stripes on the left, slow ones on the right.', code: 'sin' },
        { id: 'rotate', say: 'Now the clever part. Each sine and cosine pair is a point on a circle, and moving one position forward rotates it by a fixed angle.' },
        { id: 'linear', say: 'A rotation is a matrix multiply. So the code for position p plus k is a fixed linear function of the code for p, the same for every p.' },
        { id: 'headlink', say: 'That is exactly what a {Wq|W Q} can express. Our previous-word head was built that way: its {Wq|W Q} turns every pair back by one step.' },
        { id: 'bump', say: 'It also means the similarity of two positions depends only on how far apart they are, not on where they sit.' },
        { id: 'today', say: 'Later models learned their position vectors instead, and most now rotate the queries and keys directly, a trick called {RoPE|rope}, in chapter six.' },
      ],
    },
    {
      id: 'block',
      title: 'The block',
      codeTitle: 'block.py',
      code: `
        def block(x):                     #@def
            a = multi_head(x)             #@attn
            x = layer_norm(x + a)         #@res1
            h = np.maximum(0, x @ W1 + b1)   #@ffn
            f = h @ W2 + b2               #@ffn
            x = layer_norm(x + f)         #@res2
            return x                      #@def
      `,
      beats: [
        { id: 'two', say: 'Attention moves information between tokens. A block also has to work on each token by itself, and stay trainable when stacked deep.' },
        { id: 'mlp', say: 'So after attention comes a small MLP, applied to every token separately, with the same weights.', code: 'ffn' },
        { id: 'wide', say: 'It widens each vector to four times the width, applies a ReLU, and projects back down.', code: 'ffn' },
        { id: 'residual', say: 'Each sublayer sits inside a residual connection: its output is added to its input, instead of replacing it.', code: ['res1', 'res2'] },
        { id: 'resnet', say: 'That is the trick that made {152|hundred and fifty two} layer ResNets trainable. Each sublayer only has to learn a correction, and the gradient has a straight path down.' },
        { id: 'ln', say: 'And after each add comes layer norm: shift and scale each token\'s vector to mean zero and standard deviation one.', code: 'res1' },
        { id: 'lnrows', say: 'Watch the rows. Whatever comes in, every row leaves with a mean of zero and a spread of one.', code: 'res1' },
        { id: 'batch', say: 'It is batch norm turned sideways: it normalizes each token over its own features, so it never depends on the batch.' },
        { id: 'shape', say: 'A block takes a {T × d|T by d} matrix, and returns one of the same shape. That is what lets blocks stack.', code: 'def' },
        { id: 'stack', say: 'The paper stacked six of them. {GPT-3|GPT three} stacks ninety six.' },
        { id: 'prenorm', say: 'One change came later. {GPT-2|GPT two} moved the layer norm to the start of each sublayer, which trains deep stacks more easily. Chapter six has the details.' },
      ],
    },
    {
      id: 'families',
      title: 'Encoder, decoder, both',
      codeTitle: 'masks.py',
      code: `
        # encoder (BERT): all see all
        mask = np.ones((T, T))           #@enc
        # decoder (GPT): the past only
        mask = np.tril(np.ones((T, T)))  #@dec
        # encoder-decoder (2017, T5)
        cross = np.ones((T_out, T_in))   #@cross
      `,
      beats: [
        { id: 'orig', say: 'The original transformer was built for translation, so it has two halves.' },
        { id: 'enc', say: 'The encoder reads the source sentence with no mask. Every source token sees every other.', code: 'enc' },
        { id: 'dec', say: 'The decoder writes the translation, with a causal mask.', code: 'dec' },
        { id: 'cross', say: 'And each decoder block has a third sublayer, cross-attention. Its queries come from the decoder, its keys and values from the encoder, so every target word can look at the whole source.', code: 'cross' },
        { id: 'bert', say: 'Later models kept one half. BERT is encoder only: it reads a whole text, and fills in words that were masked out.', code: 'enc' },
        { id: 'gpt', say: 'GPT is decoder only: one causal stack, trained to predict the next token.', code: 'dec' },
        { id: 'today', say: 'Today\'s large language models are almost all decoder only. Predicting the next token turns out to cover translation, summaries and answers too, phrased as text to continue.' },
      ],
    },
    {
      id: 'params',
      title: 'Twelve d squared',
      codeTitle: 'count.py',
      code: `
        attn = 4 * d * d      # Wq Wk Wv Wo  #@attn
        mlp = 2 * d * (4 * d) # W1, W2       #@mlp
        block = attn + mlp    # 12 d^2       #@block
        total = n_layers * block + vocab * d #@total
        # GPT-2 small: 124M, GPT-3: 175B
      `,
      beats: [
        { id: 'count', say: 'How big is one block? Count its matrices.' },
        { id: 'attn', say: 'Attention has four: {Wq|W Q}, {Wk|W K}, {Wv|W V} and {Wo|W O}, each d by d. That is four d squared.', code: 'attn' },
        { id: 'mlp', say: 'The MLP has two: d by four d, and four d by d. That is eight d squared.', code: 'mlp' },
        { id: 'twelve', say: 'Together, twelve d squared: a third attention, two thirds MLP. Biases and layer norms barely register.', code: 'block' },
        { id: 'gpt2', say: '{GPT-2|GPT two} small has a width of seven hundred and sixty eight, and twelve blocks. That is about eighty five million in the blocks, plus thirty nine million in the embedding: a hundred and twenty four million in all.', code: 'total' },
        { id: 'gpt3', say: '{GPT-3|GPT three} has a width of twelve thousand two hundred and eighty eight, and ninety six blocks. That comes to about a hundred and seventy four billion: its famous {175B|one seventy five billion}.', code: 'total' },
        { id: 'square', say: 'Parameters grow with the square of the width, but only in proportion to the depth.' },
        { id: 'compute', say: 'And parameters are not the whole cost. The {T × T|T by T} scores have no parameters at all, but their cost grows with the square of the length.' },
      ],
    },
    {
      id: 'recap',
      title: 'Recap',
      codeTitle: 'model.py',
      code: `
        x = E[ids] + P[:T]               #@embed
        for block in blocks:             #@loop
            a = multi_head(x, mask)      #@attn
            x = layer_norm(x + a)        #@ln
            x = layer_norm(x + mlp(x))   #@mlp
        logits = x @ E.T                 #@out
      `,
      beats: [
        { id: 'whole', say: 'Let us put the whole thing together.' },
        { id: 'embed', say: 'Tokens become vectors, and their positions are added in.', code: 'embed' },
        { id: 'attn', say: 'In every block, attention with many heads lets each token gather what it needs from the others, behind a mask if it is a decoder.', code: 'attn' },
        { id: 'scale', say: 'Scores are divided by the square root of {dₖ|d k}, so the softmax stays soft.', code: 'attn' },
        { id: 'mlp', say: 'An MLP works on each token, and residual adds and layer norms keep a deep stack trainable.', code: ['ln', 'mlp'] },
        { id: 'out', say: 'At the end comes one score per vocabulary word, for the next token.', code: 'out' },
        { id: 'next', say: 'The interactive chapter has all of this as figures you can play with: the attention matrices step by step, the four heads, the shuffle test, and a block lit up by its code.' },
        { id: 'bye', say: 'Next, in chapter three: where the token vectors come from. See you there.', pause: 0.6 },
      ],
    },
  ],
};

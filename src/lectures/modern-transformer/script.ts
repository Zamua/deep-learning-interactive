import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'modern-transformer',
  title: 'The modern transformer block',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'From 2017 to now',
      codeTitle: 'blocks.py',
      code: `
        def block_2017(x):      # post-norm   #@old
            a = attention(x @ Wq, x @ Wk, x @ Wv) #@old
            x = layer_norm(x + a)              #@old,onorm
            m = relu(x @ W1) @ W2              #@old
            x = layer_norm(x + m)              #@old,onorm
            return x                           #@old

        def block_modern(x, pos):  # pre-norm  #@new
            h = rms_norm(x)                    #@new,norm
            q, k, v = h @ Wq, h @ Wk, h @ Wv   #@new,gqa
            q, k = rms_norm(q), rms_norm(k)    #@new,qk
            q, k = rope(q, pos), rope(k, pos)  #@new,rope
            x = x + flash_attention(q, k, v) @ Wo  #@new,flash
            x = x + swiglu(rms_norm(x))        #@new,norm,mlp
            return x                           #@new
      `,
      beats: [
        { id: 'hello', say: 'Welcome back. In the Transformer chapter you built the 2017 block: attention, then an MLP, each wrapped in a residual connection and a layer norm.', code: 'old' },
        { id: 'same', say: 'Every large language model is still that block, stacked dozens of times.', code: 'old' },
        { id: 'but', say: 'But open the code of a model trained in 2024, and almost every part of it has been replaced.', code: 'new' },
        { id: 'list1', say: 'The norm moved, and lost its mean. Positions became rotations.', code: ['norm', 'rope'] },
        { id: 'list2', say: 'The MLP grew a gate. Query heads now share their keys and values.', code: ['mlp', 'gqa'] },
        { id: 'list3', say: 'Queries and keys got a norm of their own, the biases are gone, and attention is computed in tiles.', code: ['qk', 'flash'] },
        { id: 'why', say: 'None of this changes what attention is. Each change fixes a problem that appeared as models got deeper, read longer texts, and served millions of people.' },
        { id: 'plan', say: 'For each one we ask what problem it solves, what it costs, and which picture makes it obvious.' },
        { id: 'go', say: 'We start where the 2017 block is most fragile: the norm sitting on the residual stream.', code: 'onorm' },
      ],
    },
    {
      id: 'prenorm',
      title: 'Pre-norm: a clean highway',
      codeTitle: 'norm_placement.py',
      code: `
        def post_norm(x, F):
            return layer_norm(x + F(x))     #@post

        def pre_norm(x, F):
            return x + F(rms_norm(x))       #@pre

        # post: every norm divides by sigma
        reach[:l + 2] /= sigma              #@reach

        # pre: the top is a plain sum
        x_top = x0 + sum(writes)            #@sum
      `,
      beats: [
        { id: 'stream', say: 'A residual connection makes each layer add to a running vector instead of replacing it: the residual stream.' },
        { id: 'grad', say: 'Its great virtue is the gradient: backprop has a direct route from the loss to every layer, through nothing but plus signs.' },
        { id: 'post', say: 'The 2017 block put its layer norm on that route: after every sub-block, the whole stream is normalized. That is post-norm.', code: 'post' },
        { id: 'divide', say: 'A norm divides by the stream\'s spread. If a sub-block adds about as much as is already there, the spread grows by root two, and the norm divides it back down.', code: 'post' },
        { id: 'compound', say: 'So an early write shrinks by about root two at every layer above it. Over twenty four layers, that estimate is a factor of four thousand.', code: 'reach' },
        { id: 'measure', say: 'Measured on a random stack, it is near thirteen hundred. Each bar is how strongly one write reaches the top, and the embedding, on the left, barely registers.', code: 'reach' },
        { id: 'pre', say: 'Pre-norm moves the norm onto the branch. Only the copy entering the sub-block is normalized; the stream is only ever added to.', code: 'pre' },
        { id: 'flat', say: 'Now the top of the stack is a plain sum of every write, each with weight one. The highway is clear.', code: 'sum' },
        { id: 'history', say: '{GPT-2|G P T two} made this switch in 2019, and deep stacks train without a long, careful warmup.', code: 'pre' },
        { id: 'cost', say: 'The cost: nothing shrinks the stream, so it grows with depth, and each layer has a smaller relative say. One final norm goes on top.', code: 'sum' },
      ],
    },
    {
      id: 'rmsnorm',
      title: 'RMSNorm',
      codeTitle: 'norms.py',
      code: `
        def layer_norm(x, g, b):
            mu = x.mean()                    #@mu
            var = ((x - mu) ** 2).mean()     #@var
            return (x - mu) / var ** 0.5 * g + b  #@var

        def rms_norm(x, g):
            rms = ((x ** 2).mean()) ** 0.5   #@rms
            return x / rms * g               #@div

        x = a * x0 + c   # scale, then shift #@probe
      `,
      beats: [
        { id: 'ln', say: 'Layer norm does two things to a token\'s vector. First it subtracts the mean, so the numbers average to zero.', code: 'mu' },
        { id: 'ln2', say: 'Then it divides by their spread, so the spread is one. A learned gain and bias can undo either step.', code: 'var' },
        { id: 'rms', say: '{RMSNorm|R M S norm}, from Zhang and Sennrich in 2019, keeps only the second step. It divides by the root mean square: square every entry, average, take the square root.', code: 'rms' },
        { id: 'gain', say: 'Then it multiplies by the gain. No mean, and no bias.', code: 'div' },
        { id: 'scale', say: 'Scale the input up, and both norms give exactly the same output: dividing by a size cancels any common factor.', code: 'probe' },
        { id: 'shift', say: 'Shift the input, and layer norm does not move, but {RMSNorm|R M S norm} does. That lost invariance is the whole price.', code: 'probe' },
        { id: 'why', say: 'The bet was that the rescaling is what matters: it holds each layer\'s input at a fixed size, however the weights below it drift.', code: 'rms' },
        { id: 'cheap', say: 'It held. The same quality, one pass over the vector instead of two, and nothing to subtract. {LLaMA|llama} made it the standard.', code: ['rms', 'div'] },
      ],
    },
    {
      id: 'rope',
      title: 'Rotary positions',
      codeTitle: 'rope.py',
      code: `
        theta = 10000.0 ** (-j / d)  # speeds  #@theta

        def rope(x, pos):
            a = pos * theta     # angle per pair  #@ang
            c, s = np.cos(a), np.sin(a)        #@ang
            out[0::2] = x0 * c - x1 * s        #@rot
            out[1::2] = x0 * s + x1 * c        #@rot
            return out

        score = rope(q, m) @ rope(k, n)       #@score
        # == q @ rope(k, n - m)               #@rel
      `,
      beats: [
        { id: 'order', say: 'Attention alone has no sense of order. Shuffle the tokens, and the outputs just shuffle along.' },
        { id: 'old', say: 'The 2017 fix added a position vector to each embedding, once, at the bottom of the stack.' },
        { id: 'problems', say: 'Two problems. Attention mostly cares about relative position, like the word just before me, which an absolute vector leaves the model to work out. And a learned table ends where training ended.' },
        { id: 'rope', say: '{RoPE|rope}, from Su and colleagues in 2021, puts position into the one place attention looks: the dot product of a query and a key.', code: 'score' },
        { id: 'pairs', say: 'Split each query and key into pairs of numbers, and treat each pair as an arrow in a plane.', code: 'rot' },
        { id: 'rotate', say: 'At position m, rotate pair i by the angle m times theta i. A rotation turns the arrow without changing its length.', code: ['ang', 'rot'] },
        { id: 'both', say: 'The key, at its own position n, is rotated by n times theta i.', code: ['ang', 'rot'] },
        { id: 'shift', say: 'Now slide both tokens along the sequence. Both arrows turn, but the angle between them stays fixed, and so does their dot product.', code: 'score' },
        { id: 'relative', say: 'The score depends only on the offset {n − m|between the two positions, n minus m}. Relative position, from an operation on each token alone.', code: 'rel' },
        { id: 'speeds', say: 'Each pair has its own speed, from one radian per token for the first pair down to about a ten thousandth for the last.', code: 'theta' },
        { id: 'clock', say: 'Like the hands of a clock: fast pairs tell neighbors apart, and slow pairs track distance over thousands of tokens.', code: 'theta' },
        { id: 'cost', say: 'No parameters and a few multiplications, and only queries and keys are rotated, never values.', code: 'rot' },
      ],
    },
    {
      id: 'swiglu',
      title: 'SwiGLU: a gated MLP',
      codeTitle: 'swiglu.py',
      code: `
        def relu_mlp(x):            # 2017
            return relu(x @ W1) @ W2           #@relu

        def silu(z):
            return z / (1 + np.exp(-z))        #@silu

        def swiglu(x):
            h = silu(x @ W1) * (x @ W3)        #@gate
            return h @ W2                      #@gate

        # d_ff: 4 * d becomes 8/3 * d          #@size
      `,
      beats: [
        { id: 'old', say: 'The 2017 MLP is two matrices with a {ReLU|ray-loo} between them. Each hidden unit takes one linear feature and clips it at zero.', code: 'relu' },
        { id: 'ramp', say: 'On a two dimensional input, one such unit is a ramp: flat on one side of a line, rising steadily on the other.', code: 'relu' },
        { id: 'glu', say: 'A gated linear unit computes two linear features and multiplies them, one passed through an activation that acts as a gate.', code: 'gate' },
        { id: 'silu', say: '{SwiGLU|swig-loo} gates with {SiLU|sigh-loo}: z times the sigmoid of z, a smooth {ReLU|ray-loo} that dips slightly below zero.', code: 'silu' },
        { id: 'product', say: 'Now one unit is a product of two directions: near zero along two lines, positive in two regions, negative in the others.', code: 'gate' },
        { id: 'why', say: 'That lets a unit say: this feature, scaled by that one. Noam Shazeer tried several gates in 2020, and this one made the best language models.', code: 'gate' },
        { id: 'size', say: 'Three matrices instead of two, so the hidden layer shrinks from four times the model width to eight thirds, keeping the parameter count the same.', code: 'size' },
        { id: 'shrug', say: 'Why it works so well is mostly empirical. Shazeer\'s paper credits divine benevolence.' },
        { id: 'adopt', say: '{PaLM|palm} and {LLaMA|llama} adopted it, and it is now the default.', code: 'gate' },
      ],
    },
    {
      id: 'kvcache',
      title: 'The KV cache',
      codeTitle: 'decode.py',
      code: `
        for step in range(n_new):
            q, k, v = project(x_new)          #@proj
            cache_k.append(k)                 #@store
            cache_v.append(v)                 #@store
            out = attend(q, cache_k, cache_v) #@attend

        # bytes per token:
        per_token = (2 * n_layers             #@mem
                     * n_kv_heads * d_head    #@mem
                     * nbytes)                #@mem
      `,
      beats: [
        { id: 'loop', say: 'Generating text is a loop: run the model, sample one token, append it, and repeat.' },
        { id: 'same', say: 'In a causal model, earlier tokens only look backward, so their keys and values never change when a new token arrives.' },
        { id: 'cache', say: 'So a server keeps them. That is the {KV cache|K V cache}. Each new token computes only its own query, key and value,', code: 'proj' },
        { id: 'store', say: 'stores its key and value, and attends over everything stored.', code: ['store', 'attend'] },
        { id: 'mem', say: 'That trades compute for memory, and the memory adds up: one key and one value per token, in every layer, for every key-value head.', code: 'mem' },
        { id: 'formula', say: 'So bytes per token are two, times layers, times key-value heads, times head width, times bytes per number.', code: 'mem' },
        { id: 'llama', say: 'For {Llama 2 7B|llama two, seven B}: two, times thirty two layers, times thirty two heads, times a hundred and twenty eight, times two bytes. Half a megabyte, for every token.', code: 'mem' },
        { id: 'ctx', say: 'Its full context of about four thousand tokens takes two gigabytes per sequence, next to thirteen for the weights.' },
        { id: 'batch', say: 'Serve thirty two sequences at once, and the cache is sixty four gigabytes: five times the model itself.' },
        { id: 'speed', say: 'And each new token reads the whole cache from memory, so its size sets the speed, not just the capacity.', code: 'attend' },
      ],
    },
    {
      id: 'gqa',
      title: 'Sharing keys and values',
      codeTitle: 'gqa.py',
      code: `
        # q: (n_heads, T, d_head)
        # k, v: (n_kv_heads, T, d_head)
        group = n_heads // n_kv_heads     #@group
        k = np.repeat(k, group, axis=0)   #@rep
        v = np.repeat(v, group, axis=0)   #@rep
        S = q @ k.swapaxes(1, 2)          #@attn
        out = softmax(S / sqrt_d) @ v     #@attn

        # n_kv_heads: 32 MHA, 8 GQA, 1 MQA  #@kinds
      `,
      beats: [
        { id: 'mha', say: 'Multi-head attention gives every query head its own key and value head: thirty two query heads, thirty two of each.', code: 'kinds' },
        { id: 'mqa', say: 'Multi-query attention, from Noam Shazeer in 2019, keeps all the query heads but shares a single key and value head among them.', code: 'kinds' },
        { id: 'mqa2', say: 'The cache shrinks thirty two times. But quality drops a little, and training can get less stable.' },
        { id: 'gqa', say: 'Grouped-query attention, from Ainslie and colleagues in 2023, is the middle ground: groups of query heads, each group sharing one key and value head.', code: 'group' },
        { id: 'repeat', say: 'In code, each shared key and value head is simply reused by every query head in its group.', code: 'rep' },
        { id: 'quality', say: 'With eight groups it comes close to full multi-head quality, at a quarter of the cache.', code: 'attn' },
        { id: 'llama3', say: '{Llama 3 8B|llama three, eight B} is about the size of {Llama 2 7B|llama two, seven B}, but keeps eight key-value heads: a hundred and twenty eight kilobytes per token, not five hundred and twelve.', code: 'kinds' },
        { id: 'further', say: '{DeepSeek-V2|deep seek V two} went further, caching one small compressed vector per token. Paged caches and batching come later, in fast inference.' },
      ],
    },
    {
      id: 'stability',
      title: 'QK-norm and no biases',
      codeTitle: 'qk_norm.py',
      code: `
        q, k = x @ Wq, x @ Wk                #@proj
        q = rms_norm(q) * g_q   # QK-norm    #@norm
        k = rms_norm(k) * g_k                #@norm
        scores = q @ k.T / np.sqrt(d)        #@scores
        A = softmax(scores)                  #@soft

        # a key bias adds q @ b to a row:    #@bias
        softmax(s + c) == softmax(s)         #@bias
      `,
      beats: [
        { id: 'growth', say: 'An attention score is a query times a key. If training slowly grows the weights that make them, both vectors grow, and the score grows with their product.', code: ['proj', 'scores'] },
        { id: 'collapse', say: 'Large scores make the softmax nearly one-hot: one key takes almost all of the attention.', code: 'soft' },
        { id: 'stuck', say: 'A saturated softmax passes almost no gradient to the other keys, and training can stall, or diverge.', code: 'soft' },
        { id: 'vit', say: 'This derailed a twenty two billion parameter vision transformer in 2023: its attention logits had grown enormous.' },
        { id: 'fix', say: 'The fix is {QK-norm|Q K norm}: normalize each query and each key, right before the dot product.', code: 'norm' },
        { id: 'bounded', say: 'Now every score is bounded, however large the weights grow. Attention can still sharpen, but only on purpose, through the gains.', code: ['norm', 'scores'] },
        { id: 'who', say: '{OLMo 2|olmo two}, {Gemma 3|gemma three} and {Qwen 3|kwen three} all use it.' },
        { id: 'biases', say: '{PaLM|palm} dropped every bias in 2022, and reported more stable training.' },
        { id: 'keybias', say: 'Some biases never did anything. A bias on the keys adds the same number to every score in a row.', code: 'bias' },
        { id: 'cancel', say: 'And softmax ignores a constant added to all its inputs, so that bias never changed the output. Its gradient is exactly zero.', code: 'bias' },
      ],
    },
    {
      id: 'flash',
      title: 'The memory wall',
      codeTitle: 'attention_io.py',
      code: `
        # standard: T x T arrays in HBM
        S = Q @ K.T / np.sqrt(d)  # write   #@S
        P = softmax(S)       # read, write  #@P
        O = P @ V            # read         #@O

        # FlashAttention: tiles in SRAM
        for Qb in blocks(Q):                #@tiles
            for Kb, Vb in blocks(K, V):     #@tiles
                update(Qb, Kb, Vb)          #@tiles
      `,
      beats: [
        { id: 'two', say: 'A GPU has two kinds of memory that matter here. {HBM|H B M} is large, tens of gigabytes, but comparatively slow.' },
        { id: 'sram', say: '{SRAM|S ram} sits on the chip, next to the arithmetic: about ten times faster, but tiny, a couple of hundred kilobytes per unit.' },
        { id: 'wait', say: 'The arithmetic is so fast that many operations spend most of their time waiting on {HBM|H B M}.' },
        { id: 'standard', say: 'Standard attention is one of them. It writes the full T by T matrix of scores out to {HBM|H B M},', code: 'S' },
        { id: 'readback', say: 'reads it back for the softmax, writes the weights, and reads them again to multiply by the values.', code: ['P', 'O'] },
        { id: 'size', say: 'At eight thousand tokens, one head\'s score matrix is a hundred and twenty eight megabytes, for every head, layer and sequence.', code: 'S' },
        { id: 'tiles', say: 'The fix: load a block of queries and a block of keys into {SRAM|S ram}, compute that block of scores there, and never write it out.', code: 'tiles' },
        { id: 'snag', say: 'One thing stands in the way: the softmax needs a row\'s maximum and its sum, over all the keys, before it can finish any output.', code: 'P' },
        { id: 'next', say: 'Getting around that takes one small trick.', code: 'tiles' },
      ],
    },
    {
      id: 'online',
      title: 'Online softmax',
      codeTitle: 'tiles.py',
      code: `
        m, l, o = -np.inf, 0.0, 0.0             #@init
        for a in range(0, 12, 4):
            s, vt = S[a:a + 4], v[a:a + 4]      #@load
            m_new = max(m, s.max())             #@max
            c = np.exp(m - m_new)   # rescale   #@corr
            l = c * l + np.exp(s - m_new).sum() #@sum
            o = c * o + np.exp(s - m_new) @ vt  #@acc
            m = m_new
        out = o / l                             #@out
        # == softmax(S) @ v                     #@same
      `,
      beats: [
        { id: 'idea', say: 'The trick, from Milakov and Gimelshein in 2018, is the online softmax. Keep three running numbers for each query.', code: 'init' },
        { id: 'three', say: 'The largest score so far, m. A running sum of exponentials, l. And a running output, o, not yet divided by l.', code: 'init' },
        { id: 'tile1', say: 'Load the first tile of four keys. Its largest score becomes m, and every exponential is taken relative to it.', code: ['load', 'max', 'sum', 'acc'] },
        { id: 'tile2', say: 'The second tile holds a bigger score. So every old term was computed against a maximum that was too small.', code: 'max' },
        { id: 'fix', say: 'They are all off by the same factor, so multiplying the old sum and the old output by e to the old max minus the new max corrects them all at once.', code: 'corr' },
        { id: 'add', say: 'Then add the new tile\'s terms on top.', code: ['sum', 'acc'] },
        { id: 'tile3', say: 'The third tile, the same move again. Each tile is touched once, and then it is gone.', code: ['max', 'corr', 'sum', 'acc'] },
        { id: 'done', say: 'At the end, o divided by l is the softmax-weighted average of the values,', code: 'out' },
        { id: 'same', say: 'exactly the number the direct formula gives, up to rounding.', code: 'same' },
        { id: 'flash', say: 'FlashAttention, from Tri Dao and colleagues in 2022, runs this loop for blocks of queries and keys inside one kernel. Memory grows linearly with length, and attention got several times faster.' },
        { id: 'exact', say: 'It is exact, not an approximation. The backward pass recomputes tiles instead of storing them: more arithmetic, far less memory traffic.' },
      ],
    },
    {
      id: 'longctx',
      title: 'Stretching the context',
      codeTitle: 'stretch.py',
      code: `
        wavelength = 2 * np.pi / theta  # tokens #@wave
        # new length = s * L_train
        theta_pi = theta / s            # PI     #@pi
        b2 = base * s ** (d / (d - 2))  # NTK    #@ntk
        theta_ntk = b2 ** (-j / d)               #@ntk
        turns = L_train / wavelength    # YaRN   #@yarn
        w = np.clip((turns - 1) / 31, 0, 1)      #@yarn
        theta = theta * (w + (1 - w) / s)        #@yarn
      `,
      beats: [
        { id: 'why', say: 'Long training sequences are expensive and most documents are short, so models pretrain at a few thousand tokens and are stretched near the end.' },
        { id: 'breaks', say: 'Feed a model longer text than it trained on, and it usually falls apart past that length. The clock picture says why.' },
        { id: 'wave', say: 'Each {RoPE|rope} pair turns once every so many tokens: its wavelength. Fast pairs turn many times in the training window, so they have seen every angle.', code: 'wave' },
        { id: 'slow', say: 'But the slowest pairs, with wavelengths in the tens of thousands, never finished a single turn in a four thousand token window.', code: 'wave' },
        { id: 'unseen', say: 'Past that length, they produce angles the model has never seen.' },
        { id: 'pi', say: 'Position interpolation, from Chen and colleagues in 2023, divides every speed by the stretch factor. Nothing is unseen, but neighbors become harder to tell apart.', code: 'pi' },
        { id: 'ntk', say: '{NTK-aware|N T K aware} scaling raises the base instead. The fastest pair is untouched, and the slowest slows by exactly the stretch factor.', code: 'ntk' },
        { id: 'yarn', say: '{YaRN|yarn} decides pair by pair. Pairs that turned many times keep their speed, pairs that never turned are interpolated, with a blend in between.', code: 'yarn' },
        { id: 'base', say: 'Or start with a bigger base: {Llama 3|llama three} uses five hundred thousand, and {Llama 3.1|llama three point one} stretched to a hundred and twenty eight thousand tokens.' },
        { id: 'window', say: 'Another way to bound the cost is sliding window attention: most layers only look a few thousand tokens back.' },
      ],
    },
    {
      id: 'outro',
      title: 'The modern block',
      codeTitle: 'block.py',
      code: `
        def block(x, pos):          # pre-norm   #@norm
            h = rms_norm(x)                    #@norm
            q, k, v = h @ Wq, h @ Wk, h @ Wv   #@gqa
            q, k = rms_norm(q), rms_norm(k)    #@qk
            q, k = rope(q, pos), rope(k, pos)  #@rope
            x = x + flash_attention(q, k, v) @ Wo  #@flash
            x = x + swiglu(rms_norm(x))        #@mlp
            return x
      `,
      beats: [
        { id: 'r1', say: 'So here is the modern block. Pre-norm keeps the residual stream a clean sum, and {RMSNorm|R M S norm} keeps only the rescaling that mattered.', code: 'norm' },
        { id: 'r2', say: '{RoPE|rope} rotates queries and keys, so scores depend on relative position.', code: 'rope' },
        { id: 'r3', say: '{SwiGLU|swig-loo} puts a gate in the MLP.', code: 'mlp' },
        { id: 'r4', say: 'Grouped-query attention shrinks the {KV cache|K V cache}: two, times layers, times key-value heads, times head width, times bytes, per token.', code: 'gqa' },
        { id: 'r5', say: '{QK-norm|Q K norm} bounds the scores, and the biases are gone.', code: 'qk' },
        { id: 'r6', say: 'FlashAttention computes exact attention in tiles, so the score matrix never touches slow memory.', code: 'flash' },
        { id: 'r7', say: 'And rescaling {RoPE|rope}\'s speeds stretches a model past the context it trained on.', code: 'rope' },
        { id: 'next', say: 'In the chapter you can drag every one of these pictures yourself, then build them in the exercises. Next: the optimizers that train these blocks at scale.', pause: 0.6 },
      ],
    },
  ],
};

import type { ChapterDef } from './index';
import { MODERN_TRANSFORMER_SYMBOLS } from '../lib/modern-transformer-symbols';
import { setupBlock, setupHighway, setupKV, setupLong, setupNorms, setupOnline, setupQKNorm, setupRope, setupSwiglu } from '../lib/modern-transformer-figs';

const chapter: ChapterDef = {
  symbols: MODERN_TRANSFORMER_SYMBOLS,

  render(p) {
    p.prose(`
In [the Transformer chapter](#/transformer) you built the block of 2017: self-attention lets every token read from earlier tokens through queries, keys and values, then an MLP works on each token alone, with a residual connection and a layer norm around both. That block is still the skeleton of every large language model. But open the code of a model trained in 2024 and nearly every part of it has been swapped out:

- the norm moved from after each sub-block to before it (**pre-norm**), and lost its mean (**RMSNorm**);
- positions stopped being added to the input and became **rotations** of queries and keys (**RoPE**);
- the ReLU MLP became a gated **SwiGLU**;
- groups of query heads now share their keys and values (**GQA**), to shrink the **KV cache**;
- queries and keys got a norm of their own (**QK-norm**), and the biases are gone;
- attention is computed in tiles that fit in on-chip memory (**FlashAttention**), with exactly the same result;
- and the rotation speeds get rescaled to stretch a model to contexts it never trained on.

None of this changes what attention *is*. Each change fixes a specific problem that showed up when models got deeper, read longer texts, grew larger, or had to be served to millions of people at once. This chapter takes them one at a time: the problem, the fix, what it costs, and one picture that makes it obvious.`);

    p.h2('The block, then and now', 'the-block');
    p.prose(`Here are the two blocks side by side, as diagrams and as code. Tap any part to see what it does and where this chapter explains it.`);

    p.figure({
      title: 'The 2017 block and the modern block',
      codeTitle: 'blocks.py',
      code: `
        def block_2017(x):  # post-norm                #@old
            q, k = x @ Wq + bq, x @ Wk + bk            #@old,o_attn
            v = x @ Wv + bv                            #@old,o_attn
            a = attention(q, k, v) @ Wo + bo           #@old,o_attn
            x = layer_norm(x + a)                      #@old,o_norm1
            m = relu(x @ W1 + b1) @ W2 + b2            #@old,o_mlp
            x = layer_norm(x + m)                      #@old,o_norm2
            return x                                   #@old

        def block_modern(x, pos):  # pre-norm          #@new
            h = rms_norm(x)                            #@new,norm1
            q, k, v = h @ Wq, h @ Wk, h @ Wv           #@new,qkv
            q, k = rms_norm(q), rms_norm(k)            #@new,qknorm
            q, k = rope(q, pos), rope(k, pos)          #@new,rope
            a = flash_attention(q, k, v)               #@new,attn
            x = x + a @ Wo                             #@new,attn
            h = rms_norm(x)                            #@new,norm2
            m = silu(h @ W1) * (h @ W3)                #@new,mlp
            x = x + m @ W2                             #@new,mlp
            return x                                   #@new
      `,
      setup: setupBlock,
      caption: `The orange line is the **residual stream**: the running vector each sub-block reads from and adds to. In 2017 the LayerNorm sits *on* that line, so every block rescales everything below it; in the modern block the norms sit on the branches and the stream is only ever added to. Switch between the blocks and tap a part: its lines light up in the code, and the note under the diagram links to its section.`,
    });

    p.table(
      ['', 'Transformer (2017)', 'GPT-2 (2019)', 'Llama 3 8B (2024)'],
      [
        ['Norm placement', 'post-norm', 'pre-norm', 'pre-norm'],
        ['Norm', 'LayerNorm', 'LayerNorm', 'RMSNorm'],
        ['Positions', 'sinusoids added to the input', 'learned table added to the input', 'RoPE (base 500,000) in every layer'],
        ['MLP', 'ReLU, width $4\\symd$', 'GELU, width $4\\symd$', 'SwiGLU, width $3.5\\symd$'],
        ['Heads', '8 query, 8 key/value (base model)', '12 query, 12 key/value (small)', '32 query, 8 key/value'],
        ['Biases', 'yes', 'yes', 'none'],
        ['Context', 'sentence pairs', '1,024 tokens', '8,192 tokens (128K in Llama 3.1)'],
      ],
      { caption: 'GPT-2 had already moved the norm in front of each sub-block; everything else changed later. Llama 3 values are from Meta\'s published configuration.' },
    );

    // ------------------------------------------------------------ pre-norm
    p.h2('Pre-norm: keep the highway clear', 'pre-norm');
    p.prose(`
A residual connection makes each layer *add* to a running vector instead of replacing it: $\\symx_{l+1} = \\symx_l + F_l(\\symx_l)$, where $F_l$ is the layer's sub-block (attention, or the MLP). That running vector is the **residual stream**. Its virtue, the reason ResNets could stack a hundred layers ([ConvNets](#/convnets)), is that the gradient has a direct route back: the derivative of $\\symx_{l+1}$ with respect to $\\symx_l$ is *1 plus something*, never just the something ([backprop](#/backprop) multiplies these local derivatives along every path).

The 2017 Transformer put its LayerNorm on that route. After every sub-block, the whole stream is normalized: $\\symx_{l+1} = \\mathrm{LN}(\\symx_l + F_l(\\symx_l))$. That arrangement is **post-norm**. Moving the norm inside the branch, so that only the copy fed into the sub-block gets normalized, is **pre-norm**:`);

    p.math({
      label: 'Post-norm versus pre-norm',
      tex: String.raw`\begin{aligned}\text{post-norm:}\quad \symx_{l+1} &= \mathrm{Norm}\big(\symx_l + F_l(\symx_l)\big)\\ \text{pre-norm:}\quad \symx_{l+1} &= \symx_l + F_l\big(\mathrm{Norm}(\symx_l)\big)\end{aligned}`,
      codeTitle: 'norm_placement.py',
      code: `
        def post_norm_layer(x, F):
            return layer_norm(x + F(x))

        def pre_norm_layer(x, F):
            return x + F(rms_norm(x))

        def pre_norm_stack(x, Fs):
            for F in Fs:
                x = pre_norm_layer(x, F)
            return rms_norm(x)  # final norm
      `,
      terms: [
        [String.raw`\symx_l`, 'the residual stream as it enters layer $l$: one vector per token'],
        [String.raw`F_l`, "layer $l$'s sub-block: attention or the MLP, with its own weights"],
        [String.raw`\mathrm{Norm}`, 'a normalization (LayerNorm or RMSNorm) that rescales a vector to a fixed size'],
        [String.raw`\mathrm{Norm}\big(\symx_l + F_l(\symx_l)\big)`, 'post-norm: add first, then normalize the *whole stream*'],
        [String.raw`\symx_l + F_l\big(\mathrm{Norm}(\symx_l)\big)`, 'pre-norm: normalize a *copy*, feed it to the sub-block, add the result to the untouched stream'],
      ],
      explain: `Unroll pre-norm and the top of the stack is a plain sum: $\\symx_L = \\symx_0 + F_0(\\dots) + F_1(\\dots) + \\dots + F_{L-1}(\\dots)$. Every layer writes into the same sum with weight 1, and the derivative of the top with respect to any layer's output contains a plain 1: a gradient highway from the loss to every layer, however deep. In post-norm each LayerNorm divides the stream by its spread, so anything written early is divided again by every norm above it. Because the pre-norm stream is never normalized on the way up, one extra norm goes after the last block.`,
    });

    p.prose(`
How much does that division cost? Suppose a sub-block's output is about as large as the stream it is added to, which is roughly what standard initialization gives. Then the sum is about $\\sqrt{2}$ times larger than either part, and the norm divides it back down. One layer up, an earlier write has lost a factor of $\\sqrt 2$; 24 layers up, a factor of $2^{12} = 4096$. The figure measures this on a real (random) stack rather than trusting the estimate.`);

    p.figure({
      title: 'How much of each write reaches the top',
      codeTitle: 'highway.py',
      code: `
        L, beta = {{L:24}}, {{beta:1}}  # depth, branch scale
        # F[l]: ReLU MLP, output times beta
        x = np.random.randn(d)
        reach = np.ones(L + 1)  # at the top
        for l in range(L):
            if mode == '{{mode:post}}':
                y = x + F[l](x)                  #@post
                sigma = y.std()                  #@post
                x = (y - y.mean()) / sigma       #@post
                reach[:l + 2] /= sigma  # shrink #@post
            else:
                x = x + F[l](layer_norm(x))      #@pre
        # reach[0] = {{r0}}, top RMS = {{rms}}
      `,
      setup: setupHighway,
      caption: `A random stack of $L$ residual blocks (each $F_l$ a small ReLU MLP), run forward once. Each bar is the weight with which one write (the embedding on the left, then each layer's output) arrives in the top stream along the identity path, on a log scale. In **post-norm** it is the product of $1/\\sigma$ over every LayerNorm above that write, measured from the real activations; the same factor scales the gradient flowing back along that path. In **pre-norm** every bar is exactly 1 (the dashed line shows the other mode). Raise the depth and watch the post-norm staircase fall off the chart. Lower the branch scale $\\beta$ (how large each sub-block's output starts, relative to the stream) and the decay slows: that is why careful initializations, and schemes like DeepNorm (2022), can rescue deep post-norm stacks. In pre-norm, read the second readout: instead of shrinking old writes, the stream itself grows with depth.`,
    });

    p.prose(`
What this bought in practice: Wang et al. (2019) trained translation Transformers with a 30-layer pre-norm encoder where post-norm failed to train, and Xiong et al. (2020) showed that at initialization post-norm's gradients are largest for the parameters near the output, which is why post-norm needed a careful learning-rate warmup to train at all; pre-norm can drop most of it. GPT-2 had already switched in 2019, and every large model since uses pre-norm.

It is not free:

- **The stream grows.** Every layer adds to it and nothing shrinks it, so its size grows roughly like the square root of the depth. A layer deep in the stack writes into an ever larger sum, and its relative say shrinks.
- **A slightly lower ceiling.** Several studies (Liu et al., 2020, among them) found that when post-norm does train, it can end slightly better. Pre-norm gives up a little of that for reliability, and at scale, reliability wins.

Some recent models also normalize each sub-block's *output* before adding it to the stream (Gemma 2 normalizes both the input and the output of every sub-block; OLMo 2 moved the norm to the output), which keeps the stream from growing while leaving the identity path clean.`);

    // ------------------------------------------------------------ RMSNorm
    p.h2('RMSNorm: only the scale matters', 'rmsnorm');
    p.prose(`
LayerNorm (Ba et al., 2016) does two things to a token's vector of $\\symd$ numbers. It **re-centers** them: subtract their mean, so they average to zero. Then it **re-scales** them: divide by their standard deviation, so their spread is 1. Finally a learned gain $\\symg$ and bias $b$, one number per channel, let the network stretch and shift each channel back if it wants.

**RMSNorm** (Zhang and Sennrich, 2019) keeps only the re-scaling. It divides by the **root mean square** (square every entry, average the squares, take the square root) and multiplies by the gain. No mean, no bias:`);

    p.math({
      label: 'RMSNorm',
      tex: String.raw`\mathrm{RMSNorm}(\symx)_i = \frac{\symx_i}{\sqrt{\dfrac{1}{\symd}\displaystyle\sum_{j=1}^{\symd} \symx_j^2 \;+\; \epsilon}}\;\symg_i`,
      codeTitle: 'norms.py',
      code: `
        def layer_norm(x, g, b, eps=1e-5):
            mu = x.mean(-1, keepdims=True)
            var = x.var(-1, keepdims=True)
            xhat = (x - mu) / np.sqrt(var + eps)
            return xhat * g + b

        def rms_norm(x, g, eps=1e-6):
            ms = (x * x).mean(-1, keepdims=True)
            return x / np.sqrt(ms + eps) * g
      `,
      terms: [
        [String.raw`\symx_i`, 'entry $i$ of one token\'s vector'],
        [String.raw`\frac{1}{\symd}\sum_{j=1}^{\symd} \symx_j^2`, 'the mean of the squared entries: add up all $\\symd$ squares, divide by $\\symd$'],
        [String.raw`\sqrt{\,\cdot + \epsilon\,}`, 'its square root is the RMS, a typical entry size. The tiny $\\epsilon$ avoids dividing by zero'],
        [String.raw`\symg_i`, 'the learned gain for channel $i$, initialized to 1'],
      ],
      explain: `Dividing by the RMS makes the vector's typical entry size exactly 1, whatever came in. Compared with LayerNorm, RMSNorm skips the mean, so it needs one pass over the vector (sum of squares) instead of two (a mean, then a variance around it), and has no bias. The paper's hypothesis was that LayerNorm's benefit comes from the re-scaling, which keeps each layer's input at a fixed size however the weights below it drift, and that re-centering adds little. Experiments agreed: the same quality, in less time. Norms are a tiny share of a model's arithmetic, but each one reads and writes the whole activation, so a simpler one is a real saving. T5 (2019) used this simplified norm, and LLaMA (2023) made it the standard.`,
    });

    p.figure({
      title: 'What each norm ignores',
      codeTitle: 'shift_and_scale.py',
      code: `
        x0 = np.array([{{xa}},
                       {{xb}}])
        x = {{a:1}} * x0 + {{c:0}}  # scale, shift

        def layer_norm(x, eps=1e-5):
            mu = x.mean()                         #@ln
            var = ((x - mu) ** 2).mean()          #@ln
            return (x - mu) / np.sqrt(var + eps)  #@ln

        def rms_norm(x, eps=1e-6):
            ms = (x ** 2).mean()                  #@rms
            return x / np.sqrt(ms + eps)          #@rms

        ln, rms = layer_norm(x), rms_norm(x)
        # mean(x) = {{mu}}, rms(x) = {{r}}
      `,
      setup: setupNorms,
      caption: `Eight numbers $\\symx$ (drag the orange bars), and what each norm makes of them (gains left at 1). **Scale** them: both outputs stay exactly the same, because dividing by the spread or by the RMS cancels any common factor. **Shift** them: LayerNorm does not budge, since it subtracts the mean first, but RMSNorm's output changes; push the shift far and it squeezes every entry toward $+1$ (or $-1$). That lost shift invariance is the whole price of RMSNorm, and in practice networks do not miss it.`,
    });

    // ------------------------------------------------------------ RoPE
    p.h2('Rotary position embeddings', 'rope');
    p.prose(`
Attention by itself has no sense of order: shuffle the tokens and every token gets the same output, just shuffled. The 2017 fix was to add a position vector to each token's embedding at the bottom of the stack: fixed sinusoids in the original, a learned table in GPT-2. Two things about that were never quite right.

First, attention mostly cares about *relative* position ("the word just before me", "the subject three words back"), but an added absolute vector makes the model work out differences of positions from two vectors that have been blended into the content. Second, a learned table simply has no row for position 2,049 if training stopped at 2,048.

**RoPE** (Su et al., 2021, in the RoFormer paper) puts position into the one place attention looks: the dot product of a query with a key. Split each query and key vector into pairs of numbers, and treat each pair as an arrow in a plane. At position $m$, rotate pair $i$ by the angle $m\\symtheta_i$:`);

    p.math({
      label: 'RoPE: rotate each pair by its position',
      tex: String.raw`\begin{bmatrix} \sym{q}{q'_{2i}} \\ \sym{q}{q'_{2i+1}} \end{bmatrix} = \begin{bmatrix} \cos m\symtheta_i & -\sin m\symtheta_i \\ \sin m\symtheta_i & \phantom{-}\cos m\symtheta_i \end{bmatrix}\begin{bmatrix} \sym{q}{q_{2i}} \\ \sym{q}{q_{2i+1}} \end{bmatrix}, \qquad \symtheta_i = 10000^{-2i/\symd}`,
      codeTitle: 'rope.py',
      code: `
        j = np.arange(0, d, 2)        # j = 2i
        theta = 10000.0 ** (-j / d)   # (d/2,)
        a = m * theta                 # per pair
        c, s = np.cos(a), np.sin(a)
        q0, q1 = q[0::2], q[1::2]   # pairs
        q_m = np.empty_like(q)
        q_m[0::2] = q0 * c - q1 * s
        q_m[1::2] = q0 * s + q1 * c
      `,
      terms: [
        [String.raw`\sym{q}{q_{2i}},\ \sym{q}{q_{2i+1}}`, 'pair $i$ of the query: entries $2i$ and $2i+1$, read as the x and y of an arrow'],
        [String.raw`m`, "the token's position in the sequence: 0, 1, 2, ..."],
        [String.raw`\symtheta_i`, 'the speed of pair $i$, in radians per token'],
        [String.raw`10000^{-2i/\symd}`, 'speeds fall geometrically: 1 radian per token for pair 0, about $1/10000$ for the last pair'],
        [String.raw`\begin{bmatrix}\cos & -\sin \\ \sin & \cos\end{bmatrix}`, 'the rotation matrix: it turns an arrow by the angle $m\\symtheta_i$ without changing its length'],
      ],
      explain: `Keys get exactly the same treatment at their own positions; values are never rotated. The rotation happens inside every attention layer, right before the scores are computed, and nothing is ever added to the residual stream. RoPE has no parameters: the speeds are fixed.`,
    });

    p.callout('math', `A point on a circle of radius 1 at angle $a$ (measured counterclockwise from the x axis, in radians: $2\\pi$ is a full turn) sits at $(\\cos a, \\sin a)$. The matrix $\\begin{bmatrix}\\cos a & -\\sin a\\\\ \\sin a & \\cos a\\end{bmatrix}$ turns *any* arrow by $a$, keeping its length. Two facts carry this whole section: rotating by $a$ and then by $b$ is a rotation by $a + b$, and rotating two arrows by the same angle leaves the angle between them, and so their dot product, unchanged.`, 'Math help: rotations');

    p.prose(`That second fact is the point of RoPE:`);
    p.math({
      label: 'Only the offset survives',
      tex: String.raw`\big(R_{m}\,\symq\big)\cdot\big(R_{n}\,\symk\big) \;=\; \symq \cdot \big(R_{n-m}\,\symk\big)`,
      codeTitle: 'relative.py',
      code: `
        q = np.random.randn(d)
        k = np.random.randn(d)
        s1 = rope(q, 3) @ rope(k, 7)
        s2 = rope(q, 103) @ rope(k, 107)  # +100
        s3 = q @ rope(k, 7 - 3)   # offset only
        np.allclose([s1, s2], s3)  # True
      `,
      terms: [
        [String.raw`R_m`, 'rotate every pair $i$ by $m\\symtheta_i$: the RoPE of position $m$'],
        [String.raw`R_m\,\symq`, 'the query of a token at position $m$, after RoPE'],
        [String.raw`R_n\,\symk`, 'the key of a token at position $n$, after RoPE'],
        [String.raw`R_{n-m}\,\symk`, 'the key rotated by the *difference* of positions alone'],
      ],
      explain: `Rotating the query by $m\\symtheta_i$ and the key by $n\\symtheta_i$ is the same as leaving the query alone and rotating the key by $(n-m)\\symtheta_i$: undo the query's rotation on both, and the angles subtract. So the attention score depends on the two positions only through their offset $n - m$. Relative position, for free, from an operation applied to each token separately.`,
    });

    p.figure({
      title: 'RoPE: eight clock hands per vector',
      codeTitle: 'rope_score.py',
      code: `
        d = 16                  # 8 pairs
        j = np.arange(0, d, 2)                    #@theta
        theta = 10000.0 ** (-j / d)  # 8 speeds   #@theta

        def rope(x, pos):
            a = pos * theta     # angle per pair  #@ang
            c, s = np.cos(a), np.sin(a)           #@ang
            x0, x1 = x[0::2], x[1::2]
            out = np.empty_like(x)
            out[0::2] = x0 * c - x1 * s           #@rot
            out[1::2] = x0 * s + x1 * c           #@rot
            return out

        q_m = rope(q, {{m:3}})   # query at m     #@q
        k_n = rope(k, {{n:7}})   # key at n       #@k
        score = q_m @ k_n      # {{score}}      #@score
        # n - m = {{diff}}: shift both, same score
      `,
      setup: setupRope,
      caption: `One query and one key with 16 numbers each, so 8 pairs. The plot shows one pair: dashed arrows are the raw query and key, solid ones are after rotation to positions $m$ and $n$, and the purple arc is the angle between them. The dials show all 8 pairs at once, like clock hands running at 8 speeds (teal: query, green: key). Move **shift both**: every hand turns, but within each dial the two hands keep their angle, and the score does not change. Move only $m$ or $n$ and it does. The fast pairs on the left tell neighbors apart; the slow pairs on the right barely move over 48 tokens and carry coarse, long-range position.`,
    });

    p.prose(`
Why so many speeds? For the same reason a clock has three hands. A single fast pair wraps around every 6 tokens, so on its own it cannot tell an offset of 1 from an offset of 7; a single slow pair cannot tell neighbors apart at all. Together, like a second hand, a minute hand and an hour hand, they pin down any offset within the range the model was trained on. (That last condition comes back in the final section, on stretching the context.)

RoPE costs a few multiplications per query and key entry and no parameters. GPT-J and GPT-NeoX adopted it in 2021, PaLM in 2022, LLaMA in 2023, and almost every model since.`);

    p.callout('aside', `Many implementations pair entry $j$ with entry $j + \\symd/2$ (the "rotate half" trick) instead of adjacent entries $2i$ and $2i+1$. That is a fixed reshuffle of the coordinates, so the math is identical, but a checkpoint has to be run with the convention it was trained with.`, 'Two pairing conventions');

    // ------------------------------------------------------------ SwiGLU
    p.h2('SwiGLU: a gated MLP', 'swiglu');
    p.prose(`
The 2017 MLP is two matrices with a ReLU between them, $\\max(0, \\symx\\symW_1)\\symW_2$, with a hidden layer four times as wide as the model. Each hidden unit computes one linear feature of the token's vector and clips it at zero.

A **gated linear unit** (GLU; Dauphin et al., 2017) computes *two* linear features and multiplies them, one of them first passed through an activation function that acts as a *gate*. Noam Shazeer (2020) tried several gates inside the Transformer's MLP; the GELU-gated and Swish-gated versions (GeGLU and SwiGLU) gave the best language-modeling quality. SwiGLU, adopted by PaLM and LLaMA, is now the default:`);

    p.math({
      label: 'The SwiGLU feed-forward layer',
      tex: String.raw`\mathrm{FFN}(\symx) = \Big(\mathrm{SiLU}(\symx\sym{W}{W_1}) \odot \symx\sym{W}{W_3}\Big)\sym{W}{W_2}, \qquad \mathrm{SiLU}(z) = z\,\sigma(z) = \frac{z}{1 + e^{-z}}`,
      codeTitle: 'swiglu.py',
      code: `
        def silu(z):
            return z / (1 + np.exp(-z))

        d, d_ff = 512, 1536  # about 8/3 * d
        rn = np.random.randn
        W1 = rn(d, d_ff) / np.sqrt(d)     # gate
        W3 = rn(d, d_ff) / np.sqrt(d)     # up
        W2 = rn(d_ff, d) / np.sqrt(d_ff)  # down

        def swiglu(x):  # x: (T, d)
            h = silu(x @ W1) * (x @ W3)
            return h @ W2
      `,
      terms: [
        [String.raw`\symx\sym{W}{W_1}`, 'the gate: one linear feature per hidden unit'],
        [String.raw`\mathrm{SiLU}`, 'the Sigmoid Linear Unit (also called Swish): $z$ times the sigmoid of $z$, a smooth ReLU'],
        [String.raw`\symx\sym{W}{W_3}`, 'a second linear feature per hidden unit, with no activation at all'],
        [String.raw`\odot`, 'multiply entry by entry: the gate scales the second feature'],
        [String.raw`\sym{W}{W_2}`, 'project the hidden units back down to the model width $\\symd$'],
      ],
      explain: `Three matrices instead of two. To keep the parameter count, and the arithmetic, equal to the old MLP, the hidden width shrinks from $4\\symd$ to $\\tfrac{8}{3}\\symd$, because $3 \\times \\symd \\times \\tfrac{8}{3}\\symd = 2 \\times \\symd \\times 4\\symd$. LLaMA's 7B model uses 11,008 hidden units for $\\symd = 4096$: $\\tfrac{8}{3} \\times 4096$, rounded up to a multiple of 256. (Llama 3 later went wider, 14,336.) The sigmoid $\\sigma(z) = 1/(1 + e^{-z})$ is the S-shaped curve from 0 to 1 you met in [the neural networks chapter](#/nn-architecture).`,
    });

    p.figure({
      title: 'One hidden unit on a 2-D input',
      codeTitle: 'gated_unit.py',
      code: `
        def relu_mlp(x):  # 2 matrices
            return relu(x @ W1) @ W2               #@relu

        def silu(z):
            return z / (1 + np.exp(-z))            #@silu

        def swiglu_mlp(x):  # 3 matrices
            h = silu(x @ W1) * (x @ W3)            #@swiglu
            return h @ W2                          #@swiglu

        # one hidden unit on a 2-D input x:
        w1 = np.array([{{w10}}, {{w11}}])  # W1 column
        w3 = np.array([{{w30}}, {{w31}}])  # W3 column
        unit = {{unit:silu(x @ w1) * (x @ w3)}}    #@unit
      `,
      setup: setupSwiglu,
      caption: `One hidden unit on a 2-D input, so its whole response fits on screen: orange where it outputs a positive number, blue where negative. Drag the arrow tips. A **ReLU** unit is a ramp: zero on one side of a line (dashed), rising steadily on the other. **GELU** is nearly the same ramp with a soft corner. A **SwiGLU** unit multiplies two directions: it is near zero along two lines, can go negative, and grows like a product $a \\cdot b$ of two features. That multiplicative interaction ("this feature, but scaled by that one") takes a ReLU network several units to imitate. The small plot compares the activations: SiLU is a smooth ReLU that dips slightly below zero.`,
    });

    p.prose(`
Why does gating work better? The honest answer is that the evidence is empirical: across many experiments, gated MLPs reach a lower loss at the same size. Shazeer's paper ends with a famous shrug: "We offer no explanation as to why these architectures seem to work; we attribute their success, as all else, to divine benevolence." The multiplicative picture above is the usual intuition. The cost is small: a third matrix (with the same total parameters at the narrower width) and one more entry-by-entry multiply.`);

    // ------------------------------------------------------------ KV cache and GQA
    p.h2('The KV cache, and sharing it: MQA and GQA', 'gqa');
    p.prose(`
### The KV cache

Generating text is a loop: run the model on the tokens so far, sample one more token, append it, repeat. In a causal model, the keys and values of earlier tokens never change when a token is added, since they only ever looked backward. So instead of recomputing them on every step, a server keeps them: the **KV cache**. Each new token computes only its own query, key and value, stores the key and value, and attends over everything stored.

The cache trades compute for memory, and the memory is large. For every token, every layer stores one key vector and one value vector for each key/value head:`);

    p.math({
      label: 'KV-cache memory per token',
      tex: String.raw`\text{bytes per token} \;=\; 2 \times n_{\text{layers}} \times n_{\text{kv heads}} \times \sym{d}{d_{\text{head}}} \times \text{bytes per number}`,
      codeTitle: 'kv_cache.py',
      code: `
        def kv_bytes(layers, kv_heads, d_head,
                seq_len, batch=1, nbytes=2):
            per_token = (2 * layers * kv_heads
                         * d_head * nbytes)
            return per_token * seq_len * batch

        GiB = 2 ** 30
        # Llama 2 7B: 32 kv heads, Llama 3 8B: 8
        kv_bytes(32, 32, 128, 4096) / GiB  # 2.0
        kv_bytes(32, 8, 128, 4096) / GiB   # 0.5
      `,
      terms: [
        [String.raw`2`, 'one key and one value'],
        [String.raw`n_{\text{layers}}`, 'every layer has its own attention, so its own keys and values'],
        [String.raw`n_{\text{kv heads}}`, 'how many separate key/value heads each layer keeps'],
        [String.raw`\sym{d}{d_{\text{head}}}`, 'the length of one head\'s key (and value) vector'],
        [String.raw`\text{bytes per number}`, '2 for bf16, 1 for an 8-bit cache'],
      ],
      explain: `Llama 2 7B has 32 layers and 32 heads of width 128, stored in bf16 (2 bytes): $2 \\times 32 \\times 32 \\times 128 \\times 2 = 524{,}288$ bytes, half a megabyte for every token. Its full 4,096-token context is 2 GiB per sequence, on top of about 13 GB of weights, and a server wants dozens of sequences in flight at once. Worse, generating each token means reading the whole cache from memory, so its size sets the speed as well as the capacity.`,
    });

    p.prose(`
### Share the keys and values

Multi-head attention gives every query head its own key head and value head. **Multi-query attention** (MQA; Shazeer, 2019) keeps all the query heads but gives them one shared key head and one shared value head, so the cache shrinks by the number of heads. That costs some quality, and training can be less stable. **Grouped-query attention** (GQA; Ainslie et al., 2023) is the middle ground: split the query heads into groups, and share one key head and one value head per group. With 8 groups it comes close to multi-head quality at a fraction of the cache, and the paper showed that an existing multi-head checkpoint can be converted (by averaging the key and value heads within each group) and briefly retrained. Llama 2 70B, Mistral 7B and every Llama 3 model use 8 key/value heads.`);

    p.code(`
      # q: (n_heads, T, d_head)
      # k, v: (n_kv_heads, T, d_head)
      group = n_heads // n_kv_heads
      # shared copies, not new weights:
      k = np.repeat(k, group, axis=0)
      v = np.repeat(v, group, axis=0)
      S = q @ k.swapaxes(1, 2)
      S = S / np.sqrt(d_head)
      out = softmax(S + causal_mask) @ v
    `, { title: 'gqa.py' });

    p.prose(`Real kernels never materialize the repeated copies; they just point each group of query heads at its shared key and value head. Only the small, unrepeated \`k\` and \`v\` go into the cache.`);

    p.figure({
      title: 'A KV-cache calculator',
      codeTitle: 'kv_budget.py',
      code: `
        # {{name:Llama 3 8B}}
        n_layers, d_head = {{L:32}}, {{dh:128}}
        n_heads, n_kv_heads = {{H:32}}, {{kv:8}}
        nbytes = {{b:2}}        # bf16: 2, fp8: 1

        # one K and one V per layer and kv head
        per_token = (2 * n_layers * n_kv_heads  #@tok
                     * d_head * nbytes)         #@tok
        cache = per_token * seq_len * batch     #@total
        # seq_len = {{T:8K}}, batch = {{B:1}}
        # per_token = {{pt}}
        # cache = {{tot}}, weights = {{wt}}
      `,
      setup: setupKV,
      caption: `Pick a published model, then change its number of key/value heads. The top shows which query heads share which key (green) and value (gold) head; the bars compare the cache with the weights and with one 80 GB GPU. Try **Llama 2 7B** at 4K context with batch 32: the cache alone is 64 GiB, about five times the weights. **Llama 3 8B**, a model of about the same size, keeps 8 key/value heads and needs a quarter of the cache per token. Context and batch scale the cache linearly; the number of key/value heads and the cache's number format are the knobs a model designer controls.`,
    });

    p.prose(`
DeepSeek-V2 (2024) went further with **multi-head latent attention**, caching one small compressed vector per token and layer from which the keys and values are re-expanded. Serving systems add their own tricks on top (paged cache memory, batching many requests, quantized caches); those belong to [fast inference](#/inference).`);

    // ------------------------------------------------------------ stability
    p.h2('QK-norm and no biases', 'stability');
    p.prose(`
### Attention logit growth

An attention score is a scaled dot product, $\\symS = \\symq \\cdot \\symk / \\sqrt{\\symd}$. If training slowly grows the weights that make queries and keys, both vectors grow, and the score grows with the *product* of their lengths. Large scores make the softmax nearly one-hot: one key takes almost all the weight. A saturated softmax passes almost no gradient to the other keys, and training can stall or blow up. Dehghani et al. (2023) hit exactly this while scaling a vision transformer to 22 billion parameters: the loss diverged early in training, and the attention logits had grown enormous. Wortsman et al. (2023) reproduced the same instability in small models trained at high learning rates.

The fix, **QK-norm**, normalizes each query and key (per head) right before the dot product:`);

    p.math({
      label: 'QK-norm',
      tex: String.raw`\symS_{ij} = \frac{\big(\symg_q \odot \hat{\symq}_i\big)\cdot\big(\symg_k \odot \hat{\symk}_j\big)}{\sqrt{\symd}}, \qquad \hat{\symq} = \frac{\symq}{\mathrm{rms}(\symq)},\ \ \hat{\symk} = \frac{\symk}{\mathrm{rms}(\symk)}`,
      codeTitle: 'qk_norm.py',
      code: `
        def scores(x, Wq, Wk, g_q, g_k):
            q, k = x @ Wq, x @ Wk  # one head
            q = rms_norm(q) * g_q  # QK-norm
            k = rms_norm(k) * g_k
            return q @ k.T / np.sqrt(d)
      `,
      terms: [
        [String.raw`\hat{\symq}_i,\ \hat{\symk}_j`, 'query $i$ and key $j$, each divided by its own RMS: typical entry size 1, whatever their raw size'],
        [String.raw`\symg_q,\ \symg_k`, 'learned gains, one per channel, initialized to 1'],
        [String.raw`\symS_{ij}`, 'the score of query $i$ against key $j$, before the softmax'],
      ],
      explain: `After normalization, every query and key has RMS 1, so a score can never exceed $\\sqrt{\\symd}$ times the gains, however large the projection weights grow. The model can still make attention sharp, but only by deliberately raising the gains, not as a side effect of every other weight drifting. OLMo 2, Gemma 3 and Qwen 3 use QK-norm. (Gemma 2 used a different cure: soft-capping each logit with a tanh, so it smoothly saturates at a fixed bound.)`,
    });

    p.figure({
      title: 'Growing weights, collapsing attention',
      codeTitle: 'logit_growth.py',
      code: `
        q, K = {{s:1}} * q0, {{s:1}} * K0  # grown
        if {{qk:False}}:                    # QK-norm
            q = rms_norm(q) * g_q                 #@norm
            K = rms_norm(K) * g_k  # each row     #@norm
        scores = K @ q / np.sqrt(d)               #@logits
        A = softmax(scores)    # max {{amax}}     #@soft
        # max |score| {{smax}}
        # entropy {{H}} bits
      `,
      setup: setupQKNorm,
      caption: `One query against 8 keys, 16 numbers each. Slide the **weight growth** $s$ to scale every query and key, as if the projection weights had drifted larger during training. Without QK-norm the scores grow like $s^2$ and the attention weights collapse onto one key; the entropy (how spread out the attention is: 3 bits means all 8 keys equally, 0 means a single key) falls to zero. Turn **QK-norm** on: the weights no longer depend on $s$ at all, and its curve below stays flat.`,
    });

    p.prose(`
### No biases

The 2017 block added a learned bias vector after nearly every matrix multiply, and each LayerNorm had one too. PaLM (2022) removed every one of them and reported that this improved training stability for large models; LLaMA followed, and most models since have no biases anywhere. They were cheap to give up: a bias adds $\\symd$ numbers next to a matrix of $\\symd^2$, and some do nothing at all. A bias on the keys is the clean example:`);

    p.math({
      label: 'A key bias cancels in the softmax',
      tex: String.raw`\mathrm{softmax}_j\big(\symq\cdot(\symk_j + b)\big) = \mathrm{softmax}_j\big(\symq\cdot \symk_j + \underbrace{\symq\cdot b}_{\text{same for every } j}\big) = \mathrm{softmax}_j\big(\symq\cdot\symk_j\big)`,
      codeTitle: 'key_bias.py',
      code: `
        q = np.random.randn(d)
        K = np.random.randn(T, d)  # keys
        b = np.random.randn(d)     # key bias
        A1 = softmax(K @ q)
        A2 = softmax((K + b) @ q)  # + q @ b
        np.allclose(A1, A2)        # True
      `,
      terms: [
        [String.raw`\symk_j + b`, 'key $j$ with a learned bias $b$ added (the same $b$ for every key)'],
        [String.raw`\symq\cdot b`, 'what the bias adds to every score in this row: one number, independent of $j$'],
        [String.raw`\mathrm{softmax}_j`, 'the softmax over keys $j$, which ignores any constant added to all of its inputs'],
      ],
      explain: `Adding the same number to every input of a softmax multiplies every exponential by the same factor, which cancels in the division (the same reason the [numerical-stability trick](#/linear-classification/softmax) of subtracting the max works). So a key bias has no effect on the attention weights, and its gradient is exactly zero. A few model families kept biases on the query, key and value projections (Qwen through version 2.5), but nearly everything else is bias-free. Pretraining runs that see each token only once also mostly set dropout to zero, the other piece of 2017 regularization that scale made unnecessary.`,
    });

    // ------------------------------------------------------------ FlashAttention
    p.h2('FlashAttention: never write the score matrix', 'flash');
    p.prose(`
### The memory wall

A GPU has two kinds of memory that matter here. **HBM** is large but comparatively slow: an A100 has 40 to 80 GB of it, read at about 1.5 to 2 TB/s. **SRAM** sits on the chip next to the arithmetic units and is about ten times faster, but tiny: 192 KB for each of the A100's 108 streaming multiprocessors (the FlashAttention paper's figures). The arithmetic units are so fast that many operations spend most of their time waiting on HBM.

Standard attention is one of them. It computes the scores $\\symS = \\sym{q}{Q}\\sym{k}{K}^\\top/\\sqrt{\\symd}$, writes the $T \\times T$ matrix to HBM, reads it back for the softmax, writes the weights, and reads them again to multiply by $\\sym{v}{V}$. At $T = 8192$, one head's score matrix in bf16 is 128 MiB, for every head, every layer and every sequence. The traffic grows with $T^2$ and dominates the time.

The obvious fix is to load a block of queries and a block of keys into SRAM, compute that block of scores there, and never write it out. The softmax stands in the way: to normalize a row of weights you need the row's maximum (for numerical stability) and its sum, both over *all* the keys, before you can finish any output.

### Online softmax

The way around it (Milakov and Gimelshein, 2018) keeps three running numbers per query: the largest score seen so far $m$, a running sum $\\ell$, and a running, not-yet-normalized output $o$. Each new tile of keys updates them, and corrects the old totals whenever it raises the maximum:`);

    p.math({
      label: 'Online softmax, one tile at a time',
      tex: String.raw`\begin{aligned} m' &= \max\!\big(m,\ \max_{j \in \text{tile}} \symS_j\big)\\ \ell' &= e^{m - m'}\,\ell \;+\; \sum_{j \in \text{tile}} e^{\symS_j - m'}\\ o' &= e^{m - m'}\,o \;+\; \sum_{j \in \text{tile}} e^{\symS_j - m'}\,\symv_j \end{aligned} \qquad\quad \text{output} = \frac{o}{\ell}`,
      codeTitle: 'online_softmax.py',
      code: `
        def attend_in_tiles(S, V, B):  # S: (T,)
            m, l = -np.inf, 0.0
            o = np.zeros(V.shape[1])
            for a in range(0, len(S), B):
                s, Vt = S[a:a + B], V[a:a + B]
                m_new = max(m, s.max())
                c = np.exp(m - m_new)
                p = np.exp(s - m_new)
                l = c * l + p.sum()
                o = c * o + p @ Vt
                m = m_new
            return o / l    # == softmax(S) @ V
      `,
      terms: [
        [String.raw`m,\ m'`, 'the largest score so far, before and after this tile'],
        [String.raw`e^{\symS_j - m'}`, 'each new score, exponentiated relative to the current max (so nothing overflows)'],
        [String.raw`e^{m - m'}`, 'the correction: a number at most 1, exactly 1 if the max did not change'],
        [String.raw`\ell`, 'the running sum of exponentials: the softmax denominator so far'],
        [String.raw`o`, 'the running sum of exponentials times values: the output, before dividing by $\\ell$'],
      ],
      explain: `Every stored term was computed relative to the max at that time, $e^{\\symS_j - m}$. When a new tile brings a larger max $m'$, all the old terms are too large by the same factor $e^{m' - m}$, so multiplying the old sum and the old output by $e^{m - m'}$ corrects all of them at once, without revisiting a single one. After the last tile, $o / \\ell$ is exactly the softmax-weighted average of the values: the same number the direct formula gives, up to floating-point rounding.`,
    });

    p.figure({
      title: 'Online softmax over tiles',
      codeTitle: 'tiles.py',
      code: `
        S = scores_row      # one query, 12 keys
        m, l, o = -np.inf, 0.0, 0.0             #@init
        for a in range(0, 12, {{B:4}}):  # tiles
            s, vt = S[a:a + B], v[a:a + B]      #@load
            m_new = max(m, s.max())             #@max
            c = np.exp(m - m_new)  # rescale    #@corr
            l = c * l + np.exp(s - m_new).sum() #@sum
            o = c * o + np.exp(s - m_new) @ vt  #@acc
            m = m_new
        out = o / l                # {{out}}    #@out
        # softmax(S) @ v = {{direct}}
      `,
      setup: setupOnline,
      caption: `One query's scores against 12 keys, processed a tile at a time. Step through: each tile's scores and values are loaded, the running max may rise, and when it does, the old sum and output are rescaled (the red factor). After the last tile, $o/\\ell$ matches the direct softmax to rounding. Change the tile size: every intermediate number changes, the answer does not. **New scores** draws another row. The values here are one channel of $\\symv$; a real kernel carries a whole vector $o$ per query.`,
    });

    p.prose(`
**FlashAttention** (Dao et al., 2022) is this loop run for blocks of queries against blocks of keys inside a single GPU kernel. It never stores the $T \\times T$ matrix, so attention's extra memory grows linearly with $T$ instead of quadratically, and it reads and writes HBM far less, which made attention several times faster in the paper's benchmarks and let models train on longer sequences. It is **exact**, not an approximation: the same outputs as standard attention, up to rounding. For the backward pass it keeps only each row's $m$ and $\\ell$ and recomputes the scores tile by tile: more arithmetic, much less memory traffic, which is the trade a memory-bound GPU wants. FlashAttention-2 (2023) reorganized the work for better parallelism, and FlashAttention-3 (2024) uses the newer features of H100 GPUs.

Note what it does *not* change: attention's arithmetic still grows with $T^2$. That is one reason models are trained at a few thousand tokens and stretched afterward.`);

    p.callout('idea', `FlashAttention is a lesson that recurs throughout modern deep learning: count the bytes moved, not just the arithmetic. An exact algorithm that does *more* math can be faster if it moves less data.`, 'IO-awareness');

    // ------------------------------------------------------------ long context
    p.h2('Stretching the context', 'long-context');
    p.prose(`
Long training sequences are expensive and most documents are short, so models are pretrained at a few thousand tokens and stretched near the end. A model trained with RoPE at 4,096 tokens, then fed 16,000, usually falls apart past its training length: the loss shoots up. The clock picture says why.

Pair $i$ turns once every $2\\pi/\\symtheta_i$ tokens, its **wavelength**. Fast pairs turn many times within the training length, so they have seen every angle. But in a head of width 128 with base 10,000, the slowest pairs have wavelengths up to about 54,000 tokens: inside a 4,096-token training window they never completed a single turn. Past 4,096 tokens those pairs produce angles the model has never seen, and its attention patterns break.

The fixes all change the speeds $\\symtheta_i$:

- **Position interpolation** (PI; Chen et al., 2023) divides every speed by the stretch factor $s$, which is the same as squeezing the new positions into the trained range. No pair sees a new angle, but the fast pairs now separate neighboring tokens $s$ times less. With a short fine-tune (about 1,000 steps in the paper) it extended LLaMA models to 32K tokens.
- **NTK-aware scaling** (proposed in an online post, also 2023) raises the base instead, from $b$ to $b\\,s^{\\symd/(\\symd-2)}$: the fastest pair is untouched, the slowest is slowed by exactly $s$, with a smooth geometric change in between.
- **YaRN** (Peng et al., 2023) decides per pair: pairs that turned many times in training (more than 32 turns) keep their speed, pairs that never completed a turn are interpolated by $s$, and the pairs in between get a blend. It also slightly sharpens the attention softmax, and it needs less fine-tuning than PI.
- **A bigger base from the start.** Code Llama (2023) raised the base to 1,000,000 for its long-context training; Llama 3 uses 500,000, and Llama 3.1 reached 128K tokens with a YaRN-like per-pair rescaling plus a final stage of training on long documents.`);

    p.math({
      label: 'Two ways to rescale the speeds',
      tex: String.raw`\text{PI:}\ \ \symtheta_i' = \frac{\symtheta_i}{s} \qquad\qquad \text{NTK-aware:}\ \ \symtheta_i' = \big(b\,s^{\symd/(\symd-2)}\big)^{-2i/\symd}`,
      codeTitle: 'rescale.py',
      code: `
        i2 = np.arange(0, d, 2)
        theta = base ** (-i2 / d)
        theta_pi = theta / s       # PI
        # NTK-aware: raise the base
        base_ntk = base * s ** (d / (d - 2))
        theta_ntk = base_ntk ** (-i2 / d)
        theta_ntk[0] == theta[0]   # kept
        np.isclose(theta_ntk[-1], theta[-1] / s)
      `,
      terms: [
        [String.raw`s`, 'the stretch factor: new context length divided by the trained one'],
        [String.raw`b`, 'the RoPE base, 10,000 in the original'],
        [String.raw`\symtheta_i / s`, 'every pair slowed by the same factor'],
        [String.raw`b\,s^{\symd/(\symd-2)}`, 'a raised base: chosen so the last pair slows by exactly $s$ while pair 0 (speed $b^0 = 1$) cannot change'],
      ],
      explain: `Both make the slowest pairs turn no further over the new length than they did over the old one. They differ in what happens to the fast pairs: PI slows them too, blurring the distinction between neighboring tokens, while NTK-aware scaling leaves them almost untouched. The price of NTK-aware is in the middle: pairs that were just slow enough to never complete a turn are slowed by less than $s$, so they still meet a few new angles.`,
    });

    p.figure({
      title: 'Which rotations a longer context has never seen',
      codeTitle: 'stretch.py',
      code: `
        d, base, L_train = 128, 10000.0, 4096
        j = np.arange(0, d, 2)
        theta = base ** (-j / d)
        wavelength = 2 * np.pi / theta  # tokens
        s, method = {{s:4}}, '{{method:none}}'
        if method == 'pi':                         #@pi
            theta = theta / s                      #@pi
        elif method == 'ntk':                      #@ntk
            b2 = base * s ** (d / (d - 2))         #@ntk
            theta = b2 ** (-j / d)                 #@ntk
        elif method == 'yarn':                     #@yarn
            turns = L_train / wavelength           #@yarn
            w = np.clip((turns - 1) / 31, 0, 1)    #@yarn
            theta = theta * (w + (1 - w) / s)     #@yarn
        # unseen-angle pairs: {{bad}} of 64
      `,
      setup: setupLong,
      caption: `The 64 pairs of a 128-number head with base 10,000, trained at 4,096 tokens. Gray dots are each pair's wavelength; colored dots are after rescaling (green: unchanged, blue: slowed, red: meets angles it never saw in training). A pair above the green line never finished a turn in training. Stretch the context, then choose a method. **None**: every slow pair turns red. **PI**: nothing is unseen, but every pair is slowed, the fastest included. **NTK-aware**: the fast pairs stay put, but a band of slow-but-not-slowest pairs still overshoots a little. **YaRN**: the fast pairs stay put and the slow ones are interpolated just enough.`,
    });

    p.prose(`
Two more tools bound the cost of long contexts rather than stretching positions. **Sliding-window attention** lets each token attend only to the previous few thousand tokens: Mistral 7B (2023) used a 4,096-token window, and Gemma 2 and 3 interleave such local layers with occasional global ones, which caps the KV cache and the per-token cost of most layers while information still travels further by hopping through layers. And a caution: surviving a long context (the loss does not explode) is not the same as using it well, which is why long-context models are judged on retrieval and reasoning across the whole window.`);

    p.callout('idea', `The 2024 block is the 2017 block with each part fixed for scale. **Pre-norm** keeps the residual stream a clean sum, so gradients reach every layer, and **RMSNorm** keeps only the re-scaling that mattered. **RoPE** rotates queries and keys so that scores depend on relative position. **SwiGLU** gates the MLP for better quality at the same size. **GQA** and **MQA** shrink the KV cache, which costs $2 \\times$ layers $\\times$ kv heads $\\times$ head width $\\times$ bytes for every token. **QK-norm** bounds attention scores, and the biases are gone. **FlashAttention** computes exact attention in tiles with an online softmax, so the score matrix never touches slow memory. And rescaling RoPE's speeds (PI, NTK-aware, YaRN, a bigger base) stretches a model past the context it trained on.`, 'Takeaways');

    // ------------------------------------------------------------ exercises
    p.h2('Build it yourself', 'exercises');
    p.prose(`
1. **RoPE in ten lines (warm-up).** Write \`rope(x, pos)\` for a vector of even length \`d\`, following the RoPE equation above. Check three things with random vectors: the length of the vector is unchanged, \`rope(q, m) @ rope(k, n)\` equals \`q @ rope(k, n - m)\` for many pairs of positions, and position 0 changes nothing. Then write the "rotate half" version and show that it gives the same scores once you reorder the coordinates. *Success:* every check prints \`True\`.

2. **FlashAttention's forward pass in NumPy.** Write \`flash_attention(Q, K, V, Bq, Bk, causal)\` that loops over blocks of queries and blocks of keys, keeping a running \`m\`, \`l\` and \`o\` for every query row (the online softmax of this chapter, now for a matrix of queries), skipping key blocks that the causal mask hides entirely. Compare it with naive attention for $T = 1000$ and several block sizes, then count how many numbers each version writes to arrays that live outside the inner loop. *Success:* outputs match to about $10^{-12}$, and the naive version writes a $T \\times T$ array while yours writes only arrays of size about $T \\times \\symd$.

3. **A KV-cache budget.** Using the KV-cache equation, write a function that returns how many sequences of length $T$ fit on one 80 GB GPU next to a model's bf16 weights. Tabulate it for a Llama-3-8B-like configuration with 32, 8 and 1 key/value heads, at 4K, 32K and 128K tokens, with a bf16 and an 8-bit cache. *Success:* a table, and one sentence on which knob buys the most room.

4. **Project: modernize a tiny GPT.** Start from a small character-level GPT in PyTorch (the one from [the Transformer chapter's exercises](#/transformer/exercises), or any minimal GPT), trained on a public-domain book. Apply this chapter's changes one at a time: pre-norm, RMSNorm, RoPE instead of learned positions, SwiGLU at $\\tfrac83$ width, GQA with 2 key/value heads, no biases, QK-norm. Train every variant with the same budget and seed, and record validation loss, parameter count and the largest learning rate that still trains. *Success:* a table of seven rows with parameter counts matched within a few percent, and a note on which change mattered most at your scale. (At tiny scale some changes will not matter, and that is a real result.)

5. **Project: stretch the context.** Train your RoPE model on 256-token sequences, then measure its validation loss at every position up to 1,024. Repeat with PI, NTK-aware and YaRN-style per-pair scaling applied at test time with no retraining, then fine-tune the PI version for a few hundred steps on 1,024-token sequences. *Success:* a plot of loss against position for each method, showing where the unscaled model breaks and which fix degrades least.`);
  },
};

export default chapter;

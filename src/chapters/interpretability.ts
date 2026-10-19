import type { ChapterDef } from './index';
import { figCircuits, figInduction, figLens, figPhase } from '../lib/interpretability-figs';
import { figNeurons, figProbes, figSAE, figSuperposition } from '../lib/interpretability-figs2';
import { INTERPRETABILITY_SYMBOLS } from '../lib/interpretability-symbols';

const chapter: ChapterDef = {
  symbols: INTERPRETABILITY_SYMBOLS,

  render(p) {
    p.prose(`
In CS231n's [visualizing chapter](#/visualizing) we looked inside a ConvNet with pictures: filters, saliency maps, images that excite a neuron. Those tools answer *where* a network looks. For language models the field set itself a harder goal: work out *what algorithm* a trained network runs, from its weights, the way you might read a compiled program back into source code. That program is called **mechanistic interpretability**, and since about 2020 it has gone from toy models to the frontier.

This chapter walks its main ideas in order. First the picture that makes a transformer readable: the **residual stream**, a running sum that every layer reads from and adds to. Then attention heads as two separate circuits, one deciding *where to look* and one deciding *what to move*, and a real algorithm built from two of them, the **induction head**, which appears suddenly during training and drives in-context learning. Then **linear probes** and the idea that concepts are directions. Then the obstacle, **superposition**: networks store more features than they have dimensions, which is why single neurons are so often a mess. And finally **sparse autoencoders**, the tool built to pull those features apart, along with what it still misses.`);

    /* ---------------------------------------------------------------- stream */
    p.h2('The residual stream', 'stream');
    p.prose(`
Recall the block from [Chapter 2](#/transformer): attention and an MLP, each wrapped in a residual connection, so each one *adds* its output to its input instead of replacing it. Elhage et al. (2021, *A Mathematical Framework for Transformer Circuits*) suggested reading that the other way around. Do not think of a stack of layers that each transform a vector. Think of one vector per position, the **residual stream** $\\symx$, that runs from the embedding at the bottom to the unembedding at the top. Every attention layer and every MLP *reads* from it (a layer norm, then a linear map) and *writes* to it (adds its output). Nothing is ever overwritten: what the embedding put in is still there at the top, unless some layer writes the opposite.

So the final vector is a sum: the embedding plus every layer's write.`);
    p.math({
      label: 'The residual stream is a sum of writes',
      tex: String.raw`\begin{aligned} \symx_{\ell+1} &= \symx_\ell + a_\ell + m_\ell \\[2pt] \symx_L &= \symx_0 + \sum_{\ell=0}^{L-1} \big(a_\ell + m_\ell\big) \\[2pt] \text{logits} &= \operatorname{LN}(\symx_L)\,\symU \end{aligned}`,
      code: `
        x = E[ids] + P[:T]           # x_0: (T, d) embedding + position
        for layer in layers:         # a pre-norm block
            a = layer.attn(ln(x))    # read the stream...
            x = x + a                # ...and add a write
            m = layer.mlp(ln(x))
            x = x + m
        logits = ln_f(x) @ W_U       # (T, V) read out at the top
      `,
      codeTitle: 'residual_stream.py',
      terms: [
        [String.raw`\symx_0`, 'the stream at the bottom: the token embedding plus the position embedding, one vector of $d$ numbers per position'],
        [String.raw`a_\ell,\ m_\ell`, "what layer $\\ell$'s attention and its MLP write: each is computed from (a normalized copy of) the stream and then *added* to it"],
        [String.raw`\sum_{\ell}`, 'add up every write of every layer'],
        [String.raw`\operatorname{LN}(\symx_L)\,\symU`, 'the top of the stream, normalized once more and multiplied by the unembedding $W_U$ ($d$ by $V$): one score per vocabulary token'],
      ],
      explain: `The stream is a shared scratchpad of $d$ numbers per position, a communication channel that every layer can use. A layer can write a fact into some directions of it and a much later layer can read those directions, without the layers in between having to pass it along. Since the unembedding is a matrix, each write's effect on the output can be read off by itself: multiply the write by $W_U$ and you have its *direct* contribution to the logits (exactly so in the model below, which has no layer norm; approximately in real models, where the final layer norm's scale is held fixed).`,
    });

    p.prose(`
### A model small enough to read

The figures on attention below all use one small model, small enough to understand completely. It is a two-layer transformer made of **attention only**: no MLPs and no layer norm, one head per layer, a vocabulary of 20 letters, a stream $d = 32$ numbers wide and heads 16 wide. It was trained offline, in PyTorch, for 4,000 steps on batches of 64 sequences of 32 random letters that repeat with a random period between 6 and 16 letters, like \`KDRAMQKDRAMQKD...\`. The only way to beat a blind guess is to notice that the letters have started repeating. The figures run its trained weights, and their forward pass reproduces PyTorch's logits to within 0.00001.

With no layer norm, this model's stream is exactly a sum of three pieces: $\\symx_2 = \\symx_0 + \\text{head}_0 + \\text{head}_1$, and its logits are $\\symx_2\\symU$.

### The logit lens

If the output is the top of the stream multiplied by $\\symU$, why not multiply the *middle* of the stream by $\\symU$ too, and see what the model "would say" if it stopped there? That is the **logit lens** (nostalgebraist, 2020).`);
    p.math({
      label: 'The logit lens',
      tex: String.raw`p_\ell = \operatorname{softmax}\big(\operatorname{LN}(\symx_\ell)\,\symU\big)`,
      code: `
        hidden = model(ids, output_hidden_states=True).hidden_states
        for l, x in enumerate(hidden):    # x_0 ... x_L: (T, d)
            p = softmax(ln_f(x) @ W_U)    # decode layer l
            print(l, p[-1].argmax())      # its guess for the next token
      `,
      codeTitle: 'logit_lens.py',
      terms: [
        [String.raw`\symx_\ell`, 'the stream after $\\ell$ layers, at one position'],
        [String.raw`\operatorname{LN}(\cdot)\,\symU`, 'the same final layer norm and unembedding the model uses at the top, applied early'],
        [String.raw`p_\ell`, 'a probability for every token: the prediction the stream holds so far'],
      ],
      explain: `In GPT-2 this gives a readable story: early layers guess generic tokens, and the right answer climbs the ranking layer by layer. It works because every layer adds to the same stream that the unembedding finally reads. It works imperfectly because early layers are free to write in directions the unembedding ignores, messages meant for later layers. The **tuned lens** (Belrose et al., 2023) fixes some of that by training one small linear map per layer to translate the stream before decoding.`,
    });
    figLens(p);

    /* ---------------------------------------------------------------- heads */
    p.h2('Attention heads move information', 'heads');
    p.prose(`
The figure leaves a question: what did the two heads do? An attention head does two separate jobs, and the algebra lets us pull them apart. Its queries and keys only ever meet in the product $QK^{\\top} = \\symx W_Q W_K^{\\top} \\symx^{\\top}$, and its values only reach the stream through $W_O$. So the four matrices of [Chapter 2](#/transformer) collapse into two:`);
    p.math({
      label: 'A head is a QK circuit and an OV circuit',
      tex: String.raw`\begin{aligned} \symA_{ij} &= \operatorname{softmax}_j\!\left(\frac{\symx_i\,\symQK\,\symx_j^{\top}}{\sqrt{d_h}}\right), \quad \symQK = W_Q W_K^{\top} \\[2pt] \text{head}(\symx)_i &= \sum_{j \le i} \symA_{ij}\; \symx_j\, \symOV, \quad \symOV = W_V W_O \end{aligned}`,
      code: `
        W_QK = Wq @ Wk.T        # (d, d): where to look
        W_OV = Wv @ Wo          # (d, d): what to move
        scores = x @ W_QK @ x.T / np.sqrt(d_h)   # = Q @ K.T / sqrt(d_h)
        A = softmax(scores + causal_mask, axis=1)
        out = A @ x @ W_OV      # (T, d) = (A @ V) @ Wo
      `,
      codeTitle: 'qk_ov.py',
      terms: [
        [String.raw`\symQK`, 'the **QK circuit**: one $d$ by $d$ matrix that scores how much position $i$ wants to attend to position $j$'],
        [String.raw`\symx_i\,\symQK\,\symx_j^{\top}`, "a single number: the stream at $i$ times the matrix times the stream at $j$; this is exactly the dot product of $i$'s query with $j$'s key"],
        [String.raw`\symA_{ij}`, 'the attention weights: a softmax over the earlier positions $j$, as in Chapter 2'],
        [String.raw`\symOV`, 'the **OV circuit**: what gets written into position $i$ for each unit of attention it pays to $j$'],
        [String.raw`\sum_{j \le i} \symA_{ij}\,\symx_j\,\symOV`, 'blend the earlier positions by their weights, then push the blend through the OV circuit'],
      ],
      explain: `The QK circuit decides *where* information comes from; the OV circuit decides *what* information is moved, and in what form it is written. They are independent: a head could look in the right place and copy the wrong thing. Both are $d$ by $d$ but have rank at most $d_h$ (16 here), since they pass through the head's narrow width. Multiply them by the embedding and unembedding and you can read them in token space: $E\\,\\symOV\\,\\symU$ is a $V$ by $V$ table of "if this head attends to token $a$, how much does it raise the logit of token $b$."`,
    });
    p.prose(`
Heads in different layers can also work together, because a later head reads the stream that earlier heads wrote into. Its query can read an earlier head's output (Q-composition), its key can (K-composition), or its value can (V-composition). Our model's two heads use K-composition, and the figure reads the whole circuit from the weights alone, with no input text.`);
    figCircuits(p);

    /* ---------------------------------------------------------------- induction */
    p.h2('Induction heads', 'induction');
    p.prose(`
Put the three panels together and you have an algorithm. Suppose the text so far contains \`... F Q ...\` and the current letter is \`F\` again.

1. **Head 0 is a previous-token head.** At every position it attends one step back and writes "the letter before me was ..." into the stream. So the position of that earlier \`Q\` now carries "my previous letter was F."
2. **Head 1 is the induction head.** Its query, at the current \`F\`, looks for keys that say "my previous letter was F": exactly the position of \`Q\`. Its OV circuit copies what it finds, raising the logit of \`Q\`.

The rule it implements is *if you have seen \`A B\` before and now see \`A\`, predict \`B\`.* Elhage et al. (2021) found this pair in two-layer attention-only models trained on ordinary text and named it the **induction head**. It is a real algorithm, a few matrix products wide, and the figure below runs it.`);
    figInduction(p);
    p.prose(`To measure whether a head does this, feed it random letters repeated once and check where the repeat looks. Random letters matter: nothing about them is predictable except the repeat, so a high score cannot come from knowing the language.`);
    p.math({
      label: 'Induction score',
      tex: String.raw`\text{score} = \frac{1}{12}\sum_{i=12}^{23} \sym{A}{A^{(1)}_{i,\;i-11}}`,
      code: `
        ids = letters + letters     # 12 random letters, twice
        A1 = model.attention(ids)[1]          # head 1: (24, 24)
        score = np.mean([A1[i, i - 11] for i in range(12, 24)])
      `,
      codeTitle: 'induction_score.py',
      terms: [
        [String.raw`i = 12 \ldots 23`, 'the positions of the repeat'],
        [String.raw`i - 11`, "where the letter after $i$'s first copy sits: the first copy of letter $i$ is at $i - 12$, and its successor one step later"],
        [String.raw`\sym{A}{A^{(1)}_{i,\,i-11}}`, 'how much of its attention head 1 puts on that one position'],
        [String.raw`\tfrac{1}{12}\sum`, 'the average over the 12 positions of the repeat: 1 is a perfect induction head, about 1 over the number of visible positions is a head that ignores the pattern'],
      ],
      explain: `Olsson et al. (2022) also measured *prefix matching* (attending to the token after an earlier copy, which this score checks) and *copying* (raising that token's logit, which the OV panel above shows) separately, since a true induction head needs both. The model on this page scores about 0.75 at the end of training.`,
    });
    p.prose(`
### A phase change in training, and in-context learning

Olsson et al. (2022, *In-context Learning and Induction Heads*) followed induction heads through training in models from one layer up to billions of parameters. In every model with at least two layers, induction heads formed early and abruptly, in a narrow window visible as a small bump in the training loss. In the same window the model's **in-context learning** jumped: how much better it predicts tokens late in a context than early in it, because it can use what came before. One-layer models, which cannot build the two-head circuit, showed neither the bump nor the jump. The authors gave several lines of evidence that induction heads are a large part of the mechanism of in-context learning: causal in small attention-only models (remove the heads, and most of the in-context learning goes with them), correlational in large ones, where the same heads also do fuzzier versions of the trick, completing a pattern when a token merely resembles an earlier one.

The same sudden change happens in our small model, between steps 450 and 800 of its 4,000.`);
    figPhase(p);
    p.callout('intuition', `Why so sudden? Neither head is useful alone. A previous-token head writes a message that no one reads, and an induction head looks for a message that no one has written. Gradient descent only gets a strong signal to build each half once the other half exists a little, so both grow slowly from noise and then, once they start to pay off together, very fast. Circuits that need several parts to work at all tend to appear this way: a plateau, then a cliff.`, 'Two halves that only pay off together');
    p.callout('aside', `Our small model was trained to do one thing, so its induction head is unusually clean. In a large model trained on the web, induction heads live alongside hundreds of other heads, and a head can do several jobs at once. The same measurements still find them: feed random tokens repeated once and look for heads whose attention lands one past the earlier copy (exercise 2).`, 'In real models');

    /* ---------------------------------------------------------------- probes */
    p.h2('Linear probes and the linear representation idea', 'probes');
    p.prose(`
Circuits are the gold standard of understanding, but tracing one takes work. A cheaper question is: *does the stream contain a given piece of information at all?* A **probe** answers it (Alain and Bengio, 2016): freeze the model, collect its activations on many inputs, and train a small classifier to predict some property from them. If a *linear* classifier succeeds, the property is written along directions of the stream that a single later matrix could read.`);
    p.math({
      label: 'A linear probe',
      tex: String.raw`p(y \mid \symx) = \operatorname{softmax}\big(\symx\, W_p + b_p\big)`,
      code: `
        X = resid[layer]           # (N, d) frozen activations
        y = labels                 # (N,) the property to decode
        probe = LogisticRegression(max_iter=1000).fit(X, y)
        probe.score(X_test, y_test)    # accuracy on held-out inputs
      `,
      codeTitle: 'linear_probe.py',
      terms: [
        [String.raw`\symx`, 'one activation vector from the stream, taken from a frozen model'],
        [String.raw`W_p,\ b_p`, 'the probe: a $d$ by (number of classes) matrix and a bias, the only things trained'],
        [String.raw`\operatorname{softmax}`, 'turns the scores into class probabilities, trained with cross-entropy as in [Chapter 4 of CS231n](#/linear-classification/softmax)'],
      ],
      explain: `It is the linear classifier of CS231n, trained on a model's activations instead of pixels. Keep the probe simple on purpose: a big enough network can decode almost anything from almost anything, which would tell you about the probe rather than the model.`,
    });
    figProbes(p);
    p.prose(`
Results like the figure's, at much larger scale, support the **linear representation hypothesis**: models represent many concepts as *directions* in activation space, and how strongly a concept is present as how far the vector reaches along its direction. Word vectors gave an early hint (Mikolov et al., 2013): the difference between *king* and *queen* points roughly the same way as the difference between *man* and *woman*. A cleaner example came from Othello-GPT, a transformer trained only on lists of legal moves in the board game. Li et al. (2023) found that the board state could be decoded from its activations with small nonlinear probes but not with linear ones; Nanda, Lee and Wattenberg (2023) then found that it *is* linear once the squares are described as "mine" or "theirs" relative to the player about to move, instead of "black" or "white." The model had a linear world model all along, in its own coordinates.`);
    p.callout('warning', `A probe shows that information is *present*, not that the model *uses* it. To test use, intervene: replace an activation with the one from a different input and see whether the output changes (**activation patching**), remove a direction, or push along it and watch the behavior. The probe's direction is a hypothesis; the intervention tests it.`, 'Decodable is not the same as used');

    /* ---------------------------------------------------------------- superposition */
    p.h2('Superposition: more features than dimensions', 'superposition');
    p.prose(`
If concepts are directions, how many can a stream hold? A space with $d$ dimensions has only $d$ directions that are exactly at right angles. But a language model plausibly tracks far more than $d$ concepts: names, languages, topics, syntax, facts. The way out is to give up *exactly* at right angles. In high dimensions, the number of directions whose pairwise overlaps are all small grows *exponentially* with $d$ (a consequence of the Johnson-Lindenstrauss lemma). Pack features along such nearly orthogonal directions and you can store many more than $d$, at the price of some **interference**: reading one feature picks up a little of the others.

When is that price worth paying? When features are **sparse**: when any given input uses only a few of them. Interference only happens between features that are active *at the same time*, and for sparse features that is rare. Elhage et al. (2022, *Toy Models of Superposition*) made this precise with the smallest model that could show it.`);
    p.math({
      label: 'The toy model of superposition',
      tex: String.raw`\begin{aligned} \symx &= \symW\,\symf \\[2pt] \hat{\symf} &= \operatorname{ReLU}\big(\symW^{\top}\symx + b\big) \\[2pt] \symL &= \mathbb{E}_{\symf}\Big[\textstyle\sum_i I_i\,(\symf_i - \hat{\symf}_i)^2\Big] \end{aligned}`,
      code: `
        f = np.random.rand(B, n)            # n features in [0, 1]
        f[np.random.rand(B, n) < S] = 0     # each is 0 with prob. S
        x = f @ W.T                         # (B, m): compress, m < n
        f_hat = np.maximum(0, x @ W + b)    # (B, n): expand back
        loss = (I * (f - f_hat) ** 2).sum(1).mean()
      `,
      codeTitle: 'toy_model.py',
      terms: [
        [String.raw`\symf`, '$n$ feature values, each zero with probability $S$ (the **sparsity**) and otherwise a random number between 0 and 1'],
        [String.raw`\symW`, 'an $m$ by $n$ matrix with $m < n$: column $i$ is the direction that feature $i$ gets in the small space'],
        [String.raw`\symx = \symW\symf`, 'the compressed activation: every active feature adds its direction, scaled by its value'],
        [String.raw`\operatorname{ReLU}(\symW^{\top}\symx + b)`, "decode by reading each feature's own direction back out, add a bias, and clip negatives to zero"],
        [String.raw`I_i`, "feature $i$'s importance: how much its errors count"],
        [String.raw`\mathbb{E}_{\symf}`, 'the *expectation*: the average over random inputs, which training estimates with a batch'],
      ],
      explain: `The model must squeeze $n$ numbers through $m$ and recover them. With no ReLU this is the classic problem that principal component analysis solves: keep the $m$ most important features and give up the rest. The ReLU and the bias change the answer, as the figure shows, because they let the model throw away small errors.`,
    });
    figSuperposition(p);
    p.prose(`Why does sparsity tip the balance? Write out what the model recovers for one feature:`);
    p.math({
      label: 'Signal plus interference',
      tex: String.raw`\hat{\symf}_k = \operatorname{ReLU}\Big(\underbrace{\lVert \symW_k\rVert^2 \symf_k}_{\text{signal}} + \underbrace{\textstyle\sum_{i \ne k} (\symW_k \cdot \symW_i)\,\symf_i}_{\text{interference}} + b_k\Big)`,
      code: `
        G = W.T @ W               # (n, n): G[k, i] = W_k . W_i
        f_hat = np.maximum(0, G @ f + b)   # the same model, one input
        signal = G[k, k] * f[k]
        interference = G[k] @ f - signal   # from the other features
      `,
      codeTitle: 'interference.py',
      terms: [
        [String.raw`\symW_k`, "feature $k$'s direction, a column of $W$"],
        [String.raw`\lVert \symW_k\rVert^2 \symf_k`, 'the signal: feature $k$ read along its own direction'],
        [String.raw`\symW_k \cdot \symW_i`, "the overlap of two features' directions: zero if they are at right angles"],
        [String.raw`\sum_{i \ne k}`, 'every other feature that happens to be active leaks in through its overlap'],
        [String.raw`b_k`, 'a negative bias acts as a threshold, and the ReLU then clips small leaks to exactly zero'],
      ],
      explain: `If features are dense, many are active at once, the leaks add up, and they swamp the signal: better to give each important feature its own direction and drop the rest. If features are sparse, usually only one is active, the leak terms are almost always zero, and the rare collisions can be cleaned up by the bias and the ReLU. Then it pays to keep everything. In the pentagon, neighboring directions are 72 degrees apart, so each feature overlaps its neighbors by at least $\\cos 72^\\circ \\approx 0.31$ (a little more, since the arrows grow slightly longer than 1). The model learns a negative bias of about $-0.25$ that cuts off most of that leak; the figure's bars show what still gets through.`,
    });
    p.prose(`The paper found more: whether a feature gets represented changes abruptly as sparsity or importance varies (another phase change), features settle into regular shapes (pairs of opposite directions, triangles, pentagons, tetrahedra), and a related model with a hidden ReLU layer can even *compute* in superposition, not just store. Toy models prove nothing about large ones. But they gave a precise, testable reason to expect the next problem.`);

    /* ---------------------------------------------------------------- polysemantic */
    p.h2('Polysemantic neurons', 'polysemantic');
    p.prose(`
Neurons, unlike arbitrary directions, are special: an elementwise nonlinearity like ReLU or GELU acts on each one separately, which gives the neuron basis a reason to mean something. The hope of early interpretability was that each neuron would be **monosemantic**, firing for one understandable thing. Some are. Many are not. In the image model InceptionV1, Olah et al. (2020) describe a neuron that responds to cat faces, the fronts of cars and cat legs; in language models, single MLP neurons commonly fire for several unrelated kinds of text. These are **polysemantic** neurons.

Superposition explains them. If a layer stores more features than it has neurons, the features cannot each have a neuron of their own; their directions are spread across many neurons, and every neuron reads a mixture. The figure builds exactly that situation, where the true features are known, so the mixture can be seen from both sides.`);
    figNeurons(p);
    p.callout('aside', `This is the language-model version of an old finding from the [visualizing chapter](#/visualizing): random directions in a ConvNet's activation space were about as interpretable as single neurons (Szegedy et al., 2013). If meaning lives in directions, the neuron basis is only one of many ways to cut the space, and not necessarily a good one.`, 'Neurons are not privileged enough');

    /* ---------------------------------------------------------------- sae */
    p.h2('Sparse autoencoders', 'sae');
    p.prose(`
If activations are sparse sums of feature directions, $\\symx \\approx \\sum_j \\symf_j \\symW_{:,j}$ with most $\\symf_j$ zero, then recovering the features is a classic problem: **dictionary learning**. Find a dictionary of directions, more of them than there are dimensions, such that every activation is a combination of only a few. A **sparse autoencoder** (SAE) learns one with gradient descent. It is an autoencoder in the sense of [CS231n's unsupervised chapter](#/unsupervised), but turned inside out: the hidden layer is *wider* than the input, and a penalty keeps it sparse instead of a bottleneck keeping it small.`);
    p.math({
      label: 'The sparse autoencoder objective',
      tex: String.raw`\begin{aligned} \symf &= \operatorname{ReLU}\big(W_{enc}(\symx - b_{dec}) + b_{enc}\big) \\[2pt] \hat{\symx} &= \sym{W}{W_{dec}}\,\symf + b_{dec} = \textstyle\sum_j \symf_j\, \sym{W}{W_{dec}}_{:,j} + b_{dec} \\[2pt] \symL &= \lVert \symx - \hat{\symx}\rVert^2 + \symlam \textstyle\sum_j \symf_j \end{aligned}`,
      code: `
        f = relu((x - b_dec) @ W_enc.T + b_enc)   # (B, m), m >> d
        x_hat = f @ W_dec.T + b_dec               # (B, d)
        mse = ((x - x_hat) ** 2).sum(1).mean()
        l1 = f.sum(1).mean()                      # f >= 0: |f| = f
        loss = mse + lam * l1
        W_dec /= np.linalg.norm(W_dec, axis=0)    # unit columns
      `,
      codeTitle: 'sae_loss.py',
      terms: [
        [String.raw`\symx`, 'an activation from the model being studied: the residual stream or an MLP layer at one position, $d$ numbers'],
        [String.raw`\symf`, 'the feature activations: $m$ numbers, many more than $d$, almost all zero'],
        [String.raw`\sym{W}{W_{dec}}_{:,j}`, "column $j$ of the decoder: feature $j$'s direction, kept at length 1"],
        [String.raw`\lVert \symx - \hat{\symx}\rVert^2`, 'the reconstruction error: how much of the activation the features fail to explain'],
        [String.raw`\symlam \sum_j \symf_j`, 'the **L1 penalty**: the sum of the feature activations (they are never negative), weighted by $\\lambda$'],
      ],
      explain: `The two terms pull against each other. Reconstruction wants every feature it can get; the L1 penalty charges for each unit of activation, and it charges the same for a small activation as a large one per unit, so the cheapest fix for a small, unhelpful activation is to push it all the way to zero (the ReLU then keeps it there). The decoder's columns are held at length 1 because otherwise the SAE could dodge the penalty by making $\\symf$ tiny and $W_{dec}$ huge. After training, the hope is that each feature means one thing: the SAE has turned a polysemantic basis of neurons into a monosemantic basis of features.`,
    });
    figSAE(p);
    p.prose(`
### From a toy to frontier models

**Towards Monosemanticity** (Bricken et al., 2023) trained SAEs on the 512-neuron MLP layer of a one-layer transformer. The features were far easier to label than the neurons: features for DNA sequences, Arabic script, base64 strings, Hebrew, and many more, each firing on one kind of text and, when activated artificially, pushing the model to produce that kind of text. As the dictionary grew, features **split**: one broad feature became several narrower ones, a hint that the "right" number of features depends on how finely you ask.

**Scaling Monosemanticity** (Templeton et al., 2024) applied the method to Claude 3 Sonnet, a production model, with dictionaries of up to about 34 million features on a residual stream in the middle of the network. Many features were abstract: the same feature fired for a concept in different languages and in images, and there were features for security vulnerabilities in code, for sycophantic praise, for deception. One feature responded to the Golden Gate Bridge, in text and in pictures. **Clamping** that feature to a large value made the model steer every conversation toward the bridge, and even describe itself as the bridge. Anthropic offered this "Golden Gate Claude" to the public for about a day as a demonstration that features are not just labels but handles on behavior. The same year OpenAI trained SAEs with up to 16 million features on GPT-4 (Gao et al., 2024), replacing the L1 penalty with a **TopK** rule that simply keeps the $k$ largest activations, and Google DeepMind released open SAEs for its Gemma 2 models (Gemma Scope).`);
    p.math({
      label: 'Steering with a feature',
      tex: String.raw`\symx \;\leftarrow\; \symx + (c - \symf_k)\,\sym{W}{W_{dec}}_{:,k}`,
      code: `
        def clamp(module, inputs, out):    # PyTorch forward hook
            f = sae.encode(out)            # (T, m) features
            d = sae.W_dec[:, k]            # (d,) feature k's direction
            return out + (c - f[:, k:k+1]) * d   # feature k := c
        hook = layer.register_forward_hook(clamp)
        model.generate(prompt)             # every step is steered
      `,
      codeTitle: 'steer.py',
      terms: [
        [String.raw`\symf_k`, 'how strongly feature $k$ is active at this position right now'],
        [String.raw`c`, 'the value to clamp it to, for example many times its usual maximum'],
        [String.raw`\sym{W}{W_{dec}}_{:,k}`, "the feature's direction in the stream"],
        [String.raw`(c - \symf_k)\,\sym{W}{W_{dec}}_{:,k}`, 'move the activation along that one direction until the feature reads $c$, leaving everything else (including the reconstruction error) alone'],
      ],
      explain: `Because the stream is a sum, adding a direction to it is a clean intervention: every later layer reads the change. Steering of this kind does not need an SAE (adding the difference between the activations of two contrasting prompts also works, Turner et al., 2023), but an SAE supplies millions of candidate directions with labels attached. Steering is also the causal test that probes lack: if pushing along a feature changes behavior the way its label predicts, the label is more than a story.`,
    });

    /* ---------------------------------------------------------------- limits */
    p.h2('What the dictionary misses', 'limits');
    p.prose(`
Sparse autoencoders turned interpretability from a study of a few hand-picked circuits into something that scales to frontier models. They also have real limits, and the honest summary is that they are a powerful microscope with known distortions.

**Dark matter.** An SAE never reconstructs activations perfectly. Splice its reconstruction back into the model in place of the real activation and the model's loss goes up, sometimes a lot. The part it misses, sometimes called the model's *dark matter*, may hold features too rare for the dictionary to spend a slot on (finding them would take dictionaries far larger still), structure that is not a sparse sum of directions at all, or just noise; nobody knows how much of each. Everything an SAE "explains" is the part it reconstructs.

**A choice of basis.** The features an SAE finds depend on choices that are not in the model: the dictionary size, the penalty, the data it was trained on, even the random seed. You saw it in the figure: change $\\symlam$ or the dictionary size and you get a different set of features from the same activations. Feature splitting says the same thing at scale: is "mathematics" one feature, or ten? Both dictionaries are valid descriptions. The features are a useful basis for the activations, not necessarily *the* units the model computes with.

**Labels are hypotheses.** A feature's name usually comes from its top activating examples, often written by another language model. Top examples can mislead, since a feature can do something different at low activation. Labels earn trust through causal tests like steering and patching, and through circuits that use them.

**Not always the best tool.** For practical tasks such as detecting a harmful request from activations, several groups reported in 2025 that a plain linear probe trained for the task matched or beat probes built on SAE features. SAEs are best at *discovering* what a model represents, not at every job you might want to do with that knowledge.

The field keeps moving. Transcoders and *attribution graphs* (Anthropic, 2025) replace a model's MLPs with sparse, interpretable stand-ins and trace one computation through features across layers, much as this chapter traced the induction circuit through two heads.`);
    p.table(
      ['Tool', 'Question it answers', 'Main caveat'],
      [
        ['Logit lens', 'what would the model predict if it stopped at layer ℓ?', 'early layers write messages that the unembedding cannot read'],
        ['QK and OV circuits', 'where does a head look, and what does it move?', 'tractable for small models; big models have thousands of heads'],
        ['Induction score', 'which heads copy the token after an earlier copy?', 'one behavior at a time'],
        ['Linear probe', 'is this information linearly present here?', 'present is not the same as used'],
        ['Sparse autoencoder', 'which sparse features make up this activation?', 'imperfect reconstruction; features depend on the dictionary'],
        ['Steering and patching', 'does this direction cause this behavior?', 'large interventions can push the model off its usual inputs'],
      ],
    );
    p.callout('idea', `
- **The residual stream** is a running sum: every layer reads it and adds its write. The output is the unembedding of that sum, so any partial sum can be decoded (the **logit lens**) and any write's direct effect on the logits can be read off.
- **A head is two circuits**: $\\symQK = W_Q W_K^{\\top}$ decides where to look and $\\symOV = W_V W_O$ decides what to move. Both can be read in token space straight from the weights.
- **Induction heads** pair a previous-token head with a head whose keys read it: "seen \`A B\`, now \`A\`, predict \`B\`." They appear in a sudden phase change early in training, together with a jump in in-context learning.
- **Linear probes** test whether information is linearly present; concepts often are directions. Use needs an intervention to prove.
- **Superposition**: sparse features can share dimensions, at the cost of interference that a ReLU and a bias clean up. It explains **polysemantic** neurons.
- **Sparse autoencoders** learn an overcomplete dictionary with an L1 penalty, turning neurons into far more interpretable features, at frontier scale, with features you can steer. What they miss (dark matter) and what they choose (the basis) are the open problems.`, 'Takeaways');

    /* ---------------------------------------------------------------- exercises */
    p.h2('Build it yourself', 'exercises');
    p.prose(`
1. **Warm-up: a pentagon by hand** (10 minutes). In NumPy, set the five columns of a 2 by 5 matrix $W$ to unit vectors 72 degrees apart. Compute $W^{\\top}W$ and read off the overlaps. Then compute $\\hat f = \\operatorname{ReLU}(W^{\\top}W f + b)$ for $f$ with a single feature at 1, first with $b = 0$ and then with every $b_k = -0.31$. Finally switch on two neighboring features at once. *Success:* with the bias, a single feature comes back with every other output exactly 0; with two features active, you can point to the interference term that leaks through.
2. **Find GPT-2's induction heads** (30 minutes). Load GPT-2 small with the \`transformers\` library and \`output_attentions=True\`. Feed it 50 random token ids followed by the same 50 again, and for each of its 144 heads compute the induction score: the average attention from each position of the repeat to the token after its first copy. *Success:* a handful of heads score far above all the others, none of them in the first layer, and the model's loss on the second half is far lower than on the first.
3. **The logit lens on GPT-2** (30 minutes). Run *"The Eiffel Tower is located in the city of"* with \`output_hidden_states=True\`, apply the final layer norm and the unembedding (\`model.transformer.ln_f\`, then \`model.lm_head\`) to every layer's last position, and print the top 5 tokens per layer. *Success:* the lens at the last layer matches the model's own prediction exactly, you can name the layer where that prediction first enters the top 5, and the earliest layers mostly predict generic tokens. (If GPT-2 small misses Paris, try the medium or large model.)
4. **The toy model, swept** (an hour). Train the toy model of superposition with $n = 20$ features in $m = 5$ dimensions, importance $0.9^i$, at sparsities from 0 to 0.999. For each run, count the features with $\\lVert W_i\\rVert > 0.5$ and plot that count against $1/(1 - S)$ on a log axis. *Success:* about 5 features at $S = 0$, close to all 20 at the sparsest settings, and a rise with flat stretches where the arrangement holds still before the next features squeeze in.
5. **Project: an SAE on a real model** (a weekend). Collect residual-stream activations from a middle layer of GPT-2 small (layer 6 is a common choice) on a few million tokens of web text. Train an SAE with 16 times as many features as dimensions, the L1 penalty and unit-norm decoder columns from this chapter. Report the average number of active features per token, the fraction of variance explained, and the rise in GPT-2's next-token loss when you splice the reconstruction in. Then pick 20 random features, read their top-activating contexts, and label them. *Success:* a few dozen active features per token, most of the variance explained, a clearly smaller loss penalty than replacing the activations with their average, and labels you would bet on for most of the 20. *Bonus:* clamp one feature during generation and watch the text bend toward it.`);
  },
};

export default chapter;

import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'interpretability',
  title: 'Looking inside language models',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'Reading the algorithm',
      codeTitle: 'looking_inside.py',
      code: `
        # looking inside a language model
        x = x + layer(x)   # the stream    #@stream
        W_QK, W_OV         # two circuits  #@heads
        A1[i, i - 11]      # induction     #@ind
        probe.fit(x, y)    # what it knows #@probe
        x = W @ f          # superposition #@sup
        f = relu(W_enc @ x)  # the SAE     #@sae
      `,
      beats: [
        { id: 'hello', say: 'Chapter twenty, the last of the course: looking inside language models.' },
        { id: 'convnets', say: 'In {CS231n|C S two thirty one N}, we looked inside ConvNets with pictures: filters, saliency maps, images that excite a neuron.' },
        { id: 'where', say: 'Those show where a network looks, not how it computes its answer.' },
        { id: 'goal', say: 'For language models, the goal got harder: read the algorithm out of the weights, like decompiling a program.' },
        { id: 'name', say: 'That is mechanistic interpretability, and in a few years it went from toy models to frontier models.' },
        { id: 'plan1', say: 'We start with the residual stream, and with attention heads split into two circuits.', code: ['stream', 'heads'] },
        { id: 'plan2', say: 'Then a real algorithm made of two heads, the induction head, and probes, which test what a model knows.', code: ['ind', 'probe'] },
        { id: 'plan3', say: 'Then the obstacle, superposition, and the tool built for it: sparse autoencoders.', code: ['sup', 'sae'] },
      ],
    },
    {
      id: 'stream',
      title: 'The residual stream',
      codeTitle: 'residual_stream.py',
      code: `
        x = E[ids] + P[:T]      # x0     #@x0
        for layer in layers:
            a = layer.attn(ln(x))  # read  #@read
            x = x + a              # write #@write
            m = layer.mlp(ln(x))   # read  #@read
            x = x + m              # write #@write
        logits = ln_f(x) @ W_U   # (T, V)  #@out
      `,
      beats: [
        { id: 'recall', say: 'Recall the transformer block: attention and an MLP, each adding its output to its input.', code: 'write' },
        { id: 'flip', say: 'In {2021|twenty twenty-one}, Elhage and colleagues at Anthropic read that the other way round.' },
        { id: 'stream', say: 'Picture one vector per position, running from the bottom of the model to the top: the residual stream.', code: 'x0' },
        { id: 'read', say: 'Every layer reads from the stream: a layer norm, then a matrix.', code: 'read' },
        { id: 'write', say: 'And every layer writes to it, by adding. Nothing is overwritten.', code: 'write' },
        { id: 'sum', say: 'So the top of the stream is a sum: the embedding, plus every layer\'s writes.', code: ['x0', 'write'] },
        { id: 'out', say: 'Multiply it by the unembedding, {W_U|W U}, and you have the logits.', code: 'out' },
        { id: 'channel', say: 'It is a shared channel: one layer can leave a message in a few directions, and a later layer can pick it up.' },
        { id: 'direct', say: 'And since the sum feeds a matrix multiply, each write\'s direct effect on the output can be read alone.', code: 'out' },
      ],
    },
    {
      id: 'lens',
      title: 'A model small enough to read',
      codeTitle: 'logit_lens.py',
      code: `
        # 2 layers, attention only, 1 head each
        x0 = E[ids] + P[:24]     # embed   #@x0
        x1 = x0 + head(0, x0)    # head 0  #@x1
        x2 = x1 + head(1, x1)    # head 1  #@x2
        logits = x2 @ W_U                  #@x2
        for x in (x0, x1, x2):   # the lens #@lens
            p = softmax(x[i] @ W_U)        #@lens
      `,
      beats: [
        { id: 'model', say: 'To watch the stream work, we need a model small enough to read completely.' },
        { id: 'arch', say: 'Here is one: two attention layers, one head each, no MLPs, no layer norm, and twenty letters.', code: ['x0', 'x1', 'x2'] },
        { id: 'data', say: 'It was trained on random letters that start repeating, with a period of six to sixteen.' },
        { id: 'only', say: 'Random letters cannot be predicted. The only way to beat a guess is to notice the repeat, and copy.' },
        { id: 'sum', say: 'Its stream is exactly three pieces: the embedding, plus head zero, plus head one.', code: ['x0', 'x1', 'x2'] },
        { id: 'lens', say: 'Now the {logit lens|lo-jit lens}: multiply the middle of the stream by {W_U|W U}, and see what the model would say if it stopped there.', code: 'lens' },
        { id: 'input', say: 'Feed in twelve random letters, then the same twelve again. Stand on the F in the repeat: next should come P.' },
        { id: 'x0', say: 'After the embedding, P gets about five percent: a blind guess.', code: 'x0' },
        { id: 'x1', say: 'After head zero, still five percent. Whatever it wrote was not for the output.', code: 'x1' },
        { id: 'x2', say: 'After head one, ninety-seven percent. Head one wrote the answer.', code: 'x2' },
        { id: 'message', say: 'So head zero left a message for head one. To read it, look inside the heads.' },
      ],
    },
    {
      id: 'heads',
      title: 'Where to look, what to move',
      codeTitle: 'circuits.py',
      code: `
        W_QK = Wq @ Wk.T   # where to look #@qk
        W_OV = Wv @ Wo     # what to move  #@ov
        s = x @ W_QK @ x.T / 4             #@qk
        A = softmax(s + mask)              #@qk
        out = A @ x @ W_OV                 #@ov
        pos = P @ W_QK0 @ P.T  # head 0    #@pos
        ov = E @ W_OV1 @ W_U   # head 1    #@tok
      `,
      beats: [
        { id: 'four', say: 'A head has four matrices: query, key, value and output. But they act in pairs.' },
        { id: 'qk', say: 'Queries and keys only meet in one product, {W_QK|W Q K}: the {QK|Q K} circuit. It decides where to look.', code: 'qk' },
        { id: 'ov', say: 'Values and output only act together too: {W_OV|W O V}, the {OV|O V} circuit. It decides what to move.', code: 'ov' },
        { id: 'indep', say: 'The two are independent: a head could look in the right place and copy the wrong thing.' },
        { id: 'rank', say: 'Both are thirty-two by thirty-two, squeezed through the head\'s width of sixteen.' },
        { id: 'read0', say: 'Read head zero\'s {QK|Q K} circuit on positions alone: every position looks one step back.', code: 'pos' },
        { id: 'stripe', say: 'That stripe below the diagonal says it: head zero is a previous-token head.', code: 'pos' },
        { id: 'read1', say: 'Now head one\'s {OV|O V} circuit, from letters to logits: the embedding, times {W_OV|W O V}, times {W_U|W U}.', code: 'tok' },
        { id: 'diag', say: 'A bright diagonal: attending to a letter raises that same letter\'s logit. It copies.', code: 'tok' },
        { id: 'noinput', say: 'All of this comes from the weights alone, with no input text.' },
      ],
    },
    {
      id: 'induction',
      title: 'Induction heads',
      codeTitle: 'induction.py',
      code: `
        ids = letters + letters   # 24     #@seq
        A0, A1 = model.attention(ids)      #@seq
        A0[i].argmax()   # i - 1: previous #@prev
        j = A1[i].argmax()  # after a copy #@ind
        p = softmax(logits[i])  # ids[j]   #@copy
        rep = range(12, 24)
        score = mean(A1[i, i - 11] for i in rep)  #@score
      `,
      beats: [
        { id: 'seen', say: 'Put the circuits together, and you get an algorithm.' },
        { id: 'rule', say: 'If you have seen A then B, and now see A again, predict B.' },
        { id: 'prev', say: 'Step one: head zero writes into every position, the letter before me was this.', code: 'prev' },
        { id: 'here', say: 'So the earlier P now carries a note: my previous letter was F.', code: 'prev' },
        { id: 'query', say: 'Step two: at the current F, head one asks, whose previous letter was F?', code: 'ind' },
        { id: 'key', say: 'Its keys read head zero\'s notes: one head\'s output is another\'s input.', code: 'ind' },
        { id: 'found', say: 'The earlier P. Head one puts nearly all its attention there,', code: 'ind' },
        { id: 'copy', say: 'and its {OV|O V} circuit copies P into the stream. The prediction: P.', code: 'copy' },
        { id: 'grid', say: 'Draw head one\'s whole attention pattern, and its signature appears: a stripe, one step right of where the repeat began.', code: 'score' },
        { id: 'name', say: 'Elhage and colleagues found this pair in small models trained on real text, and named it the induction head.' },
        { id: 'score', say: 'The induction score measures it: attention on the letter after the earlier copy. Here, {0.87|zero point eight seven}.', code: 'score' },
      ],
    },
    {
      id: 'phase',
      title: 'A phase change',
      codeTitle: 'train.py',
      code: `
        for step in range(4000):            #@train
            loss = xent(model(ids), ids[1:])  #@train
            loss.backward(); opt.step()     #@train
            if step % 10:                   #@eval
                continue                    #@eval
            ind = A1[i, i - 11].mean()      #@ind
            rep = nll[12:].mean()           #@rep
      `,
      beats: [
        { id: 'watch', say: 'How does this circuit appear in training? Watch the loss on the repeat.', code: ['train', 'rep'] },
        { id: 'plateau', say: 'For five hundred steps it creeps down: letters already seen are a little likelier.', code: 'rep' },
        { id: 'cliff', say: 'Then, within a few hundred steps, it falls off a cliff, from {2.6|two point six} to below one.', code: 'rep' },
        { id: 'score', say: 'In the same window, the induction score jumps from near zero to about {0.75|zero point seven five}.', code: 'ind' },
        { id: 'grids', say: 'Before the drop, head one\'s attention is a blur. After it, a stripe.', code: 'ind' },
        { id: 'why', say: 'Why so sudden? Neither head helps alone: one writes notes nobody reads, the other looks for notes nobody wrote.' },
        { id: 'together', say: 'Once both exist a little, the gradient pushes hard on each, and they grow fast, together.' },
        { id: 'olsson', say: 'In {2022|twenty twenty-two}, {Olsson|Olson} and colleagues found this phase change in real models, up to billions of parameters.' },
        { id: 'icl', say: 'In the same window, in-context learning jumped: the models got much better at using earlier context.' },
        { id: 'evidence', say: 'They argued induction heads drive much of it: removing them removed most of it in small models. In large ones, the evidence is correlational.' },
      ],
    },
    {
      id: 'probes',
      title: 'Linear probes',
      codeTitle: 'probe.py',
      code: `
        X = x1[train]     # (N, 32), frozen  #@data
        y = prev_letter[train]   # (N,)      #@data
        probe = LogisticRegression()         #@fit
        probe.fit(X, y)                      #@fit
        probe.score(X_test, y_test)          #@acc
      `,
      beats: [
        { id: 'cheap', say: 'Tracing circuits is slow. A cheaper question: is some piece of information in the stream at all?' },
        { id: 'probe', say: 'A probe answers it: freeze the model, and train a small classifier to read a property from its activations.', code: ['data', 'fit'] },
        { id: 'linear', say: 'If a linear one works, the information lies along directions a single matrix could read.', code: 'fit' },
        { id: 'prev', say: 'Probe our stream for the previous letter. In {x₀|x zero}, accuracy is near chance.', code: 'acc' },
        { id: 'x1', say: 'In {x₁|x one}, after head zero, about {88|eighty-eight} percent. Head zero wrote it, as the circuit said.', code: 'acc' },
        { id: 'lrh', say: 'Results like this support the linear representation hypothesis: concepts are directions in activation space.' },
        { id: 'words', say: 'Word vectors hinted at it: man to woman points roughly the same way as king to queen.' },
        { id: 'othello', say: 'And a model trained on Othello moves tracked the board linearly, once squares were read as mine and theirs.' },
        { id: 'caveat', say: 'But a probe shows information is there, not that the model uses it.' },
        { id: 'patch', say: 'To test use, intervene: swap in another input\'s activation, or push along the direction, and watch the output.' },
      ],
    },
    {
      id: 'superposition',
      title: 'More features than dimensions',
      codeTitle: 'toy_model.py',
      code: `
        f = rand(B, 5) * (rand(B, 5) > S)  #@data
        x = f @ W.T          # (B, 2)      #@fwd
        f_hat = relu(x @ W + b)  # (B, 5)  #@fwd
        err = I * (f - f_hat) ** 2         #@loss
        loss = err.sum(1).mean()           #@loss
        G = W.T @ W      # overlaps        #@G
        f_hat = relu(G @ f + b)  # one f   #@one
      `,
      beats: [
        { id: 'count', say: 'If concepts are directions, how many fit in d numbers?' },
        { id: 'exact', say: 'At exact right angles, only d. A language model surely tracks far more.' },
        { id: 'nearly', say: 'But in high dimensions, random directions are nearly perpendicular, and their number grows exponentially with d.' },
        { id: 'cost', say: 'Pack features along them, and you store far more than d. The price: interference, a little of each in the others.' },
        { id: 'toy', say: 'Toy Models of Superposition, in {2022|twenty twenty-two}, made it concrete: five features squeeze through two dimensions.', code: ['data', 'fwd'] },
        { id: 'decode', say: 'Compress with W, decode with W transposed, a bias and a {ReLU|ray-loo}. Feature one matters most.', code: ['fwd', 'loss'] },
        { id: 'dense', say: 'With dense features, the model keeps the two most important, at right angles, and drops the rest.', code: 'loss' },
        { id: 'sparse', say: 'Now make them sparse: each one sits at zero, ninety-five percent of the time.', code: 'data' },
        { id: 'pentagon', say: 'Train again, and all five come back, as a pentagon, overlapping.', code: 'loss' },
        { id: 'between', say: 'In between, you often get four: two opposite pairs.' },
        { id: 'one', say: 'Feed in feature one alone. It comes back strong, and its neighbors pick up a small leak.', code: ['G', 'one'] },
        { id: 'relu', say: 'A negative bias and the {ReLU|ray-loo} cut most of it away.', code: 'one' },
        { id: 'rare', say: 'Interference hurts when two features are on at once. With sparse features that is rare, so it pays.' },
      ],
    },
    {
      id: 'polysemantic',
      title: 'Polysemantic neurons',
      codeTitle: 'neurons.py',
      code: `
        D = unit_vectors(8, 16)   # truth  #@truth
        F = sparse_features(3000, 16)      #@truth
        X = F @ D.T      # (3000, 8)       #@x
        n = 3            # one neuron
        top = argsort(-X[:, n])[:6]        #@top
        F[top]           # what was on     #@top
      `,
      beats: [
        { id: 'neurons', say: 'Neurons are special, since the nonlinearity acts on each one alone. The hope: one neuron, one concept.' },
        { id: 'some', say: 'Some neurons are like that. Many are not.' },
        { id: 'inception', say: 'In an image model, Olah and colleagues found a neuron that fires for cat faces, fronts of cars, and cat legs.' },
        { id: 'poly', say: 'Such neurons are polysemantic, and superposition explains them.' },
        { id: 'setup', say: 'Build eight neurons out of sixteen sparse features with known directions.', code: 'truth' },
        { id: 'grid', say: 'Every feature pushes every neuron a little, up or down.', code: 'x' },
        { id: 'one', say: 'Take neuron three, and list the inputs where it fires hardest.', code: 'top' },
        { id: 'mix', say: 'Korean, citations, music. No single label fits it.', code: 'top' },
        { id: 'nothing', say: 'Nothing is wrong with it. There are simply more features than neurons.' },
      ],
    },
    {
      id: 'sae',
      title: 'Sparse autoencoders',
      codeTitle: 'sae.py',
      code: `
        f = relu(W_enc @ (x - b_dec) + b_enc)  #@enc
        x_hat = W_dec @ f + b_dec          #@dec
        mse = ((x - x_hat) ** 2).sum()     #@loss
        loss = mse + lam * f.sum()         #@l1
        W_dec /= norm(W_dec, axis=0)       #@norm
      `,
      beats: [
        { id: 'invert', say: 'If activations are sparse sums of feature directions, try running the toy model backwards.' },
        { id: 'dict', say: 'That is dictionary learning: find more directions than dimensions, so each activation uses only a few.' },
        { id: 'enc', say: 'A sparse autoencoder encodes an activation into a much wider vector of features,', code: 'enc' },
        { id: 'dec', say: 'then decodes it as a weighted sum of directions, the decoder\'s columns.', code: 'dec' },
        { id: 'recon', say: 'The loss has two parts: the reconstruction error,', code: 'loss' },
        { id: 'l1', say: 'and an {L1|L one} penalty: the sum of the feature activations, times lambda.', code: 'l1' },
        { id: 'push', say: 'It charges every unit of activation the same, so small, unhelpful features get pushed to zero.', code: 'l1' },
        { id: 'norm', say: 'Decoder columns stay at length one, or the model would cheat by shrinking features and growing directions.', code: 'norm' },
        { id: 'toy', say: 'Train one on our eight neurons, and compare its sixteen features with the true ones.' },
        { id: 'diag', say: 'At a good lambda, almost every true feature gets its own. Polysemantic neurons in, monosemantic features out.' },
        { id: 'tradeoff', say: 'Lower lambda: better reconstruction, blurred features. Raise it: clean features, worse reconstruction.' },
      ],
    },
    {
      id: 'scale',
      title: 'Features at scale',
      codeTitle: 'steer.py',
      code: `
        f = sae.encode(x)       # (T, m)   #@enc
        d = sae.W_dec[:, k]     # feature k #@dir
        x = x + (c - f[:, k:k+1]) * d      #@steer
        # every later layer reads the change
      `,
      beats: [
        { id: 'mono', say: 'In {2023|twenty twenty-three}, Towards Monosemanticity trained these on a one-layer transformer.', code: 'enc' },
        { id: 'found', say: 'Its features were far easier to name than its neurons: DNA, Arabic script, base sixty-four, Hebrew.' },
        { id: 'split', say: 'As the dictionary grew, features split: one broad feature became several narrow ones.' },
        { id: 'scale', say: 'In {2024|twenty twenty-four}, it scaled to Claude three Sonnet, with up to about thirty-four million features.' },
        { id: 'abstract', say: 'Many were abstract: one feature fired for a concept in several languages, and in images.' },
        { id: 'gg', say: 'One feature responded to the Golden Gate Bridge.' },
        { id: 'clamp', say: 'Clamp it high, by pushing the stream along its direction, and the model steered every conversation toward the bridge.', code: ['dir', 'steer'] },
        { id: 'ggc', say: 'Anthropic offered this {Golden Gate Claude|Golden Gate Clawed} to the public for a day.', code: 'steer' },
        { id: 'handle', say: 'Features are not just labels but handles on behavior, and steering is the causal test probes lack.', code: 'steer' },
        { id: 'others', say: '{OpenAI|Open A I} trained sixteen million features on {GPT-4|G P T four}, and Google released open ones for Gemma.' },
      ],
    },
    {
      id: 'limits',
      title: 'What the dictionary misses',
      codeTitle: 'limits.py',
      code: `
        x_hat = sae.decode(sae.encode(x))  #@rec
        err = x - x_hat   # unexplained   #@dark
        loss(splice(x_hat)) > loss(x)     #@splice
        for m in (8, 16, 32):   # a choice #@basis
            fit_sae(X, m)                  #@basis
      `,
      beats: [
        { id: 'micro', say: 'Sparse autoencoders are a powerful microscope, with known distortions.' },
        { id: 'dark', say: 'First, dark matter: the reconstruction is never perfect, and what it misses stays unexplained.', code: ['rec', 'dark'] },
        { id: 'splice', say: 'Splice the reconstruction into the model, and its loss goes up, sometimes a lot.', code: 'splice' },
        { id: 'rare', say: 'The missing part may be rare features, structure that is no sparse sum, or noise. Nobody knows the mix.', code: 'dark' },
        { id: 'basis', say: 'Second, features are a choice: dictionary size, penalty, data, even the seed change what you find.', code: 'basis' },
        { id: 'split', say: 'Is math one feature, or ten? Both describe the same activations.', code: 'basis' },
        { id: 'labels', say: 'Third, a label read off top examples is a hypothesis. It earns trust through interventions.' },
        { id: 'probes', say: 'And for some jobs, like spotting a harmful request, a plain probe trained for it does as well or better.' },
        { id: 'next', say: 'Newer tools trace a computation through features layer by layer, the way we traced the induction circuit.' },
      ],
    },
    {
      id: 'outro',
      title: 'The view from inside',
      codeTitle: 'recap.py',
      code: `
        x = x0 + sum(writes)   # stream    #@stream
        W_QK, W_OV   # where and what      #@heads
        A1[i, i - 11]          # induction #@ind
        probe.fit(x, y)        # present?  #@probe
        x = W @ f   # superposition        #@sup
        f = relu(W_enc @ x)    # features  #@sae
      `,
      beats: [
        { id: 'recap', say: 'So, what did we find inside?' },
        { id: 'stream', say: 'The residual stream is a running sum every layer reads and writes; the {logit lens|lo-jit lens} reads it early.', code: 'stream' },
        { id: 'heads', say: 'Each head is two circuits: {QK|Q K}, where to look, and {OV|O V}, what to move.', code: 'heads' },
        { id: 'ind', say: 'Two heads make an induction head, which appears suddenly and drives in-context learning.', code: 'ind' },
        { id: 'probe', say: 'Probes show what is linearly present. Interventions show what is used.', code: 'probe' },
        { id: 'sup', say: 'Models pack more features than dimensions into superposition, so neurons are polysemantic.', code: 'sup' },
        { id: 'sae', say: 'Sparse autoencoders pull those features apart, even in frontier models, into handles you can steer.', code: 'sae' },
        { id: 'close', say: 'Ten years ago, we asked where a network looks. Now we ask what it computes, and sometimes, we get an answer.', pause: 0.6 },
      ],
    },
  ],
};

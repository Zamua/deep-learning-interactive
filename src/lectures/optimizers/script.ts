import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'optimizers',
  title: 'Optimizers at scale: AdamW to Muon',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'The recipe changed',
      codeTitle: 'recipe.py',
      code: `
        # 2016
        opt = Adam(params, lr=1e-3)       #@old
        # ... halve lr every few epochs   #@old

        # 2026
        opt = AdamW(params, wd=0.1)       #@adamw
        lr = warmup_then_cosine(t)        #@sched
        clip_grad_norm_(params, 1.0)      #@clip
        with autocast(torch.bfloat16):    #@bf16
            loss = model(x, y)            #@bf16
        muon = Muon(hidden_matrices)      #@muon
      `,
      beats: [
        { id: 'hello', say: 'This lecture is about how big models are actually trained: the optimizer, and everything around it.' },
        { id: 'old', say: 'In 2016, the advice fit in one line. Use Adam, and cut the learning rate in steps.', code: 'old' },
        { id: 'new', say: 'A decade later, training a large language model takes five or six moving parts.' },
        { id: 'adamw', say: "Adam's weight decay turned out to be subtly wrong, and {AdamW|Adam W} fixed it.", code: 'adamw' },
        { id: 'sched', say: 'Fixed steps gave way to a warmup and a long, smooth decay.', code: 'sched' },
        { id: 'clip', say: 'Gradients get clipped, so that one bad batch cannot throw the run off a cliff.', code: 'clip' },
        { id: 'bf16', say: 'Arithmetic moved to sixteen-bit numbers, which need their own care.', code: 'bf16' },
        { id: 'muon', say: 'And in late 2024, a new optimizer, Muon, showed that treating a weight matrix as a matrix, not a bag of numbers, trains transformers faster.', code: 'muon' },
        { id: 'plan', say: 'Each piece exists because something broke at scale. We take them in order, and spend the most time on Muon.' },
      ],
    },
    {
      id: 'adamw',
      title: 'Weight decay, decoupled',
      codeTitle: 'adamw.py',
      code: `
        # Adam + L2: decay inside the gradient
        g = grad + wd * w                 #@l2
        m = 0.9 * m + 0.1 * g             #@m
        v = 0.999 * v + 0.001 * g ** 2    #@v
        w -= lr * m_hat / np.sqrt(v_hat)  #@step

        # AdamW: decay outside, after the step
        w -= lr * wd * w                  #@aw
      `,
      beats: [
        { id: 'recap', say: 'First, a recap. Adam keeps two running averages for every parameter.' },
        { id: 'm', say: 'm is a smoothed gradient. That is momentum.', code: 'm' },
        { id: 'v', say: "v is a smoothed squared gradient: how big this parameter's gradients usually are.", code: 'v' },
        { id: 'step', say: 'Each step divides m by the square root of v, so every parameter takes a step of about the same size, whether its gradients are huge or tiny.', code: 'step' },
        { id: 'l2', say: 'Now add {L2|L two} regularization the 2016 way, by putting lambda times w into the gradient.', code: 'l2' },
        { id: 'sgd', say: 'With plain {SGD|S G D}, that is exactly weight decay: every weight shrinks by the same fraction each step.' },
        { id: 'problem', say: 'With Adam, the decay term also goes through the division by the square root of v.', code: ['l2', 'step'] },
        { id: 'big', say: 'A weight with large gradients gets its decay divided by a large number, so it nearly vanishes. Tiny gradients amplify it instead.' },
        { id: 'demo', say: 'Five weights with pure-noise gradients, tiny to large. With {L2|L two} inside Adam, the tiny-gradient ones collapse to zero, and the large-gradient one barely moves.' },
        { id: 'aw', say: 'Loshchilov and Hutter, in 2017, moved the decay outside the normalization. That is {AdamW|Adam W}.', code: 'aw' },
        { id: 'same', say: 'Now all five shrink along the same curve. It is the default today, typically with weight decay {0.1|zero point one}, on weight matrices only.', code: 'aw' },
      ],
    },
    {
      id: 'schedules',
      title: 'Warmup, cosine and WSD',
      codeTitle: 'schedules.py',
      code: `
        def lr_at(t):
            if t < warm:                       #@warm
                return peak * (t + 1) / warm   #@warm
            p = (t - warm) / (T - warm)        #@cos
            if sched == "cosine":              #@cos
                return peak * (1 + cos(pi*p)) / 2    #@cos
            if t < t_d:                        #@stable
                return peak                    #@stable
            q = (t - t_d) / (T - t_d)          #@decay
            return peak * (1 - q)              #@decay
      `,
      beats: [
        { id: 'warm', say: 'Next, the shape of the learning rate over training. Every large run starts with a warmup.', code: 'warm' },
        { id: 'why', say: "At step zero, the gradients are large and change fast, and Adam's v rests on only a few samples." },
        { id: 'blow', say: 'A full-size step in that state can make the loss spike or diverge.' },
        { id: 'ramp', say: 'So the learning rate ramps up from almost zero over the first few hundred or thousand steps.', code: 'warm' },
        { id: 'floor', say: 'At the other end, a constant learning rate leaves the weights rattling around the bottom of the loss, at a noise floor set by the step size.' },
        { id: 'cos', say: 'Cosine decay follows half a cosine wave from the peak down to a small value. {GPT-3|GPT three}, Chinchilla and Llama all used it.', code: 'cos' },
        { id: 'catch', say: 'Its catch is that you have to know the total number of steps in advance.', code: 'cos' },
        { id: 'wsd', say: 'Warmup, stable, decay, or {WSD|W S D}, holds the peak flat, then cools down fast over the last ten or twenty percent.', code: ['stable', 'decay'] },
        { id: 'drop', say: 'The loss drops sharply during that cooldown, and ends about where cosine does.', code: 'decay' },
        { id: 'branch', say: 'And because the flat phase ignores the total length, you can branch a short decay off any checkpoint, for any budget.' },
              ],
    },
    {
      id: 'clipping',
      title: 'Clipping by global norm',
      codeTitle: 'clip.py',
      code: `
        total = np.sqrt(sum(np.sum(g ** 2)  #@norm
                            for g in grads))  #@norm
        scale = min(1.0, max_norm / total)  #@scale
        grads = [g * scale for g in grads]  #@clip

        # for contrast: per value
        g_val = np.clip(g, -c, c)           #@val
      `,
      beats: [
        { id: 'spikes', say: 'Most steps of a big training run look alike. A few do not.' },
        { id: 'cause', say: 'An unusual batch, or a sharp cliff in the loss, produces a gradient many times larger than usual.' },
        { id: 'damage', say: 'With {SGD|S G D}, one such step can throw the weights far away. With Adam, it inflates m and v for many steps after.' },
        { id: 'norm', say: 'The fix starts with the global norm. Square every gradient entry in the whole model, add them all up, and take the square root.', code: 'norm' },
        { id: 'scale', say: 'If that is above a threshold c, usually 1, scale the entire gradient down, so its norm is exactly c.', code: ['scale', 'clip'] },
        { id: 'dir', say: 'Every entry is multiplied by the same number, so the gradient still points the same way. Only its length changes.', code: 'clip' },
        { id: 'val', say: 'Clipping each value on its own is different. It lands on a square instead of a circle, and bends the direction.', code: 'val' },
        { id: 'rare', say: 'In a healthy run, only a small share of steps get clipped. The ceiling is there for the spikes.' },
      ],
    },
    {
      id: 'precision',
      title: 'Mixed precision',
      codeTitle: 'mixed_precision.py',
      code: `
        with autocast(dtype=torch.bfloat16):  #@cast
            loss = model(x, y)                #@cast
        loss.backward()                       #@cast

        # fp16 only: scale the loss first
        (loss * scale).backward()             #@scale
        grads = grads / scale     # in fp32   #@scale

        # master weights and m, v: fp32       #@master
        opt.step()                            #@master
      `,
      beats: [
        { id: 'why', say: 'Next, the numbers themselves. Sixteen-bit numbers halve the memory, and GPUs multiply them many times faster.' },
        { id: 'bits', say: 'A float has a sign, an exponent that sets its range, and a mantissa that sets its precision.' },
        { id: 'fp16', say: '{fp16|F P sixteen} has ten mantissa bits, but only five exponent bits. Its largest value is {65,504|sixty-five thousand, five hundred and four}.' },
        { id: 'bf16', say: '{bf16|B F sixteen} makes the opposite trade: the full eight-bit exponent of {fp32|F P thirty-two}, and only seven mantissa bits.' },
        { id: 'under', say: 'The range problem first. Gradients are often tiny, and in {fp16|F P sixteen}, anything below about {6 × 10⁻⁸|six times ten to the minus eight} rounds to zero.' },
        { id: 'hist', say: 'Here are typical gradient sizes, on a log scale. In {fp16|F P sixteen}, most of them simply vanish.' },
        { id: 'scale', say: 'Loss scaling fixes this. Multiply the loss by a big power of two before the backward pass, and every gradient moves up into range.', code: 'scale' },
        { id: 'unscale', say: 'Divide it back out in {fp32|F P thirty-two} before the update. If anything overflows to infinity, skip the step, and halve the scale.', code: 'scale' },
        { id: 'bf16fix', say: '{bf16|B F sixteen} has the range of {fp32|F P thirty-two}, so it needs no loss scaling at all. That is why it became the default.', code: 'cast' },
        { id: 'gap', say: 'Then precision. In {bf16|B F sixteen}, the next number after 1 is about {0.008|eight thousandths} away, so a small update to a weight of 1 rounds away entirely.' },
        { id: 'master', say: "So the weights live in {fp32|F P thirty-two} as a master copy, with Adam's m and v. Each step casts them to sixteen bits for the forward and backward passes.", code: 'master' },
      ],
    },
    {
      id: 'matrix',
      title: 'A weight matrix is a map',
      codeTitle: 'gradient.py',
      code: `
        # a hidden layer: y = W @ x
        G = sum(np.outer(delta, x)    #@outer
                for delta, x in batch)  #@outer
        U, S, Vt = np.linalg.svd(G)   #@svd
        # S: a few big values,        #@low
        #    many tiny ones           #@low
      `,
      beats: [
        { id: 'list', say: 'So far, parameters have been one long list of numbers. Adam is element-wise: each entry gets its own step size.' },
        { id: 'map', say: "But a hidden layer's weight matrix is not a list. It is a linear map, which turns input vectors into output vectors." },
        { id: 'svd', say: 'And every matrix can be written as rotate, stretch, rotate. That is the singular value decomposition, {U Σ Vᵀ|U, sigma, V transpose}.', code: 'svd' },
        { id: 'circle', say: 'Picture it in two dimensions. The matrix turns the unit circle into an ellipse.' },
        { id: 'sv', say: 'The stretch factors are the singular values, sigma one and sigma two: how much the matrix stretches each of its special directions.', code: 'svd' },
        { id: 'outer', say: 'The gradient of a linear layer is a sum of outer products: for each example, how its output should change, times its input.', code: 'outer' },
        { id: 'low', say: 'When many examples push the same way, a few singular values dominate. Keller Jordan reported this in transformers: {SGD|S G D} and Adam updates are almost low rank.', code: 'low' },
        { id: 'drown', say: 'A step shaped like that spends nearly all of its size on a few directions. Rare directions, which may still matter, barely move.' },
        { id: 'idea', say: "Muon's idea is simple. Keep the directions, and set every stretch to 1." },
      ],
    },
    {
      id: 'muon',
      title: 'Muon',
      codeTitle: 'muon.py',
      code: `
        def muon_step(W, G, M, lr=0.02):
            M[:] = 0.95 * M + G              #@mom
            O = newton_schulz5(M)  # ~ U Vt  #@orth
            r, c = W.shape                   #@step
            W -= lr * max(1, r / c) ** 0.5 * O  #@step
      `,
      beats: [
        { id: 'name', say: 'Muon comes from Keller Jordan and collaborators, in late 2024. The name stands for momentum, orthogonalized by Newton-Schulz.' },
        { id: 'mom', say: 'Start with ordinary momentum: a running sum of recent gradients, kept as a matrix, M.', code: 'mom' },
        { id: 'orth', say: 'Then replace M, which is {U Σ Vᵀ|U sigma V transpose}, with {U Vᵀ|U V transpose}. Same directions, every singular value set to 1.', code: 'orth' },
        { id: 'near', say: 'Of all matrices whose singular values are all 1, {U Vᵀ|U V transpose} is the closest one to M. This is called orthogonalizing it.', code: 'orth' },
        { id: 'equal', say: 'Now the update moves every direction by the same amount, and the rare directions are no longer drowned out.' },
        { id: 'step', say: 'Then take the step, with a small factor for the matrix shape, so that tall matrices get proportionally larger steps.', code: 'step' },
        { id: 'where', say: 'Muon is only for the hidden two-dimensional matrices: the attention projections, and the feed-forward layers.' },
        { id: 'adamw', say: 'Embeddings, the output layer, biases and normalization gains stay on {AdamW|Adam W}, so a Muon training loop runs two optimizers.' },
        { id: 'why', say: 'An embedding is a lookup table, not a map on dense vectors. And gains and biases are vectors: there is nothing to orthogonalize.' },
      ],
    },
    {
      id: 'ns',
      title: 'Newton-Schulz',
      codeTitle: 'newton_schulz.py',
      code: `
        def newton_schulz5(G, steps=5):
            a, b, c = 3.4445, -4.7750, 2.0315  #@coef
            X = G / np.linalg.norm(G)          #@norm
            for _ in range(steps):             #@loop
                A = X @ X.T                    #@iter
                B = b * A + c * A @ A          #@iter
                X = a * X + B @ X              #@iter
            return X
        # extra compute ~ 5 * m / B           #@cost
      `,
      beats: [
        { id: 'svd', say: 'Computing {U Vᵀ|U V transpose} exactly takes an {SVD|S V D}, which is slow on a GPU: it is sequential, and wants thirty-two-bit precision.' },
        { id: 'mm', say: 'Newton-Schulz gets there with nothing but matrix multiplies, which GPUs do at full speed.', code: 'iter' },
        { id: 'key', say: 'The key fact: X, times X transpose, times X, keeps every singular direction, and cubes every singular value.' },
        { id: 'poly', say: 'So a mix of X, X cubed and X to the fifth applies one ordinary polynomial to every singular value at once.', code: 'iter' },
        { id: 'norm', say: 'First, divide by the norm, so that every singular value is at most 1.', code: 'norm' },
        { id: 's0', say: 'Here is an eight by eight momentum matrix. Normalized, its singular values run from {0.95|zero point nine five} down to one thousandth.', code: 'norm' },
        { id: 's1', say: "Each step multiplies the small ones by about {3.4|three point four}: the coefficient a, the polynomial's slope at zero.", code: ['coef', 'iter'] },
        { id: 's3', say: 'Step by step, they climb toward 1.', code: ['loop', 'iter'] },
        { id: 's5', say: 'After five steps, seven of eight sit between about {0.7|zero point seven} and {1.1|one point one}, and the smallest has grown four hundred and fifty times.', code: 'loop' },
        { id: 'band', say: 'They never land exactly on 1: the coefficients trade exactness for speed, and in practice the band does no harm.', code: 'coef' },
        { id: 'cost', say: 'Five steps is fifteen matrix multiplies. With width m and a batch of B tokens, that adds about five m over B: under one percent for real batches.', code: 'cost' },
      ],
    },
    {
      id: 'steepest',
      title: 'Steepest descent in two norms',
      codeTitle: 'steepest.py',
      code: `
        U, S, Vt = np.linalg.svd(G)
        # Frobenius ball: SGD
        d_frob = S / np.linalg.norm(S)  #@frob
        # spectral-norm ball: Muon
        d_spec = np.ones_like(S)        #@spec
        S @ d_frob   # smaller decrease  #@frob
        S @ d_spec   # = S.sum(): best   #@spec
      `,
      beats: [
        { id: 'choice', say: 'Why is this the right update? Taking a step downhill hides a choice: how do you measure the size of a step?' },
        { id: 'frob', say: 'Measure it by the length of all the entries together, and the best step points straight along the gradient. That is {SGD|S G D}.', code: 'frob' },
        { id: 'inf', say: 'Measure it by the largest single entry, and the best step is the sign of every entry, which is roughly what Adam does.' },
        { id: 'spec', say: 'Measure it by the spectral norm, the largest singular value, and the best step is {U Vᵀ|U V transpose}. That is Muon.', code: 'spec' },
        { id: 'picture', say: "Here it is in the gradient's own two directions. The disc is every step {SGD|S G D} allows. The square is every step Muon allows." },
        { id: 'corner', say: 'The best step in the disc favors the strongest direction. The best step in the square is always the corner: full size in every direction.', code: ['frob', 'spec'] },
        { id: 'natural', say: "The spectral norm is natural for a linear layer: it bounds how much the layer's output can change, for any input." },
        { id: 'family', say: "This view, from Bernstein and Newhouse in 2024, also links Muon to Shampoo, from 2018: drop Shampoo's memory, and its update is exactly {U Vᵀ|U V transpose}." },
      ],
    },
    {
      id: 'race',
      title: 'A race on a matrix',
      codeTitle: 'race.py',
      code: `
        for t in range(150):
            G = (W - W_star) @ X @ X.T / 4  #@grad
            # SGD + momentum
            M = 0.9 * M + G; W -= lr * M    #@sgd
            # Adam
            W -= lr * adam_dir(G)           #@adam
            # Muon
            W -= lr * newton_schulz5(M)     #@muon
      `,
      beats: [
        { id: 'setup', say: 'A toy race. Learn a two by two matrix from inputs that vary a lot along one direction, and a thousand times less along another: the rare one.', code: 'grad' },
        { id: 'turn', say: 'Both directions are turned 45 degrees from the axes, and each optimizer gets its best learning rate from a grid.' },
        { id: 'ellipse', say: 'Each ellipse shows what the current W does to the unit circle. The dashed one is the target.' },
        { id: 'sgd', say: '{SGD|S G D} fits the common direction fast, but hardly learns the rare one. Its ellipse stays flat.', code: 'sgd' },
        { id: 'adam', say: 'Adam is no better here. Its per-entry rescaling cannot isolate a direction that is not an axis.', code: 'adam' },
        { id: 'muon', say: 'Muon equalizes the two directions, and learns both.', code: 'muon' },
        { id: 'zero', say: 'Turn the rare direction onto an axis, and Adam becomes the best. {SGD|S G D} and Muon do not change at all: neither cares about the basis.' },
        { id: 'caveat', say: 'It is a toy that shows the mechanism, not a benchmark. The evidence is in real training runs.' },
      ],
    },
    {
      id: 'record',
      title: 'Track record and relatives',
      codeTitle: 'history.py',
      code: `
        # NanoGPT speedrun: GPT-2 small,  #@speed
        #   val loss 3.28 on 8 H100s      #@speed
        # Moonshot AI, 2025: at scale     #@moon
        #   + decoupled weight decay      #@moon
        #   + AdamW-sized updates         #@moon
        # relatives: Shampoo, SOAP        #@rel
        # transfer across widths: muP     #@mup
      `,
      beats: [
        { id: 'speed', say: 'Muon came out of the {NanoGPT|nano G P T} speedrun: train a small {GPT-2|GPT two} sized model to a fixed loss, as fast as possible, on eight {H100|H one hundred} GPUs.', code: 'speed' },
        { id: 'fell', say: 'In the second half of 2024, the record fell from about 45 minutes to a few. Muon, introduced that October, was one of the biggest single gains.', code: 'speed' },
        { id: 'scale', say: 'The open question was scale. In 2025, Moonshot AI found two changes that large runs need.', code: 'moon' },
        { id: 'fixes', say: "Add weight decay, as in {AdamW|Adam W}. And rescale each matrix's update to the size of AdamW's updates, so its hyperparameters carry over.", code: 'moon' },
        { id: 'moonlight', say: 'Their scaling experiments then matched {AdamW|Adam W} with roughly half the compute, and they trained Moonlight on {5.7|five point seven} trillion tokens.' },
        { id: 'k2', say: 'They later trained the trillion-parameter {Kimi K2|Kimi K two} with a Muon variant.' },
        { id: 'rel', say: 'Two relatives: Shampoo keeps statistics on both sides of the gradient, and {SOAP|soap} runs Adam in the basis they find. Both cost more than Muon.', code: 'rel' },
        { id: 'mup', say: "And {muP|mu P} rescales learning rates with width, so a small model's hyperparameters transfer to a big one. Muon's shape factor has the form it asks for.", code: 'mup' },
      ],
    },
    {
      id: 'outro',
      title: 'The modern recipe',
      codeTitle: 'train.py',
      code: `
        adamw = AdamW(rest, betas=(0.9, 0.95),  #@adamw
                      weight_decay=0.1)         #@adamw
        muon = Muon(hidden_matrices)            #@muon
        lr = warmup_then_cosine(t)              #@sched
        clip_grad_norm_(params, 1.0)            #@clip
        with autocast(torch.bfloat16):          #@bf16
            loss = model(x, y)                  #@bf16
      `,
      beats: [
        { id: 'recap', say: 'So here is the modern recipe, piece by piece.' },
        { id: 'adamw', say: "{AdamW|Adam W} decays every weight by the same fraction, instead of letting Adam's normalization scramble it.", code: 'adamw' },
        { id: 'sched', say: 'Warmup protects the first steps. Cosine, or warmup-stable-decay, ends at a small learning rate, below the noise floor.', code: 'sched' },
        { id: 'clip', say: 'Global norm clipping caps the rare, huge gradient, without turning it.', code: 'clip' },
        { id: 'bf16', say: '{bf16|B F sixteen} computes fast, while {fp32|F P thirty-two} master weights keep the small updates.', code: 'bf16' },
        { id: 'muon', say: 'And Muon treats each hidden matrix as a map: orthogonalized momentum, computed in five Newton-Schulz steps, for under one percent extra compute.', code: 'muon' },
        { id: 'next', say: 'Next, a model too big for one {GPU|G P U}: where all that memory goes, and how the work is split across thousands of them.', pause: 0.6 },
      ],
    },
  ],
};

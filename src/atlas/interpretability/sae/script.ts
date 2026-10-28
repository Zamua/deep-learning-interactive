import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-sae',
  title: 'Sparse autoencoders',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Bricken, Templeton, Batson, Chen, Jermyn et al.', year: 2023, title: 'Towards Monosemanticity: Decomposing Language Models With Dictionary Learning', url: 'https://transformer-circuits.pub/2023/monosemantic-features/index.html', scene: 'tangle' },
    { who: 'Olshausen & Field', year: 1996, title: 'Emergence of simple-cell receptive field properties by learning a sparse code for natural images', url: 'https://doi.org/10.1038/381607a0', scene: 'rebuild' },
    { who: 'Cunningham, Ewart, Riggs, Huben & Sharkey', year: 2023, title: 'Sparse Autoencoders Find Highly Interpretable Features in Language Models', url: 'https://arxiv.org/abs/2309.08600', scene: 'rebuild' },
  ],
  scenes: [
    {
      id: 'tangle',
      title: 'Features in a tangle',
      codeTitle: 'stream.py',
      code: `
        x = np.array([3, 1])   # the stream  #@x
        # x = 2 * v1 + 1 * v4                #@mix
        x[0], x[1]   # 3, 1: no one feature  #@raw
        # v1, v4, ...: not written down      #@goal
      `,
      beats: [
        { id: 'puzzle', say: 'Superposition left a puzzle: a model stores more features than its stream has numbers, each as a direction. Take a toy stream: three and one.', code: 'x' },
        { id: 'tangle', say: 'It holds two of one feature and one of another, along directions that match neither axis. Nothing in three and one says which.', code: 'mix' },
        { id: 'neuron', say: 'Real models show it too. In 2023, Trenton Bricken and colleagues at Anthropic found a neuron in a small language model firing for academic citations, English dialogue, {HTTP|H T T P} requests and Korean text.', code: 'raw' },
        { id: 'poly', say: 'A neuron with many meanings is called polysemantic.', code: 'raw' },
        { id: 'goal', say: 'To read the model, we need those directions, and no one wrote them down. A sparse autoencoder learns them from the activations: the vectors a layer produces.', code: 'goal' },
      ],
    },
    {
      id: 'wide',
      title: 'Wider, not narrower',
      codeTitle: 'sae.py',
      code: `
        d, m = 2, 8         # m / d = 4      #@dm
        f = relu(W_enc @ x + b_enc)  # (m,)  #@enc
        x_hat = f @ W_dec            # (d,)  #@dec
        W_dec.shape         # (m, d)         #@shape
      `,
      beats: [
        { id: 'recall', say: 'An autoencoder squeezes its input through a narrow middle, then rebuilds it.', code: ['enc', 'dec'] },
        { id: 'flip', say: 'Here features outnumber dimensions, so the middle is wider: m features for d dimensions. The ratio, m over d, is the expansion factor.', code: 'dm' },
        { id: 'toy', say: 'In this toy, d is two and m is eight: a factor of four.', code: 'dm' },
        { id: 'size', say: 'Bricken\'s team read a layer of {512|five hundred and twelve} neurons, and studied one run closely with a factor of eight: {4,096|four thousand and ninety six} features.', code: 'dm' },
        { id: 'unit', say: 'Each middle unit is a feature, its value computed with a ReLU: off at zero, or on by some amount.', code: 'enc' },
        { id: 'dir', say: 'Each feature owns a direction in the decoder: a row of d numbers, m times d in all. The rebuild adds up the directions of the features that are on, each scaled by its value.', code: ['dec', 'shape'] },
        { id: 'name', say: 'They form a dictionary: as a sentence uses a few of a dictionary\'s many words, an input uses a few of these many directions.', code: 'dec' },
        { id: 'copy', say: 'But a wide middle could just copy the input and learn nothing, unless most features are kept off.', code: 'enc' },
      ],
    },
    {
      id: 'loss',
      title: 'Pay for every feature',
      codeTitle: 'loss.py',
      code: `
        err = ((x - x_hat)**2).sum()         #@err
        l1 = lam * f.sum()    # f >= 0       #@l1
        loss = err + l1                      #@loss
        f = [0, 2, 0, 0, 1, 0, 0, 0]         #@f
        0.1 * (2 + 1)         # 0.3          #@pay
        # pull to 0: L2 2*lam*f, L1 lam      #@pull
      `,
      beats: [
        { id: 'err', say: 'Training balances two terms. One is the reconstruction error: how far the rebuild, {x̂|x hat}, lands from x.', code: 'err' },
        { id: 'l1', say: 'The other is a price on the code, the L1 penalty. Where L2 summed squares, L1 sums absolute values: the first power, not the second.', code: 'l1' },
        { id: 'sum', say: 'After the ReLU no feature is negative, so L1 is just the features\' sum, times a strength, {λ|lambda}.', code: ['l1', 'loss'] },
        { id: 'code', say: 'Take the code zero, two, zero, zero, one, zero, zero, zero. Two features are on, and they sum to three.', code: 'f' },
        { id: 'pay', say: 'With {λ|lambda} at {0.1|zero point one}, the penalty is {0.3|zero point three}, and the loss is the error plus that.', code: ['pay', 'loss'] },
        { id: 'fade', say: 'Why not squares? L2\'s pull toward zero is two {λ|lambda} times the value: it fades as a feature shrinks, so small ones linger.', code: 'pull' },
        { id: 'push', say: 'L1\'s pull stays {λ|lambda} however small the feature, so it pushes small, unhelpful ones all the way to zero.', code: 'pull' },
        { id: 'balance', say: 'Raise {λ|lambda}, and fewer features stay on, with a rougher rebuild. Lower it, and the rebuild improves as more turn on.', code: 'loss' },
      ],
    },
    {
      id: 'rebuild',
      title: 'A sum of a few directions',
      codeTitle: 'rebuild.py',
      code: `
        f[1], f[4]          # 2, 1: on       #@on
        2 * W_dec[1]        # 2 * [1, 1]     #@a
        1 * W_dec[4]        # 1 * [1, -1]    #@b
        x_hat = f @ W_dec   # [3, 1]         #@sum
      `,
      beats: [
        { id: 'on', say: 'Now rebuild the stream. Only features one and four are on, so only their directions count.', code: 'on' },
        { id: 'a', say: 'Feature one\'s direction is one, one. Times its value, two, that is two, two.', code: 'a' },
        { id: 'b', say: 'Feature four\'s direction is one and minus one. Its value is one, so it adds just that.', code: 'b' },
        { id: 'sum', say: 'Add them: {x̂|x hat} is three, one, the stream we started with, rebuilt from two dictionary entries.', code: 'sum' },
        { id: 'meaning', say: 'With so few features per input, each tends to stand for one thing: monosemantic, one meaning.', code: 'sum' },
        { id: 'olshausen', say: 'The idea is older than language models: in 1996, Bruno Olshausen and David Field learned a sparse code for natural images, and its parts came out like cells in the visual cortex.', code: 'sum' },
        { id: 'found', say: 'In 2023, Bricken\'s team and, separately, Hoagy Cunningham and colleagues found features this way that are more monosemantic than the model\'s raw numbers.', code: 'sum' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

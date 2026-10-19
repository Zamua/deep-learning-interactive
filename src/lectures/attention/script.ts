import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'attention',
  title: 'Attention and spatial transformers',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'Choosing where to look',
      codeTitle: 'look_once_vs_again.py',
      code: `
        # last chapter: look once
        x = cnn_fc(image)    # one vector     #@once
        h = np.dot(W_ih, x)  # first state    #@once
        for t in range(T):                    #@loop
            h = rnn_step(word, h)  # memory   #@loop
            word = sample(h)                  #@loop

        # this chapter: look again, every step
        feats = cnn_conv(image)  # a grid     #@grid
        for t in range(T):                    #@att
            z = attend(feats, h)  # where?    #@att
            h = rnn_step(word, z, h)          #@att
            word = sample(h)                  #@att
      `,
      beats: [
        { id: 'hello', say: 'Welcome to attention and spatial transformers.' },
        { id: 'once', say: 'The captioning network of the last chapter looks at its image exactly once.', code: 'once' },
        { id: 'squeeze', say: 'A {ConvNet|conv net} squeezes the picture into one vector, and the {RNN|R N N} writes every word from that one summary.', code: ['once', 'loop'] },
        { id: 'dig', say: 'Horse, grass, sky: every word has to be dug out of the same few hundred numbers.', code: 'loop' },
        { id: 'better', say: 'This chapter\'s better idea: let the network choose where to look, and look somewhere new for every word.', code: ['grid', 'att'] },
        { id: 'soft', say: 'We will meet two families of answers. Soft attention looks everywhere at once, but with weights.', code: 'att' },
        { id: 'stn', say: 'Spatial transformers learn to crop, zoom and straighten their input, with a smooth warp.' },
        { id: 'secret', say: 'Both share one secret. They make where to look a smooth function, so plain backprop can learn it.' },
      ],
    },
    {
      id: 'bottleneck',
      title: 'One vector is a bottleneck',
      codeTitle: 'seq2seq.py',
      code: `
        # sequence to sequence (2014)
        for word in english:                  #@enc
            h = encoder(word, h)              #@enc
        summary = h   # one fixed-size vector #@bottle
        for t in range(T):                    #@dec
            out = decoder(out, summary)       #@dec

        # the fix: keep every state
        v = []                                #@keep
        for word in english:                  #@keep
            h = encoder(word, h)              #@keep
            v.append(h)   # one v per word    #@keep
        feats = conv5(image)  # one v per cell #@img
      `,
      beats: [
        { id: 'trans', say: 'The same problem shows up in machine translation.' },
        { id: 'enc', say: 'The sequence to sequence models of {2014|twenty fourteen} read the whole English sentence with one {RNN|R N N}...', code: 'enc' },
        { id: 'hand', say: 'then hand its final state, one fixed size vector, to a second {RNN|R N N} that writes French.', code: ['bottle', 'dec'] },
        { id: 'size', say: 'A five word sentence and a fifty word sentence get exactly the same number of numbers.', code: 'bottle' },
        { id: 'worse', say: 'So long sentences come out noticeably worse.', code: 'bottle' },
        { id: 'keep', say: 'The fix is to keep the whole input around, as a set of vectors instead of one.', code: 'keep' },
        { id: 'image', say: 'For a sentence, that is the encoder state after each word. For an image, the grid of conv features, one per region.', code: 'img' },
        { id: 'pick', say: 'Then, at every output step, the decoder picks out what it needs right now.' },
        { id: 'phone', say: 'Describing a photo over the phone, you do not memorize it, then talk with your eyes closed.' },
        { id: 'glance', say: 'You glance back before each phrase: the horse, then the grass, then the sky. Attention gives the network that glance.' },
      ],
    },
    {
      id: 'scores',
      title: 'Scoring every location',
      codeTitle: 'soft_attention.py',
      code: `
        feats = vgg_conv5(image)  # (196, 512) #@feats
        # toy: an 8x8 grid, 5 numbers  (64, 5) #@toy
        q = np.dot(Wa, h)   # the wish list    #@q
        # q = [{{q:1, 0.8, -0.3, -0.5, -1}}]   #@q
        scores = np.dot(feats, q)   # (64,)    #@e
        # scores[i] = np.sum(feats[i] * q)     #@dot
      `,
      beats: [
        { id: 'vgg', say: 'Show, Attend and Tell, from {2015|twenty fifteen}, built this into a captioner. Run the image through a {ConvNet|conv net}, and stop at the last conv layer, where it is still a grid.', code: 'feats' },
        { id: 'L', say: '{14 × 14|Fourteen by fourteen} locations, {512|five hundred and twelve} numbers each: {196|one hundred and ninety six} feature vectors, v one to v L, one per patch.', code: 'feats' },
        { id: 'toy', say: 'To keep it small enough to see, here is a real {CIFAR-10|see-far ten} image, cut into an eight by eight grid...', code: 'toy' },
        { id: 'five', say: 'with five hand-made numbers per cell: brightness, blueness, greenness, warmth, and texture.', code: 'toy' },
        { id: 'step', say: 'At every step, the {RNN|R N N} does three small things. First, it scores each location: how relevant is this patch to the next word?' },
        { id: 'query', say: 'It turns its hidden state, h, into a query, a wish list of features. If the next word is sky, the wish is bright, blue, and smooth.', code: 'q' },
        { id: 'dot', say: 'Each location is graded by a dot product: multiply its features by the query, entry by entry, and add up.', code: ['e', 'dot'] },
        { id: 'match', say: 'Where features match the wish, the products are positive, and the score is high.', code: 'dot' },
        { id: 'clash', say: 'Where they clash, like the dark, textured horse, the score goes negative.', code: 'dot' },
        { id: 'map', say: 'Do that for all sixty four cells, and you get a map of scores. Purple is high, dark is low.', code: 'e' },
        { id: 'nothing', say: 'Nothing is chosen yet: just one score per location, like the class scores of a linear classifier.', code: 'e' },
      ],
    },
    {
      id: 'softmax',
      title: 'Scores into weights',
      codeTitle: 'softmax.py',
      code: `
        scores = np.dot(feats, q) * {{beta:2}}  #@e
        alpha = np.exp(scores - scores.max())  #@exp
        alpha = alpha / alpha.sum()            #@norm
        # every alpha > 0, and they sum to 1   #@norm
        # top cell gets {{top:17}}%                #@top
      `,
      beats: [
        { id: 'second', say: 'Second, the scores become a probability distribution over locations, with the same {softmax|soft max} used for class scores.', code: ['exp', 'norm'] },
        { id: 'exp', say: 'To get there, exponentiate. e to the power of anything is positive, so even negative scores become small positive numbers.', code: 'exp' },
        { id: 'win', say: 'And it grows fast: each extra point of score multiplies the result by about {2.7|two point seven}, so high scores win big.', code: 'exp' },
        { id: 'max', say: 'Subtracting the top score first changes nothing, but keeps the numbers from overflowing.', code: 'exp' },
        { id: 'norm', say: 'Then divide by the total. Each weight, {αᵢ|alpha i}, lands between zero and one, and together they sum to one.', code: 'norm' },
        { id: 'budget', say: 'Think of it as a budget of attention, one hundred percent, spread over the image.', code: 'norm' },
        { id: 'map', say: 'On the image, the bright cells get the attention. Most of the budget lands on a few patches of sky.', code: 'top' },
        { id: 'sharp', say: 'A sharpness knob, multiplying the scores, sets how peaked it is.', code: 'e' },
        { id: 'low', say: 'Turn it down, and the attention spreads out over everything.', code: ['e', 'top'] },
        { id: 'high', say: 'Turn it up, and it locks onto a single cell.', code: ['e', 'top'] },
      ],
    },
    {
      id: 'context',
      title: 'The weighted average',
      codeTitle: 'context.py',
      code: `
        z = np.dot(alpha, feats)   # (5,)     #@z
        # the same, as a loop:                #@loop
        z = np.zeros(5)                       #@loop
        for i in range(64):                   #@loop
            z += alpha[i] * feats[i]          #@loop
        # z = [{{z:1.3, 1.4, -0.3, -1.7, -1.2}}] #@val
        # z = E[feats[i]],  i ~ alpha         #@exp
      `,
      beats: [
        { id: 'third', say: 'Third, the network reads the image through those weights: a weighted average of the feature vectors.', code: 'z' },
        { id: 'scale', say: 'Scale each location\'s vector by its weight, and add them all up.', code: 'loop' },
        { id: 'one', say: 'The result, z, is a single vector, the same size as one location\'s features.', code: 'z' },
        { id: 'mostly', say: 'But it mostly describes the high attention places. The gold bars come out bright, blue and smooth, close to the query.', code: 'val' },
        { id: 'color', say: 'Average the pixel colors with the same weights, and you get the pale blue of the sky.', code: 'val' },
        { id: 'expect', say: 'Another way to read this sum: as an expectation, a probability weighted average.', code: 'exp' },
        { id: 'die', say: 'Roll a fair die, and the expectation is three and a half, even though no single roll is three and a half.' },
        { id: 'soft', say: 'Soft attention computes the expected feature vector directly, as if picking locations at random with probabilities {α|alpha}.', code: 'exp' },
        { id: 'diff', say: 'Every step was a multiply, an add, or an exponential, so it is all differentiable, and backprop can tune it.', code: 'z' },
        { id: 'nolabel', say: 'No label ever has to say where to look.' },
      ],
    },
    {
      id: 'loop',
      title: 'The whole loop',
      codeTitle: 'caption_with_attention.py',
      code: `
        h = init_state(feats)                 #@init
        word = '<START>'                      #@init
        for t in range(T):                    #@loop
            scores = np.dot(feats,            #@att
                            np.dot(Wa, h))    #@att
            alpha = softmax(scores)           #@att
            z = np.dot(alpha, feats)          #@att
            h = lstm(embed(word), z, h)       #@rnn
            word = sample(np.dot(Wout, h))    #@word
      `,
      beats: [
        { id: 'put', say: 'Put together, one time step of an attention captioner reads like this.', code: 'loop' },
        { id: 'init', say: 'Start from the grid of features, with a first hidden state computed from the image.', code: 'init' },
        { id: 'att', say: 'Score every location against the hidden state, {softmax|soft max}, and average: that is the context, z.', code: 'att' },
        { id: 'rnn', say: 'Feed z, along with the previous word, into the {LSTM|L S T M}.', code: 'rnn' },
        { id: 'two', say: 'Out come two things: a distribution over words, from which the next word is sampled...', code: 'word' },
        { id: 'back', say: 'and a new hidden state, which goes back to score the locations again, for the step after.', code: ['rnn', 'att'] },
        { id: 'maps', say: 'In a trained model, the attention maps line up with the words, startlingly well.', code: 'att' },
        { id: 'horse', say: 'While writing horse, the bright region sits on the horse. At the word grass, it moves down to the grass.', code: 'att' },
        { id: 'nobody', say: 'Nobody labeled those regions. The model found that looking at grass helps predict the word grass.' },
        { id: 'mistakes', say: 'The maps also make mistakes legible: when a caption goes wrong, you can often see where the model was looking.' },
      ],
    },
    {
      id: 'hard',
      title: 'Soft versus hard attention',
      codeTitle: 'soft_vs_hard.py',
      code: `
        alpha = softmax(np.dot(feats, q) * 2) #@a
        # soft: the expectation, smooth       #@soft
        z_soft = np.dot(alpha, feats)         #@soft
        # hard: roll a loaded die             #@hard
        i = np.random.choice(64, p=alpha)     #@hard
        z_hard = feats[i]                     #@hard
        # mean of {{n:0}} picks, close to z_soft #@mean
      `,
      beats: [
        { id: 'literal', say: 'The same paper tried a more literal version: instead of averaging, pick one location, and look only there.', code: 'hard' },
        { id: 'die', say: 'Treat the weights as a loaded, sixty four sided die, and use only the cell it lands on. That is cheaper, and arguably closer to how eyes work.', code: 'hard' },
        { id: 'nograd', say: 'But a random draw has no gradient. Nudge a weight, and the pick usually does not change at all...', code: 'hard' },
        { id: 'jump', say: 'or it suddenly jumps to another cell. There is nothing smooth for backprop to follow.', code: 'hard' },
        { id: 'rl', say: 'So hard attention is trained with tools from reinforcement learning, the {REINFORCE|re-inforce} family.' },
        { id: 'reinf', say: 'Sample a location, see how good the caption was, and make that choice more likely if it helped. It works, but noisily.' },
        { id: 'picks', say: 'Now watch the picks pile up. Each single pick is noisy...', code: 'mean' },
        { id: 'converge', say: 'but their average, the teal marks, closes in on the gold bars. Soft attention is the expected value of hard attention.', code: ['soft', 'mean'] },
        { id: 'cost', say: 'Soft attention skips the noise by computing the expectation exactly. The price: it reads every location, every step.', code: 'soft' },
      ],
    },
    {
      id: 'translation',
      title: 'Translation, speech and video',
      codeTitle: 'translate_attention.py',
      code: `
        # v[j]: encoder state after word j    #@v
        # h: the decoder's current state      #@v
        scores = np.array([f_att(h, v[j])     #@e
                           for j in range(J)])#@e
        alpha = softmax(scores)  # which words #@a
        z = np.dot(alpha, v)   # the context  #@z
        # alpha[t, j]: output t, source j     #@grid
      `,
      beats: [
        { id: 'inspired', say: 'Soft attention for captioning was itself inspired by machine translation.' },
        { id: 'bahdanau', say: 'In {2015|twenty fifteen}, Bahdanau, Cho and Bengio let a translation decoder attend over the encoder states, one per source word.', code: 'v' },
        { id: 'same', say: 'It is exactly the same three steps. Score each source word against the decoder\'s state...', code: 'e' },
        { id: 'soft', say: '{softmax|soft max} the scores into weights, and average the encoder states into a context for the next word.', code: ['a', 'z'] },
        { id: 'grid', say: 'Plot the weights as a grid, output words down, source words across, and you get a soft alignment.', code: 'grid' },
        { id: 'diag', say: 'It is mostly diagonal, since the two languages mostly keep the same order...', code: 'grid' },
        { id: 'swap', say: 'but it bends where they differ. Black cat becomes chat noir: the noun comes first in French, and the attention crosses over.', code: 'grid' },
        { id: 'split', say: 'And one French word, {dort|dor}, spreads its attention over two English words: is sleeping.', code: 'grid' },
        { id: 'speech', say: 'The pattern spread to anything sequential: speech recognizers attend over audio frames, and video captioners over frames in time.' },
              ],
    },
    {
      id: 'draw',
      title: 'DRAW: attending to any box',
      codeTitle: 'draw_read.py',
      code: `
        N = 6
        gX, gY = {{gx:16}}, {{gy:16}}   # grid center  #@g
        delta, sigma = {{delta:3}}, {{sigma:1}}        #@ds
        i = np.arange(1, N + 1)
        mu_x = gX + (i - N/2 - 0.5) * delta   #@mu
        a = np.arange(32)    # pixel columns  #@F
        Fx = np.exp(-(a - mu_x[:, None])**2   #@F
                    / (2 * sigma**2))         #@F
        Fx /= Fx.sum(axis=1, keepdims=True)   #@F
        glimpse = Fy.dot(U).dot(Fx.T) # (6,6) #@read
      `,
      beats: [
        { id: 'limit', say: 'Attention over a fixed grid can only choose among its cells, at its resolution.' },
        { id: 'any', say: 'Could a network attend to an arbitrary box, at any position, and any size?' },
        { id: 'draw', say: 'DRAW, also from {2015|twenty fifteen}, an {RNN|R N N} that paints step by step, reads through an N by N grid of Gaussian filters.' },
        { id: 'nums', say: 'The {RNN|R N N} outputs just a few numbers. The grid\'s center, g X and g Y...', code: 'g' },
        { id: 'stride', say: 'the stride, {δ|delta}, how far apart the filters sit, which sets the zoom, and a blur, {σ|sigma}.', code: 'ds' },
        { id: 'mu', say: 'The filter centers are N evenly spaced points around g X, {δ|delta} pixels apart.', code: 'mu' },
        { id: 'bell', say: 'Each filter is a bell curve over the pixel columns: a pixel\'s weight falls off smoothly with distance from the center, and each row sums to one.', code: 'F' },
        { id: 'read', say: 'Blur and sample the rows with F Y, and the columns with F X, and the image shrinks to a six by six glimpse.', code: 'read' },
        { id: 'move', say: 'Move the center, and the glimpse slides across the image.', code: 'g' },
        { id: 'zoom', say: 'Widen the stride to see the whole picture coarsely. Shrink it to zoom in on a detail.', code: 'ds' },
        { id: 'smooth', say: 'A crop and a zoom, built from smooth bell curves instead of hard edges, so the network gets a gradient for moving and resizing its window.', code: ['mu', 'F'] },
      ],
    },
    {
      id: 'stn',
      title: 'Spatial transformer networks',
      codeTitle: 'spatial_transformer.py',
      code: `
        theta = loc_net(U)   # 6 numbers      #@loc
        theta = theta.reshape(2, 3)           #@loc
        # [[{{a:1.00}}, {{b:0.00}}, {{tx:0.00}}],         #@theta
        #  [{{c:0.00}}, {{d:1.00}}, {{ty:0.00}}]]         #@theta
        t = np.linspace(-1, 1, 32)            #@grid
        ys, xs = np.meshgrid(t, t, indexing='ij') #@grid
        target = np.stack([xs.ravel(),        #@grid
            ys.ravel(), np.ones(32 * 32)])    #@grid
        source = np.dot(theta, target)        #@src
        V = bilinear_sample(U, source)        #@sample
      `,
      beats: [
        { id: 'jader', say: 'Spatial transformer networks, also from {2015|twenty fifteen}, extend this to any smooth warp, in a layer for any {ConvNet|conv net}.' },
        { id: 'in', say: 'It takes an input, U, an image or a feature map, and produces an output, V, in three parts.' },
        { id: 'loc', say: 'First, a localization network, any small network, looks at U, and outputs the parameters, {θ|theta}, of a transform.', code: 'loc' },
        { id: 'six', say: 'For an {affine|uh-fine} transformation, any mix of zoom, rotation, shift and shear, that is just six numbers.', code: 'theta' },
        { id: 'gridgen', say: 'Second, a grid generator lays a regular grid over the output, and asks where in the input each output pixel should read from.', code: 'grid' },
        { id: 'matrix', say: 'That is one matrix multiply: {θ|theta}, times the target position with a one stacked under it.', code: 'src' },
        { id: 'bias', say: 'That one is the bias trick from linear classifiers: it lets the same multiply add the shift.', code: 'src' },
        { id: 'sampler', say: 'Third, a sampler reads the input at those positions.', code: 'sample' },
        { id: 'identity', say: 'With {θ|theta} equal to the identity, every pixel reads from its own position, and the layer does nothing.', code: 'theta' },
        { id: 'zoom', say: 'Halve the diagonal, and the grid covers only the middle of the input: a two times zoom.', code: 'theta' },
        { id: 'rotate', say: 'Rotate the grid, and the output turns the other way, because the grid says where to read, not where to write.', code: 'theta' },
        { id: 'shear', say: 'Shift it, shear it: the output is always that region, straightened out.', code: ['theta', 'sample'] },
      ],
    },
    {
      id: 'bilinear',
      title: 'Bilinear sampling',
      codeTitle: 'bilinear.py',
      code: `
        U = np.array([[ 40, 200, 120],
                      [ 90,  30, 250],
                      [180, 140,  60]])
        x, y = {{x:0.60}}, {{y:0.30}}   # where to read #@xy
        x0, y0 = int(x), int(y)
        x1, y1 = x0 + 1, y0 + 1
        wa = (x1 - x) * (y1 - y)  # {{wa:0.28}}  #@w
        wb = (x - x0) * (y1 - y)  # {{wb:0.42}}  #@w
        wc = (x1 - x) * (y - y0)  # {{wc:0.12}}  #@w
        wd = (x - x0) * (y - y0)  # {{wd:0.18}}  #@w
        V = (wa * U[y0, x0] + wb * U[y0, x1]  #@v
             + wc * U[y1, x0] + wd * U[y1, x1]) #@v
        # V = {{v:111.4}}                        #@v
        # dV/dx = {{gx:94}},  dV/dy = {{gy:-82}}       #@g
      `,
      beats: [
        { id: 'frac', say: 'Source positions rarely land exactly on a pixel. Here the grid reads at x equals {0.6|zero point six}, y equals {0.3|zero point three}.', code: 'xy' },
        { id: 'four', say: 'So the sampler blends the four nearest pixels.', code: 'xy' },
        { id: 'area', say: 'Each neighbor\'s weight is the area of the rectangle opposite it. The closer the point is to a pixel, the bigger that pixel\'s rectangle.', code: 'w' },
        { id: 'sum', say: 'The four rectangles tile one square, so the weights always sum to one.', code: 'w' },
        { id: 'value', say: 'The output is the weighted sum of the four gray values.', code: 'v' },
        { id: 'slide', say: 'Slide the point, and the value changes smoothly, with no jumps.', code: ['xy', 'v'] },
        { id: 'grad', say: 'So it has a slope. The red arrow is the gradient of V with respect to the point\'s position: the way to make the output brighter.', code: 'g' },
        { id: 'pix', say: 'That gives two gradients. One with respect to the pixel values, so earlier layers can learn...', code: 'v' },
        { id: 'where', say: 'and one with respect to the sampling position, so the localization net learns where to look.', code: 'g' },
        { id: 'kink', say: 'Strictly, the weights have kinks at whole pixels, where the gradient is only a sub-gradient. In practice, that does not matter.' },
      ],
    },
    {
      id: 'learned',
      title: 'What the transformer learns',
      codeTitle: 'train_stn.py',
      code: `
        V = spatial_transformer(U)  # has theta #@st
        scores = convnet(V)                  #@net
        loss = softmax_loss(scores, y)       #@loss
        # no label for theta: only the loss  #@back
        grads = backprop(loss)               #@back
        theta_net -= lr * grads['theta_net'] #@back
      `,
      beats: [
        { id: 'nolabel', say: 'Nothing ever tells the localization network which transformation is right.', code: 'st' },
        { id: 'loss', say: 'It is trained only by the final loss. If straightening the input makes the classifier more accurate...', code: ['net', 'loss'] },
        { id: 'push', say: 'then gradients flowing back through the sampler push {θ|theta} toward straightening.', code: 'back' },
        { id: 'mnist', say: 'On distorted {MNIST|em nist}, with digits randomly rotated, scaled and shifted, often in clutter...' },
        { id: 'undo', say: 'the transformer learned to undo the distortion, handing the classifier an upright, centered digit, and beat plain {ConvNets|conv nets}.', code: 'st' },
        { id: 'svhn', say: 'On Street View house numbers, it cropped and straightened the digits, and improved accuracy.' },
        { id: 'birds', say: 'On fine-grained bird species, a network with two transformers in parallel learned, with no part labels at all...' },
        { id: 'head', say: 'to have one zoom in on the bird\'s head, and the other on its body.' },
        { id: 'drop', say: 'Because it is differentiable, it drops in anywhere, at the input or between conv layers, and the network trains as usual.', code: 'back' },
      ],
    },
    {
      id: 'outro',
      title: 'Attention, after the course',
      codeTitle: 'self_attention.py',
      code: `
        # 2017: drop the RNN, keep attention
        Q = X.dot(Wq)     # what a word wants  #@qkv
        K = X.dot(Wk)     # what it offers     #@qkv
        Vals = X.dot(Wv)  # what it hands over #@qkv
        scores = Q.dot(K.T)        # (T, T)    #@e
        alpha = softmax(scores, axis=1)        #@a
        Z = alpha.dot(Vals)  # all at once     #@z
      `,
      beats: [
        { id: 'after', say: 'Then came a twist. In {2017|twenty seventeen}, Attention Is All You Need asked: what if we drop the {RNN|R N N}, and keep only attention?' },
        { id: 'every', say: 'In the Transformer, every position of a sequence attends to every other position.', code: 'e' },
        { id: 'qkv', say: 'Each word computes a query, and every word offers a key and a value.', code: 'qkv' },
        { id: 'same', say: 'Query key dot products give scores, a {softmax|soft max} gives weights, and each word becomes a weighted average of the values: this chapter\'s recipe, for every word at once.', code: ['e', 'a', 'z'] },
        { id: 'parallel', say: 'With no recurrence, it trains in parallel on {GPUs|G P Us}. It took over translation, then nearly all of language.' },
        { id: 'vit', say: 'Vision followed. The Vision Transformer cut images into sixteen by sixteen pixel patches, treated each as a word, and matched the best {ConvNets|conv nets}, given enough data.' },
        { id: 'recap1', say: 'To recap: one summary vector is a bottleneck. Soft attention keeps a set of vectors, and at every step scores, {softmaxes|soft maxes} and averages them.' },
        { id: 'recap2', say: 'Hard attention samples one location instead, and trains with reinforcement learning.' },
        { id: 'recap3', say: 'Spatial transformers predict a warp, turn it into a sampling grid, and read it bilinearly, smooth in both pixels and positions.' },
        { id: 'next', say: 'Next, video, and learning without labels: autoencoders, and networks that learn to make new images.' },
        { id: 'dl26', say: 'And when you are ready, the {DL26|D L twenty six} course picks up from here, with transformers.', pause: 0.6 },
      ],
    },
  ],
};

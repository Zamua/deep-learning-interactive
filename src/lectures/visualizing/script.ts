import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'visualizing',
  title: 'Understanding and visualizing ConvNets',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'Looking inside',
      codeTitle: 'toolbox.py',
      code: `
        scores, cache = forward(x)   # 'cat'     #@fwd
        # decided by 35,754 numbers              #@params

        why = ['debugging',  # wrong evidence?   #@debug
               'trust',      # sensible parts?   #@trust
               'science']    # what was learned? #@science

        tools = ['activations', 'filters',       #@tools
                 'top images', 't-SNE',          #@tools
                 'occlusion', 'saliency',        #@tools
                 'dreams', 'fooling images']     #@tools
        # each answers one narrow question       #@clue
      `,
      beats: [
        { id: 'hello', say: 'This lecture is about looking inside a trained ConvNet.' },
        { id: 'cat', say: 'Show this small one a photo, and it answers: cat, ninety seven percent sure.', code: 'fwd' },
        { id: 'how', say: 'But how did it decide? The answer is spread over thirty six thousand numbers, and reading them one by one tells you almost nothing.', code: 'params' },
        { id: 'toolbox', say: 'So between {2013|twenty thirteen} and {2015|twenty fifteen}, researchers built a toolbox for looking inside.' },
        { id: 'why', say: 'Why look? To debug a model that keys on the wrong evidence, like a background or a watermark. To trust it. And for science: what did it discover on its own?', code: ['debug', 'trust', 'science'] },
        { id: 'tools', say: 'We will see its weights and activations, maps of which pixels matter, images it dreams up, and one deeply unsettling discovery.', code: 'tools' },
        { id: 'clue', say: 'One warning: each tool answers one narrow question. Treat every picture as a clue, not an explanation.', code: 'clue' },
      ],
    },
    {
      id: 'network',
      title: 'The network on this page',
      codeTitle: 'convnet.py',
      code: `
        def forward(x):              # (3, 32, 32)   #@def
            cache, a = {}, x                         #@def
            for k in (1, 2, 3):                      #@loop
                z = conv_forward(a, W[k], b[k])      #@conv
                r = np.maximum(0, z)       # ReLU    #@relu
                a = max_pool_2x2(r)        # halve   #@pool
                cache['conv%d' % k] = r              #@cache
                cache['pool%d' % k] = a              #@cache
            scores = W_fc.dot(a.ravel()) + b_fc      #@fc
            return scores, cache                     #@fc

        dx = backward_to_image(cache, dscores)       #@bwd
        # dx: (3, 32, 32), one slope per input       #@bwd
      `,
      beats: [
        { id: 'one', say: 'Every picture here comes from one small network, trained on {CIFAR-10|see-far ten}, and running live in your browser.' },
        { id: 'input', say: 'Its input is a {32 × 32|thirty two by thirty two} color image, minus the average color.', code: 'def' },
        { id: 'blocks', say: 'Then come three blocks of the same three steps. First, a convolution with a bank of filters: sixteen, then thirty two, then sixty four.', code: ['loop', 'conv'] },
        { id: 'relu', say: 'Then a {ReLU|ray-loo}, which zeroes every negative number. And max pooling, which halves the height and the width.', code: ['relu', 'pool'] },
        { id: 'code', say: 'What is left, sixty four maps of four by four, is the image\'s CNN code: {1,024|a thousand and twenty four} numbers.', code: 'pool' },
        { id: 'fc', say: 'One last layer turns it into ten class scores. On test images, the network is right {82%|eighty two percent} of the time.', code: 'fc' },
        { id: 'cache', say: 'Forward keeps every intermediate result in a cache, so we can look at any layer.', code: 'cache' },
        { id: 'bwd', say: 'And a second call backpropagates all the way to the pixels: one slope per input value, saying how fast the output changes with it.', code: 'bwd' },
        { id: 'two', say: 'Every tool in this lecture is built from these two calls.', code: ['def', 'bwd'] },
      ],
    },
    {
      id: 'activations',
      title: 'Feature maps',
      codeTitle: 'activations.py',
      code: `
        # one number of feature map k:
        patch = x[:, i:i+7, j:j+7]   # (3, 7, 7)   #@patch
        F[k, i, j] = max(0, np.sum(W[k] * patch)   #@F
                            + b[k])                #@F

        scores, cache = forward(x)                 #@fwd
        F = cache['{{layer:conv1}}']   # {{shape:(16, 32, 32)}}     #@layer
        (F == 0).mean()   # {{zeros:0.52}} on average    #@zeros
        alive = F.max(axis=(1, 2)) > 0             #@dead
      `,
      beats: [
        { id: 'what', say: 'First, the most direct view: what each layer computes for one image.' },
        { id: 'filter', say: 'Take one first-layer filter: a block of weights, seven by seven pixels, times three colors.', code: 'patch' },
        { id: 'dot', say: 'Lay it on a patch of the image, multiply each weight by the pixel under it, and add up the products: a match score.', code: ['patch', 'F'] },
        { id: 'slide', say: 'The {ReLU|ray-loo} keeps only positive matches. Slide the filter everywhere, and you paint a map of where its pattern appears.', code: 'F' },
        { id: 'maps', say: 'Sixteen filters, sixteen maps: the layer\'s activations, or feature maps. In conv1 they still look like the photo.', code: ['fwd', 'layer'] },
        { id: 'deeper', say: 'Conv2\'s maps are coarser and more selective. Conv3\'s, eight by eight, are mostly dark.', code: 'layer' },
        { id: 'sparse', say: 'Across the test set, half of conv1\'s values are zero, and eighty percent of conv3\'s. Deep units fire only for what they detect.', code: 'zeros' },
        { id: 'dead', say: 'A map that stays black for every image means a dead filter: its {ReLU|ray-loo} never opens, so it never learns again. This network has none.', code: 'dead' },
      ],
    },
    {
      id: 'filters',
      title: 'First-layer filters',
      codeTitle: 'show_filters.py',
      code: `
        W = snapshots['{{snap:initial}}']['conv1']    #@load
        # W: (16, 3, 7, 7), sixteen tiny pictures     #@load
        for k in range(16):                           #@loop
            f = W[k].transpose(1, 2, 0)  # 7x7x3    #@img
            f = (f - f.min()) / np.ptp(f)  # 0..1   #@img
            plt.subplot(2, 8, k + 1)                  #@show
            plt.imshow(f)                             #@show
        # test accuracy: {{acc:11%}}                      #@acc
      `,
      beats: [
        { id: 'weights', say: 'Weights, unlike activations, do not depend on the image. And first-layer weights look straight at pixels.' },
        { id: 'draw', say: 'So each filter is itself a tiny seven by seven color picture, and we can just draw it.', code: ['loop', 'img', 'show'] },
        { id: 'init', say: 'Before training: random noise, and eleven percent accuracy, which is chance.', code: ['load', 'acc'] },
        { id: 'steps', say: 'After a hundred steps, accuracy is forty six percent, yet the filters still look like noise.', code: ['load', 'acc'] },
        { id: 'epochs', say: 'After three epochs they turn smooth, and by thirty, two families stand out.', code: ['load', 'acc'] },
        { id: 'edges', say: 'Oriented edge detectors: light and dark bars at different angles.' },
        { id: 'blobs', say: 'And color blobs: one color against its opposite.' },
        { id: 'alex', say: '{AlexNet|Alex net}\'s first layer shows the same two families. Smooth, clean filters like these mean a network trained well. Noisy ones mean it needs more training, or more regularization.' },
        { id: 'deeper', say: 'Deeper filters weigh feature maps, not pixels, so for them we look at what they respond to instead.' },
      ],
    },
    {
      id: 'top-images',
      title: 'Images that excite a unit',
      codeTitle: 'top_images.py',
      code: `
        A = np.stack([forward(x)[1]['pool3']    #@A
                      for x in images])         #@A
        # A: (1200, 64, 4, 4)                   #@A
        if mode == 'channel':                   #@unit
            d = np.eye(64)[20]                  #@unit
        else:                                   #@rand
            d = np.random.randn(64)             #@rand
            d /= np.linalg.norm(d)              #@rand
        resp = np.einsum('nchw,c->nhw', A, d)   #@resp
        best = resp.reshape(1200, -1).max(1)    #@best
        top8 = np.argsort(-best)[:8]            #@best
      `,
      beats: [
        { id: 'idea', say: 'Pick one unit deep in the network, run twelve hundred images through it, and keep the ones that make it fire hardest.', code: ['A', 'best'] },
        { id: 'ch20', say: 'Channel twenty of the last pooling layer: its top eight are all cars.', code: ['unit', 'resp', 'best'] },
        { id: 'rf', say: 'A deep unit sees only part of the image, its receptive field, boxed here in yellow.', code: 'resp' },
        { id: 'space', say: 'But think of the layer\'s output at one spot as a point in sixty four dimensions. Channel twenty is just one axis of that space.' },
        { id: 'random', say: 'Szegedy and colleagues tried random directions instead: random mixes of all the channels.', code: 'rand' },
        { id: 'same', say: 'Their top images look just as coherent. This one is mostly horses.', code: ['rand', 'resp', 'best'] },
        { id: 'count', say: 'On average, a channel\'s top eight share a label {4.1|four point one} times, a random direction\'s {4.0|four point oh} times, and chance gives {2.4|two point four}.' },
        { id: 'meaning', say: 'So single neurons are not special. The meaning lives in the space the whole layer spans.' },
      ],
    },
    {
      id: 'tsne',
      title: 'A map of the codes',
      codeTitle: 'tsne_codes.py',
      code: `
        F = np.stack([forward(x)[1]['pool3']     #@F
                      .ravel() for x in X])      #@F
        # F: (1000, 1024), one code per image    #@F
        P = X.reshape(1000, -1)   # raw pixels   #@P
        feats = {{feats:F}}                      #@pick
        Y = TSNE(n_components=2).fit_transform(  #@tsne
                feats)               # (1000, 2) #@tsne
        q = 13                                   #@nn
        dist = ((feats - feats[q]) ** 2).sum(1)  #@nn
        neighbors = np.argsort(dist)[1:7]        #@nn
      `,
      beats: [
        { id: 'code', say: 'To see the whole representation at once, take each image\'s CNN code: the {1,024|thousand and twenty four} numbers of the last pooling layer.', code: 'F' },
        { id: 'close', say: 'Codes that lie close together belong to images the network finds similar.', code: 'F' },
        { id: 'squash', say: '{t-SNE|Tee snee} squashes them down to two dimensions, sliding points around until neighbors in the big space are neighbors on the page.', code: 'tsne' },
        { id: 'map', say: 'Here are a thousand images at their spots. Vehicles gather in one region, animals in another, with planes and ships near the sky and water.', code: ['pick', 'tsne'] },
        { id: 'pixels', say: 'Embed the raw pixels instead, and the map sorts by color and brightness, not by meaning.', code: ['P', 'pick'] },
        { id: 'nn', say: 'This horse\'s six nearest neighbors in code space are all horses. In pixel space: planes, birds, and a cat.', code: 'nn' },
        { id: 'count', say: 'Overall, a code-space neighbor shares the label {55%|fifty five percent} of the time, a pixel-space neighbor {26%|twenty six percent}.', code: 'nn' },
        { id: 'caveat', say: 'One caution: in such a map, the gaps between far-apart clusters mean little.' },
      ],
    },
    {
      id: 'occlusion',
      title: 'Hide part of the image',
      codeTitle: 'occlusion.py',
      code: `
        def span(m, p):    # p pixels around m     #@span
            a = m - p // 2                            #@span
            return slice(max(a, 0), a + p)            #@span

        p = 8                      # patch side       #@p
        heat = np.zeros((16, 16))  # every 2 px    #@loop
        for r in range(16):                           #@loop
            rows = span(2*r+1, p)                   #@loop
            for c in range(16):                       #@loop
                x_occ = x.copy()                      #@patch
                x_occ[:, rows, span(2*c+1, p)] = 0  #@patch
                scores, _ = forward(x_occ)            #@fwd
                heat[r, c] = softmax(scores)[y]       #@rec
      `,
      beats: [
        { id: 'ask', say: 'Here is a question for any classifier, no insides needed: if I hide part of the image, does the prediction suffer?' },
        { id: 'patch', say: 'Zeiler and Fergus covered a small square with gray: zeros, since the average color was already subtracted.', code: ['span', 'p', 'patch'] },
        { id: 'record', say: 'Run the network, and record its probability for the true class, bird.', code: ['fwd', 'rec'] },
        { id: 'slide', say: 'Slide the square across, two pixels at a time, and paint each probability into a map.', code: ['loop', 'patch', 'fwd', 'rec'] },
        { id: 'read', say: 'Yellow: the network hardly noticed. Dark purple: covering that spot hurt the most, so the network relied on it.', code: 'rec' },
        { id: 'cost', say: 'It is honest and easy to explain, but costly: one forward pass per position, two hundred and fifty six here.', code: ['loop', 'fwd'] },
        { id: 'next', say: 'Saliency maps get a similar answer from a single backward pass.' },
      ],
    },
    {
      id: 'saliency',
      title: 'Saliency and guided backprop',
      codeTitle: 'saliency.py',
      code: `
        scores, cache = forward(x)                 #@fwd
        dscores = np.zeros(10)                     #@onehot
        dscores[y] = 1.0       # explain S_y only  #@onehot
        dx = backward_to_image(cache, dscores,     #@bwd
                               relu='{{rule:grad}}')   #@bwd
        M = np.abs(dx).max(axis=0)   # (32, 32)    #@sal

        def relu_backward(dr, z, rule):
            if rule == 'grad':                     #@grad
                return dr * (z > 0)                #@grad
            if rule == 'deconv':                   #@deconv
                return dr * (dr > 0)               #@deconv
            if rule == 'guided':                   #@guided
                return dr * (z > 0) * (dr > 0)     #@guided
      `,
      beats: [
        { id: 'local', say: 'Simonyan and colleagues asked it locally: if one pixel changed a tiny bit, how much would the class score change?' },
        { id: 'deriv', say: 'That is a derivative: the score\'s slope as you wiggle one input, holding the rest still.' },
        { id: 'one', say: 'One backward pass gives all {3,072|three thousand and seventy two}. Set the score gradient to one for our class, zero elsewhere, and backpropagate.', code: ['fwd', 'onehot', 'bwd'] },
        { id: 'abs', say: 'Keep each slope\'s size, the largest over the three colors, and you have the saliency map.', code: 'sal' },
        { id: 'look', say: 'It is speckled, but it mostly sits on the dog, not the background.', code: 'sal' },
        { id: 'relu', say: 'Two variants change only how the backward pass crosses each {ReLU|ray-loo}.', code: ['bwd', 'grad'] },
        { id: 'grad', say: 'The true gradient passes the signal wherever the unit was active going forward.', code: 'grad' },
        { id: 'deconv', say: 'Zeiler and Fergus\'s deconvnet passes it wherever the incoming gradient is positive.', code: 'deconv' },
        { id: 'guided', say: 'Guided backpropagation demands both, and draws a crisp outline of the dog.', code: 'guided' },
        { id: 'but', say: 'But crisp is not faithful. Ask guided backprop to explain cat instead, and its map barely changes.', code: ['onehot', 'guided'] },
        { id: 'corr', say: 'Across two hundred images, guided maps of two classes correlate at {0.68|zero point six eight}, plain gradients at {0.38|zero point three eight}. Sharpness can come from the image\'s edges, not the network\'s reasoning.' },
      ],
    },
    {
      id: 'class-viz',
      title: 'Asking the network to draw',
      codeTitle: 'class_visualization.py',
      code: `
        x = 0.02 * np.random.randn(3, 32, 32)    #@init
        target = {{target:4}}                 # {{tname:deer}}  #@target
        for t in range(300):                     #@loop
            jy, jx = np.random.randint(-2, 3, 2) #@jit
            x = np.roll(x, (jy, jx), (1, 2))     #@jit
            scores, cache = forward(x)           #@fwd
            dscores = np.eye(10)[target]         #@fwd
            dx = backward_to_image(cache, dscores)  #@step
            x += 0.05 * (dx - 2 * reg * x)       #@step
            x = np.roll(x, (-jy, -jx), (1, 2))   #@jit
            x = np.clip(x, -mean, 1 - mean)      #@clip
            if t % 10 == 0:                      #@blur
                x = blur(x, sigma=0.5)           #@blur
        # step {{t:0}}: p = {{prob:0.1}}                 #@loop
      `,
      beats: [
        { id: 'turn', say: 'Now turn the question around, and ask the network to draw.' },
        { id: 'which', say: 'Which image makes the deer score as large as possible?', code: 'target' },
        { id: 'ascent', say: 'Start from near gray and run gradient ascent on the pixels: training\'s gradient descent, except the weights stay fixed, the image changes, and we climb.', code: ['init', 'loop', 'fwd', 'step'] },
        { id: 'raw', say: 'We climb the raw score, since a probability can also rise by pushing the other classes down.', code: 'fwd' },
        { id: 'penalty', say: 'An {L2|L two} penalty, lambda times the image\'s squared size, keeps pixels from running to garish extremes.', code: 'step' },
        { id: 'tricks', say: 'Three more tricks tame the noise. Blur every ten steps. Jitter the image a pixel or two before each step, and back after. And clip, so pixels stay valid colors.', code: ['blur', 'jit', 'clip'] },
        { id: 'watch', say: 'Within ten steps the network is over ninety nine percent sure, yet the picture keeps sharpening, because the raw score keeps climbing.', code: 'loop' },
        { id: 'strip', say: 'Even this small network paints parts: deer grow antlers, horses grow legs, cars get wheels, and ships sit on blue water.', code: 'target' },
      ],
    },
    {
      id: 'inversion',
      title: 'What a code remembers',
      codeTitle: 'invert.py',
      code: `
        F0 = forward(x0)[1]['{{layer:conv2}}']    # target  #@F0
        Z = np.sum(F0 ** 2)                     #@F0
        x = 0.02 * np.random.randn(3, 32, 32)   #@init
        v = 0                                   #@init
        for t in range(200):                    #@loop
            scores, cache = forward(x)          #@fwd
            F = cache['{{layer:conv2}}']             #@fwd
            loss = np.sum((F - F0) ** 2) / Z    #@loss
            dF = 2 * (F - F0) / Z               #@dF
            dx = backward_to_image(cache,       #@bwd
                     inject={'{{layer:conv2}}': dF})  #@bwd
            dx += 0.005 * tv_grad(x)  # smooth  #@tv
            v = 0.9 * v - 0.2 * dx  # momentum  #@step
            x = np.clip(x + v, -mean, 1 - mean) #@step
      `,
      beats: [
        { id: 'remember', say: 'How much does a layer\'s code remember? Mahendran and Vedaldi inverted it to find out.' },
        { id: 'search', say: 'Starting from noise, search for an image whose code matches the original\'s.', code: ['F0', 'init'] },
        { id: 'descend', say: 'This time we descend, on the squared mismatch, scaled by the target\'s size.', code: ['fwd', 'loss'] },
        { id: 'inject', say: 'Its gradient at that layer is twice the difference, and {backward_to_image|backward to image} carries it down to the pixels, plus a small smoothness penalty.', code: ['dF', 'bwd', 'tv'] },
        { id: 'conv1', say: 'From conv1, the image comes back almost perfectly.' },
        { id: 'conv2', say: 'From conv2, the layout and colors survive, a little smeared.' },
        { id: 'deep', say: 'From conv3 and pool3, parts land roughly in place, but colors and textures drift.' },
        { id: 'invariance', say: 'The network throws away details that do not matter for classification. That growing invariance is exactly what a classifier needs.' },
      ],
    },
    {
      id: 'dream-style',
      title: 'DeepDream and neural style',
      codeTitle: 'dream_and_style.py',
      code: `
        # DeepDream: do more of whatever F sees   #@dream
        dx = backward_to_image(cache,             #@dream
                 inject={'conv3': F})             #@dream
        x += 0.004 * dx / np.abs(dx).mean()       #@dream

        def gram(F):            # F: (C, H, W)    #@gram
            F = F.reshape(len(F), -1)   # (C, M)  #@gram
            return F.dot(F.T) / F.shape[1]        #@gram

        G_src = gram(forward(x_src)[1]['conv1'])  #@tex
        G = gram(cache['conv1'])                  #@tex
        loss = np.sum((G - G_src) ** 2)           #@tex
        # style transfer adds a content term:     #@style
        loss += alpha * np.sum((F - F_photo) ** 2) #@style
      `,
      beats: [
        { id: 'dream', say: 'In {2015|twenty fifteen}, Google gave this a playful twist, soon nicknamed {DeepDream|deep dream}.' },
        { id: 'amplify', say: 'Instead of a class, ask the image to amplify whatever a layer already sees, by injecting its activations as their own gradient.', code: 'dream' },
        { id: 'grows', say: 'Our tiny network grows stripes and round, eye-like spots. Google\'s big one grew dogs and pagodas out of clouds.', code: 'dream' },
        { id: 'style', say: 'Gatys and colleagues used the same machinery to split an image into content and style.' },
        { id: 'content', say: 'Content is a deep layer\'s feature maps, which, as inversion showed, keep the layout.' },
        { id: 'gram', say: 'Style is a Gram matrix: for every pair of feature maps, multiply them position by position, and add it all up.', code: 'gram' },
        { id: 'where', say: 'It is big when two features fire together, like stripes and orange, but the sum forgets where.', code: 'gram' },
        { id: 'texture', say: 'Start from noise and match the frog\'s Gram matrices. Its colors and textures return, scrambled: the frog itself is gone.', code: 'tex' },
        { id: 'transfer', say: 'Style transfer adds a content term for a photo, so the photo keeps its layout and takes on an artwork\'s textures.', code: 'style' },
      ],
    },
    {
      id: 'fooling',
      title: 'Fooling the network',
      codeTitle: 'fooling.py',
      code: `
        lo, hi = -mean, 1 - mean   # valid colors
        x_fool = x.copy()                         #@init
        target = 0                     # plane    #@target
        for t in range(120):                      #@loop
            scores, cache = forward(x_fool)       #@fwd
            if scores.argmax() == target:         #@check
                break                             #@check
            dscores = np.eye(10)[target]          #@bwd
            dx = backward_to_image(cache, dscores)   #@bwd
            x_fool += 0.25 / 255 * np.sign(dx)    #@step
            x_fool = np.clip(x_fool, lo, hi)      #@step
        # step {{t:0}}: max change {{linf:0}}/255         #@done
      `,
      beats: [
        { id: 'now', say: 'Now the unsettling part.' },
        { id: 'find', say: 'Szegedy and colleagues found that almost any correctly classified image can be changed, invisibly, into any wrong class.' },
        { id: 'try', say: 'Let us try. This deer is classified correctly. Target: plane.', code: ['init', 'target'] },
        { id: 'step', say: 'Nudge every pixel a quarter of a brightness level, in the direction that raises the plane score.', code: ['fwd', 'bwd', 'step'] },
        { id: 'stop', say: 'Repeat until the network says plane.', code: ['loop', 'check'] },
        { id: 'done', say: 'Thirteen steps. No pixel moved by more than about three levels out of two hundred and fifty five, so the pictures look identical.', code: 'done' },
        { id: 'transfer', say: 'Worse, such images often fool other networks too, even ones trained on different data.' },
        { id: 'reverse', say: 'And Nguyen and colleagues found the reverse: noise-like images that networks call an object with over ninety nine percent confidence.' },
      ],
    },
    {
      id: 'linear',
      title: 'Too linear',
      codeTitle: 'linear_explanation.py',
      code: `
        n = {{n:10}}                     # inputs     #@n
        W = 0.1 * np.random.randn(n)              #@W
        x = np.random.rand(n)                     #@x
        eps = 2 / 255                             #@eps
        x_adv = x + eps * np.sign(W)  # nudge all #@adv
        W.dot(x_adv) - W.dot(x)       # {{shift:0.006}}   #@shift
        eps * np.abs(W).sum()         # the same  #@shift

        # FGSM: the same trick on the ConvNet     #@fgsm
        dscores = softmax(scores) - np.eye(10)[y] #@fgsm
        dx = backward_to_image(cache, dscores)    #@fgsm
        x_adv = x + eps * np.sign(dx)             #@fgsm
      `,
      beats: [
        { id: 'guess', say: 'Why? The first guess was that deep networks are too nonlinear.' },
        { id: 'opposite', say: 'Goodfellow, Shlens and Szegedy argued the opposite: they are too linear.' },
        { id: 'setup', say: 'Take a linear score, W dot x, and nudge every input by a tiny epsilon, toward its weight\'s sign.', code: ['W', 'x', 'eps', 'adv'] },
        { id: 'tiny', say: 'Two levels out of two hundred and fifty five: invisible.', code: 'eps' },
        { id: 'adds', say: 'But every nudge helps, so they add up instead of canceling: the score rises by epsilon times the total weight size.', code: 'shift' },
        { id: 'grows', say: 'That rise grows with the number of inputs, n, while the score\'s natural spread grows only like the square root of n.', code: ['n', 'shift'] },
        { id: 'big', say: 'At ten inputs the nudge is lost. At {CIFAR-10|see-far ten} size it matches the spread, and at ImageNet size it is over eight spreads.', code: ['n', 'shift'] },
        { id: 'fgsm', say: 'ConvNets are built from piecewise linear parts, so the same trick works: one epsilon step along the sign of the loss gradient. The fast gradient sign method.', code: 'fgsm' },
        { id: 'panda', say: 'Its famous example turns a panda into a gibbon, at ninety nine percent confidence.', code: 'fgsm' },
        { id: 'matters', say: 'Anyone who controls the input can attack a model, and linear classifiers fall the same way. Adversarial training helps, but robustness stayed an open problem.' },
      ],
    },
    {
      id: 'closing',
      title: 'The toolbox',
      codeTitle: 'toolbox_recap.py',
      code: `
        F = cache['conv1']           # activations  #@act
        W = net['conv1']             # filters      #@filt
        top8 = np.argsort(-best)[:8] # top images   #@top
        Y = TSNE().fit_transform(F)  # t-SNE        #@tsne
        heat[r, c] = p_y             # occlusion    #@occ
        M = np.abs(dx).max(axis=0)   # saliency     #@sal
        x += lr * dx    # class viz, inversion,     #@draw
                        # DeepDream, style          #@draw
        x + eps * np.sign(dx)        # adversarial  #@adv
      `,
      beats: [
        { id: 'recap', say: 'That is the toolbox.' },
        { id: 'health', say: 'Activations and first-layer filters: the cheapest health check.', code: ['act', 'filt'] },
        { id: 'meaning', say: 'Top images and {t-SNE|tee snee}: the network groups by meaning, and single neurons are not special.', code: ['top', 'tsne'] },
        { id: 'where', say: 'Occlusion and saliency: which parts a decision depends on.', code: ['occ', 'sal'] },
        { id: 'draw', say: 'Gradient steps on the pixels: class pictures, inversion, {DeepDream|deep dream} and style.', code: 'draw' },
        { id: 'fool', say: 'And the same gradient, turned against the network, finds adversarial examples.', code: 'adv' },
        { id: 'clue', say: 'Each picture is a clue, not an explanation.' },
        { id: 'next', say: 'Next, open the interactive chapter, where every figure runs this network live. See you there.', pause: 0.6 },
      ],
    },
  ],
};

import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'convnets',
  title: 'Convolutional networks',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'Seeing in patches',
      codeTitle: 'why_conv.py',
      code: `
        x = image.reshape(-1)  # 3,072 numbers  #@flat
        w = np.random.randn(3072)               #@w
        s = w.dot(x)           # one neuron     #@w

        x = photo.reshape(-1)  # 200x200x3      #@big
        W = np.random.randn(1000, 120000)       #@layer
        # 120,000,000 weights, one layer        #@layer

        patch = X[i:i+5, j:j+5, :]  # small     #@patch
        a = np.sum(patch * W) + b   # shared W  #@share
      `,
      beats: [
        { id: 'hello', say: 'Welcome to convolutional networks, the architecture that taught computers to see.' },
        { id: 'flat', say: 'So far, every network has read an image as one long row of numbers.', code: 'flat' },
        { id: 'wired', say: 'Each number is wired to every neuron, so a pixel and its neighbor mean no more to each other than two opposite corners.', code: 'w' },
        { id: 'big', say: 'It is also expensive. A modest {200 × 200|two hundred by two hundred} color photo needs {120 million|a hundred and twenty million} weights for a layer of a thousand neurons.', code: ['big', 'layer'] },
        { id: 'keep', say: 'Convolutional networks keep the neurons, the loss and backpropagation. They change only the wiring, in two ways.' },
        { id: 'patch', say: 'Each neuron looks at a small patch of the image.', code: 'patch' },
        { id: 'share', say: 'And the same weights are reused everywhere, so an edge detector works wherever the edge is.', code: 'share' },
        { id: 'payoff', say: 'That cuts the weights by orders of magnitude, and it is why {ConvNets|conv nets} took over computer vision.' },
      ],
    },
    {
      id: 'volumes',
      title: 'Volumes in, volumes out',
      codeTitle: 'layers.py',
      code: `
        X = image             # 32 x 32 x 3    #@input
        A = conv(X, W)        # 32 x 32 x 12   #@conv
        A = np.maximum(0, A)  # 32 x 32 x 12   #@relu
        A = max_pool(A)       # 16 x 16 x 12   #@pool
        s = W2.dot(A.reshape(-1))  # 10 scores #@fc
      `,
      beats: [
        { id: 'block', say: '{ConvNets|Conv nets} arrange their neurons the way an image is arranged: in a block, with a width, a height and a depth.' },
        { id: 'cifar', say: 'A {CIFAR-10|see-far ten} image is {32 × 32 × 3|thirty two by thirty two by three}: one slice each for red, green and blue.', code: 'input' },
        { id: 'word', say: 'Careful: depth here means channels, not layers.', code: 'input' },
        { id: 'contract', say: 'Every layer takes a volume in, and hands a new volume on.' },
        { id: 'conv', say: 'A {CONV|convolution} layer with twelve filters makes twelve activation maps: {32 × 32 × 12|thirty two by thirty two by twelve}.', code: 'conv' },
        { id: 'relu', say: 'A {ReLU|ray-loo} zeroes the negatives. Same size, no weights.', code: 'relu' },
        { id: 'pool', say: 'Pooling halves the width and height, to {16 × 16 × 12|sixteen by sixteen by twelve}.', code: 'pool' },
        { id: 'fc', say: 'And a fully connected layer turns what is left into ten class scores.', code: 'fc' },
        { id: 'weights', say: 'Only the {CONV|convolution} and fully connected layers have weights to learn. Now let us open up the {CONV|convolution} layer.', code: ['conv', 'fc'] },
      ],
    },
    {
      id: 'slide',
      title: 'A filter slides',
      codeTitle: 'conv_gray.py',
      code: `
        img = gray(X_train[37])  # 32x32 truck  #@img
        W = np.array([[-1, 0, 1],               #@W
                      [-2, 0, 2],               #@W
                      [-1, 0, 1]])              #@W
        X = np.pad(img, 1)    # ring of zeros   #@pad
        A = np.zeros((32, 32))
        for i in range(32):                     #@loop
            for j in range(32):                 #@loop
                patch = X[i:i+3, j:j+3]         #@patch
                A[i, j] = np.sum(patch * W)     #@sum
        A = np.maximum(0, A)  # ReLU            #@relu
        # A[{{i:16}}, {{j:13}}] = {{a:0}}
      `,
      beats: [
        { id: 'own', say: 'A {CONV|convolution} layer owns a set of small filters. Start simple: one {3 × 3|three by three} filter on a grayscale image.', code: ['img', 'W'] },
        { id: 'hand', say: 'This one is made by hand: minus ones on the left, plus ones on the right.', code: 'W' },
        { id: 'lay', say: 'Lay it over a patch of the image, multiply each weight by the pixel under it, and add up all nine products.', code: ['patch', 'sum'] },
        { id: 'match', say: 'That number says how well the patch matches the filter. Dark on the left and bright on the right gives a big answer.', code: 'sum' },
        { id: 'slide', say: 'Now slide the filter one step and do it again, along every row and down every column.', code: ['loop', 'patch', 'sum'] },
        { id: 'pad', say: 'A ring of zeros around the border keeps the output at {32 × 32|thirty two by thirty two}.', code: 'pad' },
        { id: 'map', say: 'The result is an activation map. It responds wherever brightness changes from left to right: a vertical edge detector.', code: 'loop' },
        { id: 'relu', say: 'After a {ReLU|ray-loo}, only the positive responses survive.', code: 'relu' },
        { id: 'other', say: 'Other numbers make other detectors: horizontal edges, a blur, a sharpen.', code: 'W' },
        { id: 'learn', say: 'A {ConvNet|conv net} learns its own, and its first filters end up looking much like these: edges at many angles, and blobs of color.' },
      ],
    },
    {
      id: 'depth',
      title: 'Filters have depth',
      codeTitle: 'conv_volume.py',
      code: `
        def conv_one(X, W, b, i, j, k, S):   #@def
            F = W.shape[1]   # (K, F, F, D)   #@def
            p = X[i*S:i*S+F, j*S:j*S+F, :]    #@slice
            return np.sum(p * W[k]) + b[k]    #@ret

        # 5x5x3 input, one ring of zeros
        X = np.pad(V, ((1, 1), (1, 1), (0, 0)))  #@pad
        A = np.zeros((3, 3, 2))   # 2 filters  #@out
        for k, i, j in np.ndindex(2, 3, 3):    #@loop
            A[i, j, k] = conv_one(             #@loop
                X, W, b, i, j, k, S=2)         #@loop
        # A[{{i:0}}, {{j:0}}, {{k:0}}] = {{a:0}}
      `,
      beats: [
        { id: 'depth', say: 'Real inputs have depth, and a filter always reaches through all of it.', code: 'def' },
        { id: 'size', say: 'A typical first layer filter is {5 × 5 × 3|five by five by three}: five pixels square, and all three colors deep.', code: 'def' },
        { id: 'field', say: 'Each output number is a neuron that sees only this small region, its receptive field. That is {75|seventy five} weights and a bias.', code: ['slice', 'ret'] },
        { id: 'deep', say: 'Deeper in, a {3 × 3|three by three} filter on twenty channels has {180|a hundred and eighty}: small in space, but full depth.' },
        { id: 'sum', say: 'Written out, one output is a triple sum over the filter\'s rows, columns and channels, plus a bias.', code: 'ret' },
        { id: 'loops', say: 'Three sigmas are three nested loops. In NumPy: multiply two same-shaped blocks, and sum.', code: ['slice', 'ret'] },
        { id: 'stride', say: 'The stride, S, only decides where each block starts.', code: 'slice' },
        { id: 'demo', say: 'Here it is for real: a {5 × 5 × 3|five by five by three} input padded with zeros, and two {3 × 3 × 3|three by three by three} filters at stride two.', code: ['pad', 'out'] },
        { id: 'one', say: 'Each output is {27|twenty seven} products: three slice sums, plus the bias.', code: 'loop' },
        { id: 'jump', say: 'The window jumps two cells at a time, and nine positions fill the first map.', code: 'loop' },
        { id: 'second', say: 'The second filter revisits the same windows with different weights.', code: 'loop' },
        { id: 'column', say: 'The numbers stacked at one position see the same patch through different filters: a depth column.' },
      ],
    },
    {
      id: 'size',
      title: 'Depth, stride and padding',
      codeTitle: 'conv_size.py',
      code: `
        def conv_out(N, F, S, P):             #@def
            room = N - F + 2 * P  # slide     #@room
            assert room % S == 0, 'no fit'    #@check
            return room // S + 1              #@out

        conv_out({{N:7}}, {{F:3}}, {{S:1}}, {{P:0}})   # {{nout:5}}  #@call
        P = (F - 1) // 2      # same padding  #@same
        conv_out(32, 5, 1, 2)    # 32         #@same
        conv_out(227, 11, 4, 0)  # 55         #@alex
      `,
      beats: [
        { id: 'three', say: 'Three settings decide the size of a {CONV|convolution} layer\'s output.' },
        { id: 'K', say: 'Depth, K, is the number of filters, one activation map each.' },
        { id: 'S', say: 'Stride, S, is how far the filter jumps. Stride two skips every other position.' },
        { id: 'P', say: 'Padding, P, is how many rings of zeros go around the input.' },
        { id: 'row', say: 'Look at a single row of width N, and a filter of width three.', code: 'def' },
        { id: 'slide', say: 'The filter can start at zero, one, two, three or four. Its left edge travels four steps, so there are five positions.', code: ['room', 'out', 'call'] },
        { id: 'two', say: 'At stride two, it lands on zero, two and four. Four over two, plus one: three positions.', code: ['out', 'call'] },
        { id: 'formula', say: 'Padding just widens the row first. So the output width is N minus F plus two P, over S, plus one.', code: ['room', 'out'] },
        { id: 'bad', say: 'If that division is not even, the setting is invalid: at stride three, the last placement hangs off the edge.', code: 'check' },
        { id: 'same', say: 'The favorite is same padding: P equals F minus one, over two, and the output stays exactly as wide as the input.', code: 'same' },
        { id: 'alex', say: 'AlexNet, the 2012 ImageNet winner, read {227 × 227|two twenty seven by two twenty seven} images with ninety six {11 × 11|eleven by eleven} filters at stride four.', code: 'alex' },
        { id: 'alex2', say: 'Two twenty seven minus eleven, over four, plus one, is fifty five. So the output is {55 × 55 × 96|fifty five by fifty five by ninety six}.', code: 'alex' },
      ],
    },
    {
      id: 'sharing',
      title: 'Parameter sharing',
      codeTitle: 'sharing.py',
      code: `
        F, D, K = 11, 3, 96                     #@fdk
        per = F * F * D           # 363         #@per
        unshared = 55 * 55 * K * (per + 1)      #@un
        # 105,705,600 parameters                #@un
        shared = per * K + K      # 34,944      #@sh
        unshared // shared        # 3,025       #@ratio

        # V: 11x11x4, W0 and W1: 5x5x4, S = 2
        A[0,0,0] = np.sum(V[:5, :5, :] * W0) + b0   #@a0
        A[1,0,0] = np.sum(V[2:7, :5, :] * W0) + b0  #@a1
        A[2,0,0] = np.sum(V[4:9, :5, :] * W0) + b0  #@a1
        A[0,0,1] = np.sum(V[:5, :5, :] * W1) + b1   #@m1
      `,
      beats: [
        { id: 'naive', say: 'Count that layer naively: {55 × 55 × 96|fifty five by fifty five by ninety six} neurons, each with {363|three sixty three} weights and a bias.', code: ['fdk', 'per'] },
        { id: 'total', say: 'That is over {105 million|a hundred and five million} parameters, for one layer.', code: 'un' },
        { id: 'assume', say: 'The way out is an assumption that suits images: a filter useful in one place is useful everywhere. An edge is an edge, top or bottom.' },
        { id: 'share', say: 'So every neuron in one activation map shares a single filter.', code: 'sh' },
        { id: 'count', say: 'Ninety six filters, plus their biases, is about thirty five thousand parameters.', code: 'sh' },
        { id: 'ratio', say: 'That is {3,025|three thousand and twenty five} times fewer, one for each position, and the image size no longer matters.', code: 'ratio' },
        { id: 'name', say: 'Sliding one shared filter over an input is a convolution: hence the name.' },
        { id: 'grad', say: 'In backprop, every position adds its gradient into the one shared filter.' },
        { id: 'numpy', say: 'In NumPy, each output is a slice of the input times a filter, summed, plus a bias.', code: 'a0' },
        { id: 'steps', say: 'Each step along a map moves the slice by the stride: zero to five, two to seven, four to nine.', code: 'a1' },
        { id: 'map1', say: 'The second map reuses the same slices with a different filter.', code: 'm1' },
        { id: 'local', say: 'Sharing can be wrong. If every input is a centered face, eyes always sit near the top, and each place deserves its own weights: a locally connected layer.' },
      ],
    },
    {
      id: 'more',
      title: 'More about convolution',
      codeTitle: 'conv_more.py',
      code: `
        # im2col: each patch becomes a column
        cols = im2col(X, F, S)  # (F*F*D, n)   #@cols
        rows = W.reshape(K, -1) # (K, F*F*D)   #@rows
        A = rows.dot(cols)      # one matmul   #@mm
        # backward: dA convolved with flipped W #@back

        # 1x1: mix channels at every pixel
        X = np.zeros((56, 56, 64))             #@x1
        W = np.random.randn(32, 64)            #@x1
        A = X.dot(W.T)          # (56, 56, 32) #@one

        # dilated: taps gap + 1 cells apart
        a = sum(W[u] * X[i + u * (gap + 1)]    #@dil
                for u in range(F))             #@dil
      `,
      beats: [
        { id: 'cols', say: 'Those loops are slow. Real libraries copy each receptive field into a column of one big matrix: a trick called {im2col|im to col}.', code: 'cols' },
        { id: 'rows', say: 'Each filter becomes one row of a second matrix.', code: 'rows' },
        { id: 'mm', say: 'Then the whole layer is one fast matrix multiply, paid for in memory, since overlapping patches get copied.', code: 'mm' },
        { id: 'back', say: 'Its backward pass is a convolution too: the upstream gradient, against the same filters, flipped.', code: 'back' },
        { id: 'one', say: 'A {1 × 1|one by one} filter sounds pointless, until you remember that it spans the full depth.', code: 'x1' },
        { id: 'one2', say: 'On sixty four channels, it is a dot product at every pixel. Thirty two of them make the volume thirty two deep.', code: 'one' },
        { id: 'one3', say: 'It mixes channels without looking at neighbors: a cheap way to change depth.', code: 'one' },
        { id: 'dil', say: 'Dilated convolutions spread a filter\'s taps apart. With a gap of one, three taps cover five cells, with only three weights.', code: 'dil' },
        { id: 'dil3', say: 'Stack layers whose taps sit one, two, then four cells apart, and the reach grows from three, to seven, to fifteen: exponentially, not linearly.', code: 'dil' },
      ],
    },
    {
      id: 'pooling',
      title: 'Pooling',
      codeTitle: 'max_pool.py',
      code: `
        X = np.array([[1, 1, 2, 4],          #@X
                      [5, 6, 7, 8],          #@X
                      [3, 2, 1, 0],          #@X
                      [1, 2, 3, 4]])         #@X
        A = np.zeros((2, 2))
        for i, j in np.ndindex(2, 2):        #@loop
            win = X[2*i:2*i+2, 2*j:2*j+2]    #@win
            A[i, j] = win.max()              #@fwd
        # backward: dA arrives from above    #@back
        dX = np.zeros((4, 4))                #@back
        for i, j in np.ndindex(2, 2):        #@back
            win = X[2*i:2*i+2, 2*j:2*j+2]    #@back
            a, c = divmod(win.argmax(), 2)   #@sw
            dX[2*i + a, 2*j + c] = dA[i, j]  #@route
      `,
      beats: [
        { id: 'what', say: 'Between {CONV|convolution} layers, networks often insert a pooling layer. It shrinks the width and height, saving computation and curbing overfitting.' },
        { id: 'slice', say: 'It works on each depth slice separately.', code: 'X' },
        { id: 'max', say: 'The usual form is max pooling, {2 × 2|two by two} at stride two: keep the largest of every four numbers.', code: ['loop', 'win', 'fwd'] },
        { id: 'run', say: 'Six wins the first window. Then eight, three, and four.', code: 'fwd' },
        { id: 'halve', say: 'Width and height halve, depth stays, and three quarters of the numbers are gone.' },
        { id: 'ask', say: 'It asks each window: did this feature fire strongly anywhere in here? And it forgets where.', code: 'fwd' },
        { id: 'settings', say: 'There are no weights. Besides {2 × 2|two by two}, only the overlapping {3 × 3|three by three} at stride two is common.' },
        { id: 'back', say: 'Going backward, the gradient of a max flows entirely to the winner: nudging a loser changes nothing.', code: 'back' },
        { id: 'switch', say: 'So the forward pass remembers where each maximum was. Those positions are the switches.', code: 'sw' },
        { id: 'route', say: 'Each incoming gradient goes straight to its switch, and the other three cells get zero.', code: 'route' },
        { id: 'avg', say: 'Average pooling would split it four ways instead. In practice, max has worked better.' },
        { id: 'rid', say: 'Some networks drop pooling entirely, and shrink with an occasional stride two {CONV|convolution} layer instead.' },
      ],
    },
    {
      id: 'fc',
      title: 'FC layers are CONV layers',
      codeTitle: 'fc_as_conv.py',
      code: `
        X = feats                   # (7, 7, 512) #@X
        W_fc = np.random.randn(4096, 7 * 7 * 512)  #@fc
        fc = W_fc.dot(X.reshape(-1))  # (4096,)    #@fc
        W = W_fc.reshape(4096, 7, 7, 512)          #@W
        A = np.array([np.sum(X * W[k])             #@A
                      for k in range(4096)])       #@A
        np.allclose(fc, A)          # True         #@same

        size = {{size:224}}       # input image          #@big
        feat = size // 32       # {{feat:7}}           #@big
        n = feat - 7 + 1        # {{n:1}}: {{n}}x{{n}}x1000  #@n
      `,
      beats: [
        { id: 'norm', say: 'Early {ConvNets|conv nets} also had normalization layers, but they added little, and fell out of use.' },
        { id: 'fc', say: 'Fully connected layers you know: every neuron sees the whole input, and the layer is one matrix multiply.', code: 'fc' },
        { id: 'disguise', say: 'The twist: an FC layer is a {CONV|convolution} layer in disguise.' },
        { id: 'same', say: 'Take {4,096|four thousand and ninety six} neurons reading a {7 × 7 × 512|seven by seven by five twelve} volume. Reshape each one\'s weights into that same shape: a filter as big as its input.', code: 'W' },
        { id: 'fits', say: 'It fits in exactly one position, so the {CONV|convolution} layer outputs the very same numbers.', code: ['A', 'same'] },
        { id: 'why', say: 'Why bother? Because the {CONV|convolution} version can slide over a bigger image.' },
        { id: 'alex', say: 'An AlexNet style network shrinks a {224|two twenty four} pixel image to {7 × 7|seven by seven}, then three FC layers make the scores. Convert all three to {CONVs|convolutions}.', code: ['big', 'n'] },
        { id: 'big', say: 'Now feed it a {384|three eighty four} pixel image. The features come out {12 × 12|twelve by twelve}, and the {7 × 7|seven by seven} filter fits at six positions each way.', code: ['big', 'n'] },
        { id: 'grid', say: 'Out comes a {6 × 6|six by six} grid of scores, one for every {224|two twenty four} pixel crop, thirty two pixels apart.', code: 'n' },
        { id: 'cheap', say: 'One pass equals thirty six runs of the original network, at a fraction of the cost.' },
      ],
    },
    {
      id: 'arch',
      title: 'Stacking layers',
      codeTitle: 'architecture.py',
      code: `
        # INPUT -> [[CONV -> RELU]*n -> POOL?]*m  #@pattern
        #       -> [FC -> RELU]*k -> FC           #@pattern

        r = 1                     # one neuron    #@r
        for F in [3, 3, 3]:                       #@grow
            r += F - 1    # sees {{r:1}} x {{r}} pixels  #@grow

        C = 64
        three = 3 * (C * 3 * 3 * C)   # 27 C^2    #@three
        seven = C * 7 * 7 * C         # 49 C^2    #@seven

        # CONV: F=3, S=1, P=1 keeps the size      #@rules
        # POOL: 2x2, S=2 halves it                #@rules
      `,
      beats: [
        { id: 'pattern', say: 'Most {ConvNets|conv nets} follow one pattern: a few {CONV|convolution} and {ReLU|ray-loo} layers, then a pool, repeated until the image is small, then a few fully connected layers.', code: 'pattern' },
        { id: 'deeper', say: 'Bigger networks put two or three {CONVs|convolutions} before each pool, building richer features before pooling throws detail away.', code: 'pattern' },
        { id: 'l1', say: 'They also prefer small filters. Stack three {3 × 3|three by three} layers: a neuron in the first sees {3 × 3|three by three} pixels.', code: ['r', 'grow'] },
        { id: 'l2', say: 'One in the second sees {3 × 3|three by three} of those, which reach {5 × 5|five by five} pixels.', code: 'grow' },
        { id: 'l3', say: 'The third reaches {7 × 7|seven by seven}: as far as one big {7 × 7|seven by seven} filter.', code: 'grow' },
        { id: 'relus', say: 'But the stack has three {ReLUs|ray-loos} instead of one, so its features are more expressive.' },
        { id: 'params', say: 'And it has fewer weights: with C channels, {27 C²|twenty seven C squared} for the stack, against {49 C²|forty nine C squared} for the big filter.', code: ['three', 'seven'] },
        { id: 'rules', say: 'Rules of thumb: {3 × 3|three by three} {CONVs|convolutions} at stride one with same padding keep the size, and {2 × 2|two by two} max pools do the shrinking.', code: 'rules' },
        { id: 'hero', say: 'And from 2016: don\'t be a hero. Take a network that works well on ImageNet, download its weights, and fine tune it on your data.' },
      ],
    },
    {
      id: 'cases',
      title: 'The ImageNet winners',
      codeTitle: 'case_studies.py',
      code: `
        # LeNet, 1990s: zip codes and digits    #@lenet
        nets = [  # top-5 error on ImageNet     #@nets
            ('AlexNet',   2012, 16.4),          #@alex
            ('ZF Net',    2013, 14.8),          #@zf
            ('VGGNet',    2014,  7.3),          #@vgg
            ('GoogLeNet', 2014,  6.7),          #@goog
            ('ResNet',    2015,  3.6),          #@res
        ]
        # AlexNet: 60M params, ReLU, dropout   #@recipe
        # SGD + momentum 0.9, lr 1e-2 / 10s    #@recipe
        # ResNet block: out = F(x) + x         #@skip
      `,
      beats: [
        { id: 'lenet', say: 'A few networks mark the milestones, starting in the 1990s with {LeNet|Le Net}, which read zip codes and digits.', code: 'lenet' },
        { id: 'score', say: 'The score is ImageNet\'s top five error: how often the right label is missing from a network\'s five best guesses.', code: 'nets' },
        { id: 'alex', say: 'In 2012, AlexNet won with about sixteen percent, against twenty six for the runner up: a bigger, deeper {LeNet|Le Net}, trained on two GPUs.', code: 'alex' },
        { id: 'recipe', say: 'Its recipe became the template: {ReLU|ray-loo}, dropout, momentum, and a learning rate cut by ten whenever progress stalled.', code: 'recipe' },
        { id: 'zf', say: 'In 2013, {ZF Net|Z F net} retuned it.', code: 'zf' },
        { id: 'vgg', say: 'In 2014, {VGGNet|V G G net} showed that depth matters: sixteen layers of just {3 × 3|three by three} convolutions and pools, with {138|a hundred and thirty eight} million parameters.', code: 'vgg' },
        { id: 'goog', say: 'The winner, {GoogLeNet|Google net}, ran small filters side by side, with {1 × 1|one by one} convolutions keeping it to a few million parameters.', code: 'goog' },
        { id: 'res', say: 'In 2015, ResNet added each block\'s input back to its output, so each block only learns a correction.', code: 'skip' },
        { id: 'res2', say: 'That made {152|a hundred and fifty two} layers trainable, and cut the error to {3.6|three point six} percent.', code: 'res' },
      ],
    },
    {
      id: 'memory',
      title: 'Where the memory goes',
      codeTitle: 'vgg16_memory.py',
      code: `
        cfg = [64, 64, 'M', 128, 128, 'M',      #@cfg
               256, 256, 256, 'M', 512, 512,    #@cfg
               512, 'M', 512, 512, 512, 'M']    #@cfg
        H, D, acts, params = 224, 3, [], []
        for v in cfg:
            if v == 'M':
                H //= 2           # 2x2 pool
            else:
                params.append(9 * D * v)        #@conv
                D = v
            acts.append(H * H * D)              #@act
        # FC: 25088*4096 + 4096*4096 + ...      #@fc
        vals = 2*batch*sum(acts) + 3*sum(params) #@gb
        vals * 4 / 1024**3    # {{gb:8.8}} GB      #@gb
      `,
      beats: [
        { id: 'limit', say: 'The tightest constraint is usually memory. In 2016, a typical GPU had three to six gigabytes.' },
        { id: 'three', say: 'Memory goes to activations, to parameters, and to odds and ends like the images themselves.' },
        { id: 'acts', say: 'Training keeps every layer\'s activations for backprop, plus a gradient of the same size.', code: 'act' },
        { id: 'params', say: 'Parameters come with their gradients and a momentum cache: about three copies.', code: ['conv', 'fc'] },
        { id: 'vgg', say: 'Here is VGG sixteen, layer by layer.', code: 'cfg' },
        { id: 'early', say: 'Activations live mostly in the first few {CONV|convolution} layers, where the volumes are big: about fifteen million numbers per image.', code: 'act' },
        { id: 'late', say: 'Weights live mostly in the fully connected layers: the first one alone holds over a hundred million.', code: 'fc' },
        { id: 'total', say: 'At four bytes each and a batch of sixty four, that is about {8.8|eight point eight} gigabytes.', code: 'gb' },
        { id: 'batch', say: 'The activations grow with the batch and the weights do not, so when a network does not fit, shrink the batch.', code: 'gb' },
      ],
    },
    {
      id: 'outro',
      title: 'Takeaways',
      codeTitle: 'convnet.py',
      code: `
        A = conv(X, W, S=1, P=1)  # small filters  #@conv
        A = np.maximum(0, A)                       #@relu
        A = max_pool(A)           # halve the size #@pool
        scores = fc(A)            # or a big conv  #@fc
        # N_out = (N - F + 2P) / S + 1             #@size
      `,
      beats: [
        { id: 'stack', say: 'So, a {ConvNet|conv net} is a stack of layers that turn one volume into another.' },
        { id: 'conv', say: '{CONV|Convolution} layers slide small, full depth filters over their input, and sharing makes them cheap.', code: 'conv' },
        { id: 'size', say: 'N minus F plus two P, over S, plus one, gives the size of what comes out.', code: 'size' },
        { id: 'pool', say: 'Pooling shrinks, and routes gradients through its switches.', code: 'pool' },
        { id: 'fc', say: 'Fully connected layers are convolutions with filters as big as their input.', code: 'fc' },
        { id: 'arch', say: 'Good networks stack small filters, with their memory in early activations and their parameters in late layers.' },
        { id: 'next', say: 'Next, we look inside a trained {ConvNet|conv net}: what its filters respond to, which pixels its answer rests on, and how easily it is fooled.', pause: 0.6 },
      ],
    },
  ],
};

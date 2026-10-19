import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'convnets-practice',
  title: 'ConvNets in practice',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'Making a ConvNet work',
      codeTitle: 'in_practice.py',
      code: `
        # chapter 11: what a ConvNet is
        # chapter 13: making one work     #@title

        X, y = few_labeled_images()       #@data
        X = augment(X)          # 1. stretch  #@data
        net = pretrained('imagenet')  # 2. reuse  #@transfer
        A = conv(X, W)          # 3. compute  #@conv
        train(net, gpu, framework)    # 4. run    #@stack
      `,
      beats: [
        { id: 'hello', say: 'Welcome to ConvNets in practice.', code: 'title' },
        { id: 'before', say: 'Chapter eleven said what a ConvNet is. This chapter is about making one work, on a real problem, with a real budget.', code: 'title' },
        { id: 'four', say: 'It answers four practical questions.' },
        { id: 'q1', say: 'First: you never have enough labeled images. How do you stretch the ones you have?', code: 'data' },
        { id: 'q2', say: 'Second, how do you reuse a network that someone else trained on a million images?', code: 'transfer' },
        { id: 'q3', say: 'Third, which convolutions should you stack, and how are they computed fast?', code: 'conv' },
        { id: 'q4', say: 'And fourth, what hardware and software does it all run on?', code: 'stack' },
        { id: 'go', say: 'Let us start with the data.' },
      ],
    },
    {
      id: 'augment',
      title: 'Data augmentation: flips and crops',
      codeTitle: 'augment.py',
      code: `
        for img, label in data:          #@load
            img = augment(img)           #@aug
            loss = net.loss(img, label)  #@loss

        def augment(img):
            if rng.rand() < 0.5:
                img = img[:, ::-1]   # flip  #@flip
            L = rng.randint(256, 481)        #@scale
            img = resize_short(img, L)       #@scale
            y, x = rng.randint(0, L - 223, 2)  #@crop
            return img[y:y+224, x:x+224]     #@crop

        crops = ten_crops(img)   # test      #@test
        probs = np.mean(net(crops), axis=0)  #@test
      `,
      beats: [
        { id: 'few', say: 'A ConvNet has millions of parameters, so it can simply memorize a few thousand images.' },
        { id: 'trick', say: 'A cheap defense: change the training images in ways that keep their labels. A flipped cat is still a cat.' },
        { id: 'loop', say: 'So the training loop gets one extra step: load an image and its label, transform the image at random, then compute the loss.', code: ['load', 'aug', 'loss'] },
        { id: 'every', say: 'Every epoch the network sees a new version, and the only constant, the cat, is what it has to learn.', code: 'aug' },
        { id: 'flip', say: 'First, horizontal flips: with probability one half, reverse the order of the columns.', code: 'flip' },
        { id: 'updown', say: 'Vertical flips are usually a bad idea, since the world has an up and a down.', code: 'flip' },
        { id: 'crop', say: 'Second, random crops and scales. {ResNet|Res net} picks a length L between {256|two fifty six} and {480|four eighty}. It resizes the image so its shorter side is L.', code: 'scale' },
        { id: 'patch', say: 'Then it cuts out a random {224 × 224|two twenty four by two twenty four} patch, so the object lands at a new size, in a new place, every time.', code: 'crop' },
        { id: 'test', say: 'At test time there is no randomness. Instead, average the predictions over a fixed set of crops:', code: 'test' },
        { id: 'ten', say: 'the four corners and the center, plus their mirror images, ten crops in all.', code: 'test' },
      ],
    },
    {
      id: 'color',
      title: 'Color jitter, and getting creative',
      codeTitle: 'color.py',
      code: `
        m = img.mean()
        c = rng.uniform(0.6, 1.4)           #@contrast
        img = (img - m) * c + m             #@contrast

        pix = X_train.reshape(-1, 3)        #@pix
        cov = np.cov(pix, rowvar=False)     #@eig
        evals, evecs = np.linalg.eigh(cov)  #@eig
        alpha = rng.normal(0, 0.1, 3)       #@shift
        img = img + evecs.dot(alpha * evals)  #@shift

        img = rotate(img, rng.uniform(-10, 10))  #@more
        img = shear(img, rng.uniform(-0.2, 0.2)) #@more
      `,
      beats: [
        { id: 'jitter', say: 'Third, color jitter. The simplest version scales the contrast at random.', code: 'contrast' },
        { id: 'alex', say: '{AlexNet|Alex net} was more careful. It shifted colors along the directions in which they vary across the dataset.' },
        { id: 'cloud', say: 'Picture every training pixel as a dot in three dimensions, with red, green and blue as the axes.', code: 'pix' },
        { id: 'eig', say: 'The covariance matrix of these dots has eigenvectors: the natural axes of the cloud. Each eigenvalue, {λ|lambda}, is the spread along its axis.', code: 'eig' },
        { id: 'bright', say: 'The first axis is almost equal parts red, green and blue: brightness. The others trade colors against each other.', code: 'eig' },
        { id: 'shift', say: 'For each image, draw three small random amounts, {α|alpha}, with a spread of {0.1|zero point one}, and add one color offset to every pixel.', code: 'shift' },
        { id: 'light', say: 'It looks like the same scene under slightly different light: a change that should never alter the label.', code: 'shift' },
        { id: 'creative', say: 'Beyond that, get creative: rotations, stretching, shearing. Anything that changes the pixels but not the label.', code: 'more' },
        { id: 'six', say: 'What makes sense depends on the data: rotate a six by {180|a hundred and eighty} degrees, and it becomes a nine.' },
      ],
    },
    {
      id: 'noise',
      title: 'Add noise, then average it out',
      codeTitle: 'noise.py',
      code: `
        # training: inject random noise
        img = augment(img)       # inputs     #@aug
        h *= rng.rand(*h.shape) < p  # dropout #@drop
        h = batchnorm(h)     # batch statistics #@bn
        nets = [init(seed=s) for s in range(5)] #@ens

        # test: average the noise away
        views = ten_crops(img)   # M = 10     #@views
        probs = np.mean(net(views), axis=0)   #@avg
        label = probs.argmax()                #@label
      `,
      beats: [
        { id: 'theme', say: 'Augmentation is one case of a pattern that runs through this whole course.' },
        { id: 'rule', say: 'During training, add random noise. At test time, average the noise away.' },
        { id: 'drop', say: 'Dropout zeroes random activations in training. At test time, it uses their expected value. DropConnect does the same to weights.', code: 'drop' },
        { id: 'bn', say: 'Batch normalization uses noisy mini-batch statistics in training, and fixed averages at test time.', code: 'bn' },
        { id: 'ens', say: 'An ensemble averages networks that started from different random weights.', code: 'ens' },
        { id: 'aug', say: 'And augmentation puts the noise in the input, while test-time crops average it out.', code: ['aug', 'views'] },
        { id: 'eq', say: 'Written as an equation: the probability of class y given X is about the average, over M fixed views, of each view\'s answer.', code: ['views', 'avg'] },
        { id: 'cost', say: 'That smooths out the luck of any single crop. The price: M forward passes per image.', code: ['avg', 'label'] },
      ],
    },
    {
      id: 'transfer',
      title: 'Transfer learning',
      codeTitle: 'transfer.py',
      code: `
        net = load_pretrained('alexnet')     #@load
        del net.fc8     # the 1000 scores    #@pop
        codes = net.forward(X)  # (N, 4096)  #@codes
        clf = train_softmax(codes, y)        #@codes

        # or fine-tune it:
        net.fc8 = Linear(4096, n_classes)    #@head
        for layer in net.layers[:5]:         #@freeze
            layer.lr = 0    # frozen         #@freeze
        train(net, X, y, lr=base_lr)         #@head
      `,
      beats: [
        { id: 'scratch', say: 'The other half of making the most of your data is not starting from scratch.' },
        { id: 'myth', say: 'You do not need a huge dataset to use ConvNets. Features learned on ImageNet, {1.2|one point two} million images in a thousand classes, help with almost any visual task.', code: 'load' },
        { id: 'two', say: 'So people download a network trained on ImageNet, and use it in one of two ways.', code: 'load' },
        { id: 'extract', say: 'One: as a fixed feature extractor. Remove the last layer, the thousand ImageNet scores.', code: 'pop' },
        { id: 'codes', say: 'What remains turns each image into {4,096|four thousand and ninety six} numbers, after a {ReLU|ray-loo}: its CNN codes. Then train a linear classifier on them.', code: 'codes' },
        { id: 'strong', say: 'This simple recipe is remarkably strong. One paper called it an astounding baseline.', code: 'codes' },
        { id: 'finetune', say: 'Two: fine-tuning. Replace the classifier, and keep training the pretrained weights on your own data.', code: 'head' },
        { id: 'freeze', say: 'You can freeze the early layers, which hold generic edge and color detectors, and fine-tune only the top.', code: 'freeze' },
        { id: 'specific', say: 'The top layers are more specific. ImageNet has many dog breeds, so much of the top is busy telling dogs apart.' },
        { id: 'zoo', say: 'Training on ImageNet took weeks, so people share their trained weights, like {Caffe|caff-ay}\'s Model Zoo.', code: 'load' },
      ],
    },
    {
      id: 'strategy',
      title: 'Which strategy, when?',
      codeTitle: 'strategy.py',
      code: `
        small = len(X) < 10_000              #@size
        similar = looks_like_imagenet(X)     #@size
        if small:
            layer = 'fc7' if similar else 'conv4'  #@small
            codes = net.features(X, upto=layer)    #@small
            clf = train_softmax(codes, y)          #@small
        else:
            k = 2 if similar else 6   # depth  #@big
            fine_tune_top(net, k)              #@big

        for layer in net.layers:
            dW = layer.grad                    #@step
            layer.W -= layer.lr_mult * lr * dW #@step
        # lr_mult: 1 for the new head,         #@mult
        # 0.1 top, 0.01 middle, 0 frozen       #@mult
      `,
      beats: [
        { id: 'two', say: 'Which strategy, when? It depends on how much data you have, and how similar it is to ImageNet.', code: 'size' },
        { id: 'c1', say: 'Little data, similar images: fine-tuning would overfit, but the top features fit. Train a linear classifier on the CNN codes.', code: 'small' },
        { id: 'c2', say: 'Lots of data, similar images: fine-tune the top few layers, or all of them.', code: 'big' },
        { id: 'c3', say: 'Little data, very different images, like X-rays: the hard case. Try linear classifiers on earlier, more generic layers.', code: 'small' },
        { id: 'c4', say: 'Lots of data, very different images: fine-tune a large part of the network. Pretrained weights still beat random ones as a start.', code: 'big' },
        { id: 'noisy', say: 'When you fine-tune, the pretrained weights are already good, while a fresh head sends back large, noisy gradients.', code: 'step' },
        { id: 'rates', say: 'So the head gets the full learning rate, {η|eta}. The top layers get a tenth, the middle a hundredth, and frozen layers zero.', code: ['step', 'mult'] },
        { id: 'caffe', say: 'In {Caffe|caff-ay}, that is one multiplier per layer, and zero freezes it.', code: 'mult' },
        { id: 'norm', say: 'Transfer learning is the norm. Object detectors and captioning systems start from ImageNet ConvNets too.' },
        { id: 'advice', say: 'With fewer than a million images, find a big, similar dataset, train or download a ConvNet on it, and transfer.' },
      ],
    },
    {
      id: 'stack',
      title: 'How to stack convolutions',
      codeTitle: 'conv_cost.py',
      code: `
        H, C = 56, 256         # H x H x C   #@vol
        outs = H * H * C       # per layer   #@vol
        one_7x7 = outs * 7 * 7 * C           #@seven
        three_3x3 = 3 * outs * 3 * 3 * C     #@three
        three_3x3 / one_7x7    # 27/49       #@ratio

        squeeze = 1 * 1 * C * (C // 2)       #@sq
        middle = 3 * 3 * (C // 2) ** 2       #@mid
        expand = 1 * 1 * (C // 2) * C        #@ex
        # 3.25 C^2, vs 9 C^2 for one 3x3     #@ex

        factored = (1 * 3 + 3 * 1) * C * C   #@fac
        # 6 C^2; for N x N: 2N vs N^2        #@fac
      `,
      beats: [
        { id: 'recall', say: 'Chapter eleven favored stacks of small {3 × 3|three by three} filters for their fewer weights. The same holds for compute.' },
        { id: 'setup', say: 'Take an H by H by C volume, and layers of C filters that keep it H by H by C.', code: 'vol' },
        { id: 'cost', say: 'Each output costs one multiply-add per filter weight, and each layer has H times H times C outputs.', code: 'vol' },
        { id: 'seven', say: 'One {7 × 7|seven by seven} layer: forty nine C weights per output, so forty nine, H squared, C squared.', code: 'seven' },
        { id: 'three', say: 'Three {3 × 3|three by three} layers see the same {7 × 7|seven by seven} patch, for three times nine: twenty seven, H squared, C squared.', code: 'three' },
        { id: 'good', say: 'Nearly half the compute, and three {ReLUs|ray-loos} instead of one. The lecture called that good, in capital letters.', code: 'ratio' },
        { id: 'why', say: 'Why stop there? A {1 × 1|one by one} convolution only mixes the channels at each pixel: a cheap way to change depth.' },
        { id: 'squeeze', say: 'The bottleneck squeezes the channels down to half with a {1 × 1|one by one} layer,', code: 'sq' },
        { id: 'middle', say: 'does the {3 × 3|three by three} work at half depth, for a quarter of the cost,', code: 'mid' },
        { id: 'expand', say: 'and expands back with another {1 × 1|one by one}: {3.25|three and a quarter} C squared, instead of nine.', code: 'ex' },
        { id: 'factor', say: 'Even a {3 × 3|three by three} splits into a {1 × 3|one by three} and a {3 × 1|three by one}: six C squared instead of nine. For N by N, two N instead of N squared.', code: 'fac' },
        { id: 'bars', say: 'Line the five designs up: fewer parameters, less compute, more nonlinearity, whatever C and H are.' },
      ],
    },
    {
      id: 'im2col',
      title: 'im2col: convolution as one matmul',
      codeTitle: 'im2col.py',
      code: `
        F = 3              # 5x5 X, 3x3 out
        X_col = np.zeros((F * F, 9))
        for m in range(9):
            i, j = divmod(m, 3)              #@patch
            patch = X[i:i+F, j:j+F]          #@patch
            X_col[:, m] = patch.reshape(-1)  #@col
        W_row = W.reshape(2, F * F)          #@wrow
        out = W_row.dot(X_col)   # (2, 9)    #@mm
        A = out.reshape(2, 3, 3)             #@reshape

        # AlexNet conv1, 11x11x3 filters:
        X_col.shape    # (363, 3025)         #@alex
        X_col.size / X.size   # 7.1          #@alex
      `,
      beats: [
        { id: 'how', say: 'So how does a computer compute a convolution fast?' },
        { id: 'blas', say: 'Matrix multiplication is tuned to the last instruction on every platform: {BLAS|blass} on {CPUs|C P Us}, {cuBLAS|coo blass} on {GPUs|G P Us}.' },
        { id: 'idea', say: 'So the common trick, {im2col|im to coal}, rearranges a convolution into one big matrix multiply.' },
        { id: 'patch', say: 'Take a five by five input X and a three by three window. At each of its nine positions, take the patch,', code: 'patch' },
        { id: 'col', say: 'read it row by row, and stand it up as a column of {X_col|X col}.', code: 'col' },
        { id: 'repeat', say: 'The same inputs land in several columns: the middle pixel is in all nine.', code: 'col' },
        { id: 'wrow', say: 'Then stretch each filter into a row: with two filters, {W_row|W row} is two by nine.', code: 'wrow' },
        { id: 'mm', say: 'One matrix product does it all: row k times column m is filter k dotted with patch m, one output.', code: 'mm' },
        { id: 'reshape', say: 'And a reshape turns each row of the result into a three by three activation map.', code: 'reshape' },
        { id: 'cost', say: 'The price is memory: for {AlexNet|Alex net}\'s first layer, {X_col|X col} is seven times bigger than the image. {Caffe|Caff-ay} does exactly this.', code: 'alex' },
      ],
    },
    {
      id: 'fast',
      title: 'FFT and Winograd',
      codeTitle: 'fast_conv.py',
      code: `
        # 1. FFT, padded to n = len(X) + F - 1
        FX = np.fft.rfft2(X, (n, n))           #@fx
        FW = np.fft.rfft2(W[::-1, ::-1], (n, n)) #@fx
        full = np.fft.irfft2(FX * FW, (n, n))  #@inv

        # 2. Winograd F(2, 3): d inputs, g taps
        y0 = d[0]*g[0] + d[1]*g[1] + d[2]*g[2]  #@direct
        y1 = d[1]*g[0] + d[2]*g[1] + d[3]*g[2]  #@direct
        G = [g[0], (g[0] + g[1] + g[2]) / 2,    #@G
             (g[0] - g[1] + g[2]) / 2, g[2]]    #@G
        m1 = (d[0] - d[2]) * G[0]               #@m
        m2 = (d[1] + d[2]) * G[1]               #@m
        m3 = (d[2] - d[1]) * G[2]               #@m
        m4 = (d[1] - d[3]) * G[3]               #@m
        y = [m1 + m2 + m3, m2 - m3 - m4]        #@y
      `,
      beats: [
        { id: 'theorem', say: 'A second approach: the convolution theorem.' },
        { id: 'waves', say: 'The Fourier transform rewrites a signal as a sum of waves, and convolution becomes an elementwise product of transforms.', code: 'fx' },
        { id: 'steps', say: 'Transform the image, transform the flipped filter, multiply, and transform back.', code: ['fx', 'inv'] },
        { id: 'nlogn', say: 'The fast Fourier transform does n numbers in about n log n steps, not n squared. Big wins for big filters, small ones for {3 × 3|three by three}.', code: 'inv' },
        { id: 'strassen', say: 'The third approach is clever algebra: trade multiplications for cheaper additions, as Strassen did for matrix products.' },
        { id: 'lavin', say: 'In {2015|twenty fifteen}, Lavin and Gray did that for {3 × 3|three by three} convolutions, with {Winograd|Win-oh-grad}\'s algorithms.' },
        { id: 'direct', say: 'The smallest case: two outputs of a three-tap filter g, over four inputs d. Done directly, that is six multiplications.', code: 'direct' },
        { id: 'G', say: 'The fast way first mixes the filter into four numbers, G: once per filter, then reused at every position.', code: 'G' },
        { id: 'm', say: 'Then four products, each a sum or difference of inputs, times one G.', code: 'm' },
        { id: 'y', say: 'Add and subtract them: the same two outputs, from four multiplications instead of six.', code: 'y' },
        { id: 'tile', say: 'In two dimensions, a two by two tile takes sixteen instead of thirty six. {cuDNN|coo D N N} added it in {2016|twenty sixteen}.' },
        { id: 'sum', say: 'To sum up: {im2col|im to coal} is easy but memory hungry. The {FFT|F F T} suits large filters, and {Winograd|Win-oh-grad} the small ones.' },
      ],
    },
    {
      id: 'hardware',
      title: 'GPUs and bottlenecks',
      codeTitle: 'hardware.py',
      code: `
        for i in range(N):        # CPU: in turn #@cpu
            out[i] = f(x[i])                     #@cpu
        out = f(x)    # GPU: all of x at once    #@gpu

        loader = Thread(target=next_batch)       #@copy
        X_gpu = to_gpu(X_batch)   # slow!        #@copy
        X = np.memmap('train.bin', np.uint8)     #@disk

        shards = np.array_split(batch, G)        #@shards
        grads = [grad(W, s) for s in shards]     #@shards
        dW = sum(grads) / G   # wait for all     #@sync
        W -= lr * dW                             #@sync
      `,
      beats: [
        { id: 'cpu', say: 'All this runs on hardware. A {CPU|C P U} has a few fast cores, good at doing one thing after another.', code: 'cpu' },
        { id: 'gpu', say: 'A {GPU|G P U} has thousands of slower cores. They do one simple operation on lots of data at once: exactly what convolutions are.', code: 'gpu' },
        { id: 'nvidia', say: '{NVIDIA|En-vidia} leads, thanks to {CUDA|coo-da} and its libraries, {cuBLAS|coo blass} and {cuDNN|coo D N N}, which the frameworks call for you.' },
        { id: 'copy', say: 'Watch for bottlenecks. Moving data to the {GPU|G P U} is slow. So prepare the next batch on the {CPU|C P U}, in a separate thread.', code: 'copy' },
        { id: 'disk', say: 'Disks choke on millions of small files: store the images in one big file, and stream it from an {SSD|S S D}.', code: 'disk' },
        { id: 'mem', say: 'And memory is tight: twelve gigabytes on the biggest {GPU|G P U} of early {2016|twenty sixteen}.' },
        { id: 'data', say: 'Several {GPUs|G P Us} can share the work. In data parallelism, each holds the whole model, and takes a slice of the batch.', code: 'shards' },
        { id: 'model', say: 'In model parallelism, the model itself is split. Krizhevsky split his fully connected layers this way.' },
        { id: 'sync', say: 'Synchronous training waits for everyone, averages the gradients, and updates: exactly one big batch, just faster.', code: 'sync' },
        { id: 'async', say: 'Asynchronous training updates a shared copy whenever a worker finishes: no waiting, but slightly stale weights.' },
      ],
    },
    {
      id: 'precision',
      title: 'Fewer bits per number',
      codeTitle: 'precision.py',
      code: `
        np.float64(1.0)   # NumPy's default   #@f64
        np.float32(1.0)   # training, 2016    #@f32
        np.float16(1.0)   # the prediction    #@f16

        step = 1e-4                           #@step
        w = np.float16(1.0)                   #@step
        w = np.float16(w - step)  # still 1.0 #@step

        ulp = 2.0 ** -11   # gap just below 1
        def stochastic_round(v):              #@sr
            lo = np.floor(v / ulp) * ulp      #@sr
            up = rng.rand() < (v - lo) / ulp  #@up
            return lo + up * ulp              #@sr
      `,
      beats: [
        { id: 'bits', say: 'One more hardware question: how many bits per number?' },
        { id: 'f64', say: 'NumPy uses sixty four bit doubles by default.', code: 'f64' },
        { id: 'f32', say: 'ConvNets train in thirty two bit single precision: half the memory, and accurate enough.', code: 'f32' },
        { id: 'f16', say: 'The lecture predicted sixteen bits would become standard. Research went lower still, even to one bit.', code: 'f16' },
        { id: 'danger', say: 'The danger is small numbers getting rounded away. Just below one, float sixteen values are about {0.0005|five ten-thousandths} apart.', code: 'f16' },
        { id: 'stuck', say: 'So a step of {0.0001|one ten-thousandth}, on a weight of one, rounds straight back to one. Every single time.', code: 'step' },
        { id: 'sr', say: 'The fix is stochastic rounding: round up at random. The chance of up is how far the value is past the lower neighbor.', code: ['sr', 'up'] },
        { id: 'avg', say: 'Each rounding is off, but on average it is exactly right. So the weight tracks the truth.', code: 'up' },
        { id: 'gupta', say: 'With it, Gupta and colleagues trained networks in sixteen bit fixed point.' },
      ],
    },
    {
      id: 'software',
      title: 'Deep learning software',
      codeTitle: 'theano_net.py',
      code: `
        import theano.tensor as T

        x, y = T.matrix('x'), T.ivector('y')    #@sym
        w1, w2 = T.matrix('w1'), T.matrix('w2') #@sym
        a = T.maximum(0, x.dot(w1))  # no data  #@graph
        probs = T.nnet.softmax(a.dot(w2))       #@graph
        ce = T.nnet.categorical_crossentropy    #@graph
        loss = ce(probs, y).mean()              #@graph
        dw1, dw2 = T.grad(loss, [w1, w2])       #@grad
        f = theano.function([x, y, w1, w2],     #@compile
                            [loss, dw1, dw2])   #@compile
        out = f(xx, yy, ww1, ww2)  # real data  #@run

        # TensorFlow: placeholder, Variable,    #@tf
        # sess.run(step, feed_dict={x: xx})     #@tf
      `,
      beats: [
        { id: 'nobody', say: 'Nobody writes a serious ConvNet in raw NumPy. In {2016|twenty sixteen}, four frameworks led: {Caffe|caff-ay}, Torch, {Theano|thee-ah-no} and {TensorFlow|tensor flow}.' },
        { id: 'jobs', say: 'All of them solve the same two problems: run fast on {GPUs|G P Us}, and compute the gradients for you.' },
        { id: 'graph', say: 'A network is a computational graph. Backprop is the chain rule, run backward through it.', code: 'graph' },
        { id: 'auto', say: 'So a framework that knows the graph does backprop for you: you write only the forward pass.', code: 'grad' },
        { id: 'sym', say: 'In {Theano|thee-ah-no}, you first build the graph from symbolic variables that hold no data yet.', code: ['sym', 'graph'] },
        { id: 'compile', say: 'Then you ask for the gradients, symbolically, and compile it all into a function.', code: ['grad', 'compile'] },
        { id: 'run', say: 'Only then do you run it, on real arrays.', code: 'run' },
        { id: 'tf', say: '{TensorFlow|Tensor flow}, from Google, is the same plan with new names: placeholders, Variables, and a Session. Both shine for unusual recurrent nets.', code: 'tf' },
        { id: 'caffe', say: '{Caffe|Caff-ay}, from Berkeley, describes ConvNets in text files, so you can fine-tune from its Model Zoo without writing code.' },
        { id: 'torch', say: 'Torch has NumPy-like arrays and short, readable layers, so new layers are easy. But it is in {Lua|loo-ah}.' },
        { id: 'later', say: 'It all moved fast. {PyTorch|Pie torch} arrived in {2017|twenty seventeen}, building the graph as the code runs, and soon became the default for research.' },
      ],
    },
    {
      id: 'outro',
      title: 'Takeaways',
      codeTitle: 'recipe.py',
      code: `
        X = augment(X)        # flips, crops  #@aug
        probs = np.mean(net(ten_crops(X)), 0) #@aug
        net = pretrained('imagenet')          #@transfer
        fine_tune(net, lr=base_lr / 10)       #@transfer
        block = [conv1x1, conv3x3, conv1x1]   #@stack
        A = W_row.dot(X_col)   # im2col       #@conv
        train(net, gpu, np.float16)           #@conv
        loss.backward()   # the framework     #@sw
      `,
      beats: [
        { id: 'r1', say: 'That is ConvNets in practice. Stretch your data with label-keeping noise, and average fixed views at test time.', code: 'aug' },
        { id: 'r2', say: 'Start from an ImageNet model, and fine-tune more of it as your data grows and differs.', code: 'transfer' },
        { id: 'r3', say: 'Stack small filters and bottlenecks: fewer parameters, less compute, more nonlinearity.', code: 'stack' },
        { id: 'r4', say: 'Underneath, convolutions become matrix multiplies, {FFTs|F F Ts} or {Winograd|Win-oh-grad} tricks, on {GPUs|G P Us}, in fewer and fewer bits.', code: 'conv' },
        { id: 'r5', say: 'And let a framework derive the gradients.', code: 'sw' },
        { id: 'next', say: 'Next, we ask a picture for more than one label: where each object is, with a box around it, and which pixels belong to it.', pause: 0.6 },
      ],
    },
  ],
};

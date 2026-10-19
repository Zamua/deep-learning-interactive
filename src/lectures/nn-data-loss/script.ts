import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'nn-data-loss',
  title: 'Data, initialization and regularization',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'What makes a network train',
      codeTitle: 'recipe.py',
      code: `
        # chapter 7: the network itself
        scores = net(X)                    #@net

        # chapter 8: what makes it train
        X -= np.mean(X, axis=0)            #@data
        W = np.random.randn(n, H)          #@init
        W *= np.sqrt(2.0 / n)              #@init
        h = batchnorm(h, gamma, beta)      #@bn
        h *= (np.random.rand(H) < p) / p   #@reg
        loss = data_loss + reg * R(W)      #@reg,loss
      `,
      beats: [
        { id: 'hello', say: 'Welcome to chapter eight. Chapter seven built the network itself: neurons, activation functions, layers.', code: 'net' },
        { id: 'gap', say: 'But a network on paper is not one that trains. In between sit a few decisions that look like housekeeping, and turn out to decide everything.' },
        { id: 'data', say: 'What to do to the data first.', code: 'data' },
        { id: 'init', say: 'What numbers to start the weights at.', code: 'init' },
        { id: 'bn', say: 'How to keep the signal well scaled through many layers.', code: 'bn' },
        { id: 'reg', say: 'How to stop the network from memorizing.', code: 'reg' },
        { id: 'loss', say: 'And which loss to minimize.', code: 'loss' },
        { id: 'why', say: 'Each has a short recipe, and a reason behind it. We will see both.' },
      ],
    },
    {
      id: 'preprocess',
      title: 'Center, then scale',
      codeTitle: 'preprocess.py',
      code: `
        # X: (N, D), one row per example   #@X
        mu = np.mean(X, axis=0)   # (D,)   #@mu
        X -= mu                   # center #@center
        sd = np.std(X, axis=0)    # (D,)   #@std
        X /= sd                   # scale  #@norm

        # mu = [{{m0:…}}, {{m1:…}}]         #@mu
        # sd = [{{s0:…}}, {{s1:…}}]         #@std
      `,
      beats: [
        { id: 'matrix', say: 'Start with the data as a matrix X: one row per example, one column per feature, like one pixel value.', code: 'X' },
        { id: 'cloud', say: 'With two features, each example is a point, and the data set is a cloud.' },
        { id: 'mean', say: 'A feature\'s mean is its average: add up its column, and divide by the number of examples.', code: 'mu' },
        { id: 'mu', say: 'One mean per feature marks the center of the cloud: the teal cross, {μ|mu}.', code: 'mu' },
        { id: 'center', say: 'Subtracting {μ|mu} from every row is the always-do step. The cloud slides over to sit around the origin.', code: 'center' },
        { id: 'var', say: 'Next, spread. The variance squares each distance from the mean, so negatives count too, and averages the squares.', code: 'std' },
        { id: 'sd', say: 'Its square root, the standard deviation sigma, is a typical distance from the mean, in the original units.', code: 'std' },
        { id: 'norm', say: 'Dividing each column by its own sigma gives every feature a spread of one.', code: 'norm' },
        { id: 'units', say: 'That matters when features have different units, like meters and dollars. Pixels share one scale, so for images it is optional.' },
        { id: 'tilt', say: 'But the cloud was only slid and stretched along the axes, so its tilt remains: the features still rise and fall together.' },
      ],
    },
    {
      id: 'pca',
      title: 'Covariance, PCA and whitening',
      codeTitle: 'pca.py',
      code: `
        X -= np.mean(X, axis=0)
        cov = np.dot(X.T, X) / X.shape[0]  #@cov
        # [[{{c00:…}}, {{c01:…}}],              #@cov
        #  [{{c01b:…}}, {{c11:…}}]]             #@cov
        U, S, V = np.linalg.svd(cov)       #@svd
        # S = [{{s0:…}}, {{s1:…}}]              #@svd
        Xrot = np.dot(X, U)   # rotate     #@rot
        Xred = np.dot(X, U[:, :1])  # 1-D  #@reduce
        Xwhite = Xrot / np.sqrt(S + {{eps:1e-5}}) #@white
      `,
      beats: [
        { id: 'together', say: 'Real features are rarely independent. Neighbouring pixels are usually similar: when one is bright, so is the other.' },
        { id: 'cov', say: 'The covariance matrix records this. For each pair of features, multiply their centered values, and average over the examples.', code: 'cov' },
        { id: 'diag', say: 'On the diagonal, a feature paired with itself, that is just its variance.', code: 'cov' },
        { id: 'off', say: 'Off the diagonal, positive means the pair rises together. Here most points are high in both or low in both, so the average is positive.', code: 'cov' },
        { id: 'eig', say: 'The covariance has special directions, its eigenvectors. The first points along the cloud\'s longest spread, the second perpendicular to it.', code: 'svd' },
        { id: 'eig2', say: 'Each eigenvalue, in S, says how much the data varies along its direction.', code: 'svd' },
        { id: 'rot', say: 'Rotate the data into these directions, and the tilt is gone. The off-diagonal covariance is zero: the features are decorrelated.', code: 'rot' },
        { id: 'reduce', say: 'The eigenvectors come sorted by variance. Keep the first k, and each example shrinks from D numbers to k: PCA dimensionality reduction.', code: 'reduce' },
        { id: 'white', say: 'Whitening then divides each rotated coordinate by its own standard deviation, the square root of its eigenvalue.', code: 'white' },
        { id: 'round', say: 'The cloud becomes round: zero mean, no correlation, equal spread.', code: 'white' },
        { id: 'eps', say: 'The catch: the thinnest directions, mostly noise in real data, get stretched the most. A larger epsilon tempers that.', code: 'white' },
      ],
    },
    {
      id: 'eigen',
      title: 'Eigen-images, and what people do',
      codeTitle: 'pca_cifar.py',
      code: `
        X = gray16.reshape(1000, 256)
        mu = np.mean(X, axis=0)
        X -= mu
        cov = np.dot(X.T, X) / X.shape[0]  #@cov
        U, S, V = np.linalg.svd(cov)       #@cov
        k = {{k:24}}                              #@k
        Xk = np.dot(X, U[:, :k])  # (1000, k) #@reduce
        back = np.dot(Xk, U[:, :k].T) + mu #@reduce
        # variance kept: {{kept:…}}            #@reduce

        # ConvNets: center only, train stats
        mu = np.mean(X_train, axis=0)      #@train
        X_train -= mu                      #@train
        X_test -= mu   # the SAME mu       #@test
      `,
      beats: [
        { id: 'real', say: 'Now real images: CIFAR-10, shrunk to sixteen by sixteen gray pixels. Each image is a point in {256|two hundred and fifty six} dimensions.' },
        { id: 'cov', say: 'So each eigenvector is {256|two hundred and fifty six} numbers, and can be drawn as a picture: an eigen-image.', code: 'cov' },
        { id: 'blobs', say: 'Smooth blobs and gradients: broad brightness patterns carry most of the variance, so the top directions are low frequencies.', code: 'cov' },
        { id: 'keep', say: 'Keep k coordinates per image, and rotate back. With twenty four, about eighty five percent of the variance survives.', code: ['k', 'reduce'] },
        { id: 'sweep', say: 'With fewer, the pictures blur. With more, the detail returns.', code: ['k', 'reduce'] },
        { id: 'twist', say: 'The twist: PCA and whitening are not used with ConvNets.' },
        { id: 'recipe', say: 'ConvNets just zero-center: subtract the mean image, or one mean per color channel.', code: 'train' },
        { id: 'bug', say: 'And compute that mean on the training set only, then subtract the same mean from validation and test.', code: ['train', 'test'] },
        { id: 'leak', say: 'Compute it before splitting, and the test images leak into training. Your test score stops being honest.', code: 'test' },
      ],
    },
    {
      id: 'init',
      title: 'Why not start at zero?',
      codeTitle: 'init.py',
      code: `
        W = np.zeros((D, H))   # all equal  #@zero
        h = np.maximum(0, np.dot(x, W))     #@fwd
        # every column of W gets the        #@grad
        # same gradient, the same update    #@grad

        # break the symmetry instead:
        W = 0.01 * np.random.randn(D, H)    #@rand
      `,
      beats: [
        { id: 'question', say: 'Every weight needs a starting value. Final weights end up about half positive and half negative, so why not start them all at zero?' },
        { id: 'clones', say: 'Because if every weight in a layer is equal, every neuron computes the same output.', code: ['zero', 'fwd'] },
        { id: 'grads', say: 'Each then gets the same gradient, and the same update.', code: 'grad' },
        { id: 'forever', say: 'They stay clones forever: a hundred neurons acting as one.', code: 'grad' },
        { id: 'symmetry', say: 'Any constant does this. The problem is the symmetry, not the zero.' },
        { id: 'random', say: 'Small random numbers break it: draw each weight from a bell curve around zero, with a small spread, like {0.01|zero point zero one}.', code: 'rand' },
        { id: 'differ', say: 'Every neuron starts a little different, so each learns something different.', code: 'rand' },
        { id: 'danger', say: 'But in a deep network, small is a dangerous word. To see why, look at what one neuron does to the spread of its inputs.' },
      ],
    },
    {
      id: 'variance',
      title: 'How a neuron scales the spread',
      codeTitle: 'variance_check.py',
      code: `
        n = 100                     # inputs
        x = np.random.randn(100000, n)    #@x
        w = np.random.randn(n) * {{scale:0.01}} #@w
        s = x.dot(w)    # one sum per row #@s
        print(s.var())  # {{var:…}}           #@var

        # Var(s) = n * Var(w) * Var(x)    #@law
        w = np.random.randn(n) / np.sqrt(n) #@fix
      `,
      beats: [
        { id: 'neuron', say: 'One neuron, before its nonlinearity, multiplies each of its n inputs by a weight, and adds them up. Call the sum s.', code: 's' },
        { id: 'ev', say: 'The expected value of a random quantity is its long-run average, and its variance is the expected squared distance from it.' },
        { id: 'f1', say: 'Three facts. One: variances of independent quantities add.' },
        { id: 'f2', say: 'Two: multiplying by a number a multiplies the variance by a squared.' },
        { id: 'f3', say: 'Three: for independent quantities centered on zero, the variance of a product is the product of the variances.' },
        { id: 'derive', say: 'Now apply them. The sum has n independent terms, each a weight times an input.', code: 'law' },
        { id: 'law', say: 'So the variance of s is n, times the variance of w, times the variance of x.', code: 'law' },
        { id: 'shrink', say: 'With a hundred inputs and weights of {0.01|zero point zero one}, that factor is a hundredth: the variance shrinks a hundredfold.', code: ['w', 'var'] },
        { id: 'fix', say: 'To keep it, give w a variance of one over n: draw randn, and divide by the square root of n.', code: ['fix', 'var'] },
      ],
    },
    {
      id: 'deep',
      title: 'Ten layers deep',
      codeTitle: 'activation_stats.py',
      code: `
        D = np.random.randn(200, 100)
        Hs = {}
        for i in range(10):
            X = D if i == 0 else Hs[i - 1] #@loop
            fan_in = X.shape[1]            #@loop
            W = np.random.randn(fan_in, 100) #@init
            W *= {{scale:0.01}}                  #@init
            H = np.dot(X, W)               #@fwd
            Hs[i] = {{act:np.tanh(H)}}          #@act
        # layer 10 std: {{std:…}}            #@std
      `,
      beats: [
        { id: 'setup', say: 'The lecture\'s experiment: push random data through ten layers of a hundred {tanh|tan h} units, and watch each layer\'s spread.', code: ['loop', 'fwd', 'act'] },
        { id: 'small', say: 'Weights of {0.01|zero point zero one}: the spread shrinks tenfold per layer.', code: ['init', 'std'] },
        { id: 'dead', say: 'By layer ten, every activation is about zero. The weight gradients are proportional to them, so they vanish too.', code: 'std' },
        { id: 'big', say: 'Weights of one: the sums are huge, and {tanh|tan h} saturates at minus one and plus one.', code: 'init' },
        { id: 'flat', say: 'Out there {tanh|tan h} is flat, so again no gradient flows.', code: 'act' },
        { id: 'xavier', say: 'Now the variance we derived: one over the fan-in, the number of inputs per unit. This is Xavier initialization.', code: 'init' },
        { id: 'healthy', say: 'The spread holds steady, all the way down.', code: 'std' },
        { id: 'relu', say: 'Switch to ReLU, and Xavier starves the deep layers: ReLU zeroes the negative half, halving the variance it passes on.', code: ['act', 'std'] },
        { id: 'he', say: 'He and colleagues doubled the variance, to two over the fan-in, and the spread holds again.', code: 'init' },
        { id: 'glorot', say: 'Glorot and Bengio\'s variant averages fan-in and fan-out, to steady the backward pass too.' },
        { id: 'bias', say: 'Biases simply start at zero. So for ReLU networks: weights times the square root of two over n, and zero biases.', code: 'init' },
      ],
    },
    {
      id: 'batchnorm',
      title: 'Batch normalization',
      codeTitle: 'batchnorm.py',
      code: `
        # x: (N, D) pre-activations, a batch
        mu = x.mean(axis=0)   # per feature #@mean
        var = x.var(axis=0)                 #@norm
        x_hat = (x - mu) / np.sqrt(var + eps) #@norm
        out = gamma * x_hat + beta  # -> tanh #@scale
        # gamma = {{g:1}}   beta = {{b:0}}         #@scale

        # each step, keep running averages
        run_mu = 0.9 * run_mu + 0.1 * mu    #@run
        run_var = 0.9 * run_var + 0.1 * var #@run
        # test time: use them instead
        std = np.sqrt(run_var + eps)        #@test
        x_hat = (x - run_mu) / std          #@test
      `,
      beats: [
        { id: 'drift', say: 'Good initialization only helps at the start. As the weights train, each layer\'s spread drifts.' },
        { id: 'idea', say: 'Batch normalization, from Ioffe and Szegedy in 2015, simply enforces unit Gaussian inputs at every layer, on every step.' },
        { id: 'diff', say: 'Normalizing is differentiable, so it can be a layer that we backpropagate through like any other.' },
        { id: 'batch', say: 'Here is a mini-batch of sixty four examples, two features each, about to enter a {tanh|tan h}. Below: most of what {tanh|tan h} receives sits in its flat tails.' },
        { id: 'mean', say: 'Step one: subtract each feature\'s mean over the batch.', code: 'mean' },
        { id: 'var', say: 'Step two: divide by each feature\'s standard deviation over the batch. A tiny epsilon avoids dividing by zero.', code: 'norm' },
        { id: 'alive', say: 'Now almost nothing is saturated, so gradients can flow.', code: 'norm' },
        { id: 'tilt', say: 'Features are normalized one by one, not decorrelated, so the tilt stays.' },
        { id: 'gamma', say: 'Last, multiply by gamma and add beta: two numbers per feature, learned.', code: 'scale' },
        { id: 'undo', say: 'With gamma equal to the batch\'s spread and beta equal to its mean, the original values come back. Normalized is the default, not a cage.', code: 'scale' },
        { id: 'where', say: 'BatchNorm goes after a fully connected or convolutional layer, before the nonlinearity.' },
        { id: 'test', say: 'At test time there may be a single example. So in training, each layer keeps running averages of the means and variances.', code: 'run' },
        { id: 'converge', say: 'Test time normalizes with those instead. They start at zero and one, and settle after many batches.', code: ['run', 'test'] },
        { id: 'buys', say: 'What it buys: better gradient flow, less sensitivity to initialization, and higher learning rates.' },
        { id: 'noise', say: 'Plus a mild regularizing effect, from the noise of random batch mates.' },
      ],
    },
    {
      id: 'penalties',
      title: 'Weight penalties',
      codeTitle: 'penalties.py',
      code: `
        r2 = 0.5 * np.sum(W * W)    # L2    #@l2
        r1 = np.sum(np.abs(W))      # L1    #@l1
        loss = data_loss + reg * r2         #@loss
        dW += reg * W            # L2 grad  #@decay
        dW += reg * np.sign(W)   # L1 grad  #@l1g
        # {{regline:reg = 0.001}}                #@loss

        # max-norm: clip each neuron's W
        norms = np.linalg.norm(W, axis=0)   #@mn
        W *= np.minimum(1.0, c / norms)     #@mn
      `,
      beats: [
        { id: 'overfit', say: 'A big network can memorize its training set, noise and all, and then fail on anything new. That is overfitting.' },
        { id: 'reg', say: 'Regularization discourages it. The first kind adds a weight penalty to the loss, with strength lambda.', code: 'loss' },
        { id: 'l2', say: 'L2 adds up the squared weights, times a half. Doubling a weight quadruples its penalty, so big weights are expensive.', code: 'l2' },
        { id: 'smooth', say: 'The model spreads its reliance over many modest weights, and the wild curve calms down.', code: ['l2', 'loss'] },
        { id: 'decay', say: 'Its gradient is lambda times W: every step shrinks each weight toward zero. Hence its other name, weight decay.', code: 'decay' },
        { id: 'picture', say: 'Here is the geometry with two weights. The red dot is the best fit to the data alone, ringed by contours of the data loss.' },
        { id: 'circle', say: 'The blue circle holds weights with equal L2 penalty. The answer sits where an ellipse just touches it: both weights shrink, neither reaches zero.', code: 'l2' },
        { id: 'l1', say: 'L1 adds up absolute values instead, charging the same per unit of weight, however big.', code: 'l1' },
        { id: 'corner', say: 'Its shape is a diamond, usually touched at a corner. Raise lambda, and one weight snaps to exactly zero.', code: ['l1', 'l1g'] },
        { id: 'sparse', say: 'With sixteen weights and three useful inputs, L1 zeroes the useless ones, while L2 only shrinks them. Elastic net mixes both.', code: 'l1' },
        { id: 'maxnorm', say: 'Max-norm is a hard cap: after each update, a neuron\'s weight vector longer than c, about three or four, is scaled back. Weights cannot blow up.', code: 'mn' },
        { id: 'bias', say: 'Biases usually go unregularized, and one global L2 strength, tuned on validation data, is the norm.' },
      ],
    },
    {
      id: 'dropout',
      title: 'Dropout',
      codeTitle: 'dropout.py',
      code: `
        p = 0.5   # chance of keeping a unit #@p
        # train: drop units at random
        keep = np.random.rand(*h.shape) < p  #@mask
        # keep = {{keep:…}}                  #@mask
        h *= keep / p   # inverted dropout   #@inv

        # test: no mask, no scaling          #@test
        h = np.maximum(0, np.dot(W, x))      #@test
      `,
      beats: [
        { id: 'what', say: 'Dropout, from Srivastava, Hinton and colleagues in 2014, is simple and surprisingly effective.' },
        { id: 'how', say: 'In training, every forward pass keeps each unit with probability p, and zeroes the rest.', code: ['p', 'mask'] },
        { id: 'fresh', say: 'A new random set for every example and step. At test time, nothing is dropped.', code: 'test' },
        { id: 'coadapt', say: 'Why it helps: no unit can count on another. A cat detector cannot lean on its one whiskers unit, gone half the time.', code: 'mask' },
        { id: 'ensemble', say: 'Or: each mask picks a thinned sub-network, and each step trains one.', code: 'mask' },
        { id: 'count', say: 'n units give two to the n sub-networks, sharing weights. The full network at test time acts like their average.', code: 'test' },
        { id: 'scale', say: 'One subtlety is scale. Kept half the time, a unit sends about half its usual input on, so at test time the next layer would suddenly see twice as much.', code: ['mask', 'test'] },
        { id: 'inverted', say: 'Inverted dropout divides kept units by p during training: doubled, for p of a half.', code: 'inv' },
        { id: 'expect', say: 'On average a unit sends p times h over p, plus nothing: exactly h, as at test time.', code: 'inv' },
        { id: 'watch', say: 'Track one unit\'s input over many passes. It jumps around, but its running average settles on the test-time value.', code: ['mask', 'inv'] },
        { id: 'family', say: 'Dropout is one case of a recipe: noise in training, averaged away at test time. Data augmentation and DropConnect are cousins.' },
        { id: 'practice', say: 'In practice: one global L2 penalty, plus dropout with p around a half.', code: 'p' },
      ],
    },
    {
      id: 'losses',
      title: 'Losses for labels',
      codeTitle: 'losses.py',
      code: `
        f = net(x)   # one score per class
        # one correct class y:
        e = np.exp(f)
        loss = -np.log(e[y] / np.sum(e))   #@soft
        m = np.maximum(0, f - f[y] + 1)    #@svm
        m[y] = 0                           #@svm
        loss = np.sum(m)  # or m ** 2      #@svm

        # many labels at once, y in {0, 1}:
        probs = 1 / (1 + np.exp(-f))       #@sig
        loss = -np.sum(y * np.log(probs)   #@attr
            + (1 - y) * np.log(1 - probs)) #@attr
        df = probs - y   # the gradient    #@grad
      `,
      beats: [
        { id: 'parts', say: 'The other part of the loss, the data loss, averages how well predictions match labels. Which one depends on the question.' },
        { id: 'one', say: 'For one correct class, chapter four\'s choices apply: softmax, or the multiclass SVM.', code: ['soft', 'svm'] },
        { id: 'sq', say: 'Some prefer the squared hinge, which squares each margin.', code: 'svm' },
        { id: 'huge', say: 'With huge numbers of classes, like every word in a dictionary, the softmax itself becomes the bottleneck.', code: 'soft' },
        { id: 'tree', say: 'Hierarchical softmax puts the classes at the leaves of a tree, with a small left-or-right classifier at each branch.' },
        { id: 'cost', say: 'A class then costs only the length of its path. How well it works depends on the tree.' },
        { id: 'attr', say: 'Sometimes an example has several labels, like a photo with many hashtags. Softmax is wrong there: it makes the classes compete.', code: 'soft' },
        { id: 'sigmoid', say: 'Instead, each attribute gets its own sigmoid: an independent probability between zero and one.', code: 'sig' },
        { id: 'logloss', say: 'Its loss is minus the log of the probability given to the right answer, yes or no.', code: 'attr' },
        { id: 'grad', say: 'Any number can be yes at once, and the gradient is just the probability minus the label.', code: 'grad' },
      ],
    },
    {
      id: 'regression',
      title: 'Regression, and one outlier',
      codeTitle: 'regression.py',
      code: `
        pred = w * x + b                   #@pred
        diff = pred - y                    #@pred
        loss = np.sum(diff ** 2)    # L2   #@l2
        dpred = 2 * diff     # grows       #@l2
        loss = np.sum(np.abs(diff)) # L1   #@l1
        dpred = np.sign(diff)  # +1 or -1  #@l1

        # the outlier pulls with:
        # L2 {{g2:…}}   L1 {{g1:…}}               #@pull
      `,
      beats: [
        { id: 'real', say: 'For real-valued outputs, like a height or an angle, the loss measures the distance to the target.', code: 'pred' },
        { id: 'l2l1', say: 'L2 adds up squared errors. L1 adds up absolute errors.', code: ['l2', 'l1'] },
        { id: 'grads', say: 'Under L2, each point pulls in proportion to its error. Under L1, every point pulls equally: only direction matters.', code: ['l2', 'l1'] },
        { id: 'outlier', say: 'Thirteen points near a line, plus an outlier. As it moves away, the L2 fit bends toward it.', code: ['l2', 'pull'] },
        { id: 'l1fit', say: 'The L1 fit barely notices: the outlier pulls like any other point.', code: ['l1', 'pull'] },
        { id: 'fragile', say: 'So L2 is fragile: a few bad targets swamp the gradients. It also demands exact numbers, where softmax just needs the right class to win.', code: 'l2' },
        { id: 'bins', say: 'So first ask: could you bin the output and classify? A star rating often works better as five classes, with a confidence for free.' },
        { id: 'struct', say: 'And for whole structures, like graphs, there is the structured SVM, with special solvers, beyond this course.' },
      ],
    },
    {
      id: 'outro',
      title: 'The checklist',
      codeTitle: 'checklist.py',
      code: `
        mu = np.mean(X_train, axis=0)      #@pre
        X -= mu                            #@pre
        W = np.random.randn(n, H)          #@init
        W *= np.sqrt(2.0 / n)   # He       #@init
        h = batchnorm(np.dot(x, W))        #@bn
        h = np.maximum(0, h)               #@bn
        h *= (np.random.rand(H) < p) / p   #@reg
        loss = data_loss + reg * r2        #@reg
        # one label: softmax. many: sigmoids #@loss
        # real numbers: bins first, then L2  #@loss
      `,
      beats: [
        { id: 'recap', say: 'The chapter, as a checklist.' },
        { id: 'pre', say: 'Subtract the training mean, and divide by the spread if features differ in scale.', code: 'pre' },
        { id: 'init', say: 'Initialize with the square root of two over the fan-in for ReLU, and zero biases.', code: 'init' },
        { id: 'bn', say: 'Batch normalization after each layer, before the nonlinearity.', code: 'bn' },
        { id: 'reg', say: 'One L2 penalty tuned on validation data, plus inverted dropout.', code: 'reg' },
        { id: 'loss', say: 'And a loss that matches the question.', code: 'loss' },
        { id: 'theme', say: 'Keep signals at a healthy scale, and do not let the network memorize.' },
        { id: 'next', say: 'Next, open the interactive chapter: every figure here is there to drag and poke, with its code running beside it.', pause: 0.6 },
      ],
    },
  ],
};

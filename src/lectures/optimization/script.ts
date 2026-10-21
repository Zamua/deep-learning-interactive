import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'optimization',
  title: 'Optimization and gradient descent',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'The third piece',
      codeTitle: 'svm_loss.py',
      code: `
        def L(W, X, y, reg):                       #@def
            N = X.shape[0]
            scores = X.dot(W.T)      # N x C       #@score
            correct = scores[np.arange(N), y]      #@loss
            margins = np.maximum(                  #@loss
                0, scores - correct[:, None] + 1)  #@loss
            margins[np.arange(N), y] = 0           #@loss
            data_loss = margins.sum() / N          #@ret
            return data_loss + reg * np.sum(W * W) #@ret

        # X, y: fixed data.  W: free to change.    #@free
        loss = L(W, X_train, y_train, reg)         #@call
        # loss = {{loss:9.02}}                       #@call
      `,
      beats: [
        { id: 'hello', say: 'Welcome to optimization: the chapter where a classifier finally learns.' },
        { id: 'recap', say: 'The last chapter built two pieces. First, a score function: multiply an image by the weights W, and get one score per class.', code: 'score' },
        { id: 'loss', say: 'Second, a loss function, which grades those scores with one number: high when the classifier is wrong, low when it is right.', code: 'loss' },
        { id: 'third', say: 'This chapter supplies the third piece, optimization: a way to find the weights W that make the loss as small as possible.' },
        { id: 'objective', say: 'Written out, the loss is an average over all N training examples, plus a penalty on the size of the weights.', code: 'ret' },
        { id: 'free', say: 'The images X and labels y are fixed. Only W is free to change, so the loss is really a function of W alone.', code: 'free' },
        { id: 'dials', say: 'Picture W as a panel of dials: {30,730|thirty thousand seven hundred and thirty} of them for {CIFAR-10|see-far ten}. Every setting gives one loss value.', code: 'call' },
        { id: 'goal', say: 'Training means turning the dials until that number is as low as it will go.', code: 'call' },
        { id: 'general', say: 'Our running example is the SVM loss, but the same procedure will later tune networks with millions of weights.' },
      ],
    },
    {
      id: 'landscape',
      title: 'The loss is a landscape',
      codeTitle: 'slices.py',
      code: `
        W1 = np.random.randn(*W.shape)  # random   #@W1
        W2 = np.random.randn(*W.shape)  # another  #@W2
        steps = np.linspace(-1, 1, 101)            #@steps

        # 1-D: the loss along one line             #@curve
        curve = [L(W + a * W1) for a in steps]     #@curve
        # 2-D: a grid over two directions          #@grid
        grid = [[L(W + a * W1 + b * W2)            #@grid
                 for a in steps] for b in steps]   #@grid
      `,
      beats: [
        { id: 'land', say: 'Here is a picture that helps with everything that follows: the loss as a landscape.' },
        { id: 'loc', say: 'Every possible weight matrix is a location in it, and the loss is the altitude at that spot.' },
        { id: 'low', say: 'Training is a search for the lowest point.' },
        { id: 'dims', say: 'The trouble is, for {CIFAR-10|see-far ten} this landscape has {30,730|thirty thousand seven hundred and thirty} directions. Nobody can picture that.' },
        { id: 'slice', say: 'But we can look at slices. Stand on one weight matrix, and pick a random direction: a matrix of the same shape, used like a compass heading.', code: 'W1' },
        { id: 'walk', say: 'Walk along that straight line, recording the loss at each distance a, and you get an ordinary curve.', code: ['steps', 'curve'] },
        { id: 'map', say: 'Add a second direction, walk a grid in both, and the curve grows into a map, colored by height.', code: ['W2', 'grid'] },
      ],
    },
    {
      id: 'creases',
      title: 'Creases and bowls',
      codeTitle: 'loss_slices.py',
      code: `
        def L(W):    # SVM loss on {{which:one example}}   #@L
            return svm_loss(W, X[{{idx:i:i+1}}],     #@L
                            y[{{idx}}], reg={{reg:0}})     #@L

        curve = [L(W0 + a * W1) for a in steps]    #@one
        grid = [[L(W0 + a * W1 + b * W2)           #@two
                 for a in steps] for b in steps]   #@two

        def below_chord(A, B, t):   # always True  #@convex
            mix = t * A + (1 - t) * B              #@convex
            chord = t * L(A) + (1 - t) * L(B)      #@convex
            return L(mix) <= chord                 #@convex
      `,
      beats: [
        { id: 'one', say: 'Start with the loss of one training example. Its slices are flat floors and straight ramps, meeting at sharp creases.', code: ['L', 'one', 'two'] },
        { id: 'hinge', say: 'Each hinge, the max of zero and something, is either off, which is flat, or on, which is a straight ramp.', code: 'L' },
        { id: 'all', say: 'Now average all three hundred examples. The creases blend into a nearly smooth bowl, with a long, gentle valley floor.', code: 'L' },
        { id: 'reg', say: 'Add the regularization penalty, and the valley closes up into a rounder bowl.', code: 'L' },
        { id: 'convex', say: 'A bowl like this is called convex: a straight line between any two points on it never dips below the surface.', code: 'convex' },
        { id: 'nodips', say: 'So a convex function has no misleading little dips. Anywhere you cannot go further downhill is a lowest point.' },
        { id: 'svm', say: 'Every hinge is convex, so is the penalty, and sums of convex functions stay convex: the whole SVM loss is one convex bowl.' },
        { id: 'nn', say: 'Neural networks lose this property, yet the downhill methods of this chapter still work remarkably well on them.' },
        { id: 'kink', say: 'One detail: right on a crease, the slope jumps. We just use the slope from either side, called a subgradient, and nothing breaks.' },
      ],
    },
    {
      id: 'search',
      title: 'Three ways to search',
      codeTitle: 'search.py',
      code: `
        # 1. random search
        best_loss = float('inf')                   #@rs
        for attempt in range(1000):                #@rs
            W = np.random.randn(10, 3073) * 0.0001 #@rsW
            loss = L(W, X_train, y_train, reg)     #@rsW
            if loss < best_loss:                   #@rskeep
                best_loss, best_W = loss, W        #@rskeep
        # about 15.5% test accuracy                #@rsacc

        # 2. random local search
        W = np.random.randn(10, 3073) * 0.001      #@ls
        best_loss = L(W, X_train, y_train, reg)    #@ls
        for i in range(1000):                      #@ls
            step = np.random.randn(*W.shape)       #@ls
            W_try = W + 0.0001 * step              #@ls
            loss = L(W_try, X_train, y_train, reg) #@ls
            if loss < best_loss:   # lower: keep   #@lskeep
                W, best_loss = W_try, loss         #@lskeep
        # about 21.4% test accuracy                #@lsacc

        # 3. follow the slope
        for i in range(1000):                      #@gd
            dW = grad_L(W, X_train, y_train, reg)  #@gd
            W += -step_size * dW    # downhill     #@gd
      `,
      beats: [
        { id: 'blind', say: 'How do you find the bottom of a landscape you cannot see? Picture yourself blindfolded, on a hillside.' },
        { id: 'three', say: 'Here are three strategies, from hopeless to good.' },
        { id: 'rs', say: 'Strategy one: random search. Try lots of random weight matrices, and keep the best one you find.', code: ['rs', 'rsW', 'rskeep'] },
        { id: 'darts', say: 'On the map, that is throwing darts anywhere, and remembering the lowest one.', code: 'rskeep' },
        { id: 'rsacc', say: 'On {CIFAR-10|see-far ten}, the best of a thousand guesses gets about {15.5|fifteen and a half} percent of test images right. Pure guessing gets ten.', code: 'rsacc' },
        { id: 'ls', say: 'Strategy two: random local search. Start somewhere, try a small random step, and keep it only if the loss goes down.', code: ['ls', 'lskeep'] },
        { id: 'foot', say: 'Blindfolded, that is poking a foot out in a random direction, and stepping only if the ground there is lower.', code: 'lskeep' },
        { id: 'lsacc', say: 'That reaches about {21.4|twenty one point four} percent. Better, but wasteful: most pokes point uphill, and get thrown away.', code: 'lsacc' },
        { id: 'slope', say: 'Strategy three: feel the ground under your feet, and step the way it drops most steeply. That direction can be computed: no guessing.', code: 'gd' },
        { id: 'race', say: 'Now let all three race, one move each per round. Gradient descent walks straight downhill, and gets there first.', code: 'gd' },
        { id: 'caveat', say: 'To be fair, on a small two dimensional map, a few dozen darts cover the ground well. In thirty thousand dimensions, they cover nothing.' },
      ],
    },
    {
      id: 'gradient',
      title: 'Slopes and the gradient',
      codeTitle: 'gradient.py',
      code: `
        def slope(f, x, h=1e-5):                   #@slope
            rise = f(x + h) - f(x)                 #@slope
            return rise / h         # over run h   #@slope

        f = lambda x: x ** 2
        slope(f, 3.0, h={{h:2}})    # {{sl:8}}         #@ex

        dW = np.zeros_like(W)  # slope per weight  #@dW
        dW.shape == W.shape    # True              #@shape
        # dW[k, l]: if W[k, l] alone grows,        #@kl
        # how fast does the loss grow?             #@kl
      `,
      beats: [
        { id: 'deriv', say: 'That direction comes from the slope. In one dimension, the slope at a point is the derivative: nudge the input a little, and how much does the output move per unit?' },
        { id: 'rise', say: 'Measure it as rise over run. Step a distance h to the right, see how far the function rose, and divide by h.', code: 'slope' },
        { id: 'shrink', say: 'Now let h shrink toward zero. The line through the two points swings around, and settles onto the tangent.', code: 'ex' },
        { id: 'six', say: 'For {x²|x squared} at three, it settles on six. With a tiny h, the code prints {6.00001|six point zero zero zero zero one}.', code: 'ex' },
        { id: 'sign', say: 'Positive means going right goes up. Negative means going right goes down. And the size says how steeply.' },
        { id: 'many', say: 'But the loss does not have one input. It has one for every weight.' },
        { id: 'partial', say: 'So nudge one weight, hold all the others still, and measure the slope. That is a partial derivative, written with a curly d.', code: 'kl' },
        { id: 'every', say: 'Do that for every weight, and collect the slopes. That collection is the gradient: one slope per weight, the same shape as W.', code: ['dW', 'shape'] },
        { id: 'uphill', say: 'Taken together, the gradient is a direction, and a special one: it points the way the loss rises fastest.' },
        { id: 'down', say: 'So its negative points the way the loss falls fastest: exactly where the blindfolded hiker wants to step.' },
      ],
    },
    {
      id: 'numerical',
      title: 'The numerical gradient',
      codeTitle: 'numerical_gradient.py',
      code: `
        def eval_numerical_gradient(f, W, h=1e-5):
            grad = np.zeros_like(W)                #@init
            for idx in np.ndindex(W.shape):        #@loop
                old = W[idx]   # idx = {{idx:(0, 0)}}   #@loop,nudge
                W[idx] = old + h                   #@nudge
                fxph = f(W)        # nudged up     #@nudge
                W[idx] = old - h                   #@nudge
                fxmh = f(W)        # nudged down   #@nudge
                W[idx] = old       # put it back   #@back
                grad[idx] = (fxph - fxmh) / (2 * h)   #@div
            return grad

        # error shrinks like h (fwd), h**2 (ctr)   #@fwd,ctr
        fwd = (f(x + h) - f(x)) / h                #@fwd
        ctr = (f(x + h) - f(x - h)) / (2 * h)      #@ctr
      `,
      beats: [
        { id: 'recipe', say: 'The definition of the slope hands us an algorithm: nudge a weight by a small h, and see how much the loss changes.' },
        { id: 'loop', say: 'Here it is in code. Loop over every single weight.', code: 'loop' },
        { id: 'nudge', say: 'Nudge it up by h, and evaluate the loss. Nudge it down by h, and evaluate again.', code: 'nudge' },
        { id: 'back', say: 'Then put the weight back exactly the way it was.', code: 'back' },
        { id: 'div', say: 'The change in loss, divided by the total run of two h, is the slope for that one weight.', code: 'div' },
        { id: 'fill', say: 'One weight at a time, the gradient fills in.', code: ['loop', 'div'] },
        { id: 'centered', say: 'Nudging both ways is called the centered difference. Why not nudge just one way, like the textbook definition?', code: ['fwd', 'ctr'] },
        { id: 'lean', say: 'A one sided step measures the slope over a stretch that runs off to one side. If the curve bends, the estimate leans.', code: 'fwd' },
        { id: 'cancel', say: 'The centered stretch is balanced, so the leaning from the two sides cancels. Its error shrinks like h squared, instead of like h.', code: 'ctr' },
      ],
    },
    {
      id: 'tiny-h',
      title: 'How small should h be?',
      codeTitle: 'numeric_vs_analytic.py',
      code: `
        dt = np.{{dtype:float64}}                      #@dtype
        W = np.array([[0.7, 0.4], [0.3, -0.8],
                      [-0.5, 0.2]], dtype=dt)
        x, y = np.array([1.2, -0.7]), 1
        def f(w):       # loss as a function of w
            W[0, 0] = w
            return softmax_loss(W.dot(x), y)

        w, h = 0.7, {{h:1}}
        num = (f(w + h) - f(w - h)) / (2 * h)      #@num
        fwd = (f(w + h) - f(w)) / h                #@fwd
        W[0, 0] = w; p = softmax(W.dot(x))
        ana = (p[0] - (y == 0)) * x[0]  # calculus #@ana
        big = max(abs(num), abs(ana))              #@err
        rel = abs(num - ana) / big   # {{err:…}}     #@err

        # 2 * 30730 = 61460 loss evaluations       #@cost
        # for one step on CIFAR-10                 #@cost
      `,
      beats: [
        { id: 'small', say: 'So how small should h be? Here is the error of both recipes, for every h from one down to {10⁻¹²|ten to the minus twelve}.', code: ['num', 'fwd'] },
        { id: 'fall', say: 'As h shrinks, the error falls, and twice as steeply for the centered recipe.', code: 'err' },
        { id: 'rise', say: 'But keep going, and it climbs back up. At a tiny h, the two losses agree in almost every digit, so their difference is mostly rounding noise.', code: 'err' },
        { id: 'sweet', say: 'The centered difference does best near {10⁻⁵|ten to the minus five}, which is exactly the course\'s advice.', code: 'num' },
        { id: 'f32', say: 'In single precision, which GPUs favor, the sweet spot moves to a larger h, and the best error is far worse. So gradient checks use double precision.', code: 'dtype' },
        { id: 'slow', say: 'Numerical gradients are simple and always available. But they are approximate, and slow.' },
        { id: 'cost', say: 'Two loss evaluations per weight: for {CIFAR-10|see-far ten}, {61,460|sixty one thousand four hundred and sixty} passes over the training set, for a single step.', code: 'cost' },
        { id: 'better', say: 'And a modern network has millions of weights. We need something better.' },
      ],
    },
    {
      id: 'analytic',
      title: 'The analytic gradient',
      codeTitle: 'svm_grad_one.py',
      code: `
        i = {{i:23}}        # class {{yc:1 (orange)}}         #@pick
        x, y = X[i], Y[i]                          #@pick
        scores = W.dot(x)                          #@scores
        # scores = [{{s0:…}}, {{s1:…}}, {{s2:…}}]        #@scores
        margins = scores - scores[y] + 1           #@margins
        # margins = [{{m0:…}}, {{m1:…}}, {{m2:…}}]       #@margins
        dW = np.zeros_like(W)
        for j in range(3):
            if j != y and margins[j] > 0:          #@if
                dW[j] += x   # w_j: away from x       #@wrong
                dW[y] -= x   # w_y: toward x          #@right
        W += -step_size * dW                       #@step
      `,
      beats: [
        { id: 'formula', say: 'The better way: derive a formula for the gradient with calculus, once, on paper, then just evaluate it. Exact, and about as cheap as the loss.' },
        { id: 'catch', say: 'The catch is that a hand derived formula is easy to get subtly wrong. So the numerical gradient stays around, as a check.' },
        { id: 'one', say: 'Take the SVM loss of one example. For each wrong class j, a hinge: the max of zero, and that class\'s score minus the correct score, plus one.', code: 'margins' },
        { id: 'fact1', say: 'Two facts are all we need. First, the hinge. Its slope is zero on the flat part, and one on the ramp.' },
        { id: 'fact2', say: 'Second, a score is a row of weights dotted with x. Raise one weight by one, and the score rises by the matching input. So its slope, with respect to the row, is x itself.', code: 'scores' },
        { id: 'multiply', say: 'Multiply the outer slope by the inner one. That is the chain rule, the star of the next chapter.' },
        { id: 'wrong', say: 'For a wrong class j: if it violates the margin, the gradient for its row is x. If not, it is zero.', code: ['if', 'wrong'] },
        { id: 'right', say: 'The correct class\'s score enters every active hinge with a minus sign. So its row gets minus x, once for each violator.', code: 'right' },
        { id: 'picture', say: 'Here is what that does in a toy problem. Each thick arrow is one row of W, one class\'s weights. The dashed line is one example, x.', code: 'pick' },
        { id: 'push', say: 'Stepping against the gradient pushes each violating row away from x, lowering that wrong score.', code: 'wrong' },
        { id: 'pull', say: 'And it pulls the correct row toward x, raising the right score. Exactly the fix we want.', code: 'right' },
        { id: 'step', say: 'Take a few steps, and watch the margins in the code shrink.', code: ['step', 'margins'] },
        { id: 'full', say: 'For the full loss, average these over the training set, and add two lambda W from the penalty.' },
      ],
    },
    {
      id: 'check',
      title: 'The gradient check',
      codeTitle: 'grad_check.py',
      code: `
        f = lambda W: L(W, X, y, reg)
        num = eval_numerical_gradient(f, W)  # slow   #@num
        ana = svm_grad(W, X, y, reg)   # fast      #@ana
        diff = np.abs(ana - num)                   #@rel
        big = np.maximum(np.abs(ana), np.abs(num)) #@rel
        rel = diff / big                           #@rel
        print(rel.max())    # {{rel:2.2e-9}}         #@print
      `,
      beats: [
        { id: 'both', say: 'So in practice we compute both, and compare. This is a gradient check, and the assignment has you run one.', code: ['num', 'ana'] },
        { id: 'rel', say: 'It uses the relative error: the size of the difference, divided by the size of the larger of the two.', code: 'rel' },
        { id: 'why', say: 'A gap of one thousandth is alarming between gradients near two thousandths, and meaningless near a thousand. Dividing by their size gives one yardstick.', code: 'rel' },
        { id: 'good', say: 'In double precision, a correct gradient usually shows a relative error around {10⁻⁷|ten to the minus seven}, or smaller.', code: 'print' },
        { id: 'bad', say: 'Above about {10⁻²|ten to the minus two}, it almost always means a bug: a flipped sign, or a forgotten term.', code: 'print' },
        { id: 'crease', say: 'A kinked loss like the SVM can show a larger error when a nudge happens to cross a crease. That one is not a bug.' },
        { id: 'table', say: 'The numerical gradient is slow, approximate, and hard to get wrong. The analytic gradient is fast, exact, and easy to get wrong.' },
        { id: 'use', say: 'Use the analytic one for training, and the numerical one to check it.' },
      ],
    },
    {
      id: 'descent',
      title: 'Gradient descent',
      codeTitle: 'gradient_descent.py',
      code: `
        while True:
            dW = evaluate_gradient(                #@grad
                L, X_train, y_train, W)            #@grad
            W += -step_size * dW   # a small step  #@update

        # a valley, c times steeper across         #@valley
        c = 10                                     #@valley
        def L(W):                                  #@valley
            return 0.5 * (W[0]**2 + c * W[1]**2)   #@valley
        def dL(W):                                 #@valley
            return np.array([W[0], c * W[1]])      #@valley
        W = np.array([-4.2, 1.6])
        step_size = {{lr:0.05}}                      #@lr
        for it in range(60):     # it = {{it:0}}     #@run
            W += -step_size * dL(W)                #@run
      `,
      beats: [
        { id: 'simple', say: 'With the gradient in hand, the procedure is almost embarrassingly simple.' },
        { id: 'loop', say: 'Compute the gradient. Take a small step against it. Repeat.', code: ['grad', 'update'] },
        { id: 'why', say: 'Why small? The gradient only says which way is downhill right here. A little further on, the ground may tilt differently.', code: 'grad' },
        { id: 'eta', say: 'How far to step is set by the step size, eta, or learning rate: the most important knob in training a network.', code: 'update' },
        { id: 'valley', say: 'Watch it on a long, narrow valley: steep across, nearly flat along. Real loss landscapes are full of these.', code: 'valley' },
        { id: 'crawl', say: 'With a tiny step size, the path creeps. After sixty steps, it is still far from the bottom.', code: ['lr', 'run'] },
        { id: 'smooth', say: 'Around {0.05|zero point zero five}, it drops into the valley, and glides along the floor to the bottom.', code: ['lr', 'run'] },
        { id: 'zigzag', say: 'Bigger, and it overshoots the steep direction on every step, zig-zagging from wall to wall, though the bounces shrink.', code: ['lr', 'run'] },
        { id: 'diverge', say: 'Bigger still, and every bounce is larger than the last. The loss explodes.', code: ['lr', 'run'] },
        { id: 'thresh', say: 'This valley is ten times steeper across. Past a step size of {0.1|zero point one}, the path zig-zags. Past {0.2|zero point two}, it diverges.', code: 'valley' },
        { id: 'limit', say: 'The steep direction sets the speed limit for every direction. That is why narrow valleys are slow.' },
        { id: 'tune', say: 'There is no formula for the right step size. You find it by experiment.' },
      ],
    },
    {
      id: 'minibatch',
      title: 'Mini-batches',
      codeTitle: 'minibatch_gd.py',
      code: `
        while True:
            idx = np.random.choice(                #@pick
                N, batch_size, replace=False)      #@pick
            X_batch = X_train[idx]                 #@pick
            y_batch = y_train[idx]                 #@pick
            dW = evaluate_gradient(                #@grad
                L, X_batch, y_batch, W)            #@grad
            W += -step_size * dW                   #@update

        # looked at: full {{nf:0}}, mini {{nm:0}}      #@work
        # batch_size: 32, 64, 128, 256, ...        #@pow
        # whatever fits in memory                  #@pow
        # batch_size = 1: stochastic GD, "SGD"     #@sgd
      `,
      beats: [
        { id: 'avg', say: 'One last problem. The loss averages over the whole training set, and so does its gradient: computing it exactly means visiting every example, every step.' },
        { id: 'imagenet', say: 'For the ImageNet challenge, with {1.2 million|one point two million} training images, that is extremely wasteful.' },
        { id: 'batch', say: 'The fix: estimate the gradient from a small random sample, a mini-batch. Say, {256|two hundred and fifty six} images out of the {1.2 million|one point two million}.', code: 'pick' },
        { id: 'code', say: 'Each step draws a fresh batch, computes the gradient on just those examples, and steps.', code: ['pick', 'grad', 'update'] },
        { id: 'poll', say: 'Like a poll of a few hundred voters standing in for a whole country, it is right on average, and close most of the time.', code: 'grad' },
        { id: 'trade', say: 'It is a little noisy, but thousands of times cheaper: thousands of wobbly steps in the time of one perfect one.' },
        { id: 'race', say: 'Back on our slice: full batch, in teal, uses all three hundred points per step. Mini-batch, in orange, uses four. It wobbles, but heads the same way.', code: 'work' },
        { id: 'work', say: 'Now count the work. For any number of examples looked at, the mini-batch run is far ahead.', code: 'work' },
        { id: 'redundant', say: 'Why does it work so well? Partly because data is redundant. Imagine the {1.2 million|one point two million} images were copies of just a thousand.' },
        { id: 'copies', say: 'Then the gradient from those thousand would equal the full one exactly. Real data is not that redundant, but redundant enough.' },
        { id: 'pow', say: 'Batch sizes are usually powers of two, like {32|thirty two} or {256|two hundred and fifty six}, mostly set by what fits in memory.', code: 'pow' },
        { id: 'sgd', say: 'With a batch of one, it is called stochastic gradient descent, or SGD. In practice, people say SGD for mini-batches too.', code: 'sgd' },
        { id: 'stoch', say: 'Stochastic is a formal word for random: each step\'s gradient comes from randomly chosen examples.', code: 'sgd' },
      ],
    },
    {
      id: 'summary',
      title: 'The whole pipeline',
      codeTitle: 'train.py',
      code: `
        for it in range(num_iters):
            idx = np.random.choice(N, batch_size)  #@batch
            X_batch = X_train[idx]                 #@batch
            y_batch = y_train[idx]                 #@batch
            # score function                       #@score
            scores = X_batch.dot(W.T)              #@score
            # loss function                        #@loss
            loss = L(W, X_batch, y_batch, reg)     #@loss
            # gradient                             #@grad
            dW = grad_L(W, X_batch, y_batch, reg)  #@grad
            # update                               #@update
            W += -step_size * dW                   #@update
      `,
      beats: [
        { id: 'four', say: 'Putting it all together: four pieces make the whole training loop.' },
        { id: 'score', say: 'A score function maps an input to class scores.', code: 'score' },
        { id: 'loss', say: 'A loss function grades those scores with one number.', code: 'loss' },
        { id: 'grad', say: 'The gradient says which way is uphill for every weight: analytic for speed, numerical to check.', code: 'grad' },
        { id: 'update', say: 'And the update steps the weights downhill, usually one mini-batch at a time.', code: ['batch', 'update'] },
        { id: 'rest', say: 'The rest of the course plugs into this loop. Neural networks swap in a richer score function, and the loop stays the same.', code: 'score' },
        { id: 'hard', say: 'What changes is the gradient. Deriving it by hand, as we did for the SVM, would be hopeless for a deep network.', code: 'grad' },
        { id: 'backprop', say: 'The next chapter introduces backpropagation: the chain rule, applied piece by piece, to get the gradient of anything built from simple parts.', code: 'grad' },
        { id: 'recap', say: 'So: training is optimization. The loss is a landscape, the gradient points uphill, and we step against it, one mini-batch at a time.', pause: 0.6 },
      ],
    },
  ],
};

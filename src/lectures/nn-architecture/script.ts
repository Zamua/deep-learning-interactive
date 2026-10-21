import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'nn-architecture',
  title: 'Neural networks: the architecture',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'Beyond straight walls',
      codeTitle: 'from_linear.py',
      code: `
        # Chapter 4: one matrix multiply
        scores = W.dot(x)                    #@lin

        # this chapter: two, with a bend between
        h = np.maximum(0, W1.dot(x))         #@nn
        scores = W2.dot(h)                   #@nn

        # trained with backprop (Chapter 6)
        loss.backward()   # dW1, dW2         #@bp
      `,
      beats: [
        { id: 'hello', say: 'Welcome to neural networks. In this chapter, we finally build one.' },
        { id: 'recap', say: 'Remember the linear classifier from Chapter 4: one matrix multiply, W times x.', code: 'lin' },
        { id: 'walls', say: 'Its boundaries are straight walls, and on these three classes, wound into a spiral, straight walls get only about half the points right.', code: 'lin' },
        { id: 'horse', say: 'Images hit the same limit. One template per class cannot say: a horse facing left, or a horse facing right.' },
        { id: 'fix', say: 'The fix is the neural network, built from pieces you already have: matrix multiplies, a simple bend between them, and backprop to train it all.', code: ['nn', 'bp'] },
        { id: 'bent', say: 'Same spiral, small network. The walls bend to follow the arms.', code: 'nn' },
        { id: 'plan', say: 'First the plain math, then the brain analogy behind the name, then the design choices: which activation, how many layers, and how wide.' },
      ],
    },
    {
      id: 'two-layer',
      title: 'Two multiplies and a max',
      codeTitle: 'two_layer.py',
      code: `
        x = image.reshape(3072)          # (3072,)  #@x
        W1 = 0.01 * np.random.randn(100, 3072)      #@W1
        W2 = 0.01 * np.random.randn(10, 100)        #@W2
        h = np.maximum(0, W1.dot(x))     # (100,)   #@h
        scores = W2.dot(h)               # (10,)    #@s
      `,
      beats: [
        { id: 'formula', say: 'A two layer neural network does two multiplies instead of one, with a very simple function in between.' },
        { id: 'x', say: 'Flatten an image into a vector of {3,072|three thousand and seventy two} numbers.', code: 'x' },
        { id: 'w1', say: 'The first matrix, {W1|W one}, has a hundred rows, each a template, as in a linear classifier. Out come a hundred numbers.', code: ['W1', 'h'] },
        { id: 'max', say: 'Now the bend: the max of zero and each number. Negatives become zero, positives pass straight through.', code: 'h' },
        { id: 'hidden', say: 'What survives is the hidden layer, h: a hundred features the network computes for itself.', code: 'h' },
        { id: 'w2', say: 'A second matrix, {W2|W two}, combines them into ten class scores.', code: ['W2', 's'] },
        { id: 'or', say: 'Now the network can say or: this is a horse if template seventeen fires, or if template forty two fires.', code: 's' },
        { id: 'learned', say: 'Both matrices are learned by gradient descent and backprop. The hundred is our choice: a hyperparameter.', code: ['W1', 'W2'] },
        { id: 'bias', say: 'Real layers also add a bias vector, left out here to keep the picture clean.' },
      ],
    },
    {
      id: 'collapse',
      title: 'Why the bend matters',
      codeTitle: 'collapse.py',
      code: `
        W = W2.dot(W1)          # (10, 3072)   #@W
        two = W2.dot(W1.dot(x))                        #@two
        np.allclose(two, W.dot(x))     # True          #@true
        bent = W2.dot(np.maximum(0, W1.dot(x)))        #@bent
        np.allclose(bent, W.dot(x))    # False         #@false

        # a toy: one input, three hidden units
        z = W1 * x + b1          # three lines         #@z
        h = np.maximum(0, z)     # three hinges        #@hinge
        y = W2.dot(h)            # weighted sum  #@sum
      `,
      beats: [
        { id: 'why', say: 'Why bother with the max? What if we leave it out?' },
        { id: 'assoc', say: 'Then it computes {W2|W two} times {W1|W one} times x, and we can move the brackets.' },
        { id: 'one', say: '{W2|W two} times {W1|W one} is just another matrix, ten by {3,072|three thousand and seventy two}. Call it W.', code: 'W' },
        { id: 'disguise', say: 'So the network collapses into one linear classifier in disguise. NumPy agrees: the answers match exactly.', code: ['two', 'true'] },
        { id: 'with', say: 'Put the max back, and they no longer match.', code: ['bent', 'false'] },
        { id: 'toy', say: 'To see what the max buys, shrink it down: one input, three hidden units, one output.', code: 'z' },
        { id: 'lines', say: 'Each hidden unit computes a straight line of x. The max folds it at zero into a hinge: flat on one side, sloped on the other.', code: ['z', 'hinge'] },
        { id: 'sum', say: 'Add the hinges with the output weights, and the result bends wherever a hinge does.', code: 'sum' },
        { id: 'straight', say: 'Without the max, a sum of lines is just a line, with no bend. More hidden units, more bends: that is how a network curves its boundaries.', code: 'sum' },
        { id: 'three', say: 'A three layer network repeats the pattern: multiply, bend, multiply, bend, multiply.' },
      ],
    },
    {
      id: 'neuron',
      title: 'A neuron, loosely',
      codeTitle: 'neuron.py',
      code: `
        def neuron(inputs, w, b):                    #@in
            weighted = inputs * w  # at synapses      #@w
            cell_body_sum = np.sum(weighted) + b      #@sum
            firing_rate = sigmoid(cell_body_sum)      #@fire
            return firing_rate                        #@fire

        def sigmoid(z):                               #@sig
            return 1.0 / (1.0 + np.exp(-z))           #@sig
      `,
      beats: [
        { id: 'name', say: 'The field began by modeling the brain, and the vocabulary stuck.' },
        { id: 'cell', say: 'The basic computing cell of the nervous system is the neuron. A human brain has about eighty six billion of them.' },
        { id: 'syn', say: 'They are wired together by {10¹⁴ to 10¹⁵|a hundred trillion to a quadrillion} connections, called synapses.' },
        { id: 'parts', say: 'A neuron gathers signals through branching dendrites, and sends its own down one long axon, which branches to other neurons.' },
        { id: 'model', say: 'The classic model turns this into arithmetic.', code: 'in' },
        { id: 'mul', say: 'A signal x crossing a synapse is multiplied by its strength, a weight w: positive to excite, negative to inhibit. Learning adjusts these weights.', code: 'w' },
        { id: 'sum', say: 'The cell body adds up the weighted inputs, plus a bias: a dot product.', code: 'sum' },
        { id: 'fire', say: 'If the total is high enough, the neuron fires. The model keeps only the firing rate, computed by an activation function, f.', code: 'fire' },
        { id: 'sig', say: 'Historically, that was the sigmoid, squashing any total into a rate between zero and one.', code: 'sig' },
        { id: 'coarse', say: 'But this model is very coarse. Real neurons come in many types, dendrites compute on their own, and spike timing matters.' },
        { id: 'math', say: 'So treat the brain as loose inspiration. A neural network is a mathematical function.' },
      ],
    },
    {
      id: 'one-neuron',
      title: 'One neuron is a linear classifier',
      codeTitle: 'one_neuron.py',
      code: `
        def neuron(x, w, b):                  #@def
            score = w.dot(x) + b              #@def
            return 1 / (1 + np.exp(-score))   #@def

        w, b = np.array([{{w0:1.6}}, {{w1:-0.6}}]), {{b:0.3}}   #@wb
        p1 = neuron(x, w, b)    # P(y = 1 | x)          #@p1
        loss = -np.log(p1 if y == 1 else 1 - p1)        #@loss
        predicted = 1 if p1 > 0.5 else 0                #@pred
        # loss {{loss:1.05}}   accuracy {{acc:17%}}

        dw = dw_data + reg * w      # the L2 term       #@reg
        w -= lr * dw                                    #@reg
        # regrouped: shrink first, then the data       #@forget
        w = (1 - lr * reg) * w - lr * dw_data           #@forget
      `,
      beats: [
        { id: 'known', say: 'With the right loss attached, one neuron is already a classifier you know.' },
        { id: 'score', say: 'Its weighted sum, w dot x plus b, is a linear score. Here, w is an arrow, and the score grows in the direction it points.', code: 'def' },
        { id: 'sig', say: 'The sigmoid squashes the score into the probability of class one: orange where the neuron is sure, blue where it is sure of class zero.', code: ['def', 'p1'] },
        { id: 'train', say: 'Train it with the cross entropy loss, minus the log probability of the right class, and the arrow swings around to fit.', code: ['wb', 'loss'] },
        { id: 'logreg', say: 'This is logistic regression, the two class softmax classifier from Chapter 4. With a hinge loss instead, it is a binary support vector machine.', code: ['p1', 'loss'] },
        { id: 'pred', say: 'Either way, it predicts class one exactly when the score is positive. The boundary is the straight line where the score is zero.', code: 'pred' },
        { id: 'reg', say: 'One more look, at regularization. The {L2|L two} penalty adds lambda times w to each weight\'s gradient.', code: 'reg' },
        { id: 'regroup', say: 'Regroup the update: each step first multiplies every weight by a number just below one, then applies what the data asks for.', code: 'forget' },
        { id: 'forget', say: 'Here, that number is {0.995|zero point nine nine five}. Switch off the data, and the arrow shrinks, the boundary blurs: the neuron slowly forgets.', code: 'forget' },
        { id: 'keep', say: 'Weights the data keeps reinforcing survive, the rest decay: regularization is gradual forgetting.' },
      ],
    },
    {
      id: 'squash',
      title: 'Sigmoid and tanh',
      codeTitle: 'activation_gates.py',
      code: `
        z = {{z:0.0}}          # input: w.x + b         #@z
        dout = 1.0          # gradient from above     #@z
        # sigmoid
        out = 1 / (1 + np.exp(-z))                    #@sig
        dz = out * (1 - out) * dout   # {{dsig:0.25}}      #@dsig
        # tanh
        out = np.tanh(z)                              #@tanh
        dz = (1 - out**2) * dout      # {{dtanh:1}}      #@dtanh

        dout = -0.8                                   #@pos
        x = np.array([0.9, 0.2, 0.6])  # all > 0  #@pos
        dw = x * dout     # [-0.72, -0.16, -0.48]     #@same
      `,
      beats: [
        { id: 'why', say: 'Every neuron applies a fixed nonlinearity, and the choice matters: in backprop, the gradient through a neuron is multiplied by its local slope.', code: 'dsig' },
        { id: 'sig', say: 'First, the sigmoid, the classic choice. It squashes any input into zero to one, like a firing rate.', code: 'sig' },
        { id: 'tails', say: 'Push z out to five, and the curve is nearly flat. Its slope is {0.007|zero point zero zero seven}, so the gradient from above is cut to under one percent.', code: ['z', 'dsig'] },
        { id: 'peak', say: 'Even at its steepest, in the middle, the slope is only a quarter.', code: 'dsig' },
        { id: 'sat', say: 'A saturated neuron passes almost no gradient back, so learning stalls. And weights that start too large saturate most neurons at once.' },
        { id: 'center', say: 'Second, sigmoid outputs are always positive, so the next layer only ever sees positive inputs.', code: 'pos' },
        { id: 'same', say: 'Each weight\'s gradient is its input times one shared number. With all positive inputs, every weight gradient has the same sign.', code: 'same' },
        { id: 'zig', say: 'So the weights all rise together, or all fall. A mixed target takes a zig zag.' },
        { id: 'tanh', say: '{Tanh|Tan h} fixes that. It squashes into minus one to one, centered on zero: a stretched, shifted sigmoid.', code: 'tanh' },
        { id: 'still', say: 'But it still has flat tails, so it still saturates. Even so, always prefer {tanh|tan h} over the sigmoid.', code: 'dtanh' },
      ],
    },
    {
      id: 'relu',
      title: 'ReLU and its cousins',
      codeTitle: 'relu.py',
      code: `
        # ReLU
        out = np.maximum(0, z)                     #@relu
        dz = (z > 0) * dout                        #@drelu
        # Leaky ReLU
        out = np.where(z > 0, z, 0.01 * z)         #@leaky
        dz = np.where(z > 0, 1.0, 0.01) * dout     #@leaky
        # Maxout: the larger of two linear pieces
        out = np.maximum(w1.dot(x) + b1,           #@maxout
                         w2.dot(x) + b2)           #@maxout

        Z = X.dot(W1) + b1    # (N, H)             #@dead
        dead = np.all(Z <= 0, axis=0)              #@dead
        print(dead.mean())    # fraction dead      #@dead
      `,
      beats: [
        { id: 'relu', say: 'Now the modern default: the rectified linear unit, ReLU. Zero for negative inputs, the input itself for positive ones.', code: 'relu' },
        { id: 'rect', say: 'Rectified is an electronics word: a rectifier lets current through one way only. {ReLU|ray-loo} passes positive inputs and blocks negative ones.', code: 'relu' },
        { id: 'fast', say: 'It makes gradient descent converge much faster: about six times, in Krizhevsky\'s {2012|twenty twelve} network.' },
        { id: 'why', say: 'Its right half never saturates, and it is cheap: a comparison, not an exponential.', code: 'drelu' },
        { id: 'die', say: 'The catch: ReLU units can die. Each dot is this unit\'s input on one example. Dots right of zero pass gradient back. Dots left pass nothing.', code: 'drelu' },
        { id: 'shove', say: 'Now one large update shoves the weights, so the input is negative for every example.' },
        { id: 'dead', say: 'From then on it outputs zero and passes zero gradient, for every example, forever. With too high a learning rate, up to forty percent of a network can die.', code: 'dead' },
        { id: 'leaky', say: 'Leaky ReLU gives the negative side a small slope, like {0.01|zero point zero one}, so a unit is never fully off. Results are mixed.', code: 'leaky' },
        { id: 'maxout', say: 'Maxout goes further: each neuron computes two linear functions, and outputs the larger.', code: 'maxout' },
        { id: 'special', say: 'ReLU is the special case with one piece fixed at zero. So maxout keeps the good parts and never dies, at twice the parameters.', code: 'maxout' },
        { id: 'advice', say: 'The advice: use ReLU, mind the learning rate, and watch for dead units.', code: 'dead' },
        { id: 'else', say: 'If units die, try leaky ReLU or maxout. {Tanh|Tan h} is worth a try, but expect worse. And never use the sigmoid in hidden layers.' },
      ],
    },
    {
      id: 'layers',
      title: 'Layers, and counting',
      codeTitle: 'count_params.py',
      code: `
        sizes = [{{sizes:3, 4, 2}}]                       #@sizes
        layers = len(sizes) - 1        # {{L:2}}          #@L
        n_in, n_out = sizes[:-1], sizes[1:]
        neurons = sum(n_out)           # {{neurons:6}}    #@neurons
        weights = np.dot(n_in, n_out)  # {{weights:20}}   #@weights
        biases = neurons               # {{biases:6}}     #@biases
        params = weights + biases      # {{params:26}}    #@params
      `,
      beats: [
        { id: 'org', say: 'Networks are organized into layers, each feeding the next, with no cycles.' },
        { id: 'fc', say: 'The common kind is fully connected: each neuron connects to every neuron in the layer before.' },
        { id: 'count', say: 'A naming trap: an N layer network does not count the input. With a hidden layer and an output layer, this one is a two layer network.', code: ['sizes', 'L'] },
        { id: 'single', say: 'A single layer network maps inputs straight to outputs, like logistic regression or the SVM.' },
        { id: 'out', say: 'And the output layer usually has no activation: its scores can be any real numbers.' },
        { id: 'params', say: 'Now count what it learns. Each line is a weight: three times four, plus four times two, is twenty. Plus six biases, one per neuron: twenty six parameters.', code: ['weights', 'biases', 'params'] },
        { id: 'deeper', say: 'Add a second hidden layer of four, and one output. Twelve plus sixteen plus four is thirty two weights, plus nine biases: forty one.', code: ['sizes', 'weights', 'biases', 'params'] },
        { id: 'scale', say: 'For scale, the convolutional networks later in the course have about a hundred million parameters, across ten to twenty layers.' },
      ],
    },
    {
      id: 'forward',
      title: 'The forward pass',
      codeTitle: 'forward.py',
      code: `
        # f: the sigmoid                               #@f
        f = lambda z: 1.0 / (1.0 + np.exp(-z))         #@f
        # W1: (4, 3)  W2: (4, 4)  W3: (1, 4)               #@shapes
        x = np.array([0.5, -1.2, 0.8])     # (3,)          #@in
        h1 = f(np.dot(W1, x) + b1)         # (4,)          #@l1
        h2 = f(np.dot(W2, h1) + b2)        # (4,)          #@l2
        scores = np.dot(W3, h2) + b3       # (1,)          #@l3
        # h1 = {{h1:…}}
        # h2 = {{h2:…}}
        # scores = {{s:…}}
      `,
      beats: [
        { id: 'payoff', say: 'Layers pay off in practice: a whole layer is one matrix multiply.' },
        { id: 'rows', say: 'Stack layer one\'s neuron weights as the rows of a matrix, {W1|W one}, and their biases in a vector, {b1|b one}.', code: 'shapes' },
        { id: 'line', say: 'Then one line, f of {W1|W one} times x, plus {b1|b one}, computes every neuron\'s sum at once, and applies the activation to each entry.', code: ['f', 'l1'] },
        { id: 'input', say: 'Here is a three layer network with real weights: blue wires positive, red negative, thicker for larger. The input is three numbers.', code: 'in' },
        { id: 'l1', say: 'Layer one: each hidden neuron sums its weighted inputs, adds its bias, and applies the sigmoid. One dot product does all four.', code: 'l1' },
        { id: 'l2', say: 'Layer two does the same, reading the outputs of layer one.', code: 'l2' },
        { id: 'l3', say: 'The output layer is a weighted sum plus a bias, with no activation. That number is the score.', code: 'l3' },
        { id: 'batch', say: 'That is the whole forward pass. If x holds a batch of examples as columns, the same lines handle them all at once.', code: ['l1', 'l2', 'l3'] },
        { id: 'learn', say: 'What makes it useful is the right weights and biases. Learning them is the rest of the course.' },
      ],
    },
    {
      id: 'power',
      title: 'Representational power',
      codeTitle: 'bumps.py',
      code: `
        sig = lambda z: 1 / (1 + np.exp(-z))
        def target(x):
            return (0.5 + 0.3 * np.sin(8 * x)
                    + 0.15 * np.sin(25 * x))

        n = {{n:6}}               # bumps              #@nk
        k = 10 * n            # steepness          #@nk
        edges = np.linspace(-0.1, 1.1, n + 1)      #@edges
        mid = (edges[:-1] + edges[1:]) / 2         #@edges
        heights = target(mid)                      #@edges

        def g(x):         # 2n hidden sigmoids     #@g
            up = sig(k * (x - edges[:-1]))         #@up
            down = sig(k * (x - edges[1:]))        #@down
            return heights.dot(up - down)          #@sum
        # units {{units:12}}   worst error {{err:…}}
      `,
      beats: [
        { id: 'family', say: 'A network of fixed shape is a whole family of functions, one per setting of its weights. How rich is that family?' },
        { id: 'rich', say: 'Remarkably rich. One hidden layer with enough neurons can approximate any continuous function as closely as you like. That is the universal approximation theorem.' },
        { id: 'target', say: 'Let us build one by hand. Here is a wiggly target.' },
        { id: 'step', say: 'A steep sigmoid is a step: it jumps from zero to one at a point, a.', code: 'up' },
        { id: 'bump', say: 'Subtract a second step at b, and you get a bump: one between a and b, zero elsewhere.', code: ['up', 'down'] },
        { id: 'stack', say: 'Chop the range into six pieces, give each bump the target\'s height there, and add them up: a network with twelve hidden sigmoids.', code: ['edges', 'g', 'sum'] },
        { id: 'more', say: 'More bumps, and the staircase hugs the target ever closer. The error goes as low as you like.', code: 'nk' },
        { id: 'weak', say: 'But can represent is a weak promise. It says nothing about how many units you need, or whether gradient descent finds them.' },
        { id: 'deep', say: 'In practice, depth helps: deeper networks fit real data compactly and train well. Still, fully connected networks rarely gain beyond three layers.' },
        { id: 'hier', say: 'Convolutional networks are the exception: depth is crucial there, perhaps because images are hierarchical. Faces are made of eyes and noses, which are made of edges and blobs.' },
      ],
    },
    {
      id: 'capacity',
      title: 'How big should it be?',
      codeTitle: 'capacity.py',
      code: `
        H = {{H:1}}                  # hidden neurons   #@H
        W1 = np.random.randn(2, H)                   #@H
        W2 = np.random.randn(H, {{C:3}})                 #@H
        W2 *= np.sqrt(2.0 / H)       # He init          #@H

        for step in range({{steps:1500}}):                    #@loop
            h = np.maximum(0, X.dot(W1) + b1)             #@fwd
            scores = h.dot(W2) + b2                       #@fwd
            grads = backprop(scores, y, reg={{reg:1e-3}})     #@bwd
            adam_update(params, grads, lr=0.03)           #@bwd
        # train {{tr:…}}   held-out {{te:–}}                #@acc
      `,
      beats: [
        { id: 'q', say: 'So how big should a network be?' },
        { id: 'cap', say: 'More neurons means more capacity. Here is a two layer network on the spiral, with one hidden neuron.', code: ['H', 'loop'] },
        { id: 'one', say: 'One or two neurons can only crease the plane a couple of times, and accuracy stalls well short of a hundred percent.', code: ['H', 'acc'] },
        { id: 'four', say: 'With four, the boundary starts winding along the arms. With eight, it gets nearly every point right.', code: ['H', 'acc'] },
        { id: 'crease', say: 'The boundary is made of straight pieces, creased where hidden units switch on or off. That is ReLU at work.', code: 'fwd' },
        { id: 'cuts', say: 'But capacity cuts both ways. Here is a disc of one class inside another, with twelve percent of the labels flipped.' },
        { id: 'islands', say: 'A big network, fifty neurons with almost no regularization, carves little islands around the mislabeled points.', code: ['H', 'bwd'] },
        { id: 'overfit', say: 'That is overfitting: nearly perfect on training data, worse on anything new.', code: 'acc' },
        { id: 'small', say: 'A small network paints in broad strokes and ignores the odd point. So should we play it safe, with small networks?', code: ['H', 'acc'] },
      ],
    },
    {
      id: 'big-nets',
      title: 'Big networks, held in check',
      codeTitle: 'regularize.py',
      code: `
        reg = {{reg:0.0001}}     # lambda, 50 hidden ReLUs   #@reg
        reg_loss = 0.5 * reg * (np.sum(W1**2)        #@reg
                                + np.sum(W2**2))     #@reg
        # train {{tr:…}}   held-out {{te:…}}              #@acc

        for H in [3, 5, 8, 30]:                      #@H
            for seed in range(10):                   #@seed
                np.random.seed(seed)                 #@seed
                net = TwoLayerNet(2, H, 3)           #@seed
                final[H].append(net.train(X, y))     #@train
      `,
      beats: [
        { id: 'wrong', say: 'No. That conclusion is wrong, for two reasons.' },
        { id: 'tools', say: 'First, there are better tools against overfitting than shrinking: {L2|L two} regularization, dropout, and input noise.', code: 'reg' },
        { id: 'same', say: 'Same fifty neuron network, same start, with lambda raised to {0.01|zero point zero one}. The islands melt, and the boundary settles toward the true circle.', code: 'reg' },
        { id: 'acc', say: 'Training accuracy falls, since it stops memorizing noise, but held out accuracy rises. Push lambda much higher, and it underfits.', code: 'acc' },
        { id: 'second', say: 'Second, and subtler: small networks are harder to train with gradient descent.' },
        { id: 'lottery', say: 'Train ten networks of each size from ten random starts, and plot each final loss.', code: ['H', 'seed', 'train'] },
        { id: 'spread', say: 'With three hidden neurons, the results scatter: some starts do well, others get stuck. With thirty, all ten land at the same low loss.', code: 'train' },
        { id: 'minima', say: 'Small networks have fewer local minima, but many are bad. Big ones have more, nearly all equally good, so they do not depend on luck.' },
        { id: 'rule', say: 'So the rule: use as big a network as your budget allows, and control overfitting with regularization, tuned on validation data.', code: 'reg' },
      ],
    },
    {
      id: 'outro',
      title: 'The architecture, in one breath',
      codeTitle: 'network.py',
      code: `
        h1 = np.maximum(0, W1.dot(x) + b1)        #@l1
        h2 = np.maximum(0, W2.dot(h1) + b2)       #@l2
        scores = W3.dot(h2) + b3    # no f here   #@l3
        # every W and b: learned by backprop      #@train
      `,
      beats: [
        { id: 'stack', say: 'To recap: a neural network is layers of multiply, bias and nonlinearity. Without the nonlinearity, it collapses to a linear classifier.', code: ['l1', 'l2'] },
        { id: 'neuron', say: 'The brain lent us the name, but the model is a cartoon, and one neuron is a linear classifier.' },
        { id: 'relu', say: 'ReLU is the default activation. Sigmoids saturate, and are not centered on zero.', code: ['l1', 'l2'] },
        { id: 'count', say: 'We never count the input layer, the output layer has no activation, and parameters are weights plus biases.', code: 'l3' },
        { id: 'power', say: 'One hidden layer can approximate anything, but depth helps. And prefer big networks, kept honest by regularization.', code: 'train' },
        { id: 'next', say: 'Next, how to make these networks train well: how to prepare the data, where to start the weights, and how to keep a big one honest.', pause: 0.6 },
      ],
    },
  ],
};

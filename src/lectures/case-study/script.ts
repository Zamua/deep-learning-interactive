import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'case-study',
  title: 'Putting it together: the spiral',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'Forty lines of NumPy',
      codeTitle: 'the_plan.py',
      code: `
        N, D, K = 100, 2, 3     # 300 points    #@data

        # model 1: a softmax linear classifier  #@lin
        scores = np.dot(X, W) + b               #@lin

        # model 2: add one hidden layer         #@net
        hidden_layer = np.maximum(              #@net
            0, np.dot(X, W) + b)                #@net
        scores = np.dot(hidden_layer, W2) + b2  #@net

        # both learn with the same loop:        #@loop
        # scores, loss, gradient, update        #@loop
      `,
      beats: [
        { id: 'hello', say: 'Welcome to the case study, where everything from the last few chapters comes together.' },
        { id: 'forty', say: 'Scores, the softmax loss, backpropagation, gradient descent: it all fits in about forty lines of NumPy, and we will write every one.' },
        { id: 'data', say: 'The data is a toy: three hundred points in a flat plane, in three colors, wound into a spiral.', code: 'data' },
        { id: 'why2d', say: 'Two dimensions are the point: with images we only get a loss curve, but in a plane we can see exactly what each model learned.', code: 'data' },
        { id: 'lin', say: 'First, a softmax linear classifier. Its loss goes down, and it still gets only about half the points right.', code: 'lin' },
        { id: 'why', say: 'That failure is instructive: every edge it can draw is a straight line.', code: 'lin' },
        { id: 'net', say: 'Then a handful of changed lines add one hidden layer, and the same training gets almost every point right.', code: 'net' },
        { id: 'loop', say: 'Both models learn with the same four-step loop: compute the scores, measure the loss, backpropagate the gradient, and step downhill.', code: 'loop' },
        { id: 'go', say: 'Let us start with the data.' },
      ],
    },
    {
      id: 'data',
      title: 'The data: a spiral',
      codeTitle: 'spiral.py',
      code: `
        N = 100   # points per class             #@N
        D = 2     # dimensionality               #@N
        K = 3     # number of classes            #@N
        X = np.zeros((N * K, D))    # (300, 2)    #@alloc
        y = np.zeros(N * K, dtype='uint8')       #@alloc
        for j in range(K):                       #@loop
            ix = range(N * j, N * (j + 1))       #@loop
            r = np.linspace(0.0, 1, N)  # radius  #@r
            t = np.linspace(j * 4, (j + 1) * 4, N)  #@t
            t += np.random.randn(N) * 0.2        #@noise
            X[ix] = np.c_[r * np.sin(t),         #@xy
                          r * np.cos(t)]         #@xy
            y[ix] = j                            #@lab
      `,
      beats: [
        { id: 'shape', say: 'There are K equals three classes, with N equals one hundred points each, and every point is two numbers, so D equals two.', code: 'N' },
        { id: 'rows', say: "So X has three hundred rows and two columns, and y holds each row's class: zero, one or two.", code: 'alloc' },
        { id: 'loop', say: 'Each class is one arm of the spiral, and a loop builds the arms one at a time.', code: 'loop' },
        { id: 'polar', say: "The recipe is polar coordinates: a distance from the center, and a direction.", code: ['r', 't'] },
        { id: 'r', say: 'The distance r grows evenly from zero to one, so each arm starts at the center and ends at the rim.', code: 'r' },
        { id: 't', say: 'Meanwhile the angle t turns: arm j starts at four j radians and sweeps four more, a bit under two thirds of a turn.', code: 't' },
        { id: 'noise', say: 'A little random noise jiggles every angle, so the arm comes out fuzzy.', code: 'noise' },
        { id: 'xy', say: "Sine and cosine turn each distance and angle into the two coordinates: r sine t, and r cosine t.", code: 'xy' },
        { id: 'walk', say: 'Each arm is a walk outward while turning, each starting four radians after the last, so the three arms wind around each other.', code: ['loop', 'xy'] },
        { id: 'lab', say: 'Every point in arm j gets the label j.', code: 'lab' },
        { id: 'cut', say: 'Now try to separate the colors with a straight line. You cannot: any straight cut slices through all three arms.' },
        { id: 'pre', say: 'Real data is usually normalized first, but these points already lie between minus one and one.' },
      ],
    },
    {
      id: 'scores',
      title: 'A linear score function',
      codeTitle: 'scores.py',
      code: `
        W = 0.01 * np.random.randn(D, K)  # (2, 3)   #@W
        b = np.zeros((1, K))              # (1, 3)   #@b

        scores = np.dot(X, W) + b    # (300, 3)      #@scores

        # row 60: x = [0.37, -0.48], y = 0           #@row
        # scores[60]: [0.004, -0.002, 0.006]         #@row
        predicted_class = np.argmax(scores, 1)  #@pred
      `,
      beats: [
        { id: 'params', say: 'A linear classifier has weights W, a matrix with one row per input dimension and one column per class: two by three.', code: 'W' },
        { id: 'init', say: 'We fill W with small random numbers, a hundredth of a standard bell curve, and the bias b with zeros.', code: ['W', 'b'] },
        { id: 'mult', say: 'The scores then come from one matrix multiply: each row of X, dotted with each column of W, gives one score per class.', code: 'scores' },
        { id: 'shapes', say: 'Check the shapes. {300 × 2|Three hundred by two}, times {2 × 3|two by three}, gives {300 × 3|three hundred by three}: three scores for every point.', code: 'scores' },
        { id: 'bcast', say: 'The bias is a single row of three numbers, and NumPy broadcasting stretches it down all three hundred rows.', code: 'scores' },
        { id: 'row', say: 'Follow one point. Row sixty sits at {0.37|zero point three seven}, {-0.48|minus zero point four eight}, in class zero. Its three scores come out tiny, because the weights are tiny.', code: 'row' },
        { id: 'ch4', say: "This is chapter four's score function, with examples stored as rows, so it reads X times W.", code: 'scores' },
        { id: 'pred', say: 'The predicted class of a point is just the class with the highest score.', code: 'pred' },
        { id: 'wedges', say: 'Color every spot in the plane by its winning class, and you see what a linear classifier draws: three wedges with straight edges.', code: 'pred' },
        { id: 'planes', say: 'Each class score is a tilted flat plane over the map, and two flat planes meet along a straight line. Training can turn and shift those lines, never bend them.' },
      ],
    },
    {
      id: 'loss',
      title: 'The softmax loss',
      codeTitle: 'loss.py',
      code: `
        num_examples = X.shape[0]        # 300     #@n
        exp_scores = np.exp(scores)                #@exp
        probs = exp_scores / np.sum(               #@norm
            exp_scores, axis=1, keepdims=True)     #@norm
        correct_logprobs = -np.log(                #@pick
            probs[range(num_examples), y])         #@pick
        data_loss = np.sum(                        #@avg
            correct_logprobs) / num_examples       #@avg
        reg_loss = 0.5 * reg * np.sum(W * W)       #@reg
        loss = data_loss + reg_loss   # {{loss:…}}  #@total
      `,
      beats: [
        { id: 'job', say: 'Next, one number for how badly the scores fit the labels: the softmax loss, also called cross entropy.' },
        { id: 'trained', say: 'To see the steps, take three points, rows sixty, one sixty and two sixty, scored by a classifier that has trained a while.', code: 'n' },
        { id: 'exp', say: 'Step one: exponentiate every score. Whatever a score was, positive or negative, e to that power is always positive.', code: 'exp' },
        { id: 'norm', say: 'Step two: divide each row by its own sum. Now every row is three positive numbers adding up to one: a probability for each class.', code: 'norm' },
        { id: 'pick', say: "Step three: pick each row's probability for the correct class. Indexing with range and y grabs one entry per row.", code: 'pick' },
        { id: 'log', say: 'Then take minus its log: a probability of one costs nothing, and as the probability shrinks toward zero, the cost climbs without limit.', code: 'pick' },
        { id: 'avg', say: 'Average the costs over all three hundred points, and that is the data loss.', code: 'avg' },
        { id: 'reg', say: 'On top goes regularization: half of reg, the strength lambda, times the sum of all the squared weights. The half makes its gradient come out clean.', code: ['reg', 'total'] },
        { id: 'start', say: 'Now a cheap sanity check. At the very start the weights are tiny, so every class gets about one third.', code: 'norm' },
        { id: 'log3', say: 'So every point costs minus the log of a third, which is the log of three, about {1.099|one point zero nine nine}. The first loss should be that number, and it is: {1.096|one point zero nine six}.', code: ['pick', 'total'] },
      ],
    },
    {
      id: 'dscores',
      title: 'The gradient on the scores',
      codeTitle: 'dscores.py',
      code: `
        dscores = probs.copy()                   #@copy
        dscores[range(num_examples), y] -= 1     #@sub
        dscores /= num_examples                  #@div

        # probs   = [0.2,  0.3, 0.5],  y = 1     #@ex
        # dscores = [0.2, -0.7, 0.5]             #@res
      `,
      beats: [
        { id: 'back', say: 'To improve, we need the gradient. Backpropagation starts at the loss and works backward, and its first stop is the scores.' },
        { id: 'formula', say: 'For the softmax loss, it is beautifully simple: for each class k, the probability p k, minus one if k is the correct class.' },
        { id: 'why1', say: 'Why so simple? Write the loss out. Minus the log of that fraction is minus the correct score, plus the log of the sum of all the exponentials.' },
        { id: 'why2', say: 'Now nudge score k. The first part moves only if k is the correct class, and then by minus one. The second part moves by e to the s k, over the sum, which is exactly p k.' },
        { id: 'code', say: "In code: copy the probabilities, then subtract one at each row's correct class.", code: ['copy', 'sub'] },
        { id: 'ex', say: 'Read it as advice. Say the probabilities are {0.2|zero point two}, {0.3|zero point three} and {0.5|zero point five}, and the middle class is the correct one.', code: 'ex' },
        { id: 'res', say: 'The gradient is then {0.2|zero point two}, minus {0.7|zero point seven}, and {0.5|zero point five}.', code: 'res' },
        { id: 'pos', say: 'A positive entry says raising this score raises the loss, so the wrong classes get pushed down, harder the more probability they hold.', code: 'res' },
        { id: 'neg', say: 'The correct class gets a negative entry: raising its score lowers the loss, so it gets pulled up.', code: 'res' },
        { id: 'done', say: 'And a point classified correctly with full confidence has a row of zeros. It has nothing left to teach.', code: ['copy', 'sub'] },
        { id: 'div', say: 'Last, divide by the number of examples, because the loss was an average over all of them.', code: 'div' },
      ],
    },
    {
      id: 'backprop',
      title: 'Into W and b, then one step',
      codeTitle: 'backprop_linear.py',
      code: `
        dW = np.dot(X.T, dscores)    # (2, 3)    #@dW
        db = np.sum(dscores, axis=0,             #@db
                    keepdims=True)   # (1, 3)    #@db
        dW += reg * W   # from 0.5 * reg * W**2  #@reg

        W += -step_size * dW                     #@upd
        b += -step_size * db                     #@upd
      `,
      beats: [
        { id: 'carry', say: 'Now carry the gradient one step further back, from the scores into W and b.' },
        { id: 'rule', say: 'The scores were X times W, plus b. For a matrix multiply, chapter six gave the rule: the gradient on W is the input, transposed, times the gradient flowing back.', code: 'dW' },
        { id: 'shapes', say: 'No need to memorize where the transpose goes: {dW|d W} must be two by three, like W, and only X transposed, times {dscores|d scores}, comes out that shape.', code: 'dW' },
        { id: 'votes', say: 'In words: every point casts a vote on how to change the weights, scaled by its own coordinates, and the votes add up.', code: 'dW' },
        { id: 'db', say: "The bias was added to every row, and gradients add where paths meet, so {db|d b} is the sum of {dscores|d scores} down the rows.", code: 'db' },
        { id: 'reg', say: 'Regularization adds its own piece: the derivative of half of reg times W squared is just reg times W.', code: 'reg' },
        { id: 'upd', say: 'Finally, the update: move every parameter a small step against its gradient, because the gradient points uphill.', code: 'upd' },
        { id: 'gd', say: 'That is plain gradient descent, from chapter five, using all three hundred points in every step, with a step size of one.', code: 'upd' },
        { id: 'one', say: 'And that is one full iteration: scores, loss, gradient, update.' },
      ],
    },
    {
      id: 'train-linear',
      title: 'Training the linear classifier',
      codeTitle: 'train_linear.py',
      code: `
        for i in range(200):                     #@loop
            scores = np.dot(X, W) + b            #@fwd
            # ... softmax loss, as above         #@fwd
            if i % 10 == 0:                      #@print
                print(i, loss)  # {{log:0 1.096}}  #@print
            # ... dscores, dW and db, as above   #@bwd
            W += -step_size * dW                 #@upd
            b += -step_size * db                 #@upd

        scores = np.dot(X, W) + b                #@acc
        predicted_class = np.argmax(scores, 1)  #@acc
        print(np.mean(predicted_class == y))     #@acc
        # training accuracy: {{acc:…}}           #@acc
      `,
      beats: [
        { id: 'wrap', say: 'Wrap those lines in a loop, run it two hundred times, and print the loss every ten iterations.', code: ['loop', 'print'] },
        { id: 'first', say: 'The first loss is {1.096|one point zero nine six}, just as the sanity check predicted.', code: 'print' },
        { id: 'falls', say: 'Then it falls, fast at first, while the colored wedges in the background swing around to chase the arms.', code: ['fwd', 'bwd', 'upd'] },
        { id: 'flat', say: 'After about fifty iterations it levels off near {0.77|zero point seven seven}, and stays there.', code: 'print' },
        { id: 'acc', say: 'Now measure the training accuracy: predict a class for every point, and count how many are right. About {49%|forty nine percent}.', code: 'acc' },
        { id: 'guess', say: 'That beats the thirty three percent of random guessing, but not by much. The ringed points are the ones it gets wrong.', code: 'acc' },
        { id: 'why', say: 'The picture shows why: however its lines turn, a linear classifier only carves the plane into straight edged wedges.' },
        { id: 'arms', say: 'The spiral arms wrap right through those wedges, so each wedge catches pieces of other arms, and more training cannot fix that.' },
        { id: 'bend', say: 'To follow a curve, the boundary itself has to bend, and for that we need a hidden layer.' },
      ],
    },
    {
      id: 'hidden',
      title: 'Adding a hidden layer',
      codeTitle: 'forward_network.py',
      code: `
        h = 100   # size of the hidden layer     #@h
        W = 0.01 * np.random.randn(D, h)         #@W
        b = np.zeros((1, h))                     #@W
        W2 = 0.01 * np.random.randn(h, K)        #@W2
        b2 = np.zeros((1, K))                    #@W2
        # 2*100 + 100 + 100*3 + 3 = 603 numbers  #@count

        hidden_layer = np.maximum(               #@hid
            0, np.dot(X, W) + b)  # (300, 100)   #@hid
        scores = np.dot(hidden_layer, W2) + b2   #@sc
        # loss and dscores: exactly as before    #@same
      `,
      beats: [
        { id: 'ch7', say: 'Chapter seven showed that one hidden layer lets the boundary bend into any shape. So let us add one, with a hundred units.', code: 'h' },
        { id: 'two', say: 'Now there are two sets of weights and biases: W carries the two inputs to a hundred hidden values, and {W2|W two} carries those to the three class scores.', code: ['W', 'W2'] },
        { id: 'count', say: 'That is six hundred and three numbers to learn, instead of nine.', code: 'count' },
        { id: 'lin', say: 'The forward pass gains one line. First, a linear layer just like before: X times W, plus b, a hundred numbers per point.', code: 'hid' },
        { id: 'relu', say: 'Then pass each of them through a {ReLU|ray-loo}, which keeps a positive number as it is, and turns a negative one into zero.', code: 'hid' },
        { id: 'unit', say: 'Watch one hidden unit over the whole plane. Along one straight line, its input is exactly zero.', code: 'hid' },
        { id: 'ramp', say: 'On one side, the unit is off. On the other it switches on and grows steadily, like a ramp rising from a flat floor.', code: 'hid' },
        { id: 'many', say: 'A hundred units make a hundred ramps, each with its own line, tilted and placed by its own weights.', code: 'hid' },
        { id: 'sum', say: 'The second layer adds those ramps up, with different weights for each class. The sum has a crease along every line, so the scores, and the boundary, can bend.', code: 'sc' },
        { id: 'same', say: 'Everything after the scores stays exactly the same: the softmax, the loss, even the gradient on the scores.', code: 'same' },
      ],
    },
    {
      id: 'backprop-net',
      title: 'Backprop through two layers',
      codeTitle: 'backprop_network.py',
      code: `
        # dscores: exactly as before             #@ds
        dW2 = np.dot(hidden_layer.T, dscores)    #@dW2
        db2 = np.sum(dscores, axis=0,            #@dW2
                     keepdims=True)              #@dW2
        dhidden = np.dot(dscores, W2.T)          #@dh
        dhidden[hidden_layer <= 0] = 0           #@relu
        dW = np.dot(X.T, dhidden)   # (2, 100)   #@dW
        db = np.sum(dhidden, axis=0,             #@dW
                    keepdims=True)               #@dW
        dW2 += reg * W2                          #@reg
        dW += reg * W                            #@reg
      `,
      beats: [
        { id: 'longer', say: 'Only the backward pass gets longer, because the gradient has one more layer to travel through.' },
        { id: 'ds', say: 'It starts at the scores, with {dscores|d scores} computed exactly as before.', code: 'ds' },
        { id: 'dW2', say: 'The second layer is a matrix multiply, so its weight gradient follows the same rule as before, with the hidden layer playing the part of X.', code: 'dW2' },
        { id: 'dh', say: 'We also need the gradient flowing into the hidden layer itself: the other half of the matrix multiply rule, {dscores|d scores} times {W2|W two} transposed.', code: 'dh' },
        { id: 'shape', say: 'Three hundred by three, times three by one hundred: one gradient for every hidden value of every point.', code: 'dh' },
        { id: 'slope', say: 'Next comes the {ReLU|ray-loo}. Its slope is one wherever the unit was on, and zero wherever it was clipped to zero.', code: 'relu' },
        { id: 'gate', say: 'So on the way back it is a gate: the gradient passes where the unit was active, and is wiped out elsewhere.', code: 'relu' },
        { id: 'dW', say: 'The first layer is one more matrix multiply. X transposed, times {dhidden|d hidden}, gives {dW|d W}, and summing down the rows gives {db|d b}.', code: 'dW' },
        { id: 'reg', say: 'Both weight matrices get their regularization gradient: reg, times the weights.', code: 'reg' },
        { id: 'rules', say: 'Every line here is a rule from chapter six, applied one layer deeper.' },
      ],
    },
    {
      id: 'train-net',
      title: 'Training the network',
      codeTitle: 'train_network.py',
      code: `
        for i in range(10000):                   #@loop
            hidden_layer = np.maximum(           #@fwd
                0, np.dot(X, W) + b)             #@fwd
            scores = np.dot(hidden_layer, W2) + b2  #@fwd
            # ... loss and dscores, as before    #@loss
            if i % 1000 == 0:                    #@print
                print(i, loss)  # {{log:0 1.099}}  #@print
            # ... dW2, db2, dhidden, dW, db      #@bwd
            W += -step_size * dW                 #@upd
            b += -step_size * db                 #@upd
            W2 += -step_size * dW2               #@upd
            b2 += -step_size * db2               #@upd
        # training accuracy: {{acc:…}}           #@acc
      `,
      beats: [
        { id: 'run', say: 'Now train the network: the same step size of one, the same regularization, the same loop, ten thousand times.', code: 'loop' },
        { id: 'first', say: 'The first loss is {1.099|one point zero nine nine}, the log of three again, because all the scores start out tiny.', code: 'print' },
        { id: 'early', say: "At first the background looks much like the linear classifier's wedges. Then, within the first thousand iterations, the boundary starts to curl.", code: ['fwd', 'bwd', 'upd'] },
        { id: 'follow', say: 'By two or three thousand it winds along the arms, and the rest of the run only polishes it.', code: ['fwd', 'upd'] },
        { id: 'loss', say: 'The loss settles at about a quarter, {0.24|zero point two four}.', code: 'print' },
        { id: 'acc', say: 'And the training accuracy is {99%|ninety nine percent}. Almost every point lands on the right side.', code: 'acc' },
        { id: 'lines', say: "Now draw each hidden unit's line, the place where its input is zero: all one hundred of them.", code: 'fwd' },
        { id: 'poly', say: 'Look closely: the boundary is pieced together from short straight segments of those lines, a polygon winding along each arm.', code: 'fwd' },
        { id: 'crease', say: 'Each {ReLU|ray-loo} puts one crease into the scores, and a hundred creases are plenty to trace a spiral.' },
      ],
    },
    {
      id: 'compare',
      title: 'What one hidden layer bought',
      codeTitle: 'the_diff.py',
      code: `
        # linear classifier: the forward pass    #@lin
        scores = np.dot(X, W) + b                #@lin
        # two-layer network: one line more       #@net
        hidden_layer = np.maximum(               #@net
            0, np.dot(X, W) + b)                 #@net
        scores = np.dot(hidden_layer, W2) + b2   #@net
        # ...and the backward pass goes deeper   #@bwd
        dW2 = np.dot(hidden_layer.T, dscores)    #@bwd
        dhidden = np.dot(dscores, W2.T)          #@bwd
        dhidden[hidden_layer <= 0] = 0           #@bwd
        dW = np.dot(X.T, dhidden)                #@bwd
        # accuracy: linear 0.49, network 0.99    #@acc
      `,
      beats: [
        { id: 'side', say: 'Side by side: on the left, straight edged wedges, the best a linear classifier can do, right about half the time.', code: 'lin' },
        { id: 'right', say: "On the right, the network's boundary follows every arm.", code: 'net' },
        { id: 'fwd', say: 'In code, the difference is small: one extra line in the forward pass,', code: 'net' },
        { id: 'bwd', say: 'and a few more in the backward pass, to carry the gradient one layer further.', code: 'bwd' },
        { id: 'params', say: 'Nine parameters became six hundred and three, and two hundred iterations became ten thousand.' },
        { id: 'result', say: 'The loss fell from {0.77|zero point seven seven} to {0.24|zero point two four}, and training accuracy rose from {49%|forty nine percent} to {99%|ninety nine}.', code: 'acc' },
        { id: 'caveat', say: 'One honest caveat: that is accuracy on the training points, and it says nothing yet about points the network has never seen.' },
        { id: 'fresh', say: 'For that you need held out data, as in chapter three. Here, a fresh spiral with new noise also comes out {99%|ninety nine percent} right, but only checking could tell you so.' },
        { id: 'a1', say: 'Assignment one asks you to write exactly this network, with mini batches, a validation set and a learning rate schedule, and train it on {CIFAR-10|see-far ten} images.' },
      ],
    },
    {
      id: 'outro',
      title: 'The whole loop',
      codeTitle: 'recap.py',
      code: `
        # 1. scores                              #@s1
        scores = np.dot(X, W) + b                #@s1
        # 2. loss                                #@s2
        exp_scores = np.exp(scores)              #@s2
        probs = exp_scores / np.sum(             #@s2
            exp_scores, axis=1, keepdims=True)   #@s2
        # 3. gradient                            #@s3
        dscores = probs.copy()                   #@s3
        dscores[range(num_examples), y] -= 1     #@s3
        dW = np.dot(X.T, dscores)                #@s3
        # 4. update                              #@s4
        W += -step_size * dW                     #@s4
      `,
      beats: [
        { id: 'recap', say: 'So here is the whole chapter in one breath. A complete classifier is a short loop of four steps.' },
        { id: 's1', say: 'Compute the scores.', code: 's1' },
        { id: 's2', say: 'Turn them into probabilities, and measure the loss.', code: 's2' },
        { id: 's3', say: 'Backpropagate: the probabilities, minus one at the correct class, and from there the matrix multiply and {ReLU|ray-loo} rules.', code: 's3' },
        { id: 's4', say: 'Then step the parameters downhill, and repeat.', code: 's4' },
        { id: 'layer', say: 'One hidden layer, one line forward and a few lines backward, took training accuracy from {49%|forty nine percent} to {99%|ninety nine}.' },
        { id: 'next', say: 'Next come convolutional networks: the same loop and the same rules, with layers built for images, small filters that slide across the pixels.', pause: 0.6 },
      ],
    },
  ],
};

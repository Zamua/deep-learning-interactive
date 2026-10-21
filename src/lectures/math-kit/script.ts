import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'math-kit',
  title: 'Math survival kit',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'A dozen ideas',
      codeTitle: 'syllabus.py',
      code: `
        ideas = ["functions", "vectors", "dot products",   #@ideas
                 "matrices", "sums", "exp and log",        #@ideas
                 "derivatives", "gradients",               #@ideas
                 "the chain rule", "probability",          #@ideas
                 "argmax"]                                 #@ideas

        for idea in ideas:      #@loop
            learn(idea)         #@learn
            # each one pinned to a few lines of NumPy   #@learn
      `,
      beats: [
        { id: 'hello', say: 'Welcome to the math survival kit.' },
        { id: 'wall', say: 'Open a deep learning paper, and it can look like a wall of symbols.' },
        { id: 'wall2', say: 'Greek letters, big sums, little triangles, things stacked on top of other things.' },
        { id: 'good', say: 'Here is the good news. Almost everything in this course is built from about a dozen ideas.', code: 'ideas' },
        { id: 'names', say: 'And as a programmer, you already use most of them. You just know them by other names.' },
        { id: 'loop', say: 'A sum is a for loop. A vector is a list. A function is, well, a function.' },
        { id: 'plan', say: 'So we will walk through the ideas in order, and pin every one of them to a few lines of code.', code: ['loop', 'learn'] },
        { id: 'relax', say: 'You do not need to memorize anything. The goal is simple: by the end, no symbol in this course should scare you.' },
        { id: 'go', say: 'Let us start with the most basic idea of all.' },
      ],
    },
    {
      id: 'functions',
      title: 'Functions are machines',
      codeTitle: 'function.py',
      code: `
        def f(x):                     #@def
            return 2 * x + 1          #@def

        f({{x:3}})    # -> {{fx:7}}           #@call

        xs = np.linspace(-3, 3, {{n:7}})   #@grid
        ys = f(xs)    # every answer at once   #@grid
        plt.plot(xs, ys)                   #@plot

        scores = network(image)   # 3072 numbers in, 10 out   #@net
        loss = L(W)    # every weight in, one number out      #@loss
      `,
      beats: [
        { id: 'var', say: 'In math, a variable is just a name for a number, exactly like a variable in your code.' },
        { id: 'machine', say: 'And a function is a machine. Feed it an input, and it hands back an output.' },
        { id: 'def', say: 'A mathematician writes {f(x) = 2x + 1|f of x equals two x plus one}. You would write a Python function that returns two times x, plus one. Same thing.', code: 'def' },
        { id: 'three', say: 'Put in three, and out comes seven.', code: 'call' },
        { id: 'more', say: 'Put in zero, out comes one. Put in minus two, out comes minus three.', code: 'call' },
        { id: 'same', say: 'The same input always gives the same output. That is the whole contract.' },
        { id: 'graph', say: 'The graph of a function is a picture of every answer at once.' },
        { id: 'dots', say: 'For each input along the horizontal axis, put a dot at the height of its output.', code: 'grid' },
        { id: 'join', say: 'NumPy does exactly this. Evaluate the function on a whole array of inputs in one go, then join the dots.', code: ['grid', 'plot'] },
        { id: 'curve', say: 'Not every function is a straight line. {x²|x squared} bends into a U shape, and that shape will matter a lot later.' },
        { id: 'big', say: 'The two most important functions in this course are enormous.' },
        { id: 'net', say: 'The network takes an image, {3,072|three thousand and seventy two} numbers, and returns ten scores, one per class.', code: 'net' },
        { id: 'loss', say: 'The loss takes every weight in the network and returns one single number: how badly it is doing.', code: 'loss' },
        { id: 'learn', say: 'Learning just means tweaking the inputs of the loss until its output is small. Keep that sentence in mind. The rest of this lecture is about how to do it.', pause: 0.3 },
      ],
    },
    {
      id: 'vectors',
      title: 'Vectors are lists, and arrows',
      codeTitle: 'vectors.py',
      code: `
        x = np.array([3, 1])     #@x
        w = np.array([1, 2])     #@w

        x + w       # -> [4, 3]    add entry by entry     #@add
        {{k:2}} * x       # -> [{{kx0:6}}, {{kx1:2}}]    scale every entry      #@scale
        np.linalg.norm(x)   # -> 3.16   the length        #@norm

        image.reshape(3072)   # an image is a vector too   #@image
      `,
      beats: [
        { id: 'list', say: 'A vector is a list of numbers. That is it. In NumPy, it is a one dimensional array.', code: 'x' },
        { id: 'arrow', say: 'With two numbers, we can draw it. Three steps to the right, one step up, and an arrow from the origin to that point.', code: 'x' },
        { id: 'both', say: 'So a vector is both a list and an arrow, and it helps to think of it both ways.' },
        { id: 'w', say: 'Here is a second vector, w, the list one, two.', code: 'w' },
        { id: 'add', say: 'Adding vectors works entry by entry. Three plus one, and one plus two, gives four and three.', code: 'add' },
        { id: 'tip', say: 'As arrows, that is tip to tail. Walk along x, then walk along w, and you land on the sum.', code: 'add' },
        { id: 'scale', say: 'Multiplying by a number scales every entry. Two times x is the same arrow, twice as long. Minus one flips it around.', code: 'scale' },
        { id: 'norm', say: 'The length of a vector comes from Pythagoras. Square the entries, add them up, and take the square root. For x, that is the square root of ten, about {3.16|three point one six}.', code: 'norm' },
        { id: 'leap', say: 'Now the important leap. An image is also a vector.' },
        { id: 'pixels', say: 'A small color image has {32 × 32|thirty two by thirty two} pixels, with three color values each. Line them all up, and you get a list of {3,072|three thousand and seventy two} numbers.', code: 'image' },
        { id: 'dims', say: 'We cannot draw an arrow in three thousand dimensions, but the code does not care. Adding, scaling and length work exactly the same way.', code: 'image' },
      ],
    },
    {
      id: 'dot',
      title: 'The dot product',
      codeTitle: 'dot.py',
      code: `
        w = np.array([{{w0:1}}, {{w1:0.5}}])   #@w
        x = np.array([3, 1])           #@x

        w * x          # -> [{{p0:3}}, {{p1:0.5}}]    multiply matching entries   #@mul
        np.sum(w * x)  # -> {{d1:3.5}}    then add them up               #@sum
        w.dot(x)       # -> {{d2:3.5}}    the same, in one call          #@dot

        score = w.dot(image)   # a classifier in miniature   #@score
      `,
      beats: [
        { id: 'most', say: 'The dot product is the single most used operation in this whole course.' },
        { id: 'what', say: 'It takes two vectors of the same length and returns one number.', code: ['w', 'x'] },
        { id: 'how', say: 'Multiply the matching entries, then add up the results.', code: ['mul', 'sum'] },
        { id: 'nums', say: 'One times three is three. A half times one is a half. And three plus a half is three and a half.', code: ['mul', 'sum'] },
        { id: 'np', say: 'In NumPy, that is the sum of w times x, or simply, w dot x.', code: 'dot' },
        { id: 'mean', say: 'But what does that number mean? Think of the arrows.' },
        { id: 'same', say: 'When the two arrows point the same way, the dot product is large and positive.', code: 'dot' },
        { id: 'right', say: 'At a right angle, it is exactly zero.', code: 'dot' },
        { id: 'opp', say: 'And when they point in opposite directions, it is large and negative.', code: 'dot' },
        { id: 'agree', say: 'So the dot product measures how much two arrows agree.' },
        { id: 'plane', say: 'Now color every point in the plane by the sign of its dot product with w. One side is positive, the other is negative, and the border between them is a straight line.' },
        { id: 'clf', say: 'That is a linear classifier in miniature. Let w be the weights for one class, and x an image. Then w dot x is the score for that class: high when the image agrees with the weights.', code: 'score' },
      ],
    },
    {
      id: 'matrices',
      title: 'Matrices',
      codeTitle: 'matrix.py',
      code: `
        W = np.array([[ 2, 0, 1],      #@W
                      [-1, 3, 2]])     #@W
        x = np.array([1, 2, 3])        #@x

        out = np.zeros(2)              #@loop
        for i in range(2):             #@loop
            out[i] = W[i].dot(x)       #@row

        W.dot(x)    # -> [5, 11]   the whole loop, in one call   #@dot
        # (m, n) . (n, p) -> (m, p)     #@shape
        W.T         # shape (3, 2)      #@T
      `,
      beats: [
        { id: 'grid', say: 'A matrix is a rectangular grid of numbers.', code: 'W' },
        { id: 'shape', say: 'Its shape is rows, then columns, always in that order. This one has two rows and three columns, so its shape is two by three.', code: 'W' },
        { id: 'rows', say: 'The best way to see a matrix is as a stack of row vectors.', code: 'W' },
        { id: 'mv', say: 'And multiplying a matrix by a vector is not a new operation at all. It is one dot product per row.', code: 'loop' },
        { id: 'r0', say: 'Row zero, dotted with x. Two times one, plus zero times two, plus one times three. That is five.', code: 'row' },
        { id: 'r1', say: 'Row one, dotted with x. Minus one, plus six, plus six. That is eleven.', code: 'row' },
        { id: 'stack', say: 'Stack the answers, and you get a new vector: five and eleven. One number per row.', code: 'dot' },
        { id: 'code', say: 'In code, that is a loop over the rows. Or just W dot x, which runs the whole loop for you, very fast.', code: 'dot' },
        { id: 'habit', say: 'Here is the habit that will save you the most debugging time: write the shape next to every array.' },
        { id: 'rule', say: 'Shapes follow a tiny rule. An m by n matrix, times an n by p matrix, gives m by p. The inner sizes must match, and they cancel out.', code: 'shape' },
        { id: 'course', say: 'In the course, W has ten rows, one per class, and {3,072|three thousand and seventy two} columns, one per pixel value. Multiply it by an image, and you get ten scores.', code: 'shape' },
        { id: 'T', say: 'One last trick: the transpose. {W.T|W dot T} flips a matrix over its diagonal, so rows become columns. It is the usual way to make shapes line up.', code: 'T' },
      ],
    },
    {
      id: 'sums',
      title: 'Sums are loops',
      codeTitle: 'sums.py',
      code: `
        x = np.array([4, 1, 3, 2])     #@x

        total = 0                      #@init
        for i in range(len(x)):        #@loop
            total += x[i]    # i = {{i:0}}, total = {{tot:0}}   #@add

        np.sum(x)     # -> 10                #@np
        np.prod(x)    # -> 24   multiplies instead   #@prod
      `,
      beats: [
        { id: 'sigma', say: 'Next, the big Greek letter that looks like a sideways M. It is a capital sigma. Think S, for sum.' },
        { id: 'loop', say: 'And it is nothing but a for loop that adds.', code: ['init', 'loop', 'add'] },
        { id: 'parts', say: 'The bit underneath says where the loop variable starts. The number on top says where it stops. And whatever sits to the right is what gets added on each pass.', code: 'loop' },
        { id: 'read', say: 'So this reads: for i from one to n, add up x sub i.', code: ['loop', 'add'] },
        { id: 'run', say: 'Watch the loop run. Four. Plus one is five. Plus three is eight. Plus two is ten.', code: 'add' },
        { id: 'index', say: 'Math usually counts from one, while Python counts from zero. Same loop, different starting label.', code: 'loop' },
        { id: 'np', say: 'In NumPy, the whole loop is a single call to sum.', code: 'np' },
        { id: 'pi', say: 'Its cousin, a capital pi, is the same loop, but multiplying instead of adding.', code: 'prod' },
        { id: 'remember', say: 'Whenever you see a sigma in this course, just read it as: loop, and add.' },
      ],
    },
    {
      id: 'exp-log',
      title: 'Exponentials and logarithms',
      codeTitle: 'exp_log.py',
      code: `
        np.exp(0)      # -> 1                     #@zero
        np.exp(1)      # -> 2.718   the number e   #@one
        np.exp({{x:3}})      # -> {{ex:20.1}}                  #@x
        np.exp(-5)     # -> 0.0067   never negative   #@neg

        np.log(np.exp(3))   # -> 3.0   log undoes exp   #@log
        np.log(0.001)       # -> -6.9                   #@small

        s = np.array([2.0, 1.0, -1.0])     #@soft
        e = np.exp(s)                      #@soft
        probs = e / e.sum()   # the softmax, Chapter 4   #@norm
      `,
      beats: [
        { id: 'e', say: 'Now meet e, a number about {2.718|two point seven one eight}. It is to growth what pi is to circles.', code: 'one' },
        { id: 'exp', say: 'The exponential function raises e to the power x. In NumPy, it is called exp.', code: 'x' },
        { id: 'zero', say: 'At zero, it gives exactly one. And every step of one to the right multiplies the output by about {2.7|two point seven}.', code: ['zero', 'one'] },
        { id: 'boom', say: 'So it explodes. {e³|e to the three} is about twenty, and {e¹⁰|e to the ten} is over twenty thousand.', code: 'x' },
        { id: 'left', say: 'Going left, it shrinks toward zero. But it never reaches zero, and it is never negative.', code: 'neg' },
        { id: 'why', say: 'That one fact is why the course uses it: exp turns any score, even a negative one, into a positive number.', code: 'neg' },
        { id: 'log', say: 'The logarithm undoes the exponential. It answers the question: what power of e gives me this number?', code: 'log' },
        { id: 'mirror', say: 'Its graph is the exp curve, mirrored across the diagonal.', code: 'log' },
        { id: 'vals', say: 'The log of one is zero. And the log of a tiny number, like {0.001|zero point zero zero one}, is a big negative number, about minus seven.', code: 'small' },
        { id: 'softmax', say: 'You will see these two together in the softmax. Exponentiate the scores so they are all positive.', code: 'soft' },
        { id: 'divide', say: 'Then divide by their total, so they add up to one.', code: 'norm' },
      ],
    },
    {
      id: 'derivatives',
      title: 'Slope and the derivative',
      codeTitle: 'derivative.py',
      code: `
        def f(x):
            return x ** 2               #@f

        x, h = 1.5, {{h:1}}                #@xh
        slope = (f(x + h) - f(x)) / h   #@slope
        # rise over run -> {{slope:4}}         #@slope

        # the exact rules:              #@rules
        #   x ** n  ->  n * x ** (n - 1)    #@rules
        #   exp(x)  ->  exp(x)               #@rules
        #   log(x)  ->  1 / x                #@rules
      `,
      beats: [
        { id: 'calc', say: 'Now for calculus. And I promise, this is the friendly kind.' },
        { id: 'line', say: 'The slope of a straight line is rise over run. This line climbs two for every one step to the right, so its slope is two, everywhere.' },
        { id: 'curve', say: 'A curve is steeper in some places than others. The derivative is its slope at one particular point.', code: 'f' },
        { id: 'nudge', say: 'Here is the question it answers. If I nudge the input by a tiny amount, how much does the output move, compared to my nudge?' },
        { id: 'measure', say: 'You can measure it with nothing but the function itself. Pick a point, step a distance h to the right, and compute rise over run.', code: ['xh', 'slope'] },
        { id: 'secant', say: 'With h equal to one, the line through the two points has a slope of four. That line is called a secant.', code: 'slope' },
        { id: 'shrink', say: 'Now shrink h. {0.1|Point one}. {0.01|Point zero one}. The secant swings around, and its slope settles on three.', code: ['xh', 'slope'] },
        { id: 'tangent', say: 'That final line just grazes the curve. It is the tangent, and its slope, three, is the derivative of {x²|x squared} at one and a half.', code: 'slope' },
        { id: 'rule', say: 'There is a shortcut rule for this one. The derivative of {x²|x squared} is two x. Two times one and a half is three. It matches.', code: 'rules' },
        { id: 'rules', say: 'A handful of rules like that covers nearly everything. e to the x is its own derivative, and log of x becomes one over x.', code: 'rules' },
        { id: 'sign', say: 'Read the sign like a road. Positive means uphill. Negative means downhill. And zero means flat, like the bottom of a valley.' },
        { id: 'key', say: 'And that is the key to learning. If we know which way is downhill, we know which way to move.' },
      ],
    },
    {
      id: 'gradient',
      title: 'The gradient points uphill',
      codeTitle: 'gradient.py',
      code: `
        def f(p):
            x, y = p
            return x**2 + 3 * y**2               #@f

        def grad(p):     # one slope per input   #@g
            x, y = p                             #@g
            return np.array([2 * x, 6 * y])      #@g

        p = np.array([{{px:2.0}}, {{py:1.0}}])   #@p
        for step in range({{steps:0}}):          #@loop
            p = p - 0.1 * grad(p)    # downhill   #@step
      `,
      beats: [
        { id: 'many', say: 'The loss in this course does not have one input. It has thousands, even millions.' },
        { id: 'two', say: 'Here is one with just two inputs, x and y, so we can draw it. Its height is {x² + 3y²|x squared plus three y squared}: a bowl, seen from above as a contour map.', code: 'f' },
        { id: 'partial', say: 'To get the slope in one direction, nudge just that input, and freeze the other one. That is called a partial derivative.' },
        { id: 'px', say: 'Freeze y, and the slope in the x direction is two x. Freeze x, and the slope in the y direction is six y.', code: 'g' },
        { id: 'grad', say: 'Put those slopes together in a vector, and you have the gradient.', code: 'g' },
        { id: 'gradname', say: 'The word means slope, like the gradient of a road.', code: 'g' },
        { id: 'uphill', say: 'Draw the gradient as an arrow, and something lovely happens. It points straight uphill: the steepest way up from wherever you stand.', code: ['p', 'g'] },
        { id: 'down', say: 'So, to go downhill, step the opposite way.', code: 'step' },
        { id: 'steps', say: 'Take a small step against the gradient. Recompute it. Step again.', code: ['loop', 'step'] },
        { id: 'slide', say: 'Each step lowers the height, and the point slides down into the bottom of the bowl.', code: ['loop', 'step'] },
        { id: 'gd', say: 'That loop is gradient descent, and it is how every network in this course learns. The only difference is that the bowl has millions of directions instead of two.', pause: 0.3 },
      ],
    },
    {
      id: 'chain',
      title: 'The chain rule',
      codeTitle: 'chain.py',
      code: `
        u = 3 * x       # u turns 3 times per turn of x   #@u
        v = 4 * u       # v turns 4 times per turn of u   #@v
        dv_dx = 3 * 4   # rates multiply: 12              #@chain

        # a curvier pipeline
        u = 2 * x + 1         # inner rate: 2        #@u2
        f = u ** 2            # outer rate: 2 * u    #@f2
        df_dx = (2 * u) * 2   # multiply the rates   #@chain2
      `,
      beats: [
        { id: 'pipe', say: 'Neural networks are pipelines. The output of one function feeds the next one, many times over.' },
        { id: 'rule', say: 'The chain rule tells us how a change at the very start ripples through to the very end. And the answer is pleasingly simple: the rates multiply.' },
        { id: 'g1', say: 'Picture a train of gears. Gear u turns three times for every turn of gear x.', code: 'u' },
        { id: 'g2', say: 'And gear v turns four times for every turn of u.', code: 'v' },
        { id: 'g3', say: 'So for every turn of x, how many turns does v make? Three times four. Twelve.', code: 'chain' },
        { id: 'local', say: 'Notice that each gear only needs to know its ratio to its neighbor. Nobody needs the big picture.' },
        { id: 'curvy', say: 'The same works for curvier functions. Take two x plus one, and then square it.', code: ['u2', 'f2'] },
        { id: 'rates', say: 'The inner step has a rate of two. The outer step, squaring u, has a rate of two u.', code: ['u2', 'f2'] },
        { id: 'mult', say: 'Multiply them, and you have the derivative of the whole pipeline.', code: 'chain2' },
        { id: 'backprop', say: 'This is the beating heart of backpropagation. A network computes forward, layer by layer. Then it passes rates backward, each layer multiplying in its own small piece.', pause: 0.3 },
      ],
    },
    {
      id: 'probability',
      title: 'Probability and the bell curve',
      codeTitle: 'probability.py',
      code: `
        probs = np.array([0.7, 0.2, 0.1])   # cat, dog, ship   #@probs
        probs.sum()    # -> 1.0                                #@sum

        mu, sigma = {{mu:0}}, {{sigma:1}}                       #@ms
        samples = mu + sigma * np.random.randn({{n:0}})       #@sample
        samples.mean()   # -> {{mean:0}}                       #@mean
        samples.std()    # -> {{std:0}}                        #@std

        W = 0.01 * np.random.randn(D, H)   # small random weights   #@init
      `,
      beats: [
        { id: 'two', say: 'Two more ideas, and you are through. First, probability.' },
        { id: 'p', say: 'A probability is a number between zero and one. Zero means never, and one means certainly.' },
        { id: 'dist', say: 'A probability distribution gives each possible outcome one of those numbers. And they always add up to exactly one, because something has to happen.', code: ['probs', 'sum'] },
        { id: 'softmax', say: 'That is exactly what a softmax classifier outputs. Cat, seventy percent. Dog, twenty. Ship, ten.', code: 'probs' },
        { id: 'mean', say: 'For a pile of numbers, two summaries matter most. The mean, mu, says where they are centered.', code: 'mean' },
        { id: 'std', say: 'The standard deviation, sigma, says how spread out they are: a typical distance from the mean.', code: 'std' },
        { id: 'bell', say: 'Draw lots of random samples, and many quantities pile up in a bell shape. That is the Gaussian, or normal, distribution.', code: 'sample' },
        { id: 'rule', say: 'About two thirds of the samples land within one sigma of the middle, and about ninety five percent within two.', code: ['mean', 'std'] },
        { id: 'randn', say: 'NumPy\'s randn draws from the standard bell: centered at zero, with a spread of one. Multiply by sigma to stretch it. Add mu to shift it.', code: ['ms', 'sample'] },
        { id: 'init', say: 'The course uses this constantly. For example, to fill a weight matrix with small random numbers before training begins.', code: 'init' },
      ],
    },
    {
      id: 'argmax',
      title: 'argmax, and the decoder',
      codeTitle: 'decoder.py',
      code: `
        scores = np.array([1.2, 3.1, -0.4])   # cat, dog, ship   #@scores
        np.max(scores)       # -> 3.1   the biggest value          #@max
        np.argmax(scores)    # -> 1     where it is: dog           #@argmax

        np.sum(x)            # Σ   loop and add       #@sum
        grad                 # ∇f  the gradient       #@nabla
        x.mean(), x.std()    # μ, σ   center, spread   #@ms
        W.dot(x)             # W x  dot product per row   #@wx
      `,
      beats: [
        { id: 'max', say: 'The last one is quick. Max gives you the largest value in a list.', code: 'max' },
        { id: 'argmax', say: 'Argmax gives you the position of the largest value.', code: 'argmax' },
        { id: 'pred', say: 'When a classifier makes a prediction, it takes the argmax of its scores. We do not want the winning score itself. We want to know which class won.', code: 'argmax' },
        { id: 'decode', say: 'Here are the symbols you will meet most, decoded.' },
        { id: 'sigma', say: 'Sigma means loop and add.', code: 'sum' },
        { id: 'nabla', say: 'The upside down triangle, called nabla, means the gradient.', code: 'nabla' },
        { id: 'musig', say: 'Mu and sigma are the center and the spread.', code: 'ms' },
        { id: 'wx', say: 'And a matrix next to a vector means one dot product per row.', code: 'wx' },
        { id: 'kit', say: 'That is the whole kit. Functions, vectors, dot products, matrices, sums, exp and log, derivatives, gradients, the chain rule, probability, and argmax.' },
        { id: 'back', say: 'You do not need to have memorized any of it. Each tool comes back, again and again, right when a later idea needs it.' },
        { id: 'next', say: 'Next comes Python and NumPy, the language of the course, where every idea you just saw becomes one short line of array code.', pause: 0.6 },
      ],
    },
  ],
};

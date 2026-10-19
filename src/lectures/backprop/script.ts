import type { LectureScript } from '../../lecture/types';

export const script: LectureScript = {
  id: 'backprop',
  title: 'Backpropagation',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'intro',
      title: 'Why we need gradients',
      codeTitle: 'why_backprop.py',
      code: `
        loss = L(X, y, W)        # one number      #@loss
        W -= step_size * dW      # walk downhill   #@update

        # way 1: numerical, one nudge per weight   #@num
        for i in np.ndindex(W.shape):              #@num
            W[i] += h                              #@num
            dW[i] = (L(X, y, W) - loss) / h        #@num
            W[i] -= h                              #@num

        # way 2: analytic, a formula by hand       #@ana

        # way 3: backpropagation                   #@bp
        loss, cache = forward(X, y, W)             #@bp
        dW = backward(1.0, cache)                  #@bp
      `,
      beats: [
        { id: 'hello', say: 'Welcome to backpropagation: the algorithm that makes neural networks trainable.' },
        { id: 'recall', say: 'Last chapter, we trained a classifier by walking downhill on the loss.', code: ['loss', 'update'] },
        { id: 'need', say: 'Every step needs the gradient: for every weight, which way makes the loss go up, and how steeply.', code: 'update' },
        { id: 'num', say: 'One way is numerical. Nudge one weight, run the whole loss again, and see how much it moved.', code: 'num' },
        { id: 'slow', say: 'Simple, but slow: one extra pass per weight, and networks have millions. And only approximate, since the nudge is never truly tiny.', code: 'num' },
        { id: 'ana', say: 'The other way is analytic: a formula from calculus. Exact and fast, but deriving it by hand for a whole network is hopeless.', code: 'ana' },
        { id: 'bp', say: 'Backpropagation is the way out. It computes exact gradients for any function, however complicated, completely mechanically.', code: 'bp' },
        { id: 'how', say: 'The trick: break the function into tiny pieces with trivial derivatives, and chain them with one rule from calculus.', code: 'bp' },
        { id: 'plan', say: 'Every deep learning library does exactly this. We will build it up from circuits with just three numbers in them.' },
      ],
    },
    {
      id: 'problem',
      title: 'What we want',
      codeTitle: 'problem.py',
      code: `
        X, y = batch            # the data: fixed  #@data
        W = 0.01 * np.random.randn(D, C)   # ours  #@W

        loss, cache = forward(X, y, W)   # f      #@f
        dX, dW = backward(1.0, cache)             #@grad

        assert dW.shape == W.shape   # one each    #@dW
        W -= step_size * dW          # downhill    #@dW
        # dX: free, for visualizing (Ch 12)        #@dX
      `,
      beats: [
        { id: 'state', say: 'Let us state the problem plainly. We have a function, f, of a list of inputs, x.' },
        { id: 'want', say: 'We want its gradient at one particular x: one number per input, saying how sensitive f is to that input, right there.', code: 'grad' },
        { id: 'loss', say: 'In a neural network, f is the loss: one number that says how badly the network is doing.', code: 'f' },
        { id: 'inputs', say: 'Its inputs are the training data, and the weights.', code: ['data', 'W'] },
        { id: 'fixed', say: 'The data is given, and fixed. The weights are what we get to change.', code: ['data', 'W'] },
        { id: 'dw', say: 'So mostly, we want the gradient with respect to the weights, to step downhill.', code: 'dW' },
        { id: 'dx', say: 'The gradient on the data comes free, and is handy too, for example to see what a network has learned.', code: ['grad', 'dX'] },
      ],
    },
    {
      id: 'derivative',
      title: 'What a derivative means',
      codeTitle: 'derivative.py',
      code: `
        def f(x, y):
            return x * y                       #@f

        x, y = 4.0, -3.0      # f = -12        #@xy
        h = {{h:1}}             # the nudge      #@h
        slope = (f(x + h, y) - f(x, y)) / h    #@slope
        # slope = {{slope:-3}}                     #@slope

        dfdx, dfdy = y, x     # -3.0, 4.0      #@grad
      `,
      beats: [
        { id: 'small', say: 'Start with the smallest example there is: f of x and y equals x times y.', code: 'f' },
        { id: 'vals', say: 'Let x be four, and y be minus three. Then f is minus twelve.', code: 'xy' },
        { id: 'nudge', say: 'Now nudge x up a little. What happens to f?', code: 'h' },
        { id: 'why', say: 'f is x times minus three, so every bit you add to x takes three times as much away from f.', code: 'slope' },
        { id: 'def', say: 'That ratio, output change per unit of input change, is the derivative.', code: 'slope' },
        { id: 'shrink', say: 'Shrink the nudge, and the ratio settles on one exact number. Here, minus three.', code: ['h', 'slope'] },
        { id: 'sens', say: 'So a derivative is a sensitivity. Minus three means: push x up, and f moves down, three times as far.' },
        { id: 'partial', say: 'With several inputs, we ask about one input at a time, with the others frozen. That is a partial derivative, written with a curly d.', code: 'grad' },
        { id: 'grad', say: 'The gradient is just the list of them. For x times y: y, then x. Minus three, and four.', code: 'grad' },
      ],
    },
    {
      id: 'gates',
      title: 'Three tiny gates',
      codeTitle: 'simple_gates.py',
      code: `
        x, y = 4.0, -3.0
        # multiply: f = x * y                    #@mul
        dfdx, dfdy = y, x              # -3, 4   #@mul
        # add: f = x + y                         #@add
        dfdx, dfdy = 1.0, 1.0                    #@add
        # max: f = max(x, y)                     #@max
        dfdx = 1.0 if x >= y else 0.0  # 1.0     #@max
        dfdy = 1.0 if y >= x else 0.0  # 0.0     #@max
      `,
      beats: [
        { id: 'three', say: 'Three tiny functions are enough to build everything else. We just met the first.' },
        { id: 'mul', say: 'For a product, the slope along x is the other input, y. And along y, it is x.', code: 'mul' },
        { id: 'mulwhy', say: 'Hold y still, and x times y is a straight line in x, with slope y.', code: 'mul' },
        { id: 'add', say: 'For a sum, the slope is always exactly one. Whatever you add to x shows up one for one in the output.', code: 'add' },
        { id: 'max', say: 'For a max, it is all or nothing. The larger input gets a slope of one, and the smaller gets zero.', code: 'max' },
        { id: 'maxwhy', say: 'Wiggle the smaller input a little, and nothing happens. The max does not even notice.', code: 'max' },
        { id: 'kink', say: 'At a tie, the max has a kink with no true slope, and code just picks a side.', code: 'max' },
        { id: 'push', say: 'Read each one as: if I push on this input, how hard does the output move?' },
      ],
    },
    {
      id: 'chain',
      title: 'The chain rule',
      codeTitle: 'circuit.py',
      code: `
        x, y, z = -2.0, 5.0, -4.0             #@in

        # forward pass
        q = x + y        # q = {{q}}              #@f1
        f = q * z        # f = {{f}}              #@f2

        # backward pass, in reverse order
        df = 1.0         # df/df                #@b0
        dq = z * df      # {{dq}}                 #@b1
        dz = q * df      # {{dz}}                 #@b1
        dx = 1.0 * dq    # {{dx}}                 #@b2
        dy = 1.0 * dq    # {{dy}}                 #@b2
      `,
      beats: [
        { id: 'real', say: 'Real functions are built from simple pieces. Take f equals x plus y, times z.' },
        { id: 'name', say: 'Name the inner piece q, equal to x plus y. Now f is q times z, and every piece is a gate we know.', code: ['f1', 'f2'] },
        { id: 'local', say: 'From q times z: the slope along q is z, and along z it is q. From x plus y, both slopes are one.', code: ['f1', 'f2'] },
        { id: 'want', say: 'But we want the slope of f along x, not along q.' },
        { id: 'chain', say: 'The chain rule says how to combine the pieces: multiply them.' },
        { id: 'gears', say: 'Rates multiply along a chain, like gears. x drives q at a rate of one. q drives f at minus four. So x drives f at one times minus four: minus four.' },
        { id: 'calc', say: 'It is the chain rule from calculus class, outside times inside, just with actual numbers.' },
        { id: 'circuit', say: 'Now draw it as a circuit: inputs on the left, one node per gate, values flowing right.', code: 'in' },
        { id: 'fwd', say: 'Forward, left to right. x plus y gives three. Three times minus four gives minus twelve.', code: ['f1', 'f2'] },
        { id: 'seed', say: 'The backward pass starts at the output, with a gradient of one. Nudge f by one, and f moves by one.', code: 'b0' },
        { id: 'mulback', say: 'The multiply gate swaps its inputs. q gets z, minus four. And z gets q, three.', code: 'b1' },
        { id: 'addback', say: 'The add gate passes its minus four to both of its inputs, unchanged.', code: 'b2' },
        { id: 'result', say: 'So the gradient is minus four, minus four, and three. Nudge x a tiny bit, and f really moves by minus four times that.' },
        { id: 'dx', say: 'In code we write {dx|d x}. It always means the gradient of the final output with respect to x.', code: 'b2' },
      ],
    },
    {
      id: 'local',
      title: 'Backprop is local',
      codeTitle: 'gate.py',
      code: `
        class MultiplyGate:
            def forward(self, x, y):
                self.x, self.y = x, y   # cache   #@fwd
                return x * y                      #@fwd
            def backward(self, dout):  # upstream #@up
                dx = self.y * dout   # local * up #@dx
                dy = self.x * dout   # local * up #@dx
                return dx, dy                     #@dx

        for gate in graph:            # in order  #@loop
            gate.forward()                        #@loop
        for gate in reversed(graph):  # reversed  #@loop
            gate.backward()                       #@loop

        out, cache = affine_forward(x, w, b)      #@a2
        dx, dw, db = affine_backward(dout, cache) #@a2
      `,
      beats: [
        { id: 'pov', say: 'Now look at the circuit from the point of view of a single gate.' },
        { id: 'fwd', say: 'In the forward pass, a gate gets its inputs, and computes two things from nothing but those inputs.', code: 'fwd' },
        { id: 'two', say: 'Its output. And its local gradients: how its output would change with each input.', code: 'fwd' },
        { id: 'blind', say: 'It knows nothing about the rest of the circuit: how big it is, or what it is for.' },
        { id: 'up', say: 'Later, the backward pass brings it one number: how much the final output cares about this gate\'s output. The upstream gradient.', code: 'up' },
        { id: 'rule', say: 'The chain rule says what to do with it: multiply it into each local gradient, and pass the results back to the inputs.', code: 'dx' },
        { id: 'eq', say: 'Downstream equals upstream times local. That one line is the entire algorithm.', code: 'dx' },
        { id: 'story', say: 'Pretend the circuit wants its output to be higher. Our add gate has local gradients of plus one, and plus one.' },
        { id: 'story2', say: 'Then it hears from upstream: minus four. The circuit wants its output to go down, with force four.' },
        { id: 'story3', say: 'So it tells both inputs: go down, with force four. If they obey, q falls, and since z is negative, f rises.' },
        { id: 'talk', say: 'Backprop is gates talking through gradients: should my output go up or down, and how strongly?' },
        { id: 'libs', say: 'Every deep learning library works this way: each layer has a forward that caches what it needs, and a backward that applies upstream times local.', code: ['fwd', 'up', 'dx'] },
        { id: 'graph', say: 'A network is a list of them: forward in order, then backward in reverse.', code: 'loop' },
        { id: 'a2', say: 'Assignment two is built exactly like this, from pairs such as {affine_forward|affine forward} and {affine_backward|affine backward}.', code: 'a2' },
      ],
    },
    {
      id: 'neuron',
      title: 'A sigmoid neuron',
      codeTitle: 'neuron_staged.py',
      code: `
        w0, x0, w1, x1, w2 = 2, -1, -3, -2, -3   #@in
        dot = w0*x0 + w1*x1 + w2   # {{dot}}       #@dot
        neg = -1.0 * dot           # {{neg}}       #@g1
        ex = np.exp(neg)           # {{ex}}        #@g2
        den = 1.0 + ex             # {{den}}       #@g3
        f = 1.0 / den              # {{f}}         #@g4

        df = 1.0
        dden = (-1.0 / den**2) * df  # {{dden}}    #@b4
        dex = 1.0 * dden             # {{dex}}     #@b3
        dneg = ex * dex              # {{dneg}}    #@b2
        ddot = -1.0 * dneg           # {{ddot}}    #@b1
        dw0, dx0 = x0 * ddot, w0 * ddot          #@bw
        dw1, dx1 = x1 * ddot, w1 * ddot          #@bw
        dw2 = 1.0 * ddot                         #@bw
      `,
      beats: [
        { id: 'any', say: 'Any function with a derivative we can write down can be a gate. Here is a realistic circuit: a neuron with two inputs.' },
        { id: 'formula', say: 'It takes a weighted sum of its inputs plus a bias, like a classifier\'s score, and squashes it between zero and one with a sigmoid.', code: ['dot', 'g1', 'g2', 'g3', 'g4'] },
        { id: 'nums', say: 'With weights two, minus three, minus three, and inputs minus one and minus two, the sum is one, and the output is about {0.73|zero point seven three}.', code: ['in', 'dot', 'g4'] },
        { id: 'question', say: 'Which way should each weight move to push that output up? That is a backprop question.' },
        { id: 'gates', say: 'In the smallest gates, it needs four new kinds, each with a one line local gradient.' },
        { id: 'inv', say: 'One over x has a slope of minus one over x squared.', code: 'g4' },
        { id: 'addc', say: 'Adding a constant has a slope of one. Multiplying by a constant, a, has a slope of a.', code: ['g1', 'g3'] },
        { id: 'exp', say: 'And e to the x is its own derivative: its slope equals its height.', code: 'g2' },
        { id: 'fwd', say: 'Forward first. The sum is one. Negate it, and e to the minus one is about {0.37|zero point three seven}. Add one, and one over that is {0.73|zero point seven three}.', code: ['dot', 'g1', 'g2', 'g3', 'g4'] },
        { id: 'back1', say: 'Now backward. The one over x gate turns the gradient of one into minus {0.53|zero point five three}.', code: 'b4' },
        { id: 'back2', say: 'The plus one gate passes it through. The exp gate multiplies by its output, {0.37|zero point three seven}. And the times minus one gate flips the sign: plus {0.2|zero point two}.', code: ['b3', 'b2', 'b1'] },
        { id: 'back3', say: 'Then the add gates hand {0.2|zero point two} to every term, and each multiply gate swaps: {w₀|w zero} gets {x₀|x zero} times {0.2|zero point two}, and {x₀|x zero} gets {w₀|w zero} times it.', code: 'bw' },
        { id: 'answer', say: 'Read off the signs. To push the output up, lower {w₀|w zero} and {w₁|w one}, and raise the bias.', code: 'bw' },
      ],
    },
    {
      id: 'sigmoid',
      title: 'One sigmoid gate',
      codeTitle: 'neuron_grouped.py',
      code: `
        def sigmoid(z):
            return 1.0 / (1.0 + np.exp(-z))      #@sig

        W = [2.0, -3.0, -3.0]                    #@in
        x = [-1.0, -2.0]                         #@in
        # forward pass
        dot = W[0]*x[0] + W[1]*x[1] + W[2]       #@dot
        f = sigmoid(dot)           # 0.73        #@f
        # backward pass
        ddot = (1 - f) * f         # 0.197       #@ddot
        dx = [W[0] * ddot, W[1] * ddot]          #@dx
        dW = [x[0] * ddot, x[1] * ddot, ddot]    #@dx
      `,
      beats: [
        { id: 'box', say: 'Look at what those last four gates did together. They compute the sigmoid: one over one plus e to the minus z.', code: 'sig' },
        { id: 'total', say: 'And between them, they scaled the gradient by about {0.197|zero point one nine seven}.' },
        { id: 'deriv', say: 'The sigmoid\'s derivative is unusually pleasant. Grind through the calculus, and it simplifies to one minus sigma, times sigma.' },
        { id: 'output', say: 'It needs only the output, which the forward pass already computed. {0.73|Zero point seven three} times {0.27|zero point two seven} is {0.197|zero point one nine seven}: the same factor.', code: 'ddot' },
        { id: 'curve', say: 'Its slope peaks at one quarter in the middle, and fades to almost nothing at both ends.' },
        { id: 'group', say: 'So we can swap the four small gates for one sigmoid gate, with a one line backward step.', code: ['sig', 'ddot'] },
        { id: 'modular', say: 'Grouping gates like this is common practice, whenever a group has a simple derivative.' },
        { id: 'code', say: 'The whole neuron is now a few lines. Forward: the dot product, then the sigmoid.', code: ['dot', 'f'] },
        { id: 'back', say: 'Backward: through the sigmoid, then each input gets its partner\'s value, times that gradient.', code: ['ddot', 'dx'] },
        { id: 'staged', say: 'Notice the habit. Split the forward pass into stages with easy derivatives, keep the values, and walk the stages backward. It is the most useful tip for writing backward passes.' },
      ],
    },
    {
      id: 'staged',
      title: 'Staged backprop',
      codeTitle: 'staged.py',
      code: `
        x, y = 3, -4                             #@in
        # forward: stages, keeping every value
        sigy = 1.0 / (1 + np.exp(-y))            #@f1
        num = x + sigy                           #@f1
        sigx = 1.0 / (1 + np.exp(-x))            #@f2
        xpy = x + y                              #@f2
        xpysqr = xpy**2                          #@f2
        den = sigx + xpysqr                      #@f2
        invden = 1.0 / den                       #@f3
        f = num * invden            # {{f}}        #@f3
        # backward: the same stages, reversed
        dnum, dinvden = invden, num              #@b1
        dden = (-1.0 / den**2) * dinvden         #@b1
        dsigx = dxpysqr = dden                   #@b2
        dxpy = (2 * xpy) * dxpysqr               #@b2
        dx = dy = dxpy              # {{dx1}}      #@k1
        dx += ((1 - sigx) * sigx) * dsigx  # {{dx2}} #@k2
        dx += dnum                  # {{dx3}}      #@k3
        dy += ((1 - sigy) * sigy) * dnum         #@b3
      `,
      beats: [
        { id: 'awkward', say: 'Here is a function made up purely for practice. Nobody would want to differentiate it by hand.' },
        { id: 'page', say: 'As a formula, its derivative would take the quotient rule, the chain rule twice, and a page of algebra.' },
        { id: 'value', say: 'But we never need the formula. Only its value, at our x and y: three, and minus four.', code: 'in' },
        { id: 'stages', say: 'So break the forward pass into simple stages, and keep every intermediate value.', code: ['f1', 'f2', 'f3'] },
        { id: 'graph', say: 'As a circuit, each stage is one gate, named after its variable.', code: ['f1', 'f2', 'f3'] },
        { id: 'back', say: 'Then walk the stages backward. Each line is the gradient arriving from the right, times one easy local gradient.', code: ['b1', 'b2'] },
        { id: 'cache', say: 'Those lines need {xpy|x p y}, {sigx|sig x} and {den|den}. That is why we cache the forward pass.', code: ['b1', 'b2'] },
        { id: 'fork', say: 'Now watch x. It feeds three stages: {sigx|sig x}, {xpy|x p y}, and num.' },
        { id: 'pieces', say: 'So its gradient arrives in three pieces, one per wire, and the pieces add up.', code: ['k1', 'k2', 'k3'] },
        { id: 'total', say: 'One point five eight. Then one point five five. Then two point oh six.', code: ['k1', 'k2', 'k3'] },
        { id: 'why', say: 'Nudge x, and the nudge travels down every path at once. The total effect is the sum over the paths.' },
        { id: 'bug', say: 'That is why the code says plus equals. Write plain equals, and you silently drop a path: one of the most common backprop bugs.', code: ['k2', 'k3'] },
      ],
    },
    {
      id: 'patterns',
      title: 'Gate personalities',
      codeTitle: 'patterns.py',
      code: `
        dx, dy = dout, dout           # add       #@add
        dx = dout if x >= y else 0.0  # max       #@max
        dx, dy = y * dout, x * dout   # multiply  #@mul

        x, y, z, w = 3.0, -4.0, 2.0, -1.0         #@in
        m = x * y                     # {{m}}       #@fw
        n = max(z, w)                 # {{n}}       #@fw
        f = 2.0 * (m + n)             # {{f}}       #@fw
        ds = 2.0 * 1.0                # {{ds}}      #@b1
        dm, dn = ds, ds               # distribute #@b1
        dz = dn if z >= w else 0.0    # route     #@b2
        dw = dn if w > z else 0.0     # route     #@b2
        dx, dy = y * dm, x * dm       # swap      #@b3

        s = np.dot(w, x)      # a score            #@s
        dw = x * ds           # scaled by the data #@s
      `,
      beats: [
        { id: 'pers', say: 'After a few circuits, the three most common gates show clear personalities on the way back.' },
        { id: 'add', say: 'The add gate distributes. It hands its upstream gradient, unchanged, to every input, whatever their values.', code: 'add' },
        { id: 'max', say: 'The max gate routes. The whole gradient goes to the larger input, and exactly zero to the other.', code: 'max' },
        { id: 'mul', say: 'The multiply gate swaps. Each input gets the other input\'s value, times the upstream gradient.', code: 'mul' },
        { id: 'all', say: 'Here are all three in one circuit: two times, x times y, plus the max of z and w. Try predicting each gradient.', code: ['in', 'fw'] },
        { id: 'fwd', say: 'Forward: x times y is minus twelve. The max is two. The sum is minus ten, and doubled, minus twenty.', code: 'fw' },
        { id: 'b1', say: 'Backward: the times two gate makes the gradient two, and the add gate distributes it: two to each side.', code: 'b1' },
        { id: 'b2', say: 'The max routes all of it to z, since z beat w. So w gets exactly zero.', code: 'b2' },
        { id: 'b3', say: 'And the multiply gate swaps. x gets y times two: minus eight. And y gets x times two: six.', code: 'b3' },
        { id: 'scale', say: 'Swapping has a surprising consequence. If one input is tiny and the other is huge, the tiny one gets the huge gradient.', code: 'mul' },
        { id: 'lin', say: 'A linear classifier multiplies weights by data. So each weight\'s gradient is the data value it was multiplied with.', code: 's' },
        { id: 'thousand', say: 'Scale the data up a thousand times, and every weight gradient grows a thousand times, so you would need a far smaller learning rate.', code: 's' },
        { id: 'pre', say: 'That is one concrete reason preprocessing matters: the size of the inputs leaks straight into the size of the gradients.' },
      ],
    },
    {
      id: 'matrices',
      title: 'Gradients for matrices',
      codeTitle: 'matmul_grad.py',
      code: `
        W = np.random.randn(5, 10)
        X = np.random.randn(10, 3)
        D = W.dot(X)                    # (5, 3)    #@D
        dD = np.random.randn(*D.shape)  # upstream  #@dD

        dW = dD.dot(X.T)   # (5,3)(3,10) -> (5,10)  #@dW
        dX = W.T.dot(dD)   # (10,5)(5,3) -> (10,3)  #@dX

        # element-wise: no Jacobian needed          #@jac
        out = np.maximum(0, x)                      #@relu
        dx = dout * (x > 0)                         #@drelu
      `,
      beats: [
        { id: 'mats', say: 'So far, every value was a single number. Real networks work with whole matrices.' },
        { id: 'same', say: 'Nothing new is needed: the same rules apply, element by element. The extra care goes into shapes, and transposes.' },
        { id: 'mm', say: 'The key case is the matrix multiply. D equals W times X.', code: 'D' },
        { id: 'up', say: 'The upstream gradient, {dD|d D}, has one number per entry of D: exactly the shape of D.', code: 'dD' },
        { id: 'formula', say: 'The gradients are: {dW|d W} equals {dD|d D} times X transpose, and {dX|d X} equals W transpose times {dD|d D}.', code: ['dW', 'dX'] },
        { id: 'why', say: 'Why? Weight W, i j, feeds every entry in row i of D, scaled by row j of X. Summing those paths gives row i of {dD|d D}, dotted with row j of X.', code: 'dW' },
        { id: 'shape', say: 'But you never need to derive that again. Use shapes. {dW|d W} must have the shape of W: five by ten.', code: 'dW' },
        { id: 'only', say: 'It is built from {dD|d D}, five by three, and X, ten by three. Only one product of those comes out five by ten: {dD|d D} times X transpose.', code: 'dW' },
        { id: 'dX', say: 'Same trick for {dX|d X}. W transpose, ten by five, times {dD|d D}, five by three, gives ten by three: the shape of X.', code: 'dX' },
        { id: 'sizes', say: 'Work with sizes that are all different. When two sizes match, a wrong arrangement can fit by accident.' },
        { id: 'jac', say: 'One last worry: the Jacobian, every output\'s derivative with respect to every input. For big vectors, it is enormous.', code: 'jac' },
        { id: 'diag', say: 'Nobody builds it. For an element-wise operation, output i depends only on input i, so backprop just multiplies element by element.', code: ['relu', 'drelu'] },
        { id: 'relu', say: 'For the max of zero and x, the gradient passes wherever x was positive, and is zero everywhere else.', code: 'drelu' },
      ],
    },
    {
      id: 'recap',
      title: 'The whole algorithm',
      codeTitle: 'summary.py',
      code: `
        # every gate: downstream = upstream * local
        dx, dy = dout, dout            # add      #@add
        dx, dy = y * dout, x * dout    # multiply #@mul
        dx = dout if x >= y else 0.0   # max      #@max
        dz = (1 - f) * f * dout        # sigmoid  #@sig
        dx += 1.0 * dq                 # forks    #@fork
        dW = dD.dot(X.T)               # matmul   #@mm
        dX = W.T.dot(dD)                          #@mm
      `,
      beats: [
        { id: 'recap', say: 'Let us put the whole algorithm together.' },
        { id: 'rule', say: 'Backpropagation computes the gradient of a complicated function by applying the chain rule, over and over.' },
        { id: 'fwd', say: 'Write the forward pass as simple stages, and cache their values.' },
        { id: 'bwd', say: 'Then walk backward from the output, starting from a gradient of one. Each gate multiplies the upstream gradient by its local gradient, and passes it on.', code: 1 },
        { id: 'fork', say: 'Where a value was used more than once, its gradients add up.', code: 'fork' },
        { id: 'pers', say: 'Add distributes. Max routes. Multiply swaps.', code: ['add', 'max', 'mul'] },
        { id: 'sig', say: 'A sigmoid multiplies by one minus f, times f.', code: 'sig' },
        { id: 'mat', say: 'And a matrix gradient always has the shape of its variable, which pins down the transposes.', code: 'mm' },
        { id: 'next', say: 'Next come neural networks: layers of these same simple gates, stacked deep, and trained by exactly this backward walk.', pause: 0.6 },
      ],
    },
  ],
};

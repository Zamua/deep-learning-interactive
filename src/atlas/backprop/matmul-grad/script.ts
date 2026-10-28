import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-matmul-grad',
  title: 'Input gradients',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'walk',
      title: 'The walk goes on',
      codeTitle: 'walk.py',
      code: `
        x = np.array([3, 4, 1])        #@x
        z = W @ x        # [10, 15]    #@z
        # z -> rest of graph -> f      #@z
        dz = np.array([2, -1])         #@dz
        dW = np.outer(dz, x)  # found  #@dW
        # x was made by an earlier node #@x0
        # dx: shaped like x, all ?     #@dx
      `,
      beats: [
        { id: 'node', say: 'Here is the node from before. It multiplies x by W, and its result, z, flows through the rest of the graph to f.', code: ['x', 'z'] },
        { id: 'dz', say: 'Walking back from f, backprop has reached this node: the gradient on z, {dz|d z}, has arrived. Two, and minus one.', code: 'dz' },
        { id: 'W', say: 'From it, the node found the gradient on W: one slope per weight.', code: 'dW' },
        { id: 'x0', say: 'But x was made by an earlier node, and that node can take its step only once the gradient on x arrives.', code: 'x0' },
        { id: 'dx', say: 'So this node owes a second answer: {∂f/∂x|partial f, partial x}, one slope per entry of x.', code: 'dx' },
        { id: 'name', say: 'x is the node\'s input, so this is called its input gradient: {dx|d x}, in code. Hand it back, and the walk goes on.', code: 'dx' },
      ],
    },
    {
      id: 'fork',
      title: 'One entry, two paths',
      codeTitle: 'x1.py',
      code: `
        # z[0] = 1*x[0] + 2*x[1] - 1*x[2]  #@z0
        # z[1] = 3*x[0] + 1*x[1] + 2*x[2]  #@z1
        # x[1] meets W[0,1] and W[1,1]     #@meet
        W[0,1] * dz[0]      # 2*2 = 4      #@p0
        W[1,1] * dz[1]      # 1*(-1) = -1  #@p1
        dx1 = 4 + (-1)      # 3            #@sum
      `,
      beats: [
        { id: 'one', say: 'Follow one entry of x: {x₁|x one}, which is four.', code: 'z0' },
        { id: 'rows', say: 'Row zero of W, dotted with x, makes {z₀|z zero}. There {x₁|x one} is multiplied by two, the weight in column one.', code: 'z0' },
        { id: 'row1', say: 'Row one makes {z₁|z one}, and there {x₁|x one} is multiplied by one, again from column one.', code: 'z1' },
        { id: 'fork', say: 'So as a graph, {x₁|x one} forks: one wire to a multiply on the way to {z₀|z zero}, and one on the way to {z₁|z one}.', code: 'meet' },
        { id: 'twice', say: 'It is a value used twice. Walking back, it collects a gradient from each wire, and those add up.', code: 'meet' },
        { id: 'p0', say: 'Each multiply swaps. From {z₀|z zero}, {x₁|x one} gets the weight, two, times {z₀|z zero}\'s gradient, two: four.', code: 'p0' },
        { id: 'p1', say: 'From {z₁|z one}, it gets the weight, one, times minus one: minus one.', code: 'p1' },
        { id: 'sum', say: 'Four and minus one add up to three. That is {∂f/∂x₁|partial f, partial x one}.', code: 'sum' },
        { id: 'own', say: 'And the four in {x₁|x one} itself appears nowhere: a multiply hands each input the other one\'s value.', code: ['p0', 'p1'] },
      ],
    },
    {
      id: 'cols',
      title: 'A column of W, dotted with dz',
      codeTitle: 'dx.py',
      code: `
        # column 1 of W: [2, 1]          #@c1
        # 2*2 + 1*(-1) = 3: dx[1]        #@c1
        # column 0: 1*2 + 3*(-1) = -1    #@c0
        # column 2: -1*2 + 2*(-1) = -4   #@c2
        W.T    # columns become rows     #@T
        dx = W.T @ dz   # [-1, 3, -4]    #@dx
        dx.shape        # (3,), like x   #@fit
      `,
      beats: [
        { id: 'c1', say: '{x₁|x one} used the two weights down column one of W, each times the gradient of its own row. That is column one, dotted with {dz|d z}.', code: 'c1' },
        { id: 'c0', say: 'Each entry of x does the same with its own column. Column zero is one and three: one times two, plus three times minus one, is minus one.', code: 'c0' },
        { id: 'c2', say: 'And column two gives minus four.', code: 'c2' },
        { id: 'T', say: 'Transposing W lays its columns down as rows: {Wᵀ|W transpose}, three by two.', code: 'T' },
        { id: 'Tdz', say: 'So the whole gradient is one product, {Wᵀ dz|W transpose, d z}: each row of {Wᵀ|W transpose}, dotted with {dz|d z}.', code: 'dx' },
        { id: 'row', say: 'On the page, {dz|d z} is written across, so the shapes can look like three by two, times one by two. Those do not fit.', code: 'dx' },
        { id: 'stand', say: 'But a vector multiplied by a matrix stands as a column, just as x does in {Wx|W x}. Stood up, {dz|d z} is two by one.', code: 'dx' },
        { id: 'fit', say: 'Three by two, times two by one: the inner twos match, and out comes three by one. That is the shape of x, as its gradient must be.', code: ['dx', 'fit'] },
      ],
    },
    {
      id: 'try',
      title: 'Check the shape, then try two',
      codeTitle: 'check.py',
      code: `
        # dW: (2, 1) @ (1, 3) -> (2, 3)      #@aid
        # dx: (3, 2) @ (2,) -> (3,)          #@aid2
        # W @ dz: (2, 3) @ (2,): no fit      #@aid2
        W = np.array([[1, 4],                #@p1
                      [2, -3]])              #@p1
        dz = np.array([3, -1])               #@p1
        dx1 = W[0,1]*dz[0] + W[1,1]*dz[1]    #@a1
        #   = 4*3 + (-3)*(-1) = 15           #@a1
        W.T @ dz           # [1, 15]         #@a2
      `,
      beats: [
        { id: 'aid', say: 'Shapes check the answer. {dz xᵀ|d z, x transpose} is two by three, like W: that is the gradient on W.', code: 'aid' },
        { id: 'aid2', say: '{Wᵀ dz|W transpose, d z} has three entries, like x. And W times {dz|d z} does not even fit: rows of three, against two numbers.', code: 'aid2' },
        { id: 'p1', say: 'Try one. W\'s first row is one, four, its second is two, minus three, and {dz|d z} is three, minus one. What is {∂f/∂x|partial f, partial x}?', code: 'p1' },
        { id: 'a1', say: 'Entry one meets column one of W: four and minus three. Dot it with {dz|d z}: four times three, plus minus three times minus one. Twelve plus three is fifteen.', code: 'a1' },
        { id: 'a2', say: 'Column zero is one and two: one times three, plus two times minus one, is one. With column one\'s fifteen, {∂f/∂x|partial f, partial x} is one, fifteen.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

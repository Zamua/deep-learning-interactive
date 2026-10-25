import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-matmul-grad',
  title: 'Matrix gradients',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'graph',
      title: 'One entry, one small graph',
      codeTitle: 'node.py',
      code: `
        W = np.array([[1, 2, -1],    #@W
                      [3, 1,  2]])   #@W
        x = np.array([3, 4, 1])      #@x
        z = W @ x        # [10, 15]  #@z
        # z[0] = W[0,0] * x[0]       #@z0
        #      + W[0,1] * x[1]       #@z0
        #      + W[0,2] * x[2]       #@z0
        dz = np.array([2, -1])       #@dz
        dW01 = dz[0] * x[1]   # 8    #@swap
        # dW[i,j] = dz[i] * x[j]     #@rule
      `,
      beats: [
        { id: 'node', say: 'Take a node that computes z equals W times x: W is two by three, and x has three entries.', code: ['W', 'x', 'z'] },
        { id: 'name', say: 'Write {W₀₁|W zero one} for the entry of W in row zero, column one, and {x₁|x one} for entry one of x.', code: ['W', 'x'] },
        { id: 'z0', say: 'Then {z₀|z zero}, row zero dotted with x, is {W₀₀x₀ + W₀₁x₁ + W₀₂x₂|W zero zero x zero, plus W zero one x one, plus W zero two x two}: ten.', code: 'z0' },
        { id: 'gates', say: 'As a graph, that is three multiply gates feeding one add.', code: 'z0' },
        { id: 'dz', say: 'Backprop hands the node {∂f/∂z|partial f, partial z}, the gradient from above: one number per entry of z, here two and minus one. Code calls it {dz|d z}.', code: 'dz' },
        { id: 'copy', say: 'Walking back, the add copies {∂f/∂z₀|partial f, partial z zero}, two, to every product.', code: 'dz' },
        { id: 'swap', say: 'And each multiply swaps: {W₀₁|W zero one} gets the other input, {x₁|x one}, four, times two. Eight.', code: 'swap' },
        { id: 'rule', say: 'In general, the weight in row i, column j gets {∂f/∂zᵢ|partial f, partial z i} times {xⱼ|x j}: its row\'s output gradient, times its column\'s input.', code: 'rule' },
      ],
    },
    {
      id: 'grid',
      title: 'The whole grid',
      codeTitle: 'grid.py',
      code: `
        dW = np.zeros((2, 3))               #@zeros
        dW[0] = dz[0] * x   # [6, 8, 2]     #@r0
        dW[1] = dz[1] * x   # [-3, -4, -1]  #@r1
        dW = np.outer(dz, x)   # the same   #@outer
        dW.shape               # (2, 3)     #@shape
      `,
      beats: [
        { id: 'fill', say: 'Do that for every weight to fill {∂f/∂W|partial f, partial W}, a grid shaped like W. Row zero: two times three, two times four, two times one.', code: ['zeros', 'r0'] },
        { id: 'table', say: 'Row one is minus one times each. So row i is x, scaled by {∂f/∂zᵢ|partial f, partial z i}: a multiplication table, {dz|d z} down the side, x across the top.', code: ['r1', 'r0'] },
        { id: 'outer', say: 'That table is the outer product, {dz xᵀ|d z, x transpose}: {dz|d z} as a column, two by one, times x transposed into a row, one by three.', code: 'outer' },
        { id: 'shapes', say: 'Two by one, times one by three, gives two by three: the same shape as W, as a gradient must be.', code: 'shape' },
      ],
    },
    {
      id: 'input',
      title: 'The gradient on x',
      codeTitle: 'dx.py',
      code: `
        # x[1] feeds z[0] and z[1]         #@feeds
        dx1 = W[0,1]*dz[0] + W[1,1]*dz[1]  #@sum
        #   = 2*2 + 1*(-1) = 3             #@sum
        # dx[j] = column j of W, dot dz    #@col
        dx = W.T @ dz      # [-1, 3, -4]   #@dx
        dx.shape           # (3,)          #@dx
      `,
      beats: [
        { id: 'feeds', say: 'Now x. Each entry of x feeds every entry of z: {x₁|x one} meets {W₀₁|W zero one} on the way to {z₀|z zero}, and {W₁₁|W one one} on the way to {z₁|z one}.', code: 'feeds' },
        { id: 'sum', say: 'Each multiply swaps, so {x₁|x one} gets two times two, and one times minus one. A value used twice adds its gradients: {∂f/∂x₁|partial f, partial x one} is three.', code: 'sum' },
        { id: 'col', say: 'In general, {∂f/∂xⱼ|partial f, partial x j} is column j of W, dotted with {dz|d z}. Columns zero and two give minus one and minus four.', code: 'col' },
        { id: 'wt', say: 'Columns of W are rows of {Wᵀ|W transpose}, so {∂f/∂x|partial f, partial x} is {Wᵀ dz|W transpose d z}: three by two times two gives three, the shape of x.', code: 'dx' },
      ],
    },
    {
      id: 'try',
      title: 'Check the shape, then try one',
      codeTitle: 'check.py',
      code: `
        # dW: (2, 1) @ (1, 3) -> (2, 3)   #@aid
        # dx: (3, 2) @ (2,) -> (3,)       #@aid
        x = np.array([2, 5])              #@p1
        dz = np.array([3, -1])            #@p1
        dz[1] * x[0]       # -2           #@a1
        W = np.array([[1, 4],             #@p2
                      [2, -3]])           #@p2
        W.T @ dz           # [1, 15]      #@a2
      `,
      beats: [
        { id: 'aid', say: 'Shapes check the answer: a gradient has the shape of what it is the gradient of, and only one product of {dz|d z} with x, or W, has it.', code: 'aid' },
        { id: 'p1', say: 'Try one: x is two, five, and {dz|d z} is three, minus one. What is entry one, zero of {∂f/∂W|partial f, partial W}?', code: 'p1' },
        { id: 'a1', say: 'Row one picks {z₁|z one}\'s gradient, minus one; column zero picks {x₀|x zero}, two. Minus two.', code: 'a1' },
        { id: 'p2', say: 'Now W has rows one, four and two, minus three. What is {∂f/∂x|partial f, partial x}?', code: 'p2' },
        { id: 'a2', say: 'Dot each column of W with {dz|d z}: three minus two is one, and twelve plus three is fifteen.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-weight-grad',
  title: 'Weight gradients',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'why',
      title: 'A grid of slopes',
      codeTitle: 'node.py',
      code: `
        W = np.array([[1, 2, -1],    #@W
                      [3, 1,  2]])   #@W
        x = np.array([3, 4, 1])      #@x
        z = W @ x        # [10, 15]  #@z
        # z -> rest of graph -> f    #@f
        # dW: shaped like W, all ?   #@dW
        dz = np.array([2, -1])       #@dz
      `,
      beats: [
        { id: 'node', say: 'Picture one node inside a bigger graph. It multiplies a vector, x, by a matrix, W.', code: ['W', 'x'] },
        { id: 'out', say: 'Its result, z, flows on through the rest of the graph, which ends in a single number, f.', code: ['z', 'f'] },
        { id: 'weights', say: 'Each entry of W is called a weight, because it weighs how much one entry of x counts toward one entry of z. This W holds six.', code: 'W' },
        { id: 'nudge', say: 'Nudge one weight, the one in row zero, column one, and f moves.', code: 'W' },
        { id: 'name', say: 'Call that weight {W₀₁|W zero one}: row zero, column one, both counted from zero.', code: 'W' },
        { id: 'grid', say: 'How far f moves per nudge of each weight is the gradient {∂f/∂W|partial f, partial W}: a grid shaped like W, one slope per weight, saying which way to nudge each.', code: 'dW' },
        { id: 'dz', say: 'Backprop has already walked back from f to this node\'s output, so {∂f/∂z|partial f, partial z} has arrived: one number per entry of z, here two and minus one.', code: 'dz' },
        { id: 'ask', say: 'In code it is called {dz|d z}. From it and x, the node must work out {∂f/∂W|partial f, partial W}.', code: ['dz', 'dW'] },
      ],
    },
    {
      id: 'gate',
      title: 'One weight, one gate',
      codeTitle: 'gate.py',
      code: `
        # z[0] = W[0,0] * x[0]        #@z0
        #      + W[0,1] * x[1]        #@z0
        #      + W[0,2] * x[2]        #@z0
        dz[0]                 # 2     #@copy
        dW01 = dz[0] * x[1]   # 8     #@swap
        dW[0] = dz[0] * x  # [6, 8, 2] #@row
        # W[0,1] never meets z[1]     #@z1
        # dW[i,j] = dz[i] * x[j]      #@rule
      `,
      beats: [
        { id: 'row', say: 'Zoom in on {W₀₁|W zero one}. It sits in row zero, so it helps make only {z₀|z zero}, the first entry of z: row zero of W, dotted with x.', code: 'z0' },
        { id: 'gates', say: 'A dot product is a few multiplies, added up. So as a graph, each weight meets its entry of x in a multiply gate, and one add sums the three.', code: 'z0' },
        { id: 'x1', say: '{W₀₁|W zero one}\'s partner is {x₁|x one}, entry one of x, which is four.', code: 'z0' },
        { id: 'copy', say: 'Now walk back. {∂f/∂z₀|partial f, partial z zero}, which is two, arrives at the add, and the add copies it to every multiply.', code: 'copy' },
        { id: 'swap', say: 'The multiply swaps: {W₀₁|W zero one} gets its partner\'s value, four, times two. Eight.', code: 'swap' },
        { id: 'row0', say: 'Its neighbors in row zero work the same way, each with its own partner from x.', code: 'row' },
        { id: 'z1', say: 'And {z₁|z one}\'s gradient never reaches {W₀₁|W zero one} at all: that weight plays no part in {z₁|z one}.', code: 'z1' },
        { id: 'rule', say: 'So in general, the weight in row i, column j gets the gradient on output i, times input j.', code: 'rule' },
      ],
    },
    {
      id: 'grid',
      title: 'The whole table',
      codeTitle: 'grid.py',
      code: `
        dW = np.zeros((2, 3))               #@zeros
        dW[0] = dz[0] * x   # [6, 8, 2]     #@r0
        dW[1] = dz[1] * x   # [-3, -4, -1]  #@r1
        dW[1, 0]            # -1 * 3 = -3   #@e10
        dW = np.outer(dz, x)   # the same   #@outer
        dW.shape               # (2, 3)     #@shape
      `,
      beats: [
        { id: 'fill', say: 'Do that for every weight, and {∂f/∂W|partial f, partial W} fills in. Row zero is x times two: six, eight and two.', code: ['zeros', 'r0'] },
        { id: 'row1', say: 'Row one is x times {z₁|z one}\'s gradient, which is minus one: so minus three, minus four and minus one.', code: 'r1' },
        { id: 'e10', say: 'So entry one, zero, in row one and column zero, is minus one times three: minus three. The row picks the gradient, and the column picks the input.', code: 'e10' },
        { id: 'table', say: 'Seen whole, it is a multiplication table: {dz|d z} down the side, x across the top, and in each cell, its row\'s number times its column\'s.', code: ['r0', 'r1'] },
        { id: 'outer', say: 'It is called the outer product of {dz|d z} and x. A dot product pairs two vectors inward, down to one number. The outer product spreads them out, every entry with every entry, into a table.', code: 'outer' },
        { id: 'T', say: 'As a matrix product, it is {dz xᵀ|d z, x transpose}: {dz|d z} standing as a column, two by one, times x laid down as a row, one by three.', code: 'outer' },
        { id: 'shapes', say: 'Two by one, times one by three: the inner ones match and vanish, leaving two by three, the shape of W, as its gradient must be.', code: 'shape' },
        { id: 'flip', say: 'The other order, x times {dzᵀ|d z transpose}, builds the same table on its side: three by two, which does not fit W.', code: 'outer' },
        { id: 'big', say: 'The shapes work the same at any size: a ten by {3,072|three thousand and seventy two} W gets a ten by {3,072|three thousand and seventy two} gradient.', code: 'shape' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

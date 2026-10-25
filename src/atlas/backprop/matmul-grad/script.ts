import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-matmul-grad',
  title: 'Matrix gradients',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'shapes',
      title: 'The shapes decide',
      codeTitle: 'matmul.py',
      code: `
        W = np.array([[1, 2, 0], [-1, 1, 3]])  # (2, 3)  #@W
        x = np.array([3, 0, 2])                 # (3,)    #@x
        z = W @ x                               # (2,)    #@z
        dz = np.array([1, -2])   # from above   # (2,)    #@dz
        dW = np.outer(dz, x)                    # (2, 3)  #@dW
        dx = W.T @ dz                           # (3,)    #@dx
      `,
      beats: [
        { id: 'fwd', say: 'Take a node that computes z equals W times x. Here W has two rows and three columns, x has three entries, and z has two.', code: ['W', 'x', 'z'] },
        { id: 'dz', say: 'Backprop hands this node the gradient on z: one number per entry of z, so two of them. Call it {dz|d z}.', code: 'dz' },
        { id: 'dwshape', say: 'The gradient on W must have the shape of W, two by three: one number for every entry of W.', code: 'dW' },
        { id: 'outer', say: 'From a column of two and a row of three, only one product makes a two by three grid: the outer product, {dz|d z} times {xᵀ|x transpose}.', code: 'dW' },
        { id: 'dxshape', say: 'The gradient on x must have the shape of x: three numbers. {Wᵀ|W transpose} is three by two, and times {dz|d z} it gives exactly three.', code: 'dx' },
      ],
    },
    {
      id: 'entries',
      title: 'Entry by entry',
      codeTitle: 'entries.py',
      code: `
        # z[i] = sum over j of W[i, j] * x[j]      #@zi
        # dW[i, j] = dz[i] * x[j]                  #@ij
        dW = np.outer(dz, x)                       #@grid
        # [[ 3, 0,  2],                            #@grid
        #  [-6, 0, -4]]                            #@grid
        dx = W.T @ dz        # [3, 0, -6]          #@dx
      `,
      beats: [
        { id: 'zi', say: 'Why the outer product? Each entry {zᵢ|z i} adds up {Wᵢⱼ|W i j} times {xⱼ|x j} over j. So nudging {Wᵢⱼ|W i j} moves {zᵢ|z i} by {xⱼ|x j} times the nudge.', code: 'zi' },
        { id: 'ij', say: 'Its gradient is {dzᵢ|d z i} times {xⱼ|x j}: the gradient on its row\'s entry of z, times its column\'s entry of x. Row one, column two: minus two times two, minus four.', code: 'ij' },
        { id: 'grid', say: 'Fill the grid. In row zero, {dz|d z} is one, so the row is x itself: three, zero, and two. In row one it is minus two: minus six, zero, and minus four.', code: 'grid' },
        { id: 'dx', say: 'And each {xⱼ|x j} feeds every entry of z, so its gradients add up over the rows: column j of W, weighted by {dz|d z}. For x zero, one times one plus minus one times minus two: three.', code: 'dx' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

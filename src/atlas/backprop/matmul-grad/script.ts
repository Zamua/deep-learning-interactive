import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-matmul-grad',
  title: 'Input gradients',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'input',
      title: 'The gradient on x',
      codeTitle: 'dx.py',
      code: `
        W = np.array([[1, 2, -1],          #@node
                      [3, 1,  2]])         #@node
        x = np.array([3, 4, 1])            #@node
        dz = np.array([2, -1])             #@node
        # x[1] feeds z[0] and z[1]         #@feeds
        dx1 = W[0,1]*dz[0] + W[1,1]*dz[1]  #@sum
        #   = 2*2 + 1*(-1) = 3             #@sum
        # dx[j] = column j of W, dot dz    #@col
        dx = W.T @ dz      # [-1, 3, -4]   #@dx
        dx.shape           # (3,)          #@dx
      `,
      beats: [
        { id: 'node', say: 'Back to z equals W times x, with x three, four, one, and {dz|d z} two, minus one. Each weight got its row\'s gradient times its column\'s input, so {∂f/∂W|partial f, partial W} was {dz xᵀ|d z, x transpose}.', code: 'node' },
        { id: 'feeds', say: 'Now x. Each entry of x feeds every entry of z: {x₁|x one} meets {W₀₁|W zero one} on the way to {z₀|z zero}, and {W₁₁|W one one} on the way to {z₁|z one}.', code: 'feeds' },
        { id: 'sum', say: 'Each multiply swaps, so {x₁|x one} gets two times two, and one times minus one. A value used twice adds its gradients: {∂f/∂x₁|partial f, partial x one} is three.', code: 'sum' },
        { id: 'col', say: 'In general, {∂f/∂xⱼ|partial f, partial x j} is column j of W, dotted with {dz|d z}. Columns zero and two give minus one and minus four.', code: 'col' },
        { id: 'wt', say: 'Columns of W are rows of {Wᵀ|W transpose}, so {∂f/∂x|partial f, partial x} is {Wᵀ dz|W transpose d z}: three by two times two gives three, the shape of x.', code: 'dx' },
      ],
    },
    {
      id: 'try',
      title: 'Check the shape, then try two',
      codeTitle: 'check.py',
      code: `
        # dW: (2, 1) @ (1, 3) -> (2, 3)       #@aid
        # dx: (3, 2) @ (2,) -> (3,)           #@aid
        W = np.array([[1, 4],                 #@p1
                      [2, -3]])               #@p1
        dz = np.array([3, -1])                #@p1
        dx1 = W[0,1]*dz[0] + W[1,1]*dz[1]     #@a1
        #   = 4*3 + (-3)*(-1) = 15            #@a1
        W.T @ dz           # [1, 15]          #@a2
      `,
      beats: [
        { id: 'aid', say: 'Shapes check the answer: a gradient has the shape of what it is the gradient of, and only one product of {dz|d z} with x, or W, has it.', code: 'aid' },
        { id: 'p1', say: 'Try one: W has rows one, four and two, minus three, and {dz|d z} is three, minus one. What is entry one of {∂f/∂x|partial f, partial x}?', code: 'p1' },
        { id: 'a1', say: 'Entry one meets column one of W: four and minus three. Dot it with {dz|d z}: four times three, plus minus three times minus one. Twelve plus three is fifteen.', code: 'a1' },
        { id: 'p2', say: 'Now all of {∂f/∂x|partial f, partial x}, for the same W and {dz|d z}.', code: 'p1' },
        { id: 'a2', say: 'Column zero is one and two: one times three, plus two times minus one, is one. With column one\'s fifteen, {∂f/∂x|partial f, partial x} is one, fifteen.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

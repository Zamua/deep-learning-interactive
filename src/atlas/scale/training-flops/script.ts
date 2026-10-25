import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-training-flops',
  title: 'Training compute: 6ND',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'forward',
      title: 'Two FLOPs per weight, forward',
      codeTitle: 'flops.py',
      code: `
        W = np.array([[1, 0, 2, -1],   #@W
                      [3, 1, 0, 2],    #@W
                      [0, -2, 1, 1]])  #@W
        x = np.array([2, 1, 3, 1])     #@x
        z = W @ x        # [7, 9, 2]   #@z
        # per weight: one ×, one +     #@two
        # 12 weights: 24 FLOPs         #@model
      `,
      beats: [
        { id: 'layer', say: 'Count the arithmetic in one layer. W holds twelve weights, and x is the vector for one token.', code: ['W', 'x'] },
        { id: 'mult', say: 'Each weight multiplies one entry of x, and the product joins a running sum. Row one: three times two, plus one times one, plus zero, plus two: nine.', code: 'z' },
        { id: 'two', say: 'So each weight costs two floating point operations, or FLOPs, per token: one multiply and one add.', code: 'two' },
        { id: 'model', say: 'Twelve weights make twenty four FLOPs. A model with N parameters spends about two N FLOPs on every token it reads forward.', code: 'model' },
      ],
    },
    {
      id: 'backward',
      title: 'Four more on the way back',
      codeTitle: 'flops.py',
      code: `
        z = W @ x              # 2 per weight  #@fwd
        dx = W.T @ dz          # 2 per weight  #@dx
        dW = np.outer(dz, x)   # 2 per weight  #@dW
        # 6 per parameter per token            #@six
        flops = 6 * n_params * n_tokens        #@nd
      `,
      beats: [
        { id: 'back', say: 'Backpropagation through the same layer needs two more products, each as big as the forward one.', code: ['dx', 'dW'] },
        { id: 'dx', say: '{Wᵀ|W transpose} times {dz|d z} passes the gradient down to x, for the layer below: two FLOPs per weight.', code: 'dx' },
        { id: 'dW', say: 'And the outer product of {dz|d z} and x gives every weight its own gradient: two more.', code: 'dW' },
        { id: 'six', say: 'Two forward and four backward: six FLOPs per parameter, for every token.', code: 'six' },
        { id: 'nd', say: 'Train N parameters on D tokens, and the whole run costs about six N D FLOPs. Call it C, the training compute.', code: 'nd' },
      ],
    },
    {
      id: 'run',
      title: 'Counting a run',
      codeTitle: 'run.py',
      code: `
        n_params = 3e9                    #@nd
        n_tokens = 4e10                   #@nd
        flops = 6 * n_params * n_tokens   #@C
        # 7.2e20                          #@C
        per_second = 100 * 1e14  # 100 GPUs  #@rate
        seconds = flops / per_second   # 72,000  #@time
        hours = seconds / 3600         # 20      #@time
        forward = 2 * n_params         # 6e9     #@fwd
      `,
      beats: [
        { id: 'model', say: 'Take a model with three billion parameters, trained on forty billion tokens.', code: 'nd' },
        { id: 'mult', say: 'Six times three times four is seventy two, and the powers of ten add, nine and ten. That is {72 × 10¹⁹|seventy two times ten to the nineteen}, or {7.2 × 10²⁰|seven point two times ten to the twenty} FLOPs.', code: 'C' },
        { id: 'rate', say: 'A GPU might sustain {10¹⁴|ten to the fourteen} FLOPs per second. A hundred of them together: {10¹⁶|ten to the sixteen}.', code: 'rate' },
        { id: 'time', say: 'Divide, and the run takes {7.2 × 10⁴|seven point two times ten to the four} seconds: seventy two thousand seconds, or twenty hours.', code: 'time' },
        { id: 'fwd', say: 'Once it is trained, reading one token forward costs only two N: six billion FLOPs, a third of what training on it cost.', code: 'fwd' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

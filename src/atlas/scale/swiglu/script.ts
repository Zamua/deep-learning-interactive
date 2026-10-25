import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-swiglu',
  title: 'Gated MLPs',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'gate',
      title: 'Two projections, one gate',
      codeTitle: 'swiglu.py',
      code: `
        def swish(z):
            return z / (1 + np.exp(-z))  # z * sigmoid(z)  #@swish
        gate = x @ W_gate    # h numbers     #@proj
        up = x @ W_up        # h numbers     #@proj
        mid = swish(gate) * up               #@mul
        out = mid @ W_down   # back to d     #@down
      `,
      beats: [
        { id: 'old', say: 'The block\'s MLP widens each token from d numbers to four d, applies a ReLU, and projects back down to d.' },
        { id: 'two', say: 'A gated MLP makes two projections of the token instead, each h numbers wide: a gate, and an up projection.', code: 'proj' },
        { id: 'swish', say: 'The gate goes through swish: z times the sigmoid of z. It is a smooth ReLU, near zero for large negative z, and near z itself for large positive z.', code: 'swish' },
        { id: 'mul', say: 'Then the two are multiplied, entry by entry, and the result is projected back down to d.', code: ['mul', 'down'] },
      ],
    },
    {
      id: 'example',
      title: 'One token, three units',
      codeTitle: 'example.py',
      code: `
        gate = np.array([2, -1, 0])               #@in
        up = np.array([1, 3, -2])                 #@in
        swish(gate)   # [1.76, -0.27, 0]          #@sw
        swish(gate) * up   # [1.76, -0.81, 0]     #@mul
      `,
      beats: [
        { id: 'in', say: 'Say the gate is two, minus one and zero, and the up projection is one, three and minus two.', code: 'in' },
        { id: 'sw', say: 'Swish the gate. The sigmoid of two is about {0.88|zero point eight eight}, so two becomes {1.76|one point seven six}. Minus one becomes minus {0.27|zero point two seven}, and zero stays zero.', code: 'sw' },
        { id: 'mul', say: 'Multiply by the up projection: {1.76|one point seven six}, minus {0.81|zero point eight one}, and zero. A unit is large only when both of its projections are.', code: 'mul' },
      ],
    },
    {
      id: 'width',
      title: 'Three matrices, a narrower middle',
      codeTitle: 'width.py',
      code: `
        relu_mlp = 2 * d * (4 * d)   # 8 d^2    #@relu
        gated = 3 * d * h            # 3 d h    #@gated
        h = 8 * d // 3               # 3dh = 8d^2   #@h
        # d = 768: h = 2048, not 3072           #@eg
      `,
      beats: [
        { id: 'count', say: 'Count the weights. The ReLU MLP has two matrices of d by four d: eight d squared.', code: 'relu' },
        { id: 'three', say: 'The gated MLP has three, gate, up and down, each d by h: three d h. At h equal to four d, that is half again as many.', code: 'gated' },
        { id: 'match', say: 'To keep the same size, set three d h equal to eight d squared: h is eight thirds of d. With d at {768|seven hundred sixty eight}, that is {2,048|two thousand and forty eight} units instead of {3,072|three thousand and seventy two}.', code: ['h', 'eg'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

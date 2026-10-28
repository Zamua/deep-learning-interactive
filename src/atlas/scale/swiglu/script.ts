import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-swiglu',
  title: 'Gated MLPs',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Dauphin, Fan, Auli & Grangier', year: 2016, title: 'Language Modeling with Gated Convolutional Networks', url: 'https://arxiv.org/abs/1612.08083', scene: 'why' },
    { who: 'Shazeer', year: 2020, title: 'GLU Variants Improve Transformer', url: 'https://arxiv.org/abs/2002.05202', scene: 'gate' },
  ],
  scenes: [
    {
      id: 'why',
      title: 'One number, two jobs',
      codeTitle: 'gating.py',
      code: `
        mid = relu(W1 @ x)  # 4d units     #@old
        z = W1[i] @ x       # unit i       #@z
        relu(z)             # 0, or z      #@relu
        # LSTM: a sigmoid gate, 0 to 1     #@lstm
        gate = sigmoid(x @ W_gate)  # GLU  #@glu
        out = gate * (x @ W_up)            #@glu
      `,
      beats: [
        { id: 'old', say: 'The block\'s MLP widens each token from d numbers to four d, through a ReLU, and back down to d. Look at one of those hidden units.', code: 'old' },
        { id: 'one', say: 'It takes one weighted sum of the token, z, and the ReLU decides with that same number: below zero, the unit is off; above, it passes z on.', code: ['z', 'relu'] },
        { id: 'jobs', say: 'So one number does two jobs: whether the unit is on, and how much it says.', code: 'relu' },
        { id: 'lstm', say: 'The LSTM kept such jobs apart. Its gates are sigmoids, dials from zero to one, that multiply a signal computed separately: at one, the signal passes; at zero, it is shut off.', code: 'lstm' },
        { id: 'glu', say: 'In 2016, Yann Dauphin and colleagues put that dial into a language model\'s layers. One weighted sum of the input goes through a sigmoid, and multiplies a second sum, entry by entry.', code: 'glu' },
        { id: 'name', say: 'They called it a gated linear unit, {GLU|G L U}: the second sum stays linear, with no bend of its own, and the gate decides how much of it gets through.', code: 'glu' },
      ],
    },
    {
      id: 'gate',
      title: 'Swish, then multiply',
      codeTitle: 'swiglu.py',
      code: `
        def swish(z):
            return z * sigmoid(z)        #@swish
        gate = x @ W_gate   # h numbers  #@proj
        up = x @ W_up       # h numbers  #@proj
        mid = swish(gate) * up           #@mul
        out = mid @ W_down  # back to d  #@down
      `,
      beats: [
        { id: 'two', say: 'A gated MLP multiplies the token by two weight matrices instead of one, each making h numbers: h for the hidden width.', code: 'proj' },
        { id: 'proj', say: 'Multiplying by a weight matrix is called a projection. Each number it makes is the token dotted with one row: how far the token reaches along that row, like a shadow cast on it. So these are the gate projection and the up projection.', code: 'proj' },
        { id: 'shazeer', say: 'In 2020, Noam Shazeer, one of the Transformer\'s authors, tried such gates in the block\'s MLP, with other bends in place of the sigmoid. Among the best was swish.', code: 'swish' },
        { id: 'swish', say: 'Swish is z times the sigmoid of z: z, gated by its own dial.', code: 'swish' },
        { id: 'ends', say: 'Far below zero, the dial is nearly shut, so swish is near zero. Far above, the dial is nearly open, and swish is nearly z itself: a smooth ReLU, with no ceiling at one.', code: 'swish' },
        { id: 'mul', say: 'So swish the gate projection, multiply it by the up projection entry by entry, and project back down to d. That is a {GLU|G L U} with swish for its gate: {SwiGLU|swish G L U}.', code: ['mul', 'down'] },
      ],
    },
    {
      id: 'example',
      title: 'One token, three units',
      codeTitle: 'example.py',
      code: `
        gate = np.array([2, -1, 0])          #@in
        up = np.array([1, 3, -2])            #@in
        swish(gate)  # [1.76, -0.27, 0]      #@sw
        swish(gate) * up  # [1.76, -0.81, 0] #@mul
        gate[1] = -6      # middle unit      #@off
      `,
      beats: [
        { id: 'in', say: 'Say one token\'s gate projection is two, minus one and zero, and its up projection is one, three and minus two.', code: 'in' },
        { id: 'sw', say: 'Swish the gate. The sigmoid of two is about {0.88|zero point eight eight}, so two becomes {1.76|one point seven six}.', code: 'sw' },
        { id: 'sw2', say: 'The sigmoid of minus one is about {0.27|zero point two seven}, so minus one becomes minus {0.27|zero point two seven}. And zero, times anything, stays zero.', code: 'sw' },
        { id: 'mul', say: 'Multiply by the up projection, entry by entry: {1.76|one point seven six}, minus {0.81|zero point eight one}, and zero.', code: 'mul' },
        { id: 'off', say: 'The last unit\'s up value is minus two, but its gate is zero, so it says nothing. Push the middle unit\'s gate down to minus six, and it falls nearly silent too, whatever its up value.', code: 'off' },
      ],
    },
    {
      id: 'width',
      title: 'Three matrices, narrower',
      codeTitle: 'width.py',
      code: `
        relu_mlp = 2 * d * (4 * d)  # 8d²   #@relu
        gated = 3 * d * h           # 3dh   #@gated
        # 3dh = 8d², so h = 8d / 3          #@h
        d, h = 768, 2048  # not 3072        #@eg
      `,
      beats: [
        { id: 'count', say: 'Now the cost. The ReLU MLP has two matrices, each d by four d: eight d squared weights.', code: 'relu' },
        { id: 'three', say: 'The gated MLP has three, gate, up and down, each d by h. At h of four d, that is twelve d squared: half again as many.', code: 'gated' },
        { id: 'match', say: 'To keep the size, set three d h equal to eight d squared, and divide both sides by three d: h is eight thirds of d.', code: 'h' },
        { id: 'eg', say: 'Shazeer did just that. With d of {768|seven hundred sixty eight}, the middle shrank from {3,072|three thousand and seventy two} to {2,048|two thousand and forty eight}, for the same weights and the same arithmetic.', code: 'eg' },
        { id: 'divine', say: 'Why the gates help, his paper offers no explanation. It attributes their success, as all else, to divine benevolence.', code: 'gated' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

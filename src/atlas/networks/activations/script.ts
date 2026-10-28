import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-activations',
  title: 'Activation functions',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'shapes',
      title: 'Three bends',
      codeTitle: 'activations.py',
      code: `
        np.maximum(0, z)        # ReLU: [0, inf)    #@relu
        1 / (1 + np.exp(-z))    # sigmoid: (0, 1)   #@sig
        np.tanh(z)              # tanh: (-1, 1)     #@tanh
      `,
      beats: [
        { id: 'relu', say: 'Three activations do most of the work. The ReLU keeps positive numbers and zeroes the rest: ReLU of two is two, and ReLU of minus two is zero.', code: 'relu' },
        { id: 'sigmoid', say: 'The sigmoid squashes any number into the range from zero to one. Sigmoid of zero is a half, and of two, about {0.88|zero point eight eight}. Of minus two, it is one minus that: {0.12|zero point one two}.', code: 'sig' },
        { id: 'tanh', say: 'Tanh squashes into the range from minus one to one, centered on zero: tanh of zero is zero. Tanh of one is about {0.76|zero point seven six}, and tanh of minus one is minus {0.76|zero point seven six}.', code: 'tanh' },
        { id: 'ranges', say: 'So the ReLU\'s outputs run from zero up with no limit: {[0, ∞)|zero to infinity}, where {∞|infinity} means no end. A square bracket includes its end, and a round one never reaches it. The sigmoid\'s outputs lie in {(0, 1)|zero to one}, and tanh\'s in {(−1, 1)|minus one to one}.', code: ['relu', 'sig', 'tanh'] },
      ],
    },
    {
      id: 'slopes',
      title: 'Where each goes flat',
      codeTitle: 'slopes.py',
      code: `
        (z > 0) * 1.0    # ReLU: 0 or 1                #@relu
        s * (1 - s)      # sigmoid, with s = sigmoid(z) #@sig
        1 - t**2         # tanh, with t = tanh(z)       #@tanh
      `,
      beats: [
        { id: 'd-relu', say: 'Backprop needs each one\'s slope. The ReLU\'s is the simplest: one where its input is positive, and zero where it is negative.', code: 'relu' },
        { id: 'd-sig', say: 'The sigmoid\'s slope is {σ|sigma} times one minus {σ|sigma}. At zero that is a half times a half: a quarter, the most it ever gets. At two, {0.88|zero point eight eight} times {0.12|zero point one two}: about {0.1|zero point one}.', code: 'sig' },
        { id: 'nudge', say: 'For tanh, nudge the input and watch the output. From zero to {0.01|zero point zero one}, tanh moves by the same {0.01|zero point zero one}: a slope of one. From one to {1.01|one point zero one}, it moves by only about {0.0042|zero point zero zero four two}: a slope of {0.42|zero point four two}.', code: 'tanh' },
        { id: 'd-tanh', say: 'Both fit one rule: tanh\'s slope is one minus tanh squared. At zero, tanh is zero, so the slope is one minus zero squared: one, its most. At one, it is one minus {0.76|zero point seven six} squared, which is one minus {0.58|zero point five eight}: about {0.42|zero point four two}.', code: 'tanh' },
        { id: 'flat', say: 'Far from zero, both squashing curves go flat, and their slopes sink toward zero. A unit stuck out there is saturated: almost no gradient gets through it.', code: ['sig', 'tanh'] },
      ],
    },
    {
      id: 'why',
      title: 'Why ReLU won',
      codeTitle: 'depth.py',
      code: `
        0.25 ** 5    # 0.001: five sigmoids, at best    #@sig
        1.0 ** 5     # 1.0: five ReLUs that are on      #@relu
        # z < 0 for every input: slope 0, gradient 0   #@dead
      `,
      beats: [
        { id: 'chain', say: 'Chain several units one after another, and backprop multiplies the gradient by one slope per link. Through five sigmoids, that is at most a quarter, five times over: about one thousandth.', code: 'sig' },
        { id: 'whole', say: 'Through five ReLUs that are on, it is one, five times: the gradient arrives whole. That is the main reason ReLU became the default.', code: 'relu' },
        { id: 'dead', say: 'The catch is the dead ReLU. A unit whose pre-activation is negative for every input it sees has a slope of zero every time, so no gradient ever reaches the weights feeding it.', code: 'dead' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-activations',
  title: 'Activation functions',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Rosenblatt', year: 1958, title: 'The perceptron: a probabilistic model for information storage and organization in the brain', url: 'https://doi.org/10.1037/h0042519', scene: 'shapes' },
    { who: 'Rumelhart, Hinton & Williams', year: 1986, title: 'Learning representations by back-propagating errors', url: 'https://doi.org/10.1038/323533a0', scene: 'shapes' },
    { who: 'LeCun, Bottou, Orr & Müller', year: 1998, title: 'Efficient BackProp', url: 'https://leon.bottou.org/papers/lecun-98x', scene: 'shapes' },
    { who: 'Nair & Hinton', year: 2010, title: 'Rectified linear units improve restricted Boltzmann machines', url: 'https://www.cs.toronto.edu/~hinton/absps/reluICML.pdf', scene: 'why' },
    { who: 'Glorot, Bordes & Bengio', year: 2011, title: 'Deep sparse rectifier neural networks', url: 'https://proceedings.mlr.press/v15/glorot11a.html', scene: 'why' },
    { who: 'Krizhevsky, Sutskever & Hinton', year: 2012, title: 'ImageNet classification with deep convolutional neural networks', url: 'https://papers.nips.cc/paper/2012/hash/c399862d3b9d6b76c8436e924a68c45b-Abstract.html', scene: 'why' },
  ],
  scenes: [
    {
      id: 'shapes',
      title: 'From a step to an S',
      codeTitle: 'activations.py',
      code: `
        (z > 0) * 1.0           # step: off or on   #@step
        1 / (1 + np.exp(-z))    # sigmoid: (0, 1)   #@sig
        np.tanh(z)              # tanh: (-1, 1)     #@tanh
      `,
      beats: [
        { id: 'bend', say: 'A neuron adds up its weighted inputs into z, then bends z with an activation before passing it on. Which bend to use took the field decades to settle, and each choice fixed a problem with the one before.', code: 'step' },
        { id: 'step', say: 'The first artificial neurons used a step: silent below zero, firing above. Frank Rosenblatt\'s perceptron, in 1958, worked this way.', code: 'step' },
        { id: 'stuck', say: 'But a step is flat everywhere except at the jump, so its slope is zero. Nudge a weight, and the output does not move at all: there is no slope to learn from.', code: 'step' },
        { id: 'sigmoid', say: 'Smooth the step into an S, and you get the sigmoid. It still squashes any number into the range from zero to one, but it has a slope everywhere. In 1986, Rumelhart, Hinton and Williams used it to train networks with backprop.', code: 'sig' },
        { id: 'sig-values', say: 'Sigmoid of zero is a half, and of two, about {0.88|zero point eight eight}. Of minus two, it is one minus that: {0.12|zero point one two}.', code: 'sig' },
        { id: 'tanh', say: 'Its cousin, tanh, is the same S stretched from minus one to one and centered on zero, so a layer\'s outputs average near zero. Yann LeCun and colleagues recommended it in 1998 for exactly that: centered outputs make learning go faster. Tanh of zero is zero, and tanh of one is about {0.76|zero point seven six}.', code: 'tanh' },
      ],
    },
    {
      id: 'slopes',
      title: 'Where the S goes flat',
      codeTitle: 'slopes.py',
      code: `
        s * (1 - s)      # sigmoid, with s = sigmoid(z) #@sig
        1 - t**2         # tanh, with t = tanh(z)       #@tanh
      `,
      beats: [
        { id: 'd-sig', say: 'Backprop needs each one\'s slope. The sigmoid\'s is {σ|sigma} times one minus {σ|sigma}. At zero that is a half times a half: a quarter, the most it ever gets. At two, {0.88|zero point eight eight} times {0.12|zero point one two}: about {0.1|zero point one}.', code: 'sig' },
        { id: 'nudge', say: 'For tanh, nudge the input and watch the output. From zero to {0.01|zero point zero one}, tanh moves by the same {0.01|zero point zero one}: a slope of one. From one to {1.01|one point zero one}, it moves by only about {0.0042|zero point zero zero four two}: a slope of {0.42|zero point four two}.', code: 'tanh' },
        { id: 'd-tanh', say: 'Both fit one rule: tanh\'s slope is one minus tanh squared. At zero, tanh is zero, so the slope is one minus zero squared: one, its most. At one, it is one minus {0.76|zero point seven six} squared, which is one minus {0.58|zero point five eight}: about {0.42|zero point four two}.', code: 'tanh' },
        { id: 'flat', say: 'Far from zero, both curves go flat, and their slopes sink toward zero. A unit stuck out there is saturated: almost no gradient gets through it.', code: ['sig', 'tanh'] },
      ],
    },
    {
      id: 'why',
      title: 'Then the ReLU',
      codeTitle: 'depth.py',
      code: `
        0.25 ** 5         # 5 sigmoids: 0.001   #@sig
        np.maximum(0, z)  # ReLU: [0, inf)      #@relu
        (z > 0) * 1.0     # slope: 0 or 1       #@drelu
        1.0 ** 5          # 5 ReLUs, on: 1.0    #@whole
        # z < 0 always: no gradient             #@dead
      `,
      beats: [
        { id: 'chain', say: 'That flatness is why deep networks stalled for years. Chain units one after another, and backprop multiplies the gradient by one slope per link. Through five sigmoids, that is at most a quarter, five times over: about one thousandth.', code: 'sig' },
        { id: 'relu', say: 'The fix, around 2010, was almost embarrassingly simple: keep positive numbers, and zero the rest. That is the ReLU, for rectified linear unit. ReLU of two is two, and ReLU of minus two is zero.', code: 'relu' },
        { id: 'd-relu', say: 'Its slope is the simplest of all: one where its input is positive, and zero where it is negative. Nair and Hinton used it in 2010, and Glorot, Bordes and Bengio showed in 2011 that it trains deep networks well.', code: 'drelu' },
        { id: 'whole', say: 'Through five ReLUs that are on, the gradient is multiplied by one, five times: it arrives whole. In 2012, the AlexNet paper showed a network with ReLUs reaching the same training error six times faster than with tanh, and ReLU became the default.', code: 'whole' },
        { id: 'ranges', say: 'So the ReLU\'s outputs run from zero up with no limit: {[0, ∞)|zero to infinity}, where {∞|infinity} means no end. A square bracket includes its end, and a round one never reaches it. The sigmoid\'s outputs lie in {(0, 1)|zero to one}, and tanh\'s in {(−1, 1)|minus one to one}.', code: ['relu', 'sig'] },
        { id: 'dead', say: 'The catch is the dead ReLU. A unit whose pre-activation is negative for every input it sees has a slope of zero every time, so no gradient ever reaches the weights feeding it.', code: 'dead' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

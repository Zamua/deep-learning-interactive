import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-neuron',
  title: 'A neuron',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'sum',
      title: 'Weigh, add, bend',
      codeTitle: 'neuron.py',
      code: `
        x = np.array([2, 1])       #@x
        w = np.array([1, -3])      #@w
        b = 2                      #@b
        z = w @ x + b    # 1       #@z
        a = max(0, z)    # 1       #@a
        # x = [1, 2]: z = -3, a = 0   #@neg
      `,
      beats: [
        { id: 'inputs', say: 'A neuron takes in a vector, x. This one has two entries: two and one.', code: 'x' },
        { id: 'weights', say: 'It keeps one weight per entry, w, here one and minus three, and multiplies each input by its weight.', code: 'w' },
        { id: 'sum', say: 'Then it adds up the products, plus a bias, b, of two. Two, minus three, plus two: one. That sum is the pre-activation, {z = w · x + b|z, equal to w dot x plus b}.', code: ['b', 'z'] },
        { id: 'relu', say: 'Last comes the bend, the activation. Here it is a ReLU, {max(0, z)|max of zero and z}: the larger of zero and z. It keeps a positive number and turns a negative one into zero. One is positive, so the output, a, is one.', code: 'a' },
        { id: 'neg', say: 'Feed it one and two instead. One, minus six, plus two is minus three, and the ReLU turns that into zero. The neuron stays silent.', code: 'neg' },
      ],
    },
    {
      id: 'bend',
      title: 'A linear classifier with a bend',
      codeTitle: 'neuron.py',
      code: `
        z = w @ x + b         # a linear score    #@lin
        # z = 0 on the line x0 - 3*x1 + 2 = 0      #@line
        a = np.maximum(0, z)  # 0 on one side      #@half
        # w turns the line; b slides it            #@bias
      `,
      beats: [
        { id: 'linear', say: 'Before the bend, w dot x plus b is exactly a class score from a linear classifier. Across the inputs, it rises steadily in one direction and falls in the other.', code: 'lin' },
        { id: 'line', say: 'It is zero along a straight line. Every input on one side scores above zero, and every input on the other side below.', code: 'line' },
        { id: 'half', say: 'The ReLU flattens the negative side to zero. So a neuron splits its inputs with a line: silent on one side, and growing with the distance on the other. A linear classifier with a bend.', code: 'half' },
        { id: 'bias', say: 'The weights set which way the line faces, and the bias slides it. With a bias of zero, the line would have to pass through the origin.', code: 'bias' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

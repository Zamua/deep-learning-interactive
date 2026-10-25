import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-param-count',
  title: 'Parameter count',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'grid',
      title: 'Weights and biases',
      codeTitle: 'count.py',
      code: `
        D, C = 4, 3                        #@dims
        W = np.zeros((C, D))   # (3, 4)    #@W
        b = np.zeros(C)        # (3,)      #@b
        W.size + b.size        # 12 + 3    #@count
      `,
      beats: [
        { id: 'dims', say: 'How many numbers make up a linear classifier? Say each input has four features, so D is four, and there are three classes, so C is three.', code: 'dims' },
        { id: 'rows', say: 'W holds one row per class, and each row holds one weight per feature. Three rows of four make twelve weights.', code: 'W' },
        { id: 'bias', say: 'Then each class has one bias: three more.', code: 'b' },
        { id: 'total', say: 'Fifteen numbers in all: these are its parameters. In general, it is C times D, plus C.', code: 'count' },
        { id: 'shape', say: 'As shapes: W is C by D, three by four, and b is a vector of C numbers.', code: ['W', 'b'] },
      ],
    },
    {
      id: 'grows',
      title: 'What the count depends on',
      codeTitle: 'count.py',
      code: `
        C * D + C                # 15                  #@base
        (C + 1) * D + (C + 1)    # one more class: 20  #@class
        C * (4 * D) + C          # 4x the pixels: 51   #@side
        # 1,000x the images: still 15                  #@data
      `,
      beats: [
        { id: 'class', say: 'Add a class, and W gains a whole row, plus one more bias.', code: ['base', 'class'] },
        { id: 'side', say: 'Feed it bigger images, and every row grows longer. Twice the width and twice the height is four times the pixels, so four times the weights.', code: 'side' },
        { id: 'data', say: 'One thing never enters the count: how many images it scores. Ten or a million, W keeps the same shape.', code: 'data' },
      ],
    },
    {
      id: 'layers',
      title: 'Two in a row',
      codeTitle: 'chain.py',
      code: `
        W1 = np.zeros((H, D))   # (5, 4)   #@l1
        b1 = np.zeros(H)        # (5,)     #@l1
        W2 = np.zeros((C, H))   # (3, 5)   #@l2
        b2 = np.zeros(C)        # (3,)     #@l2
        # (20 + 5) + (15 + 3) = 43         #@sum
      `,
      beats: [
        { id: 'two', say: 'Now chain two of these, so the outputs of the first are the inputs of the second. Four inputs go to H, five numbers in the middle, and those go to the three classes.' },
        { id: 'l1', say: 'The first map, {W₁|W one} and {b₁|b one}, has D times H weights, one per line, plus H biases: twenty plus five, twenty five.', code: 'l1' },
        { id: 'l2', say: 'The second map, {W₂|W two} and {b₂|b two}, has H times C weights, plus C biases: fifteen plus three, eighteen.', code: 'l2' },
        { id: 'sum', say: 'Add the two: forty three. Each one is inputs times outputs, plus one bias per output.', code: 'sum' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

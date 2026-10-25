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
        { id: 'dims', say: 'How many numbers does a linear classifier learn? Say each input has four features, so D is four, and there are three classes, so C is three.', code: 'dims' },
        { id: 'rows', say: 'W holds one row per class, and each row holds one weight per feature. Three rows of four make twelve weights.', code: 'W' },
        { id: 'bias', say: 'Then each class has one bias: three more.', code: 'b' },
        { id: 'total', say: 'Fifteen parameters in all. In general, it is C times D, plus C.', code: 'count' },
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
        { id: 'data', say: 'One thing never enters the count: the number of training images. Ten or a million, W keeps the same shape.', code: 'data' },
      ],
    },
    {
      id: 'layers',
      title: 'Two layers',
      codeTitle: 'two_layer.py',
      code: `
        W1 = np.zeros((H, D))   # (5, 4)   #@l1
        b1 = np.zeros(H)        # (5,)     #@l1
        W2 = np.zeros((C, H))   # (3, 5)   #@l2
        b2 = np.zeros(C)        # (3,)     #@l2
        # (20 + 5) + (15 + 3) = 43         #@sum
      `,
      beats: [
        { id: 'two', say: 'A two-layer network is two of these in a row. Four inputs go to five hidden units, H, and those go to the three classes.' },
        { id: 'l1', say: 'The first layer has D times H weights, one per line, plus H biases: twenty plus five, twenty five.', code: 'l1' },
        { id: 'l2', say: 'The second has H times C weights, plus C biases: fifteen plus three, eighteen.', code: 'l2' },
        { id: 'sum', say: 'Add the layers: forty three. Every layer is inputs times outputs, plus one bias per output.', code: 'sum' },
      ],
    },
    {
      id: 'example',
      title: 'Worked example',
      codeTitle: 'example.py',
      code: `
        D = 32 * 32 * 3     # 3072     #@D
        C = 10                         #@D
        C * D               # 30720    #@W
        C * D + C           # 30730    #@total
      `,
      beats: [
        { id: 'ask', say: 'Your turn. A linear classifier for {CIFAR-10|see-far ten} takes {32 × 32|thirty two by thirty two} color images and scores ten classes. How many parameters does it learn?' },
        { id: 'D', say: 'Each pixel holds three numbers, red, green and blue, so one image flattens to {32 × 32 × 3|thirty two times thirty two times three}: D is {3,072|three thousand and seventy two}.', code: 'D' },
        { id: 'W', say: 'W has ten rows of {3,072|three thousand and seventy two} weights: {30,720|thirty thousand, seven hundred and twenty}.', code: 'W' },
        { id: 'total', say: 'Plus ten biases makes {30,730|thirty thousand, seven hundred and thirty} parameters.', code: 'total' },
      ],
    },
  ],
};

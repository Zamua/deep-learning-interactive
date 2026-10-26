import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-pooling',
  title: 'Pooling',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'max',
      title: 'Max and average',
      codeTitle: 'pool.py',
      code: `
        x = torch.tensor([[1., 3, 2, 0],          #@x
                          [5, 2, 1, 4],           #@x
                          [0, 1, 6, 2],           #@x
                          [2, 3, 1, 1]])          #@x
        pool = nn.MaxPool2d(2)    # 2x2, stride 2   #@pool
        pool(x[None])   # [[5, 4], [3, 6]]        #@max
        # out[1, 0] = max of x[2:4, 0:2] = 3      #@map
        # out[i, j]: rows 2i, 2i+1, cols 2j, 2j+1 #@map
        avg = nn.AvgPool2d(2)                     #@avg
        avg(x[None])    # [[2.75, 1.75], [1.5, 2.5]]  #@avg
      `,
      beats: [
        { id: 'grid', say: 'Pooling shrinks a channel. Split this four by four grid into two by two windows that do not overlap: a stride of two.', code: ['x', 'pool'] },
        { id: 'max', say: 'Max pooling keeps the largest value in each window: five, four, three and six.', code: 'max' },
        { id: 'out', say: 'The output is two by two: half as tall, half as wide, a quarter of the values.', code: 'max' },
        { id: 'map', say: 'Count rows and columns from zero. The three is output row one, column zero, and its window is input rows two and three, columns zero and one. Output row i reads input rows {2i|two i} and {2i + 1|two i plus one}, and columns work the same way.', code: 'map' },
        { id: 'avg', say: 'Average pooling takes each window\'s mean instead: {2.75|two point seven five}, {1.75|one point seven five}, {1.5|one point five} and {2.5|two point five}.', code: 'avg' },
      ],
    },
    {
      id: 'shape',
      title: 'Shape, and nothing to learn',
      codeTitle: 'pool_shape.py',
      code: `
        pool = nn.MaxPool2d(2)                    #@pool
        x = torch.randn(16, 32, 32)               #@x
        pool(x).shape   # (16, 16, 16)            #@shape
        pool3 = nn.MaxPool2d(3, stride=2)         #@overlap
        x2 = torch.randn(16, 27, 27)              #@overlap
        pool3(x2).shape   # (16, 13, 13)          #@overlap
        len(list(pool.parameters()))   # 0        #@none
      `,
      beats: [
        { id: 'channels', say: 'Inputs often come as a stack of grids called channels, like the red, green and blue of a color image. Pooling runs on each channel on its own: sixteen channels of thirty two by thirty two become sixteen of sixteen by sixteen.', code: ['x', 'shape'] },
        { id: 'formula', say: 'The size follows the output size formula, with F and S both two: thirty two minus two, over two, plus one, is sixteen.', code: 'shape' },
        { id: 'overlap', say: 'Windows can also overlap. Three by three windows with a stride of two share an edge column with the next. On twenty seven by twenty seven, that is twenty seven minus three, over two, plus one: thirteen.', code: 'overlap' },
        { id: 'none', say: 'And there is nothing to learn: unlike a filter, pooling has no weights at all. Zero parameters.', code: 'none' },
        { id: 'shift', say: 'When the grid is a filter\'s output, max pooling keeps how well the filter matched in each window, not exactly where. Move the five inside its window, and the output does not change.', code: 'pool' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-pooling',
  title: 'Pooling',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Hubel & Wiesel', year: 1962, title: 'Receptive fields, binocular interaction and functional architecture in the cat\'s visual cortex', url: 'https://doi.org/10.1113/jphysiol.1962.sp006837', scene: 'shift' },
    { who: 'Fukushima', year: 1980, title: 'Neocognitron: a self-organizing neural network model for a mechanism of pattern recognition unaffected by shift in position', url: 'https://doi.org/10.1007/BF00344251', scene: 'shift' },
    { who: 'Riesenhuber & Poggio', year: 1999, title: 'Hierarchical models of object recognition in cortex', url: 'https://doi.org/10.1038/14819', scene: 'shift' },
  ],
  scenes: [
    {
      id: 'shift',
      title: 'A small shift',
      codeTitle: 'shift.py',
      code: `
        x = torch.tensor([[1., 0, 2, 1],    #@x
                          [9, 1, 0, 0],     #@x
                          [0, 1, 1, 0],     #@x
                          [3, 0, 4, 1]])    #@x
        x2 = 0 * x                          #@move
        x2[:, 1:] = x[:, :3]  # 1 right     #@move
        pool = nn.MaxPool2d(2)              #@pool
        pool(x[None])   # [[9, 2], [3, 4]]  #@pool
        pool(x2[None])  # [[9, 2], [3, 4]]  #@same
      `,
      beats: [
        { id: 'map', say: 'A filter slid over an image gives a map of how well each patch matched it. This map has one strong match, a nine, among weak ones.', code: 'x' },
        { id: 'move', say: 'Shift the image one pixel to the right, and the map shifts with it. Nearly every number changes, though what the filter found has only moved one pixel.', code: 'move' },
        { id: 'pool', say: 'Pooling fixes that. Cut the map into two by two windows, and keep only the largest value in each: nine, two, three and four. That is max pooling.', code: 'pool' },
        { id: 'same', say: 'Now shift the image again. The nine moves, but stays inside its window, and so does every window\'s largest value. The pooled output does not change at all.', code: 'same' },
        { id: 'keeps', say: 'So max pooling keeps how strongly the filter matched in each window, and lets go of exactly where. That is the name: each window\'s values are pooled into one.', code: 'pool' },
        { id: 'cells', say: 'The idea comes from the brain. In 1962, Hubel and Wiesel described complex cells in the cat\'s visual cortex, which answer to an edge at one angle anywhere in a larger patch.', code: 'pool' },
        { id: 'later', say: 'Fukushima\'s neocognitron, in 1980, built that in, so a pattern still registered when it moved a little. In 1999, Maximilian Riesenhuber and Tomaso Poggio made the case for the max: the largest value still signals the best match.', code: 'pool' },
      ],
    },
    {
      id: 'max',
      title: 'Max and average',
      codeTitle: 'pool.py',
      code: `
        x = torch.tensor([[1., 0, 2, 1],    #@x
                          [9, 1, 0, 0],     #@x
                          [0, 1, 1, 0],     #@x
                          [3, 0, 4, 1]])    #@x
        pool = nn.MaxPool2d(2)  # stride 2  #@pool
        pool(x[None])   # [[9, 2], [3, 4]]  #@max
        # out[1, 0]: max of x[2:4, 0:2]     #@map
        # out[i, j]: x[2i:2i+2, 2j:2j+2]    #@rule
        avg = nn.AvgPool2d(2)               #@avg
        avg(x[None])                        #@avg
        # [[2.75, 0.75], [1.0, 1.5]]        #@avg
      `,
      beats: [
        { id: 'grid', say: 'Now the numbers, on that same map: one channel, four by four. Its two by two windows do not overlap: each starts two cells after the last, a stride of two.', code: ['x', 'pool'] },
        { id: 'max', say: 'Max pooling keeps each window\'s largest value. Read row by row, that is nine, two, three and four.', code: 'max' },
        { id: 'out', say: 'Four by four becomes two by two: half as tall, half as wide, and a quarter of the numbers for the next layer to read.', code: 'max' },
        { id: 'map', say: 'Count rows and columns from zero. The three is output row one, column zero. Its window is input rows two and three, columns zero and one.', code: 'map' },
        { id: 'rule', say: 'Each output row covers two input rows: output row i covers input rows {2i|two times i} and {2i + 1|two times i, plus one}. Columns work the same way.', code: 'rule' },
        { id: 'avg', say: 'Average pooling takes each window\'s mean instead. The top left window adds up to eleven, and eleven over four is {2.75|two point seven five}.', code: 'avg' },
      ],
    },
    {
      id: 'shape',
      title: 'Shape, and nothing to learn',
      codeTitle: 'pool_shape.py',
      code: `
        pool = nn.MaxPool2d(2)              #@pool
        x = torch.randn(16, 32, 32)         #@x
        pool(x).shape   # (16, 16, 16)      #@shape
        # (32 - 2) / 2 + 1 = 16             #@formula
        pool = nn.MaxPool2d(3, stride=2)    #@overlap
        x2 = torch.randn(16, 27, 27)        #@overlap
        pool(x2).shape  # (16, 13, 13)      #@overlap
        len(list(pool.parameters()))  # 0   #@none
      `,
      beats: [
        { id: 'channels', say: 'A layer\'s output has one channel per filter, and pooling runs on each channel on its own. Sixteen channels of thirty two by thirty two become sixteen of sixteen by sixteen.', code: ['x', 'shape'] },
        { id: 'formula', say: 'The height and width follow the output size formula, with a window size F of two and a stride S of two: thirty two minus two, over two, plus one, is sixteen.', code: 'formula' },
        { id: 'overlap', say: 'Windows may also overlap: three by three, with a stride of two, so each shares a column with the next. Twenty seven wide becomes twenty seven minus three, over two, plus one: thirteen.', code: 'overlap' },
        { id: 'none', say: 'And pooling learns nothing. A filter\'s weights are its parameters: the numbers a layer learns, which set what it finds. A max or an average is a fixed rule, so pooling has zero parameters.', code: 'none' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

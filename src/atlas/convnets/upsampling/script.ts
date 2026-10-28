import type { LectureScript } from '../../../lecture/types';

const stampCode = `
  x = [1, 2, 3]                          #@x
  w = [1, 2, 1]                          #@w
  S = 2                                  #@S
  out = [0] * 7                          #@out
  for i in range(len(x)):                #@loop
      for k in range(len(w)):            #@loop
          out[S * i + k] += x[i] * w[k]  #@add
  # out: [1, 2, 3, 4, 5, 6, 3]           #@res
`;

export const script: LectureScript = {
  id: 'atlas-upsampling',
  title: 'Upsampling for segmentation',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Long, Shelhamer & Darrell', year: 2015, title: 'Fully convolutional networks for semantic segmentation', url: 'https://arxiv.org/abs/1411.4038', scene: 'pixels' },
    { who: 'Dumoulin & Visin', year: 2016, title: 'A guide to convolution arithmetic for deep learning', url: 'https://arxiv.org/abs/1603.07285', scene: 'name' },
  ],
  scenes: [
    {
      id: 'pixels',
      title: 'A label for every pixel',
      codeTitle: 'segment.py',
      code: `
        x.shape          # (3, 64, 64)     #@x
        feats.shape      # (256, 8, 8)     #@shrink
        scores.shape     # (C, 64, 64)     #@grow
        scores.argmax(0) # (64, 64)        #@label
      `,
      beats: [
        { id: 'one', say: 'A classifier looks at a whole image and answers with one label: the name of a class, like tree.', code: 'x' },
        { id: 'every', say: 'To find where the tree is, every pixel needs its own label: sky, tree or ground. That is segmentation: it splits the image into segments, one per class.', code: 'label' },
        { id: 'shrink', say: 'A ConvNet cannot do that as it stands: its strided convolutions and pooling shrink a {64 × 64|sixty four by sixty four} image into an {8 × 8|eight by eight} grid.', code: 'shrink' },
        { id: 'deep', say: 'It grows deeper instead, to {256|two hundred and fifty six} channels: it knows what is in the image, but only roughly where. Each cell of its grid stands for an eight by eight patch of pixels.', code: 'shrink' },
        { id: 'fcn', say: 'In 2015, Jonathan Long, Evan Shelhamer and Trevor Darrell made a ConvNet label every pixel, with a layer that learns to grow the small grid back to full size. Growing a grid is upsampling.', code: 'grow' },
        { id: 'grow', say: 'At full size, the last layer gives one channel per class, C of them: a score for each class at every pixel, shape {C × 64 × 64|C by sixty four by sixty four}.', code: 'grow' },
        { id: 'argmax', say: 'Each pixel\'s label is its {argmax|arg max}: not its highest score, but which class has it.', code: 'label' },
      ],
    },
    {
      id: 'stamp',
      title: 'Stamp the filter',
      codeTitle: 'upsample.py',
      code: stampCode,
      beats: [
        { id: 'setup', say: 'The layer that grows is a transposed convolution. Take one row: an input, x, of one, two and three, and a filter, w: one, two, one.', code: ['x', 'w'] },
        { id: 'first', say: 'Each input value stamps a copy of the filter, scaled by that value, into the output. The one stamps one, two, one.', code: ['loop', 'add'] },
        { id: 'next', say: 'The next stamp starts S places further on: S is the stride, here two. The two stamps two, four, two.', code: ['S', 'add'] },
        { id: 'add', say: 'Where stamps overlap, they add: position two gets one, plus two. Three.', code: 'add' },
        { id: 'all', say: 'The three stamps three, six, three. Add it all up: one, two, three, four, five, six, three. Three numbers became seven.', code: ['add', 'res'] },
      ],
    },
    {
      id: 'name',
      title: 'Why transposed',
      codeTitle: 'transpose.py',
      code: `
        # conv: w = [1, 2, 1], S = 2      #@gather
        M.shape    # (3, 7): 7 in, 3 out  #@M
        M.T.shape  # (7, 3): 3 in, 7 out  #@T
        M.T @ x    # [1, 2, 3, 4, 5, 6, 3]  #@stamp
      `,
      beats: [
        { id: 'gather', say: 'Why transposed? Run the same filter as an ordinary convolution, stride two, over seven numbers: each of its three outputs gathers a patch of three inputs.', code: 'gather' },
        { id: 'spread', say: 'Reverse every connection, keeping its weight, and each input spreads into a patch of three outputs instead: the stamps.', code: 'gather' },
        { id: 'matrix', say: 'As a matrix, M, the convolution has one row per output, each holding the filter, two places further along each time.', code: 'M' },
        { id: 'flip', say: 'Reversing the wiring turns its rows into columns: the transpose. Now each column, scaled by one input, is a stamp. Hence the name.', code: ['T', 'stamp'] },
        { id: 'history', say: 'Vincent Dumoulin and Francesco Visin explained it this way in 2016. They argued against its older name, deconvolution, which would mean undoing a convolution: this restores only the size.', code: 'stamp' },
      ],
    },
    {
      id: 'size',
      title: 'The output size',
      codeTitle: 'up_size.py',
      code: `
        def up_size(width, F, S, P=0):          #@def
            return S * (width - 1) + F - 2 * P  #@def
        up_size(3, F=3, S=2)         # 7        #@seven
        up_size(3, F=3, S=2, P=1)    # 5        #@pad
        out_size(32, F=4, S=2, P=1)  # 16.0     #@undo
        up_size(16, F=4, S=2, P=1)   # 32       #@undo
      `,
      beats: [
        { id: 'starts', say: 'How long is the output? Call the input\'s width W: here, three. The first stamp starts at zero, and each of the other {W − 1|W minus one} starts S further on, so the last starts at S times {W − 1|W minus one}: four.', code: ['def', 'seven'] },
        { id: 'width', say: 'Add the filter\'s width, F, which is three, and the output is seven long.', code: ['def', 'seven'] },
        { id: 'pad', say: 'Padding, P, runs backwards too: the convolution added P zeros at each end of its input, so this trims P off each end of its output. With P of one, seven becomes five.', code: 'pad' },
        { id: 'formula', say: 'So the width is S times {W − 1|W minus one}, plus F, minus two P.', code: 'def' },
        { id: 'undo', say: 'It is the convolution\'s size rule, run backwards. With a filter of four, stride two and padding one, a convolution halves thirty two into sixteen, and the transposed one doubles it back.', code: 'undo' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

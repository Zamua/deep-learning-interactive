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
  scenes: [
    {
      id: 'pixels',
      title: 'A label for every pixel',
      codeTitle: 'segment.py',
      code: `
        x.shape            # (3, 64, 64): the image   #@x
        feats.shape        # (256, 8, 8): shrunk      #@shrink
        scores.shape       # (C, 64, 64): grown back  #@grow
        scores.argmax(0)   # (64, 64): the labels     #@label
      `,
      beats: [
        { id: 'label', say: 'A classifier gives a whole image one label. Segmentation labels every pixel: this one is sky, that one tree, those ground.', code: ['x', 'label'] },
        { id: 'shrink', say: 'A ConvNet shrinks as it goes. Strided convolutions and pooling take a {64 × 64|sixty four by sixty four} image down to {8 × 8|eight by eight}, with {256|two hundred and fifty six} channels.', code: 'shrink' },
        { id: 'grow', say: 'To label every pixel, it must grow back: a score for each of the C classes at every pixel, {C × 64 × 64|C by sixty four by sixty four}. Each pixel\'s label is the {argmax|arg max} of its scores: the class with the highest one.', code: ['grow', 'label'] },
      ],
    },
    {
      id: 'stamp',
      title: 'Transposed convolution',
      codeTitle: 'upsample.py',
      code: stampCode,
      beats: [
        { id: 'setup', say: 'The layer that grows is a transposed convolution. Here is an input of three numbers, one, two and three, and a filter, w: one, two, one.', code: ['x', 'w'] },
        { id: 'first', say: 'Each input value stamps a copy of the filter, scaled by that value, into the output. The one stamps one, two, one.', code: ['loop', 'add'] },
        { id: 'next', say: 'The next stamp lands S further along: two places, with a stride of two. The two stamps two, four, two.', code: ['S', 'add'] },
        { id: 'add', say: 'Where stamps overlap, they add. Position two gets one plus two: three.', code: 'add' },
        { id: 'all', say: 'The three stamps three, six, three. Add it all up: one, two, three, four, five, six, three. Three numbers became seven.', code: ['add', 'res'] },
      ],
    },
    {
      id: 'size',
      title: 'The output size',
      codeTitle: 'up_size.py',
      code: `
        def up_size(width, F, S, P=0):           #@def
            return S * (width - 1) + F - 2 * P   #@def
        up_size(3, F=3, S=2)         # 7         #@seven
        up_size(3, F=3, S=2, P=1)    # 5         #@pad
        out_size(32, F=4, S=2, P=1)  # 16.0      #@undo
        up_size(16, F=4, S=2, P=1)   # 32        #@undo
      `,
      beats: [
        { id: 'starts', say: 'How long is the output? With an input W wide, here three, the first stamp starts at zero, and each of the other {W − 1|W minus one} starts S further on. So the last starts at S times W minus one: four.', code: ['def', 'seven'] },
        { id: 'width', say: 'Add the last stamp\'s width, F, and the output is seven long.', code: ['def', 'seven'] },
        { id: 'pad', say: 'Padding works backwards here: it trims P entries off each end. With P of one, seven becomes five. So the size is S times W minus one, plus F, minus two P.', code: ['def', 'pad'] },
        { id: 'undo', say: 'It is the convolution size rule, run backwards. A convolution with a filter of four, stride two and padding one takes thirty two down to sixteen. The transposed one takes sixteen back: two times fifteen, plus four, minus two, is thirty two.', code: 'undo' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

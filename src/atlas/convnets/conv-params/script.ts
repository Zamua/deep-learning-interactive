import type { LectureScript } from '../../../lecture/types';

const code = `
  conv = nn.Conv2d(3, 8, 3)                 #@layer
  conv.weight.numel()   # 8*3*3*3 = 216     #@w
  conv.bias.numel()     # 8                 #@b
  # total 224 = 8 * (3*3*3 + 1)             #@total
  fc = nn.Linear(3*32*32, 8*30*30)          #@fc
  # 22,125,600 parameters                   #@fc
`;

export const script: LectureScript = {
  id: 'atlas-conv-params',
  title: 'Conv parameters',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'count',
      title: 'Count one filter, then K',
      codeTitle: 'params.py',
      code,
      beats: [
        { id: 'filter', say: 'Count what a conv layer learns. One filter over a color image is three by three in each of three channels: twenty seven weights.', code: ['layer', 'w'] },
        { id: 'bias', say: 'Plus one bias, added after the sum. Twenty eight numbers per filter.', code: 'b' },
        { id: 'k', say: 'With eight filters, that is eight times twenty eight: two hundred and twenty four.', code: 'total' },
        { id: 'formula', say: 'In general, for K filters of size F by F over C input channels: K, times F times F times C, plus one. Forget the C and you have counted a flat filter; forget the one and you have lost the biases.', code: 'total' },
      ],
    },
    {
      id: 'shared',
      title: 'Shared across positions',
      codeTitle: 'params.py',
      code,
      beats: [
        { id: 'reuse', say: 'Notice what is missing: the image size. The same two hundred and twenty four numbers are used at every position. A bigger image is more work, but not more parameters.', code: 'total' },
        { id: 'fc', say: 'Compare a fully connected layer, like a linear classifier, from the same image to the same output, eight by thirty by thirty. Every output has its own weight for every input: about twenty two million.', code: 'fc' },
        { id: 'why', say: 'Sharing one small filter across the image is what makes convolution cheap. It also builds in a belief: a pattern worth finding in one place is worth finding everywhere.', code: ['layer', 'total'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

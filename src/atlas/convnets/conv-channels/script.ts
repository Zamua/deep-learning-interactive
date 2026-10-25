import type { LectureScript } from '../../../lecture/types';

const code = `
  conv = nn.Conv2d(3, 8, 3)                 #@layer
  x = torch.randn(3, 32, 32)   # (C, H, W)  #@x
  conv.weight.shape   # (8, 3, 3, 3)        #@w
  conv(x).shape       # (8, 30, 30)         #@out
  conv2 = nn.Conv2d(8, 16, 3)  # 8 deep     #@next
`;

export const script: LectureScript = {
  id: 'atlas-conv-channels',
  title: 'Channels and filters',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'depth',
      title: 'A filter has the input\'s depth',
      codeTitle: 'channels.py',
      code,
      beats: [
        { id: 'image', say: 'A color image has three channels, red, green and blue, each a grid of pixels. Channels first, as PyTorch writes it, its shape is {(C, H, W)|C by H by W}: channels, height and width. Here, {(3, 32, 32)|three by thirty two by thirty two}.', code: 'x' },
        { id: 'filter', say: 'A filter always has the full depth of its input. Here it is three by three by three: a three by three patch in every channel, twenty seven weights.', code: ['layer', 'w'] },
        { id: 'one', say: 'At each position it multiplies all twenty seven pairs and adds them up, giving one number. Not one per color: one.', code: 'layer' },
        { id: 'map', say: 'Slid over every position where it fits, those numbers fill one thirty by thirty map: a single output channel.', code: 'out' },
      ],
    },
    {
      id: 'many',
      title: 'K filters, K channels',
      codeTitle: 'channels.py',
      code,
      beats: [
        { id: 'k', say: 'A layer has many filters, K of them, each with its own weights, each looking for its own pattern. Here, eight.', code: ['layer', 'w'] },
        { id: 'stack', say: 'Each filter makes its own map, and the maps stack up as the output\'s channels. Eight filters, eight channels: {(8, 30, 30)|eight by thirty by thirty}.', code: 'out' },
        { id: 'shape', say: 'So the output\'s depth is the number of filters. Its height and width are how many places the filter fits, as before: thirty two minus three plus one.', code: 'out' },
        { id: 'next', say: 'The next layer sees an input eight channels deep, so each of its filters is eight deep: three by three by eight.', code: 'next' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

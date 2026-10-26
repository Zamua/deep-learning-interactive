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
        { id: 'next', say: 'The next layer sees an input eight channels deep, so each of its filters is eight deep: eight by three by three, depth first.', code: 'next' },
      ],
    },
    {
      id: 'layer',
      title: 'Reading a layer',
      codeTitle: 'layer.py',
      code: `
        conv = nn.Conv2d(3, 8, kernel_size=5)   # in, out, size  #@args
        # 8 filters, each 3 x 5 x 5: 75 weights                #@filters
        conv.weight.shape     # (8, 3, 5, 5)                    #@w
        x = torch.randn(3, 32, 32)                              #@x
        conv(x).shape         # (8, 28, 28)                     #@out
      `,
      beats: [
        { id: 'args', say: 'In PyTorch, {nn.Conv2d(3, 8, kernel_size=5)|n n dot conv two d, of three, eight, kernel size five} builds a layer. Its numbers come in order: three channels in, eight channels out, then the kernel size, five. Kernel is another word for filter.', code: 'args' },
        { id: 'filters', say: 'Eight channels out means eight filters: K is eight. Three channels in means each filter is three deep: three by five by five, depth first. Seventy five weights each.', code: ['args', 'filters'] },
        { id: 'weight', say: 'PyTorch stacks the eight filters along a new first axis, so the weight has shape {(8, 3, 5, 5)|eight, three, five, five}: filters, depth, height and width. Out comes first, then in.', code: 'w' },
        { id: 'out', say: 'Run it on an image of shape {(3, 32, 32)|three by thirty two by thirty two}. Eight filters make eight channels, and a five wide filter fits thirty two minus five plus one, twenty eight places, down and across: {(8, 28, 28)|eight by twenty eight by twenty eight}.', code: ['x', 'out'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

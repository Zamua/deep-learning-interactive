import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-conv-channels',
  title: 'Channels and filters',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Krizhevsky, Sutskever & Hinton', year: 2012, title: 'ImageNet classification with deep convolutional neural networks', url: 'https://papers.nips.cc/paper/2012/hash/c399862d3b9d6b76c8436e924a68c45b-Abstract.html', scene: 'many' },
  ],
  scenes: [
    {
      id: 'color',
      title: 'A filter sees every color',
      codeTitle: 'channels.py',
      code: `
        x = torch.randn(3, 32, 32)  # R, G, B #@x
        w = torch.randn(3, 3, 3)    # 3 deep  #@w
        win = x[:, 0:3, 0:3]  # all channels  #@win
        (win * w).sum()  # 27 terms: 1 number #@one
      `,
      beats: [
        { id: 'color', say: 'A color photo stores three numbers for every pixel: how much red, how much green, and how much blue. So it is three grids of numbers, stacked.', code: 'x' },
        { id: 'channel', say: 'Each grid is called a channel, like the left and right channels of stereo sound: separate streams, side by side.', code: 'x' },
        { id: 'edge', say: 'Now look for where a red apple meets green leaves. In the red channel, the apple is bright and the leaves are dark. In the green channel, it is the other way round.', code: 'x' },
        { id: 'flat', say: 'A flat filter on the red channel alone sees an edge, but it cannot tell red against green from red against black: in the red channel, the two look the same.', code: 'x' },
        { id: 'deep', say: 'So a filter reaches through every channel: a three by three patch in each, a block three deep, with twenty seven weights in all.', code: 'w' },
        { id: 'one', say: 'At each position it multiplies all twenty seven pairs and adds them up, into one number. Not one per color: one.', code: ['win', 'one'] },
        { id: 'map', say: 'Slid to every position, those numbers fill one map, a single output channel: where the image looks like the filter, in all three colors at once.', code: 'one' },
      ],
    },
    {
      id: 'many',
      title: 'K filters, K channels',
      codeTitle: 'filters.py',
      code: `
        x.shape     # (3, 32, 32)            #@shape
        # 32 - 3 + 1 = 30 places across      #@fit
        K = 8   # filters, each 3 x 3 x 3    #@k
        out.shape   # (8, 30, 30)            #@out
        # next layer: filters 8 x 3 x 3      #@next
      `,
      beats: [
        { id: 'shape', say: 'PyTorch, a Python library for neural networks, writes this image\'s shape channels first: {(3, 32, 32)|three by thirty two by thirty two}, for channels, height and width.', code: 'shape' },
        { id: 'fit', say: 'A three wide filter that stays inside fits thirty two minus three plus one places across: thirty. The same goes down, so the map is thirty by thirty.', code: 'fit' },
        { id: 'k', say: 'But one filter looks for one pattern. To find edges at other angles, or other colors, a layer has many filters, K of them, each with its own weights. Here, eight.', code: 'k' },
        { id: 'stack', say: 'Each filter makes its own map, and the maps stack up as the output\'s channels. Eight filters, eight channels: {(8, 30, 30)|eight by thirty by thirty}.', code: 'out' },
        { id: 'depth', say: 'So the input\'s depth sets how deep each filter is, and the number of filters sets how deep the output is.', code: ['k', 'out'] },
        { id: 'alexnet', say: 'In 2012, AlexNet, from Alex Krizhevsky, Ilya Sutskever and Geoffrey Hinton, opened with ninety six filters, each eleven by eleven by three. Its first layer turned three color channels into ninety six.', code: 'k' },
        { id: 'next', say: 'The next layer sees an input eight channels deep, so each of its filters is eight deep: eight by three by three, depth first.', code: 'next' },
      ],
    },
    {
      id: 'layer',
      title: 'Reading a layer',
      codeTitle: 'layer.py',
      code: `
        conv = nn.Conv2d(3, 8, kernel_size=5) #@args
        conv.weight.shape  # (8, 3, 5, 5)     #@w
        x = torch.randn(3, 32, 32)            #@x
        conv(x).shape      # (8, 28, 28)      #@out
      `,
      beats: [
        { id: 'args', say: 'In PyTorch, a layer is built like this: {nn.Conv2d(3, 8, kernel_size=5)|n n dot conv two d, of three, eight, kernel size five}. Three channels in; eight channels out, so eight filters; each five by five across. Kernel is another word for filter.', code: 'args' },
        { id: 'weight', say: 'Each filter is then three deep: three by five by five. PyTorch keeps all eight in one array, filters first: {(8, 3, 5, 5)|eight, three, five, five}. The out channels come first, then the in channels.', code: 'w' },
        { id: 'out', say: 'On a three by thirty two by thirty two image, each filter fits thirty two minus five plus one places, twenty eight, down and across. So the output is {(8, 28, 28)|eight by twenty eight by twenty eight}.', code: ['x', 'out'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

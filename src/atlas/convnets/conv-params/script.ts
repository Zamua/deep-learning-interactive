import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-conv-params',
  title: 'Conv parameters',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'LeCun et al.', year: 1989, title: 'Backpropagation applied to handwritten zip code recognition', url: 'https://doi.org/10.1162/neco.1989.1.4.541', scene: 'wires' },
  ],
  scenes: [
    {
      id: 'wires',
      title: 'Wired to everything, or shared',
      codeTitle: 'share.py',
      code: `
        fc = nn.Linear(7, 5)                #@fc
        fc.weight.numel()   # 7*5 = 35      #@fcw
        w = np.array([-1, 0, 1])  # filter  #@w
        [x[i:i+3] @ w for i in range(5)]    #@slide
        # 15 lines, 3 weights to learn      #@share
      `,
      beats: [
        { id: 'fc', say: 'A linear classifier has a weight for every pair of input and output. Draw each weight as a line, and every input is wired to every output: seven inputs and five outputs make thirty five lines.', code: 'fc' },
        { id: 'name', say: 'A layer like that is called fully connected, because nothing is left unconnected. Add one bias per output, and it learns forty numbers.', code: 'fcw' },
        { id: 'conv', say: 'A convolution wires each output only to the patch under its filter: three lines each, fifteen in all.', code: 'slide' },
        { id: 'share', say: 'And every patch uses the same three weights. Color each line by its weight, and only three colors appear: fifteen lines, but three weights to learn.', code: ['w', 'share'] },
        { id: 'sharing', say: 'That is weight sharing: one small filter, reused at every position. With its one bias, it is four numbers, however long the row.', code: 'w' },
        { id: 'lecun', say: 'In 1989, Yann LeCun and colleagues at Bell Labs built this into a reader for handwritten zip codes. It had over sixty four thousand connections, lines like these, but fewer than ten thousand numbers to learn.', code: 'share' },
        { id: 'belief', say: 'Their reason: the kinds of patterns that matter in one place of an image are likely to matter in other places too.', code: 'share' },
      ],
    },
    {
      id: 'count',
      title: 'Count one filter, then K',
      codeTitle: 'params.py',
      code: `
        conv = nn.Conv2d(3, 8, 3)                 #@layer
        conv.weight.numel()   # 8*3*3*3 = 216     #@w
        conv.bias.numel()     # 8                 #@b
        # total 224 = 8 * (3*3*3 + 1)             #@total
      `,
      beats: [
        { id: 'layer', say: 'Now a real layer on a color image: {nn.Conv2d(3, 8, 3)|n n dot conv two d, of three, eight and three}. Three channels in, eight filters, each three by three.', code: 'layer' },
        { id: 'F', say: 'Call the side of a filter F: here, three.', code: 'layer' },
        { id: 'C', say: 'Each filter reaches through every channel of its input, C of them, here red, green and blue. So it holds F by F weights, three times over: twenty seven.', code: ['layer', 'w'] },
        { id: 'bias', say: 'Plus one bias, added after the sum, just as in a linear classifier: twenty eight numbers per filter.', code: 'b' },
        { id: 'K', say: 'The layer has K filters, each with its own weights and bias. Eight of them: eight times twenty eight, two hundred and twenty four.', code: 'total' },
        { id: 'formula', say: 'So a layer learns K, times F times F times C, plus one.', code: 'total' },
        { id: 'dials', say: 'Double K, and the count exactly doubles. Double C, and the weights double but the biases do not: a little under double. Double F, and every F by F square holds four times as many weights.', code: 'total' },
      ],
    },
    {
      id: 'size',
      title: 'What the count leaves out',
      codeTitle: 'size.py',
      code: `
        x = torch.randn(3, 32, 32)          #@x
        conv(x).shape    # (8, 30, 30)      #@out
        # 224 parameters, any image size    #@any
        fc = nn.Linear(3*32*32, 8*30*30)    #@fc
        # 3,072 * 7,200 + 7,200 = 22,125,600 #@fcn
      `,
      beats: [
        { id: 'missing', say: 'Notice what the count leaves out: the size of the image. The same two hundred and twenty four numbers slide over every position, so a bigger image means more work, but not one more parameter.', code: ['x', 'any'] },
        { id: 'sizes', say: 'Now a fully connected layer from the same image to the same output. The image, three by thirty two by thirty two, holds {3,072|three thousand and seventy two} numbers. The output, eight by thirty by thirty, holds {7,200|seven thousand two hundred}.', code: ['x', 'out', 'fc'] },
        { id: 'fc', say: 'A weight for every pair, plus a bias per output: over twenty two million parameters, against two hundred and twenty four.', code: 'fcn' },
        { id: 'why', say: 'Sharing one small filter is what makes convolution cheap, and it builds in that belief: a pattern worth finding in one place is worth finding everywhere.', code: ['any', 'fc'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

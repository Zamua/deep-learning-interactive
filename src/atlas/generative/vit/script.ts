import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-vit',
  title: 'Vision transformers',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Dosovitskiy, Beyer, Kolesnikov, Weissenborn, Zhai, Unterthiner, Dehghani, Minderer, Heigold, Gelly, Uszkoreit & Houlsby', year: 2020, title: 'An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale', url: 'https://arxiv.org/abs/2010.11929', scene: 'pixels' },
  ],
  scenes: [
    {
      id: 'pixels',
      title: 'A picture is not a sentence',
      codeTitle: 'tokens.py',
      code: `
        # a sentence: one token per word    #@words
        img = np.random.rand(32, 32, 3)     #@img
        32 * 32        # 1,024 pixels       #@pix
        1024 * 1024    # 1,048,576 scores   #@cost
        (32 // 8) ** 2  # 16 patches        #@patch
        16 * 16        # 256 scores         #@patch
      `,
      beats: [
        { id: 'words', say: 'A transformer reads a sentence as a row of tokens, and attention lets every token look at every other.', code: 'words' },
        { id: 'grid', say: 'A picture is a grid instead: thirty two by thirty two pixels, with three color values each.', code: 'img' },
        { id: 'pixel', say: 'The plainest way in is one token per pixel: thirty two times thirty two, {1,024|one thousand and twenty four} tokens.', code: 'pix' },
        { id: 'cost', say: 'But attention scores every token against every other, a T by T grid: over a million scores, in every block, for one tiny picture.', code: 'cost' },
        { id: 'patch', say: 'So cut the picture into small squares, called patches, one token each. In patches of eight by eight pixels, that is just sixteen tokens.', code: 'patch' },
        { id: 'vit', say: 'That is the vision transformer, {ViT|V I T} for short: a plain transformer, the kind built for text, given patches instead of words.', code: 'patch' },
        { id: 'paper', say: 'Alexey Dosovitskiy and colleagues introduced it in 2020, and their title says it: {An Image is Worth 16x16 Words|An Image is Worth Sixteen by Sixteen Words}.', code: 'patch' },
        { id: 'scale', say: 'Given millions of training images, it matched the best networks built from convolutions.', code: 'patch' },
      ],
    },
    {
      id: 'patches',
      title: 'Counting patches',
      codeTitle: 'patches.py',
      code: `
        size = 8          # P               #@P
        32 // size        # 4 per side      #@side
        (32 // size) ** 2  # N = 16         #@N
        size = 16                           #@p16
        (32 // size) ** 2  # 4              #@p16
        (224 // 16) ** 2   # 196            #@big
        (128 // 16) * (192 // 16)  # 96     #@rect
      `,
      beats: [
        { id: 'P', say: 'Call the side of a patch P, for patch size. Here P is eight.', code: 'P' },
        { id: 'side', say: 'The picture is H pixels high, H for height: thirty two. So H over P patches, four, fit down each side.', code: 'side' },
        { id: 'N', say: 'Four rows of four: N, the number of patches, is sixteen. N is H over P, squared.', code: 'N' },
        { id: 'p16', say: 'Make P sixteen, and only two patches fit along each side: four in all.', code: 'p16' },
        { id: 'quarter', say: 'Doubling P leaves a quarter as many patches, since both sides halve. Halving P gives four times as many.', code: 'p16' },
        { id: 'big', say: 'The paper used pictures {224|two hundred and twenty four} pixels a side, in patches of sixteen: fourteen squared, {196|one hundred and ninety six} patches.', code: 'big' },
        { id: 'rect', say: 'For a picture that is not square, write W for its width: H over P patches fit down, and W over P across.', code: 'rect' },
        { id: 'grid', say: 'So {128|a hundred and twenty eight} by {192|a hundred and ninety two} pixels, in patches of sixteen, is eight down and twelve across: ninety six.', code: 'rect' },
      ],
    },
    {
      id: 'flatten',
      title: 'A patch becomes a token',
      codeTitle: 'embed.py',
      code: `
        patch = img[0:8, 16:24]  # (8, 8, 3)  #@one
        row = patch.reshape(-1)  # 192        #@flat
        E = np.random.randn(192, 64)          #@embed
        bias = np.zeros(64)                   #@embed
        token = row @ E + bias   # 64         #@d
        # each output: 192 + 1 = 193          #@count
        # 64 * 193 = 12,352 parameters        #@total
        conv = nn.Conv2d(3, 64,               #@conv
            kernel_size=8, stride=8)          #@conv,stride
      `,
      beats: [
        { id: 'one', say: 'Take one patch, the one with the sun: eight by eight pixels, three color values each, {192|one hundred and ninety two} numbers.', code: 'one' },
        { id: 'flat', say: 'Lay them out in one row: P squared times C numbers, with C for the color channels: three here, one in a gray picture. The row\'s length depends only on the patch.', code: 'flat' },
        { id: 'embed', say: 'Then, as a word gets an embedding, the row goes through a learned linear map: a weight matrix E, for embedding, plus a bias.', code: 'embed' },
        { id: 'd', say: 'Out comes a token of d numbers, the width the transformer works with: sixty four here.', code: 'd' },
        { id: 'shared', say: 'Every patch goes through this same map.', code: 'embed' },
        { id: 'count', say: 'Each of the sixty four outputs has one weight per number, {192|one hundred and ninety two}, plus a bias: {193|one hundred and ninety three}.', code: 'count' },
        { id: 'total', say: 'Sixty four times {193|one hundred and ninety three}: {12,352|twelve thousand, three hundred and fifty two} parameters, for any size of picture.', code: 'total' },
        { id: 'conv', say: 'That map is a convolution: sixty four filters, each P by P and three channels deep, with a stride of P.', code: 'conv' },
        { id: 'stride', say: 'The stride is how far a filter jumps between stops. Here it jumps a whole patch at a time, so each stop covers exactly one patch.', code: 'stride' },
      ],
    },
    {
      id: 'sequence',
      title: 'The sequence',
      codeTitle: 'vit.py',
      code: `
        rows.shape                # (16, 192) #@stack
        tokens = rows @ E + bias  # (16, 64)  #@tokens
        cls = np.random.randn(1, 64)          #@cls
        z = np.vstack([cls, tokens])  # 17    #@cls
        pos = np.random.randn(17, 64)         #@pos
        z = z + pos               # (17, 64)  #@pos
        for block in blocks:                  #@blocks
            z = block(z)          # (17, 64)  #@blocks
        scores = W @ z[0] + b                 #@read
      `,
      beats: [
        { id: 'stack', say: 'Flatten all sixteen patches, one row each: sixteen by {192|one hundred and ninety two}. Embedded, they are sixteen tokens of sixty four numbers: the picture is now a sequence.', code: ['stack', 'tokens'] },
        { id: 'cls', say: 'One more token goes in front: the class token, learned, from no patch, and the same for every picture. That makes seventeen.', code: 'cls' },
        { id: 'bag', say: 'But attention ignores order. Swap a patch of sky with a patch of grass, and it could not tell.', code: 'tokens' },
        { id: 'pos', say: 'So, as with words, each place gets a learned position vector added: seventeen rows of sixty four, the class token\'s place included.', code: 'pos' },
        { id: 'blocks', say: 'From here it is a plain transformer: each block keeps the shape, seventeen tokens in and seventeen out.', code: 'blocks' },
        { id: 'read', say: 'After the last block, the class token has gathered from every patch, and a linear classifier scores it: hence its name.', code: 'read' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

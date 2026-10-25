import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-vit',
  title: 'Vision transformers',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'patches',
      title: 'Cut the image into patches',
      codeTitle: 'patches.py',
      code: `
        img = np.random.rand(32, 32, 3)   #@img
        size = 8                # P       #@cut
        per_side = 32 // size   # 4       #@count
        n = per_side ** 2       # 16      #@count
        (224 // 16) ** 2        # 196     #@big
      `,
      beats: [
        { id: 'seq', say: 'A transformer reads a sequence of vectors, one per token. An image is a grid of pixels: here thirty two by thirty two, with three color values each.', code: 'img' },
        { id: 'cut', say: 'To make it a sequence, cut it into squares of P by P pixels, the patches, with P for patch size. Here P is eight.', code: 'cut' },
        { id: 'count', say: 'Thirty two over eight is four patches along each side, so four times four: sixteen patches, read in order like words on a page.', code: 'count' },
        { id: 'formula', say: 'In general, an H by H image gives N patches, where N is H over P, squared. Two hundred and twenty four pixels in patches of sixteen gives fourteen squared: one hundred and ninety six.', code: 'big' },
      ],
    },
    {
      id: 'flatten',
      title: 'A patch becomes a token',
      codeTitle: 'embed.py',
      code: `
        patch = img[0:8, 16:24]  # (8, 8, 3)   #@one
        row = patch.reshape(-1)  # 192         #@flat
        E = np.random.randn(192, 64)           #@embed
        bias = np.zeros(64)                    #@embed
        token = row @ E + bias   # 64          #@embed
        # 192 * 64 + 64 = 12,352 parameters    #@shared
        nn.Conv2d(3, 64, 8, stride=8)  # same  #@conv
      `,
      beats: [
        { id: 'one', say: 'Take one patch. It is eight by eight pixels, and each pixel has three color values: eight times eight times three is one hundred and ninety two numbers.', code: 'one' },
        { id: 'flat', say: 'Lay them out in one row: a vector of P squared times C numbers, where C is the number of color channels.', code: 'flat' },
        { id: 'embed', say: 'A learned linear map, a weight matrix and a bias, turns that row into a token of d numbers, the width the transformer works in. Here d is sixty four.', code: 'embed' },
        { id: 'shared', say: 'Every patch goes through the same map, so there is one set of weights: one hundred ninety two times sixty four, plus sixty four biases. Twelve thousand three hundred and fifty two, whatever the size of the image.', code: 'shared' },
        { id: 'conv', say: 'That is a convolution: sixty four filters of P by P, with a stride of P, so each one lands on whole patches and never overlaps.', code: 'conv' },
      ],
    },
    {
      id: 'sequence',
      title: 'The sequence',
      codeTitle: 'vit.py',
      code: `
        tokens = patches @ E + bias  # (16, 64)  #@tokens
        cls = np.random.randn(1, 64)             #@cls
        z = np.vstack([cls, tokens]) # (17, 64)  #@cls
        for block in blocks:                     #@blocks
            z = block(z)             # (17, 64)  #@blocks
        scores = W @ z[0] + b                    #@read
      `,
      beats: [
        { id: 'tokens', say: 'Do that for all sixteen patches, and the image is a sequence: sixteen tokens of sixty four numbers, a sixteen by sixty four matrix.', code: 'tokens' },
        { id: 'cls', say: 'One more token goes in front: the class token. It is learned, it comes from no patch, and it is the same for every image. Now the sequence is seventeen by sixty four.', code: 'cls' },
        { id: 'blocks', say: 'From here it is a plain transformer. Each block keeps the shape, seventeen tokens in and seventeen out, and attention lets every patch look at every other.', code: 'blocks' },
        { id: 'read', say: 'After the last block, the class token has gathered what it needs from all the patches, and a linear classifier scores it.', code: 'read' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

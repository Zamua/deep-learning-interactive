import type { LectureScript } from '../../../lecture/types';

const code = `
  net = nn.Sequential(
      nn.Conv2d(3, 16, 3, padding=1),     #@c1
      nn.ReLU(),                          #@r1
      nn.MaxPool2d(2),                    #@p1
      nn.Conv2d(16, 32, 3, padding=1),    #@c2
      nn.ReLU(),                          #@r2
      nn.MaxPool2d(2),                    #@p2
      nn.Flatten(),          # 2,048      #@flat
      nn.Linear(32 * 8 * 8, 10),          #@fc
  )
`;

export const script: LectureScript = {
  id: 'atlas-convnet-arch',
  title: 'ConvNet architecture',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'stages',
      title: 'Conv, ReLU, pool, repeat',
      codeTitle: 'net.py',
      code,
      beats: [
        { id: 'input', say: 'A small ConvNet for color images, {32 × 32|thirty two by thirty two}. Follow the shape from layer to layer.', code: 'c1' },
        { id: 'conv', say: 'A three by three conv with sixteen filters and padding one keeps the size and makes sixteen channels: {(16, 32, 32)|sixteen by thirty two by thirty two}.', code: 'c1' },
        { id: 'relu', say: 'A ReLU works entry by entry, so the shape does not change.', code: 'r1' },
        { id: 'pool', say: 'Max pooling halves the height and the width: sixteen by sixteen by sixteen. That is one stage.', code: 'p1' },
        { id: 'repeat', say: 'Repeat it with thirty two filters: thirty two channels, then pooled to eight by eight. The image gets smaller and deeper as it goes.', code: ['c2', 'r2', 'p2'] },
      ],
    },
    {
      id: 'head',
      title: 'Flatten, classify, count',
      codeTitle: 'net.py',
      code,
      beats: [
        { id: 'flatten', say: 'Flatten lays all of it out in one vector: thirty two times eight times eight, {2,048|two thousand and forty eight} numbers.', code: 'flat' },
        { id: 'fc', say: 'A fully connected layer then turns those into ten class scores, exactly like a linear classifier.', code: 'fc' },
      ],
    },
    {
      id: 'count',
      title: 'Count the parameters',
      codeTitle: 'count.py',
      code: `
        16 * (3 * 3 * 3 + 1)     # 448      #@c1
        32 * (3 * 3 * 16 + 1)    # 4,640    #@c2
        2048 * 10 + 10           # 20,490   #@lin
        448 + 4640 + 20490       # 25,578   #@most
      `,
      beats: [
        { id: 'c1', say: 'Now count what it learns. Each of the first {conv|convolution}\'s sixteen filters is three by three over the input\'s three channels: twenty seven weights, plus one bias. Sixteen times twenty eight is {448|four hundred and forty eight}.', code: 'c1' },
        { id: 'c2', say: 'The second {conv|convolution}\'s filters each span all sixteen channels coming in: three times three times sixteen, {144|a hundred and forty four} weights, plus one bias. Thirty two of them make {4,640|four thousand, six hundred and forty}.', code: 'c2' },
        { id: 'lin', say: 'The linear layer has a weight for each of the {2,048|two thousand and forty eight} inputs, for each of the ten scores, plus ten biases: {20,490|twenty thousand, four hundred and ninety}.', code: 'lin' },
        { id: 'most', say: 'Pooling and ReLU have none. In all, {25,578|twenty five thousand, five hundred and seventy eight}, and four fifths of them sit in that last fully connected layer, even in this tiny network.', code: 'most' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

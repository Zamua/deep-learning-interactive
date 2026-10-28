import type { LectureScript } from '../../../lecture/types';

const code = `
  net = nn.Sequential(
      nn.Conv2d(3, 16, 3, padding=1),  #@c1
      nn.ReLU(),                       #@r1
      nn.MaxPool2d(2),                 #@p1
      nn.Conv2d(16, 32, 3, padding=1), #@c2
      nn.ReLU(),                       #@r2
      nn.MaxPool2d(2),                 #@p2
      nn.Flatten(),     # 2,048        #@flat
      nn.Linear(32 * 8 * 8, 10),       #@fc
  )
`;

export const script: LectureScript = {
  id: 'atlas-convnet-arch',
  title: 'ConvNet architecture',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'LeCun, Bottou, Bengio & Haffner', year: 1998, title: 'Gradient-based learning applied to document recognition', url: 'https://doi.org/10.1109/5.726791', scene: 'goal' },
    { who: 'Krizhevsky, Sutskever & Hinton', year: 2012, title: 'ImageNet classification with deep convolutional neural networks', url: 'https://papers.nips.cc/paper/2012/hash/c399862d3b9d6b76c8436e924a68c45b-Abstract.html', scene: 'count' },
  ],
  scenes: [
    {
      id: 'goal',
      title: 'From pixels to scores',
      codeTitle: 'net.py',
      code,
      beats: [
        { id: 'goal', say: 'The goal: turn a color image, {32 × 32|thirty two by thirty two} pixels, into ten class scores, one per class.' },
        { id: 'linear', say: 'A linear classifier does it in one step, with a weight for every pixel, so what it learns is tied to places: move the cat\'s ear a few pixels, and different weights see it.', code: 'fc' },
        { id: 'conv', say: 'A convolution slides one small filter over the whole image, so it finds its pattern wherever it sits.', code: 'c1' },
        { id: 'relu', say: 'A ReLU bends the result, so stacked layers do not collapse into one linear step.', code: 'r1' },
        { id: 'pool', say: 'Pooling shrinks each map, keeping the strongest response in each window.', code: 'p1' },
        { id: 'name', say: 'Stack those a few times, then score what is left with a linear classifier, and you have a convolutional network: a ConvNet, for short.', code: ['c1', 'r1', 'p1', 'c2', 'r2', 'p2', 'flat', 'fc'] },
        { id: 'lenet', say: 'The shape is old. In 1998, Yann LeCun and colleagues described {LeNet-5|Le Net five}: convolutions, each followed by a small averaging pool, then fully connected layers giving ten outputs, one per digit. Networks like it read millions of bank checks a day.', code: ['c1', 'p1', 'fc'] },
      ],
    },
    {
      id: 'stages',
      title: 'Smaller and deeper',
      codeTitle: 'net.py',
      code,
      beats: [
        { id: 'input', say: 'Follow the shape through. The image is {(3, 32, 32)|three by thirty two by thirty two}: three color channels first, then height and width.' },
        { id: 'conv', say: 'The first conv has sixteen filters, so it makes sixteen channels.', code: 'c1' },
        { id: 'pad', say: 'Its filters are three by three, and padding one gives back the two positions such a filter loses, so the grid stays put: {(16, 32, 32)|sixteen by thirty two by thirty two}.', code: 'c1' },
        { id: 'relu', say: 'The ReLU bends each entry on its own, so the shape does not change.', code: 'r1' },
        { id: 'pool', say: 'Two by two max pooling halves the height and the width: {(16, 16, 16)|sixteen by sixteen by sixteen}. Conv, ReLU, pool: that is one stage.', code: 'p1' },
        { id: 'nopad', say: 'Without padding, the conv would shrink it first: thirty two, minus three, plus one, is thirty, pooled to fifteen.', code: 'c1' },
        { id: 'repeat', say: 'A second stage, with thirty two filters, makes thirty two channels and pools them to eight by eight: {(32, 8, 8)|thirty two by eight by eight}.', code: ['c2', 'r2', 'p2'] },
        { id: 'deeper', say: 'Each channel maps where one pattern shows up. Stage by stage, the block gets smaller and deeper: fewer positions, more patterns.', code: ['c1', 'c2'] },
      ],
    },
    {
      id: 'head',
      title: 'Flatten, then score',
      codeTitle: 'net.py',
      code,
      beats: [
        { id: 'flatten', say: 'A linear classifier needs one vector, so flatten lays every number out in a row: thirty two times eight times eight, {2,048|two thousand and forty eight}.', code: 'flat' },
        { id: 'fc', say: 'Then a fully connected layer: each of the ten scores has its own weight for every one of those numbers, plus a bias. Exactly a linear classifier.', code: 'fc' },
        { id: 'names', say: 'PyTorch calls it {nn.Linear|n n dot linear}: a linear layer and a fully connected layer are the same thing.', code: 'fc' },
        { id: 'order', say: 'So the order follows the shapes. Convs and pools work on grids, so they come first; flatten makes the vector the linear layer scores.', code: ['c1', 'r1', 'p1', 'c2', 'r2', 'p2', 'flat', 'fc'] },
      ],
    },
    {
      id: 'count',
      title: 'Where the parameters are',
      codeTitle: 'count.py',
      code: `
        3 * 3 * 3 + 1            # 28       #@one
        16 * (3 * 3 * 3 + 1)     # 448      #@c1
        32 * (3 * 3 * 16 + 1)    # 4,640    #@c2
        2048 * 10 + 10           # 20,490   #@lin
        448 + 4640 + 20490       # 25,578   #@most
      `,
      beats: [
        { id: 'one', say: 'Now count what it learns. A first-layer filter is three by three over three channels, twenty seven weights, plus one bias: twenty eight.', code: 'one' },
        { id: 'c1', say: 'Sixteen filters make {448|four hundred and forty eight}.', code: 'c1' },
        { id: 'c2', say: 'The second conv\'s thirty two filters, each sixteen channels deep, hold {4,640|four thousand, six hundred and forty}, counted the same way.', code: 'c2' },
        { id: 'lin', say: 'The linear layer has {2,048|two thousand and forty eight} weights for each of ten scores, plus ten biases: {20,490|twenty thousand, four hundred and ninety}.', code: 'lin' },
        { id: 'most', say: 'ReLU and pooling learn nothing. Of the {25,578|twenty five thousand, five hundred and seventy eight} in all, four fifths sit in that last layer.', code: 'most' },
        { id: 'alexnet', say: 'Big networks lean the same way. AlexNet, in 2012, was this recipe at scale: five conv layers, three fully connected, sixty million parameters, and no conv layer held more than one percent of them.', code: 'most' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

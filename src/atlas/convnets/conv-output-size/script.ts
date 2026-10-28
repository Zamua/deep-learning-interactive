import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-conv-output-size',
  title: 'Conv output size',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'LeCun et al.', year: 1989, title: 'Backpropagation applied to handwritten zip code recognition', url: 'https://doi.org/10.1162/neco.1989.1.4.541', scene: 'stride' },
    { who: 'Krizhevsky, Sutskever & Hinton', year: 2012, title: 'ImageNet classification with deep convolutional neural networks', url: 'https://papers.nips.cc/paper/2012/hash/c399862d3b9d6b76c8436e924a68c45b-Abstract.html', scene: 'fit' },
  ],
  scenes: [
    {
      id: 'shrink',
      title: 'Every pass shrinks',
      codeTitle: 'out_size.py',
      code: `
        def out_size(width, F):     #@def
            return width - F + 1    #@def
        out_size(7, 3)    # 5       #@one
        out_size(5, 3)    # 3       #@again
        out_size(3, 3)    # 1       #@again
      `,
      beats: [
        { id: 'shrink', say: 'Slide a filter along a row of pixels, and the output comes out shorter than the row: seven pixels and a filter three wide give five outputs.', code: 'one' },
        { id: 'again', say: 'Filter those five again, and three come out. Once more, and one is left.', code: 'again' },
        { id: 'layer', say: 'Pictures are filtered over and over, each pass working on the last one\'s output. The passes are called layers, since they stack, and a few of them whittle a picture away.', code: ['one', 'again'] },
        { id: 'W', say: 'So it pays to count. Call the width of the input W: here, seven.', code: 'def' },
        { id: 'F', say: 'And call the size of the filter F: here, three.', code: 'def' },
        { id: 'steps', say: 'From the left edge, the filter has room for {W − F|W minus F} steps, four here, before its right end reaches the last pixel.', code: 'def' },
        { id: 'plus', say: 'Add one for the spot where it started: {W − F + 1|W minus F, plus one}, which makes five. Count positions, not steps.', code: ['def', 'one'] },
      ],
    },
    {
      id: 'pad',
      title: 'Padding',
      codeTitle: 'out_size.py',
      code: `
        def out_size(width, F, P=0):     #@def
            return width - F + 2*P + 1   #@def
        out_size(7, 3)        # 5        #@lose
        out_size(7, 3, P=1)   # 7: same  #@pad
        out_size(7, 5, P=2)   # 7: same  #@five
      `,
      beats: [
        { id: 'lose', say: 'Each layer loses {F − 1|F minus one} entries, one at each end, since the middle of the filter never sits over the end pixels.', code: 'lose' },
        { id: 'pad', say: 'So before sliding, add a border of zeros on each side, the way padding fills the space around something in a box. P counts the zeros on one side.', code: 'pad' },
        { id: 'nine', say: 'With one zero on each side, P is one, and the row of seven becomes nine. Now the filter fits in seven places: as many outputs as inputs.', code: 'pad' },
        { id: 'formula', say: 'The border makes the row {2P|two P} wider, so the count becomes W minus F, plus {2P|two P}, plus one. Here, seven minus three, plus two, plus one: seven.', code: 'def' },
        { id: 'same', say: 'To keep the size, the zeros must give back exactly what the filter loses: {2P|two P} equals {F − 1|F minus one}, so P is {F − 1|F minus one}, over two.', code: ['def', 'pad'] },
        { id: 'five', say: 'A filter five wide loses four entries, so P must be two.', code: 'five' },
      ],
    },
    {
      id: 'stride',
      title: 'Stride',
      codeTitle: 'out_size.py',
      code: `
        def out_size(width, F, S=1, P=0):   #@def
            steps = width - F + 2*P         #@def
            return steps / S + 1            #@def
        out_size(7, 3, P=1)        # 7.0    #@one
        out_size(7, 3, S=2, P=1)   # 4.0    #@two
      `,
      beats: [
        { id: 'jump', say: 'The filter need not stop at every position. How far it moves each time is called the stride, S, like the length of a stride when you walk.', code: 'def' },
        { id: 'every', say: 'With a stride of two, it lands on every other position: four of them.', code: 'two' },
        { id: 'lecun', say: 'In 1989, Yann LeCun and colleagues at Bell Labs read handwritten zip codes this way. Their filters sat two pixels apart, so each digit, sixteen by sixteen pixels, gave outputs eight by eight.', code: 'two' },
        { id: 'reason', say: 'Spotting a pattern needs fine detail, they reasoned, but its exact position need not be pinned down as finely. A stride keeps the spotting and drops some of the where.', code: 'two' },
        { id: 'formula', say: 'So the steps, W minus F plus {2P|two P}, now come in jumps of S. Divide them by S, then add one for the start.', code: 'def' },
        { id: 'four', say: 'Here, six steps of one make three jumps of two. Plus the start: four.', code: ['def', 'two'] },
      ],
    },
    {
      id: 'fit',
      title: 'When it does not fit',
      codeTitle: 'fit.py',
      code: `
        out_size(8, 3, S=2)      # 3.5    #@half
        np.floor(5 / 2) + 1      # 3.0    #@drop
        out_size(224, 11, S=4)   # 54.25  #@alex
        out_size(227, 11, S=4)   # 55.0   #@fit
      `,
      beats: [
        { id: 'fit', say: 'The division does not always come out whole. Eight wide, a filter of three, and a stride of two: five steps make two and a half jumps.', code: 'half' },
        { id: 'drop', say: 'Half a jump would leave the filter hanging over the edge, where there is no input, so that position is dropped: libraries such as PyTorch round the jumps down. Two jumps, plus the start: three.', code: 'drop' },
        { id: 'alexnet', say: 'Real papers run into this. The 2012 AlexNet paper, by Alex Krizhevsky, Ilya Sutskever and Geoffrey Hinton, slid filters eleven wide, four pixels at a time, over images {224|two hundred and twenty four} wide.', code: 'alex' },
        { id: 'odd', say: 'But {224|two hundred and twenty four} minus eleven is {213|two hundred and thirteen} steps, which four does not divide. Yet its own figure shows fifty five positions across.', code: 'alex' },
        { id: 'exact', say: 'An input {227|two hundred and twenty seven} wide fits exactly: {216|two hundred and sixteen} steps, over four, make fifty four jumps, plus the start: fifty five. A setting fits only when the division is whole.', code: 'fit' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

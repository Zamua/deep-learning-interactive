import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-receptive-field',
  title: 'Receptive field',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Hubel & Wiesel', year: 1959, title: 'Receptive fields of single neurones in the cat\'s striate cortex', url: 'https://doi.org/10.1113/jphysiol.1959.sp006308', scene: 'patch' },
    { who: 'Simonyan & Zisserman', year: 2014, title: 'Very deep convolutional networks for large-scale image recognition', url: 'https://arxiv.org/abs/1409.1556', scene: 'why' },
  ],
  scenes: [
    {
      id: 'patch',
      title: 'One unit, one small patch',
      codeTitle: 'field.py',
      code: `
        x = image      # 13 x 13 pixels       #@img
        F = 3          # each filter: 3 x 3   #@F
        x[5:8, 5:8]    # one unit sees 3 x 3  #@one
        x[4:9, 4:9]    # layer 2: 5 x 5       #@two
        x[3:10, 3:10]  # layer 3: 7 x 7       #@three
      `,
      beats: [
        { id: 'problem', say: 'To recognize a shape, like this ring, something has to see all of it. But a filter is small: three by three, on an image thirteen pixels across.', code: ['img', 'F'] },
        { id: 'unit', say: 'Here, it turns the nine pixels at the middle into one output number. Each number a convolution puts out is called a unit.', code: 'one' },
        { id: 'field', say: 'Those nine pixels are the unit\'s receptive field: the part of the image it receives from. All nine are blank, so this unit cannot tell there is a ring at all.', code: 'one' },
        { id: 'history', say: 'The name comes from neuroscience: in 1959, David Hubel and Torsten Wiesel called the patch of the scene that one of their cells answers to its receptive field.', code: 'one' },
        { id: 'again', say: 'But the output is itself a grid of numbers, so a second filter can slide over it. Each convolution in such a stack is called a layer, and the whole stack, a network.', code: 'two' },
        { id: 'two', say: 'A unit of layer two sees three by three units of layer one, which together cover five by five pixels: still blank.', code: 'two' },
        { id: 'three', say: 'A third layer covers seven by seven, and its corners just reach the ring.', code: 'three' },
      ],
    },
    {
      id: 'count',
      title: 'Each layer adds F minus one',
      codeTitle: 'field.py',
      code: `
        r = 1           # a pixel: itself     #@init
        for F in filters:                     #@loop
            r += F - 1  # the overlap         #@add
        # [3, 3]: 1 + 2 + 2 = 5               #@two
        # [3, 3, 3]: 7                        #@three
        # [3] * 5: 11, the whole ring         #@ring
        # [5, 5]: 1 + 4 + 4 = 9               #@mix
      `,
      beats: [
        { id: 'side', say: 'Why five, and not three plus three? Look at one row from the side, with each layer\'s units above the pixels.', code: 'two' },
        { id: 'overlap', say: 'The layer two unit takes three neighbors in layer one, whose patches overlap: each starts one pixel after the last. So the two outer ones add just one new pixel each.', code: 'add' },
        { id: 'F', say: 'A filter F pixels wide takes F neighbors, so each layer widens the field by {F − 1|F minus one}: two, for three by three.', code: 'add' },
        { id: 'r', say: 'Call the field\'s width r. It starts at one, a pixel seeing itself. With three layers, that is one plus two plus two plus two: seven.', code: ['init', 'loop', 'three'] },
        { id: 'L', say: 'Call the number of layers L. With three by three filters, the field is {1 + 2L|one plus two L} pixels across.', code: 'three' },
        { id: 'ring', say: 'The whole ring is eleven pixels across, so it takes five layers: one plus two times five.', code: 'ring' },
        { id: 'mix', say: 'Two layers of five by five see one, plus four, plus four: nine.', code: 'mix' },
      ],
    },
    {
      id: 'stride',
      title: 'A stride spreads the units',
      codeTitle: 'field.py',
      code: `
        r, jump = 1, 1                        #@init
        for F, S in layers:                   #@loop
            r += (F - 1) * jump               #@add
            jump *= S   # for layers above    #@jump
        # (3, 2), (3, 1): 3 + 2 * 2 = 7       #@seven
        # (3, 2), (3, 2), (3, 1): 15          #@twice
      `,
      beats: [
        { id: 'jump', say: 'A stride makes the field grow faster. With stride two, neighboring units of layer one sit two pixels apart: call that gap the jump.', code: ['init', 'jump'] },
        { id: 'own', say: 'Each of those units still sees just three pixels: the stride only spreads them out.', code: 'loop' },
        { id: 'next', say: 'But a three by three layer above takes three neighbors that sit two apart, so it adds two times two, four: three becomes seven.', code: ['add', 'seven'] },
        { id: 'rule', say: 'So each layer adds {F − 1|F minus one}, multiplied by the jump below it. Then its own stride multiplies the jump, for the layers above.', code: ['add', 'jump'] },
        { id: 'twice', say: 'Give layer two a stride of two as well, and the jump becomes four. A third three by three layer then adds two times four, eight, and the field reaches fifteen.', code: 'twice' },
      ],
    },
    {
      id: 'why',
      title: 'Small filters, stacked',
      codeTitle: 'weights.py',
      code: `
        two = 3*3 + 3*3    # 18 weights   #@two
        big = 5*5          # 25 weights   #@big
        # both see 5 x 5                  #@same
        three = 3 * 3*3    # 27 weights   #@three
        seven = 7*7        # 49 weights   #@seven
      `,
      beats: [
        { id: 'same', say: 'Why stack small filters? Two layers of three by three see the same five by five patch as one five by five filter, and each of those twenty five pixels can change the output.', code: 'same' },
        { id: 'weights', say: 'On a grayscale image, with one brightness per pixel, a filter has one weight per pixel it covers: nine plus nine, eighteen, for the pair, against twenty five.', code: ['two', 'big'] },
        { id: 'three', say: 'The saving grows with depth: three layers see seven by seven with twenty seven weights.', code: 'three' },
        { id: 'seven', say: 'One seven by seven filter needs forty nine.', code: 'seven' },
        { id: 'vgg', say: 'Earlier networks opened with filters as big as eleven by eleven. In 2014, Karen Simonyan and Andrew Zisserman used three by three filters all the way through theirs, and counted exactly this saving.', code: ['three', 'seven'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

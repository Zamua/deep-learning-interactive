import type { LectureScript } from '../../../lecture/types';

const code = `
  train_tf = transforms.Compose([         #@all
      transforms.RandomCrop(28),          #@crop
      transforms.RandomHorizontalFlip(),  #@flip
      transforms.ColorJitter(0.2),        #@color
  ])
  test_tf = transforms.CenterCrop(28)     #@test
`;

export const script: LectureScript = {
  id: 'atlas-augmentation',
  title: 'Data augmentation',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'variety',
      title: 'Change the image, keep the label',
      codeTitle: 'augment.py',
      code,
      beats: [
        { id: 'memo', say: 'A model that overfits has memorized its training images, quirks and all. One fix: never show it exactly the same image twice.', code: 'all' },
        { id: 'change', say: 'Each time an image is used, change it a little at random. Shift it, make it brighter or darker, crop it. It still shows the same thing, so its label stays true.', code: ['crop', 'color'] },
        { id: 'flip', say: 'But the change must keep the label true. Flip this right arrow left to right and it points left: now its label is wrong. A flipped photo of a cat is still a cat.', code: 'flip' },
        { id: 'which', say: 'So which changes are safe depends on the task. A six turned upside down is a nine, and a red light with its colors shifted can look green.', code: 'all' },
      ],
    },
    {
      id: 'crops',
      title: 'How much variety',
      codeTitle: 'augment.py',
      code,
      beats: [
        { id: 'count', say: 'Random crops alone add a lot. Cut a twenty eight by twenty eight crop from a thirty two by thirty two image.', code: 'crop' },
        { id: 'across', say: 'Slide it across one pixel at a time. Its left edge can sit at zero, one, two, three or four, where its right edge meets the image\'s. That is thirty two minus twenty eight, plus one for position zero: five places.', code: 'crop' },
        { id: 'down', say: 'Down, the same: its top edge sits at zero to four, five places. Every place across pairs with every place down: five times five, twenty five crops.', code: 'crop' },
        { id: 'flips', say: 'Add a random flip, and each crop also comes mirrored: twenty five times two, fifty versions of every image.', code: 'flip' },
        { id: 'train', say: 'Do this only while training, with fresh random choices every time. Validation and test images stay untouched, so they still measure the model on real data.', code: 'test' },
        { id: 'gap', say: 'The training loss ends a little higher, because varied images are harder to memorize, and the validation loss ends lower: a smaller gap.', code: 'all' },
      ],
    },
    {
      id: 'try',
      title: 'Try one',
      codeTitle: 'count.py',
      code: `
        width, height, crop = 36, 32, 28   #@p1
        across = width - crop + 1   # 9    #@across
        down = height - crop + 1    # 5    #@down
        crops = across * down       # 45   #@total
        versions = crops * 2        # 90   #@flip
      `,
      beats: [
        { id: 'p1', say: 'Try one. A training image is thirty six pixels wide and thirty two high. A random twenty eight by twenty eight crop is cut from it, then flipped left to right half of the time. How many different versions can that give?', code: 'p1' },
        { id: 'across', say: 'Across, the crop\'s left edge can sit at zero up to thirty six minus twenty eight, which is eight: nine places.', code: 'across' },
        { id: 'down', say: 'Down, the image is only thirty two high, so the top edge sits at zero to four: five places.', code: 'down' },
        { id: 'total', say: 'Nine across times five down is forty five crops.', code: 'total' },
        { id: 'flip', say: 'And each comes flipped or not: forty five times two, ninety versions.', code: 'flip' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

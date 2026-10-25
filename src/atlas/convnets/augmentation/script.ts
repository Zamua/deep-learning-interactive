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
        { id: 'count', say: 'Random crops alone add a lot. A twenty eight pixel crop fits at five places across a thirty two pixel image, and five down: twenty five crops.', code: 'crop' },
        { id: 'flips', say: 'Add a random flip, and every image comes in fifty versions.', code: 'flip' },
        { id: 'train', say: 'Do this only while training, with fresh random choices every time. Validation and test images stay untouched, so they still measure the model on real data.', code: 'test' },
        { id: 'gap', say: 'The training loss ends a little higher, because varied images are harder to memorize, and the validation loss ends lower: a smaller gap.', code: 'all' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

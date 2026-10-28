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
  papers: [
    { who: 'Krizhevsky, Sutskever & Hinton', year: 2012, title: 'ImageNet classification with deep convolutional neural networks', url: 'https://papers.nips.cc/paper/2012/hash/c399862d3b9d6b76c8436e924a68c45b-Abstract.html', scene: 'crops' },
  ],
  scenes: [
    {
      id: 'variety',
      title: 'Change the image, keep the label',
      codeTitle: 'augment.py',
      code,
      beats: [
        { id: 'memo', say: 'A classifier that overfits has memorized its training images, quirks and all. More photos would help, but they are slow to collect. A cheaper fix: never show it exactly the same image twice.', code: 'all' },
        { id: 'label', say: 'Every training image comes with its label: the correct answer stored with it, the class it really belongs to. This arrow\'s label says it points right.', code: 'all' },
        { id: 'change', say: 'Each time an image is used, change it a little at random: shift it, darken it, crop it. It still shows the same thing, so its label stays true.', code: ['crop', 'color'] },
        { id: 'flip', say: 'But the change must keep the label true. Flip this arrow left to right, and it points left: its stored label is now wrong. A flipped photo of a cat, though, is still a cat.', code: 'flip' },
        { id: 'which', say: 'So which changes are safe depends on the task. A six turned upside down is a nine, and a red light with its colors shifted can look green.', code: 'all' },
        { id: 'name', say: 'This is data augmentation. To augment is to make bigger: it grows the training set without a single new photo.', code: 'all' },
      ],
    },
    {
      id: 'crops',
      title: 'How much variety',
      codeTitle: 'augment.py',
      code,
      beats: [
        { id: 'count', say: 'Random crops alone add a lot. Cut a twenty eight by twenty eight crop from a thirty two by thirty two image.', code: 'crop' },
        { id: 'across', say: 'Slide it across, a pixel at a time. Its left edge can sit at zero, one, two, three or four. At four, its right edge meets the image\'s.', code: 'crop' },
        { id: 'plus', say: 'That is thirty two minus twenty eight, plus one, because position zero counts as well: five places.', code: 'crop' },
        { id: 'down', say: 'Down, the same rule with the image\'s height gives five places again. Every place across pairs with every place down: five times five, twenty five crops.', code: 'crop' },
        { id: 'flips', say: 'A random flip shows each crop either way round, which doubles that: fifty versions of every image.', code: 'flip' },
        { id: 'alex', say: 'In 2012, Alex Krizhevsky, Ilya Sutskever and Geoffrey Hinton built an image classifier with sixty million adjustable numbers. Even {1.2|one point two} million training photos were too few to fit that many without overfitting.', code: 'all' },
        { id: 'alex2', say: 'So they trained on random {224|two twenty four} by {224|two twenty four} crops of their {256|two fifty six} by {256|two fifty six} photos, and the crops\' mirror images: label-preserving transformations, they called them. That is over two thousand versions of every photo.', code: ['crop', 'flip'] },
        { id: 'fresh', say: 'Make fresh random choices every time an image is used. One changed copy, saved once, would simply be memorized instead.', code: 'all' },
        { id: 'test', say: 'And only while training. Validation and test images are just cut to size, from the middle, so they still measure the model on real images.', code: 'test' },
      ],
    },
    {
      id: 'gap',
      title: 'A smaller gap',
      codeTitle: 'train.py',
      code: `
        for epoch in range(16):            #@fit
            train_one_epoch(model, train)  #@fit
            L_train = loss(model, train)   #@both
            L_val = loss(model, val)       #@both
        # with train_tf: L_train up a bit  #@up
        # and L_val down: a smaller gap    #@down
      `,
      beats: [
        { id: 'before', say: 'Here are the loss curves of an overfitting model, trained without augmentation: the training loss falls toward zero, while the validation loss turns and climbs.', code: 'both' },
        { id: 'with', say: 'Train it again with random crops and flips. The training loss ends a little higher, because images that keep changing are harder to memorize.', code: ['fit', 'up'] },
        { id: 'lower', say: 'But the validation loss keeps falling for longer, and ends lower. The gap shrinks: the model has learned more of what the images share, and less of their quirks.', code: 'down' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

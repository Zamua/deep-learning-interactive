import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-distillation',
  title: 'Distillation',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Bucilă, Caruana & Niculescu-Mizil', year: 2006, title: 'Model compression', url: 'https://www.cs.cornell.edu/~caruana/compression.kdd06.pdf', scene: 'why' },
    { who: 'Hinton, Vinyals & Dean', year: 2015, title: 'Distilling the knowledge in a neural network', url: 'https://arxiv.org/abs/1503.02531', scene: 'why' },
  ],
  scenes: [
    {
      id: 'why',
      title: 'A big teacher, a small student',
      codeTitle: 'distill.py',
      code: `
        s = teacher(image)  # big, accurate  #@t
        student(image)      # small, fast    #@st
        label = [1, 0, 0]   # cat            #@label
        softmax(s)  # [0.87, 0.12, 0.02]     #@p
      `,
      beats: [
        { id: 'big', say: 'A large network can be very accurate, and still too slow and costly to run for millions of people. A small network is fast and cheap, but usually less accurate.', code: 't' },
        { id: 'copy', say: 'So train the small one, the student, to copy the large one, the teacher.', code: 'st' },
        { id: 'compress', say: 'In 2006, Rich Caruana and his colleagues did this with a big, slow collection of models. Their student was a thousand times smaller and faster, and nearly as accurate.', code: ['t', 'st'] },
        { id: 'label', say: 'Normally a network learns from labels: each training image comes with its right answer. Written as targets, one number per class, a cat\'s label is one for cat, and zero for dog and for car.', code: 'label' },
        { id: 'teacher', say: 'The teacher says more. Its scores for this cat, four, two and zero, give probabilities of {0.87|zero point eight seven} for cat, {0.12|zero point one two} for dog, and only {0.02|zero point zero two} for car.', code: 'p' },
        { id: 'hint', say: 'This cat looks a little like a dog, and almost nothing like a car. Geoffrey Hinton, Oriol Vinyals and Jeff Dean gave an example in 2015: a BMW is rarely mistaken for a garbage truck, but that is still far likelier than mistaking it for a carrot.', code: 'p' },
      ],
    },
    {
      id: 'soften',
      title: 'Raise the temperature',
      codeTitle: 'distill.py',
      code: `
        softmax(s)      # [0.87, 0.12, 0.02]  #@one
        T = 2                                 #@T
        q = softmax(s / T)                    #@q
        # s / 2 = [2, 1, 0]                   #@q
        # q = [0.67, 0.24, 0.09]              #@flat
        softmax(s / 4)  # [0.51, 0.31, 0.19]  #@four
      `,
      beats: [
        { id: 'faint', say: 'But the teacher is confident, so those hints are faint. Car\'s {0.02|zero point zero two} is so close to zero that the student would barely notice it.', code: 'one' },
        { id: 'temp', say: 'So soften them with a temperature, as in sampling: divide every score by T before the softmax. With T at two, the scores are halved: two, one and zero.', code: ['T', 'q'] },
        { id: 'flat', say: 'The bars flatten to {0.67|zero point six seven}, {0.24|zero point two four} and {0.09|zero point zero nine}, the same numbers sampling gave for these scores. These are the soft targets, q.', code: 'flat' },
        { id: 'higher', say: 'With T at four, they flatten further: the higher T, the more the wrong classes count. Lower it toward zero, and they sharpen toward all on cat. Either way, cat stays on top.', code: 'four' },
        { id: 'name', say: 'Hinton, Vinyals and Dean called this distillation. The name fits: in chemistry, heating a mixture draws out its essence, and here raising the temperature draws out what the teacher knows.', code: 'q' },
      ],
    },
    {
      id: 'loss',
      title: 'Match the soft targets',
      codeTitle: 'distill.py',
      code: `
        q = softmax(teacher(image) / T)       #@q
        p = softmax(student(image) / T)       #@p
        -np.log(p[0])     # label: 0.51       #@hard
        L = -(q * np.log(p)).sum()            #@L
        # 0.34 + 0.39 + 0.14 = 0.87           #@sum
      `,
      beats: [
        { id: 'p', say: 'The student\'s scores are softened with the same T. Say its probabilities, p, come out {0.6|zero point six} for cat, and {0.2|zero point two} each for dog and car.', code: 'p' },
        { id: 'hard', say: 'Cross-entropy weights each class\'s surprise, minus log p, by its target. Against the label, only cat has any weight: minus log {0.6|zero point six}, about {0.51|zero point five one}. Dog and car do not count at all.', code: 'hard' },
        { id: 'soft', say: 'Distillation puts the teacher\'s soft targets, q, in place of the label. The loss, L, adds up, over every class k, {qₖ|q k} times minus log {pₖ|p k}.', code: ['q', 'L'] },
        { id: 'cat', say: 'Cat adds {0.67|zero point six seven} times {0.51|zero point five one}: about {0.34|zero point three four}.', code: 'L' },
        { id: 'sum', say: 'Dog and car add {0.39|zero point three nine} and {0.14|zero point one four}, so the loss is about {0.87|zero point eight seven}. Now dog and car count as well.', code: 'sum' },
        { id: 'best', say: 'The loss is lowest when p matches q exactly: {0.83|zero point eight three} here. Sharper or flatter costs more, and a student sure of cat would pay minus log zero for dog and car: a loss without limit.', code: 'L' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

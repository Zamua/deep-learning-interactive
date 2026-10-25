import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-distillation',
  title: 'Distillation',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'teacher',
      title: 'More than the right answer',
      codeTitle: 'distill.py',
      code: `
        s = teacher(image)   # [4, 2, 0]: cat, dog, car   #@s
        softmax(s)           # [0.87, 0.12, 0.02]         #@p
        label = [1, 0, 0]    # cat, and nothing more      #@label
        # the student learns from softmax(s) too          #@student
      `,
      beats: [
        { id: 'teacher', say: 'Distillation trains a small network, the student, to copy a large one, the teacher. Shown this cat, the teacher\'s scores, s, are four for cat, two for dog and zero for car.', code: 's' },
        { id: 'probs', say: 'Softmax turns that into {0.87|zero point eight seven} for cat, {0.12|zero point one two} for dog, and {0.02|zero point zero two} for car.', code: 'p' },
        { id: 'label', say: 'The label says only cat. The teacher says more: this cat looks a little like a dog, and nothing like a car.', code: 'label' },
        { id: 'student', say: 'So the student learns from the teacher\'s probabilities, not just the label, and picks up which wrong classes are close.', code: 'student' },
      ],
    },
    {
      id: 'soften',
      title: 'Soften with a temperature',
      codeTitle: 'distill.py',
      code: `
        T = 2                                       #@T
        q = softmax(s / T)   # [0.67, 0.24, 0.09]   #@q
        softmax(s / 1)       # [0.87, 0.12, 0.02]   #@one
        softmax(s / 4)       # [0.51, 0.31, 0.19]   #@four
      `,
      beats: [
        { id: 'tiny', say: 'But the teacher is confident, so those hints are faint. Car\'s {0.02|zero point zero two} barely registers.', code: 'one' },
        { id: 'temp', say: 'So soften them with a temperature, as in sampling: divide every score by T before the softmax, and call the result q. With T at two, the scores become two, one and zero.', code: ['T', 'q'] },
        { id: 'soft', say: 'Exponentiate, about {7.39|seven point three nine}, {2.72|two point seven two} and one, and divide by their total, {11.11|eleven point one one}. The teacher\'s probabilities flatten to {0.67|zero point six seven}, {0.24|zero point two four} and {0.09|zero point zero nine}: the soft targets, q.', code: 'q' },
        { id: 'higher', say: 'Cat still leads, but now dog and car count. Raise T to four, and they flatten further: the higher T, the more the wrong classes count.', code: 'four' },
      ],
    },
    {
      id: 'loss',
      title: 'Cross-entropy against soft targets',
      codeTitle: 'distill.py',
      code: `
        q = softmax(teacher(image) / T)  # [0.67, 0.24, 0.09]  #@q
        p = softmax(student(image) / T)  # [0.6, 0.2, 0.2]     #@p
        -np.log(p[0])                    # 0.51: label only    #@hard
        L = -(q * np.log(p)).sum()       # 0.87                #@L
      `,
      beats: [
        { id: 'p', say: 'The student\'s scores are softened with the same T. Say its probabilities, p, are {0.6|zero point six} for cat, and {0.2|zero point two} each for dog and car.', code: 'p' },
        { id: 'hard', say: 'Cross-entropy with the label is minus the log of cat\'s probability. Write the label as targets, one, zero, zero: weight each minus log p by its target and add, and only cat counts, {0.51|zero point five one}.', code: 'hard' },
        { id: 'soft', say: 'Distillation puts the teacher\'s soft targets, q, in place of the label. The loss, L, adds up, over every class k, {qₖ|q k} times minus log {pₖ|p k}.', code: ['q', 'L'] },
        { id: 'sum', say: 'Weighted by q, the classes add {0.34|zero point three four}, {0.39|zero point three nine} and {0.14|zero point one four}: a loss of {0.87|zero point eight seven}. Now dog and car count too.', code: 'L' },
        { id: 'best', say: 'The loss is lowest when p matches q exactly: {0.83|zero point eight three} here. A student sure it saw a cat would pay minus log zero for dog and car, a loss without limit.', code: 'L' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

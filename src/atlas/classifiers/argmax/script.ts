import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-argmax',
  title: 'Argmax',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'position',
      title: 'Where, not how big',
      codeTitle: 'argmax.py',
      code: `
        s = np.array([2, 7, 1, 5])   #@s
        s.max()       # 7: the value      #@max
        s.argmax()    # 1: its position   #@arg
      `,
      beats: [
        { id: 'scores', say: 'Here are four scores: two, seven, one and five.', code: 's' },
        { id: 'max', say: 'The largest value is seven. That is the max.', code: 'max' },
        { id: 'arg', say: 'The argmax asks a different question: where is it? Counting from zero, as Python does, seven sits at position one.', code: 'arg' },
        { id: 'predict', say: 'For a classifier, that position is the answer. The scores belong to classes zero to three, so it predicts class one.', code: 'arg' },
      ],
    },
    {
      id: 'accuracy',
      title: 'Accuracy',
      codeTitle: 'accuracy.py',
      code: `
        S = np.array([[2, 7, 1],    #@S
                      [4, 0, 3],    #@S
                      [1, 2, 6],    #@S
                      [5, 3, 0]])   #@S
        y = np.array([1, 2, 2, 0])  #@y
        pred = S.argmax(axis=1)  # [1, 0, 2, 0]  #@pred
        (pred == y).mean()       # 0.75          #@acc
      `,
      beats: [
        { id: 'rows', say: 'Now four images at once: one row of three scores for each, and its right label, y, beside it.', code: ['S', 'y'] },
        { id: 'pred', say: 'The argmax of each row is the prediction: one, zero, two and zero.', code: 'pred' },
        { id: 'compare', say: 'Check them against the labels. Three match. The second image was class two, not zero.', code: 'pred' },
        { id: 'acc', say: 'The share that match is the accuracy: three out of four, {0.75|zero point seven five}.', code: 'acc' },
      ],
    },
    {
      id: 'example',
      title: 'Worked example',
      codeTitle: 'example.py',
      code: `
        s = np.array([4, -1, 6, 3])   #@s
        s.argmax()    # 2             #@arg
      `,
      beats: [
        { id: 'ask', think: true, say: 'Your turn. The scores are four, minus one, six and three. What is the argmax?', code: 's' },
        { id: 'max', say: 'The largest score is six.' },
        { id: 'arg', say: 'Count from zero: four is at zero, minus one at one, and six at two. The argmax is two.', code: 'arg' },
      ],
    },
  ],
};

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
        { id: 'scores', say: 'Here are four scores, one for each of four possible answers: two, seven, one and five.', code: 's' },
        { id: 'max', say: 'The largest value is seven. That is the max.', code: 'max' },
        { id: 'arg', say: 'The argmax asks a different question: where is it? Counting from zero, as Python does, seven sits at position one.', code: 'arg' },
        { id: 'predict', say: 'Often the position is what you want. With the answers numbered zero to three, the top pick is answer one.', code: 'arg' },
      ],
    },
    {
      id: 'accuracy',
      title: 'Accuracy',
      codeTitle: 'accuracy.py',
      code: `
        rows = np.array([[2, 7, 1],    #@S
                         [4, 0, 3],    #@S
                         [1, 2, 6],    #@S
                         [5, 3, 0]])   #@S
        y = np.array([1, 2, 2, 0])     #@y
        pick = rows.argmax(axis=1)  # [1, 0, 2, 0]  #@pred
        (pick == y).mean()          # 0.75          #@acc
      `,
      beats: [
        { id: 'rows', say: 'Now four questions at once: one row of three scores for each, and its right answer, y, beside it.', code: ['S', 'y'] },
        { id: 'pred', say: 'The argmax of each row is its pick: one, zero, two and zero.', code: 'pred' },
        { id: 'compare', say: 'Check them against y. Three match. The second question\'s answer was two, not zero.', code: 'pred' },
        { id: 'acc', say: 'The share that match is the accuracy: three out of four, {0.75|zero point seven five}.', code: 'acc' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

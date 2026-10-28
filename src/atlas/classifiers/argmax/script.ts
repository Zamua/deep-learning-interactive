import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-argmax',
  title: 'Argmax',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'pick',
      title: 'One answer to pick',
      codeTitle: 'scores.py',
      code: `
        # cat, dog, bird or fish?     #@ask
        s = np.array([2, 7, 1, 5])    #@s
        # the top score wins: 7       #@pick
      `,
      beats: [
        { id: 'ask', say: 'Suppose a program looks at a photo and must say which animal it shows: a cat, a dog, a bird or a fish. That is a question with four possible answers.', code: 'ask' },
        { id: 'score', say: 'It gives each answer a score: a number for how strongly it favors that answer. The higher the score, the more it leans that way.', code: 'ask' },
        { id: 'vector', say: 'Kept in order, the four scores make a vector, s: two, seven, one and five.', code: 's' },
        { id: 'pick', say: 'In the end it has to pick one answer, and the natural pick is the one with the highest score.', code: 'pick' },
      ],
    },
    {
      id: 'where',
      title: 'Where, not how high',
      codeTitle: 'argmax.py',
      code: `
        s = np.array([2, 7, 1, 5])    #@s
        np.max(s)      # 7: how high  #@max
        np.argmax(s)   # 1: where     #@arg
        s[1]           # 7            #@sub
        np.argmin(s)   # 2: lowest    #@min
      `,
      beats: [
        { id: 'max', say: 'The highest score is seven. That is the max of s.', code: 'max' },
        { id: 'which', say: 'But seven alone does not say which answer won. For that you need where it sits: its position.', code: 'arg' },
        { id: 'index', say: 'Counting from zero, the way Python counts a vector\'s entries, the seven sits at position one.', code: 'arg' },
        { id: 'sub', say: 'A position written small beside s picks out one entry: {s₁|s sub one} is seven.', code: 'sub' },
        { id: 'name', say: 'That position is the argmax. Arg is short for argument, the mathematician\'s word for an input: the argmax is the input that gives the max.', code: 'arg' },
        { id: 'answer', say: 'Position one is the dog, so the pick is dog. The max says how high the top score is; the argmax says which answer it belongs to.', code: 'arg' },
        { id: 'min', say: 'Turned around, the argmin is the position of the lowest score: two, the bird.', code: 'min' },
      ],
    },
    {
      id: 'accuracy',
      title: 'How often the pick is right',
      codeTitle: 'accuracy.py',
      code: `
        rows = np.array([[2, 7, 1],   #@S
                         [4, 0, 3],   #@S
                         [1, 2, 6],   #@S
                         [5, 3, 0]])  #@S
        y = np.array([1, 2, 2, 0])    #@y
        pick = np.argmax(rows, axis=1)  #@pred
        # one per row: [1, 0, 2, 0]   #@pred
        (pick == y).mean()   # 0.75   #@acc
      `,
      beats: [
        { id: 'rows', say: 'Now four questions like it, each with three possible answers and its own three scores. Stack the lists one under another, and each list becomes a row.', code: 'S' },
        { id: 'y', say: 'Beside each row is its right answer, y, written as a position too.', code: 'y' },
        { id: 'pred', say: 'The argmax of each row is that question\'s pick. In the first row, the seven is at position one.', code: 'pred' },
        { id: 'compare', say: 'Check each pick against y. Three match. The second question\'s pick is zero, but its right answer is two.', code: 'pred' },
        { id: 'acc', say: 'The share of picks that are right is the accuracy: three out of four, {0.75|zero point seven five}.', code: 'acc' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

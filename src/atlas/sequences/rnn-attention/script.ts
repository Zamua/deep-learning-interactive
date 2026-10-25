import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-rnn-attention',
  title: 'Attention over the encoder',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'look',
      title: 'Look back at every state',
      codeTitle: 'attention.py',
      code: `
        enc = np.array([[2, 0], [0, 1], [1, 0]])  #@enc
        q = np.array([1, 0])   # decoder state   #@q
        e = enc @ q        # [2, 0, 1]           #@e
        a = softmax(e)     # [0.67, 0.09, 0.24]  #@a
        ctx = a @ enc      # [1.58, 0.09]        #@ctx
      `,
      beats: [
        { id: 'keep', say: 'A plain decoder only sees the encoder\'s final state. Attention keeps all of them: one state per input word, here for je, suis, and étudiant.', code: 'enc' },
        { id: 'score', say: 'At each step, the decoder scores every encoder state against its own state, q. A simple score is the dot product: two, zero, and one.', code: ['q', 'e'] },
        { id: 'weights', say: 'Softmax turns the scores into weights that are positive and add up to one: {0.67|zero point six seven}, {0.09|zero point zero nine}, and {0.24|zero point two four}.', code: 'a' },
        { id: 'context', say: 'The context vector is the weighted sum of the states: mostly je, a little of the rest. Here, {1.58|one point five eight} and {0.09|zero point zero nine}.', code: 'ctx' },
        { id: 'use', say: 'The decoder reads this context along with its own state to predict the next word: I.', code: 'ctx' },
      ],
    },
    {
      id: 'every',
      title: 'A fresh look at every step',
      codeTitle: 'attention.py',
      code: `
        for t in range(len(out)):        #@loop
            e = enc @ q[t]               #@loop
            a[t] = softmax(e)   # row t       #@row
        # nothing squeezes through one vector   #@free
      `,
      beats: [
        { id: 'again', say: 'At the next step the decoder\'s state has moved on, so the scores change, and it looks somewhere else: for am and a, at suis; for student, at étudiant.', code: 'loop' },
        { id: 'grid', say: 'Stack the weights, one row per output word, and they show which input words each output word drew on.', code: 'row' },
        { id: 'free', say: 'Nothing has to squeeze through one fixed-size vector any more: every step can read every input state directly. That is attention.', code: 'free' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

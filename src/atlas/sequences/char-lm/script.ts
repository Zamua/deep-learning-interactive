import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-char-lm',
  title: 'Next-token prediction',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'shift',
      title: 'Predict the next character',
      codeTitle: 'char_lm.py',
      code: `
        text = 'hello'                                #@text
        xs, ys = text[:-1], text[1:]  # hell, ello  #@shift
        vocab = ['h', 'e', 'l', 'o']   # V = 4        #@vocab
        s = Why @ h       # one score per token  #@s
        p = softmax(s)    # [0.1, 0.5, 0.3, 0.1]      #@p
      `,
      beats: [
        { id: 'task', say: 'A language model reads text and, at every step, predicts what comes next. Here the tokens are characters, and the text is hello.', code: 'text' },
        { id: 'shift', say: 'So the inputs are h, e, l, l, and the targets are the same text shifted by one: e, l, l, o.', code: 'shift' },
        { id: 'scores', say: 'At each step, a linear layer turns the hidden state into one score for every token in the vocabulary: four here, h, e, l and o.', code: ['vocab', 's'] },
        { id: 'softmax', say: 'Softmax turns the scores into probabilities for the next character. After reading h, this model gives e {0.5|zero point five}.', code: 'p' },
        { id: 'memory', say: 'Look at steps two and three. Both read an l, but one must predict l and the other o. Only the memory, h, can tell them apart.', code: 'shift' },
      ],
    },
    {
      id: 'loss',
      title: 'Add up the losses',
      codeTitle: 'char_lm.py',
      code: `
        p_y = [0.5, 0.4, 0.6, 0.8]   # e, l, l, o   #@py
        L_t = -np.log(p_y)  # 0.69 0.92 0.51 0.22   #@Lt
        L = L_t.sum()       # 2.34                 #@L
        L / 4               # 0.59 per step        #@mean
      `,
      beats: [
        { id: 'step', say: 'Each step is a classification over the vocabulary, so its loss is cross-entropy. At step zero the target, e, got {0.5|zero point five}: the loss is minus its log, {0.69|zero point six nine}.', code: ['py', 'Lt'] },
        { id: 'all', say: 'Every step does the same against its own target: {0.92|zero point nine two}, {0.51|zero point five one}, and {0.22|zero point two two}.', code: 'Lt' },
        { id: 'total', say: 'The loss for the whole text adds them up: {2.34|two point three four}. Divided by the four steps, that is about {0.59|zero point five nine} per step.', code: ['L', 'mean'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

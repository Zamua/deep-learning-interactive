import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-lstm',
  title: 'LSTM',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'gates',
      title: 'A cell and three gates',
      codeTitle: 'lstm.py',
      code: `
        z = np.concatenate([h, x])           #@z
        f_t = sigmoid(Wf @ z + bf)   # keep     #@f
        i_t = sigmoid(Wi @ z + bi)   # write    #@i
        o_t = sigmoid(Wo @ z + bo)   # show     #@o
        g_t = np.tanh(Wg @ z + bg)   # content  #@g
        c = f_t * c + i_t * g_t                  #@c
        h = o_t * np.tanh(c)                     #@h
      `,
      beats: [
        { id: 'cell', say: 'An LSTM carries two things from step to step: the hidden state, h, and a second memory, the cell state, c.', code: ['c', 'h'] },
        { id: 'gates', say: 'Three gates control the cell. Each is a sigmoid of the old h and the new input, so each is a number between zero and one: a dial for how much.', code: ['z', 'f', 'i', 'o'] },
        { id: 'cand', say: 'And a candidate, g, from a tanh, proposes new content between minus one and one.', code: 'g' },
        { id: 'roles', say: 'The forget gate, f, scales the old cell. The input gate, i, scales the candidate before it is added. The output gate, o, scales what the cell shows as h.', code: ['c', 'h'] },
      ],
    },
    {
      id: 'update',
      title: 'One step, in numbers',
      codeTitle: 'lstm.py',
      code: `
        c_prev = 2.0                          #@prev
        f_t, i_t, g_t, o_t = 0.3, 0.8, 0.5, 0.5  #@gates
        c = f_t * c_prev + i_t * g_t   # 1.0  #@c
        h = o_t * np.tanh(c)           # 0.38 #@h
      `,
      beats: [
        { id: 'keep', say: 'Here is one unit. The old cell holds two, and the forget gate is {0.3|zero point three}, so the cell keeps {0.6|zero point six}.', code: ['prev', 'c'] },
        { id: 'write', say: 'The candidate is {0.5|zero point five} and the input gate {0.8|zero point eight}, so it writes {0.4|zero point four}.', code: ['gates', 'c'] },
        { id: 'add', say: 'The new cell adds the two: {0.6|zero point six} plus {0.4|zero point four}, exactly one.', code: 'c' },
        { id: 'show', say: 'Then h is the output gate times the tanh of the cell: {0.5|zero point five} times {0.76|zero point seven six}, about {0.38|zero point three eight}.', code: 'h' },
      ],
    },
    {
      id: 'path',
      title: 'Why memories last',
      codeTitle: 'lstm_grad.py',
      code: `
        # one step back along the cell: times f_t   #@cell
        0.95 ** 20    # 0.36: still there            #@lstm
        0.5 ** 20     # 0.000001: gone               #@rnn
      `,
      beats: [
        { id: 'path', say: 'Now follow the gradient back along the cell. The new cell is f times the old one, plus new content, so one step back just multiplies by f.', code: 'cell' },
        { id: 'lstm', say: 'No weight matrix and no tanh slope in between. With the forget gate at {0.95|zero point nine five}, twenty steps back still keep about a third of the gradient.', code: 'lstm' },
        { id: 'rnn', say: 'A plain RNN that multiplies by a half at each step keeps one part in a million. The cell\'s update by addition carries memories, and their gradients, a long way.', code: 'rnn' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

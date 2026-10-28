import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-lstm',
  title: 'LSTM',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Hochreiter & Schmidhuber', year: 1997, title: 'Long Short-Term Memory', url: 'https://doi.org/10.1162/neco.1997.9.8.1735', scene: 'fade' },
    { who: 'Gers, Schmidhuber & Cummins', year: 2000, title: 'Learning to Forget: Continual Prediction with LSTM', url: 'https://doi.org/10.1162/089976600300015015', scene: 'forget' },
  ],
  scenes: [
    {
      id: 'fade',
      title: 'Memories that fade',
      codeTitle: 'rnn.py',
      code: `
        h = np.tanh(Whh @ h + Wxh @ x + b)   #@rnn
        # one step back: × Whh · tanh′       #@back
        0.5 ** 10    # ten steps: 0.001      #@fade
        c = c + new  # one step back: × 1    #@cell
        1.0 ** 10    # ten steps: 1.0        #@whole
      `,
      beats: [
        { id: 'recall', say: 'A recurrent network carries its memory, h, from step to step.', code: 'rnn' },
        { id: 'back', say: 'Backprop through time sends the gradient back along that chain. Each step back multiplies it by {W_hh|W h h} times a tanh slope.', code: 'back' },
        { id: 'fade', say: 'At a half per step, ten steps back shrink it to a half to the tenth: about a thousandth, too little to learn from.', code: 'fade' },
        { id: 'hochreiter', say: 'Sepp Hochreiter analyzed this fading in 1991. In 1997, he and Jürgen Schmidhuber proposed a way around it.', code: 'fade' },
        { id: 'cell', say: 'Add a second memory, the cell state, c, that skips the weight matrix and the tanh: each step just adds to it.', code: 'cell' },
        { id: 'add', say: 'An add gate passes its gradient through unchanged, so along the cell, each step back multiplies by exactly one. Ten steps back, it arrives whole.', code: ['cell', 'whole'] },
        { id: 'name', say: 'They called it long short-term memory: LSTM. A network\'s activations were its short-term memory, its weights the long-term one, and the cell makes the short-term memory last.', code: 'cell' },
      ],
    },
    {
      id: 'gates',
      title: 'Gates on the cell',
      codeTitle: 'lstm.py',
      code: `
        hx = np.concatenate([h, x])          #@hx
        i_t = sigmoid(Wi @ hx + bi)  # in    #@i
        g_t = np.tanh(Wg @ hx + bg)  # new   #@g
        c = c + i_t * g_t                    #@c
        o_t = sigmoid(Wo @ hx + bo)  # out   #@o
        h = o_t * np.tanh(c)                 #@h
      `,
      beats: [
        { id: 'gate', say: 'The cell\'s inputs and outputs are run by gates. In backprop, any node of a graph was a gate: an add gate, a multiply gate.', code: 'c' },
        { id: 'dial', say: 'Here the word is narrower: a number from zero to one that multiplies a signal. At one, all of it passes; at zero, none; in between, a share.', code: 'c' },
        { id: 'sigmoid', say: 'A sigmoid makes such a number. Each gate is a sigmoid of the old h and the new x, joined into one vector and weighted, like an RNN step.', code: ['hx', 'i', 'o'] },
        { id: 'cand', say: 'The new content is the candidate, g: a tanh of the same inputs, between minus one and one.', code: 'g' },
        { id: 'input', say: 'The input gate, i, scales the candidate before it is added. Near one, the new content goes in; near zero, almost none does.', code: ['i', 'c'] },
        { id: 'output', say: 'The output gate, o, scales what the cell shows: the new h is o times the tanh of the cell. So the cell can hold a memory without showing it.', code: ['o', 'h'] },
      ],
    },
    {
      id: 'forget',
      title: 'Learning to forget',
      codeTitle: 'lstm.py',
      code: `
        f_t = sigmoid(Wf @ hx + bf)  # keep  #@f
        c = f_t * c + i_t * g_t              #@c
        f_t * c     # 0.3 * 2.0 = 0.6        #@keep
        i_t * g_t   # 0.8 * 0.5 = 0.4        #@write
        c           # 0.6 + 0.4 = 1.0        #@add
        np.tanh(c)  # 0.76                   #@squash
        h = o_t * np.tanh(c)   # 0.38        #@h
      `,
      beats: [
        { id: 'grow', say: 'That first LSTM never let go: the cell only added, so on a long stream with no marked end, it could grow without limit.', code: 'c' },
        { id: 'forget', say: 'In 2000, Felix Gers, Jürgen Schmidhuber and Fred Cummins added a forget gate, f: a sigmoid that multiplies the old cell. Near one, it keeps the memory; near zero, it lets it go.', code: 'f' },
        { id: 'formula', say: 'So {cₜ = fₜ cₜ₋₁ + iₜ gₜ|c t equals f t times c t minus one, plus i t times g t}: keep a share of the old, write a share of the new.', code: 'c' },
        { id: 'keep', say: 'One unit: the old cell holds two, and the forget gate is {0.3|zero point three}, so it keeps {0.3|zero point three} times two: {0.6|zero point six}.', code: 'keep' },
        { id: 'write', say: 'The input gate is {0.8|zero point eight} and the candidate {0.5|zero point five}, so it writes {0.4|zero point four}.', code: 'write' },
        { id: 'add', say: 'The new cell adds the two: {0.6|zero point six} plus {0.4|zero point four}, exactly one.', code: 'add' },
        { id: 'squash', say: 'To show it, the cell goes through a tanh. The tanh of one is about {0.76|zero point seven six}.', code: 'squash' },
        { id: 'show', say: 'The output gate is a half, so it lets half of that out: h is about {0.38|zero point three eight}.', code: 'h' },
        { id: 'layer', say: 'A layer does this entry by entry, each unit with its own cell and gates.', code: ['c', 'h'] },
      ],
    },
    {
      id: 'path',
      title: 'Why memories last',
      codeTitle: 'lstm_grad.py',
      code: `
        # one step back along c: × f_t       #@cell
        0.95 ** 20   # 0.36: still there     #@lstm
        0.5 ** 20    # 0.000001: gone        #@rnn
      `,
      beats: [
        { id: 'path', say: 'Now the gradient. Along the cell, one step back multiplies it by f: {∂cₜ/∂cₜ₋₁ = fₜ|partial c t, partial c t minus one, equals f t}. No weight matrix, no tanh slope.', code: 'cell' },
        { id: 'lstm', say: 'Hold f near one, say at {0.95|zero point nine five}, and twenty steps back still keep about a third of the gradient.', code: 'lstm' },
        { id: 'rnn', say: 'A plain RNN that multiplies by a half at each step keeps one part in a million.', code: 'rnn' },
        { id: 'learn', say: 'The forget gate is learned, so the network can hold it near one for as long as a memory matters.', code: 'cell' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

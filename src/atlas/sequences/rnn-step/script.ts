import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-rnn-step',
  title: 'The recurrence',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'step',
      title: 'One step',
      codeTitle: 'rnn_step.py',
      code: `
        h = np.array([0.5, -0.5])   # memory     #@h
        x = np.array([1.0, 0.0])    # this token #@x
        Whh @ h          # [0.5, -1.0]            #@mem
        Wxh @ x          # [1.0, 0.0]             #@inp
        a = Whh @ h + Wxh @ x + b   # [1.0, -0.5] #@sum
        h = np.tanh(a)   # [0.76, -0.46]          #@tanh
      `,
      beats: [
        { id: 'carry', say: 'A recurrent network reads a sequence one token at a time, and carries a memory from step to step: the hidden state, h.', code: 'h' },
        { id: 'inputs', say: 'Each step takes two things: the memory so far, {hₜ₋₁|h of t minus one}, and the new input, {xₜ|x of t}, the embedding of the current token.', code: ['h', 'x'] },
        { id: 'mem', say: '{Whh|W h h} mixes the old memory. Here it gives {0.5|zero point five} and minus one.', code: 'mem' },
        { id: 'inp', say: '{Wxh|W x h} brings in the input: one and zero.', code: 'inp' },
        { id: 'sum', say: 'Add the two, and a bias b of minus {0.5|zero point five} and {0.5|zero point five}. That makes one and minus {0.5|zero point five}.', code: 'sum' },
        { id: 'tanh', say: 'Then tanh squashes each entry to between minus one and one: {0.76|zero point seven six} and minus {0.46|zero point four six}. That is the new memory, {hₜ|h of t}.', code: 'tanh' },
      ],
    },
    {
      id: 'unroll',
      title: 'The same weights at every step',
      codeTitle: 'rnn.py',
      code: `
        h = np.zeros(H)   # h_0                  #@h0
        for x in xs:      # one step per token   #@loop
            h = np.tanh(Whh @ h + Wxh @ x + b)   #@loop
        # Whh: (H, H)  Wxh: (H, D)  b: (H,)      #@shapes
      `,
      beats: [
        { id: 'unroll', say: 'To read a whole sequence, repeat the step. {h₁|h one} comes from {h₀|h zero} and {x₁|x one}, {h₂|h two} from {h₁|h one} and {x₂|x two}, and so on. {h₀|h zero} starts at all zeros.', code: ['h0', 'loop'] },
        { id: 'same', say: 'Every step uses the same three weights: {Whh|W h h}, {Wxh|W x h}, and b. Nothing is new per step, so one network reads a sequence of any length.', code: 'loop' },
        { id: 'memory', say: 'And h is all that passes from step to step: everything read so far, squeezed into H numbers.', code: 'loop' },
        { id: 'shapes', say: 'The shapes follow. {Whh|W h h} turns H numbers into H, so it is H by H. {Wxh|W x h} turns an input of D numbers into H, so it is H by D. And b has H entries.', code: 'shapes' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

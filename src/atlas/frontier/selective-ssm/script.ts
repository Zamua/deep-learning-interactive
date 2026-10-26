import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-selective-ssm',
  title: 'Selective state spaces',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'select',
      title: 'Each input sets its decay',
      codeTitle: 'selective.py',
      code: `
        x  = np.array([4, 2, 6])                #@x
        dt = np.array([1.0, 0.1, 3.0])          #@dt
        # dt: made from each x, always > 0      #@dt
        a  = np.exp(-dt)   # [0.37, 0.9, 0.05]  #@a
      `,
      beats: [
        { id: 'fixed', say: 'A linear recurrence fades every input by the same a: a name and a comma are forgotten at the same rate.', code: 'x' },
        { id: 'select', say: 'Mamba, a selective state space model from 2023, lets each input set its own decay: {aₜ = e^(−Δₜ)|a t equals e to the minus delta t}.', code: 'a' },
        { id: 'delta', say: '{Δₜ|Delta t}, the step size, comes from {xₜ|x t} through a small learned layer, and is always positive.', code: 'dt' },
        { id: 'big', say: 'A big step forgets: Δ of three gives {e⁻³ ≈ 0.05|e to the minus three, about zero point zero five}, and the old state is nearly wiped.', code: 'a' },
        { id: 'small', say: 'A small step keeps: Δ of {0.1|zero point one} gives about {0.9|zero point nine}, and the state carries on, like an LSTM\'s forget gate set by the token.', code: 'a' },
      ],
    },
    {
      id: 'run',
      title: 'Keep, then forget',
      codeTitle: 'run.py',
      code: `
        b, h = 1, 0                     #@init
        for t in range(3):              #@loop
            h = a[t] * h + b * x[t]     #@loop
            # 4, then 5.6, then 6.28    #@vals
      `,
      beats: [
        { id: 'h1', say: 'With b at one, from zero: step one has nothing to fade, so {h₁|h one} is the input, four.', code: ['init', 'loop'] },
        { id: 'h2', say: 'Step two keeps: {0.9|zero point nine} times four, plus two, is {5.6|five point six}.', code: 'vals' },
        { id: 'h3', say: 'Step three forgets: {0.05|zero point zero five} times {5.6|five point six} is about {0.28|zero point two eight}; add six, and {h₃|h three} is {6.28|six point two eight}, almost all new input.', code: 'vals' },
        { id: 'more', say: 'Mamba also lets Δ scale the input, and computes b and c from the input too: the token decides what the state keeps.', code: 'loop' },
      ],
    },
    {
      id: 'memory',
      title: 'A state that never grows',
      codeTitle: 'memory.py',
      code: `
        layers, d, nbytes = 32, 4000, 2                  #@model
        tokens = 4000                                    #@cache
        cache = 2 * layers * tokens * d * nbytes  # 2 GB #@cache
        state_size = 128_000     # numbers per layer     #@state
        state = layers * state_size * nbytes     # 8 MB #@state
        cache / state                             # 250  #@ratio
      `,
      beats: [
        { id: 'cache', say: 'While generating, a transformer\'s KV cache holds two, times the layers, times the tokens, times d, times the bytes: it grows with every token.', code: ['model', 'cache'] },
        { id: 'state', say: 'This model keeps only its state, a fixed set of numbers per layer, updated in place: a summary of the past, where the cache keeps every token.', code: 'state' },
        { id: 'size', say: 'Take thirty two layers, d at four thousand, and two bytes per number. At four thousand tokens, the cache is about two gigabytes.', code: ['model', 'cache'] },
        { id: 'ratio', say: 'Give each layer a state of {128,000|a hundred and twenty eight thousand} numbers: about eight megabytes, at any length. The cache is two hundred and fifty times that.', code: ['state', 'ratio'] },
      ],
    },
    {
      id: 'try',
      title: 'Try two',
      codeTitle: 'try.py',
      code: `
        a = [0.5, 0.9, 0.1]           #@p1
        b, h = 1, 0                   #@p1
        for t, x in enumerate([3, 5, 2]):   #@a1
            h = a[t] * h + b * x      #@a1
        # 3, then 7.7, then 2.77      #@a1
        tokens = 8000                 #@p2
        2 * tokens * d / state_size   # 500  #@a2
      `,
      beats: [
        { id: 'p1', say: 'Try one: b is one, from zero. Inputs three, five, two; decays {0.5|zero point five}, {0.9|zero point nine}, {0.1|zero point one}. What is {h₃|h three}?', code: 'p1' },
        { id: 'a1', say: 'Three: {a₁|a one} has nothing to fade. Then {2.7|two point seven} plus five, {7.7|seven point seven}. Then {0.77|zero point seven seven} plus two: {2.77|two point seven seven}.', code: 'a1' },
        { id: 'p2', say: 'Now both models at eight thousand tokens. How many times the state\'s memory does the cache take?', code: 'p2' },
        { id: 'a2', say: 'Per layer, the cache holds two times eight thousand times four thousand numbers; the state, {128,000|a hundred and twenty eight thousand}. Divide: five hundred.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

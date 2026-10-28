import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-selective-ssm',
  title: 'Selective state spaces',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Gu & Dao', year: 2023, title: 'Mamba: Linear-Time Sequence Modeling with Selective State Spaces', url: 'https://arxiv.org/abs/2312.00752', scene: 'step' },
  ],
  scenes: [
    {
      id: 'same',
      title: 'One fade for every token',
      codeTitle: 'fixed.py',
      code: `
        h = a * h + b * x   # every token   #@rec
        a = 0.6   # fixed: the same for all  #@a
        a ** np.arange(4, -1, -1)            #@w
        # 0.13 0.22 0.36 0.6 1: by age       #@w
        # want: words keep, '.' forgets      #@want
      `,
      beats: [
        { id: 'recall', say: 'A linear recurrence keeps all it knows about the past in its state, h. At every token, it multiplies h by the decay, a, then adds the new input, times b.', code: 'rec' },
        { id: 'name', say: 'A model like this, with an input, a state carrying the past, and an output read from it, is called a state space model. The state is its whole memory; the state space, every value it can take.', code: 'rec' },
        { id: 'fixed', say: 'Here a is fixed at {0.6|zero point six} for every token, so each word\'s weight in the state is a to the power of its age: the older, the fainter, whatever the word.', code: ['a', 'w'] },
        { id: 'want', say: 'But once a full stop ends a sentence, its words could go, while the next sentence\'s words should hold. That needs a decay set by each token, as an LSTM\'s forget gate is set by each input.', code: 'want' },
      ],
    },
    {
      id: 'step',
      title: 'A step size per token',
      codeTitle: 'step.py',
      code: `
        # the state drains as time passes    #@drain
        np.exp(-1)   # one unit: 0.37 left   #@one
        a = np.exp(-dt)   # a step of dt     #@a
        np.exp(-3)    # long: 0.05, forget   #@big
        np.exp(-0.1)  # short: 0.9, keep     #@small
        # dt > 0, so 0 < a < 1               #@range
        # dt: made from x by a learned layer #@dt
      `,
      beats: [
        { id: 'drain', say: 'Here is a way to set it. Picture the state draining away as time passes: after one unit of time, e to the minus one is left, about {0.37|zero point three seven}.', code: 'drain' },
        { id: 'delta', say: 'Now let each token say how much time passes while it is read: its step size, {Δ|delta}, the change in time.', code: 'a' },
        { id: 'a', say: 'Over a step of {Δ|delta}, the state shrinks to e to the minus {Δ|delta} of itself. That is the decay: {aₜ = e^(−Δₜ)|a t equals e to the minus delta t}.', code: 'a' },
        { id: 'big', say: 'A long step forgets: a step of three leaves e to the minus three, about {0.05|zero point zero five}, and the old state is nearly wiped.', code: 'big' },
        { id: 'small', say: 'A short step keeps: a step of {0.1|zero point one} leaves about {0.9|zero point nine}, and the state carries on.', code: 'small' },
        { id: 'range', say: '{Δ|delta} is always positive, so the decay lies between zero and one: it shrinks the state, but never grows it, and never quite wipes it.', code: 'range' },
        { id: 'select', say: 'And {Δ|delta} is made from the token itself, by a small learned layer. Each token picks its own step, so the model selects what to keep: a selective state space model.', code: 'dt' },
        { id: 'mamba', say: 'Albert Gu and {Tri Dao|Tree Dao} built this into their model, Mamba, in 2023. State space models had trailed attention on language, they found, since one decay for every token cannot pick out what to keep.', code: 'dt' },
      ],
    },
    {
      id: 'run',
      title: 'Keep, then forget',
      codeTitle: 'run.py',
      code: `
        x  = [4, 2, 6]                   #@x
        dt = [1, 0.1, 3]                 #@x
        a  = [0.37, 0.9, 0.05]  # e**-dt #@x
        b, h = 1, 0                      #@init
        for t in range(3):               #@loop
            h = a[t] * h + b * x[t]      #@loop
            # 4, then 5.6, then 6.28     #@vals
      `,
      beats: [
        { id: 'set', say: 'Run it on numbers: inputs four, two and six, with steps of one, {0.1|zero point one} and three: decays of {0.37|zero point three seven}, {0.9|zero point nine} and {0.05|zero point zero five}.', code: 'x' },
        { id: 'h1', say: 'With b at one, start the state at zero. Step one has nothing to fade, so {h₁|h one} is the input, four.', code: ['init', 'loop'] },
        { id: 'h2', say: 'Step two\'s own decay, {0.9|zero point nine}, fades the four it finds; add two, and {h₂|h two} is {5.6|five point six}.', code: 'vals' },
        { id: 'h3', say: 'Step three forgets: {0.05|zero point zero five} times {5.6|five point six} is about {0.28|zero point two eight}; add six, and {h₃|h three} is {6.28|six point two eight}, almost all new input.', code: 'vals' },
      ],
    },
    {
      id: 'memory',
      title: 'A state that never grows',
      codeTitle: 'memory.py',
      code: `
        layers, d, nbytes = 32, 4000, 2    #@model
        tokens = 4000                      #@cache
        2 * layers * tokens * d * nbytes   #@cache
        # 2 GB, and growing                #@cache
        state = 2 * d * 16   # 128,000     #@state
        layers * state * nbytes   # 8 MB   #@mb
        2 * tokens * d / state    # 250    #@ratio
      `,
      beats: [
        { id: 'cache', say: 'Now the memory. While generating, a transformer\'s KV cache grows with every token: at thirty two layers and d of four thousand, four thousand tokens take about two gigabytes.', code: ['model', 'cache'] },
        { id: 'state', say: 'A state space model keeps only its state, updated in place: a summary of the past, where the cache keeps every token whole.', code: 'state' },
        { id: 'shape', say: 'A Mamba layer runs twice d of these recurrences side by side, eight thousand here, each keeping, typically, sixteen numbers: {128,000|a hundred and twenty eight thousand} numbers per layer.', code: 'state' },
        { id: 'mb', say: 'Over thirty two layers, at two bytes each, that is about eight megabytes, at any length.', code: 'mb' },
        { id: 'ratio', say: 'Compare one layer of each. The cache holds a key and a value of four thousand numbers for each of four thousand tokens: thirty two million numbers.', code: 'ratio' },
        { id: 'times', say: 'That is two hundred and fifty times the state. Double the context, and the cache doubles; the state stays the same size.', code: 'ratio' },
        { id: 'fast', say: 'With no cache to hold, a GPU can serve many more sequences at once: Gu and Dao measured four to five times as many tokens per second as a transformer of similar size.', code: 'mb' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

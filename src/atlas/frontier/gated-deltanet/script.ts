import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-gated-deltanet',
  title: 'Gated DeltaNet',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Dao & Gu', year: 2024, title: 'Transformers are SSMs: generalized models and efficient algorithms through structured state space duality', url: 'https://arxiv.org/abs/2405.21060', scene: 'forget' },
    { who: 'Yang, Kautz & Hatamizadeh', year: 2024, title: 'Gated delta networks: improving Mamba2 with delta rule', url: 'https://arxiv.org/abs/2412.06464', scene: 'results' },
  ],
  scenes: [
    {
      id: 'forget',
      title: 'Two ways to forget',
      codeTitle: 'forget.py',
      code: `
        S = S + beta * np.outer(v - S @ k, k)  #@delta
        # new topic: every old pair is stale   #@stale
        S = a * S + np.outer(v, k)   # Mamba2  #@decay
        a = 0.5   # every value halves         #@all
      `,
      beats: [
        { id: 'one', say: 'The delta rule edits one key per token. That is precise, but when a text moves on to a new topic, every old pair goes stale, and the rule can only clear them one key at a time.', code: ['delta', 'stale'] },
        { id: 'decay', say: 'A selective state space model forgets the other way: each token multiplies the whole state by a decay, a, made from the token itself, so one token can fade the whole memory at once.', code: 'decay' },
        { id: 'mamba2', say: 'Its 2024 successor, Mamba2, by {Tri Dao|Tree Dao} and Albert Gu, can be written as linear attention with that decay: S becomes a times S, plus {v kᵀ|v k transpose}.', code: 'decay' },
        { id: 'blunt', say: 'But the decay is blunt: it fades every pair alike. With a at a half, both values halve. To forget one stale pair, it must fade them all.', code: 'all' },
      ],
    },
    {
      id: 'gate',
      title: 'Fade, then correct',
      codeTitle: 'gated.py',
      code: `
        S = alpha * S                   # fade   #@fade
        old = S @ k                     # read   #@read
        S = S + beta * np.outer(v - old, k)      #@write
        # alpha near 0: wiped; 1: delta rule     #@ends
      `,
      beats: [
        { id: 'both', say: 'Gated DeltaNet does both. Each token first fades the whole state by {α|alpha}, a number between zero and one, made from the token the way a selective state space model makes its decay.', code: 'fade' },
        { id: 'gate', say: '{α|alpha} is called a gate: like an LSTM\'s forget gate, it lets through a share of the memory, set by the input.', code: 'fade' },
        { id: 'delta', say: 'Then it applies the delta rule to the faded state: read what it now holds for the key, and write the difference, times {β|beta}.', code: ['read', 'write'] },
        { id: 'rule', say: 'Together: {S ← αS + β(v − αS k)kᵀ|S gets alpha S, plus beta, times v minus alpha S k, times k transpose}.', code: ['fade', 'read', 'write'] },
        { id: 'ends', say: 'At {α|alpha} near zero, the old memory is wiped, and the token starts it afresh. At {α|alpha} of one, nothing fades, and it is the delta rule again.', code: 'ends' },
      ],
    },
    {
      id: 'run',
      title: 'One step, in numbers',
      codeTitle: 'step.py',
      code: `
        S = [[2, 1], [3, 4]]   # k1: v1, k2: v2  #@S
        alpha, beta = 0.5, 1                     #@ab
        k, v = [1, 0], [4, 1]                    #@kv
        S = alpha * S   # [[1, 0.5], [1.5, 2]]   #@fade
        v - S @ k       # [3, -0.5]              #@diff
        S = S + beta * np.outer([3, -0.5], k)    #@write
        S @ [1, 0]      # [4, 1]: written        #@k1
        S @ [0, 1]      # [0.5, 2]: faded        #@k2
      `,
      beats: [
        { id: 'start', say: 'Run one step. Key one, zero reads two, three, and key zero, one reads one, four. A token arrives with {α|alpha} of a half, {β|beta} of one, key one, zero and value four, one.', code: ['S', 'ab', 'kv'] },
        { id: 'fade', say: 'First the fade: everything halves. Key one, zero now reads one, one and a half.', code: 'fade' },
        { id: 'diff', say: 'Its difference from the new value, four, one, is three, minus a half.', code: 'diff' },
        { id: 'write', say: 'Written along the key, it makes key one, zero read exactly four, one.', code: ['write', 'k1'] },
        { id: 'k2', say: 'Key zero, one was not written: it reads half of one, four, which is a half, two. The new pair is exact, and the rest has faded by {α|alpha}.', code: 'k2' },
      ],
    },
    {
      id: 'results',
      title: 'Better at both',
      codeTitle: 'results.py',
      code: `
        # 1.3B parameters, 100B tokens each       #@setup
        # needle: one key and value, then a query #@needle
        # repeating filler: delta keeps it        #@repeat
        # real essays: the gate clears clutter    #@essay
      `,
      beats: [
        { id: 'paper', say: 'Songlin Yang, Jan Kautz and Ali Hatamizadeh, at MIT and {NVIDIA|en vidia}, proposed this gated delta rule in 2024. They trained models of {1.3|one point three} billion parameters on a hundred billion tokens to compare.', code: 'setup' },
        { id: 'needle', say: 'One test hid a single fact, a key with its value, in a long text, and asked for it at the end: a needle in a haystack.', code: 'needle' },
        { id: 'repeat', say: 'In filler that repeats, the delta rule kept the needle at every length, while Mamba2\'s decay faded it past two thousand tokens.', code: 'repeat' },
        { id: 'essay', say: 'Hidden in real essays, where every sentence might matter, plain DeltaNet fell behind past a thousand tokens: with nothing cleared, its pairs collided. The gated models held up longer.', code: 'essay' },
        { id: 'best', say: 'Across language modelling, reasoning and recall, Gated DeltaNet beat both Mamba2 and DeltaNet, and trained about as fast as DeltaNet.', code: 'setup' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

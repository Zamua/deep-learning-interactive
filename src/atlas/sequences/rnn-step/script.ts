import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-rnn-step',
  title: 'The recurrence',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Elman', year: 1990, title: 'Finding structure in time', url: 'https://doi.org/10.1207/s15516709cog1402_1', scene: 'read' },
  ],
  scenes: [
    {
      id: 'read',
      title: 'Reading in order',
      codeTitle: 'read.py',
      code: `
        words = ['dog', 'chases', 'cat']   #@order
        # same words: cat chases dog       #@order
        x = np.concatenate(E[ids]) # slots #@slots
        # a fourth word: no slot left      #@fixed
        h = np.zeros(H)      # memory      #@h
        for x in xs:         # each token  #@loop
            h = ...          # from h, x   #@loop
      `,
      beats: [
        { id: 'order', say: 'Dog chases cat. Cat chases dog. The same three words, in another order, say something else. A network that reads text has to keep track of the order.', code: 'order' },
        { id: 'slots', say: 'One way is to give every position its own slot: lay the words\' embeddings side by side, in order, as one long input, and feed that to a two-layer network.', code: 'slots' },
        { id: 'fixed', say: 'But a network\'s input has a fixed size. It must be built for the longest sentence, so a word past the end has nowhere to go.', code: 'fixed' },
        { id: 'elman', say: 'In 1990, Jeffrey Elman\'s paper, Finding Structure in Time, argued against laying time out in space like this. The network, he wrote, must be given memory.', code: 'h' },
        { id: 'copy', say: 'So read one token at a time. After each step, the hidden units\' values are copied, and fed back in alongside the next token. Elman called these copies context units.', code: 'loop' },
        { id: 'chain', say: 'Draw the steps in a row, and the memory passes along it: the hidden state, h. It starts as all zeros, and after each token it holds a summary of everything read so far.', code: ['h', 'loop'] },
        { id: 'name', say: 'The same step comes round again at every token, with its output fed back in as input. That is why this is called a recurrent network.', code: 'loop' },
      ],
    },
    {
      id: 'step',
      title: 'Inside one step',
      codeTitle: 'rnn_step.py',
      code: `
        h = np.array([0.5, -0.5])  # memory #@h
        x = np.array([0.0, 1.0])   # token  #@x
        Whh @ h        # [0.5, -1.0]        #@mem
        Wxh @ x        # [2.0, 1.0]         #@inp
        b = np.array([-1.5, -0.5])          #@b
        z = Whh @ h + Wxh @ x + b           #@z
        z              # [1.0, -0.5]        #@z
        h = np.tanh(z) # [0.76, -0.46]      #@tanh
      `,
      beats: [
        { id: 't', say: 'Zoom in on one step. Number the tokens with t, so this is step t. The memory it starts from is {hₜ₋₁|h of t minus one}: the hidden state after the token before.', code: 'h' },
        { id: 'x', say: 'Its new input is {xₜ|x of t}, the embedding of token t.', code: 'x' },
        { id: 'Whh', say: 'A matrix of weights, {W_hh|W h h}, mixes the old memory. Its two h\'s say what it connects: hidden to hidden.', code: 'mem' },
        { id: 'mem', say: 'Here it turns the memory, {0.5|zero point five} and minus {0.5|zero point five}, into {0.5|zero point five} and minus one.', code: 'mem' },
        { id: 'Wxh', say: 'A second matrix, {W_xh|W x h}, input to hidden, brings in the token. It turns zero and one into two and one.', code: 'inp' },
        { id: 'b', say: 'Add the two results, plus a bias, b: minus {1.5|one point five} and minus {0.5|zero point five}.', code: 'b' },
        { id: 'z', say: 'The total is z, the pre-activation, as in a neuron: one, and minus {0.5|zero point five}.', code: 'z' },
        { id: 'tanh', say: 'Then tanh squashes each entry into the range between minus one and one: {0.76|zero point seven six}, and minus {0.46|zero point four six}. That is the new memory, {hₜ|h of t}.', code: 'tanh' },
        { id: 'why', say: 'Why squash? The memory goes back through {W_hh|W h h} at every step. Here that doubles its second entry each time, so without a squash, that entry could keep on growing. Tanh keeps every entry between minus one and one.', code: 'tanh' },
        { id: 'line', say: 'All of it in one line: {hₜ = tanh(W_hh hₜ₋₁ + W_xh xₜ + b)|h of t is the tanh of W h h times h of t minus one, plus W x h times x of t, plus b}.', code: ['z', 'tanh'] },
      ],
    },
    {
      id: 'loop',
      title: 'The same weights at every step',
      codeTitle: 'rnn.py',
      code: `
        h = np.zeros(H)   # h_0: zeros        #@h0
        for x in xs:      # once per token    #@loop
            h = np.tanh(Whh @ h + Wxh @ x + b)   #@loop
        # dog chases cat: h = [0.07, -0.74]   #@order
        # cat chases dog: h = [-0.07, 0.74]   #@order
        # Whh: (H, H)                         #@H
        # Wxh: (H, D)                         #@D
        # b: (H,)                             #@bias
      `,
      beats: [
        { id: 'loop', say: 'To read a whole sentence, run the step in a loop, once per token, each step starting from the memory the last one left.', code: 'loop' },
        { id: 'first', say: 'The first step starts from {h₀|h zero}, all zeros, so {W_hh|W h h} times it is zero: only the first token counts.', code: 'h0' },
        { id: 'same', say: 'Every step uses the same {W_hh|W h h}, the same {W_xh|W x h}, and the same b. Nothing is added per token, so one network reads three words or three hundred.', code: 'loop' },
        { id: 'order', say: 'And order now counts. Run dog chases cat, and cat chases dog, through these same weights, and they end with different memories.', code: 'order' },
        { id: 'H', say: 'Say the memory has {H|capital H} numbers, one per hidden unit. {W_hh|W h h} turns H numbers into H, so it is H by H.', code: 'H' },
        { id: 'D', say: '{W_xh|W x h} turns a token\'s D numbers, the size of its embedding, into H, so it is H by D.', code: 'D' },
        { id: 'bias', say: 'And b adds one number to each hidden unit\'s total: H of them, as many as the memory has.', code: 'bias' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

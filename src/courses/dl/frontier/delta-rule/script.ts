import type { LectureScript } from '../../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-delta-rule',
  title: 'The delta rule',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Schlag, Irie & Schmidhuber', year: 2021, title: 'Linear transformers are secretly fast weight programmers', url: 'https://arxiv.org/abs/2102.11174', scene: 'pile' },
    { who: 'Widrow & Hoff', year: 1960, title: 'Adaptive switching circuits', url: 'https://isl.stanford.edu/~widrow/papers/c1960adaptiveswitching.pdf', scene: 'learn' },
    { who: 'Yang, Wang, Zhang, Shen & Kim', year: 2024, title: 'Parallelizing linear transformers with the delta rule over sequence length', url: 'https://arxiv.org/abs/2406.06484', scene: 'learn' },
  ],
  scenes: [
    {
      id: 'pile',
      title: 'Memories pile up',
      codeTitle: 'pile.py',
      code: `
        S = [[2, 1], [3, 4]]  # k1: v1, k2: v2  #@S
        S += np.outer([4, 1], [1, 0])  # k1     #@add
        S @ [1, 0]     # [6, 4]: old + new      #@read
        S @ [0.6, 0.8]   # [2, 5]: a mix        #@blend
        # 2 numbers a key: 2 at right angles    #@cap
      `,
      beats: [
        { id: 'memory', say: 'Linear attention\'s state is a memory from keys to values. Here key one, zero holds the value two, three, and key zero, one holds one, four.', code: 'S' },
        { id: 'again', say: 'Now the first key comes back with a new value, four, one, as when a text changes a fact it gave before. Linear attention just adds another table.', code: 'add' },
        { id: 'pile', say: 'Read that key now, and out comes six, four: the old value plus the new one, piled up. Nothing is ever overwritten.', code: 'read' },
        { id: 'angle', say: 'And only keys at a right angle stay apart. A key between them, {0.6|zero point six}, {0.8|zero point eight}, reads back a mix of both values.', code: 'blend' },
        { id: 'cap', say: 'Keys of two numbers have room for only two directions at right angles. Store more pairs than a key has numbers, and the reads start to blend.', code: 'cap' },
        { id: 'schlag', say: 'In 2021, Imanol Schlag, Kazuki Irie and {Jürgen Schmidhuber|Yoorgen Schmidhoober} pointed out both limits of linear attention, and a fix: before writing, read what the memory already holds.', code: ['read', 'cap'] },
      ],
    },
    {
      id: 'delta',
      title: 'Write only the difference',
      codeTitle: 'delta.py',
      code: `
        k, v = [1, 0], [4, 1]            #@kv
        old = S @ k        # [2, 3]      #@old
        delta = v - old    # [2, -2]     #@delta
        S = S + np.outer(delta, k)       #@write
        S @ k              # [4, 1]      #@check
        S @ [0, 1]         # [1, 4]      #@other
      `,
      beats: [
        { id: 'old', say: 'First, read what the memory holds for this key: S times k, here two, three. That is the old value.', code: ['kv', 'old'] },
        { id: 'delta', say: 'Then take the difference between the new value and the old: four, one, minus two, three, is two, minus two. It is called the delta, after the Greek letter for a change.', code: 'delta' },
        { id: 'write', say: 'Write only that difference, as a table with the key: add the outer product of the delta and k.', code: 'write' },
        { id: 'check', say: 'Read again: the old two, three, plus the delta, gives four, one. The new value replaces the old, instead of piling onto it.', code: 'check' },
        { id: 'rule', say: 'That is the delta rule: {S ← S + (v − S k) kᵀ|S gets S, plus v minus S k, times k transpose}.', code: ['old', 'delta', 'write'] },
        { id: 'unit', say: 'The read moves by the delta times k dot k, so the value is replaced exactly when the key has length one. Today\'s models built on the rule scale every key to length one.', code: 'check' },
        { id: 'other', say: 'A key at a right angle to k is left alone, since its dot product with k is zero: key zero, one still reads one, four.', code: 'other' },
      ],
    },
    {
      id: 'beta',
      title: 'How firmly to write',
      codeTitle: 'beta.py',
      code: `
        beta = sigmoid(w @ x)   # 0 to 1       #@made
        S = S + beta * np.outer(v - S @ k, k)  #@rule
        # beta = 1:   reads [4, 1], replaced   #@one
        # beta = 0.5: reads [3, 2], halfway    #@half
        # beta = 0:   reads [2, 3], kept       #@zero
      `,
      beats: [
        { id: 'beta', say: 'One more piece: a write strength, {β|beta}, a number from zero to one that scales the difference before it is written.', code: 'rule' },
        { id: 'one', say: 'At one, the new value replaces the old: the key reads four, one.', code: 'one' },
        { id: 'half', say: 'At a half, the read moves halfway, to three, two: a blend of old and new.', code: 'half' },
        { id: 'zero', say: 'At zero, nothing is written, and the key still reads two, three.', code: 'zero' },
        { id: 'made', say: 'The model makes {β|beta} from each token, with learned weights and a sigmoid, so each token decides how firmly it is written.', code: 'made' },
      ],
    },
    {
      id: 'learn',
      title: 'Learning while reading',
      codeTitle: 'learn.py',
      code: `
        error = S @ k - v                  #@err
        loss = 0.5 * error @ error         #@loss
        # slope for S[i, j]: error[i] * k[j] #@grad
        S = S - beta * np.outer(error, k)  #@step
        # Wq, Wk, Wv: slow, set in training #@slow
        # S: fast, rewritten every token   #@fast
      `,
      beats: [
        { id: 'error', say: 'There is another way to see the rule. S times k is the memory\'s guess at v, and the guess minus v is its error.', code: 'err' },
        { id: 'loss', say: 'Square the error\'s length and halve it, for a loss. Then take one step of gradient descent on it, with {β|beta} as the step size.', code: ['loss', 'step'] },
        { id: 'grad', say: 'The loss\'s slope for the entry in row i, column j of S is the error\'s entry i, times k\'s entry j: the outer product. So the step adds minus {β|beta}, times the error, times {kᵀ|k transpose}: exactly the delta rule.', code: ['grad', 'step'] },
        { id: 'widrow', say: 'The rule is old. In 1960, Bernard Widrow and Marcian Hoff trained adaptive circuits with it: nudge the weights by the error times the input, one example at a time.', code: 'step' },
        { id: 'fast', say: 'So S is a set of weights that keeps learning while the model reads: fast weights, rewritten at every token, where the weights that make keys and values are slow, set in training. Hence Schlag\'s title: Linear Transformers Are Secretly Fast Weight Programmers.', code: ['slow', 'fast'] },
        { id: 'deltanet', say: 'They called the model a Delta Network. In 2024, Songlin Yang and colleagues found how to train DeltaNet in parallel over a whole text, and at {1.3|one point three} billion parameters it beat other recurrent models of its size at predicting text.', code: 'step' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-multi-head',
  title: 'Multi-head attention',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'split',
      title: 'Several smaller attentions',
      codeTitle: 'heads.py',
      code: `
        d, n_heads = 512, 8                              #@dims
        d_head = d // n_heads       # 64                 #@width
        heads = []
        for i in range(n_heads):                         #@loop
            Q = np.stack([Wq[i] @ x for x in X])  # (T, 64)   #@shapes
            K = np.stack([Wk[i] @ x for x in X])  # (T, 64)   #@shapes
            V = np.stack([Wv[i] @ x for x in X])  # (T, 64)   #@shapes
            A = softmax(Q @ K.T / np.sqrt(d_head))  # (T, T)  #@shapes
            heads.append(A @ V)                   # (T, 64)   #@loop
      `,
      beats: [
        { id: 'one', say: 'A single attention gives each token one blend of the others. But a word may need several things at once: say, the noun it describes, and the word just before it.', code: 'dims' },
        { id: 'heads', say: 'Multi-head attention runs several attentions side by side. Each is a head, with its own query, key and value matrices, so each can look somewhere different.', code: 'loop' },
        { id: 'width', say: 'The heads share the width. Write {h|h} for the number of heads: with d of {512|five hundred twelve} and h of eight, each head works in {d / h|d over h} dimensions, {64|sixty four}. That is one head\'s width, {d_head|d head}.', code: ['dims', 'width'] },
        { id: 'shapes', say: 'So one head\'s {Wq|W Q} is {64 by 512|sixty four by five hundred twelve}, its queries are T by {64|sixty four}, and its weights are T by T, as before.', code: 'shapes' },
      ],
    },
    {
      id: 'join',
      title: 'Join, then mix',
      codeTitle: 'heads.py',
      code: `
        cat = np.concatenate(heads, axis=1)  # (T, 512)    #@cat
        out = np.stack([Wo @ c for c in cat])  # Wo: (512, 512)  #@wo
        # Wq, Wk, Wv: 8 x (64, 512) each = 512 x 512        #@count
        # total: 4 * 512**2 = 1,048,576                      #@count
      `,
      beats: [
        { id: 'concat', say: 'Each head outputs T by {64|sixty four}. Joined side by side, the eight make T by {512|five hundred twelve} again.', code: 'cat' },
        { id: 'wo', say: 'One more matrix, {Wo|W O}, d by d, mixes what the heads found into one output per token.', code: 'wo' },
        { id: 'count', say: 'Now count the weights. Eight heads\' {Wq|W Q}s of {64 by 512|sixty four by five hundred twelve} hold as many as one d by d matrix. The same goes for {Wk|W K} and {Wv|W V}, and {Wo|W O} adds a fourth: {4d²|four d squared}.', code: 'count' },
        { id: 'same', say: 'That is exactly what a single head of full width would hold. Splitting into heads changes what attention can look for, not how many weights it has.', code: 'count' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

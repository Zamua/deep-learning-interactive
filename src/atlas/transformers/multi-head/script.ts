import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-multi-head',
  title: 'Multi-head attention',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Vaswani, Shazeer, Parmar, Uszkoreit, Jones, Gomez, Kaiser & Polosukhin', year: 2017, title: 'Attention Is All You Need', url: 'https://arxiv.org/abs/1706.03762', scene: 'blend' },
  ],
  scenes: [
    {
      id: 'blend',
      title: 'One blend is not enough',
      codeTitle: 'blend.py',
      code: `
        A[1]   # like: [0.45, 0.1, 0.45]  #@one
        A[1] @ V   # one blend of all 3   #@blur
        # like needs: who likes? what?    #@two
        A0[1]  # head 0: [0.9, 0.05, 0.05] #@heads
        A1[1]  # head 1: [0.05, 0.05, 0.9] #@heads
        # each head: its own Wq, Wk, Wv   #@name
      `,
      beats: [
        { id: 'one', say: 'Self-attention gives each token one row of weights, and so one blend of the values. In cats like fish, the word like splits its row between cats and fish.', code: 'one' },
        { id: 'two', say: 'But the word like needs two separate answers: who does the liking, cats, and what is liked, fish.', code: 'two' },
        { id: 'blur', say: 'With one row of weights, it can only split between them, and its output smears the two values into a single blend. Neither comes through whole.', code: 'blur' },
        { id: 'heads', say: 'So run two attentions side by side, each with its own query, key and value matrices. One can learn to look for who likes, the other for what is liked, and each finds its word sharply.', code: 'heads' },
        { id: 'name', say: 'Each one is called a head: a separate attention, reading the same tokens. Together they make multi-head attention.', code: 'name' },
        { id: 'vaswani', say: 'Ashish Vaswani and colleagues introduced it in 2017, in Attention Is All You Need. With a single attention head, they wrote, averaging gets in the way.', code: 'name' },
        { id: 'found', say: 'And the heads of their trained model did take on different jobs. Two of them, looking out from the word its, seemed to find what that word referred to.', code: 'heads' },
      ],
    },
    {
      id: 'split',
      title: 'Share the width',
      codeTitle: 'heads.py',
      code: `
        d, n_heads = 512, 8               #@dims
        d_head = d // n_heads   # 64      #@width
        # Wq[i], Wk[i], Wv[i]: (64, 512)  #@W
        for i in range(n_heads):          #@loop
            Q = X @ Wq[i].T   # (T, 64)   #@Q
            K = X @ Wk[i].T   # (T, 64)   #@Q
            V = X @ Wv[i].T   # (T, 64)   #@Q
            e = Q @ K.T / 8   # /√64      #@A
            A = softmax(e)    # (T, T)    #@A
            heads.append(A @ V)  # (T, 64) #@loop
      `,
      beats: [
        { id: 'h', say: 'How wide is each head? Write h for the number of heads. Vaswani\'s model had eight, over tokens of {512|five hundred and twelve} numbers each.', code: 'dims' },
        { id: 'dhead', say: 'The heads share that width. Each makes queries, keys and values of d over h numbers: {64|sixty four} here. That is one head\'s width, {d_head|d head}.', code: 'width' },
        { id: 'dk', say: 'It is why the queries in Vaswani\'s model had {64|sixty four} entries: each belongs to one head.', code: 'width' },
        { id: 'wq', say: 'Each head still reads the whole token, all {512|five hundred and twelve} numbers. So one head\'s {Wq|W Q} is {64 by 512|sixty four by five hundred and twelve}: a row per query entry.', code: 'W' },
        { id: 'qkv', say: 'Its queries, keys and values come out T by {64|sixty four}: one row per token, as before.', code: 'Q' },
        { id: 'A', say: 'And its weights are T by T, whatever its width: every token still scores every token.', code: 'A' },
      ],
    },
    {
      id: 'join',
      title: 'Join, then mix',
      codeTitle: 'join.py',
      code: `
        cat = np.concatenate(heads, axis=1) #@cat
        # (T, 8 * 64) = (T, 512)          #@cat
        out = cat @ Wo.T    # (T, 512)    #@wo
        # 8 Wq[i]s, (64, 512) each:       #@stack
        #   one (512, 512) square         #@stack
        # Wq, Wk, Wv, Wo: 4 * 512**2      #@four
        #   = 1,048,576, any n_heads      #@same
      `,
      beats: [
        { id: 'concat', say: 'Each head outputs T by {64|sixty four}. Set the eight side by side, and they make T by {512|five hundred and twelve}: the full width again.', code: 'cat' },
        { id: 'keep', say: 'Side by side, not added up: each head keeps its own columns, so what it found stays apart from the rest.', code: 'cat' },
        { id: 'wo', say: 'One more matrix, {Wo|W O}, the output weights, d by d, mixes what the heads found into one vector per token.', code: 'wo' },
        { id: 'stack', say: 'Now count the weights. Stack the eight heads\' {Wq|W Q} matrices, each {64 by 512|sixty four by five hundred and twelve}, and they fill exactly one d by d square.', code: 'stack' },
        { id: 'four', say: '{Wk|W K} and {Wv|W V} fill a square each as well, and {Wo|W O} is a fourth: {4d²|four d squared} weights in all, just over a million here.', code: 'four' },
        { id: 'same', say: 'That is exactly what one head of the full width would hold. Splitting into heads changes what attention can look for, not how many weights it has.', code: 'same' },
        { id: 'tried', say: 'Vaswani\'s team tried other head counts, with the same amount of computation. One head translated worse, and so did too many.', code: 'same' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-induction-heads',
  title: 'Induction heads',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Elhage, Nanda, Olsson et al.', year: 2021, title: 'A Mathematical Framework for Transformer Circuits', url: 'https://transformer-circuits.pub/2021/framework/index.html', scene: 'rule' },
    { who: 'Olsson, Elhage, Nanda et al.', year: 2022, title: 'In-context learning and induction heads', url: 'https://arxiv.org/abs/2209.11895', scene: 'match' },
  ],
  scenes: [
    {
      id: 'rule',
      title: 'Seen K D, now K',
      codeTitle: 'induction.py',
      code: `
        seq = ['K', 'D', 'R', 'A', 'M', 'K']  #@seq
        i = seq.index(seq[-1])  # 0: first K  #@find
        guess = seq[i + 1]      # 'D'         #@copy
      `,
      beats: [
        { id: 'seq', say: 'A model reads the letters K, D, R, A, M, and then K again. What comes next?', code: 'seq' },
        { id: 'guess', say: 'The letters are random, so no rule of English helps. But the text itself does: the last time K appeared, D came right after it. So guess D.', code: ['find', 'copy'] },
        { id: 'repeat', say: 'Real text repeats like this all the time. A story names Nora Quill, and the next time Nora comes up, Quill is the best guess, though nothing but the text says so.', code: 'copy' },
        { id: 'induction', say: 'Guessing a rule from examples is called induction: K was followed by D before, so expect D after K again. Induction heads are named for it.', code: 'copy' },
        { id: 'history', say: 'In 2021, Nelson Elhage, Chris Olah and colleagues, in the paper that named the residual stream, found small transformers doing this with two attention heads in different blocks, or layers.', code: ['find', 'copy'] },
        { id: 'two', say: 'It only ever appeared in models with at least two layers. Why does it take two?', code: ['find', 'copy'] },
      ],
    },
    {
      id: 'prev',
      title: 'Step one: a previous-token head',
      codeTitle: 'heads.py',
      code: `
        # a key reads only its own stream   #@need
        # lower layer, previous-token head: #@back
        prev = [None] + seq[:-1]            #@back
        # prev: -, K, D, R, A, M            #@write
        # prev[1] == 'K': D came after K    #@write
      `,
      beats: [
        { id: 'need', say: 'To predict D, a head at the second K must find the D. Its query can only match keys, and each key is made from its own position\'s stream.', code: 'need' },
        { id: 'blind', say: 'At first, the D\'s stream holds only D. Nothing in it says that a K came just before.', code: 'need' },
        { id: 'back', say: 'So in a lower layer, a previous-token head attends one position back, at every position.', code: 'back' },
        { id: 'write', say: 'It writes what it finds into the stream. Now position one, the D, carries a note: my previous token was K.', code: 'write' },
        { id: 'order', say: 'Writes stay, so every layer above can read the note. The same layer cannot: its heads all read the stream before any of them writes.', code: 'write' },
      ],
    },
    {
      id: 'match',
      title: 'Step two: match and copy',
      codeTitle: 'heads.py',
      code: `
        # upper layer, at the second K:     #@q
        want = seq[-1]  # query: prev = K?  #@q
        j = prev.index(want)  # 1: the D    #@hit
        out = seq[j]          # copy 'D'    #@copy
        # D's next-token score goes up      #@score
      `,
      beats: [
        { id: 'query', say: 'In a higher layer, at the second K, the induction head\'s query asks for a key that says: my previous token was K.', code: 'q' },
        { id: 'hit', say: 'Only position one\'s key says that, so the head attends there, to the D. The causal mask allows it: the D is in the past.', code: 'hit' },
        { id: 'copy', say: 'Its value carries D, so the head copies D into the second K\'s stream.', code: 'copy' },
        { id: 'score', say: 'So when the model scores the next token, D\'s score goes up: seen K D, now K, predict D.', code: 'score' },
        { id: 'pair', say: 'Neither head does this alone. Together, they continue any pattern the text has already shown, whatever the letters are.', code: ['hit', 'copy'] },
        { id: 'olsson', say: 'In 2022, Catherine Olsson and colleagues saw induction heads form suddenly, early in training, in models of every size they studied, as long as the model had more than one layer.', code: ['q', 'copy'] },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

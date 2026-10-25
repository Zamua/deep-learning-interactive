import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-induction-heads',
  title: 'Induction heads',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'rule',
      title: 'Seen K D, now K',
      codeTitle: 'induction.py',
      code: `
        seq = ['K', 'D', 'R', 'A', 'M', 'K']   #@seq
        i = seq.index(seq[-1])   # 0: the earlier K   #@find
        guess = seq[i + 1]       # 'D'                #@copy
      `,
      beats: [
        { id: 'seq', say: 'A model reads the letters K, D, R, A, M, and then K again. What comes next?', code: 'seq' },
        { id: 'guess', say: 'Text repeats, so a good guess is D: the last time K appeared, D came right after it. Seen K D before, now K: predict D.', code: ['find', 'copy'] },
        { id: 'two', say: 'Trained models learn this rule with two attention heads working one after the other. The second is called an induction head.' },
      ],
    },
    {
      id: 'prev',
      title: 'Step one: a previous-token head',
      codeTitle: 'heads.py',
      code: `
        # earlier layer: attend one position back      #@back
        # write it: position 1 now says "after K"      #@write
      `,
      beats: [
        { id: 'back', say: 'In an earlier layer, a previous-token head attends one position back, at every position.', code: 'back' },
        { id: 'write', say: 'It writes what it finds into the stream. So position one, the D, now carries a note: my previous token was K.', code: 'write' },
      ],
    },
    {
      id: 'match',
      title: 'Step two: match and copy',
      codeTitle: 'heads.py',
      code: `
        # later layer, at the second K:                #@q
        #   query: "a position whose previous was K"  #@q
        #   key match at position 1, the D             #@hit
        #   copy D: raise its score as the next token  #@copy
      `,
      beats: [
        { id: 'query', say: 'In a later layer, at the second K, the induction head\'s query looks for a key that says: my previous token was K.', code: 'q' },
        { id: 'hit', say: 'Only position one matches, so the head attends there, to the D. The causal mask allows it: the D is in the past.', code: 'hit' },
        { id: 'copy', say: 'It copies D into the current stream, raising the score of D as the next token. Neither head helps alone, but together they continue any pattern the text has already shown.', code: 'copy' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

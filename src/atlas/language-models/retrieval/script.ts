import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-retrieval',
  title: 'Retrieval',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'stale',
      title: 'What the weights hold',
      codeTitle: 'ask.py',
      code: `
        question = "When does the library open on Sundays?"   #@ask
        complete(question)  # ' At 10 am.' (old)   #@old
        passages = [...]    # its current pages    #@docs
      `,
      beats: [
        { id: 'ask', say: 'A model knows what it read in training. Ask about something that has changed since, like the library\'s Sunday hours, and it answers from that old text.', code: ['ask', 'old'] },
        { id: 'context', say: 'In-context learning showed a fix: put the facts in the prompt. The model reads them there, and no weight changes.', code: 'old' },
        { id: 'which', say: 'But the library\'s pages may hold thousands of passages, far too many for one prompt. Retrieval picks the few that match the question.', code: 'docs' },
      ],
    },
    {
      id: 'score',
      title: 'Score every passage',
      codeTitle: 'retrieve.py',
      code: `
        qv = embed(question)     # [0.6, 0.8]   #@embed
        pvs = [embed(t) for t in passages]       #@embed
        # size 1: 0.6² + 0.8² = 1                #@size
        sims = [qv @ pv for pv in pvs]           #@score
        # [0.96, 0.6, 0.0]                       #@score
        top = np.argsort(sims)[::-1][:2]  # [0, 1]   #@top
      `,
      beats: [
        { id: 'embed', say: 'An embedding model turns any text into a vector, so that texts about the same thing point the same way. Embed the question, and every passage once, ahead of time.', code: 'embed' },
        { id: 'size', say: 'Each vector is scaled to size one: its squared entries add up to one. Then a dot product sees only direction: one when two vectors point the same way, zero at a right angle. It is called cosine similarity.', code: 'size' },
        { id: 'score', say: 'The question is {0.6|zero point six}, {0.8|zero point eight}. Passage zero, {0.8|zero point eight}, {0.6|zero point six}, scores {0.48|zero point four eight} plus {0.48|zero point four eight}: {0.96|zero point nine six}.', code: 'score' },
        { id: 'rest', say: 'Passage one, one and zero, scores {0.6|zero point six}. Passage two, at a right angle, scores zero.', code: 'score' },
        { id: 'top', say: 'Keep the top k. With k of two, that is passages zero and one.', code: 'top' },
      ],
    },
    {
      id: 'prompt',
      title: 'Into the prompt',
      codeTitle: 'answer.py',
      code: `
        picked = [passages[i] for i in top]       #@build
        prompt = "\\n".join(picked)                #@build
        prompt += "\\nQ: " + question + "\\nA:"    #@build
        complete(prompt)        # ' At noon.'     #@answer
        # hours change: embed the new page        #@update
        # 2 x 200 tokens + 10 = 410 tokens        #@cost
      `,
      beats: [
        { id: 'build', say: 'Put the top passages into the prompt, before the question.', code: 'build' },
        { id: 'answer', say: 'The model reads the current hours in its context and answers from them: noon. Its weights never changed.', code: 'answer' },
        { id: 'update', say: 'When the hours change again, embed the new page and swap it into the collection. No model is retrained.', code: 'update' },
        { id: 'cost', say: 'The passages do take room in the context: two of {200|two hundred} tokens before a question of ten make {410|four hundred ten} tokens.', code: 'cost' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

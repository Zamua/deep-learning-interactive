import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-retrieval',
  title: 'Retrieval',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Lewis et al.', year: 2020, title: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks', url: 'https://arxiv.org/abs/2005.11401', scene: 'prompt' },
  ],
  scenes: [
    {
      id: 'stale',
      title: 'What the weights hold',
      codeTitle: 'ask.py',
      code: `
        question = "Sunday hours?"     #@ask
        complete(question)  # 10 am    #@old
        complete(page + question)      #@ctx
        # ' At noon.'                  #@ctx
        passages = [...]  # thousands  #@docs
      `,
      beats: [
        { id: 'ask', say: 'A language model knows what was in the text it trained on, stored in its weights. Ask about something that has changed since, like the library\'s Sunday hours, and it answers from that old text.', code: ['ask', 'old'] },
        { id: 'context', say: 'Training it again is one fix. In-context learning showed a cheaper one: put the facts in the prompt, the text the model is given to continue. It reads them in its context, and no weight changes.', code: 'ctx' },
        { id: 'which', say: 'But the library\'s site may hold thousands of passages, short pieces of its pages, far more than the context has room for. Retrieval fetches the few that match the question.', code: 'docs' },
      ],
    },
    {
      id: 'arrows',
      title: 'Texts as arrows',
      codeTitle: 'embed.py',
      code: `
        qv = embed(question)  # [0.6, 0.8]  #@embed
        pvs = [embed(p) for p in passages]  #@ahead
        qv @ pvs[0]   # how much they agree  #@dot
        # twice as long: twice the score    #@long
        # embed scales each to length 1     #@unit
        # 0.6² + 0.8² = 1                   #@size
        # length 1: qv @ pv = cos(angle)    #@cos
      `,
      beats: [
        { id: 'embed', say: 'To find the ones that match, turn each text into a vector. Token embeddings put alike words close together; an embedding model does the same for whole texts, so that texts about the same thing point the same way.', code: 'embed' },
        { id: 'ahead', say: 'Embed every passage once, ahead of time, and the question when it comes.', code: 'ahead' },
        { id: 'dot', say: 'Then score each passage by its dot product with the question: how much the two arrows agree.', code: 'dot' },
        { id: 'long', say: 'But a dot product also grows with length. Make passage one\'s arrow twice as long, and its score doubles, though it points no closer to the question.', code: 'long' },
        { id: 'unit', say: 'So every embedding is scaled to length one, onto this circle, keeping its direction. Then only the direction counts.', code: 'unit' },
        { id: 'size', say: 'Length one means the squared entries add up to one, as Pythagoras says of a right triangle. The question goes {0.6|zero point six} across and {0.8|zero point eight} up: {0.36|zero point three six} plus {0.64|zero point six four} is one.', code: 'size' },
        { id: 'cos', say: 'For arrows of length one, the dot product is the cosine of the angle between them, from school trigonometry: one when they point the same way, and zero at a right angle. So this score is called cosine similarity.', code: 'cos' },
      ],
    },
    {
      id: 'score',
      title: 'Score every passage',
      codeTitle: 'retrieve.py',
      code: `
        sims = [qv @ pv for pv in pvs]     #@score
        # [0.96, 0.6, 0.0]                 #@rest
        top = np.argsort(sims)[::-1][:k]   #@top
        # k = 2: top is [0, 1]             #@top
      `,
      beats: [
        { id: 'p0', say: 'Passage zero, about the Sunday hours, points close to the question: {0.8|zero point eight} across, {0.6|zero point six} up.', code: 'score' },
        { id: 'score', say: 'Its score is {0.6|zero point six} times {0.8|zero point eight}, plus {0.8|zero point eight} times {0.6|zero point six}: {0.48|zero point four eight}, twice, which is {0.96|zero point nine six}.', code: 'score' },
        { id: 'rest', say: 'Passage one, about weekday hours, is one and zero, and scores {0.6|zero point six}. Passage two, about parking, is at a right angle: zero.', code: 'rest' },
        { id: 'top', say: 'Keep the highest k scores, where k is how many passages you want. With k of two, that is passages zero and one.', code: 'top' },
      ],
    },
    {
      id: 'prompt',
      title: 'Into the prompt',
      codeTitle: 'answer.py',
      code: `
        picked = [passages[i] for i in top]  #@build
        prompt = "\\n".join(picked)           #@build
        prompt += "\\nQ: " + question + "\\nA:"  #@build
        complete(prompt)      # ' At noon.'  #@answer
        # new hours: embed the new page      #@update
        # 2 x 200 + 10 = 410 tokens          #@cost
        # 1,024 - 10 = 1,014: 5 passages     #@fit
      `,
      beats: [
        { id: 'build', say: 'Put the top passages into the prompt, before the question.', code: 'build' },
        { id: 'answer', say: 'The model reads the current hours in its context and answers from them: noon. Its weights never changed.', code: 'answer' },
        { id: 'update', say: 'When the hours change again, embed the new page and swap it into the collection, in place of the old one. No model is retrained.', code: 'update' },
        { id: 'rag', say: 'In {2020|twenty twenty}, Patrick Lewis and colleagues called this retrieval-augmented generation: the model generates the answer, and retrieval augments, or adds to, what it reads.', code: 'build' },
        { id: 'swap', say: 'They tried this swap with Wikipedia, as it stood in {2016|twenty sixteen} and in {2018|twenty eighteen}. Asked about world leaders who changed in between, the same model mostly switched from the old names to the new.', code: 'update' },
        { id: 'cost', say: 'The passages do take room in the context: two passages of {200|two hundred} tokens, before a question of ten, make {410|four hundred and ten}. An instruction at the start would add its own.', code: 'cost' },
        { id: 'fit', say: 'And the context has a limit, so k does too. With room for {1,024|one thousand and twenty four} tokens, a question of ten leaves {1,014|one thousand and fourteen}: five passages of {200|two hundred} fit, and a sixth would spill over.', code: 'fit' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

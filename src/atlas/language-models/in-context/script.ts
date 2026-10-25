import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-in-context',
  title: 'In-context learning',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'prompt',
      title: 'Examples in the prompt',
      codeTitle: 'few_shot.py',
      code: `
        prompt = """English to French:   #@zero
        dog => chien                     #@few
        cow => vache                     #@few
        cheese =>"""                     #@zero
        complete(prompt)   # ' fromage'  #@answer
      `,
      beats: [
        { id: 'zero', say: 'A pretrained model continues whatever text it is given. So write a task as text: an instruction, English to French, then a new input, cheese, and an arrow.', code: 'zero' },
        { id: 'few', say: 'Better still, show it a few solved examples first: dog becomes chien, cow becomes vache.', code: 'few' },
        { id: 'answer', say: 'Now the likeliest continuation is fromage. The model picked up the task from examples in its context: in-context learning.', code: 'answer' },
        { id: 'shots', say: 'With no examples, the prompt is zero-shot. One example makes it one-shot, and several make it few-shot.', code: 'few' },
      ],
    },
    {
      id: 'frozen',
      title: 'Nothing is trained',
      codeTitle: 'few_shot.py',
      code: `
        before = weights.copy()                   #@frozen
        complete(prompt)                          #@frozen
        # weights == before, every entry          #@frozen
        # the examples: tokens to attend to      #@tokens
        5 + 2 * 4 + 3           # 16 tokens       #@cost
      `,
      beats: [
        { id: 'frozen', say: 'No gradient step happened. The model only ran forward, and every weight is exactly what it was before.', code: 'frozen' },
        { id: 'tokens', say: 'The examples are just tokens in the context. Attention reads them like any earlier tokens, and to predict what follows such a pattern, the model has to work out the task.', code: 'tokens' },
        { id: 'gone', say: 'So nothing is kept. Send a new prompt without the examples, and the model starts from the same weights, with no trace of them.', code: 'tokens' },
        { id: 'cost', say: 'They do cost room in the context. An instruction of five tokens, two examples of four, and an input of three make sixteen tokens to read before the answer.', code: 'cost' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

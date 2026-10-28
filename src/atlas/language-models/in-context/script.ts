import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-in-context',
  title: 'In-context learning',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Brown et al.', year: 2020, title: 'Language Models are Few-Shot Learners', url: 'https://arxiv.org/abs/2005.14165', scene: 'context' },
  ],
  scenes: [
    {
      id: 'teach',
      title: 'A new job for a trained model',
      codeTitle: 'few_shot.py',
      code: `
        model = load_pretrained()          #@pre
        # fine-tuning: a gradient step     #@tune
        # on each of 1000s of examples     #@tune
        prompt = """English to French:     #@prompt
        dog => chien                       #@few
        cow => vache                       #@few
        cheese =>"""                       #@prompt
        complete(prompt)   # ' fromage'    #@answer
      `,
      beats: [
        { id: 'pre', say: 'Start with a language model that has already been trained, on a huge amount of text, to predict the next token. That is a pretrained model: its training is done before anyone puts it to work.', code: 'pre' },
        { id: 'job', say: 'Now you want it for one particular job: turning English words into French. How do you teach it that?', code: 'pre' },
        { id: 'tune', say: 'The usual way was fine-tuning: train it some more on thousands of solved examples, with a gradient step on each. That changes the weights, and every new job needs a training run of its own.', code: 'tune' },
        { id: 'continue', say: 'But a language model already does one thing well: it continues whatever text it is given. That text is called the prompt.', code: 'prompt' },
        { id: 'prompt', say: 'So write the job itself into the prompt: an instruction, English to French, then a new input, cheese, and an arrow.', code: 'prompt' },
        { id: 'few', say: 'Better still, first show it a few solved examples: dog becomes chien, cow becomes vache.', code: 'few' },
        { id: 'answer', say: 'Now the likeliest continuation is fromage. No training run, no gradient step: the model picked up the task from the examples in front of it.', code: 'answer' },
      ],
    },
    {
      id: 'context',
      title: 'Learning in the context',
      codeTitle: 'context.py',
      code: `
        prompt = """English to French:   #@ctx
        dog => chien                     #@ex
        cow => vache                     #@ex
        cheese =>"""                     #@ctx
        # context: all the model reads   #@limit
        # at once, up to a fixed limit   #@limit
        # 0 examples: zero-shot          #@shots
        # 1 example:  one-shot           #@shots
        # 2 or more:  few-shot           #@shots
      `,
      beats: [
        { id: 'context', say: 'Everything the model can read at once is called its context: the prompt, plus anything the model has written since. Not to be confused with a context vector: this context is the text itself.', code: ['ctx', 'ex'] },
        { id: 'limit', say: 'It has room for only so many tokens. Picture it as a box of fixed size, with the prompt filling the start of it.', code: 'limit' },
        { id: 'attend', say: 'The examples are tokens in that box like any others. Attention lets the last position read every token before it, and to predict what follows such a pattern, the model has to work out the task.', code: 'ex' },
        { id: 'name', say: 'That is why it is called in-context learning. The task is learned from examples in the context, and the learning lives there, not in the weights.', code: ['ctx', 'ex'] },
        { id: 'brown', say: 'In 2020, Tom Brown and colleagues at {OpenAI|Open A I} described it in their paper on {GPT-3|G P T three}, a model with a hundred and seventy five billion parameters. Given a few examples in its prompt, and no gradient step, it sometimes rivaled models fine-tuned for the task.', code: 'ex' },
        { id: 'shots', say: 'They sorted prompts by how many solved examples, or shots, they show. No examples is zero-shot, one is one-shot, and several, like ours, is few-shot.', code: 'shots' },
      ],
    },
    {
      id: 'frozen',
      title: 'Nothing is kept',
      codeTitle: 'frozen.py',
      code: `
        before = weights.copy()            #@pass
        complete(prompt)   # forward only  #@pass
        # weights == before, every entry   #@same
        complete('cheese =>')  # no trace  #@gone
      `,
      beats: [
        { id: 'pass', say: 'So what did the examples change? Copy the weights, then run the prompt. That is a forward pass: it computes no loss and no gradient, so nothing takes a step.', code: 'pass' },
        { id: 'same', say: 'Every weight is exactly what it was. The examples changed only the context, and through attention, what the model predicts next.', code: 'same' },
        { id: 'gone', say: 'So nothing is kept. Send a new prompt without the examples, and the model starts from the same weights, with no trace of them.', code: 'gone' },
      ],
    },
    {
      id: 'room',
      title: 'Examples take room',
      codeTitle: 'room.py',
      code: `
        5 + 2 * 6 + 3     # 20 tokens      #@count
        limit = 1024      # the context    #@limit
        limit - 5 - 3     # 1016 free      #@left
        1016 / 6          # 169.33         #@fit
        1016 // 6         # 169 examples   #@down
      `,
      beats: [
        { id: 'parts', say: 'Examples do cost one thing: room in the context. Here the instruction takes five tokens, and the new input three.', code: 'count' },
        { id: 'each', say: 'Say each example takes six tokens. Our two take twelve.', code: 'count' },
        { id: 'total', say: 'Five, plus twelve, plus three: twenty tokens for the model to read before it answers.', code: 'count' },
        { id: 'limit', say: 'And the box has a limit. In {GPT-3|G P T three}, it held {2,048|two thousand and forty eight} tokens, room for between ten and a hundred examples. Say ours holds {1,024|one thousand and twenty four}.', code: 'limit' },
        { id: 'left', say: 'The instruction and the input take eight of them, which leaves {1,016|one thousand and sixteen} for examples.', code: 'left' },
        { id: 'fit', say: 'At six tokens each, {1,016|one thousand and sixteen} over six is about {169.3|a hundred and sixty nine point three}.', code: 'fit' },
        { id: 'down', say: 'Only whole examples fit, so round down: {169|a hundred and sixty nine} of them, taking {1,014|one thousand and fourteen} tokens. One more would spill past the limit.', code: 'down' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-agent-loop',
  title: 'Agent loops',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'loop',
      title: 'Call, read, call again',
      codeTitle: 'agent.py',
      code: `
        ctx = prompt                             #@need
        for turn in range(10):   # step limit    #@limit
            out = generate(ctx, stop='</call>')  #@call
            ctx += out                           #@call
            if '<call>' not in out:              #@answer
                break            # an answer     #@answer
            res = run_tool(out)                  #@run
            ctx += f'<result>{res}</result>'     #@run
      `,
      beats: [
        { id: 'need', say: 'Some questions take more than one call. Ask for the weather in the capital of Peru, and the model must first find the capital.', code: 'need' },
        { id: 'first', say: 'So it writes a call: search for the capital of Peru. The program runs it and appends the result, Lima. That was turn one.', code: ['call', 'run'] },
        { id: 'second', say: 'Then the program runs the model again. With Lima in view, turn two\'s call is weather of Lima, and back comes {19°C|nineteen degrees}, cloudy.', code: ['call', 'run'] },
        { id: 'answer', say: 'On turn three the model writes no call, only the answer. A turn that ends in an answer instead of a call ends the loop.', code: 'answer' },
        { id: 'limit', say: 'In case the model never stops calling, the program also sets a step limit, here ten turns. A model run in this loop is an agent; the ReAct paper described it in 2022.', code: 'limit' },
      ],
    },
    {
      id: 'grow',
      title: 'The context grows',
      codeTitle: 'context.py',
      code: `
        # prompt: 30 tokens              #@p
        # turn 1: 30 + 5 + 15 = 50       #@t1
        # turn 2: 50 + 5 + 15 = 70       #@t1
        # after turn t: 30 + 20 * t      #@gen
      `,
      beats: [
        { id: 'p', say: 'Every turn makes the context longer. Say the prompt, the question with the tools it may use, takes thirty tokens.', code: 'p' },
        { id: 't1', say: 'Turn one adds a call of five tokens and a result of fifteen: fifty. Turn two adds twenty more: seventy.', code: 't1' },
        { id: 'gen', say: 'Nothing is removed. After any turn, call it turn t, the context is the prompt plus every call and result so far: thirty plus twenty times t.', code: 'gen' },
      ],
    },
    {
      id: 'reread',
      title: 'Reading it all again',
      codeTitle: 'prefill.py',
      code: `
        # no cache: prefill all of ctx    #@plain
        30 + 50 + 70        # 150         #@sum
        # cached prefix: new tokens only  #@new
        30 + 15 + 15        # 60          #@cache
      `,
      beats: [
        { id: 'prefill', say: 'Each turn starts with a prefill: one pass that reads the whole context before the model writes.', code: 'plain' },
        { id: 'plain', say: 'Done plainly, every turn prefills from scratch: thirty tokens on turn one, fifty on turn two, and seventy on turn three, where it writes the answer.', code: 'plain' },
        { id: 'sum', say: 'That is a hundred and fifty tokens, a sum of lengths that each grow. Every extra turn costs more than the one before.', code: 'sum' },
        { id: 'same', say: 'But appending tokens never changes the keys and values of the tokens before them: the causal mask sees to that. So keep them, as the KV cache does.', code: 'new' },
        { id: 'new', say: 'Then each turn prefills only what is new. The call\'s keys and values were stored as the model wrote it, so only the result is new: fifteen tokens.', code: 'new' },
        { id: 'cache', say: 'Thirty, then fifteen, then fifteen: sixty instead of a hundred and fifty. Keeping the earlier context like this is called prefix caching.', code: 'cache' },
      ],
    },
    {
      id: 'try',
      title: 'Count the prefill',
      codeTitle: 'prefill.py',
      code: `
        # prompt 40, 2 calls of 5,       #@p1
        # results of 10, then the answer #@p1
        40 + 55 + 70     # 165, no cache #@a1
        40 + 10 + 10     # 60, cached    #@a2
      `,
      beats: [
        { id: 'p1', say: 'Try one: a prompt of forty tokens, then two calls of five, each with a result of ten, then the answer. How many tokens are prefilled without a cache?', code: 'p1' },
        { id: 'a1', say: 'The three turns read forty, then fifty-five, then seventy: a hundred and sixty-five.', code: 'a1' },
        { id: 'a2', say: 'With the cached prefix, they read forty, then ten, then ten: sixty.', code: 'a2' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-agent-loop',
  title: 'Agent loops',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Yao et al.', year: 2022, title: 'ReAct: Synergizing Reasoning and Acting in Language Models', url: 'https://arxiv.org/abs/2210.03629', scene: 'loop' },
    { who: 'Zheng et al.', year: 2023, title: 'SGLang: Efficient Execution of Structured Language Model Programs', url: 'https://arxiv.org/abs/2312.07104', scene: 'reread' },
  ],
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
        { id: 'need', say: 'Some questions take more than one call. Ask for the weather in the capital of Peru, and the model must first find the capital. That question, with the tools it may use, is its prompt: the text it starts from.', code: 'need' },
        { id: 'first', say: 'So it writes a call: search for the capital of Peru. The program runs it and appends the result, Lima. That was turn one.', code: ['call', 'run'] },
        { id: 'second', say: 'Then the program runs the model again. With Lima in view, turn two\'s call is weather of Lima, and back comes {19°C|nineteen degrees}, cloudy.', code: ['call', 'run'] },
        { id: 'answer', say: 'On turn three the model writes no call, only the answer. A turn that ends in an answer instead of a call ends the loop.', code: 'answer' },
        { id: 'limit', say: 'In case the model never stops calling, the program also sets a step limit, here ten turns.', code: 'limit' },
        { id: 'agent', say: 'A model run in this loop is called an agent, from the Latin word for doing. It no longer just answers: it acts, and picks each next step from what came back.', code: ['call', 'answer', 'run'] },
        { id: 'react', say: 'In 2022, Shunyu Yao and colleagues at Princeton and Google named such a loop ReAct, for reasoning and acting: before each call, their model wrote a short thought in plain words, such as what to look up next.', code: ['call', 'run'] },
        { id: 'hotpot', say: 'They tried it on questions that need facts from two or more Wikipedia passages, like ours, and allowed seven steps: more did not help.', code: 'limit' },
      ],
    },
    {
      id: 'grow',
      title: 'The context grows',
      codeTitle: 'context.py',
      code: `
        # prompt: 30 tokens              #@p
        # turn 1: 30 + 5 + 15 = 50       #@t1
        # turn 2: 50 + 5 + 15 = 70       #@t2
        # after turn t: 30 + 20 * t      #@gen
      `,
      beats: [
        { id: 'p', say: 'Every turn makes the context, everything the model reads at once, a little longer. Say the prompt takes thirty tokens.', code: 'p' },
        { id: 't1', say: 'Turn one adds a call of five tokens and a result of fifteen: thirty plus twenty is fifty.', code: 't1' },
        { id: 't2', say: 'Turn two adds another twenty: seventy.', code: 't2' },
        { id: 'gen', say: 'Nothing is removed. After any turn, call it turn t, the context is the prompt plus every call and result so far: thirty plus twenty times t.', code: 'gen' },
      ],
    },
    {
      id: 'reread',
      title: 'Reading it all again',
      codeTitle: 'prefill.py',
      code: `
        # each turn: a fresh generate    #@fresh
        30 + 50 + 70        # 150        #@sum
        # keep the cache: new tokens only #@new
        30 + 15 + 15        # 60         #@cache
      `,
      beats: [
        { id: 'prefill', say: 'Each turn starts with a prefill: one pass that reads the whole context into the KV cache, K for keys and V for values, before the model writes.', code: 'fresh' },
        { id: 'fresh', say: 'But each turn is a fresh call to generate, and a plain generate starts with an empty cache. So every turn prefills from scratch.', code: 'fresh' },
        { id: 'plain', say: 'Turn one reads thirty tokens. Turn two reads all fifty. Turn three, which writes the answer, reads all seventy.', code: 'fresh' },
        { id: 'sum', say: 'That is a hundred and fifty in all, and every extra turn reads more than the one before.', code: 'sum' },
        { id: 'same', say: 'Yet appending tokens never changes the keys and values of the tokens before them: the causal mask sees to that. Throwing them away wastes the work.', code: 'new' },
        { id: 'keep', say: 'So keep the cache from one turn to the next, and each turn prefills only what is new. The call\'s keys and values were stored as the model wrote it, so only the result is new: fifteen tokens.', code: 'new' },
        { id: 'cache', say: 'Thirty, then fifteen, then fifteen: sixty instead of a hundred and fifty.', code: 'cache' },
        { id: 'name', say: 'This is prefix caching. The prefix is the start of the context, the part each turn shares with the turn before, and caching means keeping its keys and values to use again.', code: 'cache' },
        { id: 'sglang', say: 'In 2023, Lianmin Zheng and colleagues built it into {SGLang|S G Lang}, a structured generation language. Other systems threw a call\'s cache away when the call finished; theirs kept it, for agents like ReAct to reuse.', code: 'new' },
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

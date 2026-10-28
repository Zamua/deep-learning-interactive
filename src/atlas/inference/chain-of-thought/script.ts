import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-chain-of-thought',
  title: 'Chain of thought',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  papers: [
    { who: 'Nye et al.', year: 2021, title: 'Show Your Work: Scratchpads for Intermediate Computation with Language Models', url: 'https://arxiv.org/abs/2112.00114', scene: 'roots' },
    { who: 'Wei et al.', year: 2022, title: 'Chain-of-Thought Prompting Elicits Reasoning in Large Language Models', url: 'https://arxiv.org/abs/2201.11903', scene: 'roots' },
    { who: 'Kojima, Gu, Reid, Matsuo & Iwasawa', year: 2022, title: 'Large Language Models are Zero-Shot Reasoners', url: 'https://arxiv.org/abs/2205.11916', scene: 'roots' },
  ],
  scenes: [
    {
      id: 'depth',
      title: 'One pass, so many steps',
      codeTitle: 'steps.py',
      code: `
        q = 'What is 17 × 24?'           #@q
        generate(q)      # '418': wrong  #@direct
        # a token: one pass, same layers #@pass
        cot = q + ' Show your steps.'    #@cot
        generate(cot)                    #@cot
        # 17 × 20 = 340                  #@s1
        # 17 × 4 = 68                    #@s2
        # 340 + 68 = 408: right          #@s3
      `,
      beats: [
        { id: 'ask', say: 'Ask a language model for {17 × 24|seventeen times twenty four}, and make it answer at once. Here it says {418|four hundred and eighteen}: wrong.', code: ['q', 'direct'] },
        { id: 'pass', say: 'To write each token, the model runs once through its stack of layers. That run is called a pass, and every pass goes through the same layers, so one pass can do only so much.', code: 'pass' },
        { id: 'depth', say: 'Answering at once, the whole product has to be worked out inside that single pass.', code: 'direct' },
        { id: 'paper', say: 'On paper, you would write down a middle result, and build on it.' },
        { id: 'step1', say: 'So ask the model to write its steps first. Now the first pass has one small step: {17 × 20 = 340|seventeen times twenty is three hundred and forty}.', code: ['cot', 's1'] },
        { id: 'feed', say: 'Each token it writes joins the text, and the next pass reads it. So that pass starts from {340|three hundred and forty}, and takes the next step: {17 × 4 = 68|seventeen times four is sixty eight}.', code: 's2' },
        { id: 'answer', say: 'The third pass adds them: {408|four hundred and eight}, right. No pass did more than one small step.', code: 's3' },
        { id: 'same', say: 'The model never changed: same layers, same weights. Only the number of passes grew.', code: 'pass' },
        { id: 'name', say: 'Steps written out before the answer like this are called a chain of thought: each step a link, hooked onto the last.', code: ['s1', 's2', 's3'] },
      ],
    },
    {
      id: 'roots',
      title: 'From scratchpads to a sentence',
      codeTitle: 'prompts.py',
      code: `
        # 2021: train it to use a scratchpad #@nye
        # worked: examples, steps and all    #@wei
        prompt = worked + q                  #@wei
        cue = " Let's think step by step."   #@kojima
        prompt = q + cue                     #@kojima
        # 17.7% → 78.7% right                #@gain
        # steps first: nothing looks ahead   #@order
      `,
      beats: [
        { id: 'nye', say: 'In 2021, Maxwell Nye and colleagues saw language models do well at tasks done in one pass, and struggle with ones that take many steps, like adding long numbers.', code: 'nye' },
        { id: 'scratch', say: 'They trained models to write the steps on a scratchpad first, like your paper, and the models got far better.', code: 'nye' },
        { id: 'prompt', say: 'In 2022, Jason Wei and colleagues at Google needed no special training. They put a few worked examples, steps and all, in the prompt: the text the model is given to continue.', code: 'wei' },
        { id: 'named', say: 'A large enough model then wrote steps of its own. They called them a chain of thought, since they mimic thinking step by step toward an answer.', code: 'wei' },
        { id: 'kojima', say: 'Months later, Takeshi Kojima and colleagues dropped even the examples, and added one sentence: let\'s think step by step.', code: 'kojima' },
        { id: 'gain', say: 'On arithmetic word problems, that took one model from {17.7%|seventeen point seven percent} right to {78.7%|seventy eight point seven percent}.', code: 'gain' },
        { id: 'order', say: 'The steps must come first: each position sees only what came before it, so steps after the answer come too late.', code: 'order' },
      ],
    },
    {
      id: 'cost',
      title: 'The price is tokens',
      codeTitle: 'cost.py',
      code: `
        answer = 2             # tokens      #@tokens
        steps = 30             # tokens      #@tokens
        ms = 20                # per token   #@ms
        answer * ms            # 40 ms       #@ms
        (steps + answer) * ms  # 640 ms      #@slow
        640 / 40               # 16 times    #@ratio
        steps * ms             # 600 ms more #@extra
        2000 * ms / 1000       # 40 s        #@long
      `,
      beats: [
        { id: 'tokens', say: 'Those steps cost tokens. Answering at once, the model wrote two. With its steps, thirty more came first, then the same two-token answer.', code: 'tokens' },
        { id: 'ms', say: 'Each token is one more pass, and each pass takes about the same time: say twenty milliseconds. So two tokens take forty.', code: 'ms' },
        { id: 'slow', say: 'With its steps, it is thirty two tokens: thirty two times twenty, six hundred and forty milliseconds.', code: 'slow' },
        { id: 'ratio', say: 'Sixteen times as long, just as thirty two tokens is sixteen times two: with equal time per token, times compare like token counts.', code: 'ratio' },
        { id: 'extra', say: 'Both end with the same answer, so the extra time is just the steps: thirty tokens, six hundred milliseconds.', code: 'extra' },
        { id: 'long', say: 'Two thousand tokens of steps take forty thousand milliseconds: forty seconds before the answer begins.', code: 'long' },
      ],
    },
    {
      id: 'budget',
      title: 'Where steps are worth it',
      codeTitle: 'budget.py',
      code: `
        ms = 20             # per token       #@ms
        budget = 2 * 1000   # 2 s, in ms      #@budget
        fit = budget // ms  # 100 tokens      #@fit
        fit - 20            # 80 for steps    #@left
        # 17 × 24: each step needs the last   #@helps
        # capital of France: nothing to build #@recall
      `,
      beats: [
        { id: 'budget', say: 'Turn it around. Say the reply must be done within two seconds: that is two thousand milliseconds.', code: ['ms', 'budget'] },
        { id: 'fit', say: 'At twenty milliseconds a token, two thousand over twenty is a hundred tokens in all.', code: 'fit' },
        { id: 'left', say: 'If the answer itself needs twenty of them, the steps get at most eighty.', code: 'left' },
        { id: 'helps', say: 'So spend tokens on steps when the answer is built from them: arithmetic, a word problem, anything where each step needs the last.', code: 'helps' },
        { id: 'recall', say: 'Ask for the capital of France, and there is nothing to build on. The model knows it or it does not, and the steps only cost time.', code: 'recall' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

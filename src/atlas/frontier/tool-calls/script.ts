import type { LectureScript } from '../../../lecture/types';

export const script: LectureScript = {
  id: 'atlas-tool-calls',
  title: 'Tool calls',
  model: 'elevenlabs/eleven-v4',
  voice: 'george',
  speed: 1,
  scenes: [
    {
      id: 'write',
      title: 'The model writes a call',
      codeTitle: 'tools.py',
      code: `
        prompt = 'What is the weather in Paris?'  #@ask
        # 7 tokens                                #@ask
        def weather(city): ...  # a forecast      #@tool
        out = generate(prompt, stop='</call>')    #@call
        # '<call>weather("Paris")</call>'         #@call,markers
        # 6 tokens, the two markers included      #@markers
      `,
      beats: [
        { id: 'ask', say: 'A language model only writes text, one predicted token at a time. Ask it for today\'s weather in Paris, and its weights cannot know: they were fixed when training ended.', code: 'ask' },
        { id: 'tool', say: 'So the program that runs the model offers it a tool: a function, weather, that looks up a city\'s forecast.', code: 'tool' },
        { id: 'call', say: 'To use it, the model writes a call, as text: weather, then Paris in quotes and brackets.', code: 'call' },
        { id: 'markers', say: 'Around the call go two marker tokens, call and end call, so the program can find it. Six tokens in all, each predicted like any other.', code: 'markers' },
      ],
    },
    {
      id: 'run',
      title: 'The program runs it',
      codeTitle: 'tools.py',
      code: `
        name, arg = parse_call(out)        #@spot
        # 'weather', 'Paris'               #@spot
        res = weather(arg)  # '18°C, sunny'  #@run
        ctx = prompt + out                 #@paste
        ctx += f'<result>{res}</result>'   #@paste
        # 5 more tokens, from the program  #@paste
        out = generate(ctx)                #@resume
        # 'It is 18°C and sunny.'          #@resume
      `,
      beats: [
        { id: 'spot', say: 'The program reads every token the model writes. When it sees the end marker, it stops the model and reads the call.', code: 'spot' },
        { id: 'run', say: 'It runs weather of Paris itself, outside the model, and gets back {18°C|eighteen degrees}, sunny.', code: 'run' },
        { id: 'paste', say: 'Then it pastes that result into the context, between result markers: five more tokens, written by the program, not the model.', code: 'paste' },
        { id: 'resume', say: 'And it lets the model write on. With the forecast in view, the next tokens come easily: it is {18°C|eighteen degrees} and sunny.', code: 'resume' },
        { id: 'attend', say: 'The model reads the result the way it reads any earlier token, through attention. No weight changed: only the context did.', code: 'resume' },
        { id: 'steps', say: 'Five steps, then. The model writes the call, the program spots it, runs it and pastes the result, and the model writes on.', code: ['spot', 'run', 'paste', 'resume'] },
      ],
    },
    {
      id: 'learn',
      title: 'Learning the format',
      codeTitle: 'few_shot.py',
      code: `
        prompt = '''                                   #@shots
        Q: What is the weather in Rome?                #@shots
        <call>weather("Rome")</call>                   #@shots
        <result>22°C, cloudy</result>                  #@shots
        A: It is 22°C and cloudy.                      #@shots
        Q: What is the weather in Paris?'''            #@new
        # or: gradient steps on such transcripts      #@train
      `,
      beats: [
        { id: 'shots', say: 'How does the model know this format? It can pick it up in context: the prompt first shows a solved exchange, with a call, its result and the answer.', code: 'shots' },
        { id: 'new', say: 'Then comes the new question, and the likeliest continuation is a call of the same shape.', code: 'new' },
        { id: 'train', say: 'Or it is trained on many such transcripts, with gradient steps, so the format is in its weights. Toolformer did this in 2023.', code: 'train' },
      ],
    },
    {
      id: 'try',
      title: 'Count the context',
      codeTitle: 'count.py',
      code: `
        7 + 6 + 5    # 18 in view       #@count
        6 + 6        # 12 by the model  #@wrote
        # prompt 12, call 7, result 4                   #@p1
        12 + 7 + 4    # 23                              #@a1
      `,
      beats: [
        { id: 'count', say: 'Now count. The question took seven tokens, the call six, and the result five: seven plus six plus five is eighteen tokens in view when the model writes on.', code: 'count' },
        { id: 'wrote', say: 'Of the final context, the model wrote the call and the answer, six tokens each: twelve. The question came in from outside, and the program wrote the result.', code: 'wrote' },
        { id: 'p1', say: 'Try one: a prompt of twelve tokens, a call of seven, and a result of four. How many tokens are in the context when the model writes on?', code: 'p1' },
        { id: 'a1', say: 'Twelve plus seven plus four: twenty-three.', code: 'a1' },
        { id: 'turn', say: 'Your turn.' },
      ],
    },
  ],
};

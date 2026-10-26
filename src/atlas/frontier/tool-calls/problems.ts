import type { Generator } from '../../../mastery/domain/types';
import { int, pick } from '../../kit';
import { big, bigText, choice, traps } from '../../inference/kit';
import { TOOLS, type Tool } from './tools';

const called = (t: Tool) => `the call \`${t.call}\``;
const result = (t: Tool) => `the result \`${t.res}\``;

/** The finished context of one exchange, as the model saw it. */
const transcript = (t: Tool) => ["context = '''" + t.q, `<call>${t.call}</call>`, `<result>${t.res}</result>`, `${t.reply}'''`].join('\n');

export const generators: Generator[] = [
  {
    id: 'context',
    make(rng, d) {
      const t = pick(rng, TOOLS);
      const P = d < 0.35 ? int(rng, 6, 15) : pick(rng, [int(rng, 20, 90), int(rng, 100, 900)]);
      const c = int(rng, 5, 12);
      const r = int(rng, 3, 12);
      const kind = d < 0.5 ? 'resume' : pick(rng, ['resume', 'wrote'] as const);
      const setup = `A prompt of ${bigText(P)} tokens asks a model: “${t.q}” The model writes ${called(t)}, ${c} tokens with its markers, and the program adds ${result(t)}, ${r} tokens with its markers.`;
      const u = P + c + r;
      if (kind === 'wrote') {
        const a = int(rng, 6, 20);
        const v = c + a;
        return {
          prompt: `${setup} The model then writes an answer of ${a} tokens. How many tokens of the final context did the model write?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: c + r + a, why: 'That counts the result. The program wrote it, after running the tool.' },
            { value: a, why: 'That leaves out the call. The model wrote it too, as ordinary tokens.' },
            { value: P + c + a, why: 'That counts the prompt, which came in before the model wrote anything.' },
          ]),
          solution: [
            'The prompt came in from outside, and the result came from the program, which ran the tool.',
            `The model wrote the call, ${c} tokens, and the answer, ${a} tokens.`,
            `So it wrote $${c} + ${a} = ${v}$ tokens.`,
          ],
        };
      }
      return {
        prompt: `${setup} How many tokens are in the context when the model writes on?`,
        answer: { kind: 'number', value: u },
        traps: traps(u, [
          { value: P + c, why: 'That leaves out the result. The program pastes it into the context, after the call.' },
          { value: P + r, why: 'That leaves out the call. The model\'s own call stays in the context.' },
          { value: c + r, why: 'That leaves out the prompt, which is still in the context.' },
        ]),
        solution: [
          `The prompt is in the context: ${bigText(P)} tokens.`,
          `The model's call stays in it too: ${c} more.`,
          `The program pastes the result after the call: ${r} more.`,
          `In all $${big(P)} + ${c} + ${r} = ${big(u)}$ tokens, every one in view when the model writes on.`,
        ],
      };
    },
  },
  {
    id: 'wrote',
    make(rng) {
      const t = pick(rng, TOOLS);
      const kind = rng.int(2);
      const ask = `A model asked “${t.q}” ends up with this context, with one tool call in it.`;
      if (kind === 0) {
        return {
          prompt: `${ask} Which parts did the model write?`,
          code: transcript(t),
          answer: choice([
            { text: 'The call and the last line', why: null },
            { text: 'The call, the result and the last line', why: `The result, \`${t.res}\`, came from the program. It ran the tool and pasted what came back.` },
            { text: 'Only the last line', why: `The call is text the model wrote, token by token. The program only spots it and runs it.` },
            { text: 'Every line, the question included', why: 'The question was the prompt. The model writes only what comes after it.' },
          ]),
          solution: [
            'The question is the prompt: it was there before the model wrote anything.',
            `The model wrote ${called(t)} between call markers, then stopped at the end marker.`,
            `The program ran the tool and pasted in ${result(t)}, between result markers.`,
            'With the result in view, the model wrote the last line. So it wrote the call and the last line.',
          ],
        };
      }
      return {
        prompt: `${ask} Which part did the program around the model write?`,
        code: transcript(t),
        answer: choice([
          { text: `The result, \`${t.res}\``, why: null },
          { text: `The call, \`${t.call}\``, why: 'The model wrote the call, as text. The program only reads it and runs the tool.' },
          { text: 'The last line', why: 'The model wrote that, with the result in view.' },
          { text: 'None of it: the model wrote every line after the question', why: `Nothing in the model's weights holds ${t.res}. The program ran the tool and pasted the result in.` },
        ]),
        solution: [
          `The model wrote ${called(t)} and stopped at the end marker.`,
          'The program ran the tool, which the model cannot do.',
          `It pasted the result, \`${t.res}\`, into the context. Then the model wrote the last line.`,
        ],
      };
    },
  },
  {
    id: 'who',
    make(rng) {
      const t = pick(rng, TOOLS);
      const kind = pick(rng, ['run', 'where', 'learn', 'stop'] as const);
      const setup = `A model asked “${t.q}” writes ${called(t)}.`;
      if (kind === 'run') {
        return {
          prompt: `${setup} What runs \`${t.call}\`?`,
          answer: choice([
            { text: 'The program around the model, once it spots the call', why: null },
            { text: 'The model itself, inside its next forward pass', why: 'A forward pass only turns tokens into next-token probabilities. It cannot reach a tool.' },
            { text: 'The model\'s attention, by finding the answer in the context', why: 'The answer is not in the context until the program runs the tool and pastes it in.' },
            { text: 'No one: the model guesses the result and writes on', why: 'A guess would be made up. The program stops the model at the end marker and runs the real tool.' },
          ]),
          solution: [
            'The model only writes text: the call is a few tokens it wrote.',
            'The program watching the output spots the end marker, stops the model and reads the call.',
            `It runs \`${t.call}\` itself, outside the model, and pastes the result into the context.`,
          ],
        };
      }
      if (kind === 'where') {
        return {
          prompt: `${setup} The tool returns \`${t.res}\`. Where does that go?`,
          answer: choice([
            { text: 'Into the context, as tokens the model reads next', why: null },
            { text: 'Into the model\'s weights, through a gradient step', why: 'Nothing is trained while the model runs. The result reaches it only as tokens in the context.' },
            { text: 'Straight to the user, in place of the model\'s answer', why: 'The model writes the answer, and it can only use the result if the result is in its context.' },
            { text: 'In place of the prompt, which is cleared to make room', why: 'The prompt stays. The result goes after the call, and the model reads all of it.' },
          ]),
          solution: [
            `The program pastes \`${t.res}\` into the context, between result markers, right after the call.`,
            'The model writes on, and its attention reads the result like any earlier token.',
            'No weight changes: the result only changes the context.',
          ],
        };
      }
      if (kind === 'learn') {
        return {
          prompt: `${setup} How did it learn to write a call in this format?`,
          answer: choice([
            { text: 'From examples, in its prompt or in its training data', why: null },
            { text: 'The program rewrites its weights each time it runs a tool', why: 'Running a tool changes only the context. No weight moves while the model runs.' },
            { text: 'The tool\'s code is in its context, and attention runs it', why: 'The model never runs code. It only writes text, and the program does the running.' },
            { text: 'It did not: the program turns its plain answer into a call', why: 'The model writes the call itself. The program only spots the markers and reads what is between them.' },
          ]),
          solution: [
            'The format is a pattern of tokens, like any other.',
            'A prompt can show a few solved exchanges, call, result and answer, and the model picks up the format in context.',
            'Or the model is trained on many such transcripts, so the format is in its weights.',
          ],
        };
      }
      return {
        prompt: `${setup} Why does no token come after the end marker \`</call>\` until the result is in?`,
        answer: choice([
          { text: 'The program stops the model there and runs the tool first', why: null },
          { text: 'The context is full once a call is written', why: 'A call is a few tokens. The program stops at the marker on purpose, whatever room is left.' },
          { text: 'The model has to train on the call before it can go on', why: 'Nothing is trained while the model runs. It waits only because the program paused it.' },
          { text: 'The end marker deletes the call from the context', why: 'The call stays in the context. The result goes right after it.' },
        ]),
        solution: [
          'The program watches every token the model writes.',
          'When it sees the end marker, it stops the model, reads the call and runs the tool.',
          'It pastes the result into the context, and only then lets the model write on.',
        ],
      };
    },
  },
  {
    id: 'order',
    make(rng) {
      const t = pick(rng, TOOLS);
      return {
        prompt: `A model is asked “${t.q}” and answers with one tool call. Put the steps in order.`,
        answer: {
          kind: 'order',
          items: [
            `The model writes ${called(t)}`,
            'The program spots the end marker and stops the model',
            `The program runs \`${t.call}\``,
            `The program pastes ${result(t)} into the context`,
            'The model writes on, with the result in view',
          ],
        },
        solution: [
          'The model writes the call as text, ending with the end marker.',
          'The program sees the marker, stops the model and reads the call.',
          `It runs \`${t.call}\` and gets \`${t.res}\`.`,
          'It pastes the result into the context, after the call.',
          'The model writes on, reading the result like any earlier token.',
        ],
      };
    },
  },
];

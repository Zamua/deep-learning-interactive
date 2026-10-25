import type { Generator } from '../../../mastery/domain/types';
import { int, pick } from '../../kit';
import { big, commas, lit, traps } from '../kit';

/** Tasks a prompt can teach by example: an instruction and input => output pairs. */
const TASKS: { does: string; head: string; pairs: [string, string][] }[] = [
  { does: 'translate English words into French', head: 'English to French:', pairs: [['dog', 'chien'], ['cat', 'chat'], ['cow', 'vache'], ['bread', 'pain'], ['water', 'eau'], ['house', 'maison']] },
  { does: 'give the opposite of a word', head: 'Opposites:', pairs: [['hot', 'cold'], ['up', 'down'], ['big', 'small'], ['fast', 'slow'], ['early', 'late'], ['open', 'closed']] },
  { does: 'name the capital of a country', head: 'Capitals:', pairs: [['France', 'Paris'], ['Japan', 'Tokyo'], ['Kenya', 'Nairobi'], ['Peru', 'Lima'], ['Egypt', 'Cairo'], ['Canada', 'Ottawa']] },
  { does: 'turn a word into its plural', head: 'Plurals:', pairs: [['mouse', 'mice'], ['child', 'children'], ['box', 'boxes'], ['city', 'cities'], ['leaf', 'leaves'], ['foot', 'feet']] },
  { does: 'label a review as positive or negative', head: 'Review sentiment:', pairs: [['loved it', 'positive'], ['a waste of time', 'negative'], ['great fun', 'positive'], ['too slow', 'negative'], ['would watch again', 'positive'], ['fell asleep', 'negative']] },
  { does: 'write a number in words', head: 'Numbers in words:', pairs: [['12', 'twelve'], ['40', 'forty'], ['7', 'seven'], ['31', 'thirty-one'], ['99', 'ninety-nine'], ['3', 'three']] },
];

export const generators: Generator[] = [
  {
    id: 'weights',
    make(rng) {
      const t = pick(rng, TASKS);
      const k = int(rng, 2, 5);
      const [q] = rng.shuffle(t.pairs.slice());
      const setup = `A pretrained model gets a prompt with ${k} examples that ${t.does}, then a new input, ${lit(q![0])}, and it continues with ${lit(q![1])}.`;
      const kind = rng.int(3);
      if (kind === 0) {
        return {
          prompt: `${setup} What changed in the model's weights while it did this?`,
          answer: {
            kind: 'choice',
            options: ['Nothing: the examples were only tokens in its context', 'They took a gradient step toward the examples', 'The embedding table gained rows for the examples\' words', 'The unembedding shifted to favor the answer\'s format'],
            correct: 0,
            why: [
              null,
              'A forward pass computes no loss and no gradient. The model only read the examples.',
              'The vocabulary is fixed before training; the examples are ordinary tokens the model already has.',
              'No weight moves during a forward pass, the unembedding included. The format comes from attending to the examples.',
            ],
          },
          solution: ['Running the model is a forward pass: no loss, no gradient, no weight update.', 'The examples changed only the context, and through attention, what the model predicts next.'],
        };
      }
      if (kind === 1) {
        return {
          prompt: `${setup} Right after, the same model gets a new prompt that is only ${lit(q![0])}, with no instruction and no examples. What does it keep from the earlier prompt?`,
          answer: {
            kind: 'choice',
            options: ['Nothing: the examples left with that prompt\'s context', 'The task: it learned it from the examples', 'The examples, stored in its weights', 'The answer format, but not the examples themselves'],
            correct: 0,
            why: [
              null,
              'Nothing was learned in the weights. The task was inferred inside one forward pass, from tokens that are now gone.',
              'Reading a prompt never writes to the weights.',
              'Even the format came from attending to the examples, which are no longer in the context.',
            ],
          },
          solution: ['In-context learning changes no weight: it lives in the context the model attends over.', 'A new prompt starts from the same frozen weights, so nothing of the old examples carries over.'],
        };
      }
      return {
        prompt: `${setup} How does it use the ${k} examples?`,
        answer: {
          kind: 'choice',
          options: ['It attends to them like any earlier tokens in its context', 'It first runs gradient descent on them, then answers', 'It copies the output of the most similar example', 'It ignores them and reads only the last line'],
          correct: 0,
          why: [
            null,
            'Answering is one forward pass at a time, with no loss and no update: the weights stay fixed.',
            `Its answer, ${lit(q![1])}, appears in none of the examples. The model inferred the task, not a line to copy.`,
            'Every position attends to all the tokens before it, examples included. Without them the task would be ambiguous.',
          ],
        },
        solution: ['The examples are just earlier tokens. Each position attends over them, as it would over any text.', 'Predicting the next token after such a pattern means working out the task from the examples, with the weights unchanged.'],
      };
    },
  },
  {
    id: 'prompt-tokens',
    make(rng, d) {
      const a = int(rng, 3, 12);
      const m = int(rng, 4, 12);
      const k = d < 0.5 ? int(rng, 2, 5) : int(rng, 5, 32);
      const q = int(rng, 3, 8);
      if (d >= 0.7 && rng.int(2) === 0) {
        const C = pick(rng, [256, 512, 1024, 2048]);
        const fit = Math.floor((C - a - q) / m);
        return {
          prompt: `A model's context holds at most ${commas(C)} tokens. A few-shot prompt needs an instruction of ${a} tokens and the new input of ${q} tokens, and each example takes ${m} tokens. How many examples fit, at most?`,
          answer: { kind: 'number', value: fit },
          traps: traps(fit, [
            { value: Math.floor(C / m), why: 'That leaves no room for the instruction and the new input, which share the same context.' },
            { value: Math.ceil((C - a - q) / m), why: 'That rounds up, and the last example would not fit. Round down.' },
          ]),
          solution: [`The instruction and the input take $${a} + ${q} = ${a + q}$ tokens, leaving $${big(C)} - ${a + q} = ${big(C - a - q)}$.`, `Each example takes ${m}: $\\lfloor ${big(C - a - q)} / ${m} \\rfloor = ${fit}$ examples.`],
        };
      }
      const v = a + k * m + q;
      return {
        prompt: `A few-shot prompt starts with an instruction of ${a} tokens, then ${k} examples of ${m} tokens each, then the new input of ${q} tokens. How many tokens does the model read before it writes its answer?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: k * m, why: 'That counts only the examples. The instruction and the new input are tokens in the context too.' },
          { value: a + k * m, why: 'That leaves out the new input, which the model must read before answering.' },
          { value: a + (k + 1) * m + q, why: 'The new input is not another example: it has its own length.' },
          { value: a + k + m + q, why: `That adds the number of examples instead of multiplying: ${k} examples of ${m} tokens are $${k} \\times ${m}$.` },
        ]),
        solution: [`The examples take $${k} \\times ${m} = ${k * m}$ tokens.`, `Add the instruction and the new input: $${a} + ${k * m} + ${q} = ${v}$ tokens, all of them in the context.`],
      };
    },
  },
  {
    id: 'shots',
    make(rng) {
      const t = pick(rng, TASKS);
      const k = pick(rng, [0, 1, 2, 3, 4]);
      const pairs = rng.shuffle(t.pairs.slice());
      const ex = pairs.slice(0, k);
      const q = pairs[k]!;
      const code = ['prompt = """' + t.head, ...ex.map(([x, y]) => `${x} => ${y}`), `${q[0]} =>"""`].join('\n');
      const correct = k === 0 ? 0 : k === 1 ? 1 : 2;
      const why: (string | null)[] = [
        `A zero-shot prompt has no examples; this one shows ${k === 1 ? 'one' : k}.`,
        k === 0 ? 'A one-shot prompt shows one solved example; this one has none, only the instruction.' : `One-shot means exactly one example; this one shows ${k}.`,
        k === 0 ? 'Few-shot needs several solved examples; this one has none.' : 'Few-shot means several examples; this one shows just one.',
        'Fine-tuning takes gradient steps on examples and changes the weights. A prompt changes none.',
      ];
      why[correct] = null;
      return {
        prompt: `A pretrained model gets this prompt to ${t.does}, ending with the new input ${lit(q[0])}, and continues it. What kind of prompting is this?`,
        code,
        answer: { kind: 'choice', options: ['Zero-shot', 'One-shot', 'Few-shot', 'Fine-tuning'], correct, why },
        solution: [
          `The prompt holds ${k === 0 ? 'no solved examples' : k === 1 ? 'one solved example' : `${k} solved examples`} before the new input.`,
          ['No examples, only the instruction: zero-shot.', 'One example: one-shot.', 'Several examples: few-shot.'][correct]!,
          'In every case the weights stay fixed; only the context changes.',
        ],
      };
    },
  },
];

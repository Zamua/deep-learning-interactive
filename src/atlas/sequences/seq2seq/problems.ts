import type { Generator } from '../../../mastery/domain/types';
import { int, pick } from '../../kit';
import { toks } from '../kit';

/** Source and target token lists: short translations. */
const PAIRS: [string[], string[]][] = [
  [['je', 'suis', 'étudiant'], ['I', 'am', 'a', 'student']],
  [['il', 'pleut'], ['it', 'is', 'raining']],
  [['das', 'ist', 'gut'], ['that', 'is', 'good']],
  [['hola', 'amigo'], ['hello', 'friend']],
  [['el', 'gato', 'negro'], ['the', 'black', 'cat']],
  [['ich', 'bin', 'müde'], ['I', 'am', 'tired']],
  [['merci', 'beaucoup'], ['thank', 'you', 'very', 'much']],
  [['buenos', 'días'], ['good', 'morning']],
  [['la', 'maison', 'bleue'], ['the', 'blue', 'house']],
  [['wie', 'geht', 'es', 'dir'], ['how', 'are', 'you']],
  [['tengo', 'hambre'], ['I', 'am', 'hungry']],
  [['bonne', 'nuit'], ['good', 'night']],
];
const OTHER = ['dog', 'is', 'the', 'we', 'red', 'go', 'a', 'it', 'not', 'very'];

const quote = (xs: readonly string[]): string => `\`${xs.join(' ')}\``;
const tok = (x: string): string => `\`${x}\``;

export const generators: Generator[] = [
  {
    id: 'steps',
    make(rng) {
      const [src, tgt] = pick(rng, PAIRS);
      const items = [
        `The encoder reads ${toks(src)}, one token per step`,
        'Its final state becomes the decoder\'s first state',
        `The decoder reads \`<start>\` and predicts ${tok(tgt[0]!)}`,
        `It reads ${tok(tgt[0]!)} and predicts ${tok(tgt[1]!)}${tgt.length > 2 ? ', and so on' : ''}`,
        `After ${tok(tgt[tgt.length - 1]!)} it predicts \`<end>\` and stops`,
      ];
      return {
        prompt: `A seq2seq model translates ${quote(src)} into ${quote(tgt)}. Put its steps in order.`,
        answer: { kind: 'order', items },
        solution: [
          'The encoder reads the whole input first; nothing is written until it is done.',
          'Its final state, one fixed-size vector, starts the decoder.',
          'The decoder writes one token per step, each time reading the token before, starting from `<start>`.',
          'It stops when it predicts `<end>`, so the output can be longer or shorter than the input.',
        ],
      };
    },
  },
  {
    id: 'bottleneck',
    make(rng) {
      const H = pick(rng, [128, 256, 512, 1024]);
      const n = int(rng, 5, 60);
      return {
        prompt: `A seq2seq model has an LSTM encoder with $\\symH = ${H}$ hidden units. It reads a sentence of ${n} tokens. What does the decoder get from the encoder?`,
        answer: {
          kind: 'choice',
          options: [`One vector of ${H} numbers, the same size for any input length`, `${n} vectors of ${H} numbers, one for each input token`, `${n} numbers, one for each input token`, 'One vector whose size grows with the length of the input'],
          correct: 0,
          why: [
            null,
            'The encoder makes one state per token, but only its final state is passed on to the decoder.',
            `The encoder's state is ${H} numbers, whatever the input; nothing in it is set aside per token.`,
            `The state's size is fixed by $\\symH = ${H}$. A longer input has to fit into the same ${H} numbers: that is the bottleneck.`,
          ],
        },
        solution: [`The encoder's final state, $\\symH = ${H}$ numbers, is all the decoder starts from.`, `A sentence of ${n} tokens, or of 500, has to squeeze into those same ${H} numbers: a bottleneck.`],
      };
    },
  },
  {
    id: 'decoder-steps',
    make(rng, d) {
      const [src, tgt] = pick(rng, PAIRS);
      const m = src.length;
      const n = tgt.length;
      const kind = d < 0.35 ? 0 : d < 0.7 ? rng.int(2) : rng.int(3);
      const base = `A seq2seq model translates ${quote(src)} (${m} tokens) into ${quote(tgt)} (${n} tokens). The decoder starts by reading \`<start>\` and must finish by predicting \`<end>\`.`;
      if (kind === 2) {
        const v = m + n + 1;
        return {
          prompt: `${base} How many steps do the encoder and the decoder take in all, one token per step?`,
          answer: { kind: 'number', value: v },
          traps: [
            { value: m + n, why: 'That forgets `<end>`: the decoder needs one more step to predict it.' },
            { value: m + n + 2, why: 'That counts `<start>` as a prediction. The decoder reads it at its first step; it never predicts it.' },
            { value: n + 1, why: `That is only the decoder. The encoder first takes ${m} steps, one per input token.` },
          ],
          solution: [`The encoder takes ${m} steps, one per input token.`, `The decoder predicts ${n} tokens and then \`<end>\`: ${n + 1} steps.`, `In all: $${m} + ${n + 1} = ${v}$.`],
        };
      }
      const v = n + 1;
      if (kind === 1) {
        return {
          prompt: `${base} How many tokens does the decoder read in all, one per step?`,
          answer: { kind: 'number', value: v },
          traps: [
            { value: n, why: 'That forgets `<start>`, which the decoder reads at its first step.' },
            { value: n + 2, why: 'That counts `<end>` too. The decoder stops once it predicts `<end>`; it never reads it.' },
          ],
          solution: [`The decoder reads \`<start>\`, then each output token it has written: ${toks(['<start>', ...tgt])}.`, `That is $1 + ${n} = ${v}$ tokens, one per step: the same count as its predictions, ending with \`<end>\`.`],
        };
      }
      return {
        prompt: `${base} How many steps does the decoder take, predicting one token per step?`,
        answer: { kind: 'number', value: v },
        traps: [
          { value: n, why: 'That forgets `<end>`: the decoder must also predict where the output stops.' },
          { value: n + 2, why: 'That counts `<start>` as a prediction. The decoder reads it at its first step; it never predicts it.' },
          ...(![n - 1, n, n + 1].includes(m) ? [{ value: m + 1, why: `That counts the input. The decoder's steps follow the output, ${n} tokens, not the input's ${m}.` }] : []),
        ],
        solution: [
          `The decoder predicts each of the ${n} output tokens, ${toks(tgt)}, one per step.`,
          `Then one more step predicts \`<end>\`: ${n + 1} steps.`,
          '`<start>` is only read, never predicted, so it adds no step.',
        ],
      };
    },
  },
  {
    id: 'teacher-forcing',
    make(rng, d) {
      const [src, tgt] = pick(rng, PAIRS.filter(([, t]) => t.length >= 3));
      const k = rng.int(tgt.length - 1);
      const wrong = pick(rng, OTHER.filter((w) => w !== tgt[k] && w !== tgt[k + 1] && !tgt.includes(w)));
      if (d < 0.5 || rng.int(2) === 0) {
        return {
          prompt: `Training on ${quote(src)} → ${quote(tgt)} with teacher forcing, the decoder's step ${k}, counting from 0, should predict ${tok(tgt[k]!)} but predicts ${tok(wrong)}. What does the decoder read at step ${k + 1}?`,
          answer: {
            kind: 'choice',
            options: [`The right token, ${tok(tgt[k]!)}`, `Its own guess, ${tok(wrong)}`, `The token it must predict next, ${tok(tgt[k + 1]!)}`, 'The encoder\'s final state, in place of a token'],
            correct: 0,
            why: [
              null,
              'Feeding back its own guess is what the decoder does at test time. Teacher forcing feeds the right token instead, so one mistake does not derail the rest.',
              `Reading ${tok(tgt[k + 1]!)} at step ${k + 1} would hand the decoder the very token it must predict there.`,
              'The encoder\'s state starts the decoder once. At every step the decoder reads a token.',
            ],
          },
          solution: [
            'Teacher forcing: during training, each decoder step reads the true previous token, whatever the model predicted.',
            `So step ${k + 1} reads ${tok(tgt[k]!)} and must predict ${tok(tgt[k + 1]!)}; the wrong guess ${tok(wrong)} still counts as a mistake at step ${k}.`,
          ],
        };
      }
      return {
        prompt: `At test time, the model translates ${quote(src)} with no target given. At step ${k}, counting from 0, the decoder predicts ${tok(wrong)}. What does it read at step ${k + 1}?`,
        answer: {
          kind: 'choice',
          options: [`Its own prediction, ${tok(wrong)}`, 'The `<start>` token again', `The input token at the same position, ${tok(src[Math.min(k, src.length - 1)]!)}`, 'The encoder\'s final state, in place of a token'],
          correct: 0,
          why: [
            null,
            '`<start>` is read once, at the first step. After that the decoder reads the token before.',
            'The decoder reads the output so far, not the input: the two need not line up word for word.',
            'The encoder\'s state starts the decoder once. At every step the decoder reads a token.',
          ],
        },
        solution: ['At test time there is no right answer to feed in, so the decoder reads its own previous prediction.', `Step ${k + 1} reads ${tok(wrong)}, right or wrong: at test time, one mistake carries forward into every later step.`],
      };
    },
  },
];

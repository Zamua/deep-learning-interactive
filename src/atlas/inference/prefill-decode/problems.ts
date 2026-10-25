import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick } from '../../kit';
import type { Rng } from '../../../core/rand';
import { big, bigText, choice, clean, traps } from '../kit';

/** Model sizes in gigabytes and decode speeds in tokens per second, paired so the memory speed is a round number. */
function speedSetup(rng: Rng): { params: number; gb: number; rate: number; bw: number } {
  for (;;) {
    const params = pick(rng, [1, 2, 4, 7, 8, 10, 13, 20]);
    const gb = params * 2;
    const rate = pick(rng, [25, 40, 50, 80, 100, 125, 200, 250, 400]);
    const bw = gb * rate;
    if (bw >= 400 && bw <= 5000 && bw % 100 === 0) return { params, gb, rate, bw };
  }
}

export const generators: Generator[] = [
  {
    id: 'passes',
    make(rng, d) {
      const P = d < 0.35 ? int(rng, 4, 30) : pick(rng, [int(rng, 20, 400), int(rng, 500, 4000)]);
      const n = d < 0.35 ? int(rng, 3, 12) : int(rng, 10, 600);
      const kind = d < 0.35 ? 'total' : pick(rng, ['total', 'decode', 'time'] as const);
      const setup = `A prompt of ${bigText(P)} tokens goes into a language model, and it writes ${bigText(n)} new tokens.`;
      if (kind === 'time') {
        const pre = pick(rng, [20, 40, 50, 80, 100, 150, 200]);
        const dec = pick(rng, [5, 10, 20, 25, 40]);
        const v = clean((pre + (n - 1) * dec) / 1000);
        return {
          prompt: `${setup} The prefill takes ${pre} ms and every decode pass takes ${dec} ms. How many seconds until the last new token is written?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: clean((pre + n * dec) / 1000), why: 'That gives the first new token a decode pass of its own. The prefill already wrote it, so only the other tokens need decode passes.' },
            { value: clean((n * dec) / 1000), why: 'That leaves out the prefill and counts a decode pass for every new token. The prefill comes first, and it writes the first token.' },
            { value: pre + (n - 1) * dec, why: 'That is in milliseconds. Divide by 1,000 for seconds.' },
            { value: clean(((P + n - 1) * dec + pre) / 1000), why: 'That gives every prompt token a pass of its own. The prefill reads them all in one.' },
          ]),
          solution: [
            `The prefill runs the whole prompt in one pass, in ${pre} ms, and writes the first new token.`,
            `Each of the other $${big(n)} - 1 = ${big(n - 1)}$ tokens takes a decode pass: $${big(n - 1)} \\times ${dec} = ${big((n - 1) * dec)}$ ms.`,
            `In all $${pre} + ${big((n - 1) * dec)} = ${big(pre + (n - 1) * dec)}$ ms, which is $${num(v)}$ seconds.`,
          ],
        };
      }
      const v = kind === 'total' ? n : n - 1;
      return {
        prompt: `${setup} ${kind === 'total' ? 'How many passes of the model does that take, counting the prefill?' : 'How many decode passes follow the prefill?'}`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: kind === 'total' ? n + 1 : n, why: 'That gives the first new token a decode pass of its own. The prefill pass already wrote it.' },
          { value: kind === 'total' ? P + n : P + n - 1, why: 'That gives every prompt token a pass of its own. The prompt is known in full, so the prefill runs all of it in one pass.' },
          { value: kind === 'total' ? n - 1 : 1, why: kind === 'total' ? 'That leaves out the prefill pass itself.' : 'Only the prompt runs in one pass. Each new token depends on the one before, so it needs a pass of its own.' },
        ]),
        solution: [
          `The prefill runs all ${bigText(P)} prompt tokens in one pass and gives new token 1.`,
          `Each later token depends on the one before it, so new tokens 2 to ${bigText(n)} take one decode pass each: $${big(n - 1)}$ passes.`,
          kind === 'total' ? `In all $1 + ${big(n - 1)} = ${big(n)}$ passes.` : `So $${big(n - 1)}$ decode passes follow the prefill.`,
        ],
      };
    },
  },
  {
    id: 'speed',
    make(rng, d) {
      const { params, gb, rate, bw } = speedSetup(rng);
      const fromParams = d >= 0.35;
      const askMs = d >= 0.7 && rng.next() < 0.5;
      const ms = clean(1000 / rate);
      const v = askMs ? ms : rate;
      const model = fromParams ? `a model of ${params} billion parameters stored at 2 bytes each` : `a model whose weights take ${gb} GB`;
      return {
        prompt: `A GPU reads its memory at ${bigText(bw)} GB per second. It decodes one sequence with ${model}. ${askMs ? 'At least how many milliseconds does each new token take' : 'At most how many tokens per second can it write'}?`,
        answer: { kind: 'number', value: v },
        traps: traps(
          v,
          askMs
            ? [
                { value: rate, why: `That is the tokens per second, $${big(bw)} / ${gb}$. The time per token is one over it: $1000 / ${rate}$ ms.` },
                { value: clean(gb / bw), why: 'That is in seconds. Multiply by 1,000 for milliseconds.' },
                ...(fromParams ? [{ value: clean((1000 * params) / bw), why: `That reads ${params} GB, one byte per parameter. At 2 bytes each the weights take $${params} \\times 2 = ${gb}$ GB.` }] : []),
              ]
            : [
                { value: clean(gb / bw), why: 'That is the model\'s bytes over the memory speed: the seconds per token. Tokens per second is the other way up.' },
                ...(fromParams ? [{ value: clean(bw / params), why: `That divides by ${params} GB, one byte per parameter. At 2 bytes each the weights take $${params} \\times 2 = ${gb}$ GB.` }] : []),
              ],
        ),
        solution: [
          fromParams ? `The weights take $${params} \\times 2 = ${gb}$ GB.` : `The weights take ${gb} GB.`,
          `Every decode pass must read all of them, and that is most of its time: $${gb} / ${big(bw)}$ of a second${askMs ? `, which is $${num(ms)}$ ms` : ''}.`,
          askMs ? `So each new token takes $${num(ms)}$ ms.` : `So the GPU writes $${big(bw)} / ${gb} = ${rate}$ tokens per second at most.`,
        ],
      };
    },
  },
  {
    id: 'bound',
    make(rng) {
      const params = pick(rng, [1, 3, 7, 8, 13, 34, 70]);
      const gpu = pick(rng, [
        ['1,000 trillion', '3,000'],
        ['300 trillion', '1,500'],
        ['2,000 trillion', '8,000'],
        ['100 trillion', '900'],
      ]);
      return {
        prompt: `A GPU does ${gpu[0]} arithmetic operations per second and reads ${gpu[1]} GB of memory per second. It decodes one token at a time for a ${params}-billion-parameter model stored at 2 bytes per weight. What limits how fast each decode pass runs?`,
        answer: choice([
          { text: 'Reading every weight from memory, to use each in just one multiply and add', why: null },
          { text: `The arithmetic: ${2 * params} billion operations is a lot of work per token`, why: `At ${gpu[0]} per second, ${2 * params} billion operations take a tiny fraction of a millisecond. Reading the ${2 * params} GB of 16-bit weights takes far longer.` },
          { text: 'Recomputing the keys and values of every earlier token at every pass', why: 'The KV cache stores those. Each pass computes keys and values only for its one new token.' },
          { text: 'Sampling the next token from the probabilities over the vocabulary', why: 'Sampling is one small softmax and a draw: tiny next to reading every weight of the model.' },
        ]),
        solution: [
          'A decode pass has one token in it, so each weight takes part in one multiply and one add, then is not needed again until the next pass.',
          `At 2 bytes per weight the pass reads about ${2 * params} GB, which takes far longer than the ${2 * params} billion operations do.`,
          'So the GPU spends a decode pass waiting on memory: the speed is set by the bytes to read, not the arithmetic.',
        ],
      };
    },
  },
  {
    id: 'upgrade',
    make(rng) {
      const kind = pick(rng, ['math', 'memory', 'prefill'] as const);
      const f = pick(rng, [2, 3, 4]);
      if (kind === 'prefill') {
        const P = pick(rng, [200, 500, 1000, 2000]);
        return {
          prompt: `Reading a ${P}-token prompt in one prefill pass takes far less than ${P} times as long as one decode pass. Why?`,
          answer: choice([
            { text: `Each weight read from memory is used for all ${P} tokens at once`, why: null },
            { text: 'The prefill skips most of the layers to save time', why: 'Every token goes through every layer, in prefill as in decode.' },
            { text: 'Prompt tokens are shorter than the tokens the model writes', why: 'Every token is one vector of the same size. The saving comes from how often each weight read is used.' },
            { text: 'The prefill reads the weights from the cache instead of memory', why: 'The cache holds keys and values, not weights. Prefill still reads every weight once.' },
          ]),
          solution: [
            'A decode pass reads every weight to use it once, for its single token.',
            `The prefill reads every weight once too, but uses it for all ${P} prompt tokens in the same pass.`,
            'Its memory traffic is shared across the prompt, so it is far cheaper per token.',
          ],
        };
      }
      const math = kind === 'math';
      const what = math ? `${f} times the arithmetic speed and the same memory speed` : `the same arithmetic speed and ${f} times the memory speed`;
      return {
        prompt: `A new GPU has ${what}. What happens to how many tokens per second it decodes for one user?`,
        answer: choice([
          { text: `Close to ${f} times as many`, why: math ? 'Decode passes wait on memory, not on arithmetic. Faster arithmetic only shortens the part that was already tiny.' : null },
          { text: 'Almost no change', why: math ? null : 'The memory reads are what a decode pass waits on, so faster memory speeds it up nearly in proportion.' },
          { text: `About ${f * f} times as many`, why: 'Tokens per second is memory speed over the model\'s bytes: it grows in proportion, not with the square.' },
          { text: 'Fewer: the faster part has to wait longer', why: 'Waiting more does not slow the slower part down. The time per pass is set by the slower part alone.' },
        ]),
        solution: math
          ? ['A decode pass reads every weight and uses each once, so its time is almost all memory reads.', 'Faster arithmetic leaves those reads as they were: tokens per second barely moves.']
          : ['A decode pass reads every weight and uses each once, so its time is almost all memory reads.', `Tokens per second is memory speed divided by the model's bytes, so it grows close to ${f} times.`],
      };
    },
  },
];

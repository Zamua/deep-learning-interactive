import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, pick } from '../../kit';
import { big, bigText, choice, traps } from '../../inference/kit';
import { TASKS } from './tasks';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const plus = (xs: number[]) => xs.map(big).join(' + ');

/** A prompt, a call size and a result size, small at first, then realistic. */
function sizes(rng: Rng, d: number): { P: number; c: number; r: number } {
  if (d < 0.35) return { P: pick(rng, [20, 30, 40, 50, 60]), c: pick(rng, [5, 10]), r: pick(rng, [5, 10, 15, 20]) };
  if (d < 0.7) return { P: 10 * int(rng, 3, 30), c: int(rng, 4, 15), r: 5 * int(rng, 2, 12) };
  return { P: 100 * int(rng, 2, 30), c: pick(rng, [10, 20, 30, 40]), r: pick(rng, [50, 100, 150, 200, 300]) };
}

export const generators: Generator[] = [
  {
    id: 'prefill',
    make(rng, d) {
      const { P, c, r } = sizes(rng, d);
      const n = d < 0.7 ? int(rng, 2, 3) : int(rng, 2, 4);
      const k = c + r;
      const cached = rng.int(2) === 1;
      const reads = Array.from({ length: n + 1 }, (_, t) => P + t * k);
      const plain = sum(reads);
      const kept = P + n * r;
      const setup = `An agent starts from a prompt of ${bigText(P)} tokens. The model makes ${n} tool calls of ${c} tokens, each followed by a result of ${r} tokens, then writes its answer.`;
      const turns = `The model runs ${n + 1} turns: one for each of the ${n} calls, and one more for the answer.`;
      if (d >= 0.7 && rng.int(3) === 0) {
        const v = plain - kept;
        return {
          prompt: `${setup} How many fewer tokens are prefilled in all with prefix caching than without a cache?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: plain, why: 'That is the total without a cache. Subtract what the cached prefix still prefills.' },
            { value: plain - (P + n * k), why: 'That prefills each call again under the cache. The call\'s keys and values were stored as the model wrote it.' },
            { value: kept, why: 'That is the total with the cache, not the saving.' },
          ]),
          solution: [
            turns,
            `Without a cache each turn reads the whole context: $${plus(reads)} = ${big(plain)}$.`,
            `With the cache, turn 1 reads the prompt and each later turn only its new result: $${plus([P, ...Array(n).fill(r)])} = ${big(kept)}$.`,
            `The saving is $${big(plain)} - ${big(kept)} = ${big(v)}$ tokens.`,
          ],
        };
      }
      if (cached) {
        return {
          prompt: `${setup} With prefix caching, how many tokens are prefilled in all?`,
          answer: { kind: 'number', value: kept },
          traps: traps(kept, [
            { value: P + n * k, why: 'That prefills every call too. The call\'s keys and values were stored as the model wrote it; only the result is new.' },
            { value: plain, why: 'That rereads the whole context every turn, as with no cache.' },
            { value: n * r, why: 'That leaves out turn 1, which has to prefill the prompt.' },
          ]),
          solution: [
            turns,
            `Turn 1 prefills the prompt: ${bigText(P)} tokens.`,
            `Each call's keys and values went into the cache as the model wrote it, so each later turn prefills only the new result: ${r} tokens.`,
            `In all $${plus([P, ...Array(n).fill(r)])} = ${big(kept)}$ tokens.`,
          ],
        };
      }
      return {
        prompt: `${setup} Without a cache, how many tokens are prefilled in all?`,
        answer: { kind: 'number', value: plain },
        traps: traps(plain, [
          { value: P + n * k, why: 'That is the context at the end, read once. Without a cache every turn reads all of the context so far.' },
          { value: (n + 1) * P, why: 'That rereads only the prompt. The calls and results so far are in the context too.' },
          { value: sum(reads.slice(0, n)), why: 'That leaves out the last turn, which reads the whole context before it writes the answer.' },
          { value: kept, why: 'That is the total with a cached prefix. Without a cache each turn reads everything again.' },
        ]),
        solution: [
          turns,
          `Each turn prefills the whole context so far. Turn 1 reads the prompt, ${bigText(P)} tokens.`,
          `Each call and its result add $${c} + ${r} = ${k}$ tokens, so every turn reads ${k} more than the one before: ${reads.map(bigText).join(', ')}.`,
          `In all $${plus(reads)} = ${big(plain)}$ tokens.`,
        ],
      };
    },
  },
  {
    id: 'context',
    make(rng, d) {
      const { P, c, r } = sizes(rng, d);
      const varied = d >= 0.5 && rng.int(2) === 0;
      const n = varied ? int(rng, 2, 3) : d < 0.35 ? int(rng, 1, 3) : int(rng, 2, 6);
      if (varied) {
        const cs = Array.from({ length: n }, () => Math.max(3, c + int(rng, -3, 3)));
        const rs = Array.from({ length: n }, () => Math.max(2, r + 5 * int(rng, -1, 2)));
        const v = P + sum(cs) + sum(rs);
        return {
          prompt: `An agent starts from a prompt of ${bigText(P)} tokens. Its calls take ${cs.join(', ')} tokens, and their results ${rs.join(', ')} tokens, in that order. How many tokens are in the context after the result of call ${n}?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: P + sum(rs), why: 'That leaves out the calls. Each call the model writes stays in the context.' },
            { value: P + sum(cs), why: 'That leaves out the results, which the program appends to the context.' },
            { value: sum(cs) + sum(rs), why: 'That leaves out the prompt, which is still at the start of the context.' },
            { value: v - cs[n - 1]! - rs[n - 1]!, why: `That stops one turn short: it leaves out call ${n} and its result.` },
          ]),
          solution: [
            'Nothing is removed: the context is the prompt plus every call and result so far.',
            `The calls add $${plus(cs)} = ${big(sum(cs))}$ tokens and the results $${plus(rs)} = ${big(sum(rs))}$.`,
            `In all $${big(P)} + ${big(sum(cs))} + ${big(sum(rs))} = ${big(v)}$ tokens.`,
          ],
        };
      }
      const k = c + r;
      const v = P + n * k;
      return {
        prompt: `An agent starts from a prompt of ${bigText(P)} tokens. On every turn the model writes a call of ${c} tokens and the program appends a result of ${r} tokens. How many tokens are in the context after turn ${n}?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: P + n * r, why: 'That leaves out the calls. Each call the model writes stays in the context.' },
          { value: P + n * c, why: 'That leaves out the results, which the program appends to the context.' },
          { value: n * k, why: 'That leaves out the prompt, which is still at the start of the context.' },
          { value: P + (n - 1) * k, why: `That stops one turn short: it is the context when turn ${n} starts.` },
        ]),
        solution: [
          `Each turn adds a call and a result: $${c} + ${r} = ${k}$ tokens.`,
          `Nothing is removed, so after turn ${n} the context holds the prompt plus ${n} of those: $${big(P)} + ${n} \\times ${k} = ${big(v)}$ tokens.`,
        ],
      };
    },
  },
  {
    id: 'stop',
    make(rng) {
      const task = pick(rng, TASKS);
      const L = pick(rng, [5, 8, 10, 12, 20]);
      const kind = pick(rng, ['call', 'answer', 'limit'] as const);
      const t = kind === 'limit' ? L : kind === 'answer' ? int(rng, 3, L - 1) : int(rng, 1, L - 1);
      const i = kind === 'call' && t === 1 ? 0 : 1;
      const wrote = kind === 'answer' ? `“${task.answer}”, with no call in it` : `the call \`${task.calls[i]}\``;
      const opts = [
        'Run the call, append its result, and run the model again',
        'Stop: the model has written its final answer',
        'Stop: the step limit is reached',
        'Run the model again without running anything',
      ];
      const why: Record<typeof kind, (string | null)[]> = {
        call: [
          null,
          'The turn ended in a call, not an answer: the model is still asking for something.',
          `This was turn ${t} of at most ${L}, so the limit is not reached.`,
          'Without running the call, no result would be in view, and the model would face the same context again.',
        ],
        answer: [
          'There is no call in this turn to run. A turn that ends in an answer ends the loop.',
          null,
          `This was turn ${t} of at most ${L}. The loop ends because the model answered.`,
          'The loop is done: running the model again would only add text after the answer.',
        ],
        limit: [
          `Turn ${L} was the last turn the program allows, so the loop ends here.`,
          'The model wrote a call, not an answer. The loop ends because of the limit.',
          null,
          `Turn ${L} was the last turn the program allows: there is no next one.`,
        ],
      };
      return {
        prompt: `An agent is asked “${task.q}” and allowed at most ${L} turns. On turn ${t}, the model writes ${wrote}. What does the program do next?`,
        answer: choice(opts.map((text, j) => ({ text, why: why[kind][j]! }))),
        solution:
          kind === 'call'
            ? ['The turn ended in a call, so the model is not done.', `Turn ${t} is under the limit of ${L}, so the program runs the call, appends the result, and starts turn ${t + 1}.`]
            : kind === 'answer'
              ? ['The turn ended in plain text with no call: the final answer.', 'A turn that ends in an answer instead of a call ends the loop.']
              : [`Turn ${L} ended in a call, but the program allows at most ${L} turns.`, 'The step limit ends the loop, answer or not.'],
      };
    },
  },
  {
    id: 'cache',
    make(rng) {
      const task = pick(rng, TASKS);
      const kind = pick(rng, ['why', 'what', 'grow'] as const);
      const setup = `An agent is asked “${task.q}” Turn 1 writes the call \`${task.calls[0]}\`, and the program appends the result, \`${task.res[0]}\`.`;
      if (kind === 'why') {
        return {
          prompt: `${setup} With prefix caching, the keys and values from turn 1 are reused on turn 2. Why are they still right?`,
          answer: choice([
            { text: 'Appending tokens never changes the keys and values of earlier tokens', why: null },
            { text: 'The weights are updated after each turn to match the new context', why: 'No weight changes while an agent runs. The stored keys and values stay right because of the causal mask.' },
            { text: 'They are recomputed at the start of every turn anyway', why: 'Then nothing would be saved. They are kept because appending tokens cannot change them.' },
            { text: 'Attention on turn 2 reads only the newest result', why: 'Every position attends to all the tokens before it. The earlier keys and values are still read; they are just not computed again.' },
          ]),
          solution: [
            'With the causal mask, a token attends only to itself and the tokens before it.',
            'So tokens appended later never change an earlier token\'s keys and values.',
            'The ones stored on turn 1 are exactly what turn 2 would compute again, so they can be reused.',
          ],
        };
      }
      if (kind === 'what') {
        return {
          prompt: `${setup} With prefix caching, what does turn 2 prefill?`,
          answer: choice([
            { text: 'Only the result the program just appended', why: null },
            { text: 'The whole context: the prompt, the call and the result', why: 'That is turn 2 without a cache. The prompt and the call are already in it.' },
            { text: 'The call and the result from turn 1', why: 'The call\'s keys and values went into the cache as the model wrote it, one decode pass per token.' },
            { text: 'Only the prompt, read again at the start of every turn', why: 'The prompt was prefilled on turn 1, and its keys and values were kept.' },
          ]),
          solution: [
            'Turn 1 prefilled the prompt and stored its keys and values.',
            'Writing the call took one decode pass per token, and each pass stored that token\'s keys and values too.',
            'The result came from the program, so the model has not read it yet: turn 2 prefills only the result.',
          ],
        };
      }
      return {
        prompt: `${setup} Without a cache, each later turn prefills more tokens than the one before. Why?`,
        answer: choice([
          { text: 'Each turn rereads a context that keeps growing', why: null },
          { text: 'Each tool takes longer to run than the one before', why: 'Running a tool is not prefill. Prefill is the model reading its context.' },
          { text: 'The model adds weights for each result it reads', why: 'The weights are fixed. What grows is the context that every turn must read.' },
          { text: 'Each call the model writes is longer than the last', why: 'Even with equal calls, every turn appends a call and a result, and every turn reads all of it.' },
        ]),
        solution: [
          'Nothing is removed: each turn appends a call and its result to the context.',
          'Without a cache, each turn starts with a prefill of the whole context so far.',
          'So every turn reads everything the turn before read, plus the new call and result.',
        ],
      };
    },
  },
];

import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { num, pick } from '../../kit';
import { G, N, clean, traps, whys, words } from '../kit';

const M = '\\sym{m}{m}';
const V = '\\sym{v}{v}';

/** GB per GPU at each ZeRO stage (0 is plain data parallelism), for n billion parameters on g GPUs. */
const perGpu = (n: number, g: number) => [16 * n, 4 * n + (12 * n) / g, 2 * n + (14 * n) / g, (16 * n) / g].map(clean);

/** A size and GPU count whose per-GPU memory at every stage has at most two decimals. */
function setup(rng: Rng, d: number): { n: number; g: number; mem: number[] } {
  for (;;) {
    const n = pick(rng, d < 0.35 ? [1, 2, 4, 8] : [3, 6, 7, 8, 12, 13, 24, 70]);
    const g = pick(rng, d < 0.35 ? [2, 4, 8] : [4, 8, 16, 32, 64]);
    const mem = perGpu(n, g);
    if (mem.every((m) => Number.isInteger(clean(m * 100)))) return { n, g, mem };
  }
}

/** How a prompt names a stage: by what it shards when easy, by number when harder. */
const named = (s: number, d: number): string =>
  d >= 0.5
    ? `ZeRO stage ${s}`
    : ['nothing sharded', 'only the optimizer state sharded', 'the optimizer state and the gradients sharded', 'everything sharded'][s]!;

/** Stage 1 or 2, one step per line: the whole part, the split part, the sum. */
const breakdown = (s: 1 | 2, n: number, g: number, v: number, full: number): string[] => {
  const whole = s === 1 ? 4 : 2;
  const split = clean(((16 - whole) * n) / g);
  return [
    s === 1
      ? `Whole on every GPU: the 16-bit weights and gradients, $2 + 2 = 4$ bytes per parameter: $4 \\times ${num(n)} = ${num(4 * n)}$ GB.`
      : `Whole on every GPU: the 16-bit weights, 2 bytes per parameter: $2 \\times ${num(n)} = ${num(2 * n)}$ GB.`,
    s === 1
      ? `Split ${g} ways: the 12 bytes of optimizer state: $12 \\times ${num(n)} / ${g} = ${num(split)}$ GB.`
      : `Split ${g} ways: the gradients and optimizer state, $2 + 12 = 14$ bytes: $14 \\times ${num(n)} / ${g} = ${num(split)}$ GB.`,
    `In all: $${num(whole * n)} + ${num(split)} = ${num(v)}$ GB per GPU, against $${num(full)}$ GB without sharding.`,
  ];
};

export const generators: Generator[] = [
  {
    id: 'full',
    make(rng, d) {
      const { n, g, mem } = setup(rng, d);
      const v = mem[3]!;
      return {
        prompt: `A model with ${words(n * 1e9)} parameters trains with Adam on $${G} = ${g}$ GPUs, with ${named(3, d)}. How many GB does each GPU hold?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: mem[0]!, why: 'That is a full copy on every GPU, as plain data parallelism keeps. Sharding gives each GPU one slice.' },
          { value: (2 * n) / g, why: 'That shards only the 16-bit weights. Stage 3 splits all 16 bytes per parameter.' },
          { value: mem[1]!, why: 'That shards only the optimizer state, as stage 1 does. Stage 3 splits the weights and gradients too.' },
        ]),
        solution: [`Every byte is split ${g} ways: $16${N} / ${G}$.`, `$16 \\times ${num(n)} / ${g} = ${num(v)}$ GB per GPU.`],
      };
    },
  },
  {
    id: 'stage',
    make(rng, d) {
      const { n, g, mem } = setup(rng, d);
      const s = pick(rng, [1, 2] as const);
      const v = mem[s]!;
      return {
        prompt: `A model with ${words(n * 1e9)} parameters trains with Adam on $${G} = ${g}$ GPUs, with ${named(s, d)}. How many GB does each GPU hold?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: mem[3]!, why: `That shards everything, as stage 3 does. Stage ${s} keeps the 16-bit weights${s === 1 ? ' and gradients' : ''} whole on every GPU.` },
          { value: mem[0]!, why: `That is a full copy with nothing sharded. Stage ${s} splits the ${s === 1 ? 'optimizer state' : 'optimizer state and gradients'} ${g} ways.` },
          { value: mem[3 - s]!, why: `That is stage ${3 - s}. Stage ${s} shards ${s === 1 ? 'only the optimizer state' : 'the gradients as well as the optimizer state'}.` },
        ]),
        solution: breakdown(s, n, g, v, mem[0]!),
      };
    },
  },
  {
    id: 'which',
    make(rng, d) {
      const { n, g } = setup(rng, d);
      const s = pick(rng, [1, 2, 3]);
      const options = ['Only the optimizer state: the master copy, $' + M + '$ and $' + V + '$', 'The optimizer state and the gradients', 'Everything: the weights, the gradients and the optimizer state', 'Only the 16-bit weights'];
      const correct = s - 1;
      const what = ['the optimizer state alone', 'the optimizer state and the gradients', 'the weights, the gradients and the optimizer state'];
      return {
        prompt: `A model with ${words(n * 1e9)} parameters trains with Adam on $${G} = ${g}$ GPUs, using ZeRO stage ${s}. Which parts are split among the GPUs?`,
        answer: {
          kind: 'choice',
          options,
          correct,
          why: whys(4, correct, (i) => (i === 3 ? `Every stage starts with the optimizer state, the largest part at 12 of the 16 bytes. The weights are sharded only in stage 3, last. Stage ${s} shards ${what[s - 1]}.` : `That is stage ${i + 1}. Stage ${s} shards ${what[s - 1]}.`)),
        },
        solution: [
          'Stage 1 shards the optimizer state (12 bytes per parameter), stage 2 adds the gradients (2 more), and stage 3 adds the weights (the last 2).',
          `So stage ${s} shards ${what[s - 1]}, and every other part stays whole on each GPU.`,
        ],
      };
    },
  },
  {
    id: 'versus',
    make(rng, d) {
      const { n, g, mem } = setup(rng, d);
      if (d < 0.35) {
        return {
          prompt: `A model with ${words(n * 1e9)} parameters trains on $${G} = ${g}$ GPUs. Next to plain data parallelism, how many times less memory does each GPU need with everything sharded?`,
          answer: { kind: 'number', value: g },
          traps: traps(g, [{ value: 16, why: '16 is the bytes per parameter, which every stage still stores somewhere. Sharding divides them among the GPUs.' }]),
          solution: [`Plain data parallelism keeps all 16 bytes per parameter on every GPU; stage 3 keeps one slice of them per GPU.`, `One slice in ${g}: ${g} times less memory each.`],
        };
      }
      const v = clean(mem[0]! - mem[3]!);
      return {
        prompt: `A model with ${words(n * 1e9)} parameters trains with Adam on $${G} = ${g}$ GPUs. Next to plain data parallelism, how many GB does each GPU save with ${named(3, d)}?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: mem[3]!, why: 'That is what each GPU still holds with sharding. The saving is the full copy minus that.' },
          { value: mem[0]!, why: 'That is the full copy. Each GPU still holds its own slice, so subtract that.' },
        ]),
        solution: [
          `Plain data parallelism: $16 \\times ${num(n)} = ${num(mem[0]!)}$ GB on every GPU.`,
          `Stage 3: $${num(mem[0]!)} / ${g} = ${num(mem[3]!)}$ GB each.`,
          `Saved: $${num(mem[0]!)} - ${num(mem[3]!)} = ${num(v)}$ GB per GPU.`,
        ],
      };
    },
  },
];

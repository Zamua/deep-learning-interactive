import type { Generator } from '../../../mastery/domain/types';
import { big, clean, commas, int, ints, num, pick, traps, vtraps } from '../../kit';
import { G, words } from '../kit';

const vecTex = (xs: readonly number[]) => `[${xs.map((x) => num(clean(x))).join(',\\ ')}]`;

export const generators: Generator[] = [
  {
    id: 'global-batch',
    make(rng, d) {
      const g = pick(rng, d < 0.35 ? [2, 4, 8] : [4, 8, 16, 32, 64]);
      const b = pick(rng, d < 0.35 ? [8, 16, 32] : [8, 16, 32, 64, 128]);
      const B = g * b;
      const ask = d < 0.35 ? 0 : rng.int(3);
      if (ask === 0) {
        return {
          prompt: `$${G} = ${g}$ GPUs each work on ${b} examples per step. How many examples does one step's gradient average over?`,
          answer: { kind: 'number', value: B },
          traps: traps(B, [
            { value: b, why: `That is one GPU's slice. The step averages the gradients of all ${g} slices: ${g} times as many examples.` },
            { value: g + b, why: 'The slices are added up, not their sizes: each of the GPUs brings its own examples, so multiply.' },
          ]),
          solution: [`Each GPU works on its own ${b} examples, and the step averages all of their gradients.`, `$\\symB = ${g} \\times ${b} = ${big(B)}$ examples.`],
        };
      }
      if (ask === 1) {
        return {
          prompt: `A batch of $\\symB = ${big(B)}$ examples is split evenly across $${G} = ${g}$ GPUs. How many examples does each GPU work on per step?`,
          answer: { kind: 'number', value: b },
          traps: traps(b, [
            { value: B, why: 'That is the whole batch. Each GPU gets only its own slice of it.' },
            { value: B * g, why: `That multiplies. The batch is split ${g} ways, so divide.` },
          ]),
          solution: [`The ${g} GPUs share the batch evenly.`, `$${big(B)} / ${g} = ${b}$ examples each.`],
        };
      }
      return {
        prompt: `A step's gradient averages over $\\symB = ${big(B)}$ examples, and each GPU works on ${b} of them. How many GPUs are there?`,
        answer: { kind: 'number', value: g },
        traps: traps(g, [{ value: B * b, why: `That multiplies. Each GPU holds ${b} of the ${commas(B)}, so divide.` }]),
        solution: [`$\\symB = ${G} \\times ${b}$, so $${G} = ${big(B)} / ${b} = ${g}$.`],
      };
    },
  },
  {
    id: 'steps',
    make(rng, d) {
      const g = pick(rng, d < 0.35 ? [2, 4] : [4, 8, 16, 32]);
      const b = pick(rng, d < 0.35 ? [10, 25, 50] : [16, 32, 64, 50, 100]);
      const s = pick(rng, d < 0.35 ? [10, 20, 40, 100] : [50, 100, 125, 200, 250, 400]);
      const B = g * b;
      const n = s * B;
      return {
        prompt: `A dataset has $\\symN = ${big(n)}$ examples, and $${G} = ${g}$ GPUs each work on ${b} of them per step. How many steps make one epoch?`,
        answer: { kind: 'number', value: s },
        traps: traps(s, [
          { value: n / b, why: `That counts each GPU's slice as a step. All ${g} slices are processed in the same step, so one step covers ${commas(B)} examples.` },
          { value: n / g, why: `That divides by the number of GPUs only. One step covers ${b} examples on each of them: ${commas(B)} in all.` },
        ]),
        solution: [
          `One step covers every GPU's slice: $\\symB = ${g} \\times ${b} = ${big(B)}$ examples.`,
          `An epoch is one pass over all $\\symN$: $${big(n)} / ${big(B)} = ${s}$ steps.`,
        ],
      };
    },
  },
  {
    id: 'average',
    make(rng, d) {
      const g = pick(rng, d < 0.5 ? [2, 3, 4] : [2, 4]);
      if (d < 0.5) {
        for (;;) {
          const gs = ints(rng, g, d < 0.25 ? 0 : -4, 6);
          const sum = gs.reduce((a, b) => a + b, 0);
          if (sum % g !== 0) continue;
          const v = sum / g;
          return {
            prompt: `$${G} = ${g}$ GPUs train one model, each on its own slice of the batch. For one weight, their gradients are ${gs.map((x, i) => `$${num(x)}$ on GPU ${i}`).join(', ')}. What gradient does every GPU use for its step?`,
            answer: { kind: 'number', value: v },
            traps: traps(v, [
              { value: sum, why: `That is the sum. The step uses the average, the sum divided by ${g}: the gradient of the whole batch.` },
              { value: gs[0]!, why: 'That is GPU 0\'s own gradient. Every GPU uses the same average, so the copies stay identical.' },
            ]),
            solution: [`Average the ${g} gradients: $(${gs.map((x) => (x < 0 ? `(${x})` : String(x))).join(' + ')}) / ${g} = ${sum} / ${g} = ${num(v)}$.`, 'Every GPU steps with this same gradient, so all the copies stay identical.'],
          };
        }
      }
      const k = d < 0.75 ? 2 : 3;
      for (;;) {
        const rows = Array.from({ length: g }, () => ints(rng, k, -4, 6));
        const sums = Array.from({ length: k }, (_, j) => rows.reduce((a, r) => a + r[j]!, 0));
        if (sums.some((s) => (s * 2) % g !== 0)) continue;
        const v = sums.map((s) => clean(s / g));
        return {
          prompt: `$${G} = ${g}$ GPUs train one model, each on its own slice of the batch. Their gradients for the same ${k} weights are ${rows.map((r, i) => `$${vecTex(r)}$ on GPU ${i}`).join(', ')}. What gradient does every GPU use for its step?`,
          answer: { kind: 'vector', value: v },
          traps: vtraps(v, [
            { value: sums, why: `That is the sum. The step uses the average: divide each entry by ${g}.` },
            { value: rows[0]!, why: 'That is GPU 0\'s own gradient. Every GPU uses the same average, so the copies stay identical.' },
          ]),
          solution: [
            `Average entry by entry over the ${g} GPUs: the sums are $${vecTex(sums)}$.`,
            `Divide by ${g}: $${vecTex(v)}$, the gradient every GPU uses.`,
          ],
        };
      }
    },
  },
  {
    id: 'exchange',
    make(rng, d) {
      const g = pick(rng, [4, 8, 16, 64, 256]);
      const n = pick(rng, [1, 7, 13, 70, 0.35, 1.5]) * 1e9;
      const b = pick(rng, [16, 32, 64]);
      const kind = d < 0.35 ? 0 : rng.int(3);
      const setup = `Data parallelism trains a model with ${words(n)} parameters on $${G} = ${g}$ GPUs, ${b} examples per GPU per step.`;
      if (kind === 0) {
        return {
          prompt: `${setup} What do the GPUs send each other every step?`,
          answer: {
            kind: 'choice',
            options: ['Their gradients, to average them', 'Their slices of the batch', 'Their losses', 'Nothing: each steps with its own gradient'],
            correct: 0,
            why: [null, 'The examples never move: each GPU keeps its own slice, and only the result of its work travels.', 'A loss is one number per GPU: it says how well the weights did, not which way to move each of them.', 'Then each copy would take a different step, and the copies would drift apart.'],
          },
          solution: ['Each GPU computes a gradient on its own slice.', 'The GPUs send each other their gradients and average them, so every copy takes the same step.'],
        };
      }
      if (kind === 1) {
        return {
          prompt: `${setup} After each averaged step, how do the ${g} copies of the weights compare?`,
          answer: {
            kind: 'choice',
            options: ['They are identical', 'Each is a little different, fitted to its own slice', 'Only GPU 0 has the new weights, until it sends them out', 'They must be averaged before the next step to agree'],
            correct: 0,
            why: [null, 'Each slice shapes only its own gradient. The step uses the average, the same on every GPU.', 'Every GPU has the averaged gradient, so each takes the step itself: nothing needs to be sent afterwards.', 'They already agree: they started the same and took the same step, so only the gradients ever need averaging.'],
          },
          solution: ['The copies start identical.', 'Every GPU steps with the same averaged gradient, so they stay identical after every step.'],
        };
      }
      const options = [`${words(n)}: one per parameter`, `${b}: one per example in its slice`, '1: its loss', `${g}: one per GPU`];
      return {
        prompt: `${setup} How many numbers does each GPU contribute to the average every step?`,
        answer: {
          kind: 'choice',
          options,
          correct: 0,
          why: [null, 'Its slice\'s gradients are already averaged on the GPU: what it sends is one gradient per weight.', 'A loss alone cannot say which way to move each weight: the average needs the whole gradient.', 'Each GPU sends its whole gradient, which has one entry per parameter, however many GPUs there are.'],
        },
        solution: ['The gradient has one entry per parameter.', `So each GPU contributes ${words(n)} numbers every step, whatever the batch.`],
      };
    },
  },
];

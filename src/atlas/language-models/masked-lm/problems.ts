import type { Generator } from '../../../mastery/domain/types';
import { int, pick } from '../../kit';
import { big, commas, lit, lits, traps } from '../kit';

const SENTENCES = [
  ['the', 'cat', 'sat', 'on', 'a', 'mat'],
  ['we', 'like', 'to', 'read', 'old', 'books'],
  ['birds', 'fly', 'south', 'every', 'cold', 'winter'],
  ['she', 'wrote', 'code', 'all', 'night', 'long'],
  ['rain', 'fell', 'on', 'the', 'quiet', 'town'],
  ['my', 'dog', 'loves', 'long', 'walks', 'outside'],
  ['he', 'drank', 'hot', 'tea', 'every', 'morning'],
];

export const generators: Generator[] = [
  {
    id: 'context',
    make(rng, d) {
      const w = pick(rng, SENTENCES).slice(0, d < 0.5 ? 5 : 6);
      const i = int(rng, 1, w.length - 2);
      const causal = rng.int(2) === 0;
      const left = w.slice(0, i);
      const right = w.slice(i + 1);
      const options = [lits(left), lits([...left, ...right]), lits(right), lits(w.slice(0, i + 1))];
      const correct = causal ? 0 : 1;
      const why: (string | null)[] = causal
        ? [
            null,
            `A causal model never sees the right side: the causal mask hides every token after the one it predicts.`,
            'A causal model reads left to right, so it sees the tokens before the one it predicts, not after.',
            `That includes ${lit(w[i]!)}, the very token it must predict. It sees only the tokens before it.`,
          ]
        : [
            'That is what a causal model sees. A masked model has no causal mask, so it reads both sides of the hidden token.',
            null,
            'A masked model reads both sides of the hidden token, not only the right.',
            `That leaves out the right side and includes ${lit(w[i]!)}, which is hidden: the model must recover it.`,
          ];
      return {
        prompt: causal
          ? `A causal model like GPT reads ${lits(w)}. Which tokens can it use to predict ${lit(w[i]!)}?`
          : `A masked model like BERT gets ${lits(w)} with only ${lit(w[i]!)} hidden. Which tokens can it use to predict it?`,
        answer: { kind: 'choice', options, correct, why },
        solution: causal
          ? [`A causal model predicts each token from the tokens before it: the causal mask hides everything later.`, `So ${lit(w[i]!)} is predicted from ${lits(left)}.`]
          : [`A masked model has no causal mask: every position sees every other, on both sides.`, `Only the hidden token is missing, so it predicts ${lit(w[i]!)} from ${lits([...left, ...right])}.`],
      };
    },
  },
  {
    id: 'mask-count',
    make(rng, d) {
      const n = d < 0.5 ? pick(rng, [20, 40, 60, 80, 100, 200]) : pick(rng, [120, 300, 500, 1000, 2000]);
      const kind = d < 0.35 ? 0 : rng.int(3);
      const hid = Math.round(0.15 * n);
      if (kind === 0) {
        return {
          prompt: `A masked language model hides 15% of the tokens of each sequence. A sequence has ${commas(n)} tokens. How many does it hide?`,
          answer: { kind: 'number', value: hid },
          traps: traps(hid, [
            { value: 15, why: 'That is the percentage, not the count. Take 15% of the sequence.' },
            { value: n - hid, why: 'That is how many stay visible. 15% of the tokens are hidden.' },
          ]),
          solution: [`15% of ${commas(n)} is $0.15 \\times ${big(n)} = ${big(hid)}$ hidden tokens.`, 'Only these positions are scored: the loss asks the model to recover each one.'],
        };
      }
      if (kind === 1) {
        const B = pick(rng, [2, 4, 8, 10, 16, 32]);
        const v = B * hid;
        return {
          prompt: `A masked language model hides 15% of the tokens of every sequence. A batch holds ${B} sequences of ${commas(n)} tokens. How many positions in the batch get a loss?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: hid, why: `That is one sequence. Each of the ${B} sequences has its own hidden tokens.` },
            { value: B * n, why: 'That is every position, as in a causal model. A masked model is scored only on the tokens it hid.' },
          ]),
          solution: [`Each sequence hides $0.15 \\times ${big(n)} = ${big(hid)}$ tokens, and only those are scored.`, `$${B} \\times ${big(hid)} = ${big(v)}$ positions with a loss.`],
        };
      }
      const v = n - hid;
      return {
        prompt: `A causal model and a masked model, which hides 15% of the tokens, each train on the same sequence of ${commas(n)} tokens. How many more positions with a loss does the causal model get?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: hid, why: 'That is how many positions the masked model is scored on. The causal model is scored on all of them.' },
          { value: n, why: 'That is the causal model\'s count alone. Subtract the masked model\'s hidden tokens.' },
        ]),
        solution: [`The causal model predicts every position: ${commas(n)} losses.`, `The masked model is scored only on its hidden tokens: $0.15 \\times ${big(n)} = ${big(hid)}$.`, `The difference: $${big(n)} - ${big(hid)} = ${big(v)}$.`],
      };
    },
  },
  {
    id: 'attend-count',
    make(rng, d) {
      const n = d < 0.5 ? int(rng, 5, 10) : pick(rng, [64, 128, 512, 1024]);
      const i = d < 0.5 ? int(rng, 1, n - 2) : int(rng, 3, 60);
      const causal = rng.int(2) === 0;
      const v = causal ? i + 1 : n;
      const kind = causal ? 'a causal model like GPT' : 'a masked model like BERT';
      return {
        prompt: `In ${kind}, a sequence has ${commas(n)} tokens at positions 0 to ${commas(n - 1)}. How many positions can position ${i} attend to?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: causal ? i : n - 1, why: 'That leaves out the position itself. Every token attends to itself too.' },
          { value: causal ? n : i + 1, why: causal ? 'That ignores the causal mask, which hides every later position.' : 'That applies a causal mask. A masked model has none: every position attends to every position.' },
          ...(causal ? [{ value: n - i, why: 'That counts the positions from it to the end: the causal mask keeps the ones before it.' }] : []),
        ]),
        solution: causal
          ? [`The causal mask lets position ${i} attend only to itself and earlier positions.`, `Positions 0 to ${i}: ${i + 1} in all.`]
          : ['A masked model uses no causal mask: every position attends to every position.', `So position ${i} attends to all ${commas(n)}.`],
      };
    },
  },
  {
    id: 'which-kind',
    make(rng) {
      const tasks: [string, number][] = [
        ['write a story one token after another', 0],
        ['finish the rest of an email from its first line', 0],
        ['continue a poem from its first verse', 0],
        ['answer a question by writing out a reply', 0],
        ['fill in a word missing from the middle of a sentence', 1],
        ['guess a blanked-out word in a form, given the text before and after it', 1],
        ['recover a hidden word in the middle of a line of text', 1],
        ['suggest the next word as someone types a message', 0],
        ['restore a word smudged out of the middle of an old letter', 1],
        ['autocomplete a line of code from what is typed so far', 0],
      ];
      const [task, correct] = pick(rng, tasks);
      return {
        prompt: `Two models were pretrained on the same text: a causal one, like GPT, and a masked one, like BERT. Which suits a task that needs to ${task}?`,
        answer: {
          kind: 'choice',
          options: ['The causal model: it predicts each token from the ones before it', 'The masked model: it predicts hidden tokens from both sides', 'Either one: they learned the same thing from the same text'],
          correct,
          why: [
            correct === 1 ? 'A causal model never sees the words after a gap, so it cannot use the right side to fill one in.' : null,
            correct === 0 ? 'Generating goes left to right with nothing on the right yet; a masked model was trained to fill hidden tokens with both sides visible.' : null,
            'The same text, but different jobs: one predicts the next token from the left only, the other fills in hidden tokens from both sides.',
          ],
        },
        solution: correct === 0
          ? ['Generating writes one token at a time, each from the tokens before it, with nothing yet on its right.', 'That is exactly the causal model\'s training task, so it suits generation.']
          : ['Filling a gap in the middle can use the words on both sides of it.', 'That is exactly the masked model\'s training task: recover hidden tokens from both sides.'],
      };
    },
  },
];

import type { Generator } from '../../../mastery/domain/types';
import { num, pick, round } from '../../kit';
import { big, clean, commas, fx, lossLog, texTable, traps, whys } from '../kit';

export const generators: Generator[] = [
  {
    id: 'stop-epoch',
    make(rng, d) {
      const R = lossLog(rng, d);
      const rows = R.train.map((t, i) => [R.epoch(i), fx(t, 2), fx(R.val[i]!, 2)]);
      const v = R.epoch(R.best);
      const last = R.epoch(R.n - 1);
      return {
        prompt: `A model's loss is measured on the training and validation splits every ${R.every === 1 ? 'epoch' : `${R.every} epochs`}:\n\n$$${texTable(['\\text{epoch}', '\\text{train}', '\\text{val}'], rows)}$$\n\nWhich epoch's weights should you keep?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: last, why: 'That is where the training loss is lowest. Training loss keeps falling while the model memorizes; keep the weights where the validation loss is lowest.' },
          { value: R.epoch(R.best + 1), why: 'That is the first checkpoint where validation loss went up. The best weights came one checkpoint earlier.' },
          { value: R.epoch(0), why: 'That is the start, where both losses are highest. Validation loss keeps improving for a while after it.' },
        ]),
        solution: [
          'Training loss falls at every checkpoint, so it cannot say when to stop.',
          `Validation loss falls to $${fx(R.val[R.best]!, 2)}$ at epoch ${v}, then rises: $${R.val.slice(R.best).map((x) => fx(x, 2)).join(',\\ ')}$.`,
          `So keep the weights from epoch ${v}. After it the model fits quirks of its training examples and does worse on new data.`,
        ],
      };
    },
  },
  {
    id: 'diagnose',
    make(rng, d) {
      const kind = rng.int(3);
      const L0 = pick(rng, [2.3, 1.8, 1.6, 2.1]);
      const good = round(L0 * pick(rng, [0.15, 0.2]), 2);
      const tr = kind === 0 ? round(L0 * (0.75 + 0.15 * rng.next()), 2) : kind === 1 ? round(0.01 + 0.06 * rng.next(), 2) : round(good + 0.02 + 0.1 * rng.next(), 2);
      const va = kind === 0 ? round(tr + 0.02 + 0.06 * rng.next(), 2) : kind === 1 ? round(L0 * (0.5 + 0.25 * rng.next()), 2) : round(tr + 0.03 + 0.06 * rng.next(), 2);
      const trend = d >= 0.5
        ? [' Both losses are still about where they were five epochs ago.', ' Over the last five epochs the training loss kept falling while the validation loss rose.', ' Both have been about steady for the last five epochs.'][kind]!
        : '';
      const a = `$${fx(tr, 2)}$`;
      const b = `$${fx(va, 2)}$`;
      const reasons: string[][] = [
        ['', `Overfitting needs a model that fits its training data, and the training loss is still ${a}, not far below the starting ${num(L0)}.`, `Training and validation agree, but both are far above the ${num(good)} a good model reaches: the model has not fit even the examples it trains on.`],
        [`Underfitting shows in the training loss, and it is ${a}: the model fits its training data almost perfectly.`, '', `The gap is the problem: ${a} on training against ${b} on validation means it memorized its training examples.`],
        [`The training loss is ${a}, near the ${num(good)} a good model reaches, so the model does fit its training data.`, `Overfitting shows as a large gap, and ${a} against ${b} is a small one: it does about as well on new data.`, ''],
      ];
      return {
        prompt: `Training started at a loss of $${num(L0)}$, and a good model on this data reaches about $${num(good)}$. After training, the training loss is ${a} and the validation loss is ${b}.${trend} Which describes the model?`,
        answer: {
          kind: 'choice',
          options: ['Underfitting: it has not fit the training data', 'Overfitting: it fits the training data but not new data', 'Neither: it does about as well on new data as on training data'],
          correct: kind,
          why: whys(3, kind, (i) => reasons[kind]![i]!),
        },
        solution: [
          `Training: ${a}. Validation: ${b}. A good model: about $${num(good)}$.`,
          [
            `Training against a good model: ${a} is far above $${num(good)}$, so the model has not fit its training data.`,
            `Training against a good model: ${a} is below even $${num(good)}$, so the model fits its training examples almost perfectly.`,
            `Training against a good model: ${a} is near $${num(good)}$, so the model fits its training data.`,
          ][kind]!,
          [
            `Validation against training: ${b} is close to ${a}, a small gap.`,
            `Validation against training: ${b} is far above ${a}, a large gap.`,
            `Validation against training: ${b} is close behind ${a}, a small gap, which is normal.`,
          ][kind]!,
          [
            'High and close together: underfitting.',
            'Fits its training data but not new data: overfitting.',
            'Near a good model and close together: neither. It does about as well on new data.',
          ][kind]!,
        ],
      };
    },
  },
  {
    id: 'split-role',
    make(rng) {
      const tasks: [string, number][] = [
        ['compute the gradient for each step', 0],
        ['fit the weights', 0],
        ['update the weights by gradient descent', 0],
        ['choose the learning rate', 1],
        ['decide which epoch to stop at', 1],
        ['choose the batch size', 1],
        ['pick the better of two training runs', 1],
        ['decide how many epochs to train for', 1],
        ['compare two learning rates', 1],
        ['report the final loss, once, at the very end', 2],
        ['estimate how the finished model will do on new data', 2],
        ['give the one number that goes in the paper', 2],
      ];
      const [task, correct] = pick(rng, tasks);
      const reasons: string[][] = [
        ['', 'The validation split is held out for choices, so its numbers stay honest. The weights are fit on the training split only.', 'The test split is used once, at the end. Training on it leaves no unseen data to report on.', 'Then the validation and test examples are trained on, and nothing unseen is left to measure with.'],
        ['Training loss rewards memorizing: judged on it, the most overfit setting always wins.', '', 'Choosing with the test split makes its number optimistic: it is no longer unseen data.', 'Pooled data includes the training examples, so the most overfit choice would look best.'],
        ['Training numbers measure examples the model has already fit, so they overstate how it does on new data.', 'The validation split was used to make choices, so the model is tuned to it and its number is a little optimistic. The test split is untouched.', '', 'Pooled data includes the training examples, which overstate how well the model does.'],
      ];
      const sol = [
        'The training split fits the weights: every gradient comes from it.',
        'The validation split makes choices: the learning rate, the batch size, when to stop, which run to keep.',
        'The test split is held back and used once, at the end, for the number you report.',
      ];
      return {
        prompt: `Your data is split at random into training, validation and test sets. Which split do you use to ${task}?`,
        answer: {
          kind: 'choice',
          options: ['The training split', 'The validation split', 'The test split', 'All three, pooled together'],
          correct,
          why: whys(4, correct, (i) => reasons[correct]![i]!),
        },
        solution: [...sol, `So to ${task}, use the ${['training', 'validation', 'test'][correct]} split.`],
      };
    },
  },
  {
    id: 'split-size',
    make(rng, d) {
      const N = pick(rng, d < 0.4 ? [1000, 2000, 5000, 10000, 20000] : [10000, 50000, 60000, 100000, 120000]);
      const names = ['training', 'validation', 'test'];
      if (d >= 0.6 && rng.next() < 0.5) {
        const T = pick(rng, [N / 10, N / 5, N / 6].filter((t) => Number.isInteger(t) && t % 100 === 0));
        const p = pick(rng, [10, 20, 25]);
        const rest = N - T;
        const askVal = rng.next() < 0.5;
        const val = clean((rest * p) / 100);
        const v = askVal ? val : rest - val;
        return {
          prompt: `From ${commas(N)} examples, ${commas(T)} are set aside as the test set. Then ${p}% of the remaining examples are held out for validation, and the rest are for training. How many examples are in the ${askVal ? 'validation' : 'training'} set?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: (N * p) / 100, why: `That takes ${p}% of all ${commas(N)}. The ${p}% is of what remains after the test set is removed.` },
            { value: askVal ? rest - val : val, why: `That is the ${askVal ? 'training' : 'validation'} set. The question asks for the ${askVal ? 'validation' : 'training'} set.` },
            { value: askVal ? 0 : N - val, why: 'That forgets to remove the test set as well.' },
          ].filter((t) => t.value > 0)),
          solution: [
            `After the test set: $${big(N)} - ${big(T)} = ${big(rest)}$ examples remain.`,
            `Validation takes ${p}% of those: $${num(p / 100)} \\times ${big(rest)} = ${big(val)}$.`,
            ...(askVal ? [] : [`Training gets the rest: $${big(rest)} - ${big(val)} = ${big(rest - val)}$.`]),
          ],
        };
      }
      const split = pick(rng, [[80, 10, 10], [70, 15, 15], [90, 5, 5], [60, 20, 20], [70, 20, 10], [98, 1, 1]]);
      const k = rng.int(3);
      const sizes = split.map((p) => clean((N * p) / 100));
      const v = sizes[k]!;
      return {
        prompt: `A dataset of ${commas(N)} examples is split at random into training, validation and test sets in the ratio ${split.join(' / ')} percent. How many examples are in the ${names[k]} set?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          ...sizes.map((s, i) => ({ value: s, why: `That is the ${names[i]} set, ${split[i]}%. The question asks for the ${names[k]} set, ${split[k]}%.` })),
          { value: split[k]!, why: `That is the percentage. Take ${split[k]}% of the ${commas(N)} examples.` },
        ]),
        solution: [`The ${names[k]} set gets ${split[k]}% of the data.`, `$${num(split[k]! / 100)} \\times ${big(N)} = ${big(v)}$ examples.`],
      };
    },
  },
];

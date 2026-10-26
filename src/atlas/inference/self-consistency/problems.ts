import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick } from '../../kit';
import { choice, clean, power, repeat, traps } from '../kit';

/** Questions whose final answer is a number, with a right answer and nearby wrong ones. */
const QUESTIONS: [string, number, number[]][] = [
  ['What is $17 \\times 24$?', 408, [398, 418, 388, 428, 308]],
  ['Ana has 3 boxes of 12 eggs, uses 7, then buys 5 more. How many eggs does she have?', 34, [29, 36, 24, 41, 31]],
  ['A shirt costs \\$40 and is 25% off. What does it cost?', 30, [10, 35, 15, 32, 25]],
  ['How many minutes are there in $3.5$ hours?', 210, [180, 350, 200, 240, 215]],
  ['A train travels 60 km per hour for 2.5 hours. How far does it go, in km?', 150, [120, 160, 125, 140, 180]],
  ['What is $15\\%$ of 80?', 12, [15, 8, 16, 10, 13]],
  ['A rectangle is 7 m by 9 m. What is its perimeter, in meters?', 32, [63, 16, 30, 34, 36]],
];

/** Tasks whose sampled answers can be compared, and tasks where no two samples match. */
const COMPARABLE = [
  'a math word problem whose answer is a number',
  'a multiple-choice question answered with a letter, A to D',
  'a yes-or-no question about a short passage',
  'a puzzle whose answer is a date',
];
const OPEN = [
  'writing a short story about a lighthouse',
  'summarizing a news article in one paragraph',
  'writing a cover letter for a job',
  'explaining in a paragraph why the sky is blue',
];

export const generators: Generator[] = [
  {
    id: 'vote',
    make(rng, d) {
      const [q, right, wrongs] = pick(rng, QUESTIONS);
      const n = d < 0.35 ? 5 : d < 0.7 ? 7 : 9;
      // The winner is usually right; at higher difficulty a wrong answer sometimes wins.
      const win = d < 0.5 || rng.next() < 0.7 ? right : pick(rng, wrongs);
      const others = rng.shuffle([right, ...wrongs].filter((v) => v !== win));
      const top = n === 5 ? int(rng, 2, 3) : n === 7 ? int(rng, 3, 4) : int(rng, 3, 5);
      const second = Math.min(top - 1, n - top);
      const rest = n - top - second;
      const counts: [number, number][] = [[win, top], [others[0]!, second]];
      for (let i = 0; i < rest; i++) counts.push([others[1 + i]!, 1]);
      const answers = rng.shuffle(repeat(counts));
      // A first sample that is not the winner, so taking the first is a visible mistake.
      const fi = answers.findIndex((a) => a !== win);
      if (fi > 0) [answers[0], answers[fi]] = [answers[fi]!, answers[0]!];
      const mean = clean(answers.reduce((a, b) => a + b, 0) / n);
      const tally = counts.map(([v, c]) => `${num(v)} $(\\times ${c})$`).join(', ');
      return {
        prompt: `A model is asked: ${q}\n\nIt samples ${n} chains of thought, and their final answers are $${answers.join(',\\ ')}$. What answer does self-consistency return?`,
        answer: { kind: 'number', value: win },
        traps: traps(win, [
          { value: answers[0]!, why: 'That is the first sample\'s answer: one path. Self-consistency counts the final answers of all the paths and takes the most common.' },
          { value: counts[1]![0], why: `That answer has ${second} vote${second === 1 ? '' : 's'}; the winner has ${top}.` },
          { value: mean, why: 'That averages the answers. The vote takes the most common one; an average can be a number no path reached.' },
        ]),
        solution: [
          `Count each final answer: ${tally}.`,
          `The most common is $${num(win)}$, with ${top} of the ${n} votes: that is the answer returned${win === right ? '' : ', even though here it is wrong: the vote picks what most paths agree on'}.`,
        ],
      };
    },
  },
  {
    id: 'two-of-three',
    make(rng, d) {
      const p = d < 0.35 ? pick(rng, [0.5, 0.8, 0.9]) : pick(rng, [0.3, 0.4, 0.6, 0.7, 0.8, 0.9]);
      const p2 = power(p, 2).v;
      const p3 = power(p, 3).v;
      const q = clean(1 - p);
      const one = clean(p2 * q);
      const two = clean(3 * one);
      const v = clean(p3 + two);
      const askWrong = d >= 0.7 && rng.next() < 0.5;
      const ans = askWrong ? clean(1 - v) : v;
      const flip = (x: number) => (askWrong ? clean(1 - x) : x);
      return {
        prompt: `Each sampled answer is right with probability $p = ${num(p)}$, independently of the others. Self-consistency samples 3 answers and votes; it is right when at least 2 of the 3 are right. What is the chance the vote is ${askWrong ? 'wrong' : 'right'}? Round to three decimals.\n\nUse $${num(p)}^{2} = ${num(p2)}$ and $${num(p)}^{3} = ${num(p3)}$.`,
        answer: { kind: 'number', value: ans, places: 3 },
        traps: traps(ans, [
          { value: flip(p3), why: 'That counts only the case where all three are right. Exactly two right also wins the vote.' },
          { value: flip(clean(3 * p2 * (1 - p))), why: 'That counts only exactly two right. All three right wins the vote too.' },
          { value: flip(clean(p3 + p2 * (1 - p))), why: 'Exactly two right can happen three ways: the wrong one is the first, the second or the third sample. Multiply by 3.' },
          { value: flip(p), why: 'That is the chance for a single sample. Work out the vote over all three.' },
        ]).filter((t) => Math.abs(t.value - ans) >= 0.0005),
        solution: [
          `Each sample is right independently, so multiply: all three right is $${num(p)} \\times ${num(p)} \\times ${num(p)} = ${num(p)}^{3} = ${num(p3)}$.`,
          `Exactly two right, with the third sample the wrong one: $${num(p)} \\times ${num(p)} \\times ${num(q)} = ${num(p2)} \\times ${num(q)} = ${num(one)}$.`,
          `The wrong one could be any of the 3 samples, so exactly two right is $3 \\times ${num(one)} = ${num(two)}$.`,
          `The vote is right with probability $${num(p3)} + ${num(two)} = ${num(v)}$${askWrong ? `, so wrong with $1 - ${num(v)} = ${num(ans)}$` : ''}.`,
          v > p ? `That beats one sample's $${num(p)}$: when a sample is usually right, the majority is right even more often.` : v < p ? `That is below one sample's $${num(p)}$: when a sample is usually wrong, the majority is wrong even more often.` : `That equals one sample's $${num(p)}$: at one half, voting neither helps nor hurts.`,
        ],
      };
    },
  },
  {
    id: 'comparable',
    make(rng) {
      const ok = rng.next() < 0.5;
      const task = ok ? pick(rng, COMPARABLE) : pick(rng, OPEN);
      const n = pick(rng, [5, 8, 10, 20]);
      return {
        prompt: `A model samples ${n} replies, each with a chain of thought, for ${task}. Can self-consistency's vote pick a better reply than one sample?`,
        answer: choice([
          { text: 'Yes: the final answers can be compared, and the most common one wins', why: ok ? null : 'Two replies like these almost never match word for word, so no answer gets more than one vote.' },
          { text: 'No: no two replies will match, so there is nothing to count', why: ok ? 'Final answers like these come from a short list, so different paths often reach the very same one, and that can be counted.' : null },
          { text: 'Yes: the longest reply wins, since it shows the most reasoning', why: 'The vote counts matching final answers. Length is not a vote, and a long chain can still end wrong.' },
          { text: 'No: voting only works when all the paths agree word for word', why: 'Only the final answers need to match. The paths that lead there can differ completely.' },
        ]),
        solution: ok
          ? [
              'Self-consistency counts final answers, so it needs answers that can be compared for equality.',
              'Here the answer is short and checkable for a match: different paths often land on the same one, and the most common wins.',
            ]
          : [
              'Self-consistency counts final answers, so it needs answers that can be compared for equality.',
              'Free-form text almost never repeats exactly: every reply gets one vote, and there is no majority to find.',
            ],
      };
    },
  },
  {
    id: 'greedy',
    make(rng) {
      const greedy = rng.next() < 0.5;
      const n = pick(rng, [3, 5, 7, 9, 15]);
      const T = greedy ? 0 : pick(rng, [0.5, 0.7, 0.8, 1]);
      const tTex = greedy ? 'temperature $\\symT \\to 0$' : `temperature $\\symT = ${num(T)}$`;
      return {
        prompt: `Self-consistency samples ${n} chains of thought for one question at ${tTex}, then votes on the final answers. What does the vote give?`,
        answer: choice([
          { text: `Just the greedy answer: all ${n} paths are the same path`, why: greedy ? null : `At $\\symT = ${num(T)}$ sampling picks different tokens on different runs, so the paths differ.` },
          { text: 'The most common answer among paths that differ', why: greedy ? 'As $\\symT \\to 0$ every run takes the top token at every step, so every path is identical and the vote adds nothing.' : null },
          { text: 'An even split: every answer gets the same number of votes', why: 'Different paths often reach the same final answer, so the counts are rarely all equal.' },
          { text: 'Always the right answer, whatever the model', why: 'A vote returns the most common answer. If most paths go wrong the same way, it is wrong too.' },
        ]),
        solution: greedy
          ? [
              'As $\\symT \\to 0$ sampling becomes greedy: every step takes the most likely token.',
              `So all ${n} runs write the same chain of thought and reach the same answer. The vote is that one greedy answer: sampling at a temperature above 0 is what gives the vote different paths to count.`,
            ]
          : [
              `At $\\symT = ${num(T)}$ each run samples its tokens, so the ${n} chains of thought take different routes.`,
              'Many routes still reach the same final answer. The vote counts them and returns the most common.',
            ],
      };
    },
  },
];

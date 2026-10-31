import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { clean, num, pick, round, shuffled, traps, vec } from '../../kit';

const G = '\\sym{G}{G}';
const R = '\\sym{r}{r}';

/** Questions with one checkable answer, and wrong answers a model might give. */
const QS: { q: string; a: number; wrong: number[] }[] = [
  { q: '9 \\times 7', a: 63, wrong: [56, 54, 72, 64] },
  { q: '17 + 25', a: 42, wrong: [32, 41, 52, 43] },
  { q: '12 \\times 12', a: 144, wrong: [124, 142, 154, 132] },
  { q: '81 / 9', a: 9, wrong: [8, 7, 11, 10] },
  { q: '15 \\times 6', a: 90, wrong: [80, 96, 75, 86] },
  { q: '100 - 37', a: 63, wrong: [73, 67, 53, 77] },
  { q: '13 \\times 13', a: 169, wrong: [139, 159, 196, 163] },
  { q: '2^{10}', a: 1024, wrong: [1000, 512, 2048, 1048] },
];

/** Group sizes and right-answer counts, by difficulty: an exact standard deviation first. */
const EASY: [number, number][] = [[4, 2], [5, 1], [5, 4], [4, 3], [4, 1]];
const MID: [number, number][] = [...EASY, [8, 4], [8, 2], [8, 6]];
const HARD: [number, number][] = [[8, 3], [8, 5], [5, 2], [5, 3], [8, 1], [8, 7], [4, 1], [4, 3]];

/** A group of 0/1 rewards with `k` of `n` right, in random order. */
function group(rng: Rng, d: number): number[] {
  const [n, k] = pick(rng, d < 0.35 ? EASY : d < 0.7 ? MID : HARD);
  return rng.shuffle(Array.from({ length: n }, (_, i) => (i < k ? 1 : 0)));
}

/** Mean, and the population standard deviation quoted to enough places that every advantage rounds as the exact one does. */
function stats(rs: number[]): { mean: number; sd: number; quoted: number; places: number } {
  const n = rs.length;
  const mean = rs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(rs.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  for (const places of [1, 2, 3, 4]) {
    const quoted = round(sd, places);
    if ([0, 1].every((x) => Math.abs(round((x - mean) / quoted, 2) - round((x - mean) / sd, 2)) < 1e-9)) return { mean, sd, quoted, places };
  }
  return { mean, sd, quoted: round(sd, 4), places: 4 };
}

const sdText = (s: { sd: number; quoted: number; places: number }) => `$${Math.abs(s.sd - s.quoted) < 1e-12 ? '' : '\\approx '}${num(s.quoted, s.places)}$`;
const m6 = (x: number) => num(round(x, 6));
const list = (xs: (number | string)[]) => xs.join(', ');

export const generators: Generator[] = [
  {
    id: 'advantage',
    make(rng, d) {
      const rs = group(rng, d);
      const st = stats(rs);
      const i = rng.int(rs.length);
      const v = round((rs[i]! - st.mean) / st.quoted, 6);
      const code = d >= 0.7 && rng.int(2) === 0;
      let setup: string;
      let check: string;
      if (code) {
        const runs = rs.map((x) => (x ? 'pass' : 'fail'));
        setup = `GRPO samples $${G} = ${rs.length}$ programs for one task, and a checker runs each against the task's tests, with reward 1 if every test passes and 0 if not. The results: ${list(runs)}. The rewards have standard deviation ${sdText(st)}.`;
        check = `The checker turns the results into rewards: $${R} = ${vec(rs)}$.`;
      } else {
        const Q = pick(rng, QS);
        const answers = rs.map((x) => (x ? Q.a : pick(rng, Q.wrong)));
        setup = `GRPO samples $${G} = ${rs.length}$ answers to $${Q.q}$: ${list(answers)}. A checker gives reward 1 to a right final answer and 0 to a wrong one, and the rewards have standard deviation ${sdText(st)}.`;
        check = `The right answer is ${Q.a}, so the checker gives $${R} = ${vec(rs)}$.`;
      }
      const k = rs.filter((x) => x === 1).length;
      return {
        prompt: `${setup} What is the advantage of ${code ? 'program' : 'answer'} ${i}, counting from 0? Round to two decimals.`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps(
          v,
          [
            { value: rs[i]! - st.mean, why: 'That subtracts the mean but leaves out dividing by the standard deviation.' },
            { value: -v, why: 'That is the mean minus the reward, the wrong way round. A right answer beats the mean, so its advantage is positive.' },
            { value: rs[i]! / st.quoted, why: 'That divides the reward without subtracting the group mean first.' },
            { value: rs[i]!, why: 'That is the reward itself. GRPO trains on the advantage: the reward minus the group mean, over the standard deviation.' },
          ],
          2,
        ),
        solution: [
          check,
          `The mean reward is the share that pass: ${k} of ${rs.length}, $${m6(st.mean)}$.`,
          `${code ? 'Program' : 'Answer'} ${i} got $${R} = ${rs[i]}$: $${rs[i]} - ${m6(st.mean)} = ${m6(rs[i]! - st.mean)}$.`,
          `Divide by the standard deviation: $${m6(rs[i]! - st.mean)} / ${num(st.quoted, st.places)} \\approx ${num(v, 2)}$.`,
        ],
      };
    },
  },
  {
    id: 'pass-rate',
    make(rng, d) {
      if (d < 0.35 || rng.int(2) === 0) {
        const [n, k] = pick(rng, d < 0.35 ? [[4, 1], [4, 3], [5, 2], [5, 3], [5, 4], [4, 2], [10, 7], [10, 3]] : [[8, 3], [8, 5], [10, 9], [8, 7], [20, 13], [16, 12], [20, 3], [10, 1]]);
        const Q = pick(rng, QS);
        const rs = rng.shuffle(Array.from({ length: n }, (_, i) => (i < k ? 1 : 0)));
        const answers = rs.map((x) => (x ? Q.a : pick(rng, Q.wrong)));
        const v = clean(k / n);
        return {
          prompt: `GRPO samples $${G} = ${n}$ answers to $${Q.q}$: ${list(answers)}. A checker gives reward 1 to a right final answer and 0 to a wrong one. What is the group's mean reward?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: k, why: 'That is how many answers are right. The mean divides that by the group size.' },
            { value: clean((n - k) / n), why: 'That is the share of wrong answers. Right answers are the ones that earn 1.' },
            { value: 0.5, why: 'The mean is not halfway between the rewards: it is the share of answers that earn 1.' },
          ]),
          solution: [
            `The right answer is ${Q.a}: ${k} of the ${n} answers match it and earn 1, the rest earn 0.`,
            `The mean adds the rewards and divides by the group size: $${k} / ${n} = ${num(v)}$.`,
            'With rewards of 0 and 1, the mean reward is the pass rate: the share of answers that pass the checker.',
          ],
        };
      }
      const [n, k] = pick(rng, [[8, 3], [8, 5], [10, 7], [16, 4], [16, 12], [20, 15], [20, 9], [32, 8], [32, 24], [64, 16], [64, 48], [10, 9]] as const);
      const mean = clean(k / n);
      return {
        prompt: `A checker gives each sampled answer reward 1 if its final answer is right and 0 if not. Over $${G} = ${n}$ answers to one question, the mean reward is $${num(mean)}$. How many answers were right?`,
        answer: { kind: 'number', value: k },
        traps: traps(k, [
          { value: n - k, why: 'That counts the wrong answers. The mean reward is the share of right ones.' },
          { value: clean(mean * 100), why: 'That is the pass rate as a percentage. Multiply the mean by the group size instead.' },
          { value: clean(n / mean), why: 'That divides by the mean. The mean is the right answers over the group size, so multiply.' },
        ]),
        solution: [
          `Each right answer adds 1 to the total and each wrong one adds 0, so the mean is the right answers over $${G}$.`,
          `So the right answers number $${num(mean)} \\times ${n} = ${k}$.`,
        ],
      };
    },
  },
  {
    id: 'no-signal',
    make(rng, d) {
      const n = pick(rng, [4, 5, 6, 8]);
      if (d < 0.35 || rng.int(2) === 0) {
        const right = rng.int(2) === 0;
        const Q = pick(rng, QS);
        const rs = Array.from({ length: n }, () => (right ? 1 : 0));
        return {
          prompt: `GRPO samples $${G} = ${n}$ answers to $${Q.q}$, and a checker ${right ? 'passes every one' : 'fails every one'}: $${R} = ${vec(rs)}$. What does this prompt teach the model?`,
          answer: shuffled(rng, [
            { text: 'Nothing: every reward equals the mean, so every advantage is 0', why: null },
            { text: right ? 'It pushes every answer up, since every one is right' : 'It pushes every answer down, since every one is wrong', why: `The group's mean is the baseline. Every reward equals it, so every advantage, $${R} - \\text{mean}$, is 0.` },
            { text: 'Its advantages blow up, since the standard deviation is 0', why: 'Code adds a tiny number to the standard deviation, and every reward minus the mean is exactly 0, so the advantages stay 0.' },
            { text: right ? 'The most of any prompt, since the model already solves it' : 'The most of any prompt, since the model has the most to learn', why: 'A prompt teaches only when its group mixes right and wrong answers. Here every answer agrees.' },
          ]),
          solution: [
            `The mean reward is ${right ? 1 : 0}, the same as every reward, so every $${R} - \\text{mean}$ is 0.`,
            `${right ? 'The model always solves this prompt' : 'The model never solves this prompt'}, so the group cannot tell better answers from worse. Only prompts the model solves some of the time move it.`,
          ],
        };
      }
      const m = pick(rng, [n, 16]);
      const k = 1 + rng.int(m - 1);
      const [x, y, z] = rng.shuffle(['A', 'B', 'C']);
      const rows = [
        { p: x!, k: m },
        { p: y!, k: 0 },
        { p: z!, k },
      ].sort((a, b) => a.p.localeCompare(b.p));
      return {
        prompt: `A model trains with GRPO, sampling $${G} = ${m}$ answers to each prompt. A checker passes ${rows.map((r, j) => `${j === 2 ? 'and ' : ''}${r.k} of ${m} on prompt ${r.p}`).join(', ')}. Which prompts change the model?`,
        answer: shuffled(rng, [
          { text: `Only ${z}`, why: null },
          { text: `${[x, z].sort().join(' and ')}`, why: `Every answer to ${x} passes, so each reward equals the mean and every advantage is 0: nothing is pushed up.` },
          { text: 'All three', why: `A group whose answers all agree has every advantage 0, so ${x} and ${y} teach nothing.` },
          { text: `Only ${y}`, why: `Every answer to ${y} fails, so each reward equals the mean, 0, and every advantage is 0.` },
        ]),
        solution: [
          `Prompt ${x}: every reward is 1, the mean is 1, so every advantage is 0.`,
          `Prompt ${y}: every reward is 0, the mean is 0, so every advantage is 0.`,
          `Prompt ${z}: ${k} of ${m} pass, so right answers sit above the mean and wrong ones below. Only ${z}, at the edge of what the model can do, moves it.`,
        ],
      };
    },
  },
  {
    id: 'checker',
    make(rng) {
      const task = pick(rng, [
        ['competition math problems, each with a known final number', 'compares the final number with the known one'],
        ['Python functions, each with unit tests', 'runs the unit tests'],
        ['arithmetic word problems with known answers', 'compares the final answer with the known one'],
        ['logic puzzles whose solutions a program can verify', 'verifies the solution'],
      ] as const);
      const n = pick(rng, [4, 8, 16, 32, 64]);
      return {
        prompt: `A model trains with GRPO on ${task[0]}, sampling $${G} = ${n}$ answers per prompt. Each answer can be scored by a program that ${task[1]}, or by a second network trained to score answers. Why use the program?`,
        answer: shuffled(rng, [
          { text: 'The model cannot fool it: only a right answer earns the reward', why: null },
          { text: 'Its rewards are larger, so each training step moves further', why: 'GRPO divides every group\'s rewards, minus their mean, by their standard deviation, so the size of the rewards does not set the step.' },
          { text: 'It also scores every step of the reasoning', why: 'The program reads only the final answer. The steps are never scored.' },
          { text: 'It pays more for longer answers, which think harder', why: 'It pays nothing for length: a long wrong answer still earns 0.' },
        ]),
        solution: [
          'A learned judge is itself a network, and it can be wrong. The model being trained can drift toward answers the judge scores high that are still wrong.',
          `The program ${task[1]}: no answer earns the reward without being right, so there is nothing to fool.`,
          'It only works where a program can check the answer, as in math and code.',
        ],
      };
    },
  },
];

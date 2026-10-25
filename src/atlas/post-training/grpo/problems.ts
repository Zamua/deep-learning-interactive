import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { num, pick, round, vec } from '../../kit';
import { ADV, choose, clean, G, traps, vtraps } from '../kit';

const r = '\\sym{r}{r}';
const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'];

/** Group sizes and right-answer counts, by difficulty: an exact standard deviation first. Sizes 4, 5 and 8 keep the mean a short decimal. */
const EASY: [number, number][] = [[4, 2], [8, 4], [5, 1], [5, 4]];
const MID: [number, number][] = [...EASY, [4, 1], [4, 3], [8, 2], [8, 6]];
const HARD: [number, number][] = [[8, 3], [8, 5], [5, 2], [5, 3], [8, 1], [8, 7], [4, 1], [4, 3]];

/** A group of 0/1 rewards with `k` of `n` right, in random order, at most `max` long. */
function group(rng: Rng, d: number, max = 8): number[] {
  const pool = (d < 0.35 ? EASY : d < 0.7 ? MID : HARD).filter(([n]) => n <= max);
  const [n, k] = pick(rng, pool);
  return rng.shuffle(Array.from({ length: n }, (_, i) => (i < k ? 1 : 0)));
}

/** Mean, exact std, and the std as the prompt quotes it: enough places that answers round the same either way. */
function stats(rs: number[]): { mean: number; sd: number; quoted: number; places: number } {
  const n = rs.length;
  const mean = rs.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(rs.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  for (const places of [2, 3, 4]) {
    const quoted = round(sd, places);
    const ok = [0, 1].every((x) => Math.abs(round((x - mean) / quoted, 2) - round((x - mean) / sd, 2)) < 1e-9);
    if (ok) return { mean, sd, quoted, places };
  }
  return { mean, sd, quoted: round(sd, 4), places: 4 };
}

const sdText = (s: { sd: number; quoted: number; places: number }) => `$${Math.abs(s.sd - s.quoted) < 1e-12 ? '' : '\\approx '}${num(s.quoted, s.places)}$`;
const meanTex = (m: number) => num(round(m, 6));

export const generators: Generator[] = [
  {
    id: 'advantage',
    make(rng, d) {
      const rs = group(rng, d);
      const st = stats(rs);
      const i = rng.int(rs.length);
      const v = round((rs[i]! - st.mean) / st.quoted, 6);
      return {
        prompt: `GRPO samples a group of $${G} = ${rs.length}$ answers to one question, and a checker gives each a reward of 1 if right, 0 if wrong: $${r} = ${vec(rs)}$. The rewards' standard deviation is ${sdText(st)}. What is the advantage of answer ${i}, the ${ORD[i]}, $(${r} - \\text{mean}) / \\text{std}$? Round to two decimals.`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps(
          v,
          [
            { value: rs[i]! - st.mean, why: 'That subtracts the mean but leaves out dividing by the standard deviation.' },
            { value: -v, why: 'That is mean minus reward, the wrong way round. A right answer beats the mean, so its advantage is positive.' },
            { value: rs[i]! / st.quoted, why: 'That divides the reward without subtracting the group mean first.' },
          ],
          2,
        ),
        solution: [
          `The group mean: ${rs.filter((x) => x === 1).length} right out of ${rs.length}, so $${meanTex(st.mean)}$.`,
          `Answer ${i} got $${r} = ${rs[i]}$: $${rs[i]} - ${meanTex(st.mean)} = ${meanTex(rs[i]! - st.mean)}$.`,
          `Divide by the standard deviation: $${meanTex(rs[i]! - st.mean)} / ${num(st.quoted, st.places)} \\approx ${num(v, 2)}$.`,
        ],
      };
    },
  },
  {
    id: 'vector',
    make(rng, d) {
      const rs = group(rng, d, 5);
      const st = stats(rs);
      const v = rs.map((x) => round((x - st.mean) / st.quoted, 6));
      return {
        prompt: `A group of $${G} = ${rs.length}$ answers to one question gets rewards $${r} = ${vec(rs)}$, 1 for right and 0 for wrong. Their standard deviation is ${sdText(st)}. What are GRPO's advantages for the group? Round to two decimals.`,
        answer: { kind: 'vector', value: v, places: 2 },
        traps: vtraps(
          v,
          [
            { value: rs.map((x) => clean(x - st.mean)), why: 'Those subtract the mean but leave out dividing by the standard deviation.' },
            { value: rs.map((x) => x / st.quoted), why: 'Those divide the rewards without subtracting the group mean first.' },
            { value: v.map((x) => -x), why: 'Those are mean minus reward, the wrong way round. Right answers beat the mean.' },
          ],
          2,
        ),
        solution: [
          `The mean reward is $${meanTex(st.mean)}$: right answers are $${meanTex(1 - st.mean)}$ above it, wrong ones $${meanTex(st.mean)}$ below.`,
          `Divide by $${num(st.quoted, st.places)}$: right answers get $\\approx ${num((1 - st.mean) / st.quoted, 2)}$, wrong ones $\\approx ${num(-st.mean / st.quoted, 2)}$.`,
          `So $${ADV} \\approx ${vec(v, 2)}$. They add up to zero: probability moves from the wrong answers to the right ones.`,
        ],
      };
    },
  },
  {
    id: 'same',
    make(rng) {
      const n = pick(rng, [4, 5, 6, 8]);
      const right = rng.int(2) === 0;
      const rs = Array.from({ length: n }, () => (right ? 1 : 0));
      const q = pick(rng, ['$17 + 25$', '$9 \\times 7$', '$2^{10}$', '$144 / 12$', '$\\sqrt{169}$']);
      return {
        prompt: `GRPO samples $${G} = ${n}$ answers to the question ${q}, and ${right ? 'every one is right' : 'every one is wrong'}: $${r} = ${vec(rs)}$. What does this group do to the model?`,
        answer: choose('Nothing: every advantage is zero, so no answer is pushed', [
          [right ? 'It pushes every answer up, since every one is right' : 'It pushes every answer down, since every one is wrong', `The group mean is the baseline. Every reward equals it, so every advantage, $${r} - \\text{mean}$, is 0.`],
          ['Its advantages blow up, since the standard deviation is zero', 'Code adds a tiny number to the standard deviation, and every $r - \\text{mean}$ is exactly 0, so the advantages stay 0.'],
          ['Each answer is pushed by its own reward, as with no baseline', 'GRPO always subtracts the group mean, and here it equals every reward.'],
        ]),
        solution: [
          `The mean reward is ${right ? 1 : 0}, the same as every reward, so every $${r} - \\text{mean} = 0$.`,
          `${right ? 'The question is too easy' : 'The question is too hard'} for this group to tell better answers from worse: it teaches nothing. Only groups with both right and wrong answers move the model.`,
        ],
      };
    },
  },
  {
    id: 'baseline',
    make(rng, d) {
      const rs = group(rng, d);
      const k = rs.filter((x) => x === 1).length;
      const mean = clean(k / rs.length);
      return {
        prompt: `GRPO samples $${G} = ${rs.length}$ answers to one question, and ${k} of them are right: $${r} = ${vec(rs)}$. What does it subtract from these rewards as the baseline?`,
        answer: choose('The average reward of this group of answers', [
          ['A value model\'s prediction of the reward for this question', 'GRPO trains no value model. The group\'s mean stands in for it.'],
          ['The mean reward over every question in the batch', 'That mixes easy and hard questions. The baseline belongs to this question, so it is this group\'s mean.'],
          ['Zero, since a wrong answer gets 0', 'With no baseline every right answer gets the same push, however easy the question, and wrong answers are never pushed down.'],
        ]),
        solution: [
          `The baseline is the mean of the group's own rewards: ${k} of ${rs.length}, $${num(mean)}$.`,
          'Many answers to the same question estimate what reward to expect for it, so no second network has to learn that.',
        ],
      };
    },
  },
];

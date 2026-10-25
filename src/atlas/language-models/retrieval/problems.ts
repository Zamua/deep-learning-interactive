import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick } from '../../kit';
import { commas, traps } from '../kit';

/** Vectors of size 1 with one-decimal entries, so every dot product is quick by hand. */
const signs = (v: number[]): number[][] => {
  const out: number[][] = [[]];
  for (const x of v) out.splice(0, out.length, ...out.flatMap((p) => (x === 0 ? [[...p, 0]] : [[...p, x], [...p, -x]])));
  return out;
};
const perms = (v: number[]): number[][] => {
  if (v.length <= 1) return [v];
  return v.flatMap((x, i) => perms([...v.slice(0, i), ...v.slice(i + 1)]).map((p) => [x, ...p]));
};
const uniq = (vs: number[][]) => [...new Map(vs.map((v) => [v.join(), v])).values()];
const DIR2 = uniq([[1, 0], [0, 1], [0.6, 0.8], [0.8, 0.6]].flatMap(signs));
const DIR3 = uniq([...perms([0.6, 0.8, 0]), ...perms([1, 0, 0])].flatMap(signs));

const clean = (x: number) => Math.round(x * 1e9) / 1e9 + 0;
const dot = (a: readonly number[], b: readonly number[]) => clean(a.reduce((s, x, i) => s + x * b[i]!, 0));
const vtex = (v: readonly number[]) => `[${v.map((x) => num(x)).join(',\\ ')}]`;
const par = (x: number) => (x < 0 ? `(${num(x)})` : num(x));
const prods = (a: readonly number[], b: readonly number[]) => a.map((x, i) => `${par(x)} \\times ${par(b[i]!)}`).join(' + ');
const total = (v: readonly number[]) => clean(v.reduce((s, x) => s + x, 0));

interface Setup {
  q: number[];
  ps: number[][];
  sc: number[];
  /** Passage indices from the highest score down. */
  rank: number[];
}

/**
 * A question and `n` passages from `pool` (1: no negative entries, 2: two entries, 3: three), with
 * the top `upto` scores each at least 0.1 above the next.
 */
function setup(rng: Rng, n: number, pool: 1 | 2 | 3, upto: number): Setup {
  const dirs = pool === 1 ? DIR2.filter((v) => v.every((x) => x >= 0)) : pool === 2 ? DIR2 : DIR3;
  for (;;) {
    const q = pick(rng, dirs);
    const ps = rng.shuffle(dirs.filter((v) => v.join() !== q.join())).slice(0, n);
    const sc = ps.map((p) => dot(q, p));
    const rank = sc.map((_, i) => i).sort((a, b) => sc[b]! - sc[a]!);
    const gaps = rank.slice(0, upto).map((r, i) => sc[r]! - sc[rank[i + 1]!]!);
    if (gaps.every((g) => g >= 0.1) && new Set(sc).size === n) return { q, ps, sc, rank };
  }
}

const listTex = (ps: number[][]) => ps.map((p, i) => `passage ${i}: $${vtex(p)}$`).join(', ');
const scoreSteps = (S: Setup) => S.ps.map((p, i) => `Passage ${i}: $${prods(S.q, p)} = ${num(S.sc[i]!)}$.`);

const SCENES: { org: string; the: string; thing: string; doc: string; plural?: boolean }[] = [
  { org: 'a city library', the: 'the library', thing: 'its Sunday opening hours', doc: 'hours page', plural: true },
  { org: 'a train company', the: 'the train company', thing: 'its weekend timetable', doc: 'timetable' },
  { org: 'an online shop', the: 'the shop', thing: 'its return window', doc: 'returns policy' },
  { org: 'a museum', the: 'the museum', thing: 'its ticket prices', doc: 'tickets page', plural: true },
  { org: 'a clinic', the: 'the clinic', thing: 'its phone number', doc: 'contact page' },
  { org: 'a software project', the: 'the project', thing: 'the name of a setting', doc: 'settings guide' },
  { org: 'a school', the: 'the school', thing: 'its term dates', doc: 'calendar page', plural: true },
  { org: 'a sports club', the: 'the club', thing: 'its membership fee', doc: 'fees page' },
];

export const generators: Generator[] = [
  {
    id: 'best',
    make(rng, d) {
      const n = d < 0.35 ? 3 : d < 0.7 ? 4 : 3;
      const S = setup(rng, n, d < 0.35 ? 1 : d < 0.7 ? 2 : 3, 1);
      const best = S.rank[0]!;
      const sums = S.ps.map(total);
      const bySum = sums.indexOf(Math.max(...sums));
      return {
        prompt: `Retrieval embeds a question as $${vtex(S.q)}$ and ${n} passages as ${listTex(S.ps)}. Which passage scores highest?`,
        answer: { kind: 'number', value: best },
        traps: traps(best, [
          ...(sums.filter((x) => x === sums[bySum]).length === 1 ? [{ value: bySum, why: `Passage ${bySum} has the largest entries in total, but a score is the dot product with the question: it scores ${num(S.sc[bySum]!)}.` }] : []),
          { value: S.rank[n - 1]!, why: `Passage ${S.rank[n - 1]} scores lowest, ${num(S.sc[S.rank[n - 1]!]!)}. Retrieval keeps the highest score.` },
          ...(best + 1 < n ? [{ value: best + 1, why: `That counts passages from 1. The best is passage ${best}, the ${['first', 'second', 'third', 'fourth'][best]} in the list.` }] : []),
        ]),
        solution: ['Score each passage by its dot product with the question.', ...scoreSteps(S), `The highest is passage ${best}, at $${num(S.sc[best]!)}$.`],
      };
    },
  },
  {
    id: 'top-two',
    make(rng, d) {
      const S = setup(rng, 4, d < 0.5 ? 2 : 3, 2);
      const pair = (a: number, b: number) => [Math.min(a, b), Math.max(a, b)] as const;
      const label = ([a, b]: readonly [number, number]) => `Passages ${a} and ${b}`;
      const [r0, r1, r2, r3] = S.rank as [number, number, number, number];
      const right = pair(r0, r1);
      const sums = S.ps.map(total);
      const bySum = sums.map((_, i) => i).sort((a, b) => sums[b]! - sums[a]!);
      const why = (p: readonly [number, number]): string => {
        if (p[0] === pair(r2, r3)[0] && p[1] === pair(r2, r3)[1]) return 'Those are the two lowest scores. Retrieval keeps the highest.';
        const out = p.find((x) => x !== r0 && x !== r1)!;
        const missed = [r0, r1].find((x) => !p.includes(x))!;
        return `Passage ${out} scores ${num(S.sc[out]!)}, below passage ${missed}'s ${num(S.sc[missed]!)}.`;
      };
      const cands = [pair(r2, r3), pair(bySum[0]!, bySum[1]!), pair(r0, r2), pair(r1, r2), pair(r0, r3)];
      const wrong: (readonly [number, number])[] = [];
      for (const c of cands) if (label(c) !== label(right) && !wrong.some((w) => label(w) === label(c)) && wrong.length < 3) wrong.push(c);
      return {
        prompt: `Retrieval embeds a question as $${vtex(S.q)}$ and four passages as ${listTex(S.ps)}. With $k = 2$, which passages go into the prompt?`,
        answer: { kind: 'choice', options: [label(right), ...wrong.map(label)], correct: 0, why: [null, ...wrong.map(why)] },
        solution: ['Score each passage by its dot product with the question.', ...scoreSteps(S), `The two highest are passage ${r0} ($${num(S.sc[r0])}$) and passage ${r1} ($${num(S.sc[r1])}$).`],
      };
    },
  },
  {
    id: 'stale',
    make(rng) {
      const sc = pick(rng, SCENES);
      const kind = rng.int(3);
      const setupText = `A language model was trained before ${sc.org} changed ${sc.thing}, so on its own it answers with the old one.`;
      if (kind === 0) {
        return {
          prompt: `${setupText} With retrieval over ${sc.the}'s current pages, it answers with the new one, and no one retrained it. Why?`,
          answer: {
            kind: 'choice',
            options: ['The current page is in its prompt, and it reads it in context', 'Retrieval took a gradient step on the current page', 'The question\'s vector now holds the new answer', 'The embedding model was retrained on the current pages'],
            correct: 0,
            why: [
              null,
              'Retrieval only searches and builds a prompt. The language model runs forward with the same weights; the page is just tokens in its context.',
              'The question\'s vector only picks which passages to fetch. The answer comes from the passage text in the prompt.',
              'Nothing was retrained: each page was only run through the embedding model once, a forward pass, to get its vector.',
            ],
          },
          solution: ['Retrieval finds the passages whose vectors best match the question\'s and puts them in the prompt.', 'The model reads the current page in its context, as in in-context learning: its weights never change.'],
        };
      }
      if (kind === 1) {
        return {
          prompt: `${setupText} It answers through retrieval over ${sc.the}'s pages. Next month ${sc.thing} change${sc.plural ? '' : 's'} again. What is the least that must be done for its answers to stay right?`,
          answer: {
            kind: 'choice',
            options: [`Embed the new ${sc.doc} and swap it into the collection`, `Fine-tune the language model on the new ${sc.doc}`, 'Retrain the embedding model on every page', 'Nothing: the model will notice the change'],
            correct: 0,
            why: [
              null,
              'That retrains the model, which retrieval makes unnecessary: the answer can come from the page in the prompt.',
              'The embedding model is fine as it is. Only the changed page needs a new vector.',
              'The model\'s weights and the stored pages are all it has. If the old page stays, retrieval keeps fetching the old answer.',
            ],
          },
          solution: ['The answer comes from whatever passage retrieval puts in the prompt.', `So replace the old page: embed the new ${sc.doc} once and store its vector in place of the old one. No model is retrained.`],
        };
      }
      return {
        prompt: `${setupText} It answers through retrieval, and gets the question right. Where does the new ${sc.thing.replace(/^its /, '').replace(/^the /, '')} come from in its answer?`,
        answer: {
          kind: 'choice',
          options: ['From a retrieved passage in its context', 'From its weights, updated by retrieval', 'From the question\'s embedding', 'From the few-shot examples in its prompt'],
          correct: 0,
          why: [
            null,
            'Retrieval updates no weights; the model\'s weights still hold the old answer.',
            'The question\'s vector is only used to score passages. The model reads text, not that vector.',
            'Examples show the task. Here the fact itself has to be in the context, and retrieval put it there.',
          ],
        },
        solution: ['Retrieval scored the passages against the question and put the best ones in the prompt.', 'The model read the current fact there, in context, with its weights unchanged.'],
      };
    },
  },
  {
    id: 'tokens',
    make(rng, d) {
      const n = pick(rng, [100, 150, 200, 250, 300, 400]);
      const q = int(rng, 8, 30);
      const a = int(rng, 5, 20);
      if (d >= 0.6 && rng.int(2) === 0) {
        const C = pick(rng, [1024, 2048, 4096, 8192]);
        const fit = Math.floor((C - a - q) / n);
        return {
          prompt: `A model's context holds at most ${commas(C)} tokens. Its prompt has an instruction of ${a} tokens and a question of ${q} tokens, plus as many retrieved passages of ${n} tokens each as will fit. What is the largest $k$ it can use?`,
          answer: { kind: 'number', value: fit },
          traps: traps(fit, [
            { value: Math.floor(C / n), why: 'That leaves no room for the instruction and the question, which share the same context.' },
            { value: Math.ceil((C - a - q) / n), why: 'That rounds up, and the last passage would not fit. Round down.' },
          ]),
          solution: [`The instruction and the question take $${a} + ${q} = ${a + q}$ tokens, leaving $${C} - ${a + q} = ${C - a - q}$.`, `Each passage takes ${n}, and only whole passages fit: ${fit} of them take $${fit} \\times ${n} = ${fit * n}$, and one more would need $${(fit + 1) * n}$.`],
        };
      }
      const k = d < 0.35 ? int(rng, 2, 3) : int(rng, 3, 8);
      const withInstr = d >= 0.35;
      const v = k * n + q + (withInstr ? a : 0);
      return {
        prompt: `Retrieval puts the top $k = ${k}$ passages, ${n} tokens each, ${withInstr ? `after an instruction of ${a} tokens and ` : ''}before a question of ${q} tokens. How many tokens does the model read before it answers?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: k * n, why: `That counts only the passages. The question${withInstr ? ' and the instruction are' : ' is'} in the context too.` },
          { value: k + n + q + (withInstr ? a : 0), why: `That adds $k$ instead of multiplying: ${k} passages of ${n} tokens are $${k} \\times ${n}$.` },
          { value: n + q + (withInstr ? a : 0), why: `That counts one passage. All ${k} retrieved passages go in.` },
        ]),
        solution: [`The passages take $${k} \\times ${n} = ${k * n}$ tokens.`, `Add the question${withInstr ? ` and the instruction: $${k * n} + ${q} + ${a} = ${v}$` : `: $${k * n} + ${q} = ${v}$`} tokens.`],
      };
    },
  },
];

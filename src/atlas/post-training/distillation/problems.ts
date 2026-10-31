import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { clean, E2, int, ints, LN2, num, pick, round, traps, useLn, vec } from '../../kit';

const Q = '\\sym{q}{q}';

const CLASSES = [
  ['cat', 'dog', 'car', 'ship'],
  ['wolf', 'husky', 'bus', 'tree'],
  ['apple', 'pear', 'truck', 'boat'],
  ['horse', 'deer', 'plane', 'frog'],
  ['tiger', 'lion', 'bike', 'cup'],
];

/** `$e^{2} \approx 7.39$, ...` for each distinct power, largest first. */
const useExp = (zs: readonly number[]): string =>
  [...new Set(zs)].sort((a, b) => b - a).map((z) => (z === 0 ? '$e^{0} = 1$' : `$e^{${num(z)}} \\approx ${num(E2(z), 2)}$`)).join(', ');

/** Softmax from the rounded exponentials a prompt quotes. */
function soft2(zs: readonly number[]): number[] {
  const e = zs.map(E2);
  const t = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / t);
}

/** Exact softmax, for traps and options. */
function soft(zs: readonly number[]): number[] {
  const m = Math.max(...zs);
  const e = zs.map((z) => Math.exp(z - m));
  const t = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / t);
}

/** Probabilities rounded to two places, the largest nudged so they still add up to 1. */
function tidy(p: readonly number[]): number[] {
  const r = p.map((x) => round(x, 2));
  const top = r.indexOf(Math.max(...r));
  r[top] = clean(r[top]! + 1 - r.reduce((a, b) => a + b, 0));
  return r.map(clean);
}

/** `n` tenths, each at least 0.1, adding up to 1, with one clear largest. */
function tenths(rng: Rng, n: number): number[] {
  for (;;) {
    const cuts = Array.from({ length: n - 1 }, () => int(rng, 1, 9)).sort((a, b) => a - b);
    const parts = [...cuts, 10].map((c, i) => c - (i ? cuts[i - 1]! : 0));
    const top = Math.max(...parts);
    if (parts.every((x) => x >= 1) && parts.filter((x) => x === top).length === 1) return parts.map((x) => clean(x / 10));
  }
}

const top = (xs: readonly number[]): number => xs.indexOf(Math.max(...xs));
const names = (cs: readonly string[]): string => cs.map((c, i) => `${c} (${i})`).join(', ');

export const generators: Generator[] = [
  {
    id: 'teacher-soft',
    make(rng, d) {
      const n = d < 0.7 ? 3 : pick(rng, [3, 4]);
      const T = d < 0.35 ? 2 : pick(rng, [2, 3, 4, 5]);
      const z = d < 0.35 ? ints(rng, n, 0, 2) : ints(rng, n, -1, 3);
      const s = z.map((v) => clean(v * T));
      const k = rng.int(n);
      const cs = pick(rng, CLASSES).slice(0, n);
      const q = soft2(z);
      const v = q[k]!;
      const e = z.map(E2);
      const total = e.reduce((a, b) => a + b, 0);
      const lead = z.filter((x) => x === Math.max(...z)).length === 1 ? top(z) : -1;
      return {
        prompt: `A teacher network scores an image over the classes ${names(cs)}: $\\syms = ${vec(s)}$. At temperature $\\symT = ${T}$, what is the soft target $${Q}_{${k}}$? Round to two decimals.\n\nUse ${useExp(z)}.`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps(v, [
          { value: soft(s)[k]!, why: `That is the teacher at $\\symT = 1$: softmax of the raw scores. Divide them by $\\symT = ${T}$ first.` },
          { value: soft(s.map((x) => x * T))[k]!, why: 'That multiplies the scores by $\\symT$. The temperature divides them.' },
          { value: 1 / n, why: `That is one share in ${n}: softmax gives it only when every score is equal.` },
          ...(lead >= 0 ? [{ value: k === lead ? 1 : 0, why: `That is the hard label, one-hot on ${cs[lead]}. The soft target comes from the teacher's softened probabilities.` }] : []),
        ], 2),
        solution: [
          `The soft targets are $${Q} = \\mathrm{softmax}(\\syms / \\symT)$. Divide by the temperature: $\\syms / ${T} = ${vec(z)}$.`,
          `Exponentiate: ${z.map((x) => (x === 0 ? '$e^{0} = 1$' : `$e^{${num(x)}} \\approx ${num(E2(x), 2)}$`)).join(', ')}; they add up to $${num(total, 2)}$.`,
          `${cs[k]![0]!.toUpperCase()}${cs[k]!.slice(1)}: $${Q}_{${k}} = ${num(e[k]!, 2)} / ${num(total, 2)} \\approx ${num(v, 2)}$.`,
        ],
      };
    },
  },
  {
    id: 'soft-ce',
    make(rng, d) {
      const n = d < 0.3 ? 2 : d < 0.7 ? 3 : pick(rng, [3, 4]);
      const q = tenths(rng, n);
      let p = tenths(rng, n);
      while (p.every((x, i) => x === q[i])) p = tenths(rng, n);
      const nl = p.map((x) => -LN2(x));
      const terms = q.map((x, i) => clean(x * nl[i]!));
      const v = clean(terms.reduce((a, b) => a + b, 0));
      const t = top(q);
      return {
        prompt: `For one image, the soft targets are $${Q} = ${vec(q)}$, and the student's probabilities, at the same temperature, are $\\symp = ${vec(p)}$. What is the distillation loss $\\symL$? Round to two decimals.\n\nUse ${useLn(p)}.`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps(v, [
          { value: nl[t]!, why: `That is $-\\ln \\symp_{${t}}$ alone, the loss with a hard label on the teacher's top class. Soft targets weight every class by $${Q}$.` },
          { value: nl.reduce((a, b) => a + b, 0), why: `That adds $-\\ln \\symp$ for every class without weighting each by $${Q}$.` },
          { value: -v, why: 'That drops the minus sign. Logs of probabilities are negative, so the loss is positive.' },
          { value: p.reduce((a, x, i) => a - x * LN2(q[i]!), 0), why: `That swaps the two. The teacher's $${Q}$ are the weights, and the log is of the student's $\\symp$.` },
        ], 2),
        solution: [
          `The loss is $\\symL = -\\sum_k ${Q}_k \\ln \\symp_k$, so each class adds $${Q}_k \\times (-\\ln \\symp_k)$: ${q.map((x, i) => `$${num(x)} \\times ${num(nl[i]!, 2)} = ${num(terms[i]!)}$`).join(', ')}.`,
          `Add them: $\\symL = ${terms.map((x) => num(x)).join(' + ')} = ${num(v)} \\approx ${num(round(v, 2), 2)}$.`,
          `Every class counts, in proportion to how much probability the teacher gives it.`,
        ],
      };
    },
  },
  {
    id: 'temp-effect',
    make(rng, d) {
      const n = d < 0.5 ? 3 : 4;
      const s = ints(rng, n, -1, d < 0.5 ? 4 : 6, true);
      const [T1, T2] = pick(rng, [[1, 2], [1, 4], [2, 5], [2, 10], [1, 3], [3, 8]] as const);
      const raise = rng.int(2) === 0;
      const [from, to] = raise ? [T1, T2] : [T2, T1];
      return {
        prompt: `A teacher's scores for an image are $\\syms = ${vec(s)}$. If distillation's temperature $\\symT$ goes from $${from}$ to $${to}$, what happens to the soft targets $${Q}$?`,
        answer: {
          kind: 'choice',
          options: [
            'They flatten: the wrong classes get more of the probability and count for more in the loss',
            'They sharpen: closer to the one-hot label, so the wrong classes count for less',
            'A different class can come out on top, since dividing reorders the scores',
            'Nothing changes: softmax only sees the gaps between the scores',
          ],
          correct: raise ? 0 : 1,
          why: [
            raise ? null : `Lowering $\\symT$ to $${to}$ divides by less, which stretches the gaps between the scores and sharpens the targets.`,
            raise ? `Raising $\\symT$ to $${to}$ divides by more, which shrinks the gaps between the scores and flattens the targets.` : null,
            'Dividing every score by the same positive $\\symT$ keeps them in order, so the top class stays on top.',
            'Dividing changes the gaps: it scales them by $1/\\symT$. Only adding the same amount to every score leaves softmax unchanged.',
          ],
        },
        solution: [
          `The soft targets are $${Q} = \\mathrm{softmax}(\\syms / \\symT)$, so dividing by $\\symT$ scales every gap between the scores by $1/\\symT$: from $1/${from}$ to $1/${to}$ here.`,
          raise
            ? 'Smaller gaps flatten softmax: the top class keeps the lead but gives up probability to the wrong classes, so how the teacher ranks them weighs more in the loss.'
            : 'Bigger gaps sharpen softmax: the targets move toward the one-hot label, and the hints about the wrong classes fade.',
          'The order never changes: the teacher\'s top class stays on top at every temperature.',
        ],
      };
    },
  },
  {
    id: 'best-student',
    make(rng, d) {
      let right: number[];
      let wrong: [number[], string][];
      let prompt: string;
      let lead: number;
      let how: string;
      if (d < 0.5) {
        const q = tenths(rng, 3);
        lead = top(q);
        const sq = q.map((x) => x * x);
        const rt = q.map(Math.sqrt);
        right = q;
        wrong = [
          [q.map((_, i) => (i === lead ? 1 : 0)), 'All on the top class, the student pays $-\\ln 0$ on every class the teacher gives some probability: a loss without limit.'],
          [tidy(sq.map((x) => x / sq.reduce((a, b) => a + b, 0))), 'That is sharper than the teacher. It saves a little on the top class but pays more on the others; the loss is smallest when $\\symp$ equals $' + Q + '$.'],
          [tidy(rt.map((x) => x / rt.reduce((a, b) => a + b, 0))), 'That is flatter than the teacher. It pays more on the top class than it saves on the others; the loss is smallest when $\\symp$ equals $' + Q + '$.'],
        ];
        how = `Here the targets are given: $${Q} = ${vec(q)}$.`;
        prompt = `The teacher's soft targets for an image are $${Q} = ${vec(q)}$. Which student probabilities $\\symp$ make the distillation loss smallest?`;
      } else {
        const z = ints(rng, 3, 0, 2, true);
        const T = pick(rng, [2, 3]);
        const s = z.map((v) => v * T);
        lead = top(z);
        right = tidy(soft(z));
        wrong = [
          [tidy(soft(s)), `That matches the teacher at $\\symT = 1$. The targets are softened, so the best student matches $\\mathrm{softmax}(\\syms / ${T})$.`],
          [z.map((_, i) => (i === lead ? 1 : 0)), 'That is the hard label. All on one class, the student pays $-\\ln 0$ on every class the teacher gives some probability: a loss without limit.'],
          [[0.34, 0.33, 0.33], 'Equal shares ignore what the teacher says. The loss is smallest when the student matches the teacher\'s softened probabilities.'],
        ];
        how = `The targets: $\\syms / ${T} = ${vec(z)}$, and softmax of that is about $${vec(right)}$.`;
        prompt = `A teacher's scores for an image are $\\syms = ${vec(s)}$, and distillation uses $\\symT = ${T}$. Which student probabilities $\\symp$, softened at the same $\\symT$, make the distillation loss smallest?\n\nUse ${useExp(z)}.`;
      }
      const opts = [right, ...wrong.map((w) => w[0])].map((p) => `$${vec(p)}$`);
      const keep = opts.map((o, i) => opts.indexOf(o) === i);
      const options = opts.filter((_, i) => keep[i]);
      const why = [null, ...wrong.map((w) => w[1])].filter((_, i) => keep[i]);
      return {
        prompt,
        answer: { kind: 'choice', options, correct: 0, why },
        solution: [
          `The loss $-\\sum_k ${Q}_k \\ln \\symp_k$ weights $-\\ln \\symp_k$ by the teacher's $${Q}_k$, so it is smallest when the student's probabilities equal the targets: $\\symp = ${vec(right)}$.`,
          how,
          'A student sure of the top class would pay $-\\ln 0$, a loss without limit, on every class the teacher gives some probability.',
        ],
      };
    },
  },
];

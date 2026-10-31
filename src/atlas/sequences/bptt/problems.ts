import type { Generator } from '../../../mastery/domain/types';
import { clean, int, num, pick, round, tenth, vec, vtraps } from '../../kit';

/** Traps that differ from the answer by more than its rounding allows, and from each other. */
function apart(v: number, places: number | undefined, ts: { value: number; why: string }[]): { value: number; why: string }[] {
  const tol = places === undefined ? 1e-9 : 10 ** -places;
  const out: { value: number; why: string }[] = [];
  for (const t of ts) {
    const x = clean(t.value);
    if (Number.isFinite(x) && Math.abs(x - v) >= tol && !out.some((o) => Math.abs(o.value - x) < tol)) out.push({ value: x, why: t.why });
  }
  return out;
}

/** A number for TeX in two significant figures, as a power of ten when far from 1. */
function sci(x: number): string {
  if (x >= 0.01 && x < 10000) return num(Number(x.toPrecision(2)));
  const e = Math.floor(Math.log10(x));
  return `${num(Number((x / 10 ** e).toPrecision(2)))} \\times 10^{${e}}`;
}

/** Rounding for a power: four places below 1, exact for whole numbers, two otherwise. */
const placesFor = (v: number): number | undefined => (v < 1 ? 4 : Number.isInteger(v) ? undefined : 2);
const roundNote = (p: number | undefined): string => (p === undefined ? '' : p === 4 ? ' Round to four decimals.' : ' Round to two decimals.');

/** Pythagorean vectors: the entries, then the norm. */
const TRIPLES2 = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 6, 10], [4, 3, 5], [12, 5, 13]];
const TRIPLES3 = [[1, 2, 2, 3], [2, 3, 6, 7], [2, 6, 9, 11], [4, 4, 7, 9], [2, 1, 2, 3], [6, 2, 3, 7]];

export const generators: Generator[] = [
  {
    id: 'power',
    make(rng, d) {
      if (d >= 0.7 && rng.int(2) === 0) {
        const [w, slope] = pick(rng, [[2, 0.25], [3, 0.5], [0.8, 0.5], [4, 0.5], [6, 0.25], [1, 0.5]] as [number, number][]);
        const a = clean(w * slope);
        const n = int(rng, 3, a < 1 ? 6 : 5);
        const v = clean(a ** n);
        const places = placesFor(v);
        return {
          prompt: `In a one-unit RNN, $\\symWhh = ${num(w)}$ and the tanh's slope is about $${num(slope)}$ at every step. What is $\\partial \\symh_{${n}} / \\partial \\symh_0$?${roundNote(places)}`,
          answer: { kind: 'number', value: v, ...(places === undefined ? {} : { places }) },
          traps: apart(v, places, [
            { value: w ** n, why: 'That multiplies by $\\symWhh$ alone. Each step back also multiplies by the slope of the tanh.' },
            { value: a * n, why: `That multiplies the factor by ${n}. Going back ${n} steps multiplies ${n} factors together: $${num(a)}^{${n}}$.` },
            { value: a ** (n - 1), why: `That is ${n - 1} ${n - 1 === 1 ? 'factor' : 'factors'}. From $\\symh_{${n}}$ back to $\\symh_0$ there are ${n} steps.` },
          ]),
          solution: [
            `One step back multiplies by $\\symWhh$ times the tanh's slope: $\\partial \\symh_t / \\partial \\symh_{t-1} = ${num(w)} \\times ${num(slope)} = ${num(a)}$.`,
            `The chain rule multiplies one such factor per step: ${n} of them from $\\symh_{${n}}$ to $\\symh_0$.`,
            `$${num(a)}^{${n}} = ${num(places === undefined ? v : round(v, places))}$.`,
          ],
        };
      }
      const a = d < 0.35 ? pick(rng, [0.5, 2]) : pick(rng, [0.5, 2, 0.1, 3, 0.2, 1.5]);
      const n = a === 0.5 || a === 2 ? (d < 0.35 ? int(rng, 2, 4) : int(rng, 3, 10)) : a === 3 ? int(rng, 2, 5) : int(rng, 2, 4);
      const v = clean(a ** n);
      const places = placesFor(v);
      return {
        prompt: `In a one-unit RNN, $\\partial \\symh_t / \\partial \\symh_{t-1} = ${num(a)}$ at every step. What is $\\partial \\symh_{${n}} / \\partial \\symh_0$?${roundNote(places)}`,
        answer: { kind: 'number', value: v, ...(places === undefined ? {} : { places }) },
        traps: apart(v, places, [
          { value: a * n, why: `That multiplies the factor by ${n}. Going back ${n} steps multiplies ${n} factors together: $${num(a)}^{${n}}$.` },
          { value: a ** (n - 1), why: `That is ${n - 1} ${n - 1 === 1 ? 'factor' : 'factors'}. From $\\symh_{${n}}$ back to $\\symh_0$ there are ${n} steps.` },
        ]),
        solution: [
          `The chain rule multiplies one factor per step: ${n} factors of $${num(a)}$ from $\\symh_{${n}}$ back to $\\symh_0$.`,
          `$${num(a)}^{${n}} = ${num(places === undefined ? v : round(v, places))}$${a < 1 ? ': the gradient shrinks.' : ': the gradient grows.'}`,
        ],
      };
    },
  },
  {
    id: 'regime',
    make(rng, d) {
      const options = [
        'It vanishes: the early steps get almost no gradient',
        'It explodes: it grows huge the further back it goes',
        'It keeps roughly its size all the way back',
        'It shrinks for a few steps, then levels off',
      ];
      const lrWhy = 'Every step back multiplies by about the same factor again, so nothing levels off: the product keeps shrinking or growing.';
      if (d >= 0.5 && rng.int(2) === 0) {
        const r = pick(rng, [0.1, 0.05, 0.2, 10, 20, 5]);
        const norms = [1, r, clean(r * r)];
        const grow = r > 1;
        return {
          prompt: `In an RNN unrolled over a long sequence, the gradient's norm is $${norms.map((x) => num(x)).join(',\\ ')}$ at the last step, 10 steps earlier and 20 steps earlier. What is happening to the gradient on its way back?`,
          answer: {
            kind: 'choice',
            options,
            correct: grow ? 1 : 0,
            why: [
              grow ? `The norm grows by $${num(r)}\\times$ every 10 steps: that explodes.` : null,
              grow ? null : `The norm shrinks by $${num(r)}\\times$ every 10 steps: that vanishes.`,
              `It changes by $${num(r)}\\times$ every 10 steps, so after 20 it is $${num(norms[2]!)}$ times what it was.`,
              lrWhy,
            ],
          },
          solution: [
            `Every 10 steps back multiply the norm by $${num(r)}$: a steady ratio, as a product of similar factors gives.`,
            grow ? 'Above 1, the product grows without limit: an exploding gradient, which clipping can tame.' : 'Below 1, the product shrinks toward 0: a vanishing gradient, so the early steps get almost none.',
          ],
        };
      }
      const a = rng.next() < 0.1 ? 1 : pick(rng, [0.3, 0.5, 0.7, 0.8, 0.9, 1.1, 1.2, 1.5, 2, 3]);
      const n = pick(rng, [20, 50, 100]);
      const correct = a < 1 ? 0 : a > 1 ? 1 : 2;
      const pw = `$${num(a)}^{${n}} \\approx ${sci(a ** n)}$`;
      return {
        prompt: `An RNN is unrolled over ${n} steps. Going back one step multiplies the gradient by about $${num(a)}$, at every step. What happens to the gradient that reaches the first step?`,
        answer: {
          kind: 'choice',
          options,
          correct,
          why: [
            correct === 0 ? null : `${pw}, which is not near 0.`,
            correct === 1 ? null : `${pw}, which is not huge.`,
            correct === 2 ? null : `${pw}, far from 1: ${n} factors multiply.`,
            lrWhy,
          ],
        },
        solution: [`Going back ${n} steps multiplies ${n} factors: ${pw}.`, a < 1 ? 'Below 1, the product shrinks toward 0: the gradient vanishes, and the first steps get almost none of it.' : a > 1 ? 'Above 1, the product blows up: the gradient explodes to enormous values.' : 'Exactly 1 keeps the size. Any factor even a little away from 1 shrinks or grows over many steps.'],
      };
    },
  },
  {
    id: 'clip',
    make(rng, d) {
      const three = d >= 0.5 && rng.int(2) === 0;
      const t = pick(rng, three ? TRIPLES3 : TRIPLES2);
      const norm = t[t.length - 1]!;
      const g = t.slice(0, -1).map((x) => (d >= 0.35 && rng.int(2) === 0 ? -x : x));
      const under = d >= 0.5 && rng.int(4) === 0;
      const c = under ? pick(rng, [norm + 1, 2 * norm, 20]) : pick(rng, [1, 1, norm / 2, 2]);
      const scaled = g.map((x) => clean((x * c) / norm));
      const v = under ? g : scaled;
      const ts = under
        ? [{ value: scaled, why: `That rescales anyway. The norm is $${norm}$, already within $c = ${num(c)}$, so clipping leaves $\\symg$ alone: it only ever shrinks.` }]
        : [
            { value: g.map((x) => clean(x / norm)), why: `That divides by the norm but forgets to multiply by $c = ${num(c)}$: it has norm 1, not $c$.` },
            { value: g.map((x) => Math.max(-c, Math.min(c, x))), why: 'That clips each entry on its own, which changes the direction. Clipping by norm scales the whole vector by one factor.' },
            { value: g, why: `That leaves $\\symg$ alone, but its norm, $${norm}$, is above $c = ${num(c)}$, so it must be scaled down.` },
            { value: g.map((x) => x * c), why: `That multiplies by $c$ without dividing by the norm, $${norm}$.` },
          ];
      return {
        prompt: `The gradient is $\\symg = ${vec(g)}$, and the clipping threshold is $c = ${num(c)}$. What is $\\symg$ after clipping by norm? Round to two decimals.`,
        answer: { kind: 'vector', value: v, places: 2 },
        traps: vtraps(v, ts),
        solution: [
          'Clipping by norm leaves $\\symg$ alone unless $\\lVert\\symg\\rVert > c$, and then multiplies it by $c / \\lVert\\symg\\rVert$, which shrinks it to length $c$.',
          `The norm: $\\lVert\\symg\\rVert = \\sqrt{${g.map((x) => (x < 0 ? `(${x})^2` : `${x}^2`)).join(' + ')}} = \\sqrt{${norm * norm}} = ${norm}$.`,
          under
            ? `$${norm} < ${num(c)}$, so nothing happens: $\\symg$ stays $${vec(g)}$.`
            : `$${norm} > ${num(c)}$, so scale every entry by $c / \\lVert\\symg\\rVert = ${num(c)} / ${norm}$: $${vec(v, 2)}$.`,
          'The direction never changes; only the length is capped.',
        ],
      };
    },
  },
  {
    id: 'shared-sum',
    make(rng, d) {
      const n = d < 0.5 ? int(rng, 2, 3) : int(rng, 3, 4);
      for (;;) {
        const gs = Array.from({ length: n }, () => (d < 0.35 ? int(rng, 1, 4) : d < 0.7 ? int(rng, -3, 4) : tenth(rng, -2, 2)));
        const v = clean(gs.reduce((a, b) => a + b, 0));
        const mean = clean(v / n);
        if (v === 0 || new Set(gs).size === 1) continue;
        return {
          prompt: `A one-unit RNN runs for ${n} steps. The gradient of the loss through its weight $\\symWhh$ at each step is ${gs.map((x, i) => `$${num(x)}$ at step ${i + 1}`).join(', ')}. What is the gradient of the loss with respect to $\\symWhh$?`,
          answer: { kind: 'number', value: v },
          traps: apart(v, undefined, [
            { value: gs[n - 1]!, why: 'That is only the last step\'s share. $\\symWhh$ acts at every step, and each use adds its own gradient.' },
            { value: mean, why: 'That is the average. Gradients through several uses of one weight add up.' },
            { value: gs[0]!, why: 'That is only the first step\'s share. Each use of $\\symWhh$ adds its own gradient.' },
          ]),
          solution: [
            'One weight used in several places gets the sum of the gradients through each use, as at any fork in a graph.',
            `$${gs.map((x, i) => (i && x >= 0 ? `+ ${num(x)}` : i ? `- ${num(-x)}` : num(x))).join(' ')} = ${num(v)}$.`,
          ],
        };
      }
    },
  },
];

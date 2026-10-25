import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, round, vec } from '../../kit';
import { vtraps } from '../../backprop/kit';
import { clean, minus, traps, whys } from '../kit';

const C = '\\sym{c}{c}';
const NORM = '\\lVert\\symg\\rVert';

/** Whole-number norms: the entries, then the norm. The first four are the easy ones. */
const TRIPLES2 = [[3, 4, 5], [6, 8, 10], [4, 3, 5], [8, 6, 10], [5, 12, 13], [12, 5, 13], [8, 15, 17], [9, 12, 15]];
const TRIPLES3 = [[1, 2, 2, 3], [2, 3, 6, 7], [2, 6, 9, 11], [4, 4, 7, 9], [2, 1, 2, 3], [6, 2, 3, 7], [1, 4, 8, 9], [4, 4, 2, 6]];

/** A gradient with a whole-number norm: two small entries, then larger, three entries, signs and a scale. */
function gradient(rng: Rng, d: number): { g: number[]; norm: number } {
  const t = pick(rng, d >= 0.5 && rng.int(2) === 0 ? TRIPLES3 : d < 0.35 ? TRIPLES2.slice(0, 4) : TRIPLES2);
  const k = d >= 0.75 ? pick(rng, [1, 2, 10]) : 1;
  const g = t.slice(0, -1).map((x) => (d >= 0.35 && rng.int(2) === 0 ? -x : x) * k);
  return { g, norm: t[t.length - 1]! * k };
}

/** A threshold below the norm whose factor c / norm is a short decimal, or any small one when hard. */
function threshold(rng: Rng, norm: number, d: number): number {
  const nice = [1, 2, 5, 10, norm / 2, norm / 5, norm / 10].filter((c) => c < norm && Math.abs((c / norm) * 100 - Math.round((c / norm) * 100)) < 1e-9);
  return pick(rng, d >= 0.75 ? [...new Set([...nice, 1, 2])].filter((c) => c < norm) : nice);
}

const sq = (g: readonly number[]): string => g.map((x) => (x < 0 ? `(${num(x)})^2` : `${num(x)}^2`)).join(' + ');
const dotSelf = (g: readonly number[]): string => g.map((x) => num(x * x)).join(' + ');
const clip1 = (x: number, c: number): number => Math.max(-c, Math.min(c, x));

/** `g * c / norm`, when the norm is over c. */
const scaled = (g: readonly number[], c: number, norm: number): number[] => g.map((x) => clean((x * c) / norm));

export const generators: Generator[] = [
  {
    id: 'norm',
    make(rng, d) {
      const { g, norm } = gradient(rng, d);
      const s = clean(g.reduce((a, x) => a + x * x, 0));
      const hint = d < 0.35 ? `, the square root of $\\symg \\cdot \\symg$` : '';
      return {
        prompt: `Backprop gives the gradient $\\symg = ${vec(g)}$. What is its norm $${NORM}$${hint}?`,
        answer: { kind: 'number', value: norm },
        traps: traps(norm, [
          { value: s, why: `That is $\\symg \\cdot \\symg$, the sum of the squares. The norm is its square root.` },
          { value: g.reduce((a, x) => a + Math.abs(x), 0), why: 'That adds the sizes of the entries. The norm squares them, adds, and takes the square root: the arrow\'s length, by Pythagoras.' },
          { value: g.reduce((a, x) => a + x, 0), why: 'That adds the entries. The norm squares each one first, so signs cannot cancel, then takes the square root.' },
          { value: Math.max(...g.map(Math.abs)), why: 'That is the largest entry alone. The norm counts every entry: the square root of the sum of their squares.' },
        ]),
        solution: [
          `Dot $\\symg$ with itself: $\\symg \\cdot \\symg = ${sq(g)} = ${dotSelf(g)} = ${num(s)}$.`,
          `Take the square root: $${NORM} = \\sqrt{${num(s)}} = ${num(norm)}$.`,
        ],
      };
    },
  },
  {
    id: 'clip',
    make(rng, d) {
      const { g, norm } = gradient(rng, d);
      const under = d >= 0.5 && rng.int(4) === 0;
      const c = under ? pick(rng, [norm + 1, 2 * norm, 10 * norm]) : threshold(rng, norm, d);
      const v = under ? g : scaled(g, c, norm);
      const rule = d < 0.5 ? ` If $${NORM} > ${C}$, clipping multiplies $\\symg$ by $${C} / ${NORM}$; otherwise it leaves $\\symg$ alone.` : '';
      const ts = under
        ? [
            { value: scaled(g, c, norm), why: `That rescales $\\symg$ to norm $${C}$, which here makes it longer. Its norm, $${num(norm)}$, is within $${C} = ${num(c)}$, so clipping leaves it alone: it only ever shrinks.` },
            { value: g.map((x) => clean(x / norm)), why: `That divides by the norm. Its norm, $${num(norm)}$, is within $${C} = ${num(c)}$, so $\\symg$ stays as it is.` },
          ]
        : [
            { value: g.map((x) => clean(x / norm)), why: `That divides by the norm but leaves out $${C} = ${num(c)}$: it has norm 1, not $${C}$.` },
            { value: g.map((x) => clip1(x, c)), why: `That clips each entry on its own to $[-${num(c)}, ${num(c)}]$, which turns the gradient. Clipping scales the whole vector by one factor, $${C} / ${NORM}$.` },
            { value: g, why: `That leaves $\\symg$ alone, but its norm, $${num(norm)}$, is over $${C} = ${num(c)}$, so it must shrink.` },
            { value: g.map((x) => clean(x * c)), why: `That multiplies by $${C}$ without dividing by the norm, $${num(norm)}$.` },
            { value: g.map((x) => clean((x * norm) / c)), why: `That multiplies by $${NORM} / ${C}$, upside down: it makes the gradient longer.` },
          ];
      return {
        prompt: `Gradient clipping uses the threshold $${C} = ${num(c)}$.${rule} The gradient is $\\symg = ${vec(g)}$. What is $\\symg$ after clipping? Round to two decimals.`,
        answer: { kind: 'vector', value: v, places: 2 },
        traps: vtraps(v, ts, 2),
        solution: [
          `The norm: $${NORM} = \\sqrt{${sq(g)}} = \\sqrt{${num(clean(norm * norm))}} = ${num(norm)}$.`,
          under
            ? `$${num(norm)} \\le ${num(c)}$, so clipping leaves $\\symg$ alone: $${vec(g)}$.`
            : `$${num(norm)} > ${num(c)}$, so multiply every entry by $${C} / ${NORM} = ${num(c)} / ${num(norm)}$: $${vec(v.map((x) => round(x, 2)))}$.`,
          under ? 'Clipping only ever shrinks a gradient; it never stretches one up to the threshold.' : `Every entry shrinks by the same factor, so the direction is the same and the new norm is exactly $${num(c)}$.`,
        ],
      };
    },
  },
  {
    id: 'step',
    make(rng, d) {
      for (;;) {
        const { g, norm } = gradient(rng, d);
        const under = d >= 0.5 && rng.int(4) === 0;
        const c = under ? pick(rng, [norm + 1, 2 * norm]) : threshold(rng, norm, Math.min(d, 0.7));
        const cg = under ? g : scaled(g, c, norm);
        // Keep the step to a couple of decimals: every clipped entry a tenth or a whole number.
        if (!cg.every((x) => Math.abs(x * 10 - Math.round(x * 10)) < 1e-9)) continue;
        const eta = pick(rng, d < 0.35 ? [0.1, 0.5, 1] : [0.1, 0.2, 0.5]);
        const w = g.map(() => (d < 0.35 ? int(rng, 0, 4) : int(rng, -3, 4)));
        const stepv = cg.map((x) => clean(eta * x));
        const v = w.map((x, i) => clean(x - stepv[i]!));
        return {
          prompt: `The weights are $\\symw = ${vec(w)}$ and backprop gives the gradient $\\symg = ${vec(g)}$. The gradient is clipped to norm at most $${C} = ${num(c)}$, then $\\symw$ takes one gradient step with step size $\\symeta = ${num(eta)}$. What is $\\symw$ after the step?`,
          answer: { kind: 'vector', value: v },
          traps: vtraps(v, [
            ...(under ? [] : [{ value: w.map((x, i) => x - eta * g[i]!), why: 'That steps with the unclipped gradient. Clip first, then step with the clipped one.' }]),
            ...(under ? [{ value: w.map((x, i) => x - eta * scaled(g, c, norm)[i]!), why: `That rescales the gradient to norm $${C}$, which here makes it longer. Its norm, $${num(norm)}$, is within $${C}$, so it is used as it is.` }] : []),
            { value: w.map((x, i) => x + stepv[i]!), why: 'That adds $\\symeta\\symg$: a step uphill. The step subtracts it.' },
            { value: w.map((x, i) => x - cg[i]!), why: 'That subtracts the whole clipped gradient, leaving out the step size $\\symeta$.' },
            { value: stepv.map((x) => -x), why: 'That is the step $-\\symeta\\symg$ on its own. Add it to $\\symw$.' },
          ]),
          solution: [
            `The norm: $${NORM} = \\sqrt{${sq(g)}} = ${num(norm)}$.`,
            under ? `$${num(norm)} \\le ${num(c)}$, so the gradient stays $${vec(g)}$.` : `$${num(norm)} > ${num(c)}$, so scale it by $${num(c)} / ${num(norm)}$: $${vec(cg)}$.`,
            `The step: $\\symeta\\,\\symg = ${num(eta)} \\times ${vec(cg)} = ${vec(stepv)}$.`,
            `Subtract it: ${w.map((x, i) => `$${minus(x, stepv[i]!)} = ${num(v[i]!)}$`).join('; ')}, so $\\symw = ${vec(v)}$.`,
          ],
        };
      }
    },
  },
  {
    id: 'entrywise',
    make(rng, d) {
      if (d >= 0.35 && rng.int(2) === 0) return turns(rng, d);
      for (;;) {
        const { g, norm } = gradient(rng, d);
        const c = int(rng, 1, Math.max(...g.map(Math.abs)) - 1);
        const each = g.map((x) => clip1(x, c));
        if (parallel(each, g) || norm <= c) continue;
        const shown = rng.int(2) === 0;
        const options = [
          `Scaling by $${C} / ${NORM}$ keeps the direction of $\\symg$; clipping each entry turns it`,
          `Clipping each entry keeps the direction of $\\symg$; scaling by $${C} / ${NORM}$ turns it`,
          'Both keep the direction of $\\symg$ and only shorten it by different amounts',
          'Both turn $\\symg$, since any clipping changes its direction',
        ];
        const prompt = shown
          ? `Two ways to tame $\\symg = ${vec(g)}$ with $${C} = ${num(c)}$: clip each entry to $[-${num(c)}, ${num(c)}]$ on its own, giving $${vec(each)}$, or multiply all of $\\symg$ by $${C} / ${NORM}$. Which is true?`
          : `The gradient is $\\symg = ${vec(g)}$ and the threshold is $${C} = ${num(c)}$. One way clips each entry to $[-${num(c)}, ${num(c)}]$ on its own; the other multiplies all of $\\symg$ by $${C} / ${NORM}$. Which is true?`;
        const v = scaled(g, c, norm);
        return {
          prompt,
          answer: {
            kind: 'choice',
            options,
            correct: 0,
            why: whys(4, 0, (i) =>
              [
                '',
                `It is the other way round. Multiplying every entry by one factor keeps their ratios, so the arrow points the same way; clipping entries to $${num(c)}$ separately changes their ratios.`,
                `Clipping each entry gives $${vec(each)}$, which is not a multiple of $${vec(g)}$: the entries no longer keep their ratios, so the arrow points elsewhere.`,
                'Multiplying every entry by the same positive factor keeps their ratios, so the arrow keeps its direction and only gets shorter.',
              ][i]!,
            ),
          },
          solution: [
            `Scaling: $${NORM} = ${num(norm)}$, so every entry is multiplied by $${num(c)} / ${num(norm)}$, giving about $${vec(v.map((x) => round(x, 2)))}$: the same ratios, the same direction.`,
            `Each entry on its own: $${vec(each)}$. The entries' ratios change, so this arrow points somewhere else.`,
            'Clipping by the norm caps how far a step goes but keeps the direction the gradient chose.',
          ],
        };
      }
    },
  },
];

/** Whether `a` is a multiple of `b`. */
function parallel(a: readonly number[], b: readonly number[]): boolean {
  return a.every((x, i) => Math.abs(x * b[0]! - a[0]! * b[i]!) < 1e-9);
}

/** Does clipping each entry turn this gradient? Usually, but not when every entry is cut to the same size or none is over c. */
function turns(rng: Rng, d: number) {
  const kind = pick(rng, ['turns', 'turns', 'turns', 'equal', 'none'] as const);
  let g: number[];
  let c: number;
  if (kind === 'equal') {
    const a = int(rng, 3, 9);
    g = (d >= 0.5 && rng.int(2) === 0 ? [a, a, a] : [a, a]).map((x) => (rng.int(2) === 0 ? -x : x));
    c = int(rng, 1, a - 1);
  } else if (kind === 'none') {
    ({ g } = gradient(rng, d));
    const top = Math.max(...g.map(Math.abs));
    const norm = Math.sqrt(g.reduce((s, x) => s + x * x, 0));
    c = top + 1 < norm ? top + 1 : top;
  } else {
    for (;;) {
      ({ g } = gradient(rng, d));
      c = int(rng, 1, Math.max(...g.map(Math.abs)) - 1);
      if (!parallel(g.map((x) => clip1(x, c)), g)) break;
    }
  }
  const each = g.map((x) => clip1(x, c));
  const correct = kind === 'turns' ? 0 : kind === 'equal' ? 1 : 2;
  const over = g.filter((x) => Math.abs(x) > c).length;
  return {
    prompt: `The gradient is $\\symg = ${vec(g)}$. Instead of scaling it by its norm, each entry is clipped on its own to $[-${num(c)}, ${num(c)}]$. Does that change the direction $\\symg$ points in?`,
    answer: {
      kind: 'choice' as const,
      options: [
        'Yes: some entries are cut more than others, so their ratios change',
        'No: every entry is cut to the same size, so the ratios stay',
        `No: no entry is over $${num(c)}$, so nothing changes`,
        'It depends on the step size',
      ],
      correct,
      why: whys(4, correct, (i) =>
        [
          kind === 'equal' ? `Every entry has size $${num(Math.abs(g[0]!))}$ and is cut to $${num(c)}$: one factor for all, so the ratios stay.` : `No entry is over $${num(c)}$, so none is cut at all.`,
          kind === 'turns' ? `Not every entry is cut by the same factor: $${vec(g)}$ becomes $${vec(each)}$, and the ratios change.` : `No entry is over $${num(c)}$, so none is cut at all.`,
          kind === 'turns' ? `${['', 'One entry is', 'Two entries are', 'Three entries are'][over]} over $${num(c)}$: $${vec(g)}$ becomes $${vec(each)}$.` : `Every entry is over $${num(c)}$ and cut to it: $${vec(each)}$.`,
          'The step size scales the whole step after clipping; it cannot turn it. The direction comes from how the entries are cut.',
        ][i]!,
      ),
    },
    solution: [
      `Clip each entry to $[-${num(c)}, ${num(c)}]$: $${vec(g)}$ becomes $${vec(each)}$.`,
      kind === 'turns'
        ? 'That is not a multiple of $\\symg$: the entries were cut by different factors, so the arrow now points elsewhere.'
        : kind === 'equal'
          ? `Every entry was cut by the same factor, $${num(c)} / ${num(Math.abs(g[0]!))}$, so it is a multiple of $\\symg$: the direction stays. That only happens when all the entries have the same size.`
          : `Nothing changed. But $${NORM} = ${num(clean(Math.sqrt(g.reduce((s, x) => s + x * x, 0))))}$ is still over $${num(c)}$: clipping entries one by one can leave a gradient too long.`,
      `Scaling by $${C} / ${NORM}$ keeps the direction every time.`,
    ],
  };
}

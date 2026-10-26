import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, round } from '../../kit';
import { clean, fx, texTable, traps, vtraps, whys } from '../kit';

/** Fractional exponents a learner can be handed, as [fraction, 10^fraction given]. */
const MANT: [number, number][] = [[0.3, 2], [0.5, 3.16], [0.7, 5], [0.9, 7.94]];

const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

/** `10^{k}` in TeX. */
const p10 = (k: number) => `10^{${num(k)}}`;
/** 10^k as a decimal, without float noise: 0.001. */
const dec = (k: number) => clean(10 ** k);

export const generators: Generator[] = [
  {
    id: 'sample',
    make(rng, d) {
      if (d >= 0.5 && rng.next() < 0.3) {
        const lo = int(rng, -6, -3);
        const hi = lo + int(rng, 2, Math.min(4, -1 - lo));
        const v = [lo, hi];
        return {
          prompt: `Learning rates $\\symeta = 10^{u}$ should spread on a log scale between $${num(dec(lo))}$ and $${num(dec(hi))}$. What are the low and high ends of the uniform range for $u$?`,
          answer: { kind: 'vector', value: v },
          traps: vtraps(v, [
            { value: [hi, lo], why: 'Those are the right ends in the wrong order: the low end is the more negative one.' },
            { value: [-lo, -hi], why: `The exponents are negative: $${num(dec(lo))} = ${p10(lo)}$.` },
            { value: [dec(lo), dec(hi)], why: 'Those are the learning rates themselves. $u$ is their exponent: $\\symeta = 10^{u}$.' },
          ]),
          solution: [
            `$${num(dec(lo))} = ${p10(lo)}$ and $${num(dec(hi))} = ${p10(hi)}$.`,
            `So draw $u$ uniformly from $${num(lo)}$ to $${num(hi)}$, and set $\\symeta = 10^{u}$.`,
          ],
        };
      }
      const k = int(rng, d < 0.35 ? -5 : -6, -1);
      if (d < 0.35) {
        const v = dec(k);
        return {
          prompt: `Random search sets $\\symeta = 10^{u}$ and draws $u = ${num(k)}$. What is $\\symeta$?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: dec(k + 1), why: `That is $${p10(k + 1)}$: one decimal place off. $${p10(k)}$ has its 1 in the ${ORD[-k]} place after the point.` },
            { value: dec(k - 1), why: `That is $${p10(k - 1)}$: one decimal place off. $${p10(k)}$ has ${-k - 1} zero${-k - 1 === 1 ? '' : 's'} between the point and the 1.` },
            { value: k, why: 'That is $u$ itself. The learning rate is $10$ to that power.' },
          ]),
          solution: [`$${p10(k)}$ is 1 divided by ${num(dec(-k))}.`, `So $\\symeta = ${num(v)}$.`],
        };
      }
      const [f, m] = d < 0.7 ? MANT[1]! : pick(rng, MANT);
      const u = clean(k + f);
      const v = clean(m * dec(k));
      const places = -k + 2;
      return {
        prompt: `Random search sets $\\symeta = 10^{u}$ and draws $u = ${num(u)}$. What is $\\symeta$? Use $10^{${num(f)}} \\approx ${num(m)}$, and give three significant figures.`,
        answer: { kind: 'number', value: v, places },
        traps: traps(v, [
          { value: m * dec(k + 1), why: `That is $${num(m)} \\times ${p10(k + 1)}$. Split $u$ so the fraction is positive: $${num(u)} = ${num(k)} + ${num(f)}$.` },
          { value: round((dec(k) + dec(k + 1)) / 2, places + 1), why: `That is halfway between $${p10(k)}$ and $${p10(k + 1)}$ on an ordinary scale. A log scale puts $u = ${num(u)}$ at $${num(m)} \\times ${p10(k)}$.` },
          { value: clean(f * dec(k + 1)), why: `That multiplies by the fraction $${num(f)}$ itself. Raise 10 to it: $10^{${num(f)}} \\approx ${num(m)}$.` },
        ]),
        solution: [
          `Split $u$ into a whole part and a positive fraction: $${num(u)} = ${num(k)} + ${num(f)}$.`,
          `So $\\symeta = 10^{${num(f)}} \\times ${p10(k)} \\approx ${num(m)} \\times ${num(dec(k))} = ${num(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'decades',
    make(rng) {
      const lo = int(rng, -6, -3);
      const hi = lo + int(rng, 2, Math.min(4, -1 - lo));
      const N = pick(rng, [20, 50, 100, 200]);
      const logu = rng.next() < 0.5;
      const decades = hi - lo;
      const mid = (lo + hi) / 2;
      const opts = [
        'About the same number in every decade',
        `Most in the top decade, from $${p10(hi - 1)}$ to $${p10(hi)}$`,
        `Most in the bottom decade, from $${p10(lo)}$ to $${p10(lo + 1)}$`,
        `Most near the middle of the range, around $${p10(mid)}$`,
      ];
      const correct = logu ? 0 : 1;
      const reasons = logu
        ? [
            '',
            'That is what drawing $\\symeta$ itself uniformly does. Drawing the exponent gives each decade the same stretch of $u$, so the same share.',
            `No decade is favored: each covers the same length, 1, of the range of $u$, from $${num(lo)}$ to $${num(hi)}$.`,
            '$u$ is uniform, not bunched in the middle, so no part of the range gets extra samples.',
          ]
        : [
            'That is what drawing the exponent does. Drawn uniformly in $\\symeta$ itself, the top decade is 90% of the range\'s length.',
            '',
            `The bottom decade is a tiny stretch of the range: from $${p10(lo)}$ to $${p10(lo + 1)}$ is under ${num(round(100 * dec(lo + 1 - hi), 4))}% of its length.`,
            `$${p10(mid)}$ is the middle on a log scale. Drawn uniformly in $\\symeta$, values that small are rare: about 90% land above $${p10(hi - 1)}$.`,
          ];
      return {
        prompt: logu
          ? `You draw ${N} learning rates as $\\symeta = 10^{u}$, with $u$ uniform between $${num(lo)}$ and $${num(hi)}$. How do they spread over the ${decades} decades from $${p10(lo)}$ to $${p10(hi)}$?`
          : `You draw ${N} learning rates uniformly between $${p10(lo)}$ and $${p10(hi)}$, treating $\\symeta$ itself as uniform. How do they spread over the ${decades} decades of that range?`,
        answer: { kind: 'choice', options: opts, correct, why: whys(4, correct, (i) => reasons[i]!) },
        solution: logu
          ? [`$u$ is uniform on an interval of length ${decades}, and each decade is a stretch of length 1.`, `So each decade gets about $1/${decades}$ of the samples: about ${num(round(N / decades, 1))} of ${N}.`]
          : [
              `Measured plainly, the top decade is $${num(dec(hi))} - ${num(dec(hi - 1))} = ${num(clean(dec(hi) - dec(hi - 1)))}$ long.`,
              `The whole range is $${num(dec(hi))} - ${num(dec(lo))} = ${num(clean(dec(hi) - dec(lo)))}$ long: about $${num(dec(hi))}$.`,
              `So the top decade is about 90% of the range, and gets about 90% of uniform samples.`,
              `${decades === 2 ? 'The lower decade gets' : 'Every lower decade shares'} the last 10%: the small learning rates are barely tried. Drawing the exponent fixes that.`,
            ],
      };
    },
  },
  {
    id: 'grid',
    make(rng) {
      const k = pick(rng, [3, 4, 5, 6, 7]);
      const N = k * k;
      const other = pick(rng, ['the batch size', 'a second hyperparameter']);
      const lo = int(rng, -6, -4);
      const hi = lo + int(rng, 3, 4);
      const opts = [
        `Random search tries ${N} different learning rates; the grid tries only ${k}`,
        `Random search tries more combinations of the two in total`,
        'Random search reaches values beyond the range the grid covers',
        'It does not: a grid covers the space more evenly, so it does better',
      ];
      const reasons = [
        '',
        `Both run ${N} trainings, so both try ${N} combinations. The difference is how many distinct values of the one that matters they include.`,
        'Both draw from the same range; random search just places its points differently.',
        `Evenly over both, yes, but projected onto the learning rate the grid's ${N} points land on just ${k} values, each tried ${k} times.`,
      ];
      return {
        prompt: `You can afford ${N} training runs to tune two hyperparameters: the learning rate, searched between $${p10(lo)}$ and $${p10(hi)}$, which matters a lot, and ${other}, which barely matters. Why does random search over both tend to beat a ${k} by ${k} grid?`,
        answer: { kind: 'choice', options: opts, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
        solution: [
          `A ${k} by ${k} grid uses ${k} learning rates, each paired with ${k} values of ${other}.`,
          `Since ${other} barely matters, those ${k} pairings mostly repeat the same result: only ${k} distinct experiments on the learning rate.`,
          `Random search draws a fresh learning rate for every run: ${N} distinct values in the same ${N} runs.`,
        ],
      };
    },
  },
  {
    id: 'pick-run',
    make(rng, d) {
      const n = d < 0.5 ? 3 : 4;
      const withTest = d >= 0.6;
      for (;;) {
        const etas = rng.shuffle([-1, -2, -3, -4, -5]).slice(0, n);
        const tr = Array.from({ length: n }, () => round(0.05 + 0.9 * rng.next(), 2));
        const va = tr.map((t) => round(t + 0.05 + 0.6 * rng.next(), 2));
        const te = va.map((v) => round(v + (rng.next() - 0.5) * 0.12, 2));
        const bv = va.indexOf(Math.min(...va));
        const bt = tr.indexOf(Math.min(...tr));
        const be = te.indexOf(Math.min(...te));
        if (bv === bt || new Set(va).size < n || new Set(tr).size < n) continue;
        if (withTest && (be === bv || be === bt || new Set(te).size < n)) continue;
        const L = 'ABCD';
        const head = ['\\text{run}', '\\symeta', '\\text{train}', '\\text{val}', ...(withTest ? ['\\text{test}'] : [])];
        const rows = etas.map((e, i) => [`\\text{${L[i]}}`, p10(e), fx(tr[i]!, 2), fx(va[i]!, 2), ...(withTest ? [fx(te[i]!, 2)] : [])]);
        const opts = etas.map((_, i) => `Run ${L[i]}`);
        const why = whys(n, bv, (i) =>
          i === bt
            ? `Run ${L[i]} has the lowest training loss, which rewards memorizing the training set. Choices are made on validation loss, where run ${L[bv]} is lowest.`
            : withTest && i === be
              ? `Run ${L[i]} has the lowest test loss, but choosing by it uses the test split to make a decision, so its number no longer measures unseen data.`
              : `Run ${L[i]}'s validation loss is $${fx(va[i]!, 2)}$, above run ${L[bv]}'s $${fx(va[bv]!, 2)}$.`,
        );
        return {
          prompt: `Each run trains the same model with a different learning rate, on the training split. Their final losses:\n\n$$${texTable(head, rows)}$$\n\nWhich run's learning rate should you keep?`,
          answer: { kind: 'choice', options: opts, correct: bv, why },
          solution: [
            'Hyperparameters are chosen on the validation split: data the weights were not fit on.',
            `The lowest validation loss is run ${L[bv]}'s, $${fx(va[bv]!, 2)}$, so keep $\\symeta = ${p10(etas[bv]!)}$.`,
            withTest ? 'The test column should not be looked at for this choice: it is for the final report, once.' : `Run ${L[bt]}'s lower training loss only shows it fit its training examples more closely.`,
          ],
        };
      }
    },
  },
];

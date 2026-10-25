import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { num, pick, round, vec } from '../../kit';
import { D, big, clean, traps, vtraps, whys } from '../modern-kit';

/** Every arrangement and sign pattern of `base`. */
function variants(base: number[]): number[][] {
  const out = new Map<string, number[]>();
  const perm = (rest: number[], acc: number[]) => {
    if (!rest.length) {
      for (let m = 0; m < 1 << acc.length; m++) {
        const v = acc.map((x, i) => ((m >> i) & 1 ? -x : x));
        out.set(v.join(), v);
      }
      return;
    }
    rest.forEach((x, i) => perm([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, x]));
  };
  perm(base, []);
  return [...out.values()];
}

// Vectors whose root mean square is a whole number: 5 for most, 3 for the last two.
const FIVES = [[1, 7], [1, 5, 7], [1, 1, 7, 7], [1, 5, 5, 7]].flatMap(variants);
const THREES = [[1, 1, 5], [1, 1, 3, 5]].flatMap(variants);
const allPos = (v: number[]) => v.every((x) => x > 0);

const ms = (x: number[]) => clean(x.reduce((a, v) => a + v * v, 0) / x.length);
const mean = (x: number[]) => x.reduce((a, v) => a + v, 0) / x.length;
const sd = (x: number[]) => {
  const m = mean(x);
  return Math.sqrt(x.reduce((a, v) => a + (v - m) ** 2, 0) / x.length);
};
const squares = (x: number[]) => x.map((v) => `${v < 0 ? `(${v})` : v}^2`).join(' + ');

/** A vector with a clean RMS: positive at first, then any signs, then a root of 3. */
function clean5(rng: Rng, d: number): number[] {
  if (d < 0.35) return pick(rng, FIVES.filter(allPos));
  if (d < 0.7) return pick(rng, FIVES);
  return pick(rng, [...FIVES, ...THREES]);
}

export const generators: Generator[] = [
  {
    id: 'rms',
    make(rng, d) {
      let x: number[];
      let r: number;
      let hint = '';
      if (d < 0.8) {
        x = clean5(rng, d);
        r = Math.sqrt(ms(x));
      } else {
        for (;;) {
          x = Array.from({ length: pick(rng, [3, 4]) }, () => pick(rng, [-4, -3, -2, -1, 1, 2, 3, 4]));
          const m = ms(x);
          if (Number.isInteger(Math.sqrt(m)) || Math.abs(m * 2 - Math.round(m * 2)) > 1e-9) continue;
          r = Math.sqrt(m);
          hint = `\n\nUse $\\sqrt{${num(m)}} \\approx ${num(round(r, 2), 2)}$.`;
          break;
        }
      }
      const places = hint ? 2 : undefined;
      const m = ms(x);
      const ts = [
        { value: m, why: 'That is the mean of the squares. Take its square root to get back to the size of an entry.' },
        { value: x.reduce((a, v) => a + Math.abs(v), 0) / x.length, why: 'That averages the sizes of the entries. The RMS squares them first, so large entries count for more.' },
        { value: Math.sqrt(m * x.length), why: `That is the root of the sum of the squares. Divide the sum by $${D}$ before the root.` },
      ];
      if (Math.abs(mean(x)) > 1e-9) ts.push({ value: sd(x), why: 'That subtracts the mean first: the standard deviation, which layer norm divides by. RMSNorm skips the mean.' });
      return {
        prompt: `A token's vector is $\\symx = ${vec(x)}$. What is its root mean square?${places ? ' Round to two decimals.' : ''}${hint}`,
        answer: { kind: 'number', value: r, places },
        traps: traps(r, ts, places),
        solution: [
          `Square every entry: $${squares(x)} = ${num(clean(m * x.length))}$.`,
          `Average over the $${D} = ${x.length}$ entries: $${num(clean(m * x.length))} / ${x.length} = ${num(m)}$.`,
          `Take the square root: $\\sqrt{${num(m)}} ${places ? '\\approx' : '='} ${num(round(r, 2), places)}$.`,
        ],
      };
    },
  },
  {
    id: 'normalize',
    make(rng, d) {
      const x = clean5(rng, d);
      const r = Math.sqrt(ms(x));
      const gain = d < 0.5 ? x.map(() => 1) : x.map(() => pick(rng, [1, 2, 0.5, 1, 3]));
      const ones = gain.every((g) => g === 1);
      const ans = x.map((v, i) => (v / r) * gain[i]!);
      const m = mean(x);
      const s = sd(x);
      const ts = [
        { value: x.map((v, i) => (v / ms(x)) * gain[i]!), why: 'That divides by the mean square. RMSNorm divides by its square root.' },
        { value: x.map((v, i) => ((v - m) / s) * gain[i]!), why: 'That is layer norm: it subtracts the mean and divides by the standard deviation. RMSNorm only divides by the RMS.' },
      ];
      if (!ones) ts.push({ value: x.map((v) => v / r), why: 'That leaves out the gains. Multiply each entry by its $\\symgamma_i$ last.' });
      return {
        prompt: `What does RMSNorm output for $\\symx = ${vec(x)}$ ${ones ? 'with every gain at 1' : `with gains $\\symgamma = ${vec(gain)}$`}? Round to two decimals.`,
        answer: { kind: 'vector', value: ans, places: 2 },
        traps: vtraps(ans, ts, 2),
        solution: [
          `RMSNorm divides by the root mean square, then multiplies by the gains. Mean of the squares: $(${squares(x)}) / ${x.length} = ${num(ms(x))}$, so the RMS is $\\sqrt{${num(ms(x))}} = ${num(r)}$.`,
          `Divide each entry by ${num(r)}: $${vec(x.map((v) => round(v / r, 2)))}$.`,
          ones ? 'The gains are all 1, so that is the output. Its RMS is exactly 1.' : `Multiply by the gains: $${vec(ans.map((v) => round(v, 2)))}$.`,
        ],
      };
    },
  },
  {
    id: 'drops',
    make(rng) {
      const x = pick(rng, FIVES.filter((v) => v.length > 2));
      const c = pick(rng, [2, 3, 5, 10]);
      const kind = rng.int(3);
      if (kind === 0) {
        const options = ['Subtracting the mean, and the learned shift $\\symbeta$', 'Dividing by the spread of the entries', 'The learned gains $\\symgamma$', 'Normalizing each token on its own'];
        const reasons = [
          '',
          'That is the part RMSNorm keeps: it divides by the root mean square.',
          'RMSNorm keeps one learned gain per feature.',
          'Both normalize each token across its own features. It is batch norm that uses the rest of the batch.',
        ];
        return {
          prompt: `Next to layer norm over a token's $${D} = ${pick(rng, [64, 128, 256, 512, 768, 1024])}$ features, what does RMSNorm leave out?`,
          answer: { kind: 'choice', options, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
          solution: [
            `RMSNorm divides by the root mean square, $\\sqrt{\\tfrac{1}{${D}}\\sum_i \\symx_i^2}$, and multiplies by $\\symgamma$.`,
            'It never subtracts the mean, and it has no $\\symbeta$. Re-scaling turned out to be the part that matters.',
          ],
        };
      }
      if (kind === 1) {
        const options = [`Multiplying every entry by ${c}`, `Adding ${c} to every entry`, `Adding ${c} to the first entry only`, `Multiplying the first entry by ${c}`];
        const reasons = [
          '',
          `RMSNorm does not subtract the mean, so a shift changes its output. Layer norm would ignore it.`,
          'That changes one entry against the others, so the normalized vector changes too.',
          'That changes one entry against the others, so the normalized vector changes too.',
        ];
        return {
          prompt: `A token's vector $\\symx = ${vec(x)}$ goes through RMSNorm with every gain at 1. Which change to $\\symx$ leaves the output exactly the same?`,
          answer: { kind: 'choice', options, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
          solution: [
            `Multiplying by ${c} multiplies the RMS by ${c} too: $\\sqrt{\\text{mean}((${c}\\symx)^2)} = ${c}\\,\\text{RMS}(\\symx)$.`,
            `So $${c}\\symx / (${c}\\,\\text{RMS}) = \\symx / \\text{RMS}$: the output is unchanged. A shift has no such cancellation, because RMSNorm keeps the mean.`,
          ],
        };
      }
      const options = [`Adding ${c} to every entry`, `Multiplying every entry by ${c}`, `Doubling every gain $\\symgamma_i$`, 'Changing a different token in the batch'];
      const reasons = [
        '',
        'Both divide by a spread that grows with the entries, so scaling changes neither output.',
        'Both norms multiply by the same gains, so both outputs double.',
        'Neither norm looks at other tokens: each token is normalized on its own.',
      ];
      return {
        prompt: `A token's vector is $\\symx = ${vec(x)}$. Which change leaves layer norm's output the same but changes RMSNorm's?`,
        answer: { kind: 'choice', options, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
        solution: [
          `Layer norm subtracts the mean first, so adding ${c} to every entry is undone at once.`,
          `RMSNorm keeps the mean: adding ${c} changes every squared entry and every ratio, so its output moves.`,
        ],
      };
    },
  },
  {
    id: 'params',
    make(rng, d) {
      const dim = pick(rng, [256, 512, 768, 1024, 2048, 4096]);
      if (d < 0.4) {
        return {
          prompt: `An RMSNorm normalizes vectors of $${D} = ${big(dim)}$ features. How many learned parameters does it have?`,
          answer: { kind: 'number', value: dim },
          traps: traps(dim, [
            { value: 2 * dim, why: 'That is layer norm\'s count: a gain and a shift per feature. RMSNorm has only the gains.' },
            { value: 0, why: 'RMSNorm still learns one gain per feature.' },
            { value: dim * dim, why: 'There is no matrix: one gain per feature, multiplied entry by entry.' },
          ]),
          solution: [`RMSNorm learns one gain $\\symgamma_i$ per feature and no shift: $${big(dim)}$ parameters.`],
        };
      }
      const n = pick(rng, [13, 25, 33, 49, 65]);
      const fewer = rng.next() < 0.5;
      const ans = n * dim;
      return {
        prompt: fewer
          ? `A network has ${n} normalization layers, each over $${D} = ${big(dim)}$ features. Swapping every layer norm for an RMSNorm saves how many learned parameters?`
          : `A network has ${n} RMSNorms, each over $${D} = ${big(dim)}$ features. How many learned parameters do they hold in all?`,
        answer: { kind: 'number', value: ans },
        traps: traps(ans, [
          { value: 2 * ans, why: fewer ? 'That is all of the layer norms\' parameters. RMSNorm keeps the gains, so only the shifts go.' : 'That is what layer norms would hold: a gain and a shift per feature.' },
          { value: dim, why: `That is one norm. There are ${n}.` },
          { value: n * dim * dim, why: 'There is no matrix: one number per feature.' },
        ]),
        solution: fewer
          ? [`A layer norm has $2${D}$ parameters (gains and shifts); an RMSNorm has $${D}$ (gains only).`, `Each swap saves $${D} = ${big(dim)}$, so $${n} \\times ${big(dim)} = ${big(ans)}$ in all.`]
          : [`Each RMSNorm has one gain per feature: $${big(dim)}$.`, `$${n} \\times ${big(dim)} = ${big(ans)}$.`],
      };
    },
  },
];

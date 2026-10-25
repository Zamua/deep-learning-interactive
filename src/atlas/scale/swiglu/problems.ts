import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, round, vec } from '../../kit';
import { D, big, clean, traps, vtraps, whys } from '../modern-kit';

/** The sigmoid at the integers the problems use, to two decimals, as the prompts give it. */
const SIG: Record<number, number> = { [-3]: 0.05, [-2]: 0.12, [-1]: 0.27, 0: 0.5, 1: 0.73, 2: 0.88, 3: 0.95 };
const sig = (z: number) => SIG[z]!;
const paren = (x: number) => (x < 0 ? `(${num(x)})` : num(x));

export const generators: Generator[] = [
  {
    id: 'gate',
    make(rng, d) {
      const n = d < 0.4 ? 2 : 3;
      const a = Array.from({ length: n }, () => (d < 0.4 ? int(rng, 0, 2) : int(rng, -2, 3)));
      const b = Array.from({ length: n }, () => (d < 0.4 ? int(rng, 1, 3) : pick(rng, [-3, -2, -1, 1, 2, 3])));
      const sw = a.map((z) => clean(z * sig(z)));
      const ans = sw.map((v, i) => clean(v * b[i]!));
      const zs = [...new Set(a)].sort((p, q) => p - q);
      return {
        prompt: `In a gated MLP, one token's two projections are $a = ${vec(a)}$ (the gate) and $b = ${vec(b)}$. Each hidden unit outputs $\\operatorname{swish}(a_i)\\,b_i$, where $\\operatorname{swish}(z) = z\\,\\sigma(z)$. What are the hidden units? Round to two decimals.\n\nUse ${zs.map((z) => `$\\sigma(${z}) ${z === 0 ? '=' : '\\approx'} ${num(sig(z))}$`).join(', ')}.`,
        answer: { kind: 'vector', value: ans, places: 2 },
        traps: vtraps(ans, [
          { value: a.map((z, i) => z * b[i]!), why: 'That multiplies $a$ by $b$ with no gate. Swish first scales each $a_i$ by $\\sigma(a_i)$.' },
          { value: a.map((z, i) => sig(z) * b[i]!), why: 'That gates with $\\sigma(a_i)$ alone. Swish is $a_i$ times $\\sigma(a_i)$.' },
          { value: sw, why: 'That is $\\operatorname{swish}(a)$ alone. Multiply each entry by its $b_i$.' },
        ], 2),
        solution: [
          `Swish each gate entry: ${a.map((z, i) => `$${paren(z)} \\times ${num(sig(z))} = ${num(sw[i]!)}$`).join(', ')}.`,
          `Multiply by $b$ entry by entry: ${sw.map((v, i) => `$${paren(v)} \\times ${paren(b[i]!)} = ${num(ans[i]!)}$`).join(', ')}.`,
          `So the hidden units are $${vec(ans.map((v) => round(v, 2)))}$.`,
        ],
      };
    },
  },
  {
    id: 'params',
    make(rng, d) {
      const relu = rng.next() < 0.4;
      const dim = d < 0.4 ? pick(rng, [10, 20, 30, 50, 100]) : pick(rng, [60, 120, 300, 600, 768, 1200]);
      if (relu) {
        const ans = 8 * dim * dim;
        return {
          prompt: `A block's ReLU MLP widens each token from $${D} = ${big(dim)}$ to $4${D}$ hidden units and back. How many weights do its two matrices hold, ignoring biases?`,
          answer: { kind: 'number', value: ans },
          traps: traps(ans, [
            { value: 4 * dim * dim, why: `That is one matrix, $${D} \\times 4${D}$. The MLP has two: up and back down.` },
            { value: 12 * dim * dim, why: 'That counts three matrices, as in a gated MLP. The ReLU MLP has two.' },
            { value: 2 * dim * dim, why: `That uses a hidden width of $${D}$. It is $4${D}$.` },
          ]),
          solution: [
            `Up: $${D} \\times 4${D}$ weights; down: $4${D} \\times ${D}$. Together $2 \\cdot ${D} \\cdot 4${D} = 8${D}^2$.`,
            `$8 \\times ${big(dim)}^2 = ${big(ans)}$.`,
          ],
        };
      }
      const h = d < 0.4 ? pick(rng, [2, 3, 4]) * dim : (8 * dim) / 3;
      const ans = 3 * dim * h;
      return {
        prompt: `A gated MLP maps $${D} = ${big(dim)}$ features to $h = ${big(h)}$ hidden units with two matrices, the gate and the up projection, and back to $${D}$ with a third. How many weights does it hold, ignoring biases?`,
        answer: { kind: 'number', value: ans },
        traps: traps(ans, [
          { value: 2 * dim * h, why: 'That counts two matrices. A gated MLP has three: gate, up and down.' },
          { value: dim * h, why: 'That is one matrix. There are three of that size.' },
          { value: 8 * dim * dim, why: `That is the ReLU MLP's $8${D}^2$. Count the gated one's three matrices instead.` },
        ]),
        solution: [
          `Gate and up are each $${D} \\times h$; down is $h \\times ${D}$: $3${D}h$ in all.`,
          `$3 \\times ${big(dim)} \\times ${big(h)} = ${big(ans)}$.`,
          ...(d < 0.4 ? [] : [`With $h = \\tfrac{8}{3}${D}$ that is $8${D}^2$: the same as a ReLU MLP of width $4${D}$.`]),
        ],
      };
    },
  },
  {
    id: 'width',
    make(rng, d) {
      const dim = d < 0.5 ? pick(rng, [30, 60, 90, 150, 300, 600]) : pick(rng, [384, 480, 768, 960, 1536, 3072]);
      const ans = (8 * dim) / 3;
      return {
        prompt: `A block's ReLU MLP has hidden width $4${D}$, with $${D} = ${big(dim)}$. A gated MLP replaces it, with three matrices of shape $${D} \\times h$ or $h \\times ${D}$. What hidden width $h$ gives it the same number of weights?`,
        answer: { kind: 'number', value: ans },
        traps: traps(ans, [
          { value: 4 * dim, why: `That keeps the old width $4${D}$. With a third matrix the gated MLP would then be half again as big.` },
          { value: 6 * dim, why: `That is $4${D} \\times \\tfrac{3}{2}$: the ratio upside down. Three matrices must be narrower than two.` },
          { value: (4 * dim) / 3, why: `That splits $4${D}$ in three. The old MLP has two matrices, $8${D}^2$ weights, so $3${D}h = 8${D}^2$.` },
        ]),
        solution: [
          `The ReLU MLP holds $2 \\cdot ${D} \\cdot 4${D} = 8${D}^2$ weights; the gated one holds $3${D}h$.`,
          `Set them equal: $3${D}h = 8${D}^2$, so $h = \\tfrac{8}{3}${D}$.`,
          `$\\tfrac{8}{3} \\times ${big(dim)} = ${big(ans)}$.`,
        ],
      };
    },
  },
  {
    id: 'why',
    make(rng) {
      if (rng.next() < 0.5) {
        const dim = pick(rng, [384, 768, 1536, 3072, 4608, 6144]);
        const options = [
          `Its three matrices then hold as many weights as the old two at width $4${D}$`,
          'The gate switches off about a third of the hidden units',
          'Swish is unstable unless the hidden layer is kept narrow',
          'Multiplying two projections makes each hidden unit three times as costly',
        ];
        const reasons = [
          '',
          'The gate scales units smoothly; it does not remove a fixed share of them. The width is set by the weight count.',
          'Swish is a smooth, well-behaved function. The narrower width only pays for the third matrix.',
          'Each hidden unit costs three weights per input feature instead of two, not three times as much: that is exactly what the narrower width makes up for.',
        ];
        return {
          prompt: `With $${D} = ${big(dim)}$, a gated MLP often uses $h = ${big((8 * dim) / 3)}$ hidden units, not $4${D} = ${big(4 * dim)}$. Why?`,
          answer: { kind: 'choice', options, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
          solution: [
            `A gated MLP has three matrices (gate, up, down) where the ReLU MLP had two: $3${D}h$ weights against $2 \\cdot ${D} \\cdot 4${D} = 8${D}^2$.`,
            `They match at $h = \\tfrac{8}{3}${D} = ${big((8 * dim) / 3)}$, so the swap costs no extra weights or arithmetic.`,
          ],
        };
      }
      const z = pick(rng, [-8, -7, -6, -5, 5, 6, 7, 8]);
      const neg = z < 0;
      const options = neg
        ? ['Close to 0, like a ReLU', `Close to $${z}$, like the identity`, 'Exactly 0.5', 'Close to 1']
        : [`Close to $${z}$, like a ReLU`, 'Close to 0', 'Exactly 0.5', 'Close to 1'];
      const reasons = neg
        ? ['', `That is swish for large positive inputs. Here $\\sigma(${z})$ is nearly 0, which pulls the product to 0.`, 'That is $\\sigma(0)$, the sigmoid at zero, not swish at $' + z + '$.', 'That is what $\\sigma$ approaches for large positive inputs; here it is near 0.']
        : ['', `That is swish for large negative inputs. Here $\\sigma(${z})$ is nearly 1, so swish is nearly $${z}$ itself.`, 'That is $\\sigma(0)$, the sigmoid at zero, not swish at $' + z + '$.', 'That is $\\sigma(' + z + ')$ alone. Swish multiplies it by $' + z + '$.'];
      return {
        prompt: `Swish is $\\operatorname{swish}(z) = z\\,\\sigma(z)$. What is it, roughly, at $z = ${z}$?`,
        answer: { kind: 'choice', options, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
        solution: [
          neg ? `$\\sigma(${z})$ is nearly 0, so $z\\,\\sigma(z)$ is nearly 0: a large negative input is shut off.` : `$\\sigma(${z})$ is nearly 1, so $z\\,\\sigma(z)$ is nearly $${z}$: a large positive input passes through.`,
          'Swish is a smooth ReLU: near 0 far to the left, near $z$ far to the right, with a soft bend and a small dip below 0 in between.',
        ],
      };
    },
  },
];

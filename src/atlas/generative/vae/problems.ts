import type { Generator } from '../../../mastery/domain/types';
import { big, clean, int, num, par, pick, round, shuffled, tenth, traps, vec, vtraps } from '../../kit';

const MU = '\\sym{mu}{\\mu}';
const SIG = '\\sym{sigma}{\\sigma}';
const EPS = '\\sym{eps}{\\epsilon}';
const Z = '\\sym{z}{z}';

/** The extra term for one code dimension: 1/2 (mu^2 + sigma^2 - 1 - ln sigma^2). */
const kl = (mu: number, s: number) => 0.5 * (mu * mu + s * s - 1 - Math.log(s * s));

export const generators: Generator[] = [
  {
    id: 'sample',
    make(rng, d) {
      const n = d < 0.5 ? 2 : 3;
      const mu = Array.from({ length: n }, () => (d < 0.35 ? int(rng, -2, 2) : tenth(rng, -2, 2)));
      const variance = d >= 0.7;
      const sig = Array.from({ length: n }, () => (d < 0.35 ? pick(rng, [0.5, 1, 2]) : pick(rng, [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 0.9, 1.5])));
      const eps = Array.from({ length: n }, () => (d < 0.35 ? int(rng, -2, 2) : tenth(rng, -2, 2)));
      const v = mu.map((m, i) => clean(m + sig[i]! * eps[i]!));
      const vars = sig.map((s) => clean(s * s));
      const given = variance
        ? `A VAE's encoder gives the means $${MU} = ${vec(mu)}$ and the variances $${SIG}^2 = ${vec(vars)}$`
        : `A VAE's encoder gives the means $${MU} = ${vec(mu)}$ and the spreads $${SIG} = ${vec(sig)}$`;
      return {
        prompt: `${given}, and the noise drawn is $${EPS} = ${vec(eps)}$. What code $${Z}$ goes to the decoder?${d >= 0.35 ? ' Round to two decimals.' : ''}`,
        answer: { kind: 'vector', value: v, places: 2 },
        traps: vtraps(
          v,
          [
            { value: mu.map((m, i) => m + eps[i]!), why: `That adds the noise without scaling it. Multiply $${EPS}$ by the spread $${SIG}$ first.` },
            { value: mu.map((m, i) => sig[i]! + m * eps[i]!), why: `That scales the mean instead of the noise. The noise is stretched by $${SIG}$, then shifted by $${MU}$: $${MU} + ${SIG}${EPS}$.` },
            ...(variance ? [{ value: mu.map((m, i) => m + vars[i]! * eps[i]!), why: `That scales the noise by the variance $${SIG}^2$. Take its square root first: $${SIG} = ${vec(sig)}$.` }] : []),
            { value: mu.map((m, i) => m - sig[i]! * eps[i]!), why: `That subtracts the noise. The code is $${MU} + ${SIG}${EPS}$.` },
          ],
          2,
        ),
        solution: [
          ...(variance ? [`The spreads are the square roots of the variances: $${SIG} = ${vec(sig)}$.`] : []),
          `The code is $${Z} = ${MU} + ${SIG}${EPS}$. Stretch the noise by the spreads: $${SIG}${EPS} = ${vec(sig.map((s, i) => clean(s * eps[i]!)))}$.`,
          `Shift it by the means: $${Z} = ${vec(v)}$.`,
          'Each dimension has its own mean and spread, so each is stretched and shifted on its own.',
        ],
      };
    },
  },
  {
    id: 'why-noise',
    make(rng) {
      const mu = tenth(rng, -2, 2);
      const sig = pick(rng, [0.1, 0.2, 0.3, 0.4, 0.5, 0.8]);
      const kind = pick(rng, ['noise', 'trick', 'zero'] as const);
      const lead = `For one input, a VAE's encoder gives $${MU} = ${num(mu)}$ and $${SIG} = ${num(sig)}$ for one code dimension.`;
      if (kind === 'noise')
        return {
          prompt: `${lead} During training, the decoder gets a fresh random code near $${num(mu)}$ each time, instead of $${MU}$ itself. Why add the noise?`,
          answer: shuffled(rng, [
            { text: `So the decoder must rebuild the input from any code near ${num(mu)}, and nearby codes decode alike`, why: null },
            { text: 'To make the reconstruction error smaller, since noisy codes are easier to decode', why: 'The noise makes reconstruction harder, not easier: the decoder never sees the exact code. The point is what that forces.' },
            { text: 'Because the decoder cannot read the mean directly and needs a random number', why: `The decoder would take $${MU}$ as happily as any code. The noise is there to teach it about the codes around $${MU}$.` },
            { text: 'So that the encoder gets no gradient, and its weights stay as they started', why: `The encoder still gets a gradient: $${Z}$ is $${MU}$ plus $${SIG}$ times the noise, and backprop flows through both.` },
          ]),
          solution: [
            `The decoder sees a different code near $${num(mu)}$ every time, spread by $${SIG} = ${num(sig)}$.`,
            'To keep the loss low it must rebuild the same input from all of them, so a whole neighborhood of codes decodes to similar inputs.',
            'That smoothness is what lets new codes, never seen in training, decode to something sensible.',
          ],
        };
      if (kind === 'trick')
        return {
          prompt: `${lead} The code is computed as $${Z} = ${MU} + ${SIG}${EPS}$, rather than drawn directly as a random number with mean $${num(mu)}$ and spread $${num(sig)}$. Why write it that way?`,
          answer: shuffled(rng, [
            { text: 'The noise holds all the randomness and has no weights, so gradients reach the mean and spread', why: null },
            { text: 'It gives codes with a different spread, closer to what the data needs', why: `It gives the same codes: stretching standard noise by ${num(sig)} and shifting it by ${num(mu)} is exactly a draw with that mean and spread.` },
            { text: 'It keeps every code positive, which the decoder needs in order to work', why: `Codes can be negative: with a negative noise draw, $${num(mu)} + ${num(sig)} \\cdot ${EPS}$ goes below $${num(mu)}$.` },
            { text: 'So the noise itself can be learned, along with the encoder\'s weights', why: 'The noise is drawn fresh every time and never trained. What is learned are the weights that make the mean and the spread.' },
          ]),
          solution: [
            `Stretching standard noise by $${SIG}$ and shifting it by $${MU}$ gives a code with exactly that mean and spread.`,
            `Written this way, $${Z}$ is an ordinary node in the graph: its slope is 1 with respect to $${MU}$ and $${EPS}$ with respect to $${SIG}$.`,
            'The random part, the noise, has no parameters, so backprop can pass straight through to the encoder.',
          ],
        };
      return {
        prompt: `${lead} Suppose training drove every $${SIG}$ to $0$. What would the VAE become?`,
        answer: shuffled(rng, [
          { text: 'A plain autoencoder: each input gets one exact code', why: null },
          { text: 'A model whose codes are pure noise, whatever the input', why: `With $${SIG} = 0$ the noise is multiplied by 0 and vanishes: the code is exactly $${MU}$.` },
          { text: 'A model whose codes are all zero, for every input', why: `$${SIG} = 0$ removes the noise, not the mean: the code is $${MU}$, here $${num(mu)}$.` },
          { text: 'Nothing would change: it would still work as a VAE', why: 'The noise is what made it differ from an autoencoder. Without it the decoder only ever sees the exact means.' },
        ]),
        solution: [
          `With $${SIG} = 0$, $${Z} = ${MU} + 0 \\cdot ${EPS} = ${MU}$: no noise at all.`,
          'Each input then has one exact code, as in a plain autoencoder, and nothing makes nearby codes decode alike.',
          'That is one reason for the extra loss term: it keeps the spreads from collapsing to 0.',
        ],
      };
    },
  },
  {
    id: 'pull',
    make(rng, d) {
      const kind = d < 0.4 || rng.next() < 0.4 ? 'toward' : 'least';
      if (kind === 'toward') {
        const mu = tenth(rng, -3, 3);
        const sig = pick(rng, [0.05, 0.1, 0.2, 0.3, 2, 3]);
        return {
          prompt: `For one input, a VAE's encoder gives $${MU} = ${num(mu)}$ and $${SIG} = ${num(sig)}$. Besides the reconstruction error, the VAE's loss has an extra term on these two numbers. Which way does that term pull them?`,
          answer: shuffled(rng, [
            { text: `$${MU}$ toward 0 and $${SIG}$ toward 1`, why: null },
            { text: `$${MU}$ toward 0 and $${SIG}$ toward 0`, why: `A spread of 0 would make the code exact, as in a plain autoencoder. The term pulls $${SIG}$ toward 1, the spread of a standard normal.` },
            { text: `$${MU}$ toward the input's own values and $${SIG}$ toward 1`, why: `The term does not look at the input. It compares every code with the same target: a standard normal, mean 0.` },
            { text: `$${SIG}$ as large as possible, with $${MU}$ left alone`, why: `A very wide spread is penalized too: the term is smallest at $${SIG} = 1$, and it also pulls $${MU}$ toward 0.` },
          ]),
          solution: [
            `The extra term compares each code's mean and spread with a standard normal, the distribution \`np.random.randn\` draws from: mean 0, spread 1.`,
            `It is zero only at $${MU} = 0$, $${SIG} = 1$, so it pulls $${num(mu)}$ toward 0 and $${num(sig)}$ toward 1.`,
            'With every input\'s codes pulled into the same region, a fresh code from `np.random.randn` lands where the decoder knows what to do.',
          ],
        };
      }
      const pool: [number, number][] = [
        [0, pick(rng, [0.1, 0.2, 0.3])],
        [pick(rng, [-2, -1.5, 1.5, 2, 2.5]), 1],
        [0, pick(rng, [2.5, 3, 4])],
        [pick(rng, [1, -1, 0.5]), pick(rng, [0.1, 0.2])],
      ];
      const opts = [[0, 1] as [number, number], ...rng.shuffle(pool).slice(0, 3)];
      const label = ([m, s]: [number, number]) => `$${MU} = ${num(m)}$, $${SIG} = ${num(s)}$`;
      const pen = opts.map(([m, s]) => round(kl(m, s), 2));
      return {
        prompt: 'Besides the reconstruction error, a VAE\'s loss has an extra term on each code dimension\'s mean and spread. For which of these encoder outputs is that term smallest?',
        answer: shuffled(
          rng,
          opts.map((o, i) => ({
            text: label(o),
            why: i === 0 ? null : o[1] < 1 ? `A spread below 1 is penalized: it makes codes too exact. The term here is about $${num(pen[i]!, 2)}$.` : o[0] !== 0 ? `A mean away from 0 is penalized: $${MU}^2$ grows with the distance. The term here is about $${num(pen[i]!, 2)}$.` : `A spread above 1 is penalized too. The term here is about $${num(pen[i]!, 2)}$.`,
          })),
        ),
        solution: [
          `The term pulls every code toward a standard normal: mean 0, spread 1, where it is exactly 0.`,
          `Only $${MU} = 0$, $${SIG} = 1$ matches it. The others pay: ${opts
            .slice(1)
            .map((o, i) => `${label(o)} about $${num(pen[i + 1]!, 2)}$`)
            .join(', ')}.`,
          `Its formula, $\\tfrac{1}{2}(${MU}^2 + ${SIG}^2 - 1 - \\ln ${SIG}^2)$, is 0 there and grows as $${MU}$ moves from 0 or $${SIG}$ from 1.`,
        ],
      };
    },
  },
  {
    id: 'outputs',
    make(rng, d) {
      const k = d < 0.35 ? pick(rng, [2, 3, 4, 8, 10]) : pick(rng, [16, 20, 32, 64, 128]);
      const H = d < 0.35 ? pick(rng, [10, 16, 20, 32]) : pick(rng, [128, 256, 400, 512]);
      const params = d >= 0.35 && rng.next() < 0.7;
      const lead = `A VAE has a code of $k = ${k}$ dimensions. The last layer of its encoder reads $\\symH = ${H}$ hidden units.`;
      if (!params)
        return {
          prompt: `${lead} How many numbers does the encoder output for one input?`,
          answer: { kind: 'number', value: 2 * k },
          traps: traps(2 * k, [
            { value: k, why: `That is one number per code dimension, as in a plain autoencoder. A VAE's encoder gives two: a mean $${MU}$ and a spread $${SIG}$.` },
            { value: H, why: `That is the hidden layer. The outputs depend on the code: two per dimension.` },
            { value: 3 * k, why: `The noise $${EPS}$ is not an output of the encoder: it is drawn separately. Two numbers per dimension.` },
          ]),
          solution: [
            `For each of the $${k}$ code dimensions the encoder gives a mean $${MU}$ and a spread $${SIG}$.`,
            `That is $2 \\times ${k} = ${2 * k}$ numbers. The noise $${EPS}$ is drawn separately, not computed.`,
          ],
        };
      const v = (H + 1) * 2 * k;
      return {
        prompt: `${lead} Each of that layer's outputs has one weight per hidden unit and one bias. How many parameters does it have?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: (H + 1) * k, why: `That makes one output per code dimension. Each dimension needs two: a mean and a spread.` },
          { value: H * 2 * k, why: 'That counts the weights only. Each output also has a bias.' },
          { value: H * 2 * k + k, why: 'That gives a bias to each code dimension. Each of the outputs, means and spreads alike, has its own bias.' },
        ]),
        solution: [
          `Outputs: a mean and a spread per dimension, $2 \\times ${k} = ${2 * k}$.`,
          `Each output has $${H}$ weights and a bias: $${H} + 1 = ${H + 1}$.`,
          `$${2 * k} \\times ${par(H + 1)} = ${big(v)}$.`,
        ],
      };
    },
  },
];

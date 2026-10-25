import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, vec } from '../../kit';
import { D, F, big, clean, traps, vtraps, whys } from '../kit';

const fj = (j: number) => `${F}_{${j}}`;
const dir = (j: number) => `\\symv_{${j}}`;
const commas = (n: number) => n.toLocaleString('en-US');
const and = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

export const generators: Generator[] = [
  {
    id: 'size',
    make(rng, d) {
      const dim = pick(rng, [64, 128, 256, 512, 768, 1024]);
      const r = pick(rng, [4, 8, 16, 32, 64]);
      const m = dim * r;
      const kind = d < 0.35 ? 0 : d < 0.7 ? rng.int(2) : rng.int(3);
      if (kind === 0) {
        return {
          prompt: `A sparse autoencoder reads activations of width $${D} = ${big(dim)}$ and has an expansion factor of ${r}. How many features does its dictionary have?`,
          answer: { kind: 'number', value: m },
          traps: traps(m, [
            { value: dim / r, why: 'That makes the middle narrower than the input, as an ordinary autoencoder does. A sparse autoencoder is wider.' },
            { value: dim + r, why: `The expansion factor multiplies: ${r} features for every dimension.` },
          ]),
          solution: [`The dictionary is ${r} times wider than the input: $${r} \\times ${big(dim)} = ${big(m)}$ features.`],
        };
      }
      if (kind === 1) {
        return {
          prompt: `A sparse autoencoder on activations of width $${D} = ${big(dim)}$ learns a dictionary of ${commas(m)} features. What is its expansion factor?`,
          answer: { kind: 'number', value: r },
          traps: traps(r, [
            { value: dim / m, why: 'That divides the wrong way round. The factor is features per dimension.' },
            { value: m - dim, why: 'That is how many more features than dimensions. The factor is a ratio.' },
          ]),
          solution: [`$${big(m)} / ${big(dim)} = ${r}$ features per dimension of the input.`],
        };
      }
      return {
        prompt: `A sparse autoencoder on activations of width $${D} = ${big(dim)}$ has ${commas(m)} features. Its decoder holds one direction of $${D}$ numbers per feature. How many numbers is that?`,
        answer: { kind: 'number', value: dim * m },
        traps: traps(dim * m, [
          { value: m, why: `That counts one number per feature. Each direction has $${D} = ${big(dim)}$ numbers.` },
          { value: 2 * dim * m, why: 'That adds the encoder too. The question asks about the decoder alone.' },
        ]),
        solution: [`One direction of ${big(dim)} numbers for each of ${big(m)} features: $${big(dim)} \\times ${big(m)} = ${big(dim * m)}$.`],
      };
    },
  },
  {
    id: 'l1',
    make(rng, d) {
      const m = d < 0.4 ? 6 : 8;
      const k = d < 0.4 ? 2 : pick(rng, [2, 3]);
      const f = Array.from({ length: m }, () => 0);
      for (const j of rng.shuffle(Array.from({ length: m }, (_, j) => j)).slice(0, k)) f[j] = d < 0.4 ? int(rng, 1, 4) : pick(rng, [0.5, 1, 1.5, 2, 3, 0.2]);
      const lam = pick(rng, d < 0.4 ? [0.1, 0.5, 1] : [0.1, 0.05, 0.2, 0.01]);
      const sum = clean(f.reduce((a, v) => a + v, 0));
      const l1 = clean(lam * sum);
      const err = d >= 0.7 ? pick(rng, [0.3, 0.8, 1.2, 0.05]) : 0;
      const ans = clean(err + l1);
      const active = f.map((v, j) => [v, j] as const).filter(([v]) => v > 0);
      return {
        prompt: err
          ? `A sparse autoencoder has L1 strength $\\symlam = ${num(lam)}$. For one activation the reconstruction error is ${num(err)} and the code is $${F} = ${vec(f)}$. What is the loss?`
          : `A sparse autoencoder has L1 strength $\\symlam = ${num(lam)}$. What is its L1 penalty for the code $${F} = ${vec(f)}$?`,
        answer: { kind: 'number', value: ans },
        traps: traps(ans, [
          { value: err + lam * f.reduce((a, v) => a + v * v, 0), why: 'That squares the features: an L2 penalty. L1 adds them up as they are.' },
          { value: err + lam * k, why: 'That counts the active features. L1 adds their values.' },
          { value: err + sum, why: 'That leaves out $\\symlam$.' },
        ]),
        solution: [
          `The L1 penalty is $\\symlam \\sum_j ${F}_j$: $\\symlam$ times the sum of the features${err ? ', and the loss adds it to the reconstruction error' : ''}.`,
          `Only ${and(active.map(([, j]) => `$${fj(j)}$`))} are nonzero: they add up to $${active.map(([v]) => num(v)).join(' + ')} = ${num(sum)}$.`,
          `Times $\\symlam$: $${num(lam)} \\times ${num(sum)} = ${num(l1)}$.`,
          ...(err ? [`Add the error: $${num(err)} + ${num(l1)} = ${num(ans)}$.`] : ['Every zero costs nothing, which is why the penalty pushes small features all the way to 0.']),
        ],
      };
    },
  },
  {
    id: 'recon',
    make(rng, d) {
      const n = d < 0.5 ? 2 : 3;
      const m = 4;
      const dirs = Array.from({ length: m }, () => Array.from({ length: n }, () => int(rng, -1, 2)));
      const f = Array.from({ length: m }, () => 0);
      const k = d < 0.35 ? 2 : pick(rng, [2, 3]);
      for (const j of rng.shuffle([0, 1, 2, 3]).slice(0, k)) f[j] = d < 0.6 ? int(rng, 1, 3) : pick(rng, [0.5, 1, 1.5, 2, 2.5]);
      const ans = Array.from({ length: n }, (_, c) => clean(f.reduce((a, v, j) => a + v * dirs[j]![c]!, 0)));
      const active = [0, 1, 2, 3].filter((j) => f[j]! > 0);
      const big1 = active.reduce((a, j) => (f[j]! > f[a]! ? j : a), active[0]!);
      return {
        prompt: `A sparse autoencoder's decoder gives each feature a direction: ${dirs.map((v, j) => `$${dir(j)} = ${vec(v)}$`).join(', ')}. For one activation the code is $${F} = ${vec(f)}$. What is the reconstruction?`,
        answer: { kind: 'vector', value: ans },
        traps: vtraps(ans, [
          { value: Array.from({ length: n }, (_, c) => clean(active.reduce((a, j) => a + dirs[j]![c]!, 0))), why: 'That adds the active directions without scaling them by the feature values.' },
          { value: Array.from({ length: n }, (_, c) => clean(dirs.reduce((a, v) => a + v[c]!, 0))), why: 'That adds every direction, including the features that are off.' },
          { value: dirs[big1]!.map((v) => clean(v * f[big1]!)), why: 'That keeps only the largest feature. Every active feature adds its own direction.' },
        ]),
        solution: [
          `The reconstruction $\\hat{\\symx}$ is each feature's value times its direction, added up. Only ${and(active.map((j) => `$${fj(j)}$`))} are on, so only their directions count.`,
          ...active.map((j) => `$${num(f[j]!)} \\times ${vec(dirs[j]!)} = ${vec(dirs[j]!.map((v) => clean(v * f[j]!)))}$.`),
          `Add them: $\\hat{\\symx} = ${vec(ans)}$.`,
        ],
      };
    },
  },
  {
    id: 'buys',
    make(rng) {
      const dim = pick(rng, [256, 512, 768, 1024]);
      const r = pick(rng, [8, 16, 32]);
      const lam = pick(rng, [0.001, 0.003, 0.01, 0.03]);
      const kind = rng.int(3);
      if (kind === 0) {
        const options = [
          'Each activation is explained by a few features, so each feature can stand for one thing',
          'A more exact reconstruction of every activation',
          'A dictionary smaller than the activations it reads',
          'Feature directions that are all exactly perpendicular',
        ];
        const reasons = [
          '',
          'The penalty trades some reconstruction for sparsity. Without it the error would be lower.',
          `The dictionary is wider than the input: here ${r} times. The penalty limits how many features are on at once.`,
          `With ${r} times more features than dimensions, they cannot all be perpendicular.`,
        ];
        return {
          prompt: `A sparse autoencoder with $${big(dim * r)}$ features reads activations of width $${D} = ${big(dim)}$, with an L1 penalty of strength $\\symlam = ${num(lam)}$. What does the penalty buy?`,
          answer: { kind: 'choice', options, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
          solution: [
            'The L1 penalty charges for every unit of feature activation, so the cheapest code uses only the few features that matter.',
            'With few features on per input, each feature tends to fire for one kind of thing, which makes the dictionary readable.',
          ],
        };
      }
      if (kind === 1) {
        const options = [
          'Fewer features are active per input, and the reconstruction gets worse',
          'More features are active per input, and the reconstruction improves',
          'The dictionary gains more features',
          `Nothing changes: $\\symlam$ only scales the loss`,
        ];
        const reasons = [
          '',
          'A larger penalty charges more for each active feature, so fewer stay on.',
          'The dictionary size is fixed when the SAE is built. The penalty changes how many features are used.',
          '$\\symlam$ weighs the penalty against the reconstruction error, so it moves the balance between them.',
        ];
        return {
          prompt: `A sparse autoencoder on activations of width $${D} = ${big(dim)}$ is retrained with its L1 strength raised from $\\symlam = ${num(lam)}$ to $${num(clean(lam * 10))}$. What happens?`,
          answer: { kind: 'choice', options, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
          solution: [
            'The loss is reconstruction error plus $\\symlam$ times the sum of the features.',
            'A larger $\\symlam$ makes each unit of activation cost more, so the SAE turns more features off and gives up some reconstruction.',
          ],
        };
      }
      const options = [
        `The activations hold more features than dimensions, so the dictionary needs more directions than $${D}$`,
        'A wider middle copies the input more easily, which lowers the error',
        'Wider layers make the training faster',
        'Each of the model\'s neurons needs a copy of every feature',
      ];
      const reasons = [
        '',
        'An unpenalized wide middle could copy the input, but that would teach nothing. The penalty forces few features at once.',
        'Wider is slower, not faster. The width is there to fit every feature the model stores.',
        'Features are directions spread across many neurons, not copies inside each one.',
      ];
      return {
        prompt: `An ordinary autoencoder squeezes its input through a narrow middle. A sparse autoencoder on activations of width $${D} = ${big(dim)}$ instead uses $${big(dim * r)}$ features. Why so wide?`,
        answer: { kind: 'choice', options, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
        solution: [
          'By superposition, a model stores more features than its activations have dimensions, as nearly perpendicular directions.',
          `To give each of them a direction of its own, the dictionary must have more directions than $${D}$; the L1 penalty keeps only a few on at once.`,
        ],
      };
    },
  },
];

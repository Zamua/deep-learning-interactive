import type { Generator } from '../../../mastery/domain/types';
import { num, pick, round, vec } from '../../kit';
import { AB, EHAT, LEVELS, XT, big, bigText, clean, par, roots, shuffled, tenth, traps, vtraps } from '../kit';

const XHAT = '\\sym{x0}{\\hat{x}_0}';
const ABT = '\\sym{ab}{\\bar\\alpha_t}';
const ABP = '\\sym{ab}{\\bar\\alpha_{t-1}}';
const AB0 = '\\sym{ab}{\\bar\\alpha_0}';
const XP = '\\sym{xt}{x_{t-1}}';
const SIG = '\\sym{sigma}{\\sigma}';
const Z = '\\sym{z}{z}';
const STEP = `${XP} = \\sqrt{${ABP}}\\,${XHAT} + \\sqrt{1 - ${ABP} - ${SIG}^2}\\,${EHAT} + ${SIG}\\,${Z}`;

/**
 * The level one step lands on: [alpha-bar at t - 1, its root, sigma squared, the root of the
 * share the guess keeps, sigma], chosen so every root is short.
 */
const STEPS: [number, number, number, number, number][] = [
  [0.81, 0.9, 0.03, 0.4, 0.17],
  [0.64, 0.8, 0.11, 0.5, 0.33],
  [0.36, 0.6, 0.15, 0.7, 0.39],
  [0.36, 0.6, 0.28, 0.6, 0.53],
  [0.49, 0.7, 0.02, 0.7, 0.14],
  [0.49, 0.7, 0.15, 0.6, 0.39],
  [0.25, 0.5, 0.11, 0.8, 0.33],
  [0.25, 0.5, 0.26, 0.7, 0.51],
  [0.75, 0.87, 0.09, 0.4, 0.3],
  [0.19, 0.44, 0.17, 0.8, 0.41],
  [0.09, 0.3, 0.1, 0.9, 0.32],
  [0.09, 0.3, 0.27, 0.8, 0.52],
];

/** `$\sqrt{v} = r$`, with ≈ where r is rounded. */
const rt = (v: number, r: number) => `$\\sqrt{${num(v)}} ${Math.abs(Math.sqrt(v) - r) < 1e-9 ? '=' : '\\approx'} ${num(r)}$`;

/** The step of a 1,000-step cosine schedule with this alpha-bar, as the noise schedule drew it. */
const stepOf = (ab: number) => Math.round((2000 / Math.PI) * Math.acos(Math.sqrt(ab)));

const PIX = (n: number) => (n === 1 ? 'A pixel' : 'Two pixels');

export const generators: Generator[] = [
  {
    id: 'estimate',
    make(rng, d) {
      const L = d < 0.35 ? pick(rng, LEVELS.slice(0, 2)) : pick(rng, LEVELS.filter((l) => l[0] >= 0.19));
      const [ab, a, b] = L;
      const n = d < 0.6 ? 1 : 2;
      const xt = Array.from({ length: n }, () => (d < 0.35 ? pick(rng, [-1, -0.4, 0.2, 0.6, 1, 1.4]) : tenth(rng, -2, 2)));
      const e = Array.from({ length: n }, () => (d < 0.35 ? pick(rng, [-1, -0.5, 0.5, 1]) : tenth(rng, -2, 2)));
      const est = (f: (x: number, k: number) => number) => xt.map((x, i) => clean(f(x, i)));
      const v = est((x, i) => (x - b * e[i]!) / a);
      const one = n === 1;
      const T = (xs: number[]) => (one ? num(xs[0]!) : vec(xs));
      const wrong = [
        { value: est((x, i) => x - b * e[i]!), why: `That takes the noise away but forgets that the image was shrunk by $\\sqrt{${ABT}} = ${num(a)}$. Divide by it too.` },
        { value: est((x, i) => (x - e[i]!) / a), why: `That takes away the guess unscaled. In $${XT}$ the noise is scaled by $\\sqrt{1 - ${ABT}} = ${num(b)}$.` },
        { value: est((x, i) => (x + b * e[i]!) / a), why: 'That adds the guessed noise instead of taking it away.' },
        { value: est((x) => x / a), why: 'That only undoes the shrinking. Take away the scaled noise guess first.' },
      ];
      return {
        prompt: `Sampling with a 1,000-step schedule has walked back to step $t = ${big(stepOf(ab))}$, where $${ABT} = ${num(ab)}$. ${PIX(n)} of the image so far ${one ? 'reads' : 'read'} $${XT} = ${T(xt)}$, and the network guesses ${one ? 'its' : 'their'} noise is $${EHAT} = ${T(e)}$. What estimate of the clean image, $${XHAT}$, does this step make? Round to two decimals.\n\nUse ${roots(L)}.`,
        answer: one ? { kind: 'number', value: v[0]!, places: 2 } : { kind: 'vector', value: v, places: 2 },
        traps: one ? traps(v[0]!, wrong.map((w) => ({ value: w.value[0]!, why: w.why })), 2) : vtraps(v, wrong, 2),
        solution: [
          `Solve the blend for the image, with the guess in place of the noise: $${XHAT} = (${XT} - \\sqrt{1 - ${ABT}}\\,${EHAT}) / \\sqrt{${ABT}}$.`,
          ...xt.map((x, i) => `${one ? '' : `Pixel ${i}: `}$(${num(x)} - ${num(b)} \\cdot ${par(e[i]!)}) / ${num(a)} = ${num(clean(x - b * e[i]!))} / ${num(a)} ${Math.abs(round(v[i]!, 2) - v[i]!) > 1e-9 ? '\\approx' : '='} ${num(round(v[i]!, 2))}$.`),
          'The step blends this estimate back in at the next level down.',
        ],
      };
    },
  },
  {
    id: 'mean',
    make(rng, d) {
      const [ab, a, s2, k, sg] = pick(rng, STEPS);
      const k2 = clean(k * k);
      const share = clean(1 - ab);
      const b = LEVELS.find((l) => l[0] === ab)![2];
      const full = d >= 0.5 && rng.next() < 0.5;
      const n = full || d < 0.6 ? 1 : 2;
      const xh = Array.from({ length: n }, () => (d < 0.35 ? pick(rng, [-1, 0.5, 1, 1.5, 2]) : tenth(rng, -2, 2)));
      const e = Array.from({ length: n }, () => (d < 0.35 ? pick(rng, [-1, -0.5, 0.5, 1]) : tenth(rng, -2, 2)));
      const z = Array.from({ length: n }, () => pick(rng, [-1.5, -1, -0.5, 0.5, 1, 1.5, 2]));
      const of = (f: (x: number, k: number) => number) => xh.map((x, i) => clean(f(x, i)));
      const mean = of((x, i) => a * x + k * e[i]!);
      const v = full ? mean.map((m, i) => clean(m + sg * z[i]!)) : mean;
      const one = n === 1;
      const T = (xs: number[]) => (one ? num(xs[0]!) : vec(xs));
      const wrong = [
        { value: of((x, i) => ab * x + k * e[i]!), why: `That scales $${XHAT}$ by $${ABP}$ itself. The image part is scaled by its square root, $${num(a)}$.` },
        { value: of((x) => a * x), why: `That leaves out the network's noise guess. The step keeps $${num(k)}\\,${EHAT}$ of it.` },
        { value: of((x, i) => a * x + k2 * e[i]!), why: `That scales the guess by its share of the variance, $${num(k2)}$. The factor is the square root, $${num(k)}$.` },
        { value: of((x, i) => a * x + b * e[i]!), why: `That gives the guess the whole noise share, $1 - ${ABP}$, leaving nothing for the fresh noise. It keeps only $${num(k2)}$ of it.` },
        { value: of((x, i) => x + k * e[i]!), why: `That leaves $${XHAT}$ unscaled. At step $t - 1$ the image is scaled by $\\sqrt{${ABP}} = ${num(a)}$.` },
        ...(full
          ? [
              { value: mean, why: `That is the mean. Add the fresh noise too: $${SIG}\\,${Z}$.` },
              { value: mean.map((m, i) => m + z[i]!), why: `That adds $${Z}$ unscaled. Fresh noise is scaled by $${SIG} \\approx ${num(sg)}$.` },
              { value: mean.map((m, i) => m + s2 * z[i]!), why: `That scales $${Z}$ by the variance $${SIG}^2$. Scale it by $${SIG}$, the square root.` },
            ]
          : []),
      ];
      const lead = `One sampling step goes from step $t$ down to $t - 1$. For ${one ? 'one pixel' : 'two pixels'}, it has the estimate $${XHAT} = ${T(xh)}$ and the network's noise guess $${EHAT} = ${T(e)}$. At step $t - 1$, $${ABP} = ${num(ab)}$ and $${SIG}^2 = ${num(s2)}$.`;
      const ask = full
        ? ` The fresh noise drawn is $${Z} = ${T(z)}$. What is $${XP}$? Round to two decimals.\n\nUse ${rt(ab, a)}, ${rt(k2, k)} and ${rt(s2, sg)}.`
        : ` What is the step's mean? Round to two decimals.\n\nUse ${rt(ab, a)} and ${rt(k2, k)}.`;
      return {
        prompt: lead + ask,
        answer: one ? { kind: 'number', value: v[0]!, places: 2 } : { kind: 'vector', value: v, places: 2 },
        traps: one ? traps(v[0]!, wrong.map((w) => ({ value: w.value[0]!, why: w.why })), 2) : vtraps(v, wrong, 2),
        solution: [
          `Step $t - 1$ is again a blend of image and noise: $${STEP}$. The mean is all of it but $${SIG}\\,${Z}$.`,
          `The image part: $${XHAT}$ scaled by $\\sqrt{${ABP}} = \\sqrt{${num(ab)}} ${Math.abs(Math.sqrt(ab) - a) < 1e-9 ? '=' : '\\approx'} ${num(a)}$.`,
          `The noise share is $1 - ${num(ab)} = ${num(share)}$. With $${num(s2)}$ set aside for fresh noise, the guess keeps $${num(k2)}$, so it is scaled by $\\sqrt{${num(k2)}} = ${num(k)}$.`,
          ...xh.map((x, i) => `${one ? 'Mean' : `Pixel ${i}`}: $${num(a)} \\cdot ${par(x)} + ${num(k)} \\cdot ${par(e[i]!)} = ${num(clean(a * x))} ${k * e[i]! < 0 ? '-' : '+'} ${num(clean(Math.abs(k * e[i]!)))} = ${num(mean[i]!)}$.`),
          ...(full ? [`Add $${SIG}\\,${Z}$ with $${SIG} \\approx ${num(sg)}$: ${mean.map((m, i) => `$${num(m)} + ${num(sg)} \\cdot ${par(z[i]!)} = ${num(v[i]!)}$`).join('; ')}.`] : []),
        ],
      };
    },
  },
  {
    id: 'calls',
    make(rng, d) {
      const T = pick(rng, [100, 250, 500, 1000, 2000, 4000]);
      const kind = d < 0.35 ? pick(rng, ['calls', 'fresh'] as const) : pick(rng, ['calls', 'fresh', 'skip', 'skip', 'skip-fresh'] as const);
      const lead = `A diffusion model was trained with a ${bigText(T)}-step noise schedule. To make an image, a sampler starts from pure noise at step $t = ${big(T)}$`;
      if (kind === 'calls' || kind === 'fresh') {
        const calls = kind === 'calls';
        const v = calls ? T : T - 1;
        return {
          prompt: `${lead} and walks back one step at a time, down to step 0. How many times does it ${calls ? 'run the network' : 'add fresh noise'}?`,
          answer: { kind: 'number', value: v },
          traps: traps(
            v,
            calls
              ? [
                  { value: T - 1, why: 'That is how many times fresh noise goes in. The network runs on every step, the last one included.' },
                  { value: T + 1, why: `That counts the levels from ${bigText(T)} down to 0. Each move from one level to the next is one step and one call.` },
                  { value: 1, why: 'The network runs once per step, not once in all: every step needs its own noise guess.' },
                ]
              : [
                  { value: T, why: `That is one per step. The last step, down to step 0, adds none: there $${AB0} = 1$, which leaves no noise share.` },
                  { value: 0, why: 'Every step but the last adds a little fresh noise.' },
                  { value: T + 1, why: `That counts the levels from ${bigText(T)} down to 0. Fresh noise goes in once per step, and not on the last.` },
                ],
          ),
          solution: calls
            ? [`Steps go from ${bigText(T)} down to 1, each landing one level lower: ${bigText(T)} steps.`, `Each step runs the network once, on $${XT}$ and $t$: ${bigText(T)} calls.`]
            : [`There are ${bigText(T)} steps, from ${bigText(T)} down to 1.`, `Every step adds fresh noise except the last, which lands on step 0 where $${AB0} = 1$: $${big(T)} - 1 = ${big(v)}$.`],
        };
      }
      const k = pick(rng, [10, 20, 25, 50].filter((s) => T % s === 0 && T / s >= 4));
      const steps = T / k;
      const calls = kind === 'skip';
      const v = calls ? steps : steps - 1;
      return {
        prompt: `${lead} and skips steps: it visits $t = ${big(T)}, ${big(T - k)}, ${big(T - 2 * k)}, \\ldots, ${big(k)}$, and then $0$. How many times does it ${calls ? 'run the network' : 'add fresh noise'}?`,
        answer: { kind: 'number', value: v },
        traps: traps(
          v,
          calls
            ? [
                { value: steps + 1, why: `That counts the levels visited, 0 included. Each move between two of them is one call: ${bigText(steps)} moves.` },
                { value: T, why: `That is without skipping. Stepping down by ${k} takes $${big(T)} / ${k}$ steps.` },
                { value: steps - 1, why: 'That is how many times fresh noise goes in. The network runs on every step, the last one included.' },
              ]
            : [
                { value: steps, why: 'That is one per step. The last step, down to step 0, adds no fresh noise.' },
                { value: T - 1, why: `That is without skipping. Here there are only $${big(T)} / ${k} = ${big(steps)}$ steps.` },
                { value: steps + 1, why: 'That counts the levels visited. Fresh noise goes in once per step, and not on the last.' },
              ],
        ),
        solution: [
          `Going down by ${k} from ${bigText(T)} to 0 takes $${big(T)} / ${k} = ${big(steps)}$ steps.`,
          calls ? `One network call per step: ${bigText(steps)} calls.` : `Fresh noise goes in on every step but the last: $${big(steps)} - 1 = ${big(v)}$.`,
          'The blend can jump to any level, so a step may land many levels lower.',
        ],
      };
    },
  },
  {
    id: 'walk',
    make(rng) {
      const T = pick(rng, [100, 250, 500, 1000, 4000]);
      const kind = pick(rng, ['order', 'start', 'last', 'fresh'] as const);
      const lead = `A diffusion model with a ${bigText(T)}-step schedule makes a new image.`;
      if (kind === 'order')
        return {
          prompt: `${lead} Put one sampling step, from step $t$ down to step $t - 1$, in order.`,
          answer: {
            kind: 'order',
            items: [
              `Run the network on $${XT}$ and $t$ to get the noise guess $${EHAT}$`,
              `Estimate the clean image $${XHAT}$ from $${XT}$ and $${EHAT}$`,
              `Blend $${XHAT}$ and part of $${EHAT}$ back in at step $t - 1$`,
              `Add fresh noise $${SIG}\\,${Z}$, with $${Z}$ drawn from \`np.random.randn\``,
            ],
          },
          solution: [
            `Everything starts from the network's guess of the noise in $${XT}$.`,
            `The guess gives an estimate of the clean image, which is blended back one level down, keeping part of the guess as its noise.`,
            `Fresh noise comes last, filling the rest of step $t - 1$'s noise share. The last step, to step 0, skips it.`,
          ],
        };
      if (kind === 'start')
        return {
          prompt: `${lead} What does the sampler start from, at step $t = ${big(T)}$?`,
          answer: shuffled(rng, [
            { text: 'Pure noise from `np.random.randn`, in the shape of an image', why: null },
            { text: 'A training image with a little noise added', why: `Then it would only rebuild training images. At step ${bigText(T)} almost nothing of an image is left, so a new image starts from noise alone.` },
            { text: 'An image of all zeros, the average pixel', why: `At step ${bigText(T)} the network was trained on pure noise of variance 1, not on zeros. The sampler starts from what that step looks like.` },
            { text: `The network's estimate $${XHAT}$ of a clean image`, why: `The estimate comes out of a step. The first step needs an $${XT}$ to run the network on: pure noise.` },
          ]),
          solution: [
            `At the last step $${AB}$ is close to 0: $${XT}$ is pure noise, whatever image it came from.`,
            'So sampling draws that noise fresh and walks back from it, one step at a time.',
          ],
        };
      if (kind === 'last')
        return {
          prompt: `${lead} What happens on the very last step, from step 1 down to step 0, where $${AB0} = 1$?`,
          answer: shuffled(rng, [
            { text: `It keeps the estimate $${XHAT}$ itself, and adds no fresh noise`, why: null },
            { text: 'It adds fresh noise, as every other step does', why: `At step 0 the noise share is $1 - ${AB0} = 0$: there is no room for fresh noise, so $${SIG} = 0$.` },
            { text: `It skips the network and keeps $\\sym{xt}{x_1}$ as it is`, why: `$\\sym{xt}{x_1}$ still holds a little noise. The last step runs the network to estimate $${XHAT}$, and that is the image.` },
            { text: `It blends the estimate with the noise guess once more`, why: `The guess is scaled by $\\sqrt{1 - ${AB0} - ${SIG}^2} = 0$ at step 0: nothing of it is kept.` },
          ]),
          solution: [
            `At step 0, $${AB0} = 1$: the blend is all image, with a noise share of 0.`,
            `So $\\sqrt{${AB0}}\\,${XHAT} = ${XHAT}$, nothing of the guess is kept, and no fresh noise is added: the new image is the estimate.`,
          ],
        };
      return {
        prompt: `${lead} Every step but the last adds fresh noise $${SIG}\\,${Z}$ after taking noise out. Why?`,
        answer: shuffled(rng, [
          { text: `The mean is only the center of where $${XP}$ could be, and the fresh noise picks one point around it`, why: null },
          { text: `It corrects the mistakes in the network's noise guess $${EHAT}$`, why: 'Fresh noise is random: it cannot correct anything. It picks one point around the mean, filling the noise share the guess left open.' },
          { text: 'It makes no difference, since the next step takes it out again', why: `It moves where the step lands, and so every later step. Leave it out and $${XP}$ holds less noise than step $t - 1$ should have.` },
          { text: `It makes $${XP}$ noisier than $${XT}$ was`, why: `$${XP}$ is less noisy than $${XT}$: the fresh noise only fills the slice $${SIG}^2$ of step $t - 1$'s smaller noise share.` },
        ]),
        solution: [
          `Many images could have led to this $${XT}$; the mean is only the center of where the step could land.`,
          `The fresh noise picks one point around it and tops the noise back up: $${ABP}$, plus the guess's share, plus $${SIG}^2$, add up to 1.`,
        ],
      };
    },
  },
];

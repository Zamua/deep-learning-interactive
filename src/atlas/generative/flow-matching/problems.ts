import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, vec } from '../../kit';
import { EPS, X0, XT, clean, nonzero, par, shuffled, sum, tenth, traps, vtraps } from '../kit';

const V = '\\sym{v}{v}';
const VHAT = '\\sym{vhat}{\\hat{v}}';
const PATH = `${XT} = (1 - t)\\,${X0} + t\\,${EPS}`;
const EULER = `${XT} \\leftarrow ${XT} - \\Delta t\\,${VHAT}`;

const SIZES = ['$32 \\times 32$', '$64 \\times 64$', '$256 \\times 256$', '$512 \\times 512$'];

/** `n` nonzero pixel values: small whole numbers first, then tenths. */
const vals = (rng: Rng, n: number, d: number, lo = -2, hi = 2) => Array.from({ length: n }, () => (d < 0.35 ? nonzero(rng, lo, hi) : tenth(rng, lo, hi)));

/** A number or a vector in TeX, as the answer is one or the other. */
const tex = (xs: number[]) => (xs.length === 1 ? num(xs[0]!) : vec(xs));

/** Answer and traps for one or more entries, graded to two decimals. */
function out(v: number[], wrong: { value: number[]; why: string }[]) {
  return v.length === 1
    ? { answer: { kind: 'number' as const, value: v[0]!, places: 2 }, traps: traps(v[0]!, wrong.map((w) => ({ value: w.value[0]!, why: w.why })), 2) }
    : { answer: { kind: 'vector' as const, value: v, places: 2 }, traps: vtraps(v, wrong, 2) };
}

export const generators: Generator[] = [
  {
    id: 'point',
    make(rng, d) {
      const n = d < 0.35 ? 1 : 2;
      const t = d < 0.35 ? pick(rng, [0.25, 0.5, 0.75]) : pick(rng, [0.1, 0.2, 0.25, 0.3, 0.4, 0.6, 0.7, 0.75, 0.8, 0.9]);
      const x0 = vals(rng, n, d);
      let eps = vals(rng, n, d);
      while (eps.every((e, i) => e === x0[i])) eps = vals(rng, n, d);
      const mix = (p: (x: number, e: number) => number) => x0.map((x, i) => clean(p(x, eps[i]!)));
      const v = mix((x, e) => (1 - t) * x + t * e);
      const one = n === 1;
      return {
        prompt: `${one ? 'A pixel of a clean image is' : 'Two pixels of a clean image are'} $${X0} = ${tex(x0)}$, and the noise drawn for ${one ? 'it' : 'them'} is $${EPS} = ${tex(eps)}$. Where does flow matching put $${XT}$ at $t = ${num(t)}$? Round to two decimals.`,
        ...out(v, [
          { value: mix((x, e) => t * x + (1 - t) * e), why: `That swaps the weights. At $t = 0$ the point is the clean image, so $${X0}$ gets $1 - t = ${num(clean(1 - t))}$.` },
          { value: mix((x, e) => x + t * e), why: `That adds the noise without shrinking the image. $${X0}$ is scaled by $1 - t$.` },
          { value: mix((x) => (1 - t) * x), why: `That leaves out the noise. Add $t\\,${EPS}$ too.` },
          { value: mix((x, e) => Math.sqrt(1 - t) * x + Math.sqrt(t) * e), why: 'That uses square roots, as the diffusion blend does. The straight line uses $1 - t$ and $t$ themselves.' },
        ]),
        solution: [
          `$${PATH}$: $${X0}$ is scaled by $1 - t = ${num(clean(1 - t))}$ and $${EPS}$ by $t = ${num(t)}$.`,
          ...x0.map((x, i) => `${one ? '' : `Pixel ${i}: `}$${num(clean(1 - t))} \\cdot ${par(x)} + ${num(t)} \\cdot ${par(eps[i]!)} = ${num(clean((1 - t) * x))} ${t * eps[i]! < 0 ? '-' : '+'} ${num(clean(Math.abs(t * eps[i]!)))} = ${num(v[i]!)}$.`),
          `The two weights add up to 1: at $t = 0$ the point is $${X0}$, at $t = 1$ it is $${EPS}$.`,
        ],
      };
    },
  },
  {
    id: 'velocity',
    make(rng, d) {
      const n = d < 0.35 ? 2 : 3;
      const x0 = vals(rng, n, d);
      const eps = vals(rng, n, d);
      const target = x0.map((x, i) => clean(eps[i]! - x));
      const t = pick(rng, [0.2, 0.3, 0.5, 0.6, 0.8]);
      if (d >= 0.5 && rng.next() < 0.5) {
        const guess = target.map((v) => clean(v + int(rng, -5, 5) / 10));
        const diff = guess.map((g, i) => clean(g - target[i]!));
        const sq = diff.map((x) => clean(x * x));
        const total = sum(sq);
        const loss = clean(total / n);
        return {
          prompt: `A clean image $${X0} = ${vec(x0)}$ and its noise $${EPS} = ${vec(eps)}$ give a training point at $t = ${num(t)}$. The network looks at $${XT}$ and $t$ and guesses the velocity $${VHAT} = ${vec(guess)}$. What is the flow matching loss? Round to two decimals.`,
          answer: { kind: 'number', value: loss, places: 2 },
          traps: traps(loss, [
            { value: total, why: `That is the sum of the squares. The mean divides it by the ${n} pixels.` },
            { value: clean(sum(guess.map((g, i) => (g - eps[i]!) ** 2)) / n), why: `That compares the guess with $${EPS}$, the target of a noise-predicting model. Here the target is the velocity, $${EPS} - ${X0}$.` },
            { value: clean(sum(guess.map((g, i) => (g - (x0[i]! - eps[i]!)) ** 2)) / n), why: `That uses $${X0} - ${EPS}$ as the target. The velocity is how $${XT}$ moves as $t$ grows: toward the noise, $${EPS} - ${X0}$.` },
            { value: clean(sum(diff) / n), why: 'That averages the differences without squaring them, so misses in both directions cancel.' },
          ], 2),
          solution: [
            `The target velocity is $${V} = ${EPS} - ${X0} = ${vec(target)}$, whatever $t$ is.`,
            `Differences: $${VHAT} - ${V} = ${vec(diff)}$. Squares: $${vec(sq)}$, which add up to $${num(total)}$.`,
            `The loss is their mean over the ${n} pixels: $${num(total)} / ${n} = ${num(loss)}$.`,
          ],
        };
      }
      return {
        prompt: `A clean image is $${X0} = ${vec(x0)}$, and the noise drawn for it is $${EPS} = ${vec(eps)}$. The network sees their blend $${XT}$ at $t = ${num(t)}$. What velocity $${V}$ is it trained to predict?`,
        answer: { kind: 'vector', value: target },
        traps: vtraps(target, [
          { value: x0.map((x, i) => clean(x - eps[i]!)), why: `That points from the noise to the image. The velocity is how $${XT}$ moves as $t$ grows: toward the noise, $${EPS} - ${X0}$.` },
          { value: eps, why: `That is the noise itself, the target of a noise-predicting diffusion model. Flow matching asks for the velocity, $${EPS} - ${X0}$.` },
          { value: x0.map((x, i) => clean((1 - t) * x + t * eps[i]!)), why: `That is where the point is at $t = ${num(t)}$. The velocity is how fast it moves.` },
          { value: target.map((v) => clean(t * v)), why: `That scales the velocity by $t$. On a straight line it is the same at every $t$.` },
        ]),
        solution: [
          `$${XT} = (1 - t)\\,${X0} + t\\,${EPS}$ moves by $${EPS} - ${X0}$ for each unit of $t$: that is its velocity.`,
          `$${V} = ${vec(eps)} - ${vec(x0)} = ${vec(target)}$.`,
          `It does not depend on $t = ${num(t)}$: the line is straight, so the velocity never changes along it.`,
        ],
      };
    },
  },
  {
    id: 'euler',
    make(rng, d) {
      const two = d >= 0.35 && rng.next() < 0.5;
      const n = d >= 0.35 && !two ? 2 : 1;
      const dt = two ? pick(rng, [0.5, 0.25]) : pick(rng, [0.5, 0.25, 0.2, 0.1]);
      const start = two && dt === 0.25 ? 0.5 : 1;
      const x = vals(rng, n, d);
      const v1 = vals(rng, n, d, -3, 3);
      const v2 = vals(rng, n, d, -3, 3);
      const step1 = x.map((p, i) => clean(p - dt * v1[i]!));
      const v = two ? step1.map((p, i) => clean(p - dt * v2[i]!)) : step1;
      const t1 = clean(start - dt);
      const tEnd = two ? clean(start - 2 * dt) : t1;
      const where = `at $t = ${num(start)}$`;
      const guesses = two
        ? `the network guesses $${VHAT} = ${tex(v1)}$ at $t = ${num(start)}$ and $${VHAT} = ${tex(v2)}$ at $t = ${num(t1)}$`
        : `the network guesses $${VHAT} = ${tex(v1)}$ there`;
      const wrong = two
        ? [
            { value: x.map((p, i) => clean(p + dt * (v1[i]! + v2[i]!))), why: `That steps along the velocity. It points toward the noise, so going back to the image subtracts: $${EULER}$.` },
            { value: step1, why: `That is after one step, at $t = ${num(t1)}$. Take the second step too.` },
            { value: x.map((p, i) => clean(p - 2 * dt * v1[i]!)), why: `That uses the first guess twice. The second step uses the guess made at $t = ${num(t1)}$.` },
            { value: x.map((p, i) => clean(p - v1[i]! - v2[i]!)), why: `That leaves out $\\Delta t$: each step moves $\\Delta t$ times the velocity guess.` },
          ]
        : [
            { value: x.map((p, i) => clean(p + dt * v1[i]!)), why: `That steps along the velocity. It points toward the noise, so going back to the image subtracts: $${EULER}$.` },
            { value: x.map((p, i) => clean(p - v1[i]!)), why: `That leaves out $\\Delta t$: the step moves $\\Delta t$ times the velocity guess.` },
            { value: v1.map((g) => clean(-dt * g)), why: `That is the move on its own. Add it to where the point was.` },
          ];
      return {
        prompt: `A flow matching model samples by starting ${where} and taking Euler steps of $\\Delta t = ${num(dt)}$ toward $t = 0$. The point starts at $${XT} = ${tex(x)}$, and ${guesses}. Where is it at $t = ${num(tEnd)}$?${d >= 0.35 ? ' Round to two decimals.' : ''}`,
        ...out(v, wrong),
        solution: [
          `Each step moves against the velocity guess, $${EULER}$, and lowers $t$ by $\\Delta t$.`,
          `${two ? 'Step 1' : 'The step'}: ${x.map((p, i) => `$${num(p)} - ${num(dt)} \\cdot ${par(v1[i]!)} = ${num(step1[i]!)}$`).join('; ')}, at $t = ${num(t1)}$.`,
          ...(two ? [`Step 2: ${step1.map((p, i) => `$${num(p)} - ${num(dt)} \\cdot ${par(v2[i]!)} = ${num(v[i]!)}$`).join('; ')}, at $t = ${num(tEnd)}$.`] : []),
        ],
      };
    },
  },
  {
    id: 'ideas',
    make(rng) {
      const kind = pick(rng, ['target', 'direction', 'steady', 'one-step'] as const);
      const lead = `A flow matching model is trained on ${pick(rng, SIZES)} images.`;
      if (kind === 'target')
        return {
          prompt: `${lead} What is the network trained to output?`,
          answer: shuffled(rng, [
            { text: `The velocity $${EPS} - ${X0}$ along the line`, why: null },
            { text: `The noise $${EPS}$ that was mixed in`, why: `That is the target of a noise-predicting diffusion model. Flow matching asks for the velocity, $${EPS} - ${X0}$.` },
            { text: `The clean image $${X0}$`, why: `It is asked for the velocity, $${EPS} - ${X0}$: the direction from the image toward the noise.` },
            { text: 'The time $t$ of the point it sees', why: '$t$ is one of its inputs. Its output is a velocity, the same shape as the image.' },
          ]),
          solution: [`$${XT}$ moves along the line at the velocity $${EPS} - ${X0}$.`, `The network sees $${XT}$ and $t$ and is trained, with a squared error, to predict that velocity.`],
        };
      if (kind === 'direction')
        return {
          prompt: `${lead} How does it make a new image?`,
          answer: shuffled(rng, [
            { text: 'From pure noise at $t = 1$ down to $t = 0$, each step against the velocity guess', why: null },
            { text: 'From pure noise at $t = 1$ down to $t = 0$, each step along the velocity guess', why: `The velocity $${EPS} - ${X0}$ points toward the noise. Going back to the image moves against it: subtract $\\Delta t\\,${VHAT}$.` },
            { text: 'From a clean image at $t = 0$ up to $t = 1$, each step along the velocity guess', why: 'That is the noising direction. A new image has no clean image to start from: it starts from noise.' },
            { text: 'From pure noise at $t = 0$ up to $t = 1$, each step along the velocity guess', why: 'Here $t = 1$ is pure noise and $t = 0$ is the clean image.' },
          ]),
          solution: [
            `At $t = 1$, $${XT} = ${EPS}$: pure noise, drawn with \`np.random.randn\`.`,
            `Each Euler step does $${EULER}$, lowering $t$ by $\\Delta t$, until $t = 0$.`,
          ],
        };
      if (kind === 'steady')
        return {
          prompt: `${lead} For one clean image and its noise, how does the velocity of $${XT}$ change as $t$ goes from 0 to 1?`,
          answer: shuffled(rng, [
            { text: `It stays the same: $${EPS} - ${X0}$ at every $t$`, why: null },
            { text: 'It grows as the point nears the noise', why: 'The point moves along a straight line by the same amount for each unit of $t$: its velocity never changes.' },
            { text: 'It shrinks to 0 as the point reaches the noise', why: `$${XT}$ moves by $${EPS} - ${X0}$ per unit of $t$ all the way to $t = 1$. Nothing slows it down.` },
            { text: `It turns, as the point follows a curve from $${X0}$ to $${EPS}$`, why: 'The diffusion blend, with its square roots, follows a curve. This blend is a straight line.' },
          ]),
          solution: [`$${XT} = ${X0} + t\\,(${EPS} - ${X0})$: each unit of $t$ adds the same $${EPS} - ${X0}$.`, 'A straight line at a steady speed: the velocity is the same at every $t$.'],
        };
      return {
        prompt: `${lead} A point sits at the noise, $${XT} = ${EPS}$ at $t = 1$, and suppose the network's guess is exactly $${EPS} - ${X0}$ for its line. At least how many Euler steps land it exactly on $${X0}$?`,
        answer: shuffled(rng, [
          { text: 'One, with $\\Delta t = 1$', why: null },
          { text: 'Two, one for each half of the line', why: `Two steps of $0.5$ land on $${X0}$ too, but one step of 1 already does: $${EPS} - 1 \\cdot (${EPS} - ${X0}) = ${X0}$.` },
          { text: 'Hundreds, since each Euler step only approximates', why: 'An Euler step goes wrong only when the velocity changes during it. On a straight line it never changes.' },
          { text: 'None land exactly; they only get close', why: `With a velocity that never changes, a step is exact: $${EPS} - 1 \\cdot (${EPS} - ${X0}) = ${X0}$.` },
        ]),
        solution: [
          `One step of $\\Delta t = 1$: $${EPS} - 1 \\cdot (${EPS} - ${X0}) = ${X0}$.`,
          'On a straight line the velocity never changes, so a step of any length is exact. Learned paths bend a little, so samplers take a few steps.',
        ],
      };
    },
  },
];

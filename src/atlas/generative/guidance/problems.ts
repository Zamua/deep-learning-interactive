import type { Generator } from '../../../mastery/domain/types';
import { big, clean, int, num, par, pick, shuffled, tenth, traps, vec, vtraps } from '../../kit';
import { EHAT } from '../kit';

const EU = '\\sym{epsu}{\\epsilon_u}';
const EC = '\\sym{epsc}{\\epsilon_c}';
const WG = '\\sym{wg}{w}';
const RULE = `${EHAT} = ${EU} + ${WG}\\,(${EC} - ${EU})`;

export const generators: Generator[] = [
  {
    id: 'combine',
    make(rng, d) {
      const n = d < 0.5 ? 2 : 3;
      const w = d < 0.35 ? pick(rng, [2, 3, 4]) : pick(rng, [1.5, 2.5, 3, 5, 7.5]);
      const eu = Array.from({ length: n }, () => tenth(rng, -1, 1));
      const ec = eu.map((x) => clean(x + (d < 0.35 ? pick(rng, [-0.2, -0.1, 0.1, 0.2, 0.3]) : int(rng, -4, 4) / 10)));
      const diff = ec.map((x, i) => clean(x - eu[i]!));
      const v = eu.map((x, i) => clean(x + w * diff[i]!));
      return {
        prompt: `For one noised image and the prompt "${pick(rng, ['a red bicycle', 'a cat on a sofa', 'a lighthouse at night', 'a bowl of lemons', 'a snowy mountain'])}", the denoiser predicts $${EU} = ${vec(eu)}$ and $${EC} = ${vec(ec)}$. With guidance scale $${WG} = ${num(w)}$, what is the guided guess $${EHAT}$?${d >= 0.35 ? ' Round to two decimals.' : ''}`,
        answer: { kind: 'vector', value: v, places: 2 },
        traps: vtraps(
          v,
          [
            { value: eu.map((x, i) => clean(x + w * ec[i]!)), why: `That adds $${WG}${EC}$ itself. The step is along the difference, $${EC} - ${EU}$.` },
            { value: diff.map((x) => clean(w * x)), why: `That is the push alone, $${WG}(${EC} - ${EU})$. Add it to $${EU}$.` },
            { value: ec.map((x, i) => clean(x + w * diff[i]!)), why: `That starts from $${EC}$. The rule starts from $${EU}$, the prediction without the prompt.` },
            { value: ec.map((x) => clean(w * x)), why: `That scales $${EC}$ alone. Guidance scales the difference the prompt makes.` },
          ],
          2,
        ),
        solution: [
          `$${RULE}$. What the prompt changes: $${EC} - ${EU} = ${vec(diff)}$.`,
          `Scale it: $${num(w)} \\times ${vec(diff)} = ${vec(diff.map((x) => clean(w * x)))}$.`,
          `Add it to $${EU}$: $${vec(eu)} + ${vec(diff.map((x) => clean(w * x)))} = ${vec(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'special-w',
    make(rng) {
      const w = pick(rng, [0, 1, 1, 0.5, 0]);
      const eu = [tenth(rng, -1, 1), tenth(rng, -1, 1)];
      const ec = eu.map((x) => clean(x + pick(rng, [-0.4, -0.2, 0.2, 0.4, 0.6])));
      const mid = eu.map((x, i) => clean((x + ec[i]!) / 2));
      const key = w === 0 ? 'u' : w === 1 ? 'c' : 'mid';
      const say = (k: string) => (k === 'u' ? `$${WG} = 0$ gives exactly that` : k === 'c' ? `$${WG} = 1$ gives exactly that` : `$${WG} = 0.5$ gives that`);
      return {
        prompt: `The denoiser predicts $${EU} = ${vec(eu)}$ and $${EC} = ${vec(ec)}$. With guidance scale $${WG} = ${num(w)}$, which noise guess $${EHAT}$ is used?`,
        answer: shuffled(rng, [
          { text: `$${vec(eu)}$, the guess without the prompt`, why: key === 'u' ? null : `${say('u')}: the push $${WG}(${EC} - ${EU})$ vanishes and the prompt is ignored. Here $${WG} = ${num(w)}$.` },
          { text: `$${vec(ec)}$, the guess with the prompt`, why: key === 'c' ? null : `${say('c')}: $${EU} + (${EC} - ${EU}) = ${EC}$, plain conditioning. Here $${WG} = ${num(w)}$.` },
          { text: `$${vec(mid)}$, halfway between the two`, why: key === 'mid' ? null : `${say('mid')}. Here $${WG} = ${num(w)}$.` },
          { text: '$[0,\\ 0]$: no noise is removed', why: `No value of $${WG}$ zeroes the guess: $${WG} = 0$ gives $${EU}$, not 0.` },
        ]),
        solution: [
          `$${RULE}$ with $${WG} = ${num(w)}$.`,
          key === 'u'
            ? `The push $0 \\cdot (${EC} - ${EU})$ is zero, so $${EHAT} = ${EU}$: the prompt is ignored.`
            : key === 'c'
              ? `$${EU} + 1 \\cdot (${EC} - ${EU}) = ${EC}$: the plain prediction with the prompt.`
              : `$${EU} + 0.5\\,(${EC} - ${EU})$ is the midpoint: $${vec(mid)}$.`,
          `Above 1, the guess goes past $${EC}$, further in the direction the prompt points.`,
        ],
      };
    },
  },
  {
    id: 'large-w',
    make(rng) {
      const hi = pick(rng, [5, 7, 7.5, 10, 15]);
      const up = rng.next() < 0.6;
      const prompt = pick(rng, ['a red bicycle', 'a cat wearing a hat', 'an oak tree in autumn', 'a castle on a hill', 'a blue teapot']);
      const strong = 'The images match the prompt more closely, but vary less and can look overdone';
      const loose = 'The images vary more, but match the prompt more loosely';
      return {
        prompt: `A text-to-image diffusion model makes pictures of "${prompt}" with classifier-free guidance. If the guidance scale ${up ? `goes up from $${WG} = 1$ to $${WG} = ${num(hi)}$` : `comes down from $${WG} = ${num(hi)}$ to $${WG} = 1$`}, what changes?`,
        answer: shuffled(rng, [
          { text: strong, why: up ? null : `That is what raising $${WG}$ does. Lowering it shrinks the push toward the prompt.` },
          { text: loose, why: up ? `That is what lowering $${WG}$ does. Raising it pushes every step harder toward the prompt.` : null },
          { text: `Nothing: above $${WG} = 1$ the prompt is already fully used`, why: `At $${WG} = 1$ the guess is the plain $${EC}$. Larger values step past it, and that changes the images.` },
          { text: 'The images dissolve into pure noise', why: 'Guidance changes which noise guess is removed at each step, not how much noise the image starts with. The images stay images.' },
        ]),
        solution: [
          `$${RULE}$: each step moves $${WG}$ times the prompt's direction away from $${EU}$.`,
          up
            ? `At $${WG} = ${num(hi)}$ every step leans hard toward what the prompt asks for: the pictures follow it closely, look more alike, and can get oversaturated.`
            : `At $${WG} = 1$ the guess is plain $${EC}$: more variety from picture to picture, and a looser fit to the prompt.`,
        ],
      };
    },
  },
  {
    id: 'calls',
    make(rng, d) {
      const S = pick(rng, [20, 25, 50, 100, 250, 1000]);
      const k = d < 0.4 ? 1 : pick(rng, [1, 4, 8, 10]);
      const v = 2 * S * k;
      return {
        prompt: `A sampler makes ${k === 1 ? 'an image' : `${k} images`} in $${big(S)}$ denoising steps${k === 1 ? '' : ' each'}, using classifier-free guidance at every step. How many times does it run the denoising network${k === 1 ? '' : ' in all, one image per run'}?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: S * k, why: `That is one run per step. Guidance needs two: one with the prompt for $${EC}$, one without for $${EU}$.` },
          { value: (S + 1) * k, why: 'Both predictions are needed at every step, not just once.' },
          { value: 2 * S, why: k === 1 ? 'That counts one image.' : `That counts one image. Each of the ${k} needs its own runs.` },
        ]),
        solution: [
          `Each step needs $${EU}$ and $${EC}$: two runs of the network, without and with the prompt.`,
          k === 1 ? `$2 \\times ${big(S)} = ${big(v)}$ runs.` : `$2 \\times ${big(S)} \\times ${par(k)} = ${big(v)}$ runs.`,
        ],
      };
    },
  },
];

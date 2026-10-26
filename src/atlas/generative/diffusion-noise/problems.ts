import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, round, vec } from '../../kit';
import { AB, BLEND, EPS, LEVELS, X0, XT, big, bigText, clean, par, roots, shuffled, tenth, traps, vtraps } from '../kit';

export const generators: Generator[] = [
  {
    id: 'blend',
    make(rng, d) {
      const L = d < 0.35 ? pick(rng, LEVELS.slice(0, 2)) : pick(rng, LEVELS);
      const [ab, a, b] = L;
      const n = d < 0.35 ? 1 : d < 0.7 ? 2 : 3;
      const x0 = Array.from({ length: n }, () => (d < 0.35 ? pick(rng, [-1, 0.5, 1, 2, -2]) : tenth(rng, -1, 1)));
      const eps = Array.from({ length: n }, () => (d < 0.35 ? int(rng, -2, 2) : tenth(rng, -2, 2)));
      const mix = (p: number, q: number) => x0.map((x, i) => clean(p * x + q * eps[i]!));
      const v = mix(a, b);
      const one = n === 1;
      const T = (xs: number[]) => (one ? num(xs[0]!) : vec(xs));
      const rounded = !one || Math.abs(round(v[0]!, 2) - v[0]!) > 1e-9;
      const wrong = [
        { value: mix(ab, clean(1 - ab)), why: `That mixes with $${AB}$ and $1 - ${AB}$ themselves. The mix uses their square roots, $${num(a)}$ and $${num(b)}$.` },
        { value: mix(b, a), why: `That swaps the two factors. The image gets $\\sqrt{${AB}} = ${num(a)}$ and the noise $\\sqrt{1 - ${AB}} = ${num(b)}$.` },
        { value: x0.map((x) => clean(a * x)), why: 'That keeps the shrunk image but leaves out the noise. Add the scaled noise too.' },
        { value: x0.map((x, i) => clean(x + eps[i]!)), why: 'That adds the noise to the image unscaled. Both are scaled first.' },
      ];
      return {
        prompt: `${one ? 'One pixel of a clean image is' : 'A clean image has the pixels'} $${X0} = ${T(x0)}$, and the noise drawn for ${one ? 'it' : 'them'} is $${EPS} = ${T(eps)}$. At a step where $${AB} = ${num(ab)}$, what is $${XT}$?${rounded ? ' Round to two decimals.' : ''}\n\nUse ${roots(L)}.`,
        answer: one ? { kind: 'number', value: v[0]!, places: 2 } : { kind: 'vector', value: v, places: 2 },
        traps: one ? traps(v[0]!, wrong.map((t) => ({ value: t.value[0]!, why: t.why })), 2) : vtraps(v, wrong, 2),
        solution: [
          `$${BLEND}$: the image is scaled by $\\sqrt{${num(ab)}} ${Math.abs(Math.sqrt(ab) - a) < 1e-9 ? '=' : '\\approx'} ${num(a)}$ and the noise by $\\sqrt{${num(clean(1 - ab))}} ${Math.abs(Math.sqrt(1 - ab) - b) < 1e-9 ? '=' : '\\approx'} ${num(b)}$.`,
          ...x0.map((x, i) => `${one ? '' : `Pixel ${i}: `}$${num(a)} \\cdot ${par(x)} + ${num(b)} \\cdot ${par(eps[i]!)} = ${num(clean(a * x))} ${b * eps[i]! < 0 ? '-' : '+'} ${num(clean(Math.abs(b * eps[i]!)))} = ${num(v[i]!)}$.`),
        ],
      };
    },
  },
  {
    id: 'signal',
    make(rng, d) {
      const L = pick(rng, LEVELS);
      const [ab, a, b] = L;
      const kind = d < 0.35 ? pick(rng, ['share', 'noise'] as const) : d < 0.7 ? pick(rng, ['from-a', 'from-b', 'noise'] as const) : pick(rng, ['spread', 'from-b'] as const);
      if (kind === 'share' || kind === 'noise') {
        const sig = kind === 'share';
        const v = sig ? ab : clean(1 - ab);
        return {
          prompt: `A clean image $${X0}$ has pixels of variance 1. At a step where $${AB} = ${num(ab)}$, what is the variance of the ${sig ? 'image' : 'noise'} part of $${XT}$?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: sig ? a : b, why: `That is the factor itself, $${num(sig ? a : b)}$. Scaling by a factor multiplies the variance by its square.` },
            { value: sig ? clean(1 - ab) : ab, why: `That is the ${sig ? 'noise' : 'image'} part's variance. The ${sig ? 'image' : 'noise'} part has the other share.` },
            { value: 1, why: `That is the variance of all of $${XT}$. The question asks about one part.` },
          ]),
          solution: [
            `The ${sig ? `image part is $\\sqrt{${AB}}\\,${X0}$` : `noise part is $\\sqrt{1 - ${AB}}\\,${EPS}$, and $${EPS}$ has variance 1`}. Scaling a number by $c$ multiplies its variance by $c^2$.`,
            sig ? `$(\\sqrt{${AB}})^2 \\times 1 = ${AB} = ${num(ab)}$.` : `$(\\sqrt{1 - ${AB}})^2 \\times 1 = 1 - ${AB} = ${num(v)}$.`,
            `The two parts add up to a variance of $${num(ab)} + ${num(clean(1 - ab))} = 1$: $${AB}$ is the share of the variance still made of image.`,
          ],
        };
      }
      if (kind === 'from-a' || kind === 'from-b') {
        const fromA = kind === 'from-a';
        const v = fromA ? b : a;
        const given = fromA ? a : b;
        return {
          prompt: `At some step, $${XT} = ${fromA ? `${num(a)}\\,${X0} + c\\,${EPS}$` : `c\\,${X0} + ${num(b)}\\,${EPS}$`}. What is $c$? Round to two decimals.\n\nUse ${roots(L)}.`,
          answer: { kind: 'number', value: v, places: 2 },
          traps: traps(v, [
            { value: clean(1 - given), why: `That makes the two factors add up to 1. It is their squares that add up to 1: $${num(given)}^2 + c^2 = 1$.` },
            { value: clean(1 - given * given), why: `That is $c^2$. Take its square root.` },
            { value: given, why: `That is the other factor. The two are equal only when $${AB} = 0.5$.` },
          ], 2),
          solution: [
            `The factors are $\\sqrt{${AB}}$ and $\\sqrt{1 - ${AB}}$, so their squares add up to 1.`,
            fromA ? `$\\sqrt{${AB}} = ${num(a)}$ means $${AB} \\approx ${num(ab)}$.` : `$\\sqrt{1 - ${AB}} = ${num(b)}$ means $1 - ${AB} \\approx ${num(clean(1 - ab))}$, so $${AB} \\approx ${num(ab)}$.`,
            fromA ? `$c = \\sqrt{1 - ${num(ab)}} = \\sqrt{${num(clean(1 - ab))}} \\approx ${num(v)}$.` : `$c = \\sqrt{${num(ab)}} \\approx ${num(v)}$.`,
          ],
        };
      }
      const vx = pick(rng, [0.25, 0.5, 2, 4]);
      const v = clean(ab * vx + 1 - ab);
      return {
        prompt: `The pixels of a clean image $${X0}$ have variance $${num(vx)}$. At a step where $${AB} = ${num(ab)}$, what is the variance of $${XT}$?${Math.abs(round(v, 2) - v) > 1e-9 ? ' Round to two decimals.' : ''}`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps(v, [
          { value: 1, why: `The blend keeps the variance at 1 only when the image starts at variance 1. Here it starts at $${num(vx)}$.` },
          { value: clean(a * vx + b), why: 'That scales the variances by the factors themselves. Scaling by $c$ multiplies a variance by $c^2$.' },
          { value: clean(ab * vx), why: 'That is the image part only. Independent variances add: include the noise part.' },
        ], 2),
        solution: [
          `$${BLEND}$, and scaling by $c$ multiplies a variance by $c^2$.`,
          `Image part, scaled by $\\sqrt{${AB}}$: its variance is $${AB} \\times ${num(vx)} = ${num(ab)} \\times ${num(vx)} = ${num(clean(ab * vx))}$.`,
          `Noise part, scaled by $\\sqrt{1 - ${AB}}$, with $${EPS}$ of variance 1: $(1 - ${num(ab)}) \\times 1 = ${num(clean(1 - ab))}$.`,
          `They are independent, so the variances add: $${num(clean(ab * vx))} + ${num(clean(1 - ab))} = ${num(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'falls',
    make(rng) {
      const ab = pick(rng, [0.99, 0.98, 0.95, 0.5, 0.45, 0.55, 0.05, 0.02, 0.01]);
      const kind = ab > 0.9 ? 'clean' : ab > 0.3 ? 'mid' : 'noise';
      const a = round(Math.sqrt(ab), 2);
      const b = round(Math.sqrt(1 - ab), 2);
      return {
        prompt: `A diffusion model is noising an image. At one step, $${AB} = ${num(ab)}$. What does $${XT}$ look like?`,
        answer: shuffled(rng, [
          { text: 'Nearly the clean image, with a little noise on top', why: kind === 'clean' ? null : kind === 'mid' ? `Only $${num(ab)}$ of the variance is image here: the noise is as strong as the image.` : `Only $${num(ab)}$ of the variance is image here: it is almost all noise.` },
          { text: 'The image, plainly there, under noise about as strong as it is', why: kind === 'mid' ? null : kind === 'clean' ? `With $${AB} = ${num(ab)}$ the noise is scaled by only $${num(b)}$: a light dusting.` : `With $${AB} = ${num(ab)}$ the image is scaled by only $${num(a)}$: it is barely there.` },
          { text: 'Almost pure noise, with a faint trace of the image', why: kind === 'noise' ? null : `The image still makes up $${num(ab)}$ of the variance: far more than a trace.` },
          { text: 'A faded copy of the image, with no noise at all', why: `The noise is scaled by $${num(b)}$, not 0. As $${AB}$ falls the image fades and the noise grows, keeping the variance at 1.` },
        ]),
        solution: [
          `$${BLEND} \\approx ${num(a)}\\,${X0} + ${num(b)}\\,${EPS}$.`,
          `$${AB}$ is the share of $${XT}$'s variance that is still image: here $${num(ab)}$, and $${num(clean(1 - ab))}$ is noise.`,
          kind === 'clean' ? 'Close to 1: the image is nearly untouched.' : kind === 'mid' ? 'Around a half: image and noise are about equally strong.' : 'Close to 0: the image is almost gone, leaving nearly pure noise.',
        ],
      };
    },
  },
  {
    id: 'schedule',
    make(rng) {
      const T = pick(rng, [100, 250, 500, 1000, 4000]);
      const kind = pick(rng, ['what', 'compare', 'compare', 'ends'] as const);
      const lead = `A diffusion model noises images over ${bigText(T)} steps.`;
      if (kind === 'what')
        return {
          prompt: `${lead} What does its noise schedule set?`,
          answer: shuffled(rng, [
            { text: `The value of $${AB}$ at every step: how fast the image fades into noise`, why: null },
            { text: 'The learning rate for each training step', why: 'The schedule belongs to the noising recipe, which has nothing to learn. It says how much noise each step mixes in.' },
            { text: 'Which pixels get noise at each step', why: `Every pixel gets noise at every step. The schedule sets how much: the value of $${AB}$.` },
            { text: `The values of the noise $${EPS}$ itself`, why: `The noise is drawn fresh from \`np.random.randn\`. The schedule only sets how strongly it is mixed in.` },
          ]),
          solution: [
            `The schedule is a list of $${AB}$ values, one per step, starting near 1 and falling toward 0.`,
            'It decides how much of the image is left at each step: a fast-falling schedule destroys the image early, a slow one keeps it longer.',
          ],
        };
      if (kind === 'ends')
        return {
          prompt: `${lead} Where does a schedule's $${AB}$ start at the first step, and where does it end at step ${bigText(T)}?`,
          answer: shuffled(rng, [
            { text: 'Near 1 at the start, and near 0 at the end', why: null },
            { text: 'Near 0 at the start, and near 1 at the end', why: `That is backwards. $${AB}$ is the share of the image left, so it starts high, with the image nearly clean.` },
            { text: '0.5 at every step', why: `Then every step would be equally noisy. $${AB}$ falls step by step, from clean to noise.` },
            { text: 'Near 1 at both ends', why: 'Then the last step would still be a nearly clean image. The noising ends in almost pure noise.' },
          ]),
          solution: [
            `At the first step almost nothing has been mixed in: $${AB}$ is close to 1 and $${XT}$ is nearly $${X0}$.`,
            `By the last step $${AB}$ is close to 0: $${XT}$ is almost pure noise, whatever the image was.`,
          ],
        };
      const t = Math.round(T / 2);
      const [pa, pb] = rng.shuffle([pick(rng, [0.6, 0.5, 0.7]), pick(rng, [0.1, 0.05, 0.2])]);
      const aMore = pa! > pb!;
      return {
        prompt: `${lead} Two schedules are tried. At step $t = ${big(t)}$, schedule A has $${AB} = ${num(pa!)}$ and schedule B has $${AB} = ${num(pb!)}$. At that step, under which schedule does $${XT}$ keep more of the image?`,
        answer: shuffled(rng, [
          { text: 'Schedule A', why: aMore ? null : `A has the smaller $${AB}$, $${num(pa!)}$: less of its variance is image.` },
          { text: 'Schedule B', why: aMore ? `B has the smaller $${AB}$, $${num(pb!)}$: less of its variance is image.` : null },
          { text: 'The same: the step number decides how noisy it is', why: `The step number alone says nothing. Each schedule maps steps to its own $${AB}$, and that sets the noise.` },
          { text: 'It cannot be told without the noise values', why: `The noise is random either way. How much of the image survives is set by $${AB}$ alone.` },
        ]),
        solution: [
          `$${AB}$ is the share of the variance that is still image.`,
          `${aMore ? 'A' : 'B'} has $${AB} = ${num(Math.max(pa!, pb!))}$ against $${num(Math.min(pa!, pb!))}$: it keeps more of the image at this step. ${aMore ? 'B' : 'A'}'s schedule falls faster.`,
        ],
      };
    },
  },
];

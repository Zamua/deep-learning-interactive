import type { Generator } from '../../../mastery/domain/types';
import { big, clean, commas, int, num, par, pick, round, shuffled, sum, tenth, traps, vec, vtraps } from '../../kit';
import { AB, BLEND, EHAT, EPS, LEVELS, roots, X0, XT } from '../kit';

export const generators: Generator[] = [
  {
    id: 'mse',
    make(rng, d) {
      const n = d < 0.35 ? 2 : d < 0.7 ? 3 : 4;
      const eps = Array.from({ length: n }, () => (d < 0.35 ? int(rng, -2, 2) : tenth(rng, -2, 2)));
      let pred: number[];
      for (;;) {
        pred = eps.map((e) => clean(e + (d < 0.35 ? int(rng, -2, 2) : int(rng, -6, 6) / 10)));
        if (pred.filter((p, i) => p !== eps[i]).length >= Math.min(2, n)) break;
      }
      const diff = eps.map((e, i) => clean(e - pred[i]!));
      const sq = diff.map((x) => clean(x * x));
      const total = sum(sq);
      const v = clean(total / n);
      return {
        prompt: `A noised image $${XT}$ of ${n} pixels was made with the noise $${EPS} = ${vec(eps)}$. The network looks at $${XT}$ and guesses $${EHAT} = ${vec(pred)}$. What is the loss?${Math.abs(round(v, 2) - v) > 1e-9 ? ' Round to two decimals.' : ''}`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps(v, [
          { value: total, why: `That is the sum of the squares. The mean divides it by the ${n} pixels.` },
          { value: clean(sum(diff) / n), why: 'That averages the differences without squaring them, so misses in both directions cancel.' },
          { value: clean(sum(diff.map(Math.abs)) / n), why: 'That averages the sizes of the misses. Square each difference first.' },
        ], 2),
        solution: [
          `The loss is the mean squared error. Differences: $${EPS} - ${EHAT} = ${vec(diff)}$.`,
          `Squares: $${vec(sq)}$, which add up to $${num(total)}$.`,
          `Mean over the ${n} pixels: $${num(total)} / ${n} ${Math.abs(round(v, 2) - v) > 1e-9 ? '\\approx' : '='} ${num(round(v, 2))}$.`,
        ],
      };
    },
  },
  {
    id: 'x0-hat',
    make(rng, d) {
      const L = d < 0.35 ? pick(rng, LEVELS.slice(0, 2)) : pick(rng, LEVELS.filter((l) => l[0] >= 0.19));
      const [, a, b] = L;
      const n = d < 0.6 ? 1 : 2;
      const xt = Array.from({ length: n }, () => (d < 0.35 ? pick(rng, [-1, -0.4, 0.2, 0.6, 1, 1.4]) : tenth(rng, -2, 2)));
      const e = Array.from({ length: n }, () => (d < 0.35 ? pick(rng, [-1, -0.5, 0.5, 1]) : tenth(rng, -2, 2)));
      const est = (f: (x: number, k: number) => number) => xt.map((x, i) => clean(f(x, i)));
      const v = est((x, i) => (x - b * e[i]!) / a);
      const one = n === 1;
      const T = (xs: number[]) => (one ? num(xs[0]!) : vec(xs));
      const wrong = [
        { value: est((x, i) => x - b * e[i]!), why: `That removes the noise but forgets the image was shrunk by $\\sqrt{${AB}} = ${num(a)}$. Divide by it too.` },
        { value: est((x, i) => (x - e[i]!) / a), why: `That subtracts the guessed noise unscaled. In $${XT}$ the noise was scaled by $\\sqrt{1 - ${AB}} = ${num(b)}$.` },
        { value: est((x, i) => (x + b * e[i]!) / a), why: 'That adds the noise instead of taking it away.' },
        { value: est((x) => x / a), why: 'That only undoes the shrinking. Take away the scaled noise first.' },
      ];
      return {
        prompt: `At a step where $${AB} = ${num(L[0])}$, the network sees ${one ? 'a pixel' : 'the pixels'} $${XT} = ${T(xt)}$ and predicts the noise $${EHAT} = ${T(e)}$. What estimate of the clean image $${X0}$ does that give? Round to two decimals.\n\nUse ${roots(L)}.`,
        answer: one ? { kind: 'number', value: v[0]!, places: 2 } : { kind: 'vector', value: v, places: 2 },
        traps: one ? traps(v[0]!, wrong.map((w) => ({ value: w.value[0]!, why: w.why })), 2) : vtraps(v, wrong, 2),
        solution: [
          `Solve $${BLEND}$ for the image: $${X0} = (${XT} - \\sqrt{1 - ${AB}}\\,${EPS}) / \\sqrt{${AB}}$, with the guess $${EHAT}$ in place of $${EPS}$.`,
          ...xt.map((x, i) => `${one ? '' : `Pixel ${i}: `}$(${num(x)} - ${num(b)} \\cdot ${par(e[i]!)}) / ${num(a)} = ${num(clean(x - b * e[i]!))} / ${num(a)} ${Math.abs(round(v[i]!, 2) - v[i]!) > 1e-9 ? '\\approx' : '='} ${num(round(v[i]!, 2))}$.`),
          'A good guess of the noise is a good guess of the image.',
        ],
      };
    },
  },
  {
    id: 'inputs',
    make(rng) {
      const T = pick(rng, [100, 1000, 4000]);
      const t = int(rng, 1, T - 1);
      const kind = pick(rng, ['sees', 'asked', 'copy'] as const);
      const lead = `A diffusion model is trained over ${commas(T)} noise steps. One training image is noised to step $t = ${big(t)}$.`;
      if (kind === 'sees')
        return {
          prompt: `${lead} What does the network get as its input?`,
          answer: shuffled(rng, [
            { text: `The noised image $${XT}$ and the step $t$`, why: null },
            { text: `The clean image $${X0}$ and the step $t$`, why: `If it saw $${X0}$, finding the noise would be a subtraction. It gets only the blend, $${XT}$.` },
            { text: `The noise $${EPS}$ and the step $t$`, why: `The noise is what it has to find. Showing it would make the task empty.` },
            { text: `The noised image $${XT}$ alone`, why: 'It also gets the step $t$, which says how much noise to look for. The same network serves every step.' },
          ]),
          solution: [
            `The network sees $${XT}$, the blend, and $t$, which tells it how much of $${XT}$ is noise.`,
            `It never sees $${X0}$ or $${EPS}$ separately.`,
          ],
        };
      if (kind === 'asked')
        return {
          prompt: `${lead} What is the network trained to output?`,
          answer: shuffled(rng, [
            { text: `The noise $${EPS}$ that was mixed in`, why: null },
            { text: `The step $t$`, why: 'The step is one of its inputs. Its output is a guess of the noise, the same shape as the image.' },
            { text: `The next noisier image, at step $t + 1$`, why: 'Making noisier images needs no network: the blend does it. The network learns the hard direction, finding the noise.' },
            { text: 'A label for what the image shows', why: 'No labels are used. The target is the noise drawn for this example.' },
          ]),
          solution: [
            `The target is the noise $${EPS}$ drawn for this example: the network's guess $${EHAT}$ has the shape of the image.`,
            `The loss is the mean of $(${EPS} - ${EHAT})^2$ over the pixels.`,
          ],
        };
      return {
        prompt: `${lead} The network is asked for $${EPS}$. Why can it not simply read the answer off its input?`,
        answer: shuffled(rng, [
          { text: `It only sees the blend $${XT}$, and has to work out which part of it is noise`, why: null },
          { text: `It can: $${EPS}$ is one of its inputs`, why: `$${EPS}$ is not an input. Only $${XT}$ and $t$ are.` },
          { text: 'Because the noise is drawn again after the network answers', why: 'The noise for this example is drawn once, before the network sees $x_t$, and the same draw is the target.' },
          { text: `Because $${XT}$ is smaller than $${EPS}$`, why: `$${XT}$ has exactly the shape of the image and of $${EPS}$. The difficulty is that image and noise are mixed together.` },
        ]),
        solution: [
          `$${XT}$ mixes the image and the noise into one set of pixels.`,
          'To split them, the network has to learn what images look like: whatever does not look like an image is noise. That is what makes the task useful.',
        ],
      };
    },
  },
  {
    id: 'steps',
    make(rng) {
      const B = pick(rng, [16, 32, 64, 128, 256]);
      const size = pick(rng, ['$32 \\times 32$', '$64 \\times 64$', '$256 \\times 256$']);
      const items = [
        `Take a random minibatch of $${B}$ clean images $${X0}$`,
        `Give each one a random step $t$ and fresh noise $${EPS}$`,
        `Blend each image with its noise into $${XT}$`,
        `Run the network on each $${XT}$ and $t$ to get $${EHAT}$`,
        `Average $(${EPS} - ${EHAT})^2$ and take a gradient step`,
      ];
      return {
        prompt: `A diffusion model is trained on ${size} images with minibatches of $${B}$. Put one training step in order.`,
        answer: { kind: 'order', items },
        solution: [
          'Start from clean images: a fresh random minibatch.',
          'Each image gets its own random step and its own noise, so one batch trains every noise level at once.',
          `The blend makes $${XT}$; the network sees only that and $t$.`,
          `The loss compares its guess with the noise that was really used, and the gradient step lowers it.`,
        ],
      };
    },
  },
];

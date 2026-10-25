import type { Generator } from '../../../mastery/domain/types';
import { num, pick, round } from '../../kit';
import { LN2, clean, shuffled, traps } from '../kit';

const DX = (v: string) => `D(${v})`;
const lnList = (ps: number[]) =>
  [...new Set(ps.map((p) => clean(p)))]
    .sort((a, b) => b - a)
    .map((p) => `$\\ln ${num(p)} \\approx ${num(LN2(p), 2)}$`)
    .join(', ');
const neg = (p: number) => num(-LN2(p), 2);

export const generators: Generator[] = [
  {
    id: 'losses',
    make(rng, d) {
      const real = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
      const fake = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
      const who = d < 0.35 || rng.next() < 0.6 ? 'disc' : 'gen';
      if (who === 'gen') {
        const b = pick(rng, fake);
        const v = round(-LN2(b), 2);
        return {
          prompt: `The discriminator gives one of the generator's fakes $${DX('G(z)')} = ${num(b)}$. The generator is trained as if its fakes were labeled real. What is its loss on this fake? Round to two decimals.\n\nUse ${lnList([b, 1 - b])}.`,
          answer: { kind: 'number', value: v, places: 2 },
          traps: traps(v, [
            { value: -LN2(1 - b), why: `That is $-\\ln(1 - ${DX('G(z)')})$, the discriminator's loss on this fake. The generator wants it called real: $-\\ln ${DX('G(z)')}$.` },
            { value: LN2(b), why: 'That leaves out the minus sign. A loss is never negative here.' },
            { value: b, why: 'That is the probability itself. The loss is minus its log.' },
          ], 2),
          solution: [
            `To the generator, its fake should be labeled real, so its loss is the cross-entropy for "real": $-\\ln ${DX('G(z)')}$.`,
            `$-\\ln ${num(b)} \\approx ${neg(b)}$.`,
            `The lower $${DX('G(z)')}$, the larger this loss: the generator is pushed to make its fakes look more real.`,
          ],
        };
      }
      if (d < 0.7) {
        const a = pick(rng, real);
        const b = pick(rng, fake);
        const v = round(-LN2(a) - LN2(1 - b), 2);
        return {
          prompt: `The discriminator sees one real image $x$ and one fake $G(z)$. It gives $${DX('x')} = ${num(a)}$ and $${DX('G(z)')} = ${num(b)}$, each the probability that the image is real. What is the discriminator's loss: its cross-entropy on the real image plus its cross-entropy on the fake? Round to two decimals.\n\nUse ${lnList([a, b, 1 - b])}.`,
          answer: { kind: 'number', value: v, places: 2 },
          traps: traps(v, [
            { value: -LN2(a) - LN2(b), why: `That uses $-\\ln ${DX('G(z)')}$ for the fake, as if it were labeled real. The fake's label is 0, so its loss is $-\\ln(1 - ${DX('G(z)')})$.` },
            { value: -LN2(a), why: 'That is the real image\'s part only. Add the loss on the fake.' },
            { value: LN2(a) + LN2(1 - b), why: 'That leaves out the minus signs. Each cross-entropy is minus a log.' },
          ], 2),
          solution: [
            `The real image is labeled 1: its loss is $-\\ln ${DX('x')} = -\\ln ${num(a)} \\approx ${neg(a)}$.`,
            `The fake is labeled 0, so the probability of its right answer is $1 - ${num(b)} = ${num(clean(1 - b))}$: its loss is $-\\ln ${num(clean(1 - b))} \\approx ${neg(clean(1 - b))}$.`,
            `Together: $${neg(a)} + ${neg(clean(1 - b))} = ${num(v, 2)}$.`,
          ],
        };
      }
      const a = [pick(rng, real), pick(rng, real)];
      const b = [pick(rng, fake), pick(rng, fake)];
      const lr = round((-LN2(a[0]!) - LN2(a[1]!)) / 2, 3);
      const lf = round((-LN2(1 - b[0]!) - LN2(1 - b[1]!)) / 2, 3);
      const v = round(lr + lf, 2);
      return {
        prompt: `The discriminator sees two real images and two fakes. It gives the real ones $${num(a[0]!)}$ and $${num(a[1]!)}$, and the fakes $${num(b[0]!)}$ and $${num(b[1]!)}$, each the probability that the image is real. Its loss is the average cross-entropy over the real images plus the average over the fakes. What is it? Round to two decimals.\n\nUse ${lnList([...a, ...b.map((x) => 1 - x)])}.`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps(v, [
          { value: (-LN2(a[0]!) - LN2(a[1]!) - LN2(b[0]!) - LN2(b[1]!)) / 2, why: 'That treats the fakes as if they were labeled real. A fake\'s loss is $-\\ln(1 - D)$.' },
          { value: lr, why: 'That is the real images\' part only. Add the average loss on the fakes.' },
          { value: 2 * v, why: 'That adds the four losses without averaging each pair.' },
        ], 2),
        solution: [
          `Real images, labeled 1: $(-\\ln ${num(a[0]!)} - \\ln ${num(a[1]!)}) / 2 \\approx ${num(lr, 3)}$.`,
          `Fakes, labeled 0, so each right answer has probability $1 - D$: $(-\\ln ${num(clean(1 - b[0]!))} - \\ln ${num(clean(1 - b[1]!))}) / 2 \\approx ${num(lf, 3)}$.`,
          `Together: $${num(lr, 3)} + ${num(lf, 3)} \\approx ${num(v, 2)}$.`,
        ],
      };
    },
  },
  {
    id: 'g-goal',
    make(rng) {
      const b = pick(rng, [0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.6]);
      const kind = pick(rng, ['goal', 'goal', 'frozen'] as const);
      if (kind === 'goal')
        return {
          prompt: `The discriminator gives one of the generator's fakes $${DX('G(z)')} = ${num(b)}$. In the generator's training step, what is it trying to do?`,
          answer: shuffled(rng, [
            { text: `Raise $${DX('G(z)')}$ above $${num(b)}$, so the discriminator takes the fake for real`, why: null },
            { text: `Lower $${DX('G(z)')}$ below $${num(b)}$, so the fake is easier to spot`, why: 'That is the discriminator\'s goal: it wants fakes called fake. The generator wants the opposite.' },
            { text: 'Raise the discriminator\'s output on the real images', why: 'The generator has no say over how the real images are scored: they never pass through it. It only changes its fakes.' },
            { text: 'Make its fake match one particular training image', why: 'No training image is the target. The generator only learns from how the discriminator scores its fakes.' },
          ]),
          solution: [
            'The generator is trained as if its fakes were labeled real: its loss is $-\\ln D(G(z))$.',
            `Lowering that loss means raising $${DX('G(z)')}$ from $${num(b)}$ toward 1: fooling the discriminator.`,
          ],
        };
      return {
        prompt: `The discriminator gives one of the generator's fakes $${DX('G(z)')} = ${num(b)}$, and the generator takes a training step on that. Whose weights does the step change?`,
        answer: shuffled(rng, [
          { text: 'Only the generator\'s, with the gradient passing back through the discriminator', why: null },
          { text: 'Both networks\' weights, each nudged toward its own goal', why: 'If the discriminator moved too, it would move toward calling this fake real, which undoes its own job. Its weights are held fixed during the generator\'s step.' },
          { text: 'Only the discriminator\'s, so it can catch this fake next time', why: 'That is the other step. In the generator\'s step only the generator learns.' },
          { text: 'Neither: the generator improves without any gradient at all', why: 'It learns by gradient descent like any network: the gradient of its loss flows back through D into G.' },
        ]),
        solution: [
          'Training alternates: a step for the discriminator, then a step for the generator.',
          'In the generator\'s step, the loss $-\\ln D(G(z))$ is backpropagated through the discriminator into the generator, but only the generator\'s weights are updated.',
        ],
      };
    },
  },
  {
    id: 'who-stepped',
    make(rng) {
      const a0 = pick(rng, [0.55, 0.6, 0.65, 0.7, 0.75, 0.8]);
      const b0 = pick(rng, [0.2, 0.25, 0.3, 0.35, 0.4, 0.45]);
      const dStep = rng.next() < 0.5;
      const a1 = dStep ? clean(a0 + pick(rng, [0.05, 0.1])) : a0;
      const b1 = dStep ? clean(b0 - pick(rng, [0.05, 0.1])) : clean(b0 + pick(rng, [0.05, 0.1, 0.15]));
      const opts = [
        { text: 'The discriminator', why: dStep ? null : 'A discriminator step would push the fake\'s score down, not up, and here the score on the real image did not move at all.' },
        { text: 'The generator', why: dStep ? 'A generator step cannot change the score on a real image, which never passes through it, and it pushes the fake\'s score up, not down.' : null },
        { text: 'Both networks, in one step', why: dStep ? 'Only the discriminator moves the real image\'s score, and the fake\'s score fell: the generator would have raised it.' : 'The real image\'s score did not move, so the discriminator did not change. The generator alone raised the fake\'s score.' },
      ];
      return {
        prompt: `Before one training step, the discriminator gives a real image $${num(a0)}$ and a fake $${num(b0)}$. After the step, shown the same real image and a fake made from the same noise $z$, it gives the real one $${num(a1)}$ and the fake $${num(b1)}$. Which network was just updated?`,
        answer: shuffled(rng, opts),
        solution: dStep
          ? [
              `The real image's score rose ($${num(a0)} \\to ${num(a1)}$) and the fake's fell ($${num(b0)} \\to ${num(b1)}$): better at telling them apart.`,
              'That is the discriminator\'s goal, and only its weights decide how a real image is scored.',
            ]
          : [
              `The real image's score is unchanged at $${num(a0)}$, so the discriminator's weights did not move.`,
              `The fake's score rose ($${num(b0)} \\to ${num(b1)}$): the generator changed the fake to look more real.`,
            ],
      };
    },
  },
  {
    id: 'collapse',
    make(rng) {
      const scene = pick(rng, [
        ['handwritten digits 0 to 9', 'a convincing 7'],
        ['handwritten digits 0 to 9', 'the same neat 1'],
        ['photos of faces of every age', 'one smiling young face'],
        ['photos of shoes of every style', 'the same white sneaker'],
        ['photos of 10 kinds of animals', 'a convincing cat'],
        ['pictures of flowers of many colors', 'one red rose'],
        ['photos of bedrooms', 'one bedroom with a blue bed'],
      ] as const);
      const kind = pick(rng, ['name', 'name', 'cause'] as const);
      const symptom = `A GAN is trained on ${scene[0]}. After a while, its generator draws ${scene[1]} for almost every noise vector $z$ it is given.`;
      if (kind === 'name')
        return {
          prompt: `${symptom} What has gone wrong?`,
          answer: shuffled(rng, [
            { text: 'Mode collapse: it found a few outputs that fool the discriminator, and makes only those', why: null },
            { text: 'Overfitting: the generator memorized the training set and copies it back', why: 'Memorizing would reproduce many different training images. Here the variety itself is gone: different $z$ give the same output.' },
            { text: 'The noise vectors it is given are too similar for it to tell apart', why: 'The noise vectors differ as much as ever. The generator has learned to map them all to nearly the same output.' },
            { text: 'The discriminator is too weak to tell any fake from a real image', why: 'A discriminator can spot fakes and still be fooled by one kind. The generator found that kind and stopped exploring.' },
          ]),
          solution: [
            'The generator is rewarded only for fooling the discriminator, not for covering the data.',
            'If one kind of output fools it, the cheapest strategy is to make that kind for every $z$: the generator collapses onto one mode of the data.',
            'The discriminator may catch on and the generator may hop to another output, but nothing in its loss asks for variety.',
          ],
        };
      return {
        prompt: `${symptom} Why does nothing in the generator's loss stop this?`,
        answer: shuffled(rng, [
          { text: 'It only asks each fake to fool the discriminator, not to cover every kind of image', why: null },
          { text: 'It compares each fake with the one training image it should copy', why: 'There is no target image for a fake. The generator only hears how real the discriminator thinks it looks.' },
          { text: 'It is the discriminator\'s own loss, which falls when the fakes look alike', why: 'The generator\'s loss is $-\\ln D(G(z))$, its own: it falls when a fake fools the discriminator, alike or not.' },
          { text: 'Its gradient is zero whenever two of its fakes come out the same', why: 'Repeated fakes still get gradients. The problem is that repeating a fake that works is a fine way to lower the loss.' },
        ]),
        solution: [
          'The generator\'s loss for each fake is $-\\ln D(G(z))$: small when that fake fools the discriminator.',
          'Nothing compares one fake with another, so a generator that makes one convincing image for every $z$ scores well.',
          'That is mode collapse: the variety of the data is lost even though each sample looks real.',
        ],
      };
    },
  },
];

import type { Generator } from '../../../mastery/domain/types';
import { num, pick } from '../../kit';
import { big, bigText, shuffled, traps } from '../kit';

const TASKS: [string, number][] = [
  ['flower species', 102],
  ['dog breeds', 120],
  ['car models', 196],
  ['bird species', 200],
  ['dishes of food', 101],
];
const DOMAINS = ['chest X-rays', 'satellite images of farmland', 'microscope images of cells', 'ultrasound scans', 'radar images of storms'];
const PRE = 'a network pretrained on ImageNet';

export const generators: Generator[] = [
  {
    id: 'strategy',
    make(rng) {
      const [task, C] = pick(rng, TASKS);
      const small = rng.int(2) === 0;
      const N = small ? pick(rng, [200, 500, 1000, 2000]) : pick(rng, [200000, 500000, 1000000]);
      const n = bigText(N);
      const whyD = `Its last layer scores ImageNet's 1,000 classes, not your ${C}: it needs a new last layer.`;
      return {
        prompt: `You start from ${PRE}. You want to label ${task}, ${C} classes, and you have ${n} labeled images of them. What should you do?`,
        answer: shuffled(rng, [
          { text: 'Keep the pretrained layers fixed and train only a new last layer', why: small ? null : 'With this much data the earlier layers can adapt to the new task too. Keeping them fixed leaves accuracy behind.' },
          { text: 'Start from the pretrained weights and fine-tune every layer', why: small ? `Adjusting millions of weights on ${n} images lets the network memorize them: it overfits.` : null },
          { text: 'Train the whole network again, from random weights', why: small ? `Millions of weights trained from scratch on ${n} images overfit badly, and the pretrained filters go to waste.` : 'The pretrained filters already detect edges, textures and parts. Starting from them is faster and usually ends better.' },
          { text: 'Use the pretrained network as it is, last layer included', why: whyD },
        ]),
        solution: small
          ? [`${n} images is little data for millions of weights: changing them all would overfit.`, `Keep the pretrained layers as they are, and train only a new last layer with ${C} outputs on top of their features.`]
          : [`${n} images is enough to adjust every weight without memorizing.`, 'Start from the pretrained weights, replace the last layer, and fine-tune all of it with a small learning rate.'],
      };
    },
  },
  {
    id: 'trainable',
    make(rng, d) {
      if (d >= 0.75) {
        const D = pick(rng, [512, 1024]);
        const H = pick(rng, [128, 256]);
        const C = pick(rng, [5, 10]);
        const v = D * H + H + H * C + C;
        return {
          prompt: `A pretrained network turns each image into $${big(D)}$ features. You keep it fixed and put two new fully connected layers on top: $${big(D)}$ to $${H}$ hidden units, then $${H}$ to $${C}$ class scores. How many parameters does training change?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: D * H + H * C, why: 'That leaves out the biases: one per hidden unit and one per class.' },
            { value: D * C + C, why: 'That is a single layer straight to the classes. There are two new layers here.' },
            { value: D * H + H, why: 'That is only the first new layer. The second, to the class scores, is trained too.' },
          ]),
          solution: [
            `First new layer: $${big(D)} \\times ${H} + ${H} = ${big(D * H + H)}$.`,
            `Second: $${H} \\times ${C} + ${C} = ${big(H * C + C)}$.`,
            `Only these change: $${big(v)}$ parameters. The pretrained layers stay fixed.`,
          ],
        };
      }
      const D = d < 0.4 ? 512 : pick(rng, [512, 1024, 2048, 4096]);
      const C = d < 0.4 ? pick(rng, [2, 3, 5, 10]) : pick(rng, [10, 20, 100]);
      const v = D * C + C;
      return {
        prompt: `A pretrained network turns each image into $${big(D)}$ features, and its last fully connected layer scores 1,000 classes. You replace that layer with a new one for $${C}$ classes and keep every other layer fixed. How many parameters does training change?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: D * C, why: 'That leaves out the biases: one per class.' },
          { value: D * 1000 + 1000, why: 'That is the old last layer, for 1,000 classes. The new one has only $' + C + '$ outputs.' },
          { value: D + C, why: 'That adds the sizes. A fully connected layer has a weight for every input and output pair: multiply.' },
        ]),
        solution: [
          `The new layer has a weight for each of the $${big(D)}$ features and each of the $${C}$ classes: $${big(D)} \\times ${C} = ${big(D * C)}$.`,
          `Plus one bias per class: $${big(v)}$. Every other layer stays fixed, so nothing else changes.`,
        ],
      };
    },
  },
  {
    id: 'lr',
    make(rng) {
      const eta = pick(rng, [0.1, 0.01, 0.05]);
      const [task] = pick(rng, TASKS);
      const N = pick(rng, [20000, 50000, 100000]);
      const small = eta / 10;
      return {
        prompt: `A network was trained from scratch on ImageNet with learning rate $\\symeta = ${num(eta)}$. You now fine-tune all of its layers on ${bigText(N)} images of ${task}. Which learning rate makes sense?`,
        answer: shuffled(rng, [
          { text: `$\\symeta = ${num(small)}$, so the pretrained weights move only a little`, why: null },
          { text: `$\\symeta = ${num(eta * 10)}$, to move away from the old task quickly`, why: 'Big steps would wreck the pretrained filters in the first few updates, throwing away what they learned.' },
          { text: `$\\symeta = ${num(eta)}$, the same rate as the original training`, why: 'Steps sized for random starting weights move the pretrained weights too far: they are already good and only need small changes.' },
          { text: '$\\symeta = 0$, so that nothing learned is lost', why: 'With $\\symeta = 0$ every step is zero: no layer changes, so nothing is fine-tuned.' },
        ]),
        solution: [
          'The pretrained weights are already good; fine-tuning should nudge them, not replace them.',
          `So use a smaller learning rate than training from scratch, often about 10 times smaller: $\\symeta = ${num(small)}$.`,
        ],
      };
    },
  },
  {
    id: 'layers',
    make(rng) {
      const dom = pick(rng, DOMAINS);
      const N = pick(rng, [300, 800, 2000, 5000]);
      return {
        prompt: `You have ${bigText(N)} labeled ${dom}, which look nothing like ImageNet's photos, and ${PRE}. Which of its layers' features are most likely to carry over to your images?`,
        answer: shuffled(rng, [
          { text: 'The early layers, whose filters detect edges and simple textures', why: null },
          { text: 'The last layers, whose features are the most refined', why: 'The last layers are the most tuned to ImageNet\'s 1,000 classes: the most specific to the old task.' },
          { text: 'Every layer carries over equally well to any image', why: 'Later layers combine edges into parts of ImageNet\'s objects, which may not appear in your images at all.' },
          { text: 'No layer, since features never carry over to new images', why: 'Edges and simple textures appear in every kind of image, so the early filters still apply.' },
        ]),
        solution: [
          'Early filters respond to edges, color changes and simple textures: patterns found in almost any image.',
          'Later layers combine them into parts of the objects in the original classes, which are specific to that data.',
          `So with ${dom}, rely on the early layers and retrain the later ones as far as your data allows.`,
        ],
      };
    },
  },
];

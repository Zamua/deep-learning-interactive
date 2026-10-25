import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick } from '../../kit';
import { shuffled, traps } from '../kit';

type T = 'hflip' | 'vflip' | 'rot180' | 'hue' | 'crop' | 'bright' | 'tilt' | 'shift';

const TEXT: Record<T, string> = {
  hflip: 'Flipping it left to right',
  vflip: 'Flipping it top to bottom',
  rot180: 'Turning it upside down, 180 degrees',
  hue: 'Shifting all its colors around the color wheel',
  crop: 'Cropping a random 90% of it',
  bright: 'Making it slightly brighter or darker',
  tilt: 'Rotating it by up to 10 degrees',
  shift: 'Shifting it by a few pixels',
};

const SAFE_WHY: Record<T, string> = {
  hflip: 'For this task a mirror image shows the same answer, so this flip is safe.',
  vflip: 'For this task upside down shows the same answer, so this flip is safe.',
  rot180: 'For this task a half turn shows the same answer, so it is safe.',
  hue: 'Colors do not decide this label, so shifting them is safe.',
  crop: 'A crop that keeps 90% of the image keeps what it shows.',
  bright: 'Slightly brighter or darker, the image still shows the same thing.',
  tilt: 'A slight tilt does not change what the image shows.',
  shift: 'Moving the content a few pixels does not change what it shows.',
};

interface Task {
  what: string;
  bad: T;
  why: string;
  safe: T[];
}

const TASKS: Task[] = [
  { what: 'handwritten digits, 0 to 9', bad: 'rot180', why: 'A 6 turned upside down looks like a 9, so the label would be wrong.', safe: ['crop', 'bright', 'tilt', 'shift'] },
  { what: 'handwritten lowercase letters', bad: 'hflip', why: 'A mirrored b is a d, so the label would be wrong.', safe: ['crop', 'bright', 'tilt', 'shift'] },
  { what: 'road signs that say turn left or turn right', bad: 'hflip', why: 'A mirrored left-turn sign is a right-turn sign.', safe: ['crop', 'bright', 'tilt', 'shift'] },
  { what: 'traffic lights as red or green', bad: 'hue', why: 'Shifting the colors can turn red into green: the color is the label.', safe: ['hflip', 'crop', 'bright', 'shift'] },
  { what: 'arrows as pointing up or pointing down', bad: 'vflip', why: 'An up arrow flipped top to bottom points down.', safe: ['hflip', 'crop', 'bright', 'shift'] },
  { what: 'clock faces by the hour they show', bad: 'hflip', why: 'A mirrored clock reading 3 reads 9.', safe: ['crop', 'bright', 'shift', 'hue'] },
  { what: 'bananas as ripe (yellow) or unripe (green)', bad: 'hue', why: 'Shifting the colors can turn yellow into green: the color is the label.', safe: ['hflip', 'vflip', 'tilt', 'crop'] },
  { what: 'hand gestures as thumbs up or thumbs down', bad: 'vflip', why: 'A thumbs up flipped top to bottom is a thumbs down.', safe: ['hflip', 'crop', 'bright', 'shift', 'hue'] },
];

export const generators: Generator[] = [
  {
    id: 'label-safe',
    make(rng) {
      const task = pick(rng, TASKS);
      const safe = rng.shuffle([...task.safe]).slice(0, 3);
      return {
        prompt: `A model learns to label images of ${task.what}. Which random change to a training image could make its label wrong?`,
        answer: shuffled(rng, [{ text: TEXT[task.bad], why: null }, ...safe.map((t) => ({ text: TEXT[t], why: SAFE_WHY[t] }))]),
        solution: [
          `${task.why}`,
          'A random change is only safe if the true label is the same afterwards. The others change how the image looks, not what it shows.',
        ],
      };
    },
  },
  {
    id: 'crops',
    make(rng, d) {
      if (d < 0.3) {
        const S = pick(rng, [6, 8, 10, 12]);
        const k = int(rng, 1, 3);
        const c = S - k;
        const v = (k + 1) ** 2;
        return {
          prompt: `An image is $${S} \\times ${S}$ pixels. A random $${c} \\times ${c}$ crop is cut from it, at whole-pixel positions. How many different crops are there?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: k * k, why: `That leaves out the $+1$: the crop can start at column 0, 1, ..., ${k}, which is ${k + 1} places.` },
            { value: k + 1, why: 'That counts one direction. The crop moves down as well as across: multiply the two.' },
          ]),
          solution: [
            `Across, the crop's left edge can sit at $0$ to $${S} - ${c} = ${k}$: $${k + 1}$ places.`,
            `Down, the same: $${k + 1}$. In all, $${k + 1} \\times ${k + 1} = ${v}$.`,
          ],
        };
      }
      const flip = d >= 0.65 && rng.int(2) === 0;
      const W = pick(rng, [32, 36, 40]);
      const H = d >= 0.65 && !flip ? W - 4 : W;
      const c = pick(rng, [24, 28, 30, 32].filter((x) => x <= H - 2 && x >= H - 10));
      const a = W - c + 1;
      const b = H - c + 1;
      const v = a * b * (flip ? 2 : 1);
      return {
        prompt: `A random $${c} \\times ${c}$ crop is cut at whole-pixel positions from a training image of $${W} \\times ${H}$ pixels (width by height)${flip ? ', then flipped left to right half of the time' : ''}. How many different versions of the image can that give?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: (W - c) * (H - c) * (flip ? 2 : 1), why: `That leaves out the $+1$: across, the crop can start at $0$ to $${W - c}$, which is $${a}$ places.` },
          { value: a * (flip ? 2 : 1), why: 'That counts one direction only. The crop moves down as well as across: multiply the two.' },
          ...(flip ? [{ value: a * b, why: 'That leaves out the flip: each crop also comes mirrored, which doubles the count.' }] : []),
          ...(flip ? [{ value: a * b + 2, why: 'The flip doubles every crop: multiply by 2, do not add 2.' }] : []),
        ]),
        solution: [
          `Across: $${W} - ${c} + 1 = ${a}$ places. Down: $${H} - ${c} + 1 = ${b}$.`,
          `Crops: $${a} \\times ${b} = ${a * b}$.${flip ? ` Each also comes flipped or not: $${a * b} \\times 2 = ${v}$.` : ''}`,
        ],
      };
    },
  },
  {
    id: 'when',
    make(rng) {
      const N = pick(rng, [10000, 40000, 50000, 60000]);
      const E = pick(rng, [10, 20, 30, 50]);
      return {
        prompt: `A model trains for ${E} epochs on ${N.toLocaleString('en-US')} training images, with random crops and flips. When should the random changes be applied?`,
        answer: shuffled(rng, [
          { text: 'To a training image each time it is used, with fresh random choices', why: null },
          { text: 'Once before training, saving one changed copy of every image', why: `One fixed copy gives each image only one variant for all ${E} epochs. Fresh random choices give a new one every time.` },
          { text: 'To validation and test images too, so they match the training ones', why: 'Validation and test measure how the model does on real images. Random changes there would make that measurement noisy.' },
          { text: 'Only to the validation images, to make the check harder to pass', why: 'Validation only measures the model. Changing it teaches the model nothing.' },
        ]),
        solution: [
          `Each epoch then shows every image in a new random variant, so over ${E} epochs the model never sees exactly the same image twice.`,
          'Validation and test images stay as they are, so they keep measuring the model on real data.',
        ],
      };
    },
  },
  {
    id: 'gap',
    make(rng) {
      const tr = pick(rng, [0.05, 0.1, 0.15, 0.2]);
      const va = pick(rng, [0.9, 1.1, 1.3, 1.6]);
      const E = pick(rng, [20, 30, 40]);
      if (rng.int(2) === 0) {
        return {
          prompt: `After ${E} epochs a model's training loss is $${num(tr)}$ and still falling, while its validation loss has climbed to $${num(va)}$. Which change is most likely to shrink that gap?`,
          answer: shuffled(rng, [
            { text: 'Train with random crops and flips of the training images', why: null },
            { text: 'Train for more epochs, until the training loss reaches 0', why: 'More epochs give the model more time to memorize: the gap grows.' },
            { text: 'Apply random crops and flips to the validation images', why: 'Changing the validation images changes the measurement, not the model.' },
            { text: 'Shuffle the validation split into a different order', why: 'The validation loss is an average over its examples: their order does not change it.' },
          ]),
          solution: [
            'A falling training loss with a rising validation loss is overfitting: the model is memorizing its training images.',
            'Random changes to the training images make exact memorization much harder, so the model has to learn what the images have in common.',
          ],
        };
      }
      return {
        prompt: `A model reaches a training loss of $${num(tr)}$ and a validation loss of $${num(va)}$ after ${E} epochs. It is trained again from scratch, the same way, but with random crops and flips of the training images. What most likely happens to the final training loss?`,
        answer: shuffled(rng, [
          { text: 'It ends a little higher, because varied images are harder to memorize', why: null },
          { text: 'It ends lower, because there are more distinct images to learn from', why: 'More variety makes the training images harder to fit exactly, so the training loss ends higher, not lower.' },
          { text: 'It ends the same, because every label stays the same', why: 'The labels stay, but the images change every time, so the model cannot fit them as closely.' },
          { text: 'It reaches 0 sooner, because each epoch shows new images', why: 'New variants every epoch make the training set harder to memorize, not easier.' },
        ]),
        solution: [
          'Each training image now looks a little different every time, so the model cannot memorize its quirks: the training loss ends somewhat higher.',
          'In exchange, the validation loss usually ends lower, and the gap between them shrinks.',
        ],
      };
    },
  },
];

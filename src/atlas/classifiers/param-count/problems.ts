import type { Generator } from '../../../mastery/domain/types';
import { big, int, pick } from '../../kit';

/** Image sizes whose flattened length is easy to work out: height, width, channels. */
const IMAGES: [number, number, number][] = [
  [32, 32, 3],
  [28, 28, 1],
  [16, 16, 3],
  [10, 10, 3],
  [20, 20, 1],
  [8, 8, 1],
  [32, 32, 1],
  [64, 64, 1],
];
const image = ([h, w, c]: [number, number, number]) => `$${h} \\times ${w}$ ${c === 3 ? 'color images' : 'grayscale images (1 number per pixel)'}`;

export const generators: Generator[] = [
  {
    id: 'linear',
    make(rng, d) {
      let D: number;
      let C: number;
      let img: [number, number, number] | null = null;
      if (d < 0.35) {
        D = int(rng, 2, 8);
        C = int(rng, 2, 5);
      } else if (d < 0.7) {
        D = pick(rng, [10, 20, 50, 100, 64, 784, 3072]);
        C = pick(rng, [2, 3, 5, 10]);
      } else {
        img = pick(rng, IMAGES);
        D = img[0] * img[1] * img[2];
        C = pick(rng, [2, 5, 10, 20, 100]);
      }
      const v = C * D + C;
      const traps = [
        { value: C * D, why: 'That counts the weights only. Every class also has a bias: add $\\symC$.' },
        { value: C * D + D, why: 'That gives one bias per input. Biases are added to the scores, so there is one per class: add $\\symC$, not $\\symD$.' },
        { value: 2 * C * D + C, why: 'That counts the weights twice. $\\symW$ is one $\\symC \\times \\symD$ matrix: $\\symC\\symD$ weights in all.' },
      ];
      if (img && img[2] === 3) traps.push({ value: C * img[0] * img[1] + C, why: 'That leaves out the color channels: each pixel is 3 numbers, so $\\symD$ is 3 times the pixel count.' });
      return {
        prompt: img
          ? `A linear classifier takes ${image(img)}, flattened into one vector, and scores $\\symC = ${C}$ classes. How many parameters does it have?`
          : `A linear classifier takes $\\symD = ${big(D)}$ input features and scores $\\symC = ${C}$ classes. How many parameters does it have?`,
        answer: { kind: 'number', value: v },
        traps: traps.filter((t) => t.value !== v),
        solution: [
          ...(img ? [`Flattened, one image is $\\symD = ${img.join(' \\times ')} = ${big(D)}$ numbers${img[2] === 3 ? ', 3 per pixel' : ''}.`] : []),
          'Its parameters are its weights and its biases.',
          `$\\symW$ has one row per class and one weight per input in each row: $${C} \\times ${big(D)} = ${big(C * D)}$ weights.`,
          `$\\symb$ has one bias per class: $${C}$ more.`,
          `Total: $\\symC\\symD + \\symC = ${big(C * D)} + ${C} = ${big(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'two-layer',
    make(rng, d) {
      let D: number;
      let H: number;
      let C: number;
      if (d < 0.35) [D, H, C] = [int(rng, 2, 5), int(rng, 2, 5), int(rng, 2, 3)];
      else if (d < 0.7) [D, H, C] = [int(rng, 4, 10), int(rng, 3, 10), int(rng, 2, 5)];
      else [D, H, C] = [pick(rng, [100, 784, 3072]), pick(rng, [10, 50, 100]), 10];
      const l1 = D * H + H;
      const l2 = H * C + C;
      const v = l1 + l2;
      const traps = [
        { value: D * H + H * C, why: 'That counts the weights only. Each map also has one bias per output: $H$ in the first, $\\symC$ in the second.' },
        { value: D * C + C, why: 'That is a single map from the inputs straight to the classes. Here the $H$ numbers in the middle come from a first map, with its own weights.' },
        { value: D * H * C, why: 'That multiplies all three sizes. Count each map on its own, inputs times outputs plus biases, then add the two.' },
      ];
      return {
        prompt: `Two linear maps run in a row: the first turns $\\symD = ${big(D)}$ inputs into $H = ${H}$ numbers, and the second turns those into $\\symC = ${C}$ class scores. How many parameters do they have in all?`,
        answer: { kind: 'number', value: v },
        traps: traps.filter((t, i) => t.value !== v && traps.findIndex((u) => u.value === t.value) === i),
        solution: [
          'Each map has its own weights and biases.',
          `The first map, $\\symD \\to H$: $${big(D)} \\times ${H} = ${big(D * H)}$ weights plus $${H}$ biases, $${big(l1)}$.`,
          `The second map, $H \\to \\symC$: $${H} \\times ${C} = ${big(H * C)}$ weights plus $${C}$ biases, $${big(l2)}$.`,
          `Add the two: $${big(l1)} + ${big(l2)} = ${big(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'shapes',
    make(rng, d) {
      const D = d < 0.35 ? int(rng, 2, 9) : pick(rng, [100, 784, 3072, 512]);
      const C = d < 0.35 ? int(rng, 2, 6) : pick(rng, [2, 10, 100, 1000]);
      if (d >= 0.6 && rng.int(2) === 0) {
        const H = pick(rng, [10, 50, 100, 200]);
        const which = rng.int(4);
        const name = ['\\symW_1', '\\symb_1', '\\symW_2', '\\symb_2'][which]!;
        const value = [[H, D], [H], [C, H], [C]][which]!;
        return {
          prompt: `Two linear maps run in a row: $h = \\symW_1\\symx + \\symb_1$ gives $H = ${H}$ numbers, then $\\syms = \\symW_2 h + \\symb_2$ scores them, from $\\symD = ${big(D)}$ inputs to $\\symC = ${C}$ classes. What is the shape of $${name}$?`,
          answer: { kind: 'shape', value },
          solution: [
            which < 2 ? `The first map turns $\\symD = ${big(D)}$ inputs into $H = ${H}$ outputs.` : `The second map turns the $H = ${H}$ numbers of $h$ into $\\symC = ${C}$ scores.`,
            which % 2 === 0
              ? `Its weights have one row per output and one column per input: $(${value.join(', ')})$.`
              : `Its biases are one per output: $(${value[0]},)$, which NumPy prints as \`(${value[0]},)\`.`,
          ],
        };
      }
      const isW = rng.int(2) === 0;
      return {
        prompt: `A linear classifier computes $\\syms = \\symW\\symx + \\symb$ for $\\symD = ${big(D)}$ inputs and $\\symC = ${C}$ classes. What is the shape of $${isW ? '\\symW' : '\\symb'}$?`,
        answer: { kind: 'shape', value: isW ? [C, D] : [C] },
        solution: isW
          ? [
              `$\\symW\\symx$ must give one score per class, so $\\symW$ has $\\symC = ${C}$ rows.`,
              `Each row is dotted with $\\symx$, so it has $\\symD = ${big(D)}$ columns: $(${C}, ${D})$. The transpose, $(${D}, ${C})$, would not line up with $\\symx$.`,
            ]
          : [
              `$\\symb$ is added to the scores, one bias per class.`,
              `So it is a vector of $\\symC = ${C}$ numbers: shape $(${C},)$.`,
            ],
      };
    },
  },
  {
    id: 'grows',
    make(rng) {
      const bases: { img: string; D: number; C: number; gray: boolean }[] = [
        { img: '$28 \\times 28$ grayscale', D: 784, C: 10, gray: true },
        { img: '$32 \\times 32$ grayscale', D: 1024, C: 5, gray: true },
        { img: '$16 \\times 16$ grayscale', D: 256, C: 4, gray: true },
        { img: '$32 \\times 32$ color', D: 3072, C: 10, gray: false },
        { img: '$32 \\times 32$ color', D: 3072, C: 100, gray: false },
        { img: '$16 \\times 16$ color', D: 768, C: 2, gray: false },
      ];
      const base = pick(rng, bases);
      const { D, C } = base;
      const n = C * D + C;
      const kinds = base.gray ? ['data', 'classes', 'color', 'side'] : ['data', 'classes', 'side'];
      const kind = pick(rng, kinds);
      const count = (c: number, dd: number) => `$${c} \\times ${big(dd)} + ${c} = ${big(c * dd + c)}$`;
      const cases: Record<string, { change: string; correct: number; why: (string | null)[]; solution: string[] }> = {
        data: {
          change: 'it scores twice as many images',
          correct: 0,
          why: [
            null,
            'Twice the images is not twice the parameters: $\\symW$ is still $\\symC \\times \\symD$ however many images it scores.',
            'The count is set by the input size and the number of classes, and neither changed.',
            'The images are inputs, not parameters: $\\symW$ and $\\symb$ keep their shapes however many there are.',
          ],
          solution: [
            'That depends on the input size and the number of classes only.',
            `More images mean more scores to compute, not more numbers in $\\symW$ and $\\symb$: still $${big(n)}$.`,
          ],
        },
        classes: {
          change: `it has to tell apart twice as many classes, $\\symC = ${2 * C}$`,
          correct: 1,
          why: [
            'Each new class brings its own row of $\\symW$ and its own bias, so the count grows.',
            null,
            'Only the number of rows doubles; each row keeps its $\\symD$ weights.',
            'The rows of $\\symW$ and the biases double, nothing else: twice, not four times.',
          ],
          solution: [
            'Each class owns one row of $\\symD$ weights and one bias.',
            `With $\\symC = ${2 * C}$: ${count(2 * C, D)}, exactly twice $${big(n)}$.`,
          ],
        },
        color: {
          change: 'it takes color images of the same size',
          correct: 2,
          why: [
            'Color triples $\\symD$, and every row of $\\symW$ gets that much longer.',
            'Each pixel brings 3 numbers in color, not 2, so $\\symD$ triples.',
            null,
            'Only $\\symD$ changes, and it triples; the number of classes stays the same.',
          ],
          solution: [
            `Color gives 3 numbers per pixel: $\\symD = 3 \\times ${big(D)} = ${big(3 * D)}$.`,
            `Then ${count(C, 3 * D)}: about 3 times $${big(n)}$, since only the $${C}$ biases do not triple.`,
          ],
        },
        side: {
          change: 'the images get twice as wide and twice as tall',
          correct: 3,
          why: [
            'Bigger images mean more inputs: $\\symD$ grows, and every row of $\\symW$ with it.',
            'Doubling the width and the height gives $2 \\times 2 = 4$ times the pixels, so $\\symD$ grows 4 times, not 2.',
            'Doubling both sides gives $2 \\times 2 = 4$ times the pixels, not 3 times.',
            null,
          ],
          solution: [
            `Twice the width and twice the height is 4 times the pixels: $\\symD = 4 \\times ${big(D)} = ${big(4 * D)}$.`,
            `Then ${count(C, 4 * D)}: about 4 times $${big(n)}$, since only the $${C}$ biases stay put.`,
          ],
        },
      };
      const k = cases[kind]!;
      return {
        prompt: `A linear classifier scores $\\symC = ${C}$ classes from ${base.img} images, $\\symD = ${big(D)}$ inputs. What happens to its parameter count if ${k.change}?`,
        answer: { kind: 'choice', options: ['It stays the same', 'It doubles', 'It roughly triples', 'It roughly quadruples'], correct: k.correct, why: k.why },
        solution: [`It has $\\symC\\symD + \\symC = ${count(C, D).slice(1, -1)}$ parameters.`, ...k.solution],
      };
    },
  },
];

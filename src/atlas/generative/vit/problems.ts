import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { pick } from '../../kit';
import { big, shp, shuffled, straps, traps } from '../kit';

interface Img {
  h: number;
  w: number;
  p: number;
}

/** An image and a patch size that divides it, larger and less square with difficulty. */
function image(rng: Rng, d: number): Img {
  if (d < 0.35) {
    const [side, p] = pick(rng, [[32, 8], [32, 16], [64, 16], [64, 8], [96, 32], [96, 16], [128, 32], [128, 16], [48, 16], [64, 32]] as const);
    return { h: side, w: side, p };
  }
  if (d < 0.7) {
    const [side, p] = pick(rng, [[224, 16], [224, 32], [224, 14], [256, 16], [256, 32], [384, 16], [384, 32], [160, 16], [192, 16]] as const);
    return { h: side, w: side, p };
  }
  const [h, w, p] = pick(rng, [[224, 320, 16], [160, 256, 16], [96, 128, 16], [384, 512, 32], [256, 384, 32], [128, 192, 16], [224, 448, 14], [192, 256, 32]] as const);
  return { h, w, p };
}

const sizeTex = (m: Img) => `${m.h} \\times ${m.w}`;
const count = (m: Img) => (m.h / m.p) * (m.w / m.p);

export const generators: Generator[] = [
  {
    id: 'patches',
    make(rng, d) {
      const m = image(rng, d);
      const rows = m.h / m.p;
      const cols = m.w / m.p;
      const v = rows * cols;
      const square = m.h === m.w;
      return {
        prompt: `A vision transformer cuts a $${sizeTex(m)}$ color image into non-overlapping $${m.p} \\times ${m.p}$ patches. How many patches does one image give?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: square ? rows : rows + cols, why: square ? `That is one row of patches. The patches tile the image in both directions: ${rows} across and ${rows} down.` : 'That adds the patches along each side. The patches tile a grid: multiply the two counts.' },
          { value: (m.h * m.w) / m.p, why: `That divides the pixel count by $P = ${m.p}$. Each patch covers $P \\times P = ${m.p * m.p}$ pixels, so divide by $P^2$.` },
          { value: v + 1, why: 'That counts the class token too. It is added later and is not cut from the image.' },
          { value: v * 3, why: 'That counts each color channel as its own patch. A patch keeps all three channels together.' },
        ]),
        solution: [
          square ? `Along each side: $${m.h} / ${m.p} = ${rows}$ patches.` : `Down: $${m.h} / ${m.p} = ${rows}$ patches. Across: $${m.w} / ${m.p} = ${cols}$.`,
          `They tile a grid: $${rows} \\times ${cols} = ${big(v)}$ patches.`,
          square ? `In one formula, $(H / P)^2 = (${m.h} / ${m.p})^2 = ${big(v)}$.` : `In one formula, $(H / P)(W / P) = ${big(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'shapes',
    make(rng, d) {
      const m = image(rng, d);
      const C = d < 0.5 ? 3 : pick(rng, [1, 3, 3]);
      const dm = d < 0.35 ? pick(rng, [32, 64, 96, 128]) : pick(rng, [192, 384, 512, 768]);
      const N = count(m);
      const len = m.p * m.p * C;
      const kind = C === 1 ? 'grayscale' : 'color';
      const seq = rng.next() < 0.5;
      if (!seq) {
        const v = [N, len];
        return {
          prompt: `A $${sizeTex(m)}$ ${kind} image${C === 1 ? ', one channel per pixel,' : ''} is cut into $${m.p} \\times ${m.p}$ patches, and each patch is flattened into one row of numbers. What is the shape of the matrix holding all of the image's flattened patches?`,
          answer: { kind: 'shape', value: v },
          traps: straps(v, [
            { value: [N, m.p * m.p], why: `That leaves out the channels. Each of the $${m.p * m.p}$ pixels brings $C = ${C}$ numbers.` },
            { value: [len, N], why: 'That is the transpose: one column per patch. Each patch is one row.' },
            { value: [N + 1, len], why: 'That adds a row for the class token. The class token is a learned vector added after the patch embedding, not a patch of pixels.' },
            { value: [N, m.p * C], why: `That uses $P \\cdot C$. A patch is $${m.p} \\times ${m.p}$ pixels: $P^2 C$ numbers.` },
          ]),
          solution: [
            `Patches: $(${m.h} / ${m.p}) \\times (${m.w} / ${m.p}) = ${big(N)}$, one row each.`,
            `One flattened patch holds $P^2 C = ${m.p} \\cdot ${m.p} \\cdot ${C} = ${big(len)}$ numbers.`,
            `So the matrix is $${shp(v)}$.`,
          ],
        };
      }
      const v = [N + 1, dm];
      return {
        prompt: `A vision transformer cuts a $${sizeTex(m)}$ ${kind} image into $${m.p} \\times ${m.p}$ patches. The patch embedding maps each flattened patch to a token of $d = ${dm}$ numbers, and a class token goes in front. What is the shape of the sequence the first transformer block reads?`,
        answer: { kind: 'shape', value: v },
        traps: straps(v, [
          { value: [N, dm], why: 'That leaves out the class token: one extra token in front of the patches.' },
          { value: [N + 1, len], why: `That is the width of a flattened patch, $${big(len)}$. The patch embedding maps each patch to $d = ${dm}$ numbers first.` },
          { value: [dm, N + 1], why: 'That is the transpose. The sequence has one row per token, each $d$ numbers wide.' },
          { value: [N + 2, dm], why: 'There is one class token, not two.' },
        ]),
        solution: [
          `Patches: $(${m.h} / ${m.p}) \\times (${m.w} / ${m.p}) = ${big(N)}$.`,
          `Each becomes a token of $d = ${dm}$ numbers, and the class token adds one more row: $${big(N)} + 1 = ${big(N + 1)}$.`,
          `So the sequence is $${shp(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'embed-params',
    make(rng, d) {
      const P = d < 0.35 ? pick(rng, [2, 4, 8]) : pick(rng, [8, 14, 16, 32]);
      const C = d < 0.6 ? 3 : pick(rng, [1, 3]);
      const dm = d < 0.35 ? pick(rng, [8, 10, 16, 20, 32]) : pick(rng, [64, 128, 192, 384, 768]);
      const side = P * pick(rng, [4, 7, 8, 14]);
      const N = (side / P) ** 2;
      const len = P * P * C;
      const v = len * dm + dm;
      const conv = rng.next() < 0.5;
      const how = conv
        ? `The patch embedding is the layer \`nn.Conv2d(${C}, ${dm}, kernel_size=${P}, stride=${P})\`.`
        : `The patch embedding maps each patch, of $C = ${C}$ channel${C > 1 ? 's' : ''}, to a token of $d = ${dm}$ numbers.`;
      return {
        prompt: `A vision transformer reads $${side} \\times ${side}$ images in $${P} \\times ${P}$ patches. ${how} How many parameters does the patch embedding learn, weights and biases together?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: len * dm, why: `That counts the weights only. Each of the ${conv ? `${dm} filters` : `$d = ${dm}$ outputs`} also has a bias.` },
          { value: N * v, why: `That gives each of the $${big(N)}$ patches its own weights. Every patch goes through the same embedding.` },
          { value: P * P * dm + dm, why: `That leaves out the channels: a patch holds $P^2 C = ${big(len)}$ numbers, not $${P * P}$.` },
          { value: P * C * dm + dm, why: `That uses $P$ where a patch has $P \\times P$ pixels: square it.` },
        ]),
        solution: [
          `One flattened patch holds $P^2 C = ${P} \\cdot ${P} \\cdot ${C} = ${big(len)}$ numbers.`,
          `${conv ? `Each of the ${dm} filters` : `Each of the $d = ${dm}$ outputs`} has one weight per number, plus a bias: $${big(len)} + 1 = ${big(len + 1)}$.`,
          `$${dm} \\times ${big(len + 1)} = ${big(v)}$. The image size and the number of patches do not enter: the same weights embed every patch.`,
        ],
      };
    },
  },
  {
    id: 'resize',
    make(rng, d) {
      const m = image(rng, Math.min(d, 0.69));
      const side = m.h;
      let change = pick(rng, ['halve', 'double', 'image'] as const);
      if (change === 'double' && side % (2 * m.p) !== 0) change = 'halve';
      const asks = change === 'image' ? pick(rng, ['tokens', 'length'] as const) : pick(rng, ['tokens', 'tokens', 'length'] as const);
      const P2 = change === 'halve' ? m.p / 2 : change === 'double' ? m.p * 2 : m.p;
      const side2 = change === 'image' ? side * 2 : side;
      const before = { n: (side / m.p) ** 2, len: m.p * m.p * 3 };
      const after = { n: (side2 / P2) ** 2, len: P2 * P2 * 3 };
      const what = asks === 'tokens' ? 'the number of patches' : 'the number of values in each flattened patch';
      const how = change === 'halve' ? `the patch size is halved to $${P2} \\times ${P2}$` : change === 'double' ? `the patch size is doubled to $${P2} \\times ${P2}$` : `the images grow to $${side2} \\times ${side2}$, with the same $${m.p} \\times ${m.p}$ patches`;
      const ratio = asks === 'tokens' ? after.n / before.n : after.len / before.len;
      const key = ratio === 4 ? 'x4' : ratio === 0.25 ? 'd4' : 'same';
      const reason =
        asks === 'tokens'
          ? change === 'halve'
            ? 'Smaller patches mean more of them'
            : change === 'double'
              ? 'Bigger patches mean fewer of them'
              : 'A bigger image holds more patches of the same size'
          : change === 'double'
            ? 'A bigger patch holds more numbers'
            : 'A smaller patch holds fewer numbers';
      const squared = 'Both sides of the square change, so the effect is squared';
      const fixed = `A patch's length depends only on the patch size and the channels, and the patch size has not changed. Growing the image adds patches instead: $${big(before.n)}$ become $${big(after.n)}$.`;
      const moved = `It changes: ${asks === 'tokens' ? `$(${side2} / ${P2})^2 = ${big(after.n)}$ patches, from $${big(before.n)}$` : `$${P2}^2 \\cdot 3 = ${big(after.len)}$ numbers, from $${big(before.len)}$`}.`;
      const why: Record<string, string | null> =
        key === 'x4'
          ? { x4: null, x2: `${squared}: the factor is 4, not 2.`, same: moved, d4: `That is backwards. ${reason}.`, d2: `That is backwards. ${reason}, and the effect is squared.` }
          : key === 'd4'
            ? { x4: `That is backwards. ${reason}.`, x2: `That is backwards. ${reason}, and the effect is squared.`, same: moved, d4: null, d2: `${squared}: the factor is a quarter, not a half.` }
            : { x4: fixed, x2: fixed, same: null, d4: fixed, d2: fixed };
      const opts = [
        { text: 'It is multiplied by 4', why: why.x4! },
        { text: 'It doubles', why: why.x2! },
        { text: 'It stays the same', why: why.same! },
        { text: 'It is divided by 4', why: why.d4! },
        { text: 'It halves', why: why.d2! },
      ];
      const right = opts.find((o) => o.why === null)!;
      const wrong = rng.shuffle(opts.filter((o) => o.why !== null)).slice(0, 3);
      return {
        prompt: `A vision transformer reads $${side} \\times ${side}$ color images in $${m.p} \\times ${m.p}$ patches. If ${how}, what happens to ${what}?`,
        answer: shuffled(rng, [right, ...wrong]),
        solution:
          asks === 'tokens'
            ? [
                `Before: $(${side} / ${m.p})^2 = ${big(before.n)}$ patches.`,
                `After: $(${side2} / ${P2})^2 = ${big(after.n)}$ patches.`,
                key === 'x4' ? 'Four times as many: the count along each side doubles, and the grid is square.' : 'A quarter as many: the count along each side halves, and the grid is square.',
              ]
            : [
                `Before: $P^2 C = ${m.p}^2 \\cdot 3 = ${big(before.len)}$ numbers per patch.`,
                `After: $${P2}^2 \\cdot 3 = ${big(after.len)}$.`,
                key === 'same' ? 'The same: a patch\'s length depends only on the patch size and the channels, not on the image.' : key === 'x4' ? 'Four times as many: both sides of the patch double.' : 'A quarter as many: both sides of the patch halve.',
              ],
      };
    },
  },
];

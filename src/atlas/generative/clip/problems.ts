import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, vec } from '../../kit';
import { big, bigText, dot, par, shp, shuffled, straps, traps } from '../kit';

const CLASSES = [
  ['dog', 'cat', 'car'],
  ['plane', 'bird', 'ship'],
  ['apple', 'banana', 'orange'],
  ['horse', 'deer', 'frog'],
  ['truck', 'bicycle', 'train'],
  ['chair', 'table', 'lamp'],
];

const photo = (nm: string) => `a photo of ${/^[aeiou]/.test(nm) ? 'an' : 'a'} ${nm}`;

/** An image embedding and one caption embedding per class, with a clear winner. */
function scene(rng: Rng, d: number): { z: number[]; t: number[][]; names: string[]; sc: number[] } {
  const names = rng.shuffle([...pick(rng, CLASSES)]).concat(d >= 0.6 ? [pick(rng, ['flower', 'house', 'kite'])] : []);
  const dim = d < 0.4 ? 2 : 3;
  const draw = () => (d < 0.4 ? int(rng, -2, 2) : int(rng, -9, 9) / 10);
  for (;;) {
    const z = Array.from({ length: dim }, draw);
    const t = names.map(() => Array.from({ length: dim }, draw));
    const sc = t.map((r) => dot(r, z));
    const sorted = [...sc].sort((a, b) => b - a);
    if (z.some((x) => x !== 0) && sorted[0]! - sorted[1]! >= (d < 0.4 ? 1 : 0.1)) return { z, t, names, sc };
  }
}

export const generators: Generator[] = [
  {
    id: 'negatives',
    make(rng, d) {
      const N = d < 0.35 ? pick(rng, [3, 4, 5, 8, 10]) : pick(rng, [16, 32, 64, 256, 1024, 32768]);
      const whole = d >= 0.35 && rng.next() < 0.5;
      const lead = `A batch holds $N = ${big(N)}$ image and caption pairs. Every image is compared with every caption, giving an $N \\times N$ similarity matrix.`;
      if (!whole)
        return {
          prompt: `${lead} Image ${int(rng, 0, Math.min(N, 10) - 1)}'s row compares it with all ${bigText(N)} captions. How many of them are negatives for it?`,
          answer: { kind: 'number', value: N - 1 },
          traps: traps(N - 1, [
            { value: N, why: 'That counts the image\'s own caption too. It is the one positive in the row.' },
            { value: N * N - N, why: 'That counts the negatives in the whole matrix. The question is about one row.' },
            { value: N - 2, why: 'Only one caption in the row is the image\'s own, so all the rest are negatives.' },
          ]),
          solution: [
            'The row has one entry per caption in the batch.',
            `One of them, on the diagonal, is the image's own caption. The other $${big(N)} - 1 = ${big(N - 1)}$ are negatives.`,
          ],
        };
      const v = N * (N - 1);
      return {
        prompt: `${lead} How many entries of the matrix pair an image with a caption that is not its own?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: N * N, why: 'That counts every entry, the diagonal too. The diagonal entries are the right pairs.' },
          { value: N - 1, why: 'That is one row. Every one of the rows has that many.' },
          { value: (N * (N - 1)) / 2, why: 'That counts each pair of images once. Entry $(i, j)$ and entry $(j, i)$ are different pairs: image $i$ with caption $j$, and image $j$ with caption $i$.' },
        ]),
        solution: [
          `The matrix has $N^2 = ${big(N * N)}$ entries.`,
          `The $${big(N)}$ on the diagonal are the right pairs. The rest are negatives: $${big(N * N)} - ${big(N)} = ${big(v)}$, or $N - 1$ in each of the $N$ rows.`,
        ],
      };
    },
  },
  {
    id: 'entry',
    make(rng) {
      const N = pick(rng, [3, 4, 5, 6, 8]);
      const i = int(rng, 0, N - 1);
      const same = rng.next() < 0.35;
      const j = same ? i : (i + int(rng, 1, N - 1)) % N;
      const opts = [
        { text: `Up: caption ${j} is the caption written for image ${i}`, why: same ? null : `Caption ${j} was written for image ${j}, not image ${i}. Only the diagonal entries are right pairs.` },
        { text: `Down: caption ${j} belongs to a different image`, why: same ? `On the diagonal, caption ${j} is image ${i}'s own: the loss pushes its similarity up.` : null },
        { text: 'Up, but only if it is already the largest in its row', why: same ? 'The right pair is pushed up whether or not it already leads its row: the pairing decides, not the current scores.' : 'The right pair is fixed by the data, not by the current scores. An entry off the diagonal is pushed down even when it is the largest.' },
        { text: 'Neither: the loss only looks at the diagonal', why: 'The softmax over each row uses every entry. The diagonal is pushed up and every other entry down.' },
      ];
      return {
        prompt: `A batch holds $${N}$ image and caption pairs, so the similarity matrix is $${N} \\times ${N}$, with rows for images and columns for captions, counting from 0. Entry $(${i}, ${j})$ compares image ${i} with caption ${j}. During training, which way does the loss push that similarity?`,
        answer: shuffled(rng, opts),
        solution: [
          'Pair $k$ of the batch is image $k$ with the caption written for it, so the right pairs sit on the diagonal, at $(k, k)$.',
          same ? `Entry $(${i}, ${i})$ is on the diagonal: a right pair, pushed up by the softmax over row ${i} and over column ${i}.` : `Entry $(${i}, ${j})$ is off the diagonal: a negative, pushed down so that image ${i} picks its own caption.`,
        ],
      };
    },
  },
  {
    id: 'zero-shot',
    make(rng, d) {
      const { z, t, names, sc } = scene(rng, d);
      const best = sc.indexOf(Math.max(...sc));
      const caps = names.map((nm, k) => `"${photo(nm)}" $\\to ${vec(t[k]!)}$`).join(', ');
      const work = (k: number) => `$${t[k]!.map((x, i) => `${par(x)} \\cdot ${par(z[i]!)}`).join(' + ')} = ${num(sc[k]!)}$`;
      return {
        prompt: `A trained CLIP embeds an image as $${vec(z)}$. The text encoder embeds one caption per class: ${caps}. Taking the similarity as the dot product, which class does zero-shot classification give the image?`,
        answer: shuffled(
          rng,
          names.map((nm, k) => ({
            text: `${nm[0]!.toUpperCase()}${nm.slice(1)}`,
            why: k === best ? null : `"${photo(nm)}" scores ${num(sc[k]!)}, below "${photo(names[best]!)}" at ${num(sc[best]!)}.`,
          })),
        ),
        solution: [
          ...names.map((nm, k) => `"${photo(nm)}": ${work(k)}.`),
          `The highest similarity is $${num(sc[best]!)}$: the image is classed as ${names[best]}. No image of any of these classes was needed to build this classifier.`,
        ],
      };
    },
  },
  {
    id: 'scores-shape',
    make(rng, d) {
      const dm = pick(rng, [64, 128, 256, 512, 768]);
      const zero = d >= 0.35 && rng.next() < 0.5;
      if (!zero) {
        const N = pick(rng, [8, 16, 32, 64, 256, 1024]);
        const v = [N, N];
        return {
          prompt: `A batch of $N = ${big(N)}$ images goes through CLIP's image encoder, giving a matrix $Z$ of shape $${shp([N, dm])}$, one unit-length row per image. Their $${big(N)}$ captions go through the text encoder, giving $T$ of shape $${shp([N, dm])}$. What is the shape of the similarity matrix $Z T^{\\top}$?`,
          answer: { kind: 'shape', value: v },
          traps: straps(v, [
            { value: [N, dm], why: 'That is the shape of one side\'s embeddings. The product compares every image with every caption.' },
            { value: [dm, dm], why: `That is $Z^{\\top} T$, which mixes the embedding dimensions. $Z T^{\\top}$ takes one dot product per image and caption.` },
          ]),
          solution: [
            `$Z$ is $${shp([N, dm])}$ and $T^{\\top}$ is $${shp([dm, N])}$: the inner sizes, $${dm}$, match.`,
            `The product is $${shp(v)}$: entry $(i, j)$ is the dot product of image $i$ with caption $j$.`,
          ],
        };
      }
      const M = pick(rng, [5, 10, 20, 50, 100]);
      const K = pick(rng, [3, 10, 100, 1000].filter((k) => k !== M));
      const v = [M, K];
      return {
        prompt: `To classify $${M}$ images into $${bigText(K)}$ classes, CLIP embeds the images as $Z$, shape $${shp([M, dm])}$, and one caption per class, "a photo of a ...", as $T$, shape $${shp([K, dm])}$. What is the shape of the score matrix $Z T^{\\top}$, images by classes?`,
        answer: { kind: 'shape', value: v },
        traps: straps(v, [
          { value: [K, M], why: 'That is the transpose, classes by images. $Z$ comes first, so its rows, the images, are the rows of the result.' },
          { value: [M, dm], why: 'That is the image embeddings. The product compares each image with each class caption.' },
          { value: [M, M], why: 'That would compare images with images. Here the columns are the class captions.' },
        ]),
        solution: [
          `$Z$ is $${shp([M, dm])}$ and $T^{\\top}$ is $${shp([dm, K])}$.`,
          `The product is $${shp(v)}$: one row per image, one score per class. Each image takes the class with the highest score in its row.`,
        ],
      };
    },
  },
];

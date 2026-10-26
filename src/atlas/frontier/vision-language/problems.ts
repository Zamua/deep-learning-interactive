import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { pick } from '../../kit';
import { big, bigText, shuffled, traps } from '../../generative/kit';

interface Img {
  h: number;
  w: number;
  p: number;
}

/** An image and a patch size that divides it: small squares, then real sizes, then rectangles. */
function image(rng: Rng, d: number): Img {
  if (d < 0.35) {
    const [side, p] = pick(rng, [[32, 8], [32, 16], [64, 16], [64, 8], [48, 16], [96, 32], [56, 14], [28, 14], [42, 14], [70, 14]] as const);
    return { h: side, w: side, p };
  }
  if (d < 0.7) {
    const [side, p] = pick(rng, [[224, 14], [336, 14], [448, 14], [224, 16], [384, 16], [512, 16], [256, 16], [392, 14], [280, 14]] as const);
    return { h: side, w: side, p };
  }
  const [h, w, p] = pick(rng, [[336, 672, 14], [224, 448, 14], [384, 512, 16], [336, 448, 14], [256, 384, 16], [448, 224, 14], [672, 336, 14], [224, 336, 14]] as const);
  return { h, w, p };
}

const sizeTex = (m: Img) => `${m.h} \\times ${m.w}`;
const count = (m: Img) => (m.h / m.p) * (m.w / m.p);

/** The count, with the steps a solution shows. */
function steps(m: Img): string[] {
  const rows = m.h / m.p;
  const cols = m.w / m.p;
  return m.h === m.w
    ? [`Along each side: $${m.h} / ${m.p} = ${rows}$ patches.`, `They tile a grid: $${rows} \\times ${rows} = ${big(rows * rows)}$ patches, one image token each.`]
    : [`Down: $${m.h} / ${m.p} = ${rows}$ patches. Across: $${m.w} / ${m.p} = ${cols}$.`, `They tile a grid: $${rows} \\times ${cols} = ${big(rows * cols)}$ patches, one image token each.`];
}

/** The usual wrong counts for an image, as traps around `shift` (what the right count feeds into). */
function countTraps(m: Img, f: (n: number) => number): { value: number; why: string }[] {
  const rows = m.h / m.p;
  const cols = m.w / m.p;
  const N = count(m);
  return [
    { value: f(m.h === m.w ? rows : rows + cols), why: m.h === m.w ? `That is one row of patches. The patches tile the image both ways: ${rows} across and ${rows} down.` : 'That adds the patches along each side. They tile a grid: multiply the two counts.' },
    { value: f(N + 1), why: 'That counts the class token too. Only the patch vectors become image tokens.' },
    { value: f((m.h * m.w) / m.p), why: `That divides the pixel count by ${m.p}. Each patch covers $${m.p} \\times ${m.p} = ${m.p * m.p}$ pixels.` },
  ];
}

export const generators: Generator[] = [
  {
    id: 'image-tokens',
    make(rng, d) {
      const m = image(rng, d);
      const v = count(m);
      return {
        prompt: `A vision-language model's vision transformer cuts a $${sizeTex(m)}$ image into $${m.p} \\times ${m.p}$ patches. How many image tokens go into the language model's prompt?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, countTraps(m, (n) => n)),
        solution: [...steps(m), 'The class token is left out: only the patch vectors are projected into the prompt.'],
      };
    },
  },
  {
    id: 'projection-params',
    make(rng, d) {
      let dv: number;
      let dm: number;
      for (;;) {
        dv = d < 0.35 ? pick(rng, [4, 8, 16]) : pick(rng, [256, 512, 768, 1024]);
        dm = d < 0.35 ? pick(rng, [16, 32, 64]) : pick(rng, [1024, 2048, 4096]);
        if (dv < dm) break;
      }
      const N = d < 0.35 ? pick(rng, [9, 16, 49, 64]) : pick(rng, [196, 256, 576]);
      const mlp = d >= 0.7 && rng.int(2) === 0;
      const first = dv * dm + dm;
      const v = mlp ? first + dm * dm + dm : first;
      const how = mlp
        ? `The projection is a two-layer MLP: a map from ${bigText(dv)} to ${bigText(dm)} numbers, an activation, then a map from ${bigText(dm)} to ${bigText(dm)}, each map with a bias.`
        : 'A linear projection, a weight matrix and a bias, maps each patch vector to the model\'s width.';
      const ts = [
        { value: mlp ? dv * dm + dm * dm : dv * dm, why: 'That counts the weights only. Every output number also has a bias.' },
        { value: N * v, why: `That gives each of the ${N} patches its own projection. Every patch goes through the same one.` },
        { value: mlp ? v - dm + dv : dv * dm + dv, why: `That gives ${mlp ? 'the first map' : 'the map'} one bias per input. A map has one bias per output.` },
      ];
      if (mlp) ts.push({ value: first, why: 'That is the first map alone. The second map, from the hidden width back to the model\'s width, has its own weights and biases.' });
      return {
        prompt: `A vision transformer hands back ${N} patch vectors of $${big(dv)}$ numbers each, and the language model's width is $d = ${big(dm)}$. ${how} How many parameters does the projection learn?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, ts),
        solution: mlp
          ? [
              `First map: ${bigText(dv)} inputs times ${bigText(dm)} outputs, plus ${bigText(dm)} biases: $${big(dv)} \\times ${big(dm)} + ${big(dm)} = ${big(first)}$.`,
              `Second map: $${big(dm)} \\times ${big(dm)} + ${big(dm)} = ${big(dm * dm + dm)}$.`,
              `Add them: $${big(first)} + ${big(dm * dm + dm)} = ${big(v)}$. The ${N} patches all share these.`,
            ]
          : [
              `The weight matrix maps ${bigText(dv)} inputs to ${bigText(dm)} outputs: $${big(dv)} \\times ${big(dm)} = ${big(dv * dm)}$ weights.`,
              `One bias per output: ${bigText(dm)} more, so $${big(dv * dm)} + ${big(dm)} = ${big(v)}$.`,
              `The ${N} patches all share this one projection, so the count does not depend on them.`,
            ],
      };
    },
  },
  {
    id: 'context-left',
    make(rng, d) {
      const m = image(rng, d);
      const N = count(m);
      const T = d < 0.35 ? pick(rng, [64, 100, 128, 200, 256].filter((t) => t > 2 * N)) : pick(rng, [1024, 2048, 4096].filter((t) => t > N + 200));
      const q = d >= 0.7 ? pick(rng, [12, 25, 37, 40, 64]) : 0;
      const v = T - N - q;
      const tail = q
        ? `goes in first, then a question of ${q} tokens. How many tokens are left for the answer?`
        : 'goes in first. How many tokens are left for text?';
      const ts = countTraps(m, (n) => T - n - q);
      ts.push({ value: N, why: 'That is the image tokens themselves. Subtract them from the most the model can read.' });
      if (q) ts.push({ value: T - N, why: `That leaves out the question: its ${q} tokens come out of the window too.` });
      return {
        prompt: `A vision-language model reads at most $T_{\\max} = ${big(T)}$ tokens. A $${sizeTex(m)}$ image in $${m.p} \\times ${m.p}$ patches ${tail}`,
        answer: { kind: 'number', value: v },
        traps: traps(v, ts.filter((t) => t.value > 0)),
        solution: [
          ...steps(m),
          q
            ? `The image and the question take $${big(N)} + ${q} = ${big(N + q)}$ of the $${big(T)}$: $${big(T)} - ${big(N + q)} = ${big(v)}$ are left.`
            : `They take $${big(N)}$ of the $${big(T)}$ positions: $${big(T)} - ${big(N)} = ${big(v)}$ are left.`,
        ],
      };
    },
  },
  {
    id: 'stage',
    make(rng, d) {
      const dm = pick(rng, [2048, 4096, 5120]);
      const dv = pick(rng, [768, 1024]);
      const two = d >= 0.35 && rng.int(2) === 0;
      const intro = `A vision-language model joins a trained vision transformer (patch vectors of ${bigText(dv)} numbers) to a trained language model (width ${bigText(dm)}) through a projection.`;
      if (!two) {
        const cap = pick(rng, ['a dog catching a frisbee on a beach', 'two cups of coffee on a wooden table', 'a red bus on a rainy street', 'a cat asleep on a stack of books', 'snow on a mountain at sunrise', 'a child flying a kite in a park']);
        return {
          prompt: `${intro} Stage one trains on images paired with captions, such as *${cap}*. Which parameters does stage one update?`,
          answer: shuffled(rng, [
            { text: 'Only the projection: the vision transformer and the language model stay frozen', why: null },
            { text: 'Only the language model, so it learns to read the patch vectors as they are', why: 'The language model stays frozen in stage one. The projection does the translating, so the language model keeps everything it knows.' },
            { text: 'Only the vision transformer, so its patch vectors come out in the model\'s width', why: 'The vision transformer is already trained and stays frozen. The projection maps its vectors to the model\'s width.' },
            { text: 'All three at once, end to end', why: 'Stage one trains only the small projection, with both large models frozen. The language model trains later, in stage two.' },
          ]),
          solution: [
            'In stage one both large models are frozen: their weights do not change.',
            'The language model predicts each caption from the image tokens, and only the projection can move to make that loss smaller.',
            'So the projection learns to turn patch vectors into vectors the language model already reads as meaning.',
          ],
        };
      }
      const task = pick(rng, ['What is the man holding?', 'How many birds are on the wire?', 'What color is the car?', 'Is it raining?', 'What is written on the sign?', 'Where is the cat sitting?']);
      return {
        prompt: `${intro} Stage two trains on instructions: an image, a question such as *${task}*, and a good answer. Which parameters does stage two update?`,
        answer: shuffled(rng, [
          { text: 'The projection and the language model; the vision transformer stays frozen', why: null },
          { text: 'Only the projection, as in stage one', why: 'Stage two unfreezes the language model too, so it learns to answer questions about the image tokens.' },
          { text: 'All three, the vision transformer included', why: 'The vision transformer stays frozen in both stages.' },
          { text: 'Only the language model; the projection is fixed after stage one', why: 'The projection keeps training in stage two, alongside the language model.' },
        ]),
        solution: [
          'Stage one trained the projection alone, on captions.',
          'Stage two trains the projection and the language model together, on questions and answers about images.',
          'The vision transformer stays frozen throughout.',
        ],
      };
    },
  },
];

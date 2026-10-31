import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { dot, int, nonzero, num, pick, prods, traps, vec } from '../../kit';
import { whys } from '../../training/kit';

const PROPS = ['is this token part of a name', 'is the sentence in the past tense', 'is this token inside a quote', 'is the number even', 'is the text in French', 'is this word a noun'];
const TENSES = ['past', 'present', 'future'];

const ints = (rng: Rng, n: number, lo: number, hi: number) => Array.from({ length: n }, () => int(rng, lo, hi));

export const generators: Generator[] = [
  {
    id: 'score',
    make(rng, d) {
      const n = d < 0.4 ? 2 : 3;
      const h = ints(rng, n, d < 0.4 ? 0 : -2, 3);
      const w = Array.from({ length: n }, () => nonzero(rng, -2, 3));
      const b = d < 0.6 ? nonzero(rng, -3, 3) : pick(rng, [-1.5, -0.5, 0.5, 1.5, 2.5]);
      const prop = pick(rng, PROPS);
      const wh = dot(w, h);
      const ans = wh + b;
      return {
        prompt: `A linear probe for "${prop}?" reads a token's residual stream $\\symh = ${vec(h)}$ with weights $\\symw = ${vec(w)}$ and bias $\\symb = ${num(b)}$. What is its score?`,
        answer: { kind: 'number', value: ans },
        traps: traps(ans, [
          { value: wh, why: 'That leaves out the bias. The score is $\\symw \\cdot \\symh + \\symb$.' },
          { value: wh - b, why: 'That subtracts the bias. It is added.' },
          { value: h.reduce((a, x) => a + x, 0) + w.reduce((a, x) => a + x, 0) + b, why: 'That adds every entry. The dot product multiplies matching entries first.' },
        ]),
        solution: [
          `The score is $\\symw \\cdot \\symh + \\symb$, and $\\symw \\cdot \\symh = ${prods(w, h)} = ${wh}$.`,
          `Add the bias: $${wh} ${b < 0 ? '-' : '+'} ${num(Math.abs(b))} = ${num(ans)}$.`,
          ans > 0 ? 'Positive: the probe says yes.' : ans < 0 ? 'Negative: the probe says no.' : 'Exactly 0: right on the probe\'s boundary.',
        ],
      };
    },
  },
  {
    id: 'class',
    make(rng, d) {
      const n = d < 0.5 ? 2 : 3;
      for (;;) {
        const h = ints(rng, n, -1, 3);
        const W = TENSES.map(() => ints(rng, n, -2, 2));
        const b = TENSES.map(() => (d < 0.3 ? 0 : int(rng, -2, 2)));
        const s = W.map((r, c) => dot(r, h) + b[c]!);
        const m = Math.max(...s);
        if (s.filter((v) => v === m).length > 1) continue;
        const k = s.indexOf(m);
        const lo = s.indexOf(Math.min(...s));
        const noBias = W.map((r) => dot(r, h));
        const kb = noBias.indexOf(Math.max(...noBias));
        const biasTop = b.indexOf(Math.max(...b));
        const ts = [{ value: lo, why: 'That is the class with the lowest score. The probe predicts the highest.' }];
        if (d >= 0.3 && noBias.filter((v) => v === noBias[kb]).length === 1) ts.push({ value: kb, why: 'That ignores the biases. Add each class\'s bias to its dot product before comparing.' });
        if (d >= 0.3 && b.filter((v) => v === b[biasTop]).length === 1) ts.push({ value: biasTop, why: 'That is the class with the largest bias alone. The dot product with $\\symh$ counts too.' });
        return {
          prompt: `A three-class probe reads a token's stream $\\symh = ${vec(h)}$ to decode the sentence's tense: class 0 past, 1 present, 2 future. Its weight rows are ${W.map((r, c) => `$\\symw_{${c}} = ${vec(r)}$`).join(', ')}${d < 0.3 ? ', with no biases' : `, and its biases are $\\symb = ${vec(b)}$`}. Which class does it predict?`,
          answer: { kind: 'number', value: k },
          traps: traps(k, ts),
          solution: [
            `Score each class $c$ as $\\symw_c \\cdot \\symh${d < 0.3 ? '' : ' + \\symb_c'}$.`,
            ...W.map((r, c) => `Class ${c}, ${TENSES[c]}: $${prods(r, h)}${d < 0.3 ? '' : ` ${b[c]! < 0 ? '-' : '+'} ${Math.abs(b[c]!)}`} = ${s[c]}$.`),
            `The largest score is $${m}$: class ${k}, ${TENSES[k]}.`,
          ],
        };
      }
    },
  },
  {
    id: 'accuracy',
    make(rng, d) {
      const N = d < 0.35 ? 4 : d < 0.7 ? 8 : 10;
      for (;;) {
        const labels = rng.shuffle(Array.from({ length: N }, (_, i) => (i < N / 2 ? 1 : 0)));
        const scores = labels.map((y) => {
          const size = pick(rng, [0.3, 0.6, 1.1, 1.8, 2.5]);
          const hit = rng.next() < 0.7;
          return (y === 1) === hit ? size : -size;
        });
        const right = scores.filter((s, i) => (s > 0 ? 1 : 0) === labels[i]).length;
        if (right === N || right === 0 || right * 2 === N) continue;
        const ans = right / N;
        const yes = scores.filter((s) => s > 0).length / N;
        const rows = scores.map((s, i) => `${i} & ${num(s)} & ${labels[i]}`).join(' \\\\ ');
        return {
          prompt: `A probe predicts class 1 when its score is above 0, and class 0 otherwise. Here are its scores on ${N} held-out tokens, with their true classes. What is its accuracy? Round to two decimals.\n\n$$\\begin{array}{c|c|c} \\text{token} & \\text{score} & \\text{true class} \\\\ \\hline ${rows} \\end{array}$$`,
          answer: { kind: 'number', value: ans, places: 2 },
          traps: traps(ans, [
            { value: 1 - ans, why: 'That is the share it gets wrong. Accuracy counts the ones it gets right.' },
            { value: yes, why: 'That is how often the probe says class 1, not how often it is right.' },
            { value: right, why: `That is the number it gets right. Divide by the ${N} tokens.` },
          ], 2),
          solution: [
            `Predictions: ${scores.map((s) => (s > 0 ? 1 : 0)).join(', ')}. True classes: ${labels.join(', ')}.`,
            `They match on ${right} of the ${N} tokens.`,
            `Accuracy: $${right} / ${N} = ${num(ans)}${Math.abs(ans * 100 - Math.round(ans * 100)) > 1e-9 ? ` \\approx ${num(Math.round(ans * 100) / 100, 2)}` : ''}$.`,
          ],
        };
      }
    },
  },
  {
    id: 'meaning',
    make(rng) {
      const prop = pick(rng, PROPS);
      const blk = int(rng, 2, 20);
      const kind = rng.int(3);
      if (kind === 0) {
        const acc = pick(rng, [91, 94, 96, 98]);
        const options = [
          `The stream at block ${blk} holds the answer in a form one linear map can read`,
          `The model uses this property to make its predictions`,
          `One neuron at block ${blk} computes the property`,
          'The model was trained to predict this property',
        ];
        const reasons = [
          '',
          'Present is not the same as used. To test use, change the activation along the probe\'s direction and see whether the output changes.',
          'The probe weighs every dimension of the stream: it finds a direction, not a single neuron.',
          'The model was trained only on its own task. The probe was trained afterward, on frozen activations.',
        ];
        return {
          prompt: `A linear probe for "${prop}?" on block ${blk}'s residual stream gets ${acc}% accuracy on held-out tokens, where always guessing the more common answer gets 50%. What does that show?`,
          answer: { kind: 'choice', options, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
          solution: [
            'A linear classifier on frozen activations succeeds only if the property is written along some direction of the stream.',
            'That says the information is there, readable by one matrix. Whether the model relies on it takes an intervention to show.',
          ],
        };
      }
      if (kind === 1) {
        const lin = pick(rng, [52, 55, 58]);
        const mlp = pick(rng, [88, 92, 95]);
        const options = [
          'It is not linearly readable there; the large probe may be computing it itself',
          'It is linearly readable, and the linear probe was just trained too little',
          'The model must rely on this property heavily',
          'The stream holds no information about it at all',
        ];
        const reasons = [
          '',
          'A linear probe is quick and reliable to fit; near-chance accuracy means no direction separates the classes well.',
          'Neither probe says anything about use: that needs an intervention on the model.',
          `The large probe decodes it at ${mlp}%, so something about it is there, just not along one direction.`,
        ];
        return {
          prompt: `On block ${blk}'s stream, a linear probe for "${prop}?" gets ${lin}% (two balanced classes), while a large MLP probe gets ${mlp}%. What is the best reading?`,
          answer: { kind: 'choice', options, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
          solution: [
            'Near 50% with two balanced classes is close to chance: no single direction separates them.',
            'A powerful probe can compute a property from scraps, so its success says as much about the probe as about the stream. That is why probes are kept linear.',
          ],
        };
      }
      const options = [
        'A powerful probe could compute the property itself, saying more about the probe than the stream',
        'Linear probes always reach higher accuracy than larger ones',
        'The model\'s blocks are linear, so only a linear probe fits them',
        'Larger probes cannot be trained on frozen activations',
      ];
      const reasons = [
        '',
        'They often reach lower accuracy. The point is what their success means, not that it is higher.',
        'The blocks are not linear: attention and the MLP bend their inputs. Linearity is chosen for the probe, not inherited from the model.',
        'Any classifier can be trained on frozen activations; larger ones simply prove less.',
      ];
      return {
        prompt: `To test whether block ${blk}'s stream encodes "${prop}?", why use a linear probe rather than a large neural network?`,
        answer: { kind: 'choice', options, correct: 0, why: whys(4, 0, (i) => reasons[i]!) },
        solution: [
          'A linear probe succeeds only if the property lies along a direction of the stream, something a single later matrix could read.',
          'A large probe can do its own computation, so its accuracy no longer tells you what the stream itself holds.',
        ],
      };
    },
  },
];

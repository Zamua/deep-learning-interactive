import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, num, pick, round } from '../../kit';
import { fx, lossLog, texTable, traps, whys } from '../kit';

type Shape = 'slow' | 'good' | 'plateau' | 'explode' | 'noisy';

/** Chance-level starting losses: ln 10, ln 5, ln 3, ln 100. */
const START = [2.3, 1.61, 1.1, 4.61];

/** A logged training loss of the given shape, two decimals, starting at `L0`. */
function curve(rng: Rng, shape: Shape, L0: number, n: number): string[] {
  const out: number[] = [L0];
  const floor = round(L0 * (0.45 + 0.15 * rng.next()), 2);
  for (let i = 1; i < n; i++) {
    const prev = out[i - 1]!;
    if (shape === 'slow') out.push(round(prev - L0 * (0.006 + 0.006 * rng.next()), 2));
    else if (shape === 'good') out.push(round(prev - (prev - L0 * 0.12) * (i === 1 ? 0.45 : 0.25 + 0.1 * rng.next()), 2));
    else if (shape === 'plateau') out.push(i === 1 ? floor + round(0.08 * L0, 2) : round(floor + (rng.next() - 0.5) * 0.04, 2));
    else if (shape === 'explode') out.push(round(prev * (1.6 + 1.6 * rng.next()) + 0.2, 2));
    else {
      const trend = L0 - (L0 - L0 * 0.4) * (i / (n - 1));
      out.push(round(trend + (i % 2 ? 1 : -1) * L0 * (0.07 + 0.05 * rng.next()), 2));
    }
  }
  const s = out.map((v) => v.toFixed(2));
  if (shape === 'explode') s[n - 1] = '\\text{nan}';
  return s;
}

const CAUSES = ['The learning rate is too high', 'The learning rate is too low', 'The batch size is too small', 'The model is overfitting'];
const CAUSE_OF: Record<Shape | 'overfit', number> = { explode: 0, plateau: 0, slow: 1, noisy: 2, overfit: 3, good: -1 };
const LOOK: Record<Shape | 'overfit', string> = {
  explode: 'The loss grows every step, on its way to `nan`: each step overshoots by more than the last.',
  plateau: 'The loss drops fast, then sits at a high level: the steps are too big to settle into the low part of the valley.',
  slow: 'The loss falls by about the same small amount every step, almost a straight line: the steps are too small.',
  noisy: 'The loss trends down but jumps up and down from one reading to the next: each gradient comes from too few examples.',
  overfit: 'Training loss keeps falling while validation loss turns up: the model is memorizing its training examples.',
  good: '',
};

export const generators: Generator[] = [
  {
    id: 'cause',
    make(rng, d) {
      const shape = pick(rng, ['explode', 'plateau', 'slow', 'noisy', 'overfit'] as const);
      const L0 = d < 0.4 ? 2.3 : pick(rng, START);
      const n = d < 0.5 ? 6 : 8;
      let shown: string;
      if (shape === 'overfit') {
        const R = lossLog(rng, d);
        shown = `Training and validation loss, every ${R.every === 1 ? 'epoch' : `${R.every} epochs`}:\n\n$$${texTable(['\\text{epoch}', '\\text{train}', '\\text{val}'], R.train.map((t, i) => [R.epoch(i), fx(t, 2), fx(R.val[i]!, 2)]))}$$`;
      } else {
        const every = pick(rng, [50, 100, 200, 500]);
        shown = `The training loss, logged every ${every} steps:\n\n$${curve(rng, shape, L0, shape === 'noisy' ? 8 : n).join(',\\ ')}$`;
      }
      const correct = CAUSE_OF[shape];
      const wrong: Record<number, string> = {
        0: 'A rate too high shows as a loss that blows up, or drops and then stalls high.',
        1: 'A rate too low shows as a slow, almost straight-line fall.',
        2: 'A small batch shows as a noisy curve that still trends down.',
        3: 'Overfitting needs a validation curve that turns up while training keeps falling.',
      };
      return {
        prompt: `${shown}\n\nWhat is the most likely problem?`,
        answer: { kind: 'choice', options: CAUSES, correct, why: whys(4, correct, (i) => `${wrong[i]} ${LOOK[shape]}`) },
        solution: [LOOK[shape], `So: ${CAUSES[correct]!.toLowerCase()}.`],
      };
    },
  },
  {
    id: 'fix',
    make(rng) {
      const L0 = pick(rng, START);
      const k = pick(rng, [100, 200, 300, 500]);
      const cases: { text: string; fix: number }[] = [
        { text: `Training starts at a loss of $${num(L0)}$. After ${k} steps the loss prints \`nan\`.`, fix: 0 },
        { text: `Training starts at a loss of $${num(L0)}$. Within ${k} steps it has climbed to $${num(round(L0 * pick(rng, [3, 5, 8]) + 0.37, 2))}$, and it grows every step.`, fix: 0 },
        { text: `After ${int(rng, 3, 8)} epochs the loss has gone from $${num(L0)}$ to only $${num(round(L0 * pick(rng, [0.93, 0.95, 0.97]), 2))}$, falling by the same tiny amount every epoch.`, fix: 1 },
        { text: `Training loss has reached $${num(pick(rng, [0.03, 0.05, 0.08]))}$ and is still falling, but validation loss has climbed from $${num(pick(rng, [0.8, 0.9, 1.1]))}$ to $${num(pick(rng, [1.4, 1.6, 1.9]))}$ over the last ${int(rng, 5, 15)} epochs.`, fix: 3 },
      ];
      const c = pick(rng, cases);
      const opts = ['Lower the learning rate', 'Raise the learning rate', 'Use a bigger batch', 'Keep the weights from the best validation epoch'];
      const reasons: Record<number, string[]> = {
        0: ['', 'A higher rate makes each step overshoot by even more.', 'A bigger batch makes each gradient less noisy, but the steps would still overshoot: a loss that grows every step means they are too big.', 'Stopping early is for a gap between training and validation. Here the training loss itself is blowing up.'],
        1: ['A lower rate would crawl even more slowly.', '', 'A bigger batch steadies each gradient but does not lengthen the steps. The fall is already smooth: the steps are too small.', 'Nothing is overfitting yet: the training loss is still high and falling.'],
        3: ['The training loss is falling fine; the problem is the gap to validation.', 'Training already fits well; bigger steps do not close the gap to validation.', 'A bigger batch changes how noisy each step is, not what the model memorizes: the gap stays.', ''],
      };
      const sol: Record<number, string> = {
        0: 'The rate is too high: lower it, often by a factor of 3 to 10.',
        1: 'The rate is too low: raise it, often by a factor of 3 to 10.',
        3: 'The model is overfitting: keep the weights from the epoch where validation loss was lowest, and stop training there.',
      };
      return {
        prompt: `${c.text} What should you change first?`,
        answer: { kind: 'choice', options: opts, correct: c.fix, why: whys(4, c.fix, (i) => reasons[c.fix]![i]!) },
        solution: [c.fix === 0 ? LOOK.explode : c.fix === 1 ? LOOK.slow : LOOK.overfit, sol[c.fix]!],
      };
    },
  },
  {
    id: 'best-epoch',
    make(rng, d) {
      const R = lossLog(rng, d);
      const v = R.epoch(R.best);
      const list = (xs: number[]) => xs.map((x) => fx(x, 2)).join(',\\ ');
      return {
        prompt: `Losses logged at epochs ${R.train.map((_, i) => R.epoch(i)).join(', ')}:\n\ntraining: $${list(R.train)}$\n\nvalidation: $${list(R.val)}$\n\nAt which epoch did the validation loss bottom out?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: R.epoch(R.n - 1), why: 'That is where the training loss is lowest. It keeps falling while the model memorizes; read the validation losses.' },
          { value: R.best + 1, why: `That counts readings, not epochs. Reading ${R.best + 1} was taken at epoch ${v}.` },
          { value: R.best, why: `That counts the readings from 0. The readings are at epochs ${R.epoch(0)}, ${R.epoch(1)}, and so on, so the lowest is at epoch ${v}.` },
        ].filter((t) => t.value > 0)),
        solution: [
          `The lowest validation loss is $${fx(R.val[R.best]!, 2)}$, reading ${R.best + 1} of ${R.n}.`,
          `The readings are every ${R.every === 1 ? 'epoch' : `${R.every} epochs`}, so that is epoch ${v}.`,
          'After it, validation climbs while training keeps falling: overfitting. The weights to keep are from that epoch.',
        ],
      };
    },
  },
  {
    id: 'rank',
    make(rng, d) {
      const shapes: Shape[] = d < 0.5 ? ['slow', 'good', 'explode'] : ['slow', 'good', 'plateau', 'explode'];
      const labels = rng.shuffle(['A', 'B', 'C', 'D'].slice(0, shapes.length));
      const L0 = pick(rng, START);
      const n = 5;
      const lines = shapes.map((sh, i) => ({ label: labels[i]!, text: curve(rng, sh, L0, n).join(',\\ ') }));
      const listed = [...lines].sort((a, b) => a.label.localeCompare(b.label));
      return {
        prompt: `${shapes.length === 3 ? 'Three' : 'Four'} runs train the same model, differing only in the learning rate. Their losses:\n\n${listed.map((l) => `Run ${l.label}: $${l.text}$`).join('\n\n')}\n\nOrder the runs from the lowest learning rate to the highest.`,
        answer: { kind: 'order', items: lines.map((l) => `Run ${l.label}`) },
        solution: [
          `Run ${lines[0]!.label} falls slowly in a near straight line: the lowest rate.`,
          `Run ${lines[1]!.label} drops fast and keeps going lower: a good rate.`,
          ...(shapes.length === 4 ? [`Run ${lines[2]!.label} drops fast, then stalls high: too high to settle.`] : []),
          `Run ${lines[shapes.length - 1]!.label} blows up to \`nan\`: the highest rate.`,
        ],
      };
    },
  },
];

import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { num, pick, round } from '../../kit';
import { big, choose, straps, traps } from '../kit';

const B = '\\sym{B}{B}';
const A = '\\sym{A}{A}';
const r = '\\sym{r}{r}';

/** A weight matrix's shape (d, k) and a rank, from round sizes to real ones as difficulty grows. */
function setup(rng: Rng, d: number): { dd: number; k: number; rank: number } {
  if (d < 0.35) {
    const n = pick(rng, [100, 200, 500, 1000]);
    return { dd: n, k: n, rank: pick(rng, [1, 2, 4, 5]) };
  }
  if (d < 0.7) {
    const [dd, k] = pick(rng, [[512, 512], [1000, 1000], [1000, 4000], [4000, 1000], [2000, 500], [1024, 1024], [256, 1024]] as const);
    return { dd, k, rank: pick(rng, [2, 4, 8]) };
  }
  const [dd, k] = pick(rng, [[768, 768], [768, 3072], [3072, 768], [4096, 4096], [4096, 11008], [1024, 4096], [2048, 2048]] as const);
  return { dd, k, rank: pick(rng, [8, 16, 32, 64]) };
}

const shapeOf = (dd: number, k: number) => `$(d, k) = (${big(dd)}, ${big(k)})$`;

export const generators: Generator[] = [
  {
    id: 'params',
    make(rng, d) {
      const { dd, k, rank } = setup(rng, d);
      const v = rank * (dd + k);
      return {
        prompt: `LoRA adapts a pretrained weight matrix $\\symW$ of shape ${shapeOf(dd, k)} at rank $${r} = ${rank}$. How many numbers does it train for this layer?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: dd * k, why: `That is every entry of $\\symW$: what full fine-tuning trains. LoRA trains only $${B}$ and $${A}$.` },
          { value: rank * dd * k, why: `That multiplies all three sizes. $${B}$ has $d \\times ${r}$ entries and $${A}$ has $${r} \\times k$: add them.` },
          { value: rank * dd, why: `That counts $${B}$ alone. $${A}$, of shape $(${r}, k)$, is trained too.` },
          { value: rank * k, why: `That counts $${A}$ alone. $${B}$, of shape $(d, ${r})$, is trained too.` },
          { value: dd + k, why: `That leaves out the rank. Each of $${B}$'s $d$ rows and $${A}$'s $k$ columns holds $${r} = ${rank}$ numbers.` },
        ]),
        solution: [
          `$${B}$ takes $\\symW$'s rows and $${r}$ columns: $(d, ${r}) = (${big(dd)}, ${rank})$, so $${big(dd)} \\times ${rank} = ${big(dd * rank)}$ numbers.`,
          `$${A}$ takes $${r}$ rows and $\\symW$'s columns: $(${r}, k) = (${rank}, ${big(k)})$, so $${rank} \\times ${big(k)} = ${big(rank * k)}$ numbers.`,
          `Together: $${big(dd * rank)} + ${big(rank * k)} = ${big(v)}$, which is $${r}(d + k) = ${rank} \\times ${big(dd + k)}$.`,
          `Full fine-tuning would train all $d \\times k = ${big(dd * k)}$ entries of $\\symW$.`,
        ],
      };
    },
  },
  {
    id: 'fraction',
    make(rng, d) {
      const { dd, k, rank } = setup(rng, d);
      const lora = rank * (dd + k);
      const v = (100 * lora) / (dd * k);
      return {
        prompt: `LoRA at rank $${r} = ${rank}$ adapts a weight matrix $\\symW$ of shape ${shapeOf(dd, k)}. Its $${B}$ and $${A}$ hold what percent as many numbers as $\\symW$? Round to two decimals.`,
        answer: { kind: 'number', value: v, places: 2 },
        traps: traps(
          v,
          [
            { value: lora / (dd * k), why: `That is the fraction, not the percent. Multiply by 100.` },
            { value: (100 * rank * dd) / (dd * k), why: `That counts only $${B}$. $${A}$ adds $${r} \\times k$ more.` },
            { value: (100 * rank) / Math.min(dd, k), why: `That is $${r}$ over one side of $\\symW$. The adapter holds $${r}(d + k)$ numbers against $d \\times k$.` },
          ],
          2,
        ),
        solution: [
          `$${B}$ is $(${big(dd)}, ${rank})$: $${big(dd * rank)}$ numbers. $${A}$ is $(${rank}, ${big(k)})$: $${big(rank * k)}$ numbers.`,
          `LoRA trains $${big(dd * rank)} + ${big(rank * k)} = ${big(lora)}$ numbers: $${r}(d + k) = ${rank} \\times ${big(dd + k)}$.`,
          `$\\symW$ holds $d \\times k = ${big(dd)} \\times ${big(k)} = ${big(dd * k)}$.`,
          `As a fraction: $${big(lora)} / ${big(dd * k)} \\approx ${num(round(lora / (dd * k), 6))}$.`,
          `Times 100 for a percent: about $${num(v, 2)}$ percent.`,
        ],
      };
    },
  },
  {
    id: 'shape',
    make(rng, d) {
      const { dd, k, rank } = setup(rng, Math.max(0.35, d));
      const which = rng.int(4);
      const name = [B, A, `${B}${A}`, `\\symW + ${B}${A}`][which]!;
      const v = [[dd, rank], [rank, k], [dd, k], [dd, k]][which]!;
      const ts: { value: number[]; why: string }[] =
        which === 0
          ? [
              { value: [rank, dd], why: `That is $${B}$ transposed. $${B}$ turns $${r}$ numbers into $d$ outputs, so it has $d$ rows and $${r}$ columns.` },
              { value: [k, rank], why: `$${B}$'s rows match $\\symW$'s rows, $d$, since $${B}${A}$ must have $\\symW$'s shape.` },
              { value: [dd, k], why: `That is $\\symW$'s shape. $${B}$ is thin: $d$ rows but only $${r}$ columns.` },
            ]
          : which === 1
            ? [
                { value: [k, rank], why: `That is $${A}$ transposed. $${A}$ squeezes the $k$ inputs down to $${r}$ numbers, so it has $${r}$ rows and $k$ columns.` },
                { value: [rank, dd], why: `$${A}$'s columns match $\\symW$'s columns, $k$, since $${B}${A}$ must have $\\symW$'s shape.` },
                { value: [dd, k], why: `That is $\\symW$'s shape. $${A}$ is thin: $k$ columns but only $${r}$ rows.` },
              ]
            : [
                { value: [rank, rank], why: `That is $${A}${B}$, the product the other way round. $(d, ${r})$ times $(${r}, k)$ gives $(d, k)$.` },
                { value: [dd, rank], why: `That is $${B}$'s shape. Multiplying by $${A}$, $(${r}, k)$, makes the columns $k$.` },
                { value: [k, dd], why: `That is $\\symW$ transposed. The product keeps $${B}$'s rows and $${A}$'s columns: $(d, k)$.` },
              ];
      return {
        prompt: `LoRA adapts a weight matrix $\\symW$ of shape ${shapeOf(dd, k)} at rank $${r} = ${rank}$. What is the shape of $${name}$?`,
        answer: { kind: 'shape', value: v },
        traps: straps(v, ts),
        solution: [
          `$${B}$ is $(d, ${r}) = (${big(dd)}, ${rank})$ and $${A}$ is $(${r}, k) = (${rank}, ${big(k)})$.`,
          `$${B}${A}$ is $(d, ${r})$ times $(${r}, k)$: the inner $${r}$s match and the product is $(d, k) = (${big(dd)}, ${big(k)})$, exactly $\\symW$'s shape${which === 3 ? ', so the two can be added' : ''}.`,
          `So $${name}$ is $(${v.map(big).join(', ')})$.`,
        ],
      };
    },
  },
  {
    id: 'init',
    make(rng, d) {
      const { dd, k, rank } = setup(rng, d);
      const ctx = `LoRA adapts a weight matrix $\\symW$ of shape ${shapeOf(dd, k)} at rank $${r} = ${rank}$.`;
      const kind = rng.int(3);
      if (kind === 0) {
        return {
          prompt: `${ctx} $${B}$ starts at zero and $${A}$ at random. Before the first training step, what does the layer output for an input $\\symx$?`,
          answer: choose(`$\\symW\\symx$: exactly what the pretrained layer gave`, [
            [`$\\symW\\symx$ plus a little random noise from $${A}$`, `$${A}\\symx$ is random, but $${B}$ is zero, so $${B}${A}\\symx$ is exactly zero.`],
            ['Zero, until training fills in the update', `Only the new path is zero. $\\symW\\symx$ is still there.`],
            [`$${B}${A}\\symx$ alone, since $\\symW$ is frozen`, `Frozen means not trained, not skipped: $\\symW\\symx$ is still computed.`],
          ]),
          solution: [`The layer computes $\\symW\\symx + ${B}${A}\\symx$, with $\\symW$ frozen.`, `With $${B} = 0$, $${B}${A}\\symx = 0$ whatever $${A}$ holds.`, 'So the layer gives $\\symW\\symx$: training starts from exactly the pretrained model.'],
        };
      }
      if (kind === 1) {
        return {
          prompt: `${ctx} Why does $${B}$ start at zero?`,
          answer: choose(`So $${B}${A} = 0$, and training starts from the pretrained model`, [
            [`So $\\symW$ can be learned again from a clean start`, `$\\symW$ keeps its pretrained values and is never trained. Only $${B}$ and $${A}$ change.`],
            ['So the update needs fewer numbers to store', `The count is $${r}(d + k)$ whatever the starting values are.`],
            [`So $${B}$ stays frozen while $${A}$ is trained`, `Both are trained. Zero is only where $${B}$ starts.`],
          ]),
          solution: [`The layer computes $\\symW\\symx + ${B}${A}\\symx$. A zero $${B}$ makes $${B}${A} = 0$, so at step zero it computes exactly $\\symW\\symx$.`, `The model moves away from the pretrained one only as training changes $${B}$.`],
        };
      }
      return {
        prompt: `${ctx} After training, $${B}${A}$ is merged into $\\symW$. What does the merged layer cost to run, compared with the original?`,
        answer: choose(`The same: the merged matrix has $\\symW$'s shape, $(d, k)$`, [
          [`More: each input also goes through $${B}$ and $${A}$`, `After merging, $${B}${A}$ is inside the merged matrix: one matrix, one multiply.`],
          [`Less: only $${r}(d + k)$ numbers are left`, `The merged matrix is a full $(d, k)$ matrix. The small count is what training stores, not what the merged layer holds.`],
          ['Double: the original and the merged matrix are both used', `The merged matrix replaces $\\symW$; the layer multiplies by it alone.`],
        ]),
        solution: [`$${B}${A}$ is $(d, ${r})$ times $(${r}, k)$, which is $(d, k)$: the same shape as $\\symW$.`, `So $\\symW + ${B}${A}$ is one $(d, k)$ matrix, and the layer runs exactly as fast as before.`],
      };
    },
  },
];

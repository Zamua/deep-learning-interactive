import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { num, pick } from '../../kit';
import { big, bigText } from '../../convnets/kit';
import { choice } from '../../inference/kit';
import { clean, placesFor, traps } from '../../networks/kit';

const TH = '\\sym{theta}{\\theta}';
const S = '\\sym{stretch}{s}';
const LT = '\\sym{Ltrain}{L_{\\text{train}}}';

const deg = (a: number) => `${num(clean(a))}^\\circ`;

/** A trained length and a whole stretch factor, small at first. */
function lengths(rng: Rng, d: number): { base: number; f: number } {
  return d < 0.35 ? { base: pick(rng, [1000, 2000, 3000, 4000]), f: pick(rng, [2, 4]) } : { base: pick(rng, [1000, 2000, 2048, 4096]), f: pick(rng, [2, 4, 8]) };
}

const trained = (base: number) => `A model with rotary positions was trained on texts of up to ${bigText(base)} tokens`;

export const generators: Generator[] = [
  {
    id: 'angle',
    make(rng, d) {
      const { base, f } = lengths(rng, d);
      const n = base * f;
      const mode = d < 0.35 ? (rng.next() < 0.3 ? 'raw' : 'pi') : d >= 0.6 && rng.next() < 0.35 ? 'gap' : 'pi';
      if (mode === 'gap') {
        const th = pick(rng, f === 8 ? [0.2, 0.4, 0.8] : [0.1, 0.2, 0.4]);
        const ans = clean(th / f);
        return {
          prompt: `${trained(base)} and is stretched to ${bigText(n)} with position interpolation. One pair turns by $${TH} = ${deg(th)}$ per position. After interpolation, how many degrees apart are that pair's angles at two neighboring positions?`,
          answer: { kind: 'number', value: ans },
          traps: traps(ans, [
            { value: th, why: `That is the spacing before interpolation. Each position is divided by $${S} = ${f}$, so neighbors sit $1/${f}$ of a step apart.` },
            { value: th * f, why: `That multiplies by $${S}$. Dividing positions by $${S}$ brings neighbors closer, not further apart.` },
          ]),
          solution: [
            `The stretch: $${S} = ${big(n)} / ${big(base)} = ${f}$.`,
            `Neighbors at $m$ and $m + 1$ turn as if at $m/${f}$ and $m/${f} + 1/${f}$: $1/${f}$ of a step apart.`,
            `So their angles differ by $${TH} / ${S} = ${num(th)} / ${f} = ${deg(ans)}$.`,
          ],
        };
      }
      const step = d < 0.35 ? 500 : 250;
      const cands: number[] = [];
      for (let m = base + step - (base % step); m < n; m += step) if (m % f === 0) cands.push(m);
      const m = pick(rng, cands);
      // A slow pair: one that never completes a turn within the trained length.
      const slow = [0.05, 0.1, 0.2].filter((t) => t * base < 360);
      const easy = slow.filter((t) => t >= 0.1);
      const th = pick(rng, d < 0.35 && easy.length ? easy : slow);
      const raw = clean(m * th);
      const ans = mode === 'raw' ? raw : clean((m / f) * th);
      const places = placesFor(ans);
      if (mode === 'raw') {
        return {
          prompt: `${trained(base)} and is run on a text of ${bigText(n)} tokens with no change. One pair turns by $${TH} = ${deg(th)}$ per position. By how many degrees is that pair turned at position ${bigText(m)}?`,
          answer: { kind: 'number', value: ans, places },
          traps: traps(ans, [
            { value: (m / f) * th, why: `That divides the position by $${S} = ${f}$, which only position interpolation does. Here nothing changes.` },
            { value: (base - 1) * th, why: 'That is the largest angle training made. Past the trained length the angle keeps growing.' },
          ], places),
          solution: [`With no change, position $m$ turns by $m${TH}$.`, `$${big(m)} \\times ${deg(th)} = ${deg(ans)}$, beyond the $${deg(clean((base - 1) * th))}$ training reached.`],
        };
      }
      return {
        prompt: `${trained(base)} and is stretched to ${bigText(n)} with position interpolation. One pair turns by $${TH} = ${deg(th)}$ per position. By how many degrees is that pair turned at position ${bigText(m)}?`,
        answer: { kind: 'number', value: ans, places },
        traps: traps(ans, [
          { value: raw, why: `That leaves position ${bigText(m)} as it is: an angle training never made. Interpolation first divides the position by $${S} = ${f}$.` },
          { value: m * th * f, why: `That multiplies by $${S}$. Interpolation divides every position by $${S}$.` },
          { value: m / f, why: `That is the position the token turns as. Its angle is that times $${TH}$.` },
        ], places),
        solution: [
          `The stretch: $${S} = ${big(n)} / ${big(base)} = ${f}$.`,
          `Position ${bigText(m)} turns as if at $${big(m)} / ${f} = ${big(m / f)}$.`,
          `Its angle: $${big(m / f)} \\times ${deg(th)} = ${deg(ans)}$, inside the range training made. Unscaled it would be $${deg(raw)}$.`,
        ],
      };
    },
  },
  {
    id: 'stretch',
    make(rng, d) {
      const base = d < 0.35 ? pick(rng, [1000, 2000, 4000]) : pick(rng, [2048, 4096, 8192]);
      const f = d < 0.35 ? pick(rng, [2, 4, 5, 8]) : pick(rng, [2, 4, 8, 16, 32]);
      const n = base * f;
      if (d >= 0.5 && rng.next() < 0.4) {
        return {
          prompt: `${trained(base)}. Position interpolation stretches it with $${S} = ${f}$. How many tokens long a text can it then read?`,
          answer: { kind: 'number', value: n },
          traps: traps(n, [
            { value: base / f, why: `That divides by $${S}$. The text can be $${S}$ times as long as $${LT}$: its positions are divided by $${S}$ to fit.` },
            { value: base + f, why: `That adds $${S}$. It is a factor: the new length is $${S}$ times $${LT}$.` },
          ]),
          solution: [`$${S}$ is the new length over $${LT}$, so the new length is $${S} \\times ${LT}$.`, `$${f} \\times ${big(base)} = ${big(n)}$ tokens.`],
        };
      }
      return {
        prompt: `${trained(base)}. Position interpolation is to stretch it to read texts of ${bigText(n)} tokens. What is the stretch $${S}$?`,
        answer: { kind: 'number', value: f },
        traps: traps(f, [
          { value: base / n, why: `That divides the trained length by the new one. $${S}$ is the new length over $${LT}$, more than 1.` },
          { value: n - base, why: `That is the difference in tokens. $${S}$ is how many times longer the new length is.` },
        ]),
        solution: [`$${S}$ is the new length over $${LT}$.`, `$${S} = ${big(n)} / ${big(base)} = ${f}$.`],
      };
    },
  },
  {
    id: 'last',
    make(rng, d) {
      const { base, f } = lengths(rng, d);
      const n = base * f;
      const ans = (n - 1) / f;
      const places = placesFor(ans);
      return {
        prompt: `${trained(base)} and reads a text of ${bigText(n)} tokens with position interpolation. Counting from 0, the text's last token is turned as if it sat at what position?${places ? ' Round to two decimals.' : ''}`,
        answer: { kind: 'number', value: ans, places },
        traps: traps(ans, [
          { value: base, why: `That divides the length, ${bigText(n)}, by $${S}$. Counting from 0, the last token sits at ${bigText(n - 1)}.` },
          { value: n - 1, why: `That leaves the position as it is. Interpolation divides it by $${S} = ${f}$.` },
          { value: (n - 1) * f, why: `That multiplies by $${S}$. Interpolation divides every position by $${S}$.` },
        ], places),
        solution: [
          `The stretch: $${S} = ${big(n)} / ${big(base)} = ${f}$.`,
          `Counting from 0, the last of ${bigText(n)} tokens sits at position ${bigText(n - 1)}.`,
          `It turns as if at $${big(n - 1)} / ${f} = ${num(ans)}$, just below $${LT} = ${big(base)}$.`,
        ],
      };
    },
  },
  {
    id: 'why',
    make(rng, d) {
      const { base, f } = lengths(rng, d);
      const n = base * f;
      const v = rng.int(3);
      if (v === 0) {
        return {
          prompt: `${trained(base)} and is run on ${bigText(n)} tokens with no change. Why does quality collapse past position ${bigText(base - 1)}?`,
          answer: choice([
            { text: 'Slow pairs turn by angles they never reached in training', why: null },
            { text: `There are no position vectors for positions past ${bigText(base - 1)}`, why: 'That is a learned position table, one row per position. Rotary positions compute each turn as $m\\sym{theta}{\\theta}$, at any position.' },
            { text: 'Past 360°, angles wrap around, so far tokens look near', why: 'Wrapping is nothing new: fast pairs go round many times in training. The trouble is slow pairs reaching angles they never had.' },
            { text: 'Turning makes the queries and keys longer at far positions', why: 'A turn keeps a pair\'s length. It only changes the angle.' },
          ]),
          solution: [
            `A slow pair turns by $m${TH}$, so in training its angle never got past $${big(base - 1)}${TH}$.`,
            'Past the trained length, its queries and keys arrive at angles the model never learned to read, and the scores go wrong.',
          ],
        };
      }
      if (v === 1) {
        return {
          prompt: `${trained(base)}. What does position interpolation do so that it can read ${bigText(n)}?`,
          answer: choice([
            { text: `It divides every position by $${S} = ${f}$, so every angle stays in range`, why: null },
            { text: `It multiplies every $${TH}$ by ${f}, so each pair turns ${f} times faster`, why: 'That pushes the angles further out of range. Interpolation divides the positions, which shrinks the angles.' },
            { text: `It keeps only the last ${bigText(base)} tokens of the text`, why: 'That would drop most of the text. Interpolation keeps every token and squeezes their positions.' },
            { text: 'It turns every pair by the same angle at every position', why: `Then queries and keys would carry no position at all. Each position still turns by its own angle, $m${TH} / ${S}$.` },
          ]),
          solution: [`$${S} = ${big(n)} / ${big(base)} = ${f}$, and position $m$ turns by $m${TH} / ${S}$.`, `Divided by ${f}, every position up to ${bigText(n - 1)} lands below $${LT} = ${big(base)}$, so every angle is one training made.`],
        };
      }
      return {
        prompt: `${trained(base)} and is stretched to ${bigText(n)} with position interpolation, $${S} = ${f}$. Why is a short fine-tune still needed?`,
        answer: choice([
          { text: `Neighbors now turn only $${TH} / ${f}$ apart, a finer spacing than training used`, why: null },
          { text: `Positions past ${bigText(base - 1)} still turn by angles training never made`, why: `Interpolation divides every position by $${S}$, so every one lands below $${LT}$: its angles are all in range.` },
          { text: `The stretch $${S}$ itself is learned during the fine-tune`, why: `$${S}$ is fixed: the new length over $${LT}$.` },
          { text: 'Queries and keys must grow longer to hold the extra positions', why: 'Turning never changes a pair\'s length, and the vectors keep their size.' },
        ]),
        solution: [
          `Dividing positions by $${S} = ${f}$ puts neighbors $1/${f}$ of a step apart, so a pair turns $${TH} / ${f}$ between them instead of $${TH}$.`,
          'The model has never seen tokens that close in angle; a short fine-tune on long texts teaches it to read them.',
        ],
      };
    },
  },
];

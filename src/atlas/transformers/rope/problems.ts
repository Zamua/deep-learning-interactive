import type { Generator } from '../../../mastery/domain/types';
import { clean, dot, int, num, pick, traps } from '../../kit';
import { DK, k, q, vecT } from '../kit';
import { cs, deg, pair, rot, times, TRIG } from '../rotation/trig';

const TH = '\\sym{theta}{\\theta}';

/** Solution lines turning pair `p` (named `sym`) by 90° per position, entry by entry. */
function turnSteps(name: string, sym: string, p: readonly number[], pos: number): string[] {
  if (pos === 0) return [`The ${name} at position 0 does not turn: $${sym}$ stays $${vecT(p)}$.`];
  const a = 90 * pos;
  const [c, s] = TRIG[a]!;
  const r = rot(p, a);
  return [
    `The ${name} at position ${pos} turns by $${pos} \\times 90^\\circ = ${deg(a)}$, with $\\cos = ${num(c)}$ and $\\sin = ${num(s)}$.`,
    `First entry: $${times(p[0]!, c)} - ${times(p[1]!, s)} = ${num(r[0]!)}$.`,
    `Second entry: $${times(p[0]!, s)} + ${times(p[1]!, c)} = ${num(r[1]!)}$, so $${sym}$ turns to $${vecT(r)}$.`,
  ];
}

export const generators: Generator[] = [
  {
    id: 'score',
    make(rng, d) {
      const qv = pair(rng, d < 0.35 ? 0 : -3, 3);
      const kv = pair(rng, d < 0.35 ? 0 : -3, 3);
      const base = dot(qv, kv);
      if (d < 0.5) {
        const th = pick(rng, d < 0.25 ? [30, 45, 90] : [10, 15, 20, 30]);
        const m = int(rng, 1, 9);
        const a = m * th;
        const onlyQ = TRIG[a % 360] ? [{ value: dot(rot(qv, a), kv), why: 'That turns only the query. The key sits at the same position, so it turns by the same angle, and two equal turns leave the dot product alone.' }] : [];
        return {
          prompt: `With rotary positions turning by $${TH} = ${deg(th)}$ per position, the token at position ${m} scores its own key. Before turning, its query is $${q} = ${vecT(qv)}$ and its key is $${k} = ${vecT(kv)}$. What is the dot product of the turned query and the turned key?`,
          answer: { kind: 'number', value: base },
          traps: traps(base, onlyQ),
          solution: [
            `Both sit at position ${m}, so both turn by the same angle, $${m} \\times ${deg(th)} = ${deg(a)}$.`,
            'Turning two arrows together keeps everything between them, so their dot product does not change.',
            `So the score is $${q} \\cdot ${k} = ${times(qv[0]!, kv[0]!)} + ${times(qv[1]!, kv[1]!)} = ${num(base)}$.`,
          ],
        };
      }
      for (;;) {
        const m = int(rng, 0, 3);
        const n = int(rng, 0, 3);
        if (m === n) continue;
        const qr = rot(qv, 90 * m);
        const kr = rot(kv, 90 * n);
        const v = dot(qr, kr);
        const used = [90 * m, 90 * n].filter((a) => a > 0).sort((x, y) => x - y);
        return {
          prompt: `Rotary positions turn by $${TH} = 90^\\circ$ per position. Before turning, a query $${q} = ${vecT(qv)}$ sits at position ${m} and a key $${k} = ${vecT(kv)}$ at position ${n}. What is the dot product of the turned query and the turned key? Use ${used.map(cs).join(', and ')}.`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: base, why: 'That leaves out the turns. The two sit at different positions, so they turn by different angles.' },
            ...(n > 0 ? [{ value: dot(qr, kv), why: `That turns only the query. The key at position ${n} turns too, by $${deg(90 * n)}$.` }] : []),
            ...(m > 0 ? [{ value: dot(qv, kr), why: `That turns only the key. The query at position ${m} turns too, by $${deg(90 * m)}$.` }] : []),
          ]),
          solution: [
            ...turnSteps('query', q, qv, m),
            ...turnSteps('key', k, kv, n),
            `Their dot product: $${times(qr[0]!, kr[0]!)} + ${times(qr[1]!, kr[1]!)} = ${num(v)}$.`,
          ],
        };
      }
    },
  },
  {
    id: 'angle',
    make(rng, d) {
      if (d >= 0.7) {
        const fast = pick(rng, [20, 30, 40, 50]);
        const ths = [fast, fast / 10, fast / 100];
        const j = int(rng, 1, 2);
        const m = int(rng, 6, 60);
        const v = clean(m * ths[j]!);
        return {
          prompt: `A query of $${DK} = 6$ entries is cut into three pairs, which turn by $${ths.map(deg).join('$, $')}$ per position. Counting pairs and positions from 0, by how many degrees is pair ${j} of the query at position ${m} turned?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: m * ths[0]!, why: `That uses pair 0's turn per position. Pair ${j} turns by $${deg(ths[j]!)}$.` },
            { value: (m + 1) * ths[j]!, why: `That counts positions from 1. Position 0 is not turned at all, so position $m$ turns by $m${TH}$.` },
            { value: m + ths[j]!, why: `That adds. Each position turns by another $${deg(ths[j]!)}$: multiply.` },
          ]),
          solution: [`Pair ${j} turns by $${TH} = ${deg(ths[j]!)}$ per position.`, `At position ${m}: $${m} \\times ${deg(ths[j]!)} = ${deg(v)}$.`],
        };
      }
      const th = d < 0.35 ? pick(rng, [10, 15, 20, 30, 45]) : pick(rng, [5, 12, 25, 40, 60]);
      const m = d < 0.35 ? int(rng, 2, 8) : int(rng, 6, 24);
      const v = m * th;
      return {
        prompt: `With rotary positions, one pair of every query and key turns by $${TH} = ${deg(th)}$ per position. Counting positions from 0, by how many degrees is that pair of the ${pick(rng, ['query', 'key'])} at position ${m} turned?`,
        answer: { kind: 'number', value: v },
        traps: traps(v, [
          { value: (m + 1) * th, why: `That counts positions from 1. Position 0 is not turned at all, so position $m$ turns by $m${TH}$.` },
          { value: (m - 1) * th, why: `That is one step short: position ${m} is ${m} steps of $${deg(th)}$ from position 0.` },
          { value: m + th, why: `That adds. Each position turns by another $${deg(th)}$: multiply.` },
        ]),
        solution: [`Position $m$ turns by $m${TH}$: not at all at position 0, one more $${TH}$ for each position after it.`, `$${m} \\times ${deg(th)} = ${deg(v)}$.`],
      };
    },
  },
  {
    id: 'same-score',
    make(rng) {
      for (;;) {
        const m = int(rng, 1, 9);
        const n = int(rng, 1, 9);
        const t = int(rng, 1, 6);
        if (m === n) continue;
        const gap = Math.abs(m - n);
        const pos = (a: number, b: number) => `Query at ${a}, key at ${b}`;
        const away = (a: number, b: number) => `the distance changes from ${gap} to ${Math.abs(a - b)}`;
        const swapped: [number, number, string] = [n, m, `That swaps which comes first: the key is now ${gap} positions ${m > n ? 'after' : 'before'} the query, not ${m > n ? 'before' : 'after'}. The query is turned the other way relative to the key, and the score generally changes.`];
        const moved: [number, number, string][] = [
          [2 * m, 2 * n, `Doubling both positions doubles the distance too: ${2 * gap} apart instead of ${gap}.`],
          [m + t, n, `Only the query moves, so ${away(m + t, n)}.`],
          [m, n + t, `Only the key moves, so ${away(m, n + t)}.`],
          [m + t, n - t, `The positions add up to the same, but ${away(m + t, n - t)}.`],
        ];
        const wrong = rng.shuffle([swapped, ...moved.filter(([a, b]) => b >= 0 && Math.abs(a - b) !== gap)]).slice(0, 3);
        const options = [pos(m + t, n + t), ...wrong.map(([a, b]) => pos(a, b))];
        if (new Set(options).size !== 4) continue;
        return {
          prompt: `With rotary positions, a query $${q}$ at position ${m} and a key $${k}$ at position ${n} give some score. Which positions give the same score for every possible $${q}$ and $${k}$?`,
          answer: { kind: 'choice', options, correct: 0, why: [null, ...wrong.map((w) => w[2])] },
          solution: [
            `The query turns by $${m}${TH}$ and the key by $${n}${TH}$. Turning both by the same angle never changes their dot product, so only the difference counts.`,
            `Here the query is ${gap} positions ${m > n ? 'after' : 'before'} the key. Moving both ${t} later keeps that: positions ${m + t} and ${n + t}.`,
          ],
        };
      }
    },
  },
];

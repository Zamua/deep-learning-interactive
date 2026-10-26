import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick } from '../../kit';
import { clean, dot, DK, k, par, q, traps, vecT, vtraps } from '../kit';

const TH = '\\sym{theta}{\\theta}';

/** Angles in degrees with their cosine and sine, rounded as the prompts quote them. */
const TRIG: Record<number, [number, number]> = {
  0: [1, 0],
  30: [0.87, 0.5],
  45: [0.71, 0.71],
  60: [0.5, 0.87],
  90: [0, 1],
  120: [-0.5, 0.87],
  135: [-0.71, 0.71],
  150: [-0.87, 0.5],
  180: [-1, 0],
  270: [0, -1],
};

const deg = (a: number) => `${num(a)}^\\circ`;
const eq = (v: number) => ([0, 1, -1, 0.5, -0.5].includes(v) ? '=' : '\\approx');
/** "$\cos 60° = 0.5$ and $\sin 60° ≈ 0.87$" */
const cs = (a: number) => {
  const [c, s] = TRIG[a]!;
  return `$\\cos ${deg(a)} ${eq(c)} ${num(c)}$ and $\\sin ${deg(a)} ${eq(s)} ${num(s)}$`;
};

/** The pair turned by `a` degrees, with the rounded cosine and sine. */
function rot(p: readonly number[], a: number): number[] {
  const [c, s] = TRIG[((a % 360) + 360) % 360]!;
  return [clean(p[0]! * c - p[1]! * s), clean(p[0]! * s + p[1]! * c)];
}

/** A pair of integers in [lo, hi], not both zero. */
function pair(rng: Rng, lo: number, hi: number): number[] {
  for (;;) {
    const p = [int(rng, lo, hi), int(rng, lo, hi)];
    if (p[0] !== 0 || p[1] !== 0) return p;
  }
}

/** `a × b` for TeX, negatives in parentheses. */
const times = (a: number, b: number) => `${par(a)} \\times ${par(b)}`;

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
    id: 'rotate',
    make(rng, d) {
      const a = d < 0.35 ? pick(rng, [90, 180, 270]) : d < 0.7 ? pick(rng, [90, 270, 60, 30]) : pick(rng, [30, 45, 60, 120, 135, 150]);
      const p = d < 0.35 ? pair(rng, 0, 4) : pair(rng, -3, 4);
      const [c, s] = TRIG[a]!;
      const v = rot(p, a);
      const places = a % 90 === 0 ? undefined : 2;
      const query = rng.int(2) === 0;
      return {
        prompt: `One pair of a ${query ? 'query' : 'key'} is $${query ? q : k} = ${vecT(p)}$. What is it after a $${deg(a)}$ rotation?${places ? ' Round to two decimals.' : ''}\n\nUse ${cs(a)}.`,
        answer: { kind: 'vector', value: v, places },
        traps: vtraps(v, [
          { value: [clean(p[0]! * c + p[1]! * s), clean(-p[0]! * s + p[1]! * c)], why: 'That turns it the other way, clockwise. The minus sign belongs on $b\\sin{}$ in the first entry: $[a\\cos{} - b\\sin{},\\ a\\sin{} + b\\cos{}]$.' },
          { value: [clean(p[0]! * s - p[1]! * c), clean(p[0]! * c + p[1]! * s)], why: 'That swaps the cosine and the sine. The first entry is $a\\cos{} - b\\sin{}$.' },
          { value: [clean(p[0]! * c), clean(p[1]! * c)], why: 'That only scales each entry by the cosine. Each entry also mixes in the other one, times the sine.' },
        ], places),
        solution: [
          `A turn sends $[a,\\ b]$ to $[a\\cos{} - b\\sin{},\\ a\\sin{} + b\\cos{}]$, here with $\\cos = ${num(c)}$ and $\\sin = ${num(s)}$.`,
          `First entry: $${times(p[0]!, c)} - ${times(p[1]!, s)} = ${num(v[0]!)}$.`,
          `Second entry: $${times(p[0]!, s)} + ${times(p[1]!, c)} = ${num(v[1]!)}$.`,
          `So the pair turns to $${vecT(v)}$.`,
        ],
      };
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
];

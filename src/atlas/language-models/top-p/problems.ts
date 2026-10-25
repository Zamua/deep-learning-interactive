import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { int, num, pick, round, vec } from '../../kit';
import { big, commas, lit, traps, vtraps } from '../kit';

const VOCABS = [
  ['the', 'a', 'my', 'one', 'this', 'that'],
  ['dog', 'cat', 'bird', 'fish', 'cow', 'fox'],
  ['ran', 'sat', 'slept', 'ate', 'sang', 'hid'],
  ['red', 'blue', 'green', 'gold', 'gray', 'pink'],
  ['yes', 'no', 'maybe', 'never', 'ok', 'soon'],
];

/** `n` distinct probabilities in hundredths, each a multiple of `step`, largest first, adding up to 100. */
function dist(rng: Rng, n: number, step: number): number[] {
  const units = 100 / step;
  for (;;) {
    const cuts = Array.from({ length: n - 1 }, () => int(rng, 1, units - 1)).sort((a, b) => a - b);
    const parts = [...cuts, units].map((c, i) => (c - (i ? cuts[i - 1]! : 0)) * step);
    if (parts.every((p) => p > 0) && new Set(parts).size === n) return parts.sort((a, b) => b - a);
  }
}

/** How many of the largest (hundredths, sorted) it takes to reach `p` hundredths. */
const nucleus = (h: readonly number[], p: number): number => {
  let c = 0;
  for (let i = 0; i < h.length; i++) {
    c += h[i]!;
    if (c >= p) return i + 1;
  }
  return h.length;
};

const p2 = (h: number) => num(h / 100, 2);
const list = (words: readonly string[], h: readonly number[]) => words.map((w, i) => `${lit(w)} $${p2(h[i]!)}$`).join(', ');
const cum = (h: readonly number[], k: number) => h.slice(0, k).reduce((a, b) => a + b, 0);

export const generators: Generator[] = [
  {
    id: 'nucleus',
    make(rng, d) {
      const n = d < 0.35 ? 4 : d < 0.7 ? 5 : 6;
      for (;;) {
        const h = dist(rng, n, n < 6 ? 5 : 2);
        const p = pick(rng, [50, 60, 70, 75, 80, 90]);
        const k = nucleus(h, p);
        const exact = h.some((_, i) => cum(h, i + 1) === p);
        if (k < 2 || k >= n || (exact && d < 0.5)) continue;
        const words = pick(rng, VOCABS).slice(0, n);
        const order = d >= 0.7 ? rng.shuffle(h.map((_, i) => i)) : h.map((_, i) => i);
        const shown = list(order.map((i) => words[i]!), order.map((i) => h[i]!));
        return {
          prompt: `A model's next-token probabilities are ${shown}. How many tokens does top-p sampling with $p = ${p2(p)}$ keep?`,
          answer: { kind: 'number', value: k },
          traps: traps(k, [
            { value: k - 1, why: `That stops short: the top ${k - 1} add up to only $${p2(cum(h, k - 1))}$, less than $${p2(p)}$.` },
            { value: k + 1, why: `That keeps one too many: the top ${k} already add up to $${p2(cum(h, k))}$, which reaches $${p2(p)}$.` },
            { value: n, why: 'Top-p cuts off the tail: it keeps only the most likely tokens it needs to reach $p$.' },
          ]),
          solution: [
            ...(d >= 0.7 ? [`Sort them, most likely first: ${list(h.map((_, i) => words[i]!), h)}.`] : []),
            `Add them up from the top until the total reaches $${p2(p)}$: ${h.slice(0, k).map((_, i) => `$${p2(cum(h, i + 1))}$`).join(', ')}.`,
            `The total reaches $${p2(p)}$ at token ${k}${exact ? ' exactly, which is enough' : ''}, so top-p keeps ${k} tokens.`,
          ],
        };
      }
    },
  },
  {
    id: 'renorm',
    make(rng, d) {
      const n = d < 0.5 ? 4 : 5;
      for (;;) {
        const h = dist(rng, n, 5);
        const topk = d < 0.35 || rng.int(2) === 0;
        let k: number;
        let how: string;
        if (topk) {
          k = d < 0.5 ? 2 : pick(rng, [2, 3]);
          how = `top-k sampling, $k = ${k}$`;
        } else {
          const p = pick(rng, [50, 60, 70, 75, 80]);
          k = nucleus(h, p);
          how = `top-p sampling, $p = ${p2(p)}$`;
        }
        if (k < 2 || k >= n) continue;
        const S = cum(h, k);
        if (![40, 50, 60, 70, 75, 80, 90].includes(S)) continue;
        const kept = h.slice(0, k);
        const v = kept.map((x) => round(x / S, 2));
        if (Math.abs(v.reduce((a, b) => a + b, 0) - 1) > 0.011) continue;
        const words = pick(rng, VOCABS).slice(0, n);
        const cut = 100 - S;
        return {
          prompt: `A model's next-token probabilities are ${list(words, h)}. It uses ${how}. With what probabilities does it pick the tokens it keeps, most likely first? Round to two decimals.`,
          answer: { kind: 'vector', value: v, places: 2 },
          traps: vtraps(v, [
            { value: kept.map((x) => x / 100), why: `Those are the old probabilities, which add up to only $${p2(S)}$. Divide each by $${p2(S)}$ so they add up to 1.` },
            { value: kept.map((x, i) => (x + (i === 0 ? cut : 0)) / 100), why: 'That hands the cut probability to the top token. Renormalizing divides every kept probability by their total.' },
            { value: kept.map((x) => round((x + cut / k) / 100, 2)), why: 'That shares the cut probability out equally. Renormalizing divides every kept probability by their total, so each keeps its share.' },
          ]),
          solution: [
            `${topk ? `Top-k keeps the ${k} most likely` : `Top-p keeps the top ${k}, the first that add up to at least $p$`}: ${list(words.slice(0, k), kept)}.`,
            `They add up to $${p2(S)}$; divide each by that so they add up to 1: ${kept.map((x) => `$${p2(x)} / ${p2(S)} \\approx ${num(round(x / S, 2), 2)}$`).join(', ')}.`,
            `The other ${n - k} tokens get probability 0.`,
          ],
        };
      }
    },
  },
  {
    id: 'adapts',
    make(rng, d) {
      const n = 5;
      for (;;) {
        const p = pick(rng, [70, 75, 80, 90]);
        const top = pick(rng, d < 0.5 ? [75, 80, 85] : [55, 60, 65, 70, 75]);
        const rest = dist(rng, n - 1, 1).map((x) => Math.round((x * (100 - top)) / 100));
        const peaked = [top, ...rest];
        const flat = dist(rng, n, 2);
        if (peaked.reduce((a, b) => a + b, 0) !== 100 || new Set(peaked).size < n || rest.some((x) => x <= 0) || flat[0]! > 35) continue;
        const a = nucleus(peaked, p);
        const b = nucleus(flat, p);
        if (a >= b || b < 3 || b >= n) continue;
        const [w1, w2] = rng.shuffle(VOCABS.slice()).slice(0, 2) as [string[], string[]];
        const opt = (x: number, y: number) => `${x} after A, ${y} after B`;
        const cands: [number, number, string][] = [
          [b, a, 'That swaps them. A sure model puts most of the probability on a few tokens, so it reaches $p$ sooner.'],
          [b, b, 'That keeps the same number after both, as top-k would. Top-p stops when the total reaches $p$, which takes fewer tokens when the model is sure.'],
          [a, b - 1, `That stops short after B: its top ${b - 1} add up to only $${p2(cum(flat, b - 1))}$.`],
          [a, b + 1, `That keeps one too many after B: its top ${b} already reach $${p2(cum(flat, b))}$.`],
        ];
        const picked: [number, number, string][] = [];
        for (const c of cands) if (picked.length < 3 && opt(c[0], c[1]) !== opt(a, b) && !picked.some((q) => opt(q[0], q[1]) === opt(c[0], c[1]))) picked.push(c);
        return {
          prompt: `After context A, a model's next-token probabilities are ${list(w1.slice(0, n), peaked)}. After context B they are ${list(w2.slice(0, n), flat)}. How many tokens does top-p sampling with $p = ${p2(p)}$ keep each time?`,
          answer: { kind: 'choice', options: [opt(a, b), ...picked.map(([x, y]) => opt(x, y))], correct: 0, why: [null, ...picked.map(([, , w]) => w)] },
          solution: [
            `After A, add from the top: ${peaked.slice(0, a).map((_, i) => `$${p2(cum(peaked, i + 1))}$`).join(', ')}. That reaches $${p2(p)}$ with ${a} token${a > 1 ? 's' : ''}.`,
            `After B: ${flat.slice(0, b).map((_, i) => `$${p2(cum(flat, i + 1))}$`).join(', ')}. That reaches $${p2(p)}$ with ${b} tokens.`,
            'Where the model is sure, top-p keeps few tokens; where it is unsure, it keeps many. A fixed top-k would keep the same number both times.',
          ],
        };
      }
    },
  },
  {
    id: 'limits',
    make(rng) {
      const V = pick(rng, [100, 1000, 32000, 50000, 50257]);
      const cases: { what: string; greedy: boolean; why: string; given?: string }[] = [
        { what: 'top-k sampling with $k = 1$', greedy: true, why: 'It keeps only the single most likely token.' },
        { what: `top-k sampling with $k = ${big(V)}$`, greedy: false, why: `It keeps the ${commas(V)} most likely tokens: all of them.` },
        { what: 'top-p sampling with $p = 1$', greedy: false, why: 'Only the whole vocabulary is sure to add up to 1, so it keeps every token.' },
        { what: 'top-p sampling with $p = 0.01$', greedy: true, why: 'The most likely token alone already reaches 0.01, so it is the only one kept.', given: ', and its most likely next token always has probability above $0.01$' },
      ];
      const c = pick(rng, cases);
      return {
        prompt: `A model has a vocabulary of $V = ${big(V)}$ tokens${c.given ?? ''}. What is ${c.what} the same as?`,
        answer: {
          kind: 'choice',
          options: ['Greedy decoding: always the most likely token', 'Plain sampling from the whole distribution', 'Uniform sampling: every token equally likely'],
          correct: c.greedy ? 0 : 1,
          why: [
            c.greedy ? null : 'That would keep only the top token. This setting keeps every token, so nothing is cut.',
            c.greedy ? 'Plain sampling keeps every token. This setting keeps only the most likely one.' : null,
            'Top-k and top-p only cut tokens off and renormalize the rest: the kept tokens keep their relative odds, never equal ones.',
          ],
        },
        solution: c.greedy
          ? [c.why, 'Renormalized, that token gets probability 1, so sampling always picks it: greedy decoding.']
          : [c.why, 'Nothing is cut, and the probabilities already add up to 1, so sampling uses the model\'s own distribution: plain sampling.'],
      };
    },
  },
];

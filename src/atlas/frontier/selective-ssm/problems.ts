import type { Generator } from '../../../mastery/domain/types';
import { choice } from '../../inference/kit';
import { big, clean, commas, int, num, par, pick, round, traps } from '../../kit';

/** e^(-Δ) to two places, as prompts quote it. */
const decay = (dt: number) => round(Math.exp(-dt), 2) + 0;
const useExp = (dts: readonly number[]) =>
  [...new Set(dts)].sort((p, q) => p - q).map((dt) => `$e^{-${num(dt)}} \\approx ${num(decay(dt), 2)}$`).join(', ');

/** h_1..h_n from h_0 = 0, step t fading the old state by as[t]. */
function run(as: readonly number[], b: number, xs: readonly number[]): number[] {
  const hs = [0];
  xs.forEach((x, t) => hs.push(clean(as[t]! * hs[t]! + b * x)));
  return hs;
}

const list = (name: string, vs: readonly number[]) => vs.map((v, i) => `$${name}_{${i + 1}} = ${num(v)}$`).join(', ');
const DECAYS = [0.1, 0.2, 0.5, 0.8, 0.9];
const STEPS = [0.1, 0.2, 0.5, 1, 2, 3];

export const generators: Generator[] = [
  {
    id: 'state',
    make(rng, d) {
      const viaDelta = d >= 0.7;
      const n = d < 0.35 ? 2 : 3;
      for (;;) {
        const b = d < 0.35 ? 1 : pick(rng, [1, 2]);
        const xs = Array.from({ length: n }, () => int(rng, 1, 6));
        const dts = Array.from({ length: n }, () => pick(rng, STEPS));
        const as = viaDelta ? dts.map(decay) : Array.from({ length: n }, () => pick(rng, DECAYS));
        const hs = run(as, b, xs);
        const raw = hs[n]!;
        const ans = round(raw, 2) + 0;
        // A third decimal of 5 would round differently by hand and by float.
        if (Math.abs(raw * 100 - Math.round(raw * 100)) > 0.49) continue;
        const last = `\\symh_{${n}}`;
        const given = viaDelta ? `with step sizes ${list('\\Delta', dts)}` : `with decays ${list('a', as)}`;
        const ts = [
          { value: b * xs.reduce((acc, x) => acc + x, 0), why: 'That keeps every input in full, as if every $a_t$ were 1. Each step first fades the old state by its own $a_t$.' },
          { value: xs.reduce((h, x, t) => h + as[t]! * b * x, 0), why: 'That fades the new input. $a_t$ multiplies the old state $\\symh_{t-1}$; the input comes in as $b\\symx_t$.' },
          { value: run([1, ...as], b, xs)[n]!, why: 'That uses each decay one step late. Step $t$ fades the old state by its own $a_t$, set by its own input.' },
          { value: b * xs[n - 1]!, why: 'That keeps only the last input. Even a small $a_t$ leaves a little of the old state.' },
          ...(viaDelta ? [{ value: run(dts, b, xs)[n]!, why: 'That uses the step size as the decay. The decay is $a_t = e^{-\\Delta_t}$.' }] : []),
        ];
        return {
          prompt: `A one-unit selective state space model has $b = ${b}$ and starts at $\\symh_0 = 0$. It reads ${list('\\symx', xs)}, ${given}. What is $${last}$?${viaDelta ? ` Round to two decimals. Use ${useExp(dts)}.` : ''}`,
          answer: { kind: 'number', value: ans, ...(viaDelta ? { places: 2 } : {}) },
          traps: traps(ans, ts).filter((t) => Math.abs(t.value - ans) >= 0.01),
          solution: [
            'Each step computes $\\symh_t = a_t\\symh_{t-1} + b\\symx_t$: the old state faded by this step\'s decay, plus the input times $b$.',
            ...(viaDelta ? [`The decays: ${as.map((a, t) => `$a_{${t + 1}} = e^{-${num(dts[t]!)}} \\approx ${num(a, 2)}$`).join(', ')}.`] : []),
            `Step 1: $\\symh_0 = 0$, so $a_1$ has nothing to fade: $\\symh_1 = ${b === 1 ? '\\symx_1' : `${b} \\times ${xs[0]}`} = ${num(hs[1]!)}$.`,
            ...xs.slice(1).map((x, i) => {
              const t = i + 2;
              return `Step ${t}: $\\symh_{${t}} = ${num(as[t - 1]!)} \\times ${par(hs[t - 1]!)} + ${b === 1 ? '' : `${b} \\times `}${x} = ${num(hs[t]!)}$.`;
            }),
            ...(viaDelta && ans !== raw ? [`Rounded: $${last} \\approx ${num(ans, 2)}$.`] : []),
          ],
        };
      }
    },
  },
  {
    id: 'keep',
    make(rng, d) {
      if (d < 0.35 || rng.int(2) === 0) {
        const large = d < 0.35 ? pick(rng, [3, 4, 5]) : pick(rng, [2, 3, 4, 5, 6, 8]);
        const small = d < 0.35 ? pick(rng, [0.05, 0.1]) : pick(rng, [0.01, 0.05, 0.1, 0.2]);
        const forget = rng.int(2) === 0;
        const dt = forget ? large : small;
        const a = Math.exp(-dt);
        const aTex = `$a_t = e^{-${num(dt)}} \\approx ${a < 0.01 ? num(round(a, 4) + 0) : num(round(a, 2) + 0, 2)}$`;
        const wipe = `With $\\Delta_t = ${num(dt)}$, ${aTex}: almost nothing of the old state is kept, and the new input dominates.`;
        const keep = `With $\\Delta_t = ${num(dt)}$, ${aTex}: almost all of the old state is kept.`;
        return {
          prompt: `At one step, a selective state space model computes the step size $\\Delta_t = ${num(dt)}$ from its input. What does this step do to the state?`,
          answer: choice([
            { text: 'Most of the old state is wiped, and the new input takes its place', why: forget ? null : keep },
            { text: 'Most of the old state is kept, and the new input is added to it', why: forget ? wipe : null },
            { text: 'The old state grows, since the decay at this step is above 1', why: `That drops the minus sign. The decay is $e^{-\\Delta_t}$, and a positive step size always gives a number between 0 and 1.` },
            { text: 'The old state is set to exactly 0 before the input is added', why: `$e^{-\\Delta_t}$ is never exactly 0: ${aTex}${forget ? ' still keeps a sliver of the old state' : ' keeps nearly all of it'}.` },
          ]),
          solution: [
            'The decay is $a_t = e^{-\\Delta_t}$: a big step gives a decay near 0, a small step a decay near 1.',
            `Here ${aTex}.`,
            forget ? 'So the old state is almost wiped, and the state becomes mostly the new input.' : 'So the old state carries on almost whole, with the new input added.',
          ],
        };
      }
      const pool = rng.shuffle([0.05, 0.1, 0.2, 0.5, 1, 2, 3, 5]).slice(0, 4);
      const most = rng.int(2) === 0;
      const target = most ? Math.max(...pool) : Math.min(...pool);
      const ex = (dt: number) => `$e^{-${num(dt)}} \\approx ${dt >= 5 ? num(round(Math.exp(-dt), 3) + 0) : num(decay(dt), 2)}$`;
      return {
        prompt: `A selective state space model reads $\\symx_1$ to $\\symx_4$ and computes the step sizes ${list('\\Delta', pool)}. At which step does it ${most ? 'forget the most' : 'keep the most'} of its old state?`,
        answer: choice(
          pool.map((dt, i) => ({
            text: `Step ${i + 1}, with $\\Delta_{${i + 1}} = ${num(dt)}$`,
            why: dt === target ? null : `$\\Delta_{${i + 1}} = ${num(dt)}$ gives $a_{${i + 1}} = ${ex(dt).slice(1)}. ${most ? 'A larger step size gives a smaller decay, which forgets more.' : 'A smaller step size gives a decay closer to 1, which keeps more.'}`,
          })),
        ),
        solution: [
          'Each step fades the old state by $a_t = e^{-\\Delta_t}$: the bigger $\\Delta_t$, the closer $a_t$ is to 0.',
          `The decays: ${pool.map((dt, i) => `$a_{${i + 1}} = ${ex(dt).slice(1, -1)}$`).join(', ')}.`,
          `So step ${pool.indexOf(target) + 1}, with $\\Delta_{${pool.indexOf(target) + 1}} = ${num(target)}$, ${most ? 'has the smallest decay and forgets the most' : 'has the decay closest to 1 and keeps the most'}.`,
        ],
      };
    },
  },
  {
    id: 'memory',
    make(rng, d) {
      const layers = d < 0.35 ? pick(rng, [12, 24, 32]) : pick(rng, [24, 32, 48, 64]);
      if (d < 0.35) {
        const S = pick(rng, [50_000, 100_000, 125_000, 250_000]);
        const T = pick(rng, [1000, 4000, 8000, 100_000]);
        const v = clean((layers * S * 2) / 1e6);
        return {
          prompt: `A state space model has ${layers} layers, and each layer keeps a state of ${commas(S)} numbers, stored in 2 bytes each. How many MB does its state take while generating with ${commas(T)} tokens of context?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: v * T, why: `That grows the state with the tokens. The state is a fixed set of numbers per layer, the same at ${commas(T)} tokens as at one.` },
            { value: v / 2, why: 'That counts numbers, not bytes. Each number takes 2 bytes.' },
            { value: v / layers, why: `That is one layer's state. Each of the ${layers} layers keeps its own.` },
            { value: v * 2, why: 'That doubles it, as a KV cache doubles for keys and values. The state is one set of numbers per layer.' },
          ]),
          solution: [
            `The state is a fixed ${commas(S)} numbers per layer, whatever the length.`,
            `$${layers} \\times ${big(S)} \\times 2 = ${big(layers * S * 2)}$ bytes.`,
            `A megabyte is a million bytes: $${num(v)}$ MB, at ${commas(T)} tokens or at any other length.`,
          ],
        };
      }
      for (;;) {
        const width = pick(rng, [1000, 2000, 4000, 8000]);
        const N = 16;
        const ch = 2 * width;
        const S = d >= 0.7 ? ch * N : pick(rng, [64_000, 100_000, 128_000, 256_000]);
        const T = pick(rng, [2000, 4000, 8000, 16_000, 32_000, 100_000]);
        const bytes = 2;
        const r = (2 * T * width) / S;
        if (r !== round(r, 1) || r < 2) continue;
        const v = clean(r);
        const stateText = d >= 0.7 ? `a state of shape $(${big(ch)}, ${N})$ per layer` : `a state of ${commas(S)} numbers per layer`;
        return {
          prompt: `A transformer and a state space model each have ${layers} layers and store each number in ${bytes} bytes. The transformer has width $d = ${big(width)}$ and keeps a KV cache; the state space model keeps ${stateText}. With ${commas(T)} tokens of context, how many times as much memory does the KV cache take as the state?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: v / 2, why: 'That counts one vector per token per layer. The cache keeps two: a key and a value.' },
            { value: (2 * width) / S, why: `That is one token's cache against the state. The cache holds all ${commas(T)} tokens.` },
            { value: S / (2 * T * width), why: 'That is the state over the cache, upside down.' },
            { value: v * layers, why: 'That counts the layers for the cache only. Both models keep their memory at every layer, so the layers cancel.' },
          ]),
          solution: [
            `Per layer, the cache holds $2 \\times \\text{tokens} \\times d = 2 \\times ${big(T)} \\times ${big(width)} = ${big(2 * T * width)}$ numbers.`,
            ...(d >= 0.7 ? [`Per layer, the state holds $${big(ch)} \\times ${N} = ${big(S)}$ numbers.`] : [`Per layer, the state holds ${commas(S)} numbers, at any length.`]),
            `The layers and the bytes per number are the same for both, so they cancel: $${big(2 * T * width)} / ${big(S)} = ${big(v)}$.`,
          ],
        };
      }
    },
  },
  {
    id: 'grow',
    make(rng) {
      const T1 = pick(rng, [1000, 2000, 4000, 8000]);
      const f = pick(rng, [2, 3, 4, 10]);
      const T2 = T1 * f;
      return {
        prompt: `A transformer with a KV cache and a state space model of the same depth generate text. Their context grows from ${commas(T1)} to ${commas(T2)} tokens. What happens to the memory each one keeps?`,
        answer: choice([
          { text: `The cache grows ${f} times; the state stays the same size`, why: null },
          { text: `The cache and the state both grow ${f} times`, why: 'The state is a fixed set of numbers per layer, updated in place at every token. It never grows with the length.' },
          { text: `The cache stays the same size; the state grows ${f} times`, why: 'That swaps them. The cache adds a key and a value for every token; the state is updated in place.' },
          { text: `The cache grows ${f * f} times; the state stays the same size`, why: `The cache keeps one key and one value per token, so it grows in proportion to the tokens: ${f} times, not ${f} squared.` },
        ]),
        solution: [
          'The KV cache keeps a key and a value for every token, at every layer: it grows in proportion to the tokens.',
          `So ${f} times the tokens is ${f} times the cache.`,
          'The state space model keeps one fixed-size state per layer and updates it in place, so its memory does not change.',
        ],
      };
    },
  },
];

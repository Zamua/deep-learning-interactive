import type { Rng } from '../../../../core/rand';
import type { Generator } from '../../../../mastery/domain/types';
import { choice } from '../../inference/kit';
import { clean, dot, int, mat, num, par, pick, traps, vec, vtraps } from '../../kit';
import { AXES, diffTex, minus, mix, pair, read, readTex, same, scaled, SLANTS, state, stateTex, step } from '../kit';

const GATES = [0.5, 0.25, 0.75, 0.8, 0.9];

/** A memory and one gated write: axis keys and β = 1 first, slanted keys and partial writes later. */
function setup(rng: Rng, d: number) {
  for (;;) {
    const S = state(rng, d < 0.35 ? 0 : -2, 5);
    const k = d < 0.7 ? pick(rng, AXES) : pick(rng, SLANTS);
    const v = pair(rng, d < 0.35 ? 0 : -2, 6);
    const alpha = d < 0.35 ? 0.5 : pick(rng, GATES);
    const beta = d < 0.35 ? 1 : pick(rng, [1, 0.5]);
    const faded = read(scaled(alpha, S), k);
    if (!same(faded, v)) return { S, k, v, alpha, beta, faded, after: step(S, k, v, beta, alpha) };
  }
}

type Setup = ReturnType<typeof setup>;
const ab = (o: Setup) => `$\\sym{alpha}{\\alpha} = ${num(o.alpha)}$ and $\\sym{beta}{\\beta} = ${num(o.beta)}$`;
const given = (o: Setup) => `A Gated DeltaNet memory holds ${stateTex(o.S)}. A token arrives with ${ab(o)}, the key $\\sym{k}{k} = ${vec(o.k)}$, of length one, and the value $\\sym{v}{v} = ${vec(o.v)}$`;
const rule = '$\\sym{S}{S} \\leftarrow \\sym{alpha}{\\alpha}\\sym{S}{S} + \\sym{beta}{\\beta}(\\sym{v}{v} - \\sym{alpha}{\\alpha}\\sym{S}{S}\\sym{k}{k})\\,\\sym{k}{k}^\\top$: fade the whole state by $\\sym{alpha}{\\alpha}$, then write the delta rule\'s difference at $\\sym{k}{k}$.';

export const generators: Generator[] = [
  {
    id: 'step',
    make(rng, d) {
      const o = setup(rng, d);
      const r = read(o.after, o.k);
      const old = read(o.S, o.k);
      const diff = minus(o.v, o.faded);
      return {
        prompt: `${given(o)}. After this step, what does the memory read at $\\sym{k}{k}$?`,
        answer: { kind: 'vector', value: r },
        traps: vtraps(r, [
          { value: mix(1 - o.beta, old, o.beta, o.v), why: 'That skips the fade: the plain delta rule. Gated DeltaNet first multiplies the whole state by $\\sym{alpha}{\\alpha}$, then reads and corrects.' },
          { value: mix(o.alpha * (1 - o.beta), old, o.alpha * o.beta, o.v), why: 'That fades after writing. The fade comes first, so the value just written is kept in full.' },
          { value: o.faded.map((x, i) => clean(x + o.v[i]!)), why: 'That is Mamba2\'s rule, $a\\sym{S}{S} + \\sym{v}{v}\\sym{k}{k}^\\top$: it adds the new value on top of the faded old one. The delta rule writes only the difference.' },
          { value: o.faded, why: 'That is the faded state\'s read before the write. The write then moves it toward $\\sym{v}{v}$.' },
        ]),
        solution: [
          rule,
          `Faded: $\\sym{alpha}{\\alpha}\\sym{S}{S} = ${mat(scaled(o.alpha, o.S))}$, which reads $${readTex(scaled(o.alpha, o.S), o.k)}$ at $\\sym{k}{k}$.`,
          `The difference: $${diffTex(o.v, o.faded)}$.`,
          `Read at $\\sym{k}{k}$, the write adds $\\sym{beta}{\\beta}$ times it, times $\\sym{k}{k} \\cdot \\sym{k}{k} = 1$: $${vec(o.faded)} + ${num(o.beta)} \\times ${vec(diff)} = ${vec(r)}$.`,
        ],
      };
    },
  },
  {
    id: 'other',
    make(rng, d) {
      const o = setup(rng, d);
      const slant = d >= 0.7;
      const kp = slant ? pick(rng, SLANTS.filter((s) => !same(s, o.k) && Math.abs(dot(s, o.k)) > 1e-9)) : [o.k[1]!, o.k[0]!];
      const r = read(o.after, kp);
      const c = dot(o.k, kp);
      const diff = minus(o.v, o.faded);
      return {
        prompt: `${given(o)}. After this step, what does the memory read at the key $\\sym{k}{k}' = ${vec(kp)}$${slant ? '' : ', at a right angle to $\\sym{k}{k}$'}?`,
        answer: { kind: 'vector', value: r },
        traps: vtraps(r, [
          { value: read(o.S, kp), why: `That forgets the fade. Every pair in the state is multiplied by $\\sym{alpha}{\\alpha} = ${num(o.alpha)}$, written or not.` },
          ...(slant ? [{ value: read(scaled(o.alpha, o.S), kp), why: `That leaves out the write. $\\sym{k}{k}'$ is not at a right angle to $\\sym{k}{k}$: $\\sym{k}{k} \\cdot \\sym{k}{k}' = ${num(c)}$, so it gets that share of the change.` }] : []),
          { value: mix(1 - o.beta, read(scaled(o.alpha, o.S), kp), o.beta, o.v), why: 'That writes the new value at this key. The write goes along $\\sym{k}{k}$, and reaches $\\sym{k}{k}\'$ only through their dot product.' },
          { value: o.v, why: 'That is the new value, which was written at $\\sym{k}{k}$.' },
        ]),
        solution: [
          rule,
          `The fade multiplies everything by $${num(o.alpha)}$: $\\sym{alpha}{\\alpha}\\sym{S}{S}\\sym{k}{k}' = ${readTex(scaled(o.alpha, o.S), kp)}$.`,
          slant
            ? `The write adds $\\sym{beta}{\\beta}$ times the difference $${vec(diff)}$, times $\\sym{k}{k} \\cdot \\sym{k}{k}' = ${num(c)}$: $${vec(read(scaled(o.alpha, o.S), kp))} + ${par(clean(o.beta * c))} \\times ${vec(diff)} = ${vec(r)}$.`
            : `The write goes along $\\sym{k}{k}$, and $\\sym{k}{k} \\cdot \\sym{k}{k}' = 0$, so it adds nothing here: the read is $${vec(r)}$, faded by $\\sym{alpha}{\\alpha}$.`,
        ],
      };
    },
  },
  {
    id: 'fade',
    make(rng, d) {
      for (;;) {
        const n = d < 0.35 ? 2 : d < 0.7 ? 3 : pick(rng, [3, 4]);
        const gates = Array.from({ length: n }, () => pick(rng, d < 0.35 ? [0.5, 0.25] : GATES));
        const x = int(rng, 2, 8);
        const p = gates.reduce((a, g) => a * g, 1);
        const v = clean(x * p);
        if (Math.abs(v * 1e4 - Math.round(v * 1e4)) > 1e-6) continue;
        const list = gates.map((g, i) => `$\\sym{alpha}{\\alpha}_{${i + 1}} = ${num(g)}$`).join(', ');
        return {
          prompt: `In a Gated DeltaNet memory, the key $\\sym{k}{k}$ reads a value whose first entry is ${x}. The next ${n} tokens write only at keys at a right angle to $\\sym{k}{k}$, with gates ${list}. What is the first entry of the read at $\\sym{k}{k}$ afterward?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: x, why: 'That forgets the gates. Every token fades the whole state, written there or not.' },
            { value: clean(x * gates[n - 1]!), why: 'That uses only the last gate. Each of the tokens fades the state again.' },
            { value: clean(x * gates.reduce((a, g) => a + g, 0)), why: 'That adds the gates. Each fade multiplies what the last one left.' },
            { value: clean(x * gates.reduce((a, g) => a * (1 - g), 1)), why: `That multiplies by $1 - \\sym{alpha}{\\alpha}$. The gate is the share kept: $\\sym{alpha}{\\alpha} = ${num(gates[0]!)}$ keeps ${num(gates[0]!)} of the state.` },
          ]),
          solution: [
            'Each token first multiplies the whole state by its gate. The writes go along keys at a right angle to $\\sym{k}{k}$, so they add nothing to the read at $\\sym{k}{k}$.',
            `So the entry is multiplied by every gate in turn: $${x} \\times ${gates.map((g) => num(g)).join(' \\times ')} = ${num(v)}$.`,
          ],
        };
      }
    },
  },
  {
    id: 'limits',
    make(rng, d) {
      const k = d < 0.5 ? pick(rng, AXES) : pick(rng, [...AXES, ...SLANTS]);
      const v = pair(rng, 1, 6);
      const kind = rng.int(4);
      const alpha = [0, 1, 1, pick(rng, [0.5, 0.25])][kind]!;
      const beta = [1, 1, 0, 0][kind]!;
      const S = state(rng, 1, 5);
      const share = kind === 3 ? alpha : 0.5;
      const opts = [
        { text: 'The old memory is wiped, and the state holds only the new pair', why: 'That needs $\\sym{alpha}{\\alpha} = 0$, which keeps none of the old state, and a write.' },
        { text: 'The value at the key is replaced, and every other pair stays as it was', why: 'That is the plain delta rule: $\\sym{alpha}{\\alpha} = 1$, keeping the whole state, with $\\sym{beta}{\\beta} = 1$.' },
        { text: 'Nothing changes', why: 'That needs $\\sym{alpha}{\\alpha} = 1$, keeping everything, and $\\sym{beta}{\\beta} = 0$, writing nothing.' },
        { text: `Every pair fades to ${num(share)} of itself, and nothing is written`, why: 'That needs a gate below 1 with $\\sym{beta}{\\beta} = 0$.' },
      ];
      const whyHere = [
        `With $\\sym{alpha}{\\alpha} = 0$, the fade leaves zeros; the delta rule then reads $[0,\\ 0]$ and writes all of $\\sym{v}{v}$: $\\sym{S}{S} = \\sym{v}{v}\\sym{k}{k}^\\top$.`,
        'With $\\sym{alpha}{\\alpha} = 1$ nothing fades, and $\\sym{beta}{\\beta} = 1$ moves the read at $\\sym{k}{k}$ all the way to $\\sym{v}{v}$; keys at a right angle are left alone.',
        'With $\\sym{alpha}{\\alpha} = 1$ nothing fades, and $\\sym{beta}{\\beta} = 0$ writes nothing.',
        `With $\\sym{alpha}{\\alpha} = ${num(alpha)}$ every pair is multiplied by ${num(alpha)}, and $\\sym{beta}{\\beta} = 0$ writes nothing.`,
      ][kind]!;
      return {
        prompt: `A Gated DeltaNet memory holds ${stateTex(S)}. A token arrives with the key $\\sym{k}{k} = ${vec(k)}$, of length one, the value $\\sym{v}{v} = ${vec(v)}$, $\\sym{alpha}{\\alpha} = ${num(alpha)}$ and $\\sym{beta}{\\beta} = ${num(beta)}$. What does this step do?`,
        answer: choice(opts.map((o, i) => ({ text: o.text, why: i === kind ? null : o.why }))),
        solution: [rule, whyHere],
      };
    },
  },
];

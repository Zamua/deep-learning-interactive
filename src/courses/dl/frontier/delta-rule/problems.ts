import type { Rng } from '../../../../core/rand';
import type { Generator } from '../../../../mastery/domain/types';
import { choice } from '../../inference/kit';
import { clean, num, par, pick, traps, vec, vtraps } from '../../kit';
import { AXES, CORNER, diffTex, minus, mix, pair, read, readTex, same, SLANTS, state, stateTex, step } from '../kit';

/** A memory, a key of length one, a new value and a write strength: axes and β = 1 first, slanted keys and partial writes later. */
function setup(rng: Rng, d: number) {
  for (;;) {
    const S = state(rng, d < 0.35 ? 0 : -2, 5);
    const k = d < 0.7 ? pick(rng, AXES) : pick(rng, SLANTS);
    const v = pair(rng, d < 0.35 ? 0 : -2, 6);
    const beta = d < 0.35 ? 1 : d < 0.7 ? pick(rng, [1, 0.5]) : pick(rng, [1, 0.5, 0.25, 0.75]);
    const old = read(S, k);
    if (!same(old, v)) return { S, k, v, beta, old, delta: minus(v, old) };
  }
}

type Setup = ReturnType<typeof setup>;
const given = (o: Setup) => `A delta-rule memory holds ${stateTex(o.S)}. A token writes the value $\\sym{v}{v} = ${vec(o.v)}$ at the key $\\sym{k}{k} = ${vec(o.k)}$, of length one`;
const betaTex = (b: number) => `$\\sym{beta}{\\beta} = ${num(b)}$`;
const ruleLine = '$\\sym{S}{S} \\leftarrow \\sym{S}{S} + \\sym{beta}{\\beta}(\\sym{v}{v} - \\sym{S}{S}\\sym{k}{k})\\,\\sym{k}{k}^\\top$: read the old value at $\\sym{k}{k}$, and write $\\sym{beta}{\\beta}$ times the difference.';

export const generators: Generator[] = [
  {
    id: 'delta',
    make(rng, d) {
      const o = setup(rng, d);
      const sk = read(o.S, o.k);
      const skT = read([[o.S[0]![0]!, o.S[1]![0]!], [o.S[0]![1]!, o.S[1]![1]!]], o.k);
      return {
        prompt: `${given(o)}. What is the delta, $\\sym{v}{v} - \\sym{S}{S}\\sym{k}{k}$?`,
        answer: { kind: 'vector', value: o.delta },
        traps: vtraps(o.delta, [
          { value: minus(sk, o.v), why: 'That is the old value minus the new one: the sign is flipped. The delta is what must be added to the old value to reach $\\sym{v}{v}$.' },
          { value: sk, why: 'That is $\\sym{S}{S}\\sym{k}{k}$ alone, the value the memory holds now. The delta subtracts it from $\\sym{v}{v}$.' },
          { value: minus(o.v, skT), why: 'That dots each column of $\\sym{S}{S}$ with $\\sym{k}{k}$. $\\sym{S}{S}\\sym{k}{k}$ dots each row with it.' },
          { value: minus(o.v, o.k), why: 'That subtracts the key. The delta subtracts the value the memory reads at the key, $\\sym{S}{S}\\sym{k}{k}$.' },
        ]),
        solution: [
          `Read the old value at the key: $\\sym{S}{S}\\sym{k}{k} = ${readTex(o.S, o.k)}$.`,
          `The delta: $${diffTex(o.v, sk)}$.`,
        ],
      };
    },
  },
  {
    id: 'read',
    make(rng, d) {
      const o = setup(rng, d);
      const after = step(o.S, o.k, o.v, o.beta);
      const other = d >= 0.35 && rng.int(3) === 0;
      if (other) {
        const kp = [-o.k[1]!, o.k[0]!];
        const r = read(after, kp);
        return {
          prompt: `${given(o)}, with ${betaTex(o.beta)}. Afterward, what does the memory read at $\\sym{k}{k}' = ${vec(kp)}$, at a right angle to $\\sym{k}{k}$?`,
          answer: { kind: 'vector', value: r },
          traps: vtraps(r, [
            { value: mix(1 - o.beta, read(o.S, kp), o.beta, o.v), why: 'That writes the new value at this key too. A write along $\\sym{k}{k}$ changes the read at another key by the change times their dot product, which is 0 here.' },
            { value: mix(1 - o.beta, o.old, o.beta, o.v), why: 'That is the read at $\\sym{k}{k}$ itself. This key is at a right angle to it, so the write leaves it alone.' },
            { value: o.v, why: 'That is the new value, which was written at $\\sym{k}{k}$. A key at a right angle reads what it read before.' },
            { value: o.old, why: 'That is what $\\sym{k}{k}$ read before the write. Read at $\\sym{k}{k}\'$ instead: dot each row of $\\sym{S}{S}$ with it.' },
          ]),
          solution: [
            ruleLine,
            `The write adds $\\sym{beta}{\\beta}$ times the delta, times $\\sym{k}{k}^\\top$. Read at $\\sym{k}{k}'$, that part is multiplied by $\\sym{k}{k} \\cdot \\sym{k}{k}' = 0$.`,
            `So the read is unchanged: $\\sym{S}{S}\\sym{k}{k}' = ${readTex(o.S, kp)}$.`,
          ],
        };
      }
      const r = read(after, o.k);
      const ts = [
        { value: o.old.map((x, i) => clean(x + o.v[i]!)), why: 'That adds the new value on top of the old, as linear attention does. The delta rule writes only the difference, so the read moves toward $\\sym{v}{v}$ instead.' },
        { value: mix(o.beta, o.old, 1 - o.beta, o.v), why: `That swaps the weights. $\\sym{beta}{\\beta} = ${num(o.beta)}$ is the share of the new value: the read is $(1 - \\sym{beta}{\\beta})$ times the old plus $\\sym{beta}{\\beta}$ times the new.` },
        { value: o.v, why: `That replaces the value fully, as $\\sym{beta}{\\beta} = 1$ would. With $\\sym{beta}{\\beta} = ${num(o.beta)}$, the read moves only that share of the way.` },
        { value: o.old, why: 'That is the read before the write. The write moves it toward $\\sym{v}{v}$.' },
        { value: o.delta.map((x) => clean(o.beta * x)), why: 'That is the change written, $\\sym{beta}{\\beta}$ times the delta. The read is the old value plus that change.' },
      ];
      return {
        prompt: `${given(o)}, with ${betaTex(o.beta)}. Afterward, what does the memory read at $\\sym{k}{k}$?`,
        answer: { kind: 'vector', value: r },
        traps: vtraps(r, ts),
        solution: [
          ruleLine,
          `The old value: $\\sym{S}{S}\\sym{k}{k} = ${readTex(o.S, o.k)}$; the delta: $${diffTex(o.v, o.old)}$.`,
          `Read at $\\sym{k}{k}$, the write adds $\\sym{beta}{\\beta}$ times the delta, times $\\sym{k}{k} \\cdot \\sym{k}{k} = 1$: $${vec(o.old)} + ${num(o.beta)} \\times ${vec(o.delta)} = ${vec(r)}$.`,
        ],
      };
    },
  },
  {
    id: 'entry',
    make(rng, d) {
      const o = setup(rng, d);
      const after = step(o.S, o.k, o.v, o.beta);
      const i = rng.int(2);
      const j = d < 0.35 ? o.k.indexOf(1) : rng.int(2);
      const val = after[i]![j]!;
      const s0 = o.S[i]![j]!;
      return {
        prompt: `${given(o)}, with ${betaTex(o.beta)}. Afterward, what is the ${CORNER[i]![j]} entry of $\\sym{S}{S}$?`,
        answer: { kind: 'number', value: val },
        traps: traps(val, [
          { value: s0 + o.beta * o.v[i]! * o.k[j]!, why: 'That writes the new value itself, as linear attention does. The delta rule writes the difference $\\sym{v}{v} - \\sym{S}{S}\\sym{k}{k}$.' },
          { value: s0 + o.delta[i]! * o.k[j]!, why: `That leaves out $\\sym{beta}{\\beta} = ${num(o.beta)}$, which scales the difference before it is written.` },
          ...(i !== j ? [{ value: s0 + o.beta * o.delta[j]! * o.k[i]!, why: 'That builds the table the wrong way round. Row $i$, column $j$ of $(\\sym{v}{v} - \\sym{S}{S}\\sym{k}{k})\\,\\sym{k}{k}^\\top$ is entry $i$ of the delta times entry $j$ of $\\sym{k}{k}$.' }] : []),
          { value: o.beta * o.delta[i]! * o.k[j]!, why: 'That is the change alone. Add it to the entry already there.' },
          { value: s0, why: 'That is the entry before the write.' },
        ]),
        solution: [
          ruleLine,
          `The delta: $${diffTex(o.v, o.old)}$, since $\\sym{S}{S}\\sym{k}{k} = ${readTex(o.S, o.k)}$.`,
          `Row ${i + 1}, column ${j + 1} changes by $\\sym{beta}{\\beta}$, times the delta's entry ${i + 1}, times $\\sym{k}{k}$'s entry ${j + 1}: $${num(o.beta)} \\times ${par(o.delta[i]!)} \\times ${par(o.k[j]!)} = ${num(clean(o.beta * o.delta[i]! * o.k[j]!))}$.`,
          `So $${num(s0)} + ${par(clean(o.beta * o.delta[i]! * o.k[j]!))} = ${num(val)}$.`,
        ],
      };
    },
  },
  {
    id: 'compare',
    make(rng, d) {
      for (;;) {
        const k = d < 0.5 ? pick(rng, AXES) : pick(rng, [...AXES, ...SLANTS]);
        const u = pair(rng, 1, 5);
        const v = pair(rng, 0, 6);
        if (same(u, v)) continue;
        const both = u.map((x, i) => x + v[i]!);
        const kTex = `$\\sym{k}{k} = ${vec(k)}$`;
        return {
          prompt: `Two memories both read $${vec(u)}$ at the key ${kTex}, of length one. Each takes one write of the value $\\sym{v}{v} = ${vec(v)}$ at ${kTex}: one by linear attention, adding $\\sym{v}{v}\\sym{k}{k}^\\top$, the other by the delta rule with $\\sym{beta}{\\beta} = 1$. What does each read at ${kTex} afterward?`,
          answer: choice([
            { text: `Linear attention $${vec(both)}$; the delta rule $${vec(v)}$`, why: null },
            { text: `Linear attention $${vec(v)}$; the delta rule $${vec(both)}$`, why: 'That swaps them. Linear attention adds the whole new table on top of the old; the delta rule writes only the difference, so the new value replaces the old.' },
            { text: `Both read $${vec(v)}$`, why: 'Linear attention never subtracts what is there: its read is the old value plus the new one.' },
            { text: `Both read $${vec(both)}$`, why: 'The delta rule first reads the old value and writes only the difference, so with $\\sym{beta}{\\beta} = 1$ the read lands exactly on $\\sym{v}{v}$.' },
          ]),
          solution: [
            `Linear attention adds $\\sym{v}{v}\\sym{k}{k}^\\top$; read at $\\sym{k}{k}$, that adds $\\sym{v}{v}$ times $\\sym{k}{k} \\cdot \\sym{k}{k} = 1$: $${vec(u)} + ${vec(v)} = ${vec(both)}$.`,
            `The delta rule adds $(\\sym{v}{v} - ${vec(u)})\\,\\sym{k}{k}^\\top$, so the read becomes $${vec(u)} + (${vec(v)} - ${vec(u)}) = ${vec(v)}$.`,
          ],
        };
      }
    },
  },
];

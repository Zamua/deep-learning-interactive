import type { Rng } from '../../../core/rand';
import type { Generator } from '../../../mastery/domain/types';
import { clean, int, num, par, pick, traps, vec, vtraps } from '../../kit';
import { T2, useTanh } from '../kit';

const GATE_EASY = [0.5, 1];
const GATE = [0.1, 0.2, 0.5, 0.8, 0.9];
const CAND_EASY = [1, -1];
const CAND = [-1, -0.5, 0.5, 1];

/** Gates, candidate and old cell for one unit, harder with difficulty. */
function unit(rng: Rng, d: number) {
  const easy = d < 0.25;
  return {
    c: easy ? int(rng, 1, 4) : int(rng, -3, 4),
    f: pick(rng, easy ? GATE_EASY : GATE),
    i: pick(rng, easy ? GATE_EASY : GATE),
    o: pick(rng, GATE),
    g: pick(rng, easy ? CAND_EASY : CAND),
  };
}

const cell = (u: { c: number; f: number; i: number; g: number }): number => clean(u.f * u.c + u.i * u.g);
const sci = (x: number): string => {
  if (x >= 0.01) return num(Number(x.toPrecision(2)));
  const e = Math.floor(Math.log10(x));
  return `${num(Number((x / 10 ** e).toPrecision(2)))} \\times 10^{${e}}`;
};

export const generators: Generator[] = [
  {
    id: 'cell',
    make(rng, d) {
      if (d < 0.5) {
        const u = unit(rng, d);
        const v = cell(u);
        return {
          prompt: `An LSTM unit's old cell state is $c_{t-1} = ${u.c}$. Its forget gate is $f_t = ${num(u.f)}$, its input gate $i_t = ${num(u.i)}$, and the candidate $g_t = ${num(u.g)}$. What is the new cell state $c_t$?`,
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            { value: u.f * u.c + u.g, why: 'That adds the whole candidate. The input gate scales it first: $i_t\\, g_t$.' },
            { value: u.f * u.c + u.i, why: 'That adds the input gate itself. It is a fraction that scales the candidate: add $i_t\\, g_t$.' },
            { value: u.c + u.i * u.g, why: 'That keeps all of the old cell. The forget gate scales it first: $f_t\\, c_{t-1}$.' },
            { value: u.f * u.c, why: 'That only keeps part of the old cell. The new content, $i_t\\, g_t$, is added to it.' },
          ]),
          solution: [
            'The update is $c_t = f_t\\, c_{t-1} + i_t\\, g_t$.',
            `Keep part of the old cell: $f_t\\, c_{t-1} = ${num(u.f)} \\times ${par(u.c)} = ${num(clean(u.f * u.c))}$.`,
            `Write part of the candidate: $i_t\\, g_t = ${num(u.i)} \\times ${par(u.g)} = ${num(clean(u.i * u.g))}$.`,
            `Add them: $c_t = ${num(clean(u.f * u.c))} + ${par(clean(u.i * u.g))} = ${num(v)}$.`,
          ],
        };
      }
      const us = [unit(rng, d), unit(rng, d)];
      const v = us.map(cell);
      const col = (k: 'c' | 'f' | 'i' | 'o' | 'g') => vec(us.map((u) => u[k]));
      return {
        prompt: `An LSTM layer with two units has the old cell state $c_{t-1} = ${col('c')}$. Its gates are $f_t = ${col('f')}$, $i_t = ${col('i')}$, $o_t = ${col('o')}$, and the candidate is $g_t = ${col('g')}$. What is the new cell state $c_t$?`,
        answer: { kind: 'vector', value: v },
        traps: vtraps(v, [
          { value: us.map((u) => u.o * u.c + u.i * u.g), why: 'That scales the old cell by the output gate. The forget gate decides what to keep: $f_t\\, c_{t-1}$.' },
          { value: us.map((u) => u.f * u.c + u.g), why: 'That adds the whole candidate. The input gate scales it first: $i_t\\, g_t$.' },
          { value: us.map((u) => u.c + u.i * u.g), why: 'That keeps all of the old cell. The forget gate scales it first: $f_t\\, c_{t-1}$.' },
        ]),
        solution: [
          'The update is $c_t = f_t\\, c_{t-1} + i_t\\, g_t$, multiplying entry by entry; $o_t$ only matters for $\\symh_t$.',
          ...us.map((u, k) => `Unit ${k}: $${num(u.f)} \\times ${par(u.c)} + ${num(u.i)} \\times ${par(u.g)} = ${num(v[k]!)}$.`),
          `So $c_t = ${vec(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'gates',
    make(rng, d) {
      const options = ['The forget gate $f_t$', 'The input gate $i_t$', 'The output gate $o_t$', 'The candidate $g_t$'];
      const does = [
        'The forget gate scales the old cell state: $f_t\\, c_{t-1}$.',
        'The input gate scales the candidate before it is added: $i_t\\, g_t$.',
        'The output gate scales what leaves the cell: $\\symh_t = o_t \\tanh(c_t)$.',
        'The candidate is the new content itself, from a tanh; the gates decide how much of it counts.',
      ];
      if (d < 0.5 || rng.int(2) === 0) {
        const roles = [
          'how much of the old cell state $c_{t-1}$ to keep',
          'how much of the new candidate to write into the cell',
          'how much of the cell to show as the hidden state $\\symh_t$',
          'what new content, between $-1$ and $1$, could be written',
        ];
        const k = rng.int(4);
        const H = pick(rng, [1, 64, 128, 256, 512]);
        return {
          prompt: `In an LSTM ${H === 1 ? 'cell with one unit' : `layer with $\\symH = ${H}$ units`}, which part decides ${roles[k]}?`,
          answer: { kind: 'choice', options, correct: k, why: does.map((w, j) => (j === k ? null : w)) },
          solution: [
            'Three gates, each a sigmoid between 0 and 1, scale three things; the candidate $g_t$, a tanh, is the content.',
            '$c_t = f_t\\, c_{t-1} + i_t\\, g_t$ and $\\symh_t = o_t \\tanh(c_t)$.',
            does[k]!,
          ],
        };
      }
      const keep = rng.int(2) === 0;
      const write = rng.int(2) === 0;
      const hi = [0.9, 0.95, 0.97, 0.99];
      const lo = [0.01, 0.02, 0.05, 0.1];
      const f = pick(rng, keep ? hi : lo);
      const i = pick(rng, write ? hi : lo);
      const acts: [boolean, boolean][] = [[true, false], [false, true], [true, true], [false, false]];
      const correct = acts.findIndex(([k, w]) => k === keep && w === write);
      const fNote = `$f_t = ${num(f)}$ is near ${keep ? '1, so the cell keeps' : '0, so the cell erases'} $c_{t-1}$`;
      const iNote = `$i_t = ${num(i)}$ is near ${write ? '1, so the candidate is written in' : '0, so almost none of the candidate gets in'}`;
      return {
        prompt: `At one step, an LSTM unit's forget gate is $f_t = ${num(f)}$ and its input gate is $i_t = ${num(i)}$. What is its cell doing?`,
        answer: {
          kind: 'choice',
          options: ['Keeping its memory and ignoring the new input', 'Erasing its memory and writing the new input', 'Keeping its memory and adding the new input', 'Erasing its memory and writing almost nothing'],
          correct,
          why: acts.map(([k, w], j) => (j === correct ? null : `${[k !== keep ? fNote : '', w !== write ? iNote : ''].filter(Boolean).join('; ')}.`)),
        },
        solution: [`$c_t = f_t\\, c_{t-1} + i_t\\, g_t$: the forget gate scales the old memory, the input gate the new content.`, `${fNote}.`, `${iNote}.`],
      };
    },
  },
  {
    id: 'gradient-path',
    make(rng) {
      const f = pick(rng, [0.95, 0.97, 0.98, 0.99]);
      const n = pick(rng, [20, 30, 50]);
      const a = pick(rng, [0.5, 0.6, 0.7]);
      return {
        prompt: `An LSTM's forget gate stays near $f = ${num(f)}$ for ${n} steps. Why does its cell state still get a useful gradient from ${n} steps back, where a plain RNN's gradient would have vanished?`,
        answer: {
          kind: 'choice',
          options: [
            `Each step back along the cell multiplies it by $f = ${num(f)}$ alone, with no weight matrix`,
            'The sigmoid gates have steep slopes that boost the gradient at every step',
            'Gradient clipping rescales the small gradient back up to a useful size',
            'The output gate sends the gradient from the last step straight to the first',
          ],
          correct: 0,
          why: [
            null,
            'A sigmoid\'s slope is at most $0.25$: the gates never boost a gradient.',
            'Clipping only shrinks gradients that are too large; it cannot rescue one that has vanished.',
            'The output gate only scales what the cell shows as $\\symh_t$ at its own step. The long path back runs along $c$.',
          ],
        },
        solution: [
          '$c_t = f_t\\, c_{t-1} + i_t\\, g_t$, so one step back along the cell, $\\partial c_t / \\partial c_{t-1} = f_t$.',
          `Over ${n} steps: $${num(f)}^{${n}} \\approx ${sci(f ** n)}$. A plain RNN that multiplies by about $${num(a)}$ per step keeps $${num(a)}^{${n}} \\approx ${sci(a ** n)}$.`,
          'The cell is updated by addition, not squashed through a weight matrix, so a forget gate held near 1 keeps both the memory and its gradient.',
        ],
      };
    },
  },
  {
    id: 'hidden',
    make(rng, d) {
      const o = pick(rng, d < 0.25 ? [0.5, 1] : [0.2, 0.5, 0.8, 0.9]);
      if (d < 0.4) {
        const c = pick(rng, [-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2]);
        const decoy = pick(rng, [-2, -1, 0.5, 1, 1.5, 2].filter((x) => Math.abs(x) !== Math.abs(c)));
        const v = clean(o * T2(c));
        return {
          prompt: `An LSTM unit's new cell state is $c_t = ${num(c)}$ and its output gate is $o_t = ${num(o)}$. What is its hidden state $\\symh_t$? Round to two decimals. Use ${useTanh([c, decoy])}.`,
          answer: { kind: 'number', value: v, places: 2 },
          traps: traps(v, [
            { value: o * c, why: 'That scales the cell itself. The cell goes through tanh first: $\\symh_t = o_t \\tanh(c_t)$.' },
            { value: T2(c), why: 'That is $\\tanh(c_t)$ in full. The output gate scales it: $\\symh_t = o_t \\tanh(c_t)$.' },
          ]).filter((t) => Math.abs(t.value - v) >= 0.01),
          solution: [`Squash the cell: $\\tanh(${num(c)}) \\approx ${num(T2(c), 2)}$.`, `Scale by the output gate: $\\symh_t = ${num(o)} \\times ${par(T2(c))} \\approx ${num(v, 2)}$.`],
        };
      }
      for (;;) {
        const u = { ...unit(rng, d), o };
        const c = cell(u);
        if (Math.abs(c) < 0.3 || Math.abs(c) === Math.abs(u.c) || u.c === 0) continue;
        const decoy = clean(c + pick(rng, [-0.6, 0.4, 1]));
        if (Math.abs(decoy) < 0.3 || Math.abs(decoy) === Math.abs(u.c)) continue;
        const v = clean(o * T2(c));
        return {
          prompt: `An LSTM unit has the old cell state $c_{t-1} = ${u.c}$, gates $f_t = ${num(u.f)}$, $i_t = ${num(u.i)}$, $o_t = ${num(o)}$, and candidate $g_t = ${num(u.g)}$. What is its new hidden state $\\symh_t$? Round to two decimals. Use ${useTanh([c, u.c, decoy])}.`,
          answer: { kind: 'number', value: v, places: 2 },
          traps: traps(v, [
            { value: o * c, why: 'That scales the cell itself. The cell goes through tanh first: $\\symh_t = o_t \\tanh(c_t)$.' },
            { value: T2(c), why: 'That leaves out the output gate: $\\symh_t = o_t \\tanh(c_t)$.' },
            { value: o * T2(u.c), why: 'That uses the old cell. Update the cell first, then read $\\symh_t$ from the new one.' },
          ]).filter((t) => Math.abs(t.value - v) >= 0.01),
          solution: [
            `Update the cell: $c_t = ${num(u.f)} \\times ${par(u.c)} + ${num(u.i)} \\times ${par(u.g)} = ${num(c)}$.`,
            `Squash it: $\\tanh(${num(c)}) \\approx ${num(T2(c), 2)}$.`,
            `Scale by the output gate: $\\symh_t = ${num(o)} \\times ${par(T2(c))} \\approx ${num(v, 2)}$.`,
          ],
        };
      }
    },
  },
];

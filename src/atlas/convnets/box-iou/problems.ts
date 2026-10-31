import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, num, pick, round, traps } from '../../kit';
import { type Box, area, edges, hull, inter, iou, tex, union } from './box';

type Kind = 'overlap' | 'nested' | 'apart';

/** A box with corners on a grid of `step`, `lo` to `hi` steps wide and tall. */
function box(rng: Rng, max: number, lo: number, hi: number, step: number): Box {
  const w = int(rng, lo, hi);
  const h = int(rng, lo, hi);
  const x = int(rng, 0, max - w);
  const y = int(rng, 0, max - h);
  return [x * step, y * step, (x + w) * step, (y + h) * step];
}

/** Two boxes in the given relation, small whole numbers first, then pixel-sized ones. */
function pair(rng: Rng, d: number, kind: Kind): [Box, Box] {
  const step = d < 0.7 ? 1 : pick(rng, [5, 10]);
  const max = d < 0.35 ? 8 : 10;
  for (;;) {
    const a = box(rng, max, 2, d < 0.35 ? 5 : 6, step);
    const b = box(rng, max, 2, d < 0.35 ? 5 : 6, step);
    const e = edges(a, b);
    const inside = (p: Box, q: Box) => p[0] >= q[0] && p[1] >= q[1] && p[2] <= q[2] && p[3] <= q[3];
    const nested = inside(a, b) || inside(b, a);
    const ok =
      kind === 'apart' ? e.r < e.l && e.bt < e.t
      : kind === 'nested' ? nested && area(a) !== area(b)
      : inter(a, b) > 0 && !nested;
    if (ok) return [a, b];
  }
}

function kindFor(rng: Rng, d: number): Kind {
  if (d < 0.35) return 'overlap';
  const r = rng.next();
  if (d >= 0.6 && r < 0.2) return 'apart';
  return r < 0.4 ? 'nested' : 'overlap';
}

/** The working for the overlap, edge by edge. */
function overlapSteps(a: Box, b: Box): string[] {
  const e = edges(a, b);
  const w = e.r - e.l;
  const h = e.bt - e.t;
  const side = (lo: number, hi: number, name: string) => (hi - lo > 0 ? `$${hi} - ${lo} = ${hi - lo}$ ${name}` : `$${hi} - ${lo} = ${hi - lo}$, clamped: $\\max(0, ${hi - lo}) = 0$ ${name}`);
  return [
    `The overlap's left edge is the larger left, $\\max(${a[0]}, ${b[0]}) = ${e.l}$, and its right edge the smaller right, $\\min(${a[2]}, ${b[2]}) = ${e.r}$: ${side(e.l, e.r, 'wide')}.`,
    `Its top is the larger top, $\\max(${a[1]}, ${b[1]}) = ${e.t}$, and its bottom the smaller bottom, $\\min(${a[3]}, ${b[3]}) = ${e.bt}$: ${side(e.t, e.bt, 'tall')}.`,
    w > 0 && h > 0 ? `The intersection is $${w} \\times ${h} = ${w * h}$.` : 'A side came out negative, so the boxes do not overlap: the intersection is $0$.',
  ];
}

const areaStep = (a: Box, b: Box): string =>
  `Box A is $${a[2] - a[0]} \\times ${a[3] - a[1]} = ${area(a)}$ and box B is $${b[2] - b[0]} \\times ${b[3] - b[1]} = ${area(b)}$.`;

const dims = (b: Box): string => `${b[2] - b[0]} \\times ${b[3] - b[1]}`;
const two = (v: number): string => num(round(v, 2), 2);

type Guess = 'shift' | 'grow' | 'shrink';

/** A guess of the given kind for the true box `t`, every corner kept at 0 or more. */
function guessFor(rng: Rng, t: Box, kind: Guess, d: number): Box {
  const [x1, y1, x2, y2] = t;
  const w = x2 - x1;
  const h = y2 - y1;
  if (kind === 'shift') {
    // Mostly sideways or mostly down; diagonal only past the easiest level.
    const side = rng.int(2) === 0;
    const dx = side ? int(rng, 1, w - 1) : d < 0.35 ? 0 : int(rng, 0, w - 1);
    const dy = side ? (d < 0.35 ? 0 : int(rng, 0, h - 1)) : int(rng, 1, h - 1);
    return [x1 + dx, y1 + dy, x2 + dx, y2 + dy];
  }
  if (kind === 'grow') {
    for (;;) {
      const g: Box = [x1 - int(rng, 0, 2), y1 - int(rng, 0, 2), x2 + int(rng, 0, 2), y2 + int(rng, 0, 2)];
      if (area(g) > area(t)) return g;
    }
  }
  for (;;) {
    const a = int(rng, x1, x2 - 1);
    const b = int(rng, y1, y2 - 1);
    const g: Box = [a, b, int(rng, a + 1, x2), int(rng, b + 1, y2)];
    if (area(g) < area(t)) return g;
  }
}

export const generators: Generator[] = [
  {
    id: 'iou',
    make(rng, d) {
      const [a, b] = pair(rng, d, kindFor(rng, d));
      const I = inter(a, b);
      const U = union(a, b);
      const v = I / U;
      const e = edges(a, b);
      const crossed = (e.r - e.l) * (e.bt - e.t);
      return {
        prompt: `Box A is $${tex(a)}$ and box B is $${tex(b)}$. What is their IoU? Round to two decimals.`,
        answer: { kind: 'number', value: round(v, 4), places: 2 },
        traps: traps(round(v, 4), [
          { value: I / (area(a) + area(b)), why: 'That divides by the two areas added up, which counts the overlap twice. The union is area A plus area B, minus the intersection.' },
          { value: I / Math.min(area(a), area(b)), why: 'That divides by the smaller box alone. IoU divides by the union: everything either box covers.' },
          ...(I === 0 && crossed > 0 ? [{ value: crossed / (area(a) + area(b) - crossed), why: 'Both sides of the overlap came out negative, and their product is positive. A negative side means the boxes miss each other: the intersection is 0.' }] : []),
          { value: I, why: 'That is the intersection on its own. Divide it by the union.' },
        ], 2),
        solution: [
          areaStep(a, b),
          ...overlapSteps(a, b),
          `The union is $${area(a)} + ${area(b)} - ${I} = ${U}$.`,
          `IoU $= ${I} / ${U} \\approx ${two(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'areas',
    make(rng, d) {
      const [a, b] = pair(rng, d, kindFor(rng, d));
      const I = inter(a, b);
      const U = union(a, b);
      const e = edges(a, b);
      const crossed = (e.r - e.l) * (e.bt - e.t);
      const askUnion = d >= 0.35 && rng.int(2) === 0;
      const lead = `Box A is $${tex(a)}$ and box B is $${tex(b)}$.`;
      if (askUnion) {
        return {
          prompt: `${lead} What is the area of their union?`,
          answer: { kind: 'number', value: U },
          traps: traps(U, [
            { value: area(a) + area(b), why: 'That adds the two areas, so the overlap is counted twice. Subtract the intersection once.' },
            { value: area(a) + area(b) - 2 * I, why: 'That subtracts the overlap twice. It was counted twice in the two areas, so remove it once.' },
            { value: hull(a, b), why: 'That is the box around both, which also covers corners that are in neither box.' },
          ]),
          solution: [areaStep(a, b), ...overlapSteps(a, b), `The union is $${area(a)} + ${area(b)} - ${I} = ${U}$.`],
        };
      }
      return {
        prompt: `${lead} What is the area of their intersection?`,
        answer: { kind: 'number', value: I },
        traps: traps(I, [
          ...(I === 0 ? [{ value: crossed, why: 'A side of the overlap came out negative: the boxes miss each other, so the intersection is 0, whatever the product says.' }] : []),
          { value: hull(a, b), why: 'That is the box around both. The overlap starts at the larger of the two lefts and ends at the smaller of the two rights.' },
          { value: Math.min(area(a), area(b)), why: 'That is the smaller box\'s area. Only the part inside both boxes counts.' },
        ]),
        solution: overlapSteps(a, b),
      };
    },
  },
  {
    id: 'hit',
    make(rng, d) {
      const step = d < 0.7 ? 1 : pick(rng, [5, 10]);
      const kinds: Guess[] = ['shift', 'grow', 'shrink'];
      // Each kind is the hit equally often, so no shape gives the answer away.
      const win = rng.int(3);
      const floor = d < 0.35 ? 0.15 : 0.2;
      for (;;) {
        const w = int(rng, 3, d < 0.35 ? 4 : 6);
        const h = int(rng, 2, d < 0.35 ? 4 : 5);
        const x = int(rng, 2, 4);
        const y = int(rng, 2, 4);
        const t: Box = [x, y, x + w, y + h];
        const gs = kinds.map((k) => guessFor(rng, t, k, d));
        const vs = gs.map((g) => iou(t, g));
        if (!vs.every((v, i) => (i === win ? v >= 0.54 : v >= floor && v <= 0.46))) continue;
        if (new Set(vs.map(two)).size < 3) continue;
        const T = t.map((v) => v * step) as Box;
        const G = gs.map((g) => g.map((v) => v * step) as Box);
        const A = area(T);
        const why = (k: Guess, g: Box): string => {
          const C = area(g);
          const I = inter(T, g);
          const U = union(T, g);
          const v = two(iou(T, g));
          if (k === 'grow') return `Holding all of the true box is not enough: the union is the whole guess, $${C}$, so IoU is $${A} / ${C} \\approx ${v}$, under $0.5$.`;
          if (k === 'shrink') return `Lying inside the true box is not enough: the intersection is only the guess, $${C}$, and the union the whole true box, $${A}$. IoU is $${C} / ${A} \\approx ${v}$, under $0.5$.`;
          return `The union counts both boxes, not just the true one: $${A} + ${C} - ${I} = ${U}$. IoU is $${I} / ${U} \\approx ${v}$, under $0.5$.`;
        };
        const order = rng.shuffle([0, 1, 2]);
        const lines = order.flatMap((i) => {
          const g = G[i]!;
          const e = edges(T, g);
          const I = inter(T, g);
          const U = union(T, g);
          return [
            `Guess $${tex(g)}$ is $${dims(g)} = ${area(g)}$. Its overlap with the true box is $${e.r - e.l} \\times ${e.bt - e.t} = ${I}$.`,
            `The union is $${A} + ${area(g)} - ${I} = ${U}$, so IoU $= ${I} / ${U} \\approx ${two(vs[i]!)}$${i === win ? ': a hit' : ', under $0.5$'}.`,
          ];
        });
        return {
          prompt: `The true box is $${tex(T)}$. A guess counts as a hit at IoU $0.5$ or more. Which of these guesses is a hit?`,
          answer: { kind: 'choice', options: order.map((i) => `$${tex(G[i]!)}$`), correct: order.indexOf(win), why: order.map((i) => (i === win ? null : why(kinds[i]!, G[i]!))) },
          solution: [`The true box is $${dims(T)} = ${A}$.`, ...lines, `Only $${tex(G[win]!)}$ reaches $0.5$: it is the hit.`],
        };
      }
    },
  },
];

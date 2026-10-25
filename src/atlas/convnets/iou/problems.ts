import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, num, pick, round } from '../../kit';
import { traps } from '../../networks/kit';
import { shuffled } from '../kit';

/** Corners (x1, y1, x2, y2): top left, then bottom right. */
type Box = [number, number, number, number];

const area = (b: Box): number => (b[2] - b[0]) * (b[3] - b[1]);
/** The overlap's edges, which cross over (right < left) when the boxes miss each other. */
const edges = (a: Box, b: Box) => ({ l: Math.max(a[0], b[0]), r: Math.min(a[2], b[2]), t: Math.max(a[1], b[1]), bt: Math.min(a[3], b[3]) });
const inter = (a: Box, b: Box): number => {
  const e = edges(a, b);
  return Math.max(0, e.r - e.l) * Math.max(0, e.bt - e.t);
};
const union = (a: Box, b: Box): number => area(a) + area(b) - inter(a, b);
const iou = (a: Box, b: Box): number => inter(a, b) / union(a, b);
/** The box around both, a common stand-in for the overlap or the union. */
const hull = (a: Box, b: Box): number => (Math.max(a[2], b[2]) - Math.min(a[0], b[0])) * (Math.max(a[3], b[3]) - Math.min(a[1], b[1]));

const tex = (b: Box): string => `(${b.join(', ')})`;

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
  const side = (lo: number, hi: number, name: string) => (hi - lo > 0 ? `$${hi} - ${lo} = ${hi - lo}$ ${name}` : `$${hi} - ${lo} = ${hi - lo}$, so $0$ ${name}`);
  return [
    `The overlap's left edge is the larger left, $\\max(${a[0]}, ${b[0]}) = ${e.l}$, and its right edge the smaller right, $\\min(${a[2]}, ${b[2]}) = ${e.r}$: ${side(e.l, e.r, 'wide')}.`,
    `Its top is the larger top, $\\max(${a[1]}, ${b[1]}) = ${e.t}$, and its bottom the smaller bottom, $\\min(${a[3]}, ${b[3]}) = ${e.bt}$: ${side(e.t, e.bt, 'tall')}.`,
    w > 0 && h > 0 ? `The intersection is $${w} \\times ${h} = ${w * h}$.` : 'A side came out negative, so the boxes do not overlap: the intersection is $0$.',
  ];
}

const areaStep = (a: Box, b: Box): string =>
  `Box A is $${a[2] - a[0]} \\times ${a[3] - a[1]} = ${area(a)}$ and box B is $${b[2] - b[0]} \\times ${b[3] - b[1]} = ${area(b)}$.`;

/** Box letters for prose: "A and C", "A, C and D", "B only". */
function setText(xs: number[]): string {
  const ls = [...xs].sort((p, q) => p - q).map((i) => 'ABCDE'[i]!);
  if (ls.length === 1) return `${ls[0]} only`;
  return `${ls.slice(0, -1).join(', ')} and ${ls[ls.length - 1]}`;
}

/** Greedy NMS over boxes in `order`; `drop(kept, other)` says when a kept box suppresses another. */
function greedy(order: number[], drop: (k: number, o: number) => boolean): number[] {
  const keep: number[] = [];
  let rest = [...order];
  while (rest.length) {
    const best = rest.shift()!;
    keep.push(best);
    rest = rest.filter((o) => !drop(best, o));
  }
  return keep;
}

const sameSet = (p: number[], q: number[]) => p.length === q.length && [...p].sort().join() === [...q].sort().join();

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
          `IoU $= ${I} / ${U} \\approx ${num(round(v, 2), 2)}$.`,
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
    id: 'nms',
    make(rng, d) {
      const n = d < 0.5 ? 4 : 5;
      const thresh = d < 0.5 ? 0.5 : pick(rng, [0.3, 0.4, 0.5, 0.6]);
      for (;;) {
        // Boxes jittered around two objects (sometimes three), so duplicates overlap and the rest do not.
        const objects = n === 5 && rng.int(2) === 0 ? 3 : 2;
        const bases: Box[] = Array.from({ length: objects }, (_, o) => {
          const x = 4 + o * 34 + int(rng, 0, 4);
          const y = int(rng, 4, 30);
          return [x, y, x + int(rng, 18, 26), y + int(rng, 18, 26)];
        });
        const owner = Array.from({ length: n }, (_, i) => (i < objects ? i : rng.int(objects)));
        const boxes: Box[] = owner.map((o) => {
          const [x1, y1, x2, y2] = bases[o]!;
          const j = () => int(rng, -5, 5);
          return [x1 + j(), y1 + j(), x2 + j(), y2 + j()];
        });
        const M = boxes.map((p) => boxes.map((q) => round(iou(p, q), 2)));
        const scores = rng.shuffle([0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6]).slice(0, n);
        const desc = [...Array(n).keys()].sort((p, q) => scores[q]! - scores[p]!);
        const asc = [...desc].reverse();
        const over = (k: number, o: number) => M[k]![o]! > thresh;
        if (M.some((r, i) => r.some((v, j) => i !== j && Math.abs(v - thresh) < 0.03))) continue;
        const right = greedy(desc, over);
        if (right.length === n) continue;
        const fresh = (set: number[], taken: number[][]) => set.length > 0 && set.length < n && !sameSet(set, right) && !taken.some((t) => sameSet(t, set));
        const chain = {
          set: desc.filter((i) => desc.slice(0, desc.indexOf(i)).every((j) => !over(j, i))),
          why: 'That lets a box that was already dropped drop others too. Only kept boxes suppress: compare each box with the boxes kept so far.',
        };
        const usual = rng.shuffle([
          { set: desc.filter((i) => i === desc[0] || !over(desc[0]!, i)), why: 'That stops after the first box. Repeat with the boxes that are left: the most confident of them is kept, and drops its own duplicates.' },
          { set: greedy(asc, over), why: 'That starts from the least confident box. NMS sorts by confidence, highest first, so each object keeps its most confident box.' },
          { set: greedy(desc, (k, o) => !over(k, o)), why: 'That keeps the boxes that overlap the kept one and drops the rest. It is the other way round: overlapping it by more than the threshold makes a box a duplicate.' },
        ]);
        // The dropped-box mistake is the subtle one: always offered when it differs. Keeping
        // every box is never right here, so it is never offered.
        const picked: { set: number[]; why: string }[] = [];
        for (const w of [chain, ...usual]) if (picked.length < 3 && fresh(w.set, picked.map((p) => p.set))) picked.push(w);
        if (picked.length < 3) continue;
        const L = (i: number) => 'ABCDE'[i]!;
        const table = `\\begin{array}{c|${'c'.repeat(n)}} & ${boxes.map((_, i) => L(i)).join(' & ')} \\\\ \\hline ${M.map((r, i) => `${L(i)} & ${r.map((v, j) => (i === j ? '' : num(v))).join(' & ')}`).join(' \\\\ ')} \\end{array}`;
        const steps: string[] = [];
        let rest = [...desc];
        while (rest.length) {
          const best = rest.shift()!;
          const gone = rest.filter((o) => over(best, o));
          steps.push(
            gone.length
              ? `Keep ${L(best)}. Drop ${gone.map((o) => `${L(o)} (IoU $${num(M[best]![o]!)}$)`).join(' and ')}: above $${num(thresh)}$.`
              : `Keep ${L(best)}. No box left overlaps it by more than $${num(thresh)}$.`,
          );
          rest = rest.filter((o) => !over(best, o));
        }
        return {
          prompt: `A detector proposes ${n} boxes with these confidences: ${boxes.map((_, i) => `${L(i)} $${num(scores[i]!)}$`).join(', ')}. The table gives their IoUs with each other. Which boxes survive non-max suppression with IoU threshold $${num(thresh)}$?\n\n$$${table}$$`,
          answer: shuffled(rng, [{ text: setText(right), why: null }, ...picked.map((w) => ({ text: setText(w.set), why: w.why }))]),
          solution: [
            `Sort by confidence, highest first: ${desc.map((i) => `${L(i)} $${num(scores[i]!)}$`).join(', ')}.`,
            ...steps,
            `The survivors are ${setText(right)}.`,
          ],
        };
      }
    },
  },
];

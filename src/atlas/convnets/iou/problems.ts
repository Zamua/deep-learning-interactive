import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { int, num, pick, round } from '../../kit';
import { shuffled, traps } from '../kit';
import { type Box, iou } from '../box-iou/box';

const L = (i: number): string => 'ABCDE'[i]!;

/** Box letters for prose: "A and C", "A, C and D", "B only". */
function setText(xs: number[]): string {
  const ls = [...xs].sort((p, q) => p - q).map(L);
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

/** A detector's boxes: their IoU table, confidences, the confidence order and the NMS survivors. */
interface Dets {
  n: number;
  thresh: number;
  M: number[][];
  scores: number[];
  desc: number[];
  over: (k: number, o: number) => boolean;
  right: number[];
}

const levels = (rng: Rng, d: number) => ({ n: d < 0.5 ? 4 : 5, thresh: d < 0.5 ? 0.5 : pick(rng, [0.3, 0.4, 0.5, 0.6]) });

/** Boxes jittered around two objects (sometimes three), so duplicates overlap and the rest do not. */
function detections(rng: Rng, n: number, thresh: number): Dets {
  for (;;) {
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
    const over = (k: number, o: number) => M[k]![o]! > thresh;
    if (M.some((r, i) => r.some((v, j) => i !== j && Math.abs(v - thresh) < 0.03))) continue;
    const right = greedy(desc, over);
    if (right.length < n) return { n, thresh, M, scores, desc, over, right };
  }
}

/** The givens every table problem opens with, the IoU table last. */
function given(D: Dets, ask: string): string {
  const table = `\\begin{array}{c|${'c'.repeat(D.n)}} & ${D.M.map((_, i) => L(i)).join(' & ')} \\\\ \\hline ${D.M.map((r, i) => `${L(i)} & ${r.map((v, j) => (i === j ? '' : num(v))).join(' & ')}`).join(' \\\\ ')} \\end{array}`;
  return `A detector proposes ${D.n} boxes with these confidences: ${D.scores.map((c, i) => `${L(i)} $${num(c)}$`).join(', ')}. The table gives their IoUs with each other. ${ask}\n\n$$${table}$$`;
}

const sortStep = (D: Dets): string => `Sort by confidence, highest first: ${D.desc.map((i) => `${L(i)} $${num(D.scores[i]!)}$`).join(', ')}.`;

/** One step per box, in confidence order: a box is dropped only by a box already kept. */
function walk(D: Dets): string[] {
  const { M, desc, over, thresh } = D;
  const steps: string[] = [`${L(desc[0]!)} is the most confident: keep it.`];
  const kept = [desc[0]!];
  for (const i of desc.slice(1)) {
    const by = kept.find((k) => over(k, i));
    const ghost = desc.slice(0, desc.indexOf(i)).find((j) => !kept.includes(j) && over(j, i));
    if (by !== undefined) {
      steps.push(`${L(i)}: its IoU with kept ${L(by)} is $${num(M[by]![i]!)}$, above $${num(thresh)}$: drop ${L(i)}.`);
      continue;
    }
    const vs = kept.map((k) => `${L(k)} $${num(M[k]![i]!)}$`);
    const k0 = kept[0]!;
    const with_ = kept.length === 1 ? `its IoU with kept ${L(k0)} is $${num(M[k0]![i]!)}$,` : `its IoUs with the kept boxes, ${vs.slice(0, -1).join(', ')} and ${vs[vs.length - 1]}, are`;
    const note = ghost === undefined ? '' : ` Its $${num(M[ghost]![i]!)}$ with ${L(ghost)} does not count: ${L(ghost)} was dropped, and only kept boxes suppress.`;
    steps.push(`${L(i)}: ${with_} not above $${num(thresh)}$: keep ${L(i)}.${note}`);
    kept.push(i);
  }
  return steps;
}

/** The usual wrong runs of NMS, each with what it gets wrong. */
function mistakes(D: Dets): { set: number[]; why: string }[] {
  const { desc, over } = D;
  const asc = [...desc].reverse();
  return [
    {
      set: desc.filter((i) => desc.slice(0, desc.indexOf(i)).every((j) => !over(j, i))),
      why: 'That lets a box that was already dropped drop others too. Only kept boxes suppress: compare each box with the boxes kept so far.',
    },
    { set: desc.filter((i) => i === desc[0] || !over(desc[0]!, i)), why: 'That stops after the first box. Repeat with the boxes that are left: the most confident of them is kept, and drops its own duplicates.' },
    { set: greedy(asc, over), why: 'That starts from the least confident box. NMS sorts by confidence, highest first, so each object keeps its most confident box.' },
    { set: greedy(desc, (k, o) => !over(k, o)), why: 'That keeps the boxes that overlap the kept one and drops the rest. It is the other way round: overlapping it by more than the threshold makes a box a duplicate.' },
  ];
}

export const generators: Generator[] = [
  {
    id: 'nms',
    make(rng, d) {
      const { n, thresh } = levels(rng, d);
      for (;;) {
        const D = detections(rng, n, thresh);
        const fresh = (set: number[], taken: number[][]) => set.length > 0 && set.length < n && !sameSet(set, D.right) && !taken.some((t) => sameSet(t, set));
        const [chain, ...rest] = mistakes(D);
        // The dropped-box mistake is the subtle one: always offered when it differs. Keeping
        // every box is never right here, so it is never offered.
        const picked: { set: number[]; why: string }[] = [];
        for (const w of [chain!, ...rng.shuffle(rest)]) if (picked.length < 3 && fresh(w.set, picked.map((p) => p.set))) picked.push(w);
        if (picked.length < 3) continue;
        return {
          prompt: given(D, `Which boxes survive non-max suppression with IoU threshold $${num(thresh)}$?`),
          answer: shuffled(rng, [{ text: setText(D.right), why: null }, ...picked.map((w) => ({ text: setText(w.set), why: w.why }))]),
          solution: [sortStep(D), ...walk(D), `The survivors are ${setText(D.right)}.`],
        };
      }
    },
  },
  {
    id: 'survivors',
    make(rng, d) {
      const { n, thresh } = levels(rng, d);
      const D = detections(rng, n, thresh);
      const v = D.right.length;
      return {
        prompt: given(D, `How many boxes survive non-max suppression with IoU threshold $${num(thresh)}$?`),
        answer: { kind: 'number', value: v },
        traps: traps(v, mistakes(D).map((w) => ({ value: w.set.length, why: w.why }))),
        solution: [sortStep(D), ...walk(D), `${setText(D.right)} survive: ${v} ${v === 1 ? 'box' : 'boxes'}.`],
      };
    },
  },
  {
    id: 'first-round',
    make(rng, d) {
      const { n, thresh } = levels(rng, d);
      for (;;) {
        const D = detections(rng, n, thresh);
        const { M, desc, over } = D;
        const best = desc[0]!;
        const others = desc.slice(1);
        const dropped = others.filter((o) => over(best, o));
        const v = dropped.length;
        if (v === 0) continue;
        const rowOf = (k: number) => [...Array(n).keys()].filter((o) => o !== k && over(k, o)).length;
        const worst = desc[n - 1]!;
        return {
          prompt: given(D, `In non-max suppression with IoU threshold $${num(thresh)}$, how many boxes does the first box it keeps drop?`),
          answer: { kind: 'number', value: v },
          traps: traps(v, [
            ...(best !== 0 ? [{ value: rowOf(0), why: `That reads row A. The first box kept is the most confident one, ${L(best)}: read its row.` }] : []),
            { value: n - 1 - v, why: `That counts the boxes ${L(best)} lets stay. It drops the ones whose IoU with it is above the threshold.` },
            { value: rowOf(worst), why: `That reads the row of ${L(worst)}, the least confident box. The first box kept is the most confident one, ${L(best)}.` },
            { value: n - D.right.length, why: `That counts every box dropped by the end. The question asks only about ${L(best)}'s own drops.` },
          ]),
          solution: [
            `The most confident box is ${L(best)}, at $${num(D.scores[best]!)}$: it is kept first.`,
            `Its row: ${others.map((o) => `${L(o)} $${num(M[best]![o]!)}$`).join(', ')}.`,
            `Above $${num(thresh)}$: ${dropped.length === 1 ? L(dropped[0]!) : `${dropped.slice(0, -1).map(L).join(', ')} and ${L(dropped[dropped.length - 1]!)}`}. So ${L(best)} drops ${v} ${v === 1 ? 'box' : 'boxes'}.`,
          ],
        };
      }
    },
  },
  {
    id: 'threshold',
    make(rng) {
      const v = pick(rng, [0.35, 0.42, 0.47, 0.53, 0.58, 0.64, 0.71]);
      const [t1, t2] = rng.shuffle([0.3, 0.4, 0.5, 0.6, 0.7]).slice(0, 2) as [number, number];
      const drops = (t: number) => v > t;
      const fate = (t: number, drop: boolean) => `${drop ? 'dropped' : 'kept'} at $${num(t)}$`;
      const say = (t: number) => `At $${num(t)}$, $${num(v)}$ is ${drops(t) ? '' : 'not '}above the threshold, so B is ${drops(t) ? 'dropped' : 'kept'}.`;
      const opts = [
        [true, true],
        [true, false],
        [false, true],
        [false, false],
      ].map(([a, b]) => {
        const wrong = [a !== drops(t1) ? say(t1) : '', b !== drops(t2) ? say(t2) : ''].filter(Boolean);
        const text = `B is ${fate(t1, a!)} and ${fate(t2, b!)}`;
        if (!wrong.length) return { text, why: null };
        const flipped = wrong.length === 2 ? 'That has the rule backwards: a box is dropped when its IoU with a kept box is above the threshold. ' : '';
        return { text, why: flipped + wrong.join(' ') };
      });
      return {
        prompt: `Non-max suppression has kept box A. Box B, less confident, has IoU $${num(v)}$ with A. What happens to B with IoU threshold $${num(t1)}$, and with $${num(t2)}$?`,
        answer: shuffled(rng, opts),
        solution: ['A box is dropped when its IoU with a kept box is above the threshold.', say(t1), say(t2)],
      };
    },
  },
];

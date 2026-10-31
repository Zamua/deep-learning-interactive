import type { Generator } from '../../../mastery/domain/types';
import type { Rng } from '../../../core/rand';
import { clean, int, mat, nonzero, num, par, pick, shuffled, traps, vec, vtraps } from '../../kit';

const dd = (top: string, bot: string): string => `\\frac{\\partial ${top}}{\\partial ${bot}}`;
const argmax = (xs: readonly number[]): number => xs.indexOf(Math.max(...xs));
const abs = (xs: readonly number[]): number[] => xs.map((v) => Math.abs(v));
const unique = (xs: readonly number[], i: number): boolean => xs.filter((v) => v === xs[i]).length === 1;

/** A C x D weight matrix whose row `c` has one entry clearly largest in size; harder with difficulty. */
function weights(rng: Rng, C: number, D: number, c: number, d: number, negTop: boolean): number[][] {
  const hi = d < 0.35 ? 3 : 4;
  for (;;) {
    const W = Array.from({ length: C }, () => Array.from({ length: D }, () => int(rng, -hi, hi)));
    const row = W[c]!;
    const top = argmax(abs(row));
    if (!unique(abs(row), top) || row[top] === 0) continue;
    if ((row[top]! < 0) !== negTop) continue;
    if (!row.some((v) => v > 0) || !row.some((v) => v < 0)) continue;
    if (W.some((r, k) => k !== c && r.every((v, j) => v === row[j]))) continue;
    return W;
  }
}

/** Pixel brightnesses: whole numbers from 0 to 5, never all equal. */
function image(rng: Rng, D: number): number[] {
  for (;;) {
    const x = Array.from({ length: D }, () => int(rng, 0, 5));
    if (new Set(x).size > 1) return x;
  }
}

export const generators: Generator[] = [
  {
    id: 'top-pixel',
    make(rng, d) {
      const C = d < 0.5 ? 2 : 3;
      const D = d < 0.6 ? 4 : pick(rng, [4, 5, 6]);
      const c = rng.int(C);
      const W = weights(rng, C, D, c, d, rng.next() < 0.7);
      const x = image(rng, D);
      const row = W[c]!;
      const g = abs(row);
      const top = argmax(g);
      const signed = argmax(row);
      const contrib = row.map((v, j) => v * x[j]!);
      const bright = argmax(x);
      const why = row.map((v, j): string | null => {
        if (j === top) return null;
        if (j === signed && unique(row, j) && v > 0) return `Pixel ${j} has the largest weight, $${num(v)}$, but pixel ${top}'s $${num(row[top]!)}$ moves the score further, just downward. Saliency compares sizes.`;
        if (j === argmax(contrib) && unique(contrib, j)) return `Pixel ${j} adds the most to the score right now, $${num(x[j]!)} \\times ${num(v)}$. Saliency is how fast the score moves as a pixel changes: its weight alone.`;
        if (j === bright && unique(x, j)) return `Pixel ${j} is the brightest, but for a linear classifier the gradient does not depend on the pixel values: it is row ${c} of $\\symW$.`;
        return `Its weight is $${num(v)}$, smaller in size than pixel ${top}'s $${num(row[top]!)}$.`;
      });
      return {
        prompt: `A linear classifier scores the image $\\symx = ${vec(x)}$ with $\\syms = \\symW\\symx$, where $\\symW = ${mat(W)}$. Which pixel does class ${c}'s saliency map light up most, counting from 0?`,
        answer: { kind: 'choice', options: row.map((_, j) => `Pixel ${j}`), correct: top, why },
        solution: [
          `$\\syms_{${c}}$ is row ${c} of $\\symW$ dotted with $\\symx$, so $${dd(`\\syms_{${c}}`, '\\symx_j')}$ is pixel $j$'s weight in that row: $${vec(row)}$.`,
          `The saliency map is the size of each, $|${dd(`\\syms_{${c}}`, '\\symx_j')}|$: $${vec(g)}$. The pixel values do not enter.`,
          `The largest is pixel ${top}, with $|${num(row[top]!)}| = ${g[top]}$.`,
        ],
      };
    },
  },
  {
    id: 'map',
    make(rng, d) {
      const C = d < 0.5 ? 2 : 3;
      const D = d < 0.5 ? 3 : 4;
      const c = rng.int(C);
      const half = d >= 0.7;
      const W = weights(rng, C, D, c, d, rng.next() < 0.6).map((r) => r.map((v) => (half ? clean(v * pick(rng, [0.5, 1])) : v)));
      const x = image(rng, D);
      const b = Array.from({ length: C }, () => int(rng, -2, 2));
      const row = W[c]!;
      const v = abs(row);
      const col = c < D ? abs(W.map((r) => r[c]!)) : null;
      return {
        prompt: `A linear classifier scores the image $\\symx = ${vec(x)}$ with $\\syms = \\symW\\symx + \\symb$, where $\\symW = ${mat(W)}$ and $\\symb = ${vec(b)}$. What is class ${c}'s saliency map?`,
        answer: { kind: 'vector', value: v },
        traps: vtraps(v, [
          { value: row, why: 'That is the gradient itself, signs and all. The saliency map takes its absolute value: a negative weight moves the score just as much.' },
          { value: abs(row.map((w, j) => w * x[j]!)), why: 'That multiplies each weight by its pixel: what the pixel adds to the score now. The gradient of a linear score is the weight alone.' },
          ...(col ? [{ value: col, why: `That is column ${c} of $\\symW$, one entry per class. Class ${c}'s score uses row ${c}: one weight per pixel.` }] : []),
        ]),
        solution: [
          `$\\syms_{${c}}$ is row ${c} of $\\symW$ dotted with $\\symx$, plus $\\symb_{${c}}$. The bias does not depend on $\\symx$, so it drops out of the gradient.`,
          `Nudging pixel $j$ moves $\\syms_{${c}}$ by its weight times the nudge, so $${dd(`\\syms_{${c}}`, '\\symx')}$ is row ${c} itself: $${vec(row)}$.`,
          `The saliency map is the size of each entry, $|${dd(`\\syms_{${c}}`, '\\symx_j')}|$: $${vec(v)}$.`,
        ],
      };
    },
  },
  {
    id: 'why-abs',
    make(rng, d) {
      const D = d < 0.5 ? 4 : 5;
      for (;;) {
        const g = Array.from({ length: D }, () => nonzero(rng, -5, 5));
        const j = argmax(abs(g));
        if (!unique(abs(g), j) || g[j]! > 0) continue;
        const c = int(rng, 0, 2);
        const wrong = rng.shuffle([
          { text: 'Pixel values are never negative, so their gradients cannot be either', why: 'The pixels are positive, but a gradient is a slope: it is negative when brightening the pixel lowers the score.' },
          { text: 'It turns the gradient into shares that add up to 1', why: 'Absolute values do not add up to 1; that would also take dividing by their sum. The absolute value only drops the sign.' },
          { text: `A negative gradient means pixel ${j} does not affect the score, so its sign is dropped`, why: `A gradient of $${num(g[j]!)}$ means the score moves ${-g[j]!} times as fast as the pixel, downward. Only a zero gradient means a pixel does not matter.` },
          { text: 'It ranks the pixels by how much each adds to the score right now', why: 'What a pixel adds now is its value times its weight. The map measures how fast the score moves when the pixel changes.' },
        ]).slice(0, 3);
        return {
          prompt: `The gradient of class ${c}'s score with respect to the pixels is $${vec(g)}$. Its saliency map, $${vec(abs(g))}$, is brightest at pixel ${j}, counting from 0. Why take the absolute value?`,
          answer: shuffled(rng, [{ text: `Pixel ${j} moves the score the most, just downward`, why: null }, ...wrong]),
          solution: [
            `The sign of $${dd(`\\syms_{${c}}`, '\\symx_j')}$ says which way the score moves when pixel $j$ gets brighter; its size says how fast.`,
            `Pixel ${j}'s $${num(g[j]!)}$ moves the score faster than any other pixel, downward. The class depends on it most, so it should light up.`,
            'Taking the absolute value keeps the size and drops the direction.',
          ],
        };
      }
    },
  },
  {
    id: 'deeper',
    make(rng, d) {
      // s = a * max(0, u x0 + v x1) (+ e x1 at the top level, a second path to pixel 1).
      for (;;) {
        const a = int(rng, 2, 4);
        const u = d < 0.35 ? int(rng, 1, 3) : nonzero(rng, -3, 3);
        const v = d < 0.35 ? int(rng, 1, 3) : nonzero(rng, -3, 3);
        const e = d >= 0.7 ? nonzero(rng, -2, 2) : 0;
        const x = [int(rng, 0, 4), int(rng, 0, 4)];
        const q = u * x[0]! + v * x[1]!;
        const on = q > 0;
        const wantOff = d >= 0.35 && rng.next() < 0.25;
        if (q === 0 || on === wantOff) continue;
        const k = d < 0.35 ? 0 : rng.int(2);
        const coef = k === 0 ? u : v;
        const grad = (on ? a * coef : 0) + (k === 1 ? e : 0);
        const ans = Math.abs(grad);
        const r = Math.max(0, q);
        const sVal = a * r + e * x[1]!;
        const term = (c: number, name: string, first: boolean) => {
          const mag = Math.abs(c) === 1 ? '' : String(Math.abs(c));
          return first ? `${c < 0 ? '-' : ''}${mag}${name}` : `${c < 0 ? '-' : '+'} ${mag}${name}`;
        };
        const inner = `${term(u, '\\symx_0', true)} ${term(v, '\\symx_1', false)}`;
        const tex = `\\syms = ${a}\\max(0,\\ ${inner})${e ? ` ${e < 0 ? '-' : '+'} ${Math.abs(e) === 1 ? '' : Math.abs(e)}\\symx_1` : ''}`;
        const pix = `\\symx_${k}`;
        return {
          prompt: `A model scores the image $\\symx = ${vec(x)}$ with $${tex}$. What is the saliency of pixel ${k}?`,
          answer: { kind: 'number', value: ans },
          traps: traps(ans, [
            ...(on ? [] : [{ value: Math.abs(a * coef + (k === 1 ? e : 0)), why: `The max gets $${q}$ and outputs 0 here, so it routes no gradient back through that path.` }]),
            ...(on ? [{ value: Math.abs(coef + (k === 1 ? e : 0)), why: `That stops at the max. On the way back the gradient also passes the multiply by $${a}$.` }] : []),
            ...(grad < 0 ? [{ value: grad, why: 'That is the gradient itself. Saliency is its size: drop the sign.' }] : []),
            ...(e && k === 1 ? [{ value: Math.abs(on ? a * coef : 0), why: `Pixel 1 also reaches $\\syms$ directly, through $${e}\\symx_1$. Gradients along both paths add.` }] : []),
            { value: sVal, why: 'That is the score itself. Saliency is its gradient with respect to the pixel.' },
          ]),
          solution: [
            `Forward: the max gets $${par(u)} \\cdot ${x[0]} + ${par(v)} \\cdot ${x[1]} = ${q}$, so it outputs $${r}$.`,
            on
              ? `Backward from $\\syms$, starting at 1: the multiply by $${a}$ hands $${a}$ to the max, which passes it on because $${q} > 0$, and the add copies it to both terms.`
              : `Backward from $\\syms$: the max output 0 because $${q} < 0$, so it sends 0 back. Nothing reaches the pixels through it.`,
            ...(on ? [`Pixel ${k}'s term multiplies it by $${coef}$: $${a} \\times ${par(coef)} = ${a * coef}$.`] : []),
            ...(e && k === 1 ? [`Pixel 1 also gets $${e}$ straight from the $${e}\\symx_1$ term. Paths add: $${on ? a * coef : 0} + ${par(e)} = ${grad}$.`] : []),
            `The saliency is the size of the gradient: $|${dd('\\syms', pix)}| = |${grad}| = ${ans}$.`,
          ],
        };
      }
    },
  },
];

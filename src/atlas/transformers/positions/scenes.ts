import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { columns } from '../../draw';
import { fmt, mini, rich, vrow } from '../draw';

const WORDS = ['dog', 'bites', 'man'];
const OUT = [0.7, 1.3, -0.4];
/** Where each word sits in the swapped sentence. */
const SWAP = [2, 1, 0];

function chip(s: Scene, x: number, y: number, w: string, on = 0): void {
  s.cell(x - 8 * s.u, y - 3.5 * s.u, 16 * s.u, 7 * s.u, w, 'orange', { on, size: 3.2 });
}

const blind: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 3, 28);
    const y1 = s.h * 0.12;
    const y2 = s.h * 0.5;
    WORDS.forEach((w, j) => {
      chip(s, xs[j]!, y1, w, j === 1 ? s.win('same', 'bag') : 0);
      s.alpha(s.ease('one', 0.6, 2.5), () => s.cell(xs[j]! - 5 * u, y1 + 7 * u, 10 * u, 6.5 * u, fmt(OUT[j]!), 'teal', { size: 3 }));
    });
    s.alpha(s.ease('swap', 0.6), () => {
      WORDS.forEach((w, j) => {
        const to = xs[SWAP[j]!]!;
        const t = s.ease('swap', 1.2, 0.6);
        const x = lerp(xs[j]!, to, t);
        const y = lerp(y1, y2, t);
        if (j !== 1) s.alpha(0.5 * t, () => s.line(xs[j]!, y1 + 11 * u, to, y2 - 4.5 * u, s.tint('--ink-3', 0.7), 0.25, [1, 1]));
        chip(s, x, y, w, j === 1 ? s.win('same', 'bag') : 0);
      });
    });
    s.alpha(s.ease('same', 0.6), () => {
      WORDS.forEach((_, j) => s.cell(xs[SWAP[j]!]! - 5 * u, y2 + 7 * u, 10 * u, 6.5 * u, fmt(OUT[j]!), 'teal', { size: 3, on: j === 1 ? s.win('same', 'bag') : 0 }));
      s.alpha(s.ease('same', 0.6, 2.5), () => s.text('same outputs, moved with their tokens', s.w / 2, s.h * 0.74, { size: 3.2, color: s.c('--ink-2') }));
    });
    s.alpha(s.ease('bag', 0.6), () => {
      rich(s, [['{ ', '--ink-3'], ['dog, bites, man', 'orange'], [' }', '--ink-3']], s.w / 2, s.h * 0.86, { size: 3.8, weight: 600 });
      s.text('a bag of tokens: the order is lost', s.w / 2, s.h * 0.93, { size: 3.1, color: s.c('red') });
    });
  },
};

const E = [[1, 2], [0, 1], [3, 0]];
const P = [[0, 1], [2, 0], [1, -1]];

/** `label: e + p = sum`, one row of the addition. */
function sum(s: Scene, y: number, label: string, e: number[], p: number[]): void {
  const cx = s.w / 2;
  const u = s.u;
  s.text(label, cx - 31 * u, y, { size: 3.2, font: 'mono', weight: 600, align: 'right', color: s.c('--ink-2') });
  vrow(s, cx - 20 * u, y, e.map((v) => fmt(v)), 'orange');
  s.text('+', cx - 7 * u, y, { size: 4, font: 'mono', color: s.c('--ink-3') });
  vrow(s, cx + 5 * u, y, p.map((v) => fmt(v)), 'slate');
  s.text('=', cx + 17.5 * u, y, { size: 4, font: 'mono', color: s.c('--ink-3') });
  vrow(s, cx + 30 * u, y, e.map((v, i) => fmt(v + p[i]!)), 'teal', { on: [1, 1] });
}

const add: SceneDef = {
  draw(s) {
    const cx = s.w / 2;
    const u = s.u;
    const y = s.h * 0.24;
    const one = s.win('sum', 'differ');
    const two = s.ease('differ', 0.6);
    const eb = mini(s, cx - 22 * u, y, E.map((r) => r.map((v) => fmt(v))), 'orange', { on: (i) => (i === 0 ? Math.max(one, two) : 0) });
    s.text('E', cx - 22 * u, eb.t - 4 * u, { size: 3.8, font: 'mono', weight: 650, color: s.c('orange') });
    WORDS.forEach((w, i) => s.text(w, eb.l - 2 * u, y + (i - 1) * 7.5 * u, { size: 3, font: 'mono', weight: 600, align: 'right', color: s.c('--ink-2') }));
    s.alpha(s.ease('table', 0.6), () => {
      const pb = mini(s, cx + 26 * u, y, P.map((r) => r.map((v) => fmt(v))), 'slate', { on: (i) => (i === 0 ? one : i === 2 ? two : 0) });
      s.text('P', cx + 26 * u, pb.t - 4 * u, { size: 3.8, font: 'mono', weight: 650, color: s.c('slate') });
      [0, 1, 2].forEach((i) => s.text(`pos ${i}`, pb.l - 2 * u, y + (i - 1) * 7.5 * u, { size: 3, font: 'mono', weight: 600, align: 'right', color: s.c('--ink-2') }));
    });
    s.alpha(s.ease('sum', 0.6, 1), () => sum(s, s.h * 0.52, 'dog @ 0', E[0]!, P[0]!));
    s.alpha(two, () => sum(s, s.h * 0.66, 'dog @ 2', E[0]!, P[2]!));
    s.alpha(s.ease('learned', 0.6, 1), () => {
      rich(s, [['P', 'slate'], [': (1,024, 768) = ', '--ink-2'], ['786,432', '--ink'], [' learned numbers', '--ink-2']], cx, s.h * 0.84, { size: 3.3, weight: 600 });
    });
  },
};

export const scenes: Record<string, SceneDef> = { blind, add };

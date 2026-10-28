import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { after, caption } from '../../networks/draw';
import type { Ink } from '../draw';
import { rich, sub } from '../draw';

const ATT: Ink = 'teal';
const MLP: Ink = 'gold';
const EMB: Ink = 'orange';

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** One d by d square, `q` stage units on a side, lit by `on`. */
function square(s: Scene, x: number, y: number, q: number, k: Ink, on = 0, dashed = false) {
  const u = s.u;
  s.rrect(x, y, q * u, q * u, 0.8, { fill: s.tint(k, 0.16 + 0.2 * on), stroke: dashed ? undefined : s.tint(k, 0.6 + 0.4 * on), lw: 0.3 });
  if (dashed) {
    const c = s.tint(k, 0.7);
    s.line(x, y, x + q * u, y, c, 0.25, [0.8, 0.8]);
    s.line(x + q * u, y, x + q * u, y + q * u, c, 0.25, [0.8, 0.8]);
    s.line(x + q * u, y + q * u, x, y + q * u, c, 0.25, [0.8, 0.8]);
    s.line(x, y + q * u, x, y, c, 0.25, [0.8, 0.8]);
  }
}

/** A small count badge in a square's top-left corner. */
function badge(s: Scene, n: number, x: number, y: number, k: Ink, a: number) {
  s.alpha(a, () => s.text(String(n), x + 1.8 * s.u, y + 2.2 * s.u, { size: 2.6, font: 'mono', weight: 700, color: s.c(k), halo: true }));
}

// ---- 1. One block: four squares of attention, eight of MLP

const block: SceneDef = {
  draw(s) {
    const u = s.u;
    const q = 11;
    const g = 1.4;
    const G = s.tall ? 10 : 14;
    const wide = 2 * q + g + G + q + 3 + 4 * q;
    const x0 = s.w / 2 - (wide / 2) * u;
    const y0 = s.h * 0.18;
    // Attention's 2 by 2, then the MLP: W1 standing tall, W2 lying along the top.
    const ax = (i: number) => x0 + (i % 2) * (q + g) * u;
    const ay = (i: number) => y0 + Math.floor(i / 2) * (q + g) * u;
    const mx = x0 + (2 * q + g + G) * u;
    const w2x = mx + (q + 3) * u;
    const lab = { size: 3, font: 'mono', color: s.c('--ink-3') } as const;

    // The two branches, as empty regions until their squares arrive.
    const outline = s.ease('size', 0.6) * (1 - s.ease('w2', 0.6));
    s.alpha(outline, () => {
      s.rrect(x0 - 2 * u, y0 - 2 * u, (2 * q + g + 4) * u, (2 * q + g + 4) * u, 1.5, { stroke: s.tint(ATT, 0.5), lw: 0.3 });
      s.rrect(mx - 2 * u, y0 - 2 * u, (5 * q + 7) * u, (4 * q + 4) * u, 1.5, { stroke: s.tint(MLP, 0.5), lw: 0.3 });
      s.alpha(1 - s.ease('width', 0.6), () => {
        s.text('?', x0 + (q + g / 2) * u, y0 + (q + g / 2) * u, { size: 6, font: 'mono', weight: 600, color: s.c(ATT) });
        s.text('?', mx + 2.5 * q * u, y0 + 2 * q * u, { size: 6, font: 'mono', weight: 600, color: s.c(MLP) });
      });
    });
    s.alpha(s.ease('size', 0.6), () => {
      s.text('attention', x0 + (q + g / 2) * u, y0 - 5.5 * u, { size: 3.3, font: 'mono', weight: 650, color: s.c(ATT) });
      s.text('MLP', mx + 2.5 * q * u, y0 - 5.5 * u, { size: 3.3, font: 'mono', weight: 650, color: s.c(MLP) });
    });

    // Attention: W_Q first, as the one square; then the other three.
    const att = s.win('attn', 'mlp') + s.ease('total', 0.6) * (1 - s.ease('num', 0.6));
    ['Q', 'K', 'V', 'O'].forEach((n, i) => {
      const a = i === 0 ? s.ease('width', 0.6, 1.6) : s.ease('attn', 0.5, 0.5 + 0.35 * i);
      s.alpha(a, () => {
        square(s, ax(i), ay(i), q, ATT, att);
        sub(s, 'W', n, ax(i) + (q / 2) * u, ay(i) + (q / 2) * u, { k: ATT, size: 3.4, halo: true });
      });
    });
    s.alpha(s.ease('width', 0.6, 1.6) * (1 - s.ease('attn', 0.6)), () => {
      s.text('d', ax(0) + (q / 2) * u, y0 - 2 * u, lab);
      s.text('d', x0 - 2 * u, y0 + (q / 2) * u, { ...lab, align: 'right' });
    });

    // The MLP: W1 grows down, W2 grows right, each four squares long.
    const mlp = s.win('mlp', 'four') + s.ease('total', 0.6) * (1 - s.ease('num', 0.6));
    const g1 = s.ease('mlp', 1.2, 1.5);
    const g2 = s.ease('w2', 1.2, 0.6);
    if (g1 > 0.003) {
      s.rrect(mx, y0, q * u, lerp(q, 4 * q, g1) * u, 0.8, { fill: s.tint(MLP, 0.16 + 0.2 * mlp), stroke: s.tint(MLP, 0.6 + 0.4 * mlp), lw: 0.3 });
      sub(s, 'W', '1', mx + (q / 2) * u, y0 + lerp(q, 4 * q, g1) * 0.375 * u, { k: MLP, size: 3.4, halo: true });
      s.alpha(g1, () => s.text('4d × d', mx + (q + 2) * u, y0 + 3 * q * u, { ...lab, align: 'left' }));
    }
    if (g2 > 0.003) {
      s.rrect(w2x, y0, lerp(q, 4 * q, g2) * u, q * u, 0.8, { fill: s.tint(MLP, 0.16 + 0.2 * mlp), stroke: s.tint(MLP, 0.6 + 0.4 * mlp), lw: 0.3 });
      sub(s, 'W', '2', w2x + lerp(q, 4 * q, g2) * 0.375 * u, y0 + (q / 2) * u, { k: MLP, size: 3.4, halo: true });
      s.alpha(g2, () => s.text('d × 4d', w2x + 2 * q * u, y0 + (q + 3) * u, lab));
    }
    // Dividers: each strip is four squares end to end.
    s.alpha(after(s, 'w2', 0.55), () => {
      for (let i = 1; i < 4; i++) {
        s.line(mx + 0.4 * u, y0 + i * q * u, mx + (q - 0.4) * u, y0 + i * q * u, s.tint(MLP, 0.8), 0.25, [0.8, 0.6]);
        s.line(w2x + i * q * u, y0 + 0.4 * u, w2x + i * q * u, y0 + (q - 0.4) * u, s.tint(MLP, 0.8), 0.25, [0.8, 0.6]);
      }
    });

    // Biases and layer norms: rows of d or 4d numbers, slivers beside a square.
    const sl = s.ease('small', 0.6) * (1 - 0.6 * s.ease('total', 0.6));
    s.alpha(sl, () => {
      const ys = y0 + (4 * q + 6) * u;
      const lens = [4 * q, q, q, q];
      const span = lens.reduce((a, b) => a + b, 0) + 3 * 2.5;
      let x = s.w / 2 - (span / 2) * u;
      lens.forEach((l, i) => {
        s.rrect(x, ys - 0.45 * u, l * u, 0.9 * u, 0.3, { fill: s.tint(i === 0 ? MLP : 'slate', 0.7) });
        x += (l + 2.5) * u;
      });
      s.text('biases, layer norms: rows of d or 4d, left out', s.w / 2, ys + 4.5 * u, { size: s.tall ? 2.9 : 3.1, color: s.c('--ink-3'), halo: true });
    });

    // Counting the twelve squares, one badge at a time.
    const cnt = (i: number) => after(s, 'total', 0.08 + 0.045 * i, 0.3);
    [0, 1, 2, 3].forEach((i) => badge(s, i + 1, ax(i), ay(i), ATT, cnt(i)));
    [0, 1, 2, 3].forEach((i) => badge(s, i + 5, mx, y0 + i * q * u, MLP, cnt(i + 4)));
    [0, 1, 2, 3].forEach((i) => badge(s, i + 9, w2x + i * q * u, y0, MLP, cnt(i + 8)));

    cite(s, 'Vaswani et al., 2017', s.win('four', 'small'));
    const cy = s.h * 0.88;
    s.alpha(s.win('size', 'width'), () => caption(s, 'one block: how many weights?', cy, '--ink-2', 3.4));
    s.alpha(s.win('width', 'attn'), () => caption(s, 'd × d matrix: d² weights, one square', cy, '--ink-2', 3.4));
    s.alpha(s.win('attn', 'mlp'), () => rich(s, [['attention: 4 squares = ', '--ink-2'], ['4d²', ATT]], s.w / 2, cy, { size: 3.4, weight: 600 }));
    s.alpha(s.win('mlp', 'w2'), () => caption(s, 'W₁: d numbers in, 4d out', cy, MLP, 3.4));
    s.alpha(s.win('w2', 'four'), () => rich(s, [['W₂: 4d in, d out.  MLP: ', '--ink-2'], ['8d²', MLP]], s.w / 2, cy, { size: 3.4, weight: 600 }));
    s.alpha(s.win('four', 'small'), () => caption(s, 'd = 512, MLP = 2,048: four times', cy, '--ink-2', 3.4));
    s.alpha(s.win('total', 'num'), () => rich(s, [['4 + 8 = 12 squares: ', '--ink-2'], ['12d²', '--ink'], [' per block', '--ink-2']], s.w / 2, cy, { size: 3.4, weight: 650 }));
    s.alpha(s.ease('num', 0.6), () => {
      caption(s, 'd = 1,000: a square is 1,000,000', cy - 6 * u, '--ink-2', 3.3);
      rich(s, [['one block: ', '--ink-2'], ['12,000,000', '--ink']], s.w / 2, cy + 1 * u, { size: 3.6, weight: 650 });
    });
  },
};

// ---- 2. The whole model: N blocks of twelve squares, and the embedding table

/** A row of tiles standing for one block: four of attention, eight of MLP. */
function blockRow(s: Scene, x: number, y: number, t: number, p: number, on = 0) {
  for (let j = 0; j < 12; j++) {
    const k = j < 4 ? ATT : MLP;
    s.rrect(x + j * p * s.u, y, t * s.u, t * s.u, 0.4, { fill: s.tint(k, 0.3 + 0.25 * on), stroke: s.tint(k, 0.7), lw: 0.2 });
  }
}

const model: SceneDef = {
  draw(s) {
    const u = s.u;
    const t = s.tall ? 3.2 : 3.3;
    const p = t + 0.65;
    const G = s.tall ? 9 : 14;
    const wide = 12 * p + G + 5 * p;
    const bx = s.w / 2 - (wide / 2) * u;
    const ex = bx + (12 * p + G) * u;
    const y0 = s.h * 0.17;
    const lab = { size: 3.1, font: 'mono', color: s.c('--ink-2') } as const;

    // The stack, one block (row) at a time.
    for (let i = 0; i < 12; i++) s.alpha(after(s, 'stack', 0.15 + 0.055 * i, 0.3), () => blockRow(s, bx, y0 + i * p * u, t, p));
    s.alpha(s.ease('stack', 0.6), () => s.text('N blocks, 12 squares each', bx + 6 * p * u, y0 - 4.5 * u, { ...lab, weight: 600 }));
    s.alpha(s.ease('twelve', 0.6), () => {
      s.text('12 × 12M', bx + 6 * p * u, y0 + (12 * p + 4) * u, lab);
      s.text('= 144M', bx + 6 * p * u, y0 + (12 * p + 9) * u, { ...lab, size: 3.4, weight: 650, color: s.c('--ink') });
    });

    // The embedding table, in the same squares: 50 of them.
    s.alpha(s.ease('embed', 0.6), () => s.text('embedding', ex + 2.5 * p * u, y0 - 4.5 * u, { ...lab, weight: 600, color: s.c(EMB) }));
    for (let i = 0; i < 50; i++) {
      const r = Math.floor(i / 5);
      const c = i % 5;
      s.alpha(after(s, 'embed', 0.3 + 0.006 * i, 0.25), () => s.rrect(ex + c * p * u, y0 + r * p * u, t * u, t * u, 0.4, { fill: s.tint(EMB, 0.3), stroke: s.tint(EMB, 0.7), lw: 0.2 }));
    }
    s.alpha(after(s, 'embed', 0.6), () => {
      s.text('V × d', ex + 2.5 * p * u, y0 + (10 * p + 4) * u, lab);
      s.text('= 50M', ex + 2.5 * p * u, y0 + (10 * p + 9) * u, { ...lab, size: 3.4, weight: 650, color: s.c('--ink') });
    });

    cite(s, 'Kaplan et al., 2020', s.win('kaplan', 'embed'));
    const cy = s.h * 0.87;
    s.alpha(s.win('stack', 'twelve'), () => rich(s, [['N blocks: ', '--ink-2'], ['12Nd²', '--ink']], s.w / 2, cy, { size: 3.6, weight: 650 }));
    s.alpha(s.win('twelve', 'kaplan'), () => caption(s, '1 square = d × d = 1,000,000', cy, '--ink-2', 3.3));
    s.alpha(s.win('kaplan', 'embed'), () => {
      caption(s, 'a bigger count predicted better;', cy - 2.6 * u, '--ink-2', 3.2);
      caption(s, 'width or blocks mattered little', cy + 2.6 * u, '--ink-2', 3.2);
    });
    s.alpha(s.win('embed', 'all'), () => caption(s, '50,000 × 1,000 = 50M: 50 squares', cy, EMB, 3.3));
    s.alpha(s.ease('all', 0.6), () => rich(s, [['144M + 50M = ', '--ink-2'], ['194M', '--ink']], s.w / 2, cy, { size: 3.8, weight: 650 }));
  },
};

// ---- 3. Which knob: the width enters squared, the number of blocks once

const scale: SceneDef = {
  draw(s) {
    const u = s.u;
    // One square that grows to 2d on a side, and beside it a stack that doubles.
    const ac = { x: s.w * 0.3, y: s.h * 0.45 };
    const bc = { x: s.w * 0.7, y: s.h * 0.45 };
    const q0 = 12;
    const lab = { size: 3.1, font: 'mono', color: s.c('--ink-2') } as const;

    rich(s, [['12 · ', '--ink-2'], ['N', 'slate'], [' · ', '--ink-2'], ['d²', 'slate']], s.w / 2, s.h * 0.08, { size: 4, weight: 650 });

    // Wider: the square doubles along both sides, and holds four.
    const grow = s.ease('wide', 1.4, 2);
    const q = lerp(q0, 2 * q0, grow);
    const sx = ac.x - q0 * u;
    const sy = ac.y - q0 * u;
    s.alpha(grow, () => {
      for (const [i, j] of [[1, 0], [0, 1], [1, 1]] as const) square(s, sx + i * q0 * u, sy + j * q0 * u, q0, ATT, 0, true);
    });
    square(s, sx, sy, q0, ATT, 0.5 * s.win('wide', 'deep'));
    s.alpha(1 - grow, () => {
      s.text('d', sx + (q0 / 2) * u, sy - 2.5 * u, lab);
      s.text('d²', sx + (q0 / 2) * u, sy + (q0 / 2) * u, { ...lab, weight: 650, color: s.c(ATT) });
    });
    s.alpha(grow, () => {
      s.text('2d', sx + (q / 2) * u, sy - 2.5 * u, lab);
      s.text('4d²', sx + q0 * u, sy + q0 * u, { ...lab, size: 3.4, weight: 650, color: s.c('--ink'), halo: true });
    });
    s.text('wider', ac.x, sy + (2 * q0 + 5) * u, { ...lab, weight: 600 });
    s.alpha(after(s, 'wide', 0.7), () => s.text('× 4', ac.x, sy + (2 * q0 + 10) * u, { ...lab, size: 3.6, weight: 650, color: s.c('--ink') }));

    // Deeper: three blocks become six, standing on the square's baseline.
    const t = 3;
    const p = t + 0.6;
    const bx = bc.x - 6 * p * u;
    const base = sy + 2 * q0 * u;
    s.alpha(s.ease('deep', 0.6), () => {
      for (let i = 0; i < 6; i++) {
        const a = i < 3 ? 1 : after(s, 'deep', 0.25 + 0.1 * (i - 3), 0.3);
        s.alpha(a, () => blockRow(s, bx, base - (i + 1) * p * u, t, p));
      }
      s.text('deeper', bc.x, sy + (2 * q0 + 5) * u, { ...lab, weight: 600 });
      s.alpha(after(s, 'deep', 0.6), () => s.text('× 2', bc.x, sy + (2 * q0 + 10) * u, { ...lab, size: 3.6, weight: 650, color: s.c('--ink') }));
    });

    const cy = s.h * 0.92;
    s.alpha(s.win('wide', 'deep'), () => caption(s, '2× the width: every square 4×', cy, ATT, 3.4));
    s.alpha(s.win('deep', 'squared'), () => caption(s, '2× the blocks: 2× the weights', cy, '--ink-2', 3.4));
    s.alpha(s.ease('squared', 0.6), () => caption(s, '3× the width: 3 × 3 = 9× the weights', cy, '--ink', 3.4));
  },
};

export const scenes: Record<string, SceneDef> = { block, model, scale };

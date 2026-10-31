import type { Ink, Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { cite, columns, verdict } from '../../draw';
import { mark, pass, word } from '../draw';

/** 0 -> 1 once beat `id` is fraction `f` of the way through its narration. */
const cue = (s: Scene, id: string, f: number): number => Math.min(1, Math.max(0, (s.prog(id) - f) * 8));

/** Left-aligned mono lines from (x, y), `gap` stage units apart. */
function lines(s: Scene, rows: [string, Ink][], x: number, y: number, o: { size?: number; gap?: number; weight?: number } = {}): void {
  rows.forEach(([t, k], i) => s.text(t, x, y + i * (o.gap ?? 5.4) * s.u, { size: o.size ?? 3, font: 'mono', weight: o.weight ?? 500, align: 'left', color: s.c(k) }));
}

/** Each pass: what it reads, the step it takes, what it writes. */
const PASSES: [string, string, string][] = [
  ['17 × 24 = ?', '17 × 20 =', '340'],
  ['340', '17 × 4 =', '68'],
  ['68', '340 + 68 =', '408'],
];
const WORKED = ['17 × 20 = 340', '17 × 4 = 68', '340 + 68 = 408'];

const BIG = { size: 3.4, h: 7.2 };

/** Two interlocking links centered between x0 and x1 at height y. */
function links(s: Scene, x0: number, x1: number, y: number, k: Ink): void {
  const c = (x0 + x1) / 2;
  const w = Math.min(9 * s.u, (x1 - x0) * 0.6);
  const h = 4 * s.u;
  const o = 1.6 * s.u;
  s.rrect(c - w + o, y - h / 2, w, h, 2, { stroke: s.c(k), lw: 0.5 });
  s.rrect(c - o, y - h / 2, w, h, 2, { stroke: s.c(k), lw: 0.5 });
}

const depth: SceneDef = {
  draw(s) {
    const xs = columns(s, 3, s.tall ? 31 : 36);
    const yOut = s.h * 0.2;
    const yBox = s.h * 0.48;
    const yIn = s.h * 0.77;
    const bh = (s.h * 0.34) / s.u;
    const cot = s.ease('step1', 0.9);
    const shown = [1, s.ease('feed', 0.7, 0.4), s.ease('answer', 0.7, 0.2)];
    const same = s.win('same', 'name');
    PASSES.forEach(([inp, step, out], i) => {
      const x = i === 0 ? lerp(s.w / 2, xs[0]!, cot) : xs[i]!;
      s.alpha(shown[i]!, () => {
        word(s, x, yIn, inp, i === 0 ? 'orange' : 'gold', BIG);
        s.arrow(x, yIn - 3.6 * s.u, x, yBox + (bh / 2) * s.u + 0.8 * s.u, s.c('--ink-3'), 0.35, 1.8);
        pass(s, x, yBox, 'blue', { h: bh, w: 15, on: Math.max(i === 0 ? s.win('pass', 'depth') : 0, same) });
        s.arrow(x, yBox - (bh / 2) * s.u - 0.8 * s.u, x, yOut + 3.6 * s.u, s.c('--ink-3'), 0.35, 1.8);
        if (i === 0) {
          s.alpha(cue(s, 'ask', 0.7) * (1 - cot), () => {
            word(s, x, yOut, '418', 'red', BIG);
            mark(s, false, x + 9 * s.u, yOut);
          });
          s.alpha(cot, () => word(s, x, yOut, out, 'gold', BIG));
        } else word(s, x, yOut, out, i === 2 ? 'green' : 'gold', BIG);
        s.alpha(i === 0 ? s.ease('step1', 0.6, 0.6) : 1, () => s.text(step, x, yOut - 7 * s.u, { size: 3.1, font: 'mono', color: s.c('--ink-3') }));
        if (i === 2) s.alpha(s.ease('answer', 0.6, 1), () => mark(s, true, x + 8 * s.u, yOut));
      });
      // The written token travels back in as the next pass's input.
      if (i < 2) {
        s.alpha(shown[i + 1]!, () => {
          const x1 = xs[i + 1]!;
          s.line(x + 5 * s.u, yOut + 2 * s.u, x1 - 5 * s.u, yIn - 2 * s.u, s.tint('gold', 0.8), 0.35, [1.2, 1]);
        });
        s.alpha(s.ease('name', 0.6, 0.6 + 0.5 * i), () => links(s, x + 6.5 * s.u, xs[i + 1]! - 6.5 * s.u, yOut, 'gold'));
      }
    });
    // One pass: the same layers every time.
    s.alpha(s.win('pass', 'depth'), () => {
      const x = s.w / 2 + 10 * s.u;
      s.text('the same layers', x, yBox - 2.5 * s.u, { size: 3, font: 'mono', align: 'left', color: s.c('blue') });
      s.text('on every pass', x, yBox + 2.5 * s.u, { size: 3, font: 'mono', align: 'left', color: s.c('blue') });
    });
    // All three steps squeezed into one pass, then the same steps on paper.
    const xr = s.w / 2 - 10 * s.u;
    const paper = s.ease('paper', 0.7);
    s.alpha(s.win('depth', 'step1') * (1 - paper), () => {
      s.text('all in one pass:', xr, yBox - 11 * s.u, { size: 3, font: 'mono', weight: 600, align: 'right', color: s.c('red') });
      ['17 × 20', '17 × 4', '340 + 68'].forEach((t, j) => s.text(t, xr, yBox + (j - 1) * 5.4 * s.u, { size: 3, font: 'mono', align: 'right', color: s.c('red') }));
    });
    s.alpha(paper * (1 - s.ease('step1', 0.5)), () => {
      const w = 31 * s.u;
      s.rrect(xr - w, yBox - 13 * s.u, w, 23 * s.u, 1.2, { fill: s.c('--card'), stroke: s.c('--ink-3'), lw: 0.3 });
      s.text('on paper', xr - w / 2, yBox - 9 * s.u, { size: 2.8, font: 'mono', weight: 600, color: s.c('--ink-3') });
      WORKED.forEach((t, j) => s.text(t, xr - w + 2.5 * s.u, yBox + (j - 1) * 5 * s.u + 0.5 * s.u, { size: 2.9, font: 'mono', align: 'left', color: s.c('--ink') }));
    });
    const cy = s.h * 0.92;
    s.alpha(s.ease('feed', 0.6, 1.4) * (1 - s.ease('same', 0.5)), () => s.text('each pass reads the steps already written', s.w / 2, cy, { size: 3, color: s.c('--ink-3') }));
    s.alpha(same, () => s.text('same layers, same weights: more passes', s.w / 2, cy, { size: 3, color: s.c('blue') }));
    s.alpha(s.ease('name', 0.6, 0.4), () => s.text('a chain of thought: each step a link', s.w / 2, cy, { size: 3.2, weight: 600, color: s.c('gold') }));
  },
};

const PROMPT: [string, Ink][] = [
  ['Q: 23 × 3?', '--ink-2'],
  ['A: 20 × 3 = 60. 3 × 3 = 9.', '--ink-2'],
  ['   60 + 9 = 69. So 69.', '--ink-2'],
  ['Q: 17 × 24?', 'orange'],
];
const CHAIN: [string, Ink][] = [
  ['A: 17 × 20 = 340. 17 × 4 = 68.', 'gold'],
  ['   340 + 68 = 408. So 408.', 'gold'],
];

/** A row of small step cells and an answer chip, in either order. */
function reply(s: Scene, y: number, first: boolean, a: number): void {
  const n = 6;
  const cw = 3.6 * s.u;
  const span = n * (cw + 1 * s.u);
  const ansW = 10 * s.u;
  const total = span + 4 * s.u + ansW;
  const L = s.w / 2 - total / 2;
  const stepsX = first ? L : L + ansW + 4 * s.u;
  const ansX = first ? L + span + 4 * s.u + ansW / 2 : L + ansW / 2;
  for (let i = 0; i < n; i++) s.cell(stepsX + i * (cw + 1 * s.u), y - 2.2 * s.u, cw, 4.4 * s.u, '', 'slate');
  word(s, ansX, y, first ? '408' : '418', first ? 'green' : 'red', { size: 3.2, h: 6.5 });
  // The answer can read the steps only when they come before it.
  s.alpha(a, () => {
    const yA = y - 6 * s.u;
    const from = stepsX + span / 2;
    s.ctx.beginPath();
    s.ctx.moveTo(from, y - 3 * s.u);
    s.ctx.quadraticCurveTo((from + ansX) / 2, yA - 3 * s.u, ansX, y - 4 * s.u);
    s.ctx.strokeStyle = s.c(first ? 'green' : 'red');
    s.ctx.lineWidth = 0.35 * s.u;
    s.ctx.setLineDash(first ? [] : [1.2 * s.u, 1 * s.u]);
    s.ctx.stroke();
    s.ctx.setLineDash([]);
    mark(s, first, (from + ansX) / 2, yA - 4.5 * s.u, 3.4);
  });
  s.text(first ? 'steps, then answer' : 'answer, then steps', s.w / 2, y + 7 * s.u, { size: 3, font: 'mono', color: s.c('--ink-3') });
}

const roots: SceneDef = {
  draw(s) {
    cite(s, 'Nye et al., 2021', 1 - s.ease('prompt', 0.6));
    cite(s, 'Wei et al. · Google, 2022', s.win('prompt', 'kojima'));
    cite(s, 'Kojima et al., 2022', s.win('kojima', 'order'));
    // What a single pass handles, and what it does not.
    s.alpha(1 - s.ease('scratch', 0.6), () => {
      const x = s.w / 2 - 30 * s.u;
      const rows: [boolean, string][] = [
        [true, 'writing text: one pass'],
        [true, 'writing code: one pass'],
        [false, 'adding long numbers: many steps'],
        [false, 'running a program: many steps'],
      ];
      rows.forEach(([ok, t], i) => s.alpha(i < 2 ? 1 : cue(s, 'nye', 0.6), () => verdict(s, ok, t, x, s.h * (0.28 + i * 0.12), 3.4)));
    });
    // The scratchpad: steps first, then the answer.
    s.alpha(s.win('scratch', 'prompt'), () => {
      const w = 40 * s.u;
      const L = s.w / 2 - w / 2;
      const top = s.h * 0.26;
      s.rrect(L, top, w, 27 * s.u, 1.2, { fill: s.c('--card'), stroke: s.c('--ink-3'), lw: 0.3 });
      s.text('scratchpad', s.w / 2, top + 4.5 * s.u, { size: 2.9, font: 'mono', weight: 600, color: s.c('--ink-3') });
      lines(s, WORKED.map((t) => [t, '--ink'] as [string, Ink]), L + 4 * s.u, top + 11 * s.u, { size: 3 });
      s.alpha(s.ease('scratch', 0.6, 2), () => s.text('answer: 408', s.w / 2, top + 36 * s.u, { size: 3.6, font: 'mono', weight: 650, color: s.c('green') }));
    });
    // A prompt with a worked example, then the model's own chain.
    const px = s.w / 2 - 28 * s.u;
    const big = { size: 3.3, gap: 6.2 };
    const row = (i: number, y0: number) => y0 + i * big.gap * s.u;
    s.alpha(s.win('prompt', 'kojima'), () => {
      const y0 = s.h * 0.24;
      s.text('prompt', px, s.h * 0.15, { size: 2.9, font: 'mono', weight: 650, align: 'left', color: s.c('--ink-3') });
      lines(s, PROMPT, px, y0, big);
      // The worked example, bracketed.
      const bx = px + 55 * s.u;
      s.line(bx, row(0, y0) - 2 * s.u, bx, row(2, y0) + 2 * s.u, s.c('--ink-3'), 0.3);
      s.text('worked', bx + 2 * s.u, row(1, y0) - 2 * s.u, { size: 2.8, font: 'mono', align: 'left', color: s.c('--ink-3') });
      s.text('example', bx + 2 * s.u, row(1, y0) + 2 * s.u, { size: 2.8, font: 'mono', align: 'left', color: s.c('--ink-3') });
      s.alpha(1 - s.ease('named', 0.4, 0.4), () => lines(s, [['A:', '--ink-2']], px, row(4, y0), big));
      s.alpha(s.ease('named', 0.6, 0.4), () => {
        lines(s, CHAIN, px, row(4, y0), big);
        s.text('the model\'s chain of thought', px, row(6, y0) + 2 * s.u, { size: 3, font: 'mono', weight: 650, align: 'left', color: s.c('gold') });
      });
    });
    // One sentence in place of the examples, and what it bought.
    s.alpha(s.win('kojima', 'order'), () => {
      lines(s, [['Q: 17 × 24?', 'orange'], ['A: Let\'s think step by step.', 'teal']], px, s.h * 0.16, big);
      s.alpha(s.ease('kojima', 0.6, 1.5), () => lines(s, [['   17 × 20 = 340. 17 × 4 = 68.', 'gold'], ['   340 + 68 = 408. So 408.', 'gold']], px, row(2, s.h * 0.16), big));
      s.alpha(s.ease('gain', 0.6), () => {
        const x0 = px;
        const full = 50 * s.u;
        const g = s.ease('gain', 1, 0.3);
        s.text('arithmetic word problems, % right', x0, s.h * 0.58, { size: 2.9, font: 'mono', align: 'left', color: s.c('--ink-3') });
        const bar = (y: number, v: number, k: Ink, t: string) => {
          s.rrect(x0, y - 2.2 * s.u, Math.max(0.8 * s.u, full * v * g), 4.4 * s.u, 1, { fill: s.tint(k, 0.45), stroke: s.c(k), lw: 0.3 });
          s.text(t, x0 + full * v * g + 2 * s.u, y, { size: 3.1, font: 'mono', weight: 600, align: 'left', color: s.c(k), halo: true });
        };
        bar(s.h * 0.66, 0.177, 'slate', 'without: 17.7%');
        bar(s.h * 0.75, 0.787, 'green', 'with it: 78.7%');
      });
    });
    // The answer's pass reads only what came before it.
    s.alpha(s.ease('order', 0.6), () => {
      reply(s, s.h * 0.36, true, s.ease('order', 0.6, 1.2));
      reply(s, s.h * 0.72, false, cue(s, 'order', 0.55));
    });
  },
};

const STEPS = 30;

const cost: SceneDef = {
  draw(s) {
    const cw = 4;
    const per = 16;
    const xs = columns(s, per, cw + 1);
    const y1 = s.h * 0.2;
    const y2 = s.h * 0.37;
    const lab = (t: string, y: number) => s.text(t, s.w / 2, y, { size: 3, font: 'mono', color: s.c('--ink-3') });
    const row = (y: number, n: number, k: (i: number) => 'gold' | 'slate', a: (i: number) => number) => {
      for (let i = 0; i < n; i++) {
        const r = Math.floor(i / per);
        const x = n <= 2 ? s.w / 2 + (i - 0.5) * (cw + 1) * s.u : xs[i % per]!;
        s.alpha(a(i), () => s.cell(x - (cw / 2) * s.u, y + r * 5.4 * s.u - 2.2 * s.u, cw * s.u, 4.4 * s.u, '', k(i), { on: k(i) === 'gold' ? 1 : 0 }));
      }
    };
    lab('at once: 2 tokens', y1 - 5 * s.u);
    row(y1, 2, () => 'gold', () => 1);
    s.alpha(s.ease('tokens', 0.6, 2), () => {
      lab('with steps: 30 + 2 tokens', y2 - 5 * s.u);
      row(y2, STEPS + 2, (i) => (i < STEPS ? 'slate' : 'gold'), (i) => s.ease('tokens', 0.3, 2.2 + i * 0.07));
    });
    // Time: one pass per token, so a bar per reply, as long as its token count.
    const x0 = s.w * (s.tall ? 0.1 : 0.2);
    const full = s.w * (s.tall ? 0.62 : 0.5);
    const hb = 4.4 * s.u;
    const yA = s.h * 0.61;
    const yB = s.h * 0.7;
    s.alpha(s.ease('ms', 0.6), () => {
      lab('one pass per token, 20 ms each', s.h * 0.53);
      s.rrect(x0, yA - hb / 2, (full * 40) / 640, hb, 1, { fill: s.tint('gold', 0.45), stroke: s.c('gold'), lw: 0.3 });
      s.text('40 ms', x0 + (full * 40) / 640 + 2 * s.u, yA, { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c('gold') });
    });
    s.alpha(s.ease('slow', 0.4), () => {
      const g = s.ease('slow', 1.4, 0.3);
      const ws = ((full * 600) / 640) * g;
      const hi = s.ease('extra', 0.6);
      s.rrect(x0, yB - hb / 2, Math.max(ws, 0.8 * s.u), hb, 1, { fill: s.tint('slate', 0.35 + 0.25 * hi), stroke: s.c('slate'), lw: 0.3 + 0.2 * hi });
      s.alpha(Math.max(0, g - 0.9) * 10, () => {
        s.rrect(x0 + ws, yB - hb / 2, (full * 40) / 640, hb, 1, { fill: s.tint('gold', 0.45), stroke: s.c('gold'), lw: 0.3 });
        s.text('640 ms', x0 + full + 2 * s.u, yB, { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c('--ink-2') });
      });
      s.alpha(hi, () => s.text('steps: 600 ms more', x0 + ws / 2, yB + 5.4 * s.u, { size: 3, font: 'mono', weight: 650, color: s.c('--ink-2') }));
    });
    s.alpha(s.ease('ratio', 0.6), () => s.text('640 / 40 = 16 times, as 32 / 2', s.w / 2, s.h * 0.82, { size: 3.4, font: 'mono', weight: 600, color: s.c('--ink-2') }));
    s.alpha(s.ease('long', 0.6), () => s.text('2,000 × 20 ms = 40,000 ms = 40 s', s.w / 2, s.h * 0.92, { size: 3.8, font: 'mono', weight: 650, color: s.c('red') }));
  },
};

const budget: SceneDef = {
  draw(s) {
    // The budget run backwards: tokens that fit in 2 s, less the answer's.
    const bw = s.w * (s.tall ? 0.78 : 0.64);
    const L = s.w / 2 - bw / 2;
    const hb = 7 * s.u;
    const y = s.h * 0.3;
    s.text('within 2 s = 2,000 ms', s.w / 2, s.h * 0.18, { size: 3.2, font: 'mono', color: s.c('--ink-2') });
    s.rrect(L, y - hb / 2, bw, hb, 1, { fill: s.tint('slate', 0.12 + 0.18 * s.ease('fit', 0.6)), stroke: s.c('slate'), lw: 0.3 });
    s.alpha(s.ease('fit', 0.6), () => {
      const g = s.ease('fit', 1.2, 0.2);
      for (let i = 1; i < 100 * g; i++) s.line(L + (bw * i) / 100, y - hb / 2 + 0.6 * s.u, L + (bw * i) / 100, y + hb / 2 - 0.6 * s.u, s.tint('slate', 0.45), 0.15);
      s.text('2,000 / 20 = 100 tokens', s.w / 2, y + 8 * s.u, { size: 3.1, font: 'mono', weight: 600, color: s.c('--ink-2') });
    });
    s.alpha(s.ease('left', 0.6, 0.3), () => {
      const split = L + bw * 0.8;
      s.rrect(split, y - hb / 2, L + bw - split, hb, 1, { fill: s.tint('gold', 0.45), stroke: s.c('gold'), lw: 0.3 });
      s.text('answer: 20', L + bw, y + 14 * s.u, { size: 3.1, font: 'mono', weight: 650, align: 'right', color: s.c('gold') });
      s.text('steps: 100 − 20 = 80', L, y + 14 * s.u, { size: 3.1, font: 'mono', weight: 650, align: 'left', color: s.c('--ink-2') });
    });
    const vx = s.w / 2 - (s.tall ? 40 : 36) * s.u;
    s.alpha(s.ease('helps', 0.6, 0.3), () => {
      s.text('17 × 24', vx + 5 * s.u, s.h * 0.55, { size: 3.8, font: 'mono', weight: 650, align: 'left', color: s.c('orange') });
      verdict(s, true, 'steps help: each needs the last', vx, s.h * 0.64, 3.4);
    });
    s.alpha(s.ease('recall', 0.6, 0.3), () => {
      s.text('the capital of France', vx + 5 * s.u, s.h * 0.77, { size: 3.8, font: 'mono', weight: 650, align: 'left', color: s.c('orange') });
      verdict(s, false, 'nothing to build on: only cost', vx, s.h * 0.86, 3.4);
    });
  },
};

export const scenes: Record<string, SceneDef> = { depth, roots, cost, budget };

import type { Scene, SceneDef } from '../../../lecture/scene';
import { after, cells, rowLabel } from '../../draw';
import { rich } from '../../linear-algebra/draw';
import { box, chip } from '../../sequences/draw';
import { num } from '../draw';

const TOKS = ['Paris', 'Milan', 'Rome'] as const;
const KS = ['purple', 'slate', 'teal'] as const;
// Made-up lens readouts for the tower, bottom to top: a capital, then a city in Italy, then Rome.
const READ = [
  [1.0, 0.6, 0.4],
  [0.8, 1.6, 1.0],
  [0.4, 1.2, 2.1],
  [0.2, 0.6, 2.8],
];
const LEVEL = ['x₀', 'x₁', 'x₂', 'x₃'];
const HALF = 2;

/** Who introduced an idea, and when: small, at the top left, clear of the legend over the bars. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'left', color: s.c('--ink-2'), halo: true }));
}

function caption(s: Scene, text: string, a: number, k: (typeof KS)[number] | '--ink-2' | 'green' = '--ink-2') {
  s.alpha(a, () => s.text(text, s.w / 2, s.h * 0.94, { size: 3.4, font: 'mono', color: s.c(k), halo: true }));
}

/** Where the tower's stream, its levels and the bars beside them sit. */
function tower(s: Scene) {
  const sx = s.w / 2 - 14 * s.u;
  const ys = [0.78, 0.58, 0.38, 0.18].map((f) => s.h * f);
  return { sx, ys, bx: sx + 27 * s.u };
}

/** One level's reading: an arrow through W_U to three bars standing just below the level, the winner named. */
function readout(s: Scene, sx: number, bx: number, y: number, v: number[], grow: number) {
  if (grow <= 0.003) return;
  const base = y + 3 * s.u;
  const best = v.indexOf(Math.max(...v));
  s.alpha(grow, () => {
    s.arrow(sx + 5.5 * s.u, y, bx - 10 * s.u, y, s.c('purple'), 0.35, 1.6);
    s.text('W_U', (sx + bx) / 2 - 2 * s.u, y - 2.6 * s.u, { size: 2.6, font: 'mono', weight: 650, color: s.c('purple'), halo: true });
    s.line(bx - 8.5 * s.u, base, bx + 8.5 * s.u, base, s.c('--axis'), 0.3);
    s.text(TOKS[best]!, bx + 10.5 * s.u, y, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c(KS[best]!) });
  });
  v.forEach((val, j) => {
    const x = bx + (j - 1) * 5.6 * s.u;
    const hh = val * 3.2 * s.u * grow;
    s.rrect(x - 2.1 * s.u, base - hh, 4.2 * s.u, hh, 0.5, { fill: s.tint(KS[j]!, j === best ? 0.75 : 0.3), stroke: s.c(KS[j]!), lw: 0.25 });
  });
}

/** A card-colored backing, so the stream line runs behind a chip or a block instead of through it. */
const backing = (s: Scene, x: number, y: number, w: number, h: number) => s.rrect(x - (w / 2) * s.u, y - (h / 2) * s.u, w * s.u, h * s.u, 1.4, { fill: s.c('--card') });

const ask: SceneDef = {
  draw(s) {
    const { sx, ys, bx } = tower(s);
    const rise = s.ease('read', 1.6, 1.5);
    // The stream: from the last word's vector up past every block.
    s.line(sx, ys[0]!, sx, ys[0]! + (ys[3]! - ys[0]!) * rise, s.c('orange'), 0.6);
    ys.forEach((y, i) => {
      const a = i === 0 ? s.ease('read', 0.6, 0.8) : s.ease('read', 0.5, 1.5 + 0.5 * i);
      s.alpha(a, () => {
        backing(s, sx, y, 9, 6.5);
        chip(s, sx, y, LEVEL[i]!, 'orange', { w: 9, h: 6.5, on: i === HALF ? s.win('ask', 'lens') : 0 });
      });
      if (i < 3) {
        s.alpha(s.ease('read', 0.5, 1.8 + 0.5 * i), () => {
          const yb = (y + ys[i + 1]!) / 2;
          backing(s, sx, yb, 20, 5.5);
          box(s, sx, yb, `block ${i}`, '--ink-2', { w: 20, h: 5.5, size: 3 });
        });
      }
    });
    // The words; the stream starts from the last one.
    s.alpha(1 - s.ease('same', 0.5), () => {
      const o = { size: 3.4, weight: 600 } as const;
      const y = s.h * 0.92;
      rich(s, [['the capital of Italy ', '--ink-3'], ['is', 'orange']], s.w / 2, y, o);
      const half = s.measure('is', { ...o, font: 'mono' }) / 2;
      const ix = s.w / 2 + s.measure('the capital of Italy is', { ...o, font: 'mono' }) / 2 - half;
      s.alpha(s.ease('read', 0.6, 0.5), () => s.arrow(ix, y - 2.6 * s.u, sx + 3 * s.u, ys[0]! + 3.8 * s.u, s.c('orange'), 0.35, 1.6));
    });

    // The legend over the bars.
    s.alpha(s.ease('top', 0.6), () => rich(s, [['Paris', KS[0]], ['  ', '--ink-3'], ['Milan', KS[1]], ['  ', '--ink-3'], ['Rome', KS[2]]], bx + 3 * s.u, 5 * s.u, { size: 3.2, weight: 600 }));
    // The top's answer, then the lens at every height, halfway first.
    readout(s, sx, bx, ys[3]!, READ[3]!, s.ease('top', 0.8, 0.8));
    s.alpha(s.win('ask', 'lens'), () => s.text('?', bx, ys[HALF]!, { size: 7, font: 'mono', weight: 700, color: s.c('--ink-3') }));
    for (let i = 0; i < 3; i++) {
      const order = i === HALF ? 0 : i === 0 ? 1 : 2;
      readout(s, sx, bx, ys[i]!, READ[i]!, s.ease('lens', 0.8, 0.5 + 1.0 * order));
    }
    // What the stream holds at the halfway level and at the top.
    s.alpha(s.win('same', 'name'), () => {
      const o = { size: 3.1, font: 'mono' as const, align: 'right' as const, color: s.c('--ink-2'), halo: true };
      s.text('x₀ + 2 writes', sx - 6 * s.u, ys[HALF]!, o);
      s.text('x₀ + 3 writes', sx - 6 * s.u, ys[3]!, o);
    });
    // The early guesses, ringed as they sharpen.
    s.alpha(after(s, 'forms', 0.55), () => {
      ys.slice(0, 3).forEach((y, i) => s.alpha(after(s, 'forms', 0.55 + 0.12 * i), () => s.rrect(bx + 9 * s.u, y - 3.4 * s.u, 13 * s.u, 6.8 * s.u, 1.2, { stroke: s.tint(KS[READ[i]!.indexOf(Math.max(...READ[i]!))]!, 0.8), lw: 0.35 })));
    });

    cite(s, 'nostalgebraist, 2020', s.win('history', 'forms'));
    caption(s, 'the same width at every height', s.win('same', 'lens'));
    caption(s, 'W_U at every height: the guess so far', s.win('lens', 'name'), 'green');
    caption(s, 'logit lens: read the logits, look inside', s.win('name', 'borrow'), 'green');
    caption(s, 'the model\'s own W_U, nothing retrained', s.win('borrow', 'history'));
    caption(s, 'GPT-2: 48 blocks, sensible guesses midway', s.win('history', 'forms'));
    caption(s, 'early guesses: wrong, but sensible', s.ease('forms', 0.6));
  },
};

const ROWS = [
  [2, 0],
  [1, 1],
  [0, 2],
];
const X0 = [1, 0];
const WRITE = [-1, 2];
const X1 = [0, 2];
const S0 = ROWS.map((r) => r[0]! * X0[0]! + r[1]! * X0[1]!);
const S1 = ROWS.map((r) => r[0]! * X1[0]! + r[1]! * X1[1]!);

const example: SceneDef = {
  draw(s) {
    const cx = s.w / 2 - 6 * s.u;
    const rc = [cx - 12 * s.u, cx];
    const sx = cx + 20 * s.u;
    const bx = sx + 7 * s.u;
    const ys = [s.h * 0.17, s.h * 0.29, s.h * 0.41];
    const lx = rc[0]! - 8 * s.u;
    const swap = s.ease('again', 0.6, 0.4);
    const now = swap > 0.5 ? S1 : S0;
    const best = now.indexOf(Math.max(...now));
    s.text('row of W_U', (rc[0]! + rc[1]!) / 2, s.h * 0.06, { size: 3, font: 'mono', color: s.c('--ink-3') });
    s.alpha(s.ease('dot', 0.6), () => s.text('score', sx + 6 * s.u, s.h * 0.06, { size: 3, font: 'mono', color: s.c('--ink-3') }));
    ROWS.forEach((r, i) => {
      const lit = i === 0 ? s.win('dot', 'rest') : 0;
      rowLabel(s, TOKS[i]!, lx, ys[i]!, KS[i]!, 3.6);
      cells(s, rc, ys[i]!, r.map((v) => num(v)), KS[i]!, { w: 10, h: 8, on: [lit, lit] });
      // Paris first, then the other two; the scores change as the stream does.
      const a = i === 0 ? after(s, 'dot', 0.75) : after(s, 'rest', 0.05 + 0.15 * i);
      s.alpha(a * (1 - 0.85 * s.win('write', 'again')), () => {
        const v = now[i]!;
        const fade = swap > 0 && swap < 1 ? Math.abs(2 * swap - 1) : 1;
        s.alpha(fade, () => {
          cells(s, [sx], ys[i]!, [num(v)], KS[i]!, { w: 10, h: 8, on: [i === best && (s.since('rest') > 0) ? after(s, 'rest', 0.6) : 0] });
          const len = v * 4 * s.u;
          if (len > 0) s.rrect(bx, ys[i]! - 2.2 * s.u, len, 4.4 * s.u, 0.6, { fill: s.tint(KS[i]!, i === best ? 0.75 : 0.3), stroke: s.c(KS[i]!), lw: 0.25 });
        });
      });
    });
    const yx = s.h * 0.6;
    const moved = s.ease('write', 0.6, 1.6);
    s.alpha(s.ease('x0', 0.6), () => {
      rowLabel(s, moved > 0.5 ? 'x₁' : 'x₀', lx, yx, 'orange', 3.8);
      const fade = moved > 0 && moved < 1 ? Math.abs(2 * moved - 1) : 1;
      s.alpha(fade, () => cells(s, rc, yx, (moved > 0.5 ? X1 : X0).map((v) => num(v)), 'orange', { w: 10, h: 8, on: [s.win('dot', 'rest'), s.win('dot', 'rest')] }));
    });
    // Block 0's write, added in.
    s.alpha(s.win('write', 'later'), () => {
      const yw = s.h * 0.73;
      rowLabel(s, '+ write', lx, yw, 'blue', 3.4);
      cells(s, rc, yw, WRITE.map((v) => num(v)), 'blue', { w: 10, h: 8 });
      s.arrow(rc[1]! + 7 * s.u, yw, rc[1]! + 7 * s.u, yx + 5 * s.u, s.c('blue'), 0.35, 1.8);
    });
    s.alpha(s.win('dot', 'rest'), () => s.text('2·1 + 0·0 = 2', s.w / 2, s.h * 0.86, { size: 3.6, font: 'mono', weight: 600, color: s.c('purple'), halo: true }));
    s.alpha(s.win('rest', 'write') * after(s, 'rest', 0.5), () => rich(s, [['lens at x₀: ', '--ink-2'], ['Paris', 'purple']], s.w / 2, s.h * 0.86, { size: 3.8, weight: 650 }));
    s.alpha(after(s, 'write', 0.6) * (1 - s.ease('again', 0.4)), () => s.text('[1, 0] + [−1, 2] = [0, 2]', s.w / 2, s.h * 0.86, { size: 3.6, font: 'mono', weight: 600, color: s.c('orange'), halo: true }));
    s.alpha(after(s, 'again', 0.6), () => rich(s, [['lens after block 0: ', '--ink-2'], ['Rome', 'teal']], s.w / 2, s.h * 0.86, { size: 3.8, weight: 650 }));
    s.alpha(after(s, 'later', 0.3), () => s.text('later writes can still move the top', s.w / 2, s.h * 0.94, { size: 3.3, font: 'mono', color: s.c('--ink-3'), halo: true }));
  },
};

export const scenes: Record<string, SceneDef> = { ask, example };

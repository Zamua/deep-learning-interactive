import type { Scene, SceneDef } from '../../../lecture/scene';
import { clamp01 } from '../../../lecture/scene';
import type { Ink } from '../draw';
import { note, rich } from '../draw';

/** Generation steps; step t (row t) holds t tokens. */
const N = 10;

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

/** The staircase grid: room for 11 columns, so a second, upturned staircase can complete the rectangle. */
function geom(s: Scene) {
  const c = 5 * s.u;
  const x0 = s.w / 2 - (11 * c) / 2 + 3 * s.u;
  const y0 = s.h * 0.11;
  return { c, x0, y0, yb: y0 + N * c };
}
type G = ReturnType<typeof geom>;

function cell(s: Scene, g: G, t: number, j: number, k: Ink, strong: boolean, dy = 0) {
  const p = 0.35 * s.u;
  s.rrect(g.x0 + j * g.c + p, g.y0 + (t - 1) * g.c + p + dy, g.c - 2 * p, g.c - 2 * p, 0.5, { fill: s.tint(k, strong ? 0.55 : 0.14), stroke: s.tint(k, strong ? 0.9 : 0.5), lw: 0.22 });
}

function stepLabel(s: Scene, g: G, t: number) {
  s.text(`step ${t}`, g.x0 - 2 * s.u, g.y0 + (t - 0.5) * g.c, { size: 2.4, font: 'mono', align: 'right', color: s.c('--ink-3') });
}

/** Rows 1..n revealed, `on(t)` the fade of row t, from a count that grows smoothly. */
const reveal = (rows: number) => (t: number) => clamp01(rows - (t - 1));

const again: SceneDef = {
  draw(s) {
    const g = geom(s);
    const u = s.u;
    const on = reveal(1 + (N - 1) * s.span('loop', 'same') + (s.t >= s.at('same') ? N : 0));
    const redo = s.ease('redo', 0.8, 0.8);
    const area = s.ease('area', 1.2, 2.2);
    const head = 1 - s.ease('formula', 0.5);
    s.alpha(1 - s.ease('area', 0.5, 3.6), () => s.text('position', g.x0 + (N * g.c) / 2, g.y0 - 3 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
    for (let t = 1; t <= N; t++) {
      s.alpha(on(t), () => {
        stepLabel(s, g, t);
        for (let j = 0; j < t; j++) {
          if (j === t - 1) cell(s, g, t, j, 'gold', true);
          else {
            cell(s, g, t, j, 'slate', false);
            s.alpha(redo, () => cell(s, g, t, j, 'red', true));
          }
        }
      });
    }
    s.alpha(redo, () => rich(s, [['■ ', 'gold'], ['new token   ', '--ink-3'], ['■ ', 'red'], ['computed again', '--ink-3']], s.w / 2, g.yb + 5 * u, { size: 3, weight: 600 }));

    // The first token's key, recomputed at every step.
    s.alpha(s.win('same', 'count'), () => {
      s.rrect(g.x0 - 0.2 * u, g.y0 - 0.2 * u, g.c + 0.4 * u, N * g.c + 0.4 * u, 1, { stroke: s.c('green'), lw: 0.5 });
      note(s, 'the first token\'s key: 10 times, the same', s.w / 2, g.yb + 13 * u, 'green', 3.1);
    });

    // Each row's count, then the staircase completed to a 10 by 11 rectangle by an upturned copy.
    const cnt = s.win('count', 'area');
    for (let t = 1; t <= N; t++) {
      s.alpha(cnt * clamp01(s.prog('count') * 1.4 * N - (t - 1)), () => s.text(String(t), g.x0 + t * g.c + 2.2 * u, g.y0 + (t - 0.5) * g.c, { size: 2.8, font: 'mono', weight: 650, align: 'left', color: s.c('red') }));
    }
    s.alpha(cnt, () => rich(s, [['1 + 2 + … + 10', '--ink-2'], [' keys per block', '--ink-3']], s.w / 2, g.yb + 13 * u, { size: 3.4, weight: 600 }));
    s.alpha(area, () => {
      const off = (1 - area) * 7 * u;
      for (let t = 1; t <= N; t++) for (let j = t; j <= N; j++) cell(s, g, t, j, 'blue', false, -off);
    });
    const box = s.ease('area', 0.6, 4.2);
    s.alpha(box, () => s.rrect(g.x0 - 0.3 * u, g.y0 - 0.3 * u, 11 * g.c + 0.6 * u, N * g.c + 0.6 * u, 1, { stroke: s.c('--ink-2'), lw: 0.45 }));
    s.alpha(box * head, () => {
      s.text('11', g.x0 + 5.5 * g.c, g.y0 - 3 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c('--ink-2') });
      s.text('10', g.x0 + 11 * g.c + 2 * u, g.y0 + (N / 2) * g.c, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('--ink-2') });
    });
    s.alpha(s.ease('formula', 0.6), () => {
      s.text('T + 1', g.x0 + 5.5 * g.c, g.y0 - 3 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c('--ink-2') });
      s.text('T', g.x0 + 11 * g.c + 2 * u, g.y0 + (N / 2) * g.c, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('--ink-2') });
    });
    s.alpha(s.ease('area', 0.6, 5.5), () => rich(s, [['10 × 11 / 2 = ', '--ink-2'], ['55', 'red'], [' keys per block', '--ink-3']], s.w / 2, g.yb + 13 * u, { size: 3.4, weight: 600 }));
    s.alpha(s.ease('formula', 0.6, 2), () => rich(s, [['T steps: ', '--ink-3'], ['T(T + 1) / 2', 'red'], [' keys', '--ink-3']], s.w / 2, g.yb + 20 * u, { size: 3.4, weight: 600 }));
    s.alpha(s.ease('thousand', 0.6), () => rich(s, [['T = 1,000: ', '--ink-3'], ['500,500', 'red'], [' keys', '--ink-3']], s.w / 2, g.yb + 27 * u, { size: 3.4, weight: 600 }));
  },
};

const cache: SceneDef = {
  draw(s) {
    const g = geom(s);
    const u = s.u;
    // The whole cache first; then rebuilt step by step, each row sliding the row above down unchanged.
    const whole = s.ease('keep', 0.8, 0.3) * (1 - s.ease('step', 0.6));
    const on = reveal(1 + (N - 1) * s.span('step', 'q') + (s.t >= s.at('q') ? N : 0));
    for (let t = 1; t <= N; t++) {
      const a = Math.max(whole, on(t));
      s.alpha(0.2 * (1 - a), () => {
        for (let j = 0; j < t; j++) cell(s, g, t, j, 'slate', false);
      });
      s.alpha(a, () => {
        stepLabel(s, g, t);
        const dy = -(1 - on(t)) * (1 - whole) * g.c;
        for (let j = 0; j < t - 1; j++) cell(s, g, t, j, 'green', false, dy);
      });
      s.alpha(Math.max(whole, smoothOn(on(t))), () => cell(s, g, t, t - 1, 'gold', true));
    }
    s.alpha(s.ease('keep', 0.6, 0.6), () => rich(s, [['■ ', 'gold'], ['new: computed   ', '--ink-3'], ['■ ', 'green'], ['cached: read back', '--ink-3']], s.w / 2, g.yb + 5 * u, { size: 3, weight: 600 }));
    s.alpha(s.win('keep', 'name'), () => rich(s, [['KV cache', '--ink-2'], [': the ', '--ink-3'], ['K', 'purple'], ['eys and ', '--ink-3'], ['V', 'gold'], ['alues', '--ink-3']], s.w / 2, g.yb + 13 * u, { size: 3.4, weight: 600 }));
    s.alpha(s.win('name', 'step'), () => note(s, 'cache: a store kept close, to use again', s.w / 2, g.yb + 13 * u, '--ink-2', 3.2));
    cite(s, 'Liptay, 1968 · IBM System/360 Model 85', s.win('name', 'step'));
    s.alpha(s.win('step', 'slide'), () => rich(s, [['q', 'teal'], [', ', '--ink-3'], ['k', 'purple'], [', ', '--ink-3'], ['v', 'gold'], [': the newest token only', '--ink-3']], s.w / 2, g.yb + 13 * u, { size: 3.2, weight: 600 }));
    s.alpha(s.win('slide', 'q'), () => note(s, 'each row: the row above, plus one', s.w / 2, g.yb + 13 * u, 'green', 3.2));
    s.alpha(s.win('q', 'work'), () => {
      rich(s, [['q', 'teal'], [': used once, at its own step', '--ink-3']], s.w / 2, g.yb + 13 * u, { size: 3.2, weight: 600 });
      rich(s, [['k', 'purple'], [', ', '--ink-3'], ['v', 'gold'], [': read by every later step', '--ink-3']], s.w / 2, g.yb + 20 * u, { size: 3.2, weight: 600 });
    });
    s.alpha(s.ease('work', 0.6), () => {
      rich(s, [['10 keys', 'gold'], [' instead of ', '--ink-3'], ['55', 'red']], s.w / 2, g.yb + 13 * u, { size: 3.4, weight: 600 });
      rich(s, [['T = 1,000: ', '--ink-3'], ['1,000', 'gold'], [' instead of ', '--ink-3'], ['500,500', 'red']], s.w / 2, g.yb + 20 * u, { size: 3.2, weight: 600 });
    });
  },
};

/** The new token's cell arrives in the second half of its row's fade, after the slide. */
const smoothOn = (v: number) => clamp01((v - 0.5) * 2);

const size: SceneDef = {
  draw(s) {
    const u = s.u;
    const c = 4.6 * u;
    const d = 6;
    const gap = 7 * u;
    const x0 = s.w / 2 - d * c - gap / 2;
    const y0 = s.h * 0.17;
    const yb = y0 + 8 * c;
    const grow = s.win('grow', 'stack');
    const st = s.ease('stack', 0.8);
    const six = s.ease('memory', 0.5) > 0.5;
    const rows = 7;
    ['keys', 'values'].forEach((lab, m) => {
      const xx = x0 + m * (d * c + gap);
      const k: Ink = m ? 'gold' : 'purple';
      const shape = grow > 0.5 ? '(8, d)' : six ? '(7, 6)' : '(7, d)';
      s.text(`${lab}: ${shape}`, xx + (d * c) / 2, y0 - 4 * u, { size: 3, font: 'mono', weight: 650, color: s.c(k) });
      // The other three blocks' caches, behind this one.
      s.alpha(st, () => {
        for (let b = 3; b >= 1; b--) s.rrect(xx + b * 1.2 * u, y0 + b * 1.2 * u, d * c, rows * c, 0.8, { fill: s.c('--card'), stroke: s.tint(k, 0.55), lw: 0.25 });
        s.rrect(xx, y0, d * c, rows * c, 0.8, { fill: s.c('--card') });
      });
      s.alpha(s.ease('shape', 0.6), () => {
        for (let i = 0; i < rows; i++) {
          s.alpha(s.ease('shape', 0.4, 0.3 + 0.25 * i), () => {
            for (let j = 0; j < d; j++) s.rrect(xx + j * c + 0.3 * u, y0 + i * c + 0.3 * u, c - 0.6 * u, c - 0.6 * u, 0.5, { fill: s.tint(k, 0.3) });
          });
        }
      });
      s.alpha(grow, () => {
        for (let j = 0; j < d; j++) s.rrect(xx + j * c + 0.3 * u, y0 + rows * c + 0.3 * u, c - 0.6 * u, c - 0.6 * u, 0.5, { fill: s.tint(k, 0.65) });
      });
      const mem = m ? s.ease('pair', 0.6) : s.ease('memory', 0.6, 2);
      s.alpha(mem, () => note(s, m ? '+ 42' : '7 × 6 = 42', xx + (d * c) / 2, yb + 3 * u, k, 3.2));
    });
    s.alpha(s.win('shape', 'grow'), () => note(s, 'one row per token, d numbers each', s.w / 2, yb + 10 * u, '--ink-2', 3.2));
    s.alpha(grow, () => note(s, 'one more token: one more row', s.w / 2, yb + 10 * u, '--ink-2', 3.2));
    s.alpha(s.win('stack', 'pair'), () => note(s, '4 blocks stacked: (4, 7, d)', s.w / 2, yb + 10 * u, '--ink-2', 3.2));
    s.alpha(s.ease('pair', 0.6, 1.2), () => rich(s, [['one block: ', '--ink-3'], ['84', '--ink-2'], [' numbers', '--ink-3']], s.w / 2, yb + 10 * u, { size: 3.2, weight: 600 }));
    s.alpha(s.ease('total', 0.6), () => rich(s, [['4 blocks: 4 × 84 = ', '--ink-3'], ['336', '--ink-2'], [' numbers', '--ink-3']], s.w / 2, yb + 17 * u, { size: 3.4, weight: 650 }));
    s.alpha(s.ease('general', 0.6, 0.5), () => {
      rich(s, [['2', '--ink-2'], [' × blocks × ', '--ink-3'], ['T', '--ink-2'], [' × ', '--ink-3'], ['d', '--ink-2'], [' numbers', '--ink-3']], s.w / 2, yb + 25 * u, { size: 3.6, weight: 650 });
      s.alpha(s.ease('general', 0.6, 5), () => note(s, 'for every sequence being written', s.w / 2, yb + 31 * u, '--ink-3', 3));
    });
  },
};

export const scenes: Record<string, SceneDef> = { again, cache, size };

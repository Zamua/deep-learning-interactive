import type { Scene, SceneDef } from '../../../lecture/scene';
import { Rng } from '../../../core/rand';
import { cells, columns, rowLabel } from '../../draw';
import { after, caption, unit } from '../draw';

const H = [2, 1, 3, 2];
const M = [1, 0, 1, 0];
const P = 0.5;

/** Where the units, the mask and the output sit. */
function layout(s: Scene) {
  const xs = columns(s, 4, s.tall ? 20 : 22);
  return { xs, lx: xs[0]! - 13 * s.u, yh: s.h * 0.2, ym: s.h * 0.44, yo: s.h * 0.68 };
}

/** The units of h as circles, dimmed and struck through where `off`. */
function units(s: Scene, xs: number[], y: number, off: number[]) {
  xs.forEach((x, i) => {
    const o = off[i] ?? 0;
    s.alpha(1 - 0.65 * o, () => unit(s, x, y, 6, String(H[i]), 'gold', 0, 3.8));
    if (o > 0.003) s.alpha(o, () => s.line(x - 5 * s.u, y + 5 * s.u, x + 5 * s.u, y - 5 * s.u, s.c('red'), 0.5));
  });
}

const drop: SceneDef = {
  draw(s) {
    const L = layout(s);
    const u = s.u;
    const mA = s.ease('mask', 0.6);
    rowLabel(s, 'h', L.lx, L.yh, 'gold', 3.8);
    units(s, L.xs, L.yh, M.map((m) => (1 - m) * after(s, 'mask', 0.6)));
    s.alpha(mA, () => {
      rowLabel(s, 'm', L.lx, L.ym, '--ink-2', 3.8);
      L.xs.forEach((x, i) => s.cell(x - 5.5 * u, L.ym - 4.25 * u, 11 * u, 8.5 * u, String(M[i]), M[i] ? 'green' : 'red', { on: 0.5 }));
      s.text('p = 0.5: keep each unit with probability ½', s.w / 2, L.ym - 10 * u, { size: 3.2, font: 'mono', color: s.c('--ink-3'), halo: true });
    });
    const zA = s.ease('zeroed', 0.6);
    const sc = s.ease('scale', 0.8);
    s.alpha(zA, () => {
      L.xs.forEach((x) => s.arrow(x, L.ym + 5 * u, x, L.yo - 5.5 * u, s.c('--ink-3'), 0.35, 2));
      rowLabel(s, 'out', L.lx, L.yo, 'gold', 3.8);
      s.alpha(1 - sc, () => cells(s, L.xs, L.yo, H.map((v, i) => String(v * M[i]!)), 'gold', { w: 11, h: 8.5 }));
      s.alpha(sc, () => cells(s, L.xs, L.yo, H.map((v, i) => String((v * M[i]!) / P)), 'gold', { w: 11, h: 8.5, on: M.map((m) => m * s.win('scale', 'why')) }));
    });
    s.alpha(sc, () => s.text('÷ p', L.xs[3]! + 10 * u, (L.ym + L.yo) / 2, { size: 3.6, font: 'mono', weight: 650, align: 'left', color: s.c('gold'), halo: true }));
    const cy = s.h * 0.86;
    s.alpha(s.win('zeroed', 'scale'), () => caption(s, 'h × m = [2, 0, 3, 0]', cy, 'gold', 3.8));
    s.alpha(s.win('scale', 'why'), () => caption(s, '÷ 0.5 = [4, 0, 6, 0]', cy, 'gold', 3.8));
    s.alpha(s.ease('why', 0.6), () => {
      caption(s, 'unit 0 on average: ½ × 4 + ½ × 0 = 2 = h', cy, 'gold', 3.5);
      for (const [y, r] of [[L.yh, 7.5], [L.yo, 6.5]] as const) s.rrect(L.xs[0]! - r * u, y - r * u, 2 * r * u, 2 * r * u, 2, { stroke: s.tint('gold', 0.8), lw: 0.45 });
    });
  },
};

/** Random masks for the `lean` beat, one every 0.7 seconds. */
const MASKS = (() => {
  const rng = new Rng(11);
  return Array.from({ length: 40 }, () => H.map(() => (rng.next() < P ? 1 : 0)));
})();

const test: SceneDef = {
  draw(s) {
    const L = layout(s);
    const u = s.u;
    const lean = s.ease('lean', 0.6);
    const k = Math.max(0, Math.floor(s.since('lean') / 0.7)) % MASKS.length;
    const off = MASKS[k]!.map((m) => (1 - m) * lean);
    rowLabel(s, 'h', L.lx, L.yh, 'gold', 3.8);
    units(s, L.xs, L.yh, off);
    s.alpha(1 - lean, () => {
      L.xs.forEach((x) => s.arrow(x, L.yh + 7 * u, x, L.yo - 5.5 * u, s.c('--ink-3'), 0.35, 2));
      rowLabel(s, 'out', L.lx, L.yo, 'gold', 3.8);
      cells(s, L.xs, L.yo, H.map(String), 'gold', { w: 11, h: 8.5, on: H.map(() => s.win('test', 'match')) });
      s.text('keep all, no scaling', s.w / 2, L.yo + 10 * u, { size: 3.4, font: 'mono', weight: 600, color: s.c('green'), halo: true });
    });
    s.alpha(lean, () => s.text('training: a new random mask each time', s.w / 2, L.yo, { size: 3.4, font: 'mono', weight: 600, color: s.c('--ink-2'), halo: true }));
    const cy = s.h * 0.86;
    s.alpha(s.win('test', 'match'), () => caption(s, 'test: out = h = [2, 1, 3, 2]', cy, 'gold', 3.8));
    s.alpha(s.win('match', 'lean'), () => caption(s, 'training average: p × (h / p) = h', cy, 'gold', 3.8));
    s.alpha(lean, () => caption(s, 'no unit can count on another', cy, 'green', 3.8));
  },
};

export const scenes: Record<string, SceneDef> = { drop, test };

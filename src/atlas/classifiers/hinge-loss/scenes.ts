import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { columns } from '../../draw';

const neg = (t: string) => t.replace(/-/g, '−');

interface Plot {
  top: number;
  bot: number;
  lo: number;
  hi: number;
}

/**
 * Score bars around a zero line, the right class tagged `y`, and the margin line one below its
 * score; the part of a wrong bar above the line is its cost, drawn in red.
 */
function hingeBars(s: Scene, vals: number[], y: number, names: string[], P: Plot, o: { line?: number; cost?: number; labels?: number; tag?: number } = {}) {
  const xs = columns(s, vals.length, s.tall ? 26 : 28);
  const Y = (v: number) => lerp(s.h * P.bot, s.h * P.top, (v - P.lo) / (P.hi - P.lo));
  const w = 12 * s.u;
  const z = Y(0);
  s.line(xs[0]! - w, z, xs[xs.length - 1]! + w, z, s.c('--axis'), 0.35);
  const lineV = vals[y]! - 1;
  xs.forEach((x, i) => {
    const v = vals[i]!;
    const right = i === y;
    const k = right ? 'gold' : 'purple';
    const t = Y(v);
    s.rrect(x - w / 2, Math.min(z, t), w, Math.max(Math.abs(z - t), 0.6 * s.u), 1, { fill: s.tint(k, 0.3), stroke: s.tint(k, 0.85), lw: 0.3 });
    const cost = right ? 0 : Math.max(0, v - lineV);
    if (cost > 0 && (o.cost ?? 0) > 0.003) {
      s.alpha(o.cost!, () => {
        s.rrect(x - w / 2, t, w, Y(lineV) - t, 1, { fill: s.tint('red', 0.45), stroke: s.c('red'), lw: 0.35 });
        s.text(`+${+cost.toFixed(2)}`, x + w / 2 + 1.5 * s.u, (t + Y(lineV)) / 2, { size: 3.6, font: 'mono', weight: 700, align: 'left', color: s.c('red'), halo: true });
      });
    }
    s.alpha(o.labels ?? 1, () => s.text(neg(String(+v.toFixed(1))), x, v >= 0 ? t - 3.4 * s.u : t + 3.4 * s.u, { size: 3.6, font: 'mono', weight: 600, color: s.c(k), halo: true }));
    s.text(names[i]!, x, s.h * P.bot + 5 * s.u, { size: 3.6, font: 'mono', color: right ? s.c('gold') : s.c('--ink-2') });
  });
  s.alpha(o.tag ?? 1, () => s.text('y', xs[y]!, s.h * P.bot + 10.5 * s.u, { size: 3.8, font: 'mono', weight: 700, color: s.c('gold') }));
  if ((o.line ?? 0) > 0.003) {
    s.alpha(o.line!, () => {
      const ly = Y(lineV);
      s.line(xs[0]! - 7.5 * s.u, ly, xs[xs.length - 1]! + 9 * s.u, ly, s.c('red'), 0.35, [1.4, 1.2]);
      s.text(neg(`s_y-1 = ${+lineV.toFixed(1)}`), xs[0]! - 8.5 * s.u, ly, { size: 2.9, font: 'mono', align: 'right', color: s.c('red') });
    });
  }
  return { xs, Y };
}

const CAT = [3, 5, -1];
const NAMES = ['cat', 'dog', 'ship'];
const P1: Plot = { top: 0.1, bot: 0.72, lo: -2, hi: 8 };

const margin: SceneDef = {
  draw(s) {
    const H = hingeBars(s, CAT, 0, NAMES, P1, { line: s.ease('line', 0.8, 1.6), cost: s.ease('poke', 0.6, 1) });
    s.alpha(s.ease('line', 0.6, 2.4), () => {
      const x = H.xs[0]! + 8.5 * s.u;
      s.line(x, H.Y(3), x, H.Y(2), s.c('gold'), 0.35);
      s.text('1', x + 1.6 * s.u, (H.Y(3) + H.Y(2)) / 2, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('gold') });
    });
    s.alpha(s.ease('safe', 0.6, 0.8), () => s.text(neg('max(0, -3) = 0'), H.xs[2]!, H.Y(0) - 4 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c('green'), halo: true }));
  },
};

const sum: SceneDef = {
  marks: {
    f: { tex: String.raw`\symL = \sum_{j \ne \symy} \max(0,\ \syms_j - \syms_{\symy} + 1)`, x: 0.5, y: 0.16, size: 5 },
  },
  draw(s) {
    s.show('f', s.ease('formula', 0.6));
    const x = s.w / 2 - (s.tall ? 36 : 40) * s.u;
    const o = { size: 3.6, font: 'mono', align: 'left' } as const;
    s.alpha(s.ease('formula', 0.6, 1.2), () => {
      s.text(neg('dog:  max(0, 5 - 3 + 1) = 3'), x, s.h * 0.4, { ...o, color: s.c('red') });
      s.text(neg('ship: max(0, -1 - 3 + 1) = 0'), x, s.h * 0.51, { ...o, color: s.c('green') });
    });
    s.alpha(s.ease('skip', 0.6), () => s.text('cat:  skipped (always 1)', x, s.h * 0.62, { ...o, color: s.c('--ink-3') }));
    s.alpha(s.ease('sum', 0.6), () => s.text('L = 3 + 0 = 3', s.w / 2, s.h * 0.82, { size: 4.6, font: 'mono', weight: 650, color: s.c('red') }));
  },
};

const zero: SceneDef = {
  draw(s) {
    const c = lerp(3, 7, s.ease('raise', 2));
    const vals = [c, 5, -1];
    hingeBars(s, vals, 0, NAMES, P1, { line: 1, cost: 1 });
    const L = Math.max(0, 5 - (c - 1)) + Math.max(0, -1 - (c - 1));
    s.alpha(1 - s.ease('zero', 0.6), () => s.text(`L = ${L.toFixed(1)}`, s.w / 2, s.h * 0.93, { size: 4.2, font: 'mono', weight: 650, color: s.c('red') }));
    s.alpha(s.ease('zero', 0.6), () => s.text('L = 0: wins by at least 1', s.w / 2, s.h * 0.93, { size: 4.2, font: 'mono', weight: 650, color: s.c('green') }));
  },
};

export const scenes: Record<string, SceneDef> = { margin, sum, zero };

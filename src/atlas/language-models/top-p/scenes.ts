import type { Scene, SceneDef } from '../../../lecture/scene';
import { bars } from '../../draw';
import { note, rich, spread } from '../draw';

const TOK = ['the', 'a', 'this', 'my', 'dog', 'ran'];
const P = [0.4, 0.25, 0.15, 0.1, 0.06, 0.04];
const Q = P.slice(0, 3).map((p) => p / 0.8);
const SURE: [string, number][] = [['the', 0.85], ['a', 0.05], ['this', 0.04], ['my', 0.03], ['dog', 0.02], ['ran', 0.01]];
const FLAT: [string, number][] = [['red', 0.24], ['blue', 0.2], ['green', 0.16], ['gold', 0.12], ['gray', 0.1], ['pink', 0.08], ['tan', 0.06], ['jade', 0.04]];
const f2 = (v: number) => v.toFixed(2);

const tail: SceneDef = {
  draw(s) {
    const xs = spread(s, 6, s.tall ? 16 : 17);
    const base = s.h * 0.66;
    const cut = s.ease('topk', 0.7, 0.6);
    const rn = s.ease('renorm', 1, 1.6);
    const risky = s.win('risk', 'topk');
    s.alpha(1 - rn, () => bars(s, xs, base, P, 'teal', { max: 0.5, height: 36, w: 10, grow: s.ease('dist', 0.9), fmt: f2, hi: P.map((_, i) => (i < 3 ? s.win('topk', 'renorm') : 0)) }));
    s.alpha(rn, () => bars(s, xs.slice(0, 3), base, Q, 'gold', { max: 0.5, height: 36, w: 10, grow: 1, fmt: f2, hi: [1, 1, 1] }));
    TOK.forEach((t, i) => s.text(t, xs[i]!, base + 4 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c(i >= 3 && cut > 0.5 ? '--ink-3' : '--ink-2') }));
    s.alpha(risky, () => {
      const x0 = xs[3]! - 6 * s.u;
      const x1 = xs[5]! + 6 * s.u;
      s.rrect(x0, base - 16 * s.u, x1 - x0, 16 * s.u + 7.5 * s.u, 1.6, { stroke: s.c('red'), lw: 0.4 });
      note(s, 'the tail: 0.20 in all', (x0 + x1) / 2, base - 20 * s.u, 'red', 3);
    });
    s.alpha(cut, () => {
      const x = (xs[2]! + xs[3]!) / 2;
      s.line(x, base - 40 * s.u, x, base + 7 * s.u, s.c('slate'), 0.45, [1.4, 1]);
      note(s, 'k = 3', x - 2 * s.u, base - 40 * s.u, 'slate', 3.2, 'right');
      s.alpha(1 - rn, () => {
        const x0 = xs[3]! - 5.5 * s.u;
        s.rrect(x0, base - 14 * s.u, xs[5]! + 5.5 * s.u - x0, 14.5 * s.u, 1, { fill: s.tint('--card', 0.72) });
      });
    });
    s.alpha(s.ease('renorm', 0.6), () => {
      rich(s, [['kept: 0.40 + 0.25 + 0.15 = ', '--ink-3'], ['0.80', 'gold']], s.w / 2, s.h * 0.81, { size: 3.4, weight: 600 });
      note(s, 'divide each by 0.80: they add up to 1 again', s.w / 2, s.h * 0.9, '--ink-2', 3.2);
    });
  },
};

/** Probabilities as one strip from 0 to 1, a segment per token, cut where the running total reaches `p`. */
function strip(s: Scene, y: number, items: [string, number][], p: number, a: number, cut: number, label: string, plabel = true): number {
  let kept = 0;
  let run = 0;
  for (const [, q] of items) {
    if (run >= p - 1e-9) break;
    run += q;
    kept++;
  }
  s.alpha(a, () => {
    const x0 = s.w / 2 - (s.tall ? 44 : 50) * s.u;
    const W = (s.tall ? 88 : 100) * s.u;
    const h = 8 * s.u;
    let acc = 0;
    items.forEach(([t, q], i) => {
      const on = i < kept ? cut : 0;
      const x = x0 + acc * W;
      s.rrect(x + 0.2 * s.u, y - h / 2, q * W - 0.4 * s.u, h, 0.8, { fill: s.tint(i < kept && cut > 0.5 ? 'gold' : 'teal', 0.25 + 0.45 * on), stroke: s.tint(i < kept && cut > 0.5 ? 'gold' : 'teal', 0.7) });
      if (q * W > s.measure(t, { size: 2.8, font: 'mono' }) + 3 * s.u) s.text(t, x + (q * W) / 2, y + 0.2 * s.u, { size: 2.8, font: 'mono', weight: 600, color: s.c('--ink') });
      acc += q;
    });
    s.text(label, x0, y - h / 2 - 3.4 * s.u, { size: 3, align: 'left', color: s.c('--ink-3') });
    s.alpha(cut, () => {
      const xp = x0 + p * W;
      s.line(xp, y - h / 2 - 2 * s.u, xp, y + h / 2 + 2 * s.u, s.c('red'), 0.5);
      if (plabel) s.text(`p = ${p}`, xp, y + h / 2 + 4.6 * s.u, { size: 2.8, font: 'mono', weight: 600, color: s.c('red') });
      s.text(`keeps ${kept}`, x0 + W, y - h / 2 - 3.4 * s.u, { size: 3, font: 'mono', weight: 650, align: 'right', color: s.c('gold') });
    });
  });
  return kept;
}

const nucleus: SceneDef = {
  draw(s) {
    const main: [string, number][] = TOK.map((t, i) => [t, P[i]!]);
    const lim = s.ease('limits', 0.6);
    s.alpha(1 - lim, () => {
      strip(s, s.h * 0.2, main, 0.8, 1, s.ease('topp', 0.6, 3), 'running total, most likely first', false);
      s.alpha(s.ease('topp', 0.6, 1.5), () => {
        const x0 = s.w / 2 - (s.tall ? 44 : 50) * s.u;
        const W = (s.tall ? 88 : 100) * s.u;
        let acc = 0;
        [0.4, 0.25, 0.15].forEach((q, i) => {
          acc += q;
          s.alpha(s.ease('topp', 0.4, 1.8 + 0.7 * i), () => s.text(i === 2 ? '0.80 = p' : f2(acc), x0 + acc * W, s.h * 0.2 + 8.6 * s.u, { size: 2.8, font: 'mono', weight: 650, color: s.c(i === 2 ? 'red' : 'gold'), halo: true }));
        });
      });
      strip(s, s.h * 0.48, SURE, 0.8, s.ease('sure', 0.6), s.ease('sure', 0.6, 1.4), 'a sure model');
      strip(s, s.h * 0.74, FLAT, 0.8, s.ease('unsure', 0.6), s.ease('unsure', 0.6, 1.4), 'an unsure model');
    });
    strip(s, s.h * 0.3, main, 0.01, lim, s.ease('limits', 0.6, 0.8), 'a tiny p, or k = 1');
    strip(s, s.h * 0.62, main, 1, s.ease('limits', 0.6, 2.4), s.ease('limits', 0.6, 3.2), 'p = 1, or k = V');
    s.alpha(s.ease('limits', 0.6, 1.4), () => note(s, 'greedy: always the top token', s.w / 2, s.h * 0.3 + 13 * s.u, '--ink-2', 3.2));
    s.alpha(s.ease('limits', 0.6, 3.6), () => note(s, 'plain sampling: nothing cut', s.w / 2, s.h * 0.62 + 13 * s.u, '--ink-2', 3.2));
  },
};

export const scenes: Record<string, SceneDef> = { tail, nucleus };

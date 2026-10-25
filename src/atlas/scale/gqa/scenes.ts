import type { Scene, SceneDef } from '../../../lecture/scene';
import { chip, columns, line } from '../modern-draw';

const H = 8;

/** Query heads in a row and `g` key-value heads below, each wired to the query heads it serves. */
function heads(s: Scene, g: number, o: { yq: number; yk: number; yv?: number; on?: number; links?: number }): void {
  const pitch = s.tall ? 12 : 13;
  const xq = columns(s, H, pitch);
  const per = H / g;
  const xk = Array.from({ length: g }, (_, j) => (xq[j * per]! + xq[(j + 1) * per - 1]!) / 2);
  const kw = Math.min(per * pitch - 3, 30);
  s.alpha(o.links ?? 1, () => {
    xq.forEach((x, i) => s.line(x, o.yq + 3.5 * s.u, xk[Math.floor(i / per)]!, o.yk - 3.5 * s.u, s.tint('green', 0.6), 0.3));
    if (o.yv !== undefined) xk.forEach((x) => s.line(x, o.yk + 3.5 * s.u, x, o.yv! - 3.5 * s.u, s.tint('gold', 0.6), 0.3));
  });
  xq.forEach((x, i) => chip(s, x, o.yq, `q${i}`, 'purple', { w: pitch - 3, h: 7, size: 2.8 }));
  const w = g === H ? pitch - 3 : kw;
  xk.forEach((x) => chip(s, x, o.yk, o.yv === undefined ? 'k, v' : 'k', 'green', { w, h: 7, size: g === H && o.yv === undefined ? 2.4 : 3, on: o.on ?? 0 }));
  if (o.yv !== undefined) xk.forEach((x) => chip(s, x, o.yv!, 'v', 'gold', { w, h: 7, size: 3, on: o.on ?? 0 }));
}

const heads8: SceneDef = {
  draw(s) {
    const y = { yq: s.h * 0.16, yk: s.h * 0.38, yv: s.h * 0.52 };
    s.text('query heads', s.w / 2, s.h * 0.07, { size: 3.2, color: s.c('purple') });
    heads(s, H, { ...y, on: s.ease('cache', 0.6), links: s.ease('mha', 0.6, 0.6) });
    s.alpha(s.ease('mha', 0.6, 1.5), () => s.text('one key and one value head each', s.w / 2, s.h * 0.62, { size: 3.2, color: s.c('--ink-3') }));
    line(s, s.ease('cache', 0.6, 1.5), '2 × 8 × 64 = 1,024 numbers', s.w / 2, s.h * 0.74, 'teal', { size: 3.8, font: 'mono', weight: 650 });
    line(s, s.ease('cache', 0.6, 2.5), 'per token, per layer', s.w / 2, s.h * 0.81, '--ink-3', { size: 3.2 });
    line(s, s.ease('big', 0.6), '× every layer × every token: gigabytes', s.w / 2, s.h * 0.9, 'red', { size: s.tall ? 3.2 : 3.6, weight: 600 });
  },
};

const share: SceneDef = {
  draw(s) {
    const y = { yq: s.h * 0.2, yk: s.h * 0.4, yv: s.h * 0.53 };
    heads(s, 2, { ...y, on: s.ease('shrink', 0.6), links: s.ease('group', 0.6, 0.6) });
    s.alpha(s.ease('group', 0.6, 2), () => {
      const xq = columns(s, H, s.tall ? 12 : 13);
      [0, 4].forEach((i) => {
        const a = xq[i]! - 4.5 * s.u;
        const b = xq[i + 3]! + 4.5 * s.u;
        const yb = y.yq - 6 * s.u;
        s.line(a, yb + 1.2 * s.u, a, yb, s.c('--ink-3'), 0.3);
        s.line(a, yb, b, yb, s.c('--ink-3'), 0.3);
        s.line(b, yb, b, yb + 1.2 * s.u, s.c('--ink-3'), 0.3);
        s.text('group of 4', (a + b) / 2, yb - 3 * s.u, { size: 3, font: 'mono', color: s.c('--ink-3') });
      });
    });
    line(s, s.win('attend', 'shrink'), 'own scores, shared keys and values', s.w / 2, s.h * 0.66, '--ink-2', { size: 3.4 });
    line(s, s.ease('shrink', 0.6), '2 × 2 × 64 = 256 numbers', s.w / 2, s.h * 0.74, 'teal', { size: 3.8, font: 'mono', weight: 650 });
    line(s, s.ease('shrink', 0.6, 2), 'h / g = 8 / 2: four times smaller', s.w / 2, s.h * 0.83, 'green', { size: 3.4, weight: 600 });
  },
};

const extremes: SceneDef = {
  draw(s) {
    const rows: [number, string, string][] = [
      [H, 'g = h = 8: multi-head', 'mha'],
      [2, 'g = 2: grouped-query', 'between'],
      [1, 'g = 1: multi-query', 'mqa'],
    ];
    rows.forEach(([g, label, beat], r) => {
      const y0 = s.h * (0.12 + r * 0.3);
      s.alpha(s.ease(beat, 0.6), () => {
        s.text(label, s.w / 2, y0, { size: 3.4, font: 'mono', weight: 600, color: s.c(beat === 'between' ? 'green' : '--ink-2') });
        heads(s, g, { yq: y0 + 7 * s.u, yk: y0 + 16 * s.u, on: beat === 'between' ? s.ease('between', 0.6, 1) : 0 });
      });
    });
  },
};

export const scenes: Record<string, SceneDef> = { heads: heads8, share, extremes };

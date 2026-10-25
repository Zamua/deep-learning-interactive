import type { Scene, SceneDef } from '../../../lecture/scene';
import { ball } from '../../optimization/draw';
import { axes, curve, fmt, frame, rich } from '../draw';

const sig = (z: number) => 1 / (1 + Math.exp(-z));
const nls = (z: number) => -Math.log(sig(z));

/** Two answer cards with their scores, side by side near the top. */
function cards(s: Scene, y: number, ra: string, rb: string, o: { on?: [number, number]; a?: number } = {}): { xa: number; xb: number } {
  const xa = s.w / 2 - 17 * s.u;
  const xb = s.w / 2 + 17 * s.u;
  [
    [xa, 'answer a', ra, o.on?.[0] ?? 0],
    [xb, 'answer b', rb, o.on?.[1] ?? 0],
  ].forEach(([x, name, r, on]) => {
    s.rrect((x as number) - 13 * s.u, y - 6 * s.u, 26 * s.u, 12 * s.u, 1.6, { fill: s.tint('slate', 0.12), stroke: s.tint('slate', 0.5 + 0.5 * (on as number)), lw: 0.3 + 0.3 * (on as number) });
    s.text(name as string, x as number, y - 2.4 * s.u, { size: 3, color: s.c('--ink-3') });
    s.alpha(o.a ?? 1, () => s.text(r as string, x as number, y + 2.6 * s.u, { size: 3.6, font: 'mono', weight: 650, color: s.c('gold') }));
  });
  return { xa, xb };
}

const compare: SceneDef = {
  marks: {
    soft: { tex: String.raw`\sigma(\sym{r}{r}_a - \sym{r}{r}_b) = \frac{e^{\sym{r}{r}_a}}{e^{\sym{r}{r}_a} + e^{\sym{r}{r}_b}}`, x: 0.5, y: 0.88, size: 5 },
  },
  draw(s) {
    const y = s.h * 0.12;
    const shift = s.ease('gap', 1.2, 0.6);
    const ra = 2 + 10 * shift;
    const rb = 1 + 10 * shift;
    const sc = s.ease('score', 0.6);
    cards(s, y, `r = ${ra.toFixed(1)}`, `r = ${rb.toFixed(1)}`, { a: sc, on: [s.win('sigma', 'soft'), 0] });
    s.alpha(1 - sc, () => s.text('which is better?', s.w / 2, y + 11 * s.u, { size: 3.2, color: s.c('--ink-2') }));
    // σ of the gap, with the gap marked.
    const F = frame(s.w / 2 - 34 * s.u, s.h * 0.3, s.w / 2 + 34 * s.u, s.h * 0.74, [-4, 4], [0, 1]);
    const pl = s.ease('sigma', 0.8);
    s.alpha(pl, () => {
      axes(s, F, 'r_a − r_b', 'σ', { x: 'gold', y: 'teal' });
      s.line(F.X(0), F.b, F.X(0), F.t, s.tint('--axis', 0.6), 0.25, [1, 1]);
      curve(s, F, sig, -4, 4, 'teal', { upto: pl });
      const p = sig(1);
      s.line(F.X(1), F.b, F.X(1), F.Y(p), s.tint('gold', 0.7), 0.3, [1, 0.8]);
      s.line(F.l, F.Y(p), F.X(1), F.Y(p), s.tint('teal', 0.7), 0.3, [1, 0.8]);
      ball(s, F.X(1), F.Y(p), 'teal', 1.6);
      s.text('0.73', F.X(1) + 2.5 * s.u, F.Y(p) + 3.4 * s.u, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('teal'), halo: true });
      s.text('gap 1', F.X(1) + 1.5 * s.u, F.b - 3 * s.u, { size: 2.8, font: 'mono', align: 'left', color: s.c('gold'), halo: true });
    });
    s.show('soft', s.win('soft', 'gap'));
    s.alpha(s.ease('gap', 0.6, 2), () => s.text('same gap, same 0.73', s.w / 2, s.h * 0.88, { size: 3.4, font: 'mono', weight: 600, color: s.c('green') }));
  },
};

const loss: SceneDef = {
  marks: {
    f: { tex: String.raw`\symL = -\ln \sigma(\sym{r}{r}_w - \sym{r}{r}_l)`, x: 0.5, y: 0.25, size: 4.6 },
  },
  draw(s) {
    const y = s.h * 0.1;
    const pu = s.ease('push', 0.8, 2);
    const ag = s.ease('agree', 1.6, 0.4) * (1 - s.ease('rank', 0.6));
    const { xa, xb } = cards(s, y, 'r = 2.0', 'r = 1.0', { on: [s.win('pairs', 'flip'), s.win('flip', 'push')] });
    s.alpha(s.win('pairs', 'flip'), () => s.text('chosen', xa, y + 8.5 * s.u, { size: 2.8, font: 'mono', color: s.c('green') }));
    s.alpha(s.win('flip', 'push'), () => s.text('chosen, had b won', xb, y + 8.5 * s.u, { size: 2.8, font: 'mono', color: s.c('green') }));
    s.alpha(pu * (1 - s.ease('rank', 0.6)), () => {
      s.text('↑ 0.27', xa, y + 8.5 * s.u, { size: 3, font: 'mono', weight: 650, color: s.c('green') });
      s.text('↓ 0.27', xb, y + 8.5 * s.u, { size: 3, font: 'mono', weight: 650, color: s.c('red') });
    });
    s.show('f', s.ease('loss', 0.6));
    // The loss against the gap: small when the chosen answer scores higher.
    const F = frame(s.w / 2 - 34 * s.u, s.h * 0.35, s.w / 2 + 34 * s.u, s.h * 0.78, [-3, 3], [0, 3.2]);
    axes(s, F, 'r_w − r_l', 'loss', { x: 'gold', y: 'red' });
    curve(s, F, nls, -3, 3, 'red', { upto: s.ease('loss', 1.2) });
    const dot = (z: number, label: string, a: number) =>
      s.alpha(a, () => {
        ball(s, F.X(z), F.Y(nls(z)), 'red', 1.5);
        s.text(label, F.X(z) + 2.5 * s.u, F.Y(nls(z)) - 3 * s.u, { size: 3, font: 'mono', weight: 650, align: 'left', color: s.c('red'), halo: true });
      });
    dot(1, 'a won: 0.31', s.ease('loss', 0.6, 2.5) * (1 - ag));
    dot(-1, 'b won: 1.31', s.ease('flip', 0.6, 0.6) * (1 - ag));
    // A sliding pair: the push is 1 − σ of the gap, small once the model agrees.
    s.alpha(ag, () => {
      const z = -2 + 4.5 * s.ease('agree', 3, 0.8);
      ball(s, F.X(z), F.Y(nls(z)), 'red', 1.5);
      rich(s, [['gap ', '--ink-3'], [fmt(z, 1), 'gold'], ['  push ', '--ink-3'], [fmt(1 - sig(z)), 'green']], s.w / 2, s.h * 0.9, { size: 3.2, weight: 600 });
    });
    s.alpha(s.ease('rank', 0.6), () => s.text('only gaps between scores matter', s.w / 2, s.h * 0.9, { size: 3.4, color: s.c('--ink-2') }));
  },
};

export const scenes: Record<string, SceneDef> = { compare, loss };

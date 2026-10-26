import type { Scene, SceneDef } from '../../../lecture/scene';
import { after } from '../../backprop/draw';
import { ball } from '../../optimization/draw';
import { axes, curve, type Frame, frame, rich } from '../draw';

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
    const { xa, xb } = cards(s, y, 'r = 2.0', 'r = 1.0', { on: [s.win('pairs', 'flip'), s.win('flip')] });
    s.alpha(s.win('pairs', 'flip'), () => s.text('chosen', xa, y + 8.5 * s.u, { size: 2.8, font: 'mono', color: s.c('green') }));
    s.alpha(s.win('flip'), () => s.text('chosen, had b won', xb, y + 8.5 * s.u, { size: 2.8, font: 'mono', color: s.c('green') }));
    s.show('f', s.ease('loss', 0.6));
    // The loss against the gap: small when the chosen answer scores higher.
    const F = lossFrame(s, 0.35, 0.78);
    axes(s, F, 'r_w − r_l', 'loss', { x: 'gold', y: 'red' });
    curve(s, F, nls, -2.6, 3, 'red', { upto: s.ease('loss', 1.2) });
    const dot = (z: number, label: string, a: number) =>
      s.alpha(a, () => {
        ball(s, F.X(z), F.Y(nls(z)), 'red', 1.5);
        s.text(label, F.X(z) + 2.5 * s.u, F.Y(nls(z)) - 3 * s.u, { size: 3, font: 'mono', weight: 650, align: 'left', color: s.c('red'), halo: true });
      });
    dot(1, 'a won: 0.31', s.ease('loss', 0.6, 2.5));
    dot(-1, 'b won: 1.31', s.ease('flip', 0.6, 0.6));
  },
};

/** The loss against the gap, between `top` and `bottom` (fractions of the stage height). */
const lossFrame = (s: Scene, top: number, bottom: number): Frame => frame(s.w / 2 - 34 * s.u, s.h * top, s.w / 2 + 34 * s.u, s.h * bottom, [-3, 3], [0, 3.2]);

// The worked problem: b preferred, though a scores 3 and b scores 1.
const tryIt: SceneDef = {
  draw(s) {
    const y = s.h * 0.1;
    const { xb } = cards(s, y, 'r = 3.0', 'r = 1.0', { on: [0, s.ease('p1', 0.6, 1)] });
    s.alpha(s.ease('p1', 0.6, 1), () => s.text('chosen', xb, y + 8.5 * s.u, { size: 2.8, font: 'mono', color: s.c('green') }));
    s.alpha(s.ease('p1', 0.6, 4), () => s.text('use σ(−2) ≈ 0.12, ln 0.12 ≈ −2.12', s.w / 2, s.h * 0.235, { size: 3, font: 'mono', color: s.c('--ink-3') }));
    s.alpha(after(s, 'a1', 0.05), () => rich(s, [['gap: r_b − r_a = 1 − 3 = ', '--ink-2'], ['−2', 'gold']], s.w / 2, s.h * 0.31, { size: 3.4, weight: 600 }));
    s.alpha(after(s, 'a1', 0.55), () => rich(s, [['σ(−2) ≈ ', '--ink-2'], ['0.12', 'teal'], [' for b', '--ink-3']], s.w / 2, s.h * 0.38, { size: 3.4, weight: 600 }));
    const F = lossFrame(s, 0.46, 0.82);
    s.alpha(s.ease('a2', 0.6), () => {
      axes(s, F, 'r_w − r_l', 'loss', { x: 'gold', y: 'red' });
      curve(s, F, nls, -2.6, 3, 'red');
      ball(s, F.X(-2), F.Y(nls(-2)), 'red', 1.5);
      s.text('2.12', F.X(-2) + 2.5 * s.u, F.Y(nls(-2)) - 1 * s.u, { size: 3, font: 'mono', weight: 650, align: 'left', color: s.c('red'), halo: true });
    });
    s.alpha(after(s, 'a2', 0.3), () => rich(s, [['L = −ln 0.12 ≈ ', '--ink-2'], ['2.12', 'red']], s.w / 2, s.h * 0.92, { size: 3.6, weight: 650 }));
  },
};

export const scenes: Record<string, SceneDef> = { compare, loss, try: tryIt };

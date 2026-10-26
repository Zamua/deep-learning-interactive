import type { Scene, SceneDef } from '../../../lecture/scene';
import { after, band, gate, mono, wire } from '../../backprop/draw';
import { ball } from '../../optimization/draw';
import { axes, clipped, curve, type Frame, fmt, frame, rich } from '../draw';

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
    curve(s, F, nls, -3, 3, 'red', { upto: s.ease('loss', 1.2) });
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

// The pair a won, walked backward: gap 1, sigma 0.73, loss 0.31.
const P = sig(1);
const DP = -1 / P;
const DZ = -(1 - P);
const dl = (z: number) => -(1 - sig(z));

const slope: SceneDef = {
  marks: {
    cancel: { tex: String.raw`-\frac{1}{\sigma} \cdot \sigma(1 - \sigma) = -(1 - \sigma)`, x: 0.5, y: 0.43, size: 4.2 },
  },
  draw(s) {
    const u = s.u;
    const R = 4.5;
    const at = band(s, 100, 10);
    const [wx, wy] = at([0.06, 0.1]);
    const [lx, ly] = at([0.06, 0.3]);
    const [mx, my] = at([0.3, 0.2]);
    const [gx, gy] = at([0.58, 0.2]);
    const [nx, ny] = at([0.84, 0.2]);
    const [ox, oy] = at([1, 0.2]);
    const fwd = (f: number) => after(s, 'chain', f);
    const back = s.ease('back', 0.6);
    const sg = after(s, 'sig', 0.6);
    const sc = after(s, 'scores', 0.55);
    mono(s, 'r_w', wx - 1.6 * u, wy, 'gold', 3.6, 'right', 650);
    mono(s, 'r_l', lx - 1.6 * u, ly, 'gold', 3.6, 'right', 650);
    wire(s, wx, wy, mx, my, { r1: R, t: 0.45, val: '2', grad: fmt(DZ), ga: sc, hot: sc });
    wire(s, lx, ly, mx, my, { r1: R, t: 0.45, val: '1', grad: `+${fmt(-DZ)}`, ga: sc, hot: sc });
    wire(s, mx, my, gx, gy, { r0: R, r1: R, val: 'z = 1', va: fwd(0.3), grad: fmt(DZ), ga: sg, hot: sg });
    wire(s, gx, gy, nx, ny, { r0: R, r1: R, val: fmt(P), va: fwd(0.65), grad: fmt(DP), ga: after(s, 'back', 0.6), hot: back });
    wire(s, nx, ny, ox, oy, { r0: R, val: '0.31', va: fwd(0.85), grad: '1', ga: back, hot: back });
    s.text('L', ox + 1.6 * u, oy, { size: 4.6, italic: true, weight: 550, align: 'left', color: s.c('red') });
    gate(s, mx, my, '−', '--ink-2', s.win('scores', 'push'), R);
    gate(s, gx, gy, 'σ', 'teal', s.win('sig', 'cancel'), R);
    gate(s, nx, ny, '−ln', '--ink-2', s.win('back', 'sig'), R);
    // Each gate's local slope, under it.
    const note = (x: number, y: number, text: string, a: number) => s.alpha(a, () => mono(s, text, x, y + (R + 4.6) * u, '--ink-3', 3.1, 'center', 600));
    note(nx, ny, '−1/σ', after(s, 'back', 0.35));
    note(gx, gy, 'σ(1 − σ) ≈ 0.20', after(s, 'sig', 0.1));
    s.show('cancel', s.ease('cancel', 0.6));
    // The loss against the gap, with its slope there drawn as a tangent.
    const F = lossFrame(s, 0.52, 0.84);
    axes(s, F, 'r_w − r_l', 'loss', { x: 'gold', y: 'red' });
    curve(s, F, nls, -3, 3, 'red');
    const z = 1 + 1.5 * s.ease('agree', 1.2, 0.3) - 4 * after(s, 'agree', 0.5, 2);
    const k = dl(z);
    s.alpha(sg, () => {
      const d = 0.9;
      clipped(s, F, () => s.line(F.X(z - d), F.Y(nls(z) - k * d), F.X(z + d), F.Y(nls(z) + k * d), s.c('gold'), 0.45));
    });
    ball(s, F.X(z), F.Y(nls(z)), 'red', 1.5);
    s.alpha(sg * (1 - s.ease('agree', 0.4)), () => mono(s, `slope ${fmt(DZ)}`, F.X(1) + 3 * u, F.Y(nls(1)) - 5 * u, 'red', 3.2, 'left', 650));
    const ag = s.ease('agree', 0.6) * (1 - s.ease('rank', 0.6));
    s.alpha(s.win('push', 'agree'), () => rich(s, [['r_w ', 'gold'], [`↑ ${fmt(-DZ)}`, 'green'], ['    r_l ', 'gold'], [`↓ ${fmt(-DZ)}`, 'red']], s.w / 2, s.h * 0.94, { size: 3.4, weight: 650 }));
    s.alpha(ag, () => rich(s, [['gap ', '--ink-3'], [fmt(z, 1), 'gold'], ['  push ', '--ink-3'], [fmt(-k), 'green']], s.w / 2, s.h * 0.94, { size: 3.2, weight: 600 }));
    s.alpha(s.ease('rank', 0.6), () => s.text('only gaps between scores matter', s.w / 2, s.h * 0.94, { size: 3.4, color: s.c('--ink-2') }));
  },
};

export const scenes: Record<string, SceneDef> = { compare, loss, slope };

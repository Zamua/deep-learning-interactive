import type { Scene, SceneDef } from '../../../lecture/scene';
import { after, band, gate, mono, wire } from '../../backprop/draw';
import { ball } from '../../optimization/draw';
import { axes, clipped, curve, type Frame, fmt, frame, rich } from '../draw';

const sig = (z: number) => 1 / (1 + Math.exp(-z));
const nls = (z: number) => -Math.log(sig(z));

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
    curve(s, F, nls, -2.6, 3, 'red');
    const z = 1 + 1.5 * s.ease('agree', 1.2, 0.3) - 4 * after(s, 'agree', 0.5, 2);
    const k = dl(z);
    s.alpha(sg, () => {
      const d = 0.9;
      clipped(s, F, () => s.line(F.X(z - d), F.Y(nls(z) - k * d), F.X(z + d), F.Y(nls(z) + k * d), s.c('gold'), 0.45));
    });
    ball(s, F.X(z), F.Y(nls(z)), 'red', 1.5);
    s.alpha(sg * (1 - s.ease('agree', 0.4)), () => mono(s, `slope ${fmt(DZ)}`, F.X(1) + 3 * u, F.Y(nls(1)) - 5 * u, 'red', 3.2, 'left', 650));
    const ag = s.ease('agree', 0.6);
    s.alpha(s.win('push', 'agree'), () => rich(s, [['r_w ', 'gold'], [`↑ ${fmt(-DZ)}`, 'green'], ['    r_l ', 'gold'], [`↓ ${fmt(-DZ)}`, 'red']], s.w / 2, s.h * 0.94, { size: 3.4, weight: 650 }));
    s.alpha(ag, () => rich(s, [['gap ', '--ink-3'], [fmt(z, 1), 'gold'], ['  push ', '--ink-3'], [fmt(-k), 'green']], s.w / 2, s.h * 0.94, { size: 3.2, weight: 600 }));
  },
};

/** The loss curve with its tangent at gap `z`, `half` gap units each side. */
function tangent(s: Scene, F: Frame, z: number, half = 0.8): void {
  const k = dl(z);
  clipped(s, F, () => s.line(F.X(z - half), F.Y(nls(z) - k * half), F.X(z + half), F.Y(nls(z) + k * half), s.c('gold'), 0.45));
  ball(s, F.X(z), F.Y(nls(z)), 'red', 1.5);
}

// The worked problem: a pair ranked wrong, gap -1, and the slope on the rejected answer's score.
const LS = String.raw`\dfrac{\partial \symL}{\partial \sym{r}{r}_l}`;

const tryIt: SceneDef = {
  marks: {
    given: { tex: String.raw`\sym{r}{r}_w - \sym{r}{r}_l = -1, \quad \sigma(-1) \approx 0.27`, x: 0.5, y: 0.08, size: 4.2 },
    ask: { tex: String.raw`${LS} = \ ?`, x: 0.5, y: 0.2, size: 4.2 },
    z: { tex: String.raw`\dfrac{\partial \symL}{\partial z} = -(1 - 0.27) = -0.73`, x: 0.5, y: 0.2, size: 4 },
    rl: { tex: String.raw`${LS} = -0.73 \times (-1) = 0.73`, x: 0.5, y: 0.34, size: 4 },
  },
  draw(s) {
    s.show('given', s.ease('p1', 0.6, 0.3));
    s.show('ask', after(s, 'p1', 0.75) * (1 - s.ease('a1', 0.4)));
    s.show('z', after(s, 'a1', 0.15));
    s.show('rl', after(s, 'a2', 0.15));
    const F = lossFrame(s, 0.46, 0.84);
    s.alpha(s.ease('p1', 0.6, 2), () => {
      axes(s, F, 'r_w − r_l', 'loss', { x: 'gold', y: 'red' });
      curve(s, F, nls, -2.6, 3, 'red');
    });
    s.alpha(after(s, 'a1', 0.3), () => {
      tangent(s, F, -1);
      mono(s, 'slope −0.73', F.X(-1) + 3 * s.u, F.Y(nls(-1)) - 4 * s.u, 'red', 3.2, 'left', 650);
    });
    s.alpha(after(s, 'a2', 0.6), () => {
      tangent(s, F, 1);
      mono(s, 'ranked right: −0.27', F.X(1) + 2 * s.u, F.Y(nls(1)) - 4.5 * s.u, '--ink-3', 3, 'left', 600);
    });
    s.alpha(after(s, 'a2', 0.3), () => rich(s, [['r_l ', 'gold'], ['↓ 0.73', 'red'], ['    r_w ', 'gold'], ['↑ 0.73', 'green']], s.w / 2, s.h * 0.94, { size: 3.4, weight: 650 }));
  },
};

export const scenes: Record<string, SceneDef> = { slope, try: tryIt };

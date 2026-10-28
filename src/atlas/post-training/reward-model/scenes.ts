import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { after, band, gate, mono, wire } from '../../backprop/draw';
import { ball } from '../../optimization/draw';
import { axes, clipped, curve, type Frame, fmt, frame, type Ink, push, rich } from '../draw';

const sig = (z: number) => 1 / (1 + Math.exp(-z));
const nls = (z: number) => -Math.log(sig(z));
/** The loss's slope in the gap: -(1 - sigma). */
const dl = (z: number) => -(1 - sig(z));

/** A paper's authors and year, top right, while `a` is on. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

function caption(s: Scene, text: string, y: number, k: Ink = '--ink-2', size = 3.4): void {
  s.text(text, s.w / 2, y, { size, font: 'mono', weight: 600, color: s.c(k), halo: true });
}

/** The loss against the gap z, between `top` and `bottom` (fractions of the stage height). */
const lossFrame = (s: Scene, top: number, bottom: number): Frame => frame(s.w / 2 - 34 * s.u, s.h * top, s.w / 2 + 34 * s.u, s.h * bottom, [-3, 3.4], [0, 3.6]);

/** The loss curve's tangent at gap `z`, `half` gap units each side, with the ball on it. */
function tangent(s: Scene, F: Frame, z: number, half = 0.8): void {
  const k = dl(z);
  clipped(s, F, () => s.line(F.X(z - half), F.Y(nls(z) - k * half), F.X(z + half), F.Y(nls(z) + k * half), s.c('gold'), 0.45));
  ball(s, F.X(z), F.Y(nls(z)), 'red', 1.5);
}

/** A stick figure `r` units tall, centered on (x, y) and turned by `ang` radians (0 is upright). */
function figure(s: Scene, x: number, y: number, r: number, ang: number, k: Ink): void {
  const u = s.u;
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  // Points in the figure's own frame (units, y up from its middle), turned and placed on the stage.
  const P = (px: number, py: number): [number, number] => [x + (px * c + py * sn) * r * u, y - (-px * sn + py * c) * r * u];
  const seg = (a: [number, number], b: [number, number]) => s.line(a[0], a[1], b[0], b[1], s.c(k), 0.5);
  const hip = P(0, -0.08);
  const neck = P(0, 0.26);
  seg(hip, neck);
  seg(hip, P(-0.14, -0.5));
  seg(hip, P(0.14, -0.5));
  seg(neck, P(-0.26, 0.12));
  seg(neck, P(0.26, 0.12));
  const [hx, hy] = P(0, 0.4);
  s.circle(hx, hy, 0.1 * r * u, { fill: s.c(k) });
}

// ---- why a pick teaches, and where on the loss curve a pair sits

const learn: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    // Two short clips of a simulated robot; a person picks one.
    s.alpha(1 - s.ease('train', 0.6), () => {
      const cy = s.h * 0.36;
      const pick = s.ease('clips', 0.6, 6);
      [-1, 1].forEach((side, i) => {
        const x = cx + side * 24 * u;
        const on = i === 0 ? pick : 0;
        s.rrect(x - 20 * u, cy - 14 * u, 40 * u, 28 * u, 1.6, { fill: s.tint('slate', 0.1 + 0.05 * on), stroke: s.tint('slate', 0.45 * (1 - on)), lw: 0.3 });
        s.alpha(on, () => s.rrect(x - 20 * u, cy - 14 * u, 40 * u, 28 * u, 1.6, { stroke: s.c('green'), lw: 0.6 }));
        s.text(`clip ${i + 1}`, x - 17 * u, cy - 10.5 * u, { size: 2.8, font: 'mono', align: 'left', color: s.c('--ink-3') });
        s.text('1 to 2 s', x + 17 * u, cy - 10.5 * u, { size: 2.8, font: 'mono', align: 'right', color: s.c('--ink-3') });
        s.line(x - 15 * u, cy + 9 * u, x + 15 * u, cy + 9 * u, s.c('--axis'), 0.35);
        if (i === 0) {
          // Mid backflip, upside down in the air, with the turn drawn around it.
          figure(s, x, cy - 1 * u, 13, Math.PI * 0.9, '--ink-2');
          const c = s.ctx;
          const rr = 10 * u;
          c.beginPath();
          c.arc(x, cy - 1 * u, rr, Math.PI * 0.2, Math.PI * 0.95);
          c.strokeStyle = s.tint('green', 0.8);
          c.lineWidth = 0.4 * u;
          c.stroke();
          const a0 = Math.PI * 0.2;
          s.arrow(x + rr * Math.cos(a0 + 0.3), cy - 1 * u + rr * Math.sin(a0 + 0.3), x + rr * Math.cos(a0), cy - 1 * u + rr * Math.sin(a0), s.tint('green', 0.8), 0.4, 2);
        } else {
          figure(s, x, cy + 7.4 * u, 13, Math.PI / 2, '--ink-2');
        }
      });
      s.alpha(pick, () => s.text('preferred', cx - 24 * u, cy + 18 * u, { size: 3, font: 'mono', weight: 650, color: s.c('green') }));
      s.alpha(s.win('flip', 'train'), () => rich(s, [['900 picks', 'green'], [', under an hour  →  ', '--ink-2'], ['backflips', 'green']], cx, s.h * 0.86, { size: 3.3, weight: 600 }));
    });
    cite(s, 'Christiano et al., 2017', s.win('clips', 'train'));
    // The loss against the gap; training steps downhill.
    const F = lossFrame(s, 0.16, 0.8);
    const cv = s.ease('train', 0.8, 0.4);
    s.alpha(cv, () => {
      axes(s, F, 'z = r_w − r_l', 'loss', { x: 'gold', y: 'red' });
      curve(s, F, nls, -2.8, 3.4, 'red');
    });
    // Where the ball sits: stepping downhill, then a pair ranked right, then one ranked wrong.
    const steps = [0, 0.7, 1.3, 1.8];
    const t = Math.max(0, s.since('train') - 0.35 * (s.end('train') - s.at('train')));
    const hop = Math.min(steps.length - 1, t / 0.9);
    const i = Math.floor(hop);
    const zt = i >= steps.length - 1 ? steps[steps.length - 1]! : lerp(steps[i]!, steps[i + 1]!, Math.min(1, (hop - i) * 1.6));
    const zr = lerp(zt, 3, s.ease('right', 1.2, 0.4));
    const z = lerp(zr, -2, s.ease('wrong', 1.4, 0.4));
    s.alpha(cv, () => {
      const tg = s.ease('right', 0.6, 1.6);
      if (tg > 0.003) s.alpha(tg, () => tangent(s, F, z));
      ball(s, F.X(z), F.Y(nls(z)), 'red', 1.5);
    });
    s.alpha(s.win('train', 'curve'), () => caption(s, 'training: step by step, loss goes down', s.h * 0.93));
    s.alpha(s.win('curve', 'right'), () => caption(s, 'z: the winner\'s score minus the loser\'s', s.h * 0.93, 'gold'));
    s.alpha(s.win('right', 'wrong') * s.ease('right', 0.6, 2), () => {
      mono(s, 'ranked right', F.X(3.3), F.b - 15 * u, '--ink-2', 3.2, 'right', 650);
      mono(s, `slope ${fmt(dl(3))}`, F.X(3.3), F.b - 10.5 * u, '--ink-2', 3.2, 'right', 650);
    });
    s.alpha(s.ease('wrong', 0.6, 2.2), () => mono(s, `ranked wrong: slope ${fmt(dl(-2))}`, F.X(-2) + 3 * u, F.Y(nls(-2)) - 6 * u, 'red', 3.2, 'left', 650));
  },
};

// ---- the pair a won, walked backward: gap 1, sigma 0.73, loss 0.31

const P = sig(1);
const DP = -1 / P;
const DZ = -(1 - P);

const back: SceneDef = {
  marks: {
    cancel: { tex: String.raw`-\frac{1}{\sigma} \cdot \sigma(1 - \sigma) = -(1 - \sigma)`, x: 0.5, y: 0.45, size: 4.2 },
  },
  draw(s) {
    const u = s.u;
    const R = 4.5;
    const at = band(s, 100, 10);
    const [wx, wy] = at([0.06, 0.12]);
    const [lx, ly] = at([0.06, 0.32]);
    const [mx, my] = at([0.3, 0.22]);
    const [gx, gy] = at([0.58, 0.22]);
    const [nx, ny] = at([0.84, 0.22]);
    const [ox, oy] = at([1, 0.22]);
    const g1 = s.ease('graph', 0.6);
    const g2 = s.ease('chain', 0.6);
    const fv = (f: number) => after(s, 'fwd', f);
    const seed = s.ease('ln', 0.6);
    const sc = after(s, 'win', 0.5);
    const sl = after(s, 'lose', 0.5);
    s.alpha(g1, () => {
      mono(s, 'r_w', wx - 1.6 * u, wy, 'gold', 3.6, 'right', 650);
      mono(s, 'r_l', lx - 1.6 * u, ly, 'gold', 3.6, 'right', 650);
      wire(s, wx, wy, mx, my, { r1: R, t: 0.45, val: '2', va: fv(0.1), grad: fmt(DZ), ga: sc, hot: s.win('win', 'lose') });
      wire(s, lx, ly, mx, my, { r1: R, t: 0.45, val: '1', va: fv(0.1), grad: `+${fmt(-DZ)}`, ga: sl, hot: s.win('lose', 'step') });
      gate(s, mx, my, '−', '--ink-2', s.win('win', 'step'), R);
      wire(s, mx, my, gx, gy, { r0: R, r1: R, val: fv(0.3) > 0.5 ? 'z = 1' : 'z', va: Math.max(s.ease('graph', 0.6, 2), fv(0.3)), grad: fmt(DZ), ga: after(s, 'times', 0.6), hot: s.win('times', 'cancel') });
    });
    s.alpha(g2, () => {
      gate(s, gx, gy, 'σ', 'teal', s.win('sig', 'cancel'), R);
      wire(s, gx, gy, nx, ny, { r0: R, r1: R, val: fmt(P), va: fv(0.6), grad: fmt(DP), ga: after(s, 'ln', 0.6), hot: s.win('ln', 'sig') });
      gate(s, nx, ny, '−ln', '--ink-2', s.win('ln', 'sig'), R);
      wire(s, nx, ny, ox, oy, { r0: R, val: '0.31', va: fv(0.85), grad: '1', ga: seed, hot: s.win('ln', 'sig') });
      s.text('L', ox + 1.6 * u, oy, { size: 4.6, italic: true, weight: 550, align: 'left', color: s.c('red') });
    });
    // Each gate's local slope, under it.
    const note = (x: number, y: number, text: string, a: number) => s.alpha(a, () => mono(s, text, x, y + (R + 4.6) * u, '--ink-3', 3.1, 'center', 600));
    note(nx, ny, '−1/σ', after(s, 'ln', 0.3));
    note(gx, gy, 'σ(1 − σ) ≈ 0.20', after(s, 'sig', 0.2));
    s.show('cancel', s.ease('cancel', 0.6));
    s.alpha(s.ease('rule', 0.6, 1), () => mono(s, '1 − 0.73 = 0.27, made negative', s.w / 2, s.h * 0.53, 'teal', 3.1, 'center', 600));
    // The loss against the gap, with the pair on it and, once found, its slope as a tangent.
    const F = lossFrame(s, 0.6, 0.86);
    s.alpha(s.ease('fwd', 0.6, 1), () => {
      axes(s, F, 'z', 'loss', { x: 'gold', y: 'red' });
      curve(s, F, nls, -2.8, 3.4, 'red');
      const tg = after(s, 'times', 0.7);
      s.alpha(tg, () => tangent(s, F, 1));
      ball(s, F.X(1), F.Y(nls(1)), 'red', 1.5);
      s.alpha(tg, () => mono(s, `slope ${fmt(DZ)}`, F.X(1) + 3 * u, F.Y(nls(1)) - 5 * u, 'red', 3.2, 'left', 650));
    });
    s.alpha(s.ease('step', 0.6, 1), () => rich(s, [['r_w ', 'gold'], ['↑', 'green'], ['   r_l ', 'gold'], ['↓', 'red'], ['   same amount', '--ink-2']], s.w / 2, s.h * 0.95, { size: 3.4, weight: 650 }));
  },
};

// ---- the size of the push, 1 - sigma, against the gap

const agree: SceneDef = {
  marks: {
    rl: { tex: String.raw`\partial \symL / \partial \sym{r}{r}_l = +0.73`, x: 0.5, y: 0.93, size: 4 },
  },
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const xs = [cx - 22 * u, cx + 22 * u];
    const cy = 20 * u;
    const nb = s.ease('neg', 0.6, 1);
    // Two answers, the pick, and each score's push: the winner's up, the loser's down.
    xs.forEach((x, i) => {
      const on = i === 0 ? 1 - nb : nb;
      s.rrect(x - 13 * u, cy - 6 * u, 26 * u, 12 * u, 1.6, { fill: s.tint('green', 0.06 + 0.06 * on), stroke: s.tint('green', 0.35 + 0.65 * on), lw: 0.3 + 0.3 * on });
      s.text(`answer ${i === 0 ? 'a' : 'b'}`, x, cy - 2.4 * u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
      s.text(`r = ${i === 0 ? '2.0' : '1.0'}`, x, cy + 2.4 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c('gold') });
    });
    s.alpha(1 - nb, () => s.text('picked', xs[0]!, cy + 9 * u, { size: 3, font: 'mono', weight: 650, color: s.c('green') }));
    s.alpha(nb, () => s.text('picked', xs[1]!, cy + 9 * u, { size: 3, font: 'mono', weight: 650, color: s.c('green') }));
    const size = lerp(1 - sig(1), 1 - sig(-1), s.ease('neg2', 1, 0.4));
    const pa = s.ease('one', 0.6) * (1 - s.ease('far', 0.6));
    const sideA = lerp(1, -1, nb);
    push(s, xs[0]! + 16 * u, cy, sideA * size, 13, pa);
    push(s, xs[1]! + 16 * u, cy, -sideA * size, 13, pa);
    s.alpha(pa, () => {
      const t = fmt(size);
      mono(s, t, xs[0]! + 18.5 * u, cy, sideA > 0 ? 'green' : 'red', 3, 'left', 650);
      mono(s, t, xs[1]! + 18.5 * u, cy, sideA > 0 ? 'red' : 'green', 3, 'left', 650);
    });
    // How hard one pick pushes, against the gap.
    const F = frame(cx - 34 * u, s.h * 0.44, cx + 34 * u, s.h * 0.82, [-3.4, 3.4], [0, 1.2]);
    const pl = s.ease('push', 1, 1.2);
    s.alpha(Math.min(1, pl * 3), () => {
      axes(s, F, 'z', 'push = 1 − σ', { x: 'gold', y: 'green' });
      s.line(F.X(0), F.b, F.X(0), F.t, s.tint('--axis', 0.6), 0.25, [1, 1]);
    });
    curve(s, F, (z) => 1 - sig(z), -3.4, 3.4, 'green', { upto: pl });
    const dot = (z: number, label: string, a: number) =>
      s.alpha(a, () => {
        const v = 1 - sig(z);
        s.line(F.X(z), F.b, F.X(z), F.Y(v), s.tint('gold', 0.7), 0.3, [1, 0.8]);
        ball(s, F.X(z), F.Y(v), 'green', 1.5);
        s.text(label, F.X(z) + 2.5 * u, F.Y(v) - 3.2 * u, { size: 3, font: 'mono', weight: 650, align: 'left', color: s.c('green'), halo: true });
      });
    dot(1, 'z = 1: 0.27', s.ease('one', 0.6, 0.6));
    dot(-1, 'z = −1: 0.73', s.ease('neg2', 0.6, 0.6));
    dot(3, '0.05', s.ease('far', 0.6, 0.6));
    s.show('rl', s.win('neg2', 'far') * s.ease('neg2', 0.6, 3));
    s.alpha(s.win('far', 'most'), () => caption(s, 'ranked right by 3: still moves, a little', s.h * 0.93));
    s.alpha(s.ease('most', 0.6), () => rich(s, [['wrong: ', '--ink-2'], ['big push', 'green'], ['   right: ', '--ink-2'], ['small', 'green']], cx, s.h * 0.93, { size: 3.4, weight: 650 }));
  },
};

export const scenes: Record<string, SceneDef> = { learn, back, agree };

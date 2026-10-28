import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp, smooth } from '../../../lecture/scene';
import type { Color } from '../../../core/symbols';
import { cells } from '../../draw';
import { Frame as Plane } from '../../calculus/draw';
import { after, Frame, rich } from '../../networks/draw';

type Ink = Color | `--${string}`;

/** Who introduced an idea, and when: small, at the top right of the stage. */
function cite(s: Scene, text: string, a: number) {
  s.alpha(a, () => s.text(text, s.w - 5 * s.u, 5 * s.u, { size: 3.1, italic: true, align: 'right', color: s.c('--ink-2'), halo: true }));
}

const mono = (s: Scene, t: string, x: number, y: number, k: Ink, o: { size?: number; align?: CanvasTextAlign; weight?: number } = {}) =>
  s.text(t, x, y, { size: o.size ?? 3.4, font: 'mono', weight: o.weight ?? 600, align: o.align ?? 'center', color: s.c(k), halo: true });

/** The small weights and the big ones, in their colors throughout. */
const KA: Color = 'teal';
const KB: Color = 'red';

// ---- touchy: two features equal in training, two weight vectors with the same scores there

const EXAMPLES = [['1', '1'], ['2', '2'], ['0.5', '0.5']];

const touchy: SceneDef = {
  draw(s) {
    const u = s.u;
    const size = s.tall ? 3.6 : 3.8;
    const xl = s.w / 2 - 30 * u;
    const xr = s.w / 2 + 6 * u;
    const ys = [0.08, 0.16, 0.24].map((f) => s.h * f);
    const nw = s.ease('new', 0.6);
    const row = (y: number, name: string, k: Ink, right: string, rk: Ink, a: number) =>
      s.alpha(a, () => {
        s.text(name, xl, y, { size, font: 'mono', weight: 650, align: 'left', color: s.c(k) });
        s.text(right, xr, y, { size: size * 0.92, font: 'mono', weight: 600, align: 'left', color: s.c(rk) });
      });
    const x0 = after(s, 'quirk', 0.8);
    row(ys[0]!, 'x = [1, 1]', 'orange', 'a training input', '--ink-3', x0 * (1 - nw));
    row(ys[0]!, 'new = [1, 1.5]', 'orange', 'a new input', '--ink-3', nw);
    const ta = s.ease('tie', 0.6);
    const tb = s.ease('tie', 0.6, 1.6);
    row(ys[1]!, 'wa = [1, 1]', KA, 'score 2', 'purple', ta * (1 - nw));
    row(ys[2]!, 'wb = [5, −3]', KB, 'score 2', 'purple', tb * (1 - nw));
    row(ys[1]!, 'wa = [1, 1]', KA, 'score 2.5', KA, ta * nw);
    row(ys[2]!, 'wb = [5, −3]', KB, 'score 0.5', KB, tb * nw);

    // The training examples: the two features agree in every one.
    s.alpha(s.ease('quirk', 0.6, 0.3) * (1 - s.ease('tie', 0.6, 1.8)), () => {
      const cx = [s.w / 2 - 8 * u, s.w / 2 + 8 * u];
      const ry = [0.45, 0.58, 0.71].map((f) => s.h * f);
      cx.forEach((x, j) => mono(s, j ? 'x₁' : 'x₀', x, s.h * 0.34, 'orange', { size: 3.6 }));
      EXAMPLES.forEach((ex, i) => {
        s.text(`example ${i + 1}`, cx[0]! - 9 * u, ry[i]!, { size: 3.1, font: 'mono', align: 'right', color: s.c('--ink-3') });
        cells(s, cx, ry[i]!, ex, 'orange', { w: 12, h: 8, size: 3.4, on: i === 0 ? [x0, x0] : undefined });
      });
      s.alpha(after(s, 'quirk', 0.45), () => mono(s, 'x₀ = x₁, every time', s.w / 2, s.h * 0.84, '--ink-2', { size: 3.4 }));
    });

    // The scores as the second feature moves, the first held at 1.
    const F = new Frame(s, 14 * u, s.h * 0.32, s.w - 8 * u, s.h * 0.85, [0.5, 2], [-2, 5]);
    s.alpha(s.ease('tie', 0.6, 2.4), () => {
      F.axes();
      s.line(F.l, F.t, F.l, F.b, s.c('--axis'), 0.3);
      s.text('score', F.l + 2 * u, F.t + 2 * u, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('purple') });
      s.text('x₁ →  (x₀ = 1)', F.l + 2 * u, F.b - 2.5 * u, { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c('orange'), halo: true });
      for (const y of [0, 2]) s.text(String(y), F.l - 2 * u, F.Y(y), { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
      F.seg(1, -2, 1, 5, '--ink-3', 0.3, [1, 1]);
      mono(s, 'training', F.X(1), F.t + 2.5 * u, '--ink-2', { size: 3.1 });
      const grow = s.ease('tie', 1.4, 2.8);
      F.fn((x) => 1 + x, KA, 0.7, 0.5, 0.5 + 1.5 * grow);
      F.fn((x) => 5 - 3 * x, KB, 0.7, 0.5, 0.5 + 1.5 * grow);
      s.alpha(grow, () => {
        mono(s, 'wa', F.X(1.9), F.Y(2.9) - 3.5 * u, KA);
        mono(s, 'wb', F.X(1.82), F.Y(-1.3), KB);
      });
      s.alpha(after(s, 'tie', 0.55), () => F.dot(1, 2, 'purple', 1.4));
    });
    s.alpha(nw, () => {
      F.seg(1.5, -2, 1.5, 5, '--ink-3', 0.3, [1, 1]);
      mono(s, 'new', F.X(1.5), F.t + 2.5 * u, '--ink-2', { size: 3.1 });
      F.dot(1.5, 2.5, KA, 1.4);
      F.dot(1.5, 0.5, KB, 1.4);
      mono(s, '2.5', F.X(1.5) - 2 * u, F.Y(2.5) - 3 * u, KA, { align: 'right' });
      mono(s, '0.5', F.X(1.5) - 3.5 * u, F.Y(0.5) + 0.5 * u, KB, { align: 'right' });
    });
    // Rise over run on the steep line: half a step in x₁, a drop of one and a half.
    s.alpha(s.ease('slope', 0.6), () => {
      F.seg(1, 2, 1.5, 2, KB, 0.35, [0.8, 0.8]);
      F.seg(1.5, 2, 1.5, 0.5, KB, 0.5);
      mono(s, '+0.5', F.X(1.25), F.Y(0) + 3 * u, '--ink-2', { size: 3 });
      mono(s, '−1.5', F.X(1.5) + 2.5 * u, F.Y(1.25), KB, { size: 3, align: 'left' });
    });
    s.alpha(after(s, 'slope', 0.25), () => rich(s, [['slope = the weight: ', '--ink-2'], ['1', KA], [' and ', '--ink-2'], ['−3', KB]], s.w / 2, s.h * 0.94, { size: 3.4, weight: 600 }));
  },
};

// ---- the plane of weights: the line of ties, arrows, rings of equal price

const WA = [1, 1] as const;
const WB = [5, -3] as const;

/** The plane of weights, on top, with rows for text under it. */
function plane(s: Scene, dom: [number, number, number, number]) {
  const F = new Plane(s, [4 * s.u, 3 * s.u, s.w - 8 * s.u, s.h * 0.66], dom, true);
  const top = F.Y(dom[2]) + 5.5 * s.u;
  const row = (i: number) => top + i * 6.6 * s.u;
  return { F, row };
}

function axisNames(s: Scene, F: Plane) {
  const [, x1, , y1] = F.dom;
  const o = { size: 3.3, font: 'mono', weight: 650, color: s.c('blue'), halo: true } as const;
  s.text('w₀', F.X(x1) - 2.5 * s.u, F.Y(0) - 3 * s.u, o);
  s.text('w₁', F.X(0) + 3.5 * s.u, F.Y(y1) + 2.5 * s.u, o);
}

/** A ring of equal price, Σw² = r², around zero. */
function ring(s: Scene, F: Plane, r: number, k: Ink, a: number, lw = 0.3) {
  if (r <= 0) return;
  s.alpha(a, () => F.clip(() => s.circle(F.X(0), F.Y(0), r * F.kx, { stroke: s.c(k), lw })));
}

const price: SceneDef = {
  marks: {
    f: { tex: String.raw`\symL = \symL_{\text{data}} + \symlam \sum_i \symw_i^2`, x: 0.5, y: 0.8, size: 4.4 },
  },
  draw(s) {
    const { F, row } = plane(s, [-2.5, 6.5, -4, 3]);
    const u = s.u;
    F.axes();
    axisNames(s, F);
    const rings = s.ease('rings', 0.8);
    for (let r = 1; r <= 7; r++) ring(s, F, r, 'slate', 0.45 * rings);
    // Every weight pair adding to 2 scores the training examples alike.
    s.alpha(s.ease('plane', 0.8, 0.8), () => F.clip(() => F.seg(-2.5, 4.5, 6.5, -4.5, 'purple', 0.45)));
    const ar = s.ease('plane', 0.8, 2.6);
    const arB = s.ease('plane', 0.8, 3.4);
    s.alpha(s.ease('plane', 0.6, 2.2), () => {
      F.dot(WA[0], WA[1], KA, 1.3);
      F.dot(WB[0], WB[1], KB, 1.3);
    });
    if (ar > 0) F.arrow(0, 0, WA[0] * ar, WA[1] * ar, KA, 0.6, 2.4);
    if (arB > 0) F.arrow(0, 0, WB[0] * arB, WB[1] * arB, KB, 0.6, 2.6);
    const lab = (t: string, x: number, y: number, k: Ink, a: number, align: CanvasTextAlign = 'left') => s.alpha(a, () => mono(s, t, x, y, k, { size: 3.2, align }));
    lab('[1, 1]', F.X(1) + 2 * u, F.Y(1) - 2.6 * u, KA, s.win('plane', 'sum'));
    lab('[5, −3]', F.X(5) - 2 * u, F.Y(-3) + 3.4 * u, KB, s.win('plane', 'sumb'), 'right');
    lab('Σw² = 2', F.X(1) + 2 * u, F.Y(1) - 2.6 * u, KA, s.ease('sum', 0.6, 2) * (1 - s.ease('touch', 0.5)));
    lab('Σw² = 34', F.X(5) - 3 * u, F.Y(-3) + 0.5 * u, KB, s.ease('sumb', 0.6) * (1 - s.ease('touch', 0.5)), 'right');
    ring(s, F, Math.SQRT2, KA, s.win('sum', 'lam'), 0.5);
    ring(s, F, Math.sqrt(34), KB, s.win('sumb', 'lam'), 0.5);

    // Sliding along the ties: the price falls until the line touches a ring.
    const p = smooth(s.prog('touch') * 1.25);
    const tA = s.ease('touch', 0.5) * (1 - s.ease('history', 0.6) * 0.6);
    if (tA > 0.003) {
      const q = [lerp(WB[0], WA[0], p), lerp(WB[1], WA[1], p)];
      const S = q[0]! ** 2 + q[1]! ** 2;
      ring(s, F, Math.sqrt(S), 'purple', tA, 0.55);
      s.alpha(tA, () => {
        F.dot(q[0]!, q[1]!, 'purple', 1.5);
        mono(s, `Σw² = ${S.toFixed(1).replace(/\.0$/, '')}`, F.X(q[0]!) + 3 * u, F.Y(q[1]!) + 1 * u, 'purple', { size: 3.2, align: 'left' });
      });
    }

    // Text under the plane.
    const r0 = row(0);
    const r1 = row(1);
    const r2 = row(2);
    s.alpha(s.win('plane', 'sum'), () => rich(s, [['w₀ + w₁ = 2', 'purple'], [': every point ties', '--ink-2']], s.w / 2, r0, { size: 3.4 }));
    s.alpha(s.win('sum', 'rings'), () => rich(s, [['1² + 1² = ', '--ink-2'], ['2', KA]], s.w / 2, r0, { size: 3.6, weight: 600 }));
    s.alpha(s.win('sumb', 'rings'), () => rich(s, [['5² + (−3)² = 25 + 9 = ', '--ink-2'], ['34', KB]], s.w / 2, r1, { size: 3.6, weight: 600 }));
    s.alpha(s.win('rings', 'lam'), () => {
      rich(s, [['Σw²', 'blue'], [' = (how long the arrow is)²', '--ink-2']], s.w / 2, r0, { size: 3.4 });
      s.alpha(after(s, 'rings', 0.55), () => rich(s, [['the L2 norm', 'blue'], [': √Σw², the 2 for the squares', '--ink-2']], s.w / 2, r1, { size: 3.2 }));
    });
    s.alpha(s.win('lam', 'loss'), () => rich(s, [['λ', 'slate'], [': the strength, set on validation', '--ink-2']], s.w / 2, r0, { size: 3.4 }));
    s.show('f', s.ease('loss', 0.6), { y: r0 / s.h });
    s.alpha(s.win('pay', 'touch'), () => {
      rich(s, [['λ · 34 = 0.1 × 34 = ', '--ink-2'], ['3.4', KB]], s.w / 2, r1, { size: 3.4, weight: 600 });
      s.alpha(after(s, 'pay', 0.6), () => rich(s, [['λ · 2 = 0.1 × 2 = ', '--ink-2'], ['0.2', KA]], s.w / 2, r2, { size: 3.4, weight: 600 }));
    });
    s.alpha(s.win('touch', 'regular'), () => rich(s, [['same data loss, falling price', '--ink-2']], s.w / 2, r1, { size: 3.4 }));
    s.alpha(s.win('regular', 'history'), () => rich(s, [['L2 picks ', '--ink-2'], ['[1, 1]', KA], [': the cheapest tie', '--ink-2']], s.w / 2, r1, { size: 3.4, weight: 600 }));
    s.alpha(s.ease('history', 0.6), () => rich(s, [['among near-best fits, take the shortest', '--ink-2']], s.w / 2, r1, { size: 3.3 }));
    cite(s, 'Hoerl & Kennard, 1970', s.ease('history', 0.6));
  },
};

// ---- decay: the penalty's gradient points away from zero, so each step pulls the tip in

const W0 = [2, -1] as const;
const at = (f: number, k: number) => [W0[0] * f ** k, W0[1] * f ** k] as const;

const decay: SceneDef = {
  marks: {
    step: { tex: String.raw`\symw \leftarrow \symw - \symeta\,(\symg + 2\symlam\symw)`, x: 0.5, y: 0.8, size: 4.4 },
  },
  draw(s) {
    const { F, row } = plane(s, [-0.7, 2.7, -1.5, 0.9]);
    const u = s.u;
    const [r0, r1, r2] = [row(0), row(1), row(2)];
    F.axes();
    axisNames(s, F);
    for (let r = 0.5; r <= 3; r += 0.5) ring(s, F, r, 'slate', 0.4);

    // The trail of decaying weights, for the factor λ sets (0.1, then turned up to 0.4).
    const lamUp = s.ease('lamup', 2.4, 0.4);
    const lam = lerp(0.1, 0.4, lamUp);
    const fac = 1 - 2 * 0.5 * lam;
    const trailA = s.ease('shrink', 0.4) * (1 - s.ease('both', 0.5)) + s.win('lamup', 'name') * (1 - after(s, 'lamup', 0.62));
    const hopT = s.since('shrink');
    const shown = s.since('lamup') > 0 ? 5 : Math.max(0, Math.min(5, hopT / 0.9));
    s.alpha(trailA, () => {
      for (let k = 1; k <= 5; k++) {
        const a = Math.min(1, Math.max(0, shown - (k - 1)));
        if (a <= 0) continue;
        const [x, y] = at(fac, k);
        s.alpha(a, () => F.dot(x, y, lamUp > 0.01 ? 'gold' : 'green', 1));
      }
    });

    // w, its gradient pointing outward, and the step pulling inward.
    F.arrow(0, 0, W0[0], W0[1], 'blue', 0.6, 2.6);
    mono(s, 'w = [2, −1]', F.X(0.75), F.Y(-0.38) - 3.6 * u, 'blue', { size: 3.2, align: 'left' });
    const out = s.win('out', 'factor');
    s.alpha(out, () => {
      F.arrow(W0[0], W0[1], W0[0] + 0.4, W0[1] - 0.2, 'red', 0.55, 2.2);
      mono(s, '2λw', F.X(2.25), F.Y(-1.12) + 3.8 * u, 'red', { size: 3.2 });
    });
    const pull = s.win('step', 'shrink');
    s.alpha(pull, () => F.arrow(W0[0], W0[1], W0[0] - 0.2, W0[1] + 0.1, 'green', 0.55, 1.6));
    // With a data gradient [1, 0]: one step lands at [1.3, -0.9].
    s.alpha(s.win('both', 'lamup'), () => {
      F.arrow(W0[0], W0[1], 1.3, -0.9, 'green', 0.55, 2);
      s.alpha(after(s, 'land', 0.5), () => {
        F.dot(1.3, -0.9, 'green', 1.2);
        mono(s, '[1.3, −0.9]', F.X(1.3), F.Y(-0.9) + 3.8 * u, 'green', { size: 3 });
      });
    });
    // Where the pulls balance: the data's pull out, the penalty's pull in.
    const bal = after(s, 'lamup', 0.62) * (1 - s.ease('name', 0.5));
    s.alpha(bal, () => {
      F.arrow(W0[0], W0[1], W0[0] - 0.8, W0[1] + 0.4, 'green', 0.55, 2.2);
      F.arrow(W0[0], W0[1], W0[0] + 0.5, W0[1] - 0.25, 'red', 0.55, 2.2);
      mono(s, 'penalty', F.X(1.5), F.Y(-0.75) + 4.6 * u, 'green', { size: 3 });
      mono(s, 'data', F.X(2.3), F.Y(-1.15) + 4.6 * u, 'red', { size: 3 });
    });

    // Text under the plane.
    s.alpha(s.win('grad', 'step'), () => rich(s, [['slope of ', '--ink-2'], ['λw²', 'slate'], [': ', '--ink-2'], ['2λw', 'red']], s.w / 2, r0, { size: 3.6, weight: 600 }));
    s.alpha(s.win('out', 'step'), () => rich(s, [['2 × 0.1 × [2, −1] = ', '--ink-2'], ['[0.4, −0.2]', 'red']], s.w / 2, r1, { size: 3.4, weight: 600 }));
    s.show('step', s.ease('step', 0.6), { y: r0 / s.h });
    s.alpha(s.win('factor', 'shrink'), () => rich(s, [['g = 0: ', 'red'], ['w × (1 − 2ηλ) = ', '--ink-2'], ['w × 0.9', 'green']], s.w / 2, r1, { size: 3.4, weight: 600 }));
    s.alpha(s.win('shrink', 'both'), () => rich(s, [['2 → 1.8 → 1.62 → …', 'green']], s.w / 2, r1, { size: 3.6, weight: 600 }));
    s.alpha(s.win('both', 'lamup'), () => rich(s, [['g = [1, 0]: ', 'red'], ['g + 2λw = ', '--ink-2'], ['[1.4, −0.2]', '--ink']], s.w / 2, r1, { size: 3.4, weight: 600 }));
    s.alpha(s.win('land', 'lamup'), () => rich(s, [['2 − 0.5 × 1.4 = ', '--ink-2'], ['1.3', 'green']], s.w / 2, r2, { size: 3.4, weight: 600 }));
    s.alpha(s.win('lamup', 'name'), () => {
      rich(s, [['λ = ', '--ink-2'], [lam.toFixed(2).replace(/0$/, ''), 'slate'], ['   factor ', '--ink-2'], [fac.toFixed(2).replace(/0$/, ''), 'gold']], s.w / 2, r1, { size: 3.4, weight: 600 });
      s.alpha(after(s, 'lamup', 0.62), () => rich(s, [['settles where the pulls balance', '--ink-2']], s.w / 2, r2, { size: 3.3 }));
    });
    s.alpha(s.ease('name', 0.6), () => rich(s, [['weight decay', 'green'], [': every step, w shrinks', '--ink-2']], s.w / 2, r1, { size: 3.6, weight: 600 }));
    s.alpha(after(s, 'name', 0.4), () => rich(s, [['the smallest weights that still fit', '--ink-2']], s.w / 2, r2, { size: 3.3 }));
    cite(s, 'Krogh & Hertz, 1991', after(s, 'name', 0.35));
  },
};

export const scenes: Record<string, SceneDef> = { touchy, price, decay };

import type { Scene, SceneDef } from '../../../lecture/scene';
import { verdict } from '../../draw';
import { ball } from '../../optimization/draw';
import { axes, block, brace, curve, fmt, frame, rich } from '../draw';

const sig = (z: number) => 1 / (1 + Math.exp(-z));
const nls = (z: number) => -Math.log(sig(z));
const BETA = 0.1;
const GW = 3;
const GL = -1;
const M = BETA * (GW - GL);

/** The two-stage route, top to bottom; `skip` crosses out its middle and draws the shortcut. */
function route(s: Scene, skip: number): void {
  const steps = ['preference pairs', 'reward model', 'sample + KL penalty', 'trained model'];
  const ys = steps.map((_, i) => s.h * (0.1 + i * 0.13));
  const x = s.w / 2 - 8 * s.u;
  steps.forEach((t, i) => {
    const mid = i === 1 || i === 2;
    s.alpha(mid ? 1 - 0.6 * skip : 1, () => block(s, x, ys[i]!, 40 * s.u, 8 * s.u, '', mid ? 'slate' : i === 0 ? 'gold' : 'purple'));
    s.text(t, x, ys[i]!, { size: 3.2, font: 'mono', weight: 600, color: s.c(mid ? '--ink-3' : '--ink') });
    if (i < 3) s.alpha(1 - 0.6 * skip, () => s.arrow(x, ys[i]! + 4.3 * s.u, x, ys[i + 1]! - 4.3 * s.u, s.c('--ink-3'), 0.35, 1.8));
    if (mid) s.alpha(skip, () => s.line(x - 21 * s.u, ys[i]!, x + 21 * s.u, ys[i]!, s.c('red'), 0.5));
  });
  // The shortcut, around the right of the stack.
  s.alpha(skip, () => {
    const xr = x + 26 * s.u;
    s.line(x + 20 * s.u, ys[0]!, xr, ys[0]!, s.c('green'), 0.5);
    s.line(xr, ys[0]!, xr, ys[3]!, s.c('green'), 0.5);
    s.arrow(xr, ys[3]!, x + 20.5 * s.u, ys[3]!, s.c('green'), 0.5, 2);
    s.text('DPO', xr + 2 * s.u, (ys[0]! + ys[3]!) / 2, { size: 3.4, font: 'mono', weight: 700, align: 'left', color: s.c('green') });
  });
}

const implicit: SceneDef = {
  marks: {
    f: { tex: String.raw`\hat r(y) = \sym{beta}{\beta} \ln\frac{\sym{pi}{\pi}(y)}{\sym{piref}{\pi_{\text{ref}}}(y)}`, x: 0.5, y: 0.14, size: 5 },
  },
  draw(s) {
    const imp = s.ease('implicit', 0.8);
    s.alpha(1 - imp, () => route(s, s.ease('skip', 0.8)));
    s.show('f', imp);
    // Two log-probabilities on a line, and the gap between them.
    const F = frame(s.w / 2 - 36 * s.u, s.h * 0.4, s.w / 2 + 36 * s.u, s.h * 0.56, [-20, -5], [0, 1]);
    const eg = s.ease('eg', 0.8);
    s.alpha(eg, () => {
      s.line(F.l, F.b, F.r, F.b, s.c('--axis'), 0.35);
      [-20, -15, -10, -5].forEach((v) => s.text(String(v).replace('-', '−'), F.X(v), F.b + 3.4 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') }));
      s.text('log-probability of the answer', s.w / 2, F.b + 8 * s.u, { size: 2.8, color: s.c('--ink-3') });
      ball(s, F.X(-15), F.b, 'slate', 1.6);
      ball(s, F.X(-12), F.b, 'teal', 1.6);
      s.text('π_ref: −15', F.X(-15) - 1 * s.u, F.b - 4 * s.u, { size: 3, font: 'mono', weight: 600, align: 'right', color: s.c('slate') });
      s.text('π: −12', F.X(-12) + 1 * s.u, F.b - 4 * s.u, { size: 3, font: 'mono', weight: 600, align: 'left', color: s.c('teal') });
    });
    s.alpha(s.ease('eg', 0.6, 2.5), () => {
      brace(s, 'top', F.X(-15), F.X(-12), F.b - 9 * s.u, 'log-ratio 3', 'orange', 3);
      rich(s, [['r̂ = 0.1 × 3 = ', '--ink-2'], ['0.3', 'orange']], s.w / 2, s.h * 0.78, { size: 3.6, weight: 600 });
    });
    s.alpha(s.ease('leash', 0.6), () => s.text('it grows only as the model leaves the reference', s.w / 2, s.h * 0.88, { size: 3.1, color: s.c('--ink-2') }));
  },
};

const loss: SceneDef = {
  marks: {
    f: { tex: String.raw`\symL = -\ln\sigma\big(\sym{beta}{\beta}\,(\text{chosen} - \text{rejected})\big)`, x: 0.5, y: 0.08, size: 4.4 },
  },
  draw(s) {
    s.show('f', s.ease('plug', 0.6));
    // The two log-ratios as bars from zero; `push` widens the gap.
    const pu = s.ease('push', 1.4, 0.4) * (1 - s.ease('needs', 0.6));
    const zx = s.w / 2 - 4 * s.u;
    const unit = 8 * s.u;
    const rows: [string, number, 'green' | 'red', number][] = [
      ['chosen', GW + 0.8 * pu, 'green', s.h * 0.22],
      ['rejected', GL - 0.8 * pu, 'red', s.h * 0.32],
    ];
    const show = s.ease('m', 0.6);
    s.alpha(show, () => {
      s.line(zx, s.h * 0.17, zx, s.h * 0.37, s.c('--axis'), 0.35);
      rows.forEach(([name, v, k, y]) => {
        const x0 = Math.min(zx, zx + v * unit);
        s.rrect(x0, y - 2.6 * s.u, Math.abs(v) * unit, 5.2 * s.u, 0.8, { fill: s.tint(k, 0.4), stroke: s.tint(k, 0.9), lw: 0.25 });
        s.text(name, zx - 27 * s.u, y, { size: 3, font: 'mono', align: 'right', color: s.c(k) });
        s.text(fmt(v, 1), zx + v * unit + (v > 0 ? 2 : -2) * s.u, y, { size: 3, font: 'mono', weight: 650, align: v > 0 ? 'left' : 'right', color: s.c(k), halo: true });
      });
      const w = GW + 0.8 * pu;
      const l = GL - 0.8 * pu;
      rich(s, [[`margin = 0.1 × (${fmt(w, 1)} − (${fmt(l, 1)})) = `, '--ink-2'], [fmt(BETA * (w - l), pu > 0 ? 2 : 1), 'orange']], s.w / 2, s.h * 0.43, { size: 3.3, weight: 600 });
    });
    // The loss against the margin, with this pair marked.
    const lossA = s.ease('loss', 0.6) * (1 - s.ease('needs', 0.6));
    const F = frame(s.w / 2 - 30 * s.u, s.h * 0.52, s.w / 2 + 30 * s.u, s.h * 0.88, [-3, 3], [0, 3.2]);
    s.alpha(lossA, () => {
      axes(s, F, 'margin', 'loss', { x: 'orange', y: 'red' });
      curve(s, F, nls, -3, 3, 'red');
      const z = M + 0.8 * pu * BETA * 2;
      ball(s, F.X(z), F.Y(nls(z)), 'red', 1.5);
      s.text(`σ = ${sig(z).toFixed(2)}, loss ${nls(z).toFixed(2)}`, F.r, F.Y(nls(z)) - 6 * s.u, { size: 3, font: 'mono', weight: 600, align: 'right', color: s.c('red'), halo: true });
    });
    s.alpha(s.ease('needs', 0.6), () => {
      const x = s.w / 2 - 24 * s.u;
      const items: [boolean, string][] = [
        [true, 'preference pairs'],
        [true, 'the model being trained'],
        [true, 'a frozen reference'],
        [false, 'a reward model'],
        [false, 'sampling'],
      ];
      items.forEach(([ok, t], i) => verdict(s, ok, t, x, s.h * (0.56 + i * 0.075), 3.2));
    });
  },
};

export const scenes: Record<string, SceneDef> = { implicit, loss };

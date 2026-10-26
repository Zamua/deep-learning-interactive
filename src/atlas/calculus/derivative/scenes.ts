import { type Scene, type SceneDef, lerp } from '../../../lecture/scene';
import { Frame, inset, note } from '../draw';

const f = (x: number) => x * x;

/** A close-up of x² around x = 1, where a nudge of 0.01 is visible. */
const close = (s: Scene) => new Frame(s, inset(s, 0.08, 0.08, 0.08), [0.973, 1.027, 0.945, 1.055]);

/** The run and rise of a nudge from x = 1 to 1 + dx, along the tangent. */
function nudgeStep(s: Scene, F: Frame, dx: number, run: string, rise: string, a: number) {
  s.alpha(a, () => {
    F.seg(1, 1, 1 + dx, 1, '--ink-2', 0.45, [1.2, 1]);
    F.arrow(1 + dx, 1, 1 + dx, 1 + 2 * dx, 'gold', 0.55, 2.2);
    F.dot(1 + dx, f(1 + dx), 'purple', 1.1);
    const side = dx > 0 ? 1 : -1;
    s.text(run, F.X(1 + dx / 2), F.Y(1) + side * 3.8 * s.u, { size: 3.5, font: 'mono', color: s.c('--ink-2'), halo: true });
    s.text(rise, F.X(1 + dx) + side * 2 * s.u, F.Y(1 + dx), { size: 3.5, font: 'mono', weight: 600, align: dx > 0 ? 'left' : 'right', color: s.c('gold'), halo: true });
  });
}

const nudge: SceneDef = {
  marks: {
    rule: { tex: String.raw`\Delta \symf \approx \symf'(\symx)\,\Delta \symx`, x: 0.7, y: 0.84, size: 5 },
  },
  draw(s) {
    const F = close(s);
    F.tangent(1, 1, 2, 'teal', 0.973, 1.027, 0.5);
    F.fn(f, 'purple', 0.8);
    F.dot(1, 1, 'purple');
    s.alpha(1 - s.ease('right', 0.4), () => s.text('x = 1', F.X(1) + 2 * s.u, F.Y(1) + 3.6 * s.u, { size: 3.3, font: 'mono', align: 'left', color: s.c('--ink-3'), halo: true }));
    s.text('f(x) = x²', F.X(1.025), F.Y(0.975), { size: 3.6, font: 'mono', weight: 600, align: 'right', color: s.c('purple'), halo: true });
    s.alpha(s.ease('rate', 0.6, 1.2), () => note(s, F, "f′(1) = 2: f moves 2× as much as x", 0, 'teal', 3.6));
    nudgeStep(s, F, 0.01, '+0.01', '≈ +0.02', s.ease('right', 0.6));
    s.alpha(s.ease('value', 0.6), () => note(s, F, 'f(1.01) ≈ 1 + 0.02 = 1.02', 1, 'gold', 3.6));
    nudgeStep(s, F, -0.01, '−0.01', '≈ −0.02', s.ease('left', 0.6));
    s.alpha(s.ease('left', 0.6, 0.8), () => note(s, F, 'f(0.99) ≈ 1 − 0.02 = 0.98', 2, 'gold', 3.6));
    s.show('rule', s.ease('rule', 0.7));
  },
};

const wide = (s: Scene) => new Frame(s, inset(s, 0.07, 0.07, 0.06), [-2.3, 2.3, -0.8, 5.4]);

const sign: SceneDef = {
  draw(s) {
    const F = wide(s);
    F.axes();
    F.fn(f, 'purple', 0.8);
    let p = lerp(lerp(lerp(-2, -1.5, s.ease('slide', 1.2, 0.6)), 0, s.ease('zero', 1.4)), 1.5, s.ease('pos', 1.4));
    p = lerp(lerp(lerp(p, -1.5, s.ease('height', 1.2)), 1, s.ease('table', 1.2)), 0, s.ease('dip', 1.2));
    const m = 2 * p;
    const k = m < -0.3 ? 'red' : m > 0.3 ? 'green' : 'teal';
    F.tangent(p, f(p), m, k, p - 0.95, p + 0.95, 0.7);
    F.dot(p, f(p), 'purple');
    const word = m < -0.3 ? 'going down' : m > 0.3 ? 'going up' : 'flat';
    const row = (i: number) => F.Y(4.9) + i * 5.6 * s.u;
    const line = (t: string, i: number, c: Parameters<Scene['c']>[0], w = 500) => s.text(t, s.w / 2, row(i), { size: 3.6, font: 'mono', weight: w, color: s.c(c), halo: true });
    s.alpha(1 - s.ease('height', 0.5), () => s.text(`slope ${m < -0.05 ? '−' : ''}${Math.abs(m).toFixed(1)}: ${word}`, s.w / 2, row(0), { size: 3.9, font: 'mono', weight: 650, color: s.c(k), halo: true }));
    const hA = s.win('height', 'table', 0.5);
    s.alpha(hA * s.ease('height', 0.6, 1), () => {
      F.seg(-1.5, 0, -1.5, 2.25, 'purple', 0.45, [1.2, 1]);
      line('f(−1.5) = 2.25: high up', 0, 'purple');
      line('slope −3: still going down', 1, 'red', 650);
    });
    s.alpha(s.win('down', 'table', 0.5), () => {
      F.arrow(-1.5, f(-1.5), -1.22, f(-1.22), 'green', 0.55, 2.2);
      F.dot(-1.2, f(-1.2), 'green', 1.1);
      line('step right: f(−1.2) = 1.44', 2, '--ink-2');
      line('1.44 < 2.25: f got smaller', 3, 'green', 650);
    });
    s.alpha(s.win('table', 'dip', 0.5), () => {
      line('f(0.9) = 0.81', 0, '--ink-2');
      line('f(1)   = 1   ', 1, '--ink-2');
      line('f(1.1) = 1.21', 2, '--ink-2');
      line('rising: f′(1) > 0', 3, 'green', 650);
    });
    s.alpha(s.ease('dip', 0.5), () => {
      line('f(−0.1) = 0.01', 0, '--ink-2');
      line('f(0)    = 0   ', 1, '--ink-2');
      line('f(0.1)  = 0.01', 2, '--ink-2');
      line('down, then up: f′(0) = 0', 3, 'teal', 650);
    });
  },
};

export const scenes: Record<string, SceneDef> = { nudge, sign };

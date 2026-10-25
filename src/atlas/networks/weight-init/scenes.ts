import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { cells } from '../../draw';
import { after, caption, Frame, unit, vcells } from '../draw';

/** Random starting weights per hidden unit, and the gradients they would get. */
const RAND = [[0.3, -0.8], [-0.5, 0.2], [0.9, 0.4]];
const GRAD = [0.6, -0.35, 0.9];

const symmetry: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const xin = cx - 38 * u;
    const ins = [s.h * 0.3, s.h * 0.56];
    const hy = [s.h * 0.2, s.h * 0.43, s.h * 0.66];
    const hx = cx - 8 * u;
    const wx = [cx + 8 * u, cx + 19 * u];
    const gx = cx + 36 * u;
    const rnd = s.ease('random', 0.8);
    s.text('x', xin, ins[0]! - 9 * u, { size: 3.8, font: 'mono', weight: 650, color: s.c('orange') });
    vcells(s, xin, ins, ['2', '1'], 'orange', { w: 10 });
    for (const y of hy) for (const iy of ins) s.line(xin + 5.5 * u, iy, hx - 6.5 * u, y, s.tint('blue', 0.35), 0.3);
    s.text('w', (wx[0]! + wx[1]!) / 2, hy[0]! - 9 * u, { size: 3.8, font: 'mono', weight: 650, color: s.c('blue') });
    hy.forEach((y, i) => {
      const out = RAND[i]![0]! * 2 + RAND[i]![1]!;
      unit(s, hx, y, 6, rnd > 0.5 ? out.toFixed(1).replace('-', '−') : '0', 'gold', s.win('same', 'random'), 3.2);
      s.alpha(1 - rnd, () => cells(s, wx, y, ['0', '0'], 'blue', { w: 10, h: 8 }));
      s.alpha(rnd, () => cells(s, wx, y, RAND[i]!.map((v) => String(v).replace('-', '−')), 'blue', { w: 10, h: 8, size: 3.2 }));
    });
    // The gradient each unit would get: equal bars, then different ones.
    const gA = s.ease('same', 0.6, 1.5);
    s.alpha(gA, () => {
      s.text('grad', gx, hy[0]! - 9 * u, { size: 3.6, font: 'mono', weight: 650, color: s.c('red') });
      hy.forEach((y, i) => {
        const g = lerp(0.6, GRAD[i]!, rnd);
        const w = Math.abs(g) * 10 * u;
        s.rrect(g < 0 ? gx - w : gx, y - 2.5 * u, w, 5 * u, 0.6, { fill: s.tint('red', 0.45), stroke: s.c('red'), lw: 0.3 });
      });
      s.line(gx, hy[0]! - 5 * u, gx, hy[2]! + 5 * u, s.c('--axis'), 0.3);
    });
    const cy = s.h * 0.86;
    s.alpha(s.win('zero', 'same'), () => caption(s, 'every weight 0', cy, 'blue', 3.8));
    s.alpha(s.win('same', 'random'), () => caption(s, 'same weights → same output, same gradient', cy, '--ink-2', 3.4));
    s.alpha(rnd, () => caption(s, 'random weights: every unit different', cy, 'blue', 3.6));
  },
};

const bell = (sd: number) => (z: number) => 1.1 * Math.exp(-(z * z) / (2 * sd * sd));

const grow: SceneDef = {
  marks: {
    v: { tex: String.raw`\mathrm{Var}(z) = n\,v`, x: 0.5, y: 0.1, size: 5.4 },
  },
  draw(s) {
    const u = s.u;
    const F = new Frame(s, 8 * u, s.h * 0.2, s.w - 8 * u, s.h * 0.78, [-25, 25], [-1.25, 1.3]);
    s.show('v', s.ease('sum', 0.6) * (1 - s.ease('small', 0.6)));
    F.axes();
    s.text('z', F.r, F.Y(0) + 4 * u, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('--ink-2') });
    for (const t of [-20, -10, 10, 20]) s.text(String(t).replace('-', '−'), F.X(t), F.Y(0) + 4 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
    const small = s.ease('small', 1);
    const sd = lerp(lerp(1, 10, s.ease('big', 1.6)), 0.4, small);
    // Saturated mass: where |z| > 2, tanh is flat.
    s.alpha(s.win('flat', 'small'), () => {
      F.clip(() => {
        const c = s.ctx;
        for (const side of [-1, 1]) {
          c.beginPath();
          c.moveTo(F.X(2 * side), F.Y(0));
          for (let i = 0; i <= 60; i++) {
            const z = side * (2 + (23 * i) / 60);
            c.lineTo(F.X(z), F.Y(bell(sd)(z)));
          }
          c.lineTo(F.X(25 * side), F.Y(0));
          c.closePath();
          c.fillStyle = s.tint('red', 0.25);
          c.fill();
        }
      });
    });
    F.fn(bell(sd), 'gold', 0.7);
    const lab = { size: 3.4, font: 'mono', weight: 600, halo: true } as const;
    s.alpha(s.win('sum', 'big'), () => s.text('one term: std 1', F.X(0), F.Y(1.1) - 4 * u, { ...lab, color: s.c('gold') }));
    s.alpha(s.win('big', 'small') * after(s, 'big', 0.4), () => {
      s.alpha(1 - s.ease('flat', 0.6), () => F.seg(-10, bell(10)(10), 10, bell(10)(10), 'gold', 0.3, [1, 0.8]));
      s.text('100 terms: std 10', F.X(0), F.Y(1.1) - 4 * u, { ...lab, color: s.c('gold') });
    });
    s.alpha(s.win('flat', 'small'), () => {
      F.fn(Math.tanh, 'purple', 0.7);
      s.text('tanh', F.X(14), F.Y(1) - 4 * u, { ...lab, color: s.c('purple') });
      s.text('flat: slope ≈ 0', F.X(-14), F.Y(-0.55), { ...lab, color: s.c('red') });
      s.text('flat: slope ≈ 0', F.X(14), F.Y(-0.55), { ...lab, color: s.c('red') });
    });
    s.alpha(small, () => {
      s.text('std per layer: 1 → 0.1 → 0.01 → 0.001', s.w / 2, s.h * 0.12, { size: 3.6, font: 'mono', weight: 600, color: s.c('gold'), halo: true });
      s.text('squeezed toward 0', F.X(0), F.Y(1.1) - 4 * u, { ...lab, color: s.c('gold') });
    });
    const cy = s.h * 0.9;
    s.alpha(s.win('sum', 'big'), () => caption(s, 'variances add', cy));
    s.alpha(s.win('big', 'flat'), () => caption(s, '100 × 1 = 100,  √100 = 10', cy, 'gold', 3.8));
    s.alpha(s.win('flat', 'small'), () => caption(s, 'most units saturated: gradients vanish', cy, 'red', 3.6));
    s.alpha(small, () => caption(s, 'too small: the signal dies out', cy, 'red', 3.6));
  },
};

const scale: SceneDef = {
  marks: {
    xavier: { tex: String.raw`\mathrm{Var}(\symw) = \frac{1}{n} \qquad \mathrm{std} = \frac{1}{\sqrt{n}}`, x: 0.5, y: 0.22, size: 5 },
    he: { tex: String.raw`\mathrm{Var}(\symw) = \frac{2}{n} \qquad \mathrm{std} = \sqrt{\frac{2}{n}}`, x: 0.5, y: 0.62, size: 5 },
  },
  draw(s) {
    const xa = s.ease('xavier', 0.6);
    const ha = s.ease('he', 0.6);
    const na = s.ease('names', 0.6);
    s.show('xavier', xa);
    s.show('he', ha);
    const head = { size: 4, font: 'mono', weight: 650, halo: true } as const;
    s.alpha(na, () => {
      s.text('Xavier, for tanh', s.w / 2, s.h * 0.08, { ...head, color: s.c('purple') });
      s.text('He, for ReLU', s.w / 2, s.h * 0.48, { ...head, color: s.c('gold') });
    });
    const ex = { size: 3.6, font: 'mono', weight: 600, halo: true } as const;
    s.alpha(after(s, 'xavier', 0.45), () => s.text('n terms × 1/n = variance 1', s.w / 2, s.h * 0.33, { ...ex, color: s.c('--ink-2') }));
    s.alpha(after(s, 'xavier', 0.75), () => s.text('n = 100:  1/√100 = 0.1', s.w / 2, s.h * 0.39, { ...ex, color: s.c('purple') }));
    s.alpha(after(s, 'he', 0.7), () => s.text('n = 50:  √(2/50) = √0.04 = 0.2', s.w / 2, s.h * 0.75, { ...ex, color: s.c('gold') }));
    s.alpha(after(s, 'he', 0.2), () => s.text('ReLU zeroes half: double the variance', s.w / 2, s.h * 0.81, { ...ex, color: s.c('--ink-2') }));
  },
};

export const scenes: Record<string, SceneDef> = { symmetry, grow, scale };

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

/** A sum's spread on a plot: wide enough to saturate a tanh, then squeezed toward 0. */
function sizes(s: Scene): void {
  const u = s.u;
  const F = new Frame(s, 8 * u, s.h * 0.2, s.w - 8 * u, s.h * 0.78, [-25, 25], [-1.25, 1.3]);
  F.axes();
  s.text('z', F.r, F.Y(0) + 4 * u, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('--ink-2') });
  for (const t of [-20, -10, 10, 20]) s.text(String(t).replace('-', '−'), F.X(t), F.Y(0) + 4 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
  const small = s.ease('small', 1);
  const sd = lerp(lerp(1, 10, s.ease('recap', 1.6, 0.8)), 0.4, small);
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
  s.alpha((1 - s.ease('small', 0.6)) * after(s, 'recap', 0.5), () => {
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
    s.text('std(w) = 0.01:  std(z) = 0.1 × its input\'s', s.w / 2, s.h * 0.07, { size: 3.4, font: 'mono', weight: 600, color: s.c('blue'), halo: true });
    s.alpha(after(s, 'small', 0.6), () => s.text('std per layer: 1 → 0.1 → 0.01 → 0.001', s.w / 2, s.h * 0.13, { size: 3.4, font: 'mono', weight: 600, color: s.c('gold'), halo: true }));
    s.text('squeezed toward 0', F.X(0), F.Y(1.1) - 4 * u, { ...lab, color: s.c('gold') });
  });
  const cy = s.h * 0.9;
  s.alpha(s.win('recap', 'flat') * after(s, 'recap', 0.5), () => caption(s, '100 × 1 × 1 = 100,  √100 = 10', cy, 'gold', 3.8));
  s.alpha(s.win('flat', 'small'), () => caption(s, 'most units saturated: gradients vanish', cy, 'red', 3.6));
  s.alpha(small, () => caption(s, 'too small: the signal dies out', cy, 'red', 3.6));
}

/** A weight matrix as a grid: a row per unit, a column per input, the columns counted as the fan-in. */
function fanIn(s: Scene): void {
  const u = s.u;
  const R = 3;
  const C = 5;
  const p = 9 * u;
  const cx = s.w / 2 + 4 * u;
  const cy = s.h * 0.48;
  const x = (j: number) => cx + (j - (C - 1) / 2) * p;
  const y = (i: number) => cy + (i - (R - 1) / 2) * p;
  const col = after(s, 'fanin', 0.55);
  for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) s.cell(x(j) - 3.8 * u, y(i) - 3.8 * u, 7.6 * u, 7.6 * u, '', 'blue', { on: col * 0.5 });
  const lab = { size: 3.2, font: 'mono', color: s.c('--ink-2') } as const;
  s.alpha(after(s, 'fanin', 0.35), () => {
    for (let i = 0; i < R; i++) s.text(`unit ${i}`, x(0) - 6 * u, y(i), { ...lab, align: 'right' });
  });
  s.alpha(col, () => {
    for (let j = 0; j < C; j++) s.text(String(j), x(j), y(0) - 7.5 * u, { ...lab, color: s.c('blue'), weight: 650 });
    s.text('one column per input', cx, y(0) - 13 * u, { ...lab, color: s.c('blue') });
  });
  s.text('W', x(C - 1) + 7 * u, cy, { size: 4, font: 'mono', weight: 650, color: s.c('blue') });
  s.alpha(col, () => caption(s, 'fan-in n = 5 columns', s.h * 0.86, 'blue', 3.8));
}

const scale: SceneDef = {
  marks: {
    xavier: { tex: String.raw`\mathrm{Var}(\symw) = \frac{1}{n} \qquad \mathrm{std} = \frac{1}{\sqrt{n}}`, x: 0.5, y: 0.22, size: 5 },
    he: { tex: String.raw`\mathrm{Var}(\symw) = \frac{2}{n} \qquad \mathrm{std} = \sqrt{\frac{2}{n}}`, x: 0.5, y: 0.62, size: 5 },
  },
  draw(s) {
    s.alpha(1 - s.ease('fanin', 0.6), () => sizes(s));
    s.alpha(s.win('fanin', 'xavier'), () => fanIn(s));
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

// ---- the worked problem: He's std read off a matrix shape

const tryIt: SceneDef = {
  draw(s) {
    const u = s.u;
    const q = { size: 3.4, font: 'mono', color: s.c('--ink') } as const;
    const line = { size: 3.6, font: 'mono', weight: 600, halo: true } as const;
    s.alpha(s.ease('p1', 0.6), () => {
      s.text('ReLU layer, He initialization', s.w / 2, s.h * 0.08, q);
      s.text('weight matrix of shape (20, 8)', s.w / 2, s.h * 0.08 + 5.5 * u, q);
      s.alpha(after(s, 'p1', 0.6), () => s.text('std of the weights?', s.w / 2, s.h * 0.08 + 11 * u, { ...q, weight: 650, color: s.c('gold') }));
      const R = 20;
      const C = 8;
      const cw = 3.2 * u;
      const rh = 1.4 * u;
      const x0 = s.w / 2 - (C * cw) / 2;
      const y0 = s.h * 0.32;
      const col = after(s, 'a1', 0.05);
      for (let j = 0; j < C; j++) s.rrect(x0 + j * cw + 0.25 * u, y0, cw - 0.5 * u, R * rh, 0.6, { fill: s.tint('blue', 0.12 + 0.25 * col), stroke: s.tint('blue', 0.5 + 0.4 * col), lw: 0.25 });
      for (let i = 1; i < R; i++) s.line(x0, y0 + i * rh, x0 + C * cw, y0 + i * rh, s.tint('blue', 0.25), 0.15);
      const lab = { size: 3.2, font: 'mono', color: s.c('--ink-2') } as const;
      s.text('20 rows: units', x0 - 2.5 * u, y0 + (R * rh) / 2, { ...lab, align: 'right' });
      s.text('8 columns: inputs', s.w / 2, y0 - 3.5 * u, { ...lab, color: s.c(col > 0.5 ? 'blue' : '--ink-2') });
      const ay = s.h * 0.7;
      s.alpha(col, () => s.text('fan-in n = 8, the columns', s.w / 2, ay, { ...line, color: s.c('blue') }));
      s.alpha(after(s, 'a1', 0.45), () => s.text('He: variance 2/8 = 0.25', s.w / 2, ay + 6.5 * u, { ...line, color: s.c('--ink-2') }));
      s.alpha(after(s, 'a1', 0.75), () => s.text('std = √0.25 = 0.5', s.w / 2, ay + 13 * u, { ...line, size: 4, weight: 650, color: s.c('gold') }));
    });
  },
};

export const scenes: Record<string, SceneDef> = { symmetry, scale, try: tryIt };

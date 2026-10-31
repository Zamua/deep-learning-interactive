import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import type { Ink } from '../../../lecture/scene';
import { after, cells, cite, fmt } from '../../draw';
import { caption, Frame, rich, unit, vcells } from '../draw';

const gauss = (sd: number, peak: number) => (z: number) => peak * Math.exp(-(z * z) / (2 * sd * sd));

/**
 * A bell of standard deviation `sd` standing on `base`, `ht` tall, over a z axis from -R to R drawn
 * from xl to xr. It is sampled across its own width, so a narrow one still shows as a spike.
 */
function bell(s: Scene, xl: number, xr: number, R: number, base: number, ht: number, sd: number, k: Ink, fill = 0.16): void {
  const X = (z: number) => xl + ((z + R) / (2 * R)) * (xr - xl);
  const g = gauss(sd, ht);
  const lo = Math.max(-R, -4.5 * sd);
  const hi = Math.min(R, 4.5 * sd);
  const c = s.ctx;
  c.save();
  c.beginPath();
  c.rect(xl, base - ht * 1.3, xr - xl, ht * 1.3 + 0.5 * s.u);
  c.clip();
  c.beginPath();
  c.moveTo(X(-R), base);
  for (let i = 0; i <= 90; i++) {
    const z = lo + ((hi - lo) * i) / 90;
    c.lineTo(X(z), base - g(z));
  }
  c.lineTo(X(R), base);
  c.fillStyle = s.tint(k, fill);
  c.fill();
  c.strokeStyle = s.c(k);
  c.lineWidth = 0.55 * s.u;
  c.lineJoin = 'round';
  c.stroke();
  c.restore();
}

/** A bell on a plot frame whose z range is symmetric about 0. */
const bellOn = (F: Frame, sd: number, k: Ink, peak = 1.1, fill = 0.16) => bell(F.s, F.l, F.r, F.xr[1], F.Y(0), F.Y(0) - F.Y(peak), sd, k, fill);

/** Red under the bell where |z| > 2, the tanh's flat ends. */
function flatMass(s: Scene, F: Frame, sd: number, peak = 1.1) {
  const g = gauss(sd, peak);
  const R = F.xr[1];
  F.clip(() => {
    const c = s.ctx;
    for (const side of [-1, 1]) {
      c.beginPath();
      c.moveTo(F.X(2 * side), F.Y(0));
      for (let i = 0; i <= 60; i++) {
        const z = side * (2 + ((R - 2) * i) / 60);
        c.lineTo(F.X(z), F.Y(g(z)));
      }
      c.lineTo(F.X(R * side), F.Y(0));
      c.closePath();
      c.fillStyle = s.tint('red', 0.28);
      c.fill();
    }
  });
}

/** Arrows from 0 out to one standard deviation either side, at height y, labelled at the right. */
function stdArrows(s: Scene, F: Frame, sd: number, y: number, k: Ink, label: string) {
  s.arrow(F.X(0), F.Y(y), F.X(sd), F.Y(y), s.c(k), 0.4, 1.5);
  s.arrow(F.X(0), F.Y(y), F.X(-sd), F.Y(y), s.c(k), 0.4, 1.5);
  s.text(label, F.X(sd) + 1.5 * s.u, F.Y(y), { size: 3.3, font: 'mono', weight: 650, align: 'left', color: s.c(k), halo: true });
}

/** z ticks under a plot's axis. */
function ticks(s: Scene, F: Frame, ts: number[]) {
  for (const t of ts) s.text(fmt(t), F.X(t), F.Y(0) + 4 * s.u, { size: 3, font: 'mono', color: s.c('--ink-3') });
}

interface Row {
  label: string;
  sd: number;
  note: string;
  a?: number;
}

/**
 * One small bell per layer, stacked from `top` to `bottom` (fractions of the height), each on its
 * own z axis from -3 to 3: how widely that layer's z swings. Returns where each row stands.
 */
function stack(s: Scene, rows: Row[], k: Ink, top: number, bottom: number, noteK: Ink = k): { base: (i: number) => number; X: (z: number) => number; ht: number } {
  const u = s.u;
  const labelW = 15 * u;
  const noteW = 19 * u;
  const A = Math.min(s.w - 21 * u - labelW - noteW, 80 * u);
  const x0 = s.w / 2 - (labelW + noteW + A + 5 * u) / 2;
  const xl = x0 + labelW + 2.5 * u;
  const xr = xl + A;
  const step = ((bottom - top) * s.h) / rows.length;
  const base = (i: number) => top * s.h + (i + 1) * step - 0.12 * step;
  const ht = 0.62 * step;
  const X = (z: number) => xl + ((z + 3) / 6) * A;
  rows.forEach((r, i) => {
    s.alpha(r.a ?? 1, () => {
      const y = base(i);
      s.line(xl, y, xr, y, s.c('--axis'), 0.3);
      bell(s, xl, xr, 3, y, ht, r.sd, k);
      const ly = y - 0.3 * ht;
      s.text(r.label, xl - 2.5 * u, ly, { size: 3.2, font: 'mono', align: 'right', color: s.c('--ink-2') });
      s.text(r.note, xr + 2.5 * u, ly, { size: 3.2, font: 'mono', weight: 600, align: 'left', color: s.c(noteK) });
    });
  });
  return { base, X, ht };
}

// ---- start: equal weights make identical units; random weights tell them apart

const RAND = [[0.1, -0.1], [-0.2, 0.1], [0.2, 0.1]];
const GRAD = [0.35, -0.5, 0.8];

const start: SceneDef = {
  draw(s) {
    const u = s.u;
    const cx = s.w / 2;
    const xin = cx - 40 * u;
    const ins = [s.h * 0.36, s.h * 0.58];
    const rowY = [s.h * 0.24, s.h * 0.47, s.h * 0.7];
    const hx = cx - 14 * u;
    const wx = [cx + 3 * u, cx + 15 * u];
    const gx = cx + 31 * u;
    const eq = s.ease('equal', 0.6);
    const stepped = after(s, 'grad', 0.55, 0.8);
    const rnd = s.ease('random', 0.8);
    // Rows 0 and 2 trade places: identical units, so the picture does not change.
    const swap = after(s, 'symmetry', 0.55, 1.6);
    const ys = [lerp(rowY[0]!, rowY[2]!, swap), rowY[1]!, lerp(rowY[2]!, rowY[0]!, swap)];
    const dim = [1, 1 - 0.65 * Math.sin(Math.PI * swap), 1];
    const head = { size: 3.8, font: 'mono', weight: 650 } as const;
    s.text('x', xin, s.h * 0.12, { ...head, color: s.c('orange') });
    s.text('z', hx, s.h * 0.12, { ...head, color: s.c('gold') });
    s.text('W', (wx[0]! + wx[1]!) / 2, s.h * 0.12, { ...head, color: s.c('blue') });
    vcells(s, xin, ins, ['2', '1'], 'orange', { w: 10 });
    const w = 0.5 - 0.1 * stepped;
    const z = 3 * w;
    ys.forEach((y, i) => {
      s.alpha(dim[i]!, () => {
        for (const iy of ins) s.line(xin + 5.5 * u, iy, hx - 6.5 * u, y, s.tint('blue', 0.35), 0.3);
        const zr = RAND[i]![0]! * 2 + RAND[i]![1]!;
        const lab = rnd > 0.5 ? fmt(Math.round(zr * 10) / 10) : eq > 0.5 ? z.toFixed(1) : '';
        unit(s, hx, y, 6, lab, 'gold', s.win('same', 'grad') + 0.5 * rnd, 3.2);
        s.alpha(1 - eq, () => cells(s, wx, y, ['?', '?'], '--ink-3', { w: 10, h: 8 }));
        s.alpha(eq * (1 - rnd), () => cells(s, wx, y, [w.toFixed(1), w.toFixed(1)], 'blue', { w: 10, h: 8, size: 3.2, on: [stepped * (1 - stepped) * 4, stepped * (1 - stepped) * 4] }));
        s.alpha(rnd, () => cells(s, wx, y, RAND[i]!.map(fmt), 'blue', { w: 10, h: 8, size: 3.2 }));
      });
    });
    // The gradient each unit gets: equal bars, then different ones.
    s.alpha(s.ease('grad', 0.6), () => {
      s.text('gradient', gx, s.h * 0.12, { ...head, size: 3.4, color: s.c('red') });
      s.line(gx, rowY[0]! - 5 * u, gx, rowY[2]! + 5 * u, s.c('--axis'), 0.3);
      ys.forEach((y, i) => {
        s.alpha(dim[i]!, () => {
          const g = lerp(0.6, GRAD[i]!, rnd);
          const bw = Math.abs(g) * 13 * u;
          s.rrect(g < 0 ? gx - bw : gx, y - 2.5 * u, bw, 5 * u, 0.6, { fill: s.tint('red', 0.45), stroke: s.c('red'), lw: 0.3 });
        });
      });
    });
    cite(s, 'Rumelhart, Hinton & Williams, 1986', s.ease('symmetry', 0.6));
    const cy = s.h * 0.88;
    s.alpha(s.win('start', 'equal'), () => caption(s, 'every weight needs a starting value', cy, '--ink-2', 3.4));
    s.alpha(s.win('equal', 'same'), () => caption(s, 'every weight 0.5', cy, 'blue', 3.6));
    s.alpha(s.win('same', 'grad'), () => caption(s, 'same weights → same z', cy, 'gold', 3.6));
    s.alpha(s.win('grad', 'symmetry'), () => caption(s, 'same gradient, same step: still copies', cy, 'red', 3.4));
    s.alpha(s.win('symmetry', 'random'), () => caption(s, 'swap any two units: nothing changes', cy, '--ink-2', 3.4));
    s.alpha(rnd, () => caption(s, 'random weights: every unit different', cy, 'blue', 3.4));
  },
};

// ---- size: too large saturates the tanh, too small fades layer by layer

const size: SceneDef = {
  draw(s) {
    const u = s.u;
    const big = 1 - s.ease('small', 0.6);
    const scale = s.ease('small', 0.6);
    const lec = s.ease('lecun', 0.6);
    const top = { size: 3.6, font: 'mono', weight: 600, halo: true } as const;
    s.alpha((1 - scale) * (1 - lec), () => rich(s, [['scale 1: ', '--ink-2'], ['std(w) = 1', 'blue']], s.w / 2, s.h * 0.08, top));
    s.alpha(scale * (1 - lec), () => rich(s, [['scale 0.01: ', '--ink-2'], ['std(w) = 0.01', 'blue']], s.w / 2, s.h * 0.08, top));
    const cy = s.h * 0.92;
    // The plot of z: one weight's spread, then a hundred terms' sum through a tanh.
    s.alpha(big, () => {
      const F = new Frame(s, 8 * u, s.h * 0.2, s.w - 8 * u, s.h * 0.8, [-25, 25], [-1.25, 1.3]);
      F.axes();
      ticks(s, F, [-20, -10, 10, 20]);
      const grow = s.ease('big', 1.6, 0.8);
      const sd = lerp(1, 10, grow);
      s.text(grow < 0.5 ? 'w' : 'z', F.r, F.Y(0) + 4 * u, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c(grow < 0.5 ? 'blue' : 'purple') });
      s.alpha(s.ease('flat', 0.6), () => flatMass(s, F, sd));
      s.alpha(1 - grow, () => bellOn(F, sd, 'blue'));
      s.alpha(grow, () => bellOn(F, sd, 'gold'));
      const lab = { size: 3.4, font: 'mono', weight: 600, halo: true } as const;
      s.alpha(s.ease('randn', 0.6, 0.8) * (1 - grow), () => s.text('weights: std 1', F.X(0), F.Y(1.1) - 4 * u, { ...lab, color: s.c('blue') }));
      s.alpha(after(s, 'big', 0.6) * (1 - s.ease('flat', 0.6)), () => stdArrows(s, F, 10, 0.55, 'gold', 'std 10'));
      s.alpha(s.ease('flat', 0.6), () => {
        F.fn(Math.tanh, 'purple', 0.7);
        s.text('tanh', F.X(5), F.Y(1) - 4 * u, { ...lab, align: 'left', color: s.c('purple') });
        s.text('flat: slope ≈ 0', F.X(-14), F.Y(-0.55), { ...lab, color: s.c('red') });
        s.text('flat: slope ≈ 0', F.X(14), F.Y(-0.55), { ...lab, color: s.c('red') });
      });
      s.alpha(s.win('randn', 'big'), () => caption(s, 'randn: centered on 0, std 1', cy, 'blue', 3.4));
      s.alpha(s.win('big', 'flat'), () => caption(s, '100 terms: std(z) = √100 × 1 = 10', cy, 'gold', 3.4));
      s.alpha(s.win('flat', 'small'), () => caption(s, 'most units saturated: gradients vanish', cy, 'red', 3.4));
    });
    // Layer by layer: each multiplies the spread by 0.1.
    s.alpha(scale * (1 - lec), () => {
      const rows: Row[] = [
        { label: 'inputs', sd: 1, note: 'std 1' },
        { label: 'layer 1', sd: 0.1, note: 'std 0.1', a: after(s, 'small', 0.45) },
        { label: 'layer 2', sd: 0.01, note: 'std 0.01', a: after(s, 'layers', 0.5) },
        { label: 'layer 3', sd: 0.001, note: 'std 0.001', a: after(s, 'layers', 0.62) },
      ];
      const g = stack(s, rows, 'gold', 0.14, 0.84);
      // The gradient, going back up, shrinks by the same 0.1 at every layer.
      s.alpha(s.ease('back', 0.6), () => {
        for (let i = 0; i < 3; i++) {
          const x = g.X(2.3);
          const y0 = g.base(i + 1) - 1 * u;
          const y1 = g.base(i) + 1.5 * u;
          s.arrow(x, y0, x, y1, s.c('red'), 0.4, 1.5);
          s.text('×0.1', x - 1.5 * u, (y0 + y1) / 2, { size: 3, font: 'mono', weight: 600, align: 'right', color: s.c('red'), halo: true });
        }
      });
      s.alpha(s.win('small', 'layers'), () => caption(s, 'std(z) = 10 × 0.01 = 0.1', cy, 'gold', 3.6));
      s.alpha(s.win('layers', 'back'), () => caption(s, 'tanh near 0 passes it on: ×0.1 a layer', cy, 'gold', 3.3));
      s.alpha(s.ease('back', 0.6), () => caption(s, 'the gradient shrinks too, going back', cy, 'red', 3.4));
    });
    // Both failures and the aim between them.
    s.alpha(lec, () => {
      const pw = Math.min(36 * u, (s.w - 12 * u) / 3);
      const half = pw / 2 - 2.5 * u;
      const t = s.h * 0.3;
      const b = s.h * 0.66;
      const panels: [number, string, Ink, string][] = [
        [0.1, 'too small', 'red', 'std(z) 0.1'],
        [1, 'aim', 'green', 'std(z) ≈ 1'],
        [10, 'too large', 'red', 'std(z) 10'],
      ];
      panels.forEach(([sd, head, k, foot], i) => {
        const pcx = s.w / 2 + (i - 1) * pw;
        const F = new Frame(s, pcx - half, t, pcx + half, b, [-6, 6], [-1.25, 1.3]);
        s.alpha(after(s, 'lecun', 0.1 + 0.25 * i), () => {
          F.axes();
          if (sd > 2) flatMass(s, F, sd);
          F.fn(Math.tanh, 'purple', 0.5);
          bellOn(F, sd, 'gold');
          s.text(head, pcx, t - 4 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c(k) });
          s.text(foot, pcx, b + 4.5 * u, { size: 3.1, font: 'mono', color: s.c('--ink-2') });
        });
      });
      caption(s, 'aim between: std(z) ≈ 1', cy, 'green', 3.6);
    });
    cite(s, 'LeCun, Bottou, Orr & Müller, 1998', lec);
  },
};

// ---- fanin: aim for std 1, count the fan-in, and scale by it

/** The z plot with a tanh over it, used for the aim and for the scale settling. */
function aimPlot(s: Scene, sd: number, label: string) {
  const u = s.u;
  const F = new Frame(s, 8 * u, s.h * 0.24, s.w - 8 * u, s.h * 0.8, [-6, 6], [-1.25, 1.3]);
  F.axes();
  ticks(s, F, [-4, -2, 2, 4]);
  s.text('z', F.r, F.Y(0) + 4 * u, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('purple') });
  flatMass(s, F, sd);
  F.fn(Math.tanh, 'purple', 0.7);
  bellOn(F, sd, 'gold');
  s.text('tanh', F.X(2.5), F.Y(1) - 4 * u, { size: 3.4, font: 'mono', weight: 600, align: 'left', color: s.c('purple'), halo: true });
  stdArrows(s, F, Math.min(sd, 4.5), 0.5, 'gold', label);
}

/** n inputs drawn as lines fanning in to one unit. */
function fan(s: Scene, grow: number) {
  const u = s.u;
  const n = 5;
  const ux = s.w / 2 + 16 * u;
  const uy = s.h * 0.47;
  const ix = s.w / 2 - 24 * u;
  const iy = (j: number) => s.h * (0.24 + (0.46 * j) / (n - 1));
  const c = s.ctx;
  c.beginPath();
  c.moveTo(ix, iy(0));
  c.lineTo(ux - 7 * u, uy);
  c.lineTo(ix, iy(n - 1));
  c.closePath();
  c.fillStyle = s.tint('blue', 0.07 * grow);
  c.fill();
  for (let j = 0; j < n; j++) {
    const p = Math.max(0, Math.min(1, grow * n - j));
    if (p > 0) s.line(ix, iy(j), lerp(ix, ux - 7 * u, p), lerp(iy(j), uy, p), s.tint('blue', 0.7), 0.35);
    s.circle(ix, iy(j), 1.8 * u, { fill: s.c('orange'), stroke: s.c('--card'), lw: 0.3 });
  }
  unit(s, ux, uy, 7, 'z', 'gold', 0.4, 3.6);
  s.text('n = 5 inputs', ix, s.h * 0.15, { size: 3.4, font: 'mono', weight: 600, color: s.c('orange') });
  s.alpha(after(s, 'fanin', 0.6), () => s.text('fan-in: 5', ux, uy + 12 * u, { size: 3.6, font: 'mono', weight: 650, color: s.c('blue'), halo: true }));
}

/** A weight matrix as a grid: a row per unit, a column per input, the columns counted as the fan-in. */
function grid(s: Scene, col: number) {
  const u = s.u;
  const R = 3;
  const C = 5;
  const p = 9 * u;
  const cx = s.w / 2 + 4 * u;
  const cy = s.h * 0.5;
  const x = (j: number) => cx + (j - (C - 1) / 2) * p;
  const y = (i: number) => cy + (i - (R - 1) / 2) * p;
  for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) s.cell(x(j) - 3.8 * u, y(i) - 3.8 * u, 7.6 * u, 7.6 * u, '', 'blue', { on: col * 0.5 });
  const lab = { size: 3.2, font: 'mono', color: s.c('--ink-2') } as const;
  for (let i = 0; i < R; i++) s.text(`unit ${i}`, x(0) - 6 * u, y(i), { ...lab, align: 'right' });
  s.alpha(col, () => {
    for (let j = 0; j < C; j++) s.text(String(j), x(j), y(0) - 7.5 * u, { ...lab, color: s.c('blue'), weight: 650 });
    s.text('one column per input', cx, y(0) - 13 * u, { ...lab, color: s.c('blue') });
  });
  s.text('W', x(C - 1) + 7 * u, cy, { size: 4, font: 'mono', weight: 650, color: s.c('blue') });
}

const ONES: Row[] = ['inputs', 'layer 1', 'layer 2', 'layer 3'].map((label) => ({ label, sd: 1, note: 'std 1' }));

const fanin: SceneDef = {
  marks: {
    rule: { tex: String.raw`\mathrm{Var}(z) = n\,\mathrm{Var}(\symw) = 1`, x: 0.5, y: 0.34, size: 5 },
    inv: { tex: String.raw`\mathrm{Var}(\symw) = \dfrac{1}{n}`, x: 0.5, y: 0.58, size: 5.4 },
    sd: { tex: String.raw`\mathrm{std}(\symw) = \dfrac{1}{\sqrt{n}}`, x: 0.5, y: 0.09, size: 4.4 },
    xavier: { tex: String.raw`\mathrm{Var}(\symw) = \dfrac{1}{n} \qquad \mathrm{std} = \dfrac{1}{\sqrt{n}}`, x: 0.5, y: 0.5, size: 5 },
  },
  draw(s) {
    const u = s.u;
    const cy = s.h * 0.92;
    s.alpha(1 - s.ease('fanin', 0.6), () => {
      aimPlot(s, 1, 'std 1');
      caption(s, 'std(z) ≈ 1: on the bend, off the flat', cy, 'gold', 3.4);
    });
    s.alpha(s.win('fanin', 'cols'), () => {
      fan(s, s.prog('fanin') * 2);
      caption(s, 'fan-in: the inputs one unit adds up', cy, 'blue', 3.4);
    });
    s.alpha(s.win('cols', 'rule'), () => {
      grid(s, after(s, 'cols', 0.4));
      s.alpha(after(s, 'cols', 0.6), () => caption(s, 'fan-in n = 5 columns', cy, 'blue', 3.6));
    });
    const marks = s.win('rule', 'std');
    s.show('rule', marks);
    s.show('inv', marks * after(s, 'rule', 0.55));
    s.alpha(marks, () => caption(s, 'inputs of variance 1', cy, '--ink-2', 3.4));
    // The scale drops from 1 to 1/√100 = 0.1, and z's bell settles to a width of 1.
    const st = s.win('std', 'glorot');
    s.show('sd', st);
    s.alpha(st, () => {
      const p = after(s, 'std', 0.05, 2.2);
      const sw = lerp(1, 0.1, p);
      aimPlot(s, 10 * sw, `std ${(10 * sw).toFixed(1)}`);
      rich(s, [['std(w) = ', '--ink-2'], [sw.toFixed(2), 'blue'], ['   std(z) = 10 × std(w)', '--ink-2']], s.w / 2, s.h * 0.18, { size: s.tall ? 3.1 : 3.4, weight: 600, halo: true });
      s.alpha(after(s, 'std', 0.7), () => caption(s, 'n = 100:  1/√100 = 0.1', cy, 'blue', 3.6));
    });
    s.alpha(s.win('glorot', 'name'), () => {
      stack(s, ONES, 'gold', 0.14, 0.84);
      caption(s, 'every layer passes on std 1', cy, 'gold', 3.6);
    });
    const nm = s.ease('name', 0.6);
    s.show('xavier', nm);
    s.alpha(nm, () => {
      s.text('Xavier initialization', s.w / 2, s.h * 0.3, { size: 4.4, font: 'mono', weight: 650, color: s.c('purple'), halo: true });
      s.text('for tanh', s.w / 2, s.h * 0.7, { size: 3.8, font: 'mono', weight: 600, color: s.c('--ink-2'), halo: true });
    });
    cite(s, 'Glorot & Bengio, 2010', s.ease('glorot', 0.6));
  },
};

// ---- relu: a ReLU halves the variance, so double the weights'; then a worked shape

const HALVES: Row[] = [
  { label: 'layer 1', sd: 1, note: 'var 1' },
  { label: 'layer 2', sd: Math.SQRT1_2, note: 'var 1/2' },
  { label: 'layer 3', sd: 0.5, note: 'var 1/4' },
  { label: 'layer 4', sd: Math.SQRT1_2 / 2, note: 'var 1/8' },
];

const relu: SceneDef = {
  marks: {
    he: { tex: String.raw`\mathrm{Var}(\symw) = \dfrac{2}{n} \qquad \mathrm{std} = \sqrt{\dfrac{2}{n}}`, x: 0.5, y: 0.09, size: 4.6 },
  },
  draw(s) {
    const u = s.u;
    const cy = s.h * 0.92;
    // z's bell under a ReLU: the negative half becomes 0.
    s.alpha(1 - s.ease('half', 0.6), () => {
      const F = new Frame(s, 8 * u, s.h * 0.18, s.w - 8 * u, s.h * 0.8, [-4, 4], [-0.35, 1.3]);
      F.axes();
      ticks(s, F, [-3, -2, -1, 1, 2, 3]);
      s.text('z', F.r, F.Y(0) + 4 * u, { size: 3.4, font: 'mono', weight: 650, align: 'right', color: s.c('purple') });
      const zero = after(s, 'relu', 0.45);
      bellOn(F, 1, 'gold');
      s.alpha(zero, () => {
        F.clip(() => {
          const c = s.ctx;
          const g = gauss(1, 1.1);
          c.beginPath();
          c.moveTo(F.X(-4), F.Y(0));
          for (let i = 0; i <= 60; i++) c.lineTo(F.X(-4 + (4 * i) / 60), F.Y(g(-4 + (4 * i) / 60)));
          c.lineTo(F.X(0), F.Y(0));
          c.closePath();
          c.fillStyle = s.tint('red', 0.3);
          c.fill();
        });
        const lab = { size: 3.4, font: 'mono', weight: 600, color: s.c('red'), halo: true } as const;
        s.text('becomes 0:', F.X(-2.75), F.Y(0.78), lab);
        s.text('about half', F.X(-2.75), F.Y(0.78) + 4.5 * u, lab);
      });
      F.fn((z) => 0.3 * Math.max(0, z), 'purple', 0.7);
      s.text('ReLU', F.X(3.1), F.Y(0.93) - 3 * u, { size: 3.4, font: 'mono', weight: 600, align: 'right', color: s.c('purple'), halo: true });
      caption(s, 'ReLU: every negative z becomes 0', cy, 'red', 3.4);
    });
    // Layer by layer: halving under 1/n, then held at 1 under 2/n.
    const fix = s.ease('double', 1.4, 0.4);
    s.alpha(s.win('half', 'shape'), () => {
      const rows = HALVES.map((r, i) => ({ ...r, sd: lerp(r.sd, 1, fix), note: fix > 0.5 ? 'var 1' : r.note, a: after(s, 'half', 0.2 + 0.15 * i) }));
      stack(s, rows, 'gold', 0.2, 0.84, fix > 0.5 ? 'green' : 'red');
      s.alpha(s.win('half', 'double'), () => caption(s, '1/n with ReLU: the variance halves', cy, 'red', 3.4));
      s.alpha(s.win('double', 'he'), () => caption(s, '2/n: every layer keeps variance 1', cy, 'green', 3.4));
      s.alpha(s.ease('he', 0.6), () => caption(s, '30 layers: 2/n trains, 1/n stalls', cy, '--ink-2', 3.4));
    });
    s.show('he', s.win('double', 'he'));
    cite(s, 'He, Zhang, Ren & Sun, 2015', s.win('he', 'shape'));
    s.alpha(after(s, 'he', 0.75) * (1 - s.ease('shape', 0.6)), () => s.text('He initialization, for ReLU', s.w / 2, s.h * 0.11, { size: 3.8, font: 'mono', weight: 650, color: s.c('gold'), halo: true }));
    // The worked problem: He's std read off a matrix shape.
    s.alpha(s.ease('shape', 0.6), () => {
      const q = { size: 3.4, font: 'mono', color: s.c('--ink') } as const;
      const line = { size: 3.6, font: 'mono', weight: 600, halo: true } as const;
      s.text('ReLU layer, He initialization', s.w / 2, s.h * 0.08, q);
      s.text('weight matrix: 20 rows, 8 columns', s.w / 2, s.h * 0.08 + 5.5 * u, q);
      s.alpha(after(s, 'shape', 0.4), () => s.text('std of the weights?', s.w / 2, s.h * 0.08 + 11 * u, { ...q, weight: 650, color: s.c('gold') }));
      const R = 20;
      const C = 8;
      const cw = 3.2 * u;
      const rh = 1.4 * u;
      const x0 = s.w / 2 - (C * cw) / 2;
      const y0 = s.h * 0.32;
      const col = after(s, 'shape', 0.65);
      for (let j = 0; j < C; j++) s.rrect(x0 + j * cw + 0.25 * u, y0, cw - 0.5 * u, R * rh, 0.6, { fill: s.tint('blue', 0.12 + 0.25 * col), stroke: s.tint('blue', 0.5 + 0.4 * col), lw: 0.25 });
      for (let i = 1; i < R; i++) s.line(x0, y0 + i * rh, x0 + C * cw, y0 + i * rh, s.tint('blue', 0.25), 0.15);
      const lab = { size: 3.2, font: 'mono', color: s.c('--ink-2') } as const;
      s.text('20 rows: units', x0 - 2.5 * u, y0 + (R * rh) / 2, { ...lab, align: 'right' });
      s.text('8 columns: inputs', s.w / 2, y0 - 3.5 * u, { ...lab, color: s.c(col > 0.5 ? 'blue' : '--ink-2') });
      const ay = s.h * 0.7;
      s.alpha(col, () => s.text('fan-in n = 8, the columns', s.w / 2, ay, { ...line, color: s.c('blue') }));
      s.alpha(after(s, 'ans', 0.05), () => s.text('variance 2/8 = 0.25', s.w / 2, ay + 6.5 * u, { ...line, color: s.c('--ink-2') }));
      s.alpha(after(s, 'ans', 0.5), () => s.text('std = √0.25 = 0.5', s.w / 2, ay + 13 * u, { ...line, size: 4, weight: 650, color: s.c('gold') }));
    });
  },
};

export const scenes: Record<string, SceneDef> = { start, size, fanin, relu };

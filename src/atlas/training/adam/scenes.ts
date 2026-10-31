import { type Ink, lerp, type Scene, type SceneDef, smooth } from '../../../lecture/scene';
import { after, cite } from '../../draw';
import { clipped, frame, type Frame } from '../../optimization/draw';
import { key, series, xTicks, yTicks } from '../draw';
import type { Color } from '../../../core/symbols';
import { caption, rich } from '../../networks/draw';
/** Linear 0 -> 1 over `dur` seconds, starting `delay` seconds into beat `id`. */
const grow = (s: Scene, id: string, dur: number, delay = 0) => Math.max(0, Math.min(1, (s.since(id) - delay) / dur));

const M: Color = 'orange';
const V: Color = 'teal';
const PLAIN: Color = 'slate';
const ADAM: Color = 'green';

/** One parameter's Adam averages over a gradient sequence, corrected: [m̂, √v̂] after each step. */
function adamStats(gs: number[]): [number, number][] {
  let m = 0;
  let v = 0;
  return gs.map((g, i) => {
    m = 0.9 * m + 0.1 * g;
    v = 0.999 * v + 0.001 * g * g;
    return [m / (1 - 0.9 ** (i + 1)), Math.sqrt(v / (1 - 0.999 ** (i + 1)))];
  });
}

// ---- divide: momentum's valley, where Adam's ratio m / √v is about ±1 along it and near 0 across it

/** The valley L = 0.5 (0.05 w0² + w1²), as momentum and the running averages drew it. */
const A = 0.05;
const STEPS = 18;
const START: [number, number] = [-4.5, 1.6];
const PLAIN_PATH: [number, number][] = [START];
const GRADS: [number, number][] = [];
for (let i = 0; i < STEPS; i++) {
  const [w0, w1] = PLAIN_PATH[i]!;
  GRADS.push([A * w0, w1]);
  PLAIN_PATH.push([w0 - 1.8 * A * w0, w1 - 1.8 * w1]);
}
/** Adam itself on the same valley, η = 0.3. */
const ADAM_PATH: [number, number][] = [START];
{
  const m = [0, 0];
  const v = [0, 0];
  const w = [...START];
  for (let t = 1; t <= STEPS; t++) {
    const g = [A * w[0]!, w[1]!];
    for (let k = 0; k < 2; k++) {
      m[k] = 0.9 * m[k]! + 0.1 * g[k]!;
      v[k] = 0.999 * v[k]! + 0.001 * g[k]! ** 2;
      w[k] = w[k]! - (0.3 * (m[k]! / (1 - 0.9 ** t))) / (Math.sqrt(v[k]! / (1 - 0.999 ** t)) + 1e-8);
    }
    ADAM_PATH.push([w[0]!, w[1]!]);
  }
}
/** The averages a few steps into plain descent's gradients: along the valley and across it. */
const AT = 5;
const ALONG = adamStats(GRADS.map((g) => g[0]))[AT]!;
const ACROSS = adamStats(GRADS.map((g) => g[1]))[AT]!;
const ratioOf = ([m, root]: [number, number], places: number) => (m / root).toFixed(places).replace('-', '−');

function contours(s: Scene, F: Frame): void {
  clipped(s, F, () => {
    for (const c of [0.08, 0.3, 0.7, 1.3, 2.1]) {
      const g = s.ctx;
      g.beginPath();
      g.ellipse(F.X(0), F.Y(0), F.X(Math.sqrt((2 * c) / A)) - F.X(0), F.Y(0) - F.Y(Math.sqrt(2 * c)), 0, 0, Math.PI * 2);
      g.strokeStyle = s.tint('red', 0.3);
      g.lineWidth = 0.35 * s.u;
      g.stroke();
    }
  });
}

/** A signed bar standing on `base` at x, `scale` px per unit. */
function bar(s: Scene, x: number, base: number, v: number, scale: number, k: Ink, w: number, g = 1) {
  const h = v * scale * g;
  s.rrect(x - w / 2, Math.min(base, base - h), w, Math.max(0.5 * s.u, Math.abs(h)), 0.5, { fill: s.tint(k, 0.45), stroke: s.c(k), lw: 0.3 });
}

/** One parameter's m and √v as bars, its name above and its ratio below. */
function pair(s: Scene, x: number, base: number, name: string, stats: [number, number], ratio: string, o: { m: number; root: number; ratio: number; hi: number }) {
  const u = s.u;
  const scale = (s.tall ? 22 : 19) * u;
  const bw = 6 * u;
  s.alpha(0.45 + 0.55 * o.hi, () => {
    s.line(x - 12 * u, base, x + 12 * u, base, s.c('--axis'), 0.3);
    s.text(name, x, base - scale * 1.05 - 4 * u, { size: 3.3, font: 'mono', weight: 650, color: s.c('blue'), halo: true });
    s.alpha(o.m, () => {
      bar(s, x - 4.5 * u, base, stats[0], scale, M, bw, o.m);
      s.text('m', x - 4.5 * u, stats[0] < 0 ? base - 3 * u : base + 3.5 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c(M), halo: true });
    });
    s.alpha(o.root, () => {
      bar(s, x + 4.5 * u, base, stats[1], scale, V, bw, o.root);
      s.text('√v', x + 4.5 * u, base + 3.5 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c(V), halo: true });
    });
    s.alpha(o.ratio, () => rich(s, [['m / √v ≈ ', '--ink-2'], [ratio, '--ink']], x, base + 9 * u, { size: 3.3, weight: 600 }));
  });
}

const divide: SceneDef = {
  draw(s) {
    const u = s.u;
    const F = frame(6 * u, s.h * 0.08, s.w - 6 * u, s.h * 0.4, [-5.6, 1.6], [-2, 2]);
    contours(s, F);
    s.circle(F.X(0), F.Y(0), 0.9 * u, { fill: s.c('red') });
    const path = s.win('path', 'rms') + 0.6 * s.ease('rms', 0.6);
    s.alpha(1 - 0.5 * path, () => series(s, F, PLAIN_PATH, PLAIN, { upto: grow(s, 'back', 4, 0.5), width: 0.45, dots: 0.6 }));
    series(s, F, ADAM_PATH, ADAM, { upto: grow(s, 'path', 3.5, 0.3), width: 0.7, dots: 0.7 });
    s.circle(F.X(START[0]), F.Y(START[1]), 1.3 * u, { fill: s.c('blue'), stroke: s.c('--card'), lw: 0.4 });
    s.alpha(s.ease('path', 0.6), () => {
      let kx = F.l + 2 * u;
      kx = key(s, kx, F.b + 3 * u, PLAIN, 'plain');
      key(s, kx, F.b + 3 * u, ADAM, 'Adam');
    });

    // The two weights' averages, a few steps in.
    const base = s.h * 0.74;
    const along = s.win('along', 'across');
    const across = s.win('across', 'path');
    const both = 1 - along - across;
    const mIn = s.ease('back', 0.6, 2);
    const rootIn = s.ease('root', 0.8, 1);
    s.alpha(1 - 0.6 * s.ease('path', 0.6), () => {
      pair(s, s.w * 0.3, base, 'w₀: along', ALONG, ratioOf(ALONG, 0), { m: mIn, root: rootIn, ratio: s.ease('along', 0.6, 1), hi: both + along });
      pair(s, s.w * 0.7, base, 'w₁: across', ACROSS, ratioOf(ACROSS, 2), { m: mIn, root: rootIn, ratio: s.ease('across', 0.6, 1), hi: both + across });
    });

    const cy = s.h * 0.93;
    s.alpha(s.win('back', 'root'), () => rich(s, [['m', M], [': which way    ', '--ink-2'], ['v', V], [': how big, squared', '--ink-2']], s.w / 2, cy));
    s.alpha(s.win('root', 'divide'), () => rich(s, [['√v', V], [': the typical size of ', '--ink-2'], ['g', 'red'], ['  (RMS)', '--ink-3']], s.w / 2, cy));
    s.alpha(s.win('divide', 'along'), () => rich(s, [['step = ', '--ink-2'], ['η', PLAIN], [' · ', '--ink-2'], ['m', M], [' / ', '--ink-2'], ['√v', V]], s.w / 2, cy, { size: 4, weight: 600 }));
    s.alpha(along, () => caption(s, 'same size: a step of about η', cy, '--ink'));
    s.alpha(across, () => caption(s, 'm near 0: a small step, the zigzag damped', cy, '--ink', s.tall ? 3.3 : 3.6));
    s.alpha(s.win('path', 'rms'), () => caption(s, 'no zigzag, and at the bottom first', cy, ADAM));
    s.alpha(s.ease('rms', 0.6), () => rich(s, [['RMSProp: ', '--ink-3'], ['g', 'red'], [' / RMS    ', '--ink-2'], ['Adam: ', '--ink-3'], ['m', M], [' / RMS', '--ink-2']], s.w / 2, cy, { size: s.tall ? 3.3 : 3.6 }));
    cite(s, 'RMSProp · Tieleman & Hinton, 2012', s.ease('rms', 0.6));
  },
};

// ---- zero: a steady gradient of 2, the average m dragged toward its zero start, and m̂ lifting it

const MT: [number, number][] = Array.from({ length: 31 }, (_, t) => [t, 2 * (1 - 0.9 ** t)]);

const zero: SceneDef = {
  marks: {
    mh: { tex: String.raw`\sym{mhat}{\hat m} = \dfrac{\symm}{1 - \sym{beta1}{\beta_1}^{\,t}}`, x: 0.5, y: 0.67, size: 4.6 },
    vh: { tex: String.raw`\sym{vhat}{\hat v} = \dfrac{\symv}{1 - \sym{beta2}{\beta_2}^{\,t}}`, x: 0.5, y: 0.67, size: 4.6 },
  },
  draw(s) {
    const u = s.u;
    const F = frame(14 * u, s.h * 0.1, s.w - 8 * u, s.h * 0.52, [0, 30], [0, 2.5]);
    const dim = 1 - 0.7 * s.win('two', 'fade');
    s.alpha(dim, () => {
      s.line(F.l, F.b, F.r, F.b, s.c('--axis'), 0.35);
      s.line(F.l, F.b, F.l, F.t, s.c('--axis'), 0.35);
      yTicks(s, F, [0, 1, 2]);
      xTicks(s, F, [1, 10, 20, 30]);
      s.text('step t', F.r, F.b + 7 * u, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
      s.line(F.l, F.Y(2), F.r, F.Y(2), s.tint('red', 0.7), 0.35, [1.2, 1]);
      s.text('g = 2 every step', F.r - 1 * u, F.Y(2) - 3.2 * u, { size: 3.2, font: 'mono', weight: 600, align: 'right', color: s.c('red'), halo: true });
      // The gap between m and the true average: the pull toward zero.
      s.alpha(0.6 * s.win('bias', 'mhat'), () => clipped(s, F, () => {
        const g = s.ctx;
        g.beginPath();
        g.moveTo(F.X(0), F.Y(2));
        MT.forEach(([t, m]) => g.lineTo(F.X(t), F.Y(m)));
        g.lineTo(F.X(30), F.Y(2));
        g.closePath();
        g.fillStyle = s.tint('red', 0.16);
        g.fill();
      }));
      s.alpha(s.win('bias', 'share'), () => s.text('pulled toward 0', F.X(9), F.Y(1.55), { size: 3.3, font: 'mono', weight: 650, color: s.c('red'), halo: true }));
      const lift = smooth((s.since('mhat') - 0.4 * (s.end('mhat') - s.at('mhat'))) / 1.6);
      s.alpha(1 - 0.5 * lift * (1 - s.ease('fade', 0.6)), () => series(s, F, MT, M, { upto: grow(s, 'drag', 3, 0.8), width: 0.8 }));
      s.alpha(s.ease('drag', 0.5, 2), () => {
        s.circle(F.X(1), F.Y(0.2), 1.2 * u, { fill: s.c(M), stroke: s.c('--card'), lw: 0.4 });
        s.text('m = 0.2', F.X(1) + 2.5 * u, F.Y(0.2) - 3.4 * u, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c(M), halo: true });
      });
      s.alpha(s.win('share', 'mhat'), () => s.text('m = 2 · (1 − 0.9ᵗ)', F.X(17), F.Y(1.0), { size: 3.4, font: 'mono', weight: 650, color: s.c(M), halo: true }));
      // m̂: the same curve divided by 1 − 0.9ᵗ, rising onto 2.
      if (lift > 0) {
        const pts = MT.slice(1).map(([t, m]): [number, number] => [t, lerp(m, 2, lift)]);
        series(s, F, pts, M, { width: 0.9, dots: 0.6 });
        s.alpha(lift, () => s.text('m̂ = 2 from step 1', F.X(9), F.Y(2) + 4.5 * u, { size: 3.4, font: 'mono', weight: 650, color: s.c(M), halo: true }));
      }
      s.alpha(s.ease('fade', 0.6, 0.8), () => s.text('1 − 0.9ᵗ → 1: m catches up', F.X(19), F.Y(1.0), { size: 3.4, font: 'mono', weight: 650, color: s.c(M), halo: true }));
    });

    const y1 = s.h * 0.66;
    const y2 = s.h * 0.78;
    const o = { size: s.tall ? 3.5 : 3.8, weight: 600 } as const;
    s.alpha(s.win('drag', 'share'), () => rich(s, [['step 1:  ', '--ink-3'], ['0.9 × 0 + 0.1 × 2 = ', '--ink-2'], ['0.2', M]], s.w / 2, y1, o));
    s.alpha(s.win('bias', 'share'), () => caption(s, 'bias: a pull one way, here toward 0', y2, 'red', o.size));
    s.alpha(s.win('share', 'mhat'), () => rich(s, [['1 − ', '--ink-2'], ['β₁', 'slate'], ['ᵗ', 'slate'], ['  at t = 1:  1 − 0.9 = ', '--ink-2'], ['0.1', '--ink']], s.w / 2, y1, o));
    s.show('mh', s.win('mhat', 'vhat'));
    s.alpha(s.win('mhat', 'vhat') * after(s, 'mhat', 0.55), () => rich(s, [['0.2 / 0.1 = ', '--ink-2'], ['2', M]], s.w / 2, y2 + 2 * u, o));
    s.show('vh', s.win('vhat', 'two'));
    s.alpha(s.win('vhat', 'two') * after(s, 'vhat', 0.45), () => rich(s, [['0.004 / 0.001 = ', '--ink-2'], ['4', V], [' = g²', '--ink-2']], s.w / 2, y2 + 2 * u, o));
    // Two gradients that differ: 2, then -4.
    const ty = s.h * 0.3;
    s.alpha(s.win('two', 'fade'), () => {
      rich(s, [['g = 2, then −4:  ', '--ink-2'], ['m = −0.22', M]], s.w / 2, ty, { ...o, size: o.size + 0.2, halo: true });
      s.alpha(after(s, 'two', 0.55), () => rich(s, [['t = 2:  1 − 0.9² = 1 − 0.81 = ', '--ink-2'], ['0.19', '--ink']], s.w / 2, y1, o));
      s.alpha(s.ease('two2', 0.6), () => rich(s, [['m̂', M], [' = −0.22 / 0.19 ≈ ', '--ink-2'], ['−1.16', M]], s.w / 2, y2, { ...o, size: o.size + 0.2 }));
      s.alpha(after(s, 'two2', 0.6), () => caption(s, 'between the gradients 2 and −4', s.h * 0.88, 'green', o.size));
    });
    s.alpha(s.ease('fade', 0.6), () => rich(s, [['t grows:  ', '--ink-3'], ['β₁', 'slate'], ['ᵗ → 0,  divisor → 1', '--ink-2']], s.w / 2, y1, o));
  },
};

// ---- step: the whole update, its size at the first step, and what the correction prevents

/** Adam's step over η for a steady gradient without the correction: m / √v from their zero start. */
const LOGT = 3000;
const NOFIX: [number, number][] = Array.from({ length: 121 }, (_, i) => {
  const t = 10 ** ((i / 120) * Math.log10(LOGT));
  return [Math.log10(t), (1 - 0.9 ** t) / Math.sqrt(1 - 0.999 ** t)];
});
const PEAK = NOFIX.reduce((p, q) => (q[1] > p[1] ? q : p));

/** One row of the first-step picture: the plain step and Adam's, side by side. */
function stepRow(s: Scene, y: number, name: string, plain: number, a: number, hi: number) {
  const u = s.u;
  const x0 = s.w * 0.1;
  const half = s.w * 0.5;
  const L = Math.min(14 * u, s.w * 0.14);
  s.alpha(a, () => {
    s.text(name, x0, y - 5.5 * u, { size: 3.3, font: 'mono', weight: 650, align: 'left', color: s.c('red') });
    // Plain: η·g, in units of η, against a fixed length for η.
    const len = plain * L;
    const room = half - x0 - 6 * u;
    if (len > room) {
      s.arrow(x0, y, x0 + room, y, s.c(PLAIN), 0.6, 2.4);
      s.text(`${plain} η`, x0, y + 4.5 * u, { size: 3, font: 'mono', align: 'left', color: s.c(PLAIN) });
    } else {
      s.circle(x0, y, 0.9 * u, { fill: s.c(PLAIN) });
      s.text(`${plain} η`, x0, y + 4.5 * u, { size: 3, font: 'mono', align: 'left', color: s.c(PLAIN) });
    }
    s.alpha(hi, () => {
      const ax = half + 4 * u;
      s.arrow(ax, y, ax + L, y, s.c(ADAM), 0.8, 2.4);
      s.text('η', ax + L + 3 * u, y, { size: 3.6, font: 'mono', weight: 650, color: s.c(ADAM), align: 'left' });
    });
  });
}

const step: SceneDef = {
  marks: {
    rule: { tex: String.raw`\symw \leftarrow \symw - \symeta\,\dfrac{\sym{mhat}{\hat m}}{\sqrt{\sym{vhat}{\hat v}} + \sym{epstiny}{\epsilon}}`, x: 0.5, y: 0.12, size: 4.8 },
    ex: { tex: String.raw`\sym{mhat}{\hat m} = -1,\quad \sym{vhat}{\hat v} = 4,\quad \symeta = 0.1`, x: 0.5, y: 0.36, size: 4.4 },
    r: { tex: String.raw`\sym{mhat}{\hat m} / \sqrt{\sym{vhat}{\hat v}} = -1 / 2 = -0.5`, x: 0.5, y: 0.5, size: 4.4 },
    st: { tex: String.raw`\text{step} = \symeta \times (-0.5) = -0.05`, x: 0.5, y: 0.64, size: 4.4 },
    w: { tex: String.raw`\symw \leftarrow 1 - (-0.05) = 1.05`, x: 0.5, y: 0.78, size: 4.4 },
  },
  draw(s) {
    const u = s.u;
    s.show('rule', 1);
    s.alpha(s.win('eps', 'first'), () => caption(s, 'ε ≈ 10⁻⁸: only so it never divides by 0', s.h * 0.24, '--ink-2', s.tall ? 3.2 : 3.5));

    // The first step for a huge gradient and a tiny one.
    const rows = s.win('first', 'nofix');
    s.alpha(rows, () => {
      const hy = s.h * 0.32;
      s.text('plain:  η · g', s.w * 0.1, hy, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c(PLAIN) });
      s.alpha(s.ease('first', 0.6, 1.5), () => s.text('Adam, step 1', s.w * 0.5 + 4 * u, hy, { size: 3.4, font: 'mono', weight: 650, align: 'left', color: s.c(ADAM) }));
      s.line(s.w * 0.5, hy + 4 * u, s.w * 0.5, s.h * 0.78, s.c('--axis'), 0.3);
      stepRow(s, s.h * 0.48, 'g = 500', 500, s.ease('first', 0.6, 0.6), s.ease('first', 0.6, 1.5));
      stepRow(s, s.h * 0.66, 'g = 0.002', 0.002, s.ease('first', 0.6, 1.2), s.ease('first', 0.6, 1.5));
      s.alpha(s.ease('scale', 0.6), () => caption(s, 'plain: 250,000 times apart.  Adam: η each', s.h * 0.88, '--ink', s.tall ? 3.2 : 3.6));
    });

    // Without the correction, a steady gradient's early steps.
    const plot = s.win('nofix', 'ex');
    s.alpha(plot, () => {
      const F = frame(14 * u, s.h * 0.3, s.w - 8 * u, s.h * 0.76, [0, Math.log10(LOGT)], [0, 7.4]);
      s.line(F.l, F.b, F.r, F.b, s.c('--axis'), 0.35);
      s.line(F.l, F.b, F.l, F.t, s.c('--axis'), 0.35);
      yTicks(s, F, [0, 1, 6.5], (y) => (y ? `${y} η` : '0'));
      xTicks(s, F, [0, 1, 2, 3], (x) => String(10 ** x));
      s.text('step t', F.r, F.b + 7 * u, { size: 3, font: 'mono', align: 'right', color: s.c('--ink-3') });
      s.line(F.l, F.Y(1), F.r, F.Y(1), s.c(ADAM), 0.7);
      s.text('with the fix: η', F.l + 2 * u, F.Y(1) - 3.2 * u, { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c(ADAM), halo: true });
      series(s, F, NOFIX, 'red', { upto: grow(s, 'nofix', 3, 0.8), width: 0.8 });
      s.alpha(after(s, 'nofix', 0.5), () => s.text('no fix: up to 6.5 η', F.X(PEAK[0]) + 3 * u, F.Y(PEAK[1]) - 3.4 * u, { size: 3.3, font: 'mono', weight: 650, align: 'left', color: s.c('red'), halo: true }));
    });
    s.alpha(s.win('paper', 'ex'), () => caption(s, 'RMSProp: no fix.  Adam: the fix', s.h * 0.9, '--ink-2'));
    cite(s, 'Adam · Kingma & Ba, 2014', s.win('paper', 'ex'));

    // One step by hand.
    s.show('ex', s.ease('ex', 0.6));
    s.show('r', after(s, 'ex', 0.5));
    s.show('st', s.ease('move', 0.6));
    s.show('w', after(s, 'move', 0.4));
    s.alpha(after(s, 'move', 0.7), () => caption(s, 'm̂ < 0: downhill is toward bigger w', s.h * 0.9, 'green', s.tall ? 3.3 : 3.6));
  },
};

export const scenes: Record<string, SceneDef> = { divide, zero, step };

import type { Scene, SceneDef } from '../../../lecture/scene';
import { smooth } from '../../../lecture/scene';
import { cells, columns } from '../../draw';
import { axes, clipped, frame, key, series, xTicks, yTicks, type Frame } from '../draw';

/** Eased 0 -> 1 from a fraction `f` of the way through beat `id`, so it tracks the voice at any pace. */
const after = (s: Scene, id: string, f: number, dur = 0.5) => smooth((s.t - s.at(id) - f * (s.end(id) - s.at(id))) / dur);

// The valley L = 0.5 (A w0^2 + w1^2), long along w0.
const A = 0.05;
const START: [number, number] = [-4.5, 1.6];
const STEPS = 16;

function plain(eta: number): [number, number][] {
  let [x, y] = START;
  const out: [number, number][] = [[x, y]];
  for (let i = 0; i < STEPS; i++) {
    x -= eta * A * x;
    y -= eta * y;
    out.push([x, y]);
  }
  return out;
}

function withMomentum(eta: number, mu: number): [number, number][] {
  let [x, y] = START;
  let vx = 0;
  let vy = 0;
  const out: [number, number][] = [[x, y]];
  for (let i = 0; i < STEPS; i++) {
    vx = mu * vx - eta * A * x;
    vy = mu * vy - eta * y;
    x += vx;
    y += vy;
    out.push([x, y]);
  }
  return out;
}

const PLAIN = plain(1.8);
const MOM = withMomentum(1, 0.6);

function contours(s: Scene, F: Frame, a: number): void {
  clipped(s, F, () => {
    for (const c of [0.08, 0.3, 0.7, 1.3, 2.1]) {
      const rx = F.X(Math.sqrt((2 * c) / A)) - F.X(0);
      const ry = F.Y(0) - F.Y(Math.sqrt(2 * c));
      const ctx = s.ctx;
      ctx.beginPath();
      ctx.ellipse(F.X(0), F.Y(0), rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = s.tint('red', 0.18 + 0.25 * a);
      ctx.lineWidth = 0.35 * s.u;
      ctx.stroke();
    }
  });
}

const ravine: SceneDef = {
  draw(s) {
    const F = frame(6 * s.u, s.h * 0.14, s.w - 6 * s.u, s.h - 6 * s.u, [-5.6, 1.6], [-2, 2]);
    contours(s, F, s.ease('valley', 0.8));
    s.circle(F.X(0), F.Y(0), 1 * s.u, { fill: s.c('red') });
    s.alpha(s.ease('valley', 0.6, 1.5), () => {
      s.text('min', F.X(0), F.Y(0) + 4 * s.u, { size: 3.2, font: 'mono', color: s.c('red'), halo: true });
    });
    let kx = s.w / 2 - 26 * s.u;
    s.alpha(s.ease('zig', 0.6), () => (kx = key(s, kx, s.h * 0.06, 'slate', 'plain')));
    s.alpha(s.ease('idea', 0.6), () => key(s, kx, s.h * 0.06, 'orange', 'momentum'));
    const pz = Math.max(0, Math.min(1, (s.since('zig') - 0.5) / 6));
    series(s, F, PLAIN, 'slate', { upto: pz, width: 0.5, dots: 0.7 });
    const pm = Math.max(0, Math.min(1, (s.since('idea') - 0.8) / 6));
    series(s, F, MOM, 'orange', { upto: pm, width: 0.6, dots: 0.7 });
    s.circle(F.X(START[0]), F.Y(START[1]), 1.4 * s.u, { fill: s.c('blue'), stroke: s.c('--card'), lw: 0.4 });
  },
};

const ROWS: [string, string, string, string, string][] = [
  ['start', '', '0', '1', 'mu'],
  ['step 1', '2', '−0.2', '0.8', 'first'],
  ['step 2', '2', '−0.38', '0.42', 'second'],
];

const rule: SceneDef = {
  marks: {
    rule: { tex: String.raw`\symv \leftarrow \symmu\,\symv - \symeta\,\symg, \qquad \symw \leftarrow \symw + \symv`, x: 0.5, y: 0.1, size: 5 },
  },
  draw(s) {
    s.show('rule', s.ease('rule', 0.6));
    s.alpha(s.ease('mu', 0.6), () => s.text('μ = 0.9: 90% of v carries over', s.w / 2, s.h * 0.2, { size: 3.6, font: 'mono', color: s.c('--ink-2') }));
    const xs = columns(s, 4, s.tall ? 22 : 24);
    const hy = s.h * 0.32;
    s.alpha(s.ease('rule', 0.6, 1), () => {
      (['', 'g', 'v', 'w'] as const).forEach((t, j) => s.text(t, xs[j]!, hy, { size: 4, font: 'mono', weight: 650, color: s.c((['--ink-2', 'red', 'orange', 'blue'] as const)[j]) }));
    });
    ROWS.forEach(([name, g, v, w, beat], i) => {
      const y = hy + (i + 1) * 12 * s.u;
      const on = beat === 'mu' ? 0 : s.win(beat, i === 1 ? 'second' : undefined);
      s.alpha(beat === 'mu' ? s.ease('rule', 0.6, 1.5) : s.ease(beat, 0.6, 1.5), () => {
        s.text(name, xs[0]!, y, { size: 3.4, font: 'mono', color: s.c('--ink-3') });
        if (g) cells(s, [xs[1]!], y, [g], 'red', { w: 14, h: 8, size: 3.4 });
        cells(s, [xs[2]!], y, [v], 'orange', { w: 16, h: 8, size: 3.4, on: [on] });
        cells(s, [xs[3]!], y, [w], 'blue', { w: 14, h: 8, size: 3.4, on: [on] });
      });
    });
    s.alpha(s.ease('second', 0.6, 1.5), () => {
      s.text('0.9 × (−0.2) − 0.1 × 2 = −0.38', s.w / 2, s.h * 0.86, { size: 3.6, font: 'mono', color: s.c('orange') });
    });
  },
};

const STEADY: [number, number][] = Array.from({ length: 26 }, (_, t) => [t, -2 * (1 - 0.9 ** t)]);
const FLIP_PLAIN: [number, number][] = [[0, 0]];
const FLIP_MOM: [number, number][] = [[0, 0]];
{
  let v = 0;
  for (let t = 1; t <= 14; t++) {
    const g = t % 2 ? 2 : -2;
    v = 0.9 * v - 0.1 * g;
    FLIP_PLAIN.push([t, -0.1 * g]);
    FLIP_MOM.push([t, v]);
  }
}

const CLIMB = ['−0.2', '−0.38', '−0.54', '−0.69', '…'];

const build: SceneDef = {
  marks: {
    eq: { tex: String.raw`\symv = 0.9\,\symv - 0.2`, x: 0.5, y: 0.1, size: 5 },
    sol: { tex: String.raw`0.1\,\symv = -0.2,\qquad \symv = -2`, x: 0.5, y: 0.21, size: 5 },
    lim: { tex: String.raw`\symv \to \dfrac{-\symeta\,\symg}{1 - \symmu}`, x: 0.5, y: 0.15, size: 5.4 },
  },
  draw(s) {
    const flip = s.ease('flip', 0.8);
    s.alpha(s.ease('steady', 0.6) * (1 - s.ease('settle', 0.5)), () => {
      const xs = columns(s, 5, s.tall ? 19 : 20);
      CLIMB.forEach((t, i) => s.alpha(after(s, 'steady', 0.38 + 0.11 * i), () => cells(s, [xs[i]!], s.h * 0.14, [t], 'orange', { w: 15, h: 8, size: 3.4 })));
    });
    s.show('eq', s.win('settle', 'limit'));
    s.show('sol', after(s, 'solve', 0.3) * (1 - s.ease('limit', 0.5)));
    s.show('lim', s.ease('limit', 0.6) * (1 - flip));
    s.alpha(1 - flip, () => {
      const F = frame(14 * s.u, s.h * 0.32, s.w - 6 * s.u, s.h - 9 * s.u, [0, 25], [-2.3, 0.3]);
      axes(s, F, 'step', '', { x: '--ink-3', y: 'orange' });
      s.line(F.l, F.Y(0), F.r, F.Y(0), s.c('--axis'), 0.3);
      yTicks(s, F, [0, -1, -2], (y) => String(y).replace('-', '−'));
      xTicks(s, F, [5, 10, 15, 20]);
      s.text('v', F.l + 2 * s.u, F.t + 2 * s.u, { size: 3.6, font: 'mono', weight: 650, align: 'left', color: s.c('orange') });
      s.line(F.l, F.Y(-0.2), F.r, F.Y(-0.2), s.tint('slate', 0.8), 0.3, [1.2, 1]);
      s.text('plain step −ηg = −0.2', F.r, F.Y(-0.2) - 3 * s.u, { size: 3, font: 'mono', align: 'right', color: s.c('slate'), halo: true });
      const up = Math.max(0, Math.min(1, (s.since('steady') - 0.3) / 5));
      series(s, F, STEADY, 'orange', { upto: up, dots: 0.6 });
      s.alpha(after(s, 'solve', 0.6), () => {
        s.line(F.l, F.Y(-2), F.r, F.Y(-2), s.tint('orange', 0.8), 0.3, [1.2, 1]);
        s.text('−2: ten plain steps', F.r, F.Y(-2) + 3.6 * s.u, { size: 3, font: 'mono', align: 'right', color: s.c('orange'), halo: true });
      });
    });
    s.alpha(flip, () => {
      const F = frame(14 * s.u, s.h * 0.16, s.w - 6 * s.u, s.h - 9 * s.u, [0, 14], [-0.3, 0.3]);
      axes(s, F, 'step', '', { x: '--ink-3', y: 'orange' });
      s.line(F.l, F.Y(0), F.r, F.Y(0), s.c('--axis'), 0.3);
      yTicks(s, F, [0.2, 0, -0.2], (y) => String(y).replace('-', '−'));
      let kx = s.w / 2 - 28 * s.u;
      kx = key(s, kx, s.h * 0.07, 'slate', 'plain step');
      key(s, kx, s.h * 0.07, 'orange', 'momentum v');
      const up = Math.max(0, Math.min(1, (s.since('flip') - 0.6) / 5));
      series(s, F, FLIP_PLAIN, 'slate', { upto: up, width: 0.45, dash: [1.2, 0.8], dots: 0.6 });
      series(s, F, FLIP_MOM, 'orange', { upto: up, dots: 0.6 });
    });
  },
};

export const scenes: Record<string, SceneDef> = { ravine, rule, build };

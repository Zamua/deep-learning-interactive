import type { Scene, SceneDef } from '../../../lecture/scene';
import { smooth } from '../../../lecture/scene';
import { cells, columns, rowLabel } from '../../draw';
import { axes, ball, curve, frame, hop, type Frame } from '../draw';

const f = (w: number) => 0.5 * (w - 1) ** 2 + 0.5;
const tangent = (w0: number) => (w: number) => f(w0) + (w0 - 1) * (w - w0);
const f1 = (v: number) => v.toFixed(1);

/** f over one number, filling the stage below `top` (a fraction of its height). */
function plot(s: Scene, top: number): Frame {
  return frame(10 * s.u, s.h * top, s.w - 8 * s.u, s.h - 10 * s.u, [-2.2, 4.2], [0, 6]);
}

/** A labelled arrow along the floor of the plot, from w0 to w1. */
function stepArrow(s: Scene, F: Frame, w0: number, w1: number, label: string, a: number): void {
  s.alpha(a, () => {
    const y = F.b - 4 * s.u;
    s.arrow(F.X(w0), y, F.X(w0) + (F.X(w1) - F.X(w0)) * a, y, s.c('slate'), 0.55, 2.4);
    s.text(label, (F.X(w0) + F.X(w1)) / 2, y - 4 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c('slate'), halo: true });
  });
}

const uphill: SceneDef = {
  draw(s) {
    const F = plot(s, 0.1);
    axes(s, F, 'w', 'f', { x: 'blue', y: 'purple' });
    curve(s, F, f, -2.2, 4.2, 'purple', { upto: s.ease('curve', 1.2) });
    const go = s.ease('against', 1.2, 0.8);
    const w = 3 - 0.8 * go;
    s.alpha(s.ease('curve', 0.6, 0.6), () => {
      s.text(`w = ${f1(w)}`, F.X(w), F.b + 4 * s.u, { size: 3.4, font: 'mono', color: s.c('blue') });
    });
    s.alpha(s.win('slope', 'against'), () => {
      curve(s, F, tangent(3), 2.1, 3.9, '--ink-3', { width: 0.4, dash: [1.4, 1] });
      s.text('g = +2', F.X(3.3), F.Y(1.5), { size: 3.8, font: 'mono', weight: 650, color: s.c('red'), halo: true });
    });
    stepArrow(s, F, 3, 2.2, '−ηg', s.ease('against', 0.8) * (1 - s.ease('left', 0.6)));
    s.alpha(s.ease('curve', 0.6, 0.6), () => ball(s, F.X(w), F.Y(f(w)), 'blue'));
    s.alpha(s.ease('left', 0.6), () => {
      const v = -1 + 0.8 * s.ease('left', 1.2, 1.4);
      curve(s, F, tangent(-1), -1.9, -0.1, '--ink-3', { width: 0.4, dash: [1.4, 1] });
      s.text('g = −2', F.X(-1.35), F.Y(1.5), { size: 3.8, font: 'mono', weight: 650, color: s.c('red'), halo: true });
      stepArrow(s, F, -1, -0.2, '−ηg', s.ease('left', 0.8, 0.6));
      ball(s, F.X(v), F.Y(f(v)), 'blue');
    });
  },
};

// The descent the `steep` beat animates: eta = 0.5 on g = w - 1 halves the distance to the bottom.
const PTS: [number, number][] = [0, 1, 2, 3, 4].map((k) => {
  const w = 1 + 2 * 0.5 ** k;
  return [w, f(w)];
});

/** One worked step on the curve: w0 slides to w1 late in beat `id`, with its arithmetic above the valley. */
function worked(s: Scene, F: Frame, id: string, w0: number, w1: number, lines: string[], a: number): void {
  s.alpha(a, () => {
    const go = smooth((s.prog(id) - 0.55) / 0.3);
    stepArrow(s, F, w0, w1, '−ηg', s.ease(id, 0.8, 0.6));
    const w = w0 + (w1 - w0) * go;
    ball(s, F.X(w), F.Y(f(w)), 'blue');
    const o = { size: 3.6, font: 'mono', weight: 600, halo: true } as const;
    lines.forEach((t, i) => s.alpha(s.ease(id, 0.5, 0.4 + 0.9 * i), () => s.text(t, F.X(1), F.Y(5.5 - 0.75 * i), { ...o, color: s.c(i === 2 ? 'blue' : '--ink-2') })));
  });
}

const rule: SceneDef = {
  marks: {
    rule: { tex: String.raw`\symw \leftarrow \symw - \symeta\,\symg`, x: 0.5, y: 0.1, size: 6 },
  },
  draw(s) {
    s.show('rule', s.ease('rule', 0.6));
    s.alpha(s.ease('eta', 0.6), () => s.text('η: the step size, small and positive', s.w / 2, s.h * 0.2, { size: 3.4, color: s.c('--ink-3') }));
    const vec = s.ease('vector', 0.6);
    s.alpha(1 - vec, () => {
      const F = plot(s, 0.28);
      axes(s, F, 'w', 'f', { x: 'blue', y: 'purple' });
      curve(s, F, f, -2.2, 4.2, 'purple');
      const a1 = 1 - s.ease('neg', 0.4);
      const a2 = s.win('neg', 'steep', 0.4);
      worked(s, F, 'num', 3, 2, ['w = 3, g = 2, η = 0.5', 'ηg = 0.5 × 2 = 1', 'w ← 3 − 1 = 2'], a1);
      worked(s, F, 'neg', -1, 0, ['w = −1, g = −2, η = 0.5', 'ηg = 0.5 × (−2) = −1', 'w ← −1 − (−1) = 0'], a2);
      s.alpha(s.ease('steep', 0.4), () => {
        const h = hop(PTS, s.since('steep') - 0.6, 1.1);
        for (let k = 0; k < h.done; k++) s.arrow(F.X(PTS[k]![0]), F.Y(PTS[k]![1]), F.X(PTS[k + 1]![0]), F.Y(PTS[k + 1]![1]), s.tint('slate', 0.8), 0.45, 2);
        for (let k = 0; k <= h.done; k++) s.circle(F.X(PTS[k]![0]), F.Y(PTS[k]![1]), 0.9 * s.u, { fill: s.tint('blue', 0.5) });
        ball(s, F.X(h.x), F.Y(h.y), 'blue');
      });
    });
    s.alpha(vec, () => {
      const xs = columns(s, 2, 26);
      const lx = xs[0]! - 17 * s.u;
      const rows: [string, string[], 'blue' | 'red' | 'slate', number, number][] = [
        ['w', ['1.0', '-0.5'], 'blue', s.h * 0.32, 1],
        ['g', ['2.0', '-1.0'], 'red', s.h * 0.48, 1],
        ['ηg', ['0.2', '-0.1'], 'slate', s.h * 0.64, s.ease('vnum', 0.6, 1.5)],
        ['w − ηg', ['0.8', '-0.4'], 'blue', s.h * 0.8, s.ease('vnum', 0.6, 5)],
      ];
      rows.forEach(([name, vals, k, y, a], i) => {
        s.alpha(a, () => {
          rowLabel(s, name, lx, y, k, 3.8);
          cells(s, xs, y, vals.map((v) => v.replace('-', '−')), k, { on: i === 3 ? [1, 1] : [0, 0] });
        });
      });
      s.alpha(s.ease('vnum', 0.6, 0.6), () => s.text('η = 0.1', xs[1]! + 11 * s.u, s.h * 0.64, { size: 3.4, font: 'mono', align: 'left', color: s.c('slate') }));
    });
  },
};

const drop: SceneDef = {
  marks: {
    f: { tex: String.raw`\Delta\symf \approx \symg\,\Delta\symw = -\symeta\,\symg^2`, x: 0.5, y: 0.1, size: 5.4 },
    g: { tex: String.raw`\symg = [2,\ -1], \quad \symeta = 0.1`, x: 0.5, y: 0.34, size: 4.6 },
    sq: { tex: String.raw`2^2 + (-1)^2 = 4 + 1 = 5`, x: 0.5, y: 0.5, size: 4.6 },
    v: { tex: String.raw`\Delta\symf \approx -0.1 \times 5 = -0.5`, x: 0.5, y: 0.66, size: 4.6 },
  },
  draw(s) {
    const vec = s.ease('sum', 0.6);
    s.alpha(1 - vec, () => {
      const F = frame(10 * s.u, s.h * 0.22, s.w - 8 * s.u, s.h - 10 * s.u, [2.3, 3.3], [1.5, 3.2]);
      axes(s, F, 'w', 'f', { x: 'blue', y: 'purple' });
      curve(s, F, f, 2.3, 3.3, 'purple');
      curve(s, F, tangent(3), 2.3, 3.3, '--ink-3', { width: 0.4, dash: [1.4, 1] });
      const mv = s.ease('tangent', 0.8, 1.2);
      s.alpha(mv, () => {
        s.line(F.X(3), F.Y(2.5), F.X(3 - 0.2 * mv), F.Y(2.5), s.c('slate'), 0.6);
        s.text('Δw = −0.2', F.X(2.9), F.Y(2.5) - 4 * s.u, { size: 3.4, font: 'mono', weight: 600, color: s.c('slate'), halo: true });
      });
      const dl = s.ease('tangent', 0.8, 2.6);
      s.alpha(dl, () => {
        s.line(F.X(2.8), F.Y(2.5), F.X(2.8), F.Y(2.5 - 0.4 * dl), s.c('purple'), 0.6);
        s.text('Δf ≈ −0.4', F.X(2.8) - 2 * s.u, F.Y(2.3), { size: 3.4, font: 'mono', weight: 600, align: 'right', color: s.c('purple'), halo: true });
      });
      s.alpha(s.ease('formula', 0.6, 2.5), () => {
        s.circle(F.X(2.8), F.Y(f(2.8)), 1.3 * s.u, { fill: s.tint('blue', 0.5) });
        s.text('true: −0.38', F.X(2.8) + 2 * s.u, F.Y(f(2.8)) + 4 * s.u, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-2'), halo: true });
      });
      ball(s, F.X(3), F.Y(2.5), 'blue');
      s.alpha(s.ease('always', 0.6, 1), () => {
        s.text('η g² ≥ 0: f goes down', s.w - 8 * s.u, F.b - 5 * s.u, { size: 3.4, align: 'right', color: s.c('green'), halo: true });
      });
    });
    s.show('f', s.ease('formula', 0.6));
    s.show('g', vec);
    s.show('sq', s.ease('sum', 0.6, 2.5));
    s.show('v', s.ease('sum', 0.6, 5));
  },
};

export const scenes: Record<string, SceneDef> = { uphill, rule, drop };

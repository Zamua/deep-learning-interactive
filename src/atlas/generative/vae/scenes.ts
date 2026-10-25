import type { Scene, SceneDef } from '../../../lecture/scene';
import { lerp } from '../../../lecture/scene';
import { cells, columns, rowLabel } from '../../draw';
import { caption, Frame, fmt, rich } from '../draw';

const MU = [1, -0.5];
const SIG = [0.5, 0.2];
const EPS = [0.4, -1];
const Z = MU.map((m, i) => m + SIG[i]! * EPS[i]!);
const DIM_INK = ['orange', 'teal'] as const;

const bell = (mu: number, sig: number, peak = 1) => (x: number) => peak * Math.exp(-((x - mu) ** 2) / (2 * sig * sig));

/** A number line for codes, from -2.6 to 2.6, its axis at `y` (fraction of the stage height). */
function line(s: Scene, top: number, y: number): Frame {
  const u = s.u;
  const half = Math.min(s.w / 2 - 8 * u, 62 * u);
  const F = new Frame(s, s.w / 2 - half, s.h * top, s.w / 2 + half, s.h * y, [-2.6, 2.6], [0, 1]);
  s.line(F.l, F.b, F.r, F.b, s.c('--axis'), 0.35);
  for (const t of [-2, -1, 0, 1, 2]) {
    s.line(F.X(t), F.b, F.X(t), F.b + 1.2 * u, s.c('--axis'), 0.3);
    s.text(fmt(t), F.X(t), F.b + 4 * u, { size: 3, font: 'mono', color: s.c('--ink-3') });
  }
  return F;
}

const spread: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 2, 18);
    const lx = xs[0]! - 13 * u;
    const two = s.ease('two', 0.6);
    s.alpha(two, () => {
      rowLabel(s, 'μ', lx, s.h * 0.12, 'blue', 4);
      cells(s, xs, s.h * 0.12, MU.map((v) => fmt(v, 1)), 'blue', { w: 14, h: 8 });
      rowLabel(s, 'σ', lx, s.h * 0.24, 'gold', 4);
      cells(s, xs, s.h * 0.24, SIG.map((v) => fmt(v, 1)), 'gold', { w: 14, h: 8 });
      xs.forEach((x, i) => s.text(`dim ${i}`, x, s.h * 0.04 + 1.5 * u, { size: 3, font: 'mono', color: s.c(DIM_INK[i]!) }));
      s.text('4 outputs', xs[1]! + 13 * u, s.h * 0.18, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-3') });
    });
    const F = line(s, 0.36, 0.8);
    s.alpha(1 - s.ease('two', 0.6), () => {
      F.dot(1, 0, 'green', 1.8);
      s.text('one input → one code', F.X(1), F.b - 6 * u, { size: 3.4, font: 'mono', weight: 600, color: s.c('green'), halo: true });
    });
    const b = s.ease('bell', 1);
    s.alpha(b, () => {
      MU.forEach((m, i) => {
        F.fn(bell(m, SIG[i]! * lerp(2.5, 1, b), lerp(0.4, 1, b)), DIM_INK[i]!, { fill: 0.15, width: 0.6 });
        s.text(`μ ${fmt(m)}, σ ${SIG[i]}`, F.X(m), F.Y(1) - 3.5 * u, { size: 3.2, font: 'mono', weight: 650, color: s.c(DIM_INK[i]!), halo: true });
      });
    });
  },
};

/** Fresh codes for dimension 0, drawn once. */
const DRAWS = [0.4, -1.2, 0.9, -0.3, 1.6, 0.1, -0.8, 1.1];

const sample: SceneDef = {
  draw(s) {
    const u = s.u;
    const xs = columns(s, 2, 18);
    const lx = xs[0]! - 13 * u;
    const rows: [string, number[], 'blue' | 'gold' | 'slate' | 'green', number, string][] = [
      ['μ', MU, 'blue', 0.08, ''],
      ['σ', SIG, 'gold', 0.18, ''],
      ['ε', EPS, 'slate', 0.28, 'eps'],
      ['z', Z, 'green', 0.4, 'z'],
    ];
    rows.forEach(([name, vals, k, f, beat]) => {
      s.alpha(beat ? s.ease(beat, 0.6) : 1, () => {
        rowLabel(s, name, lx, s.h * f, k, 4);
        cells(s, xs, s.h * f, vals.map((v) => fmt(v, 1)), k, { w: 14, h: 7.5, on: beat === 'z' ? [s.ease('z', 0.6, 2), s.ease('z', 0.6, 5)] : undefined });
      });
    });
    s.alpha(s.ease('eps', 0.6, 0.8), () => s.text('randn', xs[1]! + 10 * u, s.h * 0.28, { size: 3.2, font: 'mono', align: 'left', color: s.c('--ink-3') }));
    s.alpha(s.ease('z', 0.6, 0.6), () => rich(s, [['z = ', 'green'], ['μ', 'blue'], [' + ', '--ink-2'], ['σ', 'gold'], [' · ', '--ink-2'], ['ε', 'slate']], xs[1]! + 10 * u, s.h * 0.4, { size: 3.4, weight: 650, align: 'left' }));
    const F = line(s, 0.52, 0.84);
    F.fn(bell(MU[0]!, SIG[0]!), 'orange', { fill: 0.12 });
    s.text('dim 0', F.X(-2.2), F.Y(0.8), { size: 3, font: 'mono', color: s.c('orange') });
    s.alpha(s.ease('z', 0.6, 2), () => F.dot(Z[0]!, 0, 'green', 1.6));
    const w = s.ease('why', 0.4);
    DRAWS.forEach((e, k) => {
      s.alpha(s.ease('why', 0.3, 0.8 + k * 0.35), () => F.dot(MU[0]! + SIG[0]! * e, 0.08 + 0.1 * (k % 3), 'green', 1.1));
    });
    s.alpha(w * (1 - s.ease('grad', 0.6)), () => caption(s, 'fresh codes near μ: all must decode to this input', s.h * 0.94, 'green', 3.2));
    s.alpha(s.ease('grad', 0.6), () => rich(s, [['∂z/∂μ = 1', 'blue'], ['     ', '--ink-2'], ['∂z/∂σ = ε', 'gold']], s.w / 2, s.h * 0.94, { size: 3.6, weight: 650, halo: true }));
  },
};

/** Three inputs' code bells: drifting apart and narrowing, then pulled toward the standard normal. */
const START: [number, number][] = [[-1.7, 0.12], [0.3, 0.08], [1.9, 0.1]];
const SPREAD: [number, number][] = [[-0.7, 0.75], [0.1, 0.85], [0.8, 0.8]];

const prior: SceneDef = {
  marks: {
    kl: { tex: String.raw`\tfrac{1}{2}\left(\sym{mu}{\mu}^{2} + \sym{sigma}{\sigma}^{2} - 1 - \ln \sym{sigma}{\sigma}^{2}\right)`, x: 0.5, y: 0.1, size: 4.8 },
  },
  draw(s) {
    const u = s.u;
    s.show('kl', s.ease('term', 0.6));
    const F = line(s, 0.3, 0.74);
    const pull = s.ease('zero', 2, 0.5);
    const inks = ['orange', 'teal', 'purple'] as const;
    START.forEach(([m0, s0], i) => {
      const [m1, s1] = SPREAD[i]!;
      const m = lerp(m0, m1, pull);
      const sg = lerp(s0, s1, pull);
      F.fn(bell(m, sg, lerp(0.95, 0.6, pull)), inks[i]!, { fill: 0.1, width: 0.5 });
    });
    s.alpha(s.win('drift', 'term'), () => caption(s, 'narrow, far apart: gaps between them', s.h * 0.88, 'red', 3.4));
    s.alpha(s.ease('zero', 0.6), () => F.fn(bell(0, 1, 0.62), '--ink-2', { dash: [1.2, 1], width: 0.4 }));
    s.alpha(s.win('zero', 'generate'), () => s.text('standard normal: μ = 0, σ = 1', F.X(0), F.Y(0.62) - 4 * u, { size: 3.2, font: 'mono', weight: 600, color: s.c('--ink-2'), halo: true }));
    s.alpha(s.win('zero', 'generate'), () => caption(s, 'the term is 0 only at μ = 0, σ = 1', s.h * 0.88, 'blue', 3.4));
    const g = s.ease('generate', 0.6);
    s.alpha(g, () => {
      F.dot(-0.35, 0, 'green', 1.8);
      s.arrow(F.X(-0.35), F.b - 2.5 * u, F.X(-0.35) + 14 * u, F.Y(0.95) + 2 * u, s.c('green'), 0.4, 2);
      s.text('decode → new image', F.X(-0.35) + 15 * u, F.Y(0.95), { size: 3.2, font: 'mono', weight: 650, align: 'left', color: s.c('green'), halo: true });
      caption(s, 'any code from randn decodes to something sensible', s.h * 0.88, 'green', 3.2);
    });
  },
};

export const scenes: Record<string, SceneDef> = { spread, sample, prior };

import type { Color } from '../../../core/symbols';
import { type Scene, type SceneDef, lerp } from '../../../lecture/scene';
import { after, cells, cite, columns } from '../../draw';
import { rich } from '../../linear-algebra/draw';
import { caption } from '../../networks/draw';
import { frame, type Frame } from '../../optimization/draw';
import { num } from '../draw';

// The toy: a stream of d = 2 numbers, x = [3, 1] = 2·v₁ + 1·v₄, from a dictionary of m = 8 directions.
const X: Color = 'orange';
const FT: Color = 'purple';
const V1: Color = 'gold';
const V4: Color = 'teal';
const XHAT: Color = 'green';
const CODE = [0, 2, 0, 0, 1, 0, 0, 0];

/** The stream's plane: its two numbers as axes, near the top of the stage. */
function plane(s: Scene): Frame {
  const side = Math.min(s.h * 0.6, s.w * 0.6);
  const l = s.w / 2 - side / 2;
  const t = s.h * 0.09;
  const F = frame(l, t, l + side, t + side, [-0.6, 3.6], [-1.6, 2.6]);
  s.line(F.X(-0.6), F.Y(0), F.X(3.6), F.Y(0), s.c('--axis'), 0.3);
  s.line(F.X(0), F.Y(-1.6), F.X(0), F.Y(2.6), s.c('--axis'), 0.3);
  const ax = { size: 2.8, font: 'mono', color: s.c('--ink-3') } as const;
  s.text('x[0]', F.X(3.6), F.Y(0) + 3.5 * s.u, { ...ax, align: 'right' });
  s.text('x[1]', F.X(0) - 1.5 * s.u, F.Y(2.5), { ...ax, align: 'right' });
  return F;
}

function vec(s: Scene, F: Frame, x0: number, y0: number, x1: number, y1: number, k: Color, w = 0.55, dash?: number[]) {
  if (dash) s.line(F.X(x0), F.Y(y0), F.X(x1), F.Y(y1), s.c(k), w, dash);
  else s.arrow(F.X(x0), F.Y(y0), F.X(x1), F.Y(y1), s.c(k), w, 2.4);
}

const label = (s: Scene, t: string, x: number, y: number, k: Color, align: CanvasTextAlign = 'center', size = 3.1) =>
  s.text(t, x, y, { size, font: 'mono', weight: 650, align, color: s.c(k), halo: true });

// ---- 1. Features in a tangle ---------------------------------------------------------

const tangle: SceneDef = {
  draw(s) {
    const dim = 1 - 0.5 * s.win('neuron', 'goal');
    s.alpha(dim, () => {
      const F = plane(s);
      // The stream's own numbers: 3 along one axis, 1 along the other.
      s.alpha(s.win('puzzle', 'tangle') * 0.8, () => {
        s.line(F.X(3), F.Y(1), F.X(3), F.Y(0), s.c('--ink-3'), 0.25, [0.8, 0.8]);
        s.line(F.X(3), F.Y(1), F.X(0), F.Y(1), s.c('--ink-3'), 0.25, [0.8, 0.8]);
        label(s, '3', F.X(3), F.Y(0) + 3.5 * s.u, X);
        label(s, '1', F.X(0) - 2 * s.u, F.Y(1), X, 'right');
      });
      // What it holds: 2 of feature 1, then 1 of feature 4.
      const tg = s.ease('tangle', 0.8);
      const unknown = s.ease('goal', 0.8);
      s.alpha(tg * (1 - 0.6 * unknown), () => {
        vec(s, F, 0, 0, 2, 2, V1, 0.5);
        vec(s, F, 2, 2, 3, 1, V4, 0.5);
      });
      s.alpha(tg * (1 - unknown), () => {
        label(s, '2 × feature 1', F.X(1) - 1.5 * s.u, F.Y(1) - 1.5 * s.u, V1, 'right');
        label(s, '1 × feature 4', F.X(2.5) + 2 * s.u, F.Y(1.5) - 1.5 * s.u, V4, 'left');
      });
      s.alpha(unknown, () => {
        label(s, '?', F.X(1) - 2 * s.u, F.Y(1) - 2 * s.u, V1, 'right', 4);
        label(s, '?', F.X(2.5) + 2 * s.u, F.Y(1.5) - 2 * s.u, V4, 'left', 4);
      });
      vec(s, F, 0, 0, 3, 1, X, 0.7);
      label(s, 'x = [3, 1]', F.X(3) + 2.5 * s.u, F.Y(1) + 1 * s.u, X, 'left', 3.3);
    });
    const y = s.h * 0.8;
    s.alpha(s.win('puzzle', 'tangle'), () => caption(s, 'a toy stream: d = 2 numbers', y, X, 3.4));
    s.alpha(s.win('tangle', 'neuron'), () => caption(s, 'neither 3 nor 1 is a feature', y, '--ink-2', 3.4));
    // A real neuron that mixes unrelated things.
    s.alpha(s.win('neuron', 'goal'), () => {
      const o = { size: s.tall ? 3.2 : 3.5, font: 'mono', weight: 600, color: s.c(FT) } as const;
      s.text('one neuron fires for:', s.w / 2, s.h * 0.73, { ...o, color: s.c('--ink-2'), weight: 500 });
      s.text('academic citations · English dialogue', s.w / 2, s.h * 0.79, o);
      s.text('HTTP requests · Korean text', s.w / 2, s.h * 0.85, o);
      s.alpha(s.ease('poly', 0.6), () => s.text('polysemantic: many meanings', s.w / 2, s.h * 0.92, { size: 3.6, weight: 650, color: s.c('red'), halo: true }));
    });
    cite(s, 'Bricken et al., Anthropic, 2023', s.win('neuron', 'goal'));
    s.alpha(s.ease('goal', 0.6, 1), () => caption(s, 'learn the directions from activations', y, FT, s.tall ? 3.2 : 3.4));
  },
};

// ---- 2. Wider, not narrower ----------------------------------------------------------

/** A bar standing for a vector, `w` stage units wide, centered on (x, y). */
function slab(s: Scene, x: number, y: number, w: number, text: string, k: Color, on = 0): void {
  s.rrect(x - (w / 2) * s.u, y - 4 * s.u, w * s.u, 8 * s.u, 1.2, { fill: s.tint(k, 0.14 + 0.2 * on), stroke: s.tint(k, 0.6 + 0.4 * on), lw: 0.35 });
  if (text) s.text(text, x, y + 0.2 * s.u, { size: 3.2, font: 'mono', weight: 600, color: s.c(k) });
}

const wide: SceneDef = {
  draw(s) {
    const cx = s.w / 2;
    const D = 24;
    const flip = s.ease('flip', 1.2);
    const mid = lerp(10, s.tall ? 92 : 104, flip);
    const ys = [s.h * 0.12, s.h * 0.38, s.h * 0.64];
    slab(s, cx, ys[0]!, D, 'x: d', X);
    const join = (y0: number, w0: number, y1: number, w1: number) => {
      s.line(cx - (w0 / 2) * s.u, y0 + 4 * s.u, cx - (w1 / 2) * s.u, y1 - 4 * s.u, s.c('--ink-3'), 0.3);
      s.line(cx + (w0 / 2) * s.u, y0 + 4 * s.u, cx + (w1 / 2) * s.u, y1 - 4 * s.u, s.c('--ink-3'), 0.3);
    };
    join(ys[0]!, D, ys[1]!, mid);
    join(ys[1]!, mid, ys[2]!, D);
    s.text('encoder', cx + ((D + mid) / 4 + 3) * s.u, (ys[0]! + ys[1]!) / 2, { size: 2.8, font: 'mono', align: 'left', color: s.c('--ink-3') });
    s.text('decoder', cx + ((D + mid) / 4 + 3) * s.u, (ys[1]! + ys[2]!) / 2, { size: 2.8, font: 'mono', align: 'left', color: s.c('--ink-3') });
    // The middle: one slab, then one cell per feature once the units are named.
    const unit = s.ease('unit', 0.6);
    s.alpha(1 - unit, () => slab(s, cx, ys[1]!, mid, flip > 0.5 ? 'm features' : '', FT, flip));
    const n = 8;
    const xs = columns(s, n, mid / n);
    s.alpha(unit, () => {
      cells(s, xs, ys[1]!, CODE.map((v) => num(v)), FT, { w: mid / n - 0.8, h: 8, size: 3, on: CODE.map((v) => (v > 0 ? 1 : 0)) });
      s.text('ReLU: 0, or on', cx, ys[1]! - 7 * s.u, { size: 2.9, font: 'mono', color: s.c(FT) });
    });
    // Each feature's row of the decoder: the lit features' directions add up to the rebuild.
    const dir = s.ease('dir', 0.8);
    s.alpha(dir, () => {
      ([[1, V1, 'v₁'], [4, V4, 'v₄']] as const).forEach(([j, k, t], q) => {
        const x0 = xs[j]!;
        const x1 = cx + (q === 0 ? -5 : 5) * s.u;
        s.arrow(x0, ys[1]! + 4.5 * s.u, x1, ys[2]! - 4.5 * s.u, s.c(k), 0.5, 2);
        label(s, t, lerp(x0, x1, 0.45) + (q === 0 ? -2.5 : 2.5) * s.u, lerp(ys[1]!, ys[2]!, 0.5), k, q === 0 ? 'right' : 'left', 3.2);
      });
    });
    slab(s, cx, ys[2]!, D, 'x̂: d', XHAT);
    const y1 = s.h * 0.8;
    const y2 = s.h * 0.89;
    const big = s.tall ? 3.2 : 3.5;
    s.alpha(s.win('recall', 'flip'), () => caption(s, 'autoencoder: a narrow middle', y1, '--ink-2', big));
    s.alpha(s.win('flip', 'unit'), () => caption(s, 'sparse autoencoder: a wide middle', y1, FT, big));
    s.alpha(s.win('flip', 'toy'), () => caption(s, 'expansion factor = m / d', y2, FT, big));
    s.alpha(s.win('toy', 'size'), () => caption(s, 'toy: d = 2, m = 8, factor 4', y2, FT, big));
    s.alpha(s.win('size', 'unit'), () => caption(s, '512 neurons × 8 = 4,096 features', y2, FT, big));
    cite(s, 'Bricken et al., Anthropic, 2023', s.win('size', 'unit'));
    s.alpha(s.win('dir', 'name'), () => {
      caption(s, 'one direction per feature: a row of d', y1, V1, big);
      caption(s, 'decoder: m × d numbers', y2, '--ink-2', big);
    });
    s.alpha(s.win('name', 'copy'), () => caption(s, 'the dictionary: many entries, few used at once', y1, FT, s.tall ? 3 : 3.4));
    s.alpha(s.ease('copy', 0.6), () => {
      caption(s, 'wide enough to just copy x through', y1, 'red', big);
      s.alpha(after(s, 'copy', 0.5), () => caption(s, 'unless most features stay off', y2, FT, big));
    });
  },
};

// ---- 3. Pay for every feature --------------------------------------------------------

const LOOSE = [0.2, 1.8, 0.1, 0.3, 0.9, 0.2, 0.1, 0.1];
const SPARSER = [0, 1.6, 0, 0, 0, 0, 0, 0];

const loss: SceneDef = {
  marks: {
    l: { tex: String.raw`\symL = \lVert \symx - \hat{\symx} \rVert^2 + \symlam \textstyle\sum_j \sym{f}{f}_j`, x: 0.5, y: 0.09, size: 5 },
  },
  draw(s) {
    s.show('l', s.ease('err', 0.6));
    const big = s.tall ? 3.3 : 3.6;
    // L1 against L2: absolute values, not squares; the ReLU makes it a plain sum.
    s.alpha(s.win('l1', 'code'), () => {
      rich(s, [['L2: ', 'blue'], ['Σ f²   ', '--ink-2'], ['L1: ', 'red'], ['Σ |f|', '--ink-2']], s.w / 2, s.h * 0.22, { size: big });
      s.alpha(s.ease('sum', 0.6), () => s.text('f ≥ 0, so Σ |f| = Σ f', s.w / 2, s.h * 0.3, { size: big, font: 'mono', color: s.c(FT) }));
    });
    // The two penalties against one feature's value: squares, and absolute values.
    s.alpha(s.win('l1', 'code'), () => {
      const side = s.tall ? 64 : 70;
      const P = frame(s.w / 2 - (side / 2) * s.u, s.h * 0.42, s.w / 2 + (side / 2) * s.u, s.h * 0.84, [-2, 2], [0, 2.2]);
      s.alpha(s.ease('sum', 0.6), () => {
        s.rrect(P.X(-2), P.t, P.X(0) - P.X(-2), P.b - P.t, 0, { fill: s.tint('slate', 0.12) });
        s.text('ReLU: f ≥ 0', P.X(-1.1), P.b + 3.5 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-2') });
      });
      s.line(P.l, P.b, P.r, P.b, s.c('--axis'), 0.3);
      s.line(P.X(0), P.b, P.X(0), P.t, s.c('--axis'), 0.3);
      s.text('f', P.r, P.b + 3.5 * s.u, { size: 2.8, font: 'mono', align: 'right', color: s.c(FT) });
      s.text('0', P.X(0), P.b + 3.5 * s.u, { size: 2.8, font: 'mono', color: s.c('--ink-3') });
      const lim = Math.sqrt(2.2);
      for (let k = 0; k < 40; k++) {
        const a = -lim + (2 * lim * k) / 40;
        const b = -lim + (2 * lim * (k + 1)) / 40;
        s.line(P.X(a), P.Y(a * a), P.X(b), P.Y(b * b), s.c('blue'), 0.55);
      }
      s.line(P.X(-2), P.Y(2), P.X(0), P.Y(0), s.c('red'), 0.55);
      s.line(P.X(0), P.Y(0), P.X(2), P.Y(2), s.c('red'), 0.55);
      label(s, 'L2: f²', P.X(lim) - 2 * s.u, P.Y(2.15), 'blue', 'right');
      label(s, 'L1: |f|', P.X(2), P.Y(0.9), 'red', 'right');
    });
    // The code: worked at first, then loose under L2, pushed to exactly 0 under L1, then swept by λ.
    const p = s.prog('balance');
    const bal = s.ease('balance', 0.6);
    const up = Math.min(1, p * 2.2);
    const down = Math.max(0, (p - 0.55) * 2.2);
    const vals = CODE.map((v, i) => {
      const fadeV = lerp(v, LOOSE[i]!, s.ease('fade', 0.8) * (1 - s.ease('push', 1.4, 0.8)));
      const swept = lerp(lerp(v, SPARSER[i]!, up), LOOSE[i]!, Math.min(1, down));
      return lerp(fadeV, swept, bal);
    });
    const xs = columns(s, 8, s.tall ? 11.5 : 12.5);
    const yc = s.h * 0.42;
    s.alpha(s.ease('code', 0.6), () => {
      s.text('the code f', s.w / 2, yc - 7.5 * s.u, { size: 3, color: s.c('--ink-3') });
      cells(s, xs, yc, vals.map((v) => num(Math.round(v * 10) / 10)), FT, { w: s.tall ? 10.5 : 11.5, h: 8, size: 3, on: vals.map((v) => (v > 0.05 ? 1 : 0)) });
    });
    s.alpha(s.win('code', 'fade'), () => {
      rich(s, [['Σ f = 2 + 1 = 3', FT]], s.w / 2, s.h * 0.55, { size: big });
      s.alpha(s.ease('pay', 0.6), () => rich(s, [['λ Σ f = 0.1 × 3 = ', '--ink-2'], ['0.3', 'red']], s.w / 2, s.h * 0.63, { size: big }));
    });
    // How hard each penalty pulls a feature toward 0, against the feature's size.
    s.alpha(s.win('fade', 'balance'), () => {
      const side = s.tall ? 64 : 70;
      const P = frame(s.w / 2 - (side / 2) * s.u, s.h * 0.55, s.w / 2 + (side / 2) * s.u, s.h * 0.84, [0, 2], [0, 1]);
      s.line(P.l, P.b, P.r, P.b, s.c('--axis'), 0.3);
      s.line(P.l, P.b, P.l, P.t, s.c('--axis'), 0.3);
      const ax = { size: 2.8, font: 'mono', color: s.c('--ink-3') } as const;
      s.text('feature size', P.r, P.b + 3.5 * s.u, { ...ax, align: 'right' });
      s.text('0', P.l, P.b + 3.5 * s.u, ax);
      s.text('pull to 0', P.l + 1.5 * s.u, P.t, { ...ax, align: 'left' });
      // λ = 0.25 here, so 2λf meets λ at f = 0.5.
      s.line(P.X(0), P.Y(0), P.X(2), P.Y(1), s.c('blue'), 0.55);
      label(s, 'L2: 2λf', P.X(1.55), P.Y(0.78) - 3.5 * s.u, 'blue', 'right');
      s.alpha(after(s, 'fade', 0.5) * (1 - s.ease('push', 0.5)), () => label(s, 'fades near 0', P.X(0.7), P.b - 2.8 * s.u, 'blue', 'left', 2.9));
      s.alpha(s.ease('push', 0.6), () => {
        s.line(P.X(0), P.Y(0.25), P.X(2), P.Y(0.25), s.c('red'), 0.55);
        label(s, 'L1: λ', P.X(2), P.Y(0.25) + 3.5 * s.u, 'red', 'right');
      });
    });
    const cy = s.h * 0.93;
    s.alpha(s.win('err', 'l1'), () => caption(s, 'rebuild well: ‖x − x̂‖²', s.h * 0.22, XHAT, big));
    s.alpha(s.win('fade', 'push'), () => caption(s, 'L2: small features linger', cy, 'blue', big));
    s.alpha(s.win('push', 'balance'), () => caption(s, 'L1: small features pushed to exactly 0', cy, 'red', s.tall ? 3.1 : 3.5));
    s.alpha(bal, () => {
      const lam = p < 0.55 ? '0.3' : '0.03';
      const msg = p < 0.55 ? `λ up to ${lam}: fewer on, rougher rebuild` : `λ down to ${lam}: more on, better rebuild`;
      caption(s, msg, s.h * 0.58, '--ink-2', s.tall ? 3 : 3.4);
    });
  },
};

// ---- 4. A sum of a few directions ----------------------------------------------------

const rebuild: SceneDef = {
  draw(s) {
    const F = plane(s);
    const on = s.ease('on', 0.6);
    const a = s.ease('a', 0.7);
    const b = s.ease('b', 0.7);
    const c = s.ease('sum', 0.8);
    // The two active features' directions, from the origin.
    s.alpha(on * (1 - 0.5 * a), () => {
      vec(s, F, 0, 0, 1, 1, V1, 0.45);
      label(s, 'v₁ = [1, 1]', F.X(1) - 1.5 * s.u, F.Y(1) - 3 * s.u, V1, 'right');
    });
    s.alpha(on * (1 - 0.5 * b), () => {
      vec(s, F, 0, 0, 1, -1, V4, 0.45);
      label(s, 'v₄ = [1, −1]', F.X(1) + 3 * s.u, F.Y(-1), V4, 'left');
    });
    s.alpha(a, () => {
      vec(s, F, 0, 0, 2 * Math.min(1, s.ease('a', 1.2)), 2 * Math.min(1, s.ease('a', 1.2)), V1, 0.6);
      label(s, '2 × v₁ = [2, 2]', F.X(2) + 2.5 * s.u, F.Y(2) - 1 * s.u, V1, 'left');
    });
    s.alpha(b, () => {
      vec(s, F, 2, 2, 2 + s.ease('b', 1.2), 2 - s.ease('b', 1.2), V4, 0.6);
      label(s, '1 × v₄', F.X(2.6) + 2 * s.u, F.Y(1.6) - 1 * s.u, V4, 'left');
    });
    s.alpha(c, () => {
      vec(s, F, 0, 0, 3, 1, XHAT, 0.75);
      label(s, 'x̂ = [3, 1] = x', F.X(3) + 2.5 * s.u, F.Y(1) + 1 * s.u, XHAT, 'left', 3.3);
    });
    // The code underneath: only features 1 and 4 are on.
    const xs = columns(s, 8, s.tall ? 11.5 : 12.5);
    const yc = s.h * 0.79;
    cells(s, xs, yc, CODE.map((v) => num(v)), FT, { w: s.tall ? 10.5 : 11.5, h: 7.5, size: 3, on: CODE.map((v) => (v > 0 ? on : 0)) });
    s.text('f', xs[0]! - 7.5 * s.u, yc, { size: 3.4, font: 'mono', weight: 700, color: s.c(FT) });
    const big = s.tall ? 3.1 : 3.5;
    const cy = s.h * 0.9;
    s.alpha(s.win('sum', 'meaning'), () => rich(s, [['x̂ = ', XHAT], ['2·[1, 1]', V1], [' + ', '--ink-2'], ['1·[1, −1]', V4], [' = [3, 1]', XHAT]], s.w / 2, cy, { size: big }));
    s.alpha(s.win('meaning', 'olshausen'), () => caption(s, 'monosemantic: one meaning per feature', cy, FT, big));
    s.alpha(s.win('olshausen', 'found'), () => caption(s, 'a sparse code for natural images', cy, '--ink-2', big));
    s.alpha(s.ease('found', 0.6), () => caption(s, 'sparse autoencoders on language models', cy, '--ink-2', big));
    cite(s, 'Olshausen & Field, 1996', s.win('olshausen', 'found'));
    cite(s, 'Bricken et al. · Cunningham et al., 2023', s.ease('found', 0.6));
  },
};

export const scenes: Record<string, SceneDef> = { tangle, wide, loss, rebuild };
